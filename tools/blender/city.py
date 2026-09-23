"""Procedural Tokyo-like city for the LUCE view panoramas.
blender -b --factory-startup -P city.py -- <outdir> [samples] [heights csv]"""
import bpy, bmesh, math, os, random, sys
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'out/city'
SAMPLES = int(argv[1]) if len(argv) > 1 else 96
HEIGHTS = [float(h) for h in (argv[2].split(',') if len(argv) > 2 else ['12', '33', '57'])]
D = os.path.dirname(__file__)
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(7)
sc = bpy.context.scene

# ------------------------------------------------------------------ materials
def haze(nt, color_out, strength=1.0):
    """mix colour towards sky haze by view distance (aerial perspective)."""
    cam = nt.nodes.new('ShaderNodeCameraData')
    mr = nt.nodes.new('ShaderNodeMath'); mr.operation = 'MULTIPLY'; mr.inputs[1].default_value = -1 / 2600
    ex = nt.nodes.new('ShaderNodeMath'); ex.operation = 'EXPONENT'
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
    sc_ = nt.nodes.new('ShaderNodeMath'); sc_.operation = 'MULTIPLY'; sc_.inputs[1].default_value = 0.8 * strength
    nt.links.new(cam.outputs['View Distance'], mr.inputs[0]); nt.links.new(mr.outputs[0], ex.inputs[0])
    nt.links.new(ex.outputs[0], inv.inputs[1]); nt.links.new(inv.outputs[0], sc_.inputs[0])
    return sc_.outputs[0]

HAZE = {'day': (0.62, 0.7, 0.8), 'night': (0.03, 0.035, 0.06)}
MODE = {'v': 'day'}
mats = []

def facade(name, wall, glass, rows=3.2, cols=2.6, lit=0.35, warm=(1.0, 0.72, 0.42)):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs[0])
    add = nt.nodes.new('ShaderNodeMath'); add.operation = 'ADD'
    nt.links.new(sep.outputs['X'], add.inputs[0]); nt.links.new(sep.outputs['Y'], add.inputs[1])
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(add.outputs[0], comb.inputs['X']); nt.links.new(sep.outputs['Z'], comb.inputs['Y'])
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Brick Width'].default_value = cols
    br.inputs['Row Height'].default_value = rows
    br.inputs['Mortar Size'].default_value = 0.55
    br.inputs['Mortar Smooth'].default_value = 0.0
    br.offset = 0.0
    br.inputs['Color1'].default_value = (*glass, 1)
    br.inputs['Color2'].default_value = (*glass, 1)
    br.inputs['Mortar'].default_value = (*wall, 1)
    nt.links.new(comb.outputs[0], br.inputs['Vector'])
    # random lit windows
    noise = nt.nodes.new('ShaderNodeTexWhiteNoise'); noise.noise_dimensions = '3D'
    snap = nt.nodes.new('ShaderNodeVectorMath'); snap.operation = 'SNAP'; snap.inputs[1].default_value = (cols, rows, 1)
    nt.links.new(comb.outputs[0], snap.inputs[0]); nt.links.new(snap.outputs[0], noise.inputs['Vector'])
    thr = nt.nodes.new('ShaderNodeMath'); thr.operation = 'LESS_THAN'; thr.inputs[1].default_value = lit
    nt.links.new(noise.outputs['Value'], thr.inputs[0])
    win = nt.nodes.new('ShaderNodeMath'); win.operation = 'SUBTRACT'; win.inputs[0].default_value = 1.0
    nt.links.new(br.outputs['Fac'], win.inputs[1])  # 1 on glass
    em = nt.nodes.new('ShaderNodeMath'); em.operation = 'MULTIPLY'
    nt.links.new(thr.outputs[0], em.inputs[0]); nt.links.new(win.outputs[0], em.inputs[1])
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(br.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.45
    bsdf.inputs['Emission Color'].default_value = (*warm, 1)
    es = nt.nodes.new('ShaderNodeMath'); es.operation = 'MULTIPLY'; es.inputs[1].default_value = 0.0
    nt.links.new(em.outputs[0], es.inputs[0]); nt.links.new(es.outputs[0], bsdf.inputs['Emission Strength'])
    m['em'] = es.name
    # haze
    h = haze(nt, None)
    hz = nt.nodes.new('ShaderNodeEmission'); hz.name = 'haze'
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(h, mix.inputs[0]); nt.links.new(bsdf.outputs[0], mix.inputs[1]); nt.links.new(hz.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    mats.append(m)
    return m

def plain(name, color, rough=0.8, emit=None, emit_night=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    bsdf.inputs['Base Color'].default_value = (*color, 1); bsdf.inputs['Roughness'].default_value = rough
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*emit, 1)
        m['emit_night'] = emit_night
    h = haze(nt, None)
    hz = nt.nodes.new('ShaderNodeEmission'); hz.name = 'haze'
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(h, mix.inputs[0]); nt.links.new(bsdf.outputs[0], mix.inputs[1]); nt.links.new(hz.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    mats.append(m)
    return m

F = [facade('F_concrete', (0.55, 0.53, 0.5), (0.1, 0.12, 0.15)),
     facade('F_white', (0.78, 0.77, 0.74), (0.12, 0.14, 0.17), rows=3.0, cols=1.8),
     facade('F_brick', (0.45, 0.33, 0.27), (0.1, 0.1, 0.12), rows=2.9, cols=2.2, lit=0.45),
     facade('F_glass', (0.3, 0.36, 0.42), (0.18, 0.25, 0.32), rows=3.6, cols=1.5, lit=0.55, warm=(0.9, 0.93, 1.0)),
     facade('F_beige', (0.7, 0.64, 0.55), (0.12, 0.12, 0.13), rows=3.0, cols=3.0, lit=0.4)]
roof = plain('Roof', (0.42, 0.42, 0.41), 0.9)
asphalt = plain('Asphalt', (0.12, 0.12, 0.13), 0.9)
ground = plain('Ground', (0.3, 0.31, 0.28), 0.95)
park = plain('Park', (0.12, 0.2, 0.09), 0.95)
treem = plain('Tree', (0.08, 0.16, 0.06), 0.9)
street = plain('StreetLight', (0.3, 0.3, 0.3), 0.5, emit=(1.0, 0.72, 0.4), emit_night=12.0)
cars = plain('CarLights', (0.2, 0.05, 0.03), 0.5, emit=(1.0, 0.25, 0.12), emit_night=8.0)
beacon = plain('Beacon', (0.4, 0.05, 0.05), 0.5, emit=(1.0, 0.1, 0.08), emit_night=30.0)
mount = plain('Mountain', (0.35, 0.4, 0.5), 0.9)
snow = plain('Snow', (0.9, 0.92, 0.95), 0.6)

# ------------------------------------------------------------------ geometry via one bmesh per material (fast)
BM = {}
def bm_for(m):
    if m.name not in BM: BM[m.name] = (bmesh.new(), m)
    return BM[m.name][0]
def add_box(m, x0, y0, z0, x1, y1, z1):
    bm = bm_for(m)
    vs = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([vs[i] for i in f])
def add_blob(m, x, y, z, r):
    bm = bm_for(m)
    res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
    bmesh.ops.translate(bm, verts=res['verts'], vec=(x, y, z))

EX = 3200
add_box(ground, -EX, -EX, -1, EX, EX, 0)
BLOCK, ROAD, AVE = 40.0, 8.0, 22.0
tower_clusters = [(1300, -1500, 210), (-1700, -800, 230), (1900, 600, 180), (500, 2000, 200), (-900, -2300, 190), (2300, -400, 160)]
def cell_edges(n):
    xs = [0.0]
    for k in range(n):
        xs.append(xs[-1] + BLOCK + (AVE if k % 5 == 4 else ROAD))
    return xs
edges = cell_edges(140)
off = edges[70]
coords = [e - off for e in edges]
for ii in range(len(coords) - 1):
    for jj in range(len(coords) - 1):
        bx, by = coords[ii], coords[jj]
        if abs(bx) > EX or abs(by) > EX:
            continue
        cx, cy = bx + BLOCK / 2, by + BLOCK / 2
        d = math.hypot(cx, cy)
        on_ave = (ii % 5 in (0, 4)) or (jj % 5 in (0, 4))
        if d < 40:
            continue
        if (ii * 7 + jj * 13) % 29 == 0 and 120 < d < 2200:
            add_box(park, bx, by, 0, bx + BLOCK, by + BLOCK, 0.2)
            for k in range(12):
                add_blob(treem, bx + random.uniform(4, BLOCK - 4), by + random.uniform(4, BLOCK - 4), 6, random.uniform(3.5, 6))
            continue
        if d > 2600 and random.random() < 0.35:
            continue
        # street lights / cars along the block's south & west edge
        if d < 1800:
            for k in range(2):
                add_box(street, bx + 5 + k * 20, by - 1.2, 6, bx + 5.6 + k * 20, by - 0.7, 6.25)
            if on_ave and random.random() < 0.6:
                x = bx + random.uniform(0, 34)
                add_box(cars, x, by - 5.5, 0.5, x + 4.2, by - 4.2, 1.3)
        boost = max((h * math.exp(-((cx - tx) ** 2 + (cy - ty) ** 2) / (2 * 230 ** 2)) for tx, ty, h in tower_clusters), default=0)
        lots = random.choice(((1, 1), (2, 1), (2, 2), (3, 2), (2, 2)))
        lw, ld = BLOCK / lots[0], BLOCK / lots[1]
        for a_ in range(lots[0]):
            for b_ in range(lots[1]):
                if random.random() < 0.08:
                    continue
                x0 = bx + a_ * lw + random.uniform(0.5, 2.0); y0 = by + b_ * ld + random.uniform(0.5, 2.0)
                x1 = bx + (a_ + 1) * lw - random.uniform(0.5, 2.0); y1 = by + (b_ + 1) * ld - random.uniform(0.5, 2.0)
                base = random.choice((7, 10, 13, 16, 19, 22)) + (18 if on_ave else 0)
                h = base * random.uniform(0.8, 1.25)
                if random.random() < 0.05: h += random.uniform(20, 45)
                if boost > 30 and a_ == 0 and b_ == 0:
                    h = max(h, boost * random.uniform(0.55, 1.0))
                fm = F[3] if h > 80 else random.choice((F[0], F[1], F[1], F[2], F[4]))
                add_box(fm, x0, y0, 0, x1, y1, h)
                add_box(roof, x0 + 0.3, y0 + 0.3, h, x1 - 0.3, y1 - 0.3, h + 0.5)
                if h > 110:
                    add_box(beacon, (x0 + x1) / 2 - 0.6, (y0 + y1) / 2 - 0.6, h + 0.5, (x0 + x1) / 2 + 0.6, (y0 + y1) / 2 + 0.6, h + 1.8)
# a river with cherry trees running SE
river = plain('River', (0.06, 0.1, 0.12), 0.1); sak = plain('Sakura', (0.75, 0.55, 0.58), 0.9)
for t in range(0, 70):
    x = -350 + t * 28; y = -140 - t * 11
    add_box(river, x, y, 0.3, x + 30, y + 13, 0.35)
    add_blob(sak, x + 10, y - 3, 5, 4.5); add_blob(sak, x + 22, y + 16, 5, 4.2)
# Mt. Fuji ~60km south-west
bm = bm_for(mount)
res = bmesh.ops.create_cone(bm, cap_ends=True, segments=96, radius1=22000, radius2=1200, depth=3776)
bmesh.ops.translate(bm, verts=res['verts'], vec=(-42000, -44000, 1888 - 200))
bm2 = bm_for(snow)
res = bmesh.ops.create_cone(bm2, cap_ends=True, segments=96, radius1=6200, radius2=1150, depth=1000)
bmesh.ops.translate(bm2, verts=res['verts'], vec=(-42000, -44000, 3776 - 200 - 495))
for name, (bm, m) in BM.items():
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); me.materials.append(m)
print('CITY faces', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))

# ------------------------------------------------------------------ render setup
sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'; prefs.get_devices()
for d in prefs.devices: d.use = True
sc.cycles.device = 'GPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.cycles.max_bounces = 3
RX = int(argv[3]) if len(argv) > 3 else 4096
sc.render.resolution_x, sc.render.resolution_y = RX, RX // 2
sc.view_settings.view_transform = 'AgX'
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 88
cam_d = bpy.data.cameras.new('Pano'); cam_d.type = 'PANO'
try:
    cam_d.panorama_type = 'EQUIRECTANGULAR'
except Exception:
    cam_d.cycles.panorama_type = 'EQUIRECTANGULAR'
cam = bpy.data.objects.new('Pano', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam_d.clip_start = 0.1; cam_d.clip_end = 120000
cam.rotation_euler = (math.radians(90), 0, math.radians(-90))  # image centre looks toward +X
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']
env = w.node_tree.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(os.path.join(D, 'hdri', 'kloofendal_48d_partly_cloudy_puresky.hdr'))
sky = w.node_tree.nodes.new('ShaderNodeTexGradient'); sky.gradient_type = 'LINEAR'
sd = bpy.data.lights.new('Sun', 'SUN'); sd.angle = math.radians(1.2); sd.color = (1.0, 0.94, 0.86)
sun = bpy.data.objects.new('Sun', sd); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(38), 0, math.radians(-25))
moon = bpy.data.lights.new('Moon', 'SUN'); moon.color = (0.6, 0.7, 1.0); moon.angle = math.radians(0.5)
mo = bpy.data.objects.new('Moon', moon); sc.collection.objects.link(mo); mo.rotation_euler = (math.radians(55), 0, math.radians(140))

def set_mode(night):
    if night:
        nt = w.node_tree
        for l in list(bg.inputs['Color'].links): nt.links.remove(l)
        nsky = nt.nodes.get('nsky') or nt.nodes.new('ShaderNodeTexSky')
        nsky.name = 'nsky'
        try:
            nsky.sun_elevation = math.radians(-4.5); nsky.sun_rotation = math.radians(250)
        except Exception as e: print('sky', e)
        nt.links.new(nsky.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.35
        sd.energy = 0.0; moon.energy = 0.06; sc.view_settings.exposure = 0.0
    else:
        w.node_tree.links.new(env.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 1.0
        sd.energy = 3.0; moon.energy = 0.0; sc.view_settings.exposure = -0.35
    hz = HAZE['night' if night else 'day']
    for m in mats:
        nt = m.node_tree
        nt.nodes['haze'].inputs['Color'].default_value = (*hz, 1)
        nt.nodes['haze'].inputs['Strength'].default_value = 1.0
        if 'em' in m:
            nt.nodes[m['em']].inputs[1].default_value = 5.0 if night else 0.0
        if 'emit_night' in m:
            b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
            b.inputs['Emission Strength'].default_value = m['emit_night'] if night else 0.0

for mode in ('day', 'night'):
    set_mode(mode == 'night')
    for H in HEIGHTS:
        own = bpy.data.objects.get('OwnTower')
        if own: bpy.data.objects.remove(own)
        bmt = bmesh.new(); vs = [bmt.verts.new(p) for p in ((-18, -2.3, 0), (13.3, -2.3, 0), (13.3, 26, 0), (-18, 26, 0), (-18, -2.3, H - 0.35), (13.3, -2.3, H - 0.35), (13.3, 26, H - 0.35), (-18, 26, H - 0.35))]
        for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)): bmt.faces.new([vs[i] for i in f])
        me = bpy.data.meshes.new('OwnTower'); bmt.to_mesh(me); bmt.free(); me.materials.append(roof)
        own = bpy.data.objects.new('OwnTower', me); sc.collection.objects.link(own)
        cam.location = (6.0, 1.0, H + 1.5)
        sc.render.filepath = os.path.join(OUT, f'view-{int(H)}m-{mode}.jpg')
        bpy.ops.render.render(write_still=True)
        print('PANO', mode, H)
