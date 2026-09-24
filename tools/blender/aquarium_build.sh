#!/bin/zsh
# Rebuild the aquarium hero's models and textures into public/models/aquarium.
cd "$(dirname "$0")"
blender -b --factory-startup -P fish.py -- out/fish > logs_fish.txt 2>&1
python3 fish_tex.py out/fish ../../public/models/aquarium
blender -b --factory-startup -P hardscape.py -- out/hardscape > logs_hardscape.txt 2>&1
cp out/hardscape/*.glb ../../public/models/aquarium/
