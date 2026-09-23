/**
 * Material setup for baked tours: lightmapped MeshStandardMaterials that
 * crossfade between a day and a night lightmap, low-intensity environment
 * reflections that are dimmed where the lightmap is dark (cheap specular
 * occlusion), and dynamic (non-baked) materials lit by the sky only.
 */
import * as T from 'three';

export type Shared = {
  /** 0 = day, 1 = night */
  uMix: { value: number };
  uTime: { value: number };
  /** sway amplitude multiplier (0 with reduced motion) */
  uSway: { value: number };
};

const LUMA = 'vec3( 0.2126, 0.7152, 0.0722 )';

/**
 * Replacement for `lights_fragment_maps`:
 *  - decodes enc = (L / scale)^(1/2.2) from two lightmaps and mixes them
 *  - drops the diffuse IBL term (the lightmap already contains all diffuse light)
 *  - scales specular IBL by the local baked brightness
 */
function lightmapChunk() {
  let c = T.ShaderChunk.lights_fragment_maps;
  const a = 'vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );';
  const b = 'vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;';
  const ibl = 'iblIrradiance += getIBLIrradiance( geometryNormal );';
  const rad = 'radiance += iblRadiance;';
  if (!c.includes(a) || !c.includes(b) || !c.includes(rad)) return null;
  c = c.replace(
    a,
    `vec3 lmDay = pow( texture2D( lightMap, vLightMapUv ).rgb, vec3( 2.2 ) );
		vec3 lmNight = pow( texture2D( uLmNight, vLightMapUv ).rgb, vec3( 2.2 ) );
		vec4 lightMapTexel = vec4( mix( lmDay, lmNight, uLmMix ), 1.0 );`,
  );
  c = c.replace(
    b,
    `${b}
		lmSpec = clamp( dot( lightMapTexel.rgb, ${LUMA} ) * uLmSpec, 0.0, 1.0 );`,
  );
  c = c.replace(ibl, '');
  c = c.replace(rad, 'radiance += iblRadiance * lmSpec;');
  return c;
}

let chunk: string | null | undefined;

/** baked surfaces ignore scene lights (sun / hemisphere are for dynamic objects only) */
export function stripSceneLights(fragmentShader: string) {
  return fragmentShader.replace(
    '#include <lights_fragment_begin>',
    `#undef RE_Direct
#include <lights_fragment_begin>
#if defined( RE_IndirectDiffuse )
  irradiance = vec3( 0.0 );
#endif`,
  );
}

export function makeBaked(
  src: T.MeshStandardMaterial,
  day: T.Texture,
  night: { value: T.Texture },
  intensity: number,
  env: T.Texture,
  shared: Shared,
) {
  const m = src.clone();
  m.lightMap = day;
  m.lightMapIntensity = intensity;
  m.envMap = env;
  // metals and very glossy surfaces rely on reflections more
  const glossy = m.metalness > 0.3 || m.roughness < 0.2;
  m.envMapIntensity = glossy ? 0.85 : 0.45;
  m.aoMap = null;
  if (chunk === undefined) chunk = lightmapChunk();
  // lmSpec ≈ baked irradiance L (0..1): reflections fade out in shade
  const uLmSpec = { value: intensity / Math.PI };
  m.onBeforeCompile = (shader) => {
    if (!chunk) return;
    shader.uniforms.uLmNight = night;
    shader.uniforms.uLmMix = shared.uMix;
    shader.uniforms.uLmSpec = uLmSpec;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uLmNight;
uniform float uLmMix;
uniform float uLmSpec;
float lmSpec = 1.0;`,
      )
      .replace('#include <lights_fragment_maps>', chunk);
    shader.fragmentShader = stripSceneLights(shader.fragmentShader);
  };
  m.customProgramCacheKey = () => 'tour-baked';
  m.userData.tourBaked = true;
  return m;
}

export function makeGlass(env: T.Texture) {
  return new T.MeshStandardMaterial({
    name: 'Glass',
    color: new T.Color('#dfe9e6'),
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: T.DoubleSide,
    envMap: env,
    envMapIntensity: 2.2,
  });
}

/** tree impostor cards: alpha-tested, double sided, gently swaying */
export function makeCard(src: T.MeshStandardMaterial, env: T.Texture, shared: Shared) {
  const m = src.clone();
  m.transparent = false;
  m.alphaTest = 0.5;
  m.depthWrite = true;
  m.side = T.DoubleSide;
  m.envMap = env;
  m.envMapIntensity = 1;
  m.roughness = 0.85;
  m.metalness = 0;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uSway = shared.uSway;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform float uSway;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  vec4 swayW = modelMatrix * vec4( transformed, 1.0 );
  float swayH = max( swayW.y - 1.2, 0.0 );
  float ph = swayW.x * 0.31 + swayW.z * 0.17;
  float s = sin( uTime * 0.9 + ph ) * 0.6 + sin( uTime * 1.7 + ph * 1.9 ) * 0.25;
  transformed.x += s * 0.010 * swayH * uSway;
  transformed.z += cos( uTime * 0.7 + ph ) * 0.006 * swayH * uSway;
}`,
      );
  };
  m.customProgramCacheKey = () => 'tour-card';
  return m;
}

/** non-baked objects; `indoor` ones skip the sun and rely on the environment */
export function makeDynamic(src: T.MeshStandardMaterial, env: T.Texture, indoor: boolean) {
  const m = src.clone();
  m.envMap = env;
  m.envMapIntensity = indoor ? 1.5 : 0.8;
  if (indoor) {
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = stripSceneLights(shader.fragmentShader);
    };
    m.customProgramCacheKey = () => 'tour-indoor';
  }
  if (m.transparent && m.alphaTest === 0) {
    m.alphaTest = 0.5;
    m.transparent = false;
  }
  return m;
}

/** a large ground plane continuing the lot to the horizon, lit like the lot */
export function makeGround(
  map: T.Texture | null,
  tint: T.Color,
  irradiance: number,
  repeat: number,
) {
  const white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  const m = new T.MeshStandardMaterial({
    color: tint,
    map,
    roughness: 1,
    metalness: 0,
    lightMap: white,
    lightMapIntensity: irradiance,
  });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = stripSceneLights(shader.fragmentShader);
    // world-space tiling so the texture matches the lot
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGroundUv;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vGroundUv = ( modelMatrix * vec4( transformed, 1.0 ) ).xz / ${repeat.toFixed(3)};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGroundUv;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vGroundUv );
  diffuseColor *= sampledDiffuseColor;
#endif`,
      );
  };
  m.customProgramCacheKey = () => 'tour-ground';
  return m;
}

/** equirect sky that crossfades day/night and fades to haze below the horizon */
export function makeSky(day: T.Texture, night: { value: T.Texture }, shared: Shared) {
  return new T.ShaderMaterial({
    uniforms: {
      uDay: { value: day },
      uNight: night,
      uMix: shared.uMix,
      uHazeDay: { value: new T.Color() },
      uHazeNight: { value: new T.Color() },
      uFade: { value: 1 },
      // outlook switch: crossfade to a second day/night pair
      uDay2: { value: day },
      uNight2: { value: day },
      uSwap: { value: 0 },
    },
    vertexShader: /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  gl_Position = p.xyww;
}`,
    fragmentShader: /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform float uMix;
uniform vec3 uHazeDay;
uniform vec3 uHazeNight;
uniform float uFade;
uniform sampler2D uDay2;
uniform sampler2D uNight2;
uniform float uSwap;
varying vec3 vDir;
void main() {
  vec3 d = normalize( vDir );
  float y = mix( d.y, max( d.y, 0.004 ), uFade );
  vec3 dd = normalize( vec3( d.x, y, d.z ) );
  vec2 uv = vec2( atan( dd.z, dd.x ) * 0.15915494 + 0.5, asin( clamp( dd.y, -1.0, 1.0 ) ) * 0.31830989 + 0.5 );
  vec3 c = mix( texture2D( uDay, uv ).rgb, texture2D( uNight, uv ).rgb, uMix );
  if ( uSwap > 0.0 ) c = mix( c, mix( texture2D( uDay2, uv ).rgb, texture2D( uNight2, uv ).rgb, uMix ), uSwap );
  vec3 haze = mix( uHazeDay, uHazeNight, uMix );
  c = mix( c, haze, ( smoothstep( 0.06, -0.02, d.y ) * 0.9 + smoothstep( 0.12, 0.0, d.y ) * 0.1 ) * uFade );
  gl_FragColor = vec4( c, 1.0 );
  #include <colorspace_fragment>
}`,
    side: T.BackSide,
    depthWrite: false,
    toneMapped: false,
  });
}
