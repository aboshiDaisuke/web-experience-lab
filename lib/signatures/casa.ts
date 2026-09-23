import type { Signature } from "./types";

/*
 * CASA N01 — "from drawing to dwelling"
 * The hero photo is first shown as a draftsman's elevation (ink on paper,
 * derived from the photo in a shader), then the house is built storey by
 * storey along its own perspective lines. Afterwards the page scroll drives
 * the time of day: late afternoon → blue hour → night.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform sampler2D uPhoto;
uniform sampler2D uMask;      // r: sky, g: window glow (blurred)
uniform vec2 uSize;           // css px of the box
uniform float uDpr;
uniform vec4 uRect;           // image rect in css px: ox, oy, dw, dh
uniform vec4 uFrontA;         // build front at knots u = 0, .16, .70, .93
uniform float uFrontB;        // knot u = 1
uniform float uSkyPhase;      // 0..1 sky may appear
uniform float uLine;          // level line alpha
uniform float uInk;           // drawing ink amount
uniform float uTod;           // 0 afternoon, .5 blue hour, 1 night
uniform float uNarrow;
uniform float uLegible;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float L(vec2 uv) { return luma(texture2D(uPhoto, uv).rgb); }

float frontAt(float u) {
  if (u < 0.16) return mix(uFrontA.x, uFrontA.y, clamp(u / 0.16, 0.0, 1.0));
  if (u < 0.70) return mix(uFrontA.y, uFrontA.z, (u - 0.16) / 0.54);
  if (u < 0.93) return mix(uFrontA.z, uFrontA.w, (u - 0.70) / 0.23);
  return mix(uFrontA.w, uFrontB, clamp((u - 0.93) / 0.07, 0.0, 1.0));
}

float hatch(vec2 p, vec2 dir, float spacing, float wob) {
  float d = abs(fract(dot(p, dir) / spacing + wob) - 0.5) * spacing;
  return 1.0 - smoothstep(0.35, 0.35 + 1.1 / uDpr, d);
}

vec3 drawing(vec2 uv, vec2 css, float sky) {
  vec2 px = vec2(1.0 / uRect.z, 1.0 / uRect.w);
  vec2 s = px * 1.15;
  float tl = L(uv + vec2(-s.x, -s.y));
  float tc = L(uv + vec2(0.0, -s.y));
  float tr = L(uv + vec2(s.x, -s.y));
  float ml = L(uv + vec2(-s.x, 0.0));
  float mr = L(uv + vec2(s.x, 0.0));
  float bl = L(uv + vec2(-s.x, s.y));
  float bc = L(uv + vec2(0.0, s.y));
  float br = L(uv + vec2(s.x, s.y));
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  float gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
  float mag = sqrt(gx * gx + gy * gy);
  float lum = (tc + bc + ml + mr) * 0.25;
  float pen = 0.8 + 0.2 * vnoise(css * 0.08);
  float edge = smoothstep(0.1, 0.32, mag) * pen * (1.0 - sky * 0.9);

  float dark = (1.0 - smoothstep(0.08, 0.55, lum)) * (1.0 - sky);
  float wob = (vnoise(css * 0.035) - 0.5) * 0.18;
  float h1 = hatch(css, normalize(vec2(1.0, 1.0)), 5.0, wob) * smoothstep(0.3, 0.5, dark + wob);
  float h2 = hatch(css, normalize(vec2(1.0, -1.0)), 5.0, wob) * smoothstep(0.62, 0.8, dark - wob);
  // glazing convention: pairs of short diagonal glints on lit glass
  vec3 col = texture2D(uPhoto, uv).rgb;
  float glassy = smoothstep(0.42, 0.7, lum) * smoothstep(0.05, 0.2, col.r - col.b);
  vec2 cell = floor(css / vec2(46.0, 38.0));
  float gd = fract(dot(css, normalize(vec2(1.0, -1.25))) / 46.0);
  float glint = (1.0 - smoothstep(0.012, 0.03, abs(gd - 0.2))) + (1.0 - smoothstep(0.012, 0.03, abs(gd - 0.26)));
  vec2 cf = fract(css / vec2(46.0, 38.0));
  glint *= step(0.55, hash(cell)) * smoothstep(0.2, 0.35, cf.y) * (1.0 - smoothstep(0.65, 0.8, cf.y));

  float ink = max(edge, max(h1 * 0.28, h2 * 0.34));
  ink = max(ink, glint * glassy * 0.45);
  // leave the paper quiet where the headline is lettered
  vec2 q = css / uSize;
  float clear = uNarrow > 0.5
    ? (1.0 - smoothstep(0.42, 0.58, q.y))
    : (1.0 - smoothstep(0.12, 0.4, q.x)) * smoothstep(0.08, 0.2, q.y) * (1.0 - smoothstep(0.62, 0.8, q.y));
  ink *= (1.0 - 0.62 * clear) * uInk;

  vec3 paper = vec3(0.944, 0.936, 0.902);
  paper += (hash(css * 1.3) - 0.5) * 0.028;
  paper -= vnoise(css * 0.012) * 0.02;
  vec3 inkCol = vec3(0.17, 0.21, 0.19);
  return mix(paper, inkCol, clamp(ink, 0.0, 0.92));
}

vec3 grade(vec2 uv, vec2 css, float sky, float glow) {
  vec3 c = texture2D(uPhoto, uv).rgb;
  float lum = luma(c);
  float win = smoothstep(0.4, 0.72, lum) * smoothstep(0.04, 0.2, c.r - c.b);
  float y = uv.y;

  // late afternoon: lights off, warm raking sun from the west
  float warm = smoothstep(0.05, 0.22, c.r - c.b) * smoothstep(0.12, 0.42, lum);
  vec3 glass = vec3(lum) * vec3(0.66, 0.74, 0.82) + vec3(0.03, 0.04, 0.05);
  vec3 aft = mix(c, glass, warm * 0.86);
  aft = pow(max(aft * 1.36, 0.0), vec3(0.9));
  float al = luma(aft);
  // golden highlights, cool shade
  aft *= mix(vec3(0.9, 0.96, 1.06), vec3(1.14, 1.0, 0.78), smoothstep(0.25, 0.85, al));
  aft *= 1.0 + 0.26 * (1.0 - uv.x) * (1.0 - y);
  vec3 skyA = mix(vec3(0.55, 0.63, 0.72), vec3(0.98, 0.83, 0.62), smoothstep(0.0, 0.5, y));
  aft = mix(aft, skyA * (0.92 + 0.5 * (lum - 0.38)), sky);

  // blue hour: the photograph as taken, sky pushed a touch deeper
  vec3 blu = c * vec3(0.95, 1.0, 1.07);
  vec3 skyB = mix(vec3(0.2, 0.28, 0.44), vec3(0.44, 0.5, 0.6), smoothstep(0.0, 0.5, y));
  blu = mix(blu, skyB * (0.85 + 0.6 * (lum - 0.38)), sky * 0.55);
  blu += glow * vec3(1.0, 0.7, 0.4) * 0.1;

  // night: the house is lit from inside
  vec3 nig = c * vec3(0.24, 0.3, 0.46);
  float lit = max(win, smoothstep(0.72, 0.95, lum));
  nig = mix(nig, c * vec3(1.18, 1.05, 0.9), lit);
  nig += glow * vec3(1.0, 0.6, 0.26) * 0.42;
  vec3 skyN = mix(vec3(0.02, 0.035, 0.07), vec3(0.07, 0.09, 0.14), smoothstep(0.0, 0.55, y));
  vec2 sc = floor(css / 34.0);
  vec2 sp = fract(css / 34.0) - (0.2 + 0.6 * vec2(hash(sc + 3.1), hash(sc + 7.7)));
  float star = step(0.84, hash(sc)) * (1.0 - smoothstep(0.4, 1.2, length(sp * 34.0))) * (1.0 - smoothstep(0.0, 0.4, y));
  skyN += star * 0.55 * hash(sc + 1.7);
  nig = mix(nig, skyN, sky);

  vec3 col = uTod < 0.5 ? mix(aft, blu, smoothstep(0.0, 0.5, uTod)) : mix(blu, nig, smoothstep(0.5, 1.0, uTod));

  // quiet legibility for the headline (left) and a soft lens vignette
  vec2 q = css / uSize;
  float left = uNarrow > 0.5 ? 0.45 + 0.55 * (1.0 - smoothstep(0.45, 0.7, q.y)) : (1.0 - smoothstep(0.05, 0.62, q.x)) * (1.0 - smoothstep(0.35, 0.95, q.y));
  col *= mix(1.0, uLegible, left);
  col *= 1.0 - 0.28 * pow(length(q - 0.5) * 1.25, 2.5);
  return col;
}

void main() {
  vec2 css = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 uv = (css - uRect.xy) / uRect.zw;
  vec4 m = texture2D(uMask, uv);
  float sky = m.r;
  float fr = frontAt(uv.x);
  float n = (vnoise(css * vec2(0.05, 0.09)) - 0.5) * 0.016;
  float soft = 14.0 / uRect.w;
  float built = smoothstep(fr - soft, fr + soft, uv.y + n);
  built *= mix(1.0, uSkyPhase, smoothstep(0.2, 0.8, sky));

  vec3 col = built > 0.001 ? grade(uv, css, sky, m.g) : vec3(0.0);
  if (built < 0.999) {
    vec3 d = drawing(uv, css, sky);
    col = mix(d, col, built);
    // a warm breath of light where the drawing turns into material
    col += vec3(1.0, 0.86, 0.62) * 0.1 * built * (1.0 - built) * 4.0;
  }
  // level line at the build front, with scale ticks
  float dy = (uv.y - fr) * uRect.w;
  float line = 1.0 - smoothstep(0.35, 0.35 + 1.0 / uDpr, abs(dy));
  float tickD = abs(fract(css.x / 24.0 + 0.5) - 0.5) * 24.0;
  float tickLen = abs(fract(css.x / 120.0 + 0.5) - 0.5) < 0.1 ? 9.0 : 4.0;
  float ticks = (1.0 - smoothstep(0.35, 0.35 + 1.0 / uDpr, tickD)) * step(0.0, dy) * (1.0 - step(tickLen, dy));
  col = mix(col, vec3(0.2, 0.25, 0.22), clamp((line * 0.75 + ticks * 0.55) * uLine, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

type Knots = [number, number, number, number, number];
// Build boundaries in image space (v, 0 = top) along the building's own
// perspective, at knots u = 0, .16, .70, .93, 1.
const TERRACE: Knots = [0.8, 0.78, 0.75, 0.735, 0.735];
const FLOOR2: Knots = [0.56, 0.505, 0.52, 0.548, 0.56];
const CEILING: Knots = [0.44, 0.43, 0.28, 0.375, 0.4];
const ROOF: Knots = [0.4, 0.385, 0.1, 0.36, 0.33];
const KNOT_U = [0, 0.16, 0.7, 0.93, 1];
const LEVELS: { k: Knots; label: string }[] = [
  { k: TERRACE, label: "1FL +450" },
  { k: FLOOR2, label: "2FL +3,600" },
  { k: CEILING, label: "RFL +6,300" },
  { k: ROOF, label: "最高高さ +7,250" },
];
const STAGES = [0.55, 0.72, 0.62, 0.62, 0.95];
const HOLD = 0.16;

const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const knotAt = (k: Knots, u: number) => {
  for (let i = 0; i < 4; i++) {
    if (u <= KNOT_U[i + 1] || i === 3) {
      const t = clamp((u - KNOT_U[i]) / (KNOT_U[i + 1] - KNOT_U[i]));
      return k[i] + (k[i + 1] - k[i]) * t;
    }
  }
  return k[4];
};

function buildMask(img: HTMLImageElement) {
  const w = 700;
  const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(img, 0, 0, w, h);
  const src = g.getImageData(0, 0, w, h).data;
  const n = w * h;
  const r = new Float32Array(n);
  const gg = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = src[i * 4] / 255;
    gg[i] = src[i * 4 + 1] / 255;
    b[i] = src[i * 4 + 2] / 255;
  }
  const skyLike = (i: number) => {
    const l = r[i] * 0.3 + gg[i] * 0.59 + b[i] * 0.11;
    return l > 0.14 && b[i] >= r[i] - 0.02 && b[i] >= gg[i] - 0.03;
  };
  // flood fill the sky from the top edge
  const sky = new Uint8Array(n);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) {
    if (!skyLike(x)) continue;
    sky[x] = 1;
    stack.push(x);
  }
  const maxY = h * 0.72;
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % w;
    const y = (i - x) / w;
    const nb = [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < maxY ? i + w : -1,
    ];
    for (const j of nb) {
      if (j < 0 || sky[j]) continue;
      const d =
        Math.abs(r[j] - r[i]) + Math.abs(gg[j] - gg[i]) + Math.abs(b[j] - b[i]);
      if (d < 0.05 && skyLike(j)) {
        sky[j] = 1;
        stack.push(j);
      }
    }
  }
  const skyF = new Float32Array(n);
  const win = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    skyF[i] = sky[i];
    const l = r[i] * 0.299 + gg[i] * 0.587 + b[i] * 0.114;
    const s1 = clamp((l - 0.42) / 0.3);
    const s2 = clamp((r[i] - b[i] - 0.05) / 0.15);
    win[i] = s1 * s2;
  }
  const blur = (a: Float32Array, rad: number) => {
    const t = new Float32Array(n);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) {
        let acc = 0;
        for (let x = -rad; x <= rad; x++) acc += a[y * w + clamp(x, 0, w - 1)];
        for (let x = 0; x < w; x++) {
          t[y * w + x] = acc / (2 * rad + 1);
          acc +=
            a[y * w + Math.min(w - 1, x + rad + 1)] -
            a[y * w + Math.max(0, x - rad)];
        }
      }
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let y = -rad; y <= rad; y++) acc += t[clamp(y, 0, h - 1) * w + x];
        for (let y = 0; y < h; y++) {
          a[y * w + x] = acc / (2 * rad + 1);
          acc +=
            t[Math.min(h - 1, y + rad + 1) * w + x] -
            t[Math.max(0, y - rad) * w + x];
        }
      }
    }
  };
  blur(skyF, 1);
  blur(win, 9);
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = Math.round(clamp(skyF[i]) * 255);
    out[i * 4 + 1] = Math.round(clamp(win[i] * 1.6) * 255);
    out[i * 4 + 3] = 255;
  }
  return { data: out, w, h };
}

const SVG = "http://www.w3.org/2000/svg";
const svgEl = (tag: string, attrs: Record<string, string | number>) => {
  const e = document.createElementNS(SVG, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
};
const add = (parent: Node, ...kids: Node[]) => {
  for (const k of kids) parent.appendChild(k);
};

const CLOCK = [
  [0, 16 * 60 + 40],
  [0.5, 19 * 60 + 10],
  [1, 21 * 60 + 30],
];
const clockAt = (t: number) => {
  const [a, b] = t <= 0.5 ? [CLOCK[0], CLOCK[1]] : [CLOCK[1], CLOCK[2]];
  const m = Math.round(a[1] + (b[1] - a[1]) * ((t - a[0]) / (b[0] - a[0])));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

const mount: Signature = (ctx) => {
  const { cover, reduced, narrow, embedded } = ctx;
  const visual = cover.querySelector<HTMLElement>(".casa-visual");
  if (!visual) return;
  const setState = (s: string | null) => {
    if (s) cover.dataset.casaSig = s;
    else delete cover.dataset.casaSig;
  };
  if (reduced) {
    setState("off");
    return () => setState(null);
  }
  const photoEl = visual.querySelector<HTMLImageElement>(":scope > img");
  if (!photoEl) {
    setState("off");
    return () => setState(null);
  }
  const canvas = document.createElement("canvas");
  canvas.className = "casa-sig-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const gl =
    (canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    }) as WebGLRenderingContext | null) ??
    canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) {
    setState("off");
    return () => setState(null);
  }
  const isGL2 =
    typeof WebGL2RenderingContext !== "undefined" &&
    gl instanceof WebGL2RenderingContext;

  // overlay: drawing annotations, title block, clock
  const svg = svgEl("svg", { class: "casa-sig-annot", "aria-hidden": "true" });
  const block = document.createElement("div");
  block.className = "casa-sig-titleblock";
  block.setAttribute("aria-hidden", "true");
  block.innerHTML =
    '<span class="tb-name">CASA MIRAI</span><span class="tb-no">A-201</span>' +
    '<span class="tb-title">南側立面図</span><span class="tb-scale">S = 1:100</span>' +
    '<span class="tb-by">設計 — MIRAI アトリエ</span><span class="tb-date">2026.09</span>';
  const clock = document.createElement("div");
  clock.className = "casa-sig-clock";
  clock.setAttribute("aria-hidden", "true");
  clock.innerHTML =
    '<span class="ck-time">16:40</span><span class="ck-label"><i>西日</i><i>薄暮</i><i>夜のあかり</i></span>' +
    '<span class="ck-track"><b></b><em style="left:0%"></em><em style="left:50%"></em><em style="left:100%"></em></span>';
  const ckTime = clock.querySelector<HTMLElement>(".ck-time");
  const ckLabels = Array.from(
    clock.querySelectorAll<HTMLElement>(".ck-label i"),
  );
  const ckDot = clock.querySelector<HTMLElement>(".ck-track b");

  add(visual, canvas, svg, block, clock);
  setState("live");
  cover.dataset.casaPhase = "drawing";

  // ---- GL setup
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type) as WebGLShader;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.warn("[casa]", gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram() as WebGLProgram;
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  let ok = !!gl.getProgramParameter(prog, gl.LINK_STATUS);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const u = {
    photo: U("uPhoto"),
    mask: U("uMask"),
    size: U("uSize"),
    dpr: U("uDpr"),
    rect: U("uRect"),
    frontA: U("uFrontA"),
    frontB: U("uFrontB"),
    skyPhase: U("uSkyPhase"),
    line: U("uLine"),
    ink: U("uInk"),
    tod: U("uTod"),
    narrow: U("uNarrow"),
    legible: U("uLegible"),
  };
  const texPhoto = gl.createTexture();
  const texMask = gl.createTexture();
  const setupTex = (t: WebGLTexture | null, mip: boolean) => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };

  // ---- state
  let disposed = false;
  let ready = false;
  let visible = true;
  let paused = false;
  let raf = 0;
  let last = 0;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let imgW = 1400;
  let imgH = 1089;
  let rect = [0, 0, 1, 1];
  let vTop = 0;
  let vBottom = 1;
  let introStart = -1;
  let built = false;
  let tod = 0;
  let todTarget = 0;
  let frontNow: Knots = [2, 2, 2, 2, 2];
  let skyPhase = 0;
  let lineA = 0;
  let ink = 0;
  let annotA = 1;
  let lastClock = "";
  const INK_IN = 0.55;
  const DWELL = 1.05;
  const totalBuild =
    STAGES.reduce((a, b) => a + b, 0) + HOLD * (STAGES.length - 1);

  const objectPos = () => {
    const cs = getComputedStyle(photoEl).objectPosition.split(" ");
    const f = (s: string | undefined) =>
      s && s.endsWith("%") ? parseFloat(s) / 100 : 0.5;
    return [f(cs[0]), f(cs[1] ?? cs[0])];
  };

  const layout = () => {
    const r = visual.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    dpr = Math.min(
      window.devicePixelRatio || 1,
      embedded ? 1.25 : narrow ? 1.5 : 2,
    );
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const s = Math.max(W / imgW, H / imgH);
    const dw = imgW * s;
    const dh = imgH * s;
    const [px, py] = objectPos();
    rect = [(W - dw) * px, (H - dh) * py, dw, dh];
    vTop = clamp(-rect[1] / dh);
    vBottom = clamp((H - rect[1]) / dh);
    drawAnnotations();
    request();
  };

  const toX = (uu: number) => rect[0] + uu * rect[2];
  const toY = (vv: number) => rect[1] + vv * rect[3];
  const toU = (x: number) => (x - rect[0]) / rect[2];

  const drawAnnotations = () => {
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const g = svgEl("g", { class: "annot-g" });
    add(svg, g);
    const line = (x1: number, y1: number, x2: number, y2: number, cls = "") =>
      add(g, svgEl("line", { x1, y1, x2, y2, class: cls }));
    const text = (
      x: number,
      y: number,
      s: string,
      anchor = "start",
      cls = "",
    ) => {
      const t = svgEl("text", { x, y, "text-anchor": anchor, class: cls });
      t.textContent = s;
      add(g, t);
    };
    // column grid: bubbles at the top and dash-dot lines through the house
    const cols = [0.075, 0.16, 0.39, 0.63, 0.93];
    let n = 1;
    for (const cu of cols) {
      const x = toX(cu);
      if (x < 14 || x > W - 14) continue;
      if (narrow) {
        line(x, H * 0.52, x, H - 6, "axis");
        continue;
      }
      line(x, 34, x, H - 6, "axis");
      add(g, svgEl("circle", { cx: x, cy: 20, r: 10, class: "bubble" }));
      text(x, 23.5, `X${n++}`, "middle", "bubble-t");
    }
    // level lines in perspective + a level column on the right edge
    const colX = W - (narrow ? 16 : 26);
    const colU = toU(colX);
    const ys: number[] = [];
    for (const lv of LEVELS) {
      const pts: string[] = [];
      for (let i = 0; i <= 40; i++) {
        const uu =
          Math.max(toU(0), 0) +
          ((Math.min(colU, 1) - Math.max(toU(0), 0)) * i) / 40;
        pts.push(`${toX(uu).toFixed(1)},${toY(knotAt(lv.k, uu)).toFixed(1)}`);
      }
      add(g, svgEl("polyline", { points: pts.join(" "), class: "level" }));
      const y = toY(knotAt(lv.k, colU));
      if (y < 8 || y > H - 8 || (narrow && y < H * 0.52)) continue;
      ys.push(y);
      line(colX - 7, y, colX + 7, y, "tick");
      add(
        g,
        svgEl("path", {
          d: `M${colX - 14} ${y - 9} l5 7 l5 -7 z`,
          class: "tri",
        }),
      );
      text(colX - 18, y - 3, lv.label, "end", "lv-t");
    }
    if (ys.length > 1)
      line(colX, Math.min(...ys), colX, Math.max(...ys), "dim");
    // overall width, drawn below the terrace
    const yW = Math.min(H - 18, toY(0.86));
    const xa = Math.max(10, toX(0.075));
    const xb = Math.min(W - 60, toX(0.93));
    if (xb - xa > 80) {
      line(xa, yW, xb, yW, "dim");
      for (const x of [xa, xb]) {
        line(x, yW - 12, x, yW + 5, "ext");
        line(x - 4, yW + 4, x + 4, yW - 4, "slash");
      }
      text((xa + xb) / 2, yW - 6, "14,400", "middle", "dim-t");
    }
  };

  const request = () => {
    if (!raf && !disposed) raf = requestAnimationFrame(frame);
  };

  const updateBuild = (t: number) => {
    // t: seconds since construction start
    const B0: Knots = [
      vBottom + 0.04,
      vBottom + 0.04,
      vBottom + 0.04,
      vBottom + 0.04,
      vBottom + 0.04,
    ];
    const B5: Knots = [
      vTop - 0.08,
      vTop - 0.08,
      vTop - 0.08,
      vTop - 0.08,
      vTop - 0.08,
    ];
    const bounds = [B0, TERRACE, FLOOR2, CEILING, ROOF, B5];
    let acc = 0;
    let k = 0;
    let local = 1;
    let moving = false;
    for (k = 0; k < STAGES.length; k++) {
      if (t < acc + STAGES[k]) {
        local = (t - acc) / STAGES[k];
        moving = true;
        break;
      }
      acc += STAGES[k];
      if (t < acc + HOLD) {
        local = 1;
        break;
      }
      acc += HOLD;
    }
    if (k >= STAGES.length) {
      frontNow = [-1, -1, -1, -1, -1];
      skyPhase = 1;
      lineA = 0;
      return true;
    }
    const e = ease(clamp(local));
    const a = bounds[k];
    const b = bounds[k + 1];
    frontNow = a.map((v, i) => Math.min(v + (b[i] - v) * e, v)) as Knots;
    // make sure the front never runs ahead of a lower storey
    skyPhase = k === STAGES.length - 1 ? e : 0;
    lineA = moving
      ? Math.sin(Math.PI * clamp(local)) * (k === STAGES.length - 1 ? 0.4 : 1)
      : 0.35;
    return false;
  };

  const frame = (now: number) => {
    raf = 0;
    if (disposed) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    let busy = false;
    if (ready && !paused) {
      if (!built) {
        if (introStart < 0) introStart = now;
        const t = (now - introStart) / 1000;
        ink = clamp(t / INK_IN);
        const done = updateBuild(t - DWELL);
        if (t - DWELL < 0) frontNow = [2, 2, 2, 2, 2];
        const bt = t - DWELL;
        if (bt > totalBuild - STAGES[4] - 0.2)
          cover.dataset.casaPhase = "building";
        annotA = 1 - clamp((bt - (totalBuild - 1.1)) / 1.0);
        svg.style.opacity = String(annotA);
        block.style.opacity = String(annotA);
        if (done) {
          built = true;
          cover.dataset.casaPhase = "built";
          svg.style.opacity = "0";
          block.style.opacity = "0";
        }
        busy = true;
      }
      const k = 1 - Math.exp(-dt * 3.2);
      const diff = todTarget - tod;
      tod = Math.abs(diff) < 0.0008 ? todTarget : tod + diff * k;
      if (tod !== todTarget) busy = true;
      updateClock();
      if (visible) render();
    }
    if (busy && visible && !paused) request();
    else last = 0;
  };

  const updateClock = () => {
    const s = clockAt(tod);
    if (s !== lastClock && ckTime) {
      ckTime.textContent = s;
      lastClock = s;
    }
    if (ckDot) ckDot.style.left = `${(tod * 100).toFixed(2)}%`;
    const idx = tod < 0.28 ? 0 : tod < 0.76 ? 1 : 2;
    ckLabels.forEach((el, i) => el.classList.toggle("on", i === idx));
  };

  const render = () => {
    if (!ok) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texPhoto);
    gl.uniform1i(u.photo, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texMask);
    gl.uniform1i(u.mask, 1);
    gl.uniform2f(u.size, W, H);
    gl.uniform1f(u.dpr, canvas.width / W);
    gl.uniform4f(u.rect, rect[0], rect[1], rect[2], rect[3]);
    gl.uniform4f(u.frontA, frontNow[0], frontNow[1], frontNow[2], frontNow[3]);
    gl.uniform1f(u.frontB, frontNow[4]);
    gl.uniform1f(u.skyPhase, skyPhase);
    gl.uniform1f(u.line, lineA);
    gl.uniform1f(u.ink, ink);
    gl.uniform1f(u.tod, tod);
    gl.uniform1f(u.narrow, narrow ? 1 : 0);
    gl.uniform1f(u.legible, narrow ? 0.64 : 0.7);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const fail = () => {
    ok = false;
    setState("off");
    cover.style.removeProperty("--casa-run");
    canvas.remove();
    svg.remove();
    block.remove();
    clock.remove();
    delete cover.dataset.casaPhase;
  };

  // ---- time of day from scroll
  // the scroll position is remembered during the build and applied after it
  // The hero is held in place (CSS sticky) for a short runway; that runway is
  // the clock. Nothing is wrapped or moved in the DOM.
  let runway = 0;
  let runwayW = -1;
  let pinTop = -1;
  const onScrollAny = () => {
    if (window.innerWidth !== runwayW) {
      runwayW = window.innerWidth;
      runway = Math.round(
        Math.max(560, window.innerHeight) * (narrow ? 0.8 : 0.9),
      );
      cover.style.setProperty("--casa-run", `${runway}px`);
    }
    const coverTop = cover.getBoundingClientRect().top + window.scrollY;
    const vh = visual.offsetHeight || H;
    const top = Math.round(
      Math.max(0, Math.min(coverTop, (window.innerHeight - vh) / 2)),
    );
    if (top !== pinTop) {
      pinTop = top;
      cover.style.setProperty("--casa-pin-top", `${top}px`);
    }
    todTarget = clamp((window.scrollY - (coverTop - top)) / runway);
    request();
  };
  window.addEventListener("scroll", onScrollAny, { passive: true });
  window.addEventListener("resize", onScrollAny);
  onScrollAny();

  // ---- visibility / 3D view
  const io = new IntersectionObserver((es) => {
    visible = es[es.length - 1].isIntersecting;
    if (visible) request();
  });
  io.observe(cover);
  const onVis = () => {
    if (!document.hidden) request();
  };
  document.addEventListener("visibilitychange", onVis);
  const mo = new MutationObserver(() => {
    const hasImg = !!visual.querySelector(":scope > img");
    const want = !hasImg || !!visual.querySelector(".scene");
    if (want === paused) return;
    paused = want;
    setState(paused ? "paused" : "live");
    if (!paused) {
      if (!built) {
        built = true;
        frontNow = [-1, -1, -1, -1, -1];
        skyPhase = 1;
        lineA = 0;
        ink = 1;
        svg.style.opacity = "0";
        block.style.opacity = "0";
      }
      cover.dataset.casaPhase = "built";
      layout();
    }
  });
  mo.observe(visual, { childList: true });
  const ro = new ResizeObserver(() => layout());
  ro.observe(visual);

  const onLost = (e: Event) => {
    e.preventDefault();
    fail();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  // ---- load
  const src = photoEl.currentSrc || photoEl.src;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  img
    .decode()
    .then(() => {
      if (disposed || !ok) {
        if (!ok) fail();
        return;
      }
      imgW = img.naturalWidth;
      imgH = img.naturalHeight;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      setupTex(texPhoto, isGL2);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (isGL2) gl.generateMipmap(gl.TEXTURE_2D);
      const m = buildMask(img);
      setupTex(texMask, false);
      if (m)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          m.w,
          m.h,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          m.data,
        );
      else
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array([0, 0, 0, 255]),
        );
      ready = true;
      cover.dataset.casaReady = "";
      layout();
      onScrollAny();
    })
    .catch(() => fail());

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScrollAny);
    window.removeEventListener("resize", onScrollAny);
    document.removeEventListener("visibilitychange", onVis);
    io.disconnect();
    mo.disconnect();
    ro.disconnect();
    canvas.removeEventListener("webglcontextlost", onLost);
    gl.deleteTexture(texPhoto);
    gl.deleteTexture(texMask);
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
    svg.remove();
    block.remove();
    clock.remove();
    setState(null);
    delete cover.dataset.casaPhase;
    delete cover.dataset.casaReady;
    cover.style.removeProperty("--casa-run");
    cover.style.removeProperty("--casa-pin-top");
  };
};

export default mount;
