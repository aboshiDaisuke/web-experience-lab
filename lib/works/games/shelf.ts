import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Title } from './data';
import { artFonts, backArt, coverArt, discArt, keyArt, spineArt } from './art';

/**
 * The title list as a shelf of game packages (coverflow). Each keep-case is a
 * glossy plastic shell with a hinged front cover; opening it lifts the disc out.
 * Drag rotates the selected case (and springs to front/back), click opens it.
 */

export type ShelfCtl = {
  select: (i: number) => void;
  setOpen: (o: boolean) => void;
  flip: () => void;
  dispose: () => void;
};
export type ShelfOpts = {
  titles: Title[];
  reduced: boolean;
  narrow: boolean;
  onSelect: (i: number) => void;
  onOpen: (o: boolean) => void;
  onReady: () => void;
};

const W = 1.36;
const H = 1.7;
const D = 0.15;

function manualArt(t: Title) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 640;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#f4f1ea';
  c.fillRect(0, 0, 512, 640);
  c.drawImage(keyArt(t.id), 0, 120, 640, 420, 36, 60, 440, 290);
  c.fillStyle = '#150d33';
  c.font = '800 30px Unbounded, sans-serif';
  c.textAlign = 'left';
  c.fillText(t.en, 36, 410, 440);
  c.font = '700 24px "Zen Kaku Gothic New", sans-serif';
  c.fillText('取扱説明書・あそびかた', 36, 452);
  c.fillStyle = '#6b6488';
  c.font = '500 16px "Zen Kaku Gothic New", sans-serif';
  c.fillText('ゲームを始める前に、この説明書をお読みください。', 36, 490);
  c.fillStyle = t.pal[1];
  c.fillRect(36, 520, 120, 6);
  c.fillStyle = '#150d33';
  c.font = '800 14px Unbounded, sans-serif';
  c.fillText('MIRAI GAMES', 36, 600);
  return cv;
}

function blobTex() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  return cv;
}

function floorAlpha() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.55, '#aaa');
  g.addColorStop(1, '#000');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  return cv;
}

export function mountShelf(host: HTMLElement, opts: ShelfOpts): ShelfCtl | null {
  const { titles, reduced, narrow } = opts;
  let renderer: T.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const dpr = Math.min(devicePixelRatio || 1, narrow ? 1.6 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const disposables: { dispose: () => void }[] = [];
  const track = <X extends { dispose: () => void }>(x: X) => {
    disposables.push(x);
    return x;
  };
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = track(pmrem.fromScene(room, 0.04));
  room.traverse((o) => {
    const m = o as T.Mesh;
    m.geometry?.dispose();
    (m.material as T.Material | undefined)?.dispose?.();
  });
  pmrem.dispose();
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;

  const camera = new T.PerspectiveCamera(30, 1, 0.1, 60);
  const key = new T.DirectionalLight(0xfff3e6, 1.6);
  key.position.set(2.5, 4, 5);
  const rimP = new T.DirectionalLight(0xff3e8a, 2.2);
  rimP.position.set(-4, 2.5, -2);
  const rimC = new T.DirectionalLight(0x3df2ff, 1.8);
  rimC.position.set(4, 1.5, -2.5);
  scene.add(key, rimP, rimC, new T.AmbientLight(0x6b5cff, 0.25));

  // floor with a faint reflection of the cases
  const fa = track(new T.CanvasTexture(floorAlpha()));
  const floor = new T.Mesh(
    track(new T.CircleGeometry(9, 64)),
    track(new T.MeshStandardMaterial({ color: 0x0b0820, roughness: 0.42, metalness: 0.0, transparent: true, opacity: 0.86, alphaMap: fa, depthWrite: false })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = 2;
  scene.add(floor);
  const blobT = track(new T.CanvasTexture(blobTex()));
  const blobMat = track(new T.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false }));
  const blobGeo = track(new T.PlaneGeometry(1, 1));

  // shared geometry
  const shellGeo = track(new RoundedBoxGeometry(W, H, D / 2, 4, 0.035));
  const plasticMat = track(
    new T.MeshPhysicalMaterial({ color: 0x1a1536, roughness: 0.32, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.12 }),
  );
  const trayMat = track(new T.MeshStandardMaterial({ color: 0x0f0c22, roughness: 0.55 }));
  const faceGeo = track(new T.PlaneGeometry(W - 0.07, H - 0.08));
  const spineGeo = track(new T.PlaneGeometry(D - 0.02, H - 0.08));
  const trayGeo = track(new T.PlaneGeometry(W - 0.1, H - 0.1));
  const discGeo = track(new T.CylinderGeometry(0.54, 0.54, 0.012, 72, 1));
  discGeo.rotateX(Math.PI / 2);
  const pinGeo = track(new T.CylinderGeometry(0.1, 0.1, 0.03, 24));
  pinGeo.rotateX(Math.PI / 2);
  const silver = track(new T.MeshPhysicalMaterial({ color: 0xd6d3e6, metalness: 1, roughness: 0.18, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 700] }));

  type Pack = {
    root: T.Group;
    body: T.Group;
    cover: T.Group;
    disc: T.Mesh;
    blob: T.Mesh;
    mirror: T.Group;
    pos: T.Vector3;
    rotY: number;
    lift: number;
    open: number;
    disc0: T.Vector3;
    discLift: number;
    mats: T.Material[];
  };
  const packs: Pack[] = [];
  const pickables: T.Object3D[] = [];
  const texOf = (cv: HTMLCanvasElement) => {
    const t = track(new T.CanvasTexture(cv));
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  };

  const build = () => {
    titles.forEach((t, i) => {
      const root = new T.Group();
      const body = new T.Group();
      body.position.y = H / 2;
      root.add(body);
      const coverMat = track(new T.MeshPhysicalMaterial({ map: texOf(coverArt(t)), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 }));
      const backMat = track(new T.MeshPhysicalMaterial({ map: texOf(backArt(t)), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 }));
      const spineMat = track(new T.MeshPhysicalMaterial({ map: texOf(spineArt(t)), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 }));
      const discMat = track(new T.MeshPhysicalMaterial({ map: texOf(discArt(t)), roughness: 0.28, metalness: 0.25, clearcoat: 1, iridescence: 0.35, iridescenceIOR: 1.5 }));
      const manualMat = track(new T.MeshStandardMaterial({ map: texOf(manualArt(t)), roughness: 0.7 }));

      // back half (tray)
      const back = new T.Mesh(shellGeo, plasticMat);
      back.position.z = -D / 4;
      body.add(back);
      const backFace = new T.Mesh(faceGeo, backMat);
      backFace.position.z = -D / 2 - 0.001;
      backFace.rotation.y = Math.PI;
      body.add(backFace);
      const spine = new T.Mesh(spineGeo, spineMat);
      spine.position.set(-W / 2 - 0.001, 0, 0);
      spine.rotation.y = -Math.PI / 2;
      body.add(spine);
      const tray = new T.Mesh(trayGeo, trayMat);
      tray.position.z = 0.002;
      body.add(tray);
      const pin = new T.Mesh(pinGeo, silver);
      pin.position.set(0.02, 0.08, 0.01);
      body.add(pin);
      const disc = new T.Mesh(discGeo, [silver, discMat, silver]);
      // cylinder groups: 0 side, 1 top, 2 bottom → after rotateX the top faces +z
      disc.position.set(0.02, 0.08, 0.012);
      body.add(disc);

      // hinged front cover
      const cover = new T.Group();
      cover.position.set(-W / 2, 0, 0);
      body.add(cover);
      const front = new T.Mesh(shellGeo, plasticMat);
      front.position.set(W / 2, 0, D / 4);
      cover.add(front);
      const face = new T.Mesh(faceGeo, coverMat);
      face.position.set(W / 2, 0, D / 2 + 0.001);
      cover.add(face);
      const manual = new T.Mesh(track(new T.PlaneGeometry(W * 0.78, H * 0.8)), manualMat);
      manual.position.set(W / 2 + 0.02, 0, -0.004);
      manual.rotation.y = Math.PI;
      cover.add(manual);

      const blob = new T.Mesh(blobGeo, blobMat);
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.003;
      blob.scale.set(W * 1.5, 0.7, 1);
      blob.renderOrder = 3;
      root.add(blob);

      // mirrored copy under the floor (shares geometry + materials)
      const mirror = body.clone(true);
      mirror.scale.y = -1;
      mirror.position.y = -H / 2;
      root.add(mirror);

      body.traverse((o) => {
        o.userData.pack = i;
        pickables.push(o);
      });
      scene.add(root);
      packs.push({
        root,
        body,
        cover,
        disc,
        blob,
        mirror,
        pos: new T.Vector3(i * 1.4, 0, -3),
        rotY: 0,
        lift: 0,
        open: 0,
        disc0: disc.position.clone(),
        discLift: 0,
        mats: [coverMat, backMat, spineMat, discMat, manualMat],
      });
      root.position.copy(packs[i].pos);
    });
  };

  // ── state ──────────────────────────────────────────────────────────────
  let sel = 0;
  let open = false;
  let yaw = 0;
  let yawTarget = 0;
  let hover = -1;
  const tilt = new T.Vector2();
  const tiltT = new T.Vector2();
  let time = 0;
  let dirty = true;
  let ready = false;
  let visible = true;

  const targets = (i: number) => {
    const k = i - sel;
    const s = Math.sign(k);
    const a = Math.abs(k);
    const gap = narrow ? 1.02 : 1.3;
    const step = narrow ? 0.34 : 0.56;
    if (k === 0) {
      return { x: open ? W * 0.3 : 0, z: open ? (narrow ? -1.1 : 0.55) : 0.35, rot: open ? 0.16 : 0 };
    }
    const push = open ? 1.2 : 0;
    return { x: s * (gap + (a - 1) * step + push * 0.6), z: -0.55 - a * 0.12 - push, rot: -s * (narrow ? 1.1 : 0.95) };
  };

  const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
  const step = (dt: number) => {
    time += dt;
    let moving = false;
    tilt.x = damp(tilt.x, tiltT.x, 6, dt);
    tilt.y = damp(tilt.y, tiltT.y, 6, dt);
    yaw = damp(yaw, yawTarget, dragging ? 30 : 5, dt);
    if (Math.abs(yaw - yawTarget) > 0.001) moving = true;
    packs.forEach((p, i) => {
      const tg = targets(i);
      const nx = damp(p.root.position.x, tg.x, 7, dt);
      const nz = damp(p.root.position.z, tg.z, 7, dt);
      if (Math.abs(nx - tg.x) > 0.0005 || Math.abs(nz - tg.z) > 0.0005) moving = true;
      p.root.position.x = nx;
      p.root.position.z = nz;
      const isSel = i === sel;
      const rot = tg.rot + (isSel ? yaw + (open ? 0 : tilt.x * 0.35) : 0);
      p.rotY = damp(p.rotY, rot, 7, dt);
      if (Math.abs(p.rotY - rot) > 0.0005) moving = true;
      p.root.rotation.y = p.rotY;
      const liftT = (isSel && !reduced && !open ? Math.sin(time * 1.3) * 0.025 + 0.04 : 0) + (i === hover && !isSel ? 0.08 : 0);
      p.lift = damp(p.lift, liftT, 6, dt);
      p.body.position.y = H / 2 + p.lift;
      p.body.rotation.x = isSel && !open ? -tilt.y * 0.18 : 0;
      p.mirror.position.y = -H / 2 - p.lift;
      p.mirror.rotation.x = -p.body.rotation.x;
      p.blob.material = blobMat;
      p.blob.scale.set(W * 1.5 * (1 - p.lift), 0.7, 1);
      const openT = isSel && open ? 1 : 0;
      p.open = damp(p.open, openT, 4.2, dt);
      if (Math.abs(p.open - openT) > 0.001) moving = true;
      const e = p.open;
      p.cover.rotation.y = -e * 2.45;
      p.discLift = damp(p.discLift, isSel && open ? 1 : 0, 3, dt);
      const dl = p.discLift;
      p.disc.position.set(p.disc0.x + dl * 0.18, p.disc0.y + dl * 0.1, p.disc0.z + dl * 0.32);
      p.disc.rotation.set(-dl * 0.12, dl * 0.35, (reduced ? 0 : time * 0.6) * dl);
      // keep the mirror in sync
      const mc = p.mirror.children;
      p.body.children.forEach((ch, k) => {
        const m = mc[k];
        if (!m) return;
        m.position.copy(ch.position);
        m.rotation.copy(ch.rotation);
      });
    });
    if (!reduced || moving) dirty = true;
    return moving;
  };

  let Wd = 1;
  let Hd = 1;
  const resize = () => {
    Wd = Math.max(1, host.clientWidth);
    Hd = Math.max(1, host.clientHeight);
    renderer.setSize(Wd, Hd, false);
    camera.aspect = Wd / Hd;
    const asp = Wd / Hd;
    camera.fov = asp < 0.9 ? 34 : 28;
    const d = Math.max(6.6, (narrow ? 1.62 : 2.3) / (Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * asp));
    camera.position.set(0, 1.05, Math.min(12, d));
    camera.lookAt(0, 0.72, 0);
    camera.updateProjectionMatrix();
    dirty = true;
  };

  // ── input ───────────────────────────────────────────────────────────────
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  const pick = (cx: number, cy: number) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(
      packs.map((p) => p.body),
      true,
    )[0];
    return hit ? (hit.object.userData.pack as number) : -1;
  };
  let dragging = false;
  let down: { x: number; y: number; id: number; yaw: number } | null = null;
  const el = renderer.domElement;
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, yaw: yawTarget };
  };
  const onMove = (e: PointerEvent) => {
    if (down && down.id === e.pointerId) {
      const dx = e.clientX - down.x;
      if (!dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - down.y)) {
        dragging = true;
        el.setPointerCapture?.(e.pointerId);
      }
      if (dragging) {
        yawTarget = down.yaw + dx * 0.012;
        dirty = true;
      }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const h = pick(e.clientX, e.clientY);
    if (h !== hover) {
      hover = h;
      el.style.cursor = h >= 0 ? 'pointer' : '';
      dirty = true;
    }
    const r = el.getBoundingClientRect();
    tiltT.set(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
    if (h !== sel) tiltT.set(0, 0);
  };
  const onUp = (e: PointerEvent) => {
    if (!down || down.id !== e.pointerId) return;
    const wasDrag = dragging;
    dragging = false;
    down = null;
    if (wasDrag) {
      // spring to the nearest face (front or back)
      yawTarget = Math.round(yawTarget / Math.PI) * Math.PI;
      return;
    }
    const h = pick(e.clientX, e.clientY);
    if (h < 0) return;
    if (h !== sel) {
      sel = h;
      open = false;
      yawTarget = yaw = 0;
      opts.onSelect(h);
      opts.onOpen(false);
    } else {
      open = !open;
      yawTarget = Math.round(yawTarget / (Math.PI * 2)) * Math.PI * 2;
      opts.onOpen(open);
    }
    dirty = true;
  };
  const onLeave = () => {
    hover = -1;
    tiltT.set(0, 0);
    el.style.cursor = '';
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', () => {
    dragging = false;
    down = null;
  });
  el.addEventListener('pointerleave', onLeave);

  // ── loop ───────────────────────────────────────────────────────────────
  let raf = 0;
  let last = performance.now();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!ready || !visible || document.hidden) return;
    const moving = step(dt);
    if (dirty || moving) {
      dirty = false;
      renderer.render(scene, camera);
    }
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '100px' });
  io.observe(host);

  let dead = false;
  void artFonts().then(() => {
    if (dead) return;
    build();
    // settle into place without the fly-in on reduced motion
    for (let i = 0; i < (reduced ? 200 : 1); i++) step(1 / 30);
    ready = true;
    dirty = true;
    renderer.render(scene, camera);
    opts.onReady();
  });
  tick();

  return {
    select: (i) => {
      if (i === sel) return;
      sel = Math.max(0, Math.min(titles.length - 1, i));
      open = false;
      yawTarget = yaw = 0;
      dirty = true;
    },
    setOpen: (o) => {
      open = o;
      if (o) yawTarget = Math.round(yawTarget / (Math.PI * 2)) * Math.PI * 2;
      dirty = true;
    },
    flip: () => {
      if (open) return;
      yawTarget = Math.round(yawTarget / Math.PI) * Math.PI + Math.PI;
      dirty = true;
    },
    dispose: () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onLeave);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      el.remove();
    },
  };
}
