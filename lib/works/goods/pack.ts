// Box packing: a height-map ("skyline") packer on a 1cm grid.
// Items rest on the highest point under their footprint, like objects set down by hand.
// Fragile items get a ring of paper cushion around them and a thin paper bed below.
import { BOXES, type BoxSize, type ItemId } from './data';

export type PackUnit = {
  key: string;
  id: ItemId;
  v: string;
  /** cm: width (x), depth (z), height (y) */
  w: number;
  d: number;
  h: number;
  fragile: boolean;
  soft: boolean;
};

export type Placement = {
  key: string;
  /** centre of the (unpadded) footprint, cm, box-floor origin at the centre */
  x: number;
  z: number;
  /** bottom of the item, cm above the inner floor */
  y: number;
  /** true when rotated 90° around the vertical axis */
  rot: boolean;
  /** padded footprint used for the cushion ring */
  pw: number;
  pd: number;
  cushion: boolean;
};

export type PackedBox = {
  size: BoxSize;
  placements: Placement[];
  /** 0..1 of the inner volume occupied by items (not paper) */
  fill: number;
  top: number;
};

export type Packing = { boxes: PackedBox[] };

const PAD = 1.5; // cm of paper each side of a fragile piece
const BED = 1.0; // cm of paper below it
const CELL = 1; // grid resolution (cm)

type Grid = { nx: number; nz: number; hm: Float32Array; block: Uint8Array; W: number; D: number; H: number };
/** pieces nothing should be stacked on (lids, knobs, handles, rims) */
const NO_TOP = new Set<ItemId>(['donabe', 'kyusu', 'jar', 'cup', 'shinogi', 'zaru']);

const grid = (size: BoxSize): Grid => {
  const [W, D, H] = size.inner;
  const nx = Math.floor(W / CELL);
  const nz = Math.floor(D / CELL);
  return { nx, nz, hm: new Float32Array(nx * nz), block: new Uint8Array(nx * nz), W, D, H };
};

const footprint = (u: PackUnit, rot: boolean) => {
  const pad = u.fragile ? PAD * 2 : 0;
  const w = (rot ? u.d : u.w) + pad;
  const d = (rot ? u.w : u.d) + pad;
  return { w, d, cw: Math.ceil(w / CELL - 1e-6), cd: Math.ceil(d / CELL - 1e-6) };
};

/** Find the best resting spot for `u` in `g`; null when it does not fit. */
function spot(g: Grid, u: PackUnit) {
  let best: { i: number; j: number; base: number; rot: boolean; score: number } | null = null;
  const rots = u.w === u.d ? [false] : [false, true];
  for (const rot of rots) {
    const { cw, cd } = footprint(u, rot);
    if (cw > g.nx || cd > g.nz) continue;
    const hh = u.h + (u.fragile ? BED : 0);
    for (let j = 0; j + cd <= g.nz; j++) {
      for (let i = 0; i + cw <= g.nx; i++) {
        let base = 0;
        let blocked = false;
        for (let b = 0; b < cd && !blocked; b++) {
          const row = (j + b) * g.nx;
          for (let a = 0; a < cw; a++) {
            if (g.block[row + i + a]) {
              blocked = true;
              break;
            }
            const v = g.hm[row + i + a];
            if (v > base) base = v;
          }
        }
        if (blocked) continue;
        if (base + hh > g.H + 0.01) continue;
        // how much of the footprint actually touches something at that height
        let touch = 0;
        for (let b = 0; b < cd; b++) {
          const row = (j + b) * g.nx;
          for (let a = 0; a < cw; a++) if (g.hm[row + i + a] > base - 0.8) touch++;
        }
        if (base > 0 && touch / (cw * cd) < 0.45) continue;
        // lowest first, then fill from the back-left, prefer long side along the width
        const score = base * 4000 + j * 40 + i + (rot ? 0.5 : 0);
        if (!best || score < best.score) best = { i, j, base, rot, score };
      }
    }
  }
  return best;
}

function put(g: Grid, u: PackUnit, s: { i: number; j: number; base: number; rot: boolean }): Placement {
  const f = footprint(u, s.rot);
  const hh = u.h + (u.fragile ? BED : 0);
  const nt = NO_TOP.has(u.id) ? 1 : 0;
  for (let b = 0; b < f.cd; b++)
    for (let a = 0; a < f.cw; a++) {
      g.hm[(s.j + b) * g.nx + s.i + a] = s.base + hh;
      g.block[(s.j + b) * g.nx + s.i + a] = nt;
    }
  // centre the item inside the cells it occupies, snapped to the box origin
  const x = -g.W / 2 + s.i * CELL + f.w / 2;
  const z = -g.D / 2 + s.j * CELL + f.d / 2;
  return {
    key: u.key,
    x,
    z,
    y: s.base + (u.fragile ? BED : 0),
    rot: s.rot,
    pw: f.w,
    pd: f.d,
    cushion: u.fragile,
  };
}

const byArea = (a: PackUnit, b: PackUnit) =>
  Number(a.soft) - Number(b.soft) || b.w * b.d - a.w * a.d || b.h - a.h || a.key.localeCompare(b.key);
/** flat, sturdy things (boards, plates) go down first so others can sit on them */
const flatFirst = (a: PackUnit, b: PackUnit) => {
  const fa = !a.soft && a.h <= 3.5 && !NO_TOP.has(a.id) ? 0 : 1;
  const fb = !b.soft && b.h <= 3.5 && !NO_TOP.has(b.id) ? 0 : 1;
  return Number(a.soft) - Number(b.soft) || fa - fb || byArea(a, b);
};
const tallFirst = (a: PackUnit, b: PackUnit) => Number(a.soft) - Number(b.soft) || b.h - a.h || byArea(a, b);
const ORDERS = [byArea, flatFirst, tallFirst];
const order = byArea;

const summarise = (size: BoxSize, placements: Placement[], units: PackUnit[]): PackedBox => {
  const vol = size.inner[0] * size.inner[1] * size.inner[2];
  let used = 0;
  let top = 0;
  for (const p of placements) {
    const u = units.find((x) => x.key === p.key)!;
    used += u.w * u.d * u.h;
    top = Math.max(top, p.y + u.h);
  }
  return { size, placements, fill: Math.min(1, used / vol), top };
};

/** Try to pack every unit into one box of `size`. */
function tryBox(size: BoxSize, units: PackUnit[]) {
  let best: { placements: Placement[]; left: PackUnit[] } | null = null;
  for (const ord of ORDERS) {
    const g = grid(size);
    const out: Placement[] = [];
    const left: PackUnit[] = [];
    for (const u of [...units].sort(ord)) {
      const s = spot(g, u);
      if (s) out.push(put(g, u, s));
      else left.push(u);
    }
    if (!left.length) return { placements: out, left };
    if (!best || left.length < best.left.length) best = { placements: out, left };
  }
  return best!;
}

/** Full repack: smallest single box that holds everything; overflow spills into more boxes. */
export function packAll(units: PackUnit[]): Packing {
  if (!units.length) return { boxes: [{ size: BOXES[0], placements: [], fill: 0, top: 0 }] };
  const boxes: PackedBox[] = [];
  let rest = units;
  let guard = 0;
  while (rest.length && guard++ < 6) {
    let done = false;
    for (const size of BOXES) {
      const r = tryBox(size, rest);
      if (!r.left.length) {
        boxes.push(summarise(size, r.placements, rest));
        rest = [];
        done = true;
        break;
      }
    }
    if (done) break;
    const big = BOXES[BOXES.length - 1];
    const r = tryBox(big, rest);
    if (!r.placements.length) break; // something bigger than the biggest box — give up
    boxes.push(summarise(big, r.placements, rest));
    rest = r.left;
  }
  return { boxes };
}

/**
 * Add `added` units to an existing packing without moving what is already in the box.
 * Falls back to a full repack (possibly into a bigger box) when they do not fit.
 */
export function packIncremental(prev: Packing, prevUnits: PackUnit[], units: PackUnit[]): { packing: Packing; repacked: boolean } {
  const known = new Set(prevUnits.map((u) => u.key));
  const keys = new Set(units.map((u) => u.key));
  const removed = prevUnits.some((u) => !keys.has(u.key));
  const added = units.filter((u) => !known.has(u.key));
  if (removed || prev.boxes.length !== 1 || !prev.boxes[0].placements.length) {
    const next = packAll(units);
    return { packing: next, repacked: prev.boxes[0]?.placements.length > 0 && moved(prev, next) };
  }
  const box = prev.boxes[0];
  const g = grid(box.size);
  // rebuild the height map from the current placements
  for (const p of box.placements) {
    const u = prevUnits.find((x) => x.key === p.key);
    if (!u) continue;
    const f = footprint(u, p.rot);
    const i = Math.round((p.x - f.w / 2 + g.W / 2) / CELL);
    const j = Math.round((p.z - f.d / 2 + g.D / 2) / CELL);
    const hh = u.h + (u.fragile ? BED : 0);
    const base = p.y - (u.fragile ? BED : 0);
    for (let b = 0; b < f.cd; b++)
      for (let a = 0; a < f.cw; a++) {
        const k = (j + b) * g.nx + i + a;
        if (k >= 0 && k < g.hm.length) {
          g.hm[k] = Math.max(g.hm[k], base + hh);
          if (NO_TOP.has(u.id)) g.block[k] = 1;
        }
      }
  }
  const placed: Placement[] = [];
  for (const u of [...added].sort(order)) {
    const s = spot(g, u);
    if (!s) {
      const next = packAll(units);
      return { packing: next, repacked: true };
    }
    placed.push(put(g, u, s));
  }
  return { packing: { boxes: [summarise(box.size, [...box.placements, ...placed], units)] }, repacked: false };
}

function moved(a: Packing, b: Packing) {
  if (a.boxes.length !== b.boxes.length) return true;
  for (let i = 0; i < a.boxes.length; i++) {
    if (a.boxes[i].size.id !== b.boxes[i].size.id) return true;
    for (const p of b.boxes[i].placements) {
      const q = a.boxes[i].placements.find((x) => x.key === p.key);
      if (q && (Math.abs(q.x - p.x) > 0.1 || Math.abs(q.z - p.z) > 0.1 || Math.abs(q.y - p.y) > 0.1)) return true;
    }
  }
  return false;
}
