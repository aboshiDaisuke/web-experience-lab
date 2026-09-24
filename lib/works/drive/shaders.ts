import { COMMON } from './glsl';

const LINES = /* glsl */ `
float lineX(float x, float c, float hw) {
  float fw = max(fwidth(x), 1e-4);
  return smoothstep(hw + fw, hw - fw, abs(x - c));
}
float dashS(float s, float period, float on) {
  float fs = max(fwidth(s), 1e-4);
  float ph = mod(s, period);
  float m = (1.0 - smoothstep(on - fs, on + fs, ph)) * smoothstep(0.0, fs, ph);
  return mix(m, on / period, smoothstep(period * 0.2, period * 0.5, fs));
}
`;

const VARY = /* glsl */ `
uniform float uMask;
varying vec3 vW;
varying vec3 vN;
varying vec2 vUv;
varying vec3 vTint;
`;

/** Wet-asphalt mirror streaks of lamps, tunnel fixtures and taillights. */
const WET = /* glsl */ `
uniform vec4 uCars[8];
vec3 wetRefl(vec3 w, float d) {
  vec3 acc = vec3(0.0);
  float hc = 1.22;
  float f = hc / (hc + 9.6);
  float dl = d / f;
  float st = uS + dl;
  float e = mod(st, LAMP_D);
  float off = e < LAMP_D * 0.5 ? e : e - LAMP_D;
  float sl = mod(st - off, LOOP);
  float on = 1.0 - inTun(sl);
  float dd = abs(off) * f;
  float sig = 0.5 + d * 0.2;
  float along = exp(-dd * dd / (sig * sig)) / (1.0 + dl * dl * 0.00025);
  vec3 lc = lampCol(sl) * on * along;
  for (int i = 0; i < 2; i++) {
    float hx = i == 0 ? 2.35 : 7.65;
    float xm = uCamX + (hx - uCamX) * f;
    float sx = 0.06 + d * 0.007;
    float dx = w.x - xm;
    acc += lc * exp(-dx * dx / (sx * sx)) * 0.85;
  }
  if (uTunVis > 0.0) {
    float ft = hc / (hc + 5.0);
    float dlt = d / ft;
    float stt = uS + dlt;
    float et = mod(stt, 7.0);
    float nt = min(et, 7.0 - et) * ft;
    float tin = inTun(mod(stt, LOOP));
    float sgt = 0.35 + d * 0.12;
    float al = exp(-nt * nt / (sgt * sgt)) * tin;
    for (int i = 0; i < 2; i++) {
      float hx = i == 0 ? -4.0 : 4.0;
      float xm = uCamX + (hx - uCamX) * ft;
      float sx = 0.12 + d * 0.014;
      float dx = w.x - xm;
      acc += vec3(1.0, 0.42, 0.1) * al * exp(-dx * dx / (sx * sx)) * 0.8;
    }
  }
  float fc = hc / (hc + 0.85);
  for (int i = 0; i < 8; i++) {
    vec4 c = uCars[i];
    if (c.z <= 0.0) continue;
    float dm = c.y * fc;
    float xm = uCamX + (c.x - uCamX) * fc;
    float sgc = 0.6 + dm * 0.3;
    float sx = 0.45 + dm * 0.012;
    float dz = d - dm;
    float dx = w.x - xm;
    acc += vec3(1.0, 0.05, 0.025) * c.z * exp(-dz * dz / (sgc * sgc)) * exp(-dx * dx / (sx * sx)) * 0.55;
  }
  return acc;
}
`;

export const ROAD_FS = /* glsl */ `
${COMMON}
${VARY}
${LINES}
${WET}
void main() {
  vec3 w = vW;
  float d = -w.z;
  float s = sAt(w.z);
  float x = w.x;
  float fs = fwidth(s);
  float grain = mix(hash(floor(vec2(x, s) * 24.0)), 0.5, smoothstep(0.03, 0.25, fs));
  float patchN = fbm(vec2(x * 0.3, s * 0.06));
  float alb = 0.03 + 0.022 * grain + 0.018 * patchN;
  // markings
  bool decel = d > uDecD && d < uDivD + 2.0;
  float edgeL = lineX(x, -3.62, decel ? 0.2 : 0.1) * (decel ? dashS(uQ + d, 12.0, 6.0) : 1.0);
  float m = edgeL;
  m += lineX(x, 0.0, 0.075) * dashS(s, 20.0, 8.0);
  m += lineX(x, 3.62, 0.1);
  m += lineX(x, 6.18, 0.1);
  m += lineX(x, 9.8, 0.075) * dashS(s + 7.0, 20.0, 8.0);
  m += lineX(x, 13.42, 0.1);
  m *= 0.72 + 0.28 * vnoise(vec2(x * 7.0, s * 1.7));
  m = clamp(m, 0.0, 1.0);
  alb = mix(alb, 0.6, m);
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec3 E = lampLight(w, n, s) + tunnelLight(s, 0.0) * 1.3 + vec3(0.004, 0.006, 0.011);
  float hl = headlight(w);
  vec3 col = alb * (E + vec3(1.0, 0.93, 0.82) * hl);
  col += m * vec3(1.0, 0.95, 0.86) * hl * 0.9;
  float wet = uWet * (0.45 + 0.55 * smoothstep(0.35, 0.72, patchN)) * (1.0 - m * 0.75);
  col += wet * wetRefl(w, d);
  col += wet * uFogCol * 1.2 * smoothstep(15.0, 240.0, d);
  // the road deck edge: fade the outer shoulder into darkness
  col *= smoothstep(-6.8, -6.0, x) * smoothstep(17.0, 16.2, x);
  gl_FragColor = vec4(fogIt(col, d), 1.0);
}
`;

export const RAMP_FS = /* glsl */ `
${COMMON}
${VARY}
${LINES}
uniform float uQDec;
uniform float uQDiv;
uniform float uQGate;
uniform vec3 uRL[3];
void main() {
  vec3 w = vW;
  float d = -w.z;
  float q = uQ + d;
  float x = w.x;
  if (q < uQDec) discard;
  float taper = smoothstep(uQDec, uQDec + 55.0, q);
  float leftEdge = mix(-3.62, -7.22, taper);
  if (x < leftEdge - 2.3) discard;
  float dd = max(d - uDivD, 0.0);
  float hwEdge = -3.62 + uDiv * dd * dd;
  if (x > hwEdge - 0.16) discard;
  float grain = mix(hash(floor(vec2(x, q) * 24.0)), 0.5, smoothstep(0.03, 0.25, fwidth(q)));
  float patchN = fbm(vec2(x * 0.3, q * 0.06));
  float alb = 0.032 + 0.022 * grain + 0.016 * patchN;
  float m = lineX(x, leftEdge, 0.1);
  if (q > uQDiv - 4.0) {
    // toll plaza widening: a second lane opens on the right near the gate
    float plaza = smoothstep(uQGate - 75.0, uQGate - 35.0, q) * (1.0 - smoothstep(uQGate + 25.0, uQGate + 60.0, q));
    float rb = -3.62 + 3.7 * plaza;
    float nose = uQDiv + 20.0;
    if (q > nose && x > rb + 1.1) discard;
    m += lineX(x, -3.62, 0.1) * (1.0 - plaza);
    m += lineX(x, rb, 0.1) * plaza;
    float gore = step(-3.5, x) * step(x, hwEdge - 0.3) * (1.0 - step(nose, q));
    float z = step(fract((q * 0.75 - x) / 3.0), 0.2);
    m += gore * z;
  }
  m = clamp(m * (0.75 + 0.25 * vnoise(vec2(x * 7.0, q * 1.7))), 0.0, 1.0);
  alb = mix(alb, 0.6, m);
  vec3 E = vec3(0.004, 0.006, 0.011);
  for (int i = 0; i < 3; i++) {
    vec3 dl = uRL[i] - w;
    float r2 = dot(dl, dl);
    E += vec3(1.0, 0.45, 0.12) * 8.0 * 30.0 / (r2 * sqrt(r2) + 30.0);
  }
  float gz = d - uGateD;
  E += vec3(0.92, 0.96, 1.0) * 1.0 * exp(-gz * gz / 70.0) * step(x, 1.5) * step(-14.0, x);
  float hl = headlight(w);
  vec3 col = alb * (E + vec3(1.0, 0.93, 0.82) * hl);
  col += m * vec3(1.0, 0.95, 0.86) * hl * 0.9;
  float wet = uWet * (0.45 + 0.55 * smoothstep(0.35, 0.72, patchN)) * (1.0 - m * 0.75);
  col += wet * uFogCol * 0.8 * smoothstep(15.0, 240.0, d);
  col += wet * vec3(0.9, 0.95, 1.0) * 0.5 * exp(-gz * gz / 400.0) * smoothstep(8.0, 30.0, d) * step(x, 1.5);
  gl_FragColor = vec4(fogIt(col, d), 1.0);
}
`;

export const GROUND_FS = /* glsl */ `
${COMMON}
${VARY}
void main() {
  vec3 w = vW;
  float d = -w.z;
  float s = sAt(w.z);
  float n = fbm(vec2(w.x * 0.02, s * 0.02));
  vec3 col = vec3(0.006, 0.008, 0.01) * (0.6 + 0.8 * n);
  gl_FragColor = vec4(fogIt(col, d), 1.0);
}
`;

/** Guardrail, concrete barrier, glare fence, tunnel shell. */
export const RAIL_FS = /* glsl */ `
${COMMON}
${VARY}
uniform float uD0;
uniform float uD1;
uniform float uNx;
uniform float uCutTun;
uniform float uRamp;
void main() {
  vec3 w = vW;
  float d = -w.z;
  float s = uRamp > 0.5 ? uQ + d : sAt(w.z);
  float sl = sAt(w.z);
  if (d < uD0 || d > uD1) discard;
  float tun = inTun(sl);
  #if TYPE != 3
  if (uCutTun > 0.5 && tun > 0.5 && uRamp < 0.5) discard;
  #endif
  vec3 n = normalize(vec3(uNx, 0.0, 0.0));
  vec3 base = vec3(0.3);
  float spec = 0.0;
  #if TYPE == 0
    // W-beam guardrail on posts
    if (w.y < 0.46) {
      if (fract(s / 2.0) > 0.06 && fwidth(s / 2.0) < 0.3) discard;
      base = vec3(0.12);
    } else {
      float t = (w.y - 0.46) / 0.36;
      float ridge = 0.55 + 0.45 * cos(t * 6.2831 * 2.0);
      base = vec3(0.42, 0.43, 0.45) * ridge;
      n = normalize(vec3(uNx, (t - 0.5) * 0.6 * sign(cos(t * 6.2831 * 2.0 + 1.57)), 0.0));
      spec = 1.0;
    }
  #elif TYPE == 1
    // concrete barrier (median)
    float st = vnoise(vec2(s * 0.8, w.y * 6.0));
    base = vec3(0.26, 0.25, 0.23) * (0.8 + 0.3 * st) * (0.7 + 0.3 * smoothstep(0.0, 0.3, w.y));
    n = normalize(vN);
  #elif TYPE == 2
    // anti-glare fence: vertical slats
    float fq = fwidth(s * 4.0);
    if (fq < 0.5 && fract(s * 4.0) > 0.38) discard;
    base = vec3(0.08, 0.1, 0.09) * (1.0 + 0.3 * step(1.85, w.y));
  #elif TYPE == 3
    if (tun < 0.5) discard;
    n = normalize(vec3(-w.x, 3.0 - w.y, 0.0));
    float seam = step(0.97, fract(s / 4.0)) + step(0.985, fract(w.y / 1.3));
    float panel = step(w.y, 4.1) * step(0.9, w.y);
    base = mix(vec3(0.06, 0.06, 0.06), vec3(0.55, 0.52, 0.46), panel);
    base *= 1.0 - 0.5 * clamp(seam, 0.0, 1.0) * panel;
    if (w.y < 0.9) base = vec3(0.12);
    // light from fixtures on both upper side walls (every 7 m)
    float ph = 0.5 + 0.5 * cos(6.2831 * s / 7.0);
    float nearL = exp(-abs(w.y - 5.1) / 1.6);
    vec3 tl = vec3(1.0, 0.42, 0.1) * (0.3 + 0.9 * nearL * pow(ph, 5.0) + 0.25 * nearL);
    vec3 colT = base * tl * (0.6 + 0.4 * smoothstep(0.0, 3.0, w.y));
    colT += base * vec3(1.0, 0.93, 0.82) * headlight(vec3(w.x, 0.0, w.z)) * 0.2;
    gl_FragColor = vec4(fogIt(colT, d), 1.0);
    return;
  #endif
  vec3 E = lampLight(w, n, sl) * 0.9 + tunnelLight(sl, w.y) + vec3(0.006, 0.008, 0.014);
  float hl = headlight(vec3(w.x * 0.8 + uCamX * 0.2, 0.0, w.z)) * (0.5 + 0.5 * step(w.y, 1.2));
  vec3 col = base * (E + vec3(1.0, 0.93, 0.82) * hl * 1.4);
  col += spec * (E * 0.35 + hl * 0.5);
  gl_FragColor = vec4(fogIt(col, d), 1.0);
}
`;

export const RAIL_VS = /* glsl */ `
${COMMON}
${VARY}
uniform float uTaper;
uniform float uQDec;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  vTint = vec3(1.0);
  if (uTaper != 0.0) {
    float q = uQ - w.z;
    float t = smoothstep(uQDec, uQDec + 55.0, q);
    w.x += uTaper * t;
    vW.x = w.x;
  }
  w.xyz = bendW(w.xyz, uMask);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/** Poles, gantries, cars, booths, sign panels. */
export const SOLID_FS = /* glsl */ `
${COMMON}
${VARY}
uniform vec3 uColor;
uniform float uEmis;
uniform float uRetro;
uniform float uSpec;
#ifdef USE_MAP
uniform sampler2D map;
#endif
#ifdef CAR
varying vec3 vSize;
#endif
void main() {
  vec3 w = vW;
  float d = -w.z;
  float s = sAt(w.z);
  vec3 n = normalize(vN);
  vec3 base = uColor * vTint;
  #ifdef USE_MAP
  vec4 tx = texture2D(map, vUv);
  base = tx.rgb;
  #endif
  vec3 E = lampLight(w, n, s) * 0.8 + tunnelLight(s, w.y) * (0.5 + 0.5 * max(n.y, 0.0)) + vec3(0.008, 0.01, 0.018);
  float gz = d - uGateD;
  E += vec3(0.92, 0.96, 1.0) * 0.42 * exp(-gz * gz / 60.0) * step(w.y, 5.3) * step(w.x, 1.5) * step(-14.0, w.x) * (1.0 - uMask) * (0.35 + 0.65 * max(n.y, 0.0));
  float lx = w.x - uCamX + uYaw * d;
  float hv = uHead * 26.0 / (d * d + 6.0) * exp(-lx * lx / (1.0 + d * d * 0.06)) * max(n.z, 0.0);
  float cut = 1.0 - smoothstep(1.0, 1.8, w.y - d * 0.004);
  vec3 col = base * (E + vec3(1.0, 0.93, 0.82) * hv * cut);
  // retroreflective sheeting returns the headlights regardless of height
  col += base * uRetro * uHead * (60.0 / (d * d * 0.35 + 60.0)) * max(n.z, 0.0);
  #ifdef BOOTH
  float win = step(0.52, vUv.y) * step(vUv.y, 0.8) * step(0.18, vUv.x) * step(vUv.x, 0.82);
  col = mix(col, vec3(1.0, 0.82, 0.55) * (0.22 + 0.08 * vUv.y), win * step(0.5, abs(n.x) + abs(n.z)));
  #endif
  col += base * uEmis;
  col += uSpec * E * 0.25 * pow(max(n.y, 0.0), 4.0);
  #ifdef CAR
  if (n.z > 0.5) {
    // rear face: glass, plate lamp, bumper
    vec2 r = vUv;
    bool truck = vSize.y > 2.4;
    if (!truck) {
      float glass = step(0.62, r.y) * step(r.y, 0.93) * step(0.12, r.x) * step(r.x, 0.88);
      col = mix(col, vec3(0.004, 0.005, 0.008) + E * 0.05, glass);
      float plate = step(0.18, r.y) * step(r.y, 0.3) * step(0.38, r.x) * step(r.x, 0.62);
      col += plate * vec3(0.9, 0.88, 0.7) * 0.35;
    } else {
      float seam = step(abs(r.x - 0.5), 0.004) + step(abs(r.x - 0.03), 0.006) + step(abs(r.x - 0.97), 0.006);
      col *= 1.0 - 0.6 * clamp(seam, 0.0, 1.0);
      float bar = step(0.02, r.y) * step(r.y, 0.06);
      col = mix(col, vec3(0.02), bar);
      float plate = step(0.1, r.y) * step(r.y, 0.15) * step(0.44, r.x) * step(r.x, 0.56);
      col += plate * vec3(0.9, 0.88, 0.7) * 0.35;
    }
  }
  #endif
  gl_FragColor = vec4(fogIt(col, d), 1.0);
}
`;

export const CAR_VS = /* glsl */ `
${COMMON}
${VARY}
varying vec3 vSize;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vSize = vec3(length(m[0].xyz), length(m[1].xyz), length(m[2].xyz));
  vec4 w = m * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(m) * normal);
  vUv = uv;
  vTint = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
  vTint = instanceColor;
  #endif
  // instance colour .b doubles as the divergence mask (see scene)
  w.xyz = bendW(w.xyz, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/** Additive light glows; they stretch into trails with speed. */
export const GLOW_VS = /* glsl */ `
${COMMON}
attribute vec3 aP;
attribute vec4 aC;
attribute vec3 aS;
uniform float uStreak;
uniform float uPx;
varying vec2 vQ;
varying float vK;
varying vec3 vCol;
void main() {
  vec3 w0 = bendW(aP, aS.z);
  vec3 w1 = bendW(aP + vec3(0.0, 0.0, uStreak * aC.w), aS.z);
  vec4 v0 = viewMatrix * vec4(w0, 1.0);
  vec4 v1 = viewMatrix * vec4(w1, 1.0);
  float nearZ = -0.6;
  if (v0.z > nearZ) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vQ = vec2(0.0); vK = 1.0; vCol = vec3(0.0);
    return;
  }
  if (v1.z > nearZ) v1.xyz = mix(v0.xyz, v1.xyz, (v0.z - nearZ) / (v0.z - v1.z));
  vec3 A = v1.xyz - v0.xyz;
  vec3 mid = (v0.xyz + v1.xyz) * 0.5;
  float minR = -mid.z * uPx * 1.3;
  float r = max(aS.x, minR);
  float rh = max(aS.y, minR);
  float energy = (aS.x * aS.y) / (r * rh);
  float lenA = length(A);
  float f = clamp(lenA / (2.5 * r) - 0.2, 0.0, 1.0);
  vec3 qs = mid + vec3(position.x * r, position.y * rh, 0.0);
  vec3 dirA = lenA > 1e-4 ? A / lenA : vec3(1.0, 0.0, 0.0);
  vec3 cr = cross(dirA, normalize(mid));
  vec3 E = length(cr) > 1e-4 ? normalize(cr) : vec3(0.0, 1.0, 0.0);
  float halfLen = lenA * 0.5 + r;
  float wr = sqrt(r * rh);
  vec3 qk = mid + dirA * position.x * halfLen + E * position.y * wr;
  vec3 q = mix(qs, qk, f);
  vK = mix(1.0, halfLen / r, f);
  vQ = vec2(position.x * vK, position.y);
  float fog = exp(-max(-v0.z, 0.0) * uFogDen * 0.5);
  vCol = aC.rgb * fog * energy / (1.0 + 0.45 * (vK - 1.0));
  gl_Position = projectionMatrix * vec4(q, 1.0);
}
`;

export const GLOW_FS = /* glsl */ `
varying vec2 vQ;
varying float vK;
varying vec3 vCol;
void main() {
  float ex = max(abs(vQ.x) - (vK - 1.0), 0.0);
  float d2 = ex * ex + vQ.y * vQ.y;
  float core = exp(-d2 * 24.0);
  float halo = exp(-sqrt(d2) * 4.2) * 0.3;
  float edge = 1.0 - smoothstep(0.7, 1.0, sqrt(d2));
  gl_FragColor = vec4(vCol * (core + halo) * edge, 1.0);
}
`;

export const SKY_VS = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

export const SKY_FS = /* glsl */ `
${COMMON}
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
varying vec2 vNdc;
void main() {
  vec4 p = uInvProj * vec4(vNdc, 1.0, 1.0);
  vec3 dirV = normalize(p.xyz / p.w);
  vec3 dir = normalize(mat3(uCamWorld) * dirV);
  float el = dir.y;
  float az = atan(dir.x, -dir.z);
  vec3 top = vec3(0.0009, 0.0013, 0.0038);
  vec3 col = mix(uFogCol, top, smoothstep(-0.01, 0.42, el));
  float cityAz = exp(-pow((az - 0.35) / 0.8, 2.0));
  col += vec3(0.42, 0.2, 0.1) * 0.1 * exp(-max(el, 0.0) / 0.06) * (0.4 + 0.6 * cityAz);
  // low clouds lit from below by the city
  float cl = fbm(vec2(az * 2.4 + uTime * 0.003, el * 7.0 + 3.0));
  float band = smoothstep(0.02, 0.12, el) * exp(-max(el, 0.0) / 0.25);
  col += vec3(0.36, 0.17, 0.09) * 0.075 * smoothstep(0.42, 0.85, cl) * band * (0.4 + 0.6 * cityAz);
  // skyline
  float cell = floor(az * 150.0);
  float fx = fract(az * 150.0);
  float cluster = smoothstep(0.25, 0.75, vnoise(vec2(az * 5.0, 2.0)) + cityAz * 0.35);
  float h = (pow(hash(vec2(cell, 3.1)), 2.6) * 0.03 + 0.003) * cluster;
  float tower = step(abs(az - 0.52), 0.0016) * 0.075 + step(abs(az - 0.52), 0.005) * 0.03;
  h = max(h, tower);
  float gap = step(0.08, fx) * step(fx, 0.94);
  if (el > -0.02 && el < h && (gap > 0.5 || tower > 0.0)) {
    vec3 sil = vec3(0.005, 0.006, 0.011);
    vec2 wc = vec2(floor(az * 2200.0), floor(el * 1500.0));
    float lit = step(0.8, hash(wc)) * step(0.3, hash(vec2(cell, 9.0)));
    vec3 wcol = mix(vec3(1.0, 0.62, 0.3), vec3(0.75, 0.85, 1.0), step(0.6, hash(wc + 3.0)));
    sil += wcol * lit * 0.1 * step(0.005, h - el);
    col = mix(col, sil, 0.92);
    // aviation obstruction lights
    if (h > 0.02 && el > h - 0.0025 && abs(fx - 0.5) < 0.1) {
      float blink = step(0.5, fract(uTime * 0.55 + hash(vec2(cell, 1.0))));
      col += vec3(1.0, 0.06, 0.03) * blink * 1.6;
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

export const HOOD_VS = /* glsl */ `
varying vec3 vPv;
varying vec3 vNv;
varying vec2 vUv;
void main() {
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  vPv = p.xyz;
  vNv = normalize(normalMatrix * normal);
  vUv = uv;
  gl_Position = projectionMatrix * p;
}
`;

export const HOOD_FS = /* glsl */ `
uniform vec3 uL[8];
uniform vec3 uLc[8];
uniform vec3 uFogCol;
uniform float uTun;
varying vec3 vPv;
varying vec3 vNv;
varying vec2 vUv;
void main() {
  vec3 V = normalize(vPv);
  vec3 N = normalize(vNv);
  vec3 R = reflect(V, N);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(-V, N), 0.0), 5.0);
  vec3 col = vec3(0.004, 0.005, 0.008);
  col += (uFogCol * 1.6 + vec3(1.0, 0.42, 0.1) * uTun * 0.35) * smoothstep(-0.05, 0.25, R.y) * fres * 1.4;
  for (int i = 0; i < 8; i++) {
    float k = max(dot(R, uL[i]), 0.0);
    col += uLc[i] * (pow(k, 2600.0) * 2.0 + pow(k, 500.0) * 0.03) * (0.3 + fres);
  }
  // fade the hood's front edge a little so it reads as a curved panel
  col *= smoothstep(0.0, 0.25, vUv.y) * 0.8 + 0.2;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const POST_VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BRIGHT_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(max(c.r, c.g), c.b);
  float k = smoothstep(0.55, 1.6, l);
  gl_FragColor = vec4(min(c * k, vec3(40.0)), 1.0);
}
`;

export const BLUR_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
  c += texture2D(tSrc, vUv + uDir * 1.385).rgb * 0.316;
  c += texture2D(tSrc, vUv - uDir * 1.385).rgb * 0.316;
  c += texture2D(tSrc, vUv + uDir * 3.231).rgb * 0.07;
  c += texture2D(tSrc, vUv - uDir * 3.231).rgb * 0.07;
  gl_FragColor = vec4(c, 1.0);
}
`;

export const COMP_FS = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tB1;
uniform sampler2D tB2;
uniform float uSpeed;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uExpo;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
  vec2 uv = vUv;
  vec2 dir = uv - uCenter;
  float amt = uSpeed * 0.022 * smoothstep(0.05, 0.5, length(dir));
  vec3 c = texture2D(tScene, uv).rgb;
  if (amt > 0.0004) {
    vec3 acc = c;
    for (int i = 1; i < 6; i++) acc += texture2D(tScene, uv - dir * amt * float(i) / 5.0).rgb;
    c = acc / 6.0;
  }
  // slight chromatic fringe toward the edges
  float ca = 0.0016 * dot(dir, dir) * 4.0;
  c.r = mix(c.r, texture2D(tScene, uv + dir * ca).r, 0.6);
  c.b = mix(c.b, texture2D(tScene, uv - dir * ca).b, 0.6);
  vec3 b = texture2D(tB1, uv).rgb * 0.5 + texture2D(tB2, uv).rgb * 0.85;
  c += b;
  c = aces(c * uExpo);
  // grade: cool shadows, warm highlights
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c += vec3(-0.006, 0.0, 0.018) * (1.0 - smoothstep(0.0, 0.3, l));
  vec2 vv = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  c *= mix(0.3, 1.0, smoothstep(1.1, 0.25, length(vv)));
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  float g = h(uv * uRes + fract(uTime * 13.7) * 91.0) - 0.5;
  c += g * 0.045 * (1.0 - l * 0.5);
  gl_FragColor = vec4(c, 1.0);
}
`;
