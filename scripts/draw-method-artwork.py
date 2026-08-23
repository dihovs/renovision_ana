#!/usr/bin/env python3
"""Draw the capture-method illustrations, in the house artwork language.

These are the pictures on the Add Room sheet — Auto-Scan, Add Square Room,
Draw Room, Import & Draw — and they have now been rejected twice by the owner
as "very, very basic". Both earlier attempts were hand-coded SwiftUI `Canvas`
paths: thin blue outlines, no mass, no shadow. They looked cheap sitting next
to the 341 commissioned object icons because they were speaking a completely
different visual language.

So this generator stops inventing one and matches the language that was
already approved. Read straight off `Native/Artwork/refrigerator.svg`:

    #F7F9FB   lit face          #CBD3DC   shade face
    #C3CAD2   darker detail     #AEB6BF   hairline detail
    #6E7884   mid-grey lines    #252A31   ink outline, 2.4 main / 1.5 detail
    #0B1220   ground shadow, one ellipse at 10% under everything

Isometric solids with round joins and a soft shadow — no gradients anywhere in
the approved set, so none here either.

**The one addition is a single accent**, the app's own `Brand.blue`. The object
icons are monochrome because an icon of a fridge only has to be a fridge; these
have to show a fridge AND what you do to it. The accent carries only the
action — the route you walk, the corners you drag, the edge still following
your finger — so colour means "this is the part that is you" and nothing else.

Output lands in `ios/App/App/Native/Artwork/`, which is where deliveries go and
the only place they go. Then:

    python3 scripts/install-object-artwork.py

The viewBox is fitted here from the real bounding box, so `scripts/fit-artwork.mjs`
is not needed for these — nothing has to be measured in a browser when the
generator already knows where every point is.
"""

import math
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "ios/App/App/Native/Artwork"

INK = "#252A31"
LIT = "#F7F9FB"
SHADE = "#CBD3DC"
MID = "#C3CAD2"
HAIR = "#AEB6BF"
GREY = "#6E7884"
FLOOR = "#E9EEF3"
ACCENT = "#2B5C9E"

COS30 = math.cos(math.radians(30))
S = 22.0  # world unit -> svg unit


def iso(x, y, z=0.0):
    """2:1 isometric with z up, the same projection the approved set uses."""
    return ((x - y) * COS30 * S, (x + y) * 0.5 * S - z * S)


def pts(points):
    return " ".join(f"{x:.2f},{y:.2f}" for x, y in points)


class Art:
    def __init__(self):
        self.parts = []
        self.box = []

    def _track(self, points):
        self.box.extend(points)

    def poly(self, points, fill, stroke=INK, w=2.4):
        self._track(points)
        self.parts.append(
            f'<polygon points="{pts(points)}" fill="{fill}" stroke="{stroke}" '
            f'stroke-width="{w}" stroke-linejoin="round"/>'
        )

    def line(self, a, b, stroke=GREY, w=2.4, dash=None):
        self._track([a, b])
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(
            f'<line x1="{a[0]:.2f}" y1="{a[1]:.2f}" x2="{b[0]:.2f}" y2="{b[1]:.2f}" '
            f'stroke="{stroke}" stroke-width="{w}" stroke-linecap="round"{d}/>'
        )

    def path(self, points, stroke, w=2.6, dash=None):
        self._track(points)
        d = f' stroke-dasharray="{dash}"' if dash else ""
        body = f"M {points[0][0]:.2f} {points[0][1]:.2f} " + " ".join(
            f"L {x:.2f} {y:.2f}" for x, y in points[1:]
        )
        self.parts.append(
            f'<path d="{body}" fill="none" stroke="{stroke}" stroke-width="{w}" '
            f'stroke-linecap="round" stroke-linejoin="round"{d}/>'
        )

    def dot(self, p, r, fill, stroke=INK, w=2.0):
        self._track([(p[0] - r, p[1] - r), (p[0] + r, p[1] + r)])
        self.parts.append(
            f'<circle cx="{p[0]:.2f}" cy="{p[1]:.2f}" r="{r:.2f}" fill="{fill}" '
            f'stroke="{stroke}" stroke-width="{w}"/>'
        )

    def ground(self):
        """The soft ellipse under the form, sized from what was actually drawn.

        **The first version of this was hand-sized and excluded from the
        bounding box**, on the theory that a shadow should not shrink the
        drawing to make room for itself. Rendering the set showed why that was
        wrong: an ellipse wider than the fitted viewBox is an ellipse CLIPPED
        by the fitted viewBox, and a clipped ellipse is a grey slab. All five
        drawings had a rectangular smear under them.

        So it is measured from the geometry and counted in the box. Read the
        render, not the code — that is the whole reason this was caught.
        """
        xs = [q[0] for q in self.box]
        ys = [q[1] for q in self.box]
        cx = (max(xs) + min(xs)) / 2
        width = max(xs) - min(xs)
        rx, ry = width * 0.40, width * 0.085
        cy = max(ys) + ry * 0.75
        self.parts.insert(
            0,
            f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" '
            f'fill="#0B1220" opacity="0.1"/>',
        )
        self._track([(cx - rx, cy - ry), (cx + rx, cy + ry)])

    def room(self, x, y, w, h, wall=0.55, floor=FLOOR):
        """A floor slab with its two FAR walls standing on it.

        Only the far walls are drawn. A box with all four would hide its own
        floor, and the floor is where the route, the handles and the corners
        live — the whole subject of every one of these pictures.
        """
        self.poly(
            [iso(x, y), iso(x + w, y), iso(x + w, y + h), iso(x, y + h)],
            floor, w=2.0,
        )
        # Right-facing wall catches the light; left-facing sits in shade.
        self.poly(
            [iso(x, y), iso(x + w, y), iso(x + w, y, wall), iso(x, y, wall)], LIT
        )
        self.poly(
            [iso(x, y), iso(x, y + h), iso(x, y + h, wall), iso(x, y, wall)], SHADE
        )

    def phone(self, at, lean=-16.0):
        """What the operator is holding. The quickest way to say a method
        involves you moving rather than the building being measured at you."""
        cx, cy = at
        w, h = 15.0, 27.0
        self._track([(cx - h, cy - h), (cx + h, cy + h)])
        self.parts.append(
            f'<g transform="translate({cx:.2f} {cy:.2f}) rotate({lean})">'
            f'<rect x="{-w/2:.2f}" y="{-h/2:.2f}" width="{w:.2f}" height="{h:.2f}" '
            f'rx="3.2" fill="{LIT}" stroke="{INK}" stroke-width="2.4"/>'
            f'<rect x="{-w/2+3:.2f}" y="{-h/2+4:.2f}" width="{w-6:.2f}" '
            f'height="{h-8:.2f}" rx="1.6" fill="{ACCENT}" opacity="0.85"/>'
            f"</g>"
        )

    def svg(self, pad=0.10):
        xs = [p[0] for p in self.box]
        ys = [p[1] for p in self.box]
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        side = max(w, h) * (1 + pad * 2)
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        vb = f"{cx - side/2:.2f} {cy - side/2:.2f} {side:.2f} {side:.2f}"
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">\n'
            + "\n".join(self.parts)
            + "\n</svg>\n"
        )


def autoscan():
    """Two rooms and the walk that threads them.

    Two rather than the three the old drawing had: at the size this actually
    renders, three rooms was a grey smudge. The message is "more than one room,
    and you walk it", and two rooms says that as well as five do.
    """
    a = Art()
    a.room(-1.5, -1.1, 1.5, 2.2)
    a.room(0.0, -1.1, 1.4, 2.2)
    route = [iso(-0.75, 0.75), iso(-0.75, -0.5), iso(0.7, -0.5), iso(0.7, 0.8)]
    a.path(route, ACCENT, w=3.0, dash="7 5")
    a.dot(route[0], 4.0, ACCENT, stroke=ACCENT, w=0)
    a.phone(iso(1.05, 1.15, 0.30), lean=-14)
    a.ground()
    return a


def manual():
    """One room, one standpoint, one cone. You stand still and aim."""
    a = Art()
    a.room(-1.2, -1.2, 2.4, 2.4)
    stand = iso(-0.55, 0.6)
    a.poly([stand, iso(1.2, -1.2, 0.1), iso(1.2, 0.35, 0.1)], MID, stroke=ACCENT, w=2.0)
    a.line(iso(1.2, -1.2), iso(1.2, -1.2, 0.55), stroke=ACCENT, w=3.4)
    a.dot(stand, 4.6, LIT, stroke=INK, w=2.2)
    a.phone(iso(-0.55, 0.6, 0.4), lean=14)
    a.ground()
    return a


def square():
    """Start from a rectangle and pull it into shape.

    The handles sit on the floor corners and one edge is ghosted outward, so
    the picture says *drag this* rather than merely *square*.
    """
    a = Art()
    a.room(-1.0, -1.0, 2.0, 2.0)
    ghost = [iso(1.0, -1.0), iso(1.75, -1.0), iso(1.75, 1.0), iso(1.0, 1.0)]
    a.path(ghost, ACCENT, w=2.4, dash="6 5")
    for hx, hy in [(1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)]:
        a.dot(iso(hx, hy), 6.0, LIT, stroke=ACCENT, w=2.8)
    a.ground()
    return a


def corners():
    """Corner by corner — and deliberately an L, a shape the rectangle above
    could never have become. Three edges committed, the fourth still following
    the finger."""
    a = Art()
    plate = [
        iso(-1.1, -1.0), iso(0.6, -1.0), iso(0.6, 0.05),
        iso(1.5, 0.05), iso(1.5, 1.15), iso(-1.1, 1.15),
    ]
    a.poly(plate, FLOOR, w=2.0)
    laid = [iso(-1.1, 1.15), iso(-1.1, -1.0), iso(0.6, -1.0), iso(0.6, 0.05), iso(1.5, 0.05)]
    a.path(laid, INK, w=3.0)
    a.path([iso(1.5, 0.05), iso(1.5, 1.15)], ACCENT, w=3.0, dash="6 5")
    for p in laid:
        a.dot(p, 4.2, INK, stroke=INK, w=0)
    a.dot(iso(1.5, 1.15), 6.4, LIT, stroke=ACCENT, w=3.0)
    a.ground()
    return a


def trace():
    """A plan you already have, with a new outline being traced over it.

    Flat on the ground rather than standing up: this is the one method that
    starts from a piece of paper instead of from the building, and lying the
    sheet in the same isometric plane as the other four keeps the set together.
    """
    a = Art()
    # Wider than deep, so it reads as a SHEET. Square in isometric renders as
    # a lozenge, which at tile size says "diamond" and nothing else — that is
    # what the first attempt looked like.
    a.poly(
        [iso(-1.75, -1.15), iso(1.75, -1.15), iso(1.75, 1.15), iso(-1.75, 1.15)],
        LIT, w=2.4,
    )
    # The plan already on the paper: an L, faint, because it is somebody
    # else's drawing and not yet ours.
    a.path(
        [iso(-1.25, 0.7), iso(-1.25, -0.7), iso(0.35, -0.7), iso(0.35, 0.0),
         iso(1.25, 0.0), iso(1.25, 0.7), iso(-1.25, 0.7)],
        HAIR, w=4.2,
    )
    # Ours, traced over it and stopping where the nib is.
    a.path([iso(-1.25, 0.7), iso(-1.25, -0.7), iso(0.35, -0.7)], ACCENT, w=3.4)
    nib = iso(0.35, -0.7)
    a.poly(
        [(nib[0], nib[1]), (nib[0] + 13, nib[1] - 20), (nib[0] + 20, nib[1] - 13)],
        LIT, w=2.2,
    )
    a.line((nib[0] + 16.5, nib[1] - 16.5), (nib[0] + 34, nib[1] - 34), stroke=INK, w=5.5)
    a.ground()
    return a


DRAWINGS = {
    "method-autoscan": autoscan,
    "method-manual": manual,
    "method-square": square,
    "method-corners": corners,
    "method-trace": trace,
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in DRAWINGS.items():
        (OUT / f"{name}.svg").write_text(fn().svg())
        print(f"  ✓ {name}.svg")
    print(f"\n{len(DRAWINGS)} drawn into {OUT}")
