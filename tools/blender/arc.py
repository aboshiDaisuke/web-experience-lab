"""MIRAI ARC — a fictional electric coupe-SUV, built procedurally.

usage:
  blender -b --factory-startup -P arc.py -- <outdir> [--preview] [--nointerior]

Coordinates (Blender): +X forward, +Y left, +Z up, ground at z = 0.
Right-hand drive: the driver sits on the right (-Y) side.

The body is a parametric control cage (stations along X x profile rows around
the half section) that is mirrored and Catmull-Clark subdivided, so reflections
run in long unbroken lines. Feature lines are edge creases. Doors and the charge
flap are cut out of the finished surface with exact booleans (rounded outlines
plus a panel gap), then everything gets thickness (solidify) and a small bevel.
The greenhouse is a second cage laid on the belt line: windscreen, glass roof and
fastback read as one dark canopy, with gloss-black rails and B-pillars.

Exports one Draco-compressed GLB (car.glb) with named, separately movable parts
(doors hinge about their origin, the flap too), plus one wheel of each design
and a tyre that the web viewer instances four times, and a baked contact shadow.
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = next((a for a in argv if not a.startswith('--')), os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'arc'))
PREVIEW = '--preview' in argv
NO_INTERIOR = '--nointerior' in argv
os.makedirs(OUT, exist_ok=True)

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
for m in list(bpy.data.meshes):
    bpy.data.meshes.remove(m)
sc = bpy.context.scene

# ----------------------------------------------------------------------------- dimensions
AXLE_F, AXLE_R = 1.46, -1.46
TIRE_R = 0.378           # tyre radius (21")
WHEEL_Z = TIRE_R
TRACK_Y = 0.832          # wheel centre, half track
ARCH_R = 0.398
X_WS = 1.0              # windscreen base (front of the cabin opening)
X_RG = -2.06             # rear glass base (back of the cabin opening)
X_B0, X_B1 = -0.36, -0.30  # B-pillar strip on the canopy
X_C = -1.12              # rear door glass ends, C-pillar sail begins
X_DF = 0.86              # front door glass leading edge (ahead of it: fixed sail)

# ----------------------------------------------------------------------------- helpers
def pchip(keys):
    """Monotone cubic through (x, v) keys; flat beyond the ends."""
    ks = sorted(keys)
    xs = [k[0] for k in ks]
    vs = [k[1] for k in ks]
    n = len(xs)
    if n == 1:
        return lambda x: vs[0]
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(vs[i + 1] - vs[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0.0
        else:
            w1 = 2 * h[i] + h[i - 1]
            w2 = h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        if x <= xs[0]:
            return vs[0]
        if x >= xs[-1]:
            return vs[-1]
        lo, hi = 0, n - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if xs[mid] <= x:
                lo = mid
            else:
                hi = mid
        t = (x - xs[lo]) / h[lo]
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * vs[lo] + (t3 - 2 * t2 + t) * h[lo] * m[lo]
                + (-2 * t3 + 3 * t2) * vs[hi] + (t3 - t2) * h[lo] * m[hi])
    return f


def sstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


MATS = {}


def mat(name, col=(0.5, 0.5, 0.5), rough=0.5, metal=0.0, emit=None, alpha=1.0, coat=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.03
    if emit:
        b.inputs['Emission Color'].default_value = (*emit[0], 1)
        b.inputs['Emission Strength'].default_value = emit[1]
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            pass
    m.diffuse_color = (*col, alpha)
    MATS[name] = m
    return m


def setup_materials():
    mat('Paint', (0.46, 0.36, 0.25), 0.32, 0.6, coat=1.0)
    mat('Inner', (0.05, 0.05, 0.055), 0.6)
    mat('Under', (0.025, 0.025, 0.028), 0.8)
    mat('TrimGloss', (0.012, 0.012, 0.014), 0.12)
    mat('TrimSatin', (0.03, 0.03, 0.033), 0.55)
    mat('Chrome', (0.8, 0.8, 0.82), 0.12, 1.0)
    mat('GlassWS', (0.05, 0.06, 0.07), 0.02, alpha=0.28)
    mat('GlassSide', (0.02, 0.025, 0.03), 0.02, alpha=0.55)
    mat('GlassRoof', (0.01, 0.012, 0.015), 0.02, alpha=0.72)
    mat('LampHead', (0.9, 0.92, 0.95), 0.2, emit=((0.9, 0.95, 1.0), 6.0))
    mat('LampTail', (0.5, 0.02, 0.02), 0.2, emit=((1.0, 0.03, 0.02), 5.0))
    mat('LensDark', (0.01, 0.012, 0.015), 0.05)
    mat('Liner', (0.02, 0.02, 0.022), 0.85)
    mat('Tire', (0.03, 0.03, 0.032), 0.75)
    mat('RimMain', (0.7, 0.71, 0.72), 0.25, 1.0)
    mat('RimAccent', (0.02, 0.02, 0.022), 0.3, 0.3)
    mat('Brake', (0.35, 0.35, 0.36), 0.4, 1.0)
    mat('Caliper', (0.55, 0.42, 0.25), 0.3, 0.6)
    mat('Seat', (0.06, 0.06, 0.065), 0.55)
    mat('Wheel', (0.03, 0.03, 0.032), 0.5)
    mat('SeatAccent', (0.2, 0.2, 0.21), 0.6)
    mat('Dash', (0.05, 0.05, 0.055), 0.65)
    mat('DashTrim', (0.35, 0.3, 0.25), 0.35, 0.8)
    mat('Carpet', (0.03, 0.03, 0.032), 0.95)
    mat('Headliner', (0.2, 0.2, 0.21), 0.9)
    mat('WindowTrim', (0.75, 0.76, 0.78), 0.28, 1.0)
    mat('Ambient', (0.9, 0.7, 0.4), 0.4, emit=((1.0, 0.7, 0.35), 4.0))
    mat('ScreenMeter', (0.02, 0.02, 0.025), 0.2)
    mat('ScreenCenter', (0.02, 0.02, 0.025), 0.2)
    mat('Socket', (0.015, 0.015, 0.018), 0.4)
    mat('ChargeRing', (0.2, 0.8, 1.0), 0.3, emit=((0.2, 0.8, 1.0), 3.0))


def new_obj(name, bm_or_mesh, mats=(), parent=None):
    if isinstance(bm_or_mesh, bmesh.types.BMesh):
        me = bpy.data.meshes.new(name)
        bm_or_mesh.to_mesh(me)
        bm_or_mesh.free()
    else:
        me = bm_or_mesh
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    for m in mats:
        ob.data.materials.append(MATS[m] if isinstance(m, str) else m)
    if parent:
        ob.parent = parent
    return ob


def select_only(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply_mods(ob):
    select_only(ob)
    for md in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)


def shade_smooth(ob, angle=None):
    for p in ob.data.polygons:
        p.use_smooth = True
    if angle is not None:
        select_only(ob)
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
        except Exception:
            bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))


def grid_mesh(P, face_mat=None, crease=None, close_u=False):
    """P[s][r] -> Vector grid; faces between consecutive stations s and rows r."""
    bm = bmesh.new()
    S, R = len(P), len(P[0])
    V = [[bm.verts.new(P[s][r]) for r in range(R)] for s in range(S)]
    bm.verts.ensure_lookup_table()
    cl = bm.edges.layers.float.get('crease_edge') or bm.edges.layers.float.new('crease_edge')
    rr = R if close_u else R - 1
    for s in range(S - 1):
        for r in range(rr):
            r2 = (r + 1) % R
            mi = face_mat(s, r) if face_mat else 0
            if mi is None:
                continue
            f = bm.faces.new((V[s][r], V[s][r2], V[s + 1][r2], V[s + 1][r]))  # outward on +Y
            f.material_index = mi
    if crease:
        for e in bm.edges:
            pass
        for (s, r, val) in crease:
            e = bm.edges.get((V[s][r], V[s + 1][r]))
            if e:
                e[cl] = val
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    return bm


# ----------------------------------------------------------------------------- body cage
# Profile rows around the half section, bottom centre -> top centre.
# Each row: half-width keys, height keys, front/rear tip x, plan-corner exponent.
F0, R0 = 1.92, -1.94     # plan corners start here
ROWS = [
    # 0 bottom centre
    dict(y=[(0, 0.0)], z=[(-2.4, 0.3), (-1.9, 0.235), (1.9, 0.235), (2.4, 0.27)], xf=1.98, xr=-2.02, nf=2.2, nr=2.4),
    # 1 floor edge
    dict(y=[(-2.4, 0.55), (-1.9, 0.62), (1.9, 0.62), (2.4, 0.55)], z=[(-2.4, 0.31), (-1.9, 0.228), (1.9, 0.228), (2.4, 0.262)], xf=2.04, xr=-2.08, nf=2.4, nr=2.6),
    # 2 rocker bottom corner
    dict(y=[(-2.4, 0.8), (-1.46, 0.9), (-0.5, 0.875), (1.46, 0.895), (2.4, 0.82)],
         z=[(-2.4, 0.35), (-1.9, 0.28), (-1.2, 0.255), (1.2, 0.255), (1.9, 0.262), (2.4, 0.28)],
         xf=2.1, xr=-2.15, nf=2.4, nr=2.6),
    # 3 rocker top (sill blade)
    dict(y=[(-2.4, 0.84), (-1.46, 0.945), (-0.5, 0.925), (1.46, 0.94), (2.4, 0.85)],
         z=[(-2.4, 0.44), (-1.9, 0.38), (-1.2, 0.35), (1.2, 0.35), (1.9, 0.36), (2.4, 0.36)],
         xf=2.18, xr=-2.23, nf=2.4, nr=2.6),
    # 4 lower door (slightly concave between the wheels)
    dict(y=[(-2.4, 0.86), (-1.55, 0.968), (-1.05, 0.938), (-0.3, 0.93), (0.8, 0.936), (1.46, 0.962), (2.4, 0.87)],
         z=[(-2.4, 0.58), (-1.9, 0.54), (0, 0.52), (1.9, 0.48), (2.35, 0.44)],
         xf=2.24, xr=-2.29, nf=2.6, nr=2.4),
    # 5 widest line
    dict(y=[(-2.4, 0.87), (-1.6, 0.988), (-1.0, 0.962), (0, 0.953), (0.9, 0.958), (1.46, 0.974), (2.4, 0.87)],
         z=[(-2.4, 0.74), (-1.9, 0.72), (0, 0.69), (1.46, 0.635), (2.0, 0.585), (2.35, 0.53)],
         xf=2.29, xr=-2.33, nf=2.7, nr=2.3),
    # 6 shoulder crease
    dict(y=[(-2.4, 0.84), (-1.6, 0.972), (-1.0, 0.945), (0, 0.935), (0.9, 0.942), (1.46, 0.962), (2.4, 0.85)],
         z=[(-2.4, 0.89), (-1.9, 0.9), (-1.46, 0.9), (0, 0.868), (0.9, 0.835), (1.46, 0.8), (2.0, 0.712), (2.35, 0.625)],
         xf=2.32, xr=-2.355, nf=2.7, nr=2.2),
    # 7 belt / fender top / deck edge
    dict(y=[(-2.4, 0.66), (-2.0, 0.78), (-1.6, 0.845), (-1.1, 0.85), (-0.3, 0.855), (1.0, 0.848), (1.46, 0.84), (2.0, 0.79), (2.4, 0.72)],
         z=[(-2.4, 1.03), (-2.1, 1.025), (-1.6, 1.03), (-0.3, 0.99), (0.5, 0.965), (1.0, 0.935), (1.46, 0.862), (2.0, 0.765), (2.35, 0.695)],
         xf=2.305, xr=-2.37, nf=2.5, nr=2.1),
    # 8 hood / deck mid
    dict(y=[(-2.4, 0.34), (-1.9, 0.42), (1.0, 0.43), (2.0, 0.4), (2.4, 0.36)],
         z=[(-2.4, 1.05), (-2.1, 1.05), (1.0, 0.957), (1.46, 0.882), (2.0, 0.785), (2.35, 0.705)],
         xf=2.28, xr=-2.365, nf=2.4, nr=2.1),
    # 9 hood / deck centre
    dict(y=[(0, 0.0)], z=[(-2.4, 1.056), (-2.1, 1.058), (1.0, 0.965), (1.46, 0.89), (2.0, 0.792), (2.35, 0.71)],
         xf=2.27, xr=-2.36, nf=2.3, nr=2.1),
]
for row in ROWS:
    row['fy'] = pchip(row['y'])
    row['fz'] = pchip(row['z'])
NR = len(ROWS)
KEND = 7  # stations around each plan corner


def mid_stations():
    xs = [R0 + i * (F0 - R0) / 40 for i in range(41)]
    for k in (X_WS, X_RG, X_B0, X_B1, X_C, 0.0, AXLE_F, AXLE_R):
        xs = [x for x in xs if abs(x - k) > 0.035] + [k]
    return sorted(xs)


def cage_points():
    """Station list (rear tip -> front tip) of row positions (half section)."""
    P, tags = [], []
    # rear corner, tip first
    for k in range(KEND, 0, -1):
        ph = k / KEND * math.pi / 2
        pts = []
        for row in ROWS:
            n = row['nr']
            c, s = math.cos(ph), math.sin(ph)
            u = abs(c) ** (2 / n)
            v = abs(s) ** (2 / n)
            x = R0 + (row['xr'] - R0) * v
            pts.append(Vector((x, row['fy'](x) * u, row['fz'](x))))
        P.append(pts)
        tags.append(('rear', k))
    for x in mid_stations():
        P.append([Vector((x, row['fy'](x), row['fz'](x))) for row in ROWS])
        tags.append(('mid', x))
    for k in range(1, KEND + 1):
        ph = k / KEND * math.pi / 2
        pts = []
        for row in ROWS:
            n = row['nf']
            c, s = math.cos(ph), math.sin(ph)
            u = abs(c) ** (2 / n)
            v = abs(s) ** (2 / n)
            x = F0 + (row['xf'] - F0) * v
            pts.append(Vector((x, row['fy'](x) * u, row['fz'](x))))
        P.append(pts)
        tags.append(('front', k))
    return P, tags


BODY_MATS = ['Paint', 'Under', 'TrimGloss', 'TrimSatin']


def build_body_surface():
    P, tags = cage_points()
    S = len(P)

    def xs(s):
        t = tags[s]
        return t[1] if t[0] == 'mid' else (9 if t[0] == 'front' else -9)

    def fm(s, r):
        t0, t1 = tags[s], tags[s + 1]
        a, b = xs(s), xs(s + 1)
        # cabin opening
        if r >= 7 and t0[0] == 'mid' and t1[0] == 'mid' and a >= X_RG - 1e-6 and b <= X_WS + 1e-6:
            return None
        if r <= 1:
            return 1
        if r == 2:
            return 2  # gloss black sill blade
        # lower front intake band / rear diffuser on the fascias
        if r == 3 and (t0[0] == 'front' and t0[1] >= 3):
            return 3
        return 0

    crease = []
    for s in range(S - 1):
        crease.append((s, 6, 0.62))   # shoulder / nose blade
        crease.append((s, 7, 0.25))   # hood edge
        crease.append((s, 3, 0.35))   # sill blade top
    bm = grid_mesh(P, fm, crease)
    ob = new_obj('Body', bm, BODY_MATS)
    md = ob.modifiers.new('mirror', 'MIRROR')
    md.use_axis[0] = False
    md.use_axis[1] = True
    md.use_clip = True
    md.use_mirror_merge = True
    md.merge_threshold = 1e-4
    sd = ob.modifiers.new('subd', 'SUBSURF')
    sd.levels = sd.render_levels = 2
    sd.boundary_smooth = 'PRESERVE_CORNERS'
    apply_mods(ob)
    shade_smooth(ob)
    return ob, P


# ----------------------------------------------------------------------------- canopy
ROOF_C = pchip([(1.02, 0.95), (0.85, 1.03), (0.55, 1.17), (0.25, 1.3), (-0.05, 1.41), (-0.3, 1.485), (-0.6, 1.535),
                (-0.85, 1.535), (-1.1, 1.5), (-1.35, 1.43), (-1.6, 1.325), (-1.82, 1.2), (-1.98, 1.11), (-2.06, 1.065)])
ROOF_W = pchip([(1.0, 0.8), (0.5, 0.74), (0.0, 0.69), (-0.7, 0.665), (-1.35, 0.6), (-1.8, 0.56), (-2.06, 0.6)])


def canopy_section(x):
    r7, r8, r9 = ROWS[7], ROWS[8], ROWS[9]
    wb, zb = r7['fy'](x) - 0.014, r7['fz'](x) - 0.012
    lid = [Vector((x, wb, zb)),
           Vector((x, lerp(wb, r8['fy'](x), 0.35), lerp(zb, r8['fz'](x) - 0.01, 0.35))),
           Vector((x, lerp(wb, r8['fy'](x), 0.62), lerp(zb, r8['fz'](x) - 0.01, 0.62))),
           Vector((x, lerp(wb, r8['fy'](x), 0.8), lerp(zb, r8['fz'](x) - 0.01, 0.8))),
           Vector((x, r8['fy'](x), r8['fz'](x) - 0.012)),
           Vector((x, 0, r9['fz'](x) - 0.012))]
    zc = ROOF_C(x)
    h = zc - zb
    a = sstep(0.0, 0.34, h)
    crown = 0.055 * a
    ze = zc - crown
    wr = ROOF_W(x)
    aw = 0.055 * sstep(0.3, 0.85, x)   # the A-pillar gets broader towards its base
    tall = [Vector((x, wb, zb)),
            Vector((x, lerp(wb, wr, 0.3) + 0.012, zb + 0.45 * (ze - zb))),
            Vector((x, wr + 0.022 + 0.3 * aw, ze - 0.03 - aw)),
            Vector((x, wr - 0.018, ze + 0.012)),
            Vector((x, 0.5 * wr, zc - 0.01)),
            Vector((x, 0, zc))]
    return [lerp(l, t, a) for l, t in zip(lid, tall)]


CANOPY_MATS = ['GlassSide', 'TrimGloss', 'GlassWS', 'GlassRoof', 'Paint', 'GlassDoorR', 'GlassDoorL', 'WindowTrim']
X_HD0, X_HD1 = 0.05, 0.3   # windscreen header (opaque band between screen and roof glass)


def build_canopy():
    mat('GlassDoorR', (0.02, 0.025, 0.03), 0.02, alpha=0.55)
    mat('GlassDoorL', (0.02, 0.025, 0.03), 0.02, alpha=0.55)
    x0, x1 = X_WS + 0.035, X_RG - 0.03
    xs = [x1 + i * (x0 - x1) / 44 for i in range(45)]
    for k in (X_B0, X_B1, X_C, X_DF, X_WS - 0.001, X_HD0, X_HD1, -1.55, -0.6):
        xs = [x for x in xs if abs(x - k) > 0.03] + [k]
    xs = sorted(x for x in xs if x1 <= x <= x0)
    P = [canopy_section(x) for x in xs]

    def fm(s, r):
        a, b = xs[s], xs[s + 1]
        xm = 0.5 * (a + b)
        if r <= 1:  # side glass band
            if X_B0 - 1e-6 <= a and b <= X_B1 + 1e-6:
                return 1
            if xm < X_C:
                return 4
            if xm > X_DF:
                return 1  # fixed sail where the mirror sits
            if xm > X_B1:
                return 5  # front door glass (tagged, split per side later)
            return 0
        if r == 2:
            return 7 if X_C < xm < X_DF else 1  # satin roof-rail trim over the doors, black on the pillars
        if xm > X_HD1:
            return 2  # windscreen
        if xm > X_HD0:
            return 1  # header
        if xm < -1.55:
            return 2  # rear screen (clear)
        return 3      # glass roof

    crease = [(s, 2, 0.4) for s in range(len(xs) - 1)] + [(s, 3, 0.4) for s in range(len(xs) - 1)]
    bm = grid_mesh(P, fm, crease)
    ob = new_obj('Canopy', bm, CANOPY_MATS)
    md = ob.modifiers.new('mirror', 'MIRROR')
    md.use_axis[0] = False
    md.use_axis[1] = True
    md.use_clip = True
    md.use_mirror_merge = True
    sd = ob.modifiers.new('subd', 'SUBSURF')
    sd.levels = 2
    apply_mods(ob)
    shade_smooth(ob)
    # the tagged front-door glass: -Y half goes to the driver's door
    for p in ob.data.polygons:
        if p.material_index == 5 and p.center.y > 0:
            p.material_index = 6
    return ob


def canopy_frame(canopy):
    """Opaque parts of the canopy (pillars, rails, header, sails) get real thickness,
    with headliner on the inside so the cabin reads as a room."""
    names = [m.name for m in canopy.data.materials]
    keep = {names.index(n) for n in ('TrimGloss', 'Paint', 'WindowTrim')}
    fr = canopy.copy()
    fr.data = canopy.data.copy()
    sc.collection.objects.link(fr)
    fr.name = 'CanopyFrame'
    for o, want in ((fr, True), (canopy, False)):
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.material_index in keep) != want], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.to_mesh(o.data)
        bm.free()
    thicken(fr, 0.014, inner='Headliner')
    return fr




# ----------------------------------------------------------------------------- surface-projected details
def body_bvh(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    return BVHTree.FromObject(ob, dg)


def hit(bvh, o, d, maxd=5.0):
    loc, nor, idx, dist = bvh.ray_cast(Vector(o), Vector(d).normalized(), maxd)
    return (loc, nor) if loc is not None else (None, None)


def strip(bm, rows, lift=0.002, depth=0.012, mi=0, cap=True):
    """rows: list of [(p, n), ...] across the strip (>=2 points) sampled along it.
    Builds a thin shell lifted off the surface by `lift`, with side walls going
    `depth` back into the body so no gap shows at grazing angles."""
    top, bot = [], []
    for r in rows:
        top.append([bm.verts.new(p + n * lift) for p, n in r])
        bot.append([bm.verts.new(p - n * depth) for p, n in r])
    N, M = len(rows), len(rows[0])
    fs = []
    for i in range(N - 1):
        for j in range(M - 1):
            fs.append(bm.faces.new((top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1])))
        for j in (0, M - 1):
            fs.append(bm.faces.new((top[i][j], bot[i][j], bot[i + 1][j], top[i + 1][j])))
    if cap:
        for i in (0, N - 1):
            for j in range(M - 1):
                fs.append(bm.faces.new((top[i][j], top[i][j + 1], bot[i][j + 1], bot[i][j])))
    for f in fs:
        f.material_index = mi
    return fs


def radial_rows(bvh, O, phis, zs_of, outward=True):
    """Cast from an inside origin O (x, z plane centre) outward in plan at angle phi."""
    rows = []
    for ph in phis:
        d = Vector((math.cos(ph), math.sin(ph), 0))
        r = []
        for z in zs_of(ph):
            p, n = hit(bvh, (O[0], O[1], z), d)
            if p is None:
                return None
            r.append((p, n))
        rows.append(r)
    return rows


def lights(bvh):
    # FRONT: the "arc" — one hairline of light across the nose, rising into the fenders
    bm = bmesh.new()
    fm = 0.95
    phis = [(-1 + 2 * i / 120) * fm for i in range(121)]
    zc = lambda ph: 0.664 + 0.058 * (ph / fm) ** 2
    rows = radial_rows(bvh, (1.5, 0), phis, lambda ph: [zc(ph) - 0.008, zc(ph), zc(ph) + 0.008])
    strip(bm, rows, lift=0.0025, mi=0)
    # lamp units: dark glass pods below the arc at each corner, three projectors each
    for sgn in (1, -1):
        ph0, ph1 = 0.42, 0.86
        ph_s = [sgn * (ph0 + (ph1 - ph0) * i / 30) for i in range(31)]
        rows = radial_rows(bvh, (1.5, 0), ph_s, lambda ph: [zc(ph) - 0.052 + 0.04 * k / 4 for k in range(5)])
        strip(bm, rows, lift=0.0018, mi=1)
        for k in range(4):
            ph = sgn * (ph0 + 0.07 + k * 0.1)
            z = zc(ph) - 0.032
            p, n = hit(bvh, (1.5, 0, z), (math.cos(ph), math.sin(ph), 0))
            if p is None:
                continue
            ring = bmesh.ops.create_circle(bm, cap_ends=True, radius=0.0125, segments=20)
            vs = ring['verts']
            rot = n.to_track_quat('Z', 'Y').to_matrix().to_4x4()
            bmesh.ops.transform(bm, matrix=Matrix.Translation(p + n * 0.0045) @ rot, verts=vs)
            for f in {f for v in vs for f in v.link_faces}:
                f.material_index = 0
    head = new_obj('HeadLamp', bm, ['LampHead', 'LensDark'])
    shade_smooth(head, 50)

    # REAR: the same arc, full width, wrapping round the tail
    bm = bmesh.new()
    fm = 0.9
    phis = [math.pi + (-1 + 2 * i / 120) * fm for i in range(121)]
    zr = lambda ph: 0.962 + 0.035 * ((ph - math.pi) / fm) ** 2
    rows = radial_rows(bvh, (-1.55, 0), phis, lambda ph: [zr(ph) - 0.013, zr(ph), zr(ph) + 0.013])
    strip(bm, rows, lift=0.0025, mi=0)
    # a lower smoked lens band that carries the brake/turn cells
    phis2 = [math.pi + (-1 + 2 * i / 80) * 0.62 for i in range(81)]
    rows = radial_rows(bvh, (-1.55, 0), phis2, lambda ph: [zr(ph) - 0.062 + 0.042 * k / 3 for k in range(4)])
    strip(bm, rows, lift=0.0018, mi=1)
    tail = new_obj('TailLamp', bm, ['LampTail', 'LensDark'])
    shade_smooth(tail, 50)
    # chrome lettering on the tail, centred under the arc
    cu = bpy.data.curves.new('badge', 'FONT')
    cu.body = 'MIRAI  ARC'
    cu.size = 0.038
    cu.extrude = 0.0015
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.space_character = 1.35
    tob = bpy.data.objects.new('badge', cu)
    sc.collection.objects.link(tob)
    select_only(tob)
    bpy.ops.object.convert(target='MESH')
    badge = bpy.context.object
    vs = [v.co for v in badge.data.vertices]
    ctr = Vector(((min(v.x for v in vs) + max(v.x for v in vs)) / 2, (min(v.y for v in vs) + max(v.y for v in vs)) / 2, 0))
    badge.data.transform(Matrix.Translation(-ctr))
    p, n = hit(bvh, (-1.6, 0, 0.885), (-1, 0, 0))
    badge.data.transform(Matrix.Rotation(math.pi / 2, 4, 'X'))
    badge.data.transform(Matrix.Rotation(-math.pi / 2, 4, 'Z'))
    badge.location = p + n * 0.003
    badge.rotation_euler = (0, -math.atan2(n.z, -n.x) if p is not None else 0, 0)
    apply_mods(badge)
    select_only(badge)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    badge.data.materials.clear()
    badge.data.materials.append(MATS['Chrome'])
    tail = join([tail, badge], 'TailLamp')
    return head, tail


def arch_flares(bvh):
    """Satin cladding round each arch: follows the body surface, rolls into the well."""
    bm = bmesh.new()
    for x in (AXLE_F, AXLE_R):
        for sgn in (1, -1):
            rows = []
            n = 72
            for i in range(n + 1):
                a = math.radians(-12 + i * 204 / n)
                r = []
                for d in (0.004, 0.02, 0.038, 0.052):
                    px = x + (ARCH_R + d) * math.cos(a)
                    pz = WHEEL_Z + (ARCH_R + d) * math.sin(a)
                    p, nn = hit(bvh, (px, sgn * 1.4, pz), (0, -sgn, 0), 0.62)
                    if p is None or nn.y * sgn < 0.2:
                        r = None
                        break
                    r.append((p, nn))
                rows.append(r)
            # keep only the longest unbroken run
            runs, cur = [], []
            for r in rows:
                if r is None:
                    if cur: runs.append(cur)
                    cur = []
                else:
                    cur.append(r)
            if cur: runs.append(cur)
            best = max(runs, key=len) if runs else []
            if len(best) > 2:
                strip(bm, best if sgn > 0 else best[::-1], lift=0.006, depth=0.03, mi=0)
    ob = new_obj('ArchTrim', bm, ['TrimSatin'])
    shade_smooth(ob, 60)
    return ob


# ----------------------------------------------------------------------------- panel cuts
def rounded_outline(pts, r=0.05, seg=6):
    """Polygon (x, z) with each corner filleted."""
    out = []
    n = len(pts)
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        a = (p0 - p1).normalized()
        b = (p2 - p1).normalized()
        ang = math.acos(max(-1, min(1, a.dot(b))))
        rr = min(r, 0.45 * (p0 - p1).length * math.tan(ang / 2), 0.45 * (p2 - p1).length * math.tan(ang / 2))
        dist = rr / math.tan(ang / 2)
        s, e = p1 + a * dist, p1 + b * dist
        bis = (a + b).normalized()
        c = p1 + bis * (rr / math.sin(ang / 2))
        a0 = math.atan2(s.y - c.y, s.x - c.x)
        a1 = math.atan2(e.y - c.y, e.x - c.x)
        da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        for k in range(seg + 1):
            t = a0 + da * k / seg
            out.append((c.x + rr * math.cos(t), c.y + rr * math.sin(t)))
    return out


def offset_outline(pts, d):
    """Offset a CCW-or-CW closed polyline by d (positive = outward)."""
    n = len(pts)
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
    sgn = 1 if area > 0 else -1
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        t = ((p1 - p0).normalized() + (p2 - p1).normalized()).normalized()
        nrm = Vector((t.y, -t.x)) * sgn
        out.append((p1.x + nrm.x * d, p1.y + nrm.y * d))
    return out


def prism(name, outline, y0, y1):
    bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for x, z in outline]
    b = [bm.verts.new((x, y1, z)) for x, z in outline]
    n = len(outline)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.faces.new(a)
    bm.faces.new(b[::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_obj(name, bm)


def boolean(ob, cutter, op):
    """Exact boolean on an open surface; faces contributed by the cutter are dropped."""
    cm = mat('CUT', (1, 0, 1))
    cutter.data.materials.clear()
    cutter.data.materials.append(cm)
    for p in cutter.data.polygons:
        p.material_index = 0
    md = ob.modifiers.new('b', 'BOOLEAN')
    md.operation = op
    md.solver = 'EXACT'
    md.object = cutter
    md.material_mode = 'TRANSFER'
    try:
        md.use_hole_tolerant = True
    except Exception:
        pass
    apply_mods(ob)
    names = [m.name if m else '' for m in ob.data.materials]
    if 'CUT' in names:
        ci = names.index('CUT')
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index == ci], context='FACES')
        loose = [v for v in bm.verts if not v.link_faces]
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.materials.pop(index=ci)


GAP = 0.0022
DOOR_F = [(0.955, 0.372), (0.945, 0.62), (0.87, 0.995), (0.86, 1.35), (-0.30, 1.35), (-0.30, 0.372)]
DOOR_R = [(-0.366, 0.372), (-0.366, 1.35), (-1.11, 1.35), (-1.115, 0.995), (-1.0, 0.62), (-0.99, 0.372)]
FLAP = [(-1.79, 0.775), (-1.79, 0.868), (-1.665, 0.868), (-1.665, 0.775)]
FLAP_C = (-1.7275, 0.8215)


def cut_panels(body):
    """Returns the separately hinged panels; the body keeps gaps (and the rear doors)."""
    parts = {}
    specs = [('DoorR', DOOR_F, -1, True), ('DoorL', DOOR_F, 1, True),
             ('RearDoorR', DOOR_R, -1, False), ('RearDoorL', DOOR_R, 1, False),
             ('ChargeFlap', FLAP, 1, True)]
    for name, outline, sgn, movable in specs:
        r = 0.018 if name == 'ChargeFlap' else 0.055
        ol = rounded_outline(outline, r, 6)
        y0, y1 = (0.45, 1.4) if sgn > 0 else (-1.4, -0.45)
        grow = prism('g', offset_outline(ol, GAP), y0, y1)
        shrink = prism('s', offset_outline(ol, -GAP), y0, y1)
        piece = body.copy()
        piece.data = body.data.copy()
        sc.collection.objects.link(piece)
        piece.name = name
        boolean(piece, shrink, 'INTERSECT')
        boolean(body, grow, 'DIFFERENCE')
        bpy.data.objects.remove(grow)
        bpy.data.objects.remove(shrink)
        parts[name] = piece
    # rear doors go back into the body (they only need their shut lines)
    for n in ('RearDoorR', 'RearDoorL'):
        select_only(body)
        parts[n].select_set(True)
        bpy.ops.object.join()
        del parts[n]
    return parts


def clean(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-4)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=2e-4)
    bad = [f for f in bm.faces if f.calc_area() < 1e-8]
    bmesh.ops.delete(bm, geom=bad, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()


def thicken(ob, t, rim_mat_same=True, inner='Inner'):
    clean(ob)
    nm = len(ob.data.materials)
    for _ in range(nm):
        ob.data.materials.append(MATS[inner])
    md = ob.modifiers.new('sol', 'SOLIDIFY')
    md.thickness = t
    md.offset = -1
    md.use_even_offset = False
    md.nonmanifold_thickness_mode = 'CONSTRAINTS'
    md.use_rim = True
    md.material_offset = nm
    md.material_offset_rim = 0
    bv = ob.modifiers.new('bev', 'BEVEL')
    bv.width = min(0.004, t * 0.3)
    bv.segments = 2
    bv.limit_method = 'ANGLE'
    bv.angle_limit = math.radians(50)
    bv.harden_normals = False
    apply_mods(ob)
    shade_smooth(ob, 45)


def set_origin(ob, p):
    p = Vector(p)
    ob.data.transform(Matrix.Translation(-p))
    ob.location = p


def mirrors_and_handles(bvh, parts):
    # door mirrors: slim pods on the fixed sail, carried by the doors
    for side, sgn in (('R', -1), ('L', 1)):
        bm = bmesh.new()
        res = bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1.0)
        for v in res['verts']:
            x, y, z = v.co
            # teardrop in plan: blunt at the back (mirror face), pointed forward
            sx = 0.085 if x > 0 else 0.04
            v.co = Vector((x * sx, y * 0.095, z * 0.045 * (1 - 0.25 * max(0, x))))
        for f in bm.faces:
            f.material_index = 0 if f.calc_center_median().x > -0.035 else 1
        bmesh.ops.transform(bm, matrix=Matrix.Translation((0.80, sgn * 1.0, 1.035)) @ Matrix.Rotation(sgn * 0.12, 4, 'Z'), verts=bm.verts)
        # stalk
        st = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((0.815, sgn * 0.91, 1.012)) @ Matrix.Diagonal((0.045, 0.08, 0.016, 1)), verts=st['verts'])
        for v in st['verts']:
            for f in v.link_faces:
                f.material_index = 2
        m = new_obj(f'Mirror{side}', bm, ['Paint', 'Chrome', 'TrimGloss'])
        sd = m.modifiers.new('sd', 'SUBSURF')
        sd.levels = 1
        apply_mods(m)
        shade_smooth(m, 60)
        parts[f'Mirror{side}'] = m
    # flush handles (front + rear doors), a hairline chrome blade
    bm = bmesh.new()
    for sgn in (1, -1):
        for x0 in (-0.84,):
            rows = []
            for i in range(25):
                x = x0 - 0.17 * i / 24
                r = []
                for z in (0.905, 0.914, 0.923):
                    p, n = hit(bvh, (x, sgn * 1.4, z), (0, -sgn, 0))
                    r.append((p, n))
                rows.append(r if sgn > 0 else r[::-1])
            strip(bm, rows, lift=0.0025, depth=0.01)
    return new_obj('Handles', bm, ['Chrome'])


def charge_pocket():
    """Recess behind the flap with the socket and a status ring."""
    bm = bmesh.new()
    ol = rounded_outline(offset_outline(FLAP, -0.004), 0.016, 5)
    y_out, y_in = 0.99, 0.905
    a = [bm.verts.new((x, y_out, z)) for x, z in ol]
    b = [bm.verts.new((x, y_in, z)) for x, z in ol]
    n = len(ol)
    for i in range(n):
        bm.faces.new((a[i], b[i], b[(i + 1) % n], a[(i + 1) % n]))
    bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.normal_flip()  # walls face the opening
    cx, cz = FLAP_C
    # socket body
    prof = [(0.0, y_in + 0.028), (0.028, y_in + 0.028), (0.033, y_in + 0.024), (0.033, y_in)]
    segs = 40
    rings = [[bm.verts.new((cx + r * math.cos(2 * math.pi * i / segs), w, cz + r * math.sin(2 * math.pi * i / segs))) for r, w in prof] for i in range(segs)]
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % segs]
        for j in range(len(prof) - 1):
            f = bm.faces.new((A[j], B[j], B[j + 1], A[j + 1]))
            f.material_index = 0
    # pin holes: small dark discs
    for k, (dx, dz) in enumerate(((0, 0.012), (-0.011, -0.004), (0.011, -0.004), (0, -0.016))):
        c = bmesh.ops.create_circle(bm, cap_ends=True, radius=0.0045, segments=12)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((cx + dx, y_in + 0.0295, cz + dz)) @ Matrix.Rotation(-math.pi / 2, 4, 'X'), verts=c['verts'])
        for v in c['verts']:
            for f in v.link_faces:
                f.material_index = 2
    # status ring
    ring = []
    for i in range(48):
        a0 = 2 * math.pi * i / 48
        ring.append((bm.verts.new((cx + 0.037 * math.cos(a0), y_in + 0.012, cz + 0.037 * math.sin(a0))),
                     bm.verts.new((cx + 0.043 * math.cos(a0), y_in + 0.012, cz + 0.043 * math.sin(a0)))))
    for i in range(48):
        a0, b0 = ring[i], ring[(i + 1) % 48]
        f = bm.faces.new((a0[0], b0[0], b0[1], a0[1]))
        f.material_index = 1
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    ob = new_obj('ChargePort', bm, ['Socket', 'ChargeRing', 'Under'])
    shade_smooth(ob, 40)
    return ob



# ----------------------------------------------------------------------------- interior
EYE = Vector((-0.12, -0.40, 1.17))      # driver's eye point
SEAT_Y = 0.40


def soft_box(name, fn, cuts=3, levels=2, mats=('Seat',), mat_of=None):
    """A cube whose surface points (u, v, w in [-1, 1]) are mapped through fn,
    then Catmull-Clark smoothed: soft upholstered volumes."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    if mat_of:
        for f in bm.faces:
            c = f.calc_center_median()
            f.material_index = mat_of(c.x, c.y, c.z, f.normal)
    for v in bm.verts:
        v.co = Vector(fn(v.co.x, v.co.y, v.co.z))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_obj(name, bm, list(mats))
    sd = ob.modifiers.new('sd', 'SUBSURF')
    sd.levels = levels
    apply_mods(ob)
    shade_smooth(ob)
    return ob


def seat(name, yc, x0, zc, rear=False, width=0.54):
    """Sport-contoured seat: cushion + backrest with integrated headrest."""
    W = width
    L = 0.5 if not rear else 0.48
    parts = []

    def cush(u, v, w):
        bol = max(0.0, abs(u) - 0.5) / 0.5
        top = 0.13 + 0.05 * bol ** 1.5 - 0.015 * (1 - abs(u))
        x = x0 + (v + 1) / 2 * L
        z = zc - 0.12 + (w + 1) / 2 * (top + 0.12 * (1 - (w + 1) / 2) * 0) + 0.03 * (v + 1) / 2 * (w > 0)
        return (x, yc + u * W / 2 * (1 - 0.06 * (1 - (v + 1) / 2)), z)
    mo = lambda u, v, w, n: 1 if (w > 0.9 and abs(u) < 0.5 and v < 0.8) else 0
    parts.append(soft_box(name + '_cushion', cush, mats=('Seat', 'SeatAccent'), mat_of=mo))

    rec = math.radians(17 if not rear else 22)
    H = 0.72 if not rear else 0.6
    base = Vector((x0 + 0.04, yc, zc - 0.02))

    def back(u, v, w):
        t = (v + 1) / 2                     # 0 bottom -> 1 top
        # silhouette: shoulders, then a neck and an integrated headrest
        if rear:
            half = W / 2 * (1 - 0.1 * t)
        else:
            neck = sstep(0.58, 0.68, t) * (1 - sstep(0.7, 0.78, t))
            half = W / 2 * (1 - 0.08 * t) * (1 - 0.42 * sstep(0.6, 0.7, t)) * (1 - 0.1 * neck)
        depth = 0.13 - 0.03 * t
        bol = max(0.0, abs(u) - 0.55) / 0.45 * (1 - sstep(0.55, 0.65, t)) * (0 if rear else 1)
        fwd = (w + 1) / 2 * depth + (w > 0) * 0.06 * bol ** 1.3
        # local frame: up along the recline, forward = +x rotated
        up = Vector((-math.sin(rec), 0, math.cos(rec)))
        fw = Vector((math.cos(rec), 0, math.sin(rec)))
        hl = H * t + (0.02 if t > 0.99 else 0)
        p = base + up * hl + fw * (fwd - depth) + Vector((0, u * half, 0))
        return tuple(p)
    mo2 = lambda u, v, w, n: 1 if (w > 0.9 and abs(u) < 0.5 and v < 0.25) else 0
    parts.append(soft_box(name + '_back', back, cuts=4, mats=('Seat', 'SeatAccent'), mat_of=mo2))
    if not rear:
        # pedestal
        def ped(u, v, w):
            return (x0 + 0.08 + (v + 1) / 2 * (L - 0.12), yc + u * 0.2, 0.3 + (w + 1) / 2 * (zc - 0.4))
        parts.append(soft_box(name + '_ped', ped, cuts=1, levels=1, mats=('TrimSatin',)))
    return join(parts, name)


def loft_y(name, section, ys, mats, mat_of=None, levels=2, cap=True, yshape=None):
    """Sweep a closed (x, z) section across Y; yshape(y) -> (dx, dz) offsets."""
    bm = bmesh.new()
    rings = []
    for y in ys:
        d = yshape(y) if yshape else (0, 0)
        rings.append([bm.verts.new((x + d[0], y, z + d[1])) for x, z in section])
    n = len(section)
    for i in range(len(ys) - 1):
        for j in range(n):
            f = bm.faces.new((rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]))
            if mat_of:
                f.material_index = mat_of(j, i)
    if cap:
        bm.faces.new(rings[0])
        bm.faces.new(rings[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_obj(name, bm, mats)
    if levels:
        sd = ob.modifiers.new('sd', 'SUBSURF')
        sd.levels = levels
        apply_mods(ob)
    shade_smooth(ob, 50)
    return ob


def panel(bm, c, ex, ey, w, h, mi=0, uv=False):
    """Flat quad at c spanning ex*w by ey*h; optional 0..1 UVs (v up)."""
    c, ex, ey = Vector(c), Vector(ex).normalized(), Vector(ey).normalized()
    ps = [c - ex * w / 2 - ey * h / 2, c + ex * w / 2 - ey * h / 2, c + ex * w / 2 + ey * h / 2, c - ex * w / 2 + ey * h / 2]
    vs = [bm.verts.new(p) for p in ps]
    f = bm.faces.new(vs)
    f.material_index = mi
    if uv:
        lay = bm.loops.layers.uv.verify()
        for loop, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[lay].uv = t
    return f


def slab(bm, c, ex, ey, ez, w, h, d, mi=0):
    c = Vector(c)
    ex, ey, ez = Vector(ex).normalized(), Vector(ey).normalized(), Vector(ez).normalized()
    res = bmesh.ops.create_cube(bm, size=1.0)
    M = Matrix.Identity(4)
    for i in range(3):
        M[i][0], M[i][1], M[i][2] = ex[i] * w, ey[i] * h, ez[i] * d
        M[i][3] = c[i]
    bmesh.ops.transform(bm, matrix=M, verts=res['verts'])
    for v in res['verts']:
        for f in v.link_faces:
            f.material_index = mi
    return res


def dashboard():
    # cross-section (x, z), closed, running over the top from the windscreen base
    sec = [(1.02, 0.92), (0.8, 0.945), (0.58, 0.94), (0.47, 0.915), (0.44, 0.87), (0.445, 0.8), (0.47, 0.72),
           (0.5, 0.68), (0.62, 0.64), (0.85, 0.62), (1.02, 0.66)]
    ys = [-0.84 + i * 1.68 / 16 for i in range(17)]
    # the trim band on the face (between points 4-5) and dark top
    def mo(j, i):
        return 1 if j == 4 else 0
    def shape(y):
        # a gentle wrap: the dash face curves back towards the doors
        return (0.05 * (abs(y) / 0.84) ** 2.2, 0.0)
    dash = loft_y('Dash', sec, ys, ['Dash', 'DashTrim'], mat_of=mo, levels=2, yshape=shape)
    bm = bmesh.new()
    # ambient light line under the trim band
    for y0, y1 in ((-0.8, 0.8),):
        n = 40
        for i in range(n):
            ya, yb = lerp(y0, y1, i / n), lerp(y0, y1, (i + 1) / n)
            xa, xb = 0.432 + 0.05 * (abs(ya) / 0.84) ** 2.2, 0.432 + 0.05 * (abs(yb) / 0.84) ** 2.2
            vs = [bm.verts.new(p) for p in ((xa, ya, 0.79), (xb, yb, 0.79), (xb, yb, 0.796), (xa, ya, 0.796))]
            bm.faces.new(vs[::-1])
    amb = new_obj('AmbientDash', bm, ['Ambient'])
    # toe board / firewall + floor + rear shelf
    bm = bmesh.new()
    for a, b, c, d in (
        ((1.02, -0.86, 0.64), (1.02, 0.86, 0.64), (0.92, 0.86, 0.3), (0.92, -0.86, 0.3)),
        ((0.92, -0.86, 0.3), (0.92, 0.86, 0.3), (-1.72, 0.86, 0.3), (-1.72, -0.86, 0.3)),
        ((-1.72, -0.86, 0.3), (-1.72, 0.86, 0.3), (-1.72, 0.86, 0.62), (-1.72, -0.86, 0.62)),
        ((-1.72, -0.84, 0.62), (-1.72, 0.84, 0.62), (-2.3, 0.7, 0.66), (-2.3, -0.7, 0.66)),
    ):
        f = bm.faces.new([bm.verts.new(p) for p in (a, b, c, d)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0 and abs(f.normal.x) < 0.5:
            f.normal_flip()
    floor = new_obj('Floor', bm, ['Carpet'])
    return [dash, amb, floor]


def steering():
    n_exp, a, b = 4.0, 0.168, 0.132
    N, M, rt = 96, 12, 0.0175
    bm = bmesh.new()
    rings = []
    def P(t):
        c, s_ = math.cos(t), math.sin(t)
        return Vector((a * math.copysign(abs(c) ** (2 / n_exp), c), b * math.copysign(abs(s_) ** (2 / n_exp), s_), 0))
    for i in range(N):
        t = 2 * math.pi * i / N
        p = P(t)
        T = (P(t + 1e-3) - P(t - 1e-3)).normalized()
        Nn = Vector((T.y, -T.x, 0))  # outward in plane
        Z = Vector((0, 0, 1))
        ring = []
        for j in range(M):
            ph = 2 * math.pi * j / M
            q = p + Nn * (rt * math.cos(ph)) + Z * (rt * 0.85 * math.sin(ph))
            ring.append(bm.verts.new(q))
        rings.append(ring)
    for i in range(N):
        A, B = rings[i], rings[(i + 1) % N]
        for j in range(M):
            bm.faces.new((A[j], B[j], B[(j + 1) % M], A[(j + 1) % M]))
    # spokes (left / right) and a lower bar
    for sgn in (1, -1):
        slab(bm, (sgn * 0.105, -0.01, -0.012), (1, 0, 0), (0, 1, 0), (0, 0, 1), 0.14, 0.04, 0.018, mi=1)
    slab(bm, (0, -0.095, -0.012), (1, 0, 0), (0, 1, 0), (0, 0, 1), 0.035, 0.1, 0.016, mi=1)
    # hub pad and a hairline ring
    ring = bmesh.ops.create_circle(bm, cap_ends=True, radius=0.016, segments=24)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, 0.036)), verts=ring['verts'])
    for v in ring['verts']:
        for f in v.link_faces:
            f.material_index = 2
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_obj('Steering', bm, ['Wheel', 'TrimGloss', 'Chrome'])
    shade_smooth(ob, 45)
    # airbag pad: a soft rounded block in the wheel's centre
    pad = soft_box('SteerPad', lambda u, v, w: (u * 0.066, v * 0.05, 0.012 + w * 0.02), cuts=2, levels=2, mats=('Wheel',))
    ob = join([ob, pad], 'Steering')
    # orient: the wheel plane faces the driver, tilted 25 degrees back
    nrm = Vector((-0.906, 0, 0.423))
    ex = Vector((0, -1, 0))
    ey = nrm.cross(ex)
    R = Matrix((ex, ey, nrm)).transposed().to_4x4()
    ob.data.transform(R)
    hubp = Vector((0.35, -SEAT_Y, 0.845))
    ob.location = hubp
    # column shroud into the dash (fixed)
    bm = bmesh.new()
    slab(bm, hubp + Vector((0.12, 0, -0.045)), (0.906, 0, -0.423), (0, 1, 0), (0.423, 0, 0.906), 0.22, 0.07, 0.06)
    col = new_obj('Column', bm, ['Dash'])
    sd = col.modifiers.new('sd', 'SUBSURF')
    sd.levels = 2
    apply_mods(col)
    shade_smooth(col)
    return ob, col, hubp, nrm


def screens():
    out = {}
    bm = bmesh.new()
    # meter: a slim floating display above the wheel
    mc = Vector((0.47, -SEAT_Y, 1.0))
    look = (EYE - mc).normalized()
    ex = Vector((0, -1, 0))
    ey = look.cross(ex).normalized() * -1
    ey = Vector((0.2, 0, 1)).normalized()
    ez = ex.cross(ey)
    panel(bm, mc, Vector((0, -1, 0)), ey, 0.30, 0.105, uv=True)
    out['meter'] = (mc, 0.30, 0.105)
    m = new_obj('ScreenMeter', bm, ['ScreenMeter'])
    # centre display: landscape tablet angled to the driver
    bm = bmesh.new()
    cc = Vector((0.415, -0.03, 0.87))
    yaw = math.radians(9)
    exc = Vector((math.sin(yaw), -math.cos(yaw), 0))  # screen right (towards the driver side)
    eyc = Vector((0.34, 0, 1)).normalized()
    panel(bm, cc, exc, eyc, 0.34, 0.205, uv=True)
    c = new_obj('ScreenCenter', bm, ['ScreenCenter'])
    # bezels (gloss black slabs just behind each screen)
    bm = bmesh.new()
    n1 = Vector((0, -1, 0)).cross(Vector((0.2, 0, 1)).normalized())
    slab(bm, mc + n1 * 0.011 * -1 + Vector((0.012, 0, 0)), (0, 1, 0), Vector((0.2, 0, 1)), n1, 0.315, 0.12, 0.02)
    n2 = exc.cross(eyc).normalized()
    slab(bm, cc - n2 * 0.011, exc, eyc, n2, 0.355, 0.22, 0.018)
    # meter pod stem into the dash
    slab(bm, (0.5, -SEAT_Y, 0.94), (1, 0, 0), (0, 1, 0), (0, 0, 1), 0.06, 0.12, 0.06)
    bz = new_obj('Bezels', bm, ['TrimGloss'])
    sd = bz.modifiers.new('b', 'BEVEL')
    sd.width = 0.004
    sd.segments = 2
    apply_mods(bz)
    shade_smooth(bz, 40)
    return m, c, bz


def console():
    def fn(u, v, w):
        t = (v + 1) / 2          # 0 at the back (armrest) -> 1 at the dash
        x = lerp(-0.62, 0.46, t)
        top = lerp(0.64, 0.7, sstep(0.55, 1.0, t)) + 0.02 * sstep(0.0, 0.2, t) * (1 - sstep(0.3, 0.45, t))
        bot = lerp(0.3, 0.52, sstep(0.25, 0.6, t))  # floating bridge towards the dash
        half = lerp(0.11, 0.09, t)
        z = lerp(bot, top, (w + 1) / 2)
        return (x, u * half, z)
    mo = lambda u, v, w, n: 1 if (w > 0.95 and abs(u) < 0.7) else 0
    c = soft_box('Console', fn, cuts=4, mats=('Dash', 'DashTrim'), mat_of=mo)
    bm = bmesh.new()
    for sgn in (1, -1):
        n = 30
        for i in range(n):
            xa, xb = lerp(-0.55, 0.4, i / n), lerp(-0.55, 0.4, (i + 1) / n)
            def z(x):
                t = (x + 0.62) / 1.08
                return lerp(0.64, 0.7, sstep(0.55, 1.0, t)) - 0.035
            def hw(x):
                t = (x + 0.62) / 1.08
                return lerp(0.11, 0.09, t) + 0.0015
            vs = [bm.verts.new(p) for p in ((xa, sgn * hw(xa), z(xa)), (xb, sgn * hw(xb), z(xb)),
                                            (xb, sgn * hw(xb), z(xb) + 0.006), (xa, sgn * hw(xa), z(xa) + 0.006))]
            f = bm.faces.new(vs if sgn > 0 else vs[::-1])
    a = new_obj('AmbientConsole', bm, ['Ambient'])
    return [c, a]


def door_trim(sgn, x0, x1, name):
    """Inner door card: leather armrest, metal sill band, pull handle, switch pod,
    speaker grille and two ambient light lines (x1 = front edge, x0 = rear edge)."""
    yi = sgn * 0.868
    ZA = 0.695  # armrest height

    def fn(u, v, w):
        t = (v + 1) / 2  # 0 bottom -> 1 top
        x = lerp(x1, x0, (u + 1) / 2)
        z = lerp(0.38, 0.985, t)
        arm = math.exp(-((t - 0.52) / 0.06) ** 2)
        depth = 0.022 + 0.05 * arm + 0.015 * sstep(0.85, 1.0, t)
        yy = yi - sgn * (w + 1) / 2 * depth
        return (x, yy, z)

    def mo(u, v, w, n):
        t = (v + 1) / 2
        if w > 0.9 and 0.4 < t < 0.6 and -0.8 < u < 0.7:
            return 1  # armrest insert in the seat leather
        if w > 0.9 and 0.8 < t < 0.9:
            return 2  # metal band under the sill
        return 0
    card = soft_box(name, fn, cuts=9, mats=('Dash', 'Seat', 'DashTrim'), mat_of=mo)
    front = x1 > x0
    L = abs(x1 - x0)
    fx = lambda d: x1 - d if front else x1 + d  # distance from the front edge
    cb = BVHTree.FromObject(card, bpy.context.evaluated_depsgraph_get())
    inward = Vector((0, -sgn, 0))

    def surf(x, z):
        """Point on the card's cabin-side surface (cast from the cabin outwards)."""
        p, n, _, _ = cb.ray_cast(Vector((x, sgn * 0.55, z)), Vector((0, sgn, 0)), 1.0)
        return (p, n) if p is not None else (Vector((x, yi - sgn * 0.03, z)), inward)
    bm = bmesh.new()
    # ambient lines: under the metal sill band and along the armrest's underside
    for z0 in (0.852, 0.64):
        rows = []
        n = 40
        for k in range(n + 1):
            x = lerp(fx(0.06 * L), fx(0.94 * L), k / n)
            r = [surf(x, z0), surf(x, z0 + 0.009)]
            rows.append(r if sgn > 0 else r[::-1])
        strip(bm, rows, lift=0.0015, depth=0.004, mi=0)
    # pull handle (metal bar above the armrest) and door release
    p, n = surf(fx(0.42 * L), 0.78)
    slab(bm, p + inward * 0.022, (1, 0, 0), (0, 0, 1), (0, 1, 0), 0.2, 0.022, 0.028, mi=1)
    p, n = surf(fx(0.1 * L), 0.9)
    slab(bm, p + inward * 0.008, (1, 0, 0), (0, 0, 1), (0, 1, 0), 0.07, 0.016, 0.014, mi=2)
    # window switch pod resting on the armrest top
    p, n = surf(fx(0.2 * L), 0.715)
    slab(bm, p + inward * 0.004 + Vector((0, 0, 0.012)), (1, 0, 0), (0, 1, 0), (0, 0, 1), 0.12, 0.045, 0.012, mi=3)
    # speaker: gloss disc with a metal ring, flush with the card
    p, n = surf(fx(0.2 * L), 0.5)
    rot = inward.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    for rad, mi, off in ((0.078, 1, 0.002), (0.068, 3, 0.004)):
        d = bmesh.ops.create_circle(bm, cap_ends=True, radius=rad, segments=40)
        bmesh.ops.transform(bm, matrix=Matrix.Translation(p + inward * off) @ rot, verts=d['verts'])
        for v in d['verts']:
            for f in v.link_faces:
                f.material_index = mi
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    parts = new_obj(name + 'Parts', bm, ['Ambient', 'DashTrim', 'Chrome', 'TrimGloss'])
    bv = parts.modifiers.new('b', 'BEVEL')
    bv.width = 0.003
    bv.segments = 2
    bv.limit_method = 'ANGLE'
    apply_mods(parts)
    shade_smooth(parts, 40)
    return join([card, parts], name)


def belt_moulding(bvh, x_from, x_to, sgn, name):
    """Satin strip just under the belt edge: outlines the side windows."""
    bm = bmesh.new()
    rows = []
    n = max(8, int(abs(x_to - x_from) / 0.02))
    for i in range(n + 1):
        x = lerp(x_from, x_to, i / n)
        zt = ROWS[7]['fz'](x)
        r = []
        for dz in (-0.024, -0.016, -0.008):
            p, nn = hit(bvh, (x, sgn * 1.4, zt + dz), (0, -sgn, 0), 0.7)
            if p is None:
                r = None
                break
            r.append((p, nn))
        if r:
            rows.append(r if sgn > 0 else r[::-1])
    if len(rows) > 2:
        strip(bm, rows, lift=0.0025, depth=0.008)
    return new_obj(name, bm, ['WindowTrim'])


def rearview():
    bm = bmesh.new()
    n = Vector((-0.92, -0.38, 0.1)).normalized()
    ex = Vector((0.38, -0.92, 0)).normalized()
    ey = n.cross(ex).normalized()
    slab(bm, (0.42, 0, 1.172), ex, ey, n, 0.17, 0.048, 0.02, mi=0)
    slab(bm, (0.44, 0, 1.208), (0, 1, 0), (0.3, 0, 1), (1, 0, -0.3), 0.022, 0.05, 0.014, mi=0)
    ob = new_obj('RearView', bm, ['TrimGloss'])
    bv = ob.modifiers.new('b', 'BEVEL')
    bv.width = 0.008
    bv.segments = 3
    apply_mods(ob)
    shade_smooth(ob, 40)
    return ob


def pedals():
    bm = bmesh.new()
    slab(bm, (0.86, -0.33, 0.42), (0.3, 0, 1), (0, 1, 0), (-1, 0, 0.3), 0.18, 0.06, 0.012, mi=0)
    slab(bm, (0.83, -0.47, 0.43), (0.3, 0, 1), (0, 1, 0), (-1, 0, 0.3), 0.08, 0.1, 0.014, mi=0)
    ob = new_obj('Pedals', bm, ['Chrome'])
    return ob


def build_interior():
    objs = []
    objs += dashboard()
    wheel, col, hubp, axis = steering()
    objs.append(col)
    objs += list(screens())
    objs += console()
    objs.append(rearview())
    objs.append(pedals())
    objs.append(seat('SeatDriver', -SEAT_Y, -0.52, 0.58))
    objs.append(seat('SeatPassenger', SEAT_Y, -0.52, 0.58))
    rb = [seat('RearL', 0.38, -1.48, 0.6, rear=True, width=0.5), seat('RearR', -0.38, -1.48, 0.6, rear=True, width=0.5),
          seat('RearM', 0.0, -1.46, 0.58, rear=True, width=0.3)]
    objs += rb
    objs.append(door_trim(-1, -1.08, -0.4, 'TrimRearR'))
    objs.append(door_trim(1, -1.08, -0.4, 'TrimRearL'))
    return objs, wheel, dict(hub=hubp, axis=axis)


# ----------------------------------------------------------------------------- arches
def cut_arches(ob):
    cutters = []
    for x in (AXLE_F, AXLE_R):
        for sgn in (1, -1):
            bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=ARCH_R, depth=0.9,
                                                location=(x, sgn * 1.07, WHEEL_Z), rotation=(math.pi / 2, 0, 0))
            cutters.append(bpy.context.object)
    for c in cutters[1:]:
        c.select_set(True)
    select_only(cutters[0])
    for c in cutters[1:]:
        c.select_set(True)
    bpy.ops.object.join()
    cut = bpy.context.object
    boolean(ob, cut, 'DIFFERENCE')
    bpy.data.objects.remove(cut)


def wheel_liners():
    bm = bmesh.new()
    for x in (AXLE_F, AXLE_R):
        for sgn in (1, -1):
            n, m = 40, 3
            R = ARCH_R + 0.012
            y0, y1 = 0.56, 0.955
            vs = []
            for i in range(n + 1):
                a = math.radians(-18 + i * (216 / n))
                row = []
                for j in range(m + 1):
                    y = lerp(y0, y1, j / m) * sgn
                    row.append(bm.verts.new((x + R * math.cos(a), y, WHEEL_Z + R * math.sin(a))))
                vs.append(row)
            for i in range(n):
                for j in range(m):
                    q = (vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1])
                    bm.faces.new(q if sgn > 0 else q[::-1])
            # inner wall closing the well towards the cabin
            c = bm.verts.new((x, sgn * y0, WHEEL_Z))
            for i in range(n):
                q = (c, vs[i + 1][0], vs[i][0])
                bm.faces.new(q if sgn > 0 else q[::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_obj('Liners', bm, ['Liner'])
    md = ob.modifiers.new('s', 'SOLIDIFY')
    md.thickness = 0.01
    apply_mods(ob)
    return ob


# ----------------------------------------------------------------------------- wheels
TIRE_W = 0.128   # half width
RIM_R = 0.268


def revolve(profile, segs, name, mats, mat_of=None):
    """profile: [(r, w)] closed loop; revolved about the Y axis (w = y)."""
    bm = bmesh.new()
    P = len(profile)
    rings = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        ca, sa = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((r * ca, w, r * sa)) for r, w in profile])
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % segs]
        for j in range(P - 1):
            f = bm.faces.new((A[j], A[j + 1], B[j + 1], B[j]))
            if mat_of:
                f.material_index = mat_of(j)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_obj(name, bm, mats)
    shade_smooth(ob, 40)
    return ob


def tire():
    W = TIRE_W
    prof = [(RIM_R - 0.004, -W + 0.02)]
    # inner sidewall (bead -> shoulder)
    for t in [i / 10 for i in range(11)]:
        r = lerp(RIM_R + 0.004, TIRE_R - 0.018, t)
        w = -(W - 0.012) - 0.012 * math.sin(math.pi * t)
        prof.append((r, w))
    # shoulder round
    for k in range(1, 6):
        a = k / 6 * math.pi / 2
        prof.append((TIRE_R - 0.018 + 0.018 * math.sin(a), -(W - 0.012) + 0.012 * (1 - math.cos(a)) * 0 + 0.012 * (1 - math.cos(a))))
    # tread with four grooves
    grooves = [-0.075, -0.028, 0.028, 0.075]
    ws = [-(W - 0.024) + i * (2 * (W - 0.024)) / 48 for i in range(49)]
    for w in ws:
        r = TIRE_R
        for g in grooves:
            if abs(w - g) < 0.006:
                r = TIRE_R - 0.008
        prof.append((r, w))
    for k in range(5, -1, -1):
        a = k / 6 * math.pi / 2
        prof.append((TIRE_R - 0.018 + 0.018 * math.sin(a), (W - 0.012) - 0.012 * (1 - math.cos(a))))
    for t in [i / 10 for i in range(10, -1, -1)]:
        r = lerp(RIM_R + 0.004, TIRE_R - 0.018, t)
        w = (W - 0.012) + 0.012 * math.sin(math.pi * t)
        prof.append((r, w))
    prof.append((RIM_R - 0.004, W - 0.02))
    prof.append(prof[0])
    return revolve(prof, 96, 'Tire', ['Tire'])


def barrel():
    W = TIRE_W
    prof = [(0.20, -0.02), (0.235, -0.09), (RIM_R - 0.012, -W + 0.012), (RIM_R + 0.004, -W + 0.006),
            (RIM_R + 0.004, -W + 0.022), (RIM_R - 0.006, -W + 0.03), (RIM_R - 0.006, W - 0.045),
            (RIM_R + 0.01, W - 0.03), (RIM_R + 0.012, W - 0.012), (RIM_R + 0.002, W - 0.004),
            (RIM_R - 0.022, W - 0.008), (RIM_R - 0.022, W - 0.03), (0.2, -0.02)]
    ob = revolve(prof, 96, 'Barrel', ['RimBarrel', 'RimLip'], mat_of=lambda j: 1 if 6 <= j <= 10 else 0)
    return ob


def spokes(name, n, hw, swirl, r0, r1, face, dish, thick, mats, twin=0.0):
    """Spokes as parametric strips: hw(t) half width (m), swirl(t) angle offset, dish(t) axial drop."""
    bm = bmesh.new()
    NU, NV = 6, 22
    reps = [(i * 2 * math.pi / n, 0.0) for i in range(n)]
    if twin:
        reps = [(i * 2 * math.pi / n + s * twin, s) for i in range(n) for s in (-1, 1)]
    for base, side in reps:
        grid = []
        for j in range(NV + 1):
            t = j / NV
            r = lerp(r0, r1, t)
            c = base + swirl(t) + side * 0.0
            row = []
            for i in range(NU + 1):
                u = -1 + 2 * i / NU
                a = c + u * hw(t) / r
                w = face - dish(t) - 0.004 * u * u
                row.append(bm.verts.new((r * math.cos(a), w, r * math.sin(a))))
            grid.append(row)
        for j in range(NV):
            for i in range(NU):
                bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.y < 0:
            f.normal_flip()
    ob = new_obj(name, bm, mats)
    md = ob.modifiers.new('s', 'SOLIDIFY')
    md.thickness = thick
    md.offset = -1
    md.use_even_offset = True
    bv = ob.modifiers.new('b', 'BEVEL')
    bv.width = 0.0035
    bv.segments = 2
    bv.limit_method = 'ANGLE'
    bv.angle_limit = math.radians(40)
    apply_mods(ob)
    shade_smooth(ob, 35)
    return ob


def hub(name, face, mats):
    bm = bmesh.new()
    prof = [(0.0, face + 0.012), (0.03, face + 0.011), (0.052, face + 0.006), (0.06, face - 0.004),
            (0.078, face - 0.012), (0.084, face - 0.04)]
    segs = 64
    rings = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        rings.append([bm.verts.new((r * math.cos(a), w, r * math.sin(a))) for r, w in prof])
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % segs]
        for j in range(len(prof) - 1):
            f = bm.faces.new((A[j], B[j], B[j + 1], A[j + 1]))
            f.material_index = 1 if j == 0 else 0
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_obj(name, bm, mats)
    shade_smooth(ob, 35)
    return ob


def join(objs, name):
    select_only(objs[0])
    for o in objs[1:]:
        o.select_set(True)
    bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = name
    ob.data.name = name
    return ob


def wheel_designs():
    face = TIRE_W - 0.02
    # A — "AERO": five broad swept blades, nearly closed, for range
    a_bl = spokes('RimA_blades', 5,
                  hw=lambda t: lerp(0.034, 0.118, t ** 0.8),
                  swirl=lambda t: 0.55 * t ** 1.3,
                  r0=0.07, r1=RIM_R - 0.018, face=face,
                  dish=lambda t: 0.012 * math.sin(math.pi * t) + 0.004 * (1 - t), thick=0.022, mats=['RimA'])
    a_hub = hub('RimA_hub', face + 0.002, ['RimA', 'Chrome'])
    rimA = join([a_bl, a_hub], 'RimA')
    # B — "SPORT": ten slim twin spokes, deeply concave, showing the brake
    b_sp = spokes('RimB_spokes', 5,
                  hw=lambda t: lerp(0.011, 0.0145, t),
                  swirl=lambda t: 0.0,
                  r0=0.07, r1=RIM_R - 0.016, face=face,
                  dish=lambda t: 0.045 * (1 - t) ** 1.6, thick=0.026, mats=['RimB'], twin=0.11)
    b_hub = hub('RimB_hub', face - 0.043, ['RimB', 'Chrome'])
    rimB = join([b_sp, b_hub], 'RimB')
    return rimA, rimB


def brake():
    # ventilated disc + caliper, sitting inside the barrel
    prof = [(0.09, -0.035), (0.19, -0.035), (0.19, -0.005), (0.09, -0.005), (0.09, -0.035)]
    disc = revolve(prof, 64, 'Brake', ['Brake'])
    bm = bmesh.new()
    n = 10
    rows = []
    for i in range(n + 1):
        a = math.radians(118 + i * 52 / n)
        row = []
        for r, w in ((0.15, -0.05), (0.215, -0.05), (0.215, 0.018), (0.15, 0.018)):
            row.append(bm.verts.new((r * math.cos(a), w, r * math.sin(a))))
        rows.append(row)
    for i in range(n):
        for j in range(4):
            bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][(j + 1) % 4], rows[i][(j + 1) % 4]))
    bm.faces.new(rows[0][::-1])
    bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cal = new_obj('Caliper', bm, ['Caliper'])
    bv = cal.modifiers.new('b', 'BEVEL')
    bv.width = 0.008
    bv.segments = 3
    apply_mods(cal)
    shade_smooth(cal, 40)
    return disc, cal


WHEEL_PARTS = []


def build_wheels():
    mat('RimA', (0.55, 0.56, 0.57), 0.28, 1.0)
    mat('RimB', (0.08, 0.08, 0.085), 0.25, 0.8)
    mat('RimBarrel', (0.12, 0.12, 0.125), 0.45, 0.8)
    mat('RimLip', (0.7, 0.71, 0.72), 0.2, 1.0)
    t = tire()
    b = barrel()
    rimA, rimB = wheel_designs()
    disc, cal = brake()
    WHEEL_PARTS.extend([t, b, rimA, rimB, disc, cal])
    return dict(tire=t, barrel=b, rimA=rimA, rimB=rimB, disc=disc, caliper=cal)


def place_preview_wheels(W, design='rimB'):
    """Linked copies at the four corners (preview renders only)."""
    made = []
    for x in (AXLE_F, AXLE_R):
        for sgn in (1, -1):
            for key in ('tire', 'barrel', design, 'disc', 'caliper'):
                src = W[key]
                o = src.copy()
                sc.collection.objects.link(o)
                o.location = (x, sgn * TRACK_Y, WHEEL_Z)
                o.rotation_euler = (0, 0, 0 if sgn > 0 else math.pi)
                made.append(o)
    for key in W:
        W[key].hide_render = True
    return made



def split_by_material(ob, matname, newname):
    names = [m.name for m in ob.data.materials]
    if matname not in names:
        return None
    mi = names.index(matname)
    cp = ob.copy()
    cp.data = ob.data.copy()
    sc.collection.objects.link(cp)
    cp.name = newname
    for o, keep in ((cp, True), (ob, False)):
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.material_index == mi) != keep], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.to_mesh(o.data)
        bm.free()
    return cp


def front_handle(bvh, sgn):
    bm = bmesh.new()
    rows = []
    for i in range(25):
        x = 0.12 - 0.17 * i / 24
        r = []
        for z in (0.905, 0.914, 0.923):
            p, n = hit(bvh, (x, sgn * 1.4, z), (0, -sgn, 0))
            r.append((p, n))
        rows.append(r if sgn > 0 else r[::-1])
    strip(bm, rows, lift=0.0025, depth=0.01)
    return new_obj('HandleF', bm, ['Chrome'])

# ----------------------------------------------------------------------------- preview
def preview_setup():
    world = bpy.data.worlds.new('studio')
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (0.02, 0.022, 0.025, 1)
    bg.inputs[1].default_value = 1.0
    # softboxes
    def area(name, loc, rot, size, energy, sx=None):
        L = bpy.data.lights.new(name, 'AREA')
        L.shape = 'RECTANGLE'
        L.size = size
        L.size_y = sx or size
        L.energy = energy
        o = bpy.data.objects.new(name, L)
        o.location = loc
        o.rotation_euler = rot
        sc.collection.objects.link(o)
    area('top', (0, 0, 4.2), (0, 0, 0), 6.5, 2200, 1.6)
    area('side', (0, -5, 1.8), (math.radians(70), 0, 0), 5, 800, 1.2)
    area('front', (6, 1, 2.2), (0, math.radians(68), 0), 3, 500, 3)
    area('back', (-6, 1, 2.2), (0, math.radians(-68), 0), 3, 300, 3)
    # emissive strips so the paint shows its reflection lines
    for i, y in enumerate((-2.2, 2.2)):
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, y, 2.6))
        s = bpy.context.object
        s.scale = (9, 0.25, 1)
        s.rotation_euler = (math.radians(90 if y > 0 else -90) * 0.6, 0, 0)
        m = bpy.data.materials.new(f'strip{i}')
        m.use_nodes = True
        nt = m.node_tree
        e = nt.nodes.new('ShaderNodeEmission')
        e.inputs[1].default_value = 12
        nt.links.new(e.outputs[0], nt.nodes['Material Output'].inputs[0])
        s.data.materials.append(m)
        s.visible_camera = False
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    fl = bpy.context.object
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    fb = fm.node_tree.nodes['Principled BSDF']
    fb.inputs['Base Color'].default_value = (0.05, 0.052, 0.056, 1)
    fb.inputs['Roughness'].default_value = 0.35
    fl.data.materials.append(fm)
    sc.render.engine = 'BLENDER_EEVEE'
    try:
        sc.eevee.taa_render_samples = 32
        sc.eevee.use_raytracing = True
    except Exception:
        pass
    sc.render.resolution_x = 1280
    sc.render.resolution_y = 720
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'


def shoot(name, loc, target, lens=50):
    cam = sc.camera
    if cam is None:
        cd = bpy.data.cameras.new('cam')
        cam = bpy.data.objects.new('cam', cd)
        sc.collection.objects.link(cam)
        sc.camera = cam
    cam.data.lens = lens
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, f'pv_{name}.png')
    bpy.ops.render.render(write_still=True)


# ----------------------------------------------------------------------------- main
setup_materials()
body, CAGE = build_body_surface()
cut_arches(body)
BVH = body_bvh(body)
head, tail = lights(BVH)
flares = arch_flares(BVH)
canopy = build_canopy()
frame = canopy_frame(canopy)
liners = wheel_liners()
BELT = {sgn: (belt_moulding(BVH, -0.29, 0.85, sgn, 'BeltF'), belt_moulding(BVH, -1.1, -0.375, sgn, 'BeltR')) for sgn in (1, -1)}
PARTS = cut_panels(body)
handles = mirrors_and_handles(BVH, PARTS)
pocket = charge_pocket()
thicken(body, 0.03)
thicken(PARTS['DoorR'], 0.085)
thicken(PARTS['DoorL'], 0.085)
thicken(PARTS['ChargeFlap'], 0.006)
INTERIOR, STEER, STEER_META = ([], None, {}) if NO_INTERIOR else build_interior()
for side, sgn in (('R', -1), ('L', 1)):
    g = split_by_material(canopy, f'GlassDoor{side}', f'DoorGlass{side}')
    g.data.materials.clear()
    g.data.materials.append(MATS['GlassSide'])
    pieces = [PARTS[f'Door{side}'], g, PARTS[f'Mirror{side}'], front_handle(BVH, sgn), BELT[sgn][0]]
    if not NO_INTERIOR:
        pieces.append(door_trim(sgn, -0.26, 0.9, f'TrimFront{side}'))
    PARTS[f'Door{side}'] = join(pieces, f'Door{side}')
set_origin(PARTS['DoorR'], (0.93, -0.955, 0.7))
set_origin(PARTS['DoorL'], (0.93, 0.955, 0.7))
set_origin(PARTS['ChargeFlap'], (-1.665, 0.985, 0.8215))
WHEELS = build_wheels()

if PREVIEW:
    pw = place_preview_wheels(WHEELS, 'rimA' if '--aero' in argv else 'rimB')
    preview_setup()
    shoot('34front', (6.2, -4.6, 1.6), (0, 0, 0.7), 50)
    shoot('side', (0, -9.5, 0.85), (0, 0, 0.75), 60)
    shoot('34rear', (-6.0, -4.4, 1.9), (0, 0, 0.7), 50)
    shoot('front', (9, 0, 0.9), (0, 0, 0.75), 70)
    shoot('close', (3.6, -2.6, 1.0), (1.4, -0.6, 0.75), 45)
    if not NO_INTERIOR:
        for o in sc.objects:
            if o.name.startswith('Canopy') or o.name.startswith('Door'):
                o.hide_render = True
        shoot('cabin', EYE + Vector((0, 0, 0)), EYE + Vector((1, 0.25, -0.28)), 16)
        shoot('cabin2', (-0.2, -2.2, 1.9), (0.0, 0.0, 0.8), 24)
    print('PREVIEW DONE')


# ----------------------------------------------------------------------------- export
def T(v):
    """Blender (x, y, z) -> three.js (x, z, -y)."""
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def bake_shadow(path):
    sc.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception:
        pass
    sc.cycles.samples = 768
    world = bpy.data.worlds.new('ao')
    sc.world = world
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.001))
    pl = bpy.context.object
    pl.scale = (6.4, 3.2, 1)
    bpy.ops.object.transform_apply(scale=True)
    img = bpy.data.images.new('shadow', 512, 256, alpha=False)
    m = bpy.data.materials.new('shadowbake')
    m.use_nodes = True
    tn = m.node_tree.nodes.new('ShaderNodeTexImage')
    tn.image = img
    m.node_tree.nodes.active = tn
    pl.data.materials.append(m)
    sc.world.light_settings.distance = 1.2
    select_only(pl)
    bpy.ops.object.bake(type='AO', margin=2)
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.objects.remove(pl)


def export():
    # merge the static cabin into one node; keep interactive parts separate
    static = [o for o in INTERIOR if o and o.name in bpy.data.objects]
    screens_ = [o for o in static if o.name in ('ScreenMeter', 'ScreenCenter')]
    static = [o for o in static if o not in screens_]
    cabin = join(static, 'Cabin') if static else None
    ext = join([flares, handles, liners, pocket, BELT[1][1], BELT[-1][1]], 'Trim')
    keep = [body, canopy, frame, ext, head, tail, PARTS['DoorR'], PARTS['DoorL'], PARTS['ChargeFlap']] + screens_
    if cabin:
        keep.append(cabin)
    if STEER:
        keep.append(STEER)
    keep += WHEEL_PARTS
    # wheels sit at the origin; the viewer places four of each
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep:
        o.hide_render = False
        o.select_set(True)
    for o in keep:
        o.data.name = o.name
    tris = 0
    for o in keep:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    path = os.path.join(OUT, 'car.glb')
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format='GLB', export_apply=True,
                              export_yup=True, export_texcoords=True, export_normals=True,
                              export_materials='EXPORT', export_image_format='NONE',
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_draco_position_quantization=14, export_draco_normal_quantization=10,
                              export_draco_texcoord_quantization=12)
    meta = dict(
        eye=T(EYE), wheelbase=[AXLE_F, AXLE_R], wheelZ=WHEEL_Z, trackZ=TRACK_Y, tireR=TIRE_R,
        steering=dict(hub=T(STEER_META.get('hub', (0, 0, 0))), axis=T(STEER_META.get('axis', (0, 0, 1)))),
        doorR=T(PARTS['DoorR'].location), doorL=T(PARTS['DoorL'].location), flap=T(PARTS['ChargeFlap'].location),
        hot=dict(doorR=T((0.035, -0.965, 0.914)), doorL=T((0.035, 0.965, 0.914)),
                 head=T((2.27, -0.3, 0.665)), tail=T((-2.33, -0.5, 0.97)), flap=T((-1.7275, 0.99, 0.8215)),
                 wheel=T((AXLE_F, -1.0, WHEEL_Z))),
        tris=tris,
    )
    json.dump(meta, open(os.path.join(OUT, 'car.json'), 'w'), indent=1)
    print('EXPORTED', path, 'tris', tris, os.path.getsize(path))


if '--export' in argv:
    tmp = place_preview_wheels(WHEELS, 'rimB')
    for k in WHEELS:
        WHEELS[k].hide_render = False
        WHEELS[k].location = (0, 0, -5)   # out of the bake
    bake_shadow(os.path.join(OUT, 'shadow_ao.png'))
    for o in tmp:
        bpy.data.objects.remove(o)
    for k in WHEELS:
        WHEELS[k].location = (0, 0, 0)
    export()
