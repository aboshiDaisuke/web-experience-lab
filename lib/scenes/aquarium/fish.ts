import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// models are Draco-compressed; the decoder ships alongside them
let draco: DRACOLoader | null = null;
export function gltfLoader(base: string) {
  draco ??= new DRACOLoader().setDecoderPath(`${base}/draco/`);
  return new GLTFLoader().setDRACOLoader(draco);
}

/*
 * Fish built in Blender (tools/blender/fish.py): one mesh per species with
 * body, fin and eye primitives, drawn as instanced meshes. The swim is done
 * in the vertex shader: a travelling wave down the body whose amplitude grows
 * towards the tail, a bend for turning, and each fin fluttering on its own.
 * Per-instance `aSwim` = (tail phase, tail amplitude, bend, fin phase).
 */

export type SpeciesId = 'neon' | 'rummy' | 'angel' | 'discus';

// the rim colour some species carry on their long fins (rgb, strength)
const FIN_EDGE: Record<SpeciesId, [number, number, number, number]> = {
  neon: [0.8, 0.85, 0.9, 0.0],
  rummy: [0.8, 0.85, 0.9, 0.0],
  angel: [0.85, 0.88, 0.9, 0.35],
  discus: [0.05, 0.16, 0.42, 0.8],
};

// paired fins are see-through and lie over the body in the side texture, so
// they get their own colour: [pectoral rgba, pelvic rgba]
const PAIRED: Record<SpeciesId, [number, number, number, number][]> = {
  neon: [[0.9, 0.9, 0.86, 0.1], [0.9, 0.9, 0.86, 0.14]],
  rummy: [[0.9, 0.9, 0.86, 0.1], [0.9, 0.9, 0.86, 0.14]],
  angel: [[0.85, 0.87, 0.88, 0.16], [0.95, 0.93, 0.88, 0.8]],
  discus: [[0.8, 0.5, 0.35, 0.2], [0.75, 0.25, 0.12, 0.7]],
};

// wave count along the body, head amplitude share, pectoral amplitude, fin ripple
const STYLE: Record<SpeciesId, [number, number, number, number]> = {
  neon: [0.85, 0.12, 0.05, 0.012],
  rummy: [0.85, 0.12, 0.05, 0.012],
  angel: [0.6, 0.08, 0.05, 0.03],
  discus: [0.55, 0.06, 0.05, 0.014],
};

const swimVertex = /* glsl */ `
attribute vec4 aPart;
attribute vec2 aFin;
attribute vec4 aSwim;
uniform float uTime;
uniform vec4 uStyle;
varying vec3 vFin;
varying float vPart;

float swimZ(float x, out float slope) {
  float s = 0.5 - x;
  float env = uStyle.y + (1.0 - uStyle.y) * s * s;
  float k = uStyle.x * 6.2831853;
  float ph = aSwim.x - s * k;
  float z = aSwim.y * env * sin(ph) + aSwim.z * (s - 0.3) * (s - 0.3);
  float dzds = aSwim.y * ((1.0 - uStyle.y) * 2.0 * s * sin(ph) - env * cos(ph) * k) + aSwim.z * 2.0 * (s - 0.3);
  slope = -dzds;
  return z;
}
`;

const swimBegin = /* glsl */ `
  float swimSlope;
  float swimOffset = swimZ(position.x, swimSlope);
  float flex = aPart.r;
  float part = aPart.g;
  float side = 1.0 - aPart.b * 2.0;
  vec3 finOffset = vec3(0.0);
  if (abs(part - 0.25) < 0.05) {
    finOffset.z += flex * uStyle.w * sin(aFin.x * 0.7 - uTime * 4.0 + aSwim.w * 0.25);
  } else if (abs(part - 0.5) < 0.05) {
    finOffset.z += flex * flex * uStyle.w * 1.5 * sin(aSwim.x - 2.0);
  } else if (abs(part - 0.75) < 0.05) {
    float beat = sin(aSwim.w);
    finOffset.z += side * flex * uStyle.z * (0.55 + 0.45 * beat);
    finOffset.x += flex * uStyle.z * 0.4 * cos(aSwim.w);
  } else if (part < 0.05) {
    // breathing: the gill covers flare and the mouth works, each fish in its own rhythm
    float breath = 0.5 + 0.5 * sin(uTime * 2.4 + float(gl_InstanceID) * 1.93);
    // only the back edge of the gill cover moves, well clear of the eye
    float gill = smoothstep(0.22, 0.26, aFin.x) * smoothstep(0.33, 0.28, aFin.x)
               * smoothstep(0.12, 0.35, aFin.y) * smoothstep(0.92, 0.7, aFin.y);
    finOffset.z += sign(position.z) * gill * 0.006 * breath;
    finOffset.y += (aFin.y - 0.56) * smoothstep(0.06, 0.0, aFin.x) * 0.035 * breath;
  } else if (part > 0.95) {
    finOffset.z += side * flex * flex * 0.03 * sin(uTime * 1.3 + aSwim.w * 0.15 + aFin.y * 2.0);
    finOffset.x += flex * flex * 0.02 * sin(uTime * 0.9 + aSwim.w * 0.1);
  }
  vFin = vec3(aFin, flex);
  vPart = part;
`;

const swimNormal = /* glsl */ `
  {
    float sl;
    swimZ(position.x, sl);
    float a = atan(sl);
    float ca = cos(a), sa = sin(a);
    objectNormal = vec3(objectNormal.x * ca - objectNormal.z * sa, objectNormal.y, objectNormal.x * sa + objectNormal.z * ca);
  }
`;

function patchSwim(shader: T.WebGLProgramParametersWithUniforms, uniforms: Record<string, T.IUniform>) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${swimVertex}`)
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${swimNormal}`)
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n${swimBegin}\n  transformed.z += swimOffset;\n  transformed += finOffset;`,
    );
}

export type FishKind = {
  id: SpeciesId;
  meshes: T.InstancedMesh[];
  swim: T.InstancedBufferAttribute;
  count: number;
  uniforms: { uTime: T.IUniform<number>; uStyle: T.IUniform<T.Vector4> };
};

const loadBitmap = (url: string) =>
  new Promise<T.Texture>((resolve, reject) => {
    new T.ImageBitmapLoader()
      .setOptions({ imageOrientation: 'none', premultiplyAlpha: 'none' })
      .load(
        url,
        (bmp) => {
          const tex = new T.Texture(bmp);
          tex.flipY = false;
          tex.needsUpdate = true;
          resolve(tex);
        },
        undefined,
        reject,
      );
  });

export async function loadFish(
  base: string,
  id: SpeciesId,
  count: number,
  env: T.Texture,
  caustics: (shader: T.WebGLProgramParametersWithUniforms) => void,
): Promise<FishKind> {
  const [gltf, color, mat, eye] = await Promise.all([
    gltfLoader(base).loadAsync(`${base}/${id}.glb`),
    loadBitmap(`${base}/${id}_color.webp`),
    loadBitmap(`${base}/${id}_mat.webp`),
    loadBitmap(`${base}/${id}_eye.webp`),
  ]);
  color.colorSpace = T.SRGBColorSpace;
  eye.colorSpace = T.SRGBColorSpace;
  for (const t of [color, mat, eye]) {
    t.anisotropy = 4;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
  }

  const uniforms = {
    uTime: { value: 0 },
    uStyle: { value: new T.Vector4(...STYLE[id]) },
  };
  const swim = new T.InstancedBufferAttribute(new Float32Array(count * 4), 4);
  swim.setUsage(T.DynamicDrawUsage);

  const body = new T.MeshPhysicalMaterial({
    map: color,
    roughnessMap: mat,
    metalnessMap: mat,
    bumpMap: mat,
    bumpScale: 0.16,
    roughness: 1,
    metalness: 1,
    clearcoat: 0.7,
    clearcoatRoughness: 0.18,
    iridescence: 1,
    iridescenceMap: mat,
    iridescenceIOR: 1.8,
    iridescenceThicknessRange: [260, 520],
    envMap: env,
    envMapIntensity: 1.1,
  });
  body.onBeforeCompile = (shader) => {
    patchSwim(shader, uniforms);
    caustics(shader);
    // light scattered inside the thin body keeps the shadowed side from going dead
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      /* glsl */ `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * vec3(0.06, 0.085, 0.08);
      // structural colour (the neon stripe, discus lines) throws the lamp back hard
      totalEmissiveRadiance += diffuseColor.rgb * texture2D(iridescenceMap, vIridescenceMapUv).a * 0.9;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'texture2D( iridescenceMap, vIridescenceMapUv ).r',
      'texture2D( iridescenceMap, vIridescenceMapUv ).a',
    );
  };

  const fin = new T.MeshPhysicalMaterial({
    map: color,
    roughness: 0.7,
    metalness: 0,
    clearcoat: 0.15,
    side: T.DoubleSide,
    transparent: true,
    depthWrite: false,
    envMap: env,
    envMapIntensity: 0.25,
  });
  fin.onBeforeCompile = (shader) => {
    patchSwim(shader, uniforms);
    shader.uniforms.uFinEdge = { value: new T.Vector4(...FIN_EDGE[id]) };
    shader.uniforms.uPect = { value: new T.Vector4(...PAIRED[id][0]) };
    shader.uniforms.uPelv = { value: new T.Vector4(...PAIRED[id][1]) };
    caustics(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFin;\nvarying float vPart;\nuniform vec4 uFinEdge;\nuniform vec4 uPect;\nuniform vec4 uPelv;')
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        {
          if (vPart > 0.7) {
            vec4 pf = vPart > 0.9 ? uPelv : uPect;
            diffuseColor = vec4(pf.rgb, pf.a);
          }
          float f = abs(fract(vFin.x) - 0.5);
          float ray = smoothstep(0.42, 0.5, f) * (1.0 - vFin.y * 0.6);
          diffuseColor.rgb *= 1.0 - ray * 0.08;
          float edge = smoothstep(0.78, 0.96, vFin.y) * uFinEdge.w;
          diffuseColor.rgb = mix(diffuseColor.rgb, uFinEdge.rgb, edge);
          diffuseColor.a = clamp(diffuseColor.a * (0.9 + ray * 0.2) + edge * 0.3, 0.0, 1.0);
          // membranes thin out towards the edge, which is soft rather than cut
          diffuseColor.a *= smoothstep(1.0, 0.86, vFin.y) * mix(1.1, 0.75, vFin.y);
        }`,
      );
  };

  const eyeMat = new T.MeshPhysicalMaterial({
    map: eye,
    roughness: 0.32,
    metalness: 0.45,
    envMap: env,
  });
  eye.channel = 1;
  eyeMat.onBeforeCompile = (shader) => {
    patchSwim(shader, uniforms);
    caustics(shader);
  };

  // the clear cornea over the iris: nearly invisible, except for what it reflects
  // black and additive: it contributes only its own reflections and highlight
  const cornea = new T.MeshPhysicalMaterial({
    color: 0x000000,
    // any smoother and the lamp's highlight overflows the HDR buffer
    roughness: 0.1,
    metalness: 0,
    ior: 1.38,
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    envMap: env,
    envMapIntensity: 1.6,
  });
  cornea.onBeforeCompile = (shader) => {
    patchSwim(shader, uniforms);
    // seen edge-on the cornea would light up as a ring floating off the head
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'outgoingLight *= smoothstep(0.2, 0.55, abs(dot(normalize(normal), normalize(vViewPosition))));\n#include <opaque_fragment>',
    );
  };

  const depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
  depth.onBeforeCompile = (shader) => patchSwim(shader, uniforms);

  const meshes: T.InstancedMesh[] = [];
  gltf.scene.traverse((o) => {
    const m = o as T.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry as T.BufferGeometry;
    g.setAttribute('aPart', g.getAttribute('color'));
    g.setAttribute('aFin', g.getAttribute('uv1'));
    g.deleteAttribute('color');
    g.setAttribute('aSwim', swim);
    const name = (m.material as T.Material).name;
    const material = { body, eye: eyeMat, cornea }[name] ?? fin;
    const inst = new T.InstancedMesh(g, material, count);
    inst.instanceMatrix.setUsage(T.DynamicDrawUsage);
    inst.frustumCulled = false;
    inst.castShadow = name === 'body' || name === 'fin';
    inst.receiveShadow = name === 'body';
    inst.customDepthMaterial = depth;
    meshes.push(inst);
  });
  return { id, meshes, swim, count, uniforms };
}
