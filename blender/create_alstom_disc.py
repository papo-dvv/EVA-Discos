"""Generador procedural del disco de freno Alstom para Blender 5.x.

Ejecuta este archivo con Run Script. Crea un disco ventilado sólido, con
caras izquierda/derecha separadas para resaltarlas en Three.js, y exporta
alstom_disc.glb junto al archivo .blend.
"""
import bpy
import math
import os
from mathutils import Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "apps", "web", "public", "models", "alstom_disc.glb"))
os.makedirs(os.path.dirname(OUT), exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0.0, roughness=0.35):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return m

STEEL = material("Acero mecanizado", (0.55, 0.59, 0.64), 0.92, 0.2)
STEEL_DARK = material("Acero interior", (0.18, 0.23, 0.29), 0.8, 0.27)
VENT = material("Aletas ventiladas", (0.19, 0.11, 0.055), 0.68, 0.28)
LEFT = material("Lado izquierdo seleccionable", (0.48, 0.53, 0.59), 0.9, 0.19)
RIGHT = material("Lado derecho seleccionable", (0.44, 0.49, 0.55), 0.9, 0.19)

root = bpy.data.collections.new("DISCO_ALSTOM_COMPLETO")
bpy.context.scene.collection.children.link(root)

def move_to_root(obj):
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    root.objects.link(obj)

def finish(obj, bevel=0.035):
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True
        mod = obj.modifiers.new("Bordes redondeados", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    move_to_root(obj)
    return obj

def cylinder(name, radius, depth, x, mat, vertices=96):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(x, 0, 0), rotation=(0, math.pi / 2, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return finish(obj)

def torus(name, major, minor, x, mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=96, minor_segments=24, location=(x, 0, 0), rotation=(0, math.pi / 2, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return finish(obj, 0.012)

# Cubo central. El visor de flota muestra el disco de freno, no el eje del bogie.
for spec in [
    ("Cubo izquierdo", 0.50, 0.25, -0.46, STEEL),
    ("Cubo derecho", 0.50, 0.25, 0.46, STEEL),
    ("Brida interior izquierda", 0.73, 0.12, -0.35, STEEL_DARK),
    ("Brida interior derecha", 0.73, 0.12, 0.35, STEEL_DARK),
]:
    cylinder(*spec)

# Las dos pistas son objetos independientes: el frontend puede cambiar su material.
for name, x, mat in [("Pista izquierda", -0.35, LEFT), ("Pista derecha", 0.35, RIGHT)]:
    cylinder(name, 1.46, 0.13, x, mat)
    torus(name + " borde exterior", 1.29, 0.10, x, STEEL)
    torus(name + " borde interior", 0.72, 0.07, x, STEEL_DARK)
    torus(name + " canal de desgaste", 1.02, 0.028, x - (0.08 if x < 0 else -0.08), STEEL_DARK)

cylinder("Nucleo central ventilado", 0.66, 0.28, 0, STEEL_DARK)

# 30 aletas independientes entre las pistas. Los espacios libres forman los
# canales de ventilación que se aprecian al girar el modelo.
for i in range(30):
    angle = (2 * math.pi * i) / 30
    y, z = math.cos(angle) * 1.07, math.sin(angle) * 1.07
    bpy.ops.mesh.primitive_cube_add(location=(0, y, z))
    vent = bpy.context.object
    vent.name = f"Canal ventilacion {i + 1:02d}"
    vent.dimensions = (0.57, 0.12, 0.44)
    vent.rotation_euler[0] = angle
    vent.data.materials.append(VENT)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(vent)

for i in range(8):
    angle = (2 * math.pi * i) / 8
    y, z = math.cos(angle) * 0.42, math.sin(angle) * 0.42
    bolt = cylinder(f"Perno {i + 1:02d}", 0.045, 0.22, 0, STEEL_DARK, 32)
    bolt.location.y, bolt.location.z = y, z
torus("Anillo cubo", 0.38, 0.075, 0, STEEL)

# Presentación de Blender (el GLB incluye solo la geometría/materiales).
bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, -1.62))
floor = bpy.context.object
floor.name = "Suelo presentación"
floor.data.materials.append(material("Suelo", (0.025, 0.04, 0.065), 0.1, 0.3))

bpy.ops.object.camera_add(location=(4.8, 3.2, 5.5))
camera = bpy.context.object
camera.name = "Cámara presentación"
camera.data.lens = 52
camera.rotation_euler = ((Vector((0, 0, 0)) - camera.location).to_track_quat('-Z', 'Y')).to_euler()
bpy.context.scene.camera = camera

for name, location, energy, color in [
    ("Luz principal", (3.5, 3.5, 5), 1100, (0.82, 0.92, 1.0)),
    ("Luz verde", (-3, -2, 2.5), 700, (0.15, 1.0, 0.62)),
    ("Luz azul", (1, -4, 1), 850, (0.18, 0.38, 1.0)),
]:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.color = color
    light.data.shape = "DISK"
    light.data.size = 3.5

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x, scene.render.resolution_y = 900, 700
scene.render.resolution_percentage = 100
scene.render.filepath = os.path.abspath(os.path.join(SCRIPT_DIR, "alstom_disc_preview.png"))
scene.world.color = (0.008, 0.012, 0.025)

bpy.ops.object.select_all(action="DESELECT")
for obj in root.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = next(iter(root.objects))
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True)
print(f"Modelo exportado en: {OUT}")
