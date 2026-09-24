"""Stones and driftwood for the aquarium hero.
usage: blender -b --factory-startup -P hardscape.py -- <outdir>

Each piece is sculpted as a dense mesh from noise (stones: layered, sharp
ridged Seiryu stone; wood: branching spider wood from a random walk), then
decimated / rebuilt at web density and the detail is baked down into colour
(with ambient occlusion) and tangent-space normal maps. One GLB per piece,
centred on x/z with its base at y = 0.
"""
import bpy, bmesh, math, random, os, sys
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), 'out', 'hardscape')
os.makedirs(OUT, exist_ok=True)
random.seed(11)

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    sc.cycles.device = 'GPU'
except Exception:
    pass
sc.cycles.samples = 24
sc.render.bake.margin = 8

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
world = bpy.data.worlds.new('w')
sc.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs[1].default_value = 1.0


def node(nt, kind, **inputs):
    n = nt.nodes.new(kind)
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def ramp(nt, stops):
    r = nt.nodes.new('ShaderNodeValToRGB')
    els = r.color_ramp.elements
    while len(els) > 1:
        els.remove(els[-1])
    els[0].position, els[0].color = stops[0]
    for pos, col in stops[1:]:
        e = els.new(pos)
        e.color = col
    return r


def stone_material():
    m = bpy.data.materials.new('stone_src')
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    # mottled blue-grey body
    n1 = node(nt, 'ShaderNodeTexNoise', Scale=0.35, Detail=8.0, Roughness=0.62)
    nt.links.new(tc.outputs['Object'], n1.inputs['Vector'])
    r1 = ramp(nt, [(0.3, (0.1, 0.11, 0.12, 1)), (0.5, (0.24, 0.26, 0.28, 1)), (0.68, (0.36, 0.38, 0.39, 1)), (0.8, (0.2, 0.22, 0.24, 1))])
    nt.links.new(n1.outputs['Fac'], r1.inputs['Fac'])
    # white calcite veins running along the strata
    w = nt.nodes.new('ShaderNodeTexWave')
    w.wave_type = 'BANDS'
    w.bands_direction = 'Z'
    w.inputs['Scale'].default_value = 0.09
    w.inputs['Distortion'].default_value = 9.0
    w.inputs['Detail'].default_value = 6.0
    w.inputs['Detail Scale'].default_value = 1.4
    nt.links.new(tc.outputs['Object'], w.inputs['Vector'])
    r2 = ramp(nt, [(0.0, (0, 0, 0, 1)), (0.93, (0, 0, 0, 1)), (0.975, (1, 1, 1, 1)), (1.0, (0, 0, 0, 1))])
    nt.links.new(w.outputs['Fac'], r2.inputs['Fac'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs[7].default_value = (0.72, 0.72, 0.68, 1)
    nt.links.new(r2.outputs['Color'], mix.inputs['Factor'])
    nt.links.new(r1.outputs['Color'], mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.8
    return m


def wood_material():
    m = bpy.data.materials.new('wood_src')
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n1 = node(nt, 'ShaderNodeTexNoise', Scale=0.6, Detail=10.0, Roughness=0.6)
    nt.links.new(tc.outputs['Object'], n1.inputs['Vector'])
    r1 = ramp(nt, [(0.35, (0.05, 0.028, 0.016, 1)), (0.52, (0.14, 0.08, 0.042, 1)), (0.7, (0.3, 0.2, 0.12, 1))])
    nt.links.new(n1.outputs['Fac'], r1.inputs['Fac'])
    nt.links.new(r1.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.85
    return m


STONE = stone_material()
WOOD = wood_material()


def ridged(p, s):
    return noise.ridged_multi_fractal(p * s, 0.9, 2.1, 5, 1.0, 2.0, noise_basis='PERLIN_ORIGINAL')


def stone(name, size, seed, subdiv=6):
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')
    # the icosphere's own UV net is laid down before the shape is sculpted,
    # so the web copy gets large, low-distortion islands
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0, calc_uvs=True)
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    tilt = Vector((math.sin(seed), math.cos(seed * 1.7), 0.25)).normalized()
    rng = random.Random(seed * 101)
    # random slicing planes give the big flat faces and sharp crests of
    # Seiryu stone; mostly steep, so the faces run up the stone
    planes = []
    for i in range(16):
        a = rng.uniform(0, math.tau)
        el = rng.uniform(-0.35, 0.9) if i % 4 else rng.uniform(0.6, 1.0)
        n = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el))).normalized()
        support = math.sqrt((n.x * size[0]) ** 2 + (n.y * size[1]) ** 2 + (n.z * size[2]) ** 2)
        planes.append((n, support * rng.uniform(0.62, 0.9)))
    s = min(size)
    for v in bm.verts:
        n = v.co.normalized()
        p = Vector((n.x * size[0], n.y * size[1], n.z * size[2]))
        for pn, d0 in planes:
            h = p.dot(pn) - d0
            if h > 0:
                p -= pn * h
        q = p * 0.2 + off
        # relief on the faces: weathered lumps, a few crisp ridges, and the
        # grooves of the strata cutting across everything
        d = 0.06 * noise.fractal(q, 0.6, 2.0, 5)
        d += 0.05 * (ridged(q, 1.8) - 1.0)
        strata = math.sin(p.dot(tilt) * 2.4 + 1.8 * noise.fractal(q * 1.3, 0.5, 2.0, 3))
        d -= 0.035 * abs(strata) ** 6
        v.co = p + n * d * s
    # the base is buried: flatten it
    zmin = min(v.co.z for v in bm.verts)
    base = zmin + (max(v.co.z for v in bm.verts) - zmin) * 0.12
    for v in bm.verts:
        if v.co.z < base:
            v.co.z = base + (v.co.z - base) * 0.15
    # stretch the ico net over the whole texture
    uvl = bm.loops.layers.uv.active
    us = [l[uvl].uv.copy() for f in bm.faces for l in f.loops]
    u0, u1 = min(u.x for u in us), max(u.x for u in us)
    v0, v1 = min(u.y for u in us), max(u.y for u in us)
    for f in bm.faces:
        for l in f.loops:
            uv = l[uvl].uv
            uv.x = 0.01 + 0.98 * (uv.x - u0) / (u1 - u0)
            uv.y = 0.01 + 0.98 * (uv.y - v0) / (v1 - v0)
    tag = '_hi' if subdiv > 5 else ''
    me = bpy.data.meshes.new(name + tag)
    bm.to_mesh(me)
    bm.free()
    hi = bpy.data.objects.new(name + tag, me)
    sc.collection.objects.link(hi)
    me.materials.append(STONE)
    for f in me.polygons:
        f.use_smooth = True
    return hi


def branch_points(start, direction, length, radius, depth, rng):
    pts = []
    p = Vector(start)
    d = Vector(direction).normalized()
    steps = max(4, int(length / 1.2))
    for i in range(steps + 1):
        t = i / steps
        pts.append((p.copy(), radius * (1 - 0.8 * t) + 0.12))
        # wander, with a pull upward (wood reaches for the light)
        d += Vector((rng.uniform(-.35, .35), rng.uniform(-.35, .35), rng.uniform(-.25, .3))) * 0.5
        d.normalize()
        p += d * (length / steps)
    kids = []
    if depth > 0:
        for i in range(2 + depth):
            k = rng.randint(1, len(pts) - 2)
            bp, br = pts[k]
            nd = d.copy() + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.0, 0.8)))
            kids.append((bp, nd, length * rng.uniform(0.35, 0.6), br * 0.7, depth - 1))
    return pts, kids


def driftwood(name, seed, length, radius, hi=True):
    rng = random.Random(seed)
    cu = bpy.data.curves.new(name + '_cu', 'CURVE')
    cu.dimensions = '3D'
    cu.fill_mode = 'FULL'
    cu.bevel_depth = 1.0
    cu.bevel_resolution = 6 if hi else 2
    cu.resolution_u = 6 if hi else 2
    queue = [((0, 0, 0), (1, 0.2, 0.28), length, radius, 3)]
    while queue:
        start, direc, ln, rad, depth = queue.pop()
        pts, kids = branch_points(start, direc, ln, rad, depth, rng)
        sp = cu.splines.new('NURBS')
        sp.points.add(len(pts) - 1)
        for i, (p, r) in enumerate(pts):
            sp.points[i].co = (p.x, p.y, p.z, 1)
            sp.points[i].radius = r
        sp.use_endpoint_u = True
        sp.order_u = 3
        queue.extend(kids)
    ob = bpy.data.objects.new(name + ('_hi' if hi else ''), cu)
    sc.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.active_object
    ob.select_set(False)
    if not hi:
        ob.data.materials.clear()
        for f in ob.data.polygons:
            f.use_smooth = True
        bpy.context.view_layer.objects.active = ob
        for o in sc.objects:
            o.select_set(o == ob)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(80), island_margin=0.004)
        bpy.ops.object.mode_set(mode='OBJECT')
        return ob
    # bark: grooves running along the wood, then weathered pits
    me = ob.data
    me.materials.clear()
    me.materials.append(WOOD)
    for v in me.vertices:
        q = v.co * 0.35 + Vector((seed, seed * 2, 0))
        g = noise.fractal(Vector((q.x * 0.4, q.y * 0.4, q.z * 3.0)), 0.5, 2.0, 4)
        v.co += v.normal * (0.25 * g - 0.12 * abs(noise.noise(q * 4.0)))
    for f in me.polygons:
        f.use_smooth = True
    return ob


def web_copy(hi, target_faces, is_curve=False):
    lo = hi.copy()
    lo.data = hi.data.copy()
    lo.name = hi.name.replace('_hi', '')
    sc.collection.objects.link(lo)
    bpy.context.view_layer.objects.active = lo
    for o in sc.objects:
        o.select_set(o == lo)
    ratio = min(1.0, target_faces / len(lo.data.polygons))
    mod = lo.modifiers.new('dec', 'DECIMATE')
    mod.ratio = ratio
    bpy.ops.object.modifier_apply(modifier='dec')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.01)
    bpy.ops.object.mode_set(mode='OBJECT')
    return lo


def bake(hi, lo, res):
    img_c = bpy.data.images.new(lo.name + '_color', res, res)
    img_n = bpy.data.images.new(lo.name + '_normal', res, res, float_buffer=False)
    img_n.colorspace_settings.name = 'Non-Color'
    img_a = bpy.data.images.new(lo.name + '_ao', res, res)
    img_a.colorspace_settings.name = 'Non-Color'
    mat = bpy.data.materials.new(lo.name + '_mat')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    lo.data.materials.clear()
    lo.data.materials.append(mat)
    tex = nt.nodes.new('ShaderNodeTexImage')
    size = max(lo.dimensions)
    cage = size * 0.06

    def run(img, kind, **kw):
        tex.image = img
        nt.nodes.active = tex
        for o in sc.objects:
            o.select_set(o in (hi, lo))
        bpy.context.view_layer.objects.active = lo
        bpy.ops.object.bake(type=kind, use_selected_to_active=True, cage_extrusion=cage, max_ray_distance=cage * 2, margin=8, **kw)

    sc.render.bake.use_pass_direct = False
    sc.render.bake.use_pass_indirect = False
    sc.render.bake.use_pass_color = True
    run(img_c, 'DIFFUSE')
    run(img_n, 'NORMAL')
    sc.cycles.samples = 64
    run(img_a, 'AO')
    sc.cycles.samples = 24
    # fold occlusion into the colour
    import numpy as np
    c = np.array(img_c.pixels[:]).reshape(-1, 4)
    a = np.array(img_a.pixels[:]).reshape(-1, 4)[:, :1]
    c[:, :3] *= 0.35 + 0.65 * a
    img_c.pixels[:] = c.ravel()
    for img in (img_c, img_n):
        img.file_format = 'PNG'
        img.filepath_raw = os.path.join(OUT, img.name + '.png')
        img.save()
    # wire the baked maps into the web material
    tex.image = img_c
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = img_n
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = 0.85


def export(lo):
    # centre on x/y, base at z = 0 (glTF y = 0)
    bb = [lo.matrix_world @ Vector(c) for c in lo.bound_box]
    cx = sum(v.x for v in bb) / 8
    cy = sum(v.y for v in bb) / 8
    zmin = min(v.z for v in bb)
    lo.data.transform(__import__('mathutils').Matrix.Translation((-cx, -cy, -zmin)))
    for o in sc.objects:
        o.select_set(o == lo)
    bpy.context.view_layer.objects.active = lo
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, lo.name + '.glb'), use_selection=True, export_format='GLB',
                              export_image_format='WEBP', export_materials='EXPORT', export_apply=True,
                              export_draco_mesh_compression_enable=True)
    print('exported', lo.name, len(lo.data.polygons), 'faces', tuple(round(x, 1) for x in lo.dimensions))


PIECES = [
    ('stone_a', (9.0, 7.0, 15.0), 1, 1024),
    ('stone_b', (7.0, 6.0, 10.0), 2, 1024),
    ('stone_c', (6.0, 5.5, 6.5), 3, 512),
    ('stone_d', (4.5, 4.0, 4.0), 4, 512),
    ('stone_e', (3.0, 2.8, 2.6), 5, 512),
]
for name, size, seed, res in PIECES:
    hi = stone(name, size, seed)
    lo = stone(name, size, seed, subdiv=5)
    bake(hi, lo, res)
    export(lo)
    bpy.data.objects.remove(hi)
    bpy.data.objects.remove(lo)

for name, seed, length, radius, res in [('wood_a', 5, 30, 2.4, 1024), ('wood_b', 9, 20, 1.7, 1024)]:
    hi = driftwood(name, seed, length, radius)
    lo = driftwood(name, seed, length, radius, hi=False)
    bake(hi, lo, res)
    export(lo)
    bpy.data.objects.remove(hi)
    bpy.data.objects.remove(lo)
print('DONE')
