'use client';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock, MapPin, Search, X, BookOpen } from 'lucide-react';
import {
  books,
  bookById,
  branches,
  callNumber,
  classes,
  fullTitle,
  layout,
  newArrivals,
  publishers,
  search,
  statusLabel,
  type Book,
} from '@/lib/works/library/catalog';
import { WD, events, fmtDate, liveStatus, monthGrid, type LiveStatus } from '@/lib/works/library/calendar';

type Inquiry = (summary?: string) => void;
type Css = CSSProperties & Record<`--${string}`, string | number>;

const DEMO = ['う', 'うち', 'うちゅ', 'うちゅう', '宇宙'];
const CHIPS = ['猫', '宇宙', '料理', '旅', '絵本'];
const BASE_DATE = new Date(2026, 8, 24, 15, 0);

/* ------------------------------------------------------------------ motifs */
function Motif({ name, color }: { name: string; color: string }) {
  const s = { fill: color } as const;
  const st = { fill: 'none', stroke: color, strokeWidth: 3, strokeLinecap: 'round' as const };
  switch (name) {
    case 'cat':
      return (
        <g>
          <path style={s} d="M31 93c-3-17 0-31 8-40l-4-22 11 10c4-1.6 9-1.6 13 0l11-10-4 22c8 9 11 23 8 40z" />
          <path style={st} d="M72 88c13-1 18-10 13-20" />
        </g>
      );
    case 'planet':
      return (
        <g>
          <circle style={s} cx="50" cy="50" r="20" />
          <ellipse style={st} cx="50" cy="50" rx="38" ry="11" transform="rotate(-18 50 50)" />
          <circle style={s} cx="83" cy="20" r="2.4" />
          <circle style={s} cx="16" cy="78" r="1.8" />
        </g>
      );
    case 'moon':
      return <path style={s} d="M62 14a36 36 0 1 0 22 58A30 30 0 1 1 62 14z" />;
    case 'star':
      return (
        <g>
          <path style={s} d="M50 12l9.5 25 26.5 1.5-20.5 17 7 26L50 67 27.5 81.5l7-26L14 38.5 40.5 37z" />
          <circle style={s} cx="84" cy="80" r="2.5" />
          <circle style={s} cx="18" cy="16" r="2" />
        </g>
      );
    case 'key':
      return (
        <g>
          <circle style={st} cx="30" cy="50" r="15" />
          <path style={st} d="M45 50h42M75 50v12M83 50v8" />
        </g>
      );
    case 'train':
      return (
        <g>
          <rect style={s} x="18" y="26" width="64" height="44" rx="10" />
          <rect x="26" y="34" width="20" height="14" rx="2" fill="rgba(255,255,255,.55)" />
          <rect x="54" y="34" width="20" height="14" rx="2" fill="rgba(255,255,255,.55)" />
          <circle style={s} cx="32" cy="78" r="6" />
          <circle style={s} cx="68" cy="78" r="6" />
          <path style={st} d="M8 88h84" />
        </g>
      );
    case 'bread':
      return (
        <g>
          <path style={s} d="M16 62c0-20 16-32 34-32s34 12 34 32v12H16z" />
          <path style={{ ...st, stroke: 'rgba(255,255,255,.55)' }} d="M36 44l6 10M50 40l4 12M64 44l2 10" />
        </g>
      );
    case 'cup':
      return (
        <g>
          <path style={s} d="M22 40h46v22c0 12-10 22-23 22s-23-10-23-22z" />
          <path style={st} d="M68 46c12 0 12 16 0 16M36 30c0-6 6-6 6-12M52 30c0-6 6-6 6-12" />
        </g>
      );
    case 'bowl':
      return (
        <g>
          <path style={s} d="M14 50h72c0 20-16 32-36 32S14 70 14 50z" />
          <path style={st} d="M38 40c0-6 6-6 6-12M56 40c0-6 6-6 6-12M24 22l30 22M34 18l26 24" />
        </g>
      );
    case 'note':
      return (
        <g>
          <ellipse style={s} cx="34" cy="72" rx="12" ry="9" transform="rotate(-20 34 72)" />
          <ellipse style={s} cx="72" cy="64" rx="12" ry="9" transform="rotate(-20 72 64)" />
          <path style={{ ...st, strokeWidth: 4 }} d="M45 70V22l38-8v48" />
        </g>
      );
    case 'castle':
      return (
        <g>
          <path style={s} d="M30 36h40l8 10H22zM34 50h32l10 12H24zM28 66h44v20H28z" />
          <path style={s} d="M40 22h20l6 12H34z" />
        </g>
      );
    case 'column':
      return (
        <g>
          <path style={s} d="M14 30L50 12l36 18z" />
          <rect style={s} x="20" y="34" width="60" height="5" />
          {[24, 40, 56, 72].map((x) => (
            <rect key={x} style={s} x={x - 3} y="42" width="7" height="36" />
          ))}
          <rect style={s} x="14" y="80" width="72" height="7" />
        </g>
      );
    case 'flower':
      return (
        <g>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} style={s} cx="50" cy="30" rx="10" ry="16" transform={`rotate(${a} 50 48)`} />
          ))}
          <circle cx="50" cy="48" r="7" fill="rgba(255,255,255,.7)" />
          <path style={st} d="M50 64v28" />
        </g>
      );
    case 'leaf':
      return (
        <g>
          <path style={s} d="M50 90C18 70 20 30 50 10c30 20 32 60 0 80z" />
          <path style={{ ...st, stroke: 'rgba(255,255,255,.55)', strokeWidth: 2 }} d="M50 88V20M50 44l-12-8M50 58l14-10M50 70l-14-9" />
        </g>
      );
    case 'wave':
      return (
        <g>
          {[36, 52, 68].map((y) => (
            <path key={y} style={st} d={`M8 ${y}c10-10 20-10 28 0s18 10 28 0 20-10 28 0`} />
          ))}
        </g>
      );
    case 'compass':
      return (
        <g>
          <circle style={st} cx="50" cy="50" r="34" />
          <path style={s} d="M50 18l8 32-8 32-8-32z" />
          <circle cx="50" cy="50" r="4" fill="rgba(255,255,255,.8)" />
        </g>
      );
    case 'book':
      return (
        <g>
          <path style={s} d="M10 28c14-6 28-6 40 4v52c-12-10-26-10-40-4zM90 28c-14-6-28-6-40 4v52c12-10 26-10 40-4z" />
        </g>
      );
    case 'scroll':
      return (
        <g>
          <circle style={st} cx="50" cy="50" r="30" />
          <circle style={st} cx="50" cy="50" r="18" />
          <path style={st} d="M50 20v60M20 50h60" />
        </g>
      );
    case 'bird':
      return <path style={s} d="M14 58c16-2 24-14 36-14 8 0 12 4 16 8l14-4-8 10c0 14-14 24-30 24-12 0-22-6-28-24z" />;
    case 'cloud':
      return <path style={s} d="M24 70a14 14 0 0 1 2-28 20 20 0 0 1 38-6 16 16 0 0 1 12 34z" />;
    default:
      return (
        <g>
          <circle style={st} cx="50" cy="50" r="30" />
          <circle style={s} cx="50" cy="50" r="12" />
        </g>
      );
  }
}

function Pattern({ n, color }: { n: number; color: string }) {
  const id = `p${n}-${color.replace('#', '')}`;
  const shapes = [
    <circle key="a" cx="5" cy="5" r="1.6" fill={color} />,
    <path key="b" d="M0 10L10 0" stroke={color} strokeWidth="1.4" />,
    <path key="c" d="M0 5c2.5-3 5-3 7.5 0s5 3 7.5 0" stroke={color} fill="none" strokeWidth="1.1" />,
    <path key="d" d="M0 0h10M0 0v10" stroke={color} strokeWidth=".9" />,
    <circle key="e" cx="5" cy="5" r="3.6" stroke={color} fill="none" strokeWidth=".9" />,
    <rect key="f" width="5" height="5" fill={color} />,
  ];
  return (
    <svg className="lc-pattern" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <pattern id={id} width={n === 2 ? 15 : 10} height="10" patternUnits="userSpaceOnUse">
          {shapes[n % shapes.length]}
        </pattern>
      </defs>
      <rect width="100" height="100" fill={`url(#${id})`} />
    </svg>
  );
}

const KANJI_NUM = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
const shortAuthor = (a: string) => a.replace(/ 作／.*$/, '').replace(/ (監修|編|ほか)$/, '');

/* ------------------------------------------------------------------ cover */
const Cover = memo(function Cover({ b }: { b: Book }) {
  const style: Css = { '--c1': b.c1, '--c3': b.c3, '--band': b.c2 };
  const mark = publishers[b.pub] ?? '本';
  const tateCls = b.tate ? 'is-tate' : 'is-yoko';
  if (b.cover === 'series') {
    return (
      <span className={`lc lc-series ${b.gold ? 'is-gold' : ''}`} style={style}>
        <span className="lc-frame" />
        <span className="lc-s-title">{b.title}</span>
        <span className="lc-s-vol">{KANJI_NUM[b.vol ?? 1] ?? b.vol}</span>
        <span className="lc-s-sub">{b.sub}</span>
        <span className="lc-pub">{b.pub}</span>
      </span>
    );
  }
  if (b.cover === 'motif') {
    return (
      <span className={`lc lc-motif ${tateCls} ${b.cls === 10 ? 'is-ehon' : ''}`} style={style}>
        <svg className="lc-art" viewBox="0 0 100 100" aria-hidden>
          <Motif name={b.motif} color="var(--c3)" />
        </svg>
        <span className="lc-title">{b.title}</span>
        <span className="lc-author">{shortAuthor(b.author)}</span>
        <span className="lc-mark">{mark}</span>
      </span>
    );
  }
  if (b.cover === 'band') {
    return (
      <span className={`lc lc-band ${tateCls}`} style={style}>
        <span className="lc-field">
          <Pattern n={b.pattern} color={b.c3} />
          <svg className="lc-art" viewBox="0 0 100 100" aria-hidden>
            <Motif name={b.motif} color="var(--c1)" />
          </svg>
        </span>
        <span className="lc-plate">
          <span className="lc-title">{b.title}</span>
          <span className="lc-author">{shortAuthor(b.author)}</span>
        </span>
        <span className="lc-mark">{mark}</span>
      </span>
    );
  }
  if (b.cover === 'typo') {
    return (
      <span className={`lc lc-typo ${tateCls}`} style={style}>
        <span className="lc-giant" aria-hidden>
          {b.title.replace(/[ぁ-んァ-ン、。・ー 「」『』？]/g, '')[0] ?? b.title[0]}
        </span>
        <span className="lc-title">{b.title}</span>
        <span className="lc-author">{shortAuthor(b.author)}</span>
        <span className="lc-mark">{mark}</span>
      </span>
    );
  }
  return (
    <span className={`lc lc-frame-style ${tateCls}`} style={style}>
      <span className="lc-frame" />
      <span className="lc-title">{b.title}</span>
      <svg className="lc-art is-small" viewBox="0 0 100 100" aria-hidden>
        <Motif name={b.motif} color="var(--c3)" />
      </svg>
      <span className="lc-author">{shortAuthor(b.author)}</span>
      <span className="lc-mark">{mark}</span>
    </span>
  );
});

/* ------------------------------------------------------------------ spine */
function spineVars(b: Book): Css {
  const author = shortAuthor(b.author);
  const La = author.replace(/\s/g, '').length + 0.5;
  const fa = Math.min(b.t * 0.3, 6.2, (b.h * 0.24) / La);
  const titleLen = (b.series ? b.title : b.title).replace(/\s/g, '').length + (b.series ? 0 : 0.3);
  const avail = b.h - 62 - La * fa - (b.series ? 34 : 0);
  const ft = Math.max(3.2, Math.min(b.t * (b.spine === 'cloth' ? 0.44 : 0.52), 15, (avail / titleLen) * 0.94));
  return {
    '--t': b.t,
    '--h': b.h,
    '--d': b.d,
    '--c1': b.c1,
    '--c3': b.c3,
    '--band': b.c2,
    '--ft': ft.toFixed(2),
    '--fa': fa.toFixed(2),
    '--wear': b.wear.toFixed(2),
  };
}

const SpineFace = memo(function SpineFace({ b }: { b: Book }) {
  const [c, m, v] = callNumber(b);
  return (
    <span className={`ls ls-${b.spine} ${b.gold ? 'is-gold' : ''}`}>
      <span className="ls-deco" aria-hidden />
      <span className="ls-title">{b.series && b.spine !== 'series' ? b.title : b.title}</span>
      {b.series && (
        <>
          <span className="ls-vol">{b.vol}</span>
          <span className="ls-sub">{b.sub}</span>
        </>
      )}
      <span className="ls-author">{b.series && b.title !== '現代日本文学館' ? '' : shortAuthor(b.author)}</span>
      <span className="ls-label" aria-hidden>
        <i />
        <b>{c}</b>
        <b>{m}</b>
        {v && <b>{v}</b>}
      </span>
      {b.status.kind === 'ref' && <span className="ls-ref" aria-hidden>禁帯出</span>}
      <span className="ls-pub" aria-hidden>
        {publishers[b.pub] ?? '本'}
      </span>
      <span className="ls-light" aria-hidden />
    </span>
  );
});

/* Faces shown only while the book is pulled out */
function BookFaces({ b }: { b: Book }) {
  const front = <Cover b={b} />;
  const back = (
    <span className="lb-bcover" style={{ background: b.c1 }}>
      <span className="lb-barcode" aria-hidden>
        <i />
        <em>2 1{String(10000 + b.id * 37).slice(-5)} 0{b.cls}</em>
      </span>
    </span>
  );
  return (
    <>
      <span className="lb-side is-r" aria-hidden>
        {b.tate ? back : front}
      </span>
      <span className="lb-side is-l" aria-hidden>
        {b.tate ? front : back}
      </span>
      <span className="lb-cap is-top" aria-hidden />
      <span className="lb-cap is-bottom" aria-hidden />
    </>
  );
}

type BookProps = {
  b: Book;
  x: number;
  lean: number;
  face?: boolean;
  hit: boolean;
  order: number;
  away: boolean;
  focusId: number;
  onOpen: (id: number, el: HTMLElement) => void;
};
const ShelfBook = memo(function ShelfBook({ b, x, lean, face, hit, order, away, focusId, onOpen }: BookProps) {
  const vars: Css = {
    ...spineVars(b),
    '--x': x,
    '--lean': `${lean}deg`,
    '--dl': `${Math.min(order, 24) * 30}ms`,
  };
  return (
    <button
      type="button"
      className={`lb-book ${face ? 'is-face' : ''} ${hit ? 'is-hit' : ''} ${away ? 'is-away' : ''} ${b.tate ? 'is-tate' : ''}`}
      style={vars}
      data-id={b.id}
      tabIndex={focusId === b.id ? 0 : -1}
      aria-label={`${fullTitle(b)}　${b.author}　請求記号 ${callNumber(b).filter(Boolean).join(' ')}　${statusLabel(b.status)}`}
      onClick={(e) => onOpen(b.id, e.currentTarget)}
    >
      {face ? (
        <span className="lb-faceout">
          <Cover b={b} />
          <span className="lb-shade" />
        </span>
      ) : (
        <>
          <SpineFace b={b} />
          <span className="lb-shade" />
        </>
      )}
      {hit && !face && <BookFaces b={b} />}
    </button>
  );
});

/* ------------------------------------------------------------------ helpers */
const placedById = new Map(layout.placed.map((p) => [p.id, p]));
const sortedPlaced = [...layout.placed].sort((a, b) => a.x - b.x);
function bayOfX(x: number) {
  let cls = 0;
  for (const bay of layout.bays) if (x >= bay.x - 20) cls = bay.cls;
  return cls;
}
/** centre (mm) of the window of width `win` that holds the most x positions */
function densest(xs: number[], win: number) {
  const v = [...xs].sort((a, b) => a - b);
  let best = v[0] ?? 0;
  let bestN = 0;
  for (let i = 0, j = 0; i < v.length; i++) {
    while (v[i] - v[j] > win) j++;
    if (i - j + 1 > bestN) {
      bestN = i - j + 1;
      best = (v[i] + v[j]) / 2;
    }
  }
  return best;
}
// the shelf opens on the 天文・宇宙 bay (same position on the server and after hydration)
const INIT_CENTRE = densest(
  search('宇宙')
    .map((id) => placedById.get(id)!)
    .filter((pl) => bookById.get(pl.id)!.cls === 4)
    .map((pl) => pl.x),
  560,
);
const TRACK_STYLE = { '--W': layout.width, transform: `translate3d(calc(50vw - var(--u) * ${INIT_CENTRE.toFixed(1)}), 0, 0)` } as Css;
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const t0 = setTimeout(() => setNow(new Date()), 0);
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);
  return now;
}

/* ================================================================== site */
export default function LibrarySite({ onInquiry }: { onInquiry: Inquiry }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState(false);
  const [open, setOpen] = useState<{ id: number; rect: DOMRect; from: 'spine' | 'cover' } | null>(null);
  const [floorZone, setFloorZone] = useState<string | null>(null);
  const [floor, setFloor] = useState<1 | 2>(2);
  const now = useNow();

  const hits = useMemo(() => search(query), [query]);
  const openBook = useCallback((id: number, el: HTMLElement, from: 'spine' | 'cover' = 'spine') => {
    const target = from === 'spine' ? (el.querySelector('.ls, .lb-faceout') as HTMLElement | null) ?? el : el;
    setOpen({ id, rect: target.getBoundingClientRect(), from: el.classList.contains('is-face') ? 'cover' : from });
  }, []);

  useEffect(() => {
    const root = rootRef.current?.closest('.project-site') as HTMLElement | null;
    if (!root) return;
    let dead = false;
    const run = () =>
      void import('@/lib/works/library/textures').then(({ applyTextures }) => {
        if (!dead) applyTextures(root);
      });
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(run);
    else setTimeout(run, 30);
    return () => {
      dead = true;
    };
  }, []);

  const showOnMap = (zone: string) => {
    setOpen(null);
    setFloorZone(zone);
    if (zones[zone]) setFloor(zones[zone].floor);
    setTimeout(() => document.getElementById('floor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  return (
    <div ref={rootRef} className="lib-root">
      <Hero
        query={query}
        setQuery={setQuery}
        typing={typing}
        setTyping={setTyping}
        hits={hits}
        openId={open?.id ?? null}
        onOpen={openBook}
        status={now ? liveStatus(now) : null}
      />
      <Results query={query} hits={hits} onOpen={openBook} setQuery={setQuery} />
      <NewShelf onOpen={openBook} />
      <CalendarSection now={now} />
      <EventsSection now={now} onInquiry={onInquiry} />
      <GuideSection onInquiry={onInquiry} />
      <FloorSection zone={floorZone} setZone={setFloorZone} floor={floor} setFloor={setFloor} />
      <AccessSection />
      {open && (
        <Reader
          key={open.id}
          b={bookById.get(open.id)!}
          rect={open.rect}
          from={open.from}
          onClose={() => setOpen(null)}
          onReserve={(text) => {
            setOpen(null);
            onInquiry(text);
          }}
          onMap={showOnMap}
          onSwitch={(id) => {
            const el = document.querySelector(`.lb-book[data-id="${id}"]`) as HTMLElement | null;
            setOpen(null);
            if (el) requestAnimationFrame(() => openBook(id, el));
          }}
        />
      )}
    </div>
  );
}

/* ================================================================== hero */
function Hero({
  query,
  setQuery,
  typing,
  setTyping,
  hits,
  openId,
  onOpen,
  status,
}: {
  query: string;
  setQuery: (q: string) => void;
  typing: boolean;
  setTyping: (b: boolean) => void;
  hits: number[];
  openId: number | null;
  onOpen: (id: number, el: HTMLElement) => void;
  status: LiveStatus | null;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pos = useRef({ x: 0, v: 0, max: 0, u: 0.6, w: 0, raf: 0, glide: null as null | { from: number; to: number; t0: number; dur: number } });
  const touched = useRef(false);
  const dragged = useRef(false);
  const [cls, setCls] = useState(4);
  const [focusId, setFocusId] = useState(sortedPlaced[0].id);
  const [composing, setComposing] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [tip, setTip] = useState<{ id: number; x: number; y: number } | null>(null);

  const hitSet = useMemo(() => new Set(hits), [hits]);
  const hitOrder = useMemo(() => {
    const m = new Map<number, number>();
    [...hits].sort((a, b) => placedById.get(a)!.x - placedById.get(b)!.x).forEach((id, i) => m.set(id, i));
    return m;
  }, [hits]);

  /* --- track motion (drag, inertia, glide) --- */
  const apply = useCallback(() => {
    const p = pos.current;
    if (trackRef.current) trackRef.current.style.transform = `translate3d(${-p.x}px,0,0)`;
    const centerMm = (p.x + p.w / 2) / p.u;
    const c = bayOfX(centerMm);
    setCls((old) => (old === c ? old : c));
  }, []);

  const measure = useCallback(() => {
    const st = stageRef.current;
    const row = st?.querySelector('.lb-row') as HTMLElement | null;
    if (!st || !row) return;
    const p = pos.current;
    p.u = row.offsetHeight / 300;
    p.w = st.clientWidth;
    p.max = Math.max(0, layout.width * p.u - p.w);
    p.x = Math.min(Math.max(0, p.x), p.max);
    apply();
  }, [apply]);

  const loop = useRef<() => void>(() => {});
  useEffect(() => {
    loop.current = () => {
      const p = pos.current;
      p.raf = 0;
      const now = performance.now();
      if (p.glide) {
        const k = Math.min(1, (now - p.glide.t0) / p.glide.dur);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        p.x = p.glide.from + (p.glide.to - p.glide.from) * e;
        if (k >= 1) p.glide = null;
      } else if (Math.abs(p.v) > 0.05) {
        p.x += p.v;
        p.v *= 0.94;
        if (p.x < 0 || p.x > p.max) p.v *= 0.6;
      } else {
        p.v = 0;
      }
      if (!p.glide && Math.abs(p.v) < 0.5) {
        // settle back inside bounds
        if (p.x < 0) p.x += (0 - p.x) * 0.18;
        else if (p.x > p.max) p.x += (p.max - p.x) * 0.18;
      }
      apply();
      const outOfBounds = p.x < -0.5 || p.x > p.max + 0.5;
      if (p.glide || Math.abs(p.v) > 0.05 || outOfBounds) p.raf = requestAnimationFrame(() => loop.current());
    };
  }, [apply]);

  const kick = useCallback(() => {
    if (!pos.current.raf) pos.current.raf = requestAnimationFrame(() => loop.current());
  }, []);

  const glideTo = useCallback(
    (mm: number, dur = 1000) => {
      const p = pos.current;
      const to = Math.min(p.max, Math.max(0, mm * p.u - p.w / 2));
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        p.x = to;
        apply();
        return;
      }
      p.v = 0;
      p.glide = { from: p.x, to, t0: performance.now(), dur };
      kick();
    },
    [apply, kick],
  );

  // initial position: centre the 天文・宇宙 shelf
  useEffect(() => {
    measure();
    const p = pos.current;
    p.x = Math.min(p.max, Math.max(0, INIT_CENTRE * p.u - p.w / 2));
    apply();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => {
      ro.disconnect();
      if (p.raf) cancelAnimationFrame(p.raf);
    };
  }, [measure, apply]);

  // pointer drag with inertia (does not capture until it is clearly a horizontal drag)
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    let down: { x: number; y: number; px: number; id: number; t: number; hist: [number, number][] } | null = null;
    let active = false;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.lb-ui')) return;
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, px: pos.current.x, id: e.pointerId, t: performance.now(), hist: [[performance.now(), e.clientX]] };
      active = false;
      dragged.current = false;
      pos.current.glide = null;
      pos.current.v = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (!active) {
        if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) {
          active = true;
          dragged.current = true;
          touched.current = true;
          st.setPointerCapture(e.pointerId);
          st.classList.add('is-dragging');
          setTip(null);
        } else if (Math.abs(dy) > 10) {
          down = null;
          return;
        } else return;
      }
      const p = pos.current;
      let x = down.px - dx;
      if (x < 0) x = x / 3;
      if (x > p.max) x = p.max + (x - p.max) / 3;
      p.x = x;
      down.hist.push([performance.now(), e.clientX]);
      if (down.hist.length > 6) down.hist.shift();
      apply();
    };
    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      if (active) {
        const h = down.hist;
        const [t0, x0] = h[0];
        const [t1, x1] = h[h.length - 1];
        const v = t1 - t0 > 0 ? -((x1 - x0) / (t1 - t0)) * 16 : 0;
        pos.current.v = Math.max(-80, Math.min(80, v));
        st.classList.remove('is-dragging');
        kick();
      }
      down = null;
      active = false;
    };
    const onClick = (e: MouseEvent) => {
      if (dragged.current) {
        e.stopPropagation();
        e.preventDefault();
        dragged.current = false;
      }
    };
    const onWheel = (e: WheelEvent) => {
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (!dx) return;
      e.preventDefault();
      const p = pos.current;
      p.glide = null;
      p.x = Math.min(p.max + 40, Math.max(-40, p.x + dx));
      p.v = 0;
      apply();
      kick();
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || active) return;
      const el = (e.target as HTMLElement).closest('.lb-book') as HTMLElement | null;
      if (!el) return setTip(null);
      const r = el.getBoundingClientRect();
      const sr = st.getBoundingClientRect();
      setTip({ id: Number(el.dataset.id), x: Math.max(130, Math.min(r.left + r.width / 2 - sr.left, sr.width - 130)), y: r.top - sr.top });
    };
    const onLeave = () => setTip(null);
    st.addEventListener('pointerover', onOver);
    st.addEventListener('pointerleave', onLeave);
    st.addEventListener('pointerdown', onDown);
    st.addEventListener('pointermove', onMove);
    st.addEventListener('pointerup', onUp);
    st.addEventListener('pointercancel', onUp);
    st.addEventListener('click', onClick, true);
    st.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      st.removeEventListener('pointerover', onOver);
      st.removeEventListener('pointerleave', onLeave);
      st.removeEventListener('pointerdown', onDown);
      st.removeEventListener('pointermove', onMove);
      st.removeEventListener('pointerup', onUp);
      st.removeEventListener('pointercancel', onUp);
      st.removeEventListener('click', onClick, true);
      st.removeEventListener('wheel', onWheel);
    };
  }, [apply, kick]);

  // demo query: 「宇宙」 types itself once, like an IME conversion
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setQuery('宇宙');
      return;
    }
    const timers: number[] = [];
    setTyping(true);
    DEMO.forEach((s, i) => {
      timers.push(
        window.setTimeout(
          () => {
            if (touched.current) return;
            setComposing(i < DEMO.length - 1);
            setQuery(s);
            if (i === DEMO.length - 1) setTyping(false);
          },
          260 + i * 120 + (i === DEMO.length - 1 ? 140 : 0),
        ),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [setQuery, setTyping]);

  // glide to the densest cluster of hits when none are on screen
  useEffect(() => {
    if (!hits.length) return;
    const t = setTimeout(() => {
      const p = pos.current;
      const xs = hits.map((id) => placedById.get(id)!.x).sort((a, b) => a - b);
      const view0 = p.x / p.u;
      const view1 = (p.x + p.w) / p.u;
      const visible = xs.filter((x) => x > view0 + 20 && x < view1 - 40).length;
      if (visible >= Math.min(3, xs.length)) return;
      const best = densest(xs, (p.w / p.u) * 0.8);
      glideTo(best, 1100);
      setCursor(-1);
    }, 320);
    return () => clearTimeout(t);
  }, [hits, glideTo]);

  const sortedHits = useMemo(() => [...hits].sort((a, b) => placedById.get(a)!.x - placedById.get(b)!.x), [hits]);
  const stepHit = (dir: number) => {
    if (!sortedHits.length) return;
    const n = (cursor + dir + sortedHits.length) % sortedHits.length;
    setCursor(n);
    const id = sortedHits[n];
    glideTo(placedById.get(id)!.x, 700);
    setFocusId(id);
  };

  const userType = (v: string) => {
    touched.current = true;
    setTyping(false);
    setQuery(v);
    setCursor(-1);
  };

  // keyboard: roving focus across the shelf
  const onShelfKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const cur = placedById.get(focusId)!;
    let next = cur;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const same = sortedPlaced.filter((p) => p.row === cur.row);
      const i = same.indexOf(cur);
      next = same[Math.max(0, Math.min(same.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
    } else if (e.key === 'Home' || e.key === 'End') {
      const same = sortedPlaced.filter((p) => p.row === cur.row);
      next = e.key === 'Home' ? same[0] : same[same.length - 1];
    } else {
      const row = Math.max(0, Math.min(layout.rows - 1, cur.row + (e.key === 'ArrowDown' ? 1 : -1)));
      const same = sortedPlaced.filter((p) => p.row === row);
      next = same.reduce((a, b) => (Math.abs(b.x - cur.x) < Math.abs(a.x - cur.x) ? b : a), same[0]);
    }
    setFocusId(next.id);
    const p = pos.current;
    const px = next.x * p.u - p.x;
    if (px < 80 || px > p.w - 120) glideTo(next.x, 450);
    requestAnimationFrame(() => (stageRef.current?.querySelector(`[data-id="${next.id}"]`) as HTMLElement | null)?.focus({ preventScroll: true }));
  };

  const searching = query.trim().length > 0;
  const W = layout.width;

  return (
    <section id="top" className={`lib-hero ${searching ? 'is-search' : ''}`} aria-label="みらい市立図書館 蔵書検索の書架">
      <div id="search" className="lb-stage" ref={stageRef}>
        <div className="lb-scene">
          <div className="lb-track" ref={trackRef} style={TRACK_STYLE}>
            <div className="lb-cornice" aria-hidden />
            {layout.bays.map((bay) => {
              const c = classes[bay.cls];
              return (
                <div key={`${bay.cls}-${bay.part}`} className="lb-bay" style={{ '--bx': bay.x, '--bw': bay.w, '--band': c.band } as Css} aria-hidden>
                  <div className="lb-sign">
                    <b>{c.key}</b>
                    <span>{c.name}</span>
                    <em>{c.en}</em>
                  </div>
                  <i className="lb-lamp" />
                  {[0, 1, 2].map((r) => (
                    <div key={r} className={`lb-back r${r}`} />
                  ))}
                </div>
              );
            })}
            {layout.bays.map((bay) => (
              <div key={`u${bay.cls}-${bay.part}`} className="lb-upright" style={{ '--bx': bay.x - 30 } as Css} aria-hidden />
            ))}
            <div className="lb-upright" style={{ '--bx': W - 30 } as Css} aria-hidden />
            <div className="lb-board r0" aria-hidden />
            <div className="lb-rail" aria-hidden />
            <div className="lb-board r2" aria-hidden />
            <div className="lb-plinth" aria-hidden />
            {layout.bays.flatMap((bay) =>
              bay.rows.flatMap((row, ri) =>
                row.heads.map((hd) => (
                  <span key={`${bay.cls}-${bay.part}-${ri}-${hd.x}`} className={`lb-head r${ri}`} style={{ '--x': bay.x + hd.x } as Css} aria-hidden>
                    {hd.label}
                  </span>
                )),
              ),
            )}
            <div className="lb-rows" role="toolbar" tabIndex={-1} aria-label="書架（矢印キーで本を選べます）" onKeyDown={onShelfKey}>
              {[0, 1, 2].map((r) => (
                <div key={r} className={`lb-row r${r}`}>
                  {sortedHits
                    .filter((id) => placedById.get(id)!.row === r)
                    .map((id) => {
                      const pl = placedById.get(id)!;
                      const bk = bookById.get(id)!;
                      return (
                        <span
                          key={`pool${id}`}
                          className="lb-pool"
                          aria-hidden
                          style={{ '--x': pl.x, '--t': pl.face ? bk.d : bk.t, '--dl': `${Math.min(hitOrder.get(id) ?? 0, 24) * 30}ms` } as Css}
                        />
                      );
                    })}
                  {layout.placed
                    .filter((p) => p.row === r)
                    .map((p) => (
                      <ShelfBook
                        key={p.id}
                        b={bookById.get(p.id)!}
                        x={p.x}
                        lean={p.lean}
                        face={p.face}
                        hit={hitSet.has(p.id)}
                        order={hitOrder.get(p.id) ?? 0}
                        away={openId === p.id}
                        focusId={focusId}
                        onOpen={onOpen}
                      />
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lb-vignette" aria-hidden />
        {tip &&
          (() => {
            const tb = bookById.get(tip.id)!;
            return (
              <div className="lb-tip" style={{ left: tip.x, top: tip.y } as Css} aria-hidden>
                <b>{fullTitle(tb)}</b>
                <span>
                  {shortAuthor(tb.author)}　{callNumber(tb).filter(Boolean).join(' ')}
                </span>
                <em className={`is-${tb.status.kind}`}>{statusLabel(tb.status)}</em>
              </div>
            );
          })()}

        {/* rail: the catalogue plate */}
        <div className="lb-ui lb-railui">
          <div className="lb-lede">
            <h1>
              棚に、<br />
              たずねる。
            </h1>
            <p>
              蔵書 381,240冊
              <br />
              中央館と分館3館
            </p>
          </div>
          <search className="lb-search">
          <form
            className={`lb-plate ${composing ? 'is-composing' : ''} ${typing ? 'is-typing' : ''}`}
            onSubmit={(e) => {
              e.preventDefault();
              if (sortedHits.length) stepHit(1);
            }}
          >
            <span className="lb-plate-screw" aria-hidden />
            <span className="lb-plate-screw is-r" aria-hidden />
            <label htmlFor="lib-q">蔵書検索 — CATALOGUE</label>
            <div className="lb-card">
              <Search size={16} aria-hidden />
              <input
                id="lib-q"
                ref={inputRef}
                value={query}
                autoComplete="off"
                enterKeyHint="search"
                placeholder="書名・著者・ことばを入れてください"
                onFocus={() => {
                  if (!touched.current) {
                    touched.current = true;
                    setTyping(false);
                    setComposing(false);
                  }
                }}
                onChange={(e) => userType(e.target.value)}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={() => setComposing(false)}
              />
              {query && (
                <button type="button" className="lb-clear" aria-label="検索語を消す" onClick={() => userType('')}>
                  <X size={15} />
                </button>
              )}
              <output className="lb-count" aria-live="polite">
                {searching ? (
                  <>
                    該当 <b key={hits.length}>{hits.length}</b>冊
                  </>
                ) : (
                  <>全{books.length}冊を表示中</>
                )}
              </output>
            </div>
          </form>
          </search>
          <div className="lb-chips">
            <fieldset className="lb-chiprow">
              <legend className="lib-sr">よく検索されることば</legend>
              {CHIPS.map((c) => (
                <button key={c} type="button" aria-pressed={query === c} onClick={() => userType(query === c ? '' : c)}>
                  {c}
                </button>
              ))}
            </fieldset>
            <fieldset className="lb-step">
              <legend className="lib-sr">該当した本へ移動</legend>
              <button type="button" onClick={() => stepHit(-1)} disabled={!hits.length} aria-label="前の該当本へ">
                <ChevronLeft size={16} />
              </button>
              <span>{hits.length ? (cursor >= 0 ? `${cursor + 1} / ${hits.length}` : 'めくる') : '—'}</span>
              <button type="button" onClick={() => stepHit(1)} disabled={!hits.length} aria-label="次の該当本へ">
                <ChevronRight size={16} />
              </button>
            </fieldset>
          </div>
        </div>

        {/* plinth: NDC drawer tabs + live status */}
        <div className="lb-ui lb-baseui">
          <p className={`lb-open is-${status?.state ?? 'none'}`}>
            <i aria-hidden />
            <span>{status ? status.head : '開館状況を確認しています'}</span>
          </p>
          <nav className="lb-tabs" aria-label="分類（NDC）で棚を移動">
            {classes.map((c) => {
              const bay = layout.bays.find((b) => b.cls === c.n)!;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-current={cls === c.n ? 'true' : undefined}
                  style={{ '--band': c.band } as Css}
                  onClick={() => {
                    touched.current = true;
                    glideTo(bay.x + bay.w / 2, 1100);
                  }}
                >
                  <b>{c.key}</b>
                  <span>{c.name}</span>
                </button>
              );
            })}
          </nav>
          <p className="lb-hint" aria-hidden>
            ドラッグで棚を送る・本をクリックで手に取る
          </p>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== results */
function Results({
  query,
  hits,
  onOpen,
  setQuery,
}: {
  query: string;
  hits: number[];
  onOpen: (id: number, el: HTMLElement, from?: 'spine' | 'cover') => void;
  setQuery: (q: string) => void;
}) {
  const [allFor, setAllFor] = useState<string | null>(null);
  const all = allFor === query;
  const setAll = (v: boolean) => setAllFor(v ? query : null);
  const list = hits.map((id) => bookById.get(id)!);
  const shown = all ? list : list.slice(0, 8);
  return (
    <section className="lib-results" aria-labelledby="lib-results-h">
      <header>
        <span className="lib-kicker">目録カード</span>
        <h2 id="lib-results-h">
          {query.trim() ? (
            <>
              「{query.trim()}」の本 <em>{hits.length}冊</em>
            </>
          ) : (
            '棚の名札に、ことばを。'
          )}
        </h2>
        <p>
          棚で光った本は、ここでも一覧できます。貸出中の本も予約でき、準備ができたらメールでお知らせします。
        </p>
      </header>
      {list.length ? (
        <>
          <ol className="lib-cards">
            {shown.map((b) => {
              const [c, m, v] = callNumber(b);
              return (
                <li key={b.id}>
                  <button type="button" className="lib-card" onClick={(e) => onOpen(b.id, e.currentTarget.querySelector('.lib-card-cover') as HTMLElement, 'cover')}>
                    <span className="lib-card-call" aria-label={`請求記号 ${c} ${m} ${v}`}>
                      <i style={{ background: b.c2 }} />
                      {c}
                      <br />
                      {m}
                      {v && (
                        <>
                          <br />
                          {v}
                        </>
                      )}
                    </span>
                    <span className="lib-card-body">
                      <b>{fullTitle(b)}</b>
                      <span>
                        {b.author}　{b.pub}　{b.year}年　{b.pages}p
                      </span>
                      <span className="lib-card-where">
                        <MapPin size={12} aria-hidden /> {b.place}
                      </span>
                    </span>
                    <span className={`lib-stamp is-${b.status.kind}`}>{statusLabel(b.status).replace(/（.*）/, '')}</span>
                    <span className="lib-card-cover" aria-hidden>
                      <Cover b={b} />
                    </span>
                    <span className="lib-card-hole" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ol>
          {list.length > 8 && (
            <button type="button" className="lib-more" onClick={() => setAll(!all)}>
              {all ? '8冊に戻す' : `残り${list.length - 8}冊のカードもめくる`}
            </button>
          )}
        </>
      ) : (
        <div className="lib-empty">
          <p>{query.trim() ? '該当する本が見つかりませんでした。ことばを短くするか、ひらがなで試してみてください。' : '書架の名札に入力すると、該当する本が棚から少しだけ前に出てきます。'}</p>
          <div>
            {['ミステリー', '植物', '音楽', '建築', '歴史', 'パン', '鉄道'].map((w) => (
              <button key={w} type="button" onClick={() => { setQuery(w); document.getElementById('search')?.scrollIntoView({ behavior: 'smooth' }); }}>
                {w}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ================================================================== new arrivals */
function NewShelf({ onOpen }: { onOpen: (id: number, el: HTMLElement, from?: 'spine' | 'cover') => void }) {
  return (
    <section id="new" className="lib-new" aria-labelledby="lib-new-h">
      <div className="lib-new-head">
        <span className="lib-kicker">新着図書</span>
        <h2 id="lib-new-h">今月、棚に入った本。</h2>
        <p>毎週火曜日に新しい本が並びます。表紙をひらくと、所在と予約状況がわかります。</p>
      </div>
      <ul className="lib-rack">
        {newArrivals.map((b, i) => (
          <li key={b.id} className="lib-rack-item" style={{ '--i': i, '--ar': `${b.d} / ${b.h}` } as Css}>
            <button type="button" aria-label={`${b.title}（${b.author}）を手に取る`} onClick={(e) => onOpen(b.id, e.currentTarget.querySelector('.lib-rack-cover') as HTMLElement, 'cover')}>
              <span className="lib-rack-cover">
                <Cover b={b} />
                <span className="lib-new-sticker" aria-hidden>
                  新
                </span>
              </span>
              <span className="lib-rack-cap">
                <b>{b.title}</b>
                <span>{shortAuthor(b.author)}</span>
                <em className={`is-${b.status.kind}`}>{statusLabel(b.status).replace(/（.*）/, '')}</em>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ================================================================== calendar */
function CalendarSection({ now }: { now: Date | null }) {
  const base = now ?? BASE_DATE;
  const [offset, setOffset] = useState(0);
  const y = new Date(base.getFullYear(), base.getMonth() + offset, 1).getFullYear();
  const m = new Date(base.getFullYear(), base.getMonth() + offset, 1).getMonth();
  const cells = monthGrid(y, m);
  const status = now ? liveStatus(now) : null;
  const today = `${base.getFullYear()}-${base.getMonth()}-${base.getDate()}`;
  const mins = now ? now.getHours() * 60 + now.getMinutes() : 15 * 60;
  const todayInfo = cells.find((c) => c && `${c.date.getFullYear()}-${c.date.getMonth()}-${c.date.getDate()}` === today);
  return (
    <section id="calendar" className="lib-cal" aria-labelledby="lib-cal-h">
      <div className="lib-cal-side">
        <span className="lib-kicker">開館カレンダー</span>
        <h2 id="lib-cal-h">きょうは、開いていますか。</h2>
        <div className={`lib-now is-${status?.state ?? 'none'}`} aria-live="polite">
          <p className="lib-now-date">
            {base.getFullYear()}.{base.getMonth() + 1}.{base.getDate()}
            <small>{WD[base.getDay()]}曜日</small>
          </p>
          <p className="lib-now-head">{status?.head ?? '開館状況を確認しています'}</p>
          <p className="lib-now-sub">{status?.sub}</p>
          <div className="lib-dayline" aria-hidden>
            {Array.from({ length: 15 }, (_, i) => (
              <span key={i} style={{ '--h': i + 7 } as Css}>
                {(i + 7) % 3 === 0 ? i + 7 : ''}
              </span>
            ))}
            {todayInfo?.open && (
              <i className="lib-dayline-open" style={{ '--a': todayInfo.open[0], '--b': todayInfo.open[1] } as Css} />
            )}
            <b className="lib-dayline-now" style={{ '--m': Math.max(7 * 60, Math.min(22 * 60, mins)) } as Css} />
          </div>
        </div>
        <dl className="lib-hours">
          <div>
            <dt>火〜金</dt>
            <dd>9:00 – 20:00</dd>
          </div>
          <div>
            <dt>土・日・祝</dt>
            <dd>9:00 – 18:00</dd>
          </div>
          <div>
            <dt>休館日</dt>
            <dd>
              月曜日（祝日の場合は翌平日）・第3木曜日（館内整理日）・年末年始・特別整理期間
            </dd>
          </div>
        </dl>
      </div>
      <div className="lib-month">
        <div className="lib-month-head">
          <button type="button" onClick={() => setOffset(offset - 1)} disabled={offset <= -1} aria-label="前の月">
            <ChevronLeft size={18} />
          </button>
          <h3>
            <span>{y}</span>
            {m + 1}
            <small>月</small>
          </h3>
          <button type="button" onClick={() => setOffset(offset + 1)} disabled={offset >= 3} aria-label="次の月">
            <ChevronRight size={18} />
          </button>
        </div>
        <table className="lib-grid">
          <caption className="lib-sr">{`${y}年${m + 1}月の開館日`}</caption>
          <thead>
            <tr>
              {WD.map((w, i) => (
                <th key={w} scope="col" className={`lib-wd ${i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : ''}`}>
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: cells.length / 7 }, (_, wk) => (
              <tr key={wk}>
                {cells.slice(wk * 7, wk * 7 + 7).map((c, i) => {
                  if (!c) return <td key={`e${i}`} className="lib-day is-empty" aria-hidden />;
                  const key = `${c.date.getFullYear()}-${c.date.getMonth()}-${c.date.getDate()}`;
                  const isToday = key === today;
                  const wd = c.date.getDay();
                  return (
                    <td
                      key={key}
                      className={`lib-day ${c.closed ? 'is-closed' : ''} ${c.closed === '特別整理期間' ? 'is-inv' : ''} ${c.open?.[1] === 18 ? 'is-short' : ''} ${isToday ? 'is-today' : ''} ${wd === 0 || c.holiday ? 'is-sun' : wd === 6 ? 'is-sat' : ''}`}
                    >
                      <b>{c.date.getDate()}</b>
                      {c.closed ? (
                        <em title={c.closed}>{c.closed === '特別整理期間' ? '整理' : '休'}</em>
                      ) : (
                        <small>{c.open![1] === 18 ? '〜18時' : '〜20時'}</small>
                      )}
                      {c.holiday && <i>{c.holiday}</i>}
                      {isToday && <span className="lib-today-stamp">本日</span>}
                      <span className="lib-sr">{c.closed ? `休館（${c.closed}）` : `${c.open![0]}時から${c.open![1]}時まで開館`}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="lib-legend">
          <li>
            <i className="is-open" />
            9:00〜20:00
          </li>
          <li>
            <i className="is-short" />
            9:00〜18:00（土日祝）
          </li>
          <li>
            <i className="is-closed" />
            休館日
          </li>
          <li>
            <i className="is-inv" />
            特別整理期間（蔵書点検のため全館休館）
          </li>
        </ul>
      </div>
    </section>
  );
}

/* ================================================================== events */
function EventsSection({ now, onInquiry }: { now: Date | null; onInquiry: Inquiry }) {
  const [kind, setKind] = useState<'all' | 'kids' | 'adult' | 'course'>('all');
  const list = useMemo(() => events(now ?? BASE_DATE), [now]);
  const shown = list.filter((e) => kind === 'all' || e.kind === kind);
  const base = now ?? BASE_DATE;
  return (
    <section id="events" className="lib-events" aria-labelledby="lib-ev-h">
      <header className="lib-ev-head">
        <div>
          <span className="lib-kicker">イベント</span>
          <h2 id="lib-ev-h">図書館だより</h2>
          <p className="lib-ev-issue">
            {base.getFullYear()}年{base.getMonth() + 1}月号・第{(base.getFullYear() - 2003) * 12 + base.getMonth() + 1}号
          </p>
        </div>
        <fieldset className="lib-ev-tabs">
          <legend className="lib-sr">対象で絞り込む</legend>
          {(
            [
              ['all', 'すべて'],
              ['kids', 'こども'],
              ['adult', 'おとな'],
              ['course', '講座'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {l}
            </button>
          ))}
        </fieldset>
      </header>
      <ol className="lib-ev-list">
        {shown.map((ev) => {
          const first = ev.dates[0];
          return (
            <li key={ev.id} className={`lib-ev is-${ev.kind}`}>
              <div className="lib-ev-date" aria-hidden>
                {first ? (
                  <>
                    <span>{first.getMonth() + 1}月</span>
                    <b>{first.getDate()}</b>
                    <small>{WD[first.getDay()]}</small>
                  </>
                ) : (
                  <b>—</b>
                )}
              </div>
              <div className="lib-ev-body">
                <span className="lib-ev-kind">{ev.kind === 'kids' ? 'こども' : ev.kind === 'adult' ? 'おとな' : '講座'}</span>
                <h3>{ev.title}</h3>
                <p>{ev.lead}</p>
                <dl>
                  <div>
                    <dt>日程</dt>
                    <dd>
                      {ev.dates.map(fmtDate).join('・')} {ev.time}
                    </dd>
                  </div>
                  <div>
                    <dt>会場</dt>
                    <dd>{ev.place}</dd>
                  </div>
                  <div>
                    <dt>対象</dt>
                    <dd>{ev.target}</dd>
                  </div>
                  <div>
                    <dt>定員</dt>
                    <dd>
                      {ev.cap}・{ev.fee}
                    </dd>
                  </div>
                </dl>
                <small>{ev.note}</small>
              </div>
              <div className="lib-ev-act">
                <span className="lib-seats" aria-label={`残り${ev.left}`}>
                  残り<b>{ev.left}</b>
                  {ev.cap.includes('組') ? '組' : '名'}
                </span>
                <button
                  type="button"
                  onClick={() => onInquiry(`イベント申込：${ev.title} ${first ? fmtDate(first) : ''} ${ev.time.split('（')[0]}／対象：${ev.target}`)}
                >
                  申し込む <ArrowUpRight size={15} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ================================================================== guide */
function GuideSection({ onInquiry }: { onInquiry: Inquiry }) {
  const steps: { n: string; t: string; lead: string; body: ReactNode }[] = [
    {
      n: '一',
      t: '利用カードをつくる',
      lead: 'カウンターで、その日のうちに。',
      body: (
        <>
          みらい市に住んでいる・通勤・通学している方ならどなたでも。住所の確認できるもの（運転免許証・保険証・学生証など）をお持ちください。カードは全館共通、発行は無料です。
        </>
      ),
    },
    {
      n: '二',
      t: '借りる',
      lead: 'ひとり10冊まで、2週間。',
      body: (
        <>
          本・雑誌はあわせて10冊、CD・DVDは3点まで（1週間）。自動貸出機なら、カードを置いて本を重ねるだけ。予約がなければ1回だけ延長できます。
        </>
      ),
    },
    {
      n: '三',
      t: '返す',
      lead: '返却ポストは24時間。',
      body: (
        <>
          中央館正面玄関とみらい駅前分館に、24時間使える返却ポストがあります。CD・DVDや他の自治体から取り寄せた本は、壊れやすいのでカウンターへお返しください。
        </>
      ),
    },
    {
      n: '四',
      t: '予約・リクエスト',
      lead: 'ひとり10件まで、受取館を選べます。',
      body: (
        <>
          貸出中の本は、この棚からそのまま予約できます。用意ができたらメールでお知らせし、7日間お取り置きします。所蔵のない本は、購入や他館からの取り寄せをリクエストできます。
        </>
      ),
    },
  ];
  return (
    <section id="guide" className="lib-guide" aria-labelledby="lib-guide-h">
      <div className="lib-guide-intro">
        <span className="lib-kicker">利用案内</span>
        <h2 id="lib-guide-h">カード一枚で、四館の本を。</h2>
        <div className="lib-lcard" aria-label="みらい市立図書館 利用カードの見本">
          <div className="lib-lcard-top">
            <b>みらい市立図書館</b>
            <span>LIBRARY CARD</span>
          </div>
          <svg className="lib-lcard-mark" viewBox="0 0 100 100" aria-hidden>
            <Motif name="book" color="currentColor" />
          </svg>
          <div className="lib-lcard-bar" aria-hidden>
            {'1100423598021'.split('').map((d, i) => (
              <i key={i} style={{ '--w': (Number(d) % 3) + 1, '--g': ((Number(d) + i) % 2) + 1 } as Css} />
            ))}
          </div>
          <p>
            <span>No.</span> 1100 4235 9802 1
          </p>
          <small>中央館・東分館・北分館・みらい駅前分館 共通</small>
        </div>
      </div>
      <ol className="lib-steps">
        {steps.map((s) => (
          <li key={s.n}>
            <span className="lib-step-n" aria-hidden>
              {s.n}
            </span>
            <h3>{s.t}</h3>
            <p className="lib-step-lead">{s.lead}</p>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="lib-guide-foot">
        <p>
          <BookOpen size={16} aria-hidden /> 所蔵のない本のリクエスト、調べもののご相談（レファレンス）も受け付けています。
        </p>
        <button type="button" onClick={() => onInquiry('リクエスト・レファレンスのご相談')}>
          リクエスト・相談をする <ArrowUpRight size={15} />
        </button>
      </div>
    </section>
  );
}

/* ================================================================== floor map */
const zones: Record<string, { floor: 1 | 2; name: string; note: string; x: number; y: number; w: number; h: number }> = {
  counter: { floor: 1, name: '総合カウンター', note: '貸出・返却・利用カードの発行・予約本のお渡し。', x: 250, y: 190, w: 120, h: 60 },
  newmag: { floor: 1, name: '新着・雑誌', note: '新着図書と雑誌約320誌。最新号以外は貸出できます。', x: 380, y: 170, w: 170, h: 80 },
  life: { floor: 1, name: 'くらしと芸術', note: '料理・住まい・手芸・建築（5類）、美術・音楽・スポーツ（7類）。', x: 380, y: 30, w: 190, h: 130 },
  kids: { floor: 1, name: 'こどものへや', note: '絵本・児童書・調べもの図鑑。靴を脱いで読めるコーナーも。', x: 30, y: 30, w: 210, h: 150 },
  story: { floor: 1, name: 'おはなしのへや', note: '毎週土曜 11:00 のおはなし会の会場です。', x: 30, y: 190, w: 110, h: 60 },
  post: { floor: 1, name: '返却ポスト（屋外）', note: '正面玄関の右手。24時間ご利用いただけます。', x: 150, y: 256, w: 90, h: 18 },
  gen: { floor: 2, name: '一般書架', note: '総記・哲学・歴史・社会科学・自然科学・産業・言語（0〜4・6・8類）。', x: 30, y: 30, w: 250, h: 130 },
  lit: { floor: 2, name: '文学', note: '日本の小説・エッセイ・詩歌・海外文学（9類）。', x: 290, y: 30, w: 180, h: 130 },
  ref: { floor: 2, name: '参考図書', note: '百科事典・辞書・年鑑。館内でご利用ください。', x: 480, y: 30, w: 80, h: 130 },
  local: { floor: 2, name: '郷土資料室', note: 'みらい市史・古文書・地図・写真。古文書講座の会場です。', x: 30, y: 170, w: 170, h: 90 },
  study: { floor: 2, name: '閲覧・学習室', note: '72席。高校生以上。朗読会の特別会場になる日があります。', x: 210, y: 170, w: 220, h: 90 },
  multi: { floor: 2, name: '多目的室', note: '講座・ビブリオバトルの会場。', x: 440, y: 170, w: 90, h: 90 },
};

function FloorSection({
  zone,
  setZone,
  floor,
  setFloor,
}: {
  zone: string | null;
  setZone: (z: string | null) => void;
  floor: 1 | 2;
  setFloor: (f: 1 | 2) => void;
}) {
  const current = zone && zones[zone] ? zones[zone] : null;
  return (
    <section id="floor" className="lib-floor" aria-labelledby="lib-floor-h">
      <div className="lib-floor-side">
        <span className="lib-kicker">館内フロアマップ</span>
        <h2 id="lib-floor-h">棚までの道のり。</h2>
        <fieldset className="lib-floor-tabs">
          <legend className="lib-sr">階をえらぶ</legend>
          {([1, 2] as const).map((f) => (
            <button key={f} type="button" aria-pressed={floor === f} onClick={() => setFloor(f)}>
              {f}F
            </button>
          ))}
        </fieldset>
        <div className="lib-floor-note" aria-live="polite">
          {current ? (
            <>
              <b>
                {current.floor}F　{current.name}
              </b>
              <p>{current.note}</p>
            </>
          ) : (
            <p>エリアを選ぶと、置いてある本と使いかたを表示します。本の「所在」から、ここへ飛んでくることもできます。</p>
          )}
        </div>
        <ul className="lib-floor-list">
          {Object.entries(zones)
            .filter(([, z]) => z.floor === floor)
            .map(([id, z]) => (
              <li key={id}>
                <button type="button" aria-pressed={zone === id} onClick={() => setZone(zone === id ? null : id)}>
                  {z.name}
                </button>
              </li>
            ))}
        </ul>
      </div>
      <div className="lib-floor-map">
        <svg viewBox="0 0 600 290" aria-labelledby="lib-fm-title">
          <title id="lib-fm-title">{`${floor}階のフロアマップ`}</title>
          <defs>
            <pattern id="lib-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0v6" stroke="currentColor" strokeWidth="1" opacity=".25" />
            </pattern>
          </defs>
          <rect x="16" y="16" width="568" height="252" rx="4" className="lib-fm-wall" />
          {floor === 1 && <path d="M258 268h60" className="lib-fm-door" />}
          <rect x={floor === 1 ? 150 : 540} y={floor === 1 ? 190 : 200} width={floor === 1 ? 90 : 30} height={floor === 1 ? 60 : 60} className="lib-fm-stair" />
          {Object.entries(zones)
            .filter(([, z]) => z.floor === floor)
            .map(([id, z]) => (
              <g
                key={id}
                className={`lib-fm-zone ${zone === id ? 'is-on' : ''}`}
                onClick={() => setZone(zone === id ? null : id)}
              >
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="3" />
                {(id === 'study' || id === 'local') &&
                  Array.from({ length: Math.floor((z.w - 30) / 36) }, (_, i) => (
                    <rect key={`d${i}`} className="lib-fm-desk" x={z.x + 14 + i * 36} y={z.y + 40} width="26" height={z.h - 58} rx="2" />
                  ))}
                {id === 'kids' &&
                  [0, 1, 2].map((i) => <circle key={`k${i}`} className="lib-fm-desk" cx={z.x + 50 + i * 55} cy={z.y + 92} r="20" />)}
                {(id === 'gen' || id === 'lit' || id === 'life' || id === 'ref') &&
                  Array.from({ length: Math.floor((z.w - 20) / 22) }, (_, i) => (
                    <rect key={i} className="lib-fm-shelf" x={z.x + 12 + i * 22} y={z.y + 34} width="8" height={z.h - 48} />
                  ))}
                <text x={z.x + 10} y={z.y + 22}>
                  {z.name}
                </text>
              </g>
            ))}
          {floor === 1 && (
            <>
              <path className="lib-fm-entrance" d="M288 286l-7-9h14z" />
              <text x="306" y="286" className="lib-fm-small">
                正面玄関
              </text>
            </>
          )}
          <text x={floor === 1 ? 195 : 555} y={floor === 1 ? 224 : 196} className="lib-fm-small" textAnchor="middle">
            階段・EV
          </text>
          <g className="lib-fm-north" transform="translate(560 44)">
            <path d="M0 -14l6 16-6-4-6 4z" />
            <text y="16" textAnchor="middle">N</text>
          </g>
        </svg>
      </div>
    </section>
  );
}

/* ================================================================== access */
const sites = [
  { id: 'c', name: '中央館', addr: 'みらい市中央区図書館通り1-8', way: 'みらい駅 北口から徒歩7分・市役所前バス停すぐ', hours: '9:00–20:00（土日祝 18:00まで）', park: '駐車場40台（2時間無料）', x: 300, y: 150 },
  { id: 'e', name: '東分館', addr: 'みらい市東区あさひ台3-2-1 あさひ台コミュニティセンター2F', way: 'あさひ台バス停から徒歩2分', hours: '10:00–18:00', park: 'センター駐車場を共用', x: 470, y: 110 },
  { id: 'n', name: '北分館', addr: 'みらい市北区もりの里5-14', way: 'もりの里駅から徒歩10分', hours: '10:00–18:00', park: '駐車場12台', x: 210, y: 46 },
  { id: 's', name: 'みらい駅前分館', addr: 'みらい市中央区駅前本町2-1 みらいステーションビル3F', way: 'みらい駅 南口直結', hours: '10:00–21:00（予約本の受取・返却中心）', park: '駅ビル駐車場（1時間無料・要認証）', x: 330, y: 214 },
];

function AccessSection() {
  const [on, setOn] = useState('c');
  return (
    <section id="access" className="lib-access" aria-labelledby="lib-acc-h">
      <div className="lib-acc-head">
        <span className="lib-kicker">アクセス</span>
        <h2 id="lib-acc-h">いちばん近い図書館で、受け取れます。</h2>
      </div>
      <div className="lib-acc-body">
        <svg className="lib-acc-map" viewBox="0 0 600 280" aria-labelledby="lib-acc-title">
          <title id="lib-acc-title">みらい市内の図書館の位置</title>
          <path className="lib-map-river" d="M-10 70C90 90 150 130 230 120s170 30 220 90 120 70 170 70" />
          <path className="lib-map-rail" d="M-10 205H610" />
          <path className="lib-map-rail2" d="M-10 205H610" />
          <path className="lib-map-rail" d="M160 -10L250 205" />
          <path className="lib-map-rail2" d="M160 -10L250 205" />
          <path className="lib-map-road" d="M300 0V280M0 150H600M390 60L560 170" />
          <g className="lib-map-station">
            <rect x="300" y="198" width="54" height="14" rx="7" />
            <text x="327" y="195" textAnchor="middle">
              みらい駅
            </text>
            <rect x="190" y="52" width="14" height="14" rx="7" />
            <text x="176" y="84">もりの里駅</text>
          </g>
          <text x="40" y="60" className="lib-map-label">
            みらい川
          </text>
          {sites.map((s) => (
            <g key={s.id} className={`lib-pin ${on === s.id ? 'is-on' : ''}`} transform={`translate(${s.x} ${s.y})`} onClick={() => setOn(s.id)}>
              <circle r={on === s.id ? 16 : 11} />
              <text y="4" textAnchor="middle">
                {s.id === 'c' ? '中' : s.id === 'e' ? '東' : s.id === 'n' ? '北' : '駅'}
              </text>
              <text className="lib-pin-label" x={on === s.id ? 22 : 17} y="4">
                {s.name}
              </text>
            </g>
          ))}
        </svg>
        <ul className="lib-acc-list">
          {sites.map((s) => (
            <li key={s.id} className={on === s.id ? 'is-on' : ''}>
              <button type="button" aria-pressed={on === s.id} onClick={() => setOn(s.id)}>
                <b>{s.name}</b>
                <span>{s.addr}</span>
              </button>
              <dl>
                <div>
                  <dt>
                    <MapPin size={13} aria-hidden /> 交通
                  </dt>
                  <dd>{s.way}</dd>
                </div>
                <div>
                  <dt>
                    <Clock size={13} aria-hidden /> 開館
                  </dt>
                  <dd>{s.hours}</dd>
                </div>
                <div>
                  <dt>P</dt>
                  <dd>{s.park}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>
      <p className="lib-fiction">掲載内容（図書館・蔵書・著者・出版社・イベント・所在地）はすべて架空の制作サンプルです。</p>
    </section>
  );
}

/* ================================================================== reader */
function Reader({
  b,
  rect,
  from,
  onClose,
  onReserve,
  onMap,
  onSwitch,
}: {
  b: Book;
  rect: DOMRect;
  from: 'spine' | 'cover';
  onClose: () => void;
  onReserve: (text: string) => void;
  onMap: (zone: string) => void;
  onSwitch: (id: number) => void;
}) {
  const related = useMemo(() => {
    const me = placedById.get(b.id);
    if (!me) return [];
    return sortedPlaced
      .filter((p) => p.id !== b.id && p.row === me.row && Math.abs(p.x - me.x) < 260 && !bookById.get(p.id)!.series)
      .sort((a, c) => Math.abs(a.x - me.x) - Math.abs(c.x - me.x))
      .slice(0, 3)
      .map((p) => bookById.get(p.id)!);
  }, [b.id]);
  const wrap = useRef<HTMLDialogElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<{ reverse: () => void; progress: (n: number) => void; kill: () => void; eventCallback: (t: string, f: () => void) => void } | null>(null);
  const closing = useRef(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  const [branch, setBranch] = useState(branches[0]);
  const [dims] = useState(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const narrow = vw < 760;
    let H = Math.min(620, vh * 0.8);
    let W = (H * b.d) / b.h;
    const maxW = narrow ? vw * 0.86 : Math.min(460, vw * 0.4);
    if (W > maxW) {
      W = maxW;
      H = (W * b.h) / b.d;
    }
    W = Math.max(W, narrow ? Math.min(330, vw * 0.86) : 380);
    H = Math.max(H, W * 1.28);
    H = Math.min(H, vh * 0.88);
    return { W, H, T: (b.t * H) / b.h, narrow };
  });
  const dir = b.tate ? -1 : 1; // -1: 右綴じ (spine on the right)

  // choreography: pull out → turn to cover → open
  useEffect(() => {
    if (!bookRef.current) return;
    let dead = false;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    void import('gsap').then(({ gsap }) => {
      if (dead || !bookRef.current) return;
      const { W, H, T, narrow } = dims;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const s0 = from === 'spine' ? rect.height / H : rect.width / W;
      const cx0 = rect.left + rect.width / 2 - vw / 2;
      const cy0 = rect.top + rect.height / 2 - vh / 2;
      // open spread shift so the information page sits in the middle (narrow) or the spread is centred
      const shift = narrow ? dir * W * 0.06 : (dir * W) / 2;
      const book = bookRef.current;
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.inOut' } });
      gsap.set(book, {
        x: cx0,
        y: cy0,
        z: from === 'spine' ? -(W / 2) * s0 : 0,
        scale: s0,
        rotationY: from === 'spine' ? dir * 90 : 0,
        rotationX: 0,
      });
      gsap.set(coverRef.current, { rotationY: 0, z: T / 2 + 0.5 });
      gsap.set(leafRef.current, { rotationY: 0, z: T / 2 });
      gsap.set(wrap.current, { '--veil': 0 });
      tl.to(wrap.current, { '--veil': 1, duration: 0.6, ease: 'power1.out' }, 0);
      if (from === 'spine') {
        tl.to(book, { z: 160 * s0, y: cy0 - 6, duration: 0.42, ease: 'power2.out' }, 0);
      }
      tl.to(book, { x: 0, y: 0, z: 0, scale: 1, rotationY: from === 'spine' ? dir * 12 : 0, rotationX: 4, duration: 0.85 }, from === 'spine' ? 0.34 : 0);
      tl.to(book, { rotationY: 0, rotationX: 0, duration: 0.5, ease: 'power2.out' }, '>-0.12');
      tl.to(book, { x: shift, duration: 0.95 }, '>-0.05');
      tl.to(coverRef.current, { rotationY: -dir * 178, duration: 1.0, ease: 'power2.inOut' }, '<');
      tl.to(leafRef.current, { rotationY: -dir * 176, duration: 0.9, ease: 'power2.inOut' }, '<0.18');
      tl.eventCallback('onReverseComplete', () => closeRef.current());
      tlRef.current = tl as unknown as typeof tlRef.current;
      if (reduce) tl.progress(1);
      else tl.play();
    });
    return () => {
      dead = true;
      tlRef.current?.kill();
    };
  }, [dims, rect, from, dir]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const tl = tlRef.current;
    if (!tl || matchMedia('(prefers-reduced-motion: reduce)').matches) closeRef.current();
    else {
      (tl as unknown as { timeScale: (n: number) => void }).timeScale(1.7);
      tl.reverse();
    }
  }, []);

  // focus management
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => wrap.current?.querySelector<HTMLElement>('.lr-close')?.focus({ preventScroll: true }), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab' && wrap.current) {
        const f = [...wrap.current.querySelectorAll<HTMLElement>('button, select, a[href]')].filter((el) => !el.hasAttribute('disabled'));
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [close]);

  const [c, m, v] = callNumber(b);
  const vars: Css = { '--W': `${dims.W}px`, '--H': `${dims.H}px`, '--T': `${dims.T}px`, '--c1': b.c1, '--c3': b.c3, '--band': b.c2 };
  const canReserve = b.status.kind !== 'ref';
  const stamps = useMemo(() => {
    const out: string[] = [];
    let d = new Date(2025, 2 + (b.id % 5), 3 + (b.id % 11));
    const n = 3 + (b.id % 5);
    for (let i = 0; i < n; i++) {
      out.push(`${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}.${d.getDate()}`);
      d = new Date(d.getFullYear(), d.getMonth() + 1 + ((b.id + i) % 3), ((d.getDate() + 9 * i) % 27) + 1);
    }
    return out;
  }, [b.id]);

  return (
    <dialog
      open
      ref={wrap}
      className={`lr ${b.tate ? 'is-tate' : 'is-yoko'} ${dims.narrow ? 'is-narrow' : ''}`}
      aria-modal="true"
      aria-label={`${fullTitle(b)} の書誌情報`}
    >
      <button type="button" className="lr-backdrop" tabIndex={-1} aria-hidden onClick={close} />
      <button type="button" className="lr-close" onClick={close} aria-label="本を棚に戻す">
        <X size={18} /> 棚に戻す
      </button>
      {(
        <div className="lr-stage">
          <div className="lr-book" ref={bookRef} style={vars}>
            {/* page block & boards */}
            <div className="lr-face lr-back" />
            <div className="lr-face lr-spine">
              <span className="lr-spine-in" style={{ ...spineVars(b), '--u': `${dims.H / b.h}px` } as Css}>
                <SpineFace b={b} />
              </span>
            </div>
            <div className="lr-face lr-fore" />
            <div className="lr-face lr-top" />
            <div className="lr-face lr-bottom" />
            {/* the information page (lies on the text block, under the cover) */}
            <div className="lr-face lr-page">
              <div className="lr-info">
                <span className="lr-call" aria-label={`請求記号 ${c} ${m} ${v}`}>
                  <i />
                  <b>{c}</b>
                  <b>{m}</b>
                  {v && <b>{v}</b>}
                </span>
                <p className="lr-kicker">書誌情報</p>
                <h2>{b.title}</h2>
                {b.sub && <p className="lr-sub">{b.vol ? `第${b.vol}巻　` : ''}{b.sub}</p>}
                <p className="lr-author">{b.author}</p>
                <p className="lr-blurb">{b.blurb}</p>
                <dl>
                  <div>
                    <dt>出版</dt>
                    <dd>
                      {b.pub}・{b.year}年・{b.pages}ページ
                    </dd>
                  </div>
                  <div>
                    <dt>分類</dt>
                    <dd>
                      {b.ndc === 'E' ? '絵本（E）' : `NDC ${b.ndc}`}・{classes[b.cls].name}
                    </dd>
                  </div>
                  <div>
                    <dt>所在</dt>
                    <dd>
                      中央館 {b.place}
                      <button type="button" className="lr-maplink" onClick={() => onMap(b.zone)}>
                        地図で見る
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt>状態</dt>
                    <dd className={`lr-status is-${b.status.kind}`}>{statusLabel(b.status)}</dd>
                  </div>
                </dl>
                {related.length > 0 && (
                  <div className="lr-related">
                    <p>同じ棚の、となりの本</p>
                    <ul>
                      {related.map((r) => (
                        <li key={r.id}>
                          <button type="button" onClick={() => onSwitch(r.id)}>
                            <i style={{ background: r.c1 }} />
                            {fullTitle(r)}
                            <small>{shortAuthor(r.author)}</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {canReserve ? (
                  <div className="lr-reserve">
                    <label>
                      受取館
                      <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                        {branches.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" onClick={() => onReserve(`予約：『${fullTitle(b)}』 受取館：${branch}`)}>
                      {b.status.kind === 'ok' ? '取り置きを予約する' : '予約する'} <ArrowUpRight size={15} />
                    </button>
                  </div>
                ) : (
                  <p className="lr-refnote">この資料は館内でご覧いただけます。複写（コピー）はカウンターへ。</p>
                )}
              </div>
            </div>
            {/* fly-leaf: the date-due slip is glued here */}
            <div className="lr-hinge lr-leaf" ref={leafRef}>
              <div className="lr-leaf-front" />
              <div className="lr-leaf-back">
                <div className={`lr-pocket ${b.status.kind === 'ref' ? 'is-ref' : ''}`}>
                  <p>{b.status.kind === 'ref' ? '館内閲覧資料' : '返却期限票'}</p>
                  <small>{b.status.kind === 'ref' ? 'この資料は館外に持ち出せません' : 'この日までにお返しください'}</small>
                  {b.status.kind === 'ref' ? (
                    <span className="lr-refstamp">禁帯出</span>
                  ) : (
                    <ol>
                      {stamps.map((st, i) => (
                        <li key={i} style={{ '--r': `${((i * 37) % 9) - 4}deg` } as Css}>
                          {st}
                        </li>
                      ))}
                      <li className="is-blank" />
                    </ol>
                  )}
                  <span className="lr-pocket-lip">みらい市立図書館</span>
                </div>
              </div>
            </div>
            {/* cover */}
            <div className="lr-hinge lr-cover" ref={coverRef}>
              <div className="lr-cover-front">
                <Cover b={b} />
                <span className="lr-film" />
              </div>
              <div className="lr-cover-back">
                <p>みらい市立図書館</p>
                <small>MIRAI CITY LIBRARY — EX LIBRIS</small>
              </div>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
