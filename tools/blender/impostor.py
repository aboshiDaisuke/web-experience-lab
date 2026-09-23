import bpy, os, math, sys
from mathutils import Vector
D = os.path.dirname(__file__)
os.makedirs(os.path.join(D, 'impostors'), exist_ok=True)
for name in ['island_tree_02', 'tree_small_02', 'jacaranda_tree', 'potted_plant_02']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(D, 'models', name, f'{name}.gltf'))
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    size = mx - mn
    print('MODEL', name, 'tris', tris, 'size', tuple(round(v, 2) for v in size), 'min', tuple(round(v, 2) for v in mn))
    if name == 'potted_plant_02':
        continue
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'; sc.cycles.samples = 64; sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.8, 0.85, 1.0, 1)
    sd = bpy.data.lights.new('S', 'SUN'); sd.energy = 3.0
    so = bpy.data.objects.new('S', sd); sc.collection.objects.link(so); so.rotation_euler = (math.radians(40), 0, math.radians(30))
    cd = bpy.data.cameras.new('C'); cd.type = 'ORTHO'
    cam = bpy.data.objects.new('C', cd); sc.collection.objects.link(cam); sc.camera = cam
    side = max(size.x, size.y, size.z) * 1.02
    cd.ortho_scale = side
    ctr = (mn + mx) / 2
    sc.render.resolution_x = sc.render.resolution_y = 1024
    for k, ang in (('a', 0), ('b', math.pi / 2)):
        d = Vector((math.sin(ang), -math.cos(ang), 0))
        cam.location = ctr - d * 50
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(D, 'impostors', f'{name}_{k}.png')
        bpy.ops.render.render(write_still=True)
    open(os.path.join(D, 'impostors', f'{name}.txt'), 'w').write(f'{side} {ctr.x} {ctr.y} {ctr.z} {mn.z}')
