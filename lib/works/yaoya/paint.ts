// Hand-painted produce, holders and shared textures for やおや みらい.
// Everything is drawn procedurally with Canvas 2D: shaped bodies, pigment mottling,
// grain, soft inner shading and a slightly wobbly ink line so it reads as illustration.
import type { ProduceId } from './data';

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];
const TAU = Math.PI * 2;

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** smooth low-frequency blotches (grey, 0.78..1) */
let mottleC: HTMLCanvasElement | null = null;
export function mottle() {
  if (mottleC) return mottleC;
  const small = canvas(18, 18);
  const sx = small.getContext('2d')!;
  const r = rng(7);
  const img = sx.createImageData(18, 18);
  for (let i = 0; i < 18 * 18; i++) {
    const v = 200 + r() * 55;
    img.data.set([v, v * 0.98, v * 0.95, 255], i * 4);
  }
  sx.putImageData(img, 0, 0);
  const c = canvas(256, 256);
  const x = c.getContext('2d')!;
  x.imageSmoothingQuality = 'high';
  x.drawImage(small, 0, 0, 256, 256);
  mottleC = c;
  return c;
}
/** per-pixel grain tile */
let grainC: HTMLCanvasElement | null = null;
export function grain() {
  if (grainC) return grainC;
  const c = canvas(160, 160);
  const x = c.getContext('2d')!;
  const img = x.createImageData(160, 160);
  const r = rng(11);
  for (let i = 0; i < 160 * 160; i++) {
    const v = r() * 255;
    img.data.set([v, v, v, 255], i * 4);
  }
  x.putImageData(img, 0, 0);
  grainC = c;
  return c;
}

// ---------- geometry ----------
export function blob(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  mod: (a: number) => number = () => 1,
  n = 80,
  rot = 0,
): Pt[] {
  const out: Pt[] = [];
  const cr = Math.cos(rot),
    sr = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const m = mod(a);
    const x = Math.cos(a) * rx * m,
      y = Math.sin(a) * ry * m;
    out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return out;
}
/** outline around a quadratic spine, with round caps */
export function tube(
  a: Pt,
  b: Pt,
  bend: number,
  width: (t: number) => number,
  n = 48,
  caps = true,
): Pt[] {
  const mx = (a[0] + b[0]) / 2,
    my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const c: Pt = [mx - (dy / len) * bend, my + (dx / len) * bend];
  const at = (t: number): Pt => [
    (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
    (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
  ];
  const nor = (t: number): Pt => {
    const p = at(Math.max(0, t - 0.002)),
      q = at(Math.min(1, t + 0.002));
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l];
  };
  const left: Pt[] = [],
    right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = at(t),
      nn = nor(t),
      w = width(t);
    left.push([p[0] + nn[0] * w, p[1] + nn[1] * w]);
    right.push([p[0] - nn[0] * w, p[1] - nn[1] * w]);
  }
  const out: Pt[] = [...left];
  if (caps) {
    const p = at(1),
      nn = nor(1),
      w = width(1);
    for (let i = 1; i < 10; i++) {
      const ang = (i / 10) * Math.PI;
      const tx = nn[1],
        ty = -nn[0];
      out.push([
        p[0] + nn[0] * w * Math.cos(ang) + tx * w * Math.sin(ang),
        p[1] + nn[1] * w * Math.cos(ang) + ty * w * Math.sin(ang),
      ]);
    }
  }
  out.push(...right.reverse());
  if (caps) {
    const p = at(0),
      nn = nor(0),
      w = width(0);
    for (let i = 1; i < 10; i++) {
      const ang = (i / 10) * Math.PI;
      const tx = nn[1],
        ty = -nn[0];
      out.push([
        p[0] - nn[0] * w * Math.cos(ang) - tx * w * Math.sin(ang),
        p[1] - nn[1] * w * Math.cos(ang) - ty * w * Math.sin(ang),
      ]);
    }
  }
  return out;
}
export function spineAt(a: Pt, b: Pt, bend: number, t: number): Pt {
  const mx = (a[0] + b[0]) / 2,
    my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const c: Pt = [mx - (dy / len) * bend, my + (dx / len) * bend];
  return [
    (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
    (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
  ];
}
function bez(p0: Pt, c1: Pt, c2: Pt, p1: Pt, n = 24): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n,
      u = 1 - t;
    o.push([
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    ]);
  }
  return o;
}
export function trace(c: Ctx, p: Pt[], closed = true) {
  if (p.length < 3) return;
  const n = p.length;
  const mid = (i: number): Pt => {
    const a = p[i % n],
      b = p[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  if (closed) {
    const m0 = mid(n - 1);
    c.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(i);
      c.quadraticCurveTo(p[i][0], p[i][1], m[0], m[1]);
    }
    c.closePath();
  } else {
    c.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const m = mid(i);
      c.quadraticCurveTo(p[i][0], p[i][1], m[0], m[1]);
    }
    c.lineTo(p[n - 1][0], p[n - 1][1]);
  }
}
function wobble(p: Pt[], amt: number, seed: number): Pt[] {
  const r = rng(seed);
  const f1 = 2 + r() * 3,
    f2 = 5 + r() * 4,
    ph = r() * TAU;
  return p.map(([x, y], i) => {
    const t = (i / p.length) * TAU;
    return [
      x + amt * Math.sin(t * f1 + ph),
      y + amt * Math.cos(t * f2 + ph * 1.7),
    ];
  });
}
function bbox(p: Pt[]) {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const [x, y] of p) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

// ---------- painting ----------
type BodyStyle = {
  hi: string;
  mid: string;
  lo: string;
  light: Pt;
  r: number;
  scale: number;
  detail?: (c: Ctx) => void;
  gloss?: [number, number, number, number, number, number][];
  ink?: number;
  edge?: number;
  seed?: number;
  mottle?: number;
};
export function paintBody(c: Ctx, pts: Pt[], s: BodyStyle) {
  const b = bbox(pts);
  c.save();
  c.beginPath();
  trace(c, pts);
  const g = c.createRadialGradient(s.light[0], s.light[1], 0, s.light[0], s.light[1], s.r);
  g.addColorStop(0, s.hi);
  g.addColorStop(0.5, s.mid);
  g.addColorStop(1, s.lo);
  c.fillStyle = g;
  c.fill();
  c.clip();
  // pigment mottling
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = s.mottle ?? 0.55;
  const off = ((s.seed ?? 1) * 37) % 90;
  c.drawImage(mottle(), off, off, 150, 150, b.x0 - 4, b.y0 - 4, b.w + 8, b.h + 8);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  s.detail?.(c);
  // pooled pigment at the edge (inner shadow)
  c.shadowColor = s.lo;
  c.shadowBlur = (s.edge ?? 7) * s.scale;
  c.beginPath();
  c.rect(b.x0 - 200, b.y0 - 200, b.w + 400, b.h + 400);
  trace(c, pts);
  c.fillStyle = s.lo;
  c.fill('evenodd');
  c.shadowBlur = 0;
  c.shadowColor = 'transparent';
  // paper grain
  c.globalCompositeOperation = 'soft-light';
  c.globalAlpha = 0.16;
  c.fillStyle = c.createPattern(grain(), 'repeat')!;
  c.save();
  c.scale(1 / s.scale, 1 / s.scale);
  c.fillRect(b.x0 * s.scale - 10, b.y0 * s.scale - 10, b.w * s.scale + 20, b.h * s.scale + 20);
  c.restore();
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  for (const [x, y, rx, ry, a, rot] of s.gloss ?? []) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(1, ry / rx);
    const gg = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    gg.addColorStop(0, `rgba(255,255,250,${a})`);
    gg.addColorStop(0.55, `rgba(255,255,250,${a * 0.35})`);
    gg.addColorStop(1, 'rgba(255,255,250,0)');
    c.fillStyle = gg;
    c.beginPath();
    c.arc(0, 0, rx, 0, TAU);
    c.fill();
    c.restore();
  }
  c.restore();
  ink(c, pts, s.ink ?? 0.5, s.seed ?? 3);
}
export function ink(c: Ctx, pts: Pt[], a = 0.5, seed = 3, closed = true, w = 1.1) {
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = `rgba(48,28,18,${a})`;
  c.lineWidth = w;
  c.setLineDash([60, 2.5, 26, 1.5, 90, 3]);
  c.beginPath();
  trace(c, wobble(pts, 0.5, seed), closed);
  c.stroke();
  c.strokeStyle = `rgba(48,28,18,${a * 0.45})`;
  c.lineWidth = w * 0.6;
  c.setLineDash([]);
  c.beginPath();
  trace(c, wobble(pts, 0.9, seed + 5), closed);
  c.stroke();
  c.restore();
}
function line(c: Ctx, p: Pt[], color: string, w: number) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  trace(c, p, false);
  c.stroke();
  c.restore();
}
/** almond leaf along a bent spine */
function leaf(
  c: Ctx,
  a: Pt,
  b: Pt,
  w: number,
  col: [string, string],
  scale: number,
  o: { bend?: number; ruffle?: number; rib?: string; seed?: number; ink?: number } = {},
) {
  const bend = o.bend ?? 0;
  const pts = tube(
    a,
    b,
    bend,
    (t) => w * Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, t))), 0.75) * (1 + (o.ruffle ?? 0) * Math.sin(t * 38)),
    30,
    false,
  );
  const g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
  g.addColorStop(0, col[0]);
  g.addColorStop(1, col[1]);
  c.save();
  c.beginPath();
  trace(c, pts);
  c.fillStyle = g;
  c.fill();
  c.clip();
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = 0.5;
  const bb = bbox(pts);
  c.drawImage(mottle(), bb.x0, bb.y0, Math.max(4, bb.w), Math.max(4, bb.h));
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  if (o.rib) {
    const rib: Pt[] = [];
    for (let i = 0; i <= 12; i++) rib.push(spineAt(a, b, bend, (i / 12) * 0.92));
    line(c, rib, o.rib, Math.max(0.6, w * 0.16));
  }
  c.restore();
  ink(c, pts, o.ink ?? 0.35, o.seed ?? 9, true, 0.8);
  void scale;
}

// ---------- produce ----------
type Spec = { w: number; h: number; circles: [number, number, number][]; disp: number };
export const spec: Record<ProduceId, Spec> = {
  tomato: { w: 120, h: 116, circles: [[60, 68, 47]], disp: 0.62 },
  daikon: { w: 300, h: 120, circles: [[112, 62, 26], [158, 63, 24], [204, 64, 21], [246, 65, 14], [46, 58, 18]], disp: 0.8 },
  cabbage: { w: 136, h: 128, circles: [[68, 68, 56]], disp: 0.74 },
  carrot: { w: 240, h: 84, circles: [[84, 44, 18], [124, 45, 15], [166, 46, 10], [40, 40, 14]], disp: 0.56 },
  onion: { w: 120, h: 132, circles: [[60, 80, 44]], disp: 0.58 },
  nasu: { w: 210, h: 100, circles: [[92, 50, 19], [132, 50, 26], [168, 52, 26], [42, 44, 10]], disp: 0.55 },
  kaki: { w: 120, h: 112, circles: [[60, 66, 47]], disp: 0.6 },
  mikan: { w: 104, h: 102, circles: [[52, 56, 42]], disp: 0.54 },
  imo: { w: 222, h: 100, circles: [[62, 54, 21], [110, 51, 28], [158, 48, 22], [196, 45, 11]], disp: 0.52 },
  negi: { w: 320, h: 72, circles: [[52, 36, 11], [92, 36, 11], [132, 36, 11], [172, 36, 11], [212, 36, 12], [256, 34, 13], [296, 32, 11]], disp: 0.74 },
  shiitake: { w: 128, h: 112, circles: [[62, 46, 46], [80, 88, 13]], disp: 0.52 },
  hakusai: { w: 256, h: 132, circles: [[64, 66, 42], [124, 66, 50], [190, 66, 52]], disp: 0.7 },
};

const painters: Record<ProduceId, (c: Ctx, s: number, r: () => number) => void> = {
  tomato(c, s) {
    const body = blob(60, 68, 50, 44, (a) => 1 + 0.032 * Math.cos(4 * a + 0.5) + 0.014 * Math.cos(9 * a + 1) - 0.05 * Math.max(0, -Math.sin(a)) ** 6, 96);
    paintBody(c, body, {
      hi: '#ff9270', mid: '#e5391f', lo: '#7a110a', light: [42, 46], r: 76, scale: s, seed: 2,
      detail(c) {
        for (let k = -3; k <= 3; k++)
          line(c, bez([60 + k * 2, 30], [60 + k * 16, 40], [60 + k * 20, 80], [60 + k * 9, 110]), 'rgba(120,12,6,0.14)', 3);
        const gr = c.createRadialGradient(60, 34, 0, 60, 34, 26);
        gr.addColorStop(0, 'rgba(140,150,40,0.45)');
        gr.addColorStop(1, 'rgba(140,150,40,0)');
        c.fillStyle = gr;
        c.fillRect(20, 10, 80, 50);
      },
      gloss: [[40, 48, 13, 8, 0.75, -0.7], [47, 41, 3.5, 2.2, 0.95, -0.4], [84, 92, 10, 4, 0.18, 0.9]],
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3 + Math.sin(i * 3.1) * 0.25;
      const L = 24 + Math.sin(i * 2.3) * 4;
      leaf(c, [60, 31], [60 + Math.cos(a) * L, 31 + Math.sin(a) * L * 0.5 + 2], 4.2, ['#4f8c2e', '#2f5a1b'], s, { bend: 4 * Math.sin(i * 1.7), seed: i + 20, ink: 0.4 });
    }
    paintBody(c, tube([60, 31], [63, 13], 2, () => 3.2, 8), { hi: '#8ab85a', mid: '#4d7f2f', lo: '#23401a', light: [59, 18], r: 14, scale: s, edge: 2, ink: 0.45 });
    c.fillStyle = '#b9d88a';
    c.beginPath();
    c.ellipse(63, 13, 3.1, 1.6, 0.2, 0, TAU);
    c.fill();
  },
  daikon(c, s, r) {
    // leaves first (behind)
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i - 2) * 0.2 + Math.sin(i * 4.1) * 0.05;
      const L = 74 + Math.sin(i * 2.7) * 8;
      const base: Pt = [84, 60 + (i - 2.5) * 2.2];
      const tip: Pt = [base[0] + Math.cos(a) * L, base[1] + Math.sin(a) * L];
      line(c, [base, [base[0] + Math.cos(a) * L * 0.5, base[1] + Math.sin(a) * L * 0.5 + 1], tip], '#9dbb62', 2.6);
      for (let k = 0; k < 5; k++) {
        const t = 0.3 + k * 0.14;
        const px = base[0] + Math.cos(a) * L * t,
          py = base[1] + Math.sin(a) * L * t;
        const sz = 6 + k * 2.4;
        for (const side of [-1, 1]) {
          const la = a + side * (0.95 - k * 0.08);
          leaf(c, [px, py], [px + Math.cos(la) * sz, py + Math.sin(la) * sz], sz * 0.3, ['#5e9e3a', '#2d6a22'], s, { seed: i * 20 + k * 2 + side + 40, ink: 0.28 });
        }
      }
      leaf(c, [tip[0] + Math.cos(a) * -4, tip[1] + Math.sin(a) * -4], [tip[0] + Math.cos(a) * 14, tip[1] + Math.sin(a) * 14], 7, ['#4d9030', '#2a6420'], s, { seed: i + 90, rib: 'rgba(200,230,150,0.5)' });
    }
    const w = (t: number) => 27 * Math.pow(1 - t, 0.32) * (1 + 0.03 * Math.sin(t * 17)) + 0.4;
    const body = tube([88, 58], [294, 66], -4, w, 60);
    paintBody(c, body, {
      hi: '#ffffff', mid: '#f1efe3', lo: '#a19d84', light: [150, 46], r: 150, scale: s, seed: 4, edge: 6, mottle: 0.35,
      detail(c) {
        const g = c.createLinearGradient(88, 0, 170, 0);
        g.addColorStop(0, 'rgba(150,196,90,0.95)');
        g.addColorStop(0.45, 'rgba(190,220,130,0.55)');
        g.addColorStop(1, 'rgba(210,230,170,0)');
        c.fillStyle = g;
        c.fillRect(60, 20, 120, 90);
        for (let i = 0; i < 16; i++) {
          const t = 0.2 + r() * 0.75;
          const p = spineAt([88, 58], [294, 66], -4, t);
          const ww = w(t);
          line(c, bez([p[0] - 1, p[1] - ww * 0.9], [p[0] + 2, p[1] - ww * 0.3], [p[0] + 2, p[1] + ww * 0.3], [p[0] - 1, p[1] + ww * 0.9]), 'rgba(120,110,80,0.13)', 1.1);
        }
        for (let i = 0; i < 22; i++) {
          const t = 0.25 + r() * 0.7;
          const p = spineAt([88, 58], [294, 66], -4, t);
          const side = r() < 0.5 ? -0.45 : 0.4;
          c.fillStyle = 'rgba(110,100,70,0.35)';
          c.beginPath();
          c.ellipse(p[0], p[1] + side * w(t), 1.2, 0.6, 0, 0, TAU);
          c.fill();
        }
      },
      gloss: [[150, 44, 50, 5, 0.6, 0.03]],
    });
    line(c, [[292, 66], [298, 67], [300, 69]], 'rgba(150,140,110,0.8)', 0.8);
  },
  cabbage(c, s, r) {
    for (const [x, y, rx, ry, rot] of [
      [34, 90, 34, 30, -0.5],
      [104, 92, 34, 30, 0.5],
      [68, 108, 46, 20, 0],
    ] as const) {
      const pts = blob(x, y, rx, ry, (a) => 1 + 0.07 * Math.sin(a * 11 + x) + 0.04 * Math.sin(a * 23), 90, rot);
      paintBody(c, pts, {
        hi: '#9fcf6c', mid: '#5f9a3c', lo: '#244a18', light: [x - 10, y - 14], r: 50, scale: s, seed: x, edge: 5,
        detail(c) {
          for (let k = -3; k <= 3; k++) line(c, bez([x, y + ry], [x + k * 6, y], [x + k * 12, y - ry * 0.5], [x + k * 16, y - ry]), 'rgba(220,240,190,0.45)', 1.2);
        },
      });
    }
    const head = blob(68, 64, 55, 51, (a) => 1 + 0.018 * Math.sin(a * 7) + 0.01 * Math.sin(a * 13), 100);
    paintBody(c, head, {
      hi: '#eef6d2', mid: '#b3d67c', lo: '#4f7e2e', light: [52, 40], r: 84, scale: s, seed: 5,
      detail(c) {
        // wrapping leaf edge
        const edge: Pt[] = [];
        for (let i = 0; i <= 30; i++) {
          const t = i / 30;
          edge.push([6 + t * 124, 52 - Math.sin(t * Math.PI) * 26 + Math.sin(t * 40) * 1.6]);
        }
        c.save();
        c.beginPath();
        c.moveTo(0, 140);
        for (const p of edge) c.lineTo(p[0], p[1]);
        c.lineTo(140, 140);
        c.closePath();
        const g = c.createLinearGradient(0, 30, 0, 120);
        g.addColorStop(0, 'rgba(160,205,110,0.85)');
        g.addColorStop(1, 'rgba(70,120,45,0.9)');
        c.fillStyle = g;
        c.fill();
        c.restore();
        line(c, edge, 'rgba(245,252,225,0.8)', 1.6);
        line(c, edge.map(([x, y]) => [x, y + 1.6] as Pt), 'rgba(40,80,25,0.35)', 1);
        for (let k = -4; k <= 4; k++) {
          if (k === 0) continue;
          const j = (r() - 0.5) * 8;
          const top: Pt = [70 + k * 14 + j, 44 + Math.abs(k) * 5 + r() * 8];
          line(c, bez([72 + k * 3, 124], [70 + k * 5 + j, 100], [70 + k * 13 - j, 72], top), 'rgba(240,250,215,0.55)', 1.9 - Math.abs(k) * 0.15);
          for (let j = 0; j < 3; j++) {
            const yy = 60 + j * 18 + r() * 6;
            line(c, [[70 + k * 11 * (yy / 90), yy], [70 + k * 11 * (yy / 90) + (k >= 0 ? 8 : -8), yy - 5 - r() * 5]], 'rgba(235,248,210,0.35)', 0.8);
          }
        }
        c.fillStyle = 'rgba(250,255,235,0.55)';
        c.beginPath();
        c.ellipse(64, 22, 22, 8, -0.1, 0, TAU);
        c.fill();
      },
      gloss: [[48, 30, 18, 7, 0.4, -0.3]],
    });
  },
  carrot(c, s) {
    for (let i = 0; i < 4; i++) {
      const a = Math.PI + (i - 1.5) * 0.36;
      const L = 34 + i * 3;
      const b: Pt = [60, 42];
      const tip: Pt = [b[0] + Math.cos(a) * L, b[1] + Math.sin(a) * L];
      line(c, [b, [b[0] + Math.cos(a) * L * 0.5, b[1] + Math.sin(a) * L * 0.5 - 2], tip], '#6a9e3c', 1.6);
      for (let k = 0; k < 7; k++) {
        const t = 0.35 + k * 0.1;
        const px = b[0] + Math.cos(a) * L * t,
          py = b[1] + Math.sin(a) * L * t;
        for (const side of [-1, 1]) {
          const la = a + side * 0.8;
          const sz = 4 + k * 0.6;
          leaf(c, [px, py], [px + Math.cos(la) * sz, py + Math.sin(la) * sz], 1.6, ['#6aab40', '#3b7a26'], s, { seed: i * 30 + k + side * 5, ink: 0.25 });
        }
      }
    }
    paintBody(c, blob(58, 42, 6, 9), { hi: '#9ac060', mid: '#6a9a3a', lo: '#34561c', light: [56, 36], r: 12, scale: s, edge: 2, ink: 0.35 });
    const w = (t: number) => 18 * Math.pow(1 - t, 0.85) + 0.6;
    const A: Pt = [66, 42],
      B: Pt = [236, 47];
    const body = tube(A, B, 3, w, 56);
    paintBody(c, body, {
      hi: '#ffc070', mid: '#f27a1c', lo: '#9c3a08', light: [100, 32], r: 110, scale: s, seed: 6, edge: 5,
      detail(c) {
        for (let i = 0; i < 14; i++) {
          const t = 0.06 + i * 0.065 + Math.sin(i * 7.3) * 0.015;
          const p = spineAt(A, B, 3, t);
          const ww = w(t);
          const k = 0.3 + (i % 3) * 0.2;
          line(c, bez([p[0], p[1] - ww * k], [p[0] + 2, p[1] - ww * 0.1], [p[0] + 2, p[1] + ww * 0.3], [p[0], p[1] + ww * (k + 0.2)]), 'rgba(140,50,6,0.38)', 0.9);
          line(c, [[p[0] + 1.2, p[1] - ww * k * 0.8], [p[0] + 2.4, p[1] + ww * 0.1]], 'rgba(255,210,150,0.35)', 0.7);
        }
      },
      gloss: [[110, 33, 34, 3.5, 0.55, 0.03]],
    });
  },
  onion(c, s) {
    const pts: Pt[] = [
      ...bez([60, 16], [67, 36], [108, 40], [106, 76]),
      ...bez([106, 76], [104, 108], [84, 124], [60, 124]),
      ...bez([60, 124], [36, 124], [14, 108], [14, 76]),
      ...bez([14, 76], [12, 40], [53, 36], [60, 16]),
    ];
    paintBody(c, pts, {
      hi: '#fbdc94', mid: '#cf8f3c', lo: '#6d3c14', light: [44, 60], r: 80, scale: s, seed: 7,
      detail(c) {
        for (let k = -5; k <= 5; k++) {
          line(c, bez([60, 22], [60 + k * 9, 46], [60 + k * 11, 104], [60 + k * 2.2, 122]), 'rgba(110,55,15,0.28)', 1);
          line(c, bez([61, 24], [61 + k * 9.5, 48], [61 + k * 11.6, 104], [61 + k * 2.4, 121]), 'rgba(255,236,190,0.22)', 0.8);
        }
        c.fillStyle = 'rgba(250,232,190,0.55)';
        c.beginPath();
        trace(c, blob(82, 92, 9, 15, (a) => 1 + 0.08 * Math.sin(a * 3), 30, 0.3));
        c.fill();
      },
      gloss: [[42, 64, 14, 22, 0.3, 0.2]],
    });
    line(c, [[60, 18], [61, 10], [64, 4], [66, 2]], '#7a5428', 2.6);
    line(c, [[60, 18], [62, 8]], '#b58a50', 1);
    for (let i = 0; i < 11; i++) {
      const x = 52 + i * 1.6;
      line(c, [[x, 123], [x - 3 + i * 0.6, 127], [x - 2 + i * 0.9, 131]], 'rgba(215,190,140,0.95)', 0.7);
    }
  },
  nasu(c, s) {
    const A: Pt = [62, 48],
      B: Pt = [176, 54];
    const w = (t: number) => 12 + 17 * Math.pow(t, 0.65);
    paintBody(c, tube(A, B, -8, w, 56), {
      hi: '#8f6bb0', mid: '#40195a', lo: '#12041b', light: [120, 30], r: 90, scale: s, seed: 8, mottle: 0.3,
      gloss: [[128, 33, 40, 4.2, 0.85, 0.04], [118, 34, 10, 2, 1, 0.02], [170, 70, 16, 3, 0.18, -0.2]],
    });
    // calyx
    for (let i = 0; i < 5; i++) {
      const dy = (i - 2) * 7.5;
      leaf(c, [56, 48 + dy * 0.2], [86 + Math.abs(dy) * -0.6, 48 + dy * 1.15], 5.2, ['#4b5a30', '#252c16'], s, { bend: dy * 0.2, seed: i + 60, ink: 0.4 });
    }
    paintBody(c, blob(56, 48, 10, 13), { hi: '#6a7a44', mid: '#3a4424', lo: '#1c220e', light: [52, 42], r: 16, scale: s, edge: 3, ink: 0.4 });
    paintBody(c, tube([22, 40], [52, 47], -3, (t) => 3.6 - t * 0.6, 10), { hi: '#9aa864', mid: '#5f6c34', lo: '#2c3418', light: [34, 38], r: 20, scale: s, edge: 2, ink: 0.45 });
    c.fillStyle = '#c9cf9a';
    c.beginPath();
    c.ellipse(22, 40, 1.6, 3.4, 0.2, 0, TAU);
    c.fill();
  },
  kaki(c, s) {
    const body = blob(60, 66, 52, 43, (a) => 1 + 0.055 * Math.cos(4 * a) + 0.012 * Math.sin(7 * a) - 0.06 * Math.max(0, -Math.sin(a)) ** 8, 96);
    paintBody(c, body, {
      hi: '#ffc57a', mid: '#f07a12', lo: '#983806', light: [42, 50], r: 80, scale: s, seed: 9,
      detail(c) {
        for (const k of [-1, 1]) line(c, bez([60, 34], [60 + k * 30, 50], [60 + k * 34, 90], [60 + k * 14, 106]), 'rgba(150,50,6,0.16)', 4);
        c.globalAlpha = 0.14;
        c.fillStyle = '#fff';
        c.beginPath();
        c.ellipse(76, 84, 20, 12, 0.4, 0, TAU);
        c.fill();
        c.globalAlpha = 1;
      },
      gloss: [[40, 52, 14, 8, 0.7, -0.6], [48, 45, 4, 2.4, 0.95, -0.5]],
    });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4 + 0.1;
      const tip: Pt = [60 + Math.cos(a) * 24, 34 + Math.sin(a) * 11];
      const pts = blob((60 + tip[0]) / 2, (34 + tip[1]) / 2, 13, 7.5, (q) => 1 + 0.08 * Math.cos(q * 4), 40, a);
      paintBody(c, pts, { hi: '#a4a860', mid: '#6a6a2e', lo: '#3a2a12', light: [tip[0] - 4, tip[1] - 3], r: 18, scale: s, edge: 3.5, ink: 0.45, seed: i + 70 });
    }
    paintBody(c, blob(60, 33, 4.5, 3.4), { hi: '#8a6a40', mid: '#4d3418', lo: '#24160a', light: [58, 31], r: 6, scale: s, edge: 1, ink: 0.4 });
  },
  mikan(c, s, r) {
    const body = blob(52, 56, 46, 41, (a) => 1 + 0.02 * Math.sin(5 * a + 1) + 0.01 * Math.sin(11 * a), 90);
    paintBody(c, body, {
      hi: '#ffd889', mid: '#fb9612', lo: '#a44e04', light: [36, 38], r: 72, scale: s, seed: 10,
      detail(c) {
        const g = c.createRadialGradient(56, 24, 0, 56, 24, 30);
        g.addColorStop(0, 'rgba(120,160,40,0.75)');
        g.addColorStop(1, 'rgba(120,160,40,0)');
        c.fillStyle = g;
        c.fillRect(10, 0, 90, 60);
        for (let i = 0; i < 420; i++) {
          const a = r() * TAU,
            d = Math.sqrt(r());
          const x = 52 + Math.cos(a) * 44 * d,
            y = 56 + Math.sin(a) * 39 * d;
          c.fillStyle = r() < 0.5 ? 'rgba(150,60,0,0.3)' : 'rgba(255,230,160,0.3)';
          c.beginPath();
          c.arc(x, y, 0.55 + r() * 0.6, 0, TAU);
          c.fill();
        }
      },
      gloss: [[34, 40, 12, 8, 0.6, -0.6]],
    });
    leaf(c, [54, 16], [76, 2], 6, ['#4f8a2c', '#2a5a1a'], s, { bend: -4, rib: 'rgba(190,220,140,0.6)', seed: 77 });
    paintBody(c, blob(53, 16, 5, 3.2, (a) => 1 + 0.25 * Math.cos(a * 5)), { hi: '#8ab050', mid: '#4a7426', lo: '#22380e', light: [51, 14], r: 7, scale: s, edge: 1.5, ink: 0.4 });
  },
  imo(c, s, r) {
    const A: Pt = [18, 58],
      B: Pt = [206, 44];
    const w = (t: number) => 30 * Math.pow(Math.sin(Math.PI * Math.min(0.995, Math.max(0.005, t))), 0.62) * (1 + 0.07 * Math.sin(t * 11));
    paintBody(c, tube(A, B, -12, w, 60, true), {
      hi: '#e0789c', mid: '#a3285a', lo: '#480a26', light: [96, 32], r: 110, scale: s, seed: 12,
      detail(c) {
        for (let i = 0; i < 3; i++) line(c, Array.from({ length: 16 }, (_, k) => { const p = spineAt(A, B, -12, 0.08 + k * 0.056); return [p[0], p[1] + (i - 1) * 10 * Math.sin(Math.PI * (0.08 + k * 0.056))] as Pt; }), 'rgba(90,10,40,0.18)', 1);
        for (let i = 0; i < 16; i++) {
          const t = 0.12 + r() * 0.76;
          const p = spineAt(A, B, -12, t);
          const off = (r() - 0.5) * 1.3 * w(t);
          c.fillStyle = 'rgba(60,5,25,0.55)';
          c.beginPath();
          c.ellipse(p[0], p[1] + off, 1.8, 1, 0.2, 0, TAU);
          c.fill();
          c.fillStyle = 'rgba(255,200,215,0.35)';
          c.beginPath();
          c.ellipse(p[0] + 0.8, p[1] + off + 1.2, 1.8, 0.7, 0.2, 0, TAU);
          c.fill();
          if (r() < 0.4) line(c, [[p[0], p[1] + off], [p[0] + 3, p[1] + off + 4], [p[0] + 4, p[1] + off + 7]], 'rgba(120,60,50,0.6)', 0.5);
        }
      },
      gloss: [[100, 32, 44, 4, 0.4, -0.07]],
    });
    line(c, [[205, 44], [212, 42], [217, 43], [221, 41]], 'rgba(110,40,40,0.8)', 1);
    line(c, [[19, 58], [13, 60], [9, 59]], 'rgba(110,40,40,0.7)', 1.4);
  },
  negi(c, s) {
    // roots
    for (let i = 0; i < 14; i++) {
      const y = 30 + i * 0.9;
      line(c, [[40, y], [30, y + Math.sin(i) * 3], [20, y - 4 + i * 0.8], [10 + (i % 4) * 2, y - 8 + i * 1.3]], 'rgba(222,210,180,0.95)', 0.8);
    }
    // green blades
    const blades: [Pt, number, number][] = [
      [[316, 20], 8, -4],
      [[310, 48], 7.5, 5],
      [[286, 32], 6.5, -2],
    ];
    for (const [tip, ww, bend] of blades) {
      leaf(c, [186, 36], tip, ww, ['#8fbf58', '#2c6624'], s, { bend, rib: 'rgba(220,240,190,0.35)', seed: tip[0] });
    }
    const A: Pt = [40, 36],
      B: Pt = [206, 36];
    paintBody(c, tube(A, B, 0, () => 9.5, 30, false), {
      hi: '#ffffff', mid: '#efefe0', lo: '#9d9c84', light: [110, 29], r: 120, scale: s, seed: 13, edge: 4, mottle: 0.25,
      detail(c) {
        const g = c.createLinearGradient(140, 0, 206, 0);
        g.addColorStop(0, 'rgba(180,215,120,0)');
        g.addColorStop(1, 'rgba(140,190,80,0.95)');
        c.fillStyle = g;
        c.fillRect(140, 20, 70, 32);
        for (let i = -2; i <= 2; i++) line(c, [[44, 36 + i * 3.4], [200, 36 + i * 3.4]], 'rgba(150,150,120,0.14)', 0.7);
      },
      gloss: [[110, 31, 60, 2.2, 0.7, 0]],
    });
    c.fillStyle = '#e8e2c8';
    c.beginPath();
    c.ellipse(40, 36, 2.4, 9.3, 0, 0, TAU);
    c.fill();
  },
  shiitake(c, s, r) {
    paintBody(c, tube([72, 66], [88, 104], 2, (t) => 9 - t * 1.5, 16), {
      hi: '#fbf3e0', mid: '#dccaa2', lo: '#86704a', light: [76, 76], r: 36, scale: s, seed: 14, edge: 4,
      detail(c) {
        for (let i = -2; i <= 2; i++) line(c, [[72 + i * 3, 70], [88 + i * 3, 104]], 'rgba(140,110,70,0.22)', 0.7);
      },
    });
    // gills
    const gills = blob(62, 56, 52, 17, () => 1, 70);
    paintBody(c, gills, {
      hi: '#fbf1dc', mid: '#e3d0aa', lo: '#9a7c50', light: [62, 60], r: 60, scale: s, seed: 15, edge: 4, mottle: 0.2,
      detail(c) {
        for (let i = 0; i < 44; i++) {
          const a = (i / 44) * TAU;
          line(c, [[66, 60], [62 + Math.cos(a) * 52, 56 + Math.sin(a) * 17]], 'rgba(140,105,60,0.3)', 0.6);
        }
      },
    });
    const cap: Pt[] = [
      ...bez([6, 54], [4, 18], [36, 6], [62, 6]),
      ...bez([62, 6], [92, 6], [122, 18], [118, 54]),
      ...bez([118, 54], [100, 66], [26, 66], [6, 54]),
    ];
    paintBody(c, cap, {
      hi: '#c48a52', mid: '#7a4420', lo: '#321708', light: [48, 18], r: 80, scale: s, seed: 16,
      detail(c) {
        // 花どんこ: pale cracked skin with brown islands
        const pale = c.createRadialGradient(56, 22, 4, 60, 30, 56);
        pale.addColorStop(0, 'rgba(238,218,178,0.95)');
        pale.addColorStop(0.7, 'rgba(226,200,156,0.7)');
        pale.addColorStop(1, 'rgba(226,200,156,0)');
        c.fillStyle = pale;
        c.fillRect(0, 0, 128, 60);
        for (let gy = 8; gy < 56; gy += 9)
          for (let gx = 8; gx < 120; gx += 10 + (gy % 3)) {
            const x = gx + (r() - 0.5) * 5,
              y = gy + (r() - 0.5) * 4;
            const d = Math.hypot((x - 58) / 58, (y - 26) / 30);
            const rad = 4.8 + d * 2.2 + r() * 1.2;
            const g = c.createRadialGradient(x - 1, y - 1, 0, x, y, rad);
            g.addColorStop(0, '#9a6232');
            g.addColorStop(1, '#5a3014');
            c.fillStyle = g;
            c.beginPath();
            trace(c, blob(x, y, rad, rad * 0.8, (a) => 1 + 0.18 * Math.sin(a * 3 + x) + 0.1 * Math.sin(a * 5 + y), 14, r() * 3));
            c.fill();
          }
      },
      gloss: [[44, 18, 22, 8, 0.28, -0.2]],
    });
    line(c, bez([8, 54], [30, 64], [96, 64], [117, 54]), 'rgba(236,216,176,0.9)', 2.2);
  },
  hakusai(c, s) {
    const A: Pt = [44, 66],
      B: Pt = [200, 66];
    const w = (t: number) => (40 + 14 * t) * (t > 0.82 ? 1 + 0.06 * Math.sin(t * 90) : 1);
    const outer = tube(A, B, 0, w, 70, true);
    const core: Pt = [150, 66];
    // outer green leaf edge
    paintBody(c, outer, {
      hi: '#bfe08a', mid: '#78ad48', lo: '#2e5a1c', light: [180, 40], r: 140, scale: s, seed: 17, edge: 5,
      detail(c) {
        c.fillStyle = 'rgba(250,248,232,1)';
        c.beginPath();
        c.rect(0, 0, 120, 140);
        c.fill();
      },
    });
    for (let k = 1; k <= 7; k++) {
      const f = 1 - k * 0.12;
      const layer = outer.map(([x, y]) => [core[0] + (x - core[0]) * f, core[1] + (y - core[1]) * (f * 0.96)] as Pt);
      c.save();
      c.beginPath();
      trace(c, layer);
      const g = c.createLinearGradient(core[0] - 140 * f, 0, core[0] + 90 * f, 0);
      const yellow = k >= 5;
      g.addColorStop(0, k % 2 ? '#fbfaf0' : '#f1f0dc');
      g.addColorStop(0.5, yellow ? '#f7efb0' : '#eef3cf');
      g.addColorStop(1, yellow ? '#f2d85a' : k < 3 ? '#9cc85a' : '#d8e890');
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = 'rgba(140,170,90,0.55)';
      c.lineWidth = 0.9;
      c.stroke();
      c.restore();
    }
    for (let i = -3; i <= 3; i++) line(c, [[20, 66 + i * 10], [80, 66 + i * 8.4], [130, 66 + i * 4]], 'rgba(170,190,140,0.35)', 0.8);
    ink(c, outer, 0.5, 18);
  },
};

const cache = new Map<string, HTMLCanvasElement>();
/** single produce at `s` px per unit (unit ≈ design px) */
export function paintProduce(id: ProduceId, s: number) {
  const k = `${id}@${s.toFixed(2)}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const sp = spec[id];
  const cv = canvas(sp.w * s, sp.h * s);
  const c = cv.getContext('2d')!;
  c.scale(s, s);
  painters[id](c, s, rng(id.length * 131 + 7));
  cache.set(k, cv);
  return cv;
}

// ---------- holders & piles ----------
type Place = [number, number, number, number?];
const piles: Record<ProduceId, Place[]> = {
  tomato: [[108, 112, 0.2], [170, 104, -0.4], [232, 114, 0.5], [138, 140, 0.1], [204, 142, -0.2]],
  nasu: [[112, 108, -0.5], [186, 104, 0.3], [140, 132, 0.15], [214, 136, -0.25]],
  kaki: [[104, 112, 0.2], [168, 104, -0.2], [232, 114, 0.4], [136, 142, -0.1], [202, 144, 0.3]],
  mikan: [[96, 116, 0.1], [148, 106, 0.4], [200, 108, -0.3], [246, 122, 0.2], [120, 144, -0.2], [176, 142, 0.5], [226, 148, 0.1]],
  shiitake: [[104, 110, -0.2], [168, 104, 0.2], [228, 114, -0.4], [136, 138, 0.3], [204, 142, 0]],
  onion: [[104, 108, 0.1], [168, 100, -0.2], [232, 110, 0.3], [138, 140, -0.1], [204, 142, 0.2]],
  cabbage: [[88, 98, 0.1], [164, 92, -0.2], [240, 100, 0.3]],
  daikon: [[168, 76, -0.1, 0.78], [158, 98, 0.04, 0.8], [176, 116, -0.03, 0.8]],
  imo: [[106, 92, 0.3], [196, 88, -0.25], [150, 108, 0.05], [230, 110, 0.4], [96, 118, -0.2]],
  negi: [[160, 84, -0.12], [164, 94, -0.08], [158, 104, -0.1], [166, 112, -0.05]],
  carrot: [[112, 88, -0.3], [196, 84, 0.25], [150, 100, -0.05], [224, 106, 0.4], [104, 112, 0.15]],
  hakusai: [[116, 96, -0.08], [200, 102, 0.12]],
};
export const DISP_W = 320,
  DISP_H = 170;
const stencil: Partial<Record<ProduceId, string>> = {
  cabbage: '嬬恋高原',
  daikon: 'JA 北海道',
  imo: '千葉県産',
  negi: '深谷',
  carrot: '房総',
  hakusai: '信州',
};
function zaru(c: Ctx, s: number, back: boolean) {
  const cx = 168,
    cy = 132,
    rx = 146,
    ry = 50;
  if (back) {
    c.save();
    c.shadowColor = 'rgba(40,20,5,0.35)';
    c.shadowBlur = 16 * s;
    c.shadowOffsetY = 8 * s;
    c.fillStyle = '#b88a48';
    c.beginPath();
    c.ellipse(cx, cy + 4, rx, ry, 0, 0, TAU);
    c.fill();
    c.restore();
    c.save();
    c.beginPath();
    c.ellipse(cx, cy, rx - 6, ry - 3, 0, 0, TAU);
    const g = c.createRadialGradient(cx, cy + 6, 10, cx, cy, rx);
    g.addColorStop(0, '#8c6630');
    g.addColorStop(1, '#d8b170');
    c.fillStyle = g;
    c.fill();
    c.clip();
    for (let i = 1; i < 14; i++) {
      c.strokeStyle = i % 2 ? 'rgba(80,50,20,0.35)' : 'rgba(255,230,170,0.35)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.ellipse(cx, cy + 3, rx * (i / 14), ry * (i / 14), 0, 0, TAU);
      c.stroke();
    }
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      c.strokeStyle = 'rgba(90,60,25,0.28)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(cx, cy + 3);
      c.lineTo(cx + Math.cos(a) * rx, cy + 3 + Math.sin(a) * ry);
      c.stroke();
    }
    c.restore();
  } else {
    // rim band (front half)
    c.save();
    c.lineWidth = 7;
    const g = c.createLinearGradient(0, cy, 0, cy + ry);
    g.addColorStop(0, '#e2bf7e');
    g.addColorStop(1, '#9a6c30');
    c.strokeStyle = g;
    c.beginPath();
    c.ellipse(cx, cy, rx - 2, ry - 1, 0, 0.05, Math.PI - 0.05);
    c.stroke();
    c.strokeStyle = 'rgba(70,40,10,0.45)';
    c.lineWidth = 0.8;
    c.setLineDash([4, 3]);
    c.beginPath();
    c.ellipse(cx, cy + 1, rx - 2, ry - 1, 0, 0.1, Math.PI - 0.1);
    c.stroke();
    c.restore();
  }
}
function crate(c: Ctx, s: number, back: boolean, label?: string) {
  const x0 = 26,
    x1 = 310,
    top = 62,
    front = 118,
    bottom = 194;
  if (back) {
    c.save();
    c.shadowColor = 'rgba(40,20,5,0.4)';
    c.shadowBlur = 18 * s;
    c.shadowOffsetY = 10 * s;
    c.fillStyle = '#5a3a1e';
    c.fillRect(x0 + 6, bottom - 10, x1 - x0 - 12, 10);
    c.restore();
    // inner back wall + floor
    c.fillStyle = '#6b4523';
    c.beginPath();
    c.moveTo(x0 + 14, top);
    c.lineTo(x1 - 14, top);
    c.lineTo(x1, front);
    c.lineTo(x0, front);
    c.closePath();
    c.fill();
    const g = c.createLinearGradient(0, top, 0, front);
    g.addColorStop(0, 'rgba(40,20,5,0.55)');
    g.addColorStop(1, 'rgba(40,20,5,0)');
    c.fillStyle = g;
    c.fill();
    c.fillStyle = '#b68552';
    c.fillRect(x0 + 14, top - 4, x1 - x0 - 28, 6);
    return;
  }
  // front panel with planks
  for (let i = 0; i < 3; i++) {
    const y = front + i * ((bottom - front) / 3);
    const h = (bottom - front) / 3 - 2;
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, i === 0 ? '#e0b47c' : '#d2a36b');
    g.addColorStop(1, '#a8743e');
    c.fillStyle = g;
    c.fillRect(x0, y, x1 - x0, h);
    c.save();
    c.beginPath();
    c.rect(x0, y, x1 - x0, h);
    c.clip();
    const r = rng(i * 17 + 3);
    for (let k = 0; k < 9; k++) {
      c.strokeStyle = `rgba(110,60,20,${0.12 + r() * 0.15})`;
      c.lineWidth = 0.7;
      c.beginPath();
      const yy = y + r() * h;
      c.moveTo(x0, yy);
      c.bezierCurveTo(x0 + 90, yy + (r() - 0.5) * 6, x0 + 180, yy + (r() - 0.5) * 6, x1, yy + (r() - 0.5) * 3);
      c.stroke();
    }
    c.restore();
  }
  // corner posts
  for (const x of [x0, x1 - 12]) {
    c.fillStyle = '#b07c46';
    c.fillRect(x, front - 4, 12, bottom - front + 4);
    c.fillStyle = 'rgba(60,30,10,0.25)';
    c.fillRect(x + 10, front - 4, 2, bottom - front + 4);
  }
  // nails
  c.fillStyle = '#3a2a1c';
  for (const x of [x0 + 6, x1 - 6])
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(x, front + 12 + i * 25, 1.4, 0, TAU);
      c.fill();
    }
  if (label) {
    c.save();
    c.font = `700 22px "Zen Old Mincho", serif`;
    c.fillStyle = 'rgba(165,40,30,0.62)';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, (x0 + x1) / 2, front + 36);
    c.globalCompositeOperation = 'destination-out';
    const r = rng(label.length * 9);
    for (let i = 0; i < 160; i++) {
      c.globalAlpha = r() * 0.5;
      c.fillRect((x0 + x1) / 2 - 70 + r() * 140, front + 22 + r() * 28, 1 + r() * 3, 1 + r() * 2);
    }
    c.restore();
  }
}
/** a holder (ざる / 木箱) with a small pile of the produce */
export function paintDisplay(id: ProduceId, holder: 'zaru' | 'crate', s: number) {
  const cv = canvas(DISP_W * s, DISP_H * s);
  const c = cv.getContext('2d')!;
  c.scale(s, s);
  c.translate(0, -30);
  const sp = spec[id];
  if (holder === 'zaru') zaru(c, s, true);
  else crate(c, s, true);
  for (const [x, y, rot, sc] of piles[id]) {
    const k = sc ?? sp.disp;
    const img = paintProduce(id, Math.min(3, s * k * 1.05));
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.shadowColor = 'rgba(30,15,5,0.4)';
    c.shadowBlur = 7 * s;
    c.shadowOffsetY = 4 * s;
    c.drawImage(img, (-sp.w * k) / 2, (-sp.h * k) / 2, sp.w * k, sp.h * k);
    c.restore();
  }
  if (holder === 'zaru') zaru(c, s, false);
  else crate(c, s, false, stencil[id]);
  return cv;
}

// ---------- crest: 丸に違い大根 ----------
function daikonCrest(c: Ctx) {
  // local: root pointing down (+y), leaves up. unit ≈ crest radius 50
  c.beginPath();
  c.moveTo(-8.5, -4);
  c.bezierCurveTo(-10.5, 10, -6, 28, 0, 40);
  c.bezierCurveTo(6, 28, 10.5, 10, 8.5, -4);
  c.quadraticCurveTo(0, -1, -8.5, -4);
  c.closePath();
  const leafP = (rot: number, len: number) => {
    c.save();
    c.rotate(rot);
    c.moveTo(0, -6);
    c.bezierCurveTo(-7, -14, -7.5, -len + 10, 0, -len);
    c.bezierCurveTo(7.5, -len + 10, 7, -14, 0, -6);
    c.closePath();
    c.restore();
  };
  leafP(0, 38);
  leafP(-0.5, 33);
  leafP(0.5, 33);
}
function daikonCrestPath(c: Ctx, rot: number) {
  c.save();
  c.rotate(rot);
  c.translate(0, -2);
  daikonCrest(c);
  c.restore();
}
export function drawCrest(c: Ctx, cx: number, cy: number, R: number, fg: string, bg: string) {
  c.save();
  c.translate(cx, cy);
  c.scale(R / 50, R / 50);
  c.fillStyle = fg;
  c.beginPath();
  c.arc(0, 0, 49, 0, TAU);
  c.arc(0, 0, 41, 0, TAU, true);
  c.fill();
  // B (under)
  c.save();
  c.beginPath();
  c.arc(0, 0, 37, 0, TAU);
  c.clip();
  c.fillStyle = fg;
  daikonCrestPath(c, 0.62);
  c.fill();
  // gap + A (over)
  c.strokeStyle = bg;
  c.lineWidth = 5;
  c.lineJoin = 'round';
  daikonCrestPath(c, -0.62);
  c.stroke();
  c.fill();
  // A's leaf veins / neck line in bg colour
  c.restore();
  c.save();
  c.rotate(-0.62);
  c.translate(0, -2);
  c.strokeStyle = bg;
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(-8, -3.5);
  c.quadraticCurveTo(0, -0.5, 8, -3.5);
  c.stroke();
  c.restore();
  c.save();
  c.rotate(0.62);
  c.translate(0, -2);
  c.strokeStyle = bg;
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(-8, -3.5);
  c.quadraticCurveTo(0, -0.5, 8, -3.5);
  c.stroke();
  c.restore();
  c.restore();
}

// ---------- basket (竹かご) ----------
/** basket in local units: 1000 wide. rim at y=0, bottom ≈ 560 */
export const BASKET = { w: 1000, rimRy: 90, depth: 400 };
export function paintBasket(s: number, part: 'back' | 'front') {
  const W = 1000,
    pad = 60;
  const cv = canvas((W + pad * 2) * s, (BASKET.depth + 200 + 300) * s);
  const c = cv.getContext('2d')!;
  c.scale(s, s);
  c.translate(pad, 300);
  const rimRy = BASKET.rimRy;
  const wallPath = () => {
    c.beginPath();
    c.moveTo(20, 0);
    c.bezierCurveTo(30, 172, 70, 338, 180, 388);
    c.bezierCurveTo(330, 438, 670, 438, 820, 388);
    c.bezierCurveTo(930, 338, 970, 172, 980, 0);
    c.ellipse(500, 0, 480, rimRy, 0, 0, Math.PI, false);
    c.closePath();
  };
  const weave = (alpha: number, dark: string, light: string) => {
    // 六つ目編み: three families of bamboo strips
    for (const ang of [0, Math.PI / 3, -Math.PI / 3]) {
      c.save();
      c.translate(500, 200);
      c.rotate(ang);
      for (let i = -14; i <= 14; i++) {
        const y = i * 64;
        c.fillStyle = light;
        c.globalAlpha = alpha;
        c.fillRect(-800, y - 7, 1600, 14);
        c.fillStyle = dark;
        c.globalAlpha = alpha * 0.7;
        c.fillRect(-800, y + 5, 1600, 2.5);
      }
      c.restore();
    }
    c.globalAlpha = 1;
  };
  if (part === 'back') {
    // handle arcing behind
    c.save();
    c.lineCap = 'round';
    c.strokeStyle = '#8a6232';
    c.lineWidth = 34;
    c.beginPath();
    c.moveTo(80, 10);
    c.bezierCurveTo(140, -300, 860, -300, 920, 10);
    c.stroke();
    c.strokeStyle = '#c9a060';
    c.lineWidth = 18;
    c.stroke();
    c.strokeStyle = 'rgba(90,60,25,0.6)';
    c.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      const x = (1 - t) ** 3 * 80 + 3 * (1 - t) ** 2 * t * 140 + 3 * (1 - t) * t * t * 860 + t ** 3 * 920;
      const y = (1 - t) ** 3 * 10 + 3 * (1 - t) ** 2 * t * -300 + 3 * (1 - t) * t * t * -300 + t ** 3 * 10;
      c.beginPath();
      c.moveTo(x - 10, y - 12);
      c.lineTo(x + 10, y + 12);
      c.stroke();
    }
    c.restore();
    // paper tag tied to the handle
    c.save();
    c.translate(640, -196);
    c.rotate(0.12);
    c.strokeStyle = '#6a4a2a';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(0, -18);
    c.lineTo(0, 10);
    c.stroke();
    c.fillStyle = '#1d2f4f';
    c.shadowColor = 'rgba(0,0,0,0.3)';
    c.shadowBlur = 8 * s;
    c.shadowOffsetY = 4 * s;
    c.fillRect(-70, 10, 140, 64);
    c.shadowColor = 'transparent';
    c.fillStyle = '#f1eadb';
    c.font = `400 40px "Yuji Syuku", "Zen Old Mincho", serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('取り置き', 0, 43);
    c.restore();
    // inside (back wall seen through the opening)
    c.save();
    c.beginPath();
    c.ellipse(500, 0, 480, rimRy, 0, Math.PI, TAU, false);
    c.bezierCurveTo(970, 172, 930, 338, 820, 388);
    c.bezierCurveTo(670, 438, 330, 438, 180, 388);
    c.bezierCurveTo(70, 338, 30, 172, 20, 0);
    c.closePath();
    const g = c.createLinearGradient(0, -rimRy, 0, 400);
    g.addColorStop(0, '#6e4a22');
    g.addColorStop(1, '#2e1c0a');
    c.fillStyle = g;
    c.fill();
    c.clip();
    weave(0.35, '#1e1206', '#9a7038');
    c.restore();
    return cv;
  }
  // front wall: open hexagonal lattice so the pile shows through
  c.save();
  wallPath();
  c.clip();
  c.save();
  c.globalCompositeOperation = 'source-over';
  weave(0.8, '#6a4a20', '#d9b46e');
  // darken toward the bottom & sides for volume
  const g = c.createLinearGradient(0, 0, 0, 420);
  g.addColorStop(0, 'rgba(60,35,10,0)');
  g.addColorStop(1, 'rgba(60,35,10,0.55)');
  c.fillStyle = g;
  c.globalCompositeOperation = 'source-atop';
  c.fillRect(0, -100, 1000, 700);
  const g2 = c.createLinearGradient(0, 0, 1000, 0);
  g2.addColorStop(0, 'rgba(50,30,8,0.5)');
  g2.addColorStop(0.3, 'rgba(50,30,8,0)');
  g2.addColorStop(0.75, 'rgba(50,30,8,0)');
  g2.addColorStop(1, 'rgba(50,30,8,0.55)');
  c.fillStyle = g2;
  c.fillRect(0, -100, 1000, 700);
  c.restore();
  c.restore();
  // rim hoop
  c.save();
  c.lineWidth = 30;
  c.strokeStyle = '#7a5226';
  c.beginPath();
  c.ellipse(500, 0, 480, rimRy, 0, 0, Math.PI, false);
  c.stroke();
  c.lineWidth = 18;
  c.strokeStyle = '#d8b06a';
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = 'rgba(80,50,15,0.7)';
  c.setLineDash([14, 16]);
  c.stroke();
  c.restore();
  // base foot
  c.save();
  c.strokeStyle = '#6a4418';
  c.lineWidth = 16;
  c.beginPath();
  c.moveTo(210, 400);
  c.bezierCurveTo(360, 436, 640, 436, 790, 400);
  c.stroke();
  c.restore();
  return cv;
}
export const BASKET_PAD = { x: 60, y: 300 };
