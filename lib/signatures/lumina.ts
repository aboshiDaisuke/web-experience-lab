import * as THREE from 'three';
import type { Signature } from './types';

/*
 * LUMINA HAIR — silk hair.
 * The portrait is redrawn through a small GPU fluid (stable fluids: splat,
 * advection, pressure projection). A displacement map is advected by that
 * flow and relaxes back to rest, so a stroke of the pointer combs the hair
 * like silk and it slowly falls back into place. The face is masked out so
 * only hair and air move. Idle: a barely-there breeze.
 */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMMON = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uTexel;
`;

// hair likelihood in image space (top-down uv of fashion.jpg)
const MASK = /* glsl */ `
uniform vec4 uMap; // image uv = boxTopDown * uMap.xy + uMap.zw
float ell(vec2 p, vec2 c, vec2 r) { vec2 d = (p - c) / r; return length(d); }
float hairMask(vec2 boxUv) {
  vec2 p = vec2(boxUv.x, 1.0 - boxUv.y) * uMap.xy + uMap.zw;
  float hair = 1.0 - smoothstep(0.75, 1.25, ell(p, vec2(0.49, 0.41), vec2(0.32, 0.27)));
  float face = 1.0 - smoothstep(0.92, 1.32, ell(p, vec2(0.465, 0.343), vec2(0.112, 0.118)));
  float hand = 1.0 - smoothstep(0.7, 1.3, ell(p, vec2(0.76, 0.35), vec2(0.055, 0.06)));
  // roots stay put, the lengths move: weight by distance below the crown
  hair *= mix(0.12, 1.0, smoothstep(0.2, 0.47, p.y));
  float m = max(hair, 0.06);
  m *= 1.0 - face * 0.97;
  m *= 1.0 - hand * 0.6;
  return m;
}
`;

const NOISE = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

// velocity is stored in sim texels / second
const FORCE = /* glsl */ `${COMMON}${MASK}${NOISE}
uniform sampler2D uVel;
uniform vec2 uPoint;     // sim uv
uniform vec2 uForce;     // texels / s
uniform float uRadius;   // in sim uv (x-normalised)
uniform float uAspect;   // sim w / h
uniform float uTime;
uniform float uDt;
uniform float uBreeze;
void main() {
  vec2 v = texture2D(uVel, vUv).xy;
  vec2 d = vUv - uPoint;
  d.x *= uAspect;
  float g = exp(-dot(d, d) / (uRadius * uRadius));
  v += uForce * g;
  // breeze: slow, large, drifting gusts, mostly toward the lower hair
  vec2 q = vUv * vec2(uAspect, 1.0) * 1.6;
  float n1 = noise(q + vec2(uTime * 0.11, uTime * 0.03));
  float n2 = noise(q * 1.7 + vec2(4.1, uTime * 0.09));
  vec2 gust = vec2(n1 - 0.5 + 0.18 * sin(uTime * 0.23), (n2 - 0.5) * 0.7 - 0.08);
  float lower = 0.35 + 0.65 * (1.0 - vUv.y);
  v += gust * uBreeze * uDt * hairMask(vUv) * lower;
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`;

const ADVECT = /* glsl */ `${COMMON}
uniform sampler2D uVel;
uniform sampler2D uSrc;
uniform float uDt;
uniform float uDecay;
void main() {
  vec2 v = texture2D(uVel, vUv).xy;
  vec2 back = vUv - v * uTexel * uDt;
  gl_FragColor = vec4(texture2D(uSrc, back).xy * uDecay, 0.0, 1.0);
}
`;

const DIVERGENCE = /* glsl */ `${COMMON}
uniform sampler2D uVel;
void main() {
  float l = texture2D(uVel, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(uVel, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(uVel, vUv - vec2(0.0, uTexel.y)).y;
  float t = texture2D(uVel, vUv + vec2(0.0, uTexel.y)).y;
  gl_FragColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}
`;

const PRESSURE = /* glsl */ `${COMMON}
uniform sampler2D uPressure;
uniform sampler2D uDiv;
void main() {
  float l = texture2D(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float d = texture2D(uDiv, vUv).x;
  gl_FragColor = vec4((l + r + b + t - d) * 0.25, 0.0, 0.0, 1.0);
}
`;

const GRADIENT = /* glsl */ `${COMMON}
uniform sampler2D uPressure;
uniform sampler2D uVel;
void main() {
  float l = texture2D(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 v = texture2D(uVel, vUv).xy - 0.5 * vec2(r - l, t - b);
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`;

// displacement (backward map offset, sim uv): D'(x) = D(x - v dt) - v dt, then relax
const DISPLACE = /* glsl */ `${COMMON}
uniform sampler2D uVel;
uniform sampler2D uDisp;
uniform float uDt;
uniform float uRelax;
uniform float uMax;
void main() {
  vec2 step = texture2D(uVel, vUv).xy * uTexel * uDt;
  vec2 d = texture2D(uDisp, vUv - step).xy - step;
  d *= uRelax;
  float len = length(d);
  if (len > uMax) d *= uMax / len;
  gl_FragColor = vec4(d, 0.0, 1.0);
}
`;

const DISPLAY = /* glsl */ `${COMMON}${MASK}
uniform sampler2D uImg;
uniform sampler2D uDisp;
void main() {
  float m = hairMask(vUv);
  // a soft 3x3 read of the displacement keeps every fold rounded
  vec2 d = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      float w = (i == 0 && j == 0) ? 4.0 : (i == 0 || j == 0) ? 2.0 : 1.0;
      d += texture2D(uDisp, vUv + vec2(float(i), float(j)) * uTexel * 1.6).xy * w;
    }
  }
  d = d / 16.0 * m;
  // never drag the face into the hair
  d *= mix(0.2, 1.0, smoothstep(0.08, 0.5, hairMask(vUv + d)));
  vec2 src = vUv + d;
  vec2 iuv = vec2(src.x, 1.0 - src.y) * uMap.xy + uMap.zw;
  vec3 c = texture2D(uImg, iuv).rgb;
  // the page's own grade: saturate(0.5)
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 0.5);
  // silk: a soft sheen travels with the moving strands
  float moving = smoothstep(0.004, 0.05, length(d));
  float shine = smoothstep(0.35, 0.8, l);
  c += vec3(1.0, 0.95, 0.88) * moving * shine * 0.07;
  gl_FragColor = vec4(c, 1.0);
}
`;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Stroke = { t0: number; dur: number; path: (k: number) => [number, number] };

const mount: Signature = (ctx) => {
  const { reduced, narrow, fine, embedded } = ctx;
  if (reduced) return;
  const photo = ctx.cover.querySelector<HTMLElement>('.lumina-photo');
  const img = photo?.querySelector('img');
  if (!photo || !img) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'lumina-silk-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  let renderer: THREE.WebGLRenderer;
  try {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      powerPreference: 'high-performance',
    });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return;
    renderer = new THREE.WebGLRenderer({ canvas, context: gl });
  } catch {
    return;
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = false;
  const dpr = Math.min(window.devicePixelRatio || 1, embedded ? 1 : narrow ? 1.5 : 2);
  renderer.setPixelRatio(dpr);

  // ---------- sim targets ----------
  const SIM = narrow ? 112 : 144;
  let simW = SIM;
  let simH = SIM;
  const rtOpts: THREE.RenderTargetOptions = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  };
  const makeRT = () => new THREE.WebGLRenderTarget(simW, simH, rtOpts);
  const pair = () => {
    let a = makeRT();
    let b = makeRT();
    return {
      get read() {
        return a;
      },
      get write() {
        return b;
      },
      swap() {
        const t = a;
        a = b;
        b = t;
      },
      setSize(w: number, h: number) {
        a.setSize(w, h);
        b.setSize(w, h);
      },
      dispose() {
        a.dispose();
        b.dispose();
      },
    };
  };
  const vel = pair();
  const disp = pair();
  const pres = pair();
  const divRT = makeRT();

  const texel = new THREE.Vector2(1 / simW, 1 / simH);
  const map = new THREE.Vector4(1, 1, 0, 0);
  const mat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader,
      uniforms: { uTexel: { value: texel }, uMap: { value: map }, ...uniforms },
      depthTest: false,
      depthWrite: false,
    });
  const forceMat = mat(FORCE, {
    uVel: { value: null },
    uPoint: { value: new THREE.Vector2(-9, -9) },
    uForce: { value: new THREE.Vector2() },
    uRadius: { value: 0.1 },
    uAspect: { value: 1 },
    uTime: { value: 0 },
    uDt: { value: 0.016 },
    uBreeze: { value: 0 },
  });
  const advectMat = mat(ADVECT, {
    uVel: { value: null },
    uSrc: { value: null },
    uDt: { value: 0.016 },
    uDecay: { value: 1 },
  });
  const divMat = mat(DIVERGENCE, { uVel: { value: null } });
  const presMat = mat(PRESSURE, { uPressure: { value: null }, uDiv: { value: null } });
  const gradMat = mat(GRADIENT, { uPressure: { value: null }, uVel: { value: null } });
  const dispMat = mat(DISPLACE, {
    uVel: { value: null },
    uDisp: { value: null },
    uDt: { value: 0.016 },
    uRelax: { value: 1 },
    uMax: { value: 0.05 },
  });
  const displayMat = mat(DISPLAY, {
    uImg: { value: null },
    uDisp: { value: null },
  });
  const materials = [forceMat, advectMat, divMat, presMat, gradMat, dispMat, displayMat];

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(geometry, displayMat);
  scene.add(quad);
  const pass = (m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
    quad.material = m;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  };
  const clearTargets = () => {
    renderer.setClearColor(0x000000, 1);
    for (const p of [vel, disp, pres]) {
      renderer.setRenderTarget(p.read);
      renderer.clear();
      renderer.setRenderTarget(p.write);
      renderer.clear();
    }
    renderer.setRenderTarget(divRT);
    renderer.clear();
    renderer.setRenderTarget(null);
  };

  let texture: THREE.Texture | null = null;
  let disposed = false;
  let ready = false;
  let running = false;
  let inView = true;
  let raf = 0;
  const box = { w: 1, h: 1 };

  photo.appendChild(canvas);

  const measure = () => {
    const r = photo.getBoundingClientRect();
    box.w = Math.max(1, r.width);
    box.h = Math.max(1, r.height);
    renderer.setSize(box.w, box.h, false);
    const aspect = box.w / box.h;
    const nw = aspect >= 1 ? SIM : Math.round(SIM * aspect);
    const nh = aspect >= 1 ? Math.round(SIM / aspect) : SIM;
    if (nw !== simW || nh !== simH) {
      simW = nw;
      simH = nh;
      vel.setSize(simW, simH);
      disp.setSize(simW, simH);
      pres.setSize(simW, simH);
      divRT.setSize(simW, simH);
      if (ready) clearTargets();
    }
    texel.set(1 / simW, 1 / simH);
    forceMat.uniforms.uAspect.value = simW / simH;
    // object-fit: cover; object-position: 50% 35% (34% on narrow)
    const iw = img.naturalWidth || 1600;
    const ih = img.naturalHeight || 2400;
    const s = Math.max(box.w / iw, box.h / ih);
    const dw = iw * s;
    const dh = ih * s;
    const ox = (box.w - dw) * 0.5;
    const oy = (box.h - dh) * (narrow ? 0.34 : 0.35);
    // image uv = boxTD * (box / d) + (-o / d)
    map.set(box.w / dw, box.h / dh, -ox / dw, -oy / dh);
  };

  // ---------- input ----------
  const pointer = { x: 0, y: 0, px: 0, py: 0, has: false, active: false };
  let lastInput = -1e9;
  let clock = 0;
  const toLocal = (cx: number, cy: number) => {
    const r = photo.getBoundingClientRect();
    return [(cx - r.left) / r.width, (cy - r.top) / r.height] as const;
  };
  const onMove = (e: PointerEvent) => {
    const [u, v] = toLocal(e.clientX, e.clientY);
    const inside = u > -0.05 && u < 1.05 && v > -0.05 && v < 1.05;
    if (!inside) {
      pointer.active = false;
      return;
    }
    if (!pointer.active) {
      pointer.px = u;
      pointer.py = v;
    }
    pointer.x = u;
    pointer.y = v;
    pointer.active = true;
    pointer.has = true;
    lastInput = clock;
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') pointer.active = false;
  };

  // scripted strokes: a stylist's hand combing through, on arrival and when idle on touch/embed
  const strokes: Stroke[] = [];
  // paths through the hair only, in image uv (fashion.jpg), converted to the box
  const combs: [number, number, number, number, number][] = [
    [0.67, 0.35, 0.62, 0.63, 0.06], // down the long side, bulging outward
    [0.28, 0.3, 0.25, 0.56, -0.04],
  ];
  const comb = (t0: number, which: number, dur = 1.9) => {
    const [x0, y0, x1, y1, bulge] = combs[which % combs.length];
    strokes.push({
      t0,
      dur,
      path: (k) => {
        const e = k * k * (3 - 2 * k);
        const ix = x0 + (x1 - x0) * e + Math.sin(e * Math.PI) * bulge;
        const iy = y0 + (y1 - y0) * e;
        return [(ix - map.z) / map.x, (iy - map.w) / map.y];
      },
    });
  };
  let combCount = 0;
  let nextAuto = Infinity;

  // ---------- sim step ----------
  const step = (dt: number) => {
    clock += dt;
    const t = clock;
    // gather the brush for this frame
    let fx = 0;
    let fy = 0;
    let bx = -9;
    let by = -9;
    let radius = narrow ? 0.17 : 0.14;
    if (pointer.active) {
      const dx = pointer.x - pointer.px;
      const dy = pointer.y - pointer.py;
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      if (dx !== 0 || dy !== 0) {
        bx = pointer.x;
        by = 1 - pointer.y;
        // box fraction -> sim texels, per second, softened
        fx = (dx * simW) / Math.max(dt, 1 / 120);
        fy = (-dy * simH) / Math.max(dt, 1 / 120);
      }
    }
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      const k0 = (t - dt - s.t0) / s.dur;
      const k1 = (t - s.t0) / s.dur;
      if (k1 < 0) continue;
      if (k0 > 1) {
        strokes.splice(i, 1);
        continue;
      }
      const [x0, y0] = s.path(Math.max(0, Math.min(1, k0)));
      const [x1, y1] = s.path(Math.max(0, Math.min(1, k1)));
      bx = x1;
      by = 1 - y1;
      fx = ((x1 - x0) * simW) / Math.max(dt, 1 / 120);
      fy = (-(y1 - y0) * simH) / Math.max(dt, 1 / 120);
      radius = narrow ? 0.2 : 0.17;
    }
    const gain = 0.38;
    const maxF = 520;
    const fl = Math.hypot(fx, fy);
    if (fl > maxF) {
      fx *= maxF / fl;
      fy *= maxF / fl;
    }
    const fu = forceMat.uniforms;
    fu.uVel.value = vel.read.texture;
    (fu.uPoint.value as THREE.Vector2).set(bx, by);
    (fu.uForce.value as THREE.Vector2).set(fx * gain, fy * gain);
    fu.uRadius.value = radius;
    fu.uTime.value = t;
    fu.uDt.value = dt;
    fu.uBreeze.value = 7 * smooth(0.5, 3, t);
    pass(forceMat, vel.write);
    vel.swap();

    // advect velocity through itself
    const au = advectMat.uniforms;
    au.uVel.value = vel.read.texture;
    au.uSrc.value = vel.read.texture;
    au.uDt.value = dt;
    au.uDecay.value = Math.exp(-dt * 1.35);
    pass(advectMat, vel.write);
    vel.swap();

    // projection: keep the flow incompressible so it curls like silk
    divMat.uniforms.uVel.value = vel.read.texture;
    pass(divMat, divRT);
    presMat.uniforms.uDiv.value = divRT.texture;
    for (let i = 0; i < 18; i++) {
      presMat.uniforms.uPressure.value = pres.read.texture;
      pass(presMat, pres.write);
      pres.swap();
    }
    gradMat.uniforms.uPressure.value = pres.read.texture;
    gradMat.uniforms.uVel.value = vel.read.texture;
    pass(gradMat, vel.write);
    vel.swap();

    // carry the displacement with the flow; let it fall back to rest
    const du = dispMat.uniforms;
    du.uVel.value = vel.read.texture;
    du.uDisp.value = disp.read.texture;
    du.uDt.value = dt;
    du.uRelax.value = Math.exp(-dt * 0.85);
    pass(dispMat, disp.write);
    disp.swap();

    // auto strokes when nobody is touching
    if (!fine || embedded) {
      if (t - lastInput > 1.5 && t > nextAuto) {
        comb(t, ++combCount, 2.2);
        nextAuto = t + 7.5;
      }
    }
  };

  const draw = () => {
    displayMat.uniforms.uImg.value = texture;
    displayMat.uniforms.uDisp.value = disp.read.texture;
    pass(displayMat, null);
  };

  let last = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(1 / 30, (now - last) / 1000) : 1 / 60;
    last = now;
    step(dt);
    draw();
  };
  const start = () => {
    if (running || disposed || !ready || !inView || document.hidden) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) start();
    else stop();
  });
  io.observe(photo);
  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const ro = new ResizeObserver(() => {
    measure();
    if (ready && !running) draw();
  });
  ro.observe(photo);

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    disposed = true;
    stop();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('webglcontextlost', onLost);
    vel.dispose();
    disp.dispose();
    pres.dispose();
    divRT.dispose();
    for (const m of materials) m.dispose();
    geometry.dispose();
    texture?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    photo.classList.remove('lumina-silk', 'is-silk');
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    release();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  const image = new Image();
  image.decoding = 'async';
  image.src = img.currentSrc || img.src || '/images/fashion.jpg';
  image
    .decode()
    .then(() => {
      if (disposed) return;
      texture = new THREE.Texture(image);
      texture.flipY = false;
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      measure();
      try {
        clearTargets();
        step(1 / 60);
        draw();
      } catch {
        release();
        return;
      }
      if (renderer.getContext().isContextLost()) {
        release();
        return;
      }
      ready = true;
      photo.classList.add('lumina-silk');
      requestAnimationFrame(() => {
        if (!disposed) photo.classList.add('is-silk');
      });
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onMove, { passive: true });
      window.addEventListener('pointerup', onUp, { passive: true });
      window.addEventListener('pointercancel', onUp, { passive: true });
      // the first comb, once the photo has been revealed
      comb(clock + 1.3, 0, 2.3);
      nextAuto = clock + 9;
      start();
    })
    .catch(() => release());

  return release;
};

export default mount;
