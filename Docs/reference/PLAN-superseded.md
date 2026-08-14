# PLAN — step-by-step build

Dependency-ordered implementation plan for **RenoVision**, the v1 defined in `MVP.md`.
Phases are the ones in `BUILD.md` §2. No dates: sequence and dependencies only.

**Contract:** `MVP.md` is binding. Nothing in `MVP.md` §5 (non-goals) or §6 (cut list) appears
below. Where the reference shows a feature we are not building, the step says what we strip.

**Platform:** Swift, SwiftUI, SwiftData, iOS 17+, LiDAR required, local-only storage, single
user, no account, no sync.

**Conventions used in every step**

- `INT-Exx` / `INT-Pxx` ids are from `docs/magicplan/interactions-editor.md` and
  `docs/magicplan/interactions-project.md`. Every cited screenshot path was verified to exist.
- All geometry is in **metres, floor-local**. Units are formatting, never storage.
- A step is done when its *Done when* condition is observable by someone else on a device or
  in a test run — not when the code compiles.

**Explicitly out of this plan** (reference behaviour we are not building in v1): 3D view
(INT-E03), elevation view (INT-E33, INT-E34), in-editor floor switcher stepper (INT-E04 —
floors live on project detail), Draw Room modal canvas (INT-E10, INT-E11 — the nine-screen
contract in `MVP.md` §1 has no room for a second drawing mode; `Add Square Room` plus scan
covers v1 creation), photos and notes (INT-P17–P19), custom fields and Claim Details
(INT-P11, INT-P13), living-area rules engine (INT-P12), statistics sheet with definitions
(INT-P14–P16), export hub beyond a single PDF (INT-P20, INT-P21, INT-P27–P30), workspaces,
favourites and archive (INT-P01–P04), account screens (INT-P31, INT-P34, INT-P35).

**Phase map**

| Phase | Steps | Ends when |
|---|---|---|
| 0 — RoomPlan spike | 01–05 | You know what RoomPlan gives you in your own rooms, written down |
| 1 — Capture → persist → render | 06–20 | Scan a room, force-quit, reopen, see the plan |
| 2 — Editing and measurement | 21–33 | Correct a wall you know is wrong and get a right number |
| 3 — Objects | 34–38 | Doors and windows draw correctly and can be placed and moved |
| 4 — Output | 39–43 | A PDF you would attach to a quote |

---

# Phase 0 — RoomPlan spike

Throwaway code. The only deliverable that survives is written findings.

### STEP 01 — Stand up the project shell and the capability gate
**Depends on:** —
**Implements:** — (infrastructure)
**Reference:** `magicplan/screens/88-camera-blocked-alert.jpg`
**Do:**
- New Xcode project, iOS 17 deployment target, SwiftUI lifecycle, one module for the app and
  one framework target `Geometry` that has no UIKit/SwiftUI dependency.
- Add `NSCameraUsageDescription`. Handle denied/restricted camera authorisation with a
  screen that states the reason and links to Settings.
- Gate on `RoomCaptureSession.isSupported`. On an unsupported device show a single blocking
  screen naming the requirement (LiDAR); do not ship a half-working fallback.
- Wire a device build to your own phone. Everything after this step is verified on hardware,
  not in the simulator.
**Done when:**
- The app installs on your LiDAR device and reaches an empty root screen.
- Running on the simulator or a non-LiDAR device shows the requirement screen, not a crash.
**Watch out for:**
- `RoomCaptureView` does not run in the simulator at all. Decide now that the simulator is
  for layout only and keep a device attached for the rest of the project.

### STEP 02 — Scan a real room with `RoomCaptureView` and dump the result
**Depends on:** STEP 01
**Implements:** `docs/magicplan/scan-flow-brief.md` §§3–5, spec §4.6a (no INT ids were logged
for the scan flow)
**Reference:** `magicplan/screens/89-scanner-shell.jpg`,
`magicplan/screens/scan-03-scanning-planes.jpg`
**Do:**
- Host `RoomCaptureView` in a `UIViewRepresentable`, start a session with default
  configuration, implement `captureView(didPresent:error:)`.
- On completion, encode `CapturedRoom` to JSON and write it to the Documents directory;
  expose it through the Files app (`UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`).
- Also export the USDZ so you have a second view of the same capture.
- Scan at least three real spaces: one rectangular room, one room with a bay or alcove, one
  with an open doorway to a corridor.
**Done when:**
- Three `CapturedRoom` JSON dumps and their USDZ files are on your Mac, in `scans/`.
**Watch out for:**
- Apple's coaching overlay owns the whole view. Do not try to restyle it in this step —
  establish what it does before deciding what to wrap.

### STEP 03 — Read the dumps and write the geometry findings
**Depends on:** STEP 02
**Implements:** — (analysis)
**Reference:** `magicplan/screens/scan-16-result-2d.jpg`
**Do:**
- For each dump, extract wall transforms and dimensions and compute: wall bearing angles,
  deviation from the nearest 90° axis, gaps between wall ends, and whether the wall set forms
  a closed loop in plan.
- Compare RoomPlan's wall centre-lines against a tape measure on one room. Record the error.
- Record where doors, windows and openings landed relative to the walls you know exist.
- Write the answers to the four questions in `BUILD.md` §2 Phase 0 into a findings file, with
  the numbers.
**Done when:**
- A findings file states: typical angular deviation from axis, typical wall-end gap, whether a
  snap-to-axis cleanup is needed, and whether openings are usable as-is.
**Watch out for:**
- RoomPlan wall transforms are centre-line based with a thickness attribute; our model stores
  the **interior clear polygon**. Note the offset convention now — it is the single biggest
  source of a systematic few-centimetre error later.

### STEP 04 — Probe multi-room stitching, then decide the v1 scan unit
**Depends on:** STEP 02
**Implements:** `docs/magicplan/scan-flow-brief.md` §1, §5
**Reference:** `magicplan/screens/scan-10-scan-another-room.jpg`
**Do:**
- Run `RoomBuilder` over two consecutive captures of adjoining rooms and dump the resulting
  `CapturedStructure`.
- Check whether the shared wall comes back as one surface or two, and whether the two rooms
  land in a common coordinate frame.
- Time-box this. Record the result and make one decision: v1 scans **one room per session**
  and appends it to the current floor, or v1 chains rooms in a session.
**Done when:**
- The decision is written down with the evidence behind it, and the scan screen in STEP 17 is
  scoped to it.
**Watch out for:**
- Chaining is where drift lives. If the structure output puts room two half a metre off room
  one, take the single-room path — the editor can place rooms, a bad stitch cannot be undone.

### STEP 05 — Decide the mini-map question
**Depends on:** STEP 02, STEP 03
**Implements:** `docs/magicplan/scan-flow-brief.md` §4 ("the mini-map is the thing to copy")
**Reference:** `magicplan/screens/scan-04-scanning-minimap.jpg`,
`magicplan/screens/scan-05-scanning-minimap-2d.jpg`
**Do:**
- Scan a room deliberately badly (skip a wall, walk out of the room mid-scan). Observe whether
  Apple's coaching overlay tells you the polygon is not closing.
- If it does not, prototype the inset mini-map: a small live top-down polyline of the walls
  resolved so far plus a camera-position cone.
- Per `MVP.md` §1 screen 5, build it only if this step shows it is needed. Record the verdict.
**Done when:**
- Either a written "Apple's coaching is sufficient, no mini-map in v1", or a working prototype
  that shows the wall trace updating live during a scan.
**Watch out for:**
- The mini-map needs per-frame access to in-progress geometry. If the API only hands you
  results at the end, this feature is not cheap and the honest answer is to defer it.

---

# Phase 1 — Capture → persist → render

Geometry and measurement first, on hand-authored fixtures. The scanner is wired in near the
end of the phase, deliberately.

### STEP 06 — Build the geometry core
**Depends on:** STEP 01
**Implements:** — (foundation for spec §3)
**Reference:** `magicplan/screens/20-floorplan-editor-2d-detail.jpg`
**Do:**
- In the `Geometry` framework, with no UI imports: `Point2D`, `Segment`, `Polygon`.
- Implement: signed area (shoelace), orientation normalisation to counter-clockwise, perimeter,
  point-in-polygon, closest point on segment, segment intersection, and an **offset polygon**
  routine that takes a per-edge distance and returns the mitred outer/inner polygon.
- Define one global tolerance set: `Tolerance.point = 0.020 m`, `Tolerance.angle = 1.5°`,
  `Tolerance.collinear = 0.020 m`. Every comparison in the codebase uses these constants.
- Property-test the offset routine on a square, an L-shape and a U-shape.
**Done when:**
- `polygonArea` on the 4.000 × 2.500 fixture returns 10.000 and orientation normalisation makes
  it sign-independent.
- Outward offset of the 4.000 × 2.500 rectangle by 0.250 on every edge produces a 4.500 × 3.000
  rectangle.
**Watch out for:**
- Mitred offsets blow up at reflex corners and at near-180° corners. Clamp the miter length and
  test the L-shape specifically — this routine is what draws every wall band in the app.

### STEP 07 — Implement the derived measurements and pin them with the test-room numbers
**Depends on:** STEP 06
**Implements:** spec §3 "Statistics vocabulary" (verified formulas), consumed by INT-E23,
INT-E24
**Reference:** `magicplan/screens/52-floor-inspector-wall-thickness.jpg`
**Do:**
- One file, pure functions over `(corners, ceilingHeight, interiorThickness, exteriorThickness,
  wallClassification)`:
  - `floorArea = polygonArea(corners)`
  - `ceilingPerimeter = Σ |corner[i+1] − corner[i]|`
  - `groundPerimeter` — the inferred rule, see below
  - `wallArea = groundPerimeter × ceilingHeight` ← **ground**, not ceiling
  - `volume = floorArea × ceilingHeight`
  - `footprint = area of the polygon offset outward by the exterior thickness on exterior
    edges, no deductions`
- Write the `MVP.md` §3 acceptance test verbatim. Room 4.000 × 2.500 m, ceiling 2.440,
  interior walls 0.120, exterior 0.250:

  | Metric | Expected |
  |---|---|
  | Floor area | 10.00 m² |
  | Footprint (all walls) | 13.50 m² |
  | Ceiling perimeter | 13.00 m |
  | Ground perimeter | 12.10 m |
  | Wall area | 29.52 m² |
  | Volume | 24.40 m³ |

- Implement `groundPerimeter` as a single named function marked `// INFERRED`, with the two
  candidate rules that both reproduce 12.10 on this room written in the doc comment:
  (a) uniform per-side inset of 0.1125 m → `13.00 − 8 × 0.1125`;
  (b) per-corner deduction of 0.225 m → `13.00 − 4 × 0.225`.
  Ship (b) — it generalises by corner count rather than by edge count — and add a failing
  placeholder test named `groundPerimeter_secondRoom_unverified`.
**Done when:**
- All six numbers in the table pass as unit tests, rounded exactly as shown.
- `wallArea` for the test room is 29.52 m², not 31.72 m².
**Watch out for:**
- 31.72 m² is `13.00 × 2.440` — the ceiling perimeter. If you see it, you wired the wrong
  perimeter in. The reference reports it too, as *"Walls with openings"*, which is why the
  mistake looks plausible.
- Do not delete the unverified-second-room test. It is the reminder that 12.10 was inferred,
  not observed, per the note in `MVP.md` §3.

### STEP 08 — Derive walls from corners with stable identity
**Depends on:** STEP 06
**Implements:** INT-E19, INT-E22 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/48-room-selected-dimensions-detail.jpg`
**Do:**
- `Wall` holds `startIndex`/`endIndex` into `Room.corners` plus `isManuallySet` and
  `manualLength`, per `MVP.md` §2.
- Write `rebuildWalls(for:)` that regenerates the wall array after any corner-count change while
  **preserving `id`, `isManuallySet` and `manualLength`** for walls whose endpoints survive.
- Write `wallLength(_:)` returning `manualLength ?? derivedLength`, and assert that a wall is
  never both locked and inconsistent with its corner positions by more than `Tolerance.point`.
- Unit-test: insert a corner mid-edge on a locked rectangle and confirm the other three walls
  keep their locks and ids.
**Done when:**
- A test inserts and deletes corners on a room with two locked walls and the locks survive on
  the correct walls.
**Watch out for:**
- Index-based walls break the moment you insert a corner. Reindex in one place only —
  `rebuildWalls` — and never mutate `corners` outside it.

### STEP 09 — Build the floor topology index: welded corners, shared walls, interior/exterior
**Depends on:** STEP 08
**Implements:** INT-E24 (wall thickness is a floor-level property)
**Reference:** `magicplan/screens/52-floor-inspector-wall-thickness.jpg`,
`magicplan/screens/19-floorplan-editor-2d.jpg`
**Do:**
- `FloorTopology` is a derived, non-persisted index rebuilt from a floor's rooms:
  - **Corner welding** — group corner references from any room that lie within
    `Tolerance.point` into a `WeldedCorner { positions: [(roomID, cornerIndex)] }`.
  - **Shared segments** — two wall segments from different rooms are shared when they are
    collinear within `Tolerance.angle`, their perpendicular separation is
    ≤ interiorWallThickness + `Tolerance.collinear`, and their 1-D projections overlap by
    more than 0.100 m. Record the overlap interval, which may be a *partial* overlap.
  - **Classification** — a wall run with a shared counterpart is `interior`; otherwise
    `exterior`. Classification is per overlap interval, so one wall can be interior along part
    of its length and exterior along the rest.
- Expose `thickness(for:)` reading `interiorWallThickness` / `exteriorWallThickness` off `Floor`.
- Cache the index and invalidate it on any corner mutation on the floor.
**Done when:**
- A two-room fixture sharing one wall reports: one shared segment, that wall interior in both
  rooms, all other walls exterior.
- A fixture where room B touches only the middle third of room A's wall reports the interior
  classification on that third only.
**Watch out for:**
- Partial overlap is the normal case in real scans, not an edge case. A boolean
  `isInterior` per wall will be wrong for the first corridor you scan — store intervals.
- This index is derived. Do not persist it; persisting adjacency guarantees it goes stale.

### STEP 10 — Define the SwiftData schema and load a fixture floor
**Depends on:** STEP 08
**Implements:** — (`MVP.md` §2 schema)
**Reference:** `magicplan/screens/14-project-detail-sandbox.jpg`
**Do:**
- `@Model` types exactly as in `MVP.md` §2: `Project`, `Floor`, `Room`, `Wall`, `PlacedObject`,
  with `Point2D` stored as `Codable`. `RoomType` as a ~20-case enum with a raw string value.
- Floor defaults: ceiling 2.440, interior 0.120, exterior 0.250.
- Delete rules: project→floors→rooms→walls/objects all cascade.
- Write a `Fixtures` provider producing (a) the 4.000 × 2.500 test room, (b) a two-room floor
  sharing a wall, (c) an L-shaped room. These fixtures drive every UI step in this phase.
- Add a debug menu entry that loads a fixture project into the live store.
**Done when:**
- Fixture (a)'s statistics computed through the SwiftData model match STEP 07's numbers exactly.
- Force-quit and relaunch shows the fixture project still present.
**Watch out for:**
- Do not store `CapturedRoom` or any RoomPlan type. Do not add `area`/`perimeter` stored
  properties — every measurement is computed, or it will drift from the geometry.
- Enum raw values are persisted. Fix the strings now; renaming a case later is a migration.

### STEP 11 — Implement the unit formatter
**Depends on:** STEP 06
**Implements:** INT-E15, INT-E16 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/39-change-units-metric.jpg`,
`magicplan/screens/40-change-units-feet.jpg`,
`magicplan/screens/41-change-units-inches.jpg`
**Do:**
- `UnitFormat { system: .metric | .feet | .inches, precision }`, where precision is a *per-system*
  ladder: metric = decimal places (`2.50 m`, `2.500 m`, `250 cm`, `250.0 cm`), imperial =
  fractional denominator (`1' 6"`, `1' 6" 1/2"`, `1' 6" 1/4"`; `18"`, `18" 1/2"`, `18" 1/4"`).
- `format(_ metres: Double, as: UnitFormat) -> String` plus `parse(_ text:) -> Double?` for the
  keypad in Phase 2.
- Fixed precision per unit class for statistics: areas 2 dp m², lengths 3 dp m, volume 2 dp m³.
- Test the exact strings from the three screenshots against 0.4572 m (= 1' 6" = 18").
**Done when:**
- The nine formatted strings above are produced from the same stored metre value.
- Round-tripping keypad input through `parse` then `format` is stable.
**Watch out for:**
- One shared "number of decimals" setting cannot express both ladders. Metric precision and
  imperial precision are different types — model them that way now, not after the picker exists.

### STEP 12 — Build the canvas coordinate system
**Depends on:** STEP 10
**Implements:** INT-E01 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/19-floorplan-editor-2d.jpg`,
`magicplan/screens/26-empty-floor-editor.jpg`
**Do:**
- A `CanvasTransform` holding metres-per-point scale and pan offset, with
  `worldToView` / `viewToWorld` and a `fitToContent(_ bounds:, padding:)`.
- Pinch-zoom and two-finger pan gestures with clamped scale limits.
- Background: dotted grid whose spacing follows the zoom level in round metric steps, with
  periodic crosshair marks.
- Empty state: an empty floor shows the grid at a sensible default scale, not a blank view.
**Done when:**
- A 4.000 m wall measured against the on-screen grid at three zoom levels reads 4 m each time.
- Zoom and pan stay smooth on the two-room fixture on device.
**Watch out for:**
- Fix the sign convention for Y once (world Y up, view Y down) and centralise the flip in the
  transform. Every later renderer inherits it, and mixed conventions produce mirrored plans
  that look almost right.

### STEP 13 — Render the static 2D plan: wall bands, fill, labels
**Depends on:** STEP 09, STEP 12
**Implements:** INT-E01, INT-E22 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/19-floorplan-editor-2d.jpg`,
`magicplan/screens/20-floorplan-editor-2d-detail.jpg`
**Do:**
- Draw, in `Canvas`, per room: the interior clear polygon as a light fill, a solid dark inner
  line on the polygon itself, and a wall band drawn **outward** from each edge by that edge's
  classified thickness (STEP 09).
- Shared interior edges: draw the band **once**, spanning the gap between the two rooms' clear
  polygons, not once per room — otherwise the shared wall renders at double weight and with a
  seam.
- Mitre the band at corners using the offset routine from STEP 06; handle reflex corners on the
  L-shaped fixture.
- Centred room label: name over area, formatted per STEP 11, hidden when the room is too small
  on screen to hold it.
- Render order: fills, then bands, then inner lines, then labels.
**Done when:**
- The two-room fixture shows one continuous shared wall of 0.120 m and exterior walls of
  0.250 m, with no seam or doubling at the shared edge.
- The L-shaped fixture renders with correct band geometry at its reflex corner.
**Watch out for:**
- Wall bands drawn per-room in a loop is the obvious implementation and it is wrong at every
  shared edge. Draw from the topology index, not from the room list.

### STEP 14 — Build the editor shell and the contextual action bar
**Depends on:** STEP 13
**Implements:** INT-E01, INT-E06, INT-E07 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/19-floorplan-editor-2d.jpg`,
`magicplan/screens/26-empty-floor-editor.jpg`,
`magicplan/screens/27-insert-menu.jpg`
**Do:**
- Route is `project → floor id → editor`. The editor takes a floor as a required parameter and
  starts with `selection = nil`.
- Chrome: back, title (+ subtitle = parent floor at deeper selection), undo/redo, and a bottom
  action bar with a grabber and the "swipe up for info" caption.
- Action bar items are computed from `(selectionDepth, hasContent)`. At floor level with zero
  rooms the bar is a single full-width `Insert`. Never render a disabled item where the
  reference drops it.
- `Insert` opens a popover with **two** rows in v1 — `Room` and `Object`. `Note`, `Photo` and
  `Form` from INT-E07 are cut (`MVP.md` §6).
- Strip from the reference: view-mode stepper, floor-switcher stepper, sync banner, `?` button.
**Done when:**
- Opening the two-room fixture floor shows the plan with an `Insert`-only or `Insert`-plus
  bar per content state, and the title reads the floor name.
- Adding a room to an empty floor changes the bar without a screen reload.
**Watch out for:**
- The action bar is derived state, not stored state. One `actionBarItems(for:)` function; any
  second place that builds bar items will drift.

### STEP 15 — Implement selection, hit-testing and per-room render styles
**Depends on:** STEP 14
**Implements:** INT-E22 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/47-room-selected.jpg`,
`magicplan/screens/48-room-selected-dimensions-detail.jpg`
**Do:**
- `Selection` enum: `nil` (floor) / `room(id)` / `wall(id)` / `object(id)`. Tap inside a room's
  fill selects the room; tap on empty canvas clears selection (the reference does not document
  this — decide it here and keep it).
- Selected room: hatched fill, heavy walls, white circular corner handles with dark rings.
  Sibling rooms demote to thin grey outlines with no fill and no label.
- Title becomes `<room name>` with subtitle `<floor name>`; action bar rewrites to
  `Insert · Edit Layout · Duplicate · Delete…`, with `Set Size` added only when the room is a
  parametric rectangle (STEP 23).
- Draw one blue dimension string per wall on extension lines with tick ends, offset outward
  from the wall band, using the STEP 11 formatter.
**Done when:**
- Tapping each of the two fixture rooms in turn moves the selection, demotes the other, and
  shows four dimension strings reading the fixture's true lengths.
**Watch out for:**
- Hit-test in world space after the inverse transform, not in view space against a cached
  path — otherwise selection breaks as soon as the user zooms.

### STEP 16 — Map `CapturedRoom` into the model
**Depends on:** STEP 03, STEP 09, STEP 10
**Implements:** `docs/magicplan/scan-flow-brief.md` §8, §11
**Reference:** `magicplan/screens/scan-16-result-2d.jpg`
**Do:**
- Import function `CapturedRoom -> Room`: project wall centre-lines to the floor plane, order
  them into a loop, intersect consecutive centre-lines to get corners, then inset by half the
  wall thickness to produce the **interior clear polygon** our model stores.
- Apply the cleanup that STEP 03's findings justify and nothing more: snap wall bearings to the
  dominant axis pair when within the measured deviation, weld corner gaps within
  `Tolerance.point`, drop degenerate edges under 0.100 m.
- Map `.doors`, `.windows` and `.openings` to `PlacedObject` with `catalogueKey`, host wall,
  `offsetAlongWall`, `width`, `height`, `distanceToFloor` — projecting each opening's centre
  onto the nearest wall.
- Discard RoomPlan's furniture objects; the v1 catalogue (`MVP.md` §4) has no furniture.
- Set the room's ceiling height from the captured wall height, not from the floor default.
**Done when:**
- Importing the STEP 02 dump of your rectangular room produces a closed polygon whose floor
  area is within 2% of your tape measurement.
- Doors and windows land on the correct walls with plausible offsets.
**Watch out for:**
- Centre-line versus clear-dimension confusion here shifts every measurement in the app by half
  a wall thickness per side — about 4% of a small room's area. Assert on import that the
  polygon is closed, simple (non-self-intersecting) and counter-clockwise.

### STEP 17 — Build the scan screen
**Depends on:** STEP 04, STEP 16
**Implements:** INT-E08, INT-E09 (`docs/magicplan/interactions-editor.md`);
`docs/magicplan/scan-flow-brief.md` §§2–6
**Reference:** `magicplan/screens/28-add-room-method-chooser.jpg`,
`magicplan/screens/30-select-room-type.jpg`,
`magicplan/screens/89-scanner-shell.jpg`,
`magicplan/screens/90-scanner-exit-confirm.jpg`
**Do:**
- `Insert → Room` opens the method chooser with the v1 subset: one promoted **Scan** card with
  a LiDAR badge, and one `Add Square Room` row. The other reference rows are out of scope.
- Wrap `RoomCaptureView` with our own thin chrome: exit control with a destructive confirm, and
  a stop/finish control. Keep Apple's coaching overlay.
- After the scan, present `Select Room Type`: segmented `Residential | Commercial`, six most
  common types then `See more`, per INT-E09. Room type is required.
- Order matters: the scan path classifies **after** capture; `Add Square Room` classifies before.
- Add the mini-map only if STEP 05 said to.
**Done when:**
- On device: `Insert → Room → Scan`, scan a real room, pick a type, and the room appears on the
  current floor as an ordinary editable room.
**Watch out for:**
- There is no separate "scanned room" type. The scan result must become a plain `Room` with the
  same walls and locks model as a template room, or every editing feature forks.

### STEP 18 — Build Review Scan with a rejection path
**Depends on:** STEP 17
**Implements:** `docs/magicplan/scan-flow-brief.md` §7 (observed failure mode);
`BUILD.md` §4 ("Review Scan needs a reject path")
**Reference:** `magicplan/screens/scan-09-review-scan.jpg`,
`magicplan/screens/scan-08-incomplete-finish-anyway.jpg`
**Do:**
- Before showing the sheet, run sanity checks on the imported polygon: area ≥ 1.5 m², aspect
  ratio ≤ 10:1, no self-intersection, and any auto-closed edge shorter than 30% of the
  perimeter.
- Sheet shows the resulting polygon with any inferred edge drawn dashed, so the user sees which
  wall was guessed.
- Two actions: `Use This Room` (primary) and `Rescan Room` (secondary, returns to STEP 17's
  capture without writing anything).
- When a check fails, lead with the problem and make `Rescan Room` the primary action. Never
  pair a success icon with an unvalidated result.
**Done when:**
- A deliberately bad scan (walk out mid-capture) produces the problem-first variant, and
  `Rescan Room` leaves the floor unchanged.
- A good scan produces the confirm variant and writes the room on confirmation.
**Watch out for:**
- Nothing may be persisted before confirmation. The reference's defect is that a degenerate
  sliver gets into the plan and every downstream number inherits it.

### STEP 19 — Build Projects list and New Project
**Depends on:** STEP 10
**Implements:** INT-P05, INT-P07 (`docs/magicplan/interactions-project.md`);
`BUILD.md` §4 ("name projects on creation")
**Reference:** `magicplan/screens/01-projects-list.jpg`,
`magicplan/screens/09-new-project-created-empty.jpg`
**Do:**
- Root screen: a `List` of projects showing name and created date, `+` in the toolbar, tap to
  open, swipe to delete with a confirmation.
- `+` presents a small sheet with a name field and `Create` — v1 names on creation rather than
  producing seven identical "My New Project"s.
- Strip: workspace header, search, filter chips, favourites, archive, grid thumbnails, card
  overflow menu, `Move`, `Duplicate`, tab bar.
**Done when:**
- Create three named projects, delete one, force-quit, relaunch: two remain with their names.
**Watch out for:**
- Delete is a real delete here (no archive state in v1). Confirm it, and make sure the cascade
  removes floors, rooms and objects rather than orphaning them in the store.

### STEP 20 — Build Project detail and Add Floor
**Depends on:** STEP 14, STEP 19
**Implements:** INT-P07, INT-P09, INT-E05 (`docs/magicplan/interactions-project.md`,
`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/14-project-detail-sandbox.jpg`,
`magicplan/screens/25-add-floor-sheet.jpg`
**Do:**
- Project detail: project name, total floor area across all floors, a list of floors sorted by
  signed level, `+ Add Floor`, `Export PDF` (wired in Phase 4).
- `Add Floor` presents the level vocabulary from INT-E05 as a two-bucket list: `Most common`
  (Ground, 1st–4th) then `Other floors` (Basement levels, Semi-Basement, Higher Ground Floor,
  5th upward). Name derives from the level and is separately overridable in the floor inspector.
- Creating a floor makes it active and pushes the editor.
- Tapping a floor row opens the editor at that floor.
- Strip: statistics tiles, photos rail, files section, forms, map/address, description,
  created-by, sync banner, title `⌄` menu.
**Done when:**
- Create a project → add "Ground Floor" → editor opens empty → scan a room → back out to
  project detail → the floor row shows the room count and the project shows a non-zero area.
- **Phase 1 milestone:** force-quit, relaunch, and the plan is exactly as left.
**Watch out for:**
- Total area on this screen must call the same functions as STEP 07. Two area computations in
  the app means two different numbers on two screens.

---

# Phase 2 — Editing and measurement

The phase that makes it a product. `MVP.md` §5 items 4, 5 and 6 all land here.

### STEP 21 — Build the undo/redo command stack
**Depends on:** STEP 15
**Implements:** INT-E01 (undo/redo in the persistent editor chrome)
**Reference:** `magicplan/screens/19-floorplan-editor-2d.jpg`
**Do:**
- Every geometry mutation goes through a `Command` with `apply` / `revert` over model state:
  move corner, set wall length, insert/delete room, move/rotate room, insert/move/delete object.
- Coalesce continuous drags into one command on gesture end, not per touch-move.
- Wire the chrome buttons, with correct enabled/disabled state; clear the stack when the editor
  is dismissed.
- Rebuild the topology index (STEP 09) after every apply and revert.
**Done when:**
- Ten mixed edits can be undone to the exact starting geometry and redone to the exact end
  geometry, verified by comparing serialised corner arrays.
**Watch out for:**
- SwiftData autosave will happily persist mid-drag states. Decide the commit point (gesture end)
  and make sure undo restores locks and `manualLength`, not just coordinates.

### STEP 22 — Implement Select Room Type as a shared screen
**Depends on:** STEP 14
**Implements:** INT-E09 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/30-select-room-type.jpg`,
`magicplan/screens/31-room-types-residential.jpg`,
`magicplan/screens/32-room-types-commercial.jpg`
**Do:**
- One pushed screen used by both creation paths: segmented `Residential | Commercial`, six most
  common rows, then `See more` revealing the rest.
- ~20 cases total per `MVP.md` §2, not the reference's 40. Room type is required at creation.
- Reuse it as the editor for `Room Type` in the room inspector (STEP 30).
**Done when:**
- Both the scan path and the square-room path reach the same screen and store the chosen type.
**Watch out for:**
- Living-area percentages are keyed off room type in the reference. That engine is cut
  (`MVP.md` §6), so do not add percentage fields to the enum now.

### STEP 23 — Implement Add Square Room
**Depends on:** STEP 21, STEP 22
**Implements:** INT-E13 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/36-square-room-created.jpg`,
`magicplan/screens/37-square-room-detail.jpg`
**Do:**
- Drop a 2.500 × 2.500 m room at the canvas centre (or clear of existing rooms), set
  `isParametricRectangle = true`, and set `selection` to the new room immediately.
- Title becomes `<room name> / <floor name>`; action bar becomes the five-item form with
  `Set Size` present.
- No walls are manually set at creation — four dimension strings, zero padlocks.
**Done when:**
- On an empty floor, `Insert → Room → Add Square Room → Living Room` produces a selected
  2.500 × 2.500 room with `Set Size` in the bar and no padlock glyphs.
**Watch out for:**
- `Set Size` is gated on `isParametricRectangle`, not on selection depth — a scanned room shows
  the four-item bar. Losing that flag when a room is later edited into a non-rectangle is
  correct; clear it on any corner drag that breaks rectangularity.

### STEP 24 — Build the Change Measurement panel
**Depends on:** STEP 11, STEP 23
**Implements:** INT-E14 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/38-change-measurement-panel.jpg`
**Do:**
- Modal panel over the lower ~55% of the screen; the canvas stays live above it and scrolls so
  the **active wall is visible and highlighted** (heavy stroke, its dimension label boxed).
- Panel contents: title with a unit subtitle, close control, large value readout with unit,
  helper text, and a **custom 4-row keypad** (`1 2 3 / 4 5 6 / 7 8 9 / . 0 ⌫`) — never the
  system keyboard.
- Primary full-width button whose label is derived from queue position.
- Cut from the reference: the `⊕ Laser` Bluetooth row (`MVP.md` §1 screen 6). The unit link goes
  to Settings (STEP 33) rather than an inline picker.
- Digits overwrite the readout on first keypress rather than appending to the existing value.
**Done when:**
- `Set Size` on a square room opens the panel with the top wall highlighted and its current
  length in the readout, and typing changes the readout without moving the canvas.
**Watch out for:**
- Keep the canvas above the panel genuinely live. A static screenshot behind a modal loses the
  whole point of the interaction: the number always has a visible referent.

### STEP 25 — Implement the measurement queue: Next, live resize, Apply
**Depends on:** STEP 24
**Implements:** INT-E17, INT-E18 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/42-measurement-next-live-resize.jpg`,
`magicplan/screens/43-room-resized.jpg`
**Do:**
- Drive the panel from a queue of wall references. For a parametric rectangle, collapse opposite
  walls into **one** queue entry — width then height, two entries, not four.
- `Next` = commit the typed value, write `isManuallySet` and `manualLength` on the wall the user
  typed into, resize the geometry, redraw immediately, advance the queue, reload the readout
  with the next wall's current value.
- Button label = `queue.isLast ? "Apply" : "Next"`.
- Resize rule for a rectangle: move the opposite edge, keeping the room's other locked walls
  intact and the room's origin corner fixed.
- `Apply` closes the panel and restores the previous selection — it does not deselect.
- Each commit is one undo command.
**Done when:**
- On a 2.500 square: type `4.000`, `Next` → the room is immediately 4.000 wide, the highlight
  moves to the right wall, the readout reads `2.500`, and the button reads `Apply`. `Apply`
  closes the panel with the room still selected at 4.000 × 2.500.
- The resized room's statistics equal STEP 07's table exactly.
**Watch out for:**
- Committing on `Apply` only, and re-rendering at the end, is the easy implementation and it is
  the wrong product. Geometry must update *during* the wizard.

### STEP 26 — Implement padlocks and the locked-versus-derived policy
**Depends on:** STEP 25
**Implements:** INT-E19 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/44-manually-set-dimension-padlock.jpg`,
`magicplan/screens/43-room-resized.jpg`
**Do:**
- Render a padlock glyph inline after the value on any wall with `isManuallySet == true`.
- `isManuallySet` records **provenance, not equality**: after the wizard, the top wall the user
  typed carries the lock and the opposite wall carries the same derived value with no lock.
- Set the flag **only** from direct keypad entry. Never from derivation, never from a corner
  drag.
- Decide and implement the unresolved rule (`interactions-editor.md` open question 6): a corner
  drag that would change a locked wall's length is rejected, and the padlock pulses; the user
  taps the padlock to unlock, which clears `isManuallySet` and `manualLength` as its own undoable
  command.
- Constrain the resize solver: when the measurement wizard changes one wall, other locked walls
  in the same room keep their lengths; if that is impossible, refuse the commit and say why.
**Done when:**
- After the STEP 25 flow, exactly two of four dimension strings show a padlock, and they are the
  two the user typed.
- Dragging a corner of a locked wall does not silently change its length, and unlocking then
  dragging does.
**Watch out for:**
- This flag is the input to the PDF's "only manually set dimensions" filter (STEP 41). If drags
  or derivations set it, that export prints numbers the user never measured.

### STEP 27 — Implement corner dragging within one room
**Depends on:** STEP 21, STEP 26
**Implements:** INT-E22, INT-E11 (handle vocabulary) (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/48-room-selected-dimensions-detail.jpg`,
`magicplan/screens/34-draw-room-handles-detail.jpg`
**Do:**
- White circular corner handles on the selected room, with a touch target at least 44 pt
  regardless of zoom.
- Drag updates the corner position live; both adjacent walls, their dimension strings, the wall
  bands, and the room's area label update every frame.
- Snapping, in priority order: to the axis of either adjacent wall (within `Tolerance.angle`),
  to a welded corner of a neighbouring room, to the grid. Show which snap is active.
- On gesture end: reject the result if the polygon becomes self-intersecting (revert with
  feedback), clear `isParametricRectangle` if the shape is no longer a rectangle, and push one
  undo command.
**Done when:**
- Dragging a corner of the fixture room updates both adjacent walls' dimension strings live and
  the area label settles at the correct new value.
- Dragging a corner across an adjacent edge is rejected rather than producing a bow-tie polygon.
**Watch out for:**
- Recomputing the whole topology index per touch-move will drop frames. Update the dragged
  room's geometry live and defer the full index rebuild to gesture end.

### STEP 28 — Make corner drags update every room that shares the corner
**Depends on:** STEP 09, STEP 27
**Implements:** INT-E22, INT-E24 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/19-floorplan-editor-2d.jpg`,
`magicplan/screens/47-room-selected.jpg`
**Do:**
- On drag start, resolve the grabbed handle to its `WeldedCorner` group (STEP 09) and collect
  every `(roomID, cornerIndex)` in it.
- Apply the same delta to all members so the shared corner stays welded and the shared wall
  stays shared. Rooms that are not selected still redraw — do not gate rendering on selection.
- Re-derive the shared-segment overlap after the move: a drag can shorten an overlap, split a
  wall into interior and exterior runs, or break adjacency entirely, which changes the wall
  band thickness on both rooms.
- Validate every affected room's polygon; if any becomes invalid, revert the whole group.
- One undo command covers the multi-room mutation.
- If any affected wall in **any** room is locked, apply the STEP 26 rule to the whole group.
**Done when:**
- On the two-room fixture, dragging the shared corner moves both rooms' walls together, both
  area labels update, and the shared wall never separates into two walls with a gap.
- Undo restores both rooms in one step.
**Watch out for:**
- This is where a per-room mental model breaks. If the drag handler only knows about the
  selected room, the neighbour tears away and you get a sliver gap that renders as two wall
  bands and silently changes both rooms' wall classification.
- Welding is tolerance-based. A corner 25 mm away is not welded and will not follow — surface
  that in the snap feedback so the user can see whether rooms are actually joined.

### STEP 29 — Implement Edit Layout (move and rotate)
**Depends on:** STEP 21, STEP 27
**Implements:** INT-E20, INT-E21 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/45-edit-layout-mode.jpg`,
`magicplan/screens/46-edit-layout-handles-detail.jpg`
**Do:**
- A sub-mode on the selected room: fill turns light blue with a blue inner border, **all**
  dimension strings and corner handles disappear, the centred name/area label stays, and two
  blue manipulators appear — a 4-way move arrow on the label centre and a curved rotate arrow
  offset to its right.
- Action bar reduces to `Insert · Duplicate · Delete…`; `Set Size` and `Edit Layout` drop out.
- Two hit targets, two gestures, one rigid transform: translation, and rotation about the room
  centroid.
- Snap translation to the grid and to alignment with neighbouring room edges; snap rotation to
  15° increments with a modifier-free free-rotate when the user drags far from the pivot. The
  reference does not document this (open question 3) — pick it, and make the snap visible.
- On gesture end, rebuild the topology index: moving a room can create or destroy adjacency,
  and therefore change wall thicknesses.
**Done when:**
- A room can be moved and rotated as a rigid body with its area unchanged to four decimal
  places, and moving one room against another welds their corners when they come within
  tolerance.
**Watch out for:**
- Rotating a room off-axis makes its walls non-axis-aligned, which is legitimate but changes how
  the dimension strings and bands render. Test the L-shaped fixture at 37°.

### STEP 30 — Build the room inspector
**Depends on:** STEP 07, STEP 15
**Implements:** INT-E23 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/49-room-inspector-details.jpg`
**Do:**
- A multi-detent sheet raised by swiping up from the grabber above the action bar, replacing the
  bar while open, with the canvas still visible above.
- **One tab only** in v1 (`MVP.md` §1 screen 7): no `Photos & Notes`, no `Forms`.
- Statistics tile row computed live from STEP 07: floor area, wall area, perimeter, volume.
- Editable rows: `Ceiling Height` (a measurement stepper writing `ceilingHeightOverride`),
  `Room Name`, `Room Type` (pushes STEP 22's screen).
- Cut: `Living Area (%)`, `Affected Areas`, `Room Color`, `+ New Field`, `See All`.
**Done when:**
- Opening the inspector on the test-room fixture shows 10.00 m², 29.52 m², 13.00 m, 24.40 m³,
  and changing ceiling height to 2.700 updates wall area and volume immediately.
**Watch out for:**
- The perimeter tile is the **ceiling** perimeter; wall area is derived from the **ground**
  perimeter. Two different numbers on the same tile row, by design — label them so a future you
  does not "fix" the inconsistency.

### STEP 31 — Build the floor inspector
**Depends on:** STEP 09, STEP 30
**Implements:** INT-E24 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/52-floor-inspector-wall-thickness.jpg`
**Do:**
- Same sheet, opened by the same swipe with nothing selected. Tile row: floor area, wall area,
  volume, room count.
- Editable rows: `Ceiling Height`, `Interior Wall Thickness`, `Exterior Wall Thickness`,
  `Floor Name`.
- Changing a thickness invalidates the topology index and redraws every wall band on the floor;
  changing ceiling height updates every room without its own override.
**Done when:**
- On the fixture floor the tiles read 10.00 m², 29.52 m², 24.40 m³, 1 room, and changing interior
  thickness from 0.120 to 0.200 visibly thickens only the shared wall on the two-room fixture.
**Watch out for:**
- Thickness is a floor property, not a wall property. Resist adding a per-wall override — it is
  what makes the two footprint definitions computable and it is not in the v1 model.

### STEP 32 — Implement Duplicate and Delete with destructive confirmation
**Depends on:** STEP 21, STEP 29
**Implements:** INT-E12 (confirm pattern), INT-E13 (bar items)
(`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/35-discard-changes-confirm.jpg`,
`magicplan/screens/36-square-room-created.jpg`
**Do:**
- `Duplicate` deep-copies the room, its walls (including locks) and its objects, offsets it
  clear of the original, and selects the copy.
- `Delete…` opens a popover anchored to the bar item with exactly one affirmative row, in red.
  Dismissing the popover is the cancel path — there is no "keep editing" row.
- Both are single undo commands; delete restores objects and locks on undo.
**Done when:**
- Duplicating a room with a locked wall and a door produces a copy with the same lock and door,
  and deleting either room leaves the other's geometry and adjacency correct.
**Watch out for:**
- Deleting a room that shared a wall reclassifies the neighbour's wall from interior to exterior,
  which changes its thickness, its footprint and its wall area. Rebuild the index and verify the
  neighbour's numbers change.

### STEP 33 — Build the Settings screen
**Depends on:** STEP 11, STEP 31
**Implements:** INT-P32 (`docs/magicplan/interactions-project.md`), INT-E15, INT-E16
(`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/83-app-preferences.jpg`,
`magicplan/screens/39-change-units-metric.jpg`,
`magicplan/screens/40-change-units-feet.jpg`
**Do:**
- Grouped list with three rows only (`MVP.md` §1 screen 9): `Units` (system + precision),
  `Default Ceiling Height`, `Default Interior / Exterior Wall Thickness`.
- `Units` pushes the combined picker: segmented `Metric | Feet | Inches` plus a wheel of
  precision variants rendered **from a real length in the current project** so the options are
  self-illustrating.
- Snapshot the unit format onto a project at creation; changing the global does not retro-apply
  to existing projects. State that under the control.
- Defaults seed new floors; they do not mutate existing ones.
- Cut: account, privacy, company profile, sync, cache, AR mode picker.
**Done when:**
- Switching to Feet reformats every dimension string, statistic and keypad readout in the app
  from the same stored metre values, with no stored value changed.
**Watch out for:**
- Any place that formats a number without going through STEP 11's formatter will stay metric.
  Grep for string interpolation of `Double` before calling this done.

---

# Phase 3 — Objects

### STEP 34 — Build the twelve-item catalogue with plan glyphs
**Depends on:** STEP 13
**Implements:** INT-E25, INT-E26 (library shape, radically reduced)
(`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/53-object-library-all-objects.jpg`,
`magicplan/screens/55-object-category-doors-gated.jpg`
**Do:**
- A static array of twelve `CatalogueItem { key, displayName, category, placement, defaultWidth,
  defaultHeight, defaultDistanceToFloor, glyph }` per `MVP.md` §4: hinged single, hinged double,
  sliding, opening; fixed, casement, bay; toilet, sink, bathtub, shower; column.
- Draw every glyph ourselves as vector paths — plan-view only. No cloud, no favourites, no
  search, no categories screen, no `+ New Object`.
- `placement: .wall | .floor` determines insertion behaviour and, later, PDF filtering.
- Sensible defaults in metres: single door 0.900 × 2.040 at 0.000; window 1.200 × 1.400 at
  0.900; and so on.
**Done when:**
- A debug grid renders all twelve glyphs at plan scale, correctly proportioned to their default
  dimensions.
**Watch out for:**
- Do not trace the reference's isometric renders — they are trade dress (`CLAUDE.md`). Plan-view
  glyphs are a functional requirement, and they are what the PDF prints anyway.

### STEP 35 — Implement object insertion with wall snapping and the room gate
**Depends on:** STEP 15, STEP 34
**Implements:** INT-E25, INT-E27, INT-E28 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/56-object-gating-detail.jpg`,
`magicplan/screens/57-object-library-enabled-in-room.jpg`,
`magicplan/screens/59-object-inserted-arch-door.jpg`
**Do:**
- `Insert → Object` opens a single-screen picker over the editor.
- Gate on *insertion*, not on browsing: with nothing selected the picker still opens, but cards
  are dimmed and each carries its own reason ("only available in rooms"). Bind the enabled state
  to live selection so it flips without reopening.
- On tap: for `placement == .wall`, find the nearest wall of the selected room, project the tap
  or the room centre onto it, clamp `offsetAlongWall` so the object fits within the wall, store
  `wallID`, and select the new object. For `placement == .floor`, place free-standing with
  `wallID == nil`.
- Object selection depth: title becomes the object name with the floor as subtitle; action bar
  becomes `Insert · Replace with… · Rotate · Duplicate · Delete…` minus the cut items — v1 keeps
  `Rotate`, `Duplicate`, `Delete…` and drops `Replace with…`.
- Blue bounding box on the selected object.
**Done when:**
- With a room selected, inserting a door places it in a wall, selects it, and shows the bounding
  box; with nothing selected, every card is disabled with a visible reason.
**Watch out for:**
- Clamping must account for object width, not just its centre, or doors hang off the end of short
  walls. Reject insertion when the wall is narrower than the object and say so.

### STEP 36 — Render wall openings: swing arcs and window breaks
**Depends on:** STEP 13, STEP 35
**Implements:** INT-E28 (`docs/magicplan/interactions-editor.md`);
`docs/magicplan/scan-flow-brief.md` §8
**Reference:** `magicplan/screens/59-object-inserted-arch-door.jpg`,
`magicplan/screens/scan-16-result-2d.jpg`
**Do:**
- Split the host wall's band at the opening interval, so the band renders as two runs with a gap
  of the object's width — the opening is a hole in the wall, not a sprite on top of it.
- Doors: draw the leaf as a line at the hinge jamb and a quarter-circle arc of radius = leaf
  width, swept into the room. Swing side and hinge side are both derived from a `swing` value on
  the object, generated at draw time, not baked into the glyph. Double doors draw two mirrored
  arcs; sliding draws a leaf offset parallel to the wall; opening draws a plain break.
- Windows: draw the break with the conventional thin double line spanning the gap; bay windows
  project outward from the wall face.
- Free-standing objects (plumbing, column) draw their glyph in place with rotation applied.
- Openings must render identically whether the object arrived from a scan import or from the
  picker.
**Done when:**
- A scanned room with a door and a window renders with a swept arc and a window break, and the
  wall band is continuous everywhere else with no double-drawn segments at the opening edges.
- Flipping a door's swing mirrors the arc across both axes correctly.
**Watch out for:**
- On a shared interior wall the band is drawn once from the topology index (STEP 13). The
  opening must cut that single band, or the door will only cut one room's half of the wall.

### STEP 37 — Implement the object dimension chain and sliding along a wall
**Depends on:** STEP 26, STEP 36
**Implements:** INT-E29 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/60-object-dimension-chain-detail.jpg`,
`magicplan/screens/59-object-inserted-arch-door.jpg`
**Do:**
- While an object is selected, split its host wall's dimension display into two rows: the outer
  row keeps the overall wall length with its padlock if locked; the inner row shows
  `leftOffset · objectWidth · rightOffset`.
- Derive the chain from `(offset, width, wallLength − offset − width)` — never store the trailing
  segment. The three must sum to the wall length exactly.
- Small square drag handles at the two segment boundaries, aligned with the jambs. Dragging a
  handle edits `offsetAlongWall` (or width, depending on which boundary), clamped so both offsets
  stay ≥ 0.
- Sub-segments are derived and never carry `isManuallySet`.
- Only the host wall splits, and only while the object is selected.
**Done when:**
- Selecting a 0.900 door on a 4.000 wall shows `1.550 · 0.900 · 1.550`, and dragging it left
  updates both offsets live while the sum stays 4.000.
**Watch out for:**
- Whether dragging past a corner moves the object to the adjacent wall is undocumented
  (`interactions-editor.md` open question 5). Clamp at the corner in v1 and do not invent the
  transfer behaviour.

### STEP 38 — Build the object inspector
**Depends on:** STEP 30, STEP 35
**Implements:** INT-E30 (`docs/magicplan/interactions-editor.md`)
**Reference:** `magicplan/screens/61-object-inspector-details.jpg`
**Do:**
- The same sheet shell as STEP 30, with the statistics block omitted — objects have declared
  dimensions, not derived ones.
- Rows: `Width`, `Height`, `Distance to Floor`, all measurement steppers, plus `Delete`.
- Default `Height` from the floor's ceiling height for full-height openings; `Distance to Floor`
  is the sill height, which is what makes one field set serve doors and windows.
- Editing width updates the chain and the wall break live.
- Cut: `Include in PDF`, `Display Label` modes, `+ New Field`, the tab bar.
**Done when:**
- Changing a window's width from the inspector re-renders the wall break and the dimension chain
  in the same frame, and Delete removes it and heals the wall band.
**Watch out for:**
- Width is clamped by the host wall length minus offsets. Reject values that would push the
  object past a corner instead of letting the chain go negative.

---

# Phase 4 — Output

### STEP 39 — Extract the plan renderer from the editor
**Depends on:** STEP 36
**Implements:** — (refactor enabling INT-P22)
**Reference:** `magicplan/screens/73-report-pdf-settings-1.jpg`
**Do:**
- Move all drawing (wall bands, fills, openings, arcs, dimension strings, labels) into a
  `PlanRenderer` that takes a floor, a topology index, a `CanvasTransform` and a
  `RenderOptions` struct, and draws into any `GraphicsContext` or `CGContext`.
- The editor becomes one caller with interactive options (handles, selection styling, grid); the
  PDF becomes another with print options (no grid, no handles, no selection).
- `RenderOptions` covers: show grid, show handles, show detailed dimensions, show main
  dimensions, show area, only-manually-set dimensions, line weights, label font size.
**Done when:**
- The editor looks unchanged after the refactor, and a debug command renders the same floor into
  an off-screen image with grid and handles disabled.
**Watch out for:**
- Line weights and font sizes cannot be in view points for print. Parameterise them in
  millimetres-on-paper and convert through the render scale, or the PDF comes out with hairlines
  at one scale and slabs at another.

### STEP 40 — Implement scale selection and page fitting
**Depends on:** STEP 39
**Implements:** INT-P22 (Scale group) (`docs/magicplan/interactions-project.md`)
**Reference:** `magicplan/screens/73-report-pdf-settings-1.jpg`
**Do:**
- Compute the floor's bounding box including wall bands, dimension strings and their extension
  lines — dimensions extend past the geometry and are what actually overflow the page.
- Choose the largest standard architectural scale that fits within the page's printable area
  (1:50, 1:75, 1:100, 1:200 metric; the imperial ladder when the unit system is imperial).
- Implement "rotate plan to maximise scale": test both orientations and keep the better fit.
- Use one scale for all floors in the document so plans are comparable.
- Draw a scale bar and print the chosen scale on the sheet.
**Done when:**
- A wide floor and a tall floor both fit their page with visible margin, the wide one rotated,
  and a 4.000 m wall measured on the printed page matches the stated scale.
**Watch out for:**
- Fitting to the geometry bounds instead of the drawn bounds clips dimension text at the edges.
  Measure the text.

### STEP 41 — Compose the PDF pages
**Depends on:** STEP 26, STEP 40
**Implements:** INT-P22, INT-P24 (`docs/magicplan/interactions-project.md`)
**Reference:** `magicplan/screens/73-report-pdf-settings-1.jpg`,
`magicplan/screens/74-report-pdf-settings-2.jpg`
**Do:**
- `UIGraphicsPDFRenderer`, one page per floor, page size from settings (A4 / US Letter).
- Page content: the plan at the chosen scale, wall dimensions, room names and areas, a scale bar,
  and a title line with the project name, floor name and export date.
- Honour the dimension filters: main dimensions, detailed (sub-segment) dimensions, area labels,
  and **only dimensions that have been manually set** — the consumer of `isManuallySet` from
  STEP 26.
- Room label collision handling: if the name/area block does not fit inside the room polygon,
  place it outside with a leader line rather than overlapping walls.
- Cut from the reference: attachments, photos, forms, disclaimer, title block branding,
  watermark, per-room pages, DXF/SVG/CSV/3D formats.
**Done when:**
- Exporting the two-room fixture produces a one-page PDF with both rooms, their names and areas,
  and correct dimensions, opening cleanly in Preview and Files.
- Enabling "only manually set" prints exactly the padlocked dimensions and nothing else.
**Watch out for:**
- Dimension strings at rotated wall angles need their text kept upright and readable, not
  mirrored. Test with the 37°-rotated fixture from STEP 29.

### STEP 42 — Wire Export PDF into the project detail screen
**Depends on:** STEP 20, STEP 41
**Implements:** INT-P20, INT-P22 (radically reduced)
(`docs/magicplan/interactions-project.md`)
**Reference:** `magicplan/screens/70-export-hub.jpg`,
`magicplan/screens/74-report-pdf-settings-2.jpg`
**Do:**
- `Export PDF` on project detail opens a small settings sheet with `Cancel` / `Done` framing —
  nothing generates until `Done`. Rows: page size, and the four dimension toggles from STEP 41.
- Persist last-used settings per project.
- Generate on a background task with progress, then present the system share sheet with the
  resulting file. Write it to a temporary URL; there is no Files section in v1.
- Show a real preview thumbnail rendered from the user's actual first floor, not a static sample
  (`BUILD.md` §4).
**Done when:**
- From project detail: `Export PDF` → `Done` → the share sheet appears with a PDF whose contents
  match the preview, and it can be AirDropped and opened on the Mac.
**Watch out for:**
- Generation must not block the main thread on a multi-room floor. Render off-main and hop back
  only to present.

### STEP 43 — Run the acceptance pass on device
**Depends on:** STEP 42
**Implements:** `MVP.md` §5 (all nine criteria)
**Reference:** `magicplan/screens/43-room-resized.jpg`,
`magicplan/screens/59-object-inserted-arch-door.jpg`
**Do:**
- On your own phone, in one sitting, in a real space, walk all nine criteria in order: create a
  project and floor; scan a room; check that doors and windows landed; tap a wall, type its true
  length, watch the resize and the padlock; read a floor area you would put on a quote; drag a
  corner and confirm both adjacent walls update; add a door manually and slide it along a wall;
  export a PDF; force-quit, reopen, verify everything.
- Tape-measure two walls and one room's area and record the delta against the app's numbers.
- Log every defect found; fix only those that block a criterion.
**Done when:**
- All nine criteria pass on a real scan of a real room, and the recorded measurement deltas are
  written down.
**Watch out for:**
- Criteria 4, 5 and 6 are the product (`MVP.md` §5). If any of them merely "works", it is not
  done — they are the reason for building it.
