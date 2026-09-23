import type { Signature } from './types';

/*
 * YUI TAKAHASHI — "the page is a camera".
 *  1. The two hero prints develop from film negatives (WebGL, shadows first,
 *     uneven like a rocked developer tray).
 *  2. Over the photographs the pointer becomes a viewfinder that racks focus,
 *     meters the light under it, and takes a picture (6-blade iris, flash,
 *     synthesized shutter). Each exposure drops into a contact strip.
 *
 * Rule for clicks: on the hero a press shoots. In the gallery a click still
 * enlarges the photo; pressing and holding (half-press → full press) shoots.
 */

const HERO = '.yui-cover img';
const GALLERY = '.photo-grid img';
const PAPER = '#f4f2eb';
const MAX_FRAMES = 8;

type CoverMap = { r: DOMRect; s: number; ox: number; oy: number };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function parsePos(v: string): [number, number] {
  const parts = v.split(/\s+/);
  const f = (p?: string) =>
    p && p.endsWith('%') ? parseFloat(p) / 100 : 0.5;
  return [f(parts[0]), f(parts[1])];
}

function coverMap(img: HTMLImageElement): CoverMap {
  const r = img.getBoundingClientRect();
  const nw = img.naturalWidth || 1;
  const nh = img.naturalHeight || 1;
  const s = Math.max(r.width / nw, r.height / nh);
  const [px, py] = parsePos(getComputedStyle(img).objectPosition);
  return {
    r,
    s,
    ox: r.left + (r.width - nw * s) * px,
    oy: r.top + (r.height - nh * s) * py,
  };
}

/** draw exactly what lies under the viewport rect (fx,fy,fw,fh) of `img` */
function drawCrop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  fx: number,
  fy: number,
  fw: number,
  fh: number,
  W: number,
  H: number,
) {
  const { r, s, ox, oy } = coverMap(img);
  const x0 = Math.max(fx, r.left);
  const y0 = Math.max(fy, r.top);
  const x1 = Math.min(fx + fw, r.right);
  const y1 = Math.min(fy + fh, r.bottom);
  if (x1 <= x0 || y1 <= y0) return;
  const k = W / fw;
  const kh = H / fh;
  ctx.drawImage(
    img,
    (x0 - ox) / s,
    (y0 - oy) / s,
    (x1 - x0) / s,
    (y1 - y0) / s,
    (x0 - fx) * k,
    (y0 - fy) * kh,
    (x1 - x0) * k,
    (y1 - y0) * kh,
  );
}

function baseFilter(img: HTMLImageElement) {
  const f = getComputedStyle(img).filter;
  return f && f !== 'none' ? f.replace(/blur\([^)]*\)/g, '').trim() : '';
}

/* ------------------------------------------------------------------ */
/* 1. Develop: negative → positive                                     */
/* ------------------------------------------------------------------ */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){
  vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5);
  gl_Position = vec4(aPos, 0., 1.);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uScale;
uniform vec2 uOff;
uniform vec2 uRes;
uniform float uP;
uniform float uT;
uniform float uFade;
uniform float uSat;
uniform float uSeed;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x),
             mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= .5; }
  return v;
}
vec3 cssSaturate(vec3 c, float s){
  return vec3(
    (.213 + .787 * s) * c.r + (.715 - .715 * s) * c.g + (.072 - .072 * s) * c.b,
    (.213 - .213 * s) * c.r + (.715 + .285 * s) * c.g + (.072 - .072 * s) * c.b,
    (.213 - .213 * s) * c.r + (.715 - .715 * s) * c.g + (.072 + .928 * s) * c.b);
}
void main(){
  vec2 uv = vUv * uScale + uOff;
  vec3 pos = cssSaturate(texture2D(uTex, uv).rgb, uSat);
  float lum = dot(pos, vec3(.2126, .7152, .0722));

  // film negative: inverted densities over an orange mask
  vec3 neg = (1. - pos) * vec3(.93, .63, .40) + vec3(.06, .025, .0);
  neg = mix(vec3(.52, .33, .19), neg, .82);

  // developer sloshing across the tray
  vec2 q = vUv * vec2(uRes.x / uRes.y, 1.) * 2.3 + uSeed;
  vec2 drift = vec2(sin(uT * .55), cos(uT * .42)) * .45;
  float n = fbm(q + drift + fbm(q * 1.6 - drift * 1.3) * .9);

  // shadows first, then mid-tones, highlights last — never uniform
  float th = clamp(lum * .62 + n * .52 - .08, 0., 1.);
  float P = uP * 1.34 - .26;
  float clear = smoothstep(th - .5, th - .12, P);
  float dev = smoothstep(th - .22, th + .04, P);

  vec3 paper = vec3(.955, .94, .905);
  vec3 col = mix(neg, paper, clear * .9);
  // silver density builds: first a warm, flat image, then full tone
  vec3 latent = mix(paper, pos * vec3(1.02, .97, .9), .75);
  col = mix(col, latent, smoothstep(0., .55, dev) * (1. - dev));
  col = mix(col, pos, dev);
  // wet front — the chemistry still moving
  float front = dev * (1. - dev) * 4.;
  col -= front * .045 * vec3(.6, .8, 1.);

  float g = hash(floor(vUv * uRes) + floor(uT * 24.)) - .5;
  col += g * .075 * (1. - dev * .92);

  col = mix(paper, col, uFade);
  gl_FragColor = vec4(col, 1.);
}`;

type Developer = { stop: () => void };

function develop(
  img: HTMLImageElement,
  opts: {
    delay: number;
    duration: number;
    seed: number;
    running: () => boolean;
    onDone: () => void;
  },
): Developer | null {
  const host = img.parentElement;
  if (!host) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'yui-dev-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', {
    premultipliedAlpha: false,
    antialias: false,
  });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uScale = u('uScale');
  const uOff = u('uOff');
  const uRes = u('uRes');
  const uP = u('uP');
  const uT = u('uT');
  const uFade = u('uFade');
  gl.uniform1f(u('uSeed'), opts.seed);
  const sat = /saturate\(([\d.]+)\)/.exec(getComputedStyle(img).filter);
  gl.uniform1f(u('uSat'), sat ? parseFloat(sat[1]) : 1);
  host.appendChild(canvas);

  const layout = () => {
    const m = coverMap(img);
    const hr = host.getBoundingClientRect();
    const w = m.r.width;
    const h = m.r.height;
    const dpr = Math.min(2, devicePixelRatio || 1);
    Object.assign(canvas.style, {
      left: `${m.r.left - hr.left}px`,
      top: `${m.r.top - hr.top}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    const rw = img.naturalWidth * m.s;
    const rh = img.naturalHeight * m.s;
    gl.uniform2f(uScale, w / rw, h / rh);
    gl.uniform2f(uOff, (m.r.left - m.ox) / rw, (m.r.top - m.oy) / rh);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(img);

  let t = 0;
  let last = performance.now();
  let raf = 0;
  let done = false;
  const ease = (x: number) => 0.5 - Math.cos(Math.PI * clamp(x)) / 2;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (opts.running()) t += dt;
    const fade = clamp(t / 0.55);
    const p = ease((t - opts.delay) / opts.duration);
    gl.uniform1f(uT, t);
    gl.uniform1f(uP, p);
    gl.uniform1f(uFade, fade * fade * (3 - 2 * fade));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (t < opts.delay + opts.duration + 0.15) {
      raf = requestAnimationFrame(frame);
    } else if (!done) {
      done = true;
      opts.onDone();
      canvas.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 700,
        easing: 'ease-out',
        fill: 'forwards',
      }).onfinish = () => stop();
    }
  };
  raf = requestAnimationFrame(frame);
  const stop = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.remove();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  return { stop };
}

/* ------------------------------------------------------------------ */
/* 2. Shutter sound — synthesized, quiet                               */
/* ------------------------------------------------------------------ */

function shutterSound(ac: AudioContext) {
  const t0 = ac.currentTime + 0.005;
  const out = ac.createGain();
  out.gain.value = 0.2;
  out.connect(ac.destination);
  const len = Math.round(ac.sampleRate * 0.12);
  const noise = ac.createBuffer(1, len, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const burst = (at: number, freq: number, q: number, dur: number, v: number) => {
    const src = ac.createBufferSource();
    src.buffer = noise;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(v, at + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp).connect(g).connect(out);
    src.start(at);
    src.stop(at + dur + 0.02);
  };
  const thump = (at: number, f0: number, v: number) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.45, at + 0.05);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(v, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + 0.08);
  };
  // mirror up + first curtain
  burst(t0, 3400, 1.1, 0.03, 0.9);
  thump(t0, 190, 0.7);
  burst(t0 + 0.004, 7200, 2.5, 0.012, 0.35);
  // second curtain + mirror return
  burst(t0 + 0.072, 2600, 0.9, 0.045, 1);
  thump(t0 + 0.074, 150, 0.8);
  burst(t0 + 0.078, 5600, 3, 0.018, 0.3);
  // film advance ratchet, very soft
  for (let i = 0; i < 4; i++) burst(t0 + 0.26 + i * 0.038, 4200, 4, 0.012, 0.12);
}

/* ------------------------------------------------------------------ */
/* 3. Iris geometry                                                    */
/* ------------------------------------------------------------------ */

function irisPolys(W: number, H: number, open: number) {
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.hypot(W, H) / 2 + 6;
  const r = open * R;
  const twist = ((1 - open) * 32 * Math.PI) / 180;
  const k = Math.tan(Math.PI / 6);
  const polys: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + twist;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    const tx = -ny;
    const ty = nx;
    const A = [cx + nx * r - tx * r * k, cy + ny * r - ty * r * k];
    const B = [cx + nx * r + tx * R * 2.2, cy + ny * r + ty * R * 2.2];
    const C = [B[0] + nx * R * 2.2, B[1] + ny * R * 2.2];
    const D = [A[0] + nx * R * 2.2, A[1] + ny * R * 2.2];
    polys.push([A, B, C, D].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '));
  }
  return polys;
}

/* ------------------------------------------------------------------ */

const mount: Signature = ({ root, cover, embedded, reduced, narrow, fine }) => {
  const disposers: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(
    target: Window | HTMLElement | Document,
    type: K | string,
    fn: (e: never) => void,
    opts?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, fn as EventListener, opts);
    disposers.push(() =>
      target.removeEventListener(type, fn as EventListener, opts),
    );
  };

  /* ---------------- develop ---------------- */
  const heroImgs = Array.from(cover.querySelectorAll<HTMLImageElement>(HERO));
  const developed = new WeakSet<HTMLImageElement>();
  let coverVisible = true;
  const io = new IntersectionObserver(([e]) => {
    coverVisible = e.isIntersecting;
  });
  io.observe(cover);
  disposers.push(() => io.disconnect());
  const running = () => coverVisible && !document.hidden;
  const devs: Developer[] = [];
  let disposed = false;

  if (reduced) {
    heroImgs.forEach((i) => developed.add(i));
  } else {
    root.classList.add('yui-developing');
    let pending = heroImgs.length;
    const finish = (img: HTMLImageElement) => {
      developed.add(img);
      img.dataset.yuiDeveloped = '';
      if (--pending <= 0) root.classList.remove('yui-developing');
    };
    heroImgs.forEach((img, i) => {
      const start = () => {
        if (disposed) return;
        const d = develop(img, {
          delay: 0.75 + i * 0.7,
          duration: i === 0 ? 4.4 : 3.8,
          seed: i * 7.3 + 1.7,
          running,
          onDone: () => finish(img),
        });
        if (d) devs.push(d);
        else finish(img);
      };
      if (img.complete && img.naturalWidth) start();
      else
        img.decode().then(start, () => {
          if (!disposed) finish(img);
        });
    });
  }
  disposers.push(() => {
    devs.forEach((d) => d.stop());
    root.classList.remove('yui-developing');
    heroImgs.forEach((i) => delete i.dataset.yuiDeveloped);
  });

  /* ---------------- viewfinder DOM ---------------- */
  const FW = narrow ? 156 : 228;
  const FH = Math.round((FW * 2) / 3);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const vf = document.createElement('div');
  vf.className = 'yui-vf';
  vf.setAttribute('aria-hidden', 'true');
  vf.style.width = `${FW}px`;
  vf.style.height = `${FH}px`;
  const arm = 16;
  vf.innerHTML = `
    <canvas class="yui-vf-lens" width="${FW * dpr}" height="${FH * dpr}"></canvas>
    <span class="yui-vf-flash"></span>
    <svg class="yui-vf-iris" viewBox="0 0 ${FW} ${FH}" width="${FW}" height="${FH}">
      <defs>
        <linearGradient id="yui-blade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#34302b"/><stop offset=".55" stop-color="#1c1a17"/><stop offset="1" stop-color="#0f0e0c"/>
        </linearGradient>
        <clipPath id="yui-iris-clip"><rect width="${FW}" height="${FH}"/></clipPath>
      </defs>
      <g clip-path="url(#yui-iris-clip)">${'<polygon fill="url(#yui-blade)" stroke="rgba(255,244,228,.14)" stroke-width=".8"/>'.repeat(6)}</g>
    </svg>
    <svg class="yui-vf-frame" viewBox="0 0 ${FW} ${FH}" width="${FW}" height="${FH}">
      <path d="M.75 ${arm}V.75H${arm} M${FW - arm} .75H${FW - 0.75}V${arm} M${FW - 0.75} ${FH - arm}V${FH - 0.75}H${FW - arm} M${arm} ${FH - 0.75}H.75V${FH - arm}"/>
      <path class="yui-vf-grid" d="M${FW / 3} ${FH / 2 - 3}v6 M${(FW * 2) / 3} ${FH / 2 - 3}v6"/>
    </svg>
    <span class="yui-vf-af"><i></i></span>
    <span class="yui-vf-read"><b class="yui-ss">1/125</b><b class="yui-fn">f2.8</b><b>ISO 400</b></span>
    <span class="yui-vf-count"></span>
    <span class="yui-vf-hint"></span>`;
  root.appendChild(vf);
  disposers.push(() => vf.remove());
  const lens = vf.querySelector<HTMLCanvasElement>('.yui-vf-lens')!;
  const lctx = lens.getContext('2d')!;
  const blades = Array.from(vf.querySelectorAll<SVGPolygonElement>('.yui-vf-iris polygon'));
  const flash = vf.querySelector<HTMLElement>('.yui-vf-flash')!;
  const ssEl = vf.querySelector<HTMLElement>('.yui-ss')!;
  const fnEl = vf.querySelector<HTMLElement>('.yui-fn')!;
  const countEl = vf.querySelector<HTMLElement>('.yui-vf-count')!;
  const hintEl = vf.querySelector<HTMLElement>('.yui-vf-hint')!;
  const setIris = (open: number) => {
    const p = irisPolys(FW, FH, open);
    blades.forEach((b, i) => b.setAttribute('points', p[i]));
  };
  setIris(1);

  const meter = document.createElement('canvas');
  meter.width = 12;
  meter.height = 8;
  const mctx = meter.getContext('2d', { willReadFrequently: true })!;

  /* ---------------- film strip ---------------- */
  const film = document.createElement('div');
  film.className = `yui-film${embedded ? ' is-embed' : ''}`;
  film.innerHTML = `<button type="button" class="yui-film-close" aria-label="フィルムを片付ける">×</button><div class="yui-film-track"></div>`;
  root.appendChild(film);
  disposers.push(() => film.remove());
  const track = film.querySelector<HTMLElement>('.yui-film-track')!;
  const closeBtn = film.querySelector<HTMLButtonElement>('.yui-film-close')!;
  on(closeBtn, 'click', () => {
    film.classList.remove('is-on');
    setTimeout(() => {
      if (!film.classList.contains('is-on')) track.replaceChildren();
    }, 500);
  });

  /* ---------------- state ---------------- */
  let target: HTMLImageElement | null = null;
  let targetFilter = '';
  let px = -999;
  let py = -999;
  let lastMove = 0;
  let speed = 0;
  let raf = 0;
  let focusTimer = 0;
  let meterAt = 0;
  let shots = 0;
  let busy = false;
  let holdTimer = 0;
  let holdAnim: Animation | null = null;
  let suppressUntil = 0;
  let touchHideTimer = 0;
  let ac: AudioContext | null = null;
  let lensBlur = 0;
  const shutters = [
    '1/30',
    '1/60',
    '1/125',
    '1/250',
    '1/500',
    '1/1000',
  ];

  const isHero = (img: HTMLImageElement) => img.matches(HERO);
  const eligible = (el: EventTarget | null): HTMLImageElement | null => {
    if (!(el instanceof HTMLImageElement)) return null;
    if (!root.contains(el)) return null;
    if (el.matches(GALLERY)) return el;
    if (el.matches(HERO) && developed.has(el)) return el;
    return null;
  };

  const setHint = () => {
    const txt = !target
      ? ''
      : isHero(target)
        ? fine
          ? 'クリックで撮影'
          : 'タップで撮影'
        : fine
          ? '長押しで撮影'
          : '長押しで撮影';
    hintEl.textContent = shots >= 2 ? '' : txt;
  };

  const setTarget = (img: HTMLImageElement | null) => {
    if (img === target) return;
    if (target) {
      target.style.filter = '';
      target.classList.remove('yui-vf-target');
    }
    target = img;
    if (img) {
      targetFilter = baseFilter(img);
      img.classList.add('yui-vf-target');
      img.style.filter = `${targetFilter} blur(${narrow ? 2.5 : 3.5}px)`;
      vf.classList.add('is-on');
      lens.style.filter = targetFilter;
      setHint();
    } else {
      vf.classList.remove('is-on', 'is-locked');
    }
  };

  const meterLight = () => {
    if (!target) return;
    mctx.fillStyle = PAPER;
    mctx.fillRect(0, 0, 12, 8);
    drawCrop(mctx, target, px - FW / 2, py - FH / 2, FW, FH, 12, 8);
    const d = mctx.getImageData(0, 0, 12, 8).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4)
      sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const lum = sum / (d.length / 4) / 255;
    const idx = Math.round(clamp((lum - 0.12) / 0.62) * (shutters.length - 1));
    ssEl.textContent = shutters[idx];
    fnEl.textContent = lum > 0.7 ? 'f4' : lum < 0.22 ? 'f2' : 'f2.8';
  };

  const paint = () => {
    raf = 0;
    vf.style.transform = `translate3d(${px - FW / 2}px, ${py - FH / 2}px, 0)`;
    if (!target) return;
    lctx.clearRect(0, 0, lens.width, lens.height);
    drawCrop(lctx, target, px - FW / 2, py - FH / 2, FW, FH, lens.width, lens.height);
    const now = performance.now();
    if (now - meterAt > 110) {
      meterAt = now;
      meterLight();
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(paint);
  };
  disposers.push(() => cancelAnimationFrame(raf));

  const setLensBlur = (b: number) => {
    lensBlur = b;
    lens.style.filter = `${targetFilter} blur(${b.toFixed(2)}px)`;
  };

  /** focus hunting: soft → overshoot → locked */
  const rackFocus = () => {
    if (!target) return;
    if (reduced) {
      setLensBlur(0);
      vf.classList.add('is-locked');
      return;
    }
    const from = Math.max(lensBlur, 1.6);
    const anim = lens.animate(
      [
        { filter: `${targetFilter} blur(${from}px)` },
        { filter: `${targetFilter} blur(0px)`, offset: 0.5 },
        { filter: `${targetFilter} blur(1.1px)`, offset: 0.72 },
        { filter: `${targetFilter} blur(0px)` },
      ],
      { duration: 420, easing: 'ease-out' },
    );
    anim.onfinish = () => {
      setLensBlur(0);
      if (target) vf.classList.add('is-locked');
    };
  };

  const move = (x: number, y: number, t: number) => {
    const dt = Math.max(1, t - lastMove);
    const dist = Math.hypot(x - px, y - py);
    speed = speed * 0.6 + (dist / dt) * 0.4;
    lastMove = t;
    px = x;
    py = y;
    if (target && !busy) {
      if (!reduced && speed > 0.25) {
        vf.classList.remove('is-locked');
        setLensBlur(Math.min(3.2, speed * 1.4));
      }
      clearTimeout(focusTimer);
      focusTimer = window.setTimeout(rackFocus, 110);
    }
    schedule();
  };
  disposers.push(() => {
    clearTimeout(focusTimer);
    clearTimeout(holdTimer);
    clearTimeout(touchHideTimer);
  });

  /* ---------------- shooting ---------------- */
  const addToFilm = (shot: HTMLCanvasElement, fromRect: DOMRect | null) => {
    const firstOn = !film.classList.contains('is-on');
    film.classList.add('is-on');
    const slot = document.createElement('div');
    slot.className = 'yui-film-frame';
    shot.className = 'yui-film-shot';
    shot.style.filter = targetFilter || '';
    const num = document.createElement('small');
    num.textContent = `${shots}  ▸ ${shots}A`;
    slot.appendChild(shot);
    slot.appendChild(num);
    track.appendChild(slot);
    const frames = track.children;
    if (frames.length > MAX_FRAMES) {
      const old = frames[0] as HTMLElement;
      if (reduced) old.remove();
      else
        old.animate(
          [
            { marginLeft: '0px', opacity: 1 },
            { marginLeft: `-${old.offsetWidth + 6}px`, opacity: 0 },
          ],
          { duration: 520, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' },
        ).onfinish = () => old.remove();
    }
    if (reduced || !fromRect) return;
    // the exposed frame flies from the viewfinder into the strip
    const to = shot.getBoundingClientRect();
    const fly = document.createElement('canvas');
    fly.width = shot.width;
    fly.height = shot.height;
    fly.getContext('2d')!.drawImage(shot, 0, 0);
    fly.className = 'yui-fly';
    fly.style.filter = shot.style.filter;
    Object.assign(fly.style, {
      left: `${fromRect.left}px`,
      top: `${fromRect.top}px`,
      width: `${fromRect.width}px`,
      height: `${fromRect.height}px`,
    });
    root.appendChild(fly);
    shot.style.opacity = '0';
    const sx = to.width / fromRect.width;
    const dx = to.left - fromRect.left;
    const dy = to.top - fromRect.top + (firstOn ? 0 : 0);
    const f = shot.style.filter;
    fly
      .animate(
        [
          { transform: 'translate(0,0) scale(1) rotate(0deg)', filter: `${f} brightness(1.9)` },
          { transform: 'translate(0,-6px) scale(1.02) rotate(0deg)', filter: `${f} brightness(1)`, offset: 0.22 },
          {
            transform: `translate(${dx * 0.35}px, ${dy * 0.2 - 40}px) scale(${(1 + sx) / 2}) rotate(-5deg)`,
            offset: 0.55,
          },
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}) rotate(0deg)`, filter: `${f} brightness(1)` },
        ],
        { duration: 900, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' },
      )
      .onfinish = () => {
        shot.style.opacity = '';
        fly.remove();
      };
    disposers.push(() => fly.remove());
  };

  const capture = () => {
    const img = target;
    if (!img) return null;
    const W = Math.round(FW * 1.6);
    const H = Math.round(FH * 1.6);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const cx = c.getContext('2d')!;
    cx.fillStyle = PAPER;
    cx.fillRect(0, 0, W, H);
    drawCrop(cx, img, px - FW / 2, py - FH / 2, FW, FH, W, H);
    return c;
  };

  const shoot = () => {
    if (busy || !target) return;
    busy = true;
    shots++;
    countEl.textContent = String(shots).padStart(2, '0');
    setHint();
    vf.classList.add('is-locked');
    setLensBlur(0);
    if (!embedded) {
      try {
        ac ??= new AudioContext();
        if (ac.state === 'suspended') void ac.resume();
        shutterSound(ac);
      } catch {
        /* audio is decoration */
      }
    }
    const fromRect = vf.getBoundingClientRect();
    const shot = capture();
    if (reduced) {
      if (shot) addToFilm(shot, null);
      busy = false;
      return;
    }
    const t0 = performance.now();
    const closeT = 60;
    const holdT = 45;
    const openT = 150;
    let captured = false;
    const step = (now: number) => {
      const t = now - t0;
      let open: number;
      if (t < closeT) open = 1 - (t / closeT) ** 2;
      else if (t < closeT + holdT) open = 0;
      else open = 1 - (1 - clamp((t - closeT - holdT) / openT)) ** 3;
      setIris(open);
      if (!captured && t >= closeT) {
        captured = true;
        flash.animate([{ opacity: 0.92 }, { opacity: 0 }], {
          duration: 420,
          easing: 'ease-out',
        });
        pageFlash.animate([{ opacity: 0.16 }, { opacity: 0 }], {
          duration: 520,
          easing: 'ease-out',
        });
      }
      if (t < closeT + holdT + openT) requestAnimationFrame(step);
      else {
        setIris(1);
        busy = false;
        if (shot) addToFilm(shot, fromRect);
      }
    };
    requestAnimationFrame(step);
  };

  const pageFlash = document.createElement('div');
  pageFlash.className = 'yui-page-flash';
  root.appendChild(pageFlash);
  disposers.push(() => pageFlash.remove());

  /* ---------------- pointer wiring ---------------- */
  const cancelHold = () => {
    clearTimeout(holdTimer);
    holdTimer = 0;
    holdAnim?.cancel();
    holdAnim = null;
    vf.classList.remove('is-holding');
  };

  const startHold = () => {
    cancelHold();
    vf.classList.add('is-holding');
    const ring = vf.querySelector<HTMLElement>('.yui-vf-af i')!;
    if (!reduced)
      holdAnim = ring.animate(
        [{ transform: 'scale(2.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
        { duration: 460, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' },
      );
    holdTimer = window.setTimeout(() => {
      holdTimer = 0;
      // swallow the click that follows the release, however long the hold
      suppressUntil = Infinity;
      vf.classList.remove('is-holding');
      holdAnim?.cancel();
      holdAnim = null;
      shoot();
    }, 480);
  };

  let downX = 0;
  let downY = 0;
  let downT = 0;
  let downImg: HTMLImageElement | null = null;

  on(root, 'pointermove', (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') {
      if (holdTimer && Math.hypot(e.clientX - downX, e.clientY - downY) > 10) {
        cancelHold();
        if (!busy) setTarget(null);
      }
      return;
    }
    if (busy) return;
    const img = eligible(e.target);
    setTarget(img);
    move(e.clientX, e.clientY, e.timeStamp);
    if (holdTimer && Math.hypot(e.clientX - downX, e.clientY - downY) > 8) cancelHold();
  });

  on(root, 'pointerleave', (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (!busy) setTarget(null);
    cancelHold();
  });

  on(root, 'pointerdown', (e: PointerEvent) => {
    const img = eligible(e.target);
    downX = e.clientX;
    downY = e.clientY;
    downT = e.timeStamp;
    downImg = img;
    if (!img || e.button !== 0) return;
    if (e.pointerType === 'mouse') {
      if (isHero(img)) shoot();
      else startHold();
      return;
    }
    // touch / pen
    if (!isHero(img)) {
      clearTimeout(touchHideTimer);
      holdTimer = window.setTimeout(() => {
        // show the viewfinder where the finger rests, then half-press
        px = downX;
        py = downY;
        setTarget(img);
        paint();
        rackFocus();
        startHold();
      }, 180);
    }
  });

  const releaseSuppress = () => {
    if (suppressUntil === Infinity) suppressUntil = performance.now() + 450;
  };
  on(window, 'pointerup', releaseSuppress);
  on(window, 'pointercancel', releaseSuppress);

  on(root, 'pointerup', (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      cancelHold();
      return;
    }
    if (holdTimer) {
      cancelHold();
      if (!busy) setTarget(null);
    }
    const img = downImg;
    if (
      img &&
      isHero(img) &&
      e.timeStamp - downT < 450 &&
      Math.hypot(e.clientX - downX, e.clientY - downY) < 12
    ) {
      clearTimeout(touchHideTimer);
      px = e.clientX;
      py = e.clientY;
      setTarget(img);
      setLensBlur(reduced ? 0 : 2.4);
      paint();
      rackFocus();
      window.setTimeout(shoot, reduced ? 0 : 300);
    }
    if (target) {
      clearTimeout(touchHideTimer);
      touchHideTimer = window.setTimeout(() => {
        if (!busy) setTarget(null);
      }, 1500);
    }
  });

  on(root, 'pointercancel', () => {
    cancelHold();
    if (!busy) setTarget(null);
  });

  on(root, 'contextmenu', (e: MouseEvent) => {
    if (eligible(e.target)) e.preventDefault();
  });

  // a long press shot must not also open the enlarged photo
  on(
    window,
    'click',
    (e: MouseEvent) => {
      if (performance.now() < suppressUntil) {
        e.stopPropagation();
        e.preventDefault();
        suppressUntil = 0;
      }
    },
    { capture: true },
  );

  // content scrolls under a resting pointer
  on(
    window,
    'scroll',
    () => {
      if (px < 0 || busy || !fine) return;
      const el = document.elementFromPoint(px, py);
      setTarget(eligible(el));
      schedule();
    },
    { passive: true },
  );

  disposers.push(() => {
    setTarget(null);
    void ac?.close();
  });

  return () => {
    disposed = true;
    disposers.reverse().forEach((d) => d());
  };
};

export default mount;
