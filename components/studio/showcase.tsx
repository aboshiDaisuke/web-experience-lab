'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { projects } from '@/lib/portfolio';
import { featured, techStack, workMeta } from '@/lib/studio';
import { BASE } from '@/lib/base-path';

const realtime = projects.filter((p) =>
  workMeta[p.slug].tech.some((t) => t === 'three.js' || t === 'WebGL'),
).length;
const blender = projects.filter((p) => workMeta[p.slug].tech.includes('Blender')).length;

// The capture stands in until the pointer rests on a tile; then the real page runs inside it.
function Tile({ slug, pitch, lead }: { slug: string; pitch: string; lead: boolean }) {
  const p = projects.find((x) => x.slug === slug)!;
  const frame = useRef<HTMLSpanElement>(null);
  const timer = useRef<number>(0);
  const [live, setLive] = useState(false);
  const [canLive, setCanLive] = useState(false);
  // the live page is laid out at 1440×900 and scaled to cover the tile
  const [fit, setFit] = useState({ s: 0.5, x: 0, y: 0 });
  useEffect(() => {
    setCanLive(
      matchMedia('(hover: hover) and (pointer: fine)').matches &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const s = Math.max(w / 1440, h / 900);
      setFit({ s, x: (w - 1440 * s) / 2, y: (h - 900 * s) / 2 });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(timer.current);
    };
  }, []);
  const enter = () => {
    if (!canLive) return;
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLive(true), 350);
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLive(false), 1200);
  };
  return (
    <li className={lead ? 'is-lead' : ''}>
      <a
        className="st-show-tile"
        href={`${BASE}/works/${slug}`}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onFocus={enter}
        onBlur={leave}
      >
        <span className="st-show-visual" ref={frame}>
          <img src={`${BASE}/images/works/${slug}-desktop.jpg`} alt="" loading="lazy" />
          {live && (
            <iframe
              src={`${BASE}/works/${slug}?embed=1`}
              title={`${p.name} のライブ表示`}
              tabIndex={-1}
              aria-hidden
              style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.s})` }}
            />
          )}
          {canLive && (
            <span className="st-show-live" aria-hidden>
              {live ? 'LIVE — いま動いています' : 'カーソルを乗せると動きます'}
            </span>
          )}
        </span>
        <span className="st-show-body">
          <span className="st-show-cat">{p.category}</span>
          <b>
            {p.name}
            <ArrowUpRight size={20} aria-hidden />
          </b>
          <span className="st-show-pitch">{pitch}</span>
          <span className="st-chips">
            {workMeta[slug].tech.map((t) => (
              <i key={t}>{t}</i>
            ))}
          </span>
        </span>
      </a>
    </li>
  );
}

export default function Showcase() {
  return (
    <section className="st-showcase" aria-labelledby="showcase-title">
      <div className="st-section-head st-on-dark">
        <h2 id="showcase-title">
          ぜんぶ、
          <wbr />
          ブラウザの中で
          <wbr />
          動いています。
        </h2>
        <p>
          動画ではありません。3Dも、光の反射も、布や水の動きも、その場で計算して描いています。見るだけでなく、回して、開けて、乗りこめる。代表的な3つをご覧ください。
        </p>
      </div>
      <dl className="st-stats">
        <div>
          <dt>制作サンプル</dt>
          <dd>
            {projects.length}
            <small>作品</small>
          </dd>
        </div>
        <div>
          <dt>リアルタイム3D・WebGL</dt>
          <dd>
            {realtime}
            <small>作品</small>
          </dd>
        </div>
        <div>
          <dt>Blenderで3Dモデルから制作</dt>
          <dd>
            {blender}
            <small>作品</small>
          </dd>
        </div>
        <div>
          <dt>テンプレートの使用</dt>
          <dd>
            0<small>件</small>
          </dd>
        </div>
      </dl>
      <ul className="st-show-grid">
        {featured.map((f, i) => (
          <Tile key={f.slug} slug={f.slug} pitch={f.pitch} lead={i === 0} />
        ))}
      </ul>
      <ul className="st-tech" aria-label="使っている技術">
        {techStack.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
