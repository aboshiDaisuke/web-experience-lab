'use client';
import { useEffect, useRef, useState } from 'react';
export type SceneKind =
  | 'hero'
  | 'product'
  | 'house'
  | 'room'
  | 'adaptive'
  | 'final'
  | 'capability';
export default function Scene({
  kind,
  view = 'EXTERIOR',
  night = false,
  theme = 'CREATIVE',
  onPick,
  progress,
  highlight,
}: {
  kind: SceneKind;
  view?: string;
  night?: boolean;
  theme?: string;
  onPick?: (value: string) => void;
  progress?: number;
  highlight?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ view, night, theme, onPick, progress, highlight });
  state.current = { view, night, theme, onPick, progress, highlight };
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = host.current!;
    let cleanup: (() => void) | undefined;
    let disposed = false;
    let starting = false;
    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((e) => e.isIntersecting) || starting) return;
        starting = true;
        try {
          const { mountScene } = await import('@/lib/scenes/engine');
          if (disposed) return;
          cleanup = await mountScene(el, kind, () => state.current);
          if (disposed) cleanup();
        } catch {
          if (!disposed) setFailed(true);
        }
      },
      { rootMargin: '180px' },
    );
    observer.observe(el);
    return () => {
      disposed = true;
      observer.disconnect();
      cleanup?.();
    };
  }, [kind]);
  return (
    <div
      ref={host}
      className={`scene scene-${kind}`}
      data-cursor={kind === 'house' || kind === 'room' ? 'DRAG' : undefined}
      data-highlight={highlight}
      data-progress={progress}
      data-view={view}
      data-night={night}
      data-theme={theme}
      aria-label={`${kind} interactive 3D`}
    >
      <span className="scene-fallback">
        {failed ? '3D表示を利用できません。作品の紹介をお楽しみください。' : ''}
      </span>
    </div>
  );
}
