// Procedural materials: glazes, wood, lacquer, linen, iron, glass, bamboo, cardboard.
// Everything is computed in object space (or box space) so geometry needs no UV care.
import * as T from 'three';

// ── GLSL helpers ────────────────────────────────────────────────────────────
const NOISE = /* glsl */ `
float gHash(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float gNoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(gHash(i+vec3(0,0,0)),gHash(i+vec3(1,0,0)),f.x),
                 mix(gHash(i+vec3(0,1,0)),gHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(gHash(i+vec3(0,0,1)),gHash(i+vec3(1,0,1)),f.x),
                 mix(gHash(i+vec3(0,1,1)),gHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float gFbm(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*gNoise(p); p = p*2.03+vec3(1.7,9.2,3.1); a *= 0.5; } return s; }
float gCell(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); float d = 1.0;
  for(int z=-1;z<=1;z++) for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec3 o = vec3(float(x),float(y),float(z));
    vec3 r = o + vec3(gHash(i+o), gHash(i+o+13.1), gHash(i+o+27.7)) - f;
    d = min(d, dot(r,r));
  }
  return sqrt(d);
}
vec3 gBump(vec3 pos, vec3 n, float h){
  vec3 sx = dFdx(pos); vec3 sy = dFdy(pos);
  vec3 r1 = cross(sy, n); vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  float bx = dFdx(h), by = dFdy(h);
  vec3 grad = sign(det) * (bx*r1 + by*r2);
  return normalize(abs(det)*n - grad);
}
`;

type Shader = Parameters<NonNullable<T.Material['onBeforeCompile']>>[0];

function inject(
  m: T.MeshPhysicalMaterial | T.MeshStandardMaterial,
  opts: {
    key: string;
    uniforms: Record<string, T.IUniform>;
    color: string;
    rough?: string;
    bump?: string;
    after?: string;
    attrib?: boolean;
    world?: boolean;
  },
) {
  m.onBeforeCompile = (s: Shader) => {
    Object.assign(s.uniforms, opts.uniforms);
    const decl = Object.entries(opts.uniforms)
      .map(([k, u]) => {
        const v = u.value;
        const t = typeof v === 'number' ? 'float' : v instanceof T.Color || v instanceof T.Vector3 ? 'vec3' : v instanceof T.Vector2 ? 'vec2' : v instanceof T.Texture ? 'sampler2D' : 'float';
        return `uniform ${t} ${k};`;
      })
      .join('\n');
    s.vertexShader =
      `varying vec3 vObj;\nvarying vec3 vObjN;\n${opts.attrib ? 'attribute float pool;\nvarying float vPool;\n' : ''}` +
      s.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${opts.world ? 'vObj = (modelMatrix*vec4(position,1.0)).xyz; vObjN = normalize(mat3(modelMatrix)*normal);' : 'vObj = position; vObjN = normal;'}\n${opts.attrib ? 'vPool = pool;' : ''}`,
      );
    s.fragmentShader =
      `varying vec3 vObj;\nvarying vec3 vObjN;\n${opts.attrib ? 'varying float vPool;\n' : ''}${decl}\n${NOISE}\n` +
      s.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>\n${opts.color}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${opts.rough ?? ''}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${opts.bump ?? ''}`)
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\n${opts.after ?? ''}`);
  };
  m.customProgramCacheKey = () => opts.key;
  return m;
}

// ── glazes ──────────────────────────────────────────────────────────────────
export type Glaze = {
  a: string; // main glaze
  b: string; // pooled / thick glaze
  edge: string; // thin glaze at the lip and on ridges
  clay: string; // raw clay body (foot)
  speck?: number;
  speckColor?: string;
  runs?: number; // vertical streaks
  blush?: number; // soft pink patches (粉引の御本)
  rough: number;
  coat: number;
  /** foot line in dm (object space y) */
  foot: number;
  drip?: number;
  /** lip height in dm (thin glaze) */
  rim: number;
  crackle?: number;
};

export function glazeMaterial(g: Glaze) {
  const m = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: g.rough, clearcoat: g.coat, clearcoatRoughness: 0.18, envMapIntensity: 1 });
  inject(m, {
    key: 'glaze',
    attrib: true,
    uniforms: {
      uA: { value: new T.Color(g.a) },
      uB: { value: new T.Color(g.b) },
      uEdge: { value: new T.Color(g.edge) },
      uClay: { value: new T.Color(g.clay) },
      uSpeckC: { value: new T.Color(g.speckColor ?? '#3a2618') },
      uSpeck: { value: g.speck ?? 0 },
      uRuns: { value: g.runs ?? 0 },
      uBlush: { value: g.blush ?? 0 },
      uFoot: { value: g.foot },
      uDrip: { value: g.drip ?? 0.04 },
      uRim: { value: g.rim },
      uGR: { value: g.rough },
      uCrackle: { value: g.crackle ?? 0 },
    },
    color: /* glsl */ `
      vec3 gP = vObj * 10.0; // cm
      float n1 = gFbm(gP * 0.9);
      float n2 = gNoise(vec3(atan(vObj.z, vObj.x) * 7.0, gP.y * 0.3, 0.0));
      float line = uFoot + uDrip * (n2 - 0.5) * 2.0;
      float gl = max(smoothstep(line - 0.004, line + 0.004, vObj.y), step(0.01, vPool));
      vec3 glz = mix(uA, uB, clamp(vPool, 0.0, 1.0));
      // glaze gathers where it runs: long vertical streaks
      float st = gFbm(vec3(gP.x * 1.6, gP.y * 0.18, gP.z * 1.6));
      glz = mix(glz, uB, smoothstep(0.45, 0.75, st) * uRuns);
      // thinner (edge colour) near the lip and just above the foot line
      float lip = smoothstep(uRim - 0.035, uRim, vObj.y);
      float thinFoot = (1.0 - smoothstep(line, line + 0.025, vObj.y)) * (1.0 - step(0.01, vPool));
      glz = mix(glz, uEdge, clamp(lip * 0.85 + thinFoot * 0.6, 0.0, 1.0));
      // blush patches
      glz = mix(glz, glz * vec3(1.0, 0.86, 0.8), smoothstep(0.55, 0.8, gFbm(gP * 0.35 + 7.0)) * uBlush);
      // iron specks
      float sp = gNoise(gP * 5.5) * gNoise(gP * 2.1 + 3.0);
      float spk = smoothstep(0.62, 0.66, sp) * uSpeck;
      glz = mix(glz, uSpeckC, spk);
      // crackle
      float cr = gCell(gP * 1.4);
      glz *= 1.0 - (1.0 - smoothstep(0.0, 0.05, cr)) * uCrackle * 0.25;
      glz *= 0.94 + 0.12 * n1;
      vec3 clay = uClay * (0.82 + 0.3 * gNoise(gP * 3.0)) * (0.92 + 0.16 * n1);
      diffuseColor.rgb = mix(clay, glz, gl);
    `,
    rough: /* glsl */ `
      roughnessFactor = mix(0.86, uGR + (gNoise(vObj * 60.0) - 0.5) * 0.12, gl);
    `,
    bump: /* glsl */ `
      float hb = (gNoise(vObj * 400.0) * (1.0 - gl) * 0.6 + gFbm(vObj * 90.0) * 0.08 * gl - spk * 0.2) * 0.0035;
      normal = gBump(-vViewPosition, normal, hb);
    `,
    after: /* glsl */ `
      material.clearcoat *= gl;
    `,
  });
  return m;
}

// ── wood & lacquer ──────────────────────────────────────────────────────────
export type Wood = { early: string; late: string; ring: number; rough: number; coat: number; tint?: string; tintAmt?: number; axis?: 'x' | 'z' };
export function woodMaterial(w: Wood) {
  const m = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: w.rough, clearcoat: w.coat, clearcoatRoughness: 0.28 });
  inject(m, {
    key: 'wood',
    uniforms: {
      uE: { value: new T.Color(w.early) },
      uL: { value: new T.Color(w.late) },
      uRing: { value: w.ring },
      uTint: { value: new T.Color(w.tint ?? '#000000') },
      uTintAmt: { value: w.tintAmt ?? 0 },
      uAxisZ: { value: w.axis === 'z' ? 1 : 0 },
      uWR: { value: w.rough },
    },
    color: /* glsl */ `
      vec3 wq = mix(vObj, vObj.zyx, uAxisZ) * 10.0; // cm, grain along x
      float warp = gFbm(vec3(wq.x * 0.08, wq.y * 0.6, wq.z * 0.6)) * 2.6;
      float wr = length(vec2(wq.y + 14.0, wq.z * 0.35 - 22.0)) * uRing + warp;
      float wt = fract(wr);
      float late = smoothstep(0.55, 0.85, wt) * (1.0 - smoothstep(0.92, 1.0, wt));
      float fib = gNoise(vec3(wq.x * 0.25, wq.y * 14.0, wq.z * 14.0));
      float pores = smoothstep(0.72, 0.8, gNoise(vec3(wq.x * 0.6, wq.y * 30.0, wq.z * 30.0)));
      vec3 wood = mix(uE, uL, late * 0.85) * (0.9 + 0.18 * fib) * (1.0 - pores * 0.18);
      wood *= 0.92 + 0.14 * gFbm(wq * 0.12);
      diffuseColor.rgb = mix(wood, uTint * (0.8 + 0.4 * late), uTintAmt);
    `,
    rough: /* glsl */ `roughnessFactor = uWR + late * 0.08 + pores * 0.1;`,
    bump: /* glsl */ `
      normal = gBump(-vViewPosition, normal, (late * 0.4 + pores * 0.6 + fib * 0.2) * 0.0012 * (1.0 - uTintAmt * 0.6));
    `,
  });
  return m;
}

// ── iron (hammered) ─────────────────────────────────────────────────────────
export function ironMaterial() {
  const m = new T.MeshPhysicalMaterial({ color: 0x2b2927, metalness: 0.72, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  inject(m, {
    key: 'iron',
    uniforms: {},
    color: /* glsl */ `
      vec3 iP = vObj * 10.0;
      float ic = gCell(iP * 0.9);
      float inn = gFbm(iP * 0.6);
      diffuseColor.rgb = vec3(0.17, 0.16, 0.15) * (0.75 + 0.5 * inn) + vec3(0.06, 0.03, 0.01) * smoothstep(0.5, 0.8, gFbm(iP * 0.2 + 4.0));
    `,
    rough: /* glsl */ `roughnessFactor = 0.34 + 0.25 * smoothstep(0.2, 0.6, ic) + (inn - 0.5) * 0.2;`,
    bump: /* glsl */ `normal = gBump(-vViewPosition, normal, ic * ic * 0.0045);`,
  });
  return m;
}

// ── cardboard (box space, triplanar) ───────────────────────────────────────
export function cardboardMaterial(inner = false) {
  const m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  inject(m, {
    key: 'card' + (inner ? 'i' : 'o'),
    world: true,
    uniforms: { uInner: { value: inner ? 1 : 0 } },
    color: /* glsl */ `
      vec3 cP = vObj * 10.0; // cm in box space
      vec3 an = abs(normalize(vObjN));
      float fib = gFbm(cP * 2.2) ;
      float fine = gNoise(cP * 14.0);
      // corrugation telegraphing through the liner (flutes run vertically)
      float flute = 0.5 + 0.5 * sin((an.x > 0.5 ? cP.z : cP.x) * 7.8);
      flute = mix(flute, 0.5, step(0.5, an.y));
      vec3 kraft = mix(vec3(0.60, 0.43, 0.27), vec3(0.70, 0.53, 0.35), fib);
      kraft = mix(kraft, vec3(0.74, 0.60, 0.43), uInner * 0.55);
      kraft *= 0.95 + 0.08 * fine + 0.035 * flute;
      diffuseColor.rgb = kraft;
    `,
    rough: /* glsl */ `roughnessFactor = 0.9 - fine * 0.08;`,
    bump: /* glsl */ `normal = gBump(-vViewPosition, normal, (fine * 0.15 + flute * 0.35) * 0.0008);`,
  });
  return m;
}

// ── canvas textures ─────────────────────────────────────────────────────────
const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
};
const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

/** Linen cloth face: plain weave with slubs, a stitched hem and woven stripes. */
export function linenTexture(base: string, stripe: string, bump = false) {
  const S = 512;
  const [c, x] = canvas(S, S);
  const r = rng(7);
  x.fillStyle = bump ? '#808080' : base;
  x.fillRect(0, 0, S, S);
  if (!bump) {
    // woven stripes near one end
    x.fillStyle = stripe;
    for (const [p, w] of [
      [58, 14],
      [80, 5],
      [92, 5],
    ])
      x.fillRect(0, p, S, w);
  }
  // warp and weft
  for (let i = 0; i < S; i += 3) {
    const a = 0.06 + r() * 0.1;
    x.fillStyle = `rgba(0,0,0,${a})`;
    x.fillRect(i, 0, 1, S);
    x.fillStyle = `rgba(255,255,255,${a * 0.8})`;
    x.fillRect(0, i + 1, S, 1);
  }
  for (let k = 0; k < 70; k++) {
    const y = Math.floor(r() * S);
    x.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.1})`;
    x.fillRect(r() * S, y, 20 + r() * 80, 1.5);
  }
  // hem: folded edge and a running stitch
  x.strokeStyle = 'rgba(0,0,0,0.22)';
  x.lineWidth = 3;
  x.strokeRect(14, 14, S - 28, S - 28);
  x.setLineDash([7, 5]);
  x.strokeStyle = bump ? 'rgba(0,0,0,0.5)' : 'rgba(40,30,20,0.35)';
  x.lineWidth = 1.5;
  x.strokeRect(22, 22, S - 44, S - 44);
  const t = new T.CanvasTexture(c);
  t.colorSpace = bump ? T.NoColorSpace : T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function linenMaterial(color: string, stripe?: string) {
  const col = new T.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  col.getHSL(hsl);
  const st = stripe ?? (hsl.l > 0.6 ? '#2c4861' : '#efe6d6');
  const map = linenTexture(color, st);
  const bump = linenTexture(color, st, true);
  return new T.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: 2.2,
    roughness: 0.95,
    sheen: 1,
    sheenRoughness: 0.7,
    sheenColor: col.clone().lerp(new T.Color('#ffffff'), 0.5),
  });
}

/** Bamboo "ござ目" weave with open gaps (alpha). u = around, v = along the profile. */
export function bambooTexture() {
  const W = 512;
  const H = 256;
  const [c, x] = canvas(W, H);
  x.clearRect(0, 0, W, H);
  const r = rng(11);
  const cols = 96;
  const rows = 26;
  for (let i = 0; i < cols; i++) {
    const x0 = (i / cols) * W;
    const w = W / cols - 1.2;
    const tone = 0.85 + r() * 0.2;
    x.fillStyle = `rgb(${Math.round(196 * tone)},${Math.round(166 * tone)},${Math.round(100 * tone)})`;
    x.fillRect(x0, 0, w, H);
  }
  for (let j = 0; j < rows; j++) {
    const y0 = (j / rows) * H;
    const hh = H / rows - 2.2;
    for (let i = 0; i < cols; i++) {
      if ((i + j) % 2) continue;
      const tone = 0.8 + r() * 0.22;
      x.fillStyle = `rgb(${Math.round(186 * tone)},${Math.round(150 * tone)},${Math.round(86 * tone)})`;
      x.fillRect((i / cols) * W - 1, y0, W / cols + 2, hh);
    }
  }
  // gaps
  x.globalCompositeOperation = 'destination-out';
  for (let j = 0; j < rows; j++) x.fillRect(0, (j / rows) * H + H / rows - 1.6, W, 1.1);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = T.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/**
 * Glass without a transmission pass (so it composites over any page background):
 * a thin tinted shell whose opacity rises toward grazing angles (Fresnel),
 * keeping the window reflections bright on the rims.
 */
export function glassMaterial(tint: string, dist = 0.5) {
  const c = new T.Color(tint);
  const m = new T.MeshPhysicalMaterial({
    color: c,
    metalness: 0,
    roughness: 0.04,
    transparent: true,
    opacity: 0.12 + Math.min(0.3, 0.08 / dist),
    envMapIntensity: 1.6,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    specularIntensity: 1,
    ior: 1.5,
    side: T.DoubleSide,
    depthWrite: false,
  });
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.5);
      gl_FragColor.a = clamp(gl_FragColor.a + fres * 0.75, 0.0, 0.92);`,
    );
  };
  m.customProgramCacheKey = () => 'glass';
  return m;
}

export function paperMaterial(color: string) {
  return new T.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });
}

/** Wrapping paper: 生成り with a small leaf motif and the shop mark. */
export function wrapTexture() {
  const S = 512;
  const [c, x] = canvas(S, S);
  x.fillStyle = '#efe6d3';
  x.fillRect(0, 0, S, S);
  const r = rng(3);
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = `rgba(120,90,50,${r() * 0.05})`;
    x.fillRect(r() * S, r() * S, 1 + r() * 2, 1);
  }
  const leaf = (cx: number, cy: number, a: number, s: number, col: string) => {
    x.save();
    x.translate(cx, cy);
    x.rotate(a);
    x.scale(s, s);
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, -18);
    x.bezierCurveTo(12, -10, 12, 10, 0, 18);
    x.bezierCurveTo(-12, 10, -12, -10, 0, -18);
    x.fill();
    x.strokeStyle = '#efe6d3';
    x.lineWidth = 1.4;
    x.beginPath();
    x.moveTo(0, -14);
    x.lineTo(0, 14);
    x.stroke();
    x.restore();
  };
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 4; i++) {
      const ox = i * 128 + (j % 2) * 64;
      const oy = j * 128;
      leaf(ox + 30, oy + 40, 0.6, 0.9, '#6b4f36');
      leaf(ox + 44, oy + 52, -0.5, 0.7, '#9a7a4e');
      x.fillStyle = '#2f4a5e';
      x.beginPath();
      x.arc(ox + 96, oy + 100, 3, 0, Math.PI * 2);
      x.fill();
    }
  x.fillStyle = '#6b4f36';
  x.font = '600 15px "Zen Old Mincho", serif';
  for (let j = 0; j < 4; j++) x.fillText('MIRAI GOODS', ((j % 2) * 64 + 60) % S, j * 128 + 100);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export { canvas as makeCanvas, rng };
