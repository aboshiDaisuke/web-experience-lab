/**
 * MIRAI ARC — the two in-car displays, drawn on canvas and used as textures.
 * `boot` runs 0 -> 1 when the driver sits down (logo, then the UI settles in).
 */

export type Page = 'home' | 'energy' | 'navi' | 'media';
export const PAGES: { id: Page; jp: string }[] = [
  { id: 'home', jp: 'ホーム' },
  { id: 'energy', jp: 'エネルギー' },
  { id: 'navi', jp: 'ナビ' },
  { id: 'media', jp: 'オーディオ' },
];

export type ScreenState = {
  ambient: string;
  ambientName: string;
  battery: number;
  range: number;
  paint: string;
  doorR: boolean;
  doorL: boolean;
  lights: boolean;
  night: boolean;
  clock: string;
};

const EN = '"Jost", "Helvetica Neue", Arial, sans-serif';
const JP = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

function bg(c: CanvasRenderingContext2D, w: number, h: number, tint: string, k: number) {
  c.fillStyle = '#04060a';
  c.fillRect(0, 0, w, h);
  const g = c.createRadialGradient(w * 0.5, h * 1.1, 10, w * 0.5, h * 0.9, w * 0.7);
  g.addColorStop(0, hexA(tint, 0.16 * k));
  g.addColorStop(1, hexA(tint, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

export function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function logo(c: CanvasRenderingContext2D, w: number, h: number, t: number, tint: string, size: number) {
  const a = seg(t, 0, 0.3) * (1 - seg(t, 0.45, 0.6));
  if (a <= 0) return;
  c.save();
  c.globalAlpha = a;
  c.strokeStyle = tint;
  c.lineWidth = size * 0.04;
  c.lineCap = 'round';
  const r = size;
  c.beginPath();
  c.arc(w / 2, h / 2 + r * 0.55, r, Math.PI * 1.18, Math.PI * (1.18 + 0.64 * seg(t, 0.02, 0.35)));
  c.stroke();
  c.fillStyle = '#f2f4f7';
  c.font = `300 ${size * 0.34}px ${EN}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${size * 0.09}px`;
  c.fillText('MIRAI  ARC', w / 2 + size * 0.045, h / 2 + size * 0.2);
  c.restore();
}

export function drawMeter(c: CanvasRenderingContext2D, w: number, h: number, s: ScreenState, boot: number) {
  const ls = c as CanvasRenderingContext2D & { letterSpacing: string };
  bg(c, w, h, s.ambient, boot);
  logo(c, w, h, boot, s.ambient, h * 0.36);
  const u = seg(boot, 0.5, 0.9);
  if (u <= 0) return;
  c.save();
  c.globalAlpha = u;
  c.textBaseline = 'alphabetic';
  // gear selector
  const gears = ['P', 'R', 'N', 'D'];
  gears.forEach((g, i) => {
    const on = g === 'P';
    c.font = `${on ? 500 : 300} ${h * 0.12}px ${EN}`;
    c.fillStyle = on ? '#ffffff' : '#56606b';
    c.textAlign = 'center';
    c.fillText(g, w * 0.055, h * 0.26 + i * h * 0.19);
  });
  // speed
  c.textAlign = 'center';
  c.fillStyle = '#ffffff';
  c.font = `300 ${h * 0.5}px ${EN}`;
  c.fillText('0', w * 0.25, h * 0.66);
  c.font = `400 ${h * 0.075}px ${EN}`;
  c.fillStyle = '#8b96a3';
  ls.letterSpacing = '3px';
  c.fillText('km/h', w * 0.25, h * 0.8);
  ls.letterSpacing = '0px';
  // READY
  c.font = `500 ${h * 0.07}px ${EN}`;
  c.fillStyle = '#6ee0a8';
  ls.letterSpacing = '4px';
  c.fillText('READY', w * 0.25, h * 0.2);
  ls.letterSpacing = '0px';
  // power arc (the brand arc) sweeping to 0 kW
  const cx = w * 0.53;
  const cy = h * 1.15;
  const R = h * 0.82;
  c.lineCap = 'round';
  c.lineWidth = h * 0.028;
  c.strokeStyle = '#1b222b';
  c.beginPath();
  c.arc(cx, cy, R, Math.PI * 1.22, Math.PI * 1.78);
  c.stroke();
  const sweep = Math.sin(Math.min(1, seg(boot, 0.55, 1)) * Math.PI) * 0.56;
  c.strokeStyle = s.ambient;
  c.beginPath();
  c.arc(cx, cy, R, Math.PI * 1.22, Math.PI * (1.22 + Math.max(0.004, sweep)));
  c.stroke();
  c.font = `400 ${h * 0.065}px ${EN}`;
  c.fillStyle = '#8b96a3';
  c.fillText('POWER', cx, cy - R + h * 0.2);
  c.font = `300 ${h * 0.13}px ${EN}`;
  c.fillStyle = '#e8ecf1';
  c.fillText(s.clock, cx, cy - R + h * 0.42);
  // battery + range
  const bx = w * 0.72;
  c.textAlign = 'left';
  c.font = `300 ${h * 0.2}px ${EN}`;
  c.fillStyle = '#ffffff';
  c.fillText(`${s.range}`, bx, h * 0.46);
  const rw = c.measureText(`${s.range}`).width;
  c.font = `400 ${h * 0.07}px ${EN}`;
  c.fillStyle = '#8b96a3';
  c.fillText('km', bx + rw + 8, h * 0.46);
  const bw = w * 0.22;
  c.fillStyle = '#1b222b';
  roundRect(c, bx, h * 0.56, bw, h * 0.06, h * 0.03);
  c.fill();
  c.fillStyle = s.battery < 20 ? '#ff6a4a' : '#6ee0a8';
  roundRect(c, bx, h * 0.56, bw * (s.battery / 100) * seg(boot, 0.6, 1), h * 0.06, h * 0.03);
  c.fill();
  c.font = `400 ${h * 0.07}px ${EN}`;
  c.fillStyle = '#c8d0d8';
  c.fillText(`${s.battery}%`, bx, h * 0.78);
  // tell-tales
  c.fillStyle = s.lights ? '#6ee0a8' : '#2a323c';
  lampIcon(c, bx + bw - h * 0.1, h * 0.74, h * 0.07);
  c.restore();
}

function lampIcon(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, r * 0.6, Math.PI * 0.5, Math.PI * 1.5);
  c.closePath();
  c.fill();
  for (let i = 0; i < 3; i++) c.fillRect(x + r * 0.2, y - r * 0.5 + i * r * 0.45, r * 0.8, r * 0.14);
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  if (w <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Tabs along the bottom of the centre display (normalised canvas coords). */
export function centerTabAt(u: number, v: number): Page | null {
  if (v < 0.86) return null;
  const i = Math.floor(u * PAGES.length);
  return PAGES[Math.max(0, Math.min(PAGES.length - 1, i))].id;
}

export function drawCenter(c: CanvasRenderingContext2D, w: number, h: number, s: ScreenState, boot: number, page: Page, t: number) {
  const ls = c as CanvasRenderingContext2D & { letterSpacing: string };
  bg(c, w, h, s.ambient, boot * 0.8);
  logo(c, w, h, boot, s.ambient, h * 0.26);
  const u = seg(boot, 0.55, 0.95);
  if (u <= 0) return;
  c.save();
  c.globalAlpha = u;
  // status bar
  c.fillStyle = '#e8ecf1';
  c.font = `400 ${h * 0.045}px ${EN}`;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(s.clock, w * 0.03, h * 0.055);
  c.textAlign = 'right';
  c.fillText(`${s.night ? '18' : '22'}°C   ${s.battery}%`, w * 0.97, h * 0.055);
  c.textAlign = 'center';
  c.font = `500 ${h * 0.04}px ${JP}`;
  c.fillStyle = '#8b96a3';
  c.fillText(PAGES.find((p) => p.id === page)!.jp, w / 2, h * 0.055);

  const top = h * 0.11;
  const bottom = h * 0.86;
  if (page === 'home') home(c, w, h, s, top, bottom, boot);
  if (page === 'energy') energy(c, w, h, s, top, bottom);
  if (page === 'navi') navi(c, w, h, s, top, bottom, t);
  if (page === 'media') media(c, w, h, s, top, bottom, t);

  // tab bar
  c.fillStyle = '#0b0f15';
  c.fillRect(0, bottom, w, h - bottom);
  c.fillStyle = '#1b222b';
  c.fillRect(0, bottom, w, 2);
  PAGES.forEach((p, i) => {
    const x = (i + 0.5) * (w / PAGES.length);
    const on = p.id === page;
    c.fillStyle = on ? '#ffffff' : '#6d7885';
    c.font = `${on ? 700 : 500} ${h * 0.042}px ${JP}`;
    c.textAlign = 'center';
    c.fillText(p.jp, x, bottom + (h - bottom) * 0.5);
    if (on) {
      c.fillStyle = s.ambient;
      roundRect(c, x - w * 0.04, bottom + 6, w * 0.08, 5, 2.5);
      c.fill();
    }
  });
  ls.letterSpacing = '0px';
  c.restore();
}

function home(c: CanvasRenderingContext2D, w: number, h: number, s: ScreenState, top: number, bottom: number, boot: number) {
  // top-down car with door state
  const cx = w * 0.3;
  const cy = (top + bottom) / 2;
  const L = (bottom - top) * 0.8;
  const W = L * 0.42;
  c.save();
  c.translate(cx, cy);
  c.strokeStyle = '#c8d0d8';
  c.lineWidth = 2;
  c.fillStyle = '#10151c';
  c.beginPath();
  c.ellipse(0, 0, W / 2, L / 2, 0, 0, Math.PI * 2);
  c.fill();
  roundRect(c, -W / 2, -L / 2, W, L, W * 0.42);
  c.fillStyle = '#131a23';
  c.fill();
  c.stroke();
  // glass canopy
  roundRect(c, -W * 0.36, -L * 0.2, W * 0.72, L * 0.52, W * 0.3);
  c.fillStyle = '#1e2a38';
  c.fill();
  // doors
  const drawDoor = (sgn: number, open: boolean) => {
    c.save();
    c.translate(sgn * W / 2, -L * 0.12);
    c.rotate(open ? sgn * -0.9 : 0);
    c.strokeStyle = open ? s.ambient : '#c8d0d8';
    c.lineWidth = open ? 4 : 2;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, L * 0.26);
    c.stroke();
    c.restore();
  };
  drawDoor(1, s.doorR);
  drawDoor(-1, s.doorL);
  // lamps
  c.fillStyle = s.lights ? '#ffffff' : '#56606b';
  roundRect(c, -W * 0.36, -L / 2 + 3, W * 0.72, 4, 2);
  c.fill();
  c.fillStyle = s.lights ? '#ff4a3a' : '#4a2626';
  roundRect(c, -W * 0.4, L / 2 - 7, W * 0.8, 4, 2);
  c.fill();
  c.restore();
  // greeting + info tiles
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#ffffff';
  c.font = `500 ${h * 0.07}px ${JP}`;
  c.fillText(s.night ? 'こんばんは。' : 'おかえりなさい。', w * 0.52, top + h * 0.13);
  c.font = `400 ${h * 0.038}px ${JP}`;
  c.fillStyle = '#9aa5b1';
  c.fillText(`${s.doorR || s.doorL ? 'ドアが開いています' : 'すべてのドアが閉まっています'}`, w * 0.52, top + h * 0.2);
  const tile = (i: number, label: string, value: string, col?: string) => {
    const x = w * 0.52 + (i % 2) * w * 0.225;
    const y = top + h * 0.27 + Math.floor(i / 2) * h * 0.2;
    c.fillStyle = '#10161e';
    roundRect(c, x, y, w * 0.21, h * 0.17, 12);
    c.fill();
    c.fillStyle = '#8b96a3';
    c.font = `400 ${h * 0.033}px ${JP}`;
    c.fillText(label, x + 16, y + h * 0.055);
    c.fillStyle = col ?? '#ffffff';
    c.font = `500 ${h * 0.05}px ${JP}`;
    c.fillText(value, x + 16, y + h * 0.125);
  };
  tile(0, '航続可能距離', `${s.range} km`);
  tile(1, 'アンビエント', s.ambientName, s.ambient);
  tile(2, 'ボディカラー', s.paint);
  tile(3, 'ライト', s.lights ? 'オン' : 'オート');
  void boot;
}

function energy(c: CanvasRenderingContext2D, w: number, h: number, s: ScreenState, top: number, bottom: number) {
  const cx = w * 0.3;
  const cy = (top + bottom) / 2 + h * 0.03;
  const R = (bottom - top) * 0.36;
  c.lineCap = 'round';
  c.lineWidth = R * 0.14;
  c.strokeStyle = '#1b222b';
  c.beginPath();
  c.arc(cx, cy, R, Math.PI * 0.75, Math.PI * 2.25);
  c.stroke();
  c.strokeStyle = '#6ee0a8';
  c.beginPath();
  c.arc(cx, cy, R, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * (s.battery / 100)));
  c.stroke();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#ffffff';
  c.font = `300 ${R * 0.62}px ${EN}`;
  c.fillText(`${s.battery}`, cx, cy - R * 0.05);
  c.font = `400 ${R * 0.16}px ${EN}`;
  c.fillStyle = '#8b96a3';
  c.fillText('% / ' + s.range + ' km', cx, cy + R * 0.42);
  // consumption bars (last 7 days)
  const x0 = w * 0.56;
  const x1 = w * 0.95;
  const y1 = bottom - h * 0.1;
  const vals = [132, 141, 125, 150, 128, 119, 124];
  const days = ['月', '火', '水', '木', '金', '土', '日'];
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#ffffff';
  c.font = `500 ${h * 0.045}px ${JP}`;
  c.fillText('電費（Wh/km）', x0, top + h * 0.08);
  c.fillStyle = '#8b96a3';
  c.font = `400 ${h * 0.035}px ${JP}`;
  c.fillText('7日間の平均 131', x0, top + h * 0.14);
  const bw = (x1 - x0) / vals.length;
  vals.forEach((v, i) => {
    const bh = ((v - 90) / 70) * (y1 - top - h * 0.22);
    c.fillStyle = i === vals.length - 1 ? s.ambient : '#2a3440';
    roundRect(c, x0 + i * bw + bw * 0.2, y1 - bh, bw * 0.6, bh, 4);
    c.fill();
    c.fillStyle = '#6d7885';
    c.textAlign = 'center';
    c.font = `400 ${h * 0.032}px ${JP}`;
    c.fillText(days[i], x0 + i * bw + bw / 2, y1 + h * 0.05);
  });
}

function navi(c: CanvasRenderingContext2D, w: number, h: number, s: ScreenState, top: number, bottom: number, t: number) {
  c.save();
  c.beginPath();
  c.rect(0, top, w, bottom - top);
  c.clip();
  c.fillStyle = '#0a1016';
  c.fillRect(0, top, w, bottom - top);
  // blocks + roads
  c.strokeStyle = '#18222d';
  c.lineWidth = 10;
  for (let i = -2; i < 12; i++) {
    c.beginPath();
    c.moveTo(i * 110 - 60, top);
    c.lineTo(i * 110 + 80, bottom);
    c.stroke();
  }
  for (let j = 0; j < 6; j++) {
    c.beginPath();
    c.moveTo(0, top + j * 95 + 20);
    c.lineTo(w, top + j * 95 - 10);
    c.stroke();
  }
  c.fillStyle = '#10324a';
  c.beginPath();
  c.moveTo(0, bottom - 40);
  c.bezierCurveTo(w * 0.3, bottom - 110, w * 0.6, bottom - 10, w, bottom - 90);
  c.lineTo(w, bottom);
  c.lineTo(0, bottom);
  c.fill();
  // route
  const pts: [number, number][] = [[w * 0.18, bottom - 60], [w * 0.3, top + 290], [w * 0.52, top + 250], [w * 0.62, top + 120], [w * 0.8, top + 90]];
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = hexA(s.ambient, 0.35);
  c.lineWidth = 16;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
  c.strokeStyle = s.ambient;
  c.lineWidth = 6;
  c.setLineDash([22, 14]);
  c.lineDashOffset = -t * 40;
  c.stroke();
  c.setLineDash([]);
  // car + pin
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(pts[0][0], pts[0][1], 11, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = s.ambient;
  c.beginPath();
  c.arc(pts[4][0], pts[4][1], 14, 0, Math.PI * 2);
  c.fill();
  // card
  c.fillStyle = 'rgba(8,12,17,0.92)';
  roundRect(c, w * 0.03, top + 18, w * 0.38, h * 0.2, 14);
  c.fill();
  c.textAlign = 'left';
  c.fillStyle = '#ffffff';
  c.font = `500 ${h * 0.045}px ${JP}`;
  c.fillText('みらい市 充電ステーション', w * 0.05, top + 18 + h * 0.075);
  c.fillStyle = '#8b96a3';
  c.font = `400 ${h * 0.036}px ${JP}`;
  c.fillText('12分・6.4 km・到着時 78%', w * 0.05, top + 18 + h * 0.145);
  c.restore();
}

function media(c: CanvasRenderingContext2D, w: number, h: number, s: ScreenState, top: number, bottom: number, t: number) {
  const size = (bottom - top) * 0.7;
  const x = w * 0.08;
  const y = top + (bottom - top - size) / 2;
  const g = c.createLinearGradient(x, y, x + size, y + size);
  g.addColorStop(0, s.ambient);
  g.addColorStop(1, '#0d1420');
  c.fillStyle = g;
  roundRect(c, x, y, size, size, 16);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.7)';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(x + size / 2, y + size * 0.95, size * 0.62, Math.PI * 1.2, Math.PI * 1.8);
  c.stroke();
  c.textAlign = 'left';
  c.fillStyle = '#ffffff';
  c.font = `500 ${h * 0.065}px ${JP}`;
  c.fillText('夜明けの環状線', x + size + w * 0.05, y + size * 0.3);
  c.fillStyle = '#8b96a3';
  c.font = `400 ${h * 0.042}px ${JP}`;
  c.fillText('凪 — 「Arc」より', x + size + w * 0.05, y + size * 0.3 + h * 0.08);
  const px = x + size + w * 0.05;
  const pw = w - px - w * 0.06;
  const prog = ((t * 0.01) % 1 + 0.32) % 1;
  c.fillStyle = '#1b222b';
  roundRect(c, px, y + size * 0.62, pw, 6, 3);
  c.fill();
  c.fillStyle = '#ffffff';
  roundRect(c, px, y + size * 0.62, pw * prog, 6, 3);
  c.fill();
  // eq bars
  for (let i = 0; i < 28; i++) {
    const v = 0.3 + 0.7 * Math.abs(Math.sin(t * 2.1 + i * 0.7) * Math.sin(t * 1.3 + i * 0.31));
    c.fillStyle = hexA(s.ambient, 0.8);
    c.fillRect(px + i * (pw / 28), y + size * 0.95 - v * 40, pw / 28 - 4, v * 40);
  }
}
