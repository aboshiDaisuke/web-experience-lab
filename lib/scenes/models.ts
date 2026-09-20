import * as T from 'three';
export const metal = () =>
  new T.MeshStandardMaterial({
    color: 0xb9bfc1,
    metalness: 1,
    roughness: 0.22,
  });
const mat = (color: number) =>
  new T.MeshStandardMaterial({ color, roughness: 0.6 });
export function box(
  parent: T.Object3D,
  size: number[],
  position: number[],
  color: number,
  name = '',
) {
  const m = new T.Mesh(
    new T.BoxGeometry(...(size as [number, number, number])),
    mat(color),
  );
  m.position.set(...(position as [number, number, number]));
  m.name = name;
  parent.add(m);
  return m;
}
export function sculpture() {
  const g = new T.Group();
  const m = metal();
  const knot = new T.Mesh(
    new T.TorusKnotGeometry(1.45, 0.47, 220, 36, 2, 3),
    m,
  );
  knot.rotation.set(0.4, -0.5, 0.1);
  g.add(knot);
  return g;
}
export function product() {
  const g = new T.Group();
  const body = new T.Mesh(new T.CylinderGeometry(0.82, 0.82, 2, 64), metal());
  body.material = new T.MeshStandardMaterial({
    color: 0xa8b1b5,
    metalness: 0.92,
    roughness: 0.32,
  });
  body.name = 'shell';
  g.add(body);
  const base = new T.Mesh(
    new T.CylinderGeometry(0.83, 0.85, 0.13, 64),
    mat(0x222626),
  );
  base.position.y = -1.1;
  base.name = 'base';
  g.add(base);
  const top = new T.Mesh(
    new T.CylinderGeometry(0.81, 0.81, 0.13, 64),
    mat(0x171a1a),
  );
  top.position.y = 1.08;
  top.name = 'top';
  g.add(top);
  const ring = new T.Mesh(
    new T.TorusGeometry(0.68, 0.024, 12, 64),
    new T.MeshStandardMaterial({
      color: 0xb6f8e9,
      emissive: 0x53d8d2,
      emissiveIntensity: 2,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.155;
  ring.name = 'light';
  g.add(ring);
  const core = new T.Mesh(
    new T.CylinderGeometry(0.48, 0.48, 1.6, 32),
    mat(0x262d30),
  );
  core.name = 'core';
  g.add(core);
  for (let i = 0; i < 9; i++) {
    const ring = new T.Mesh(new T.TorusGeometry(0.51, 0.025, 8, 48), metal());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.7 + i * 0.175;
    ring.name = 'coil';
    g.add(ring);
  }
  for (let j = 0; j < 42; j++) {
    const line = new T.Mesh(
      new T.CylinderGeometry(0.007, 0.007, 1.65, 3),
      mat(0x535b5e),
    );
    const a = (j / 42) * Math.PI * 2;
    line.position.set(Math.cos(a) * 0.823, 0, Math.sin(a) * 0.823);
    line.name = 'groove';
    g.add(line);
  }
  const copper = new T.MeshStandardMaterial({
    color: 0xb17a49,
    metalness: 0.86,
    roughness: 0.3,
  });
  g.children
    .filter((n) => n.name === 'coil')
    .forEach((n) => {
      (n as T.Mesh).material = copper.clone();
    });
  for (const y of [-0.94, 0.94]) {
    const trim = new T.Mesh(new T.TorusGeometry(0.826, 0.018, 10, 80), metal());
    trim.rotation.x = Math.PI / 2;
    trim.position.y = y;
    trim.name = 'shell';
    g.add(trim);
  }
  for (const y of [-0.55, 0.55]) {
    const driver = new T.Mesh(
      new T.ConeGeometry(0.4, 0.16, 48),
      new T.MeshStandardMaterial({
        color: 0x171d20,
        roughness: 0.82,
        metalness: 0.15,
      }),
    );
    driver.rotation.x = Math.PI / 2;
    driver.position.set(0, y, 0.43);
    driver.name = 'core';
    g.add(driver);
    const surround = new T.Mesh(
      new T.TorusGeometry(0.4, 0.035, 10, 48),
      new T.MeshStandardMaterial({ color: 0x12191b, roughness: 0.9 }),
    );
    surround.position.set(0, y, 0.5);
    surround.name = 'core';
    g.add(surround);
    const dome = new T.Mesh(new T.SphereGeometry(0.12, 24, 16), metal());
    dome.scale.set(1, 1, 0.45);
    dome.position.set(0, y, 0.51);
    dome.name = 'core';
    g.add(dome);
  }
  for (let i = 0; i < 4; i++) {
    const screw = new T.Mesh(
      new T.CylinderGeometry(0.027, 0.027, 0.012, 12),
      metal(),
    );
    screw.position.set(
      Math.cos((i * Math.PI) / 2) * 0.55,
      1.153,
      Math.sin((i * Math.PI) / 2) * 0.55,
    );
    screw.name = 'top';
    g.add(screw);
  }
  const board = box(g, [0.3, 0.65, 0.045], [0, -0.25, -0.49], 0x2f5946, 'core');
  for (let i = 0; i < 4; i++)
    box(
      g,
      [0.085, 0.09, 0.02],
      [-0.07 + (i % 2) * 0.14, -0.45 + Math.floor(i / 2) * 0.28, -0.525],
      0x192c25,
      'core',
    );
  const seam = new T.Mesh(
    new T.TorusGeometry(0.4, 0.006, 6, 60),
    new T.MeshStandardMaterial({ color: 0x54636a, roughness: 0.8 }),
  );
  seam.rotation.x = Math.PI / 2;
  seam.position.y = 1.152;
  seam.name = 'top';
  g.add(seam);
  return g;
}
export function house() {
  const g = new T.Group();
  box(g, [6, 0.16, 4.4], [0, -0.12, 0], 0x77776a);
  box(g, [4.7, 0.15, 3.3], [0, 0.05, 0], 0xd6d0c1);
  box(g, [4.8, 0.18, 3.5], [0, 1.85, 0], 0xe5e0d5, 'roof');
  box(g, [0.15, 1.8, 3.2], [-2.25, 0.9, 0], 0xb3b0a4);
  box(g, [4.5, 1.8, 0.15], [0, 0.9, -1.5], 0xd8d2c4);
  box(g, [0.12, 1.8, 3], [0.45, 0.9, 0], 0xc7c0af);
  for (const x of [-2.18, -0.7, 0.55, 2.18])
    box(g, [0.055, 1.8, 0.055], [x, 0.9, 1.5], 0x333834);
  box(g, [1.2, 0.45, 0.6], [-1.15, 0.4, -0.6], 0x776b5e);
  box(g, [1.2, 0.55, 0.15], [-1.15, 0.7, -0.92], 0x776b5e);
  box(g, [0.8, 0.1, 0.55], [-1.15, 0.32, 0.3], 0x3d3228);
  box(g, [1.3, 0.35, 1.8], [1.3, 0.3, -0.25], 0x645746, 'bed');
  box(g, [1.25, 0.18, 1.65], [1.3, 0.56, -0.2], 0xe9dfcd);
  box(g, [1, 0.15, 0.35], [1.3, 0.72, -0.8], 0xf2ead9);
  box(g, [1.2, 0.04, 2.8], [2.3, 0, 0.5], 0x457878);
  for (let i = 0; i < 7; i++)
    box(g, [0.22, 0.08, 3.2], [-2.8 + i * 0.12, 0.1, 0], 0x73634f);
  for (let i = 0; i < 13; i++)
    box(g, [0.06, 0.12, 3.2], [-2.15 + i * 0.35, 1.99, 0], 0xb2a38b, 'roof');
  for (const x of [-1.7, -0.65]) {
    box(g, [0.08, 0.22, 0.08], [x, 0.16, -0.35], 0x40382e);
    box(g, [0.08, 0.22, 0.08], [x, 0.16, -0.8], 0x40382e);
  }
  const rug = box(g, [1.8, 0.018, 1.5], [-1.2, 0.15, 0.3], 0xaaa18e);
  for (let i = 0; i < 11; i++)
    box(g, [1.78, 0.003, 0.009], [-1.2, 0.161, -0.38 + i * 0.13], 0xc5baa4);
  box(g, [0.4, 0.13, 0.35], [-1.5, 0.68, -0.57], 0xc3b499);
  box(g, [0.38, 0.15, 0.33], [-0.95, 0.68, -0.58], 0x9e927c);
  for (const x of [-2.8, 2.8])
    for (const z of [-1.7, 1.7]) {
      const foliage = new T.Mesh(
        new T.IcosahedronGeometry(0.27, 1),
        new T.MeshStandardMaterial({ color: 0x526549, roughness: 1 }),
      );
      foliage.position.set(x, 0.24, z);
      foliage.scale.set(1, 1.3, 1);
      g.add(foliage);
    }
  const water = box(g, [0.85, 0.025, 2.5], [2.42, 0.08, 0.35], 0x557f80);
  (water.material as T.MeshStandardMaterial).roughness = 0.12;
  (water.material as T.MeshStandardMaterial).metalness = 0.45;
  for (let i = 0; i < 4; i++)
    box(g, [0.65, 0.045, 0.12], [2.42, 0.1, -0.7 + i * 0.65], 0x83a1a0);
  return g;
}
export function room() {
  const g = new T.Group();
  box(g, [5, 0.18, 4], [0, -0.1, 0], 0x807562);
  box(g, [5, 3, 0.12], [0, 1.4, -2], 0xc5c2af);
  box(g, [0.12, 3, 4], [-2.5, 1.4, 0], 0x9e9d8b);
  box(g, [2, 0.12, 0.9], [0.4, 1, -1.2], 0x373c35);
  for (const x of [-0.4, 1.2])
    box(g, [0.08, 1, 0.08], [x, 0.5, -1.2], 0x272d28);
  box(g, [0.95, 0.65, 0.08], [0.25, 1.49, -1.35], 0x222a25, 'PC');
  box(g, [0.82, 0.5, 0.02], [0.25, 1.49, -1.29], 0xd8ff76, 'PC');
  box(g, [0.1, 0.3, 0.1], [0.25, 1.1, -1.35], 0x222a25, 'PC');
  box(g, [0.33, 0.25, 0.25], [1.05, 1.2, -1.15], 0x151916, 'CAMERA');
  const lens = new T.Mesh(new T.CylinderGeometry(0.09, 0.1, 0.15, 24), metal());
  lens.rotation.x = Math.PI / 2;
  lens.position.set(1.05, 1.2, -0.97);
  lens.name = 'CAMERA';
  g.add(lens);
  box(g, [0.7, 2.25, 0.5], [-1.8, 1.13, -1.6], 0x434a3c, 'BOOKS');
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 5; i++)
      box(
        g,
        [0.075, 0.35, 0.32],
        [-2.03 + i * 0.1, 0.3 + j * 0.52, -1.5],
        [0xd5c8a6, 0x899882, 0x333a32][i % 3],
        'BOOKS',
      );
  }
  box(g, [0.1, 1, 1.65], [-2.39, 1.65, 0.45], 0x212821, 'TV');
  box(g, [0.03, 0.84, 1.46], [-2.32, 1.65, 0.45], 0xa0b6bc, 'TV');
  box(g, [0.8, 0.1, 0.7], [0.2, 0.58, 0], 0x41493f);
  box(g, [0.8, 0.7, 0.1], [0.2, 0.95, 0.3], 0x41493f);
  box(g, [0.1, 0.6, 0.1], [0.2, 0.25, 0], 0x222822);
  box(g, [0.7, 1, 0.02], [1.6, 1.9, -1.91], 0xd9d28b);
  box(g, [1.7, 0.025, 1.4], [0.2, 0.025, 0.05], 0xb5ae91);
  for (let i = 0; i < 18; i++)
    box(g, [4.96, 0.006, 0.012], [0, 0.003, -1.84 + i * 0.21], 0x756b56);
  const pot = new T.Mesh(
    new T.CylinderGeometry(0.18, 0.13, 0.36, 24),
    new T.MeshStandardMaterial({ color: 0x83735c, roughness: 0.9 }),
  );
  pot.position.set(1.85, 0.18, -1.4);
  g.add(pot);
  const stem = new T.Mesh(
    new T.CylinderGeometry(0.018, 0.025, 0.8, 8),
    new T.MeshStandardMaterial({ color: 0x516644, roughness: 1 }),
  );
  stem.position.set(1.85, 0.68, -1.4);
  g.add(stem);
  for (let i = 0; i < 7; i++) {
    const leaf = new T.Mesh(
      new T.SphereGeometry(0.2, 12, 8),
      new T.MeshStandardMaterial({
        color: i % 2 ? 0x657853 : 0x435e39,
        roughness: 0.9,
      }),
    );
    leaf.scale.set(0.4, 1.5, 0.8);
    leaf.position.set(
      1.85 + Math.sin(i * 2) * 0.15,
      0.65 + i * 0.045,
      -1.4 + Math.cos(i * 2) * 0.15,
    );
    leaf.rotation.z = Math.sin(i * 2) * 0.8;
    g.add(leaf);
  }
  box(g, [0.63, 0.025, 0.25], [0.25, 1.08, -0.93], 0x858f79, 'PC');
  for (let i = 0; i < 8; i++)
    box(
      g,
      [0.055, 0.006, 0.18],
      [-0.005 + i * 0.071, 1.098, -0.94],
      0x394538,
      'PC',
    );
  const cup = new T.Mesh(
    new T.CylinderGeometry(0.065, 0.055, 0.14, 20),
    new T.MeshStandardMaterial({ color: 0xd9d5bd, roughness: 0.65 }),
  );
  cup.position.set(-0.35, 1.12, -1.17);
  g.add(cup);
  const cable = new T.CatmullRomCurve3([
    new T.Vector3(0.25, 1.05, -1.5),
    new T.Vector3(0.3, 0.8, -1.6),
    new T.Vector3(0.45, 0.2, -1.65),
  ]);
  const cord = new T.Mesh(
    new T.TubeGeometry(cable, 16, 0.012, 6, false),
    new T.MeshStandardMaterial({ color: 0x2c3328 }),
  );
  g.add(cord);
  return g;
}
