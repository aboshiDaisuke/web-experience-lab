"""Tiny architecture kit for headless Blender: walls with openings, slabs,
windows, furniture primitives, world-space box UVs and PBR materials.
Z-up, metres. Every object is parented to a group empty (F1, F2, SITE ...)."""
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

TEX = os.path.join(os.path.dirname(__file__), 'tex')
GROUPS = {}
MATS = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    GROUPS.clear()
    MATS.clear()


def group(name):
    if name not in GROUPS:
        e = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(e)
        GROUPS[name] = e
    return GROUPS[name]


def empty(name, loc, parent):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    e.empty_display_size = 0.3
    bpy.context.scene.collection.objects.link(e)
    e.parent = group(parent)
    return e


# ---------------------------------------------------------------- materials
def _img(path, non_color=False):
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    return img


def mat(name, color=(0.8, 0.8, 0.8), rough=0.6, tex=None, tile=2.0, metal=0.0,
        emission=None, strength=1.0, glass=False, normal=0.6, tint=None, paint=False):
    """tex: poly haven id in TEX/<id>/{diff,rough,nor}.jpg. tile: metres per texture repeat.
    tint multiplies the diffuse texture."""
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    m['tile'] = tile
    if tex:
        d = os.path.join(TEX, tex)
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = _img(os.path.join(d, 'diff.jpg'))
        if paint:
            nt.nodes.remove(n)
        elif tint:
            mix = nt.nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'
            mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1.0
            mix.inputs[7].default_value = (*tint, 1)
            nt.links.new(n.outputs['Color'], mix.inputs[6])
            nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
        else:
            nt.links.new(n.outputs['Color'], bsdf.inputs['Base Color'])
        rp = os.path.join(d, 'rough.jpg')
        if os.path.exists(rp) and not paint:
            r = nt.nodes.new('ShaderNodeTexImage')
            r.image = _img(rp, True)
            nt.links.new(r.outputs['Color'], bsdf.inputs['Roughness'])
        np_ = os.path.join(d, 'nor.jpg')
        if os.path.exists(np_) and normal:
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = _img(np_, True)
            nm = nt.nodes.new('ShaderNodeNormalMap')
            nm.inputs['Strength'].default_value = normal
            nt.links.new(t.outputs['Color'], nm.inputs['Color'])
            nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = strength
        m['emissive'] = 1
    if glass:
        bsdf.inputs['Transmission Weight'].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.02
        bsdf.inputs['Alpha'].default_value = 0.25
        m['glass'] = 1
        m.surface_render_method = 'BLENDED' if hasattr(m, 'surface_render_method') else None
    MATS[name] = m
    return m


# ---------------------------------------------------------------- mesh helpers
def _finish(obj, material, parent, uv=True):
    if material is not None:
        obj.data.materials.append(material)
    obj.parent = group(parent)
    if uv:
        box_uv(obj)
    return obj


def box_uv(obj):
    """World-space box projection so textures keep real-world scale."""
    me = obj.data
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    uvl = me.uv_layers[0].data
    mw = obj.matrix_world
    tile = 2.0
    if me.materials and me.materials[0] is not None:
        tile = me.materials[0].get('tile', 2.0)
    for poly in me.polygons:
        n = (mw.to_3x3() @ poly.normal)
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = mw @ me.vertices[me.loops[li].vertex_index].co
            if ax == 2:
                u, v = co.x, co.y
            elif ax == 1:
                u, v = co.x, co.z
            else:
                u, v = co.y, co.z
            uvl[li].uv = (u / tile, v / tile)


def box(name, mn, mx, material, parent, bevel=0.0, rot=0.0, pivot=None):
    """Axis aligned box from min to max corner (optionally rotated about Z around pivot)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    size = Vector(mx) - Vector(mn)
    center = (Vector(mx) + Vector(mn)) / 2
    for v in bm.verts:
        v.co = Vector((v.co.x * size.x, v.co.y * size.y, v.co.z * size.z)) + center
    if rot:
        p = Vector(pivot) if pivot else center
        R = Matrix.Translation(p) @ Matrix.Rotation(rot, 4, 'Z') @ Matrix.Translation(-p)
        bmesh.ops.transform(bm, matrix=R, verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    if bevel:
        b = obj.modifiers.new('bevel', 'BEVEL')
        b.width = bevel
        b.segments = 2
        b.limit_method = 'ANGLE'
    return _finish(obj, material, parent)


def cyl(name, center, radius, height, material, parent, verts=32, axis='Z'):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=radius, radius2=radius, depth=height)
    if axis == 'X':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    elif axis == 'Y':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(center))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return _finish(obj, material, parent)


def sphere(name, center, radius, material, parent, scale=(1, 1, 1), sub=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=radius)
    for v in bm.verts:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) + Vector(center)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return _finish(obj, material, parent)


def plane(name, mn, mx, z, material, parent, flip=False):
    """Horizontal quad (for floors/ceilings/nav). flip=True faces down."""
    bm = bmesh.new()
    vs = [bm.verts.new((mn[0], mn[1], z)), bm.verts.new((mx[0], mn[1], z)),
          bm.verts.new((mx[0], mx[1], z)), bm.verts.new((mn[0], mx[1], z))]
    f = bm.faces.new(vs if not flip else list(reversed(vs)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return _finish(obj, material, parent)


def poly_floor(name, pts, z, material, parent, flip=False):
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z)) for x, y in pts]
    bm.faces.new(vs if not flip else list(reversed(vs)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return _finish(obj, material, parent)


# ---------------------------------------------------------------- walls
def wall(name, a, b, z0, z1, t, material, parent, openings=(), inner=None):
    """Straight wall from a to b (2D points on the wall centre line).
    openings: list of (offset_from_a, width, sill_z, head_z) in absolute z.
    inner: optional second material for the +normal side (not used; kept simple)."""
    ax, ay = a
    bx, by = b
    L = math.hypot(bx - ax, by - ay)
    ang = math.atan2(by - ay, bx - ax)
    pieces = []
    ops = sorted(openings, key=lambda o: o[0])
    cur = 0.0
    for off, w, sill, head in ops:
        if off > cur:
            pieces.append((cur, off, z0, z1))
        if sill > z0:
            pieces.append((off, off + w, z0, sill))
        if head < z1:
            pieces.append((off, off + w, head, z1))
        cur = off + w
    if cur < L:
        pieces.append((cur, L, z0, z1))
    objs = []
    for i, (s, e, zb, zt) in enumerate(pieces):
        mn = (ax + s, ay - t / 2, zb)
        mx = (ax + e, ay + t / 2, zt)
        o = box(f'{name}_{i}', mn, mx, None, parent, rot=ang, pivot=(ax, ay, 0))
        o.data.materials.append(material)
        box_uv(o)
        objs.append(o)
    return objs


def window(name, a, b, off, w, sill, head, parent, frame_mat, glass_mat, mullions=0, depth=0.06):
    """Frame + glass inside an opening of wall a→b."""
    ax, ay = a
    bx, by = b
    ang = math.atan2(by - ay, bx - ax)
    ft = 0.05
    parts = [
        (off, off + w, sill, sill + ft),
        (off, off + w, head - ft, head),
        (off, off + ft, sill, head),
        (off + w - ft, off + w, sill, head),
    ]
    for k in range(1, mullions + 1):
        x = off + w * k / (mullions + 1)
        parts.append((x - ft / 2, x + ft / 2, sill, head))
    for i, (s, e, zb, zt) in enumerate(parts):
        box(f'{name}_frame{i}', (ax + s, ay - depth / 2, zb), (ax + e, ay + depth / 2, zt),
            frame_mat, parent, rot=ang, pivot=(ax, ay, 0))
    g = box(f'{name}_glass', (ax + off + ft, ay - 0.008, sill + ft), (ax + off + w - ft, ay + 0.008, head - ft),
            glass_mat, parent, rot=ang, pivot=(ax, ay, 0))
    g['nobake'] = 1
    return g


def stairs(name, x0, x1, y0, y1, z0, z1, n, tread_mat, stringer_mat, parent, axis='X'):
    """Straight flight rising along +X (or +Y) from x0 to x1."""
    rise = (z1 - z0) / n
    if axis == 'X':
        run = (x1 - x0) / n
        for i in range(n):
            zt = z0 + rise * (i + 1)
            box(f'{name}_t{i}', (x0 + run * i, y0, zt - 0.04), (x0 + run * (i + 1) + 0.03, y1, zt), tread_mat, parent, bevel=0.006)
        L = math.hypot(x1 - x0, z1 - z0)
        for side, yy in (('a', y0), ('b', y1 - 0.02)):
            o = box(f'{name}_str{side}', (x0, yy, z0 - 0.12), (x0 + L, yy + 0.02, z0 + 0.12), stringer_mat, parent)
            o.rotation_euler = (0, -math.atan2(z1 - z0, x1 - x0), 0)
            o.location = (0, 0, 0)
            # rotate about start
            me = o.data
            R = Matrix.Translation((x0, 0, z0)) @ Matrix.Rotation(-math.atan2(z1 - z0, x1 - x0), 4, 'Y') @ Matrix.Translation((-x0, 0, -z0))
            me.transform(R)
            o.rotation_euler = (0, 0, 0)
            box_uv(o)


# ---------------------------------------------------------------- furniture
def sofa(name, x, y, w, d, parent, fabric, rot=0.0, leg=None):
    h = 0.42
    p = (x + w / 2, y + d / 2, 0)
    box(f'{name}_seat', (x + 0.1, y + 0.1, h - 0.2 + BASE[0]), (x + w - 0.1, y + d - 0.05, h + BASE[0]), fabric, parent, bevel=0.05, rot=rot, pivot=p)
    box(f'{name}_base', (x + 0.08, y + 0.08, 0.1 + BASE[0]), (x + w - 0.08, y + d - 0.02, h - 0.2 + BASE[0]), fabric, parent, bevel=0.02, rot=rot, pivot=p)
    box(f'{name}_back', (x, y + d - 0.22, 0.1 + BASE[0]), (x + w, y + d, 0.82 + BASE[0]), fabric, parent, bevel=0.06, rot=rot, pivot=p)
    box(f'{name}_armL', (x, y, 0.1 + BASE[0]), (x + 0.18, y + d, 0.62 + BASE[0]), fabric, parent, bevel=0.05, rot=rot, pivot=p)
    box(f'{name}_armR', (x + w - 0.18, y, 0.1 + BASE[0]), (x + w, y + d, 0.62 + BASE[0]), fabric, parent, bevel=0.05, rot=rot, pivot=p)
    for i in range(int(w // 0.9)):
        cx = x + 0.2 + i * 0.85
        box(f'{name}_cush{i}', (cx, y + d - 0.42, h + BASE[0]), (cx + 0.7, y + d - 0.2, h + 0.4 + BASE[0]), fabric, parent, bevel=0.08, rot=rot, pivot=p)
    if leg:
        for i, (lx, ly) in enumerate(((x + 0.12, y + 0.12), (x + w - 0.16, y + 0.12), (x + 0.12, y + d - 0.12), (x + w - 0.16, y + d - 0.12))):
            box(f'{name}_leg{i}', (lx, ly, BASE[0]), (lx + 0.04, ly + 0.04, 0.1 + BASE[0]), leg, parent, rot=rot, pivot=p)


def table(name, x, y, w, d, h, top, legm, parent, thick=0.04, rot=0.0, inset=0.06, leg=0.05):
    p = (x + w / 2, y + d / 2, 0)
    z = BASE[0]
    box(f'{name}_top', (x, y, z + h - thick), (x + w, y + d, z + h), top, parent, bevel=0.008, rot=rot, pivot=p)
    for i, (lx, ly) in enumerate(((x + inset, y + inset), (x + w - inset - leg, y + inset), (x + inset, y + d - inset - leg), (x + w - inset - leg, y + d - inset - leg))):
        box(f'{name}_leg{i}', (lx, ly, z), (lx + leg, ly + leg, z + h - thick), legm, parent, rot=rot, pivot=p)


def chair(name, x, y, parent, seat, frame, rot=0.0):
    p = (x + 0.22, y + 0.22, 0)
    z = BASE[0]
    box(f'{name}_seat', (x, y, z + 0.43), (x + 0.44, y + 0.44, z + 0.47), seat, parent, bevel=0.01, rot=rot, pivot=p)
    box(f'{name}_back', (x, y + 0.4, z + 0.47), (x + 0.44, y + 0.44, z + 0.82), seat, parent, bevel=0.01, rot=rot, pivot=p)
    for i, (lx, ly) in enumerate(((x + 0.02, y + 0.02), (x + 0.39, y + 0.02), (x + 0.02, y + 0.39), (x + 0.39, y + 0.39))):
        box(f'{name}_leg{i}', (lx, ly, z), (lx + 0.03, ly + 0.03, z + 0.43), frame, parent, rot=rot, pivot=p)


def bed(name, x, y, w, l, parent, frame, linen, duvet, rot=0.0):
    p = (x + w / 2, y + l / 2, 0)
    z = BASE[0]
    box(f'{name}_frame', (x, y, z + 0.08), (x + w, y + l, z + 0.3), frame, parent, bevel=0.01, rot=rot, pivot=p)
    box(f'{name}_head', (x - 0.02, y + l - 0.08, z + 0.08), (x + w + 0.02, y + l, z + 1.0), frame, parent, bevel=0.01, rot=rot, pivot=p)
    box(f'{name}_mattress', (x + 0.03, y + 0.03, z + 0.3), (x + w - 0.03, y + l - 0.1, z + 0.52), linen, parent, bevel=0.04, rot=rot, pivot=p)
    box(f'{name}_duvet', (x + 0.0, y + 0.0, z + 0.5), (x + w, y + l * 0.68, z + 0.6), duvet, parent, bevel=0.05, rot=rot, pivot=p)
    n = 2 if w > 1.3 else 1
    for i in range(n):
        px = x + 0.12 + i * (w - 0.24) / n
        box(f'{name}_pillow{i}', (px, y + l - 0.62, z + 0.52), (px + (w - 0.24) / n - 0.08, y + l - 0.2, z + 0.68), linen, parent, bevel=0.06, rot=rot, pivot=p)


def plant(name, x, y, parent, pot, leaf, size=1.0):
    z = BASE[0]
    cyl(f'{name}_pot', (x, y, z + 0.2 * size), 0.18 * size, 0.4 * size, pot, parent, verts=20)
    for i, (dx, dy, dz, r) in enumerate(((0, 0, 0.75, 0.32), (0.12, -0.06, 1.0, 0.24), (-0.1, 0.08, 0.95, 0.22), (0.02, 0.05, 1.2, 0.18))):
        sphere(f'{name}_leaf{i}', (x + dx * size, y + dy * size, z + dz * size), r * size, leaf, parent, sub=1)


def tree(name, x, y, parent, bark, leaf, h=5.0):
    cyl(f'{name}_trunk', (x, y, h * 0.3), 0.12, h * 0.6, bark, parent, verts=10)
    for i, (dx, dy, dz, r) in enumerate(((0, 0, 0.7, 1.4), (0.8, 0.3, 0.6, 1.0), (-0.6, -0.4, 0.62, 1.1), (0.2, -0.7, 0.8, 0.9), (-0.3, 0.6, 0.85, 0.9))):
        sphere(f'{name}_crown{i}', (x + dx, y + dy, h * dz), r, leaf, parent, sub=2, scale=(1, 1, 0.85))


BASE = [0.0]


def at_floor(z):
    """Set the floor height used by furniture helpers."""
    BASE[0] = z


IMP = os.path.join(os.path.dirname(__file__), 'impostors')


def tree_card(name, x, y, sprite, height, parent, rot=0.0):
    """Two crossed alpha cards using a pre-rendered impostor."""
    side, cx, cy, cz, mnz = map(float, open(os.path.join(IMP, sprite + '.txt')).read().split())
    s = height / (side * 0.98)
    w = side * s
    for k, a, img in (('a', rot, 'a'), ('b', rot + math.pi / 3, 'b'), ('c', rot + 2 * math.pi / 3, 'a')):
        key = f'Card_{sprite}_{img}'
        if key not in MATS:
            m = bpy.data.materials.new(key)
            m.use_nodes = True
            nt = m.node_tree
            b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = _img(os.path.join(IMP, f'{sprite}_{img}.png'))
            nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
            nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
            b.inputs['Roughness'].default_value = 0.8
            m['alpha'] = 1
            MATS[key] = m
        bm = bmesh.new()
        z0 = 0.0
        vs = [bm.verts.new((-w / 2, 0, z0)), bm.verts.new((w / 2, 0, z0)), bm.verts.new((w / 2, 0, z0 + w)), bm.verts.new((-w / 2, 0, z0 + w))]
        bm.faces.new(vs)
        uv = bm.loops.layers.uv.new('UVMap')
        for f in bm.faces:
            for l, c in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                l[uv].uv = c
        R = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(a, 4, 'Z')
        bmesh.ops.transform(bm, matrix=R, verts=bm.verts)
        me = bpy.data.meshes.new(f'{name}_{k}')
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(f'{name}_{k}', me)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(MATS[key])
        o.parent = group(parent)
        o['nobake'] = 1


def import_asset(name, path, loc, parent, scale=1.0, rot=0.0, decimate=0.0):
    """Import a glTF prop once and link-duplicate it."""
    key = 'ASSET_' + path
    if key not in GROUPS:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
        for o in new:
            bpy.context.view_layer.objects.active = o
        if len(new) > 1:
            bpy.ops.object.select_all(action='DESELECT')
            for o in new: o.select_set(True)
            bpy.context.view_layer.objects.active = new[0]
            bpy.ops.object.join()
        src = new[0]
        for o in bpy.data.objects:
            if o not in before and o.type != 'MESH':
                bpy.data.objects.remove(o)
        src.parent = None
        bpy.context.view_layer.objects.active = src
        src.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        if decimate:
            d = src.modifiers.new('dec', 'DECIMATE'); d.ratio = decimate
            bpy.ops.object.modifier_apply(modifier='dec')
        src.name = 'ASSETSRC_' + name
        src.hide_render = True
        GROUPS[key] = src
    src = GROUPS[key]
    o = bpy.data.objects.new(name, src.data)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (0, 0, rot)
    o.scale = (scale,) * 3
    o.parent = group(parent)
    o['nobake'] = 1
    return o
