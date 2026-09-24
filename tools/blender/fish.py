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
        wid=[(0, 0), (.04, .03), (.12, .048), (.3, .054), (.5, .048), (.75, .03), (.92, .016), (1, .014)],
        mid=[(0, .006), (.3, 0), (1, 0)],
        eye=dict(s=.14, y=.024, r=.039),
        scale=.03,
        fins=[
            dict(kind='dorsal', base=(.47, .58), edge=[(.47, 0), (.48, .07), (.5, .135), (.53, .15), (.57, .09), (.6, .03), (.6, 0)], rays=9),
            dict(kind='dorsal', base=(.79, .84), edge=[(.79, 0), (.805, .03), (.83, .032), (.848, 0)], rays=0),
            dict(kind='anal', base=(.57, .87), edge=[(.57, 0), (.585, .08), (.61, .11), (.68, .085), (.8, .05), (.88, .03), (.88, 0)], rays=16),
            dict(kind='caudal', edge=[(0, .052), (.1, .1), (.2, .145), (.3, .17), (.24, .09), (.15, .025), (.13, 0), (.15, -.025), (.24, -.085), (.3, -.16), (.2, -.14), (.1, -.095), (0, -.046)], rays=19),
            dict(kind='pectoral', s=.25, y=-.03, axis=(.25, 1), dir=(-1, -.3, .6), len=.13, width=.045, rays=10),
            dict(kind='pelvic', s=.45, y=-.1, axis=(1, .15), dir=(-.7, -1, .35), len=.075, width=.03, rays=7),
        ],
    ),
    'rummy': dict(
        top=[(0, 0), (.03, .028), (.08, .055), (.15, .078), (.3, .1), (.45, .112), (.56, .108), (.7, .085), (.85, .058), (1, .048)],
        bot=[(0, 0), (.03, .022), (.08, .045), (.15, .066), (.3, .088), (.45, .096), (.56, .09), (.7, .068), (.85, .05), (1, .043)],
        wid=[(0, 0), (.04, .028), (.12, .046), (.3, .052), (.5, .046), (.75, .029), (.92, .015), (1, .013)],
        mid=[(0, .004), (.3, 0), (1, 0)],
        eye=dict(s=.135, y=.022, r=.037),
        scale=.03,
        fins=[
            dict(kind='dorsal', base=(.46, .57), edge=[(.46, 0), (.47, .07), (.49, .13), (.52, .145), (.56, .085), (.59, .025), (.59, 0)], rays=9),
            dict(kind='dorsal', base=(.79, .84), edge=[(.79, 0), (.805, .028), (.83, .03), (.848, 0)], rays=0),
            dict(kind='anal', base=(.58, .87), edge=[(.58, 0), (.595, .07), (.62, .095), (.7, .075), (.82, .045), (.88, .028), (.88, 0)], rays=16),
            dict(kind='caudal', edge=[(0, .048), (.1, .1), (.21, .15), (.32, .175), (.25, .09), (.16, .025), (.14, 0), (.16, -.025), (.25, -.085), (.32, -.165), (.21, -.145), (.1, -.095), (0, -.043)], rays=19),
            dict(kind='pectoral', s=.24, y=-.028, axis=(.25, 1), dir=(-1, -.3, .6), len=.12, width=.042, rays=10),
            dict(kind='pelvic', s=.45, y=-.09, axis=(1, .15), dir=(-.7, -1, .35), len=.07, width=.028, rays=7),
        ],
    ),
    'angel': dict(
        top=[(0, 0), (.03, .04), (.07, .075), (.12, .13), (.2, .24), (.3, .34), (.4, .4), (.5, .41), (.6, .37), (.72, .27), (.84, .16), (.93, .1), (1, .085)],
        bot=[(0, 0), (.03, .03), (.07, .065), (.13, .13), (.22, .24), (.32, .33), (.42, .375), (.52, .37), (.64, .3), (.76, .19), (.88, .11), (1, .08)],
        wid=[(0, 0), (.05, .028), (.15, .055), (.35, .075), (.6, .06), (.85, .032), (1, .018)],
        mid=[(0, .02), (.15, .01), (.4, 0), (1, 0)],
        eye=dict(s=.17, y=.075, r=.047),
        scale=.015,
        fins=[
            dict(kind='dorsal', base=(.34, .9), edge=[(.34, 0), (.42, .15), (.52, .33), (.62, .52), (.72, .7), (.82, .82), (.88, .86), (.92, .78), (.92, .45), (.91, .15), (.9, 0)], rays=24),
            dict(kind='anal', base=(.4, .9), edge=[(.4, 0), (.48, .13), (.57, .3), (.66, .47), (.76, .63), (.85, .73), (.9, .75), (.92, .62), (.92, .33), (.91, .08), (.9, 0)], rays=22),
            dict(kind='caudal', edge=[(0, .082), (.1, .14), (.24, .24), (.4, .38), (.36, .2), (.31, .08), (.29, 0), (.31, -.08), (.36, -.2), (.4, -.37), (.24, -.23), (.1, -.13), (0, -.076)], rays=17),
            dict(kind='pectoral', s=.3, y=-.02, axis=(.2, 1), dir=(-1, -.15, .55), len=.16, width=.055, rays=11),
            dict(kind='pelvic', s=.3, y=-.3, axis=(1, .1), dir=(-.45, -1, .12), len=.85, width=.022, rays=3, thread=True),
        ],
    ),
    'discus': dict(
        top=[(0, 0), (.02, .045), (.06, .11), (.12, .2), (.2, .29), (.32, .37), (.45, .4), (.6, .375), (.75, .3), (.88, .19), (.96, .115), (1, .095)],
        bot=[(0, 0), (.02, .038), (.06, .095), (.12, .185), (.22, .285), (.35, .36), (.48, .385), (.62, .355), (.76, .28), (.88, .18), (.96, .105), (1, .09)],
        wid=[(0, 0), (.05, .045), (.15, .08), (.4, .105), (.7, .08), (.9, .042), (1, .022)],
        mid=[(0, .045), (.1, .02), (.3, 0), (1, 0)],
        eye=dict(s=.155, y=.08, r=.043),
        scale=.012,
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


OPER = {'neon': .1, 'rummy': .1, 'angel': .13, 'discus': .15}
MOUTH = {'neon': .6, 'rummy': .58, 'angel': .62, 'discus': .6}


def section(b, sp, name, s, ph):
    """One point of the body's cross-section at length s and ring angle ph.
    Returns (lateral, vertical) in body units. The section is rounder at the
    head, flatter mid-body, fuller in the belly and narrow at the ridge; the
    gill cover stands slightly proud of the flank and the mouth is a groove."""
    # the snout is a rounded cap, not a cone: inside the first few percent the
    # section keeps its shape and shrinks along an ellipse
    S0 = 0.05
    if s < S0:
        k = math.sqrt(max(0.0, 1 - ((S0 - s) / S0) ** 2))
        t, bo, w, c = b.top(S0) * k, b.bot(S0) * k, b.wid(S0) * k, b.mid(S0)
    else:
        t, bo, w, c = b.top(s), b.bot(s), b.wid(s), b.mid(s)
    sn, cs = math.sin(ph), math.cos(ph)
    p = 2.0 + 0.5 * math.sin(min(s, 1.0) * math.pi) ** 0.7
    yy = math.copysign(abs(sn) ** (2 / p), sn)
    zz = math.copysign(abs(cs) ** (2 / p), cs)
    h = t if sn >= 0 else bo
    ww = w * (1 - 0.45 * max(0, sn) ** 1.3) * (1 + 0.08 * max(0, -sn))
    y = c + yy * h
    yn = (yy * h + bo) / max(t + bo, 1e-5)
    # head plates: everything inside the gill arc sits a touch higher
    e = sp['eye']
    ex = e['s']
    d = math.hypot(s - ex, (y - c - e['y'] * 0.5) * 0.75)
    ww *= 1 + 0.07 * smooth(OPER[name] + 0.004, OPER[name] - 0.012, d)
    # the orbit: skin rises round the eye so the eye sits in the head, not on it
    de = math.hypot(s - ex, y - (c + e['y'])) / e['r']
    side_w = abs(cs)
    ww += e['r'] * 0.42 * math.exp(-(de / 1.25) ** 2) * side_w ** 0.5 if abs(cs) > 1e-6 else 0.0
    # the mouth: a cleft across the snout, lips either side
    m = MOUTH[name]
    snout = float(smooth(0.1, 0.0, s))
    ww *= 1 - 0.45 * snout * math.exp(-((yn - m) / 0.04) ** 2) + 0.12 * snout * math.exp(-((abs(yn - m) - 0.09) / 0.04) ** 2)
    return zz * ww, y, yn


def loft(b, sp, name, S=96, N=64):
    """Body surface: rings of varying cross-section, closed at both ends."""
    verts, uvs1 = [], []
    ss = 0.5 - 0.5 * np.cos(np.linspace(0, math.pi, S))
    ss = ss ** 1.15
    for s in ss:
        s = max(float(s), 0.004)
        for k in range(N):
            ph = 2 * math.pi * k / N
            lat, y, yn = section(b, sp, name, float(s), ph)
            verts.append((0.5 - s, lat, y))
            uvs1.append((s, yn))
    faces = []
    for i in range(S - 1):
        for k in range(N):
            a = i * N + k
            b2 = i * N + (k + 1) % N
            faces.append((a, b2, b2 + N, a + N))
    tip = len(verts)
    verts.append((0.5 - 0.001, 0, b.mid(0.05)))
    faces += [(tip, (k + 1) % N, k) for k in range(N)]
    tail = len(verts)
    verts.append((0.5 - 1 - 0.002, 0, b.mid(1)))
    uvs1 += [(0.0, 0.5), (1.0, 0.5)]
    base = (S - 1) * N
    faces += [(tail, base + k, base + (k + 1) % N) for k in range(N)]
    return verts, faces, uvs1


def eye_parts(b, sp, name, side):
    """An eye as it's built: a flat iris set just under the skin line, and a
    clear cornea bulging over it. Nothing reaches into the head, so the far
    eye never shows through."""
    e = sp['eye']
    es, r = e['s'], e['r']
    # find the flank at the eye's height by walking the ring
    best, lat = 9, 0.0
    for k in range(720):
        ph = math.pi * (k / 720 - 0.5)
        l, y, _ = section(b, sp, name, es, ph)
        dd = abs(y - (b.mid(es) + e['y']))
        if dd < best:
            best, lat = dd, l
    n = np.array([0.2, side * 1.0, 0.08])
    n /= np.linalg.norm(n)
    t1 = np.cross([0, 0, 1], n)
    t1 /= np.linalg.norm(t1)
    t2 = np.cross(n, t1)
    P = np.array([0.5 - es, side * lat, b.mid(es) + e['y']])
    # iris: a disc slightly sunk below the surface
    C = P - n * r * 0.04
    iv, iuv, ifs = [tuple(C + n * r * 0.16)], [(0.5, 0.5)], []
    R, A = 6, 32
    for ri in range(1, R + 1):
        for a in range(A):
            ang = 2 * math.pi * a / A
            f = ri / R
            q = C + (t1 * math.cos(ang) + t2 * math.sin(ang)) * r * f + n * r * 0.16 * (1 - f * f)
            iv.append(tuple(q))
            iuv.append((0.5 + math.cos(ang) * ri / R * 0.5, 0.5 + math.sin(ang) * ri / R * 0.5))
    for a in range(A):
        ifs.append((0, 1 + a, 1 + (a + 1) % A))
    for ri in range(1, R):
        for a in range(A):
            o0, o1 = 1 + (ri - 1) * A, 1 + ri * A
            quad = (o0 + a, o1 + a, o1 + (a + 1) % A, o0 + (a + 1) % A)
            ifs.append(quad)
    # cornea: a spherical cap, base at the skin, rising ~0.3 r
    cap = math.radians(40)
    Rc = r * 1.02 / math.sin(cap)
    B = P - n * r * 0.04
    O = B - n * Rc * math.cos(cap)
    cv, cuv, cfs = [], [], []
    rows = 8
    cv.append(tuple(O + n * Rc))
    cuv.append((0.5, 0.5))
    for ri in range(1, rows + 1):
        al = cap * ri / rows
        for a in range(A):
            ang = 2 * math.pi * a / A
            q = O + Rc * (n * math.cos(al) + (t1 * math.cos(ang) + t2 * math.sin(ang)) * math.sin(al))
            cv.append(tuple(q))
            cuv.append((0.5 + math.cos(ang) * ri / rows * 0.5, 0.5 + math.sin(ang) * ri / rows * 0.5))
    for a in range(A):
        cfs.append((0, 1 + a, 1 + (a + 1) % A))
    for ri in range(1, rows):
        for a in range(A):
            o0, o1 = 1 + (ri - 1) * A, 1 + ri * A
            quad = (o0 + a, o1 + a, o1 + (a + 1) % A, o0 + (a + 1) % A)
            cfs.append(quad)
    return (iv, ifs, iuv), (cv, cfs, cuv)


def resample(poly, n):
    poly = np.array(poly, float)
    seg = np.linalg.norm(np.diff(poly, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, cum[-1], n)
    return np.stack([np.interp(t, cum, poly[:, i]) for i in range(poly.shape[1])], 1)


def fin_grid(base, edge, nu, nv, rays, normal=(0, 1, 0), pleat=0.0):
    """Quads between a base polyline and an outline, both resampled by length.
    The membrane is pleated between the rays, as real fins are."""
    B = resample(base, nu)
    E = resample(edge, nu)
    nrm = np.array(normal, float)
    verts, uv1, flex = [], [], []
    for j in range(nv):
        v = j / (nv - 1)
        for i in range(nu):
            u = i / (nu - 1)
            fold = math.sin(u * max(rays, 1) * 2 * math.pi) * pleat * v ** 0.7
            verts.append(tuple(B[i] + (E[i] - B[i]) * v + nrm * fold))
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
        return fin_grid(base, edge, 64, 14, f['rays'], pleat=0.0035)
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
    n = 70 if f['rays'] > 20 else 44
    return fin_grid(base, edge, n, 14 if f['rays'] else 5, f['rays'], pleat=0.003 if f['rays'] else 0.0)


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
    return fin_grid(base, edge, 24, 10, f['rays'], normal=np.cross(ax, d), pleat=0.0025)


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

    vs, fs, uv1 = loft(b, sp, name)
    add(vs, fs, uv1, [(0, 0, .5)] * len(vs), 0)
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

    for side in (-1, 1):
        (iv, ifs, iuv), (cv, cfs, cuv) = eye_parts(b, sp, name, side)
        add(iv, ifs, iuv, [(0, .1, (side + 1) / 2)] * len(iv), 2)
        add(cv, cfs, cuv, [(0, .1, (side + 1) / 2)] * len(cv), 3)

    xs = np.array(V)
    bbox = [float(xs[:, 0].min()), float(xs[:, 0].max()), float(xs[:, 2].min()), float(xs[:, 2].max())]
    me = bpy.data.meshes.new(name)
    me.from_pydata(V, [], F)
    me.validate()
    for mname in ('body', 'fin', 'eye', 'cornea'):
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
    so each texel shows the most anterior scale that covers it. Returns the
    relief and a per-scale random value (for scale-to-scale sparkle)."""
    b = a * 0.62
    r = a * 0.9
    col = np.floor(-X / a)
    best = np.full(X.shape, np.inf)
    h = np.zeros(X.shape)
    cell = np.zeros(X.shape)
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
            cell = np.where(cover, jit, cell)
            best = np.where(cover, c, best)
    return np.clip(h, 0, 1) ** 1.6, cell


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


def fb(X, Y, fx, fy, seed, o=4):
    """fbm with separate x / y frequencies (stretched noise)."""
    return fbm(X * fx, Y * fy, 1.0, seed, o)


IRIS = {
    # pupil ring, iris lower, iris upper
    'neon': ([.85, .8, .6], [.7, .72, .72], [.2, .55, .85]),
    'rummy': ([.9, .7, .45], [.72, .5, .45], [.85, .12, .1]),
    'angel': ([.9, .7, .4], [.72, .2, .12], [.78, .16, .08]),
    'discus': ([.95, .6, .25], [.78, .16, .06], [.85, .12, .05]),
}


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
    n1 = fbm(X, Y, 40, 1)
    n2 = fbm(X, Y, 160, 5)
    rough = np.full((H, W), 0.35)
    metal = np.zeros((H, W))
    irid = np.zeros((H, W))
    C = lambda *v: np.array(v, float)

    if name in ('neon', 'rummy'):
        back = C(.34, .3, .2) * (0.75 + 0.5 * n2)[..., None]
        silver = C(.56, .6, .58) if name == 'neon' else C(.62, .68, .6)
        belly = C(.82, .82, .78)
        col = mix(silver, back, smooth(.62, .84, yn))
        col = mix(col, belly, smooth(.36, .06, yn) * 0.8)
        metal = 0.55 * smooth(.85, .5, yn)
        rough = 0.3 + 0.2 * smooth(.7, .9, yn)
        dots = smooth(0.55, 0.7, fbm(X, Y, 420, 9, o=2)) * smooth(0.66, 0.8, yn)
        col = col * (1 - 0.5 * dots)[..., None]
        # the head is thin and glassy: gill and eye socket show through
        glass = smooth(.24, .1, s) * smooth(.2, .45, yn)
        col = mix(col, C(.7, .66, .52), glass * 0.6)
        if name == 'neon':
            band = smooth(.46, .53, yn) * smooth(.78, .69, yn)
            band *= smooth(.07, .15, s) * smooth(.86, .76, s)
            # the stripe is made of tiny iridophores: it sparkles
            sparkle = 0.85 + 0.3 * fbm(X, Y, 300, 17)
            col = mix(col, C(.06, .5, .88) * sparkle[..., None], band)
            irid = band
            metal = np.maximum(metal, band * 0.85)
            rough = mix(rough[..., None], [0.15], band)[..., 0]
            red = smooth(.5, .42, yn) * smooth(.36, .48, s) * smooth(1.08, .97, s)
            col = mix(col, C(.66, .05, .06) * (0.9 + 0.2 * n1)[..., None], red)
            metal = metal * (1 - red)
            rough = mix(rough[..., None], [0.4], red)[..., 0]
            alpha = np.where(inside, 1.0, 0.24)
            # the anal fin's white leading edge
            lead = smooth(.62, .58, s) * smooth(.555, .575, s) * (Y < c - bot)
            col = mix(col, C(.95, .95, .92), lead)
            alpha = np.maximum(alpha, lead * 0.75)
        else:
            red = smooth(.3, .17, s + (yn - .5) * 0.06)
            col = mix(col, C(.74, .07, .07) * (0.85 + 0.3 * n1)[..., None], red)
            metal = metal * (1 - red * 0.8)
            t = -(X + 0.5)
            ycb = (Y - b.mid(1)) / 0.15
            lobe = np.abs(ycb)
            black = (lobe < 0.18) | ((lobe > 0.42) & (lobe < 0.62) & (t > 0.08))
            white = ~black & (lobe < 0.95)
            tail = s > 1.0
            col = np.where((tail & black)[..., None], C(.03, .03, .035), col)
            col = np.where((tail & white)[..., None], C(.93, .93, .9), col)
            alpha = np.where(inside, 1.0, np.where(tail, np.where(black | white, 0.88, 0.25), 0.24))

    elif name == 'angel':
        silver = C(.82, .82, .79)
        col = mix(silver, C(.62, .56, .4), smooth(.72, .98, yn) * 0.7)
        col = mix(col, C(.55, .5, .38), smooth(.2, .05, s) * smooth(.55, .9, yn) * 0.6)
        col = col * (0.92 + 0.16 * n1)[..., None]
        metal = np.full((H, W), 0.75)
        rough = np.full((H, W), 0.26)
        irid = np.full((H, W), 0.18)

        def bar(s0, w, slant=0.0, soft=0.014):
            ss = s - Y * slant + 0.015 * (fbm(X, Y, 30, 23) - 0.5)
            return smooth(w / 2 + soft, w / 2 - soft, np.abs(ss - s0))
        bars = np.maximum.reduce([
            bar(.15, .045, -0.05),
            bar(.47, .085, 0.1) * (1 - 0.15 * n2),
            bar(.86, .07, 0.28),
            bar(.66, .03, 0.18) * 0.35,
        ])
        col = mix(col, C(.035, .035, .04), bars)
        metal = metal * (1 - bars)
        irid = irid * (1 - bars)
        rough = rough + bars * 0.25
        # fins: smoky and see-through, the bars carried out to their tips
        alpha = np.where(inside, 1.0, 0.55 + 0.4 * bars)
        col = np.where(inside[..., None], col, mix(C(.66, .7, .72), C(.04, .04, .045), bars))

    elif name == 'discus':
        # a labyrinth of turquoise lines: contour lines of stretched,
        # warped noise ride on horizontal stripes, so they wave, fork and break
        warp = fb(X, Y, 3, 3, 31) - 0.5
        wob = np.sin(X * (26 + 10 * fb(X, Y, 2, 2, 36)) + Y * 6 + 6 * fb(X, Y, 2, 3, 37)) * 0.16
        v = Y * 15.0 + wob + 2.4 * (fb(X, Y, 3, 7, 32) - 0.5) + warp * 0.9
        head = smooth(.26, .1, s)
        vh = np.hypot(X - (0.5 - sp['eye']['s']), (Y - c - sp['eye']['y']) * 0.9) * 16 + 2.0 * (fb(X, Y, 6, 6, 33) - 0.5)
        v = v * (1 - head) + vh * head
        line = np.abs(np.mod(v, 1.0) - 0.5) * 2
        thick = 0.28 + 0.1 * fb(X, Y, 7, 7, 34)
        lines = smooth(thick + 0.07, thick - 0.04, line)
        lines *= smooth(0.02, 0.07, s)
        base = mix(C(.68, .26, .09), C(.55, .18, .07), smooth(.5, .98, yn))
        base = mix(base, C(.6, .24, .1), head * 0.5) * (0.93 + 0.14 * n1)[..., None]
        turq = mix(C(.1, .66, .7), C(.14, .44, .8), fb(X, Y, 5, 5, 16))
        col = mix(base, turq, lines)
        # a pale halo along each line where the pigment thins
        edge = smooth(thick + 0.26, thick + 0.12, line) * (1 - lines)
        col = mix(col, C(.85, .55, .3), edge * 0.25)
        irid = lines * 0.55
        metal = lines * 0.25
        rough = 0.38 - lines * 0.1
        vb = smooth(.4, 1.0, np.cos((s * 9.5 + 0.3) * 2 * math.pi)) * smooth(.05, .2, s)
        col = col * (1 - 0.07 * vb * (0.6 + 0.8 * fb(X, Y, 6, 6, 35)))[..., None]
        alpha = np.where(inside, 1.0, 0.9)

    # the eye socket: skin darkens a little around the eye
    er = np.hypot(X - (0.5 - sp['eye']['s']), Y - (c + sp['eye']['y']))
    socket = smooth(sp['eye']['r'] * 1.5, sp['eye']['r'] * 1.02, er) * inside
    col = col * (1 - 0.3 * socket)[..., None]

    # the mouth: a dark cleft at the snout
    mouth = smooth(0.06, 0.0, s) * smooth(0.03, 0.0, np.abs(yn - MOUTH[name])) * inside
    col = col * (1 - 0.6 * mouth)[..., None]

    # surface relief: scales, the gill cover, the lateral line
    h, cell = scales(X, Y, sp['scale'])
    h = h * inside
    # the gill cover: an arc behind the eye, from the nape down to the throat
    ex = 0.5 - sp['eye']['s']
    oper = np.hypot((X - ex) * 1.0, (Y - c - sp['eye']['y'] * 0.5) * 0.75)
    orad = {'neon': .1, 'rummy': .1, 'angel': .13, 'discus': .15}[name]
    ridge = smooth(0.008, 0.0, np.abs(oper - orad)) * (X < ex) * smooth(.12, .3, yn) * smooth(.92, .75, yn) * inside
    headm = smooth(orad + 0.01, orad - 0.02, oper) * inside
    h = mix(h[..., None], (0.35 + 0.1 * n2)[..., None], headm)[..., 0]
    h = h * 0.6 + ridge * 0.9 - mouth * 0.5
    lat = smooth(0.006, 0.0, np.abs(yn - 0.62)) * inside * (s > 0.22) * (s < 0.85)
    h = h - lat * 0.4
    col = col * (1 - 0.25 * ridge)[..., None]
    # scale to scale, the reflecting guanine sits at a slightly different angle
    rough = rough + (cell - 0.5) * 0.14 * inside * (1 - headm)
    metal = metal * (0.85 + 0.3 * cell * inside)
    rough = np.where(inside, rough, 0.2)

    colour = np.concatenate([np.clip(col, 0, 1), alpha[..., None]], -1)
    mat = np.stack([np.clip(h * 0.8 + 0.1, 0, 1), np.clip(rough, 0.05, 1), np.clip(metal, 0, 1), np.clip(irid, 0, 1)], -1)
    np.save(os.path.join(OUT, f'{name}_color.npy'), colour[::-1].astype(np.float32))
    np.save(os.path.join(OUT, f'{name}_mat.npy'), mat[::-1].astype(np.float32))

    # the eye: a big round pupil, a smooth reflective iris (fish irises are
    # guanine mirrors, not fibrous), a thin bright ring at the pupil, a darker
    # limbus, and the skin's colour over its top and bottom edges
    E = 256
    u = np.linspace(-1, 1, E)
    U, Vv = np.meshgrid(u, u)
    r = np.hypot(U, Vv)
    ring_c, low, upp = (np.array(x) for x in IRIS[name])
    iris = mix(low, upp, smooth(-0.35, 0.5, Vv))
    iris = iris * (0.85 + 0.25 * fbm(U, Vv, 5, 21))[..., None]
    iris = mix(iris, ring_c, smooth(0.62, 0.55, r) * 0.9)
    iris = iris * (0.55 + 0.45 * smooth(1.0, 0.72, r))[..., None]
    if name == 'angel':
        # the first black bar runs straight through the eye
        iris = mix(iris, np.array([.12, .05, .04]), smooth(0.3, 0.2, np.abs(U + 0.05 * Vv)) * smooth(0.5, 0.75, r) * 0.8)
    pupil = smooth(0.53, 0.49, np.hypot(U * 1.04, Vv))
    e = mix(iris, np.array([.012, .014, .02]), pupil)
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
