# Objects, and what a door actually is

Observed on device, 15 Aug 2026, driving the owner's own magicplan install. Every
value below was read off the screen; nothing here is inferred. Where something
was not observed it says so.

The short version: **there is no "door" type and no "window" type.** There is one
object model with three dimensions, and a door is an object whose Distance to
Floor happens to be zero. That single fact removes most of the special-casing we
were about to build.

---

## 1. The catalogue

`Insert` at either room or wall depth opens the same menu:

    Room · Object · Note · Photo · Form

Doors and windows are **Objects** — the same path as a sofa. `Object` opens
**All Objects**, a searchable catalogue with a "Recently used" rail across the
top (most-recent first) and these categories:

| Category | Count |
|---|---:|
| Annotations | 25 |
| Doors | 17 |
| Windows | 15 |
| Structural | 27 |
| Plumbing | 57 |
| Appliances | 29 |
| Kitchen Cabinets | 37 |
| Furniture | 126 |
| Electrical | 69 |

Doors seen in the grid: Arch Door, Bypass Door, Door with Window, Double Folding
Door, Double Hinged Door, Double Pocket Door, and more below the fold. Each tile
is an icon plus a name, with a favourite star in the corner. The full 17 and 15
were not enumerated — the sheet would not expand past its detent under mirroring.

**What we take:** the categories, the recently-used rail, the favourite star, and
the fact that openings live in the same catalogue as everything else. **What we
do not take:** their icons and 3D renders. A door needs a plan glyph showing
swing direction; we draw our own.

---

## 2. The property sheet — identical for every object

Swipe up from the action bar, or the object is selected and the sheet is pulled.
Header is the object's name with a chevron to collapse; three tabs.

### Details

| Field | Door (Double Hinged) | Window (Fixed) | Kind |
|---|---|---|---|
| Width | 1.600 m | 0.800 m | length, editable |
| Height | 2.040 m | 1.200 m | length, editable |
| **Distance to Floor** | **0.000 m** | **1.000 m** | length, editable |
| Include in PDF | off | off | toggle |
| Display Label | Never | Never | enum |
| New Field | — | — | link out |

**Distance to Floor is the whole difference between a door and a window.** Not a
type flag, not a subclass — a sill height that happens to be zero. Our
`OPENING_PRESETS` already carries width and height; it needs this third number,
and then `doorSingle` / `windowStandard` stop being different kinds of thing.

Their defaults, for reference against ours (`manualRoom.ts`, `PlanEditing.swift`):

- Door leaf height **2.040 m** — we use 80″ = 2.032 m. Within 8 mm; ours is the
  North American stock size and is right for Quebec. Keep ours.
- Double door width **1.600 m** — we use 60″ = 1.524 m. Theirs is a metric
  double; ours is the imperial one. Keep ours, but the gap is worth stating in
  the report so nobody thinks a door was mismeasured.
- Fixed window **0.800 × 1.200 at 1.000 m** — a metric standard. Ours is
  36″ × 48″ = 0.914 × 1.219. Sill height we do not have at all. **Add it.**

`Include in PDF` reads: *"The dimensions above will not be included in a PDF
export."* So the toggle governs whether this object's dimensions print — per
object, off by default. Worth having: an estimator does not want every cabinet's
width in a claim file, but does want the doors.

`Display Label` is a single-select with a preview thumbnail per option:

    Never (default) · Above the object · Over the object · Below the object

`+ New Field` does **not** open an editor. It opens their Help Center, which
states the distinction:

> Forms are intended for creating both short and long templates that facilitate
> inspection and reporting processes. In contrast, Fields enable you to quickly
> [add] details to your floor plan that are frequently required. Through the
> magicplan Cloud, you can create Fields that [appear in the details section].

So **Fields are authored in the cloud, not on the phone**, and appear inline in
Details. Forms are separate templates. We have neither; `custom` on `projects`
(migration 0026) is the closest thing and is project-level, not object-level.

### Photos & Notes

- **Photos**: a grid, first tile is `+`, the rest dashed placeholders.
- **Notes**: a single free-text field. Tapping it opens a separate **Add Text**
  sheet with Cancel / Save — not inline editing.

`+` offers two sources:

    Camera        Take Photo, 360 or Video
    Photo Library Choose Photo or Video

**They support 360 photos and video, not just stills.** We support stills only.

Picking from the library allows **up to 50 items**, then lands on a **Review**
screen before anything is saved — and this is the part worth copying:

    Cancel        Review 1 of 1        Save All

    [preview]

    📎 Double Hinged Door • Living Room
    1320 × 2868 · 223.8 KB · PNG

    Caption      Edit      Delete

The attachment target is stated on the review screen — *object • room* — so you
cannot file a photo against the wrong thing without seeing it first. Size and
format are shown too. `Caption` is a text sheet with ← → to walk a batch.

`Edit` is a **full annotation editor** — see §2a, which maps all of it.

### 2a. The photo editor, in full

Reached from the photo viewer's `Edit`. Chrome is `Cancel · undo · redo · Done`.
Four **modes**, switched by the icon row at the very bottom; each mode replaces
the controls above it.

**Mode 1 — Draw.** Two controls plus a scrolling tool row.

- **Line color** — a swatch opening a *full* picker: saturation/brightness
  field, hue slider, **alpha slider**, and a preset palette of ~18 swatches
  (a transparent one, white through black in five greys, navy/blue/light blue,
  teal, two greens, yellow, orange, red, maroon, magenta, purple).
- **Line width** — seven named steps:
  `Extra small · Small · Medium small · Medium · Medium large · Large · Extra large`
- **Tools**, the complete row, scrolled to its end:

      Sharpie · Arrow · Text · Rectangle · Eraser · Path · Line · Ellipse

  Eight. `Sharpie` is freehand marker; `Path` is a multi-point polyline;
  `Line` a straight segment; `Rectangle` and `Ellipse` are outline shapes.

**Mode 2 — Pixelate / blur.** No options at all: the tool row disappears and you
drag directly on the image. Matters for us specifically — a claim photo often
catches a document, a face or a plate, and today redaction means not taking the
photo.

**Mode 3 — Crop and transform.** `Rotate left` · `Flip horizontal` across the
top, drag handles on the image corners, a degree dial beneath reading `0°`, and
two tabs: **Rotation · Scale**.

**Mode 4 — Adjustments.** A value dial at `0` and five channels:

      Brightness · Contrast · Saturation · Exposure · Temperature

### How much of this is free

Checked against the installed iOS 26.5 SDK rather than assumed — every item
below was confirmed present:

| Piece | What we use | Effort |
|---|---|---|
| Colour picker | **SwiftUI `ColorPicker`** — spectrum, sliders, opacity, palette | none |
| Brightness/Contrast/Saturation | `CIColorControls` | trivial |
| Exposure | `CIExposureAdjust` | trivial |
| Temperature | `CITemperatureAndTint` | trivial |
| Blur / pixelate | `CIPixellate`, `CIGaussianBlur`, masked to a dragged region | small |
| Freehand + eraser | **PencilKit** (`PKCanvasView`, `PKInkingTool`, `PKEraserTool`) | small |
| Arrow, Line, Rectangle, Ellipse, Text | **custom overlay** — no system equivalent | medium |
| Crop, rotate, flip, scale | **custom** — there is no public system cropper; the transform itself is `CGAffineTransform` | medium |

So roughly two thirds is Apple's and one third is ours. PencilKit is worth taking
rather than hand-rolling freehand: it brings pressure, smoothing and its own
undo, and a hand-rolled stroke on a phone always looks hand-rolled.

`QLPreviewController` also exposes Apple's own Markup wholesale — shapes, text,
signature — but it cannot be themed and would drop the operator into an
Apple-looking sheet mid-flow, so it is not the route.

### Forms

Empty state: *"No forms yet. Reduce paperwork by creating report templates,
forms, questionnaires, checklists, and so much more!"* with a Learn more link.
Cloud-authored, attached per object. Not observed in use.

---

## 2b. A wall is an inspectable thing too — and it owns affected areas

Select a wall, swipe up. **Same three tabs as an object**: Details, Photos &
Notes, Forms. A wall carries its own photos and its own notes.

**Details:**

| Section | Field | Value seen |
|---|---|---|
| Dimensions | Length | 2.500 m |
| Affected Areas | `+ Add New Area` | — |
| Settings | **Display Elevation in Report** | toggle, off |
| Settings | **Load-Bearing Wall** | toggle, off |
| | `+ New Field` | link out |

The Affected Areas note reads:

> Define one or more affected areas (overlapping allowed) within a room **or a
> wall**. Affected areas can be included in your exports.

So **affected areas are first-class, on both floors and walls, and they are
allowed to overlap** — which is exactly the model we built in ORD-20 and exactly
why `totalsByDamageType` must never produce one grand total.

`Display Elevation in Report` is a **per-wall** flag deciding whether that wall's
elevation drawing prints. We built the elevation (ORD-19) with no such switch;
a claim does not want twelve elevations, it wants the three that are damaged.

`Load-Bearing Wall` is a structural flag we do not have. Cheap to add and it
matters on a job where a wall is coming out.

### The affected area itself

`+ Add New Area` opens **Edit Affected Area** — and it opens *the wall face,
straight on*: width across the top, height down both sides, the two adjoining
walls folded away as grey trapezoids. The same elevation drawing we built. The
new area arrives covering most of the face, to be pulled in — reductive, like
ours.

Its own inspector, again three tabs:

| Section | Field | Notes |
|---|---|---|
| Dimensions | Area | `6.10 m²` — computed, read-only |
| General | Name | `Affected Area 1`, editable |
| General | **Fill Color** | full colour matrix + `Reset` |
| Settings | **Show Dimensions** | toggle, off |
| | `+ New Field` | |

**They have no damage type.** A name and a colour, nothing more. Our
water / fire / mould / impact / other classification is a deliberate addition —
in restoration the cause decides the trade and the rate, and an adjuster asks
for it. Keep it; theirs is a general-purpose plan app.

What they have that we do not: **Show Dimensions** per area, and photos, notes
and forms attached to the *area* rather than only to the room.

### Editing the shape

Action bar for a selected area: **Insert · Edit Shape · Delete**.

`Edit Shape`, captioned *"Tap to adjust points"*:

1. **Tap a point** — it becomes a red four-way move handle, and a **Delete**
   button appears at the bottom for removing that point.
2. **Drag it** — the point moves freely. The shape does **not** stay
   rectangular; it became a quadrilateral with a diagonal edge.
3. **Live dimensions** appear on the two edges adjoining the dragged point.
4. Points can be **added as well as deleted**, so an area can be an L, a T, or
   any polygon — the owner's own note.
5. Undo / redo throughout, `Cancel` / `Done` to commit.

Ours already drags corners, splits edges and removes corners. What ours lacks is
the **live edge dimensions during the drag** and the tap-to-select-then-move
step, which is what makes it usable with a thumb.

---

## 3. The action bar changes with what is selected

Confirms and extends `editor-chrome-design.md` §4. Observed, at each depth:

| Depth | Actions |
|---|---|
| Floor | Insert · Rotate |
| Room | Insert · Set Size · Edit Layout · Duplicate · Delete |
| Wall | Insert · Add Corner · Add Wall · Split Room · Delete |
| Object | Insert · **Replace with…** · **Rotate** · Duplicate · Delete |
| Affected area | Insert · **Edit Shape** · Delete |

Two new ones for us. **Replace with…** swaps the object for another from the
catalogue while keeping its position and size — the fix for "that's a window,
not a door" without deleting and re-placing. **Rotate** on an object.

**Set Size disappears from the room bar the moment the room stops being a
rectangle.** It came back when the room was square again. So Set Size is
rectangle-only — which makes sense of the guided walk, and tells us our own
`Set Size` should hide, not grey, on a non-rectangular room.

---

## 4. What an opening does to the dimension chain

Placing the door on the top wall broke that wall's dimension into a chain,
outboard of the wall and inboard of the overall figure — exactly what ORD-18
built. The window on the left wall gave a full three-part chain:

    0.827 · 0.800 · 0.873   =  2.500 ✓

wall piece, window width, wall piece. The overall wall figure stays on its own
line further out, padlocked.

**The chain always accounts for the whole wall.** Ours drops pieces that collide;
theirs did not need to here, but the invariant to aim for is that the parts sum
to the whole.

---

## 5. Two dimensions, not one — the owner caught this

On a trapezoid the slanted side read **2.610** — its true length — while a
**separate outer dimension line still read 2.500**, the overall vertical extent
of the room.

So they draw two different quantities:

1. **Wall length**, per wall, on the inner line — what you'd measure with a tape
   along the wall.
2. **Overall extent**, on the outer line — the bounding dimension of the room,
   orthogonal, independent of any wall being slanted.

**We draw only the first.** On any room that is not perfectly rectangular our
plan cannot answer "how deep is this room", which is the question an estimator
asks first. This is a real gap; see ORD-23 below.

---

## 6. Locking

Established by experiment, and it corrects an earlier assumption of ours:

- A wall shows a **padlock** when its length was typed.
- **Apply always locks** — even applying the identical value. Pressing Apply is
  what marks it, not the number changing.
- **Unlock** appears in the Change Measurement panel **only on a locked wall**.
  Unlocking then re-applying re-locks it immediately.
- The lock is a **constraint on propagation**, not just a marker. Set one wall of
  a rectangle and the opposite wall follows *if it is free*. With the top pinned
  at 2.500, setting the bottom to 4.000 could not propagate — and the room became
  a **trapezoid**.

That last point is the one to internalise. A locked wall is a promise the
geometry will not silently break; it deforms the room instead.

Object dimensions (a door's width) open the same Change Measurement panel but
show **only Laser** — objects are not lockable.

---

## 7. Two render modes of one plan

The owner's observation, and it is a clean rule:

- **Floor level** — the "thumbnail" look. Thick black poché walls, flat grey
  floor, room name and area centred inside, **no dimensions, no handles, no tan
  grid**.
- **Room level** — "alive". White floor under a fine tan grid, full dimension
  chains, corner handles, wall bands, the dotted sheet behind.

Same geometry, two presentations. **The floor-level look is what our project
cards and thumbnails should use** — we are currently drawing the alive version
small, which is why it reads as noise at thumbnail size.

---

## 8. The grid, settled

Changing a wall from 2.5 m to 4.0 m and watching both grids:

- **Floor tile grid** — cells stayed **0.25 m**. The count across the room went
  from ~10 to ~16 while the on-screen cell shrank in exact proportion to the view
  zooming out to fit. Model space.
- **Background dotted grid** — screen spacing unchanged throughout. Screen space.

This is exactly the split we shipped in `9e74e26`. No change needed; recorded so
nobody "fixes" it back.

---

## Orders this produces

- **ORD-23 — the overall dimension line.** Draw the room's bounding extent on an
  outer line, distinct from per-wall lengths. Blocking for any non-rectangular
  room. §5.
- **ORD-24 — sill height.** Add Distance to Floor to `OPENING_PRESETS` and to the
  authored-opening record, both languages. Collapses door/window into one model.
  §2.
- **ORD-25 — Replace with…** on a placed opening. §3.
- **ORD-26 — the thumbnail render mode.** Floor-level presentation for cards.
  §7.
- **ORD-27 — photo review before save**, stating the attachment target, with
  caption. §2.
- **ORD-28 — the photo editor.** Four modes per §2a. Take `ColorPicker`, the
  five Core Image adjustment filters, `CIPixellate` and PencilKit from the
  system; build the shape tools (arrow, line, rectangle, ellipse, text) and the
  cropper ourselves. Blur first — it is the one that is currently costing
  photos.
- **ORD-30 — the wall inspector.** A wall needs its own sheet: length, its
  affected areas, `Display Elevation in Report` (per wall — a claim wants the
  three damaged elevations, not twelve), `Load-Bearing Wall`, and its own photos
  and notes. §2b.
- **ORD-31 — live dimensions while dragging an area corner**, and
  tap-to-select-then-move rather than direct drag. The two things that make
  their shape editor usable with a thumb. Ours already has the polygon maths.
  §2b.
- **ORD-32 — Show Dimensions per affected area**, and photos/notes attached to
  the area itself rather than only its room. §2b.
- **ORD-29 — 360 photo and video capture.** Their `+` offers Photo, 360 or
  Video; we offer stills only. Sizing not yet done. §2.
- Set Size should **hide** on a non-rectangular room, not grey. §3.
