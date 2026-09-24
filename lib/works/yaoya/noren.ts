// 暖簾 — a verlet cloth noren hanging in the shop entrance. Scroll walks you through it.
import * as T from 'three';
import { canvas, drawCrest, mottle, paintDisplay, paintProduce, rng } from './paint';
import type { ProduceId } from './data';

export type NorenCtl = { setProgress: (p: number) => void; dispose: () => void };

const ROD_Y = 1.08;
const KINARI = '#efe7d4';
const INDIGO = '#1a2c4e';

// ---------------------------------------------------------------- textures
async function fontsReady() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('200px "Yuji Syuku"', 'やおやみらい青果創業昭和三十八年'),
        document.fonts.load('40px "Yomogi"', '本日の入荷朝どれキャベツ円'),
      ]),
      new Promise((r) => setTimeout(r, 1400)),
    ]);
  } catch {
    /* fall back to whatever is available */
  }
}

function norenTexture(W: number, L: number, panels: { x0: number; x1: number }[], narrow: boolean) {
  const PX = narrow ? 560 : 640; // px per unit
  const cw = Math.round(W * PX),
    ch = Math.round(L * PX);
  const cv = canvas(cw, ch);
  const c = cv.getContext('2d')!;
  const r = rng(21);
  // base indigo with dye unevenness
  c.fillStyle = INDIGO;
  c.fillRect(0, 0, cw, ch);
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = 0.55;
  c.drawImage(mottle(), 0, 0, cw, ch);
  c.globalCompositeOperation = 'screen';
  c.globalAlpha = 0.18;
  c.drawImage(mottle(), 60, 30, 120, 120, -cw * 0.2, 0, cw * 1.4, ch);
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 260; i++) {
    const x = r() * cw;
    c.globalAlpha = 0.03 + r() * 0.05;
    c.fillStyle = r() < 0.5 ? '#3d5a8a' : '#0c1528';
    c.fillRect(x, r() * ch * 0.3, 1 + r() * 5, ch * (0.4 + r() * 0.7));
  }
  c.globalAlpha = 1;
  // letters layer (染め抜き)
  const Lc = canvas(cw, ch);
  const l = Lc.getContext('2d')!;
  l.fillStyle = '#fff';
  l.textAlign = 'center';
  l.textBaseline = 'middle';
  const sleeve = ch * 0.085;
  const vert = (text: string, p: { x0: number; x1: number }, size: number, top: number, gap = 1.02) => {
    const cx = ((p.x0 + p.x1) / 2) * PX;
    l.font = `400 ${size}px "Yuji Syuku", "Zen Old Mincho", serif`;
    text.split('').forEach((ch2, i) => l.fillText(ch2, cx, top + size * (0.5 + i * gap)));
  };
  const n = panels.length;
  const charSize = Math.min((panels[0].x1 - panels[0].x0) * PX * 0.62, (ch - sleeve) * 0.25);
  const top = sleeve + (ch - sleeve) * 0.1;
  vert('やおや', panels[0], charSize, top);
  vert('みらい', panels[n - 1], charSize, top);
  // crest in the middle (split by the slit when there are 4 panels)
  const mid = n === 4 ? (panels[1].x1 + panels[2].x0) / 2 : (panels[1].x0 + panels[1].x1) / 2;
  const R = Math.min(charSize * 1.25, (ch - sleeve) * 0.26);
  const crestY = top + R * 1.05;
  drawCrest(l, mid * PX, crestY, R, '#fff', 'rgba(0,0,0,1)');
  // punch the crest gaps out properly
  l.save();
  l.globalCompositeOperation = 'destination-out';
  drawCrest(l, mid * PX, crestY, R, 'rgba(0,0,0,0)', '#000');
  l.restore();
  if (n === 4) {
    l.font = `400 ${charSize * 0.42}px "Yuji Syuku", "Zen Old Mincho", serif`;
    const ty = crestY + R * 1.55;
    l.fillText('青 果', ((panels[1].x0 + panels[1].x1) / 2) * PX, ty);
    l.fillText('果 物', ((panels[2].x0 + panels[2].x1) / 2) * PX, ty);
  } else {
    l.font = `400 ${charSize * 0.36}px "Yuji Syuku", "Zen Old Mincho", serif`;
    l.fillText('青果・果物', mid * PX, crestY + R * 1.55);
  }
  // tint + resist speckle
  l.globalCompositeOperation = 'source-in';
  l.fillStyle = KINARI;
  l.fillRect(0, 0, cw, ch);
  l.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 9000; i++) {
    l.globalAlpha = 0.1 + r() * 0.35;
    l.fillStyle = r() < 0.7 ? '#6d82a8' : INDIGO;
    const s = 1 + r() * 3;
    l.fillRect(r() * cw, r() * ch, s, s * (0.5 + r()));
  }
  l.globalAlpha = 1;
  // bleed halo then letters
  c.save();
  c.shadowColor = 'rgba(120,145,190,0.75)';
  c.shadowBlur = 7;
  c.globalAlpha = 0.9;
  c.drawImage(Lc, 0, 0);
  c.restore();
  c.drawImage(Lc, 0, 0);
  // sleeve band + stitches, panel hems
  c.fillStyle = 'rgba(5,10,25,0.35)';
  c.fillRect(0, 0, cw, sleeve);
  c.strokeStyle = 'rgba(230,220,200,0.45)';
  c.lineWidth = 2;
  c.setLineDash([10, 8]);
  for (const p of panels) {
    const x0 = p.x0 * PX,
      x1 = p.x1 * PX;
    c.beginPath();
    c.moveTo(x0 + 10, sleeve);
    c.lineTo(x1 - 10, sleeve);
    c.moveTo(x0 + 10, ch - 14);
    c.lineTo(x1 - 10, ch - 14);
    c.moveTo(x0 + 9, sleeve);
    c.lineTo(x0 + 9, ch - 14);
    c.moveTo(x1 - 9, sleeve);
    c.lineTo(x1 - 9, ch - 14);
    c.stroke();
    const g = c.createLinearGradient(x0, 0, x0 + 18, 0);
    g.addColorStop(0, 'rgba(0,5,20,0.45)');
    g.addColorStop(1, 'rgba(0,5,20,0)');
    c.fillStyle = g;
    c.fillRect(x0, 0, 18, ch);
    const g2 = c.createLinearGradient(x1, 0, x1 - 18, 0);
    g2.addColorStop(0, 'rgba(0,5,20,0.45)');
    g2.addColorStop(1, 'rgba(0,5,20,0)');
    c.fillStyle = g2;
    c.fillRect(x1 - 18, 0, 18, ch);
  }
  c.setLineDash([]);
  const gb = c.createLinearGradient(0, ch - 30, 0, ch);
  gb.addColorStop(0, 'rgba(0,5,20,0)');
  gb.addColorStop(1, 'rgba(0,5,20,0.5)');
  c.fillStyle = gb;
  c.fillRect(0, ch - 30, cw, 30);
  return cv;
}

function weaveTexture() {
  const S = 64;
  const cv = canvas(S, S);
  const c = cv.getContext('2d')!;
  const img = c.createImageData(S, S);
  const r = rng(5);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const cell = (Math.floor(x / 4) + Math.floor(y / 4)) % 2;
      const t = cell ? (y % 4) / 4 : (x % 4) / 4;
      const v = 0.45 + 0.55 * Math.sin(Math.PI * t) + (r() - 0.5) * 0.2;
      const b = Math.max(0, Math.min(255, v * 230));
      img.data.set([b, b, b, 255], (y * S + x) * 4);
    }
  c.putImageData(img, 0, 0);
  return cv;
}

function woodBoards(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, board: number, base: [number, number, number], vertical = true, seed = 1) {
  const r = rng(seed);
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  const n = Math.ceil((vertical ? w : h) / board);
  for (let i = 0; i < n; i++) {
    const k = 0.85 + r() * 0.3;
    c.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`;
    if (vertical) c.fillRect(x + i * board, y, board, h);
    else c.fillRect(x, y + i * board, w, board);
    // grain
    for (let j = 0; j < 14; j++) {
      c.strokeStyle = `rgba(20,10,4,${0.08 + r() * 0.12})`;
      c.lineWidth = 0.6 + r();
      c.beginPath();
      if (vertical) {
        const gx = x + i * board + r() * board;
        c.moveTo(gx, y);
        c.bezierCurveTo(gx + (r() - 0.5) * 8, y + h * 0.3, gx + (r() - 0.5) * 8, y + h * 0.7, gx + (r() - 0.5) * 4, y + h);
      } else {
        const gy = y + i * board + r() * board;
        c.moveTo(x, gy);
        c.bezierCurveTo(x + w * 0.3, gy + (r() - 0.5) * 6, x + w * 0.7, gy + (r() - 0.5) * 6, x + w, gy);
      }
      c.stroke();
    }
    c.fillStyle = 'rgba(10,5,2,0.55)';
    if (vertical) c.fillRect(x + i * board, y, 2, h);
    else c.fillRect(x, y + i * board, w, 3);
    c.fillStyle = 'rgba(255,220,170,0.08)';
    if (vertical) c.fillRect(x + i * board + 2, y, 2, h);
    else c.fillRect(x, y + i * board + 3, w, 2);
  }
  c.restore();
}

/** facade: 10 × 5 units, x∈[-5,5], y∈[-1.3,3.7]; opening cut out */
function facadeTexture(open: { x: number; top: number }) {
  const U = 204.8;
  const cw = 2048,
    ch = 1024;
  const cv = canvas(cw, ch);
  const c = cv.getContext('2d')!;
  const X = (x: number) => (x + 5) * U,
    Y = (y: number) => (3.7 - y) * U;
  // upper plaster wall
  c.fillStyle = '#b9ab8e';
  c.fillRect(0, 0, cw, ch);
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = 0.5;
  c.drawImage(mottle(), 0, 0, cw, ch);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  // upstairs window with lattice
  for (const wx of [-2.6, 1.6]) {
    c.fillStyle = '#3a2c20';
    c.fillRect(X(wx), Y(3.35), 1.0 * U, 0.62 * U);
    c.fillStyle = '#e8c890';
    c.fillRect(X(wx) + 8, Y(3.35) + 8, 1.0 * U - 16, 0.62 * U - 16);
    c.fillStyle = '#4a3422';
    for (let i = 0; i < 12; i++) c.fillRect(X(wx) + 8 + i * ((U - 16) / 12), Y(3.35), 5, 0.62 * U);
  }
  // eave (庇) with tiles + shadow
  c.fillStyle = '#2b2a2c';
  c.fillRect(0, Y(2.55), cw, 0.3 * U);
  for (let i = 0; i < 80; i++) {
    c.fillStyle = i % 2 ? '#3a3a3e' : '#46464b';
    c.beginPath();
    c.ellipse(i * 26, Y(2.27), 13, 9, 0, 0, Math.PI);
    c.fill();
  }
  const sh = c.createLinearGradient(0, Y(2.25), 0, Y(1.7));
  sh.addColorStop(0, 'rgba(10,6,4,0.75)');
  sh.addColorStop(1, 'rgba(10,6,4,0)');
  // lower walls: dark boards
  woodBoards(c, 0, Y(2.25), cw, ch - Y(2.25), 34, [70, 48, 32], true, 3);
  // sign board 看板
  const sx0 = X(-1.55),
    sx1 = X(1.55),
    sy0 = Y(1.98),
    sy1 = Y(1.36);
  c.fillStyle = '#20150d';
  c.fillRect(sx0 - 10, sy0 - 10, sx1 - sx0 + 20, sy1 - sy0 + 20);
  woodBoards(c, sx0, sy0, sx1 - sx0, sy1 - sy0, 200, [178, 132, 82], false, 9);
  c.fillStyle = 'rgba(40,20,5,0.25)';
  c.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `400 ${0.34 * U}px "Yuji Syuku", "Zen Old Mincho", serif`;
  c.fillStyle = 'rgba(255,230,190,0.35)';
  c.fillText('青果 み ら い', (sx0 + sx1) / 2 + 2, (sy0 + sy1) / 2 + 3);
  c.fillStyle = '#1b120a';
  c.fillText('青果 み ら い', (sx0 + sx1) / 2, (sy0 + sy1) / 2);
  c.font = `400 ${0.058 * U}px "Yuji Syuku", serif`;
  '創業昭和三十八年'.split('').forEach((ch, i) => c.fillText(ch, sx0 + 0.14 * U, sy0 + 0.08 * U + i * 0.061 * U));
  'みらい銀座'.split('').forEach((ch, i) => c.fillText(ch, sx1 - 0.14 * U, sy0 + 0.16 * U + i * 0.064 * U));
  c.restore();
  c.fillStyle = sh;
  c.fillRect(0, Y(2.25), cw, 0.55 * U);
  // lintel (鴨居)
  woodBoards(c, X(-open.x - 0.25), Y(open.top + 0.2), (open.x + 0.25) * 2 * U, 0.2 * U, 60, [120, 84, 50], false, 4);
  // pillars
  for (const s of [-1, 1]) {
    const px = s < 0 ? X(-open.x - 0.22) : X(open.x);
    woodBoards(c, px, Y(open.top + 0.2), 0.22 * U, ch, 45, [128, 90, 54], true, 6 + s);
    const g = c.createLinearGradient(px, 0, px + 0.22 * U, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(0.5, 'rgba(255,230,190,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0.4)');
    c.fillStyle = g;
    c.fillRect(px, Y(open.top + 0.2), 0.22 * U, ch);
  }
  // lattice window, right
  const lx = X(2.3),
    ly = Y(1.2);
  c.fillStyle = '#ffd28a';
  c.fillRect(lx, ly, 1.3 * U, 0.95 * U);
  const lg = c.createRadialGradient(lx + 0.65 * U, ly + 0.5 * U, 10, lx + 0.65 * U, ly + 0.5 * U, 1.1 * U);
  lg.addColorStop(0, 'rgba(255,200,120,0)');
  lg.addColorStop(1, 'rgba(120,60,20,0.6)');
  c.fillStyle = lg;
  c.fillRect(lx, ly, 1.3 * U, 0.95 * U);
  c.fillStyle = '#3a2616';
  for (let i = 0; i <= 18; i++) c.fillRect(lx + i * ((1.3 * U) / 18) - 3, ly, 6, 0.95 * U);
  c.fillRect(lx - 8, ly - 8, 1.3 * U + 16, 12);
  c.fillRect(lx - 8, ly + 0.95 * U - 4, 1.3 * U + 16, 12);
  // opening cut-out
  c.clearRect(X(-open.x), Y(open.top), open.x * 2 * U, ch);
  return cv;
}

/** interior back wall: width 7, height 3.6, y∈[-1.3, 2.3] */
function interiorTexture() {
  const U = 290;
  const cw = 2030,
    ch = 1044;
  const cv = canvas(cw, ch);
  const c = cv.getContext('2d')!;
  const X = (x: number) => (x + 3.5) * U,
    Y = (y: number) => (2.3 - y) * U;
  // wall
  const g = c.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, '#5a3c22');
  g.addColorStop(0.5, '#a57a4a');
  g.addColorStop(1, '#3a2614');
  c.fillStyle = g;
  c.fillRect(0, 0, cw, ch);
  woodBoards(c, 0, 0, cw, ch, 70, [150, 108, 66], true, 12);
  // warm light pools
  for (const lx of [-1.3, 0, 1.3]) {
    const rg = c.createRadialGradient(X(lx), Y(1.1), 10, X(lx), Y(0.9), 1.4 * U);
    rg.addColorStop(0, 'rgba(255,214,150,0.55)');
    rg.addColorStop(1, 'rgba(255,214,150,0)');
    c.fillStyle = rg;
    c.fillRect(0, 0, cw, ch);
  }
  // chalkboard in the middle
  const bx = X(-0.62),
    by = Y(1.25),
    bw = 1.24 * U,
    bh = 0.82 * U;
  c.fillStyle = '#8a5a30';
  c.fillRect(bx - 14, by - 14, bw + 28, bh + 28);
  c.fillStyle = '#26382f';
  c.fillRect(bx, by, bw, bh);
  c.globalAlpha = 0.12;
  c.drawImage(mottle(), bx, by, bw, bh);
  c.globalAlpha = 1;
  c.fillStyle = 'rgba(240,238,225,0.9)';
  c.font = `400 ${0.11 * U}px "Yomogi", cursive`;
  c.textAlign = 'left';
  c.fillText('本日の入荷', bx + 0.08 * U, by + 0.17 * U);
  c.font = `400 ${0.065 * U}px "Yomogi", cursive`;
  ['朝どれキャベツ', '紅はるか', '秋なす', '刀根早生 柿'].forEach((t, i) => c.fillText(`・${t}`, bx + 0.1 * U, by + (0.3 + i * 0.11) * U));
  c.fillStyle = 'rgba(246,226,122,0.9)';
  ['198', '180', '150', '98'].forEach((t, i) => c.fillText(t, bx + 0.92 * U, by + (0.3 + i * 0.11) * U));
  // shelves with produce, two rows each side
  const rows: [number, ProduceId[], ProduceId[]][] = [
    [0.95, ['mikan', 'kaki'], ['onion', 'shiitake']],
    [0.28, ['cabbage', 'hakusai'], ['daikon', 'negi']],
  ];
  for (const [y, left, right] of rows) {
    for (const [ids, x0] of [
      [left, -3.2],
      [right, 0.95],
    ] as [ProduceId[], number][]) {
      ids.forEach((id, i) => {
        const img = paintDisplay(id, id === 'mikan' || id === 'kaki' || id === 'onion' || id === 'shiitake' ? 'zaru' : 'crate', 0.62);
        const w = 1.1 * U;
        c.drawImage(img, X(x0 + i * 1.15), Y(y) - w * (170 / 320) + 12, w, w * (170 / 320));
      });
      c.fillStyle = '#6a4424';
      c.fillRect(X(x0) - 10, Y(y), 2.35 * U, 16);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(X(x0) - 10, Y(y) + 16, 2.35 * U, 10);
    }
  }
  // strings of price tags
  c.strokeStyle = 'rgba(240,220,180,0.6)';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, Y(1.75));
  c.quadraticCurveTo(cw / 2, Y(1.55), cw, Y(1.75));
  c.stroke();
  const r = rng(3);
  for (let i = 0; i < 16; i++) {
    const x = (i + 0.5) * (cw / 16);
    const t = x / cw;
    const yy = Y(1.75) + Math.sin(t * Math.PI) * (Y(1.55) - Y(1.75));
    c.fillStyle = ['#fff07a', '#ffc3d3', '#fffcf2', '#d7f2a6'][i % 4];
    c.save();
    c.translate(x, yy);
    c.rotate((r() - 0.5) * 0.2);
    c.fillRect(-18, 4, 36, 44);
    c.fillStyle = '#c0281c';
    c.font = `400 18px "Yomogi", cursive`;
    c.textAlign = 'center';
    c.fillText(['98', '150', '198', '248'][i % 4], 0, 36);
    c.restore();
  }
  // floor shadow
  const fg = c.createLinearGradient(0, Y(-0.6), 0, ch);
  fg.addColorStop(0, 'rgba(20,10,4,0)');
  fg.addColorStop(1, 'rgba(20,10,4,0.8)');
  c.fillStyle = fg;
  c.fillRect(0, Y(-0.6), cw, ch);
  return cv;
}

/** a slanted display table with a row of holders: width w units, height h */
function tableTexture(ids: ProduceId[], w: number, h: number, seed: number) {
  const U = 300;
  const cw = Math.round(w * U),
    ch = Math.round(h * U);
  const cv = canvas(cw, ch);
  const c = cv.getContext('2d')!;
  const top = ch * 0.42;
  // table body
  woodBoards(c, 0, top, cw, ch - top, 44, [150, 104, 60], false, seed);
  const g = c.createLinearGradient(0, top, 0, ch);
  g.addColorStop(0, 'rgba(255,220,170,0.25)');
  g.addColorStop(0.08, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.6)');
  c.fillStyle = g;
  c.fillRect(0, top, cw, ch - top);
  const n = ids.length;
  const dw = cw / n;
  ids.forEach((id, i) => {
    const holder = ['tomato', 'nasu', 'kaki', 'mikan', 'shiitake', 'onion'].includes(id) ? 'zaru' : 'crate';
    const img = paintDisplay(id, holder, (dw / 320) * 1.05);
    c.drawImage(img, i * dw - dw * 0.02, top - dw * (170 / 320) * 0.78, dw * 1.04, dw * (170 / 320) * 1.04);
  });
  // tiny POP cards on the front edge
  const r = rng(seed * 7);
  ids.forEach((_, i) => {
    const x = (i + 0.3 + r() * 0.4) * dw;
    c.save();
    c.translate(x, top + ch * 0.12);
    c.rotate((r() - 0.5) * 0.2);
    c.fillStyle = ['#fff07a', '#fffcf2', '#ffc3d3', '#d7f2a6'][i % 4];
    c.shadowColor = 'rgba(0,0,0,0.4)';
    c.shadowBlur = 6;
    c.fillRect(-dw * 0.13, 0, dw * 0.26, dw * 0.16);
    c.shadowColor = 'transparent';
    c.fillStyle = '#c0281c';
    c.font = `400 ${dw * 0.085}px "Yomogi", cursive`;
    c.textAlign = 'center';
    c.fillText(['198', '158', '298', '150', '98', '180'][(i + seed) % 6], 0, dw * 0.12);
    c.restore();
  });
  return cv;
}

function groundTexture() {
  const cw = 1024,
    ch = 1024;
  const cv = canvas(cw, ch);
  const c = cv.getContext('2d')!;
  // z from -3.5 (top of canvas) to 6.5 (bottom); x from -6 to 6
  const Z = (z: number) => ((z + 3.5) / 10) * ch;
  // inside: 土間 concrete
  c.fillStyle = '#4a3a2c';
  c.fillRect(0, 0, cw, Z(0));
  c.globalAlpha = 0.5;
  c.globalCompositeOperation = 'multiply';
  c.drawImage(mottle(), 0, 0, cw, Z(0));
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  // outside: arcade tiles
  const r = rng(8);
  const tile = 40;
  c.fillStyle = '#3a342e';
  c.fillRect(0, Z(0.06), cw, ch - Z(0.06));
  for (let y = Z(0.06); y < ch; y += tile)
    for (let x = 0; x < cw; x += tile) {
      const k = 0.85 + r() * 0.25;
      c.fillStyle = `rgb(${96 * k},${90 * k},${82 * k})`;
      c.fillRect(x + 1.5, y + 1.5, tile - 3, tile - 3);
    }
  // threshold
  c.fillStyle = '#6a4a2a';
  c.fillRect(0, Z(-0.04), cw, Z(0.08) - Z(-0.04));
  // light spill from the shop
  const g = c.createRadialGradient(cw / 2, Z(0), 10, cw / 2, Z(0.2), 330);
  g.addColorStop(0, 'rgba(255,190,110,0.55)');
  g.addColorStop(1, 'rgba(255,190,110,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, cw, ch);
  // fade to dusk toward the camera
  const f = c.createLinearGradient(0, Z(2), 0, ch);
  f.addColorStop(0, 'rgba(20,18,24,0)');
  f.addColorStop(1, 'rgba(20,18,24,0.7)');
  c.fillStyle = f;
  c.fillRect(0, Z(2), cw, ch - Z(2));
  return cv;
}

function glowTexture(color: string) {
  const cv = canvas(128, 128);
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color.replace(/[\d.]+\)$/, '0.35)'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  return cv;
}

// ---------------------------------------------------------------- cloth
type Cloth = {
  n: number;
  pos: Float32Array;
  prev: Float32Array;
  inv: Float32Array;
  rest: Float32Array;
  cons: Uint16Array | Uint32Array;
  crease: Float32Array;
  stiff: Float32Array;
  geo: T.BufferGeometry;
  cols: number;
  rows: number;
  panels: number;
};

function buildCloth(W: number, L: number, N: number, cols: number, rows: number) {
  const gap = 0.03;
  const pw = (W - gap * (N - 1)) / N;
  const panels: { x0: number; x1: number }[] = [];
  const per = cols * rows;
  const n = per * N;
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const inv = new Float32Array(n);
  const crease = new Float32Array(n);
  const idx: number[] = [];
  const cons: number[] = [];
  const stiff: number[] = [];
  for (let p = 0; p < N; p++) {
    const x0 = -W / 2 + p * (pw + gap);
    panels.push({ x0: x0 + W / 2, x1: x0 + pw + W / 2 });
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = p * per + r * cols + c;
        const u = c / (cols - 1),
          v = r / (rows - 1);
        const x = x0 + u * pw;
        // the sleeve gathers the cloth on the rod: pin the top a little narrower than the cloth
        const gather = r === 0 ? 0.8 : 1;
        pos[i * 3] = x0 + pw / 2 + (x - x0 - pw / 2) * gather;
        pos[i * 3 + 1] = ROD_Y - v * L;
        pos[i * 3 + 2] = 0.03 + (r === 0 ? Math.sin(u * Math.PI * 4 + p) * 0.012 : Math.sin(u * Math.PI * 3 + p) * 0.03 * Math.min(1, v * 3));
        uv[i * 2] = (x + W / 2) / W;
        uv[i * 2 + 1] = 1 - v;
        inv[i] = r === 0 ? 0 : r === rows - 1 ? 0.55 : 1;
        crease[i] = 0.03 + Math.sin(u * Math.PI * 3.3 + p * 1.9) * 0.026 * (0.35 + 0.65 * v);
        if (r < rows - 1 && c < cols - 1) {
          const a = i,
            b = i + 1,
            d = i + cols,
            e = i + cols + 1;
          idx.push(a, d, b, b, d, e);
        }
        const link = (j: number, k: number) => {
          cons.push(i, j);
          stiff.push(k);
        };
        if (c < cols - 1) link(i + 1, 1);
        if (r < rows - 1) link(i + cols, 1);
        if (c < cols - 1 && r < rows - 1) link(i + cols + 1, 0.6);
        if (c > 0 && r < rows - 1) link(i + cols - 1, 0.6);
        if (c < cols - 2) link(i + 2, 0.08);
        if (r < rows - 2) link(i + cols * 2, 0.35);
      }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos.slice(), 3));
  geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const C = new Uint32Array(cons);
  const rest = new Float32Array(stiff.length);
  const dx0 = pw / (cols - 1),
    dy0 = L / (rows - 1);
  for (let k = 0; k < stiff.length; k++) {
    const a = C[k * 2],
      b = C[k * 2 + 1];
    const ca = a % cols,
      ra = Math.floor((a % per) / cols);
    const cb = b % cols,
      rb = Math.floor((b % per) / cols);
    rest[k] = Math.hypot((cb - ca) * dx0, (rb - ra) * dy0);
  }
  const cloth: Cloth = { n, pos, prev: pos.slice(), inv, crease, rest, cons: C, stiff: new Float32Array(stiff), geo, cols, rows, panels: N };
  return { cloth, panels };
}

const vert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vUv = uv;
  vN = normal;
  vW = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const frag = /* glsl */ `
uniform sampler2D map;
uniform sampler2D weave;
uniform vec2 weaveRep;
uniform vec3 keyDir;
uniform vec3 keyCol;
uniform vec3 ambTop;
uniform vec3 ambBot;
uniform vec3 backPos;
uniform vec3 backCol;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  vec4 tex = texture2D(map, vUv);
  float wv = texture2D(weave, vUv * weaveRep).r;
  vec3 alb = tex.rgb * (0.82 + 0.3 * wv);
  float ndl = dot(N, keyDir);
  float wrap = clamp((ndl + 0.12) / 1.12, 0.0, 1.0);
  wrap = wrap * wrap * 1.25;
  vec3 amb = mix(ambBot, ambTop, N.y * 0.5 + 0.5);
  vec3 col = alb * (amb + keyCol * wrap);
  vec3 Lb = normalize(backPos - vW);
  float through = clamp(-dot(N, Lb), 0.0, 1.0);
  float whiteness = smoothstep(0.25, 0.7, dot(tex.rgb, vec3(0.33)));
  vec3 transAlb = mix(vec3(0.05, 0.09, 0.2), vec3(1.0, 0.86, 0.62), whiteness);
  col += transAlb * backCol * (0.25 + 0.75 * through) * (0.55 + 0.45 * wv);
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  col += rim * ambTop * 0.25;
  col *= mix(0.45, 1.0, smoothstep(0.0, 0.07, 1.0 - vUv.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------- mount
export function mountNoren(host: HTMLElement, o: { reduced: boolean; narrow: boolean; onReady?: () => void }): NorenCtl {
  let disposed = false;
  let progress = 0;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.setClearColor('#120c08');
  host.appendChild(renderer.domElement);
  const scene = new T.Scene();
  scene.fog = new T.Fog('#1a130e', 9, 18);
  const camera = new T.PerspectiveCamera(38, 1, 0.03, 40);
  const disposables: { dispose: () => void }[] = [];
  const tex = (cv: HTMLCanvasElement, srgb = true) => {
    const t = new T.CanvasTexture(cv);
    if (srgb) t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    disposables.push(t);
    return t;
  };
  const plane = (w: number, h: number, map: T.Texture, x: number, y: number, z: number, transparent = true) => {
    const g = new T.PlaneGeometry(w, h);
    const m = new T.MeshBasicMaterial({ map, transparent, toneMapped: false, depthWrite: !transparent || true, alphaTest: transparent ? 0.02 : 0 });
    disposables.push(g, m);
    const mesh = new T.Mesh(g, m);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  const narrow = o.narrow;
  const N = narrow ? 3 : 4;
  const W = narrow ? 2.5 : 3.14;
  const L = narrow ? 1.95 : 1.34;
  const cols = narrow ? 11 : 11;
  const rows = narrow ? 30 : 22;
  const openX = narrow ? 1.42 : 1.75;
  const { cloth, panels } = buildCloth(W, L, N, cols, rows);

  let clothMat: T.ShaderMaterial | null = null;
  let running = false;
  let visible = true;
  let raf = 0;

  // pointer
  const pointer = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, active: false, down: false, t: 0, nx: 0, ny: 0 };
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  const hit = new T.Vector3();
  const planeZ = new T.Plane(new T.Vector3(0, 0, 1), -0.02);
  const toWorld = (cx: number, cy: number) => {
    const r = host.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    pointer.nx = ndc.x;
    pointer.ny = ndc.y;
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(planeZ, hit);
  };
  const onMove = (e: PointerEvent) => {
    const p = toWorld(e.clientX, e.clientY);
    if (!p) return;
    const now = performance.now();
    const dt = Math.max(8, now - pointer.t) / 1000;
    if (pointer.active) {
      pointer.vx = pointer.vx * 0.5 + ((p.x - pointer.x) / dt) * 0.5;
      pointer.vy = pointer.vy * 0.5 + ((p.y - pointer.y) / dt) * 0.5;
    }
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.t = now;
    pointer.active = true;
    wake();
  };
  const onDown = (e: PointerEvent) => {
    pointer.down = true;
    onMove(e);
  };
  const onUp = () => {
    pointer.down = false;
  };
  const onLeave = () => {
    pointer.active = false;
    pointer.down = false;
  };
  if (!o.reduced) {
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerdown', onDown);
    addEventListener('pointerup', onUp);
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('pointercancel', onLeave);
  }

  // ---- simulation
  const tmpPos = cloth.geo.getAttribute('position') as T.BufferAttribute;
  let time = 0;
  const body = { x: 0, y: -0.1, z: 10, r: 0.5 };
  let hands = 0;
  function simulate(dt: number, wind: number) {
    const { pos, prev, inv, cons, rest, stiff, n, crease } = cloth;
    const nrm = cloth.geo.getAttribute('normal') as T.BufferAttribute;
    const na = nrm.array as Float32Array;
    time += dt;
    const gust = 0.55 + 0.45 * Math.sin(time * 0.43) * Math.sin(time * 0.17 + 1.3) + 0.35 * Math.max(0, Math.sin(time * 0.9 + Math.sin(time * 0.3) * 3));
    const wx = 0.28,
      wz = -1;
    const dt2 = dt * dt;
    const damp = 0.986;
    const pr = pointer.down ? 0.32 : 0.2;
    for (let i = 0; i < n; i++) {
      if (inv[i] === 0) continue;
      const k = i * 3;
      const x = pos[k],
        y = pos[k + 1],
        z = pos[k + 2];
      const nx = na[k],
        ny = na[k + 1],
        nz = na[k + 2];
      const flow = wind * gust * (0.7 + 0.3 * Math.sin(x * 2.1 + time * 1.7 + y * 1.3));
      const press = (nx * wx + nz * wz) * flow * 3.2;
      let ax = nx * press,
        ay = -9.8 + ny * press,
        az = nz * press + Math.sin(time * 2.6 + x * 4 + y * 3) * 0.35 * wind + (crease[i] - z) * 6;
      // hands parting the center
      if (hands > 0) {
        const sx = Math.sign(x) || 1;
        const cf = Math.max(0, 1 - Math.abs(x) / 1.1);
        const hy = Math.exp(-((y - 0.15) * (y - 0.15)) / 0.4);
        ax += sx * hands * 38 * cf * hy;
        az -= hands * 14 * cf * hy;
      }
      const vx = (x - prev[k]) * damp,
        vy = (y - prev[k + 1]) * damp,
        vz = (z - prev[k + 2]) * damp;
      prev[k] = x;
      prev[k + 1] = y;
      prev[k + 2] = z;
      pos[k] = x + vx + ax * dt2;
      pos[k + 1] = y + vy + ay * dt2;
      pos[k + 2] = z + vz + az * dt2;
      // pointer: the hand brushing / pushing through
      if (pointer.active) {
        const dx = pos[k] - pointer.x,
          dy = pos[k + 1] - pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < pr) {
          const f = 1 - d / pr;
          pos[k + 2] -= f * (pointer.down ? 0.012 : 0.006);
          const follow = pointer.down ? 0.34 : 0.14;
          const pvx = Math.max(-3, Math.min(3, pointer.vx)),
            pvy = Math.max(-3, Math.min(3, pointer.vy));
          pos[k] += pvx * dt * f * follow;
          pos[k + 1] += pvy * dt * f * follow * 0.2;
        }
      }
      // walking body
      const bx = pos[k] - body.x,
        by = (pos[k + 1] - body.y) * 0.55,
        bz = pos[k + 2] - body.z;
      const bd = Math.hypot(bx, by, bz);
      if (bd < body.r && bd > 1e-5) {
        const s = body.r / bd;
        pos[k] = body.x + bx * s;
        pos[k + 1] = body.y + (by * s) / 0.55;
        pos[k + 2] = body.z + bz * s;
      }
    }
    for (let it = 0; it < 10; it++) {
      for (let c = 0; c < rest.length; c++) {
        const a = cons[c * 2],
          b = cons[c * 2 + 1];
        const wa = inv[a],
          wb = inv[b];
        const ws = wa + wb;
        if (!ws) continue;
        const ka = a * 3,
          kb = b * 3;
        const dx = pos[kb] - pos[ka],
          dy = pos[kb + 1] - pos[ka + 1],
          dz = pos[kb + 2] - pos[ka + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = ((d - rest[c]) / (d * ws)) * stiff[c];
        pos[ka] += dx * diff * wa;
        pos[ka + 1] += dy * diff * wa;
        pos[ka + 2] += dz * diff * wa;
        pos[kb] -= dx * diff * wb;
        pos[kb + 1] -= dy * diff * wb;
        pos[kb + 2] -= dz * diff * wb;
      }
    }
    (tmpPos.array as Float32Array).set(pos);
    tmpPos.needsUpdate = true;
    cloth.geo.computeVertexNormals();
    cloth.geo.computeBoundingSphere();
    pointer.vx *= 0.85;
    pointer.vy *= 0.85;
  }

  // ---- camera path
  let aspect = 1;
  let baseZ = 4.4;
  let offX = 0;
  const resize = () => {
    const w = host.clientWidth || innerWidth,
      h = host.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 0.8 ? 48 : 36;
    camera.updateProjectionMatrix();
    const halfV = Math.tan((camera.fov * Math.PI) / 360);
    // fit the opening (plus pillars) horizontally, the noren + sign vertically
    const wide = aspect >= 1.2;
    const needW = wide ? openX + 1.55 : aspect < 0.8 ? W / 2 + 0.26 : openX + 0.45;
    const zW = needW / (halfV * aspect);
    const zH = 1.8 / halfV;
    baseZ = Math.min(7.5, Math.max(zW, aspect < 0.8 ? 0 : zH * 0.95, 3.2));
    offX = wide ? -Math.min(0.8, (needW - openX - 0.6) * 0.8) : 0;
    if (!running) render();
  };
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const look = new T.Vector3();
  function placeCamera() {
    const p = progress;
    const e = ease(Math.min(1, p * 1.05));
    const z = baseZ + (-0.35 - baseZ) * e;
    const duck = Math.exp(-Math.pow((z - 0.7) / 0.7, 2));
    const narrowLift = aspect < 0.8 ? -0.36 : 0;
    const wideLift = aspect >= 1.2 ? 0.26 : 0;
    const par = o.reduced ? 0 : 1;
    camera.position.set(offX * (1 - e) + pointer.nx * 0.08 * par * (1 - p), 0.22 + wideLift * (1 - e) - duck * 0.22, z);
    look.set(offX * (1 - e) + pointer.nx * 0.03 * par, 0.18 + (narrowLift + wideLift) * (1 - e) - duck * 0.45 + smooth(0.6, 1, p) * 0.55, z - 3);
    camera.lookAt(look);
    body.z = z - 0.32;
    body.x = 0;
    body.y = camera.position.y - 0.25;
    hands = smooth(0.1, 0.42, p) * (1 - smooth(0.8, 1, p));
  }
  function render() {
    placeCamera();
    renderer.render(scene, camera);
  }

  // ---- loop
  let last = 0;
  let idle = 0;
  function frame(t: number) {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.05, (t - (last || t)) / 1000 || 1 / 60);
    last = t;
    const steps = dt > 0.024 ? 2 : 1;
    for (let s = 0; s < steps; s++) simulate(1 / 60, 1 + progress * 0.6);
    for (const g of glows) g.material.opacity = g.userData.base * (0.92 + Math.sin(t * 0.004 + g.position.x * 9) * 0.05 + Math.sin(t * 0.017) * 0.03);
    render();
    idle += dt;
    if (running && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function wake() {
    idle = 0;
    if (!raf && running && visible && !document.hidden && !o.reduced) raf = requestAnimationFrame(frame);
  }
  const glows: T.Sprite[] = [];

  // ---- build the scene (fonts first so the dyed letters are right)
  void fontsReady().then(() => {
    if (disposed) return;
    const nTex = tex(norenTexture(W, L, panels, narrow));
    const wTex = tex(weaveTexture(), false);
    wTex.wrapS = wTex.wrapT = T.RepeatWrapping;
    clothMat = new T.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      side: T.DoubleSide,
      uniforms: {
        map: { value: nTex },
        weave: { value: wTex },
        weaveRep: { value: new T.Vector2(W * 90, L * 90) },
        keyDir: { value: new T.Vector3(-0.55, 0.55, 0.65).normalize() },
        keyCol: { value: new T.Color(1.0, 0.8, 0.6).multiplyScalar(1.0) },
        ambTop: { value: new T.Color(0.42, 0.5, 0.7).multiplyScalar(0.42) },
        ambBot: { value: new T.Color(0.3, 0.22, 0.16).multiplyScalar(0.45) },
        backPos: { value: new T.Vector3(0, 0.7, -2.2) },
        backCol: { value: new T.Color(1.0, 0.68, 0.36).multiplyScalar(0.32) },
      },
    });
    disposables.push(clothMat, cloth.geo);
    const clothMesh = new T.Mesh(cloth.geo, clothMat);
    clothMesh.frustumCulled = false;
    scene.add(clothMesh);

    // rod
    const rodG = new T.CylinderGeometry(0.026, 0.026, W + 0.36, 16);
    const rodM = new T.MeshStandardMaterial({ color: '#8a5a2e', roughness: 0.55, metalness: 0 });
    disposables.push(rodG, rodM);
    const rod = new T.Mesh(rodG, rodM);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, ROD_Y + 0.015, 0.03);
    scene.add(rod);
    const capG = new T.SphereGeometry(0.036, 16, 12);
    const capM = new T.MeshStandardMaterial({ color: '#b08a4a', roughness: 0.3, metalness: 0.6 });
    disposables.push(capG, capM);
    for (const s of [-1, 1]) {
      const cap = new T.Mesh(capG, capM);
      cap.position.set(s * (W / 2 + 0.18), ROD_Y + 0.015, 0.03);
      scene.add(cap);
    }
    scene.add(new T.HemisphereLight('#8aa0c8', '#3a2a1a', 1.2));
    const key = new T.DirectionalLight('#ffd6a8', 1.6);
    key.position.set(-3, 3, 4);
    scene.add(key);

    // facade, interior, tables, ground
    const openTop = ROD_Y + 0.06;
    plane(10, 5, tex(facadeTexture({ x: openX, top: openTop })), 0, 1.2, -0.06);
    plane(7, 3.6, tex(interiorTexture()), 0, 0.5, -3.3, false);
    plane(4.4, 1.25, tex(tableTexture(['cabbage', 'tomato', 'imo', 'mikan', 'daikon'], 4.4, 1.25, 2)), 0, -0.68, -1.7);
    if (narrow) plane(1.9, 1.05, tex(tableTexture(['kaki', 'negi'], 1.9, 1.05, 5)), -openX - 0.72, -0.79, 0.85);
    plane(1.9, 1.05, tex(tableTexture(['onion', 'nasu'], 1.9, 1.05, 7)), openX + 0.72, -0.79, 0.85);
    const gm = plane(12, 10, tex(groundTexture()), 0, -1.3, 1.5, false);
    gm.rotation.x = -Math.PI / 2;
    // side walls inside the opening so the reveal has depth
    for (const s of [-1, 1]) {
      const wcv = canvas(512, 512);
      const wc = wcv.getContext('2d')!;
      woodBoards(wc, 0, 0, 512, 512, 64, [120, 84, 50], true, 20 + s);
      wc.fillStyle = 'rgba(20,10,4,0.45)';
      wc.fillRect(0, 0, 512, 512);
      const wmesh = plane(3.3, 2.5, tex(wcv), s * openX, -0.05, -1.65, false);
      wmesh.rotation.y = -s * Math.PI / 2;
    }
    // ceiling
    const ccv = canvas(256, 256);
    const cc = ccv.getContext('2d')!;
    woodBoards(cc, 0, 0, 256, 256, 32, [60, 40, 24], false, 30);
    const ceil = plane(openX * 2, 3.3, tex(ccv), 0, openTop + 0.25, -1.65, false);
    ceil.rotation.x = Math.PI / 2;
    // bulbs
    const gTex = tex(glowTexture('rgba(255,200,120,1)'));
    for (const x of [-1.1, 0, 1.1]) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: gTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
      disposables.push(s.material);
      s.scale.set(1.1, 1.1, 1);
      s.position.set(x, 1.28, -2.5);
      s.userData.base = 0.85;
      scene.add(s);
      glows.push(s);
      const bG = new T.SphereGeometry(0.045, 12, 10);
      const bM = new T.MeshBasicMaterial({ color: '#fff4d6', toneMapped: false });
      disposables.push(bG, bM);
      const b = new T.Mesh(bG, bM);
      b.position.set(x, 1.28, -2.5);
      scene.add(b);
      const wG = new T.CylinderGeometry(0.004, 0.004, 0.5, 4);
      disposables.push(wG);
      const wire = new T.Mesh(wG, new T.MeshBasicMaterial({ color: '#111' }));
      disposables.push(wire.material as T.Material);
      wire.position.set(x, 1.55, -2.5);
      scene.add(wire);
    }
    // lantern glow on the facade
    const lTex = tex(glowTexture('rgba(255,150,80,1)'));
    const lan = new T.Sprite(new T.SpriteMaterial({ map: lTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 }));
    disposables.push(lan.material);
    lan.scale.set(2.2, 2.2, 1);
    lan.position.set(openX + 1.6, 0.7, 0.05);
    lan.userData.base = 0.4;
    scene.add(lan);
    glows.push(lan);

    // settle the cloth before the first frame
    for (let i = 0; i < (o.reduced ? 260 : 140); i++) simulate(1 / 60, o.reduced ? 0.25 : 0.8);
    resize();
    render();
    o.onReady?.();
    running = true;
    if (!o.reduced) wake();
  });
  void paintProduce;

  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) wake();
  });
  io.observe(host);
  const onVis = () => {
    if (!document.hidden) wake();
  };
  document.addEventListener('visibilitychange', onVis);
  resize();

  return {
    setProgress(p: number) {
      progress = p;
      if (o.reduced || !running) {
        if (running) render();
        return;
      }
      wake();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onDown);
      removeEventListener('pointerup', onUp);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('pointercancel', onLeave);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      void idle;
    },
  };
}
