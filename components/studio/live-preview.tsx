'use client';
import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, RotateCcw, ArrowUpRight } from 'lucide-react';
import { projects } from '@/lib/portfolio';
import WebMCP from '@/components/webmcp';

export default function LivePreview({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (index: number) => void;
}) {
  const [mobile, setMobile] = useState(false);
  const [scale, setScale] = useState(0.5);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [armed, setArmed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const project = projects[selected];
  useEffect(() => {
    if (matchMedia('(max-width: 700px)').matches) setMobile(true);
    const el = stage.current!;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setArmed(true),
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => setLoading(true), [selected, version]);
  useEffect(() => {
    const el = stage.current!;
    const resize = () =>
      setScale(
        Math.min(
          (el.clientWidth - (mobile ? 24 : 0)) / (mobile ? 390 : 1280),
          (el.clientHeight - (mobile ? 24 : 0)) / (mobile ? 844 : 800),
        ),
      );
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    return () => ro.disconnect();
  }, [mobile]);
  return (
    <section id="try" className="st-try" aria-labelledby="try-title">
      <WebMCP selectProject={onSelect} setMobile={setMobile} />
      <div className="st-section-head st-on-dark">
        <h2 id="try-title">その場で触って、<wbr />確かめる。</h2>
        <p>
          作品を選ぶと、実際のページがこの枠の中で動きます。予約フォームも3Dも、そのまま操作できます。
        </p>
      </div>
      <div className="st-try-bar">
        <div className="st-try-tabs" role="tablist" aria-label="試す作品">
          {projects.map((p, i) => (
            <button
              key={p.slug}
              role="tab"
              aria-selected={selected === i}
              onClick={() => onSelect(i)}
            >
              {p.category.split('・')[0]}
            </button>
          ))}
        </div>
        <div className="st-try-tools">
          <button
            aria-label="PCで表示"
            aria-pressed={!mobile}
            onClick={() => setMobile(false)}
          >
            <Monitor size={17} />
          </button>
          <button
            aria-label="スマートフォンで表示"
            aria-pressed={mobile}
            onClick={() => setMobile(true)}
          >
            <Smartphone size={17} />
          </button>
          <button
            aria-label="はじめから表示し直す"
            onClick={() => setVersion((v) => v + 1)}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
      <div className={`st-try-stage ${mobile ? 'is-phone' : ''}`} ref={stage}>
        {loading && (
          <div className="st-try-loading" role="status">
            {project.name}を読み込んでいます
          </div>
        )}
        <div
          className="st-try-viewport"
          style={{
            width: mobile ? 390 : 1280,
            height: mobile ? 844 : 800,
            transform: `translate(-50%,-50%) scale(${Math.max(0.1, scale)})`,
          }}
        >
          {armed && (
            <iframe
              key={`${project.slug}-${version}`}
              src={`/works/${project.slug}?embed=1`}
              title={`${project.name}を操作できるプレビュー`}
              onLoad={() => setLoading(false)}
            />
          )}
        </div>
      </div>
      <div className="st-try-caption">
        <p>
          <b>{project.name}</b>
          {project.note}
        </p>
        <a href={`/works/${project.slug}`}>
          全画面で開く <ArrowUpRight size={16} />
        </a>
      </div>
    </section>
  );
}
