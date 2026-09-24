import * as T from 'three';

/*
 * Light under the surface. Caustics are computed, not painted: a grid is
 * pushed through the refracting wind-wave surface onto the tank floor and each
 * triangle's area change becomes brightness (three passes with slightly
 * different indices of refraction, so the edges split into colour). The waves
 * repeat every TILE centimetres, which makes the result a seamless tile.
 */

export const TILE = 26;
const DEPTH = 40;

// wind waves with a whole number of periods per tile: [kx, kz, amplitude, speed]
const WAVES: [number, number, number, number][] = [
  [5, 2, 0.05, 1.0],
  [-2, 6, 0.036, 1.25],
  [7, -4, 0.024, 1.5],
  [-9, -3, 0.016, 1.8],
  [3, 11, 0.01, 2.1],
];
const waveGlsl = /* glsl */ `
uniform float uTime;
vec2 surfGrad(vec2 p) {
  vec2 g = vec2(0.0);
  ${WAVES.map(([kx, kz, a, sp], i) => {
    const k = `vec2(${((kx * 2 * Math.PI) / TILE).toFixed(5)}, ${((kz * 2 * Math.PI) / TILE).toFixed(5)})`;
    // deep-water dispersion (g = 980 cm/s²), slowed so the light drifts rather than flickers
    const w = (Math.sqrt(980 * Math.hypot(kx, kz) * ((2 * Math.PI) / TILE)) * 0.12 * sp).toFixed(4);
    return `g += ${k} * ${a.toFixed(4)} * cos(dot(${k}, p) - uTime * ${w} + ${(i * 1.7).toFixed(1)});`;
  }).join('\n  ')}
  return g;
}
`;

const causticVert = /* glsl */ `
${waveGlsl}
uniform float uEta;
varying vec3 vOld;
varying vec3 vNew;
void main() {
  // the grid spans the tile plus a margin, so light bent in from beyond
  // the tile's edge still lands inside it
  vec2 p = (uv * 1.5 - 0.25) * ${TILE.toFixed(1)};
  vec2 g = surfGrad(p);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 L = normalize(vec3(0.12, -1.0, 0.08));
  vec3 flatRay = refract(L, vec3(0.0, 1.0, 0.0), uEta);
  vec3 ray = refract(L, n, uEta);
  vec3 o = vec3(p.x, 0.0, p.y);
  vOld = o + flatRay * (${DEPTH.toFixed(1)} / -flatRay.y);
  vNew = o + ray * (${DEPTH.toFixed(1)} / -ray.y);
  vec2 q = (vNew.xz - (vOld.xz - o.xz)) / ${TILE.toFixed(1)};
  gl_Position = vec4(q * 2.0 - 1.0, 0.0, 1.0);
}
`;
const causticFrag = /* glsl */ `
uniform vec3 uMask;
varying vec3 vOld;
varying vec3 vNew;
void main() {
  float a0 = length(dFdx(vOld)) * length(dFdy(vOld));
  float a1 = length(dFdx(vNew)) * length(dFdy(vNew));
  gl_FragColor = vec4(uMask * min(a0 / max(a1, 1e-9), 6.0) * 0.5, 1.0);
}
`;

export function createCaustics(renderer: T.WebGLRenderer, size: number) {
  const target = new T.WebGLRenderTarget(size, size, {
    type: T.HalfFloatType,
    wrapS: T.RepeatWrapping,
    wrapT: T.RepeatWrapping,
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: T.LinearMipmapLinearFilter,
  });
  const time = { value: 0 };
  const seg = Math.round(size * 0.55);
  const mesh = new T.Mesh(new T.PlaneGeometry(1, 1, seg, seg));
  mesh.frustumCulled = false;
  const scene = new T.Scene().add(mesh);
  const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mats = (
    [
      [new T.Vector3(1, 0, 0), 1 / 1.325],
      [new T.Vector3(0, 1, 0), 1 / 1.333],
      [new T.Vector3(0, 0, 1), 1 / 1.345],
    ] as const
  ).map(
    ([mask, eta]) =>
      new T.ShaderMaterial({
        vertexShader: causticVert,
        fragmentShader: causticFrag,
        uniforms: { uTime: time, uEta: { value: eta }, uMask: { value: mask } },
        blending: T.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        side: T.DoubleSide,
      }),
  );
  const clear = new T.Color(0, 0, 0);
  return {
    texture: target.texture,
    time,
    update(t: number) {
      time.value = t;
      const prev = renderer.getRenderTarget();
      const prevClear = renderer.getClearColor(new T.Color());
      const prevAlpha = renderer.getClearAlpha();
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(target);
      renderer.setClearColor(clear, 1);
      renderer.clear();
      for (const m of mats) {
        mesh.material = m;
        renderer.render(scene, cam);
      }
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(prev);
      renderer.setClearColor(prevClear, prevAlpha);
    },
    dispose() {
      target.dispose();
      mesh.geometry.dispose();
      mats.forEach((m) => m.dispose());
    },
  };
}

/** Adds the caustic light from above to any lit material. */
export function causticInjector(tex: T.Texture, strength: T.IUniform<number>, surface: number) {
  return (shader: T.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uCaustics = { value: tex };
    shader.uniforms.uCausticStrength = strength;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCausticPos;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `#include <project_vertex>
        {
          vec4 cw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            cw = instanceMatrix * cw;
          #endif
          vCausticPos = (modelMatrix * cw).xyz;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vCausticPos;\nuniform sampler2D uCaustics;\nuniform float uCausticStrength;',
      )
      .replace(
        '#include <lights_fragment_begin>',
        /* glsl */ `vec3 causticLight;
        {
          float depth = ${surface.toFixed(1)} - vCausticPos.y;
          // deeper light has travelled further from the focus: soften it
          vec2 cuv = (vCausticPos.xz + vec2(vCausticPos.y * 0.1)) / ${TILE.toFixed(1)};
          vec3 c = textureLod(uCaustics, cuv, clamp(3.2 - depth * 0.08, 0.0, 3.0)).rgb * 2.0;
          causticLight = mix(vec3(1.0), c, uCausticStrength);
        }
        ` +
          // caustics are the lamp's light, focused by the waves: they live
          // inside the directional light, so shadows block them too
          T.ShaderChunk.lights_fragment_begin.replace(
            'getDirectionalLightInfo( directionalLight, directLight );',
            'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= causticLight;',
          ),
      );
  };
}

/** Shafts of light slanting down from the surface. */
export function createGodRays(count: number, box: { x: number; top: number; z0: number; z1: number }) {
  const geo = new T.PlaneGeometry(1, 1, 1, 1);
  geo.translate(0, -0.5, 0);
  const mat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.09 } },
    vertexShader: /* glsl */ `
      attribute vec4 aRay;
      uniform float uTime;
      varying vec2 vUv;
      varying float vSeed;
      varying float vFade;
      void main() {
        vUv = uv;
        vSeed = aRay.w;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * wp;
        // fade shafts seen edge-on
        vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * vec3(0.0, 0.0, 1.0));
        vFade = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vSeed;
      varying float vFade;
      float h(float x) { return fract(sin(x * 91.7) * 43758.5); }
      float n1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h(i), h(i + 1.0), f); }
      void main() {
        float x = vUv.x;
        float streak = n1(x * 9.0 + vSeed * 13.0 + uTime * 0.05) * 0.6 + n1(x * 23.0 - uTime * 0.08 + vSeed) * 0.4;
        streak = pow(streak, 2.2);
        float edge = smoothstep(0.0, 0.3, x) * smoothstep(1.0, 0.7, x);
        float down = pow(vUv.y, 1.6);
        float pulse = 0.7 + 0.3 * sin(uTime * 0.3 + vSeed * 6.0);
        float a = streak * edge * down * pulse * uOpacity * (0.35 + 0.65 * vFade);
        gl_FragColor = vec4(vec3(0.85, 0.97, 1.0) * a, 1.0);
      }`,
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const mesh = new T.InstancedMesh(geo, mat, count);
  const rays = new Float32Array(count * 4);
  const m = new T.Matrix4();
  const q = new T.Quaternion();
  const e = new T.Euler();
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 2 - 1) * box.x;
    const z = box.z0 + Math.random() * (box.z1 - box.z0);
    const w = 5 + Math.random() * 12;
    const len = 34 + Math.random() * 20;
    e.set(0.1 + Math.random() * 0.08, Math.random() * Math.PI, -0.14 - Math.random() * 0.08);
    q.setFromEuler(e);
    m.compose(new T.Vector3(x, box.top, z), q, new T.Vector3(w, len, 1));
    mesh.setMatrixAt(i, m);
    rays[i * 4 + 3] = Math.random();
  }
  geo.setAttribute('aRay', new T.InstancedBufferAttribute(rays, 4));
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}

/** Specks suspended in the water that catch the light as they drift. */
export function createMotes(count: number, box: T.Box3) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const size = box.getSize(new T.Vector3());
  for (let i = 0; i < count; i++) {
    pos[i * 3] = box.min.x + Math.random() * size.x;
    pos[i * 3 + 1] = box.min.y + Math.random() * size.y;
    pos[i * 3 + 2] = box.min.z + Math.random() * size.z;
    seed[i] = Math.random();
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
  const mat = new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMin: { value: box.min },
      uSize: { value: size },
      uScale: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform vec3 uMin;
      uniform vec3 uSize;
      uniform float uScale;
      varying float vA;
      void main() {
        vec3 p = position;
        p += vec3(sin(uTime * 0.13 + aSeed * 40.0) * 1.5, uTime * (0.15 + aSeed * 0.25), cos(uTime * 0.11 + aSeed * 23.0) * 1.2);
        p = uMin + mod(p - uMin, uSize);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uScale * (0.6 + aSeed * 1.2) * 60.0 / -mv.z;
        vA = (0.25 + 0.75 * fract(aSeed * 7.3)) * smoothstep(140.0, 50.0, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * 0.5;
        gl_FragColor = vec4(vec3(0.9, 1.0, 0.95) * a, 1.0);
      }`,
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
  });
  const pts = new T.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

/** A column of bubbles from an air stone; each one wobbles as it rises. */
export function createBubbles(count: number, origin: T.Vector3, top: number, env: T.Texture) {
  const geo = new T.SphereGeometry(1, 12, 8);
  const mat = new T.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0,
    metalness: 0,
    transmission: 1,
    thickness: 0.2,
    ior: 1 / 1.33,
    envMap: env,
    envMapIntensity: 2.2,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const mesh = new T.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const state = Array.from({ length: count }, (_, i) => ({
    y: origin.y + ((top - origin.y) * i) / count,
    r: 0.08 + Math.random() * 0.22,
    ph: Math.random() * 10,
    dx: 0,
    dz: 0,
  }));
  const m = new T.Matrix4();
  const q = new T.Quaternion();
  const s = new T.Vector3();
  const p = new T.Vector3();
  return {
    mesh,
    update(t: number, dt: number) {
      state.forEach((b, i) => {
        b.y += dt * (9 + b.r * 30);
        if (b.y > top) {
          b.y = origin.y;
          b.r = 0.08 + Math.random() * 0.22;
          b.dx = (Math.random() - 0.5) * 0.6;
          b.dz = (Math.random() - 0.5) * 0.6;
        }
        const rise = (b.y - origin.y) / (top - origin.y);
        p.set(
          origin.x + b.dx + Math.sin(t * 7 + b.ph) * 0.25 * rise + rise * 2.5,
          b.y,
          origin.z + b.dz + Math.cos(t * 6 + b.ph) * 0.25 * rise,
        );
        const wob = 1 + 0.15 * Math.sin(t * 20 + b.ph);
        s.set(b.r * wob, (b.r * 0.85) / wob, b.r * wob);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/**
 * The underside of the surface, seen from below. At the grazing angles we
 * look at it, water reflects totally, so it's a rippling mirror of the tank's
 * own teal light, broken by glints where a wave tilts towards the lamp.
 */
export function createSurface(y: number, fog: T.Color) {
  const mat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFog: { value: fog } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${waveGlsl}
      uniform vec3 uFog;
      varying vec3 vWorld;
      void main() {
        vec2 g = surfGrad(vWorld.xz) * 5.0 + surfGrad(vWorld.xz * 2.7 + 11.0) * 2.0;
        vec3 n = normalize(vec3(-g.x, -1.0, -g.y));
        vec3 v = normalize(vWorld - cameraPosition);
        vec3 r = reflect(v, n);
        // looking up steeply you'd see out through Snell's window; here the view
        // is grazing, so it's all mirror: the tank's light, darker further off
        float up = clamp(-v.y, 0.0, 1.0);
        vec3 c = uFog * (1.5 + 0.8 * r.y) + vec3(0.02, 0.05, 0.03);
        float glint = pow(max(dot(r, normalize(vec3(0.1, -0.3, 1.0))), 0.0), 60.0);
        c += vec3(0.75, 0.95, 1.0) * glint * 1.4;
        c += vec3(0.5, 0.8, 0.85) * smoothstep(0.55, 0.9, up) * 0.8;
        float d = length(vWorld - cameraPosition);
        c = mix(c, uFog, smoothstep(60.0, 220.0, d));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: T.DoubleSide,
    fog: false,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(160, 54), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(0, y, -21);
  return mesh;
}
