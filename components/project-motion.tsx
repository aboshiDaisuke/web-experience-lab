'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

type Reveal =
  | 'wipe-x'
  | 'wipe-y'
  | 'iris'
  | 'door'
  | 'soft'
  | 'dark'
  | 'rise'
  | 'pop'
  | 'skew';
type Personality = {
  ease: string;
  dur: number;
  y: number;
  reveal: Reveal;
  curtain: 'up' | 'side' | 'iris' | 'fade' | 'split';
  hero: string;
};

const personalities: Record<string, Personality> = {
  nova: { ease: 'expo.inOut', dur: 1.2, y: 24, reveal: 'wipe-x', curtain: 'side', hero: '.nova-cover-photo' },
  lumina: { ease: 'sine.out', dur: 1.6, y: 30, reveal: 'soft', curtain: 'fade', hero: '.lumina-photo' },
  noir: { ease: 'power2.out', dur: 1.9, y: 18, reveal: 'dark', curtain: 'fade', hero: '.noir-photo' },
  eclat: { ease: 'power4.inOut', dur: 1.3, y: 20, reveal: 'wipe-y', curtain: 'up', hero: '.eclat-product' },
  aether: { ease: 'power3.out', dur: 1.3, y: 40, reveal: 'rise', curtain: 'iris', hero: '.aether-object' },
  casa: { ease: 'power3.inOut', dur: 1.5, y: 24, reveal: 'door', curtain: 'split', hero: '.casa-visual' },
  room: { ease: 'back.out(1.7)', dur: 0.9, y: 40, reveal: 'pop', curtain: 'up', hero: '.room-explore' },
  yui: { ease: 'power4.inOut', dur: 1.4, y: 20, reveal: 'iris', curtain: 'iris', hero: '.yui-main-photo,.yui-small-photo' },
  adapt: { ease: 'power3.out', dur: 1, y: 60, reveal: 'skew', curtain: 'side', hero: '.adapt-object' },
  offgrid: { ease: 'power4.out', dur: 1.1, y: 90, reveal: 'rise', curtain: 'up', hero: '.offgrid-cover > img' },
};

const token = /[A-Za-z0-9À-ÿ'’.,!?&/-]+|\s+|[\s\S]/g;

function splitText(el: HTMLElement) {
  if (el.dataset.split) return;
  el.dataset.split = '1';
  const walk = (node: Node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? '';
        if (!text.trim()) return;
        const frag = document.createDocumentFragment();
        for (const part of text.match(token) ?? []) {
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
            continue;
          }
          const outer = document.createElement('span');
          outer.className = 'm-ch';
          const inner = document.createElement('span');
          inner.className = 'm-ch-in';
          inner.textContent = part;
          outer.appendChild(inner);
          frag.appendChild(outer);
        }
        child.replaceWith(frag);
      } else if (child instanceof HTMLElement && child.tagName !== 'BR') walk(child);
    });
  };
  const label = el.textContent?.replace(/\s+/g, ' ').trim();
  if (label && !el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
  walk(el);
  el.querySelectorAll('.m-ch').forEach((c) => c.setAttribute('aria-hidden', 'true'));
}

function revealFrom(style: Reveal, y: number): gsap.TweenVars {
  switch (style) {
    case 'wipe-x':
      return { clipPath: 'inset(0% 100% 0% 0%)' };
    case 'wipe-y':
      return { clipPath: 'inset(100% 0% 0% 0%)' };
    case 'iris':
      return { clipPath: 'inset(50% 50% 50% 50%)' };
    case 'door':
      return { clipPath: 'inset(0% 50% 0% 50%)' };
    case 'soft':
      return { opacity: 0, filter: 'blur(18px)', scale: 1.05 };
    case 'dark':
      return { opacity: 0, filter: 'brightness(0)', scale: 1.08 };
    case 'pop':
      return { opacity: 0, scale: 0.7, y };
    case 'skew':
      return { opacity: 0, y, skewY: 6 };
    default:
      return { opacity: 0, yPercent: 14 };
  }
}
const revealTo: gsap.TweenVars = {
  clipPath: 'inset(0% 0% 0% 0%)',
  opacity: 1,
  filter: 'none',
  scale: 1,
  y: 0,
  yPercent: 0,
  skewY: 0,
};

export default function ProjectMotion({
  slug,
  onExplode,
}: {
  slug: string;
  onExplode?: (value: number) => void;
}) {
  const explodeRef = useRef(onExplode);
  useEffect(() => {
    explodeRef.current = onExplode;
  }, [onExplode]);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.project-site');
    if (!root) return;
    const embedded = new URLSearchParams(location.search).get('embed') === '1';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(pointer: fine)').matches;
    const narrow = matchMedia('(max-width: 760px)').matches;
    const P = personalities[slug] ?? personalities.nova;
    const accent = getComputedStyle(root).getPropertyValue('--site-accent').trim() || '#222';
    const html = document.documentElement;
    html.dataset.motion = 'ready';
    const added: Element[] = [];
    const add = <T extends HTMLElement>(parent: Element, tag: string, className: string) => {
      const el = document.createElement(tag) as T;
      el.className = className;
      el.setAttribute('aria-hidden', 'true');
      parent.appendChild(el);
      added.push(el);
      return el;
    };
    const cleanups: (() => void)[] = [];
    const on = <K extends keyof WindowEventMap>(
      target: Window | HTMLElement,
      type: K,
      fn: (e: WindowEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn as EventListener, opts);
      cleanups.push(() => target.removeEventListener(type, fn as EventListener));
    };

    if (reduced) return () => delete html.dataset.motion;

    gsap.registerPlugin(ScrollTrigger);
    let lenis: Lenis | undefined;
    const raf = (t: number) => lenis?.raf(t * 1000);
    if (!embedded && !narrow) {
      lenis = new Lenis({ duration: 1.1, anchors: true, smoothWheel: true });
      lenis.on('scroll', () => ScrollTrigger.update());
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }

    const cover = root.querySelector<HTMLElement>('#top');
    const heroTitle = cover?.querySelector<HTMLElement>('h1');
    const dynamic = '.adapt-cover h1,.room-detail h2,.business-detail h3';
    const ctx = gsap.context(() => {
      /* ---------- progress bar ---------- */
      const bar = add(root, 'div', 'm-progress');
      gsap.to(bar, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
      });

      /* ---------- opening ---------- */
      const intro = gsap.timeline({ defaults: { ease: P.ease } });
      if (!embedded) {
        const curtain = add(root, 'div', `m-curtain m-curtain-${P.curtain}`);
        curtain.style.setProperty('--c', accent);
        const mark = document.createElement('span');
        mark.className = 'm-curtain-mark';
        mark.textContent =
          root.querySelector('.site-wordmark')?.childNodes[0]?.textContent?.trim() || slug.toUpperCase();
        curtain.appendChild(mark);
        splitText(mark);
        intro
          .from(mark.querySelectorAll('.m-ch-in'), {
            yPercent: 110,
            stagger: 0.035,
            duration: 0.6,
            ease: 'power3.out',
          })
          .to(mark, { opacity: 0, duration: 0.3, ease: 'power1.in' }, '+=0.1');
        const exit: gsap.TweenVars =
          P.curtain === 'side'
            ? { clipPath: 'inset(0% 0% 0% 100%)' }
            : P.curtain === 'iris'
              ? { clipPath: 'circle(0% at 50% 50%)' }
              : P.curtain === 'fade'
                ? { opacity: 0 }
                : P.curtain === 'split'
                  ? { clipPath: 'inset(0% 50% 0% 50%)' }
                  : { clipPath: 'inset(0% 0% 100% 0%)' };
        intro.to(curtain, { ...exit, duration: 0.8, ease: 'power4.inOut' }, '-=0.15');
        intro.set(curtain, { display: 'none' });
      }
      const at = embedded ? 0.1 : '-=0.45';
      intro.from(
        root.querySelectorAll('.site-nav > *, .project-return > *'),
        { y: -18, opacity: 0, stagger: 0.06, duration: 0.8, ease: 'power3.out' },
        at,
      );
      if (heroTitle && !heroTitle.matches(dynamic)) {
        splitText(heroTitle);
        intro.from(
          heroTitle.querySelectorAll('.m-ch-in'),
          {
            yPercent: 115,
            rotate: slug === 'offgrid' ? 8 : 0,
            opacity: slug === 'lumina' || slug === 'noir' ? 0 : 1,
            filter: slug === 'lumina' ? 'blur(10px)' : 'none',
            stagger: slug === 'offgrid' ? 0.05 : 0.035,
            duration: slug === 'noir' ? 1.4 : 1,
            ease: slug === 'offgrid' ? 'back.out(1.8)' : 'power4.out',
          },
          '<0.1',
        );
      }
      const heroMedia = root.querySelectorAll<HTMLElement>(P.hero);
      heroMedia.forEach((m, i) => {
        intro.fromTo(
          m,
          revealFrom(P.reveal, P.y),
          { ...revealTo, duration: P.dur + 0.3, ease: P.ease, clearProps: 'clipPath,filter' },
          i === 0 ? '<0.05' : '<0.25',
        );
        const img = m.tagName === 'IMG' ? m : m.querySelector('img');
        const clipped = m.tagName === 'IMG' ? m.parentElement : m;
        if (img && clipped && /hidden|clip/.test(getComputedStyle(clipped).overflow))
          intro.from(img, { scale: 1.3, duration: P.dur + 0.9, ease: 'power3.out' }, '<');
      });
      const heroRest = cover
        ? [...cover.querySelectorAll<HTMLElement>(
            ':scope > div:not(.m-fx) > p, :scope > p, .overline, .line-button, .solid-button, .hero-photo-select, .nova-newsbar, .aether-spec, .aether-control, .casa-copy > *:not(h1), .room-directory > *, .adapt-selector > *, .offgrid-bottom > *, .eclat-caption > *, .eclat-topline, .adapt-topline, .offgrid-topline, .yui-heading > span, .yui-heading > p, .lumina-side, .noir-season, .nova-cover-number, .lumina-edition, .eclat-volume',
          )].filter((el) => !heroTitle?.contains(el) && ![...heroMedia].some((m) => m.contains(el)))
        : [];
      if (heroRest.length)
        intro.from(
          heroRest,
          {
            y: P.reveal === 'pop' ? 30 : 22,
            opacity: 0,
            stagger: 0.05,
            duration: 0.9,
            ease: P.reveal === 'pop' ? 'back.out(2)' : 'power3.out',
            clearProps: 'transform,opacity',
          },
          '<0.35',
        );

      /* ---------- hero scroll-out ---------- */
      if (cover) {
        heroMedia.forEach((m) => {
          const img = m.tagName === 'IMG' ? null : m.querySelector('img');
          if (img)
            gsap.to(img, {
              yPercent: 10,
              ease: 'none',
              scrollTrigger: { trigger: cover, start: 'top top', end: 'bottom top', scrub: true },
            });
        });
        if (heroTitle && slug !== 'aether')
          gsap.to(heroTitle, {
            yPercent: -30,
            opacity: 0.2,
            ease: 'none',
            scrollTrigger: { trigger: cover, start: 'top top', end: 'bottom top', scrub: true },
          });
      }

      /* ---------- scroll reveals ---------- */
      const sections = [...root.querySelectorAll<HTMLElement>('section')].filter((s) => s !== cover);
      sections.forEach((section) => {
        section
          .querySelectorAll<HTMLElement>('h2, .section-title h2, .brand-closing h2')
          .forEach((h) => {
            if (h.matches(dynamic) || h.closest(dynamic)) return;
            splitText(h);
            gsap.from(h.querySelectorAll('.m-ch-in'), {
              yPercent: 110,
              opacity: slug === 'noir' || slug === 'lumina' ? 0 : 1,
              stagger: 0.022,
              duration: 1,
              ease: 'power4.out',
              scrollTrigger: { trigger: h, start: 'top 88%', once: true },
            });
          });
        section.querySelectorAll<HTMLElement>('.section-kicker, .overline').forEach((k) =>
          gsap.from(k, {
            clipPath: 'inset(0% 100% 0% 0%)',
            duration: 1.1,
            ease: 'power3.inOut',
            clearProps: 'clipPath',
            scrollTrigger: { trigger: k, start: 'top 92%', once: true },
          }),
        );
        const media = [...section.querySelectorAll<HTMLImageElement>('img')].filter(
          (img) => !img.closest('button, .small-tabs, .work-consult') && img.clientWidth > 120,
        );
        media.forEach((img) => {
          const frame = img.parentElement && img.parentElement !== section && img.parentElement.children.length === 1 ? img.parentElement : img;
          gsap.fromTo(
            frame,
            revealFrom(P.reveal, P.y),
            {
              ...revealTo,
              duration: P.dur,
              ease: P.ease,
              clearProps: 'clipPath,filter',
              scrollTrigger: { trigger: frame, start: 'top 86%', once: true },
            },
          );
          const clips = frame !== img && /hidden|clip/.test(getComputedStyle(frame).overflow);
          if (clips && img.clientHeight > 200)
            gsap.fromTo(
              img,
              { yPercent: -6, scale: 1.14 },
              {
                yPercent: 6,
                scale: 1.14,
                ease: 'none',
                scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true },
              },
            );
        });
      });
      const texts = sections.flatMap((s) => [
        ...s.querySelectorAll<HTMLElement>(
          'p:not(.fine-print), .line-button, .solid-button, .outline-button, article, li, dl > div, .wide-tabs > button, .small-tabs, form > *, .feature-columns > *',
        ),
      ]);
      const seen = new Set<HTMLElement>();
      const batch = texts.filter((el) => {
        if ([...seen].some((s) => s.contains(el))) return false;
        seen.add(el);
        return !el.closest('.m-fx');
      });
      gsap.set(batch, { opacity: 0, y: P.y * 0.6 });
      ScrollTrigger.batch(batch, {
        start: 'top 92%',
        once: true,
        onEnter: (els) =>
          gsap.to(els, {
            opacity: 1,
            y: 0,
            stagger: 0.07,
            duration: 0.9,
            ease: P.reveal === 'pop' ? 'back.out(1.8)' : 'power3.out',
            clearProps: 'transform,opacity',
          }),
      });

      /* ---------- decorative parallax ---------- */
      root
        .querySelectorAll<HTMLElement>('.lumina-big, .eclat-volume, .vertical-note, .noir-season, .lumina-edition, .nova-cover-number b')
        .forEach((el, i) =>
          gsap.to(el, {
            yPercent: -40 - i * 10,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
          }),
        );

      /* ---------- closing band ---------- */
      const closing = root.querySelector<HTMLElement>('.brand-closing');
      if (closing)
        gsap.fromTo(
          closing,
          { clipPath: 'inset(18% 6% 0% 6% round 24px)' },
          {
            clipPath: 'inset(0% 0% 0% 0% round 0px)',
            ease: 'none',
            scrollTrigger: { trigger: closing, start: 'top bottom', end: 'top 45%', scrub: true },
          },
        );

      /* ---------- marquee speed follows scroll ---------- */
      root.querySelectorAll<HTMLElement>('.m-marquee-track').forEach((track) => {
        const loop = gsap.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
        ScrollTrigger.create({
          trigger: track,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: (self) => {
            const v = self.getVelocity() / 300;
            gsap.to(loop, { timeScale: gsap.utils.clamp(-6, 6, 1 + v), duration: 0.3, overwrite: true });
            gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.3 });
          },
        });
      });

      /* ---------- signatures ---------- */
      signature(slug, root, cover, add, on, explodeRef, narrow);
    }, root);

    /* ---------- cursor ---------- */
    if (fine) {
      const cur = add(root, 'div', 'm-cursor');
      const label = document.createElement('span');
      cur.appendChild(label);
      cur.dataset.state = 'hidden';
      const x = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' });
      const y = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
      on(window, 'pointermove', (e) => {
        x(e.clientX);
        y(e.clientY);
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cursor], a, button, input, select, textarea, label');
        cur.dataset.state = t?.dataset.cursor ? 'label' : t ? 'hover' : '';
        label.textContent = t?.dataset.cursor ?? '';
      });
      on(root, 'pointerleave', () => (cur.dataset.state = 'hidden'));
    }

    /* ---------- magnetic buttons ---------- */
    if (fine)
      root
        .querySelectorAll<HTMLElement>('.solid-button, .site-contact, .brand-closing button, .outline-button, .work-consult')
        .forEach((btn) => {
          const mx = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3' });
          const my = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3' });
          on(btn, 'pointermove', (e) => {
            const r = btn.getBoundingClientRect();
            mx((e.clientX - r.left - r.width / 2) * 0.3);
            my((e.clientY - r.top - r.height / 2) * 0.4);
          });
          on(btn, 'pointerleave', () => {
            mx(0);
            my(0);
          });
        });

    /* ---------- swapping content ---------- */
    const swaps = root.querySelectorAll<HTMLElement>('.room-detail, .business-detail, .adapt-copy, .course-detail, .product-copy, .salon-style');
    const busy = { on: false };
    const mo = new MutationObserver((records) => {
      if (busy.on) return;
      const targets = new Set<HTMLElement>();
      records.forEach((r) => {
        const el = (r.target.nodeType === 3 ? r.target.parentElement : r.target) as HTMLElement | null;
        const box = el?.closest<HTMLElement>('.room-detail, .business-detail, .adapt-copy, .course-detail, .product-copy, .salon-style');
        if (box) targets.add(box);
      });
      targets.forEach((box) => {
        const h = box.querySelector<HTMLElement>('h1, h2, h3');
        if (h && slug === 'adapt') scramble(h, busy);
        gsap.fromTo(
          box.querySelectorAll(':scope > *:not(img), :scope > div > *'),
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, stagger: 0.05, duration: 0.6, ease: 'power3.out', overwrite: true },
        );
        box.querySelectorAll('img').forEach((img) =>
          gsap.fromTo(img, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power4.inOut', clearProps: 'clipPath' }),
        );
      });
    });
    swaps.forEach((s) => mo.observe(s, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['src'] }));

    const refresh = () => ScrollTrigger.refresh();
    const imgs = root.querySelectorAll('img');
    imgs.forEach((img) => img.addEventListener('load', refresh, { once: true }));
    void document.fonts?.ready.then(refresh);
    return () => {
      mo.disconnect();
      cleanups.forEach((c) => c());
      imgs.forEach((img) => img.removeEventListener('load', refresh));
      ctx.revert();
      added.forEach((el) => el.remove());
      lenis?.destroy();
      gsap.ticker.remove(raf);
      delete html.dataset.motion;
    };
  }, [slug]);
  return null;
}

function scramble(el: HTMLElement, busy: { on: boolean }) {
  const glyphs = '#%&*+=<>/アイウエオカキクケコ01';
  const nodes: { node: Text; final: string }[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.textContent?.trim()) nodes.push({ node, final: node.textContent });
  }
  if (!nodes.length) return;
  const state = { p: 0 };
  busy.on = true;
  gsap.to(state, {
    p: 1,
    duration: 0.9,
    ease: 'power2.out',
    onUpdate: () =>
      nodes.forEach(({ node, final }) => {
        busy.on = true;
        const n = Math.floor(final.length * state.p);
        node.textContent =
          final.slice(0, n) +
          final
            .slice(n)
            .replace(/[^、。]/g, () => glyphs[(Math.random() * glyphs.length) | 0]);
      }),
    onComplete: () => {
      nodes.forEach(({ node, final }) => (node.textContent = final));
      queueMicrotask(() => (busy.on = false));
    },
  });
}

function signature(
  slug: string,
  root: HTMLElement,
  cover: HTMLElement | null,
  add: <T extends HTMLElement>(parent: Element, tag: string, className: string) => T,
  on: <K extends keyof WindowEventMap>(t: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void) => void,
  explode: { current: ((v: number) => void) | undefined },
  narrow: boolean,
) {
  if (!cover) return;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s);

  if (slug === 'nova') {
    const photo = q('.nova-cover-photo');
    if (!photo) return;
    const fx = add(photo, 'div', 'm-fx m-blueprint');
    fx.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${[20, 40, 60, 80]
      .map((v) => `<line x1="${v}" y1="0" x2="${v}" y2="100"/><line x1="0" y1="${v}" x2="100" y2="${v}"/>`)
      .join('')}<rect x="30" y="26" width="40" height="42" class="m-bp-box"/><circle cx="50" cy="47" r="12" class="m-bp-box"/></svg><i class="m-scan"></i>`;
    const lines = fx.querySelectorAll('line, .m-bp-box');
    gsap.set(lines, { strokeDasharray: 200, strokeDashoffset: 200 });
    gsap.to(lines, { strokeDashoffset: 0, duration: 1.6, stagger: 0.06, ease: 'power2.inOut', delay: 1.8 });
    gsap.to(fx.querySelectorAll('.m-bp-box'), { opacity: 0, duration: 1, delay: 4.2 });
    gsap.fromTo(fx.querySelector('.m-scan'), { yPercent: -100 }, { yPercent: 1100, duration: 3.4, ease: 'power1.inOut', repeat: -1, repeatDelay: 1.6, delay: 2.4 });
  }

  if (slug === 'lumina') {
    const photo = q('.lumina-photo');
    if (photo) {
      add(photo, 'div', 'm-fx m-lightleak');
      const img = photo.querySelector('img');
      if (img) gsap.to(img, { scale: 1.06, duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 4.6 });
    }
    const big = q('.lumina-big');
    if (big) {
      splitText(big);
      gsap.from(big.querySelectorAll('.m-ch-in'), { opacity: 0, filter: 'blur(16px)', yPercent: 30, stagger: 0.09, duration: 1.6, ease: 'sine.out', delay: 1.6 });
      gsap.to(big, { xPercent: -12, ease: 'none', scrollTrigger: { trigger: cover, start: 'top top', end: 'bottom top', scrub: true } });
    }
  }

  if (slug === 'noir') {
    const spot = add(cover, 'div', 'm-fx m-spotlight');
    const sx = gsap.quickTo(spot, '--x', { duration: 0.9, ease: 'power3' });
    const sy = gsap.quickTo(spot, '--y', { duration: 0.9, ease: 'power3' });
    gsap.set(spot, { '--x': 72, '--y': 48 });
    on(cover, 'pointermove', (e) => {
      const r = cover.getBoundingClientRect();
      sx(((e.clientX - r.left) / r.width) * 100);
      sy(((e.clientY - r.top) / r.height) * 100);
    });
    gsap.from(spot, { opacity: 0, duration: 2, delay: 2 });
    const img = q('.noir-photo img');
    if (img) gsap.to(img, { rotate: 24, ease: 'none', scrollTrigger: { trigger: cover, start: 'top top', end: 'bottom top', scrub: true } });
    root.querySelectorAll<HTMLElement>('.vertical-note').forEach((v) =>
      gsap.from(v, { clipPath: 'inset(0% 0% 100% 0%)', duration: 2.2, delay: 2.2, ease: 'power2.inOut', clearProps: 'clipPath' }),
    );
  }

  if (slug === 'eclat') {
    const product = q('.eclat-product');
    if (!product) return;
    const sheen = add(product, 'div', 'm-fx m-sheen');
    gsap.set(product, { transformPerspective: 900 });
    const rx = gsap.quickTo(product, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(product, 'rotationY', { duration: 0.8, ease: 'power3' });
    const shx = gsap.quickTo(sheen, '--sx', { duration: 0.8, ease: 'power3' });
    on(cover, 'pointermove', (e) => {
      const r = cover.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      ry(px * 16);
      rx(-py * 12);
      shx(50 + px * 120);
    });
    on(cover, 'pointerleave', () => {
      rx(0);
      ry(0);
      shx(50);
    });
    gsap.to(product, { scale: 0.86, ease: 'none', scrollTrigger: { trigger: cover, start: 'top top', end: 'bottom top', scrub: true } });
  }

  if (slug === 'aether') {
    const obj = q('.aether-object');
    if (obj) {
      const rings = add(obj, 'div', 'm-fx m-waves');
      rings.innerHTML = '<i></i><i></i><i></i>';
      gsap.fromTo(rings.children, { scale: 0.4, opacity: 0.6 }, { scale: 1.6, opacity: 0, duration: 3.6, stagger: 1.2, repeat: -1, ease: 'sine.out' });
    }
    if (!narrow) {
      const state = { v: 0 };
      ScrollTrigger.create({
        trigger: cover,
        start: 'top top',
        end: '+=110%',
        pin: true,
        scrub: 0.6,
        onUpdate: (self) => {
          const v = Math.round(gsap.utils.clamp(0, 100, self.progress * 125));
          if (v !== state.v) {
            state.v = v;
            explode.current?.(v);
          }
        },
      });
      const hint = add(cover, 'div', 'm-fx m-scroll-hint');
      hint.textContent = 'スクロールで分解';
      gsap.to(hint, { opacity: 0, scrollTrigger: { trigger: cover, start: 'top top', end: '+=20%', scrub: true } });
    }
  }

  if (slug === 'casa') {
    const visual = q('.casa-visual');
    if (!visual) return;
    const dusk = add(visual, 'div', 'm-fx m-dusk');
    const glow = add(visual, 'div', 'm-fx m-windows');
    gsap.fromTo(dusk, { opacity: 0 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: cover, start: 'top top', end: 'bottom 30%', scrub: true } });
    gsap.fromTo(glow, { opacity: 0 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: cover, start: '15% top', end: 'bottom 30%', scrub: true } });
  }

  if (slug === 'room') {
    const explore = q('.room-explore');
    if (explore) {
      const tags = add(explore, 'div', 'm-fx m-room-tags');
      tags.innerHTML = '<span style="--x:30%;--y:30%">WEB</span><span style="--x:60%;--y:18%">PHOTO</span><span style="--x:62%;--y:70%">MOTION</span><span style="--x:22%;--y:64%">BOOKS</span>';
      gsap.from(tags.children, { scale: 0, opacity: 0, stagger: 0.12, duration: 0.7, ease: 'back.out(2.4)', delay: 2 });
      gsap.to(tags.children, { y: -8, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.3, delay: 2.8 });
    }
  }

  if (slug === 'yui') {
    add(root, 'div', 'm-fx m-grain');
    const main = q('.yui-main-photo');
    const small = q('.yui-small-photo');
    if (main) gsap.to(main, { yPercent: -8, ease: 'none', scrollTrigger: { trigger: cover, start: 'top top', end: 'bottom top', scrub: true } });
    if (small) gsap.to(small, { yPercent: -34, ease: 'none', scrollTrigger: { trigger: cover, start: 'top top', end: 'bottom top', scrub: true } });
    [main, small].forEach((m, i) => {
      if (!m) return;
      const flash = add(m, 'div', 'm-fx m-flash');
      gsap.fromTo(flash, { opacity: 0.9 }, { opacity: 0, duration: 0.8, delay: 1.9 + i * 0.35, ease: 'power2.out' });
    });
  }

  if (slug === 'adapt') {
    const obj = q('.adapt-object');
    if (obj) gsap.to(obj, { rotate: 10, yPercent: 10, ease: 'none', scrollTrigger: { trigger: cover, start: 'top top', end: 'bottom top', scrub: true } });
  }

  if (slug === 'offgrid') {
    const h1 = cover.querySelector('h1');
    if (h1) gsap.to(h1, { scale: 1.12, transformOrigin: 'left bottom', ease: 'none', scrollTrigger: { trigger: cover, start: 'top top', end: 'bottom top', scrub: true } });
  }

}
