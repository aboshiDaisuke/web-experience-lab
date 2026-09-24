'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { projects } from '@/lib/portfolio';
import { BASE } from '@/lib/base-path';

const images = projects.map((p) => `${BASE}/images/works/${p.slug}-desktop.jpg`);

export default function Hero() {
  const host = useRef<HTMLDivElement>(null);
  const flip = useRef<() => void>(() => {});
  const [top, setTop] = useState(0);
  const [hovered, setHovered] = useState(-1);
  const [grabbing, setGrabbing] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let disposed = false;
    import('@/lib/scenes/paper-stack')
      .then(({ mountPaperStack }) =>
        mountPaperStack(host.current!, images, {
          onTop: setTop,
          onHover: setHovered,
          onGrab: setGrabbing,
          onOpen: (index) => location.assign(`${BASE}/works/${projects[index].slug}`),
        }),
      )
      .then((stack) => {
        flip.current = stack.flip;
        dispose = stack.dispose;
        if (disposed) stack.dispose();
      })
      .catch(() => !disposed && setFailed(true));
    return () => {
      disposed = true;
      dispose?.();
    };
  }, []);
  const shown = hovered >= 0 ? hovered : top;
  const p = projects[shown];
  return (
    <section className="st-hero" aria-labelledby="hero-title">
      <div
        ref={host}
        className={`st-hero-canvas ${grabbing ? 'is-grabbing' : ''}`}
        role="img"
        aria-label={`${projects.length}作品を印刷した紙の束。いちばん上の紙をつまんで投げると、次の作品が現れます。クリックで作品を開けます。`}
      >
        {failed && (
          <div className="st-hero-fallback">
            {projects.slice(0, 6).map((x) => (
              <img key={x.slug} src={`${BASE}/images/works/${x.slug}-desktop.jpg`} alt="" />
            ))}
          </div>
        )}
      </div>
      <div className="st-hero-copy">
        <h1 id="hero-title">
          触れた瞬間に、
          <br />
          伝わるサイトを。
        </h1>
        <p>
          企業サイトから3Dの製品ページまで。業種ごとに世界観を設計し、思わず操作したくなるWebサイトをつくります。ここに重なる{projects.length}作品は、すべて実際に動きます。
        </p>
        <div className="st-hero-actions">
          <a className="st-btn st-btn-light" href="#contact">
            制作を相談する
          </a>
          <a className="st-btn st-btn-ghost" href="#works">
            作品を一覧で見る
          </a>
        </div>
      </div>
      <div className="st-hero-focus" aria-live="polite">
        <span className="st-hero-focus-count">
          {String(shown + 1).padStart(2, '0')} / {projects.length}
        </span>
        <a href={`${BASE}/works/${p.slug}`}>
          <span className="st-hero-focus-cat">{p.category}</span>
          <b>
            {p.name}
            <ArrowUpRight size={18} />
          </b>
        </a>
        {!failed && (
          <button type="button" className="st-hero-focus-next" onClick={() => flip.current()}>
            {hovered >= 0 && hovered !== top ? 'クリックで開く' : 'つまんで投げる — 次の作品へ'}
          </button>
        )}
      </div>
    </section>
  );
}
