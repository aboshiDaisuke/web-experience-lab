// 黒板 — the board writes itself in chalk: glyphs are revealed stroke-wise under a
// grain mask (chalk skipping over the slate), a chalk stick travels with the tip and dust falls.
import { boardItems, boardWord, weekdays } from './data';
import { canvas, mottle, rng } from './paint';

export type BoardCtl = { dispose: () => void };
type Op =
  | { k: 'text'; text: string; x: number; y: number; size: number; color: string; align?: 'left' | 'right' | 'center'; rot?: number; ms?: number }
  | { k: 'path'; pts: [number, number][]; width: number; color: string };

const WHITE = '#f3f1e6',
  YELLOW = '#f6e27a',
  PINK = '#f6a9bb',
  GREEN = '#b9e59c',
  BLUE = '#a9d6f2';
const FONT = '"Yomogi", "Zen Kurenaido", cursive';

function layout(w: number, h: number, date: Date): Op[] {
  const ops: Op[] = [];
  const wide = w / h > 1.2;
  const ds = `${date.getMonth() + 1}/${date.getDate()}（${weekdays[date.getDay()]}）`;
  const wave = (x0: number, x1: number, y: number, amp: number): [number, number][] => {
    const o: [number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      o.push([x0 + (x1 - x0) * t, y + Math.sin(t * Math.PI * 5) * amp * (0.6 + 0.4 * Math.sin(t * 3))]);
    }
    return o;
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, turns = 1.08, start = -2.4): [number, number][] => {
    const o: [number, number][] = [];
    for (let i = 0; i <= 44; i++) {
      const a = start + (i / 44) * Math.PI * 2 * turns;
      const k = 1 + 0.04 * Math.sin(a * 3);
      o.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return o;
  };
  const cabbage = (cx: number, cy: number, r: number) => {
    // head: slightly bumpy circle
    const head: [number, number][] = [];
    for (let i = 0; i <= 46; i++) {
      const a = -1.2 + (i / 46) * Math.PI * 2.04;
      const k = 1 + 0.03 * Math.sin(a * 7);
      head.push([cx + Math.cos(a) * r * 0.78 * k, cy + Math.sin(a) * r * 0.74 * k]);
    }
    ops.push({ k: 'path', pts: head, width: r * 0.05, color: GREEN });
    // big wavy outer leaves cupping the head from below
    for (const side of [-1, 1]) {
      const leaf: [number, number][] = [];
      for (let i = 0; i <= 26; i++) {
        const t = i / 26;
        const a = Math.PI / 2 + side * (0.15 + t * 2.05);
        const rr = r * (0.98 + 0.07 * Math.sin(t * Math.PI * 7)) * (1 - 0.12 * t);
        leaf.push([cx + Math.cos(a) * rr * 1.08, cy + Math.sin(a) * rr * 0.92 + r * 0.06]);
      }
      ops.push({ k: 'path', pts: leaf, width: r * 0.045, color: GREEN });
    }
    // edge of the wrapping leaf across the head + a smaller inner fold
    ops.push({ k: 'path', pts: [[cx - r * 0.72, cy - r * 0.05], [cx - r * 0.35, cy - r * 0.34], [cx + r * 0.05, cy - r * 0.42], [cx + r * 0.42, cy - r * 0.3], [cx + r * 0.74, cy - r * 0.02]], width: r * 0.04, color: GREEN });
    ops.push({ k: 'path', pts: [[cx - r * 0.3, cy - r * 0.55], [cx, cy - r * 0.64], [cx + r * 0.3, cy - r * 0.56]], width: r * 0.035, color: GREEN });
    // midrib and side veins
    ops.push({ k: 'path', pts: [[cx - r * 0.02, cy + r * 0.72], [cx, cy + r * 0.3], [cx + r * 0.04, cy - r * 0.3]], width: r * 0.045, color: GREEN });
    for (const side of [-1, 1])
      for (const t of [0.5, 0.2, -0.08])
        ops.push({ k: 'path', pts: [[cx + side * r * 0.02, cy + r * t], [cx + side * r * 0.22, cy + r * (t - 0.1)], [cx + side * r * 0.42, cy + r * (t - 0.26)]], width: r * 0.03, color: GREEN });
  };
  if (wide) {
    const u = w / 100;
    const hu = h / u;
    ops.push({ k: 'text', text: '本日の入荷', x: 5 * u, y: 10.5 * u, size: 6.4 * u, color: WHITE, rot: -0.02 });
    ops.push({ k: 'text', text: ds, x: 41 * u, y: 9.8 * u, size: 3.6 * u, color: YELLOW });
    ops.push({ k: 'path', pts: ellipse(48 * u, 8.5 * u, 9.6 * u, 3.5 * u), width: 0.3 * u, color: YELLOW });
    ops.push({ k: 'path', pts: wave(5 * u, 35 * u, 13.6 * u, 0.45 * u), width: 0.34 * u, color: WHITE });
    boardItems.forEach((b, i) => {
      const y = 21.5 * u + i * 5.6 * u;
      ops.push({ k: 'text', text: '・' + b.name, x: 4.5 * u, y, size: 3.3 * u, color: WHITE, rot: (i % 2 ? 0.01 : -0.012) });
      const nameW = (b.name.length + 1) * 3.3 * u;
      ops.push({ k: 'text', text: b.origin, x: 4.5 * u + nameW + 1 * u, y: y - 0.2 * u, size: 1.9 * u, color: BLUE, ms: 18 });
      ops.push({ k: 'text', text: b.price, x: 52 * u, y: y + 0.3 * u, size: 4.2 * u, color: YELLOW, align: 'right' });
      ops.push({ k: 'text', text: `円 / ${b.unit}`, x: 52.8 * u, y, size: 1.9 * u, color: WHITE, ms: 18 });
      if (b.hot) {
        ops.push({ k: 'text', text: 'イチオシ！', x: 70.5 * u, y: y - 0.2 * u, size: 2.4 * u, color: PINK, rot: -0.1 });
        ops.push({ k: 'path', pts: [[70 * u, y - 1.2 * u], [67.5 * u, y - 1 * u], [65.2 * u, y - 0.8 * u], [66.6 * u, y - 1.9 * u], [65.2 * u, y - 0.8 * u], [66.6 * u, y + 0.2 * u]], width: 0.28 * u, color: PINK });
      }
    });
    cabbage(88 * u, 10.5 * u, 5.4 * u);
    ops.push({ k: 'text', text: '店主のひとこと', x: 66 * u, y: 26.5 * u, size: 2.5 * u, color: PINK });
    ops.push({ k: 'path', pts: wave(66 * u, 85 * u, 28 * u, 0.22 * u), width: 0.24 * u, color: PINK });
    boardWord.forEach((l, i) => ops.push({ k: 'text', text: l, x: 66 * u, y: 32 * u + i * 3.9 * u, size: 2.55 * u, color: WHITE, ms: 22 }));
    ops.push({ k: 'text', text: '─ 二代目 誠', x: 95 * u, y: 47.5 * u, size: 2.2 * u, color: WHITE, align: 'right', ms: 22 });
    ops.push({ k: 'text', text: '※ 売り切れごめん。取り置きは店頭かこのページで', x: 4.5 * u, y: Math.min(51 * u, (hu - 2.6) * u), size: 1.7 * u, color: WHITE, ms: 16 });
  } else {
    const u = w / 100;
    ops.push({ k: 'text', text: '本日の入荷', x: 6 * u, y: 16 * u, size: 12 * u, color: WHITE, rot: -0.02 });
    ops.push({ k: 'path', pts: wave(6 * u, 66 * u, 21 * u, 0.8 * u), width: 0.6 * u, color: WHITE });
    ops.push({ k: 'text', text: ds, x: 6 * u, y: 30 * u, size: 6 * u, color: YELLOW });
    ops.push({ k: 'path', pts: ellipse(21 * u, 28 * u, 17 * u, 5.8 * u), width: 0.55 * u, color: YELLOW });
    cabbage(84 * u, 24 * u, 9 * u);
    boardItems.forEach((b, i) => {
      const y = 45 * u + i * 12 * u;
      ops.push({ k: 'text', text: '・' + b.name, x: 4 * u, y, size: 6.2 * u, color: WHITE });
      ops.push({ k: 'text', text: `${b.origin}　${b.unit}`, x: 9 * u, y: y + 5 * u, size: 3.6 * u, color: BLUE, ms: 18 });
      ops.push({ k: 'text', text: b.price, x: 86 * u, y: y + 2 * u, size: 8 * u, color: YELLOW, align: 'right' });
      ops.push({ k: 'text', text: '円', x: 87 * u, y: y + 2 * u, size: 3.6 * u, color: WHITE, ms: 18 });
      if (b.hot) ops.push({ k: 'text', text: 'イチオシ！', x: 60 * u, y: y - 7 * u, size: 4 * u, color: PINK, rot: -0.1 });
    });
    const y0 = 106 * u;
    ops.push({ k: 'text', text: '店主のひとこと', x: 6 * u, y: y0, size: 4.4 * u, color: PINK });
    boardWord.forEach((l, i) => ops.push({ k: 'text', text: l, x: 6 * u, y: y0 + 7.5 * u + i * 6 * u, size: 4.5 * u, color: WHITE, ms: 22 }));
    ops.push({ k: 'text', text: '─ 二代目 誠', x: 94 * u, y: y0 + 32.5 * u, size: 4 * u, color: WHITE, align: 'right', ms: 22 });
  }
  return ops;
}

function slate(w: number, h: number) {
  const cv = canvas(w, h);
  const c = cv.getContext('2d')!;
  const r = rng(4);
  c.fillStyle = '#22352c';
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = 0.5;
  c.drawImage(mottle(), 0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
  // ghosts of yesterday's board, wiped with an eraser
  c.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    c.strokeStyle = `rgba(230,235,225,${0.018 + r() * 0.03})`;
    c.lineWidth = h * (0.05 + r() * 0.08);
    c.beginPath();
    const x = r() * w,
      y = r() * h;
    c.moveTo(x, y);
    c.bezierCurveTo(x + (r() - 0.5) * w * 0.4, y + (r() - 0.5) * h * 0.3, x + (r() - 0.5) * w * 0.5, y + (r() - 0.5) * h * 0.3, x + (r() - 0.5) * w * 0.6, y + (r() - 0.5) * h * 0.2);
    c.stroke();
  }
  c.globalAlpha = 1;
  // yesterday's board, wiped: blurred, streaked, barely there
  const gh = canvas(w, h);
  const g = gh.getContext('2d')!;
  g.fillStyle = '#e8eee0';
  g.font = `${h * 0.045}px ${FONT}`;
  for (let k = 0; k < 10; k++) {
    g.globalAlpha = 0.1;
    const ox = (r() - 0.5) * h * 0.02,
      oy = (r() - 0.5) * h * 0.012;
    g.fillText('なし  150', w * 0.6 + ox, h * 0.12 + oy);
  }
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = 0.85;
  g.lineCap = 'round';
  for (let i = 0; i < 18; i++) {
    g.lineWidth = h * (0.008 + r() * 0.02);
    g.beginPath();
    const y = r() * h;
    g.moveTo(0, y);
    g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * h * 0.1, w * 0.7, y + (r() - 0.5) * h * 0.1, w, y + (r() - 0.5) * h * 0.05);
    g.stroke();
  }
  c.globalAlpha = 0.25;
  c.drawImage(gh, 0, 0);
  c.globalAlpha = 1;
  c.globalAlpha = 1;
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  c.putImageData(img, 0, 0);
  const v = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  c.fillStyle = v;
  c.fillRect(0, 0, w, h);
  return cv;
}
function grainMask(w: number, h: number) {
  const sw = Math.ceil(w / 3);
  const small = canvas(sw, h);
  const sc = small.getContext('2d')!;
  const img = sc.createImageData(sw, h);
  const r = rng(9);
  for (let i = 0; i < sw * h; i++) {
    const v = r();
    const a = v < 0.22 ? v * 1.2 : 0.78 + v * 0.22;
    img.data.set([255, 255, 255, Math.round(a * 255)], i * 4);
  }
  sc.putImageData(img, 0, 0);
  const cv = canvas(w, h);
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = true;
  c.drawImage(small, 0, 0, w, h);
  // fine speckle holes
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < (w * h) / 60; i++) {
    c.globalAlpha = 0.3 + r() * 0.6;
    c.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1);
  }
  return cv;
}

export function mountBoard(cv: HTMLCanvasElement, o: { reduced: boolean; date: Date }): BoardCtl {
  const ctx = cv.getContext('2d')!;
  let dead = false;
  let W = 0,
    H = 0,
    dpr = 1;
  let bg: HTMLCanvasElement, grainC: HTMLCanvasElement, chalk: HTMLCanvasElement, tmp: HTMLCanvasElement;
  let ops: Op[] = [];
  let started = false,
    done = false;
  let opIndex = 0,
    opT = 0,
    raf = 0,
    last = 0,
    wait = 0;
  const tip = { x: 0, y: 0, tx: 0, ty: 0, color: WHITE, on: false };
  const dust: { x: number; y: number; vx: number; vy: number; life: number; s: number }[] = [];

  const opDuration = (op: Op) => {
    if (op.k === 'path') {
      let L = 0;
      for (let i = 1; i < op.pts.length; i++) L += Math.hypot(op.pts[i][0] - op.pts[i - 1][0], op.pts[i][1] - op.pts[i - 1][1]);
      return Math.max(0.25, L / (900 * (W / 1100) + 300));
    }
    const per = (op.ms ?? 20 + op.size * 0.34) / 1000;
    return op.text.split('').length * per;
  };
  const setupFont = (c: CanvasRenderingContext2D, op: Extract<Op, { k: 'text' }>) => {
    c.font = `400 ${op.size * dpr}px ${FONT}`;
    c.textBaseline = 'alphabetic';
  };
  /** draw op into c; progress 0..1 */
  function drawOp(c: CanvasRenderingContext2D, op: Op, p: number) {
    c.save();
    c.strokeStyle = c.fillStyle = op.color;
    c.lineCap = c.lineJoin = 'round';
    if (op.k === 'path') {
      const pts = op.pts;
      let L = 0;
      const seg: number[] = [];
      for (let i = 1; i < pts.length; i++) {
        const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        seg.push(l);
        L += l;
      }
      let rem = L * p;
      c.lineWidth = op.width * dpr;
      c.beginPath();
      c.moveTo(pts[0][0] * dpr, pts[0][1] * dpr);
      let ex = pts[0][0],
        ey = pts[0][1];
      for (let i = 1; i < pts.length && rem > 0; i++) {
        const t = Math.min(1, rem / seg[i - 1]);
        ex = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t;
        ey = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
        c.lineTo(ex * dpr, ey * dpr);
        rem -= seg[i - 1];
      }
      c.stroke();
      tip.tx = ex;
      tip.ty = ey;
    } else {
      setupFont(c, op);
      const chars = op.text.split('');
      const widths = chars.map((ch) => c.measureText(ch).width / dpr);
      const total = widths.reduce((a, b) => a + b, 0);
      let x = op.align === 'right' ? op.x - total : op.align === 'center' ? op.x - total / 2 : op.x;
      const n = chars.length;
      const reveal = p * n;
      c.translate(x * dpr, op.y * dpr);
      c.rotate(op.rot ?? 0);
      let cx = 0;
      const jr = rng(op.text.length * 31 + Math.round(op.x));
      for (let i = 0; i < n; i++) {
        const q = Math.min(1, Math.max(0, reveal - i));
        const jy = (jr() - 0.5) * op.size * 0.06;
        const jrot = (jr() - 0.5) * 0.08;
        const js = 0.94 + jr() * 0.12;
        if (q > 0) {
          c.save();
          c.translate((cx + widths[i] / 2) * dpr, jy * dpr);
          c.rotate(jrot);
          c.scale(js, js);
          const gw = widths[i] * dpr,
            gh = op.size * dpr;
          if (q < 1) {
            // diagonal wipe: top-left → bottom-right, like a hand writing the strokes
            const t = q * 1.9 - 0.45;
            c.beginPath();
            const d = (t - 0.5) * (gw + gh);
            c.moveTo(-gw, -gh * 1.2);
            c.lineTo(d + gw * 0.2, -gh * 1.2);
            c.lineTo(d - gh * 0.8 + gw * 0.2, gh * 0.4);
            c.lineTo(-gw, gh * 0.4);
            c.closePath();
            c.clip();
            tip.tx = (x + cx + widths[i] / 2) + (d / dpr) * 0.5;
            tip.ty = op.y - op.size * (0.75 - q * 0.6) + jy;
          }
          c.lineWidth = op.size * 0.07 * dpr;
          c.fillText(chars[i], -gw / 2, 0);
          c.strokeText(chars[i], -gw / 2, 0);
          c.restore();
        }
        cx += widths[i];
      }
      if (p >= 1) {
        tip.tx = x + total;
        tip.ty = op.y - op.size * 0.2;
      }
    }
    c.restore();
  }
  const texture = (c: CanvasRenderingContext2D) => {
    c.save();
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(grainC, 0, 0);
    c.restore();
  };
  function bake(op: Op) {
    const t = tmp.getContext('2d')!;
    t.clearRect(0, 0, tmp.width, tmp.height);
    drawOp(t, op, 1);
    texture(t);
    const c = chalk.getContext('2d')!;
    c.save();
    c.shadowColor = 'rgba(240,240,230,0.35)';
    c.shadowBlur = 5 * dpr;
    c.drawImage(tmp, 0, 0);
    c.restore();
  }

  function setup() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(10, r.width);
    H = Math.max(10, r.height);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    bg = slate(cv.width, cv.height);
    grainC = grainMask(cv.width, cv.height);
    chalk = canvas(cv.width, cv.height);
    tmp = canvas(cv.width, cv.height);
    ops = layout(W, H, o.date);
    if (done || (started && o.reduced)) {
      for (const op of ops) bake(op);
      opIndex = ops.length;
    } else if (started) {
      for (let i = 0; i < opIndex; i++) bake(ops[i]);
    }
    paint();
  }
  function paint() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.drawImage(chalk, 0, 0);
    if (!done && started && opIndex < ops.length) {
      const t = tmp.getContext('2d')!;
      t.clearRect(0, 0, tmp.width, tmp.height);
      const op = ops[opIndex];
      drawOp(t, op, Math.min(1, opT / opDuration(op)));
      texture(t);
      ctx.save();
      ctx.shadowColor = 'rgba(240,240,230,0.35)';
      ctx.shadowBlur = 5 * dpr;
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    }
    // dust
    for (const d of dust) {
      ctx.fillStyle = `rgba(240,240,230,${Math.max(0, d.life) * 0.5})`;
      ctx.fillRect(d.x * dpr, d.y * dpr, d.s * dpr, d.s * dpr);
    }
    // chalk stick
    if (tip.on) {
      ctx.save();
      ctx.translate(tip.x * dpr, tip.y * dpr);
      ctx.rotate(-0.75);
      const L = Math.max(26, W * 0.04) * dpr,
        R = Math.max(4, W * 0.0055) * dpr;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8 * dpr;
      ctx.shadowOffsetX = 4 * dpr;
      ctx.shadowOffsetY = 6 * dpr;
      const g = ctx.createLinearGradient(0, -R, 0, R);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, tip.color === WHITE ? '#cfcabb' : tip.color);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.6);
      ctx.lineTo(L, -R);
      ctx.lineTo(L, R);
      ctx.lineTo(0, R * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  function frame(t: number) {
    raf = 0;
    if (dead) return;
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    if (!done) {
      if (wait > 0) wait -= dt;
      else {
        const op = ops[opIndex];
        opT += dt;
        tip.color = op.color;
        tip.on = true;
        if (opT >= opDuration(op)) {
          bake(op);
          opIndex++;
          opT = 0;
          wait = op.k === 'text' && op.size > W * 0.05 ? 0.22 : 0.1;
          if (opIndex >= ops.length) {
            done = true;
            tip.on = false;
          }
        }
      }
    }
    tip.x += (tip.tx - tip.x) * Math.min(1, dt * 22);
    tip.y += (tip.ty - tip.y) * Math.min(1, dt * 22);
    if (!done && wait <= 0 && Math.random() < 0.7)
      dust.push({ x: tip.x + (Math.random() - 0.5) * 4, y: tip.y + (Math.random() - 0.5) * 4, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 10, life: 1, s: 0.6 + Math.random() * 1.4 });
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.vy += 60 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt * 0.8;
      if (d.life <= 0 || d.y > H) dust.splice(i, 1);
    }
    paint();
    if (!done || dust.length) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (started) return;
    started = true;
    if (o.reduced) {
      for (const op of ops) bake(op);
      opIndex = ops.length;
      done = true;
      paint();
      return;
    }
    const first = ops[0];
    if (first.k === 'text') {
      tip.x = tip.tx = first.x;
      tip.y = tip.ty = first.y;
    }
    raf = requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting) start();
    },
    { threshold: 0.35 },
  );
  let setupT = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(setupT);
    setupT = window.setTimeout(() => !dead && setup(), 120);
  });
  void document.fonts.load(`40px "Yomogi"`, '本日の入荷朝どれキャベツ').finally(() => {
    if (dead) return;
    setup();
    ro.observe(cv);
    io.observe(cv);
  });
  const vis = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (started && (!done || dust.length) && !raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', vis);
  return {
    dispose() {
      dead = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      clearTimeout(setupT);
      document.removeEventListener('visibilitychange', vis);
    },
  };
}
