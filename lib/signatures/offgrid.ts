import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Signature } from './types';

/**
 * OFF THE GRID — "leave the notifications behind".
 * The hero arrives buried under a pile of everyday notifications over a grey,
 * blurred mountain. Scrolling (pinned) sends a gust of wind through the hero:
 * the cards peel off and tumble away from left to right, wind streaks and fog
 * pass, and the photo regains its focus and colour.
 */

type Note = {
  app: string;
  icon: IconName;
  tone: string;
  title: string;
  body: string;
  time: string;
  badge?: number;
};
type IconName =
  | 'cal'
  | 'chat'
  | 'mail'
  | 'bat'
  | 'bell'
  | 'task'
  | 'box'
  | 'cloud'
  | 'gear'
  | 'phone'
  | 'video'
  | 'cart'
  | 'lock'
  | 'coin'
  | 'news';

const ICONS: Record<IconName, string> = {
  cal: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  chat: '<path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3v-3H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5z"/>',
  mail: '<rect x="3.5" y="6" width="17" height="12.5" rx="2"/><path d="m4 7 8 6 8-6"/>',
  bat: '<rect x="3" y="8" width="15.5" height="8.5" rx="2"/><path d="M21 11v2.5"/><rect x="5" y="10" width="3" height="4.5" rx=".6" fill="currentColor" stroke="none"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  task: '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  box: '<path d="m12 3.5 8 4v9l-8 4-8-4v-9z"/><path d="m4 7.5 8 4 8-4M12 11.5v9"/>',
  cloud: '<path d="M7.5 18.5a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1.3 3.4 3.4 0 0 1-.2 6.7z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2 18 18M6 18l1.8-1.8M16.2 7.8 18 6"/>',
  phone: '<path d="M7 4h3l1.5 4-2 1.3a9 9 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2z"/>',
  video: '<rect x="3.5" y="7" width="12" height="10" rx="2"/><path d="m15.5 11 5-3v8l-5-3z"/>',
  cart: '<path d="M3.5 5h2.5l2 10h10l2-7H7"/><circle cx="9.5" cy="19" r="1.2"/><circle cx="16.5" cy="19" r="1.2"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="m9 8 3 4 3-4M12 12v5M9.5 13h5M9.5 15.5h5"/>',
  news: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M7.5 9h9M7.5 12.5h9M7.5 16h5"/>',
};

const NOTES: Note[] = [
  { app: 'リマインダー', icon: 'bell', tone: '#d9894a', title: '会議まで5分', body: '資料の最終確認を忘れずに', time: '今' },
  { app: 'メッセージ', icon: 'chat', tone: '#5f9a6e', title: '未読メッセージ 23件', body: 'グループ「定例メンバー」ほか4件', time: '今', badge: 23 },
  { app: 'メール', icon: 'mail', tone: '#5a7fb0', title: '締切：本日18:00', body: '【再送】見積書のご確認のお願い', time: '2分前' },
  { app: 'カレンダー', icon: 'cal', tone: '#c65a4e', title: 'カレンダー：定例', body: '10:00 – 10:30・会議室B', time: '9:30' },
  { app: 'システム', icon: 'bat', tone: '#8a8f96', title: 'バッテリー残量 20%', body: '低電力モードをオンにしますか？', time: '今' },
  { app: 'チャット', icon: 'chat', tone: '#7a68a8', title: '@あなた 至急確認お願いします', body: 'さっきの件、どうなりましたか？', time: '1分前', badge: 8 },
  { app: 'タスク', icon: 'task', tone: '#4f8c86', title: '期限切れのタスクが3件', body: '週次レポート ほか2件', time: '8:02' },
  { app: 'メール', icon: 'mail', tone: '#5a7fb0', title: '未読 148件', body: '受信トレイを整理しましょう', time: '昨日', badge: 148 },
  { app: '電話', icon: 'phone', tone: '#5f9a6e', title: '不在着信 2件', body: '営業部 田中', time: '3分前' },
  { app: 'ストレージ', icon: 'cloud', tone: '#6f93b8', title: 'ストレージがいっぱいです', body: '写真のバックアップが停止しました', time: '7:45' },
  { app: 'アップデート', icon: 'gear', tone: '#8a8f96', title: 'ソフトウェア・アップデート', body: '今夜 2:00 に再起動します', time: '昨日' },
  { app: '会議', icon: 'video', tone: '#4d78c4', title: 'オンライン会議が始まっています', body: 'プロジェクト進捗共有・参加する', time: '今' },
  { app: '配送', icon: 'box', tone: '#b98a4e', title: '不在のため持ち帰りました', body: '再配達の日時を選んでください', time: '11:12' },
  { app: '家計簿', icon: 'coin', tone: '#c2a14a', title: '今月の予算を超えました', body: '外食費 +¥12,400', time: '8:30' },
  { app: 'セキュリティ', icon: 'lock', tone: '#6b7077', title: 'パスワードの有効期限まで3日', body: '今すぐ変更してください', time: '昨日' },
  { app: 'カレンダー', icon: 'cal', tone: '#c65a4e', title: '15:00 1on1', body: '場所：オンライン', time: '9:00' },
  { app: 'ニュース', icon: 'news', tone: '#a05a5a', title: '見逃した記事が12件', body: '今日のまとめを読む', time: '6:58' },
  { app: 'ショッピング', icon: 'cart', tone: '#d27a4a', title: 'カートに商品が残っています', body: 'セールは今夜まで', time: '10:04' },
  { app: '経費', icon: 'coin', tone: '#c2a14a', title: '経費精算が差し戻されました', body: '領収書の添付が必要です', time: '8:47' },
  { app: 'タスク', icon: 'task', tone: '#4f8c86', title: '提出期限まで あと2時間', body: '月次レポート（ドラフト）', time: '今' },
  { app: 'チャット', icon: 'chat', tone: '#7a68a8', title: '新着リアクション 57件', body: '「来週の件」に返信がありました', time: '5分前', badge: 57 },
  { app: 'カレンダー', icon: 'cal', tone: '#c65a4e', title: '明日 8:30 朝会', body: '事前アジェンダを確認', time: '昨日' },
  { app: 'メッセージ', icon: 'chat', tone: '#5f9a6e', title: '「今どこ？」', body: '既読がつきません', time: '今' },
  { app: 'メール', icon: 'mail', tone: '#5a7fb0', title: 'Re: Re: Re: 日程調整', body: '候補日を再度お送りします', time: '4分前' },
  { app: 'リマインダー', icon: 'bell', tone: '#d9894a', title: '請求書の支払い', body: '期日：明日', time: '9:15' },
  { app: 'システム', icon: 'gear', tone: '#8a8f96', title: 'Wi-Fi に接続できません', body: '設定を確認してください', time: '今' },
];

// the ones that keep arriving while you look at the pile
const ARRIVALS: Note[] = [
  { app: 'チャット', icon: 'chat', tone: '#7a68a8', title: '至急', body: '5分だけ電話いいですか？', time: '今' },
  { app: 'カレンダー', icon: 'cal', tone: '#c65a4e', title: '予定が変更されました', body: '定例 → 11:00 に移動', time: '今' },
  { app: 'メール', icon: 'mail', tone: '#5a7fb0', title: '未読 149件', body: '【重要】本日中にご返信ください', time: '今', badge: 149 },
  { app: 'システム', icon: 'bat', tone: '#c65a4e', title: 'バッテリー残量 10%', body: '充電してください', time: '今' },
  { app: 'メッセージ', icon: 'chat', tone: '#5f9a6e', title: '未読メッセージ 24件', body: 'グループ「定例メンバー」', time: '今', badge: 24 },
];

type Card = {
  el: HTMLElement;
  w: number;
  fx: number; // fractional position (0..1) of card centre
  fy: number;
  x: number;
  y: number;
  rot: number;
  z: number;
  start: number; // gust progress at which the card lets go
  dur: number;
  spin: number;
  tumble: number;
  rise: number;
  curl: number;
  phase: number;
  drift: number;
  arriveAt: number; // ms after mount; -1 = already there
  arrived: number; // timestamp it appeared
  buzz: number; // timestamp of last buzz
  fromTop: boolean;
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cardHTML(n: Note, variant: string) {
  const badge = n.badge
    ? `<em class="og-badge">${n.badge > 99 ? '99+' : n.badge}</em>`
    : '';
  return `<div class="og-card-head"><i class="og-ico" style="--tone:${n.tone}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n.icon]}</svg>${badge}</i><span>${n.app}</span><time>${n.time}</time></div><b>${n.title}</b><p>${n.body}</p>${variant === 'stack' ? '<small>ほか ' + (3 + (n.title.length % 9)) + ' 件の通知</small>' : ''}`;
}

const mount: Signature = ({ cover, embedded, reduced, narrow }) => {
  // reduced motion: the clean, final hero — nothing to bury.
  if (reduced) return;
  const img = cover.querySelector<HTMLImageElement>(':scope > img');
  const h1 = cover.querySelector<HTMLElement>('h1');
  const topline = cover.querySelector<HTMLElement>('.offgrid-topline');
  const bottom = cover.querySelector<HTMLElement>('.offgrid-bottom');
  if (!img || !h1) return;

  gsap.registerPlugin(ScrollTrigger);
  const saved = new Map<HTMLElement, string>();
  const keep = (el: HTMLElement | null) => {
    if (el && !saved.has(el)) saved.set(el, el.getAttribute('style') ?? '');
  };
  [img, h1, topline, bottom].forEach(keep);
  cover.classList.add('og-armed');

  // ---------- layers ----------
  const veil = document.createElement('div');
  veil.className = 'og-veil';
  const pile = document.createElement('div');
  pile.className = 'og-pile';
  pile.setAttribute('aria-hidden', 'true');
  const wind = document.createElement('canvas');
  wind.className = 'og-wind';
  wind.setAttribute('aria-hidden', 'true');
  const status = document.createElement('div');
  status.className = 'og-status';
  status.setAttribute('aria-hidden', 'true');
  status.innerHTML =
    '<span class="og-clock">9:41</span><span class="og-status-r"><i class="og-bars"><b></b><b></b><b></b><b></b></i><span>通知 173件</span><i class="og-batt"><b></b></i><span>20%</span></span>';
  const hint = document.createElement('button');
  hint.type = 'button';
  hint.className = 'og-hint';
  hint.innerHTML =
    '<svg viewBox="0 0 40 16" aria-hidden="true"><path d="M1 5.5h22a4 4 0 1 0-4-4M1 10.5h30a4 4 0 1 1-4 4"/></svg><span>' +
    (narrow ? 'スワイプで、ぜんぶ置いていく' : 'スクロールで、ぜんぶ置いていく') +
    '</span>';
  hint.setAttribute('aria-label', '通知を風で吹き飛ばして、山の景色を見る');
  // the clear world, revealed behind the gust front (a sharp twin of the photo)
  const clearImg = document.createElement('img');
  clearImg.className = 'og-clear';
  clearImg.alt = '';
  clearImg.setAttribute('aria-hidden', 'true');
  clearImg.src = img.currentSrc || img.src;
  img.parentNode?.insertBefore(veil, img.nextSibling);
  veil.parentNode?.insertBefore(clearImg, veil.nextSibling);
  for (const n of [pile, wind, status, hint]) cover.appendChild(n);

  // ---------- cards ----------
  const rand = rng(1017);
  const cards: Card[] = [];
  const cardW = narrow ? 262 : embedded ? 300 : 322;
  const make = (n: Note, arriveAt: number) => {
    const el = document.createElement('div');
    const r = rand();
    const variant = r < 0.34 ? 'desk' : r < 0.5 ? 'stack' : 'phone';
    el.className = `og-card og-card--${variant}`;
    el.style.width = `${cardW - (variant === 'desk' ? 18 : 0)}px`;
    el.innerHTML = cardHTML(n, variant);
    pile.appendChild(el);
    const c: Card = {
      el,
      w: cardW,
      fx: 0,
      fy: 0,
      x: 0,
      y: 0,
      rot: (rand() - 0.5) * (variant === 'desk' ? 5 : 11),
      z: 0,
      start: 0,
      dur: 0.22 + rand() * 0.12,
      spin: (rand() < 0.8 ? 1 : -1) * (160 + rand() * 520),
      tumble: (rand() - 0.5) * 2 * (35 + rand() * 80),
      rise: 0.25 + rand() * 0.95,
      curl: 0.6 + rand() * 1.8,
      phase: rand() * Math.PI * 2,
      drift: (rand() - 0.3) * 0.35,
      arriveAt,
      arrived: arriveAt < 0 ? 0 : -1,
      buzz: -1,
      fromTop: rand() < 0.5,
    };
    cards.push(c);
    return c;
  };
  // jittered grid → dense, overlapping pile (denser left, where the wind hits first)
  const cols = narrow ? 2 : embedded ? 5 : 6;
  const rows = narrow ? 9 : 7;
  let ni = 0;
  const grid: [number, number][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (rand() < (narrow ? 0.12 : 0.2)) continue;
      grid.push([
        (c + 0.5 + (rand() - 0.5) * 0.9 + (r % 2 ? 0.25 : -0.15)) / cols,
        (r + 0.5 + (rand() - 0.5) * 0.7) / rows,
      ]);
    }
  // shuffle so z-order is not row-major
  for (let i = grid.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }
  grid.forEach(([fx, fy], i) => {
    const c = make(NOTES[ni++ % NOTES.length], 60 + i * 26);
    c.fx = fx;
    c.fy = fy;
    c.el.style.opacity = '0';
  });
  const arrivalTimes = [2200, 3700, 5400, 7500, 9900];
  ARRIVALS.slice(0, narrow ? 3 : 5).forEach((n, i) => {
    const c = make(n, arrivalTimes[i]);
    c.fx = narrow ? 0.5 + (rand() - 0.5) * 0.2 : 0.3 + rand() * 0.45;
    c.fy = narrow ? 0.22 + i * 0.2 : 0.2 + rand() * 0.55;
    c.rot *= 0.4;
    c.el.classList.add('og-card--fresh');
    c.el.style.opacity = '0';
  });
  cards.forEach((c, i) => {
    c.z = i;
    c.el.style.zIndex = String(i);
  });

  // ---------- layout ----------
  let W = 0;
  let H = 0;
  let dpr = 1;
  const ctx2 = wind.getContext('2d');
  const layout = () => {
    W = cover.clientWidth;
    H = cover.clientHeight;
    for (const c of cards) {
      const w = (c.w = c.el.offsetWidth);
      const h = c.el.offsetHeight;
      c.x = c.fx * W - w / 2;
      c.y = c.fy * H - h / 2;
      c.el.style.left = `${c.x}px`;
      c.el.style.top = `${c.y}px`;
      // wind comes from the left: cards on the left let go first
      const cx = clamp((c.x + w / 2) / W);
      c.start = 0.03 + cx * 0.56 + (c.phase / (Math.PI * 2)) * 0.1;
    }
    dpr = Math.min(devicePixelRatio || 1, narrow ? 1.5 : 1.25);
    wind.width = Math.round(W * dpr);
    wind.height = Math.round(H * dpr);
  };
  layout();

  // ---------- wind particles ----------
  type Streak = { x: number; y: number; len: number; w: number; v: number; a: number; wave: number };
  type Wisp = { x: number; y: number; r: number; v: number; a: number };
  const streaks: Streak[] = [];
  const wisps: Wisp[] = [];
  const sr = rng(7);
  for (let i = 0; i < (narrow ? 34 : 64); i++)
    streaks.push({
      x: sr(),
      y: sr(),
      len: 60 + sr() * 280,
      w: 0.5 + sr() * 1.3,
      v: 0.6 + sr() * 1.1,
      a: 0.25 + sr() * 0.6,
      wave: sr() * 6.28,
    });
  for (let i = 0; i < (narrow ? 5 : 8); i++)
    wisps.push({ x: sr(), y: 0.25 + sr() * 0.75, r: 0.18 + sr() * 0.28, v: 0.3 + sr() * 0.5, a: 0.35 + sr() * 0.4 });
  const fog = document.createElement('canvas');
  fog.width = fog.height = 128;
  const fctx = fog.getContext('2d');
  if (fctx) {
    const g = fctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(236,240,236,0.55)');
    g.addColorStop(0.45, 'rgba(230,236,232,0.22)');
    g.addColorStop(1, 'rgba(230,236,232,0)');
    fctx.fillStyle = g;
    fctx.fillRect(0, 0, 128, 128);
  }

  // ---------- scroll / pin ----------
  const pinLen = embedded ? 440 : narrow ? 620 : 1150;
  const st = ScrollTrigger.create({
    trigger: cover,
    start: () =>
      cover.offsetHeight < window.innerHeight - 20 ? 'center center' : 'top top',
    end: `+=${pinLen}`,
    pin: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onRefresh: () => layout(),
  });
  let target = 0;
  let released = false;
  const readScroll = () => {
    const end = st.end || 1;
    target = released ? 1 : clamp(window.scrollY / end);
  };
  readScroll();
  let P = target;
  let lastP = P;
  let gustV = 0;

  hint.addEventListener('click', () => {
    window.scrollTo({ top: st.end + 2, behavior: 'smooth' });
  });
  // keyboard users landing on the CTA get the clear view immediately
  const onFocus = (e: FocusEvent) => {
    if (e.target !== hint && P < 1) released = true;
  };
  cover.addEventListener('focusin', onFocus);

  // ---------- render ----------
  const t0 = performance.now();
  let raf = 0;
  let last = t0;
  let visible = true;
  let nextBuzz = 3200;
  let lastVisuals = '';

  const easeOutBack = (t: number) => {
    const c1 = 1.5;
    return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const el = now - t0;
    readScroll();
    // scrub with a little inertia — wind has mass
    P += (target - P) * (1 - Math.exp(-dt * 5.2));
    if (Math.abs(target - P) < 0.0004) P = target;
    const dP = (P - lastP) / Math.max(dt, 0.001);
    lastP = P;
    gustV += (Math.min(3, Math.abs(dP)) - gustV) * (1 - Math.exp(-dt * 3));

    // arrivals & buzzing only while you're still buried
    if (P < 0.02) {
      for (const c of cards)
        if (c.arrived < 0 && el >= c.arriveAt) {
          c.arrived = now;
          const fresh = c.el.classList.contains('og-card--fresh');
          if (fresh || c.phase < 1.4) c.buzz = now + (fresh ? 260 : 120);
          if (fresh) {
            pile.classList.remove('og-shiver');
            void pile.offsetWidth;
            pile.classList.add('og-shiver');
          }
        }
      if (el > nextBuzz) {
        const pool = cards.filter((c) => c.arrived >= 0);
        const c = pool[Math.floor(Math.random() * pool.length)];
        if (c) c.buzz = now;
        nextBuzz = el + 1800 + Math.random() * 2200;
      }
    }

    // photo: grey, blurred, desaturated → clear and alive
    // the gust front sweeps left → right; behind it the world is sharp and in colour
    const front = -0.12 + 1.6 * smooth(0.06, 0.9, P);
    const clear = smooth(0.2, 0.96, P);
    const vis = `${front.toFixed(4)}`;
    if (vis !== lastVisuals) {
      lastVisuals = vis;
      const a = (front - 0.4) * 100;
      const b2 = front * 100;
      const mask = `linear-gradient(102deg, #000 ${a.toFixed(2)}%, rgba(0,0,0,.55) ${((a + b2) / 2).toFixed(2)}%, transparent ${b2.toFixed(2)}%)`;
      clearImg.style.setProperty('mask-image', mask);
      clearImg.style.setProperty('-webkit-mask-image', mask);
      clearImg.style.visibility = front <= 0 ? 'hidden' : '';
      const sc = `scale(${(1.1 - clear * 0.1).toFixed(4)})`;
      img.style.transform = sc;
      clearImg.style.transform = sc;
      veil.style.opacity = String(1 - clear);
      const hc = smooth(0.08, 0.5, front);
      h1.style.opacity = String(0.5 + hc * 0.5);
      h1.style.filter = hc < 1 ? `blur(${((1 - hc) * 1.2).toFixed(2)}px)` : '';
      const late = smooth(0.62, 0.98, P);
      if (topline) topline.style.opacity = String(late);
      if (bottom) {
        bottom.style.opacity = String(late);
        bottom.style.transform = `translateY(${(1 - late) * 14}px)`;
        bottom.style.pointerEvents = late < 0.5 ? 'none' : '';
      }
      status.style.opacity = String(1 - smooth(0.1, 0.45, P));
      hint.style.opacity = String(1 - smooth(0.005, 0.07, P));
      hint.style.pointerEvents = P > 0.05 ? 'none' : '';
    }

    // cards
    const time = el / 1000;
    for (const c of cards) {
      if (c.arrived < 0) continue;
      const w = c.w;
      let x = 0;
      let y = 0;
      let rz = c.rot;
      let rx = 0;
      let ry = 0;
      let s = 1;
      let o = 1;
      // arrival
      const age = now - c.arrived;
      if (c.arriveAt >= 0 && age < 520) {
        const k = easeOutBack(clamp(age / 520));
        if (c.fromTop || narrow) y -= (1 - k) * 46;
        else x += (1 - k) * 70;
        s *= 0.94 + 0.06 * k;
        o = clamp(age / 200);
      }
      // buzz — a phone vibrating on a desk
      const b = now - c.buzz;
      if (c.buzz > 0 && b >= 0 && b < 520) {
        const amp = (1 - b / 520) * 3.2;
        x += Math.sin(b * 0.24) * amp;
        rz += Math.sin(b * 0.24 + 1) * amp * 0.35;
      }
      // the gust
      const pre = clamp((P - (c.start - 0.12)) / 0.12);
      const l = clamp((P - c.start) / c.dur);
      if (pre > 0 && l <= 0) {
        // fluttering, about to lift
        const a = pre * pre;
        rz += Math.sin(time * 19 + c.phase) * 2.4 * a;
        rx += Math.sin(time * 13 + c.phase) * 14 * a;
        y -= 3 * a;
        s *= 1 + 0.015 * a;
      }
      if (l > 0) {
        const e = Math.pow(l, 1.65);
        const peel = Math.min(1, l * 5);
        x += (W * 1.15 + w) * e + Math.sin(l * 9 + c.phase) * 22 * l;
        y +=
          -H * 0.55 * c.rise * e +
          Math.sin(l * Math.PI * c.curl + c.phase) * H * 0.08 * l +
          Math.sin(time * 6 + c.phase) * 9 * l * (1 - l) * 4 +
          c.drift * H * e;
        rz += c.spin * e;
        rx += c.tumble * e + Math.sin(time * 8 + c.phase) * 16 * l;
        ry += -30 * peel + Math.sin(time * 5 + c.phase) * 12 * l;
        s *= 1 + 0.16 * Math.sin(Math.min(1, l * 1.4) * Math.PI);
        o *= 1 - smooth(0.68, 1, l);
      }
      if (o <= 0.001) {
        if (c.el.style.visibility !== 'hidden') c.el.style.visibility = 'hidden';
        continue;
      }
      if (c.el.style.visibility) c.el.style.visibility = '';
      c.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotateZ(${rz.toFixed(2)}deg) rotateY(${ry.toFixed(1)}deg) rotateX(${rx.toFixed(1)}deg) scale(${s.toFixed(3)})`;
      if (c.arriveAt < 0 || age >= 200) c.el.style.opacity = o < 1 ? o.toFixed(3) : '';
      else c.el.style.opacity = o.toFixed(3);
      c.el.classList.toggle('og-lift', l > 0);
    }

    // wind: streaks + fog wisps, stronger while you scroll through the gust
    if (ctx2) {
      const bell = Math.sin(Math.PI * clamp((P - 0.01) / 0.95));
      const I = clamp(Math.pow(Math.max(0, bell), 0.7) * (0.55 + gustV * 0.9)) + (P > 0.97 ? 0.06 : 0);
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2.clearRect(0, 0, W, H);
      if (I > 0.01) {
        const speed = 260 + I * 1500;
        ctx2.globalCompositeOperation = 'lighter';
        for (const f of wisps) {
          f.x += (dt * speed * 0.18 * f.v) / W;
          if (f.x > 1.4) {
            f.x = -0.4;
            f.y = 0.25 + Math.random() * 0.75;
          }
          const r = f.r * Math.max(W, H);
          ctx2.globalAlpha = f.a * Math.min(1, I * 1.4) * 0.8;
          ctx2.drawImage(fog, f.x * W - r, f.y * H - r * 0.45, r * 2, r * 0.9);
        }
        ctx2.globalCompositeOperation = 'source-over';
        ctx2.lineCap = 'round';
        for (const s of streaks) {
          s.x += (dt * speed * s.v) / W;
          if (s.x * W - s.len > W) {
            s.x = -Math.random() * 0.3;
            s.y = Math.random();
          }
          const px = s.x * W;
          const py = s.y * H + Math.sin(time * 1.3 + s.wave + s.x * 5) * 14;
          const len = s.len * (0.6 + I);
          const g = ctx2.createLinearGradient(px - len, 0, px, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(1, `rgba(255,255,255,${(s.a * I * 0.75).toFixed(3)})`);
          ctx2.strokeStyle = g;
          ctx2.lineWidth = s.w;
          ctx2.globalAlpha = 1;
          ctx2.beginPath();
          ctx2.moveTo(px - len, py + Math.sin(s.wave) * 3);
          ctx2.quadraticCurveTo(px - len * 0.5, py - 6 * Math.sin(time + s.wave), px, py);
          ctx2.stroke();
        }
      }
    }
  };

  const run = () => {
    if (!raf && visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) run();
    else stop();
  });
  io.observe(cover);
  const onVis = () => (document.hidden ? stop() : run());
  document.addEventListener('visibilitychange', onVis);
  const onResize = () => layout();
  window.addEventListener('resize', onResize);
  run();
  // fonts / late layout
  const refreshT = window.setTimeout(() => ScrollTrigger.refresh(), 400);

  return () => {
    stop();
    window.clearTimeout(refreshT);
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('resize', onResize);
    cover.removeEventListener('focusin', onFocus);
    st.kill();
    veil.remove();
    clearImg.remove();
    pile.remove();
    wind.remove();
    status.remove();
    hint.remove();
    cover.classList.remove('og-armed');
    saved.forEach((style, el) => {
      if (style) el.setAttribute('style', style);
      else el.removeAttribute('style');
    });
  };
};
export default mount;
