/**
 * Walkability for the walkthrough: a per-floor occupancy grid rasterised
 * from the NAV_* planes (where you may stand) and the baked building meshes
 * (what you may not walk through), plus line-of-sight, nearest-free-cell and
 * A* queries on it. Framework free, no three.js scene dependencies besides
 * math types.
 */
import * as T from 'three';

export const CELL = 0.1;
/** body radius: the camera never ends closer than this to furniture / walls */
export const CLEARANCE = 0.3;
/** obstacles are geometry between these heights above the local floor */
const BAND_LO = 0.2;
const BAND_HI = 1.35;

export type NavGrid = {
  floor: string;
  x0: number;
  z0: number;
  w: number;
  h: number;
  /** floor height of walkable surface per cell (NaN = no floor) */
  navY: Float32Array;
  /** raw obstacle occupancy */
  blocked: Uint8Array;
  /** metres to the nearest obstacle cell */
  dist: Float32Array;
  /** navigable & far enough from obstacles */
  walk: Uint8Array;
  minY: number;
  maxY: number;
};

type Tri = [T.Vector3, T.Vector3, T.Vector3];

function meshTriangles(mesh: T.Mesh, out: Tri[]) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const idx = geo.index;
  mesh.updateWorldMatrix(true, false);
  const m = mesh.matrixWorld;
  const n = idx ? idx.count : pos.count;
  const v = (i: number) =>
    new T.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m);
  for (let i = 0; i + 2 < n; i += 3) out.push([v(i), v(i + 1), v(i + 2)]);
}

/** Sutherland–Hodgman clip of a polygon to lo <= y <= hi */
function clipY(poly: T.Vector3[], lo: number, hi: number) {
  const clip = (pts: T.Vector3[], keep: (p: T.Vector3) => number) => {
    const out: T.Vector3[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const da = keep(a);
      const db = keep(b);
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) out.push(a.clone().lerp(b, da / (da - db)));
    }
    return out;
  };
  let p = clip(poly, (q) => q.y - lo);
  if (p.length) p = clip(p, (q) => hi - q.y);
  return p;
}

export function buildGrid(
  floor: string,
  navMeshes: T.Mesh[],
  obstacleMeshes: T.Mesh[],
  obstacleBoxes: T.Box3[],
): NavGrid | null {
  const navTris: Tri[] = [];
  navMeshes.forEach((m) => meshTriangles(m, navTris));
  if (!navTris.length) return null;
  const box = new T.Box3();
  navTris.forEach((t) => t.forEach((p) => box.expandByPoint(p)));
  const margin = 0.8;
  const x0 = box.min.x - margin;
  const z0 = box.min.z - margin;
  const w = Math.ceil((box.max.x - box.min.x + margin * 2) / CELL);
  const h = Math.ceil((box.max.z - box.min.z + margin * 2) / CELL);
  const N = w * h;
  const navY = new Float32Array(N).fill(NaN);
  const blocked = new Uint8Array(N);
  const minY = box.min.y;
  const maxY = box.max.y;

  // 1. navigable floor
  for (const [a, b, c] of navTris) {
    const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - x0) / CELL));
    const i1 = Math.min(w - 1, Math.floor((Math.max(a.x, b.x, c.x) - x0) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) - z0) / CELL));
    const j1 = Math.min(h - 1, Math.floor((Math.max(a.z, b.z, c.z) - z0) / CELL));
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(d) < 1e-9) continue;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const px = x0 + (i + 0.5) * CELL;
        const pz = z0 + (j + 0.5) * CELL;
        const l1 = ((b.z - c.z) * (px - c.x) + (c.x - b.x) * (pz - c.z)) / d;
        const l2 = ((c.z - a.z) * (px - c.x) + (a.x - c.x) * (pz - c.z)) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        navY[j * w + i] = a.y * l1 + b.y * l2 + c.y * l3;
      }
  }

  // 1b. bridge thin gaps between NAV planes (door thresholds, sash lines):
  // morphological closing of the floor mask; walls stay blocked as obstacles
  {
    const R = 3; // cells → closes gaps up to ~0.6 m
    const has = new Uint8Array(N);
    for (let k = 0; k < N; k++) has[k] = Number.isNaN(navY[k]) ? 0 : 1;
    const pass = (src: Uint8Array, dilate: boolean) => {
      const tmp = new Uint8Array(N);
      const out = new Uint8Array(N);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          let v = dilate ? 0 : 1;
          for (let d = -R; d <= R; d++) {
            const ii = i + d;
            const x = ii < 0 || ii >= w ? (dilate ? 0 : 1) : src[j * w + ii];
            v = dilate ? v | x : v & x;
          }
          tmp[j * w + i] = v;
        }
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          let v = dilate ? 0 : 1;
          for (let d = -R; d <= R; d++) {
            const jj = j + d;
            const x = jj < 0 || jj >= h ? (dilate ? 0 : 1) : tmp[jj * w + i];
            v = dilate ? v | x : v & x;
          }
          out[j * w + i] = v;
        }
      return out;
    };
    const closed = pass(pass(has, true), false);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (!closed[k] || has[k]) continue;
        let sum = 0;
        let n = 0;
        for (let dj = -R - 1; dj <= R + 1; dj++)
          for (let di = -R - 1; di <= R + 1; di++) {
            const ii = i + di;
            const jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= w || jj >= h || !has[jj * w + ii]) continue;
            sum += navY[jj * w + ii];
            n++;
          }
        if (n) navY[k] = sum / n;
      }
  }

  // 2. obstacles: triangles clipped to the body band, projected to XZ
  const lo = minY + BAND_LO;
  const hi = maxY + BAND_HI;
  const mark = (x: number, z: number, y0: number, y1: number) => {
    const i = Math.floor((x - x0) / CELL);
    const j = Math.floor((z - z0) / CELL);
    if (i < 0 || j < 0 || i >= w || j >= h) return;
    const k = j * w + i;
    const fy = Number.isNaN(navY[k]) ? minY : navY[k];
    if (y1 < fy + BAND_LO || y0 > fy + BAND_HI) return;
    blocked[k] = 1;
  };
  const tris: Tri[] = [];
  obstacleMeshes.forEach((m) => meshTriangles(m, tris));
  const bx0 = x0;
  const bx1 = x0 + w * CELL;
  const bz0 = z0;
  const bz1 = z0 + h * CELL;
  for (const t of tris) {
    const ty0 = Math.min(t[0].y, t[1].y, t[2].y);
    const ty1 = Math.max(t[0].y, t[1].y, t[2].y);
    if (ty1 < lo || ty0 > hi) continue;
    if (
      Math.max(t[0].x, t[1].x, t[2].x) < bx0 ||
      Math.min(t[0].x, t[1].x, t[2].x) > bx1 ||
      Math.max(t[0].z, t[1].z, t[2].z) < bz0 ||
      Math.min(t[0].z, t[1].z, t[2].z) > bz1
    )
      continue;
    const poly = clipY(t, lo, hi);
    if (poly.length < 2) continue;
    let py0 = Infinity;
    let py1 = -Infinity;
    poly.forEach((p) => {
      py0 = Math.min(py0, p.y);
      py1 = Math.max(py1, p.y);
    });
    // edges (catches vertical walls whose projection is a line)
    for (let e = 0; e < poly.length; e++) {
      const a = poly[e];
      const b = poly[(e + 1) % poly.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.max(1, Math.ceil(len / (CELL * 0.45)));
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        mark(a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f, py0, py1);
      }
    }
    // interior (horizontal surfaces: tables, beds, counters)
    if (poly.length >= 3) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      poly.forEach((p) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      });
      if ((maxX - minX) * (maxZ - minZ) < CELL * CELL * 0.5) continue;
      const i0 = Math.max(0, Math.floor((minX - x0) / CELL));
      const i1 = Math.min(w - 1, Math.floor((maxX - x0) / CELL));
      const j0 = Math.max(0, Math.floor((minZ - z0) / CELL));
      const j1 = Math.min(h - 1, Math.floor((maxZ - z0) / CELL));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const px = x0 + (i + 0.5) * CELL;
          const pz = z0 + (j + 0.5) * CELL;
          let pos = 0;
          let neg = 0;
          for (let e = 0; e < poly.length; e++) {
            const a = poly[e];
            const b = poly[(e + 1) % poly.length];
            const c = (b.x - a.x) * (pz - a.z) - (b.z - a.z) * (px - a.x);
            if (c > 1e-7) pos++;
            else if (c < -1e-7) neg++;
          }
          if (!pos || !neg) mark(px, pz, py0, py1);
        }
    }
  }
  for (const b of obstacleBoxes) {
    for (let x = b.min.x; x <= b.max.x + 1e-6; x += CELL * 0.5)
      for (let z = b.min.z; z <= b.max.z + 1e-6; z += CELL * 0.5)
        mark(x, z, b.min.y, b.max.y);
  }

  // 3. distance to nearest obstacle (two-pass chamfer)
  const dist = new Float32Array(N).fill(1e6);
  for (let k = 0; k < N; k++) if (blocked[k]) dist[k] = 0;
  const D = CELL;
  const D2 = CELL * Math.SQRT2;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      let d = dist[k];
      if (i > 0) d = Math.min(d, dist[k - 1] + D);
      if (j > 0) {
        d = Math.min(d, dist[k - w] + D);
        if (i > 0) d = Math.min(d, dist[k - w - 1] + D2);
        if (i < w - 1) d = Math.min(d, dist[k - w + 1] + D2);
      }
      dist[k] = d;
    }
  for (let j = h - 1; j >= 0; j--)
    for (let i = w - 1; i >= 0; i--) {
      const k = j * w + i;
      let d = dist[k];
      if (i < w - 1) d = Math.min(d, dist[k + 1] + D);
      if (j < h - 1) {
        d = Math.min(d, dist[k + w] + D);
        if (i < w - 1) d = Math.min(d, dist[k + w + 1] + D2);
        if (i > 0) d = Math.min(d, dist[k + w - 1] + D2);
      }
      dist[k] = d;
    }
  const walk = new Uint8Array(N);
  for (let k = 0; k < N; k++)
    walk[k] = !Number.isNaN(navY[k]) && dist[k] >= CLEARANCE ? 1 : 0;
  return { floor, x0, z0, w, h, navY, blocked, dist, walk, minY, maxY };
}

export const cellOf = (g: NavGrid, x: number, z: number) => {
  const i = Math.floor((x - g.x0) / CELL);
  const j = Math.floor((z - g.z0) / CELL);
  return i < 0 || j < 0 || i >= g.w || j >= g.h ? -1 : j * g.w + i;
};
export const cellCenter = (g: NavGrid, k: number): [number, number] => [
  g.x0 + ((k % g.w) + 0.5) * CELL,
  g.z0 + (Math.floor(k / g.w) + 0.5) * CELL,
];
export const floorYAt = (g: NavGrid, x: number, z: number) => {
  const k = cellOf(g, x, z);
  return k < 0 ? NaN : g.navY[k];
};
export const isWalkable = (g: NavGrid, x: number, z: number) => {
  const k = cellOf(g, x, z);
  return k >= 0 && g.walk[k] === 1;
};

/**
 * Straight-line clearance on the grid. Cells within `relax` metres of either
 * end only need to be free of raw obstacles (so viewpoints placed close to a
 * wall or just off the NAV plane — stair landings — still connect).
 */
export function lineOfSight(
  g: NavGrid,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  relax = 0,
) {
  const len = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(len / (CELL * 0.5)));
  for (let s = 0; s <= steps; s++) {
    const f = s / steps;
    const x = ax + (bx - ax) * f;
    const z = az + (bz - az) * f;
    const k = cellOf(g, x, z);
    if (k < 0) return false;
    const endDist = Math.min(f, 1 - f) * len;
    if (endDist < relax) {
      if (g.dist[k] < CLEARANCE * 0.5) return false;
    } else if (!g.walk[k]) return false;
  }
  return true;
}

/** nearest walkable cell centre within `maxR` metres (breadth-first rings) */
export function nearestWalkable(
  g: NavGrid,
  x: number,
  z: number,
  maxR: number,
): [number, number] | null {
  const ci = Math.floor((x - g.x0) / CELL);
  const cj = Math.floor((z - g.z0) / CELL);
  const R = Math.ceil(maxR / CELL);
  let best = -1;
  let bestD = Infinity;
  for (let r = 0; r <= R; r++) {
    for (let j = cj - r; j <= cj + r; j++)
      for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
        if (i < 0 || j < 0 || i >= g.w || j >= g.h) continue;
        const k = j * g.w + i;
        if (!g.walk[k]) continue;
        const [px, pz] = cellCenter(g, k);
        const d = Math.hypot(px - x, pz - z);
        if (d < bestD && d <= maxR) {
          bestD = d;
          best = k;
        }
      }
    // once found, one more ring can only improve by < 1 cell
    if (best >= 0 && r * CELL > bestD + CELL) break;
  }
  return best >= 0 ? cellCenter(g, best) : null;
}

/** A* over walkable cells, preferring the middle of rooms; returns XZ points */
export function findPath(
  g: NavGrid,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): [number, number][] | null {
  const snap = (x: number, z: number) => {
    const k = cellOf(g, x, z);
    if (k >= 0 && g.walk[k]) return k;
    const n = nearestWalkable(g, x, z, 0.8);
    return n ? cellOf(g, n[0], n[1]) : -1;
  };
  const s = snap(ax, az);
  const t = snap(bx, bz);
  if (s < 0 || t < 0) return null;
  const N = g.w * g.h;
  const gScore = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  // binary heap of [f, k]
  const heap: number[] = [];
  const hf: number[] = [];
  const push = (k: number, f: number) => {
    heap.push(k);
    hf.push(f);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= hf[i]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      [hf[p], hf[i]] = [hf[i], hf[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const lastK = heap.pop()!;
    const lastF = hf.pop()!;
    if (heap.length) {
      heap[0] = lastK;
      hf[0] = lastF;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && hf[l] < hf[m]) m = l;
        if (r < heap.length && hf[r] < hf[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        [hf[m], hf[i]] = [hf[i], hf[m]];
        i = m;
      }
    }
    return top;
  };
  const [tx, tz] = cellCenter(g, t);
  const hEst = (k: number) => {
    const [x, z] = cellCenter(g, k);
    return Math.hypot(x - tx, z - tz);
  };
  gScore[s] = 0;
  push(s, hEst(s));
  const nb = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  let found = false;
  while (heap.length) {
    const k = pop();
    if (closed[k]) continue;
    if (k === t) {
      found = true;
      break;
    }
    closed[k] = 1;
    const i = k % g.w;
    const j = (k - i) / g.w;
    for (const [di, dj, c] of nb) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= g.w || nj >= g.h) continue;
      const nk = nj * g.w + ni;
      if (!g.walk[nk] || closed[nk]) continue;
      // keep away from walls: extra cost within 0.7 m of obstacles
      const wall = Math.max(0, 0.7 - g.dist[nk]) * 2.2;
      const ng = gScore[k] + c * CELL * (1 + wall);
      if (ng < gScore[nk]) {
        gScore[nk] = ng;
        came[nk] = k;
        push(nk, ng + hEst(nk));
      }
    }
  }
  if (!found) return null;
  const cells: number[] = [];
  for (let k = t; k >= 0; k = came[k]) cells.push(k);
  cells.reverse();
  const pts = cells.map((k) => cellCenter(g, k));
  pts[0] = [ax, az];
  pts[pts.length - 1] = [bx, bz];
  return simplify(g, pts);
}

/** greedy string pulling: keep only the points needed for clear sight lines */
export function simplify(g: NavGrid, pts: [number, number][]) {
  if (pts.length <= 2) return pts;
  const out: [number, number][] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !lineOfSight(g, pts[i][0], pts[i][1], pts[j][0], pts[j][1], 0.35))
      j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}
