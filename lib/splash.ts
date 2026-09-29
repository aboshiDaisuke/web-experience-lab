import gsap from 'gsap';
import { BEAT, type SplashSound } from '@/lib/splash-sound';

// Title sequence for the top page, cut on the beat of its track (lib/splash-sound.ts, 128 BPM).
// Flat paper, ink and vermilion; hard cuts; type in masks. No glow, no blur, no bounce.
//
//   beat 0      a hairline crosses the screen, the frame is drawn
//   beats 1-3   未来 slides in as six slices, 技術 drops on vermilion, 研究所 runs in on ink
//   beat 4      the name stuttered in 16ths (across, down, small), then a 16th of empty paper
//   bar 2       the drop: デジタル広報 / 支援サービス rise a 32nd apart
//   beat 8      the camera flies into the ー of サービス until it fills the screen with ink
//   8.5 - 12.75 the eighteen works cut past in 16ths, the real screens
//   bar 4       18 on vermilion, all eighteen at once
// The exit lifts a curtain, a vermilion strip trailing behind it.

const PAPER = '#f3f1ec';
const INK = '#111114';
const RED = '#f2411b';

export function playSplash(root: HTMLElement, names: string[], onTitleDone: () => void, sfx: SplashSound) {
  const qa = (s: string) => [...root.querySelectorAll<HTMLElement>(s)];
  const q = (s: string) => root.querySelector<HTMLElement>(s)!;
  const rules = qa('.sp-rule');
  const cross = q('.sp-cross');
  const corners = qa('.sp-corner span');
  const cnt = q('.sp-cnt');
  const slices = qa('.sp-slice');
  const drops = qa('.sp-drop span');
  const row = q('.sp-row');
  const frames = qa('.sp-frame');
  const title = q('.sp-title');
  const lines = qa('.sp-line');
  const chars = lines.flatMap((l) => [...l.querySelectorAll<HTMLElement>('span')]);
  const bar = q('.sp-line .bar');
  const sub = q('.sp-sub');
  const subIn = qa('.sp-sub > span > i');
  const works = q('.sp-works');
  const num = q('.sp-num');
  const name = q('.sp-name');
  const shotBox = q('.sp-shot');
  const shotCol = q('.sp-shotcol');
  const shots = qa('.sp-shot img');
  const meter = q('.sp-meter i');
  const final = q('.sp-final');
  const big = q('.sp-n b');
  const tiles = qa('.sp-mosaic img');
  const cap = q('.sp-cap span');
  const lead = document.querySelector<HTMLElement>('.sp-lead');

  const beat = (n: number) => n * BEAT;
  const total = names.length;
  const W = innerWidth;
  // how far to scale the ー so that it covers the screen
  const fs = parseFloat(getComputedStyle(lines[1]).fontSize) || 100;
  const zoom = Math.max(innerHeight / (fs * 0.1), innerWidth / (fs * 0.7)) * 1.4;

  // the stroke of ー sits a little below the middle of its box
  const INK_Y = 0.56;
  const centre = (e: HTMLElement) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * INK_Y };
  };

  let shown = -1;
  const show = (i: number) => {
    if (shown >= 0) shots[shown].style.visibility = 'hidden';
    shots[i].style.visibility = 'visible';
    shown = i;
    const label = String(i + 1).padStart(2, '0');
    num.textContent = label;
    cnt.textContent = label;
    name.textContent = names[i];
  };

  gsap.set(root, { '--bg': PAPER, '--fg': INK });
  gsap.set(rules.slice(0, 2), { scaleX: 0 });
  gsap.set(rules.slice(2), { scaleY: 0 });
  gsap.set(corners, { yPercent: 110, autoAlpha: 1 });
  gsap.set(slices, { autoAlpha: 1, x: (i: number) => (i % 2 ? -1 : 1) * W * 1.1 });
  gsap.set(drops, { autoAlpha: 1, yPercent: -120 });
  gsap.set(row, { xPercent: 60 });
  gsap.set(chars, { yPercent: 115, autoAlpha: 1 });
  gsap.set(subIn, { yPercent: 115, autoAlpha: 1 });
  gsap.set(sub, { '--u': 0 });
  gsap.set(bar, { transformOrigin: `50% ${INK_Y * 100}%` });
  gsap.set([big, cap], { yPercent: 110, autoAlpha: 1 });

  const tl = gsap.timeline({ onComplete: onTitleDone });
  const theme = (at: number, bg: string, fg: string) => tl.set(root, { '--bg': bg, '--fg': fg }, at);

  // the track starts with the picture (silent until the visitor turns sound on)
  tl.add(() => sfx.music(), 0);

  // beat 0: a hairline crosses the screen, the frame is drawn, the corner labels rise
  tl.to(cross, { scaleX: 1, duration: 0.42, ease: 'expo.out' }, 0.02)
    .to(rules.slice(0, 2), { scaleX: 1, duration: 0.8, ease: 'expo.out' }, 0.08)
    .to(rules.slice(2), { scaleY: 1, duration: 0.8, ease: 'expo.out' }, 0.08)
    .to(corners, { yPercent: 0, duration: 0.5, ease: 'expo.out', stagger: 0.05 }, 0.14)
    .set(cross, { transformOrigin: '100% 50%' }, beat(1) - 0.12)
    .to(cross, { scaleX: 0, duration: 0.12, ease: 'expo.in' }, beat(1) - 0.12);

  // beat 1: 未来, six slices sliding in from alternate sides and locking together
  tl.to(slices, { x: 0, duration: 0.36, ease: 'expo.out', stagger: 0.016 }, beat(1)).to(
    slices,
    { x: (i: number) => (i % 2 ? 1 : -1) * W * 1.1, duration: 0.13, ease: 'expo.in', stagger: 0.008 },
    beat(2) - 0.14,
  );

  // beat 2: vermilion, 技術 dropped in from above
  theme(beat(2), RED, INK);
  tl.to(drops, { yPercent: 0, duration: 0.3, ease: 'expo.out', stagger: 0.06 }, beat(2)).to(
    drops,
    { yPercent: 120, duration: 0.12, ease: 'expo.in', stagger: 0.03 },
    beat(3) - 0.14,
  );

  // beat 3: ink, 研究所 runs in as a row and brakes hard
  theme(beat(3), INK, PAPER);
  tl.set(row, { autoAlpha: 1 }, beat(3))
    .to(row, { xPercent: 0, duration: 0.42, ease: 'expo.out' }, beat(3))
    .set(row, { autoAlpha: 0 }, beat(4));

  // beat 4: the name in 16ths, across, down, small; then a 16th of empty paper before the drop
  frames.forEach((f, i) => {
    const at = beat(4 + i * 0.25);
    tl.set(f, { autoAlpha: 1 }, at)
      .fromTo(f.firstElementChild, { scale: 1.08 }, { scale: 1, duration: 0.2, ease: 'expo.out', immediateRender: false }, at)
      .set(f, { autoAlpha: 0 }, at + BEAT / 4);
  });
  theme(beat(4.75), PAPER, INK);

  // bar 2, the drop: the service name, a 32nd apart per character, out of its line's mask
  chars.forEach((c, i) => tl.to(c, { yPercent: 0, duration: 0.5, ease: 'expo.out' }, beat(5) + i * (BEAT / 8)));
  tl.to(sub, { '--u': 1, duration: 0.4, ease: 'expo.inOut' }, beat(6.5))
    .to(subIn, { yPercent: 0, duration: 0.4, ease: 'expo.out', stagger: BEAT / 8 }, beat(6.75))
    .to(lines[0], { xPercent: -2.5, duration: beat(1.5), ease: 'none' }, beat(6.5))
    .to(lines[1], { xPercent: 2.5, duration: beat(1.5), ease: 'none' }, beat(6.5));

  // beat 8: everything else drops away and the camera flies into the ー until it is all ink
  const rest = chars.filter((c) => c !== bar);
  tl.to(rest, { yPercent: 115, duration: 0.1, ease: 'expo.in', stagger: 0.004 }, beat(8))
    .to(subIn, { yPercent: -115, duration: 0.1, ease: 'expo.in' }, beat(8))
    .to(sub, { '--u': 0, duration: 0.12, ease: 'expo.in' }, beat(8))
    .set(rest, { autoAlpha: 0 }, beat(8) + 0.11)
    .set(lines, { overflow: 'visible' }, beat(8) + 0.11)
    .to(
      bar,
      {
        scale: zoom,
        // and pull it to the middle of the screen as it grows, so the ink closes in from all sides
        x: () => innerWidth / 2 - centre(bar).x,
        y: () => innerHeight / 2 - centre(bar).y,
        duration: beat(0.5) - 0.02,
        ease: 'expo.in',
      },
      beat(8) + 0.02,
    );

  // 8.5 - 12.75: the works, one per 16th
  theme(beat(8.5), INK, PAPER);
  tl.set(title, { autoAlpha: 0 }, beat(8.5)).set(works, { autoAlpha: 1 }, beat(8.5));
  for (let k = 0; k < total; k++) {
    const at = beat(8.5 + k * 0.25);
    tl.add(() => show(k), at)
      .fromTo(shotBox, { scale: 1.04 }, { scale: 1, duration: 0.2, ease: 'expo.out', immediateRender: false }, at)
      .set(meter, { scaleX: (k + 1) / total }, at);
  }

  // bar 4: 18 on vermilion, all eighteen at once
  theme(beat(13), RED, INK);
  tl.set(works, { autoAlpha: 0 }, beat(13))
    .set(final, { autoAlpha: 1 }, beat(13))
    .add(() => {
      cnt.textContent = String(total);
    }, beat(13))
    .to(big, { yPercent: 0, duration: 0.5, ease: 'expo.out' }, beat(13))
    .to(
      tiles,
      { clipPath: 'inset(0 0 0% 0)', duration: 0.35, ease: 'expo.out', stagger: { amount: beat(0.75), grid: [3, 6], from: 'center' } },
      beat(13),
    )
    .to(cap, { yPercent: 0, duration: 0.5, ease: 'expo.out' }, beat(13.75))
    .to({}, { duration: 0.01 }, beat(15)); // hold two beats to read it

  return {
    exit(onGone: () => void) {
      tl.kill();
      gsap.killTweensOf([root, lead, big, cap, shotBox, shotCol, num, ...tiles, ...corners]);
      const out = gsap.timeline({ onComplete: onGone });
      sfx.musicStop(1.1);
      out.add(() => sfx.lift(), 0.3);
      if (lead) gsap.set(lead, { visibility: 'visible', clipPath: 'inset(0 0 0% 0)' });
      // the type drops away, then the curtain lifts, the vermilion strip a beat behind it
      out
        .to(tiles, { clipPath: 'inset(100% 0 0 0)', duration: 0.3, ease: 'expo.in', stagger: { amount: 0.12, from: 'end' } }, 0)
        .to([big, cap, num, shotCol, ...corners], { yPercent: 110, duration: 0.35, ease: 'expo.in', stagger: 0.02 }, 0)
        .to(root, { clipPath: 'inset(0 0 100% 0)', duration: 0.85, ease: 'expo.inOut' }, 0.3);
      if (lead) out.to(lead, { clipPath: 'inset(0 0 100% 0)', duration: 0.85, ease: 'expo.inOut' }, 0.42);
    },
    // replay from the top (used when the visitor turns sound on part-way through)
    restart() {
      if (shown >= 0) {
        shots[shown].style.visibility = 'hidden';
        shown = -1;
      }
      tl.restart();
    },
    kill() {
      tl.kill();
      if (lead) gsap.set(lead, { visibility: 'hidden' });
    },
  };
}
