import * as T from 'three';
import * as G from './runner-glsl';

/**
 * MIRAI DASH — the playable top page of MIRAI GAMES.
 * A three-lane hover-racer that runs through the worlds of the studio's own
 * titles (neon city → sky islands → deep sea → planetary ring). Everything on
 * the track lives in track space and is scrolled in the vertex shaders, so the
 * CPU only touches an instance when it is recycled. Rendered through a small
 * bloom + CRT post chain (curvature, chromatic fringe, scanlines, power-on).
 */

export type RunMode = 'demo' | 'play' | 'dead' | 'still';
export type RunHud = { score: number; lives: number; combo: number; world: number; letters: number; mode: RunMode; speed: number };
export type RunEvent =
  | { t: 'world'; world: number }
  | { t: 'hit'; lives: number }
  | { t: 'letter'; letters: number; index: number }
  | { t: 'bonus'; pts: number; label: string }
  | { t: 'pause' }
  | { t: 'over'; score: number; dist: number; gems: number };
export type RunnerOpts = {
  reduced: boolean;
  narrow: boolean;
  onReady: () => void;
  onHud: (h: RunHud) => void;
  onEvent: (e: RunEvent) => void;
};
export type RunAction = 'left' | 'right' | 'jump';
export type RunnerCtl = {
  start: () => void;
  input: (a: RunAction) => void;
  setPaused: (p: boolean) => void;
  demo: () => void;
  power: () => void;
  dispose: () => void;
};

const LANES = [-2.2, 0, 2.2];
const FIRST = 300;
const SEG = 420;
const segAt = (s: number) => (s < FIRST ? 0 : 1 + Math.floor((s - FIRST) / SEG));
const segStart = (k: number) => (k <= 0 ? -1e9 : FIRST + (k - 1) * SEG);
const worldAt = (s: number) => segAt(s) % 4;
const SPAN = 230;
const BACK = 14;

type Pal = { fog: string; zen: string; hor: string; a1: string; a2: string; track: string; ground: string; den: number };
const PALS: Pal[] = [
  { fog: '#2c0f4f', zen: '#06031a', hor: '#6d1c7c', a1: '#ff3e8a', a2: '#3df2ff', track: '#0b0719', ground: '#0c0722', den: 0.0105 },
  { fog: '#e7b3c6', zen: '#3b7ade', hor: '#ffcdb6', a1: '#ffae3d', a2: '#6fd5ff', track: '#221c48', ground: '#f4dbe4', den: 0.0072 },
  { fog: '#032731', zen: '#0c5a69', hor: '#021a22', a1: '#29e0c8', a2: '#ffb35c', track: '#04121a', ground: '#0d3a3c', den: 0.017 },
  { fog: '#07050f', zen: '#020108', hor: '#170d2b', a1: '#ff7a1a', a2: '#8a7dff', track: '#0b0816', ground: '#000000', den: 0.0042 },
];
const PC = PALS.map((p) => ({
  fog: new T.Color(p.fog),
  zen: new T.Color(p.zen),
  hor: new T.Color(p.hor),
  a1: new T.Color(p.a1),
  a2: new T.Color(p.a2),
  track: new T.Color(p.track),
  ground: new T.Color(p.ground),
  den: p.den,
}));

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function glyphAtlas() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000';
  c.fillRect(0, 0, 512, 128);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  ['M', 'I', 'R', 'A'].forEach((ch, i) => {
    const x = i * 128 + 64;
    c.font = `800 78px Unbounded, "Arial Black", sans-serif`;
    c.shadowColor = '#00ff00';
    c.shadowBlur = 18;
    c.fillStyle = '#00ff00';
    c.fillText(ch, x, 68);
    c.shadowBlur = 0;
    c.fillStyle = '#ffff00';
    c.fillText(ch, x, 68);
  });
  return cv;
}

function shipGeometry() {
  const s = new T.Shape();
  const pts: [number, number][] = [
    [0, 1.85],
    [0.26, 1.05],
    [0.46, 0.25],
    [1.0, -0.45],
    [1.04, -0.82],
    [0.56, -0.72],
    [0.42, -1.0],
    [0, -0.86],
  ];
  const all = [...pts, ...pts.slice(1, -1).reverse().map(([x, y]) => [-x, y] as [number, number])];
  s.moveTo(all[0][0], all[0][1]);
  all.slice(1).forEach(([x, y]) => s.lineTo(x, y));
  s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 3, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  return g;
}

export function mountRunner(host: HTMLElement, opts: RunnerOpts): RunnerCtl | null {
  const { reduced, narrow } = opts;
  let renderer: T.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    return null;
  }
  const dpr = Math.min(devicePixelRatio || 1, narrow ? 1.35 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const disposables: { dispose: () => void }[] = [];
  const track = <X extends { dispose: () => void }>(x: X) => {
    disposables.push(x);
    return x;
  };
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 1400);

  const U = {
    uDist: { value: 0 },
    uTime: { value: 0 },
    uBendY: { value: 0.0011 },
    uBendX: { value: 0 },
    uFog: { value: PC[0].fog.clone() },
    uFogDen: { value: PC[0].den },
    uW: { value: new T.Vector4(1, 0, 0, 0) },
    uA1: { value: PC[0].a1.clone() },
    uA2: { value: PC[0].a2.clone() },
    uHor: { value: PC[0].hor.clone() },
    uZen: { value: PC[0].zen.clone() },
  };
  const mat = (vs: string, fs: string, extra: Partial<T.ShaderMaterialParameters> = {}, uniforms: Record<string, T.IUniform> = {}) =>
    track(new T.ShaderMaterial({ vertexShader: G.withSst(vs), fragmentShader: G.withSst(fs), uniforms: { ...U, ...uniforms }, ...extra }));

  // ── sky ────────────────────────────────────────────────────────────────
  const skyGeo = track(new T.SphereGeometry(900, 48, 24));
  const sky = new T.Mesh(skyGeo, mat(G.SKY_VS, G.SKY_FS, { side: T.BackSide, depthWrite: false }));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // ── floor ──────────────────────────────────────────────────────────────
  const floorGeo = track(new T.PlaneGeometry(90, 420, 45, 210));
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(0, 0, -200);
  const floorU = { uTrack: { value: PC[0].track.clone() }, uGround: { value: PC[0].ground.clone() } };
  const floor = new T.Mesh(floorGeo, mat(G.FLOOR_VS, G.FLOOR_FS, {}, floorU));
  floor.frustumCulled = false;
  scene.add(floor);

  // ── props for each world ───────────────────────────────────────────────
  type Prop = { mesh: T.InstancedMesh; seed: T.InstancedBufferAttribute; world: number; spacing: number; place: (i: number, s: number, r: () => number) => void; items: number[] };
  const props: Prop[] = [];
  const dummy = new T.Object3D();
  const HIDE = new T.Matrix4().makeScale(0, 0, 0);
  const addProp = (
    geo: T.BufferGeometry,
    kind: number,
    world: number,
    count: number,
    place: (d: T.Object3D, r: () => number, s: number, i: number) => void,
    blend: 'add' | 'solid' = 'solid',
  ) => {
    track(geo);
    const m = new T.InstancedMesh(
      geo,
      mat(G.PROP_VS(kind), G.PROP_FS(kind), blend === 'add' ? { transparent: true, blending: T.AdditiveBlending, depthWrite: false } : {}),
      count,
    );
    const seed = new T.InstancedBufferAttribute(new Float32Array(count), 1);
    seed.setUsage(T.DynamicDrawUsage);
    geo.setAttribute('aSeed', seed);
    m.instanceMatrix.setUsage(T.DynamicDrawUsage);
    m.frustumCulled = false;
    scene.add(m);
    const p: Prop = {
      mesh: m,
      seed,
      world,
      spacing: SPAN / count,
      items: new Array(count).fill(0),
      place: (i, s, r) => {
        p.items[i] = s;
        seed.array[i] = r();
        if (worldAt(s) !== world) {
          m.setMatrixAt(i, HIDE);
        } else {
          dummy.position.set(0, 0, -s);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          place(dummy, r, s, i);
          dummy.position.z = -s;
          dummy.updateMatrix();
          m.setMatrixAt(i, dummy.matrix);
        }
      },
    };
    props.push(p);
    return p;
  };
  const side = (r: () => number) => (r() < 0.5 ? -1 : 1);

  // NEON ASTRAY: towers
  {
    const g = new T.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    addProp(g, 0, 0, narrow ? 70 : 96, (d, r) => {
      const sd = side(r);
      const far = r();
      const w = 2.2 + r() * 3.6;
      d.position.x = sd * (6.4 + w / 2 + far * far * 26);
      d.position.y = -1.5;
      d.scale.set(w, 5 + r() * (far > 0.4 ? 30 : 14), 2 + r() * 4);
    });
  }
  // SKYSHARD: floating islands
  {
    const cone = new T.ConeGeometry(1, 1.6, 7, 3);
    cone.rotateX(Math.PI);
    cone.translate(0, -0.8, 0);
    const top = new T.CylinderGeometry(1.02, 1, 0.2, 7, 1);
    top.translate(0, 0.02, 0);
    const pos = cone.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const k = 1 + Math.sin(i * 12.9898) * 0.14 * (y < -0.1 ? 1 : 0);
      pos.setX(i, pos.getX(i) * k);
      pos.setZ(i, pos.getZ(i) * k);
    }
    const merged = mergeGeos([cone.toNonIndexed(), top.toNonIndexed()]);
    cone.dispose();
    top.dispose();
    addProp(merged, 1, 1, 34, (d, r) => {
      const sd = side(r);
      const sc = 1.4 + r() * r() * 7;
      d.position.x = sd * (6.5 + sc + r() * 36);
      d.position.y = -4 + r() * 12;
      d.rotation.y = r() * 6.28;
      d.scale.set(sc, sc * (0.8 + r() * 0.6), sc);
    });
  }
  // ABYSS LANTERN: kelp forest + glowing jellies
  {
    const g = new T.CylinderGeometry(0.1, 0.28, 1, 5, 14);
    g.translate(0, 0.5, 0);
    addProp(g, 2, 2, narrow ? 70 : 100, (d, r) => {
      const sd = side(r);
      d.position.x = sd * (4.4 + r() * r() * 24);
      d.position.y = -0.4;
      const h = 4 + r() * 11;
      d.scale.set(1 + r(), h, 1 + r());
      d.rotation.y = r() * 6.28;
    });
    const o = new T.SphereGeometry(0.5, 16, 10);
    addProp(
      o,
      4,
      2,
      34,
      (d, r) => {
        const sd = side(r);
        d.position.x = sd * (3.8 + r() * 18);
        d.position.y = 1.5 + r() * 8;
        const sc = 0.5 + r() * 1.3;
        d.scale.set(sc, sc * 0.75, sc);
      },
      'add',
    );
  }
  // ORBIT RALLY: asteroids
  {
    const g = new T.IcosahedronGeometry(1, 2);
    const pos = g.attributes.position;
    const v = new T.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = 1 + 0.22 * Math.sin(v.x * 3.1 + v.y * 1.7) * Math.cos(v.z * 2.3 - v.x) + 0.1 * Math.sin(v.y * 7 + v.z * 5);
      v.multiplyScalar(n);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    addProp(g, 3, 3, 56, (d, r) => {
      const sd = side(r);
      const sc = 0.4 + r() * r() * 4.2;
      d.position.x = sd * (5.5 + sc + r() * 40);
      d.position.y = -9 + r() * 24;
      d.rotation.set(r() * 6, r() * 6, r() * 6);
      d.scale.set(sc, sc * (0.7 + r() * 0.5), sc);
    });
  }
  // gates over the track (a different frame for each world)
  const gateSeg = [4, 6, 40, 3];
  gateSeg.forEach((seg, w) => {
    const g = new T.TorusGeometry(5.3, w === 2 ? 0.11 : 0.16, 6, seg);
    addProp(
      g,
      5,
      w,
      4,
      (d, _r, s) => {
        d.position.x = 0;
        d.position.y = w === 3 ? 2.6 : 2.2;
        d.rotation.z = seg === 4 ? Math.PI / 4 : seg === 3 ? Math.PI / 2 : seg === 6 ? Math.PI / 6 : 0;
        d.scale.set(seg === 4 ? 1.02 : 1, seg === 4 ? 0.82 : 1, 1);
      },
      'add',
    );
  });
  props.forEach((p) => (p.spacing = SPAN / p.items.length));
  // gates are sparse
  props.slice(-4).forEach((p) => (p.spacing = 58));

  // ── obstacles & pickups ────────────────────────────────────────────────
  const barrierGeo = track(new T.BoxGeometry(1, 1, 1));
  barrierGeo.translate(0, 0.5, 0);
  const oMat0 = mat(G.OBST_VS, G.OBST_FS(0));
  const oMat1 = mat(G.OBST_VS, G.OBST_FS(1), { transparent: true, depthWrite: false, side: T.DoubleSide });
  const POOL = 26;
  const barriers = new T.InstancedMesh(barrierGeo, oMat0, POOL);
  const walls = new T.InstancedMesh(barrierGeo, oMat1, POOL);
  [barriers, walls].forEach((m) => {
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(T.DynamicDrawUsage);
    for (let i = 0; i < POOL; i++) m.setMatrixAt(i, HIDE);
    scene.add(m);
  });
  walls.renderOrder = 5;
  const gemGeo = track(new T.OctahedronGeometry(0.42, 0));
  gemGeo.scale(1, 1.35, 1);
  const GEMS = 96;
  const gemSeed = new T.InstancedBufferAttribute(new Float32Array(GEMS).map(() => Math.random()), 1);
  gemGeo.setAttribute('aSeed', gemSeed);
  const gems = new T.InstancedMesh(gemGeo, mat(G.GEM_VS, G.GEM_FS), GEMS);
  gems.frustumCulled = false;
  gems.instanceMatrix.setUsage(T.DynamicDrawUsage);
  for (let i = 0; i < GEMS; i++) gems.setMatrixAt(i, HIDE);
  scene.add(gems);
  const atlas = track(new T.CanvasTexture(glyphAtlas()));
  atlas.colorSpace = T.NoColorSpace;
  const glyphGeo = track(new T.PlaneGeometry(1, 1));
  const glyphIdx = new T.InstancedBufferAttribute(new Float32Array(3), 1);
  glyphGeo.setAttribute('aGlyph', glyphIdx);
  const glyphs = new T.InstancedMesh(glyphGeo, mat(G.GLYPH_VS, G.GLYPH_FS, { transparent: true, blending: T.AdditiveBlending, depthWrite: false }, { tAtlas: { value: atlas } }), 3);
  glyphs.frustumCulled = false;
  for (let i = 0; i < 3; i++) glyphs.setMatrixAt(i, HIDE);
  scene.add(glyphs);

  // ── the ship ───────────────────────────────────────────────────────────
  const shipU = {
    uA1: U.uA1,
    uA2: U.uA2,
    uHor: U.uHor,
    uZen: U.uZen,
    uTime: U.uTime,
    uBody: { value: new T.Color('#e9e5ff') },
    uGlass: { value: 0 },
    uBlink: { value: 0 },
  };
  const shipMat = track(new T.ShaderMaterial({ vertexShader: G.SHIP_VS, fragmentShader: G.withSst(G.SHIP_FS), uniforms: shipU }));
  const glassMat = track(new T.ShaderMaterial({ vertexShader: G.SHIP_VS, fragmentShader: G.withSst(G.SHIP_FS), uniforms: { ...shipU, uGlass: { value: 1 } } }));
  const ship = new T.Group();
  const hull = new T.Mesh(track(shipGeometry()), shipMat);
  hull.position.y = 0;
  ship.add(hull);
  const canopyGeo = track(new T.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
  const canopy = new T.Mesh(canopyGeo, glassMat);
  canopy.scale.set(0.62, 0.5, 1.5);
  canopy.position.set(0, 0.3, -0.1);
  ship.add(canopy);
  const podGeo = track(new T.CylinderGeometry(0.15, 0.19, 0.62, 12));
  podGeo.rotateX(Math.PI / 2);
  const finGeo = track(new T.BoxGeometry(0.06, 0.42, 0.5));
  [-1, 1].forEach((sd) => {
    const pod = new T.Mesh(podGeo, shipMat);
    pod.position.set(sd * 0.46, 0.14, 0.62);
    ship.add(pod);
    const fin = new T.Mesh(finGeo, shipMat);
    fin.position.set(sd * 0.56, 0.42, 0.68);
    fin.rotation.z = sd * -0.35;
    ship.add(fin);
  });
  const quad = track(new T.PlaneGeometry(1, 1));
  const flareU = { uColor: { value: U.uA1.value }, uAmt: { value: 1 } };
  const flareMat = track(new T.ShaderMaterial({ vertexShader: G.FLARE_VS, fragmentShader: G.FLARE_FS, uniforms: flareU, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  const flares = [-1, 1].map((sd) => {
    const f = new T.Mesh(quad, flareMat);
    f.position.set(sd * 0.46, 0.14, 1.0);
    f.scale.set(0.8, 0.55, 1);
    f.renderOrder = 8;
    ship.add(f);
    return f;
  });
  scene.add(ship);
  const blobMat = track(new T.ShaderMaterial({ vertexShader: G.PLAIN_VS, fragmentShader: G.withSst(G.BLOB_FS), uniforms: { uAmt: { value: 1 } }, transparent: true, depthWrite: false }));
  const blob = new T.Mesh(quad, blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.scale.set(2.4, 3.6, 1);
  blob.position.y = 0.03;
  scene.add(blob);

  // engine trails
  const TN = 30;
  const trailPts = [-1, 1].map(() => Array.from({ length: TN }, () => new T.Vector3(0, 0.14, 1)));
  const trailGeo = track(new T.BufferGeometry());
  const trailPos = new Float32Array(2 * TN * 2 * 3);
  const trailT = new Float32Array(2 * TN * 2);
  const trailUv = new Float32Array(2 * TN * 2 * 2);
  const trailIdx: number[] = [];
  for (let k = 0; k < 2; k++)
    for (let i = 0; i < TN; i++) {
      const b = (k * TN + i) * 2;
      trailT[b] = trailT[b + 1] = i / (TN - 1);
      trailUv[b * 2 + 1] = 0;
      trailUv[b * 2 + 3] = 1;
      if (i < TN - 1) trailIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  trailGeo.setAttribute('position', new T.BufferAttribute(trailPos, 3).setUsage(T.DynamicDrawUsage));
  trailGeo.setAttribute('aT', new T.BufferAttribute(trailT, 1));
  trailGeo.setAttribute('uv', new T.BufferAttribute(trailUv, 2));
  trailGeo.setIndex(trailIdx);
  const trailMat = track(
    new T.ShaderMaterial({ vertexShader: G.TRAIL_VS, fragmentShader: G.withSst(G.TRAIL_FS), uniforms: { uA1: U.uA1, uA2: U.uA2, uAmt: { value: 1 } }, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }),
  );
  const trail = new T.Mesh(trailGeo, trailMat);
  trail.frustumCulled = false;
  scene.add(trail);

  // sparks
  const SPARKS = 320;
  const spGeo = track(new T.BufferGeometry());
  const spPos = new Float32Array(SPARKS * 3);
  const spVel = new Float32Array(SPARKS * 3);
  const spCol = new Float32Array(SPARKS * 3);
  const spLife = new Float32Array(SPARKS);
  spGeo.setAttribute('position', new T.BufferAttribute(spPos, 3).setUsage(T.DynamicDrawUsage));
  spGeo.setAttribute('aColor', new T.BufferAttribute(spCol, 3).setUsage(T.DynamicDrawUsage));
  spGeo.setAttribute('aLife', new T.BufferAttribute(spLife, 1).setUsage(T.DynamicDrawUsage));
  const spMat = track(
    new T.ShaderMaterial({ vertexShader: G.SPARK_VS, fragmentShader: G.withSst(G.SPARK_FS), uniforms: { uPx: { value: 1 } }, transparent: true, blending: T.AdditiveBlending, depthWrite: false }),
  );
  const sparks = new T.Points(spGeo, spMat);
  sparks.frustumCulled = false;
  scene.add(sparks);
  let spHead = 0;
  const burst = (x: number, y: number, z: number, n: number, col: T.Color, sp: number, up = 0) => {
    for (let k = 0; k < n; k++) {
      const i = spHead;
      spHead = (spHead + 1) % SPARKS;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(Math.random() * 2 - 1);
      const v = sp * (0.35 + Math.random() * 0.65);
      spPos.set([x, y, z], i * 3);
      spVel.set([Math.sin(b) * Math.cos(a) * v, Math.abs(Math.cos(b)) * v * 0.8 + up, Math.sin(b) * Math.sin(a) * v], i * 3);
      const w = Math.random() * 0.5;
      spCol.set([col.r + (1 - col.r) * w, col.g + (1 - col.g) * w, col.b + (1 - col.b) * w], i * 3);
      spLife[i] = 0.6 + Math.random() * 0.6;
    }
  };

  // speed streaks
  const STREAKS = narrow ? 70 : 130;
  const stGeo = track(new T.BufferGeometry());
  const stPos = new Float32Array(STREAKS * 2 * 3);
  const stEnd = new Float32Array(STREAKS * 2);
  const rs = mulberry(7);
  for (let i = 0; i < STREAKS; i++) {
    const sd = rs() < 0.5 ? -1 : 1;
    const x = sd * (4.2 + rs() * 12);
    const y = 0.4 + rs() * 8;
    const z = rs() * 110;
    stPos.set([x, y, z, x, y, z], i * 6);
    stEnd[i * 2 + 1] = 1;
  }
  stGeo.setAttribute('position', new T.BufferAttribute(stPos, 3));
  stGeo.setAttribute('aEnd', new T.BufferAttribute(stEnd, 1));
  const stMat = track(
    new T.ShaderMaterial({
      vertexShader: G.withSst(G.STREAK_VS),
      fragmentShader: G.STREAK_FS,
      uniforms: { uDist: U.uDist, uLen: { value: 3 }, uColor: { value: U.uA2.value }, uAmt: { value: 0.5 } },
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const streaks = new T.LineSegments(stGeo, stMat);
  streaks.frustumCulled = false;
  scene.add(streaks);

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
  const mBright = track(new T.ShaderMaterial({ uniforms: { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uThresh: { value: 0.72 } }, vertexShader: G.POST_VS, fragmentShader: G.withSst(G.BRIGHT_FS), depthTest: false }));
  const mBlur = track(new T.ShaderMaterial({ uniforms: { tSrc: { value: null }, uDir: { value: new T.Vector2() } }, vertexShader: G.POST_VS, fragmentShader: G.BLUR_FS, depthTest: false }));
  const CU = {
    tScene: { value: null as T.Texture | null },
    tB1: { value: null as T.Texture | null },
    tB2: { value: null as T.Texture | null },
    uRes: { value: new T.Vector2(1, 1) },
    uTime: U.uTime,
    uCurve: { value: narrow ? 0.018 : 0.035 },
    uAberr: { value: 0.25 },
    uHit: { value: 0 },
    uPower: { value: reduced ? 1 : 0 },
    uScanPx: { value: 1.5 },
    uScan: { value: 0.16 },
    uGrain: { value: reduced ? 0.012 : 0.03 },
  };
  const mComp = track(new T.ShaderMaterial({ uniforms: CU, vertexShader: G.POST_VS, fragmentShader: G.withSst(G.COMP_FS), depthTest: false }));
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
  let camDist = 6.4;
  let camH = 3.1;
  let baseFov = 60;
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
    const asp = W / H;
    camera.aspect = asp;
    baseFov = asp < 1 ? 62 + Math.min(1, (1 - asp) / 0.55) * 18 : 58;
    const half = Math.tan(T.MathUtils.degToRad(baseFov / 2)) * asp;
    camDist = Math.min(11.5, Math.max(6.4, 3.9 / half));
    camH = 2.3 + camDist * 0.13;
    CU.uRes.value.set(pw, ph);
    CU.uScanPx.value = 1.5 * dpr;
    spMat.uniforms.uPx.value = H * dpr * 0.06;
    dirty = true;
  };

  // ── simulation state ───────────────────────────────────────────────────
  let rand = mulberry(1234);
  let mode: RunMode = reduced ? 'still' : 'demo';
  let paused = false;
  let dist = 0;
  let v = 22;
  let vTarget = 22;
  let time = 0;
  let lane = 1;
  let x = 0;
  let y = 0;
  let vy = 0;
  let lives = 3;
  let inv = 0;
  let score = 0;
  let gemsGot = 0;
  let chain = 0;
  let chainT = 0;
  let letters = 0;
  let seg = 0;
  let shake = 0;
  let hitFx = 0;
  let deadT = 0;
  let nextRow = 0;
  let letterCool = 0;
  let aiCool = 0;
  let power = reduced ? 1 : 0;
  let powerOn = reduced;
  let dirty = true;
  let ready = false;
  let visible = true;
  let jumpBuf = 0;

  type Ent = { kind: 'barrier' | 'wall' | 'gem' | 'glyph'; s: number; lane: number; y: number; idx: number; alive: boolean; g?: number };
  const ents: Ent[] = [];
  const freeB: number[] = [];
  const freeW: number[] = [];
  const freeG: number[] = [];
  const freeL: number[] = [];

  const setInst = (m: T.InstancedMesh, i: number, px: number, py: number, s: number, sx: number, sy: number, sz: number) => {
    dummy.position.set(px, py, -s);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    m.instanceMatrix.needsUpdate = true;
  };
  const spawn = (kind: Ent['kind'], ln: number, s: number, yy = 0.7, g = 0) => {
    const pool = kind === 'barrier' ? freeB : kind === 'wall' ? freeW : kind === 'gem' ? freeG : freeL;
    const idx = pool.pop();
    if (idx === undefined) return;
    const e: Ent = { kind, s, lane: ln, y: yy, idx, alive: true, g };
    ents.push(e);
    const lx = LANES[ln];
    if (kind === 'barrier') setInst(barriers, idx, lx, 0, s, 1.9, 0.9, 0.36);
    else if (kind === 'wall') setInst(walls, idx, lx, 0, s, 1.9, 2.9, 0.5);
    else if (kind === 'gem') setInst(gems, idx, lx, yy, s, 1, 1, 1);
    else {
      setInst(glyphs, idx, lx, 1.3, s, 1.7, 1.7, 1.7);
      glyphIdx.array[idx] = g;
      glyphIdx.needsUpdate = true;
    }
  };
  const kill = (e: Ent) => {
    if (!e.alive) return;
    e.alive = false;
    const m = e.kind === 'barrier' ? barriers : e.kind === 'wall' ? walls : e.kind === 'gem' ? gems : glyphs;
    m.setMatrixAt(e.idx, HIDE);
    m.instanceMatrix.needsUpdate = true;
    (e.kind === 'barrier' ? freeB : e.kind === 'wall' ? freeW : e.kind === 'gem' ? freeG : freeL).push(e.idx);
  };
  const gemLine = (ln: number, s: number, n: number) => {
    for (let i = 0; i < n; i++) spawn('gem', ln, s + i * 2.6, 0.75);
  };
  const LETTER_G = [0, 1, 2, 3, 1];
  const nextLetter = () => {
    for (let i = 0; i < 5; i++) if (!(letters & (1 << i))) return i;
    return -1;
  };

  const row = (s: number) => {
    const d = Math.min(1, dist / 1600);
    const r = rand();
    const L = Math.floor(rand() * 3);
    const other = (a: number, b = -1) => [0, 1, 2].filter((k) => k !== a && k !== b)[Math.floor(rand() * (b < 0 ? 2 : 1))];
    if (s < 70) {
      gemLine(Math.floor(rand() * 3), s, 5);
      return;
    }
    const nl = nextLetter();
    if (nl >= 0 && letterCool <= 0 && rand() < 0.16) {
      letterCool = 3;
      spawn('glyph', L, s, 1.3, LETTER_G[nl]);
      glyphLetter.set(s, nl);
      if (rand() < 0.6) spawn('barrier', other(L), s);
      return;
    }
    letterCool--;
    if (r < 0.22) {
      spawn('wall', L, s);
      gemLine(other(L), s - 6, 5);
    } else if (r < 0.4) {
      spawn('barrier', L, s);
      for (let i = -2; i <= 2; i++) spawn('gem', L, s + i * 1.8, 0.8 + (1 - (i * i) / 4) * 1.5);
    } else if (r < 0.58) {
      const free = L;
      [0, 1, 2].forEach((k) => k !== free && spawn('wall', k, s));
      gemLine(free, s - 5, 4);
    } else if (r < 0.66 + d * 0.08) {
      [0, 1, 2].forEach((k) => spawn('barrier', k, s));
      spawn('gem', 1, s, 2.4);
    } else if (r < 0.84) {
      const a = other(L);
      spawn('wall', L, s);
      spawn('barrier', a, s);
      gemLine([0, 1, 2].find((k) => k !== L && k !== a)!, s - 4, 4);
    } else {
      let ln = L;
      for (let i = 0; i < 6; i++) {
        spawn('gem', ln, s + i * 2.8, 0.75);
        if (i % 2 === 1) ln = Math.max(0, Math.min(2, ln + (rand() < 0.5 ? -1 : 1)));
      }
    }
  };
  const glyphLetter = new Map<number, number>();

  const resetRun = (seed: number) => {
    rand = mulberry(seed);
    ents.forEach(kill);
    ents.length = 0;
    freeB.length = 0;
    freeW.length = 0;
    freeG.length = 0;
    freeL.length = 0;
    for (let i = POOL - 1; i >= 0; i--) {
      freeB.push(i);
      freeW.push(i);
      barriers.setMatrixAt(i, HIDE);
      walls.setMatrixAt(i, HIDE);
    }
    for (let i = GEMS - 1; i >= 0; i--) {
      freeG.push(i);
      gems.setMatrixAt(i, HIDE);
    }
    for (let i = 2; i >= 0; i--) {
      freeL.push(i);
      glyphs.setMatrixAt(i, HIDE);
    }
    [barriers, walls, gems, glyphs].forEach((m) => (m.instanceMatrix.needsUpdate = true));
    glyphLetter.clear();
    dist = 0;
    v = vTarget = 20;
    lane = 1;
    x = 0;
    y = 0;
    vy = 0;
    lives = 3;
    inv = 0;
    score = 0;
    gemsGot = 0;
    chain = 0;
    chainT = 0;
    letters = 0;
    seg = 0;
    nextRow = 40;
    letterCool = 2;
    deadT = 0;
    ship.visible = true;
    trailPts.forEach((pts) => pts.forEach((p) => p.set(0, 0.14, 1)));
    // props
    const pr = mulberry(seed * 7 + 3);
    props.forEach((p) => {
      for (let i = 0; i < p.items.length; i++) p.place(i, -BACK + i * p.spacing + pr() * p.spacing * 0.9, pr);
      p.mesh.instanceMatrix.needsUpdate = true;
      p.seed.needsUpdate = true;
    });
  };

  const envW = new T.Vector4();
  const tmpC = new T.Color();
  const applyEnv = () => {
    const k = segAt(dist);
    let a = k % 4;
    let b = a;
    let t = 0;
    const next = segStart(k + 1);
    const start = segStart(k);
    if (dist > next - 45) {
      b = (k + 1) % 4;
      t = (dist - (next - 45)) / 90;
    } else if (k > 0 && dist < start + 45) {
      a = (k - 1) % 4;
      b = k % 4;
      t = (dist - (start - 45)) / 90;
    }
    t = Math.max(0, Math.min(1, t));
    t = t * t * (3 - 2 * t);
    envW.set(0, 0, 0, 0);
    envW.setComponent(a, 1 - t);
    envW.setComponent(b, envW.getComponent(b) + t);
    U.uW.value.copy(envW);
    const A = PC[a];
    const B = PC[b];
    U.uFog.value.copy(A.fog).lerp(B.fog, t);
    U.uZen.value.copy(A.zen).lerp(B.zen, t);
    U.uHor.value.copy(A.hor).lerp(B.hor, t);
    U.uA1.value.copy(A.a1).lerp(B.a1, t);
    U.uA2.value.copy(A.a2).lerp(B.a2, t);
    floorU.uTrack.value.copy(A.track).lerp(B.track, t);
    floorU.uGround.value.copy(A.ground).lerp(B.ground, t);
    U.uFogDen.value = A.den + (B.den - A.den) * t;
    // brighter worlds bloom less
    const lum = tmpC.copy(U.uFog.value).getHSL({ h: 0, s: 0, l: 0 }).l;
    mBright.uniforms.uThresh.value = 0.72 + lum * 0.45;
  };

  const act = (a: RunAction) => {
    if (a === 'left') lane = Math.max(0, lane - 1);
    else if (a === 'right') lane = Math.min(2, lane + 1);
    else jumpBuf = 0.16;
  };

  const ai = (dt: number) => {
    aiCool -= dt;
    const look = v * 0.95 + 6;
    const rowAhead = (ln: number, maxZ: number) => ents.filter((e) => e.alive && e.lane === ln && (e.kind === 'wall' || e.kind === 'barrier') && e.s - dist > -0.5 && e.s - dist < maxZ);
    const mine = rowAhead(lane, look);
    const wall = mine.find((e) => e.kind === 'wall');
    if (wall && aiCool <= 0) {
      const opts = [lane - 1, lane + 1].filter((k) => k >= 0 && k <= 2 && !rowAhead(k, wall.s - dist + 3).some((e) => e.kind === 'wall'));
      if (opts.length) {
        lane = opts[Math.floor(Math.random() * opts.length)];
        aiCool = 0.25;
      }
    }
    const bar = mine.find((e) => e.kind === 'barrier');
    if (bar && y < 0.05 && bar.s - dist < v * 0.28 + 1.4) jumpBuf = 0.1;
    if (!wall && aiCool <= 0 && Math.random() < dt * 0.8) {
      const gl = ents.find((e) => e.alive && e.kind === 'gem' && e.s - dist > 8 && e.s - dist < 26 && e.lane !== lane);
      if (gl && Math.abs(gl.lane - lane) === 1 && !rowAhead(gl.lane, 28).some((e) => e.kind === 'wall')) {
        lane = gl.lane;
        aiCool = 0.5;
      }
    }
  };

  const hit = (e: Ent) => {
    kill(e);
    const col = e.kind === 'wall' ? new T.Color(1, 0.25, 0.45) : new T.Color(1, 0.8, 0.2);
    burst(LANES[e.lane], 0.8, 0, 40, col, 9, 2);
    if (!reduced) shake = 0.5;
    hitFx = 1;
    if (mode === 'demo') return;
    lives -= 1;
    inv = 1.5;
    chain = 0;
    v *= 0.55;
    opts.onEvent({ t: 'hit', lives });
    if (lives <= 0) {
      mode = 'dead';
      deadT = 0;
      ship.visible = false;
      burst(x, y + 0.4, 0, 90, U.uA1.value, 12, 3);
      burst(x, y + 0.4, 0, 50, new T.Color(1, 1, 1), 7, 2);
    }
  };

  const step = (dt: number) => {
    time += dt;
    U.uTime.value = time;
    if (!powerOn) return;
    if (mode === 'demo' || mode === 'play') {
      const base = mode === 'demo' ? 24 : Math.min(38, 19 + dist * 0.0105);
      vTarget = base;
      v += (vTarget - v) * (1 - Math.exp(-dt * (v < vTarget ? 0.9 : 3)));
    } else if (mode === 'dead') {
      v *= Math.exp(-dt * 2.2);
      deadT += dt;
      if (deadT > 1.6 && deadT - dt <= 1.6) opts.onEvent({ t: 'over', score: Math.floor(score), dist: Math.floor(dist), gems: gemsGot });
    }
    const prev = dist;
    dist += v * dt;
    U.uDist.value = dist;
    U.uBendX.value = Math.sin(dist * 0.0045) * 0.0011 + Math.sin(dist * 0.0017 + 1.3) * 0.0006;

    // world change
    const k = segAt(dist);
    if (k !== seg) {
      seg = k;
      opts.onEvent({ t: 'world', world: k % 4 });
      if (mode === 'play') score += 1000;
    }
    applyEnv();

    // spawn rows ahead, recycle behind
    if (mode !== 'dead')
      while (nextRow < dist + 190) {
        row(nextRow);
        const d = Math.min(1, dist / 1600);
        nextRow += Math.max(15, 23 - d * 7) + rand() * 7;
      }
    for (let i = ents.length - 1; i >= 0; i--) {
      const e = ents[i];
      if (!e.alive || e.s < dist - 6) {
        kill(e);
        ents.splice(i, 1);
      }
    }
    for (const p of props) {
      let changed = false;
      for (let i = 0; i < p.items.length; i++) {
        if (p.items[i] < dist - BACK) {
          p.place(i, p.items[i] + p.items.length * p.spacing, rand);
          changed = true;
        }
      }
      if (changed) {
        p.mesh.instanceMatrix.needsUpdate = true;
        p.seed.needsUpdate = true;
      }
    }

    // player
    if (mode === 'demo') ai(dt);
    const tx = LANES[lane];
    const px = x;
    x += (tx - x) * (1 - Math.exp(-dt * 13));
    jumpBuf -= dt;
    if (jumpBuf > 0 && y <= 0.001 && mode !== 'dead') {
      vy = 10.6;
      jumpBuf = 0;
      burst(x, 0.1, 0.6, 10, U.uA2.value, 3);
    }
    vy -= 30 * dt;
    y = Math.max(0, y + vy * dt);
    if (y === 0) vy = 0;
    inv = Math.max(0, inv - dt);
    chainT -= dt;
    if (chainT <= 0) chain = 0;

    // collisions
    if (mode === 'play' || mode === 'demo') {
      for (const e of ents) {
        if (!e.alive) continue;
        const zNow = e.s - dist;
        const zPrev = e.s - prev;
        if (zNow > 3 || zPrev < -3) continue;
        const lx = LANES[e.lane];
        if (e.kind === 'gem' || e.kind === 'glyph') {
          const r = e.kind === 'glyph' ? 1.3 : 1.0;
          if (zPrev >= -r && zNow <= r && Math.abs(x - lx) < 1.05 && Math.abs(y + 0.45 - e.y) < 1.25) {
            kill(e);
            if (e.kind === 'gem') {
              gemsGot++;
              chain++;
              chainT = 1.3;
              const mult = Math.min(8, 1 + Math.floor(chain / 5));
              if (mode === 'play') score += 50 * mult;
              burst(lx, e.y, 0, 14, new T.Color(1, 0.85, 0.35), 4.5);
            } else {
              const li = glyphLetter.get(e.s) ?? nextLetter();
              if (li >= 0) letters |= 1 << li;
              burst(lx, 1.3, 0, 36, U.uA2.value, 6, 1);
              if (mode === 'play') {
                score += 500;
                opts.onEvent({ t: 'letter', letters, index: li });
                if (letters === 31) {
                  score += 5000;
                  opts.onEvent({ t: 'bonus', pts: 5000, label: 'MIRAI BONUS' });
                  letters = 0;
                }
              } else if (letters === 31) letters = 0;
            }
          }
        } else if (inv <= 0) {
          const hd = e.kind === 'wall' ? 0.25 : 0.18;
          const r = hd + 0.85;
          if (zPrev >= -r && zNow <= r && Math.abs(x - lx) < 1.3 && (e.kind === 'wall' || y < 0.82)) hit(e);
        }
      }
    }
    if (mode === 'play') score += (dist - prev) * 1.0;

    // ship pose
    const bank = (x - px) / Math.max(dt, 1e-3);
    ship.position.set(x, 0.42 + y + (reduced ? 0 : Math.sin(time * 5.2) * 0.05), 0);
    ship.rotation.set(-vy * 0.018, 0, -bank * 0.035);
    shipU.uBlink.value = inv > 0 ? (Math.sin(time * 40) > 0 ? 0.8 : 0) : 0;
    blob.position.x = x;
    blobMat.uniforms.uAmt.value = 1 / (1 + y * 0.9);
    blob.scale.set(2.4 * (1 + y * 0.15), 3.6 * (1 + y * 0.15), 1);
    const boost = Math.min(1, Math.max(0, (v - 16) / 20));
    flareU.uAmt.value = 0.45 + boost * 0.4 + Math.sin(time * 30) * 0.05;
    flares.forEach((f) => f.scale.set(0.7 + boost * 0.5, 0.45 + boost * 0.2, 1));

    // trails: points ride with the track
    ship.updateMatrixWorld();
    const ep = new T.Vector3();
    trailPts.forEach((pts, k) => {
      for (const p of pts) p.z += v * dt;
      ep.set(k === 0 ? -0.46 : 0.46, 0.14, 0.95).applyMatrix4(ship.matrixWorld);
      pts.pop();
      const last = pts[pts.length - 1];
      last.copy(ep);
      pts.unshift(last);
      for (let i = 0; i < TN; i++) {
        const p = pts[i];
        const w = 0.13 * (1 - i / TN) + 0.02;
        const b = (k * TN + i) * 2 * 3;
        trailPos[b] = p.x - w;
        trailPos[b + 1] = p.y;
        trailPos[b + 2] = p.z;
        trailPos[b + 3] = p.x + w;
        trailPos[b + 4] = p.y;
        trailPos[b + 5] = p.z;
      }
    });
    trailGeo.attributes.position.needsUpdate = true;
    trailMat.uniforms.uAmt.value = ship.visible ? 0.4 + boost * 0.45 : 0;

    // sparks
    for (let i = 0; i < SPARKS; i++) {
      if (spLife[i] <= 0) continue;
      spLife[i] -= dt;
      spVel[i * 3 + 1] -= 9 * dt;
      spPos[i * 3] += spVel[i * 3] * dt;
      spPos[i * 3 + 1] = Math.max(0.05, spPos[i * 3 + 1] + spVel[i * 3 + 1] * dt);
      spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt + v * dt;
    }
    spGeo.attributes.position.needsUpdate = true;
    spGeo.attributes.aLife.needsUpdate = true;
    spGeo.attributes.aColor.needsUpdate = true;
    stMat.uniforms.uLen.value = 1 + boost * 6;
    stMat.uniforms.uAmt.value = 0.25 + boost * 0.55;

    // camera
    shake = Math.max(0, shake - dt * 1.6);
    hitFx = Math.max(0, hitFx - dt * 2.4);
    const sh = shake * shake;
    camera.position.set(x * 0.55 + (Math.random() - 0.5) * sh, camH + y * 0.28 + (Math.random() - 0.5) * sh, camDist);
    camera.lookAt(x * 0.72, 1.05 + y * 0.35, -12);
    camera.fov = baseFov + (reduced ? 0 : boost * 7);
    camera.updateProjectionMatrix();
    sky.position.copy(camera.position);
    CU.uHit.value = reduced ? hitFx * 0.4 : hitFx;
    CU.uAberr.value = 0.22 + boost * 0.35 + hitFx * 1.5;

    opts.onHud({ score: Math.floor(score), lives, combo: Math.min(8, 1 + Math.floor(chain / 5)), world: seg % 4, letters, mode, speed: v });
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
    mBlur.uniforms.uDir.value.set(1.6 / cw, 0);
    pass(mBlur, rtC1);
    mBlur.uniforms.tSrc.value = rtC1.texture;
    mBlur.uniforms.uDir.value.set(0, 1.6 / ch);
    pass(mBlur, rtC2);
    mBlur.uniforms.tSrc.value = rtC2.texture;
    mBlur.uniforms.uDir.value.set(3.2 / cw, 0);
    pass(mBlur, rtC1);
    mBlur.uniforms.tSrc.value = rtC1.texture;
    mBlur.uniforms.uDir.value.set(0, 3.2 / ch);
    pass(mBlur, rtC2);
    CU.tScene.value = rtMain.texture;
    CU.tB1.value = rtB1.texture;
    CU.tB2.value = rtC2.texture;
    pass(mComp, null);
  };

  let raf = 0;
  let last = performance.now();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!ready) return;
    if (!visible || document.hidden) {
      if (mode === 'play' && !paused) {
        paused = true;
        opts.onEvent({ t: 'pause' });
      }
      return;
    }
    if (powerOn && power < 1) {
      power = Math.min(1, power + dt / 0.9);
      CU.uPower.value = power;
      dirty = true;
    }
    const live = mode === 'play' || mode === 'dead' || (mode === 'demo' && !reduced);
    if (paused || !live) {
      if (dirty) {
        dirty = false;
        U.uTime.value = time;
        draw();
      }
      return;
    }
    step(dt);
    draw();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '60px' });
  io.observe(host);

  let dead = false;
  const fontReady = 'fonts' in document ? Promise.race([document.fonts.load('800 78px Unbounded', 'MIRA'), new Promise((r) => setTimeout(r, 1200))]).catch(() => undefined) : Promise.resolve();
  void fontReady.then(() => {
    if (dead) return;
    atlas.image = glyphAtlas();
    atlas.needsUpdate = true;
    resetRun(20260925);
    const s0 = Number(new URLSearchParams(location.search).get('dash_s')) || 0;
    if (s0 > 0) {
      dist = s0;
      nextRow = s0 + 30;
      seg = segAt(s0);
      const pr = mulberry(99);
      props.forEach((p) => {
        for (let i = 0; i < p.items.length; i++) p.place(i, s0 - BACK + i * p.spacing + pr() * p.spacing * 0.9, pr);
        p.mesh.instanceMatrix.needsUpdate = true;
        p.seed.needsUpdate = true;
      });
    }
    if (reduced) {
      // a composed still frame: mid-run, a few things on the track
      mode = 'still';
      dist = 0;
      time = 12;
      powerOn = true;
      CU.uPower.value = 1;
      const wasMode = mode;
      mode = 'demo';
      for (let i = 0; i < 40; i++) step(1 / 60);
      mode = wasMode;
    } else {
      for (let i = 0; i < 4; i++) step(1 / 60);
    }
    ready = true;
    dirty = true;
    draw();
    opts.onReady();
  });
  tick();

  return {
    start: () => {
      resetRun((Math.random() * 1e9) | 0);
      mode = 'play';
      paused = false;
      powerOn = true;
      power = Math.max(power, 0.999);
      CU.uPower.value = 1;
      opts.onHud({ score: 0, lives: 3, combo: 1, world: 0, letters: 0, mode, speed: v });
    },
    input: (a) => {
      if (mode === 'play' && !paused) act(a);
    },
    setPaused: (p) => {
      paused = p;
      last = performance.now();
      dirty = true;
    },
    demo: () => {
      paused = false;
      resetRun(20260925 + ((Math.random() * 1000) | 0));
      if (reduced) {
        mode = 'demo';
        for (let i = 0; i < 40; i++) step(1 / 60);
        mode = 'still';
        dirty = true;
      } else mode = 'demo';
    },
    power: () => {
      powerOn = true;
      if (reduced) {
        power = 1;
        CU.uPower.value = 1;
      }
      dirty = true;
    },
    dispose: () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      disposables.forEach((d) => d.dispose());
      props.forEach((p) => p.mesh.dispose());
      [barriers, walls, gems, glyphs].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function mergeGeos(list: T.BufferGeometry[]) {
  let n = 0;
  list.forEach((g) => (n += g.attributes.position.count));
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  list.forEach((g) => {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  });
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(pos, 3));
  out.setAttribute('normal', new T.BufferAttribute(nor, 3));
  return out;
}
