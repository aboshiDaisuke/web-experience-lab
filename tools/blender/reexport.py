import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:]
PID, OUT = argv[0], argv[1]
removed = 0
for m in bpy.data.materials:
    if not m.use_nodes: continue
    for n in list(m.node_tree.nodes):
        if n.type in ('TEX_IMAGE', 'SEPARATE_COLOR', 'MATH') and m.name.startswith('potted_plant') and (n.type != 'TEX_IMAGE' or n.image.name.endswith('_rough')):
            m.node_tree.nodes.remove(n); removed += 1
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b and m.name.startswith('potted_plant'):
        b.inputs['Roughness'].default_value = 0.6; b.inputs['Metallic'].default_value = 0.0
        if m.name.endswith('leaves'):
            d = next(n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image.name.endswith('_diff'))
            m.node_tree.links.new(d.outputs['Alpha'], b.inputs['Alpha'])
for img in bpy.data.images:
    if img.name.startswith(PID + '-') or not img.size[0]:
        continue
    lim = 1024 if 'wood_floor' in img.filepath else 512
    if img.size[0] > lim:
        img.scale(lim, lim)
print('removed', removed)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f'{PID}.glb'), export_format='GLB',
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_extras=True, export_lights=False, export_cameras=False,
    export_image_format='WEBP', export_image_quality=82, export_yup=True, export_apply=False)
print('EXPORTED', os.path.getsize(os.path.join(OUT, f'{PID}.glb')))
