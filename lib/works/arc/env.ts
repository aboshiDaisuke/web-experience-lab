import * as T from 'three';

/**
 * MIRAI ARC — the photo studio the car stands in, and the night city outside.
 *  - studioEnv(): an HDR scene of softboxes for PMREM. The long overhead strip and
 *    the two side strips are what draw the unbroken highlight lines on the paint.
 *  - makeBackdrop(): the visible cyclorama (gradient dome + the same softboxes).
 *  - makeFloor(): studio floor that lets the mirrored car show through near the car.
 *  - nightPanorama(): an equirectangular night skyline painted on a canvas.
 */

type Box = { pos: [number, number, number]; size: [number, number]; rot: [number, number, number]; k: number; tint?: number };

const SOFTBOXES: Box[] = [
  // overhead: one long strip along the car, a wide soft panel behind it
  { pos: [0, 6.2, 0], size: [10, 1.4], rot: [Math.PI / 2, 0, 0], k: 7 },
  { pos: [-0.5, 6.0, 0], size: [6, 4.8], rot: [Math.PI / 2, 0, 0], k: 1.3 },
  // side strips (they run the length of the doors in the reflection)
  { pos: [0, 2.2, 7.5], size: [14, 0.9], rot: [0, Math.PI, 0], k: 3.4 },
  { pos: [0, 2.2, -7.5], size: [14, 0.9], rot: [0, 0, 0], k: 2.4 },
  { pos: [0, 0.9, 8], size: [16, 0.35], rot: [0, Math.PI, 0], k: 1.2 },
  // front / rear verticals
  { pos: [9, 2.4, 2], size: [2.4, 3.2], rot: [0, -Math.PI / 2, 0], k: 2.2 },
  { pos: [-9, 2.4, -2], size: [2.4, 3.2], rot: [0, Math.PI / 2, 0], k: 1.6, tint: 0xfff1e0 },
];

export function studioEnv() {
  const s = new T.Scene();
  const room = new T.Mesh(
    new T.SphereGeometry(20, 32, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      uniforms: {},
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 floorC = vec3(0.03, 0.031, 0.034);
          // walls: a luminous band just above the horizon, falling off to a dark ceiling
          vec3 wall = mix(vec3(0.42, 0.43, 0.45), vec3(0.09, 0.095, 0.1), smoothstep(0.0, 0.16, h));
          wall = mix(wall, vec3(0.015, 0.016, 0.018), smoothstep(0.2, 0.75, h));
          vec3 c = h < 0.0 ? mix(vec3(0.07), floorC, smoothstep(0.0, -0.08, h)) : wall;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  s.add(room);
  // horizon ring: draws the crisp horizontal highlight along the flanks
  const ring = new T.Mesh(
    new T.CylinderGeometry(13, 13, 0.7, 96, 1, true),
    new T.MeshBasicMaterial({ color: new T.Color(0xffffff).multiplyScalar(2.2), side: T.BackSide }),
  );
  ring.position.y = 1.35;
  s.add(ring);
  for (const b of SOFTBOXES) {
    const m = new T.Mesh(
      new T.PlaneGeometry(b.size[0], b.size[1]),
      new T.MeshBasicMaterial({ color: new T.Color(b.tint ?? 0xffffff).multiplyScalar(b.k), side: T.DoubleSide }),
    );
    m.position.set(...b.pos);
    m.rotation.set(...b.rot);
    s.add(m);
  }
  return s;
}

const tonemapChunks = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>`;

export function makeBackdrop() {
  const g = new T.Group();
  const dome = new T.Mesh(
    new T.SphereGeometry(120, 48, 24),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: { uTop: { value: new T.Color('#08090b') }, uMid: { value: new T.Color('#24272b') }, uLow: { value: new T.Color('#1d2024') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow; varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 c = mix(uMid, uTop, smoothstep(0.0, 0.5, h));
          c = mix(c, uLow, smoothstep(0.0, -0.1, h));
          gl_FragColor = vec4(c, 1.0);
          ${tonemapChunks}
        }`,
    }),
  );
  g.add(dome);
  // visible softboxes (seen from inside the car through the glass roof)
  for (const b of SOFTBOXES.slice(0, 2)) {
    const m = new T.Mesh(
      new T.PlaneGeometry(b.size[0], b.size[1]),
      new T.MeshBasicMaterial({ color: new T.Color(0xffffff).multiplyScalar(b.k > 2 ? 1.6 : 0.35), side: T.DoubleSide, toneMapped: false }),
    );
    m.position.set(...b.pos);
    m.rotation.set(...b.rot);
    g.add(m);
  }
  return g;
}

export function makeFloor() {
  const mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uIn: { value: new T.Color('#34373c') },
      uOut: { value: new T.Color('#1d2024') },
      uRefl: { value: 0.22 },
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uIn; uniform vec3 uOut; uniform float uRefl; varying vec3 vW;
      void main(){
        float d = length(vW.xz / vec2(7.5, 5.0));
        vec3 c = mix(uIn, uOut, smoothstep(0.1, 1.6, d));
        float a = mix(1.0 - uRefl, 1.0, smoothstep(0.35, 1.2, d));
        a *= 1.0 - smoothstep(34.0, 78.0, length(vW.xz));
        gl_FragColor = vec4(c, a);
        ${tonemapChunks}
      }`,
  });
  const floor = new T.Mesh(new T.CircleGeometry(80, 96), mat);
  floor.rotation.x = -Math.PI / 2;
  return floor;
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Night city, equirectangular 2:1, painted once: a skyline under a shallow depth
 *  of field, so at the configurator's long lens it reads as bokeh, not pixels. */
export function nightPanorama() {
  const W = 3072;
  const H = 1536;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  const r = rng(7);
  const hz = H * 0.5;
  const sky = c.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#02030a');
  sky.addColorStop(0.55, '#081026');
  sky.addColorStop(0.86, '#1a2240');
  sky.addColorStop(1, '#3b3450');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, hz);
  // city glow on the horizon
  const glowG = c.createLinearGradient(0, hz - 220, 0, hz);
  glowG.addColorStop(0, 'rgba(255,150,90,0)');
  glowG.addColorStop(1, 'rgba(255,150,90,0.18)');
  c.fillStyle = glowG;
  c.fillRect(0, hz - 220, W, 220);
  // soft skyline: dark towers with tiny windows, drawn on a layer and blurred once
  const SH = 420;
  const sk = document.createElement('canvas');
  sk.width = W;
  sk.height = SH;
  const k = sk.getContext('2d')!;
  const layers = [
    { h: [30, 110], col: '#0d1224', lit: 0.1 },
    { h: [40, 190], col: '#090c18', lit: 0.16 },
  ];
  for (const L of layers) {
    let x = 0;
    while (x < W) {
      const bw = 28 + r() * 90;
      const bh = Math.min(SH - 4, L.h[0] + r() * (L.h[1] - L.h[0]) * (r() < 0.12 ? 2.2 : 1));
      k.fillStyle = L.col;
      k.fillRect(x, SH - bh, bw, bh);
      for (let yy = SH - bh + 8; yy < SH - 6; yy += 9) {
        for (let xx = x + 4; xx < x + bw - 4; xx += 7) {
          if (r() < L.lit) {
            const warm = r() < 0.72;
            k.fillStyle = warm ? `rgba(255,${185 + r() * 40},${120 + r() * 50},${0.45 + r() * 0.5})` : `rgba(170,200,255,${0.4 + r() * 0.5})`;
            k.fillRect(xx, yy, 3, 3.5);
          }
        }
      }
      x += bw + r() * 8;
    }
  }
  c.filter = 'blur(3px)';
  c.drawImage(sk, 0, hz - SH);
  c.filter = 'none';
  // wet ground
  const gr = c.createLinearGradient(0, hz, 0, H);
  gr.addColorStop(0, '#15151d');
  gr.addColorStop(0.12, '#08080c');
  gr.addColorStop(1, '#030304');
  c.fillStyle = gr;
  c.fillRect(0, hz, W, H - hz);
  c.globalCompositeOperation = 'lighter';
  // bokeh: street lamps, signals and headlights, out of focus
  const bokeh = (x: number, y: number, rad: number, col: string, a: number) => {
    const g = c.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(0.75, `rgba(${col},${a * 0.8})`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, rad, 0, Math.PI * 2);
    c.fill();
  };
  const cols = ['255,176,92', '255,196,120', '255,150,80', '150,190,255', '255,90,70', '120,230,200'];
  for (let i = 0; i < 260; i++) {
    const x = r() * W;
    const y = hz - 10 - Math.pow(r(), 2.2) * 220;
    const col = cols[Math.floor(Math.pow(r(), 1.6) * cols.length)];
    bokeh(x, y, 6 + r() * 26, col, 0.12 + r() * 0.3);
  }
  // their long reflections on the wet road
  for (let i = 0; i < 140; i++) {
    const x = r() * W;
    const col = cols[Math.floor(Math.pow(r(), 1.6) * cols.length)];
    const g = c.createLinearGradient(0, hz, 0, hz + 60 + r() * 200);
    g.addColorStop(0, `rgba(${col},${0.08 + r() * 0.14})`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.fillRect(x, hz, 3 + r() * 6, 260);
  }
  c.globalCompositeOperation = 'source-over';
  const tex = new T.CanvasTexture(cv);
  tex.mapping = T.EquirectangularReflectionMapping;
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/** Reflection scene for the night: the panorama plus two dim street-light panels,
 *  so the body keeps its shape instead of going black. */
export function nightEnv(pano: T.Texture) {
  const s = new T.Scene();
  const t = pano.clone();
  t.mapping = T.UVMapping;
  t.needsUpdate = true;
  const sph = new T.Mesh(new T.SphereGeometry(20, 48, 24), new T.MeshBasicMaterial({ map: t, side: T.BackSide }));
  sph.scale.x = -1;
  s.add(sph);
  const add = (pos: [number, number, number], size: [number, number], rot: [number, number, number], col: number, k: number) => {
    const m = new T.Mesh(new T.PlaneGeometry(...size), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k), side: T.DoubleSide }));
    m.position.set(...pos);
    m.rotation.set(...rot);
    s.add(m);
  };
  add([0, 7, 0], [9, 0.8], [Math.PI / 2, 0, 0], 0x9fb6ff, 1.6);
  add([2, 3, 8], [10, 0.5], [0, Math.PI, 0], 0xffb070, 1.4);
  add([-3, 3, -8], [10, 0.5], [0, 0, 0], 0x88a8ff, 1.0);
  return { scene: s, dispose: () => t.dispose() };
}

/** Soft radial glow texture (lamp pools on the floor). */
export function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  const t = new T.CanvasTexture(cv);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
