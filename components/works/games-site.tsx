'use client';
import '@/app/signatures/games.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Pause, Play, X, ChevronLeft, ChevronRight, ChevronUp, Package, PackageOpen, RotateCw, Plus, Gamepad2, Zap, Users, MapPin, Train } from 'lucide-react';
import { AGE, FACTS, FLOW, JOBS, NEWS, NEWS_CAT, PERKS, PROFILE, STAT_AXES, STUDIOS, TITLES, WORLDS, type NewsCat, type Title, type TitleId } from '@/lib/works/games/data';
import type { RunnerCtl, RunHud, RunEvent } from '@/lib/works/games/runner';
import type { ShelfCtl } from '@/lib/works/games/shelf';
import type { CrewCtl } from '@/lib/works/games/crew';

type Phase = 'boot' | 'title' | 'play' | 'pause' | 'continue' | 'over';
const HI_KEY = 'mirai-games-dash-hi';
const readHi = () => {
  try {
    return Number(localStorage.getItem(HI_KEY)) || 0;
  } catch {
    return 0;
  }
};
const writeHi = (n: number) => {
  try {
    localStorage.setItem(HI_KEY, String(n));
  } catch {
    /* storage unavailable (private mode etc.) */
  }
};
const pad = (n: number, l = 6) => String(Math.max(0, Math.floor(n))).padStart(l, '0');
const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export function Mark({ className = '' }: { className?: string }) {
  return (
    <svg className={`gm-mark ${className}`} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1.5" y="1.5" width="37" height="37" rx="10" />
      <path d="M10 28V13l10 9 10-9v15" />
      <circle cx="30" cy="30" r="2.6" />
    </svg>
  );
}

// ── the playable top page ───────────────────────────────────────────────────

function Arcade() {
  const hero = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<RunnerCtl | null>(null);
  const phaseRef = useRef<Phase>('boot');
  const [phase, setPhaseState] = useState<Phase>('boot');
  const [ready, setReady] = useState(false);
  const [noGl, setNoGl] = useState(false);
  const [hi, setHi] = useState(0);
  const [count, setCount] = useState(9);
  const [result, setResult] = useState({ score: 0, dist: 0, gems: 0, record: false });
  const [touch, setTouch] = useState(false);
  const [demoWorld, setDemoWorld] = useState(0);
  const scoreEl = useRef<HTMLSpanElement>(null);
  const livesEl = useRef<HTMLSpanElement>(null);
  const comboEl = useRef<HTMLSpanElement>(null);
  const worldEl = useRef<HTMLSpanElement>(null);
  const lettersEl = useRef<HTMLSpanElement>(null);
  const bannerEl = useRef<HTMLDivElement>(null);
  const inView = useRef(0);
  const reducedRef = useRef(false);

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
    const root = hero.current?.closest('.site-games');
    root?.classList.toggle('gm-playing', p === 'play' || p === 'pause');
  }, []);

  const banner = useCallback((html: string, cls = '') => {
    const b = bannerEl.current;
    if (!b) return;
    b.innerHTML = html;
    b.className = `gm-banner ${cls}`;
    void b.offsetWidth;
    b.classList.add('show');
  }, []);

  useEffect(() => {
    setHi(readHi());
    setTouch(matchMedia('(pointer: coarse)').matches);
    const el = host.current;
    if (!el) return;
    let dead = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    reducedRef.current = reduced;
    const narrow = matchMedia('(max-width: 760px)').matches;
    const cache: Record<string, string> = {};
    const put = (key: string, node: HTMLElement | null, v: string) => {
      if (!node || cache[key] === v) return;
      cache[key] = v;
      node.textContent = v;
    };
    const onHud = (h: RunHud) => {
      if (h.mode !== 'play') return;
      put('score', scoreEl.current, pad(h.score));
      put('combo', comboEl.current, h.combo > 1 ? `×${h.combo}` : '');
      if (livesEl.current && cache.lives !== String(h.lives)) {
        cache.lives = String(h.lives);
        livesEl.current.dataset.lives = String(h.lives);
      }
      if (lettersEl.current && cache.letters !== String(h.letters)) {
        cache.letters = String(h.letters);
        [...lettersEl.current.children].forEach((c, i) => c.classList.toggle('on', !!(h.letters & (1 << i))));
      }
      put('world', worldEl.current, WORLDS[h.world].name);
    };
    const onEvent = (e: RunEvent) => {
      const p = phaseRef.current;
      if (e.t === 'world') {
        if (p === 'play') banner(`<small>WORLD ${e.world + 1}</small><b>${WORLDS[e.world].name}</b><span>${WORLDS[e.world].jp}</span>`, 'world');
        else setDemoWorld(e.world);
      } else if (e.t === 'hit' && p === 'play') {
        livesEl.current?.classList.remove('hurt');
        void livesEl.current?.offsetWidth;
        livesEl.current?.classList.add('hurt');
      } else if (e.t === 'bonus') banner(`<b>${e.label}</b><span>+${e.pts.toLocaleString()}</span>`, 'bonus');
      else if (e.t === 'letter') {
        const ch = 'MIRAI'[e.index];
        banner(`<b class="letter">${ch}</b>`, 'letter');
      } else if (e.t === 'pause' && p === 'play') setPhase('pause');
      else if (e.t === 'over') {
        const prev = readHi();
        const record = e.score > prev;
        if (record) writeHi(e.score);
        setHi(Math.max(prev, e.score));
        setResult({ score: e.score, dist: e.dist, gems: e.gems, record });
        setCount(9);
        setPhase('continue');
      }
    };
    void import('@/lib/works/games/runner').then(({ mountRunner }) => {
      if (dead) return;
      const c = mountRunner(el, {
        reduced,
        narrow,
        onHud,
        onEvent,
        onReady: () => {
          setReady(true);
        },
      });
      if (!c) {
        setNoGl(true);
        setPhase('title');
        return;
      }
      ctl.current = c;
    });
    return () => {
      dead = true;
      ctl.current?.dispose();
      ctl.current = null;
      hero.current?.closest('.site-games')?.classList.remove('gm-playing');
    };
  }, [banner, setPhase]);

  // power on the tube when the hero is first seen, then show the title
  useEffect(() => {
    const s = hero.current;
    if (!s) return;
    const io = new IntersectionObserver(
      ([e]) => {
        inView.current = e.intersectionRatio;
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    io.observe(s);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!ready || phaseRef.current !== 'boot') return;
    ctl.current?.power();
    const t = setTimeout(() => setPhase('title'), reducedRef.current ? 0 : 1900);
    return () => clearTimeout(t);
  }, [ready, setPhase]);

  const start = useCallback(() => {
    if (!ctl.current) return;
    const s = hero.current;
    if (s && Math.abs(s.getBoundingClientRect().top) > 4) window.scrollTo({ top: scrollY + s.getBoundingClientRect().top, behavior: 'smooth' });
    ctl.current.start();
    setPhase('play');
    const hint = document.querySelector('.site-games .gm-keys');
    hint?.classList.remove('fade');
    void (hint as HTMLElement | null)?.offsetWidth;
    hint?.classList.add('fade');
  }, [setPhase]);
  const toTitle = useCallback(() => {
    ctl.current?.demo();
    setPhase('title');
  }, [setPhase]);
  const resume = useCallback(() => {
    ctl.current?.setPaused(false);
    setPhase('play');
  }, [setPhase]);
  const pause = useCallback(() => {
    ctl.current?.setPaused(true);
    setPhase('pause');
  }, [setPhase]);
  const quit = useCallback(() => {
    ctl.current?.setPaused(false);
    toTitle();
  }, [toTitle]);
  const toSite = useCallback(() => {
    toTitle();
    scrollToId('titles');
  }, [toTitle]);

  // continue countdown → game over → back to the title demo
  useEffect(() => {
    if (phase === 'continue') {
      if (count <= 0) {
        setPhase('over');
        return;
      }
      const t = setTimeout(() => setCount((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'over') {
      const t = setTimeout(toTitle, 6000);
      return () => clearTimeout(t);
    }
  }, [phase, count, setPhase, toTitle]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"], dialog, [role="dialog"]') || (t !== document.body && t.closest('button, a') && !t.closest('.gm-arcade')))) return;
      if (inView.current < 0.5) return;
      const p = phaseRef.current;
      const k = e.code;
      if (p === 'play') {
        if (k === 'ArrowLeft' || k === 'KeyA') ctl.current?.input('left');
        else if (k === 'ArrowRight' || k === 'KeyD') ctl.current?.input('right');
        else if (k === 'ArrowUp' || k === 'Space' || k === 'KeyW') ctl.current?.input('jump');
        else if (k === 'KeyP' || k === 'Escape') pause();
        else if (k === 'ArrowDown') {
          /* swallow so the page doesn't scroll mid-run */
        } else return;
        e.preventDefault();
        return;
      }
      if (t && t !== document.body && t.closest('button, a')) return;
      if (p === 'pause' && (k === 'Space' || k === 'Enter' || k === 'KeyP' || k === 'Escape')) {
        e.preventDefault();
        resume();
      } else if ((p === 'title' || p === 'continue' || p === 'over') && (k === 'Space' || k === 'Enter') && !noGl) {
        e.preventDefault();
        start();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [start, resume, pause, noGl]);

  // swipes while playing (touch-action is only disabled during play)
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== 'play' || e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest('button')) return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
      ctl.current?.input(dx < 0 ? 'left' : 'right');
      swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    } else if (dy < -28 && Math.abs(dy) > Math.abs(dx)) {
      ctl.current?.input('jump');
      swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 10) ctl.current?.input('jump');
  };
  const press = (a: 'left' | 'right' | 'jump') => (e: React.PointerEvent) => {
    e.preventDefault();
    ctl.current?.input(a);
  };

  const latest = NEWS[0];
  const playing = phase === 'play' || phase === 'pause';
  return (
    <section
      id="top"
      ref={hero}
      className={`gm-arcade is-${phase} ${ready ? 'is-ready' : ''} ${noGl ? 'no-gl' : ''} ${touch ? 'is-touch' : ''}`}
      aria-label="MIRAI GAMES トップ — 遊べるゲーム画面"
    >
      <div
        className="gm-screen"
        ref={host}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (swipe.current = null)}
        onClick={(e) => {
          if (touch || phaseRef.current !== 'title' || noGl) return;
          if ((e.target as HTMLElement).closest('button, a')) return;
          start();
        }}
        role="img"
        aria-label="ゲーム画面。3つのレーンを走るマシンを左右とジャンプで操作し、障害物をよけながら光る結晶を集めます。"
      />
      <div className="gm-fallback" aria-hidden="true" />
      <div className="gm-glass" aria-hidden="true" />

      {/* boot splash */}
      <div className="gm-splash" aria-hidden="true">
        <Mark />
        <p>
          MIRAI GAMES<span>未来ゲームス</span>
        </p>
      </div>

      {/* title screen */}
      <div className="gm-title" hidden={phase !== 'title'}>
        <div className="gm-logo">
          <p className="gm-presents">MIRAI GAMES PRESENTS</p>
          <p className="gm-gamelogo" aria-hidden="true">
            <span data-t="MIRAI">MIRAI</span>
            <span data-t="DASH">DASH</span>
          </p>
          <p className="gm-sub">自社タイトルの4つの世界を、駆け抜けろ。</p>
          {noGl ? (
            <p className="gm-nogl">お使いの環境では3D表示ができないため、ゲームは遊べません。タイトル一覧からご覧ください。</p>
          ) : touch ? (
            <button className="gm-start" onClick={start}>
              <Play size={18} fill="currentColor" /> 遊ぶ
              <small>スワイプで操作</small>
            </button>
          ) : (
            <button className="gm-start is-press" onClick={start}>
              PRESS START
              <small>SPACE またはクリック</small>
            </button>
          )}
          <p className="gm-hi">
            HI-SCORE <b>{pad(hi)}</b>
            {!touch && !noGl && <span>DEMO PLAY — {WORLDS[demoWorld].name}</span>}
          </p>
        </div>
        <div className="gm-corp">
          <p className="gm-kicker">未来ゲームス ／ 東京・福岡・札幌のゲームスタジオ</p>
          <h1>
            遊びで、明日を
            <br />
            すこし良くする。
          </h1>
          <div className="gm-corp-cta">
            <button onClick={() => scrollToId('titles')}>
              タイトル一覧 <ArrowRight size={16} />
            </button>
            <button className="ghost" onClick={() => scrollToId('recruit')}>
              採用情報
            </button>
          </div>
        </div>
        <button className="gm-ticker" onClick={() => scrollToId('news')}>
          <b>NEWS</b>
          <time>{latest.date}</time>
          <span>{latest.title}</span>
        </button>
        <p className="gm-scroll" aria-hidden="true">
          <ArrowDown size={14} /> SCROLL
        </p>
      </div>

      {/* in-game HUD */}
      <div className="gm-hud" hidden={!playing} aria-hidden="true">
        <div className="gm-hud-l">
          <p>
            SCORE <span ref={scoreEl}>000000</span>
          </p>
          <p className="hi">
            HI <span>{pad(hi)}</span>
          </p>
        </div>
        <p className="gm-hud-world">
          <span ref={worldEl}>{WORLDS[0].name}</span>
        </p>
        <div className="gm-hud-r">
          <span className="gm-lives" ref={livesEl} data-lives="3">
            <i />
            <i />
            <i />
          </span>
          <span className="gm-combo" ref={comboEl} />
        </div>
        <span className="gm-letters" ref={lettersEl}>
          {'MIRAI'.split('').map((c, i) => (
            <i key={i}>{c}</i>
          ))}
        </span>
      </div>
      <div className="gm-banner" ref={bannerEl} aria-hidden="true" />
      {playing && (
        <div className="gm-play-ui">
          <p className="gm-keys" aria-hidden="true">
            <kbd>←</kbd>
            <kbd>→</kbd> 移動　<kbd>SPACE</kbd> ジャンプ　<kbd>P</kbd> 一時停止
          </p>
          <button className="gm-pausebtn" onClick={phase === 'pause' ? resume : pause} aria-label={phase === 'pause' ? '再開' : '一時停止'}>
            {phase === 'pause' ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button className="gm-quit" onClick={quit} aria-label="ゲームをやめる">
            <X size={16} /> やめる
          </button>
          {touch && (
            <div className="gm-pad">
              <button onPointerDown={press('left')} aria-label="左へ">
                <ChevronLeft size={26} />
              </button>
              <button onPointerDown={press('jump')} aria-label="ジャンプ" className="jump">
                <ChevronUp size={26} />
              </button>
              <button onPointerDown={press('right')} aria-label="右へ">
                <ChevronRight size={26} />
              </button>
            </div>
          )}
        </div>
      )}
      {phase === 'pause' && (
        <div className="gm-modal" role="dialog" aria-label="一時停止中">
          <p className="gm-big">PAUSE</p>
          <div className="gm-modal-cta">
            <button onClick={resume}>
              <Play size={16} /> つづける
            </button>
            <button className="ghost" onClick={quit}>
              タイトルへ
            </button>
          </div>
        </div>
      )}
      {phase === 'continue' && (
        <div className="gm-modal gm-continue" role="dialog" aria-label="コンティニュー">
          <p className="gm-big">CONTINUE?</p>
          <p className="gm-count" aria-live="polite">
            {count}
          </p>
          <dl className="gm-result">
            <div>
              <dt>SCORE</dt>
              <dd>{pad(result.score)}</dd>
            </div>
            <div>
              <dt>DISTANCE</dt>
              <dd>{result.dist.toLocaleString()} m</dd>
            </div>
            <div>
              <dt>CRYSTALS</dt>
              <dd>{result.gems}</dd>
            </div>
          </dl>
          {result.record && <p className="gm-record">NEW RECORD!</p>}
          <div className="gm-modal-cta">
            <button onClick={start}>
              もう一度あそぶ <small>{touch ? '' : 'SPACE'}</small>
            </button>
            <button className="ghost" onClick={toSite}>
              サイトを見る <ArrowDown size={16} />
            </button>
          </div>
          <p className="gm-note">遊んでくれて、ありがとう。つづきは、私たちのタイトルで。</p>
        </div>
      )}
      {phase === 'over' && (
        <div className="gm-modal gm-over" role="dialog" aria-label="ゲームオーバー">
          <p className="gm-big">GAME OVER</p>
          <p className="gm-note">THANK YOU FOR PLAYING</p>
          <div className="gm-modal-cta">
            <button onClick={toSite}>
              MIRAI GAMES のサイトへ <ArrowDown size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}


// ── shared helpers ─────────────────────────────────────────────────────────

const STATUS: Record<Title['status'], string> = { out: '発売中', soon: '発売予定', dev: '開発中' };
function useNear(ref: React.RefObject<HTMLElement | null>, margin = '600px') {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return near;
}
function SecHead({ en, jp, title, lead, id }: { en: string; jp: string; title: React.ReactNode; lead?: React.ReactNode; id?: string }) {
  return (
    <header className="gm-head">
      <p className="gm-eyebrow">
        <b>{en}</b>
        <span>{jp}</span>
      </p>
      <h2 id={id}>{title}</h2>
      {lead && <p className="gm-lead">{lead}</p>}
    </header>
  );
}
function AgeBadge({ age }: { age: Title['age'] }) {
  const a = AGE[age];
  return (
    <span className="gm-age" style={{ ['--age' as string]: a.color }} title={`年齢区分：${a.jp}（架空の表記）`}>
      <b>{a.label}</b>
      <small>PLAY AGE</small>
    </span>
  );
}

// ── titles: the package shelf ───────────────────────────────────────────────

function Titles({ pick, setPick, thumbs, onInquiry }: { pick: TitleId; setPick: (id: TitleId) => void; thumbs: Record<string, string>; onInquiry: (s?: string) => void }) {
  const sec = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<ShelfCtl | null>(null);
  const near = useNear(sec);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [noGl, setNoGl] = useState(false);
  const idx = TITLES.findIndex((t) => t.id === pick);
  const t = TITLES[idx];
  const setPickRef = useRef(setPick);
  useEffect(() => {
    setPickRef.current = setPick;
  }, [setPick]);

  useEffect(() => {
    if (!near) return;
    const el = host.current;
    if (!el) return;
    let dead = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrow = matchMedia('(max-width: 760px)').matches;
    void import('@/lib/works/games/shelf').then(({ mountShelf }) => {
      if (dead) return;
      const c = mountShelf(el, {
        titles: TITLES,
        reduced,
        narrow,
        onSelect: (i) => setPickRef.current(TITLES[i].id),
        onOpen: setOpen,
        onReady: () => setReady(true),
      });
      if (!c) setNoGl(true);
      ctl.current = c;
    });
    return () => {
      dead = true;
      ctl.current?.dispose();
      ctl.current = null;
    };
  }, [near]);
  useEffect(() => {
    ctl.current?.select(idx);
    setOpen(false);
  }, [idx]);
  const go = (d: number) => setPick(TITLES[(idx + d + TITLES.length) % TITLES.length].id);
  const toggle = () => {
    const o = !open;
    setOpen(o);
    ctl.current?.setOpen(o);
  };

  return (
    <section id="titles" ref={sec} className="gm-sec gm-titles" aria-labelledby="gm-titles-h">
      <SecHead
        en="TITLES"
        jp="タイトル"
        id="gm-titles-h"
        title={
          <>
            世界はいつも、
            <br />
            ケースの中にある。
          </>
        }
        lead="これまでに生み出した27本のうち、いま遊べる・もうすぐ遊べる6本です。パッケージに触れて、回して、開けてみてください。"
      />
      <div className="gm-shelf">
        <div className={`gm-stage ${ready ? 'is-ready' : ''} ${noGl ? 'no-gl' : ''}`}>
          <div className="gm-stage-gl" ref={host} role="img" aria-label={`ゲームのパッケージが並ぶ棚。選択中：${t.en}。ドラッグで回転、クリックでケースを開けます。`} />
          {noGl && thumbs[t.id] && <img className="gm-stage-flat" src={thumbs[t.id]} alt={`${t.en} のパッケージ`} />}
          <button className="gm-arrow prev" onClick={() => go(-1)} aria-label="前のタイトル">
            <ChevronLeft size={22} />
          </button>
          <button className="gm-arrow next" onClick={() => go(1)} aria-label="次のタイトル">
            <ChevronRight size={22} />
          </button>
          <div className="gm-stage-ctl">
            <button onClick={toggle} aria-pressed={open} disabled={noGl}>
              {open ? <Package size={17} /> : <PackageOpen size={17} />}
              {open ? 'ケースを閉じる' : 'ケースを開ける'}
            </button>
            <button onClick={() => ctl.current?.flip()} disabled={open || noGl}>
              <RotateCw size={16} /> 裏面を見る
            </button>
          </div>
          <p className="gm-stage-hint" aria-hidden="true">
            ドラッグで回転 ／ タップ・クリックで開く
          </p>
        </div>
        <article className="gm-detail" aria-live="polite" key={t.id}>
          <p className="gm-detail-top">
            <span className={`gm-st s-${t.status}`}>{STATUS[t.status]}</span>
            <span>{t.genre}</span>
          </p>
          <h3>
            {t.en}
            <small>{t.jp}</small>
          </h3>
          <p className="gm-tagline">{t.tagline}</p>
          <p className="gm-desc">{t.desc}</p>
          <ul className="gm-points">
            {t.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <dl className="gm-spec">
            <div>
              <dt>対応機種</dt>
              <dd className="plat">
                {t.platforms.map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </dd>
            </div>
            <div>
              <dt>発売日</dt>
              <dd className="mono">{t.release}</dd>
            </div>
            <div>
              <dt>価格</dt>
              <dd>{t.price}</dd>
            </div>
            <div>
              <dt>プレイ人数</dt>
              <dd>{t.players}</dd>
            </div>
            <div>
              <dt>年齢区分</dt>
              <dd className="age">
                <AgeBadge age={t.age} /> {AGE[t.age].jp}
              </dd>
            </div>
          </dl>
          <div className="gm-detail-cta">
            <button className="gm-btn" onClick={() => onInquiry(`タイトル『${t.en}（${t.jp}）』について（取材・販売・コラボレーションのご相談）`)}>
              このタイトルのお問い合わせ <ArrowRight size={16} />
            </button>
          </div>
        </article>
      </div>
      <div className="gm-rail" role="group" aria-label="タイトルを選ぶ">
        {TITLES.map((x) => (
          <button key={x.id} aria-pressed={x.id === pick} onClick={() => setPick(x.id)}>
            <span className="gm-rail-img">{thumbs[x.id] ? <img src={thumbs[x.id]} alt="" /> : <i style={{ background: x.pal[0] }} />}</span>
            <span className="gm-rail-t">
              <b>{x.en}</b>
              <small>
                {STATUS[x.status]}・{x.release}
              </small>
            </span>
          </button>
        ))}
      </div>
      <p className="gm-fine">対応機種「LUMEN 5」「LUMEN Pocket」、年齢区分「PLAY AGE」は、この制作サンプルのための架空の表記です。</p>
    </section>
  );
}

// ── news ─────────────────────────────────────────────────────────────────

function NewsSec({ onPick, pickup }: { onPick: (id: TitleId) => void; pickup?: string }) {
  const [cat, setCat] = useState<'all' | NewsCat>('all');
  const [openI, setOpenI] = useState<string | null>(null);
  const list = NEWS.filter((n) => cat === 'all' || n.cat === cat);
  const top = NEWS[0];
  return (
    <section id="news" className="gm-sec gm-news" aria-labelledby="gm-news-h">
      <SecHead en="NEWS" jp="ニュース" id="gm-news-h" title="最新情報" />
      <div className="gm-news-grid">
        <button className="gm-pickup" onClick={() => top.ref && onPick(top.ref)}>
          <span className="gm-pickup-img">{pickup ? <img src={pickup} alt="" /> : <i />}</span>
          <span className="gm-pickup-body">
            <span className="gm-pickup-tag">PICK UP</span>
            <time>{top.date}</time>
            <b>{top.title}</b>
            <span className="gm-pickup-go">
              パッケージを見る <ArrowRight size={15} />
            </span>
          </span>
        </button>
        <div className="gm-news-list">
          <div className="gm-tabs" role="group" aria-label="カテゴリで絞り込む">
            <button aria-pressed={cat === 'all'} onClick={() => setCat('all')}>
              すべて
            </button>
            {(Object.keys(NEWS_CAT) as NewsCat[]).map((k) => (
              <button key={k} aria-pressed={cat === k} onClick={() => setCat(k)}>
                {NEWS_CAT[k].jp}
              </button>
            ))}
          </div>
          <ul>
            {list.map((n) => {
              const key = n.date + n.title;
              const isOpen = openI === key;
              return (
                <li key={key} className={isOpen ? 'open' : ''}>
                  <button aria-expanded={isOpen} onClick={() => setOpenI(isOpen ? null : key)}>
                    <time>{n.date}</time>
                    <span className={`gm-cat c-${n.cat}`}>{NEWS_CAT[n.cat].jp}</span>
                    <span className="gm-news-t">{n.title}</span>
                    <Plus size={18} className="gm-news-plus" aria-hidden="true" />
                  </button>
                  <div className="gm-news-body" hidden={!isOpen}>
                    <p>{n.body}</p>
                    {n.ref && (
                      <button className="gm-link" onClick={() => onPick(n.ref!)}>
                        タイトルのページへ <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ── company + studios ───────────────────────────────────────────────────────

function CountUp({ to, from, run, comma }: { to: number; from: number; run: boolean; comma?: boolean }) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (!run) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 1400);
      const e = 1 - Math.pow(1 - k, 4);
      setV(Math.round(from + (to - from) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to, from]);
  return <>{comma ? v.toLocaleString('ja-JP') : v}</>;
}

const STUDIO_ART: Record<string, React.ReactNode> = {
  tokyo: (
    <svg viewBox="0 0 320 140" aria-hidden="true">
      <path className="f1" d="M0 140V96h26V70h30v26h18V54h34v86zM196 140V80h28V60h26v24h22V90h48v50z" />
      <path className="f2" d="M140 140l14-64h4l-3-18h2l3-30h2l3 30h2l-3 18h4l14 64z" />
      <path className="ln" d="M147 108h26M150 92h20M154 76h12" />
      <circle className="dot" cx="160" cy="26" r="3" />
    </svg>
  ),
  fukuoka: (
    <svg viewBox="0 0 320 140" aria-hidden="true">
      <circle className="sun" cx="250" cy="44" r="22" />
      <path className="f2" d="M92 112l12-86h8l12 86z" />
      <path className="ln" d="M102 50h12M100 70h16M98 90h20" />
      <path className="f1" d="M0 118c20-8 40-8 60 0s40 8 60 0 40-8 60 0 40 8 60 0 40-8 60 0 40 8 60 0v22H0z" />
      <path className="wave" d="M0 128c20-8 40-8 60 0s40 8 60 0 40-8 60 0 40 8 60 0 40-8 60 0" />
    </svg>
  ),
  sapporo: (
    <svg viewBox="0 0 320 140" aria-hidden="true">
      <path className="f1" d="M0 140l70-80 36 36 50-62 70 76 30-24 64 54z" />
      <path className="snow" d="M106 96l50-62 18 20-12 6-10-10-12 14zM226 110l30-24 16 13-10 4z" />
      <g className="flake">
        <path d="M60 30v20M50 40h20M53 33l14 14M67 33L53 47" />
        <path d="M270 24v14M263 31h14M265 26l10 10M275 26l-10 10" />
        <path d="M200 16v10M195 21h10" />
      </g>
    </svg>
  ),
};

function Company() {
  const facts = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);
  useEffect(() => {
    const el = facts.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setRun(true), io.disconnect()), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section id="company" className="gm-sec gm-company" aria-labelledby="gm-company-h">
      <SecHead en="COMPANY" jp="会社情報" id="gm-company-h" title={<>遊びで、<wbr />明日をすこし<wbr />良くする。</>} />
      <div className="gm-mission">
        <p className="gm-mission-lead">
          ゲームを遊んだあとの帰り道が、ほんの少し楽しくなる。
          <br />
          そんな一本を、毎年ひとつずつ。
        </p>
        <p>
          未来ゲームスは2009年に、6人のゲーム好きが東京の小さな部屋で始めた会社です。いまは3つの拠点で214人が働き、家庭用ゲーム機・PC・スマートフォン向けに27本のタイトルを送り出してきました。大きさよりも「10年後も語られるか」を基準に、つくるものを選んでいます。
        </p>
      </div>
      <div className="gm-facts" ref={facts}>
        {FACTS.map((f) => (
          <p key={f.label}>
            <b>
              <CountUp to={f.v} from={f.unit === '年' ? f.v - 17 : 0} run={run} comma={f.fmt === 'comma'} />
              <small>{f.unit}</small>
            </b>
            <span>{f.label}</span>
          </p>
        ))}
      </div>
      <ul className="gm-values">
        {[
          [Gamepad2, 'プレイヤーから考える', '企画会議の最初の質問は、いつも「遊んだ人は、どんな顔をする？」です。'],
          [Zap, '小さく作って、早く遊ぶ', '仕様書より先に、触れる試作を。毎週金曜は、全員で試遊する日です。'],
          [Users, '職種を越えて、ひとつのチーム', 'プログラマーもサウンドも、同じ机で同じゲームを遊んで話します。'],
        ].map(([Icon, h, p], i) => {
          const I = Icon as typeof Zap;
          return (
            <li key={i}>
              <I size={22} aria-hidden="true" />
              <b>{h as string}</b>
              <span>{p as string}</span>
            </li>
          );
        })}
      </ul>

      <h3 className="gm-subh">
        <b>STUDIOS</b> 3つのスタジオ
      </h3>
      <ul className="gm-studios">
        {STUDIOS.map((s, i) => (
          <li key={s.id} className={`st-${s.id}`}>
            <div className="gm-studio-art">
              {STUDIO_ART[s.id]}
              <span className="gm-studio-no">STAGE {i + 1}</span>
            </div>
            <div className="gm-studio-body">
              <p className="gm-studio-en">{s.en}</p>
              <h4>{s.name}</h4>
              <p className="gm-studio-focus">{s.focus}</p>
              <dl>
                <div>
                  <dt>人数</dt>
                  <dd>{s.people}名</dd>
                </div>
                <div>
                  <dt>代表作</dt>
                  <dd>{s.titles.join('／')}</dd>
                </div>
              </dl>
              <p className="gm-studio-note">{s.note}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="gm-profile">
        <div>
          <h3 className="gm-subh">
            <b>PROFILE</b> 会社概要
          </h3>
          <dl>
            {PROFILE.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="gm-access">
          <h3 className="gm-subh">
            <b>ACCESS</b> 本社へのアクセス
          </h3>
          <svg viewBox="0 0 360 220" className="gm-map" role="img" aria-label="本社周辺の案内図（架空の町）">
            <rect width="360" height="220" rx="14" className="bg" />
            <path className="blk" d="M20 20h90v60H20zM130 20h110v40H130zM260 20h80v90h-80zM20 100h70v100H20zM110 120h120v80H110zM250 130h90v70h-90z" />
            <path className="rail" d="M0 94h360" />
            <path className="rail-t" d="M0 94h360" />
            <path className="road" d="M120 0v220M244 0v220M0 110h360" />
            <rect x="190" y="84" width="46" height="20" rx="5" className="stn" />
            <text x="213" y="98" className="stn-t">
              星見台
            </text>
            <path className="route" d="M213 104v10h31v24" />
            <circle cx="244" cy="146" r="16" className="pin-glow" />
            <path d="M244 146l-8-14a9 9 0 1 1 16 0z" className="pin" />
            <text x="262" y="160" className="lbl">
              MIRAI TOWER
            </text>
          </svg>
          <p>
            <MapPin size={16} aria-hidden="true" /> 東京都みらい区星見台2-8-1 MIRAI TOWER 12F
          </p>
          <p>
            <Train size={16} aria-hidden="true" /> みらい線「星見台駅」A2出口から徒歩3分
          </p>
          <p className="gm-fine">地図・住所は架空の町のものです。</p>
        </div>
      </div>
    </section>
  );
}

// ── recruit: character select ───────────────────────────────────────────────

function useTween(target: readonly number[], ms = 420) {
  const [v, setV] = useState<number[]>([...target]);
  const from = useRef<number[]>([...target]);
  const key = target.join(',');
  useEffect(() => {
    const to = key.split(',').map(Number);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = to;
      setV(to);
      return;
    }
    const f = [...from.current];
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = to.map((x, i) => f[i] + (x - f[i]) * e);
      from.current = cur;
      setV(cur);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, ms]);
  return v;
}

function Radar({ stats, color }: { stats: readonly number[]; color: string }) {
  const v = useTween(stats);
  const R = 92;
  const C = 120;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
    return [C + Math.cos(a) * r, C + Math.sin(a) * r];
  };
  const poly = (r: (i: number) => number) =>
    Array.from({ length: 6 }, (_, i) => pt(i, r(i)))
      .map((p) => p.map((n) => n.toFixed(1)).join(','))
      .join(' ');
  return (
    <svg viewBox="0 0 240 240" className="gm-radar" role="img" aria-label={STAT_AXES.map(([jp], i) => `${jp} ${stats[i]}`).join('、')}>
      {[1, 0.75, 0.5, 0.25].map((k) => (
        <polygon key={k} points={poly(() => R * k)} className="grid" />
      ))}
      {STAT_AXES.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={C} y1={C} x2={x} y2={y} className="grid" />;
      })}
      <polygon points={poly((i) => (R * v[i]) / 10)} className="val" style={{ ['--c' as string]: color }} />
      {STAT_AXES.map(([jp, en], i) => {
        const [x, y] = pt(i, R + 18);
        return (
          <text key={en} x={x} y={y} className="ax">
            <tspan x={x} dy={-5}>
              {jp}
            </tspan>
            <tspan x={x} dy={14} className="en">
              {en}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

function Recruit({ onInquiry }: { onInquiry: (s?: string) => void }) {
  const sec = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<CrewCtl | null>(null);
  const near = useNear(sec);
  const [sel, setSel] = useState(0);
  const [ready, setReady] = useState(false);
  const [noGl, setNoGl] = useState(false);
  const [faces, setFaces] = useState<string[]>([]);
  const job = JOBS[sel];
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!near) return;
    const el = host.current;
    if (!el) return;
    let dead = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrow = matchMedia('(max-width: 760px)').matches;
    void import('@/lib/works/games/crew').then(({ mountCrew }) => {
      if (dead) return;
      const c = mountCrew(el, { jobs: JOBS, reduced, narrow, onReady: () => setReady(true), onPortraits: setFaces });
      if (!c) setNoGl(true);
      ctl.current = c;
    });
    return () => {
      dead = true;
      ctl.current?.dispose();
      ctl.current = null;
    };
  }, [near]);
  useEffect(() => {
    ctl.current?.select(sel);
  }, [sel]);
  const onKeys = (e: React.KeyboardEvent) => {
    const cols = matchMedia('(max-width: 760px)').matches ? 3 : 6;
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : 0;
    if (!d) return;
    e.preventDefault();
    const n = (sel + d + JOBS.length) % JOBS.length;
    setSel(n);
    tiles.current[n]?.focus();
  };

  return (
    <section id="recruit" ref={sec} className="gm-sec gm-recruit" aria-labelledby="gm-recruit-h" style={{ ['--job' as string]: job.color }}>
      <SecHead
        en="RECRUIT"
        jp="採用情報"
        id="gm-recruit-h"
        title={
          <>
            つぎのプレイヤーは、
            <br />
            あなたです。
          </>
        }
        lead="6つの職種で、仲間を募集しています。キャラクターを選ぶと、その仕事の能力値・仕事内容・求める経験・1日の流れが見られます。"
      />
      <div className="gm-select">
        <div className="gm-select-l">
        <div className={`gm-arena ${ready ? 'is-ready' : ''}`}>
          <p className="gm-p1">
            <b>1P</b> SELECT YOUR CLASS
          </p>
          <div className="gm-arena-gl" ref={host} role="img" aria-label={`${job.jp}（${job.cls}）のキャラクター。ドラッグで回転できます。`} />
          {noGl && faces.length === 0 && (
            <div className="gm-arena-flat" aria-hidden="true">
              {job.cls[0]}
            </div>
          )}
          <div className="gm-plate">
            <p className="gm-plate-cls">{job.cls}</p>
            <p className="gm-plate-jp">
              {job.clsJp}
              <span>／</span>
              <b>{job.jp}</b>
            </p>
          </div>
        </div>
        <div className="gm-roster" role="radiogroup" aria-label="職種を選ぶ" onKeyDown={onKeys}>
          {JOBS.map((j, i) => (
            <button
              key={j.id}
              ref={(n) => {
                tiles.current[i] = n;
              }}
              role="radio"
              aria-label={`${j.jp}（${j.cls}）`}
              aria-checked={i === sel}
              tabIndex={i === sel ? 0 : -1}
              onClick={() => setSel(i)}
              style={{ ['--c' as string]: j.color }}
            >
              <span className="gm-face">{faces[i] ? <img src={faces[i]} alt="" /> : <i>{j.cls[0]}</i>}</span>
              <span className="gm-tile-t">
                <b>{j.short}</b>
                <small>{j.cls}</small>
              </span>
              {i === sel && <span className="gm-cursor" aria-hidden="true">1P</span>}
            </button>
          ))}
        </div>
        </div>
        <div className="gm-status" aria-live="polite">
          <div className="gm-status-top">
            <Radar stats={job.stats} color={job.color} />
            <ul className="gm-bars">
              {STAT_AXES.map(([jp, en], i) => (
                <li key={en}>
                  <span>
                    {jp}
                    <small>{en}</small>
                  </span>
                  <i>
                    <em style={{ width: `${job.stats[i] * 10}%` }} />
                  </i>
                  <b>{job.stats[i]}</b>
                </li>
              ))}
            </ul>
          </div>
          <div className="gm-special">
            <span>SPECIAL</span>
            <b>{job.special[0]}</b>
            <p>{job.special[1]}</p>
          </div>
          <p className="gm-job-lead">{job.lead}</p>
          <div className="gm-job-cols">
            <div>
              <h4>仕事内容</h4>
              <ul className="gm-dots">
                {job.work.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>求める経験</h4>
              <p className="gm-req">必須</p>
              <ul className="gm-dots">
                {job.must.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="gm-req want">歓迎</p>
              <ul className="gm-dots">
                {job.want.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="gm-day">
            <h4>1日の流れ</h4>
            <ol>
              {job.day.map(([tm, d]) => (
                <li key={tm + d}>
                  <time>{tm}</time>
                  <span>{d}</span>
                </li>
              ))}
            </ol>
          </div>
          <dl className="gm-terms">
            <div>
              <dt>雇用形態</dt>
              <dd>正社員（試用期間3か月）</dd>
            </div>
            <div>
              <dt>勤務地</dt>
              <dd>{job.place}</dd>
            </div>
            <div>
              <dt>給与</dt>
              <dd>{job.pay}（経験・能力に応じて決定）</dd>
            </div>
          </dl>
          <button className="gm-entry" onClick={() => onInquiry(`採用エントリー：${job.jp}（${job.cls}）／正社員・${job.place}`)}>
            <span>
              <small>PRESS START ／ {job.jp}</small>
              この職種でエントリー
            </span>
            <ArrowRight size={20} />
          </button>
        </div>
      </div>

      <div className="gm-recruit-more">
        <div>
          <h3 className="gm-subh">
            <b>ITEMS</b> はたらく環境
          </h3>
          <ul className="gm-perks">
            {PERKS.map(([h, p]) => (
              <li key={h}>
                <b>{h}</b>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="gm-subh">
            <b>ROUTE</b> 選考の流れ
          </h3>
          <ol className="gm-flow">
            {FLOW.map((f, i) => (
              <li key={f}>
                <span>STAGE {i + 1}</span>
                <b>{f}</b>
              </li>
            ))}
          </ol>
          <p className="gm-flow-note">応募から内定まで、およそ3〜5週間です。実技課題は職種ごとに内容が異なり、提出まで1週間あります。</p>
        </div>
      </div>
    </section>
  );
}

export default function GamesSite({ onInquiry }: { onInquiry: (summary?: string) => void }) {
  const [pick, setPick] = useState<TitleId>('neon');
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [pickup, setPickup] = useState<string>();
  useEffect(() => {
    let dead = false;
    const run = async () => {
      const A = await import('@/lib/works/games/art');
      await A.artFonts();
      if (dead) return;
      const out: Record<string, string> = {};
      for (const t of TITLES) {
        out[t.id] = A.coverThumb(t, 300);
        await new Promise((r) => setTimeout(r, 0));
        if (dead) return;
      }
      setThumbs(out);
      const k = A.keyArt('neon');
      const cv = document.createElement('canvas');
      cv.width = 640;
      cv.height = 400;
      cv.getContext('2d')!.drawImage(k, 0, 200, 640, 400, 0, 0, 640, 400);
      setPickup(cv.toDataURL('image/jpeg', 0.85));
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => void run(), { timeout: 2500 });
    else setTimeout(() => void run(), 1200);
    return () => {
      dead = true;
    };
  }, []);
  const showTitle = (id: TitleId) => {
    setPick(id);
    scrollToId('titles');
  };
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Unbounded:wght@500;700;800;900&display=swap"
        precedence="default"
      />
      <Arcade />
      <Titles pick={pick} setPick={setPick} thumbs={thumbs} onInquiry={onInquiry} />
      <NewsSec onPick={showTitle} pickup={pickup} />
      <Company />
      <Recruit onInquiry={onInquiry} />
    </>
  );
}
