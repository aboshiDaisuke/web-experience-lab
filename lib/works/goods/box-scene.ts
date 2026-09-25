// The cart is a cardboard box. Items fall in (gravity, bounce, wobble, a thump that shakes
// their neighbours), fragile pieces get crumpled-paper cushions, the box grows to the next
// courier size, and gift wrapping closes the flaps, wraps paper up the walls and ties a ribbon.
import * as T from 'three';
import type { ItemId } from './data';
import { itemOf } from './data';
import { studioEnvironment } from './env';
import { buildItem, disposeObject, paperBall } from './items3d';
import { cardboardMaterial, makeCanvas, rng, wrapTexture } from './materials';
import type { PackUnit, Packing, Placement } from './pack';


const S = 0.1;
const TH = 0.05; // wall thickness, dm
const G = -32; // gravity, dm/s²

export type BoxView = 'hero' | 'dock' | 'drawer' | 'checkout';
export type BoxSync = { units: PackUnit[]; packing: Packing; arrivals: Record<string, number>; gift: boolean };
export type Seal = { sealed: boolean; label?: { name: string; date: string; slot: string } | null };
export type BoxCtl = {
  sync(s: BoxSync, instant?: boolean): void;
  setView(v: BoxView): void;
  setSeal(s: Seal): void;
  nudge(dx: number): void;
  dispose(): void;
};
type Opts = { reduced: boolean; narrow: boolean; onReady?: () => void };

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
};

type Inst = {
  key: string;
  kind: 'item' | 'paper';
  obj: T.Object3D;
  box: number;
  target: T.Vector3;
  yaw: number;
  pos: T.Vector3;
  vy: number;
  state: 'wait' | 'fall' | 'settle' | 'rest' | 'move' | 'leave';
  t: number;
  arrive: number;
  tilt: T.Quaternion;
  wobAxis: T.Vector3;
  wobAmp: number;
  wobT: number;
  from: T.Vector3;
  height: number;
  foot: [number, number];
  scale: number;
};

// ── printed & stuck-on graphics ─────────────────────────────────────────────
function tex(c: HTMLCanvasElement) {
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function logoCanvas() {
  const [c, x] = makeCanvas(640, 256);
  x.clearRect(0, 0, 640, 256);
  x.fillStyle = 'rgba(58,36,20,0.86)';
  x.strokeStyle = 'rgba(58,36,20,0.86)';
  x.lineWidth = 5;
  x.beginPath();
  x.arc(84, 128, 58, 0, Math.PI * 2);
  x.stroke();
  // bowl mark
  x.beginPath();
  x.moveTo(52, 118);
  x.quadraticCurveTo(84, 176, 116, 118);
  x.closePath();
  x.fill();
  x.fillRect(74, 158, 20, 6);
  x.font = '500 60px "EB Garamond", "Zen Old Mincho", serif';
  x.fillText('MIRAI GOODS', 166, 132, 450);
  x.font = '500 27px "Zen Old Mincho", "Hiragino Mincho ProN", serif';
  x.fillText('暮らしの道具店　みらいぐっず', 168, 180, 440);
  // worn ink
  const r = rng(5);
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(0,0,0,${r() * 0.5})`;
    x.fillRect(r() * 640, r() * 256, 1 + r() * 3, 1 + r() * 2);
  }
  return c;
}
function fragileCanvas() {
  const [c, x] = makeCanvas(256, 160);
  x.fillStyle = '#c8392b';
  x.beginPath();
  x.roundRect(4, 4, 248, 152, 10);
  x.fill();
  x.strokeStyle = '#fff';
  x.lineWidth = 4;
  x.beginPath();
  x.roundRect(12, 12, 232, 136, 6);
  x.stroke();
  // wine glass icon
  x.fillStyle = '#fff';
  x.beginPath();
  x.moveTo(34, 36);
  x.lineTo(74, 36);
  x.quadraticCurveTo(74, 84, 57, 88);
  x.lineTo(57, 116);
  x.lineTo(70, 122);
  x.lineTo(38, 122);
  x.lineTo(51, 116);
  x.lineTo(51, 88);
  x.quadraticCurveTo(34, 84, 34, 36);
  x.fill();
  x.font = '700 38px "Zen Kaku Gothic New", sans-serif';
  x.fillText('ワレモノ', 92, 72);
  x.fillText('注意', 92, 116);
  x.font = '700 16px "Zen Kaku Gothic New", sans-serif';
  x.fillText('FRAGILE', 176, 116);
  return c;
}
function sizeCanvas(size: number, dims: [number, number, number]) {
  const [c, x] = makeCanvas(256, 256);
  x.clearRect(0, 0, 256, 256);
  x.fillStyle = 'rgba(52,34,20,0.85)';
  x.strokeStyle = 'rgba(52,34,20,0.85)';
  x.lineWidth = 4;
  x.strokeRect(20, 20, 216, 216);
  x.font = '700 104px "EB Garamond", Georgia, serif';
  x.textAlign = 'center';
  x.fillText(String(size), 128, 140);
  x.font = '600 26px "Zen Kaku Gothic New", sans-serif';
  x.fillText('サイズ', 128, 182);
  x.font = '500 20px "Zen Kaku Gothic New", sans-serif';
  x.fillText(`${dims[0]}×${dims[1]}×${dims[2]}cm`, 128, 216);
  return c;
}
function arrowsCanvas() {
  const [c, x] = makeCanvas(256, 256);
  x.clearRect(0, 0, 256, 256);
  x.fillStyle = 'rgba(52,34,20,0.8)';
  for (const ox of [70, 150]) {
    x.beginPath();
    x.moveTo(ox, 40);
    x.lineTo(ox + 34, 90);
    x.lineTo(ox + 12, 90);
    x.lineTo(ox + 12, 150);
    x.lineTo(ox - 12, 150);
    x.lineTo(ox - 12, 90);
    x.lineTo(ox - 34, 90);
    x.fill();
  }
  x.fillRect(40, 166, 176, 5);
  x.font = '700 34px "Zen Kaku Gothic New", sans-serif';
  x.textAlign = 'center';
  x.fillText('天地無用', 128, 216);
  return c;
}
function labelCanvas(l: { name: string; date: string; slot: string }) {
  const [c, x] = makeCanvas(512, 320);
  x.fillStyle = '#fbfaf6';
  x.fillRect(0, 0, 512, 320);
  x.fillStyle = '#2a8a5a';
  x.fillRect(0, 0, 512, 44);
  x.fillStyle = '#fff';
  x.font = '700 24px "Zen Kaku Gothic New", sans-serif';
  x.fillText('お届け伝票　MIRAI GOODS', 18, 31);
  x.fillStyle = '#222';
  x.font = '500 18px "Zen Kaku Gothic New", sans-serif';
  x.fillText('お届け先', 18, 78);
  x.font = '700 38px "Zen Kaku Gothic New", sans-serif';
  x.fillText(`${l.name} 様`, 18, 124);
  x.font = '500 22px "Zen Kaku Gothic New", sans-serif';
  x.fillText(`お届け予定　${l.date}`, 18, 168);
  x.fillText(`時間帯　${l.slot}`, 18, 200);
  x.fillStyle = '#111';
  const r = rng(9);
  let px = 18;
  while (px < 330) {
    const w = 2 + Math.floor(r() * 4);
    x.fillRect(px, 226, w, 64);
    px += w + 2 + Math.floor(r() * 4);
  }
  x.strokeStyle = '#c8392b';
  x.lineWidth = 4;
  x.beginPath();
  x.arc(430, 250, 44, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = '#c8392b';
  x.font = '700 22px "Zen Old Mincho", serif';
  x.textAlign = 'center';
  x.fillText('検品', 430, 244);
  x.fillText('済', 430, 272);
  return c;
}

// ── one cardboard box ───────────────────────────────────────────────────────
class BoxRig {
  group = new T.Group();
  body = new T.Group();
  W = 2.5;
  D = 1.8;
  H = 1.3;
  from: [number, number, number] = [2.5, 1.8, 1.3];
  to: [number, number, number] = [2.5, 1.8, 1.3];
  tweenT = 1;
  sizeId = 60;
  parts: Record<string, T.Mesh> = {};
  flaps: { pivot: T.Group; mesh: T.Mesh; side: 'f' | 'b' | 'l' | 'r' }[] = [];
  open = 1;
  openTo = 1;
  wrapT = 0;
  ribbonT = 0;
  tapeT = 0;
  labelT = 0;
  fragile = 0;
  fragileTo = 0;
  thump = 0;
  thumpV = 0;
  logo: T.Mesh;
  frag: T.Mesh;
  sizeMark: T.Mesh;
  sizeTex: T.CanvasTexture;
  arrows: T.Mesh[] = [];
  wrap: T.Mesh;
  ribbons: T.Mesh[] = [];
  bow: T.Group;
  tape: T.Mesh[] = [];
  label: T.Mesh;
  labelTex: T.CanvasTexture | null = null;
  private owned: { dispose(): void }[] = [];

  constructor(
    private shared: {
      outer: T.Material;
      inner: T.Material;
      logoTex: T.Texture;
      fragTex: T.Texture;
      arrowTex: T.Texture;
      wrapMat: T.Material;
      ribbonMat: T.Material;
      tapeMat: T.Material;
      unit: T.BoxGeometry;
      plane: T.PlaneGeometry;
    },
  ) {
    const { outer, inner, unit, plane } = shared;
    const part = (name: string, m: T.Material | T.Material[]) => {
      const mesh = new T.Mesh(unit, m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.parts[name] = mesh;
      this.body.add(mesh);
      return mesh;
    };
    // box faces order: +x, -x, +y, -y, +z, -z
    part('bottom', [outer, outer, inner, outer, outer, outer]);
    part('front', [outer, outer, outer, outer, outer, inner]);
    part('back', [outer, outer, outer, outer, inner, outer]);
    part('left', [inner, outer, outer, outer, outer, outer]);
    part('right', [outer, inner, outer, outer, outer, outer]);
    for (const side of ['l', 'r', 'f', 'b'] as const) {
      const pivot = new T.Group();
      const mesh = new T.Mesh(unit, [outer, outer, side === 'f' || side === 'b' ? outer : outer, inner, outer, outer]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      this.body.add(pivot);
      this.flaps.push({ pivot, mesh, side });
    }
    const decal = (map: T.Texture, opacity = 1) => {
      const m = new T.MeshStandardMaterial({ map, transparent: true, roughness: 0.85, opacity, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
      this.owned.push(m);
      const mesh = new T.Mesh(plane, m);
      mesh.receiveShadow = true;
      this.body.add(mesh);
      return mesh;
    };
    this.logo = decal(shared.logoTex, 0.92);
    this.frag = decal(shared.fragTex);
    const [sc] = makeCanvas(256, 256);
    this.sizeTex = tex(sc);
    this.owned.push(this.sizeTex);
    this.sizeMark = decal(this.sizeTex, 0.9);
    this.arrows = [decal(shared.arrowTex, 0.85), decal(shared.arrowTex, 0.85)];

    this.wrap = new T.Mesh(unit, shared.wrapMat);
    this.wrap.castShadow = true;
    this.wrap.receiveShadow = true;
    this.wrap.visible = false;
    this.group.add(this.wrap);
    for (let i = 0; i < 6; i++) {
      const r = new T.Mesh(unit, shared.ribbonMat);
      r.castShadow = true;
      r.visible = false;
      this.ribbons.push(r);
      this.group.add(r);
    }
    this.bow = this.makeBow();
    this.group.add(this.bow);
    for (let i = 0; i < 3; i++) {
      const tp = new T.Mesh(unit, shared.tapeMat);
      tp.visible = false;
      this.tape.push(tp);
      this.group.add(tp);
    }
    const lm = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4 });
    this.owned.push(lm);
    this.label = new T.Mesh(plane, lm);
    this.label.visible = false;
    this.label.receiveShadow = true;
    this.group.add(this.label);
    this.group.add(this.body);
  }

  private makeBow() {
    const g = new T.Group();
    const m = this.shared.ribbonMat;
    const loop = new T.TorusGeometry(0.13, 0.028, 10, 32);
    loop.scale(1.25, 0.8, 1);
    this.owned.push(loop);
    for (const s of [-1, 1]) {
      const l = new T.Mesh(loop, m);
      l.position.set(s * 0.14, 0.07, 0);
      l.rotation.set(0.35, 0, s * 0.35);
      l.scale.set(1, 1, 0.45);
      l.castShadow = true;
      g.add(l);
    }
    const knotG = new T.SphereGeometry(0.05, 16, 12);
    knotG.scale(1, 0.75, 0.8);
    this.owned.push(knotG);
    const knot = new T.Mesh(knotG, m);
    knot.position.y = 0.04;
    g.add(knot);
    const tailG = new T.BoxGeometry(0.06, 0.006, 0.3);
    tailG.translate(0, 0, 0.15);
    this.owned.push(tailG);
    for (const s of [-1, 1]) {
      const t = new T.Mesh(tailG, m);
      t.position.set(s * 0.03, 0.01, 0);
      t.rotation.set(0, s * 0.45, 0);
      g.add(t);
    }
    g.visible = false;
    return g;
  }

  setSize(id: number, inner: [number, number, number], instant: boolean) {
    const to: [number, number, number] = [inner[0] * S, inner[1] * S, inner[2] * S];
    if (id !== this.sizeId || !this.sizeTex.image || (this.sizeTex.image as HTMLCanvasElement).width === 0) {
      this.sizeTex.image = sizeCanvas(id, inner);
      this.sizeTex.needsUpdate = true;
    }
    this.sizeId = id;
    if (to.every((v, i) => Math.abs(v - this.to[i]) < 1e-4)) return;
    this.from = [this.W, this.D, this.H];
    this.to = to;
    this.tweenT = instant ? 1 : 0;
    if (instant) [this.W, this.D, this.H] = to;
  }

  /** returns true while something is moving */
  step(dt: number, reduced: boolean) {
    let busy = false;
    if (this.tweenT < 1) {
      this.tweenT = Math.min(1, this.tweenT + dt / 0.75);
      const e = ease(this.tweenT);
      this.W = this.from[0] + (this.to[0] - this.from[0]) * e;
      this.D = this.from[1] + (this.to[1] - this.from[1]) * e;
      this.H = this.from[2] + (this.to[2] - this.from[2]) * e;
      busy = true;
    }
    const sp = reduced ? 99 : 1.5;
    if (this.open !== this.openTo) {
      const d = this.openTo - this.open;
      this.open += Math.sign(d) * Math.min(Math.abs(d), dt * sp);
      busy = true;
    }
    if (this.fragile !== this.fragileTo) {
      const d = this.fragileTo - this.fragile;
      this.fragile += Math.sign(d) * Math.min(Math.abs(d), dt * (reduced ? 99 : 3));
      busy = true;
    }
    // thump spring
    if (Math.abs(this.thump) > 1e-4 || Math.abs(this.thumpV) > 1e-4) {
      this.thumpV += (-this.thump * 520 - this.thumpV * 16) * dt;
      this.thump += this.thumpV * dt;
      busy = true;
    } else {
      this.thump = 0;
      this.thumpV = 0;
    }
    this.layout();
    return busy;
  }

  layout() {
    const { W, D, H } = this;
    const t = TH;
    const P = this.parts;
    const set = (m: T.Object3D, s: [number, number, number], p: [number, number, number]) => {
      m.scale.set(...s);
      m.position.set(...p);
    };
    set(P.bottom, [W + 2 * t, t, D + 2 * t], [0, -t / 2, 0]);
    set(P.front, [W + 2 * t, H, t], [0, H / 2, D / 2 + t / 2]);
    set(P.back, [W + 2 * t, H, t], [0, H / 2, -D / 2 - t / 2]);
    set(P.left, [t, H, D], [-W / 2 - t / 2, H / 2, 0]);
    set(P.right, [t, H, D], [W / 2 + t / 2, H / 2, 0]);
    const p = this.open;
    const minor = ease(clamp01((p - 0.42) / 0.58));
    const major = ease(clamp01(p / 0.58));
    const L = D / 2 + t / 2;
    for (const f of this.flaps) {
      const { pivot, mesh, side } = f;
      pivot.rotation.set(0, 0, 0);
      if (side === 'f' || side === 'b') {
        const s = side === 'f' ? 1 : -1;
        pivot.position.set(0, H + t, s * (D / 2 + t));
        mesh.scale.set(W + 2 * t - 0.004, t, L);
        mesh.position.set(0, t / 2, -s * L / 2);
        const a = (side === 'f' ? 2.02 : 1.86) * major;
        pivot.rotation.x = s * a;
      } else {
        const s = side === 'l' ? -1 : 1;
        pivot.position.set(s * (W / 2 + t), H, 0);
        mesh.scale.set(L, t, D - 0.004);
        mesh.position.set(-s * L / 2, t / 2, 0);
        pivot.rotation.z = -s * 2.1 * minor;
      }
    }
    // squash on impact
    const q = 1 - this.thump * 0.6;
    this.body.scale.set(1 + this.thump * 0.25, q, 1 + this.thump * 0.25);

    // printed graphics (hidden under gift paper; the fragile sticker goes on top of it)
    const wrapped = this.wrapT > 0.25;
    this.logo.visible = this.sizeMark.visible = !wrapped;
    this.arrows.forEach((a) => (a.visible = !wrapped));
    const lw = Math.min(W * 0.7, H * 1.5);
    this.logo.scale.set(lw, lw / 2.5, 1);
    this.logo.position.set(-W * 0.08, H * 0.5, D / 2 + t + 0.002);
    const fw = Math.min(W * 0.26, H * 0.5) * (0.4 + 0.6 * this.fragile) * (1 + (1 - this.fragile) * 0.4);
    this.frag.visible = this.fragile > 0.01;
    this.frag.scale.set(fw, fw * 0.625, 1);
    this.frag.rotation.z = -0.06;
    (this.frag.material as T.MeshStandardMaterial).opacity = this.fragile;
    this.frag.position.set(W * 0.34, H * 0.72, D / 2 + t + (this.wrapT > 0.01 ? 0.016 : 0.004));
    const sw = Math.min(D * 0.55, H * 0.7);
    this.sizeMark.scale.set(sw, sw, 1);
    this.sizeMark.rotation.set(0, Math.PI / 2, 0);
    this.sizeMark.position.set(W / 2 + t + 0.002, H * 0.5, D * 0.1);
    const aw = Math.min(D * 0.45, H * 0.6);
    this.arrows[0].scale.set(aw, aw, 1);
    this.arrows[0].rotation.set(0, -Math.PI / 2, 0);
    this.arrows[0].position.set(-W / 2 - t - 0.002, H * 0.52, 0);
    this.arrows[1].scale.set(aw * 0.8, aw * 0.8, 1);
    this.arrows[1].rotation.set(0, Math.PI, 0);
    this.arrows[1].position.set(W * 0.3, H * 0.55, -D / 2 - t - 0.002);

    // gift wrap (a slightly larger shell), ribbon, bow
    const OW = W + 2 * t + 0.02;
    const OD = D + 2 * t + 0.02;
    const OH = H + 3 * t + 0.02;
    this.wrap.visible = this.wrapT > 0.001;
    this.wrap.scale.set(OW, OH, OD);
    this.wrap.position.set(0, OH / 2 - t - 0.01, 0);
    (this.wrap.material as T.ShaderMaterial & { userData: { u?: { uReveal: T.IUniform } } }).userData.u!.uReveal.value = this.wrapT;
    const rw = Math.min(0.28, Math.min(W, D) * 0.16);
    const rt = 0.012;
    const rb = clamp01(this.ribbonT * 2);
    const rs = clamp01(this.ribbonT * 2 - 1);
    const top = OH - t - 0.01 + rt / 2;
    const [aTop, bTop, aF, aB, bL, bR] = this.ribbons;
    const vis = this.ribbonT > 0.001;
    for (const r of this.ribbons) r.visible = vis;
    set(aTop, [rw, rt, (OD + 0.02) * Math.max(0.001, rb)], [0, top, 0]);
    set(bTop, [(OW + 0.02) * Math.max(0.001, rb), rt * 1.1, rw], [0, top + 0.002, 0]);
    const sideH = OH * Math.max(0.001, rs);
    set(aF, [rw, sideH, rt], [0, top - sideH / 2, OD / 2 + rt / 2]);
    set(aB, [rw, sideH, rt], [0, top - sideH / 2, -OD / 2 - rt / 2]);
    set(bL, [rt, sideH, rw], [-OW / 2 - rt / 2, top - sideH / 2, 0]);
    set(bR, [rt, sideH, rw], [OW / 2 + rt / 2, top - sideH / 2, 0]);
    const bt = clamp01((this.ribbonT - 0.8) / 0.2);
    this.bow.visible = bt > 0.001;
    const pop = bt < 1 ? ease(bt) * (1 + Math.sin(bt * Math.PI) * 0.25) : 1;
    const bs = Math.min(1.25, Math.max(0.7, Math.min(W, D) * 0.55)) * pop;
    this.bow.scale.set(bs, bs, bs);
    this.bow.position.set(0, top + rt, 0);
    this.bow.rotation.y = 0.35;

    // packing tape along the seam and down both ends
    const tw = 0.2;
    const tl = clamp01(this.tapeT * 1.6);
    const td = clamp01(this.tapeT * 1.6 - 0.6);
    const tt = H + 2 * t + 0.004;
    const [tTop, tL, tR] = this.tape;
    tTop.visible = tl > 0.001;
    set(tTop, [(W + 2 * t + 0.01) * Math.max(0.001, tl), 0.004, tw], [-(W + 2 * t) / 2 * (1 - tl), tt, 0]);
    tL.visible = tR.visible = td > 0.001;
    const dh = H * 0.28 * Math.max(0.001, td);
    set(tL, [0.004, dh, tw], [-W / 2 - t - 0.003, tt - dh / 2, 0]);
    set(tR, [0.004, dh, tw], [W / 2 + t + 0.003, tt - dh / 2, 0]);

    const lt = ease(this.labelT);
    this.label.visible = lt > 0.001;
    const lsz = Math.min(W * 0.46, D * 0.6);
    this.label.scale.set(lsz, lsz * 0.625, 1);
    this.label.rotation.set(-Math.PI / 2, 0, 0.12 * (1 - lt) - 0.06);
    this.label.position.set(W * 0.18, tt + 0.006 + (1 - lt) * 0.6, D * 0.12 - (this.wrapT > 0 ? 0 : 0));
  }

  setLabel(l: { name: string; date: string; slot: string } | null) {
    const m = this.label.material as T.MeshStandardMaterial;
    if (!l) return;
    this.labelTex?.dispose();
    this.labelTex = tex(labelCanvas(l));
    m.map = this.labelTex;
    m.needsUpdate = true;
  }

  dispose() {
    this.owned.forEach((o) => o.dispose());
    this.labelTex?.dispose();
  }
}

// ── the scene ───────────────────────────────────────────────────────────────
export function mountBox(host: HTMLElement, opts: Opts): BoxCtl {
  const { reduced, narrow } = opts;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, narrow ? 1.75 : 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.touchAction = 'pan-y';
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const envRT = studioEnvironment(renderer);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.9;
  const camera = new T.PerspectiveCamera(26, 1, 0.1, 200);

  const key = new T.DirectionalLight('#fff1dc', 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(narrow ? 1024 : 2048, narrow ? 1024 : 2048);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.006;
  scene.add(key, key.target);
  const fill = new T.DirectionalLight('#e6edff', 0.35);
  fill.position.set(4, 3, 5);
  scene.add(fill);

  const disposables: { dispose(): void }[] = [envRT];
  const track = <X extends { dispose(): void }>(x: X) => {
    disposables.push(x);
    return x;
  };
  const ground = new T.Mesh(track(new T.PlaneGeometry(60, 60)), track(new T.ShadowMaterial({ opacity: 0.24, color: '#3a2614' })));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -TH;
  ground.receiveShadow = true;
  scene.add(ground);
  // soft contact shadow texture
  const [bc, bx] = makeCanvas(128, 128);
  const gr = bx.createRadialGradient(64, 64, 10, 64, 64, 64);
  gr.addColorStop(0, 'rgba(40,24,10,0.5)');
  gr.addColorStop(0.6, 'rgba(40,24,10,0.18)');
  gr.addColorStop(1, 'rgba(40,24,10,0)');
  bx.fillStyle = gr;
  bx.fillRect(0, 0, 128, 128);
  const blobTex = track(new T.CanvasTexture(bc));
  const blobMat = track(new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false }));
  const blobGeo = track(new T.PlaneGeometry(1, 1));

  // shared box materials
  const wrapTex = track(wrapTexture());
  const wrapMat = track(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78 }));
  const wrapU = { uReveal: { value: 0 }, uWrap: { value: wrapTex } };
  wrapMat.userData.u = wrapU;
  wrapMat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, wrapU);
    s.vertexShader = 'varying vec3 vLoc;\nvarying vec3 vW;\nvarying vec3 vWN;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position; vW = (modelMatrix*vec4(position,1.0)).xyz; vWN = normalize(mat3(modelMatrix)*normal);');
    s.fragmentShader =
      'varying vec3 vLoc;\nvarying vec3 vW;\nvarying vec3 vWN;\nuniform float uReveal;\nuniform sampler2D uWrap;\n' +
      s.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 an = abs(vWN);
        bool isTop = vWN.y > 0.5;
        bool isBottom = vWN.y < -0.5;
        float side = uReveal - (vLoc.y + 0.5);
        if (!isTop && !isBottom && side < 0.0) discard;
        if (isTop) { float e = max(abs(vLoc.x), abs(vLoc.z)); if (e < 0.5 - (uReveal - 1.0) * 0.55) discard; }
        if (isBottom && uReveal < 0.02) discard;
        vec2 uvw = an.y > 0.5 ? vW.xz : (an.x > 0.5 ? vW.zy : vW.xy);
        vec3 paper = texture2D(uWrap, uvw * 1.6).rgb;
        // fold creases where the paper wraps the top
        float crease = isTop ? smoothstep(0.02, 0.0, abs(abs(vLoc.x) - abs(vLoc.z))) * 0.12 : 0.0;
        // fresh edge while folding
        float edge = !isTop && !isBottom ? smoothstep(0.02, 0.0, side) * 0.25 : 0.0;
        diffuseColor.rgb = paper * (1.0 - crease) * (1.0 + edge);`,
      );
  };
  wrapMat.customProgramCacheKey = () => 'wrap';
  const shared = {
    outer: track(cardboardMaterial(false)),
    inner: track(cardboardMaterial(true)),
    logoTex: track(tex(logoCanvas())),
    fragTex: track(tex(fragileCanvas())),
    arrowTex: track(tex(arrowsCanvas())),
    wrapMat,
    ribbonMat: track(new T.MeshPhysicalMaterial({ color: '#2b4560', roughness: 0.42, sheen: 1, sheenColor: new T.Color('#9fb8d6'), sheenRoughness: 0.35, clearcoat: 0.3 })),
    tapeMat: track(new T.MeshPhysicalMaterial({ color: '#c9a36a', roughness: 0.25, transparent: true, opacity: 0.82, clearcoat: 0.6 })),
    unit: track(new T.BoxGeometry(1, 1, 1)),
    plane: track(new T.PlaneGeometry(1, 1)),
  };
  // refresh printed text once the webfonts are in
  if ('fonts' in document)
    void document.fonts.ready.then(() => {
      if (dead) return;
      shared.logoTex.image = logoCanvas();
      shared.logoTex.needsUpdate = true;
      shared.fragTex.image = fragileCanvas();
      shared.fragTex.needsUpdate = true;
      shared.arrowTex.image = arrowsCanvas();
      shared.arrowTex.needsUpdate = true;
      rigs.forEach(({ rig: r }) => {
        r.sizeTex.image = sizeCanvas(r.sizeId, [Math.round(r.to[0] / S), Math.round(r.to[1] / S), Math.round(r.to[2] / S)]);
        r.sizeTex.needsUpdate = true;
      });
      dirty = true;
    });

  const rigs: { rig: BoxRig; blob: T.Mesh; x: number; xTo: number }[] = [];
  const addRig = () => {
    const rig = new BoxRig(shared);
    const blob = new T.Mesh(blobGeo, blobMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = -TH + 0.002;
    blob.renderOrder = -1;
    scene.add(rig.group, blob);
    const e = { rig, blob, x: 0, xTo: 0 };
    rigs.push(e);
    return e;
  };
  addRig();

  // item prototypes (clones share geometry and materials)
  const protos = new Map<string, { group: T.Group; size: T.Vector3 }>();
  const proto = (id: ItemId, v: string) => {
    const k = `${id}.${v}`;
    let p = protos.get(k);
    if (!p) {
      p = buildItem(id, v);
      protos.set(k, p);
    }
    return p;
  };
  const insts = new Map<string, Inst>();
  const paperGeoms: T.Object3D[] = [];

  let view: BoxView = 'hero';
  let seal: Seal = { sealed: false };
  let gift = false;
  let dirty = true;
  let visible = true;
  let dead = false;
  let raf = 0;
  let last = performance.now();
  let time = 0;
  let yawUser = 0;
  let yawVel = 0;
  const camPos = new T.Vector3(0, 6, 8);
  const camTgt = new T.Vector3(0, 0.5, 0);
  let camInit = false;
  let lastSync: BoxSync | null = null;
  let idle = 0;

  function papersFor(p: Placement, unit: PackUnit, box: number) {
    const out: { key: string; pos: T.Vector3; r: number; color: string }[] = [];
    const r = rng(Math.floor(hash(p.key) * 1e6) + 3);
    const pw = p.pw * S;
    const pd = p.pd * S;
    const ringInset = 0.06;
    const per = 2 * (pw + pd);
    const n = Math.max(6, Math.min(15, Math.round(per / 0.46)));
    const rows = unit.h > 8 ? 2 : 1;
    const cols = ['#c4a275', '#b8956a', '#d2b890', '#c9a878', '#e9e1d2'];
    for (let row = 0; row < rows; row++)
      for (let i = 0; i < n; i++) {
        let s = ((i + r() * 0.35 + row * 0.5) / n) * per;
        let x: number;
        let z: number;
        const hw = pw / 2 - ringInset;
        const hd = pd / 2 - ringInset;
        if (s < pw) {
          x = -pw / 2 + s;
          z = -hd;
        } else if ((s -= pw) < pd) {
          x = hw;
          z = -pd / 2 + s;
        } else if ((s -= pd) < pw) {
          x = pw / 2 - s;
          z = hd;
        } else {
          s -= pw;
          x = -hw;
          z = pd / 2 - s;
        }
        const rad = 0.14 + r() * 0.06;
        const base = (p.y - 1) * S;
        out.push({
          key: `${p.key}~p${row}.${i}`,
          pos: new T.Vector3((rigs[box]?.xTo ?? 0) + p.x * S + x, base + rad * 0.7 + row * unit.h * S * 0.45, p.z * S + z),
          r: rad,
          color: cols[Math.floor(r() * cols.length)],
        });
      }
    return out;
  }

  function spawn(key: string, kind: Inst['kind'], obj: T.Object3D, box: number, target: T.Vector3, yaw: number, arrive: number, instant: boolean, height: number, foot: [number, number]): Inst {
    const r = hash(key);
    const drop = rigs[box].rig.H + 1.6 + r * 0.6;
    const inst: Inst = {
      key,
      kind,
      obj,
      box,
      target,
      yaw,
      pos: instant ? target.clone() : target.clone().add(new T.Vector3((r - 0.5) * 0.5, drop, (hash(key + 'z') - 0.5) * 0.4)),
      vy: 0,
      state: instant ? 'rest' : 'wait',
      t: 0,
      arrive,
      tilt: new T.Quaternion().setFromAxisAngle(new T.Vector3(hash(key + 'a') - 0.5, 0, hash(key + 'b') - 0.5).normalize(), 0.35 + r * 0.45),
      wobAxis: new T.Vector3(1, 0, 0),
      wobAmp: 0,
      wobT: 0,
      from: new T.Vector3(),
      height,
      foot,
      scale: 1,
    };
    obj.visible = instant;
    obj.position.copy(inst.pos);
    obj.rotation.set(0, yaw, 0);
    scene.add(obj);
    insts.set(key, inst);
    return inst;
  }

  function sync(s: BoxSync, instant = false) {
    lastSync = s;
    gift = s.gift;
    const unitBy = new Map(s.units.map((u) => [u.key, u]));
    const boxes = s.units.length ? s.packing.boxes : s.packing.boxes.slice(0, 1);
    // rigs: one per packed box
    while (rigs.length < boxes.length) addRig();
    while (rigs.length > boxes.length) {
      const e = rigs.pop()!;
      scene.remove(e.rig.group, e.blob);
      e.rig.dispose();
    }
    // lay boxes side by side
    let x = 0;
    const widths = boxes.map((b) => b.size.inner[0] * S + 2 * TH);
    const total = widths.reduce((a, w) => a + w, 0) + (widths.length - 1) * 0.5;
    boxes.forEach((b, i) => {
      const e = rigs[i];
      e.xTo = -total / 2 + x + widths[i] / 2;
      if (instant || !camInit) e.x = e.xTo;
      x += widths[i] + 0.5;
      e.rig.setSize(b.size.id, b.size.inner, instant || !camInit);
      const hasFragile = b.placements.some((p) => p.cushion);
      e.rig.fragileTo = hasFragile ? 1 : 0;
      if (instant) e.rig.fragile = e.rig.fragileTo;
    });

    const now = performance.now();
    const seen = new Set<string>();
    boxes.forEach((b, bi) => {
      for (const p of b.placements) {
        const u = unitBy.get(p.key);
        if (!u) continue;
        const tgt = new T.Vector3((rigs[bi].xTo) + p.x * S, p.y * S, p.z * S);
        const yaw = (p.rot ? Math.PI / 2 : 0) + (hash(p.key + 'y') - 0.5) * 0.08;
        const arrive = s.arrivals[p.key] ?? now;
        seen.add(p.key);
        let inst = insts.get(p.key);
        if (!inst) {
          const pr = proto(u.id, u.v);
          const obj = pr.group.clone();
          inst = spawn(p.key, 'item', obj, bi, tgt, yaw, arrive, instant || reduced, u.h * S, [p.pw * S, p.pd * S]);
        } else if (inst.target.distanceToSquared(tgt) > 1e-6 || Math.abs(inst.yaw - yaw) > 1e-3) {
          inst.box = bi;
          inst.target = tgt;
          inst.yaw = yaw;
          if (inst.state === 'rest' || inst.state === 'settle' || inst.state === 'move') {
            if (reduced || instant) {
              inst.pos.copy(tgt);
            } else {
              inst.from.copy(inst.pos);
              inst.state = 'move';
              inst.t = -hash(p.key) * 0.25;
            }
          }
        }
        // paper cushions for fragile pieces
        if (p.cushion) {
          for (const pp of papersFor(p, u, bi)) {
            seen.add(pp.key);
            const ex = insts.get(pp.key);
            if (ex) {
              if (ex.target.distanceToSquared(pp.pos) > 1e-6) {
                ex.target = pp.pos;
                ex.box = bi;
                if (reduced || instant) ex.pos.copy(pp.pos);
                else if (ex.state === 'rest' || ex.state === 'settle') {
                  ex.from.copy(ex.pos);
                  ex.state = 'move';
                  ex.t = -hash(pp.key) * 0.25;
                }
              }
              continue;
            }
            const ball = paperBall(Math.floor(hash(pp.key) * 1e5), pp.r, pp.color);
            paperGeoms.push(ball);
            ball.rotation.set(hash(pp.key + 1) * 6, hash(pp.key + 2) * 6, 0);
            spawn(pp.key, 'paper', ball, bi, pp.pos, hash(pp.key + 3) * 6, arrive - 260 + hash(pp.key) * 200, instant || reduced, pp.r, [pp.r, pp.r]);
          }
        }
      }
    });
    // removed
    for (const inst of insts.values()) {
      if (seen.has(inst.key)) continue;
      if (inst.state === 'leave') continue;
      if (reduced || instant || !inst.obj.visible) {
        removeInst(inst);
      } else {
        inst.state = 'leave';
        inst.t = 0;
        inst.from.copy(inst.pos);
      }
    }
    idle = 0;
    dirty = true;
    kick();
  }

  function removeInst(inst: Inst) {
    scene.remove(inst.obj);
    if (inst.kind === 'paper') {
      disposeObject(inst.obj);
      const i = paperGeoms.indexOf(inst.obj);
      if (i >= 0) paperGeoms.splice(i, 1);
    }
    insts.delete(inst.key);
  }

  const q = new T.Quaternion();
  const qYaw = new T.Quaternion();
  const up = new T.Vector3(0, 1, 0);

  function impact(inst: Inst, v: number) {
    const e = rigs[inst.box];
    if (!e) return;
    const k = Math.min(1, Math.abs(v) / 14) * (inst.kind === 'paper' ? 0.15 : 1);
    e.rig.thumpV -= k * 0.9;
    // neighbours underneath get a little jolt
    if (inst.kind === 'item')
      for (const o of insts.values()) {
        if (o === inst || o.box !== inst.box || o.state === 'wait' || o.state === 'leave') continue;
        const dx = Math.abs(o.target.x - inst.target.x);
        const dz = Math.abs(o.target.z - inst.target.z);
        const near = dx < (o.foot[0] + inst.foot[0]) * 0.55 && dz < (o.foot[1] + inst.foot[1]) * 0.55;
        if (!near) continue;
        const below = o.target.y + o.height <= inst.target.y + 0.02;
        const amp = (below ? 0.07 : 0.03) * k * (o.kind === 'paper' ? 2 : 1);
        o.wobAmp = Math.max(o.wobAmp, amp);
        o.wobT = 0;
        o.wobAxis.set(inst.target.z - o.target.z, 0, o.target.x - inst.target.x).normalize();
        if (o.wobAxis.lengthSq() < 0.5) o.wobAxis.set(1, 0, 0);
        if (o.state === 'rest') o.state = 'settle';
      }
  }

  function stepInsts(dt: number) {
    const now = performance.now();
    let busy = false;
    const open = rigs.every((e) => e.rig.open > 0.9);
    for (const inst of [...insts.values()]) {
      const o = inst.obj;
      switch (inst.state) {
        case 'wait': {
          busy = true;
          if (now >= inst.arrive && open) {
            inst.state = 'fall';
            inst.vy = -2;
            o.visible = true;
          }
          break;
        }
        case 'fall': {
          busy = true;
          inst.vy += G * dt;
          inst.pos.y += inst.vy * dt;
          const k = 1 - Math.exp(-dt * 7);
          inst.pos.x += (inst.target.x - inst.pos.x) * k;
          inst.pos.z += (inst.target.z - inst.pos.z) * k;
          if (inst.pos.y <= inst.target.y) {
            inst.pos.y = inst.target.y;
            const v = inst.vy;
            if (Math.abs(v) > 2.2 && inst.kind === 'item') {
              inst.vy = -v * (itemOf(inst.key.split('.')[0] as ItemId).soft ? 0.08 : 0.24);
              impact(inst, v);
            } else {
              if (Math.abs(v) > 0.5) impact(inst, v);
              inst.state = 'settle';
              inst.t = 0;
              inst.wobAmp = Math.max(inst.wobAmp, inst.kind === 'paper' ? 0.2 : 0.09);
              inst.wobT = 0;
              inst.wobAxis.set(hash(inst.key + 'w') - 0.5, 0, hash(inst.key + 'v') - 0.5).normalize();
              inst.pos.x = inst.target.x;
              inst.pos.z = inst.target.z;
            }
          }
          break;
        }
        case 'settle': {
          inst.t += dt;
          if (inst.wobAmp < 0.002 && inst.t > 0.3) inst.state = 'rest';
          busy = true;
          break;
        }
        case 'move': {
          busy = true;
          inst.t += dt / 0.7;
          const t = clamp01(inst.t);
          const e = ease(t);
          inst.pos.lerpVectors(inst.from, inst.target, e);
          inst.pos.y += Math.sin(t * Math.PI) * 0.9;
          if (inst.t >= 1) {
            inst.pos.copy(inst.target);
            inst.state = 'settle';
            inst.wobAmp = 0.04;
            inst.wobT = 0;
          }
          break;
        }
        case 'leave': {
          busy = true;
          inst.t += dt / 0.45;
          const e = ease(inst.t);
          inst.pos.copy(inst.from).addScaledVector(up, e * 2.2);
          inst.scale = 1 - e;
          if (inst.t >= 1) {
            removeInst(inst);
            continue;
          }
          break;
        }
      }
      // wobble (damped rocking about a horizontal axis)
      let wob = 0;
      if (inst.wobAmp > 0.0005) {
        inst.wobT += dt;
        wob = inst.wobAmp * Math.exp(-inst.wobT * 5) * Math.sin(inst.wobT * 22);
        if (inst.wobT > 1.2) inst.wobAmp = 0;
        busy = true;
      }
      o.position.copy(inst.pos);
      qYaw.setFromAxisAngle(up, inst.yaw);
      if (inst.state === 'fall' || inst.state === 'wait') {
        const h = clamp01((inst.pos.y - inst.target.y) / 1.6);
        q.identity().slerp(inst.tilt, h);
        o.quaternion.copy(q).multiply(qYaw);
      } else {
        q.setFromAxisAngle(inst.wobAxis, wob);
        o.quaternion.copy(q).multiply(qYaw);
      }
      o.scale.setScalar(inst.scale);
    }
    return busy;
  }

  // ── camera ────────────────────────────────────────────────────────────────
  const tmpV = new T.Vector3();
  const basisR = new T.Vector3();
  const basisU = new T.Vector3();
  const basisF = new T.Vector3();
  function frame(dt: number) {
    if (!rigs.length) return false;
    const pts: T.Vector3[] = [];
    let maxH = 0;
    for (const e of rigs) {
      const r = e.rig;
      // show growth: in the big views never frame smaller than the 80-size box
      const ref = view !== 'dock';
      const W = Math.max(r.to[0], ref ? 3.3 : 0);
      const D = Math.max(r.to[1], ref ? 2.4 : 0);
      const H = Math.max(r.to[2], ref ? 1.9 : 0);
      maxH = Math.max(maxH, H);
      const x0 = e.xTo;
      const hw = W / 2 + TH;
      const hd = D / 2 + TH;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, H]) pts.push(new T.Vector3(x0 + sx * hw, y, sz * hd));
      // open flaps
      const L = D / 2;
      const major = ease(clamp01(r.open / 0.58));
      const minor = ease(clamp01((r.open - 0.42) / 0.58));
      const af = 2.02 * major;
      const ab = 1.86 * major;
      const as = 2.1 * minor;
      for (const sx of [-1, 1]) {
        pts.push(new T.Vector3(x0 + sx * hw, H + L * Math.sin(af), hd - L * Math.cos(af)));
        pts.push(new T.Vector3(x0 + sx * hw, H + L * Math.sin(ab), -hd + L * Math.cos(ab)));
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push(new T.Vector3(x0 + sx * (hw - L * Math.cos(as)), H + L * Math.sin(as), sz * hd));
      if (r.ribbonT > 0) pts.push(new T.Vector3(x0, H + 0.45, 0));
    }
    // look down into an open box; lower the eye once it is closed and wrapped
    const openAvg = rigs.reduce((a, e) => a + e.rig.open, 0) / rigs.length;
    const elOpen = view === 'dock' ? 1.0 : view === 'hero' ? 0.96 : 0.94;
    const el = 0.6 + (elOpen - 0.6) * ease(openAvg);
    const sway = view === 'hero' && !reduced ? Math.sin(time * 0.25) * 0.08 : 0;
    const az = 0.24 + yawUser + sway;
    const dir = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    basisF.copy(dir).negate();
    basisR.crossVectors(basisF, new T.Vector3(0, 1, 0)).normalize();
    basisU.crossVectors(basisR, basisF).normalize();
    const box3 = new T.Box3().setFromPoints(pts);
    const tgt = box3.getCenter(new T.Vector3());
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      tmpV.subVectors(p, tgt);
      const x = tmpV.dot(basisR);
      const y = tmpV.dot(basisU);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    tgt.addScaledVector(basisR, (minX + maxX) / 2).addScaledVector(basisU, (minY + maxY) / 2);
    const fill = view === 'dock' ? 0.97 : view === 'hero' ? 0.8 : view === 'checkout' ? 0.84 : 0.9;
    const tv = Math.tan((camera.fov * Math.PI) / 360) * fill;
    const th = tv * camera.aspect;
    let dist = 0;
    for (const p of pts) {
      tmpV.subVectors(p, tgt);
      const x = Math.abs(tmpV.dot(basisR));
      const y = Math.abs(tmpV.dot(basisU));
      const z = tmpV.dot(dir);
      dist = Math.max(dist, z + x / th, z + y / tv);
    }
    // hero: leave room for the caption chips at the bottom
    if (view === 'hero') tgt.addScaledVector(basisU, -dist * tv * 0.06);
    const want = tgt.clone().addScaledVector(dir, dist);
    if (!camInit) {
      camPos.copy(want);
      camTgt.copy(tgt);
      camInit = true;
    }
    const k = reduced ? 1 : 1 - Math.exp(-dt * 4);
    const moving = camPos.distanceToSquared(want) > 1e-6 || camTgt.distanceToSquared(tgt) > 1e-6;
    camPos.lerp(want, k);
    camTgt.lerp(tgt, k);
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    // key light and its shadow frustum
    const cx = (box3.min.x + box3.max.x) / 2;
    const width = box3.max.x - box3.min.x;
    const depth = box3.max.z - box3.min.z;
    key.position.set(cx - 3.2, maxH + 6, 3.2);
    key.target.position.set(cx, 0, 0);
    const ext = Math.max(width, depth) * 0.8 + 1.2;
    const sc = key.shadow.camera;
    if (sc.right !== ext) {
      sc.left = -ext;
      sc.right = ext;
      sc.top = ext;
      sc.bottom = -ext;
      sc.near = 0.5;
      sc.far = 30;
      sc.updateProjectionMatrix();
    }
    for (const e of rigs) {
      e.blob.scale.set(e.rig.W * 1.55 + 0.5, e.rig.D * 1.55 + 0.5, 1);
      e.blob.position.x = e.x;
    }
    return moving || sway !== 0;
  }

  function resize() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
    kick();
  }

  function stepSeal(dt: number) {
    let busy = false;
    const count = insts.size;
    const pending = [...insts.values()].some((i) => i.state === 'wait' || i.state === 'fall');
    if (!pending) idle += dt;
    else idle = 0;
    const wantClosed = seal.sealed || (gift && count > 0 && !pending && idle > 0.35);
    for (const e of rigs) {
      const r = e.rig;
      if (Math.abs(e.x - e.xTo) > 1e-4) {
        e.x += (e.xTo - e.x) * (1 - Math.exp(-dt * 5));
        r.group.position.x = e.x;
        busy = true;
      } else {
        e.x = e.xTo;
        r.group.position.x = e.x;
      }
      const wrapWant = wantClosed && gift ? 2 : 0;
      const tapeWant = wantClosed && !gift ? 1 : 0;
      const sp = reduced ? 99 : 1;
      // sequence: open ⇄ closed ⇄ wrapped ⇄ ribbon
      if (!wantClosed) {
        // unwrap first, then open
        if (r.ribbonT > 0) r.ribbonT = Math.max(0, r.ribbonT - dt * 3 * sp);
        else if (r.wrapT > 0) r.wrapT = Math.max(0, r.wrapT - dt * 3 * sp);
        else if (r.tapeT > 0) r.tapeT = Math.max(0, r.tapeT - dt * 3 * sp);
        else r.openTo = 1;
        r.labelT = Math.max(0, r.labelT - dt * 3 * sp);
      } else {
        r.openTo = 0;
        if (r.open <= 0.001) {
          if (wrapWant > 0 && r.tapeT <= 0) {
            if (r.wrapT < 2) r.wrapT = Math.min(2, r.wrapT + dt * 1.5 * sp);
            else r.ribbonT = Math.min(1, r.ribbonT + dt * 1.1 * sp);
          } else if (wrapWant === 0 && r.wrapT > 0) {
            if (r.ribbonT > 0) r.ribbonT = Math.max(0, r.ribbonT - dt * 3 * sp);
            else r.wrapT = Math.max(0, r.wrapT - dt * 3 * sp);
          } else if (tapeWant) r.tapeT = Math.min(1, r.tapeT + dt * 1.2 * sp);
          const doneWrap = gift ? r.ribbonT >= 1 : r.tapeT >= 1;
          if (seal.label && doneWrap) r.labelT = Math.min(1, r.labelT + dt * 1.6 * sp);
        }
      }
      if (r.step(dt, reduced)) busy = true;
      if (r.ribbonT > 0 && r.ribbonT < 1) busy = true;
      if (r.wrapT > 0 && r.wrapT < 2) busy = true;
      if (r.tapeT > 0 && r.tapeT < 1) busy = true;
      if (r.labelT > 0 && r.labelT < 1) busy = true;
      if (wantClosed !== (r.openTo === 0) || (!wantClosed && (r.ribbonT > 0 || r.wrapT > 0 || r.tapeT > 0 || r.labelT > 0))) busy = true;
      if (wantClosed && r.open > 0) busy = true;
    }
    if (gift && count > 0 && !pending && idle <= 0.4) busy = true;
    return busy;
  }

  let ready = false;
  const tick = () => {
    raf = 0;
    if (dead) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    if (!visible || document.hidden) return;
    if (Math.abs(yawVel) > 1e-4) {
      yawUser += yawVel * dt;
      yawVel *= Math.exp(-dt * 6);
      yawUser *= Math.exp(-dt * 0.6);
    } else if (Math.abs(yawUser) > 1e-4) yawUser *= Math.exp(-dt * 1.5);
    let busy = stepSeal(dt);
    if (stepInsts(dt)) busy = true;
    if (frame(dt)) busy = true;
    if (Math.abs(yawUser) > 1e-4) busy = true;
    if (busy || dirty) {
      renderer.render(scene, camera);
      dirty = false;
      if (!ready) {
        ready = true;
        opts.onReady?.();
      }
    }
    if (busy) raf = requestAnimationFrame(tick);
  };
  function kick() {
    if (!raf && !dead) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) kick();
  });
  io.observe(host);
  const onVis = () => !document.hidden && kick();
  document.addEventListener('visibilitychange', onVis);
  resize();

  return {
    sync,
    setView(v) {
      view = v;
      dirty = true;
      kick();
    },
    setSeal(s) {
      seal = s;
      if (s.label) rigs.forEach((e) => e.rig.setLabel(s.label!));
      idle = 0;
      dirty = true;
      kick();
    },
    nudge(dx) {
      yawVel += dx;
      kick();
    },
    dispose() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      for (const inst of [...insts.values()]) removeInst(inst);
      protos.forEach((p) => disposeObject(p.group));
      rigs.forEach((e) => e.rig.dispose());
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      void lastSync;
    },
  };
}
