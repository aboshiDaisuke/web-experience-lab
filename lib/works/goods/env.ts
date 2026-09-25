// A warm little photo studio for reflections: a big north-light window, a bounce card,
// plaster walls and a wooden floor. Rendered once into a PMREM cube.
import * as T from 'three';

export function studioEnvironment(renderer: T.WebGLRenderer) {
  const scene = new T.Scene();
  const geos: T.BufferGeometry[] = [];
  const mats: T.Material[] = [];
  const box = (w: number, h: number, d: number, color: T.ColorRepresentation, k: number, pos: [number, number, number], side: T.Side = T.FrontSide) => {
    const g = new T.BoxGeometry(w, h, d);
    const m = new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(k), side });
    geos.push(g);
    mats.push(m);
    const mesh = new T.Mesh(g, m);
    mesh.position.set(...pos);
    scene.add(mesh);
    return mesh;
  };
  // room
  box(16, 9, 16, '#b9ad9c', 0.55, [0, 3.5, 0], T.BackSide);
  // floor (wood tone)
  box(15.8, 0.1, 15.8, '#6b4d33', 0.5, [0, -0.95, 0]);
  // window: large and soft, upper left-front
  box(0.2, 4.2, 6.5, '#fff7ea', 7.5, [-7.8, 4.2, 1.5]);
  // skylight strip
  box(9, 0.2, 2.2, '#fffaf2', 3.2, [0, 7.9, -1]);
  // bounce card on the right
  box(0.2, 3.5, 4, '#fff3e0', 1.6, [7.8, 2.2, 2.5]);
  // back wall darker panel (gives rims a dark edge)
  box(8, 5, 0.2, '#3a2f26', 0.5, [0, 2.5, -7.8]);
  const pm = new T.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.035);
  pm.dispose();
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
  return rt;
}
