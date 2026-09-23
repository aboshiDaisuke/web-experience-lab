import * as T from 'three';

export type PanoState = { floor: number; night: boolean };
export type PanoController = {
  set: (s: Partial<PanoState>) => void;
  dispose: () => void;
};

const FLOORS = [
  { floor: 5, file: '13m' },
  { floor: 12, file: '34m' },
  { floor: 20, file: '58m' },
];
const src = (i: number, night: boolean) =>
  `/models/tour/luce/view-${FLOORS[i].file}-${night ? 'night' : 'day'}.jpg`;

/**
 * Drag-to-look 360° view from the model unit's balcony. Switching floors plays a short
 * "elevator" move: the view drifts vertically while the next panorama crossfades in.
 */
export function mountPano(
  el: HTMLElement,
  initial: PanoState,
  onReady: () => void,
): PanoController {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = el.clientWidth < 700;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, narrow ? 1.5 : 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(narrow ? 78 : 62, 1, 0.1, 100);
  const loader = new T.TextureLoader();
  const cache = new Map<string, T.Texture>();
  const load = (url: string) =>
    new Promise<T.Texture>((res, rej) => {
      const hit = cache.get(url);
      if (hit) return res(hit);
      loader.load(
        url,
        (t) => {
          t.colorSpace = T.SRGBColorSpace;
          t.mapping = T.EquirectangularReflectionMapping;
          t.anisotropy = 8;
          cache.set(url, t);
          res(t);
        },
        undefined,
        rej,
      );
    });

  const uniforms = {
    a: { value: null as T.Texture | null },
    b: { value: null as T.Texture | null },
    uMix: { value: 0 },
    lift: { value: 0 },
  };
  const sphere = new T.Mesh(
    new T.SphereGeometry(50, 64, 32),
    new T.ShaderMaterial({
      side: T.BackSide,
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D a;
        uniform sampler2D b;
        uniform float uMix;
        uniform float lift;
        varying vec3 vDir;
        vec2 uvOf(vec3 d) {
          // Blender panorama: image centre looks down +X (right-hand side = three +Z).
          float u = atan(d.z, d.x) / 6.2831853 + 0.5;
          float v = asin(clamp(d.y, -1.0, 1.0)) / 3.1415926 + 0.5;
          return vec2(u, v);
        }
        void main() {
          vec2 uv = uvOf(vDir);
          vec3 ca = texture2D(a, uv + vec2(0.0, lift * uMix)).rgb;
          vec3 cb = texture2D(b, uv - vec2(0.0, lift * (1.0 - uMix))).rgb;
          gl_FragColor = vec4(mix(ca, cb, smoothstep(0.0, 1.0, uMix)), 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(sphere);

  let yaw = -2.4;
  let pitch = 0.07;
  let vy = 0;
  let vp = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let idle = 0;
  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const k = 0.0032 * (camera.fov / 62);
    vy = -(e.clientX - lastX) * k;
    vp = (e.clientY - lastY) * k;
    yaw += vy;
    pitch = T.MathUtils.clamp(pitch + vp, -1.1, 1.1);
    lastX = e.clientX;
    lastY = e.clientY;
    idle = 0;
  };
  const onUp = () => (dragging = false);
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 40) return;
    e.preventDefault();
    camera.fov = T.MathUtils.clamp(camera.fov + e.deltaY * 0.03, 35, 85);
    camera.updateProjectionMatrix();
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });

  const resize = () => {
    renderer.setSize(el.clientWidth, el.clientHeight, false);
    camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(el);

  const state: PanoState = { ...initial };
  let token = 0;
  const idx = (floor: number) =>
    Math.max(0, FLOORS.findIndex((f) => f.floor === floor));
  const go = async (next: PanoState, first = false) => {
    const my = ++token;
    const prevFloor = state.floor;
    const tex = await load(src(idx(next.floor), next.night));
    if (my !== token) return;
    if (first || !uniforms.a.value) {
      uniforms.a.value = tex;
      uniforms.b.value = tex;
      uniforms.uMix.value = 0;
      Object.assign(state, next);
      onReady();
      // warm the cache for instant switching
      FLOORS.forEach((_, i) => {
        void load(src(i, false));
        void load(src(i, true));
      });
      return;
    }
    uniforms.b.value = tex;
    const dir = Math.sign(next.floor - prevFloor);
    const dur = reduced ? 200 : dir ? 1300 : 700;
    const t0 = performance.now();
    Object.assign(state, next);
    await new Promise<void>((done) => {
      const step = () => {
        if (my !== token) return done();
        const k = Math.min(1, (performance.now() - t0) / dur);
        uniforms.uMix.value = k;
        uniforms.lift.value = reduced ? 0 : dir * 0.06 * Math.sin(k * Math.PI);
        if (k < 1) requestAnimationFrame(step);
        else done();
      };
      step();
    });
    if (my !== token) return;
    uniforms.a.value = tex;
    uniforms.uMix.value = 0;
    uniforms.lift.value = 0;
  };
  void go(state, true);

  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    if (!dragging) {
      yaw += vy;
      pitch = T.MathUtils.clamp(pitch + vp, -1.1, 1.1);
      vy *= 0.93;
      vp *= 0.9;
      idle += 1;
      if (idle > 240 && !reduced) yaw += 0.00045;
    }
    camera.quaternion.setFromEuler(new T.Euler(pitch, yaw, 0, 'YXZ'));
    renderer.render(scene, camera);
  };
  tick();

  return {
    set: (s) => void go({ ...state, ...s }),
    dispose: () => {
      token++;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      cache.forEach((t) => t.dispose());
      sphere.geometry.dispose();
      (sphere.material as T.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
