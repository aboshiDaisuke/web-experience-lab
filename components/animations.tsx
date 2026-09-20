'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
export default function Animations() {
  const cursor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const mobile = matchMedia('(max-width:700px)').matches;
    let lenis: Lenis | undefined;
    const tick = (t: number) => lenis?.raf(t * 1000);
    if (!reduced && !mobile) {
      lenis = new Lenis({ duration: 1.15, anchors: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(tick);
    }
    const ctx = gsap.context(() => {
      if (!reduced) {
        gsap.from('.intro h2 .line', {
          y: 65,
          opacity: 0.1,
          stagger: 0.2,
          duration: 1,
          scrollTrigger: {
            trigger: '.intro',
            start: 'top 78%',
            end: 'center 60%',
            scrub: 1,
          },
        });
        gsap.fromTo(
          '.browser-window',
          { y: 60, rotateX: 8 },
          {
            y: -15,
            rotateX: 0,
            scrollTrigger: {
              trigger: '.corporate',
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1,
            },
          },
        );
        gsap.fromTo(
          '.nova-photo img',
          { y: 30, scale: 1.12 },
          {
            y: -30,
            scale: 1.2,
            scrollTrigger: { trigger: '.corporate', scrub: 1 },
          },
        );
        gsap.fromTo(
          '.fashion-image',
          { clipPath: 'inset(12% 10% 12% 10%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            scrollTrigger: {
              trigger: '.fashion',
              start: 'top 75%',
              end: 'center center',
              scrub: 1,
            },
          },
        );
        gsap.fromTo(
          '.fashion-word',
          { x: mobile ? 20 : 110 },
          {
            x: mobile ? -15 : -70,
            scrollTrigger: { trigger: '.fashion', scrub: 1 },
          },
        );
        gsap.fromTo(
          '.fashion-image img',
          { scale: 1.05 },
          { scale: 1.2, scrollTrigger: { trigger: '.fashion', scrub: 1 } },
        );
        gsap.from('.dish-photo', {
          scale: 0.8,
          rotation: -12,
          duration: 1.3,
          scrollTrigger: { trigger: '.restaurant', start: 'top 60%' },
        });
        gsap.from('.dish-note', {
          y: 30,
          opacity: 0,
          stagger: 0.2,
          duration: 0.8,
          scrollTrigger: { trigger: '.restaurant', start: 'top 40%' },
        });
      }
      gsap.utils
        .toArray<HTMLElement>('.process-step')
        .forEach((el, i) =>
          ScrollTrigger.create({
            trigger: '.process',
            start: `top ${80 - i * 9}%`,
            onEnter: () => el.classList.add('active'),
            onLeaveBack: () => el.classList.remove('active'),
          }),
        );
    });
    const handle = (e: PointerEvent) => {
      if (!cursor.current) return;
      cursor.current.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-cursor],a,button',
      );
      cursor.current.dataset.active = target ? 'true' : 'false';
      cursor.current.textContent =
        target?.dataset.cursor || (target ? 'VIEW' : '');
    };
    if (!mobile && !reduced) window.addEventListener('pointermove', handle);
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    return () => {
      ctx.revert();
      lenis?.destroy();
      gsap.ticker.remove(tick);
      window.removeEventListener('pointermove', handle);
      window.removeEventListener('load', refresh);
    };
  }, []);
  return <div className="custom-cursor" ref={cursor} aria-hidden="true" />;
}
