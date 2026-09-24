import * as T from 'three';

/*
 * The lens. The tank is drawn in linear HDR, then photographed: the back of
 * the tank falls out of focus behind the fish (a single-pass bokeh gather at
 * half size), bright caustics and scales bloom through the water, and the
 * frame is tone mapped, graded a little towards teal in the shadows,
 * vignetted and dithered so the deep gradients don't band.
 */

const tri = () => {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  g.setAttribute('uv', new T.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  return g;
};

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// a stray highlight can still overflow half floats; keep it from spreading
const safe = /* glsl */ `
vec3 safe(vec3 c) {
  return (any(isnan(c)) || any(isinf(c))) ? vec3(0.0) : min(c, vec3(64.0));
}
`;

const pass = (fragmentShader: string, uniforms: Record<string, T.IUniform>, extra: Partial<T.ShaderMaterialParameters> = {}) =>
  new T.ShaderMaterial({ vertexShader: vert, fragmentShader, uniforms, depthTest: false, depthWrite: false, ...extra });

// bright parts only, with a soft knee, from a 13-tap filtered read
const prefilter = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
${safe}
vec3 s(vec2 o) { return safe(texture2D(tSrc, vUv + o * uTexel).rgb); }
void main() {
  vec3 c = s(vec2(0.0)) * 0.125;
  c += (s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0))) * 0.125;
  c += (s(vec2(-2.0, 0.0)) + s(vec2(2.0, 0.0)) + s(vec2(0.0, -2.0)) + s(vec2(0.0, 2.0))) * 0.0625;
  c += (s(vec2(-2.0, -2.0)) + s(vec2(2.0, -2.0)) + s(vec2(-2.0, 2.0)) + s(vec2(2.0, 2.0))) * 0.03125;
  c = min(c, vec3(24.0));
  float br = max(c.r, max(c.g, c.b));
  float knee = uThreshold * 0.6;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  c *= max(soft, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(c, 1.0);
}`;

const down = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 c = s(vec2(0.0)) * 0.125;
  c += (s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0))) * 0.125;
  c += (s(vec2(-2.0, 0.0)) + s(vec2(2.0, 0.0)) + s(vec2(0.0, -2.0)) + s(vec2(0.0, 2.0))) * 0.0625;
  c += (s(vec2(-2.0, -2.0)) + s(vec2(2.0, -2.0)) + s(vec2(-2.0, 2.0)) + s(vec2(2.0, 2.0))) * 0.03125;
  gl_FragColor = vec4(c, 1.0);
}`;

const up = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tAdd;
uniform vec2 uTexel;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 c = s(vec2(0.0)) * 4.0;
  c += (s(vec2(-1.0, 0.0)) + s(vec2(1.0, 0.0)) + s(vec2(0.0, -1.0)) + s(vec2(0.0, 1.0))) * 2.0;
  c += s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0));
  gl_FragColor = vec4(c / 16.0 + texture2D(tAdd, vUv).rgb, 1.0);
}`;

const depthGlsl = /* glsl */ `
#include <packing>
uniform sampler2D tDepth;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uFarRange;
uniform float uMaxBlur;
float distAt(vec2 uv) {
  return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
}
// blur radius in half-size pixels: sharp around the focus, opening up behind
// it; in front only a trace, so a fish that comes to the glass stays crisp
float blurAt(float d) {
  float behind = smoothstep(uFocus * 1.08, uFocus + uFarRange, d);
  float front = smoothstep(uFocus * 0.7, uFocus * 0.45, d) * 0.3;
  return max(behind, front) * uMaxBlur;
}
`;

// Dennis Gustafsson's single-pass bokeh: a golden-angle spiral whose samples
// only count if their own blur reaches the centre
const dof = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uStep;
varying vec2 vUv;
${depthGlsl}
${safe}
void main() {
  float cd = distAt(vUv);
  float cs = blurAt(cd);
  vec3 col = safe(texture2D(tSrc, vUv).rgb);
  float tot = 1.0;
  float r = uStep;
  float ang = 0.0;
  for (int i = 0; i < 64; i++) {
    if (r >= uMaxBlur) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * r;
    vec3 sc = safe(texture2D(tSrc, tc).rgb);
    float sd = distAt(tc);
    float ss = blurAt(sd);
    if (sd > cd) ss = clamp(ss, 0.0, cs * 2.0);
    float m = smoothstep(r - 0.5, r + 0.5, ss);
    col += mix(col / tot, sc, m);
    tot += 1.0;
    r += uStep / r;
    ang += 2.39996323;
  }
  gl_FragColor = vec4(col / tot, 1.0);
}`;

const composite = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tBloom;
uniform sampler2D tDof;
uniform float uBloom;
uniform float uDofOn;
uniform float uAspect;
uniform float uTime;
varying vec2 vUv;
${depthGlsl}
${safe}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
void main() {
  // a touch of lateral colour from the lens towards the corners
  vec2 fromC = vUv - 0.5;
  vec2 ca = fromC * dot(fromC, fromC) * 0.006;
  vec3 col = safe(vec3(
    texture2D(tSrc, vUv + ca).r,
    texture2D(tSrc, vUv).g,
    texture2D(tSrc, vUv - ca).b));
  if (uDofOn > 0.5) {
    float b = blurAt(distAt(vUv)) / uMaxBlur;
    col = mix(col, texture2D(tDof, vUv).rgb, smoothstep(0.04, 0.35, b));
  }
  col += texture2D(tBloom, vUv).rgb * uBloom;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  vec3 c = gl_FragColor.rgb;
  // grade: shadows lean teal, highlights stay clean; a little more colour
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += vec3(-0.004, 0.01, 0.014) * (1.0 - smoothstep(0.0, 0.35, l));
  c = mix(vec3(l), c, 1.08);
  // vignette, as the tank's frame and the lens darken the edges
  vec2 q = fromC * vec2(uAspect, 1.0);
  c *= mix(1.0, 0.62, smoothstep(0.3, 1.05, length(q) / max(1.0, uAspect * 0.62)));
  gl_FragColor = vec4(max(c, 0.0), 1.0);
  #include <colorspace_fragment>
  gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
}`;

export type PostOptions = { bloom: number; dof: boolean; samples: number };

export function createPost(renderer: T.WebGLRenderer, opts: PostOptions) {
  const hdr = { type: T.HalfFloatType, depthBuffer: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter };
  const depth = new T.DepthTexture(1, 1, T.UnsignedIntType);
  const main = new T.WebGLRenderTarget(1, 1, {
    type: T.HalfFloatType,
    samples: opts.samples,
    depthTexture: depth,
    minFilter: T.LinearFilter,
    magFilter: T.LinearFilter,
  });
  const LEVELS = 5;
  const downs = Array.from({ length: LEVELS }, () => new T.WebGLRenderTarget(1, 1, hdr));
  const ups = Array.from({ length: LEVELS - 1 }, () => new T.WebGLRenderTarget(1, 1, hdr));
  const dofRT = new T.WebGLRenderTarget(1, 1, hdr);

  const focus = {
    uNear: { value: 1 },
    uFar: { value: 400 },
    uFocus: { value: 82 },
    uFarRange: { value: 60 },
    uMaxBlur: { value: 6 },
    tDepth: { value: depth },
  };
  const mPre = pass(prefilter, { tSrc: { value: main.texture }, uTexel: { value: new T.Vector2() }, uThreshold: { value: 1.1 } });
  const mDown = pass(down, { tSrc: { value: null }, uTexel: { value: new T.Vector2() } });
  const mUp = pass(up, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new T.Vector2() } });
  const mDof = pass(dof, { tSrc: { value: main.texture }, uTexel: { value: new T.Vector2() }, uStep: { value: 0.75 }, ...focus });
  const mOut = pass(composite, {
    tSrc: { value: main.texture },
    tBloom: { value: ups[0].texture },
    tDof: { value: dofRT.texture },
    uBloom: { value: opts.bloom },
    uDofOn: { value: opts.dof ? 1 : 0 },
    uAspect: { value: 1 },
    uTime: { value: 0 },
    ...focus,
  });

  const quad = new T.Mesh(tri(), mPre);
  quad.frustumCulled = false;
  const pscene = new T.Scene().add(quad);
  const pcam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const draw = (mat: T.ShaderMaterial, target: T.WebGLRenderTarget | null) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(pscene, pcam);
  };

  const size = new T.Vector2();
  return {
    focus: focus.uFocus,
    opts,
    setSize() {
      renderer.getDrawingBufferSize(size);
      const w = Math.max(1, size.x);
      const h = Math.max(1, size.y);
      main.setSize(w, h);
      depth.image.width = w;
      depth.image.height = h;
      let bw = Math.ceil(w / 2);
      let bh = Math.ceil(h / 2);
      for (let i = 0; i < LEVELS; i++) {
        downs[i].setSize(bw, bh);
        if (i < LEVELS - 1) ups[i].setSize(bw, bh);
        bw = Math.max(1, Math.ceil(bw / 2));
        bh = Math.max(1, Math.ceil(bh / 2));
      }
      dofRT.setSize(Math.ceil(w / 2), Math.ceil(h / 2));
      mOut.uniforms.uAspect.value = w / h;
    },
    render(scene: T.Scene, camera: T.PerspectiveCamera, time: number) {
      focus.uNear.value = camera.near;
      focus.uFar.value = camera.far;
      const autoClear = renderer.autoClear;
      renderer.autoClear = true;
      renderer.setRenderTarget(main);
      renderer.render(scene, camera);

      mPre.uniforms.uTexel.value.set(1 / main.width, 1 / main.height);
      draw(mPre, downs[0]);
      for (let i = 1; i < LEVELS; i++) {
        mDown.uniforms.tSrc.value = downs[i - 1].texture;
        mDown.uniforms.uTexel.value.set(1 / downs[i - 1].width, 1 / downs[i - 1].height);
        draw(mDown, downs[i]);
      }
      for (let i = LEVELS - 2; i >= 0; i--) {
        const src = i === LEVELS - 2 ? downs[LEVELS - 1] : ups[i + 1];
        mUp.uniforms.tSrc.value = src.texture;
        mUp.uniforms.tAdd.value = downs[i].texture;
        mUp.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        draw(mUp, ups[i]);
      }
      mOut.uniforms.uDofOn.value = opts.dof ? 1 : 0;
      if (opts.dof) {
        mDof.uniforms.uTexel.value.set(2 / main.width, 2 / main.height);
        draw(mDof, dofRT);
      }
      mOut.uniforms.uTime.value = time % 97;
      draw(mOut, null);
      renderer.autoClear = autoClear;
    },
    dispose() {
      [main, dofRT, ...downs, ...ups].forEach((t) => t.dispose());
      [mPre, mDown, mUp, mDof, mOut].forEach((m) => m.dispose());
      quad.geometry.dispose();
    },
  };
}
