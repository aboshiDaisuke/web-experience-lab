import type { Shape } from './data';

/**
 * Side-elevation drawings of each body type, built from a handful of design
 * points (x = distance from the rear bumper, h = height above ground, both in
 * centimetres, front of the car to the right). Output is plain SVG path data.
 */

export const G = 200; // ground line (svg y)

type Pt = [number, number, number?]; // x, h, corner radius
type Spec = {
  L: number;
  H: number;
  wheels: [number, number];
  r: number;
  clr: number;
  top: Pt[];
  dlo: Pt[];
  belt: number;
  pillars: { x: number; w: number; dark?: boolean; lean?: number }[];
  doors: { x: number; lean?: number }[];
  tail: Pt[];
  head: Pt[];
  mirror: [number, number];
  handles: number[];
  rails?: boolean;
  slide?: [number, number];
  cladding?: boolean;
  offroad?: boolean;
  spokes: number;
};

const SPECS: Record<Shape, Spec> = {
  keiTall: {
    L: 340,
    H: 178,
    wheels: [40, 292],
    r: 28,
    clr: 16,
    top: [[6, 24], [2, 62, 8], [4, 150, 12], [13, 176, 14], [236, 177, 26], [296, 108, 12], [330, 96, 16], [338, 78, 8], [339, 26, 6]],
    dlo: [[16, 108, 3], [18, 160, 8], [27, 168, 10], [228, 168, 14], [283, 110, 3], [282, 106, 2], [16, 106, 2]],
    belt: 106,
    pillars: [
      { x: 70, w: 9 },
      { x: 164, w: 10, dark: true },
      { x: 266, w: 3, dark: true, lean: 0.9 },
    ],
    doors: [{ x: 280, lean: 0.25 }, { x: 168 }, { x: 74 }],
    tail: [[2, 96], [9, 96], [9, 150], [4, 150]],
    head: [[318, 99], [334, 93], [337, 84], [322, 88]],
    mirror: [286, 106],
    handles: [238, 152],
    slide: [74, 20],
    spokes: 5,
  },
  keiWagon: {
    L: 340,
    H: 164,
    wheels: [42, 288],
    r: 27,
    clr: 16,
    top: [[5, 24], [2, 62, 8], [6, 138, 14], [20, 162, 16], [220, 164, 30], [294, 104, 12], [330, 91, 16], [338, 76, 8], [339, 26, 6]],
    dlo: [[18, 104, 3], [21, 144, 10], [32, 153, 10], [212, 153, 16], [281, 106, 3], [280, 102, 2], [18, 102, 2]],
    belt: 102,
    pillars: [
      { x: 62, w: 12 },
      { x: 150, w: 9, dark: true },
    ],
    doors: [{ x: 278, lean: 0.25 }, { x: 154 }, { x: 66, lean: -0.05 }],
    tail: [[3, 92], [10, 92], [11, 130], [5, 130]],
    head: [[316, 95], [333, 88], [337, 80], [320, 84]],
    mirror: [284, 102],
    handles: [232, 140],
    spokes: 8,
  },
  compact: {
    L: 388,
    H: 150,
    wheels: [66, 316],
    r: 30,
    clr: 15,
    top: [[6, 26], [2, 58, 10], [6, 96, 10], [22, 128, 16], [58, 146, 28], [90, 150, 34], [222, 150, 42], [292, 104, 12], [364, 88, 26], [386, 66, 10], [388, 28, 8]],
    dlo: [[54, 104, 3], [68, 130, 12], [94, 141, 16], [216, 141, 26], [282, 106, 3], [281, 103, 2], [54, 103, 2]],
    belt: 103,
    pillars: [
      { x: 176, w: 9, dark: true },
      { x: 80, w: 24, lean: -0.6 },
    ],
    doors: [{ x: 280, lean: 0.3 }, { x: 180 }, { x: 98, lean: -0.12 }],
    tail: [[4, 90], [18, 92], [30, 116], [9, 110]],
    head: [[352, 94], [382, 81], [386, 72], [362, 80]],
    mirror: [286, 103],
    handles: [254, 152],
    spokes: 10,
  },
  minivan: {
    L: 470,
    H: 185,
    wheels: [80, 366],
    r: 31,
    clr: 16,
    top: [[8, 26], [3, 62, 10], [6, 166, 16], [24, 184, 20], [330, 185, 40], [402, 113, 14], [444, 98, 26], [466, 78, 10], [468, 28, 8]],
    dlo: [[22, 113, 3], [24, 168, 12], [40, 176, 12], [322, 176, 30], [392, 113, 3], [391, 110, 2], [22, 110, 2]],
    belt: 110,
    pillars: [
      { x: 110, w: 13 },
      { x: 250, w: 11, dark: true },
      { x: 372, w: 4, dark: true, lean: 0.8 },
    ],
    doors: [{ x: 390, lean: 0.3 }, { x: 254 }, { x: 114 }],
    tail: [[3, 100], [12, 100], [12, 160], [5, 160]],
    head: [[430, 105], [462, 93], [466, 84], [440, 91]],
    mirror: [396, 110],
    handles: [352, 240],
    slide: [114, 30],
    spokes: 5,
  },
  suv: {
    L: 446,
    H: 174,
    wheels: [78, 370],
    r: 38,
    clr: 27,
    top: [[8, 42], [3, 76, 8], [6, 134, 10], [24, 160, 12], [56, 170, 16], [296, 174, 34], [360, 126, 10], [432, 120, 18], [444, 104, 8], [446, 46, 8]],
    dlo: [[62, 129, 3], [76, 154, 10], [94, 161, 10], [290, 161, 24], [350, 129, 3], [349, 126, 2], [62, 126, 2]],
    belt: 126,
    pillars: [
      { x: 118, w: 14 },
      { x: 236, w: 10, dark: true },
    ],
    doors: [{ x: 348, lean: 0.28 }, { x: 240 }, { x: 132, lean: -0.06 }],
    tail: [[3, 116], [22, 118], [26, 136], [6, 134]],
    head: [[418, 124], [442, 116], [444, 108], [424, 114]],
    mirror: [354, 126],
    handles: [322, 214],
    rails: true,
    cladding: true,
    offroad: true,
    spokes: 6,
  },
  sedan: {
    L: 480,
    H: 145,
    wheels: [92, 372],
    r: 31,
    clr: 14,
    top: [[8, 26], [3, 58, 12], [9, 96, 10], [68, 104, 14], [142, 143, 34], [282, 145, 46], [364, 100, 14], [448, 86, 26], [476, 66, 10], [478, 28, 8]],
    dlo: [[94, 104, 3], [144, 136, 18], [276, 138, 30], [355, 101, 3], [354, 98, 2], [94, 98, 2]],
    belt: 98,
    pillars: [
      { x: 128, w: 6, dark: true, lean: -0.6 },
      { x: 234, w: 9, dark: true },
    ],
    doors: [{ x: 352, lean: 0.3 }, { x: 238 }, { x: 128, lean: -0.1 }],
    tail: [[3, 84], [30, 88], [30, 97], [7, 95]],
    head: [[440, 91], [472, 79], [476, 71], [448, 79]],
    mirror: [358, 98],
    handles: [322, 206],
    spokes: 10,
  },
};

const y = (h: number) => G - h;
const f = (n: number) => Math.round(n * 10) / 10;

/** Polyline with rounded corners (quadratic fillets). */
function chain(pts: Pt[], closed = false) {
  const P = pts.map(([x, h, r]) => ({ x, y: y(h), r: r ?? 0 }));
  const n = P.length;
  let d = '';
  const at = (i: number) => P[(i + n) % n];
  for (let i = 0; i < n; i++) {
    const p = P[i];
    const a = closed || i > 0 ? at(i - 1) : null;
    const b = closed || i < n - 1 ? at(i + 1) : null;
    if (!a || !b || !p.r) {
      d += `${d ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`;
      continue;
    }
    const la = Math.hypot(a.x - p.x, a.y - p.y);
    const lb = Math.hypot(b.x - p.x, b.y - p.y);
    const r = Math.min(p.r, la / 2, lb / 2);
    const A = { x: p.x + ((a.x - p.x) / la) * r, y: p.y + ((a.y - p.y) / la) * r };
    const B = { x: p.x + ((b.x - p.x) / lb) * r, y: p.y + ((b.y - p.y) / lb) * r };
    d += `${d ? 'L' : 'M'}${f(A.x)} ${f(A.y)}Q${f(p.x)} ${f(p.y)} ${f(B.x)} ${f(B.y)}`;
  }
  return closed ? d + 'Z' : d;
}

export type CarArt = {
  L: number;
  H: number;
  view: string;
  body: string;
  dlo: string;
  pillars: string[];
  darkPillars: string[];
  doors: string;
  crease: string;
  sill: string;
  tail: string;
  head: string;
  mirror: string;
  handles: string;
  wheels: { cx: number; cy: number; r: number }[];
  rails?: string;
  cladding?: string;
  slide?: string;
  fuel: { x: number; y: number };
  spokes: number;
  offroad?: boolean;
  skid?: string;
  lip?: string;
  glare: string;
  belt: number;
  arches: string;
};

const cache = new Map<Shape, CarArt>();

export function carArt(shape: Shape): CarArt {
  const hit = cache.get(shape);
  if (hit) return hit;
  const s = SPECS[shape];
  const ra = s.r + 4;
  const dy = s.r - s.clr;
  const dx = Math.sqrt(ra * ra - dy * dy);
  const [w1, w2] = s.wheels;
  const last = s.top[s.top.length - 1];
  const first = s.top[0];
  let body = chain(s.top);
  body += `L${f(w2 + dx + 3)} ${f(y(s.clr))}`;
  body += `L${f(w2 + dx)} ${f(y(s.clr))}A${ra} ${ra} 0 1 0 ${f(w2 - dx)} ${f(y(s.clr))}`;
  body += `L${f(w1 + dx)} ${f(y(s.clr))}A${ra} ${ra} 0 1 0 ${f(w1 - dx)} ${f(y(s.clr))}`;
  body += `L${f(first[0] + 3)} ${f(y(s.clr + 2))}Z`;
  void last;

  const dlo = chain(s.dlo, true);
  const band = (x: number, w: number, lean = 0) => {
    const top = s.H + 4;
    const b = s.belt - 2;
    const dx2 = lean * (top - b);
    return `M${f(x - w / 2)} ${f(y(b))}L${f(x + w / 2)} ${f(y(b))}L${f(x + w / 2 - dx2)} ${f(y(top))}L${f(x - w / 2 - dx2)} ${f(y(top))}Z`;
  };
  const pillars = s.pillars.filter((p) => !p.dark).map((p) => band(p.x, p.w, p.lean));
  const darkPillars = s.pillars.filter((p) => p.dark).map((p) => band(p.x, p.w, p.lean));

  const doors = s.doors
    .map((d) => {
      const lean = d.lean ?? 0;
      const top = s.belt - 1;
      const knee = Math.max(s.clr + 34, s.belt - 44);
      return `M${f(d.x)} ${f(y(top))}L${f(d.x - lean * (top - knee))} ${f(y(knee))}L${f(d.x - lean * (top - knee))} ${f(y(s.clr + 5))}`;
    })
    .join('');
  const crease = `M${f(first[0] + 6)} ${f(y(s.belt - 16))}C${f(s.L * 0.35)} ${f(y(s.belt - 12))} ${f(s.L * 0.7)} ${f(y(s.belt - 8))} ${f(s.L - 12)} ${f(y(s.belt - 4))}`;
  const sill = `M${f(w1 + dx + 2)} ${f(y(s.clr + 1))}L${f(w2 - dx - 2)} ${f(y(s.clr + 1))}L${f(w2 - dx - 6)} ${f(y(s.clr + 9))}L${f(w1 + dx + 6)} ${f(y(s.clr + 9))}Z`;
  const [mx, mh] = s.mirror;
  const mirror = `M${f(mx - 8)} ${f(y(mh + 1))}C${f(mx - 7)} ${f(y(mh + 12))} ${f(mx + 6)} ${f(y(mh + 14))} ${f(mx + 10)} ${f(y(mh + 9))}L${f(mx + 8)} ${f(y(mh))}Z`;
  const handles = s.handles.map((hx) => `M${f(hx - 8)} ${f(y(s.belt - 12))}h16v3.4h-16Z`).join('');
  const rails = s.rails
    ? `M${f(s.L * 0.14)} ${f(y(s.H - 1))}v-7h${f(s.L * 0.5)}v7h-5v-3h${f(-(s.L * 0.5 - 10))}v3Z`
    : undefined;
  const cladding = s.cladding
    ? `M${f(w1 - dx - 10)} ${f(y(s.clr))}L${f(w2 + dx + 10)} ${f(y(s.clr))}L${f(w2 + dx + 8)} ${f(y(s.clr + 13))}L${f(w1 - dx - 8)} ${f(y(s.clr + 13))}Z`
    : undefined;
  const slide = s.slide ? `M${f(s.slide[0])} ${f(y(s.belt - 3))}H${f(s.slide[1])}` : undefined;
  const glare = `M${f(s.L * 0.18)} ${f(y(s.belt - 4))}L${f(s.L * 0.34)} ${f(y(s.H + 6))}L${f(s.L * 0.42)} ${f(y(s.H + 6))}L${f(s.L * 0.26)} ${f(y(s.belt - 4))}Z M${f(s.L * 0.5)} ${f(y(s.belt - 4))}L${f(s.L * 0.6)} ${f(y(s.H + 6))}L${f(s.L * 0.63)} ${f(y(s.H + 6))}L${f(s.L * 0.53)} ${f(y(s.belt - 4))}Z`;

  const arches = [w1, w2]
    .map((wx) => `M${f(wx + dx)} ${f(y(s.clr))}A${ra} ${ra} 0 1 0 ${f(wx - dx)} ${f(y(s.clr))}`)
    .join('');
  const ro = ra + 7;
  const dxo = Math.sqrt(ro * ro - dy * dy);
  const lip = s.cladding
    ? [w1, w2].map((wx) => `M${f(wx + dxo)} ${f(y(s.clr))}A${ro} ${ro} 0 1 0 ${f(wx - dxo)} ${f(y(s.clr))}`).join('')
    : undefined;
  const art: CarArt = {
    arches,
    lip,
    L: s.L,
    H: s.H,
    view: `-14 ${G - s.H - 14} ${s.L + 28} ${s.H + 26}`,
    body,
    dlo,
    pillars,
    darkPillars,
    doors,
    crease,
    sill,
    tail: chain(s.tail.map(([x, h]) => [x, h, 2] as Pt), true),
    head: chain(s.head.map(([x, h]) => [x, h, 2] as Pt), true),
    mirror,
    handles,
    wheels: [
      { cx: w1, cy: y(s.r), r: s.r },
      { cx: w2, cy: y(s.r), r: s.r },
    ],
    rails,
    cladding,
    slide,
    fuel: { x: w1 + s.r + 16, y: y(s.belt - 22) },
    spokes: s.spokes,
    offroad: s.offroad,
    skid: s.offroad
      ? `M${f(s.L - 30)} ${f(y(s.clr + 4))}L${f(s.L - 2)} ${f(y(s.clr + 16))}L${f(s.L - 1)} ${f(y(s.clr + 24))}L${f(s.L - 34)} ${f(y(s.clr + 12))}Z M${f(4)} ${f(y(s.clr + 18))}L${f(26)} ${f(y(s.clr + 6))}L${f(30)} ${f(y(s.clr + 12))}L${f(6)} ${f(y(s.clr + 26))}Z`
      : undefined,
    glare,
    belt: s.belt,
  };
  cache.set(shape, art);
  return art;
}

/** lighten (+) / darken (-) a hex colour */
export function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const t = k >= 0 ? v + (255 - v) * k : v * (1 + k);
    return Math.round(Math.max(0, Math.min(255, t)));
  });
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
