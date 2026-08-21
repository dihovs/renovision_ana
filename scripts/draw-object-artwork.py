#!/usr/bin/env python3
"""
Draw the object library, from one projection and one palette.

**Why this is a generator and not 41 hand-drawn files.** The old artwork was
hand-authored one file at a time, and it shows: the projection drifts from tile
to tile, three different objects share the same silhouette, and the doors came
out as hexagons. Consistency is most of what "professional" means in an icon
set — the eye reads a grid of them at once and forgives a simple shape long
before it forgives a set that does not agree with itself.

So there is exactly one isometric projection here, one palette, one stroke
weight, and every object is built from the same primitives. A new object is a
recipe of five lines, and it cannot come out at the wrong angle.

**Contrast is the other half.** The old fills were #F4F6F8 — near white — on a
#EDEEF0 tile. The owner's complaint was literally that he could not see them.
The faces below are mid-tone and the outline is near-black, so the silhouette
reads at 40pt on a phone in daylight, which is where these are actually used.

**Drawn here, not copied.** The owner offered to let us lift magicplan's
renders. The conventions are shared — isometric, three-tone faces, a red swing
arrow on a door — because those are how the trade draws these and are nobody's
property. The artwork is ours, so it does not have to be torn out later.
"""
import math, os

K = math.cos(math.radians(30))
OUT = os.path.join(os.path.dirname(__file__), "..", "ios/App/App/Native/Artwork")

INK      = "#252A31"
TOP      = "#EEF1F5"
RIGHT    = "#CBD3DC"
LEFT     = "#A9B4C0"
GLASS    = "#9CC6E8"
GLASS_D  = "#7DAFD9"
WOOD     = "#C79A68"
WOOD_D   = "#A87C4E"
METAL    = "#C3CAD2"
DARK     = "#6E7884"
WHITEISH = "#F7F9FB"
WARN     = "#D14836"

SW = 2.4          # outline
SWT = 1.5         # detail

def iso(x, y, z):
    return ((x - y) * K, (x + y) * 0.5 - z)

def pts(ps):
    return " ".join(f"{x:.2f},{y:.2f}" for x, y in ps)

def poly(ps, fill, stroke=INK, w=SW, extra=""):
    return f'<polygon points="{pts(ps)}" fill="{fill}" stroke="{stroke}" stroke-width="{w}" stroke-linejoin="round"{extra}/>'

def box(x, y, z, w, d, h, top=TOP, right=RIGHT, left=LEFT, stroke=INK, sw=SW):
    """A solid, three visible faces, back to front."""
    t = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)]
    r = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)]
    l = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)]
    return "".join([poly(t, top, stroke, sw), poly(r, right, stroke, sw), poly(l, left, stroke, sw)])

def face_l(x, y, z, w, h, fill, stroke=INK, sw=SWT):
    """A panel on the left (+y) face — the one facing the viewer's lower left."""
    ps = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y, z + h), iso(x, y, z + h)]
    return poly(ps, fill, stroke, sw)

def face_r(x, y, z, d, h, fill, stroke=INK, sw=SWT):
    """A panel on the right (+x) face."""
    ps = [iso(x, y, z), iso(x, y + d, z), iso(x, y + d, z + h), iso(x, y + d, z + h - h)] if False else \
         [iso(x, y, z), iso(x, y + d, z), iso(x, y + d, z + h), iso(x, y, z + h)]
    return poly(ps, fill, stroke, sw)

def face_t(x, y, z, w, d, fill, stroke=INK, sw=SWT):
    ps = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)]
    return poly(ps, fill, stroke, sw)

def disc_t(x, y, z, r, fill, stroke=INK, sw=SWT):
    """A circle lying on a horizontal surface — an ellipse under this projection."""
    cx, cy = iso(x, y, z)
    return (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{r*K*1.41:.2f}" ry="{r*0.71:.2f}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

def line(a, b, stroke=INK, w=SWT, cap="round"):
    (x1, y1), (x2, y2) = iso(*a), iso(*b)
    return (f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" '
            f'stroke="{stroke}" stroke-width="{w}" stroke-linecap="{cap}"/>')

def shadow(x, y, w, d):
    cx, cy = iso(x + w / 2, y + d / 2, 0)
    return (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{(w+d)*0.30:.2f}" ry="{(w+d)*0.15:.2f}" '
            f'fill="#0B1220" opacity="0.10"/>')

def svg(body, pad=6):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -46 100 100">'
            + body + "</svg>")

# ---------------------------------------------------------------- recipes

def appliance(w, d, h, *, door=None, dial=False, vent=0, feet=False):
    """A box appliance — the shared body behind washer, dryer, fridge, etc."""
    s = shadow(0, 0, w, d)
    s += box(0, 0, 0, w, d, h)
    if door == "porthole":
        # Centred on the left face, which is the one facing the viewer — it
        # was pinned to x=0 and came out straddling the corner.
        cx, cy = iso(w / 2, d, h * 0.48)
        s += (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{d*0.30*K*1.2:.2f}" ry="{h*0.22:.2f}" '
              f'fill="{GLASS}" stroke="{INK}" stroke-width="{SWT}"/>')
    elif door == "panel":
        s += face_l(w * 0.12, d, h * 0.10, w * 0.76, h * 0.72, WHITEISH)
    if dial:
        s += face_l(w * 0.14, d, h * 0.80, w * 0.30, h * 0.10, DARK)
    for i in range(vent):
        z = h * (0.30 + i * 0.14)
        s += line((w * 0.15, d, z), (w * 0.85, d, z), DARK, 1.3)
    if feet:
        for fx, fy in ((0.1, 0.1), (0.9, 0.1), (0.9, 0.9), (0.1, 0.9)):
            s += line((w * fx, d * fy, 0), (w * fx, d * fy, -h * 0.10), INK, 2.0)
    return s


def panel(x1, y1, x2, y2, z0, h, t=1.0, top=TOP, face=RIGHT, back=LEFT, sw=SW):
    """
    A vertical panel from (x1,y1) to (x2,y2), `h` tall and `t` thick.

    The door leaves need this: `box` can only stand square to the axes, and a
    door that is not ajar is not a door — it is a rectangle. Whichever of the
    two broad faces points toward the camera is drawn in the lighter ink.
    """
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1.0
    ux, uy = dx / L, dy / L
    nx, ny = -uy * t / 2, ux * t / 2
    # The viewer sits toward (+x, +y); the face whose normal agrees is nearer.
    near = 1 if (-uy + ux) > 0 else -1
    a = (x1 + nx * near, y1 + ny * near)
    b = (x2 + nx * near, y2 + ny * near)
    c = (x2 - nx * near, y2 - ny * near)
    d = (x1 - nx * near, y1 - ny * near)
    out = poly([iso(a[0], a[1], z0 + h), iso(b[0], b[1], z0 + h),
                iso(c[0], c[1], z0 + h), iso(d[0], d[1], z0 + h)], top, INK, sw)
    out += poly([iso(a[0], a[1], z0), iso(b[0], b[1], z0),
                 iso(b[0], b[1], z0 + h), iso(a[0], a[1], z0 + h)], face, INK, sw)
    out += poly([iso(b[0], b[1], z0), iso(c[0], c[1], z0),
                 iso(c[0], c[1], z0 + h), iso(b[0], b[1], z0 + h)], back, INK, sw)
    return out


def swing_arrow(hx, hy, r, a0, a1, z=0.4):
    """The red arc a door sweeps, drawn on the floor — their convention, and
       the only mark that says which way the thing opens."""
    steps = 18
    pts_ = []
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        pts_.append(iso(hx + r * math.cos(a), hy + r * math.sin(a), z))
    d = "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in pts_)
    out = f'<path d="{d}" fill="none" stroke="{WARN}" stroke-width="1.9" stroke-linecap="round"/>'
    # Head, aimed along the tangent at the far end.
    a = math.radians(a1)
    tip = iso(hx + r * math.cos(a), hy + r * math.sin(a), z)
    back_a = math.radians(a1 - 13 * (1 if a1 > a0 else -1))
    bx, by = iso(hx + r * 0.90 * math.cos(back_a), hy + r * 0.90 * math.sin(back_a), z)
    sx, sy = iso(hx + r * 1.10 * math.cos(back_a), hy + r * 1.10 * math.sin(back_a), z)
    out += (f'<path d="M {tip[0]:.2f} {tip[1]:.2f} L {bx:.2f} {by:.2f} '
            f'L {sx:.2f} {sy:.2f} Z" fill="{WARN}"/>')
    return out


RECIPES = {}
def recipe(name):
    def wrap(fn):
        RECIPES[name] = fn
        return fn
    return wrap

# --- appliances and machines, each with its OWN silhouette ------------------

@recipe("washer")
def _():  return appliance(20, 20, 24, door="porthole", dial=True)

@recipe("dryer")
def _():
    # Same footprint as a washer, so it is told apart by its vent, not by luck.
    s = appliance(20, 20, 24, door="porthole", dial=True)
    s += line((20, 10, 20), (26, 10, 20), DARK, 3.0)
    s += line((26, 10, 20), (26, 10, 30), DARK, 3.0)
    return s

@recipe("dishwasher")
def _():  return appliance(19, 20, 22, door="panel", vent=0) + face_l(3, 20, 19.5, 13, 1.6, DARK)

@recipe("refrigerator")
def _():
    s = appliance(20, 20, 40, door="panel")
    s += line((2.4, 20, 26), (17.6, 20, 26), INK, 2.0)      # freezer split
    s += line((16, 20, 20), (16, 20, 24), DARK, 2.4)         # handles
    s += line((16, 20, 28), (16, 20, 32), DARK, 2.4)
    return s

@recipe("range")
def _():
    s = shadow(0, 0, 20, 20) + box(0, 0, 0, 20, 20, 22)
    for bx, by in ((6, 6), (14, 6), (6, 14), (14, 14)):
        s += disc_t(bx, by, 22.2, 2.6, DARK)
    s += face_l(3, 20, 4, 14, 12, GLASS)                     # oven window
    s += line((3, 20, 17.5), (17, 20, 17.5), DARK, 2.4)
    return s

@recipe("oven")
def _():  return RECIPES["range"]()

@recipe("water_heater")
def _():
    s = shadow(0, 0, 18, 18)
    s += box(0, 0, 0, 18, 18, 34, top=TOP)
    s += face_l(4, 18, 10, 10, 8, WHITEISH)
    s += line((18, 4, 34), (18, 4, 40), METAL, 3.0)
    s += line((0, 14, 30), (-6, 14, 30), METAL, 3.0)
    return s

@recipe("furnace")
def _():
    s = shadow(0, 0, 20, 20) + box(0, 0, 0, 20, 20, 30)
    s += face_l(3, 20, 16, 14, 11, WHITEISH)
    s += face_l(3, 20, 4, 14, 9, DARK)
    s += line((10, 0, 30), (10, 0, 38), METAL, 3.4)
    return s

@recipe("air_handler")
def _():
    s = shadow(0, 0, 22, 18) + box(0, 0, 0, 22, 18, 20)
    for i in range(4):
        s += line((3 + i * 4.6, 18, 3), (3 + i * 4.6, 18, 17), DARK, 1.6)
    s += line((11, 0, 20), (11, 0, 27), METAL, 3.4)
    return s

@recipe("air_mover")
def _():
    # A snail-shell blower, low and wide — nothing else in the set is this shape.
    s = shadow(0, 0, 22, 16)
    s += box(0, 0, 0, 22, 16, 14)
    cx, cy = iso(0, 8, 8)
    s += (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="7.5" ry="6.5" fill="{DARK}" '
          f'stroke="{INK}" stroke-width="{SWT}"/>')
    s += (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="3" ry="2.6" fill="{METAL}"/>')
    s += line((22, 4, 2), (22, 12, 2), INK, 2.2)
    return s

@recipe("air_mover_axial")
def _():  return RECIPES["air_mover"]()
@recipe("air_mover_centrifugal")
def _():  return RECIPES["air_mover"]()

@recipe("dehumidifier")
def _():
    s = shadow(0, 0, 18, 18) + box(0, 0, 0, 18, 18, 26)
    s += face_l(3, 18, 14, 12, 9, GLASS)                     # tank window
    for i in range(3):
        s += line((3, 18, 4 + i * 3), (15, 18, 4 + i * 3), DARK, 1.4)
    s += line((0, 4, 0), (0, 4, -3), INK, 2.2)               # castors
    s += line((18, 4, 0), (18, 4, -3), INK, 2.2)
    return s

@recipe("dehumidifier_lgr")
def _():  return RECIPES["dehumidifier"]()
@recipe("dehumidifier_desiccant")
def _():  return RECIPES["dehumidifier"]()

@recipe("air_scrubber")
def _():
    # A drum on its side — deliberately round where the dehumidifier is square.
    s = shadow(0, 0, 26, 16)
    s += box(0, 0, 0, 26, 16, 18)
    cx, cy = iso(0, 8, 9)
    s += (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="8" ry="7" fill="{METAL}" '
          f'stroke="{INK}" stroke-width="{SWT}"/>')
    for r in (5.4, 3.2):
        s += (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{r}" ry="{r*0.87:.2f}" '
              f'fill="none" stroke="{INK}" stroke-width="1.2"/>')
    return s

@recipe("air_scrubber_hepa")
def _():  return RECIPES["air_scrubber"]()
@recipe("hydroxyl_generator")
def _():  return RECIPES["air_scrubber"]()
@recipe("ozone_generator")
def _():  return RECIPES["air_scrubber"]()
@recipe("extraction_unit")
def _():  return RECIPES["air_scrubber"]()

@recipe("electrical_panel")
def _():
    s = shadow(0, 0, 6, 18) + box(0, 0, 0, 6, 18, 26)
    s += face_l(1.2, 18, 3, 3.6, 20, WHITEISH)
    for i in range(6):
        s += line((1.6, 18, 5 + i * 3), (5, 18, 5 + i * 3), DARK, 1.3)
    return s

# --- plumbing --------------------------------------------------------------

@recipe("toilet")
def _():
    # The old one was unreadable. A WC in plan or in iso is a TANK and a BOWL,
    # and the silhouette has to say so at 40pt: tall block at the back, round
    # mass in front, a lid on top of the round mass.
    s = shadow(-2, -2, 22, 24)
    s += box(0, 0, 0, 7, 16, 22)                              # cistern
    s += face_l(1.4, 16, 4, 4.2, 14, WHITEISH)
    # Pedestal drawn as a solid from floor to rim, so the bowl stops looking
    # like a separate object hovering beside the cistern.
    s += poly([iso(9, 3, 0), iso(19, 3, 0), iso(19, 13, 0), iso(9, 13, 0)],
              LEFT, INK, SW)
    for a in ((9, 3), (19, 3), (19, 13), (9, 13)):
        s += line((a[0], a[1], 0), (a[0], a[1], 9), INK, SW)
    cx, cy = iso(14, 8, 11)
    s += (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="12" ry="7.6" fill="{TOP}" '
          f'stroke="{INK}" stroke-width="{SW}"/>')            # rim
    s += (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="7.6" ry="4.6" fill="{GLASS}" '
          f'stroke="{INK}" stroke-width="{SWT}"/>')           # water
    s += line((7, 2, 11), (7, 14, 11), INK, SW)               # tank meets bowl
    return s

@recipe("bathtub")
def _():
    s = shadow(0, 0, 34, 18)
    s += box(0, 0, 0, 34, 18, 12)
    s += face_t(2.4, 2.4, 12.1, 29.2, 13.2, GLASS, INK, SWT)
    s += disc_t(6, 9, 12.2, 1.5, WHITEISH)
    s += line((32, 9, 12), (32, 9, 19), METAL, 2.6)
    s += line((32, 9, 19), (28, 9, 19), METAL, 2.6)
    return s

@recipe("shower_stall")
def _():
    # The enclosure is read by its BACK walls and its tray. Drawing the two
    # near panels made a butterfly — the glass has to sit behind the tray, not
    # in front of the viewer.
    s = shadow(0, 0, 20, 20)
    s += poly([iso(0, 0, 2), iso(20, 0, 2), iso(20, 0, 30), iso(0, 0, 30)],
              "#E6EEF6", INK, SWT, ' opacity="0.92"')
    s += poly([iso(0, 0, 2), iso(0, 20, 2), iso(0, 20, 30), iso(0, 0, 30)],
              "#D8E4EF", INK, SWT, ' opacity="0.92"')
    s += line((0, 0, 18), (20, 0, 18), METAL, 2.0)
    s += line((2, 0, 26), (2, 0, 22), METAL, 2.4)
    s += disc_t(3, 3, 26, 2.2, METAL)
    s += box(0, 0, 0, 20, 20, 2, top=TOP)
    s += face_t(1.6, 1.6, 2.1, 16.8, 16.8, GLASS, INK, SWT)
    s += disc_t(10, 10, 2.2, 1.4, METAL)
    return s

@recipe("shower")
def _():  return RECIPES["shower_stall"]()

def _sink(w, d, bowls):
    s = shadow(0, 0, w, d) + box(0, 0, 0, w, d, 12)
    step = w / bowls
    for i in range(bowls):
        s += face_t(i * step + 2, 2.4, 12.1, step - 4, d - 4.8, GLASS, INK, SWT)
    s += line((w * 0.5, 1.5, 12), (w * 0.5, 1.5, 19), METAL, 2.6)
    s += line((w * 0.5, 1.5, 19), (w * 0.5, 5.5, 19), METAL, 2.6)
    return s

@recipe("kitchen_sink")
def _():  return _sink(26, 16, 2)
@recipe("sink")
def _():  return _sink(16, 14, 1)
@recipe("utility_sink")
def _():  return _sink(16, 16, 1)
@recipe("vanity_24")
def _():
    s = shadow(0, 0, 20, 16) + box(0, 0, 0, 20, 16, 20)
    s += face_l(2, 16, 3, 16, 14, WHITEISH)
    s += face_t(4, 3, 20.1, 12, 10, GLASS, INK, SWT)
    return s

@recipe("laundry_tub")
def _():
    s = shadow(0, 0, 18, 16)
    s += box(0, 0, 4, 18, 16, 14)
    s += face_t(2, 2, 18.1, 14, 12, GLASS, INK, SWT)
    for fx, fy in ((1.5, 1.5), (16.5, 1.5), (16.5, 14.5), (1.5, 14.5)):
        s += line((fx, fy, 4), (fx, fy, 0), INK, 2.2)
    return s

@recipe("sump_pit")
def _():
    # A hole in the floor, not a bucket: the rim sits ON the slab.
    s = ""
    cx, cy = iso(10, 10, 0)
    s += (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="15" ry="9" fill="{LEFT}" '
          f'stroke="{INK}" stroke-width="{SW}"/>')
    s += (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="11" ry="6.5" fill="{DARK}" '
          f'stroke="{INK}" stroke-width="{SWT}"/>')
    s += (f'<ellipse cx="{cx:.2f}" cy="{cy+4:.2f}" rx="9" ry="5" fill="{GLASS_D}" '
          f'stroke="none" opacity="0.85"/>')
    s += line((10, 10, -2), (10, 10, 14), METAL, 3.0)
    s += line((10, 10, 14), (18, 10, 14), METAL, 3.0)
    return s

@recipe("floor_drain")
def _():
    s = ""
    cx, cy = iso(8, 8, 0)
    s += (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="11" ry="6.5" fill="{METAL}" '
          f'stroke="{INK}" stroke-width="{SW}"/>')
    s += (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="6" ry="3.6" fill="{DARK}" '
          f'stroke="{INK}" stroke-width="{SWT}"/>')
    return s

# --- casework and furniture ------------------------------------------------

def _cabinet(w, d, h, doors=2, drawers=0, wood=False, plinth=True):
    top_fill = WOOD if wood else TOP
    s = shadow(0, 0, w, d) + box(0, 0, 0, w, d, h, top=top_fill)
    if drawers:
        for i in range(drawers):
            z = h * (0.08 + i * (0.84 / drawers))
            s += face_l(w * 0.08, d, z, w * 0.84, h * (0.84 / drawers) - 1.2, WHITEISH)
            s += line((w * 0.42, d, z + h * (0.42 / drawers)),
                      (w * 0.58, d, z + h * (0.42 / drawers)), DARK, 2.0)
    else:
        step = w * 0.84 / doors
        for i in range(doors):
            s += face_l(w * 0.08 + i * step, d, h * 0.08, step - 1.2, h * 0.84, WHITEISH)
            hx = w * 0.08 + i * step + (step - 1.2) * (0.85 if i == 0 else 0.15)
            s += (f'<circle cx="{iso(hx, d, h*0.5)[0]:.2f}" cy="{iso(hx, d, h*0.5)[1]:.2f}" '
                  f'r="1.5" fill="{DARK}"/>')
    if plinth:
        s += line((0, d, h * 0.05), (w, d, h * 0.05), INK, 1.6)
    return s

@recipe("base_cabinet")
def _():  return _cabinet(20, 16, 20, doors=2)
@recipe("wall_cabinet")
def _():  return _cabinet(20, 12, 18, doors=2, plinth=False)
@recipe("tall_pantry")
def _():  return _cabinet(16, 14, 40, doors=1)
@recipe("cabinet")
def _():  return _cabinet(20, 16, 20, doors=2)
@recipe("dresser")
def _():  return _cabinet(22, 14, 20, drawers=3, wood=True)
@recipe("garage_shelving")
def _():  return RECIPES["shelving"]()
@recipe("workbench")
def _():  return RECIPES["desk"]()

@recipe("countertop_run")
def _():
    # Was a bare slab, identical to the bulkhead and the baseboard heater.
    # A counter is a slab ON cabinets, and that is its silhouette.
    s = shadow(0, 0, 34, 16)
    s += box(1.5, 1.5, 0, 31, 13, 18, top=WHITEISH)
    for i in range(3):
        s += face_l(3 + i * 9.6, 14.5, 2, 8.4, 14, TOP)
    s += box(0, 0, 18, 34, 16, 2.6, top=DARK, right="#5E6772", left="#4E5661")
    return s

@recipe("island")
def _():
    s = shadow(0, 0, 28, 20)
    s += box(2, 2, 0, 24, 16, 18, top=WHITEISH)
    s += box(0, 0, 18, 28, 20, 2.6, top=DARK, right="#5E6772", left="#4E5661")
    for i in range(2):
        s += face_l(5 + i * 10, 18, 2, 9, 14, TOP)
    return s

@recipe("shelving")
def _():
    s = shadow(0, 0, 22, 14)
    for i in range(4):
        s += box(0, 0, i * 9, 22, 14, 1.8, top=WOOD, right=WOOD_D, left=WOOD_D)
    for cx_, cy_ in ((0.6, 0.6), (21.4, 0.6), (21.4, 13.4), (0.6, 13.4)):
        s += line((cx_, cy_, 0), (cx_, cy_, 29), INK, 2.2)
    return s

@recipe("desk")
def _():
    s = shadow(0, 0, 26, 14)
    s += box(0, 0, 16, 26, 14, 2.2, top=WOOD, right=WOOD_D, left=WOOD_D)
    for fx, fy in ((1, 1), (25, 1), (25, 13), (1, 13)):
        s += line((fx, fy, 0), (fx, fy, 16), INK, 2.6)
    return s

@recipe("table")
def _():  return RECIPES["desk"]()

@recipe("bed_queen")
def _():
    s = shadow(0, 0, 26, 32)
    # Headboard FIRST and at the far end, so it is behind the mattress in the
    # painter's order instead of standing in front of it.
    s += box(0, 0, 0, 26, 3, 20, top=WOOD, right=WOOD_D, left=WOOD_D)
    s += box(0, 3, 0, 26, 29, 9, top=WHITEISH)                # mattress
    s += box(1.5, 4, 9, 10, 7, 2.2, top=TOP, right=RIGHT, left=RIGHT)    # pillows
    s += box(14.5, 4, 9, 10, 7, 2.2, top=TOP, right=RIGHT, left=RIGHT)
    s += line((0, 16, 9), (26, 16, 9), DARK, 1.8)             # turndown
    return s

@recipe("sofa")
def _():
    s = shadow(0, 0, 32, 16)
    # Back first, then seat, then arms — painter's order, which is what the
    # old one got wrong and why it read as a slab with rectangles on it.
    s += box(0, 0, 0, 32, 4, 18, top=TOP)                     # back
    s += box(0, 4, 0, 5, 12, 11, top=TOP)                     # left arm
    s += box(27, 4, 0, 5, 12, 11, top=TOP)                    # right arm
    s += box(5, 4, 6, 22, 12, 3.4, top=WHITEISH)              # seat cushions
    s += line((16, 4, 9.4), (16, 16, 9.4), DARK, 1.6)
    return s

@recipe("chair")
def _():
    s = shadow(0, 0, 12, 12)
    s += box(0, 0, 10, 12, 12, 2, top=WHITEISH)
    s += box(0, 0, 12, 12, 2.4, 12, top=TOP)
    for fx, fy in ((1, 1), (11, 1), (11, 11), (1, 11)):
        s += line((fx, fy, 0), (fx, fy, 10), INK, 2.2)
    return s

@recipe("television")
def _():
    s = shadow(4, 6, 20, 4)
    s += box(0, 8, 4, 28, 1.6, 16, top=DARK, right="#3A424C", left="#2F363F")
    s += face_l(1.2, 8, 5.2, 25.6, 13.6, GLASS_D)
    s += line((14, 8.8, 0), (14, 8.8, 4), INK, 2.6)
    s += line((9, 8.8, 0), (19, 8.8, 0), INK, 2.6)
    return s

@recipe("fireplace")
def _():
    s = shadow(0, 0, 26, 12)
    s += box(0, 0, 0, 26, 12, 26)
    s += face_l(4, 12, 4, 18, 13, DARK)
    s += (f'<path d="M {iso(13,12,6)[0]:.2f} {iso(13,12,6)[1]:.2f} '
          f'c -3 -3 -1 -6 1 -8 c 0 3 3 3 3 6 c 0 2 -2 3 -4 2 z" '
          f'fill="#E08A3C" stroke="{INK}" stroke-width="1.2"/>')
    s += box(-2, -2, 26, 30, 16, 2.4, top=WOOD, right=WOOD_D, left=WOOD_D)
    return s

@recipe("column")
def _():
    s = shadow(2, 2, 12, 12)
    s += box(0, 0, 0, 16, 16, 3, top=LEFT)                    # base
    s += box(3, 3, 3, 10, 10, 34)
    s += box(0, 0, 37, 16, 16, 3, top=TOP)                    # capital
    return s

@recipe("stairs")
def _():
    # Each tread drawn as a SOLID from the floor up, not as a floating slab —
    # a flight is a mass with a stepped top, and drawing the steps as separate
    # 4mm plates made a thin diagonal ribbon.
    # The flight runs along +x, so the RISERS face the viewer and the treads
    # sit on top. Running it along +y put the risers away from the camera and
    # the whole thing read as a ribbed wedge.
    # **The flight climbs AWAY from the viewer.** Both earlier attempts had it
    # climbing toward the camera, which puts the tallest step nearest and
    # buries every tread behind it — a plain wedge with fins, twice.
    #
    # Climbing away, the nearest step is the shortest and occludes nothing, so
    # each tread top and each riser stays visible and the flight reads as a
    # flight. Drawn far-to-near for the same reason.
    W, D, H = 16.0, 4.6, 4.6
    s = shadow(0, 0, W, D * 6)
    for i in range(6):                      # i = 0 is the TOP step, furthest
        y = i * D
        s += box(0, y, 0, W, D, H * (6 - i))
    return s

@recipe("bulkhead")
def _():
    # **A soffit is only a soffit because of where it is.** A box on its own is
    # a box — it read as a table, and before that as a countertop. What names
    # it is the corner it is boxed into and the wall running down past it, so
    # the walls are the drawing and the box is the detail.
    #
    # No shadow: a shadow on the floor is the one mark that would say this
    # thing is standing on it.
    WALL_A, WALL_B = "#E8EDF2", "#DAE1E8"
    s = poly([iso(0, 0, 0), iso(34, 0, 0), iso(34, 0, 34), iso(0, 0, 34)],
             WALL_A, INK, 1.8)
    s += poly([iso(0, 0, 0), iso(0, 20, 0), iso(0, 20, 34), iso(0, 0, 34)],
              WALL_B, INK, 1.8)
    # The ceiling line, so the top of the walls is unmistakably the ceiling.
    s += line((34, 0, 34), (0, 0, 34), INK, 2.0)
    s += line((0, 0, 34), (0, 20, 34), INK, 2.0)
    # The soffit itself, hung in the corner under that line.
    s += box(0, 0, 22, 34, 9, 12, top=TOP)
    return s

@recipe("baseboard_heater")
def _():
    s = shadow(0, 0, 34, 6)
    s += box(0, 0, 0, 34, 5, 8, top=TOP)
    for i in range(7):
        s += line((2 + i * 4.6, 5, 1.5), (2 + i * 4.6, 5, 6.5), DARK, 1.4)
    return s

@recipe("containment")
def _():
    # A poly sheet on a frame, with the zip that makes it a containment and
    # not a wall. The frame legs are what stop it reading as a picture.
    s = shadow(0, 2, 26, 4)
    s += poly([iso(0, 0, 0), iso(26, 0, 0), iso(26, 0, 32), iso(0, 0, 32)],
              "#EFF4F9", INK, SW, ' opacity="0.94"')
    s += line((0, 0, 32), (26, 0, 32), INK, 2.6)             # top rail
    s += line((1, 0, 0), (1, 0, 32), DARK, 2.0)              # uprights
    s += line((25, 0, 0), (25, 0, 32), DARK, 2.0)
    s += line((13, 0, 2), (13, 0, 30), INK, 2.2)             # the zip
    for z in range(4, 30, 4):
        s += line((11.6, 0, z), (14.4, 0, z), DARK, 1.5)
    s += (f'<circle cx="{iso(13,0,16)[0]:.2f}" cy="{iso(13,0,16)[1]:.2f}" r="2.1" '
          f'fill="{WARN}" stroke="{INK}" stroke-width="1.2"/>')
    return s

@recipe("drying_mat")
def _():
    s = shadow(0, 0, 24, 18)
    s += box(0, 0, 0, 24, 18, 1.6, top=GLASS)
    s += line((24, 9, 0.8), (30, 9, 3), METAL, 2.4)
    return s

@recipe("moisture_sensor")
def _():
    # A hand meter: body, screen, two pins. The old one was a puck with a
    # lollipop on a stick and read as nothing at all.
    s = shadow(2, 2, 12, 8)
    s += box(0, 0, 4, 12, 8, 20, top=TOP)
    s += face_l(1.6, 8, 12, 8.8, 6, GLASS)
    s += line((3.5, 4, 4), (3.5, 4, 0), METAL, 2.6)
    s += line((8.5, 4, 4), (8.5, 4, 0), METAL, 2.6)
    return s

# --- doors and windows -----------------------------------------------------
# Drawn frontally, not isometrically. A door is read by its LEAF and its
# SWING, and the old set drew them as isometric frames that came out looking
# like hexagons — which is what the owner meant by not being able to see them.

def _opening(kind):
    """
    A door or a window, in the SAME isometric space as every object.

    The previous set drew these flat and frontally, which is why they sat
    apart from the rest of the library like a different product. The owner's
    reference draws them in three dimensions with the leaf ajar, and he is
    right that it reads better — a door standing shut is a rectangle, and a
    door standing open is unmistakably a door.

    Drawn here, not copied. The isometric view, the wood threshold and the
    red swing arc are how the trade draws an opening; the drawing is ours.
    """
    # **The wall is context, not the subject.** The first cut drew it at full
    # outline weight, and six stacked 2.4pt strokes turned the whole tile into
    # a black slab with the door lost inside it. Hairlines and pale fills put
    # the leaf back in front.
    WALL_F, WALL_B, WALL_T = "#E7ECF1", "#D3DBE3", "#F1F4F7"
    WSW = 1.3
    W = 26.0          # the wall run this piece of wall shows
    OP = 15.0         # the opening in it
    TH = 2.6          # wall thickness
    H = 30.0          # wall height
    x0 = (W - OP) / 2

    # The wall, in two returns either side of the opening.
    s = poly([iso(0, 0, 0), iso(W, 0, 0), iso(W, TH, 0), iso(0, TH, 0)],
             WOOD, INK, WSW)                                   # threshold
    s += panel(0, TH / 2, x0, TH / 2, 0, H, TH, top=WALL_T, face=WALL_F, back=WALL_B, sw=WSW)
    s += panel(x0 + OP, TH / 2, W, TH / 2, 0, H, TH, top=WALL_T, face=WALL_F, back=WALL_B, sw=WSW)
    s += panel(x0, TH / 2, x0 + OP, TH / 2, H - 3.4, 3.4, TH,
               top=WALL_T, face=WALL_F, back=WALL_B, sw=WSW)

    hx, hy = x0, TH / 2                                        # the hinge
    # **Which way the leaf swings is a geometry problem, not a taste one.**
    # A leaf at +52° has a face normal of (-sin a, cos a), which dotted with
    # the camera direction (+1, +1) comes out NEGATIVE — the face points away
    # and all you see is its edge, drawn at full outline weight, which is why
    # the door came out as a black bar. Swinging it the other way turns the
    # face to the camera and the door reads as a door.
    ang = -50.0

    def leaf(hinge_x, deg, length=OP, fill=TOP, glass=False, thick=2.4):
        a = math.radians(deg)
        tx = hinge_x + length * math.cos(a)
        ty = hy + length * math.sin(a)
        return panel(hinge_x, hy, tx, ty, 0, H - 3.4, thick,
                     top=TOP, face=GLASS if glass else fill,
                     back=GLASS_D if glass else RIGHT, sw=1.7)

    if kind in ("doorSingle", "doorEntry"):
        s += leaf(hx, ang)
        s += swing_arrow(hx, hy, OP * 0.66, ang, -3)
    elif kind in ("doorDouble", "doorFrench"):
        g = kind == "doorFrench"
        s += leaf(hx, ang, OP / 2, glass=g)
        s += leaf(x0 + OP, 180 - ang, OP / 2, glass=g)
        s += swing_arrow(hx, hy, OP * 0.40, ang, -4)
        s += swing_arrow(x0 + OP, hy, OP * 0.40, 180 - ang, 184)
    elif kind in ("doorSliding", "doorPatio", "doorBypass"):
        g = kind != "doorBypass"
        # Two leaves in the plane of the wall, one slid past the other.
        s += panel(x0, TH / 2 + 0.9, x0 + OP * 0.55, TH / 2 + 0.9, 0, H - 3.4, 1.0,
                   top=TOP, face=GLASS if g else RIGHT, back=GLASS_D if g else LEFT, sw=SW)
        s += panel(x0 + OP * 0.45, TH / 2 - 0.9, x0 + OP, TH / 2 - 0.9, 0, H - 3.4, 1.0,
                   top=TOP, face=GLASS if g else TOP, back=GLASS_D if g else RIGHT, sw=SW)
        s += (f'<path d="M {iso(x0+OP*0.62, TH/2+2.6, 8)[0]:.2f} {iso(x0+OP*0.62, TH/2+2.6, 8)[1]:.2f} '
              f'L {iso(x0+OP*1.02, TH/2+2.6, 8)[0]:.2f} {iso(x0+OP*1.02, TH/2+2.6, 8)[1]:.2f}" '
              f'stroke="{WARN}" stroke-width="2.8" stroke-linecap="round" fill="none"/>')
        tipx, tipy = iso(x0 + OP * 1.10, TH / 2 + 2.6, 8)
        b1 = iso(x0 + OP * 0.98, TH / 2 + 2.6, 10.4)
        b2 = iso(x0 + OP * 0.98, TH / 2 + 2.6, 5.6)
        s += f'<path d="M {tipx:.2f} {tipy:.2f} L {b1[0]:.2f} {b1[1]:.2f} L {b2[0]:.2f} {b2[1]:.2f} Z" fill="{WARN}"/>'
    elif kind == "doorPocket":
        s += panel(x0 + OP * 0.42, TH / 2, x0 + OP, TH / 2, 0, H - 3.4, 1.0, sw=SW)
        s += (f'<path d="M {iso(x0+OP*0.40, TH/2, 6)[0]:.2f} {iso(x0+OP*0.40, TH/2, 6)[1]:.2f} '
              f'L {iso(x0+0.6, TH/2, 6)[0]:.2f} {iso(x0+0.6, TH/2, 6)[1]:.2f}" '
              f'stroke="{WARN}" stroke-width="2.8" stroke-linecap="round" fill="none"/>')
        tipx, tipy = iso(x0 - 0.6, TH / 2, 6)
        b1 = iso(x0 + 1.6, TH / 2, 8.4); b2 = iso(x0 + 1.6, TH / 2, 3.6)
        s += f'<path d="M {tipx:.2f} {tipy:.2f} L {b1[0]:.2f} {b1[1]:.2f} L {b2[0]:.2f} {b2[1]:.2f} Z" fill="{WARN}"/>'
    elif kind == "doorBifold":
        s += leaf(hx, -58, OP / 2)
        a = math.radians(-58)
        s += leaf(hx + (OP / 2) * math.cos(a), -14, OP / 2)
        s += swing_arrow(hx, hy, OP * 0.60, -56, -8)
    elif kind == "doorGarage":
        for i in range(4):
            s += panel(x0, TH / 2, x0 + OP, TH / 2, i * 6.4, 6.0, 1.2,
                       top=TOP, face=TOP if i % 2 else RIGHT, back=LEFT, sw=SW)
        s += (f'<path d="M {iso(x0+OP/2, TH/2-3, 8)[0]:.2f} {iso(x0+OP/2, TH/2-3, 8)[1]:.2f} '
              f'L {iso(x0+OP/2, TH/2-3, 24)[0]:.2f} {iso(x0+OP/2, TH/2-3, 24)[1]:.2f}" '
              f'stroke="{WARN}" stroke-width="2.8" stroke-linecap="round" fill="none"/>')
        tipx, tipy = iso(x0 + OP / 2, TH / 2 - 3, 27)
        b1 = iso(x0 + OP / 2 - 2.4, TH / 2 - 3, 23); b2 = iso(x0 + OP / 2 + 2.4, TH / 2 - 3, 23)
        s += f'<path d="M {tipx:.2f} {tipy:.2f} L {b1[0]:.2f} {b1[1]:.2f} L {b2[0]:.2f} {b2[1]:.2f} Z" fill="{WARN}"/>'
    elif kind == "doorCased":
        pass                                                   # the hole IS the drawing
    elif kind.startswith("window"):
        op = {"windowSmall": 13.0, "windowStandard": 17.0, "windowWide": 21.0}[kind]
        sill, hgt = 7.0, 17.0
        x0 = (W - op) / 2
        s = poly([iso(0, 0, 0), iso(W, 0, 0), iso(W, TH, 0), iso(0, TH, 0)], WOOD, INK, WSW)
        s += panel(0, TH / 2, x0, TH / 2, 0, H, TH, top=WALL_T, face=WALL_F, back=WALL_B, sw=WSW)
        s += panel(x0 + op, TH / 2, W, TH / 2, 0, H, TH, top=WALL_T, face=WALL_F, back=WALL_B, sw=WSW)
        s += panel(x0, TH / 2, x0 + op, TH / 2, 0, sill, TH, top=WALL_T, face=WALL_F, back=WALL_B, sw=WSW)
        s += panel(x0, TH / 2, x0 + op, TH / 2, sill + hgt, H - sill - hgt, TH,
                   top=WALL_T, face=WALL_F, back=WALL_B, sw=WSW)
        s += panel(x0, TH / 2, x0 + op, TH / 2, sill, hgt, 0.9,
                   top=TOP, face=GLASS, back=GLASS_D, sw=SW)
        s += line((x0, TH / 2 - 0.5, sill + hgt / 2), (x0 + op, TH / 2 - 0.5, sill + hgt / 2), INK, 1.4)
        s += panel(x0 - 1.2, TH / 2, x0 + op + 1.2, TH / 2, sill - 1.2, 1.2, TH * 1.5,
                   top=WOOD, face=WOOD_D, back=WOOD_D)          # the sill board
    return s

for _k in ("doorSingle", "doorDouble", "doorSliding", "doorCased", "doorPocket",
           "doorBifold", "doorBypass", "doorFrench", "doorPatio", "doorEntry",
           "doorGarage", "windowSmall", "windowStandard", "windowWide"):
    RECIPES[f"door-{_k}"] = (lambda k: (lambda: _opening(k)))(_k)

# ---------------------------------------------------------------- emit

def main():
    os.makedirs(OUT, exist_ok=True)
    written = 0
    for name, fn in sorted(RECIPES.items()):
        path = os.path.join(OUT, f"{name}.svg")
        with open(path, "w") as fh:
            fh.write(svg(fn()))
        written += 1
    print(f"{written} illustrations written to {os.path.normpath(OUT)}")

if __name__ == "__main__":
    main()
