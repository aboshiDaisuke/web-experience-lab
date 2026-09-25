// One offscreen WebGL "photo studio" shared by every product card and the detail viewer.
// It renders into 2D canvases (drawImage right after render), so the page needs one GL context
// for all thumbnails, however many cards there are.
import * as T from 'three';
import type { ItemId } from './data';
import { studioEnvironment } from './env';
import { buildItem, disposeObject } from './items3d';

export type Shot = { id: ItemId; v: string; x?: number; z?: number; yaw?: number };
export type View = { yaw?: number; pitch?: number; fill?: number };

const FLAT = new Set<ItemId>(['rinka', 'nanasun', 'board', 'spoon', 'hashi', 'fukin', 'apron', 'zaru', 'pan']);
/** a pleasant default turn per item (radians) */
const YAW: Partial<Record<ItemId, number>> = {
  shinogi: -0.55,
  kyusu: 0.5,
  board: 0.35,
  spoon: 0.6,
  hashi: 0.55,
  pan: 0.45,
  donabe: 0.25,
  fukin: 0.35,
  apron: 0.3,
};
export const defaultYaw = (id: ItemId) => YAW[id] ?? 0.3;
export const defaultPitch = (id: ItemId) => (FLAT.has(id) ? 0.62 : 0.36);

export class Studio {
  readonly renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(24, 1, 0.05, 100);
  private key: T.DirectionalLight;
  private ground: T.Mesh;
  private blob: T.Mesh;
  private cache = new Map<string, { group: T.Group; size: T.Vector3 }>();
  private stage = new T.Group();
  private envRT: T.WebGLRenderTarget;
  private blobTex: T.Texture;
  private queue: { target: HTMLCanvasElement; shots: Shot[]; view: View }[] = [];
  private raf = 0;
  private dead = false;
  private fits = new Map<string, number>();
  readonly dprCap: number;

  constructor(dprCap: number) {
    this.dprCap = dprCap;
    const r = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.NeutralToneMapping;
    r.toneMappingExposure = 1.02;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFShadowMap;
    this.renderer = r;
    this.envRT = studioEnvironment(r);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.95;

    const key = new T.DirectionalLight('#fff3e2', 2.1);
    key.position.set(-3, 5, 2.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 5;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.004;
    this.key = key;
    this.scene.add(key, key.target);
    const rim = new T.DirectionalLight('#dfe8ff', 0.5);
    rim.position.set(3, 2, -4);
    this.scene.add(rim);

    this.ground = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: 0.2, color: '#3a2a1a' }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // soft contact shadow (ambient occlusion under the piece)
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(40,26,14,0.55)');
    g.addColorStop(0.45, 'rgba(40,26,14,0.22)');
    g.addColorStop(1, 'rgba(40,26,14,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    this.blobTex = new T.CanvasTexture(c);
    this.blob = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false, toneMapped: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.002;
    this.blob.renderOrder = -1;
    this.scene.add(this.blob, this.stage);
  }

  private item(id: ItemId, v: string, n = 0) {
    const k = `${id}.${v}`;
    let it = this.cache.get(k);
    if (!it) {
      it = buildItem(id, v);
      this.cache.set(k, it);
    }
    if (!n) return it;
    // duplicates in one shot share geometry and materials
    const ck = `${k}#${n}`;
    let c = this.clones.get(ck);
    if (!c) {
      c = { group: it.group.clone(), size: it.size };
      this.clones.set(ck, c);
    }
    return c;
  }
  private clones = new Map<string, { group: T.Group; size: T.Vector3 }>();

  /** Render `shots` into `target` (a 2D canvas sized in CSS px × dpr). */
  draw(target: HTMLCanvasElement, shots: Shot[], view: View = {}) {
    if (this.dead || !shots.length) return;
    const w = target.width;
    const h = target.height;
    if (!w || !h) return;
    const r = this.renderer;
    const cur = r.getSize(new T.Vector2());
    if (cur.x !== w || cur.y !== h) r.setSize(w, h, false);
    r.setPixelRatio(1);

    this.stage.clear();
    const bb = new T.Box3();
    const seen: Record<string, number> = {};
    for (const s of shots) {
      const k = `${s.id}.${s.v}`;
      const it = this.item(s.id, s.v, (seen[k] = (seen[k] ?? -1) + 1));
      const g = it.group;
      g.position.set(s.x ?? 0, 0, s.z ?? 0);
      g.rotation.set(0, s.yaw ?? 0, 0);
      this.stage.add(g);
    }
    const main = shots[0];
    const yaw = view.yaw ?? defaultYaw(main.id);
    const pitch = view.pitch ?? defaultPitch(main.id);
    this.stage.rotation.y = yaw;
    this.stage.updateMatrixWorld(true);
    bb.setFromObject(this.stage);
    const size = bb.getSize(new T.Vector3());
    const ctr = bb.getCenter(new T.Vector3());

    // contact shadow and key-light frustum follow the piece
    this.blob.scale.set(size.x * 1.25 + 0.05, size.z * 1.25 + 0.05, 1);
    this.blob.position.set(ctr.x, 0.002, ctr.z);
    const ext = Math.max(size.x, size.z, size.y) * 0.9 + 0.1;
    const sc = this.key.shadow.camera;
    sc.left = -ext;
    sc.right = ext;
    sc.top = ext;
    sc.bottom = -ext;
    sc.near = 0.1;
    sc.far = 20;
    sc.updateProjectionMatrix();
    this.key.target.position.copy(ctr);
    this.key.position.set(ctr.x - 3, 5, ctr.z + 2.5);

    // framing: fit a stable radius (max over turns) so spinning does not "breathe"
    const cam = this.camera;
    cam.aspect = w / h;
    const fitKey = `${shots.map((s) => s.id + s.v).join()}|${(w / h).toFixed(2)}|${pitch.toFixed(2)}|${view.fill ?? 0}`;
    let dist = this.fits.get(fitKey);
    const target3 = new T.Vector3(ctr.x, size.y * 0.42, ctr.z);
    if (dist === undefined) {
      dist = this.fit(size, pitch, view.fill ?? 0.8);
      this.fits.set(fitKey, dist);
    }
    cam.position.set(target3.x, target3.y + Math.sin(pitch) * dist, target3.z + Math.cos(pitch) * dist);
    cam.lookAt(target3);
    cam.updateProjectionMatrix();
    r.render(this.scene, cam);
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(r.domElement, 0, 0, w, h);
  }

  private fit(size: T.Vector3, pitch: number, fill: number) {
    // footprint diagonal covers every turn; height counts at the given pitch
    const foot = Math.hypot(size.x, size.z);
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const visH = foot * Math.sin(pitch) + size.y * Math.cos(pitch);
    const dv = visH / 2 / Math.tan(vFov / 2) / fill;
    const dh = foot / 2 / Math.tan(hFov / 2) / fill;
    return Math.max(dv, dh) + foot * 0.12;
  }

  /** Queue a still render (processed a couple per frame so the page stays responsive). */
  request(target: HTMLCanvasElement, shots: Shot[], view: View = {}) {
    this.queue = this.queue.filter((q) => q.target !== target);
    this.queue.push({ target, shots, view });
    if (!this.raf) this.raf = requestAnimationFrame(this.pump);
  }
  private pump = () => {
    this.raf = 0;
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < 24) {
      const q = this.queue.shift()!;
      if (q.target.isConnected) this.draw(q.target, q.shots, q.view);
    }
    if (this.queue.length) this.raf = requestAnimationFrame(this.pump);
  };

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.stage.clear();
    this.cache.forEach((c) => disposeObject(c.group));
    this.cache.clear();
    this.envRT.dispose();
    this.blobTex.dispose();
    (this.ground.material as T.Material).dispose();
    this.ground.geometry.dispose();
    (this.blob.material as T.Material).dispose();
    this.blob.geometry.dispose();
    this.renderer.dispose();
  }
}

let shared: Studio | null = null;
let refs = 0;
let failed = false;

/** Acquire the shared studio (null when WebGL is unavailable). */
export function acquireStudio(): Studio | null {
  if (failed) return null;
  if (!shared) {
    try {
      const narrow = matchMedia('(max-width: 760px)').matches;
      shared = new Studio(narrow ? 1.75 : 2);
    } catch {
      failed = true;
      return null;
    }
  }
  refs++;
  return shared;
}
export function releaseStudio() {
  refs--;
  if (refs <= 0 && shared) {
    shared.dispose();
    shared = null;
    refs = 0;
  }
}
