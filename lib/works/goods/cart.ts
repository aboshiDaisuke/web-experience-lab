// Cart store (useSyncExternalStore). Packing runs here so shipping, UI and the 3D box agree.
import {
  FREE_SHIPPING,
  GIFT_FEE,
  OKINAWA_FLAT,
  boxFee,
  dimsOf,
  itemOf,
  priceOf,
  type ItemId,
  type RegionId,
} from './data';
import { packAll, packIncremental, type PackUnit, type Packing } from './pack';

export type Line = { id: ItemId; v: string; q: number };

export type CartState = {
  lines: Line[];
  gift: boolean;
  region: RegionId;
  units: PackUnit[];
  packing: Packing;
  /** key → performance.now() at which the 3D drop should start */
  arrivals: Record<string, number>;
  /** bumps whenever something was added (for the dock "peek") */
  addSeq: number;
  lastAdded: string;
  repacked: boolean;
};

export const lineKey = (l: { id: ItemId; v: string }) => `${l.id}.${l.v}`;

function unitsOf(lines: Line[]): PackUnit[] {
  const out: PackUnit[] = [];
  for (const l of lines) {
    const it = itemOf(l.id);
    const [w, d, h] = dimsOf(it, l.v);
    for (let n = 0; n < l.q; n++)
      out.push({ key: `${lineKey(l)}.${n}`, id: l.id, v: l.v, w, d, h, fragile: it.fragile, soft: !!it.soft });
  }
  return out;
}

let state: CartState = {
  lines: [],
  gift: false,
  region: 'kanto',
  units: [],
  packing: packAll([]),
  arrivals: {},
  addSeq: 0,
  lastAdded: '',
  repacked: false,
};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const cart = {
  subscribe(f: () => void) {
    subs.add(f);
    return () => subs.delete(f);
  },
  get: () => state,
  set(lines: Line[], extra: Partial<CartState> = {}, delayMs = 0) {
    const clean = lines.filter((l) => l.q > 0);
    const units = unitsOf(clean);
    const { packing, repacked } = packIncremental(state.packing, state.units, units);
    const known = new Set(state.units.map((u) => u.key));
    const arrivals = { ...state.arrivals };
    const t0 = performance.now() + delayMs;
    let n = 0;
    const fresh = units.filter((u) => !known.has(u.key));
    // drop in packing order: lower pieces first, then back to front
    const order = packing.boxes.flatMap((b) => [...b.placements].sort((a, c) => a.y - c.y || a.z - c.z));
    for (const p of order) if (fresh.some((u) => u.key === p.key)) arrivals[p.key] = t0 + n++ * 230;
    state = { ...state, ...extra, lines: clean, units, packing, arrivals, repacked };
    if (fresh.length) state.addSeq++;
    emit();
  },
  add(add: Line[], opts: { delayMs?: number; gift?: boolean } = {}) {
    const lines = state.lines.map((l) => ({ ...l }));
    for (const a of add) {
      const hit = lines.find((l) => l.id === a.id && l.v === a.v);
      if (hit) hit.q = Math.min(9, hit.q + a.q);
      else lines.push({ ...a, q: Math.min(9, a.q) });
    }
    const it = itemOf(add[add.length - 1].id);
    this.set(lines, { lastAdded: it.name, ...(opts.gift !== undefined ? { gift: opts.gift || state.gift } : {}) }, opts.delayMs ?? 0);
  },
  setQty(id: ItemId, v: string, q: number) {
    this.set(state.lines.map((l) => (l.id === id && l.v === v ? { ...l, q: Math.max(0, Math.min(9, q)) } : l)));
  },
  remove(id: ItemId, v: string) {
    this.set(state.lines.filter((l) => !(l.id === id && l.v === v)));
  },
  clear() {
    this.set([], { gift: false });
  },
  setGift(gift: boolean) {
    state = { ...state, gift };
    emit();
  },
  setRegion(region: RegionId) {
    state = { ...state, region };
    emit();
  },
};

export type Totals = {
  count: number;
  subtotal: number;
  shipping: number;
  shippingBase: number;
  gift: number;
  free: boolean;
  toFree: number;
  boxes: { size: number; fee: number }[];
};

export function totals(s: CartState): Totals {
  const count = s.lines.reduce((a, l) => a + l.q, 0);
  const subtotal = s.lines.reduce((a, l) => a + priceOf(itemOf(l.id), l.v) * l.q, 0);
  const boxes = count ? s.packing.boxes.map((b) => ({ size: b.size.id, fee: boxFee(b.size.id, s.region) })) : [];
  const shippingBase = boxes.reduce((a, b) => a + b.fee, 0);
  const free = subtotal >= FREE_SHIPPING;
  const shipping = !count ? 0 : free ? (s.region === 'okinawa' ? OKINAWA_FLAT * boxes.length : 0) : shippingBase;
  const gift = s.gift && count ? GIFT_FEE * boxes.length : 0;
  return { count, subtotal, shipping, shippingBase, gift, free, toFree: Math.max(0, FREE_SHIPPING - subtotal), boxes };
}
