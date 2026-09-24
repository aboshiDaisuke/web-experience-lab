// Shared GLSL for the night-highway scene.
// World convention: camera sits at z = 0 and looks down -z; everything is placed
// by its distance ahead (d = -z). "Road space" s = loop distance of a fragment.
// Curvature is a camera-relative quadratic bend (x += k·d²), applied after the
// model matrix, so the whole world can curve without rebuilding any geometry.
// mask = 1 for objects that belong to the highway (they diverge to the right
// when the car takes the exit ramp), 0 for ramp / scenery.

export const LOOP = 2100;
export const T0 = 540;
export const T1 = 980;
export const LED0 = 980;
export const LED1 = 1700;
export const LAMP_D = 42;

export const COMMON = /* glsl */ `
uniform float uBend;
uniform float uHill;
uniform float uDiv;
uniform float uDivD;
uniform float uS;
uniform float uCamX;
uniform float uYaw;
uniform float uHead;
uniform float uFogDen;
uniform float uTime;
uniform float uTunVis;
uniform float uDecD;
uniform float uQ;
uniform float uGateD;
uniform float uWet;
uniform vec3 uFogCol;
#define LOOP ${LOOP.toFixed(1)}
#define T0 ${T0.toFixed(1)}
#define T1 ${T1.toFixed(1)}
#define LAMP_D ${LAMP_D.toFixed(1)}
#define PI 3.14159265

float sAt(float z) { return mod(uS - z, LOOP); }
float inTun(float s) { return step(T0, s) * step(s, T1) * uTunVis; }
vec3 lampCol(float s) {
  float led = step(${LED0.toFixed(1)}, s) * step(s, ${LED1.toFixed(1)});
  return mix(vec3(1.0, 0.43, 0.11), vec3(0.70, 0.82, 1.0), led);
}
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return v;
}
vec3 bendW(vec3 w, float mask) {
  float d = max(-w.z, 0.0);
  w.x += uBend * d * d;
  w.y += uHill * d * d;
  float dd = max(-w.z - uDivD, 0.0);
  w.x += mask * uDiv * dd * dd;
  return w;
}
// low-beam headlights, evaluated at a world point (pre-bend)
float headlight(vec3 w) {
  float d = -w.z;
  if (d < 0.3) return 0.0;
  float lx = w.x - uCamX + uYaw * d;
  float wdt = 0.7 + d * 0.17;
  float asym = lx < 0.0 ? 1.0 : 0.7;
  float along = smoothstep(1.5, 8.0, d) * exp(-d / 24.0);
  float cut = 1.0 - smoothstep(0.9 - d * 0.004, 1.5, w.y);
  return uHead * along * exp(-lx * lx / (wdt * wdt)) * asym * cut * 2.0;
}
// streetlamp light arriving at a surface point
vec3 lampLight(vec3 w, vec3 n, float s) {
  vec3 acc = vec3(0.0);
  float k = floor(s / LAMP_D) * LAMP_D;
  for (int i = -1; i <= 1; i++) {
    float sl = k + float(i) * LAMP_D;
    float sll = mod(sl, LOOP);
    float on = 1.0 - inTun(sll);
    float zl = w.z - (sl - s);
    vec3 c = lampCol(sll) * on;
    vec3 d1 = vec3(2.35, 9.6, zl) - w;
    vec3 d2 = vec3(7.65, 9.6, zl) - w;
    float r1 = dot(d1, d1);
    float r2 = dot(d2, d2);
    float n1 = max(dot(n, d1 * inversesqrt(r1)), 0.0);
    float n2 = max(dot(n, d2 * inversesqrt(r2)), 0.0);
    acc += c * (n1 * 9.6 / (r1 * sqrt(r1)) + n2 * 9.6 / (r2 * sqrt(r2))) * 46.0;
  }
  return acc;
}
vec3 tunnelLight(float s, float y) {
  float t = inTun(s);
  if (t < 0.001) return vec3(0.0);
  float ph = 0.5 + 0.5 * cos(6.2831 * s / 7.0);
  return t * vec3(1.0, 0.42, 0.10) * (0.32 + 0.45 * pow(ph, 6.0)) * (0.7 + 0.3 * smoothstep(0.0, 5.0, y));
}
vec3 fogIt(vec3 col, float d) {
  float f = exp(-max(d, 0.0) * uFogDen);
  return mix(uFogCol, col, f);
}
`;

export const SOLID_VS = /* glsl */ `
${COMMON}
uniform float uMask;
varying vec3 vW;
varying vec3 vN;
varying vec2 vUv;
varying vec3 vTint;
void main() {
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
  m = m * instanceMatrix;
  #endif
  vec4 w = m * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(m) * normal);
  vUv = uv;
  vTint = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
  vTint = instanceColor;
  #endif
  w.xyz = bendW(w.xyz, uMask);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
