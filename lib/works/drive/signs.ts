/**
 * Japanese expressway guide signs, drawn on canvas so they stay crisp as they
 * approach. Colours and layout follow the look of NEXCO guide signs:
 * green field, white inset border, exit-number plate, Japanese name over the
 * romanised name, distance or arrow on the right.
 */

export type SignTarget = 'stock' | 'service' | 'buy' | 'access';

export type PanelSpec = {
  id: string;
  target: SignTarget;
  label: string; // accessible name
  kind: 'exit' | 'jct' | 'place' | 'exitnow';
  jp: string;
  en: string;
  num?: string;
  dist?: string;
  unit?: string;
  arrow?: 'up' | 'upleft' | 'jct';
  w: number; // metres
  h: number;
};

export type GPanel = PanelSpec & { x: number };
export const GANTRIES: { s: number; panels: GPanel[] }[] = [
  {
    s: 150,
    panels: [
      { id: 'g1a', x: -1.85, target: 'stock', label: '在庫車の一覧へ', kind: 'exit', jp: '在庫車', en: 'Stock Cars', num: '1', dist: '1', w: 3.5, h: 2.2 },
      { id: 'g1b', x: 1.85, target: 'service', label: '車検・整備のご案内へ', kind: 'exit', jp: '車検・整備', en: 'Inspection & Service', num: '2', dist: '2', w: 3.5, h: 2.2 },
    ],
  },
  {
    s: 1240,
    panels: [
      { id: 'g2a', x: -1.85, target: 'buy', label: '買取査定へ', kind: 'jct', jp: '買取査定JCT', en: 'Trade-in Appraisal', arrow: 'jct', w: 3.5, h: 2.2 },
      { id: 'g2b', x: 1.85, target: 'access', label: '本店のご案内へ', kind: 'place', jp: 'MIRAI MOTORS', en: 'Showroom & Garage', dist: '3', w: 3.5, h: 2.2 },
    ],
  },
  {
    s: 1830,
    panels: [
      { id: 'g3a', x: -1.85, target: 'stock', label: '在庫車の一覧へ', kind: 'exit', jp: '在庫車', en: 'Stock Cars', num: '1', dist: '500', unit: 'm', w: 3.5, h: 2.2 },
      { id: 'g3b', x: 1.85, target: 'buy', label: '買取査定へ', kind: 'exit', jp: '買取査定', en: 'Trade-in', num: '3', dist: '2', w: 3.5, h: 2.2 },
    ],
  },
];
export const EXIT_PANEL: GPanel = {
  id: 'ex',
  x: -5.4,
  target: 'stock',
  label: '出口から在庫車の一覧へ',
  kind: 'exitnow',
  jp: 'MIRAI MOTORS',
  en: 'Stock · Service · Trade-in',
  num: '1',
  arrow: 'upleft',
  w: 3.9,
  h: 2.3,
};


export const GREEN = '#0a6a44';
const JP = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
const EN = '"Barlow", "Helvetica Neue", Arial, sans-serif';

const round = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};

/** Retroreflective sheeting: a faint cell texture and a soft falloff. */
const sheeting = (c: CanvasRenderingContext2D, W: number, H: number, base: string) => {
  c.fillStyle = base;
  c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,0.07)');
  g.addColorStop(0.55, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.14)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.globalAlpha = 0.05;
  c.fillStyle = '#fff';
  for (let y = 0; y < H; y += 6)
    for (let x = (y / 6) % 2 ? 3 : 0; x < W; x += 6) c.fillRect(x, y, 1.2, 1.2);
  c.globalAlpha = 1;
};

const arrow = (c: CanvasRenderingContext2D, kind: 'up' | 'upleft' | 'jct', cx: number, cy: number, s: number) => {
  c.save();
  c.translate(cx, cy);
  c.fillStyle = '#fff';
  const stem = s * 0.2;
  const head = s * 0.5;
  const shaft = (len: number) => {
    c.beginPath();
    c.moveTo(-stem / 2, len * 0.5);
    c.lineTo(-stem / 2, -len * 0.5 + head * 0.7);
    c.lineTo(-head / 2, -len * 0.5 + head * 0.7);
    c.lineTo(0, -len * 0.5);
    c.lineTo(head / 2, -len * 0.5 + head * 0.7);
    c.lineTo(stem / 2, -len * 0.5 + head * 0.7);
    c.lineTo(stem / 2, len * 0.5);
    c.closePath();
    c.fill();
  };
  if (kind === 'up') shaft(s);
  if (kind === 'upleft') {
    c.rotate(-Math.PI / 4);
    shaft(s * 1.1);
  }
  if (kind === 'jct') {
    // main stem up, branch curving to the right
    c.translate(-s * 0.18, 0);
    shaft(s);
    c.save();
    c.lineWidth = stem;
    c.strokeStyle = '#fff';
    c.beginPath();
    c.moveTo(0, s * 0.3);
    c.bezierCurveTo(0, s * 0.02, s * 0.1, -s * 0.08, s * 0.32, -s * 0.2);
    c.stroke();
    c.translate(s * 0.4, -s * 0.24);
    c.rotate(Math.PI / 3);
    c.beginPath();
    c.moveTo(-head / 2, head * 0.35);
    c.lineTo(0, -head * 0.4);
    c.lineTo(head / 2, head * 0.35);
    c.closePath();
    c.fill();
    c.restore();
  }
  c.restore();
};

/** Fit text into a width by condensing horizontally (like sign lettering). */
const fitText = (c: CanvasRenderingContext2D, t: string, x: number, y: number, maxW: number) => {
  const w = c.measureText(t).width;
  if (w <= maxW) return c.fillText(t, x, y);
  c.save();
  c.translate(x, y);
  c.scale(maxW / w, 1);
  c.fillText(t, 0, 0);
  c.restore();
};

export function drawPanel(p: PanelSpec, px = 1024): HTMLCanvasElement {
  const W = px;
  const H = Math.round((px * p.h) / p.w);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  sheeting(c, W, H, GREEN);
  const u = H / 100; // layout unit
  c.strokeStyle = '#fff';
  c.lineWidth = u * 1.3;
  round(c, u * 3, u * 3, W - u * 6, H - u * 6, u * 5);
  c.stroke();
  c.fillStyle = '#fff';
  c.textBaseline = 'alphabetic';

  const arrowLeft = p.arrow === 'upleft';
  const left = arrowLeft ? u * 44 : u * 10;
  const right = W - u * 10;

  // exit-number plate
  let top = u * 12;
  if (p.num) {
    c.font = `700 ${u * 13}px ${JP}`;
    c.fillText('出口', left, top + u * 13);
    const lw = c.measureText('出口').width;
    round(c, left + lw + u * 3, top - u * 0.5, u * 17, u * 17, u * 3);
    c.fill();
    c.fillStyle = GREEN;
    c.font = `600 ${u * 15}px ${EN}`;
    c.textAlign = 'center';
    c.fillText(p.num, left + lw + u * 11.5, top + u * 13.5);
    c.textAlign = 'left';
    c.fillStyle = '#fff';
    top += u * 22;
  } else top += u * 6;

  // right block: distance or arrow
  let textMax = right - left;
  if (p.dist) {
    c.font = `600 ${u * 40}px ${EN}`;
    const dw = c.measureText(p.dist).width;
    c.font = `600 ${u * 17}px ${EN}`;
    const uw = c.measureText(p.unit ?? 'km').width;
    const x0 = right - dw - uw - u * 2;
    c.font = `600 ${u * 40}px ${EN}`;
    c.fillText(p.dist, x0, H - u * 20);
    c.font = `600 ${u * 17}px ${EN}`;
    c.fillText(p.unit ?? 'km', x0 + dw + u * 2, H - u * 20);
    textMax = x0 - left - u * 6;
  } else if (p.arrow && !arrowLeft) {
    arrow(c, p.arrow, right - u * 20, H * 0.54, u * 46);
    textMax = right - u * 48 - left;
  }
  if (arrowLeft) arrow(c, 'upleft', u * 24, H * 0.54, u * 44);

  // names
  const jpSize = p.kind === 'place' ? u * 25 : u * 30;
  c.font = `700 ${jpSize}px ${JP}`;
  fitText(c, p.jp, left, top + jpSize * 0.92, textMax);
  c.font = `500 ${u * 13.5}px ${EN}`;
  fitText(c, p.en, left + u * 0.5, top + jpSize + u * 17, textMax);
  return cv;
}

export function drawPlate(lines: [string, string], opt: { w: number; h: number; bg: string; fg?: string; px?: number }) {
  const W = opt.px ?? 1024;
  const H = Math.round((W * opt.h) / opt.w);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  sheeting(c, W, H, opt.bg);
  c.fillStyle = opt.fg ?? '#fff';
  c.textAlign = 'center';
  const u = H / 100;
  c.save();
  c.translate(W / 2, u * 58);
  c.font = `700 ${u * 46}px ${JP}`;
  const w0 = c.measureText(lines[0]).width;
  if (w0 > W * 0.9) c.scale((W * 0.9) / w0, 1);
  c.fillText(lines[0], 0, 0);
  c.restore();
  c.font = `500 ${u * 22}px ${EN}`;
  c.fillText(lines[1], W / 2, u * 86);
  return cv;
}

/** ETC lane sign (purple) — "ETC 専用". */
export function drawEtc() {
  const W = 512;
  const H = 320;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  sheeting(c, W, H, '#6e2c8f');
  c.strokeStyle = '#fff';
  c.lineWidth = 8;
  round(c, 12, 12, W - 24, H - 24, 18);
  c.stroke();
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  c.font = `600 150px ${EN}`;
  c.fillText('ETC', W / 2, 180);
  c.font = `700 70px ${JP}`;
  c.fillText('専用', W / 2, 272);
  return cv;
}

/** Curve chevron board — white arrow on blue. */
export function drawChevron() {
  const W = 128;
  const H = 160;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  sheeting(c, W, H, '#1c4fa0');
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(92, 22);
  c.lineTo(40, 80);
  c.lineTo(92, 138);
  c.lineTo(108, 124);
  c.lineTo(68, 80);
  c.lineTo(108, 36);
  c.closePath();
  c.fill();
  return cv;
}

/** Speed limit — red ring, blue numerals. */
export function drawLimit(n: string) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#d0202a';
  c.lineWidth = 26;
  c.beginPath();
  c.arc(S / 2, S / 2, S / 2 - 18, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = '#1d3f95';
  c.textAlign = 'center';
  c.font = `600 112px ${EN}`;
  c.save();
  c.translate(S / 2, S / 2 + 40);
  c.scale(0.82, 1);
  c.fillText(n, 0, 0);
  c.restore();
  return cv;
}

export async function waitFonts(timeout = 900) {
  if (!('fonts' in document)) return;
  const want = [`700 64px "Zen Kaku Gothic New"`, `600 64px "Barlow"`, `500 64px "Barlow"`];
  await Promise.race([
    Promise.all(want.map((f) => document.fonts.load(f, '出口在庫車整備買取査定本店トンネル料金所専用みらいMIRAI0123456789km'))),
    new Promise((r) => setTimeout(r, timeout)),
  ]).catch(() => undefined);
}

/** Yellow / black diagonal hazard stripes (crash cushion, island noses). */
export function drawStripes() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#e8b20e';
  c.fillRect(0, 0, S, S);
  c.fillStyle = '#121212';
  for (let i = -S; i < S * 2; i += 64) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i + 32, 0);
    c.lineTo(i + 32 - S, S);
    c.lineTo(i - S, S);
    c.closePath();
    c.fill();
  }
  return cv;
}
