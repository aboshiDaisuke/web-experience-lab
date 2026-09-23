import * as T from 'three';

/*
 * The hero: every work is printed on a sheet of paper. On load the sheets
 * rain down and settle into a pile; the visitor can pinch the top sheet,
 * lift it (it bends like paper, casting a real shadow) and fling it away
 * to reveal the next work. Verlet cloth with per-triangle air drag, a
 * per-sheet floor height for stacking, and a tether constraint so a
 * pinched corner never stretches the paper.
 */

type Events = {
  onTop: (index: number) => void;
  onHover: (index: number) => void;
  onOpen: (index: number) => void;
  onGrab: (grabbing: boolean) => void;
};

const NX = 30;
const NY = 19;
const COUNT = NX * NY;
const W = 4.8;
const D = 3;
const GAP = 0.02;
const GRAVITY = -24;
const AIR = 6.5;
const ITER = 12;
const H = 1 / 60;
const LIFT = 1.2;
const ELEVATION = T.MathUtils.degToRad(57);
const PARTICLE_AREA = (W * D) / COUNT;
const FLATTEN = 0.07;

const restX = new Float32Array(COUNT);
const restZ = new Float32Array(COUNT);
const uvs = new Float32Array(COUNT * 2);
for (let j = 0; j < NY; j++)
  for (let i = 0; i < NX; i++) {
    const k = j * NX + i;
    restX[k] = (i / (NX - 1) - 0.5) * W;
    restZ[k] = (j / (NY - 1) - 0.5) * D;
    uvs[k * 2] = i / (NX - 1);
    uvs[k * 2 + 1] = 1 - j / (NY - 1);
  }

const triList: number[] = [];
for (let j = 0; j < NY - 1; j++)
  for (let i = 0; i < NX - 1; i++) {
    const a = j * NX + i;
    triList.push(a, a + NX, a + 1, a + 1, a + NX, a + NX + 1);
  }
const tris = Uint16Array.from(triList);

const linkList: number[] = [];
const stiffList: number[] = [];
const link = (a: number, b: number, k: number) => {
  linkList.push(a, b);
  stiffList.push(k);
};
for (let j = 0; j < NY; j++)
  for (let i = 0; i < NX; i++) {
    const k = j * NX + i;
    if (i < NX - 1) link(k, k + 1, 1);
    if (j < NY - 1) link(k, k + NX, 1);
    if (i < NX - 1 && j < NY - 1) {
      link(k, k + NX + 1, 0.9);
      link(k + 1, k + NX, 0.9);
    }
    // skip-one links give the sheet paper-like bending stiffness
    if (i < NX - 2) link(k, k + 2, 0.55);
    if (j < NY - 2) link(k, k + NX * 2, 0.55);
  }
const links = Uint16Array.from(linkList);
const stiff = Float32Array.from(stiffList);
const rest = new Float32Array(stiff.length);
for (let l = 0; l < stiff.length; l++) {
  const a = links[l * 2];
  const b = links[l * 2 + 1];
  rest[l] = Math.hypot(restX[a] - restX[b], restZ[a] - restZ[b]);
}

type Sheet = {
  index: number;
  mesh: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  pos: Float32Array;
  prev: Float32Array;
  acc: Float32Array;
  level: number;
  awake: boolean;
  calm: number;
  dropAt: number;
  landing: boolean;
  tossedAt: number;
  land: [number, number];
};

type Grab = {
  sheet: Sheet;
  primary: number;
  pinned: number[];
  offsets: Float32Array;
  tether: Float32Array;
  target: T.Vector3;
  baseY: number;
  startedAt: number;
  history: { t: number; x: number; z: number }[];
  script?: {
    path: (t: number) => T.Vector3;
    duration: number;
    toss: T.Vector3 | null;
  };
};

const euler = new T.Euler();
const mat = new T.Matrix4();
const v3 = new T.Vector3();

function pose(s: Sheet, x: number, y: number, z: number, yaw: number, rx = 0, rz = 0) {
  mat.makeRotationFromEuler(euler.set(rx, yaw, rz));
  for (let k = 0; k < COUNT; k++) {
    v3.set(restX[k], 0, restZ[k]).applyMatrix4(mat);
    s.pos[k * 3] = s.prev[k * 3] = v3.x + x;
    s.pos[k * 3 + 1] = s.prev[k * 3 + 1] = v3.y + y;
    s.pos[k * 3 + 2] = s.prev[k * 3 + 2] = v3.z + z;
  }
}

// Paper wants to be flat: pull every particle toward the best-fit rigid pose
// of the flat rest sheet (shape matching). Rest is planar, so the rotation's
// x and z axes come straight from the covariance columns.
function flatten(s: Sheet, amount: number) {
  const { pos } = s;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let k = 0; k < COUNT * 3; k += 3) {
    cx += pos[k];
    cy += pos[k + 1];
    cz += pos[k + 2];
  }
  cx /= COUNT;
  cy /= COUNT;
  cz /= COUNT;
  let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
  for (let k = 0; k < COUNT; k++) {
    const px = pos[k * 3] - cx;
    const py = pos[k * 3 + 1] - cy;
    const pz = pos[k * 3 + 2] - cz;
    ax += px * restX[k];
    ay += py * restX[k];
    az += pz * restX[k];
    bx += px * restZ[k];
    by += py * restZ[k];
    bz += pz * restZ[k];
  }
  let l = Math.hypot(ax, ay, az) || 1;
  ax /= l;
  ay /= l;
  az /= l;
  const dot = bx * ax + by * ay + bz * az;
  bx -= dot * ax;
  by -= dot * ay;
  bz -= dot * az;
  l = Math.hypot(bx, by, bz) || 1;
  bx /= l;
  by /= l;
  bz /= l;
  for (let k = 0; k < COUNT; k++) {
    const gx = cx + ax * restX[k] + bx * restZ[k];
    const gy = cy + ay * restX[k] + by * restZ[k];
    const gz = cz + az * restX[k] + bz * restZ[k];
    pos[k * 3] += (gx - pos[k * 3]) * amount;
    pos[k * 3 + 1] += (gy - pos[k * 3 + 1]) * amount;
    pos[k * 3 + 2] += (gz - pos[k * 3 + 2]) * amount;
  }
}

function step(s: Sheet, grab: Grab | null) {
  const { pos, prev, acc } = s;
  // a flung sheet should sail off, not parachute back onto the pile
  const air = s.tossedAt >= 0 ? AIR * 0.2 : AIR;
  acc.fill(0);
  // air drag against each triangle's normal: flat paper floats, tilted paper glides
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t] * 3;
    const b = tris[t + 1] * 3;
    const c = tris[t + 2] * 3;
    const e1x = pos[b] - pos[a];
    const e1y = pos[b + 1] - pos[a + 1];
    const e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a];
    const e2y = pos[c + 1] - pos[a + 1];
    const e2z = pos[c + 2] - pos[a + 2];
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) continue;
    nx /= len;
    ny /= len;
    nz /= len;
    const vx = pos[a] - prev[a] + pos[b] - prev[b] + pos[c] - prev[c];
    const vy = pos[a + 1] - prev[a + 1] + pos[b + 1] - prev[b + 1] + pos[c + 1] - prev[c + 1];
    const vz = pos[a + 2] - prev[a + 2] + pos[b + 2] - prev[b + 2] + pos[c + 2] - prev[c + 2];
    const vn = (vx * nx + vy * ny + vz * nz) / (3 * H);
    const f = (-air * vn * len * 0.5) / PARTICLE_AREA / 3;
    for (const p of [a, b, c]) {
      acc[p] += f * nx;
      acc[p + 1] += f * ny;
      acc[p + 2] += f * nz;
    }
  }
  if (s.landing && grab?.sheet !== s) {
    // keep falling sheets drifting toward their spot on the pile
    const m = (COUNT >> 1) * 3;
    const ax = (s.land[0] - pos[m]) * 7 - ((pos[m] - prev[m]) / H) * 4.5;
    const az = (s.land[1] - pos[m + 2]) * 7 - ((pos[m + 2] - prev[m + 2]) / H) * 4.5;
    for (let k = 0; k < COUNT; k++) {
      acc[k * 3] += ax;
      acc[k * 3 + 2] += az;
    }
  }
  const hh = H * H;
  for (let k = 0; k < COUNT * 3; k += 3) {
    const vx = (pos[k] - prev[k]) * 0.994;
    const vy = (pos[k + 1] - prev[k + 1]) * 0.994;
    const vz = (pos[k + 2] - prev[k + 2]) * 0.994;
    prev[k] = pos[k];
    prev[k + 1] = pos[k + 1];
    prev[k + 2] = pos[k + 2];
    pos[k] += vx + acc[k] * hh;
    pos[k + 1] += vy + (acc[k + 1] + GRAVITY) * hh;
    pos[k + 2] += vz + acc[k + 2] * hh;
  }
  flatten(s, grab?.sheet === s ? FLATTEN * 0.35 : FLATTEN);
  const floor = s.level * GAP;
  const held = grab?.sheet === s ? grab : null;
  for (let it = 0; it < ITER; it++) {
    for (let l = 0; l < stiff.length; l++) {
      const a = links[l * 2] * 3;
      const b = links[l * 2 + 1] * 3;
      const dx = pos[b] - pos[a];
      const dy = pos[b + 1] - pos[a + 1];
      const dz = pos[b + 2] - pos[a + 2];
      const d = Math.hypot(dx, dy, dz) || 1e-6;
      const k = ((d - rest[l]) / d) * 0.5 * stiff[l];
      pos[a] += dx * k;
      pos[a + 1] += dy * k;
      pos[a + 2] += dz * k;
      pos[b] -= dx * k;
      pos[b + 1] -= dy * k;
      pos[b + 2] -= dz * k;
    }
    if (held) {
      held.pinned.forEach((p, n) => {
        pos[p * 3] = held.target.x + held.offsets[n * 3];
        pos[p * 3 + 1] = held.target.y + held.offsets[n * 3 + 1];
        pos[p * 3 + 2] = held.target.z + held.offsets[n * 3 + 2];
      });
      const g = held.primary * 3;
      for (let k = 0; k < COUNT; k++) {
        const dx = pos[k * 3] - pos[g];
        const dy = pos[k * 3 + 1] - pos[g + 1];
        const dz = pos[k * 3 + 2] - pos[g + 2];
        const d = Math.hypot(dx, dy, dz);
        const r = held.tether[k];
        if (d > r && d > 1e-6) {
          const f = r / d;
          pos[k * 3] = pos[g] + dx * f;
          pos[k * 3 + 1] = pos[g + 1] + dy * f;
          pos[k * 3 + 2] = pos[g + 2] + dz * f;
        }
      }
    }
    for (let k = 1; k < COUNT * 3; k += 3) if (pos[k] < floor) pos[k] = floor;
  }
  let motion = 0;
  let contacts = 0;
  for (let k = 0; k < COUNT * 3; k += 3) {
    if (pos[k + 1] <= floor + 1e-4 && s.tossedAt < 0) {
      contacts++;
      // paper on paper: friction kills sliding, the landing is inelastic
      prev[k] = pos[k] - (pos[k] - prev[k]) * 0.35;
      prev[k + 2] = pos[k + 2] - (pos[k + 2] - prev[k + 2]) * 0.35;
      prev[k + 1] = pos[k + 1];
    }
    motion = Math.max(
      motion,
      Math.abs(pos[k] - prev[k]) + Math.abs(pos[k + 1] - prev[k + 1]) + Math.abs(pos[k + 2] - prev[k + 2]),
    );
  }
  // guidance only steers the fall; once the paper touches down it is on its own
  if (contacts > COUNT * 0.2) s.landing = false;
  s.calm = motion < 6e-4 ? s.calm + 1 : 0;
}

export async function mountPaperStack(el: HTMLDivElement, images: string[], events: Events) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => el.clientWidth / el.clientHeight < 1.05;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, narrow() ? 1.75 : 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  el.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 0.5, 120);
  scene.add(new T.AmbientLight('#dfe3ff', Math.PI * 0.42));
  const sun = new T.DirectionalLight('#ffffff', Math.PI * 0.72);
  sun.position.set(-5, 12, 6.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 6;
  scene.add(sun);
  const table = new T.Mesh(
    new T.PlaneGeometry(120, 120),
    new T.ShadowMaterial({ color: '#03050f', opacity: 0.55 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.004;
  table.receiveShadow = true;
  scene.add(table);

  const loader = new T.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const maps = await Promise.all(
    images.map(
      (src) =>
        new Promise<T.Texture>((resolve, reject) =>
          loader.load(
            src,
            (t) => {
              t.colorSpace = T.SRGBColorSpace;
              t.anisotropy = aniso;
              resolve(t);
            },
            undefined,
            reject,
          ),
        ),
    ),
  );

  const n = images.length;
  const sheets: Sheet[] = maps.map((map, index) => {
    const pos = new Float32Array(COUNT * 3);
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('uv', new T.BufferAttribute(uvs, 2));
    geo.setIndex(new T.BufferAttribute(tris, 1));
    const material = new T.MeshStandardMaterial({ map, roughness: 0.86, side: T.DoubleSide });
    material.onBeforeCompile = (shader) => {
      // the back of each sheet is plain paper, not a mirrored screenshot
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
        'vec4 sampledDiffuseColor = gl_FrontFacing ? texture2D( map, vMapUv ) : vec4( 0.9, 0.91, 0.95, 1.0 );',
      );
    };
    const mesh = new T.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.userData.index = index;
    scene.add(mesh);
    // project 0 lands last, so it is the first thing on top of the pile
    const level = n - 1 - index;
    return {
      index,
      mesh,
      pos,
      prev: new Float32Array(COUNT * 3),
      acc: new Float32Array(COUNT * 3),
      level,
      awake: false,
      calm: 0,
      dropAt: 0,
      landing: false,
      tossedAt: -1,
      land: [0, 0],
    };
  });

  const jitter = () => [(Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.36] as const;
  let spawnY = 8;
  const refresh = (s: Sheet) => {
    const g = s.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  };

  const layout = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    const t = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    const wide = !narrow();
    const byWidth = (W * 1.2) / ((wide ? 0.4 : 0.84) * 2 * t * aspect);
    const byHeight = (D * 1.25) / ((wide ? 0.5 : 0.36) * 2 * t);
    const dist = Math.max(byWidth, byHeight);
    camera.position.set(0, Math.sin(ELEVATION) * dist, Math.cos(ELEVATION) * dist);
    camera.lookAt(0, 0, 0);
    if (wide) camera.setViewOffset(w, h, -w * 0.225, h * 0.03, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.1, w, h);
    camera.updateProjectionMatrix();
    spawnY = Math.min(dist * 0.62, 9.5);
  };
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(el);

  let simTime = 0;
  sheets.forEach((s) => {
    const [x, z, yaw] = jitter();
    s.land = [x, z];
    if (reduced) {
      pose(s, x, s.level * GAP, z, yaw);
    } else {
      // staggered drop, each sheet tilted so it flutters on the way down
      s.dropAt = 0.2 + s.level * 0.16;
      s.landing = true;
      s.awake = true;
      s.mesh.visible = false;
      pose(
        s,
        x + (Math.random() - 0.5) * 2,
        spawnY + Math.random() * 1.5,
        z - 0.6 - Math.random(),
        yaw + (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
      );
    }
    refresh(s);
  });

  const alive = () => sheets.filter((s) => s.tossedAt < 0);
  const topSheet = () => alive().reduce((a, b) => (b.level > a.level ? b : a));
  let reportedTop = -1;
  const reportTop = () => {
    const t = topSheet().index;
    if (t !== reportedTop) {
      reportedTop = t;
      events.onTop(t);
    }
  };
  reportTop();

  let grab: Grab | null = null;
  const startGrab = (s: Sheet, primary: number, at: T.Vector3, script?: Grab['script']) => {
    const pinned: number[] = [];
    for (let k = 0; k < COUNT; k++)
      if (Math.hypot(restX[k] - restX[primary], restZ[k] - restZ[primary]) < 0.42) pinned.push(k);
    const offsets = new Float32Array(pinned.length * 3);
    pinned.forEach((p, i) => {
      offsets[i * 3] = s.pos[p * 3] - at.x;
      offsets[i * 3 + 1] = s.pos[p * 3 + 1] - at.y;
      offsets[i * 3 + 2] = s.pos[p * 3 + 2] - at.z;
    });
    const tether = new Float32Array(COUNT);
    for (let k = 0; k < COUNT; k++)
      tether[k] = Math.hypot(restX[k] - restX[primary], restZ[k] - restZ[primary]) * 1.004;
    s.awake = true;
    s.calm = 0;
    grab = {
      sheet: s,
      primary,
      pinned,
      offsets,
      tether,
      target: at.clone(),
      baseY: at.y,
      startedAt: simTime,
      history: [],
      script,
    };
  };

  const toss = (s: Sheet, from: number, v: T.Vector3) => {
    for (let k = 0; k < COUNT; k++) {
      const r = Math.hypot(restX[k] - restX[from], restZ[k] - restZ[from]);
      const w = 1 - 0.6 * Math.min(1, r / W);
      s.prev[k * 3] = s.pos[k * 3] - v.x * H * w;
      s.prev[k * 3 + 1] = s.pos[k * 3 + 1] - v.y * H * w;
      s.prev[k * 3 + 2] = s.pos[k * 3 + 2] - v.z * H * w;
    }
    s.tossedAt = simTime;
    s.awake = true;
    reportTop();
  };

  const release = () => {
    if (!grab) return;
    const g = grab;
    grab = null;
    events.onGrab(false);
    if (g.script) {
      if (g.script.toss) toss(g.sheet, g.primary, g.script.toss);
      return;
    }
    const h = g.history;
    const first = h[0];
    const last = h[h.length - 1];
    const v = new T.Vector3();
    if (first && last && last.t > first.t)
      v.set((last.x - first.x) / (last.t - first.t), 0, (last.z - first.z) / (last.t - first.t));
    const m = (COUNT >> 1) * 3;
    const off = new T.Vector3(g.sheet.pos[m] - g.sheet.land[0], 0, g.sheet.pos[m + 2] - g.sheet.land[1]);
    if (v.length() > 6 || off.length() > 1.7) {
      const dir = v.length() > 3 ? v.clone().normalize() : off.normalize();
      const speed = Math.max(13, v.length() * 1.15);
      toss(g.sheet, g.primary, dir.multiplyScalar(speed).setY(3.5));
    }
  };

  const recycle = (s: Sheet) => {
    sheets.forEach((o) => {
      if (o === s) return;
      o.level += 1;
      for (let k = 1; k < COUNT * 3; k += 3) {
        o.pos[k] += GAP;
        o.prev[k] += GAP;
      }
      refresh(o);
    });
    const [x, z, yaw] = jitter();
    s.level = 0;
    s.land = [x, z];
    s.tossedAt = -1;
    s.awake = false;
    s.calm = 0;
    pose(s, x, 0, z, yaw);
    refresh(s);
  };

  // pointer
  const ray = new T.Raycaster();
  const ndc = new T.Vector2(9, 9);
  const plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  let touched = false;
  let press: {
    x: number;
    y: number;
    at: number;
    sheet: Sheet;
    hit: T.Intersection;
  } | null = null;
  const toNdc = (x: number, y: number) => {
    const r = el.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  };
  const pick = () => {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(
      alive().map((s) => s.mesh),
      false,
    )[0];
    return hit ? { hit, sheet: sheets[hit.object.userData.index as number] } : null;
  };
  let hovered = -1;
  const setHover = (i: number) => {
    if (i === hovered) return;
    hovered = i;
    events.onHover(i);
  };
  const onMove = (e: PointerEvent) => {
    toNdc(e.clientX, e.clientY);
    if (press && !grab && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) {
      if (press.sheet === topSheet()) {
        const { face, point } = press.hit;
        const pos = press.sheet.pos;
        const dist = (k: number) => v3.fromArray(pos, k * 3).distanceTo(point);
        const primary = [face!.a, face!.b, face!.c].reduce((a, b) => (dist(b) < dist(a) ? b : a));
        startGrab(press.sheet, primary, point);
        setHover(-1);
        events.onGrab(true);
        el.style.cursor = 'grabbing';
      }
      press = null;
    }
    if (grab && !grab.script) {
      const lift = Math.min(1, (simTime - grab.startedAt) / 0.28);
      plane.constant = -(grab.baseY + LIFT * (1 - (1 - lift) ** 3));
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(plane, v3)) grab.target.copy(v3);
      return;
    }
    const p = pick();
    const top = p?.sheet === topSheet();
    setHover(p ? p.sheet.index : -1);
    el.style.cursor = top ? 'grab' : p ? 'pointer' : '';
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    toNdc(e.clientX, e.clientY);
    const p = pick();
    if (!p) return;
    touched = true;
    press = { x: e.clientX, y: e.clientY, at: performance.now(), ...p };
    el.setPointerCapture(e.pointerId);
  };
  const onUp = (e: PointerEvent) => {
    if (grab && !grab.script) {
      release();
      setHover(-1);
      el.style.cursor = '';
    } else if (press && performance.now() - press.at < 500) {
      events.onOpen(press.sheet.index);
    }
    press = null;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  };
  const onCancel = () => {
    press = null;
    if (grab && !grab.script) release();
  };
  const onLeave = () => {
    if (!grab) setHover(-1);
  };
  // on touch, only block page scroll when the finger lands on the paper
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    toNdc(t.clientX, t.clientY);
    if (pick()?.sheet === topSheet()) e.preventDefault();
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('touchstart', onTouchStart, { passive: false });

  // scripted gestures: an idle corner lift that invites a touch, and "next" for keyboards
  const corner = (s: Sheet) => {
    // whichever corner is nearest the viewer's lower right
    const cands = [0, NX - 1, COUNT - NX, COUNT - 1];
    return cands.reduce((a, b) =>
      s.pos[b * 3] + s.pos[b * 3 + 2] > s.pos[a * 3] + s.pos[a * 3 + 2] ? b : a,
    );
  };
  const poke = () => {
    const s = topSheet();
    const k = corner(s);
    const o = new T.Vector3().fromArray(s.pos, k * 3);
    startGrab(s, k, o, {
      duration: 1.5,
      toss: null,
      path: (t) => {
        const l = Math.sin(Math.PI * Math.min(1, t / 1.5)) ** 2;
        return o.clone().add(new T.Vector3(-0.55 * l, 0.95 * l, -0.4 * l));
      },
    });
  };
  const flip = () => {
    if (grab) return;
    touched = true;
    const s = topSheet();
    const k = corner(s);
    const o = new T.Vector3().fromArray(s.pos, k * 3);
    startGrab(s, k, o, {
      duration: 0.5,
      toss: new T.Vector3(12, 5, -3),
      path: (t) => {
        const e = (t / 0.5) ** 2;
        return o.clone().add(new T.Vector3(-1.2 * e, 2.4 * e, -1.1 * e));
      },
    });
  };

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(el);

  let settledAt = -1;
  let nextPoke = 0;
  let pokes = 0;
  let acc = 0;
  let last = performance.now();
  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible || document.hidden) return;
    acc += dt;
    const touchedSheets = new Set<Sheet>();
    let steps = 0;
    while (acc >= H && steps < 3) {
      acc -= H;
      steps++;
      simTime += H;
      const g = grab as Grab | null;
      if (g?.script) {
        const t = simTime - g.startedAt;
        g.target.copy(g.script.path(Math.min(t, g.script.duration)));
        if (t >= g.script.duration) release();
      } else if (g) {
        g.history.push({ t: simTime, x: g.target.x, z: g.target.z });
        while (g.history.length > 1 && simTime - g.history[0].t > 0.09) g.history.shift();
      }
      for (const s of sheets) {
        if (!s.awake) continue;
        if (s.dropAt > simTime) continue;
        s.mesh.visible = true;
        step(s, grab);
        touchedSheets.add(s);
        if (s.calm > 40 && grab?.sheet !== s && s.tossedAt < 0) {
          s.awake = false;
          s.dropAt = 0;
          s.prev.set(s.pos);
        }
      }
    }
    if (acc > H) acc = 0;
    touchedSheets.forEach(refresh);

    for (const s of sheets) {
      if (s.tossedAt < 0) {
        // sheets fade in as they are released, so a low spawn never pops
        const fade = s.landing ? T.MathUtils.clamp((simTime - s.dropAt) / 0.3, 0, 1) : 1;
        s.mesh.material.transparent = fade < 1;
        s.mesh.material.opacity = fade;
        continue;
      }
      v3.fromArray(s.pos, (COUNT >> 1) * 3).project(camera);
      const material = s.mesh.material;
      const age = simTime - s.tossedAt;
      material.transparent = age > 0.9;
      material.opacity = 1 - T.MathUtils.clamp((age - 0.9) / 0.35, 0, 1);
      if (Math.abs(v3.x) > 1.6 || Math.abs(v3.y) > 1.6 || material.opacity <= 0) {
        material.transparent = false;
        material.opacity = 1;
        recycle(s);
      }
    }

    // after the pile settles, lift a corner now and then until someone touches it
    const settled = sheets.every((s) => !s.awake);
    if (settled && settledAt < 0) {
      settledAt = simTime;
      nextPoke = simTime + 1.2;
    }
    if (!reduced && !touched && settledAt >= 0 && !grab && pokes < 3 && simTime > nextPoke) {
      poke();
      pokes++;
      nextPoke = simTime + 6.5;
    }
    renderer.render(scene, camera);
  };
  tick();

  return {
    flip,
    dispose: () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('touchstart', onTouchStart);
      sheets.forEach((s) => {
        s.mesh.geometry.dispose();
        s.mesh.material.map?.dispose();
        s.mesh.material.dispose();
      });
      table.geometry.dispose();
      table.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
