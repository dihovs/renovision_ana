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
| **S5** | Plan editor parity | **NEXT** | — | `PlanEditorView.swift`, `EditorChrome.swift` |
| **S6** | Photo editor — blur first | NOT STARTED | — | new `PhotoEditor*.swift` |
| **S7** | Video and 360 capture | NOT STARTED | S6 | `RoomPhotosSection`, API, migration |
| **S8** | Objects — doors, windows, catalogue | NOT STARTED | S5 | `OpeningGlyphs.swift`, `PlanEditing.swift` |
| **S9** | Statistics and takeoff | NOT STARTED | S1 | `Measure`, `measureDefinitions.ts` |
| **S10** | Report parity | NOT STARTED | S9 | `ReportDocument.tsx` |
| **S11** | Commercial room types | **DONE** | — | `livingArea.ts`, `CaptureFlow.swift` |
| **S12** | Project and floor screens | **PROJECT DONE (amended 18 Aug) · FLOOR OPEN** | — | `ProjectsView.swift`, `LevelCanvas.swift` |
| **S13** | Icon set | NOT STARTED | — | new `Glyphs.swift` |

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

---

## S7 — Video and 360 capture

**In scope.** Video capture and playback; the duration badge on the grid tile;
video excluded from the annotation editor (the reference has no Edit on a video);
360 if it proves cheap. Storage, thumbnailing, a migration.

**Note.** Videos **do** print — the annotated report captions them
`<room> Video n`. See §2e.

---

## S8 — Objects: doors, windows, catalogue

**In scope.** Sill height in the placement UI (the model already carries it,
ORD-24); **ORD-25 Replace with…** — swap an opening for another kind keeping its
position and size; the catalogue itself with a recently-used rail and favourites.

**Note.** There is no door type and no window type — one object model, three
dimensions, and a door is an object whose Distance to Floor is zero.

**Note (from S4).** Placement puts controls over a plan canvas. Read S5's
first note before positioning any of them — a view that aspect-fits itself
does not occupy the space it was offered, and that cost this project a
whole screen's worth of drag handles.

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

**THE FLOOR HALF IS NOT BUILT, and here is exactly what it is.** Choosing a
storey in `Add Floor` currently opens the SCANNER on that floor. The
reference opens an empty **floor editor**: nav `‹ ⊞ Ground Floor ? ⇪`,
undo/redo pill top-left, the layers and `2D` steppers top-right, a dotted
drafting grid, a bottom action bar carrying a single `+ Insert`, and the
caption `Swipe up ↑ for Ground Floor info`. That is `PlanEditorView`'s
chrome at FLOOR depth — `editor-chrome-design.md` §4 already lists it
(`Floor level | Insert · Rotate`). What exists today is `StoreyPlanView`,
which DRAWS a storey's rooms but has none of that chrome and cannot insert.
**The drawing canvas already exists — do not build a second one.** The
owner's words: *"it is the same thing when we manually create a room, we
have that function already, just the placement is wrong."* He is right.
`RoomSketchView` is that canvas, reached today through `CaptureFlow` in
`.draw` mode (`stage == .drawing`). So the floor screen's `+ Insert` should
open the flow that already exists, not a new surface. What is genuinely
missing is only the SHELL around it: the floor-depth chrome and an empty
canvas to land on.

Building that shell means either lifting the chrome out of
`PlanEditorView` so both depths share it, or giving `StoreyPlanView` its
own — worth deciding deliberately, because two copies of that chrome is
exactly the kind of drift `PlanTransform` was written to end. **S5 owns the
chrome; this section owns the screen; neither owns a new canvas, because
there does not need to be one.**

**A `floors` table is the next real blocker on this section.** The floor
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

