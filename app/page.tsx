'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Monitor,
  Smartphone,
  RotateCcw,
  Maximize2,
  MousePointer2,
} from 'lucide-react';
import { projects } from '@/lib/portfolio';
import WebMCP from '@/components/webmcp';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
export default function Home() {
  const [selected, setSelected] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [scale, setScale] = useState(1);
  const [version, setVersion] = useState(0);
  const [info, setInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [chapter, setChapter] = useState('top');
  const project = projects[selected];
  useEffect(() => {
    const saved = Number(sessionStorage.getItem('lab-selection'));
    if (saved >= 0 && saved < projects.length) setSelected(saved);
  }, []);
  useEffect(() => {
    sessionStorage.setItem('lab-selection', String(selected));
    setLoading(true);
    setChapter('top');
  }, [selected, version]);
  useEffect(() => {
    const el = stage.current!;
    const resize = () =>
      setScale(
        Math.min(
          (el.clientWidth - 32) / (mobile ? 390 : 1280),
          (el.clientHeight - 24) / (mobile ? 844 : 800),
        ),
      );
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    return () => ro.disconnect();
  }, [mobile]);
  const select = (i: number) =>
    setSelected((i + projects.length) % projects.length);
  return (
    <main className="showroom">
      <WebMCP selectProject={setSelected} setMobile={setMobile} />
      <header className="lab-header">
        <a href="/" className="lab-logo">
          <b>
            W/E<span>®</span>
          </b>
          <span>
            WEB EXPERIENCE LAB
            <br />
            <small>デザインの可能性を、ここから。</small>
          </span>
        </a>
        <div className="lab-header-right">
          <span className="local-note">
            <i />
            INTERACTIVE SHOWROOM
          </span>
          <button onClick={() => setInfo(true)}>
            このサイトについて <ArrowUpRight size={15} />
          </button>
        </div>
      </header>
      <div className="lab-intro">
        <div>
          <span className="overline">SELECTED WORKS — 2026</span>
          <h1>
            選んで、触れて、<span>体験する。</span>
          </h1>
        </div>
        <p>
          10の業種、10の異なる世界観。
          <br />
          気になる作品を選び、そのまま操作してみてください。
        </p>
        <div className="work-counter">
          <b>10</b>
          <span>EXPERIENCES</span>
        </div>
      </div>
      <div className="showroom-body">
        <aside className="project-index" aria-label="作品一覧">
          <div className="index-label">
            <span>制作サンプル</span>
            <span>01—10</span>
          </div>
          <div className="project-buttons">
            {projects.map((p, i) => (
              <button
                key={p.slug}
                aria-pressed={selected === i}
                className={selected === i ? 'selected' : ''}
                onClick={() => select(i)}
              >
                <span className="project-number">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <img src={`/images/${p.image}.jpg`} alt="" />
                <span className="project-text">
                  <b>{p.name}</b>
                  <small>{p.category}</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
          <div className="index-bottom">
            <span className="index-dot" />
            すべての作品を、この画面で。
          </div>
        </aside>
        <section
          className="preview-panel"
          aria-label="選んだサイトのプレビュー"
        >
          <div className="preview-toolbar">
            <div className="window-dots">
              <i />
              <i />
              <i />
            </div>
            <div
              className="preview-chapters"
              aria-label="ページ内の見どころへ移動"
            >
              {[
                ['top', 'トップ'],
                ['story', 'コンセプト'],
                ['details', '詳しく見る'],
                ['features', '特集・体験'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={chapter === id}
                  onClick={() => {
                    setChapter(id);
                    frame.current?.contentWindow?.postMessage(
                      { type: 'lab-jump', id },
                      location.origin,
                    );
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="device-buttons">
              <button
                aria-label="PC表示"
                aria-pressed={!mobile}
                onClick={() => setMobile(false)}
              >
                <Monitor size={16} />
              </button>
              <button
                aria-label="スマートフォン表示"
                aria-pressed={mobile}
                onClick={() => setMobile(true)}
              >
                <Smartphone size={16} />
              </button>
              <span />
              <button
                aria-label="プレビューを再読み込み"
                onClick={() => setVersion((v) => v + 1)}
              >
                <RotateCcw size={15} />
              </button>
              <a href={`/works/${project.slug}`} aria-label="作品ページを開く">
                <Maximize2 size={15} />
              </a>
            </div>
          </div>
          <div className="preview-stage" ref={stage}>
            {loading && (
              <div className="preview-loading" role="status">
                {project.name}
                <span>ページを読み込んでいます</span>
              </div>
            )}
            <div
              className={`preview-viewport ${mobile ? 'phone' : ''}`}
              style={{
                width: mobile ? 390 : 1280,
                height: mobile ? 844 : 800,
                transform: `translate(-50%,-50%) scale(${Math.max(0.1, scale)})`,
              }}
            >
              <iframe
                ref={frame}
                key={`${project.slug}-${version}`}
                src={`/works/${project.slug}?embed=1`}
                title={`${project.name} 操作できるプレビュー`}
                onLoad={() => setLoading(false)}
              />
            </div>
          </div>
          <div className="preview-caption">
            <div>
              <span>{project.type}</span>
              <h2>
                {project.category}
                <small> / {project.name}</small>
              </h2>
              <p>
                <MousePointer2 size={14} />
                {project.note}
              </p>
            </div>
            <a className="open-project" href={`/works/${project.slug}`}>
              サイトを開く <ArrowUpRight size={18} />
            </a>
          </div>
        </section>
      </div>
      <footer className="lab-footer">
        <span>
          © WEB EXPERIENCE LAB <span className="footer-slash">/</span>{' '}
          すべて架空ブランドの制作サンプルです。
        </span>
        <div>
          <button aria-label="前の作品" onClick={() => select(selected - 1)}>
            <ArrowLeft size={16} />
          </button>
          <span>{String(selected + 1).padStart(2, '0')} / 10</span>
          <button aria-label="次の作品" onClick={() => select(selected + 1)}>
            <ArrowRight size={16} />
          </button>
        </div>
        <span>DESIGN × TECHNOLOGY</span>
      </footer>
      <Dialog open={info} onOpenChange={setInfo}>
        <DialogContent className="demo-dialog">
          <DialogTitle>WEB EXPERIENCE LAB</DialogTitle>
          <DialogDescription>
            WEB制作の表現と操作を試せるショールームです。10作品それぞれに独立したページがあります。ブランド・商品・料金はすべて架空で、予約や購入の操作はデモです。
          </DialogDescription>
          <p>
            画面左の一覧から作品を選び、中央で操作できます。「サイトを開く」で個別ページへ移動します。
          </p>
          <a className="solid-button" href="/works/nova">
            企業サイトから見る <ArrowUpRight size={18} />
          </a>
        </DialogContent>
      </Dialog>
    </main>
  );
}
