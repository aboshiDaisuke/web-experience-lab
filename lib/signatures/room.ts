import { PerspectiveCamera, Vector3 } from 'three';
import type { Signature } from './types';
import { BASE } from '@/lib/base-path';

/**
 * THE CREATIVE ROOM — "the work performs itself".
 * Picking a tool in the room opens a small window of the studio's own mini-OS
 * that performs that craft live: code types itself into a landing page, a
 * viewfinder focuses and a print develops into a contact sheet, a book opens
 * to the studio profile, and a motion reel builds the logo from shapes.
 */

type Pick = 'PC' | 'CAMERA' | 'BOOKS' | 'TV';
const ORDER: Pick[] = ['PC', 'CAMERA', 'BOOKS', 'TV'];
// world positions of the pickable objects (see lib/scenes/models.ts room())
const WORLD: Record<Pick, [number, number, number]> = {
  PC: [0.25, 1.49, -1.3],
  CAMERA: [1.05, 1.2, -1.05],
  BOOKS: [-1.8, 1.3, -1.45],
  TV: [-2.33, 1.65, 0.45],
};
const META: Record<Pick, { app: string; doc: string; done: string }> = {
  PC: { app: 'エディタ', doc: 'komorebi / index.html', done: '保存しました' },
  CAMERA: { app: 'ファインダー', doc: 'ROLL 07 — portrait', done: '現像しました' },
  BOOKS: { app: 'ノート', doc: 'profile_2026', done: '読み終わり' },
  TV: { app: 'リール', doc: 'logo_sting — 24fps', done: '書き出し完了' },
};

type Perf = { dur: number; render: (t: number, instant?: boolean) => void };
type Build = (body: HTMLElement, narrow: boolean) => Perf;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const inOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const outBack = (x: number) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const el = (tag: string, cls: string, html = '') => {
  const n = document.createElement(tag);
  n.className = cls;
  if (html) n.innerHTML = html;
  return n;
};

/* ------------------------------------------------------------------ */
/* PC — the code types itself, the page assembles beside it            */
/* ------------------------------------------------------------------ */
type Tok = [string, string];
const CODE: { t: Tok[]; step?: string }[] = [
  { t: [['tg', '<header>']] },
  { t: [['tx', '  '], ['tg', '<b>'], ['tx', 'こもれび珈琲'], ['tg', '</b>']], step: 'logo' },
  { t: [['tg', '</header>']] },
  { t: [['tg', '<h1>'], ['tx', '朝を、ゆっくり。'], ['tg', '</h1>']], step: 'h1' },
  { t: [['tg', '<p>'], ['tx', '森のそばの焙煎所'], ['tg', '</p>']], step: 'p' },
  { t: [['tg', '<button>'], ['tx', '席を予約'], ['tg', '</button>']], step: 'btn' },
  { t: [['tg', '<i '], ['at', 'class'], ['tg', '='], ['st', '"cup"'], ['tg', '></i>']], step: 'cup' },
  { t: [] },
  { t: [['tg', '<style>']] },
  { t: [['se', '.hero'], ['pn', ' { '], ['pr', 'background'], ['pn', ': '], ['nu', '#f4e6c8'], ['pn', ' }']], step: 'bg' },
  { t: [['se', 'h1'], ['pn', ' { '], ['pr', 'font'], ['pn', ': '], ['nu', '600 26px serif'], ['pn', ' }']], step: 'h1css' },
  { t: [['se', 'button'], ['pn', ' { '], ['pr', 'border-radius'], ['pn', ': '], ['nu', '99px'], ['pn', ' }']], step: 'btncss' },
  { t: [['se', '.cup'], ['pn', ' { '], ['pr', 'animation'], ['pn', ': '], ['nu', 'steam 3s'], ['pn', ' }']], step: 'cupcss' },
  { t: [['tg', '</style>']] },
];
const FLASH_LABEL: Record<string, [string, string]> = {
  logo: ['.pg-logo', 'b'],
  h1: ['.pg-h1', 'h1'],
  p: ['.pg-p', 'p'],
  btn: ['.pg-btn', 'button'],
  cup: ['.pg-cup', 'i.cup'],
  bg: ['.pg', '.hero'],
  h1css: ['.pg-h1', 'h1  600 26px'],
  btncss: ['.pg-btn', 'button'],
  cupcss: ['.pg-cup', '.cup  ✦ steam'],
};

const buildPC: Build = (body) => {
  body.innerHTML = `<div class="rm-pc"><div class="rm-code"><div class="rm-code-in"></div></div><div class="rm-browser"><div class="rm-url"><i></i><span>komorebi.example</span><em></em></div><div class="pg"><i class="pg-sun"></i><div class="pg-nav"><b class="pg-logo">こもれび珈琲</b><span class="pg-menu"><i></i><i></i><i></i></span></div><div class="pg-hero"><div class="pg-copy"><div class="pg-h1">朝を、ゆっくり。</div><div class="pg-p">森のそばの焙煎所</div><span class="pg-btn">席を予約</span></div><div class="pg-cup"><span class="pg-cup-alt">cup</span><i class="cup-steam"><b></b><b></b><b></b></i><i class="cup-body"></i><i class="cup-handle"></i><i class="cup-saucer"></i></div></div><i class="pg-tag"></i></div></div></div>`;
  const code = body.querySelector<HTMLElement>('.rm-code-in')!;
  const pane = body.querySelector<HTMLElement>('.rm-code')!;
  const pg = body.querySelector<HTMLElement>('.pg')!;
  const tag = body.querySelector<HTMLElement>('.pg-tag')!;
  const url = body.querySelector<HTMLElement>('.rm-url')!;
  // per-character timing with a human rhythm
  const times: number[] = [];
  const lineEnd: number[] = [];
  let acc = 0;
  CODE.forEach((line, li) => {
    if (li === 8) acc += 0.22;
    for (const [, s] of line.t)
      for (const ch of Array.from(s)) {
        acc += ch.charCodeAt(0) > 127 ? 0.05 : ch === ' ' ? 0.012 : 0.022;
        times.push(acc);
      }
    acc += 0.09;
    lineEnd.push(times.length);
  });
  const T0 = 0.35;
  const TYPE = 3.65;
  const scale = TYPE / acc;
  for (let i = 0; i < times.length; i++) times[i] = T0 + times[i] * scale;
  const total = times.length;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let lastN = -1;
  const timers: number[] = [];
  const active = new Set<string>();
  const flash = (step: string) => {
    const f = FLASH_LABEL[step];
    if (!f) return;
    const target = f[0] === '.pg' ? pg : pg.querySelector<HTMLElement>(f[0]);
    if (!target) return;
    const pr = pg.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const s = pr.width / pg.offsetWidth || 1;
    tag.style.left = `${(r.left - pr.left) / s}px`;
    tag.style.top = `${(r.top - pr.top) / s}px`;
    tag.style.width = `${r.width / s}px`;
    tag.style.height = `${r.height / s}px`;
    tag.dataset.label = f[1];
    tag.classList.remove('on');
    void tag.offsetWidth;
    tag.classList.add('on');
  };
  return {
    dur: 4.9,
    render(t, instant) {
      let n = 0;
      while (n < total && times[n] <= t) n++;
      if (n !== lastN) {
        lastN = n;
        const rowsHtml: string[] = [];
        let caretLine = 0;
        for (let li = 0; li < CODE.length; li++) {
          const lineStart = li === 0 ? 0 : lineEnd[li - 1];
          if (n < lineStart) break;
          let rem = n - lineStart;
          let row = '';
          for (const [cls, str] of CODE[li].t) {
            if (rem <= 0) break;
            const chars = Array.from(str);
            row += `<span class="${cls}">${esc(chars.slice(0, rem).join(''))}</span>`;
            rem -= chars.length;
          }
          caretLine = li;
          rowsHtml.push(row || '&#8203;');
        }
        rowsHtml[caretLine] += '<i class="rm-caret"></i>';
        code.innerHTML = rowsHtml.map((r) => `<div class="ln">${r}</div>`).join('');
        const rows = code.children;
        const row = rows[caretLine] as HTMLElement | undefined;
        if (row) {
          const want = row.offsetTop - pane.clientHeight + row.offsetHeight + 22;
          pane.scrollTop = Math.max(0, want);
        }
        // steps
        CODE.forEach((line, li) => {
          if (!line.step) return;
          const on = n >= lineEnd[li];
          if (on && !active.has(line.step)) {
            active.add(line.step);
            pg.classList.add(`s-${line.step}`);
            if (!instant) {
              const st = line.step;
              if (st.endsWith('css')) timers.push(window.setTimeout(() => flash(st), 420));
              else requestAnimationFrame(() => flash(st));
            }
          } else if (!on && active.has(line.step)) {
            active.delete(line.step);
            pg.classList.remove(`s-${line.step}`);
          }
        });
      }
      url.classList.toggle('loading', t > 4.05 && t < 4.5);
      pg.classList.toggle('s-done', t >= 4.5);
      if (instant) tag.classList.remove('on');
    },
  };
};

/* ------------------------------------------------------------------ */
/* CAMERA — focus, shutter, develop, contact sheet                      */
/* ------------------------------------------------------------------ */
const PHOTO = `${BASE}/images/fashion.jpg`;
const FRAMES: [string, string][] = [
  ['52% 18%', '170%'],
  ['50% 26%', '135%'],
  ['46% 30%', '120%'],
  ['50% 22%', '150%'], // the keeper
  ['58% 30%', '128%'],
  ['50% 40%', '110%'],
];
const buildCamera: Build = (body) => {
  const frames = FRAMES.map(
    ([pos, size], i) =>
      `<figure class="cs-f${i === 3 ? ' keep' : ''}"><i style="background-image:url(${PHOTO});background-position:${pos};background-size:${size}"></i><span>${10 + i}${i % 2 ? 'A' : ''}</span></figure>`,
  ).join('');
  body.innerHTML = `<div class="rm-cam"><div class="cam-vf"><i class="cam-photo" style="background-image:url(${PHOTO})"></i><i class="cam-thirds"></i><i class="cam-c tl"></i><i class="cam-c tr"></i><i class="cam-c bl"></i><i class="cam-c br"></i><i class="cam-af"></i><div class="cam-top"><span class="cam-mode">AF-S</span><span class="cam-dot"></span><span>RAW</span><span class="cam-count">12</span></div><div class="cam-read"><span>1/250</span><span>F2.8</span><span>ISO 200</span><span class="cam-meter"><i></i><b></b></span></div><i class="cam-iris"></i></div><div class="cam-tray"><div class="cam-print"><i style="background-image:url(${PHOTO})"></i></div><span class="cam-safe">SAFELIGHT</span></div><div class="cam-sheet"><div class="cs-strip">${frames}<span class="cs-edge">MIRAI 400&nbsp;&nbsp;▸ 10&nbsp;&nbsp;▸ 11&nbsp;&nbsp;▸ 12&nbsp;&nbsp;▸ 13&nbsp;&nbsp;▸ 14</span></div></div></div>`;
  const keep = body.querySelector<HTMLElement>('.cs-f.keep')!;
  keep.insertAdjacentHTML(
    'beforeend',
    '<svg class="cs-grease" viewBox="0 0 100 100" preserveAspectRatio="none"><path pathLength="1" d="M8 60C4 34 22 8 52 8c28 0 44 20 40 44-4 26-28 42-54 38C16 86 4 70 12 52"/></svg><i class="cs-loupe"></i>',
  );
  const vf = body.querySelector<HTMLElement>('.cam-vf')!;
  const photo = body.querySelector<HTMLElement>('.cam-photo')!;
  const af = body.querySelector<HTMLElement>('.cam-af')!;
  const iris = body.querySelector<HTMLElement>('.cam-iris')!;
  const count = body.querySelector<HTMLElement>('.cam-count')!;
  const needle = body.querySelector<HTMLElement>('.cam-meter b')!;
  const tray = body.querySelector<HTMLElement>('.cam-tray')!;
  const print = body.querySelector<HTMLElement>('.cam-print')!;
  const printImg = body.querySelector<HTMLElement>('.cam-print i')!;
  const sheet = body.querySelector<HTMLElement>('.cam-sheet')!;
  const figs = [...body.querySelectorAll<HTMLElement>('.cs-f')];
  const grease = body.querySelector<SVGPathElement>('.cs-grease path')!;
  const blurAt = (t: number) => {
    const k: [number, number][] = [
      [0.15, 12],
      [0.75, 2.5],
      [1.15, 7],
      [1.6, 1.2],
      [1.85, 0],
    ];
    if (t <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++)
      if (t <= k[i][0]) {
        const [a, va] = k[i - 1];
        const [b, vb] = k[i];
        return lerp(va, vb, inOutCubic((t - a) / (b - a)));
      }
    return 0;
  };
  return {
    dur: 5.4,
    render(t) {
      // viewfinder
      const vfOut = seg(t, 2.55, 2.95);
      vf.style.opacity = String(seg(t, 0, 0.25) * (1 - vfOut));
      vf.style.transform = `scale(${1 + vfOut * 0.06})`;
      const b = blurAt(t);
      photo.style.filter = `blur(${b.toFixed(2)}px)`;
      photo.style.transform = `scale(${(1.08 - seg(t, 0.1, 1.9) * 0.06 + Math.sin(t * 7) * 0.002).toFixed(4)})`;
      const hunting = t > 0.3 && t < 1.85;
      af.classList.toggle('hunt', hunting);
      af.classList.toggle('ok', t >= 1.85);
      af.style.transform = `translate(-50%,-50%) scale(${t < 1.85 ? 1.25 - seg(t, 0.3, 1.8) * 0.25 : 1 + (1 - seg(t, 1.85, 2.05)) * 0.12})`;
      needle.style.left = `${50 + Math.sin(t * 3.1) * 18 * (1 - seg(t, 1.2, 1.9))}%`;
      // shutter: an iris of blades closing and opening
      const sh = t < 2.1 ? 0 : t < 2.22 ? seg(t, 2.1, 2.22) : 1 - seg(t, 2.22, 2.4);
      iris.style.setProperty('--r', `${(1 - sh) * 78}%`);
      iris.style.opacity = sh > 0 ? '1' : '0';
      count.textContent = t >= 2.2 ? '13' : '12';
      // developing tray
      const trayIn = seg(t, 2.6, 2.95);
      const trayOut = seg(t, 3.95, 4.25);
      tray.style.opacity = String(trayIn * (1 - trayOut));
      const dev = seg(t, 2.85, 3.95);
      printImg.style.opacity = String(outCubic(dev));
      printImg.style.filter = `contrast(${0.35 + dev * 0.65}) sepia(${(1 - dev) * 0.9}) brightness(${1.35 - dev * 0.35})`;
      tray.style.setProperty('--safe', String(1 - seg(t, 3.4, 4.0)));
      // the paper slides into the tray, then the image surfaces on it
      const slideIn = outCubic(seg(t, 2.75, 3.15));
      print.style.opacity = String(seg(t, 2.75, 2.9));
      print.style.transform = `translate(-50%,${(-50 + (1 - slideIn) * 70).toFixed(2)}%) rotate(${(-6 + slideIn * 4 + dev * 1.5).toFixed(2)}deg) scale(${(1 - trayOut * 0.42).toFixed(3)})`;
      // contact sheet
      const sIn = seg(t, 3.95, 4.3);
      sheet.style.opacity = String(sIn);
      figs.forEach((f, i) => {
        const k = outCubic(seg(t, 4.05 + (i === 3 ? 0 : 0.06 * i), 4.45 + (i === 3 ? 0 : 0.06 * i)));
        f.style.opacity = String(k);
        f.style.transform = `translateY(${((1 - k) * 10).toFixed(1)}px)`;
      });
      grease.style.strokeDashoffset = String(1 - inOutCubic(seg(t, 4.55, 5.2)));
      sheet.classList.toggle('picked', t >= 5.1);
    },
  };
};

/* ------------------------------------------------------------------ */
/* BOOKS — a book opens, pages turn, the profile inks itself in          */
/* ------------------------------------------------------------------ */
const buildBooks: Build = (body) => {
  body.innerHTML = `<div class="rm-books"><div class="bk">
  <div class="bk-base bk-right"><span class="bk-kicker">PROFILE</span><dl>
    <div><dt>設立</dt><dd>2019年</dd></div>
    <div><dt>拠点</dt><dd>東京・清澄白河</dd></div>
    <div><dt>メンバー</dt><dd>3人の小さなチーム</dd></div>
    <div><dt>領域</dt><dd>WEB・写真・映像</dd></div>
    <div><dt>好きなもの</dt><dd>朝の光、紙の手ざわり</dd></div>
  </dl><i class="bk-stamp"><b>MIRAI</b><small>2019</small></i><span class="bk-no">— 7 —</span></div>
  <div class="bk-leaf" data-i="3"><div class="bk-face bk-front"><span class="bk-kicker">INTRODUCTION</span><h5>はじめに</h5><p class="bk-lines"><i></i><i></i><i></i><i></i><i></i><i></i><i style="width:55%"></i></p><span class="bk-no">— 5 —</span></div><div class="bk-face bk-back bk-portrait"><svg viewBox="0 0 120 90" aria-hidden="true"><path d="M60 14 104 36 60 58 16 36Z"/><path d="M16 36v34l44 22V58M104 36v34L60 92"/><path d="M40 43l22 11 14-7-22-11z"/><path d="M76 47v10M62 54v10M40 43v9"/><circle cx="90" cy="33" r="5"/><path d="M90 38v10"/><path d="M26 26v16l10 5V31z"/></svg><p>MIRAI ROOM は、東京の<br>小さなクリエイティブ<br>スタジオです。</p><span class="bk-no">— 6 —</span></div></div>
  <div class="bk-leaf" data-i="2"><div class="bk-face bk-front"><span class="bk-kicker">CONTENTS</span><h5>目次</h5><ol><li><span>WEB</span><i></i>08</li><li><span>写真</span><i></i>14</li><li><span>映像</span><i></i>20</li><li><span>わたしたち</span><i></i>26</li></ol><span class="bk-no">— 3 —</span></div><div class="bk-face bk-back bk-plates"><i></i><i></i><i></i><i></i><span class="bk-no">— 4 —</span></div></div>
  <div class="bk-leaf" data-i="1"><div class="bk-face bk-front bk-title"><b>MIRAI<br>ROOM</b><span>つくることを、日常に。</span></div><div class="bk-face bk-back"><span class="bk-no">— 2 —</span></div></div>
  <div class="bk-leaf bk-cover" data-i="0"><div class="bk-face bk-front"><i class="bk-mark"></i><b>MIRAI<br>ROOM</b><span>A CREATIVE STUDIO<br>PROFILE 2026</span></div><div class="bk-face bk-back bk-endpaper"></div></div>
  <i class="bk-ribbon"></i>
</div><i class="bk-shadow"></i></div>`;
  const bk = body.querySelector<HTMLElement>('.bk')!;
  const shadow = body.querySelector<HTMLElement>('.bk-shadow')!;
  const leaves = [...body.querySelectorAll<HTMLElement>('.bk-leaf')].sort(
    (a, b) => +a.dataset.i! - +b.dataset.i!,
  );
  const rows = [...body.querySelectorAll<HTMLElement>('.bk-right dl > div')];
  const stamp = body.querySelector<HTMLElement>('.bk-stamp')!;
  const kick = body.querySelector<HTMLElement>('.bk-right .bk-kicker')!;
  const flips: [number, number][] = [
    [0.55, 1.45],
    [1.5, 2.15],
    [2.05, 2.75],
    [2.6, 3.4],
  ];
  return {
    dur: 5.2,
    render(t) {
      const arrive = outCubic(seg(t, 0, 0.5));
      const open = inOutCubic(seg(t, 0.55, 1.45));
      bk.style.transform = `translateX(${((1 - open) * -25).toFixed(2)}%) translateY(${((1 - arrive) * 18).toFixed(1)}px) rotateX(${(14 - open * 6).toFixed(2)}deg)`;
      bk.style.opacity = String(arrive);
      shadow.style.opacity = String(arrive * (0.5 + open * 0.5));
      shadow.style.transform = `translateX(${((1 - open) * -25).toFixed(2)}%) scaleX(${(0.5 + open * 0.5).toFixed(3)})`;
      leaves.forEach((leaf, i) => {
        const [a, b] = flips[i];
        const k = inOutCubic(seg(t, a, b));
        const ang = -180 * k;
        const lift = Math.sin(k * Math.PI);
        // depth in world space: unturned leaves stack cover-on-top, turned ones latest-on-top
        const depth = (k < 0.5 ? (4 - i) * 0.6 : (i + 1) * 0.6) + lift * 8;
        leaf.style.transform = `rotateY(${ang.toFixed(2)}deg) translateZ(${(k < 0.5 ? depth : -depth).toFixed(2)}px)`;
        leaf.style.zIndex = String(k > 0.5 ? 10 + i : 20 - i);
        leaf.style.setProperty('--shade', lift.toFixed(3));
        leaf.style.setProperty('--curl', `${(lift * (i === 0 ? 0 : 5)).toFixed(2)}deg`);
      });
      kick.style.opacity = String(seg(t, 3.3, 3.6));
      rows.forEach((r, i) => {
        const k = seg(t, 3.45 + i * 0.2, 3.9 + i * 0.2);
        r.style.clipPath = `inset(0 ${((1 - outCubic(k)) * 100).toFixed(1)}% 0 0)`;
      });
      const s = seg(t, 4.65, 4.95);
      stamp.style.opacity = String(s > 0 ? 0.92 : 0);
      stamp.style.transform = `rotate(-9deg) scale(${(1.7 - outBack(s) * 0.7).toFixed(3)})`;
    },
  };
};

/* ------------------------------------------------------------------ */
/* TV — a motion reel: primitives drop, morph into the mark, logo sting */
/* ------------------------------------------------------------------ */
const N = 72;
type Pt = [number, number];
const polyCircle = (cx: number, cy: number, r: number): Pt[] =>
  Array.from({ length: N }, (_, i) => {
    const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
const polyPath = (corners: Pt[]): Pt[] => {
  // evenly sample a closed polyline, starting at corners[0]
  const segs = corners.map((p, i) => {
    const q = corners[(i + 1) % corners.length];
    return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) };
  });
  const total = segs.reduce((s, x) => s + x.len, 0);
  const out: Pt[] = [];
  for (let i = 0; i < N; i++) {
    let d = (i / N) * total;
    for (const s of segs) {
      if (d <= s.len) {
        const k = d / s.len;
        out.push([lerp(s.p[0], s.q[0], k), lerp(s.p[1], s.q[1], k)]);
        break;
      }
      d -= s.len;
    }
  }
  return out;
};
const polyRect = (cx: number, cy: number, w: number, h: number) =>
  polyPath([
    [cx, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
    [cx - w / 2, cy - h / 2],
  ]);
const polyTri = (cx: number, top: number, w: number, h: number) =>
  polyPath([
    [cx, top],
    [cx + w / 2, top + h],
    [cx - w / 2, top + h],
  ]);
const mix = (a: Pt[], b: Pt[], k: number): Pt[] =>
  a.map((p, i) => [lerp(p[0], b[i][0], k), lerp(p[1], b[i][1], k)]);
const moveScale = (a: Pt[], dx: number, dy: number, sx: number, sy: number, ox: number, oy: number, rot = 0): Pt[] => {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return a.map(([x, y]) => {
    const px = (x - ox) * sx;
    const py = (y - oy) * sy;
    return [ox + px * c - py * s + dx, oy + px * s + py * c + dy];
  });
};
const toD = (pts: Pt[]) =>
  'M' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L') + 'Z';

const buildTV: Build = (body, narrow) => {
  const FLOOR = 132;
  // primitives
  const circle0 = polyCircle(112, FLOOR - 19, 19);
  const square0 = polyRect(162, FLOOR - 17, 34, 34);
  const tri0 = polyTri(212, FLOOR - 36, 40, 36);
  // the mark (house = room) centred at 160
  const roof = polyTri(160, 50, 64, 30);
  const bodyR = polyRect(160, 99, 46, 40);
  const win = polyCircle(160, 99, 8.5);
  const keys = [
    ['SHAPE', [0.1, 0.62, 0.95]],
    ['MORPH', [1.15, 1.95, 2.3]],
    ['TYPE', [2.4, 3.15, 3.8]],
    ['FX', [3.9, 4.55]],
  ] as const;
  const DUR = 4.9;
  const lanes = keys
    .map(
      ([, ks]) =>
        `<div class="rl-lane">${ks.map((k) => `<i data-k="${k}" style="left:${((k / DUR) * 100).toFixed(2)}%"></i>`).join('')}<b style="left:${((ks[0] / DUR) * 100).toFixed(2)}%;width:${(((ks[ks.length - 1] - ks[0]) / DUR) * 100).toFixed(2)}%"></b></div>`,
    )
    .join('');
  const names = keys.map(([name]) => `<span>${name}</span>`).join('');
  const ticks = Array.from({ length: 6 }, (_, i) => `<span style="left:${((i / DUR) * 100).toFixed(2)}%">${i}s</span>`).join('');
  body.innerHTML = `<div class="rm-reel${narrow ? ' narrow' : ''}"><div class="rl-screen"><svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" class="rl-bg"/><circle class="rl-ring" cx="160" cy="84" r="10"/><line class="rl-floor" x1="70" x2="250" y1="${FLOOR}" y2="${FLOOR}"/><path class="rl-a"/><path class="rl-b"/><path class="rl-c"/><text class="rl-word" x="0" y="0">MIRAI</text><text class="rl-tag" x="0" y="0">A CREATIVE STUDIO</text></svg><span class="rl-tc">00:00:00:00</span><span class="rl-rec">● PREVIEW</span></div><div class="rl-layers"><b>LAYERS</b><span data-l="0">▣ body</span><span data-l="1">△ roof</span><span data-l="2">○ window</span><span data-l="3">T MIRAI</span><span data-l="4">T tagline</span></div><div class="rl-timeline"><div class="rl-names"><span></span>${names}</div><div class="rl-area"><div class="rl-ruler">${ticks}</div>${lanes}<i class="rl-head"></i></div></div></div>`;
  const pa = body.querySelector<SVGPathElement>('.rl-a')!;
  const pb = body.querySelector<SVGPathElement>('.rl-b')!;
  const pc = body.querySelector<SVGPathElement>('.rl-c')!;
  const word = body.querySelector<SVGTextElement>('.rl-word')!;
  const tagl = body.querySelector<SVGTextElement>('.rl-tag')!;
  const ring = body.querySelector<SVGCircleElement>('.rl-ring')!;
  const floor = body.querySelector<SVGLineElement>('.rl-floor')!;
  const tc = body.querySelector<HTMLElement>('.rl-tc')!;
  const head = body.querySelector<HTMLElement>('.rl-head')!;
  const diamonds = [...body.querySelectorAll<HTMLElement>('.rl-lane i')];
  const layers = [...body.querySelectorAll<HTMLElement>('.rl-layers span')];
  // drop with a bounce and squash & stretch
  const drop = (pts: Pt[], t: number, t0: number, cx: number): Pt[] => {
    const fall = seg(t, t0, t0 + 0.42);
    let y = -150 * (1 - fall * fall);
    let sx = 1;
    let sy = 1;
    if (fall < 1) {
      sy = 1 + fall * 0.18;
      sx = 1 - fall * 0.08;
    } else {
      const b = seg(t, t0 + 0.42, t0 + 0.8);
      y = -Math.sin(b * Math.PI) * 18 * (1 - b * 0.3);
      const sq = Math.max(0, 1 - b * 6);
      const st = Math.sin(b * Math.PI);
      sy = 1 - sq * 0.3 + st * 0.08;
      sx = 1 + sq * 0.28 - st * 0.05;
    }
    return moveScale(pts, 0, y, sx, sy, cx, FLOOR, 0);
  };
  return {
    dur: DUR,
    render(t) {
      // 1. drop
      let A = drop(circle0, t, 0.1, 112);
      let B = drop(square0, t, 0.26, 162);
      let C = drop(tri0, t, 0.42, 212);
      // 2. morph into the mark: circle → roof, square → body, triangle → window
      const m = inOutCubic(seg(t, 1.15, 1.95));
      const spin = Math.sin(m * Math.PI);
      if (m > 0) {
        A = moveScale(mix(A, roof, m), 0, -spin * 16, 1, 1, lerp(112, 160, m), lerp(113, 65, m), spin * 0.6);
        B = mix(B, bodyR, m);
        C = moveScale(mix(C, win, m), 0, -spin * 26, 1, 1, lerp(212, 160, m), lerp(114, 99, m), -spin * 1.4);
      }
      // 3. slide left while the word writes on
      const slide = inOutCubic(seg(t, 2.3, 2.95));
      const pop = t > 3.9 ? 1 + Math.sin(seg(t, 3.9, 4.35) * Math.PI) * 0.06 : 1;
      const mx = -62 * slide;
      const ms = (1 - slide * 0.12) * pop;
      A = moveScale(A, mx, 0, ms, ms, 160, 84);
      B = moveScale(B, mx, 0, ms, ms, 160, 84);
      C = moveScale(C, mx, 0, ms, ms, 160, 84);
      pa.setAttribute('d', toD(A));
      pb.setAttribute('d', toD(B));
      pc.setAttribute('d', toD(C));
      const cm = seg(t, 1.5, 1.95);
      pc.style.fill = cm >= 1 ? '' : `color-mix(in srgb, #9fb58f ${((1 - cm) * 100).toFixed(0)}%, #22322a)`;
      floor.style.opacity = String(seg(t, 0, 0.2) * (1 - seg(t, 1.1, 1.6)));
      // wordmark
      const wx = 160 + mx + 42;
      word.setAttribute('x', wx.toFixed(1));
      word.setAttribute('y', '100');
      tagl.setAttribute('x', (wx + 2).toFixed(1));
      tagl.setAttribute('y', '118');
      const write = seg(t, 2.4, 3.15);
      word.style.strokeDashoffset = String(170 * (1 - inOutCubic(write)));
      word.style.fillOpacity = String(seg(t, 3.0, 3.35));
      word.style.opacity = write > 0 ? '1' : '0';
      const tg = outCubic(seg(t, 3.25, 3.8));
      tagl.style.opacity = String(tg);
      tagl.style.letterSpacing = `${(0.55 - tg * 0.3).toFixed(3)}em`;
      // sting: a ripple from the window
      const r = seg(t, 3.9, 4.6);
      ring.setAttribute('r', (8 + outCubic(r) * 150).toFixed(1));
      ring.setAttribute('cx', (160 + mx).toFixed(1));
      ring.setAttribute('cy', '94');
      ring.style.opacity = r > 0 && r < 1 ? String((1 - r) * 0.9) : '0';
      // timeline UI
      const f = Math.floor(Math.min(t, DUR) * 24);
      const ss = String(Math.floor(f / 24)).padStart(2, '0');
      const ff = String(f % 24).padStart(2, '0');
      tc.textContent = `00:00:${ss}:${ff}`;
      head.style.left = `${((Math.min(t, DUR) / DUR) * 100).toFixed(2)}%`;
      diamonds.forEach((d) => d.classList.toggle('hit', t >= +d.dataset.k!));
      const act = t < 1.1 ? [0, 1, 2] : t < 2.3 ? [0, 1, 2] : t < 3.3 ? [3] : t < 3.9 ? [4] : [];
      layers.forEach((l, i) => l.classList.toggle('on', act.includes(i)));
    },
  };
};

const BUILDERS: Record<Pick, Build> = {
  PC: buildPC,
  CAMERA: buildCamera,
  BOOKS: buildBooks,
  TV: buildTV,
};

/* ------------------------------------------------------------------ */
/* the window manager                                                  */
/* ------------------------------------------------------------------ */
const mount: Signature = ({ cover, reduced, narrow }) => {
  const explore = cover.querySelector<HTMLElement>('.room-explore');
  const directory = cover.querySelector<HTMLElement>('.room-directory');
  const introH1 = cover.querySelector<HTMLElement>('.room-intro h1');
  if (!explore || !directory) return;
  const savedCoverStyle = cover.getAttribute('style');
  cover.classList.add('rm-armed');

  const win = el('div', 'rm-win');
  win.innerHTML = `<div class="rm-frame"><div class="rm-bar"><i class="rm-glyph" aria-hidden="true"></i><span class="rm-title"><b></b><span></span></span><span class="rm-state" aria-hidden="true"></span><button type="button" class="rm-replay" aria-label="もう一度再生"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8"/></svg><span>もう一度</span></button></div><div class="rm-stage"><div class="rm-body" aria-hidden="true"></div></div></div>`;
  const body = win.querySelector<HTMLElement>('.rm-body')!;
  const frame = win.querySelector<HTMLElement>('.rm-frame')!;
  const titleB = win.querySelector<HTMLElement>('.rm-title b')!;
  const titleS = win.querySelector<HTMLElement>('.rm-title span')!;
  const state = win.querySelector<HTMLElement>('.rm-state')!;
  const replay = win.querySelector<HTMLButtonElement>('.rm-replay')!;
  const tether = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tether.setAttribute('class', 'rm-tether');
  tether.setAttribute('aria-hidden', 'true');
  tether.innerHTML = '<path pathLength="1"/><circle class="rm-pin-ring" r="11"/><circle class="rm-pin" r="3.5"/>';
  const tPath = tether.querySelector('path')!;
  const tRing = tether.querySelector<SVGCircleElement>('.rm-pin-ring')!;
  const tPin = tether.querySelector<SVGCircleElement>('.rm-pin')!;
  cover.appendChild(tether);
  cover.appendChild(win);
  if (narrow) win.classList.add('rm-narrow');

  // projection of the room objects, using the scene's initial camera
  const cam = new PerspectiveCamera(38, 1, 0.1, 80);
  cam.position.set(6, 4.8, 7);
  cam.lookAt(0, 0.6, 0);
  cam.updateMatrixWorld();
  const anchor = (p: Pick) => {
    const canvas = explore.querySelector('canvas') ?? explore;
    const r = canvas.getBoundingClientRect();
    const cr = cover.getBoundingClientRect();
    cam.aspect = r.width / Math.max(1, r.height);
    cam.updateProjectionMatrix();
    const v = new Vector3(...WORLD[p]).project(cam);
    return {
      x: r.left - cr.left + ((v.x + 1) / 2) * r.width,
      y: r.top - cr.top + ((1 - v.y) / 2) * r.height,
    };
  };

  // --- layout ---
  const BASE_W = 500;
  const BAR = 34;
  const BODY_H = 300;
  let geom = { x: 0, y: 0, w: BASE_W, h: BAR + BODY_H, s: 1 };
  let baseCoverH = 0;
  const place = (p: Pick) => {
    const W = cover.clientWidth;
    if (narrow) {
      cover.style.height = '';
      baseCoverH = cover.offsetHeight;
      const w = W - 32;
      const top = directory.offsetTop - 6;
      const h = BAR + BODY_H;
      cover.style.height = `${baseCoverH + h + 18}px`;
      geom = { x: 16, y: top, w, h, s: 1 };
      frame.style.width = `${w}px`;
      frame.style.transform = '';
    } else {
      const a = anchor(p);
      let textRight = W * 0.25;
      if (introH1) {
        const range = document.createRange();
        range.selectNodeContents(introH1);
        const rr = range.getBoundingClientRect();
        textRight = rr.right - cover.getBoundingClientRect().left;
      }
      const right = p === 'TV';
      let x0: number;
      let x1: number;
      if (right) {
        x0 = a.x + 110;
        x1 = W - 22;
      } else {
        x0 = textRight + 30;
        x1 = a.x - (p === 'BOOKS' ? 70 : 90);
      }
      const w = clamp(x1 - x0, 330, 540);
      const s = w / BASE_W;
      const x = right ? x1 - w : x0;
      geom = { x, y: 28, w, h: (BAR + BODY_H) * s, s };
      frame.style.width = `${BASE_W}px`;
      frame.style.transform = `scale(${s})`;
    }
    win.style.left = `${geom.x}px`;
    win.style.top = `${geom.y}px`;
    win.style.width = `${geom.w}px`;
    win.style.height = `${geom.h}px`;
    drawTether(p, false);
  };
  const drawTether = (p: Pick, animate: boolean) => {
    if (narrow) {
      tether.style.display = 'none';
      return;
    }
    const a = anchor(p);
    const right = geom.x > a.x;
    const ex = right ? geom.x : geom.x + geom.w;
    const ey = Math.min(geom.y + geom.h - 30, Math.max(geom.y + 40, a.y - 10));
    const mx = (a.x + ex) / 2;
    tPath.setAttribute('d', `M${a.x.toFixed(1)} ${a.y.toFixed(1)}C${mx.toFixed(1)} ${(a.y + 30).toFixed(1)} ${mx.toFixed(1)} ${ey.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    tPin.setAttribute('cx', a.x.toFixed(1));
    tPin.setAttribute('cy', a.y.toFixed(1));
    tRing.setAttribute('cx', a.x.toFixed(1));
    tRing.setAttribute('cy', a.y.toFixed(1));
    tether.style.display = '';
    tether.classList.remove('hide');
    if (animate && !reduced) {
      tether.classList.remove('draw');
      void tether.getBoundingClientRect();
      tether.classList.add('draw');
    } else tether.classList.add('draw');
  };

  // --- performance clock ---
  let current: Pick | null = null;
  let perf: Perf | null = null;
  let t = 0;
  let playing = false;
  let visible = true;
  let raf = 0;
  let last = 0;
  let timers: number[] = [];
  let anims: Animation[] = [];
  const clearPending = () => {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
    anims.forEach((a) => a.cancel());
    anims = [];
  };
  const loop = (now: number) => {
    raf = 0;
    if (!perf || !playing || !visible || document.hidden) return;
    const dt = Math.min(0.34, (now - last) / 1000);
    last = now;
    t += dt;
    win.style.setProperty('--p', String(Math.min(1, t / perf.dur)));
    if (t >= perf.dur) {
      t = perf.dur;
      perf.render(t);
      finish();
      return;
    }
    perf.render(t);
    raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!raf && playing && visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };
  const finish = () => {
    playing = false;
    win.style.setProperty('--p', '1');
    win.classList.add('rm-idle');
    win.classList.remove('rm-playing');
    if (current) state.textContent = META[current].done;
  };
  const start = () => {
    t = 0;
    playing = true;
    win.classList.remove('rm-idle');
    win.classList.add('rm-playing');
    state.textContent = '';
    perf?.render(0);
    kick();
  };
  const build = (p: Pick) => {
    body.innerHTML = '';
    win.dataset.pick = p;
    titleB.textContent = META[p].app;
    titleS.textContent = META[p].doc;
    perf = BUILDERS[p](body, narrow);
  };
  const emerge = (p: Pick) => {
    build(p);
    place(p);
    win.classList.add('rm-shown');
    if (reduced) {
      perf!.render(perf!.dur, true);
      finish();
      return;
    }
    perf!.render(0, true);
    const a = anchor(p);
    const ox = a.x - geom.x;
    const oy = a.y - geom.y;
    win.style.transformOrigin = `${ox}px ${oy}px`;
    anims.push(
      win.animate(
        [
          { transform: 'scale(0.04)', opacity: 0, filter: 'blur(6px)' },
          { opacity: 1, offset: 0.35 },
          { transform: 'scale(1.015)', offset: 0.75, filter: 'blur(0px)' },
          { transform: 'scale(1)', opacity: 1, filter: 'blur(0px)' },
        ],
        { duration: 640, easing: 'cubic-bezier(.2,.8,.25,1)' },
      ),
    );
    drawTether(p, true);
    timers.push(window.setTimeout(start, 380));
  };
  const show = (p: Pick) => {
    if (p === current) return;
    const prev = current;
    current = p;
    clearPending();
    playing = false;
    if (!prev || reduced || !win.classList.contains('rm-shown')) {
      emerge(p);
      return;
    }
    // fold the old window back into its object, then open the new one
    const a = anchor(prev);
    win.style.transformOrigin = `${a.x - geom.x}px ${a.y - geom.y}px`;
    tether.classList.add('hide');
    const out = win.animate(
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0.08)', opacity: 0, filter: 'blur(4px)' },
      ],
      { duration: 230, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' },
    );
    anims.push(out);
    out.onfinish = () => {
      if (current !== p) return;
      anims = anims.filter((x) => x !== out);
      emerge(p);
      out.cancel();
    };
  };

  const readPick = (): Pick => {
    const btns = [...directory.querySelectorAll('button')];
    const i = btns.findIndex((b) => b.getAttribute('aria-pressed') === 'true');
    return ORDER[i] ?? 'PC';
  };
  const mo = new MutationObserver(() => show(readPick()));
  mo.observe(directory, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });

  replay.addEventListener('click', () => {
    if (!perf || reduced) return;
    start();
  });
  // dragging the room invalidates the tether
  const onDown = () => tether.classList.add('hide');
  explore.addEventListener('pointerdown', onDown);

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    win.classList.toggle('rm-paused', !visible);
    if (visible) kick();
  });
  io.observe(cover);
  const onVis = () => {
    win.classList.toggle('rm-paused', document.hidden);
    if (!document.hidden) kick();
  };
  document.addEventListener('visibilitychange', onVis);
  let resizeT = 0;
  const onResize = () => {
    window.clearTimeout(resizeT);
    resizeT = window.setTimeout(() => current && place(current), 120);
  };
  window.addEventListener('resize', onResize);

  // first performance once the room has had a moment to render
  const firstT = window.setTimeout(() => show(readPick()), reduced ? 0 : 700);

  return () => {
    window.clearTimeout(firstT);
    window.clearTimeout(resizeT);
    clearPending();
    cancelAnimationFrame(raf);
    mo.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('resize', onResize);
    explore.removeEventListener('pointerdown', onDown);
    win.remove();
    tether.remove();
    cover.classList.remove('rm-armed');
    if (savedCoverStyle === null) cover.removeAttribute('style');
    else cover.setAttribute('style', savedCoverStyle);
  };
};
export default mount;
