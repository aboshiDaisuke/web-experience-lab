// Procedural material textures for the shelf (walnut grain, book cloth, paper), rendered once to data URLs.

function makeNoise(seed: number) {
  const p = new Uint8Array(512);
  let s = seed >>> 0 || 1;
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const val = new Float32Array(256).map(() => rand());
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const a = val[p[(p[xi & 255] + yi) & 511] & 255];
    const b = val[p[(p[(xi + 1) & 255] + yi) & 511] & 255];
    const c = val[p[(p[xi & 255] + yi + 1) & 511] & 255];
    const d = val[p[(p[(xi + 1) & 255] + yi + 1) & 511] & 255];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Walnut grain. `vertical` swaps the grain direction for uprights. */
export function wood(opts: { w?: number; h?: number; vertical?: boolean; seed?: number; tone?: number } = {}) {
  const { w = 1024, h = 256, vertical = false, seed = 7, tone = 1 } = opts;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const n = makeNoise(seed);
  const n2 = makeNoise(seed * 3 + 11);
  const dark = [34, 20, 12];
  const mid = [74, 45, 26];
  const light = [118, 78, 44];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // along = direction of grain, across = perpendicular
      const along = vertical ? y : x;
      const across = vertical ? x : y;
      const warp = n(along * 0.004, across * 0.012) * 26 + n(along * 0.02, across * 0.05) * 4;
      const ring = Math.sin((across + warp) * 0.42) * 0.5 + 0.5;
      const ring2 = Math.pow(Math.sin((across + warp * 1.7) * 0.11) * 0.5 + 0.5, 3);
      const fig = n2(along * 0.01, across * 0.2);
      const pore = n2(along * 0.6, across * 1.8) > 0.82 ? -0.18 : 0;
      let t = 0.38 + ring * 0.2 + ring2 * 0.28 + (fig - 0.5) * 0.22 + pore;
      t = Math.max(0, Math.min(1, t * tone));
      const [a, b] = t < 0.5 ? [dark, mid] : [mid, light];
      const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const i = (y * w + x) * 4;
      img.data[i] = a[0] + (b[0] - a[0]) * k;
      img.data[i + 1] = a[1] + (b[1] - a[1]) * k;
      img.data[i + 2] = a[2] + (b[2] - a[2]) * k;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.86);
}

/** Book-cloth weave: transparent tile to layer over a colour. */
export function weave(size = 96) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const n = makeNoise(99);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = (x % 2 === 0 ? 1 : -1) * (y % 2 === 0 ? 1 : -1);
      const g = n(x * 0.3, y * 0.3) - 0.5;
      const v = warp * 0.5 + g * 1.4;
      const i = (y * size + x) * 4;
      const light = v > 0;
      img.data[i] = light ? 255 : 0;
      img.data[i + 1] = light ? 246 : 0;
      img.data[i + 2] = light ? 230 : 0;
      img.data[i + 3] = Math.min(255, Math.abs(v) * 46);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

/** Paper fibre grain. */
export function paper(size = 160) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const n = makeNoise(5);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = n(x * 0.35, y * 0.9) * 0.35 + n(x * 1.3, y * 1.3) * 0.65;
      const i = (y * size + x) * 4;
      const v = f - 0.5;
      img.data[i] = v > 0 ? 255 : 60;
      img.data[i + 1] = v > 0 ? 250 : 40;
      img.data[i + 2] = v > 0 ? 240 : 20;
      img.data[i + 3] = Math.min(255, Math.abs(v) * 34);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

export function applyTextures(root: HTMLElement) {
  const set = () => {
    root.style.setProperty('--lib-wood', `url(${wood()})`);
    root.style.setProperty('--lib-wood-v', `url(${wood({ w: 160, h: 1024, vertical: true, seed: 21 })})`);
    root.style.setProperty('--lib-weave', `url(${weave()})`);
    root.style.setProperty('--lib-grain', `url(${paper()})`);
  };
  set();
}
