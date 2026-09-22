'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { projects } from '@/lib/portfolio';

const images = projects.map((p) => `/images/works/${p.slug}-desktop.jpg`);

export default function Hero() {
  const host = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState({ index: 0, hovered: false });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let disposed = false;
    import('@/lib/scenes/gallery-ring')
      .then(({ mountGalleryRing }) =>
        mountGalleryRing(host.current!, images, {
          onFocus: (index, hovered) => setFocus({ index, hovered }),
          onOpen: (index) => location.assign(`/works/${projects[index].slug}`),
        }),
      )
      .then((c) => {
        cleanup = c;
        if (disposed) c();
      })
      .catch(() => !disposed && setFailed(true));
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  const p = projects[focus.index];
  return (
    <section className="st-hero" aria-labelledby="hero-title">
      <div
        ref={host}
        className="st-hero-canvas"
        role="img"
        aria-label="10作品の画面が円を描いて回るギャラリー。ドラッグで回転、クリックで作品を開けます。"
      >
        {failed && (
          <div className="st-hero-fallback">
            {projects.slice(0, 6).map((x) => (
              <img key={x.slug} src={`/images/works/${x.slug}-desktop.jpg`} alt="" />
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
          企業サイトから3Dの製品ページまで。業種ごとに世界観を設計し、思わず操作したくなるWebサイトをつくります。ここに並ぶ10作品は、すべて実際に動きます。
        </p>
        <div className="st-hero-actions">
          <a className="st-btn st-btn-light" href="#contact">
            制作を相談する
          </a>
          <a className="st-btn st-btn-ghost" href="#works">
            作品を見る
          </a>
        </div>
      </div>
      <a className="st-hero-focus" href={`/works/${p.slug}`} aria-live="polite">
        <span className="st-hero-focus-cat">{p.category}</span>
        <b>{p.name}</b>
        <span className="st-hero-focus-open">
          {focus.hovered ? 'クリックで開く' : 'ドラッグで回す'}
          <ArrowUpRight size={14} />
        </span>
      </a>
    </section>
  );
}
