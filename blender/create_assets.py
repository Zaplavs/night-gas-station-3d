"""Generate all original low-poly art for Night Gas Station 3D.

Run with: blender --background --python blender/create_assets.py
Every exported GLB is used by the web game; no placeholder asset pipeline.
"""
import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "public", "models")
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        pass


def mat(name, color, metallic=0.0, roughness=0.72, emission=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 2.5
    return m


M = {
    "cream": mat("Warm plaster", (0.72, 0.64, 0.49)),
    "red": mat("Station red", (0.72, 0.055, 0.035)),
    "darkred": mat("Dark red", (0.28, 0.025, 0.02)),
    "charcoal": mat("Charcoal", (0.035, 0.045, 0.055)),
    "asphalt": mat("Asphalt", (0.075, 0.09, 0.105)),
    "concrete": mat("Concrete", (0.3, 0.31, 0.3)),
    "glass": mat("Night glass", (0.04, 0.18, 0.22), metallic=0.12, roughness=0.18),
    "white": mat("Paint white", (0.78, 0.8, 0.74)),
    "yellow": mat("Safety yellow", (1.0, 0.48, 0.035), emission=(0.45, 0.12, 0.0)),
    "cyan": mat("Cold light", (0.35, 0.82, 0.9), emission=(0.28, 0.7, 0.85)),
    "green": mat("Pine green", (0.055, 0.18, 0.1)),
    "brown": mat("Cardboard", (0.38, 0.18, 0.07)),
    "coffee": mat("Coffee", (0.12, 0.045, 0.018)),
    "skin": mat("Skin", (0.76, 0.43, 0.27)),
    "blue": mat("Worker blue", (0.04, 0.18, 0.3)),
    "black": mat("Rubber", (0.012, 0.014, 0.016)),
    "chrome": mat("Metal", (0.22, 0.25, 0.27), metallic=0.8, roughness=0.3),
    "purple": mat("Mystic violet", (0.25, 0.035, 0.36), emission=(0.18, 0.0, 0.35)),
}


def finish(obj, name, material=None):
    obj.name = name
    if material:
        obj.data.materials.append(material)
    return obj


def gltf_loc(loc):
    """Author in Three.js-style Y-up coordinates, create in Blender Z-up."""
    x, y, z = loc
    return (x, -z, y)


def gltf_scale(scale):
    x, y, z = scale
    return (x, z, y)


def gltf_rotation(rotation):
    x, y, z = rotation
    return (x, -z, y)


def cube(name, loc, scale, material, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(location=gltf_loc(loc))
    o = finish(bpy.context.object, name, material)
    o.scale = gltf_scale(scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("Soft low-poly edges", "BEVEL")
        mod.width = bevel
        mod.segments = 1
    return o


def cyl(name, loc, radius, depth, material, vertices=12, rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=gltf_loc(loc), rotation=gltf_rotation(rotation))
    return finish(bpy.context.object, name, material)


def sphere(name, loc, scale, material):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=gltf_loc(loc))
    o = finish(bpy.context.object, name, material)
    o.scale = gltf_scale(scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return o


def text_obj(name, text, loc, size, material, rotation=(math.pi/2,0,0), extrude=.018):
    bpy.ops.object.text_add(location=gltf_loc(loc), rotation=(-math.pi/2,0,0))
    o = bpy.context.object
    o.name, o.data.body, o.data.align_x = name, text, "CENTER"
    o.data.size, o.data.extrude, o.data.bevel_depth = size, extrude, .006
    o.data.materials.append(material)
    return o


def number_24(prefix, loc, scale=1.0, mirror=False):
    """Build a camera-facing 24 from geometry so glyphs can never mirror in GLTF."""
    segments = {
        "a": (0, .42, "h"), "b": (.25, .21, "v"), "c": (.25, -.21, "v"),
        "d": (0, -.42, "h"), "e": (-.25, -.21, "v"), "f": (-.25, .21, "v"),
        "g": (0, 0, "h")
    }
    glyphs = {"2": "abged", "4": "fgbc"}
    cx, cy, cz = loc
    for digit_index, digit in enumerate("24"):
        dx = (-.34 if digit_index == 0 else .34) * scale
        for seg in glyphs[digit]:
            sx, sy, axis = segments[seg]
            dims = ((.19, .038, .022) if axis == "h" else (.038, .19, .022))
            horizontal = dx + sx*scale
            cube(f"{prefix}_{digit}_{seg}", (cx + (-horizontal if mirror else horizontal), cy + sy*scale, cz),
                 tuple(v*scale for v in dims), M["yellow"], .012*scale)


def export(name):
    bpy.ops.object.select_all(action="SELECT")
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True, export_materials="EXPORT",
                              export_normals=True)
    print("EXPORTED", path)


def make_station():
    reset()
    # Shop shell, deliberately open on the forecourt side for readable isometric play.
    cube("ShopFloor", (0, .12, 1.2), (4.8, .12, 3.8), M["concrete"])
    cube("BackWall", (0, 1.65, 4.9), (4.8, 1.65, .12), M["cream"])
    cube("LeftWall", (-4.68, 1.65, 1.2), (.12, 1.65, 3.8), M["cream"])
    cube("RightWall", (4.68, 1.65, 1.2), (.12, 1.65, 3.8), M["cream"])
    cube("Roof", (0, 3.35, 1.2), (4.95, .12, 3.95), M["darkred"])
    cube("RedFascia", (0, 2.95, -2.55), (4.8, .38, .18), M["red"])
    number_24("ShopSign", (0, 3.0, -2.77), .82, mirror=True)
    # Counter and readable shop stations.
    cube("Counter", (0, .65, -.55), (2.9, .65, .55), M["brown"])
    cube("CounterTop", (0, 1.34, -.55), (3.05, .08, .67), M["charcoal"])
    cube("CoffeeMachine", (-1.75, 1.78, -.35), (.55, .55, .38), M["charcoal"])
    cube("CoffeePanel", (-1.75, 1.86, -.75), (.36, .27, .025), M["cyan"])
    cyl("CoffeePot", (-1.75, 1.58, -.82), .19, .32, M["coffee"], 10)
    # Product shelves with real low-poly products.
    for x in (-3.55, 3.55):
        cube("ShelfFrame", (x, 1.25, 2.5), (.55, 1.2, 1.45), M["charcoal"])
        for row in range(3):
            cube("Shelf", (x, .48 + row*.75, 2.5), (.62, .045, 1.5), M["chrome"])
            for col in range(3):
                color = M["yellow"] if (row+col)%2 else M["red"]
                cube("Product", (x, .68 + row*.75, 1.65+col*.78), (.3,.18,.22), color, .025)
    cube("FuseBox", (-4.48, 1.45, 3.7), (.16, .58, .45), M["chrome"])
    cube("FuseLamp", (-4.29, 1.63, 3.7), (.025,.12,.12), M["yellow"])
    cube("LostAndFound", (4.1, .48, 4.1), (.42,.42,.5), M["brown"])
    # Canopy and two islands.
    for x in (-2.55, 2.55):
        cube("CanopyPost", (x, 2.5, -7.4), (.16, 2.5, .16), M["white"])
    cube("Canopy", (0, 5.0, -7.4), (5.5,.22,3.05), M["white"])
    cube("CanopyStripe", (0, 4.84, -10.38), (5.5,.36,.12), M["red"])
    for x in (-2.55, 2.55):
        cube("CanopyLight", (x,4.72,-7.4), (1.25,.04,.5), M["cyan"], .02)
        cube("PumpIsland", (x,.12,-7.4), (1.15,.12,1.05), M["concrete"])
    # Sign and trash bin.
    cube("SignPost", (-6.6,2.2,-5.2), (.12,2.2,.12), M["chrome"])
    cube("RoadSign", (-6.6,4.25,-5.2), (1.15,1.0,.13), M["red"])
    number_24("RoadSign24", (-6.6,4.34,-5.36), 1.15, mirror=True)
    cyl("TrashBin", (4.1,.55,-2.25), .43, 1.1, M["green"], 10)
    export("station")


def make_pump():
    reset()
    cube("PumpBody", (0,1.0,0), (.52,1.0,.38), M["red"], .1)
    cube("PumpFace", (0,1.25,-.4), (.39,.38,.035), M["charcoal"], .03)
    cube("Display", (0,1.34,-.44), (.28,.16,.02), M["cyan"], .01)
    cube("Number", (0,1.85,-.41), (.25,.16,.025), M["white"], .02)
    cyl("Hose", (.62,1.15,0), .045, 1.1, M["black"], 8)
    cube("Nozzle", (.63,.61,-.02), (.09,.25,.07), M["yellow"], .025)
    cube("PumpBase", (0,.12,0), (.72,.12,.56), M["charcoal"])
    export("pump")


def make_car():
    reset()
    cube("CarBody", (0,.55,0), (1.05,.38,2.0), M["red"], .22)
    cube("CarCabin", (0,1.03,.18), (.82,.43,1.05), M["glass"], .18)
    cube("FrontBumper", (0,.42,-2.02), (1.0,.18,.09), M["chrome"], .05)
    cube("RearBumper", (0,.42,2.02), (1.0,.18,.09), M["chrome"], .05)
    for x in (-1.02,1.02):
        for z in (-1.25,1.25):
            cyl("Wheel", (x,.42,z), .36, .24, M["black"], 12, rotation=(0,0,math.pi/2))
            cyl("Hub", (x*1.01,.42,z), .14, .26, M["chrome"], 10, rotation=(0,0,math.pi/2))
    for x in (-.68,.68):
        cube("Headlight", (x,.62,-2.03), (.22,.14,.035), M["yellow"], .04)
    export("car")


def make_van():
    reset()
    cube("VanBody", (0,.92,.25), (1.12,.82,2.25), M["purple"], .16)
    cube("VanNose", (0,.6,-2.0), (1.08,.5,.52), M["purple"], .16)
    cube("Windshield", (0,1.28,-1.78), (.88,.38,.035), M["glass"], .08)
    cube("MysteryCargoDoor", (0,1.0,2.52), (.82,.62,.035), M["charcoal"], .04)
    for x in (-1.08,1.08):
        for z in (-1.45,1.45):
            cyl("Wheel", (x,.43,z), .38, .24, M["black"], 12, rotation=(0,0,math.pi/2))
    for x in (-.7,.7):
        cube("Headlight", (x,.58,-2.54), (.2,.13,.035), M["yellow"], .04)
    export("mystery_van")


def make_worker():
    reset()
    cyl("Body", (0,1.0,0), .38, 1.0, M["blue"], 8)
    sphere("Head", (0,1.75,0), (.34,.38,.34), M["skin"])
    cube("Cap", (0,2.08,0), (.36,.08,.38), M["red"], .04)
    cube("CapPeak", (0,2.05,-.4), (.22,.04,.18), M["red"], .03)
    for x in (-.24,.24):
        cyl("Leg", (x,.36,0), .11, .62, M["charcoal"], 8)
    for x in (-.48,.48):
        cyl("Arm", (x,1.05,0), .1, .72, M["skin"], 8, rotation=(0,0,math.radians(12*x)))
    export("worker")


def make_props():
    reset()
    # A forgotten travel bag.
    cube("Bag", (0,.36,0), (.62,.36,.35), M["brown"], .12)
    bpy.ops.mesh.primitive_torus_add(major_radius=.28, minor_radius=.045, major_segments=10, minor_segments=6,
                                    location=(0,0,.79), rotation=(math.pi/2,0,0))
    finish(bpy.context.object, "BagHandle", M["brown"])
    export("bag")
    reset()
    # Mop and bucket silhouette.
    cyl("MopHandle", (0,1.1,0), .035, 2.2, M["chrome"], 8, rotation=(0,0,math.radians(-12)))
    cube("MopHead", (-.2,.08,0), (.38,.08,.18), M["cyan"], .03)
    cyl("Bucket", (.48,.35,.1), .34, .55, M["yellow"], 10)
    export("cleaning_kit")


make_station()
make_pump()
make_car()
make_van()
make_worker()
make_props()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blender", "night_station_assets.blend"))
print("ALL ASSETS READY")
