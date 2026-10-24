"""Blender 4+ handoff. Run inside Blender, not ordinary Python.
blender --background --python scripts/blender-import-dawg.py -- character.glb master.blend
This creates a fresh project; it does not modify the source GLB.
"""
import sys
from pathlib import Path
import bpy
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 2:
    raise SystemExit('Expected input.glb output.blend after --')
source, output = (Path(p).resolve() for p in args)
if not source.is_file() or output.suffix.lower() != '.blend':
    raise SystemExit('Input must exist and output must end in .blend')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.ops.import_scene.gltf(filepath=str(source))
collection = bpy.data.collections.new('DAWG_MASTER')
bpy.context.scene.collection.children.link(collection)
for obj in list(bpy.context.scene.objects):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
for name, location, energy, color, size in [
    ('Key softbox', (-3, -4, 5), 800, (1, .87, .73), 4),
    ('Mint fill', (3, -2, 2), 450, (.6, 1, .85), 3),
    ('Violet rim', (2, 3, 4), 1000, (.75, .5, 1), 3),
]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.color, data.shape, data.size = energy, color, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    from mathutils import Vector
    obj.rotation_euler = (Vector((0, 0, 1)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
bpy.context.scene.render.fps = 25
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output))
print('Editable DAWG master saved:', output)
