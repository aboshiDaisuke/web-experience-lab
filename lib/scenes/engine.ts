import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { sculpture, product, house, room } from './models';
import { loadModel } from './load-model';
import type { SceneKind } from '@/components/scene';
type State = {
  view: string;
  night: boolean;
  theme: string;
  onPick?: (v: string) => void;
  progress?: number;
  highlight?: string;
};
export async function mountScene(
  el: HTMLDivElement,
  kind: SceneKind,
  get: () => State,
) {
  const mobile = matchMedia('(max-width:700px)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new T.WebGLRenderer({
    antialias: !mobile,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.7));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  el.appendChild(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(38, 1, 0.1, 80);
  const pmrem = new T.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const env = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = env.texture;
  roomEnv.dispose();
  pmrem.dispose();
  const ambient = new T.HemisphereLight(0xe6f5ff, 0x25221c, 2);
  scene.add(ambient);
  const light = new T.DirectionalLight(0xffffff, 4);
  light.position.set(3, 5, 4);
  scene.add(light);
  const warm = new T.PointLight(0xffb45c, 0, 12);
  warm.position.set(0, 1, 0);
  scene.add(warm);
  let model =
    kind === 'product'
      ? product()
      : kind === 'house'
        ? house()
        : kind === 'room'
          ? room()
          : sculpture();
  scene.add(model);
  let modelParts: { node: T.Object3D; start: T.Vector3 }[] = [];
  const cacheParts = () => {
    modelParts = [];
    model.traverse((node) => {
      if (node instanceof T.Mesh)
        modelParts.push({ node, start: node.position.clone() });
    });
  };
  cacheParts();
  const asset =
    kind === 'product'
      ? 'product'
      : kind === 'house'
        ? 'house'
        : kind === 'room'
          ? 'room'
          : null;
  const abort = new AbortController();
  let dead = false;
  const disposeModel = (o: T.Object3D) =>
    o.traverse((n) => {
      if (n instanceof T.Mesh) {
        n.geometry.dispose();
        (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => {
          for (const v of Object.values(m))
            if (v instanceof T.Texture) v.dispose();
          m.dispose();
        });
      }
    });
  if (asset)
    loadModel(`/models/${asset}.glb`, renderer, abort.signal)
      .then((replacement) => {
        if (!replacement) return;
        if (dead) {
          disposeModel(replacement);
          return;
        }
        scene.remove(model);
        disposeModel(model);
        model = replacement;
        scene.add(model);
        cacheParts();
        draw();
      })
      .catch(() => {});
  camera.position.set(0, 0, 8);
  if (kind === 'hero') {
    model.position.set(0, 0, 0);
    model.scale.setScalar(mobile ? 0.8 : 0.9);
    camera.position.z = 9;
  }
  if (kind === 'house' || kind === 'room') camera.position.set(6, 4.8, 7);
  if (kind === 'product') camera.position.set(3, 1.7, 5.5);
  const controls =
    kind === 'house' || kind === 'room'
      ? new OrbitControls(camera, renderer.domElement)
      : null;
  if (controls) {
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = !reduced;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = 1.5;
    controls.target.set(0, 0.6, 0);
    controls.update();
  }
  const ray = new T.Raycaster();
  const pointer = new T.Vector2();
  let px = 0,
    py = 0,
    dragStart = [0, 0],
    dragging = false;
  let lastView = 'EXTERIOR',
    lastNight = false,
    lastTheme = '',
    lastHighlight = '';
  let transition = false;
  const targetPos = new T.Vector3();
  const targetLook = new T.Vector3();
  const cursor = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    px = (e.clientX - r.left) / r.width - 0.5;
    py = (e.clientY - r.top) / r.height - 0.5;
    if (reduced) draw();
  };
  const down = (e: PointerEvent) => {
    dragStart = [e.clientX, e.clientY];
    dragging = true;
    transition = false;
  };
  const up = (e: PointerEvent) => {
    dragging = false;
    if (
      !['room', 'product'].includes(kind) ||
      Math.hypot(e.clientX - dragStart[0], e.clientY - dragStart[1]) > 8
    )
      return;
    const r = el.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    const hit = ray
      .intersectObject(model, true)
      .find((h) =>
        (kind === 'product'
          ? ['shell', 'core', 'coil', 'top', 'base']
          : ['PC', 'CAMERA', 'BOOKS', 'TV']
        ).includes(h.object.name),
      );
    if (hit) get().onPick?.(hit.object.name);
  };
  el.addEventListener('pointermove', cursor);
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  let visible = false,
    frame = 0;
  let tick = 0;
  function draw() {
    if (dead) return;
    const s = get();
    const rect = el.getBoundingClientRect();
    const time = performance.now() * 0.00015;
    const progress =
      s.progress ??
      T.MathUtils.clamp(
        -(el.closest('.product-scroll') || el).getBoundingClientRect().top /
          Math.max(
            1,
            (el.closest('.product-scroll') || el).clientHeight - innerHeight,
          ),
        0,
        1,
      );
    if (kind === 'hero' || kind === 'final' || kind === 'capability') {
      model.rotation.y = reduced ? 0.25 : time + px * 0.15;
      model.rotation.x = reduced ? 0.2 : Math.sin(time) * 0.17 + py * 0.12;
      if (kind === 'hero') {
        const p = Math.min(1, Math.max(0, -rect.top / innerHeight));
        model.position.z = -p * 3;
        model.rotation.z = p * 0.5;
      }
    }
    if (kind === 'adaptive') {
      const colors: Record<string, number> = {
        CORPORATE: 0x477eff,
        LUXURY: 0xcbaa75,
        CREATIVE: 0xcaff68,
        FUTURE: 0x76f8ef,
        PLAYFUL: 0xff6333,
      };
      if (lastTheme !== s.theme) {
        lastTheme = s.theme;
        model.traverse((n) => {
          if (n instanceof T.Mesh) {
            n.material.color.setHex(colors[s.theme]);
            n.material.wireframe = s.theme === 'FUTURE';
            n.material.roughness = s.theme === 'LUXURY' ? 0.15 : 0.4;
          }
        });
        model.scale.setScalar(s.theme === 'PLAYFUL' ? 0.8 : 1);
      }
      model.rotation.y = reduced ? 0 : time;
      model.rotation.z = s.theme === 'PLAYFUL' ? Math.sin(time) * 0.5 : 0;
    }
    if (kind === 'product') {
      if (s.highlight && s.highlight !== lastHighlight) {
        lastHighlight = s.highlight;
        model.traverse((node) => {
          if (
            node instanceof T.Mesh &&
            node.material instanceof T.MeshStandardMaterial
          ) {
            node.material.emissive.setHex(
              node.name === s.highlight ? 0x39575e : 0x000000,
            );
            node.material.emissiveIntensity =
              node.name === s.highlight ? 0.6 : 0;
          }
        });
      }
      const explode =
        s.progress !== undefined
          ? progress
          : reduced
            ? 0
            : Math.sin(
                T.MathUtils.clamp((progress - 0.3) / 0.6, 0, 1) * Math.PI,
              );
      model.rotation.y =
        s.progress !== undefined
          ? progress * 0.6
          : reduced
            ? 0
            : progress * Math.PI * 1.6;
      camera.position.z =
        s.progress !== undefined
          ? 6.5
          : 5.5 - Math.sin(progress * Math.PI) * 1.3;
      modelParts.forEach(({ node, start }, i) => {
        node.position.copy(start);
        if (node.name === 'shell' || node.name === 'groove')
          node.position.x += explode * 1.6;
        else if (node.name === 'top' || node.name === 'light')
          node.position.y += explode * 1.2;
        else if (node.name === 'base') node.position.y -= explode * 0.75;
        else if (!['core', 'coil'].includes(node.name)) {
          node.position.addScaledVector(
            start.clone().normalize(),
            explode * (0.8 + (i % 3) * 0.2),
          );
        }
      });
      camera.lookAt(0, 0, 0);
    }
    if (kind === 'house') {
      if (lastView !== s.view) {
        lastView = s.view;
        transition = true;
        const positions: Record<string, number[]> = {
          EXTERIOR: [6, 4.8, 7],
          LIVING: [-1, 1.7, 3.3],
          BEDROOM: [2, 1.8, 3.2],
          NIGHT: [5, 3.6, 6],
        };
        targetPos.set(...(positions[s.view] as [number, number, number]));
        targetLook.set(
          s.view === 'LIVING' ? -1 : s.view === 'BEDROOM' ? 1.3 : 0,
          0.65,
          0,
        );
      }
      if (transition && !dragging) {
        camera.position.lerp(targetPos, reduced ? 1 : 0.055);
        controls!.target.lerp(targetLook, reduced ? 1 : 0.055);
        if (camera.position.distanceTo(targetPos) < 0.025) transition = false;
      }
      if (lastNight !== s.night) {
        lastNight = s.night;
        ambient.intensity = s.night ? 0.2 : 2;
        light.intensity = s.night ? 0.4 : 4;
        warm.intensity = s.night ? 14 : 0;
      }
    }
    controls?.update();
    renderer.render(scene, camera);
  }
  function loop() {
    frame = 0;
    if (!visible || document.hidden || dead) return;
    tick++;
    if (!mobile || tick % 2 === 0) draw();
    if (!reduced) frame = requestAnimationFrame(loop);
  }
  function start() {
    if (!frame && visible && !document.hidden)
      frame = requestAnimationFrame(loop);
  }
  const visibility = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) start();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    { threshold: 0 },
  );
  visibility.observe(el);
  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else start();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const resize = new ResizeObserver(() => {
    if (!el.clientWidth || !el.clientHeight) return;
    renderer.setSize(el.clientWidth, el.clientHeight);
    camera.aspect = el.clientWidth / el.clientHeight;
    camera.updateProjectionMatrix();
    draw();
  });
  resize.observe(el);
  const onChange = () => {
    if (reduced) draw();
  };
  controls?.addEventListener('change', onChange);
  const mutation = new MutationObserver(() => {
    if (reduced) draw();
  });
  mutation.observe(el.closest('section') || el, {
    attributes: true,
    subtree: true,
    attributeFilter: [
      'data-view',
      'data-night',
      'data-theme',
      'data-progress',
      'data-highlight',
    ],
  });
  return () => {
    dead = true;
    abort.abort();
    cancelAnimationFrame(frame);
    visibility.disconnect();
    resize.disconnect();
    mutation.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    el.removeEventListener('pointermove', cursor);
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointerup', up);
    controls?.dispose();
    disposeModel(model);
    env.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
