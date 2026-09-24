// 竹かご: a tiny rigid-body world (compound circles vs. basket walls) drawn on a fixed
// overlay canvas, so produce can be flicked from the display tables and pile up.
import type { ProduceId } from './data';
import { BASKET, BASKET_PAD, paintBasket, paintProduce, spec } from './paint';

type Circ = { x: number; y: number; r: number };
type Body = {
  id: ProduceId;
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  w: number;
  im: number;
  iI: number;
  circles: Circ[];
  R: number;
  ox: number;
  oy: number;
  counted: boolean;
  held: boolean;
  still: number;
  asleep: boolean;
  wc: Circ[];
  age: number;
};
type Contact = {
  A: Body | null;
  B: Body;
  nx: number;
  ny: number;
  px: number;
  py: number;
  d: number;
  jn: number;
  jt: number;
  bounce: number;
  kn: number;
  kt: number;
  rax: number;
  ray: number;
  rbx: number;
  rby: number;
  imA: number;
  iIA: number;
  imB: number;
  iIB: number;
};

/** units per produce design-unit inside the basket */
const K = 1.65;
/** local units above the rim that the well box reserves */
export const WELL = { top: 290, height: 760 };
const G_SCREEN = 2700;
const MAX_BODIES = 30;

function wallSegments() {
  const segs: [number, number, number, number][] = [];
  const curve = (p: number[][], n: number) => {
    let prev = p[0];
    for (let i = 1; i <= n; i++) {
      const t = i / n,
        u = 1 - t;
      const q = [
        u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
        u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
      ];
      segs.push([prev[0], prev[1], q[0], q[1]]);
      prev = q;
    }
  };
  curve([[26, -6], [36, 172], [74, 330], [184, 380]], 8);
  curve([[184, 380], [334, 428], [666, 428], [816, 380]], 8);
  curve([[816, 380], [926, 330], [964, 172], [974, -6]], 8);
  return segs;
}
const WALLS = wallSegments();
const WALL_R = 12;

export type BasketCtl = {
  throwFrom: (id: ProduceId, x: number, y: number) => void;
  grab: (id: ProduceId, e: PointerEvent) => void;
  remove: (id: ProduceId) => void;
  clear: () => void;
  dispose: () => void;
};

export function mountBasket(o: {
  well: HTMLElement;
  section: HTMLElement;
  onLand: (id: ProduceId) => void;
  reduced: boolean;
}): BasketCtl {
  const cv = document.createElement('canvas');
  cv.className = 'yy-basket-overlay';
  cv.setAttribute('aria-hidden', 'true');
  Object.assign(cv.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '45',
    display: 'none',
  });
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  const dpr = Math.min(2, devicePixelRatio || 1);
  let vw = 0,
    vh = 0;
  const resize = () => {
    vw = innerWidth;
    vh = innerHeight;
    cv.width = Math.round(vw * dpr);
    cv.height = Math.round(vh * dpr);
    dirty = true;
  };
  let dirty = true;
  resize();
  addEventListener('resize', resize);

  let bodies: Body[] = [];
  let rect = o.well.getBoundingClientRect();
  let S = rect.width / 1000;
  let back: HTMLCanvasElement | null = null,
    front: HTMLCanvasElement | null = null,
    paintedS = 0;
  const toLocal = (cx: number, cy: number) => ({ x: (cx - rect.left) / S, y: (cy - rect.top) / S - WELL.top });
  const measure = () => {
    rect = o.well.getBoundingClientRect();
    S = Math.max(0.05, rect.width / 1000);
    if (Math.abs(paintedS - S) > 0.02) {
      paintedS = S;
      back = paintBasket(S * dpr, 'back');
      front = paintBasket(S * dpr, 'front');
      dirty = true;
    }
  };
  measure();

  const sprite = (id: ProduceId) => paintProduce(id, Math.max(0.3, Math.round(K * S * dpr * 10) / 10));

  function make(id: ProduceId, x: number, y: number): Body {
    const sp = spec[id];
    let cx = 0,
      cy = 0,
      m = 0;
    for (const [x0, y0, r] of sp.circles) {
      const mm = r * r;
      cx += x0 * mm;
      cy += y0 * mm;
      m += mm;
    }
    cx /= m;
    cy /= m;
    const circles = sp.circles.map(([x0, y0, r]) => ({ x: (x0 - cx) * K, y: (y0 - cy) * K, r: r * K * 0.96 }));
    let I = 0,
      mass = 0,
      R = 0;
    for (const c of circles) {
      const mm = c.r * c.r * 0.001;
      mass += mm;
      I += mm * (c.r * c.r * 0.5 + c.x * c.x + c.y * c.y);
      R = Math.max(R, Math.hypot(c.x, c.y) + c.r);
    }
    return {
      id,
      x,
      y,
      a: 0,
      vx: 0,
      vy: 0,
      w: 0,
      im: 1 / mass,
      iI: 1 / I,
      circles,
      R,
      ox: cx * K,
      oy: cy * K,
      counted: false,
      held: false,
      still: 0,
      asleep: false,
      wc: circles.map((c) => ({ ...c })),
      age: 0,
    };
  }
  const gLocal = () => G_SCREEN / S;

  const aim = (b: Body) => {
    // nudge the flight so a reasonable flick lands in the basket
    const g = gLocal();
    const ty = -30;
    const disc = b.vy * b.vy - 2 * g * (b.y - ty);
    let t: number;
    if (disc < 0 || b.y > 500) {
      auto(b);
      return;
    }
    t = (-b.vy + Math.sqrt(disc)) / g;
    if (!(t > 0.05)) t = 0.3;
    const need = (500 - b.x) / t;
    b.vx = b.vx + (need - b.vx) * 0.78;
  };
  const auto = (b: Body) => {
    const g = gLocal();
    const tx = 500 + (Math.random() - 0.5) * 360,
      ty = -40;
    const distPx = Math.hypot(tx - b.x, ty - b.y) * S;
    let T = Math.min(1.05, Math.max(0.55, 0.42 + distPx / 2300));
    T = Math.max(T, Math.sqrt((2 * Math.max(0, b.y - ty)) / g) * 1.3);
    b.vx = (tx - b.x) / T;
    b.vy = (ty - b.y - 0.5 * g * T * T) / T;
    b.w = (Math.random() - 0.5) * 9;
  };

  const spawnCounted = (id: ProduceId) => o.onLand(id);

  function throwFrom(id: ProduceId, cx: number, cy: number) {
    measure();
    if (bodies.length >= MAX_BODIES) return spawnCounted(id);
    if (o.reduced) {
      const b = make(id, 500 + (Math.random() - 0.5) * 300, -140);
      b.a = (Math.random() - 0.5) * 1.2;
      bodies.push(b);
      wake();
      start();
      return;
    }
    const p = toLocal(cx, cy);
    const b = make(id, p.x, p.y);
    b.a = (Math.random() - 0.5) * 0.6;
    auto(b);
    bodies.push(b);
    wake();
    start();
  }

  let held: Body | null = null;
  let samples: { x: number; y: number; t: number }[] = [];
  let downAt = { x: 0, y: 0 };
  let moved = false;
  function grab(id: ProduceId, e: PointerEvent) {
    measure();
    downAt = { x: e.clientX, y: e.clientY };
    moved = false;
    samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    const pendingId = id;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 6) {
        moved = true;
        if (bodies.length < MAX_BODIES) {
          const p = toLocal(ev.clientX, ev.clientY);
          held = make(pendingId, p.x, p.y);
          held.held = true;
          bodies.push(held);
          document.documentElement.classList.add('yy-grabbing');
          start();
        }
      }
      samples.push({ x: ev.clientX, y: ev.clientY, t: performance.now() });
      if (samples.length > 8) samples.shift();
      if (held) {
        const p = toLocal(ev.clientX, ev.clientY);
        const last = samples[samples.length - 2];
        held.x = p.x;
        held.y = p.y;
        if (last) held.a += (ev.clientX - last.x) * 0.004;
        dirty = true;
      }
    };
    const up = (ev: PointerEvent) => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      document.documentElement.classList.remove('yy-grabbing');
      if (!moved) {
        throwFrom(pendingId, ev.clientX, ev.clientY);
        return;
      }
      if (!held) {
        spawnCounted(pendingId);
        return;
      }
      const b = held;
      held = null;
      b.held = false;
      const now = performance.now();
      const recent = samples.filter((s) => now - s.t < 110);
      const s0 = recent[0] ?? samples[0],
        s1 = samples[samples.length - 1];
      const dt = Math.max(0.016, (s1.t - s0.t) / 1000);
      let vx = (s1.x - s0.x) / dt,
        vy = (s1.y - s0.y) / dt;
      const sp = Math.hypot(vx, vy);
      if (sp > 5200) {
        vx *= 5200 / sp;
        vy *= 5200 / sp;
      }
      b.vx = vx / S;
      b.vy = vy / S;
      b.w = vx * 0.004 / 1;
      const over = ev.clientX > rect.left && ev.clientX < rect.right && ev.clientY < rect.bottom && ev.clientY > rect.top - 120;
      if (o.reduced) {
        b.x = 500 + (Math.random() - 0.5) * 300;
        b.y = -140;
        b.vx = b.vy = 0;
      } else if (over && sp < 900) {
        b.vx *= 0.3;
        b.vy = Math.min(b.vy, 0) * 0.3;
      } else if (sp < 400) auto(b);
      else aim(b);
      wake();
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  }

  function remove(id: ProduceId) {
    for (let i = bodies.length - 1; i >= 0; i--)
      if (bodies[i].id === id && bodies[i].counted) {
        bodies.splice(i, 1);
        break;
      }
    wake();
    dirty = true;
    start();
  }
  function clear() {
    bodies = [];
    dirty = true;
    start();
  }
  function wake() {
    for (const b of bodies) {
      b.asleep = false;
      b.still = 0;
    }
  }

  // ---------- physics ----------
  const updateWorld = (b: Body) => {
    const c = Math.cos(b.a),
      s = Math.sin(b.a);
    for (let i = 0; i < b.circles.length; i++) {
      const q = b.circles[i];
      b.wc[i].x = b.x + q.x * c - q.y * s;
      b.wc[i].y = b.y + q.x * s + q.y * c;
    }
  };
  const contacts: Contact[] = [];
  function addContact(A: Body | null, B: Body, nx: number, ny: number, px: number, py: number, d: number) {
    const staticA = !A || A.asleep || A.held;
    const staticB = B.asleep || B.held;
    const imA = staticA ? 0 : A!.im,
      iIA = staticA ? 0 : A!.iI;
    const imB = staticB ? 0 : B.im,
      iIB = staticB ? 0 : B.iI;
    if (imA + imB === 0) return;
    const rax = A ? px - A.x : 0,
      ray = A ? py - A.y : 0;
    const rbx = px - B.x,
      rby = py - B.y;
    const rnA = rax * ny - ray * nx,
      rnB = rbx * ny - rby * nx;
    const kn = imA + imB + iIA * rnA * rnA + iIB * rnB * rnB;
    const tx = -ny,
      ty = nx;
    const rtA = rax * ty - ray * tx,
      rtB = rbx * ty - rby * tx;
    const kt = imA + imB + iIA * rtA * rtA + iIB * rtB * rtB;
    const vax = A ? A.vx - A.w * ray : 0,
      vay = A ? A.vy + A.w * rax : 0;
    const vbx = B.vx - B.w * rby,
      vby = B.vy + B.w * rbx;
    const vn = (vbx - vax) * nx + (vby - vay) * ny;
    contacts.push({ A, B, nx, ny, px, py, d, jn: 0, jt: 0, bounce: vn < -260 ? -0.28 * vn : 0, kn, kt, rax, ray, rbx, rby, imA, iIA, imB, iIB });
  }
  function collide() {
    contacts.length = 0;
    for (const b of bodies) if (!b.held) updateWorld(b);
    for (let i = 0; i < bodies.length; i++) {
      const B = bodies[i];
      if (B.held) continue;
      // walls
      if (!B.asleep && B.y > -B.R - 40)
        for (const q of B.wc)
          for (const [x0, y0, x1, y1] of WALLS) {
            const ex = x1 - x0,
              ey = y1 - y0;
            let t = ((q.x - x0) * ex + (q.y - y0) * ey) / (ex * ex + ey * ey);
            t = Math.max(0, Math.min(1, t));
            const cx = x0 + ex * t,
              cy = y0 + ey * t;
            const dx = q.x - cx,
              dy = q.y - cy;
            const dist = Math.hypot(dx, dy);
            const rr = q.r + WALL_R;
            if (dist < rr && dist > 1e-6) {
              const nx = dx / dist,
                ny = dy / dist;
              addContact(null, B, nx, ny, q.x - nx * q.r, q.y - ny * q.r, rr - dist);
            }
          }
      for (let j = i + 1; j < bodies.length; j++) {
        const A = bodies[j];
        if (A.held || (A.asleep && B.asleep)) continue;
        if (Math.hypot(A.x - B.x, A.y - B.y) > A.R + B.R) continue;
        for (const qa of A.wc)
          for (const qb of B.wc) {
            const dx = qb.x - qa.x,
              dy = qb.y - qa.y;
            const dist = Math.hypot(dx, dy);
            const rr = qa.r + qb.r;
            if (dist < rr && dist > 1e-6) {
              const nx = dx / dist,
                ny = dy / dist;
              // wake a sleeper when hit hard
              const rel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
              if (rel < -220) {
                A.asleep = false;
                B.asleep = false;
              }
              addContact(A, B, nx, ny, qa.x + nx * qa.r, qa.y + ny * qa.r, rr - dist);
            }
          }
      }
    }
  }
  function solve() {
    for (let it = 0; it < 8; it++)
      for (const c of contacts) {
        const { A, B, nx, ny } = c;
        const vax = A ? A.vx - A.w * c.ray : 0,
          vay = A ? A.vy + A.w * c.rax : 0;
        const vbx = B.vx - B.w * c.rby,
          vby = B.vy + B.w * c.rbx;
        const dvx = vbx - vax,
          dvy = vby - vay;
        const vn = dvx * nx + dvy * ny;
        let l = (c.bounce - vn) / c.kn;
        const nj = Math.max(0, c.jn + l);
        l = nj - c.jn;
        c.jn = nj;
        apply(c, nx * l, ny * l);
        // friction
        const tx = -ny,
          ty = nx;
        const vax2 = A ? A.vx - A.w * c.ray : 0,
          vay2 = A ? A.vy + A.w * c.rax : 0;
        const vt = (B.vx - B.w * c.rby - vax2) * tx + (B.vy + B.w * c.rbx - vay2) * ty;
        let lt = -vt / c.kt;
        const mf = 0.55 * c.jn;
        const nt = Math.max(-mf, Math.min(mf, c.jt + lt));
        lt = nt - c.jt;
        c.jt = nt;
        apply(c, tx * lt, ty * lt);
      }
  }
  function apply(c: Contact, px: number, py: number) {
    if (c.A && c.imA) {
      c.A.vx -= px * c.imA;
      c.A.vy -= py * c.imA;
      c.A.w -= (c.rax * py - c.ray * px) * c.iIA;
    }
    if (c.imB) {
      c.B.vx += px * c.imB;
      c.B.vy += py * c.imB;
      c.B.w += (c.rbx * py - c.rby * px) * c.iIB;
    }
  }
  function correct() {
    for (const c of contacts) {
      const k = Math.max(0, c.d - 0.8) * 0.45;
      const tot = c.imA + c.imB;
      if (!tot) continue;
      if (c.A && c.imA) {
        c.A.x -= c.nx * k * (c.imA / tot);
        c.A.y -= c.ny * k * (c.imA / tot);
      }
      if (c.imB) {
        c.B.x += c.nx * k * (c.imB / tot);
        c.B.y += c.ny * k * (c.imB / tot);
      }
    }
  }
  function step(dt: number) {
    const g = gLocal();
    const sub = 3,
      h = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (const b of bodies) {
        if (b.held || b.asleep) continue;
        b.vy += g * h;
        b.vx *= 0.9995;
        b.w *= 0.995;
      }
      collide();
      solve();
      for (const b of bodies) {
        if (b.held || b.asleep) continue;
        b.x += b.vx * h;
        b.y += b.vy * h;
        b.a += b.w * h;
      }
      correct();
    }
    const bottomLocal = (vh - rect.top) / S - WELL.top;
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      if (b.held) continue;
      b.age += dt;
      if (!b.counted && b.y > 40 && b.x > 60 && b.x < 940 && b.vy > -50) {
        b.counted = true;
        o.onLand(b.id);
      }
      const sp2 = b.vx * b.vx + b.vy * b.vy;
      if (b.counted && sp2 < 60 * 60 && Math.abs(b.w) < 0.6) {
        b.still += dt;
        if (b.still > 0.5) {
          b.asleep = true;
          b.vx = b.vy = b.w = 0;
        }
      } else b.still = 0;
      const lost = b.y > Math.max(bottomLocal + 600, 1400) || b.x < -4000 || b.x > 5000 || b.age > 8;
      if (lost && !b.counted) {
        // give it another go — dropped in from above the basket
        b.x = 500 + (Math.random() - 0.5) * 260;
        b.y = -520;
        b.vx = 0;
        b.vy = 200;
        b.age = 0;
      } else if (lost) bodies.splice(i, 1);
    }
  }

  // ---------- render ----------
  let raf = 0,
    last = 0,
    visible = false;
  const drawBody = (b: Body) => {
    const img = sprite(b.id);
    const sp = spec[b.id];
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    ctx.drawImage(img, -b.ox, -b.oy, sp.w * K, sp.h * K);
    ctx.restore();
  };
  let lastRectKey = '';
  function frame(t: number) {
    raf = 0;
    const dt = Math.min(1 / 30, (t - (last || t)) / 1000 || 1 / 60);
    last = t;
    measure();
    const active = bodies.some((b) => !b.asleep || b.held);
    if (active) step(dt);
    const key = `${rect.left.toFixed(1)},${rect.top.toFixed(1)},${rect.width.toFixed(1)}`;
    if (active || dirty || key !== lastRectKey) {
      lastRectKey = key;
      dirty = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * rect.left, dpr * (rect.top + WELL.top * S));
      if (back) ctx.drawImage(back, -BASKET_PAD.x, -BASKET_PAD.y, back.width / (dpr * S), back.height / (dpr * S));
      const inside = bodies.filter((b) => b.counted && !b.held);
      for (const b of inside) drawBody(b);
      if (front) ctx.drawImage(front, -BASKET_PAD.x, -BASKET_PAD.y, front.width / (dpr * S), front.height / (dpr * S));
      for (const b of bodies) if (!b.counted || b.held) drawBody(b);
    }
    if (visible || bodies.some((b) => !b.counted)) raf = requestAnimationFrame(frame);
    else cv.style.display = 'none';
  }
  function start() {
    cv.style.display = 'block';
    if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }
  const io = new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      if (visible) {
        dirty = true;
        start();
      }
    },
    { rootMargin: '80px 0px' },
  );
  io.observe(o.section);
  const vis = () => {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!document.hidden && visible) start();
  };
  document.addEventListener('visibilitychange', vis);
  void BASKET;

  return {
    throwFrom,
    grab,
    remove,
    clear,
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', vis);
      document.documentElement.classList.remove('yy-grabbing');
      cv.remove();
    },
  };
}
