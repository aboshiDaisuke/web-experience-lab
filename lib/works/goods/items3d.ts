// Procedural 3D goods. Pottery is thrown on a virtual wheel (LatheGeometry profiles),
// wood is carved from deformed boxes, cloth is folded rounded boxes.
// Units: 1 = 1dm (10cm). Every item rests on y = 0, centred on x/z.
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ItemId } from './data';
import {
  bambooTexture,
  glassMaterial,
  glazeMaterial,
  ironMaterial,
  linenMaterial,
  woodMaterial,
  type Glaze,
} from './materials';

const S = 0.1; // cm → dm
type Pt = [number, number]; // [r, y] in cm

const bez = (a: Pt, b: Pt, c: Pt, d: Pt, n: number): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
    ]);
  }
  return out;
};

type Vessel = {
  H: number;
  rimR: number;
  footR: number;
  footH: number;
  /** ring width; 0 = flat base */
  footW: number;
  wall: number;
  floor: number;
  c1: Pt;
  c2: Pt;
};

/** Closed wheel-thrown profile: underside → foot → outer wall → lip → inner wall → well. */
function vessel(v: Vessel) {
  const pts: Pt[] = [];
  const pool: number[] = [];
  const outer: boolean[] = [];
  const push = (p: Pt, pl = 0, o = true) => {
    pts.push([Math.max(0.001, p[0]), p[1]]);
    pool.push(pl);
    outer.push(o);
  };
  const { H, rimR, footR, footH, footW, wall, floor } = v;
  if (footW > 0) {
    push([0, footH * 0.55]);
    push([footR - footW, footH * 0.55]);
    push([footR - footW, 0.18]);
    push([footR - footW + 0.15, 0]);
    push([footR - 0.15, 0]);
    push([footR, 0.18]);
    push([footR, footH * 0.9]);
  } else {
    push([0, 0]);
    push([footR - 0.3, 0]);
  }
  const start: Pt = footW > 0 ? [footR, footH] : [footR, 0.3];
  const curve = bez(start, v.c1, v.c2, [rimR, H - wall * 0.5], 30);
  (footW > 0 ? curve.slice(1) : curve).forEach((p) => push(p));
  // round lip
  const cx = rimR - wall * 0.5;
  const cy = H - wall * 0.5;
  for (let i = 1; i < 8; i++) {
    const a = (i / 8) * Math.PI;
    push([cx + Math.cos(a) * wall * 0.5, cy + Math.sin(a) * wall * 0.5], 0, false);
  }
  // inner wall: offset the outer curve inward
  const inner: Pt[] = [];
  for (let i = curve.length - 1; i >= 1; i--) {
    const p = curve[i];
    const q = curve[Math.max(0, i - 1)];
    let tx = p[0] - q[0];
    let ty = p[1] - q[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const r = p[0] - ty * wall;
    const y = p[1] + tx * wall;
    if (y < footH + floor + 0.2 || r < 0.3) break;
    inner.push([r, y]);
  }
  const well = footH + floor;
  const low = inner[inner.length - 1] ?? [rimR - wall, H - wall];
  inner.push(...bez(low, [low[0] * 0.6, well], [low[0] * 0.3, well], [0, well], 10).slice(1));
  inner.forEach((p) => {
    const t = 1 - Math.min(1, Math.max(0, (p[1] - well) / Math.max(0.6, (H - well) * 0.45)));
    push(p, Math.max(0.02, t * t), false);
  });
  return { pts, pool, outer };
}

function lathe(prof: { pts: Pt[]; pool: number[] }, seg = 96) {
  const g = new T.LatheGeometry(
    prof.pts.map(([r, y]) => new T.Vector2(r * S, y * S)),
    seg,
  );
  const n = prof.pts.length;
  const pool = new Float32Array((seg + 1) * n);
  for (let i = 0; i <= seg; i++) for (let j = 0; j < n; j++) pool[i * n + j] = prof.pool[j];
  g.setAttribute('pool', new T.BufferAttribute(pool, 1));
  return g;
}

/** Re-weld the lathe seam after deforming so normals stay smooth all the way round. */
function weld(g: T.BufferGeometry) {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const m = mergeVertices(g, 1e-5);
  g.dispose();
  m.computeVertexNormals();
  return m;
}

const withPool = (g: T.BufferGeometry, v = 0) => {
  g.setAttribute('pool', new T.BufferAttribute(new Float32Array(g.attributes.position.count).fill(v), 1));
  return g;
};

// ── glazes ──────────────────────────────────────────────────────────────────
const TONO_CLAY = '#7c4f35';
const PORC = '#ece8e0';
const G: Record<string, Omit<Glaze, 'foot' | 'rim'>> = {
  kohiki: { a: '#efe9dc', b: '#e2d9c8', edge: '#c4a086', clay: TONO_CLAY, speck: 1, speckColor: '#4a3020', blush: 0.9, rough: 0.52, coat: 0.3 },
  hai: { a: '#a8a585', b: '#5f7050', edge: '#8a6c4a', clay: TONO_CLAY, runs: 1, speck: 0.3, rough: 0.2, coat: 0.85 },
  ame: { a: '#8a4f24', b: '#43200c', edge: '#c78c42', clay: TONO_CLAY, runs: 0.6, rough: 0.16, coat: 0.95 },
  tetsu: { a: '#3b2a1f', b: '#16110e', edge: '#8e5b2e', clay: TONO_CLAY, speck: 0.5, speckColor: '#9c6a36', runs: 0.5, rough: 0.34, coat: 0.55 },
  shiroM: { a: '#ddd6c9', b: '#cbc1ad', edge: '#b19a7e', clay: TONO_CLAY, speck: 0.7, rough: 0.72, coat: 0 },
  hakuji: { a: '#f4f3ee', b: '#e2ebe8', edge: '#fbfaf6', clay: PORC, rough: 0.1, coat: 1 },
  seihakuji: { a: '#e2ecea', b: '#8fbcb8', edge: '#f2f5f3', clay: PORC, rough: 0.08, coat: 1 },
  ki: { a: '#d6bc72', b: '#aa8434', edge: '#ecdcaa', clay: PORC, rough: 0.2, coat: 0.8, crackle: 0.7 },
  oribe: { a: '#6a9463', b: '#17402a', edge: '#b3c292', clay: PORC, runs: 0.5, rough: 0.18, coat: 0.95 },
  shiro: { a: '#f2efe8', b: '#d8d4c8', edge: '#fbfaf6', clay: PORC, rough: 0.22, coat: 0.75 },
  ruri: { a: '#2d4f88', b: '#0f2452', edge: '#8aa3c9', clay: PORC, rough: 0.14, coat: 1 },
  donKuro: { a: '#2b2623', b: '#141110', edge: '#6e4c31', clay: '#5e4636', speck: 0.7, speckColor: '#8f6c49', rough: 0.44, coat: 0.4 },
  donAme: { a: '#7c4a22', b: '#351a09', edge: '#b37b3b', clay: '#5e4636', runs: 0.7, rough: 0.22, coat: 0.85 },
};
const glaze = (k: string, foot: number, rim: number) => glazeMaterial({ ...G[k], foot: foot * S, rim: rim * S });

// ── builders ────────────────────────────────────────────────────────────────
type Built = { group: T.Group };

function meshOf(g: T.BufferGeometry, m: T.Material) {
  const mesh = new T.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function meshi(v: string) {
  const p = vessel({ H: 7, rimR: 6.25, footR: 2.9, footH: 0.9, footW: 0.55, wall: 0.42, floor: 0.55, c1: [4.6, 0.9], c2: [6.3, 3.4] });
  const k = v === 'hai' ? 'hai' : v === 'ame' ? 'ame' : 'kohiki';
  return [meshOf(lathe(p), glaze(k, 1.25, 7))];
}

function rinka(v: string) {
  const p = vessel({ H: 2.8, rimR: 7.5, footR: 3.6, footH: 0.55, footW: 0.45, wall: 0.36, floor: 0.4, c1: [5.6, 0.7], c2: [7.1, 1.4] });
  const g = lathe(p, 160);
  const pos = g.attributes.position as T.BufferAttribute;
  const pool = g.attributes.pool as T.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const r = Math.hypot(x, z);
    const th = Math.atan2(z, x);
    const f = Math.abs(Math.sin((5 * th) / 2));
    const w = Math.min(1, Math.max(0, (r - 0.45) / 0.3));
    const notch = Math.pow(1 - f, 7) * 0.075 * w;
    const k = 1 - notch;
    pos.setXYZ(i, x * k, y + f * 0.018 * w * w, z * k);
    pool.setX(i, pool.getX(i) + notch * 6);
  }
  const k = v === 'seihakuji' ? 'seihakuji' : v === 'ki' ? 'ki' : 'hakuji';
  return [meshOf(weld(g), glaze(k, 0.75, 2.8))];
}

function nanasun(v: string) {
  const p = vessel({ H: 3.2, rimR: 10.5, footR: 4.8, footH: 0.6, footW: 0.5, wall: 0.45, floor: 0.5, c1: [8.2, 0.7], c2: [10.2, 1.2] });
  return [meshOf(lathe(p, 128), glaze(v === 'shiro' ? 'shiroM' : 'tetsu', 0.9, 3.2))];
}

function shinogi(v: string) {
  const H = 9;
  const p = vessel({ H, rimR: 4.15, footR: 3.5, footH: 0.5, footW: 0.4, wall: 0.36, floor: 0.6, c1: [3.9, 0.9], c2: [4.1, 5] });
  const g = lathe(p, 144);
  const pos = g.attributes.position as T.BufferAttribute;
  const pool = g.attributes.pool as T.BufferAttribute;
  const n = p.pts.length;
  const N = 18;
  for (let i = 0; i < pos.count; i++) {
    const j = i % n;
    if (!p.outer[j]) continue;
    const y = pos.getY(i) / S;
    if (y < 1.0 || y > H - 0.9) continue;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const th = Math.atan2(z, x) + Math.PI;
    const seg = (Math.PI * 2) / N;
    const loc = ((th % seg) + seg) % seg / seg - 0.5; // -0.5..0.5
    const env = Math.min(1, (y - 1.0) / 1.2) * Math.min(1, (H - 0.9 - y) / 0.8);
    const groove = (1 - (loc * 2) ** 2) * env;
    const r = Math.hypot(x, z);
    const k = (r - groove * 0.028) / r;
    pos.setXYZ(i, x * k, pos.getY(i), z * k);
    pool.setX(i, groove * 0.9);
  }
  const k = v === 'shiro' ? 'shiro' : v === 'ruri' ? 'ruri' : 'oribe';
  const mat = glaze(k, 0.8, H);
  const R = 4.1;
  const curve = new T.CatmullRomCurve3(
    [
      [R - 0.3, 7.3],
      [R + 1.6, 7.2],
      [R + 2.8, 5.8],
      [R + 2.6, 3.6],
      [R + 1.4, 2.4],
      [R - 0.3, 2.3],
    ].map(([x, y]) => new T.Vector3(x * S, y * S, 0)),
  );
  const hg = new T.TubeGeometry(curve, 40, 0.5 * S, 12, false);
  hg.scale(1, 1, 0.62);
  return [meshOf(weld(g), mat), meshOf(withPool(hg, 0.2), mat)];
}

function donabe(v: string) {
  const k = v === 'ame' ? 'donAme' : 'donKuro';
  const bodyMat = glaze(k, 1.6, 9.6);
  const body = vessel({ H: 9.6, rimR: 9.6, footR: 6.4, footH: 0.8, footW: 0.8, wall: 0.8, floor: 0.8, c1: [10.8, 1.2], c2: [10.9, 6.8] });
  // lid: underside centre → lip → rim → dome → knob
  const lid: Pt[] = [
    [0, 12.6],
    ...bez([0, 12.6], [4, 12.2], [7.6, 10.8], [8.7, 9.7], 12).slice(1),
    [8.7, 8.7],
    [9.05, 8.6],
    [9.1, 9.5],
    [9.9, 9.6],
    [10.1, 9.9],
    ...bez([10.1, 9.9], [9.6, 12.6], [5.4, 14.3], [1.9, 14.35], 18).slice(1),
    [1.5, 14.5],
    [1.55, 15.2],
    [2.15, 15.6],
    [2.1, 15.95],
    [1.2, 16.05],
    [0, 16.05],
  ];
  const lidG = lathe({ pts: lid, pool: lid.map((p, i) => (i < 13 ? 0 : p[1] > 14.2 ? 0.2 : 0)) });
  const lidMat = glaze(k, 9.4, 16);
  const ears: T.Mesh[] = [];
  for (const s of [-1, 1]) {
    const e = new T.TorusGeometry(1.5 * S, 0.5 * S, 10, 20, Math.PI);
    e.scale(1, 1, 0.75);
    e.rotateX(-Math.PI / 2);
    e.rotateY(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    e.translate(s * 10.3 * S, 7.2 * S, 0);
    ears.push(meshOf(withPool(e, 0.1), bodyMat));
  }
  // steam hole
  const hole = new T.CylinderGeometry(0.25 * S, 0.25 * S, 0.2 * S, 10);
  hole.translate(5.4 * S, 13.55 * S, 0);
  const holeM = new T.Mesh(hole, new T.MeshStandardMaterial({ color: '#120e0c', roughness: 1 }));
  return [meshOf(lathe(body), bodyMat), meshOf(lidG, lidMat), ...ears, holeM];
}

function kyusu(v: string) {
  const k = v === 'seihakuji' ? 'seihakuji' : 'hakuji';
  const mat = glaze(k, 0.7, 7.2);
  const body = vessel({ H: 7.4, rimR: 3.3, footR: 3.6, footH: 0.5, footW: 0.35, wall: 0.3, floor: 0.4, c1: [6.2, 0.6], c2: [6.3, 6.4] });
  const lid: Pt[] = [
    [0, 7.2],
    [2.9, 7.25],
    [2.9, 6.7],
    [3.1, 6.7],
    [3.15, 7.3],
    [3.55, 7.35],
    ...bez([3.55, 7.35], [3.3, 8.2], [2.0, 8.7], [0.8, 8.75], 10).slice(1),
    [0.55, 9.0],
    [0.9, 9.9],
    [0.6, 10.2],
    [0, 10.25],
  ];
  // spout: a tapered hollow tube, tilted up and out
  const sp: Pt[] = [
    [1.15, 0],
    ...bez([1.15, 0], [1.0, 2], [0.62, 3.6], [0.48, 4.8], 10).slice(1),
    [0.3, 4.85],
    ...bez([0.3, 4.85], [0.44, 3.6], [0.8, 2], [0.95, 0.2], 10).slice(1),
  ];
  const spG = lathe({ pts: sp, pool: sp.map(() => 0.1) }, 32);
  spG.rotateZ(0.85);
  spG.translate(-4.6 * S, 3.0 * S, 0);
  // side handle, 90° from the spout
  const hd: Pt[] = [
    [0, 6.0],
    [0.75, 6.0],
    ...bez([0.75, 6.0], [0.9, 4], [1.05, 2], [1.2, 0], 10).slice(1),
  ];
  const hdG = lathe({ pts: hd.reverse(), pool: hd.map(() => 0) }, 20);
  hdG.rotateX(Math.PI / 2 - 0.18);
  hdG.translate(0, 3.4 * S, 5.3 * S);
  return [meshOf(lathe(body), mat), meshOf(lathe({ pts: lid, pool: lid.map(() => 0) }), glaze(k, 6.6, 10.2)), meshOf(spG, mat), meshOf(hdG, mat)];
}

const GLASS: Record<string, [string, number]> = {
  clear: ['#e9f3f0', 1.6],
  aqua: ['#6fb3ab', 0.35],
  amber: ['#c9822c', 0.22],
};

function cup(v: string) {
  const H = 9.5;
  const p = vessel({ H, rimR: 3.75, footR: 3.35, footH: 0.001, footW: 0, wall: 0.24, floor: 0.9, c1: [3.45, 3], c2: [3.7, 6.5] });
  const g = lathe(p, 96);
  const pos = g.attributes.position as T.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const th = Math.atan2(z, x);
    const k = 1 + 0.012 * Math.sin(3 * th + y * 9) + 0.006 * Math.sin(7 * th - y * 20);
    pos.setXYZ(i, x * k, y, z * k);
  }
  const [c, d] = GLASS[v] ?? GLASS.clear;
  const m = meshOf(weld(g), glassMaterial(c, d));
  m.castShadow = false;
  return [m];
}

const SAKURA = { early: '#c28d66', late: '#99603f', ring: 0.32, rough: 0.5, coat: 0.18 };
const KURUMI = { early: '#9a7556', late: '#654634', ring: 0.34, rough: 0.5, coat: 0.12 };

function jar(v: string) {
  const L = v !== 'm';
  const H = L ? 12.4 : 9.4;
  const body = vessel({ H, rimR: 4.3, footR: 4.7, footH: 0.001, footW: 0, wall: 0.3, floor: 0.7, c1: [5.1, 2], c2: [5.2, H - 1.2] });
  const glass = glassMaterial('#e3efeb', 2.2);
  const lid: Pt[] = [
    [0, H + 0.2],
    [3.9, H + 0.2],
    [3.9, H - 0.6],
    [4.05, H - 0.6],
    [4.05, H - 0.05],
    [4.75, H - 0.05],
    [4.95, H + 0.15],
    [4.95, H + 1.35],
    [4.75, H + 1.6],
    [0, H + 1.6],
  ];
  const ring = new T.TorusGeometry(4.05 * S, 0.12 * S, 8, 64);
  ring.rotateX(Math.PI / 2);
  ring.translate(0, (H - 0.3) * S, 0);
  const jarBody = meshOf(lathe(body, 96), glass);
  jarBody.castShadow = false;
  return [
    jarBody,
    meshOf(lathe({ pts: lid, pool: lid.map(() => 0) }, 72), woodMaterial({ ...SAKURA, axis: 'x' })),
    meshOf(ring, new T.MeshStandardMaterial({ color: '#e8e2d6', roughness: 0.6 })),
  ];
}

function board(v: string) {
  const [W, D] = v === 's' ? [27, 15] : [36, 20];
  const s = new T.Shape();
  const r = 2.2;
  const w = W / 2;
  const d = D / 2;
  s.moveTo(-w + r, -d);
  s.lineTo(w - r, -d);
  s.quadraticCurveTo(w, -d, w, -d + r);
  s.lineTo(w, d - r);
  s.quadraticCurveTo(w, d, w - r, d);
  s.lineTo(-w + r, d);
  s.quadraticCurveTo(-w, d, -w, d - r);
  s.lineTo(-w, -d + r);
  s.quadraticCurveTo(-w, -d, -w + r, -d);
  const hole = new T.Path();
  hole.absarc(w - 3, 0, 1.1, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new T.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3, curveSegments: 16 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.25, 0);
  g.scale(S, S, S);
  g.computeVertexNormals();
  return [meshOf(g, woodMaterial(SAKURA))];
}

function spoon() {
  const L = 18;
  const g = new T.BoxGeometry(L, 1, 1, 90, 1, 14);
  const pos = g.attributes.position as T.BufferAttribute;
  const xc = -L / 2 + 3.2;
  const a = 3.2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = (x + L / 2) / L;
    // half-width along the length
    let hw: number;
    if (x < xc + a * 0.95) {
      const e = Math.min(1, Math.abs(x - xc) / a);
      hw = 2.25 * Math.sqrt(Math.max(0.0001, 1 - e * e));
      if (x > xc) hw = Math.max(hw, 0.55);
    } else {
      const t = (x - (xc + a)) / (L / 2 - xc - a);
      hw = 0.55 + 0.32 * Math.min(1, t * 1.1);
      if (t > 0.93) hw *= Math.sqrt(Math.max(0.02, 1 - ((t - 0.93) / 0.07) ** 2));
    }
    const th = x < xc + a ? 0.32 : 0.46 + 0.08 * u;
    let yy = y * th;
    let zz = z * 2 * hw;
    const e2 = ((x - xc) / a) ** 2 + (zz / (hw + 0.001)) ** 2;
    if (x < xc + a && e2 < 1) yy -= 0.85 * (1 - e2);
    if (u > 0.36) yy += 1.4 * ((u - 0.36) / 0.64) ** 2;
    pos.setXYZ(i, x * S, yy * S, zz * S);
  }
  g.computeVertexNormals();
  return [meshOf(g, woodMaterial(KURUMI))];
}

function hashi(v: string) {
  const tint = v === 'kuro' ? '#120f0e' : '#3c120a';
  const mat = woodMaterial({ ...SAKURA, rough: 0.28, coat: 1, tint, tintAmt: v === 'kuro' ? 0.88 : 0.55 });
  const out: T.Mesh[] = [];
  for (const s of [-1, 1]) {
    let g: T.BufferGeometry = new T.CylinderGeometry(0.34 * S, 0.12 * S, 23 * S, 8, 24);
    g = g.toNonIndexed();
    g.computeVertexNormals();
    g.rotateZ(Math.PI / 2);
    g.rotateY(s * 0.03);
    g.translate(0, 0.36 * S, s * 0.55 * S);
    out.push(meshOf(g, mat));
  }
  return out;
}

function zaru() {
  const prof: Pt[] = bez([0, 0.9], [6, 0.9], [9.2, 1.6], [10.4, 4.6], 24);
  const g = new T.LatheGeometry(
    prof.map(([r, y]) => new T.Vector2(r * S, y * S)),
    96,
  );
  const tex = bambooTexture();
  tex.repeat.set(1, 1);
  const mat = new T.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.62 });
  const rimMat = new T.MeshStandardMaterial({ color: '#b8995a', roughness: 0.55 });
  const rim = new T.TorusGeometry(10.45 * S, 0.38 * S, 10, 96);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, 4.6 * S, 0);
  const foot = new T.TorusGeometry(5.4 * S, 0.34 * S, 8, 64);
  foot.rotateX(Math.PI / 2);
  foot.translate(0, 0.45 * S, 0);
  const m = meshOf(g, mat);
  m.castShadow = true;
  return [m, meshOf(rim, rimMat), meshOf(foot, rimMat)];
}

function pan() {
  const prof: Pt[] = [
    [0, 0],
    [7.3, 0],
    [7.7, 0.25],
    ...bez([7.7, 0.25], [8.4, 1.2], [9.4, 2.6], [9.9, 4.0], 12).slice(1),
    [10.05, 4.1],
    [10.0, 4.25],
    [9.7, 4.1],
    ...bez([9.7, 4.0], [9.2, 2.7], [8.2, 1.3], [7.5, 0.5], 12).slice(1),
    [7.2, 0.28],
    [0, 0.28],
  ];
  const mat = ironMaterial();
  const body = lathe({ pts: prof, pool: prof.map(() => 0) }, 96);
  const hs = new T.Shape();
  hs.moveTo(0, -1.0);
  hs.lineTo(15, -0.75);
  hs.quadraticCurveTo(17.5, -0.8, 17.5, 0);
  hs.quadraticCurveTo(17.5, 0.8, 15, 0.75);
  hs.lineTo(0, 1.0);
  const hh = new T.Path();
  hh.absellipse(15.4, 0, 0.9, 0.4, 0, Math.PI * 2, true, 0);
  hs.holes.push(hh);
  const hg = new T.ExtrudeGeometry(hs, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
  hg.translate(0, 0, -0.22);
  hg.rotateX(-Math.PI / 2);
  hg.rotateZ(0.2);
  hg.translate(9.2, 3.3, 0);
  hg.scale(S, S, S);
  hg.computeVertexNormals();
  const rivets = [-0.5, 0.5].map((z) => {
    const r = new T.SphereGeometry(0.28 * S, 10, 8);
    r.scale(1, 0.6, 1);
    r.translate(9.9 * S, 3.55 * S, z * S);
    return meshOf(r, mat);
  });
  return [meshOf(body, mat), meshOf(hg, mat), ...rivets];
}

const LINEN: Record<string, [string, string?]> = {
  kinari: ['#e3d8c4'],
  ai: ['#2c4861'],
  karashi: ['#c49639'],
  sumi: ['#dcd3c2', '#3c3a37'],
  akane: ['#94473a'],
};

function cloth(w: number, h: number, d: number, color: [string, string?], loops = false) {
  const g = new RoundedBoxGeometry(w, h, d, 6, Math.min(h * 0.45, 0.8));
  const pos = g.attributes.position as T.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const top = y > 0 ? 1 : 0;
    const pillow = (1 - (2 * z / d) ** 4) * (1 - (2 * x / w) ** 6) * top;
    const crease = Math.exp(-((x - w * 0.05) ** 2) * 0.8) * top;
    const wob = Math.sin(x * 0.9 + z * 0.4) * 0.05 + Math.sin(z * 1.3) * 0.04;
    pos.setXYZ(i, x * S, (y + h / 2 + pillow * h * 0.18 - crease * 0.12 + wob * top) * S, z * S);
  }
  g.computeVertexNormals();
  const mat = linenMaterial(color[0], color[1]);
  const out: T.Mesh[] = [meshOf(g, mat)];
  // layer lines on the folded edge
  const lineMat = new T.MeshStandardMaterial({ color: new T.Color(color[0]).multiplyScalar(0.72), roughness: 1 });
  const layers = Math.max(2, Math.round(h / 0.45));
  for (let k = 1; k < layers; k++) {
    const lg = new T.BoxGeometry(w * 0.985, 0.05, 0.02);
    lg.translate(0, (h * k) / layers, d / 2 + 0.005);
    lg.scale(S, S, S);
    out.push(new T.Mesh(lg, lineMat));
  }
  // woven name tag
  const tag = new T.BoxGeometry(1.4, 0.08, 2.2);
  tag.translate(-w / 2 + 2.2, h + 0.1 + h * 0.1, d / 2 - 0.4);
  tag.scale(S, S, S);
  out.push(meshOf(tag, new T.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.8 })));
  if (loops) {
    const c = new T.CatmullRomCurve3(
      [
        [-w * 0.3, h + 0.15, -d * 0.15],
        [-w * 0.05, h + 0.3, -d * 0.3],
        [w * 0.25, h + 0.25, -d * 0.1],
        [w * 0.3, h + 0.25, d * 0.15],
        [w * 0.02, h + 0.3, d * 0.3],
        [-w * 0.32, h + 0.18, d * 0.2],
      ].map(([x, y, z]) => new T.Vector3(x * S, y * S, z * S)),
      true,
    );
    const tg = new T.TubeGeometry(c, 80, 0.5 * S, 8, true);
    tg.scale(1, 0.35, 1);
    tg.translate(0, (h + 0.25) * S * 0.65, 0);
    out.push(meshOf(tg, mat));
  }
  return out;
}

const BUILD: Record<ItemId, (v: string) => T.Object3D[]> = {
  meshi,
  rinka,
  nanasun,
  shinogi,
  donabe,
  kyusu,
  cup,
  jar,
  board,
  spoon: () => spoon(),
  hashi,
  zaru: () => zaru(),
  pan: () => pan(),
  fukin: (v) => cloth(20, 1.5, 13, LINEN[v] ?? LINEN.kinari),
  apron: (v) => cloth(30, 3.4, 22, v === 'sumi' ? ['#3d3b39'] : (LINEN[v] ?? LINEN.kinari), true),
};

/** Build an item; returned group rests on y=0, centred on x/z, sized in dm. */
export function buildItem(id: ItemId, v: string): Built & { size: T.Vector3 } {
  const inner = new T.Group();
  BUILD[id](v).forEach((m) => inner.add(m));
  const box = new T.Box3().setFromObject(inner);
  const c = box.getCenter(new T.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);
  const group = new T.Group();
  group.add(inner);
  group.userData.item = id;
  return { group, size: box.getSize(new T.Vector3()) };
}

export function disposeObject(o: T.Object3D) {
  o.traverse((n) => {
    const m = n as T.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      for (const k of ['map', 'bumpMap', 'alphaMap', 'normalMap', 'roughnessMap'] as const) {
        const t = (mat as T.MeshStandardMaterial)[k];
        if (t) t.dispose();
      }
      mat.dispose();
    }
  });
}

/** Crumpled paper cushion ball. */
export function paperBall(seed: number, r: number, color: string) {
  const g = new T.IcosahedronGeometry(r, 2);
  const pos = g.attributes.position as T.BufferAttribute;
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const dirs = Array.from({ length: 9 }, () => new T.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize());
  const amps = dirs.map(() => 0.18 + rnd() * 0.3);
  const v = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    let k = 1;
    dirs.forEach((d, j) => {
      const dd = n.dot(d);
      k -= Math.max(0, dd) ** 6 * amps[j];
    });
    k += Math.sin(n.x * 12.9 + n.y * 7.3 + seed) * Math.sin(n.z * 9.1 + n.x * 3.7) * 0.08;
    v.copy(n).multiplyScalar(r * k);
    v.y *= 0.72;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const m = new T.Mesh(g, new T.MeshStandardMaterial({ color, roughness: 0.96, flatShading: true }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
