"""Tropical fish for the aquarium hero.
usage: blender -b --factory-startup -P fish.py -- <outdir>

Each species is lofted from side-view profiles (dorsal / ventral outline and
body width, measured against real fish), with fins built as ray fans between
a base line on the body and an outline. Everything shares one side-view
texture per species, painted here with numpy:
  <sp>_color.npy  RGBA  colour, alpha = fin opacity
  <sp>_mat.npy    RGBA  R height (scales, gill cover), G roughness, B metalness, A iridescence
  <sp>_eye.npy    RGBA  iris
Vertex colours carry what the swim shader needs:
  R  flex (0 at the body, 1 at a fin's edge)
  G  part: 0 body, .25 dorsal/anal, .5 caudal, .75 pectoral, 1 pelvic, .1 eye
  B  side of a paired fin (0 / 1), .5 on the midplane
UV0 is the side projection, UV1 is (ray coordinate, base->edge) on fins.
"""
import bpy, bmesh, sys, os, json, math
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), 'out', 'fish')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def pchip(pts, x):
    """Monotone cubic through (x, y) control points; no overshoot."""
    xk = np.array([p[0] for p in pts], float)
    yk = np.array([p[1] for p in pts], float)
    x = np.clip(np.asarray(x, float), xk[0], xk[-1])
    h = np.diff(xk)
    d = np.diff(yk) / h
    m = np.zeros_like(yk)
    for i in range(1, len(xk) - 1):
        if d[i - 1] * d[i] > 0:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    m[0], m[-1] = d[0], d[-1]
    i = np.clip(np.searchsorted(xk, x) - 1, 0, len(h) - 1)
    t = (x - xk[i]) / h[i]
    t2, t3 = t * t, t * t * t
    return ((2 * t3 - 3 * t2 + 1) * yk[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
            + (-2 * t3 + 3 * t2) * yk[i + 1] + (t3 - t2) * h[i] * m[i + 1])


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# --------------------------------------------------------------------------- species
# s runs from the snout (0) to the base of the tail (1); body length is 1 and
# the head points to +x, so x = 0.5 - s. Heights are fractions of that length.
SPECIES = {
    'neon': dict(
        top=[(0, 0), (.03, .03), (.08, .058), (.15, .082), (.3, .106), (.45, .12), (.56, .116), (.7, .09), (.85, .062), (1, .052)],
        bot=[(0, 0), (.03, .024), (.08, .048), (.15, .072), (.3, .098), (.45, .108), (.56, .1), (.7, .074), (.85, .054), (1, .046)],
        wid=[(0, 0), (.04, .03), (.12, .052), (.3, .064), (.5, .058), (.75, .038), (1, .02)],
        mid=[(0, .006), (.3, 0), (1, 0)],
        eye=dict(s=.105, y=.022, r=.046),
        scale=.03,
        fins=[
            dict(kind='dorsal', base=(.47, .58), edge=[(.47, 0), (.48, .07), (.5, .135), (.53, .15), (.57, .09), (.6, .03), (.6, 0)], rays=9),
            dict(kind='dorsal', base=(.79, .84), edge=[(.79, 0), (.805, .03), (.83, .032), (.848, 0)], rays=0),
            dict(kind='anal', base=(.57, .87), edge=[(.57, 0), (.585, .08), (.61, .11), (.68, .085), (.8, .05), (.88, .03), (.88, 0)], rays=16),
            dict(kind='caudal', edge=[(0, .052), (.12, .1), (.24, .145), (.3, .15), (.25, .06), (.16, .004), (.25, -.055), (.3, -.14), (.24, -.135), (.12, -.09), (0, -.046)], rays=19),
            dict(kind='pectoral', s=.25, y=-.03, axis=(.25, 1), dir=(-1, -.3, .6), len=.13, width=.045, rays=10),
            dict(kind='pelvic', s=.45, y=-.1, axis=(1, .15), dir=(-.7, -1, .35), len=.075, width=.03, rays=7),
        ],
    ),
    'rummy': dict(
        top=[(0, 0), (.03, .028), (.08, .055), (.15, .078), (.3, .1), (.45, .112), (.56, .108), (.7, .085), (.85, .058), (1, .048)],
        bot=[(0, 0), (.03, .022), (.08, .045), (.15, .066), (.3, .088), (.45, .096), (.56, .09), (.7, .068), (.85, .05), (1, .043)],
        wid=[(0, 0), (.04, .028), (.12, .05), (.3, .06), (.5, .055), (.75, .036), (1, .019)],
        mid=[(0, .004), (.3, 0), (1, 0)],
        eye=dict(s=.1, y=.02, r=.044),
        scale=.03,
        fins=[
            dict(kind='dorsal', base=(.46, .57), edge=[(.46, 0), (.47, .07), (.49, .13), (.52, .145), (.56, .085), (.59, .025), (.59, 0)], rays=9),
            dict(kind='dorsal', base=(.79, .84), edge=[(.79, 0), (.805, .028), (.83, .03), (.848, 0)], rays=0),
            dict(kind='anal', base=(.58, .87), edge=[(.58, 0), (.595, .07), (.62, .095), (.7, .075), (.82, .045), (.88, .028), (.88, 0)], rays=16),
            dict(kind='caudal', edge=[(0, .048), (.12, .1), (.25, .15), (.31, .155), (.26, .06), (.17, .004), (.26, -.058), (.31, -.15), (.25, -.145), (.12, -.092), (0, -.043)], rays=19),
            dict(kind='pectoral', s=.24, y=-.028, axis=(.25, 1), dir=(-1, -.3, .6), len=.12, width=.042, rays=10),
            dict(kind='pelvic', s=.45, y=-.09, axis=(1, .15), dir=(-.7, -1, .35), len=.07, width=.028, rays=7),
        ],
    ),
    'angel': dict(
        top=[(0, 0), (.03, .035), (.07, .062), (.12, .1), (.2, .175), (.3, .255), (.4, .3), (.5, .3), (.62, .25), (.76, .155), (.9, .095), (1, .082)],
        bot=[(0, 0), (.03, .028), (.07, .055), (.13, .105), (.22, .19), (.32, .26), (.42, .292), (.52, .28), (.64, .21), (.78, .125), (.9, .085), (1, .076)],
        wid=[(0, 0), (.05, .028), (.15, .055), (.35, .075), (.6, .06), (.85, .032), (1, .018)],
        mid=[(0, .02), (.15, .01), (.4, 0), (1, 0)],
        eye=dict(s=.14, y=.045, r=.052),
        scale=.022,
        fins=[
            dict(kind='dorsal', base=(.36, .9), edge=[(.36, 0), (.44, .2), (.53, .42), (.63, .66), (.74, .88), (.84, 1.02), (.9, 1.06), (.93, .96), (.93, .6), (.92, .25), (.91, .05), (.9, 0)], rays=24),
            dict(kind='anal', base=(.42, .9), edge=[(.42, 0), (.49, .17), (.57, .37), (.66, .58), (.76, .78), (.85, .92), (.9, .94), (.92, .78), (.92, .42), (.91, .1), (.9, 0)], rays=22),
            dict(kind='caudal', edge=[(0, .082), (.1, .14), (.24, .24), (.4, .38), (.36, .2), (.31, .08), (.29, 0), (.31, -.08), (.36, -.2), (.4, -.37), (.24, -.23), (.1, -.13), (0, -.076)], rays=17),
            dict(kind='pectoral', s=.3, y=-.02, axis=(.2, 1), dir=(-1, -.15, .55), len=.16, width=.055, rays=11),
            dict(kind='pelvic', s=.27, y=-.2, axis=(1, .1), dir=(-.45, -1, .12), len=.95, width=.022, rays=3, thread=True),
        ],
    ),
    'discus': dict(
        top=[(0, 0), (.02, .045), (.06, .11), (.12, .2), (.2, .29), (.32, .37), (.45, .4), (.6, .375), (.75, .3), (.88, .19), (.96, .115), (1, .095)],
        bot=[(0, 0), (.02, .038), (.06, .095), (.12, .185), (.22, .285), (.35, .36), (.48, .385), (.62, .355), (.76, .28), (.88, .18), (.96, .105), (1, .09)],
        wid=[(0, 0), (.05, .038), (.15, .068), (.4, .088), (.7, .068), (.9, .038), (1, .022)],
        mid=[(0, .045), (.1, .02), (.3, 0), (1, 0)],
        eye=dict(s=.12, y=.075, r=.05),
        scale=.016,
        fins=[
            dict(kind='dorsal', base=(.28, 1.0), edge=[(.28, 0), (.31, .07), (.38, .12), (.5, .15), (.64, .16), (.78, .155), (.9, .14), (.99, .11), (1.04, .06), (1.03, 0)], rays=36),
            dict(kind='anal', base=(.36, 1.0), edge=[(.36, 0), (.39, .07), (.46, .12), (.58, .145), (.72, .15), (.85, .14), (.96, .11), (1.03, .06), (1.02, 0)], rays=32),
            dict(kind='caudal', edge=[(0, .095), (.06, .13), (.15, .15), (.22, .12), (.25, .05), (.255, 0), (.25, -.05), (.22, -.12), (.15, -.145), (.06, -.125), (0, -.09)], rays=19),
            dict(kind='pectoral', s=.3, y=-.05, axis=(.2, 1), dir=(-1, -.1, .55), len=.13, width=.05, rays=11),
            dict(kind='pelvic', s=.3, y=-.3, axis=(1, .1), dir=(-.6, -1, .3), len=.1, width=.03, rays=5),
        ],
    ),
}


class Body:
    def __init__(self, sp):
        self.sp = sp

    def top(self, s): return pchip(self.sp['top'], s)
    def bot(self, s): return pchip(self.sp['bot'], s)
    def wid(self, s): return pchip(self.sp['wid'], s)
    def mid(self, s): return pchip(self.sp['mid'], s)


def loft(b, S=72, N=44):
    """Body surface: rings of a teardrop superellipse, closed at the snout."""
    verts, uvs1 = [], []
    ss = 0.5 - 0.5 * np.cos(np.linspace(0, math.pi, S))
    ss = ss ** 1.15
    for s in ss:
        t, bo, w, c = b.top(s), b.bot(s), b.wid(s), b.mid(s)
        # round the snout: the first samples keep a little volume
        for k in range(N):
            ph = 2 * math.pi * k / N
            sn, cs = math.sin(ph), math.cos(ph)
            p = 2.3
            yy = math.copysign(abs(sn) ** (2 / p), sn)
            zz = math.copysign(abs(cs) ** (2 / p), cs)
            h = t if sn >= 0 else bo
            # narrower towards the dorsal ridge, fuller in the belly
            ww = w * (1 - 0.38 * max(0, sn) ** 1.5)
            verts.append((0.5 - s, zz * ww, c + yy * h))
    faces = []
    for i in range(S - 1):
        for k in range(N):
            a = i * N + k
            b2 = i * N + (k + 1) % N
            faces.append((a, b2, b2 + N, a + N))
    # caps
    tip = len(verts)
    verts.append((0.5 + 0.002, 0, b.mid(0)))
    faces += [(tip, (k + 1) % N, k) for k in range(N)]
    tail = len(verts)
    verts.append((0.5 - 1 - 0.002, 0, b.mid(1)))
    base = (S - 1) * N
    faces += [(tail, base + k, base + (k + 1) % N) for k in range(N)]
    return verts, faces


def resample(poly, n):
    poly = np.array(poly, float)
    seg = np.linalg.norm(np.diff(poly, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, cum[-1], n)
    return np.stack([np.interp(t, cum, poly[:, i]) for i in range(poly.shape[1])], 1)


def fin_grid(base, edge, nu, nv, rays):
    """Quads between a base polyline and an outline, both resampled by length."""
    B = resample(base, nu)
    E = resample(edge, nu)
    verts, uv1, flex = [], [], []
    for j in range(nv):
        v = j / (nv - 1)
        for i in range(nu):
            u = i / (nu - 1)
            verts.append(tuple(B[i] + (E[i] - B[i]) * v))
            uv1.append((u * max(rays, 1), v))
            flex.append(v)
    faces = []
    for j in range(nv - 1):
        for i in range(nu - 1):
            a = j * nu + i
            faces.append((a, a + 1, a + nu + 1, a + nu))
    return verts, faces, uv1, flex


def midplane_fin(b, f):
    kind = f['kind']
    if kind == 'caudal':
        c1 = b.mid(1)
        base = [(-0.5, 0, c1 + b.top(1) * 0.92), (-0.5, 0, c1 - b.bot(1) * 0.92)]
        base = [base[0], ((base[0][0] + base[1][0]) / 2 + 0.004, 0, c1), base[1]]
        edge = [(-0.5 - dx, 0, c1 + y) for dx, y in f['edge']]
        return fin_grid(base, edge, 40, 12, f['rays'])
    s0, s1 = f['base']
    sgn = 1 if kind == 'dorsal' else -1
    prof = b.top if kind == 'dorsal' else b.bot
    base = []
    for s in np.linspace(s0, s1, 24):
        sc = min(s, 1.0)
        base.append((0.5 - s, 0, b.mid(sc) + sgn * prof(sc) * 0.93))
    edge = []
    for s, h in f['edge']:
        sc = min(s, 1.0)
        edge.append((0.5 - s, 0, b.mid(sc) + sgn * (prof(sc) * 0.93 + h)))
    n = 46 if f['rays'] > 20 else 30
    return fin_grid(base, edge, n, 12 if f['rays'] else 5, f['rays'])


def paired_fin(b, f, side):
    s, y = f['s'], f['y']
    w = b.wid(s) * 0.92
    o = np.array([0.5 - s, side * w, b.mid(s) + y])
    ax = np.array([f['axis'][0], 0, f['axis'][1]], float)
    ax /= np.linalg.norm(ax)
    d = np.array([f['dir'][0], side * f['dir'][2], f['dir'][1]], float)
    d /= np.linalg.norm(d)
    L, W = f['len'], f['width']
    if f.get('thread'):
        base = [o - ax * W * 0.5, o + ax * W * 0.5]
        edge = [o - ax * W * 0.1 + d * L, o + d * L * 1.02]
        vs, fs, uv1, flex = fin_grid(base, edge, 4, 24, f['rays'])
        return vs, fs, uv1, flex
    base = [o + ax * W * 0.5, o - ax * W * 0.5]
    # a rounded paddle: rays fan out from the short base
    edge = []
    for a in np.linspace(0, 1, 9):
        ang = (a - 0.5) * 1.5
        reach = L * (0.7 + 0.3 * math.cos(ang * 1.2))
        spread = ax * (0.5 - a) * W * 2.4
        edge.append(o + spread + d * reach)
    return fin_grid(base, edge, 18, 10, f['rays'])


def build(name, sp):
    b = Body(sp)
    V, F, UV1, COL, MAT = [], [], [], [], []

    def add(vs, fs, uv1, cols, mat):
        off = len(V)
        V.extend(vs)
        UV1.extend(uv1)
        COL.extend(cols)
        for f in fs:
            F.append(tuple(off + i for i in f))
            MAT.append(mat)

    vs, fs = loft(b)
    add(vs, fs, [(0, 0)] * len(vs), [(0, 0, .5)] * len(vs), 0)
    for f in sp['fins']:
        if f['kind'] in ('pectoral', 'pelvic'):
            code = .75 if f['kind'] == 'pectoral' else 1.0
            for side in (-1, 1):
                vs, fs, uv1, flex = paired_fin(b, f, side)
                add(vs, fs, uv1, [(fl, code, (side + 1) / 2) for fl in flex], 1)
        else:
            code = .5 if f['kind'] == 'caudal' else .25
            vs, fs, uv1, flex = midplane_fin(b, f)
            add(vs, fs, uv1, [(fl, code, .5) for fl in flex], 1)

    # eyes: flattened spheres set into the head, pupil facing outward
    e = sp['eye']
    for side in (-1, 1):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=e['r'])
        cx, cz = 0.5 - e['s'], b.mid(e['s']) + e['y']
        cy = side * b.wid(e['s']) * 0.52
        vs, uvs = [], []
        for v in bm.verts:
            x, yy, z = v.co
            vs.append((cx + x, cy + yy * 0.52, cz + z))
        fs = [tuple(v.index for v in f.verts) for f in bm.faces]
        uv1 = [(0.5 + v.co.x / (2 * e['r']), 0.5 + v.co.z / (2 * e['r']) * side) for v in bm.verts]
        # outward-facing hemisphere carries the iris
        add(vs, fs, uv1, [(0, .1, (side + 1) / 2)] * len(vs), 2)
        bm.free()

    xs = np.array(V)
    bbox = [float(xs[:, 0].min()), float(xs[:, 0].max()), float(xs[:, 2].min()), float(xs[:, 2].max())]
    me = bpy.data.meshes.new(name)
    me.from_pydata(V, [], F)
    me.validate()
    for mname in ('body', 'fin', 'eye'):
        m = bpy.data.materials.get(mname) or bpy.data.materials.new(mname)
        me.materials.append(m)
    me.polygons.foreach_set('material_index', MAT)
    me.shade_smooth()
    uv0 = me.uv_layers.new(name='UVMap')
    uvl1 = me.uv_layers.new(name='UVFin')
    ca = me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='CORNER')
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            x, _, z = V[vi]
            uv0.data[li].uv = ((x - bbox[0]) / (bbox[1] - bbox[0]), (z - bbox[2]) / (bbox[3] - bbox[2]))
            uvl1.data[li].uv = UV1[vi]
            r, g, bb = COL[vi]
            ca.data[li].color = (r, g, bb, 1)
    me.color_attributes.active_color = ca
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob, b, bbox


# --------------------------------------------------------------------------- painting
def scales(X, Y, a):
    """Overlapping cycloid scales: anterior scales lie over posterior ones,
    so each texel shows the most anterior scale that covers it."""
    b = a * 0.62
    r = a * 0.9
    col = np.floor(-X / a)
    best = np.full(X.shape, np.inf)
    h = np.zeros(X.shape)
    for dc in (-1, 0, 1, 2):
        c = col + dc
        off = (np.mod(c, 2)) * b * 0.5
        row = np.floor((Y - off) / b)
        for dr in (-1, 0, 1):
            rr = row + dr
            jit = np.sin(c * 12.9898 + rr * 78.233) * 43758.5453
            jit = jit - np.floor(jit)
            cx = -(c + 0.5) * a + (jit - 0.5) * a * 0.18
            cy = (rr + 0.5) * b + off + (jit - 0.5) * b * 0.2
            d = np.hypot((X - cx) * 1.0, (Y - cy) * 1.15)
            cover = (d < r) & (c < best)
            h = np.where(cover, d / r, h)
            best = np.where(cover, c, best)
    return np.clip(h, 0, 1) ** 1.6


def noise2(X, Y, f, seed):
    """Cheap value noise: bilinear over a random lattice."""
    g = np.random.default_rng(seed).random((256, 256))
    x, y = X * f, Y * f
    xi, yi = np.floor(x).astype(int), np.floor(y).astype(int)
    xf, yf = x - xi, y - yi
    xf, yf = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    def at(i, j): return g[i % 256, j % 256]
    return (at(xi, yi) * (1 - xf) * (1 - yf) + at(xi + 1, yi) * xf * (1 - yf)
            + at(xi, yi + 1) * (1 - xf) * yf + at(xi + 1, yi + 1) * xf * yf)


def fbm(X, Y, f, seed, o=4):
    t, a, n = 0, 0.5, 0
    for i in range(o):
        t += a * noise2(X, Y, f * 2 ** i, seed + i)
        n += a
        a *= 0.5
    return t / n


def mix(a, b, t):
    t = np.asarray(t)[..., None] if np.ndim(t) else t
    return a + (np.asarray(b) - a) * t


def paint(name, sp, b, bbox, res):
    W, H = res
    xs = np.linspace(bbox[0], bbox[1], W)
    ys = np.linspace(bbox[2], bbox[3], H)
    X, Y = np.meshgrid(xs, ys)
    s = 0.5 - X
    sc = np.clip(s, 0, 1)
    top, bot, c = b.top(sc), b.bot(sc), b.mid(sc)
    yr = Y - c
    inside = (s >= 0) & (s <= 1) & (yr <= top) & (yr >= -bot)
    yn = np.clip((yr + bot) / np.maximum(top + bot, 1e-4), 0, 1)
    col = np.zeros((H, W, 3))
    alpha = np.ones((H, W))
    rough = np.full((H, W), 0.35)
    metal = np.zeros((H, W))
    irid = np.zeros((H, W))
    n1 = fbm(X, Y, 40, 1)
    n2 = fbm(X, Y, 160, 5)

    if name in ('neon', 'rummy'):
        back = np.array([.34, .3, .2]) * (0.75 + 0.5 * n2)[..., None]
        silver = np.array([.56, .6, .58]) if name == 'neon' else np.array([.6, .66, .6])
        belly = np.array([.8, .8, .76])
        col = mix(silver, back, smooth(.62, .82, yn))
        col = mix(col, belly, smooth(.35, .05, yn) * 0.8)
        metal = 0.55 * smooth(.85, .5, yn)
        alpha = np.where(inside, 1.0, 0.16)
        rough = 0.3 + 0.2 * smooth(.7, .9, yn)
        # melanophores on the back
        spots = (fbm(X, Y, 220, 9) > 0.62) & (yn > 0.7)
        col = np.where(spots[..., None], col * 0.45, col)
        if name == 'neon':
            # the electric stripe, eye to adipose fin
            band = smooth(.46, .53, yn) * smooth(.78, .69, yn)
            band *= smooth(.07, .15, s) * smooth(.86, .76, s)
            col = mix(col, np.array([.06, .5, .88]), band)
            irid = band
            metal = np.maximum(metal, band * 0.85)
            rough = mix(rough[..., None], [0.15], band)[..., 0]
            red = smooth(.5, .42, yn) * smooth(.36, .48, s) * smooth(1.08, .97, s)
            col = mix(col, np.array([.88, .05, .06]), red)
            metal = metal * (1 - red)
            rough = mix(rough[..., None], [0.4], red)[..., 0]
        else:
            # the red nose, bleeding into the gill cover
            red = smooth(.3, .17, s + (yn - .5) * 0.06)
            col = mix(col, np.array([.92, .08, .08]) * (0.85 + 0.3 * n1)[..., None], red)
            metal = metal * (1 - red * 0.8)
            # the tail flag: black and white bars
            t = -(X + 0.5)
            ycb = (Y - b.mid(1)) / 0.15
            lobe = np.abs(ycb)
            black = (lobe < 0.18) | ((lobe > 0.42) & (lobe < 0.62) & (t > 0.08))
            white = ~black & (lobe < 0.95)
            tail = (s > 1.0)
            col = np.where((tail & black)[..., None], np.array([.03, .03, .035]), col)
            col = np.where((tail & white)[..., None], np.array([.93, .93, .9]), col)
            alpha = np.where(tail & ~inside, np.where(black | white, 0.9, 0.3), alpha)
        eye_col = ('silverblue' if name == 'neon' else 'red')

    elif name == 'angel':
        silver = np.array([.8, .8, .77])
        col = mix(silver, np.array([.6, .55, .38]), smooth(.75, .98, yn) * 0.7)
        col = col * (0.9 + 0.2 * n1)[..., None]
        metal = np.full((H, W), 0.7)
        rough = np.full((H, W), 0.28)
        # the vertical bars, carried on into the fins
        def bar(s0, w, slant=0.0, soft=0.012):
            ss = s - (Y - 0.0) * slant
            return smooth(w / 2 + soft, w / 2 - soft, np.abs(ss - s0))
        bars = np.maximum.reduce([
            bar(.15, .05, -0.05),
            bar(.47, .08, 0.12) * (1 - 0.15 * n2),
            bar(.86, .06, 0.35),
            bar(.66, .03, 0.2) * 0.35,
        ])
        col = mix(col, np.array([.035, .035, .04]), bars)
        metal = metal * (1 - bars)
        rough = rough + bars * 0.25
        alpha = np.where(inside, 1.0, 0.16 + 0.55 * bars)
        # pale edges on the long fins
        eye_col = 'red'

    elif name == 'discus':
        base = mix(np.array([.66, .24, .08]), np.array([.42, .12, .05]), smooth(.5, .95, yn))
        base = base * (0.85 + 0.3 * n1)[..., None]
        # a labyrinth of turquoise lines: roughly horizontal on the body,
        # domain-warped so they branch, pinch and break like the real thing
        wy = Y + 0.035 * (fbm(X, Y, 7, 11) - 0.5) + 0.02 * np.sin(X * 22)
        wx = X + 0.04 * (fbm(X, Y, 9, 12) - 0.5)
        body_lines = np.sin(wy * 88 + 2.6 * fbm(wx, Y, 5, 13))
        head_lines = np.sin((wx * 0.8 + wy * 0.6) * 90 + 3 * fbm(X, Y, 6, 14))
        head = smooth(.24, .1, s)
        wave = body_lines * (1 - head) + head_lines * head
        thick = 0.05 + 0.5 * fbm(X, Y, 11, 15)
        lines = smooth(thick, thick + 0.22, wave)
        lines *= smooth(0.02, 0.06, s)
        turq = mix(np.array([.1, .66, .7]), np.array([.12, .42, .78]), fbm(X, Y, 5, 16))
        col = mix(base, turq, lines)
        irid = lines * 0.55
        metal = lines * 0.25
        rough = 0.38 - lines * 0.1
        # nine faint vertical bars
        vb = smooth(.4, 1.0, np.cos((s * 9.5 + 0.3) * 2 * math.pi)) * smooth(.05, .2, s)
        col = col * (1 - 0.35 * vb)[..., None]
        head = smooth(.16, .05, s)
        col = mix(col, np.array([.55, .18, .1]), head * 0.6)
        alpha = np.where(inside, 1.0, 0.92)
        eye_col = 'red'

    # surface relief: scales, the gill cover, the lateral line
    h = scales(X, Y, sp['scale']) * inside
    oper = np.hypot((X - (0.5 - 0.1)) * 1.0, (Y - c) * 0.8)
    orad = 0.13 if name in ('neon', 'rummy') else 0.18 if name == 'angel' else 0.2
    ridge = smooth(0.012, 0.0, np.abs(oper - orad)) * (X > 0.5 - 0.3) * inside
    head = smooth(orad + 0.01, orad - 0.02, oper) * inside
    h = np.where(head > 0.5, 0.35 + 0.1 * n2, h)  # the head has no scales
    h = h + ridge * 0.9
    lat = smooth(0.006, 0.0, np.abs(yn - 0.62)) * inside * (s > 0.22) * (s < 0.85)
    h = h - lat * 0.5
    # gill cover darkens its trailing edge
    col = col * (1 - 0.25 * ridge)[..., None]
    rough = np.where(inside, rough, 0.2)

    colour = np.concatenate([np.clip(col, 0, 1), alpha[..., None]], -1)
    mat = np.stack([np.clip(h * 0.8 + 0.1, 0, 1), np.clip(rough, 0.05, 1), np.clip(metal, 0, 1), np.clip(irid, 0, 1)], -1)
    np.save(os.path.join(OUT, f'{name}_color.npy'), colour[::-1].astype(np.float32))
    np.save(os.path.join(OUT, f'{name}_mat.npy'), mat[::-1].astype(np.float32))

    # iris
    E = 128
    u = np.linspace(-1, 1, E)
    U, Vv = np.meshgrid(u, u)
    r = np.hypot(U, Vv)
    iris = {'silverblue': [.75, .78, .8], 'red': [.78, .12, .08]}[eye_col]
    fib = 0.8 + 0.2 * np.cos(np.arctan2(Vv, U) * 46 + fbm(U, Vv, 3, 21) * 6)
    ring = np.array(iris) * fib[..., None]
    ring = ring * (0.55 + 0.45 * smooth(0.95, 0.62, r))[..., None]
    if eye_col == 'silverblue':
        ring = mix(ring, np.array([.08, .5, .8]), smooth(.15, .75, Vv) * 0.85)
    e = mix(ring, np.array([.012, .012, .016]), smooth(.58, .52, r))
    e = mix(e, np.array([.05, .05, .06]), smooth(.88, 1.0, r))
    eye = np.concatenate([e, np.ones((E, E, 1))], -1)
    np.save(os.path.join(OUT, f'{name}_eye.npy'), eye[::-1].astype(np.float32))


# --------------------------------------------------------------------------- main
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
meta = {}
RES = {'neon': (1024, 384), 'rummy': (1024, 384), 'angel': (1024, 1024), 'discus': (1024, 1024)}
for name, sp in SPECIES.items():
    ob, b, bbox = build(name, sp)
    paint(name, sp, b, bbox, RES[name])
    meta[name] = dict(bbox=bbox)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    kw = dict(filepath=os.path.join(OUT, f'{name}.glb'), use_selection=True, export_format='GLB',
              export_materials='EXPORT', export_normals=True, export_texcoords=True, export_apply=True,
              export_draco_mesh_compression_enable=True, export_draco_texcoord_quantization=14)
    for k, v in (('export_vertex_color', 'ACTIVE'), ('export_all_vertex_colors', True), ('export_colors', True)):
        try:
            bpy.ops.export_scene.gltf(**kw, **{k: v})
            break
        except TypeError:
            continue
    print('exported', name, len(ob.data.vertices))
json.dump(meta, open(os.path.join(OUT, 'fish.json'), 'w'), indent=1)
print('DONE')
