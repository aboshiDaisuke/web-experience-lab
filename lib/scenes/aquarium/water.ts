import * as T from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

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

/*
 * The water itself. The camera stands outside the front glass (z = 0), so
 * only the part of each sightline that runs through water is coloured: red
 * goes first, then blue, and what's lost is replaced by the tank's own glow,
 * brighter near the lamp than down by the gravel. Near things keep their
 * colour; the back of the tank sinks into green-blue haze.
 */
export const GLASS_Z = 0;
const SIGMA = [0.017, 0.0082, 0.0096];
export const WATER_DEEP = [0.006, 0.05, 0.058];
export const WATER_SHALLOW = [0.07, 0.3, 0.3];
const v3 = (c: number[]) => `vec3(${c.map((x) => x.toFixed(4)).join(', ')})`;
export const waterGlsl = (surface: number) => /* glsl */ `
vec3 waterTint(vec3 col, vec3 wp) {
  float d = length(wp - cameraPosition);
  // (a camera inside the tank, like the one that captures reflections, is all wet)
  float wet = cameraPosition.z < ${GLASS_Z.toFixed(1)} ? d
    : d * clamp((${GLASS_Z.toFixed(1)} - wp.z) / max(cameraPosition.z - wp.z, 1e-3), 0.0, 1.0);
  vec3 tr = exp(-${v3(SIGMA)} * wet);
  vec3 glow = mix(${v3(WATER_DEEP)}, ${v3(WATER_SHALLOW)}, smoothstep(2.0, ${surface.toFixed(1)}, wp.y));
  return col * tr + glow * (1.0 - tr);
}
`;

/**
 * Adds the caustic light from above, the dimming of the lamp with depth and
 * the colour of the water to any lit material.
 */
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
        `#include <common>\nvarying vec3 vCausticPos;\nuniform sampler2D uCaustics;\nuniform float uCausticStrength;\n${waterGlsl(surface)}`,
      )
      .replace(
        '#include <lights_fragment_begin>',
        /* glsl */ `vec3 causticLight;
        {
          float depth = max(0.0, ${surface.toFixed(1)} - vCausticPos.y);
          // two readings of the tile, turned and scaled against each other,
          // so the net of light never repeats; deeper light has travelled
          // further from its focus and is softer
          float lod = clamp(2.4 - depth * 0.05, 0.0, 3.0);
          vec2 p = vCausticPos.xz + vec2(vCausticPos.y * 0.1);
          vec3 c1 = textureLod(uCaustics, p / ${TILE.toFixed(1)}, lod).rgb;
          vec3 c2 = textureLod(uCaustics, mat2(0.8, -0.6, 0.6, 0.8) * p / ${(TILE * 1.37).toFixed(2)} + 0.31, lod + 0.6).rgb;
          vec3 c = (c1 * 1.3 + c2 * 0.7);
          // light falls from above: faces turned away from it only get a smear
          vec3 wn = inverseTransformDirection(normal, viewMatrix);
          float facing = smoothstep(0.3, 0.9, wn.y);
          causticLight = mix(vec3(1.0), c, uCausticStrength * facing);
          // the lamp dims as its light goes down through the water
          causticLight *= exp(-depth * 0.009);
        }
        ` +
          // caustics are the lamp's light, focused by the waves: they live
          // inside the directional light, so shadows block them too
          T.ShaderChunk.lights_fragment_begin.replace(
            'getDirectionalLightInfo( directionalLight, directLight );',
            'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= causticLight;',
          ),
      )
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = waterTint(gl_FragColor.rgb, vCausticPos);');
  };
}

/** Shafts of light slanting down from the surface. */
export function createGodRays(count: number, box: { x: number; top: number; z0: number; z1: number }) {
  const geo = new T.PlaneGeometry(1, 1, 1, 1);
  geo.translate(0, -0.5, 0);
  const mat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.13 } },
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
        // multisampling shades edge pixels just outside the quad, where uv overshoots
        vec2 uv = clamp(vUv, 0.0, 1.0);
        float x = uv.x;
        float streak = n1(x * 9.0 + vSeed * 13.0 + uTime * 0.05) * 0.6 + n1(x * 23.0 - uTime * 0.08 + vSeed) * 0.4;
        streak = pow(streak, 2.2);
        float edge = smoothstep(0.0, 0.3, x) * smoothstep(1.0, 0.7, x);
        float down = pow(uv.y, 1.6);
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

/**
 * A column of bubbles from an air stone; each one wobbles as it rises. Air
 * in water is a mirror at its rim, where light meets it at a glancing angle
 * and can't get in: a silver ring, clear in the middle, with the lamp in it.
 */
export function createBubbles(count: number, origin: T.Vector3, top: number) {
  const geo = new T.SphereGeometry(1, 14, 10);
  const mat = new T.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${waterGlsl(top)}
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vW;
      void main() {
        vec3 n = normalize(vN);
        float nv = abs(dot(n, normalize(vV)));
        float rim = pow(max(1.0 - nv, 0.0), 2.2);
        float lamp = pow(max(dot(n, normalize(vec3(-0.2, 1.0, 0.5))), 0.0), 40.0);
        float under = pow(max(dot(n, vec3(0.0, -1.0, 0.0)), 0.0), 3.0);
        vec3 c = vec3(0.75, 0.95, 0.95) * rim * 1.8 + vec3(3.0, 3.0, 2.8) * lamp + vec3(0.2, 0.45, 0.35) * under * 0.4;
        float a = clamp(0.06 + rim * 0.9 + lamp, 0.0, 1.0);
        // only the loss on the way to the eye: the bubble adds light, it doesn't hide the haze
        gl_FragColor = vec4(waterTint(c, vW) - waterTint(vec3(0.0), vW), a);
      }`,
    transparent: true,
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
 * The underside of the surface, seen from below. Past the critical angle
 * (48.6° from straight up) water reflects everything, and from the front of a
 * tank that's all you see of it: the planted tank hanging upside down,
 * rippling, with a bright line of meniscus where the water climbs the back
 * glass. Only looking up steeply, as a phone held close does, do you reach
 * Snell's window and the lamp beyond it.
 */
export function createSurface(y: number, back: number, scale: number) {
  const shader = {
    name: 'WaterSurface',
    uniforms: {
      tDiffuse: { value: null },
      color: { value: null },
      textureMatrix: { value: null },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vMirror;
      varying vec3 vWorld;
      void main() {
        vMirror = textureMatrix * vec4(position, 1.0);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${waveGlsl}
      uniform sampler2D tDiffuse;
      varying vec4 vMirror;
      varying vec3 vWorld;
      void main() {
        // the filter keeps a slow chop going; finer ripples ride on it
        vec2 g = surfGrad(vWorld.xz * 0.6) * 3.0 + surfGrad(vWorld.xz * 1.9 + 11.0) * 1.6;
        vec3 v = normalize(vWorld - cameraPosition);
        vec3 n = normalize(vec3(-g.x, -1.0, -g.y));
        float cosI = dot(-v, n);
        vec4 m = vMirror;
        // near the back glass the mirror image ends at the waterline; don't
        // let the ripples reach past it
        m.xy += g * m.w * 0.16 * smoothstep(${back.toFixed(1)}, ${(back + 7).toFixed(1)}, vWorld.z);
        vec3 c = texture2DProj(tDiffuse, m).rgb * 0.82;
        // Snell's window: looking up more steeply than the critical angle, the
        // mirror gives way to the lamp above
        float window = smoothstep(0.6, 0.72, abs(cosI));
        c = mix(c, vec3(2.4, 2.45, 2.3), window);
        c += vec3(0.9, 0.8, 1.0) * exp(-pow((abs(cosI) - 0.66) * 30.0, 2.0)) * 0.6;
        // the lit back screen glints off ripples that tilt just so
        vec3 r = reflect(v, n);
        c += vec3(1.0, 0.98, 0.92) * pow(max(dot(r, normalize(vec3(0.15, -0.35, -1.0))), 0.0), 220.0) * 3.0;
        // the meniscus along the back glass
        float men = exp(-pow((vWorld.z - ${(back + 0.35).toFixed(2)}) * 3.2, 2.0));
        c += vec3(0.6, 0.85, 0.85) * men * (0.7 + 0.3 * sin(vWorld.x * 0.8 + uTime));
        gl_FragColor = vec4(c, 1.0);
      }`,
  };
  // from the back glass to a little in front of the front one
  const depth = 14 - back;
  const mesh = new Reflector(new T.PlaneGeometry(170, depth), {
    shader,
    clipBias: 0.0005,
    multisample: 4,
    textureWidth: 256,
    textureHeight: 256,
  }) as Reflector & { material: T.ShaderMaterial };
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(0, y, back + depth / 2);
  mesh.userData.scale = scale;
  return mesh;
}
