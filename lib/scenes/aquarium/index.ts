import * as T from 'three';
import { loadFish, type SpeciesId } from './fish';
import { causticInjector, createBubbles, createCaustics, createGodRays, createMotes, createSurface } from './water';
import { LOW, createBackdrop, createGravel, createPlants, createSand, dressWood, loadHardscape, sandHeight } from './scape';
import { BOUNDS, Tank } from './school';
import { createPost } from './post';

/*
 * The hero: a planted tropical aquarium seen through its front glass.
 * Fish are Blender-built meshes (tools/blender/fish.py) swimming by shader;
 * light from the lamp is split by the surface into computed caustics and
 * slanting shafts, the underside of the surface mirrors the tank, and the
 * water tints everything by how far through it you look. The frame is then
 * photographed (post.ts): focus, bloom, grade. Hover near the glass and the
 * fish come to look while the lens pulls focus to them; tap and they scatter.
 */

const SURFACE = 46;
const BACK = -48;

function underwaterEnv(renderer: T.WebGLRenderer) {
  const scene = new T.Scene();
  const mat = new T.ShaderMaterial({
    side: T.BackSide,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 c = mix(vec3(0.05, 0.16, 0.15), vec3(0.2, 0.62, 0.66), smoothstep(-0.2, 0.5, y));
        c = mix(c, vec3(0.03, 0.03, 0.025), smoothstep(-0.1, -0.7, y));
        // the lamp above the tank
        c += vec3(3.2, 3.1, 2.9) * smoothstep(0.86, 0.97, y);
        c += vec3(0.5, 0.8, 0.8) * exp(-pow(vDir.z + 0.9, 2.0) * 8.0) * smoothstep(-0.1, 0.3, y);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new T.Mesh(new T.SphereGeometry(10, 48, 24), mat));
  const pm = new T.PMREMGenerator(renderer);
  const env = pm.fromScene(scene, 0.02).texture;
  pm.dispose();
  mat.dispose();
  return env;
}

export async function mountAquarium(el: HTMLElement, base: string) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 760px)').matches;
  // antialiasing happens in the multisampled HDR target the lens works from
  const renderer = new T.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.6));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.VSMShadowMap;

  const scene = new T.Scene();
  // the water's colour is worked out per surface (water.ts); this only shows
  // where the surface's mirror runs out, so it's the water by the waterline
  scene.background = new T.Color().setRGB(0.1, 0.34, 0.34);
  const env = underwaterEnv(renderer);
  const post = createPost(renderer, { bloom: 0.2, dof: true, samples: 4 });

  const camera = new T.PerspectiveCamera(36, 1, 1, 400);
  camera.layers.enable(LOW);
  const look = new T.Vector3(0, 22, -20);

  // the lamp: one shadowing key light plus the glow of the water itself
  const sun = new T.DirectionalLight(0xfff6e8, 3.6);
  sun.position.set(-8, 120, 6);
  sun.target.position.set(0, 0, -22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 34, bottom: -34, near: 40, far: 160 });
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 14;
  sun.shadow.blurSamples = 16;
  sun.shadow.intensity = 0.7;
  sun.shadow.camera.layers.enable(LOW);
  // plants sway slowly and fish are small: the shadows can keep half time
  renderer.shadowMap.autoUpdate = false;
  scene.add(sun, sun.target);
  scene.add(new T.HemisphereLight(0x8fd8d4, 0x241f16, 0.7));

  const caustics = createCaustics(renderer, small ? 512 : 768);
  const causticStrength = { value: 0.7 };
  const inject = causticInjector(caustics.texture, causticStrength, SURFACE);

  scene.add(createBackdrop(SURFACE, BACK));
  const surface = createSurface(SURFACE, BACK, small ? 0.34 : 0.5);
  surface.getReflectionCamera(camera).layers.disable(LOW);
  scene.add(surface);
  // on open sand the net of light is gentler than on leaves and stone
  scene.add(createSand(causticInjector(caustics.texture, { value: 0.5 }, SURFACE)));
  scene.add(createGravel(causticInjector(caustics.texture, { value: 0.5 }, SURFACE), small ? 0.6 : 1));
  const sway = { uTime: { value: 0 }, uPush: { value: 0 }, uPushAt: { value: new T.Vector3() }, uSurface: { value: SURFACE } };
  scene.add(createPlants(sway, inject, small ? 0.6 : 1));

  const rays = createGodRays(small ? 7 : 11, { x: 55, top: SURFACE + 2, z0: -40, z1: -8 });
  scene.add(rays);
  const motes = createMotes(small ? 500 : 1100, new T.Box3(new T.Vector3(-60, 2, -44), new T.Vector3(60, SURFACE, 4)));
  scene.add(motes);
  const bubbles = createBubbles(46, new T.Vector3(47, sandHeight(47, -34) + 0.5, -34), SURFACE);
  scene.add(bubbles.mesh);

  const tank = new Tank();
  const counts: [SpeciesId, number][] = [
    ['neon', small ? 28 : 44],
    ['rummy', small ? 14 : 22],
    ['gourami', small ? 4 : 6],
  ];
  const [hardscape, ...kinds] = await Promise.all([
    loadHardscape(base, env, inject),
    ...counts.map(([id, n]) => loadFish(base, id, n, env, inject)),
  ]);
  scene.add(hardscape);
  scene.add(dressWood(hardscape, sway, inject, small ? 0.6 : 1));
  for (const k of kinds) k.meshes.forEach((mesh) => scene.add(mesh));

  // what the fish see around them: the tank itself, captured once from its
  // middle, so silver flanks and corneas reflect plants, stone and light
  {
    kinds.forEach((k) => k.meshes.forEach((m) => (m.visible = false)));
    const low: T.Object3D[] = [];
    scene.traverse((o) => o.layers.isEnabled(LOW) && !o.layers.isEnabled(0) && low.push(o));
    low.forEach((o) => o.layers.enable(0));
    caustics.update(0);
    renderer.shadowMap.needsUpdate = true;
    const pm = new T.PMREMGenerator(renderer);
    const around = pm.fromScene(scene, 0.03, 1, 300, { size: 256, position: new T.Vector3(0, 26, -20) }).texture;
    pm.dispose();
    low.forEach((o) => o.layers.disable(0));
    kinds.forEach((k) =>
      k.meshes.forEach((m) => {
        m.visible = true;
        const mat = m.material as T.MeshPhysicalMaterial;
        mat.envMap = around;
      }),
    );
  }
  for (const k of kinds) tank.add(k);
  // let the schools find their places before anyone sees them
  for (let i = 0; i < 240; i++) tank.step(1 / 30);
  tank.write();

  // camera framing: show about 90 cm of tank on wide screens, less on phones
  const parallax = new T.Vector2();
  const parallaxNow = new T.Vector2();
  let focusRest = -22;
  const frame = () => {
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false);
    post.setSize();
    const pr = renderer.getPixelRatio() * surface.userData.scale;
    surface.getRenderTarget().setSize(Math.ceil(w * pr), Math.ceil(h * pr));
    const aspect = w / h;
    // phones: closer to the glass with a taller view, from the surface down to the gravel
    const portrait = aspect < 1;
    const dist = portrait ? 60 : 84;
    // phones look down the sand path between the stones, into open water
    look.set(portrait ? 4 : 0, 22, -20);
    camera.userData.height = portrait ? 25 : 23;
    if (portrait) camera.fov = 62;
    else {
      const hfov = 2 * Math.atan(94 / 2 / dist);
      camera.fov = T.MathUtils.clamp(T.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect)), 28, 60);
    }
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    camera.userData.dist = dist;
    // focus a little in front of the middle of the tank
    focusRest = look.z - 2;
  };
  // ?aqdebug=<species>[,index] freezes the tank and looks at one fish from the side
  const debug = new URLSearchParams(location.search).get('aqdebug');
  // ?aqdebug=studio[,yaw[,species]] lines one fish of each species up in open
  // water; naming a species fills the frame with it
  const studio = debug?.startsWith('studio')
    ? { yaw: +(debug.split(',')[1] ?? 0), focus: debug.split(',')[2] ?? '' }
    : null;
  // close-ups sit far inside the lens's focus range
  if (studio) post.opts.dof = false;
  const STUDIO: Record<string, [number, number, number]> = {
    angel: [-11, 27, -8],
    discus: [12, 27, -8],
    gourami: [0, 27, -8],
    neon: [-7, 12, -4],
    rummy: [9, 12, -4],
  };
  const pose = () => {
    for (const k of tank.kinds)
      k.fish.forEach((f, i) => {
        const at = STUDIO[k.kind.id];
        if (i === 0 && at) {
          f.p.set(...at);
          f.fwd.set(Math.cos(studio!.yaw), 0, -Math.sin(studio!.yaw));
          f.v.copy(f.fwd).multiplyScalar(k.pr.cruise);
          f.bank = 0;
          f.bend = 0;
        } else f.p.set(0, -200, 0);
      });
  };
  const place = () => {
    if (studio) {
      const at = STUDIO[studio.focus];
      if (at) {
        const size = tank.kinds.find((k) => k.kind.id === studio.focus)!.fish[0].scale;
        // a 4th value zooms towards the head
        const zoom = +(debug!.split(',')[3] ?? 0);
        const x = at[0] - size * 0.08 + zoom * size * 0.36;
        camera.position.set(x, at[1] + size * 0.02, at[2] + size * (1.6 - zoom * 1.25));
        camera.lookAt(x, at[1], at[2]);
      } else {
        camera.position.set(0, 21, 38);
        camera.lookAt(0, 21, -8);
      }
      return;
    }
    if (debug) {
      const [id, n = '0'] = debug.split(',');
      const k = tank.kinds.find((x) => x.kind.id === id);
      const f = k?.fish[+n];
      if (f) {
        const side = new T.Vector3().crossVectors(f.fwd, new T.Vector3(0, 1, 0)).normalize();
        camera.position.copy(f.p).addScaledVector(side, f.scale * 2.2);
        camera.lookAt(f.p);
        return;
      }
    }
    parallaxNow.lerp(parallax, 0.04);
    camera.position.set(look.x + parallaxNow.x * 4, camera.userData.height + parallaxNow.y * 2, look.z + camera.userData.dist);
    camera.lookAt(look);
  };
  frame();
  place();
  const ro = new ResizeObserver(frame);
  ro.observe(el);

  // pointer: a point just behind the glass under the finger
  const ray = new T.Raycaster();
  const glass = new T.Plane(new T.Vector3(0, 0, 1), -BOUNDS.z1 - 3);
  const hit = new T.Vector3();
  const toTank = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
    parallax.set(nx, ny);
    ray.setFromCamera(new T.Vector2(nx, ny), camera);
    if (!ray.ray.intersectPlane(glass, hit)) return null;
    hit.x = T.MathUtils.clamp(hit.x, -BOUNDS.x + 6, BOUNDS.x - 6);
    hit.y = T.MathUtils.clamp(hit.y, 10, BOUNDS.top - 3);
    return hit.clone();
  };
  let press: { x: number; y: number; at: number } | null = null;
  let hoverUntil = 0;
  const onMove = (e: PointerEvent) => {
    const p = toTank(e);
    if (!p) return;
    tank.pointer = p;
    hoverUntil = performance.now() + (e.pointerType === 'mouse' ? 1e9 : 2500);
    sway.uPushAt.value.copy(p);
  };
  const onDown = (e: PointerEvent) => {
    press = { x: e.clientX, y: e.clientY, at: performance.now() };
  };
  const onUp = (e: PointerEvent) => {
    if (!press) return;
    const tapped = Math.hypot(e.clientX - press.x, e.clientY - press.y) < 10 && performance.now() - press.at < 500;
    press = null;
    if (!tapped) return;
    const p = toTank(e);
    if (!p) return;
    tank.tap(p);
    sway.uPushAt.value.copy(p);
    sway.uPush.value = 1;
    knock = 1;
  };
  const onLeave = () => {
    tank.pointer = null;
    parallax.set(0, 0);
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointerleave', onLeave);

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(el);

  el.appendChild(renderer.domElement);
  if (debug) Object.assign(window, { __aq: { renderer, caustics, scene, camera, post, surface } });
  let knock = 0;
  let time = 0;
  let frames = 0;
  let prev = performance.now();
  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    if (!visible || document.hidden) return;
    const speed = reduced ? 0.35 : 1;
    time += dt * speed;
    if (tank.pointer && now > hoverUntil) tank.pointer = null;
    if (!debug || studio) tank.step(dt * speed);
    if (studio) pose();
    tank.write();
    for (const k of kinds) k.uniforms.uTime.value = time;
    sway.uTime.value = time;
    sway.uPush.value *= Math.exp(-dt * 1.5);
    knock *= Math.exp(-dt * 8);
    caustics.update(time);
    (rays.material as T.ShaderMaterial).uniforms.uTime.value = time;
    surface.material.uniforms.uTime.value = time;
    (motes.material as T.ShaderMaterial).uniforms.uTime.value = time;
    bubbles.update(time, dt * speed);
    place();
    // a knock on the glass jolts the view for a moment
    if (knock > 0.01) camera.position.x += Math.sin(now * 0.09) * knock * 0.25;
    // the lens pulls focus to the glass when fish come up to a finger
    const focusZ = tank.pointer ? tank.pointer.z - 4 : focusRest;
    const want = camera.position.z - focusZ;
    post.focus.value += (want - post.focus.value) * Math.min(1, dt * 2.5);
    if (++frames % 2 === 0) renderer.shadowMap.needsUpdate = true;
    post.render(scene, camera, time);
  };
  tick();

  return {
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onLeave);
      caustics.dispose();
      post.dispose();
      surface.dispose();
      scene.traverse((o) => {
        const m = o as T.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mm) => {
          Object.values(mm).forEach((v) => (v as T.Texture)?.isTexture && (v as T.Texture).dispose());
          mm.dispose();
        });
      });
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
