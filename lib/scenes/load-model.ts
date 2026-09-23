import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { BASE } from '@/lib/base-path';
export async function loadModel(
  path: string,
  renderer: T.WebGLRenderer,
  signal: AbortSignal,
) {
  const response = await fetch(path, { signal });
  if (
    !response.ok ||
    response.headers.get('content-type')?.includes('text/html')
  )
    return null;
  const buffer = await response.arrayBuffer();
  if (signal.aborted) return null;
  const draco = new DRACOLoader().setDecoderPath(`${BASE}/draco/`);
  const ktx = new KTX2Loader()
    .setTranscoderPath(`${BASE}/basis/`)
    .detectSupport(renderer);
  try {
    const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx);
    const gltf = await loader.parseAsync(buffer, `${BASE}/models/`);
    const group = new T.Group();
    group.add(gltf.scene);
    const bounds = new T.Box3().setFromObject(group);
    const center = bounds.getCenter(new T.Vector3());
    const size = bounds.getSize(new T.Vector3());
    gltf.scene.position.sub(center);
    group.scale.setScalar(3.7 / Math.max(size.x, size.y, size.z));
    return group;
  } finally {
    draco.dispose();
    ktx.dispose();
  }
}
