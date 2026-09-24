'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDown, ChevronLeft, ChevronRight, Minus, Plus, MapPin, Phone, Clock, Truck } from 'lucide-react';
import {
  produce,
  produceById,
  seasonWords,
  seasonNotes,
  weekdays,
  dayState,
  key,
  specialDays,
  shops,
  boardItems,
  boardWord,
  type ProduceId,
} from '@/lib/works/yaoya/data';
import type { NorenCtl } from '@/lib/works/yaoya/noren';
import type { BoardCtl } from '@/lib/works/yaoya/chalk';
import type { BasketCtl } from '@/lib/works/yaoya/basket';

const KANJI_MONTH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`;

const noop = () => () => {};
function useReduced() {
  return useSyncExternalStore(
    noop,
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}
/** a clock that only notifies when the value at `unit` granularity changes */
function makeClock(unit: 'minute' | 'day') {
  let cur: Date | null = null;
  let stamp = '';
  const tag = (d: Date) => (unit === 'day' ? key(d) : `${key(d)} ${d.getHours()}:${d.getMinutes()}`);
  const read = () => {
    const d = new Date();
    const t = tag(d);
    if (t !== stamp) {
      stamp = t;
      cur = d;
    }
    return cur;
  };
  const subscribe = (cb: () => void) => {
    const t = setInterval(cb, 30_000);
    return () => clearInterval(t);
  };
  return { subscribe, read };
}
const minuteClock = makeClock('minute');
const dayClock = makeClock('day');
const useClock = (c: ReturnType<typeof makeClock>) => useSyncExternalStore(c.subscribe, c.read, () => null);

function status(now: Date) {
  const st = dayState(now);
  if (!st.open) return { open: false, tag: '本日休業', note: st.label === '定休日' ? '日曜・祝日は定休日です' : st.label ?? '' };
  const h = now.getHours() + now.getMinutes() / 60;
  const close = st.kind === 'short' && /17:00/.test(st.label ?? '') ? 17 : 19;
  if (h < 9) return { open: false, tag: '準備中', note: '本日 9:00 開店' };
  if (h >= close) return { open: false, tag: '本日終了', note: 'また明日、店先で' };
  return { open: true, tag: '営業中', note: `本日 ${close}:00 まで` };
}

/* ------------------------------------------------------------------ */
/* shared bits                                                         */
/* ------------------------------------------------------------------ */
function Crest({ className = '', title, box }: { className?: string; title?: string; box?: [number, number, number] }) {
  const clip = `yy-crest-${useId().replace(/:/g, '')}`;
  const daikon = (
    <>
      <path d="M-8.5 -4 C-10.5 10 -6 28 0 40 C6 28 10.5 10 8.5 -4 Q0 -1 -8.5 -4Z" />
      <path d="M0 -6 C-7 -14 -7.5 -28 0 -38 C7.5 -28 7 -14 0 -6Z" />
      <path d="M0 -6 C-7 -14 -7.5 -23 0 -33 C7.5 -23 7 -14 0 -6Z" transform="rotate(-28.6)" />
      <path d="M0 -6 C-7 -14 -7.5 -23 0 -33 C7.5 -23 7 -14 0 -6Z" transform="rotate(28.6)" />
    </>
  );
  return (
    <svg
      className={className}
      viewBox="-50 -50 100 100"
      {...(box ? { x: box[0], y: box[1], width: box[2], height: box[2] } : {})}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d="M0 -49A49 49 0 1 1 0 49A49 49 0 1 1 0 -49ZM0 -41A41 41 0 1 0 0 41A41 41 0 1 0 0 -41Z" fillRule="evenodd" fill="currentColor" />
      <clipPath id={clip}>
        <circle r="37" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <g transform="rotate(35.5) translate(0 -2)" fill="currentColor">
          {daikon}
        </g>
        <g transform="rotate(-35.5) translate(0 -2)" fill="currentColor" stroke="var(--yy-crest-gap, #1d2f4f)" strokeWidth="5" paintOrder="stroke" strokeLinejoin="round">
          {daikon}
        </g>
      </g>
    </svg>
  );
}

function ProduceIcon({ id, size, className = '' }: { id: ProduceId; size: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let dead = false;
    void import('@/lib/works/yaoya/paint').then(({ paintProduce, spec }) => {
      if (dead) return;
      const sp = spec[id];
      const dpr = Math.min(2, devicePixelRatio || 1);
      const k = size / Math.max(sp.w * 0.6, sp.h);
      const img = paintProduce(id, Math.round(k * dpr * 20) / 20);
      cv.width = Math.round(sp.w * k * dpr);
      cv.height = Math.round(sp.h * k * dpr);
      cv.style.width = `${sp.w * k}px`;
      cv.style.height = `${sp.h * k}px`;
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    });
    return () => {
      dead = true;
    };
  }, [id, size]);
  return <canvas ref={ref} className={`yy-icon ${className}`} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* hero: the noren                                                     */
/* ------------------------------------------------------------------ */
function Hero({ now, reduced }: { now: Date | null; reduced: boolean }) {
  const section = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<NorenCtl | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let dead = false;
    const narrow = matchMedia('(max-width: 760px)').matches;
    void import('@/lib/works/yaoya/noren').then(({ mountNoren }) => {
      if (dead || !host.current) return;
      ctl.current = mountNoren(host.current, { reduced, narrow, onReady: () => setReady(true) });
    });
    return () => {
      dead = true;
      ctl.current?.dispose();
      ctl.current = null;
    };
  }, [reduced]);
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    let raf = 0;
    const upd = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / span));
      el.style.setProperty('--p', p.toFixed(4));
      ctl.current?.setProgress(p);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(upd);
    };
    upd();
    addEventListener('scroll', on, { passive: true });
    addEventListener('resize', on);
    return () => {
      removeEventListener('scroll', on);
      removeEventListener('resize', on);
      cancelAnimationFrame(raf);
    };
  }, []);
  const enter = () => {
    const el = section.current;
    if (!el) return;
    if (reduced) {
      document.getElementById('today')?.scrollIntoView({ block: 'start' });
      return;
    }
    const top = el.getBoundingClientRect().top + scrollY;
    const end = top + el.offsetHeight - innerHeight;
    // walk through slowly enough to feel the cloth part
    const from = scrollY,
      dist = end - from + 2,
      dur = 2200;
    const t0 = performance.now();
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      scrollTo(0, from + dist * e);
      if (k < 1) requestAnimationFrame(tick);
      else html.style.scrollBehavior = prev;
    };
    requestAnimationFrame(tick);
  };
  const st = now ? status(now) : null;
  return (
    <section id="top" ref={section} className={`yy-hero ${ready ? 'is-ready' : ''}`}>
      <div className="yy-hero-stage">
        <div className="yy-hero-poster" aria-hidden="true">
          <Crest className="yy-hero-poster-crest" />
        </div>
        <div className="yy-hero-gl" ref={host} aria-hidden="true" />
        <div className="yy-hero-fade" aria-hidden="true" />
        <div className="yy-hero-copy">
          <p className="yy-hero-kicker">みらい銀座商店街の八百屋 ／ 創業 昭和三十八年</p>
          {st && (
            <p className={`yy-hero-status ${st.open ? 'is-open' : ''}`}>
              <b>{st.tag}</b>
              {st.note}
            </p>
          )}
          <h1>
            <span>のれんをくぐって、</span>
            <span>今日の旬を。</span>
          </h1>
          <p className="yy-hero-lead">
            朝いちばんに市場で選んだ野菜と果物を、
            <br />
            商店街の角で、夫婦ふたりで売っています。
          </p>
          <button type="button" className="yy-enter" onClick={enter}>
            <span>のれんをくぐる</span>
            <ArrowDown size={16} aria-hidden="true" />
          </button>
        </div>
        <div className={`yy-fuda ${st && !st.open ? 'is-closed' : ''}`} role="status">
          <span className="yy-fuda-string" aria-hidden="true" />
          <span className="yy-fuda-plate">
            <b>{st ? st.tag : '営業中'}</b>
          </span>
          <small>{st ? st.note : '9:00〜19:00'}</small>
        </div>
        <p className="yy-hero-hint" aria-hidden="true">
          <span className="yy-hint-fine">のれんに触れると、布がゆれます</span>
          <span className="yy-hint-touch">のれんを指でかき分けられます</span>
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 今日の入荷: the chalkboard                                          */
/* ------------------------------------------------------------------ */
function Today({ now, reduced }: { now: Date | null; reduced: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!now || !cv.current) return;
    let dead = false;
    let ctl: BoardCtl | null = null;
    void import('@/lib/works/yaoya/chalk').then(({ mountBoard }) => {
      if (dead || !cv.current) return;
      ctl = mountBoard(cv.current, { reduced, date: now });
    });
    return () => {
      dead = true;
      ctl?.dispose();
    };
  }, [now, reduced]);
  return (
    <section id="today" className="yy-today">
      <div className="yy-today-head">
        <p className="yy-kicker">毎朝 7時半ごろ、市場から戻って書きます</p>
        <h2>今日の入荷</h2>
      </div>
      <div className="yy-board">
        <div className="yy-board-slate">
          <canvas ref={cv} aria-hidden="true" />
        </div>
        <div className="yy-board-tray" aria-hidden="true">
          <i className="c1" />
          <i className="c2" />
          <i className="c3" />
          <span className="yy-eraser" />
        </div>
      </div>
      <div className="yy-sr">
        <h3>本日の入荷 {now ? md(now) : ''}</h3>
        <ul>
          {boardItems.map((b) => (
            <li key={b.name}>
              {b.name}（{b.origin}）{b.unit} {b.price}円
            </li>
          ))}
        </ul>
        <p>店主のひとこと：{boardWord.join('')}</p>
      </div>
      <p className="yy-today-note">
        売り切れのときはごめんなさい。入荷のようすは店頭の黒板と同じものをここに載せています。
        <a href="#order">気になる品は取り置きできます →</a>
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 店先 + 取り置き                                                     */
/* ------------------------------------------------------------------ */
const tiers: ProduceId[][] = [
  ['cabbage', 'daikon', 'hakusai'],
  ['negi', 'imo', 'carrot'],
  ['tomato', 'nasu', 'kaki'],
  ['mikan', 'shiitake', 'onion'],
];
function Display({ id }: { id: ProduceId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let dead = false;
    const paint = () =>
      void import('@/lib/works/yaoya/paint').then(({ paintDisplay, DISP_W, DISP_H }) => {
        if (dead) return;
        const w = cv.clientWidth || 240;
        const dpr = Math.min(2, devicePixelRatio || 1);
        const s = Math.round(((w * dpr) / DISP_W) * 20) / 20;
        const img = paintDisplay(id, produceById[id].holder, s);
        cv.width = Math.round(DISP_W * s);
        cv.height = Math.round(DISP_H * s);
        cv.getContext('2d')!.drawImage(img, 0, 0);
      });
    void document.fonts.ready.then(paint);
    return () => {
      dead = true;
    };
  }, [id]);
  return <canvas ref={ref} className="yy-display" aria-hidden="true" />;
}

function Order({ onInquiry, now, reduced }: { onInquiry: (s?: string) => void; now: Date | null; reduced: boolean }) {
  const section = useRef<HTMLElement>(null);
  const well = useRef<HTMLDivElement>(null);
  const basket = useRef<BasketCtl | null>(null);
  const [cart, setCart] = useState<Partial<Record<ProduceId, number>>>({});
  const [bump, setBump] = useState(0);
  const [landed, setLanded] = useState<ProduceId | null>(null);
  const pointer = useRef<'mouse' | 'touch'>('touch');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('17:00');
  const [method, setMethod] = useState<'店頭' | '配達'>('店頭');

  useEffect(() => {
    let dead = false;
    void import('@/lib/works/yaoya/basket').then(({ mountBasket }) => {
      if (dead || !well.current || !section.current) return;
      basket.current = mountBasket({
        well: well.current,
        section: section.current,
        reduced,
        onLand: (id) => {
          setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
          setBump((b) => b + 1);
          setLanded(id);
        },
      });
    });
    return () => {
      dead = true;
      basket.current?.dispose();
      basket.current = null;
    };
  }, [reduced]);

  const days = useMemo(() => {
    if (!now) return [] as { k: string; label: string }[];
    const out: { k: string; label: string }[] = [];
    const d = new Date(now);
    const lateToday = now.getHours() + now.getMinutes() / 60 > 17.5;
    for (let i = 0; out.length < 3 && i < 14; i++) {
      const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      if (!dayState(dd).open) continue;
      if (i === 0 && lateToday) continue;
      out.push({ k: key(dd), label: `${i === 0 ? '今日 ' : i === 1 ? '明日 ' : ''}${md(dd)}` });
    }
    return out;
  }, [now]);
  const times = ['10:00', '12:00', '15:00', '17:00', '18:30'];
  const timeOk = (t: string) => {
    if (!now || !days.length || (days.some((d) => d.k === day) ? day : days[0].k) !== key(now)) return true;
    const [h, m] = t.split(':').map(Number);
    return h + m / 60 >= now.getHours() + now.getMinutes() / 60 + 1;
  };

  const dayEff = days.some((d) => d.k === day) ? day : (days[0]?.k ?? '');
  const timeEff = timeOk(time) ? time : (times.find(timeOk) ?? time);
  const lines = produce.filter((p) => (cart[p.id] ?? 0) > 0);
  const count = lines.reduce((a, p) => a + (cart[p.id] ?? 0), 0);
  const total = lines.reduce((a, p) => a + p.price * (cart[p.id] ?? 0), 0);
  const freeLeft = Math.max(0, 3000 - total);

  const add = (id: ProduceId, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    if (basket.current) basket.current.throwFrom(id, r.left + r.width / 2, r.top + r.height * 0.4);
    else setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  };
  const dec = (id: ProduceId) => {
    setCart((c) => {
      const n = (c[id] ?? 0) - 1;
      const next = { ...c };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });
    basket.current?.remove(id);
  };
  const inc = (id: ProduceId) => {
    const el = document.querySelector<HTMLElement>(`[data-produce="${id}"]`);
    if (el) add(id, el);
  };
  const submit = () => {
    const d = days.find((x) => x.k === dayEff);
    const items = lines.map((p) => `${p.name}${p.unit.startsWith('1') ? '' : `(${p.unit})`}×${cart[p.id]}`).join('、');
    onInquiry(`かご：${items}／合計${yen(total)}／受取：${d ? d.label.replace(/^(今日|明日) /, '') : ''} ${timeEff}・${method === '店頭' ? '店頭' : '配達'}`);
  };
  const landedP = landed ? produceById[landed] : null;

  return (
    <section id="order" ref={section} className="yy-order">
      <div className="yy-order-head">
        <p className="yy-kicker">店先 ／ 取り置き</p>
        <h2>
          手にとって、
          <br />
          かごへ。
        </h2>
        <p>
          平台の野菜をつかんで、かごへ放ってください。タップやクリックでも、ひょいと入ります。
          お代は受け取りのときに、店頭でいただきます。
        </p>
      </div>
      <div className="yy-order-body">
        <div className="yy-stand" role="group" aria-label="店先の平台">
          {tiers.map((row, ri) => (
            <div className={`yy-tier yy-tier-${ri + 1}`} key={ri}>
              {row.map((id) => {
                const p = produceById[id];
                return (
                  <div className="yy-slot" key={id}>
                    <button
                      type="button"
                      className="yy-item"
                      data-produce={id}
                      aria-label={`${p.origin}の${p.pop}、${p.unit} ${p.price}円。かごに入れる`}
                      onPointerDown={(e) => {
                        if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
                          pointer.current = 'mouse';
                          if (e.button !== 0) return;
                          e.preventDefault();
                          if (basket.current) basket.current.grab(id, e.nativeEvent);
                          else setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
                        } else pointer.current = 'touch';
                      }}
                      onClick={(e) => {
                        if (pointer.current === 'mouse' && e.detail > 0) return;
                        add(id, e.currentTarget);
                      }}
                    >
                      <Display id={id} />
                    </button>
                    <div className={`yy-pop yy-pop-${p.paper}`} aria-hidden="true">
                      <span className="yy-pop-origin">
                        {p.origin}
                        <i>{p.unit}</i>
                      </span>
                      <strong>{p.pop}</strong>
                      <span className="yy-pop-price">
                        <b>{p.price}</b>円
                      </span>
                      <em>{p.talk}</em>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <aside className="yy-cart" aria-label="取り置きかご">
          <div className="yy-cart-dock">
            <div className="yy-cart-well" ref={well}>
            </div>
            <div className="yy-cart-sum" aria-live="polite">
              <span key={bump} className={bump ? 'is-bump' : ''}>
                {count ? `${count}点` : 'かごは空です'}
              </span>
              <b>{yen(total)}</b>
              {landedP && <small className="yy-cart-landed">{landedP.name}が入りました</small>}
            </div>
            <a className="yy-cart-jump" href="#yy-cart-form">
              内容を見る
            </a>
          </div>
          <div className="yy-cart-form" id="yy-cart-form">
            <h3>取り置きメモ</h3>
            {lines.length === 0 ? (
              <p className="yy-cart-hint">まだ何も入っていません。平台から選んでください。</p>
            ) : (
              <ul className="yy-cart-list">
                {lines.map((p) => (
                  <li key={p.id}>
                    <span className="yy-cart-name">
                      {p.pop}
                      <small>
                        {p.unit}・{p.price}円
                      </small>
                    </span>
                    <span className="yy-qty">
                      <button type="button" onClick={() => dec(p.id)} aria-label={`${p.name}をひとつ減らす`}>
                        <Minus size={14} />
                      </button>
                      <output>{cart[p.id]}</output>
                      <button type="button" onClick={() => inc(p.id)} aria-label={`${p.name}をひとつ増やす`}>
                        <Plus size={14} />
                      </button>
                    </span>
                    <span className="yy-cart-sub">{yen(p.price * (cart[p.id] ?? 0))}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="yy-cart-total">
              <span>合計（税込）</span>
              <b>{yen(total)}</b>
            </div>
            <div className="yy-free" aria-live="polite">
              <div className="yy-free-bar">
                <i style={{ width: `${Math.min(100, (total / 3000) * 100)}%` }} />
              </div>
              <p>{freeLeft > 0 ? `あと ${yen(freeLeft)} で商店街まわりの配達が無料` : '配達無料の金額になりました'}</p>
            </div>
            <div className="yy-picks">
              <label>
                受け取り日
                <select value={dayEff} onChange={(e) => setDay(e.target.value)}>
                  {days.map((d) => (
                    <option key={d.k} value={d.k}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                時間
                <select value={timeEff} onChange={(e) => setTime(e.target.value)}>
                  {times.map((t) => (
                    <option key={t} value={t} disabled={!timeOk(t)}>
                      {t}ごろ
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide">
                受け取りかた
                <select value={method} onChange={(e) => setMethod(e.target.value as '店頭' | '配達')}>
                  <option value="店頭">店頭で受け取る</option>
                  <option value="配達">{total >= 3000 ? '配達してもらう（無料）' : '配達してもらう（300円）'}</option>
                </select>
              </label>
            </div>
            <button type="button" className="yy-submit" disabled={count === 0} onClick={submit}>
              取り置きを頼む
            </button>
            <p className="yy-cart-fine">
              取り置きは受け取り日の閉店までお預かりします。お支払いは店頭（配達は玄関先）で。
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 旬の早見盤                                                          */
/* ------------------------------------------------------------------ */
function Season({ now }: { now: Date | null }) {
  const cur = now ? now.getMonth() + 1 : 9;
  const [picked, setAngle] = useState<number | null>(null);
  const angle = picked ?? -(cur - 1) * 30;
  const [dragging, setDragging] = useState(false);
  const month = ((((Math.round(-angle / 30) % 12) + 12) % 12) + 1) as number;
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ a0: number; start: number } | null>(null);
  const angleAt = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const go = (m: number) => {
    // rotate the shortest way to month m
    const target = -(m - 1) * 30;
    let d = (target - angle) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    setAngle(angle + d);
  };
  const inSeason = produce.filter((p) => p.months.includes(month));
  const R0 = 64,
    R1 = 268;
  const wedge = (i: number) => {
    const a0 = ((i * 30 - 15 - 90) * Math.PI) / 180,
      a1 = ((i * 30 + 15 - 90) * Math.PI) / 180;
    const p = (r: number, a: number) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
    return `M${p(R0, a0)} L${p(R1, a0)} A${R1} ${R1} 0 0 1 ${p(R1, a1)} L${p(R0, a1)} A${R0} ${R0} 0 0 0 ${p(R0, a0)}Z`;
  };
  return (
    <section id="season" className="yy-season">
      <div className="yy-season-body">
        <div className="yy-dial-wrap">
          <svg
            ref={svg}
            className={`yy-dial ${dragging ? 'is-drag' : ''}`}
            viewBox="-290 -300 580 590"
            role="slider"
            tabIndex={0}
            aria-label="旬の早見盤。左右の矢印キーで月を変えられます"
            aria-valuemin={1}
            aria-valuemax={12}
            aria-valuenow={month}
            aria-valuetext={`${month}月`}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                go((month % 12) + 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                go(((month + 10) % 12) + 1);
              }
            }}
            onPointerDown={(e) => {
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
              drag.current = { a0: angleAt(e), start: angle };
              setDragging(true);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              let d = angleAt(e) - drag.current.a0;
              if (d > 180) d -= 360;
              if (d < -180) d += 360;
              setAngle(drag.current.start + d);
              drag.current.a0 = angleAt(e);
              drag.current.start = drag.current.start + d;
            }}
            onPointerUp={() => {
              drag.current = null;
              setDragging(false);
              setAngle(Math.round(angle / 30) * 30);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDragging(false);
              setAngle(Math.round(angle / 30) * 30);
            }}
          >
            <defs>
              <filter id="yy-paper" x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
                <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 0.16 0" result="g" />
                <feComposite in="g" in2="SourceGraphic" operator="in" result="gi" />
                <feMerge>
                  <feMergeNode in="SourceGraphic" />
                  <feMergeNode in="gi" />
                </feMerge>
              </filter>
              <mask id="yy-window">
                <rect x="-300" y="-300" width="600" height="600" fill="white" />
                <path d={wedge(0)} fill="black" transform="scale(1.001)" />
              </mask>
            </defs>
            <g className="yy-disc" style={{ transform: `rotate(${angle}deg)` }}>
              <circle r="276" className="yy-disc-base" />
              {seasonWords.map((words, i) => (
                <g key={i}>
                  <path d={wedge(i)} className={`yy-sector ${i % 2 ? 'odd' : ''} ${i + 1 === cur ? 'is-now' : ''}`} />
                  <g transform={`rotate(${i * 30})`}>
                    <text className="yy-disc-month" x="0" y="-238" textAnchor="middle">
                      {KANJI_MONTH[i]}
                    </text>
                    {words.slice(0, 3).map((w, j) => (
                      <g key={w} transform={`rotate(${(j - 1) * 8.6})`}>
                        {w.split('').slice(0, 6).map((ch, k) => (
                          <text key={k} className="yy-disc-word" x="0" y={-200 + k * 20} textAnchor="middle" dominantBaseline="central">
                            {ch === 'ー' ? '｜' : ch}
                          </text>
                        ))}
                      </g>
                    ))}
                  </g>
                </g>
              ))}
            </g>
            <g className="yy-cover" pointerEvents="none">
              <circle r="282" mask="url(#yy-window)" className="yy-cover-disc" filter="url(#yy-paper)" />
              <path d={wedge(0)} className="yy-cover-frame" />
              <circle r="60" className="yy-cover-hub" />
              <g className="yy-cover-crest">
                <Crest box={[-40, -40, 80]} />
              </g>
              <text className="yy-cover-title" x="0" y="118" textAnchor="middle">
                旬 の 早 見 盤
              </text>
              <text className="yy-cover-sub" x="0" y="146" textAnchor="middle">
                やおや みらい 謹製
              </text>
              <path d="M0 -296 L-9 -282 L9 -282Z" className="yy-cover-pin" />
            </g>
          </svg>
          <div className="yy-dial-ctrl">
            <button type="button" onClick={() => go(((month + 10) % 12) + 1)} aria-label="前の月">
              <ChevronLeft size={18} />
            </button>
            <output>{month}月</output>
            <button type="button" onClick={() => go((month % 12) + 1)} aria-label="次の月">
              <ChevronRight size={18} />
            </button>
            {month !== cur && (
              <button type="button" className="yy-dial-now" onClick={() => go(cur)}>
                今月にもどす
              </button>
            )}
          </div>
        </div>
        <div className="yy-season-side">
      <div className="yy-season-head">
            <p className="yy-kicker">旬の早見盤</p>
            <h2>いま、おいしいもの。</h2>
            <p>盤をまわすと、その月の旬がのぞき窓に出てきます。店主が一年ぶんの仕入れ帳から書き出しました。</p>
          </div>
        <div className="yy-season-card" aria-live="polite">
          <p className="yy-season-month">
            {KANJI_MONTH[month - 1]}
            <small>{month === cur ? 'の旬・いまの季節' : 'の旬'}</small>
          </p>
          <ul className="yy-season-words">
            {seasonWords[month - 1].map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="yy-season-note">「{seasonNotes[month - 1]}」</p>
          {inSeason.length > 0 && (
            <div className="yy-season-shelf">
              <p>{month === cur ? '今日の店先にも並んでいます' : 'この月に店先に並ぶもの'}</p>
              <div>
                {inSeason.slice(0, 6).map((p) => (
                  <span key={p.id}>
                    <ProduceIcon id={p.id} size={62} />
                    <small>{p.name}</small>
                  </span>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}

function OldPhoto() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let dead = false;
    void Promise.all([import('@/lib/works/yaoya/paint'), document.fonts.load('30px "Yomogi"', '大根円')]).then(([m]) => {
      if (dead) return;
      const W = 640,
        H = 460;
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = W * dpr;
      cv.height = H * dpr;
      const c = cv.getContext('2d')!;
      c.scale(dpr, dpr);
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#6a5a48');
      g.addColorStop(1, '#2a2018');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      for (let i = 0; i < 16; i++) {
        c.fillStyle = `rgba(0,0,0,${0.12 + (i % 3) * 0.05})`;
        c.fillRect(i * 42, 0, 2, H * 0.5);
      }
      c.fillStyle = '#e8dcc0';
      c.font = '400 34px "Yuji Syuku", serif';
      c.textAlign = 'center';
      c.fillText('八百屋 み ら い', W / 2, 62);
      c.fillStyle = '#8a6a44';
      c.fillRect(0, 300, W, 26);
      c.fillStyle = '#5a4028';
      c.fillRect(0, 326, W, H - 326);
      const place: [ProduceId, 'zaru' | 'crate', number, number, number][] = [
        ['daikon', 'crate', 20, 150, 250],
        ['cabbage', 'crate', 230, 140, 230],
        ['mikan', 'zaru', 420, 170, 210],
      ];
      for (const [id, h, x, y, w] of place) c.drawImage(m.paintDisplay(id, h, (w / 320) * dpr), x, y, w, w * (170 / 320));
      const pops: [number, string, string][] = [
        [120, '大根', '30円'],
        [330, 'キャベツ', '25円'],
        [520, 'みかん 一山', '50円'],
      ];
      for (const [x, a, b] of pops) {
        c.save();
        c.translate(x, 312);
        c.rotate((x % 7) * 0.01 - 0.03);
        c.fillStyle = '#f4ecd6';
        c.fillRect(-52, 0, 104, 64);
        c.fillStyle = '#2a2018';
        c.font = '400 17px "Yomogi", cursive';
        c.fillText(a, 0, 24);
        c.font = '400 28px "Yomogi", cursive';
        c.fillText(b, 0, 55);
        c.restore();
      }
      const img = c.getImageData(0, 0, cv.width, cv.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 38;
        d[i] += n;
        d[i + 1] += n;
        d[i + 2] += n;
      }
      c.putImageData(img, 0, 0);
      const v = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.7);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.55)');
      c.fillStyle = v;
      c.fillRect(0, 0, W, H);
    });
    return () => {
      dead = true;
    };
  }, []);
  return (
    <figure className="yy-oldphoto">
      <canvas ref={ref} role="img" aria-label="昭和四十年ごろの店先。大根30円、キャベツ25円の値札" />
      <figcaption>昭和40年ごろの店先。大根が30円だったころ。平台はいまも同じもの。</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* お店のこと                                                          */
/* ------------------------------------------------------------------ */
const dayline = [
  ['4:30', '市場へ', 'まだ真っ暗。軽トラで中央卸売市場へ。'],
  ['5:30', '目利き', '持って、重さで選ぶ。仲卸さんと値段の相談。'],
  ['7:30', '店に戻る', '荷をほどいて、黒板を書く。'],
  ['9:00', 'のれんを出す', '開店。平台に今日の顔ぶれがそろう。'],
  ['14:00', '配達', '商店街のまわりを自転車で。'],
  ['19:00', 'のれんをしまう', '閉店。明日の仕入れを考える。'],
];
const history = [
  ['1963', '昭和38年', '初代・源一が商店街の角で開業。屋号は「これからの町に」と、みらい。'],
  ['1978', '昭和53年', '店を建て替え。いまも使っている平台は、このとき大工さんに作ってもらったもの。'],
  ['1991', '平成3年', '二代目・誠が店を継ぐ。のり子と二人三脚に。'],
  ['2012', '平成24年', 'お年寄りの多い町内へ、配達をはじめる。'],
  ['2026', '令和8年', '取り置きを、ウェブでも受けつけはじめました。'],
];
function Story() {
  const [shop, setShop] = useState('yaoya');
  const sel = shops.find((s) => s.id === shop)!;
  return (
    <section id="story" className="yy-story">
      <div className="yy-story-intro">
        <h2 className="yy-story-title">
          <span>昭和三十八年から、</span>
          <span>この角で。</span>
        </h2>
        <OldPhoto />
        <div className="yy-story-text">
          <p className="yy-kicker">お店のこと</p>
          <p>
            東京オリンピックの前の年。できたばかりの商店街の角に、祖父・高木源一が小さな八百屋を開きました。
            「これからの町に、いい野菜を」。屋号の「みらい」は、そのとき祖父がつけたものです。
          </p>
          <p>
            いま店に立つのは、二代目の高木誠と妻のり子。毎朝4時半に市場へ向かい、自分の目で見て、手で持って、ひとつずつ選んでいます。
          </p>
          <p>
            スーパーのように何でもはそろいません。そのかわり、今日いちばんおいしいものを、食べごろと食べ方といっしょにお渡しします。
          </p>
          <div className="yy-voices">
            <blockquote>
              <p>「野菜は重さで選ぶ。持ってみりゃ、わかる。」</p>
              <cite>二代目 高木 誠</cite>
            </blockquote>
            <blockquote>
              <p>「献立に迷ったら聞いてください。たいてい、うちの晩ごはんの話になりますけど。」</p>
              <cite>高木 のり子</cite>
            </blockquote>
          </div>
        </div>
      </div>

      <div className="yy-day">
        <h3>
          店の一日<small>仕入れは、毎朝の市場から</small>
        </h3>
        <ol>
          {dayline.map(([t, h, d], i) => (
            <li key={t} style={{ '--i': i } as React.CSSProperties}>
              <time>{t}</time>
              <b>{h}</b>
              <span>{d}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="yy-history">
        <h3>みらいの六十余年</h3>
        <ol>
          {history.map(([y, j, t]) => (
            <li key={y}>
              <b>{y}</b>
              <small>{j}</small>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="yy-map" id="access">
        <div className="yy-map-head">
          <h3>みらい銀座商店街</h3>
          <p>となり近所も、みんな「みらい」。お店をえらぶと、ひとことが出ます。</p>
        </div>
        <div className="yy-map-frame">
          <svg viewBox="0 0 720 330" className="yy-map-svg" role="group" aria-label="みらい銀座商店街の地図">
            <defs>
              <filter id="yy-rough" x="-2%" y="-2%" width="104%" height="104%">
                <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="8" />
                <feDisplacementMap in="SourceGraphic" scale="3.2" />
              </filter>
              <pattern id="yy-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#b9ab8c" strokeWidth="1" />
              </pattern>
            </defs>
            <g filter="url(#yy-rough)">
              {/* streets */}
              <rect x="0" y="150" width="720" height="40" className="yy-map-road" />
              <rect x="120" y="0" width="22" height="330" className="yy-map-road" />
              <rect x="634" y="0" width="22" height="330" className="yy-map-road" />
              {/* arcade */}
              <rect x="142" y="146" width="492" height="48" className="yy-map-arcade" />
              {Array.from({ length: 24 }, (_, i) => (
                <line key={i} x1={150 + i * 20.5} y1="147" x2={150 + i * 20.5} y2="193" className="yy-map-rib" />
              ))}
              {/* station */}
              <rect x="6" y="40" width="100" height="92" className="yy-map-station" />
              <line x1="0" y1="24" x2="116" y2="24" className="yy-map-rail" />
              <line x1="0" y1="30" x2="116" y2="30" className="yy-map-rail" />
              {/* shrine & park */}
              <rect x="664" y="36" width="52" height="96" fill="url(#yy-hatch)" className="yy-map-park" />
              <rect x="664" y="206" width="52" height="96" className="yy-map-park" />
              {shops.map((s) => {
                const y = s.side === 'n' ? 46 : 200;
                return <rect key={s.id} x={s.x - 2} y={y} width={s.w - 4} height="96" className={`yy-map-lot ${s.id === 'yaoya' ? 'is-home' : ''}`} />;
              })}
            </g>
            <text x="56" y="92" textAnchor="middle" className="yy-map-label">みらい中央駅</text>
            <text x="56" y="110" textAnchor="middle" className="yy-map-small">北口</text>
            <text x="690" y="178" textAnchor="middle" className="yy-map-small">みらい公園</text>
            <g transform="translate(690 76)" className="yy-map-torii">
              <path d="M-16 -14 H16 M-13 -8 H13 M-10 -14 V16 M10 -14 V16" />
            </g>
            <text x="690" y="118" textAnchor="middle" className="yy-map-small">未来稲荷</text>
            <text x="390" y="175" textAnchor="middle" className="yy-map-street">みらい銀座商店街</text>
            <text x="131" y="270" textAnchor="middle" className="yy-map-small" transform="rotate(-90 131 270)">駅前通り</text>
            {shops.map((s) => {
              const y = s.side === 'n' ? 46 : 200;
              const on = s.id === shop;
              return (
                <g
                  key={s.id}
                  className={`yy-map-shop ${on ? 'is-on' : ''} ${s.id === 'yaoya' ? 'is-home' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  aria-label={`${s.name}（${s.kind}）`}
                  onClick={() => setShop(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setShop(s.id);
                    }
                  }}
                >
                  <rect x={s.x} y={y + 2} width={s.w - 8} height="92" className="yy-map-hit" />
                  <rect x={s.x + 2} y={s.side === 'n' ? y + 80 : y + 2} width={s.w - 12} height="12" fill={s.color} className="yy-map-awning" />
                  {s.id === 'yaoya' &&
                    [0, 1, 2, 3].map((k) => <rect key={k} x={s.x + 8 + k * 18} y={y + 92} width="15" height="14" className="yy-map-noren" />)}
                  <text
                    x={s.x + (s.w - 8) / 2}
                    y={s.side === 'n' ? y + 6 : y + 18}
                    className="yy-map-name"
                    textAnchor="start"
                    style={{ writingMode: 'vertical-rl' } as React.CSSProperties}
                  >
                    {s.name.replace(/\s/g, '')}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="yy-map-card" aria-live="polite">
            <small>{sel.kind}</small>
            <b>{sel.name}</b>
            <p>{sel.note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 営業日カレンダー・ご案内                                              */
/* ------------------------------------------------------------------ */
function Info({ now }: { now: Date | null }) {
  const [off, setOff] = useState(0);
  const base = now ?? new Date(2026, 8, 24);
  const first = new Date(base.getFullYear(), base.getMonth() + off, 1);
  const cells = (() => {
    const out: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) out.push(null);
    const n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= n; d++) out.push(new Date(first.getFullYear(), first.getMonth(), d));
    while (out.length % 7) out.push(null);
    return out;
  })();
  const notes = Object.entries(specialDays).filter(([k]) => k.startsWith(`${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`));
  const todayKey = now ? key(now) : '';
  return (
    <section id="calendar" className="yy-info">
      <div className="yy-cal">
        <div className="yy-cal-head">
          <p className="yy-kicker">営業日カレンダー</p>
          <div className="yy-cal-nav">
            <button type="button" onClick={() => setOff((o) => Math.max(0, o - 1))} disabled={off === 0} aria-label="前の月">
              <ChevronLeft size={18} />
            </button>
            <h2>
              {first.getFullYear()}年<b>{first.getMonth() + 1}</b>月
            </h2>
            <button type="button" onClick={() => setOff((o) => Math.min(3, o + 1))} disabled={off === 3} aria-label="次の月">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <table className="yy-cal-grid">
          <thead>
            <tr>
              {weekdays.map((w, i) => (
                <th key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''} scope="col">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: cells.length / 7 }, (_, r) => (
              <tr key={r}>
                {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
                  if (!d) return <td key={i} />;
                  const s = dayState(d);
                  const k = key(d);
                  return (
                    <td
                      key={i}
                      className={`${s.open ? '' : 'is-off'} ${s.kind ? `k-${s.kind}` : ''} ${k === todayKey ? 'is-today' : ''}`}
                      title={s.label}
                    >
                      <span className="yy-cal-d">{d.getDate()}</span>
                      {!s.open && <span className="yy-cal-mark">休</span>}
                      {s.kind === 'short' && <span className="yy-cal-mark short">短</span>}
                      <span className="yy-sr">{s.open ? (s.label ? `営業（${s.label}）` : '営業') : `休業（${s.label}）`}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="yy-cal-legend">
          <li>
            <span className="yy-cal-mark">休</span>定休日（日曜・祝日）・臨時休業
          </li>
          <li>
            <span className="yy-cal-mark short">短</span>営業時間の変更
          </li>
          {notes.map(([k, v]) => (
            <li key={k} className="yy-cal-note">
              {Number(k.slice(5, 7))}/{Number(k.slice(8))}　{v.note}
            </li>
          ))}
        </ul>
      </div>
      <div className="yy-guide">
        <p className="yy-kicker">ご案内</p>
        <h2>店先で、お待ちしてます。</h2>
        <dl>
          <div>
            <dt>
              <Clock size={16} aria-hidden="true" />
              営業時間
            </dt>
            <dd>
              9:00〜19:00
              <small>定休日：日曜・祝日（臨時休業はカレンダーでお知らせします）</small>
            </dd>
          </div>
          <div>
            <dt>
              <Truck size={16} aria-hidden="true" />
              配達
            </dt>
            <dd>
              商店街のまわり（本町・栄町・みらい台1〜3丁目）
              <small>3,000円以上で無料、それ未満は300円。14時〜17時にお届けします。</small>
            </dd>
          </div>
          <div>
            <dt>取り置き</dt>
            <dd>
              受け取り日の閉店まで
              <small>電話・店頭・このページから。箱買い（みかん・玉ねぎなど）もご相談ください。</small>
            </dd>
          </div>
          <div>
            <dt>お支払い</dt>
            <dd>現金・交通系IC・QRコード決済</dd>
          </div>
          <div>
            <dt>
              <MapPin size={16} aria-hidden="true" />
              所在地
            </dt>
            <dd>
              みらい市本町2-8-5　みらい銀座商店街
              <small>みらい中央駅 北口から徒歩4分。アーケードの中ほど、藍色ののれんが目印です。</small>
            </dd>
          </div>
          <div>
            <dt>
              <Phone size={16} aria-hidden="true" />
              電話
            </dt>
            <dd>042-555-0831</dd>
          </div>
        </dl>
        <p className="yy-fine">掲載内容（店名・人物・価格・住所・電話番号）はすべて架空の制作サンプルです。</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export default function YaoyaSite({ onInquiry }: { onInquiry: (summary?: string) => void }) {
  const reduced = useReduced();
  const now = useClock(minuteClock);
  const stableNow = useClock(dayClock);
  const inquiry = useCallback((s?: string) => onInquiry(s), [onInquiry]);
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Yomogi&family=Yuji+Syuku&display=swap"
        precedence="default"
      />
      <Hero now={now} reduced={reduced} />
      <Today now={stableNow} reduced={reduced} />
      <Order onInquiry={inquiry} now={now} reduced={reduced} />
      <Season now={stableNow} />
      <Story />
      <Info now={stableNow} />
    </>
  );
}
