import * as T from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { waterGlsl } from './water';

/*
 * The aquascape that isn't Blender-made: the lit back screen, the sloped
 * sand bed, and the plants, which are instanced blades bent in the vertex
 * shader so the current moves them.
 */

/*
 * Surface detail too fine to model: value noise in world space, and a bump
 * from any height field by its screen-space derivatives (Mikkelsen's
 * unparametrized bump mapping), so it needs no UVs or tangents.
 */
export const detailGlsl = /* glsl */ `
float dHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float dNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dHash(i), dHash(i + vec3(1, 0, 0)), f.x), mix(dHash(i + vec3(0, 1, 0)), dHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(dHash(i + vec3(0, 0, 1)), dHash(i + vec3(1, 0, 1)), f.x), mix(dHash(i + vec3(0, 1, 1)), dHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float dFbm(vec3 p) {
  float t = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { t += a * dNoise(p); p = p * 2.03 + 7.1; a *= 0.5; }
  return t / 0.9375;
}
vec3 dBump(vec3 n, float h, float amount) {
  vec3 dpdx = dFdx(-vViewPosition);
  vec3 dpdy = dFdy(-vViewPosition);
  vec3 r1 = cross(dpdy, n);
  vec3 r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - grad * amount);
}
`;

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
/*
 * The surface mirrors only what's high enough for a glancing reflection to
 * reach: low things (sand, carpet, the foreground plants) go on this layer,
 * which the camera sees and the mirror doesn't.
 */
export const LOW = 1;

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
  // a light river sand: mostly quartz, some feldspar, the odd dark grain
  const palette = [
    [236, 224, 200],
    [218, 202, 172],
    [196, 180, 150],
    [248, 242, 228],
    [150, 136, 118],
    [214, 190, 154],
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
  // where each stone and root meets the bed: centre and footprint
  const feet = HARDSCAPE.map((h) => new T.Vector3(h.x, h.z, h.clear));
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
    s.uniforms.uFeet = { value: feet };
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uFeet[${feet.length}];\n${detailGlsl}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          // little light reaches the sand tucked in at a stone's foot, and
          // mulm settles there; elsewhere the bed is mottled, never one tone
          float shade = 1.0;
          for (int i = 0; i < ${feet.length}; i++) {
            float d = length(vCausticPos.xz - uFeet[i].xy) / uFeet[i].z;
            shade *= mix(0.45, 1.0, smoothstep(0.8, 1.7, d));
          }
          float mott = dFbm(vCausticPos * 0.18);
          diffuseColor.rgb *= shade * (0.86 + 0.24 * mott);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.72, 0.6), (1.0 - shade) * 0.6);
        }`,
      );
    // bumpMap reads red; the grain height lives in alpha
    s.fragmentShader = s.fragmentShader.replaceAll('texture2D( bumpMap, vBumpMapUv ).x', 'texture2D( bumpMap, vBumpMapUv ).a');
    s.fragmentShader = s.fragmentShader.replaceAll('texture2D( bumpMap, vBumpMapUv + dSTdx ).x', 'texture2D( bumpMap, vBumpMapUv + dSTdx ).a');
    s.fragmentShader = s.fragmentShader.replaceAll('texture2D( bumpMap, vBumpMapUv + dSTdy ).x', 'texture2D( bumpMap, vBumpMapUv + dSTdy ).a');
  };
  const mesh = new T.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.layers.set(LOW);
  return mesh;
}

/**
 * The back screen of a planted tank: frosted film lit from behind, brightest
 * high in the middle, seen through the whole depth of the water.
 */
export function createBackdrop(surface: number, back: number) {
  const mat = new T.ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      ${waterGlsl(surface)}
      varying vec3 vW;
      void main() {
        vec2 p = (vW.xy - vec2(6.0, ${(surface - 4).toFixed(1)})) / vec2(95.0, 42.0);
        float glow = exp(-dot(p, p) * 1.6);
        vec3 c = mix(vec3(0.04, 0.14, 0.19), vec3(0.62, 1.0, 1.15), glow);
        // the film's lamp sits just above the waterline
        c += vec3(0.5, 0.6, 0.6) * smoothstep(${(surface - 16).toFixed(1)}, ${surface.toFixed(1)}, vW.y) * glow;
        c *= 0.35 + 0.65 * smoothstep(0.0, 26.0, vW.y);
        gl_FragColor = vec4(waterTint(c, vW), 1.0);
      }`,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(240, 110), mat);
  mesh.position.set(0, 30, back);
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
  // shade down in the bed: [darkest, height over the root it clears by]
  ao: [number, number];
  // share of the lamp that comes through a leaf lit from behind
  through: number;
};

// light reaching a leaf from its far side shows through it, warmed green by
// the chlorophyll; the lower, crowded leaves get little of it
const leafThrough = /* glsl */ `#include <lights_fragment_end>
  #if NUM_DIR_LIGHTS > 0
  {
    float through = max(0.0, -dot(normal, directionalLights[0].direction));
    float open = smoothstep(0.0, uAo.y * 1.5, vRise);
    reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.9, 1.1, 0.6) * directionalLights[0].color
      * causticLight * through * open * uThrough;
  }
  #endif`;

function plantMaterial(sway: Sway, caustics: (s: T.WebGLProgramParametersWithUniforms) => void, look: Look) {
  const mat = new T.MeshStandardMaterial({ roughness: look.roughness ?? 0.55, side: T.DoubleSide });
  const colors = look.color.map((c) => new T.Color(c));
  const patch = (s: T.WebGLProgramParametersWithUniforms, depth = false) => {
    Object.assign(s.uniforms, sway);
    s.uniforms.uColors = { value: colors };
    s.uniforms.uAo = { value: new T.Vector2(...look.ao) };
    s.uniforms.uThrough = { value: look.through };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${plantVertex}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${plantBegin}`);
    const head = `#include <common>\nvarying float vRise;\nvarying float vVar;\nvarying vec2 vLeaf;\nuniform vec3 uColors[${colors.length}];\nuniform vec2 uAo;\nuniform float uThrough;`;
    if (depth) {
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', head)
        .replace('void main() {', `void main() {\n${look.shape}`);
      return;
    }
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', head)
      .replace('void main() {', `void main() {\n${look.shape}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>\n${look.shade}\n  diffuseColor.rgb *= mix(uAo.x, 1.0, smoothstep(0.0, uAo.y, vRise));`,
      )
      .replace('#include <lights_fragment_end>', leafThrough)
      // leaves are thin: light from the glowing back screen comes through them
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vec3(0.3, 0.6, 0.4) * ${look.glow.toFixed(2)};`,
      );
    caustics(s);
  };
  mat.onBeforeCompile = (s) => patch(s);
  // every plant shares the same patch function, so tell three the programs differ
  const key = `plant:${look.shape}:${look.shade}:${look.glow}:${look.ao.join(',')}:${look.through}`;
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
  shadows: { cast: boolean; receive: boolean; low?: boolean },
) {
  // nearest first, so the depth test turns away the leaves hidden behind
  // them before they're shaded (the camera looks in from +z)
  items.sort((a, b) => b.pos.z - a.pos.z);
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
  if (shadows.low) mesh.layers.set(LOW);
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
    [-62, -24, -46, -32, 260],
    [24, 62, -46, -30, 230],
    [-24, -12, -46, -40, 55],
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
        // most stop short of the surface; the tallest lie along it
        const h = rnd(16, 38) * (0.7 + edge * 0.6);
        vallis.push({
          pos: new T.Vector3(x, y, z),
          rot: new T.Euler(rnd(-0.12, 0.12), rnd(0, Math.PI), rnd(-0.15, 0.15)),
          // a blade is barely a finger wide for all its length
          scale: new T.Vector3(rnd(0.32, 0.55), h, 1),
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
          // no two blades quite the same green
          c *= 0.78 + 0.4 * fract(vVar * 13.7);
          c = mix(c, uColors[2], step(0.86, vVar) * 0.7);
          // fine veins along the blade
          c *= 0.9 + 0.1 * sin(vLeaf.x * 40.0);
          // the blade is thinnest, and lets most light through, at its edges
          c *= 1.0 + 0.18 * smoothstep(0.3, 0.5, abs(vLeaf.x - 0.5));
          // old blades yellow and brown from the tip, and some carry a film of algae
          float old = step(0.93, fract(vVar * 7.31));
          c = mix(c, vec3(0.42, 0.36, 0.12), old * smoothstep(0.55, 1.0, vLeaf.y) * 0.8);
          c = mix(c, c * vec3(0.72, 0.7, 0.5), step(0.8, fract(vVar * 3.7)) * 0.5);
          diffuseColor.rgb = c;`,
        glow: 0.5,
        ao: [0.3, 16],
        through: 0.45,
      }),
      vallis,
      { cast: true, receive: true },
    ),
  );

  // --- stem plants, massed at the back: green Rotala rotundifolia whose tips
  // blush orange under strong light, and deep-red Rotala 'H'ra' among it.
  // Leaves come in crossed pairs, spreading low down and gathering into a
  // crown at the top.
  const stemBed = (clumps: [number, number, number, number, number][], colors: T.ColorRepresentation[], tall: number) => {
    const stems: Placement[] = [];
    for (const [x0, x1, z0, z1, n] of clumps)
      for (let i = 0; i < Math.round(n * scale); i++) {
        const x = rnd(x0, x1);
        const z = rnd(z0, z1);
        const y0 = sandHeight(x, z) - 0.4;
        // a bush: taller in the middle of the clump
        const mid = 1 - Math.abs(x - (x0 + x1) / 2) / (x1 - x0);
        const H = rnd(0.55, 1) * tall * (0.55 + mid * 0.6);
        const ph = rnd(0, 6.28);
        // stems splay out from the clump and bow as they grow
        const out = (x - (x0 + x1) / 2) / (x1 - x0);
        const lean = out * 0.5 + rnd(-0.18, 0.18);
        const leanZ = rnd(-0.12, 0.12);
        let node = 0;
        for (let y = 0.8; y < H; y += 0.55 - (y / H) * 0.2, node++) {
          const f = y / H;
          const bow = y * (1 + f * 0.8);
          for (let s = 0; s < 4; s++) {
            const yaw = node * (Math.PI / 4) + s * (Math.PI / 2) + rnd(-0.25, 0.25);
            const len = (1.15 - f * 0.45) * rnd(0.8, 1.15);
            stems.push({
              pos: new T.Vector3(x + lean * bow, y0 + y, z + leanZ * bow),
              rot: new T.Euler(1.0 - f * 0.6 + rnd(-0.12, 0.12), yaw, 0, 'YXZ'),
              scale: new T.Vector3(len * 0.34, len, len),
              plant: [ph, 1.2, y0, f],
            });
          }
        }
      }
    // each bed its own geometry: the per-leaf attribute lives on it
    return instanced(
      leafQuad(0.3),
      plantMaterial(sway, caustics, {
        color: colors,
        shape: /* glsl */ `
          { vec2 q = vLeaf * 2.0 - 1.0;
            if (q.x * q.x + q.y * q.y * 0.9 > 1.0) discard; }`,
        shade: /* glsl */ `
          vec3 c = mix(uColors[0], uColors[1], smoothstep(0.0, 0.55, vVar));
          c = mix(c, mix(uColors[2], uColors[3], vLeaf.y), smoothstep(0.6, 0.95, vVar));
          // the midrib, and leaves lighter at their edges where they're thin
          c *= 0.82 + 0.3 * (1.0 - abs(vLeaf.x - 0.5) * 2.0);
          c *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.05, abs(vLeaf.x - 0.5)));
          diffuseColor.rgb = c;`,
        glow: 0.45,
        ao: [0.35, 14],
        through: 0.4,
      }),
      stems,
      { cast: true, receive: true },
    );
  };
  group.add(
    stemBed(
      [
        [-27, -9, -44, -37, 56],
        [10, 26, -44, -36, 60],
      ],
      [0x2f6a1e, 0x8fb53a, 0xe0813e, 0xf2b07a],
      28,
    ),
  );
  // the red is the layout's one warm note: a bush just right of centre and a
  // smaller echo on the left
  group.add(
    stemBed(
      [
        [-1, 10, -45, -40, 64],
        [-31, -25, -37, -33, 22],
      ],
      [0x8a3a24, 0xd4502e, 0xff5040, 0xffb098],
      26,
    ),
  );

  // --- Cryptocoryne at the feet of the stones: rosettes of crinkled
  // bronze-green leaves
  const cryptLeaf = new T.PlaneGeometry(1, 1, 4, 10);
  cryptLeaf.translate(0, 0.5, 0);
  {
    const p = cryptLeaf.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      // long stalk, then a lance-shaped blade with wavy margins
      const blade = T.MathUtils.smoothstep(y, 0.3, 0.42);
      const along = T.MathUtils.clamp((y - 0.3) / 0.7, 0, 1);
      const w = y < 0.3 ? 0.08 : 0.06 + blade * Math.sin(along * Math.PI) ** 0.8 * 0.94;
      const x = p.getX(i) * w;
      p.setXYZ(i, x, y, y * y * 0.35 + Math.abs(x) * Math.sin(y * 42) * 0.12 * blade);
    }
    cryptLeaf.computeVertexNormals();
  }
  const crypts: Placement[] = [];
  for (const [cx, cz, n] of [
    [-11, -19, 3],
    [-27, -17, 2],
    [17, -17, 3],
    [12, -29, 2],
  ] as const)
    for (let c = 0; c < Math.round(n * Math.max(scale, 0.7)); c++) {
      const x = cx + rnd(-2.5, 2.5);
      const z = cz + rnd(-1.5, 1.5);
      const y = sandHeight(x, z) - 0.2;
      const leaves = 9 + Math.floor(Math.random() * 5);
      for (let i = 0; i < leaves; i++) {
        const f = i / leaves;
        const len = rnd(6, 9.5) * (1.1 - f * 0.3);
        crypts.push({
          pos: new T.Vector3(x, y, z),
          rot: new T.Euler(0.35 + f * 0.7 + rnd(-0.1, 0.1), f * Math.PI * 2 * 2.618 + rnd(-0.2, 0.2), 0, 'YXZ'),
          scale: new T.Vector3(len * 0.3, len, len),
          plant: [rnd(0, 6.28), 0.5, y, Math.random()],
        });
      }
    }
  group.add(
    instanced(
      cryptLeaf,
      plantMaterial(sway, caustics, {
        color: [0x4a5a22, 0x8a8234, 0x8a4a2a, 0xb0b458],
        shape: '',
        shade: /* glsl */ `
          vec3 c = mix(uColors[0], uColors[1], smoothstep(0.2, 1.0, vLeaf.y) * (0.6 + vVar * 0.4));
          c = mix(c, uColors[2], (1.0 - smoothstep(0.0, 0.45, vLeaf.y)) * 0.6 + step(0.8, vVar) * 0.35);
          float mid = 1.0 - smoothstep(0.0, 0.05, abs(vLeaf.x - 0.5));
          c = mix(c, uColors[3], mid * 0.35 * step(0.35, vLeaf.y));
          c *= 0.9 + 0.12 * sin(vLeaf.y * 40.0 + vLeaf.x * 6.0);
          diffuseColor.rgb = c;`,
        glow: 0.3,
        roughness: 0.4,
        ao: [0.45, 3.5],
        through: 0.3,
      }),
      crypts,
      { cast: true, receive: true, low: true },
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
  const carpetMesh = instanced(
      round,
      plantMaterial(sway, caustics, {
        color: [0x1f4a14, 0x5f9f2c, 0x9bd04a],
        shape: /* glsl */ `
          { vec2 q = vLeaf * 2.0 - 1.0; if (dot(q, q) > 1.0) discard; }`,
        shade: /* glsl */ `
          vec3 c = mix(uColors[0], uColors[1], smoothstep(0.0, 0.8, vVar));
          c = mix(c, uColors[2], smoothstep(0.85, 1.0, vVar) * 0.5);
          // each leaf a little cupped: lighter at the rim, darker at the stalk
          vec2 q = vLeaf * 2.0 - 1.0;
          c *= 0.82 + 0.3 * smoothstep(0.1, 1.0, dot(q, q));
          diffuseColor.rgb = c;`,
        glow: 0.22,
        roughness: 0.45,
        ao: [0.3, 2.6],
        through: 0.25,
      }),
      carpet,
      { cast: false, receive: true, low: true },
    );
  group.add(carpetMesh);

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
        color: [0x1f4418, 0x3f7426, 0x88b456],
        shape: '',
        shade: /* glsl */ `
          float mid = 1.0 - smoothstep(0.0, 0.06, abs(vLeaf.x - 0.5));
          float veins = smoothstep(0.92, 1.0, sin((vLeaf.y * 14.0 - abs(vLeaf.x - 0.5) * 9.0) * 3.14159));
          vec3 c = mix(uColors[0], uColors[1], 0.4 + 0.6 * vLeaf.y) * (0.8 + vVar * 0.35);
          c = mix(c, uColors[2], mid * 0.55 + veins * 0.2);
          // darker between the veins, where the blade bulges
          c *= 0.88 + 0.12 * veins;
          diffuseColor.rgb = c;`,
        glow: 0.22,
        roughness: 0.35,
        ao: [0.45, 6],
        through: 0.35,
      }),
      swords,
      { cast: true, receive: true, low: true },
    ),
  );

  return group;
}

/*
 * Gravel: the chips and pebbles aquascapers scatter where the big stones meet
 * the sand, and a few along the path's edges, so the rocks look set into the
 * bed rather than dropped on it. One lumpy pebble, instanced at many sizes
 * and turns, each in its own shade of grey or brown.
 */
export function createGravel(caustics: (s: T.WebGLProgramParametersWithUniforms) => void, scale = 1) {
  const geo = new T.IcosahedronGeometry(1, 2);
  {
    const p = geo.attributes.position;
    const v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      // flattened, faceted a little, never a sphere
      const k = 1 + 0.22 * Math.sin(v.x * 3.1 + v.y * 1.7) * Math.cos(v.z * 2.3) + 0.12 * Math.sin(v.y * 7.0 + v.z * 5.0);
      p.setXYZ(i, v.x * k * 1.15, v.y * k * 0.62, v.z * k);
    }
    geo.computeVertexNormals();
  }
  const mat = new T.MeshStandardMaterial({ roughness: 0.75 });
  mat.onBeforeCompile = (s) => {
    caustics(s);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${detailGlsl}`)
      .replace(
        '#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\n  normal = dBump(normal, dFbm(vCausticPos * 4.0), 0.8);',
      );
  };
  const items: { x: number; z: number; r: number }[] = [];
  const near = HARDSCAPE.filter((h) => !h.name.startsWith('wood'));
  for (const h of near)
    for (let i = 0; i < Math.round(h.clear * 16 * scale); i++) {
      // most lie right at the foot, thinning out away from it
      const a = Math.random() * Math.PI * 2;
      const d = h.clear * (0.75 + Math.pow(Math.random(), 2.2) * 0.9);
      items.push({ x: h.x + Math.cos(a) * d, z: h.z + Math.sin(a) * d, r: rnd(0.16, 0.45) * (1.25 - (d / h.clear - 0.75)) });
    }
  for (let i = 0; i < Math.round(220 * scale); i++) {
    const z = rnd(-34, -2);
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = Math.sin(z * 0.1) * 9 + 6 + side * (5 + (z + 36) * 0.18 + rnd(-1.5, 0.8));
    items.push({ x, z, r: rnd(0.12, 0.32) });
  }
  const mesh = new T.InstancedMesh(geo, mat, items.length);
  const mtx = new T.Matrix4();
  const q = new T.Quaternion();
  const e = new T.Euler();
  const pos = new T.Vector3();
  const sc = new T.Vector3();
  const col = new T.Color();
  items.forEach((it, i) => {
    pos.set(it.x, sandHeight(it.x, it.z) + it.r * 0.25, it.z);
    q.setFromEuler(e.set(rnd(-0.3, 0.3), rnd(0, Math.PI * 2), rnd(-0.3, 0.3)));
    sc.set(it.r * rnd(0.8, 1.3), it.r, it.r * rnd(0.8, 1.3));
    mesh.setMatrixAt(i, mtx.compose(pos, q, sc));
    // blue-grey Seiryu chips, with some brown and pale river pebbles
    const pick = Math.random();
    if (pick < 0.55) col.setRGB(0.42, 0.44, 0.45).multiplyScalar(rnd(0.75, 1.25));
    else if (pick < 0.8) col.setRGB(0.52, 0.43, 0.33).multiplyScalar(rnd(0.75, 1.2));
    else col.setRGB(0.8, 0.76, 0.7).multiplyScalar(rnd(0.85, 1.1));
    mesh.setColorAt(i, col);
  });
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.layers.set(LOW);
  return mesh;
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
    const ground = sandHeight(h.x, h.z);
    piece.traverse((o) => {
      const m = o as T.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as T.MeshStandardMaterial).clone();
      const wood = h.name.startsWith('wood');
      // the bake is a cool grey; under the lamp Seiryu stone reads warmer.
      // The wood is waterlogged root, a reddish brown, not charcoal
      if (wood) mat.color.setRGB(1.55, 1.2, 0.95);
      else mat.color.setRGB(1.0, 0.93, 0.84);
      mat.envMap = env;
      mat.envMapIntensity = 0.3;
      mat.roughness = wood ? 0.78 : 0.82;
      mat.onBeforeCompile = (s) => {
        caustics(s);
        // where stone meets sand, little light gets in
        s.uniforms.uFoot = { value: ground };
        s.uniforms.uWood = { value: wood ? 1 : 0 };
        s.fragmentShader = s.fragmentShader
          .replace('#include <common>', `#include <common>\nuniform float uFoot;\nuniform float uWood;\n${detailGlsl}`)
          .replace(
            '#include <color_fragment>',
            /* glsl */ `#include <color_fragment>
            // Seiryu is laid down in beds: the softer layers weather back into
            // shallow grooves that run round the stone (shared with the relief below)
            float rockBed = 0.5 + 0.5 * sin(vCausticPos.y * 1.7 + dFbm(vCausticPos * 0.22) * 6.0);
            {
              vec3 wp = vCausticPos;
              diffuseColor.rgb *= mix(0.35, 1.0, smoothstep(uFoot - 0.8, uFoot + 3.5, wp.y));
              // weathered stone is never one grey: patches, and fine grit
              float patchy = dFbm(wp * 0.35);
              diffuseColor.rgb *= 0.8 + 0.34 * patchy + 0.06 * (dNoise(wp * 7.0) - 0.5);
              diffuseColor.rgb *= 1.0 - (1.0 - uWood) * (1.0 - rockBed) * 0.14;
              // a brown-green film of algae and diatoms creeps up from the bed
              float film = smoothstep(uFoot + 5.0, uFoot + 0.5, wp.y) * smoothstep(0.4, 0.62, patchy);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.22, 0.1), film * 0.55);
            }`,
          )
          .replace(
            '#include <normal_fragment_maps>',
            /* glsl */ `#include <normal_fragment_maps>
            {
              vec3 wp = vCausticPos;
              // stone: weathered, gently uneven faces over its beds, not pitted
              // all over like lava rock. Wood: a fine grain
              float h = uWood > 0.5
                ? dFbm(wp * vec3(3.0, 0.8, 3.0))
                : dFbm(wp * 0.6) * 0.7 + smoothstep(0.2, 0.8, rockBed) * 0.25 + dNoise(wp * 3.0) * 0.05;
              normal = dBump(normal, h, uWood > 0.5 ? 0.3 : 0.6);
            }`,
          );
      };
      m.material = mat;
      m.castShadow = true;
      m.receiveShadow = true;
    });
    piece.scale.setScalar(h.scale);
    piece.rotation.set(...h.rot);
    piece.position.set(h.x, ground - h.sink, h.z);
    piece.userData.name = h.name;
    group.add(piece);
  }
  return group;
}

/**
 * Driftwood in a planted tank is rarely bare: Java moss grips it in dark
 * green fuzz and Java fern sprouts from its forks. Both are placed by
 * sampling the loaded wood, favouring the faces that look up at the lamp.
 */
export function dressWood(
  hardscape: T.Group,
  sway: Sway,
  caustics: (s: T.WebGLProgramParametersWithUniforms) => void,
  scale = 1,
) {
  const moss: Placement[] = [];
  const ferns: Placement[] = [];
  const p = new T.Vector3();
  const n = new T.Vector3();
  const up = new T.Vector3(0, 1, 0);
  const q = new T.Quaternion();
  const twist = new T.Quaternion();
  hardscape.updateMatrixWorld(true);
  for (const piece of hardscape.children) {
    if (!String(piece.userData.name).startsWith('wood')) continue;
    piece.traverse((o) => {
      const m = o as T.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const nrm = g.attributes.normal;
      const lit = new Float32Array(nrm.count);
      const top = new Float32Array(nrm.count);
      for (let i = 0; i < nrm.count; i++) {
        const y = Math.max(0, nrm.getY(i));
        lit[i] = y * y + 0.04;
        top[i] = y ** 6;
      }
      g.setAttribute('lit', new T.BufferAttribute(lit, 1));
      g.setAttribute('top', new T.BufferAttribute(top, 1));
      const mesh = new T.Mesh(g);
      const mossAt = new MeshSurfaceSampler(mesh).setWeightAttribute('lit').build();
      for (let i = 0; i < Math.round(2600 * scale); i++) {
        mossAt.sample(p, n);
        // fronds stand off the wood, leaning towards the light
        n.lerp(up, 0.45).normalize();
        q.setFromUnitVectors(up, n).multiply(twist.setFromAxisAngle(up, rnd(0, Math.PI * 2)));
        const size = rnd(0.45, 0.95);
        moss.push({
          pos: p.clone().addScaledVector(n, -0.05),
          rot: new T.Euler().setFromQuaternion(q),
          scale: new T.Vector3(size * 0.8, size, size),
          plant: [rnd(0, 6.28), 0.06, p.y, Math.random()],
        });
      }
      const fernAt = new MeshSurfaceSampler(mesh).setWeightAttribute('top').build();
      for (let r = 0; r < 3; r++) {
        fernAt.sample(p, n);
        const leaves = 6 + Math.floor(Math.random() * 4);
        for (let i = 0; i < leaves; i++) {
          const f = i / leaves;
          const len = rnd(7, 13) * (1.1 - f * 0.25);
          ferns.push({
            pos: p.clone(),
            rot: new T.Euler(0.3 + f * 0.8 + rnd(-0.1, 0.15), f * Math.PI * 2 * 2.618 + rnd(-0.3, 0.3), 0, 'YXZ'),
            scale: new T.Vector3(len * 0.17, len, len),
            plant: [rnd(0, 6.28), 0.7, p.y, Math.random()],
          });
        }
      }
      g.dispose();
    });
  }

  const group = new T.Group();
  group.add(
    instanced(
      leafQuad(0.25),
      plantMaterial(sway, caustics, {
        color: [0x173110, 0x3a6a1e, 0x7eaa3a],
        // a feathery frond: a tapering spine with fine side branches
        shape: /* glsl */ `
          { float w = (1.0 - vLeaf.y) * 0.95 * (0.45 + 0.55 * abs(sin(vLeaf.y * 21.0)));
            if (abs(vLeaf.x - 0.5) * 2.0 > w) discard; }`,
        shade: /* glsl */ `
          vec3 c = mix(uColors[0], uColors[1], smoothstep(0.0, 0.9, vLeaf.y) * (0.5 + vVar * 0.5));
          c = mix(c, uColors[2], smoothstep(0.75, 1.0, vLeaf.y) * step(0.55, vVar) * 0.6);
          diffuseColor.rgb = c;`,
        glow: 0.3,
        roughness: 0.7,
        ao: [0.55, 1.2],
        through: 0.2,
      }),
      moss,
      { cast: false, receive: true, low: true },
    ),
  );

  // Java fern: long, stiff, glossy lances with a pale midrib
  const lance = new T.PlaneGeometry(1, 1, 4, 12);
  lance.translate(0, 0.5, 0);
  {
    const a = lance.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const y = a.getY(i);
      const x = a.getX(i) * Math.sin(Math.min(1, y * 1.04) * Math.PI) ** 0.6 * (y < 0.08 ? 0.3 : 1);
      a.setXYZ(i, x, y, y * y * 0.45 + Math.abs(x) * 0.5);
    }
    lance.computeVertexNormals();
  }
  group.add(
    instanced(
      lance,
      plantMaterial(sway, caustics, {
        color: [0x183a16, 0x2d5a22, 0x7ea552],
        shape: '',
        shade: /* glsl */ `
          float mid = 1.0 - smoothstep(0.0, 0.05, abs(vLeaf.x - 0.5));
          float veins = smoothstep(0.9, 1.0, sin((vLeaf.y * 22.0 - abs(vLeaf.x - 0.5) * 12.0) * 3.14159));
          vec3 c = mix(uColors[0], uColors[1], 0.3 + 0.7 * vLeaf.y * (0.7 + vVar * 0.3));
          c = mix(c, uColors[2], mid * 0.5);
          c *= 1.0 - veins * 0.25;
          diffuseColor.rgb = c;`,
        glow: 0.3,
        roughness: 0.3,
        ao: [0.5, 4],
        through: 0.35,
      }),
      ferns,
      { cast: true, receive: true },
    ),
  );
  return group;
}
