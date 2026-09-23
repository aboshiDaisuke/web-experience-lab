#!/bin/zsh
cd "$(dirname "$0")"
blender -b --factory-startup -P casa.py > logs_casa_build.txt 2>&1
blender -b casa.blend -P bake.py -- casa out/casa_final 512 '{"SITE":2048,"F1":2048,"F2":2048,"F1_CEIL":2048,"ROOF":1024}' > logs_casa_bake.txt 2>&1
python3 lm2webp.py out/casa_final >> logs_casa_bake.txt
blender -b --factory-startup -P luce.py > logs_luce_build.txt 2>&1
blender -b luce.blend -P bake.py -- luce out/luce_final 512 '{"F1":2048,"F1_CEIL":2048}' > logs_luce_bake.txt 2>&1
python3 lm2webp.py out/luce_final >> logs_luce_bake.txt
echo DONE > final_done.txt
cp out/casa_final/{casa.glb,*.webp,casa-bake.json} /Users/daisuke/Desktop/sample/public/models/tour/casa/
cp out/luce_final/{luce.glb,*.webp,luce-bake.json} /Users/daisuke/Desktop/sample/public/models/tour/luce/
echo COPIED >> final_done.txt
