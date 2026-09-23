import * as THREE from 'three';
import type { Signature } from './types';

/*
 * NOIR TABLE — candlelight.
 * The hero goes dark; a match is struck beside the plate and the visitor's
 * pointer becomes the candle. The dish photo is re-lit per pixel in a fragment
 * shader: warm point light with inverse-square falloff, a relief normal derived
 * from luminance (the hammered plate glints as the flame passes), flicker,
 * faint steam lit only by the flame, and a vignette.
 */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;        // canvas size, css px
uniform float uDpr;
uniform vec4 uRect;       // photo rect (css px, relative to canvas)
uniform vec4 uMap;        // image uv = (p - rect.xy) * uMap.xy + uMap.zw
uniform vec4 uFeather;    // left, right, top, bottom feather (css px)
uniform vec2 uLight;      // flame position, css px
uniform float uIntensity;
uniform float uRadius;
uniform float uTime;
uniform float uFlame;     // flame size multiplier (0 = hidden)
uniform float uLean;      // flame lean (-1..1)
uniform float uStrike;    // seconds since the match strike (<0 before)
uniform vec2 uStrikePos;
uniform float uSteam;
uniform vec2 uSteamPos;
uniform vec2 uTexel;      // one css px in image uv
uniform float uAmbient;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;

  // --- light geometry -------------------------------------------------
  vec3 lp = vec3(uLight, 120.0);
  vec3 lv = lp - vec3(p, 0.0);
  float d = length(lv);
  vec3 L = lv / d;
  float dr = d / uRadius;
  float atten = uIntensity * pow(1.0 + dr * dr, -2.0);
  atten *= smoothstep(uRadius * 8.0, uRadius * 2.5, d);
  // candle colour: hotter near the flame, deep amber in the falloff
  vec3 warm = mix(vec3(1.0, 0.45, 0.16), vec3(1.0, 0.72, 0.45), exp(-dr * 1.3));

  // --- table (outside the photo) ---------------------------------------
  vec3 table = vec3(0.0072, 0.0082, 0.0068);
  vec3 tableLit = table * 0.55 + vec3(0.05, 0.042, 0.032) * warm * atten * max(L.z, 0.0) * 2.2;

  // --- photo ------------------------------------------------------------
  vec2 uv = (p - uRect.xy) * uMap.xy + uMap.zw;
  vec3 photoLit = tableLit;
  float inside = 0.0;
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
    vec3 c = texture2D(uTex, uv).rgb;
    vec3 alb = pow(c, vec3(2.2));
    float hx = luma(texture2D(uTex, uv + vec2(uTexel.x * 1.6, 0.0)).rgb) - luma(texture2D(uTex, uv - vec2(uTexel.x * 1.6, 0.0)).rgb);
    float hy = luma(texture2D(uTex, uv + vec2(0.0, uTexel.y * 1.6)).rgb) - luma(texture2D(uTex, uv - vec2(0.0, uTexel.y * 1.6)).rgb);
    float lum = luma(c);
    // relief only on the hammered ceramic; food stays soft
    float area = luma(texture2D(uTex, uv, 3.5).rgb);
    float bump = 3.0 * (1.0 - smoothstep(0.1, 0.3, lum)) * (1.0 - smoothstep(0.09, 0.2, area));
    hx = clamp(hx, -0.09, 0.09);
    hy = clamp(hy, -0.09, 0.09);
    vec3 N = normalize(vec3(-hx * bump, -hy * bump, 1.0));
    float diff = max(dot(N, L), 0.0);
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float gloss = 0.3 + 0.7 * (1.0 - smoothstep(0.05, 0.35, lum));
    float spec = pow(max(dot(N, H), 0.0), 38.0) * gloss;
    photoLit = alb * 0.007 * uAmbient
      + alb * warm * diff * atten * 5.5
      + warm * spec * atten * 1.1;

    vec2 q = p - uRect.xy;
    float f = smoothstep(0.0, uFeather.x, q.x)
      * smoothstep(0.0, uFeather.y, uRect.z - q.x)
      * smoothstep(0.0, uFeather.z, q.y)
      * smoothstep(0.0, uFeather.w, uRect.w - q.y);
    inside = f;
  }
  vec3 col = mix(tableLit, photoLit, inside);

  // --- steam: faint wisps, visible only where the flame reaches ---------
  if (uSteam > 0.001) {
    vec2 s = p - uSteamPos;
    if (s.y < 30.0 && s.y > -330.0 && abs(s.x) < 220.0) {
      float yy = -s.y;
      float dens = 0.0;
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float wob = (fbm(vec2(yy * 0.007 - uTime * 0.32 + fk * 7.1, fk * 3.3 + uTime * 0.04)) - 0.5) * (40.0 + yy * 0.55);
        float xx = s.x - (fk - 1.0) * 34.0 - wob;
        float width = 3.5 + yy * 0.045;
        float fil = exp(-xx * xx / (width * width));
        float breakup = smoothstep(0.38, 0.72, fbm(vec2(xx * 0.03 + fk * 5.0, yy * 0.014 - uTime * 0.55)));
        dens += fil * breakup;
      }
      dens *= smoothstep(0.0, 40.0, yy) * (1.0 - smoothstep(110.0, 320.0, yy));
      col += dens * uSteam * (0.004 + atten * 0.28) * mix(vec3(0.95, 0.9, 0.85), warm, 0.45);
    }
  }

  // --- the match strike: sparks ------------------------------------------
  if (uStrike > 0.0 && uStrike < 1.2) {
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      float a = hash(vec2(fi, 3.7)) * 6.2831;
      float sp = 90.0 + hash(vec2(fi, 9.1)) * 260.0;
      float life = 0.35 + hash(vec2(fi, 1.3)) * 0.55;
      float t = uStrike;
      if (t < life) {
        vec2 v = vec2(cos(a) * 1.3, sin(a) - 0.6) * sp;
        vec2 sp0 = uStrikePos + v * t + vec2(0.0, 420.0) * t * t;
        float k = 1.0 - t / life;
        float g = exp(-dot(p - sp0, p - sp0) / 3.2) * 2.5 + exp(-length(p - sp0) / 5.0) * 0.25;
        col += vec3(1.0, 0.62, 0.25) * g * k * k;
      }
    }
    float flash = exp(-uStrike * 9.0);
    col += vec3(1.0, 0.8, 0.6) * flash * 0.9 * exp(-length(p - uStrikePos) / 70.0);
  }

  // --- the flame itself --------------------------------------------------
  if (uFlame > 0.001) {
    // h: height above the wick (up is positive), x: across
    float h = (uLight.y - p.y) / uFlame + 5.0;
    float x = (p.x - uLight.x) / uFlame;
    x -= uLean * 0.022 * max(h, 0.0) * max(h, 0.0);
    x += (noise(vec2(uTime * 8.0, h * 0.12)) - 0.5) * 0.09 * max(h, 0.0);
    float ww = 5.4 * pow(smoothstep(-8.0, 8.0, h), 0.75) * pow(1.0 - smoothstep(6.0, 31.0, h), 0.85);
    ww = max(ww, 0.2);
    float body = exp(-pow(x / ww, 2.0) * 1.5) * smoothstep(-7.5, -4.5, h) * smoothstep(33.0, 22.0, h);
    float rc = length(vec2(x / (ww * 0.6), (h - 4.0) / 9.0));
    float core = exp(-rc * rc * 1.6);
    float blueBase = exp(-(x * x) / 7.0 - pow((h + 4.0) / 2.2, 2.0));
    float tipOrange = smoothstep(8.0, 24.0, h);
    vec3 flame = mix(vec3(1.0, 0.78, 0.42), vec3(1.0, 0.45, 0.14), tipOrange) * body * 1.7
      + vec3(1.0, 0.94, 0.82) * core * 1.7
      + vec3(0.22, 0.3, 0.8) * blueBase * 0.5;
    float fd = length(p - uLight + vec2(0.0, 6.0 * uFlame));
    float halo = exp(-fd / (46.0 * uFlame)) * 0.09 + exp(-fd / (12.0 * uFlame)) * 0.16;
    col += flame * min(uIntensity, 1.15) + vec3(1.0, 0.55, 0.22) * halo * uIntensity;
  }

  // --- vignette, tone --------------------------------------------------
  vec2 vq = p / uRes - 0.5;
  col *= 1.0 - dot(vq, vq) * 0.9;
  col = col / (1.0 + col * 0.35);               // soft shoulder
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  col += (hash(p + fract(uTime)) - 0.5) / 255.0; // dither the deep blacks
  gl_FragColor = vec4(col, 1.0);
}
`;

function vnoise(t: number, seed: number) {
  const i = Math.floor(t);
  const f = t - i;
  const h = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const mount: Signature = (ctx) => {
  const { cover, reduced, narrow, fine, embedded } = ctx;
  const photo = cover.querySelector<HTMLElement>('.noir-photo');
  const img = photo?.querySelector('img');
  if (!photo || !img) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'noir-candle-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  let renderer: THREE.WebGLRenderer;
  try {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return;
    renderer = new THREE.WebGLRenderer({ canvas, context: gl });
  } catch {
    return;
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const dpr = Math.min(
    window.devicePixelRatio || 1,
    embedded ? 1 : narrow ? 1.5 : 1.75,
  );
  renderer.setPixelRatio(dpr);

  const uniforms = {
    uTex: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uDpr: { value: dpr },
    uRect: { value: new THREE.Vector4() },
    uMap: { value: new THREE.Vector4() },
    uFeather: { value: new THREE.Vector4() },
    uLight: { value: new THREE.Vector2() },
    uIntensity: { value: 0 },
    uRadius: { value: 190 },
    uTime: { value: 0 },
    uFlame: { value: 0 },
    uLean: { value: 0 },
    uStrike: { value: -1 },
    uStrikePos: { value: new THREE.Vector2() },
    uSteam: { value: 0 },
    uSteamPos: { value: new THREE.Vector2() },
    uTexel: { value: new THREE.Vector2() },
    uAmbient: { value: 0.3 },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(geometry, material));

  let texture: THREE.Texture | null = null;
  let disposed = false;
  let raf = 0;
  let running = false;
  let inView = true;
  let ready = false;

  cover.appendChild(canvas);

  // ---------- layout ----------
  const layout = {
    w: 1,
    h: 1,
    rest: { x: 0, y: 0 },
    center: { x: 0, y: 0 },
    rx: 1,
    ry: 1,
  };
  const measure = () => {
    const cr = cover.getBoundingClientRect();
    const pr = photo.getBoundingClientRect();
    const w = Math.max(1, cr.width);
    const h = Math.max(1, cr.height);
    layout.w = w;
    layout.h = h;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
    const rx = pr.left - cr.left;
    const ry = pr.top - cr.top;
    const rw = Math.max(1, pr.width);
    const rh = Math.max(1, pr.height);
    uniforms.uRect.value.set(rx, ry, rw, rh);
    const iw = img.naturalWidth || 1600;
    const ih = img.naturalHeight || 2400;
    const s = Math.max(rw / iw, rh / ih) * 1.02;
    const dw = iw * s;
    const dh = ih * s;
    const posY = narrow ? 0.57 : 0.6;
    const ox = (rw - dw) * 0.5;
    const oy = (rh - dh) * posY;
    uniforms.uMap.value.set(1 / dw, 1 / dh, -ox / dw, -oy / dh);
    uniforms.uTexel.value.set(1 / dw, 1 / dh);
    if (narrow) uniforms.uFeather.value.set(rw * 0.2, 2, rh * 0.15, 2);
    else uniforms.uFeather.value.set(rw * 0.3, rw * 0.14, 30, 30);
    // the plate's centre in the image is ~ (0.5, 0.49)
    const cx = rx + ox + dw * 0.5;
    const cy = ry + oy + dh * 0.49;
    layout.center = { x: cx, y: cy };
    const plateR = dw * 0.47;
    layout.rx = Math.min(plateR * 0.62, rw * 0.36);
    layout.ry = Math.min(plateR * 0.5, rh * 0.3);
    layout.rest = narrow
      ? { x: cx - rw * 0.2, y: cy - rh * 0.16 }
      : { x: cx - plateR * 0.62, y: cy - plateR * 0.28 };
    uniforms.uSteamPos.value.set(cx - dw * 0.02, cy - dh * 0.02);
    uniforms.uRadius.value = narrow ? 130 : Math.min(200, Math.max(150, rw * 0.24));
  };

  // ---------- pointer ----------
  const light = { x: 0, y: 0, tx: 0, ty: 0, lean: 0, px: 0 };
  let pointerInside = false;
  let lastPointer = -1e9;
  let clock = 0;
  const onPointer = (e: PointerEvent) => {
    const r = cover.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
    pointerInside = inside;
    if (!inside) return;
    light.tx = x;
    light.ty = y;
    lastPointer = clock;
  };
  const onLeave = () => {
    pointerInside = false;
  };

  // ---------- timeline ----------
  let strikeAt = Infinity; // clock time of the strike
  const tick = (dt: number) => {
    clock += dt;
    const sT = clock - strikeAt;
    // where the flame wants to be
    const idleFor = clock - lastPointer;
    const following =
      sT > 1.25 && (fine ? pointerInside && idleFor < 6 : idleFor < 4);
    if (!following) {
      if (sT < 3.5 || reduced) {
        light.tx = layout.rest.x;
        light.ty = layout.rest.y;
      } else {
        // an unattended candle carried slowly around the plate
        const a = (sT - 3.5) * 0.16 + Math.PI * 1.08;
        light.tx = layout.center.x + Math.cos(a) * layout.rx;
        light.ty = layout.center.y + Math.sin(a) * layout.ry;
        if (!fine && sT < 7) {
          const k = smooth(3.5, 7, sT);
          light.tx = layout.rest.x + (light.tx - layout.rest.x) * k;
          light.ty = layout.rest.y + (light.ty - layout.rest.y) * k;
        }
      }
    }
    const follow = following ? 1 - Math.exp(-dt * 7.5) : 1 - Math.exp(-dt * 1.6);
    const prevX = light.x;
    light.x += (light.tx - light.x) * follow;
    light.y += (light.ty - light.y) * follow;
    const vx = dt > 0 ? (light.x - prevX) / dt : 0;
    const targetLean = Math.max(-1, Math.min(1, -vx / 520));
    light.lean += (targetLean - light.lean) * (1 - Math.exp(-dt * 5));

    // flicker: slow breathing + quick shiver + the occasional draught
    const t = clock;
    let flick =
      0.86 +
      (vnoise(t * 1.3, 1) - 0.5) * 0.12 +
      (vnoise(t * 7.1, 2) - 0.5) * 0.09 +
      (vnoise(t * 17.3, 3) - 0.5) * 0.05;
    const draught = Math.pow(vnoise(t * 0.35, 4), 6);
    flick -= draught * 0.18 * vnoise(t * 11, 5);
    const jx = (vnoise(t * 5.3, 6) - 0.5) * 2.2;
    const jy = (vnoise(t * 4.7, 7) - 0.5) * 1.6;

    let intensity = 0;
    let flame = 0;
    let steam = 0;
    if (reduced) {
      intensity = 0.95;
      steam = 0.7;
    } else if (sT >= 0) {
      const ignite = smooth(0.06, 1.5, sT);
      const unsteady = 1 + (1 - smooth(0.2, 2.2, sT)) * (vnoise(t * 13, 8) - 0.5) * 0.7;
      intensity = ignite * flick * unsteady + 0.55 * Math.exp(-sT * 10);
      flame =
        sT < 0.07
          ? 0
          : smooth(0.07, 0.32, sT) * (1 + 0.55 * Math.exp(-(sT - 0.32) * 2.6)) * (0.92 + flick * 0.1);
      steam = smooth(1.2, 4, sT);
    }
    uniforms.uAmbient.value = reduced ? 1 : 0.25 + 0.75 * smooth(0.3, 2.5, sT);
    uniforms.uTime.value = t;
    uniforms.uIntensity.value = intensity;
    uniforms.uFlame.value = flame;
    uniforms.uLean.value = light.lean;
    uniforms.uStrike.value = sT;
    uniforms.uStrikePos.value.set(layout.rest.x, layout.rest.y);
    uniforms.uSteam.value = steam;
    uniforms.uLight.value.set(light.x + (reduced ? 0 : jx), light.y + (reduced ? 0 : jy));
  };

  const render = () => renderer.render(scene, camera);

  let last = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(0.25, (now - last) / 1000) : 0.016;
    last = now;
    tick(dt);
    render();
  };
  const start = () => {
    if (running || disposed || !ready || reduced) return;
    if (!inView || document.hidden) return;
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
  io.observe(cover);
  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const ro = new ResizeObserver(() => {
    measure();
    if (!running && ready) {
      tick(0);
      render();
    }
  });
  ro.observe(cover);
  ro.observe(photo);

  // ---------- teardown / failure ----------
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    disposed = true;
    stop();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('pointerdown', onPointer);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('webglcontextlost', onLost);
    geometry.dispose();
    material.dispose();
    texture?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    cover.classList.remove('noir-candle', 'is-lit');
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    release();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  // ---------- go ----------
  const image = new Image();
  image.decoding = 'async';
  image.src = img.currentSrc || img.src || '/images/dining.jpg';
  image
    .decode()
    .then(() => {
      if (disposed) return;
      texture = new THREE.Texture(image);
      texture.flipY = false;
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      uniforms.uTex.value = texture;
      measure();
      light.x = light.tx = layout.rest.x;
      light.y = light.ty = layout.rest.y;
      // lights out: the photo fades away, then the match is struck
      strikeAt = reduced ? 0 : 1.25;
      tick(0);
      try {
        render();
        renderer.compile(scene, camera);
      } catch {
        release();
        return;
      }
      const gl = renderer.getContext();
      if (gl.isContextLost()) {
        release();
        return;
      }
      ready = true;
      cover.classList.add('noir-candle');
      requestAnimationFrame(() => {
        if (!disposed) cover.classList.add('is-lit');
      });
      window.addEventListener('pointermove', onPointer, { passive: true });
      window.addEventListener('pointerdown', onPointer, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
      if (reduced) {
        clock = 10;
        tick(0);
        render();
      } else start();
    })
    .catch(() => release());

  return release;
};

export default mount;
