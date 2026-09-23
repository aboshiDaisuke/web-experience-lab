"""Bake day/night lightmaps per group atlas and export a web-ready GLB.
usage: blender -b <scene>.blend -P bake.py -- <id> <outdir> [samples] [sizes json]"""
import bpy, sys, os, json, math
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
PID, OUT = argv[0], argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 384
SIZES = json.loads(argv[3]) if len(argv) > 3 else {}
D = os.path.dirname(__file__)
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'; prefs.get_devices()
for d in prefs.devices: d.use = True
sc.cycles.device = 'GPU'
sc.cycles.samples = SAMPLES
sc.cycles.max_bounces = 6
sc.cycles.diffuse_bounces = 4
sc.render.bake.margin = 6
sc.render.bake.use_pass_direct = True
sc.render.bake.use_pass_indirect = True
sc.render.bake.use_pass_color = False
meta = json.load(open(os.path.join(D, f'{PID}_scene.json'))) if os.path.exists(os.path.join(D, f'{PID}_scene.json')) else {}

def root(o):
    while o.parent: o = o.parent
    return o

# ---------------------------------------------------------------- 1. prepare: remove asset sources, apply modifiers
for o in bpy.data.objects:
    if o.name.startswith('NAV_'):
        o.hide_render = True   # never let helper geometry shadow the bake
for o in list(bpy.data.objects):
    if o.name.startswith('ASSETSRC_'):
        bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type == 'MESH' and o.modifiers:
        bpy.context.view_layer.objects.active = o
        o.data = o.data.copy() if o.data.users > 1 else o.data
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)

def is_bake(o):
    if o.type != 'MESH' or o.name.startswith('NAV_') or o.get('nobake'):
        return False
    return not any(m and (m.get('glass') or m.get('alpha')) for m in o.data.materials)

# drop faces nobody can see (undersides resting on a floor) so the atlas isn't wasted
import bmesh
FLOORS = meta.get('floors', [0.0])
removed = 0
for o in bpy.data.objects:
    if not is_bake(o):
        continue
    bm = bmesh.new(); bm.from_mesh(o.data)
    mw = o.matrix_world
    kill = []
    for f in bm.faces:
        n = (mw.to_3x3() @ f.normal).normalized()
        if n.z < -0.95:
            z = (mw @ f.calc_center_median()).z
            if any(abs(z - fl) < 0.035 for fl in FLOORS):
                kill.append(f)
        elif n.z > 0.95 and root(o).name.endswith('_CEIL'):
            kill.append(f)
    if kill and len(kill) < len(bm.faces):
        bmesh.ops.delete(bm, geom=kill, context='FACES'); removed += len(kill)
        bm.to_mesh(o.data)
    bm.free()
print('REMOVED hidden faces', removed)
groups = sorted({root(o).name for o in bpy.data.objects if is_bake(o) and root(o) is not o})
joined = {}
for g in groups:
    obs = [o for o in bpy.data.objects if is_bake(o) and root(o).name == g]
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
        # keep world transform when unparenting
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = f'{g}_mesh'
    j.data.name = j.name
    j.parent = bpy.data.objects[g]
    j['lightmap'] = f'{PID}-{g}'
    joined[g] = j
    # lightmap UVs
    uv = j.data.uv_layers.new(name='Lightmap')
    j.data.uv_layers.active = uv
    bpy.ops.object.select_all(action='DESELECT'); j.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.pack_islands(margin=0.004, rotate=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    j.data.uv_layers.active = j.data.uv_layers[0]
    print('JOINED', g, len(j.data.polygons))

# ---------------------------------------------------------------- 2. glass lets light through during bake
glass_swap = {}
for m in bpy.data.materials:
    if m.get('glass'):
        nt = m.node_tree
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        glass_swap[m.name] = (out.inputs['Surface'].links[0].from_socket, tr)
        nt.links.new(tr.outputs[0], out.inputs['Surface'])

# ---------------------------------------------------------------- 3. world + lights per mode
w = bpy.data.worlds.new('BakeWorld'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']
env = w.node_tree.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(os.path.join(D, 'hdri', meta.get('hdri', 'kloofendal_48d_partly_cloudy_puresky.hdr')))
mapping = w.node_tree.nodes.new('ShaderNodeMapping'); tc = w.node_tree.nodes.new('ShaderNodeTexCoord')
w.node_tree.links.new(tc.outputs['Generated'], mapping.inputs['Vector'])
w.node_tree.links.new(mapping.outputs['Vector'], env.inputs['Vector'])
mapping.inputs['Rotation'].default_value[2] = math.radians(meta.get('hdri_rot', 0))
mix = w.node_tree.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
w.node_tree.links.new(env.outputs['Color'], mix.inputs[6])
mix.inputs[7].default_value = (0.02, 0.035, 0.08, 1)
w.node_tree.links.new(mix.outputs[2], bg.inputs['Color'])
sd = bpy.data.lights.new('BakeSun', 'SUN'); sd.angle = math.radians(1.2); sd.color = (1.0, 0.94, 0.86)
sun = bpy.data.objects.new('BakeSun', sd); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(meta.get('sun_elev', 48)), 0, math.radians(meta.get('sun_az', -35)))

def set_mode(night):
    mix.inputs['Factor'].default_value = 1.0 if night else 0.0
    bg.inputs['Strength'].default_value = meta.get('night_sky', 0.35) if night else meta.get('day_sky', 1.0)
    sd.energy = 0.0 if night else meta.get('sun', 4.0)
    for o in bpy.data.objects:
        if o.type == 'LIGHT' and o.get('night'):
            if not hasattr(o, '_base'):
                pass
            base = o.get('base_energy') or o.data.energy
            o['base_energy'] = base
            if night:
                o.hide_render = False; o.data.energy = base
            elif o.get('day'):
                o.hide_render = False; o.data.energy = base * o['day']
            else:
                o.hide_render = True
    for m in bpy.data.materials:
        if m.get('emissive'):
            b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            b.inputs['Emission Strength'].default_value = 6.0 if night else 0.0

def target(g, mode):
    size = SIZES.get(g, 1024)
    name = f'{PID}-{g}-{mode}'
    img = bpy.data.images.new(name, size, size, float_buffer=True, alpha=True)
    j = joined[g]
    for m in j.data.materials:
        nt = m.node_tree
        n = nt.nodes.get('__bake') or nt.nodes.new('ShaderNodeTexImage')
        n.name = '__bake'
        n.image = img
        nt.nodes.active = n
    return img

def denoise_encode(img, scale, passes=1):
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    rgb, a = px[..., :3], (px[..., 3] > 0.5).astype(np.float32)[..., None]
    # masked separable gaussian (sigma≈1.3px) to remove bake grain without bleeding across islands
    k = np.array([0.05, 0.25, 0.4, 0.25, 0.05], np.float32)
    def blur(x):
        for ax in (0, 1):
            x = sum(np.roll(x, s - 2, axis=ax) * k[s] for s in range(5))
        return x
    num, den = rgb * a, a
    for _ in range(passes):
        num = blur(num); den = blur(den)
    out = np.where(den > 1e-3, num / np.maximum(den, 1e-3), rgb)
    enc = np.clip(out / scale, 0, 1) ** (1 / 2.2)
    return enc, float(np.percentile(out[a[..., 0] > 0], 99.5)) if a.sum() else 0

# ---------------------------------------------------------------- 4. bake
stats = {}
for mode in ('day', 'night'):
    set_mode(mode == 'night')
    for g, j in joined.items():
        img = target(g, mode)
        bpy.ops.object.select_all(action='DESELECT'); j.select_set(True)
        bpy.context.view_layer.objects.active = j
        # bake into the Lightmap uv layer
        j.data.uv_layers.active = j.data.uv_layers['Lightmap']
        bpy.ops.object.bake(type='DIFFUSE', uv_layer='Lightmap')
        j.data.uv_layers.active = j.data.uv_layers[0]
        scale = meta.get('lm_scale', 4.0)
        enc, p995 = denoise_encode(img, scale, 4 if g.endswith('_CEIL') else 1)
        stats[f'{g}-{mode}'] = p995
        np.save(os.path.join(OUT, f'{PID}-{g}-{mode}.npy'), (enc[::-1] * 255).astype(np.uint8))
        print('BAKED', g, mode, 'p99.5', round(p995, 3))

json.dump({'stats': stats, 'scale': meta.get('lm_scale', 4.0)}, open(os.path.join(OUT, f'{PID}-bake.json'), 'w'), indent=1)

# ---------------------------------------------------------------- 5. export
for m in bpy.data.materials:
    n = m.node_tree.nodes.get('__bake') if m.use_nodes else None
    if n: m.node_tree.nodes.remove(n)
for name, (orig, tr) in glass_swap.items():
    m = bpy.data.materials[name]
    out = next(n for n in m.node_tree.nodes if n.type == 'OUTPUT_MATERIAL')
    m.node_tree.links.new(orig, out.inputs['Surface'])
    m.node_tree.nodes.remove(tr)
set_mode(False)
for img in bpy.data.images:
    if img.name.startswith(PID + '-') or not img.size[0]:
        continue
    lim = 1024 if 'wood_floor' in img.filepath else 512
    if img.size[0] > lim:
        img.scale(lim, lim)
for o in list(bpy.data.objects):
    if o.type == 'LIGHT':
        bpy.data.objects.remove(o)
for o in bpy.data.objects:
    if o.name.startswith('NAV_'):
        o.hide_render = False
for m in bpy.data.materials:
    if not m.use_nodes: continue
    for n in list(m.node_tree.nodes):
        if n.type == 'TEX_IMAGE' and (n.image is None or not n.image.has_data or not n.image.size[0]):
            m.node_tree.nodes.remove(n)
        elif n.type == 'TEX_IMAGE' and n.image and n.image.packed_file is None and not os.path.exists(bpy.path.abspath(n.image.filepath)):
            n.image.pack()
for m in bpy.data.materials:
    if not (m.use_nodes and m.name.startswith('potted_plant')): continue
    for n in list(m.node_tree.nodes):
        if n.type in ('SEPARATE_COLOR', 'MATH') or (n.type == 'TEX_IMAGE' and n.image.name.endswith('_rough')):
            m.node_tree.nodes.remove(n)
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Roughness'].default_value = 0.6; b.inputs['Metallic'].default_value = 0.0
    if m.name.endswith('leaves'):
        d = next(n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image.name.endswith('_diff'))
        m.node_tree.links.new(d.outputs['Alpha'], b.inputs['Alpha'])
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D, f'{PID}_baked.blend'))
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, f'{PID}.glb'), export_format='GLB',
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_extras=True, export_lights=False, export_cameras=False,
    export_image_format='WEBP', export_image_quality=82, export_yup=True, export_apply=False)
print('EXPORTED', os.path.getsize(os.path.join(OUT, f'{PID}.glb')))
