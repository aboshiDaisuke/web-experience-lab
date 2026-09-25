import * as T from 'three';
import type { FishKind, SpeciesId } from './fish';
import { HARDSCAPE, sandHeight } from './scape';

// stones and wood, as upright cylinders the fish steer around
const OBSTACLES = HARDSCAPE.map((h) => ({
  x: h.x,
  z: h.z,
  r: h.clear + 1,
  top: sandHeight(h.x, h.z) + h.clear * (h.name.startsWith('wood') ? 3.2 : 2.4),
}));

/*
 * Behaviour. Tetras school (separation, alignment, cohesion around a slowly
 * wandering goal); the gouramis cruise alone and pause to hover on their
 * pectoral fins. A finger near the glass draws them in; a tap on the
 * glass startles everything nearby, and the schools regroup afterwards.
 */

type Profile = {
  size: number;
  cruise: number;
  burst: number;
  school: boolean;
  band: [number, number];
  tailHz: number;
  tailAmp: number;
  pectHz: number;
  turn: number;
  // steepest the body tilts nose up or down (rad); fish rise and sink on their fins
  pitch: number;
  // burst-and-coast: seconds per stroke cycle and the share of it spent beating
  stroke: [number, number];
  beating: number;
};

export const PROFILES: Record<SpeciesId, Profile> = {
  neon: { size: 3.8, cruise: 5.5, burst: 34, school: true, band: [12, 34], tailHz: 3.2, tailAmp: 0.05, pectHz: 5, turn: 2.6, pitch: 0.3, stroke: [1.1, 2.2], beating: 0.55 },
  rummy: { size: 4.4, cruise: 7, burst: 38, school: true, band: [10, 30], tailHz: 3.0, tailAmp: 0.05, pectHz: 5, turn: 2.4, pitch: 0.3, stroke: [1.2, 2.4], beating: 0.6 },
  angel: { size: 12, cruise: 3.2, burst: 22, school: false, band: [20, 40], tailHz: 1.0, tailAmp: 0.045, pectHz: 2.6, turn: 0.9, pitch: 0.2, stroke: [3, 6], beating: 0.5 },
  discus: { size: 13, cruise: 2.6, burst: 20, school: false, band: [15, 36], tailHz: 0.9, tailAmp: 0.035, pectHz: 3.2, turn: 0.8, pitch: 0.18, stroke: [3.5, 7], beating: 0.45 },
  gourami: { size: 8, cruise: 3.4, burst: 26, school: false, band: [16, 38], tailHz: 1.4, tailAmp: 0.045, pectHz: 3.4, turn: 1.1, pitch: 0.2, stroke: [2.5, 5.5], beating: 0.5 },
};

type Fish = {
  p: T.Vector3;
  v: T.Vector3;
  fwd: T.Vector3;
  scale: number;
  tail: number;
  pect: number;
  bank: number;
  bend: number;
  // 1 while the tail beats, easing to 0 while the fish coasts
  beat: number;
  stroke: number;
  period: number;
  goal: T.Vector3;
  hover: number;
  fear: number;
  personal: number;
  // where around a finger this fish likes to hang, so they don't all pile up
  around: T.Vector3;
};

export const BOUNDS = { x: 56, top: 43, z0: -40, z1: -5 };

const tmp = new T.Vector3();
const tmp2 = new T.Vector3();
const up = new T.Vector3(0, 1, 0);
const m = new T.Matrix4();
const basisY = new T.Vector3();
const basisZ = new T.Vector3();

function randomGoal(pr: Profile, out = new T.Vector3()) {
  const x = (Math.random() * 2 - 1) * (BOUNDS.x - 8);
  const z = BOUNDS.z0 + 4 + Math.random() * (BOUNDS.z1 - BOUNDS.z0 - 8);
  const y = Math.max(pr.band[0] + Math.random() * (pr.band[1] - pr.band[0]), sandHeight(x, z) + 6);
  return out.set(x, y, z);
}

export class Tank {
  kinds: { kind: FishKind; pr: Profile; fish: Fish[]; goal: T.Vector3; goalTimer: number }[] = [];
  pointer: T.Vector3 | null = null;
  lastTap = -10;
  time = 0;

  add(kind: FishKind) {
    const pr = PROFILES[kind.id];
    const goal = randomGoal(pr);
    const fish: Fish[] = [];
    for (let i = 0; i < kind.count; i++) {
      const p = pr.school
        ? goal.clone().add(new T.Vector3((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12))
        : randomGoal(pr);
      const dir = new T.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      fish.push({
        p,
        v: dir.clone().multiplyScalar(pr.cruise),
        fwd: dir.clone(),
        scale: pr.size * (0.88 + Math.random() * 0.24),
        tail: Math.random() * 10,
        pect: Math.random() * 10,
        bank: 0,
        bend: 0,
        beat: 1,
        stroke: Math.random(),
        period: pr.stroke[0] + Math.random() * (pr.stroke[1] - pr.stroke[0]),
        goal: randomGoal(pr),
        hover: 0,
        fear: 0,
        personal: 0.8 + Math.random() * 0.4,
        around: new T.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, -Math.random()).multiplyScalar(pr.school ? 6 : 16),
      });
    }
    this.kinds.push({ kind, pr, fish, goal, goalTimer: 0 });
  }

  tap(at: T.Vector3) {
    this.lastTap = this.time;
    for (const k of this.kinds)
      for (const f of k.fish) {
        const d = f.p.distanceTo(at);
        if (d > 45) continue;
        const kick = (1 - d / 45) * k.pr.burst;
        tmp.copy(f.p).sub(at).setZ(Math.min(f.p.z - at.z, -2)).normalize();
        f.v.addScaledVector(tmp, kick * f.personal);
        f.fear = Math.max(f.fear, 1 - d / 60);
      }
  }

  step(dt: number) {
    this.time += dt;
    const t = this.time;
    const big = this.kinds.filter((k) => !k.pr.school).flatMap((k) => k.fish);
    for (const k of this.kinds) {
      const { pr, fish } = k;
      // the school's destination wanders; a finger at the glass pulls it close
      k.goalTimer -= dt;
      if (k.goalTimer <= 0 && pr.school) {
        randomGoal(pr, k.goal);
        k.goalTimer = 7 + Math.random() * 8;
      }
      const curious = this.pointer && t - this.lastTap > 2.5;
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i];
        const acc = tmp2.set(0, 0, 0);
        f.fear = Math.max(0, f.fear - dt * 0.25);
        const calm = 1 - f.fear;

        if (pr.school) {
          const sep = new T.Vector3();
          const ali = new T.Vector3();
          const coh = new T.Vector3();
          let n = 0;
          const r = pr.size * 5;
          for (let j = 0; j < fish.length; j++) {
            if (j === i) continue;
            const o = fish[j];
            tmp.copy(f.p).sub(o.p);
            const d = tmp.length();
            if (d > r) continue;
            n++;
            if (d < pr.size * 1.4) sep.addScaledVector(tmp, 1 / Math.max(d * d, 0.3));
            ali.add(o.v);
            coh.add(o.p);
          }
          if (n) {
            acc.addScaledVector(sep, pr.size * 9);
            acc.addScaledVector(ali.divideScalar(n).sub(f.v), 0.9 * calm);
            acc.addScaledVector(coh.divideScalar(n).sub(f.p), 0.35 * calm);
          }
          const goal = curious ? this.pointer! : k.goal;
          tmp.copy(goal).sub(f.p);
          const gd = tmp.length();
          acc.addScaledVector(tmp.normalize(), (curious ? 5 : 2.4) * calm * Math.min(1, gd / 10));
          // keep clear of the big fish
          for (const b of big) {
            tmp.copy(f.p).sub(b.p);
            const d = tmp.length();
            if (d < 14) acc.addScaledVector(tmp.normalize(), (14 - d) * 1.4);
          }
        } else {
          // cruise to a goal, hang there a while, choose another
          if (curious) tmp.copy(this.pointer!).add(f.around).sub(f.p);
          else tmp.copy(f.goal).sub(f.p);
          const gd = tmp.length();
          if (!curious && gd < 6) {
            f.hover += dt;
            if (f.hover > 3 + Math.random() * 5) {
              randomGoal(pr, f.goal);
              f.hover = 0;
            }
          }
          const want = gd < 8 ? 0.4 : 1;
          acc.addScaledVector(tmp.normalize().multiplyScalar(pr.cruise * want).sub(f.v), 0.6 * calm);
          for (const b of big) {
            if (b === f) continue;
            tmp.copy(f.p).sub(b.p);
            const d = tmp.length();
            if (d < 20) acc.addScaledVector(tmp.normalize(), (20 - d) * 0.5);
          }
        }

        // stones and wood
        for (const o of OBSTACLES) {
          const dx = f.p.x - o.x;
          const dz = f.p.z - o.z;
          const d = Math.hypot(dx, dz);
          const reach = o.r + pr.size * 0.8;
          if (d < reach + 4 && f.p.y < o.top + 3) {
            const push = (reach + 4 - d) * 2.5;
            acc.x += (dx / Math.max(d, 0.1)) * push;
            acc.z += (dz / Math.max(d, 0.1)) * push;
            acc.y += push * 0.4;
          }
        }
        // walls, surface, sand
        const floor = sandHeight(f.p.x, f.p.z) + pr.size * 0.6 + 2;
        const soft = (v: number, lo: number, hi: number, margin: number) =>
          (v < lo + margin ? (lo + margin - v) : 0) - (v > hi - margin ? v - (hi - margin) : 0);
        acc.x += soft(f.p.x, -BOUNDS.x, BOUNDS.x, 8) * 1.6;
        acc.y += soft(f.p.y, floor, BOUNDS.top, 4) * 2.2;
        acc.z += soft(f.p.z, BOUNDS.z0, BOUNDS.z1, 5) * 2.2;
        // fish keep level: damp vertical speed
        acc.y -= f.v.y * 0.6;
        // burst and coast: a few strokes of the tail, then a glide. A scared
        // fish, or one falling behind, keeps beating
        f.stroke += dt / f.period;
        const beating = (f.stroke % 1) < pr.beating || f.fear > 0.2 || f.v.length() < pr.cruise * 0.6 ? 1 : 0;
        f.beat += (beating - f.beat) * Math.min(1, dt * (beating ? 8 : 3));
        acc.addScaledVector(f.fwd, (f.beat - pr.beating) * pr.cruise * 0.5);

        f.v.addScaledVector(acc, dt);
        const speed = f.v.length();
        const max = pr.cruise * (1.6 + f.fear * 3) * f.personal;
        const min = pr.school ? pr.cruise * 0.45 : 0.25;
        if (speed > max) f.v.multiplyScalar(1 - Math.min(1, (speed - max) / speed) * Math.min(1, dt * 3));
        if (speed < min) f.v.multiplyScalar(min / Math.max(speed, 1e-3));
        f.p.addScaledVector(f.v, dt);

        // turn the body towards the velocity at a fish's turning rate
        const prev = tmp.copy(f.fwd);
        const want = tmp2.copy(f.v);
        // heading from the horizontal part of the motion; with little of it
        // (rising or sinking in place) the fish keeps facing where it faced
        let hx = want.x;
        let hz = want.z;
        const hl = Math.hypot(hx, hz);
        if (hl < pr.cruise * 0.15) {
          const k = hl / (pr.cruise * 0.15);
          hx = hx * k + f.fwd.x * (1 - k) * pr.cruise * 0.15;
          hz = hz * k + f.fwd.z * (1 - k) * pr.cruise * 0.15;
        }
        const lim = Math.hypot(hx, hz) * Math.tan(pr.pitch);
        want.set(hx, T.MathUtils.clamp(want.y * 0.5, -lim, lim), hz).normalize();
        const rate = pr.turn * (1 + f.fear * 3) * dt;
        f.fwd.lerp(want, Math.min(1, rate)).normalize();
        const yawRate = (prev.x * f.fwd.z - prev.z * f.fwd.x) / Math.max(dt, 1e-3);
        f.bend += (T.MathUtils.clamp(-yawRate * 0.16, -0.25, 0.25) - f.bend) * Math.min(1, dt * 6);
        f.bank += (T.MathUtils.clamp(yawRate * 0.35, -0.6, 0.6) - f.bank) * Math.min(1, dt * 3);

        const effort = T.MathUtils.clamp(f.v.length() / pr.cruise, 0, 4);
        f.tail += dt * Math.PI * 2 * pr.tailHz * (0.35 + effort * 0.75) * (0.3 + 0.7 * f.beat);
        f.pect += dt * Math.PI * 2 * pr.pectHz * (pr.school ? 1 : 1.4 - Math.min(1, effort) * 0.5);
      }
    }
  }

  write() {
    for (const k of this.kinds) {
      const { kind, pr, fish } = k;
      const swim = kind.swim.array as Float32Array;
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i];
        // basis: head along fwd, back up (tilted by the bank), side = fwd × up
        basisZ.crossVectors(f.fwd, up).normalize();
        basisY.crossVectors(basisZ, f.fwd).normalize();
        basisY.applyAxisAngle(f.fwd, f.bank);
        basisZ.crossVectors(f.fwd, basisY);
        m.makeBasis(f.fwd, basisY, basisZ).scale(tmp.setScalar(f.scale)).setPosition(f.p);
        for (const mesh of kind.meshes) (mesh.instanceMatrix.array as Float32Array).set(m.elements, i * 16);
        const effort = T.MathUtils.clamp(f.v.length() / pr.cruise, 0, 4);
        swim[i * 4] = f.tail;
        // coasting, the body straightens and the tail only trails
        swim[i * 4 + 1] = pr.tailAmp * (0.5 + Math.min(effort, 2.5) * 0.6) * (0.2 + 0.8 * f.beat);
        swim[i * 4 + 2] = f.bend;
        swim[i * 4 + 3] = f.pect;
      }
      for (const mesh of kind.meshes) mesh.instanceMatrix.needsUpdate = true;
      kind.swim.needsUpdate = true;
    }
  }
}
