"""LUCE HILLS 目黒 — 3LDK corner unit (78.4㎡) on an upper floor. Floor z=0, ceiling 2.5."""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import importlib, archkit
importlib.reload(archkit)
from archkit import *
import bpy

reset()
FL, CL = 0.0, 2.5
PP = os.path.join(os.path.dirname(__file__), 'models', 'potted_plant_02', 'potted_plant_02.gltf')

wallp = mat('Wallcloth', color=(0.9, 0.89, 0.87), rough=0.95, tex='white_plaster_02', tile=1.5, normal=0.12, paint=True)
accent = mat('AccentStone', rough=0.8, tex='concrete', tile=1.2, normal=0.5, tint=(1.15, 1.12, 1.08))
floor = mat('LightOak', rough=0.4, tex='wood_floor', tile=2.0, normal=0.35, tint=(1.35, 1.3, 1.22))
oak = mat('OakVeneer', rough=0.5, tex='oak_veneer_01', tile=1.2, normal=0.2)
door_m = mat('DoorWhiteOak', rough=0.45, tex='oak_veneer_01', tile=1.0, normal=0.15, tint=(1.35, 1.32, 1.25))
white = mat('WhiteLacquer', color=(0.9, 0.9, 0.88), rough=0.3)
greige = mat('Greige', color=(0.62, 0.6, 0.56), rough=0.55)
stone = mat('QuartzTop', rough=0.2, tex='marble_01', tile=1.4, normal=0.1, tint=(1.1, 1.1, 1.1))
tiles = mat('BathTile', rough=0.2, tex='long_white_tiles', tile=1.0, normal=0.4)
gtile = mat('BalconyTile', rough=0.8, tex='concrete', tile=0.6, normal=0.6, tint=(0.75, 0.73, 0.7))
frame = mat('FrameAlu', color=(0.3, 0.31, 0.32), rough=0.35, metal=0.8)
steel = mat('SteelBlack', color=(0.04, 0.04, 0.045), rough=0.35, metal=0.8)
glass = mat('Glass', color=(0.9, 0.95, 0.95), glass=True)
fabric = mat('FabricLinen', color=(0.72, 0.68, 0.62), rough=0.95)
fabric2 = mat('FabricNavy', color=(0.14, 0.17, 0.24), rough=0.95)
linen = mat('Linen', color=(0.92, 0.9, 0.87), rough=0.95)
duvet = mat('DuvetStone', color=(0.66, 0.64, 0.6), rough=0.95)
rug = mat('RugWool', color=(0.78, 0.75, 0.7), rough=1.0)
black = mat('BlackMatte', color=(0.02, 0.02, 0.022), rough=0.5)
screen = mat('TVScreen', color=(0.01, 0.01, 0.012), rough=0.08)
ceramic = mat('Ceramic', color=(0.93, 0.93, 0.92), rough=0.15)
lamp = mat('LampWarm', color=(1.0, 0.93, 0.82), rough=0.5, emission=(1.0, 0.8, 0.56), strength=6.0)
mirror = mat('Mirror', color=(0.9, 0.92, 0.93), rough=0.02, metal=1.0)
ext = mat('FacadeConcrete', color=(0.62, 0.6, 0.57), rough=0.9, tex='concrete', tile=3.0, normal=0.4, paint=True)
leather = mat('Leather', rough=0.55, tex='fabric_leather_02', tile=0.8, normal=0.4, tint=(0.55, 0.38, 0.25))

# ------------------------------------------------------------------ slabs
box('Slab', (-0.3, -2.3, -0.3), (11.5, 7.3, FL - 0.02), ext, 'F1')
box('BalconySlab', (-0.3, -2.3, -0.3), (13.3, 0, -0.02), ext, 'F1')
box('BalconySlabE', (11.2, 0, -0.3), (13.3, 4.6, -0.02), ext, 'F1')
box('Floor', (0.1, 0.1, FL - 0.02), (11.1, 6.9, FL), floor, 'F1')
box('Genkan', (2.7, 6.0, -0.12), (3.9, 6.9, -0.1), gtile, 'F1')
box('BalconyFloor', (0, -2.0, -0.12), (13.0, -0.1, -0.1), gtile, 'F1')
box('BalconyFloorE', (11.3, -0.1, -0.12), (13.0, 4.4, -0.1), gtile, 'F1')
box('WetFloor', (4.05, 4.45, FL), (7.55, 6.95, FL + 0.005), tiles, 'F1')
box('Ceiling', (-0.3, -2.3, CL), (13.3, 7.3, CL + 0.3), ext, 'F1_CEIL')
plane('CeilingIn', (0.1, 0.1), (11.1, 6.9), CL - 0.01, wallp, 'F1_CEIL', flip=True)

# ------------------------------------------------------------------ exterior walls
T = 0.2
wall('W_S', (-0.1, 0), (11.3, 0), FL, CL, T, wallp, 'F1', openings=[(0.5, 3.2, FL, 2.3), (4.5, 6.4, FL, 2.3)])
wall('W_E', (11.2, 0.1), (11.2, 6.9), FL, CL, T, wallp, 'F1', openings=[(0.3, 3.8, FL, 2.3), (4.9, 1.6, 0.9, 2.1)])
wall('W_N', (-0.1, 7.0), (11.3, 7.0), FL, CL, T, wallp, 'F1', openings=[(0.6, 1.6, 1.0, 2.1), (3.0, 0.9, FL, 2.2), (8.8, 2.0, 1.0, 2.1)])
wall('W_W', (0, 0.1), (0, 6.9), FL, CL, T, wallp, 'F1')
window('Win_S1', (-0.1, 0), (11.3, 0), 0.5, 3.2, FL, 2.3, 'F1', frame, glass, mullions=1)
window('Win_S2', (-0.1, 0), (11.3, 0), 4.5, 6.4, FL, 2.3, 'F1', frame, glass, mullions=2)
window('Win_E1', (11.2, 0.1), (11.2, 6.9), 0.3, 3.8, FL, 2.3, 'F1', frame, glass, mullions=1)
window('Win_E2', (11.2, 0.1), (11.2, 6.9), 4.9, 1.6, 0.9, 2.1, 'F1', frame, glass)
window('Win_N1', (-0.1, 7.0), (11.3, 7.0), 0.6, 1.6, 1.0, 2.1, 'F1', frame, glass)
window('Win_N3', (-0.1, 7.0), (11.3, 7.0), 8.8, 2.0, 1.0, 2.1, 'F1', frame, glass, mullions=1)
box('FrontDoor', (2.92, 6.98, FL - 0.1), (3.78, 7.03, 2.2), mat('DoorDark', color=(0.18, 0.16, 0.14), rough=0.5), 'F1', bevel=0.004)
# accent wall behind the TV (north wall of the living, i.e. room 3's south wall face)
box('AccentWall', (8.9, 4.3, FL), (11.1, 4.34, CL), accent, 'F1')

# ------------------------------------------------------------------ interior walls
t = 0.12
wall('I_m_N', (0.1, 3.4), (4.0, 3.4), FL, CL, t, wallp, 'F1', openings=[(2.75, 0.8, FL, 2.1)])
wall('I_hall_W', (2.6, 3.4), (2.6, 6.9), FL, CL, t, wallp, 'F1', openings=[(0.8, 0.8, FL, 2.1)])
wall('I_hall_E', (4.0, 0.1), (4.0, 6.9), FL, CL, t, wallp, 'F1', openings=[(3.4, 0.85, FL, 2.1), (4.6, 0.7, FL, 2.1), (5.9, 0.75, FL, 2.1)])
wall('I_ldk_N', (4.0, 4.4), (11.1, 4.4), FL, CL, t, wallp, 'F1', openings=[(3.9, 0.8, FL, 2.1)])
wall('I_wc_N', (4.0, 5.8), (5.8, 5.8), FL, CL, t, wallp, 'F1')
wall('I_wc_E', (5.2, 4.4), (5.2, 5.8), FL, CL, t, wallp, 'F1')
wall('I_bath_W', (5.8, 5.0), (5.8, 6.9), FL, CL, t, wallp, 'F1', openings=[(0.9, 0.75, FL, 2.0)])
wall('I_bath_S', (5.2, 5.0), (7.6, 5.0), FL, CL, t, wallp, 'F1')
wall('I_r3_W', (7.6, 4.4), (7.6, 6.9), FL, CL, t, wallp, 'F1')
wall('I_m_E', (4.0, 0.1), (4.0, 3.4), FL, CL, t, wallp, 'F1')
for nm, (x0, y0, x1, y1) in {'BathTileN': (5.86, 6.84, 7.55, 6.9), 'BathTileE': (7.5, 5.06, 7.55, 6.84), 'BathTileS': (5.86, 5.06, 7.5, 5.11)}.items():
    box(nm, (x0, y0, FL), (x1, y1, CL), tiles, 'F1')


def door_leaf(name, hx, hy, w, ang, h=2.08):
    box(name, (hx, hy - 0.018, FL), (hx + w, hy + 0.018, h), door_m, 'F1', bevel=0.003, rot=ang, pivot=(hx, hy, 0))
    box(name + '_h', (hx + w - 0.12, hy - 0.05, 1.0), (hx + w - 0.06, hy + 0.05, 1.02), steel, 'F1', rot=ang, pivot=(hx, hy, 0))


door_leaf('Door_master', 2.8, 3.46, 0.78, -math.pi / 2)           # opens into bedroom
door_leaf('Door_r2', 2.54, 4.25, 0.78, math.pi / 2 + 0.2)          # into room 2
door_leaf('Door_wc', 4.06, 4.6, 0.68, 0.0 + 0.1)
door_leaf('Door_wash', 4.06, 5.95, 0.72, -0.15)
door_leaf('Door_r3', 7.95, 4.46, 0.78, math.pi / 2 - 0.1)
box('Door_ldk_glass', (4.0 - 0.02, 3.44, FL), (4.0 + 0.02, 4.26, 2.08), glass, 'F1')['nobake'] = 1

# ------------------------------------------------------------------ balcony railing (glass + aluminium)
for i, (a, b) in enumerate((((0.0, -2.0), (13.0, -2.0)), ((13.0, -2.0), (13.0, 4.4)))):
    ax, ay = a
    bx, by = b
    ang = math.atan2(by - ay, bx - ax)
    L = math.hypot(bx - ax, by - ay)
    g = box(f'Rail_glass{i}', (ax, ay - 0.01, 0.05), (ax + L, ay + 0.01, 1.05), glass, 'F1', rot=ang, pivot=(ax, ay, 0))
    g['nobake'] = 1
    box(f'Rail_top{i}', (ax, ay - 0.04, 1.05), (ax + L, ay + 0.04, 1.1), frame, 'F1', rot=ang, pivot=(ax, ay, 0))
box('BalconyWallW', (-0.3, -2.3, -0.1), (-0.1, 0, CL), ext, 'F1')
box('BalconyWallN', (11.2, 4.4, -0.1), (13.3, 4.6, CL), ext, 'F1')
for x in (-0.2, 13.1):
    pass

# ------------------------------------------------------------------ furniture
at_floor(FL)
# LDK – living
box('Rug', (7.4, 0.8, FL), (10.8, 3.3, FL + 0.012), rug, 'F1', bevel=0.004)
sofa('Sofa', 7.7, 0.55, 2.6, 0.95, 'F1', fabric, rot=math.pi, leg=steel)
table('CoffeeTable', 8.4, 2.1, 1.1, 0.6, 0.36, oak, oak, 'F1', inset=0.03)
box('TVBoard', (8.9, 3.9, FL + 0.15), (11.0, 4.28, FL + 0.5), oak, 'F1', bevel=0.004)
box('TV', (9.3, 4.2, FL + 0.8), (10.6, 4.24, FL + 1.55), screen, 'F1')
chair('LoungeChair', 10.3, 1.9, 'F1', leather, steel, rot=math.radians(110))
import_asset('PlantLDK', PP, (10.85, 0.4, FL), 'F1', scale=1.7, decimate=0.3)
# LDK – dining & kitchen
table('Dining', 5.0, 0.9, 1.6, 0.85, 0.72, oak, steel, 'F1')
for i in range(2):
    chair(f'DChairS{i}', 5.25 + i * 0.7, 0.35, 'F1', fabric2, steel, rot=math.pi)
    chair(f'DChairN{i}', 5.25 + i * 0.7, 1.85, 'F1', fabric2, steel)
cyl('PendantCord', (5.8, 1.32, 1.95), 0.004, 1.0, black, 'F1', verts=6)
cyl('Pendant', (5.8, 1.32, 1.45), 0.22, 0.14, lamp, 'F1')
box('Peninsula', (4.2, 2.45, FL), (7.1, 3.05, FL + 0.86), white, 'F1', bevel=0.004)
box('PeninsulaTop', (4.15, 2.4, FL + 0.86), (7.15, 3.1, FL + 0.9), stone, 'F1', bevel=0.003)
box('Sink', (4.7, 2.6, FL + 0.895), (5.4, 2.95, FL + 0.905), steel, 'F1')
box('BackCounter', (4.15, 3.75, FL), (6.4, 4.34, FL + 0.86), greige, 'F1', bevel=0.004)
box('BackCounterTop', (4.12, 3.72, FL + 0.86), (6.42, 4.34, FL + 0.9), stone, 'F1')
box('Cooktop', (4.6, 3.85, FL + 0.9), (5.2, 4.25, FL + 0.905), black, 'F1')
box('Hood', (4.55, 3.95, 1.75), (5.25, 4.34, 2.45), white, 'F1')
box('UpperCab', (5.3, 3.98, 1.55), (6.4, 4.34, 2.35), greige, 'F1', bevel=0.003)
box('Fridge', (6.45, 3.7, FL), (7.1, 4.34, FL + 1.85), white, 'F1', bevel=0.008)
box('Pantry', (7.12, 3.8, FL), (7.6, 4.34, FL + 2.35), greige, 'F1', bevel=0.004)
# master bedroom
bed('MasterBed', 0.95, 0.725, 1.6, 2.05, 'F1', oak, linen, duvet, rot=math.pi / 2)
box('Wardrobe', (0.12, 2.85, FL), (3.0, 3.34, 2.35), door_m, 'F1', bevel=0.004)
box('SideTable', (0.4, 0.2, FL), (0.85, 0.6, FL + 0.5), oak, 'F1')
cyl('BedLamp', (0.62, 0.4, FL + 0.66), 0.1, 0.28, lamp, 'F1')
# room 2
bed('Bed2', 0.2, 4.0, 1.0, 2.0, 'F1', oak, linen, mat('DuvetSage', color=(0.5, 0.58, 0.5), rough=0.95))
table('Desk2', 1.4, 6.3, 1.1, 0.55, 0.72, oak, steel, 'F1')
chair('Desk2Chair', 1.7, 5.65, 'F1', fabric, steel, rot=math.pi)
# room 3 – work room
table('Desk3', 9.0, 6.35, 1.6, 0.6, 0.72, oak, steel, 'F1')
chair('Desk3Chair', 9.55, 5.7, 'F1', fabric2, steel, rot=math.pi)
box('Shelf3', (7.7, 4.55, FL), (8.1, 6.8, 2.0), oak, 'F1')
for k in range(4):
    box(f'Books{k}', (7.72, 4.7 + (k % 2) * 0.4, FL + 0.3 + k * 0.45), (8.05, 6.2 - (k % 3) * 0.3, FL + 0.55 + k * 0.45), mat('Books', color=(0.45, 0.4, 0.33), rough=0.8), 'F1')
# wet areas
box('Vanity', (6.9, 5.9, FL), (7.55, 6.9, FL + 0.85), white, 'F1')  # placeholder removed below
bpy.data.objects.remove(bpy.data.objects['Vanity'])
box('Vanity', (4.1, 6.35, FL + 0.3), (5.7, 6.9, FL + 0.82), door_m, 'F1', bevel=0.004)
box('VanityTop', (4.08, 6.32, FL + 0.82), (5.72, 6.9, FL + 0.86), stone, 'F1')
box('Basin', (4.5, 6.45, FL + 0.86), (5.0, 6.8, FL + 0.96), ceramic, 'F1', bevel=0.03)
box('WashMirror', (4.2, 6.92, 1.05), (5.6, 6.94, 1.95), mirror, 'F1')
box('Washer', (5.1, 5.9, FL), (5.72, 6.3, FL + 0.9), white, 'F1', bevel=0.02)
box('Tub', (6.0, 5.2, FL), (7.45, 6.0, FL + 0.55), ceramic, 'F1', bevel=0.05)
box('WC', (4.5, 5.3, FL), (4.9, 5.72, FL + 0.42), ceramic, 'F1', bevel=0.05)
box('ShoeCabinet', (2.68, 5.2, FL + 0.1), (2.98, 6.8, FL + 1.1), door_m, 'F1', bevel=0.003)
# balcony
at_floor(-0.1)
for i, x in enumerate((8.5, 9.4)):
    chair(f'BalChair{i}', x, -1.4, 'F1', fabric2, steel)
import_asset('PlantBal', PP, (12.5, -1.5, -0.1), 'F1', scale=1.9, rot=1.1, decimate=0.3)

# ------------------------------------------------------------------ night lights
def area(name, x, y, sx, sy, power, z=CL - 0.03):
    d = bpy.data.lights.new(name, 'AREA'); d.shape = 'RECTANGLE'; d.size, d.size_y = sx, sy; d.energy = power; d.color = (1.0, 0.8, 0.58)
    o = bpy.data.objects.new(name, d); o.location = (x, y, z); bpy.context.scene.collection.objects.link(o); o['night'] = 1
def point(name, x, y, z, power):
    d = bpy.data.lights.new(name, 'POINT'); d.energy = power; d.shadow_soft_size = 0.06; d.color = (1.0, 0.76, 0.5)
    o = bpy.data.objects.new(name, d); o.location = (x, y, z); bpy.context.scene.collection.objects.link(o); o['night'] = 1
for nm, (x0, y0, x1, y1), dens in [('L_ldk', (4.2, 0.2, 11.0, 4.3), 14), ('L_master', (0.2, 0.2, 3.9, 3.3), 10), ('L_r2', (0.2, 3.5, 2.5, 6.8), 10),
                                   ('L_r3', (7.7, 4.5, 11.0, 6.8), 11), ('L_hall', (2.7, 3.5, 3.9, 6.8), 12), ('L_wash', (4.1, 5.9, 5.7, 6.8), 16),
                                   ('L_bath', (5.9, 5.1, 7.5, 6.8), 14), ('L_wc', (4.1, 4.5, 5.1, 5.7), 14)]:
    area(nm, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) * 0.7, (y1 - y0) * 0.7, dens * (x1 - x0) * (y1 - y0))
point('P_pend', 5.8, 1.32, 1.35, 45)
point('P_bedlamp', 0.62, 0.4, FL + 0.7, 16)
for i, x in enumerate((1.5, 5.0, 8.5, 12.0)):
    point(f'P_balc{i}', x, -1.0, CL - 0.1, 18)

# ------------------------------------------------------------------ nav, hotspots, info
for i, (mn, mx) in enumerate((((0.15, 0.15), (11.05, 4.35)), ((0.15, 3.45), (7.55, 6.85)), ((7.65, 4.45), (11.05, 6.85)), ((0.05, -1.95), (12.95, -0.05)), ((11.25, -0.05), (12.95, 4.35)))):
    z = -0.09 if i >= 3 else FL + 0.01
    plane(f'NAV_F1_{i}', mn, mx, z, None, 'F1')
for rid, x, y, z in [('genkan', 3.3, 6.4, -0.1), ('hall', 3.3, 4.6, FL), ('living', 9.4, 3.0, FL), ('dining', 7.1, 2.3, FL), ('kitchen', 5.6, 3.4, FL),
                     ('master', 3.3, 1.6, FL), ('room2', 1.6, 5.1, FL), ('room3', 9.6, 5.4, FL), ('wash', 4.9, 6.0, FL), ('bath', 6.7, 6.4, FL),
                     ('wc', 4.65, 4.9, FL), ('balcony', 6.5, -1.0, -0.1), ('balcony_e', 12.1, 1.6, -0.1)]:
    empty(f'HS_{rid}', (x, y, z), 'F1')
for iid, x, y, z in [('corner', 11.2, 0.2, 1.6), ('kitchen', 5.6, 2.7, 1.1), ('view', 6.0, -2.0, 1.4), ('bath', 6.7, 5.6, 0.8), ('wardrobe', 1.5, 3.1, 1.4), ('ceiling', 7.5, 2.0, 2.45)]:
    empty(f'INFO_{iid}', (x, y, z), 'F1')

for _n, _f in {'L_hall': 0.55, 'L_wash': 0.55, 'L_bath': 0.55, 'L_wc': 0.55}.items():
    bpy.data.objects[_n]['day'] = _f
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(__file__), 'luce.blend'))
print('BUILD OK', len(bpy.data.objects))
