import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { BASE } from '@/lib/base-path';
import { studioEnv, makeBackdrop, makeFloor, nightPanorama, nightEnv, glowTexture } from './env';
import { drawMeter, drawCenter, centerTabAt, type Page, type ScreenState } from './screens';
import type { Paint, Interior } from './data';

/**
 * MIRAI ARC — the configurator stage.
 * A Blender-built car (tools/blender/arc.py) in a softbox studio: clear-coated paint
 * lit by a PMREM of the softboxes, a floor that mirrors the car (a second, flipped
 * pass under a translucent floor) and a baked contact shadow. Parts are touchable:
 * doors swing on their hinges, lamps light, the charge flap opens. "Board" flies the
 * camera through the open driver's door to the eye point, where the meter and the
 * centre display boot on canvas textures.
 */

export type HotId = 'doorR' | 'doorL' | 'head' | 'tail' | 'flap' | 'wheel';
export type Hot = { id: HotId; x: number; y: number; on: boolean };
export type Preset = 'hero' | 'design' | 'interior';
export type ArcState = { doorR: boolean; doorL: boolean; flap: boolean; lights: boolean; seated: boolean; busy: boolean; page: Page };
export type ArcOpts = {
  reduced: boolean;
  narrow: boolean;
  onReady: () => void;
  onProgress?: (f: number) => void;
  onHot: (h: Hot[]) => void;
  onHover: (id: HotId | null, x: number, y: number) => void;
  onState: (s: ArcState) => void;
  onError: () => void;
  onWheel: () => void;
};
export type ArcCtl = {
  setPaint: (p: Paint) => void;
  setWheel: (id: 'aero' | 'sport') => void;
  setInterior: (i: Interior) => void;
  setAmbient: (hex: string, name: string) => void;
  setNight: (on: boolean) => void;
  setPreset: (p: Preset) => void;
  setShift: (x: number) => void;
  toggle: (id: HotId) => void;
  setLights: (on: boolean) => void;
  setPage: (p: Page) => void;
  board: () => void;
  alight: () => void;
  dispose: () => void;
};

type Meta = {
  eye: number[];
  wheelbase: number[];
  wheelZ: number;
  trackZ: number;
  steering: { hub: number[]; axis: number[] };
  hot: Record<string, number[]>;
};

const V = (a: number[]) => new T.Vector3(a[0], a[1], a[2]);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

// camera presets: azimuth from +x towards +z (driver side), polar from +y
const PRESETS: Record<Preset, { az: number; pol: number; r: number; t: [number, number, number]; fit: number }> = {
  hero: { az: 0.66, pol: 1.34, r: 8.9, t: [0.05, 0.62, 0], fit: 2.3 },
  design: { az: 1.36, pol: 1.38, r: 10.4, t: [-0.05, 0.64, 0], fit: 2.6 },
  interior: { az: 1.36, pol: 1.3, r: 7.6, t: [0.1, 0.72, 0.3], fit: 2.05 },
};

export function mountArc(host: HTMLElement, opts: ArcOpts): ArcCtl {
  const { reduced, narrow } = opts;
  let renderer: T.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    opts.onError();
    return stubCtl();
  }
  const dpr = Math.min(devicePixelRatio || 1, narrow ? 1.6 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.autoClear = false;
  renderer.setClearColor(0x0b0c0e, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const backdrop = new T.Scene();
  const floorScene = new T.Scene();
  const carScene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 0.05, 300);

  const pmrem = new T.PMREMGenerator(renderer);
  const envStudio = pmrem.fromScene(studioEnv(), 0.035).texture;
  let envNight: T.Texture | null = null;
  let nightTex: T.Texture | null = null;
  carScene.environment = envStudio;
  carScene.environmentIntensity = 1.25;

  const studio = makeBackdrop();
  backdrop.add(studio);
  const floor = makeFloor();
  floorScene.add(floor);
  const floorU = (floor.material as T.ShaderMaterial).uniforms;
  const domeU = ((studio.children[0] as T.Mesh).material as T.ShaderMaterial).uniforms;
  /** From the driver's seat the studio reads brighter, like a lit showroom. */
  const studioLook = (inside: boolean) => {
    domeU.uMid.value.set(inside ? '#565b62' : '#24272b');
    domeU.uTop.value.set(inside ? '#1c1f23' : '#08090b');
    domeU.uLow.value.set(inside ? '#44484e' : '#1d2024');
    if (!screen.night) {
      floorU.uIn.value.set(inside ? '#5a5e64' : '#34373c');
      floorU.uOut.value.set(inside ? '#44484e' : '#1d2024');
    }
  };

  const disposables: { dispose: () => void }[] = [envStudio, pmrem];
  const track = <X extends { dispose: () => void }>(x: X) => (disposables.push(x), x);

  // contact shadow
  const shadowTex = track(new T.TextureLoader().load(`${BASE}/models/arc/shadow.png`, () => invalidate()));
  const shadow = new T.Mesh(
    track(new T.PlaneGeometry(6.4, 3.2)),
    track(new T.MeshBasicMaterial({ color: 0x000000, alphaMap: shadowTex, transparent: true, depthWrite: false, opacity: 0.92 })),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  shadow.renderOrder = 2;
  floorScene.add(shadow);

  // lamp pools on the floor (fade in with the lights)
  const glow = track(glowTexture());
  const poolMat = (col: number) => track(new T.MeshBasicMaterial({ color: col, map: glow, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false }));
  const poolF = new T.Mesh(track(new T.PlaneGeometry(4.2, 3.4)), poolMat(0xdde8ff));
  poolF.rotation.x = -Math.PI / 2;
  poolF.position.set(3.9, 0.004, 0);
  const poolR = new T.Mesh(track(new T.PlaneGeometry(2.2, 2.6)), poolMat(0xff2a1a));
  poolR.rotation.x = -Math.PI / 2;
  poolR.position.set(-3.0, 0.004, 0);
  poolF.renderOrder = poolR.renderOrder = 3;
  floorScene.add(poolF, poolR);

  // ---------------------------------------------------------------- materials by name
  const M: Record<string, T.MeshPhysicalMaterial | T.MeshStandardMaterial | T.MeshBasicMaterial> = {};
  const phys = (name: string, p: T.MeshPhysicalMaterialParameters) => (M[name] = track(new T.MeshPhysicalMaterial(p)));
  const std = (name: string, p: T.MeshStandardMaterialParameters) => (M[name] = track(new T.MeshStandardMaterial(p)));
  const paint = phys('Paint', { color: '#8a6a4b', metalness: 0.7, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.05 });
  std('Inner', { color: '#141517', roughness: 0.7 });
  std('Under', { color: '#0b0b0c', roughness: 0.85 });
  phys('TrimGloss', { color: '#060607', roughness: 0.18, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 });
  std('TrimSatin', { color: '#121314', roughness: 0.62 });
  std('Chrome', { color: '#e4e6ea', metalness: 1, roughness: 0.1 });
  const lampHead = std('LampHead', { color: '#c9ced6', metalness: 0.3, roughness: 0.18, emissive: '#eef4ff', emissiveIntensity: 0.15 });
  const lampTail = std('LampTail', { color: '#3a0a0b', metalness: 0.1, roughness: 0.2, emissive: '#ff2414', emissiveIntensity: 0.2 });
  phys('LensDark', { color: '#040506', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 });
  std('Liner', { color: '#0c0c0d', roughness: 0.9 });
  std('Tire', { color: '#161718', roughness: 0.82 });
  phys('RimA', { color: '#c9ccd0', metalness: 1, roughness: 0.26, clearcoat: 0.6 });
  phys('RimB', { color: '#1b1c1f', metalness: 0.7, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
  std('RimBarrel', { color: '#2a2b2e', metalness: 0.8, roughness: 0.45 });
  std('RimLip', { color: '#d9dbde', metalness: 1, roughness: 0.18 });
  std('Brake', { color: '#6d6f73', metalness: 1, roughness: 0.42 });
  phys('Caliper', { color: '#a88457', metalness: 0.4, roughness: 0.3, clearcoat: 1 });
  const seatM = std('Seat', { color: '#17181b', roughness: 0.58 });
  const wheelM = std('Wheel', { color: '#141416', roughness: 0.48 });
  const seatA = std('SeatAccent', { color: '#2c2d31', roughness: 0.7 });
  const dashM = std('Dash', { color: '#121315', roughness: 0.66 });
  const trimM = std('DashTrim', { color: '#6d6a66', metalness: 0.9, roughness: 0.3 });
  const carpet = std('Carpet', { color: '#101113', roughness: 0.95 });
  std('Socket', { color: '#0b0c0d', roughness: 0.45 });
  const ring = std('ChargeRing', { color: '#0e2a33', emissive: '#39d0ff', emissiveIntensity: 0 });
  const ambientM = (M.Ambient = track(new T.MeshBasicMaterial({ color: '#ffa64a', toneMapped: false })));
  /** Smoked glass: dark from outside, much clearer from inside (canopy normals face
   *  out, so the front face is the outside). Reflections come from a second layer. */
  const smoked = (color: string, outside: number, inside: number) => {
    const m = new T.MeshBasicMaterial({ color, transparent: true, opacity: outside, depthWrite: false, side: T.DoubleSide });
    const uInside = { value: inside };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uInside = uInside;
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'uniform float uInside;\nvoid main() {')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, gl_FrontFacing ? opacity : uInside );');
    };
    // one pass: three's two-pass double-sided mode flips the front face, which would
    // make gl_FrontFacing useless for telling inside from outside
    m.forceSinglePass = true;
    m.customProgramCacheKey = () => 'arc-smoked';
    return track(m);
  };
  const glassTint = {
    GlassWS: smoked('#0a0e12', 0.8, 0.1),
    GlassSide: smoked('#05070a', 0.88, 0.22),
    GlassRoof: smoked('#030405', 0.94, 0.5),
  } as Record<string, T.MeshBasicMaterial>;
  // reflections are added on top so they never fade with the tint; strong outside, faint inside
  const glassRefl = track(new T.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0.015, envMapIntensity: 3.2, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  glassRefl.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb *= gl_FrontFacing ? 1.0 : 0.22;');
  };
  glassRefl.customProgramCacheKey = () => 'arc-glass-refl';
  glassRefl.forceSinglePass = true;
  std('WindowTrim', { color: '#c9ccd1', metalness: 1, roughness: 0.26 });
  const headM = std('Headliner', { color: '#c9c1b3', roughness: 0.92 });

  // screens
  const meterCv = document.createElement('canvas');
  meterCv.width = 1024;
  meterCv.height = 358;
  const centerCv = document.createElement('canvas');
  centerCv.width = 1024;
  centerCv.height = 618;
  const meterTex = track(new T.CanvasTexture(meterCv));
  const centerTex = track(new T.CanvasTexture(centerCv));
  for (const t of [meterTex, centerTex]) {
    t.colorSpace = T.SRGBColorSpace;
    t.flipY = false;
    t.anisotropy = 4;
  }
  M.ScreenMeter = track(new T.MeshBasicMaterial({ map: meterTex, toneMapped: false }));
  M.ScreenCenter = track(new T.MeshBasicMaterial({ map: centerTex, toneMapped: false }));

  // interior light, tinted by the ambient colour (only while someone is inside)
  const cabinLight = new T.PointLight('#ffa64a', 0, 1.4, 2);
  cabinLight.position.set(0.1, 0.95, 0);
  carScene.add(cabinLight);

  // ---------------------------------------------------------------- state
  const car = new T.Group();
  carScene.add(car);
  let meta: Meta | null = null;
  let ready = false;
  let dead = false;
  const nodes: Record<string, T.Object3D> = {};
  const hitMap = new Map<T.Object3D, HotId>();
  const wheels: { g: T.Group; a: T.Object3D; b: T.Object3D }[] = [];
  let screenMeter: T.Mesh | null = null;
  let screenCenter: T.Mesh | null = null;

  const st: ArcState = { doorR: false, doorL: false, flap: false, lights: false, seated: false, busy: false, page: 'home' };
  const anim = { doorR: 0, doorL: 0, flap: 0, lights: 0 };
  const goal = { doorR: 0, doorL: 0, flap: 0, lights: 0 };
  const screen: ScreenState = { ambient: '#ffa64a', ambientName: '琥珀', battery: 82, range: 498, paint: '砂金', doorR: false, doorL: false, lights: false, night: false, clock: '10:24' };
  let boot = 0;
  let bootGoal = 0;
  let screenT = 0;
  let screenDirty = true;
  let paintFrom = new T.Color('#8a6a4b');
  let paintTo = new T.Color('#8a6a4b');
  let paintK = 1;
  const paintP = { m0: 0.7, m1: 0.7, r0: 0.34, r1: 0.34, i0: 0, i1: 0 };

  // camera
  const orbit = { az: PRESETS.hero.az, pol: PRESETS.hero.pol, r: PRESETS.hero.r, t: new T.Vector3(...PRESETS.hero.t) };
  const orbitGoal = { az: orbit.az, pol: orbit.pol, r: orbit.r, t: orbit.t.clone() };
  let vAz = 0;
  let vPol = 0;
  let preset: Preset = 'hero';
  let lastInput = -1e9;
  let shift = 0;
  let shiftGoal = 0;
  type Mode = 'orbit' | 'fly' | 'seat';
  let mode: Mode = 'orbit';
  let fly: { t0: number; dur: number; pos: (t: number) => T.Vector3; look: (t: number) => T.Vector3; fov: (t: number) => number; done: () => void } | null = null;
  const seat = { yaw: 0, pitch: -0.14, vy: 0, vp: 0 };
  const extFov = narrow ? 36 : 30;
  let dirty = true;
  let visible = true;
  let W = 1;
  let H = 1;
  let autoDoor = false;
  const invalidate = () => {
    dirty = true;
  };

  // ---------------------------------------------------------------- loading
  const draco = new DRACOLoader().setDecoderPath(`${BASE}/draco/`);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  Promise.all([
    fetch(`${BASE}/models/arc/car.json`).then((r) => r.json() as Promise<Meta>),
    loader.loadAsync(`${BASE}/models/arc/car.glb`, (e) => opts.onProgress?.(e.total ? e.loaded / e.total : 0)),
    'fonts' in document ? document.fonts.ready : Promise.resolve(),
  ])
    .then(([m, gltf]) => {
      if (dead) return;
      meta = m;
      build(gltf.scene);
      ready = true;
      drawScreens();
      opts.onReady();
      opts.onState({ ...st });
      invalidate();
    })
    .catch(() => {
      if (!dead) opts.onError();
    });

  function build(root: T.Object3D) {
    root.traverse((o) => {
      nodes[o.name] = o;
    });
    const glassMeshes: T.Mesh[] = [];
    root.traverse((o) => {
      const mesh = o as T.Mesh;
      if (!mesh.isMesh) return;
      const name = (mesh.material as T.Material).name;
      if (glassTint[name] || name === 'GlassDoorR' || name === 'GlassDoorL') {
        mesh.material = glassTint[name] ?? glassTint.GlassSide;
        glassMeshes.push(mesh);
      } else if (M[name]) mesh.material = M[name];
      else mesh.material = M.Inner;
      mesh.layers.enable(1);
    });
    for (const g of glassMeshes) {
      const r = new T.Mesh(g.geometry, glassRefl);
      r.renderOrder = 5;
      g.renderOrder = 4;
      r.layers.enable(1);
      g.add(r);
    }
    // own paint instances aren't needed: the doors share the body's paint.
    car.add(root);
    // wheels: prototypes at the origin -> four corners (right side mirrored)
    const proto = ['Tire', 'Barrel', 'Brake', 'Caliper'].map((n) => nodes[n]).filter(Boolean);
    const ra = nodes.RimA;
    const rb = nodes.RimB;
    for (const x of meta!.wheelbase) {
      for (const side of [1, -1]) {
        const g = new T.Group();
        for (const p of proto) g.add(p.clone());
        const a = ra.clone();
        const b = rb.clone();
        g.add(a, b);
        g.position.set(x, meta!.wheelZ, -side * meta!.trackZ);
        if (side < 0) g.scale.z = -1;
        g.traverse((o) => {
          o.layers.enable(1);
          hitMap.set(o, 'wheel');
        });
        car.add(g);
        wheels.push({ g, a, b });
      }
    }
    for (const p of [...proto, ra, rb]) p.removeFromParent();
    setWheel('aero');
    // touchable parts
    const tag = (n: string, id: HotId) => nodes[n]?.traverse((o) => hitMap.set(o, id));
    tag('DoorR', 'doorR');
    tag('DoorL', 'doorL');
    tag('HeadLamp', 'head');
    tag('TailLamp', 'tail');
    tag('ChargeFlap', 'flap');
    screenMeter = (findMesh(nodes.ScreenMeter) ?? null) as T.Mesh | null;
    screenCenter = (findMesh(nodes.ScreenCenter) ?? null) as T.Mesh | null;
  }

  function findMesh(o?: T.Object3D) {
    let m: T.Mesh | undefined;
    o?.traverse((x) => {
      if (!m && (x as T.Mesh).isMesh) m = x as T.Mesh;
    });
    return m;
  }

  // ---------------------------------------------------------------- screens
  function drawScreens() {
    const now = new Date();
    screen.clock = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    screen.doorR = st.doorR;
    screen.doorL = st.doorL;
    screen.lights = st.lights;
    drawMeter(meterCv.getContext('2d')!, meterCv.width, meterCv.height, screen, boot);
    drawCenter(centerCv.getContext('2d')!, centerCv.width, centerCv.height, screen, boot, st.page, screenT);
    meterTex.needsUpdate = true;
    centerTex.needsUpdate = true;
    screenDirty = false;
  }

  // ---------------------------------------------------------------- sizing / visibility
  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    if (w === W && h === H) return;
    W = w;
    H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    applyView();
    invalidate();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) invalidate();
  });
  io.observe(host);
  const onVis = () => !document.hidden && invalidate();
  document.addEventListener('visibilitychange', onVis);

  function fitR(p: Preset) {
    const pr = PRESETS[p];
    const hf = 2 * Math.atan(Math.tan(T.MathUtils.degToRad(extFov) / 2) * camera.aspect);
    return Math.max(pr.r, pr.fit / Math.tan(hf / 2));
  }

  function applyView() {
    if (mode === 'seat') {
      // keep a wide horizontal view on portrait screens
      const hfov = narrow ? 96 : 92;
      const v = 2 * Math.atan(Math.tan(T.MathUtils.degToRad(hfov) / 2) / camera.aspect);
      camera.fov = clamp(T.MathUtils.radToDeg(v), 58, narrow ? 84 : 96);
    }
    if (shift && mode === 'orbit') camera.setViewOffset(W, H, -W * shift, 0, W, H);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- input
  let down: { x: number; y: number; t: number; id: number; moved: boolean; type: string } | null = null;
  let px = 0;
  let py = 0;
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();

  function pick(cx: number, cy: number): { id: HotId | 'screen'; uv?: T.Vector2 } | null {
    if (!ready) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (mode === 'seat') {
      if (!screenCenter) return null;
      const h = ray.intersectObject(screenCenter, false)[0];
      return h?.uv ? { id: 'screen', uv: h.uv } : null;
    }
    const targets: T.Object3D[] = [];
    for (const n of ['DoorR', 'DoorL', 'HeadLamp', 'TailLamp', 'ChargeFlap']) if (nodes[n]) targets.push(nodes[n]);
    for (const w of wheels) targets.push(w.g);
    for (const n of ['Body', 'Canopy', 'CanopyFrame', 'Cabin', 'Trim']) if (nodes[n]) targets.push(nodes[n]);
    const hits = ray.intersectObjects(targets, true);
    for (const h of hits) {
      if ((h.object as T.Mesh).material === glassRefl) continue;
      const id = hitMap.get(h.object);
      if (id) return { id };
      // the body is in front: nothing touchable here
      return null;
    }
    return null;
  }

  const onDown = (e: PointerEvent) => {
    if (!ready || st.busy) return;
    onLeave();
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, moved: false, type: e.pointerType };
    px = e.clientX;
    py = e.clientY;
    vAz = vPol = 0;
    seat.vy = seat.vp = 0;
  };
  const onMove = (e: PointerEvent) => {
    if (down && e.pointerId === down.id) {
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      px = e.clientX;
      py = e.clientY;
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
        down.moved = true;
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (!down.moved) return;
      lastInput = performance.now();
      if (mode === 'seat') {
        seat.vy = dx * 0.0042;
        seat.vp = -dy * 0.0036;
        seat.yaw = clamp(seat.yaw + seat.vy, -1.9, 1.75);
        seat.pitch = clamp(seat.pitch + seat.vp, -0.75, 0.55);
      } else if (mode === 'orbit') {
        vAz = dx * 0.0062;
        orbitGoal.az += vAz;
        orbit.az += vAz;
        if (down.type === 'mouse') {
          vPol = -dy * 0.004;
          orbitGoal.pol = clamp(orbitGoal.pol + vPol, 0.95, 1.52);
          orbit.pol = orbitGoal.pol;
        }
      }
      invalidate();
      return;
    }
    if (e.pointerType === 'mouse' && mode !== 'fly') {
      hoverAt = [e.clientX, e.clientY];
      invalidate();
    }
  };
  let hoverAt: [number, number] | null = null;
  let hoverId: HotId | 'screen' | null = null;
  function hover(x: number, y: number) {
    const h = pick(x, y);
    const id = h ? (h.id === 'screen' ? (h.uv && h.uv.y > 0.86 ? 'screen' : null) : h.id) : null;
    if (id !== hoverId) {
      hoverId = id;
      canvas.style.cursor = id ? 'pointer' : mode === 'seat' ? 'grab' : 'grab';
    }
    const r = canvas.getBoundingClientRect();
    opts.onHover(id && id !== 'screen' ? id : null, x - r.left, y - r.top);
  }
  const onUp = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    const wasTap = !down.moved && performance.now() - down.t < 600;
    down = null;
    if (wasTap) {
      const h = pick(e.clientX, e.clientY);
      if (h?.id === 'screen' && h.uv) {
        const p = centerTabAt(h.uv.x, h.uv.y);
        if (p) setPage(p);
      } else if (h && h.id !== 'screen') toggle(h.id);
    }
  };
  const onLeave = () => {
    if (hoverId) {
      hoverId = null;
      opts.onHover(null, 0, 0);
    }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => (down = null));
  canvas.addEventListener('pointerleave', onLeave);
  canvas.style.cursor = 'grab';

  // ---------------------------------------------------------------- actions
  function emit() {
    screenDirty = true;
    opts.onState({ ...st });
    invalidate();
  }
  function setDoor(side: 'doorR' | 'doorL', open: boolean) {
    st[side] = open;
    goal[side] = open ? 1 : 0;
    if (side === 'doorR' && open && !st.seated) bootGoal = Math.max(bootGoal, 1);
    emit();
  }
  function toggle(id: HotId) {
    if (st.busy) return;
    if (id === 'doorR' || id === 'doorL') {
      if (st.seated) return;
      setDoor(id, !st[id]);
      if (id === 'doorR') autoDoor = false;
    } else if (id === 'head' || id === 'tail') setLights(!st.lights);
    else if (id === 'flap') {
      st.flap = !st.flap;
      goal.flap = st.flap ? 1 : 0;
      emit();
    } else if (id === 'wheel') {
      opts.onHover(null, 0, 0);
      opts.onWheel();
    }
  }
  function setLights(on: boolean) {
    st.lights = on;
    goal.lights = on ? 1 : 0;
    emit();
  }
  function setWheel(id: 'aero' | 'sport') {
    for (const w of wheels) {
      w.a.visible = id === 'aero';
      w.b.visible = id === 'sport';
    }
    invalidate();
  }
  function setPage(p: Page) {
    st.page = p;
    emit();
  }

  function setPreset(p: Preset) {
    preset = p;
    if (mode !== 'orbit') return;
    const pr = PRESETS[p];
    // keep the user's side of the car when only the distance changes
    let az = pr.az;
    const cur = ((orbitGoal.az % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (p !== 'interior' && Math.abs(cur - pr.az) > 0.9 && Math.abs(cur - pr.az) < Math.PI * 2 - 0.9) az = pr.az;
    const base = orbitGoal.az - cur;
    orbitGoal.az = base + az + (az - cur > Math.PI ? -Math.PI * 2 : az - cur < -Math.PI ? Math.PI * 2 : 0);
    orbitGoal.pol = pr.pol;
    orbitGoal.r = fitR(p);
    orbitGoal.t.set(...pr.t);
    if (p === 'interior' && !st.doorR) {
      setDoor('doorR', true);
      autoDoor = true;
    } else if (p !== 'interior' && autoDoor && st.doorR) {
      setDoor('doorR', false);
      autoDoor = false;
    }
    if (reduced) {
      orbit.az = orbitGoal.az;
      orbit.pol = orbitGoal.pol;
      orbit.r = orbitGoal.r;
      orbit.t.copy(orbitGoal.t);
    }
    invalidate();
  }

  // camera helpers
  const camPos = new T.Vector3();
  const camLook = new T.Vector3();
  function orbitPos(o: typeof orbit, out: T.Vector3) {
    return out.set(
      o.t.x + o.r * Math.sin(o.pol) * Math.cos(o.az),
      o.t.y + o.r * Math.cos(o.pol),
      o.t.z + o.r * Math.sin(o.pol) * Math.sin(o.az),
    );
  }
  function seatDir(out: T.Vector3) {
    return out.set(Math.cos(seat.pitch) * Math.cos(seat.yaw), Math.sin(seat.pitch), Math.cos(seat.pitch) * Math.sin(seat.yaw));
  }

  function board() {
    if (!ready || st.seated || st.busy || !meta) return;
    st.busy = true;
    onLeave();
    const eye = V(meta.eye);
    const p0 = camera.position.clone();
    const l0 = camLook.clone();
    const fov0 = camera.fov;
    const approach = new T.Vector3(0.1, 1.42, 3.3);
    const lookSeat = new T.Vector3(-0.15, 0.95, 0.35);
    const door = new T.Vector3(-0.02, 1.2, 1.2);
    const fwd = eye.clone().add(narrow ? new T.Vector3(Math.cos(0.3) * Math.cos(-0.22), Math.sin(-0.3), Math.cos(0.3) * Math.sin(-0.22)) : new T.Vector3(Math.cos(0.17), Math.sin(-0.17), -0.04));
    seat.yaw = narrow ? -0.22 : -0.04;
    seat.pitch = narrow ? -0.3 : -0.17;
    mode = 'seat';
    applyView();
    const seatFov = camera.fov;
    mode = 'fly';
    applyView();
    camera.fov = fov0;
    camera.updateProjectionMatrix();
    if (!st.doorR) setDoor('doorR', true);
    autoDoor = false;
    const curve = new T.CatmullRomCurve3([p0, approach, door, eye], false, 'centripetal', 0.5);
    const finish = () => {
      mode = 'seat';
      st.seated = true;
      st.busy = false;
      applyView();
      bootGoal = 1;
      boot = reduced ? 1 : Math.min(boot, 0.001);
      cabinLight.intensity = 0.22;
      studioLook(true);
      window.setTimeout(() => setDoor('doorR', false), reduced ? 0 : 150);
      emit();
    };
    if (reduced) {
      finish();
      return;
    }
    fly = {
      t0: performance.now(),
      dur: 3000,
      pos: (t) => curve.getPoint(ease(clamp((t - 0.05) / 0.95, 0, 1))),
      look: (t) => {
        const a = ease(clamp(t / 0.45, 0, 1));
        const b = ease(clamp((t - 0.55) / 0.45, 0, 1));
        return l0.clone().lerp(lookSeat, a).lerp(fwd, b);
      },
      fov: (t) => T.MathUtils.lerp(fov0, seatFov, ease(clamp((t - 0.45) / 0.55, 0, 1))),
      done: finish,
    };
    emit();
  }

  function alight() {
    if (!st.seated || st.busy || !meta) return;
    st.busy = true;
    st.seated = false;
    cabinLight.intensity = 0;
    studioLook(false);
    setDoor('doorR', true);
    const eye = V(meta.eye);
    const p1 = new T.Vector3(-0.02, 1.2, 1.2);
    const pr = PRESETS.interior;
    orbitGoal.az = orbit.az = pr.az;
    orbitGoal.pol = orbit.pol = pr.pol;
    orbitGoal.r = orbit.r = fitR('interior');
    orbitGoal.t.set(...pr.t);
    orbit.t.copy(orbitGoal.t);
    const end = orbitPos(orbit, new T.Vector3());
    const l0 = eye.clone().add(seatDir(new T.Vector3()));
    const fov0 = camera.fov;
    const finish = () => {
      mode = 'orbit';
      st.busy = false;
      camera.fov = extFov;
      applyView();
      autoDoor = preset === 'interior';
      if (preset !== 'interior') setDoor('doorR', false);
      bootGoal = st.doorR ? 1 : 0;
      emit();
      setPreset(preset);
    };
    if (reduced) {
      finish();
      return;
    }
    const curve = new T.CatmullRomCurve3([eye, p1, end], false, 'centripetal', 0.5);
    mode = 'fly';
    applyView();
    fly = {
      t0: performance.now() + 350,
      dur: 2200,
      pos: (t) => curve.getPoint(ease(t)),
      look: (t) => l0.clone().lerp(orbit.t, ease(clamp(t / 0.6, 0, 1))),
      fov: (t) => T.MathUtils.lerp(fov0, extFov, ease(t)),
      done: finish,
    };
    emit();
  }

  function setPaint(p: Paint) {
    paintFrom = paint.color.clone();
    paintTo = new T.Color(p.hex);
    paintP.m0 = paint.metalness;
    paintP.r0 = paint.roughness;
    paintP.i0 = paint.iridescence;
    paintP.m1 = p.metal;
    paintP.r1 = p.rough;
    paintP.i1 = p.pearl ?? 0;
    paintK = reduced ? 1 : 0;
    if (reduced) applyPaint(1);
    screen.paint = p.jp;
    screenDirty = true;
    invalidate();
  }
  function applyPaint(k: number) {
    const e = ease(k);
    paint.color.copy(paintFrom).lerp(paintTo, e);
    paint.metalness = T.MathUtils.lerp(paintP.m0, paintP.m1, e);
    paint.roughness = T.MathUtils.lerp(paintP.r0, paintP.r1, e);
    paint.iridescence = T.MathUtils.lerp(paintP.i0, paintP.i1, e);
    paint.iridescenceIOR = 1.45;
    paint.iridescenceThicknessRange = [180, 520];
  }
  function setInterior(i: Interior) {
    seatM.color.set(i.seat);
    seatA.color.set(i.accent);
    dashM.color.set(i.dash);
    trimM.color.set(i.trim);
    trimM.metalness = i.trimMetal;
    trimM.roughness = i.trimMetal > 0.5 ? 0.28 : 0.55;
    carpet.color.set(i.carpet);
    headM.color.set(i.headliner);
    wheelM.color.set(i.id === 'kurikawa' ? i.seat : '#141416');
    invalidate();
  }
  function setAmbient(hex: string, name: string) {
    ambientM.color.set(hex);
    cabinLight.color.set(hex);
    screen.ambient = hex;
    screen.ambientName = name;
    screenDirty = true;
    invalidate();
  }
  function setNight(on: boolean) {
    screen.night = on;
    screenDirty = true;
    if (on) {
      nightTex ??= track(nightPanorama());
      if (!envNight) {
        const ne = nightEnv(nightTex);
        envNight = track(pmrem.fromScene(ne.scene, 0.02).texture);
        ne.dispose();
      }
      backdrop.background = nightTex;
      backdrop.backgroundIntensity = 1;
      studio.visible = false;
      carScene.environment = envNight;
      carScene.environmentIntensity = 1.5;
      floorU.uIn.value.set('#0d0f13');
      floorU.uOut.value.set('#07080a');
      floorU.uRefl.value = 0.34;
    } else {
      backdrop.background = null;
      studio.visible = true;
      carScene.environment = envStudio;
      carScene.environmentIntensity = 1.25;
      floorU.uRefl.value = 0.22;
      studioLook(st.seated);
    }
    invalidate();
  }

  // ---------------------------------------------------------------- frame
  let raf = 0;
  let last = performance.now();
  const hotPts: { id: HotId; node: string; p: T.Vector3; n: T.Vector3 }[] = [];
  const tmp = new T.Vector3();
  const tmpN = new T.Vector3();
  const camDir = new T.Vector3();

  function hots(): Hot[] {
    if (!meta) return [];
    if (!hotPts.length) {
      const h = meta.hot;
      hotPts.push(
        { id: 'doorR', node: 'DoorR', p: V(h.doorR), n: new T.Vector3(0, 0, 1) },
        { id: 'doorL', node: 'DoorL', p: V(h.doorL), n: new T.Vector3(0, 0, -1) },
        { id: 'head', node: '', p: V(h.head), n: new T.Vector3(1, 0, 0.25).normalize() },
        { id: 'tail', node: '', p: V(h.tail), n: new T.Vector3(-1, 0, 0.2).normalize() },
        { id: 'flap', node: '', p: V(h.flap), n: new T.Vector3(0, 0, -1) },
        { id: 'wheel', node: '', p: V(h.wheel), n: new T.Vector3(0, 0, 1) },
      );
    }
    return hotPts.map((h) => {
      tmp.copy(h.p);
      tmpN.copy(h.n);
      const nd = h.node ? nodes[h.node] : null;
      if (nd) {
        // follow the swinging door (point is given in car space)
        const q = nd.quaternion;
        tmp.sub(nd.position).applyQuaternion(q).add(nd.position);
        tmpN.applyQuaternion(q);
      }
      camDir.copy(camera.position).sub(tmp).normalize();
      const facing = camDir.dot(tmpN) > 0.22;
      const s = tmp.clone().project(camera);
      const on = mode === 'orbit' && facing && s.z < 1 && Math.abs(s.x) < 1 && Math.abs(s.y) < 1;
      return { id: h.id, x: ((s.x + 1) / 2) * W, y: ((1 - s.y) / 2) * H, on };
    });
  }

  function step(dt: number) {
    let moving = false;
    const now = performance.now();
    // doors / flap / lamps
    for (const k of ['doorR', 'doorL', 'flap', 'lights'] as const) {
      const g = goal[k];
      if (Math.abs(anim[k] - g) > 1e-4) {
        const speed = k === 'lights' ? 4 : k === 'flap' ? 3 : 1.25;
        anim[k] = reduced ? g : g > anim[k] ? Math.min(g, anim[k] + dt * speed) : Math.max(g, anim[k] - dt * speed);
        moving = true;
      }
    }
    if (nodes.DoorR) nodes.DoorR.rotation.y = 1.08 * ease(anim.doorR);
    if (nodes.DoorL) nodes.DoorL.rotation.y = -1.08 * ease(anim.doorL);
    if (nodes.ChargeFlap) nodes.ChargeFlap.rotation.y = -1.75 * ease(anim.flap);
    const L = anim.lights;
    lampHead.emissiveIntensity = 0.15 + L * 4.2;
    lampHead.color.setRGB(0.79 + 0.2 * L, 0.81 + 0.19 * L, 0.84 + 0.16 * L);
    lampTail.emissiveIntensity = 0.2 + L * 3.4;
    (poolF.material as T.MeshBasicMaterial).opacity = L * (screen.night ? 0.5 : 0.22);
    (poolR.material as T.MeshBasicMaterial).opacity = L * (screen.night ? 0.28 : 0.1);
    ring.emissiveIntensity = anim.flap * (1.2 + (reduced ? 0 : 0.8 * Math.sin(now * 0.004)));
    if (anim.flap > 0 && !reduced) moving = true;
    // paint cross-fade
    if (paintK < 1) {
      paintK = Math.min(1, paintK + dt / 0.7);
      applyPaint(paintK);
      moving = true;
    }
    // screens
    if (Math.abs(boot - bootGoal) > 1e-4) {
      boot = bootGoal > boot ? Math.min(1, boot + dt / 2.6) : Math.max(0, boot - dt / 0.8);
      screenDirty = true;
      moving = true;
    }
    if (st.seated && (st.page === 'navi' || st.page === 'media') && !reduced) {
      screenT += dt;
      if (Math.floor(screenT * 20) !== Math.floor((screenT - dt) * 20)) screenDirty = true;
      moving = true;
    }
    if (screenDirty && ready) drawScreens();
    // camera
    if (mode === 'orbit') {
      if (!down) {
        if (Math.abs(vAz) > 1e-5 || Math.abs(vPol) > 1e-5) {
          orbitGoal.az += vAz;
          orbit.az += vAz;
          orbitGoal.pol = clamp(orbitGoal.pol + vPol, 0.95, 1.52);
          orbit.pol = orbitGoal.pol;
          const f = Math.pow(0.0025, dt);
          vAz *= f;
          vPol *= f;
          moving = true;
        } else if (!reduced && preset === 'hero' && now - lastInput > 5000) {
          orbitGoal.az += dt * 0.045;
          moving = true;
        }
      }
      const k = 3.2;
      const prev = orbit.az + orbit.pol + orbit.r + orbit.t.x + orbit.t.y + orbit.t.z;
      orbit.az = damp(orbit.az, orbitGoal.az, k, dt);
      orbit.pol = damp(orbit.pol, orbitGoal.pol, k, dt);
      orbit.r = damp(orbit.r, orbitGoal.r, k, dt);
      orbit.t.x = damp(orbit.t.x, orbitGoal.t.x, k, dt);
      orbit.t.y = damp(orbit.t.y, orbitGoal.t.y, k, dt);
      orbit.t.z = damp(orbit.t.z, orbitGoal.t.z, k, dt);
      if (Math.abs(prev - (orbit.az + orbit.pol + orbit.r + orbit.t.x + orbit.t.y + orbit.t.z)) > 1e-5) moving = true;
      shift = damp(shift, shiftGoal, 3, dt);
      if (Math.abs(shift - shiftGoal) > 1e-4) {
        moving = true;
      }
      orbitPos(orbit, camPos);
      camera.position.copy(camPos);
      camLook.copy(orbit.t);
      camera.lookAt(camLook);
      if (camera.fov !== extFov) {
        camera.fov = extFov;
      }
      applyView();
    } else if (mode === 'fly' && fly) {
      const t = clamp((now - fly.t0) / fly.dur, 0, 1);
      camera.position.copy(fly.pos(t));
      camLook.copy(fly.look(t));
      camera.lookAt(camLook);
      camera.fov = fly.fov(t);
      camera.updateProjectionMatrix();
      moving = true;
      if (t >= 1) {
        const f = fly;
        fly = null;
        f.done();
      }
    } else if (mode === 'seat' && meta) {
      if (!down && (Math.abs(seat.vy) > 1e-5 || Math.abs(seat.vp) > 1e-5)) {
        seat.yaw = clamp(seat.yaw + seat.vy, -1.9, 1.75);
        seat.pitch = clamp(seat.pitch + seat.vp, -0.75, 0.55);
        const f = Math.pow(0.004, dt);
        seat.vy *= f;
        seat.vp *= f;
        moving = true;
      }
      camera.position.copy(V(meta.eye));
      camLook.copy(camera.position).add(seatDir(tmp));
      camera.lookAt(camLook);
    }
    return moving;
  }

  function draw() {
    renderer.clear();
    renderer.render(backdrop, camera);
    const reflect = mode !== 'seat' && !(narrow && mode === 'fly');
    if (reflect) {
      car.scale.y = -1;
      car.updateMatrixWorld(true);
      camera.layers.set(1);
      renderer.render(carScene, camera);
      camera.layers.set(0);
      car.scale.y = 1;
      car.updateMatrixWorld(true);
    }
    renderer.clearDepth();
    renderer.render(floorScene, camera);
    renderer.render(carScene, camera);
  }

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!ready) return;
    if (document.hidden || (!visible && !st.seated)) return;
    if (hoverAt && !down) {
      hover(hoverAt[0], hoverAt[1]);
      hoverAt = null;
    }
    const moving = step(dt);
    if (!moving && !dirty) return;
    dirty = false;
    draw();
    opts.onHot(hots());
  };
  resize();
  tick();

  return {
    setPaint,
    setWheel,
    setInterior,
    setAmbient,
    setNight,
    setPreset,
    setShift: (x) => {
      shiftGoal = x;
      if (reduced) shift = x;
      invalidate();
    },
    toggle,
    setLights,
    setPage,
    board,
    alight,
    dispose: () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      draco.dispose();
      for (const s of [carScene, floorScene, backdrop]) {
        s.traverse((o) => {
          const m = o as T.Mesh;
          if (m.isMesh) {
            m.geometry?.dispose();
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            mats.forEach((x) => x?.dispose());
          }
        });
      }
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}

function stubCtl(): ArcCtl {
  const n = () => {};
  return { setPaint: n, setWheel: n, setInterior: n, setAmbient: n, setNight: n, setPreset: n, setShift: n, toggle: n, setLights: n, setPage: n, board: n, alight: n, dispose: n };
}
