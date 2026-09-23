'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

const R = 25;
const C = 2 * Math.PI * R;

export default function ToTop() {
  const [shown, setShown] = useState(false);
  const ring = useRef<SVGCircleElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(scrollY / max, 1) : 0;
      ring.current?.style.setProperty('stroke-dashoffset', String(C * (1 - p)));
      setShown(scrollY > innerHeight * 0.8);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
    };
  }, []);
  const toTop = () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    document.querySelector<HTMLElement>('.st-header .st-logo')?.focus({ preventScroll: true });
  };
  return (
    <button
      type="button"
      className={`st-totop ${shown ? 'is-shown' : ''}`}
      onClick={toTop}
      aria-label="ページの先頭へ戻る"
    >
      <svg viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r={R} className="st-totop-track" />
        <circle
          ref={ring}
          cx="28"
          cy="28"
          r={R}
          className="st-totop-ring"
          strokeDasharray={C}
          strokeDashoffset={C}
        />
      </svg>
      <ArrowUp size={20} aria-hidden />
      <span>TOP</span>
    </button>
  );
}
