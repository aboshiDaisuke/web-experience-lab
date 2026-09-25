import { AGE, type Title, type TitleId } from './data';

/**
 * Package art for the six fictional titles, painted on Canvas 2D.
 * Each title has its own key art (a different world, palette and brush);
 * covers, backs, spines and disc labels are composed from it.
 */

type C = CanvasRenderingContext2D;
const EN = 'Unbounded, "Arial Black", sans-serif';
const JP = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
const MIN = '"Zen Old Mincho", "Hiragino Mincho ProN", serif';
export const ART_W = 640;
export const ART_H = 800;

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const canvas = (w: number, h: number) => {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
};
const lin = (c: C, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, s]) => g.addColorStop(o, s));
  return g;
};
const rad = (c: C, x: number, y: number, r: number, stops: [number, string][]) => {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([o, s]) => g.addColorStop(o, s));
  return g;
};
const glowDot = (c: C, x: number, y: number, r: number, col: string, a = 1) => {
  c.globalAlpha = a;
  c.fillStyle = rad(c, x, y, r, [
    [0, col],
    [1, 'rgba(0,0,0,0)'],
  ]);
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.globalAlpha = 1;
};

// ── key arts (640 × 800) ─────────────────────────────────────────────────────

function neon(c: C) {
  const r = rng(11);
  c.fillStyle = lin(c, 0, 0, 0, 800, [
    [0, '#0d0426'],
    [0.45, '#3a0c5e'],
    [0.7, '#7a1466'],
    [1, '#1a0526'],
  ]);
  c.fillRect(0, 0, 640, 800);
  // haze glow behind the skyline
  glowDot(c, 330, 470, 380, 'rgba(255,62,138,0.55)');
  glowDot(c, 120, 300, 220, 'rgba(61,242,255,0.18)');
  // three layers of towers
  const layers = [
    { y: 560, hMin: 120, hMax: 360, col: '#2a0d4a', win: 0.25, a: 0.7 },
    { y: 620, hMin: 160, hMax: 460, col: '#170830', win: 0.35, a: 0.9 },
    { y: 700, hMin: 200, hMax: 560, col: '#0a0418', win: 0.45, a: 1 },
  ];
  layers.forEach((L, li) => {
    let x = -20;
    while (x < 660) {
      const w = 40 + r() * (70 + li * 20);
      const h = L.hMin + r() * (L.hMax - L.hMin);
      const top = L.y - h;
      c.fillStyle = L.col;
      c.fillRect(x, top, w, 800 - top);
      // antenna
      if (r() < 0.3) {
        c.fillRect(x + w * 0.5 - 1, top - 30, 2, 30);
        glowDot(c, x + w * 0.5, top - 30, 8, '#ff3e8a', 0.9);
      }
      // windows
      for (let wy = top + 10; wy < 800; wy += 12)
        for (let wx = x + 6; wx < x + w - 6; wx += 9)
          if (r() < L.win * 0.5) {
            c.fillStyle = r() < 0.7 ? `rgba(255,${190 + r() * 50},${150 + r() * 60},${0.5 * L.a})` : r() < 0.5 ? 'rgba(61,242,255,0.7)' : 'rgba(255,62,138,0.8)';
            c.fillRect(wx, wy, 4, 6);
          }
      x += w + 4 + r() * 10;
    }
  });
  // neon signs
  const signs: [number, number, string, string][] = [
    [70, 330, 'ネオン', '#ff3e8a'],
    [540, 250, '配達', '#3df2ff'],
    [470, 420, '24H', '#ffd84a'],
    [150, 470, '未来', '#3df2ff'],
  ];
  signs.forEach(([x, y, t, col]) => {
    const vertical = t.length > 1 && !/\d/.test(t);
    c.save();
    c.shadowColor = col;
    c.shadowBlur = 24;
    c.strokeStyle = col;
    c.lineWidth = 3;
    const w = vertical ? 44 : 70;
    const h = vertical ? t.length * 40 + 16 : 40;
    c.fillStyle = 'rgba(10,4,24,0.85)';
    c.fillRect(x, y, w, h);
    c.strokeRect(x, y, w, h);
    c.fillStyle = '#fff';
    c.font = `700 30px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (vertical) [...t].forEach((ch, i) => c.fillText(ch, x + w / 2, y + 28 + i * 40));
    else c.fillText(t, x + w / 2, y + h / 2 + 2);
    c.restore();
  });
  // rain
  c.strokeStyle = 'rgba(200,220,255,0.18)';
  c.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const x = r() * 700 - 30;
    const y = r() * 800;
    const l = 10 + r() * 30;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - l * 0.25, y + l);
    c.stroke();
  }
  // light trail of a flying car
  c.save();
  c.shadowColor = '#3df2ff';
  c.shadowBlur = 20;
  c.strokeStyle = lin(c, 0, 0, 640, 0, [
    [0, 'rgba(61,242,255,0)'],
    [0.7, 'rgba(61,242,255,0.9)'],
    [1, '#fff'],
  ]);
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(-20, 380);
  c.quadraticCurveTo(300, 300, 620, 330);
  c.stroke();
  c.restore();
  // rooftop + figure
  c.fillStyle = '#05020c';
  c.beginPath();
  c.moveTo(0, 690);
  c.lineTo(640, 650);
  c.lineTo(640, 800);
  c.lineTo(0, 800);
  c.fill();
  c.strokeStyle = 'rgba(255,62,138,0.8)';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, 690);
  c.lineTo(640, 650);
  c.stroke();
  // figure (long coat, hood, cyan visor)
  c.save();
  c.translate(392, 668);
  c.fillStyle = '#05020c';
  c.beginPath();
  c.moveTo(-26, 0);
  c.lineTo(-18, -120);
  c.quadraticCurveTo(-24, -160, -10, -176);
  c.quadraticCurveTo(0, -196, 12, -178);
  c.quadraticCurveTo(26, -160, 20, -120);
  c.lineTo(34, 0);
  c.lineTo(14, 0);
  c.lineTo(6, -60);
  c.lineTo(-2, 0);
  c.closePath();
  c.fill();
  c.shadowColor = '#3df2ff';
  c.shadowBlur = 14;
  c.fillStyle = '#9ffcff';
  c.fillRect(-6, -170, 18, 4);
  // coat tail blowing
  c.shadowBlur = 0;
  c.fillStyle = '#05020c';
  c.beginPath();
  c.moveTo(20, -100);
  c.quadraticCurveTo(60, -80, 78, -40);
  c.lineTo(30, -30);
  c.fill();
  c.restore();
  // rim light on the figure
  c.strokeStyle = 'rgba(255,62,138,0.9)';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(374, 548);
  c.lineTo(366, 666);
  c.stroke();
}

function island(c: C, x: number, y: number, s: number, r: () => number, fall = true) {
  // rock body
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  const g = lin(c, 0, 0, 0, 120, [
    [0, '#b98078'],
    [0.5, '#7b5575'],
    [1, '#3e2c52'],
  ]);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-60, 0);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const px = -60 + t * 120;
    const py = 20 + Math.sin(t * Math.PI) * (70 + r() * 40);
    c.lineTo(px + (r() - 0.5) * 10, py);
  }
  c.lineTo(60, 0);
  c.closePath();
  c.fill();
  // strata
  c.strokeStyle = 'rgba(255,220,200,0.25)';
  c.lineWidth = 1.5;
  for (let k = 1; k < 4; k++) {
    c.beginPath();
    c.moveTo(-50 + k * 5, 10 + k * 14);
    c.quadraticCurveTo(0, 18 + k * 16, 50 - k * 5, 10 + k * 14);
    c.stroke();
  }
  // grass top
  c.fillStyle = lin(c, 0, -14, 0, 10, [
    [0, '#aef0a8'],
    [1, '#4fb480'],
  ]);
  c.beginPath();
  c.ellipse(0, 0, 64, 14, 0, 0, Math.PI * 2);
  c.fill();
  // trees
  for (let i = 0; i < 4; i++) {
    const tx = -40 + r() * 80;
    c.fillStyle = r() < 0.5 ? '#3e9a73' : '#5cc08a';
    c.beginPath();
    c.arc(tx, -12 - r() * 8, 8 + r() * 8, 0, Math.PI * 2);
    c.fill();
  }
  // waterfall
  if (fall) {
    c.fillStyle = lin(c, 0, 0, 0, 260, [
      [0, 'rgba(255,255,255,0.85)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    c.fillRect(38, 6, 6, 260);
    c.fillRect(46, 8, 2, 200);
  }
  c.restore();
}

function puff(c: C, x: number, y: number, w: number, r: () => number, light: string, shadow: string) {
  for (let i = 0; i < 14; i++) {
    const px = x + (r() - 0.5) * w;
    const py = y + (r() - 0.5) * w * 0.12;
    const pr = w * (0.08 + r() * 0.1);
    c.fillStyle = rad(c, px - pr * 0.3, py - pr * 0.4, pr * 1.3, [
      [0, light],
      [0.7, light],
      [1, shadow],
    ]);
    c.beginPath();
    c.arc(px, py, pr, 0, Math.PI * 2);
    c.fill();
  }
}

function sky(c: C) {
  const r = rng(22);
  c.fillStyle = lin(c, 0, 0, 0, 800, [
    [0, '#4a8ee8'],
    [0.45, '#9cc8f5'],
    [0.72, '#ffd6c2'],
    [1, '#ffb6a0'],
  ]);
  c.fillRect(0, 0, 640, 800);
  glowDot(c, 470, 250, 260, 'rgba(255,245,220,0.9)');
  glowDot(c, 470, 250, 60, 'rgba(255,255,255,1)');
  // far clouds
  for (let i = 0; i < 5; i++) puff(c, r() * 640, 470 + r() * 60, 260, r, 'rgba(255,240,240,0.9)', 'rgba(255,200,210,0)');
  // islands, far to near
  island(c, 110, 300, 0.55, r);
  island(c, 560, 420, 0.7, r);
  island(c, 250, 470, 0.45, r, false);
  // the shard
  c.save();
  c.translate(330, 360);
  c.rotate(0.12);
  c.scale(0.9, 0.9);
  c.shadowColor = '#bff6ff';
  c.shadowBlur = 50;
  const facets: [number, number][][] = [
    [
      [0, -120],
      [36, -10],
      [0, 130],
    ],
    [
      [0, -120],
      [-40, -20],
      [0, 130],
    ],
    [
      [36, -10],
      [22, 40],
      [0, 130],
    ],
  ];
  const cols = ['#e9fdff', '#8ee6ff', '#5fb8f0'];
  facets.forEach((f, i) => {
    c.fillStyle = cols[i];
    c.beginPath();
    f.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fill();
  });
  c.restore();
  // airship
  c.save();
  c.translate(190, 170);
  c.fillStyle = '#6b4f7a';
  c.beginPath();
  c.ellipse(0, 0, 34, 10, 0, 0, Math.PI);
  c.fill();
  c.fillStyle = '#fff5ea';
  c.beginPath();
  c.moveTo(-4, -4);
  c.lineTo(-4, -46);
  c.lineTo(24, -8);
  c.closePath();
  c.fill();
  c.restore();
  // birds
  c.strokeStyle = 'rgba(80,70,120,0.7)';
  c.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const bx = 60 + r() * 220;
    const by = 80 + r() * 120;
    c.beginPath();
    c.moveTo(bx - 7, by);
    c.quadraticCurveTo(bx - 3, by - 5, bx, by);
    c.quadraticCurveTo(bx + 3, by - 5, bx + 7, by);
    c.stroke();
  }
  // near island at the bottom with a traveller
  island(c, 420, 640, 1.25, r);
  c.save();
  c.translate(100, 0);
  c.fillStyle = '#2b2440';
  c.beginPath();
  c.moveTo(300, 628);
  c.lineTo(306, 598);
  c.arc(308, 592, 6, 0, Math.PI * 2);
  c.lineTo(312, 628);
  c.fill();
  c.fillStyle = '#ff6a5c';
  c.beginPath();
  c.moveTo(306, 600);
  c.quadraticCurveTo(290, 610, 282, 626);
  c.lineTo(302, 620);
  c.fill();
  c.restore();
  // cloud sea
  for (let i = 0; i < 9; i++) puff(c, (i / 8) * 700 - 30, 760 + r() * 30, 280, r, '#ffffff', 'rgba(230,190,220,0.2)');
}

function abyss(c: C) {
  const r = rng(33);
  c.fillStyle = lin(c, 0, 0, 0, 800, [
    [0, '#0f6576'],
    [0.35, '#063543'],
    [0.75, '#021520'],
    [1, '#01070c'],
  ]);
  c.fillRect(0, 0, 640, 800);
  // light shafts
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const x = 60 + i * 90 + r() * 40;
    c.fillStyle = lin(c, 0, 0, 0, 520, [
      [0, 'rgba(120,255,240,0.16)'],
      [1, 'rgba(120,255,240,0)'],
    ]);
    c.beginPath();
    c.moveTo(x - 20, 0);
    c.lineTo(x + 24, 0);
    c.lineTo(x + 90 + r() * 40, 560);
    c.lineTo(x - 30, 560);
    c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  // the leviathan's eye in the dark
  c.save();
  c.globalAlpha = 0.55;
  c.strokeStyle = 'rgba(41,224,200,0.35)';
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(420, 470, 160, 60, -0.08, 0, Math.PI * 2);
  c.stroke();
  c.globalAlpha = 1;
  glowDot(c, 430, 468, 70, 'rgba(255,179,92,0.55)');
  c.fillStyle = '#ffcf7a';
  c.beginPath();
  c.ellipse(430, 468, 8, 40, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // jellyfish
  const jelly = (x: number, y: number, s: number, col: string) => {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    glowDot(c, 0, 0, 60, col.replace('1)', '0.35)'));
    c.fillStyle = col.replace('1)', '0.55)');
    c.beginPath();
    c.arc(0, 0, 26, Math.PI, 0);
    c.quadraticCurveTo(14, 8, 0, 6);
    c.quadraticCurveTo(-14, 8, -26, 0);
    c.fill();
    c.strokeStyle = col.replace('1)', '0.6)');
    c.lineWidth = 1.6;
    for (let k = -2; k <= 2; k++) {
      c.beginPath();
      c.moveTo(k * 8, 4);
      for (let t = 0; t < 8; t++) c.lineTo(k * 8 + Math.sin(t * 1.2 + k) * 5, 4 + t * 10);
      c.stroke();
    }
    c.restore();
  };
  jelly(130, 200, 1.2, 'rgba(120,255,235,1)');
  jelly(520, 150, 0.8, 'rgba(255,140,220,1)');
  jelly(90, 420, 0.7, 'rgba(160,200,255,1)');
  jelly(560, 330, 0.6, 'rgba(120,255,235,1)');
  // marine snow
  for (let i = 0; i < 220; i++) {
    c.fillStyle = `rgba(200,255,250,${0.2 + r() * 0.5})`;
    const s = r() * 2.2;
    c.fillRect(r() * 640, r() * 800, s, s);
  }
  // seabed ridge
  c.fillStyle = '#010509';
  c.beginPath();
  c.moveTo(0, 700);
  for (let x = 0; x <= 640; x += 40) c.lineTo(x, 690 + Math.sin(x * 0.02) * 20 + r() * 20);
  c.lineTo(640, 800);
  c.lineTo(0, 800);
  c.fill();
  // diver with a lantern
  c.save();
  c.translate(250, 600);
  glowDot(c, 40, -10, 200, 'rgba(255,179,92,0.45)');
  glowDot(c, 40, -10, 40, 'rgba(255,230,180,1)');
  c.fillStyle = '#02080d';
  c.beginPath();
  c.ellipse(0, -40, 16, 18, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(-14, -26);
  c.lineTo(-20, 30);
  c.lineTo(-6, 60);
  c.lineTo(6, 60);
  c.lineTo(16, 30);
  c.lineTo(14, -26);
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = '#02080d';
  c.beginPath();
  c.moveTo(12, -10);
  c.lineTo(36, -14);
  c.stroke();
  c.fillStyle = '#ffe2b0';
  c.fillRect(34, -22, 12, 16);
  c.fillStyle = 'rgba(255,200,120,0.9)';
  c.beginPath();
  c.arc(-6, -44, 5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function star5(c: C, x: number, y: number, R: number, rr: number, rot = 0) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? rr : R;
    c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.closePath();
}

function garden(c: C) {
  const r = rng(44);
  c.fillStyle = lin(c, 0, 0, 0, 800, [
    [0, '#15173f'],
    [0.5, '#3a3074'],
    [0.75, '#b77bb6'],
    [1, '#f7b6c8'],
  ]);
  c.fillRect(0, 0, 640, 800);
  for (let i = 0; i < 180; i++) {
    c.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.7})`;
    const s = r() * 2.4;
    c.fillRect(r() * 640, r() * 480, s, s);
  }
  // moon
  glowDot(c, 150, 170, 170, 'rgba(255,230,170,0.45)');
  c.fillStyle = '#fff1c4';
  c.beginPath();
  c.arc(150, 170, 64, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(230,200,140,0.35)';
  [
    [130, 150, 12],
    [175, 190, 9],
    [160, 140, 6],
  ].forEach(([x, y, rr]) => {
    c.beginPath();
    c.arc(x, y, rr, 0, Math.PI * 2);
    c.fill();
  });
  // shooting stars
  for (let i = 0; i < 6; i++) {
    const x = 260 + r() * 400;
    const y = 40 + r() * 280;
    const l = 90 + r() * 120;
    c.strokeStyle = lin(c, x, y, x - l, y - l * 0.55, [
      [0, 'rgba(255,240,180,1)'],
      [1, 'rgba(255,240,180,0)'],
    ]);
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - l, y - l * 0.55);
    c.stroke();
    c.fillStyle = '#fff6c8';
    star5(c, x, y, 7, 3, r());
    c.fill();
  }
  // hills
  const hill = (y: number, col: string, amp: number, ph: number) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, 800);
    for (let x = 0; x <= 640; x += 20) c.lineTo(x, y + Math.sin(x * 0.012 + ph) * amp);
    c.lineTo(640, 800);
    c.fill();
  };
  hill(560, '#5b4b8f', 26, 0.5);
  hill(610, '#3b3470', 30, 2.1);
  // cottage
  c.save();
  c.translate(430, 560);
  c.fillStyle = '#2a2350';
  c.fillRect(-50, -60, 100, 70);
  c.fillStyle = '#e46d8f';
  c.beginPath();
  c.moveTo(-64, -58);
  c.lineTo(0, -110);
  c.lineTo(64, -58);
  c.closePath();
  c.fill();
  c.fillStyle = '#2a2350';
  c.fillRect(24, -118, 14, 36);
  glowDot(c, -20, -30, 50, 'rgba(255,210,120,0.6)');
  c.fillStyle = '#ffd98a';
  c.fillRect(-32, -42, 24, 22);
  c.fillRect(12, -42, 18, 22);
  c.restore();
  hill(680, '#241f4f', 22, 4);
  // star flowers
  const pal = ['#ffd36e', '#ff9ec7', '#9fe8ff', '#c7b3ff', '#ffffff'];
  for (let i = 0; i < 46; i++) {
    const x = r() * 640;
    const y = 660 + r() * 140;
    const s = 6 + (y - 640) * 0.09 + r() * 4;
    c.strokeStyle = '#3f7a62';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (r() - 0.5) * 6, y + s * 2.4);
    c.stroke();
    const col = pal[Math.floor(r() * pal.length)];
    glowDot(c, x, y, s * 2.4, col.length === 7 ? col + '66' : col);
    c.fillStyle = col;
    star5(c, x, y, s, s * 0.45, r());
    c.fill();
  }
  // fireflies
  for (let i = 0; i < 30; i++) glowDot(c, r() * 640, 420 + r() * 340, 10, 'rgba(255,240,150,0.9)');
}

function orbit(c: C) {
  const r = rng(55);
  c.fillStyle = '#05040a';
  c.fillRect(0, 0, 640, 800);
  glowDot(c, 520, 180, 360, 'rgba(120,50,160,0.35)');
  glowDot(c, 120, 640, 300, 'rgba(255,122,26,0.25)');
  for (let i = 0; i < 260; i++) {
    c.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.8})`;
    const s = r() * 2;
    c.fillRect(r() * 640, r() * 800, s, s);
  }
  // planet with rings
  c.save();
  c.translate(170, 560);
  c.rotate(-0.35);
  c.strokeStyle = 'rgba(255,200,150,0.35)';
  c.lineWidth = 18;
  c.beginPath();
  c.ellipse(0, 0, 400, 90, 0, Math.PI, Math.PI * 2);
  c.stroke();
  const pg = rad(c, -60, -80, 300, [
    [0, '#ffb070'],
    [0.5, '#e0602a'],
    [1, '#3a0f1a'],
  ]);
  c.fillStyle = pg;
  c.beginPath();
  c.arc(0, 0, 230, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.clip();
  c.globalAlpha = 0.25;
  for (let k = -8; k < 8; k++) {
    c.fillStyle = k % 2 ? '#ffd9a8' : '#7a2a1a';
    c.fillRect(-240, k * 30 + Math.sin(k) * 8, 480, 12 + (k % 3) * 4);
  }
  c.restore();
  c.strokeStyle = 'rgba(255,220,170,0.8)';
  c.lineWidth = 10;
  c.beginPath();
  c.ellipse(0, 0, 400, 90, 0, 0, Math.PI);
  c.stroke();
  c.strokeStyle = 'rgba(255,122,26,0.9)';
  c.lineWidth = 3;
  c.shadowColor = '#ff7a1a';
  c.shadowBlur = 16;
  c.beginPath();
  c.ellipse(0, 0, 372, 76, 0, 0.1, Math.PI - 0.1);
  c.stroke();
  c.restore();
  // speed lines toward a vanishing point
  c.strokeStyle = 'rgba(255,255,255,0.12)';
  c.lineWidth = 1.2;
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2;
    const d0 = 120 + r() * 200;
    c.beginPath();
    c.moveTo(430 + Math.cos(a) * d0, 330 + Math.sin(a) * d0);
    c.lineTo(430 + Math.cos(a) * (d0 + 80 + r() * 200), 330 + Math.sin(a) * (d0 + 80 + r() * 200));
    c.stroke();
  }
  // racer
  c.save();
  c.translate(420, 350);
  c.rotate(-0.22);
  glowDot(c, -118, 10, 70, 'rgba(61,242,255,0.8)');
  c.fillStyle = lin(c, 0, -40, 0, 40, [
    [0, '#ffffff'],
    [0.5, '#d9d2ff'],
    [1, '#5b4a9a'],
  ]);
  c.beginPath();
  c.moveTo(150, 8);
  c.lineTo(-40, -44);
  c.lineTo(-110, -30);
  c.lineTo(-100, 4);
  c.lineTo(-110, 36);
  c.lineTo(-30, 40);
  c.closePath();
  c.fill();
  c.fillStyle = '#ff7a1a';
  c.beginPath();
  c.moveTo(120, 10);
  c.lineTo(-30, -14);
  c.lineTo(-30, -4);
  c.lineTo(100, 14);
  c.fill();
  c.fillStyle = '#1b1336';
  c.beginPath();
  c.ellipse(10, -18, 40, 12, -0.12, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(160,220,255,0.7)';
  c.beginPath();
  c.ellipse(16, -22, 22, 4, -0.12, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function mikoshi(c: C) {
  const r = rng(66);
  c.fillStyle = '#ffcf3a';
  c.fillRect(0, 0, 640, 800);
  // sunburst
  c.save();
  c.translate(320, 420);
  for (let i = 0; i < 24; i++) {
    c.fillStyle = i % 2 ? '#ffb020' : '#ffd84a';
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, 900, (i / 24) * Math.PI * 2, ((i + 1) / 24) * Math.PI * 2);
    c.fill();
  }
  c.restore();
  // lantern strings
  for (let row = 0; row < 2; row++) {
    const y0 = 70 + row * 70;
    c.strokeStyle = '#3a2410';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-10, y0);
    c.quadraticCurveTo(320, y0 + 60, 650, y0);
    c.stroke();
    for (let i = 0; i < 7; i++) {
      const x = 30 + i * 96 + row * 48;
      const t = x / 640;
      const y = y0 + 4 * t * (1 - t) * 60 * 0.5 + 16;
      c.fillStyle = i % 2 ? '#ffffff' : '#ff3b30';
      c.beginPath();
      c.ellipse(x, y + 18, 18, 24, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#1d1a3a';
      c.fillRect(x - 12, y - 6, 24, 5);
      c.fillRect(x - 12, y + 39, 24, 5);
      c.strokeStyle = i % 2 ? '#ff3b30' : '#ffd0cc';
      c.lineWidth = 1;
      for (let k = -1; k <= 1; k++) {
        c.beginPath();
        c.ellipse(x, y + 18, 18, 24 - Math.abs(k) * 6 - 10, 0, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }
  // mikoshi
  c.save();
  c.translate(320, 520);
  c.rotate(-0.06);
  c.fillStyle = '#1d1a3a';
  c.fillRect(-250, 46, 500, 16);
  c.fillRect(-250, 84, 500, 16);
  c.fillStyle = '#ff3b30';
  c.fillRect(-90, -20, 180, 110);
  c.fillStyle = '#ffd84a';
  c.fillRect(-100, 86, 200, 16);
  c.fillRect(-70, 0, 20, 70);
  c.fillRect(50, 0, 20, 70);
  c.fillStyle = '#1d1a3a';
  c.beginPath();
  c.moveTo(-150, -10);
  c.quadraticCurveTo(-60, -30, 0, -110);
  c.quadraticCurveTo(60, -30, 150, -10);
  c.lineTo(120, -30);
  c.quadraticCurveTo(60, -50, 0, -120);
  c.fill();
  c.fillStyle = '#ffd84a';
  c.beginPath();
  c.moveTo(-140, -14);
  c.quadraticCurveTo(-60, -34, 0, -106);
  c.quadraticCurveTo(60, -34, 140, -14);
  c.lineTo(130, -24);
  c.quadraticCurveTo(60, -44, 0, -114);
  c.quadraticCurveTo(-60, -44, -130, -24);
  c.fill();
  // phoenix ornament
  c.fillStyle = '#ffd84a';
  star5(c, 0, -140, 22, 9, 0);
  c.fill();
  c.restore();
  // carriers (round mascots)
  const cols = ['#3df2ff', '#ff5fa8', '#39e58c', '#7b5cff'];
  [130, 250, 390, 510].forEach((x, i) => {
    const y = 650 + (i % 2 ? -16 : 8);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath();
    c.ellipse(x, 790, 50, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = cols[i];
    c.strokeStyle = '#1d1a3a';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(x, y, 58, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // headband
    c.fillStyle = '#fff';
    c.fillRect(x - 56, y - 30, 112, 12);
    c.fillStyle = '#1d1a3a';
    c.beginPath();
    c.arc(x - 18, y, 7, 0, Math.PI * 2);
    c.arc(x + 18, y, 7, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(x, y + 26, 16, 12, 0, 0, Math.PI);
    c.fill();
    // legs
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(x - 20, y + 54);
    c.lineTo(x - 30, y + 110);
    c.moveTo(x + 20, y + 54);
    c.lineTo(x + 34, y + 104);
    c.stroke();
    // sweat
    c.fillStyle = '#9fe8ff';
    c.beginPath();
    c.ellipse(x + 50, y - 50, 6, 10, 0.4, 0, Math.PI * 2);
    c.fill();
  });
  // confetti
  const cc = ['#ff3b30', '#3df2ff', '#7b5cff', '#ffffff', '#39e58c', '#ff5fa8'];
  for (let i = 0; i < 90; i++) {
    c.save();
    c.translate(r() * 640, r() * 800);
    c.rotate(r() * 6);
    c.fillStyle = cc[Math.floor(r() * cc.length)];
    c.fillRect(-5, -2.5, 10, 5);
    c.restore();
  }
}

const KEY: Record<TitleId, (c: C) => void> = { neon, sky, abyss, garden, orbit, mikoshi };
const keyCache = new Map<TitleId, HTMLCanvasElement>();
export function keyArt(id: TitleId) {
  let cv = keyCache.get(id);
  if (!cv) {
    cv = canvas(ART_W, ART_H);
    KEY[id](cv.getContext('2d')!);
    keyCache.set(id, cv);
  }
  return cv;
}

// ── title logos ─────────────────────────────────────────────────────────────

function logo(c: C, t: Title, x: number, y: number, s = 1) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  switch (t.id) {
    case 'neon': {
      c.rotate(-0.04);
      c.font = `italic 900 92px ${EN}`;
      c.fillStyle = '#3df2ff';
      c.fillText('NEON', 5, 3);
      c.shadowColor = '#ff3e8a';
      c.shadowBlur = 30;
      c.fillStyle = '#fff';
      c.fillText('NEON', 0, 0);
      c.font = `italic 900 64px ${EN}`;
      c.shadowBlur = 20;
      c.fillStyle = '#ff3e8a';
      c.fillText('ASTRAY', 0, 66);
      c.shadowBlur = 0;
      c.font = `700 20px ${JP}`;
      c.fillStyle = '#fff';
      c.fillText('ネ オ ン ・ ア ス ト レ イ', 0, 104);
      break;
    }
    case 'sky': {
      c.shadowColor = 'rgba(60,40,120,0.45)';
      c.shadowBlur = 16;
      c.font = `700 84px ${MIN}`;
      c.fillStyle = '#fff';
      c.fillText('ソラノカケラ', 0, 0);
      c.shadowBlur = 0;
      c.font = `500 22px ${EN}`;
      c.fillStyle = '#3a3f8a';
      c.fillText('S K Y S H A R D', 0, 44);
      break;
    }
    case 'abyss': {
      c.font = `500 58px ${EN}`;
      c.fillStyle = '#d8fff8';
      c.shadowColor = '#29e0c8';
      c.shadowBlur = 24;
      c.fillText('A B Y S S', 0, 0);
      c.font = `500 30px ${EN}`;
      c.fillStyle = '#ffcf7a';
      c.shadowColor = '#ffb35c';
      c.fillText('L A N T E R N', 0, 46);
      c.shadowBlur = 0;
      c.font = `500 18px ${JP}`;
      c.fillStyle = 'rgba(216,255,248,0.8)';
      c.fillText('アビス・ランタン', 0, 82);
      break;
    }
    case 'garden': {
      c.font = `700 92px ${JP}`;
      c.lineJoin = 'round';
      c.lineWidth = 14;
      c.strokeStyle = '#5b3f9a';
      c.strokeText('ほしふる庭', 0, 0);
      c.fillStyle = lin(c, 0, -80, 0, 10, [
        [0, '#fff6c8'],
        [1, '#ffd36e'],
      ]);
      c.fillText('ほしふる庭', 0, 0);
      c.font = `700 18px ${EN}`;
      c.fillStyle = '#fff';
      c.fillText('HOSHIFURU GARDEN', 0, 38);
      break;
    }
    case 'orbit': {
      c.rotate(-0.06);
      c.font = `italic 900 100px ${EN}`;
      c.fillStyle = lin(c, 0, -90, 0, 0, [
        [0, '#ffe0b8'],
        [0.55, '#ff7a1a'],
        [1, '#b33a00'],
      ]);
      c.shadowColor = 'rgba(255,122,26,0.7)';
      c.shadowBlur = 24;
      c.fillText('ORBIT', 0, 0);
      c.font = `italic 900 64px ${EN}`;
      c.fillStyle = '#fff';
      c.fillText('RALLY', 60, 62);
      c.shadowBlur = 0;
      break;
    }
    case 'mikoshi': {
      c.rotate(-0.07);
      c.lineJoin = 'round';
      c.font = `900 82px ${EN}`;
      c.lineWidth = 18;
      c.strokeStyle = '#1d1a3a';
      c.strokeText('MIKOSHI', 0, 0);
      c.fillStyle = '#ff3b30';
      c.fillText('MIKOSHI', 0, 0);
      c.font = `900 96px ${EN}`;
      c.strokeText('PANIC!', 0, 88);
      c.fillStyle = '#fff';
      c.fillText('PANIC!', 0, 88);
      c.font = `700 24px ${JP}`;
      c.fillStyle = '#1d1a3a';
      c.fillRect(-120, 104, 240, 38);
      c.fillStyle = '#ffd84a';
      c.fillText('みこしパニック！', 0, 132);
      break;
    }
  }
  c.restore();
}
const LOGO_POS: Record<TitleId, [number, number, number]> = {
  neon: [320, 190, 1],
  sky: [320, 150, 0.9],
  abyss: [320, 150, 1],
  garden: [320, 360, 1],
  orbit: [300, 170, 1],
  mikoshi: [320, 230, 0.95],
};

// ── package parts ──────────────────────────────────────────────────────────

const BANNER = 56;
function platformBand(c: C, t: Title, w: number) {
  const p = t.platforms[0];
  const pocket = p === 'LUMEN Pocket';
  const pc = p === 'PC';
  c.fillStyle = pocket ? '#ff3e8a' : pc ? '#2b2b33' : '#15123a';
  c.fillRect(0, 0, w, BANNER);
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(34, BANNER / 2, 12, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.arc(34, BANNER / 2, 4, 0, Math.PI * 2);
  c.fill();
  c.font = `800 20px ${EN}`;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(pc ? 'PC GAME' : p.toUpperCase(), 58, BANNER / 2 + 1);
}
function ageBadge(c: C, t: Title, x: number, y: number, s = 1) {
  const a = AGE[t.age];
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = '#fff';
  c.beginPath();
  c.roundRect(0, 0, 64, 78, 8);
  c.fill();
  c.fillStyle = a.color;
  c.beginPath();
  c.roundRect(4, 4, 56, 52, 5);
  c.fill();
  c.fillStyle = '#150d33';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `900 ${a.label.length > 3 ? 20 : 24}px ${EN}`;
  c.fillText(a.label, 32, 31);
  c.font = `700 9px ${EN}`;
  c.fillText('PLAY AGE', 32, 67);
  c.restore();
}
function brand(c: C, x: number, y: number, col = '#fff', s = 1) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = '#ff3e8a';
  c.beginPath();
  c.roundRect(0, -14, 28, 28, 7);
  c.fill();
  c.strokeStyle = '#fff';
  c.lineWidth = 2.6;
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(7, 7);
  c.lineTo(7, -4);
  c.lineTo(14, 2);
  c.lineTo(21, -4);
  c.lineTo(21, 7);
  c.stroke();
  c.fillStyle = col;
  c.font = `800 15px ${EN}`;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText('MIRAI GAMES', 36, 1);
  c.restore();
}

export function coverArt(t: Title) {
  const cv = canvas(ART_W, ART_H);
  const c = cv.getContext('2d')!;
  c.drawImage(keyArt(t.id), 0, 0);
  // gentle vignette for legibility
  c.fillStyle = lin(c, 0, 0, 0, 800, [
    [0, 'rgba(0,0,0,0.25)'],
    [0.2, 'rgba(0,0,0,0)'],
    [0.82, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.45)'],
  ]);
  c.fillRect(0, 0, 640, 800);
  const [lx, ly, ls] = LOGO_POS[t.id];
  logo(c, t, lx, ly + BANNER * 0.5, ls);
  platformBand(c, t, 640);
  ageBadge(c, t, 24, 698);
  brand(c, 440, 752);
  if (t.status !== 'out') {
    c.save();
    c.translate(640, BANNER);
    c.fillStyle = '#ffd84a';
    c.beginPath();
    c.moveTo(-232, 0);
    c.lineTo(0, 0);
    c.lineTo(0, 44);
    c.lineTo(-214, 44);
    c.closePath();
    c.fill();
    c.fillStyle = '#150d33';
    c.font = `800 14px ${EN}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(t.status === 'dev' ? 'IN DEVELOPMENT' : 'COMING SOON', -110, 23);
    c.restore();
  }
  return cv;
}

function wrap(c: C, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 99) {
  let line = '';
  let n = 0;
  for (const ch of text) {
    if (c.measureText(line + ch).width > maxW && line) {
      c.fillText(line, x, y + n * lh);
      n++;
      line = '';
      if (n >= maxLines) return n;
    }
    line += ch;
  }
  if (line) {
    c.fillText(line, x, y + n * lh);
    n++;
  }
  return n;
}

export function backArt(t: Title) {
  const cv = canvas(ART_W, ART_H);
  const c = cv.getContext('2d')!;
  const key = keyArt(t.id);
  c.fillStyle = '#0d0a22';
  c.fillRect(0, 0, 640, 800);
  c.globalAlpha = 0.35;
  c.filter = 'blur(18px)';
  c.drawImage(key, -60, -60, 760, 950);
  c.filter = 'none';
  c.globalAlpha = 1;
  c.fillStyle = 'rgba(10,8,30,0.62)';
  c.fillRect(0, 0, 640, 800);
  platformBand(c, t, 640);
  // screenshots: crops of the key art
  const shot = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => {
    c.save();
    c.beginPath();
    c.roundRect(dx, dy, dw, dh, 8);
    c.clip();
    c.drawImage(key, sx, sy, sw, sh, dx, dy, dw, dh);
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(dx, dy, dw, dh, 8);
    c.stroke();
  };
  shot(0, 180, 640, 360, 32, 82, 576, 250);
  shot(40, 460, 280, 200, 32, 346, 180, 116);
  shot(300, 80, 280, 200, 230, 346, 180, 116);
  shot(160, 560, 280, 200, 428, 346, 180, 116);
  c.fillStyle = '#fff';
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.font = `700 26px ${JP}`;
  c.fillText(t.tagline, 32, 508);
  c.font = `500 15px ${JP}`;
  c.fillStyle = 'rgba(255,255,255,0.85)';
  wrap(c, t.desc, 32, 540, 576, 24, 3);
  c.font = `500 14px ${JP}`;
  t.points.forEach((p, i) => {
    c.fillStyle = t.pal[1];
    c.fillRect(32, 622 + i * 26, 8, 8);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fillText(p, 50, 630 + i * 26);
  });
  // footer: age, specs, barcode, brand
  c.fillStyle = 'rgba(255,255,255,0.08)';
  c.fillRect(0, 704, 640, 96);
  ageBadge(c, t, 24, 712, 1);
  c.fillStyle = 'rgba(255,255,255,0.8)';
  c.font = `500 12px ${JP}`;
  c.fillText(`ジャンル：${t.genre}`, 104, 732);
  c.fillText(`プレイ人数：${t.players}`, 104, 752);
  c.fillText(`発売：${t.release}`, 104, 772);
  const r = rng(t.id.length * 97);
  c.fillStyle = '#fff';
  c.fillRect(438, 716, 176, 58);
  c.fillStyle = '#111';
  let bx = 446;
  while (bx < 606) {
    const w = 1 + Math.floor(r() * 3);
    if (r() < 0.6) c.fillRect(bx, 722, w, 38);
    bx += w + 1;
  }
  c.font = `500 9px ${EN}`;
  c.fillText('4 9 1 2 0 2 6 0 0 0 0 0', 452, 770);
  brand(c, 470, BANNER / 2, '#fff', 0.85);
  c.font = `500 9px ${EN}`;
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.textAlign = 'right';
  c.fillText('© 2026 MIRAI GAMES Inc.', 612, 790);
  c.textAlign = 'left';
  return cv;
}

export function spineArt(t: Title) {
  const cv = canvas(64, ART_H);
  const c = cv.getContext('2d')!;
  c.fillStyle = lin(c, 0, 0, 0, 800, [
    [0, '#0e0b26'],
    [1, '#1d1646'],
  ]);
  c.fillRect(0, 0, 64, 800);
  const p = t.platforms[0];
  c.fillStyle = p === 'LUMEN Pocket' ? '#ff3e8a' : p === 'PC' ? '#2b2b33' : '#15123a';
  c.fillRect(0, 0, 64, 70);
  c.strokeStyle = '#fff';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(32, 35, 12, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = t.pal[1];
  c.fillRect(0, 70, 64, 4);
  c.save();
  c.translate(32, 400);
  c.rotate(Math.PI / 2);
  c.fillStyle = '#fff';
  c.font = `800 26px ${EN}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(t.en, 0, 0);
  c.restore();
  c.fillStyle = '#ff3e8a';
  c.beginPath();
  c.roundRect(16, 736, 32, 32, 7);
  c.fill();
  return cv;
}

export function discArt(t: Title) {
  const S = 512;
  const cv = canvas(S, S);
  const c = cv.getContext('2d')!;
  c.save();
  c.beginPath();
  c.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  c.clip();
  c.drawImage(keyArt(t.id), 0, 60, 640, 640, 0, 0, S, S);
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.fillRect(0, 0, S, S);
  // hub
  c.fillStyle = rad(c, S / 2, S / 2, 92, [
    [0, '#f5f3ff'],
    [0.6, '#bdb6d8'],
    [1, '#8d86a8'],
  ]);
  c.beginPath();
  c.arc(S / 2, S / 2, 86, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.6)';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(S / 2, S / 2, 86, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = '#0b0820';
  c.beginPath();
  c.arc(S / 2, S / 2, 26, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // label
  c.fillStyle = 'rgba(10,8,30,0.72)';
  c.beginPath();
  c.roundRect(S / 2 - 150, S - 150, 300, 58, 10);
  c.fill();
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `800 26px ${EN}`;
  c.fillText(t.en, S / 2, S - 128, 280);
  c.font = `500 12px ${EN}`;
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.fillText(t.platforms[0].toUpperCase(), S / 2, S - 104);
  brand(c, S / 2 - 74, 96, '#fff', 1);
  return cv;
}

/** Waits (briefly) for the webfonts the package art uses. */
export async function artFonts(timeout = 1500) {
  if (!('fonts' in document)) return;
  const want = [`900 64px Unbounded`, `800 64px Unbounded`, `500 64px Unbounded`, `700 64px "Zen Kaku Gothic New"`, `700 64px "Zen Old Mincho"`];
  await Promise.race([
    Promise.all(want.map((f) => document.fonts.load(f, 'ABCDEFGHIJKLMNOPQRSTUVWXYZネオンアストレイソラノカケラほしふる庭みこしパニック！配達未来'))),
    new Promise((r) => setTimeout(r, timeout)),
  ]).catch(() => undefined);
}

/** Small JPEG of the front cover for DOM thumbnails and the no-WebGL view. */
export function coverThumb(t: Title, w = 320) {
  const src = coverArt(t);
  const cv = canvas(w, Math.round((w * ART_H) / ART_W));
  cv.getContext('2d')!.drawImage(src, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.86);
}
