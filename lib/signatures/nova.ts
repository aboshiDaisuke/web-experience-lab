import type { Signature } from "./types";

/*
 * NOVA INDUSTRIES — "inspection lens"
 * The hero photo is re-drawn as a CAD / blueprint view (edge contours on a
 * measured grid). The pointer carries an inspection lens that shows the real
 * photograph, magnified, with barrel distortion and chromatic fringe. Clicks
 * place measuring points and a dimension line between the last two.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform sampler2D uPhoto;
uniform vec2 uSize;
uniform float uDpr;
uniform vec4 uRect;     // image rect in css px
uniform vec2 uField;    // image size in mm
uniform vec2 uGrid;     // minor, major grid step in mm
uniform vec3 uLens;     // x, y, radius (css px)
uniform float uMag;
uniform float uLensA;
uniform float uScan;    // scan line position (0..1 of height), >1.1 done
uniform float uPulse;   // measurement flash
uniform float uBottom;  // css px covered by the photo selector
uniform float uStep;    // sobel step in css px

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float L(vec2 uv) { return luma(texture2D(uPhoto, uv).rgb); }
float aline(float dpx, float w) { return 1.0 - smoothstep(w, w + 1.0 / uDpr, dpx); }
float gridD(float mm, float stepMm, float mmPerPx) {
  return abs(fract(mm / stepMm + 0.5) - 0.5) * stepMm / mmPerPx;
}

void main() {
  vec2 css = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 uv = (css - uRect.xy) / uRect.zw;
  vec2 q = css / uSize;
  float mmPerPx = uField.x / uRect.z;
  vec2 mm = uv * uField;

  // blueprint ground
  vec3 col = mix(vec3(0.028, 0.075, 0.125), vec3(0.05, 0.12, 0.185), 1.0 - clamp(length(q - vec2(0.55, 0.45)) * 1.25, 0.0, 1.0));
  float gMin = max(aline(gridD(mm.x, uGrid.x, mmPerPx), 0.2), aline(gridD(mm.y, uGrid.x, mmPerPx), 0.2));
  float gMaj = max(aline(gridD(mm.x, uGrid.y, mmPerPx), 0.3), aline(gridD(mm.y, uGrid.y, mmPerPx), 0.3));
  col += vec3(0.3, 0.55, 0.8) * (gMin * 0.055 + gMaj * 0.14);

  // contours from the photograph
  vec2 s = vec2(1.0 / uRect.z, 1.0 / uRect.w) * uStep;
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
  float strong = smoothstep(0.17, 0.5, mag);
  float faint = smoothstep(0.05, 0.15, mag) * 0.13;
  float scanY = uScan * 1.08 - 0.04;
  float shown = 1.0 - smoothstep(scanY - 0.004, scanY, q.y);
  col = mix(col, vec3(0.66, 0.85, 0.98), clamp(strong * 0.72 + faint, 0.0, 1.0) * shown);
  if (uScan < 1.08) {
    float dy = (q.y - scanY) * uSize.y;
    col += vec3(0.45, 0.8, 1.0) * (aline(abs(dy), 0.4) * 0.9 + exp(dy / 18.0) * step(dy, 0.0) * 0.12);
  }

  // rulers along the top and left edges
  float band = max(step(css.y, 16.0), step(css.x, 16.0));
  col = mix(col, vec3(0.02, 0.05, 0.085), band * 0.72);
  float tx = step(css.y, 16.0) * step(16.0, css.x);
  float ty = step(css.x, 16.0) * step(16.0, css.y);
  float majX = step(gridD(mm.x, uGrid.y, mmPerPx), 0.8);
  float majY = step(gridD(mm.y, uGrid.y, mmPerPx), 0.8);
  float tickX = aline(gridD(mm.x, uGrid.x, mmPerPx), 0.25) * step(16.0 - (majX > 0.5 ? 9.0 : 4.0), css.y);
  float tickY = aline(gridD(mm.y, uGrid.x, mmPerPx), 0.25) * step(16.0 - (majY > 0.5 ? 9.0 : 4.0), css.x);
  col += vec3(0.45, 0.68, 0.88) * (tx * tickX + ty * tickY) * 0.6;
  col += vec3(0.3, 0.5, 0.7) * (aline(abs(css.y - 16.0), 0.2) * step(16.0, css.x) + aline(abs(css.x - 16.0), 0.2) * step(16.0, css.y)) * 0.35;

  // the lens
  vec2 d = css - uLens.xy;
  float r = length(d);
  float R = uLens.z;
  if (uLensA > 0.001) {
    float shadow = smoothstep(R + 40.0, R + 10.0, r) * step(R, r);
    col *= 1.0 - 0.42 * shadow * uLensA;
    if (r < R) {
      vec2 k2 = d / R;
      float k = dot(k2, k2);
      float f = (1.0 + 0.34 * k) / uMag;
      vec2 cR = uLens.xy + d * f * (1.0 + 0.03 * k);
      vec2 cG = uLens.xy + d * f;
      vec2 cB = uLens.xy + d * f * (1.0 - 0.03 * k);
      vec3 ph = vec3(
        texture2D(uPhoto, (cR - uRect.xy) / uRect.zw).r,
        texture2D(uPhoto, (cG - uRect.xy) / uRect.zw).g,
        texture2D(uPhoto, (cB - uRect.xy) / uRect.zw).b);
      ph = mix(vec3(luma(ph)), ph, 0.88) * vec3(0.97, 1.0, 1.04);
      ph = (ph - 0.5) * 1.06 + 0.5;
      ph *= 1.0 - 0.38 * smoothstep(0.55, 1.0, sqrt(k));
      ph += vec3(0.6, 0.85, 1.0) * uPulse * 0.18 * (1.0 - sqrt(k));
      // reticle
      float ret = 0.0;
      ret += aline(abs(d.x), 0.25) * step(10.0, abs(d.y));
      ret += aline(abs(d.y), 0.25) * step(10.0, abs(d.x));
      float sp = uGrid.x / mmPerPx * uMag;
      float spM = uGrid.y / mmPerPx * uMag;
      float tkx = aline(abs(fract(d.x / sp + 0.5) - 0.5) * sp, 0.25) * step(abs(d.y), 3.0);
      float tky = aline(abs(fract(d.y / sp + 0.5) - 0.5) * sp, 0.25) * step(abs(d.x), 3.0);
      float tkX = aline(abs(fract(d.x / spM + 0.5) - 0.5) * spM, 0.3) * step(abs(d.y), 7.0);
      float tkY = aline(abs(fract(d.y / spM + 0.5) - 0.5) * spM, 0.3) * step(abs(d.x), 7.0);
      ret += (tkx + tky + tkX + tkY) * step(12.0, r);
      ret += aline(abs(r - 4.5), 0.3);
      ph = mix(ph, vec3(0.92, 0.98, 1.0), clamp(ret, 0.0, 1.0) * 0.72);
      col = mix(col, ph, uLensA);
    }
    // bezel with angular graduations
    if (r >= R && r < R + 11.0) {
      vec3 bez = vec3(0.02, 0.055, 0.09);
      float ang = atan(d.y, d.x) / 6.2831853 * 72.0;
      float along = abs(fract(ang + 0.5) - 0.5) * 6.2831853 * r / 72.0;
      float big = step(abs(fract(ang / 6.0 + 0.5) - 0.5) * 6.0, 0.5);
      float tick = aline(along, 0.3) * step(r, R + (big > 0.5 ? 8.0 : 4.0));
      bez += vec3(0.55, 0.78, 0.95) * tick * 0.8;
      col = mix(col, bez, 0.82 * uLensA);
    }
    col += vec3(0.75, 0.92, 1.0) * aline(abs(r - R), 0.45) * 0.9 * uLensA;
    col += vec3(0.4, 0.62, 0.8) * aline(abs(r - R - 11.0), 0.2) * 0.5 * uLensA;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

// millimetres across the full width of each photograph
const FIELD: Record<string, number> = {
  machine: 2100,
  engineer: 1600,
  architecture: 42000,
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const niceStep = (v: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
};
const fmt = (mm: number, big: boolean) =>
  big
    ? Math.round(mm).toLocaleString("en-US")
    : mm.toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });

const SVG = "http://www.w3.org/2000/svg";
const svgEl = (tag: string, attrs: Record<string, string | number>) => {
  const e = document.createElementNS(SVG, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
};
const add = (parent: Node, ...kids: Node[]) => {
  for (const k of kids) parent.appendChild(k);
};

const mount: Signature = (ctx) => {
  const { cover, reduced, narrow, embedded, fine } = ctx;
  const box = cover.querySelector<HTMLElement>(".nova-cover-photo");
  const photoEl = box?.querySelector<HTMLImageElement>(":scope > img");
  if (!box || !photoEl) return;
  const setState = (s: string | null) => {
    if (s) box.dataset.novaSig = s;
    else delete box.dataset.novaSig;
  };
  const canvas = document.createElement("canvas");
  canvas.className = "nova-sig-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const gl =
    (canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
    }) as WebGLRenderingContext | null) ??
    canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) {
    setState("off");
    return () => setState(null);
  }
  const isGL2 =
    typeof WebGL2RenderingContext !== "undefined" &&
    gl instanceof WebGL2RenderingContext;

  const svg = svgEl("svg", {
    class: "nova-sig-overlay",
    "aria-hidden": "true",
  });
  const rulerG = svgEl("g", { class: "ruler" });
  const measG = svgEl("g", { class: "meas" });
  const leader = svgEl("line", { class: "leader" });
  add(svg, rulerG, measG, leader);
  const readout = document.createElement("div");
  readout.className = "nova-sig-readout";
  readout.setAttribute("aria-hidden", "true");
  readout.innerHTML =
    '<span><b>X</b><output data-k="x">0.0</output></span>' +
    '<span><b>Y</b><output data-k="y">0.0</output></span>' +
    '<span class="u"><i>mm</i><em>×2.5</em></span>';
  const outX = readout.querySelector<HTMLOutputElement>('[data-k="x"]');
  const outY = readout.querySelector<HTMLOutputElement>('[data-k="y"]');
  const hint = document.createElement("p");
  hint.className = "nova-sig-hint";
  const HINT0 = fine
    ? "クリックで2点間の寸法を測れます"
    : "タップで計測／レンズはドラッグで移動";
  hint.textContent = HINT0;
  add(box, canvas, svg, readout, hint);
  setState("live");

  // ---- GL
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type) as WebGLShader;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.warn("[nova]", gl.getShaderInfoLog(s));
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
    size: U("uSize"),
    dpr: U("uDpr"),
    rect: U("uRect"),
    field: U("uField"),
    grid: U("uGrid"),
    lens: U("uLens"),
    mag: U("uMag"),
    lensA: U("uLensA"),
    scan: U("uScan"),
    pulse: U("uPulse"),
    bottom: U("uBottom"),
    step: U("uStep"),
  };
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    isGL2 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // ---- state
  const MAG = 2.5;
  let disposed = false;
  let ready = false;
  let visible = true;
  let raf = 0;
  let last = 0;
  let W = 1;
  let H = 1;
  let imgW = 1400;
  let imgH = 1050;
  let fieldW = FIELD.machine;
  let big = false;
  let rect = [0, 0, 1, 1];
  let grid = [10, 50];
  let R = 100;
  let bottomBar = 0;
  let scanStart = -1;
  let scan = 0;
  let lensA = 0;
  let pulse = 0;
  const pos = { x: 0, y: 0 };
  const vel = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let lastInput = -1e9;
  let hovering = false;
  let dragging = false;
  let clock = 0;
  const points: { x: number; y: number }[] = [];

  const toMM = (x: number, y: number) => ({
    x: ((x - rect[0]) / rect[2]) * fieldW,
    y: ((y - rect[1]) / rect[2]) * fieldW,
  });
  const toCss = (p: { x: number; y: number }) => ({
    x: rect[0] + (p.x / fieldW) * rect[2],
    y: rect[1] + (p.y / fieldW) * rect[2],
  });
  const bounds = () => ({
    x0: 16 + R * 0.35,
    x1: W - R * 0.35,
    y0: 16 + R * 0.35,
    y1: H - bottomBar - R * 0.35,
  });

  const layout = () => {
    W = Math.max(1, box.clientWidth);
    H = Math.max(1, box.clientHeight);
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      embedded ? 1.25 : narrow ? 1.75 : 2,
    );
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const s = Math.max(W / imgW, H / imgH);
    const dw = imgW * s;
    const dh = imgH * s;
    const op = getComputedStyle(photoEl).objectPosition.split(" ");
    const f = (v: string | undefined) =>
      v && v.endsWith("%") ? parseFloat(v) / 100 : 0.5;
    rect = [(W - dw) * f(op[0]), (H - dh) * f(op[1] ?? op[0]), dw, dh];
    const mmPerPx = fieldW / dw;
    const minor = niceStep(mmPerPx * (narrow ? 12 : 14));
    grid = [minor, minor * 5];
    R = clamp(Math.min(W, H) * 0.2, 54, 118);
    bottomBar =
      box.querySelector<HTMLElement>(".hero-photo-select")?.offsetHeight ?? 0;
    if (!pos.x) {
      pos.x = target.x = W * 0.56;
      pos.y = target.y = (H - bottomBar) * 0.5;
    }
    drawRuler();
    drawMeasure(false);
    request();
  };

  const drawRuler = () => {
    rulerG.replaceChildren();
    const major = grid[1];
    const pxPer = rect[2] / fieldW;
    let every = major;
    while (every * pxPer < (narrow ? 56 : 64)) every += major;
    const lab = (x: number, y: number, s: string, cls: string) => {
      const t = svgEl("text", { x, y, class: cls });
      t.textContent = s;
      add(rulerG, t);
    };
    for (let m = 0; m <= fieldW; m += every) {
      const x = rect[0] + m * pxPer;
      if (x > 28 && x < W - 20) lab(x + 3, 9, fmt(m, true), "rx");
    }
    const fieldH = (fieldW * imgH) / imgW;
    for (let m = 0; m <= fieldH; m += every) {
      const y = rect[1] + m * pxPer;
      if (y > 36 && y < H - bottomBar - 10) lab(9, y - 3, fmt(m, true), "ry");
    }
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  };

  const drawMeasure = (animate: boolean) => {
    measG.replaceChildren();
    points.forEach((p, i) => {
      const c = toCss(p);
      const g = svgEl("g", {
        class: "pt",
        transform: `translate(${c.x} ${c.y})`,
      });
      add(
        g,
        svgEl("circle", { r: 5 }),
        svgEl("line", { x1: -11, y1: 0, x2: -6, y2: 0 }),
        svgEl("line", { x1: 6, y1: 0, x2: 11, y2: 0 }),
        svgEl("line", { x1: 0, y1: -11, x2: 0, y2: -6 }),
        svgEl("line", { x1: 0, y1: 6, x2: 0, y2: 11 }),
      );
      const t = svgEl("text", { x: 9, y: -9, class: "pt-t" });
      t.textContent = `P${i + 1}`;
      add(g, t);
      add(measG, g);
    });
    if (points.length < 2) return;
    const a = toCss(points[0]);
    const b = toCss(points[1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 4) return;
    const nx = -dy / len;
    const ny = dx / len;
    const off = 22;
    const a2 = { x: a.x + nx * off, y: a.y + ny * off };
    const b2 = { x: b.x + nx * off, y: b.y + ny * off };
    const g = svgEl("g", { class: "dimline" });
    add(
      g,
      svgEl("line", {
        x1: a.x + nx * 4,
        y1: a.y + ny * 4,
        x2: a2.x + nx * 6,
        y2: a2.y + ny * 6,
        class: "ext",
      }),
      svgEl("line", {
        x1: b.x + nx * 4,
        y1: b.y + ny * 4,
        x2: b2.x + nx * 6,
        y2: b2.y + ny * 6,
        class: "ext",
      }),
    );
    const main = svgEl("line", {
      x1: a2.x,
      y1: a2.y,
      x2: b2.x,
      y2: b2.y,
      class: "main",
    });
    add(g, main);
    const ux = dx / len;
    const uy = dy / len;
    for (const [p, sgn] of [
      [a2, 1],
      [b2, -1],
    ] as const) {
      add(
        g,
        svgEl("path", {
          class: "arrow",
          d: `M${p.x} ${p.y} L${p.x + sgn * (ux * 9 + nx * 3)} ${p.y + sgn * (uy * 9 + ny * 3)} L${p.x + sgn * (ux * 9 - nx * 3)} ${p.y + sgn * (uy * 9 - ny * 3)} Z`,
        }),
      );
    }
    const mm = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang > 90) ang -= 180;
    if (ang < -90) ang += 180;
    const mx = (a2.x + b2.x) / 2 + nx * 4;
    const my = (a2.y + b2.y) / 2 + ny * 4;
    const label = svgEl("g", {
      class: "val",
      transform: `translate(${mx} ${my}) rotate(${ang})`,
    });
    const text = `${fmt(mm, big)} mm`;
    const tw = text.length * 6.6 + 14;
    add(
      label,
      svgEl("rect", { x: -tw / 2, y: -17, width: tw, height: 17, rx: 1 }),
    );
    const t = svgEl("text", { x: 0, y: -5, "text-anchor": "middle" });
    t.textContent = text;
    add(label, t);
    add(g, label);
    add(measG, g);
    if (animate) {
      main.setAttribute("stroke-dasharray", `${len}`);
      main.setAttribute("stroke-dashoffset", `${len}`);
      label.style.opacity = "0";
      requestAnimationFrame(() => {
        main.style.transition =
          "stroke-dashoffset .55s cubic-bezier(.2,.7,.2,1)";
        main.setAttribute("stroke-dashoffset", "0");
        label.style.transition = "opacity .4s ease .35s";
        label.style.opacity = "1";
      });
    }
  };

  const measureAt = (x: number, y: number) => {
    const p = toMM(x, y);
    points.push(p);
    while (points.length > 2) points.shift();
    pulse = 1;
    drawMeasure(points.length === 2);
    hint.textContent =
      points.length === 1
        ? fine
          ? "もう1点をクリックしてください"
          : "もう1点をタップしてください"
        : HINT0;
    request();
  };

  const request = () => {
    if (!raf && !disposed) raf = requestAnimationFrame(frame);
  };

  const frame = (now: number) => {
    raf = 0;
    if (disposed || !ready) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    clock += dt;
    let busy = false;
    if (scanStart < 0) scanStart = now;
    scan = reduced ? 2 : (now - scanStart) / 1500;
    if (scan < 1.1) busy = true;
    const lensTarget = scan > 0.7 ? 1 : 0;
    if (reduced) lensA = lensTarget;
    else if (Math.abs(lensA - lensTarget) > 0.001) {
      lensA += (lensTarget - lensA) * (1 - Math.exp(-dt * 6));
      busy = true;
    } else lensA = lensTarget;

    const b = bounds();
    const idle =
      !dragging &&
      (!hovering || now - lastInput > 2600) &&
      now - lastInput > 1400;
    if (idle && !reduced) {
      // slow inspection pass along a lissajous path
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      target.x = cx + ((b.x1 - b.x0) / 2) * 0.82 * Math.sin(clock * 0.21);
      target.y = cy + ((b.y1 - b.y0) / 2) * 0.78 * Math.sin(clock * 0.34 + 0.9);
    }
    target.x = clamp(target.x, b.x0, b.x1);
    target.y = clamp(target.y, b.y0, b.y1);
    if (reduced) {
      pos.x = target.x;
      pos.y = target.y;
    } else {
      const k = idle ? 14 : 70;
      const c = 2 * Math.sqrt(k) * 0.82;
      vel.x += ((target.x - pos.x) * k - vel.x * c) * dt;
      vel.y += ((target.y - pos.y) * k - vel.y * c) * dt;
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      if (
        idle ||
        Math.hypot(vel.x, vel.y) > 0.5 ||
        Math.hypot(target.x - pos.x, target.y - pos.y) > 0.3
      )
        busy = true;
    }
    if (pulse > 0) {
      pulse = Math.max(0, pulse - dt * 2.2);
      busy = true;
    }
    updateReadout();
    if (visible) render();
    if (busy && visible && !document.hidden) request();
    else last = 0;
  };

  let lastTxt = "";
  const updateReadout = () => {
    const m = toMM(pos.x, pos.y);
    const tx = fmt(Math.max(0, m.x), big);
    const ty = fmt(Math.max(0, m.y), big);
    if (tx + ty !== lastTxt && outX && outY) {
      outX.value = tx;
      outY.value = ty;
      lastTxt = tx + ty;
    }
    const rw = readout.offsetWidth || 96;
    const rh = readout.offsetHeight || 48;
    const flipX = pos.x + R * 0.72 + rw + 28 > W;
    const flipY = pos.y - R * 0.72 - rh - 8 < (narrow ? 54 : 18);
    const ax = pos.x + (flipX ? -1 : 1) * R * 0.707;
    const ay = pos.y + (flipY ? 1 : -1) * R * 0.707;
    const lx = ax + (flipX ? -1 : 1) * 16;
    const ly = ay + (flipY ? 1 : -1) * 16;
    readout.style.transform = `translate(${(flipX ? lx - rw : lx).toFixed(1)}px, ${(flipY ? ly : ly - rh).toFixed(1)}px)`;
    readout.style.opacity = String(lensA);
    leader.setAttribute("x1", (ax + (flipX ? -1 : 1) * 8).toFixed(1));
    leader.setAttribute("y1", (ay + (flipY ? 1 : -1) * 8).toFixed(1));
    leader.setAttribute("x2", lx.toFixed(1));
    leader.setAttribute("y2", ly.toFixed(1));
    leader.style.opacity = String(lensA * 0.8);
  };

  const render = () => {
    if (!ok) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(u.photo, 0);
    gl.uniform2f(u.size, W, H);
    gl.uniform1f(u.dpr, canvas.width / W);
    gl.uniform4f(u.rect, rect[0], rect[1], rect[2], rect[3]);
    gl.uniform2f(u.field, fieldW, (fieldW * imgH) / imgW);
    gl.uniform2f(u.grid, grid[0], grid[1]);
    gl.uniform3f(u.lens, pos.x, pos.y, R);
    gl.uniform1f(u.mag, MAG);
    gl.uniform1f(u.lensA, lensA);
    gl.uniform1f(u.scan, Math.min(scan, 2));
    gl.uniform1f(u.pulse, pulse);
    gl.uniform1f(u.bottom, bottomBar);
    gl.uniform1f(u.step, narrow ? 0.9 : 1.35);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // ---- image (the React selector swaps the src)
  let loadId = 0;
  const load = () => {
    const src = photoEl.currentSrc || photoEl.src;
    const id = ++loadId;
    const img = new Image();
    img.src = src;
    img
      .decode()
      .then(() => {
        if (disposed || id !== loadId || !ok) return;
        imgW = img.naturalWidth;
        imgH = img.naturalHeight;
        const name = (src.split("/").pop() ?? "").replace(/\.\w+$/, "");
        fieldW = FIELD[name] ?? 2000;
        big = fieldW > 5000;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          img,
        );
        if (isGL2) gl.generateMipmap(gl.TEXTURE_2D);
        points.length = 0;
        hint.textContent = HINT0;
        scanStart = -1;
        ready = true;
        box.dataset.novaReady = "";
        layout();
      })
      .catch(() => fail());
  };
  const mo = new MutationObserver(() => load());
  mo.observe(photoEl, { attributes: true, attributeFilter: ["src"] });

  // ---- input
  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.getBoundingClientRect();
    const sx = r.width / W || 1;
    return { x: (e.clientX - r.left) / sx, y: (e.clientY - r.top) / sx };
  };
  const onUI = (t: EventTarget | null) =>
    t instanceof Element && !!t.closest(".hero-photo-select, a, button");
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" || onUI(e.target)) return;
    const p = local(e);
    hovering = true;
    target.x = p.x;
    target.y = p.y;
    lastInput = performance.now();
    request();
  };
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    hovering = false;
    request();
  };
  let touch: {
    id: number;
    x: number;
    y: number;
    t: number;
    moved: boolean;
    inLens: boolean;
  } | null = null;
  const onTouchStart = (e: TouchEvent) => {
    if (onUI(e.target) || e.touches.length !== 1) return;
    const t = e.touches[0];
    const p = local(t);
    const inLens = Math.hypot(p.x - pos.x, p.y - pos.y) < R * 1.15;
    touch = {
      id: t.identifier,
      x: p.x,
      y: p.y,
      t: performance.now(),
      moved: false,
      inLens,
    };
    if (inLens) {
      e.preventDefault();
      dragging = true;
      lastInput = performance.now();
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!touch) return;
    const t = Array.from(e.changedTouches).find(
      (x) => x.identifier === touch?.id,
    );
    if (!t) return;
    const p = local(t);
    if (Math.hypot(p.x - touch.x, p.y - touch.y) > 6) touch.moved = true;
    if (touch.inLens) {
      e.preventDefault();
      target.x = p.x;
      target.y = p.y;
      lastInput = performance.now();
      request();
    }
  };
  const onTouchEnd = () => {
    if (!touch) return;
    const tap = !touch.moved && performance.now() - touch.t < 400;
    if (tap) {
      target.x = touch.x;
      target.y = touch.y;
      measureAt(touch.x, touch.y);
    }
    dragging = false;
    lastInput = performance.now();
    touch = null;
    request();
  };
  const onClick = (e: MouseEvent) => {
    if (onUI(e.target) || !ready) return;
    // touch taps are handled in touchend
    if ((e as PointerEvent).pointerType === "touch" || touchedRecently())
      return;
    const p = local(e);
    target.x = p.x;
    target.y = p.y;
    lastInput = performance.now();
    measureAt(p.x, p.y);
  };
  let lastTouch = 0;
  const markTouch = () => (lastTouch = performance.now());
  const touchedRecently = () => performance.now() - lastTouch < 800;
  box.addEventListener("pointermove", onMove);
  box.addEventListener("pointerleave", onLeave);
  box.addEventListener("click", onClick);
  box.addEventListener("touchstart", markTouch, { passive: true });
  box.addEventListener("touchstart", onTouchStart, { passive: false });
  box.addEventListener("touchmove", onTouchMove, { passive: false });
  box.addEventListener("touchend", onTouchEnd);
  box.addEventListener("touchcancel", onTouchEnd);

  // ---- lifecycle
  const io = new IntersectionObserver((es) => {
    visible = es[es.length - 1].isIntersecting;
    if (visible) request();
  });
  io.observe(box);
  const onVis = () => {
    if (!document.hidden) request();
  };
  document.addEventListener("visibilitychange", onVis);
  const ro = new ResizeObserver(() => ready && layout());
  ro.observe(box);
  const fail = () => {
    ok = false;
    setState("off");
    canvas.remove();
    svg.remove();
    readout.remove();
    hint.remove();
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    fail();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  if (!ok) fail();
  else load();

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    mo.disconnect();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    box.removeEventListener("pointermove", onMove);
    box.removeEventListener("pointerleave", onLeave);
    box.removeEventListener("click", onClick);
    box.removeEventListener("touchstart", markTouch);
    box.removeEventListener("touchstart", onTouchStart);
    box.removeEventListener("touchmove", onTouchMove);
    box.removeEventListener("touchend", onTouchEnd);
    box.removeEventListener("touchcancel", onTouchEnd);
    canvas.removeEventListener("webglcontextlost", onLost);
    gl.deleteTexture(tex);
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
    svg.remove();
    readout.remove();
    hint.remove();
    setState(null);
    delete box.dataset.novaReady;
  };
};

export default mount;
