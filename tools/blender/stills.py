"""High quality CG stills of the LUCE model room for the website."""
import bpy, os, math, sys
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
D = os.path.dirname(__file__)
OUT = argv[0] if argv else os.path.join(D, 'stills')
SAMPLES = int(argv[1]) if len(argv) > 1 else 256
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'; prefs.get_devices()
for d in prefs.devices: d.use = True
sc.cycles.device = 'GPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast' if 'AgX - Medium High Contrast' in [i.identifier for i in sc.view_settings.bl_rna.properties['look'].enum_items_static] else 'None'
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 88
for o in bpy.data.objects:
    if o.name.startswith('NAV_') or o.name.startswith('ASSETSRC_'): o.hide_render = True
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; nt = w.node_tree
bg = nt.nodes['Background']; out = nt.nodes['World Output']
sky = nt.nodes.new('ShaderNodeTexEnvironment'); sky.image = bpy.data.images.load(os.path.join(D, 'hdri', 'kloofendal_48d_partly_cloudy_puresky.hdr'))
city = nt.nodes.new('ShaderNodeTexEnvironment')
bgc = nt.nodes.new('ShaderNodeBackground')
lp = nt.nodes.new('ShaderNodeLightPath')
mix = nt.nodes.new('ShaderNodeMixShader')
nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
nt.links.new(city.outputs['Color'], bgc.inputs['Color'])
nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs[0])
nt.links.new(bg.outputs[0], mix.inputs[1]); nt.links.new(bgc.outputs[0], mix.inputs[2])
nt.links.new(mix.outputs[0], out.inputs['Surface'])
sd = bpy.data.lights.new('Sun', 'SUN'); sd.angle = math.radians(1.2); sd.color = (1.0, 0.94, 0.86)
sun = bpy.data.objects.new('Sun', sd); sc.collection.objects.link(sun); sun.rotation_euler = (math.radians(58), 0, math.radians(-30))
cam_d = bpy.data.cameras.new('C'); cam = bpy.data.objects.new('C', cam_d); sc.collection.objects.link(cam); sc.camera = cam
def look(pos, tgt, lens):
    cam.location = pos; cam_d.lens = lens
    cam.rotation_euler = (Vector(tgt) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
def mode(night):
    city.image = bpy.data.images.load(os.path.join(D, 'out', 'city', f'view-34m-{"night" if night else "day"}.jpg'), check_existing=True)
    bgc.inputs['Strength'].default_value = 1.0 if not night else 1.2
    bg.inputs['Strength'].default_value = 0.9 if not night else 0.02
    sd.energy = 0.0 if night else 3.5
    for o in bpy.data.objects:
        if o.type == 'LIGHT' and o.get('night'): o.hide_render = not night
    for m in bpy.data.materials:
        if m.get('emissive'):
            b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            b.inputs['Emission Strength'].default_value = 8.0 if night else 0.0
    sc.view_settings.exposure = 0.9 if not night else 0.15
shots = {
    'ldk': (False, (10.7, 3.7, 1.3), (4.6, 1.4, 1.0), 16),
    'master': (False, (3.75, 2.55, 1.35), (0.4, 0.9, 0.85), 17),
    'night': (True, (4.4, 3.9, 1.35), (10.5, -0.5, 1.0), 18),
    'balcony': (False, (4.6, 0.6, 1.4), (9.0, -3.0, 1.3), 16),
}
# stills: glass mostly transparent so the view reads clearly
for m in bpy.data.materials:
    if m.get('glass'):
        nt2 = m.node_tree; o2 = next(n for n in nt2.nodes if n.type == 'OUTPUT_MATERIAL')
        tr = nt2.nodes.new('ShaderNodeBsdfTransparent'); gl = nt2.nodes.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = 0.02
        mx = nt2.nodes.new('ShaderNodeMixShader'); mx.inputs[0].default_value = 0.06
        nt2.links.new(tr.outputs[0], mx.inputs[1]); nt2.links.new(gl.outputs[0], mx.inputs[2]); nt2.links.new(mx.outputs[0], o2.inputs['Surface'])
for k in (argv[2:] or list(shots)):
    night, pos, tgt, lens = shots[k]
    mode(night); look(pos, tgt, lens)
    sc.render.filepath = os.path.join(OUT, f'{k}.jpg')
    bpy.ops.render.render(write_still=True)
    print('STILL', k)
