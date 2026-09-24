import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LOOP, T0, T1, LAMP_D, LED0, LED1, SOLID_VS } from './glsl';
import * as S from './shaders';
import { drawPanel, drawPlate, drawEtc, drawChevron, drawLimit, drawStripes, waitFonts, GANTRIES, EXIT_PANEL, type GPanel, type SignTarget } from './signs';

/**
 * MIRAI MOTORS — "the page is a night highway; scrolling is the accelerator".
 * A first-person night drive on an elevated Japanese expressway. Scroll input is
 * throttle (speed with inertia); the pinned scroll progress drives the exit
 * sequence: deceleration lane → gore → curving ramp with chevrons → ETC gate.
 */

export type SignHit = { id: string; target: SignTarget; label: string; x: number; y: number; w: number; h: number; on: boolean };
export type HudFrame = {
  speed: number;
  rpm: number;
  gear: number;
  odo: number;
  trip: number;
  blink: number;
  phase: 'cruise' | 'tunnel' | 'exit' | 'gate' | 'arrive';
  exit: number;
  tunnelLeft: number;
  next: { target: SignTarget; km: number }[];
  hits: SignHit[];
};
export type DriveCtl = { setProgress: (p: number) => void; throttle: (px: number) => void; dispose: () => void };
export type DriveOpts = {
  reduced: boolean;
  narrow: boolean;
  onFrame: (h: HudFrame) => void;
  onReady: () => void;
};

// Exit script, metres from where the exit sequence begins
const Q = { DEC: 24, LANE0: 30, LANE1: 90, GANTRY: 78, DIV: 118, NOSE: 138, CURVE0: 128, CURVE1: 172, CHEV0: 148, CHEV1: 232, GATE: 256, MAX: 294 };
const LANE_X = [-1.8, 1.8];
/** Speed on the exit ramp (km/h) as a function of distance into the exit. */
const exitProfile = (q: number) =>
  100 - 30 * sm(10, Q.DIV, q) - 25 * sm(Q.DIV, Q.GATE - 40, q) - 15 * sm(Q.GATE - 40, Q.GATE, q) + 12 * sm(Q.GATE + 4, Q.MAX, q);
const EXIT_X = -5.4;

const rows = (near: number, far: number, n: number, pw = 1.8) =>
  Array.from({ length: n + 1 }, (_, i) => near - (near - far) * Math.pow(i / n, pw));

function strip(profile: number[][], zs: number[]) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const P = profile.length;
  zs.forEach((z, j) =>
    profile.forEach(([x, y], i) => {
      pos.push(x, y, z);
      uv.push(i / (P - 1), j / (zs.length - 1));
    }),
  );
  for (let j = 0; j < zs.length - 1; j++)
    for (let i = 0; i < P - 1; i++) {
      const a = j * P + i;
      const b = a + 1;
      const c = a + P;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const wrap = (x: number) => ((x % LOOP) + LOOP) % LOOP;
const inTunnel = (s: number) => {
  const w = wrap(s);
  return w >= T0 && w <= T1;
};
const lampRGB = (s: number): [number, number, number] => {
  const w = wrap(s);
  return w >= LED0 && w <= LED1 ? [0.7, 0.82, 1.0] : [1.0, 0.43, 0.11];
};

type Car = {
  s: number;
  lane: number;
  x: number;
  v: number;
  kind: number;
  col: [number, number, number];
  fade: number;
  blink: number;
};
const KINDS = [
  { l: 4.7, w: 1.78, h: 1.45, cab: 0.48, cabOff: 0.26, ty: 0.9, tw: 0.34, th: 0.13 },
  { l: 3.4, w: 1.48, h: 1.75, cab: 0.72, cabOff: 0.04, ty: 0.95, tw: 0.15, th: 0.32 },
  { l: 4.7, w: 1.72, h: 1.85, cab: 0.74, cabOff: 0.04, ty: 1.0, tw: 0.2, th: 0.34 },
  { l: 4.6, w: 1.85, h: 1.7, cab: 0.6, cabOff: 0.1, ty: 1.0, tw: 0.3, th: 0.15 },
  { l: 11, w: 2.49, h: 3.6, cab: 0, cabOff: 0, ty: 0.85, tw: 0.2, th: 0.2 },
];
const PAINT: [number, number, number][] = [
  [0.62, 0.62, 0.6],
  [0.02, 0.02, 0.022],
  [0.3, 0.31, 0.33],
  [0.04, 0.06, 0.11],
  [0.28, 0.03, 0.03],
  [0.14, 0.14, 0.13],
];

export function mountDrive(host: HTMLElement, opts: DriveOpts): DriveCtl {
  const { reduced, narrow } = opts;
  const renderer = new T.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  const dpr = Math.min(devicePixelRatio || 1, narrow ? 1.3 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(56, 1, 0.1, 2600);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const U = {
    uBend: { value: 0 },
    uHill: { value: 0 },
    uDiv: { value: 0 },
    uDivD: { value: 1e6 },
    uS: { value: 0 },
    uCamX: { value: -1.8 },
    uYaw: { value: 0 },
    uHead: { value: 1 },
    uFogDen: { value: 0.0042 },
    uTime: { value: 0 },
    uTunVis: { value: 1 },
    uDecD: { value: 1e6 },
    uQ: { value: -1e6 },
    uGateD: { value: 1e6 },
    uWet: { value: 1 },
    uFogCol: { value: new T.Color(0.011, 0.013, 0.022) },
  };
  const disposables: { dispose: () => void }[] = [];
  const track = <X extends { dispose: () => void }>(x: X) => {
    disposables.push(x);
    return x;
  };

  const mat = (
    fs: string,
    extra: Record<string, T.IUniform> = {},
    o: Partial<T.ShaderMaterialParameters> = {},
    vs = SOLID_VS,
  ) =>
    track(
      new T.ShaderMaterial({
        uniforms: { ...U, uMask: { value: 1 }, ...extra },
        vertexShader: vs,
        fragmentShader: fs,
        ...o,
      }),
    );
  const solid = (color: T.ColorRepresentation, o: { mask?: number; emis?: number; retro?: number; spec?: number; map?: T.Texture; car?: boolean; booth?: boolean; side?: T.Side } = {}) =>
    mat(
      S.SOLID_FS,
      {
        uMask: { value: o.mask ?? 1 },
        uColor: { value: new T.Color(color) },
        uEmis: { value: o.emis ?? 0 },
        uRetro: { value: o.retro ?? 0 },
        uSpec: { value: o.spec ?? 0 },
        map: { value: o.map ?? null },
      },
      { defines: { ...(o.map ? { USE_MAP: '' } : {}), ...(o.car ? { CAR: '' } : {}), ...(o.booth ? { BOOTH: '' } : {}) }, side: o.side ?? T.FrontSide },
      o.car ? S.CAR_VS : SOLID_VS,
    );
  const add = (g: T.BufferGeometry, m: T.Material, order = 0) => {
    track(g);
    const mesh = new T.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    scene.add(mesh);
    return mesh;
  };
  const tex = (cv: HTMLCanvasElement) => {
    const t = track(new T.CanvasTexture(cv));
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.generateMipmaps = true;
    t.minFilter = T.LinearMipmapLinearFilter;
    return t;
  };

  // ── sky ────────────────────────────────────────────────────────────────
  const skyMat = track(
    new T.ShaderMaterial({
      uniforms: { ...U, uInvProj: { value: new T.Matrix4() }, uCamWorld: { value: new T.Matrix4() } },
      vertexShader: S.SKY_VS,
      fragmentShader: S.SKY_FS,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const tri = new T.BufferGeometry();
  tri.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  add(tri, skyMat, -10);

  // ── surfaces ───────────────────────────────────────────────────────────
  add(strip([[-7.2, 0], [17.6, 0]], rows(10, -1150, 280, 1.9)), mat(S.ROAD_FS, { uCars: { value: Array.from({ length: 8 }, () => new T.Vector4()) } }));
  const rampMat = mat(
    S.RAMP_FS,
    {
      uMask: { value: 0 },
      uQDec: { value: Q.DEC },
      uQDiv: { value: Q.DIV },
      uQGate: { value: Q.GATE },
      uRL: { value: [new T.Vector3(0, 0, 1e5), new T.Vector3(0, 0, 1e5), new T.Vector3(0, 0, 1e5)] },
    },
    { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 },
  );
  add(strip([[-10, 0.004], [4.5, 0.004]], rows(10, -700, 240, 1.8)), rampMat);
  add(strip([[-900, -5.5], [900, -5.5]], rows(20, -1800, 60, 1.6)), mat(S.GROUND_FS, { uMask: { value: 0 } }));

  const railMat = (type: number, o: { nx: number; mask?: number; cut?: number; ramp?: number; taper?: number }) =>
    mat(
      S.RAIL_FS,
      {
        uMask: { value: o.mask ?? 1 },
        uD0: { value: -1e6 },
        uD1: { value: 1e6 },
        uNx: { value: o.nx },
        uCutTun: { value: o.cut ?? 1 },
        uRamp: { value: o.ramp ?? 0 },
        uTaper: { value: o.taper ?? 0 },
        uQDec: { value: Q.DEC },
      },
      { defines: { TYPE: type }, side: T.DoubleSide },
      S.RAIL_VS,
    );
  const railZ = rows(8, -720, 300, 1.7);
  const leftRail = railMat(0, { nx: 1 });
  add(strip([[-6.4, 0], [-6.4, 0.46], [-6.4, 0.82]], railZ), leftRail);
  const rampRailL = railMat(0, { nx: 1, mask: 0, ramp: 1, taper: -3.0, cut: 0 });
  add(strip([[-6.4, 0], [-6.4, 0.46], [-6.4, 0.82]], railZ), rampRailL);
  const rampRailR = railMat(0, { nx: -1, mask: 0, ramp: 1, cut: 0 });
  add(strip([[-2.3, 0], [-2.3, 0.46], [-2.3, 0.82]], railZ), rampRailR);
  add(strip([[16.3, 0], [16.3, 0.46], [16.3, 0.82]], railZ), railMat(0, { nx: -1 }));
  add(
    strip(
      [
        [4.42, 0],
        [4.56, 0.26],
        [4.74, 0.82],
        [5.26, 0.82],
        [5.44, 0.26],
        [5.58, 0],
      ],
      railZ,
    ),
    railMat(1, { nx: -1 }),
  );
  add(strip([[5.0, 0.82], [5.0, 1.95]], railZ), railMat(2, { nx: -1 }));

  // tunnel: our bore and the opposite bore
  const arch = [
    [-4.7, 0],
    [-4.7, 4.2],
    [-4.35, 5.4],
    [-3.45, 6.4],
    [-2.0, 7.05],
    [0, 7.3],
    [2.0, 7.05],
    [3.45, 6.4],
    [4.35, 5.4],
    [4.7, 4.2],
    [4.7, 0],
  ];
  const tunMat = railMat(3, { nx: 1 });
  const tunGeo = strip(arch, rows(8, -760, 360, 1.5));
  add(tunGeo, tunMat);
  const tun2 = new T.Mesh(tunGeo, tunMat);
  tun2.position.x = 10.0;
  tun2.frustumCulled = false;
  scene.add(tun2);

  // hillside portal: silhouette of the hill with two bores cut out
  const hill = new T.Shape();
  hill.moveTo(-260, -9);
  for (let x = -260; x <= 280; x += 12) {
    const y = 9 + 30 * Math.exp(-(((x - 12) / 95) ** 2)) + 6 * Math.sin(x * 0.045) + 3 * Math.sin(x * 0.13);
    hill.lineTo(x, y);
  }
  hill.lineTo(280, -9);
  hill.closePath();
  for (const ox of [0, 10]) {
    const h = new T.Path();
    const pts = arch.map(([x, y]) => [x * 1.02 + ox, y * 1.01] as const);
    h.moveTo(pts[0][0], -0.5);
    pts.forEach(([x, y]) => h.lineTo(x, y));
    h.lineTo(pts[pts.length - 1][0], -0.5);
    h.closePath();
    hill.holes.push(h);
  }
  const portal = add(new T.ShapeGeometry(hill, 4), solid(0x1d1f22, { spec: 0.4 }));
  const plate = new T.Mesh(
    track(new T.PlaneGeometry(5.6, 1.15)),
    solid(0xffffff, { map: tex(drawPlate(['みらいトンネル', 'Mirai Tunnel   L = 440 m'], { w: 5.6, h: 1.15, bg: '#23282d' })), emis: 0.2, retro: 0.5 }),
  );
  plate.position.set(0, 8.3, 0.05);
  portal.add(plate);

  // ── instanced structures ───────────────────────────────────────────────
  const poleGeo = track(
    mergeGeometries([
      new T.CylinderGeometry(0.1, 0.17, 9.7, 8).translate(0, 4.85, 0),
      new T.BoxGeometry(5.3, 0.09, 0.09).translate(0, 9.5, 0),
      new T.BoxGeometry(0.72, 0.13, 0.32).translate(-2.62, 9.55, 0),
      new T.BoxGeometry(0.72, 0.13, 0.32).translate(2.62, 9.55, 0),
    ])!,
  );
  const poles = new T.InstancedMesh(poleGeo, solid(0x3a3d42, { spec: 1 }), 24);
  poles.frustumCulled = false;
  scene.add(poles);
  const rampPoleGeo = track(
    mergeGeometries([
      new T.CylinderGeometry(0.1, 0.16, 8.6, 8).translate(0, 4.3, 0),
      new T.BoxGeometry(2.4, 0.09, 0.09).translate(1.2, 8.4, 0),
      new T.BoxGeometry(0.7, 0.13, 0.3).translate(2.3, 8.45, 0),
    ])!,
  );
  const rampPoles = new T.InstancedMesh(rampPoleGeo, solid(0x3a3d42, { mask: 0, spec: 1 }), 4);
  rampPoles.frustumCulled = false;
  scene.add(rampPoles);

  const box = track(new T.BoxGeometry(1, 1, 1));
  const carBody = new T.InstancedMesh(box, solid(0xffffff, { car: true, spec: 1 }), 16);
  // (bodies are dark silhouettes that pick up lamp and headlight light)
  const carCab = new T.InstancedMesh(box, solid(0x0a0c10, { car: true, spec: 2 }), 16);
  for (const m of [carBody, carCab]) {
    m.frustumCulled = false;
    m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(16 * 3).fill(1), 3);
    scene.add(m);
  }

  // gantries
  const panelTex = new Map<string, T.CanvasTexture>();
  const gantryGroups: { g: T.Group; s: number; panels: GPanel[] }[] = [];
  const buildGantry = (panels: GPanel[], mask: number, cantilever: boolean) => {
    const g = new T.Group();
    const steel = solid(0x50555c, { mask, spec: 1 });
    const x0 = cantilever ? -9.5 : -7.3;
    const x1 = cantilever ? -3.0 : 5.0;
    const post = (x: number) => {
      const m = new T.Mesh(box, steel);
      m.scale.set(0.34, 7.9, 0.34);
      m.position.set(x, 3.95, -0.1);
      g.add(m);
    };
    post(x0);
    if (!cantilever) post(x1);
    for (const y of [7.62, 5.08]) {
      const b = new T.Mesh(box, steel);
      b.scale.set(x1 - x0 + 0.3, 0.22, 0.22);
      b.position.set((x0 + x1) / 2, y, -0.35);
      g.add(b);
    }
    for (const p of panels) {
      const t = tex(drawPanel(p));
      panelTex.set(p.id, t);
      const m = new T.Mesh(track(new T.PlaneGeometry(p.w, p.h)), solid(0xffffff, { mask, map: t, emis: 0.62, retro: 0.55 }));
      m.position.set(p.x, 5.25 + p.h / 2, 0);
      g.add(m);
      const back = new T.Mesh(box, steel);
      back.scale.set(p.w, p.h, 0.08);
      back.position.set(p.x, 5.25 + p.h / 2, -0.06);
      g.add(back);
    }
    g.traverse((o) => (o.frustumCulled = false));
    scene.add(g);
    return g;
  };

  // exit-only objects (mask 0)
  const exitGantry = buildGantry([EXIT_PANEL], 0, true);
  const goreSign = new T.Group();
  {
    const p: GPanel = { id: 'gore', x: 0, target: 'stock', label: '', kind: 'exitnow', jp: '出口', en: 'EXIT', arrow: 'upleft', w: 1.7, h: 1.15 };
    const m = new T.Mesh(track(new T.PlaneGeometry(p.w, p.h)), solid(0xffffff, { mask: 0, map: tex(drawPanel(p, 512)), emis: 0.3, retro: 1.0 }));
    m.position.set(0, 2.2, 0);
    const post = new T.Mesh(box, solid(0x60656c, { mask: 0 }));
    post.scale.set(0.1, 1.7, 0.1);
    post.position.set(0, 0.85, -0.05);
    goreSign.add(m, post);
    // crash cushion at the gore nose
    const cushion = new T.Mesh(box, solid(0xffffff, { mask: 0, retro: 0.9, map: tex(drawStripes()) }));
    cushion.scale.set(0.9, 0.95, 3.2);
    cushion.position.set(0.9, 0.48, -18);
    goreSign.add(cushion);
    goreSign.traverse((o) => (o.frustumCulled = false));
    scene.add(goreSign);
  }
  const chevTex = tex(drawChevron());
  const chevrons = new T.InstancedMesh(track(new T.PlaneGeometry(0.8, 1.0)), solid(0xffffff, { mask: 0, map: chevTex, retro: 1.6, emis: 0.02 }), 12);
  const chevPosts = new T.InstancedMesh(box, solid(0x55595e, { mask: 0 }), 12);
  for (const m of [chevrons, chevPosts]) {
    m.frustumCulled = false;
    scene.add(m);
  }

  // ETC toll gate
  const gate = new T.Group();
  const bar = new T.Group();
  {
    const concrete = solid(0x3a3c3f, { mask: 0 });
    const canopy = new T.Mesh(box, solid(0x2a2d31, { mask: 0, spec: 0.5 }));
    canopy.scale.set(12.6, 0.9, 11);
    canopy.position.set(-3.6, 6.05, -5.5);
    const fascia = new T.Mesh(
      track(new T.PlaneGeometry(12.6, 0.95)),
      solid(0xffffff, { mask: 0, map: tex(drawPlate(['みらい料金所', 'Mirai Toll Gate'], { w: 12.6, h: 0.95, bg: '#0a6a44' })), emis: 0.75 }),
    );
    fascia.position.set(-3.6, 6.05, 0.02);
    const etc = new T.Mesh(track(new T.PlaneGeometry(1.7, 1.06)), solid(0xffffff, { mask: 0, map: tex(drawEtc()), emis: 1.05 }));
    etc.position.set(EXIT_X, 5.0, 0.1);
    const ippan = new T.Mesh(
      track(new T.PlaneGeometry(1.7, 1.06)),
      solid(0xffffff, { mask: 0, map: tex(drawPlate(['一般', 'ETC / 一般'], { w: 1.7, h: 1.06, bg: '#0a6a44', px: 512 })), emis: 0.9 }),
    );
    ippan.position.set(-1.8, 5.0, 0.1);
    gate.add(canopy, fascia, etc, ippan);
    const boothMat = solid(0x5b6166, { mask: 0, booth: true });
    const stripeMat = solid(0xffffff, { mask: 0, retro: 0.9, map: tex(drawStripes()) });
    for (const x of [-7.7, -3.6, 0.3]) {
      const isl = new T.Mesh(box, concrete);
      isl.scale.set(1.1, 0.35, 16);
      isl.position.set(x, 0.18, -5);
      const nose = new T.Mesh(box, stripeMat);
      nose.scale.set(1.1, 1.0, 0.6);
      nose.position.set(x, 0.5, 3.1);
      const booth = new T.Mesh(box, boothMat);
      booth.scale.set(0.95, 2.3, 2.6);
      booth.position.set(x, 1.5, -6);
      gate.add(isl, nose, booth);
    }
    const arm = new T.Mesh(box, solid(0xf2c230, { mask: 0, retro: 0.35, emis: 0.04 }));
    arm.scale.set(2.9, 0.07, 0.07);
    arm.position.set(1.45, 0, 0);
    bar.add(arm);
    bar.position.set(-7.15, 1.0, 1.2);
    gate.add(bar);
    gate.traverse((o) => (o.frustumCulled = false));
    scene.add(gate);
  }

  // speed limit signs on the left shoulder
  const limits: { g: T.Group; s: number }[] = [];
  for (const [s, n] of [
    [420, '80'],
    [1080, '100'],
  ] as const) {
    const g = new T.Group();
    const face = new T.Mesh(track(new T.CircleGeometry(0.6, 40)), solid(0xffffff, { map: tex(drawLimit(n)), retro: 1.2, emis: 0.05 }));
    face.position.set(0, 2.6, 0);
    const post = new T.Mesh(box, solid(0x5a5e63));
    post.scale.set(0.08, 2.1, 0.08);
    post.position.set(0, 1.05, -0.05);
    g.add(face, post);
    g.position.x = -7.0;
    g.traverse((o) => (o.frustumCulled = false));
    scene.add(g);
    limits.push({ g, s });
  }

  // ── glows ──────────────────────────────────────────────────────────────
  const GMAX = 1100;
  const gP = new Float32Array(GMAX * 3);
  const gC = new Float32Array(GMAX * 4);
  const gS = new Float32Array(GMAX * 3);
  const glowGeo = track(new T.InstancedBufferGeometry());
  glowGeo.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  glowGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const aP = new T.InstancedBufferAttribute(gP, 3).setUsage(T.DynamicDrawUsage);
  const aC = new T.InstancedBufferAttribute(gC, 4).setUsage(T.DynamicDrawUsage);
  const aS = new T.InstancedBufferAttribute(gS, 3).setUsage(T.DynamicDrawUsage);
  glowGeo.setAttribute('aP', aP);
  glowGeo.setAttribute('aC', aC);
  glowGeo.setAttribute('aS', aS);
  const glowMat = track(
    new T.ShaderMaterial({
      uniforms: { ...U, uStreak: { value: 0 }, uPx: { value: 0.001 } },
      vertexShader: S.GLOW_VS,
      fragmentShader: S.GLOW_FS,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  );
  const glowMesh = new T.Mesh(glowGeo, glowMat);
  glowMesh.frustumCulled = false;
  glowMesh.renderOrder = 5;
  scene.add(glowMesh);
  let gn = 0;
  const glow = (x: number, y: number, z: number, r: number, g: number, b: number, st: number, sx: number, sy: number, mask = 1) => {
    if (gn >= GMAX) return;
    gP[gn * 3] = x;
    gP[gn * 3 + 1] = y;
    gP[gn * 3 + 2] = z;
    gC[gn * 4] = r;
    gC[gn * 4 + 1] = g;
    gC[gn * 4 + 2] = b;
    gC[gn * 4 + 3] = st;
    gS[gn * 3] = sx;
    gS[gn * 3 + 1] = sy;
    gS[gn * 3 + 2] = mask;
    gn++;
  };

  // town lights below the elevated expressway (loop coordinates)
  const rnd = mulberry(1987);
  const town: number[][] = [];
  // [s, x, y, r, g, b, intensity, size]
  for (let i = 0; i < 110; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const dist = 16 + Math.pow(rnd(), 1.3) * 520;
    const led = rnd() < 0.4;
    town.push([rnd() * LOOP, side > 0 ? 17 + dist : -7 - dist, -1.6 + rnd() * 2.2, ...(led ? [0.7, 0.8, 1.0] : [1.0, 0.45, 0.12]), 1.3 + rnd(), 0.6 + dist * 0.004]);
  }
  const blocks: number[][] = [];
  for (let b = 0; b < 40; b++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const dist = 60 + rnd() * 520;
    const s0 = rnd() * LOOP;
    const x0 = side > 0 ? 17 + dist : -7 - dist;
    const floors = 3 + Math.floor(rnd() * (rnd() < 0.15 ? 20 : 8));
    const depth = 8 + rnd() * 14;
    const wide = 10 + rnd() * 18;
    const warmth = rnd();
    blocks.push([s0, x0, floors * 3.1 + 1, depth, wide]);
    // windows on the face toward the road
    const faceX = x0 - side * (wide / 2 + 0.3);
    for (let f = 0; f < floors; f++)
      for (let c = 0; c < Math.floor(depth / 2.6); c++) {
        if (rnd() > 0.34) continue;
        const warm = rnd() < 0.5 + warmth * 0.45;
        town.push([s0 - depth / 2 + 1.3 + c * 2.6, faceX, -4.2 + f * 3.1 + rnd() * 0.3, ...(warm ? [1.0, 0.62, 0.3] : [0.72, 0.85, 1.0]), 0.45 + rnd() * 0.3, 0.42 + dist * 0.0028]);
      }
    if (floors > 14) town.push([s0, x0, -5.5 + floors * 3.1 + 1.6, 1.2, 0.05, 0.03, 2.2, 0.9 + dist * 0.004]);
  }
  const blockMesh = new T.InstancedMesh(box, solid(0x0b0d11, { mask: 0 }), blocks.length);
  blockMesh.frustumCulled = false;
  scene.add(blockMesh);
  // a local road running alongside, lined with sodium lamps
  for (let i = 0; i < 42; i++) town.push([i * 50, -120, -0.4, 1.0, 0.45, 0.12, 1.5, 1.4]);
  for (let i = 0; i < 42; i++) town.push([i * 50 + 20, 190, -0.4, 0.75, 0.84, 1.0, 1.3, 1.6]);

  // ── hood (child of the camera) ────────────────────────────────────────
  const hoodGeo = track(new T.PlaneGeometry(3.4, 2.2, 28, 14));
  hoodGeo.rotateX(-Math.PI / 2);
  {
    const p = hoodGeo.attributes.position as T.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i) - 2.15;
      const t = (-1.05 - z) / 2.2;
      p.setXYZ(i, x, -0.66 - 0.2 * (x / 1.7) ** 2 - 0.1 * t * t, z);
    }
    hoodGeo.computeVertexNormals();
  }
  const hoodMat = track(
    new T.ShaderMaterial({
      uniforms: {
        uL: { value: Array.from({ length: 8 }, () => new T.Vector3(0, -1, 0)) },
        uLc: { value: Array.from({ length: 8 }, () => new T.Vector3()) },
        uFogCol: U.uFogCol,
        uTun: { value: 0 },
      },
      vertexShader: S.HOOD_VS,
      fragmentShader: S.HOOD_FS,
    }),
  );
  const hood = new T.Mesh(hoodGeo, hoodMat);
  hood.frustumCulled = false;
  hood.renderOrder = 20;
  camera.add(hood);

  // ── post ───────────────────────────────────────────────────────────────
  const rtOpt = { type: T.HalfFloatType, format: T.RGBAFormat, depthBuffer: false } as const;
  const rtMain = track(new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType, format: T.RGBAFormat, samples: narrow ? 2 : 4 }));
  const rtB1 = track(new T.WebGLRenderTarget(4, 4, rtOpt));
  const rtB2 = track(new T.WebGLRenderTarget(4, 4, rtOpt));
  const rtC1 = track(new T.WebGLRenderTarget(4, 4, rtOpt));
  const rtC2 = track(new T.WebGLRenderTarget(4, 4, rtOpt));
  const postScene = new T.Scene();
  const postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postTri = track(new T.BufferGeometry());
  postTri.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mBright = track(new T.ShaderMaterial({ uniforms: { tSrc: { value: null }, uTexel: { value: new T.Vector2() } }, vertexShader: S.POST_VS, fragmentShader: S.BRIGHT_FS, depthTest: false }));
  const mBlur = track(new T.ShaderMaterial({ uniforms: { tSrc: { value: null }, uDir: { value: new T.Vector2() } }, vertexShader: S.POST_VS, fragmentShader: S.BLUR_FS, depthTest: false }));
  const mComp = track(
    new T.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tB1: { value: null },
        tB2: { value: null },
        uSpeed: { value: 0 },
        uTime: { value: 0 },
        uRes: { value: new T.Vector2(1, 1) },
        uCenter: { value: new T.Vector2(0.5, 0.52) },
        uExpo: { value: 1.0 },
      },
      vertexShader: S.POST_VS,
      fragmentShader: S.COMP_FS,
      depthTest: false,
    }),
  );
  const postQuad = new T.Mesh(postTri, mComp);
  postQuad.frustumCulled = false;
  postScene.add(postQuad);
  const pass = (m: T.ShaderMaterial, target: T.WebGLRenderTarget | null) => {
    postQuad.material = m;
    renderer.setRenderTarget(target);
    renderer.render(postScene, postCam);
  };

  let W = 1;
  let H = 1;
  const resize = () => {
    W = Math.max(1, host.clientWidth);
    H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false);
    const pw = Math.round(W * dpr);
    const ph = Math.round(H * dpr);
    rtMain.setSize(pw, ph);
    rtB1.setSize(Math.max(1, pw >> 2), Math.max(1, ph >> 2));
    rtB2.setSize(Math.max(1, pw >> 2), Math.max(1, ph >> 2));
    rtC1.setSize(Math.max(1, pw >> 3), Math.max(1, ph >> 3));
    rtC2.setSize(Math.max(1, pw >> 3), Math.max(1, ph >> 3));
    camera.aspect = W / H;
    mComp.uniforms.uRes.value.set(pw, ph);
    if (reduced) requestRender();
  };

  // ── simulation state ───────────────────────────────────────────────────
  const START = Number(new URLSearchParams(location.search).get('drive_s')) || 66;
  let sCar = START;
  let trip = 0;
  let v = 22.2;
  let vShown = 80;
  let vBoost = 0;
  let pending = 0;
  let pTarget = 0;
  let eS = 0;
  let exitOn = false;
  let s0 = 0;
  let qPrev = 0;
  let camX = LANE_X[0];
  let camVX = 0;
  let myLane = 0;
  let laneTimer = 0;
  let exitLaneX = LANE_X[0];
  let tunVis = 1;
  let inTun = 0;
  let time = 0;
  let rpm = 1800;
  let gear = 5;

  const cars: Car[] = [];
  const oncoming: { s: number; x: number; v: number }[] = [];
  const spawnCar = (c: Car | null, ahead: number): Car => {
    const truck = rnd() < 0.18;
    const lane = truck ? 0 : rnd() < 0.55 ? 0 : 1;
    const kind = truck ? 4 : Math.floor(rnd() * 4);
    const nc: Car = c ?? ({} as Car);
    nc.s = sCar + ahead;
    nc.lane = lane;
    nc.x = LANE_X[lane];
    nc.v = lane === 0 ? 19.5 + rnd() * 4 : 24 + rnd() * 6;
    if (truck) nc.v = 21;
    nc.kind = kind;
    nc.col = PAINT[Math.floor(rnd() * PAINT.length)];
    nc.fade = c ? 0 : 1;
    nc.blink = 0;
    return nc;
  };
  [34, 95, 150, 210, 270, 340, 420, 500, 590].forEach((a) => cars.push(spawnCar(null, a)));
  cars[0].lane = 1;
  cars[0].x = LANE_X[1];
  cars[0].kind = 0;
  cars[0].v = 21.6;
  cars[1].lane = 0;
  cars[1].x = LANE_X[0];
  cars[1].kind = 4;
  cars[1].v = 20.5;
  for (let i = 0; i < 8; i++) oncoming.push({ s: sCar + 40 + i * 110 + rnd() * 60, x: rnd() < 0.5 ? 7.8 : 11.4, v: 24 + rnd() * 7 });

  const laneClear = (lane: number, from: number, to: number) =>
    !cars.some((c) => c.lane === lane && c.s - sCar > from && c.s - sCar < to);

  // ── projection helpers for clickable signs ─────────────────────────────
  const tmp = new T.Vector3();
  const bendCPU = (x: number, y: number, z: number, mask: number) => {
    const d = Math.max(-z, 0);
    const dd = Math.max(-z - U.uDivD.value, 0);
    return tmp.set(x + U.uBend.value * d * d + mask * U.uDiv.value * dd * dd, y + U.uHill.value * d * d, z);
  };
  const project = (x: number, y: number, z: number, mask: number) => {
    const p = bendCPU(x, y, z, mask).applyMatrix4(camera.matrixWorldInverse);
    const behind = p.z > -1;
    p.applyMatrix4(camera.projectionMatrix);
    return { x: (p.x * 0.5 + 0.5) * W, y: (0.5 - p.y * 0.5) * H, behind };
  };
  const hitFor = (p: GPanel, z: number, mask: number): SignHit => {
    const y0 = 5.25;
    const a = project(p.x - p.w / 2, y0 + p.h, z, mask);
    const b = project(p.x + p.w / 2, y0, z, mask);
    const on = !a.behind && !b.behind && -z < 420 && b.x > 0 && a.x < W && b.y > 0 && a.y < H;
    return { id: p.id, target: p.target, label: p.label, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, on: on && b.x - a.x > 26 };
  };

  // ── frame ──────────────────────────────────────────────────────────────
  const m4 = new T.Matrix4();
  const q4 = new T.Quaternion();
  const e3 = new T.Euler();
  const vPos = new T.Vector3();
  const vScl = new T.Vector3();
  const tint = new T.Color();
  const hoodL = hoodMat.uniforms.uL.value as T.Vector3[];
  const hoodLc = hoodMat.uniforms.uLc.value as T.Vector3[];
  const carsU = (scene.children.find((o) => (o as T.Mesh).material && ((o as T.Mesh).material as T.ShaderMaterial).uniforms?.uCars) as T.Mesh).material as T.ShaderMaterial;
  let visible = true;
  let raf = 0;
  let last = performance.now();
  let dirty = true;
  let ready = false;

  const step = (dt: number) => {
    time += dt;
    // progress → exit sequence
    const eT = reduced ? 0 : sm(0.56, 0.985, pTarget);
    // Once past the threshold the exit plays like a cut-scene at a natural pace;
    // scrolling harder pushes it along, scrolling back rewinds it.
    const qNow = eS * Q.MAX;
    const auto = pTarget >= 0.56 && !reduced ? (exitProfile(qNow) / 3.6) * 2.1 : 0;
    const chase = eS + (eT - eS) * (1 - Math.exp(-dt * 5));
    eS = pTarget >= 0.56 ? Math.min(1, Math.max(chase, eS + (auto * dt) / Q.MAX)) : chase;
    if (Math.abs(eT - eS) < 1e-4) eS = eT;
    if (eS > 0.0004 && !exitOn) {
      exitOn = true;
      s0 = sCar;
      qPrev = 0;
      exitLaneX = camX;
      // clear the left lane around the diverge so the lane change is clean
      for (const c of cars) if (c.lane === 0 && c.s - sCar > -25 && c.s - sCar < 170) spawnCar(c, 380 + rnd() * 200);
    }
    if (exitOn && eS <= 0.0004) {
      exitOn = false;
      eS = 0;
    }

    let q = 0;
    if (exitOn) {
      q = eS * Q.MAX;
      const ds = q - qPrev;
      qPrev = q;
      sCar = s0 + q;
      const vi = ds / Math.max(dt, 1e-3);
      v += (vi - v) * (1 - Math.exp(-dt * 6));
      pending = 0;
      vBoost = 0;
    } else {
      const target = Math.min(26, pending * 1.1);
      const acc = target > vBoost ? 16 : 6.5;
      vBoost += Math.max(-acc * dt, Math.min(acc * dt, target - vBoost));
      pending = Math.max(0, pending - vBoost * dt * 0.6);
      // just merged: settle from 55 to 80 km/h over the first seconds
      const cruise = 15.3 + 6.9 * sm(1.5, 9, time);
      v = cruise + vBoost;
      sCar += v * dt;
    }
    trip += Math.max(0, v * dt);
    const sL = wrap(sCar);
    U.uS.value = sL;
    U.uTime.value = time;

    // tunnel state
    const inside = inTunnel(sCar) ? 1 : 0;
    tunVis += ((exitOn ? 0 : 1) - tunVis) * (1 - Math.exp(-dt * 3));
    U.uTunVis.value = tunVis > 0.02 ? Math.min(1, tunVis * 1.4) : 0;
    inTun += (inside * U.uTunVis.value - inTun) * (1 - Math.exp(-dt * 4));
    const fogOut = [0.011, 0.013, 0.022];
    const fogIn = [0.07, 0.032, 0.01];
    U.uFogCol.value.setRGB(
      fogOut[0] + (fogIn[0] - fogOut[0]) * inTun,
      fogOut[1] + (fogIn[1] - fogOut[1]) * inTun,
      fogOut[2] + (fogIn[2] - fogOut[2]) * inTun,
    );
    U.uFogDen.value = 0.0042 + inTun * 0.002;

    // curvature
    const idleBend = 0.000035 * Math.sin(sCar / 380 + 1.2) * (1 - inTun);
    const curve = exitOn ? sm(Q.CURVE0, Q.CURVE1, q) * (1 - 0.45 * sm(Q.GATE - 30, Q.GATE, q)) : 0;
    U.uBend.value = idleBend * (1 - sm(0, 40, q)) - 0.0042 * curve;
    U.uHill.value = 0.000011 * Math.sin(sCar / 260) * (1 - sm(0, 60, q));
    U.uDiv.value = exitOn ? 0.0078 : 0;
    U.uDivD.value = exitOn ? Q.DIV - q : 1e6;
    U.uDecD.value = exitOn ? Q.DEC - q : 1e6;
    U.uQ.value = exitOn ? q : -1e6;
    U.uGateD.value = exitOn ? Q.GATE - q - 5 : 1e6;

    // traffic
    for (const c of cars) {
      c.s += c.v * dt;
      c.fade = Math.min(1, c.fade + dt * 0.8);
      const rel = c.s - sCar;
      if (rel < -30 || rel > 760) spawnCar(c, 360 + rnd() * 260);
      c.x += (LANE_X[c.lane] - c.x) * (1 - Math.exp(-dt * 1.4));
      c.blink = Math.abs(LANE_X[c.lane] - c.x) > 0.25 ? Math.sign(LANE_X[c.lane] - c.x) : 0;
    }
    for (const a of cars)
      for (const b of cars)
        if (a !== b && a.lane === b.lane && b.s > a.s && b.s - a.s < 16 + KINDS[a.kind].l && a.v > b.v) a.v = b.v;
    for (const o of oncoming) {
      o.s -= o.v * dt;
      if (o.s - sCar < -30) {
        o.s = sCar + 520 + rnd() * 320;
        o.x = rnd() < 0.5 ? 7.8 : 11.4;
      }
    }
    // our lane choice (overtake on the right, return left)
    laneTimer += dt;
    if (!exitOn) {
      const ahead = cars.filter((c) => c.lane === myLane && c.s - sCar > 0 && c.s - sCar < 60);
      const block = ahead.find((c) => c.v < v - 0.5);
      if (block && myLane === 0 && laneClear(1, -14, 45)) {
        myLane = 1;
        laneTimer = 0;
      } else if (block && block.s - sCar < 26) {
        block.v = v + 1.5;
      }
      if (myLane === 1 && laneTimer > 4 && laneClear(0, -12, 70)) {
        myLane = 0;
        laneTimer = 0;
      }
    }
    const tx = exitOn ? exitLaneX + (EXIT_X - exitLaneX) * sm(Q.LANE0, Q.LANE1, q) : LANE_X[myLane];
    const ax = (tx - camX) * 2.2 - camVX * 2.6;
    camVX += ax * dt;
    camX += camVX * dt;
    if (exitOn) camX = tx;
    const lat = exitOn ? (EXIT_X - exitLaneX) * (sm(Q.LANE0, Q.LANE1, q + 1) - sm(Q.LANE0, Q.LANE1, q)) * Math.max(v, 1) : camVX;
    const blink = exitOn ? (q > 20 && q < Q.LANE1 + 6 ? -1 : 0) : Math.abs(tx - camX) > 0.3 ? Math.sign(tx - camX) : 0;

    // camera
    const look = 16;
    const yaw = -lat * 0.03 - Math.atan(2 * U.uBend.value * look) * 0.9;
    const bob = Math.sin(time * 21) * 0.0025 * (v / 25) + Math.sin(time * 7.3) * 0.0015;
    camera.position.set(camX, 1.22 + bob, 0);
    camera.rotation.set(-0.028 + Math.sin(time * 0.6) * 0.002, yaw, -lat * 0.004 + U.uBend.value * 2.2);
    const baseFov = narrow ? (W / H < 0.75 ? 76 : 64) : 56;
    camera.fov = baseFov + Math.min(9, Math.max(0, v - 22) * 0.16);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    U.uCamX.value = camX;
    U.uYaw.value = yaw;
    const vs = Math.min(40, Math.max(0, v));
    glowMat.uniforms.uStreak.value = vs * 0.06 * (1 + Math.max(0, vs - 18) / 26);
    glowMat.uniforms.uPx.value = (2 * Math.tan(((camera.fov / 2) * Math.PI) / 180)) / (H * dpr);

    // engine
    const kmh = Math.max(0, v * 3.6);
    const gears = [0, 20, 38, 58, 78, 98, 1e9];
    gear = Math.max(1, gears.findIndex((g) => kmh < g));
    const lo = gears[gear - 1];
    const hi = Math.min(gears[gear], 130);
    const load = Math.max(0, Math.min(1, (vBoost > 0.5 ? 0.35 : 0) + (pending > 5 ? 0.25 : 0)));
    const rpmT = kmh < 2 ? 800 : 1200 + ((kmh - lo) / Math.max(1, hi - lo)) * 1900 + load * 1400;
    rpm += (rpmT - rpm) * (1 - Math.exp(-dt * 5));
    const prof = exitOn ? exitProfile(q) : 999;
    const shown = exitOn ? Math.min(kmh, prof) : kmh;
    vShown += (shown - vShown) * (1 - Math.exp(-dt * 4));

    // ── place objects ──
    // lamp poles + lamp glows
    gn = 0;
    let pi = 0;
    const kStart = Math.floor((sCar - 40) / LAMP_D);
    let hl = 0;
    const setHood = (x: number, y: number, z: number, r: number, g: number, b: number, mask: number) => {
      if (hl >= 8) return;
      const p = bendCPU(x, y, z, mask).applyMatrix4(camera.matrixWorldInverse);
      const dist = p.length();
      hoodL[hl].copy(p).normalize();
      const f = 1 / (1 + dist * 0.035);
      hoodLc[hl].set(r * f, g * f, b * f);
      hl++;
    };
    for (let k = kStart; k < kStart + 16; k++) {
      const sl = k * LAMP_D;
      if (inTunnel(sl) && tunVis > 0.5) continue;
      const z = -(sl - sCar);
      if (pi < 24) {
        m4.makeTranslation(5.0, 0, z);
        poles.setMatrixAt(pi++, m4);
      }
      const [r, g, b] = lampRGB(sl);
      const d = -z;
      glow(2.38, 9.42, z, r * 7, g * 7, b * 7, 1, 0.55, 0.4);
      glow(7.62, 9.42, z, r * 5, g * 5, b * 5, 1, 0.55, 0.4);
      glow(2.38, 9.3, z, r * 0.1, g * 0.1, b * 0.1, 0, 3.6, 3.6);
      glow(7.62, 9.3, z, r * 0.08, g * 0.08, b * 0.08, 0, 3.6, 3.6);
      if (d > 2) setHood(2.38, 9.42, z, r * 3, g * 3, b * 3, 1);
    }
    poles.count = pi;
    poles.instanceMatrix.needsUpdate = true;

    // delineators on the guardrail (white) and median (amber)
    const r0 = Math.ceil((sCar - 4) / 8);
    for (let k = r0; k < r0 + 30; k++) {
      const sl = k * 8;
      const z = -(sl - sCar);
      const d = -z;
      if (inTunnel(sl) && tunVis > 0.5) continue;
      const I = 2.4 * Math.exp(-d / 60) * sm(2, 9, d);
      if (!(exitOn && d > U.uDecD.value)) glow(-6.3, 0.72, z, I * 0.85, I * 0.9, I, 1, 0.09, 0.09);
      glow(4.5, 0.78, z, I * 1.1, I * 0.55, I * 0.08, 1, 0.09, 0.09);
    }

    // tunnel fixtures + emergency lights
    if (tunVis > 0.02) {
      for (let k = Math.ceil((sCar - 10) / 7); k < Math.ceil((sCar - 10) / 7) + 70; k++) {
        const sl = k * 7;
        if (!inTunnel(sl)) continue;
        const z = -(sl - sCar);
        const entry = wrap(sl) - T0 < 84 ? 1.6 : 1;
        const I = 5.5 * tunVis * entry;
        glow(-4.05, 5.1, z, I, I * 0.42, I * 0.1, 1, 0.42, 0.2);
        glow(4.05, 5.1, z, I, I * 0.42, I * 0.1, 1, 0.42, 0.2);
        if (entry > 1) glow(-3.1, 6.45, z - 3.5, I * 0.8, I * 0.36, I * 0.09, 1, 0.36, 0.18);
        if (-z > 1.5) setHood(-4.05, 5.1, z, 2.2, 0.9, 0.2, 1);
        if (k % 29 === 0) glow(-4.6, 1.3, z, 0.1 * tunVis, 1.6 * tunVis, 0.5 * tunVis, 1, 0.16, 0.12);
        if (k % 43 === 0) glow(-4.6, 1.0, z, 2 * tunVis, 0.1, 0.08, 1, 0.14, 0.14);
      }
    }

    // cars ahead
    let ci = 0;
    let wi = 0;
    const cu = carsU.uniforms.uCars.value as T.Vector4[];
    cu.forEach((c) => c.set(0, 0, 0, 0));
    const sorted = cars.slice().sort((a, b) => a.s - b.s);
    for (const c of sorted) {
      const K = KINDS[c.kind];
      const z = -(c.s - sCar);
      const d = -z;
      if (d < -30 || d > 900) continue;
      const yawC = (c.x - LANE_X[c.lane]) * 0.02;
      // body
      q4.setFromEuler(e3.set(0, yawC, 0));
      const bodyH = c.kind === 4 ? 3.25 : K.h * 0.56;
      vPos.set(c.x, (c.kind === 4 ? 0.35 : 0.14) + bodyH / 2, z - K.l / 2);
      vScl.set(K.w, bodyH, K.l);
      carBody.setMatrixAt(ci, m4.compose(vPos, q4, vScl));
      carBody.setColorAt(ci, tint.setRGB(c.kind === 4 ? 0.6 : c.col[0], c.kind === 4 ? 0.62 : c.col[1], c.kind === 4 ? 0.64 : c.col[2]));
      if (c.kind === 4) {
        vPos.set(c.x, 1.55, z - K.l - 1.1);
        vScl.set(K.w, 2.9, 2.2);
      } else {
        vPos.set(c.x, 0.14 + bodyH + (K.h - bodyH - 0.14) / 2, z - K.l * (K.cabOff + K.cab / 2));
        vScl.set(K.w * 0.86, K.h - bodyH - 0.14, K.l * K.cab);
      }
      carCab.setMatrixAt(ci, m4.compose(vPos, q4, vScl));
      carCab.setColorAt(ci, tint.setRGB(1, 1, 1));
      ci++;
      // lights
      const rel = v > 1 ? (v - c.v) / v : 0;
      const I = 3.2 * c.fade;
      const tx = K.w / 2 - 0.2;
      glow(c.x - tx, K.ty, z + 0.02, I, I * 0.035, I * 0.02, rel, K.tw, K.th);
      glow(c.x + tx, K.ty, z + 0.02, I, I * 0.035, I * 0.02, rel, K.tw, K.th);
      glow(c.x, K.ty, z + 0.05, 0.35 * c.fade, 0.02, 0.01, rel, K.w * 0.9, 0.7);
      if (c.kind !== 4) glow(c.x, K.h - 0.1, z + 0.02 - K.l * K.cabOff, 1.4 * c.fade, 0.05, 0.03, rel, 0.22, 0.05);
      if (c.kind === 4) {
        for (let i = 0; i < 7; i++) {
          const zz = z - 0.8 - i * 1.55;
          glow(c.x - K.w / 2 - 0.02, 0.62, zz, 1.5 * c.fade, 0.6 * c.fade, 0.05, rel, 0.07, 0.07);
          glow(c.x + K.w / 2 + 0.02, 0.62, zz, 1.5 * c.fade, 0.6 * c.fade, 0.05, rel, 0.07, 0.07);
        }
        glow(c.x - K.w / 2 + 0.1, 3.52, z + 0.02, 1.6 * c.fade, 0.65, 0.05, rel, 0.08, 0.08);
        glow(c.x + K.w / 2 - 0.1, 3.52, z + 0.02, 1.6 * c.fade, 0.65, 0.05, rel, 0.08, 0.08);
      }
      if (c.blink && Math.sin(time * 9.5) > 0) {
        const bx = c.blink > 0 ? tx + 0.05 : -tx - 0.05;
        glow(c.x + bx, K.ty + 0.1, z + 0.03, 3.5, 1.3, 0.08, rel, 0.14, 0.12);
      }
      if (wi < 8 && d > 1 && d < 220) cu[wi++].set(c.x, d, c.fade * 1.0, 0);
    }
    carBody.count = ci;
    carCab.count = ci;
    carBody.instanceMatrix.needsUpdate = true;
    carCab.instanceMatrix.needsUpdate = true;
    if (carBody.instanceColor) carBody.instanceColor.needsUpdate = true;
    if (carCab.instanceColor) carCab.instanceColor.needsUpdate = true;

    // oncoming headlights (partly hidden by the glare fence)
    for (const o of oncoming) {
      const z = -(o.s - sCar);
      const d = -z;
      if (d < 0 || d > 900) continue;
      const rel = v > 1 ? (v + o.v) / v : 1;
      glow(o.x - 0.7, 0.68, z, 5, 4.6, 3.8, rel, 0.3, 0.26);
      glow(o.x + 0.7, 0.68, z, 5, 4.6, 3.8, rel, 0.3, 0.26);
      glow(o.x, 0.7, z, 0.25, 0.23, 0.2, rel * 0.5, 3.0, 1.4);
    }

    // town lights
    for (const t of town) {
      let d = wrap(t[0] - sCar);
      if (d > LOOP - 80) d -= LOOP;
      if (d > 1300) continue;
      glow(t[1], t[2], -d, t[3] * t[6], t[4] * t[6], t[5] * t[6], 1, t[7], t[7], 0);
    }

    let bi = 0;
    for (const bl of blocks) {
      let d = wrap(bl[0] - sCar);
      if (d > LOOP - 80) d -= LOOP;
      if (d > 1300) continue;
      m4.compose(vPos.set(bl[1], -5.5 + bl[2] / 2, -d), q4.identity(), vScl.set(bl[4], bl[2], bl[3]));
      blockMesh.setMatrixAt(bi++, m4);
    }
    blockMesh.count = bi;
    blockMesh.instanceMatrix.needsUpdate = true;

    // gantries
    const hits: SignHit[] = [];
    GANTRIES.forEach((gd, i) => {
      let gg = gantryGroups[i];
      if (!gg) {
        gg = { g: buildGantry(gd.panels, 1, false), s: gd.s, panels: gd.panels };
        gantryGroups[i] = gg;
      }
      let d = wrap(gd.s - sCar);
      if (d > LOOP - 60) d -= LOOP;
      gg.g.visible = d < 1000;
      gg.g.position.z = -d;
      for (const p of gd.panels) {
        hits.push(hitFor(p, -d, 1));
        if (d > 0 && d < 700) {
          glow(p.x - 1, 5.02, -d + 0.5, 1.4, 1.45, 1.5, 1, 0.12, 0.06);
          glow(p.x + 1, 5.02, -d + 0.5, 1.4, 1.45, 1.5, 1, 0.12, 0.06);
        }
      }
    });
    for (const l of limits) {
      let d = wrap(l.s - sCar);
      if (d > LOOP - 60) d -= LOOP;
      l.g.visible = d < 800 && !(exitOn && d > U.uDecD.value);
      l.g.position.z = -d;
    }
    // portal
    {
      let d = wrap(T0 - sCar);
      if (d > LOOP - 400) d -= LOOP;
      portal.visible = tunVis > 0.02 && d > -2;
      portal.position.z = -d;
    }

    // exit objects
    const ex = exitOn;
    exitGantry.visible = ex && q < Q.GANTRY + 20;
    exitGantry.position.z = -(Q.GANTRY - q);
    {
      const h = hitFor(EXIT_PANEL, -(Q.GANTRY - q), 0);
      hits.push({ ...h, on: ex && h.on });
    }
    goreSign.visible = ex && q < Q.NOSE + 30;
    goreSign.position.set(-2.7, 0, -(Q.NOSE - 20 - q));
    rampRailL.uniforms.uD0.value = ex ? Q.DEC - q : 1e6;
    leftRail.uniforms.uD1.value = ex ? Q.DEC - q : 1e6;
    rampRailR.uniforms.uD0.value = ex ? Q.NOSE - 2 - q : 1e6;
    rampRailR.uniforms.uD1.value = ex ? Q.GATE - 70 - q : -1e6;
    let chi = 0;
    if (ex) {
      for (let qq = Q.CHEV0; qq <= Q.CHEV1; qq += 10) {
        const z = -(qq - q);
        if (z > 5) continue;
        m4.makeTranslation(-1.75, 1.35, z);
        chevrons.setMatrixAt(chi, m4);
        m4.compose(vPos.set(-1.75, 0.45, z - 0.03), q4.identity(), vScl.set(0.07, 0.9, 0.07));
        chevPosts.setMatrixAt(chi, m4);
        chi++;
      }
    }
    chevrons.count = chi;
    chevPosts.count = chi;
    chevrons.instanceMatrix.needsUpdate = true;
    chevPosts.instanceMatrix.needsUpdate = true;
    // ramp lamps
    const rampLamps = [106, 168, 226];
    const rl = rampMat.uniforms.uRL.value as T.Vector3[];
    rampLamps.forEach((qq, i) => {
      const z = -(qq - q);
      if (ex) {
        m4.makeTranslation(-9.9, 0, z);
        rampPoles.setMatrixAt(i, m4);
        rl[i].set(-7.6, 8.4, z);
        glow(-7.6, 8.35, z, 7, 3, 0.8, 1, 0.55, 0.4, 0);
        glow(-7.6, 8.3, z, 0.1, 0.045, 0.01, 0, 3.6, 3.6, 0);
        if (-z > 2) setHood(-7.6, 8.35, z, 3, 1.3, 0.35, 0);
      } else rl[i].set(0, 0, 1e5);
    });
    rampPoles.count = ex ? 3 : 0;
    rampPoles.instanceMatrix.needsUpdate = true;
    // gate
    gate.visible = ex;
    const gz = -(Q.GATE - q);
    gate.position.z = gz;
    bar.rotation.z = sm(Q.GATE - 34, Q.GATE - 18, q) * 1.45;
    if (ex) {
      for (let i = 0; i < 7; i++)
        for (let j = 0; j < 3; j++) glow(-9.2 + i * 1.85, 5.55, gz - 1 - j * 3.6, 2.6, 2.7, 2.8, 1, 0.5, 0.18, 0);
      const open = bar.rotation.z > 0.6;
      glow(-7.7, 1.45, gz + 2.6, open ? 0.2 : 2.6, open ? 2.4 : 0.15, open ? 0.7 : 0.08, 1, 0.11, 0.11, 0);
      // amber flasher on the crash cushion
      if (Math.sin(time * 6) > 0.2 && q < Q.NOSE + 10) glow(-1.8, 1.1, -(Q.NOSE - 20 - q) - 18, 3, 1.4, 0.05, 1, 0.16, 0.16, 0);
      if (gz < 12 && -gz < 60) setHood(-5.4, 5.5, gz - 2, 2.5, 2.6, 2.7, 0);
    }

    for (; hl < 8; hl++) hoodLc[hl].set(0, 0, 0);
    hoodMat.uniforms.uTun.value = inTun;

    glowGeo.instanceCount = gn;
    aP.needsUpdate = true;
    aC.needsUpdate = true;
    aS.needsUpdate = true;

    mComp.uniforms.uSpeed.value = Math.max(0, Math.min(1, (v - 24) / 26)) * 0.75;
    mComp.uniforms.uTime.value = time;
    mComp.uniforms.uExpo.value = 1.05 - inTun * 0.18;
    skyMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
    skyMat.uniforms.uCamWorld.value.copy(camera.matrixWorld);

    // HUD
    const next: HudFrame['next'] = [];
    const seen = new Set<SignTarget>();
    const all = GANTRIES.flatMap((g) => g.panels.map((p) => ({ t: p.target, d: wrap(g.s - sCar) })));
    all.sort((a, b) => a.d - b.d);
    for (const a of all)
      if (!seen.has(a.t)) {
        seen.add(a.t);
        next.push({ target: a.t, km: a.d / 1000 });
      }
    const tl = inTunnel(sCar) ? T1 - wrap(sCar) : 0;
    opts.onFrame({
      speed: vShown,
      rpm,
      gear,
      odo: 48213 + trip / 1000,
      trip: trip / 1000,
      blink: !reduced && blink && Math.sin(time * 9.4) > -0.1 ? blink : 0,
      phase: !exitOn ? (tl > 0 ? 'tunnel' : 'cruise') : q < Q.GATE - 45 ? 'exit' : q < Q.GATE + 12 ? 'gate' : 'arrive',
      exit: eS,
      tunnelLeft: tl,
      next,
      hits,
    });
  };

  const draw = () => {
    renderer.setRenderTarget(rtMain);
    renderer.clear();
    renderer.render(scene, camera);
    mBright.uniforms.tSrc.value = rtMain.texture;
    mBright.uniforms.uTexel.value.set(1 / rtMain.width, 1 / rtMain.height);
    pass(mBright, rtB1);
    const bw = rtB1.width;
    const bh = rtB1.height;
    mBlur.uniforms.tSrc.value = rtB1.texture;
    mBlur.uniforms.uDir.value.set(1 / bw, 0);
    pass(mBlur, rtB2);
    mBlur.uniforms.tSrc.value = rtB2.texture;
    mBlur.uniforms.uDir.value.set(0, 1 / bh);
    pass(mBlur, rtB1);
    const cw = rtC1.width;
    const ch = rtC1.height;
    mBlur.uniforms.tSrc.value = rtB1.texture;
    mBlur.uniforms.uDir.value.set(1.5 / cw, 0);
    pass(mBlur, rtC1);
    mBlur.uniforms.tSrc.value = rtC1.texture;
    mBlur.uniforms.uDir.value.set(0, 1.5 / ch);
    pass(mBlur, rtC2);
    mBlur.uniforms.tSrc.value = rtC2.texture;
    mBlur.uniforms.uDir.value.set(3 / cw, 0);
    pass(mBlur, rtC1);
    mBlur.uniforms.tSrc.value = rtC1.texture;
    mBlur.uniforms.uDir.value.set(0, 3 / ch);
    pass(mBlur, rtC2);
    mComp.uniforms.tScene.value = rtMain.texture;
    mComp.uniforms.tB1.value = rtB1.texture;
    mComp.uniforms.tB2.value = rtC2.texture;
    pass(mComp, null);
  };

  function requestRender() {
    dirty = true;
  }

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!ready) return;
    if (reduced) {
      if (!dirty) return;
      dirty = false;
      step(0.016);
      draw();
      return;
    }
    if (!visible || document.hidden) return;
    step(dt);
    draw();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '80px' });
  io.observe(host);

  let dead = false;
  void waitFonts().then(() => {
    if (dead) return;
    // redraw sign faces now that the webfonts are available
    ready = true;
    refresh();
    if (reduced) {
      time = 30;
      sCar = START + 40;
      cars[1].lane = 1;
      cars[1].x = LANE_X[1];
      cars[1].s = sCar + 140;
    }
    // pre-simulate a moment so the first frame is already in motion
    for (let i = 0; i < 8; i++) step(1 / 60);
    draw();
    opts.onReady();
  });
  // canvases drawn before fonts arrive get refreshed once they do
  const refresh = () => {
    if (dead) return;
    GANTRIES.forEach((g) =>
      g.panels.forEach((p) => {
        const t = panelTex.get(p.id);
        if (!t) return;
        t.image = drawPanel(p);
        t.needsUpdate = true;
      }),
    );
    const t = panelTex.get(EXIT_PANEL.id);
    if (t) {
      t.image = drawPanel(EXIT_PANEL);
      t.needsUpdate = true;
    }
    dirty = true;
  };
  if ('fonts' in document) void document.fonts.ready.then(refresh);
  tick();

  return {
    setProgress: (p) => {
      pTarget = Math.max(0, Math.min(1, p));
    },
    throttle: (px) => {
      if (!exitOn) pending = Math.min(240, pending + Math.abs(px) * 0.3);
    },
    dispose: () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      disposables.forEach((d) => d.dispose());
      poles.dispose();
      blockMesh.dispose();
      rampPoles.dispose();
      carBody.dispose();
      carCab.dispose();
      chevrons.dispose();
      chevPosts.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
