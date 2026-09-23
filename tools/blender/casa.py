import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import importlib, archkit
importlib.reload(archkit)
from archkit import *

reset()
F1, C1, F2, RF = 0.45, 3.15, 3.6, 6.2  # 1F floor, 1F ceiling, 2F floor, 2F ceiling

# ------------------------------------------------------------------ materials
plaster = mat('Plaster', color=(0.86, 0.85, 0.83), rough=0.9, tex='white_plaster_02', tile=2.5, normal=0.2, paint=True)
ext = mat('ExteriorRender', color=(0.85, 0.84, 0.82), rough=0.9, tex='white_plaster_02', tile=3.0, normal=0.35, paint=True)
oakfloor = mat('OakFloor', rough=0.45, tex='wood_floor', tile=2.4, normal=0.4)
oak = mat('OakVeneer', rough=0.5, tex='oak_veneer_01', tile=1.2, normal=0.2)
concrete = mat('Concrete', rough=0.9, tex='concrete', tile=3.0, normal=0.5, tint=(0.9, 0.9, 0.9))
marble = mat('Marble', rough=0.18, tex='marble_01', tile=1.6, normal=0.1)
tiles = mat('BathTile', rough=0.2, tex='long_white_tiles', tile=1.2, normal=0.5)
deck = mat('Deck', rough=0.7, tex='wood_floor_deck', tile=2.0, normal=0.5)
grass = mat('Grass', rough=0.95, tex='grass_ground', tile=3.5, normal=0.6, tint=(0.85, 1.05, 0.7))
leather = mat('Leather', rough=0.55, tex='fabric_leather_02', tile=0.8, normal=0.4, tint=(0.62, 0.42, 0.28))
frame = mat('FrameDark', color=(0.06, 0.065, 0.07), rough=0.4, metal=0.6)
steel = mat('SteelBlack', color=(0.04, 0.04, 0.045), rough=0.35, metal=0.8)
white = mat('WhiteLacquer', color=(0.9, 0.9, 0.88), rough=0.35)
fabric = mat('FabricOat', color=(0.62, 0.57, 0.5), rough=0.95)
fabric2 = mat('FabricMoss', color=(0.28, 0.33, 0.26), rough=0.95)
linen = mat('Linen', color=(0.9, 0.88, 0.84), rough=0.95)
duvet = mat('DuvetSand', color=(0.75, 0.68, 0.58), rough=0.95)
rug = mat('RugWool', color=(0.7, 0.66, 0.6), rough=1.0)
black = mat('BlackMatte', color=(0.02, 0.02, 0.022), rough=0.5)
ceramic = mat('Ceramic', color=(0.92, 0.92, 0.9), rough=0.15)
potm = mat('PotClay', color=(0.55, 0.42, 0.33), rough=0.8)
leaf = mat('Leaf', color=(0.13, 0.25, 0.1), rough=0.8)
bark = mat('Bark', color=(0.2, 0.15, 0.11), rough=0.9)
glass = mat('Glass', color=(0.9, 0.95, 0.95), glass=True)
mirror = mat('Mirror', color=(0.9, 0.92, 0.93), rough=0.02, metal=1.0)
lamp = mat('LampWarm', color=(1.0, 0.92, 0.8), rough=0.5, emission=(1.0, 0.78, 0.52), strength=6.0)
tile_floor = mat('StoneTile', rough=0.6, tex='concrete', tile=0.9, normal=0.6, tint=(0.62, 0.6, 0.57))

# ------------------------------------------------------------------ site
plane('Ground', (-14, -18), (28, 18), 0.0, grass, 'SITE')
box('Drive_top', (11.0, -18, 0), (15.4, -0.3, 0.02), concrete, 'SITE')
box('Plinth', (-0.1, -0.1, 0), (14.5, 8.5, F1 - 0.025), concrete, 'F1')
box('DeckBoard', (0, -3.6, 0), (10.8, 0, 0.3), deck, 'SITE')
box('Step', (10.8, -1.2, 0), (11.8, 0, 0.3), concrete, 'SITE')
for i, (x, y, sp, h, r) in enumerate(((-5, -7, 'island_tree_02', 5.2, 0.3), (-7.5, 4.5, 'jacaranda_tree', 7.5, 1.0), (19.5, -9, 'jacaranda_tree', 8.0, 2.2),
                                     (-3.5, -12.5, 'tree_small_02', 6.5, 0.7), (19, 6.5, 'island_tree_02', 5.5, 1.4), (6, 12.5, 'jacaranda_tree', 8.5, 0.4),
                                     (-9, -2, 'tree_small_02', 6.0, 2.0), (1.5, 13.5, 'tree_small_02', 6.8, 1.1), (12, 14, 'island_tree_02', 5.0, 0.2))):
    tree_card(f'Tree{i}', x, y, sp, h, 'SITE', rot=r)
box('Hedge', (-12, -15, 0), (10.5, -14.2, 1.1), mat('Hedge', color=(0.1, 0.2, 0.07), rough=0.9), 'SITE', bevel=0.2)
box('GardenWall', (15.8, -15, 0), (16.1, 9, 1.2), concrete, 'SITE')
at_floor(0.3)
for i, x in enumerate((1.4, 3.0)):
    chair(f'DeckChair{i}', x, -2.6, 'SITE', fabric2, steel)
table('DeckTable', 2.0, -3.2, 1.2, 0.6, 0.45, oak, steel, 'SITE')
import_asset('DeckPlant', os.path.join(os.path.dirname(__file__), 'models', 'potted_plant_02', 'potted_plant_02.gltf'), (9.8, -3.0, 0.3), 'SITE', scale=1.6, decimate=0.3)

# ------------------------------------------------------------------ 1F shell
T = 0.2
wall('W1_S', (-0.1, 0), (14.5, 0), F1, C1, T, ext, 'F1',
     openings=[(0.4, 10.2, F1, 2.95), (12.3, 1.0, F1, 2.85)])
wall('W1_W', (0, 0.1), (0, 8.3), F1, C1, T, ext, 'F1',
     openings=[(0.9, 3.2, 0.95, 2.95), (6.1, 1.6, 1.3, 2.7)])
wall('W1_N', (-0.1, 8.4), (14.5, 8.4), F1, C1, T, ext, 'F1',
     openings=[(0.9, 2.6, 1.35, 2.75), (5.2, 3.2, 2.2, 2.95), (9.4, 1.1, 1.55, 2.55), (11.3, 0.5, 1.9, 2.6), (12.8, 1.4, 2.0, 2.7)])
wall('W1_E', (14.4, 0.1), (14.4, 8.3), F1, C1, T, ext, 'F1',
     openings=[(0.8, 1.4, 1.25, 2.6), (3.5, 1.2, 1.55, 2.55)])
window('Win1_LDK', (-0.1, 0), (14.5, 0), 0.4, 10.2, F1, 2.95, 'F1', frame, glass, mullions=3)
window('Win1_W', (0, 0.1), (0, 8.3), 0.9, 3.2, 0.95, 2.95, 'F1', frame, glass, mullions=1)
window('Win1_Wst', (0, 0.1), (0, 8.3), 6.1, 1.6, 1.3, 2.7, 'F1', frame, glass)
for k, (o, w, s, h) in enumerate(((0.9, 2.6, 1.35, 2.75), (5.2, 3.2, 2.2, 2.95), (9.4, 1.1, 1.55, 2.55), (11.3, 0.5, 1.9, 2.6), (12.8, 1.4, 2.0, 2.7))):
    window(f'Win1_N{k}', (-0.1, 8.4), (14.5, 8.4), o, w, s, h, 'F1', frame, glass)
for k, (o, w, s, h) in enumerate(((0.8, 1.4, 1.25, 2.6), (3.5, 1.2, 1.55, 2.55))):
    window(f'Win1_E{k}', (14.4, 0.1), (14.4, 8.3), o, w, s, h, 'F1', frame, glass)
# front door (oak slab) set into the opening
box('FrontDoor', (12.22, -0.05, F1), (13.18, 0.0, 2.83), oak, 'F1', bevel=0.004)
box('FrontDoorPull', (12.35, -0.09, 1.1), (12.39, -0.05, 2.0), steel, 'F1')

# floors
box('Floor1', (0.1, 0.1, F1 - 0.02), (10.8, 8.3, F1), oakfloor, 'F1')
box('Floor1_core', (10.8, 1.6, F1 - 0.02), (14.3, 8.3, F1), oakfloor, 'F1')
box('Genkan', (10.8, 0.1, 0.28), (14.3, 1.6, 0.3), tile_floor, 'F1')
box('GenkanStep', (10.8, 1.55, 0.28), (14.3, 1.6, F1), oak, 'F1')
box('BathFloor', (12.0, 5.4, F1), (14.3, 8.3, F1 + 0.005), tiles, 'F1')

# interior walls 1F
t = 0.12
wall('I1_study_S', (0.1, 5.8), (4.2, 5.8), F1, C1, t, plaster, 'F1', openings=[(2.9, 0.9, F1, 2.55)])
wall('I1_study_E', (4.2, 5.8), (4.2, 8.3), F1, C1, t, plaster, 'F1')
wall('I1_core', (10.8, 0.1), (10.8, 8.3), F1, C1, t, plaster, 'F1', openings=[(0.8, 1.2, F1, 2.6)])
wall('I1_genkan_N', (10.8, 3.0), (14.3, 3.0), F1, C1, t, plaster, 'F1', openings=[(0.2, 0.9, F1, 2.6)])
wall('I1_wash_W', (12.0, 3.0), (12.0, 8.3), F1, C1, t, plaster, 'F1', openings=[(0.5, 0.8, F1, 2.55)])
wall('I1_bath_N', (12.0, 5.4), (14.3, 5.4), F1, C1, t, plaster, 'F1', openings=[(0.4, 0.8, F1, 2.55)])
wall('I1_wc', (10.8, 7.0), (12.0, 7.0), F1, C1, t, plaster, 'F1', openings=[(0.2, 0.75, F1, 2.55)])
# bath tile lining
box('BathTileN', (12.06, 8.25, F1), (14.3, 8.3, C1), tiles, 'F1')
box('BathTileE', (14.25, 5.46, F1), (14.3, 8.3, C1), tiles, 'F1')
box('BathTileW', (12.06, 5.46, F1), (12.11, 8.25, C1), tiles, 'F1')

# 1F ceiling slab (with stair void 4.6..8.6 x 7.2..8.4)
for i, (mn, mx) in enumerate((((-0.6, -1.8), (14.4, 7.2)), ((-0.6, 7.2), (4.6, 8.4)), ((8.6, 7.2), (14.4, 8.4)))):
    box(f'Slab1_{i}', (mn[0], mn[1], C1), (mx[0], mx[1], F2), ext, 'F1_CEIL')
for i, (mn, mx) in enumerate((((0.1, 0.1), (14.3, 7.2)), ((0.1, 7.2), (4.6, 8.3)), ((8.6, 7.2), (14.3, 8.3)))):
    plane(f'Ceil1_{i}', mn, mx, C1 - 0.01, plaster, 'F1_CEIL', flip=True)
box('Soffit_S', (-0.6, -1.8, C1 - 0.02), (14.4, -0.1, C1), oak, 'F1_CEIL')
box('Soffit_W', (-0.6, -0.1, C1 - 0.02), (-0.1, 8.4, C1), oak, 'F1_CEIL')

# ------------------------------------------------------------------ stairs (rise westwards: bottom x=8.6 → top x=4.6)
n = 16
rise = (F2 - F1) / n
run = 4.0 / n
for i in range(n):
    zt = F1 + rise * (i + 1)
    xa = 8.6 - run * (i + 1)
    box(f'Tread{i}', (xa - 0.02, 7.26, zt - 0.045), (xa + run, 8.3, zt), oak, 'F1', bevel=0.005)
import bpy, bmesh
def skew(name, p0, p1, y0, y1, half, material, parent):
    """Slanted beam between (x,z) points p0 and p1, spanning y0..y1."""
    bm = bmesh.new()
    vs = []
    for (x, z) in (p0, p1):
        for dz in (-half, half):
            for y in (y0, y1):
                vs.append(bm.verts.new((x, y, z + dz)))
    idx = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    for f in idx:
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material); o.parent = group(parent); box_uv(o)
for side, y in (('a', 7.24), ('b', 8.3)):
    skew(f'Stringer_{side}', (8.7, F1 - 0.05), (4.5, F2 - 0.05), y, y + 0.025, 0.14, steel, 'F1')
# glass guard around the void on 2F (open at the landing x 4.6..5.8)
box('VoidGlass_S', (5.8, 7.18, F2), (8.6, 7.2, F2 + 1.0), glass, 'F2')['nobake'] = 1
box('VoidRail_S', (5.8, 7.16, F2 + 1.0), (8.6, 7.22, F2 + 1.04), oak, 'F2')

# ------------------------------------------------------------------ 1F furniture
at_floor(F1)
box('Rug', (0.8, 1.1, F1), (4.2, 4.0, F1 + 0.012), rug, 'F1', bevel=0.004)
sofa('Sofa', 0.7, 3.4, 3.1, 1.0, 'F1', fabric, leg=steel)
table('CoffeeTable', 1.6, 1.9, 1.3, 0.75, 0.36, oak, oak, 'F1', inset=0.04, leg=0.06)
chair('LoungeChair', 3.7, 1.3, 'F1', leather, steel, rot=math.radians(-35))
box('Sideboard', (0.5, 5.3, F1 + 0.25), (2.6, 5.72, F1 + 0.8), oak, 'F1', bevel=0.004)
box('Art', (0.7, 5.71, F1 + 1.15), (2.4, 5.74, F1 + 2.05), mat('ArtCanvas', color=(0.72, 0.56, 0.42), rough=0.9), 'F1')
cyl('FloorLampPole', (0.55, 4.7, F1 + 0.75), 0.015, 1.5, steel, 'F1', verts=8)
cyl('FloorLampShade', (0.55, 4.7, F1 + 1.55), 0.22, 0.28, lamp, 'F1')
import_asset('PlantLiving', os.path.join(os.path.dirname(__file__), 'models', 'potted_plant_02', 'potted_plant_02.gltf'), (0.55, 0.55, F1), 'F1', scale=1.9, rot=0.6, decimate=0.3)
# dining
table('Dining', 5.0, 2.1, 2.2, 1.0, 0.72, oak, steel, 'F1')
for i in range(3):
    chair(f'DChairS{i}', 5.15 + i * 0.7, 1.55, 'F1', leather, steel, rot=math.pi)
    chair(f'DChairN{i}', 5.15 + i * 0.7, 3.2, 'F1', leather, steel)
for i, x in enumerate((5.6, 6.6)):
    cyl(f'PendantCord{i}', (x, 2.6, F1 + 2.2), 0.004, 1.1, black, 'F1', verts=6)
    cyl(f'Pendant{i}', (x, 2.6, F1 + 1.6), 0.2, 0.18, lamp, 'F1')
# kitchen
box('Island', (7.9, 3.5, F1), (10.3, 4.5, F1 + 0.86), oak, 'F1', bevel=0.004)
box('IslandTop', (7.85, 3.45, F1 + 0.86), (10.35, 4.55, F1 + 0.9), marble, 'F1', bevel=0.004)
box('Sink', (8.3, 3.8, F1 + 0.895), (8.9, 4.2, F1 + 0.905), steel, 'F1')
cyl('Faucet', (8.6, 4.35, F1 + 1.05), 0.015, 0.3, steel, 'F1', verts=10)
for i in range(3):
    x = 8.3 + i * 0.7
    cyl(f'StoolSeat{i}', (x, 3.1, F1 + 0.66), 0.19, 0.05, leather, 'F1')
    cyl(f'StoolPole{i}', (x, 3.1, F1 + 0.32), 0.02, 0.64, steel, 'F1', verts=8)
    cyl(f'StoolBase{i}', (x, 3.1, F1 + 0.01), 0.2, 0.02, steel, 'F1')
box('BackCounter', (9.2, 7.75, F1), (10.1, 8.3, F1 + 0.86), oak, 'F1', bevel=0.004)
box('BackCounterTop', (9.18, 7.72, F1 + 0.86), (10.12, 8.3, F1 + 0.9), marble, 'F1')
box('Cooktop', (9.35, 7.85, F1 + 0.9), (9.95, 8.25, F1 + 0.905), black, 'F1')
box('TallUnit', (10.1, 7.65, F1), (10.72, 8.3, F1 + 2.35), white, 'F1', bevel=0.004)
box('Hood', (9.4, 7.95, F1 + 1.7), (9.9, 8.3, F1 + 2.4), steel, 'F1')
# study
table('Desk', 0.4, 7.7, 2.4, 0.6, 0.72, oak, steel, 'F1')
chair('DeskChair', 1.3, 7.05, 'F1', fabric2, steel, rot=math.pi)
box('Shelf', (3.7, 5.95, F1), (4.13, 8.25, F1 + 2.2), oak, 'F1')
for k in range(5):
    box(f'ShelfBooks{k}', (3.72, 6.1 + (k % 2) * 0.3, F1 + 0.35 + k * 0.42), (4.05, 7.6 + (k % 3) * 0.2, F1 + 0.62 + k * 0.42), mat('Books', color=(0.45, 0.36, 0.28), rough=0.8), 'F1')
# genkan & core
box('ShoeCabinet', (14.0, 0.2, 0.55), (14.3, 2.9, 1.45), oak, 'F1', bevel=0.004)
box('GenkanBench', (11.0, 1.9, F1), (12.2, 2.3, F1 + 0.42), oak, 'F1', bevel=0.004)
box('Vanity', (13.75, 3.2, F1 + 0.3), (14.3, 5.0, F1 + 0.82), oak, 'F1', bevel=0.004)
box('VanityTop', (13.72, 3.18, F1 + 0.82), (14.3, 5.02, F1 + 0.86), marble, 'F1')
box('Basin', (13.85, 3.8, F1 + 0.86), (14.2, 4.4, F1 + 0.98), ceramic, 'F1', bevel=0.03)
box('Mirror', (14.27, 3.4, F1 + 1.1), (14.3, 4.8, F1 + 2.1), mirror, 'F1')
box('Tub', (12.2, 7.45, F1), (14.2, 8.24, F1 + 0.56), ceramic, 'F1', bevel=0.04)
box('TubWater', (12.3, 7.55, F1 + 0.44), (14.1, 8.14, F1 + 0.5), mat('Water', color=(0.7, 0.8, 0.82), rough=0.05), 'F1')
box('WC', (11.2, 7.9, F1), (11.6, 8.3, F1 + 0.42), ceramic, 'F1', bevel=0.05)

# ------------------------------------------------------------------ 2F shell
wall('W2_S', (-0.7, -1.8), (14.5, -1.8), F2, RF, T, ext, 'F2',
     openings=[(0.4, 6.0, F2, 5.95), (7.1, 3.4, F2, 5.95), (11.3, 3.4, F2, 5.95)])
wall('W2_W', (-0.6, -1.7), (-0.6, 8.3), F2, RF, T, ext, 'F2',
     openings=[(1.9, 3.6, 4.3, 5.9), (8.3, 1.0, 4.9, 5.7)])
wall('W2_N', (-0.7, 8.4), (14.5, 8.4), F2, RF, T, ext, 'F2',
     openings=[(5.6, 3.4, 3.9, 5.95), (9.9, 0.6, 5.0, 5.8)])
wall('W2_E', (14.4, -1.7), (14.4, 8.3), F2, RF, T, ext, 'F2', openings=[(0.9, 3.0, 4.3, 5.9)])
window('Win2_M', (-0.7, -1.8), (14.5, -1.8), 0.4, 6.0, F2, 5.95, 'F2', frame, glass, mullions=3)
window('Win2_B2', (-0.7, -1.8), (14.5, -1.8), 7.1, 3.4, F2, 5.95, 'F2', frame, glass, mullions=1)
window('Win2_B3', (-0.7, -1.8), (14.5, -1.8), 11.3, 3.4, F2, 5.95, 'F2', frame, glass, mullions=1)
window('Win2_W', (-0.6, -1.7), (-0.6, 8.3), 1.9, 3.6, 4.3, 5.9, 'F2', frame, glass, mullions=1)
window('Win2_Ws', (-0.6, -1.7), (-0.6, 8.3), 8.3, 1.0, 4.9, 5.7, 'F2', frame, glass)
window('Win2_Nv', (-0.7, 8.4), (14.5, 8.4), 5.6, 3.4, 3.9, 5.95, 'F2', frame, glass, mullions=1)
window('Win2_Nt', (-0.7, 8.4), (14.5, 8.4), 9.9, 0.6, 5.0, 5.8, 'F2', frame, glass)
window('Win2_E', (14.4, -1.7), (14.4, 8.3), 0.9, 3.0, 4.3, 5.9, 'F2', frame, glass, mullions=1)
for i, (mn, mx) in enumerate((((-0.5, -1.7), (14.3, 7.2)), ((-0.5, 7.2), (4.6, 8.3)), ((8.6, 7.2), (14.3, 8.3)))):
    box(f'Floor2_{i}', (mn[0], mn[1], F2), (mx[0], mx[1], F2 + 0.01), oakfloor, 'F2')
wall('I2_hallS', (-0.5, 5.8), (14.3, 5.8), F2, RF, t, plaster, 'F2',
     openings=[(1.5, 0.9, F2, 5.7), (5.3, 0.9, F2, 5.7), (9.4, 0.9, F2, 5.7), (12.9, 0.9, F2, 5.7)])
wall('I2_mb', (6.0, -1.7), (6.0, 5.8), F2, RF, t, plaster, 'F2')
wall('I2_b23', (10.2, -1.7), (10.2, 5.8), F2, RF, t, plaster, 'F2')
wall('I2_wic', (4.6, 5.8), (4.6, 8.3), F2, RF, t, plaster, 'F2')
wall('I2_hallN', (8.6, 7.2), (14.3, 7.2), F2, RF, t, plaster, 'F2', openings=[(0.6, 0.7, F2, 5.7), (3.2, 1.4, F2, 5.7)])
wall('I2_wc2', (10.8, 7.2), (10.8, 8.3), F2, RF, t, plaster, 'F2')
# roof
box('Roof', (-0.7, -1.9, RF), (14.5, 8.5, RF + 0.3), ext, 'ROOF')
for i, (mn, mx) in enumerate((((-0.7, -1.9), (14.5, -1.65)), ((-0.7, 8.25), (14.5, 8.5)), ((-0.7, -1.9), (-0.45, 8.5)), ((14.25, -1.9), (14.5, 8.5)))):
    box(f'Parapet{i}', (mn[0], mn[1], RF + 0.3), (mx[0], mx[1], RF + 0.75), ext, 'ROOF')
plane('Ceil2', (-0.5, -1.7), (14.3, 8.3), RF - 0.01, plaster, 'ROOF', flip=True)

# ------------------------------------------------------------------ 2F furniture
at_floor(F2)
bed('MasterBed', 1.6, 3.6, 1.8, 2.15, 'F2', oak, linen, duvet)
for i, x in enumerate((1.05, 3.5)):
    box(f'Nightstand{i}', (x, 5.25, F2 + 0.2), (x + 0.45, 5.7, F2 + 0.55), oak, 'F2', bevel=0.004)
    cyl(f'BedLamp{i}', (x + 0.22, 5.47, F2 + 0.72), 0.1, 0.3, lamp, 'F2')
box('MasterRug', (0.9, 1.4, F2), (4.6, 4.2, F2 + 0.012), rug, 'F2')
chair('ReadingChair', 4.2, -0.9, 'F2', leather, steel, rot=math.radians(20))
import_asset('PlantMaster', os.path.join(os.path.dirname(__file__), 'models', 'potted_plant_02', 'potted_plant_02.gltf'), (5.5, -1.3, F2), 'F2', scale=1.5, rot=2.0, decimate=0.3)
bed('Bed2', 6.4, 3.6, 1.2, 2.05, 'F2', oak, linen, mat('DuvetSage', color=(0.5, 0.58, 0.5), rough=0.95))
table('Desk2', 6.4, -1.55, 1.6, 0.6, 0.72, oak, steel, 'F2')
chair('Desk2Chair', 7.0, -0.8, 'F2', fabric2, steel)
bed('Bed3', 10.5, 3.6, 1.2, 2.05, 'F2', white, linen, mat('DuvetClay', color=(0.72, 0.52, 0.42), rough=0.95))
table('Desk3', 12.4, -1.55, 1.6, 0.6, 0.72, white, steel, 'F2')
chair('Desk3Chair', 13.0, -0.8, 'F2', fabric, steel)
box('Shelf3', (13.9, 1.0, F2), (14.28, 3.4, F2 + 1.9), white, 'F2')
for k, (y0, y1) in enumerate(((6.0, 8.2),)):
    box('WICShelfW', (-0.45, y0, F2), (0.1, y1, F2 + 2.2), oak, 'F2')
    box('WICShelfN', (0.1, 7.75, F2), (4.4, 8.25, F2 + 2.2), oak, 'F2')
box('HallBench', (10.6, 5.92, F2), (11.9, 6.24, F2 + 0.42), oak, 'F2', bevel=0.004)
box('WC2', (9.3, 7.9, F2), (9.7, 8.3, F2 + 0.42), ceramic, 'F2', bevel=0.05)

# ------------------------------------------------------------------ night lights (only used in the night bake)
import bpy
def area(name, x, y, z, sx, sy, power, color=(1.0, 0.78, 0.55)):
    d = bpy.data.lights.new(name, 'AREA')
    d.shape = 'RECTANGLE'
    d.size, d.size_y = sx, sy
    d.energy = power
    d.color = color
    o = bpy.data.objects.new(name, d)
    o.location = (x, y, z)
    bpy.context.scene.collection.objects.link(o)
    o['night'] = 1
    return o
def point(name, x, y, z, power, radius=0.05, color=(1.0, 0.75, 0.5)):
    d = bpy.data.lights.new(name, 'POINT')
    d.energy = power
    d.shadow_soft_size = radius
    d.color = color
    o = bpy.data.objects.new(name, d)
    o.location = (x, y, z)
    bpy.context.scene.collection.objects.link(o)
    o['night'] = 1
    return o
for name, (x0, y0, x1, y1), z, dens in [
    ('L_living', (0.3, 0.3, 4.6, 5.4), C1, 14), ('L_dining', (4.6, 0.8, 7.6, 4.8), C1, 12), ('L_kitchen', (7.6, 2.8, 10.6, 6.9), C1, 16),
    ('L_study', (0.3, 6.0, 4.0, 8.2), C1, 14), ('L_genkan', (10.9, 0.2, 14.2, 2.9), C1, 12), ('L_hall1', (10.9, 3.1, 11.9, 6.9), C1, 12),
    ('L_wash', (12.1, 3.1, 14.2, 5.3), C1, 16), ('L_bath', (12.1, 5.5, 14.2, 8.2), C1, 12), ('L_stair', (4.8, 7.3, 8.5, 8.3), RF, 10),
    ('L_master', (-0.4, -1.6, 5.9, 5.6), RF, 8), ('L_bed2', (6.1, -1.6, 10.1, 5.6), RF, 9), ('L_bed3', (10.3, -1.6, 14.2, 5.6), RF, 9),
    ('L_hall2', (4.7, 5.9, 14.2, 7.1), RF, 10), ('L_wic', (-0.4, 5.9, 4.5, 8.2), RF, 9)]:
    area(name, (x0 + x1) / 2, (y0 + y1) / 2, z - 0.03, (x1 - x0) * 0.7, (y1 - y0) * 0.7, dens * (x1 - x0) * (y1 - y0))
for i, x in enumerate((5.6, 6.6)):
    point(f'P_pend{i}', x, 2.6, F1 + 1.5, 45)
point('P_floorlamp', 0.55, 4.7, F1 + 1.5, 40)
for i, x in enumerate((1.27, 3.72)):
    point(f'P_bedlamp{i}', x, 5.47, F2 + 0.75, 18)
for i in range(7):
    point(f'P_soffit{i}', 0.6 + i * 1.6, -1.2, C1 - 0.08, 35)
for i, (x, y) in enumerate(((-5, -7), (-7, 5), (19, -9), (-3, -13))):
    point(f'P_tree{i}', x + 0.4, y - 0.6, 0.2, 60, color=(1.0, 0.85, 0.65))

# ------------------------------------------------------------------ navigation + hotspots
for i, (mn, mx) in enumerate((((0.15, 0.15), (10.75, 7.15)), ((0.15, 5.85), (4.15, 8.25)), ((10.85, 0.15), (14.35, 8.35)), ((0.0, -3.5), (10.7, -0.05)))):
    z = 0.31 if i == 3 else F1 + 0.01
    plane(f'NAV_F1_{i}', mn, mx, z, None, 'F1', ).name = f'NAV_F1_{i}'
for i, (mn, mx) in enumerate((((-0.45, -1.65), (14.25, 7.15)), ((-0.45, 7.15), (4.55, 8.25)), ((8.65, 7.25), (14.25, 8.25)))):
    plane(f'NAV_F2_{i}', mn, mx, F2 + 0.02, None, 'F2')
HS = {
    'F1': [('living', 2.4, 0.9), ('dining', 6.1, 4.3), ('kitchen', 9.2, 5.6), ('study', 2.0, 6.8), ('genkan', 12.4, 2.3),
           ('hall1', 11.4, 5.0), ('wash', 12.9, 4.2), ('bath', 13.1, 6.6), ('terrace', 5.4, -2.0)],
    'F2': [('hall2', 7.3, 6.5), ('master', 2.6, 1.2), ('wic', 2.2, 7.0), ('bed2', 8.2, 1.3), ('bed3', 12.4, 1.3)],
}
for fl, pts in HS.items():
    for rid, x, y in pts:
        z = 0.3 if rid == 'terrace' else (F1 if fl == 'F1' else F2)
        empty(f'HS_{rid}', (x, y, z), fl)
empty('WP_stair_f1', (9.0, 7.75, F1), 'F1')
empty('WP_stair_mid', (6.6, 7.75, (F1 + F2) / 2), 'F1')
empty('WP_stair_top', (4.9, 7.75, F2), 'F2')
empty('WP_stair_f2', (5.2, 6.5, F2), 'F2')
for iid, x, y, z, fl in [('island', 9.1, 4.0, F1 + 1.0, 'F1'), ('glazing', 5.4, 0.05, F1 + 2.2, 'F1'), ('stairs', 6.6, 7.8, 2.2, 'F1'),
                         ('bath', 13.2, 7.8, F1 + 0.8, 'F1'), ('deck', 3.0, -2.8, 0.6, 'SITE'), ('master', 2.6, -1.75, F2 + 2.0, 'F2'), ('void', 7.2, 7.2, F2 + 1.2, 'F2')]:
    empty(f'INFO_{iid}', (x, y, z), fl)

for _n, _f in {'L_genkan': 0.55, 'L_hall1': 0.55, 'L_wash': 0.55, 'L_bath': 0.55, 'L_hall2': 0.55, 'L_wic': 0.55, 'L_stair': 0.3}.items():
    bpy.data.objects[_n]['day'] = _f
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(__file__), 'casa.blend'))
print('BUILD OK', len(bpy.data.objects))
