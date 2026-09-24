import { windows } from './content';

// Simulated queue for every counter. Time is compressed (≈20×) so a
// visitor watching the page sees the numbers move.
export type Q = { no: number; called: number; waiting: number };
export type QueueState = { q: Record<number, Q>; last: { no: number; n: number; t: number } | null };

export const ticketNo = (letter: string, n: number) => `${letter}-${String(n).padStart(3, '0')}`;

/** crowd factor by hour (0..1) — mornings and just after lunch are busiest */
export function crowd(d: Date) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 8.5 || h > 17.25) return 0.35;
  const curve = [
    [8.5, 0.55], [9.5, 0.95], [10.5, 1], [11.5, 0.8], [12, 0.7], [13, 0.9], [14, 0.75], [15, 0.6], [16, 0.45], [17.25, 0.3],
  ];
  for (let i = 1; i < curve.length; i++) {
    if (h <= curve[i][0]) {
      const t = (h - curve[i - 1][0]) / (curve[i][0] - curve[i - 1][0]);
      return curve[i - 1][1] + (curve[i][1] - curve[i - 1][1]) * t;
    }
  }
  return 0.4;
}

export function initQueue(now: Date, rnd = Math.random): QueueState {
  const c = crowd(now);
  const mins = Math.max(40, (now.getHours() - 8.5) * 60 + now.getMinutes());
  const q: Record<number, Q> = {};
  for (const w of windows) {
    const served = Math.round(Math.min(mins, 520) / w.per * (0.7 + rnd() * 0.3));
    const waiting = w.reserve ? Math.round(rnd() * 2) : Math.max(1, Math.round((12 / w.per + 2) * c + rnd() * 3));
    q[w.no] = { no: w.no, called: Math.max(3, served), waiting };
  }
  return { q, last: null };
}

/** one simulation step; `mine` = window of the visitor's ticket (served faster) */
export function step(s: QueueState, mine: number | null, now: Date, rnd = Math.random): QueueState {
  const c = crowd(now);
  const q = { ...s.q };
  let last = s.last;
  for (const w of windows) {
    const cur = { ...q[w.no] };
    const pCall = w.reserve ? 0.03 : Math.min(0.5, (2.2 / w.per) * 0.9) * (w.no === mine ? 2.6 : 1);
    if (cur.waiting > 0 && rnd() < pCall) {
      cur.called += 1;
      cur.waiting -= 1;
      if (!last || rnd() < 0.7 || w.no === mine) last = { no: w.no, n: cur.called, t: Date.now() };
    }
    const pArrive = w.reserve ? 0.01 : Math.min(0.45, (2.2 / w.per) * 0.8 * (0.5 + c));
    if (rnd() < pArrive && cur.waiting < 14) cur.waiting += 1;
    q[w.no] = cur;
  }
  return { q, last };
}
