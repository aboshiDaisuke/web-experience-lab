'use client';
import { useEffect, useRef, useState } from 'react';
import { projects } from '@/lib/portfolio';
import { BASE } from '@/lib/base-path';
import { createSplashSound } from '@/lib/splash-sound';

const ORG = '未来技術研究所';
const SLICES = 6;
const LINES = ['デジタル広報', '支援サービス'];
const EM = new Set([4, 5]); // 広報, set in vermilion
const BAR = 3; // the ー of サービス, which the camera flies into
const TOTAL = projects.length;
const ARIA = '未来技術研究所 デジタル広報支援サービス ウェブサイト ポートフォリオ';
const MAX_MS = 10000; // never hold the page longer than this, even if the tank is still loading

// Runs while the HTML is parsed, before first paint, so a skipped splash never shows for a
// frame. It plays whenever the top page is opened or reloaded; it stays away when the
// visitor comes back from a work or the guide inside the site, or follows a deep link
// (?ref=… from a work's consult button, or a #section). ?splash always plays it.
const decide = `(function(){var d=document.documentElement;try{var q=location.search,n=performance.getEntriesByType('navigation')[0],r=document.referrer,inner=false;try{var u=new URL(r);inner=u.origin===location.origin&&u.pathname!==location.pathname}catch(e){}var skip=!/[?&]splash/.test(q)&&(!!location.hash||/[?&]ref=/.test(q)||(inner&&!(n&&n.type==='reload')));d.dataset.splash=skip?'skip':'play'}catch(e){d.dataset.splash='play'}})();`;

export default function Splash() {
  const [phase, setPhase] = useState<'play' | 'out' | 'gone'>('play');
  const [sound, setSound] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const leaveRef = useRef<() => void>(() => {});
  const soundRef = useRef<() => void>(() => {});

  useEffect(() => {
    const html = document.documentElement;
    const el = root.current;
    if (html.dataset.splash === 'skip' || !el) {
      setPhase('gone');
      return;
    }
    html.style.overflow = 'hidden';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sfx = createSplashSound();
    let api: { exit: (done: () => void) => void; kill: () => void; restart: () => void } | null = null;
    let titleDone = reduced;
    let leaving = false;
    let dead = false;
    let poll = 0;
    let fallback = 0;
    let finish = 0;

    const gone = () => {
      sfx.dispose();
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
            el,
            projects.map((p) => p.name),
            () => {
              titleDone = true;
              check();
            },
            sfx,
          );
        })
        .catch(() => {
          titleDone = true;
          check();
        });

    // Sound stays off until the visitor asks: browsers keep audio silent before a click, and
    // turning it on replays the sequence from the top so the cues line up.
    soundRef.current = async () => {
      if (sfx.on) {
        sfx.mute();
        setSound(false);
        return;
      }
      const ok = await sfx.enable();
      setSound(ok);
      if (ok && api && !leaving) {
        titleDone = reduced;
        clearTimeout(poll);
        clearTimeout(fallback);
        fallback = window.setTimeout(leave, MAX_MS);
        api.restart();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('.st-splash-sound')) return;
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') leave();
    };
    addEventListener('keydown', onKey);
    return () => {
      dead = true;
      api?.kill();
      sfx.dispose();
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
      <i className="sp-lead" aria-hidden />
      <div ref={root} className={`st-splash ${phase === 'out' ? 'is-out' : ''}`} onClick={skip}>
        <div role="img" aria-label={ARIA} style={{ position: 'absolute', inset: 0 }}>
          <div aria-hidden>
            {['t', 'b', 'l', 'r'].map((k) => (
              <i key={k} className={`sp-rule ${k}`} />
            ))}
            <i className="sp-cross" />
            <p className="sp-corner tl">
              <span>未来技術研究所</span>
            </p>
            <p className="sp-corner tr">
              <span>2026</span>
            </p>
            <p className="sp-corner bl">
              <span>DIGITAL PR SUPPORT</span>
            </p>
            <p className="sp-corner br">
              <span>
                <b className="sp-cnt">00</b> / {TOTAL}
              </span>
            </p>
            <div className="sp-stage">
              {Array.from({ length: SLICES }, (_, i) => {
                const h = 100 / SLICES;
                return (
                  <p
                    key={i}
                    className="sp-big sp-slice"
                    style={{ clipPath: `inset(${Math.max(0, i * h - 0.2)}% 0 ${Math.max(0, (SLICES - 1 - i) * h - 0.2)}% 0)` }}
                  >
                    未来
                  </p>
                );
              })}
              <p className="sp-big sp-drop">
                <span>技</span>
                <span>術</span>
              </p>
              <p className="sp-big sp-row">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i}>研究所</span>
                ))}
              </p>
            </div>
            <div className="sp-title">
              {LINES.map((line, li) => (
                <p key={line} className="sp-line">
                  {[...line].map((c, i) => (
                    <span key={i} className={li === 0 && EM.has(i) ? 'em' : li === 1 && i === BAR ? 'bar' : undefined}>
                      {c}
                    </span>
                  ))}
                </p>
              ))}
              <div className="sp-sub">
                <span>
                  <i>WEBSITE PORTFOLIO</i>
                </span>
                <span>
                  <i>{TOTAL} WORKS</i>
                </span>
              </div>
            </div>
            <div className="sp-works">
              <b className="sp-num">01</b>
              <div className="sp-shotcol">
                <div className="sp-shot">
                  {projects.map((p) => (
                    <img key={p.slug} src={`${BASE}/images/works/${p.slug}-desktop.jpg`} alt="" decoding="async" />
                  ))}
                </div>
                <p className="sp-name" />
                <p className="sp-meter">
                  <i />
                </p>
              </div>
            </div>
            <div className="sp-final">
              <p className="sp-n">
                <b>{TOTAL}</b>
              </p>
              <div className="sp-fcol">
                <div className="sp-mosaic">
                  {projects.map((p) => (
                    <img key={p.slug} src={`${BASE}/images/works/${p.slug}-desktop.jpg`} alt="" decoding="async" />
                  ))}
                </div>
                <p className="sp-cap">
                  <span>WORKS — ブラウザで動く制作サンプル</span>
                </p>
              </div>
            </div>
            <div className="sp-frame f1">
              <span>{ORG}</span>
            </div>
            <div className="sp-frame f2">
              <span>{ORG}</span>
            </div>
            <div className="sp-frame f3">
              <span>
                {ORG}
                <small>DIGITAL PR SUPPORT</small>
              </span>
            </div>
          </div>
        </div>
        <div className="sp-ctrl">
          <button
            type="button"
            className="st-splash-sound"
            aria-pressed={sound}
            onClick={(e) => {
              e.stopPropagation();
              soundRef.current();
            }}
          >
            {sound ? '音を消す' : '音をつけて再生'}
          </button>
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
      </div>
    </>
  );
}
