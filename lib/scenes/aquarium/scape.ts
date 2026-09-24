import * as T from 'three';

/*
 * The aquascape that isn't Blender-made: the lit back screen, the sloped
 * sand bed, and the plants, which are instanced blades bent in the vertex
 * shader so the current moves them.
 */

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/*
 * Stones and driftwood made in Blender (tools/blender/hardscape.py): where
 * each piece stands, how it's turned, and the footprint plants keep clear of.
 */
export const HARDSCAPE: { name: string; x: number; z: number; rot: [number, number, number]; scale: number; sink: number; clear: number }[] = [
  { name: 'stone_a', x: -20, z: -26, rot: [0.05, 0.6, -0.08], scale: 1.25, sink: 3, clear: 9 },
  { name: 'stone_b', x: -5, z: -31, rot: [-0.04, 2.1, 0.1], scale: 1.15, sink: 2.5, clear: 7 },
  { name: 'stone_c', x: -34, z: -19, rot: [0.1, 4.0, 0.06], scale: 1.0, sink: 2, clear: 6 },
  { name: 'stone_d', x: 13, z: -22, rot: [0, 1.2, 0.12], scale: 1.2, sink: 1.5, clear: 4.5 },
  { name: 'stone_e', x: -9, z: -15, rot: [0.2, 0.3, 0], scale: 0.9, sink: 1, clear: 3 },
  { name: 'stone_e', x: 21, z: -13, rot: [0.1, 2.6, 0.2], scale: 0.7, sink: 1, clear: 2.5 },
  { name: 'wood_a', x: 28, z: -32, rot: [0.1, 2.6, 0.2], scale: 1.2, sink: 2, clear: 5 },
  { name: 'wood_b', x: -42, z: -36, rot: [0.1, 0.3, -0.2], scale: 1.2, sink: 2, clear: 4 },
];
export const blocked = (x: number, z: number) =>
  HARDSCAPE.some((h) => (x - h.x) ** 2 + (z - h.z) ** 2 < h.clear ** 2);

export function sandHeight(x: number, z: number) {
  // sloped back to front, with a low ridge on the left and a hollow in the middle
  const back = T.MathUtils.smoothstep(-z, 4, 44);
  let y = 1.5 + back * 9;
  y += 3.2 * Math.exp(-((x + 30) ** 2) / 400 - ((z + 26) ** 2) / 200);
  y += 2.2 * Math.exp(-((x - 34) ** 2) / 300 - ((z + 30) ** 2) / 160);
  y -= 1.2 * Math.exp(-(x ** 2) / 300 - ((z + 14) ** 2) / 120);
  y += (hash(Math.floor(x * 0.5), Math.floor(z * 0.5)) - 0.5) * 0.08;
  return y;
}

function sandTexture() {
  const size = 512;
  const data = new Uint8Array(size * size * 4);
  const palette = [
    [206, 190, 160],
    [186, 168, 138],
    [150, 136, 112],
    [226, 214, 190],
    [120, 110, 96],
    [170, 150, 120],
  ];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // grains: jittered cells, each a small rounded pebble
      const cx = Math.floor(x / 5);
      const cy = Math.floor(y / 5);
      let best = 1e9;
      let id = 0;
      let rim = 0;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const gx = cx + i;
          const gy = cy + j;
          const px = (gx + hash(gx, gy)) * 5;
          const py = (gy + hash(gy, gx + 17)) * 5;
          const d = Math.hypot(x - px, y - py);
          if (d < best) {
            rim = best - d;
            best = d;
            id = gx * 131 + gy;
          }
        }
      const c = palette[Math.floor(hash(id, 3) * palette.length)];
      const shade = 0.8 + 0.35 * hash(id, 9) - Math.max(0, 1.4 - rim) * 0.25 - best * 0.03;
      const k = (y * size + x) * 4;
      data[k] = Math.min(255, c[0] * shade);
      data[k + 1] = Math.min(255, c[1] * shade);
      data[k + 2] = Math.min(255, c[2] * shade);
      data[k + 3] = Math.min(255, (1 - best / 5) * 255);
    }
  const tex = new T.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = T.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function createSand(caustics: (s: T.WebGLProgramParametersWithUniforms) => void) {
  const geo = new T.PlaneGeometry(140, 62, 280, 124);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -21);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, sandHeight(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 9, p.getZ(i) / 9);
  const tex = sandTexture();
  const mat = new T.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 1.5, roughness: 0.95 });
  mat.onBeforeCompile = (s) => {
    caustics(s);
    // bumpMap reads red; the grain height lives in alpha
    s.fragmentShader = s.fragmentShader.replaceAll('texture2D( bumpMap, vBumpMapUv ).x', 'texture2D( bumpMap, vBumpMapUv ).a');
    s.fragmentShader = s.fragmentShader.replaceAll('texture2D( bumpMap, vBumpMapUv + dSTdx ).x', 'texture2D( bumpMap, vBumpMapUv + dSTdx ).a');
    s.fragmentShader = s.fragmentShader.replaceAll('texture2D( bumpMap, vBumpMapUv + dSTdy ).x', 'texture2D( bumpMap, vBumpMapUv + dSTdy ).a');
  };
  const mesh = new T.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** The glowing back screen of a planted tank. */
export function createBackdrop() {
  const mat = new T.ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - vec2(0.52, 0.72);
        float glow = exp(-dot(p * vec2(1.3, 2.4), p * vec2(1.3, 2.4)) * 3.0);
        vec3 deep = vec3(0.006, 0.035, 0.05);
        vec3 mid = vec3(0.03, 0.26, 0.33);
        vec3 hot = vec3(0.26, 0.6, 0.66);
        vec3 c = mix(deep, mid, smoothstep(0.0, 0.55, glow));
        c = mix(c, hot, smoothstep(0.55, 1.0, glow));
        c *= smoothstep(0.0, 0.35, vUv.y) * 0.8 + 0.2;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    fog: false,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(220, 110), mat);
  mesh.position.set(0, 30, -48);
  return mesh;
}

/*
 * Plants. Every leaf is an instance; the vertex shader bends it in world
 * space by how far it rises above its own root, so blades, stems and the
 * leaves on a stem all lean together in the same slow current. Blades that
 * reach the surface lie along it.
 *   aPlant = (sway phase, sway amount, root height, colour variation)
 */
const plantVertex = /* glsl */ `
attribute vec4 aPlant;
uniform float uTime;
uniform float uPush;
uniform vec3 uPushAt;
uniform float uSurface;
varying float vRise;
varying float vVar;
varying vec2 vLeaf;
`;
const plantBegin = /* glsl */ `
  {
    vec3 root = instanceMatrix[3].xyz;
    vec3 wp = (instanceMatrix * vec4(transformed, 1.0)).xyz;
    float rise = max(0.0, wp.y - aPlant.z);
    float k = rise / 28.0;
    float bend = k * k * aPlant.y;
    float ph = aPlant.x + root.x * 0.045 + root.z * 0.02;
    vec3 d = vec3(
      sin(uTime * 0.5 + ph) * 0.9 + sin(uTime * 1.21 + ph * 2.1) * 0.35 + 0.7,
      0.0,
      cos(uTime * 0.41 + ph * 1.3) * 0.55) * bend;
    vec2 away = wp.xz - uPushAt.xz;
    float pk = uPush * exp(-dot(away, away) / 260.0);
    d.xz += normalize(away + vec2(1e-4)) * pk * bend * 3.5;
    // what reaches the surface floats along it, downstream
    float over = max(0.0, wp.y - (uSurface - 1.5));
    d.y -= over;
    d.x += over * 0.85;
    d.z += over * 0.25 * sin(ph);
    transformed += inverse(mat3(instanceMatrix)) * d;
    vRise = rise;
    vVar = aPlant.w;
    vLeaf = uv;
  }
`;

export type Sway = {
  uTime: T.IUniform<number>;
  uPush: T.IUniform<number>;
  uPushAt: T.IUniform<T.Vector3>;
  uSurface: T.IUniform<number>;
};

type Look = {
  color: (T.ColorRepresentation)[];
  shape: string;
  shade: string;
  glow: number;
  roughness?: number;
};

function plantMaterial(sway: Sway, caustics: (s: T.WebGLProgramParametersWithUniforms) => void, look: Look) {
  const mat = new T.MeshStandardMaterial({ roughness: look.roughness ?? 0.55, side: T.DoubleSide });
  const colors = look.color.map((c) => new T.Color(c));
  const patch = (s: T.WebGLProgramParametersWithUniforms, depth = false) => {
    Object.assign(s.uniforms, sway);
    s.uniforms.uColors = { value: colors };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${plantVertex}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${plantBegin}`);
    const head = `#include <common>\nvarying float vRise;\nvarying float vVar;\nvarying vec2 vLeaf;\nuniform vec3 uColors[${colors.length}];`;
    if (depth) {
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', head)
        .replace('void main() {', `void main() {\n${look.shape}`);
      return;
    }
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', head)
      .replace('void main() {', `void main() {\n${look.shape}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${look.shade}`)
      // leaves are thin: light from the glowing back screen comes through them
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vec3(0.3, 0.6, 0.4) * ${look.glow.toFixed(2)};`,
      );
    caustics(s);
  };
  mat.onBeforeCompile = (s) => patch(s);
  // every plant shares the same patch function, so tell three the programs differ
  const key = `plant:${look.shape}:${look.shade}:${look.glow}`;
  mat.customProgramCacheKey = () => key;
  const depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
  depth.onBeforeCompile = (s) => patch(s, true);
  depth.customProgramCacheKey = () => `${key}:depth`;
  return { mat, depth };
}

function ribbon(segs: number) {
  const g = new T.PlaneGeometry(1, 1, 2, segs);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const x = p.getX(i);
    // Vallisneria spiralis twists slowly along its length and ends in a blunt tip
    const tw = y * 3.4;
    const taper = 1 - Math.pow(y, 8) * 0.6;
    p.setXYZ(i, x * Math.cos(tw) * taper, y, x * Math.sin(tw) * taper + Math.sin(y * 2.4) * 0.04);
  }
  g.computeVertexNormals();
  return g;
}

function leafQuad(bendAmt: number) {
  const g = new T.PlaneGeometry(1, 1, 2, 3);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const x = p.getX(i);
    p.setZ(i, y * y * bendAmt + Math.abs(x) * 0.15);
  }
  g.computeVertexNormals();
  return g;
}

type Placement = { pos: T.Vector3; rot: T.Euler; scale: T.Vector3; plant: [number, number, number, number] };

function instanced(
  geo: T.BufferGeometry,
  m: { mat: T.Material; depth: T.Material },
  items: Placement[],
  shadows: { cast: boolean; receive: boolean },
) {
  const mesh = new T.InstancedMesh(geo, m.mat, items.length);
  const attr = new Float32Array(items.length * 4);
  const mtx = new T.Matrix4();
  const q = new T.Quaternion();
  items.forEach((it, i) => {
    mtx.compose(it.pos, q.setFromEuler(it.rot), it.scale);
    mesh.setMatrixAt(i, mtx);
    attr.set(it.plant, i * 4);
  });
  geo.setAttribute('aPlant', new T.InstancedBufferAttribute(attr, 4));
  mesh.customDepthMaterial = m.depth;
  mesh.castShadow = shadows.cast;
  mesh.receiveShadow = shadows.receive;
  mesh.frustumCulled = false;
  return mesh;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function createPlants(
  sway: Sway,
  caustics: (s: T.WebGLProgramParametersWithUniforms) => void,
  scale = 1,
) {
  const group = new T.Group();

  // --- Vallisneria: two tall banks at the back corners
  const vallis: Placement[] = [];
  const banks: [number, number, number, number, number][] = [
    // x0, x1, z0, z1, count
    [-62, -24, -46, -32, 190],
    [24, 62, -46, -30, 170],
    [-24, -12, -46, -40, 40],
  ];
  for (const [x0, x1, z0, z1, n] of banks)
    for (let i = 0; i < Math.round(n * scale); i++) {
      // clumps: runners send up blades near each other
      const cx = rnd(x0, x1);
      const cz = rnd(z0, z1);
      for (let j = 0; j < 3; j++) {
        const x = cx + rnd(-1.2, 1.2);
        const z = cz + rnd(-1, 1);
        const y = sandHeight(x, z) - 0.6;
        const edge = Math.min(Math.abs(x - x0), Math.abs(x1 - x)) / Math.abs(x1 - x0);
        const h = rnd(18, 44) * (0.7 + edge * 0.6);
        vallis.push({
          pos: new T.Vector3(x, y, z),
          rot: new T.Euler(rnd(-0.12, 0.12), rnd(0, Math.PI), rnd(-0.15, 0.15)),
          scale: new T.Vector3(rnd(0.55, 0.85), h, 1),
          plant: [rnd(0, 6.28), rnd(1.6, 2.6), y, Math.random()],
        });
      }
    }
  group.add(
    instanced(
      ribbon(22),
      plantMaterial(sway, caustics, {
        color: [0x2f5a1c, 0x7fae3a, 0x6b6a2a],
        shape: '',
        shade: /* glsl */ `
          float t = clamp(vRise / 40.0, 0.0, 1.0);
          vec3 c = mix(uColors[0], uColors[1], smoothstep(0.0, 0.8, t) * (0.55 + vVar * 0.45));
          c = mix(c, uColors[2], step(0.86, vVar) * 0.7);
          // fine veins along the blade
          c *= 0.9 + 0.1 * sin(vLeaf.x * 40.0);
          diffuseColor.rgb = c;`,
        glow: 0.7,
      }),
      vallis,
      { cast: true, receive: true },
    ),
  );

  // --- stem plants (Rotala) with pink-orange crowns, massed at the back
  const stems: Placement[] = [];
  const clumps: [number, number, number, number, number][] = [
    [-26, -6, -44, -36, 26],
    [6, 26, -44, -34, 30],
    [-6, 6, -45, -41, 10],
  ];
  const leafGeo = leafQuad(0.3);
  for (const [x0, x1, z0, z1, n] of clumps)
    for (let i = 0; i < Math.round(n * scale); i++) {
      const x = rnd(x0, x1);
      const z = rnd(z0, z1);
      const y0 = sandHeight(x, z) - 0.4;
      const H = rnd(12, 30) * (1 - Math.abs(x - (x0 + x1) / 2) / (x1 - x0));
      const ph = rnd(0, 6.28);
      const lean = rnd(-0.12, 0.12);
      for (let y = 0.6; y < H; y += 0.75) {
        const f = y / H;
        for (let s = 0; s < 2; s++) {
          const yaw = y * 1.7 + s * Math.PI + rnd(-0.2, 0.2);
          const len = 1.3 * (1 - f * 0.45) * rnd(0.85, 1.15);
          stems.push({
            pos: new T.Vector3(x + lean * y, y0 + y, z),
            rot: new T.Euler(1.1 - f * 0.5, yaw, 0, 'YXZ'),
            scale: new T.Vector3(len * 0.42, len, len),
            plant: [ph, 1.2, y0, f],
          });
        }
      }
    }
  group.add(
    instanced(
      leafGeo,
      plantMaterial(sway, caustics, {
        color: [0x3f7a26, 0x93b83c, 0xd9774a, 0xe8a07a],
        shape: /* glsl */ `
          { vec2 q = vLeaf * 2.0 - 1.0; q.y = vLeaf.y * 2.0 - 1.0;
            if (q.x * q.x + q.y * q.y * 0.9 > 1.0) discard; }`,
        shade: /* glsl */ `
          vec3 c = mix(uColors[0], uColors[1], smoothstep(0.0, 0.6, vVar));
          c = mix(c, mix(uColors[2], uColors[3], vLeaf.y), smoothstep(0.62, 0.95, vVar));
          c *= 0.85 + 0.25 * (1.0 - abs(vLeaf.x - 0.5) * 2.0);
          diffuseColor.rgb = c;`,
        glow: 0.55,
      }),
      stems,
      { cast: true, receive: true },
    ),
  );

  // --- a carpet of tiny round leaves (Monte Carlo) over the foreground
  const carpet: Placement[] = [];
  const total = Math.round(26000 * scale);
  const round = leafQuad(0.1);
  let tries = 0;
  while (carpet.length < total && tries++ < total * 4) {
    const x = rnd(-64, 64);
    const z = rnd(-36, -1);
    // a path of bare sand winds through the middle
    const path = Math.abs(x - Math.sin(z * 0.1) * 9 - 6) < 5 + (z + 36) * 0.18;
    if (path || blocked(x, z)) continue;
    const mound = 1.2 + 2.2 * (Math.sin(x * 0.21 + z * 0.13) * 0.5 + 0.5) * (Math.sin(x * 0.07 - z * 0.3) * 0.5 + 0.5);
    const edge = T.MathUtils.clamp((Math.abs(x - Math.sin(z * 0.1) * 9 - 6) - 5 - (z + 36) * 0.18) / 4, 0, 1);
    const base = sandHeight(x, z);
    const f = Math.random();
    const y = base + mound * edge * Math.sqrt(f);
    const size = rnd(0.55, 0.85);
    carpet.push({
      pos: new T.Vector3(x, y, z),
      rot: new T.Euler(rnd(-1.2, -0.2), rnd(0, Math.PI * 2), 0, 'YXZ'),
      scale: new T.Vector3(size, size, size),
      plant: [rnd(0, 6.28), 0.05, base, Math.sqrt(f)],
    });
  }
  group.add(
    instanced(
      round,
      plantMaterial(sway, caustics, {
        color: [0x1f4a14, 0x5f9f2c, 0x9bd04a],
        shape: /* glsl */ `
          { vec2 q = vLeaf * 2.0 - 1.0; if (dot(q, q) > 1.0) discard; }`,
        shade: /* glsl */ `
          vec3 c = mix(uColors[0], uColors[1], smoothstep(0.0, 0.8, vVar));
          c = mix(c, uColors[2], smoothstep(0.85, 1.0, vVar) * 0.5);
          diffuseColor.rgb = c;`,
        glow: 0.25,
        roughness: 0.45,
      }),
      carpet,
      { cast: false, receive: true },
    ),
  );

  // --- Amazon swords: a rosette of broad leaves at each side
  const swordLeaf = new T.PlaneGeometry(1, 1, 6, 12);
  swordLeaf.translate(0, 0.5, 0);
  {
    const p = swordLeaf.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const w = Math.sin(Math.min(1, y * 1.02) * Math.PI) ** 0.75 * (y > 0.12 ? 1 : 0.12 + y * 0.5);
      const x = p.getX(i) * w;
      p.setXYZ(i, x, y, y * y * 0.5 + Math.abs(x) * 0.35 - Math.abs(x) ** 2 * 0.4);
    }
    swordLeaf.computeVertexNormals();
  }
  const swords: Placement[] = [];
  for (const [x, z, s] of [
    [-40, -30, 1.0],
    [44, -26, 0.9],
  ] as const) {
    const y = sandHeight(x, z) - 0.3;
    for (let i = 0; i < 20; i++) {
      const f = i / 20;
      const len = rnd(13, 19) * s * (1.25 - f * 0.5);
      swords.push({
        pos: new T.Vector3(x, y, z),
        rot: new T.Euler(0.25 + f * 0.85 + rnd(-0.1, 0.1), f * Math.PI * 2 * 2.618, 0, 'YXZ'),
        scale: new T.Vector3(len * 0.26, len, len),
        plant: [rnd(0, 6.28), 0.9, y, Math.random()],
      });
    }
  }
  group.add(
    instanced(
      swordLeaf,
      plantMaterial(sway, caustics, {
        color: [0x2b5a1e, 0x5c9a33, 0x9ccc5e],
        shape: '',
        shade: /* glsl */ `
          float mid = 1.0 - smoothstep(0.0, 0.06, abs(vLeaf.x - 0.5));
          float veins = smoothstep(0.92, 1.0, sin((vLeaf.y * 14.0 - abs(vLeaf.x - 0.5) * 9.0) * 3.14159));
          vec3 c = mix(uColors[0], uColors[1], 0.4 + 0.6 * vLeaf.y) * (0.9 + vVar * 0.2);
          c = mix(c, uColors[2], mid * 0.6 + veins * 0.15);
          diffuseColor.rgb = c;`,
        glow: 0.45,
        roughness: 0.35,
      }),
      swords,
      { cast: true, receive: true },
    ),
  );

  return group;
}

export async function loadHardscape(
  base: string,
  env: T.Texture,
  caustics: (s: T.WebGLProgramParametersWithUniforms) => void,
) {
  const { gltfLoader } = await import('./fish');
  const loader = gltfLoader(base);
  const names = [...new Set(HARDSCAPE.map((h) => h.name))];
  const models = new Map(
    await Promise.all(names.map(async (n) => [n, (await loader.loadAsync(`${base}/${n}.glb`)).scene] as const)),
  );
  const group = new T.Group();
  for (const h of HARDSCAPE) {
    const piece = models.get(h.name)!.clone(true);
    piece.traverse((o) => {
      const m = o as T.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as T.MeshStandardMaterial).clone();
      mat.envMap = env;
      mat.envMapIntensity = 0.5;
      mat.roughness = 0.82;
      mat.onBeforeCompile = caustics;
      m.material = mat;
      m.castShadow = true;
      m.receiveShadow = true;
    });
    piece.scale.setScalar(h.scale);
    piece.rotation.set(...h.rot);
    piece.position.set(h.x, sandHeight(h.x, h.z) - h.sink, h.z);
    group.add(piece);
  }
  return group;
}
