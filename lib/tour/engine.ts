/**
 * Framework-free three.js engine for the 3D property tour.
 *
 *   const tour = mountTour(container, { property }, { onProgress, onChange, … });
 *   tour.setMode('walk', { room: 'living' });
 *   tour.dispose();
 *
 * Modes: dollhouse (orbit around a cut-away model), plan (top-down) and walk
 * (first person at eye height, click the floor to glide). Lighting is fully
 * baked (day / night lightmaps crossfaded in the shader); only glass, plants
 * and tree cards are lit dynamically by the sky environment.
 */
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { TourProperty, TourRoom } from './properties';
import {
  type NavGrid,
  buildGrid,
  cellOf,
  findPath,
  floorYAt,
  isWalkable,
  lineOfSight,
  nearestWalkable,
  simplify,
} from './nav';
import {
  type Shared,
  makeBaked,
  makeCard,
  makeDynamic,
  makeGlass,
  makeGround,
  makeSky,
} from './materials';
import { BASE } from '@/lib/base-path';

export type TourMode = 'dollhouse' | 'plan' | 'walk';

export type TourSnapshot = {
  ready: boolean;
  mode: TourMode;
  floor: string;
  room: string | null;
  night: boolean;
  nightReady: boolean;
  moving: boolean;
  /** current outlook panorama (properties with `views`) */
  view: string | null;
  /** an outlook panorama is loading */
  viewBusy: boolean;
};

export type TourCallbacks = {
  onProgress?: (progress: number) => void;
  onReady?: () => void;
  onChange?: (snapshot: TourSnapshot) => void;
  onHoverRoom?: (room: string | null) => void;
  /** first pointer / key interaction with the 3D view */
  onInteract?: () => void;
  onError?: (error: unknown) => void;
};

export type TourOptions = {
  property: TourProperty;
  mode?: TourMode;
  room?: string;
  night?: boolean;
  /** start with a cinematic fly-in (dollhouse) */
  intro?: boolean;
  reducedMotion?: boolean;
};

export type TourController = {
  setMode: (mode: TourMode, opts?: { room?: string }) => void;
  setFloor: (floorId: string) => void;
  goToRoom: (roomId: string) => void;
  setNight: (night: boolean) => void;
  /** switch the outlook panorama (see `TourProperty.views`) */
  setView: (viewId: string) => void;
  /** HTML overlays positioned by the engine: `room:<id>`, `info:<id>`, `hover` */
  bindOverlay: (key: string, el: HTMLElement | null) => void;
  bindMinimap: (canvas: HTMLCanvasElement | null) => void;
  /** move to the point under a client coordinate on the bound minimap */
  minimapPick: (clientX: number, clientY: number) => void;
  /** screen space covered by UI (px): dollhouse / plan views are centred in the rest */
  setInsets: (insets: { left?: number; right?: number; top?: number; bottom?: number }) => void;
  getSnapshot: () => TourSnapshot;
  /** camera pose + walkability (debug / tests) */
  getCamera: () => { x: number; y: number; z: number; yaw: number; walkable: boolean };
  resize: () => void;
  dispose: () => void;
};

type Marker = { name: string; pos: T.Vector3; floor: number };
type RoutePt = { x: number; y: number; z: number; stair?: boolean };

const DEG = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const lerpAngle = (a: number, b: number, t: number) => a + wrapAngle(b - a) * t;
/** CSS-like cubic-bezier easing */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(d) < 1e-6) break;
      t -= (sx(t) - x) / d;
    }
    t = clamp(t, 0, 1);
    return ((ay * t + by) * t + cy) * t;
  };
}
const easeGlide = bezier(0.42, 0, 0.2, 1);
const easeFlight = bezier(0.55, 0, 0.18, 1);
const easeSoft = bezier(0.4, 0, 0.2, 1);

export function mountTour(
  container: HTMLElement,
  opts: TourOptions,
  cb: TourCallbacks = {},
): TourController {
  const P = opts.property;
  const reduced =
    opts.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const ac = new AbortController();
  let disposed = false;

  // ------------------------------------------------------------------ renderer
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  const dprCap = coarse || Math.min(screen.width, screen.height) < 760 ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.toneMappingExposure = P.exposure.day;
  renderer.localClippingEnabled = true;
  renderer.setClearColor('#dcddd3');
  const canvas = renderer.domElement;
  canvas.className = 'tour-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${P.title}の3Dビュー`);
  container.appendChild(canvas);
  const blink = document.createElement('div');
  blink.className = 'tour-blink';
  container.appendChild(blink);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, 0.05, 1200);
  const shared: Shared = {
    uMix: { value: opts.night ? 1 : 0 },
    uTime: { value: 0 },
    uSway: { value: reduced ? 0 : 1 },
  };
  const clipPlane = new T.Plane(new T.Vector3(0, -1, 0), 1e4);
  const raycaster = new T.Raycaster();

  // ------------------------------------------------------------------ state
  const floors = P.floors;
  const floorIndex = (id: string) => Math.max(0, floors.findIndex((f) => f.id === id));
  let mode: TourMode = opts.mode ?? 'dollhouse';
  let floor = 0;
  let room: string | null = null;
  let night = !!opts.night;
  let nightReady = false;
  let ready = false;
  let interacted = false;
  const views = P.views ?? [];
  let view: string | null = views.length ? P.defaultView ?? views[0].id : null;
  let viewBusy = false;
  const viewFiles = (id: string | null) => {
    const v = views.find((x) => x.id === id);
    return v ? { day: v.day, night: v.night } : { day: P.skyDay, night: P.skyNight };
  };
  let lastSnap = '';

  const groups = new Map<string, T.Object3D>();
  const groupFloor = new Map<string, number>(); // building group → floor index (-1 site / roof)
  const buildingMeshes: T.Mesh[] = []; // raycast / occlusion targets
  const glassMeshes: T.Mesh[] = []; // room boundaries for room detection
  const navMeshes: T.Mesh[][] = floors.map(() => []);
  const grids: (NavGrid | null)[] = floors.map(() => null);
  const hs = new Map<string, Marker>();
  const wp = new Map<string, Marker>();
  const infos = new Map<string, Marker>();
  const roomLook = new Map<string, number>();
  const nightTex: { value: T.Texture }[] = [];
  const lampMats: T.MeshStandardMaterial[] = [];
  const dynMats: { m: T.MeshStandardMaterial; base: number }[] = [];
  const disposables: { dispose: () => void }[] = [];
  const skyNight = { value: null as unknown as T.Texture };
  let skyMat: T.ShaderMaterial | null = null;
  let buildingBox = new T.Box3();
  let ringsGroup: T.Group | null = null;
  const rings = new Map<string, T.Mesh>();
  let cursor: T.Group | null = null;
  let cursorOpacity = 0;
  let cursorTarget = 0;

  // camera rigs ---------------------------------------------------------------
  const orbit = {
    target: new T.Vector3(),
    yaw: 0,
    pitch: 0,
    dist: 30,
    fov: 38,
    g: { target: new T.Vector3(), yaw: 0, pitch: 0, dist: 30, fov: 38 },
  };
  const walk = {
    pos: new T.Vector3(),
    yaw: 0,
    pitch: -0.04,
    fov: 60,
    g: { yaw: 0, pitch: -0.04, fov: 60 },
    vyaw: 0,
    vpitch: 0,
    floorY: 0,
  };
  let rig: 'orbit' | 'walk' = 'orbit';
  let autoRotate = !reduced;
  type Flight = {
    t0: number;
    dur: number;
    p0: T.Vector3;
    q0: T.Quaternion;
    f0: number;
    p1: T.Vector3;
    q1: T.Quaternion;
    f1: number;
    lift: number;
    done: () => void;
  };
  let flight: Flight | null = null;
  type OrbitTween = {
    t0: number;
    dur: number;
    from: { target: T.Vector3; yaw: number; pitch: number; dist: number; fov: number };
    to: { target: T.Vector3; yaw: number; pitch: number; dist: number; fov: number };
    ease: (x: number) => number;
    done?: () => void;
  };
  let otween: OrbitTween | null = null;
  type Glide = {
    curve: T.Curve<T.Vector3>;
    len: number;
    t0: number;
    dur: number;
    follow: boolean;
    endYaw: number | null;
    startYaw: number;
    stairs: [number, number] | null; // u range on stairs
    done?: () => void;
  };
  let glide: Glide | null = null;
  const clip = { value: 1e4, from: 1e4, to: 1e4, t0: 0, dur: 0, done: null as null | (() => void) };

  let now = performance.now();
  const time = () => now / 1000;

  // ------------------------------------------------------------------ helpers
  const eye = P.eyeHeight;
  const horizon = P.horizon ?? (P.site.length ? 'ground' : 'panorama');
  const floorOfY = (y: number) => {
    let f = 0;
    floors.forEach((fl, i) => {
      if (y >= fl.elevation - 0.6) f = i;
    });
    return f;
  };
  const roomById = (id: string) => P.rooms.find((r) => r.id === id);
  const aspect = () => Math.max(0.2, container.clientWidth / Math.max(1, container.clientHeight));
  const walkBaseFov = () => {
    const a = aspect();
    const h = 84 * DEG;
    return clamp((2 * Math.atan(Math.tan(h / 2) / a)) / DEG, 52, 80);
  };

  function emit() {
    const s = getSnapshot();
    const key = JSON.stringify(s);
    if (key === lastSnap) return;
    lastSnap = key;
    cb.onChange?.(s);
  }
  function getSnapshot(): TourSnapshot {
    return {
      ready,
      mode,
      floor: floors[floor]?.id ?? '',
      room,
      night,
      nightReady,
      moving: !!glide || !!flight,
      view,
      viewBusy,
    };
  }
  function markInteract() {
    autoRotate = false;
    if (!interacted) {
      interacted = true;
      cb.onInteract?.();
    }
  }

  // ------------------------------------------------------------------ loading
  const progress = new Map<string, [number, number]>();
  let stage = 0; // 0..0.15 after downloads
  const reportProgress = () => {
    let a = 0;
    let b = 0;
    progress.forEach(([l, t]) => {
      a += Math.min(l, t);
      b += t;
    });
    cb.onProgress?.(clamp((b ? a / b : 0) * 0.85 + stage, 0, 1));
  };
  async function fetchBytes(url: string, estimate: number, track = true) {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const total = Number(res.headers.get('content-length')) || estimate;
    if (track) progress.set(url, [0, total]);
    if (!res.body || !track) return res.arrayBuffer();
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      progress.set(url, [loaded, Math.max(total, loaded)]);
      reportProgress();
    }
    progress.set(url, [loaded, loaded]);
    reportProgress();
    const out = new Uint8Array(loaded);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out.buffer;
  }
  async function bitmap(buf: ArrayBuffer, type: string, flip: boolean) {
    return createImageBitmap(new Blob([buf], { type }), {
      imageOrientation: flip ? 'flipY' : 'from-image',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    });
  }
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function lightmapTexture(bmp: ImageBitmap) {
    const t = new T.Texture(bmp as unknown as HTMLImageElement);
    t.flipY = false;
    t.channel = 1;
    t.colorSpace = T.NoColorSpace;
    t.anisotropy = Math.min(4, maxAniso);
    t.needsUpdate = true;
    disposables.push(t);
    return t;
  }
  function skyTexture(bmp: ImageBitmap) {
    const t = new T.Texture(bmp as unknown as HTMLImageElement);
    t.flipY = false;
    t.colorSpace = T.SRGBColorSpace;
    t.mapping = T.EquirectangularReflectionMapping;
    t.generateMipmaps = false;
    t.minFilter = T.LinearFilter;
    t.wrapS = T.RepeatWrapping;
    t.needsUpdate = true;
    disposables.push(t);
    return t;
  }
  function hazeOf(bmp: ImageBitmap) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const g = c.getContext('2d', { willReadFrequently: true });
    const col = new T.Color('#cfd3cb');
    if (!g) return col;
    g.drawImage(bmp, 0, 0, 128, 64);
    // bitmap is flipped (bottom row first): horizon band just above the middle
    const d = g.getImageData(0, 32, 128, 3).data;
    let r = 0;
    let gg = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      gg += d[i + 1];
      b += d[i + 2];
    }
    const n = d.length / 4;
    return col.setRGB(r / n / 255, gg / n / 255, b / n / 255, T.SRGBColorSpace);
  }

  const lmNames = (): string[] => {
    const g = [...P.site, ...floors.flatMap((f) => [...f.groups, ...f.ceiling]), ...P.roof];
    return [...new Set(g)];
  };
  const lmUrl = (group: string, when: 'day' | 'night') =>
    `${P.base}/${P.id}-${group}-${when}.webp`;

  async function load() {
    const base = P.base;
    const [glbBuf, bakeBuf, skyBuf, ...lmBufs] = await Promise.all([
      fetchBytes(`${base}/${P.model}`, 2_000_000),
      fetchBytes(`${base}/${P.id}-bake.json`, 400, false).catch(() => null),
      fetchBytes(`${base}/${viewFiles(view).day}`, 300_000),
      ...lmNames().map((g) =>
        fetchBytes(lmUrl(g, 'day'), 60_000).catch(() => null),
      ),
    ]);
    if (disposed) return;
    let scale = 4;
    try {
      if (bakeBuf) scale = JSON.parse(new TextDecoder().decode(bakeBuf)).scale || 4;
    } catch {
      /* default scale */
    }
    stage = 0.04;
    reportProgress();
    const skyBmp = await bitmap(skyBuf, 'image/jpeg', true);
    const skyDay = skyTexture(skyBmp);
    const hazeDay = hazeOf(skyBmp);
    const dayLm = new Map<string, T.Texture>();
    const siteBitmaps = new Map<string, ImageBitmap>();
    await Promise.all(
      lmNames().map(async (g, i) => {
        const buf = lmBufs[i];
        if (!buf) return;
        const bmp = await bitmap(buf, 'image/webp', false);
        dayLm.set(`${P.id}-${g}`, lightmapTexture(bmp));
        if (P.site.includes(g)) siteBitmaps.set(`${P.id}-${g}`, bmp);
      }),
    );
    if (disposed) return;

    // glTF
    const draco = new DRACOLoader().setDecoderPath(`${BASE}/draco/`);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    // tolerate textures without an image source (exporter artefact)
    loader.register((parser) => ({
      name: 'tour_sourceless_textures',
      loadTexture(i: number) {
        const def = parser.json.textures?.[i];
        if (!def) return null;
        const ext = (def.extensions ?? {}) as Record<string, { source?: number }>;
        const hasSource =
          def.source !== undefined || Object.values(ext).some((e) => e?.source !== undefined);
        return hasSource ? null : (Promise.resolve(null) as unknown as Promise<T.Texture>);
      },
    }));
    const gltf = await loader.parseAsync(glbBuf, `${base}/`).finally(() => draco.dispose());
    if (disposed) return;
    stage = 0.1;
    reportProgress();

    const pmrem = new T.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRoom = pmrem.fromScene(roomEnv, 0.04).texture;
    roomEnv.traverse((o) => {
      if ((o as T.Mesh).isMesh) {
        (o as T.Mesh).geometry.dispose();
        ((o as T.Mesh).material as T.Material).dispose();
      }
    });
    const envSky = pmrem.fromEquirectangular(skyDay).texture;
    pmrem.dispose();
    disposables.push(envRoom, envSky);

    setupModel(gltf.scene, scale, dayLm, envRoom, envSky, siteBitmaps);
    setupSky(skyDay, hazeDay);
    buildNavigation();
    setupRings();
    stage = 0.13;
    reportProgress();

    // initial view
    orbitFraming(false);
    snapOrbit();
    const startRoom = opts.room ?? P.startRoom;
    if (mode === 'walk') {
      const r = roomById(startRoom) ?? roomById(P.startRoom)!;
      floor = floorIndex(r.floor);
      placeWalkAtRoom(r.id);
      rig = 'walk';
      applyCut(true);
    } else {
      floor = mode === 'plan' ? 0 : floorIndex(roomById(startRoom)?.floor ?? floors[0].id);
      if (mode === 'plan') planFraming();
      snapOrbit();
      applyCut(true);
    }
    resize();
    applyCamera(0);
    try {
      await renderer.compileAsync(scene, camera);
    } catch {
      /* compile lazily */
    }
    if (disposed) return;
    ready = true;
    stage = 0.15;
    cb.onProgress?.(1);
    if (mode === 'dollhouse' && opts.intro && !reduced) intro();
    updateRoom(true);
    emit();
    cb.onReady?.();
    loadNight().catch(() => {});
  }

  async function loadNight() {
    const [skyBuf, ...bufs] = await Promise.all([
      fetchBytes(`${P.base}/${viewFiles(view).night}`, 80_000, false),
      ...lmNames().map((g) => fetchBytes(lmUrl(g, 'night'), 80_000, false).catch(() => null)),
    ]);
    if (disposed) return;
    const skyBmp = await bitmap(skyBuf, 'image/jpeg', true);
    skyNight.value = skyTexture(skyBmp);
    if (skyMat) skyMat.uniforms.uHazeNight.value.copy(hazeOf(skyBmp));
    const maps = new Map<string, T.Texture>();
    await Promise.all(
      lmNames().map(async (g, i) => {
        if (!bufs[i]) return;
        maps.set(`${P.id}-${g}`, lightmapTexture(await bitmap(bufs[i]!, 'image/webp', false)));
      }),
    );
    if (disposed) return;
    nightTex.forEach((u) => {
      const key = (u as { key?: string }).key;
      const t = key ? maps.get(key) : undefined;
      if (t) u.value = t;
    });
    nightReady = true;
    emit();
  }

  // ------------------------------------------------------------------ model
  function setupModel(
    root: T.Object3D,
    scale: number,
    dayLm: Map<string, T.Texture>,
    envRoom: T.Texture,
    envSky: T.Texture,
    siteBitmaps: Map<string, ImageBitmap>,
  ) {
    scene.add(root);
    root.updateMatrixWorld(true);
    root.children.forEach((c) => groups.set(c.name, c));
    const building = new Set<string>();
    floors.forEach((f, i) => {
      f.groups.forEach((g) => {
        groupFloor.set(g, i);
        building.add(g);
      });
      f.ceiling.forEach((g) => {
        groupFloor.set(g, i);
        building.add(g);
      });
    });
    P.roof.forEach((g) => {
      groupFloor.set(g, floors.length);
      building.add(g);
    });
    P.site.forEach((g) => groupFloor.set(g, -1));

    const topOf = (o: T.Object3D) => {
      let p = o;
      while (p.parent && p.parent !== root) p = p.parent;
      return p.name;
    };
    const lmKeyOf = (o: T.Object3D) => {
      for (let p: T.Object3D | null = o; p && p !== root; p = p.parent)
        if (typeof p.userData.lightmap === 'string') return p.userData.lightmap as string;
      return null;
    };
    const cache = new Map<string, T.Material>();
    const nightByKey = new Map<string, { value: T.Texture; key: string }>();
    const intensity = scale * Math.PI;
    const glass = makeGlass(envSky);
    glass.clippingPlanes = [clipPlane];
    disposables.push(glass);
    dynMats.push({ m: glass, base: glass.envMapIntensity });
    const obstacles: T.Mesh[] = [];
    let grass: { mesh: T.Mesh; mat: T.MeshStandardMaterial; key: string } | null = null;

    const markers: T.Object3D[] = [];
    root.traverse((o) => {
      const n = o.name;
      if (/^(HS|WP|INFO)_/.test(n)) markers.push(o);
      const mesh = o as T.Mesh;
      if (!mesh.isMesh) return;
      const top = topOf(o);
      const clipped = building.has(top);
      if (n.startsWith('NAV_')) {
        mesh.visible = false;
        const fid = n.slice(4).replace(/_[^_]*$/, '');
        const fi = floors.findIndex((f) => f.id === fid);
        if (fi >= 0) navMeshes[fi].push(mesh);
        return;
      }
      const key = lmKeyOf(o);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = mats.map((src) => {
        const s = src as T.MeshStandardMaterial;
        const ck = `${s.uuid}|${key ?? 'dyn'}|${clipped ? 1 : 0}`;
        const hit = cache.get(ck);
        if (hit) return hit;
        let m: T.Material;
        if (key && dayLm.has(key)) {
          let nt = nightByKey.get(key);
          if (!nt) {
            nt = { value: dayLm.get(key)!, key };
            nightByKey.set(key, nt);
            nightTex.push(nt);
          }
          const bm = makeBaked(s, dayLm.get(key)!, nt, intensity, envRoom, shared);
          if (/lamp/i.test(s.name)) {
            bm.emissive = new T.Color('#ffd09a');
            bm.emissiveIntensity = 0;
            lampMats.push(bm);
          }
          if (s.map) s.map.anisotropy = Math.min(8, maxAniso);
          m = bm;
        } else if (/^glass/i.test(s.name)) {
          m = glass;
        } else if (/^card_/i.test(s.name)) {
          const cm = makeCard(s, envSky, shared);
          dynMats.push({ m: cm, base: cm.envMapIntensity });
          m = cm;
        } else {
          const dm = makeDynamic(s, envSky, !P.site.includes(top));
          dynMats.push({ m: dm, base: dm.envMapIntensity });
          m = dm;
        }
        if (clipped) m.clippingPlanes = [clipPlane];
        cache.set(ck, m);
        disposables.push(m);
        return m;
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
      if (next.includes(glass)) glassMeshes.push(mesh);
      mats.forEach((m) => m.dispose());
      if (key) {
        buildingMeshes.push(mesh);
        obstacles.push(mesh);
        const mm = next[0] as T.MeshStandardMaterial;
        if (P.site.includes(top) && /grass/i.test(mm.name)) grass = { mesh, mat: mm, key };
      }
      if (clipped || key) {
        mesh.geometry.computeBoundingSphere();
        mesh.geometry.computeBoundingBox();
      }
    });

    // markers
    markers.forEach((o) => {
      const pos = o.getWorldPosition(new T.Vector3());
      const [kind, ...rest] = o.name.split('_');
      const name = rest.join('_');
      const top = topOf(o);
      const gf = groupFloor.get(top);
      const fl = gf !== undefined && gf >= 0 && gf < floors.length ? gf : floorOfY(pos.y);
      const mk = { name, pos, floor: fl };
      if (kind === 'HS') hs.set(name, { ...mk, floor: floorOfY(pos.y) });
      else if (kind === 'WP') wp.set(o.name, { ...mk, floor: floorOfY(pos.y) });
      else infos.set(name, mk);
    });
    P.rooms.forEach((r) => {
      const m = hs.get(r.id);
      if (m) m.floor = floorIndex(r.floor);
    });

    // building bounds
    buildingBox = new T.Box3();
    building.forEach((g) => {
      const o = groups.get(g);
      if (o) buildingBox.expandByObject(o);
    });
    if (buildingBox.isEmpty()) buildingBox.setFromObject(root);

    // obstacle grid input
    const boxes: T.Box3[] = [];
    root.traverse((o) => {
      if (!o.userData.nobake) return;
      let hasCard = false;
      o.traverse((c) => {
        const m = (c as T.Mesh).material as T.Material | undefined;
        if (m && /^(card_|glass)/i.test(m.name)) hasCard = true;
      });
      if (!hasCard) {
        const b = new T.Box3().setFromObject(o);
        // trunk/pot footprint only: shrink wide foliage
        const c = b.getCenter(new T.Vector3());
        const s = b.getSize(new T.Vector3());
        const r = Math.min(Math.max(s.x, s.z) * 0.5, 0.45);
        boxes.push(new T.Box3(new T.Vector3(c.x - r, b.min.y, c.z - r), new T.Vector3(c.x + r, b.max.y, c.z + r)));
      }
    });
    obstacleInput = { meshes: obstacles, boxes };

    // ground continuing the lot to the horizon
    if (horizon === 'ground') setupGround(grass, siteBitmaps, intensity);
  }
  let obstacleInput: { meshes: T.Mesh[]; boxes: T.Box3[] } = { meshes: [], boxes: [] };

  function setupGround(
    grass: { mesh: T.Mesh; mat: T.MeshStandardMaterial; key: string } | null,
    siteBitmaps: Map<string, ImageBitmap>,
    intensity: number,
  ) {
    let tile = 4;
    let irr = 1.6 * Math.PI;
    let map: T.Texture | null = null;
    let tint = new T.Color('#8a9a6c');
    if (grass) {
      const geo = grass.mesh.geometry;
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      const uv1 = geo.attributes.uv1;
      if (pos && uv && pos.count >= 3) {
        // world metres per texture repeat
        const a = new T.Vector3().fromBufferAttribute(pos, 0).applyMatrix4(grass.mesh.matrixWorld);
        let best = 0;
        for (let i = 1; i < pos.count; i++) {
          const b = new T.Vector3().fromBufferAttribute(pos, i).applyMatrix4(grass.mesh.matrixWorld);
          const du = Math.abs(uv.getX(i) - uv.getX(0));
          const dx = Math.abs(b.x - a.x);
          if (du > 0.5 && dx > 1 && dx / du > best) best = dx / du;
        }
        if (best > 0) tile = best;
      }
      map = grass.mat.map;
      tint = grass.mat.color.clone();
      // average baked light at the lot corners
      const bmp = siteBitmaps.get(grass.key);
      if (bmp && uv1) {
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const g = c.getContext('2d', { willReadFrequently: true });
        if (g) {
          g.drawImage(bmp, 0, 0);
          let sum = 0;
          let n = 0;
          for (let i = 0; i < uv1.count; i++) {
            // sample a little inside each corner
            const cu = clamp(uv1.getX(i), 0, 1);
            const cv = clamp(uv1.getY(i), 0, 1);
            for (const [ox, oy] of [
              [0.02, 0.02],
              [-0.02, 0.02],
              [0.02, -0.02],
              [-0.02, -0.02],
            ]) {
              const x = Math.round(clamp(cu + ox, 0, 1) * (bmp.width - 1));
              const y = Math.round(clamp(cv + oy, 0, 1) * (bmp.height - 1));
              const d = g.getImageData(x, y, 1, 1).data;
              const l = (0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]) / 255;
              if (l > 0.05) {
                sum += l ** 2.2;
                n++;
              }
            }
          }
          if (n) irr = (sum / n) * intensity;
        }
      }
    }
    const mat = makeGround(map, tint, irr, tile);
    const ground = new T.Mesh(new T.CircleGeometry(900, 72).rotateX(-Math.PI / 2), mat);
    ground.position.y = -0.03;
    ground.renderOrder = -1;
    scene.add(ground);
    disposables.push(mat, ground.geometry);
    dynMats.push({ m: mat, base: 0 });
    groundMat = mat;
    groundIrr = irr;
  }
  let groundMat: T.MeshStandardMaterial | null = null;
  let groundIrr = 0;

  function setupSky(day: T.Texture, hazeDay: T.Color) {
    skyNight.value = day;
    skyMat = makeSky(day, skyNight, shared);
    skyMat.uniforms.uHazeDay.value.copy(hazeDay);
    skyMat.uniforms.uHazeNight.value.set('#0b1020');
    const sky = new T.Mesh(new T.SphereGeometry(800, 48, 24), skyMat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    sky.onBeforeRender = () => sky.position.copy(camera.position);
    scene.add(sky);
    disposables.push(skyMat, sky.geometry);
    skyMat.uniforms.uFade.value = horizon === 'ground' ? 1 : 0;
    if (horizon === 'ground') scene.fog = new T.Fog(hazeDay.clone(), 80, 420);
    // sun + sky fill for the non-baked objects (baked materials ignore scene lights)
    const [sx, sy, sz] = P.sun ?? [-0.43, 0.74, 0.51];
    sun.position.set(sx, sy, sz).normalize().multiplyScalar(60);
    scene.add(sun, sun.target, hemi);
  }
  const sun = new T.DirectionalLight('#fff0d8', 2.4);
  const hemi = new T.HemisphereLight('#dde6ef', '#7c7a5e', 1.1);

  // ------------------------------------------------------------------ navigation
  function buildNavigation() {
    floors.forEach((f, i) => {
      grids[i] = buildGrid(f.id, navMeshes[i], obstacleInput.meshes, obstacleInput.boxes);
    });
    P.rooms.forEach((r) => {
      const m = hs.get(r.id);
      if (!m) return;
      roomLook.set(r.id, r.look !== undefined ? r.look * DEG : autoLook(m));
    });
  }

  /** most open direction from a viewpoint (for rooms without a configured look) */
  function autoLook(m: Marker) {
    const g = grids[m.floor];
    if (!g) return 0;
    const N = 48;
    const d: number[] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const dx = Math.sin(a);
      const dz = -Math.cos(a);
      let r = 0;
      for (; r < 14; r += 0.1) {
        const k = cellOf(g, m.pos.x + dx * r, m.pos.z + dz * r);
        if (k < 0 || Number.isNaN(g.navY[k]) || g.dist[k] < 0.12) break;
      }
      d.push(r);
    }
    let best = 0;
    let bestS = -1;
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let j = -5; j <= 5; j++) s += d[(i + j + N) % N] * (1 - Math.abs(j) / 7);
      if (s > bestS) {
        bestS = s;
        best = i;
      }
    }
    return (best / N) * Math.PI * 2;
  }

  const navYAt = (fi: number, x: number, z: number) => {
    const g = grids[fi];
    const y = g ? floorYAt(g, x, z) : NaN;
    return Number.isNaN(y) ? floors[fi].elevation : y;
  };

  /** raycast clearance at knee and chest height along a straight move */
  function raysClear(fi: number, ax: number, az: number, bx: number, bz: number) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) return true;
    const dir = new T.Vector3(bx - ax, 0, bz - az).normalize();
    const fy = navYAt(fi, ax, az);
    const side = new T.Vector3(-dir.z, 0, dir.x);
    for (const h of [0.5, 1.2])
      for (const o of [-0.18, 0, 0.18]) {
        raycaster.set(new T.Vector3(ax, fy + h, az).addScaledVector(side, o), dir);
        raycaster.far = len;
        const hit = raycaster.intersectObjects(buildingMeshes, false)[0];
        if (hit) {
          raycaster.far = Infinity;
          return false;
        }
      }
    raycaster.far = Infinity;
    return true;
  }

  function stairChain(from: number, to: number) {
    for (const chain of P.stairs) {
      const pts = chain.map((n) => wp.get(n)).filter(Boolean) as Marker[];
      if (pts.length < 2) continue;
      const a = floorOfY(pts[0].pos.y);
      const b = floorOfY(pts[pts.length - 1].pos.y);
      if (a === from && b === to) return pts;
      if (a === to && b === from) return [...pts].reverse();
    }
    return null;
  }

  /** same-floor route: direct → hotspot/waypoint visibility graph → grid A* */
  function routeFloor(fi: number, ax: number, az: number, bx: number, bz: number) {
    const g = grids[fi];
    if (!g) return [[ax, az], [bx, bz]] as [number, number][];
    if (lineOfSight(g, ax, az, bx, bz, 0.35) && raysClear(fi, ax, az, bx, bz))
      return [
        [ax, az],
        [bx, bz],
      ] as [number, number][];
    // visibility graph over hotspots and stair waypoints of this floor
    const nodes: [number, number][] = [[ax, az]];
    hs.forEach((m) => m.floor === fi && nodes.push([m.pos.x, m.pos.z]));
    wp.forEach((m) => m.floor === fi && nodes.push([m.pos.x, m.pos.z]));
    nodes.push([bx, bz]);
    const n = nodes.length;
    const dist: number[] = Array.from({ length: n }, () => Infinity);
    const prev: number[] = Array.from({ length: n }, () => -1);
    const done: boolean[] = Array.from({ length: n }, () => false);
    dist[0] = 0;
    const vis = (i: number, j: number) =>
      lineOfSight(g, nodes[i][0], nodes[i][1], nodes[j][0], nodes[j][1], 0.6);
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || dist[u] === Infinity) break;
      if (u === n - 1) break;
      done[u] = true;
      for (let v = 0; v < n; v++) {
        if (done[v] || v === u) continue;
        const d = Math.hypot(nodes[v][0] - nodes[u][0], nodes[v][1] - nodes[u][1]);
        if (dist[u] + d < dist[v] && vis(u, v)) {
          dist[v] = dist[u] + d;
          prev[v] = u;
        }
      }
    }
    if (dist[n - 1] < Infinity) {
      const path: [number, number][] = [];
      for (let v = n - 1; v >= 0; v = prev[v]) path.push(nodes[v]);
      path.reverse();
      return simplify(g, path);
    }
    return findPath(g, ax, az, bx, bz);
  }

  function route(from: { fi: number; x: number; z: number }, to: { fi: number; x: number; z: number }) {
    const pts: RoutePt[] = [];
    const push = (fi: number, xz: [number, number][]) =>
      xz.forEach(([x, z]) => {
        const last = pts[pts.length - 1];
        if (last && Math.hypot(last.x - x, last.z - z) < 0.05 && !last.stair) return;
        pts.push({ x, z, y: navYAt(fi, x, z) + eye });
      });
    let cur = { ...from };
    let guard = 0;
    while (cur.fi !== to.fi && guard++ < 8) {
      const step = to.fi > cur.fi ? 1 : -1;
      const chain = stairChain(cur.fi, cur.fi + step);
      if (!chain) return null;
      const entry = chain[0];
      const exit = chain[chain.length - 1];
      const leg = routeFloor(cur.fi, cur.x, cur.z, entry.pos.x, entry.pos.z);
      if (!leg) return null;
      push(cur.fi, leg.slice(0, -1));
      chain.forEach((m) => pts.push({ x: m.pos.x, z: m.pos.z, y: m.pos.y + eye, stair: true }));
      cur = { fi: cur.fi + step, x: exit.pos.x, z: exit.pos.z };
    }
    const leg = routeFloor(cur.fi, cur.x, cur.z, to.x, to.z);
    if (!leg) return null;
    push(cur.fi, pts.length ? leg.slice(1) : leg);
    return pts;
  }

  /** never end inside furniture: nudge to the nearest free spot or the nearest hotspot */
  function resolveTarget(fi: number, x: number, z: number) {
    const g = grids[fi];
    if (!g) return { x, z };
    if (isWalkable(g, x, z)) return { x, z };
    const n = nearestWalkable(g, x, z, 0.9);
    if (n) return { x: n[0], z: n[1] };
    let best: Marker | null = null;
    let bd = Infinity;
    hs.forEach((m) => {
      if (m.floor !== fi) return;
      const d = Math.hypot(m.pos.x - x, m.pos.z - z);
      if (d < bd) {
        bd = d;
        best = m;
      }
    });
    const b = best as Marker | null;
    return b ? { x: b.pos.x, z: b.pos.z } : null;
  }

  // ------------------------------------------------------------------ cut-away
  function setGroupVisible(name: string, v: boolean) {
    const g = groups.get(name);
    if (g) g.visible = v;
  }
  const cutTop = (i: number) => floors[i].elevation + floors[i].cutHeight;
  let cutFloor = -1;
  let cutMode: 'cut' | 'full' = 'full';
  /** dollhouse / plan hide everything above the selected floor's section */
  function applyCut(instant = false) {
    const want: 'cut' | 'full' = mode === 'walk' ? 'full' : 'cut';
    if (want === 'full') {
      groups.forEach((_, k) => setGroupVisible(k, true));
      clip.value = clip.to = 1e4;
      clip.done = null;
      clip.dur = 0;
      clipPlane.constant = 1e4;
      cutMode = 'full';
      cutFloor = floor;
      return;
    }
    const final = () => {
      floors.forEach((f, j) => {
        f.groups.forEach((g) => setGroupVisible(g, j <= floor));
        f.ceiling.forEach((g) => setGroupVisible(g, j < floor));
      });
      P.roof.forEach((g) => setGroupVisible(g, false));
      clip.value = clip.to = cutTop(floor);
      clipPlane.constant = clip.value;
    };
    if (instant || reduced || cutMode === 'full' || cutFloor === floor) {
      final();
    } else {
      const hi = Math.max(cutFloor, floor);
      floors.forEach((f, j) => {
        f.groups.forEach((g) => setGroupVisible(g, j <= hi));
        f.ceiling.forEach((g) => setGroupVisible(g, j < hi));
      });
      P.roof.forEach((g) => setGroupVisible(g, false));
      clip.from = clip.value < 1e3 ? clip.value : cutTop(cutFloor);
      clip.to = cutTop(floor);
      clip.t0 = now;
      clip.dur = 900;
      clip.done = final;
    }
    cutMode = 'cut';
    cutFloor = floor;
  }

  // ------------------------------------------------------------------ rings & cursor
  function setupRings() {
    ringsGroup = new T.Group();
    const ringGeo = new T.RingGeometry(0.26, 0.31, 48).rotateX(-Math.PI / 2);
    const discGeo = new T.CircleGeometry(0.26, 48).rotateX(-Math.PI / 2);
    disposables.push(ringGeo, discGeo);
    hs.forEach((m, id) => {
      if (!roomById(id)) return;
      const ringMat = new T.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        toneMapped: false,
      });
      const discMat = new T.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        toneMapped: false,
      });
      disposables.push(ringMat, discMat);
      const ring = new T.Mesh(ringGeo, ringMat);
      const disc = new T.Mesh(discGeo, discMat);
      ring.add(disc);
      ring.position.set(m.pos.x, navYAt(m.floor, m.pos.x, m.pos.z) + 0.02, m.pos.z);
      ring.userData.room = id;
      ring.renderOrder = 5;
      ring.visible = false;
      rings.set(id, ring);
      ringsGroup!.add(ring);
    });
    scene.add(ringsGroup);

    cursor = new T.Group();
    const cRing = new T.Mesh(
      new T.RingGeometry(0.2, 0.235, 48),
      new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    );
    const cDisc = new T.Mesh(
      new T.CircleGeometry(0.2, 48),
      new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    );
    [cRing, cDisc].forEach((m) => {
      m.renderOrder = 6;
      disposables.push(m.geometry, m.material as T.Material);
      cursor!.add(m);
    });
    cursor.visible = false;
    scene.add(cursor);
  }

  // ------------------------------------------------------------------ camera poses
  /**
   * Smallest orbit distance at which every corner of the building stays inside
   * the part of the viewport not covered by UI, for any orbit angle.
   */
  function orbitFit(vfov: number, pitch: number, target: T.Vector3) {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const fx = Math.max(0.35, (w - insets.left - insets.right) / w) * 0.96;
    const fy = Math.max(0.35, (h - insets.top - insets.bottom) / h) * 0.96;
    const cam = new T.PerspectiveCamera(vfov, w / h, 0.1, 2000);
    const b = buildingBox;
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (i) =>
        new T.Vector3(
          i & 1 ? b.max.x : b.min.x,
          i & 2 ? b.max.y : b.min.y,
          i & 4 ? b.max.z : b.min.z,
        ),
    );
    const v = new T.Vector3();
    const fits = (dist: number, yaw: number) => {
      const pose = orbitPose({ target, yaw, pitch, dist });
      cam.position.copy(pose.pos);
      cam.quaternion.copy(pose.quat);
      cam.updateMatrixWorld();
      return corners.every((c) => {
        v.copy(c).project(cam);
        return Math.abs(v.x) <= fx && Math.abs(v.y) <= fy && v.z < 1;
      });
    };
    let need = 1;
    for (let k = 0; k < 12; k++) {
      const yaw = (k / 12) * Math.PI * 2;
      let lo = need;
      let hi = 400;
      if (fits(lo, yaw)) continue;
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid, yaw)) hi = mid;
        else lo = mid;
      }
      need = hi;
    }
    return need;
  }
  function orbitFraming(keepYaw: boolean) {
    const d = P.dollhouse;
    const portrait = aspect() < 0.9;
    const fov = portrait ? 52 : d.fov;
    const g = orbit.g;
    g.fov = fov;
    g.pitch = d.pitch * DEG;
    if (!keepYaw) g.yaw = d.yaw * DEG;
    const c = buildingBox.getCenter(new T.Vector3());
    const [tx, tz] = d.target ?? [c.x, c.z];
    g.target.set(tx, floors[floor].elevation + 0.6, tz);
    // `distance` is the preferred framing; never closer than what fits the screen
    const fit = orbitFit(fov, g.pitch, new T.Vector3(tx, floors[0].elevation + 1.2, tz));
    g.dist = clamp(Math.max(d.distance * 0.8, fit), d.minDistance, d.maxDistance * 1.6);
    dollBase = g.dist;
  }
  function planFraming() {
    const g = orbit.g;
    const fov = P.plan.fov;
    const a = aspect();
    const size = buildingBox.getSize(new T.Vector3());
    const hv = Math.tan((fov * DEG) / 2);
    const h = Math.max(1, container.clientHeight);
    const w = Math.max(1, container.clientWidth);
    // usable fraction of the viewport once panels are subtracted
    const fy = Math.max(0.4, (h - insets.top - insets.bottom) / h);
    const fx = Math.max(0.4, (w - insets.left - insets.right) / w);
    const need = Math.max((size.z / 2 + 1.5) / (hv * fy), (size.x / 2 + 1.5) / (hv * a * fx));
    g.fov = fov;
    g.dist = Math.max(need, 10);
    g.pitch = 89.5 * DEG;
    g.yaw = 0;
    const c = buildingBox.getCenter(new T.Vector3());
    const [tx, tz] = P.plan.target ?? [c.x, c.z];
    g.target.set(tx, floors[floor].elevation, tz);
  }
  function snapOrbit() {
    orbit.target.copy(orbit.g.target);
    orbit.yaw = orbit.g.yaw;
    orbit.pitch = orbit.g.pitch;
    orbit.dist = orbit.g.dist;
    orbit.fov = orbit.g.fov;
  }
  function orbitPose(o: { target: T.Vector3; yaw: number; pitch: number; dist: number }) {
    const cp = Math.cos(o.pitch);
    const pos = new T.Vector3(
      o.target.x + Math.sin(o.yaw) * cp * o.dist,
      o.target.y + Math.sin(o.pitch) * o.dist,
      o.target.z + Math.cos(o.yaw) * cp * o.dist,
    );
    const m = new T.Matrix4().lookAt(pos, o.target, new T.Vector3(0, 1, 0));
    return { pos, quat: new T.Quaternion().setFromRotationMatrix(m) };
  }
  function walkQuat(yaw: number, pitch: number) {
    return new T.Quaternion().setFromEuler(new T.Euler(pitch, -yaw, 0, 'YXZ'));
  }
  function placeWalkAtRoom(id: string) {
    const m = hs.get(id);
    if (!m) return;
    walk.pos.set(m.pos.x, navYAt(m.floor, m.pos.x, m.pos.z) + eye, m.pos.z);
    walk.yaw = walk.g.yaw = roomLook.get(id) ?? 0;
    walk.pitch = walk.g.pitch = -0.04;
    walk.fov = walk.g.fov = walkBaseFov();
    floor = m.floor;
    room = id;
  }

  function startFlight(p1: T.Vector3, q1: T.Quaternion, f1: number, dur: number, lift: number, done: () => void) {
    flight = {
      t0: now,
      dur: reduced ? 1 : dur,
      p0: camera.position.clone(),
      q0: camera.quaternion.clone(),
      f0: camera.fov,
      p1,
      q1,
      f1,
      lift: reduced ? 0 : lift,
      done,
    };
    otween = null;
    glide = null;
    emit();
  }
  function startOrbitTween(dur: number, ease = easeFlight, done?: () => void) {
    otween = {
      t0: now,
      dur: reduced ? 1 : dur,
      from: {
        target: orbit.target.clone(),
        yaw: orbit.yaw,
        pitch: orbit.pitch,
        dist: orbit.dist,
        fov: orbit.fov,
      },
      to: {
        target: orbit.g.target.clone(),
        yaw: orbit.yaw + wrapAngle(orbit.g.yaw - orbit.yaw),
        pitch: orbit.g.pitch,
        dist: orbit.g.dist,
        fov: orbit.g.fov,
      },
      ease,
      done,
    };
  }

  function intro() {
    orbitFraming(false);
    const g = orbit.g;
    orbit.target.copy(g.target).add(new T.Vector3(0, -0.4, 0));
    orbit.yaw = g.yaw - 62 * DEG;
    orbit.pitch = 12 * DEG;
    orbit.dist = g.dist * 1.75;
    orbit.fov = g.fov;
    startOrbitTween(3600, bezier(0.3, 0, 0.12, 1));
  }

  // ------------------------------------------------------------------ public actions
  function setMode(next: TourMode, o: { room?: string } = {}) {
    if (!ready) {
      mode = next;
      if (o.room) opts.room = o.room;
      return;
    }
    const prev = mode;
    if (next === 'walk') {
      const id = o.room ?? (prev === 'walk' ? null : room ?? floors[floor].entryRoom);
      if (prev === 'walk') {
        if (id) goToRoom(id);
        return;
      }
      enterWalk(id ?? P.startRoom);
      return;
    }
    if (prev === 'walk') {
      // leave walk: fly out keeping the viewing direction
      floor = floorOfY(walk.pos.y - eye);
      mode = next;
      applyCut(true);
      if (next === 'dollhouse') {
        orbitFraming(false);
        orbit.g.yaw = -walk.yaw;
      } else planFraming();
      snapOrbit();
      const pose = orbitPose(orbit);
      cursorTarget = 0;
      startFlight(pose.pos, pose.quat, orbit.fov, 1700, 2.5, () => {
        rig = 'orbit';
      });
      emit();
      return;
    }
    mode = next;
    if (next === 'plan') planFraming();
    else {
      orbitFraming(false);
      orbit.g.yaw = prev === 'plan' ? P.dollhouse.yaw * DEG : orbit.g.yaw;
    }
    applyCut();
    startOrbitTween(1500, easeFlight);
    emit();
  }

  function enterWalk(id: string) {
    const r = roomById(id);
    if (!r) return;
    const m = hs.get(id);
    if (!m) return;
    mode = 'walk';
    floor = m.floor;
    const pos = new T.Vector3(m.pos.x, navYAt(m.floor, m.pos.x, m.pos.z) + eye, m.pos.z);
    const yaw = roomLook.get(id) ?? 0;
    const fov = walkBaseFov();
    // cut-away stays until the camera is inside the room
    if (cutMode === 'cut' && cutFloor !== floor) {
      mode = 'dollhouse';
      applyCut(true);
      mode = 'walk';
    }
    startFlight(pos, walkQuat(yaw, -0.04), fov, 2100, 3, () => {
      walk.pos.copy(pos);
      walk.yaw = walk.g.yaw = yaw;
      walk.pitch = walk.g.pitch = -0.04;
      walk.fov = walk.g.fov = fov;
      rig = 'walk';
      applyCut(true);
      room = id;
      emit();
    });
    room = id;
    emit();
  }

  function setFloor(id: string) {
    const fi = floorIndex(id);
    if (!ready) {
      floor = fi;
      return;
    }
    if (mode === 'walk') {
      if (fi === floorOfY(walk.pos.y - eye)) return;
      goToRoom(floors[fi].entryRoom);
      return;
    }
    if (fi === floor) return;
    floor = fi;
    orbit.g.target.y = mode === 'plan' ? floors[fi].elevation : floors[fi].elevation + 0.6;
    applyCut();
    emit();
  }

  function goToRoom(id: string) {
    if (!ready) {
      opts.room = id;
      mode = 'walk';
      return;
    }
    const m = hs.get(id);
    if (!m) return;
    if (mode !== 'walk' || flight) {
      if (mode !== 'walk') enterWalk(id);
      return;
    }
    moveTo(m.floor, m.pos.x, m.pos.z, roomLook.get(id) ?? null, id);
  }

  function setNight(v: boolean) {
    night = v;
    emit();
  }

  const swap = { t0: 0, dur: 0, day: null as T.Texture | null, night: null as T.Texture | null };
  let viewReq = 0;
  async function setView(id: string) {
    if (!views.some((v) => v.id === id) || id === view || !skyMat) return;
    const req = ++viewReq;
    view = id;
    viewBusy = true;
    emit();
    try {
      const f = viewFiles(id);
      const [d, n] = await Promise.all([
        fetchBytes(`${P.base}/${f.day}`, 300_000, false),
        fetchBytes(`${P.base}/${f.night}`, 300_000, false),
      ]);
      if (disposed || req !== viewReq) return;
      const [bd, bn] = await Promise.all([bitmap(d, 'image/jpeg', true), bitmap(n, 'image/jpeg', true)]);
      if (disposed || req !== viewReq) return;
      if (swap.dur) finishSwap();
      swap.day = skyTexture(bd);
      swap.night = skyTexture(bn);
      skyMat.uniforms.uDay2.value = swap.day;
      skyMat.uniforms.uNight2.value = swap.night;
      swap.t0 = now;
      swap.dur = reduced ? 1 : 900;
    } catch {
      /* keep the current outlook */
    }
    viewBusy = false;
    emit();
  }
  function finishSwap() {
    if (!skyMat || !swap.day || !swap.night) return;
    const oldD = skyMat.uniforms.uDay.value as T.Texture;
    const oldN = skyNight.value;
    skyMat.uniforms.uDay.value = swap.day;
    skyNight.value = swap.night;
    skyMat.uniforms.uSwap.value = 0;
    swap.dur = 0;
    if (oldD !== swap.day) oldD.dispose();
    if (oldN && oldN !== oldD && oldN !== swap.night) oldN.dispose();
  }

  // ------------------------------------------------------------------ walking
  function moveTo(fi: number, x: number, z: number, endYaw: number | null = null, roomId?: string) {
    const tgt = roomId ? { x, z } : resolveTarget(fi, x, z);
    if (!tgt) return false;
    const cf = floorOfY(walk.pos.y - eye);
    const start = { fi: cf, x: walk.pos.x, z: walk.pos.z };
    const pts = route(start, { fi, x: tgt.x, z: tgt.z });
    const end = new T.Vector3(tgt.x, navYAt(fi, tgt.x, tgt.z) + eye, tgt.z);
    if (!pts || pts.length < 2) {
      // no path: soft blink
      if (end.distanceTo(walk.pos) < 0.1) return false;
      blinkTo(end, endYaw, roomId);
      return true;
    }
    const vs = pts.map((p) => new T.Vector3(p.x, p.y, p.z));
    vs[0].copy(walk.pos);
    vs[vs.length - 1].copy(end);
    const curve =
      vs.length === 2
        ? new T.LineCurve3(vs[0], vs[1])
        : new T.CatmullRomCurve3(vs, false, 'centripetal');
    const len = curve.getLength();
    if (len < 0.08) return false;
    // stairs segment range in curve parameter space
    let stairs: [number, number] | null = null;
    const si = pts.findIndex((p) => p.stair);
    if (si >= 0) {
      let li = si;
      while (li + 1 < pts.length && pts[li + 1].stair) li++;
      stairs = [Math.max(0, (si - 0.5) / (pts.length - 1)), Math.min(1, (li + 0.5) / (pts.length - 1))];
    }
    const dur = clamp(620 + len * 300, 750, 5600) * (vs.length > 2 ? 1.1 : 1);
    glide = {
      curve,
      len,
      t0: now,
      dur: reduced ? 1 : dur,
      follow: vs.length > 2,
      endYaw,
      startYaw: walk.yaw,
      stairs,
      done: () => {
        if (roomId) room = roomId;
        updateRoom(true);
      },
    };
    cursorTarget = 0;
    emit();
    return true;
  }

  function blinkTo(end: T.Vector3, endYaw: number | null, roomId?: string) {
    blink.classList.add('on');
    glide = null;
    setTimeout(() => {
      if (disposed) return;
      walk.pos.copy(end);
      if (endYaw !== null) walk.yaw = walk.g.yaw = endYaw;
      if (roomId) room = roomId;
      updateRoom(true);
      blink.classList.remove('on');
      emit();
    }, reduced ? 60 : 260);
  }

  let roomCheck = 0;
  function updateRoom(force = false) {
    if (!force && now - roomCheck < 250) return;
    roomCheck = now;
    let nf = floor;
    let nr = room;
    if (mode === 'walk' && (rig === 'walk' || force)) {
      const p = rig === 'walk' ? walk.pos : camera.position;
      nf = floorOfY(p.y - eye);
      // nearest viewpoint that is not behind a wall or glass (glass separates inside / outside)
      const cands: { id: string; d: number; m: Marker }[] = [];
      hs.forEach((m, id) => {
        if (m.floor !== nf || !roomById(id)) return;
        cands.push({ id, d: Math.hypot(m.pos.x - p.x, m.pos.z - p.z), m });
      });
      cands.sort((a, b) => a.d - b.d);
      const targets = [...buildingMeshes, ...glassMeshes];
      let best: string | null = cands[0]?.id ?? null;
      for (const c of cands.slice(0, 4)) {
        const to = new T.Vector3(c.m.pos.x, navYAt(nf, c.m.pos.x, c.m.pos.z) + eye, c.m.pos.z);
        const dir = to.clone().sub(p);
        const len = dir.length();
        if (len < 0.3) {
          best = c.id;
          break;
        }
        raycaster.set(p, dir.normalize());
        raycaster.far = len;
        const hit = raycaster.intersectObjects(targets, false)[0];
        raycaster.far = Infinity;
        if (!hit) {
          best = c.id;
          break;
        }
      }
      nr = best;
    }
    if (nf !== floor || nr !== room) {
      floor = nf;
      room = nr;
      emit();
    }
  }

  // ------------------------------------------------------------------ picking
  const ndc = new T.Vector2();
  function setNdc(cx: number, cy: number) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }
  const visibleMeshes = () =>
    buildingMeshes.filter((m) => {
      for (let p: T.Object3D | null = m; p; p = p.parent) if (!p.visible) return false;
      return true;
    });
  function firstVisibleHit(meshes: T.Object3D[]) {
    const hits = raycaster.intersectObjects(meshes, false);
    return hits.find((h) => h.point.y <= clipPlane.constant + 0.01) ?? null;
  }
  type Pick = { fi: number; x: number; z: number; y: number; stairs?: number };
  function pickFloor(cx: number, cy: number): Pick | null {
    setNdc(cx, cy);
    const b = firstVisibleHit(visibleMeshes());
    const navList: T.Mesh[] = [];
    const navFloor = new Map<T.Object3D, number>();
    navMeshes.forEach((l, i) => {
      if (mode !== 'walk' && i > floor) return;
      l.forEach((m) => {
        navList.push(m);
        navFloor.set(m, i);
      });
    });
    const n = raycaster.intersectObjects(navList, false)[0];
    if (n && (!b || b.distance > n.distance - 0.14)) {
      return { fi: navFloor.get(n.object)!, x: n.point.x, z: n.point.z, y: n.point.y };
    }
    if (!b) return null;
    // stairs: clicking a tread takes you to the other floor
    for (const chain of P.stairs) {
      const pts = chain.map((k) => wp.get(k)).filter(Boolean) as Marker[];
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i].pos;
        const c = pts[i + 1].pos;
        const ab = new T.Vector2(c.x - a.x, c.z - a.z);
        const ap = new T.Vector2(b.point.x - a.x, b.point.z - a.z);
        const t = clamp(ap.dot(ab) / Math.max(ab.lengthSq(), 1e-6), 0, 1);
        const d = ap.sub(ab.multiplyScalar(t)).length();
        const y = a.y + (c.y - a.y) * t;
        if (d < 0.9 && Math.abs(b.point.y - y) < 1.2 && pts[0].pos.y !== pts[pts.length - 1].pos.y) {
          const lo = floorOfY(pts[0].pos.y);
          const hi = floorOfY(pts[pts.length - 1].pos.y);
          return { fi: -1, x: b.point.x, z: b.point.z, y: b.point.y, stairs: Math.min(lo, hi) };
        }
      }
    }
    const normal = b.face?.normal.clone().transformDirection(b.object.matrixWorld);
    const fi = floorOfY(b.point.y - 0.05);
    if (normal && normal.y > 0.7) {
      return { fi, x: b.point.x, z: b.point.z, y: navYAt(fi, b.point.x, b.point.z) };
    }
    // a wall: step back towards the viewer and drop to the floor
    const back = b.point.clone().addScaledVector(raycaster.ray.direction, -0.5);
    const bf = mode === 'walk' ? floorOfY(walk.pos.y - eye) : floorOfY(back.y);
    const g = grids[bf];
    if (!g || Number.isNaN(floorYAt(g, back.x, back.z))) return null;
    return { fi: bf, x: back.x, z: back.z, y: floorYAt(g, back.x, back.z) };
  }
  function pickRing(cx: number, cy: number) {
    if (!ringsGroup) return null;
    setNdc(cx, cy);
    const vis = [...rings.values()].filter((r) => r.visible);
    const hit = raycaster.intersectObjects(vis, true)[0];
    if (!hit) return null;
    let o: T.Object3D | null = hit.object;
    while (o && !o.userData.room) o = o.parent;
    const id = (o?.userData.room as string) ?? null;
    if (!id) return null;
    // occluded by a wall?
    const b = firstVisibleHit(visibleMeshes());
    if (b && b.distance < hit.distance - 0.2) return null;
    return id;
  }

  function handleTap(cx: number, cy: number) {
    if (!ready || flight) return;
    if (mode === 'walk') {
      const id = pickRing(cx, cy);
      if (id) {
        goToRoom(id);
        return;
      }
      const p = pickFloor(cx, cy);
      if (!p) return;
      if (p.stairs !== undefined) {
        const cf = floorOfY(walk.pos.y - eye);
        const other = cf <= p.stairs ? p.stairs + 1 : p.stairs;
        const chain = stairChain(cf, other);
        if (chain) {
          const end = chain[chain.length - 1].pos;
          moveTo(other, end.x, end.z, null);
        }
        return;
      }
      if (p.fi < 0) return;
      moveTo(p.fi, p.x, p.z, null);
      return;
    }
    // dollhouse / plan: step into the clicked spot
    const p = pickFloor(cx, cy);
    if (!p || p.fi < 0 || p.stairs !== undefined) return;
    const t = resolveTarget(p.fi, p.x, p.z);
    if (!t) return;
    // nearest room for the announcement
    let best = P.startRoom;
    let bd = Infinity;
    hs.forEach((m, id) => {
      if (m.floor !== p.fi || !roomById(id)) return;
      const d = Math.hypot(m.pos.x - t.x, m.pos.z - t.z);
      if (d < bd) {
        bd = d;
        best = id;
      }
    });
    const pos = new T.Vector3(t.x, navYAt(p.fi, t.x, t.z) + eye, t.z);
    const yaw = mode === 'plan' ? roomLook.get(best) ?? 0 : -orbit.yaw;
    mode = 'walk';
    floor = p.fi;
    room = best;
    const fov = walkBaseFov();
    startFlight(pos, walkQuat(yaw, -0.04), fov, 1900, 2.5, () => {
      walk.pos.copy(pos);
      walk.yaw = walk.g.yaw = yaw;
      walk.pitch = walk.g.pitch = -0.04;
      walk.fov = walk.g.fov = fov;
      rig = 'walk';
      applyCut(true);
      updateRoom(true);
      emit();
    });
  }

  // hover (mouse only)
  let hoverXY: [number, number] | null = null;
  let hoverAt = 0;
  let hoveredRoom: string | null = null;
  function updateHover() {
    if (!hoverXY || mode !== 'walk' || rig !== 'walk' || flight || drag) {
      cursorTarget = 0;
      setHoverRoom(null);
      return;
    }
    const [cx, cy] = hoverXY;
    const id = pickRing(cx, cy);
    setHoverRoom(id);
    if (id) {
      cursorTarget = 0;
      canvas.style.cursor = 'pointer';
      return;
    }
    const p = pickFloor(cx, cy);
    if (!p || p.fi < 0 || !cursor) {
      cursorTarget = 0;
      canvas.style.cursor = p?.stairs !== undefined ? 'pointer' : 'grab';
      return;
    }
    const g = grids[p.fi];
    const ok = g ? isWalkable(g, p.x, p.z) || !!nearestWalkable(g, p.x, p.z, 0.9) : true;
    cursor.position.set(p.x, p.y + 0.015, p.z);
    cursor.rotation.set(-Math.PI / 2, 0, 0);
    cursorTarget = ok ? 1 : 0.35;
    canvas.style.cursor = ok ? 'pointer' : 'grab';
  }
  function setHoverRoom(id: string | null) {
    if (id === hoveredRoom) return;
    hoveredRoom = id;
    rings.forEach((r, k) => r.scale.setScalar(k === id ? 1.18 : 1));
    cb.onHoverRoom?.(id);
  }

  // ------------------------------------------------------------------ input
  type Ptr = { x: number; y: number; sx: number; sy: number; t: number; type: string; button: number };
  const ptrs = new Map<number, Ptr>();
  let drag = false;
  let pinch: { d: number; mx: number; my: number } | null = null;
  const onDown = (e: PointerEvent) => {
    if (!ready) return;
    canvas.setPointerCapture?.(e.pointerId);
    ptrs.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      t: now,
      type: e.pointerType,
      button: e.button,
    });
    markInteract();
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      drag = true;
    }
    walk.vyaw = walk.vpitch = 0;
  };
  const onMove = (e: PointerEvent) => {
    const p = ptrs.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') hoverXY = [e.clientX, e.clientY];
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    const moved = Math.hypot(p.x - p.sx, p.y - p.sy);
    if (!drag && moved > (p.type === 'mouse' ? 4 : 9)) drag = true;
    if (!drag || flight) return;
    const h = Math.max(1, container.clientHeight);
    if (ptrs.size >= 2 && pinch) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const ratio = pinch.d / Math.max(d, 1);
      if (mode === 'walk') {
        walk.g.fov = clamp(walk.g.fov * ratio, 32, walkBaseFov());
      } else {
        orbit.g.dist = clamp(orbit.g.dist * ratio, ...distRange());
        pan(mx - pinch.mx, my - pinch.my);
      }
      pinch = { d, mx, my };
      return;
    }
    if (mode === 'walk') {
      const k = (camera.fov * DEG) / h;
      walk.g.yaw -= dx * k;
      walk.g.pitch = clamp(walk.g.pitch + dy * k, -1.2, 1.2);
      walk.vyaw = -dx * k * 60;
      walk.vpitch = dy * k * 60;
    } else if (mode === 'plan' || p.button === 2 || e.shiftKey) {
      pan(dx, dy);
    } else {
      orbit.g.yaw -= dx * 0.0055;
      orbit.g.pitch = clamp(orbit.g.pitch + dy * 0.0045, 10 * DEG, 84 * DEG);
    }
  };
  const onUp = (e: PointerEvent) => {
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!p) return;
    const wasDrag = drag;
    if (ptrs.size === 0) drag = false;
    if (!wasDrag && e.type === 'pointerup' && now - p.t < 700 && p.button === 0) handleTap(e.clientX, e.clientY);
    if (mode === 'walk' && wasDrag && ptrs.size === 0) {
      // keep a little inertia
      walk.vyaw = clamp(walk.vyaw, -3, 3);
      walk.vpitch = clamp(walk.vpitch, -2, 2);
    } else {
      walk.vyaw = walk.vpitch = 0;
    }
  };
  const onLeave = () => {
    hoverXY = null;
  };
  function distRange(): [number, number] {
    if (mode === 'plan') {
      const base = orbit.g.dist;
      planBase = planBase || base;
      return [planBase * 0.4, planBase * 1.35];
    }
    return [P.dollhouse.minDistance, Math.max(P.dollhouse.maxDistance, dollBase * 1.4)];
  }
  let planBase = 0;
  let dollBase = 0;
  function pan(dx: number, dy: number) {
    const h = Math.max(1, container.clientHeight);
    const wpp = (2 * Math.tan((orbit.fov * DEG) / 2) * orbit.dist) / h;
    const right = new T.Vector3(Math.cos(orbit.yaw), 0, -Math.sin(orbit.yaw));
    const fwd = new T.Vector3(-Math.sin(orbit.yaw), 0, -Math.cos(orbit.yaw));
    const t = orbit.g.target;
    t.addScaledVector(right, -dx * wpp);
    t.addScaledVector(fwd, dy * wpp * (mode === 'plan' ? 1 : 1.4));
    const c = buildingBox.getCenter(new T.Vector3());
    const s = buildingBox.getSize(new T.Vector3());
    t.x = clamp(t.x, c.x - s.x * 0.7, c.x + s.x * 0.7);
    t.z = clamp(t.z, c.z - s.z * 0.7, c.z + s.z * 0.7);
  }
  const onWheel = (e: WheelEvent) => {
    if (!ready) return;
    e.preventDefault();
    markInteract();
    const d = clamp(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, -120, 120);
    if (mode === 'walk') {
      walk.g.fov = clamp(walk.g.fov * Math.exp(d * 0.0012), 32, walkBaseFov());
    } else {
      if (mode === 'plan' && !planBase) planBase = orbit.g.dist;
      orbit.g.dist = clamp(orbit.g.dist * Math.exp(d * 0.0012), ...distRange());
    }
  };
  const onContext = (e: Event) => e.preventDefault();
  const keys = new Set<string>();
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const handled = ['w', 'a', 's', 'd', 'q', 'e', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!handled.includes(k)) return;
    if (e.type === 'keydown') {
      if (mode !== 'walk' && mode !== 'dollhouse') return;
      // arrow keys on focused buttons still navigate the page UI
      if (t && t.tagName === 'BUTTON' && k.startsWith('Arrow') && t.closest('[role="radiogroup"],[role="tablist"]')) return;
      keys.add(k);
      markInteract();
      e.preventDefault();
    } else keys.delete(k);
  };
  const onBlur = () => keys.clear();
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContext);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', onBlur);

  function keyboard(dt: number) {
    if (!keys.size || flight) return;
    const has = (...k: string[]) => k.some((x) => keys.has(x));
    if (mode === 'dollhouse') {
      if (has('a', 'ArrowLeft', 'q')) orbit.g.yaw += dt * 1.2;
      if (has('d', 'ArrowRight', 'e')) orbit.g.yaw -= dt * 1.2;
      if (has('w', 'ArrowUp')) orbit.g.dist = clamp(orbit.g.dist * (1 - dt), ...distRange());
      if (has('s', 'ArrowDown')) orbit.g.dist = clamp(orbit.g.dist * (1 + dt), ...distRange());
      return;
    }
    if (mode !== 'walk' || rig !== 'walk') return;
    if (has('q')) walk.g.yaw -= dt * 1.3;
    if (has('e')) walk.g.yaw += dt * 1.3;
    let f = 0;
    let s = 0;
    if (has('w', 'ArrowUp')) f += 1;
    if (has('s', 'ArrowDown')) f -= 1;
    if (has('d', 'ArrowRight')) s += 1;
    if (has('a', 'ArrowLeft')) s -= 1;
    if (!f && !s) return;
    glide = null;
    const sp = 1.7 * dt / Math.hypot(f, s);
    const y = walk.yaw;
    const dx = (Math.sin(y) * f + Math.cos(y) * s) * sp;
    const dz = (-Math.cos(y) * f + Math.sin(y) * s) * sp;
    const fi = floorOfY(walk.pos.y - eye);
    const g = grids[fi];
    if (!g) return;
    const x0 = walk.pos.x;
    const z0 = walk.pos.z;
    const ok = (x: number, z: number) => isWalkable(g, x, z) || !isWalkable(g, x0, z0);
    if (ok(x0 + dx, z0 + dz) && isNavAt(g, x0 + dx, z0 + dz)) {
      walk.pos.x += dx;
      walk.pos.z += dz;
    } else if (ok(x0 + dx, z0) && isNavAt(g, x0 + dx, z0)) walk.pos.x += dx;
    else if (ok(x0, z0 + dz) && isNavAt(g, x0, z0 + dz)) walk.pos.z += dz;
    const ty = navYAt(fi, walk.pos.x, walk.pos.z) + eye;
    walk.pos.y += (ty - walk.pos.y) * damp(12, dt);
    cursorTarget = 0;
  }
  const isNavAt = (g: NavGrid, x: number, z: number) => !Number.isNaN(floorYAt(g, x, z));

  // ------------------------------------------------------------------ overlays
  type Overlay = { el: HTMLElement; x: number; y: number; on: boolean; occluded: boolean };
  const overlays = new Map<string, Overlay>();
  let occlusionAt = 0;
  function bindOverlay(key: string, el: HTMLElement | null) {
    if (!el) {
      overlays.delete(key);
      return;
    }
    overlays.set(key, { el, x: NaN, y: NaN, on: false, occluded: false });
    el.dataset.on = 'false';
  }
  const tmp = new T.Vector3();
  function project(p: T.Vector3) {
    tmp.copy(p).project(camera);
    const w = container.clientWidth;
    const h = container.clientHeight;
    return {
      x: (tmp.x * 0.5 + 0.5) * w,
      y: (-tmp.y * 0.5 + 0.5) * h,
      front: tmp.z < 1 && tmp.z > -1,
    };
  }
  function updateOverlays() {
    const occl = now - occlusionAt > 140;
    if (occl) occlusionAt = now;
    const vis = occl ? visibleMeshes() : [];
    const w = container.clientWidth;
    const h = container.clientHeight;
    overlays.forEach((o, key) => {
      const [kind, id] = key.split(':');
      let pos: T.Vector3 | null = null;
      let on = ready && !flight;
      if (kind === 'room') {
        const m = hs.get(id);
        if (!m || mode === 'walk' || m.floor !== floor) on = false;
        else pos = tmp2.set(m.pos.x, m.pos.y + (mode === 'plan' ? 0 : 1.0), m.pos.z);
        if (otween) on = on && now - otween.t0 > otween.dur * 0.55;
      } else if (kind === 'info') {
        const m = infos.get(id);
        if (!m || mode === 'plan') on = false;
        else {
          pos = tmp2.copy(m.pos);
          if (mode === 'dollhouse' && (m.floor > floor || m.pos.y > clipPlane.constant)) on = false;
          if (mode === 'walk' && camera.position.distanceTo(m.pos) > 15) on = false;
          if (otween) on = on && now - otween.t0 > otween.dur * 0.7;
        }
      } else if (kind === 'hover') {
        const m = hoveredRoom ? hs.get(hoveredRoom) : null;
        if (!m || mode !== 'walk') on = false;
        else pos = tmp2.set(m.pos.x, navYAt(m.floor, m.pos.x, m.pos.z) + 0.38, m.pos.z);
      }
      let x = o.x;
      let y = o.y;
      if (on && pos) {
        const pr = project(pos);
        x = pr.x;
        y = pr.y;
        if (!pr.front || x < -40 || y < -40 || x > w + 40 || y > h + 40) on = false;
        if (on && kind === 'info' && occl) {
          // anchors often sit on a surface (window head, counter): test a point
          // pulled slightly towards the viewer
          const dir = pos.clone().sub(camera.position);
          const dist = Math.max(0, dir.length() - 0.45);
          raycaster.set(camera.position, dir.normalize());
          raycaster.far = dist;
          const hit = raycaster
            .intersectObjects(vis, false)
            .find((hh) => hh.point.y <= clipPlane.constant + 0.01);
          raycaster.far = Infinity;
          o.occluded = !!hit;
        }
        if (kind === 'info' && o.occluded) on = false;
      } else on = false;
      if (on && (Number.isNaN(o.x) || Math.abs(x - o.x) > 0.3 || Math.abs(y - o.y) > 0.3)) {
        o.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        o.x = x;
        o.y = y;
      }
      if (on !== o.on) {
        o.on = on;
        o.el.dataset.on = String(on);
      }
    });
  }
  const tmp2 = new T.Vector3();

  // ------------------------------------------------------------------ minimap
  let mini: HTMLCanvasElement | null = null;
  const miniCache = new Map<number, HTMLCanvasElement>();
  let miniXform: { s: number; ox: number; oy: number; fi: number } | null = null;
  function bindMinimap(c: HTMLCanvasElement | null) {
    mini = c;
  }
  function floorImage(fi: number) {
    const hit = miniCache.get(fi);
    if (hit) return hit;
    const g = grids[fi];
    if (!g) return null;
    const c = document.createElement('canvas');
    c.width = g.w;
    c.height = g.h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(g.w, g.h);
    const d = img.data;
    for (let k = 0; k < g.w * g.h; k++) {
      const nav = !Number.isNaN(g.navY[k]);
      let r = 0;
      let gg = 0;
      let b = 0;
      let a = 0;
      if (g.blocked[k] && !nav) {
        [r, gg, b, a] = [61, 81, 65, 235];
      } else if (g.blocked[k]) {
        [r, gg, b, a] = [168, 178, 160, 255];
      } else if (nav) {
        [r, gg, b, a] = [248, 248, 242, 250];
      }
      d[k * 4] = r;
      d[k * 4 + 1] = gg;
      d[k * 4 + 2] = b;
      d[k * 4 + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
    miniCache.set(fi, c);
    return c;
  }
  let miniKey = '';
  function drawMinimap() {
    if (!mini || mode !== 'walk') return;
    const fi = floorOfY((rig === 'walk' ? walk.pos.y : camera.position.y) - eye);
    const img = floorImage(fi);
    const g = grids[fi];
    if (!img || !g) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const cw = mini.clientWidth;
    const ch = mini.clientHeight;
    if (!cw || !ch) return;
    const p = camera.position;
    const dir = new T.Vector3();
    camera.getWorldDirection(dir);
    const yaw = Math.atan2(dir.x, -dir.z);
    const key = `${cw}|${ch}|${fi}|${p.x.toFixed(2)}|${p.z.toFixed(2)}|${yaw.toFixed(3)}|${camera.fov.toFixed(1)}`;
    if (key === miniKey) return;
    miniKey = key;
    if (mini.width !== Math.round(cw * dpr)) mini.width = Math.round(cw * dpr);
    if (mini.height !== Math.round(ch * dpr)) mini.height = Math.round(ch * dpr);
    const ctx = mini.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const pad = 8;
    const s = Math.min((cw - pad * 2) / img.width, (ch - pad * 2) / img.height);
    const ox = (cw - img.width * s) / 2;
    const oy = (ch - img.height * s) / 2;
    miniXform = { s, ox, oy, fi };
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, ox, oy, img.width * s, img.height * s);
    const px = ox + ((p.x - g.x0) / 0.1) * s;
    const py = oy + ((p.z - g.z0) / 0.1) * s;
    const hf = Math.atan(Math.tan((camera.fov * DEG) / 2) * aspect());
    const R = 34;
    const grad = ctx.createRadialGradient(px, py, 2, px, py, R);
    grad.addColorStop(0, 'rgba(61,81,65,0.55)');
    grad.addColorStop(1, 'rgba(61,81,65,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px, py);
    // canvas angle: 0 = +x (east); heading yaw 0 = north (-y)
    const a = yaw - Math.PI / 2;
    ctx.arc(px, py, R, a - hf, a + hf);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3d5141';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  function minimapPick(cx: number, cy: number) {
    if (!mini || !miniXform || mode !== 'walk' || flight) return;
    const g = grids[miniXform.fi];
    if (!g) return;
    const r = mini.getBoundingClientRect();
    const x = g.x0 + ((cx - r.left - miniXform.ox) / miniXform.s) * 0.1;
    const z = g.z0 + ((cy - r.top - miniXform.oy) / miniXform.s) * 0.1;
    if (Number.isNaN(floorYAt(g, x, z)) && !nearestWalkable(g, x, z, 0.6)) return;
    markInteract();
    moveTo(miniXform.fi, x, z, null);
  }

  // ------------------------------------------------------------------ frame
  const insets = { left: 0, right: 0, top: 0, bottom: 0 };
  const shift = { x: 0, y: 0 };
  function setInsets(i: { left?: number; right?: number; top?: number; bottom?: number }) {
    Object.assign(insets, { left: 0, right: 0, top: 0, bottom: 0 }, i);
  }
  function applyShift(dt: number) {
    const orbitView = rig === 'orbit' || (flight && mode !== 'walk');
    const tx = orbitView ? (insets.left - insets.right) / 2 : 0;
    const ty = orbitView ? (insets.top - insets.bottom) / 2 : 0;
    const k = dt ? damp(5, dt) : 1;
    shift.x += (tx - shift.x) * k;
    shift.y += (ty - shift.y) * k;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    if (Math.abs(shift.x) < 0.5 && Math.abs(shift.y) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(w, h, -shift.x, -shift.y, w, h);
  }

  function applyCamera(dt: number) {
    applyShift(dt);
    if (flight) {
      const f = flight;
      const t = clamp((now - f.t0) / f.dur, 0, 1);
      const e = easeFlight(t);
      camera.position.lerpVectors(f.p0, f.p1, e);
      camera.position.y += Math.sin(Math.PI * e) * f.lift;
      camera.quaternion.slerpQuaternions(f.q0, f.q1, easeSoft(t));
      camera.fov = f.f0 + (f.f1 - f.f0) * e;
      camera.near = mode === 'walk' && t > 0.6 ? 0.05 : 0.3;
      camera.updateProjectionMatrix();
      if (t >= 1) {
        flight = null;
        f.done();
        emit();
      }
      return;
    }
    if (rig === 'orbit') {
      if (otween) {
        const o = otween;
        const t = clamp((now - o.t0) / o.dur, 0, 1);
        const e = o.ease(t);
        orbit.target.lerpVectors(o.from.target, o.to.target, e);
        orbit.yaw = o.from.yaw + (o.to.yaw - o.from.yaw) * e;
        orbit.pitch = o.from.pitch + (o.to.pitch - o.from.pitch) * e;
        orbit.dist = o.from.dist + (o.to.dist - o.from.dist) * e;
        orbit.fov = o.from.fov + (o.to.fov - o.from.fov) * e;
        if (t >= 1) {
          otween = null;
          orbit.g.yaw = orbit.yaw;
          o.done?.();
        }
      } else {
        if (autoRotate && mode === 'dollhouse') orbit.g.yaw -= dt * 0.045;
        const k = damp(6, dt);
        orbit.target.lerp(orbit.g.target, k);
        orbit.yaw += (orbit.g.yaw - orbit.yaw) * k;
        orbit.pitch += (orbit.g.pitch - orbit.pitch) * k;
        orbit.dist += (orbit.g.dist - orbit.dist) * k;
        orbit.fov += (orbit.g.fov - orbit.fov) * k;
      }
      const pose = orbitPose(orbit);
      camera.position.copy(pose.pos);
      camera.quaternion.copy(pose.quat);
      camera.fov = orbit.fov;
      camera.near = mode === 'plan' ? 1 : 0.3;
      camera.updateProjectionMatrix();
      return;
    }
    // walk
    if (glide) {
      const gl = glide;
      const t = clamp((now - gl.t0) / gl.dur, 0, 1);
      const e = easeGlide(t);
      gl.curve.getPointAt(e, walk.pos);
      if (gl.follow) {
        const tan = gl.curve.getTangentAt(clamp(e + 0.06, 0, 1));
        const heading = Math.atan2(tan.x, -tan.z);
        const endBlend = gl.endYaw !== null ? clamp((e - 0.7) / 0.3, 0, 1) : 0;
        const onStairs = gl.stairs && e > gl.stairs[0] && e < gl.stairs[1];
        if (Math.hypot(tan.x, tan.z) > 0.2)
          walk.g.yaw = lerpAngle(heading, gl.endYaw ?? heading, easeSoft(endBlend));
        const slope = Math.atan2(tan.y, Math.hypot(tan.x, tan.z));
        walk.g.pitch = onStairs ? clamp(slope * 0.45, -0.35, 0.35) : walk.g.pitch * 0.96 - 0.04 * 0.04;
      } else if (gl.endYaw !== null) {
        walk.g.yaw = lerpAngle(gl.startYaw, gl.endYaw, easeSoft(t));
      }
      if (gl.len > 3 && !reduced) walk.g.fov = walkBaseFov() + Math.sin(Math.PI * e) * 2.2;
      if (t >= 1) {
        glide = null;
        walk.g.fov = Math.min(walk.g.fov, walkBaseFov());
        gl.done?.();
        emit();
      }
    }
    if (!drag && (walk.vyaw || walk.vpitch)) {
      walk.g.yaw += walk.vyaw * dt;
      walk.g.pitch = clamp(walk.g.pitch + walk.vpitch * dt, -1.2, 1.2);
      const k = Math.exp(-dt * 6);
      walk.vyaw *= k;
      walk.vpitch *= k;
      if (Math.abs(walk.vyaw) < 0.002) walk.vyaw = 0;
      if (Math.abs(walk.vpitch) < 0.002) walk.vpitch = 0;
    }
    const k = damp(drag ? 22 : 9, dt);
    walk.yaw += (walk.g.yaw - walk.yaw) * k;
    walk.pitch += (walk.g.pitch - walk.pitch) * k;
    walk.fov += (walk.g.fov - walk.fov) * damp(8, dt);
    camera.position.copy(walk.pos);
    camera.quaternion.copy(walkQuat(walk.yaw, walk.pitch));
    camera.fov = walk.fov;
    camera.near = 0.05;
    camera.updateProjectionMatrix();
  }

  let nightMix = shared.uMix.value;
  const nightFade = { from: nightMix, to: nightMix, t0: 0 };
  let wasMoving = false;
  let walkMix = mode === 'walk' ? 1 : 0;
  function frame(dt: number) {
    shared.uTime.value = time();
    // day / night crossfade
    // wall-clock crossfade (independent of frame rate)
    const want = night && nightReady ? 1 : 0;
    if (want !== nightFade.to) {
      nightFade.from = nightMix;
      nightFade.to = want;
      nightFade.t0 = now;
    }
    if (nightMix !== want) {
      const dur = reduced ? 1 : 1500 * Math.abs(nightFade.to - nightFade.from);
      const t = clamp((now - nightFade.t0) / Math.max(dur, 1), 0, 1);
      nightMix = nightFade.from + (nightFade.to - nightFade.from) * t;
    }
    const e = nightMix * nightMix * (3 - 2 * nightMix);
    shared.uMix.value = e;
    // walking indoors reads darker than the cut-away model: lift exposure like a camera would
    const wantWalk = mode === 'walk' ? 1 : 0;
    walkMix += (wantWalk - walkMix) * Math.min(1, dt * 2.5);
    const boost = 1 + ((P.walkBoost?.day ?? 1) - 1) * (1 - e) * walkMix + ((P.walkBoost?.night ?? 1) - 1) * e * walkMix;
    renderer.toneMappingExposure = (P.exposure.day + (P.exposure.night - P.exposure.day) * e) * boost;
    lampMats.forEach((m) => (m.emissiveIntensity = e * 2.6));
    sun.intensity = 2.4 * (1 - e);
    hemi.intensity = 1.1 * (1 - e * 0.9);
    dynMats.forEach(({ m, base }) => (m.envMapIntensity = base * (1 - e * 0.88)));
    if (groundMat) groundMat.lightMapIntensity = groundIrr * (1 - e * 0.93);
    if (scene.fog && skyMat) {
      (scene.fog as T.Fog).color
        .copy(skyMat.uniforms.uHazeDay.value)
        .lerp(skyMat.uniforms.uHazeNight.value, e);
    }
    // outlook crossfade
    if (swap.dur && skyMat) {
      const t = clamp((now - swap.t0) / swap.dur, 0, 1);
      skyMat.uniforms.uSwap.value = easeSoft(t);
      if (t >= 1) finishSwap();
    }
    // clip animation
    if (clip.dur && clip.done) {
      const t = clamp((now - clip.t0) / clip.dur, 0, 1);
      clip.value = clip.from + (clip.to - clip.from) * easeSoft(t);
      clipPlane.constant = clip.value;
      if (t >= 1) {
        const d = clip.done;
        clip.done = null;
        clip.dur = 0;
        d();
      }
    }
    keyboard(dt);
    applyCamera(dt);
    // rings
    const wf = floorOfY(camera.position.y - eye);
    rings.forEach((r, id) => {
      const m = hs.get(id)!;
      const d = Math.hypot(r.position.x - camera.position.x, r.position.z - camera.position.z);
      r.visible =
        mode === 'walk' && rig === 'walk' && !flight && m.floor === wf && d > 0.7 && d < 16;
      const mat = r.material as T.MeshBasicMaterial;
      mat.opacity = clamp((d - 0.7) / 1.2, 0, 1) * 0.85;
    });
    if (cursor) {
      cursorOpacity += (cursorTarget - cursorOpacity) * damp(14, dt);
      cursor.visible = cursorOpacity > 0.02;
      const [ring, disc] = cursor.children as T.Mesh[];
      (ring.material as T.MeshBasicMaterial).opacity = cursorOpacity * 0.95;
      (disc.material as T.MeshBasicMaterial).opacity = cursorOpacity * 0.22;
      const s = 1 + Math.sin(time() * 3) * 0.03;
      cursor.scale.setScalar(s);
    }
    if (mode === 'walk') updateRoom();
    if (hoverXY && !drag && now - hoverAt > 45) {
      hoverAt = now;
      updateHover();
    }
    renderer.render(scene, camera);
    updateOverlays();
    drawMinimap();
    const moving = !!glide || !!flight;
    if (moving !== wasMoving) {
      wasMoving = moving;
      emit();
    }
  }

  // ------------------------------------------------------------------ loop & visibility
  let raf = 0;
  let last = 0;
  let onScreen = true;
  const loop = (t: number) => {
    raf = 0;
    if (disposed) return;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
    last = t;
    now = t;
    if (ready) frame(dt);
    schedule();
  };
  const schedule = () => {
    if (!raf && !disposed && onScreen && !document.hidden) raf = requestAnimationFrame(loop);
    if (!onScreen || document.hidden) last = 0;
  };
  const io = new IntersectionObserver((es) => {
    onScreen = es[es.length - 1].isIntersecting;
    schedule();
  });
  io.observe(container);
  const onVis = () => schedule();
  document.addEventListener('visibilitychange', onVis);

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!ready) return;
    if (mode === 'dollhouse' && rig === 'orbit' && !otween) {
      const yaw = orbit.g.yaw;
      const target = orbit.g.target.clone();
      orbitFraming(true);
      orbit.g.yaw = yaw;
      orbit.g.target.x = target.x;
      orbit.g.target.z = target.z;
    } else if (mode === 'plan' && !otween) {
      planFraming();
      planBase = orbit.g.dist;
    } else if (mode === 'walk') {
      walk.g.fov = Math.min(walk.g.fov, walkBaseFov());
      if (!interacted) walk.g.fov = walkBaseFov();
    }
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  resize();

  const onLost = (e: Event) => {
    e.preventDefault();
    cb.onError?.(new Error('WebGL context lost'));
  };
  canvas.addEventListener('webglcontextlost', onLost);

  load()
    .then(() => schedule())
    .catch((err) => {
      if (!disposed && (err as Error)?.name !== 'AbortError') cb.onError?.(err);
    });
  schedule();

  function dispose() {
    if (disposed) return;
    disposed = true;
    ac.abort();
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('webglcontextlost', onLost);
    scene.traverse((o) => {
      const m = o as T.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => {
          Object.values(mm).forEach((v) => {
            if (v && (v as T.Texture).isTexture) (v as T.Texture).dispose();
          });
          mm.dispose();
        });
      }
    });
    disposables.forEach((d) => d.dispose());
    nightTex.forEach((u) => u.value?.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    blink.remove();
    overlays.clear();
  }

  return {
    setMode,
    setFloor,
    goToRoom,
    setNight,
    setView: (id: string) => void setView(id),
    bindOverlay,
    bindMinimap,
    minimapPick,
    setInsets,
    getSnapshot,
    getCamera: () => {
      const p = camera.position;
      const fi = floorOfY(p.y - eye);
      const g = grids[fi];
      return {
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: walk.yaw,
        walkable: g ? isWalkable(g, p.x, p.z) || (g.dist[cellOf(g, p.x, p.z)] ?? 0) > 0.15 : false,
      };
    },
    resize,
    dispose,
  };
}

export type { TourRoom };
