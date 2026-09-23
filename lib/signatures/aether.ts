import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Signature } from './types';

/*
 * AETHER ONE — "hear it".
 * A generative ambient piece is synthesised on demand with Web Audio. Its
 * spectrum drives a floor-plane sound field around the speaker (wavefronts on
 * every low-end hit, spectrum-bent standing rings, dust that shimmers with the
 * highs), the hero light breathes with the bass and the speaker itself opens a
 * little on each beat. Scrolling (desktop) pins the hero and disassembles it.
 */

const BPM = 72;
const BEAT = 60 / BPM;
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
// Dmaj9 → Bm11 → Gmaj7(#11) → A6/9 : warm, unresolved, loops forever
const CHORDS = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 62, 64],
  [43, 50, 54, 59, 61],
  [45, 52, 57, 59, 66],
];
const ROOTS = [38, 35, 31, 33];
const BELLS = [74, 76, 78, 81, 83, 86, 88, 90];

type Hit = { t: number; a: number };
type Ambient = {
  ctx: AudioContext;
  analyser: AnalyserNode;
  /** most recent audible kick (audio clock) */
  lastHit: () => Hit | null;
  stop: (fade: number) => void;
};

function impulse(ctx: BaseAudioContext, seconds: number, decay: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const pre = Math.floor(ctx.sampleRate * 0.018);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = i / len;
      // one-pole low-pass whose cutoff closes over time → a darker, warmer tail
      lp += (Math.random() * 2 - 1 - lp) * (0.18 + 0.62 * (1 - t) ** 2);
      d[i] = lp * (1 - t) ** decay * 1.6;
    }
  }
  return buf;
}

function startAmbient(): Ambient | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC({ latencyHint: 'playback' });
  void ctx.resume();
  const t0 = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(0.3, t0 + 3.2);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.02;
  comp.release.value = 0.3;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.72;
  master.connect(comp);
  comp.connect(analyser);
  analyser.connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 4.6, 2.4);
  const wet = ctx.createGain();
  wet.gain.value = 0.8;
  reverb.connect(wet);
  wet.connect(master);

  // everything tonal passes through the "duck" so it breathes with the pulse
  const duck = ctx.createGain();
  duck.connect(master);
  const padSend = ctx.createGain();
  padSend.gain.value = 0.6;
  padSend.connect(reverb);

  // air: a faint band of filtered noise, slowly swelling — the highs shimmer
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const air = ctx.createBufferSource();
  air.buffer = noise;
  air.loop = true;
  const airBand = ctx.createBiquadFilter();
  airBand.type = 'bandpass';
  airBand.frequency.value = 7200;
  airBand.Q.value = 0.8;
  const airGain = ctx.createGain();
  airGain.gain.value = 0.012;
  const airLfo = ctx.createOscillator();
  airLfo.frequency.value = 0.06;
  const airDepth = ctx.createGain();
  airDepth.gain.value = 0.008;
  airLfo.connect(airDepth);
  airDepth.connect(airGain.gain);
  air.connect(airBand);
  airBand.connect(airGain);
  airGain.connect(master);
  airGain.connect(padSend);
  air.start(t0);
  airLfo.start(t0);

  const chord = (index: number, t: number, dur: number) => {
    const notes = CHORDS[index % CHORDS.length];
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(480, t);
    filter.frequency.linearRampToValueAtTime(1500, t + dur * 0.55);
    filter.frequency.linearRampToValueAtTime(620, t + dur + 3);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1, t + 2.4);
    env.gain.setValueAtTime(1, t + dur);
    env.gain.linearRampToValueAtTime(0.0001, t + dur + 3);
    filter.connect(env);
    env.connect(duck);
    env.connect(padSend);
    const end = t + dur + 3.1;
    notes.forEach((n, k) => {
      for (const side of [-1, 1]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        o.detune.value = side * (5 + k) + (Math.random() * 3 - 1.5);
        const g = ctx.createGain();
        g.gain.value = 0.022;
        const pan = ctx.createStereoPanner();
        pan.pan.value = side * (0.45 - k * 0.07);
        o.connect(g);
        g.connect(pan);
        pan.connect(filter);
        o.start(t);
        o.stop(end);
      }
    });
    const sub = ctx.createOscillator();
    sub.frequency.value = midi(ROOTS[index % ROOTS.length]);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.linearRampToValueAtTime(0.13, t + 1.4);
    sg.gain.setValueAtTime(0.13, t + dur);
    sg.gain.linearRampToValueAtTime(0.0001, t + dur + 1.6);
    sub.connect(sg);
    sg.connect(duck);
    sub.start(t);
    sub.stop(t + dur + 1.7);
    sub.onended = () => {
      filter.disconnect();
      env.disconnect();
      sg.disconnect();
    };
  };

  const kick = (t: number, a: number) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(112, t);
    o.frequency.exponentialRampToValueAtTime(43, t + 0.17);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.75 * a, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    const send = ctx.createGain();
    send.gain.value = 0.1;
    o.connect(g);
    g.connect(master);
    g.connect(send);
    send.connect(reverb);
    o.start(t);
    o.stop(t + 0.66);
    o.onended = () => {
      g.disconnect();
      send.disconnect();
    };
    duck.gain.setValueAtTime(1, t);
    duck.gain.linearRampToValueAtTime(1 - 0.34 * a, t + 0.03);
    duck.gain.setTargetAtTime(1, t + 0.06, 0.17);
  };

  const shaker = (t: number, v: number) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    s.connect(hp);
    hp.connect(g);
    g.connect(master);
    s.start(t, Math.random() * 1.5, 0.12);
    s.onended = () => g.disconnect();
  };

  const bell = (t: number) => {
    const f = midi(BELLS[Math.floor(Math.random() * BELLS.length)]);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 3.5;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(f * 1.2, t);
    depth.gain.exponentialRampToValueAtTime(1, t + 1.2);
    mod.connect(depth);
    depth.connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.4 - 0.7;
    car.connect(g);
    g.connect(pan);
    pan.connect(master);
    const send = ctx.createGain();
    send.gain.value = 1.4;
    pan.connect(send);
    send.connect(reverb);
    car.start(t);
    mod.start(t);
    car.stop(t + 2.7);
    mod.stop(t + 2.7);
    car.onended = () => {
      pan.disconnect();
      send.disconnect();
    };
  };

  const hits: Hit[] = [];
  let beat = 0;
  let next = t0 + 0.08;
  const schedule = () => {
    while (next < ctx.currentTime + 0.35) {
      const inBar = beat % 4;
      if (beat % 8 === 0) chord(beat / 8, next, BEAT * 8);
      // the pulse enters after the first bar, like a heartbeat under the pad
      if (beat >= 4) {
        const a = inBar === 0 ? 1 : inBar === 2 ? 0.7 : 0.4;
        kick(next, a);
        hits.push({ t: next, a });
        if (hits.length > 12) hits.shift();
      }
      if (beat >= 8 && Math.random() < 0.8)
        shaker(next + BEAT / 2, 0.55 + Math.random() * 0.45);
      for (const off of [0, 0.5, 0.75])
        if (Math.random() < (off === 0 ? 0.16 : 0.08)) bell(next + off * BEAT);
      next += BEAT;
      beat += 1;
    }
  };
  schedule();
  const timer = window.setInterval(schedule, 60);

  let stopped = false;
  return {
    ctx,
    analyser,
    lastHit: () => {
      const now =
        ctx.currentTime - (ctx.outputLatency || 0) - (ctx.baseLatency || 0);
      for (let i = hits.length - 1; i >= 0; i--)
        if (hits[i].t <= now) return hits[i];
      return null;
    },
    stop: (fade) => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + fade);
      window.setTimeout(
        () => {
          void ctx.close().catch(() => {});
        },
        fade * 1000 + 250,
      );
    },
  };
}

const mount: Signature = (ctx) => {
  const { cover, reduced, embedded, narrow } = ctx;
  const object = cover.querySelector<HTMLElement>('.aether-object');
  const control = cover.querySelector<HTMLElement>('.aether-control');
  const output = cover.querySelector<HTMLOutputElement>(
    '.explode-slider output',
  );
  if (!object) return;
  const disposers: (() => void)[] = [];
  const on = (
    el: EventTarget,
    type: string,
    fn: (e: Event) => void,
    opts?: AddEventListenerOptions,
  ) => {
    el.addEventListener(type, fn, opts);
    disposers.push(() => el.removeEventListener(type, fn, opts));
  };

  cover.classList.add('ae-ready');

  /* ---------- injected DOM ---------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'ae-field';
  canvas.setAttribute('aria-hidden', 'true');
  cover.insertBefore(canvas, cover.firstChild);
  const g = canvas.getContext('2d');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ae-listen';
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML =
    '<span class="ae-listen-dial" aria-hidden="true"><span class="ae-listen-ring"></span><span class="ae-listen-glyph"></span><span class="ae-listen-bars"><i></i><i></i><i></i><i></i><i></i></span></span>' +
    '<span class="ae-listen-text"><b>音を聴く</b><small>音が出ます</small></span>';
  object.appendChild(button);
  const label = button.querySelector('b')!;
  const sub = button.querySelector('small')!;
  const bars = Array.from(button.querySelectorAll<HTMLElement>('i'));

  /* ---------- field geometry ---------- */
  let W = 0,
    H = 0,
    dpr = 1,
    cx = 0,
    cy = 0,
    floorY = 0,
    reach = 0;
  const K = 0.2; // floor-plane ellipse ratio
  type Dust = { a: number; r: number; h: number; ph: number; sp: number };
  let dust: Dust[] = [];
  const measure = () => {
    const cr = cover.getBoundingClientRect();
    const or = object.getBoundingClientRect();
    W = cr.width;
    H = cr.height;
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    cx = or.left - cr.left + or.width / 2;
    cy = or.top - cr.top + or.height * 0.52;
    floorY = or.top - cr.top + or.height * 0.79;
    reach = Math.max(W - cx, cx) * 1.05;
    button.style.setProperty('--ae-floor', `${or.height * 0.79}px`);
    const cut = control
      ? control.getBoundingClientRect().top - cr.top - 8
      : H;
    canvas.style.setProperty('--ae-cut', `${Math.round(cut)}px`);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const n = narrow ? 110 : 200;
    dust = Array.from({ length: n }, () => ({
      a: rnd() * Math.PI * 2,
      r: 70 + rnd() ** 0.8 * reach * 0.95,
      h: rnd() < 0.7 ? rnd() * 5 : rnd() * 60,
      ph: rnd() * Math.PI * 2,
      sp: 1.5 + rnd() * 4,
    }));
  };

  /* ---------- drawing ---------- */
  const RINGS = 6;
  const ringR = (k: number) => (narrow ? 70 : 105) * 1.46 ** k;
  const accent = '167,196,199';
  type Wave = { born: number; s: number };
  const waves: Wave[] = [];
  const bands = new Float32Array(RINGS);
  let bass = 0,
    high = 0;

  const draw = (now: number, live: boolean) => {
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // breathing light behind the speaker
    const glowR = H * (0.62 + bass * 0.16);
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    glow.addColorStop(0, `rgba(${accent},${0.07 + bass * 0.12})`);
    glow.addColorStop(0.45, `rgba(${accent},${0.025 + bass * 0.04})`);
    glow.addColorStop(1, `rgba(${accent},0)`);
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    // a pool of light on the floor, pulsing with the low end
    g.save();
    g.translate(cx, floorY);
    g.scale(1, K);
    const poolR = ringR(2) * (1 + bass * 0.35);
    const pool = g.createRadialGradient(0, 0, 0, 0, 0, poolR);
    pool.addColorStop(0, `rgba(${accent},${0.08 + bass * 0.22})`);
    pool.addColorStop(1, `rgba(${accent},0)`);
    g.fillStyle = pool;
    g.beginPath();
    g.arc(0, 0, poolR, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // standing rings, bent by their frequency band
    const t = now / 1000;
    for (let k = 0; k < RINGS; k++) {
      const e = bands[k];
      const base = ringR(k) * (1 + e * 0.07);
      const alpha = (0.075 + e * 0.28) * (1 - k * 0.09);
      g.beginPath();
      const steps = 120;
      const lobes = 2 + k;
      const amp = live ? e * (2.5 + k * 1.4) : 0;
      for (let i = 0; i <= steps; i++) {
        const th = (i / steps) * Math.PI * 2;
        const rr =
          base +
          amp * Math.sin(th * lobes + t * (k % 2 ? 0.7 : -0.55) + k) +
          amp * 0.3 * Math.sin(th * (lobes * 2 + 1) - t * 1.3);
        const x = cx + Math.cos(th) * rr;
        const y = floorY + Math.sin(th) * rr * K;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.strokeStyle = `rgba(${accent},${Math.max(0.04, alpha)})`;
      g.lineWidth = 1;
      g.stroke();
    }

    // wavefronts: one per low-end hit, travelling out across the room
    const speed = reach / 3.1;
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      const age = (now - w.born) / 1000;
      const r = 60 + age * speed;
      const life = r / reach;
      if (life >= 1) {
        waves.splice(i, 1);
        continue;
      }
      const a = w.s * (1 - life) ** 1.6;
      g.beginPath();
      g.ellipse(cx, floorY, r, r * K, 0, 0, Math.PI * 2);
      g.strokeStyle = `rgba(${accent},${a * 0.1})`;
      g.lineWidth = 9 * (1 - life) + 2;
      g.stroke();
      g.strokeStyle = `rgba(226,238,240,${a * 0.62})`;
      g.lineWidth = 1.3 * (1 - life) + 0.5;
      g.stroke();
      // the same front, seen as a sphere of pressure around the body
      if (life < 0.5) {
        g.beginPath();
        g.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
        g.strokeStyle = `rgba(${accent},${a * 0.13 * (1 - life * 2)})`;
        g.lineWidth = 1;
        g.stroke();
      }
    }

    // dust resting on the floor; highs make it glint, fronts push it
    for (const d of dust) {
      let push = 0,
        lit = 0;
      for (const w of waves) {
        const wr = 60 + ((now - w.born) / 1000) * speed;
        const dr = d.r - wr;
        if (dr > -40 && dr < 16) {
          const f = dr < 0 ? 1 + dr / 40 : 1 - dr / 16;
          push += f * 7 * w.s;
          lit += f * w.s;
        }
      }
      const rr = d.r + push;
      const x = cx + Math.cos(d.a) * rr;
      const y = floorY + Math.sin(d.a) * rr * K - d.h - push * 0.5;
      if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * d.sp + d.ph);
      const far = Math.sin(d.a) < 0 ? 0.6 : 1;
      const a = Math.min(
        0.9,
        (0.1 + high * 2.2 * tw * tw + lit * 0.55) * far * (1 - d.r / reach / 1.4),
      );
      const s = 0.7 + tw * high * 2 + lit * 0.8;
      g.fillStyle = `rgba(230,240,242,${a})`;
      g.fillRect(x - s / 2, y - s / 2, s, s);
    }
  };

  /* ---------- audio + loop ---------- */
  let amb: Ambient | null = null;
  let raf = 0;
  let visible = true;
  let freq: Uint8Array<ArrayBuffer> | null = null;
  let bassAvg = 0,
    lastWave = 0,
    prevBass = 0;
  const bandEdges = [30, 150, 400, 1000, 2400, 5000, 12000];

  // explode ownership: the beat only moves the speaker when nobody else is
  const readExplode = () => parseInt(output?.textContent || '0', 10) || 0;
  let written = readExplode();
  let userHold = written !== 0;
  let lastUserInput = 0;
  let scrollOwned = false;
  let lastWrite = 0;
  const write = (v: number, force = false) => {
    if (!ctx.setExplode || (v === written && !force)) return;
    written = v;
    ctx.setExplode(v);
  };
  if (control) {
    const grab = () => {
      userHold = true;
      lastUserInput = performance.now();
    };
    on(control, 'pointerdown', grab);
    on(control, 'keydown', grab);
  }

  const analyse = () => {
    if (!amb) return;
    const an = amb.analyser;
    if (!freq) freq = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(freq);
    const hz = amb.ctx.sampleRate / an.fftSize;
    const band = (lo: number, hi: number) => {
      const a = Math.max(1, Math.floor(lo / hz));
      const b = Math.min(freq!.length - 1, Math.ceil(hi / hz));
      let s = 0;
      for (let i = a; i <= b; i++) s += freq![i];
      return s / (b - a + 1) / 255;
    };
    for (let k = 0; k < RINGS; k++) {
      // lift the quieter upper bands so every ring has something to say
      const v = Math.min(1, band(bandEdges[k], bandEdges[k + 1]) * (1 + k * 0.55));
      bands[k] += (v - bands[k]) * 0.35;
    }
    const b = band(35, 120);
    bass += (b - bass) * 0.3;
    high += (Math.min(1, band(4500, 12000) * 3.2) - high) * 0.25;
    bassAvg += (b - bassAvg) * 0.04;
    const now = performance.now();
    if (
      b > bassAvg * 1.12 + 0.02 &&
      b - prevBass > 0.012 &&
      now - lastWave > 300
    ) {
      lastWave = now;
      waves.push({ born: now, s: Math.min(1, 0.35 + (b - bassAvg) * 3) });
      if (waves.length > 8) waves.shift();
    }
    prevBass = b;
    bars.forEach((el, i) => {
      el.style.transform = `scaleY(${(0.18 + Math.min(1, bands[i] * 1.25) * 0.82).toFixed(3)})`;
    });
    button.style.setProperty('--ae-beat', bass.toFixed(3));
  };

  const pulse = () => {
    if (!amb || reduced || !ctx.setExplode) return;
    const now = performance.now();
    if (userHold && readExplode() === 0 && now - lastUserInput > 500)
      userHold = false;
    if (userHold || scrollOwned) return;
    const hit = amb.lastHit();
    let v = 0;
    if (hit) {
      const dt = amb.ctx.currentTime - hit.t;
      v = 2 + 10 * hit.a * Math.exp(-dt * 4.2);
    }
    if (now - lastWrite < 32) return;
    lastWrite = now;
    write(Math.round(v));
  };

  const loop = (now: number) => {
    raf = 0;
    if (!amb || !visible) return;
    analyse();
    pulse();
    draw(now, true);
    raf = requestAnimationFrame(loop);
  };
  const wake = () => {
    if (!raf && amb && visible && !reduced) raf = requestAnimationFrame(loop);
  };

  const setUi = (playing: boolean) => {
    button.setAttribute('aria-pressed', String(playing));
    label.textContent = playing ? '止める' : '音を聴く';
    sub.textContent = playing ? '再生中' : '音が出ます';
    cover.classList.toggle('ae-playing', playing);
  };

  const stop = (fade = 1.4) => {
    if (!amb) return;
    amb.stop(fade);
    amb = null;
    setUi(false);
    cancelAnimationFrame(raf);
    raf = 0;
    // let the field settle instead of freezing mid-motion
    const settle = (now: number) => {
      bass *= 0.9;
      high *= 0.9;
      for (let k = 0; k < RINGS; k++) bands[k] *= 0.9;
      draw(now, true);
      if (bass > 0.01 || waves.length) raf = requestAnimationFrame(settle);
      else {
        raf = 0;
        draw(now, false);
      }
    };
    if (!reduced && visible) raf = requestAnimationFrame(settle);
    else draw(performance.now(), false);
    if (!userHold && !scrollOwned) write(0);
    bars.forEach((el) => (el.style.transform = ''));
  };

  const play = () => {
    amb = startAmbient();
    if (!amb) return;
    freq = null;
    setUi(true);
    if (reduced) {
      // audio yes, motion no: one calm frame of the sound field
      bands.fill(0.35);
      bass = 0.3;
      high = 0.15;
      draw(performance.now(), false);
    } else wake();
  };

  on(button, 'click', () => (amb ? stop() : play()));

  /* ---------- lifecycle ---------- */
  let offTimer = 0;
  const io = new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      window.clearTimeout(offTimer);
      if (visible) wake();
      else if (amb) offTimer = window.setTimeout(() => stop(2), 6000);
    },
    { threshold: 0.05 },
  );
  io.observe(cover);
  on(document, 'visibilitychange', () => {
    if (document.hidden) stop(0.3);
  });
  on(window, 'pagehide', () => stop(0.1));

  const ro = new ResizeObserver(() => {
    measure();
    if (!raf) draw(performance.now(), !!amb);
  });
  ro.observe(cover);
  ro.observe(object);
  measure();
  draw(performance.now(), false);

  /* ---------- scroll: pin the hero and take it apart ---------- */
  let st: ScrollTrigger | null = null;
  if (!narrow && !embedded && !reduced && ctx.setExplode) {
    gsap.registerPlugin(ScrollTrigger);
    let base = 0;
    st = ScrollTrigger.create({
      trigger: cover,
      start: () =>
        cover.offsetHeight <= window.innerHeight ? 'center center' : 'top top',
      end: '+=100%',
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        const p = self.progress;
        if (p > 0.001) {
          if (!scrollOwned) {
            scrollOwned = true;
            base = userHold ? readExplode() : 0;
            userHold = false;
          }
          write(Math.round(base + (100 - base) * p));
        } else if (scrollOwned) {
          scrollOwned = false;
          write(base, true);
          if (base) userHold = true;
        }
        cover.style.setProperty('--ae-open', p.toFixed(3));
      },
    });
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 400);
    disposers.push(() => window.clearTimeout(refresh));
  }

  return () => {
    window.clearTimeout(offTimer);
    if (amb) {
      amb.stop(0.25);
      amb = null;
      if (!scrollOwned && !userHold) ctx.setExplode?.(0);
    }
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    disposers.forEach((d) => d());
    st?.kill(true);
    canvas.remove();
    button.remove();
    cover.classList.remove('ae-ready', 'ae-playing');
    cover.style.removeProperty('--ae-open');
  };
};

export default mount;
