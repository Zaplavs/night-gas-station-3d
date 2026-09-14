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


def mat(name, color, metallic=0.0, roughness=0.72, emission=None, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color, alpha)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 1:
        try:
            m.surface_render_method = "DITHERED"
        except Exception:
            m.blend_method = "BLEND"
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
    "glass": mat("Night glass", (0.04, 0.18, 0.22), metallic=0.12, roughness=0.18, alpha=.34),
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
    "lime": mat("Fresh green", (0.16, 0.62, 0.3), emission=(0.03, 0.2, 0.08)),
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
    # Shop shell. The room is deep on purpose: customers now come inside, so the
    # hall in front of the counter has to hold a queue of people.
    cube("ShopFloor", (0, .12, 2.0), (4.8, .12, 4.6), M["concrete"])
    # The walls run up into the slab of the floor above: the old ones stopped at
    # 3.3 and left a slot under it that you could see the whole shop through.
    cube("BackWall", (0, 1.78, 6.5), (4.8, 1.78, .12), M["cream"])
    cube("LeftWall", (-4.68, 1.78, 2.0), (.12, 1.78, 4.6), M["cream"])
    cube("RightWall", (4.68, 1.78, 2.0), (.12, 1.78, 4.6), M["cream"])
    cube("Roof", (0, 3.35, 2.0), (4.95, .12, 4.75), M["darkred"])
    cube("RedFascia", (0, 3.06, -2.55), (4.8, .49, .18), M["red"])
    number_24("ShopSign", (0, 3.06, -2.77), .82, mirror=True)
    # Glazed storefront with a two-leaf automatic sliding entrance.
    cube("EntranceGlassLeft", (-3.0, 1.31, -2.61), (1.68, 1.2, .045), M["glass"], .025)
    cube("EntranceGlassRight", (3.0, 1.31, -2.61), (1.68, 1.2, .045), M["glass"], .025)
    cube("EntranceFrameTop", (0, 2.48, -2.63), (4.7, .07, .08), M["chrome"], .025)
    for x in (-4.67, -1.27, 1.27, 4.67):
        cube("EntranceFrame", (x, 1.3, -2.63), (.055, 1.23, .08), M["chrome"], .02)
    for side, x in (("Left", -.62), ("Right", .62)):
        cube(f"Door{side}Glass", (x, 1.3, -2.68), (.6, 1.17, .035), M["glass"], .02)
        cube(f"Door{side}Top", (x, 2.49, -2.7), (.6, .04, .055), M["chrome"], .015)
        cube(f"Door{side}Bottom", (x, .1, -2.7), (.6, .04, .055), M["chrome"], .015)
        edge = -.585 if side == "Left" else .585
        cube(f"Door{side}Edge", (x+edge, 1.3, -2.7), (.035, 1.2, .055), M["chrome"], .015)
        handle = .42 if side == "Left" else -.42
        cube(f"Door{side}Handle", (x+handle, 1.26, -2.75), (.035, .3, .035), M["yellow"], .02)
    # Hall: a mat at the door, a bin and a standing table. People wait here.
    cube("EntranceMat", (0, .245, -1.95), (2.3, .02, .6), M["charcoal"], .02)
    cyl("TrashBin", (-4.05, .55, -1.75), .43, 1.1, M["green"], 10)
    # Counter with a register: the service line of the shop.
    cube("Counter", (0, .65, 1.15), (2.9, .65, .55), M["brown"])
    cube("CounterTop", (0, 1.34, 1.15), (3.05, .08, .67), M["charcoal"])
    cube("Register", (0, 1.56, 1.24), (.3, .14, .22), M["charcoal"], .04)
    cube("RegisterScreen", (0, 1.62, 1.0), (.22, .1, .02), M["cyan"], .015)
    # Coffee and food stand behind the counter, facing the hall.
    cube("CoffeeMachine", (-1.95, 1.78, 1.3), (.55, .55, .38), M["charcoal"])
    cube("CoffeePanel", (-1.95, 1.86, .9), (.36, .27, .025), M["cyan"])
    cyl("CoffeePot", (-1.95, 1.58, .83), .19, .32, M["coffee"], 10)
    cube("FoodStation", (1.95, 1.72, 1.3), (.62, .48, .4), M["charcoal"], .08)
    cube("FoodGlass", (1.95, 1.82, .88), (.5, .3, .025), M["glass"], .02)
    cube("FoodPanel", (1.95, 1.42, .86), (.28, .08, .025), M["yellow"], .015)
    for x in (1.67, 1.95, 2.23):
        cube("Sandwich", (x, 1.78, .85), (.11, .08, .04), M["yellow"], .025)
    # Roller grill on the left wall: hot dogs take longer than anything else.
    cube("GrillBase", (-3.95, .55, 4.45), (.5, .55, .95), M["charcoal"])
    cube("GrillTop", (-3.95, 1.13, 4.45), (.54, .05, .98), M["chrome"], .02)
    for z in (3.72, 4.07, 4.42, 4.77, 5.12):
        cyl("GrillRoller", (-3.95, 1.22, z), .07, .88, M["chrome"], 8, rotation=(0,0,math.pi/2))
    for z in (3.89, 4.24, 4.59, 4.94):
        cube("GrillSausage", (-3.95, 1.31, z), (.3, .07, .07), M["red"], .03)
    cube("GrillHood", (-3.95, 1.72, 5.26), (.5, .46, .15), M["charcoal"], .05)
    cube("GrillPanel", (-3.68, 1.3, 3.55), (.03, .12, .2), M["yellow"], .015)
    # Drinks fridge on the right wall; its stock lives upstairs with everything else.
    # Открытый холодильник: банки должны читаться из зала, поэтому дверцы нет.
    cube("FridgeBack", (4.32, 1.05, 4.45), (.18, 1.05, .95), M["chrome"], .04)
    cube("FridgeTop", (4.04, 2.01, 4.45), (.46, .09, .95), M["chrome"], .04)
    cube("FridgeBottom", (4.04, .14, 4.45), (.46, .14, .95), M["chrome"], .04)
    for z in (3.56, 5.34):
        cube("FridgeSide", (4.04, 1.05, z), (.46, .92, .06), M["chrome"], .03)
    for row in range(3):
        cube("FridgeShelf", (4.04, .5 + row*.62, 4.45), (.42, .03, .86), M["chrome"], .01)
        for i in range(4):
            cyl("FridgeCan", (3.96, .68 + row*.62, 3.78 + i*.45), .07, .22, M["cyan"], 8)
    cube("FridgeLight", (4.04, 1.9, 4.45), (.4, .04, .84), M["cyan"], .02)
    # Shelves against the back wall keep the depth of the room readable.
    for x in (-1.5, 1.5):
        cube("ShelfFrame", (x, 1.25, 6.0), (1.42, 1.2, .38), M["charcoal"])
        for row in range(3):
            cube("Shelf", (x, .48 + row*.75, 5.58), (1.5, .045, .44), M["chrome"])
            for col in range(5):
                color = M["yellow"] if (row+col)%2 else M["red"]
                cube("Product", (x-1.02+col*.51, .68 + row*.75, 5.5), (.18,.18,.2), color, .025)
    cube("StockCrate", (3.62, .35, 6.0), (.46, .35, .38), M["brown"], .08)
    cube("StockCrateMark", (3.62, .37, 5.6), (.2, .13, .025), M["yellow"], .025)
    # High-contrast utility points: the panel by the counter, the lost-and-found at the door.
    cube("FuseFrame", (-4.47, 1.45, 1.2), (.18, .72, .62), M["yellow"], .07)
    cube("FuseBox", (-4.27, 1.45, 1.2), (.06, .58, .49), M["chrome"], .04)
    cube("FuseLamp", (-4.19, 1.68, 1.2), (.025,.14,.14), M["red"], .025)
    cube("FuseHandle", (-4.18, 1.32, 1.2), (.025,.16,.055), M["charcoal"], .02)
    cube("LostAndFound", (4.05, .5, -2.05), (.6,.5,.44), M["brown"], .1)
    cube("LostAndFoundLid", (4.05, 1.04, -2.05), (.64,.07,.48), M["yellow"], .04)
    cube("LostAndFoundSign", (4.05, 1.52, -1.66), (.56,.3,.04), M["cyan"], .06)
    cube("LostAndFoundIcon", (4.05, 1.52, -1.72), (.18,.14,.025), M["charcoal"], .035)
    # Canopy and two islands.
    for x in (-2.55, 2.55):
        cube("CanopyPost", (x, 2.5, -7.4), (.16, 2.5, .16), M["white"])
    cube("Canopy", (0, 5.0, -7.4), (5.5,.22,3.05), M["white"])
    cube("CanopyStripe", (0, 4.84, -10.38), (5.5,.36,.12), M["red"])
    for x in (-2.55, 2.55):
        cube("CanopyLight", (x,4.72,-7.4), (1.25,.04,.5), M["cyan"], .02)
        cube("PumpIsland", (x,.12,-7.4), (1.15,.12,1.05), M["concrete"])
    # Left wing: a third bay stands away from the canopy, on its own mast light,
    # next to the fill point of the underground tank.
    cube("PumpIsland", (-6.6,.12,-7.4), (1.15,.12,1.05), M["concrete"])
    cube("PostMast", (-6.6,2.35,-8.5), (.13,2.35,.13), M["white"])
    cube("PostArm", (-6.6,4.58,-7.95), (.09,.09,.66), M["white"])
    cube("CanopyLightPost", (-6.6,4.46,-7.4), (1.08,.05,.46), M["cyan"], .02)
    cube("PostSign", (-6.6,3.3,-8.62), (.52,.4,.06), M["red"], .05)
    cube("PostSignBar", (-6.6,3.3,-8.69), (.3,.07,.03), M["yellow"], .015)
    # Fill point: a hatch in a concrete pad, guarded from the driveway by bollards.
    cube("TankPad", (-10.2,.09,-2.4), (1.45,.09,1.45), M["concrete"], .03)
    cyl("TankHatch", (-10.2,.2,-2.4), .66, .1, M["chrome"], 12)
    cyl("TankHatchRim", (-10.2,.17,-2.4), .74, .08, M["yellow"], 12)
    cyl("TankCap", (-10.2,.29,-2.4), .2, .12, M["charcoal"], 8)
    for x in (-11.5,-8.9):
        cyl("TankBollard", (x,.5,-3.7), .11, 1.0, M["yellow"], 8)
    cube("TankSignPost", (-11.5,.95,-2.4), (.06,.45,.06), M["chrome"], .02)
    cube("TankSign", (-11.5,1.55,-2.4), (.06,.34,.52), M["red"], .04)
    cube("TankSignMark", (-11.57,1.55,-2.4), (.02,.2,.3), M["yellow"], .02)
    # Sign and trash bin.
    cube("SignPost", (-6.6,2.2,-5.2), (.12,2.2,.12), M["chrome"])
    cube("RoadSign", (-6.6,4.25,-5.2), (1.15,1.0,.13), M["red"])
    number_24("RoadSign24", (-6.6,4.34,-5.36), 1.15, mirror=True)
    export("station")


def make_second_floor():
    """A real walkable stock room and exterior stair above the shop."""
    reset()
    # The slab covers the whole shop below: a shorter room would leave a gap
    # over the back of the store, and the see-through roof would show it.
    cube("UpperFloor", (0, 3.56, 2.0), (4.58, .12, 4.48), M["concrete"], .025)
    cube("UpperBackWall", (0, 4.78, 6.36), (4.58, 1.1, .12), M["cream"])
    cube("UpperLeftWall", (-4.48, 4.78, 2.0), (.12, 1.1, 4.25), M["cream"])
    # The right-hand wall has a proper doorway onto the outside landing.
    # The front piece runs right up to the door frame: a narrow slot used to be
    # left beside it, and the lit stock room showed through from the landing.
    cube("UpperRightWallFront", (4.48, 4.78, .02), (.12, 1.1, 2.27), M["cream"])
    cube("UpperRightWallBack", (4.48, 4.78, 5.17), (.12, 1.1, 1.18), M["cream"])
    cube("UpperDoorHeader", (4.48, 5.75, 3.15), (.14, .13, .86), M["charcoal"], .025)
    for z in (2.36, 3.94):
        cube("UpperDoorFrame", (4.58, 4.7, z), (.13, 1.05, .07), M["charcoal"], .02)
    cube("UpperDoor", (4.61, 4.68, 3.15), (.055, .96, .72), M["red"], .045)
    cube("UpperDoorWindow", (4.55, 4.93, 3.15), (.018, .34, .48), M["glass"], .018)
    cube("UpperDoorHandle", (4.50, 4.62, 2.63), (.035, .22, .035), M["yellow"], .018)

    # Front windows keep the room visible instead of turning it into a box.
    cube("UpperFrontBase", (0, 4.02, -2.36), (4.48, .43, .12), M["red"])
    cube("UpperFrontGlass", (0, 4.95, -2.38), (3.95, .47, .045), M["glass"], .025)
    for x in (-4.42, -2.0, 0, 2.0, 4.42):
        cube("UpperWindowFrame", (x, 4.95, -2.43), (.06, .53, .08), M["charcoal"], .02)
    cube("UpperFascia", (0, 5.7, -2.4), (4.58, .25, .14), M["red"])
    cube("UpperRoof", (0, 6.0, 2.0), (4.72, .13, 4.62), M["darkred"], .035)

    # Four supply racks along the back wall — one per counter downstairs.
    # The coloured band says what is on the shelf; cartons make the stock legible.
    racks = ((-3.3, "CoffeeStock", M["cyan"]), (-1.1, "SnackStock", M["yellow"]),
             (1.1, "HotdogStock", M["red"]), (3.3, "SodaStock", M["lime"]))
    for x, prefix, band in racks:
        cube(prefix + "Rack", (x, 4.35, 5.95), (1.05, .72, .42), M["charcoal"], .045)
        for row in range(2):
            cube(prefix + "Shelf", (x, 3.92 + row*.72, 5.49), (1.1, .045, .48), M["chrome"], .015)
            for col in range(4):
                carton_x = x - .69 + col*.46
                cube(prefix + "Carton", (carton_x, 4.15 + row*.72, 5.53), (.17, .19, .22), M["brown"], .035)
                cube(prefix + "Band", (carton_x, 4.15 + row*.72, 5.295), (.13, .055, .018), band, .012)

    # A workbench by the door: the toolbox lives up here now, in plain sight.
    cube("ToolBench", (4.05, 4.06, 1.3), (.45, .5, .42), M["charcoal"], .04)
    cube("ToolBenchTop", (4.05, 4.6, 1.3), (.49, .06, .46), M["chrome"], .02)
    cube("ToolBoard", (4.4, 5.1, 1.3), (.06, .46, .52), M["red"], .03)
    for z, size in ((.95, .06), (1.3, .09), (1.65, .05)):
        cube("ToolBoardHook", (4.32, 5.12, z), (.02, size, size), M["chrome"], .012)

    # A cleaning nook on the same wall: mop and bucket live upstairs now.
    cube("MopBoard", (4.4, 4.5, -1.4), (.06, .42, .52), M["cyan"], .03)
    for z, size in ((-1.75, .06), (-1.4, .09), (-1.05, .05)):
        cube("MopBoardHook", (4.32, 4.52, z), (.02, size, size), M["chrome"], .012)

    # Exterior stair along the right wall. Solid stepped blocks keep the mesh
    # very cheap and match the height function used by the browser controller.
    stair_x, start_z, step_depth, steps = 5.82, -2.18, .39, 14
    for i in range(steps):
        top = .26 + (i + 1) * (3.30 / steps)
        z = start_z + i * step_depth
        cube(f"StairStep{i+1:02d}", (stair_x, top/2, z), (.82, top/2, step_depth*.52), M["concrete"], .025)
    cube("UpperLanding", (5.82, 3.56, 3.35), (1.28, .12, .78), M["concrete"], .025)
    # Rails guard only the open edges: the way from the stair to the door stays clear.
    cube("LandingRailBack", (5.82, 4.12, 4.06), (1.28, .56, .045), M["yellow"], .018)
    cube("LandingRailSide", (6.72, 4.12, 3.35), (.045, .56, .78), M["yellow"], .018)
    for i in range(5):
        z = start_z + i * 1.28
        y = .75 + i * .77
        cube("StairRailPost", (6.72, y, z), (.045, .62, .045), M["yellow"], .018)
    # A diagonal handrail authored as a beveled cylinder.
    rail_length = math.hypot(5.12, 3.08)
    rail = cyl("StairHandrail", (6.72, 2.18, .38), .045, rail_length, M["yellow"], 8,
               rotation=(math.atan2(5.12, 3.08), 0, 0))
    export("second_floor")


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
    # Отдельные окна вместо непрозрачного куба: салон и водитель читаются с любой стороны.
    cube("CarBodyRoof", (0,1.49,.2), (.84,.08,.92), M["red"], .08)
    cube("FrontWindow", (0,1.19,-.85), (.68,.28,.025), M["glass"], .015)
    cube("RearWindow", (0,1.19,1.22), (.68,.28,.025), M["glass"], .015)
    for x in (-.82,.82):
        cube("SideWindow", (x,1.19,.18), (.025,.28,.76), M["glass"], .012)
        for z in (-.84,1.2):
            cube("CarBodyPillar", (x,1.2,z), (.055,.34,.055), M["red"], .025)
    cube("Dashboard", (0,.96,-.72), (.76,.09,.18), M["charcoal"], .04)
    for x in (-.38,.38):
        cube("Seat", (x,.88,.37), (.25,.28,.3), M["charcoal"], .07)
        cube("Headrest", (x,1.17,.48), (.2,.17,.13), M["charcoal"], .05)
    # Low-poly водитель слева: голова, волосы, куртка и руки на руле.
    cyl("DriverTorso", (-.38,1.05,-.02), .2, .43, M["blue"], 8)
    sphere("DriverHead", (-.38,1.37,-.16), (.16,.18,.16), M["skin"])
    cube("DriverHair", (-.38,1.51,-.14), (.16,.055,.15), M["charcoal"], .035)
    for x in (-.54,-.22):
        cyl("DriverArm", (x,1.06,-.43), .045, .36, M["skin"], 7, rotation=(math.pi/2,0,0))
    bpy.ops.mesh.primitive_torus_add(major_radius=.18, minor_radius=.025, major_segments=10, minor_segments=5,
                                    location=gltf_loc((-.38,1.08,-.63)), rotation=gltf_rotation((math.pi/2,0,0)))
    finish(bpy.context.object, "SteeringWheel", M["charcoal"])
    cube("FrontBumper", (0,.42,-2.02), (1.0,.18,.09), M["chrome"], .05)
    cube("RearBumper", (0,.42,2.02), (1.0,.18,.09), M["chrome"], .05)
    for x in (-1.02,1.02):
        for z in (-1.25,1.25):
            cyl("Wheel", (x,.42,z), .36, .24, M["black"], 12, rotation=(0,0,math.pi/2))
            cyl("Hub", (x*1.01,.42,z), .14, .26, M["chrome"], 10, rotation=(0,0,math.pi/2))
    for x in (-.68,.68):
        cube("Headlight", (x,.62,-2.03), (.22,.14,.035), M["yellow"], .04)
        cube("TailLight", (x,.62,2.03), (.2,.13,.035), M["red"], .035)
    export("car")


def make_van():
    reset()
    # Грузовой отсек начинается позади кабины, поэтому через стёкла видно пустые сиденья.
    cube("VanBody", (0,1.0,.68), (1.12,.82,1.57), M["purple"], .16)
    cube("VanNose", (0,.55,-1.78), (1.08,.45,.74), M["purple"], .16)
    cube("VanRoof", (0,1.76,-1.5), (1.1,.1,.68), M["purple"], .07)
    cube("Windshield", (0,1.34,-2.48), (.88,.32,.035), M["glass"], .025)
    for x in (-1.09,1.09):
        cube("VanSideWindow", (x,1.34,-1.58), (.025,.32,.54), M["glass"], .012)
        for z in (-2.4,-.95):
            cube("VanPillar", (x,1.36,z), (.055,.37,.055), M["purple"], .025)
    cube("VanDashboard", (0,1.03,-2.17), (.9,.1,.18), M["charcoal"], .04)
    for x in (-.42,.42):
        cube("VanEmptySeat", (x,1.02,-1.42), (.28,.34,.32), M["charcoal"], .08)
        cube("VanEmptyHeadrest", (x,1.38,-1.28), (.21,.18,.14), M["charcoal"], .05)
    cube("MysteryCargoDoor", (0,1.0,2.52), (.82,.62,.035), M["charcoal"], .04)
    for x in (-1.08,1.08):
        for z in (-1.45,1.45):
            cyl("Wheel", (x,.43,z), .38, .24, M["black"], 12, rotation=(0,0,math.pi/2))
    for x in (-.7,.7):
        cube("Headlight", (x,.58,-2.54), (.2,.13,.035), M["yellow"], .04)
    export("mystery_van")


def make_tanker():
    """A fuel delivery truck: the barrel reads as a tanker even in a dark mirror."""
    reset()
    cube("TankerCab", (0,1.42,-2.3), (1.14,.76,.92), M["white"], .14)
    cube("TankerRoof", (0,2.24,-2.3), (1.04,.08,.8), M["white"], .06)
    cube("TankerNose", (0,.76,-3.16), (1.1,.44,.28), M["white"], .1)
    cube("TankerGrille", (0,1.0,-3.2), (.88,.26,.05), M["charcoal"], .03)
    cube("TankerBumper", (0,.48,-3.3), (1.14,.22,.12), M["chrome"], .05)
    cube("TankerWindshield", (0,1.78,-3.18), (.9,.34,.04), M["glass"], .02)
    for x in (-1.1,1.1):
        cube("TankerSideWindow", (x,1.78,-2.35), (.03,.32,.5), M["glass"], .012)
        cube("TankerMirror", (x*1.2,1.72,-3.05), (.07,.16,.05), M["charcoal"], .02)
    cube("TankerChassis", (0,.62,.35), (.92,.16,2.95), M["charcoal"], .05)
    cyl("TankerBarrel", (0,1.46,.5), .92, 3.4, M["chrome"], 14, rotation=(math.pi/2,0,0))
    for z in (-1.24,2.24):
        cyl("TankerBarrelCap", (0,1.46,z), .93, .1, M["white"], 14, rotation=(math.pi/2,0,0))
    for z in (-.55,1.55):
        cyl("TankerBand", (0,1.46,z), .95, .14, M["red"], 14, rotation=(math.pi/2,0,0))
    cube("TankerWalk", (0,2.42,.5), (.34,.06,1.7), M["chrome"], .03)
    cube("TankerHazardPlate", (0,1.32,2.34), (.48,.32,.06), M["yellow"], .04)
    cube("TankerHazardBar", (0,1.32,2.29), (.3,.06,.03), M["charcoal"], .015)
    # The valve cabinet faces the station: that is where the hose is taken from.
    cube("TankerValveBox", (-1.0,.92,1.15), (.22,.4,.62), M["charcoal"], .05)
    cyl("TankerHoseReel", (-1.16,1.02,1.15), .28, .2, M["red"], 10, rotation=(0,0,math.pi/2))
    cyl("TankerHoseHub", (-1.24,1.02,1.15), .09, .24, M["chrome"], 8, rotation=(0,0,math.pi/2))
    cube("TankerLadder", (-1.02,1.5,2.0), (.05,.6,.3), M["chrome"], .02)
    for x in (-1.02,1.02):
        for z in (-2.35,1.0,2.05):
            cyl("Wheel", (x,.45,z), .45, .26, M["black"], 12, rotation=(0,0,math.pi/2))
            cyl("Hub", (x*1.02,.45,z), .16, .28, M["chrome"], 8, rotation=(0,0,math.pi/2))
    for x in (-.78,.78):
        cube("Headlight", (x,.72,-3.32), (.2,.13,.035), M["yellow"], .04)
        cube("TailLight", (x,.72,2.4), (.18,.12,.035), M["red"], .035)
    export("tanker")


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


makers = {
    "station": make_station,
    "second_floor": make_second_floor,
    "pump": make_pump,
    "car": make_car,
    "mystery_van": make_van,
    "tanker": make_tanker,
    "worker": make_worker,
    "props": make_props,
}
requested = os.environ.get("NIGHT_ASSET")
if requested:
    makers[requested]()
    print("ASSET READY", requested)
else:
    for maker in makers.values():
        maker()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blender", "night_station_assets.blend"))
    print("ALL ASSETS READY")
