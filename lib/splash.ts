import gsap from 'gsap';
import { BEAT, type SplashSound } from '@/lib/splash-sound';

// Title sequence for the top page, cut like a typographic opening: hairlines draw a frame →
// 未来 / 技術 / 研究所 struck one after another at screen size, the colour cutting between them →
// デジタル広報支援サービス rises out of masks, set left → the works cut past at the speed of
// the counter, each one the real screen → 18 WORKS. The exit lifts a curtain, a vermilion
// strip trailing behind it. Flat colour and hard cuts only: no glow, no blur, no bounce.

const PAPER = '#f3f1ec';
const INK = '#111114';
const RED = '#f2411b';

export function playSplash(root: HTMLElement, names: string[], onTitleDone: () => void, sfx: SplashSound) {
  const qa = (s: string) => [...root.querySelectorAll<HTMLElement>(s)];
  const q = (s: string) => root.querySelector<HTMLElement>(s)!;
  const rules = qa('.sp-rule');
  const corners = qa('.sp-corner span');
  const words = qa('.sp-word');
  const wordIn = words.map((w) => w.firstElementChild as HTMLElement);
  const lines = qa('.sp-line');
  const chars = lines.map((l) => [...l.querySelectorAll<HTMLElement>('span')]);
  const sub = q('.sp-sub');
  const subIn = qa('.sp-sub > span > i');
  const works = q('.sp-works');
  const num = q('.sp-num');
  const name = q('.sp-name');
  const shotBox = q('.sp-shot');
  const shotCol = q('.sp-shotcol');
  const shots = qa('.sp-shot img');
  const cnt = q('.sp-cnt');
  const lead = document.querySelector<HTMLElement>('.sp-lead');

  const theme = (at: number, bg: string, fg: string) => tl.set(root, { '--bg': bg, '--fg': fg }, at);
  const total = names.length;
  let shown = -1;
  const show = (n: number) => {
    const i = Math.min(total, Math.max(1, Math.round(n))) - 1;
    if (i === shown) return;
    if (shown >= 0) {
      shots[shown].style.visibility = 'hidden';
      sfx.tick(i / total);
    }
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
  gsap.set(wordIn, { yPercent: 110, autoAlpha: 1 });
  gsap.set(chars.flat(), { yPercent: 115, autoAlpha: 1 });
  gsap.set(subIn, { yPercent: 115, autoAlpha: 1 });
  gsap.set(sub, { '--u': 0 });

  const tl = gsap.timeline({ onComplete: onTitleDone });

  // The picture is cut on the beat grid of the track (lib/splash-sound.ts, 125 BPM): bar 1
  // is the three words, bar 2 the title, bar 3 the works, bar 4 the last one. beat(1) is the
  // downbeat of bar 1, one beat after the start.
  const beat = (n: number) => n * BEAT;

  // 1. a frame is drawn in hairlines, the four corner labels slide up
  tl.to(rules.slice(0, 2), { scaleX: 1, duration: 0.7, ease: 'expo.out' }, 0.05)
    .to(rules.slice(2), { scaleY: 1, duration: 0.7, ease: 'expo.out' }, 0.05)
    .to(corners, { yPercent: 0, duration: 0.6, ease: 'expo.out', stagger: 0.07 }, 0.2);

  // 2. three words, three colours, one per beat, each cut in from a different side
  tl.to(wordIn[0], { yPercent: 0, duration: 0.42, ease: 'expo.out' }, beat(1))
    .to(wordIn[0], { yPercent: -110, duration: 0.24, ease: 'expo.in' }, beat(2) - 0.03);
  theme(beat(2), RED, INK);
  tl.fromTo(wordIn[1], { yPercent: -110 }, { yPercent: 0, duration: 0.38, ease: 'expo.out', immediateRender: false }, beat(2))
    .to(wordIn[1], { xPercent: -110, duration: 0.24, ease: 'expo.in' }, beat(3) - 0.03);
  theme(beat(3), INK, PAPER);
  tl.fromTo(wordIn[2], { xPercent: 110, yPercent: 0 }, { xPercent: 0, duration: 0.38, ease: 'expo.out', immediateRender: false }, beat(3))
    .to(wordIn[2], { yPercent: 110, duration: 0.24, ease: 'expo.in' }, beat(5) - 0.24);

  // 3. the drop: back to paper, the service name in two lines, each character out of its mask
  theme(beat(5), PAPER, INK);
  chars.forEach((line, li) => {
    tl.to(line, { yPercent: 0, duration: 0.8, ease: 'expo.out', stagger: 0.045 }, beat(5) + li * 0.16);
  });
  // (these finish before the title leaves on beat 8, so entry and exit never overlap)
  tl.to(sub, { '--u': 1, duration: 0.6, ease: 'expo.inOut' }, beat(6) + 0.24)
    .to(subIn, { yPercent: 0, duration: 0.5, ease: 'expo.out', stagger: 0.08 }, beat(6) + 0.36);

  // 4. the title leaves the way it came; the works are cut past, faster and faster
  tl.to(chars.flat(), { yPercent: -115, duration: 0.3, ease: 'expo.in', stagger: { each: 0.01, from: 'start' } }, beat(9) - 0.48)
    .to(subIn, { yPercent: -115, duration: 0.25, ease: 'expo.in' }, beat(9) - 0.48)
    .to(sub, { '--u': 0, duration: 0.3, ease: 'expo.in' }, beat(9) - 0.48);
  theme(beat(9), INK, PAPER);
  tl.set(works, { visibility: 'visible' }, beat(9))
    .add(() => show(1), beat(9))
    .to(shotBox, { clipPath: 'inset(0 0 0% 0)', duration: 0.4, ease: 'expo.out' }, beat(9));
  const counter = { n: 1 };
  tl.to(
    counter,
    { n: total, duration: beat(13) - beat(9) - 0.24, ease: 'power2.in', onUpdate: () => show(counter.n) },
    beat(9) + 0.24,
  );

  // 5. the last one lands on vermilion, on the downbeat of bar 4
  theme(beat(13), RED, INK);
  tl.add(() => {
    name.textContent = `WORKS — ブラウザで動く制作サンプル`;
  }, beat(13));
  tl.to({}, { duration: 0.75 }, beat(13)); // a beat to read it

  // sound, on the same clock (silent until the visitor turns it on)
  const cue = (at: number, fn: () => void) => tl.add(fn, at);
  cue(0.02, () => sfx.music()); // bar 1 lands one beat later
  cue(0.05, () => sfx.draw());
  [1, 1.189, 0.891].forEach((ratio, i) => cue(beat(i + 1) + 0.03, () => sfx.slam(ratio))); // D, F, C
  [beat(2) - 0.03, beat(3) - 0.03, beat(5) - 0.24].forEach((at) => cue(at, () => sfx.whoosh('up', 0.24, 0.3)));
  chars.forEach((line, li) =>
    line.forEach((_, i) => cue(beat(5) + li * 0.16 + i * 0.045 + 0.06, () => sfx.pluck(i + li * 3))),
  );
  cue(beat(6) + 0.24, () => sfx.whoosh('up', 0.5, 0.2));
  cue(beat(6) + 0.36, () => sfx.pluck(9));
  cue(beat(6) + 0.44, () => sfx.pluck(12));
  cue(beat(9) - 0.48, () => sfx.whoosh('down', 0.4, 0.28));
  cue(beat(9), () => sfx.slam(0.667)); // G
  cue(beat(13), () => sfx.finale());

  return {
    exit(onGone: () => void) {
      tl.kill();
      gsap.killTweensOf([root, lead, num, shotCol, shotBox]);
      const out = gsap.timeline({ onComplete: onGone });
      sfx.whoosh('down', 0.35, 0.3);
      sfx.musicStop(1.1);
      out.add(() => sfx.lift(), 0.3);
      if (lead) gsap.set(lead, { visibility: 'visible', clipPath: 'inset(0 0 0% 0)' });
      // the type drops away, then the curtain lifts, the vermilion strip a beat behind it
      out
        .to([num, shotCol, ...corners], { yPercent: 110, duration: 0.35, ease: 'expo.in', stagger: 0.02 }, 0)
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
