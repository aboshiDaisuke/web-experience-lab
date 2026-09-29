// Sound for the splash, synthesised with Web Audio (no audio files): a short electronic title
// track at 128 BPM in D minor (Dm – F – B♭ – C), with every effect written into the score so it
// lands on the beat grid that lib/splash.ts cuts the picture on. Browsers keep an AudioContext
// silent until the visitor acts on the page, so nothing sounds by default: the splash offers a
// "音をつけて再生" button, and only after it is pressed does the track play.
//
//   beat 0      a breath in: riser and a filtered pad
//   bar 1       three stabs for 未来 / 技術 / 研究所, a 16th stutter on beat 4, then a gap
//   bar 2       the drop: four on the floor, rolling bass, the title plucked in 32nds
//   beat 8      a sweep into the zoom-through, the works start on the half beat
//   bar 3       the works cut in 16ths over B♭ and C, a snare roll into
//   bar 4       the final hit on Dm, then a half-time loop until the splash leaves

export const BPM = 128;
export const BEAT = 60 / BPM; // 0.469 s
const S16 = BEAT / 4;

export type SplashSound = {
  readonly on: boolean;
  enable: () => Promise<boolean>;
  mute: () => void;
  music: () => void; // start the track: beat 0 is the moment of the call
  musicStop: (fade?: number) => void; // close the filter and fade out
  lift: () => void; // the curtain lifts
  dispose: () => void;
};

type Mix = {
  c: AudioContext;
  noise: AudioBuffer;
  drums: AudioNode; // not ducked
  duck: GainNode; // synths, pumped by the kick
  verb: AudioNode; // reverb send
  echo: AudioNode; // ping-pong delay send
};

const FLOOR = 0.0001;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// chords and bass roots, as MIDI notes
const DM = [50, 53, 57, 62];
const F = [53, 57, 60, 65];
const BB = [46, 50, 53, 58];
const C = [48, 52, 55, 60];
const DM_WIDE = [38, 50, 57, 62, 65, 69];
const TITLE = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89]; // D minor pentatonic, upward

// ---- voices ---------------------------------------------------------------------------------

const envelope = (g: GainNode, t: number, peak: number, attack: number, dur: number, linear = false) => {
  g.gain.setValueAtTime(FLOOR, t);
  if (linear) g.gain.linearRampToValueAtTime(peak, t + attack);
  else g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
};

const sends = (m: Mix, src: AudioNode, verb: number, echo: number) => {
  if (verb) {
    const s = m.c.createGain();
    s.gain.value = verb;
    src.connect(s);
    s.connect(m.verb);
  }
  if (echo) {
    const s = m.c.createGain();
    s.gain.value = echo;
    src.connect(s);
    s.connect(m.echo);
  }
};

const tone = (m: Mix, d: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number) => {
  const o = m.c.createOscillator();
  const g = m.c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  envelope(g, t, peak, 0.004, dur);
  o.connect(g);
  g.connect(d);
  o.start(t);
  o.stop(t + dur + 0.05);
  return g;
};

const noise = (
  m: Mix,
  d: AudioNode,
  kind: BiquadFilterType,
  f0: number,
  f1: number,
  t: number,
  dur: number,
  peak: number,
  q = 1,
  rise = 0.02,
  linear = false,
  pan = 0,
) => {
  const s = m.c.createBufferSource();
  const f = m.c.createBiquadFilter();
  const g = m.c.createGain();
  s.buffer = m.noise;
  f.type = kind;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  envelope(g, t, peak, Math.max(0.003, dur * rise), dur, linear);
  s.connect(f);
  f.connect(g);
  if (pan) {
    const p = m.c.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(d);
  } else g.connect(d);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
  return g;
};

// a stack of detuned saws, spread across the stereo field, through a closing low-pass
const saws = (
  m: Mix,
  d: AudioNode,
  notes: number[],
  t: number,
  dur: number,
  peak: number,
  cut0: number,
  cut1: number,
  opts: { attack?: number; verb?: number; echo?: number; spread?: number; q?: number } = {},
) => {
  const { attack = 0.006, verb = 0, echo = 0, spread = 1, q = 2 } = opts;
  const f = m.c.createBiquadFilter();
  const g = m.c.createGain();
  f.type = 'lowpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(cut0, t);
  f.frequency.exponentialRampToValueAtTime(cut1, t + dur);
  envelope(g, t, peak, attack, dur, attack > 0.05);
  f.connect(g);
  g.connect(d);
  sends(m, g, verb, echo);
  const voices = spread > 0 ? [-16, -6, 6, 16] : [0];
  for (const n of notes)
    voices.forEach((det, i) => {
      const o = m.c.createOscillator();
      const p = m.c.createStereoPanner();
      o.type = 'sawtooth';
      o.frequency.value = mtof(n);
      o.detune.value = det * spread;
      p.pan.value = voices.length > 1 ? (i / (voices.length - 1) - 0.5) * 1.4 * spread : 0;
      o.connect(p);
      p.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  return g;
};

export function createSplashSound(): SplashSound {
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let on = false;
  let timer = 0;
  let live: { level: GainNode; tone: BiquadFilterNode; mix: Mix } | null = null;

  const running = () => on && !!ctx && !!out && !!noiseBuf && ctx.state === 'running';

  // ---- the kit --------------------------------------------------------------------------------
  const kick = (m: Mix, t: number, g = 1) => {
    tone(m, m.drums, 'sine', 180, 44, t, 0.36, 0.95 * g);
    tone(m, m.drums, 'triangle', 90, 40, t, 0.14, 0.35 * g);
    noise(m, m.drums, 'highpass', 3500, 3500, t, 0.012, 0.3 * g, 0.7);
    // side-chain: the synths duck under every kick and swell back
    m.duck.gain.setValueAtTime(0.2, t);
    m.duck.gain.linearRampToValueAtTime(1, t + 0.24);
  };
  const snare = (m: Mix, t: number, g = 1) => {
    tone(m, m.drums, 'triangle', 200, 150, t, 0.11, 0.35 * g);
    const n = noise(m, m.drums, 'bandpass', 2200, 1600, t, 0.2, 0.42 * g, 0.7);
    sends(m, n, 0.25, 0);
  };
  const clap = (m: Mix, t: number, g = 1) => {
    [-0.022, -0.011, 0].forEach((o, i) => noise(m, m.drums, 'bandpass', 1400, 1400, t + o, i === 2 ? 0.16 : 0.03, 0.34 * g, 0.9));
    sends(m, noise(m, m.drums, 'bandpass', 1400, 1100, t, 0.3, 0.12 * g, 0.9), 0.5, 0);
  };
  const hat = (m: Mix, t: number, g: number, open = false, pan = 0) =>
    noise(m, m.drums, 'highpass', 8000, 8000, t, open ? 0.22 : 0.04, 0.17 * g, 0.7, 0.02, false, pan);
  const crash = (m: Mix, t: number, g = 1) => {
    const n = noise(m, m.drums, 'highpass', 4200, 6000, t, 2.2, 0.2 * g, 0.5);
    sends(m, n, 0.35, 0);
  };
  const riser = (m: Mix, t: number, dur: number, g = 1) => {
    noise(m, m.drums, 'bandpass', 250, 9000, t, dur, 0.22 * g, 1.3, 0.96, true);
    const o = m.c.createOscillator();
    const gg = m.c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(880, t + dur);
    gg.gain.setValueAtTime(FLOOR, t);
    gg.gain.linearRampToValueAtTime(0.03 * g, t + dur * 0.96);
    gg.gain.linearRampToValueAtTime(FLOOR, t + dur);
    o.connect(gg);
    gg.connect(m.duck);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  const subDrop = (m: Mix, t: number, g = 1) => tone(m, m.drums, 'sine', 110, 30, t, 1.3, 0.55 * g);
  const bass = (m: Mix, note: number, t: number, dur: number, g = 1) => {
    saws(m, m.duck, [note], t, dur, 0.2 * g, 1100, 180, { spread: 0.4, q: 5 });
    tone(m, m.duck, 'sine', mtof(note), mtof(note), t, dur, 0.34 * g);
  };
  const pluck = (m: Mix, note: number, t: number, g = 1) => {
    const f = mtof(note);
    const a = tone(m, m.duck, 'triangle', f, f, t, 0.24, 0.07 * g);
    const b = tone(m, m.duck, 'square', f * 2, f * 2, t, 0.06, 0.012 * g);
    sends(m, a, 0.3, 0.35);
    sends(m, b, 0, 0.3);
  };
  const tick = (m: Mix, t: number, k: number) => {
    const f = 1400 + k * 90;
    tone(m, m.drums, 'triangle', f, f * 0.5, t, 0.03, 0.1);
    noise(m, m.drums, 'bandpass', 3200 + k * 150, 3200 + k * 150, t, 0.018, 0.2, 6, 0.1, false, k % 2 ? 0.5 : -0.5);
  };

  // ---- the score, one 16th at a time (step 0 = beat 0) -------------------------------------
  const play = (m: Mix, s: number, t: number) => {
    const b = Math.floor(s / 4); // beat
    const q = s % 4; // 16th within the beat

    // beat 0: a breath in
    if (s === 0) {
      riser(m, t, BEAT, 0.7);
      saws(m, m.duck, DM, t, BEAT * 4.75, 0.022, 300, 1400, { attack: 0.4, verb: 0.3 });
      tone(m, m.duck, 'sine', mtof(38), mtof(38), t, BEAT * 4.75, 0.16);
    }

    // bar 1 (beats 1-4): three stabs, a building hat, a 16th stutter, then a gap
    if (b >= 1 && b <= 3 && q === 0) {
      kick(m, t, 1);
      subDrop(m, t, 0.5);
      saws(m, m.duck, [DM, F, BB][b - 1], t, 0.42, 0.075, 5200, 500, { verb: 0.45 });
      bass(m, [38, 41, 34][b - 1], t, 0.4, 0.9);
    }
    if (b >= 1 && b <= 3) hat(m, t, 0.2 + (s - 4) * 0.03, false, q % 2 ? 0.35 : -0.35);
    if (s === 8) riser(m, t, BEAT * 2.75, 1);
    if (b === 4 && q < 3) {
      snare(m, t, 0.5 + q * 0.25);
      saws(m, m.duck, C, t, 0.1, 0.06 + q * 0.015, 6000, 1200, { verb: 0.2 });
      if (q === 0) kick(m, t, 0.8);
    }
    // step 19 is the gap: nothing sounds

    // bar 2 (beats 5-8): the drop
    if (s === 20) {
      kick(m, t, 1.15);
      crash(m, t, 1);
      subDrop(m, t, 1);
      saws(m, m.duck, DM, t, BEAT * 3, 0.03, 700, 2400, { attack: 0.08, verb: 0.35 });
      TITLE.forEach((n, i) => pluck(m, n, t + i * (BEAT / 8), 0.8 + i * 0.03));
    }
    if (b >= 5 && b <= 8) {
      if (q === 0 && s !== 20) kick(m, t, 1);
      if (q === 2) hat(m, t, 0.75, true, 0.2);
      else hat(m, t, 0.28, false, q === 1 ? -0.4 : 0.4);
      if ((b === 6 || b === 8) && q === 0) clap(m, t, 1);
      if (b <= 7 && q !== 0) bass(m, 38, t, 0.12, q === 2 ? 1 : 0.8);
      if (b <= 7 && q === 2) saws(m, m.duck, DM, t, 0.14, 0.03, 4200, 900, { verb: 0.15, echo: 0.2 });
    }
    if (s === 26) noise(m, m.drums, 'bandpass', 600, 5000, t, 0.4, 0.14, 1, 0.8, true);
    if (s === 27) {
      pluck(m, 81, t, 1.1);
      pluck(m, 86, t + BEAT / 8, 1.1);
    }
    // beat 8: into the zoom-through, the works start on 8.5
    if (s === 32) noise(m, m.drums, 'bandpass', 300, 7000, t, BEAT / 2, 0.3, 1.2, 0.97, true);

    // works: one click per cut, 16ths from beat 8.5 (18 of them)
    if (s >= 34 && s <= 51) tick(m, t, s - 34);

    // bar 3 (beats 9-12): B♭ then C, driving 16th bass and an echoing arp
    if (s === 34) {
      kick(m, t, 0.9);
      crash(m, t, 0.6);
    }
    if (b >= 9 && b <= 12) {
      const chord = b <= 10 ? BB : C;
      const root = b <= 10 ? 34 : 36;
      if (s === 36 || s === 44) saws(m, m.duck, chord, t, BEAT * 2, 0.028, 800, 3000, { attack: 0.05, verb: 0.3 });
      if (q === 0) kick(m, t, 1);
      if ((b === 10 || b === 12) && q === 0) clap(m, t, 1);
      hat(m, t, q === 2 ? 0.8 : 0.35, q === 2, q % 2 ? -0.4 : 0.4);
      if (q !== 0) bass(m, root + (q === 2 ? 12 : 0), t, 0.1, 0.9);
      const arp = [chord[3] + 12, chord[1] + 12, chord[2] + 12, chord[3] + 24];
      pluck(m, arp[q], t, 0.55);
    }
    if (s === 44) riser(m, t, BEAT * 2, 1);
    if (b === 12) {
      snare(m, t, 0.4 + q * 0.2);
      snare(m, t + S16 / 2, 0.3 + q * 0.2);
    }

    // bar 4 (beat 13): the final hit on Dm, then a half-time loop
    if (s === 52) {
      kick(m, t, 1.25);
      crash(m, t, 1.3);
      subDrop(m, t, 1.2);
      saws(m, m.duck, DM_WIDE, t, 2.4, 0.06, 6500, 400, { verb: 0.6, echo: 0.15 });
      bass(m, 38, t, 1.2, 1);
    }
    if (b >= 13) {
      const bar = (s - 52) % 16;
      if (bar === 0 && s !== 52) {
        kick(m, t, 0.9);
        saws(m, m.duck, DM, t, BEAT * 4, 0.022, 600, 1800, { attack: 0.1, verb: 0.35 });
      }
      if (bar === 8) {
        kick(m, t, 0.7);
        snare(m, t, 0.8);
      }
      if (bar % 2 === 0) hat(m, t, bar % 4 === 2 ? 0.5 : 0.2, bar % 4 === 2, 0.3);
      if (s > 52 && (bar === 0 || bar === 6 || bar === 10)) bass(m, 38, t, 0.18, 0.8);
      if (bar === 14) pluck(m, [74, 77, 81, 79][Math.floor((s - 52) / 16) % 4], t, 0.7);
    }
  };

  const stopMusic = (fade = 0.6) => {
    window.clearInterval(timer);
    timer = 0;
    const l = live;
    live = null;
    if (!l || !ctx) return;
    const t = ctx.currentTime;
    const f = Math.max(0.05, fade);
    // close the filter as it fades, like the track is pulled away
    l.tone.frequency.cancelScheduledValues(t);
    l.tone.frequency.setValueAtTime(l.tone.frequency.value, t);
    l.tone.frequency.exponentialRampToValueAtTime(160, t + f);
    l.level.gain.cancelScheduledValues(t);
    l.level.gain.setValueAtTime(l.level.gain.value, t);
    l.level.gain.linearRampToValueAtTime(FLOOR, t + f);
    window.setTimeout(() => l.level.disconnect(), f * 1000 + 3000);
  };

  // builds a fresh mix for one playthrough: drums and synths → tone filter → level → out
  const build = (c: AudioContext, dest: AudioNode, nb: AudioBuffer) => {
    const level = c.createGain();
    level.gain.value = 0.78;
    level.connect(dest);
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 18000;
    tone.connect(level);
    const drums = c.createGain();
    drums.connect(tone);
    const duck = c.createGain();
    duck.connect(tone);

    // reverb: a generated stereo impulse, 2.4 s of decaying noise
    const verb = c.createConvolver();
    const len = Math.floor(c.sampleRate * 2.4);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    verb.buffer = ir;
    const verbIn = c.createGain();
    const verbHp = c.createBiquadFilter();
    verbHp.type = 'highpass';
    verbHp.frequency.value = 350;
    verbIn.connect(verbHp);
    verbHp.connect(verb);
    const verbOut = c.createGain();
    verbOut.gain.value = 0.5;
    verb.connect(verbOut);
    verbOut.connect(tone);

    // ping-pong delay, a dotted eighth each side
    const echoIn = c.createGain();
    const dl = c.createDelay(1);
    const dr = c.createDelay(1);
    dl.delayTime.value = dr.delayTime.value = BEAT * 0.75;
    const fb = c.createGain();
    fb.gain.value = 0.38;
    const damp = c.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 3800;
    const pl = c.createStereoPanner();
    const pr = c.createStereoPanner();
    pl.pan.value = -0.8;
    pr.pan.value = 0.8;
    echoIn.connect(dl);
    dl.connect(pl);
    dl.connect(dr);
    dr.connect(pr);
    dr.connect(damp);
    damp.connect(fb);
    fb.connect(dl);
    const echoOut = c.createGain();
    echoOut.gain.value = 0.55;
    pl.connect(echoOut);
    pr.connect(echoOut);
    echoOut.connect(duck);

    const mix: Mix = { c, noise: nb, drums, duck, verb: verbIn, echo: echoIn };
    return { level, tone, mix };
  };

  const dispose = () => {
    stopMusic(0.1);
    on = false;
    const c = ctx;
    ctx = null;
    out = null;
    noiseBuf = null;
    if (c) window.setTimeout(() => void c.close().catch(() => {}), 1500);
  };

  return {
    get on() {
      return on;
    },
    async enable() {
      try {
        if (!ctx) {
          const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!AC) return false;
          ctx = new AC({ latencyHint: 'interactive' });
          const bus = ctx.createDynamicsCompressor();
          bus.threshold.value = -14;
          bus.knee.value = 6;
          bus.ratio.value = 4;
          bus.attack.value = 0.004;
          bus.release.value = 0.12;
          bus.connect(ctx.destination);
          out = ctx.createGain();
          out.gain.value = 0.8;
          out.connect(bus);
          const len = ctx.sampleRate * 2;
          noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
          const d = noiseBuf.getChannelData(0);
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
      stopMusic(0.2);
    },
    music() {
      if (!running()) return;
      const c = ctx!;
      stopMusic(0.1);
      const l = build(c, out!, noiseBuf!);
      live = l;
      // beat 0 is now; hear it now, allowing for the time the output takes to reach the ear
      const lag = (c as AudioContext & { outputLatency?: number }).outputLatency || c.baseLatency || 0;
      const t0 = c.currentTime + 0.03 - Math.min(lag, 0.02);
      let step = 0;
      const run = () => {
        if (!running() || live !== l) return;
        while (t0 + step * S16 < c.currentTime + 0.25) {
          play(l.mix, step, t0 + step * S16);
          step++;
        }
      };
      timer = window.setInterval(run, 30);
      run();
    },
    musicStop: stopMusic,
    lift() {
      if (!running()) return;
      const c = ctx!;
      const m: Mix = { c, noise: noiseBuf!, drums: out!, duck: c.createGain(), verb: out!, echo: out! };
      const t = c.currentTime + 0.01;
      noise(m, out!, 'bandpass', 300, 3000, t, 0.9, 0.3, 0.7, 0.55, true);
      tone(m, out!, 'sine', 55, 220, t, 0.8, 0.2);
    },
    dispose,
  };
}
