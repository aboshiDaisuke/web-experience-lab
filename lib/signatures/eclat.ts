import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Signature } from './types';

/*
 * MAISON ÉCLAT — "hand-stitched page".
 * A saddle-stitch seam is sewn down the page as the visitor scrolls: first an
 * edge stitch around the product panel in the hero, then along the page margin,
 * finishing in a knot above the closing section. Holes are pricked ahead of the
 * needle; every stitch is pulled tight as it lands. The bag itself is cut out
 * of its photograph so it can turn toward the pointer on its own.
 */

type Hole = { x: number; y: number; tx: number; ty: number };
type Rgb = [number, number, number];

const THREADS: { body: Rgb; hi: Rgb }[] = [
  { body: [170, 116, 66], hi: [231, 192, 142] }, // camel
  { body: [83, 58, 44], hi: [150, 118, 96] }, // dark brown
  { body: [110, 106, 72], hi: [178, 173, 132] }, // olive
];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rgb = (c: Rgb, a = 1) =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/* ------------------------------------------------------------------ */
/* seam geometry                                                       */
/* ------------------------------------------------------------------ */

class Poly {
  xs: number[] = [];
  ys: number[] = [];
  cum: number[] = [];
  private push(x: number, y: number) {
    const n = this.xs.length;
    if (n) {
      const d = Math.hypot(x - this.xs[n - 1], y - this.ys[n - 1]);
      if (d < 0.01) return;
      this.cum.push(this.cum[n - 1] + d);
    } else this.cum.push(0);
    this.xs.push(x);
    this.ys.push(y);
  }
  line(x0: number, y0: number, x1: number, y1: number) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3));
    for (let i = 0; i <= n; i++)
      this.push(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
  }
  arc(cx: number, cy: number, r: number, a0: number, a1: number) {
    const n = Math.max(4, Math.ceil((Math.abs(a1 - a0) * r) / 2));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      this.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  }
  cubic(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
  ) {
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      this.push(
        u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      );
    }
  }
  get length() {
    return this.cum[this.cum.length - 1] ?? 0;
  }
  /** point + unit tangent at arc length s */
  at(s: number): Hole {
    const c = this.cum;
    const n = c.length;
    s = clamp(s, 0, c[n - 1]);
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (c[m] < s) lo = m;
      else hi = m;
    }
    const seg = c[hi] - c[lo] || 1;
    const t = (s - c[lo]) / seg;
    const dx = this.xs[hi] - this.xs[lo];
    const dy = this.ys[hi] - this.ys[lo];
    const d = Math.hypot(dx, dy) || 1;
    return {
      x: this.xs[lo] + dx * t,
      y: this.ys[lo] + dy * t,
      tx: dx / d,
      ty: dy / d,
    };
  }
}

type Seam = {
  poly: Poly;
  holes: Hole[];
  pitch: number;
  loopLen: number;
  loopPath: Path2D | null;
  total: number;
  /** after the loop: arc length → running max y, for scroll following */
  followS: number[];
  followY: number[];
};

function docRect(el: Element) {
  const r = el.getBoundingClientRect();
  return {
    l: r.left + scrollX,
    t: r.top + scrollY,
    r: r.right + scrollX,
    b: r.bottom + scrollY,
    w: r.width,
    h: r.height,
  };
}

function productRect(img: HTMLImageElement) {
  const b = docRect(img);
  const nw = img.naturalWidth || 1400;
  const nh = img.naturalHeight || 1633;
  const s = Math.min(b.w / nw, b.h / nh);
  const w = nw * s;
  const h = nh * s;
  const l = b.l + (b.w - w) / 2;
  const t = b.t + (b.h - h) / 2;
  return { l, t, r: l + w, b: t + h, w, h };
}

function buildSeam(
  root: HTMLElement,
  cover: HTMLElement,
  img: HTMLImageElement,
  narrow: boolean,
): Seam {
  const poly = new Poly();
  const vw = document.documentElement.clientWidth;
  const R = productRect(img);
  const ins = narrow ? 10 : 15;
  const rad = narrow ? 8 : 11;
  const L = R.l + ins;
  const T = R.t + ins;
  const Rr = R.r - ins;
  const B = R.b - ins;
  const hero = docRect(cover);
  const mx = narrow ? 12 : clamp(vw * 0.036, 24, 58);

  // edge stitch around the product panel (clockwise, from the lower left)
  poly.line(L, B - rad, L, T + rad);
  poly.arc(L + rad, T + rad, rad, Math.PI, Math.PI * 1.5);
  poly.line(L + rad, T, Rr - rad, T);
  poly.arc(Rr - rad, T + rad, rad, -Math.PI / 2, 0);
  poly.line(Rr, T + rad, Rr, B - rad);
  poly.arc(Rr - rad, B - rad, rad, 0, Math.PI / 2);
  poly.line(Rr - rad, B, L + rad, B);
  const loopLen = poly.length;
  const loopPath = new Path2D();
  for (let i = 0; i < poly.xs.length; i++)
    if (i) loopPath.lineTo(poly.xs[i], poly.ys[i]);
    else loopPath.moveTo(poly.xs[i], poly.ys[i]);

  // leave the panel and find the margin
  const x0 = L + rad;
  let y3: number;
  if (narrow) {
    y3 = B + 80;
    poly.cubic(x0, B, x0 - 40, B + 4, mx, B + 14, mx, y3);
  } else {
    y3 = hero.b + 240;
    poly.cubic(x0, B, x0 - 150, B + 26, mx + 30, y3 - 230, mx, y3);
  }

  // down the margin, a hand-guided line rather than a ruler
  const closing = root.querySelector('.brand-closing');
  const yEnd = closing
    ? docRect(closing).t - (narrow ? 44 : 70)
    : docRect(root).b - 120;
  const amp = narrow ? 2.6 : 9;
  for (let y = y3; y <= yEnd; y += 3) {
    const k = y - y3;
    const ramp = clamp(k / 260);
    const env = ramp * ramp * (3 - 2 * ramp);
    const x =
      mx +
      env *
        (amp * Math.sin((k / 820) * Math.PI * 2) +
          amp * 0.35 * Math.sin((k / 310) * Math.PI * 2 + 1.3));
    poly.line(poly.xs[poly.xs.length - 1], poly.ys[poly.ys.length - 1], x, y);
  }

  const pitch = narrow ? 7.5 : 9.5;
  const total = poly.length;
  const holes: Hole[] = [];
  for (let s = 0; s <= total; s += pitch) holes.push(poly.at(s));

  const followS: number[] = [];
  const followY: number[] = [];
  let maxY = -Infinity;
  for (let i = 0; i < poly.cum.length; i++) {
    if (poly.cum[i] < loopLen) continue;
    maxY = Math.max(maxY, poly.ys[i]);
    followS.push(poly.cum[i]);
    followY.push(maxY);
  }
  return {
    poly,
    holes,
    pitch,
    loopLen,
    loopPath,
    total,
    followS,
    followY,
  };
}

/* ------------------------------------------------------------------ */
/* the bag, cut from its photograph                                     */
/* ------------------------------------------------------------------ */

async function cutOut(img: HTMLImageElement) {
  if (!img.complete || !img.naturalWidth) await img.decode();
  const k = Math.min(1, 1000 / img.naturalHeight);
  const w = Math.round(img.naturalWidth * k);
  const h = Math.round(img.naturalHeight * k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const a = Math.max(
      clamp(((mx - mn) / 255 - 0.03) / 0.05),
      clamp((0.915 - lum) / 0.07),
    );
    d[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(data, 0, 0);
  const url = await new Promise<string>((res) =>
    c.toBlob((b) => res(b ? URL.createObjectURL(b) : ''), 'image/png'),
  );
  return { canvas: c, url, w, h };
}

/* ------------------------------------------------------------------ */

const mount: Signature = ({ root, cover, reduced, narrow, fine }) => {
  gsap.registerPlugin(ScrollTrigger);
  const product = cover.querySelector<HTMLElement>('.eclat-product');
  const img = product?.querySelector<HTMLImageElement>('img');
  if (!product || !img) return;
  let disposed = false;
  const disposers: (() => void)[] = [];

  /* ---------------- seam canvas ---------------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'ecl-seam';
  canvas.setAttribute('aria-hidden', 'true');
  root.appendChild(canvas);
  disposers.push(() => canvas.remove());
  const ctx = canvas.getContext('2d')!;
  let dpr = 1;
  let vw = 0;
  let vh = 0;
  const sizeCanvas = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    vw = document.documentElement.clientWidth;
    vh = innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
  };
  sizeCanvas();

  let seam: Seam | null = null;
  let sewnAt: Float64Array = new Float64Array(0);
  let sewn = 0;
  const state = { s: 0, intro: reduced ? 1 : 0 };
  let maxScroll = 1;
  let thread = THREADS[0];
  const cur = { body: [...THREADS[0].body] as Rgb, hi: [...THREADS[0].hi] as Rgb };

  const rebuild = () => {
    if (!img.naturalWidth) return;
    seam = buildSeam(root, cover, img, narrow);
    sewnAt = new Float64Array(seam.holes.length).fill(-1);
    sewn = 0;
    maxScroll = Math.max(
      1,
      document.documentElement.scrollHeight - innerHeight,
    );
    request();
  };

  const lenFor = (s: number) => {
    if (!seam) return 0;
    if (reduced) return seam.total;
    const L0 = seam.loopLen * 0.16;
    const sA = Math.max(1, Math.min(vh * 0.5, maxScroll * 0.3));
    let len: number;
    if (s <= sA) len = L0 + ((seam.loopLen - L0) * s) / sA;
    else {
      const { followS, followY } = seam;
      const y0 = followY[0];
      const y1 = followY[followY.length - 1];
      const target =
        y0 + ((y1 - y0) * (s - sA)) / Math.max(1, maxScroll - sA - 2);
      let lo = 0;
      let hi = followY.length - 1;
      if (target >= y1) return seam.total;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (followY[m] < target) lo = m;
        else hi = m;
      }
      len = followS[hi];
    }
    return Math.max(0, len - L0 * (1 - state.intro));
  };

  /* ---------------- drawing ---------------- */
  let raf = 0;
  const request = () => {
    if (!raf && !disposed) raf = requestAnimationFrame(draw);
  };
  disposers.push(() => cancelAnimationFrame(raf));

  const settle = (a: number) => 1 - Math.exp(-6.5 * a) * Math.cos(9.5 * a);

  function draw(now: number) {
    raf = 0;
    if (!seam) return;
    let again = false;
    // thread colour follows the leather
    for (const key of ['body', 'hi'] as const)
      for (let i = 0; i < 3; i++) {
        const d = thread[key][i] - cur[key][i];
        if (Math.abs(d) > 0.5) {
          cur[key][i] += d * 0.12;
          again = true;
        } else cur[key][i] = thread[key][i];
      }

    const len = lenFor(state.s);
    const { holes, pitch, poly } = seam;
    const next = Math.min(holes.length - 1, Math.max(0, Math.floor(len / pitch)));
    if (next > sewn) {
      const jump = next - sewn;
      for (let k = sewn; k < next; k++)
        sewnAt[k] = reduced || jump > 60 ? now - 1e4 : now - (next - 1 - k) * 18;
    } else if (next < sewn) {
      for (let k = next; k < sewn; k++) sewnAt[k] = -1;
    }
    sewn = next;

    const sy = scrollY;
    const sx = scrollX;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, -sx * dpr, -sy * dpr);
    const top = sy - 30;
    const bot = sy + vh + 30;
    const vis = (h: Hole) => h.y > top && h.y < bot;

    // the creased channel on the product panel
    if (seam.loopPath && holes[0].y < bot) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(92, 64, 40, 0.1)';
      ctx.lineWidth = 4.2;
      ctx.stroke(seam.loopPath);
      ctx.save();
      ctx.translate(0.7, 1);
      ctx.strokeStyle = 'rgba(255, 252, 245, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke(seam.loopPath);
      ctx.restore();
    }

    // pricked holes waiting ahead of the needle
    const ahead = narrow ? 38 : 56;
    ctx.fillStyle = 'rgba(66, 44, 26, 0.55)';
    for (let k = sewn + 1; k < Math.min(holes.length, sewn + ahead); k++) {
      const h = holes[k];
      if (!vis(h)) continue;
      const f = 1 - (k - sewn) / ahead;
      ctx.globalAlpha = f * f * 0.9 + 0.1 * f;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, 1.35, 0.8, Math.atan2(h.ty, h.tx) + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // stitches
    const sl = narrow ? 1.5 : 2;
    const w = narrow ? 2 : 2.5;
    const inset = pitch * 0.16;
    const settled = new Path2D();
    const shadow = new Path2D();
    const lively: { k: number; e: number }[] = [];
    for (let k = 0; k < sewn; k++) {
      const a = holes[k];
      const b = holes[k + 1];
      if (!vis(a) && !vis(b)) continue;
      const age = sewnAt[k] < 0 ? 1 : (now - sewnAt[k]) / 340;
      if (age < 0) {
        again = true;
        continue;
      }
      if (age < 1) {
        lively.push({ k, e: settle(age) });
        again = true;
        continue;
      }
      const nx = -a.ty;
      const ny = a.tx;
      const x0 = a.x + a.tx * inset + nx * sl;
      const y0 = a.y + a.ty * inset + ny * sl;
      const x1 = b.x - b.tx * inset - nx * sl;
      const y1 = b.y - b.ty * inset - ny * sl;
      settled.moveTo(x0, y0);
      settled.lineTo(x1, y1);
      shadow.moveTo(x0 + 0.5, y0 + 0.9);
      shadow.lineTo(x1 + 0.5, y1 + 0.9);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(48, 30, 16, 0.3)';
    ctx.lineWidth = w + 0.9;
    ctx.stroke(shadow);
    ctx.strokeStyle = rgb(cur.body);
    ctx.lineWidth = w;
    ctx.stroke(settled);
    ctx.save();
    ctx.translate(-0.35, -0.55);
    ctx.strokeStyle = rgb(cur.hi, 0.75);
    ctx.lineWidth = w * 0.34;
    ctx.stroke(settled);
    ctx.restore();

    // stitches still being pulled tight
    for (const { k, e } of lively) {
      const a = holes[k];
      const b = holes[k + 1];
      const nx = -a.ty;
      const ny = a.tx;
      const loose = 1 - e;
      const x0 = a.x + a.tx * inset + nx * sl;
      const y0 = a.y + a.ty * inset + ny * sl;
      const x1 = b.x - b.tx * inset - nx * sl;
      const y1 = b.y - b.ty * inset - ny * sl;
      const cx = (x0 + x1) / 2 - nx * loose * 4.5 - a.tx * loose * 1.5;
      const cy = (y0 + y1) / 2 - ny * loose * 4.5 - a.ty * loose * 1.5;
      ctx.globalAlpha = clamp(e * 2.2);
      ctx.lineWidth = w * (1 + loose * 0.25);
      ctx.strokeStyle = 'rgba(48, 30, 16, 0.3)';
      ctx.beginPath();
      ctx.moveTo(x0 + 0.5, y0 + 0.9 + loose * 2);
      ctx.quadraticCurveTo(cx + 0.5, cy + 0.9 + loose * 3, x1 + 0.5, y1 + 0.9 + loose * 2);
      ctx.stroke();
      ctx.strokeStyle = rgb(cur.body);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
      ctx.strokeStyle = rgb(cur.hi, 0.75);
      ctx.lineWidth = w * 0.34;
      ctx.beginPath();
      ctx.moveTo(x0 - 0.35, y0 - 0.55);
      ctx.quadraticCurveTo(cx - 0.35, cy - 0.55, x1 - 0.35, y1 - 0.55);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const done = len >= seam.total - pitch;
    if (!done && !reduced) {
      // working thread from the last stitch to the needle's eye
      const p = poly.at(len);
      const last = holes[sewn];
      const nx = -p.ty;
      const ny = p.tx;
      const phase = (len % pitch) / pitch;
      const dip = Math.sin(phase * Math.PI);
      const nl = narrow ? 34 : 50;
      const tipX = p.x + p.tx * (nl * 0.3);
      const tipY = p.y + p.ty * (nl * 0.3);
      const eyeX = p.x - p.tx * nl * 0.7 + nx * (4 + dip * 2);
      const eyeY = p.y - p.ty * nl * 0.7 + ny * (4 + dip * 2) - 3;
      if (p.y > top - 60 && p.y < bot + 60) {
        ctx.strokeStyle = rgb(cur.body);
        ctx.lineWidth = w * 0.72;
        ctx.beginPath();
        ctx.moveTo(last.x - nx * sl, last.y - ny * sl);
        ctx.quadraticCurveTo(
          (last.x + eyeX) / 2 + nx * 7,
          (last.y + eyeY) / 2 + ny * 7 + 5,
          eyeX,
          eyeY,
        );
        ctx.stroke();
        // needle
        ctx.save();
        ctx.shadowColor = 'rgba(40, 26, 14, 0.3)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3 + dip;
        const g = ctx.createLinearGradient(
          p.x - nx * 1.4,
          p.y - ny * 1.4,
          p.x + nx * 1.4,
          p.y + ny * 1.4,
        );
        g.addColorStop(0, '#6e7276');
        g.addColorStop(0.45, '#eef0f1');
        g.addColorStop(1, '#8b9095');
        ctx.fillStyle = g;
        const ex = eyeX - p.tx * 3;
        const ey = eyeY - p.ty * 3;
        const dx = tipX - ex;
        const dy = tipY - ey;
        const dl = Math.hypot(dx, dy) || 1;
        const ux = dx / dl;
        const uy = dy / dl;
        const vx = -uy;
        const vy = ux;
        const hw = narrow ? 1.1 : 1.45;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(ex + ux * dl * 0.35 + vx * hw, ey + uy * dl * 0.35 + vy * hw);
        ctx.lineTo(ex + vx * hw, ey + vy * hw);
        ctx.arc(ex, ey, hw, Math.atan2(vy, vx), Math.atan2(vy, vx) + Math.PI);
        ctx.lineTo(ex + ux * dl * 0.35 - vx * hw, ey + uy * dl * 0.35 - vy * hw);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // the eye
        ctx.fillStyle = 'rgba(245, 242, 235, 0.95)';
        ctx.beginPath();
        ctx.ellipse(
          ex + ux * 3.2,
          ey + uy * 3.2,
          2,
          0.45,
          Math.atan2(uy, ux),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else if (done) {
      // tied off: a small knot and two trimmed tails
      const end = holes[holes.length - 1];
      if (vis(end)) {
        const nx = -end.ty;
        ctx.strokeStyle = rgb(cur.body);
        ctx.lineWidth = w * 0.8;
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.quadraticCurveTo(end.x + nx * 6, end.y + 8, end.x + nx * 9 + 2, end.y + 15);
        ctx.moveTo(end.x, end.y);
        ctx.quadraticCurveTo(end.x - nx * 3, end.y + 9, end.x - nx * 2 + 3, end.y + 18);
        ctx.stroke();
        ctx.fillStyle = rgb(cur.body);
        ctx.beginPath();
        ctx.arc(end.x, end.y, w * 1.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgb(cur.hi, 0.7);
        ctx.beginPath();
        ctx.arc(end.x - 0.6, end.y - 0.7, w * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (again) request();
  }

  /* ---------------- scroll scrub ---------------- */
  const tween = gsap.to(state, {
    s: () => maxScroll,
    ease: 'none',
    scrollTrigger: {
      start: 0,
      end: 'max',
      scrub: reduced ? true : 0.9,
      invalidateOnRefresh: true,
    },
    onUpdate: request,
  });
  disposers.push(() => {
    tween.scrollTrigger?.kill();
    tween.kill();
  });
  let intro: gsap.core.Tween | null = null;
  if (!reduced) {
    intro = gsap.to(state, {
      intro: 1,
      duration: 2.4,
      delay: 0.6,
      ease: 'power1.inOut',
      onUpdate: request,
    });
    disposers.push(() => intro?.kill());
  }

  const onScroll = () => request();
  addEventListener('scroll', onScroll, { passive: true });
  disposers.push(() => removeEventListener('scroll', onScroll));

  let rebuildTimer = 0;
  const scheduleRebuild = () => {
    clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(() => {
      sizeCanvas();
      rebuild();
      ScrollTrigger.refresh();
      layoutStage();
    }, 120);
  };
  const ro = new ResizeObserver(scheduleRebuild);
  ro.observe(root);
  addEventListener('resize', scheduleRebuild);
  disposers.push(() => {
    ro.disconnect();
    removeEventListener('resize', scheduleRebuild);
    clearTimeout(rebuildTimer);
  });

  const readColor = () => {
    const m = /color-(\d)/.exec(cover.className);
    thread = THREADS[m ? +m[1] : 0] ?? THREADS[0];
    request();
  };
  readColor();
  const mo = new MutationObserver(readColor);
  mo.observe(cover, { attributes: true, attributeFilter: ['class'] });
  disposers.push(() => mo.disconnect());

  /* ---------------- the bag, on its own ---------------- */
  const stage = document.createElement('div');
  stage.className = 'ecl-stage';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML =
    '<i class="ecl-ground"></i><i class="ecl-grain"></i><div class="ecl-bag"><i class="ecl-sheen"></i></div>';
  const bag = stage.querySelector<HTMLElement>('.ecl-bag')!;
  const sheen = stage.querySelector<HTMLElement>('.ecl-sheen')!;
  let blobUrl = '';
  function layoutStage() {
    if (!stage.isConnected) return;
    const nw = img!.naturalWidth || 1400;
    const nh = img!.naturalHeight || 1633;
    const bw = img!.offsetWidth;
    const bh = img!.offsetHeight;
    const s = Math.min(bw / nw, bh / nh);
    Object.assign(stage.style, {
      left: `${img!.offsetLeft + (bw - nw * s) / 2}px`,
      top: `${img!.offsetTop + (bh - nh * s) / 2}px`,
      width: `${nw * s}px`,
      height: `${nh * s}px`,
    });
  }

  const ready = () => {
    if (disposed) return;
    rebuild();
    ScrollTrigger.refresh();
    void cutOut(img).then(({ canvas: cut, url }) => {
      if (disposed) {
        URL.revokeObjectURL(url);
        return;
      }
      blobUrl = url;
      cut.className = 'ecl-cut';
      bag.insertBefore(cut, bag.firstChild);
      if (url) {
        sheen.style.maskImage = `url(${url})`;
        sheen.style.setProperty('-webkit-mask-image', `url(${url})`);
      }
      product.appendChild(stage);
      layoutStage();
      product.dataset.eclStage = '';
    }, () => {});
  };
  if (img.complete && img.naturalWidth) ready();
  else img.addEventListener('load', ready, { once: true });
  disposers.push(() => {
    img.removeEventListener('load', ready);
    stage.remove();
    delete product.dataset.eclStage;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  });

  if (fine && !reduced) {
    const tilt = { x: 0, y: 0, tx: 0, ty: 0, glow: 0, tg: 0 };
    let visible = true;
    let traf = 0;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(cover);
    const loop = () => {
      traf = 0;
      if (!visible) return;
      tilt.x += (tilt.tx - tilt.x) * 0.08;
      tilt.y += (tilt.ty - tilt.y) * 0.08;
      tilt.glow += (tilt.tg - tilt.glow) * 0.07;
      bag.style.transform = `perspective(1400px) rotateX(${(-tilt.y * 4).toFixed(3)}deg) rotateY(${(tilt.x * 7).toFixed(3)}deg) translate3d(${(tilt.x * 3).toFixed(2)}px, ${(tilt.y * 2).toFixed(2)}px, 0)`;
      sheen.style.setProperty('--sx', `${(50 - tilt.x * 38).toFixed(2)}%`);
      sheen.style.setProperty('--sy', `${(46 - tilt.y * 26).toFixed(2)}%`);
      sheen.style.opacity = tilt.glow.toFixed(3);
      if (
        Math.abs(tilt.tx - tilt.x) + Math.abs(tilt.ty - tilt.y) > 0.001 ||
        Math.abs(tilt.tg - tilt.glow) > 0.002
      )
        traf = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!traf) traf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = stage.getBoundingClientRect();
      if (!r.width) return;
      tilt.tx = clamp(((e.clientX - (r.left + r.width / 2)) / (r.width * 0.75)), -1, 1);
      tilt.ty = clamp(((e.clientY - (r.top + r.height / 2)) / (r.height * 0.75)), -1, 1);
      tilt.tg = 1;
      kick();
    };
    const onLeave = () => {
      tilt.tx = 0;
      tilt.ty = 0;
      tilt.tg = 0;
      kick();
    };
    cover.addEventListener('pointermove', onMove);
    cover.addEventListener('pointerleave', onLeave);
    disposers.push(() => {
      io.disconnect();
      cancelAnimationFrame(traf);
      cover.removeEventListener('pointermove', onMove);
      cover.removeEventListener('pointerleave', onLeave);
    });
  }

  return () => {
    disposed = true;
    disposers.reverse().forEach((d) => d());
  };
};

export default mount;
