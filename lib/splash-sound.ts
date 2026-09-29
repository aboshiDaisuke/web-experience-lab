// Sound for the splash, synthesised with Web Audio (no audio files): a short electronic title
// track (125 BPM, D minor) with the effects tuned to it. Browsers keep an AudioContext silent
// until the visitor acts on the page, so nothing sounds by default: the splash offers a
// "音をつけて再生" button, and only after it is pressed do the cues below speak. Every cue is a
// no-op while sound is off.
//
// The score is laid out on the beat grid (BEAT) so lib/splash.ts can cut the picture on it:
//   bar 1  the three words are struck on beats 1-3, a riser builds through beats 3-4
//   bar 2  the drop: kick, hats and clap under the title
//   bar 3  the works are cut past under a driving bass and arpeggio, a snare roll into
//   bar 4  the final hit, then a calmer loop until the splash leaves

export const BPM = 125;
export const BEAT = 60 / BPM; // 0.48 s

export type SplashSound = {
  readonly on: boolean;
  enable: () => Promise<boolean>;
  mute: () => void;
  music: () => void; // start the track: bar 1 lands one beat after this call
  musicStop: (fade?: number) => void;
  draw: () => void; // hairlines drawn
  slam: (pitch?: number) => void; // a word struck: thump plus a click (pitch is a ratio of D3)
  whoosh: (dir?: 'up' | 'down', dur?: number, gain?: number) => void; // a wipe or cut
  pluck: (step: number) => void; // one character rising, on the D minor pentatonic
  tick: (t: number) => void; // a work cut past, t = 0..1 through the count
  finale: () => void; // 18 WORKS lands
  lift: () => void; // the curtain lifts
  dispose: () => void;
};

type Rig = { c: AudioContext; out: GainNode; bus: DynamicsCompressorNode; noise: AudioBuffer };

const FLOOR = 0.0001;
const STEP = BEAT / 4;
const D3 = 146.83;
const PENTA = [0, 3, 5, 7, 10]; // D F G A C
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// chords as MIDI notes: Dm9, Bb, C
const DM = [50, 53, 57, 64];
const BB = [46, 50, 53, 60];
const CM = [48, 52, 55, 62];
const ARP: Record<string, number[]> = {
  dm: [62, 65, 69, 65, 74, 69, 65, 62],
  bb: [70, 74, 77, 74, 82, 77, 74, 70],
  c: [72, 76, 79, 76, 84, 79, 76, 72],
};

// a pitched voice with a fast attack and exponential decay, at absolute time t
const osc = (a: Rig, d: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number) => {
  const o = a.c.createOscillator();
  const g = a.c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(FLOOR, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  o.connect(g);
  g.connect(d);
  o.start(t);
  o.stop(t + dur + 0.05);
};

// filtered noise: wind, hats, claps, a crash
const hit = (a: Rig, d: AudioNode, kind: BiquadFilterType, f0: number, f1: number, t: number, dur: number, peak: number, q = 1, rise = 0.3, linear = false) => {
  const s = a.c.createBufferSource();
  const f = a.c.createBiquadFilter();
  const g = a.c.createGain();
  s.buffer = a.noise;
  f.type = kind;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(FLOOR, t);
  if (linear) g.gain.linearRampToValueAtTime(peak, t + Math.max(0.004, dur * rise));
  else g.gain.exponentialRampToValueAtTime(peak, t + Math.max(0.004, dur * rise));
  g.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(d);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
};

// a saw through a low-pass whose cutoff falls: bass notes, arp plucks, stabs
const saw = (a: Rig, d: AudioNode, midi: number, t: number, dur: number, peak: number, cut0: number, cut1: number, sub = 0) => {
  const f = mtof(midi);
  const flt = a.c.createBiquadFilter();
  const g = a.c.createGain();
  flt.type = 'lowpass';
  flt.Q.value = 4;
  flt.frequency.setValueAtTime(cut0, t);
  flt.frequency.exponentialRampToValueAtTime(cut1, t + dur);
  g.gain.setValueAtTime(FLOOR, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
  g.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  const o = a.c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = f;
  o.connect(flt);
  flt.connect(g);
  g.connect(d);
  o.start(t);
  o.stop(t + dur + 0.05);
  if (sub) osc(a, d, 'sine', f, f, t, dur, sub);
};

// a slow pad: detuned saws under a low-pass, swelling in and out
const pad = (a: Rig, d: AudioNode, midis: number[], t: number, dur: number, peak: number) => {
  const flt = a.c.createBiquadFilter();
  const g = a.c.createGain();
  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(500, t);
  flt.frequency.exponentialRampToValueAtTime(1600, t + dur * 0.7);
  g.gain.setValueAtTime(FLOOR, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.25);
  g.gain.setValueAtTime(peak, t + Math.max(0.26, dur - 0.3));
  g.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  flt.connect(g);
  g.connect(d);
  for (const m of midis)
    for (const det of [-7, 7]) {
      const o = a.c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = det;
      o.connect(flt);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
};

export function createSplashSound(): SplashSound {
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let bus: DynamicsCompressorNode | null = null;
  let noise: AudioBuffer | null = null;
  let on = false;
  let timer = 0;
  let mus: GainNode | null = null;

  const rig = (): Rig | null => (on && ctx && out && bus && noise && ctx.state === 'running' ? { c: ctx, out, bus, noise } : null);

  // ---- the track --------------------------------------------------------------------------
  const kick = (a: Rig, d: AudioNode, t: number, g = 1) => {
    osc(a, d, 'sine', 150, 42, t, 0.28, 0.95 * g);
    hit(a, d, 'highpass', 3000, 3000, t, 0.015, 0.25 * g, 0.7, 0.1);
  };
  const hat = (a: Rig, d: AudioNode, t: number, g: number, open = false) =>
    hit(a, d, 'highpass', 7500, 7500, t, open ? 0.2 : 0.045, 0.15 * g, 0.7, 0.05);
  const clap = (a: Rig, d: AudioNode, t: number, g: number) => {
    hit(a, d, 'bandpass', 1500, 1500, t - 0.012, 0.05, 0.2 * g, 0.8, 0.1);
    hit(a, d, 'bandpass', 1500, 1300, t, 0.14, 0.34 * g, 0.8, 0.05);
  };
  const riser = (a: Rig, d: AudioNode, t: number, dur: number, g: number) => {
    hit(a, d, 'bandpass', 300, 8000, t, dur, 0.2 * g, 1.2, 0.95, true);
    osc(a, d, 'sine', 180, 1500, t + dur * 0.5, dur * 0.5, 0.05 * g);
  };

  const playStep = (a: Rig, d: AudioNode, step: number, t: number) => {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const offbeat = s % 4 === 2;
    if (bar === 0) {
      if (s === 0) {
        pad(a, d, [38, 45, 50], t, BEAT * 4 + 0.05, 0.05); // a low drone under the three words
      }
      if (offbeat) hat(a, d, t, 0.5);
      if (s === 8) riser(a, d, t, STEP * 8, 0.6);
      if (s === 14) clap(a, d, t, 0.3);
      if (s === 15) clap(a, d, t, 0.4);
    } else if (bar === 1) {
      // the drop, under the title
      if (s === 0) {
        hit(a, d, 'highpass', 5000, 5000, t, 1.4, 0.22, 0.7, 0.02);
        pad(a, d, DM, t, BEAT * 4 + 0.1, 0.03);
      }
      if (s % 4 === 0) kick(a, d, t, 1);
      if (offbeat) hat(a, d, t, 0.7);
      else if (s % 2 === 1) hat(a, d, t, 0.2);
      if (s === 4 || s === 12) clap(a, d, t, 0.8);
      const bassAt: Record<number, number> = { 0: 38, 3: 38, 6: 41, 8: 38, 11: 38, 14: 36 };
      if (bassAt[s]) saw(a, d, bassAt[s], t, 0.22, 0.32, 700, 200, 0.28);
    } else if (bar === 2) {
      // the works: full drive, a snare roll into the finish
      const first = s < 8;
      const root = first ? 34 : 36;
      const arp = first ? ARP.bb : ARP.c;
      if (s === 0) {
        pad(a, d, BB, t, BEAT * 2 + 0.05, 0.03);
        riser(a, d, t, BEAT * 4, 0.55);
      }
      if (s === 8) pad(a, d, CM, t, BEAT * 2 + 0.05, 0.03);
      if (s % 4 === 0 || s === 14) kick(a, d, t, s === 14 ? 0.6 : 1);
      hat(a, d, t, offbeat ? 0.8 : s % 2 ? 0.25 : 0.4);
      if (s === 4 || s === 12) clap(a, d, t, 0.8);
      if (s >= 13) clap(a, d, t, 0.15 + (s - 12) * 0.1);
      if (s % 2 === 0) saw(a, d, root + (s % 8 === 6 ? 12 : 0), t, 0.16, 0.3, 800, 220, 0.24);
      saw(a, d, arp[s % 8] + 0, t, 0.15, 0.06, 3600, 900);
    } else {
      // bar 4 onward: the final hit, then a calmer loop
      if (bar === 3 && s === 0) {
        hit(a, d, 'highpass', 5000, 5000, t, 1.6, 0.3, 0.7, 0.02);
        kick(a, d, t, 1.15);
        for (const m of [50, 53, 57, 62, 64]) saw(a, d, m, t, 1.9, 0.05, 3200, 500);
        saw(a, d, 38, t, 1.9, 0.32, 900, 200, 0.3);
      }
      if (s === 0) pad(a, d, DM, t, BEAT * 4 + 0.1, 0.025);
      if (s === 8) kick(a, d, t, bar === 3 ? 0.5 : 0.45);
      if (bar > 3 && s === 0) kick(a, d, t, 0.5);
      if (offbeat) hat(a, d, t, 0.35);
      if (bar > 3 && (s === 6 || s === 10)) saw(a, d, 38, t, 0.2, 0.22, 600, 200, 0.2);
    }
  };

  const stopMusic = (fade = 0.6) => {
    window.clearInterval(timer);
    timer = 0;
    const m = mus;
    mus = null;
    const c = ctx;
    if (m && c) {
      const t = c.currentTime;
      m.gain.cancelScheduledValues(t);
      m.gain.setValueAtTime(m.gain.value, t);
      m.gain.linearRampToValueAtTime(0.0001, t + Math.max(0.05, fade));
      window.setTimeout(() => m.disconnect(), fade * 1000 + 200);
    }
  };

  const dispose = () => {
    stopMusic(0.1);
    on = false;
    const c = ctx;
    ctx = null;
    out = null;
    bus = null;
    noise = null;
    if (c) window.setTimeout(() => void c.close().catch(() => {}), 1500);
  };

  // effects, at "now"
  const at = (a: Rig, delay = 0) => a.c.currentTime + 0.01 + delay;

  return {
    get on() {
      return on;
    },
    async enable() {
      try {
        if (!ctx) {
          const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!AC) return false;
          ctx = new AC();
          bus = ctx.createDynamicsCompressor();
          bus.threshold.value = -16;
          bus.ratio.value = 6;
          bus.attack.value = 0.003;
          bus.release.value = 0.15;
          bus.connect(ctx.destination);
          out = ctx.createGain();
          out.gain.value = 0.7;
          out.connect(bus);
          const len = ctx.sampleRate * 2;
          noise = ctx.createBuffer(1, len, ctx.sampleRate);
          const d = noise.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        await ctx.resume();
        on = ctx.state === 'running';
      } catch {
        on = false;
      }
      return on;
    },
    mute() {
      on = false;
      stopMusic(0.15);
    },
    music() {
      const a = rig();
      if (!a) return;
      stopMusic(0.1);
      const m = a.c.createGain();
      m.gain.value = 0.55;
      m.connect(a.bus);
      mus = m;
      const t0 = a.c.currentTime + BEAT - 0.02; // the downbeat of bar 1 (called 0.02 s into the splash)
      riser(a, m, a.c.currentTime + 0.02, BEAT, 0.35); // a breath in before it
      let step = 0;
      const run = () => {
        const r = rig();
        if (!r || mus !== m) return;
        while (t0 + step * STEP < r.c.currentTime + 0.3) {
          playStep(r, m, step, t0 + step * STEP);
          step++;
        }
      };
      timer = window.setInterval(run, 40);
      run();
    },
    musicStop: stopMusic,
    draw() {
      const a = rig();
      if (!a) return;
      const t = at(a);
      hit(a, a.out, 'bandpass', 200, 4200, t, 0.7, 0.16, 0.9, 0.5);
      osc(a, a.out, 'sine', 293.66, 1174.66, t, 0.55, 0.05);
    },
    slam(pitch = 1) {
      const a = rig();
      if (!a) return;
      const t = at(a);
      osc(a, a.out, 'sine', D3 * pitch, 46, t, 0.3, 0.95);
      osc(a, a.out, 'triangle', (D3 / 2) * pitch, 40, t, 0.22, 0.3);
      hit(a, a.out, 'highpass', 2600, 2600, t, 0.06, 0.32, 0.7, 0.05);
    },
    whoosh(dir = 'up', dur = 0.3, gain = 0.32) {
      const a = rig();
      if (!a) return;
      hit(a, a.out, 'bandpass', dir === 'up' ? 300 : 3200, dir === 'up' ? 3200 : 300, at(a), dur, gain, 0.9, 0.4);
    },
    pluck(step: number) {
      const a = rig();
      if (!a) return;
      const t = at(a);
      const semis = PENTA[step % 5] + 12 * Math.floor(step / 5);
      const f = 587.33 * Math.pow(2, semis / 12); // D5 upward
      osc(a, a.out, 'triangle', f, f, t, 0.2, 0.07);
      osc(a, a.out, 'sine', f * 2, f * 2, t, 0.12, 0.025);
    },
    tick(t: number) {
      const a = rig();
      if (!a) return;
      const n = at(a);
      const f = 900 + t * 1800;
      osc(a, a.out, 'triangle', f, f * 0.55, n, 0.035, 0.12);
      hit(a, a.out, 'bandpass', 2000 + t * 3000, 2000 + t * 3000, n, 0.02, 0.22, 6, 0.1);
    },
    finale() {
      const a = rig();
      if (!a) return;
      const t = at(a);
      osc(a, a.out, 'sine', 73.42, 32, t, 0.9, 1);
      hit(a, a.out, 'bandpass', 6000, 800, t, 0.7, 0.24, 0.8, 0.1);
      [587.33, 698.46, 880].forEach((f, i) => osc(a, a.out, 'sine', f, f, t + 0.05 + i * 0.06, 1.3, 0.08));
    },
    lift() {
      const a = rig();
      if (!a) return;
      const t = at(a);
      hit(a, a.out, 'bandpass', 300, 2400, t, 0.9, 0.38, 0.7, 0.5);
      osc(a, a.out, 'sine', 60, 220, t, 0.8, 0.22);
    },
    dispose,
  };
}
