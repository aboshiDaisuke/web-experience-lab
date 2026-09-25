'use client';
import '@/app/signatures/arc.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, DoorOpen, LogOut, Moon, Sun, Lightbulb, Home, PlugZap, BatteryCharging, Hand } from 'lucide-react';
import { BASE } from '@/lib/base-path';
import {
  AMBIENTS,
  APR,
  DEALERS,
  GRADES,
  INTERIORS,
  OPTIONS,
  PAINTS,
  SPEC_COMMON,
  SUBSIDY,
  TERMS,
  WHEELS,
  chargeMinutes,
  chargePower,
  monthly,
  optionPrice,
  wheelPrice,
  yen,
} from '@/lib/works/arc/data';
import type { ArcCtl, ArcState, Hot, HotId, Preset } from '@/lib/works/arc/scene';
import { PAGES, type Page } from '@/lib/works/arc/screens';

type Config = {
  paint: string;
  wheel: 'aero' | 'sport';
  interior: string;
  ambient: string;
  night: boolean;
};

const HOT_LABEL: Record<HotId, [string, string]> = {
  doorR: ['運転席のドアを開ける', '運転席のドアを閉める'],
  doorL: ['助手席のドアを開ける', '助手席のドアを閉める'],
  head: ['ライトを点ける', 'ライトを消す'],
  tail: ['ライトを点ける', 'ライトを消す'],
  flap: ['充電口を開ける', '充電口を閉める'],
  wheel: ['ホイールを替える', 'ホイールを替える'],
};
const HOT_SHORT: Record<HotId, string> = { doorR: 'ドア', doorL: 'ドア', head: 'ライト', tail: 'ライト', flap: '充電口', wheel: 'ホイール' };
const isOpen = (id: HotId, s: ArcState | null) =>
  !!s && (id === 'doorR' ? s.doorR : id === 'doorL' ? s.doorL : id === 'flap' ? s.flap : id === 'head' || id === 'tail' ? s.lights : false);

const go = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

// ───────────────────────────────────────────────────────────── showroom (3D)
function Showroom({
  cfg,
  set,
  onInquiry,
}: {
  cfg: Config;
  set: (p: Partial<Config>) => void;
  onInquiry: (s?: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const gl = useRef<HTMLDivElement>(null);
  const ctl = useRef<ArcCtl | null>(null);
  const hotBtn = useRef<Partial<Record<HotId, HTMLButtonElement | null>>>({});
  const tip = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [st, setSt] = useState<ArcState | null>(null);
  const [inCar, setInCar] = useState(false);
  const [preset, setPresetS] = useState<Preset>('hero');
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const stRef = useRef<ArcState | null>(null);
  stRef.current = st;
  const setRef = useRef(set);
  setRef.current = set;

  useEffect(() => {
    const el = gl.current;
    if (!el) return;
    let dead = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrow = matchMedia('(max-width: 760px)').matches;
    const onHot = (hs: Hot[]) => {
      for (const h of hs) {
        const b = hotBtn.current[h.id];
        if (!b) continue;
        if (b.hidden === h.on) b.hidden = !h.on;
        if (h.on) {
          b.style.transform = `translate(${h.x.toFixed(1)}px, ${h.y.toFixed(1)}px)`;
          const flip = h.x > (b.parentElement?.clientWidth ?? 0) - 120;
          if (b.classList.contains('flip') !== flip) b.classList.toggle('flip', flip);
        }
      }
    };
    const onHover = (id: HotId | null, x: number, y: number) => {
      const t = tip.current;
      if (!t) return;
      if (!id) {
        t.hidden = true;
        return;
      }
      t.hidden = false;
      t.textContent = HOT_LABEL[id][isOpen(id, stRef.current) ? 1 : 0];
      t.style.transform = `translate(${x + 16}px, ${y + 14}px)`;
    };
    void import('@/lib/works/arc/scene').then(({ mountArc }) => {
      if (dead) return;
      ctl.current = mountArc(el, {
        reduced,
        narrow,
        onReady: () => setReady(true),
        onProgress: (f) => setProgress(f),
        onHot,
        onHover,
        onState: (s) => setSt(s),
        onError: () => setFailed(true),
        onWheel: () => setRef.current({ wheel: cfgRef.current.wheel === 'aero' ? 'sport' : 'aero' }),
      });
      const c = cfgRef.current;
      const p = PAINTS.find((x) => x.id === c.paint)!;
      ctl.current.setPaint(p);
      ctl.current.setWheel(c.wheel);
      ctl.current.setInterior(INTERIORS.find((x) => x.id === c.interior)!);
      const a = AMBIENTS.find((x) => x.id === c.ambient)!;
      ctl.current.setAmbient(a.hex, a.jp);
      ctl.current.setNight(c.night);
    });
    return () => {
      dead = true;
      ctl.current?.dispose();
      ctl.current = null;
    };
  }, []);

  // config -> scene
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return;
    ctl.current?.setPaint(PAINTS.find((x) => x.id === cfg.paint)!);
  }, [cfg.paint]);
  useEffect(() => {
    if (first.current) return;
    ctl.current?.setWheel(cfg.wheel);
  }, [cfg.wheel]);
  useEffect(() => {
    if (first.current) return;
    ctl.current?.setInterior(INTERIORS.find((x) => x.id === cfg.interior)!);
  }, [cfg.interior]);
  useEffect(() => {
    if (first.current) return;
    const a = AMBIENTS.find((x) => x.id === cfg.ambient)!;
    ctl.current?.setAmbient(a.hex, a.jp);
  }, [cfg.ambient]);
  useEffect(() => {
    if (first.current) return;
    ctl.current?.setNight(cfg.night);
  }, [cfg.night]);
  useEffect(() => {
    first.current = false;
  }, []);

  // scroll position -> camera preset (the page scroll is never captured)
  useEffect(() => {
    let raf = 0;
    const ids: [string, Preset][] = [
      ['top', 'hero'],
      ['design', 'design'],
      ['interior', 'interior'],
    ];
    const run = () => {
      raf = 0;
      if (stRef.current?.seated || stRef.current?.busy) return;
      const narrow = innerWidth <= 760;
      const line = innerHeight * (narrow ? 0.78 : 0.5);
      let cur: Preset = 'hero';
      for (const [id, p] of ids) {
        const r = document.getElementById(id)?.getBoundingClientRect();
        if (r && r.top <= line) cur = p;
      }
      setPresetS((old) => (old === cur ? old : cur));
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    addEventListener('scroll', on, { passive: true });
    addEventListener('resize', on);
    run();
    return () => {
      removeEventListener('scroll', on);
      removeEventListener('resize', on);
      cancelAnimationFrame(raf);
    };
  }, []);
  useEffect(() => {
    const c = ctl.current;
    if (!c) return;
    c.setPreset(preset);
    const narrow = innerWidth <= 760;
    c.setShift(narrow ? 0 : preset === 'interior' ? 0.08 : 0.12);
  }, [preset, ready]);

  // boarding: the stage goes full screen first, then the camera flies in
  const board = () => {
    if (!ready || st?.busy) return;
    setInCar(true);
    requestAnimationFrame(() => requestAnimationFrame(() => ctl.current?.board()));
  };
  const alight = () => ctl.current?.alight();
  // Only a boarding that has actually started can finish; the fly-in begins two frames
  // after the stage goes full screen, and must not be mistaken for stepping out.
  const boarded = useRef(false);
  useEffect(() => {
    if (!inCar) {
      boarded.current = false;
      return;
    }
    if (st?.seated || st?.busy) boarded.current = true;
    else if (st && boarded.current) {
      // finished stepping out
      const t = setTimeout(() => setInCar(false), 30);
      return () => clearTimeout(t);
    }
  }, [inCar, st]);
  useEffect(() => {
    if (!inCar) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ctl.current?.alight();
    };
    addEventListener('keydown', key);
    return () => {
      html.style.overflow = prev;
      removeEventListener('keydown', key);
    };
  }, [inCar]);

  const seated = !!st?.seated;
  const paint = PAINTS.find((p) => p.id === cfg.paint)!;
  const hots: HotId[] = ['doorR', 'doorL', 'head', 'tail', 'flap', 'wheel'];

  return (
    <div className="arc-show" ref={wrap}>
      <div
        className={`arc-stage ${ready ? 'is-ready' : ''} ${inCar ? 'is-seated' : ''} ${seated ? 'is-in' : ''} ${cfg.night ? 'is-night' : ''}`}
        ref={stage}
        data-preset={preset}
      >
        <div
          className="arc-gl"
          ref={gl}
          role="img"
          aria-label={`MIRAI ARC の3Dモデル（${paint.jp}）。ドラッグで車体の周りを回れます。ドア・ライト・充電口・ホイールに触れると動きます。`}
        />
        {!ready && !failed && (
          <div className="arc-loading" aria-live="polite">
            <span>3Dモデルを読み込んでいます</span>
            <i style={{ ['--p' as string]: progress.toFixed(3) }} />
          </div>
        )}
        {failed && (
          <div className="arc-fallback">
            <img src={`${BASE}/models/arc/still.jpg`} alt="スタジオに置かれた MIRAI ARC（砂金ブロンズ）" />
            <p>この端末では3D表示を利用できないため、静止画でご覧いただいています。</p>
          </div>
        )}

        {/* touchable parts */}
        <div className="arc-hots" hidden={inCar}>
          {hots.map((id) => (
            <button
              key={id}
              hidden
              className={`arc-hot ${isOpen(id, st) ? 'on' : ''}`}
              ref={(n) => {
                hotBtn.current[id] = n;
              }}
              aria-label={HOT_LABEL[id][isOpen(id, st) ? 1 : 0]}
              onClick={() => ctl.current?.toggle(id)}
            >
              <span className="dot" aria-hidden="true" />
              <span className="lbl">{HOT_SHORT[id]}</span>
            </button>
          ))}
        </div>
        <div className="arc-tip" ref={tip} hidden aria-hidden="true" />

        {!inCar && ready && (
          <div className="arc-dock">
            <p className="arc-hint">
              <Hand size={15} aria-hidden="true" />
              <span className="long">ドラッグで回す・光る点に触れる</span>
              <span className="short">ドラッグで回す</span>
            </p>
            <button className="arc-board" onClick={board} disabled={!ready}>
              <DoorOpen size={18} aria-hidden="true" />
              運転席に乗りこむ
            </button>
          </div>
        )}

        {inCar && (
          <div className="arc-cabin-ui" role="dialog" aria-label="運転席からの眺め">
            <div className="arc-cabin-top">
              <p>
                <b>運転席</b>
                <span>{seated ? 'ドラッグで見回せます。センターディスプレイの下のタブにも触れられます。' : 'ドアを開けて、乗りこんでいます…'}</span>
              </p>
              <button className="arc-exit" onClick={alight} disabled={!seated}>
                <LogOut size={17} aria-hidden="true" />
                降りる
              </button>
            </div>
            <div className={`arc-cabin-bar ${seated ? 'on' : ''}`}>
              <fieldset className="arc-amb">
                <legend>アンビエントライト</legend>
                <div>
                  {AMBIENTS.map((a) => (
                    <button
                      key={a.id}
                      aria-pressed={cfg.ambient === a.id}
                      style={{ ['--c' as string]: a.hex }}
                      onClick={() => set({ ambient: a.id })}
                      title={a.jp}
                    >
                      <span className="sw" aria-hidden="true" />
                      <span className="nm">{a.jp}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="arc-cabin-tools">
                <div className="arc-seg" role="group" aria-label="窓の外">
                  <button aria-pressed={!cfg.night} onClick={() => set({ night: false })}>
                    <Sun size={15} aria-hidden="true" />
                    スタジオ
                  </button>
                  <button aria-pressed={cfg.night} onClick={() => set({ night: true })}>
                    <Moon size={15} aria-hidden="true" />
                    夜の街
                  </button>
                </div>
                <button className="arc-tool" aria-pressed={!!st?.lights} onClick={() => ctl.current?.setLights(!st?.lights)}>
                  <Lightbulb size={15} aria-hidden="true" />
                  ライト
                </button>
                <div className="arc-seg arc-pages" role="group" aria-label="センターディスプレイ">
                  {PAGES.map((p) => (
                    <button key={p.id} aria-pressed={st?.page === p.id} onClick={() => ctl.current?.setPage(p.id as Page)}>
                      {p.jp}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── hero ── */}
      <section id="top" className="arc-sec arc-hero">
        <div className="arc-hero-copy">
          <p className="arc-over">
            <span>NEW</span>ELECTRIC FASTBACK — 2027 MODEL
          </p>
          <h1>
            <span className="en">MIRAI ARC</span>
            <span className="jp">触れて、開けて、乗りこむ。</span>
          </h1>
          <p className="arc-lead">
            ひと筆の弧を描く、新しい電気自動車。
            <br />
            車体に触れればドアが開き、ライトが灯る。そのまま運転席へ。
          </p>
          <div className="arc-cta">
            {failed ? (
              <button className="arc-btn solid" onClick={() => go('design')}>
                デザインを見る <ArrowRight size={17} aria-hidden="true" />
              </button>
            ) : (
              <button className="arc-btn solid" onClick={board} disabled={!ready}>
                運転席に乗りこむ <ArrowRight size={17} aria-hidden="true" />
              </button>
            )}
            <button className="arc-btn line" onClick={() => go('grades')}>
              価格を見る
            </button>
          </div>
        </div>
        <dl className="arc-figs">
          <div>
            <dt>一充電走行距離</dt>
            <dd>
              612<small>km</small>
            </dd>
            <dd className="n">WLTC・ARC</dd>
          </div>
          <div>
            <dt>急速充電 10→80%</dt>
            <dd>
              18<small>分</small>
            </dd>
            <dd className="n">最大 250 kW</dd>
          </div>
          <div>
            <dt>0–100 km/h</dt>
            <dd>
              3.9<small>秒</small>
            </dd>
            <dd className="n">ARC Signature</dd>
          </div>
        </dl>
      </section>

      {/* ── design / configurator ── */}
      <section id="design" className="arc-sec arc-design">
        <div className="arc-card">
          <p className="arc-kicker">01 — DESIGN</p>
          <h2>
            屋根から尾まで、
            <br />
            一本の弧で。
          </h2>
          <p>
            ルーフは前席の上で頂点を迎え、そのまま車体の後端まで降りていきます。ガラスは一枚の天蓋のようにつながり、光の線が途切れずに流れます。前後のランプも、細い一本の弧です。
          </p>
          <fieldset className="arc-pick">
            <legend>
              ボディカラー <b>{paint.jp}</b>
              <span>
                {paint.en}
                {paint.note ? `・${paint.note}` : ''}
              </span>
            </legend>
            <div className="arc-paints">
              {PAINTS.map((p) => (
                <button
                  key={p.id}
                  aria-pressed={cfg.paint === p.id}
                  onClick={() => set({ paint: p.id })}
                  style={{ ['--c' as string]: p.hex }}
                  aria-label={`${p.jp}（${p.kana}）${p.price ? `・${yen(p.price)}` : '・追加費用なし'}`}
                >
                  <span className="sw" aria-hidden="true" />
                  <span className="nm">{p.jp}</span>
                </button>
              ))}
            </div>
            <p className="arc-price-note">{paint.price ? `有料色 ${yen(paint.price)}（税込）` : '追加費用なし'}</p>
          </fieldset>
          <fieldset className="arc-pick">
            <legend>ホイール</legend>
            <div className="arc-wheels">
              {WHEELS.map((w) => (
                <button key={w.id} aria-pressed={cfg.wheel === w.id} onClick={() => set({ wheel: w.id })}>
                  <WheelIcon kind={w.id} />
                  <span>
                    <b>
                      {w.size} {w.jp}
                    </b>
                    <small>{w.note}</small>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="arc-seg arc-scenery" role="group" aria-label="背景">
            <button aria-pressed={!cfg.night} onClick={() => set({ night: false })}>
              <Sun size={15} aria-hidden="true" />
              スタジオ
            </button>
            <button aria-pressed={cfg.night} onClick={() => set({ night: true })}>
              <Moon size={15} aria-hidden="true" />
              夜の街
            </button>
          </div>
          <ul className="arc-touch">
            <li>
              <b>ドア</b>取っ手に触れると、ヒンジを軸に開きます
            </li>
            <li>
              <b>ライト</b>前後の弧のランプが灯ります
            </li>
            <li>
              <b>充電口</b>左後ろのフタが開き、状態ランプが光ります
            </li>
          </ul>
        </div>
      </section>

      {/* ── interior ── */}
      <section id="interior" className="arc-sec arc-interior">
        <div className="arc-card">
          <p className="arc-kicker">02 — INTERIOR</p>
          <h2>
            ガラスの天蓋の下で、
            <br />
            静けさに包まれる。
          </h2>
          <p>
            宙に浮かぶ2枚のディスプレイ、手になじむ角丸のステアリング。前席から後席まで続くガラスルーフが、車内を明るく保ちます。足もとからドアまで、細い光の線が室内をなぞります。
          </p>
          <fieldset className="arc-pick">
            <legend>
              内装色 <b>{INTERIORS.find((i) => i.id === cfg.interior)!.jp}</b>
              <span>{INTERIORS.find((i) => i.id === cfg.interior)!.note}</span>
            </legend>
            <div className="arc-trims">
              {INTERIORS.map((i) => (
                <button
                  key={i.id}
                  aria-pressed={cfg.interior === i.id}
                  onClick={() => set({ interior: i.id })}
                  style={{ ['--a' as string]: i.seat, ['--b' as string]: i.trim }}
                >
                  <span className="sw" aria-hidden="true" />
                  <span className="nm">
                    {i.jp}
                    <small>{i.price ? `+${yen(i.price)}` : '追加費用なし'}</small>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="arc-pick">
            <legend>
              アンビエントライト <b>{AMBIENTS.find((a) => a.id === cfg.ambient)!.jp}</b>
            </legend>
            <div className="arc-ambients">
              {AMBIENTS.map((a) => (
                <button
                  key={a.id}
                  aria-pressed={cfg.ambient === a.id}
                  style={{ ['--c' as string]: a.hex }}
                  onClick={() => set({ ambient: a.id })}
                  aria-label={a.jp}
                >
                  <span className="sw" aria-hidden="true" />
                  <span className="nm">{a.jp}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {!failed && (
            <button className="arc-btn solid wide" onClick={board} disabled={!ready}>
              <DoorOpen size={18} aria-hidden="true" />
              運転席に乗りこむ
            </button>
          )}
          <button className="arc-btn line wide" onClick={() => onInquiry(`試乗のご予約（MIRAI ARC・${paint.jp}）`)}>
            この色で試乗を予約
          </button>
        </div>
      </section>
    </div>
  );
}

function WheelIcon({ kind }: { kind: 'aero' | 'sport' }) {
  const n = kind === 'aero' ? 5 : 10;
  const f = (v: number) => v.toFixed(2);
  return (
    <svg viewBox="-20 -20 40 40" aria-hidden="true" className="arc-wicon">
      <circle r="19" className="tyre" />
      <circle r="14" className="rim" />
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (kind === 'sport' ? ((i % 2) - 0.5) * 0.22 : 0);
        return kind === 'aero' ? (
          <path
            key={i}
            d={`M0 0 Q ${f(Math.cos(a + 0.5) * 9)} ${f(Math.sin(a + 0.5) * 9)} ${f(Math.cos(a + 0.9) * 13.5)} ${f(Math.sin(a + 0.9) * 13.5)}`}
            className="blade"
          />
        ) : (
          <line key={i} x1={f(Math.cos(a) * 3.5)} y1={f(Math.sin(a) * 3.5)} x2={f(Math.cos(a) * 13.5)} y2={f(Math.sin(a) * 13.5)} className="spoke" />
        );
      })}
      <circle r="3" className="hub" />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────── specifications
function Spec({ grade, setGrade }: { grade: string; setGrade: (g: string) => void }) {
  const rows: [string, (g: (typeof GRADES)[number]) => string][] = [
    ['駆動方式', (g) => g.drive],
    ['一充電走行距離（WLTC）', (g) => `${g.range} km`],
    ['バッテリー容量', (g) => `${g.battery} kWh`],
    ['最高出力／最大トルク', (g) => `${g.power} kW／${g.torque} N·m`],
    ['0–100 km/h 加速', (g) => `${g.accel} 秒`],
    ['電力量消費率（WLTC）', (g) => `${g.wh} Wh/km`],
    ['車両重量', (g) => `${g.weight.toLocaleString()} kg`],
  ];
  return (
    <section id="spec" className="arc-sec arc-spec">
      <div className="arc-head">
        <p className="arc-kicker">03 — SPECIFICATIONS</p>
        <h2>主要諸元</h2>
      </div>
      <div className="arc-spec-grid">
        <div className="arc-silhouette" aria-hidden="true">
          <svg viewBox="0 0 520 190">
            <path
              className="body"
              d="M28 132 C 30 112 44 100 70 96 L 150 86 C 190 62 238 42 300 40 C 340 40 372 50 408 70 C 440 88 470 96 490 104 C 500 110 500 128 494 136 L 34 142 C 28 140 27 136 28 132 Z"
            />
            <circle cx="120" cy="140" r="30" className="wheel" />
            <circle cx="410" cy="140" r="30" className="wheel" />
            <path className="dim" d="M28 172 H 494 M28 166 V 178 M494 166 V 178" />
            <text x="261" y="187" textAnchor="middle">
              全長 4,760 mm
            </text>
            <path className="dim" d="M120 158 H 410" />
            <text x="265" y="154" textAnchor="middle">
              ホイールベース 2,920 mm
            </text>
            <path className="dim" d="M508 40 V 170 M502 40 H 514 M502 170 H 514" />
            <text x="512" y="30" textAnchor="end">
              全高 1,560 mm
            </text>
          </svg>
        </div>
        <dl className="arc-common">
          {SPEC_COMMON.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="arc-table-wrap" role="region" aria-label="グレード別の諸元（横にスクロールできます）" tabIndex={0}>
        <table className="arc-table">
          <thead>
            <tr>
              <th scope="col">項目</th>
              {GRADES.map((g) => (
                <th key={g.id} scope="col" className={grade === g.id ? 'sel' : ''}>
                  <button onClick={() => setGrade(g.id)} aria-pressed={grade === g.id}>
                    {g.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, f]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                {GRADES.map((g) => (
                  <td key={g.id} className={grade === g.id ? 'sel' : ''}>
                    {f(g)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="arc-fine">数値はすべて架空の制作サンプルです。WLTCモードは定められた試験条件での値で、実際の走行では気温・速度・空調の使い方などで変わります。</p>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── charging
const CHARGERS = [
  { id: 'dc250', jp: '急速 250 kW', kw: 250, where: 'MIRAI CHARGE（高速道路SA など）' },
  { id: 'dc90', jp: '急速 90 kW', kw: 90, where: '商業施設・販売店' },
  { id: 'ac11', jp: '普通 11 kW', kw: 11, where: '職場・マンション' },
  { id: 'ac6', jp: '普通 6 kW', kw: 6, where: 'ご自宅（200V）' },
];
function Charge({ grade }: { grade: string }) {
  const g = GRADES.find((x) => x.id === grade)!;
  const [from, setFrom] = useState(15);
  const [to, setTo] = useState(80);
  const [ch, setCh] = useState('dc250');
  const c = CHARGERS.find((x) => x.id === ch)!;
  const mins = chargeMinutes(from, to, c.kw, g.battery);
  const km = Math.round(((to - from) / 100) * g.range);
  const fmt = (m: number) => (m < 90 ? `約${Math.round(m)}分` : `約${Math.floor(m / 60)}時間${Math.round(m % 60) ? `${Math.round(m % 60)}分` : ''}`);
  // curve (power vs state of charge) for the chart
  const pts = useMemo(() => {
    const out: [number, number][] = [];
    for (let s = 0; s <= 100; s += 2) out.push([s, chargePower(s / 100, c.kw, g.battery)]);
    return out;
  }, [c.kw, g.battery]);
  const maxP = c.kw > 22 ? 260 : 12;
  const X = (s: number) => 40 + (s / 100) * 440;
  const Y = (p: number) => 180 - (p / maxP) * 150;
  const line = pts.map(([s, p], i) => `${i ? 'L' : 'M'}${X(s).toFixed(1)} ${Y(p).toFixed(1)}`).join(' ');
  const band = pts.filter(([s]) => s >= from && s <= to);
  const area = band.length
    ? `M${X(band[0][0])} 180 ` + band.map(([s, p]) => `L${X(s).toFixed(1)} ${Y(p).toFixed(1)}`).join(' ') + ` L${X(band[band.length - 1][0])} 180 Z`
    : '';
  const home = (g.battery * (to - from)) / 100 / 0.9;
  return (
    <section id="charge" className="arc-sec arc-charge">
      <div className="arc-head">
        <p className="arc-kicker">04 — CHARGING</p>
        <h2>
          コーヒー1杯のあいだに、
          <br />
          400 km ぶん。
        </h2>
        <p>
          最大 250 kW の急速充電に対応。バッテリーは充電器に着く前から温度を整え、10%から80%まで約18分で充電します。ふだんは家で眠っているあいだに。
        </p>
      </div>
      <div className="arc-calc">
        <div className="arc-calc-in">
          <div className="arc-seg arc-chargers" role="group" aria-label="充電器の種類">
            {CHARGERS.map((x) => (
              <button key={x.id} aria-pressed={ch === x.id} onClick={() => setCh(x.id)}>
                {x.jp}
              </button>
            ))}
          </div>
          <label className="arc-range">
            <span>
              今の残量 <b>{from}%</b>
            </span>
            <input type="range" min={0} max={95} step={5} value={from} onChange={(e) => setFrom(Math.min(+e.target.value, to - 5))} />
          </label>
          <label className="arc-range">
            <span>
              充電したい量 <b>{to}%</b>
            </span>
            <input type="range" min={10} max={100} step={5} value={to} onChange={(e) => setTo(Math.max(+e.target.value, from + 5))} />
          </label>
          <output className="arc-result" aria-live="polite">
            <span>
              {c.jp}で {from}% → {to}%
            </span>
            <b>{fmt(mins)}</b>
            <small>
              約 {km} km ぶん（{g.name}・{g.battery} kWh）
            </small>
          </output>
          <p className="arc-where">主な設置場所：{c.where}</p>
        </div>
        <figure className="arc-curve">
          <svg viewBox="0 0 500 210" role="img" aria-label={`充電の速さのグラフ。${c.jp}の場合、残量に応じて充電の電力が変わります。`}>
            {[0, 20, 40, 60, 80, 100].map((s) => (
              <g key={s}>
                <line x1={X(s)} x2={X(s)} y1={28} y2={180} className="grid" />
                <text x={X(s)} y={198} textAnchor="middle">
                  {s}%
                </text>
              </g>
            ))}
            {area && <path d={area} className="area" />}
            <path d={line} className="line" />
            <text x={40} y={18} className="unit">
              充電の電力（kW）　最大 {Math.round(Math.max(...pts.map((p) => p[1])))} kW
            </text>
          </svg>
          <figcaption>電池を守るため、80%を超えると電力をゆるやかに下げます。</figcaption>
        </figure>
      </div>
      <div className="arc-ways">
        <article>
          <Home size={22} aria-hidden="true" />
          <h3>家で、眠っているあいだに</h3>
          <p>
            6 kW の普通充電器なら、{to - from}% ぶんを{fmt(chargeMinutes(from, to, 6, g.battery))}。夜間の電気料金（1 kWh あたり 27 円の場合）でおよそ {yen(home * 27)}です。
          </p>
        </article>
        <article>
          <BatteryCharging size={22} aria-hidden="true" />
          <h3>遠出の途中で</h3>
          <p>行き先を入れると、ナビが充電の場所と時間を組みこみ、着く前に電池を温めておきます。</p>
        </article>
        <article>
          <PlugZap size={22} aria-hidden="true" />
          <h3>電気を、家や外へ</h3>
          <p>V2H に対応。満充電なら一般的な家庭の約5日分をまかなえます。1,500 W のコンセントも使えます。</p>
        </article>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── grades & estimate
function Grades({
  cfg,
  grade,
  setGrade,
  onInquiry,
}: {
  cfg: Config;
  grade: string;
  setGrade: (g: string) => void;
  onInquiry: (s?: string) => void;
}) {
  const [opts, setOpts] = useState<Record<string, boolean>>({ home: true });
  const [down, setDown] = useState(1000000);
  const [term, setTerm] = useState<number>(60);
  const [city, setCity] = useState(true);
  const [dealer, setDealer] = useState(DEALERS[0]);
  const g = GRADES.find((x) => x.id === grade)!;
  const paint = PAINTS.find((p) => p.id === cfg.paint)!;
  const wheel = WHEELS.find((w) => w.id === cfg.wheel)!;
  const interior = INTERIORS.find((i) => i.id === cfg.interior)!;
  const chosen = OPTIONS.filter((o) => opts[o.id] || o.stdOn?.includes(grade));
  const optTotal = chosen.reduce((s, o) => s + optionPrice(o, grade), 0);
  const total = g.price + paint.price + wheelPrice(wheel, grade) + interior.price + optTotal;
  const subsidy = SUBSIDY.national + (city ? SUBSIDY.city : 0);
  const net = total - subsidy;
  const dp = Math.min(down, total);
  const pay = monthly(total - dp, term);
  const summary =
    `MIRAI ARC 試乗・見積りのご予約｜グレード：${g.name}（${yen(g.price)}）／ボディカラー：${paint.jp}（${paint.en}）／ホイール：${wheel.size} ${wheel.jp}／内装：${interior.jp}` +
    `／オプション：${chosen.length ? chosen.map((o) => o.jp).join('、') : 'なし'}` +
    `／お支払い総額 ${yen(total)}（税込・諸費用別）／補助金を差し引いた目安 ${yen(net)}` +
    `／月々 ${yen(pay)}（頭金 ${yen(dp)}・${term}回・年率${APR}%）／希望の販売店：${dealer}`;
  return (
    <section id="grades" className="arc-sec arc-grades">
      <div className="arc-head">
        <p className="arc-kicker">05 — GRADES & PRICE</p>
        <h2>グレードと価格</h2>
        <p>選んだ色・ホイール・内装は、そのまま見積りに入っています。</p>
      </div>
      <div className="arc-grade-list" role="radiogroup" aria-label="グレード">
        {GRADES.map((x) => (
          <button key={x.id} role="radio" aria-checked={grade === x.id} className="arc-grade" onClick={() => setGrade(x.id)}>
            <span className="nm">{x.name}</span>
            <span className="lead">{x.lead}</span>
            <span className="price">
              {yen(x.price)}
              <small>税込</small>
            </span>
            <span className="facts">
              <span>
                <b>{x.range}</b>km
              </span>
              <span>
                <b>{x.accel}</b>秒
              </span>
              <span>
                <b>{x.power}</b>kW
              </span>
            </span>
            <ul>
              {x.std.map((s) => (
                <li key={s}>
                  <Check size={14} aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <div className="arc-estimate">
        <div className="arc-opts">
          <h3>オプション</h3>
          <ul>
            {OPTIONS.map((o) => {
              const std = o.stdOn?.includes(grade);
              return (
                <li key={o.id}>
                  <label className={std ? 'std' : ''}>
                    <input
                      type="checkbox"
                      checked={std || !!opts[o.id]}
                      disabled={std}
                      onChange={(e) => setOpts({ ...opts, [o.id]: e.target.checked })}
                    />
                    <span className="box" aria-hidden="true">
                      <Check size={13} />
                    </span>
                    <span className="t">
                      {o.jp}
                      <small>{o.note}</small>
                    </span>
                    <span className="p">{std ? '標準装備' : `+${yen(o.price)}`}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <h3>お支払いの試算</h3>
          <label className="arc-range">
            <span>
              頭金 <b>{yen(dp)}</b>
            </span>
            <input type="range" min={0} max={3000000} step={100000} value={down} onChange={(e) => setDown(+e.target.value)} />
          </label>
          <div className="arc-seg arc-terms" role="group" aria-label="お支払い回数">
            {TERMS.map((t) => (
              <button key={t} aria-pressed={term === t} onClick={() => setTerm(t)}>
                {t}回
              </button>
            ))}
          </div>
          <label className="arc-check">
            <input type="checkbox" checked={city} onChange={(e) => setCity(e.target.checked)} />
            <span className="box" aria-hidden="true">
              <Check size={13} />
            </span>
            みらい市の補助金（{yen(SUBSIDY.city)}）も使う
          </label>
        </div>
        <aside className="arc-sum" aria-live="polite">
          <p className="arc-sum-car">
            <span className="sw" style={{ ['--c' as string]: paint.hex }} aria-hidden="true" />
            <span>
              <b>MIRAI ARC {g.name.replace('ARC', '').trim() || ''}</b>
              <small>
                {paint.jp}・{wheel.size} {wheel.jp}・内装 {interior.jp}
              </small>
            </span>
          </p>
          <dl>
            <div>
              <dt>車両本体価格</dt>
              <dd>{yen(g.price)}</dd>
            </div>
            <div>
              <dt>ボディカラー（{paint.jp}）</dt>
              <dd>{paint.price ? yen(paint.price) : '—'}</dd>
            </div>
            <div>
              <dt>ホイール（{wheel.size}）</dt>
              <dd>{wheelPrice(wheel, grade) ? yen(wheelPrice(wheel, grade)) : '—'}</dd>
            </div>
            <div>
              <dt>内装（{interior.jp}）</dt>
              <dd>{interior.price ? yen(interior.price) : '—'}</dd>
            </div>
            <div>
              <dt>オプション</dt>
              <dd>{optTotal ? yen(optTotal) : '—'}</dd>
            </div>
            <div className="total">
              <dt>お支払い総額</dt>
              <dd>
                {yen(total)}
                <small>税込・諸費用別</small>
              </dd>
            </div>
            <div className="minus">
              <dt>補助金（国{city ? '＋みらい市' : ''}）</dt>
              <dd>−{yen(subsidy)}</dd>
            </div>
            <div className="net">
              <dt>補助金を差し引いた目安</dt>
              <dd>{yen(net)}</dd>
            </div>
            <div className="month">
              <dt>
                月々のお支払い
                <small>
                  {term}回・年率{APR}%
                </small>
              </dt>
              <dd>
                {yen(pay)}
                <small>/月</small>
              </dd>
            </div>
          </dl>
          <label className="arc-select">
            <span>試乗する販売店</span>
            <select value={dealer} onChange={(e) => setDealer(e.target.value)}>
              {DEALERS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <button className="arc-btn solid wide" onClick={() => onInquiry(summary)}>
            この仕様で試乗を予約 <ArrowUpRight size={17} aria-hidden="true" />
          </button>
          <p className="arc-fine">
            補助金は登録後の申請で交付されるため、月々の試算には含めていません。価格・補助金額・金利はすべて架空です。
          </p>
        </aside>
      </div>
    </section>
  );
}

export default function ArcSite({ onInquiry }: { onInquiry: (summary?: string) => void }) {
  const [cfg, setCfg] = useState<Config>({ paint: 'sakin', wheel: 'aero', interior: 'kinari', ambient: 'kohaku', night: false });
  const [grade, setGrade] = useState('awd');
  const set = (p: Partial<Config>) => setCfg((c) => ({ ...c, ...p }));
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500&display=swap" precedence="default" />
      <Showroom cfg={cfg} set={set} onInquiry={onInquiry} />
      <Spec grade={grade} setGrade={setGrade} />
      <Charge grade={grade} />
      <Grades cfg={cfg} grade={grade} setGrade={setGrade} onInquiry={onInquiry} />
      <p className="arc-sample">MIRAI ARC は架空のブランドです。車両・価格・諸元・販売店はすべて制作サンプルとして作成したものです。</p>
    </>
  );
}

