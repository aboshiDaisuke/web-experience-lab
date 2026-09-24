'use client';
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, ArrowUpRight, Check, X, Clock, MapPin, Phone, Wrench, CalendarDays, Car as CarIcon } from 'lucide-react';
import { carArt, shade, G } from '@/lib/works/drive/car-art';
import {
  BODY,
  BODY_SHAPE,
  CARS,
  MENUS,
  PARTS,
  SHAKEN,
  SLOTS,
  availability,
  estimate,
  man,
  monthly,
  type BodyKey,
  type Car,
  type Shape,
} from '@/lib/works/drive/data';
import type { DriveCtl, HudFrame } from '@/lib/works/drive/scene';
import { GANTRIES, EXIT_PANEL, type SignTarget } from '@/lib/works/drive/signs';

const HIT_PANELS = [...GANTRIES.flatMap((g) => g.panels), EXIT_PANEL];
const ROUTE: { t: SignTarget; tag: string; jp: string }[] = [
  { t: 'stock', tag: '1', jp: '在庫車' },
  { t: 'service', tag: '2', jp: '車検・整備' },
  { t: 'buy', tag: 'JCT', jp: '買取査定' },
  { t: 'access', tag: 'P', jp: '本店・アクセス' },
];
const ANCHOR: Record<SignTarget, string> = { stock: 'stock', service: 'service', buy: 'buy', access: 'access' };

const go = (t: SignTarget) => document.getElementById(ANCHOR[t])?.scrollIntoView({ behavior: 'smooth', block: 'start' });

function DriveHero({ onInquiry }: { onInquiry: (s?: string) => void }) {
  const hero = useRef<HTMLElement>(null);
  const gl = useRef<HTMLDivElement>(null);
  const ctl = useRef<DriveCtl | null>(null);
  const hits = useRef<Record<string, HTMLButtonElement | null>>({});
  const speed = useRef<HTMLSpanElement>(null);
  const tach = useRef<SVGPathElement>(null);
  const gear = useRef<HTMLSpanElement>(null);
  const odo = useRef<HTMLSpanElement>(null);
  const trip = useRef<HTMLSpanElement>(null);
  const blinkL = useRef<HTMLSpanElement>(null);
  const blinkR = useRef<HTMLSpanElement>(null);
  const route = useRef<Record<string, HTMLButtonElement | null>>({});
  const routeKm = useRef<Record<string, HTMLSpanElement | null>>({});
  const stage = useRef<HTMLDivElement>(null);
  const msg = useRef<HTMLParagraphElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = gl.current;
    if (!el) return;
    let dead = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrow = matchMedia('(max-width: 760px)').matches;
    const cache: Record<string, string> = {};
    const put = (key: string, node: { textContent: string | null } | null, v: string) => {
      if (!node || cache[key] === v) return;
      cache[key] = v;
      node.textContent = v;
    };
    const onFrame = (h: HudFrame) => {
      put('spd', speed.current, String(Math.round(h.speed)));
      put('gear', gear.current, `D${h.gear}`);
      put('odo', odo.current, Math.floor(h.odo).toLocaleString('ja-JP').padStart(6, '0'));
      put('trip', trip.current, h.trip.toFixed(1));
      if (tach.current) {
        const f = Math.min(1, h.rpm / 8000);
        tach.current.style.strokeDashoffset = String(100 - f * 100);
      }
      blinkL.current?.classList.toggle('on', h.blink < 0);
      blinkR.current?.classList.toggle('on', h.blink > 0);
      h.next.forEach((n, i) => {
        const b = route.current[n.target];
        if (b && cache[`o${n.target}`] !== String(i)) {
          cache[`o${n.target}`] = String(i);
          b.style.order = String(i);
        }
        put(`km${n.target}`, routeKm.current[n.target] ?? null, n.km < 1 ? `${Math.max(10, Math.round(n.km * 100) * 10)}m` : `${n.km.toFixed(1)}km`);
      });
      for (const hit of h.hits) {
        const b = hits.current[hit.id];
        if (!b) continue;
        const on = hit.on;
        if (cache[`h${hit.id}`] !== String(on)) {
          cache[`h${hit.id}`] = String(on);
          b.hidden = !on;
        }
        if (on) {
          b.style.transform = `translate(${hit.x.toFixed(1)}px, ${hit.y.toFixed(1)}px)`;
          b.style.width = `${hit.w.toFixed(1)}px`;
          b.style.height = `${hit.h.toFixed(1)}px`;
        }
      }
      const m =
        h.phase === 'tunnel'
          ? `みらいトンネル　出口まで ${Math.round(h.tunnelLeft)}m`
          : h.phase === 'exit'
            ? 'まもなく出口です　MIRAI MOTORS 本店方面'
            : h.phase === 'gate'
              ? 'ETC　料金は 0円 です'
              : h.phase === 'arrive'
                ? 'みらいIC から 3分　MIRAI MOTORS'
                : 'みらい自動車道　下り';
      put('msg', msg.current, m);
      stage.current?.style.setProperty('--exit', h.exit.toFixed(3));
    };
    void import('@/lib/works/drive/scene').then(({ mountDrive }) => {
      if (dead) return;
      ctl.current = mountDrive(el, { reduced, narrow, onFrame, onReady: () => setReady(true) });
    });
    let lastY = scrollY;
    const onScroll = () => {
      const s = hero.current;
      if (!s) return;
      const r = s.getBoundingClientRect();
      const span = Math.max(1, r.height - innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / span));
      ctl.current?.setProgress(p);
      stage.current?.style.setProperty('--p', p.toFixed(4));
      const dy = scrollY - lastY;
      lastY = scrollY;
      if (r.bottom > 0 && p < 0.56) ctl.current?.throttle(dy);
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      dead = true;
      removeEventListener('scroll', onScroll);
      ctl.current?.dispose();
      ctl.current = null;
    };
  }, []);

  return (
    <section id="top" className="drv-hero" ref={hero}>
      <div className={`drv-stage ${ready ? 'is-ready' : ''}`} ref={stage}>
        <div
          className="drv-gl"
          ref={gl}
          role="img"
          aria-label="夜の高速道路を一人称で走る映像。スクロールすると加速し、頭上の案内標識から各ページへ移動できます。"
        />
        <div className="drv-shade" aria-hidden="true" />
        <div className="drv-hits">
          {HIT_PANELS.map((p) => (
            <button
              key={p.id}
              hidden
              className="drv-hit"
              ref={(n) => {
                hits.current[p.id] = n;
              }}
              aria-label={`案内標識：${p.label}`}
              onClick={() => go(p.target)}
            >
              <span>
                {p.label}
                <ArrowUpRight size={13} />
              </span>
            </button>
          ))}
        </div>

        <div className="drv-copy">
          <p className="drv-kicker">
            <span>みらい市</span>
            <span>創業 1987年</span>
            <span>販売・車検整備・買取</span>
          </p>
          <h1>
            走りだす前から、
            <br />
            わくわくを。
          </h1>
          <p className="drv-lead">在庫はいつも120台前後。整備工場を併設した、家族経営のクルマ屋です。</p>
          <div className="drv-cta">
            <button className="drv-btn-sign" onClick={() => go('stock')}>
              <b>1</b>在庫車を見る <ArrowRight size={16} />
            </button>
            <button className="drv-btn-line" onClick={() => onInquiry('来店・試乗のご予約（車種未定）')}>
              来店・試乗を予約
            </button>
          </div>
        </div>

        <nav className="drv-route" aria-label="この先の案内">
          <p>この先の案内</p>
          {ROUTE.map((r) => (
            <button
              key={r.t}
              ref={(n) => {
                route.current[r.t] = n;
              }}
              onClick={() => go(r.t)}
            >
              <i className={r.tag.length > 1 ? 'wide' : ''}>{r.tag}</i>
              <span>{r.jp}</span>
              <em
                ref={(n) => {
                  routeKm.current[r.t] = n;
                }}
              >
                —
              </em>
            </button>
          ))}
        </nav>

        <div className="drv-hud" aria-hidden="true">
          <span className="drv-blink l" ref={blinkL}>
            <svg viewBox="0 0 24 24"><path d="M3 12 11 5v4.5h10v5H11V19z" /></svg>
          </span>
          <svg className="drv-tach" viewBox="0 0 200 60">
            <path className="bg" d="M10 55 A 92 92 0 0 1 190 55" pathLength={100} />
            <path className="fg" ref={tach} d="M10 55 A 92 92 0 0 1 190 55" pathLength={100} />
            <path className="red" d="M10 55 A 92 92 0 0 1 190 55" pathLength={100} />
          </svg>
          <div className="drv-speed">
            <span ref={speed}>80</span>
            <small>km/h</small>
          </div>
          <div className="drv-meta">
            <span ref={gear}>D5</span>
            <span>
              ODO <b ref={odo}>048,213</b> km
            </span>
            <span>
              TRIP <b ref={trip}>0.0</b>
            </span>
          </div>
          <span className="drv-blink r" ref={blinkR}>
            <svg viewBox="0 0 24 24"><path d="M21 12 13 5v4.5H3v5h10V19z" /></svg>
          </span>
        </div>
        <p className="drv-msg" ref={msg} aria-hidden="true">
          みらい自動車道　下り
        </p>
        <p className="drv-hint" aria-hidden="true">
          <svg viewBox="0 0 24 36">
            <rect x="3" y="2" width="18" height="32" rx="4" />
            <path d="M7 10h10M7 16h10M7 22h10M7 28h10" />
          </svg>
          スクロールで、アクセル
        </p>
        <div className="drv-exitveil" aria-hidden="true">
          <p>
            <b>EXIT 1</b>
            MIRAI MOTORS
          </p>
        </div>
      </div>
    </section>
  );
}


// ── shared bits ────────────────────────────────────────────────────────────

const yen = (n: number) => n.toLocaleString('ja-JP');
const noop = () => () => {};
const todayKey = () => new Date().toDateString();
const subReduced = (cb: () => void) => {
  const m = matchMedia('(prefers-reduced-motion: reduce)');
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};

/** Odometer-style rolling digits. */
function Roll({ value, className = '' }: { value: string; className?: string }) {
  const chars = value.split('');
  return (
    <span className={`drv-roll ${className}`}>
      <span className="drv-sr">{value}</span>
      {chars.map((c, i) => {
        const key = chars.length - i;
        if (!/\d/.test(c))
          return (
            <span key={`s${key}${c}`} className="drv-roll-s" aria-hidden="true">
              {c}
            </span>
          );
        return (
          <span key={`d${key}`} className="drv-roll-d" aria-hidden="true">
            <span style={{ transform: `translateY(${-Number(c) * 10}%)` }}>
              {'0123456789'.split('').map((d) => (
                <i key={d}>{d}</i>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Wheel({ cx, cy, r, spokes, fill, offroad }: { cx: number; cy: number; r: number; spokes: number; fill: string; offroad?: boolean }) {
  const rr = r * (offroad ? 0.55 : 0.64);
  const w1 = spokes > 6 ? 1.1 : 1.9;
  const w2 = spokes > 6 ? 2.2 : 4.2;
  const sp = `M${cx - w1} ${cy - r * 0.16}L${cx + w1} ${cy - r * 0.16}L${cx + w2} ${cy - rr + 1.2}L${cx - w2} ${cy - rr + 1.2}Z`;
  return (
    <g className="drv-wheel">
      <circle cx={cx} cy={cy} r={r} fill="#0e1012" />
      <circle cx={cx} cy={cy} r={r - 1.6} fill="none" stroke="#25292e" strokeWidth={1.3} />
      {offroad && (
        <g className="drv-rim">
          {Array.from({ length: 20 }, (_, i) => (
            <rect key={i} x={cx - 2.2} y={cy - r - 0.6} width={4.4} height={5} rx={1} fill="#1b1e22" transform={`rotate(${i * 18} ${cx} ${cy})`} />
          ))}
          <circle cx={cx} cy={cy} r={rr + 3} fill="none" stroke="#2b2f34" strokeWidth={1} />
        </g>
      )}
      <g className="drv-rim">
        <circle cx={cx} cy={cy} r={rr} fill="#1d2126" />
        <circle cx={cx} cy={cy} r={rr * 0.72} fill="#3a3f45" />
        {Array.from({ length: spokes }, (_, i) => (
          <path key={i} d={sp} fill={fill} transform={`rotate(${(i * 360) / spokes} ${cx} ${cy})`} />
        ))}
        <circle cx={cx} cy={cy} r={rr} fill="none" stroke="#d3d8dc" strokeWidth={1.4} />
        <circle cx={cx} cy={cy} r={r * 0.15} fill="#aeb5bb" />
        <circle cx={cx} cy={cy} r={r * 0.05} fill="#50565c" />
      </g>
    </g>
  );
}

/** Side-elevation illustration, recoloured by body paint. */
function CarSvg({ shape, color, className = '', dims }: { shape: Shape; color: string; className?: string; dims?: [number, number] }) {
  const a = carArt(shape);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const topY = G - a.H;
  const belt = (G - a.belt - topY) / (G - topY);
  const light = shade(color, 0.42);
  const dark = shade(color, -0.42);
  const deep = shade(color, -0.72);
  let view = a.view;
  if (dims) {
    const [x, yy, w, h] = a.view.split(' ').map(Number);
    view = `${x - 8} ${yy - 18} ${w + 40} ${h + 46}`;
  }
  return (
    <svg viewBox={view} className={`drv-car ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={`b${id}`} x1="0" y1={topY} x2="0" y2={G} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={light} />
          <stop offset={Math.max(0.01, belt - 0.06)} stopColor={shade(color, 0.16)} />
          <stop offset={belt + 0.03} stopColor={color} />
          <stop offset={Math.min(0.99, belt + 0.2)} stopColor={shade(color, -0.08)} />
          <stop offset="0.86" stopColor={dark} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <linearGradient id={`s${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.72" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.8" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#0a0e13" />
          <stop offset="0.7" stopColor="#1d2731" />
          <stop offset="1" stopColor="#35424e" />
        </linearGradient>
        <radialGradient id={`r${id}`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#eef1f3" />
          <stop offset="1" stopColor="#8e969d" />
        </radialGradient>
        <radialGradient id={`h${id}`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.75" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`c${id}`}>
          <path d={a.body} />
        </clipPath>
        <clipPath id={`d${id}`}>
          <path d={a.dlo} />
        </clipPath>
      </defs>
      <ellipse cx={a.L / 2} cy={G + 1} rx={a.L * 0.56} ry={7} fill={`url(#h${id})`} />
      <g className="drv-carbody">
        <path d={a.body} fill={`url(#b${id})`} />
        <g clipPath={`url(#c${id})`}>
          <rect x={-20} y={topY - 10} width={a.L + 40} height={a.H + 20} fill={`url(#s${id})`} />
          <path d={a.sill} fill="#07080a" opacity={0.5} />
          <path d={a.crease} fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={1.1} />
          <path d={a.crease} fill="none" stroke={deep} strokeOpacity={0.5} strokeWidth={0.8} transform="translate(0 1.4)" />
          <path d={a.doors} fill="none" stroke={deep} strokeOpacity={0.85} strokeWidth={0.9} />
          <path d={a.doors} fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth={0.7} transform="translate(0.9 0)" />
          {a.slide && <path d={a.slide} stroke="#0a0c0f" strokeWidth={2.2} strokeLinecap="round" />}
          <rect x={a.fuel.x} y={a.fuel.y} width={11} height={9} rx={2} fill="none" stroke={deep} strokeOpacity={0.7} strokeWidth={0.8} />
        </g>
        <path d={a.dlo} fill={`url(#g${id})`} />
        <g clipPath={`url(#d${id})`}>
          {a.pillars.map((p, i) => (
            <path key={i} d={p} fill={`url(#b${id})`} />
          ))}
          {a.darkPillars.map((p, i) => (
            <path key={i} d={p} fill="#07090b" />
          ))}
          <path d={a.glare} fill="#fff" opacity={0.09} />
        </g>
        <path d={a.dlo} fill="none" stroke="#050607" strokeWidth={1.6} strokeLinejoin="round" />
        {a.cladding && <path d={a.arches} fill="none" stroke="#16181c" strokeWidth={15} />}
        {a.lip && <path d={a.lip} fill="none" stroke="#5a6068" strokeWidth={1.4} />}
        {a.skid && <path d={a.skid} fill="#9aa1a8" stroke="#5a6067" strokeWidth={0.6} />}
        <path d={a.arches} fill="none" stroke={deep} strokeWidth={2.2} />
        <path d={a.arches} fill="none" stroke="#fff" strokeOpacity={0.14} strokeWidth={0.8} transform="translate(0 -2.2)" />
        {a.cladding && <path d={a.cladding} fill="#131518" clipPath={`url(#c${id})`} />}
        {a.rails && <path d={a.rails} fill="#1a1c1f" stroke="#4a4f55" strokeWidth={0.7} />}
        <path d={a.head} fill="#f6f2e4" stroke="#8b8f93" strokeWidth={0.6} />
        <path d={a.head} fill="#fff" opacity={0.6} className="drv-car-drl" />
        <path d={a.tail} fill="#a8121b" stroke="#4a0609" strokeWidth={0.6} />
        <path d={a.mirror} fill={`url(#b${id})`} stroke={deep} strokeWidth={0.6} />
        <path d={a.handles} fill={deep} opacity={0.8} />
      </g>
      {a.wheels.map((w, i) => (
        <Wheel key={i} {...w} spokes={a.spokes} offroad={a.offroad} fill={`url(#r${id})`} />
      ))}
      {dims && (
        <g className="drv-dims">
          <path d={`M0 ${G + 14}H${a.L}M0 ${G + 9}v10M${a.L} ${G + 9}v10`} />
          <text x={a.L / 2} y={G + 28}>
            全長 {dims[0].toLocaleString()} mm
          </text>
          <path d={`M${a.L + 16} ${G}V${topY}M${a.L + 11} ${G}h10M${a.L + 11} ${topY}h10`} />
          <text x={a.L + 22} y={topY - 6} className="end">
            全高 {dims[1].toLocaleString()} mm
          </text>
        </g>
      )}
    </svg>
  );
}

function SignTag({ tag, jp, en }: { tag: string; jp: string; en: string }) {
  return (
    <p className="drv-tag">
      <b className={tag.length > 1 ? 'wide' : ''}>{tag}</b>
      <span>{jp}</span>
      <i>{en}</i>
    </p>
  );
}

// ── 在庫車 ─────────────────────────────────────────────────────────────────

const SORTS = [
  ['rec', 'おすすめ順'],
  ['price', '価格の安い順'],
  ['year', '年式の新しい順'],
  ['km', '走行距離の少ない順'],
] as const;
const KMS = [
  [0, '指定なし'],
  [30000, '3万km以下'],
  [50000, '5万km以下'],
  [80000, '8万km以下'],
] as const;

function Stock({ onInquiry }: { onInquiry: (s?: string) => void }) {
  const [body, setBody] = useState<BodyKey | 'all'>('all');
  const [budget, setBudget] = useState(350);
  const [kmMax, setKmMax] = useState(0);
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>('rec');
  const [open, setOpen] = useState<Car | null>(null);
  const list = useMemo(() => {
    const l = CARS.filter(
      (c) => (body === 'all' || c.body === body) && (budget >= 350 || c.total <= budget * 10000) && (!kmMax || c.km <= kmMax),
    );
    if (sort === 'price') l.sort((a, b) => a.total - b.total);
    if (sort === 'year') l.sort((a, b) => b.year - a.year);
    if (sort === 'km') l.sort((a, b) => a.km - b.km);
    return l;
  }, [body, budget, kmMax, sort]);
  const cond = [body === 'all' ? '' : BODY.find((b) => b.key === body)!.jp, budget < 350 ? `${budget}万円以下` : '', kmMax ? `${kmMax / 10000}万km以下` : '']
    .filter(Boolean)
    .join('・');

  return (
    <section id="stock" className="drv-sec drv-stock">
      <header className="drv-head">
        <SignTag tag="1" jp="在庫車" en="Stock Cars" />
        <h2>
          並んでいるのは、
          <br />
          次に走りだす一台。
        </h2>
        <p>
          展示中の車はすべて自社工場で点検・整備済み。価格は諸費用込みの「支払総額」でご案内しているので、あとから費用が増えることはありません。
        </p>
      </header>

      <div className="drv-filter" role="group" aria-label="在庫の絞り込み">
        <div className="drv-f-body">
          <span className="drv-f-label">ボディタイプ</span>
          <div className="drv-chips">
            <button aria-pressed={body === 'all'} onClick={() => setBody('all')}>
              すべて
            </button>
            {BODY.map((b) => (
              <button key={b.key} aria-pressed={body === b.key} onClick={() => setBody(b.key)}>
                <BodyIcon shape={BODY_SHAPE[b.key]} />
                {b.jp}
              </button>
            ))}
          </div>
        </div>
        <label className="drv-f-range">
          <span className="drv-f-label">
            予算（支払総額）<b>{budget >= 350 ? '上限なし' : `${budget}万円まで`}</b>
          </span>
          <input type="range" min={60} max={350} step={10} value={budget} onChange={(e) => setBudget(Number(e.target.value))} style={{ ['--v' as string]: `${((budget - 60) / 290) * 100}%` }} />
        </label>
        <div className="drv-f-km">
          <span className="drv-f-label">走行距離</span>
          <div className="drv-chips small">
            {KMS.map(([v, l]) => (
              <button key={v} aria-pressed={kmMax === v} onClick={() => setKmMax(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <label className="drv-f-sort">
          <span className="drv-f-label">並べ替え</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            {SORTS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="drv-count" aria-live="polite">
        該当 <Roll value={String(list.length).padStart(2, '0')} /> 台<span>／ 在庫 {CARS.length} 台（サンプル）</span>
      </p>

      {list.length ? (
        <ul className="drv-grid">
          {list.map((c) => (
            <li key={c.id}>
              <article className="drv-card">
                <div className="drv-card-stage">
                  <span className="drv-card-type">{BODY.find((b) => b.key === c.body)!.en}</span>
                  <CarSvg shape={c.shape} color={c.paint.hex} />
                  <span className="drv-card-road" aria-hidden="true" />
                </div>
                <div className="drv-card-body">
                  <p className="drv-card-maker">{c.maker}</p>
                  <h3>
                    <button className="drv-card-hit" onClick={() => setOpen(c)} aria-haspopup="dialog">
                      {c.model}
                      <small>{c.grade}</small>
                    </button>
                  </h3>
                  <dl className="drv-card-spec">
                    <div>
                      <dt>年式</dt>
                      <dd>{c.year}</dd>
                    </div>
                    <div>
                      <dt>走行</dt>
                      <dd>{(c.km / 10000).toFixed(1)}万km</dd>
                    </div>
                    <div>
                      <dt>車検</dt>
                      <dd>{c.shaken.replace('年', '.').replace('月', '')}</dd>
                    </div>
                    <div>
                      <dt>修復歴</dt>
                      <dd className={c.repair === 'なし' ? '' : 'warn'}>{c.repair === 'なし' ? 'なし' : 'あり'}</dd>
                    </div>
                  </dl>
                  <p className="drv-card-price">
                    <span>支払総額</span>
                    <b>{man(c.total)}</b>
                    <small>万円</small>
                    <em>本体 {man(c.base)}万円</em>
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <div className="drv-empty">
          <p>条件に合う在庫が、いまはありません。</p>
          <p>全国のオークションからお探しすることもできます。ご希望をお聞かせください。</p>
          <button className="drv-btn" onClick={() => onInquiry(`在庫探しのご依頼：${cond || '条件なし'}`)}>
            この条件で探してもらう <ArrowRight size={16} />
          </button>
        </div>
      )}
      {open && <CarDetail car={open} onClose={() => setOpen(null)} onInquiry={onInquiry} />}
    </section>
  );
}

function BodyIcon({ shape }: { shape: Shape }) {
  const a = carArt(shape);
  return (
    <svg className="drv-bodyicon" viewBox={a.view} aria-hidden="true">
      <path d={a.body} />
      {a.wheels.map((w, i) => (
        <circle key={i} cx={w.cx} cy={w.cy} r={w.r * 0.86} />
      ))}
    </svg>
  );
}

const TERMS = [24, 36, 48, 60, 84];

function CarDetail({ car, onClose, onInquiry }: { car: Car; onClose: () => void; onInquiry: (s?: string) => void }) {
  const [paint, setPaint] = useState(car.paint);
  const maxDown = Math.floor(car.total / 100000) * 10;
  const [down, setDown] = useState(Math.min(30, maxDown));
  const [n, setN] = useState(60);
  const [rate, setRate] = useState(3.9);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const principal = Math.max(0, car.total - down * 10000);
  const m = monthly(principal, rate, n);
  const loanTotal = m * n;
  const dlg = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    const prev = document.activeElement as HTMLElement | null;
    if (!d.open) d.showModal();
    closeRef.current?.focus();
    // clicking the backdrop (the dialog box itself, outside the panel) closes it
    const onDown = (e: MouseEvent) => e.target === d && onCloseRef.current();
    d.addEventListener('click', onDown);
    const o = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      d.removeEventListener('click', onDown);
      document.body.style.overflow = o;
      prev?.focus();
    };
  }, []);
  // the shared inquiry form takes over from the drawer
  const send = (text: string) => {
    onClose();
    onInquiry(text);
  };
  const summary = `${car.maker} ${car.model} ${car.grade}（${car.year}年式・${paint.name}・支払総額${man(car.total)}万円）／ローン試算：頭金${down}万円・${n}回・金利${rate.toFixed(1)}% → 月々約${yen(m)}円`;
  const spec: [string, string][] = [
    ['年式', `${car.year}年`],
    ['走行距離', `${yen(car.km)} km`],
    ['車検満了', car.shaken],
    ['修復歴', car.repair],
    ['排気量', car.cc],
    ['燃費（WLTC）', car.fuel],
    ['乗車定員', `${car.seats}名`],
    ['駆動 / ミッション', `${car.drive} / ${car.mission}`],
    ['保証', car.tags.includes('メーカー保証') ? 'メーカー保証継承＋当社保証1年' : '当社保証 1年・走行無制限'],
  ];
  return (
    <dialog
      ref={dlg}
      className="drv-modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="drv-panel">
        <header className="drv-panel-head">
          <div>
            <p>
              {car.maker}　<span>{BODY.find((b) => b.key === car.body)!.jp}</span>
            </p>
            <h3 id={titleId}>
              {car.model} <small>{car.grade}</small>
            </h3>
          </div>
          <button ref={closeRef} className="drv-close" onClick={onClose} aria-label="閉じる">
            <X size={20} />
          </button>
        </header>
        <div className="drv-panel-stage" key={car.id}>
          <CarSvg shape={car.shape} color={paint.hex} dims={[car.size[0], car.size[2]]} className="drv-drivein" />
        </div>
        <div className="drv-swatches" role="group" aria-label="ボディカラー">
          {car.paints.map((p) => (
            <button key={p.hex} aria-pressed={p.hex === paint.hex} onClick={() => setPaint(p)} aria-label={p.name}>
              <i style={{ background: p.hex }} />
            </button>
          ))}
          <span>
            {paint.name}
            {paint.hex !== car.paint.hex && <em>※同型車のカラー見本です。在庫車は{car.paint.name}です。</em>}
          </span>
        </div>
        <div className="drv-panel-cols">
          <div>
            <p className="drv-panel-note">{car.note}</p>
            <dl className="drv-specs">
              {spec.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd className={k === '修復歴' && v !== 'なし' ? 'warn' : ''}>{v}</dd>
                </div>
              ))}
            </dl>
            <ul className="drv-tags">
              {car.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="drv-loan">
            <p className="drv-loan-total">
              支払総額 <b>{man(car.total)}</b>万円<span>（本体 {man(car.base)}万円＋諸費用）</span>
            </p>
            <div className="drv-monthly">
              <span>月々のお支払い</span>
              <p>
                <Roll value={yen(m)} />
                <small>円 × {n}回</small>
              </p>
              <em>
                ローンお支払総額 {yen(loanTotal + down * 10000)}円（頭金含む）・ボーナス払いなし
              </em>
            </div>

            <label className="drv-f-range">
              <span className="drv-f-label">
                頭金 <b>{down}万円</b>
              </span>
              <input type="range" min={0} max={maxDown} step={5} value={down} onChange={(e) => setDown(Number(e.target.value))} style={{ ['--v' as string]: `${(down / Math.max(1, maxDown)) * 100}%` }} />
            </label>
            <div>
              <span className="drv-f-label">お支払い回数</span>
              <div className="drv-chips small">
                {TERMS.map((t) => (
                  <button key={t} aria-pressed={n === t} onClick={() => setN(t)}>
                    {t}回
                  </button>
                ))}
              </div>
            </div>
            <label className="drv-f-range">
              <span className="drv-f-label">
                金利（実質年率） <b>{rate.toFixed(1)}%</b>
              </span>
              <input type="range" min={1.9} max={7.9} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} style={{ ['--v' as string]: `${((rate - 1.9) / 6) * 100}%` }} />
            </label>
            <p className="drv-fine">試算は目安です。実際の金利・お支払い額は審査により決まります。</p>
          </div>
        </div>
        <footer className="drv-panel-foot">
          <button className="drv-btn" onClick={() => send(`来店・試乗の予約：${summary}`)}>
            <CalendarDays size={17} />
            来店・試乗を予約
          </button>
          <button className="drv-btn ghost" onClick={() => send(`お見積もりのご依頼：${summary}`)}>
            この条件で見積もりを依頼
          </button>
        </footer>
      </div>
    </dialog>
  );
}

// ── 車検・整備 ─────────────────────────────────────────────────────────────

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const MARK = ['×', '△', '○', '◎'];

function Service({ onInquiry }: { onInquiry: (s?: string) => void }) {
  const [cls, setCls] = useState('m');
  const row = SHAKEN.find((r) => r.key === cls)!;
  const legal = row.weight + row.jibai + row.stamp;
  const total = row.basic + legal;
  const [part, setPart] = useState(PARTS[3].id);
  const [scanX, setScanX] = useState(PARTS[3].x);
  const cur = PARTS.find((p) => p.id === part)!;
  const [menu, setMenu] = useState<(typeof MENUS)[number]['key']>('shaken');
  const today = useSyncExternalStore(noop, todayKey, () => '');
  const days = useMemo(() => {
    if (!today) return [];
    const t = new Date(today);
    return Array.from({ length: 14 }, (_, i) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1 + i));
  }, [today]);
  const [day, setDay] = useState(-1);
  const [slot, setSlot] = useState(-1);
  const [loaner, setLoaner] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const pick = (p: (typeof PARTS)[number]) => {
    setPart(p.id);
    setScanX(p.x);
  };
  const toSvgX = (clientX: number) => {
    const s = svgRef.current;
    if (!s) return 0;
    const r = s.getBoundingClientRect();
    const vb = s.viewBox.baseVal;
    return vb.x + ((clientX - r.left) / r.width) * vb.width;
  };
  const scan = (clientX: number) => {
    const x = Math.max(0, Math.min(400, toSvgX(clientX)));
    setScanX(x);
    const near = PARTS.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
    if (Math.abs(near.x - x) < 36) setPart(near.id);
  };
  const d = days[day];
  const menuJp = MENUS.find((m) => m.key === menu)!.jp;
  const menuLabel = menu === 'shaken' ? `車検（${row.jp}）` : menuJp;
  const dateLabel = d ? `${d.getMonth() + 1}月${d.getDate()}日(${WEEK[d.getDay()]})` : '';
  const ready = day >= 0 && slot >= 0;
  const a = carArt('compact');

  return (
    <section id="service" className="drv-sec drv-service">
      <header className="drv-head">
        <SignTag tag="2" jp="車検・整備" en="Inspection & Service" />
        <h2>
          買ったあとも、
          <br />
          この工場が主治医です。
        </h2>
        <p>
          店の裏手に、国の指定を受けた整備工場があります。車検は最短60分の立会い型。どこを診て、なぜ交換するのか、整備士が車の前でご説明します。
        </p>
      </header>

      <div className="drv-toll">
        <div className="drv-toll-board">
          <p className="drv-toll-title">
            車検料金<span>SHAKEN FEES・税込</span>
          </p>
          <div className="drv-toll-rows">
            <div className="drv-toll-th" aria-hidden="true">
              <span>車両区分</span>
              <span>車検基本料</span>
              <span>法定費用</span>
              <span>合計の目安</span>
            </div>
            {SHAKEN.map((r) => (
              <button key={r.key} aria-pressed={cls === r.key} onClick={() => setCls(r.key)}>
                <span className="cls">
                  <svg viewBox="0 0 40 20" aria-hidden="true" style={{ width: `${24 + r.w * 18}px` }}>
                    <path d="M2 15 L3 10 L10 9 L15 4 L27 4 L33 9 L38 10 L38 15Z" />
                    <circle cx="10" cy="15" r="3" />
                    <circle cx="30" cy="15" r="3" />
                  </svg>
                  <b>{r.jp}</b>
                  <small>{r.note}</small>
                </span>
                <span className="led" data-l="基本料">{yen(r.basic)}</span>
                <span className="led dim" data-l="法定費用">{yen(r.weight + r.jibai + r.stamp)}</span>
                <span className="led big" data-l="合計">{yen(r.basic + r.weight + r.jibai + r.stamp)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="drv-toll-break">
          <p>
            {row.jp}の内訳<span>合計 <Roll value={yen(total)} />円</span>
          </p>
          <div className="drv-bar" aria-hidden="true">
            <i style={{ flexGrow: row.basic }} className="seg-b" />
            <i style={{ flexGrow: row.weight }} className="seg-w" />
            <i style={{ flexGrow: row.jibai }} className="seg-j" />
            <i style={{ flexGrow: row.stamp }} className="seg-s" />
          </div>
          <dl>
            <div>
              <dt className="seg-b">車検基本料</dt>
              <dd>{yen(row.basic)}円</dd>
            </div>
            <div>
              <dt className="seg-w">重量税</dt>
              <dd>{yen(row.weight)}円</dd>
            </div>
            <div>
              <dt className="seg-j">自賠責保険（24ヶ月）</dt>
              <dd>{yen(row.jibai)}円</dd>
            </div>
            <div>
              <dt className="seg-s">印紙代</dt>
              <dd>{yen(row.stamp)}円</dd>
            </div>
          </dl>
          <p className="drv-fine">部品交換が必要な場合は、作業前にお見積もりをお出しします。重量税はエコカー減税・経過年数で変わります。</p>
        </div>
      </div>

      <div className="drv-xray">
        <div className="drv-xray-view">
          <p className="drv-xray-cap">
            <Wrench size={14} /> 点検箇所を選ぶと、その部分を透かして見られます
          </p>
          <div className="drv-xray-car">
            <svg
              ref={svgRef}
              viewBox={a.view}
              className="drv-xray-svg"
              style={{ ['--scan' as string]: `${scanX}px` }}
              onPointerDown={(e) => {
                dragging.current = true;
                (e.target as Element).setPointerCapture?.(e.pointerId);
                scan(e.clientX);
              }}
              onPointerMove={(e) => dragging.current && scan(e.clientX)}
              onPointerUp={() => (dragging.current = false)}
              onPointerCancel={() => (dragging.current = false)}
              aria-hidden="true"
            >
              <defs>
                <clipPath id="drv-scan-clip">
                  <rect className="drv-scan-rect" x={-60} y={0} width={120} height={260} />
                </clipPath>
                <clipPath id="drv-body-clip">
                  <path d={a.body} />
                  {a.wheels.map((w, i) => (
                    <circle key={i} cx={w.cx} cy={w.cy} r={w.r + 1} />
                  ))}
                  <path d="M380 70 L440 50 L440 110 Z" />
                </clipPath>
                <linearGradient id="drv-scan-g" x1="0" x2="1">
                  <stop offset="0" stopColor="#7fd8ff" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#7fd8ff" stopOpacity="0.12" />
                  <stop offset="1" stopColor="#7fd8ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* solid car */}
              <path d={a.body} className="xr-solid" />
              <path d={a.dlo} className="xr-glass" />
              {a.wheels.map((w, i) => (
                <circle key={i} cx={w.cx} cy={w.cy} r={w.r} className="xr-tire" />
              ))}
              {/* x-ray layer: the scan band, cut to the car's silhouette */}
              <rect x={-60} y={G - a.H - 20} width={120} height={a.H + 30} fill="url(#drv-scan-g)" className="drv-scan-rect" />
              <g clipPath="url(#drv-body-clip)">
              <g clipPath="url(#drv-scan-clip)">
                <rect x={-20} y={0} width={460} height={260} className="xr-bg" />
                <g className="xr-lines">
                  <path d={a.body} />
                  <path d={a.dlo} />
                  <path d={a.doors} />
                  {/* seats */}
                  <path d="M150 150 L150 118 Q150 106 160 106 L166 106 Q172 106 170 116 L166 150 Z M160 104 L166 92 L174 94 L170 106" />
                  <path d="M232 150 L232 118 Q232 106 242 106 L248 106 Q254 106 252 116 L248 150 Z M242 104 L248 92 L256 94 L252 106" />
                  {/* steering */}
                  <path d="M262 112 L280 124 M258 108 a8 8 0 1 0 12 -8" />
                  {/* exhaust + fuel tank */}
                  <path d="M300 176 L120 180 L40 178 L14 172" className="thin" />
                  <rect x={96} y={160} width={48} height={16} rx={4} />
                  {/* drive shaft & suspension */}
                  <path d="M318 170 L300 168" />
                  <path d="M318 150 l-4 -4 8 -4 -8 -4 8 -4 -8 -4 8 -4" className={part === 'brake' ? 'hot' : ''} />
                  <path d="M62 150 l-4 -4 8 -4 -8 -4 8 -4 -8 -4 8 -4" />
                </g>
                {/* engine */}
                <g className={`xr-part ${part === 'oil' ? 'hot' : ''}`}>
                  <rect x={330} y={112} width={46} height={36} rx={4} />
                  <path d="M334 112 v-6 h38 v6 M338 122 h30 M338 130 h30 M338 138 h30" />
                  <path d="M352 148 q-5 8 0 12 q5 -4 0 -12 Z" className="fill" />
                </g>
                {/* battery */}
                <g className={`xr-part ${part === 'battery' ? 'hot' : ''}`}>
                  <rect x={312} y={98} width={26} height={16} rx={2} />
                  <path d="M317 98 v-3 h4 v3 M329 98 v-3 h4 v3 M318 106 h4 M320 104 v4 M330 106 h4" />
                </g>
                {/* headlight beam */}
                <g className={`xr-part ${part === 'light' ? 'hot' : ''}`}>
                  <path d={a.head} />
                  <path d="M396 76 L430 64 M396 80 L432 80 M396 84 L430 94" className="thin" />
                </g>
                {/* brakes + tyres */}
                {a.wheels.map((w, i) => (
                  <g key={i} className={`xr-part ${(i === 1 && part === 'brake') || (i === 0 && part === 'tire') ? 'hot' : ''}`}>
                    <circle cx={w.cx} cy={w.cy} r={w.r - 1} />
                    <circle cx={w.cx} cy={w.cy} r={w.r - 7} className="thin" />
                    <circle cx={w.cx} cy={w.cy} r={w.r * 0.52} />
                    <path d={`M${w.cx + w.r * 0.28} ${w.cy - w.r * 0.46} a${w.r * 0.54} ${w.r * 0.54} 0 0 1 ${w.r * 0.26} ${w.r * 0.36}`} className="caliper" />
                    {Array.from({ length: 12 }, (_, k) => {
                      const an = (k / 12) * Math.PI * 2;
                      return (
                        <path
                          key={k}
                          d={`M${w.cx + Math.cos(an) * (w.r - 1)} ${w.cy + Math.sin(an) * (w.r - 1)} L${w.cx + Math.cos(an) * (w.r - 5)} ${w.cy + Math.sin(an) * (w.r - 5)}`}
                          className="thin"
                        />
                      );
                    })}
                  </g>
                ))}
              </g>
              </g>
              <line className="drv-scan-line" x1={0} x2={0} y1={G - a.H - 20} y2={G + 8} />
            </svg>
            {PARTS.map((p, i) => (
              <button
                key={p.id}
                className="drv-hot"
                aria-pressed={part === p.id}
                aria-label={`${String(i + 1).padStart(2, '0')} ${p.jp}`}
                style={{ left: `${((p.x - -14) / (a.L + 28)) * 100}%`, top: `${((p.y - (G - a.H - 14)) / (a.H + 26)) * 100}%` }}
                onClick={() => pick(p)}
              >
                {String(i + 1).padStart(2, '0')}
              </button>
            ))}
          </div>
          <div className="drv-parts" role="group" aria-label="点検箇所">
            {PARTS.map((p, i) => (
              <button key={p.id} aria-pressed={part === p.id} onClick={() => pick(p)}>
                <b>{String(i + 1).padStart(2, '0')}</b>
                {p.jp}
              </button>
            ))}
          </div>
        </div>
        <div className="drv-xray-info" aria-live="polite">
          <p className="drv-xray-code">
            CHECK {String(PARTS.findIndex((p) => p.id === part) + 1).padStart(2, '0')}
          </p>
          <h3>{cur.jp}</h3>
          <ul>
            {cur.items.map((t) => (
              <li key={t}>
                <Check size={15} />
                {t}
              </li>
            ))}
          </ul>
          <dl>
            <div>
              <dt>交換の目安</dt>
              <dd>{cur.cycle}</dd>
            </div>
            <div>
              <dt>費用の目安</dt>
              <dd>{cur.cost}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="drv-reserve">
        <div className="drv-reserve-head">
          <h3>
            <CalendarDays size={18} /> 入庫のご予約
          </h3>
          <p>2週間先までの空き状況です。水曜は定休日です。</p>
        </div>
        <ol className="drv-steps">
          <li>
            <span className="drv-step-n">1</span>
            <div>
              <p className="drv-f-label">メニュー</p>
              <div className="drv-chips">
                {MENUS.map((m) => (
                  <button key={m.key} aria-pressed={menu === m.key} onClick={() => setMenu(m.key)}>
                    {m.jp}
                    <small>{m.note}</small>
                  </button>
                ))}
              </div>
            </div>
          </li>
          <li>
            <span className="drv-step-n">2</span>
            <div>
              <p className="drv-f-label">日にち</p>
              <div className="drv-days">
                {days.length === 0 && <p className="drv-fine">読み込み中…</p>}
                {days.map((dd, i) => {
                  const closed = dd.getDay() === 3;
                  const lv = closed ? 0 : Math.max(...SLOTS.map((_, k) => availability(dd, k)));
                  return (
                    <button
                      key={i}
                      aria-pressed={day === i}
                      disabled={closed || lv === 0}
                      className={`${dd.getDay() === 0 ? 'sun' : dd.getDay() === 6 ? 'sat' : ''}`}
                      onClick={() => {
                        setDay(i);
                        setSlot(-1);
                      }}
                      aria-label={`${dd.getMonth() + 1}月${dd.getDate()}日 ${WEEK[dd.getDay()]}曜日 ${closed ? '定休日' : ['満車', '残りわずか', '空きあり', '空き多数'][lv]}`}
                    >
                      <small>{i === 0 || dd.getDate() === 1 ? `${dd.getMonth() + 1}月` : ' '}</small>
                      <b>{dd.getDate()}</b>
                      <span>{WEEK[dd.getDay()]}</span>
                      <i>{closed ? '休' : MARK[lv]}</i>
                    </button>
                  );
                })}
              </div>
            </div>
          </li>
          <li>
            <span className="drv-step-n">3</span>
            <div>
              <p className="drv-f-label">時間</p>
              <div className="drv-chips small">
                {SLOTS.map((t, k) => {
                  const lv = d ? availability(d, k) : 0;
                  return (
                    <button key={t} aria-pressed={slot === k} disabled={!d || lv === 0} onClick={() => setSlot(k)}>
                      {t}
                      <small>{d ? (lv === 0 ? '満' : MARK[lv]) : '—'}</small>
                    </button>
                  );
                })}
              </div>
              <label className="drv-check">
                <input type="checkbox" checked={loaner} onChange={(e) => setLoaner(e.target.checked)} />
                代車を希望する（無料・要予約）
              </label>
            </div>
          </li>
        </ol>
        <div className="drv-reserve-foot">
          <p>
            {ready ? (
              <>
                <b>{menuLabel}</b>　{dateLabel} {SLOTS[slot]} 入庫{loaner ? '・代車あり' : ''}
              </>
            ) : (
              '日にちと時間を選んでください'
            )}
          </p>
          <button
            className="drv-btn"
            disabled={!ready}
            onClick={() => onInquiry(`${menuLabel}のご予約：${dateLabel} ${SLOTS[slot]} 入庫${loaner ? '・代車希望' : ''}${menu === 'shaken' ? `（見積 ${yen(total)}円〜）` : ''}`)}
          >
            この内容で予約を申し込む <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

// ── 買取査定 ───────────────────────────────────────────────────────────────

function Buy({ onInquiry }: { onInquiry: (s?: string) => void }) {
  const [body, setBody] = useState<BodyKey>('suv');
  const [year, setYear] = useState(2019);
  const [km, setKm] = useState(42000);
  const [lo, hi] = estimate(body, year, km);
  const MAXV = 400;
  const ang = (v: number) => -180 + (Math.min(MAXV, v) / MAXV) * 180;
  const pt = (v: number, r: number) => {
    const t = (ang(v) * Math.PI) / 180;
    return [160 + Math.cos(t) * r, 170 + Math.sin(t) * r];
  };
  const [lx, ly] = pt(lo, 128);
  const [hx, hy] = pt(hi, 128);
  const bodyJp = BODY.find((b) => b.key === body)!.jp;
  return (
    <section id="buy" className="drv-sec drv-buy">
      <header className="drv-head">
        <SignTag tag="JCT" jp="買取査定" en="Trade-in Appraisal" />
        <h2>
          乗り換えの前に、
          <br />
          いまの愛車の値段を。
        </h2>
        <p>ボディタイプ・年式・走行距離の3つで、買取価格のおおよその幅がわかります。実車査定は30分ほど。その場で金額をお伝えします。</p>
      </header>
      <div className="drv-est">
        <ol className="drv-est-steps">
          <li>
            <p className="drv-f-label">
              <span className="drv-step-n">1</span>ボディタイプ
            </p>
            <div className="drv-chips">
              {BODY.map((b) => (
                <button key={b.key} aria-pressed={body === b.key} onClick={() => setBody(b.key)}>
                  <BodyIcon shape={BODY_SHAPE[b.key]} />
                  {b.jp}
                </button>
              ))}
            </div>
          </li>
          <li>
            <label className="drv-f-range">
              <span className="drv-f-label">
                <span className="drv-step-n">2</span>年式
                <b>
                  {year}年<small>（{2026 - year}年落ち）</small>
                </b>
              </span>
              <input type="range" min={2008} max={2025} step={1} value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ['--v' as string]: `${((year - 2008) / 17) * 100}%` }} />
            </label>
          </li>
          <li>
            <label className="drv-f-range">
              <span className="drv-f-label">
                <span className="drv-step-n">3</span>走行距離
                <b className="drv-odo">
                  <Roll value={String(km).padStart(6, '0')} /> km
                </b>
              </span>
              <input type="range" min={0} max={200000} step={1000} value={km} onChange={(e) => setKm(Number(e.target.value))} style={{ ['--v' as string]: `${(km / 200000) * 100}%` }} />
            </label>
          </li>
          <li className="drv-flow">
            <p className="drv-f-label">査定の流れ</p>
            <ol>
              <li>
                <b>1</b>ここで目安を確認
              </li>
              <li>
                <b>2</b>来店か出張で実車査定（約30分）
              </li>
              <li>
                <b>3</b>その場で金額をご提示・最短翌日お振込み
              </li>
            </ol>
          </li>
        </ol>
        <div className="drv-meter">
          <svg viewBox="0 0 320 200" aria-hidden="true">
            <path d="M32 170 A128 128 0 0 1 288 170" className="dm-track" />
            {Array.from({ length: 41 }, (_, i) => {
              const [x1, y1] = pt(i * 10, i % 10 === 0 ? 110 : 118);
              const [x2, y2] = pt(i * 10, 124);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={i % 10 === 0 ? 'dm-major' : 'dm-minor'} />;
            })}
            {[0, 100, 200, 300, 400].map((v) => {
              const [x, y2] = pt(v, 94);
              return (
                <text key={v} x={x} y={y2 + 4} className="dm-num">
                  {v}
                </text>
              );
            })}
            <path d={`M${lx} ${ly} A128 128 0 0 1 ${hx} ${hy}`} className="dm-band" />
            <g className="dm-needle" style={{ transform: `rotate(${ang((lo + hi) / 2) + 90}deg)` }}>
              <path d="M160 170 L157 162 L160 58 L163 162 Z" />
            </g>
            <circle cx={160} cy={170} r={9} className="dm-hub" />
            <text x={160} y={196} className="dm-unit">
              万円
            </text>
          </svg>
          <div className="drv-meter-read" aria-live="polite">
            <span>買取価格の目安</span>
            <p>
              <Roll value={String(lo)} />
              <i>〜</i>
              <Roll value={String(hi)} />
              <small>万円</small>
            </p>
          </div>
          <button className="drv-btn" onClick={() => onInquiry(`買取査定：${bodyJp}／${year}年式／${(km / 10000).toFixed(1)}万km（目安 ${lo}〜${hi}万円）`)}>
            この条件で査定を申し込む <ArrowRight size={16} />
          </button>
          <p className="drv-fine">グレード・色・装備・傷の状態で金額は変わります。ローンが残っている車もご相談ください。</p>
        </div>
      </div>
    </section>
  );
}

// ── 本店・アクセス ──────────────────────────────────────────────────────────

const ROUTE_D = 'M118 214 C 150 214 170 206 186 196 L 238 164 C 252 156 262 160 270 170 L 296 204 C 302 212 312 216 324 213 L 346 206';

function Access({ onInquiry }: { onInquiry: (s?: string) => void }) {
  const reduced = useSyncExternalStore(subReduced, () => matchMedia('(prefers-reduced-motion: reduce)').matches, () => true);
  return (
    <section id="access" className="drv-sec drv-access">
      <header className="drv-head">
        <SignTag tag="P" jp="本店・アクセス" en="Showroom & Garage" />
        <h2>
          みらいIC を降りて、
          <br />
          3分です。
        </h2>
        <p>1987年、父が小さな整備工場として始めた店を、いまは兄妹で営んでいます。展示場の奥が整備工場。買ったあとも、同じ顔ぶれがお迎えします。</p>
      </header>
      <div className="drv-access-body">
        <div className="drv-shop">
          <dl>
            <div>
              <dt>
                <Clock size={15} /> 営業時間
              </dt>
              <dd>
                10:00 – 19:00<small>整備工場の受付は 18:00 まで</small>
              </dd>
            </div>
            <div>
              <dt>
                <CalendarDays size={15} /> 定休日
              </dt>
              <dd>
                毎週水曜日<small>祝日は営業・年末年始休業</small>
              </dd>
            </div>
            <div>
              <dt>
                <MapPin size={15} /> 住所
              </dt>
              <dd>
                〒289-0000 みらい市はやて町 3丁目18-1<small>みらい自動車道「みらいIC」から約3分</small>
              </dd>
            </div>
            <div>
              <dt>
                <Phone size={15} /> 電話
              </dt>
              <dd>
                0000-00-1987<small>整備直通 0000-00-1988</small>
              </dd>
            </div>
            <div>
              <dt>
                <Wrench size={15} /> 設備
              </dt>
              <dd>
                指定整備工場（民間車検場）・リフト6基<small>展示場 屋内10台・屋外110台／駐車場 30台／代車 12台</small>
              </dd>
            </div>
          </dl>
          <div className="drv-facts">
            <p>
              <Roll value="1987" />
              <span>創業</span>
            </p>
            <p>
              <Roll value="9" />
              <span>整備士（うち検査員 3名）</span>
            </p>
            <p>
              <Roll value="1,400" />
              <span>年間の車検台数</span>
            </p>
          </div>
          <button className="drv-btn" onClick={() => onInquiry('来店のご予約（本店）')}>
            <CarIcon size={17} /> 来店を予約する
          </button>
        </div>
        <figure className="drv-map">
          <svg viewBox="0 0 480 330" role="img" aria-label="みらいICからMIRAI MOTORS本店までの案内図。ICを出て県道を左へ、みらい川を渡ってすぐです。">
            <defs>
              <pattern id="drv-blocks" width="26" height="22" patternUnits="userSpaceOnUse">
                <rect x="2" y="2" width="22" height="18" rx="2" fill="#12171d" />
              </pattern>
              <radialGradient id="drv-pin-glow">
                <stop offset="0" stopColor="#ffae45" stopOpacity="0.55" />
                <stop offset="1" stopColor="#ffae45" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="480" height="330" fill="#0b0f13" />
            <rect width="480" height="330" fill="url(#drv-blocks)" opacity="0.9" />
            <path d="M-10 250 C 80 236 150 270 230 250 S 390 200 490 226 L 490 262 C 390 238 320 290 230 286 S 70 272 -10 288 Z" className="dmap-river" />
            <text x="40" y="282" className="dmap-label river">みらい川</text>
            <path d="M-10 80 L 490 40" className="dmap-rail" />
            <path d="M-10 80 L 490 40" className="dmap-rail-dash" />
            <rect x="196" y="52" width="36" height="12" rx="3" transform="rotate(-4.6 214 58)" className="dmap-station" />
            <text x="236" y="46" className="dmap-label">みらい駅</text>
            <path d="M-10 150 L 490 110" className="dmap-hw" />
            <path d="M-10 150 L 490 110" className="dmap-hw-core" />
            <text x="330" y="112" className="dmap-label hw" transform="rotate(-4.6 330 112)">みらい自動車道</text>
            {/* trumpet interchange */}
            <path d="M92 142 C 96 170 104 190 118 214 M140 138 C 150 160 150 184 132 198 C 118 208 100 200 100 184 C 100 168 116 162 128 170" className="dmap-ramp" />
            <rect x="110" y="204" width="20" height="8" rx="2" className="dmap-gate" />
            <text x="40" y="232" className="dmap-label">みらいIC</text>
            <path d="M118 214 L -10 214" className="dmap-road" />
            <path d="M346 206 L 346 330 M 186 196 L 186 330 M 238 164 L 238 0 M 300 206 L 490 206" className="dmap-road thin" />
            <path d={ROUTE_D} className="dmap-road" />
            <path d={ROUTE_D} className="dmap-route" />
            {!reduced && (
              <circle r="4.5" className="dmap-car">
                <animateMotion dur="5s" repeatCount="indefinite" path={ROUTE_D} rotate="auto" />
              </circle>
            )}
            <circle cx="346" cy="206" r="34" fill="url(#drv-pin-glow)" />
            <path d="M346 206 l-9 -16 a10.5 10.5 0 1 1 18 0 Z" className="dmap-pin" />
            <circle cx="346" cy="182" r="3.6" fill="#0b0f13" />
            <text x="364" y="184" className="dmap-label shop">MIRAI MOTORS</text>
            <text x="364" y="198" className="dmap-label small">本店・整備工場</text>
            <text x="364" y="214" className="dmap-label time">IC出口から 約3分</text>
            <g className="dmap-n" transform="translate(448 34)">
              <path d="M0 -14 L6 6 L0 2 L-6 6 Z" />
              <text y="20">N</text>
            </g>
          </svg>
          <figcaption>案内図はイメージです（架空の町の地図）。</figcaption>
        </figure>
      </div>
      <p className="drv-fine drv-sample">掲載内容（店舗・在庫・価格・地図）はすべて架空の制作サンプルです。</p>
    </section>
  );
}

/** Headlight sweep across section titles + the lane line alongside the page. */
function useRoadMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.site-drive');
    if (!root) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const heads = [...root.querySelectorAll<HTMLElement>('.drv-head')];
    if (reduced) {
      heads.forEach((h) => h.style.setProperty('--beam', '1'));
      return;
    }
    let raf = 0;
    const run = () => {
      raf = 0;
      const vh = innerHeight;
      root.style.setProperty('--sy', String(Math.round(scrollY)));
      for (const h of heads) {
        const r = h.getBoundingClientRect();
        const t = Math.min(1, Math.max(0, (vh * 0.92 - r.top) / (vh * 0.55)));
        h.style.setProperty('--beam', t.toFixed(3));
      }
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    run();
    addEventListener('scroll', on, { passive: true });
    addEventListener('resize', on);
    return () => {
      removeEventListener('scroll', on);
      removeEventListener('resize', on);
      cancelAnimationFrame(raf);
    };
  }, []);
}

export default function DriveSite({ onInquiry }: { onInquiry: (summary?: string) => void }) {
  useRoadMotion();
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Barlow:wght@500;600&family=Barlow+Condensed:wght@500;600&display=swap"
        precedence="default"
      />
      <DriveHero onInquiry={onInquiry} />
      <div className="drv-road">
        <Stock onInquiry={onInquiry} />
        <Service onInquiry={onInquiry} />
        <Buy onInquiry={onInquiry} />
        <Access onInquiry={onInquiry} />
      </div>
    </>
  );
}
