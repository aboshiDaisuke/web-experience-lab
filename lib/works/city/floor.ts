import { windows, winByNo } from './content';

// Building grid (1 unit ≈ 1.5 m). x → east, y → south (entrance side), z ↑.
export const BW = 44;
export const BD = 24;
export const CORRIDOR = 12;
export const FLOOR_Z = 21;
export const EV = { x: 40, y: 14, w: 4, d: 4 };
export const ENTRANCE = { x: 22, y: BD };

const AX = [0.94, 0.342];
const AY = [-0.655, 0.459];
export const S = 11;

export type P3 = [number, number, number];
export const proj = (x: number, y: number, z: number): [number, number] => [
  (x * AX[0] + y * AY[0]) * S,
  (x * AX[1] + y * AY[1] - z) * S,
];
export const pts = (...p: P3[]) =>
  p.map(([x, y, z]) => proj(x, y, z).map((v) => v.toFixed(1)).join(',')).join(' ');

export const zOf = (floor: 1 | 2) => (floor === 1 ? 0 : FLOOR_Z);

/** axis-aligned box → visible faces (top, south, east) as polygon point strings */
export function box(x: number, y: number, z: number, w: number, d: number, h: number) {
  return {
    top: pts([x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]),
    south: pts([x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]),
    east: pts([x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]),
  };
}

export const counterBox = (no: number) => {
  const w = winByNo(no);
  const z = zOf(w.floor);
  return w.side === 'n' ? box(w.x - 2.6, 7, z, 5.2, 1.3, 1.2) : box(w.x - 2.6, 15.7, z, 5.2, 1.3, 1.2);
};
export const counterFront = (no: number): P3 => {
  const w = winByNo(no);
  return [w.x, w.side === 'n' ? 9.6 : 14.4, zOf(w.floor)];
};

/** window zones (tinted floor areas behind the counters) */
export const zones = windows.map((w) => {
  const z = zOf(w.floor);
  const y0 = w.side === 'n' ? 0 : 17;
  const y1 = w.side === 'n' ? 7 : BD;
  return { no: w.no, floor: w.floor, poly: pts([w.x - 3.3, y0, z], [w.x + 3.3, y0, z], [w.x + 3.3, y1, z], [w.x - 3.3, y1, z]) };
});

export type Route = { points: P3[]; stops: { no: number; at: number; step: number }[] };

/** walk from the entrance through each counter in order (floor changes via EV) */
export function routeFor(nos: number[]): Route {
  const points: P3[] = [[ENTRANCE.x, BD + 3, 0], [ENTRANCE.x, BD, 0], [ENTRANCE.x, CORRIDOR, 0]];
  const stops: Route['stops'] = [];
  let floor: 1 | 2 = 1;
  const push = (p: P3) => {
    const l = points[points.length - 1];
    if (l[0] !== p[0] || l[1] !== p[1] || l[2] !== p[2]) points.push(p);
  };
  nos.forEach((no, i) => {
    const w = winByNo(no);
    let z = zOf(floor);
    if (w.floor !== floor) {
      push([EV.x + 2, CORRIDOR, z]);
      push([EV.x + 2, EV.y + 2, z]);
      floor = w.floor;
      z = zOf(floor);
      push([EV.x + 2, EV.y + 2, z]);
      push([EV.x + 2, CORRIDOR, z]);
    }
    const f = counterFront(no);
    push([f[0], CORRIDOR, z]);
    push(f);
    stops.push({ no, at: points.length - 1, step: i });
    push([f[0], CORRIDOR, z]);
  });
  return { points, stops };
}

/** projected polyline with cumulative lengths */
export function measure(route: Route) {
  const p2 = route.points.map(([x, y, z]) => proj(x, y, z));
  const cum = [0];
  for (let i = 1; i < p2.length; i++) cum.push(cum[i - 1] + Math.hypot(p2[i][0] - p2[i - 1][0], p2[i][1] - p2[i - 1][1]));
  return { p2, cum, total: cum[cum.length - 1] };
}

export function pointAt(p2: [number, number][], cum: number[], d: number): [number, number] {
  if (d <= 0) return p2[0];
  for (let i = 1; i < p2.length; i++) {
    if (cum[i] >= d) {
      const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return [p2[i - 1][0] + (p2[i][0] - p2[i - 1][0]) * t, p2[i - 1][1] + (p2[i][1] - p2[i - 1][1]) * t];
    }
  }
  return p2[p2.length - 1];
}

/** SVG viewBox covering both floors */
export function viewBox(pad = 26) {
  const c: [number, number][] = [];
  for (const z of [0, FLOOR_Z + 3]) for (const [x, y] of [[0, 0], [BW, 0], [BW, BD + 4], [0, BD + 4]]) c.push(proj(x, y, z));
  c.push(proj(0, 0, -1.2), proj(BW, BD + 4, -1.2));
  const xs = c.map((p) => p[0]);
  const ys = c.map((p) => p[1]);
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  return `${x0.toFixed(0)} ${y0.toFixed(0)} ${(Math.max(...xs) - x0 + pad).toFixed(0)} ${(Math.max(...ys) - y0 + pad).toFixed(0)}`;
}
