# Objects, and what a door actually is

Observed on device, 15 Aug 2026, driving the owner's own magicplan install. Every
value below was read off the screen; nothing here is inferred. Where something
was not observed it says so.

The short version: **there is no "door" type and no "window" type.** There is one
object model with three dimensions, and a door is an object whose Distance to
Floor happens to be zero. That single fact removes most of the special-casing we
were about to build.

---

## The findings that change what we build

Read this page and you have the review. Each line says where to go for the rest.

**Model**

1. **One object model, not many.** Width · Height · **Distance to Floor**. A door
   is an object whose sill is zero. Doors, windows and a sofa come from the same
   catalogue by the same path. — §1, §2
2. **Affected areas are first class, on floors *and* walls, and may overlap** —
   which is exactly why totals must stay per cause and per surface rather than
   summing to one figure. — §2b
3. **They have no damage type.** An area gets a name and a fill colour, nothing
   more. Ours carries cause because cause decides trade and rate. Keep it. — §2b
4. **Wall thickness lives on the *floor*** — interior and exterior kept apart
   (0.120 m / 0.250 m observed). Every footprint figure is arithmetic on those
   two numbers, which is what turned ours from a guess into a measurement. — §2c

**Numbers that will bite**

5. **"Walls with openings" is the GROSS figure.** "Without openings" is the net.
   Backwards from every reading instinct, and a 4 m² error on a small room.
   Never adopt their naming; ours stays `{gross, net}`. — §2c
6. **Ground perimeter is baseboard length** — interior perimeter minus every door
   width. Their own definition. A door has no baseboard across it, and it is the
   number an estimator actually wants. — §2c
7. **Their product contradicts itself.** The app's room sheet reads
   `PERIMETER 9.15 m`; the report prints `9.82 m` for the same room. The gap is
   one door width — ground vs ceiling perimeter, both labelled just "perimeter".
   This is the whole argument for labelling every figure with its definition.
   — §2c, §6
8. **Two kinds of dimension, not one:** each wall's own length, *and* an overall
   bounding extent on an outer line. Without the second, a non-rectangular room
   cannot answer "how deep is it". — §5

**Behaviour**

9. **The padlock is a constraint, not a marker.** Apply always locks — even
   re-applying the same value. A locked wall will not follow: pin the top at
   2.500, set the bottom to 4.000, and the room becomes a **trapezoid**. Every
   structural action asks first. — §6, §3a
10. **Two render modes of one plan.** Floor level is the thumbnail look — poché
    walls, grey floors, name and area, no dimensions or handles. Room level goes
    live. Ours drew the live version small, which is why cards read as noise.
    — §7
11. **The grid splits.** Floor tile grid is model space at a fixed 0.25 m; the
    background dots are screen space. Confirmed by changing a wall and watching
    both. — §8
12. **Insert is mostly navigation.** Note, Photo and Form just jump to a tab of
    whatever is selected. Only Room and Object create anything. — §3b

**What a real job proved**

13. **Room type is optional, so nobody sets it.** On the owner's own condo the
    Bathroom's type was `Other`, so the report cover printed **"Bathroom 0"** for
    a flat that plainly has one — the cover counts by *type*, not by name. The
    error reaches the client. This is why we ask the type **before** the camera:
    type-after is type-never. — §2e
14. **Videos print.** The annotated report captions them `<room> Video n`, and
    photos and videos share one grid with a duration badge. **Move** re-files an
    attachment to a different room or object — the fix for a misfiled photo on a
    39-photo job. — §2e
15. **The report is a numbered key.** Badges on the plan cross-referenced to an
    itemised legend with thumbnails, a locator thumbnail showing where the room
    sits, photos deferred to their own pages, a scale bar and ratio on every
    plan. — §3c
16. **Their commercial room list is an office fit-out vocabulary** — Private
    Office, Photocopy Room, Archives. Take the Residential/Commercial *split*;
    the *types* must come from this trade's own jobs. — §2d

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

## 2c. The floor sheet — where wall thickness lives

Swipe up at floor level. Same three tabs.

**Statistics** (with `See All`): `6.24 m² Floor Area · 20.18 m² Wall Area ·
15.25 m³ Volume · 1 # Rooms`. **Volume** is a figure we do not compute.

**Dimensions:**

| Field | Value |
|---|---|
| Ceiling Height | 2.440 m |
| **Interior Wall Thickness** | **0.120 m** |
| **Exterior Wall Thickness** | **0.250 m** |

**This is the answer to the wall-thickness question.** Thickness is a *floor-level
setting*, interior and exterior separately, and every derived figure is computed
from it. Which is exactly the owner's instruction — make it adjustable, default
to 2×4 — and it means the three ground-surface figures below are not guesses,
they are arithmetic on a number the operator stated.

`General` holds a `Floor Name` free-text field. Then `+ New Field`.

### The complete statistics list

`See All` opens a **Statistics** sheet with two tabs, **Rooms** and **Objects**,
and every row carries an ⓘ giving its definition. Read off our 2.5 × 2.5 room
with one door and one window:

| Measure | Value | What it is |
|---|---:|---|
| Floors / Rooms / Doors / Windows | 1 / 1 / 1 / 1 | counts |
| Ground surface with all walls | 8.99 m² | to the **outside** face — (2.5 + 0.25×2)² = 9.00 ✓ |
| Ground surface with interior walls | 6.24 m² | equal to "without" here; no partitions on a one-room floor |
| Ground surface without walls | 6.24 m² | interior floor |
| **Walls with openings** | 24.40 m² | **GROSS** — ceiling perimeter 10.00 × 2.440 ✓ |
| **Walls without openings** | 20.18 m² | **NET** — 24.40 − door 3.264 − window 0.96 ✓ |
| Ceiling perimeter | 10.00 m | 4 × 2.5, the interior perimeter |
| **Ground perimeter** | 8.40 m | 10.00 − the 1.6 m door |
| Above grade living area | 6.24 m² | |
| Below grade living area | 0.00 m² | |
| Total living area | 6.24 m² | |
| Volume | 15.25 m³ | 6.25 × 2.44 ✓ |

Two things here are worth more than the rest.

**Their "with / without openings" naming is the reverse of intuition.** "Walls
with openings" is the GROSS area — the wall counted *including* the holes.
"Walls without openings" is the NET. Read the wrong way round it is a 4 m²
error on a room this size. Our `wallAreaSquareMeters` returns `{gross, net}`,
which is unambiguous; keep our naming and never adopt theirs.

**Ground perimeter is baseboard length.** Their own ⓘ, verbatim:

> "Ground perimeter" is the total length of all interior walls in a building,
> excluding doors. It is computed by adding up the length of all interior walls
> and deducting the width of all doors on those walls.

We publish perimeter but not this. Baseboard is priced on it, and it is the
figure an estimator actually wants — a door has no baseboard across it.

**Objects tab** is a per-type tally with icon and count — `Double Hinged Door 1`,
`Affected Wall Area 1`, `Fixed Window 1`. A takeoff schedule. (Their group
headers are visibly buggy: a door files under "Affected Areas".)

We already have the ⓘ pattern — `MEASURE_DEFINITIONS` and `MeasureInfo`, built
under ORD-04. What is missing is coverage: their list is longer than ours.

### Two smaller observations

- At floor level a room with attachments carries a **yellow paperclip badge**.
  Attachments are visible on the plan without opening anything.
- `Cancel` in the shape editor asks **"Discard Changes"** rather than dropping
  the edit silently.

---

## 2d. The room sheet

| Section | Field | Value |
|---|---|---|
| Statistics | | `6.25 m² Floor · 20.18 m² Wall · 8.40 m Perimeter · 15.25 m³ Volume` |
| Dimensions | Ceiling Height | 2.440 m |
| Dimensions | **Living Area (%)** | 100 |
| Affected Areas | `Affected Area 1` | `On the wall` · 6.10 m² |
| Affected Areas | `+ Add New Area` | |
| General | Floor | `Ground Floor ›` |
| General | Room Type | `Living Room ›` |
| General | Room Name | `Living Room` |
| General | Room Color | swatch |

Three things confirm work we already did. **Living Area (%)** is our
`living_percent` (migration 0030). Each affected area is listed **with the
surface it sits on** — *"On the wall"* — which is our `surface` column. And the
room's `Perimeter` statistic is **8.40 m**, the ground perimeter, not the 10.00 m
ceiling perimeter: at room level the number they lead with is the baseboard one.

`Floor` is a picker, so a room can be moved between storeys. `Room Color` is a
per-room fill.

### Room types — and the Residential / Commercial split

The Room Type picker is a single-select with the **Residential | Commercial**
segmented control at its head. This is the control ORD-17 could not build.

**Residential**, in their order: Kitchen · Dining Room · Living Room · Hall ·
Bedroom · Primary Bedroom · Children Bedroom · Bathroom · Closet · Study ·
Music Room · Balcony · Garage · Hallway · Laundry Room · (more below the fold).

**Commercial**: Private Office · Shared Office · Open Space · Meeting Room ·
Conference Room · Reception · Kitchenette · Cafeteria · Lounge · Waiting Room ·
Training Room · Maintenance Room · Archives · Photocopy Room · Lab · (more).

**Their commercial list is an office fit-out vocabulary, and adopting it would
be a mistake** — which is exactly what ORD-22 predicted. A water-damage job in a
commercial building is a mechanical room, an electrical room, a server room, a
retail floor, a warehouse bay, a storage room, a washroom block, a corridor, a
stairwell, a loading dock. `Photocopy Room` and `Archives` will never be picked
on one of these jobs, and an operator who cannot find their room picks "Other",
which is the failure ORD-06 existed to fix.

So ORD-22's first question is now answered in the negative: **take the split,
not the list.** The second question — how living area treats commercial rooms —
is still the owner's, and ANSI Z765 still does not apply to a warehouse.

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

## 2e. A real job — the condo

Everything above was learned on a 2.5 × 2.5 test room. This section is a real
project of the owner's: a Montréal condo, **9 rooms, 78.68 m² floor,
212.70 m² wall, 39 photos**. What changes at that scale is worth its own
section.

### The project page

Above the floor plans, in this order:

1. `Add project description…` — free text
2. **An address card with a Google Maps thumbnail** — street, city, postcode,
   country. We hold an address as text on the job; they render it as a map.
3. **Forms** — a row with a chevron, project level
4. **Statistics** — `78.68 m² Floor Area · 212.70 m² Wall Area · 1 Floor ·
   9 Rooms`, with `See All`
5. **Floor Plans** — a rail, `See All (1)`, captioned **"Sorted by floor level"**
6. **Photos** — a rail, `See All (39)`, captioned **"Sorted by last modified"**

Both collections state their sort order in the header. Ours do not, and on a
39-photo job the order is the difference between finding a photo and scrolling.

### The plan at nine rooms

The floor-level render holds up: poché walls, flat grey floors, each room
labelled with **name and area on two lines**, door swings drawn, and
**furniture and fixtures as line-work** — beds, counters, a bathtub, a toilet,
a vanity, all as proper plan symbols. No dimensions, no handles, no tan grid.

Inside a room it becomes the live drawing: the Bathroom is `1.615 × 3.208`,
tan floor grid, full chains, fixtures still drawn.

### The finding that matters most

The Bathroom's **`Room Type` is `Other`**. On a real job the operator named the
rooms — "Bathroom", "Kitchen", "1st bedroom" — and never set a single type.

That is why the report cover prints **`Bathroom 0`** for a condo that plainly
has one: **the cover counts by TYPE, and no room carries a type.** The statistic
is wrong, it looks authoritative, and nobody notices.

This is the strongest evidence yet for ORD-17's decision to ask the room type
**before** the camera opens rather than offering it afterwards. Type-after is
type-never.

### Photos and video, at 39 attachments

The Bathroom alone holds six. **Photos and videos share one grid**, videos
marked with a **duration badge** (`0:30`, `0:03`).

The video viewer is the photo viewer with one difference: **no `Edit`**. The
annotation editor of §2a is photo-only; a video gets caption, share, info and
delete but cannot be marked up.

The `…` menu completes the attachment model:

    Move · Save · Share · Delete

**`Move` re-attaches an existing photo to a different room or object.** On a
job where 39 photos were taken quickly, filing one against the wrong room is
routine, and being able to move it afterwards is the difference between a
correct claim file and a re-shoot. We have no equivalent.

---

## 3a. The three wall actions, performed

All three were run on a clean bottom wall and undone afterwards.

**Every one of them first raised the same guard:**

> You are about to modify a locked dimension. Confirm? — `Cancel` / `Confirm`

So a locked wall is not merely annotated: **any operation that would change it
stops and asks**. Ours has `lockedWarning`; this confirms the behaviour is right
and that it should fire on structural actions, not only on drags.

**Add Corner** — splits the selected wall in two at a point, leaving the room
closed with one more corner. The 2.500 wall became `1.035 + 1.465` — *not* the
midpoint, so the corner lands where the operator indicated rather than at 50%.

**Add Wall** — inserts a **partition stub growing into the room**, perpendicular
to the selected wall, anchored at one end and free at the other. Length `1.250`.
The host wall split into `0.974 + 1.405 = 2.379`, and `2.379 + 0.120` (the
interior wall thickness) `= 2.499`. **The segments account for the new wall's
thickness** — they do not simply sum to the host wall's length.

**Split Room** — divides the room into **two rooms** with a full partition. The
selected half became `0.975 × 2.500` and kept the name; the remainder became a
second room. This is the operation for a scan that captured two spaces as one,
which happens constantly on a real job.

ORDERS previously listed Add Wall and Split Room as `[seen]` but never
performed, and ORD-18's chrome greys them for that reason. **They are now
observed end to end and can be built.**

## 3b. Insert's five branches

| Branch | What it does |
|---|---|
| Room | places a new room (not exercised) |
| Object | the catalogue — §1 |
| **Note** | jumps to the selected thing's Notes and opens the Add Text sheet |
| **Photo** | jumps to its photo capture |
| **Form** | jumps to its Forms tab |

**Three of the five are shortcuts, not creators.** Note, Photo and Form simply
navigate to a tab of the inspector for whatever is selected. Only Room and
Object bring anything into existence. Worth knowing before we build five
things where we need two.

## 3c. Export

The share glyph in the nav bar opens **Export Floor Plans**, tabs
**Exports | Integrations**.

**Exports** — each with its own options button:

| Export | Description |
|---|---|
| Report PDF | the project report |
| Sketch PDF | the sketch |
| Sketch Files | the sketch in various file formats |
| 3D Model | the 3D model in various file formats |
| **Statistics** | "areas and perimeters of rooms and objects" |
| Previously Generated Files | jumps to a Files section holding past exports |

**Share Links** — `Send a copy via email` ("an editable copy of your floor
plan") and `Get Shareable Link` ("choose what to share, who to share with, and
at which access level").

Two things we do not have and should: **exports are retained** and re-shareable
rather than regenerated each time, and a **statistics export** separate from the
report — an estimator wants the numbers as data, not as a PDF page.

### The generated Report PDF

`All Floors & All Rooms` was generated and read. Four pages for a one-room
project.

**Page 1 — cover.** Logo top right, project name, `CREATED ON August 14, 2026`,
a large empty middle, and one four-column table at the foot:

    Total area 6.25 m² | Floors 1 | Rooms 1 | Bathroom 0

That is the whole cover, and it matches what `Report-Estimate-Blueprint.md`
already found from the client's own export: no claim number, no insured, no
adjuster. `Bathroom` as a cover statistic is an appraiser's convention —
bathroom count drives property valuation — and is meaningless on a water-damage
claim.

**Page 2 — the floor plan.** Much richer, and several parts are worth taking:

- A **running header on every page**: company name and email left, address and
  website centre, phone and `Page 1/4` right. Their account carries the owner's
  own company block, so this is his branding, not theirs.
- A **title block** under it: project name with
  `TOTAL AREA · LIVING AREA · FLOORS · ROOMS`, then a per-floor band
  `▼ Ground Floor` repeating `TOTAL AREA · LIVING AREA · ROOMS` for that storey.
- The room label prints **name, area AND bounding dimensions**:
  `Living Room  6.25 m² (2.500 × 2.500)`.
- The plan is **rotated** to fit the page — `Rotate plan to maximize scale`
  demonstrably works, and the dimension chains rotate with it.
- **The yellow attachment paperclip prints on the plan.** A reader can see which
  rooms carry photos without leaving the PDF.
- Full dimension chains print, opening chains included.

**Page 3 — the room page, and the most important layout in the document.**

A numbered key, exactly as an architect draws one:

- A **locator thumbnail** top left: a miniature of the whole floor with this room
  picked out, so a reader knows where they are. Essential on a multi-room plan.
- The room plan with **numbered yellow badges** placed at each object — ① on the
  door, ② on the affected area.
- Beneath it, `▼ Living Room/Ground Floor`, an **itemised legend** keyed to those
  numbers, each row carrying a small **thumbnail** of the thing:

      ① DOUBLE HINGED DOOR
         Photo   1 Photo (see photos page)
         Notes   Swing clear, no binding on the jmb.
      ② AFFECTED WALL AREA
         Area    6.10 m²
         Name    Affected Area 1

- Room header, right aligned: `WIDTH: 2.500 m · LENGTH: 2.500 m` /
  `AREA: 6.25 m² · PERIMETER: 10.00 m`.
- Footer: the Sensopia disclaimer, a **graduated scale bar** (`0.0 0.5 1.0 1.5
  2.0m`) and the **scale ratio `1:45`**.

**Page 4 — photos**, on their own page, grouped by room and keyed back to the
object number: `▼ Photos/Living Room`, then `1 Double Hinged Door` with the
caption `Front entry door` beneath the image.

So photos never interrupt the plan; the plan says "1 Photo (see photos page)"
and the photos page carries them keyed by number.

**The logo in the header is the OWNER'S** — Renovision AnA's, not magicplan's.
The report is branded to whoever generated it, and the cover footer carries the
full company block: name, email, address, website, phone.

### One trap, in their own product

The room detail page prints **`PERIMETER: 10.00 m`** — the ceiling perimeter.
The app's room sheet, for the same room, showed **`8.40 m`** — the ground
perimeter. **Same word, two different numbers, one product.** Anyone comparing
the screen to the PDF sees a 1.6 m discrepancy and has no way to know which is
which.

This is precisely what `MEASURE_DEFINITIONS` and the ⓘ buttons exist to prevent.
Whatever we print, the label has to say which perimeter it is.

### Layout 2 — `All Floors & Rooms with annotations`, on the real job

Generated from the 9-room condo. **18 pages.** The structure is the important
part: it **interleaves each room with its own photo pages** rather than pooling
photos at the end.

    1   Cover
    2   Floor plan, all rooms                      1:70
    3   1st bedroom      → "6 Photos (see photos page)"   1:54
    4     Photos/1st bedroom      6 tiles
    5   2nd bedroom      → 7 photos                       1:64
    6     Photos/2nd bedroom      6 tiles
    7     Photos/2nd bedroom      1 tile   (overflow)
    8   3rd bedroom      → 11 photos                      1:49
    9     Photos/3rd bedroom      6 tiles
    10    Photos/3rd bedroom      5 tiles  (overflow)
    11  Bathroom         → 6 photos                       1:54
    12    Photos/Bathroom         6 tiles
    13  Bog closet       → 2 photos                       1:41
    14    Photos/Bog closet       2 tiles
    15  Kitchen                                            …
    …

**Six photo tiles per page, 2 × 3**, overflowing onto a second page when a room
has more. Each tile is captioned `<room> Photo n` — and **videos print too**,
captioned `<room> Video n`, presumably as poster frames.

Differences from the basic layout, beyond the interleaving:

- The cover gains a **LOCATION block** — street, postcode, city, province,
  country — because this project has an address. The basic report had none.
- Every page header repeats the address under the project name.
- The room header gains **CEILING HEIGHT**:
  `WIDTH: 5.205 m · LENGTH: 3.300 m · CEILING HEIGHT: 2.449 m` /
  `AREA: 17.15 m² · PERIMETER: 17.00 m`
- Room labels on the floor plan carry name, area and bounding dimensions —
  `Kitchen 24.69 m² (5.524 × 9.116)` — and for a small room the dimensions drop
  to their own line: `Bog closet 1.64 m² / 1.680 × 0.980`.
- Scale varies per page and is stated: 1:70 for the floor, 1:41 to 1:64 per
  room, each with its own graduated bar.

### The perimeter discrepancy, confirmed twice

The Bathroom's room sheet in the app reads **`9.15 m`**. This report prints
**`PERIMETER: 9.82 m`** for the same room. The difference is 0.67 m — exactly
the width of its door.

So it is systematic, not a rounding artefact: **the app shows the ground
perimeter (baseboard, doors deducted) and the report prints the ceiling
perimeter (full interior), both labelled simply "perimeter".** Anyone checking
one against the other finds a discrepancy they cannot explain.

### And the cover statistic is wrong on the real job too

`Bathroom 0`, on a condo whose plan is labelled "Bathroom". Because the room's
`Room Type` is `Other` — see §2e. The error survives all the way to the client
deliverable.

### Still not generated

`Only floors`. AirDrop could not reach the Mac from the office network — it uses
AWDL, the same peer-to-peer layer that breaks mirroring there — so each PDF has
to be sent across by hand.

### Report PDF options

| Section | Setting | Default seen |
|---|---|---|
| Page Layout | Select Page Layout | `All Floors & All Rooms` |
| Page Size | | `US Letter` |
| Room Labels | | `Show all room names` |
| Scale | Display scale | on |
| Scale | Floor Scale | `Scale that maximizes plan size` |
| Scale | Room Scale | `Scale that maximizes plan size` |
| Scale | Rotate plan to maximize scale | on |
| Scale | Use the same scale for all floors | on |
| Floor Plan Dimensions | | preview below |

Page Layout has exactly three options, each with a thumbnail:

    All Floors & All Rooms · All Floors & Rooms with annotations · Only floors

The scale block is the interesting part and it is all about **legibility on
paper**: maximize the plan within the page, rotate it if that helps, but hold
one scale across floors so two storeys can be compared. Our report prints at
whatever size the HTML lands on. `Display scale` also means they print a **scale
bar**, which a drawing handed to an adjuster ought to carry.

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
- **ORD-33 — wall thickness, per floor.** Interior and exterior, defaulting to
  2×4 construction, stored on the floor. Unblocks the three ground-surface
  figures, which then become arithmetic on a stated number rather than an
  invented one. §2c.
- **ORD-34 — ground perimeter (baseboard length).** Perimeter minus door
  widths. Priced directly, and we do not publish it. §2c.
- **ORD-35 — extend MEASURE_DEFINITIONS** to their full list, volume included,
  keeping OUR gross/net naming rather than their inverted
  "with/without openings". §2c.
- **ORD-36 — the objects takeoff.** A per-type count roll-up per floor and per
  project: how many doors, how many windows, how many affected areas. §2c.
- **ORD-37 — room colour, and moving a room between floors.** Both are single
  fields on their room sheet and both are things an operator asks for. §2d.
- **ORD-29 — 360 photo and video capture.** Their `+` offers Photo, 360 or
  Video; we offer stills only. Sizing not yet done. §2.
- Set Size should **hide** on a non-rectangular room, not grey. §3.

---

## The Doors category in full — 17 items

Read off the owner's own screenshots of the library, 21 Aug 2026, scrolled end
to end. Earlier notes in this file and in `interactions-editor.md` recorded the
category and its count but only the first half of the names; this is the
complete list, against what we already have.

Every tile in his screenshots is dimmed with a circle-slash and the overlay
**"Only available in rooms"** — their library gates door placement to inside a
room, so you cannot drop one at storey level. Each tile also carries a
favourite star.

| Theirs | Ours (`OpeningKind`) | Note |
|---|---|---|
| Hinged Door | `doorSingle` | |
| Double Hinged Door | `doorDouble` | |
| Sliding Wood Door | `doorSliding` | |
| Opening | `doorCased` | |
| Pocket Door | `doorPocket` | |
| Folding Door | `doorBifold` | |
| Bypass Door | `doorBypass` | |
| French Door | `doorFrench` | |
| Patio Door | `doorPatio` | |
| Garage Door | `doorGarage` | |
| Glass Door | — | material variant of Hinged |
| Glass Bypass Door | — | material variant of Bypass |
| Door with Window | — | hinged with a lite; `doorEntry` is the near neighbour |
| Arch Door | — | hinged in an arched opening |
| Swing Door | — | double-acting, swings both ways |
| Double Folding Door | — | bifold pair |
| Double Pocket Door | — | pocket pair |
| — | `doorEntry` | ours; theirs splits this into Glass / Door with Window |

**Where we actually stand.** 17 against 11 overstates the gap: their seventeen
collapse to about **eight distinct plan symbols**, and we draw eight. Glass
Door and Hinged Door are the same swing arc; Glass Bypass and Bypass are the
same two panels.

**Where they genuinely beat us** is that a glass door and a wood door are
different replacement costs, and their list carries that distinction while
ours does not. On a restoration estimate that is money, not catalogue padding.
So the gap worth closing is:

1. **The material distinction** — glass vs wood on hinged and bypass, which is
   a property on the existing kinds rather than four new ones.
2. **Four real mechanisms we do not have**: Arch, Swing (double-acting),
   Double Folding, Double Pocket.
3. **The room gating** — refusing door placement outside a room, which is
   theirs and is a good constraint regardless of the list.

Not built. Offered 21 Aug and declined for now.

---

## The object library in full — 14 categories, 666 items

Read off `screens/54-object-library-categories.jpg`, which shows the whole
list without scrolling. **This supersedes the partial count quoted elsewhere
in this repo** — including the header comment in `ObjectCatalog.swift`, which
cites a list that stopped at Electrical and therefore missed three categories
and 201 items.

| Category | Items | Ours |
|---|---:|---:|
| Annotations | 25 | 5 |
| Doors | 17 | 11 |
| Windows | 15 | 9 |
| Structural | 27 | 4 |
| Plumbing | 57 | 8 |
| Appliances | 29 | 5 |
| Kitchen Cabinets | 37 | 5 |
| Furniture | 126 | 8 |
| Electrical | 69 | 2 |
| **Outdoors** | **52** | 5 |
| HVAC | 34 | 2 |
| **Garage** | **13** | 5 |
| **Fire and Safety** | **136** | 8 |
| Restoration | 29 | 15 |
| **Total** | **666** | **92** |

**Fire and Safety at 136 is the surprise** — the second largest category in
their library, larger than Electrical, and one this repo had recorded as
having "nothing to put in it that this trade would place." That judgement was
made against a category list that did not include it.

The sheet also ends with **`+ New Object`**: the library is user-extensible,
which is part of why it can be this large.

**What is NOT recorded here: the item names.** We have every category and
every count, but the only complete item list captured is Doors (17, above).
Listing the rest needs a screenshot per category. Nothing in this repo should
state what is inside Plumbing or Furniture until that exists — the counts are
evidence, the contents are not yet.
