/**
 * Shaders for the playable top page ("MIRAI DASH").
 * Everything that lives on the track is placed in track space (z = -s) and
 * scrolled by `uDist` in the vertex shader, then bent down / sideways with
 * distance so the world curves over a small planet horizon.
 */

/** smoothstep that is well defined when edge0 > edge1 (used for fall-offs). */
export const SST = /* glsl */ `
float sst(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
vec2 sst(vec2 a, vec2 b, vec2 x){ vec2 t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float pw(float x, float y){ return pow(max(x, 1e-9), y); }
vec3 pw(vec3 x, vec3 y){ return pow(max(x, vec3(1e-9)), y); }
`;
/** Prepends the helpers a shader uses. */
export const withSst = (src: string) => (/\b(sst|pw)\(/.test(src) ? SST + src : src);

const NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

/** Shared world uniforms (all objects reference the same objects). */
const WORLD_U = /* glsl */ `
uniform float uDist;
uniform float uTime;
uniform float uBendY;
uniform float uBendX;
uniform vec3 uFog;
uniform float uFogDen;
uniform vec4 uW;
uniform vec3 uA1;
uniform vec3 uA2;
uniform vec3 uHor;
uniform vec3 uZen;
`;

const BEND = /* glsl */ `
vec4 bendW(vec4 wp){
  float d = max(0.0, -wp.z - 2.0);
  wp.y -= d * d * uBendY;
  wp.x += d * d * uBendX;
  return wp;
}
`;

const FOG = /* glsl */ `
vec3 fogIt(vec3 c, float dist){
  float f = 1.0 - exp(-pw(max(dist - 6.0, 0.0) * uFogDen, 1.5));
  return mix(c, uFog, clamp(f, 0.0, 1.0));
}
`;

export const PRE_V = WORLD_U + BEND;
export const PRE_F = WORLD_U + FOG + NOISE;

// ── sky ──────────────────────────────────────────────────────────────────────
export const SKY_VS = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * viewMatrix * (modelMatrix * vec4(position, 1.0));
  gl_Position = p.xyww;
}`;

export const SKY_FS =
  PRE_F +
  /* glsl */ `
varying vec3 vDir;
float stars(vec3 d, float dens){
  vec2 uv = vec2(atan(d.x, -d.z) * 90.0, d.y * 150.0);
  vec2 c = floor(uv);
  float h = hash12(c);
  vec2 o = vec2(hash12(c + 3.1), hash12(c + 7.7)) - 0.5;
  float r = length(fract(uv) - 0.5 - o * 0.6);
  float tw = 0.65 + 0.35 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
  return step(1.0 - dens, h) * sst(0.12, 0.0, r) * tw;
}
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  float az = atan(d.x, -d.z);
  vec3 col = mix(uHor, uZen, pw(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uFog, sst(0.02, -0.2, h));

  // NEON ASTRAY — striped neon sun behind the skyline, faint stars
  if (uW.x > 0.001) {
    vec3 c = col;
    vec2 sp = vec2(az * 1.1, h - 0.09);
    float r = length(sp);
    float disc = sst(0.235, 0.228, r);
    float band = h - 0.09;
    float cut = band < 0.0 ? step(0.42 + band * 3.2, fract(band * 30.0 + uTime * 0.25)) : 1.0;
    vec3 sunC = mix(vec3(1.0, 0.18, 0.55), vec3(1.0, 0.86, 0.32), sst(-0.2, 0.2, band));
    c += disc * cut * sunC * 1.35;
    c += sunC * 0.35 * exp(-r * 5.0) * (1.0 - disc);
    c += vec3(0.9, 0.9, 1.0) * stars(d, 0.018) * sst(0.05, 0.4, h) * 0.9;
    col = mix(col, c, uW.x);
  }
  // SKYSHARD — morning sun and drifting clouds
  if (uW.y > 0.001) {
    vec3 c = col;
    vec3 sd = normalize(vec3(0.45, 0.16, -1.0));
    float s = max(dot(d, sd), 0.0);
    c += vec3(1.0, 0.82, 0.6) * (pw(s, 600.0) * 2.0 + pw(s, 12.0) * 0.35);
    vec2 cp = d.xz / (h + 0.2) * 1.3 + vec2(uTime * 0.02, 0.0);
    float cl = sst(0.45, 0.85, fbm(cp * 1.6));
    c = mix(c, mix(vec3(1.0, 0.93, 0.95), vec3(0.98, 0.78, 0.82), 1.0 - h), cl * sst(0.0, 0.25, h) * 0.9);
    float bandC = sst(0.35, 0.8, fbm(vec2(az * 3.0, h * 8.0) + 4.0)) * sst(0.2, 0.0, h) * sst(-0.05, 0.03, h);
    c = mix(c, vec3(1.0, 0.95, 0.96), bandC * 0.8);
    col = mix(col, c, uW.y);
  }
  // ABYSS LANTERN — light shafts from the surface, drifting marine snow
  if (uW.z > 0.001) {
    vec3 c = col;
    float rays = pw(max(0.0, sin(az * 9.0 + sin(az * 3.0 + uTime * 0.2) * 1.5)), 6.0);
    rays *= sst(-0.05, 0.9, h) * 0.55;
    c += vec3(0.35, 0.95, 0.9) * rays * 0.5;
    c += vec3(0.5, 1.0, 0.95) * sst(0.55, 1.0, h) * (0.3 + 0.25 * fbm(d.xz * 6.0 + uTime * 0.1));
    c += vec3(0.7, 1.0, 0.95) * stars(d + vec3(0.0, uTime * 0.004, 0.0), 0.03) * 0.45;
    col = mix(col, c, uW.z);
  }
  // ORBIT RALLY — stars, nebula and a ringed planet
  if (uW.w > 0.001) {
    vec3 c = col;
    float n = fbm(vec2(az * 2.0, h * 3.0) + 11.0);
    c += mix(vec3(0.35, 0.1, 0.55), vec3(1.0, 0.45, 0.15), fbm(vec2(az, h) * 3.0)) * pw(n, 3.0) * 0.9 * sst(-0.1, 0.3, h);
    c += vec3(1.0) * stars(d, 0.05) * 1.1;
    vec2 pp = vec2(az + 0.55, h - 0.24);
    float pr = length(pp * vec2(1.0, 1.05));
    float planet = sst(0.17, 0.165, pr);
    vec3 pc = mix(vec3(1.0, 0.55, 0.2), vec3(0.45, 0.12, 0.25), sst(-0.12, 0.14, pp.x - pp.y * 0.6));
    pc *= 0.75 + 0.25 * sin(pp.y * 70.0 + sin(pp.x * 20.0) * 2.0);
    float ring = abs(length(vec2(pp.x, (pp.y + pp.x * 0.35) * 3.8)) - 0.29);
    float rm = sst(0.025, 0.0, ring) * (pp.y + pp.x * 0.35 > -0.002 || pr > 0.17 ? 1.0 : 0.0);
    c = mix(c, pc, planet);
    c += vec3(1.0, 0.75, 0.45) * rm * 0.8;
    c += vec3(1.0, 0.5, 0.2) * exp(-abs(pr - 0.17) * 40.0) * 0.25;
    col = mix(col, c, uW.w);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// ── floor (track + surroundings) ────────────────────────────────────────────
export const FLOOR_VS =
  PRE_V +
  /* glsl */ `
varying vec2 vT;
varying float vD;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vT = vec2(wp.x, uDist - wp.z);
  wp = bendW(wp);
  vD = distance(wp.xyz, cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const FLOOR_FS =
  PRE_F +
  /* glsl */ `
uniform vec3 uTrack;
uniform vec3 uGround;
varying vec2 vT;
varying float vD;
float line(float x, float w){ return sst(w, 0.0, abs(x)); }
void main(){
  float ax = abs(vT.x);
  float s = vT.y;
  float aa = fwidth(s) * 1.5 + fwidth(vT.x);
  float onTrack = sst(3.62 + aa, 3.5, ax);

  // track surface: dark glass with lane dashes, edge rails and a travelling pulse
  vec3 tr = uTrack;
  float tile = line(fract(s * 0.25) - 0.5, 0.012 + aa * 0.25) * 0.35;
  tr += uA2 * tile * 0.25;
  float dash = line(ax - 1.1, 0.045 + aa) * step(0.45, fract(s * 0.18));
  tr += mix(uA2, vec3(1.0), 0.3) * dash * 0.9;
  float edge = line(ax - 3.45, 0.07 + aa);
  float pulse = 0.55 + 0.45 * sst(0.7, 1.0, fract(s * 0.02 - uTime * 0.6));
  tr += uA1 * edge * (1.6 + pulse);
  tr += uA1 * line(ax - 3.45, 0.6) * 0.18;
  // reflection-ish sheen
  tr += uHor * 0.10 * sst(40.0, 160.0, vD);

  // surroundings for each world
  vec3 o = vec3(0.0);
  float alpha = 1.0;
  // city: neon grid
  {
    vec2 g = vec2(vT.x * 0.25, s * 0.125);
    vec2 gw = fwidth(g) * 1.2;
    vec2 gl = sst(gw + 0.02, vec2(0.0), 0.5 - abs(fract(g) - 0.5));
    float gg = max(gl.x, gl.y);
    o += uW.x * (uGround + uA1 * gg * 0.5 * sst(3.6, 8.0, ax) * exp(-vD * 0.012));
  }
  // sky: sea of clouds below the bridge
  {
    float c = fbm(vec2(vT.x * 0.06, s * 0.03 - uTime * 0.01));
    float c2 = fbm(vec2(vT.x * 0.15 + 3.0, s * 0.07));
    float cm = sst(0.32, 0.78, c * 0.85 + c2 * 0.45);
    vec3 cc = mix(vec3(0.62, 0.5, 0.78), vec3(1.0, 0.95, 0.94), cm);
    cc = mix(cc, vec3(1.0, 0.82, 0.75), sst(0.7, 0.95, c2) * 0.4);
    o += uW.y * cc;
  }
  // abyss: sand with caustics
  {
    vec2 p = vec2(vT.x, s) * 0.35;
    float ca = 0.0;
    vec2 q = p + vec2(fbm(p * 0.7 + uTime * 0.15), fbm(p * 0.7 - uTime * 0.12)) * 2.0;
    ca = pw(1.0 - abs(vnoise(q * 1.7) * 2.0 - 1.0), 6.0);
    vec3 sand = uGround * (0.75 + 0.5 * fbm(p * 2.0));
    o += uW.z * (sand + uA1 * ca * 0.35);
  }
  // orbit: the track floats in space
  alpha = 1.0 - uW.w;

  float dither = hash12(gl_FragCoord.xy);
  float keep = max(onTrack, step(dither, alpha));
  if (keep < 0.5) discard;
  vec3 col = mix(o / max(1e-3, 1.0 - uW.w), tr, onTrack);
  // underside glow of the floating track (sky, orbit)
  col = fogIt(col, vD);
  gl_FragColor = vec4(col, 1.0);
}`;

// ── instanced props ─────────────────────────────────────────────────────────
/** kind: 0 building, 1 island, 2 kelp, 3 rock, 4 glow orb, 5 gate */
export const PROP_VS = (kind: number) =>
  PRE_V +
  /* glsl */ `
attribute float aSeed;
varying vec3 vN;
varying vec3 vL;
varying vec3 vS;
varying float vD;
varying float vSeed;
varying vec3 vW;
void main(){
  mat4 im = instanceMatrix;
  vec3 p = position;
  vS = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz));
  vL = p;
  vSeed = aSeed;
  ${
    kind === 2
      ? `float k = max(p.y, 0.0); p.x += sin(uTime * 1.2 + aSeed * 6.283 + k * 2.2) * 0.35 * k * k; p.z += cos(uTime * 0.9 + aSeed * 4.0 + k * 1.7) * 0.2 * k * k;`
      : ''
  }
  vec4 wp = modelMatrix * im * vec4(p, 1.0);
  ${kind === 1 ? 'wp.y += sin(uTime * 0.7 + aSeed * 6.283) * 0.6;' : ''}
  ${kind === 4 ? 'wp.y += sin(uTime * 0.9 + aSeed * 6.283) * 0.8; wp.x += cos(uTime * 0.5 + aSeed * 3.0) * 0.5;' : ''}
  wp.z += uDist;
  vN = normalize(mat3(modelMatrix * im) * normal);
  vW = wp.xyz;
  wp = bendW(wp);
  vD = distance(wp.xyz, cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const PROP_FS = (kind: number) =>
  PRE_F +
  /* glsl */ `
varying vec3 vN;
varying vec3 vL;
varying vec3 vS;
varying float vD;
varying float vSeed;
varying vec3 vW;
void main(){
  vec3 n = normalize(vN);
  vec3 L = normalize(vec3(-0.4, 0.8, 0.45));
  float dif = max(dot(n, L), 0.0);
  vec3 V = normalize(cameraPosition - vW);
  float fr = pw(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 col = vec3(0.0);
  float a = 1.0;
${
  kind === 0
    ? /* building: windows, roof neon */ `
  vec3 lp = vL * vS;
  float u = abs(n.x) > 0.5 ? lp.z : lp.x;
  vec2 cell = floor(vec2(u / 0.62, lp.y / 0.85));
  vec2 f = fract(vec2(u / 0.62, lp.y / 0.85));
  float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.8);
  float lit = step(0.55, hash12(cell + vSeed * 91.0));
  vec3 wc = mix(vec3(1.0, 0.72, 0.45), mix(uA2, uA1, step(0.5, hash12(cell.yx + vSeed))), step(0.7, hash12(cell * 1.7 + vSeed)));
  vec3 base = mix(vec3(0.03, 0.02, 0.07), uHor * 0.25, 0.25 + 0.3 * dif);
  col = base + wc * win * lit * (abs(n.y) < 0.5 ? 1.0 : 0.0) * 0.9;
  float roof = sst(0.12, 0.0, vS.y - lp.y) * (abs(n.y) < 0.5 ? 1.0 : 0.0);
  float stripe = step(0.72, fract(vSeed * 7.3)) * sst(0.08, 0.0, abs(u - 0.0)) ;
  col += mix(uA1, uA2, step(0.5, fract(vSeed * 13.0))) * (roof * 2.2 + stripe * 1.6);
  col += uA1 * fr * 0.25;
`
    : kind === 1
      ? /* floating island */ `
  float top = sst(-0.05, 0.05, vL.y);
  vec3 grass = mix(vec3(0.42, 0.85, 0.55), vec3(0.95, 0.98, 0.7), fbm(vL.xz * 3.0 + vSeed * 10.0) * 0.6);
  vec3 rock = mix(vec3(0.42, 0.3, 0.45), vec3(0.85, 0.62, 0.55), sst(-1.0, 0.0, vL.y));
  col = mix(rock, grass, top) * (0.45 + 0.65 * dif);
  col += vec3(1.0, 0.8, 0.7) * fr * 0.35;
  float crystal = step(0.8, fract(vSeed * 5.1)) * sst(-0.8, -1.0, vL.y);
  col += uA2 * crystal * 1.5;
`
      : kind === 2
        ? /* kelp */ `
  float k = clamp(vL.y, 0.0, 1.0);
  col = mix(vec3(0.02, 0.12, 0.13), vec3(0.05, 0.35, 0.3), k) * (0.5 + 0.5 * dif);
  float dots = step(0.86, hash12(floor(vec2(vL.y * 40.0, atan(vL.x, vL.z) * 3.0)) + vSeed));
  col += uA1 * (dots * 1.4 + sst(0.85, 1.0, k) * 1.2);
`
        : kind === 3
          ? /* asteroid */ `
  float g = fbm(vL.xz * 4.0 + vL.y * 3.0 + vSeed * 7.0);
  col = mix(vec3(0.12, 0.09, 0.16), vec3(0.38, 0.3, 0.36), g) * (0.25 + 0.9 * max(dot(n, normalize(vec3(0.6, 0.3, -0.8))), 0.0));
  col += uA1 * fr * 0.9;
`
          : kind === 4
            ? /* glow orb (jellyfish / lanterns) */ `
  float core = pw(max(dot(n, V), 0.0), 1.5);
  float pulse = 0.7 + 0.3 * sin(uTime * 2.0 + vSeed * 20.0);
  col = mix(uA1, vec3(1.0), core * 0.4) * (0.5 + core) * pulse * 1.3;
  a = 0.35 + core * 0.65;
`
            : /* gate */ `
  float pulse = 0.75 + 0.25 * sin(uTime * 3.0 + vSeed * 10.0);
  col = mix(uA1, uA2, step(0.5, fract(vSeed * 3.7))) * 2.4 * pulse;
`
}
  ${kind >= 4 ? 'float fa = exp(-pw(max(vD - 6.0, 0.0) * uFogDen, 1.5)); gl_FragColor = vec4(col * fa * a, 1.0);' : 'col = fogIt(col, vD); gl_FragColor = vec4(col, 1.0);'}
}`;

// ── obstacles ───────────────────────────────────────────────────────────────
export const OBST_VS =
  PRE_V +
  /* glsl */ `
varying vec3 vL;
varying vec3 vS;
varying vec3 vN;
varying float vD;
varying vec3 vW;
void main(){
  mat4 im = instanceMatrix;
  vS = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz));
  vL = position;
  vec4 wp = modelMatrix * im * vec4(position, 1.0);
  wp.z += uDist;
  vN = normalize(mat3(modelMatrix * im) * normal);
  vW = wp.xyz;
  wp = bendW(wp);
  vD = distance(wp.xyz, cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

/** tall = 1: force-field wall (dodge), 0: low hazard barrier (jump) */
export const OBST_FS = (tall: number) =>
  PRE_F +
  /* glsl */ `
varying vec3 vL;
varying vec3 vS;
varying vec3 vN;
varying float vD;
varying vec3 vW;
void main(){
  vec3 n = normalize(vN);
  vec3 lp = (vL + vec3(0.5, 0.0, 0.5)) * vS;
  float ex = min(lp.x, vS.x - lp.x);
  float ey = min(lp.y, vS.y - lp.y);
  float frame = sst(0.09, 0.0, min(ex, ey));
  vec3 col;
  float a;
${
  tall
    ? `
  vec3 c = vec3(1.0, 0.22, 0.42);
  float scan = 0.5 + 0.5 * sin(lp.y * 22.0 - uTime * 8.0);
  vec2 hx = vec2(lp.x * 2.2, lp.y * 2.2 + lp.x * 1.1);
  float hex = sst(0.06, 0.0, 0.5 - abs(fract(hx.x) - 0.5)) + sst(0.06, 0.0, 0.5 - abs(fract(hx.y) - 0.5));
  col = c * (0.35 + scan * 0.25 + hex * 0.35) + c * frame * 2.6 + vec3(1.0, 0.8, 0.85) * frame * 0.6;
  col *= 0.8 + 0.2 * step(0.5, fract(uTime * 7.0 + lp.y));
  a = 0.72 + frame * 0.28;
`
    : `
  float st = step(0.5, fract((lp.x + lp.y) * 1.6 - uTime * 0.8));
  vec3 y = vec3(1.0, 0.8, 0.18);
  col = mix(vec3(0.06, 0.04, 0.09), y * 1.05, st) * (abs(n.z) > 0.5 ? 1.0 : 0.55);
  col += y * frame * 2.2;
  float topLine = sst(0.06, 0.0, vS.y - lp.y);
  col += vec3(1.0, 0.95, 0.7) * topLine * 2.5;
  a = 1.0;
`
}
  col = fogIt(col, vD);
  gl_FragColor = vec4(col, a);
}`;

// ── pickups ────────────────────────────────────────────────────────────────
export const GEM_VS =
  PRE_V +
  /* glsl */ `
attribute float aSeed;
varying vec3 vW;
varying float vD;
varying float vSeed;
void main(){
  mat4 im = instanceMatrix;
  float an = uTime * 3.0 + aSeed * 6.283;
  float c = cos(an), s = sin(an);
  vec3 p = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z);
  vec4 wp = modelMatrix * im * vec4(p, 1.0);
  wp.y += sin(uTime * 4.0 + aSeed * 12.0) * 0.12;
  wp.z += uDist;
  vW = wp.xyz;
  wp = bendW(wp);
  vD = distance(wp.xyz, cameraPosition);
  vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const GEM_FS =
  PRE_F +
  /* glsl */ `
varying vec3 vW;
varying float vD;
varying float vSeed;
void main(){
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
  vec3 V = normalize(cameraPosition - vW);
  float f = abs(dot(n, V));
  vec3 gold = vec3(1.0, 0.82, 0.3);
  vec3 col = mix(gold * 0.6, vec3(1.0, 0.98, 0.85), pw(f, 6.0)) + gold * pw(1.0 - f, 2.0) * 1.6;
  col *= 1.35;
  col = fogIt(col, vD);
  gl_FragColor = vec4(col, 1.0);
}`;

export const GLYPH_VS =
  PRE_V +
  /* glsl */ `
attribute float aGlyph;
varying vec2 vUv;
varying float vD;
varying float vG;
void main(){
  mat4 im = instanceMatrix;
  vec4 c = modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0);
  c.y += sin(uTime * 3.0) * 0.15;
  c.z += uDist;
  vec4 wc = bendW(c);
  float sc = length(im[0].xyz);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = wc.xyz + (right * position.x + up * position.y) * sc;
  vUv = uv;
  vG = aGlyph;
  vD = distance(wp, cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

export const GLYPH_FS =
  PRE_F +
  /* glsl */ `
uniform sampler2D tAtlas;
varying vec2 vUv;
varying float vD;
varying float vG;
void main(){
  vec2 uv = vec2((vUv.x + vG) / 4.0, vUv.y);
  vec4 t = texture2D(tAtlas, uv);
  vec2 q = vUv - 0.5;
  float r = length(q);
  float ring = sst(0.03, 0.0, abs(r - 0.44)) + exp(-r * 5.0) * 0.25;
  vec3 col = mix(uA2, vec3(1.0), t.r) * (t.g * 2.2) + uA2 * ring * 1.6;
  float a = clamp(t.g + ring, 0.0, 1.0);
  float fa = exp(-max(vD - 20.0, 0.0) * 0.02);
  gl_FragColor = vec4(col * fa, a * fa);
}`;

// ── the ship ───────────────────────────────────────────────────────────────
export const SHIP_VS = /* glsl */ `
varying vec3 vN;
varying vec3 vL;
varying vec3 vW;
void main(){
  vL = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const SHIP_FS = /* glsl */ `
uniform vec3 uA1;
uniform vec3 uA2;
uniform vec3 uHor;
uniform vec3 uZen;
uniform vec3 uBody;
uniform float uGlass;
uniform float uBlink;
uniform float uTime;
varying vec3 vN;
varying vec3 vL;
varying vec3 vW;
void main(){
  vec3 n = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize(vec3(-0.3, 0.9, 0.4));
  float dif = max(dot(n, L), 0.0);
  float fr = pw(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 R = reflect(-V, n);
  vec3 env = mix(uHor, uZen, sst(-0.2, 0.8, R.y)) + uA1 * 0.15;
  vec3 col;
  if (uGlass > 0.5) {
    col = vec3(0.02, 0.02, 0.05) + env * (0.25 + fr * 0.9) + pw(max(dot(R, L), 0.0), 60.0) * 2.0;
    col += uA2 * 0.12;
  } else {
    float topMask = sst(0.1, 0.28, vL.y) * sst(0.25, 0.75, n.y);
    vec3 base = mix(vec3(0.1, 0.07, 0.22), uBody, topMask);
    col = base * (0.3 + 0.7 * dif) + env * (0.1 + fr * 0.5) + pw(max(dot(R, L), 0.0), 40.0) * 0.8;
    // glowing belt line around the hull
    float belt = sst(0.035, 0.0, abs(vL.y - 0.16)) * (1.0 - abs(n.y));
    col += uA1 * belt * 3.0;
    // underside glow
    col += uA1 * sst(0.0, -1.0, n.y) * 0.6;
    // panel lines
    float pl = sst(0.02, 0.0, 0.5 - abs(fract(vL.z * 1.4 + 0.2) - 0.5)) * step(0.5, n.y);
    col *= 1.0 - pl * 0.35;
  }
  col = mix(col, col * 0.2 + uA1 * 0.6, uBlink);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Additive camera-facing glows (engine flare, pickup flashes). */
export const FLARE_VS = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 c = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sx = length(modelMatrix[0].xyz);
  float sy = length(modelMatrix[1].xyz);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = c.xyz + right * position.x * sx + up * position.y * sy;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
export const FLARE_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uAmt;
varying vec2 vUv;
void main(){
  vec2 q = vUv - 0.5;
  float r = length(q);
  float g = exp(-r * 9.0) * 1.6 + exp(-abs(q.y) * 60.0) * exp(-abs(q.x) * 4.0) * 0.8;
  gl_FragColor = vec4(uColor * g * uAmt, 1.0);
}`;

/** Engine trail ribbon. */
export const TRAIL_VS = /* glsl */ `
attribute float aT;
varying float vT;
varying float vSide;
void main(){
  vT = aT;
  vSide = uv.y;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`;
export const TRAIL_FS = /* glsl */ `
uniform vec3 uA1;
uniform vec3 uA2;
uniform float uAmt;
varying float vT;
varying float vSide;
void main(){
  float e = 1.0 - abs(vSide * 2.0 - 1.0);
  vec3 c = mix(vec3(1.0), mix(uA1, uA2, vT), sst(0.0, 0.25, vT));
  gl_FragColor = vec4(c * pw(e, 1.5) * pw(1.0 - vT, 1.6) * 1.4 * uAmt, 1.0);
}`;

/** Soft round shadow under the ship. */
export const BLOB_FS = /* glsl */ `
uniform float uAmt;
varying vec2 vUv;
void main(){
  float r = length(vUv - 0.5) * 2.0;
  gl_FragColor = vec4(0.0, 0.0, 0.0, sst(1.0, 0.1, r) * 0.55 * uAmt);
}`;
export const PLAIN_VS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`;

/** Sparks and pickup bursts (CPU simulated). */
export const SPARK_VS = /* glsl */ `
attribute vec3 aColor;
attribute float aLife;
uniform float uPx;
varying vec3 vC;
varying float vLife;
void main(){
  vC = aColor;
  vLife = aLife;
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_PointSize = aLife <= 0.0 ? 0.0 : uPx * (0.25 + aLife) * 9.0 / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
export const SPARK_FS = /* glsl */ `
varying vec3 vC;
varying float vLife;
void main(){
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q);
  if (r > 0.5) discard;
  gl_FragColor = vec4(vC * sst(0.5, 0.0, r) * clamp(vLife * 1.5, 0.0, 1.0) * 1.6, 1.0);
}`;

/** Speed streaks drifting past on both sides. */
export const STREAK_VS = /* glsl */ `
uniform float uDist;
uniform float uLen;
attribute float aEnd;
varying float vA;
void main(){
  vec3 p = position;
  float z = mod(p.z + uDist * 1.4, 110.0) - 100.0;
  z += aEnd * uLen;
  vA = (1.0 - aEnd) * sst(-100.0, -60.0, z) * sst(8.0, -2.0, z);
  gl_Position = projectionMatrix * viewMatrix * vec4(p.x, p.y, z, 1.0);
}`;
export const STREAK_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uAmt;
varying float vA;
void main(){ gl_FragColor = vec4(uColor * vA * uAmt, 1.0); }`;

// ── post ───────────────────────────────────────────────────────────────────
export const POST_VS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const BRIGHT_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThresh;
varying vec2 vUv;
void main(){
  vec3 c = vec3(0.0);
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = sst(uThresh, uThresh + 0.6, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;

export const BLUR_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
  c += texture2D(tSrc, vUv + uDir * 1.385).rgb * 0.316;
  c += texture2D(tSrc, vUv - uDir * 1.385).rgb * 0.316;
  c += texture2D(tSrc, vUv + uDir * 3.231).rgb * 0.070;
  c += texture2D(tSrc, vUv - uDir * 3.231).rgb * 0.070;
  gl_FragColor = vec4(c, 1.0);
}`;

/** Bloom + CRT: barrel curve, chromatic fringe, scanlines, shadow mask, power-on. */
export const COMP_FS = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tB1;
uniform sampler2D tB2;
uniform vec2 uRes;
uniform float uTime;
uniform float uCurve;
uniform float uAberr;
uniform float uHit;
uniform float uPower;
uniform float uScanPx;
uniform float uScan;
uniform float uGrain;
varying vec2 vUv;
float h1(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  float asp = uRes.x / uRes.y;
  vec2 k = vec2(uCurve * 0.6 / asp, uCurve);
  uv *= 1.0 + vec2(uv.y * uv.y, uv.x * uv.x) * k;
  vec2 cuv = uv * 0.5 + 0.5;
  // power-on: a bright line that opens into the picture
  float pon = clamp(uPower, 0.0, 1.0);
  float open = sst(0.0, 1.0, (pon - 0.25) / 0.75);
  float ly = abs(cuv.y - 0.5);
  float lx = abs(cuv.x - 0.5);
  float mask = step(ly, max(0.003, open * 0.5)) * step(lx, clamp(pon * 4.0, 0.0, 1.0) * 0.5);
  // hit: a few torn scan rows
  float tear = uHit * (step(0.92, h1(vec2(floor(cuv.y * 40.0), floor(uTime * 20.0)))) * 0.03);
  cuv.x += tear;
  vec2 dir = (cuv - 0.5);
  float ab = uAberr * (0.6 + dot(dir, dir) * 3.0) / uRes.x * 900.0;
  vec3 c;
  c.r = texture2D(tScene, cuv + dir * ab * 0.006).r;
  c.g = texture2D(tScene, cuv).g;
  c.b = texture2D(tScene, cuv - dir * ab * 0.006).b;
  vec3 b1 = texture2D(tB1, cuv).rgb;
  vec3 b2 = texture2D(tB2, cuv).rgb;
  c += b1 * 0.85 + b2 * 0.9;
  c = aces(c * 1.05);
  c = pw(c, vec3(0.92));
  // scanlines + aperture grille
  float sl = 0.5 + 0.5 * cos(gl_FragCoord.y * 3.14159 / uScanPx);
  c *= 1.0 - uScan * (1.0 - sl);
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 grille = m < 1.0 ? vec3(1.0, 0.94, 0.94) : m < 2.0 ? vec3(0.94, 1.0, 0.94) : vec3(0.94, 0.94, 1.0);
  c *= mix(vec3(1.0), grille, uScan * 0.8);
  // vignette + rounded tube corners
  vec2 e = abs(uv);
  float corner = sst(1.0, 0.985, max(e.x, e.y) + pw(min(e.x, e.y), 8.0) * 0.0);
  float vig = 1.0 - dot(uv * vec2(0.55, 0.7), uv * vec2(0.55, 0.7)) * 0.55;
  c *= vig * corner;
  if (cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0) c = vec3(0.0);
  // grain + hit flash
  c += (h1(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * uGrain;
  c = mix(c, vec3(1.0, 0.15, 0.35), uHit * 0.28);
  // power-on glow line
  float line = exp(-ly * 300.0) * (1.0 - open) * step(0.001, pon) * step(lx, clamp(pon * 4.0, 0.0, 1.0) * 0.5);
  c = c * mask + vec3(0.85, 0.9, 1.0) * line * 1.5;
  c += vec3(0.6, 0.7, 1.0) * (1.0 - open) * mask * 0.35 * step(0.001, pon);
  gl_FragColor = vec4(c, 1.0);
}`;
