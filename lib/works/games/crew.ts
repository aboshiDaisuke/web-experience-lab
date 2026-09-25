import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Job, JobId } from './data';

/**
 * Character select for the recruit page. Each job is a small vinyl-toy figure
 * built from primitives, standing on a hologram pedestal with its class props
 * (code screen, d20, wireframe knot, EQ bars, UI panels, magnifier + bug).
 * Also renders a portrait of every figure for the roster tiles.
 */

export type CrewCtl = { select: (i: number) => void; dispose: () => void };
export type CrewOpts = {
  jobs: Job[];
  reduced: boolean;
  narrow: boolean;
  onReady: () => void;
  onPortraits: (urls: string[]) => void;
};

type Figure = {
  root: T.Group;
  head: T.Group;
  armL: T.Group;
  armR: T.Group;
  eyes: T.Mesh[];
  spin: T.Object3D[];
  bars: T.Mesh[];
  orbit: T.Object3D[];
  bug?: T.Object3D;
};

const SKIN = ['#ffd9c0', '#e8b08c', '#ffe3d1', '#b97b56', '#f3c29f', '#8f5a3c'];
const HAIR = ['#2a1d3d', '#6b3a1e', '#1b1b2a', '#f2e6c8', '#3a2440', '#141018'];

function codeTex(col: string) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 160;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#07101c';
  c.fillRect(0, 0, 256, 160);
  c.strokeStyle = col;
  c.lineWidth = 3;
  c.strokeRect(2, 2, 252, 156);
  const words = ['fn', 'jump()', '{', 'vel.y', '=', '10.6;', 'if', '(ok)', 'draw', '60fps', '}', 'return'];
  c.font = '600 13px "JetBrains Mono", monospace';
  for (let y = 0; y < 8; y++) {
    let x = 12 + (y % 3) * 12;
    for (let k = 0; k < 4; k++) {
      const w = words[(y * 5 + k * 3) % words.length];
      c.fillStyle = k === 0 ? '#ff5fa8' : k === 1 ? col : '#e8f7ff';
      c.fillText(w, x, 24 + y * 17);
      x += c.measureText(w).width + 8;
    }
  }
  return cv;
}

export function mountCrew(host: HTMLElement, opts: CrewOpts): CrewCtl | null {
  const { jobs, reduced, narrow } = opts;
  let renderer: T.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const dpr = Math.min(devicePixelRatio || 1, narrow ? 1.6 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = T.ACESFilmicToneMapping;
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
  scene.environmentIntensity = 0.7;
  const camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
  const key = new T.DirectionalLight(0xffffff, 1.5);
  key.position.set(2, 4, 4);
  const rimA = new T.DirectionalLight(0xff3e8a, 2.4);
  rimA.position.set(-3, 2, -3);
  const rimB = new T.DirectionalLight(0x3df2ff, 2.0);
  rimB.position.set(3, 1.5, -2.5);
  scene.add(key, rimA, rimB, new T.HemisphereLight(0x8a7dff, 0x1a1033, 0.5));

  // shared geometry
  const G = {
    sphere: track(new T.SphereGeometry(1, 32, 20)),
    capsule: track(new T.CapsuleGeometry(1, 1, 8, 16)),
    cyl: track(new T.CylinderGeometry(1, 1, 1, 32)),
    torus: track(new T.TorusGeometry(1, 0.12, 12, 40)),
    box: track(new T.BoxGeometry(1, 1, 1)),
    cone: track(new T.ConeGeometry(1, 1, 32, 1, true)),
    ico: track(new T.IcosahedronGeometry(1, 0)),
    knot: track(new T.TorusKnotGeometry(0.5, 0.14, 90, 10)),
    ring: track(new T.RingGeometry(0.9, 1, 64)),
  };
  const matCache = new Map<string, T.Material>();
  const vinyl = (col: string, rough = 0.38) => {
    const k = `v${col}${rough}`;
    let m = matCache.get(k);
    if (!m) {
      m = track(new T.MeshPhysicalMaterial({ color: col, roughness: rough, clearcoat: 0.8, clearcoatRoughness: 0.25 }));
      matCache.set(k, m);
    }
    return m;
  };
  const glow = (col: string, op = 1) => {
    const k = `g${col}${op}`;
    let m = matCache.get(k);
    if (!m) {
      m = track(new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(1.4), transparent: op < 1, opacity: op, blending: op < 1 ? T.AdditiveBlending : T.NormalBlending, depthWrite: op >= 1, side: T.DoubleSide }));
      matCache.set(k, m);
    }
    return m;
  };
  const mesh = (g: T.BufferGeometry, m: T.Material, p: [number, number, number], s: [number, number, number], r: [number, number, number] = [0, 0, 0]) => {
    const o = new T.Mesh(g, m);
    o.position.set(...p);
    o.scale.set(...s);
    o.rotation.set(...r);
    return o;
  };

  const build = (job: Job, i: number): Figure => {
    const root = new T.Group();
    const col = job.color;
    const skin = vinyl(SKIN[i % SKIN.length], 0.5);
    const hairC = HAIR[i % HAIR.length];
    const hair = vinyl(hairC, 0.45);
    const jacket = vinyl(col, 0.35);
    const dark = vinyl('#1d1740', 0.45);
    const white = vinyl('#f4f1ff', 0.4);
    const ink = vinyl('#120c26', 0.2);

    // pedestal
    const ped = new T.Group();
    ped.add(mesh(G.cyl, vinyl('#141030', 0.3), [0, -0.06, 0], [0.95, 0.12, 0.95]));
    ped.add(mesh(G.torus, glow(col), [0, 0.0, 0], [0.95, 0.95, 0.35], [Math.PI / 2, 0, 0]));
    const ringT = mesh(G.ring, glow(col, 0.5), [0, 0.01, 0], [1.15, 1.15, 1], [-Math.PI / 2, 0, 0]);
    ped.add(ringT);
    const beam = mesh(G.cone, glow(col, 0.08), [0, 1.1, 0], [0.95, 2.2, 0.95], [Math.PI, 0, 0]);
    ped.add(beam);
    root.add(ped);

    const body = new T.Group();
    root.add(body);
    // legs + shoes
    [-1, 1].forEach((s) => {
      body.add(mesh(G.capsule, dark, [s * 0.14, 0.32, 0], [0.12, 0.16, 0.12]));
      body.add(mesh(G.sphere, white, [s * 0.15, 0.1, 0.05], [0.15, 0.1, 0.22]));
    });
    // torso
    body.add(mesh(G.capsule, jacket, [0, 0.78, 0], [0.3, 0.2, 0.26]));
    body.add(mesh(G.torus, dark, [0, 0.6, 0], [0.3, 0.26, 0.6], [Math.PI / 2, 0, 0]));
    // collar / emblem
    body.add(mesh(G.sphere, glow('#ffffff'), [0, 0.86, 0.27], [0.05, 0.05, 0.02]));
    // arms
    const arm = (s: number) => {
      const g = new T.Group();
      g.position.set(s * 0.33, 0.98, 0);
      g.add(mesh(G.capsule, jacket, [0, -0.2, 0], [0.085, 0.16, 0.085]));
      g.add(mesh(G.sphere, skin, [0, -0.42, 0], [0.1, 0.1, 0.1]));
      g.rotation.z = s * 0.22;
      body.add(g);
      return g;
    };
    const armL = arm(-1);
    const armR = arm(1);
    // head
    const head = new T.Group();
    head.position.set(0, 1.5, 0);
    body.add(head);
    head.add(mesh(G.sphere, skin, [0, 0, 0], [0.46, 0.43, 0.43]));
    // hair cap
    const cap = new T.Mesh(track(new T.SphereGeometry(0.48, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55)), hair);
    cap.position.set(0, 0.02, -0.03);
    cap.rotation.x = -0.35;
    head.add(cap);
    // bangs
    head.add(mesh(G.sphere, hair, [-0.16, 0.2, 0.3], [0.2, 0.1, 0.12], [0, 0, 0.5]));
    head.add(mesh(G.sphere, hair, [0.14, 0.22, 0.3], [0.2, 0.09, 0.12], [0, 0, -0.4]));
    // face
    const eyes = [-1, 1].map((s) => {
      const e = mesh(G.sphere, ink, [s * 0.15, -0.02, 0.39], [0.055, 0.08, 0.03]);
      head.add(e);
      head.add(mesh(G.sphere, glow('#ffffff'), [s * 0.15 + 0.018, 0.015, 0.415], [0.018, 0.022, 0.01]));
      head.add(mesh(G.sphere, glow('#ff8fb3', 0.55), [s * 0.25, -0.12, 0.34], [0.06, 0.035, 0.02]));
      return e;
    });
    head.add(mesh(G.torus, ink, [0, -0.15, 0.4], [0.045, 0.03, 0.5], [0, 0, Math.PI]));

    const spin: T.Object3D[] = [];
    const bars: T.Mesh[] = [];
    const orbit: T.Object3D[] = [];
    let bug: T.Object3D | undefined;
    const id: JobId = job.id;
    if (id === 'engineer') {
      // hood + glasses + holo screen
      const hood = new T.Mesh(track(new T.TorusGeometry(0.36, 0.1, 12, 32, Math.PI * 1.3)), jacket);
      hood.position.set(0, 1.18, -0.12);
      hood.rotation.set(-0.3, 0, -Math.PI * 0.15 - 0.2);
      body.add(hood);
      [-1, 1].forEach((s) => head.add(mesh(G.torus, ink, [s * 0.15, -0.02, 0.42], [0.1, 0.1, 0.3])));
      head.add(mesh(G.box, ink, [0, -0.01, 0.43], [0.08, 0.015, 0.01]));
      const tex = track(new T.CanvasTexture(codeTex(col)));
      tex.colorSpace = T.SRGBColorSpace;
      const scr = new T.Mesh(track(new T.PlaneGeometry(0.8, 0.5)), track(new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, side: T.DoubleSide })));
      scr.position.set(0.62, 1.05, 0.35);
      scr.rotation.y = -0.55;
      root.add(scr);
      orbit.push(scr);
      const kb = mesh(G.box, glow(col, 0.6), [0, 0.62, 0.45], [0.6, 0.02, 0.2], [0.3, 0, 0]);
      root.add(kb);
    } else if (id === 'planner') {
      const beret = mesh(G.sphere, vinyl('#7b5cff', 0.45), [0.05, 0.36, -0.02], [0.42, 0.12, 0.4], [0.1, 0, -0.18]);
      head.add(beret);
      head.add(mesh(G.sphere, vinyl('#7b5cff', 0.45), [0.05, 0.48, -0.02], [0.05, 0.05, 0.05]));
      body.add(mesh(G.torus, vinyl('#ff3e8a', 0.5), [0, 1.08, 0.02], [0.24, 0.24, 0.7], [Math.PI / 2, 0, 0]));
      const board = mesh(G.box, white, [0.12, -0.46, 0.12], [0.3, 0.38, 0.03], [0.2, -0.3, -0.2]);
      armR.add(board);
      const d20 = mesh(G.ico, vinyl('#ffd84a', 0.25), [-0.7, 1.35, 0.2], [0.2, 0.2, 0.2]);
      root.add(d20);
      spin.push(d20);
      orbit.push(d20);
    } else if (id === 'artist') {
      head.add(mesh(G.torus, vinyl('#ff3e8a', 0.5), [0, 0.2, 0], [0.44, 0.44, 0.6], [Math.PI / 2 - 0.25, 0, 0]));
      const brush = new T.Group();
      brush.add(mesh(G.cyl, vinyl('#e8d2a8', 0.5), [0, 0.2, 0], [0.03, 0.55, 0.03]));
      brush.add(mesh(G.sphere, vinyl(col, 0.3), [0, 0.52, 0], [0.06, 0.12, 0.06]));
      brush.position.set(0, -0.44, 0.04);
      brush.rotation.z = -0.5;
      armR.add(brush);
      const knot = new T.Mesh(G.knot, track(new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(1.5), wireframe: true, transparent: true, opacity: 0.85 })));
      knot.position.set(-0.72, 1.3, 0.1);
      knot.scale.setScalar(0.42);
      root.add(knot);
      spin.push(knot);
      orbit.push(knot);
    } else if (id === 'sound') {
      const band = new T.Mesh(track(new T.TorusGeometry(0.5, 0.05, 10, 32, Math.PI)), dark);
      band.position.set(0, 0.04, 0);
      head.add(band);
      [-1, 1].forEach((s) => {
        head.add(mesh(G.cyl, dark, [s * 0.47, -0.02, 0], [0.16, 0.1, 0.16], [0, 0, Math.PI / 2]));
        head.add(mesh(G.cyl, glow(col), [s * 0.53, -0.02, 0], [0.1, 0.02, 0.1], [0, 0, Math.PI / 2]));
      });
      for (let k = 0; k < 5; k++) {
        const b = mesh(G.box, glow(col), [-0.95 + k * 0.1, 0.6, 0.1], [0.06, 1, 0.06]);
        root.add(b);
        bars.push(b);
      }
      const note = new T.Group();
      note.add(mesh(G.sphere, vinyl(col, 0.3), [0, 0, 0], [0.09, 0.07, 0.07], [0, 0, 0.4]));
      note.add(mesh(G.cyl, vinyl(col, 0.3), [0.075, 0.18, 0], [0.018, 0.36, 0.018]));
      note.position.set(0.72, 1.6, 0.1);
      root.add(note);
      orbit.push(note);
    } else if (id === 'ui') {
      head.add(mesh(G.sphere, hair, [0, 0.42, -0.18], [0.16, 0.16, 0.16]));
      head.add(mesh(G.torus, vinyl('#3df2ff', 0.2), [0, 0.18, 0.32], [0.3, 0.12, 0.5], [0.2, 0, 0]));
      const cols = ['#ff8a3d', '#3df2ff', '#ff3e8a'];
      cols.forEach((c, k) => {
        const panel = new T.Group();
        panel.add(mesh(G.box, vinyl('#f4f1ff', 0.3), [0, 0, 0], [0.34, 0.24, 0.02]));
        panel.add(mesh(G.box, glow(c), [0, 0.05, 0.012], [0.26, 0.06, 0.01]));
        panel.add(mesh(G.box, vinyl('#1d1740', 0.4), [-0.05, -0.05, 0.012], [0.16, 0.03, 0.01]));
        panel.userData.k = k;
        root.add(panel);
        orbit.push(panel);
      });
    } else {
      // QA: cap + magnifier + a bug to catch
      head.add(mesh(G.sphere, vinyl(col, 0.4), [0, 0.1, -0.03], [0.51, 0.4, 0.5]));
      head.add(mesh(G.cyl, vinyl(col, 0.4), [0, 0.1, 0.36], [0.3, 0.02, 0.22]));
      const mag = new T.Group();
      mag.add(mesh(G.torus, vinyl('#f4f1ff', 0.2), [0, 0.18, 0], [0.16, 0.16, 0.8]));
      mag.add(mesh(G.cyl, glow('#bff6ff', 0.25), [0, 0.18, 0], [0.15, 0.01, 0.15], [Math.PI / 2, 0, 0]));
      mag.add(mesh(G.cyl, vinyl('#1d1740', 0.4), [0, -0.06, 0], [0.03, 0.26, 0.03]));
      mag.position.set(0, -0.5, 0.08);
      mag.rotation.z = -0.3;
      armR.add(mag);
      const b = new T.Group();
      b.add(mesh(G.sphere, vinyl('#ff3e8a', 0.3), [0, 0, 0], [0.09, 0.06, 0.12]));
      b.add(mesh(G.sphere, glow('#ffffff'), [0.03, 0.03, 0.1], [0.02, 0.02, 0.02]));
      b.add(mesh(G.sphere, glow('#ffffff'), [-0.03, 0.03, 0.1], [0.02, 0.02, 0.02]));
      [-1, 1].forEach((s) => [-0.05, 0, 0.05].forEach((z) => b.add(mesh(G.cyl, ink, [s * 0.09, -0.02, z], [0.008, 0.08, 0.008], [0, 0, s * 1.1]))));
      root.add(b);
      bug = b;
    }
    root.visible = false;
    scene.add(root);
    return { root, head, armL, armR, eyes, spin, bars, orbit, bug };
  };

  const figs: Figure[] = [];
  let sel = 0;
  let prev = -1;
  let swapT = 1;
  let yaw = 0.35;
  let yawT = 0.35;
  let time = 0;
  let blinkT = 2;
  let ready = false;
  let visible = true;
  let dirty = true;

  const pose = (f: Figure, t: number, i: number) => {
    const b = f.root.children[1] as T.Group;
    const breath = reduced ? 0 : Math.sin(t * 2.2 + i) * 0.012;
    b.scale.set(1 - breath * 0.5, 1 + breath, 1 - breath * 0.5);
    b.position.y = reduced ? 0 : Math.max(0, Math.sin(t * 2.2 + i)) * 0.02;
    f.head.rotation.z = reduced ? 0.05 : Math.sin(t * 0.9 + i) * 0.07;
    f.head.rotation.x = reduced ? 0 : Math.sin(t * 1.3 + i) * 0.04;
    f.armL.rotation.x = reduced ? 0 : Math.sin(t * 1.8 + i) * 0.12;
    f.armR.rotation.x = reduced ? -0.25 : -0.25 + Math.sin(t * 1.8 + i + 1.5) * 0.12;
    f.spin.forEach((o, k) => o.rotation.set(t * (0.7 + k * 0.2), t * 0.9, 0));
    f.bars.forEach((o, k) => {
      const h = 0.25 + Math.abs(Math.sin(t * (3 + k * 0.7) + k * 1.7)) * 0.7;
      o.scale.y = reduced ? 0.25 + k * 0.12 : h;
      o.position.y = 0.2 + o.scale.y / 2;
    });
    f.orbit.forEach((o, k) => {
      if (o.userData.k !== undefined) {
        const a = t * 0.6 + (o.userData.k as number) * ((Math.PI * 2) / 3);
        o.position.set(Math.cos(a) * 0.85, 1.2 + Math.sin(a * 1.3) * 0.25, Math.sin(a) * 0.5);
        o.rotation.y = -a + Math.PI / 2;
      } else {
        o.position.y += reduced ? 0 : Math.sin(t * 1.6 + k) * 0.0016;
      }
    });
    if (f.bug) {
      const a = t * 1.4;
      f.bug.position.set(Math.cos(a) * 0.7, 0.07, Math.sin(a) * 0.7);
      f.bug.rotation.y = -a;
    }
  };

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const asp = w / h;
    camera.fov = 26;
    const dist = asp < 0.8 ? 8.8 : asp < 1.1 ? 8.2 : 7.8;
    camera.position.set(0, 1.75, dist);
    camera.lookAt(0, 0.66, 0);
    camera.updateProjectionMatrix();
    dirty = true;
  };

  // drag to turn the figure (horizontal only; vertical scroll passes through)
  const el = renderer.domElement;
  let down: { x: number; y: number; id: number; yaw: number } | null = null;
  let dragging = false;
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, yaw: yawT };
  };
  const onMove = (e: PointerEvent) => {
    if (!down || down.id !== e.pointerId) return;
    const dx = e.clientX - down.x;
    if (!dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - down.y)) {
      dragging = true;
      el.setPointerCapture?.(e.pointerId);
    }
    if (dragging) yawT = down.yaw + dx * 0.012;
  };
  const onUp = () => {
    down = null;
    dragging = false;
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);

  let raf = 0;
  let last = performance.now();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!ready || !visible || document.hidden) return;
    time += dt;
    const idleSway = reduced || dragging ? 0 : Math.sin(time * 0.35) * 0.0025;
    yawT += idleSway;
    const before = yaw;
    yaw += (yawT - yaw) * (1 - Math.exp(-dt * 8));
    swapT = Math.min(1, swapT + dt / 0.55);
    blinkT -= dt;
    const blink = !reduced && blinkT < 0.12 ? 0.15 : 1;
    if (blinkT < 0) blinkT = 2 + Math.random() * 2.5;
    const cur = figs[sel];
    const old = prev >= 0 ? figs[prev] : null;
    if (!cur) return;
    const e = swapT;
    const ease = 1 - Math.pow(1 - e, 3);
    cur.root.visible = true;
    cur.root.position.y = reduced ? 0 : (1 - ease) * 1.2;
    cur.root.scale.setScalar(reduced ? 1 : 0.6 + ease * 0.4);
    cur.root.rotation.y = yaw + (reduced ? 0 : (1 - ease) * 2.5);
    cur.eyes.forEach((m) => (m.scale.y = 0.08 * blink));
    pose(cur, time, sel);
    if (old && old !== cur) {
      old.root.visible = e < 1 && !reduced;
      old.root.scale.setScalar(Math.max(0.001, 1 - e * 1.4));
      old.root.rotation.y += dt * 8;
    }
    const animating = !reduced || e < 1 || Math.abs(before - yaw) > 1e-4;
    if (animating || dirty) {
      dirty = false;
      renderer.render(scene, camera);
    }
  };

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting), { rootMargin: '100px' });
  io.observe(host);

  // portraits for the roster tiles
  const portraits = () => {
    const S = 192;
    const rt = new T.WebGLRenderTarget(S, S, { samples: 4, colorSpace: T.SRGBColorSpace });
    const cam = new T.PerspectiveCamera(24, 1, 0.1, 20);
    cam.position.set(0.35, 1.55, 3.4);
    cam.lookAt(0, 1.3, 0);
    const buf = new Uint8Array(S * S * 4);
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d')!;
    const urls: string[] = [];
    figs.forEach((f, i) => {
      figs.forEach((g) => (g.root.visible = g === f));
      f.root.position.y = 0;
      f.root.scale.setScalar(1);
      f.root.rotation.y = 0.35;
      f.eyes.forEach((m) => (m.scale.y = 0.08));
      pose(f, 1.2, i);
      // hide the pedestal beam for a cleaner bust
      (f.root.children[0] as T.Group).visible = false;
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, S, S, buf);
      const img = c.createImageData(S, S);
      for (let y = 0; y < S; y++) img.data.set(buf.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
      c.clearRect(0, 0, S, S);
      c.putImageData(img, 0, 0);
      urls.push(cv.toDataURL('image/png'));
      (f.root.children[0] as T.Group).visible = true;
      f.root.visible = false;
    });
    renderer.setRenderTarget(null);
    rt.dispose();
    opts.onPortraits(urls);
  };

  let dead = false;
  const start = () => {
    if (dead) return;
    jobs.forEach((j, i) => figs.push(build(j, i)));
    try {
      portraits();
    } catch {
      /* portraits are optional */
    }
    figs.forEach((f) => (f.root.visible = false));
    figs[sel].root.visible = true;
    swapT = reduced ? 1 : 0;
    ready = true;
    dirty = true;
    opts.onReady();
  };
  if ('fonts' in document) void Promise.race([document.fonts.load('600 13px "JetBrains Mono"'), new Promise((r) => setTimeout(r, 800))]).then(start, start);
  else start();
  tick();

  return {
    select: (i) => {
      if (i === sel || !figs[i]) return;
      prev = sel;
      sel = i;
      swapT = reduced ? 1 : 0;
      if (prev >= 0 && reduced) figs[prev].root.visible = false;
      yawT = yaw = 0.35;
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
      el.removeEventListener('pointercancel', onUp);
      scene.traverse((o) => {
        const m = o as T.Mesh;
        if (m.isMesh && !Object.values(G).includes(m.geometry as never)) m.geometry.dispose();
      });
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      el.remove();
    },
  };
}
