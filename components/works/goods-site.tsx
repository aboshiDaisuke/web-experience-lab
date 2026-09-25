'use client';
import '@/app/signatures/goods.css';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  Gift,
  Minus,
  Plus,
  RotateCcw,
  ShoppingBag,
  Star,
  Truck,
  X,
  Package,
  CreditCard,
  Hand,
} from 'lucide-react';
import {
  BOXES,
  CATS,
  COD_FEE,
  FEATURE,
  FREE_SHIPPING,
  GIFT_FEE,
  ITEMS,
  MAKERS,
  NEWS,
  OKINAWA_FLAT,
  PREFS,
  REGIONS,
  SETS,
  TIME_SLOTS,
  boxFee,
  dimsOf,
  earliestDelivery,
  itemOf,
  makerOf,
  mdw,
  priceOf,
  shipDate,
  variantOf,
  yen,
  type CatId,
  type Item,
  type ItemId,
  type MakerId,
  type RegionId,
} from '@/lib/works/goods/data';
import { cart, lineKey, totals, type CartState, type Line } from '@/lib/works/goods/cart';
import { packAll } from '@/lib/works/goods/pack';
import type { BoxCtl, BoxView } from '@/lib/works/goods/box-scene';
import type { Shot, Studio, View } from '@/lib/works/goods/studio';

// ── small hooks ─────────────────────────────────────────────────────────────
const noopSub = () => () => {};
function useMedia(q: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(q);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => matchMedia(q).matches,
    () => false,
  );
}
const useReduced = () => useMedia('(prefers-reduced-motion: reduce)');
const useCart = () => useSyncExternalStore(cart.subscribe, cart.get, cart.get);
const useMounted = () => useSyncExternalStore(noopSub, () => true, () => false);

// ── shared studio (one GL context for every product image) ─────────────────
const StudioCtx = createContext<{ studio: Studio | null; failed: boolean }>({ studio: null, failed: false });

function StudioProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<{ studio: Studio | null; failed: boolean }>({ studio: null, failed: false });
  useEffect(() => {
    let dead = false;
    let release: (() => void) | null = null;
    void import('@/lib/works/goods/studio').then((m) => {
      if (dead) return;
      const s = m.acquireStudio();
      release = m.releaseStudio;
      setSt({ studio: s, failed: !s });
    });
    return () => {
      dead = true;
      release?.();
    };
  }, []);
  return <StudioCtx.Provider value={st}>{children}</StudioCtx.Provider>;
}

/** A product "photograph": rendered by the shared studio into a 2D canvas. */
function ItemCanvas({
  shots,
  view,
  spin = false,
  drag = false,
  className = '',
  label,
  onRef,
}: {
  shots: Shot[];
  view?: View;
  spin?: boolean;
  drag?: boolean;
  className?: string;
  label: string;
  onRef?: (c: HTMLCanvasElement | null) => void;
}) {
  const { studio, failed } = useContext(StudioCtx);
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReduced();
  const sig = JSON.stringify(shots) + JSON.stringify(view ?? {});
  const [zoom, setZoom] = useState(1);
  const ctl = useRef<{ reset: () => void; zoom: (z: number) => void } | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c || !studio) return;
    const sh: Shot[] = JSON.parse(sig.slice(0, sig.indexOf(']') + 1));
    const vw: View = view ?? {};
    const { defaultYawOf, defaultPitchOf } = pitchYaw;
    const baseYaw = vw.yaw ?? defaultYawOf(sh[0].id);
    const basePitch = vw.pitch ?? defaultPitchOf(sh[0].id);
    let yaw = baseYaw;
    let pitch = basePitch;
    let fill = vw.fill ?? 0.92;
    let inView = false;
    let raf = 0;
    let last = 0;
    let hovering = false;
    let dragging = false;
    let idleT = 0;
    let vel = 0;
    const draw = (direct = false) => {
      if (!inView || !c.width) return;
      if (direct) studio.draw(c, sh, { ...vw, yaw, pitch, fill });
      else studio.request(c, sh, { ...vw, yaw, pitch, fill });
    };
    const resize = () => {
      const r = c.getBoundingClientRect();
      const d = Math.min(devicePixelRatio || 1, studio.dprCap);
      const w = Math.max(2, Math.round(r.width * d));
      const h = Math.max(2, Math.round(r.height * d));
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
        draw();
      }
    };
    const loop = (t: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      let again = false;
      if (drag) {
        if (!dragging) {
          idleT += dt;
          if (Math.abs(vel) > 0.01) {
            yaw += vel * dt;
            vel *= Math.exp(-dt * 4);
            again = true;
          } else if (!reduced && idleT > 1.6) {
            yaw += dt * 0.35;
            again = true;
          }
        }
      } else if (hovering) {
        yaw += dt * 1.1;
        again = true;
      } else {
        // ease back to the catalogue angle
        const full = Math.PI * 2;
        const target = baseYaw + Math.round((yaw - baseYaw) / full) * full;
        const d = target - yaw;
        if (Math.abs(d) > 0.002) {
          yaw += d * (1 - Math.exp(-dt * 7));
          again = true;
        } else yaw = target;
      }
      draw(true);
      if (again && inView && !document.hidden) raf = requestAnimationFrame(loop);
      else last = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      if (inView) {
        resize();
        draw();
        if (drag) kick();
      }
    }, { rootMargin: '200px' });
    io.observe(c);
    const ro = new ResizeObserver(resize);
    ro.observe(c);

    const enter = () => {
      if (!spin || reduced) return;
      hovering = true;
      kick();
    };
    const leave = () => {
      hovering = false;
      kick();
    };
    const host = spin ? c.closest('.gd-card') ?? c : c;
    const canHover = matchMedia('(hover: hover)').matches;
    if (spin && canHover) {
      host.addEventListener('pointerenter', enter);
      host.addEventListener('pointerleave', leave);
    }
    // detail viewer: drag to turn (horizontal) and tilt (vertical)
    let px = 0;
    let py = 0;
    let lastX = 0;
    let lastT = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      px = e.clientX;
      py = e.clientY;
      lastX = e.clientX;
      lastT = performance.now();
      vel = 0;
      c.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      px = e.clientX;
      py = e.clientY;
      yaw += dx * 0.012;
      pitch = Math.max(0.05, Math.min(1.35, pitch + dy * 0.008));
      const now = performance.now();
      vel = ((e.clientX - lastX) * 0.012) / Math.max(0.016, (now - lastT) / 1000);
      lastX = e.clientX;
      lastT = now;
      idleT = 0;
      draw(true);
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      idleT = 0;
      kick();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') yaw -= 0.3;
      else if (e.key === 'ArrowRight') yaw += 0.3;
      else if (e.key === 'ArrowUp') pitch = Math.max(0.05, pitch - 0.15);
      else if (e.key === 'ArrowDown') pitch = Math.min(1.35, pitch + 0.15);
      else return;
      e.preventDefault();
      idleT = 0;
      draw(true);
    };
    if (drag) {
      c.addEventListener('pointerdown', down);
      c.addEventListener('pointermove', move);
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('keydown', key);
      ctl.current = {
        reset: () => {
          yaw = baseYaw;
          pitch = basePitch;
          fill = vw.fill ?? 0.92;
          vel = 0;
          idleT = 0;
          draw(true);
        },
        zoom: (z) => {
          fill = (vw.fill ?? 0.92) * z;
          draw(true);
        },
      };
    }
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      host.removeEventListener('pointerenter', enter);
      host.removeEventListener('pointerleave', leave);
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up);
      c.removeEventListener('keydown', key);
      ctl.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio, sig, spin, drag, reduced]);

  useEffect(() => {
    ctl.current?.zoom(zoom);
  }, [zoom]);

  if (failed)
    return (
      <div className={`gd-canvas gd-fallback ${className}`} role="img" aria-label={label}>
        <FallbackArt id={shots[0].id} />
      </div>
    );
  return (
    <div className={`gd-canvas ${studio ? 'is-live' : ''} ${className}`}>
      <canvas
        ref={(n) => {
          ref.current = n;
          onRef?.(n);
        }}
        role="img"
        aria-label={label}
        tabIndex={drag ? 0 : undefined}
      />
      {drag && (
        <div className="gd-viewer-tools">
          <span className="gd-viewer-hint">
            <Hand size={15} aria-hidden="true" />
            ドラッグで回せます
          </span>
          <button type="button" onClick={() => setZoom((z) => Math.min(1.5, z + 0.25))} aria-label="拡大">
            <Plus size={16} />
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))} aria-label="縮小">
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              ctl.current?.reset();
            }}
            aria-label="向きを戻す"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// yaw/pitch defaults live in the studio module; mirror them here without importing three
const FLAT_IDS = new Set<ItemId>(['rinka', 'nanasun', 'board', 'spoon', 'hashi', 'fukin', 'apron', 'zaru', 'pan']);
const YAWS: Partial<Record<ItemId, number>> = { shinogi: -0.55, kyusu: 0.5, board: 0.35, spoon: 0.6, hashi: 0.55, pan: 0.45, donabe: 0.25, fukin: 0.35, apron: 0.3 };
const pitchYaw = {
  defaultYawOf: (id: ItemId) => YAWS[id] ?? 0.3,
  defaultPitchOf: (id: ItemId) => (FLAT_IDS.has(id) ? 0.62 : 0.36),
};

/** Static line art when WebGL is not available. */
function FallbackArt({ id }: { id: ItemId }) {
  const it = itemOf(id);
  const [w, , h] = it.dims;
  const k = 150 / Math.max(w, h * 1.6);
  const W = w * k;
  const H = Math.max(10, h * k);
  return (
    <svg viewBox="0 0 200 160" aria-hidden="true">
      <ellipse cx="100" cy={122} rx={W * 0.55} ry="8" fill="#3a2a1a22" />
      <rect x={100 - W / 2} y={120 - H} width={W} height={H} rx={Math.min(W, H) * 0.35} fill={it.variants[0].swatch} stroke="#3a2a1a55" />
    </svg>
  );
}

// ── the box: one renderer, reparented into whichever slot is active ────────
type SlotKind = 'checkout' | 'drawer' | 'detail' | 'hero' | 'dock';
const PRIORITY: SlotKind[] = ['checkout', 'drawer', 'detail', 'hero', 'dock'];
type BoxStage = {
  register: (k: SlotKind, el: HTMLElement | null) => void;
  active: SlotKind;
  ctl: React.RefObject<BoxCtl | null>;
  host: React.RefObject<HTMLDivElement | null>;
  ready: boolean;
  failed: boolean;
  fly: (from: Element | null, img?: HTMLCanvasElement | null) => number;
  peek: boolean;
};
const BoxCtx = createContext<BoxStage | null>(null);
const useBox = () => useContext(BoxCtx)!;

function BoxStageProvider({ children, open }: { children: ReactNode; open: { checkout: boolean; drawer: boolean; detail: boolean } }) {
  const slots = useRef(new Map<SlotKind, HTMLElement>());
  const [ver, setVer] = useState(0);
  const [heroOn, setHeroOn] = useState(true);
  const host = useRef<HTMLDivElement | null>(null);
  const ctl = useRef<BoxCtl | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [peek, setPeek] = useState(false);
  const reduced = useReduced();
  const heroIO = useRef<IntersectionObserver | null>(null);
  const s = useCart();

  const register = useCallback((k: SlotKind, el: HTMLElement | null) => {
    const cur = slots.current.get(k);
    if (el === cur) return;
    if (el) slots.current.set(k, el);
    else slots.current.delete(k);
    if (k === 'hero') {
      heroIO.current?.disconnect();
      if (el) {
        heroIO.current = new IntersectionObserver(([e]) => setHeroOn(e.intersectionRatio > 0.3), { threshold: [0, 0.3, 0.6] });
        heroIO.current.observe(el);
      }
    }
    setVer((v) => v + 1);
  }, []);

  const active: SlotKind = (PRIORITY.find((k) => {
    if (!slots.current.has(k)) return false;
    if (k === 'checkout') return open.checkout;
    if (k === 'drawer') return open.drawer;
    if (k === 'detail') return open.detail;
    if (k === 'hero') return heroOn;
    return true;
  }) ?? 'dock') as SlotKind;
  void ver;

  // create the host + renderer once
  useEffect(() => {
    const el = document.createElement('div');
    el.className = 'gd-box-host';
    host.current = el;
    let dead = false;
    const unsub = cart.subscribe(() => ctl.current?.sync(syncOf(cart.get())));
    void import('@/lib/works/goods/box-scene')
      .then(({ mountBox }) => {
        if (dead) return;
        try {
          ctl.current = mountBox(el, {
            reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
            narrow: matchMedia('(max-width: 760px)').matches,
            onReady: () => setReady(true),
          });
          ctl.current.sync(syncOf(cart.get()), true);
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    // drag the box sideways to look around (vertical stays page scroll)
    let dx0 = 0;
    let on = false;
    const pd = (e: PointerEvent) => {
      on = true;
      dx0 = e.clientX;
    };
    const pm = (e: PointerEvent) => {
      if (!on) return;
      ctl.current?.nudge((e.clientX - dx0) * -0.12);
      dx0 = e.clientX;
    };
    const pu = () => (on = false);
    el.addEventListener('pointerdown', pd);
    el.addEventListener('pointermove', pm);
    el.addEventListener('pointerup', pu);
    el.addEventListener('pointercancel', pu);
    el.addEventListener('pointerleave', pu);
    return () => {
      dead = true;
      unsub();
      ctl.current?.dispose();
      ctl.current = null;
      el.remove();
      heroIO.current?.disconnect();
    };
  }, []);

  // move the host into the active slot, FLIP-animated
  useLayoutEffect(() => {
    const el = host.current;
    const slot = slots.current.get(active);
    if (!el || !slot || el.parentElement === slot) {
      ctl.current?.setView(viewOf(active));
      return;
    }
    const before = el.isConnected ? el.getBoundingClientRect() : null;
    slot.appendChild(el);
    ctl.current?.setView(viewOf(active));
    const after = el.getBoundingClientRect();
    if (!before || before.width < 2 || after.width < 2 || reduced) return;
    const parentScale = after.width / Math.max(1, el.offsetWidth);
    const sc = before.width / after.width;
    const dx = (before.left - after.left) / parentScale;
    const dy = (before.top - after.top) / parentScale;
    el.animate(
      [
        { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sc})` },
        { transformOrigin: '0 0', transform: 'none' },
      ],
      { duration: 560, easing: 'cubic-bezier(.2,.75,.15,1)' },
    );
  });

  // peek: when something is added while the box sits in the dock, open it up a moment
  const seq = s.addSeq;
  useEffect(() => {
    if (!seq) return;
    setPeek(true);
    const t = setTimeout(() => setPeek(false), 3200);
    return () => clearTimeout(t);
  }, [seq]);

  const fly = useCallback(
    (from: Element | null, img?: HTMLCanvasElement | null) => {
      const el = host.current;
      if (!from || !el || reduced || !img || !img.width) return 0;
      const a = from.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      if (!a.width || !b.width) return 0;
      const f = document.createElement('div');
      f.className = 'gd-flyer';
      const size = Math.min(a.width, a.height, 220);
      f.style.width = f.style.height = `${size}px`;
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d')?.drawImage(img, 0, 0);
      f.appendChild(c);
      document.body.appendChild(f);
      const x0 = a.left + a.width / 2 - size / 2;
      const y0 = a.top + a.height / 2 - size / 2;
      const x1 = b.left + b.width / 2 - size / 2;
      const y1 = b.top + b.height * 0.2 - size / 2;
      const s1 = Math.max(0.18, Math.min(0.5, (b.width * 0.35) / size));
      const midY = Math.min(y0, y1) - 120;
      f.animate(
        [
          { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
          { transform: `translate(${(x0 + x1) / 2}px, ${midY}px) scale(${(1 + s1) / 2}) rotate(-8deg)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${x1}px, ${y1}px) scale(${s1}) rotate(4deg)`, opacity: 0 },
        ],
        { duration: 680, easing: 'cubic-bezier(.3,.1,.3,1)' },
      ).onfinish = () => f.remove();
      return 560;
    },
    [reduced],
  );

  const value = useMemo<BoxStage>(() => ({ register, active, ctl, host, ready, failed, fly, peek }), [register, active, ready, failed, fly, peek]);
  return <BoxCtx.Provider value={value}>{children}</BoxCtx.Provider>;
}
const viewOf = (k: SlotKind): BoxView => (k === 'dock' ? 'dock' : k === 'checkout' ? 'checkout' : k === 'hero' ? 'hero' : 'drawer');
const syncOf = (s: CartState) => ({ units: s.units, packing: s.packing, arrivals: s.arrivals, gift: s.gift });

function BoxSlot({ kind, className = '' }: { kind: SlotKind; className?: string }) {
  const { register } = useBox();
  const ref = useCallback((el: HTMLDivElement | null) => register(kind, el), [kind, register]);
  return <div ref={ref} className={`gd-slot gd-slot-${kind} ${className}`} />;
}

/** Add to cart with the flying snapshot and the delayed 3D drop. */
function useAdd() {
  const box = useBox();
  return useCallback(
    (lines: Line[], from?: Element | null, img?: HTMLCanvasElement | null, gift?: boolean) => {
      const delay = box.fly(from ?? null, img);
      cart.add(lines, { delayMs: delay, gift });
    },
    [box],
  );
}

// ── shared bits ─────────────────────────────────────────────────────────────
function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="gd-stars" aria-label={`5点中 ${value.toFixed(1)}点`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="gd-star" aria-hidden="true">
          <Star size={size} />
          <span style={{ width: `${Math.max(0, Math.min(1, value - i)) * 100}%` }}>
            <Star size={size} fill="currentColor" />
          </span>
        </span>
      ))}
    </span>
  );
}

function Seal({ ch, className = '' }: { ch: string; className?: string }) {
  return (
    <span className={`gd-seal ${className}`} aria-hidden="true">
      <span>{ch}</span>
    </span>
  );
}

function stockText(it: Item) {
  if (it.stock <= 0) return { t: `入荷待ち（${it.restock}）`, k: 'out' };
  if (it.stock <= 5) return { t: `残り${it.stock}点`, k: 'low' };
  return { t: '在庫あり', k: 'ok' };
}

function Qty({ value, onChange, max = 9, label }: { value: number; onChange: (n: number) => void; max?: number; label: string }) {
  return (
    <div className="gd-qty" role="group" aria-label={`${label}の数量`}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="数量を減らす">
        <Minus size={16} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="数量を増やす">
        <Plus size={16} />
      </button>
    </div>
  );
}

const boxLabel = (s: CartState) => {
  const t = totals(s);
  if (!t.count) return '60サイズ';
  return t.boxes.map((b) => `${b.size}サイズ`).join('＋');
};

// ── hero: this month's feature ──────────────────────────────────────────────
function Hero({ onOpen }: { onOpen: (id: ItemId, v?: string) => void }) {
  const s = useCart();
  const t = totals(s);
  const add = useAdd();
  const box = useBox();
  const picks = FEATURE.picks.map((p) => ({ ...p, it: itemOf(p.id) }));
  const canv = useRef<Record<string, HTMLCanvasElement | null>>({});
  const b0 = s.packing.boxes[0];
  return (
    <section id="top" className="gd-hero">
      <div className="gd-announce" role="note">
        <span>
          <Truck size={16} aria-hidden="true" />
          税込 {yen(FREE_SHIPPING)} 以上で送料無料
        </span>
        <span>平日14時までのご注文は、当日発送</span>
        <span>割れ物は、紙のクッションで包んでお届けします</span>
      </div>
      <div className="gd-hero-grid">
        <div className="gd-hero-copy">
          <p className="gd-kicker">{FEATURE.kicker}</p>
          <h1>
            {FEATURE.title.split('\n').map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </h1>
          <p className="gd-hero-lead">{FEATURE.lead}</p>
          <ul className="gd-picks" aria-label="特集の品">
            {picks.map(({ it, v }) => (
              <li key={it.id}>
                <button type="button" className="gd-pick-img" onClick={() => onOpen(it.id, v)} aria-label={`${it.name}の詳細`}>
                  <ItemCanvas shots={[{ id: it.id, v }]} label={it.name} onRef={(c) => (canv.current[it.id] = c)} spin />
                </button>
                <div>
                  <p className="gd-pick-maker">{makerOf(it.maker).name}</p>
                  <p className="gd-pick-name">{it.name}</p>
                  <p className="gd-pick-price">
                    {yen(priceOf(it, v))}
                    <small>税込</small>
                  </p>
                </div>
                <button
                  type="button"
                  className="gd-btn gd-btn-add"
                  disabled={it.stock <= 0}
                  onClick={(e) => add([{ id: it.id, v, q: 1 }], canv.current[it.id] ?? e.currentTarget, canv.current[it.id])}
                >
                  <ShoppingBag size={16} aria-hidden="true" />
                  かごに入れる
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="gd-btn gd-btn-ghost gd-hero-all"
            onClick={() => add(picks.map((p) => ({ id: p.it.id, v: p.v, q: 1 })), document.querySelector('.gd-picks'))}
          >
            三点まとめて、かごに入れる
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <figure className="gd-hero-box">
          <div className="gd-hero-stage">
            <BoxSlot kind="hero" />
            {box.failed && <BoxFallback />}
            <div className={`gd-hero-empty ${t.count ? 'is-hidden' : ''}`} aria-hidden={t.count > 0}>
              <p>
                「かごに入れる」と、
                <br />
                品物がこの箱に詰まっていきます。
              </p>
            </div>
            <div className="gd-hero-hud" aria-live="polite">
              <span className="gd-hud-size">
                <b>{t.count ? boxLabel(s) : '60サイズ'}</b>
                {b0 && <span className="gd-hud-dims">{`${b0.size.inner[0]}×${b0.size.inner[1]}×${b0.size.inner[2]}cm`}</span>}
              </span>
              <span>
                {t.count}点・{yen(t.subtotal)}
              </span>
              <span>送料 {t.count ? (t.shipping ? yen(t.shipping) : '無料') : '—'}</span>
            </div>
          </div>
          <figcaption>
            <FreeMeter s={s} />
            <p className="gd-hero-note">
              <Package size={16} aria-hidden="true" />
              品物の大きさから、箱のサイズと送料をその場で計算します。箱は横にドラッグすると回せます。
            </p>
          </figcaption>
        </figure>
      </div>
      <div className="gd-news">
        <p className="gd-news-h">お知らせ</p>
        <ul>
          {NEWS.map((n) => (
            <li key={n.date}>
              <time>{n.date}</time>
              {n.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function BoxFallback() {
  const s = useCart();
  return (
    <div className="gd-box-fallback" role="img" aria-label={`段ボール箱 ${boxLabel(s)}`}>
      <svg viewBox="0 0 200 150" aria-hidden="true">
        <path d="M30 60 L100 35 L170 60 L100 85 Z" fill="#8a6440" />
        <path d="M30 60 L30 110 L100 135 L100 85 Z" fill="#b8905f" />
        <path d="M170 60 L170 110 L100 135 L100 85 Z" fill="#a37b4e" />
      </svg>
      <p>{boxLabel(s)}</p>
    </div>
  );
}

function FreeMeter({ s, compact = false }: { s: CartState; compact?: boolean }) {
  const t = totals(s);
  const p = Math.min(1, t.subtotal / FREE_SHIPPING);
  return (
    <div className={`gd-meter ${t.free ? 'is-free' : ''} ${compact ? 'is-compact' : ''}`}>
      <p>
        {t.free ? (
          <>
            <Check size={15} aria-hidden="true" />
            送料無料になりました{s.region === 'okinawa' ? `（沖縄は一律 ${yen(OKINAWA_FLAT)}）` : ''}
          </>
        ) : t.count ? (
          <>
            あと <b>{yen(t.toFree)}</b> で送料無料
          </>
        ) : (
          <>税込 {yen(FREE_SHIPPING)} 以上で送料無料</>
        )}
      </p>
      <div className="gd-meter-bar" role="progressbar" aria-valuemin={0} aria-valuemax={FREE_SHIPPING} aria-valuenow={Math.min(FREE_SHIPPING, t.subtotal)} aria-label="送料無料までの進み具合">
        <span style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}

// ── feature sets ────────────────────────────────────────────────────────────
function Sets() {
  const add = useAdd();
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  return (
    <section className="gd-sets" aria-labelledby="gd-sets-h">
      <div className="gd-head">
        <p className="gd-en">SELECTIONS</p>
        <h2 id="gd-sets-h">組み合わせて、ひと箱に。</h2>
        <p>よく一緒に選ばれる品を、ひと箱ぶんにまとめました。まとめて入れると、箱詰めのようすがよく分かります。</p>
      </div>
      <div className="gd-sets-grid">
        {SETS.map((set) => {
          const sum = set.lines.reduce((a, l) => a + priceOf(itemOf(l.id), l.v) * l.q, 0);
          const packed = packAll(
            set.lines.flatMap((l) =>
              Array.from({ length: l.q }, (_, n) => {
                const it = itemOf(l.id);
                const [w, d, h] = dimsOf(it, l.v);
                return { key: `${l.id}.${n}`, id: l.id, v: l.v, w, d, h, fragile: it.fragile, soft: !!it.soft };
              }),
            ),
          );
          const shots: Shot[] = layoutSet(set.lines);
          return (
            <article key={set.id} className="gd-set">
              <div className="gd-set-img" ref={(n) => {
                  refs.current[set.id] = n;
                }}>
                <ItemCanvas shots={shots} label={set.title} view={{ pitch: 0.72, fill: 1.08, yaw: 0.25 }} />
              </div>
              <p className="gd-set-kicker">{set.kicker}</p>
              <h3>{set.title}</h3>
              <p className="gd-set-lead">{set.lead}</p>
              <ul className="gd-set-lines">
                {set.lines.map((l) => (
                  <li key={l.id}>
                    {itemOf(l.id).name}
                    {l.q > 1 && <span>×{l.q}</span>}
                  </li>
                ))}
              </ul>
              <div className="gd-set-foot">
                <p>
                  <b>{yen(sum)}</b>
                  <small>
                    税込・{packed.boxes.map((b) => `${b.size.id}サイズ`).join('＋')}の箱
                  </small>
                </p>
                <button type="button" className="gd-btn gd-btn-add" onClick={() => add(set.lines, refs.current[set.id], null, set.gift)}>
                  {set.gift ? <Gift size={16} aria-hidden="true" /> : <ShoppingBag size={16} aria-hidden="true" />}
                  {set.gift ? 'ギフト包装で入れる' : 'まとめて入れる'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** arrange a set on a table (dm) */
function layoutSet(lines: { id: ItemId; v: string; q: number }[]): Shot[] {
  const out: Shot[] = [];
  const flat = lines.flatMap((l) => Array.from({ length: l.q }, () => ({ id: l.id, v: l.v })));
  let x = 0;
  const gaps: number[] = [];
  flat.forEach((f) => {
    const [w] = itemOf(f.id).dims;
    gaps.push(w * 0.1);
  });
  const total = gaps.reduce((a, g) => a + g, 0) + (flat.length - 1) * 0.25;
  flat.forEach((f, i) => {
    const w = gaps[i];
    out.push({ id: f.id, v: f.v, x: -total / 2 + x + w / 2, z: (i % 2 ? 0.35 : -0.25) * (flat.length > 3 ? 1 : 0.5), yaw: (i * 0.7) % 1.2 - 0.3 });
    x += w + 0.25;
  });
  return out;
}

// ── catalogue ───────────────────────────────────────────────────────────────
type SortId = 'pick' | 'new' | 'low' | 'high' | 'review';
const SORTS: { id: SortId; label: string }[] = [
  { id: 'pick', label: 'おすすめ順' },
  { id: 'new', label: '新着順' },
  { id: 'low', label: '価格の安い順' },
  { id: 'high', label: '価格の高い順' },
  { id: 'review', label: 'レビューの多い順' },
];

function Items({ onOpen, cat, setCat }: { onOpen: (id: ItemId, v?: string) => void; cat: CatId | 'all'; setCat: (c: CatId | 'all') => void }) {
  const [sort, setSort] = useState<SortId>('pick');
  const [inStock, setInStock] = useState(false);
  const list = useMemo(() => {
    const l = ITEMS.filter((i) => (cat === 'all' || i.cat === cat) && (!inStock || i.stock > 0));
    const by: Record<SortId, (a: Item, b: Item) => number> = {
      pick: (a, b) => b.pick - a.pick,
      new: (a, b) => b.added.localeCompare(a.added),
      low: (a, b) => a.price - b.price,
      high: (a, b) => b.price - a.price,
      review: (a, b) => b.reviewCount - a.reviewCount,
    };
    return [...l].sort(by[sort]);
  }, [cat, sort, inStock]);
  return (
    <section id="items" className="gd-items" aria-labelledby="gd-items-h">
      <div className="gd-head">
        <p className="gd-en">ITEMS</p>
        <h2 id="gd-items-h">商品一覧</h2>
        <p>七つの工房から届いた、毎日の道具。写真はすべて、品物の形と釉薬から描いた立体です。</p>
      </div>
      <div className="gd-filter">
        <div className="gd-chips" role="group" aria-label="カテゴリ">
          {CATS.map((c) => {
            const n = c.id === 'all' ? ITEMS.length : ITEMS.filter((i) => i.cat === c.id).length;
            return (
              <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                {c.label}
                <small>{n}</small>
              </button>
            );
          })}
        </div>
        <div className="gd-filter-right">
          <label className="gd-check">
            <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
            <span>在庫のある品だけ</span>
          </label>
          <label className="gd-select">
            <span className="gd-sr">並び替え</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortId)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </label>
        </div>
      </div>
      <p className="gd-count" aria-live="polite">
        {list.length}点
      </p>
      <ul className="gd-grid">
        {list.map((it) => (
          <li key={it.id}>
            <Card it={it} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Card({ it, onOpen }: { it: Item; onOpen: (id: ItemId, v?: string) => void }) {
  const [v, setV] = useState(it.variants[0].id);
  const add = useAdd();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const st = stockText(it);
  const s = useCart();
  const inCart = s.lines.filter((l) => l.id === it.id).reduce((a, l) => a + l.q, 0);
  return (
    <article className="gd-card">
      <button type="button" className="gd-card-stage" onClick={() => onOpen(it.id, v)} aria-label={`${it.name}（${variantOf(it, v).label}）の詳細を見る`}>
        <ItemCanvas shots={[{ id: it.id, v }]} label={`${it.name}（${variantOf(it, v).label}）`} spin onRef={(c) => (canvas.current = c)} />
        <span className="gd-badges">
          {it.isNew && <span className="gd-badge new">新入荷</span>}
          {st.k === 'low' && <span className="gd-badge low">{st.t}</span>}
          {st.k === 'out' && <span className="gd-badge out">入荷待ち</span>}
          {it.fragile && <span className="gd-badge frag">割れ物</span>}
        </span>
        {inCart > 0 && (
          <span className="gd-incart">
            <Check size={13} aria-hidden="true" />
            かごに{inCart}点
          </span>
        )}
      </button>
      <div className="gd-card-body">
        <p className="gd-card-maker">{makerOf(it.maker).name}</p>
        <h3>
          <button type="button" onClick={() => onOpen(it.id, v)}>
            {it.name}
          </button>
        </h3>
        {it.variants.length > 1 && (
          <div className="gd-swatches" role="radiogroup" aria-label={it.variantKind === 'color' ? '色' : 'サイズ'}>
            {it.variants.map((x) =>
              it.variantKind === 'color' ? (
                <button key={x.id} type="button" role="radio" aria-checked={v === x.id} aria-label={x.label} title={x.label} onClick={() => setV(x.id)} style={{ '--sw': x.swatch } as React.CSSProperties} />
              ) : (
                <button key={x.id} type="button" role="radio" aria-checked={v === x.id} className="is-size" onClick={() => setV(x.id)}>
                  {x.label.split('（')[0]}
                </button>
              ),
            )}
          </div>
        )}
        <div className="gd-card-meta">
          <p className="gd-price">
            {yen(priceOf(it, v))}
            <small>税込</small>
          </p>
          <p className="gd-rate">
            <Stars value={it.rating} size={12} />
            <span>{it.reviewCount}</span>
          </p>
        </div>
        <p className={`gd-stock is-${st.k}`}>{st.t}</p>
        <button type="button" className="gd-btn gd-btn-add" disabled={it.stock <= 0} onClick={(e) => add([{ id: it.id, v, q: 1 }], canvas.current ?? e.currentTarget, canvas.current)}>
          <ShoppingBag size={16} aria-hidden="true" />
          {it.stock <= 0 ? '入荷待ち' : 'かごに入れる'}
        </button>
      </div>
    </article>
  );
}

// ── product detail ──────────────────────────────────────────────────────────
function Detail({ id, v0, onClose, onOpen, onMaker, onInquiry }: { id: ItemId; v0?: string; onClose: () => void; onOpen: (id: ItemId, v?: string) => void; onMaker: (m: MakerId) => void; onInquiry: (s?: string) => void }) {
  const it = itemOf(id);
  const [v, setV] = useState(v0 ?? it.variants[0].id);
  const [q, setQ] = useState(1);
  const [tab, setTab] = useState<'about' | 'spec' | 'care' | 'review'>('about');
  const add = useAdd();
  const s = useCart();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const st = stockText(it);
  const mk = makerOf(it.maker);
  const [w, d, h] = dimsOf(it, v);
  const alone = packAll([{ key: 'x', id, v, w, d, h, fragile: it.fragile, soft: !!it.soft }]).boxes[0];
  const vol = w * d * h;
  const share = Math.round((vol / (alone.size.inner[0] * alone.size.inner[1] * alone.size.inner[2])) * 100);
  const region = REGIONS.find((r) => r.id === s.region)!;
  useEffect(() => {
    setV(v0 ?? it.variants[0].id);
    setQ(1);
    setTab('about');
    dialog.current?.scrollTo({ top: 0 });
  }, [id, v0, it.variants]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => {
      removeEventListener('keydown', k);
      document.documentElement.style.overflow = prev;
    };
  }, [onClose]);
  const others = ITEMS.filter((x) => x.maker === it.maker && x.id !== it.id);
  return (
    <div className="gd-modal" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gd-detail" role="dialog" aria-modal="true" aria-labelledby="gd-detail-h" ref={dialog} tabIndex={-1}>
        <button type="button" className="gd-close" onClick={onClose} aria-label="閉じる">
          <X size={20} />
        </button>
        <div className="gd-detail-view">
          <ItemCanvas shots={[{ id, v }]} drag label={`${it.name}（${variantOf(it, v).label}）の立体表示。ドラッグまたは矢印キーで回せます。`} onRef={(c) => (canvas.current = c)} view={{ fill: 1 }} />
        </div>
        <div className="gd-detail-info">
          <p className="gd-crumb">
            商品一覧 / {CATS.find((c) => c.id === it.cat)?.label}
          </p>
          <button type="button" className="gd-detail-maker" onClick={() => onMaker(it.maker)}>
            <Seal ch={mk.seal} />
            {mk.name}　{mk.person}
          </button>
          <h2 id="gd-detail-h">{it.name}</h2>
          <p className="gd-detail-rate">
            <Stars value={it.rating} />
            <b>{it.rating.toFixed(1)}</b>
            <button type="button" onClick={() => setTab('review')}>
              レビュー {it.reviewCount}件
            </button>
          </p>
          <p className="gd-detail-price">
            {yen(priceOf(it, v))}
            <small>（税込）</small>
          </p>
          <p className="gd-detail-lead">{it.lead}</p>
          {it.variants.length > 1 && (
            <fieldset className="gd-opt">
              <legend>
                {it.variantKind === 'color' ? '色' : 'サイズ'}：<b>{variantOf(it, v).label}</b>
              </legend>
              <div className={it.variantKind === 'color' ? 'gd-swatches is-large' : 'gd-sizes'}>
                {it.variants.map((x) =>
                  it.variantKind === 'color' ? (
                    <button key={x.id} type="button" aria-pressed={v === x.id} aria-label={x.label} title={x.label} onClick={() => setV(x.id)} style={{ '--sw': x.swatch } as React.CSSProperties} />
                  ) : (
                    <button key={x.id} type="button" aria-pressed={v === x.id} onClick={() => setV(x.id)}>
                      {x.label}
                      <small>{yen(x.price ?? it.price)}</small>
                    </button>
                  ),
                )}
              </div>
            </fieldset>
          )}
          <div className="gd-buy">
            <Qty value={q} onChange={(n) => setQ(Math.max(1, Math.min(9, n)))} max={Math.max(1, Math.min(9, it.stock))} label={it.name} />
            {it.stock > 0 ? (
              <button type="button" className="gd-btn gd-btn-add gd-btn-big" onClick={(e) => add([{ id, v, q }], canvas.current ?? e.currentTarget, canvas.current)}>
                <ShoppingBag size={18} aria-hidden="true" />
                かごに入れる
              </button>
            ) : (
              <button type="button" className="gd-btn gd-btn-ghost gd-btn-big" onClick={() => onInquiry(`再入荷のお知らせ希望：${it.name}（${variantOf(it, v).label}）／入荷予定 ${it.restock}`)}>
                再入荷のお知らせを受け取る
              </button>
            )}
          </div>
          <div className="gd-buy-box">
            <BoxSlot kind="detail" />
            <div>
              <p className={`gd-stock is-${st.k}`}>{st.t}</p>
              <p>
                <Truck size={15} aria-hidden="true" />
                <span>
                  最短 <b>{mdw(earliestDelivery(s.region))}</b> お届け（{region.label}）
                </span>
              </p>
              <p>
                <Package size={15} aria-hidden="true" />
                <span>
                  この品だけなら <b>{alone.size.id}サイズ</b> の箱（容積の約{Math.max(1, share)}%）{it.fragile ? '。紙のクッションで包みます。' : '。'}
                </span>
              </p>
              <p className="gd-buy-cart">
                いまのかご：{totals(s).count}点・{boxLabel(s)}
              </p>
            </div>
          </div>
          <div className="gd-tabs" role="tablist" aria-label="商品の情報">
            {(
              [
                ['about', '商品について'],
                ['spec', 'サイズ・仕様'],
                ['care', 'お手入れ'],
                ['review', `レビュー（${it.reviewCount}）`],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>
          <div className="gd-tabpanel" role="tabpanel">
            {tab === 'about' && <p>{it.body}</p>}
            {tab === 'spec' && (
              <dl className="gd-spec">
                {it.spec.map(([k, val]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{val}</dd>
                  </div>
                ))}
                <div>
                  <dt>つくり手</dt>
                  <dd>
                    {mk.name}（{mk.place}）
                  </dd>
                </div>
                <div>
                  <dt>梱包サイズ</dt>
                  <dd>
                    {w}×{d}×{h}cm{it.fragile ? '（緩衝材を含まず）' : ''}
                  </dd>
                </div>
              </dl>
            )}
            {tab === 'care' && (
              <ul className="gd-care">
                {it.care.map((c) => (
                  <li key={c}>{c}</li>
                ))}
                <li>手仕事のため、色や形、大きさが一点ずつ少しずつ異なります。</li>
              </ul>
            )}
            {tab === 'review' && (
              <div className="gd-reviews">
                <div className="gd-review-sum">
                  <p>
                    <b>{it.rating.toFixed(1)}</b>
                    <Stars value={it.rating} />
                    <span>{it.reviewCount}件のレビュー</span>
                  </p>
                  <ol>
                    {it.dist.map((n, i) => (
                      <li key={i}>
                        <span>{5 - i}</span>
                        <span className="gd-bar">
                          <span style={{ width: `${(n / it.reviewCount) * 100}%` }} />
                        </span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                {it.reviews.map((r) => (
                  <article key={r.name + r.date}>
                    <p className="gd-review-head">
                      <Stars value={r.stars} size={13} />
                      <b>{r.title}</b>
                    </p>
                    <p>{r.body}</p>
                    <p className="gd-review-by">
                      {r.name}・{r.date}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="gd-link" onClick={() => onInquiry(`商品について：${it.name}（${variantOf(it, v).label}）`)}>
            この品について問い合わせる
            <ArrowRight size={15} aria-hidden="true" />
          </button>
          {others.length > 0 && (
            <div className="gd-more">
              <p>{mk.name}の、ほかの道具</p>
              <ul>
                {others.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => onOpen(o.id)}>
                      <ItemCanvas shots={[{ id: o.id, v: o.variants[0].id }]} label={o.name} />
                      <span>{o.name}</span>
                      <small>{yen(o.price)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── makers ──────────────────────────────────────────────────────────────────
function Makers({ onOpen, focus }: { onOpen: (id: ItemId, v?: string) => void; focus: MakerId | null }) {
  const [lead, ...rest] = MAKERS;
  const card = (m: (typeof MAKERS)[number], big = false) => {
    const items = ITEMS.filter((i) => i.maker === m.id);
    return (
      <article key={m.id} id={`maker-${m.id}`} className={`gd-maker ${big ? 'is-lead' : ''} ${focus === m.id ? 'is-focus' : ''}`} style={{ '--mh': m.hue } as React.CSSProperties}>
        <div className="gd-maker-head">
          <Seal ch={m.seal} className="is-big" />
          <div>
            <p className="gd-maker-place">
              {m.place}・{m.since}
            </p>
            <h3>{m.name}</h3>
            <p className="gd-maker-person">{m.person}　／　{m.craft}</p>
          </div>
        </div>
        {big && (
          <div className="gd-maker-art">
            <ItemCanvas shots={layoutSet(items.map((i) => ({ id: i.id, v: i.variants[0].id, q: 1 })))} label={`${m.name}の品`} view={{ pitch: 0.55, fill: 0.92, yaw: 0.2 }} />
          </div>
        )}
        <p className="gd-maker-lead">{m.lead}</p>
        {big && <p className="gd-maker-body">{m.body}</p>}
        <blockquote>「{m.quote}」</blockquote>
        <ul className="gd-maker-items">
          {items.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => onOpen(i.id)}>
                {i.name}
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </article>
    );
  };
  return (
    <section id="makers" className="gd-makers" aria-labelledby="gd-makers-h">
      <div className="gd-head">
        <p className="gd-en">MAKERS</p>
        <h2 id="gd-makers-h">つくり手</h2>
        <p>店主が工房を訪ね、仕事を見せてもらってから扱いを決めています。いまお付き合いのある、七つの工房です。</p>
      </div>
      <div className="gd-makers-lead">
        <p className="gd-tag">今月のつくり手</p>
        {card(lead, true)}
      </div>
      <div className="gd-makers-grid">{rest.map((m) => card(m))}</div>
    </section>
  );
}

// ── shipping ────────────────────────────────────────────────────────────────
function Shipping() {
  const s = useCart();
  const t = totals(s);
  const current = t.count ? t.boxes[0]?.size : null;
  const region = REGIONS.find((r) => r.id === s.region)!;
  // dates depend on the viewer's clock: render them after hydration only
  const mounted = useMounted();
  const eta = earliestDelivery(s.region);
  const ship = shipDate();
  const d = (x: Date) => (mounted ? mdw(x) : '—');
  return (
    <section id="shipping" className="gd-ship" aria-labelledby="gd-ship-h">
      <div className="gd-head">
        <p className="gd-en">SHIPPING</p>
        <h2 id="gd-ship-h">お届けについて</h2>
        <p>品物の大きさに合わせて箱を選び、隙間を紙のクッションで埋めてお送りします。送料は、箱の大きさとお届け先の地域で決まります。</p>
      </div>

      <div className="gd-sizes-row" aria-label="箱の大きさ">
        {BOXES.map((b) => {
          const k = b.inner[0] / 56;
          return (
            <figure key={b.id} className={current === b.id ? 'is-current' : ''}>
              <svg viewBox="-60 -60 120 100" aria-hidden="true" style={{ '--k': k } as React.CSSProperties}>
                <IsoBox w={b.inner[0]} d={b.inner[1]} h={b.inner[2]} />
              </svg>
              <figcaption>
                <b>{b.id}サイズ</b>
                <span>
                  {b.inner[0]}×{b.inner[1]}×{b.inner[2]}cm
                </span>
                <span>{yen(boxFee(b.id, s.region))}〜</span>
                {current === b.id && <em>いまのかご</em>}
              </figcaption>
            </figure>
          );
        })}
      </div>

      <div className="gd-ship-grid">
        <div className="gd-ship-table">
          <div className="gd-ship-table-head">
            <h3>送料表（税込・1箱あたり）</h3>
            <label className="gd-select">
              <span>お届け先</span>
              <select value={s.region} onChange={(e) => cart.setRegion(e.target.value as RegionId)}>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </label>
          </div>
          <div className="gd-table-wrap" tabIndex={0} role="region" aria-label="地域別の送料表（横にスクロールできます）">
            <table>
              <thead>
                <tr>
                  <th scope="col">地域</th>
                  {BOXES.map((b) => (
                    <th key={b.id} scope="col" className={current === b.id ? 'is-col' : ''}>
                      {b.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {REGIONS.map((r) => (
                  <tr key={r.id} className={r.id === s.region ? 'is-row' : ''}>
                    <th scope="row">
                      {r.label}
                      <small>{r.prefs.split('・').length > 3 ? `${r.prefs.split('・').slice(0, 3).join('・')}ほか` : r.prefs}</small>
                    </th>
                    {BOXES.map((b) => (
                      <td key={b.id} className={current === b.id ? 'is-col' : ''}>
                        {yen(boxFee(b.id, r.id))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="gd-notes">
            <li>
              税込 {yen(FREE_SHIPPING)} 以上のご注文は送料無料です（沖縄は一律 {yen(OKINAWA_FLAT)}）。
            </li>
            <li>一度に箱へ入りきらないときは、二箱に分けてお送りします（送料は箱ごと）。</li>
            <li>ギフト包装は一箱 {yen(GIFT_FEE)}。代金引換の手数料は {yen(COD_FEE)} です。</li>
          </ul>
        </div>

        <div className="gd-ship-cards">
          <article>
            <h3>
              <Truck size={18} aria-hidden="true" />
              お届け日と時間
            </h3>
            <p>
              平日14時までのご注文は当日に、それ以降は翌営業日に発送します。いまご注文いただくと、<b>{d(ship)}</b>に発送、
              <b>{region.label}</b>へは<b>最短 {d(eta)}</b>のお届けです。
            </p>
            <p>お届け日は、最短日から14日後まで指定できます。時間帯は次からお選びください。</p>
            <ul className="gd-slots">
              {TIME_SLOTS.slice(1).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </article>
          <article>
            <h3>
              <Package size={18} aria-hidden="true" />
              梱包について
            </h3>
            <p>器やガラスは一点ずつ薄紙で包み、まわりを丸めた紙のクッションで埋めます。緩衝材は、古紙を再生した紙だけを使っています。</p>
            <p>箱の中の品物がどのように詰まるかは、かごの箱でそのままご覧いただけます。</p>
          </article>
          <article>
            <h3>
              <CreditCard size={18} aria-hidden="true" />
              お支払い
            </h3>
            <p>クレジットカード、代金引換（手数料 {yen(COD_FEE)}）、コンビニ後払い、銀行振込（前払い）がご利用いただけます。</p>
          </article>
          <article>
            <h3>
              <RotateCcw size={18} aria-hidden="true" />
              返品・交換
            </h3>
            <p>届いた品に割れや欠けがあったときは、到着から7日以内にご連絡ください。送料はこちらの負担で交換します。</p>
            <p>お客さまのご都合による返品は、未使用のものに限り、到着から7日以内に承ります（送料はご負担ください）。手仕事による色や形の個体差は、返品の対象外です。</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function IsoBox({ w, d, h }: { w: number; d: number; h: number }) {
  const k = 1.6;
  const c = Math.cos(Math.PI / 6);
  const sN = 0.5;
  const P = (x: number, y: number, z: number) => `${((x - z) * c * k).toFixed(1)},${((x + z) * sN * k - y * k).toFixed(1)}`;
  const X = w / 2;
  const Z = d / 2;
  const top = [P(-X, h, -Z), P(X, h, -Z), P(X, h, Z), P(-X, h, Z)].join(' ');
  const left = [P(-X, 0, Z), P(X, 0, Z), P(X, h, Z), P(-X, h, Z)].join(' ');
  const right = [P(X, 0, -Z), P(X, 0, Z), P(X, h, Z), P(X, h, -Z)].join(' ');
  return (
    <g transform={`translate(0 ${(-h * k) / 2 + 12}) scale(${0.62})`}>
      <polygon points={left} className="f-l" />
      <polygon points={right} className="f-r" />
      <polygon points={top} className="f-t" />
      <line x1={P(-X, h, 0).split(',')[0]} y1={P(-X, h, 0).split(',')[1]} x2={P(X, h, 0).split(',')[0]} y2={P(X, h, 0).split(',')[1]} className="seam" />
    </g>
  );
}

// ── dock + drawer ───────────────────────────────────────────────────────────
function Dock({ onOpen }: { onOpen: () => void }) {
  const s = useCart();
  const t = totals(s);
  const { active, peek } = useBox();
  const shown = active === 'dock';
  return (
    <div className={`gd-dock ${shown ? 'is-shown' : ''} ${peek && shown ? 'is-peek' : ''} ${t.count ? '' : 'is-empty'}`} aria-hidden={!shown}>
      <button type="button" onClick={onOpen} tabIndex={shown ? 0 : -1} aria-label={`かごを開く（${t.count}点、${yen(t.subtotal)}）`}>
        <span className="gd-dock-stage">
          <span className="gd-dock-inner">
            <BoxSlot kind="dock" />
          </span>
        </span>
        <span className="gd-dock-text">
          <span className="gd-dock-top">
            <ShoppingBag size={15} aria-hidden="true" />
            かご <b>{t.count}</b>点
          </span>
          <span className="gd-dock-sum">{yen(t.subtotal)}</span>
          <span className="gd-dock-ship">{t.count ? `${boxLabel(s)}・${t.free ? '送料無料' : `あと${yen(t.toFree)}で無料`}` : '箱は空です'}</span>
        </span>
      </button>
      <p className="gd-dock-toast" aria-live="polite">
        {peek && s.lastAdded ? `${s.lastAdded}を箱に入れました` : ''}
      </p>
    </div>
  );
}

function Drawer({ onClose, onCheckout, onOpenItem }: { onClose: () => void; onCheckout: () => void; onOpenItem: (id: ItemId, v?: string) => void }) {
  const s = useCart();
  const t = totals(s);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      removeEventListener('keydown', k);
      document.documentElement.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="gd-modal gd-drawer-wrap" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="gd-drawer" role="dialog" aria-modal="true" aria-labelledby="gd-drawer-h" ref={panel} tabIndex={-1}>
        <header>
          <h2 id="gd-drawer-h">
            かごの中身<small>{t.count}点</small>
          </h2>
          <button type="button" className="gd-close" onClick={onClose} aria-label="閉じる">
            <X size={20} />
          </button>
        </header>
        <div className="gd-drawer-box">
          <BoxSlot kind="drawer" />
          <p className="gd-drawer-size">
            <b>{boxLabel(s)}</b>
            {s.packing.boxes.length > 1 && <span>二箱に分けてお届け</span>}
            {t.count > 0 && <span>容積の {Math.round(s.packing.boxes[0].fill * 100)}%</span>}
          </p>
        </div>
        <div className="gd-drawer-body">
          {!t.count ? (
            <div className="gd-empty">
              <p>かごは空です。</p>
              <button
                type="button"
                className="gd-btn gd-btn-ghost"
                onClick={() => {
                  onClose();
                  setTimeout(() => document.getElementById('items')?.scrollIntoView({ behavior: 'smooth' }), 60);
                }}
              >
                商品一覧を見る
              </button>
            </div>
          ) : (
            <>
              <ul className="gd-lines">
                {s.lines.map((l) => {
                  const it = itemOf(l.id);
                  return (
                    <li key={lineKey(l)}>
                      <button type="button" className="gd-line-img" onClick={() => onOpenItem(l.id, l.v)} aria-label={`${it.name}の詳細`}>
                        <ItemCanvas shots={[{ id: l.id, v: l.v }]} label={it.name} />
                      </button>
                      <div>
                        <p className="gd-line-name">{it.name}</p>
                        <p className="gd-line-v">
                          {variantOf(it, l.v).label}
                          {it.fragile && '・割れ物'}
                        </p>
                        <p className="gd-line-price">{yen(priceOf(it, l.v) * l.q)}</p>
                      </div>
                      <div className="gd-line-ctl">
                        <Qty value={l.q} onChange={(n) => cart.setQty(l.id, l.v, n)} max={Math.min(9, Math.max(1, it.stock))} label={it.name} />
                        <button type="button" className="gd-line-rm" onClick={() => cart.remove(l.id, l.v)}>
                          削除
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <label className="gd-gift">
                <input type="checkbox" checked={s.gift} onChange={(e) => cart.setGift(e.target.checked)} />
                <span>
                  <b>
                    <Gift size={16} aria-hidden="true" />
                    ギフト包装にする（一箱 {yen(GIFT_FEE)}）
                  </b>
                  <small>箱のふたを閉じ、包装紙とリボンをかけてお届けします。</small>
                </span>
              </label>
              <FreeMeter s={s} />
              <dl className="gd-sum">
                <div>
                  <dt>小計</dt>
                  <dd>{yen(t.subtotal)}</dd>
                </div>
                <div>
                  <dt>
                    送料
                    <label className="gd-select is-inline">
                      <span className="gd-sr">お届け先の地域</span>
                      <select value={s.region} onChange={(e) => cart.setRegion(e.target.value as RegionId)}>
                        {REGIONS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} aria-hidden="true" />
                    </label>
                  </dt>
                  <dd>
                    {t.free && t.shipping === 0 ? (
                      <>
                        <s>{yen(t.shippingBase)}</s> 無料
                      </>
                    ) : (
                      yen(t.shipping)
                    )}
                  </dd>
                </div>
                {t.gift > 0 && (
                  <div>
                    <dt>ギフト包装</dt>
                    <dd>{yen(t.gift)}</dd>
                  </div>
                )}
                <div className="is-total">
                  <dt>合計（税込）</dt>
                  <dd>{yen(t.subtotal + t.shipping + t.gift)}</dd>
                </div>
              </dl>
            </>
          )}
        </div>
        <footer>
          <button type="button" className="gd-btn gd-btn-ghost" onClick={onClose}>
            買い物を続ける
          </button>
          <button type="button" className="gd-btn gd-btn-main" disabled={!t.count} onClick={onCheckout}>
            ご購入手続きへ
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </footer>
      </aside>
    </div>
  );
}

// ── checkout ────────────────────────────────────────────────────────────────
type Addr = { name: string; kana: string; zip: string; pref: string; city: string; line: string; tel: string; email: string; date: string; slot: string };
type Pay = { method: 'card' | 'cod' | 'later' | 'bank'; card: string; exp: string; cvc: string; holder: string };
const PAY_LABEL: Record<Pay['method'], string> = { card: 'クレジットカード', cod: '代金引換', later: 'コンビニ後払い', bank: '銀行振込（前払い）' };
const STEPS = ['かご', 'お届け先', 'お支払い', 'ご注文の確認', '完了'];

function Checkout({ onClose, onInquiry }: { onClose: () => void; onInquiry: (s?: string) => void }) {
  const s = useCart();
  const t = totals(s);
  const box = useBox();
  const [step, setStep] = useState(1);
  const [addr, setAddr] = useState<Addr>({ name: '', kana: '', zip: '', pref: '', city: '', line: '', tel: '', email: '', date: '', slot: '指定なし' });
  const [pay, setPay] = useState<Pay>({ method: 'card', card: '', exp: '', cvc: '', holder: '' });
  const [order, setOrder] = useState<{ no: string; lines: Line[]; total: number; summary: string } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const eta = earliestDelivery(s.region);
  const dates = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(eta);
    d.setDate(d.getDate() + i);
    return mdw(d);
  }), [eta]);
  const fee = pay.method === 'cod' ? COD_FEE : 0;
  const total = t.subtotal + t.shipping + t.gift + fee;
  const dateLabel = addr.date || `指定なし（最短 ${mdw(eta)}）`;

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', k);
      document.documentElement.style.overflow = prev;
    };
  }, [onClose]);
  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
    panel.current?.querySelector<HTMLElement>('h2')?.focus();
  }, [step]);
  // close the box on confirmation; label it when the order is placed
  useEffect(() => {
    const ctl = box.ctl.current;
    if (!ctl) return;
    if (step >= 3) ctl.setSeal({ sealed: true, label: step === 4 ? { name: addr.name || 'お客', date: addr.date || mdw(eta), slot: addr.slot } : null });
    else ctl.setSeal({ sealed: false });
  }, [step, box.ctl, box.ready, addr.name, addr.date, addr.slot, eta]);
  useEffect(() => () => box.ctl.current?.setSeal({ sealed: false }), [box.ctl]);

  const set = <K extends keyof Addr>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setAddr((a) => ({ ...a, [k]: val }));
    if (k === 'pref') {
      const p = PREFS.find((x) => x.name === val);
      if (p) cart.setRegion(p.region);
    }
  };
  const fmtCard = (v: string) =>
    v
      .replace(/\D/g, '')
      .slice(0, 16)
      .replace(/(\d{4})(?=\d)/g, '$1 ');

  const place = () => {
    const no = `MG-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const items = s.lines.map((l) => `${itemOf(l.id).name}（${variantOf(itemOf(l.id), l.v).label}）×${l.q}`).join('、');
    const summary = `ご注文 ${no}：${items}／箱 ${boxLabel(s)}${s.gift ? '・ギフト包装' : ''}／合計 ${yen(total)}（税込）／お届け ${dateLabel}・${addr.slot}／お支払い ${PAY_LABEL[pay.method]}`;
    setOrder({ no, lines: s.lines, total, summary });
    setStep(4);
  };

  return (
    <div className="gd-modal gd-co-wrap" role="presentation">
      <div className="gd-co" role="dialog" aria-modal="true" aria-labelledby="gd-co-h">
        <header className="gd-co-head">
          <p className="gd-co-brand">MIRAI GOODS　ご購入手続き</p>
          <ol className="gd-steps" aria-label="手続きの段階">
            {STEPS.map((l, i) => (
              <li key={l} className={i === step ? 'is-now' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
                <span>{i < step ? <Check size={13} aria-hidden="true" /> : i + 1}</span>
                {l}
              </li>
            ))}
          </ol>
          <button type="button" className="gd-close" onClick={onClose} aria-label="手続きを閉じる">
            <X size={20} />
          </button>
        </header>
        <div className="gd-co-body">
          <aside className="gd-co-side">
            <div className="gd-co-box">
              <BoxSlot kind="checkout" />
              <p className="gd-co-state" aria-live="polite">
                {step === 4 ? '伝票を貼りました。発送の準備に入ります。' : step === 3 ? (s.gift ? 'ふたを閉じて、包装紙とリボンをかけました。' : 'ふたを閉じて、テープで封をしました。') : `${boxLabel(s)}・${t.count}点`}
              </p>
            </div>
            <dl className="gd-sum is-small">
              <div>
                <dt>小計</dt>
                <dd>{yen(t.subtotal)}</dd>
              </div>
              <div>
                <dt>送料（{boxLabel(s)}・{REGIONS.find((r) => r.id === s.region)!.label}）</dt>
                <dd>{t.shipping ? yen(t.shipping) : '無料'}</dd>
              </div>
              {t.gift > 0 && (
                <div>
                  <dt>ギフト包装</dt>
                  <dd>{yen(t.gift)}</dd>
                </div>
              )}
              {fee > 0 && (
                <div>
                  <dt>代引手数料</dt>
                  <dd>{yen(fee)}</dd>
                </div>
              )}
              <div className="is-total">
                <dt>合計（税込）</dt>
                <dd>{yen(order?.total ?? total)}</dd>
              </div>
            </dl>
          </aside>
          <div className="gd-co-main" ref={panel}>
            {step === 1 && (
              <form
                className="gd-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(2);
                }}
              >
                <h2 id="gd-co-h" tabIndex={-1}>
                  お届け先
                </h2>
                <div className="gd-row2">
                  <label>
                    お名前<em>必須</em>
                    <input required autoComplete="name" value={addr.name} onChange={set('name')} placeholder="未来 花子" />
                  </label>
                  <label>
                    ふりがな
                    <input autoComplete="off" value={addr.kana} onChange={set('kana')} placeholder="みらい はなこ" />
                  </label>
                </div>
                <div className="gd-row2">
                  <label>
                    郵便番号<em>必須</em>
                    <input required inputMode="numeric" autoComplete="postal-code" pattern="\d{3}-?\d{4}" value={addr.zip} onChange={set('zip')} placeholder="123-4567" />
                  </label>
                  <label>
                    都道府県<em>必須</em>
                    <span className="gd-select is-field">
                      <select required value={addr.pref} onChange={set('pref')}>
                        <option value="" disabled>
                          選択してください
                        </option>
                        {PREFS.map((p) => (
                          <option key={p.name}>{p.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} aria-hidden="true" />
                    </span>
                  </label>
                </div>
                <label>
                  市区町村<em>必須</em>
                  <input required autoComplete="address-level2" value={addr.city} onChange={set('city')} placeholder="みらい市 中央" />
                </label>
                <label>
                  番地・建物名<em>必須</em>
                  <input required autoComplete="address-line1" value={addr.line} onChange={set('line')} placeholder="1-2-3 みらいハイツ 101" />
                </label>
                <div className="gd-row2">
                  <label>
                    電話番号<em>必須</em>
                    <input required type="tel" inputMode="tel" autoComplete="tel" pattern="[\d\-]{10,13}" value={addr.tel} onChange={set('tel')} placeholder="090-0000-0000" />
                  </label>
                  <label>
                    メールアドレス<em>必須</em>
                    <input required type="email" autoComplete="email" value={addr.email} onChange={set('email')} placeholder="name@example.com" />
                  </label>
                </div>
                <fieldset className="gd-when">
                  <legend>お届け日時</legend>
                  <div className="gd-row2">
                    <label>
                      お届け日
                      <span className="gd-select is-field">
                        <select value={addr.date} onChange={set('date')}>
                          <option value="">指定なし（最短 {mdw(eta)}）</option>
                          {dates.map((d) => (
                            <option key={d}>{d}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} aria-hidden="true" />
                      </span>
                    </label>
                    <label>
                      時間帯
                      <span className="gd-select is-field">
                        <select value={addr.slot} onChange={set('slot')}>
                          {TIME_SLOTS.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} aria-hidden="true" />
                      </span>
                    </label>
                  </div>
                  <p className="gd-help">都道府県を選ぶと、その地域の送料と最短のお届け日に切り替わります。</p>
                </fieldset>
                <div className="gd-form-foot">
                  <button type="button" className="gd-btn gd-btn-ghost" onClick={onClose}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    かごに戻る
                  </button>
                  <button type="submit" className="gd-btn gd-btn-main">
                    お支払いへ
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
                <p className="gd-help">デモです。入力した内容は保存・送信されません。架空の情報でお試しください。</p>
              </form>
            )}
            {step === 2 && (
              <form
                className="gd-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(3);
                }}
              >
                <h2 id="gd-co-h" tabIndex={-1}>
                  お支払い方法
                </h2>
                <div className="gd-pay" role="radiogroup" aria-label="お支払い方法">
                  {(Object.keys(PAY_LABEL) as Pay['method'][]).map((m) => (
                    <label key={m} className={pay.method === m ? 'is-on' : ''}>
                      <input type="radio" name="pay" checked={pay.method === m} onChange={() => setPay((p) => ({ ...p, method: m }))} />
                      <span>
                        <b>{PAY_LABEL[m]}</b>
                        <small>
                          {m === 'card' ? '一括払いのみ' : m === 'cod' ? `手数料 ${yen(COD_FEE)}・お届け時に現金で` : m === 'later' ? '届いてから14日以内に、コンビニで' : 'ご入金を確認してから発送します'}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                {pay.method === 'card' && (
                  <div className="gd-card-form">
                    <label>
                      カード番号<em>必須</em>
                      <input required inputMode="numeric" autoComplete="off" value={pay.card} onChange={(e) => setPay((p) => ({ ...p, card: fmtCard(e.target.value) }))} placeholder="0000 0000 0000 0000" pattern="(\d{4} ){3}\d{4}" />
                    </label>
                    <div className="gd-row3">
                      <label>
                        有効期限<em>必須</em>
                        <input
                          required
                          inputMode="numeric"
                          autoComplete="off"
                          value={pay.exp}
                          onChange={(e) => {
                            const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setPay((p) => ({ ...p, exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }));
                          }}
                          placeholder="MM/YY"
                          pattern="(0[1-9]|1[0-2])/\d{2}"
                        />
                      </label>
                      <label>
                        セキュリティコード<em>必須</em>
                        <input required inputMode="numeric" autoComplete="off" value={pay.cvc} onChange={(e) => setPay((p) => ({ ...p, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="123" pattern="\d{3,4}" />
                      </label>
                      <label>
                        名義（ローマ字）<em>必須</em>
                        <input required autoComplete="off" value={pay.holder} onChange={(e) => setPay((p) => ({ ...p, holder: e.target.value.toUpperCase() }))} placeholder="HANAKO MIRAI" />
                      </label>
                    </div>
                    <p className="gd-help">実在のカード番号は入力しないでください（デモのため、番号は画面の外へ送られません）。</p>
                  </div>
                )}
                <div className="gd-form-foot">
                  <button type="button" className="gd-btn gd-btn-ghost" onClick={() => setStep(1)}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    お届け先に戻る
                  </button>
                  <button type="submit" className="gd-btn gd-btn-main">
                    ご注文内容の確認へ
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </form>
            )}
            {step === 3 && (
              <div className="gd-form">
                <h2 id="gd-co-h" tabIndex={-1}>
                  ご注文内容の確認
                </h2>
                <ul className="gd-review-lines">
                  {s.lines.map((l) => {
                    const it = itemOf(l.id);
                    return (
                      <li key={lineKey(l)}>
                        <span>
                          {it.name}
                          <small>{variantOf(it, l.v).label}</small>
                        </span>
                        <span>×{l.q}</span>
                        <span>{yen(priceOf(it, l.v) * l.q)}</span>
                      </li>
                    );
                  })}
                </ul>
                <dl className="gd-confirm">
                  <div>
                    <dt>お届け先</dt>
                    <dd>
                      〒{addr.zip} {addr.pref}
                      {addr.city} {addr.line}
                      <br />
                      {addr.name} 様（{addr.tel}）
                    </dd>
                  </div>
                  <div>
                    <dt>お届け日時</dt>
                    <dd>
                      {dateLabel}・{addr.slot}
                    </dd>
                  </div>
                  <div>
                    <dt>箱</dt>
                    <dd>
                      {boxLabel(s)}
                      {s.gift ? '・ギフト包装' : ''}
                      {s.packing.boxes.some((b) => b.placements.some((p) => p.cushion)) ? '・割れ物（紙のクッション入り）' : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>お支払い</dt>
                    <dd>
                      {PAY_LABEL[pay.method]}
                      {pay.method === 'card' && pay.card ? `（末尾 ${pay.card.replace(/\D/g, '').slice(-4)}）` : ''}
                    </dd>
                  </div>
                </dl>
                <div className="gd-form-foot">
                  <button type="button" className="gd-btn gd-btn-ghost" onClick={() => setStep(2)}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    お支払いに戻る
                  </button>
                  <button type="button" className="gd-btn gd-btn-main" onClick={place}>
                    注文を確定する（デモ）
                    <Check size={16} aria-hidden="true" />
                  </button>
                </div>
                <p className="gd-help">これは制作サンプルです。注文・決済・送信は行われません。</p>
              </div>
            )}
            {step === 4 && order && (
              <div className="gd-form gd-done">
                <p className="gd-done-mark">
                  <Check size={28} aria-hidden="true" />
                </p>
                <h2 id="gd-co-h" tabIndex={-1}>
                  ご注文ありがとうございました。
                </h2>
                <p>
                  注文番号 <b>{order.no}</b>
                </p>
                <p>
                  {addr.name} 様の箱は、{mdw(shipDate())}に発送し、{dateLabel}にお届けする予定です（デモのため、実際には発送されません）。
                </p>
                <div className="gd-form-foot">
                  <button type="button" className="gd-btn gd-btn-ghost" onClick={() => onInquiry(order.summary)}>
                    この注文について問い合わせる
                  </button>
                  <button
                    type="button"
                    className="gd-btn gd-btn-main"
                    onClick={() => {
                      cart.clear();
                      onClose();
                    }}
                  >
                    新しい箱で買い物を続ける
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── page ────────────────────────────────────────────────────────────────────
export default function GoodsSite({ onInquiry }: { onInquiry: (summary?: string) => void }) {
  const [detail, setDetail] = useState<{ id: ItemId; v?: string } | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [cat, setCat] = useState<CatId | 'all'>('all');
  const [focusMaker, setFocusMaker] = useState<MakerId | null>(null);
  const mounted = useMounted();
  const openItem = useCallback((id: ItemId, v?: string) => {
    setDrawer(false);
    setDetail({ id, v });
  }, []);
  const closeDetail = useCallback(() => setDetail(null), []);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const closeCheckout = useCallback(() => setCheckout(false), []);
  const inquiry = useCallback(
    (s?: string) => {
      setDetail(null);
      setCheckout(false);
      setDrawer(false);
      onInquiry(s);
    },
    [onInquiry],
  );
  const toMaker = (m: MakerId) => {
    setDetail(null);
    setFocusMaker(m);
    setTimeout(() => document.getElementById(`maker-${m}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  };
  return (
    <StudioProvider>
      <BoxStageProvider open={{ checkout, drawer, detail: !!detail }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap" precedence="default" />
        <div className="gd-root">
          <Hero onOpen={openItem} />
          <Sets />
          <Items onOpen={openItem} cat={cat} setCat={setCat} />
          <Makers onOpen={openItem} focus={focusMaker} />
          <Shipping />
          <p className="gd-fine">掲載している店名・つくり手・商品・価格・レビューは、すべて架空の制作サンプルです。商品の画像は写真ではなく、three.js で描いた立体です。</p>
        </div>
        {mounted && <Dock onOpen={() => setDrawer(true)} />}
        {detail && <Detail id={detail.id} v0={detail.v} onClose={closeDetail} onOpen={openItem} onMaker={toMaker} onInquiry={inquiry} />}
        {drawer && (
          <Drawer
            onClose={closeDrawer}
            onOpenItem={openItem}
            onCheckout={() => {
              setDrawer(false);
              setCheckout(true);
            }}
          />
        )}
        {checkout && <Checkout onClose={closeCheckout} onInquiry={inquiry} />}
      </BoxStageProvider>
    </StudioProvider>
  );
}
