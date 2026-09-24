'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bus,
  Car,
  Check,
  Clock,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  Smartphone,
  Square,
  Train,
  Volume2,
  X,
} from 'lucide-react';
import { parseRuby, pick, plain, norm, reading, type Tx } from '@/lib/works/city/ruby';
import {
  events,
  extras,
  windows,
  winByNo,
  categories,
  news,
  copy,
  type Step,
  type Where,
  type Online,
  type LifeEvent,
} from '@/lib/works/city/content';
import { pictos, type Prim } from '@/lib/works/city/pictos';
import * as F from '@/lib/works/city/floor';
import {
  items as gomiItems,
  kinds,
  districts,
  suggestions,
  nextDate,
  fmtDate,
  relDay,
  kindsOn,
  type Kind,
} from '@/lib/works/city/gomi';
import { initQueue, step as qStep, ticketNo, type QueueState } from '@/lib/works/city/queue';

/* ================================================================== */
/* language context: やさしい日本語                                      */
/* ================================================================== */
const Lang = createContext({ easy: false });
const noop = () => () => {};

function R({ s }: { s: string }) {
  return (
    <span className="cy-r">
      {parseRuby(s).map((seg, i) =>
        typeof seg === 'string' ? (
          seg
        ) : (
          <ruby key={i}>
            {seg.b}
            <rt>{seg.r}</rt>
          </ruby>
        ),
      )}
    </span>
  );
}
function J({ t }: { t: Tx }) {
  const { easy } = useContext(Lang);
  return <R s={pick(t, easy)} />;
}
const useEasy = () => useContext(Lang).easy;
const txt = (t: Tx, easy: boolean) => plain(pick(t, easy));

/* ================================================================== */
/* pictograms                                                          */
/* ================================================================== */
function Picto({ name, className = '' }: { name: string; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const prims = pictos[name] ?? [];
  const lastCut = prims.reduce((a, p, i) => (p[0][0] === 'x' ? i : a), -1);
  const draw = (p: Prim, i: number) => {
    switch (p[0]) {
      case 'c':
        return <circle key={i} cx={p[1]} cy={p[2]} r={p[3]} />;
      case 'o':
        return <circle key={i} cx={p[1]} cy={p[2]} r={p[3]} fill="none" stroke="currentColor" strokeWidth={p[4]} />;
      case 'p':
        return <path key={i} d={p[1]} fillRule="evenodd" />;
      case 's':
        return (
          <path key={i} d={p[1]} fill="none" stroke="currentColor" strokeWidth={p[2]} strokeLinecap="round" strokeLinejoin="round" />
        );
      case 'r':
        return <rect key={i} x={p[1]} y={p[2]} width={p[3]} height={p[4]} rx={p[5]} />;
      default:
        return null;
    }
  };
  const cut = (p: Prim, i: number) => {
    if (p[0] === 'x')
      return <path key={i} d={p[1]} fill="none" stroke="#000" strokeWidth={p[2]} strokeLinecap="round" strokeLinejoin="round" />;
    if (p[0] === 'xc') return <circle key={i} cx={p[1]} cy={p[2]} r={p[3]} fill="#000" />;
    if (p[0] === 'xr') return <rect key={i} x={p[1]} y={p[2]} width={p[3]} height={p[4]} rx={p[5]} fill="#000" />;
    return null;
  };
  return (
    <svg viewBox="0 0 64 64" className={`cy-picto ${className}`} aria-hidden="true" focusable="false">
      {lastCut >= 0 && (
        <mask id={`cm${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="#fff" />
          {prims.map((p, i) => (p[0][0] === 'x' ? cut(p, i) : null))}
        </mask>
      )}
      <g fill="currentColor" mask={lastCut >= 0 ? `url(#cm${uid})` : undefined}>
        {prims.map((p, i) => (i < lastCut && p[0][0] !== 'x' ? draw(p, i) : null))}
      </g>
      <g fill="currentColor">{prims.map((p, i) => (i > lastCut && p[0][0] !== 'x' ? draw(p, i) : null))}</g>
    </svg>
  );
}

/* ================================================================== */
/* helpers                                                             */
/* ================================================================== */
const circled = (n: number) => String.fromCharCode(0x2460 + n - 1);
const pad2 = (n: number) => String(n).padStart(2, '0');
const hm = (d: Date) => `${d.getHours()}:${pad2(d.getMinutes())}`;
const WD = '日月火水木金土';
const jdate = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`;

const placeLabel: Record<Exclude<Where, number>, Tx> = {
  online: ['オンライン', 'スマホ・パソコン'],
  home: ['ご{自宅|じたく}で', '{家|いえ}で'],
  school: ['{学校|がっこう}で', '{学校|がっこう}で'],
  shop: ['コンビニで', 'コンビニで'],
  other: ['{市役所|しやくしょ}の{外|そと}', '{市役所|しやくしょ}の {外|そと}'],
};
const onlineLabel: Record<Exclude<Online, null>, Tx> = {
  full: ['オンラインで{完結|かんけつ}できます', 'スマホで ぜんぶ できます'],
  reserve: ['オンラインで{予約|よやく}できます', 'スマホで {予約|よやく}できます'],
  partial: ['{一部|いちぶ}オンラインでできます', '{一部|いちぶ}は スマホで できます'],
  conbini: ['コンビニで{取|と}れます', 'コンビニで もらえます'],
};

function openStatus(d: Date): { open: boolean; label: Tx; sub: Tx } {
  const wd = d.getDay();
  const m = d.getHours() * 60 + d.getMinutes();
  const nth = Math.floor((d.getDate() - 1) / 7) + 1;
  if (wd >= 1 && wd <= 5 && m >= 510 && m < 1035)
    return { open: true, label: ['{開庁中|かいちょうちゅう}', 'あいて います'], sub: ['17:15まで', '{夕方|ゆうがた} 5{時|じ}15{分|ふん}まで'] };
  if (wd === 6 && (nth === 2 || nth === 4) && m >= 510 && m < 720)
    return { open: true, label: ['{土曜開庁中|どようかいちょうちゅう}', 'あいて います'], sub: ['{一部|いちぶ}の{窓口|まどぐち}・12:00まで', '{一部|いちぶ}だけ・{昼|ひる} 12{時|じ}まで'] };
  const nextWeekday = wd === 5 && m >= 1035 ? '月曜' : wd === 6 || wd === 0 ? '月曜' : m < 510 ? '本日' : '明日';
  return {
    open: false,
    label: ['{閉庁中|へいちょうちゅう}', 'しまって います'],
    sub: [`${nextWeekday} 8:30から`, `${nextWeekday} {朝|あさ} 8{時|じ}30{分|ぷん}から`],
  };
}

type Ticket = {
  serial: number;
  no: string;
  n: number;
  win: number;
  eventId: string;
  variantId: string;
  time: Date;
  ahead: number;
};

const stepsOf = (ev: LifeEvent, variantId: string) =>
  (ev.variants.find((v) => v.id === variantId) ?? ev.variants[0]).steps;
const routeWins = (steps: Step[]) =>
  steps
    .map((s) => s.where)
    .filter((w): w is number => typeof w === 'number')
    .filter((w, i, a) => i === 0 || a[i - 1] !== w);

/* ================================================================== */
/* main                                                                */
/* ================================================================== */
type Prefs = { size: 0 | 1 | 2; scheme: 0 | 1 | 2; easy: boolean; ruby: boolean };
const DEFAULT_PREFS: Prefs = { size: 0, scheme: 0, easy: false, ruby: false };

export default function CitySite({ onInquiry }: { onInquiry: (summary?: string) => void }) {
  const heroRef = useRef<HTMLElement>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [now, setNow] = useState<Date | null>(null);
  const [embedded, setEmbedded] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [evId, setEvId] = useState('move');
  const [variant, setVariant] = useState('in');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [printKey, setPrintKey] = useState(0);
  const [focusWin, setFocusWin] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const serial = useRef(0);

  /* ---- mount: clock, embed, prefs ---- */
  useEffect(() => {
    // client-only values (time, URL, media, storage) arrive one tick after hydration
    const boot = setTimeout(() => {
      setNow(new Date());
      setEmbedded(new URLSearchParams(location.search).get('embed') === '1');
      setReduced(matchMedia('(prefers-reduced-motion: reduce)').matches);
      setQueue(initQueue(new Date()));
      try {
        const saved = JSON.parse(localStorage.getItem('city-prefs') || 'null');
        if (saved && typeof saved === 'object') setPrefs({ ...DEFAULT_PREFS, ...saved });
      } catch {
        /* storage unavailable */
      }
    }, 0);
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => {
      clearTimeout(boot);
      clearInterval(t);
    };
  }, []);

  /* ---- apply prefs as classes on the page wrapper (.site-city) ---- */
  const applyClasses = useCallback((p: Prefs) => {
    const root = heroRef.current?.closest<HTMLElement>('.site-city');
    if (!root) return;
    root.classList.remove('cz-0', 'cz-1', 'cz-2', 'cs-0', 'cs-1', 'cs-2');
    root.classList.add(`cz-${p.size}`, `cs-${p.scheme}`);
    root.classList.toggle('c-easy', p.easy);
    root.classList.toggle('c-ruby', p.ruby);
  }, []);
  useEffect(() => {
    applyClasses(prefs);
    try {
      localStorage.setItem('city-prefs', JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs, applyClasses]);
  useEffect(() => {
    const root = heroRef.current?.closest<HTMLElement>('.site-city');
    return () => {
      root?.classList.remove('cz-0', 'cz-1', 'cz-2', 'cs-0', 'cs-1', 'cs-2', 'c-easy', 'c-ruby');
    };
  }, []);

  const changePrefs = useCallback(
    (patch: Partial<Prefs>, origin?: HTMLElement | null) => {
      const next = { ...prefs, ...patch };
      const apply = () => {
        flushSync(() => setPrefs(next));
        applyClasses(next);
      };
      const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
      if (!reduced && doc.startViewTransition) {
        const r = origin?.getBoundingClientRect();
        const x = r ? r.left + r.width / 2 : innerWidth / 2;
        const y = r ? r.top + r.height / 2 : 0;
        const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        const html = document.documentElement;
        html.style.setProperty('--city-vx', `${x}px`);
        html.style.setProperty('--city-vy', `${y}px`);
        html.style.setProperty('--city-vr', `${rad}px`);
        html.classList.add('city-vt');
        const t = doc.startViewTransition(apply);
        void t.finished.finally(() => {
          html.classList.remove('city-vt');
          html.style.removeProperty('--city-vx');
          html.style.removeProperty('--city-vy');
          html.style.removeProperty('--city-vr');
        });
      } else {
        const root = heroRef.current?.closest<HTMLElement>('.site-city');
        root?.classList.add('c-switching');
        apply();
        setTimeout(() => root?.classList.remove('c-switching'), 700);
      }
    },
    [prefs, reduced, applyClasses],
  );

  /* ---- queue simulation (paused when the tab is hidden) ---- */
  const mineRef = useRef<number | null>(null);
  useEffect(() => {
    mineRef.current = ticket?.win ?? null;
  }, [ticket]);
  useEffect(() => {
    if (!queue) return;
    let id = 0;
    const run = () => {
      clearInterval(id);
      if (document.hidden) return;
      id = window.setInterval(() => setQueue((s) => (s ? qStep(s, mineRef.current, new Date()) : s)), 2200);
    };
    run();
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', run);
    };
  }, [queue === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const ev = events.find((e) => e.id === evId) ?? events[0];
  const steps = stepsOf(ev, variant);

  /* ---- issue a ticket ---- */
  const issue = useCallback(
    (id: string, v?: string) => {
      const e = events.find((x) => x.id === id) ?? events[0];
      const vid = v ?? e.variants[0].id;
      const st = stepsOf(e, vid);
      const first = st.find((s) => typeof s.where === 'number')?.where as number | undefined;
      const win = first ?? 2;
      const w = winByNo(win);
      const qs = queue ?? initQueue(new Date());
      const q = qs.q[win];
      const n = q.called + q.waiting + 1;
      setQueue({ ...qs, q: { ...qs.q, [win]: { ...q, waiting: q.waiting + 1 } } });
      serial.current += 1;
      setEvId(e.id);
      setVariant(vid);
      setTicket({ serial: serial.current, no: ticketNo(w.letter, n), n, win, eventId: e.id, variantId: vid, time: new Date(), ahead: q.waiting });
      setPrintKey((k) => k + 1);
    },
    [queue],
  );

  // embed / thumbnail: the machine prints on its own
  const autoDone = useRef(false);
  useEffect(() => {
    if (!embedded || !queue || autoDone.current) return;
    autoDone.current = true;
    const t = setTimeout(() => issue('move', 'in'), 450);
    return () => clearTimeout(t);
  }, [embedded, queue, issue]);

  const ahead = ticket && queue ? Math.max(0, ticket.n - queue.q[ticket.win].called - 1) : null;
  const calledNow = ticket && queue ? queue.q[ticket.win].called >= ticket.n : false;

  /* ---- 読み上げ ---- */
  const speak = useCallback(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      document.querySelectorAll('.site-city .is-speaking').forEach((n) => n.classList.remove('is-speaking'));
      setSpeaking(null);
      return;
    }
    const secs = [...document.querySelectorAll<HTMLElement>('.site-city [data-read]')];
    const probe = innerHeight * 0.35;
    const sec =
      secs.find((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= probe && r.bottom > probe;
      }) ?? secs[0];
    if (!sec) return;
    const sel = 'h1,h2,h3,h4,p,li,dt,dd,th,td,figcaption,[data-say]';
    const all = [...sec.querySelectorAll<HTMLElement>(sel)].filter(
      (el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"],.no-read'),
    );
    const blocks = all.filter((el) => !all.some((o) => o !== el && o.contains(el) && !el.matches('[data-say]')));
    const texts = blocks
      .map((el) => {
        const c = el.cloneNode(true) as HTMLElement;
        c.querySelectorAll('rt,[aria-hidden="true"],.no-read').forEach((n) => n.remove());
        return { el, text: (c.textContent || '').replace(/\s+/g, ' ').trim() };
      })
      .filter((b) => b.text.length > 1)
      .slice(0, 40);
    if (!texts.length) return;
    synth.cancel();
    const voice = synth.getVoices().find((v) => v.lang === 'ja-JP' || v.lang === 'ja_JP');
    setSpeaking(sec.dataset.read || '');
    texts.forEach((b, i) => {
      const u = new SpeechSynthesisUtterance(b.text);
      u.lang = 'ja-JP';
      if (voice) u.voice = voice;
      u.rate = prefs.easy ? 0.88 : 1;
      u.onstart = () => {
        b.el.classList.add('is-speaking');
        if (!reduced) b.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      };
      u.onend = u.onerror = () => {
        b.el.classList.remove('is-speaking');
        if (i === texts.length - 1) setSpeaking(null);
      };
      synth.speak(u);
    });
  }, [speaking, prefs.easy, reduced]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const goProcedures = () => {
    document.getElementById('procedures')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setPrintKey((k) => k + 1);
  };

  const summaryText = () => {
    const wins = routeWins(steps).map((n) => `${winByNo(n).floor}F${circled(n)}`);
    return `ご用件：${txt(ev.label, false)}${ev.variants.length > 1 ? `（${txt(ev.variants.find((v) => v.id === variant)!.label, false)}）` : ''}${ticket ? `／番号札 ${ticket.no}` : ''}／手続き${steps.length}件（${wins.join('→')}）`;
  };

  return (
    <Lang.Provider value={{ easy: prefs.easy }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,600..800&family=DotGothic16&display=swap"
        precedence="default"
      />
      {/* ============================ HERO ============================ */}
      <section id="top" ref={heroRef} className="cy-hero" data-read="総合案内">
        <A11yBar
          prefs={prefs}
          change={changePrefs}
          speaking={speaking}
          speak={speak}
          ticket={ticket}
          ahead={ahead}
          called={calledNow}
        />
        <a className="cy-alert" href="#bosai">
          <span className="cy-alert-tag">
            <J t={['{防災情報|ぼうさいじょうほう}', '{防災|ぼうさい}']} />
          </span>
          <span className="cy-alert-text">
            <J
              t={[
                '{台風第|たいふうだい}14{号|ごう}の{接近|せっきん}に{伴|ともな}い、{自主避難所|じしゅひなんじょ}を3か{所|しょ}{開設|かいせつ}しています（9/24 15:00 {現在|げんざい}）',
                '{台風|たいふう}が {来|き}ます。{逃|に}げる ところを 3つ あけて います',
              ]}
            />
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </a>
        <div className="cy-hero-grid">
          <div className={`cy-hero-copy ${ticket ? 'has-ticket' : ''}`}>
            <p className="cy-status" data-say>
              <span className={`cy-dot ${now && openStatus(now).open ? 'is-open' : ''}`} aria-hidden="true" />
              {now ? (
                <>
                  <b>
                    <J t={openStatus(now).label} />
                  </b>
                  <span>
                    <J t={openStatus(now).sub} />
                  </span>
                  <span className="cy-status-date">
                    {jdate(now)} {hm(now)}
                  </span>
                </>
              ) : (
                <b>みらい市役所 本庁舎</b>
              )}
            </p>
            <h1 className="cy-q">
              {(prefs.easy ? copy.heroQ[1] : copy.heroQ[0]).map((l, i) => (
                <span key={i} className={`cy-q-l cy-q-${i}`}>
                  <R s={l} />
                </span>
              ))}
            </h1>
            <p className="cy-lead">
              <J t={copy.heroLead} />
            </p>
            <div className="cy-hero-tips" aria-hidden="true">
              <span className="cy-tip-wide">
                <J t={['{右|みぎ}の{発券機|はっけんき}の{画面|がめん}にタッチ', '{右|みぎ}の {機械|きかい}の {画面|がめん}を おして ください']} />
              </span>
              <span className="cy-tip-narrow">
                <J t={['{下|した}の{発券機|はっけんき}の{画面|がめん}にタッチ', '{下|した}の {機械|きかい}の {画面|がめん}を おして ください']} />
              </span>
            </div>
            {ticket && (
              <div className="cy-issued" key={ticket.serial} aria-live="polite">
                <div className="cy-issued-no">
                  <small>
                    <J t={['あなたの{番号|ばんごう}', 'あなたの {番号|ばんごう}']} />
                  </small>
                  <b>{ticket.no}</b>
                </div>
                <div className="cy-issued-body">
                  <p>
                    {calledNow ? (
                      <strong className="cy-calling">
                        <J t={['お{呼|よ}びしています', 'よばれて います']} /> — {winByNo(ticket.win).floor}F {circled(ticket.win)}
                        <J t={['{番窓口|ばんまどぐち}へ', 'ばんの {窓口|まどぐち}へ']} />
                      </strong>
                    ) : (
                      <>
                        <J t={['まず', 'はじめに']} /> <b>{winByNo(ticket.win).floor}F {circled(ticket.win)}</b>{' '}
                        <J t={winByNo(ticket.win).dept} />
                        <span className="cy-issued-ahead">
                          <J t={['お{待|ま}ちの{方|かた}', 'まえの {人|ひと}']} /> <b>{ahead}</b>
                          <J t={['{人|にん}', '{人|にん}']} />
                        </span>
                      </>
                    )}
                  </p>
                  <button className="cy-btn cy-btn-sig" onClick={goProcedures}>
                    <J t={[`{手続|てつづ}きリスト（${steps.length}{件|けん}）を{見|み}る`, `する こと（${steps.length}つ）を {見|み}る`]} />
                    <ArrowDown size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
            <CallBoard queue={queue} ticket={ticket} />
          </div>
          <div className="cy-stage">
            <div className="cy-wall" aria-hidden="true">
              <div className="cy-sign">
                <span className="cy-sign-no">A</span>
                <span>
                  <b>
                    <R s="{番号札発券機|ばんごうふだはっけんき}" />
                  </b>
                  <small>TICKET · 号码牌 · 번호표</small>
                </span>
              </div>
            </div>
            <Kiosk ticket={ticket} onPick={issue} onReset={() => setTicket(null)} reduced={reduced} onOpen={goProcedures} />
            <div className="cy-floor" aria-hidden="true">
              <span className="cy-tactile" />
              <span className="cy-tactile-stop" />
            </div>
          </div>
        </div>
      </section>

      {/* ========================== PROCEDURES ========================== */}
      <section id="procedures" className="cy-sec cy-proc" data-read="手続き">
        <header className="cy-sec-head">
          <span className="cy-sec-no" aria-hidden="true">01</span>
          <h2>
            <J t={copy.procH} />
          </h2>
          <p>
            <J t={copy.procLead} />
          </p>
        </header>
        <div className="cy-evtabs">
          {events.map((e) => (
            <button
              key={e.id}
              aria-pressed={e.id === evId}
              className="cy-evtab"
              onClick={() => {
                setEvId(e.id);
                setVariant(e.variants[0].id);
                setPrintKey((k) => k + 1);
              }}
            >
              <Picto name={e.picto} />
              <span>
                <J t={e.label} />
              </span>
            </button>
          ))}
        </div>
        {ev.variants.length > 1 && (
          <div className="cy-variants">
            {ev.variants.map((v) => (
              <button
                key={v.id}
                aria-pressed={v.id === variant}
                onClick={() => {
                  setVariant(v.id);
                  setPrintKey((k) => k + 1);
                }}
              >
                <J t={v.label} />
              </button>
            ))}
          </div>
        )}
        <div className="cy-proc-grid">
          <Receipt
            ev={ev}
            variant={variant}
            steps={steps}
            ticket={ticket && ticket.eventId === ev.id && ticket.variantId === variant ? ticket : null}
            now={now}
            printKey={printKey}
            reduced={reduced}
            onFocusWin={setFocusWin}
            onConsult={() => onInquiry(summaryText())}
          />
          <div className="cy-proc-side">
            <FloorMap wins={routeWins(steps)} focus={focusWin} playKey={`${evId}-${variant}-${printKey}`} reduced={reduced} />
            <QueueBoard queue={queue} ticket={ticket} ahead={ahead} highlight={routeWins(steps)} />
          </div>
        </div>
        <ProcSearch
          onPick={(eid, vid) => {
            setEvId(eid);
            setVariant(vid);
            setPrintKey((k) => k + 1);
            document.querySelector('.cy-evtabs')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
          }}
        />
      </section>

      {/* ========================== BOSAI / NEWS ========================== */}
      <section id="bosai" className="cy-sec cy-bosai" data-read="防災とお知らせ">
        <Bosai />
        <div className="cy-news">
          <header className="cy-news-head">
            <h2>
              <J t={copy.newsH} />
            </h2>
            <a href="#bosai" className="cy-more">
              <J t={['{一覧|いちらん}を{見|み}る', 'ぜんぶ {見|み}る']} />
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </header>
          <ul>
            {news.map((n) => (
              <li key={n.title[0]}>
                <time>{n.date}</time>
                <span className={`cy-tag ${n.hot ? 'is-hot' : ''}`}>
                  <J t={n.tag} />
                </span>
                <a href="#bosai">
                  <J t={n.title} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================ LIFE ============================ */}
      <section id="life" className="cy-sec cy-life" data-read="くらしの情報">
        <header className="cy-sec-head">
          <span className="cy-sec-no" aria-hidden="true">02</span>
          <h2>
            <J t={copy.lifeH} />
          </h2>
          <p>
            <J t={copy.lifeLead} />
          </p>
        </header>
        <div className="cy-cats">
          {categories.map((c, i) => (
            <article key={c.id} className="cy-cat" style={{ '--i': i } as CSSProperties}>
              <div className="cy-cat-sign">
                <Picto name={c.id} />
              </div>
              <h3>
                <J t={c.name} />
              </h3>
              <p>
                <J t={c.desc} />
              </p>
              <ul>
                {c.links.map((l, j) => (
                  <li key={j}>
                    <a
                      href={c.id === 'gomi' ? '#gomi' : c.id === 'bosai' ? '#bosai' : '#life'}
                      onClick={(e) => {
                        if (c.id === 'gomi' || c.id === 'bosai') return;
                        e.preventDefault();
                        onInquiry(`くらしの情報：${txt(c.name, false)}／${txt(l, false)}について`);
                      }}
                    >
                      <J t={l} />
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <Gomi now={now} />
      </section>

      {/* ============================ ACCESS ============================ */}
      <section id="access" className="cy-sec cy-access" data-read="窓口・アクセス">
        <header className="cy-sec-head">
          <span className="cy-sec-no" aria-hidden="true">03</span>
          <h2>
            <J t={copy.accessH} />
          </h2>
          <p>
            <J
              t={[
                '〒000-0001 みらい{市中央|しちゅうおう}{一丁目|いっちょうめ}1{番|ばん}1{号|ごう}　{代表電話|だいひょうでんわ} 0000-12-3456',
                'みらい{市|し} {中央|ちゅうおう} 1-1-1。{電話|でんわ} 0000-12-3456',
              ]}
            />
          </p>
        </header>
        <Access now={now} onInquiry={onInquiry} />
      </section>
    </Lang.Provider>
  );
}

/* ================================================================== */
/* accessibility bar                                                   */
/* ================================================================== */
function A11yBar({
  prefs,
  change,
  speaking,
  speak,
  ticket,
  ahead,
  called,
}: {
  prefs: Prefs;
  change: (p: Partial<Prefs>, origin?: HTMLElement | null) => void;
  speaking: string | null;
  speak: () => void;
  ticket: Ticket | null;
  ahead: number | null;
  called: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [docked, setDocked] = useState(false);
  const canSpeak = useSyncExternalStore(
    noop,
    () => 'speechSynthesis' in window,
    () => true,
  );
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setDocked(!e.isIntersecting && e.boundingClientRect.top < 0), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const sizes: Tx[] = [
    ['{標準|ひょうじゅん}', 'ふつう'],
    ['{大|だい}', '{大|おお}きい'],
    ['{特大|とくだい}', 'とても {大|おお}きい'],
  ];
  const schemes: Tx[] = [
    ['{標準|ひょうじゅん}', 'ふつう'],
    ['{白黒反転|しろくろはんてん}', '{黒|くろ}と {白|しろ}'],
    ['{青|あお}と{黄|き}', '{青|あお}と {黄色|きいろ}'],
  ];
  const cyc = <T extends number>(v: T, n: number) => ((v + 1) % n) as T;
  return (
    <div className="cy-bar-holder" ref={holder}>
      <section className={`cy-bar ${docked ? 'is-docked' : ''}`} aria-label="見やすさ・ことばの設定">
        <a className="cy-bar-mark" href="#top" tabIndex={docked ? 0 : -1} aria-hidden={!docked}>
          <span className="cy-emblem" aria-hidden="true" />
          未来市役所
        </a>
        {/* desktop: segmented controls */}
        <fieldset className="cy-seg">
          <legend className="cy-seg-label">
            <J t={['{文字|もじ}サイズ', '{文字|もじ}']} />
          </legend>
          {sizes.map((s, i) => (
            <label key={i} className={`cy-size cy-size-${i} ${prefs.size === i ? 'is-on' : ''}`}>
              <input
                type="radio"
                name="cy-size"
                checked={prefs.size === i}
                onChange={(e) => change({ size: i as Prefs['size'] }, e.currentTarget.parentElement)}
              />
              <span aria-hidden="true">あ</span>
              <J t={s} />
            </label>
          ))}
        </fieldset>
        <fieldset className="cy-seg">
          <legend className="cy-seg-label">
            <J t={['{配色|はいしょく}', '{色|いろ}']} />
          </legend>
          {schemes.map((s, i) => (
            <label key={i} className={`cy-scheme cy-scheme-${i} ${prefs.scheme === i ? 'is-on' : ''}`}>
              <input
                type="radio"
                name="cy-scheme"
                checked={prefs.scheme === i}
                onChange={(e) => change({ scheme: i as Prefs['scheme'] }, e.currentTarget.parentElement)}
              />
              <span className="cy-swatch" aria-hidden="true" />
              <J t={s} />
            </label>
          ))}
        </fieldset>
        <div className="cy-toggles">
          <button
            role="switch"
            aria-checked={prefs.easy}
            className="cy-switch"
            onClick={(e) => change({ easy: !prefs.easy }, e.currentTarget)}
          >
            <span className="cy-knob" aria-hidden="true" />
            <R s="やさしい{日本語|にほんご}" />
          </button>
          <button
            role="switch"
            aria-checked={prefs.ruby}
            className="cy-switch"
            onClick={(e) => change({ ruby: !prefs.ruby }, e.currentTarget)}
          >
            <span className="cy-knob" aria-hidden="true" />
            <ruby className="cy-demo">
              ふりがな<rt>furigana</rt>
            </ruby>
          </button>
          <button className={`cy-speak ${speaking !== null ? 'is-on' : ''}`} onClick={speak} disabled={!canSpeak} aria-pressed={speaking !== null}>
            {speaking !== null ? <Square size={14} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}
            {speaking !== null ? <J t={['{停止|ていし}', 'とめる']} /> : <J t={['{読|よ}み{上|あ}げ', '{読|よ}む']} />}
          </button>
        </div>
        {/* phone: cycling buttons */}
        <div className="cy-mbar">
          <button onClick={(e) => change({ size: cyc(prefs.size, 3) }, e.currentTarget)} aria-label={`文字の大きさ：${txt(sizes[prefs.size], false)}（押すと切り替え）`}>
            <b className={`cy-mbar-a cy-mbar-a${prefs.size}`}>あ</b>
            <span>
              <J t={sizes[prefs.size]} />
            </span>
          </button>
          <button onClick={(e) => change({ scheme: cyc(prefs.scheme, 3) }, e.currentTarget)} aria-label={`配色：${txt(schemes[prefs.scheme], false)}（押すと切り替え）`}>
            <b className={`cy-swatch cy-mbar-sw cy-scheme-${prefs.scheme}`} />
            <span>
              <J t={schemes[prefs.scheme]} />
            </span>
          </button>
          <button role="switch" aria-checked={prefs.easy} onClick={(e) => change({ easy: !prefs.easy }, e.currentTarget)} aria-label="やさしい日本語">
            <b className="cy-mbar-ez">やさ</b>
            <span>
              <R s="やさしい{日本語|にほんご}" />
            </span>
          </button>
          <button role="switch" aria-checked={prefs.ruby} onClick={(e) => change({ ruby: !prefs.ruby }, e.currentTarget)} aria-label="ふりがな">
            <b className="cy-mbar-rb">
              <ruby>
                漢<rt>かん</rt>
              </ruby>
            </b>
            <span>ふりがな</span>
          </button>
          <button onClick={speak} disabled={!canSpeak} aria-pressed={speaking !== null} aria-label={speaking !== null ? '読み上げを停止' : 'このあたりを読み上げる'}>
            <b>{speaking !== null ? <Square size={15} /> : <Volume2 size={19} />}</b>
            <span>{speaking !== null ? <J t={['{停止|ていし}', 'とめる']} /> : <J t={['{読|よ}み{上|あ}げ', '{読|よ}む']} />}</span>
          </button>
        </div>
        {ticket && (
          <a className={`cy-bar-ticket ${called ? 'is-called' : ''}`} href="#procedures" aria-live="polite">
            <small>
              <J t={['あなたの{番号|ばんごう}', 'あなたの {番号|ばんごう}']} />
            </small>
            <b>{ticket.no}</b>
            <span>
              {called ? (
                <J t={['お{呼|よ}びしています', 'よばれて います']} />
              ) : (
                <>
                  <J t={['あと', 'あと']} /> {ahead}
                  <J t={['{人|にん}', '{人|にん}']} />
                </>
              )}
            </span>
          </a>
        )}
        {speaking !== null && (
          <span className="cy-bar-reading" aria-live="polite">
            <J t={['{読|よ}み{上|あ}げ{中|ちゅう}', '{読|よ}んで います']} />：{speaking}
          </span>
        )}
      </section>
    </div>
  );
}

/* ================================================================== */
/* the ticket machine                                                  */
/* ================================================================== */
const PAPER_L = 19.5; // em
const SLICES = 16;

function Kiosk({
  ticket,
  onPick,
  onReset,
  onOpen,
  reduced,
}: {
  ticket: Ticket | null;
  onPick: (id: string) => void;
  onReset: () => void;
  onOpen: () => void;
  reduced: boolean;
}) {
  const easy = useEasy();
  const [doneSerial, setDoneSerial] = useState(0);
  const [pressed, setPressed] = useState<string | null>(null);
  const phase: 'idle' | 'print' | 'done' = !ticket ? 'idle' : reduced || doneSerial === ticket.serial ? 'done' : 'print';
  useEffect(() => {
    if (!ticket || reduced) return;
    const t = setTimeout(() => setDoneSerial(ticket.serial), 2100);
    return () => clearTimeout(t);
  }, [ticket, reduced]);
  const ev = ticket ? events.find((e) => e.id === ticket.eventId) : null;
  return (
    <div className={`cy-kiosk is-${phase}`}>
      <div className="cy-k-cap">
        <span className="cy-k-cap-led" aria-hidden="true" />
        <span className="cy-k-cap-title" aria-hidden="true">
          <b>番号札</b>
          <small>NUMBER TICKET</small>
        </span>
        <span className="cy-k-grille" aria-hidden="true" />
      </div>
      <div className="cy-k-bezel">
        <div className="cy-k-screen">
          {phase === 'idle' ? (
            <>
              <div className="cy-k-head">
                <b>
                  <J t={copy.screenHead} />
                </b>
                <span aria-hidden="true">1F 総合案内</span>
              </div>
              <div className="cy-k-grid">
                {events.map((e, i) => (
                  <button
                    key={e.id}
                    className={`cy-k-btn ${pressed === e.id ? 'is-pressed' : ''}`}
                    style={{ '--i': i } as CSSProperties}
                    onPointerDown={() => setPressed(e.id)}
                    onPointerUp={() => setPressed(null)}
                    onPointerLeave={() => setPressed(null)}
                    onClick={() => onPick(e.id)}
                    aria-label={`${txt(e.label, easy)}（${txt(e.sub, easy)}）の番号札をとる`}
                  >
                    <Picto name={e.picto} />
                    <span className={`cy-k-btn-t ${txt(e.label, easy).length > 8 ? 'is-xlong' : txt(e.label, easy).length > 6 ? 'is-long' : ''}`}>
                      <J t={e.label} />
                    </span>
                    <small>
                      <J t={e.sub} />
                    </small>
                  </button>
                ))}
              </div>
              <div className="cy-k-foot" aria-hidden="true">
                <span>◀︎)) 音声案内</span>
                <span>ＥＮ／中文／한국어</span>
              </div>
            </>
          ) : (
            <div className="cy-k-issued" aria-live="polite">
              <span className="cy-k-issued-label">
                {phase === 'print' ? (
                  <J t={['{発券中|はっけんちゅう}です', '{紙|かみ}が {出|で}ます']} />
                ) : (
                  <J t={['{番号札|ばんごうふだ}をお{取|と}りください', '{紙|かみ}を とって ください']} />
                )}
              </span>
              <b className="cy-k-issued-no">{ticket?.no}</b>
              {ev && (
                <span className="cy-k-issued-ev">
                  <J t={ev.label} />
                </span>
              )}
              <span className="cy-k-progress" aria-hidden="true">
                <i />
              </span>
              {phase === 'done' && (
                <span className="cy-k-actions">
                  <button onClick={onOpen} className="cy-k-go">
                    <J t={['{手続|てつづ}きを{見|み}る', 'する ことを {見|み}る']} />
                    <ArrowDown size={15} aria-hidden="true" />
                  </button>
                  <button onClick={onReset} className="cy-k-back">
                    <RotateCcw size={14} aria-hidden="true" />
                    <J t={['{別|べつ}の{用件|ようけん}', 'ほかの {用事|ようじ}']} />
                  </button>
                </span>
              )}
            </div>
          )}
          <span className="cy-k-glare" aria-hidden="true" />
        </div>
      </div>
      <div className="cy-k-plate">
        <span className="cy-k-slot-led" aria-hidden="true" />
        <span className="cy-k-slot" aria-hidden="true" />
        <span className="cy-k-slot-label" aria-hidden="true">
          ▼ 番号札 · TICKET
        </span>
        <span className="cy-k-braille" aria-hidden="true" title="点字：ばんごうふだ" />
        <span className="cy-k-reader" aria-hidden="true">
          <i />
          <small>カード読取</small>
        </span>
        {ticket && <Paper key={ticket.serial} ticket={ticket} reduced={reduced} onOpen={onOpen} />}
      </div>
      <div className="cy-k-body" aria-hidden="true">
        <span className="cy-k-badge">
          <span className="cy-emblem" />
          みらい市役所
          <small>MIRAI CITY HALL</small>
        </span>
        <span className="cy-k-vent" />
      </div>
      <div className="cy-k-plinth" aria-hidden="true" />
    </div>
  );
}

/* thermal paper: 16 nested slices bend into a real curl as it feeds */
function Paper({ ticket, reduced, onOpen }: { ticket: Ticket; reduced: boolean; onOpen: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const rootSlice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = wrap.current;
    const root = rootSlice.current;
    if (!w || !root) return;
    const slices: HTMLElement[] = [];
    let el: HTMLElement | null = root;
    while (el) {
      slices.push(el);
      el = el.querySelector<HTMLElement>(':scope > .cy-slice');
    }
    const h = PAPER_L / SLICES;
    let feed = 0;
    let wob = 0;
    let wobV = 0;
    let swing = 0;
    let swingV = 0;
    let raf = 0;
    const t0 = performance.now();
    const FEED_START = 260;
    const FEED_END = 1850;
    const target = PAPER_L * 0.97;
    let cut = false;
    let lastStep = 0;
    const render = () => {
      const hidden = PAPER_L - feed;
      w.parentElement?.style.setProperty('--feed', (feed * 0.92).toFixed(2));
      w.style.transform = `translate3d(0, ${(-hidden).toFixed(3)}em, 0) rotateZ(${swing.toFixed(3)}deg) rotateY(${(swing * 2.4).toFixed(3)}deg)`;
      const C = 8.2 * (1 + wob * 0.35);
      for (let i = 0; i < slices.length; i++) {
        const d = Math.max(0, (i + 1) * h - hidden);
        const a = (C * Math.min(d, feed)) / PAPER_L;
        const s = slices[i];
        s.style.transform = `translate3d(0, ${i === 0 ? 0 : h}em, 0) rotateX(${a.toFixed(3)}deg)`;
        s.style.setProperty('--shade', (Math.min(1, a / 7) * 0.9).toFixed(3));
      }
    };
    if (reduced) {
      feed = target;
      render();
      return;
    }
    const tick = (t: number) => {
      const e = t - t0;
      if (e > FEED_START && e < FEED_END) {
        // stepper-motor feed: pulses every ~46 ms with a tiny hitch
        const pulse = Math.floor((e - FEED_START) / 46);
        if (pulse !== lastStep) {
          lastStep = pulse;
          wobV += 0.18;
          swingV += (Math.random() - 0.5) * 0.25;
        }
        const p = Math.min(1, (pulse * 46) / (FEED_END - FEED_START));
        const eased = 1 - Math.pow(1 - p, 1.25);
        feed += (target * eased - feed) * 0.5;
      } else if (e >= FEED_END && !cut) {
        cut = true;
        feed = target;
        wobV += 1.4; // the cutter snaps
        swingV += 1.8;
      }
      // damped springs
      wobV += -wob * 0.16;
      wobV *= 0.86;
      wob += wobV;
      swingV += -swing * 0.06;
      swingV *= 0.93;
      swing += swingV;
      render();
      if (!cut || Math.abs(wobV) + Math.abs(swingV) + Math.abs(swing) * 0.1 > 0.002) raf = requestAnimationFrame(tick);
    };
    render();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // build nested slices from the bottom up
  let inner: ReactNode = null;
  for (let i = SLICES - 1; i >= 0; i--) {
    inner = (
      <div className="cy-slice" ref={i === 0 ? rootSlice : undefined}>
        <div className="cy-slice-clip" style={{ height: `${PAPER_L / SLICES + 0.07}em` }}>
          <div className="cy-slice-face" style={{ transform: `translateY(${(-(i * PAPER_L) / SLICES).toFixed(4)}em)` }}>
            <TicketFace ticket={ticket} />
          </div>
          <span className="cy-slice-shade" />
        </div>
        {inner}
      </div>
    );
  }
  return (
    <div className="cy-paper-clip">
      <button className="cy-paper-hit" onClick={onOpen} aria-label={`番号札 ${ticket.no}。手続きリストを見る`} />
      <div className="cy-paper" ref={wrap} aria-hidden="true">
        {inner}
      </div>
    </div>
  );
}

function TicketFace({ ticket }: { ticket: Ticket }) {
  const ev = events.find((e) => e.id === ticket.eventId)!;
  const v = ev.variants.find((x) => x.id === ticket.variantId) ?? ev.variants[0];
  const w = winByNo(ticket.win);
  const d = ticket.time;
  return (
    <div className="cy-tface" style={{ height: `${PAPER_L}em` }}>
      <div className="cy-tf-top">みらい市役所 本庁舎</div>
      <div className="cy-tf-kind">― 番号札 ―</div>
      <div className="cy-tf-ev">
        {plain(pick(ev.label, false))}
        {ev.variants.length > 1 ? `（${plain(pick(v.label, false))}）` : ''}
      </div>
      <div className="cy-tf-no">{ticket.no}</div>
      <div className="cy-tf-win">
        <span>{w.floor}F</span>
        <b>{circled(w.no)}</b>
        <span>
          {plain(pick(w.dept, false))}
          <br />
          {plain(pick(w.what, false))}
        </span>
      </div>
      <div className="cy-tf-row">
        <span>お待ちの方</span>
        <b>{ticket.ahead}人</b>
        <span>目安</span>
        <b>約{Math.max(3, Math.round(ticket.ahead * w.per * 0.85))}分</b>
      </div>
      <div className="cy-tf-list">
        {routeWins(stepsOf(ev, v.id)).map((n, i) => (
          <span key={i}>
            {i > 0 && '→'}
            {winByNo(n).floor}F{circled(n)}
          </span>
        ))}
      </div>
      <div className="cy-tf-foot">
        <QR seed={ticket.n * 7 + ticket.win} />
        <span>
          呼び出し状況は
          <br />
          スマホで確認できます
          <br />
          <small>
            {d.getFullYear()}.{pad2(d.getMonth() + 1)}.{pad2(d.getDate())} {pad2(d.getHours())}:{pad2(d.getMinutes())}
          </small>
        </span>
      </div>
      <div className="cy-tf-tear" />
    </div>
  );
}

function QR({ seed }: { seed: number }) {
  const cells = useMemo(() => {
    let s = seed * 9301 + 49297;
    const out: [number, number][] = [];
    for (let y = 0; y < 21; y++)
      for (let x = 0; x < 21; x++) {
        const finder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
        if (finder) continue;
        s = (s * 9301 + 49297) % 233280;
        if (s / 233280 > 0.52) out.push([x, y]);
      }
    return out;
  }, [seed]);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fbfaf4" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  );
  return (
    <svg viewBox="-1 -1 23 23" className="cy-qr" aria-hidden="true">
      {finder(0, 0)}
      {finder(14, 0)}
      {finder(0, 14)}
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width="1.02" height="1.02" />
      ))}
    </svg>
  );
}

/* ================================================================== */
/* LED call board (hero)                                               */
/* ================================================================== */
function CallBoard({ queue, ticket }: { queue: QueueState | null; ticket: Ticket | null }) {
  const easy = useEasy();
  const rows = [1, 2, 4, 7].includes(ticket?.win ?? 0) || !ticket ? [1, 2, 4, 7] : [1, 2, 4, ticket.win];
  const last = queue?.last;
  return (
    <section className="cy-led" aria-label="ただいまの呼び出し番号">
      <div className="cy-led-head">
        <span>
          <J t={['ただいまの{呼|よ}び{出|だ}し{番号|ばんごう}', 'いま よばれて いる {番号|ばんごう}']} />
        </span>
        <span className="cy-led-live" aria-hidden="true">
          LIVE
        </span>
      </div>
      <div className="cy-led-rows">
        {rows.map((no) => {
          const w = winByNo(no);
          const q = queue?.q[no];
          return (
            <div key={no} className={`cy-led-row ${ticket?.win === no ? 'is-mine' : ''}`}>
              <span className="cy-led-win">{circled(no)}</span>
              <span className="cy-led-dept">{txt(w.dept, easy).replace(' 戸籍', '')}</span>
              <span className="cy-led-no" key={q?.called ?? 0}>
                {q ? ticketNo(w.letter, q.called) : '---'}
              </span>
              <span className="cy-led-wait">{q ? `待${q.waiting}` : ''}</span>
            </div>
          );
        })}
      </div>
      <div className="cy-led-marquee">
        <span key={last ? `${last.no}-${last.n}` : 'x'}>
          {last
            ? `${ticketNo(winByNo(last.no).letter, last.n)} 番の方、${winByNo(last.no).floor}F ${circled(last.no)} 番窓口へお越しください`
            : '番号札をお取りになり、お呼びするまでお待ちください'}
        </span>
      </div>
    </section>
  );
}

/* ================================================================== */
/* receipt checklist                                                   */
/* ================================================================== */
function Receipt({
  ev,
  variant,
  steps,
  ticket,
  now,
  printKey,
  reduced,
  onFocusWin,
  onConsult,
}: {
  ev: LifeEvent;
  variant: string;
  steps: Step[];
  ticket: Ticket | null;
  now: Date | null;
  printKey: number;
  reduced: boolean;
  onFocusWin: (n: number | null) => void;
  onConsult: () => void;
}) {
  const easy = useEasy();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [have, setHave] = useState<Record<string, boolean>>({});
  const ref = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  // print (reveal) when it scrolls into view or the event changes
  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    let armed = true;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && armed) {
          armed = false;
          setPrinting(false);
          requestAnimationFrame(() => setPrinting(true));
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [printKey, reduced]);
  const v = ev.variants.find((x) => x.id === variant) ?? ev.variants[0];
  const total = steps.reduce((a, s) => a + (typeof s.where === 'number' ? s.min : 0), 0);
  const count = steps.filter((s) => done[s.id]).length;
  const d = ticket?.time ?? now;
  return (
    <div className={`cy-receipt ${printing ? 'is-printing' : ''} ${reduced ? 'is-still' : ''}`} ref={ref} key={`${ev.id}-${variant}-${printKey}`}>
      <div className="cy-rc-head">
        <div className="cy-rc-org">
          <span className="cy-emblem" aria-hidden="true" />
          <span>
            みらい市役所
            <small>
              <J t={['{手続|てつづ}きリスト', 'する ことの リスト']} />
            </small>
          </span>
        </div>
        <div className="cy-rc-no">
          <small>{ticket ? <J t={['{番号札|ばんごうふだ}', '{番号|ばんごう}']} /> : <J t={['{見本|みほん}', 'みほん']} />}</small>
          <b className={ticket ? '' : 'is-ghost'}>{ticket ? ticket.no : `${winByNo(routeWins(steps)[0] ?? 2).letter}-000`}</b>
        </div>
        <h3 className="cy-rc-title">
          <J t={ev.label} />
          {ev.variants.length > 1 && (
            <span>
              <J t={v.label} />
            </span>
          )}
        </h3>
        <dl className="cy-rc-meta">
          <div>
            <dt>
              <J t={['{手続|てつづ}き', 'する こと']} />
            </dt>
            <dd>
              {steps.length}
              <J t={['{件|けん}', 'つ']} />
            </dd>
          </div>
          <div>
            <dt>
              <J t={['{窓口|まどぐち}の{目安|めやす}', 'かかる {時間|じかん}']} />
            </dt>
            <dd>
              <J t={[`{約|やく}${total}{分|ふん}`, `${total}{分|ふん}ぐらい`]} />
            </dd>
          </div>
          <div>
            <dt>
              <J t={['{済|す}み', 'おわった']} />
            </dt>
            <dd>
              {count}/{steps.length}
            </dd>
          </div>
        </dl>
        {d && (
          <p className="cy-rc-date">
            {d.getFullYear()}.{pad2(d.getMonth() + 1)}.{pad2(d.getDate())} {pad2(d.getHours())}:{pad2(d.getMinutes())}
            {!ticket && (
              <>
                {' '}
                — <J t={['{上|うえ}の{発券機|はっけんき}で{番号札|ばんごうふだ}をとると、ここに{番号|ばんごう}が{入|はい}ります', '{番号|ばんごう}の {紙|かみ}を とると、ここに {番号|ばんごう}が でます']} />
              </>
            )}
          </p>
        )}
      </div>
      <ol className="cy-rc-steps">
        {steps.map((s, i) => {
          const w = typeof s.where === 'number' ? winByNo(s.where) : null;
          const isDone = !!done[s.id];
          return (
            <li key={s.id} className={`cy-rc-step ${isDone ? 'is-done' : ''}`} style={{ '--i': i } as CSSProperties}>
              <span className="cy-rc-n" aria-hidden="true">
                {i + 1}
              </span>
              <div className="cy-rc-body">
                <h4>
                  <J t={s.title} />
                </h4>
                <p className="cy-rc-where" data-say>
                  {w ? (
                    <>
                      <button
                        type="button"
                        className="cy-winchip"
                        aria-label={`${w.floor}階 ${w.no}番窓口をフロアマップで表示`}
                        onPointerEnter={() => onFocusWin(w.no)}
                        onPointerLeave={() => onFocusWin(null)}
                        onFocus={() => onFocusWin(w.no)}
                        onBlur={() => onFocusWin(null)}
                        onClick={() => {
                          onFocusWin(w.no);
                          const map = document.querySelector('.cy-fmap');
                          const r = map?.getBoundingClientRect();
                          if (map && r && (r.top > innerHeight || r.bottom < 0)) map.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
                        }}
                      >
                        {w.floor}F <b>{circled(w.no)}</b>
                        <MapPin size={13} aria-hidden="true" />
                      </button>
                      <span>
                        <J t={w.dept} />
                        <small>
                          <J t={w.what} />
                        </small>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="cy-winchip is-out">{s.where === 'online' ? <Smartphone size={15} aria-hidden="true" /> : <MapPin size={15} aria-hidden="true" />}</span>
                      <span>
                        <J t={s.otherPlace ?? placeLabel[s.where as Exclude<Where, number>]} />
                      </span>
                    </>
                  )}
                </p>
                <div className="cy-rc-facts">
                  {s.min > 0 && (
                    <span>
                      <Clock size={14} aria-hidden="true" />
                      <J t={[`{約|やく}${s.min}{分|ふん}`, `${s.min}{分|ふん}ぐらい`]} />
                    </span>
                  )}
                  {s.due && (
                    <span className="cy-rc-due">
                      <J t={['{期限|きげん}', 'いつまで']} />：<J t={s.due} />
                    </span>
                  )}
                  {s.online ? (
                    <span className={`cy-badge cy-badge-${s.online}`}>
                      <Smartphone size={14} aria-hidden="true" />
                      <J t={onlineLabel[s.online]} />
                    </span>
                  ) : w ? (
                    <span className="cy-badge cy-badge-visit">
                      <J t={['{来庁|らいちょう}が{必要|ひつよう}', '{市役所|しやくしょ}に {来|き}て ください']} />
                    </span>
                  ) : null}
                </div>
                {s.who && (
                  <p className="cy-rc-who">
                    <J t={['{対象|たいしょう}', 'だれ']} />：<J t={s.who} />
                  </p>
                )}
                {s.bring.length > 0 && (
                  <div className="cy-rc-bring">
                    <span className="cy-rc-bring-h">
                      <J t={['{持|も}ち{物|もの}', '{持|も}って くる もの']} />
                    </span>
                    <ul>
                      {s.bring.map((b, j) => {
                        const k = `${s.id}:${j}`;
                        return (
                          <li key={k}>
                            <label>
                              <input type="checkbox" checked={!!have[k]} onChange={() => setHave((h) => ({ ...h, [k]: !h[k] }))} />
                              <span className="cy-check" aria-hidden="true">
                                <Check size={13} strokeWidth={3} />
                              </span>
                              <span>
                                <J t={b} />
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {s.note && (
                  <p className="cy-rc-note">
                    <J t={s.note} />
                  </p>
                )}
              </div>
              <button
                className="cy-rc-done"
                aria-pressed={isDone}
                aria-label={`${txt(s.title, easy)}を${isDone ? '未完了に戻す' : '済みにする'}`}
                onClick={() => setDone((x) => ({ ...x, [s.id]: !x[s.id] }))}
              >
                {isDone ? <J t={['{済|す}み', 'おわり']} /> : <J t={['{済|す}みにする', 'おわった']} />}
              </button>
              {isDone && (
                <span className="cy-stamp" aria-hidden="true">
                  <span>済</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="cy-rc-foot">
        <div className="cy-rc-bar" aria-hidden="true" />
        <p>
          <J
            t={[
              '{窓口|まどぐち}は{庁舎|ちょうしゃ}をまわる{順番|じゅんばん}に{並|なら}べています。{内容|ないよう}はご{家庭|かてい}の{状況|じょうきょう}により{異|こと}なります。',
              '{家族|かぞく}に よって、する ことが {変|か}わります。',
            ]}
          />
        </p>
        <button className="cy-btn cy-btn-ink" onClick={onConsult}>
          <J t={['この{内容|ないよう}で{窓口|まどぐち}に{相談|そうだん}する', 'この ことを {市役所|しやくしょ}に {聞|き}く']} />
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* floor map (axonometric, 1F + 2F)                                    */
/* ================================================================== */
function FloorMap({ wins, focus, playKey, reduced }: { wins: number[]; focus: number | null; playKey: string; reduced: boolean }) {
  const easy = useEasy();
  const route = useMemo(() => F.routeFor(wins), [wins]);
  const m = useMemo(() => F.measure(route), [route]);
  const stopDist = route.stops.map((s) => m.cum[s.at]);
  const svgRef = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGPolylineElement>(null);
  const caseRef = useRef<SVGPolylineElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const [replay, setReplay] = useState(0);
  const runKey = `${playKey}|${replay}|${wins.join(',')}`;
  const [reachedState, setReachedState] = useState<{ key: string; n: number }>({ key: '', n: -1 });
  const reached = reduced ? route.stops.length - 1 : reachedState.key === runKey ? reachedState.n : -1;
  useEffect(() => {
    const line = lineRef.current;
    const dot = dotRef.current;
    const svg = svgRef.current;
    if (!line || !dot || !svg) return;
    const place = (d: number) => {
      const [x, y] = F.pointAt(m.p2, m.cum, d);
      dot.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      line.style.strokeDashoffset = String(m.total - d);
      if (caseRef.current) caseRef.current.style.strokeDashoffset = String(m.total - d);
    };
    line.style.strokeDasharray = `${m.total}`;
    if (caseRef.current) caseRef.current.style.strokeDasharray = `${m.total}`;
    if (reduced) {
      place(m.total);
      return;
    }
    place(0);
    let raf = 0;
    let started = false;
    let visible = false;
    let d = 0;
    let pause = 0;
    let last = 0;
    let nextStop = 0;
    const speed = 150; // units / s
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      if (!visible || document.hidden) {
        raf = requestAnimationFrame(loop);
        return;
      }
      if (pause > 0) pause -= dt;
      else {
        d = Math.min(m.total, d + speed * dt);
        if (nextStop < stopDist.length && d >= stopDist[nextStop]) {
          d = stopDist[nextStop];
          setReachedState({ key: runKey, n: nextStop });
          nextStop++;
          pause = 0.55;
        }
      }
      place(d);
      if (d < m.total || pause > 0) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible && !started) {
          started = true;
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0.3 },
    );
    io.observe(svg);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [m, route, stopDist.join(','), reduced, runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepOf = (no: number) => route.stops.filter((s) => s.no === no).map((s) => s.step);
  const floorSlab = (floor: 1 | 2) => {
    const z = F.zOf(floor);
    const s = F.box(0, 0, z - 1.1, F.BW, F.BD, 1.1);
    return (
      <g className="cy-fm-slab">
        <polygon points={s.south} className="cy-fm-side" />
        <polygon points={s.east} className="cy-fm-side2" />
        <polygon points={s.top} className="cy-fm-top" />
        {/* back walls (cutaway) */}
        <polygon points={F.pts([0, 0, z], [F.BW, 0, z], [F.BW, 0, z + 2.6], [0, 0, z + 2.6])} className="cy-fm-wall" />
        <polygon points={F.pts([0, 0, z], [0, F.BD, z], [0, F.BD, z + 2.6], [0, 0, z + 2.6])} className="cy-fm-wall2" />
        {/* corridor */}
        <polygon points={F.pts([1, F.CORRIDOR - 1.6, z], [F.BW - 1, F.CORRIDOR - 1.6, z], [F.BW - 1, F.CORRIDOR + 1.6, z], [1, F.CORRIDOR + 1.6, z])} className="cy-fm-corr" />
      </g>
    );
  };
  const floorContent = (floor: 1 | 2) => {
    const z = F.zOf(floor);
    return (
      <g>
        {F.zones
          .filter((zn) => zn.floor === floor)
          .map((zn) => (
            <polygon key={zn.no} points={zn.poly} className={`cy-fm-zone ${wins.includes(zn.no) ? 'is-on' : ''} ${focus === zn.no ? 'is-focus' : ''}`} />
          ))}
        {/* stairs + EV */}
        {(() => {
          const st = F.box(1, 14, z, 4, 5, 0.6);
          const ev = F.box(F.EV.x, F.EV.y, z, F.EV.w, F.EV.d, floor === 1 ? F.FLOOR_Z - 1.2 : 3);
          return (
            <>
              <g className="cy-fm-stairs">
                <polygon points={st.top} />
                <polygon points={st.south} />
              </g>
              <g className="cy-fm-ev">
                <polygon points={ev.south} />
                <polygon points={ev.east} />
                <polygon points={ev.top} />
              </g>
            </>
          );
        })()}
        {floor === 1 && (
          <g className="cy-fm-lobby">
            <polygon points={F.box(19.5, 18.5, 0, 5, 1.4, 1.1).top} />
            <polygon points={F.box(19.5, 18.5, 0, 5, 1.4, 1.1).south} />
            {Array.from({ length: 3 }, (_, r) =>
              Array.from({ length: 5 }, (_, c) => {
                const [x, y] = F.proj(27 + c * 2.2, 16.6 + r * 2, 0);
                return <rect key={`${r}-${c}`} x={x - 5} y={y - 2} width="10" height="4" rx="1" className="cy-fm-seat" />;
              }),
            )}
          </g>
        )}
        {windows
          .filter((w) => w.floor === floor)
          .sort((a, b) => (a.side === 's' ? 1 : 0) - (b.side === 's' ? 1 : 0) || a.x - b.x)
          .map((w) => {
            const b = F.counterBox(w.no);
            const on = wins.includes(w.no);
            const idx = route.stops.findIndex((s) => s.no === w.no);
            const lit = on && idx <= reached && idx >= 0;
            const [lx, ly] = F.proj(w.x, w.side === 'n' ? 7.6 : 16.3, z + 5.2);
            const [bx, by] = F.proj(w.x, w.side === 'n' ? 7.6 : 16.3, z + 1.2);
            const steps = stepOf(w.no);
            return (
              <g key={w.no} className={`cy-fm-counter ${on ? 'is-on' : ''} ${lit ? 'is-lit' : ''} ${focus === w.no ? 'is-focus' : ''}`}>
                <polygon points={b.south} className="cy-fm-c-s" />
                <polygon points={b.east} className="cy-fm-c-e" />
                <polygon points={b.top} className="cy-fm-c-t" />
                <line x1={bx} y1={by} x2={lx} y2={ly + 9} className="cy-fm-pin" />
                <g transform={`translate(${lx.toFixed(1)} ${ly.toFixed(1)})`}>
                  {lit && <circle r="19" className="cy-fm-pulse" />}
                  <circle r="12" className="cy-fm-badge" />
                  <text className="cy-fm-no" dy="4.8">
                    {w.no}
                  </text>
                  {on && steps.length > 0 && (
                    <g transform="translate(13 -11)">
                      <rect x="-2" y="-8" width={12 + (steps.length - 1) * 11} height="15" rx="7.5" className="cy-fm-stepbg" />
                      <text className="cy-fm-step" x="5.5" dy="3.5" textAnchor="middle">
                        {steps.map((s) => s + 1).join('·')}
                      </text>
                    </g>
                  )}
                </g>
                <text className={`cy-fm-label ${on ? '' : 'is-dim'}`} x={lx} y={ly - 19} textAnchor="middle">
                  {txt(w.dept, easy).replace(/ .*/, '')}
                </text>
              </g>
            );
          })}
        <text className="cy-fm-floor" {...(() => { const [x, y] = F.proj(0, F.BD, z); return { x: x - 50, y: y + 8 }; })()}>
          {floor}F
        </text>
      </g>
    );
  };
  const [ex, ey] = F.proj(F.ENTRANCE.x, F.BD + 3.2, 0);
  return (
    <figure className="cy-fmap">
      <figcaption>
        <span>
          <J t={['{窓口|まどぐち}までの{道順|みちじゅん}', '{窓口|まどぐち}への {行|い}き{方|かた}']} />
        </span>
        <button onClick={() => setReplay((r) => r + 1)} className="cy-fm-replay">
          <RotateCcw size={14} aria-hidden="true" />
          <J t={['もう{一度|いちど}', 'もう {一回|いっかい}']} />
        </button>
      </figcaption>
      <svg ref={svgRef} viewBox={F.viewBox()}>
        <title>{`本庁舎のフロアマップ。入口から ${wins.map((n) => `${winByNo(n).floor}階 ${n}番窓口`).join('、')} の順にまわります。`}</title>
        {floorSlab(1)}
        {floorContent(1)}
        <g transform={`translate(${ex} ${ey})`} className="cy-fm-entry">
          <path d="M-9 10 L0 -2 L9 10" />
          <text y="26" textAnchor="middle">
            {easy ? '入口' : '正面玄関'}
          </text>
        </g>
        {floorSlab(2)}
        {floorContent(2)}
        <polyline points={m.p2.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')} className="cy-fm-route-bg" />
        <polyline ref={caseRef} points={m.p2.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')} className="cy-fm-route-case" />
        <polyline ref={lineRef} points={m.p2.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')} className="cy-fm-route" />
        <g ref={dotRef} className="cy-fm-you">
          <circle r="11" className="cy-fm-you-halo" />
          <circle r="6.5" />
        </g>
      </svg>
      <ol className="cy-fm-legend">
        {wins.map((n, i) => (
          <li key={i} className={i <= reached ? 'is-lit' : ''}>
            <b>{i + 1}</b>
            {winByNo(n).floor}F {circled(n)} <J t={winByNo(n).dept} />
          </li>
        ))}
      </ol>
    </figure>
  );
}

/* ================================================================== */
/* queue board                                                         */
/* ================================================================== */
function QueueBoard({ queue, ticket, ahead, highlight }: { queue: QueueState | null; ticket: Ticket | null; ahead: number | null; highlight: number[] }) {
  const easy = useEasy();
  return (
    <section className="cy-qb" aria-label="窓口の待ち状況">
      <div className="cy-qb-head">
        <b>
          <J t={['{窓口|まどぐち}の{待|ま}ち{状況|じょうきょう}', '{窓口|まどぐち}で まって いる {人|ひと}']} />
        </b>
        <span>
          <J t={['{自動更新|じどうこうしん}・デモ{表示|ひょうじ}', 'デモです']} />
        </span>
      </div>
      {ticket && queue && (
        <div className={`cy-qb-mine ${ahead === 0 && queue.q[ticket.win].called >= ticket.n ? 'is-called' : ''}`}>
          <span>
            <J t={['あなたの{番号|ばんごう}', 'あなたの {番号|ばんごう}']} />
          </span>
          <b>{ticket.no}</b>
          <span>
            {queue.q[ticket.win].called >= ticket.n ? (
              <J t={['お{呼|よ}びしています', 'よばれて います']} />
            ) : (
              <>
                <J t={['あと', 'あと']} /> <b>{ahead}</b> <J t={['{人|にん}', '{人|にん}']} />
              </>
            )}
          </span>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th scope="col">
              <J t={['{窓口|まどぐち}', '{窓口|まどぐち}']} />
            </th>
            <th scope="col">
              <J t={['{呼出中|よびだしちゅう}', 'いまの {番号|ばんごう}']} />
            </th>
            <th scope="col">
              <J t={['{待|ま}ち', 'まつ {人|ひと}']} />
            </th>
            <th scope="col">
              <J t={['{目安|めやす}', '{時間|じかん}']} />
            </th>
          </tr>
        </thead>
        <tbody>
          {windows.map((w) => {
            const q = queue?.q[w.no];
            const mins = q ? Math.round(q.waiting * w.per * 0.85) : 0;
            return (
              <tr key={w.no} className={`${highlight.includes(w.no) ? 'is-route' : ''} ${ticket?.win === w.no ? 'is-mine' : ''}`}>
                <th scope="row">
                  <span className="cy-qb-no">{circled(w.no)}</span>
                  <span className="cy-qb-dept">
                    {w.floor}F {txt(w.dept, easy)}
                  </span>
                </th>
                <td className="cy-qb-call">
                  <span key={q?.called}>{q ? (w.reserve ? '予約制' : ticketNo(w.letter, q.called)) : '---'}</span>
                </td>
                <td>
                  <span className="cy-qb-bar" style={{ '--w': Math.min(1, (q?.waiting ?? 0) / 12) } as CSSProperties} />
                  {q ? `${q.waiting}人` : ''}
                </td>
                <td>{q ? (w.reserve ? '—' : mins <= 2 ? 'すぐ' : `${mins}分`) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/* ================================================================== */
/* 手続きを探す                                                          */
/* ================================================================== */
type Found = { step: Step; links: { eventId: string; variantId: string; label: Tx }[] };
const INDEX: Found[] = (() => {
  const byTitle = new Map<string, Found>();
  const out: Found[] = [];
  for (const e of events)
    for (const v of e.variants)
      for (const s of v.steps) {
        const key = plain(pick(s.title, false));
        const link = { eventId: e.id, variantId: v.id, label: e.variants.length > 1 ? v.label : e.label };
        const hit = byTitle.get(key);
        if (hit) {
          if (!hit.links.some((l) => l.eventId === e.id && l.variantId === v.id)) hit.links.push(link);
          continue;
        }
        const f = { step: s, links: [link] };
        byTitle.set(key, f);
        out.push(f);
      }
  for (const s of extras) out.push({ step: s, links: [] });
  return out;
})();
const hay = (f: Found) =>
  norm(
    [
      plain(pick(f.step.title, false)),
      reading(pick(f.step.title, false)),
      plain(pick(f.step.title, true)),
      f.step.kana,
      typeof f.step.where === 'number' ? plain(pick(winByNo(f.step.where).dept, false)) + reading(pick(winByNo(f.step.where).dept, false)) : '',
    ].join(' '),
  );
const HAY = INDEX.map(hay);

function ProcSearch({ onPick }: { onPick: (eventId: string, variantId: string) => void }) {
  const easy = useEasy();
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const n = norm(q);
    if (!n) return [];
    return INDEX.map((f, i) => {
      const h = HAY[i];
      const t = norm(plain(pick(f.step.title, false)));
      const score = t.startsWith(n) ? 3 : t.includes(n) ? 2 : h.includes(n) ? 1 : 0;
      return { f, score };
    })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [q]);
  const chips = ['住民票', '児童手当', 'マイナンバー', '印鑑', 'こくほ', '粗大ごみ', 'パスポート'];
  return (
    <search className="cy-search">
      <div className="cy-search-head">
        <h3>
          <J t={copy.searchH} />
        </h3>
        <p>
          <J t={['ひらがなでも{探|さが}せます。', 'ひらがなで さがせます。']} />
        </p>
      </div>
      <label className="cy-search-box">
        <Search size={26} aria-hidden="true" />
        <span className="cy-sr">手続きの名前を入力</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={easy ? 'れい：じゅうみんひょう' : '例：住民票、じどうてあて、印鑑登録'}
          autoComplete="off"
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="入力を消す" className="cy-search-clear">
            <X size={18} />
          </button>
        )}
      </label>
      <div className="cy-search-chips">
        {chips.map((c) => (
          <button key={c} onClick={() => setQ(c)} aria-pressed={q === c}>
            {c}
          </button>
        ))}
      </div>
      <div className="cy-search-out" aria-live="polite">
        {q && results.length === 0 && (
          <p className="cy-search-none">
            <J t={['{見|み}つかりませんでした。{言葉|ことば}を{変|か}えるか、1{階|かい}{総合案内|そうごうあんない}へおたずねください。', 'ありません。1{階|かい}の {案内|あんない}で {聞|き}いて ください。']} />
          </p>
        )}
        <ul>
          {results.map(({ f }) => {
            const w = typeof f.step.where === 'number' ? winByNo(f.step.where) : null;
            return (
              <li key={f.step.id} className="cy-search-item">
                <div className="cy-search-main">
                  <span className="cy-search-t">
                    <J t={f.step.title} />
                  </span>
                  <span className="cy-search-w">
                    {w ? (
                      <>
                        {w.floor}F {circled(w.no)} <J t={w.dept} />
                      </>
                    ) : (
                      <J t={f.step.otherPlace ?? placeLabel[f.step.where as Exclude<Where, number>]} />
                    )}
                  </span>
                  {f.step.online && (
                    <span className={`cy-badge cy-badge-${f.step.online}`}>
                      <J t={onlineLabel[f.step.online]} />
                    </span>
                  )}
                  {f.links.length === 0 && f.step.note && (
                    <span className="cy-search-note">
                      <J t={f.step.note} />
                    </span>
                  )}
                </div>
                {f.links.length > 0 && (
                  <div className="cy-search-links">
                    {f.links.map((l) => (
                      <button key={`${l.eventId}-${l.variantId}`} className="cy-search-ev" onClick={() => onPick(l.eventId, l.variantId)}>
                        <J t={l.label} />
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </search>
  );
}

/* ================================================================== */
/* 防災                                                                 */
/* ================================================================== */
function Bosai() {
  const levels: { n: number; t: Tx; c: string }[] = [
    { n: 1, t: ['{早期注意情報|そうきちゅういじょうほう}', '{気|き}を つける'], c: '#ffffff' },
    { n: 2, t: ['{大雨|おおあめ}・{洪水注意報|こうずいちゅういほう}', '{注意|ちゅうい}'], c: '#f2e700' },
    { n: 3, t: ['{高齢者等避難|こうれいしゃとうひなん}', 'お{年寄|としよ}りは {逃|に}げる'], c: '#ff2800' },
    { n: 4, t: ['{避難指示|ひなんしじ}', 'みんな {逃|に}げる'], c: '#aa00aa' },
    { n: 5, t: ['{緊急安全確保|きんきゅうあんぜんかくほ}', '{命|いのち}を まもる'], c: '#0c0000' },
  ];
  const shelters: { name: Tx; cap: number; used: number }[] = [
    { name: ['みらい{市総合体育館|しそうごうたいいくかん}', '{市|し}の {体育館|たいいくかん}'], cap: 400, used: 38 },
    { name: ['{北地区|きたちく}センター', '{北|きた}の センター'], cap: 120, used: 11 },
    { name: ['みなと{公民館|こうみんかん}', 'みなとの {公民館|こうみんかん}'], cap: 150, used: 22 },
  ];
  return (
    <div className="cy-bs">
      <div className="cy-bs-head">
        <span className="cy-bs-kicker">
          <J t={['{防災|ぼうさい}・{緊急情報|きんきゅうじょうほう}', '{防災|ぼうさい}']} />
        </span>
        <h2>
          <J t={['{台風第|たいふうだい}14{号|ごう}に{関|かん}する{情報|じょうほう}', '{台風|たいふう}14{号|ごう}の お{知|し}らせ']} />
        </h2>
        <p className="cy-bs-time">
          <J t={['9{月|がつ}24{日|か}（{木|もく}）15:00 {現在|げんざい}　みらい{市災害警戒本部|しさいがいけいかいほんぶ}', '9{月|がつ}24{日|か} {午後|ごご}3{時|じ}']} />
        </p>
      </div>
      <div className="cy-bs-grid">
        <div className="cy-bs-level">
          <p className="cy-bs-now">
            <J t={['{市内|しない}に{避難情報|ひなんじょうほう}は{出|で}ていません', 'いまは {逃|に}げなくて {大丈夫|だいじょうぶ}です']} />
          </p>
          <ol aria-label="警戒レベル">
            {levels.map((l) => (
              <li key={l.n} className={l.n === 2 ? 'is-now' : ''} style={{ '--lv': l.c } as CSSProperties}>
                <b>
                  <J t={['{警戒|けいかい}レベル', 'レベル']} />
                  {l.n}
                </b>
                <span>
                  <J t={l.t} />
                </span>
                {l.n === 2 && (
                  <em>
                    <J t={['{現在|げんざい}', 'いま']} />
                  </em>
                )}
              </li>
            ))}
          </ol>
          <p className="cy-bs-advice">
            <J
              t={[
                '25{日|にち}{未明|みめい}から{雨|あめ}と{風|かぜ}が{強|つよ}まる{見込|みこ}みです。{不安|ふあん}な{方|かた}は{明|あか}るいうちに{自主避難所|じしゅひなんじょ}へ。{飲料水|いんりょうすい}・{常備薬|じょうびやく}・{充電器|じゅうでんき}をお{持|も}ちください。',
                'あしたの {朝|あさ}、{雨|あめ}と {風|かぜ}が {強|つよ}く なります。こわい {人|ひと}は {明|あか}るい うちに {逃|に}げて ください。{水|みず}・{薬|くすり}・{充電器|じゅうでんき}を {持|も}って いって ください。',
              ]}
            />
          </p>
        </div>
        <TyphoonMap />
        <div className="cy-bs-shelters">
          <h3>
            <J t={['{開設中|かいせつちゅう}の{自主避難所|じしゅひなんじょ}', 'あいて いる {逃|に}げる ところ']} />
          </h3>
          <ul>
            {shelters.map((s) => (
              <li key={s.name[0]}>
                <span>
                  <J t={s.name} />
                </span>
                <span className="cy-bs-cap" style={{ '--p': s.used / s.cap } as CSSProperties}>
                  <i />
                </span>
                <small>
                  <J t={['{空|あ}きあり', 'あいて います']} /> {s.used}/{s.cap}
                </small>
              </li>
            ))}
          </ul>
          <div className="cy-bs-links">
            <a href="#life">
              <J t={['ハザードマップ', '{危|あぶ}ない ところの {地図|ちず}']} />
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <a href="#life">
              <J t={['{防災|ぼうさい}メール{登録|とうろく}', '{防災|ぼうさい}メール']} />
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
      <p className="cy-bs-sample">
        <J t={['※{表示|ひょうじ}は{訓練用|くんれんよう}のサンプルです。{実際|じっさい}の{気象情報|きしょうじょうほう}ではありません。', '※これは れんしゅうの {画面|がめん}です。']} />
      </p>
    </div>
  );
}

function TyphoonMap() {
  // abstract coastline + forecast track; circles grow with uncertainty
  const track = [
    { x: 70, y: 250, t: '24日15時', r: 0 },
    { x: 140, y: 196, t: '25日03時', r: 22 },
    { x: 212, y: 150, t: '25日15時', r: 36 },
    { x: 300, y: 118, t: '26日15時', r: 56 },
  ];
  return (
    <figure className="cy-typh">
      <svg viewBox="0 0 380 300">
        <title>台風第14号の予想進路。みらい市には25日の昼ごろ最も近づく見込み。</title>
        <defs>
          <pattern id="cy-sea" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 8 L8 0" className="cy-typh-hatch" />
          </pattern>
        </defs>
        <rect width="380" height="300" className="cy-typh-sea" />
        <rect width="380" height="300" fill="url(#cy-sea)" />
        <path d="M160 0 C170 40 150 70 176 96 C198 118 236 112 256 138 C280 170 262 210 300 232 C330 250 360 244 380 262 V0 Z" className="cy-typh-land" />
        <path d="M0 0 H120 C112 30 90 44 60 50 C30 56 10 40 0 44 Z" className="cy-typh-land" />
        <path
          d={`M${track.map((p) => `${p.x} ${p.y}`).join(' L')}`}
          className="cy-typh-track"
        />
        {track.slice(1).map((p) => (
          <circle key={p.t} cx={p.x} cy={p.y} r={p.r} className="cy-typh-cone" />
        ))}
        {track.map((p, i) => (
          <g key={p.t}>
            <circle cx={p.x} cy={p.y} r={i === 0 ? 9 : 3.5} className={i === 0 ? 'cy-typh-eye' : 'cy-typh-pt'} />
            <text x={p.x + 10} y={p.y + 22} className="cy-typh-t">
              {p.t}
            </text>
          </g>
        ))}
        <g className="cy-typh-storm" transform="translate(70 250)">
          <path d="M0 -22 C14 -22 22 -10 20 0 M0 22 C-14 22 -22 10 -20 0" />
        </g>
        <g transform="translate(236 128)">
          <circle r="5" className="cy-typh-city" />
          <text x="-10" y="-10" textAnchor="end" className="cy-typh-cityname">
            みらい市
          </text>
        </g>
      </svg>
      <figcaption>
        <J t={['{予報円|よほうえん}：{中心|ちゅうしん}が70%の{確率|かくりつ}で{入|はい}る{範囲|はんい}', '{台風|たいふう}が とおる かもしれない ところ']} />
      </figcaption>
    </figure>
  );
}

/* ================================================================== */
/* ごみ分別検索                                                          */
/* ================================================================== */
function Gomi({ now }: { now: Date | null }) {
  const easy = useEasy();
  const [q, setQ] = useState('ペットボトル');
  const [dist, setDist] = useState('chuo');
  const d = districts.find((x) => x.id === dist)!;
  const found = (() => {
    const n = norm(q);
    if (!n) return [];
    return gomiItems
      .map((it) => {
        const nn = norm(it.name);
        const score = nn === n ? 4 : nn.startsWith(n) ? 3 : nn.includes(n) ? 2 : norm(it.kana).includes(n) ? 1 : 0;
        return { it, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.it);
  })();
  const item = found[0];
  const k = item ? kinds[item.kind] : null;
  const next = item && now ? nextDate(d, item.kind, now) : null;
  const week = now
    ? Array.from({ length: 7 }, (_, i) => {
        const x = new Date(now);
        x.setHours(0, 0, 0, 0);
        x.setDate(x.getDate() + i);
        return { date: x, ks: kindsOn(d, x) };
      })
    : [];
  const bins: Kind[] = ['moeru', 'pla', 'shigen', 'kami', 'moenai', 'yugai', 'sodai', 'kyoten'];
  return (
    <div className="cy-gomi" id="gomi">
      <div className="cy-gomi-head">
        <div className="cy-gomi-sign">
          <Picto name="gomi" />
        </div>
        <div>
          <h3>
            <J t={copy.gomiH} />
          </h3>
          <p>
            <J t={copy.gomiLead} />
          </p>
        </div>
      </div>
      <div className="cy-gomi-grid">
        <div className="cy-gomi-input">
          <label className="cy-search-box is-small">
            <Search size={20} aria-hidden="true" />
            <span className="cy-sr">ごみの品目</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={easy ? 'れい：かさ' : '例：傘、スプレー缶、布団'} list="cy-gomi-list" autoComplete="off" />
          </label>
          <datalist id="cy-gomi-list">
            {gomiItems.map((it) => (
              <option key={it.name} value={it.name}>
                {it.name}
              </option>
            ))}
          </datalist>
          <div className="cy-search-chips">
            {suggestions.map((s) => (
              <button key={s} onClick={() => setQ(s)} aria-pressed={q === s}>
                {s}
              </button>
            ))}
          </div>
          <fieldset className="cy-gomi-dist">
            <legend>
              <J t={['お{住|す}まいの{地区|ちく}', '{住|す}んで いる ところ']} />
            </legend>
            {districts.map((x) => (
              <label key={x.id} className={x.id === dist ? 'is-on' : ''} title={x.area}>
                <input type="radio" name="cy-dist" checked={x.id === dist} onChange={() => setDist(x.id)} />
                <J t={x.name} />
              </label>
            ))}
          </fieldset>
          <p className="cy-gomi-area">{d.area}</p>
          {found.length > 1 && (
            <p className="cy-gomi-also">
              <J t={['ほかの{候補|こうほ}', 'ほかに']} />：
              {found.slice(1, 5).map((it) => (
                <button key={it.name} onClick={() => setQ(it.name)}>
                  {it.name}
                </button>
              ))}
            </p>
          )}
        </div>
        <div className="cy-gomi-result" aria-live="polite">
          <div className="cy-bins" aria-hidden="true">
            {bins.map((b) => (
              <span
                key={b}
                className={`cy-bin ${item?.kind === b ? 'is-hit' : ''}`}
                style={{ '--bc': kinds[b].color, '--bi': kinds[b].ink } as CSSProperties}
              >
                {item?.kind === b && (
                  <span className="cy-bin-drop" key={item.name}>
                    {item.name}
                  </span>
                )}
                <i />
                <small>{kinds[b].short}</small>
              </span>
            ))}
          </div>
          {item && k ? (
            <div className="cy-gomi-card" style={{ '--bc': k.color, '--bi': k.ink } as CSSProperties} key={item.name}>
              <p className="cy-gomi-item">{item.name}</p>
              <p className="cy-gomi-kind">
                <J t={k.name} />
              </p>
              <p className="cy-gomi-how">
                <J t={item.how} />
              </p>
              <p className="cy-gomi-rule">
                <J t={k.rule} />
              </p>
              <div className="cy-gomi-next">
                {next ? (
                  <>
                    <span>
                      <J t={['{次|つぎ}の{収集日|しゅうしゅうび}', 'つぎに {出|だ}せる {日|ひ}']} />（<J t={d.name} />）
                    </span>
                    <b>{fmtDate(next)}</b>
                    <em>{relDay(next, now!)[easy ? 1 : 0]}</em>
                  </>
                ) : (
                  <span>
                    {item.kind === 'sodai' ? (
                      <J t={['{収集|しゅうしゅう}は{申込制|もうしこみせい}です（{電話|でんわ}・インターネット・LINE）', '{先|さき}に {電話|でんわ}か スマホで たのんで ください']} />
                    ) : item.kind === 'kyoten' ? (
                      <J t={['{回収|かいしゅう}ボックス：{市役所|しやくしょ}1{階|かい}{東側|ひがしがわ}・{各地区|かくちく}センター', '{市役所|しやくしょ}1{階|かい}の {箱|はこ}']} />
                    ) : (
                      <J t={['{家電|かでん}リサイクル{受付|うけつけ}センター 0000-12-5300', 'お{店|みせ}に {聞|き}いて ください']} />
                    )}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="cy-gomi-card is-empty">
              <p>
                <J t={['{該当|がいとう}する{品目|ひんもく}がありません。{別|べつ}の{言葉|ことば}でお{試|ため}しください。', 'ありません。ほかの ことばで {入|い}れて ください。']} />
              </p>
            </div>
          )}
          <ol className="cy-week" aria-label="この1週間の収集">
            {week.map(({ date, ks }, i) => (
              <li key={i} className={`${i === 0 ? 'is-today' : ''} ${next && date.getTime() === next.getTime() ? 'is-next' : ''}`}>
                <b>{WD[date.getDay()]}</b>
                <small>{date.getDate()}</small>
                <span>
                  {ks.filter((x) => x !== 'yugai').map((x) => (
                    <i key={x} style={{ '--bc': kinds[x].color } as CSSProperties} title={txt(kinds[x].name, easy)}>
                      {kinds[x].short}
                    </i>
                  ))}
                  {ks.length === 0 && <i className="is-none">—</i>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 窓口・アクセス                                                        */
/* ================================================================== */
function Access({ now, onInquiry }: { now: Date | null; onInquiry: (s?: string) => void }) {
  const hours = ['8:30', '9', '10', '11', '12', '13', '14', '15', '16'];
  const crowdGrid = [
    [3, 4, 4, 3, 3, 3, 2, 2, 1],
    [2, 3, 3, 2, 3, 2, 2, 1, 1],
    [2, 3, 3, 2, 2, 2, 1, 1, 1],
    [2, 2, 3, 2, 2, 2, 1, 1, 0],
    [2, 3, 3, 3, 3, 2, 2, 2, 1],
  ];
  const mins = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const openNow = !!now && now.getDay() >= 1 && now.getDay() <= 5 && mins >= 510 && mins < 1035;
  const nowRow = openNow ? now!.getDay() - 1 : -1;
  const nowCol = openNow ? (now!.getHours() < 9 ? 0 : Math.min(8, now!.getHours() - 8)) : -1;
  const lv: Tx[] = [
    ['すいています', 'すいて います'],
    ['やや{少|すく}ない', 'すこし すいて います'],
    ['ふつう', 'ふつう'],
    ['やや{混雑|こんざつ}', 'すこし こんで います'],
    ['{混雑|こんざつ}', 'こんで います'],
  ];
  return (
    <div className="cy-acc">
      <div className="cy-acc-info">
        <dl className="cy-hours">
          <div className="is-main">
            <dt>
              <J t={['{開庁時間|かいちょうじかん}', 'あいて いる {時間|じかん}']} />
            </dt>
            <dd>
              <b>
                <J t={['{平日|へいじつ}', '{月曜日|げつようび}〜{金曜日|きんようび}']} />
              </b>
              <span className="cy-hours-big">8:30 – 17:15</span>
              <small>
                <J t={['{土日祝日|どにちしゅくじつ}・{年末年始|ねんまつねんし}（12/29〜1/3）は{閉庁|へいちょう}', '{土曜日|どようび}・{日曜日|にちようび}・{休|やす}みの {日|ひ}は しまって います']} />
              </small>
            </dd>
          </div>
          <div>
            <dt>
              <J t={['{土曜開庁|どようかいちょう}', '{土曜日|どようび}']} />
            </dt>
            <dd>
              <b>
                <J t={['{第|だい}2・{第|だい}4{土曜日|どようび} 8:30 – 12:00', '{月|つき}に 2{回|かい}（2{回目|かいめ}と 4{回目|かいめ}の {土曜日|どようび}）{朝|あさ} 8:30〜{昼|ひる} 12:00']} />
              </b>
              <ul>
                <li>
                  <J t={['{住民票|じゅうみんひょう}・{印鑑証明|いんかんしょうめい}・{戸籍|こせき}の{証明書|しょうめいしょ}', '{住民票|じゅうみんひょう}などの {紙|かみ}']} />
                </li>
                <li>
                  <J t={['{転入|てんにゅう}・{転出|てんしゅつ}・{転居|てんきょ}の{届出|とどけで}', '{引|ひ}っ{越|こ}しの {届|とど}け']} />
                </li>
                <li>
                  <J t={['マイナンバーカードの{受|う}け{取|と}り（{予約制|よやくせい}）', 'マイナンバーカード（{予約|よやく}）']} />
                </li>
              </ul>
            </dd>
          </div>
          <div>
            <dt>
              <J t={['{夜間窓口|やかんまどぐち}', '{夜|よる}']} />
            </dt>
            <dd>
              <J t={['{毎週水曜日|まいしゅうすいようび} 19:00まで（{証明書|しょうめいしょ}の{交付|こうふ}のみ）', '{水曜日|すいようび}は {夜|よる} 7{時|じ}まで（{証明書|しょうめいしょ}だけ）']} />
            </dd>
          </div>
        </dl>
        <ul className="cy-ways">
          <li>
            <Train size={22} aria-hidden="true" />
            <div>
              <b>
                <J t={['{電車|でんしゃ}', '{電車|でんしゃ}']} />
              </b>
              <J t={['みらい{線|せん}「みらい{中央|ちゅうおう}」{駅|えき} {東口|ひがしぐち}から{徒歩|とほ}7{分|ふん}', 'みらい{中央駅|ちゅうおうえき}の {東口|ひがしぐち}から {歩|ある}いて 7{分|ふん}']} />
            </div>
          </li>
          <li>
            <Bus size={22} aria-hidden="true" />
            <div>
              <b>
                <J t={['バス', 'バス']} />
              </b>
              <J t={['{市内循環|しないじゅんかん}バス「{市役所前|しやくしょまえ}」{下車|げしゃ}すぐ（{平日|へいじつ}15{分|ふん}おき）', '「{市役所前|しやくしょまえ}」で おりて すぐ']} />
            </div>
          </li>
          <li>
            <Car size={22} aria-hidden="true" />
            <div>
              <b>
                <J t={['{駐車場|ちゅうしゃじょう}', '{車|くるま}']} />
              </b>
              <J t={['{来庁者用|らいちょうしゃよう}240{台|だい}。2{時間|じかん}まで{無料|むりょう}（{駐車券|ちゅうしゃけん}を{窓口|まどぐち}で{認証|にんしょう}）。{車|くるま}いす{使用者用|しようしゃよう}8{台|だい}は{正面玄関前|しょうめんげんかんまえ}・{屋根|やね}つき', '240{台|だい}。2{時間|じかん}まで ただ。{車|くるま}いすの {人|ひと}の {場所|ばしょ}は 8{台|だい}']} />
            </div>
          </li>
          <li>
            <Phone size={22} aria-hidden="true" />
            <div>
              <b>
                <J t={['{代表電話|だいひょうでんわ}', '{電話|でんわ}']} />
              </b>
              0000-12-3456
              <small>
                <J t={['{手話|しゅわ}{通訳|つうやく}（{水|すい}・{金|きん}）・{筆談|ひつだん}・12{言語|げんご}の{通訳|つうやく}タブレットがあります', '{手話|しゅわ}・{紙|かみ}に {書|か}く・12の {言葉|ことば}の {通訳|つうやく}が あります']} />
              </small>
            </div>
          </li>
        </ul>
      </div>
      <figure className="cy-amap">
        <AccessMap />
        <figcaption>
          <J t={['みらい{中央駅|ちゅうおうえき}{東口|ひがしぐち}から{市役所|しやくしょ}まで　{約|やく}550m', '{駅|えき}から {市役所|しやくしょ}まで 550m']} />
        </figcaption>
      </figure>
      <div className="cy-crowd">
        <div className="cy-crowd-head">
          <h3>
            <J t={['{窓口|まどぐち}の{混雑予想|こんざつよそう}', 'こむ {時間|じかん}']} />
          </h3>
          <p>
            <J t={['{月曜|げつよう}・{連休明|れんきゅうあ}け・{月末|げつまつ}、3〜4{月|がつ}は{特|とく}に{混|こ}み{合|あ}います。{午後|ごご}3{時|じ}{以降|いこう}がおすすめです。', '{月曜日|げつようび}は こみます。{午後|ごご} 3{時|じ}からが すいて います。']} />
          </p>
        </div>
        <table className="cy-crowd-grid">
          <caption className="cy-sr">曜日と時間ごとの混雑予想</caption>
          <thead>
            <tr className="cy-crowd-row is-head">
              <th scope="col">
                <span className="cy-sr">曜日</span>
              </th>
              {hours.map((h) => (
                <th scope="col" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {['月', '火', '水', '木', '金'].map((d, r) => (
              <tr className="cy-crowd-row" key={d}>
                <th scope="row">{d}</th>
                {crowdGrid[r].map((v, c) => (
                  <td key={c} className={`cy-crowd-cell l${v} ${r === nowRow && c === nowCol ? 'is-now' : ''}`} title={txt(lv[v], false)}>
                    <span className="cy-sr">{txt(lv[v], false)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="cy-crowd-legend" aria-hidden="true">
          {lv.map((l, i) => (
            <span key={i}>
              <i className={`cy-crowd-cell l${i}`} />
              <J t={l} />
            </span>
          ))}
        </div>
      </div>
      <div className="cy-acc-foot">
        <p>
          <span className="cy-emblem" aria-hidden="true" />
          <b>みらい市役所 本庁舎</b>　〒000-0001 みらい市中央一丁目1番1号
        </p>
        <p className="cy-fiction">
          <J t={['{掲載内容|けいさいないよう}はすべて{架空|かくう}の{制作|せいさく}サンプルです。{実在|じつざい}の{自治体|じちたい}・{制度|せいど}の{案内|あんない}ではありません。', 'これは {練習|れんしゅう}の ホームページです。{本当|ほんとう}の {市|し}では ありません。']} />
        </p>
        <button className="cy-btn cy-btn-line" onClick={() => onInquiry('窓口・アクセスについて')}>
          <J t={['{窓口|まどぐち}へのお{問|と}い{合|あ}わせ', '{市役所|しやくしょ}に {聞|き}く']} />
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function AccessMap() {
  const easy = useEasy();
  return (
    <svg viewBox="0 0 560 400" className="cy-map">
      <title>みらい中央駅東口から市役所までの地図。駅前通りを東へ進み、みらい川の橋を渡って右手が市役所です。</title>
      <rect width="560" height="400" className="cy-map-bg" />
      {/* blocks */}
      {[
        [30, 30, 120, 80], [170, 30, 110, 80], [300, 30, 110, 80], [430, 30, 110, 60],
        [30, 230, 120, 70], [170, 230, 110, 70], [430, 250, 110, 120],
        [30, 320, 120, 60], [170, 320, 110, 60],
      ].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="3" className="cy-map-block" />
      ))}
      {/* river */}
      <path d="M350 0 C340 90 380 150 360 220 C345 280 380 340 370 400" className="cy-map-river" />
      <text x="382" y="316" className="cy-map-label is-water" transform="rotate(80 382 316)">
        {easy ? 'みらい川' : 'みらい川'}
      </text>
      {/* rail */}
      <path d="M0 150 H560" className="cy-map-rail" />
      <path d="M0 150 H560" className="cy-map-rail-ties" />
      {/* roads */}
      <path d="M0 205 H560 M160 0 V400 M290 0 V400 M420 0 V400" className="cy-map-road" />
      <text x="16" y="222" className="cy-map-label">駅前通り</text>
      {/* station */}
      <g transform="translate(150 150)">
        <rect x="-50" y="-16" width="100" height="32" rx="4" className="cy-map-station" />
        <text y="5" textAnchor="middle" className="cy-map-station-t">
          みらい中央駅
        </text>
        <text x="-8" y="36" textAnchor="end" className="cy-map-label is-small">東口</text>
      </g>
      {/* city hall */}
      <g transform="translate(480 300)">
        <rect x="-44" y="-44" width="88" height="80" rx="4" className="cy-map-hall" />
        <text y="-6" textAnchor="middle" className="cy-map-hall-t">市役所</text>
        <text y="12" textAnchor="middle" className="cy-map-hall-s">本庁舎</text>
      </g>
      <g transform="translate(470 222)">
        <rect x="-12" y="-9" width="24" height="18" rx="3" className="cy-map-p" />
        <text y="5" textAnchor="middle" className="cy-map-p-t">P</text>
      </g>
      <g transform="translate(436 215)" className="cy-map-bus">
        <circle r="9" />
        <text y="4" textAnchor="middle">B</text>
      </g>
      {/* walking route */}
      <path d="M196 170 V205 H420 V256 H436" className="cy-map-walk-bg" />
      <path d="M196 170 V205 H420 V256 H436" className="cy-map-walk" pathLength={100} />
      <circle cx="196" cy="170" r="6" className="cy-map-start" />
      <g transform="translate(520 40)" className="cy-map-north">
        <path d="M0 -16 L7 6 L0 2 L-7 6 Z" />
        <text y="22" textAnchor="middle">N</text>
      </g>
      <g transform="translate(24 380)" className="cy-map-scale">
        <path d="M0 0 H80" />
        <text x="84" y="4">100m</text>
      </g>
    </svg>
  );
}
