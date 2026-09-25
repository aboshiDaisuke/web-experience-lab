#!/bin/zsh
# Rebuild MIRAI ARC (the car on /works/arc) into public/models/arc.
#   car.glb     body, glass canopy, doors, flap, lamps, cabin, screens, wheel parts (Draco)
#   car.json    key points in three.js coordinates (eye, hinges, hotspots)
#   shadow.png  baked contact shadow (alpha), laid on the studio floor
cd "$(dirname "$0")"
set -e
blender -b --factory-startup -P arc.py -- out/arc --export > logs_arc.txt 2>&1
grep EXPORTED logs_arc.txt
python3 - <<'PY'
from PIL import Image, ImageFilter, ImageChops
ao = Image.open('out/arc/shadow_ao.png').convert('L')
ao = ao.filter(ImageFilter.GaussianBlur(2.2))
# darkness = 1 - AO, lifted so the footprint reads as a soft contact shadow
a = ao.point(lambda v: int(max(0, min(255, (255 - v) * 1.15))))
# fade to nothing at the plane's border so it never shows an edge
w, h = a.size
mask = Image.new('L', (w, h), 0)
px = mask.load()
for y in range(h):
    for x in range(w):
        u, v = abs(x / (w - 1) * 2 - 1), abs(y / (h - 1) * 2 - 1)
        t = max(0.0, 1 - max(u ** 6, v ** 6))
        px[x, y] = int(255 * t)
a = ImageChops.multiply(a, mask)
a.save('out/arc/shadow.png', optimize=True)
PY
mkdir -p ../../public/models/arc
cp out/arc/car.glb out/arc/car.json out/arc/shadow.png ../../public/models/arc/
ls -la ../../public/models/arc
