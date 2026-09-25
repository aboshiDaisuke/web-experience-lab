import gsap from 'gsap';

// Kinetic-type opening for the top page, cut like a motion-graphics title:
// shock ring → three words slammed in → service name bounces in and dances →
// WEBSITE PORTFOLIO flips up behind a wipe → works counter → 18 WORKS punch.
// The exit scatters the type and opens an iris onto the page.

export type SplashEls = {
  root: HTMLElement;
  stage: HTMLElement;
  ring: HTMLElement;
  rays: HTMLElement[];
  bigs: HTMLElement[];
  org: HTMLElement[];
  service: HTMLElement[];
  bar: HTMLElement;
  kind: HTMLElement[];
  num: HTMLElement;
  name: HTMLElement;
  count: HTMLElement;
  dots: HTMLElement[];
  flash: HTMLElement;
};

const rand = gsap.utils.random;

export function playSplash(el: SplashEls, names: string[], onTitleDone: () => void) {
  const shake = (at: number, power = 10) =>
    tl.fromTo(
      el.stage,
      { x: 0, y: 0 },
      {
        keyframes: [
          { x: -power, y: power * 0.4, duration: 0.04 },
          { x: power * 0.8, y: -power * 0.5, duration: 0.04 },
          { x: -power * 0.5, y: power * 0.3, duration: 0.04 },
          { x: power * 0.25, y: 0, duration: 0.04 },
          { x: 0, y: 0, duration: 0.05 },
        ],
        immediateRender: false,
      },
      at,
    );
  const flash = (at: number, peak = 0.55) =>
    tl.fromTo(el.flash, { opacity: peak }, { opacity: 0, duration: 0.35, ease: 'power2.out', immediateRender: false }, at);

  gsap.set([el.ring, ...el.rays, ...el.bigs, ...el.org, ...el.service, el.bar, ...el.kind, el.count, ...el.dots], {
    autoAlpha: 0,
  });
  const tl = gsap.timeline({ onComplete: onTitleDone });

  // 1. shock ring and rays
  tl.fromTo(el.ring, { autoAlpha: 1, scale: 0 }, { scale: 2.4, autoAlpha: 0, duration: 0.8, ease: 'expo.out' }, 0.05);
  el.rays.forEach((r, i) => {
    tl.fromTo(
      r,
      { autoAlpha: 1, scaleX: 0, x: 0, rotation: (360 / el.rays.length) * i },
      { scaleX: 1, duration: 0.25, ease: 'expo.out' },
      0.08,
    ).to(r, { x: 520, autoAlpha: 0, duration: 0.45, ease: 'power3.in' }, 0.28);
  });
  flash(0.05, 0.35);

  // 2. 未来 / 技術 / 研究所 slammed in one after another, each with a hit
  el.bigs.forEach((w, i) => {
    const at = 0.35 + i * 0.36;
    tl.fromTo(
      w,
      { autoAlpha: 0, scale: 3.4, rotation: i % 2 ? 14 : -14, filter: 'blur(18px)' },
      { autoAlpha: 1, scale: 1, rotation: i % 2 ? -3 : 3, filter: 'blur(0px)', duration: 0.22, ease: 'power4.in' },
      at,
    ).to(w, { scale: 0.25, y: -150, autoAlpha: 0, duration: 0.18, ease: 'power3.in' }, at + 0.3);
    shake(at + 0.22, 12);
    flash(at + 0.2, 0.18);
  });

  // the three words land as the lab's name
  tl.fromTo(
    el.org,
    { autoAlpha: 0, y: -60, scale: 1.6, rotation: () => rand(-30, 30) },
    { autoAlpha: 1, y: 0, scale: 1, rotation: 0, duration: 0.7, ease: 'bounce.out', stagger: 0.035 },
    1.4,
  );

  // 3. デジタル広報支援サービス: every character leaps in and lands on a spring
  tl.fromTo(
    el.service,
    { autoAlpha: 0, yPercent: 160, scale: 0.2, rotation: () => rand(-60, 60) },
    {
      autoAlpha: 1,
      yPercent: 0,
      scale: 1,
      rotation: 0,
      duration: 1.1,
      ease: 'elastic.out(1.1, 0.42)',
      stagger: { each: 0.045, from: 'center' },
    },
    1.75,
  );
  shake(2.05, 14);
  flash(2.05, 0.3);
  // a burst of RGB split and skew, like a glitch pass
  tl.to(
    el.service,
    {
      keyframes: [
        { textShadow: '5px 0 #ff2d78, -5px 0 #19e3ff', skewX: -14, x: () => rand(-10, 10), duration: 0.05 },
        { textShadow: '-4px 0 #ff2d78, 4px 0 #19e3ff', skewX: 10, x: () => rand(-8, 8), duration: 0.05 },
        { textShadow: '2px 0 #ff2d78, -2px 0 #19e3ff', skewX: -4, x: 0, duration: 0.05 },
        { textShadow: '0px 0 rgba(0,0,0,0)', skewX: 0, x: 0, duration: 0.06 },
      ],
    },
    2.75,
  );
  // then the name dances: a travelling wave of hops with a little squash
  tl.to(
    el.service,
    {
      keyframes: [
        { yPercent: -30, scaleY: 1.12, scaleX: 0.92, rotation: () => rand(-8, 8), duration: 0.16, ease: 'power2.out' },
        { yPercent: 0, scaleY: 0.86, scaleX: 1.1, rotation: 0, duration: 0.14, ease: 'power2.in' },
        { scaleY: 1, scaleX: 1, duration: 0.12, ease: 'back.out(3)' },
      ],
      stagger: { each: 0.045, repeat: 1, repeatDelay: 0.05 },
    },
    3.0,
  );

  // 4. WEBSITE PORTFOLIO flips up behind a colour wipe
  tl.fromTo(el.bar, { autoAlpha: 1, scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.3, ease: 'expo.inOut' }, 3.1)
    .set(el.bar, { transformOrigin: '100% 50%' }, 3.4)
    .to(el.bar, { scaleX: 0, duration: 0.3, ease: 'expo.inOut' }, 3.42)
    .fromTo(
      el.kind,
      { autoAlpha: 0, rotationX: -100, yPercent: 60, transformOrigin: '50% 100%' },
      { autoAlpha: 1, rotationX: 0, yPercent: 0, duration: 0.6, ease: 'back.out(2.6)', stagger: 0.028 },
      3.36,
    );

  // 5. works counter, 01 → 18, then a punch
  const counter = { n: 1 };
  tl.set(el.count, { autoAlpha: 1 }, 3.9).to(
    counter,
    {
      n: names.length,
      duration: 1.3,
      ease: 'power1.in',
      onUpdate() {
        const i = Math.max(1, Math.round(counter.n));
        el.num.textContent = String(i).padStart(2, '0');
        el.name.textContent = names[i - 1];
      },
    },
    3.9,
  );
  tl.add(() => {
    el.num.textContent = String(names.length);
    el.name.textContent = 'WORKS — ブラウザで動く制作サンプル';
  }, 5.22)
    .fromTo(el.count, { scale: 1.9 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.35)', immediateRender: false }, 5.22)
    .fromTo(
      el.dots,
      { autoAlpha: 1, x: 0, y: 0, scale: 1 },
      {
        x: () => rand(-420, 420),
        y: () => rand(-260, 260),
        scale: 0,
        autoAlpha: 0,
        duration: 0.9,
        ease: 'expo.out',
        immediateRender: false,
      },
      5.22,
    )
    .fromTo(
      el.ring,
      { autoAlpha: 0.9, scale: 0 },
      { scale: 2, autoAlpha: 0, duration: 0.7, ease: 'expo.out', immediateRender: false },
      5.22,
    );
  shake(5.22, 9);
  flash(5.22, 0.22);
  tl.to({}, { duration: 0.5 }); // a beat to read the finished card

  return {
    exit(onGone: () => void) {
      tl.kill();
      gsap.killTweensOf([el.stage, ...el.service]);
      const max = Math.hypot(innerWidth, innerHeight);
      const out = gsap.timeline({ onComplete: onGone });
      out
        .to([...el.org, ...el.service, ...el.kind, el.count], {
          x: () => rand(-600, 600),
          y: () => rand(-400, 400),
          rotation: () => rand(-200, 200),
          scale: () => rand(0.2, 1.8),
          autoAlpha: 0,
          duration: 0.6,
          ease: 'power3.in',
          stagger: { each: 0.008, from: 'center' },
        })
        .fromTo(el.flash, { opacity: 0 }, { opacity: 0.5, duration: 0.12 }, 0.45)
        .to(el.flash, { opacity: 0, duration: 0.3 }, 0.6)
        .fromTo(el.root, { '--r': '0px' }, { '--r': `${max}px`, duration: 0.95, ease: 'expo.inOut' }, 0.5);
    },
    kill() {
      tl.kill();
    },
  };
}
