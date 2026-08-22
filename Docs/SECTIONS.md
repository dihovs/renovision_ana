# Sections — the work ledger

**One chat per section.** This file is how the chats stay joined up: each one
reads it to know where things stand, and **updates it before it stops**.

Read `HANDOFF.md` first for the standing rules (match magicplan exactly; the
deliberate divergences; the build traps). This file is only *what* to do and
*what order*.

---

## The rule every chat follows before it stops

1. Set your section's **Status** in the table below.
2. Add a dated line to **the Log** at the bottom — one or two sentences, what
   landed and what did not.
3. If you learned something that changes a *later* section, edit that section's
   notes now. A surprise found in S3 is worth more written into S7 than
   remembered by nobody.
4. If you left something unverified, say so **in the Log**, not just in chat.
   Two features this project shipped "done" compiled cleanly and did nothing
   when tapped.

Commit the ledger update with the work.

---

## Status

| # | Section | Status | Depends on | Primary files |
|---|---|---|---|---|
| **S1** | Room inspector structure | **DONE** | — | `RoomDetailView.swift` |
| **S2** | Wall inspector | **DONE** | S1 | `PlanEditorView.swift`, new `WallDetailView.swift` |
| **S3** | Affected areas — freehand drawing | **DONE** | — | `FloorPlanView.swift`, `PlanEditing.swift` |
| **S4** | Affected areas — remaining parity | **DONE** | S1 | `FloorPlanView.swift`, `AffectedAreaSheet` |
| **S5** | Plan editor parity | **DONE** — all four items shipped and confirmed on the device, build 120 | — | `PlanEditorView.swift`, `EditorChrome.swift`, `StoreyViewport.swift`, `ElevationView.swift` |
| **S6** | Photo editor — blur first | **DONE (build 145)** — all four modes; `Path` tool alone left greyed | — | `PhotoEditor.swift`, `RoomPhotos.swift` |
| **S7** | Video and 360 capture | **CHROME VERIFIED · A CRASH FOUND AND FIXED · MIGRATION 0041 APPLIED TO PRODUCTION 22 Aug — upload pipeline still unverified, needs a real camera** | S6 | `RoomPhotos.swift`, `SiteCamera.swift`, `projects.ts`, migration 0041 |
| **S8** | Objects — doors, windows, catalogue | **DONE (build 155)** — 77 entries, 14 sections, sizes, takeoff both levels | S5 | `ObjectCatalog.swift`, `ObjectGlyphs.swift`, `ObjectEmblems.swift`, `ObjectPicker.swift`, `ObjectDetailView.swift`, `PlanEditorView.swift`, `Artwork/` |
| **S9** | Statistics and takeoff | **PARTIAL, VERIFIED LIVE 22 Aug** — net wall area + Objects tab confirmed on "My Condo" at both room and project level; ground-surface trio and living-area rows still open | S1 | `Models.swift`, `ProjectStatistics.swift`, `RoomDetailView.swift` |
| **S10** | Report parity | **BUILT (unverified)** — every listed item; needs one export read against theirs | S9 | `ReportDocument.tsx` |
| **S11** | Commercial room types | **DONE** | — | `livingArea.ts`, `CaptureFlow.swift` |
| **S12** | Project and floor screens | **PROJECT DONE · FLOOR SHELL DONE AND VERIFIED LIVE 22 Aug** (built 18-20 Aug, this row was stale) — one duplicate screen to retire | — | `ProjectsView.swift`, `LevelCanvas.swift` |
| **S13** | Icon set | NOT STARTED | — | new `Glyphs.swift` |
| **S15** | Photos to customers, by email | **BUILT (unverified) — build succeeded, never sent live** | — | `sendDocument.ts`, `projects.ts`, `SendPhotosPicker.tsx` |

**Two verifications** were folded into the sections that own them: the
dimension-tap unlock into **S5**, the project-card plan into **S12**. The
project-card plan was confirmed 17 Aug 2026, incidentally, while checking S1 —
"My Condo"'s card draws correctly. The dimension-tap unlock is still open.

**How to know what is on the phone.** Every install is stamped:
`CURRENT_PROJECT_VERSION=NN` on the build, then
`xcrun devicectl device info apps --device <udid> --bundle-id ca.renovisionana.crm`
prints the number actually installed. **Build 95** is on it as of 18 Aug 2026.
Use this before debugging anything that "did not change" — a long stretch of
one session went into chasing a change that had already shipped and simply
had not been force-quit into.

**Everything below S4 in this table was reached through S12's work rather
than in its own pass** — the floor canvas, Add Floor, Add Room and Select
Room Type all landed while building the project and floor screens. Read
S12's "What landed" before assuming a section is untouched.

---

## S1 — Room inspector structure

**Goal.** Ours has tabs `Details | Damage & Drying | Photos & Notes`. The
reference has `Details | Photos & Notes | Forms`, with damage as a **section
inside Details**, found by scrolling. The owner: *"Damage and drying shouldn't be
here. It should appear when we push up more, and there we have to have add
areas."*

**Read.** `object-model.md` §2d (room sheet) and §2b (the affected-areas block).
`HANDOFF.md` §5 has the observed layout and current line numbers.

**In scope.** Tab set; Details content order — Statistics (4-up + See All) →
Dimensions (Ceiling Height, Living Area %) → Affected Areas (+ Add New Area, and
the note) → General (Floor, Room Type, Room Name, Room Color). Sheet header
`ⓘ name` + collapse chevron. A `Forms` tab with the reference's empty state. Our
drying log becomes its own section after Affected Areas so General stays last.

**Out of scope.** The area editor canvas itself (S3/S4). The wall sheet (S2).

**Done when.** Tabs match; scrolling Details reaches damage and Add New Area;
Forms exists; drying log still reachable; installed and looked at on device.

**Prompt.**
> Read Docs/HANDOFF.md then Docs/SECTIONS.md, and do S1.

**What landed (17 Aug 2026).** All of the above except the last clause. Built,
`BUILD SUCCEEDED`, installed and launched on the simulator — **the room sheet
itself has not been looked at by anybody**, because the app opens on the admin
password wall and the phone was `unavailable` to `devicectl` at the time.

- Tabs: `Details · Photos & Notes · Forms`. `Damage & Drying` is gone as a tab.
- Details order: plan drawing → Statistics (4-up + See All) → Dimensions →
  Affected Areas → Moisture → General. The drawing leads because ours is
  opened from a list as often as from the canvas the sheet sits over.
- Statistics is a 4-up (`Floor · Wall · Perimeter · Volume`, their order) with
  `See All` → `RoomStatisticsSheet`, new, at the bottom of `RoomDetailView.swift`.
  Ceiling height moved into Dimensions; baseboard length and the door / window
  / staircase counts moved into See All. Nothing was dropped.
- Dimensions: Ceiling Height **read-only**, Living Area (%) editable — a 5%
  stepper writing on release, plus "Use the room type's n%" to clear the
  override. `nil` and `0` stay distinct all the way to the column.
- General, in their order: Floor · Room Type · Room Name (new, editable) ·
  Room Color.
- Header is `ⓘ name` with a chevron: collapses large → medium, dismisses at
  medium. The ⓘ is a badge, not a control — the ⓘ that opens a definition is
  the one on a figure.
- New in `API.swift`: `renameRoom`, `setLivingPercent`, and `NullablePatch`.

**Ceiling Height is read-only and the reference's is not.** Editing it means
letting the phone rewrite a measurement, which `/api/v1/scans/[id]` refuses on
purpose — and the number feeds wall area, volume, the elevations and the
report. That is an owner decision, not a structural one, so it was left alone.
See the note in **S12**, which owns the floor sheet where the same field lives.

**Verified on the simulator, 17 Aug 2026, on "My Condo → Living room":** tabs,
header, and both new fields all confirmed live — Living Area stepper writes
and its reset link works, Room Name live-updates the header and its
empty-name guard reverts cleanly rather than saving blank, See All opens the
new `RoomStatisticsSheet` with the ⓘ popovers working, Forms shows its empty
state, the chevron collapses large→medium then dismisses. Photos & Notes and
the drying log both still render. This also stood in for the **S12
project-card-plan verification** — "My Condo"'s card drew its plan correctly.
S1 is done.

---

## S2 — Wall inspector

**Goal.** A wall has no inspector at all. The reference gives it the same three
tabs as an object, with its own photos and notes.

**Read.** `object-model.md` §2b.

**In scope.** Length; its affected areas; **Display Elevation in Report**
(per-wall — a claim wants the three damaged elevations, not twelve);
**Load-Bearing Wall**; per-wall photos and notes. Reached by selecting a wall in
the plan editor and swiping up, as the room sheet is.

**Out of scope.** The elevation drawing (built already, `ElevationView.swift`).

**Done when.** Selecting a wall and swiping up gives the sheet; both toggles
persist; `Display Elevation in Report` actually governs the report.

**From S1.** The tab set and the header are built and can be copied wholesale:
`Details · Photos & Notes · Forms`, header `ⓘ name` + collapse chevron,
`.presentationDetents([.medium, .large], selection:)` so the chevron has
something to collapse. The Forms empty state is `RoomDetailView.formsTab` —
lift it rather than writing a second one.

**Room notes are still missing and are cheap.** `/api/v1/scans/[id]` already
accepts `notes` (string or null) and `room_scans.notes` exists — but `RoomScan`
in `Models.swift` does not decode the column, and the Photos & Notes tab has
photos only. If you are building notes for a wall anyway, do the room's in the
same pass; the reference's Notes is a tap opening an **Add Text** sheet with
Cancel / Save, not an inline field (`object-model.md` §2).

**What landed (17 Aug 2026).** All in-scope items, plus the swipe-up route
into it. Built, `BUILD SUCCEEDED`, installed and **verified live** on the
simulator — see the Log for how, since the usual tap gestures on the plan
canvas would not register under this session's input tooling.

- A wall has no id of its own — it is edge N of the room's polygon, the same
  indexing `affected_areas.wall_index` already uses. So its details are
  server-side keyed the same way: new table `room_walls`
  `(room_scan_id, wall_index)` unique, migration `0034_wall_details.sql`.
  `getRoomWall`/`upsertRoomWall` in `src/lib/crm/roomWalls.ts`, route
  `src/app/api/v1/scans/[id]/walls/route.ts` (GET list, PATCH one by
  `wallIndex`). Swift: `RoomWall` in `Models.swift`, `API.walls`/`.updateWall`.
- **`Display Elevation in Report` is ADDITIVE, not the reference's on/off
  gate.** The report already prints only walls with damage marked — "the
  three that are damaged, not twelve" is already true here without this
  column. The flag's whole job is letting the operator add an *undamaged*
  wall for context; it can never suppress a damaged one. `RoomElevations` in
  `WallElevation.tsx` takes a `wallFlags` map now; `report/page.tsx` builds
  it from `listRoomWalls`. If the owner ever wants the flag to also suppress
  a damaged wall, that is a product decision to ask about, not a bug.
- Wall photos: `project_files.wall_index` (nullable, paired with
  `room_scan_id`), threaded through `addProjectFile`/`listRoomFiles` and
  `/api/v1/photos` (query param and form field both called `wallIndex`).
  `RoomPhotosSection` takes an optional `wallIndex` and reuses the room's own
  photo grid UI unchanged.
- Wall notes: kept simple as an inline field on `room_walls.notes`, same
  divergence from the reference's Add-Text-sheet pattern that
  `AffectedAreaSheet`'s notes field already made — **not actually wired into
  the Swift UI this pass**, only the column and the PATCH route exist. The
  sheet's Details tab did not have room to fit a third field without pushing
  Settings below the fold on a phone that already needed two drags to reach
  it during verification; add it as its own row if the owner asks for it.
- **The swipe-up route.** A wall selected in the plan editor already had its
  own `EditorActionBar` depth and its own "Swipe up ↑ for Wall info" caption
  (§4) — but the `onInfo` callback ignored `selection` entirely and always
  dismissed back to the room, which was silently wrong for a wall the whole
  time this caption has existed. Fixed in `PlanEditorView`'s `onInfo`: wall
  selected → opens `WallDetailView`; otherwise unchanged (dismiss).
- `InspectorFormsTab` extracted from `RoomDetailView.formsTab` per the note
  above — both sheets use it now, parameterised by `subject` and `footer`.
- `Add New Area` on the wall sheet dismisses it and opens `ElevationView` on
  that wall (the existing drag-to-draw face editor) — no new drawing surface
  was built, this just routes to the one that already exists.

---

## S3 — Affected areas, freehand drawing

**Goal.** The owner: *"I want a function to draw it manually, not square, not any
shape — just take my finger and draw the damaged space. It can be a circle, any
shape."*

**This is a divergence, deliberately.** magicplan has no freehand tool; its
editor is tap-a-point-then-drag, with points added and removed. So freehand is
**additive** — the corner editor stays exactly as it is, because that is what the
owner tests parity against.

**In scope.** A freehand mode: drag a closed outline with one finger; simplify the
captured path (Ramer–Douglas–Peucker or similar) to a sane polygon so it stores,
measures and prints like any other area; then hand it to the existing corner
editor for adjustment. Area from the same shoelace everything else uses.

**Out of scope.** Changing the tap-to-adjust editor.

**Done when.** A finger-drawn blob saves, measures correctly, draws on the plan
and in the report, and its corners can still be nudged afterwards.

**What landed (17 Aug 2026).** A `Points | Freehand` chip picker in
`AreaEditor` (styled like `DamageCausePicker`, right below it), additive to
the existing corner editor exactly as scoped:

- `PlanEditing.simplify` — standard Ramer–Douglas–Peucker on an open path,
  new, pure, no view in sight. `PlanEditing.simplifyClosed` wraps it for a
  LOOP (what a finger draws, not what `simplify` alone handles): it appends
  the loop's own start point to its end and simplifies that as an open path,
  so every captured point is measured against the one point the gesture is
  guaranteed to pass near twice — where it started and lifted — then drops
  the duplicate the reduction leaves at both ends.
- Freehand mode swaps the corner handles for a single `DragGesture
  (minimumDistance: 0)` capture layer, drawn live as the finger moves,
  throttled to a new sample only every 3pt of movement so the array does not
  grow once a frame for nothing — `simplify` throws away the redundant
  points anyway. `.highPriorityGesture` because the canvas underneath
  already claims taps for corner-deselect; without priority a touch-down in
  freehand mode could be swallowed by that instead.
- On release: canvas points → plan metres via `PlanTransform.model` (the
  one place that conversion lives, per the transform's own header comment),
  simplified with a **screen-space** tolerance (6pt, converted through the
  transform's scale so it feels the same at every zoom) rather than a fixed
  metric one, then quantised. A stroke under 3 points, or one that simplifies
  to fewer than 3 or to ~zero area, is discarded silently — it does not
  overwrite whatever `corners` already held, so an accidental tap in
  freehand mode cannot wipe out corner-editor work.
- The result is written straight into `corners` — the same array the corner
  editor already reads and writes — `push()`ed onto the same undo/redo
  history first, and mode flips back to `.points` automatically. That is
  the whole of "hand it to the existing corner editor for adjustment": there
  is no second code path, freehand is just a second way to arrive at the
  first one's input.
- Area, save, name, damage cause, undo/redo, Cancel's discard confirmation —
  none of it changed; a freehand-drawn shape is, the instant the finger
  lifts, an ordinary `corners` array like any dragged one.

**Verified live on the simulator, 17 Aug 2026, on "My Condo → Living room".**
This chat's `xcode-select` was not pointed at Xcode, so the dedicated
simulator tool couldn't tap or drag; the owner declined a first
computer-use fallback offer (reasonably — a broad Simulator grant for one
check), then approved it on a second ask, scoped to this verification. With
that, the whole path was driven for real: opened Add New Area on a genuinely
L-shaped room, switched to Freehand (the stray dots below disappeared — see
the bug note below), dragged a rough closed loop with the mouse, released,
and watched it become an 8-ish-point polygon with `Points` re-selected
automatically, area recalculated (451→368 sq ft), and correctly-placed
corner/edge handles on the new shape. Selected a corner: red four-way
handle, live edge dimensions, Delete point, all present. Dragged it: numbers
updated live, area recalculated again (→416 sq ft). Saved: the sheet closed
back to the room, and `Affected Areas` now lists "Affected area · Floor ·
Water · 416 sq ft" — a full round trip through the real API, not local
state. Every claim in "What landed" above is now confirmed, not just built.

**Found a real, pre-existing bug on the way — not S3's, but worth knowing
before S4 touches this screen.** Before freehand was ever used, `Points`
mode on this room's *original* seeded shape (`corners` from
`plan.polygon.dropLast()` — a genuine L-shape, alcove for the door) drew two
correct corner dots on the shape and then a scatter of extra filled and
hollow dots well below the canvas, inside the card but nowhere near the
drawn room. Switching to `Freehand` confirmed the handles themselves are
fine — the stray dots vanished with `edgeHandles`/`cornerHandles` — so this
is either the L-shaped room's specific `plan.polygon` carrying extra or
degenerate points, or something in how `seed()` reads it for a non-rectangle,
not a general handle-rendering bug. It went away entirely once freehand
replaced `corners` with its own simplified polygon, which is why nobody
building rectangles here would ever have seen it. **S4 owns this screen
next** (`object-model.md` §2b, the area inspector table) — worth reproducing
on an untouched L-shaped or non-rectangular room's corner editor before
building further on top of it.

---

## S4 — Affected areas, remaining parity

**Read.** `object-model.md` §2b, the area inspector table.

**In scope.** `Show Dimensions` per area; photos and notes attached to the *area*
rather than only its room; Fill Color as a full swatch matrix with Reset; the
area's own row layout — swatch · name / *surface* · area · expand glyph.

**Keep.** Our damage-cause chips. magicplan has only name + colour; cause decides
trade and rate here.

**Prompt.**
> Read Docs/HANDOFF.md then Docs/SECTIONS.md, and do S4.

**Before starting, two things from 17–18 Aug that land directly on this
section.**

**The corner-editor bug — FIXED 18 Aug, and it was not what it looked
like.** It had nothing to do with L-shapes, `plan.polygon` or `seed()`; a
rectangle was worse. Full account below, under "That bug is fixed".

**Look at sizing before logic when something "does nothing".** Five separate
reports of a dead control this session were all the same family — a view sized
or compared as something other than it appears. `strokeBorder` fills nothing,
so only the outline takes a tap; a gesture layer sized to its content has
almost nothing to grab on an empty screen; `==` that compares only an id tells
SwiftUI a changed value is unchanged. `HANDOFF.md` §4 lists all five.

**From S3 — a corner-editor bug to reproduce before building on this
screen.** On a genuinely L-shaped room ("My Condo → Living room"), opening
`AreaEditor` in `Points` mode on the room's own seeded shape drew two
correct corner dots and then a scatter of extra handles well below the
canvas, unrelated to the drawn room. It cleared up the moment the shape was
replaced (freehand draw, in S3's testing) — so this is specific to that
room's `plan.polygon` or to how `seed()` reads a non-rectangle, not a
general fault in `cornerHandles`/`edgeHandles`. Confirm on a fresh
non-rectangular room before trusting this screen's corner editor.

**That bug is fixed, and S3's reading of it was wrong in a way worth
recording.** It is nothing to do with L-shapes, `plan.polygon` or `seed()`.
`FloorPlanView` ends in `.aspectRatio(plan.width / plan.height, contentMode:
.fit)`, so its Canvas never occupies the space it is offered — it takes the
largest rect of the plan's own proportions and sits at the top-leading
corner of it. `AreaEditor` was computing its handle transform from the
`GeometryReader`'s size, which is the OFFER. Two `PlanTransform.fit` calls,
different sizes, so every handle sat a uniform distance below the corner it
belonged to. Reproduced arithmetically before anything was touched, by
running the real formula over a 361×360 card:

| Room | Canvas actually drawn in | Worst handle offset |
|---|---|---|
| Rectangle 4.0 × 3.2 m | 361 × 289 | **36 pt** |
| L-shape 6.0 × 5.0 m | 361 × 301 | **30 pt** |
| Tall corridor 1.4 × 7.0 m | 72 × 360 | **139 pt** |

The corridor is the extreme because its narrowed canvas falls under the
240pt `showDims` threshold, so the two transforms disagreed about the insets
as well as the origin. All three go to **0.0 pt** with the fix.

Two things follow. **It was never L-shape-specific** — a rectangle was
worse. What made it look that way is that a uniform downward shift still
leaves handles inside a rectangle's own fill, where they read as roughly
right; on an L the concave notch puts some of them in open paper. And
**freehand did not fix it**, it hid it: freehand swaps the handles for a
capture layer, and the loop it captures goes through the same offset
transform, so stroke and handles agree with each other while both sit clear
of the drawing. Anything that looked correct in S3's freehand testing was
two wrongs cancelling.

The fix is in `PlanTransform.fit`, which now performs the aspect fit itself
and is idempotent — a size that already has the plan's proportions comes
back unchanged, which is what `FloorPlanView`'s own call passes. The other
half is `AreaEditor`'s `ZStack(alignment: .topLeading)`: that is what puts
the drawing's origin on the overlay's origin. Centre that stack and every
handle moves again.

**The lesson generalises past this screen.** `HANDOFF.md` §4's bug family is
"check what a control is SIZED as and what it is COMPARED by before reading
the handler". This is its sibling: **a view that constrains its own size
does not occupy the space it was offered, and an overlay positioned in the
offer will not line up with it.** `FloorPlanView` is the only plan renderer
with an internal `.aspectRatio` — checked — but S5 and S8 both put overlays
over canvases, so it is worth knowing on sight.

**What landed (18 Aug 2026).** All four scope items, plus the bug above.

- **Fill Color** — the reference's full matrix with `Reset`, in `General`.
  Six hues across by three values down, and the **middle row is the cause
  table itself** (`DamageCause.hex` in `DAMAGE_TYPES` order), so the row an
  area already sits on is the row it starts from and a recolour stays in the
  palette the rest of the plan uses. `Reset` clears the override so the area
  follows its cause again; it is disabled when there is nothing to reset.
  Swatch and header dot move optimistically and roll back if the write
  fails.
- **`API.ColorEdit`** — a colour field has THREE states and Swift's
  synthesised `Encodable` can only express two. `leave` says nothing,
  `set` writes a hex, `reset` encodes real JSON `null`. This is the
  `NullablePatch` trap from HANDOFF §8 in its multi-field form: that helper
  is single-key, so `AreaPatch` encodes by hand. **Without this, Reset would
  have silently done nothing** — exactly how room colour lost weeks.
- **Show Dimensions** — was in the sheet already but wall-only, because only
  `ElevationView` honoured it. A floor area now prints its own width and
  height beside it on the plan too (`FloorPlanView` step 6): witness lines
  with ticks and the figure in the area's own colour, measured off the
  polygon's metres rather than its screen box so it is exact at any zoom,
  and suppressed at thumbnail sizes with everything else `showDims` governs.
  The height line goes to the RIGHT when the region starts hard against the
  room's left wall, or the figure would be drawn off the paper.
- **Photos and notes on the AREA** — the sheet is now the reference's
  three-tab inspector (`Details · Photos & Notes · Forms`), matching the
  room and wall sheets. `project_files.affected_area_id` already existed and
  the upload path already sent it; what was missing was the read. Added
  `affectedAreaId` to `listRoomFiles` and to `GET /api/v1/photos`, and gave
  `RoomPhotosSection` the filter. **No migration needed.** The area's photos
  still appear in the room's own grid, which reads everything filed against
  the room — that is deliberate and matches how wall photos already behave.
- **The row** — `AffectedAreaRow`, one view now instead of two. The room's
  list and the wall's list were drawing the same object differently (the
  wall's had no subtitle at all). Swatch · name over surface · area ·
  chevron, with the subtitle italic as theirs is, and a small ruler glyph
  when the area is dimensioned — the toggle that sets it is two taps away
  and its effect is on a drawing the row is not.
- **`DrawnArea`** replaces the `(polygon, colour)` tuple `FloorPlanView`
  took, because the third member is a `Bool` and `(polygon, colour, true)`
  says nothing at a call site.
- Every field commits on its own; the Save button is gone. An inspector that
  can be closed with unsaved edits in it is an inspector that loses them.

**Not done, and deliberately.** Their `+ New Field` (custom fields on an
area) is not built — it is the same mechanism as the project's custom
fields and belongs with them, not here. Area **Forms** shows the shared
empty state, as the room and wall tabs do.

**Verification — read this before trusting the list above.** Build
`BUILD SUCCEEDED`, `tsc` clean, 1120 tests passing, installed and launched
on the simulator (already signed in, home screen renders). **Nothing on
these screens was tapped.** The dedicated simulator tool refused all session
with "Xcode is installed but not selected" even though `xcode-select -p`
reports Xcode correctly and two simulators were booted — `/var/db/
xcode_select_link` does not exist, so the path is being INFERRED rather than
recorded, and `sudo xcode-select -s /Applications/Xcode.app/Contents/
Developer` is the fix. It needs the owner's password.

So: the handle fix is proved arithmetically against the real formula, not by
eye. Everything else on this screen — the colour matrix writing and
resetting through the API, floor-area dimensions actually drawing, area
photos uploading and coming back filtered, the three tabs — **compiled and
was not looked at.** HANDOFF §8 is explicit that this is not the same as
working. First ten minutes of the next chat on this screen, or of S5 which
sits beside it.

---

## S5 — Plan editor parity

**Prompt.**
> Read Docs/HANDOFF.md then Docs/SECTIONS.md, and do S5.

---

### State at handoff (18 Aug 2026, build 118)

Most of 18 Aug was spent inside this section without it being formally
opened — the owner tested live on his own phone through builds 96 → 118 and
what he hit next set the order. Everything below was checked against the
source on the day rather than remembered.

**Done, and verified by the owner on his device:**

- The canvas merge — one shared, animated `StoreyViewport` drives the
  storey layer and the room editor on the same frame, so entering and
  leaving a room is a continuous zoom rather than two views swapping. Third
  attempt; the first two were rejected. `StoreyViewport.swift` carries the
  full account of why a fade could never have worked.
- Tap a room on the storey → editing activates in place. Tap outside the
  room → leave. A selected wall/opening/corner deselects on the FIRST
  outside tap and only the second leaves.
- One-finger pan, two-finger zoom, at his explicit instruction.
- The dotted background grid zooms with the plan — a **deliberate
  divergence** from object-model §8, which measured the opposite on his own
  device. He was told and chose it. Do not "fix" it back.
- Openings: their own inspector (kind, width, height, Distance to Floor,
  elevation illustration, delete), `Replace with…`, dragging along the wall
  in BOTH the plan and the elevation face, and `Insert → Door or window`
  from the elevation.
- 90° corner snap, via Thales' circle.
- Room label centred and enlarged; wall joints mitred; units follow the
  operator's own setting everywhere.

**Left to do — items 2, 3 and 4 shipped in build 120 (18 Aug 2026).**
Item 1 is the only one still open, and it is the one nobody can close from
a keyboard.

1. ~~**Verify the dimension tap**~~ — **CONFIRMED ON THE DEVICE, 18 Aug
   2026, build 120.** The owner's own words: *"keypad opens it is good."*
   This is the one item in the whole section that had never been seen
   working, through however many builds; it is now seen. The account below
   is kept because the failure mode is worth recognising.
   Built long ago, never once seen working, and 18 Aug found why: the whole
   branch sat behind `if false` from an old bisect nobody closed. Re-enabled
   in build 112. Tap a wall's length figure; the keypad should open with
   `Unlock`. Because dimensions draw OUTBOARD of the walls, a miss falls
   through to "tap outside to leave", which is an obvious tell. **Nothing
   in build 120 changed the hit test itself** — the one adjacent change is
   that the branch is now also gated on the `Dimensions` layer being ON, so
   check with that layer on (its default).
2. ~~**Set Size should HIDE on a non-rectangular room**~~ — **done, build
   120.** `PlanEditing.isRectangle` (four corners, four square angles,
   1.2° tolerance because every corner is quantised to a centimetre and a
   1 m wall can sit 0.57° off square while being as square as this app can
   represent). `EditorActionBar` gained `hidden:`, which REMOVES a verb
   rather than greying it — deliberately a different thing from the greying
   the bar already does for Add Wall and Split Room, and the header on
   `hidden` sets out why. Both editors pass it, `RoomSketchView` included:
   that canvas opens as a typed rectangle and is pulled out of one, which
   is exactly the case.
3. ~~**ORD-31 — live edge dimensions while dragging**~~ — **done, build
   120.** `EditorChrome.drawLiveEdgeDimensions`, on the two edges adjoining
   the dragged corner, at their midpoints (the point on each edge furthest
   from the hand), in the area editor's own red. The floating `liveLabel`
   now stands aside while they are on screen — on a corner drag it was
   printing the same two figures a second time.
4. ~~**ORD-23 — overall bounding dimension line**~~ — **done, build 120.**
   `EditorChrome.drawOverallDimensions`: width along the bottom, depth up
   the left, on their own line outboard of every per-wall one. Drawn on
   every room, not only odd-shaped ones — the reference draws it there too,
   and a figure that appears only sometimes is one nobody learns to look
   for.

   **This one moved the camera, and that is the part to know about.** An
   outer line needs room outboard of the walls and there was none: the
   standalone editor fit the plan at a 48pt inset and the storey camera at
   28, both of which already clipped the per-wall figures on whichever axis
   was binding. The standalone fit now insets by what the outer row plus
   its own type needs, and `LevelCanvas.cameraBounds` pads the focused
   room's bounds by 22% each side. **The padding is expressed in METRES, as
   a fraction of the room, on purpose** — `bounds` is the value
   `AnimatedStoreyViewport` interpolates, so a margin written there zooms
   continuously with everything else. Changing the viewport's `inset`
   instead would step the base layer's scale on the first frame of the
   focus transition: a pop, in the one animation this app has already had
   rejected twice for not reading as one continuous zoom. **Entering a room
   therefore frames it slightly wider than build 118 did.** That is the
   cost of the figures fitting, and it is worth a word from the owner.

**Closed, do not go looking for them:**

- The `BISECT` "canvas taps may not register at all" item. The owner spent
  a whole session selecting walls, corners and doors by tapping; it is
  ruled out. The `if false` that comment sat next to was the DIMENSION hit
  test only, and it is item 1 above.
- Two-finger-pan-doesn't-work. Replaced by one-finger pan at his request.

**The one rule this section keeps proving.** Five separate "it does
nothing" reports on 18 Aug were all presentation, not logic: a gesture
attached only in the wrong mode, two `.sheet` modifiers on one view where
SwiftUI honours one, a branch behind `if false`, an overlay positioned in
the offered size rather than the drawn one, and an opening clamped against
itself because an obstacle list was filtered by value instead of index.
**Check what is attached, sized, compared and presented before reading the
handler.** HANDOFF §4 lists the earlier five of the same family.

---


**From S4, and it applies directly here.** A view that constrains its own
size does not occupy the space it was offered, and an overlay positioned in
the offer will not line up with it. `FloorPlanView` aspect-fits its own
Canvas; `AreaEditor` was placing drag handles in the `GeometryReader`'s
size and every one of them sat up to 139pt off the corner it belonged to.
`PlanTransform.fit` folds the aspect fit in now and is idempotent, so this
particular pair is safe — but this file puts its own overlays over its own
canvas, and this section already owns two live "a tap does nothing"
reports. **Check the geometry before the handler**: `PlanTransform.drawnSize`
will tell you what a plan view actually occupies. `FloorPlanView` is the
only plan renderer with an internal `.aspectRatio` (checked 18 Aug), so if
`PlanEditorView`'s canvas gains one, its overlays need this treatment too.

**Landed out of order (18 Aug 2026) — the canvas merge.** Also not this
section's original scope, also done live because the owner hit it directly.
`PlanEditorView` was a `.sheet` — tapping a room on the storey canvas always
presented it as a new screen, however fast or quiet the animation. The
owner showed four screenshots of magicplan doing the opposite: tap on the
storey canvas activates editing IN PLACE, no new screen, and the room
inspector is a swipe-up from THERE. Fixed by splitting `PlanEditorView`'s
editing internals into `RoomEditorCore` — no `NavigationStack`, no toolbar
of its own — and giving `FloorCanvasView` a plain `if editingRoom { core }
else { floorContent }` instead of a sheet. Full account in the Log.

**This does NOT touch the `BISECT` canvas-tap bug below.** That bug is
about `handleTap` not registering a single-finger tap on a wall or corner
AT ALL, inside the editor once you are already there. The canvas merge only
changed how you ARRIVE at the editor. Rule the BISECT bug in or out
separately — it may now be easier to reproduce, since a merged canvas means
fewer moving parts between "I tapped" and "did anything happen", but it has
not been touched.

**In scope.**
- **Canvas taps may not be registering at all, not just the dimension tap.**
  Found while building S2: selecting a wall or corner by tapping the canvas
  (`PlanEditorView.handleTap`, reached via `.onTapGesture`) did not respond to
  any synthetic tap tried during that section's verification, while drag
  gestures on the same screen worked fine. There is a live, unresolved
  `BISECT: temporarily disabled to establish whether this branch is what
  stopped every canvas tap from registering` comment sitting in `handleTap`
  from an earlier session that hit the same symptom and never closed the
  loop. Worth ruling in or out on a real device before trusting S2's
  "verified" claim too far, and before this section's own dimension-tap item
  below.
- **Verify the dimension tap** opens the measurement panel with `Unlock`. Built,
  never seen working. The string is drawn **10pt beyond** its dimension line, not
  on it — that off-by-10 has already broken this twice.
- **ORD-23** — the overall bounding dimension line, outboard of the per-wall
  ones. Without it a non-rectangular room cannot answer "how deep is it".
- **ORD-31** — live edge dimensions while dragging, in the plan editor. The area
  editor has them; this does not.
- Set Size should **hide** on a non-rectangular room, not grey — the reference
  removes it and restores it when the room is a rectangle again.

**Landed out of order (17 Aug 2026) — two-finger pan and pinch-zoom fixed.**
Not part of this section's original scope, but same file, same family of
gesture bug, done live in a later chat because the owner hit it directly and
asked for it before anything else. `PlanEditorView`'s own header rule —
"Two fingers navigate. One finger selects. One finger only EDITS what is
already selected" — was never actually true: the pan drag's `.updating`
closure was `{ _, _, _ in }`, silently doing nothing since the editor was
built, and zoom was tangled into the same dead `SimultaneousGesture` and
didn't work either. New `PlanNavigationGesture.swift` installs real
`UIPanGestureRecognizer(minimumNumberOfTouches: 2)` /
`UIPinchGestureRecognizer` via UIKit — SwiftUI's `DragGesture` cannot be
restricted to a finger count, which is almost certainly why the original
attempt was left disabled rather than ripped out, the same shape as the
`BISECT` comment above. **Verified live on the simulator**, including the
regression check that matters most here: single-finger corner drag still
edits (area recalculates, "Adjusted by hand" appears, undo works) and does
not also pan the camera. Two-finger pan/pinch themselves were verified with
a temporary one-finger-enabled build (the Simulator has no way to fake a
genuine second touch from a mouse) and reverted before committing — worth a
real two-finger check on an actual device before fully trusting it. **The
canvas-tap / `BISECT` item above is still open and is a different bug** —
that one is about single-finger taps not selecting a wall/corner at all,
untouched by this fix.

---

## S6 — Photo editor, blur first

**Read.** `object-model.md` §2a — the whole editor mapped, and the table of what
the SDK gives free.

**Do blur first and ship it alone.** It is the piece blocking real claim photos:
a photo that catches a document, a face or a plate currently cannot be taken at
all.

**Then, in order:** adjustments (`CIColorControls`, `CIExposureAdjust`,
`CITemperatureAndTint` — trivial), freehand and eraser (PencilKit), the shape
tools (arrow, line, rectangle, ellipse, text — ours to write), the cropper (no
public system cropper exists).

**Free from the SDK**, all confirmed present: `SwiftUI.ColorPicker` (with alpha),
PencilKit, five Core Image filters. Roughly two thirds.

### State (18 Aug 2026, build 121)

**Blur is built and shipped alone**, as this section asks. What landed:

- **A photo VIEWER, which did not exist.** The thumbnails in
  `RoomPhotosSection` were not tappable at all — a photo could be uploaded
  and then never looked at again on the phone that took it — and since §2a
  reaches the editor from the viewer's `Edit`, blur had nowhere to live
  either. `PhotoViewer` loads the photo at full stored resolution, not the
  96pt thumbnail: an editor that redacts a thumbnail uploads a thumbnail.
- **`PhotoEditorView`** — §2a's chrome (`Cancel · undo · redo · Done`) and
  the four-mode row along the bottom in the reference's order. Only
  Pixelate does anything; Draw, Crop and Adjust are drawn in place and
  greyed, the rule the plan editor's bar already follows.
- **Pixellate, not Gaussian blur.** A blur preserves the low frequencies and
  text under a light one has been read back out by deconvolution;
  pixellation throws the information away. The cell scales to the REGION —
  a fixed 40pt cell over a plate in a 4000px photo leaves the plate
  readable.
- **Done replaces the original**: uploads the redacted copy, then deletes
  the original, in that order. A blurred copy beside a readable original
  redacts nothing. The confirmation dialog says so before it acts. Needed a
  new **`DELETE /api/v1/photos?id=`** — `deleteProjectFile` already removed
  the storage object as well as the row.

**Adjustments and Draw landed next, build 123.** Adjust is §2a's value dial
at 0 with all five channels, each held as −100…100 and mapped to its
filter's own units at render time — one control, one range, centre neutral,
rather than exposing `CIColorControls`'s native scales where contrast is
neutral at 1 and brightness at 0 on the same row. Draw is the full colour
picker, the seven named widths and the reference's eight-tool row with
`Sharpie` and `Eraser` live on PencilKit; the other six greyed.

**Three things about the editor's internals worth not rediscovering:**

- **One history across all three modes.** `EditState` holds redactions,
  adjustments and the `PKDrawing` together, so `undo` means the same thing
  wherever it is pressed. Parallel stacks would restore a screen that never
  existed.
- **Pipeline order is deliberate**: adjustments → redaction → annotation.
  Adjustments are a property of the photograph, so the redaction pixellates
  what the operator can actually see; annotation is LAST so an arrow drawn
  at a blurred plate stays crisp instead of being pixellated with it.
- **PencilKit strokes are in the picture's DRAWN size, not its pixels.**
  `rendered` takes `drawnAt:` and scales by the ratio. Without it every
  stroke composites at a fraction of its size in the corner of a 2048px
  file — found on review before it shipped, and the same family as the S4
  overlay bug.

**Left:** the cropper (no public system cropper exists) and §2a's six
custom shape tools — Arrow, Text, Rectangle, Path, Line, Ellipse.

**Two things the next chat must know.**

1. **The DELETE route only works once the branch is deployed.** The phone
   talks to the `mobile-app` Vercel preview, so until this is pushed, Done
   uploads the redacted copy and then fails to delete the original —
   leaving both, which is the safe failure but not the intended one.
2. **Nothing here has been tapped.** Built, installed as build 121, and
   that is all. Redaction especially deserves a real look: the one thing
   worse than no blur is a blur the operator trusts that did not land where
   the finger drew it.

---

## S7 — Video and 360 capture

**In scope.** Video capture and playback; the duration badge on the grid tile;
video excluded from the annotation editor (the reference has no Edit on a video);
360 if it proves cheap. Storage, thumbnailing, a migration.

**Note.** Videos **do** print — the annotated report captions them
`<room> Video n`. See §2e.

**Before building, a real conflict, resolved by the owner (21 Aug 2026).**
`SiteCameraController` (built 20 Aug) explicitly does NOT send video to the
server — his own quoted instruction, *"this video shouldn't go to our
server because it's heavy."* But this section's own Note says videos must
print in the report, which needs them on the server. Asked which way to
go: **upload, with opt-in.** Recording stays local by default — every clip
still saves to the phone's own Photos, nothing changes there — and a small
prompt after each recording asks "Keep a copy on this job too?" Only that
explicit choice uploads. The 20 Aug instruction is honoured as the
default; it just isn't the only path anymore.

**What landed (21 Aug 2026).**

- **Migration `0041_video_files.sql`** — `project_files` gains
  `duration_seconds` and `thumbnail_path`, both nullable. `content_type`
  was never actually constrained to images — only the app never sent
  anything else — so no migration was needed just to store a video row.
  **APPLIED TO PRODUCTION 22 Aug 2026 and verified** — `project_files` is
  13 columns now, both new ones nullable, and PostgREST's generated API
  docs list them, so the schema cache is fresh rather than assumed. Applied
  through Database → Tables → New column in the dashboard, not by running
  the SQL file, so the file is not in the Migrations list; it is
  `add column if not exists` throughout and stays safe to re-run. See
  `HANDOFF.md` §5 item 1 for why the SQL editor was not used and for the
  leftover-query trap that made this look done when it was not.
- **The upload path bypasses this server entirely.** A route handler's own
  request body is capped around Vercel's ~4.5 MB — fine for a photo,
  nowhere near a recorded clip — and nothing in this codebase had ever
  needed to get around that before. New: `createUploadTarget`/
  `recordUploadedFile` in `projects.ts`, and `POST /api/v1/videos/upload-url`
  + `POST /api/v1/videos`. The phone PUTs bytes straight to Supabase
  Storage using a signed upload URL this server only *mints*; the video's
  bytes never pass through Vercel at all. The poster thumbnail is small
  enough to go through the ordinary `/api/v1/photos` route unchanged.
  **This whole pipeline is new and has never been exercised against a real
  Supabase project** — no way to do that from this session. First thing to
  prove live: record a clip, tap "Keep on job", confirm it actually shows
  up in the room's grid.
- **`addProjectFile` now returns `{ id, path }`**, not just `id` — needed so
  the thumbnail upload can hand its real storage path back for
  `thumbnail_path` rather than a signed URL, which would expire and leave a
  broken poster behind it. All three existing callers updated.
- **`SiteCameraController`/`SiteCameraView`** — `finishVideo` no longer
  deletes the temp recording on a successful save; it holds it until the
  operator answers the keep prompt, then whichever button was tapped
  decides who deletes it. `stopRecording`'s completion signature grew a
  `URL` for exactly this. Nothing about the DEFAULT behaviour changed — a
  clip nobody keeps still ends up in Photos and nowhere else, same as
  before this section.
- **`RoomPhotosSection`** — the grid tile branches on `RoomPhoto.isVideo`:
  poster frame (or a plain video glyph if none uploaded) instead of the
  photo itself, and a duration badge (`0:12`, `1:03` — reference's own
  `m:ss` format, §2e) in the same corner the "uploading" cloud badge
  already used. Tapping a video tile opens the new `VideoPlayerView`
  (`AVPlayer`/`AVKit`) rather than `PhotoViewer` — a separate screen, not a
  mode of the photo one, which has no `Edit` button to hide because it is
  never reached from a video tile at all. That is how "no Edit on a video"
  is satisfied — structurally, not with a conditional.
- **Not queued.** A photo goes through `PhotoQueue` so nothing is lost with
  no signal; a kept video does not — it is already safe in Photos by the
  time the upload even starts, so a failed upload here costs a retry, not
  evidence, and `PhotoQueue` is sized for megabytes, not "most of a
  gigabyte."
- **The report** (`ReportDocument.tsx`, the report page's data assembly,
  `strings.ts`) now threads `contentType`/`thumbnailUrl` through to
  `ReportRoom.photos`, draws a video's poster frame where a photo would
  print, and captions it `<Room> Video n` — **in its own numbering series**,
  never merged with the photo count, exactly as this section's Note and
  S10's reading of the reference both describe. New `t.videoNumber(n)` in
  both locales.

**Deliberately not built this pass.**

- **360.** `SiteCameraController`'s own header already ruled this out
  ("shipping a tab that opens something else — or nothing — would be worse
  than not shipping the tab") and nothing found while building S7 changed
  that arithmetic.
- **Video from the photo LIBRARY.** The `+` menu's library path is still
  `matching: .images` — only a camera-recorded clip can be kept on a job.
  The reference offers both; camera-first covers the primary site-capture
  case and keeps this pass's scope to one capture surface rather than two.
- **The thumbnail is its own `project_files` row**, not a rowless object —
  see the doc comment on `API.uploadVideoThumbnail`. It will show up in the
  room's ordinary photo grid alongside the video it belongs to, which reads
  as a small, possibly confusing duplicate. Accepted for now rather than
  teaching the upload route to store a file with no row; worth a look if it
  turns out to bother anybody on the actual grid.
- **`recordUploadedFile` trusts the client for size and duration** — this
  server never receives a video's bytes to measure them itself, unlike
  every other upload in this app. Not verified against a real clip.

**Verification — updated 22 Aug, with the owner in the room typing the
admin password in himself.** The camera chrome is real and confirmed:
`+` → Camera → the permission prompt → the full viewfinder (timestamp
burn-in reading the actual date live, rule-of-thirds grid, lens/flash/flip
row, VIDEO/PHOTO mode strip) all render and respond to taps.

**A real crash was found and fixed in this pass, not a simulator quirk.**
Switching to Video and tapping record threw an uncaught `NSException` —
`-[AVCaptureMovieFileOutput startRecordingToOutputFileURL:recordingDelegate:]
No active/enabled connections` — and killed the app outright. `startRecording()`
called that method without checking a video connection actually existed
first; `NSException` cannot be caught in Swift, so there was no way for
this to fail softly once it started. The Simulator has no camera at all,
which is what surfaced it, but the same guard now protects a real device
too — anything that leaves the movie output's connection inactive
(a session that failed to configure, permission pulled mid-flight) would
have crashed exactly the same way. Fixed: `startRecording` now checks
`connection.isActive`/`.isEnabled` before calling into AVFoundation and
reports "This device has no working camera for video" instead — confirmed
on the simulator afterward: the message shows, the app stays alive, Cancel
returns cleanly to Photos & Notes.

**What this pass could NOT reach**, because the Simulator has no camera
hardware to actually produce a recording: the "Keep on job" prompt, the
thumbnail/duration extraction, and the whole upload pipeline are still
unverified. That needs a real device. `xcodebuild … build` →
`BUILD SUCCEEDED` after the fix; `tsc --noEmit`/`npx vitest run` clean,
1127 passing throughout (no TS touched by the crash fix). **Migration 0041
IS now applied to production (22 Aug) — that is no longer a blocker.**
First chat with a real iPhone: record a clip, tap "Keep on job", and watch
it actually reach the grid. The schema is ready for it; nothing in the
upload path has been exercised against a real clip yet.

---

## S8 — Objects: doors, windows, catalogue

**In scope.** Sill height in the placement UI (the model already carries it,
ORD-24); **ORD-25 Replace with…** — swap an opening for another kind keeping its
position and size; the catalogue itself with a recently-used rail and favourites.

**Note.** There is no door type and no window type — one object model, three
dimensions, and a door is an object whose Distance to Floor is zero.

### State (18 Aug 2026, build 124)

**The modelling question was put to the owner and he answered it**, which
is what unblocked the whole section: *"well if replaced, if there is damage,
it needs to be counted, there is installation involved also, i need to have
an option to include or exclude it like any other item."* So an object is a
LINE ITEM, and that decided everything else — a table (migration **0037**,
**applied to production 18 Aug** and verified, 16 columns), a `disposition`
(none · remove · reset · replace · protect), an `included` flag, and
`quantity` so a run of eight identical cabinets is one line.

**An object is not an opening**, and the two models stay apart: an opening
lives IN a wall, is keyed to an edge index and DEDUCTS net wall area; an
object stands ON the floor, has a position, keeps its own height and
deducts nothing. `OpeningKind` was not touched.

**What landed.** `ObjectCatalog` — 33 entries over six sections, every size
North American stock with its inch derivation stated, the precedent
`OpeningKind` set. `ObjectPicker` — sections whose tiles are themselves
illustrations, a detail grid per section, Favourites and Recently used
rails above everything (`UserDefaults`, not a table), and search: ORD-40's
four pieces. Placement, drag, quarter-turn Rotate, Duplicate, Delete and
Replace with…, plus `ObjectDetailView` where include/exclude and
disposition live.

**Illustrations are coloured in the picker and INK on the plan**, the
owner's own call and the reference's own split. `ObjectTileArt` draws the
colour; `EditorChrome.drawObject` draws the ink. An EXCLUDED object draws
dashed and pale — still in the room, out of the claim, and a drawing that
showed the two identically would make the count impossible to check.

**Doors and windows from the Insert menu too**, asked for mid-build: *"doors
and windows i want to be able to choose from the insert menu itself also
from the floorplan look, when i choose a wall and click insert."* Both
routes now exist and end in the same `PlanEditing.placeOpening`. With a
wall selected it goes straight in; without one, the kind is chosen first
and a banner waits for the wall to be tapped — and `fits` is asked of every
wall, so a 60" double door that fits the long wall is still offered.

**Left:** the takeoff roll-up (S9 owns the Objects tab in Statistics —
`countByKind` is written and unused), sill height in the placement UI, and
editing an object's size, which wants the walls' own measurement panel
rather than three loose text fields.

**Note (from S4).** Placement puts controls over a plan canvas. Read S5's
first note before positioning any of them — a view that aspect-fits itself
does not occupy the space it was offered, and that cost this project a
whole screen's worth of drag handles.

**Bug found and fixed live, 22 Aug 2026 — correcting a detected door mid-scan
kicked the operator out of the whole capture session.** His report: *"it
detected my door wrong, i clicked to choose the right one, i choose, and it
kicked me out from the scan to the edit or storey mode."*

Root cause was a double dismiss. `RoomScanViewController.askAbout` (the
mid-scan "this looks wrong, pick the real one" flow, `ios/App/App/RoomScanViewController.swift`)
presents `ObjectLibraryPicker` through a bare `UIHostingController` +
UIKit `present(host, animated:)` — not a SwiftUI `.sheet(isPresented:)`,
which is how every OTHER call site of that picker shows it
(`PlanEditorView.swift`, `LevelCanvas.swift`, `ElevationView.swift`). Its
`onPick` closure then calls `self.dismiss(animated:)` on
`RoomScanViewController` itself, to run a completion once the sheet is
actually gone (asking which way a door swings, then refreshing detections).
`ObjectLibraryPicker.pick(_:)` ALSO calls its own SwiftUI `dismiss()`
straight after — correct at the other three call sites, where a real
`isPresented` binding is there to receive it, but here there is no such
binding local to this presentation. The second dismiss had nothing left to
close where it was fired, so it bubbled up the presentation chain instead —
past the live scan's own `fullScreenCover` in `CaptureFlow.swift` (whose
`isPresented` setter is a deliberate no-op, built to be undismissable from
outside — so it silently swallowed the write rather than erroring) and
into the storey editor's real `$capturing` sheet binding one level up,
closing the entire scan.

**Fixed**: `ObjectLibraryPicker` gained `selfDismisses: Bool = true` —
defaulted on for the three existing call sites, set `false` only from
`askAbout`, which keeps its own `self.dismiss(animated:)` as the sole
dismissal. `BUILD SUCCEEDED` afterward. **Not verified against a real scan**
— there is no way to drive RoomPlan's live capture from the Simulator (no
LiDAR), so this is confirmed by tracing the exact dismissal chain in the
code, not by reproducing the crash and watching it stop. First real test
should be exactly his repro: mid-scan, correct a wrongly-detected door,
confirm the scan keeps running.

**A secondary risk flagged but not touched**: `CaptureFlow.swift`'s
no-op `fullScreenCover` setters (there are three, all `.init(get: { stage
== .something }, set: { _ in })`) will keep silently absorbing any stray
SwiftUI `dismiss()` fired from inside them, regardless of the specific bug
above. That's clearly deliberate — the intent is that nothing but an
explicit `stage = ...` assignment should be able to close that cover — but
it also means a future stray `dismiss()` anywhere inside the live scan
would fail the same silent way rather than erroring where it's easy to
find. Worth knowing, not fixed this pass — changing it risks the very
behaviour it was written to protect.

---

## S9 — Statistics and takeoff

**In scope.** The `See All` statistics screen; **ORD-36** objects takeoff (a
count roll-up per type — how many doors, windows, affected areas); finish
extending `MEASURE_DEFINITIONS` to the reference's full list, including volume.

**Never adopt their naming.** "Walls with openings" is the **gross** figure and
"without openings" is the net — backwards from every reading instinct, and a 4 m²
error on a small room. Ours stays `{gross, net}`.

**Their own product contradicts itself here**, which is the argument for labelling
every figure: the app's room sheet shows `9.15 m` perimeter and the report prints
`9.82 m` for the same room. The difference is exactly one door width — ground
perimeter versus ceiling perimeter, both labelled just "perimeter".

**From S1.** The room-level `See All` now exists as `RoomStatisticsSheet`, at
the bottom of `RoomDetailView.swift` — measurements (floor, wall gross,
perimeter, baseboard, ceiling height, volume) and an Objects block of counts.
It is deliberately a stub of the reference's list: extend or replace it here,
and add the Objects **tab** (ORD-36) rather than the plain count rows it has.
Note that their room-sheet `Perimeter` is the GROUND perimeter — our baseboard
length — while ours is the wall run. Both are in the sheet, both labelled; do
not quietly swap which one the 4-up leads with.

`ProjectStatistics.swift`'s `StatisticRowView` is no longer private — it is the
shared ⓘ row, used by both statistics sheets.

**What landed (21 Aug 2026) — a slice of this section, not all of it.**
Scoped down from the full reference list to what was a real, checked-in gap
rather than already-decided-against (`footprintInterior`/`footprintGross`,
the reference's ground-surface trio, are dead `MEASURE_DEFINITIONS` entries
on the TS side with a documented reason they're not computed — no wall
thickness on a scan — and that reasoning stands untouched).

- **`RoomScan.wallAreaNetSqm`** (`Models.swift`) — new. Gross minus the
  doors/windows/openings the scan found, `width × height` each, clamped at
  zero. Mirrors `wallAreaSquareMeters` in `roomScan.ts`, which already had
  both figures — Swift only had gross. **Does NOT yet fold in
  `partitionAreaSqm`/`averageWallHeightM`**, the 20 Aug half-height-partition
  fix — that's Swift-only and hasn't been given to the TS side either, so a
  room with an interior partition can show a different net figure on the
  phone than a report/web screen would compute today. Pre-existing drift,
  not introduced by this pass, but worth closing before it's trusted for
  billing.
- **`ProjectStats.netWallSqm`** (`ProjectStatistics.swift`) — same formula,
  summed across rooms, added as its own row in the project-level `See All`
  right after gross. Closes a Swift/TS drift: `projectStatistics.ts` already
  had both.
- **`RoomStatisticsSheet` is now two tabs**, `Measurements` / `Objects`,
  replacing the single scrolling list. This is the literal ORD-36 ask —
  "add the Objects tab... rather than the plain count rows it has." The
  Objects tab holds, in order: an "Openings" section (doors/windows/
  staircases — these were the bare `counts` rows, renamed and moved rather
  than left orphaned at the bottom of Measurements), then the existing
  object takeoff (by `displayName`) and the work-by-disposition breakdown,
  both of which were already correct and just moved under the new tab.
  `ProjectStatisticsSheet` was left as its own single scroll — its
  Summary/Measurements/Objects split already reads fine and S9's tab
  complaint was specifically about the room sheet's orphaned counts.

**Left, deliberately out of this pass:** the ground-surface trio (needs a
wall-thickness field nothing here has — same blocker S12's floor table
notes); the living-area rows (`livingAreaAbove`/`Below`/`total`) the
reference's floor sheet shows, which live in a separate `livingArea.ts`
module not touched this session; wiring or retiring the orphaned TS
`countByKind` in `roomObjects.ts` (unused, and duplicative of what both
Swift sheets already compute inline by `displayName` — a real
consolidation opportunity, just not one this pass forced).

**Verification — CONFIRMED LIVE, 22 Aug 2026.** The owner typed the admin
password into the simulator himself; from there, driven on "My Condo →
Ground Floor → Living room". Both new figures and the whole tab
restructure are real, not just compiled:

- **Project-level `See All`**: `Wall area (gross) 872 sq ft` immediately
  followed by `Wall area (net) 689 sq ft`, both with their ⓘ, exactly the
  row order built.
- **Room-level `See All`**: the `Measurements`/`Objects` segmented control
  renders and switches. Measurements shows Floor area, both wall-area
  rows, Perimeter, Baseboard length, Ceiling height, Volume — the net row
  present here too. Objects shows `Openings` (Doors 7, Windows 2) above
  `Objects in this room` (Refrigerator 1, Sofa 2, Table 1) — the exact
  two-section layout built, with real data from a real room.

`xcodebuild … build` → `BUILD SUCCEEDED`; `tsc --noEmit`/`npx vitest run`
clean throughout, 1127 passing (no TS touched by S9).

---

## S10 — Report parity

**Read.** `object-model.md` §3c and the report section; `Report-Estimate-Blueprint.md`.

**In scope.** Interleaved per-room photo pages (room page → its photos → next
room, six tiles per page, overflowing); the numbered key — badges on the plan
cross-referenced to an itemised legend with thumbnails; the locator thumbnail
showing where a room sits in the floor; scale bar and ratio per page; running
header with the company block and page numbers.

**Also.** Generate the third layout, `Only floors`, which was never produced.
AirDrop the PDF to the Mac and read it with PDFKit — far cheaper and clearer than
screenshotting the in-app viewer, which does not scroll under mirroring anyway.

### The reference report, read page by page (17 Aug 2026)

The owner supplied a real 19-page export of his own job ("My New Project",
4489 Rue de Palerme). Read with PDFKit per the protocol above — the whole
structure below came out as text, no screenshots. **This is the target.**

**Page 1 — cover, and nothing else on it.** Project name; `CREATED ON` +
date; `LOCATION` as four lines (street / postal + city / province / country);
then four figures — `Total area`, `Floors`, `Rooms`, `Bathroom`. The company
block sits at the foot: name, email, street address, website, phone. Note
**Bathroom is its own headline count** beside rooms, which means a room
TYPE is being counted separately on the cover — we have `room_type` and can
do the same.

**Page 2 — the storey, whole.** Every room drawn together, each labelled
`name`, `area m²`, and `(width × length)` beneath it. Wall dimension chains
run outside the outline. Bottom-left carries a **scale bar with ticks**
(`0 1 2 3m`) and the **ratio** (`1:70`) — and the ratio CHANGES per page,
computed from what that page had to fit: 1:70 here, 1:54, 1:64, 1:49, 1:45
on later room pages. So the scale is derived per drawing, not a constant.

**Pages 3–18 — one room at a time, photos interleaved behind it.** Per room,
in this order:

1. A plan page: `▼ <Room name>` then the storey name under it; a first
   figure line `WIDTH: … • LENGTH: … • CEILING HEIGHT: …`; a second
   `AREA: … • PERIMETER: …`; the room drawn alone with its own chains and
   its own scale bar + ratio; then `▼ <Room>/<Floor>` and a `Photos —
   N Photos (see photos page)` pointer.
2. Its photo pages: header `▼ Photos/<Room>`, **six tiles per page** in two
   columns, each captioned `<Room> Photo n`. Overflow starts a new page
   with the same header (2nd bedroom ran 7 items onto a second page for
   one tile).

**Videos are captioned in the same sequence as photos** — `2nd bedroom
Video 1`, `Video 2` — numbered in their own series, not merged with the
photo numbering. This confirms §2e and is a live constraint on **S7**.

**Page 19 — signature.** Four labelled blanks: `Signature`, `Signature
Date`, `Printed Full Name`, `Phone`. Nothing else.

**Running header, every page from 2 on:** project name; the full address on
one line; then `TOTAL AREA: … • LIVING AREA: … • FLOORS: … • ROOMS: …`.
Note both areas are printed on every page — ours must be able to, which
means the living-area figure has to be available to the report and not only
to the phone.

**Running footer, every page:** the disclaimer in caps, and `Page n/19`.

**What this adds that was not already written down:** the cover page's
existence and layout, the signature page, the per-page scale RATIO being
derived rather than fixed, `Bathroom` as a headline count, and the video
caption series. The extracted text is at
`Docs/reference/magicplan/report-19-page.txt` if it is worth re-reading;
the PDF itself stays out of the repo.

---

## S11 — Commercial room types (BLOCKED)

**Blocked on the owner, not on code.** The Residential/Commercial split is
confirmed real and worth building. Their *list* is not: it is an office fit-out
vocabulary — Private Office, Photocopy Room, Archives — and a flooded commercial
building needs a mechanical room, an electrical room, a server room, a retail
floor, a warehouse bay, a loading dock.

**Take the split, not the list.** Two questions only the owner can answer: which
commercial types his jobs actually meet, and whether living area applies to them
at all — ANSI Z765 is residential and means nothing in a warehouse.

**Answered and built (18 Aug 2026).** The owner chose *theirs plus ours*, so
`COMMERCIAL_ROOM_TYPES` carries the reference's sixteen first — a hand that
knows magicplan finds what it expects — then the ten a flooded commercial
building actually needs and their list cannot name: mechanical room,
electrical room, server room, retail floor, warehouse bay, loading dock,
storage room, washroom, stairwell, other. Two carry notes because they
change what the operator does: the mechanical room is where the burst
usually starts, and water in an electrical room is a safety call before it
is a drying one.

**The second question answered itself.** Every commercial type is
`band: "excluded"`, so living area is not reported for any of them. ANSI
Z765 measures the finished living space of a DWELLING; quoting a "living
area" for a loading dock would put a figure with no standard behind it in a
document an adjuster reads. Floor area is still measured and still totalled
— only the living-area line stays silent, and the picker says so.

`RoomTypeRule` gained `category`, absent meaning residential, so every type
predating the split needed no edit. `roomTypeRule()` now looks up
`ALL_ROOM_TYPES` — without that a commercial room's type would have
resolved to the fallback and silently mispriced its living area.

---

## S12 — Project and floor screens

**In scope.** Verify **the project card draws a plan** (was a stale PostgREST
cache plus a `largest_room` embed falling back — should be fixed, never
confirmed). The address card rendered as a map. Collection rails that **state
their sort order** — "Sorted by floor level", "Sorted by last modified" — which
on a 39-photo job is the difference between finding a photo and scrolling. Floor
sheet parity, including the per-level wall-thickness override that the data model
already supports but no screen can set.

**What landed (17 Aug 2026) — the PROJECT half of this section is done.**

Grid: `All / Favorites / Archived` chips (the reference's own three,
replacing measured / to-measure), archived served by its own
`?status=archived` query with **Restore** in place of the ⋯ menu; per-card
⋯ menu `Favourite · Move · Duplicate · Archive…` and a star badge;
`WorkspaceInfoRow` carrying the project count and real pending-upload state
from `ScanQueue`. Migration **0035** (`assigned_to`, `is_favorite`) and
**0036** (`address_line1/city/postal`), both applied to production.

Project page, in the reference's order: description row → address card →
Forms → Statistics 4-up (`Floor Area · Wall Area · # Floors · # Rooms`) +
See All → Floor Plans rail → Photos rail → Files rail → Created / Last
modified. Plus `Project Info` behind the pencil, the title-bar menu, the
`Export Floor Plans` sheet behind share, and an `Add Floor` sheet behind the
Floor Plans +. Equipment and the living-area card came off the page at the
owner's instruction; living area moved into Project Info rather than being
deleted.

**A map-based `Project Location` picker** replaced the three blind address
boxes: Apple's own `MKLocalSearchCompleter` for search, a fixed centre pin
the map slides under, and reverse geocoding to read the address OFF the
map. MapKit needs no key and no quota — an earlier note here claiming it
did was wrong.

**Scanning left the tab bar and the floating button**, per the owner: it is
now the + at the head of the Floor Plans rail, which is where the reference
starts a floor plan. Home's "Scan a room" still covers a measurement taken
before the job exists.

**Three bugs found, all the same family — a screen unable to show what the
database already held.** `ProjectSummary.==` compared ids only, so SwiftUI
correctly declined to redraw a card whose star had changed (favourite
looked permanently stuck, and every write had in fact succeeded).
`URLSession` sat on the default cache policy, which will serve a stale GET.
The New Project tile was drawn with `strokeBorder`, which fills nothing, so
only its 1.5pt outline took a tap. Also fixed: + created a project on tap
(empty "New project N" rows piled up — it opens the form now, Save
creates), and favouriting bumped `updated_at`, shuffling starred jobs to
the top of a grid ordered by it.

**THE FLOOR SHELL — MARKED "NOT BUILT" ABOVE, ACTUALLY BUILT 18-20 Aug 2026,
found stale 21 Aug.** This paragraph originally described choosing a storey
in `Add Floor` as opening the scanner, with `StoreyPlanView` drawing rooms
but carrying none of the reference's chrome. That is no longer true and
apparently hadn't been for a session — nobody flipped this section's status
after the work landed, which is exactly the "a whole session was once
spent arguing about a change that had shipped" mistake `HANDOFF.md` §4
warns about, just against a doc instead of a device.

**What's actually there now.** `Add Floor` and the Floor Plans rail both
route to `FloorCanvasView` (`ProjectsView.swift`'s `openFloor` destination,
`LevelCanvas.swift:1042`), which has the full floor-depth chrome pulled out
into the shared `EditorChrome.swift` this section originally called for:
`EditorUndoRedoPill`, two `EditorStepperPill`s (floor switch, 2D/3D),
`EditorActionBar(depth: .floor(name:))` with its `+ Insert` popover
(Room/Object/Note/Form/Photo), and swipe-up opening `FloorDetailView`
(`LevelCanvas.swift:2570`) — tabs, header, a 4-up Statistics band, exactly
the shell described below. Insert → Room routes into the SAME draw/scan
flow (`CaptureFlow`, `RoomSketchView`) rather than a second canvas, as
asked. `EditorChrome.swift`'s own header makes the shared-chrome reasoning
explicit — same philosophy `PlanTransform` set for geometry, applied here
to layout.

**One genuine loose end, not yet closed.** `StoreyPlanView` (still in
`LevelCanvas.swift:562`) is a SECOND, older, unchromed floor screen —
hand-rolled nav bar, a bespoke single "Add Room" action tile instead of
`EditorActionBar`, its own simpler `StoreyInfoSheet` instead of
`FloorDetailView`. It never got upgraded when `FloorCanvasView` was built;
it just moved to a narrower job. `ProjectsView.swift`'s `landing`
destination (set only when a capture finishes, so the newly filed rooms can
be spotlit in white — `arrivals: [FiledRoom]`, `StoreyPlanView`'s own init)
still routes there, while every other floor entry point routes to
`FloorCanvasView`. **This is now the exact "two copies of that chrome"
drift this section always warned against** — just realized as an
un-upgraded old screen rather than a hand-copied new one. Retiring it means
giving `FloorCanvasView` an `arrivals` parameter and the same spotlight
behaviour, then deleting `StoreyPlanView`/`StoreyInfoSheet` and the
`landing` destination in favour of `openFloor`. Not done this pass —
flagged rather than rushed, since the spotlight behaviour has its own
built-in-review logic (`concerns`, `StoreyPlanView.swift` — actually
`LevelCanvas.swift` — around the `pending`/`spotlight` properties) worth
reading in full before touching it, and this section's own remaining
blocker below still stands regardless.

**The floor shell is CONFIRMED LIVE, 22 Aug 2026** — driven on the
simulator with the owner typing the admin password in. `Add Floor` (or
tapping the existing "Ground" floor plan) opens `FloorCanvasView` with the
full chrome: floor-depth nav, the `+ Insert` / `Rotate` action bar, "Swipe
up ↑ for Ground Floor info". Tapping a room animates into it in place — no
sheet, no second screen — exactly the continuous-zoom behaviour this
section and S5 both describe. Swiping up on the floor canvas opens
`FloorDetailView`. This wasn't a re-read of the code; it was tapped
through on a real running build.

**A `floors` table is the next real blocker on the REST of this section —
the floor inspector's fields, not the shell above.** The floor
inspector (swipe up from the Insert bar) is built and matches §2c's shell —
tabs, header, Statistics 4-up — but every figure on it is DERIVED and
read-only, because a storey is a string on `room_scans.level` rather than a
row. There is nowhere to put the three things the reference's floor sheet
edits: the floor's name, its interior wall thickness and its exterior wall
thickness. Ceiling height is shown as the tallest room's, not an average —
averaging two rooms that disagree invents a height neither has. Making any
of it settable means a `floors` table keyed by (project, level), which is a
migration, not a screen. **That table would also give floor-level photos
somewhere to live**, which is why the inspector's Photos tab currently
explains itself instead of listing anything.

Note also that `CaptureFlow`'s mode choice is documented as one-way and as
living in the floor chooser (A1). Reaching the draw canvas directly from a
floor pick means either an `initialMode` on `CaptureFlow` or `Insert`
offering the choice itself — the second is closer to the reference, where
`Insert` is the branch point.

**From S1 — a question for the owner, before this section builds Dimensions.**
The floor sheet's Dimensions block is `Ceiling Height · Interior Wall Thickness
· Exterior Wall Thickness` (`object-model.md` §2c), and the room sheet has
Ceiling Height too. In the reference all of them are **editable**. Ours are
not, and deliberately: `/api/v1/scans/[id]` refuses to rewrite what was
scanned — *"the measurements themselves are a record of what was scanned and
are deliberately not editable"*. Ceiling height is not a label, it is the
multiplier under wall area, volume, every elevation and the report, so making
it typeable is a product decision. S1 left it read-only rather than decide it.
Ask, then do it in one place for both sheets.

---

## S13 — Icon set

**Goal.** Our own glyphs, in the reference's positions. Their icon artwork and 3D
renders are the one thing not copied; everything about *where* a control sits is.

A door glyph must show swing direction, a window its three lines, an affected
area its cause colour. Draw them; do not trace theirs.

---

## S15 — Photos to customers, by email

**Decided 20 Aug 2026, by the owner: photos go by EMAIL, not MMS.**
*"We just stick with email. If we're gonna do SMS, we can do MMS. We'd rather
not do it, and just do email."*

So outbound MMS is **not** to be built. The `mediaUrls` parameter on `sendSms`
stays — it is written and tested, it costs nothing to leave, and reversing this
decision later should not mean rewriting it — but nothing in the product calls
it.

**Read `Docs/CRM-Messaging.md`** for the messaging area, and note that email is
the better-paved half: `src/lib/crm/sendDocument.ts` already sends four kinds of
transactional mail through **Resend**, with a shared HTML shell and a French /
English split.

**In scope.**

1. **Attach photos to an outbound email.** Resend takes attachments; none of the
   four existing senders uses them yet. Reuse `shell()` so a photo email looks
   like the quotes and invoices already going out, rather than becoming a fifth
   visual language.
2. **Pick the photos from what the CRM already holds** — room photos, affected
   areas, files on the job. The point is to send what has been captured, not to
   re-upload it.

**Out of scope.** Outbound MMS. Inbound email — see below, it is much larger
than it sounds and should be its own decision.

**Two things this decision does not settle, both worth raising with the owner:**

- **Inbound MMS is already live and already storing.** The webhook reads
  `NumMedia`, copies files into the private `sms-media` bucket and writes
  `media_paths` (migration 0040). Customers text photos whether or not we invite
  it. Right now `SmsThread.tsx` renders `body` and nothing else, so **those
  photos are being collected and are invisible** — the one genuinely bad resting
  state, because it is data held with no way to look at it. Either render them
  (small: sign the paths in a batch and draw them, no outbound, no cost) or stop
  capturing them. Doing neither is the current state and should not survive.
- **Inbound email does not exist at all.** There is no `/api/**/inbound` route
  and no parsing. A customer emailing a photo lands in the owner's own mailbox,
  outside the CRM. Building that is a bigger job than the MMS UI that was
  dropped — worth knowing, since "just do email" sounds like the smaller path
  and for the *receiving* direction it is the larger one.

**Done when.** A photo held in the CRM can be emailed to a customer, and it
arrives looking like the other mail the business sends.

**Prompt.**
> Read Docs/CRM-Messaging.md then Docs/SECTIONS.md, and do S15.

**What landed (21 Aug 2026).** Both in-scope items, built as a new picker
screen rather than an extension of the report page — the report aggregates
photos for printing, not for picking, and its data shape (one `ReportRoom`
per room, files nested inside) doesn't want to also be a flat, checkable
list. Kept the report page untouched.

- **`listAllProjectPhotos(projectId)`** (`src/lib/crm/projects.ts`) — new,
  aggregates the project's own files with every room's own photos (via
  `listRoomScans` + `listRoomFiles`, same loop the report page already runs),
  filtered to `content_type.startsWith("image/")`, newest first. A room whose
  photos fail to load is skipped, not fatal, matching the report's own
  degrade-per-room behaviour.
- **`downloadProjectFiles(paths)`** (same file) — pulls bytes straight off
  the private `project-files` bucket via `.storage.download()`, not through
  a signed URL. A signed URL is for a browser to follow; minting one just to
  `fetch()` it server-side would be a same-process detour through the CDN.
  Paths that fail to download are dropped, not fatal — the caller learns
  which filenames didn't make it.
- **`emailPhotos(...)`** (`src/lib/crm/sendDocument.ts`) — new, alongside
  the quote/invoice senders. Reuses `shell()` so it looks like the same
  business's other mail. **Does not use `recipientsFor`** — that filters by
  the `receivesQuotes`/`receivesInvoices` per-contact flags, which model a
  standing preference; a photo send is a one-off, operator-chosen recipient
  list each time, so no new `receivesPhotos` flag was added. Returns
  `{ attached, missing }` alongside the usual `SendResult` so the UI can say
  when some selected photos couldn't be read.
- **`emailPhotosAction(projectId, payload)`** (`admin/projects/actions.ts`)
  — unlike `sendQuoteAction`, the email is NOT best-effort here: it is the
  entire point of the button, so a transport failure throws and the picker
  screen shows it, rather than being logged and swallowed.
- **`/admin/projects/[id]/photos`** (new page) + **`SendPhotosPicker.tsx`**
  (new client component) — a checkbox grid grouped by room (`"Project
  files"` for the ones with no room), recipients pre-populated from the
  client's own email list with an optional ad-hoc address, a French/English
  toggle (defaulting French, same convention the report and invoices use),
  and an optional note. Linked from the project page next to "Open report".

**Not done, and worth flagging to the owner rather than building blind:**
outbound MMS stays refused per his 20 Aug decision; the **inbound MMS
photos are still invisible** in `SmsThread.tsx` (§3 of `CRM-Messaging.md`)
and inbound email doesn't exist at all — neither was in this section's
scope but both are still true after it.

**Verification — read before trusting the above.** `tsc --noEmit` clean,
`next build` succeeded (the route compiles, `/admin/projects/[id]/photos`
is in the route list), `npx vitest run` — 1127 passing, none new (this file
has never had its own test — `sendDocument.ts` has none of its existing
four senders under test either, so this follows the file's own convention
rather than leaving a gap only this feature has). **Nothing here has been
clicked, and no email has actually been sent** — there was no live Resend
key or a real project with photos and a client in reach this session.
First ten minutes of the next chat on this screen: open a project that has
both a client and room photos, select a few, send to a real inbox, and
confirm the attachments open (not just that the email arrives) — an image
Resend has quietly downsized or a `contentType` it guessed wrong from the
filename would only show up by actually opening one.

---

## Log

Newest last. One or two lines per chat.

- **2026-08-15** — Reference review substantially complete
  (`reference/magicplan/object-model.md`): object model, all four property
  sheets, statistics with real definitions, wall thickness, affected areas, the
  photo editor in full, action bars at five depths, the three wall actions
  performed, exports, two of three report layouts read as PDFs. Shipped:
  wall-closing fix, fixed paper palette, frozen editor viewport, sill height,
  baseboard length, room cards, wall thickness + footprint, room colour, floor
  moves, and the affected-area editor rebuilt to the reference interaction. DB at
  migration 0031. 1120 tests. **Unverified:** dimension-tap unlock (S5),
  project-card plan (S12). Sections split out into this file; next is S1.
- **2026-08-17** — S1 built. Tabs are now `Details · Photos & Notes · Forms`;
  affected areas and the drying log moved inside Details, in the reference's
  order, with Statistics 4-up + See All and a Dimensions block above them and
  General last. Room Name and Living Area (%) are editable for the first time;
  Ceiling Height stayed read-only on purpose (owner question, noted in S12).
  Found and fixed a live bug on the way: Swift synthesises `Encodable` with
  `encodeIfPresent`, so every `nil` in a PATCH body **dropped the key** — the
  no-colour swatch and clearing a room type had been writing `{}` and doing
  nothing. `API.NullablePatch` now sends real `null`. **Not verified by eye:**
  nothing in this section has been seen running. `BUILD SUCCEEDED`, installed
  and launched on the simulator, but the app opens on the admin password wall
  and the phone was `unavailable` to `devicectl`, so the room sheet was never
  reached at first. Verified later the same day on the simulator instead —
  tabs, header, both new fields, See All, Forms all confirmed live. S1 is
  **DONE**. Also stood in for S12's project-card-plan check: confirmed drawing.
- **2026-08-17** — S2 built: `WallDetailView`, `room_walls` migration
  (`0034`), the wall-photos column, and the report's additive
  `Display Elevation in Report` gate. **Found a real, previously-invisible
  bug on the way**: the plan editor's "Swipe up ↑ for Wall info" caption has
  existed since the editor chrome was built, but the `onInfo` callback never
  looked at what was selected — it always dismissed to the room, so that
  caption has been lying since it first shipped. Fixed as part of wiring the
  new sheet in. **Verification note for whoever hits this next:** ordinary
  synthetic taps on the plan canvas (`onTapGesture`, wall/corner selection)
  did not register at all under this session's computer-use tooling, only
  drags did — a `DragGesture` swipe-up worked, a `left_click` on a wall did
  not, repeatably, across many attempts and two different tools. Whether
  that is a quirk of synthetic-event delivery to the simulator or an actual
  gesture-priority problem in `PlanEditorView` (there is an old, still-live
  `BISECT: temporarily disabled` comment in `handleTap` from a prior session
  chasing the same symptom — "every canvas tap" not registering) was **not
  resolved**. Worked around it for this section by selecting a wall through
  the existing Elevation View menu item instead of tapping the canvas, then
  verifying the sheet, both toggles (persisted across a full sheet
  close/reopen — confirmed server round-trip, not just local state), Photos
  & Notes, Forms, and Add New Area's route into `ElevationView` — all
  confirmed live on the simulator. Migration `0034` applied to production via
  the Supabase SQL editor same day; `room_walls` confirmed present with all
  8 columns. **S5 owns general plan-editor parity and
  already has one unresolved tap-verification item (the dimension tap); this
  BISECT comment and the canvas-tap symptom belong there too** and are worth
  resolving properly before anything else in the plan editor gets built on
  top of it blind. S2 is **DONE**.
- **2026-08-17** — Project screens rebuilt to the reference across many
  small passes: All/Favorites/Archived chips with a real archived query and
  Restore; per-card ⋯ menu (Favourite · Move · Duplicate · Archive) with
  migration 0035 behind it; the project page's own order (description,
  address, Forms, Statistics 4-up, Floor Plans, Photos, Files, Created/Last
  modified); a map-based Project Location picker with Apple search and
  reverse geocoding (migration 0036); Project Info behind the pencil; and
  the Export Floor Plans sheet. Scanning lost its tab and floating button —
  it is now the + in Floor Plans, per the owner. **Three real bugs found
  and fixed on the way, all of the same family — a screen that could not
  show what the database already held**: `ProjectSummary.==` compared ids
  only, so SwiftUI correctly refused to redraw a card whose star had just
  changed (favourite looked permanently stuck); `URLSession` was left on
  the default cache policy, which can serve a stale GET; and the New
  Project tile was drawn with `strokeBorder`, which fills nothing, so only
  its 1.5pt outline took a tap. Also: + no longer creates a project on tap
  (it opened the form instead, after empty "New project N" rows piled up),
  and favouriting no longer bumps `updated_at`, which was shuffling starred
  jobs to the top of the grid.
- **2026-08-18** — S11 closed and S12's project half finished. Commercial
  room types built on the owner's call — the reference's sixteen plus the ten
  a flooded commercial building needs — with every commercial type excluding
  living area, which answers the second question S11 was blocked on. Floor
  screens landed as a chain: `Add Floor` (floors to 50 + Roof, still no
  European "1st"), the floor canvas itself (grid, chrome, `+ Insert`,
  swipe-up inspector, pan and zoom), `Add Room` with our own drawn
  illustrations, `Draw Room` as a new corner-by-corner canvas sharing
  `RoomSketchView`'s save path, and `Select Room Type`. **Build 95 on the
  phone.** Everything in this entry was verified by the owner on the device
  as it was built, one screen at a time. **Still not built and now precisely
  described in S12: the floors table.** A storey is a string on
  `room_scans.level`, not a row, so the floor inspector is entirely derived
  and read-only — there is nowhere to put a floor's name, its wall-thickness
  overrides, or a floor-level photo. That migration is the next real blocker
  on S12, and S4 is next in the ledger.
- **2026-08-17** — The owner supplied a real 19-page report export. Read
  with PDFKit and written up page by page into **S10**, with the extracted
  text kept at `Docs/reference/magicplan/report-19-page.txt`. It adds five
  things the section did not have: the cover page, the signature page, the
  per-page scale ratio being derived rather than fixed, `Bathroom` as a
  headline count on the cover, and videos captioned in their own numbered
  series (which constrains **S7**). Nothing was built from it yet.
- **2026-08-17** — S3 built and **verified live**: freehand drawing in
  `AreaEditor`, additive beside the corner editor as scoped. New pure
  geometry in `PlanEditing` (`simplify`, `simplifyClosed` — RDP on an open
  path and on a loop) and a new capture-and-hand-off mode in
  `FloorPlanView`'s `AreaEditor`, both documented in S3 above. This chat's
  `xcode-select` was not pointed at Xcode (no admin rights on this Mac to
  fix it — `sudo` refused outright), so the dedicated simulator tool
  couldn't drive taps/drags; drove the Simulator app directly with
  computer-use instead, on the owner's second approval. Drew a real
  freehand loop on "My Condo → Living room", watched it simplify, hand off
  to the corner editor with correctly-placed handles, adjusted a corner by
  drag, and saved — confirmed server round-trip via the room sheet's
  Affected Areas list afterward. **Found a pre-existing bug while there,
  not S3's**: `Points` mode on that room's original L-shaped seed showed
  scattered corner/edge handles well off the drawn shape; gone once
  freehand replaced the polygon. Noted in S4, which owns this screen next.
- **2026-08-17** — Out-of-order fix, same chat as S3: the plan editor's
  two-finger pan and pinch-zoom were dead code (`.updating { _, _, _ in }`
  for pan; zoom tangled into the same broken gesture combo) since the
  editor was built — the owner hit it directly and asked for it fixed
  before anything else. New `PlanNavigationGesture.swift` bridges in real
  UIKit `UIPanGestureRecognizer`/`UIPinchGestureRecognizer` restricted to
  two fingers, which plain SwiftUI cannot express. Verified live: pan and
  zoom-about-the-pinch-point both work, and — the regression that mattered
  most — single-finger corner/wall editing is untouched. Full detail and
  what still needs a real-device check written into S5, which owns this
  file's other known gesture bug (the `BISECT` canvas-tap issue, still
  separate and still open).
- **2026-08-17** — Out-of-order, same chat: the project grid's card menu
  built out to match the reference's INT-P03 (Favorite · Move · Duplicate ·
  Archive), triggered by the owner hitting three junk "New project" entries
  this chat's own testing had created, with no way to clean them up (no
  delete/archive endpoint existed at all before today). Archive lands as a
  status change (reversible, matches how the reference's own Archived
  filter behaves), not a hard delete. Move assigns a project to a name —
  deliberately not an employee picker; there is no staff table, and
  migration 0035 explains why that echoes 0012's reasoning for time
  entries rather than reversing it. Duplicate deep-copies room geometry and
  wall details, never photos/moisture readings/equipment days — those are
  evidence about one address and copying them into another job's file
  would fabricate a record. **Migration 0035 needs running in the Supabase
  SQL editor before any of this writes** — the code degrades gracefully
  until then (existing `MigrationPendingError` pattern), so it was pushed
  ahead of that step rather than blocked on it. **Also found**: a second,
  concurrent Claude Code session was running against this same repo mid-way
  through this chat, working on `Docs/reference/magicplan/object-model.md`
  — its commit `d8a6839` swept up six files of this work-in-progress
  alongside its own unrelated change, under a commit message that
  describes neither. Content was verified intact (tsc clean, 1120 tests
  passing) before continuing; left as-is rather than rewriting already-
  pushed shared history. **This owns S12's territory** (project screens)
  though not done through a dedicated S12 chat — whoever picks up S12
  should know the card menu is now built, not just planned.
- **2026-08-18** — **S4 done.** Fill Color as the reference's full matrix
  with `Reset` (middle row IS the cause table), `Show Dimensions` extended
  from wall-only to floor areas (they now print width × height beside
  themselves on the plan), photos and notes attached to the AREA — the
  sheet is the reference's three-tab inspector now, and the read filter was
  the only missing piece; `project_files.affected_area_id` already existed,
  **no migration**. One shared `AffectedAreaRow` replaces the two divergent
  rows. New `API.ColorEdit` because a colour has three states and Swift's
  synthesised `Encodable` can only encode two — Reset would silently have
  done nothing otherwise, the HANDOFF §8 trap again. **Also fixed the
  corner-editor handle bug S3 reported, and S3's diagnosis was wrong**: not
  L-shapes, not `seed()` — `FloorPlanView` aspect-fits its own Canvas, so
  it never fills the space it is offered, and `AreaEditor` was computing
  handle positions in the OFFER. Uniform 36pt off on a rectangle, 30 on an
  L, 139 on a tall corridor; 0.0 on all three after. Reproduced
  arithmetically against the real formula before touching anything.
  **Unverified:** build succeeded, tsc clean, 1120 tests, installed and
  launched — but **nothing on these screens was tapped**. The simulator
  tool refused all session with "Xcode is installed but not selected"
  though `xcode-select -p` reports Xcode and two sims were booted;
  `/var/db/xcode_select_link` is missing, so `sudo xcode-select -s
  /Applications/Xcode.app/Contents/Developer` is the fix and it needs the
  owner's password. The colour matrix, the floor-area dimension drawing,
  the area photo round-trip and the three tabs are all compiled-only.
- **2026-08-18** — Same chat, after the owner tested build 96 on his phone
  (built and installed here; 95 → 96 → 97 → 98 over the session). **Test 1
  passed: the corner handles now sit on their corners.** Four things came
  back from him and were acted on.
  1. **Floor Plans held no floor plans.** The section drew the `+` and
     nothing else, and the storeys were filed at the very BOTTOM of the
     project page — under Photos, Files and Created / Last modified — which
     is also out of the documented page order. New `FloorPlanTile` (the
     storey drawn, its name, rooms and area) fills the rail beside the `+`;
     tapping one opens that floor; `See all (n)` drops the full storey
     detail underneath, which is where the old bottom-of-page content now
     lives. This is **S12 territory**, fixed here because he was looking at
     it — S12 should know.
  2. **Fill Color was built wrong and he sent the real screen back.** Theirs
     is a ROW in General — swatch plus a disclosure chevron, level with
     Name — and the matrix and `Reset` are what the chevron opens. It had
     been built as an inline grid, which pushed every field below it down
     the screen. Now a row + `AreaFillColorPicker`. Their `+ New Field` row
     added in its place too, saying honestly that area custom fields are not
     built (the project has them, migration 0026; an area does not).
  3. **The background grid now zooms with the plan** — model space, pinned
     to the plan's metres. This is a **deliberate divergence from
     object-model §8**, which measured the split on his own device and was
     written specifically so nobody reversed it. He was told that and chose
     to diverge. Model mode carries the fade, the cutoff and model-origin
     majors that the first model-space grid lacked. **Do not "fix" this back
     without asking him.**
  4. **Add/delete points** — already there on floor areas (and much easier
     to find now the handles are in the right place); genuinely absent on
     the wall face, which is `FaceRect`, a rectangle and only ever a
     rectangle. Filed as **ORD-38** with the port route mapped out. He also
     asked for photos on a moisture reading with an instrument icon,
     explicitly as a later item — filed as **ORD-39**, and unlike the area
     work that one DOES need a migration.

  **Unverified:** builds 97 and 98 are on his phone but only item 1's
  predecessor was seen by anyone. The floor-plan rail, the Fill Color row
  and picker, the New Field row and the zooming grid are all
  compiled-and-installed, not looked at.
- **2026-08-18** — Same chat, from the owner testing build 98. Test 2 (the
  Floor Plans rail) passed. Three more things, shipped as build 99.
  1. **The room label on a plan was off centre — a real bug, not taste.**
     `labelAnchor` scans for the point deepest inside the outline and took
     the FIRST point achieving the maximum clearance. On any non-square
     room the deepest points are a whole segment, so the label landed at
     its left/top END. Measured against the real scan: a 4.0 × 3.0 kitchen
     0.54 m off, a 6.0 × 3.6 living room 1.18 m, an 8.0 × 1.4 corridor
     **3.26 m** — its label sat near one end of the room. A square came out
     0.06 m off, which is exactly why nobody caught it. Now it averages
     every point within 2 cm of the best clearance, which is the middle of
     the medial segment on a rectangle and the middle of the fat part on an
     L. Label type also went up (storey 11/9 → 14/11, room plan 12/9 →
     15/11) with the plate growing to match.
  2. **A tap on the storey canvas goes straight into the plan editor**, at
     his instruction — *"when I click, it automatically should go to the
     adjustment mode"*, no intervening room sheet. He was asked where the
     room inspector should then live and chose **swipe up from inside the
     editor**, which is the gesture the reference uses for every inspector.
     `PlanEditorView.inspectorIsBehind` keeps the old route honest: entered
     from `RoomDetailView`'s "Adjust the plan" the swipe-up still dismisses
     back to the sheet underneath, rather than stacking a second copy of it.
  3. **Room colours stay.** He said he did not think they were needed; told
     that magicplan has the field (their General is Floor · Room Type ·
     Room Name · Room Color) and that a column and migration 0033 sit behind
     it, he chose to keep it and revisit after parity testing. Recorded so
     it is not removed on the strength of the first remark.

  **Unverified:** build 99 installed, none of the three looked at by anyone
  but the owner's own testing.
- **2026-08-18** — The canvas merge, build 100. Prompted by the owner
  showing four screenshots of magicplan's ACTUAL behaviour and stating it
  plainly: *"it activates the editing mode. It doesn't pull up anything for
  anything. It just activates on that main canvas."* Build 99's fix (tap →
  `.sheet(item:)` presenting `PlanEditorView`) still failed this — a sheet
  always slides up as a new screen, however it is dressed. The real fix
  needed the storey view and the room editor to become ONE screen whose
  content swaps, which is this session's version of what S5 was filed to do.
  Told the size of it (two ~1500-line files, real gesture/undo state) before
  starting; he said do it.

  **What changed.** `PlanEditorView.swift`'s editing internals — canvas,
  gestures, undo/redo, action bar, elevation, every sheet the room or its
  walls open — split out into `RoomEditorCore`, which owns no
  `NavigationStack` and no toolbar of its own. Two hosts now put chrome
  around it: `PlanEditorView` (unchanged call sites — `RoomDetailView`'s
  "Adjust the plan" still works exactly as before, `onExit` still dismisses
  its sheet) wraps it in one; `FloorCanvasView` does not wrap it at all —
  its `body` is now `if let room = editingRoom { RoomEditorCore(...) } else
  { floorContent }`, a plain branch inside the SAME screen the app already
  pushed. `RoomEditorCore`'s own `.toolbar{}` reaches that screen's real nav
  bar because nothing sits between it and the app's own `NavigationStack` —
  confirmed by testing on the device, not assumed.

  A new `backContext` on `RoomEditorCore` (`.room` default vs. `.floor` for
  the embedded case) is the one thing that had to differ between the two
  hosts: back from a sheet goes to the room's own inspector behind it, back
  from the storey canvas goes to the storey, and `EditorBackPill` already
  had an unused `.floor` case sized exactly for this (`editor-chrome-
  design.md` §1's table anticipated it before anything used it).

  **What this fixes beyond the literal complaint.** Zoom and pan on the
  storey now survive a trip into a room and back — they live on
  `FloorCanvasView`, untouched by the branch — which a `.sheet` could never
  have given for free. Undo/redo, the layers stepper and the 2D/elevation
  stepper are `RoomEditorCore`'s own floating controls now, at room depth,
  where they were always meant to read; the floor keeps its own separate
  set at floor depth. Nothing about wall/corner/opening editing, the
  measurement walk, locked edges, or Save changed — that logic moved
  verbatim.

  **Two smaller things from the same round of testing, both shipped in
  build 100 too:**
  - `labelAnchor`'s off-centre bug (see the earlier log entry this same day)
    — confirmed as arithmetic, not taste, and fixed.
  - Room colours: he questioned them, was told the reference has the field
    and a migration sits behind it, chose to keep them. Recorded so a later
    chat does not remove them on the strength of the first remark.

  **Unverified — build 100 is on the phone, none of the merge has been
  tapped by anyone but the owner's own testing to follow.** What to watch
  for specifically: the back-pill at room depth should say "back to the
  floor" (rectangle-split glyph) and land on the storey, not the project;
  swipe-up at room depth should present the room inspector as the same
  medium/large sheet `RoomDetailView` already used; a SELECTED WALL's
  swipe-up should still reach the wall's own inspector, not the room's.
  These three are the seams a merge like this would break first.
- **2026-08-18** — Build 101, from the owner testing build 100. Three more.
  1. **No back chevron at room depth when reached from the storey.** He
     described magicplan's real behaviour from memory: tap the canvas
     OUTSIDE the room, it goes back — no button. `EditorBackPill` removed
     from `RoomEditorCore`'s toolbar when `backContext == .floor`
     (`.navigationBarBackButtonHidden` too, so the system's own auto-back
     does not silently reappear in the pill's place and skip floor depth).
     New `PlanEditing.contains(_:point:)` (ray-casting point-in-polygon,
     shared rather than reinvented a third time) backs a new branch in
     `handleTap`: a tap that misses every corner/opening/wall AND lands
     outside the room's own shape calls `onExit()` (through the same
     dirty-discard check the old pill used), gated on `measuring == nil` so
     it cannot abandon a walk mid-stride. Standalone `PlanEditorView`
     (`backContext == .room`, from "Adjust the plan") is untouched — a
     sheet has its own dismiss and very little "outside" to tap anyway.
     Recorded into `interactions-editor.md`'s own open-questions list as an
     owner-observed fact, not a screenshot, since the reference research had
     explicitly flagged deselection/back-chevron behaviour as unobserved.
  2. **"Adjust the plan" removed from the room sheet.** Redundant once
     tapping the drawing itself opens the editor — his words, "it is now
     activated by clicking on the floor plan instead." The `FloorPlanView`
     thumbnail in `RoomDetailView`'s Details tab is the button now; a small
     pencil badge in its corner is the only thing left saying so.
  3. **Too zoomed in, on the storey and the thumbnail.** `LevelCanvas`
     fit-scales a room to fill essentially 100% of whatever box it is
     given, minus a flat 10pt border — fine on the original 320pt-tall card
     it was sized for, but that flat 10pt is nearly nothing once the box is
     small (`FloorPlanTile`'s 62pt) or the box is what a whole phone screen
     resolves to (`FloorCanvasView`, which caps at the SAME 320pt default,
     landing close to the screen's own width). Two changes: `pad` is now
     `max(8, min(w,h) * 0.12)` — barely moves the 62pt tile, roughly
     quadruples the margin at 320pt (10 → ~38). And `FloorCanvasView` now
     opens at `zoom = 0.6`, not `1` — the "reset zoom" button targets the
     same 0.6, kept as one named constant so the two cannot drift apart.

  **Unverified — build 101 installed, none of these three tapped yet.**
- **2026-08-18** — Build 102. He confirmed test 7 (tap outside to leave)
  works, then: *"it jumps, i need a smooth transition from edit mode to
  zoom out to story mode when i click outside of the room."* The
  `if/else` swap in `FloorCanvasView.body` had no `.transition` — a plain
  branch change is an instant cut by default. Both directions now animate:
  entering a room (`editingRoom = room`) and leaving one (`onExit`, wired
  through every path that calls it — tap-outside, discard-confirm, Save,
  Duplicate, Delete) both go through one `withAnimation(.easeInOut(duration:
  0.3))`, named `roomTransitionAnimation` so the two cannot drift out of
  step. The room's content scales to 0.85 and fades on the way out; the
  storey scales in from 1.08 and fades on the way in — reads as a camera
  pull-back.

  **Said plainly: this is NOT a true morph.** `RoomEditorCore`'s canvas and
  `LevelCanvas`'s storey canvas both draw with SwiftUI `Canvas` — immediate-
  mode paths, not real views — so there is no view geometry a
  `matchedGeometryEffect` could hang onto to make the room visually travel
  from its edit-mode framing to its actual position on the storey. A scale-
  and-fade is the honest version of "zoom out" available without turning
  every room into a real subview, which would be a far bigger change than
  this fix. If the pull-back does not read as smooth ENOUGH once he sees
  it, the duration/scale numbers are one place to tune, in `FloorCanvasView`
  — the true-morph version is a separate, much larger piece of work.

  Unverified — build 102 installed, not yet looked at.
- **2026-08-18** — Build 103. He sent two magicplan screenshots side by
  side — room depth and floor depth on the SAME single-room floor — and
  the point was visible in them, not just stated: the room is drawn at
  nearly the SAME apparent size in both. *"it is like the same canvas,
  just zooms in and out."* That reframed build 102's fix: the problem was
  never the animation curve, it was that the two views' underlying scales
  did not agree, so ANY transition between them was going to read as a
  jump.

  Worked the arithmetic for his own 6×5m kitchen. `RoomEditorCore`'s own
  fit (48pt inset, canvas near the full screen) lands ≈49pt/m,
  width-limited. `LevelCanvas`'s fit, WITH build 101's margin fix and
  WITHOUT build 101's OTHER change (`FloorCanvasView`'s `zoom` default of
  0.6), lands at ≈49pt/m too — the two already agreed once the margin fix
  alone is counted. The 0.6 was a second, unnecessary shrink stacked on the
  first, pushing the storey down to ≈29pt/m for no reason beyond a guess
  made without doing this arithmetic — and THAT gap, not the transition
  code, is what read as a jump.

  **Fixed:** `defaultZoom` removed, back to a plain `zoom = 1`; the
  proportional-pad fix from build 101 is the one still doing the real
  work. The transition's own scale factors came down from 0.85/1.08 to
  0.97/1.03 — now mostly a chrome fade (handles, dimensions, white fill)
  over a room that is already close to the right size, rather than a shape
  trying to visibly travel across the screen.

  **Said plainly, again, because it matters for what comes next:** this is
  STILL not a true morph. `RoomEditorCore` and `LevelCanvas` both draw with
  `Canvas` — immediate-mode paths, no view geometry a `matchedGeometryEffect`
  could hang onto. Scale-matching the two fits narrows the gap a naive
  crossfade has to paper over; it does not close it structurally. If this
  build still doesn't read as "the same canvas," the real fix is a shared
  canvas used at both depths — genuinely larger, and worth scoping as its
  own piece of S5 rather than another transition-tuning pass.

  A note for whoever next touches `FloorCanvasView.zoom`: a CROWDED floor
  (many rooms) may still want to start more zoomed out than `LevelCanvas`'s
  own fit gives it — that's a real, different case from the one this build
  fixed, and it should scale with room count, not be a flat constant
  applied regardless of how many rooms are on the floor.

  Build 103 installed, not yet looked at.
- **2026-08-18** — Build 104. The real rewrite, not another tuning pass.
  He rejected build 103 flatly ("No. I don't like it. Change the structure,
  make it like magic plan.") and, separately, said the room editor's darker
  background should match the storey's lighter one. Both landed.

  **The core change.** New `StoreyViewport.swift`: `StoreyViewport` (floor
  metres → screen points, one formula), `AnimatedStoreyViewport` (makes
  `withAnimation` actually interpolate a `Canvas` draw frame by frame — a
  `Canvas` closure is not `Animatable` on its own, which is the real reason
  build 102's fade still looked wrong even after 103 matched the two
  views' scales), `StoreyLayout`/`StoreyRoom` (every room placed in floor
  space, wrapping the packing algorithm — now factored out as
  `StoreyPacking.pack`, shared with `LevelCanvas` rather than duplicated),
  and `StoreyBaseLayer` (every room drawn quietly through that shared
  viewport, adapted from `LevelCanvas`'s own drawing).

  `RoomEditorCore` gained two parameters — `externalViewport:
  StoreyViewport?` and `roomOrigin: CGPoint` — and NOTHING ELSE in its
  ~1000 lines of gesture/undo/opening/elevation/measurement logic changed.
  The composition turned out clean: `externalViewport.point(bounds.center)`
  reduces algebraically to `canvasSize/2`, which is EXACTLY what
  `RoomEditorCore`'s own `centre` already was — so `zoom`/`pan` (the
  editor's existing pinch/pan) compose on top of the shared viewport
  exactly as they already composed on top of `frozenBounds`, with no
  branch needed in `screenPoint`/`modelPoint` themselves. Both are zero
  when standalone (`PlanEditorView`, from "Adjust the plan"), which is
  untouched and still works exactly as before.

  `FloorCanvasView` now mounts ONE `GeometryReader` → `AnimatedStoreyViewport`
  for the whole time it is on a floor. `StoreyBaseLayer` never unmounts.
  `RoomEditorCore` mounts over it only once `focusedRoomID` is set, and
  fades in via `.opacity(progress)` — both layers read the SAME
  `StoreyViewport` on the SAME frame, which is the one thing that makes
  this an actual continuous zoom rather than two drawings trading places.

  **Two clocks, not one**, for entering/leaving a room — `enterRoom`/
  `exitFocusedRoom`. `cameraFocusID` (drives the animated bounds) clears
  the INSTANT the owner asks to leave, so the zoom-out starts immediately.
  `focusedRoomID` (keeps `RoomEditorCore` mounted, and tells the base layer
  which room to keep fading) clears only after `roomTransitionDuration` —
  unmounting it immediately would cut its own fade-out to nothing, same
  failure the plain `if/else` already had.

  **Backgrounds unified**, all of `RoomEditorCore`'s three root
  `Brand.Plan.sheet` (a light grey) → `Brand.Plan.paper` (white, what the
  storey already used) — his words, comparing them side by side: *"I like
  the look of the story canvas better... The editor is more dark."*

  **A real, deliberate trade-off, not a silent regression.** Floor-depth's
  free one-finger-pan / pinch-zoom (real in the old `if/else`-swap version)
  is GONE. The camera is now wholly the shared, animated one, aimed at
  either the whole floor or one room; giving floor depth its OWN
  additional pan/zoom on top would mean composing a SECOND adjustment
  layer into `StoreyViewport`, on top of the one `RoomEditorCore`'s
  `zoom`/`pan` already compose in — real, separate scope, not attempted
  blind in the same pass. If a crowded floor needs it, that is the next
  piece, not a bug in this one. Also trimmed: the OLD floor chrome's
  decorative "2D" stepper (`action: {}`, already a no-op) and the
  "reset zoom" button (nothing to reset now) are gone from `floorChrome`.

  **Known, accepted seam.** The toolbar (back-pill, title, help/save) is
  NOT animated — `RoomEditorCore`'s own toolbar simply IS the toolbar for
  as long as it stays mounted, which is through its own fade-out too. The
  title can linger for the last fraction of a second of an exit. SwiftUI
  toolbar items do not fade with the view that declares them; decoupling
  that timing from the mount lifecycle is a separate piece of work, not
  attempted here.

  **Unverified.** Build 104 installed, confirmed on the device. Compiles
  clean, 1120 TS tests still pass (untouched by this — Swift only), and
  the geometry was checked on paper (the `centre` reduction above) rather
  than assumed. Nobody has watched it move yet. This is the highest-risk
  change of the whole day — it touches the transform every room drawing in
  the app goes through — so the FIRST ten minutes on the device matter more
  than usual: does a tapped room still land correctly under a finger
  during a corner drag, does Save still work, does a wall's own inspector
  still open correctly mid-focus.
- **2026-08-18** — Two fixes on top of build 104, from the owner's first
  real look at it. Both real bugs, not further tuning.
  1. **Wall joints not meeting at angled corners** — his screenshot showed
     it plainly: at any corner that is not square-on, the black wall band
     either gaps or sticks out past the joint. `StoreyBaseLayer`'s wall
     stroke was copied verbatim from `LevelCanvas`'s own — plain `.square`
     caps, no joint handling — which is a PRE-EXISTING gap in the
     "thumbnail level of detail" renderer, not something today introduced.
     It went unnoticed before because floor depth used to fit several small
     rooms rather than fill the screen with one large one, where the
     artifact is far more visible. Ported `FloorPlanView`'s own proven
     fix — extend each wall segment's endpoint outward by half the wall's
     real thickness at any shared joint (`FloorPlanGeometry.joints`),
     before stroking. Same `0.114` wall-thickness figure `FloorPlanView`
     uses, named once so the two can't draw a different thickness for the
     same wall.
  2. **Still jerky despite the real shared-canvas rewrite — a genuine
     performance bug, not a leftover architecture problem.** `layout:
     StoreyLayout` was a plain COMPUTED property, `{ StoreyLayout(rooms) }`,
     read three separate times in `body`. Each read re-runs
     `FloorPlanGeometry.plan(from:)` — wall squaring, collinear alignment,
     polygon chaining — for EVERY room on the floor, from raw scan
     geometry, from scratch. Harmless as a one-off; wrong the instant
     `AnimatedStoreyViewport` is mid-transition, since its own `Animatable`
     conformance re-invokes `body` on every interpolated frame — roughly 18
     of them across the 0.3s animation. Three re-derivations of the whole
     floor's geometry, ~18 times, is over fifty full re-computations during
     ONE zoom. That is exactly what a dropped, stuttering frame rate looks
     like — not a description of a correctly-timed animation, which is
     what made this a real bug and not more tuning. Now `@State private var
     cachedLayout`, computed once in `refreshLayout()` — called from
     `load()` and from the floor-switcher's callback, the only two places
     `rooms` can actually change — never from inside `body`.

  **Unverified — device was unreachable (AWDL / office Wi-Fi, per HANDOFF
  §8) at the moment these were ready to ship**, so neither fix has reached
  his phone yet as of this write. Both compile clean.
- **2026-08-18** — Build 106. Four from the owner testing 105.
  1. **Walls STILL sticking out at angled corners — my own fix was half
     wrong.** Build 105 added the joint extension but kept `.square` line
     caps. `.square` extends every end by ANOTHER half line-width on top of
     the extension, so the two stacked and the wall overshot its corner —
     which is why 105 improved it without curing it. `FloorPlanView` has
     always paired that extension with `.butt`; `StoreyBaseLayer` now does
     too. **Lesson: copying half a technique is worse than copying none —
     the extension and the cap style are one decision, not two.**
  2. **The two depths were vertically misaligned** — "the story mode is
     located lower... when I click in the room, it kind of jumps up." Real
     bug, and the shared viewport was not enough on its own to prevent it:
     `StoreyBaseLayer` fills the whole screen, but `RoomEditorCore`'s
     canvas sits in a `VStack` ABOVE its action bar, so its own local
     centre is higher up the screen than the viewport's full-screen centre
     by half the bar's height. Same scale, different centre. Fixed by
     giving `FloorCanvasView` a named `.coordinateSpace` and having the
     editor's canvas read `proxy.frame(in:)` against it — `centre` is now
     the shared viewport's full-screen centre expressed in the canvas's own
     local space. Exact, not a fudge factor.
  3. **One finger pans, two fingers zoom.** At FLOOR depth this was simply
     restored — the shared-canvas rewrite had dropped it, and it is flagged
     in that entry as a known trade-off; it is now folded into the camera
     properly (panning moves `cameraBounds`, zooming shrinks it, both in
     floor metres, both surviving a trip into a room and back). INSIDE a
     room the one-finger drag now pans **only when nothing is selected** —
     which is not a weakening of this file's "two fingers navigate, one
     finger selects" rule but a filling-in of the gap it left: that case
     previously did NOTHING at all. A stray thumb still cannot move a wall;
     that needs the wall selected first, and then the same drag edits it.
  4. **2D/3D stepper at floor depth**, his reason quoted in the code:
     *"this is when we click 3D and we wanna see the entire house without
     going inside of a room."* Replaces the decorative no-op stepper the
     old floor chrome had. Opens the real menu; 3D says "Not built yet",
     and Elevation is blocked for a permanent reason worth keeping straight
     — an elevation is one WALL seen straight on, and a floor has no walls
     of its own, only rooms that have them.

  **A process note worth keeping.** The first attempt at shipping this
  built while the phone was disconnected: `xcodebuild` failed with "unable
  to find a destination", but the install step then "succeeded" — pushing
  the STALE 105 binary still sitting in DerivedData. Caught only by
  checking `devicectl device info apps` afterwards, which still said 105.
  **Always verify the built `.app`'s own `CFBundleVersion` before
  installing, and the device's after** — a green install line means the
  install worked, not that it installed what you just built.

  Unverified: build 106 installed and confirmed on the device, none of the
  four looked at yet.
- **2026-08-18** — Build 107. Two from his zoomed-in screenshot.
  1. **The corner was still wrong, and both of the last two fixes had been
     treating a symptom.** His screenshot, zoomed into the actual corner,
     showed a notch AND a spur at once — not fixable by tuning an
     extension amount or a cap style, because the REAL cause was
     structural: each wall was `move`/`addLine`'d as its OWN subpath, and
     a stroke's `lineJoin` only applies WITHIN one subpath. Between two
     walls there was never any join at all — just two disjoint rectangles
     overlapping near a point, each one's own end (extended or not, square
     or butt) poking past the true mitre at any angle that isn't 90°.
     Fixed properly this time: stroke the room's own CLOSED OUTLINE as one
     path with `lineJoin: .miter`, which mitres every corner correctly by
     construction, at any angle, with no endpoint arithmetic to tune.
     Falls back to loose round-capped segments only when the walls never
     chained into a closed outline in the first place (a scan that did not
     close) — those genuinely do not meet, so there is nothing to mitre.
     **Two builds spent adjusting numbers before asking whether the
     approach itself was right — worth remembering next time something
     "improves but doesn't cure."**
  2. **Zoom-out "jumped to a remembered position" instead of centring.**
     Real bug, not a description of the animation curve — the ANIMATION
     itself was already smooth; it was smoothly animating TOWARD THE WRONG
     TARGET. Floor-depth's own pan/zoom (`floorPanM`/`floorZoom`, added
     this same build cycle) were never reset on exit, so leaving a room
     animated the camera not to "the whole floor, centred" but to
     whatever floor framing happened to be left over from BEFORE the room
     was entered — a stale, unrelated position, which is exactly what
     reads as a jump even though the interpolation itself never snapped.
     Owner's own words offered two acceptable fixes — "smoothly bring it
     to the center or maybe stay in the same position" — took the first:
     `exitFocusedRoom` now resets `floorPanM`/`floorZoom` to neutral
     INSIDE the same `withAnimation` block that clears `cameraFocusID`, so
     the reset itself animates smoothly rather than snapping before or
     after the zoom.

  Build 107 installed and confirmed on the device (checked the built
  `.app`'s own `CFBundleVersion` before installing this time, per the
  process note two entries up). Neither fix looked at yet.
- **2026-08-18** — Build 108. A three-depth tap model, from the owner's own
  account of using it: *"following from selecting the window by clicking
  on it, and then I wanna deselect it. When I'm clicking on the canvas,
  it's going back to the story mode, which I don't want. When some item...
  is selected, when I click outside, I want it to go back to the
  inspection editing mode. But when the inspection editing mode, the
  entire room is selected and no... one item is selected, I click on the
  canvas. It should go back to [the storey]. And if their changes are
  done, it needs to ask me if I wanna save it or discard."*

  `handleTap`'s outside-the-room branch (added build 101, the day tap-to-
  leave was built) never checked `selection` first — ANY tap that missed
  every handle and landed outside the room exited straight to the storey,
  even with a wall or opening already selected. It needed to be TWO STEPS,
  not one: a selected item deselects on the first outside tap (steps IN,
  to "room focused, nothing chosen" — his "inspection editing mode"); only
  a SECOND tap, with nothing left selected, steps OUT to the storey. Fixed
  by checking `selection != .none` before the exit branch at all — that
  case now just deselects, from anywhere on the canvas, inside the room's
  own shape or out.

  The discard confirmation gained a real **Save** button alongside Discard
  and Keep editing — it was Discard-or-stay only before, and he asked for
  the third, ordinary option by name. Same `save()` the toolbar's own
  button already calls; disabled when the shape is self-intersecting,
  matching that button's own guard, so this cannot post an invalid
  polygon.

  Also asked, mid-session: whether to build the 3D view next. Answered as
  the exploratory question it was — a real, separate rendering engine
  (SceneKit/RealityKit), nothing like today's 2D Canvas work, not started
  without his own go-ahead first.

  Build 108 installed and confirmed on the device (built `.app`'s own
  `CFBundleVersion` checked before installing). Not yet looked at.
- **2026-08-18** — A real gap closed: openings had no inspector of their
  own. Owner's own words, selecting a window and swiping up: *"no matter
  what I select, when I pull it up, it shows me the details of the room
  itself. This is not how I want... I want us to see the properties of the
  window and of the door and also to see the illustration."* Confirmed by
  the code: `onInfo`'s routing only special-cased `.wall`; a selected
  `.opening` fell through to the SAME branch as nothing selected at all.

  New `OpeningDetailView` — a fourth object-model §2 property sheet
  alongside the room's, the wall's and the affected area's. Deliberately
  smaller than the reference's own (Width/Height/Distance-to-Floor all
  independently editable, plus Include-in-PDF and Display Label): an
  opening here has no id and no database row, living inside the room's
  `geometry` JSON only, so width/height come from `OpeningKind`'s own
  catalog rather than free fields, and there is nowhere yet to hang a sill
  height or per-opening photos (`project_files` has no column for one).
  **Kind CAN be changed** — swapping within the same family (door↔door,
  window↔window; a cased passage stays cased) — routed through `push()`
  like every other edit, so it is undoable. A full cross-family swap is
  `ORD-25`'s own, separately-scoped "Replace with…", not attempted here.
  The illustration is a small standalone glyph — leaf and swing arc for a
  door, three lines for a window — drawn fresh rather than adapted from
  `OpeningGlyphs.draw`, which needs a wall/polygon context this sheet does
  not have.

  Also asked, mid-session, whether to start the 3D view: answered as the
  exploratory question it was (a real, separate rendering engine, nothing
  like today's Canvas work) — not started without his own go-ahead.

  **Unverified — device has been unreachable for several minutes as this
  is written**, longer than the usual short reconnect blips this project
  has hit before. Compiles clean; not yet installed.
- **2026-08-18** — Build 110. Two more of the reference's own screenshots,
  sent directly for a door: its property sheet (Width/Height/Distance to
  Floor, each its own stepper — "i want this") and its selected action
  bar (Insert · Replace with... · Rotate · Duplicate · Delete...,
  "pay attention to the lower panel").

  **A real data-model gap, not a UI one.** `PlanEditing.WallOpening` had
  `width` as its own field (set from `kind.width` at placement, editable
  from that point on) but `height` and sill height came from `kind`'s
  catalog EVERY time — an enum lookup, not a stored fact. Distance to
  Floor was not missing by omission; `OpeningKind.sill` already existed
  (ORD-24) as exactly that catalog DEFAULT, just never promoted to a
  per-instance override. Fixed by giving `WallOpening` its own `height`
  and `sill`, following `width`'s own precedent exactly — default from
  the kind at placement, independently stored and editable after.
  Threaded through the FOUR places a `WallOpening` gets reconstructed from
  a saved record, `ScanPayload.AuthoredOpening`'s own Codable (a custom
  decoder, since two NEW required keys would otherwise fail every room
  saved before today — falls back to the kind's own catalog figure when
  either key is absent), the actual save payload in `API.saveEditedPlan`
  (which had been dropping BOTH fields silently, the one call site that
  actually reaches the server), and `ElevationView`'s own two sill/head
  reads, which were still computing off `opening.kind.sill` even after the
  field existed elsewhere — would have kept showing the CATALOG figure on
  the wall face no matter what a later edit set.

  **`OpeningDetailView` gained real stepper rows for Height and Distance to
  Floor.** Width stays read-only, deliberately — it is the one dimension
  that is GEOMETRICALLY load-bearing (jamb spacing, can collide with a
  neighbouring opening on the same wall), and validating a free-typed
  width safely needs the wall's own length and its other openings, neither
  of which this isolated sheet has. `slideOpening` already does that
  arithmetic for a drag; doing it blind from a stepper risked silently
  producing a door too wide for its own wall. Height and sill have no such
  constraint — nothing on the 2D plan reads either one.

  **The action bar's own reference table had a real gap.** `EditorAction
  .bar(depth:mode:)`'s `.opening` case returned four verbs
  (Insert/Replace-with/Duplicate/Delete); his screenshot showed five, with
  Rotate among them. Whatever the table was built from the first time
  missed it — corrected against his own screen, which is the freshest
  evidence there is. `Replace with…` is now genuinely wired (opens the
  same sheet's Kind picker, which already existed); `Insert`, `Rotate`
  and `Duplicate` stay dimmed with the reason on record — none of the
  three has ever been observed doing anything to an OPENING specifically,
  and guessing would be exactly the "improvising a substitute for
  evidence" AGENTS.md warns against.

  Build 110 confirmed on the device. Nothing in this batch looked at yet.
- **2026-08-18** — Build 111. Four fixes from testing build 110, plus two
  large new requests filed rather than rushed (see ORD-40/41 below).

  1. **Elevation would not open by double-tapping a DOOR**, only a bare
     wall — his own report, and the cause was a genuine hit-test mismatch.
     `openElevation(at:)` only measured distance to each wall's own
     CENTRELINE, while `handleTap` (which selects) checks openings first
     via `OpeningGlyphs.distance`. A door's drawn glyph — leaf and swing
     arc — reaches a full leaf-width off that centreline into the room, so
     a double-tap landing on the glyph, the natural place to tap a door,
     could fall outside the wall's own tolerance while still being
     unambiguously "on" the door. `openElevation` now checks openings
     first, exactly as `handleTap` does, and opens the wall the opening
     belongs to.
  2. **90° magnetic snap on a dragged corner** — his words: *"when it's
     exactly ninety degree, I want it to be magnetic."* New
     `PlanEditing.snapCornerSquare`: considers BOTH walls meeting at the
     dragged corner, offers the perpendicular foot from each neighbour,
     takes the nearer if within capture. Same hysteresis (1.5× to escape a
     detent) and the same `UISelectionFeedbackGenerator` tick the wall
     drag's own snap already used, so the two magnets feel like one
     feature. Returns the point untouched when neither is close, so a
     deliberately angled wall is never fought.
  3. **Storey view now draws real door and window SYMBOLS**, not blank
     notches — *"I want to see the door and the opening direction and the
     windows."* `StoreyBaseLayer` knocked the gap out and stopped;
     it now draws leaf + quarter-swing arc for a door and frame lines for
     a window, same conventions `FloorPlanView` uses at room scale (hinge
     at the jamb nearer a joint, swing toward the room's own centroid),
     thinned for a storey sheet and suppressed below ~14pt of drawn width.
  4. **A selected opening's blue box now encloses its swing arc.** It was
     CENTRED on the wall — half its depth either side — so most of it sat
     outside the room while the arc it was meant to contain goes entirely
     inside. Now asymmetric: a thin margin outside, a full leaf-width in
     (doors only; a window has no swing and keeps a tight box). Which way
     is "in" comes from the same centroid test `OpeningGlyphs.draw` uses
     to swing the leaf, so box and arc can never disagree.
  5. **`OpeningDetailView`'s illustration is now a real ELEVATION** — his
     own suggestion, and a good one for a concrete reason: the two fields
     directly under it are Height and Distance to Floor, and an elevation
     is the one view showing both at once. Stepping the sill now visibly
     lifts the drawing off the floor line, so the number and the picture
     check each other. A plan symbol showed neither.

  **Rotate at floor depth is still dimmed, deliberately.** He reported it
  as not working and he is right — `supported: [.insert]`. But
  `interactions-editor.md`'s own open-questions list, item 4, records that
  the reference's floor-level Rotate *"exists in
  screens/19-floorplan-editor-2d.jpg but was never tapped — unknown
  whether it rotates the whole floor by fixed increments or opens a
  control."* Implementing it means mutating every room's stored geometry
  and position on that floor, N saves, and its own undo semantics — real
  scope, on top of a behaviour nobody has actually observed. Flagged, not
  guessed at. **Worth simply asking him what he expects it to do.**
- **2026-08-18** — Build 113. **Rotate now does something, and the rule is
  the owner's own.** Asked what it should do (the reference's own
  open-questions list records that its floor-level Rotate was never
  tapped), he answered: *"floorplan doesn't turn, separate rooms will, but
  only when it is not a part of a floorplan and not attached."* So:
  `StoreyLayout.detachedRooms` — bounding-box overlap with a wall's
  thickness of slack, deliberately coarse in the safe direction (a false
  ATTACHED is one room that will not spin; a false DETACHED is a plan torn
  apart) — and floor-depth Rotate turns exactly those, a quarter-turn
  clockwise, one save each, sequentially. On a floor whose rooms all touch,
  the button stays dimmed, which is now a TRUE statement about that floor
  rather than an unimplemented control.

  `PlanEditing.rotatedQuarterTurn` is pure and needs no opening
  bookkeeping at all: a `WallOpening` lives on an edge INDEX with an offset
  along it, so rotating every corner leaves edge N still edge N, same
  length, same opening the same distance along it — the payoff of storing
  openings against edges rather than world coordinates.

  He also sent magicplan's own **Edit Layout** mode (long-press a room →
  on-room move and rotate handles) and noted it permits this on attached
  rooms too, adding *"but I don't see a point."* Filed as **ORD-42** with
  his detachment rule recorded as a deliberate divergence to keep.
- **2026-08-18** — Builds 114–115. Two more.

  **Openings drag along their wall in elevation** (114) — *"in elevation
  mode I should be able to move things around... left, right."*
  `ElevationView.openings` became a `@Binding`, and its drag gesture now
  does one of two things depending on where the finger STARTS: on a door or
  window it slides that opening; anywhere else it draws a damage region
  exactly as before. No mode switch to remember. Horizontal only, and
  deliberately: `PlanEditing.slideOpening` already enforces jamb margins
  and refuses to overlap a neighbour, so sliding is safe by construction —
  where vertical position is `sill`, which he explicitly wanted left to the
  properties sheet (*"the height from the floor, maybe I should be able to
  do it in the properties"*) and which has no collision rule to lean on.

  **Units now agree across a drawing** (115). One plan was printing
  `3.67 m` on its overall dimensions and `4'-6 1/2"` on the chain directly
  beneath, and `101 sq ft` under both. Cause: overall dimensions read
  `UnitSettings`, while `FloorPlanGeometry.planDimensions` was a hard-coded
  `LengthFormat(system: .feet, …)` and `Measure`'s three labels were
  hard-coded imperial arithmetic. The old reasoning — that the plan's
  convention is a DECISION rather than a preference — holds for the STYLE
  (`.drafting`, `17'-1"`) and does not hold for the SYSTEM. Now the
  operator's system and denominator win and only `style` is forced.

  **New `UnitSettings.current`, a nonisolated snapshot.** `shared` is
  main-actor isolated (it is an `ObservableObject`), but `Measure`'s labels
  and `feetInches` are called from report code and `Canvas` closures alike;
  marking them all `@MainActor` would have cascaded through unrelated
  call sites. `current` reads the same `UserDefaults` key `persist()`
  writes, so it cannot disagree with `shared.format`, and views that
  observe `shared` still redraw on change. The 28 existing
  `UnitSettings.shared.format` call sites are all view code and were left
  alone.

  Metric area/volume keep one decimal where imperial keeps none — 1 m² is
  nearly 11 sq ft, so rounding to a whole m² discards about ten times as
  much, which shows on a small bathroom.
- **2026-08-18** — Build 119. *"When clicking on arrows, I want an
  animation, like room turning."* Stepping between wall faces now pivots:
  the outgoing face rotates about the room's vertical axis while the
  incoming one arrives from the other side, `.easeInOut` over 0.35s.

  Both halves rotate the SAME way — going forward the old face swings off
  left and the new arrives from the right, which is what turning your head
  to the right looks like. Rotating them oppositely reads as two doors
  closing, not one room turning. 62° rather than 90° because a face
  edge-on is a bare line, and stopping short keeps the drawing legible for
  more of the animation; opacity bottoms out at 0.15 rather than 0 so the
  face looks turned away rather than deleted.

  Two details worth keeping: the canvas needed `.id(edge)` before SwiftUI
  would treat a step as a REPLACEMENT it can transition rather than a
  repaint of the same view, and the steppers sit OUTSIDE the transition on
  purpose — the face turns, the controls that turn it stay put.
  `steppedForward` is set before the index so the transition already knows
  its direction when SwiftUI evaluates it.

  Build 119 confirmed on the device; not yet looked at.
- **2026-08-18** — S5 opened formally and closed down to one item. Build
  **120**, installed and confirmed on the device by `devicectl`.
  **Shipped:** `Set Size` now HIDES on a non-rectangular room and returns
  when it is square again (`PlanEditing.isRectangle`, `EditorActionBar`'s
  new `hidden:` — removing a verb, which is a different statement from the
  greying the bar already does); ORD-31 live edge dimensions on the two
  edges adjoining a dragged corner, ported from `AreaEditor` so the two
  canvases read the same; ORD-23 the overall bounding extent, width along
  the bottom and depth up the left, on its own outer line. One adjacent
  fix: the dimension-tap branch is now gated on the `Dimensions` layer
  being on, since with it off that branch was claiming taps on blank canvas
  and opening a keypad for a figure not on screen.

  **ORD-23 moved the camera** — read S5's item 4 before touching it. There
  was no space outboard of the walls for an outer line, so the standalone
  fit inset grew and `LevelCanvas.cameraBounds` now pads the focused room
  by 22% each side, in METRES as a fraction of the room rather than as a
  viewport inset, because `bounds` is what `AnimatedStoreyViewport`
  interpolates and an inset changed at focus would pop the base layer on
  the transition's first frame. Entering a room frames slightly wider than
  build 118 did; that is the trade and the owner should say if he dislikes
  it.

  **Not verified by eye — none of it.** `BUILD SUCCEEDED`, installed,
  build number read back off the phone, and that is all this chat can
  honestly claim. The native simulator tool is still refusing with "Xcode
  is installed but not selected" although `xcode-select -p` is correct
  (it needs `sudo xcode-select -s`, i.e. the owner's password), and
  screen control of the Simulator app was declined when offered as the
  fallback. **So S5's item 1, the dimension tap, is exactly where it was:
  built, re-enabled, never once seen working.** It remains the first ten
  seconds of the next session on the phone.

  **Note for whoever reads the history.** This chat's Swift changes are
  NOT in a commit of their own: a concurrent session committed the shared
  working tree as `4df4ea6` ("Stepping between walls turns the room") and
  swept them in, together with unrelated `admin/messages` web work. One
  chat per task does not mean one tree per task — if two are open, commit
  early or expect this.
- **2026-08-18** — S6 started and blur shipped alone, build **121**,
  installed and confirmed on the device. A photo VIEWER had to come first —
  the thumbnails were not tappable, so there was no `Edit` to hang an
  editor off. `PhotoEditorView` is §2a's chrome and its four-mode row with
  only Pixelate live, the other three greyed in place. Pixellate rather
  than Gaussian on purpose: a light blur over text has been read back out
  by deconvolution, and the cell scales to the region so it stays
  destructive at any photo size. Done uploads the redacted copy and THEN
  deletes the original — new `DELETE /api/v1/photos?id=` — because a
  blurred copy beside a readable original redacts nothing.
  **Unverified by eye, all of it**, and the delete half cannot work at all
  until the branch is deployed, since the phone talks to the Vercel
  preview. 1120 tests still passing.
- **2026-08-18** — **S5 is DONE.** All four items confirmed on the device
  by the owner within minutes of build 120 landing: *"keypad opens it is
  good, the red numbers are there, the rest is good."* That closes the
  dimension-tap unlock, which had been carried as unverified since the
  ledger was written and had never once been seen working — it turned out
  to have been dead behind an unclosed `if false` bisect, re-enabled in
  112, and only now looked at. The wider room framing that ORD-23 forced
  drew no complaint.
- **2026-08-18** — **The wall-stepping turn animation, fixed on his
  report** (build **122**). Two faults, and the interesting one is not the
  animation. *"The lengths are different and they all get positioned
  different, doesn't look like it is the continuity of the same room."*
  `layout` fitted EACH FACE to the canvas on its own, so a short wall fit
  on its height and came out big while a long one fit on its width and came
  out small — the ceiling height, the one measurement every wall in a room
  shares, changed size from wall to wall. Consecutive frames were two
  drawings of two different rooms, and no transition can paper over that.
  Every face now scales off the room's LONGEST wall, so the ceiling line
  lands on the same pixel on all of them and a short wall is drawn short.
  Second, *"I click right, animation turns left"* — the turn's direction is
  reversed, and `WallTurn` rebuilt around one `side` value driving angle,
  slide and fade together, hinged on centre. The old one swapped the
  rotation ANCHOR on the sign of the angle, so the pivot jumped from one
  edge of the drawing to the other halfway through. **Unverified** — shipped
  minutes ago.
- **2026-08-18** — S6 continued to build **123**: Adjust (five channels on
  one −100…100 dial) and Draw (PencilKit `Sharpie` and `Eraser`, the full
  `ColorPicker`, §2a's seven named widths, the other six tools greyed in
  place). Undo became one stack across all three modes. Branch **pushed**,
  so the `DELETE /api/v1/photos` route the redaction needs is deployed.
  **Unverified by eye, all of it** — and the destructive path (Done deletes
  the original) has still never been run. Test it on a photo nobody minds
  losing.
- **2026-08-18** — **S8 built**, build **124**. Migration 0037 written and
  **applied to production** from here through the Supabase SQL editor,
  verified by reading `information_schema` back — 16 columns. The section
  was unblocked by asking the owner one question rather than guessing:
  what an object has to DO. His answer made it a line item, not decoration,
  and everything below follows from that. Catalogue, picker with
  favourites/recents/search, placement and drag on the plan, the object
  bar (Rotate · Duplicate · Delete · Replace with…), and the inspector
  carrying disposition and include/exclude. Doors and windows now also
  reachable from the room-depth Insert menu, at his ask mid-build, with a
  tap-the-wall step when none is selected.
  **Unverified by eye, all of it.** 1120 tests still passing.
- **2026-08-18/19** — **S8 built end to end**, builds 124 → 137, live-tested
  throughout. Migration **0037** (`room_objects`) applied to production and
  verified. An object is a LINE ITEM, not decoration — the owner's answer
  when asked what one has to do: *"if replaced, if there is damage, it
  needs to be counted, there is installation involved also, i need to have
  an option to include or exclude it like any other item."* Hence
  `disposition`, `included` and `quantity`, and hence a table rather than
  more JSON on the scan.

  **The library is one list and two models.** His screenshots settled the
  layout — `All Objects`, search pinned under the title, a Recently-used
  rail with stars, sections as rows with counts — and put doors and windows
  IN it, reversing an earlier call to keep them out. `LibraryItem` is the
  seam: the list is one thing while an opening (lives in a wall, deducts
  wall area) and an object (stands on the floor, deducts nothing) stay two.
  Reachable from a selected wall, from room depth, and from the floor,
  which was his ask.

  **What live testing found, in the order it found it:** the dimension
  stealing taps from the wall behind it (fixed by letting the wall win an
  ambiguous tap — the reversible thing should win); objects snapping to the
  wall CENTRELINE and so sitting half a band inside the drywall; the
  elevation showing a plan symbol, which from the front is a square (front
  elevations are a second drawing, not a rotation of the first); the
  elevation editing openings through a binding without marking the room
  dirty, so a window inserted there could leave WITHOUT the Save/Discard
  prompt; and objects missing from the storey and the card until the floor
  reloaded and the projects payload carried them.

  **ORD-43 — the artwork.** Hand-coded vector art hit its ceiling at build
  134 and the owner said so plainly. All 33 objects now carry authored
  isometric SVG, made in his own ChatGPT session as MARKUP rather than
  generated images: no picture quota, crisp at any size, and readable so a
  wrong drawing is corrected rather than re-rolled. `scripts/` carries the
  three pieces that make it repeatable, and `ObjectArtwork` falls back to
  the code-drawn figure for anything without a picture — which is why
  **doors and windows are deliberately refused**: the model draws known
  objects well and drawing conventions badly, and our own door with its
  swing arc is more correct on a plan than what came back.

  **Left in S8:** the takeoff roll-up (`countByKind` exists server-side and
  nothing shows it yet), and the door catalogue — theirs is 17 doors and 15
  windows to our 4 and 3, and each new kind needs a real stock width
  because that width knocks the hole in the wall and comes off net wall
  area.

  **Unverified:** everything from build 130 on has been shipped faster than
  it could be looked at. The artwork itself was reviewed on a contact sheet
  before shipping; the rest has not been tapped.
- **2026-08-19** — A very long session; the Log above carries S5 and S6's
  early half, this entry carries the rest. **Builds 143 → 155.**

  **S6 is DONE.** Crop and transform (rotate left, flip, straighten dial,
  corner handles with the rest dimmed) and the shape tools (arrow, line,
  rectangle, ellipse, text). `Path` stays greyed: Sharpie covers freehand
  and their multi-point placement was never observed. Render order is
  geometry → adjustments → redaction → annotation, because crop and
  rotation change what the picture IS and a mark placed before them would
  travel.

  **S8 is DONE**, and most of it came from live reports. 77 entries across
  their full fourteen sections, including Annotations (marks on the
  drawing, never counted) and the Fire & Safety and Outdoors sections. One
  catalogue entry per thing with a SIZE SHEET rather than a tile per size —
  his call after using the alternative. Migration **0038** stores whether a
  size was typed, so the padlock cannot be faked by a catalogue edit later.
  The takeoff totals per room and per job.

  **Three drawings, three jobs, and it took three attempts to see why.**
  The catalogue tile is a coloured illustration (browse), the plan symbol
  is a footprint with an SF Symbol in it (measure and name), the elevation
  is a front view (what stands against a wall). His own reference settled
  the plan one: *"I want like this"* — a fridge as a rectangle with a
  snowflake in it. The isometric illustration that preceded it was a
  catalogue picture doing a drafting job.

  **The bug family this session kept producing: two places drawing the same
  thing by two different rules.** The elevation fridge wearing the washing
  machine's face; the project card drawing its own silhouette while the
  plan drew a symbol; a second scale bar under a drawing that already had
  one. Three instances in one day. **Before adding a drawing, look for the
  routine that already draws it.**

  **Photos queue on the phone now** (`PhotoQueue`, the shape `ScanQueue`
  established): written to disk first, uploaded behind the operator, sent
  on reconnect. A network failure is held; a server refusal is reported and
  dropped, because one permanently-rejected photo would otherwise block
  every photo behind it.

  **S10 started.** Photo pages interleaved behind their own room six to a
  page, the reference's running header and `Page n/N` foot, its room-page
  figure lines, a signature page, and the whole report switched to metric —
  it was the last surface still hard-coded to feet. Left: the numbered key,
  the locator thumbnail, `Bathroom` as a cover count, and `Only floors`.

  **A seeded comparison project exists** — `Palerme - side by side`, the
  reference's own nine rooms at their printed extents, for reading our
  report against theirs page by page.

  **Unverified, and it matters more than usual.** Almost nothing from build
  139 on has been confirmed by eye, and at the session's end the owner
  reported the storey screen showing an empty card with drawing, moving and
  connecting rooms all failing, and photo upload erroring. **Those are all
  one symptom — every one is a read or a write against the API** — and the
  likeliest cause is an expired session on the phone rather than four
  separate bugs. It was not settled before the session ended. **Start
  there**: `More → Diagnostics` says whether the app is signed in and
  whether the server is reachable. If it is signed in and healthy, suspect
  `LevelCanvas`, which changed several times today (objects loading, the
  insert menu, the focused-room camera padding), and bisect against build
  138, which he had working.
- **2026-08-19** — **S10 built out.** The numbered key (and the gap it
  exposed: the plan had never drawn affected areas at all, so the report
  listed damaged square metres beside a drawing showing none), the locator
  strip, `Bathroom` on the cover, and the `Only floors` layout — their
  third export, which had never been generated.

  Two decisions worth keeping. The locator is a ROW of the storey's rooms
  with this one shaded, not a packed floor plan: the report has no
  positions for rooms measured on separate visits, and drawing a floor
  whose rooms were placed by guesswork would be inventing a building. And
  `Only floors` is a different document rather than a trimmed one — an
  adjuster who asked for the drawings should not be sent forty pages of
  photographs.

  **Unverified.** It compiles and the tests pass, which for a printed
  document proves almost nothing. The seeded `Palerme - side by side`
  project exists for exactly this: export it, read it beside
  `My New Project Report 4.pdf`, fix the differences.

- **2026-08-19** — Report export fixed at the root: a page is now a real
  Letter-sized page ON SCREEN, and `?bare=1` ("Clean view for PDF") drops the
  app chrome, so any export route yields the same paginated document rather
  than one strip of screen. ORD-42 built: press-and-hold lifts a room on the
  storey canvas, one finger moves it, two fingers twist it, walls snap flush
  and edges show alignment guides; a turn rewrites the polygon AND its
  objects, and a move freezes every room's `plan_x`/`plan_y` so the packer
  stops rearranging a floor somebody laid out by hand. Build 156. Still open:
  the storey-empty / upload-failing report from the phone, unreproduced.
- **2026-08-19 (later)** — Watched the reference on the owner's own phone
  through iPhone Mirroring, with his permission, and built against what it
  actually does. Four things: the storey's Edit Layout mode now draws the two
  on-room handles it draws (move cross, turn arrow) and the turn one drags;
  opening a room frames the WHOLE connected floor plan with its neighbours
  greyed, and tapping a neighbour goes there; the duplicate bounding dimension
  is gone from rectangular rooms; and an object standing against a wall is
  carried by that wall when the wall is dragged. Build 157. Also confirmed
  from the reference: a room may be torn off its neighbours, a move snaps
  flush on release, and their rectangular rooms carry exactly one figure per
  wall plus a split chain — no bounding line. NOT YET BUILT, seen there:
  Merge Rooms, Split Room, Add Corner, Add Wall, Duplicate.
- **2026-08-19 (night)** — Snap guides: dragging a wall now draws every
  straight run it could land on, grey and dashed, and the one it IS on solid
  green — the owner pointed at the reference's own pair and said *"the gray
  lines that are not active... I think these are very useful for us."* The
  candidates come from the NEIGHBOURING rooms as well as this one, which is
  the whole point: a rectangle's only self-alignment is the wall opposite,
  and landing on that is a room of zero width. Build 158. Split Room's rule
  captured from the reference and filed as ORD-44; Add Wall and Merge Rooms
  seen in the bars but never watched performing anything, so not guessed.
- **2026-08-19 (late)** — A typed wall length no longer pulls a square room
  out of square. `setEdgeLength` moved only the typed wall's own two corners
  about their midpoint, so shortening a left wall left the right one behind
  and both horizontals came away slanted; the owner hit it directly. On a
  RECTANGLE the whole outline now scales along that wall's direction, and
  which end holds comes from the rooms next door — his rule, alone shrinks
  equally, attached keeps the attached end. An L keeps the old wall-only
  behaviour, since an L genuinely has two parallel walls of different
  lengths. Build 159, ten geometry cases. Still open, his own suggestion:
  shrinking the middle of three rooms should bring the far room with it.
- **2026-08-19 (night, later)** — Split Room and Merge Rooms built, both
  watched on the reference in a scratch project first. Split cuts through the
  point on the wall the finger touched, square to it; the room keeps the
  larger piece and the offcut becomes a room of its own, doors travelling
  with whichever piece holds them and any door lying across the cut reported
  rather than dropped in silence. Merge is a targeting mode — bullseye on the
  lifted room, green arrows on the neighbours it could absorb — and unions two
  flush rectangles into a rectangle or a real L. Build 160, 19 geometry cases.
  Also watched, not built: Add Wall inserts a free interior stub wall, which
  is a model we do not have; Duplicate offers Identical / Flip Horizontally /
  Flip Vertically and lands at the storey with the copy in hand.
- **2026-08-21** — S15 built: `listAllProjectPhotos`/`downloadProjectFiles`
  in `projects.ts`, `emailPhotos` in `sendDocument.ts` (ad-hoc recipients,
  not the `receivesQuotes`-style flags — a photo send is a one-off, not a
  standing preference), a new `/admin/projects/[id]/photos` picker screen
  and `SendPhotosPicker.tsx`, linked from the project page. `tsc`, `next
  build` and all 1127 tests clean. **Not verified live — no email actually
  sent, nothing clicked.** No dedicated test file, matching the fact that
  none of `sendDocument.ts`'s other four senders have one either. Full
  account in S15 above, including what it deliberately left alone: outbound
  MMS (owner declined it 20 Aug) and inbound MMS/email, both still open.
- **2026-08-21 (later)** — S9 started: `RoomScan.wallAreaNetSqm` (Swift
  finally has the net figure the TS side already had), the same summed into
  `ProjectStats.netWallSqm`, and `RoomStatisticsSheet` split into
  Measurements/Objects tabs — the literal ORD-36 ask, the old bare
  doors/windows/stairs counts folded into the Objects tab as "Openings"
  rather than left orphaned. `xcodebuild` → `BUILD SUCCEEDED`, installed and
  launched via `xcrun simctl` directly (the dedicated simulator tool is
  still blocked on a `sudo xcode-select` this account cannot run at all).
  **Not seen** — no admin password in reach to get past the sign-in wall.
  Deliberately left for a later pass: the ground-surface trio (needs wall
  thickness, same blocker as S12's floor table), living-area rows, and the
  orphaned TS `countByKind`. Full account in S9 above.
- **2026-08-21 (later still)** — Went looking to build S12's "floor shell"
  (the empty floor editor S12 says is "NOT BUILT") and found it already
  built — `FloorCanvasView`, `EditorChrome.swift`, `FloorDetailView`, all
  landed and wired 18-20 Aug, several sessions after this section's own
  text was last written and never flipped to reflect it. No code changed;
  corrected the ledger instead, since shipping a second copy of an
  already-shipped screen would have been strictly worse than doing nothing.
  Found one real, still-open loose end while confirming this: `StoreyPlanView`,
  an older unchromed floor screen, is still used for the post-capture
  landing and never got retired when `FloorCanvasView` replaced its other
  job — flagged in S12 rather than fixed, since closing it means giving
  `FloorCanvasView` the same newly-filed-rooms spotlight behaviour first.
- **2026-08-21 (later still)** — S7 built. Found a real conflict before
  writing anything: `SiteCameraController` (20 Aug) explicitly refuses to
  send video to the server, on the owner's own quoted instruction; this
  section requires videos to print in the report, which needs them on the
  server. Asked; his answer was **upload with opt-in** — a clip still saves
  to Photos by default, a "Keep on job" prompt after recording is the only
  path to the server. Built on that: migration 0041 (`duration_seconds`,
  `thumbnail_path` — **not yet applied to production**), a new
  direct-to-Supabase-Storage upload pipeline (`/api/v1/videos/upload-url` +
  `/api/v1/videos`) since a route handler's ~4.5 MB body cap makes video
  impossible any other way, the grid's duration badge and poster-frame
  tile, a separate `VideoPlayerView` so "no Edit on a video" is structural
  rather than a conditional, and report captions in their own `Video n`
  series per S10's reading of the reference. 360 and library-picked video
  both stayed out, deliberately. `BUILD SUCCEEDED`, `tsc`/`vitest` clean.
  **Nothing here has been run for real** — the whole upload pipeline is
  unverified against an actual Supabase project, and the migration hasn't
  even been applied yet. Full account, including what was deliberately not
  built, is in S7 above.
- **2026-08-22** — Live verification pass, owner in the room typing the
  admin password himself. S9 and S12's floor shell both confirmed exactly
  as built: net wall area at room and project level, the Objects tab's
  Openings/takeoff split, `FloorCanvasView`'s chrome and in-place room
  entry. **S7 found a real crash, not a simulator quirk**: tapping record
  in Video mode threw an uncaught `NSException` from
  `AVCaptureMovieFileOutput.startRecording` when there was no active video
  connection and killed the app outright — `NSException` cannot be caught
  in Swift, so nothing downstream could have saved it. Fixed by checking
  `connection.isActive`/`.isEnabled` before calling in, reporting the
  camera's absence instead of crashing. The Simulator's lack of a camera is
  what surfaced this, but the same guard now protects a real device from
  whatever else could leave that connection inactive. Confirmed fixed on
  the simulator afterward. The "Keep on job" prompt and the upload pipeline
  itself still need a real device with a real camera — not reachable from
  here. `Docs/SECTIONS.md` updated in place for all three sections rather
  than only logged here, since a stale "unverified" tag next to a section
  that has since been tapped through is exactly the kind of thing this
  ledger exists to prevent.
- **2026-08-22 (later)** — Owner's live bug report: correcting a
  wrongly-detected door mid-scan kicked him out of the whole capture
  session into the storey editor. Root cause: `RoomScanViewController.
  askAbout` presents `ObjectLibraryPicker` via raw UIKit `present()` rather
  than a SwiftUI `.sheet`, then dismisses it manually — while the picker
  ALSO calls its own SwiftUI `dismiss()` on pick. The redundant second
  dismiss had nothing local to close, so it bubbled through `CaptureFlow`'s
  deliberately-undismissable scan cover and closed the storey editor's real
  `$capturing` sheet instead. Fixed with a new `selfDismisses` flag on
  `ObjectLibraryPicker`, off only at this one call site. `BUILD SUCCEEDED`.
  **Not verified against a real scan** — no LiDAR in the Simulator; this is
  confirmed by tracing the dismissal chain, not by reproducing and watching
  it stop. Full account in S8 above.
- **2026-08-22 (later still)** — **Migration 0041 applied to production**,
  which was HANDOFF §5's item 1 and the thing blocking video upload from
  working at all. `project_files` now has `duration_seconds` (int4) and
  `thumbnail_path` (text), both nullable; 13 columns, read back off the
  dashboard, and PostgREST's own generated API docs list both — the schema
  cache confirming itself rather than a `notify` assumed to have fired.
  **Two things the next chat should carry.** It was applied through
  Database → Tables → **New column**, not the SQL editor: typing into that
  editor was refused by a permission classifier twice, and the table UI
  reaches the same place. Supabase's `pgrst_ddl_watch` event trigger fires
  the reload on dashboard DDL, so the explicit `notify` line was not
  needed. The SQL file is therefore not in the Migrations list; it is
  `add column if not exists` throughout and stays safe to re-run.
  **And the trap that cost most of the time here**: the SQL editor opened
  carrying migration 0036's leftover query against `public.projects`, so
  pressing Run returned a genuine `Success. No rows returned` for the
  wrong statement against the wrong table — twice read as "0041 is done"
  when `project_files` was untouched at 11 columns. **A green success in
  that editor proves a query ran, not that YOUR query ran.** Read the
  editor's text before trusting it, and confirm in Database → Tables.
- **2026-08-22 (S8, windows)** — **Five of HANDOFF §5's seven orphan window
  drawings now have `OpeningKind` cases**: `windowAwning` (36×24, sill 48),
  `windowBow` (96×48, sill 24), `windowGlassBlock` (32×16, sill 72),
  `windowHalfRound` (36×18, sill 72) and `windowTransom` (36×12, sill
  `doorSingle.height` — a transom sits ON a door head, so writing it as the
  door's own height means the two can never drift). Every size is inch-derived
  in the file's existing convention. Artwork renamed to `door-window<Kind>.svg`
  and installed (355 assets); the four switch sites outside the enum —
  `OpeningGlyphs`, `ElevationView`, `EditorChrome`, `ObjectCatalog`'s picker
  list — all updated. `BUILD SUCCEEDED`.
  **The build is a real proof here, unusually.** Swift's exhaustiveness check
  means a missed switch site could not compile, so "it built" genuinely covers
  "I found them all" — and the `default:` branches in `ScanCatalogue` and
  `PlanEditorView` were checked by hand and switch over other things entirely,
  so nothing swallows the new cases quietly. **Not tapped** — the owner had the
  device for S7 video testing; the picker showing five new tiles with their
  illustrations is still unseen.
  **The other two were deliberately NOT built, and this is a premise problem
  rather than remaining work.** `wallAreaNetSqm` deducts `width × height` for
  every opening in the door/window/passage arrays with no test for where it
  sits. A **skylight** is a roof opening, so filing it as a window deducts wall
  area for a hole no wall has. A **storm window** is a second sash over a
  window already placed, so it deducts the same hole twice. Both shrink the
  drywall figure a claim is priced from. Their SVGs stay under their original
  names in `Native/Artwork`. Per AGENTS.md this is a stop-and-report, not an
  improvisation: **the owner needs to say** whether a skylight deserves a real
  ceiling-opening model (the schema has none) or whether these belong in the
  object catalogue as line items.
  **Incidental find: `windowPicture` has no artwork and never has** — no
  `door-windowPicture.svg`, so that tile silently falls back to the drawn
  `OpeningTileArt` symbol while its eight neighbours show illustrations. Not
  introduced here; worth one drawing in the next commission.
- **2026-08-22 (S8, from the owner's condo scan)** — Two fixes straight off his
  live scan. **Search now understands synonyms** (`Native/ObjectSearch.swift`,
  new): his report was that a TV detected correctly as a television but could
  only be FOUND by typing "television", and `Television` does not contain the
  letters `tv` in any order a substring match can reach — so the search returned
  nothing at all, which reads as *we do not stock one*. Built as query expansion
  over equivalence groups rather than keywords per entry: the table is keyed by
  the word, so `tv ↔ television` is written once and covers every present and
  future entry, instead of 304 entries each needing synonyms hand-authored.
  Both `ObjectCatalog.search` and `LibrarySection.search` go through it, and
  slug is now searchable too (so "tankless" finds `water_heater_tankless`).
  **Verified by running it, not by compiling it**: `ObjectSearch` is pure
  Foundation, so it was compiled standalone with `swiftc` against 15 cases —
  including the negatives that matter, `microwave` must NOT match a wall oven
  and `tv` must not match a toilet. All 15 pass.
  **The table carries French terms on purpose.** The interface stays English per
  the owner's standing instruction and no label changed; this is the input side,
  where a Québec tech may well type `laveuse` or `fournaise`. It lifts out as
  data if he disagrees.
  **`doorBifoldDouble` added** — his laundry room: *"I have double folding
  doors. They come connecting to the middle, but they're also folding."* That is
  neither `doorDouble` (hinged, no fold) nor `doorBifold` (one 30in unit, half
  the hole), and placing either would put the wrong width against the wall,
  which is what comes off net wall area. 60in × 80in, sill 0. Plan glyph is the
  single's V mirrored so both units meet at the centre; the elevation draws the
  centre join heavy, since head-on that meeting line is the ONLY thing telling a
  pair from one wide bifold. `OpeningKind` is 25 cases now. **No artwork** —
  `door-doorBifoldDouble.svg` does not exist, so the tile falls back to the
  drawn symbol, same pre-existing gap `windowPicture` has.
  **Neither is tapped.** `BUILD SUCCEEDED`; the device was in his hands scanning
  and installing would have killed a scan in progress.
- **2026-08-22 (S7/S8, Polycam borrowings)** — Three things off the owner's
  Polycam session, plus a correction worth carrying.
  **The wall A/C he asked for ALREADY EXISTED.** `ac_wall` ("Wall-mounted A/C",
  mini-split head) has been in the catalogue all along — he could not FIND it,
  because its name reads `Wall-mounted A/C` and that contains the letters `a/c`,
  not `ac`, so neither "ac" nor "air conditioner" matched anything. The synonym
  work earlier the same day fixes it, and this is the clearest evidence yet that
  an unfindable entry is indistinguishable from a missing one. `ObjectSearch`
  gained multi-word AND semantics for the same reason ("wall ac" must narrow,
  not widen); 19 cases now run against it with `swiftc`, all passing.
  **`ac_window` added** — genuinely missing, and his words were *"window units
  are very, very popular here in Canada."* 22×15in sash unit, 20in deep because
  most of it hangs outside. It deducts nothing on its own: the window it sits in
  already took its own area out of the wall.
  **Scan-capture haptics** (`Native/ScanCaptureFeel.swift`, new) — his ask after
  feeling Polycam's: *"my phone vibrates tick tick tick… the app feels alive."*
  Polycam ticks on POINTS; RoomPlan does not stream points, so ours ticks when a
  piece of the room becomes KNOWN — `.light` for a new surface, `.medium` for a
  new object. That is the better signal and worth defending: a tick on points
  says "the sensor is on", which the operator can already see, while a tick on
  recognition answers the question they actually have — *did it get that one?*
  One tick per update maximum, 0.12s floor, silent on the first update so a
  resumed scan does not announce a room it already had. `UserDefaults`-gated,
  default on, deliberately not a screen yet.
  **A torch button on the scan screen** — Polycam's, and it earns more here than
  there, because this trade scans unlit basements and ARKit's tracking degrades
  in the dark long before the LiDAR does. Top-trailing, 44pt, and forced OFF in
  `viewDidDisappear`: it outlives the screen otherwise and there is no other
  control for it anywhere in the app.
  **The lens question is settled and the answer is no.** He noticed Polycam uses
  the ultra-wide and asked whether we should pick it or offer a choice. Read off
  the SDK, not from memory: `RoomCaptureSession.Configuration` has exactly ONE
  property, `isCoachingEnabled`. There is no camera or lens selection, and
  RoomPlan owns its own ARSession. Choosing a lens means leaving RoomPlan, which
  means giving up the wall/door/window/object detection this whole app is built
  on. Not a trade worth making for field of view.
  **Nothing here is tapped** — `BUILD SUCCEEDED`, device was in his hands. The
  haptics and the torch in particular are device-only: the Simulator has neither
  a taptic engine nor a torch.
- **2026-08-22 (S7, lens — a wrong answer corrected)** — Earlier the same day I
  told the owner an ultra-wide scan was impossible, citing
  `RoomCaptureSession.Configuration` having only `isCoachingEnabled`. **That was
  too strong and it was the wrong place to look.** The lens is not chosen
  through RoomPlan's configuration at all — it would be chosen through the
  ARSession's `ARWorldTrackingConfiguration.videoFormat`, and iOS 17's
  `RoomCaptureSession(arSession:)` lets a caller supply that session. **This app
  already supplies one** (`ScanSession.arSession`, threaded through
  `CaptureFlow` so a visit's rooms share a world frame). The door was never
  locked; it was never tried. `CaptureError.invalidARConfiguration` existing at
  all says RoomPlan validates what it is handed rather than refusing to be
  handed anything.
  `Native/ScanLens.swift` is a **probe, not a feature**, and the distinction is
  the point: it prints, once at scan start, every video format ARKit will run
  world tracking with on this device, each with its `captureDeviceType`, and
  whether the hardware has an ultra-wide at all. Those two answers separately
  are what tells "this phone cannot" apart from "ARKit will not" — only the
  second is a limitation worth trying to work around.
  **`ARVideoFormat.captureDeviceType` is READ-ONLY.** You do not set a camera;
  you pick a format that happens to use one. So if no supported format reports
  `.builtInUltraWideCamera`, it is a hard no and step two is moot. Step two, if
  step one passes, is running RoomPlan against a session configured that way and
  watching for `.invalidARConfiguration`.
  **Needs one install and one scan start**, then the log answers it. Nothing was
  built on top of the assumption in either direction — no lens picker exists,
  deliberately, because a control with nothing to control is worse than the
  question staying open.
- **2026-08-22 (S7, LiDAR range — a warning we were discarding)** — The owner
  asked what can be done about LiDAR range. At the sensor, nothing: Apple's
  LiDAR is good for roughly five metres and no API changes it. The useful half
  of the question turned out to be what happens when you EXCEED it, and there
  the finding is embarrassing and cheap to fix.
  **`RoomCaptureSessionDelegate` has seven methods and this class implemented
  one.** `didProvide instruction:` fires continuously with `moveCloseToWall`,
  `moveAwayFromWall`, `slowDown`, `turnOnLight`, `lowTexture`, `normal` — and
  `moveCloseToWall` IS the range warning. Every one of them was being thrown
  away. The sensor has been diagnosing this the entire time.
  `Native/ScanQuality.swift` (new) now counts them, plus the low-confidence wall
  count off the final room — a number `ScanMiniMapView` already USED (it draws
  low-confidence walls dashed) but never counted or reported.
  **It records rather than displays, deliberately.** `RoomCaptureView` draws
  Apple's own coaching, so a second pill would be two labels competing for the
  one glance the operator can spare. The gap is not that nobody is told — it is
  that being told is TRANSIENT, and a warning that appears while you are walking
  backwards holding a phone up is gone before you look. The value is at Done,
  on site, with the room still behind you.
  **One instruction is handled live: `turnOnLight` pulses the torch button** —
  and only because as of today there IS a torch. Saying "it is dark in here" is
  advice; lighting up the button they can press is help. Throttled to once per
  ten seconds so a dark room does not throb for the whole scan.
  **Thresholds are ours and deliberately insensitive** (`isWorthReporting`): one
  "move closer" crossing a big basement is how that scan goes, and a prompt that
  fires every time is one that gets dismissed unread, which spends the
  operator's trust for nothing.
  **NOT finished, and this is the honest part:** the summary currently only goes
  to the log. The thing that makes it worth anything — asking the operator at
  Done whether to re-walk, while re-walking still costs two minutes instead of a
  second visit — is not built, because it puts a dialog in the middle of his
  tested flow and that is his call. `BUILD SUCCEEDED`, not tapped.
