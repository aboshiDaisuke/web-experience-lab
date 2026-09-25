'use client';
import { useEffect, useRef, useState } from 'react';
import { projects } from '@/lib/portfolio';

const ORG = '未来技術研究所';
const WORDS = ['未来', '技術', '研究所'];
const SERVICE = 'デジタル広報支援サービス';
const KIND = 'WEBSITE PORTFOLIO';
const TOTAL = `${projects.length}`;
const TOTAL_NAME = 'WORKS — ブラウザで動く制作サンプル';
const MAX_MS = 10000; // never hold the page longer than this, even if the tank is still loading
const RAYS = 12;
const DOTS = 16;

// Runs while the HTML is parsed, before first paint, so a skipped splash never shows for a
// frame. It plays whenever the top page is opened or reloaded; it stays away when the
// visitor comes back from a work or the guide inside the site, or follows a deep link
// (?ref=… from a work's consult button, or a #section). ?splash always plays it.
const decide = `(function(){var d=document.documentElement;try{var q=location.search,n=performance.getEntriesByType('navigation')[0],r=document.referrer,inner=false;try{var u=new URL(r);inner=u.origin===location.origin&&u.pathname!==location.pathname}catch(e){}var skip=!/[?&]splash/.test(q)&&(!!location.hash||/[?&]ref=/.test(q)||(inner&&!(n&&n.type==='reload')));d.dataset.splash=skip?'skip':'play'}catch(e){d.dataset.splash='play'}})();`;

export default function Splash() {
  const [phase, setPhase] = useState<'play' | 'out' | 'gone'>('play');
  const root = useRef<HTMLDivElement>(null);
  const leaveRef = useRef<() => void>(() => {});

  useEffect(() => {
    const html = document.documentElement;
    const el = root.current;
    if (html.dataset.splash === 'skip' || !el) {
      setPhase('gone');
      return;
    }
    html.style.overflow = 'hidden';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const q = <T extends Element>(s: string) => el.querySelector(s) as unknown as T;
    const qa = (s: string) => [...el.querySelectorAll<HTMLElement>(s)];
    let api: { exit: (done: () => void) => void; kill: () => void } | null = null;
    let titleDone = reduced;
    let leaving = false;
    let dead = false;
    let poll = 0;
    let fallback = 0;
    let finish = 0;

    const gone = () => {
      if (dead) return;
      html.dataset.splash = 'done';
      html.style.overflow = '';
      setPhase('gone');
    };
    const leave = () => {
      if (leaving) return;
      leaving = true;
      clearTimeout(poll);
      clearTimeout(fallback);
      html.dataset.splash = 'out';
      setPhase('out');
      if (api && !reduced) api.exit(gone);
      else finish = window.setTimeout(gone, 600);
    };
    leaveRef.current = leave;

    // Leave once the title has played and the aquarium behind is live (or it is taking too long).
    const check = () => {
      const live = !!document.querySelector('.st-hero.is-live, .st-hero.is-failed');
      if (titleDone && live) leave();
      else poll = window.setTimeout(check, 150);
    };
    fallback = window.setTimeout(leave, MAX_MS);
    if (reduced) poll = window.setTimeout(check, 1800);
    else
      import('@/lib/splash')
        .then(({ playSplash }) => {
          if (dead || leaving) return;
          api = playSplash(
            {
              root: el,
              stage: q('.sx-stage'),
              ring: q('.sx-ring'),
              rays: qa('.sx-ray'),
              bigs: qa('.sx-big'),
              org: qa('.sx-org span'),
              service: qa('.sx-service span'),
              bar: q('.sx-bar'),
              kind: qa('.sx-kind span'),
              num: q('.sx-num'),
              name: q('.sx-name'),
              count: q('.sx-count'),
              dots: qa('.sx-dot'),
              flash: q('.sx-flash'),
            },
            projects.map((p) => p.name),
            () => {
              titleDone = true;
              check();
            },
          );
        })
        .catch(() => {
          titleDone = true;
          check();
        });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') leave();
    };
    addEventListener('keydown', onKey);
    return () => {
      dead = true;
      api?.kill();
      clearTimeout(poll);
      clearTimeout(fallback);
      clearTimeout(finish);
      removeEventListener('keydown', onKey);
      html.style.overflow = '';
      html.dataset.splash = 'done';
    };
  }, []);

  if (phase === 'gone') return null;

  const skip = () => leaveRef.current();

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: decide }} suppressHydrationWarning />
      <div ref={root} className={`st-splash ${phase === 'out' ? 'is-out' : ''}`} onClick={skip}>
        <div className="st-splash-light" aria-hidden />
        <div className="sx-stage" role="img" aria-label={`${ORG} ${SERVICE} ウェブサイト ポートフォリオ`}>
          <div className="sx-burst" aria-hidden>
            <i className="sx-ring" />
            {Array.from({ length: RAYS }, (_, i) => (
              <i key={i} className="sx-ray" />
            ))}
            {Array.from({ length: DOTS }, (_, i) => (
              <i key={i} className="sx-dot" />
            ))}
          </div>
          <div className="sx-bigs" aria-hidden>
            {WORDS.map((w) => (
              <span key={w} className="sx-big">
                {w}
              </span>
            ))}
          </div>
          <div className="sx-card" aria-hidden>
            <p className="sx-org">
              {[...ORG].map((c, i) => (
                <span key={i}>{c}</span>
              ))}
            </p>
            <p className="sx-service">
              {[...SERVICE].map((c, i) => (
                <span key={i}>{c}</span>
              ))}
            </p>
            <p className="sx-kind">
              <i className="sx-bar" />
              {[...KIND].map((c, i) => (
                <span key={i}>{c === ' ' ? ' ' : c}</span>
              ))}
            </p>
            <p className="sx-count">
              <b className="sx-num">{TOTAL}</b>
              <span className="sx-name">{TOTAL_NAME}</span>
            </p>
          </div>
        </div>
        <i className="sx-flash" aria-hidden />
        <button
          type="button"
          className="st-splash-skip"
          onClick={(e) => {
            e.stopPropagation();
            skip();
          }}
        >
          スキップ
        </button>
      </div>
    </>
  );
}
