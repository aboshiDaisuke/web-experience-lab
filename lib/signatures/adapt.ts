import type { Signature } from './types';

/*
 * ADAPT / YOU — "the page is repainted from your click".
 * Choosing a style floods the new theme outward from the exact point you
 * pressed: a View Transition whose new snapshot is revealed through a living,
 * ink-like edge (clip-path polygon keyed frame by frame). As the flood reaches
 * the headline, it re-types itself in the new voice. Browsers without View
 * Transitions get an ink overlay in the new paper colour instead.
 */

// the paper colour of each style (mirrors .style-0 … .style-4 in globals.css)
const PAPER = ['#edf1f8', '#25241f', '#e4edcf', '#0e252d', '#ef805a'];
const POOL = [
  '',
  '',
  'あかさたなはまやらわをんゆめ',
  '01アイウエオカキクケコ▮▯◇◆',
  '',
];

type Voice = {
  order: 'ltr' | 'random';
  step: number; // ms between characters
  scramble: boolean;
  settle: number; // ms for the last character's CSS to finish
};
const VOICES: Voice[] = [
  { order: 'ltr', step: 34, scramble: false, settle: 120 }, // 信頼感: precise typewriter
  { order: 'ltr', step: 62, scramble: false, settle: 700 }, // 高級感: slow, exhaling
  { order: 'random', step: 26, scramble: true, settle: 260 }, // 独創的: out of order
  { order: 'ltr', step: 30, scramble: true, settle: 120 }, // 未来的: decoded
  { order: 'ltr', step: 40, scramble: false, settle: 520 }, // 遊び心: bouncing in
];

const ease = (t: number) => 1 - (1 - t) ** 2.6;

/** a wobbly, ink-like closed outline around (x, y) — star-shaped, never self-intersecting */
function makeInk(x: number, y: number) {
  // a few smooth lobes plus one finer ripple: reads as liquid, not torn paper
  const waves = Array.from({ length: 5 }, (_, k) => ({
    f: [2, 3, 5, 8, 13][k] + (k && Math.random() < 0.5 ? 1 : 0),
    p: Math.random() * Math.PI * 2,
    w: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 2.5),
    a: [0.8, 1, 0.5, 0.22, 0.08][k],
  }));
  const N = 150;
  return (r: number, t: number) => {
    const amp = Math.min(r * 0.24, 72) * (1 - t ** 3 * 0.5);
    const pts: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2;
      let w = 0;
      for (const s of waves) w += s.a * Math.sin(s.f * th + s.p + s.w * t);
      const rr = Math.max(0, r + (w / 2.6) * amp);
      pts.push([x + Math.cos(th) * rr, y + Math.sin(th) * rr]);
    }
    return pts;
  };
}

const polygon = (pts: [number, number][]) =>
  `polygon(${pts.map(([a, b]) => `${a.toFixed(1)}px ${b.toFixed(1)}px`).join(',')})`;

const mount: Signature = (ctx) => {
  const { root, cover, reduced } = ctx;
  const selector = cover.querySelector<HTMLElement>('.adapt-selector');
  const h1 = cover.querySelector<HTMLElement>('.adapt-copy h1');
  if (!selector || !h1) return;
  const html = document.documentElement;
  const vtSupported = typeof document.startViewTransition === 'function';

  let replaying = false;
  let alive = true;
  let vt: ViewTransition | null = null;
  let overlay: HTMLCanvasElement | null = null;
  let overlayRaf = 0;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  /* ---------- the headline re-types itself ---------- */
  type Line = { node: Text; target: string; host: HTMLSpanElement };
  let typing: { finish: () => void } | null = null;

  const prepareType = (style: number) => {
    typing?.finish();
    const voice = VOICES[style] || VOICES[0];
    const pool = POOL[style] || '';
    const lines: Line[] = [];
    const chars: { el: HTMLSpanElement; ch: string; order: number }[] = [];
    for (const span of Array.from(h1.children)) {
      if (!(span instanceof HTMLSpanElement)) continue;
      const node = span.firstChild;
      if (!(node instanceof Text) || !node.nodeValue) continue;
      const target = node.nodeValue;
      const host = document.createElement('span');
      host.className = 'ad-type';
      host.setAttribute('aria-hidden', 'true');
      for (const ch of Array.from(target)) {
        const el = document.createElement('span');
        el.className = 'ad-ch';
        el.textContent = voice.scramble
          ? pool[Math.floor(Math.random() * pool.length)]
          : ch;
        if (voice.scramble) el.classList.add('is-scramble');
        chars.push({ el, ch, order: chars.length });
        host.appendChild(el);
      }
      node.nodeValue = '';
      span.insertBefore(host, node.nextSibling);
      lines.push({ node, target, host });
    }
    if (!lines.length) return null;
    h1.setAttribute('aria-label', lines.map((l) => l.target).join(''));
    h1.classList.add('ad-typing');
    if (voice.order === 'random') {
      const idx = chars.map((_, i) => i).sort(() => Math.random() - 0.5);
      idx.forEach((ci, k) => (chars[ci].order = k));
    }
    let raf = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      for (const l of lines) {
        l.host.remove();
        l.node.nodeValue = l.target;
      }
      h1.removeAttribute('aria-label');
      h1.classList.remove('ad-typing');
      if (typing === handle) typing = null;
    };
    const start = (delay: number) => {
      const t0 = performance.now() + delay;
      let lastScramble = 0;
      const end = t0 + chars.length * voice.step + voice.settle;
      const tick = (now: number) => {
        if (done) return;
        const n = Math.floor((now - t0) / voice.step);
        const caretAt = n;
        for (const c of chars) {
          if (c.order <= n && !c.el.classList.contains('is-on')) {
            c.el.textContent = c.ch;
            c.el.classList.remove('is-scramble');
            c.el.classList.add('is-on');
          }
          c.el.classList.toggle(
            'is-caret',
            voice.order === 'ltr' && c.order === caretAt,
          );
        }
        if (voice.scramble && now - lastScramble > 55) {
          lastScramble = now;
          for (const c of chars)
            if (!c.el.classList.contains('is-on'))
              c.el.textContent = pool[Math.floor(Math.random() * pool.length)];
        }
        if (now >= end) finish();
        else raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const handle = { finish, start };
    typing = handle;
    return handle;
  };

  /* ---------- geometry of the flood ---------- */
  const farthest = (x: number, y: number) =>
    Math.max(
      Math.hypot(x, y),
      Math.hypot(innerWidth - x, y),
      Math.hypot(x, innerHeight - y),
      Math.hypot(innerWidth - x, innerHeight - y),
    );
  const reachDelay = (x: number, y: number, R: number, duration: number) => {
    const r = h1.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return 0;
    const px = Math.max(r.left, Math.min(x, r.right));
    const py = Math.max(r.top, Math.min(y, r.bottom));
    const d = Math.min(1, Math.hypot(px - x, py - y) / R);
    return Math.max(0, (1 - (1 - d) ** (1 / 2.6)) * duration - 60);
  };

  /* ---------- commit the React state through the button's own onClick ---------- */
  const commit = (btn: HTMLElement, index: number) =>
    new Promise<void>((resolve) => {
      html.classList.add('adapt-vt');
      replaying = true;
      try {
        btn.click();
      } finally {
        replaying = false;
      }
      const t0 = performance.now();
      const check = () => {
        if (
          !alive ||
          root.classList.contains(`style-${index}`) ||
          performance.now() - t0 > 600
        )
          resolve();
        else window.setTimeout(check, 8);
      };
      check();
    });

  const cleanupClasses = () =>
    html.classList.remove('adapt-vt', 'adapt-vt-reduced');

  const flood = async (btn: HTMLElement, index: number, x: number, y: number) => {
    vt?.skipTransition();
    typing?.finish();
    stopOverlay();
    const duration = innerWidth < 761 ? 950 : 1150;
    const R = farthest(x, y) + 80;

    if (reduced) {
      if (!vtSupported) {
        await commit(btn, index);
        cleanupClasses();
        return;
      }
      html.classList.add('adapt-vt-reduced');
      const t = document.startViewTransition(() => commit(btn, index));
      vt = t;
      t.ready.catch(() => {});
      void t.finished.catch(() => {}).finally(() => {
        if (vt === t) {
          vt = null;
          cleanupClasses();
        }
      });
      return;
    }

    if (!vtSupported) return fallback(btn, index, x, y, R, duration);

    let type: ReturnType<typeof prepareType> = null;
    const t = document.startViewTransition(async () => {
      await commit(btn, index);
      if (alive) type = prepareType(index);
    });
    vt = t;
    t.ready
      .then(() => {
        if (!alive) return;
        const ink = makeInk(x, y);
        const frames: Keyframe[] = [];
        const F = 36;
        for (let i = 0; i <= F; i++) {
          const k = i / F;
          frames.push({
            clipPath: polygon(ink(R * ease(k), k)),
            offset: k,
          });
        }
        html.animate(frames, {
          duration,
          easing: 'linear',
          fill: 'both',
          pseudoElement: '::view-transition-new(root)',
        });
        html.animate(
          [
            { filter: 'brightness(1) saturate(1)' },
            { filter: 'brightness(0.84) saturate(0.8)' },
          ],
          {
            duration,
            easing: 'cubic-bezier(.3,0,.2,1)',
            fill: 'both',
            pseudoElement: '::view-transition-old(root)',
          },
        );
        type?.start(reachDelay(x, y, R, duration));
      })
      .catch(() => type?.finish());
    void t.finished.catch(() => {}).finally(() => {
      if (vt === t) {
        vt = null;
        cleanupClasses();
      }
    });
  };

  /* ---------- fallback: ink in the new paper colour, then reveal ---------- */
  function stopOverlay() {
    cancelAnimationFrame(overlayRaf);
    overlayRaf = 0;
    overlay?.remove();
    overlay = null;
  }
  const fallback = (
    btn: HTMLElement,
    index: number,
    x: number,
    y: number,
    R: number,
    duration: number,
  ) => {
    const c = document.createElement('canvas');
    c.className = 'ad-ink';
    c.setAttribute('aria-hidden', 'true');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    document.body.appendChild(c);
    overlay = c;
    const g = c.getContext('2d');
    const ink = makeInk(x, y);
    const t0 = performance.now();
    let committed = false;
    const frame = (now: number) => {
      if (overlay !== c) return;
      const k = Math.min(1, (now - t0) / (duration * 0.8));
      if (g) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, innerWidth, innerHeight);
        g.fillStyle = PAPER[index] || '#fff';
        g.beginPath();
        ink(R * ease(k), k).forEach(([a, b], i) =>
          i ? g.lineTo(a, b) : g.moveTo(a, b),
        );
        g.closePath();
        g.fill();
      }
      if (k < 1) {
        overlayRaf = requestAnimationFrame(frame);
        return;
      }
      if (committed) return;
      committed = true;
      void commit(btn, index).then(() => {
        const type = prepareType(index);
        type?.start(80);
        c.style.opacity = '0';
        later(() => {
          if (overlay === c) stopOverlay();
          cleanupClasses();
        }, 420);
      });
    };
    overlayRaf = requestAnimationFrame(frame);
  };

  /* ---------- intercept the style buttons (capture phase) ---------- */
  const onClick = (e: MouseEvent) => {
    if (replaying || !(e.target instanceof Element)) return;
    const btn = e.target.closest<HTMLElement>('.adapt-selector > button');
    if (!btn || !selector.contains(btn)) return;
    if (btn.getAttribute('aria-pressed') === 'true') return;
    const index = Array.from(selector.children).indexOf(btn);
    if (index < 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    let x = e.clientX;
    let y = e.clientY;
    if (e.detail === 0 || (x === 0 && y === 0)) {
      // keyboard activation: flood from the button itself
      const r = btn.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    void flood(btn, index, x, y);
  };
  window.addEventListener('click', onClick, true);

  return () => {
    alive = false;
    window.removeEventListener('click', onClick, true);
    vt?.skipTransition();
    vt = null;
    typing?.finish();
    stopOverlay();
    timers.forEach((id) => window.clearTimeout(id));
    cleanupClasses();
  };
};

export default mount;
