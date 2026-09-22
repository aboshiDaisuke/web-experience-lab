import * as T from 'three';

type Events = {
  onFocus: (index: number, hovered: boolean) => void;
  onOpen: (index: number) => void;
};

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  uniform float uVelocity;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec3 p = position;
    float wave = sin(uv.x * 3.14159) * uVelocity;
    p.y += wave * 0.35;
    p += normalize(vec3(p.x, 0.0, p.z)) * uHover * 0.14 * sin(uv.y * 3.14159) * sin(uv.x * 3.14159);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uHover;
  uniform float uReveal;
  uniform vec2 uPointer;
  uniform vec3 uFog;
  uniform float uNear;
  uniform float uFar;
  uniform float uMirror;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vec2 uv = vUv;
    float d = distance(uv, uPointer);
    float ripple = sin(d * 38.0 - uTime * 5.0) * exp(-d * 6.0) * uHover;
    uv += normalize(uv - uPointer + 1e-4) * ripple * 0.006;
    float shift = 0.004 * uHover + abs(ripple) * 0.01;
    vec3 col = vec3(
      texture2D(uMap, uv + vec2(shift, 0.0)).r,
      texture2D(uMap, uv).g,
      texture2D(uMap, uv - vec2(shift, 0.0)).b
    );
    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(gray) * vec3(0.8, 0.84, 1.0), col, 0.7 + 0.3 * uHover);
    col *= 0.9 + 0.12 * uHover;
    float alpha = 1.0;
    if (!gl_FrontFacing) {
      col = mix(uFog, col, 0.35);
      alpha = 0.28;
    }
    vec2 e = min(vUv, 1.0 - vUv);
    float edge = 1.0 - smoothstep(0.0, 0.006, min(e.x, e.y * 1.6));
    col = mix(col, vec3(0.66, 0.71, 1.0), edge * (0.35 + 0.65 * uHover));
    float fog = smoothstep(uNear, uFar, vDepth);
    col = mix(col, uFog, fog * 0.6);
    alpha *= 1.0 - fog * 0.55;
    if (uMirror > 0.5) alpha *= pow(1.0 - vUv.y, 2.4) * 0.24;
    gl_FragColor = vec4(col, alpha * uReveal);
  }
`;

export async function mountGalleryRing(
  el: HTMLDivElement,
  images: string[],
  events: Events,
) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => el.clientWidth < 820;
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, narrow() ? 1.5 : 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  el.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(34, 1, 0.1, 60);
  const fog = new T.Color('#121633');
  const count = images.length;
  const radius = 4.7;
  const cardW = 2.5;
  const cardH = cardW * 0.625;
  const ring = new T.Group();
  const tilt = new T.Group();
  const reflection = new T.Group();
  reflection.scale.y = -1;
  reflection.position.y = -cardH - 0.16;
  tilt.add(ring, reflection);
  scene.add(tilt);

  const loader = new T.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const cards: T.Mesh<T.BufferGeometry, T.ShaderMaterial>[] = [];
  const mirrors: T.ShaderMaterial[] = [];

  images.forEach((src, i) => {
    const angle = (i / count) * Math.PI * 2;
    const geo = new T.PlaneGeometry(cardW, cardH, 48, 1);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      const theta = angle + x / radius;
      pos.setXYZ(v, Math.sin(theta) * radius, pos.getY(v), Math.cos(theta) * radius);
    }
    geo.computeVertexNormals();
    const map = loader.load(src, (t) => {
      t.needsUpdate = true;
    });
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = Math.min(8, maxAniso);
    map.generateMipmaps = true;
    const mat = new T.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      side: T.DoubleSide,
      transparent: true,
      uniforms: {
        uMap: { value: map },
        uTime: { value: 0 },
        uHover: { value: 0 },
        uVelocity: { value: 0 },
        uReveal: { value: reduced ? 1 : 0 },
        uPointer: { value: new T.Vector2(0.5, 0.5) },
        uFog: { value: new T.Vector3(fog.r, fog.g, fog.b) },
        uNear: { value: 12.5 },
        uFar: { value: 21 },
        uMirror: { value: 0 },
      },
    });
    const mesh = new T.Mesh(geo, mat);
    mesh.userData.index = i;
    ring.add(mesh);
    cards.push(mesh);
    const mirrorMat = mat.clone();
    mirrorMat.uniforms = { ...mat.uniforms, uMirror: { value: 1 } };
    const mirror = new T.Mesh(geo, mirrorMat);
    mirror.renderOrder = -1;
    reflection.add(mirror);
    mirrors.push(mirrorMat);
  });

  const dustCount = narrow() ? 260 : 620;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    const r = 3 + Math.random() * 9;
    const a = Math.random() * Math.PI * 2;
    dustPos.set([Math.cos(a) * r, (Math.random() - 0.5) * 7, Math.sin(a) * r - 1], i * 3);
    dustSeed[i] = Math.random();
  }
  const dustGeo = new T.BufferGeometry();
  dustGeo.setAttribute('position', new T.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('seed', new T.BufferAttribute(dustSeed, 1));
  const dustMat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.25 + seed * 40.0) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.2 + seed * 2.4) * uScale * (9.0 / -mv.z);
        vAlpha = (0.25 + 0.75 * seed) * (0.6 + 0.4 * sin(uTime * 0.8 + seed * 30.0));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(0.66, 0.71, 1.0, smoothstep(0.5, 0.0, d) * vAlpha * 0.5);
      }
    `,
  });
  const dust = new T.Points(dustGeo, dustMat);
  scene.add(dust);

  const layout = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (narrow()) {
      camera.position.set(0, 1.2, 22);
      tilt.position.set(0, 3.1, 0);
    } else {
      camera.position.set(0, 1.4, 15.5);
      tilt.position.set(Math.min(3.6, 1.4 + (w / h - 1.2) * 3.4), 1.05, 0);
    }
    camera.lookAt(0, 0.4, 0);
    camera.updateProjectionMatrix();
  };
  tilt.rotation.set(0.16, 0, -0.07);
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(el);

  const ray = new T.Raycaster();
  const ndc = new T.Vector2(9, 9);
  const parallax = new T.Vector2();
  let rotation = -Math.PI / 2;
  let velocity = 0;
  let dragging = false;
  let dragMoved = 0;
  let lastX = 0;
  let hovered = -1;
  let focused = '';
  const setPointer = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    parallax.set(ndc.x, ndc.y);
  };
  const onMove = (e: PointerEvent) => {
    setPointer(e);
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    dragMoved += Math.abs(dx);
    velocity = dx * 0.0032;
    rotation += velocity;
  };
  const onDown = (e: PointerEvent) => {
    dragging = true;
    dragMoved = 0;
    lastX = e.clientX;
    setPointer(e);
  };
  const pick = () => {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(cards, false)[0];
    return hit ? (hit.object.userData.index as number) : -1;
  };
  const onUp = () => {
    if (dragging && dragMoved < 6) {
      const index = pick();
      if (index >= 0) events.onOpen(index);
    }
    dragging = false;
  };
  const onLeave = () => {
    ndc.set(9, 9);
    dragging = false;
  };
  let lastScroll = scrollY;
  const onScroll = () => {
    const d = scrollY - lastScroll;
    lastScroll = scrollY;
    if (!reduced) velocity += d * 0.00045;
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerdown', onDown);
  addEventListener('pointerup', onUp);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('pointercancel', onLeave);
  addEventListener('scroll', onScroll, { passive: true });

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(el);

  let last = performance.now();
  let elapsed = 0;
  const start = performance.now();
  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible || document.hidden) return;
    elapsed += dt;
    const t = elapsed;
    if (!dragging) {
      velocity *= Math.pow(0.9, dt * 60);
      rotation += velocity + (reduced ? 0 : dt * 0.06);
    }
    ring.rotation.y = rotation;
    reflection.rotation.y = rotation;
    tilt.rotation.x = 0.16 + parallax.y * 0.04;
    tilt.rotation.y = parallax.x * 0.08;

    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(cards, false)[0];
    const next = hit ? (hit.object.userData.index as number) : -1;
    if (next !== hovered) {
      hovered = next;
      el.style.cursor = hovered >= 0 ? 'pointer' : dragging ? 'grabbing' : 'grab';
    }
    let front = 0;
    let best = -Infinity;
    cards.forEach((_, i) => {
      const a = (i / count) * Math.PI * 2 + rotation;
      const z = Math.cos(a);
      if (z > best) {
        best = z;
        front = i;
      }
    });
    const focus = hovered >= 0 ? hovered : front;
    const key = `${focus}:${hovered >= 0}`;
    if (key !== focused) {
      focused = key;
      events.onFocus(focus, hovered >= 0);
    }
    const reveal = reduced ? 1 : Math.min(1, (performance.now() - start) / 1600);
    cards.forEach((card, i) => {
      const u = card.material.uniforms;
      const target = i === hovered ? 1 : i === front && hovered < 0 ? 0.55 : 0;
      u.uHover.value += (target - u.uHover.value) * Math.min(1, dt * 7);
      u.uTime.value = t;
      u.uVelocity.value = T.MathUtils.clamp(velocity * 6, -0.6, 0.6);
      const delay = i * 0.06;
      u.uReveal.value = T.MathUtils.clamp((reveal - delay) / (1 - delay * 0.9), 0, 1);
      if (i === hovered && hit?.uv) u.uPointer.value.lerp(hit.uv, 0.25);
    });
    dustMat.uniforms.uTime.value = t;
    dust.rotation.y = rotation * 0.25;
    renderer.render(scene, camera);
  };
  tick();

  return () => {
    cancelAnimationFrame(frame);
    ro.disconnect();
    io.disconnect();
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('pointercancel', onLeave);
    removeEventListener('scroll', onScroll);
    cards.forEach((c) => {
      c.geometry.dispose();
      (c.material.uniforms.uMap.value as T.Texture).dispose();
      c.material.dispose();
    });
    mirrors.forEach((m) => m.dispose());
    dustGeo.dispose();
    dustMat.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
