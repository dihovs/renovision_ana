# Work orders

Sequenced work for Claude Code. Say "do ORD-01".

Grounded in `Docs/REFERENCE-STATUS.md` — an audit of *this source* against the magicplan
behavioural reference in `Docs/reference/`. That status document is authoritative.
`Docs/reference/PHONE-BUILD-AUDIT.md` describes an older shipped build and is **stale**;
where the two disagree, REFERENCE-STATUS wins.

**Rules**

- One order at a time. Do not start the next until "Done when" holds.
- Commit per order, message prefixed with the id.
- If an order's premise is wrong, **stop and report**. Do not improvise a substitute.
- `[inferred]` / `[uncertain]` in the reference docs are guesses. Flag, don't implement.
- Reference screenshots: `Docs/reference/magicplan/screens/`. Open a few at a time, never the
  whole directory.

---

## ORD-01 — Diagnose the `room_scans` banner before changing anything  🔴 FIRST

The shipped app shows *"The `room_scans` table is not reachable"*. **Do not assume the
migration is unrun.** `isMissingTable` (`src/lib/crm/db.ts:54-65`) also fires on `PGRST200`,
which is a *failed embed*, not a missing table — and `db.ts:67-84` records that this exact
misdiagnosis has happened before.

**Do**

1. `GET /api/v1/health` against the deployment the phone talks to. Report env presence, table
   presence, and per-column presence — especially `room_scans.plan_x` (0027), `room_type` and
   `living_percent` (0030).
2. From that, decide which is true: schema cache stale → `notify pgrst, 'reload schema';`;
   partial paste of `supabase/RUN_ME_floor_plans.sql` → apply the remainder; table genuinely
   absent → apply `0024`.
3. Harden the two call sites that were never given the `isEmbedFailure` fallback that
   `listProjects` has (`crm/projects.ts:207-212`): `listRoomScans` (`crm/roomScans.ts:71`)
   and `getRoomScanProject` (`:148`).

**Done when** the banner is gone, the held room lands, project stats are non-zero, and the
report says which of the three causes it actually was.

**Do not** apply migrations blind, and do not hide the banner.

---

## ORD-02 — Wire up `mergeScans`  ⭐ highest value in the repo

`StructureBuilder` multi-room registration is fully implemented
(`ios/App/App/RoomScanPlugin.swift:119-148`). Its only caller is `RoomScanner.tsx:121` — a
667-line component **no route mounts**. So every floor plan ships shelf-packed with a
disclaimer (`floorLayout.ts:1-17`) while the real thing sits unused.

**Do** — wire `mergeScans` into the live capture path (`FloorWorkspace`, or
`ios/App/App/Native/CaptureFlow.swift`), so rooms scanned in one session are registered
against each other rather than packed. If that is not viable, say why and delete the plugin
methods and the orphan component instead. Either outcome is acceptable; leaving it dead is not.

**Done when** two rooms scanned in one session appear in true relative position, and
`floorLayout`'s disclaimer is either removed or scoped to the manual-entry case.

**Reference:** INT-S10, `Docs/reference/magicplan/screens/scan-10-scan-another-room.jpg`.

---

## ORD-03 — One set of numbers

`toFloorPlan` (`src/lib/roomScan.ts`) ignores `geometry.editedPolygon`, which
`FloorPlanGeometry.swift:48` honours. `FloorWorkspace` and `RoomSheet` recompute totals from
raw `geometry` instead of the corrected `floor_area_sqm` / `wall_length_m` columns.

A room corrected on the phone therefore shows **different figures depending on which screen
you open**. In a trade where the number goes on an invoice, that is the worst class of bug.

**Do** — make the web read `editedPolygon` and prefer the stored corrected columns. Add a test
that a room with an edited polygon reports identical floor area and perimeter through both
paths.

**Done when** the test passes and the two front ends agree.

---

## ORD-04 — State the definitions in the product

Wall area here is `totalWallLength × ceilingHeight` (`roomScan.ts:299`) — interior perimeter,
which is **correct for paint, drywall and baseboard**. magicplan uses a ground perimeter
distinct from its ceiling perimeter (`Docs/reference/magicplan/spec.md` §3). Different
definitions for different purposes; ours is not a bug.

But the app states none of them. `LIVING_AREA_DEFINITION` is the only one shipped. When an
adjuster's figure differs from yours, the definition is the whole argument.

**Do** — attach a short definition string to floor area, perimeter, and wall area gross/net,
alongside the numbers, the way living area already does. Say which perimeter, and that net
excludes openings.

**Done when** every reported figure can state its own definition in the UI and the API
response.

**Reference:** INT-P20, `Docs/reference/magicplan/screens/68-statistic-definition-popup.jpg`.

---

## ORD-05 — Doors and windows for typed rooms

Openings exist only as RoomPlan detections. A typed or drawn room has none by construction
(`manualRoom.ts:92-96`), so its **net wall area equals its gross** — the paint figure for
every non-LiDAR room is systematically high by one door and one window.

**Do** — four door types, three window types. Author on a wall, store offset-along-wall, split
the host wall's dimension into `offset · width · offset` when selected. Draw the glyphs
ourselves: swing arc for doors, break in the wall band for windows. Do **not** copy
magicplan's renders.

**Done when** a drawn room can have openings, and its net wall area drops below gross.

**Reference:** INT-E25–E28, `screens/59-object-inserted-arch-door.jpg`,
`60-object-dimension-chain-detail.jpg`.

---

## ORD-06 — Ask for room type at capture

The living-area rules engine is complete (`src/lib/crm/livingArea.ts`, ANSI Z765, 18 room
types) and drives real numbers. But the only way to set the input is three taps into the
native room detail, so **every scanned room defaults to `other`** — which silently counts
basements at 100%.

**Do** — prompt for room type at the end of capture, as magicplan does (INT-S12), and surface
it in the web room UI. Chips, not a picker: the eight in `rv-11-room-measured.jpg` are the
right set.

**Done when** a scanned room cannot reach the project list untyped, and living area reflects it.

---

## ORD-07 — Close the polygon, or say you couldn't

`chainIntoPolygon` returns `[]` for an incompletely walked room, so the review sheet draws
loose walls with no fill and no indication of which edge is missing.

**Do** — infer a closing edge, draw it dashed, and say so in words the way the reference does
(INT-S09). Add a sanity check before the sheet — area floor, aspect-ratio ceiling,
inferred-edge length as a fraction of perimeter — and when it fails, lead with the problem
rather than a green tick. magicplan shows a success icon on a result it cannot validate; do
not copy that. Keep a reject path (INT-S11).

**Reference:** `screens/scan-09-review-scan.jpg`.

---

## ORD-08 — In-capture feedback

No mini-map, no pose cursor, no open-polygon warning while the operator is still in the room.
`RoomScanViewController` implements no `didUpdate` delegate, so there is no live geometry
stream to build from — that comes first.

**Do** — add the delegate, then the live 2D mini-map with a pose cursor (INT-S04), then the
in-capture incompleteness warning (INT-S07).

The reference singles out the mini-map as the best idea in magicplan's scan: it lets the
operator see the polygon failing to close while they can still walk back and fix it.

**Reference:** `screens/scan-04-scanning-minimap.jpg`, `scan-08-incomplete-finish-anyway.jpg`.

---

## ORD-09 — Consume `lockedEdges` in exports

Dimension locking is **already built** — `PlanEditorView.swift:39,115-149`, persisted through
`ScanPayload.swift:59,119` and `api/v1/scans/[id]/route.ts:31-36`. What's missing is the
export option that uses it: "only dimensions that have been manually set".

**Do** — add that option to the report, driven by `lockedEdges`.

**Reference:** INT-P26, `screens/44-manually-set-dimension-padlock.jpg`.

---

## ORD-10 — Wall-length entry

A system-keyboard sheet today. The reference is a purpose-built panel — custom numeric keypad,
wall-by-wall `Next`→`Apply`, live preview over a live canvas.

Keep imperial-first parsing (`13' 6`, `12.5`); that's better than the reference and right for
this market.

**Reference:** INT-E14, `screens/38-change-measurement-panel.jpg`,
`42-measurement-next-live-resize.jpg`.

---

## ORD-11 — Living area in the web UI

Implemented end to end and surfaced natively (`LevelCanvas.swift:177`), but no web component
references it. Same numbers, both front ends.

---

## ORD-12 — One floor vocabulary

Hard-coded in four places across two languages — `FloorWorkspace.tsx:55`, `ScanStart.tsx:22`,
`CaptureFlow.swift:39`, `FloorPlanSection.tsx:25`. No signed level index, no rename. Adding
"4th" means editing four files.

**Do** — one source of truth with a signed level index, consumed by both front ends.

---

## Not in scope

Elevation view, view-mode axis, room rotation, object catalogue beyond openings, unit picker,
volume and wall thickness, multi-workspace, sharing links. Revisit after ORD-10.

---

## ORD-13 — The universal inspector

The reference's single strongest structural idea (§6.1): ONE swipe-up, multi-detent sheet,
always the same tabs, for every entity — canvas stays visible above it. Our room detail is a
pushed List screen; floor and photos are elsewhere; nothing is inspectable in place.

**Do** — rebuild the native room detail as a multi-detent inspector sheet
(`presentationDetents`, medium/large, canvas visible at medium) presented over the storey
canvas. Three tabs, fixed order, same for every room: **Details** (plan, figures with their
definitions, room type, adjust-the-plan entry), **Damage & Drying** (affected areas, moisture
log — this trade's "Forms"), **Photos & Notes**. Keep every existing capability; nothing gets
lost in the move. Presentation from LevelCanvas tap and room rows.

**Done when** tapping a room opens the inspector over the visible canvas, all three tabs carry
their existing features, and the old pushed screen is gone.

**Reference:** §6.1; INT-E30–E33 (`interactions-editor.md`); `screens/48-room-selected-dimensions-detail.jpg`.
**Territory:** `RoomDetailView.swift` (becomes the inspector), its call sites in
`ProjectsView.swift`/`LevelCanvas.swift`. Do not touch the editors or CaptureFlow.

---

## ORD-14 — The editor feels like a drafting table

Two gaps against §7's canvas vocabulary, redrawn in OUR palette (never system blue):
the editors sit on a flat surface with a floating controls strip, and dimensions are pill
labels rather than drafted strings.

**Do** — (1) dotted-grid background with periodic brand-blue crosshairs in both editors, at
0.5 m model pitch, fading out below the zoom where dots would smear. (2) Selected room fill
becomes a fine hatch (Canvas-drawn lines, not an image). (3) A bottom **contextual action
bar** that rewrites itself per selection — nothing selected: hint; wall: Type length · Add
corner · Add opening; corner: Delete corner; opening: kind + Delete — replacing the current
controls strip in both editors. Destructive item tinted red, trailing position (§6.6).
(4) Editor dimension labels move onto thin extension lines with tick ends, brand-ink text,
padlock glyph preserved on locked values.

**Done when** both editors share the bar and the canvas vocabulary, and nothing regresses in
drag/snap/lock/walk behaviour (the standalone PlanEditing harness still passes).

**Reference:** §7 canvas table; `screens/19-floorplan-editor-2d.jpg`,
`20-floorplan-editor-2d-detail.jpg`, `48-room-selected-dimensions-detail.jpg`.
**Territory:** `PlanEditorView.swift`, `RoomSketchView.swift`, shared helpers in a new file.
Do not touch RoomDetailView, CaptureFlow, or the presentation renderers
(`FloorPlanView.swift` / `FloorPlan.tsx` stay as the drafted-output look).

---

## ORD-15 — Collection shells and most-common-first lists

Browse screens are ad-hoc sections; the reference reuses one shell everywhere (§6.3) and
never shows a long list where a short one serves (§6.11).

**Do** — (1) A shared collection-shell component per platform: section title + chevron,
count caption, `See all (n)`, horizontal rail with a leading dashed `+` tile. Apply to the
web project page sections (Floor plans, Photos/Files, Estimates) and the native project
detail's photos/files/rooms sections. (2) Most-common-first: the CaptureFlow floor chooser
shows Ground/Basement/2nd with `See more` for the rest (this trade lives in basements — it
is in the common three); the room-type chip row keeps its eight and gains `More…` opening
the full 18 with notes. (3) The web floor picker (`AddFloorPlan.tsx`) gets the same split,
driven by `floors.ts`.

**Done when** the shells render on both platforms, every existing destination stays
reachable, and the pickers show the short list first with the rest one tap away.

**Reference:** §6.3, §6.11; `screens/11-project-detail-populated.jpg`,
`12-project-detail-floorplans-photos.jpg`, `25-add-floor-sheet.jpg`,
`30-select-room-type.jpg`.
**Territory:** web components + pages; native `CaptureFlow.swift` (floor chooser + type
chips only), `ProjectsView.swift` sections (rails only — coordinate nothing else there),
`AddFloorPlan.tsx`. Do not touch RoomDetailView or the editors.

---

# Second batch — from the owner's narrated walkthrough

`Docs/reference/magicplan/owner-walkthrough.md`, 14 Aug 2026. The owner ran a real scan and
narrated it. It is the first reference material covering an actual scan and the editing after
it, and it contradicts one earlier order — see the correction under ORD-06 below.

Verdicts below come from a full audit of the Swift editor against that walkthrough. **Several
things look missing and are already built** — the keypad walk (ORD-10) is done, wall drag with
neighbour re-intersection is done, undo/redo is done. Do not rebuild them.

## ORD-06 — CORRECTION (order already shipped)

ORD-06 said "prompt for room type **at the end of capture**, as magicplan does (INT-S12)".
**That premise is wrong.** magicplan asks for the room type *before the camera opens*, right
after the scan-mode choice, and the room's name derives from the type
(`owner-walkthrough.md` A3, owner-confirmed). The chips ORD-06 shipped are correct; their
position in the flow is not. ORD-17 moves them. INT-S12 recorded a *review* screen that also
shows type, not the point of first entry.

---

## ORD-16 — Land in the plan  🔴 the owner's first complaint

*"Where is my scan after the scanning, I need to see it right away."*

Today Done ends at `session.end(); dismiss()` (`CaptureFlow.swift:529-532`), dropping the
operator back on `ProjectDetailView` — a list. Before that they pass a scrolling review
**form** (`:339-492`) with warnings, a read-only preview, a stat band, a name field and chips.
magicplan shows the shape with Confirm / Discard and nothing else, then after Done lands
**directly on the drawn floor plan** (`owner-walkthrough.md` A9, A11).

**Do** — (1) Cut the review to the shape plus Confirm / Discard. The warnings that today
occupy the review move to the plan, attached to what they are about; a stat band and a name
field are not decisions to make while standing in a wet basement. (2) Done leaves the operator
on the floor plan for the storey they just scanned, rooms drawn, not on a list.

**Done when** a scan reaches a drawn plan in two taps — Confirm, Done — and nothing on the
path asks for anything that can be filled in later.

**Territory:** `CaptureFlow.swift`, and the one navigation hook it needs in `ProjectsView.swift`.

---

## ORD-17 — Room type before the camera

Corrects ORD-06's ordering (see above). Sequence per `owner-walkthrough.md` A1-A3:
mode (one-way, no switching afterwards) → **Select Room Type** → briefing → scan.

**Do** — Move the type chips from review to before the camera opens. Residential / Commercial,
the common six, `See more` for the rest — ORD-15 already built that list shape. Derive the
room's default name from the type, so `Room 3` stops being the norm. Keep the briefing screen
between the type choice and the camera; it appears **every time**, not just the first (A2).

**Done when** the camera never opens on an untyped room, and the name field at review is
pre-filled from the type rather than empty.

**Territory:** `CaptureFlow.swift`. Coordinate with ORD-16 — same file, do them together.

---

## ORD-18 — The dimension chain breaks at every opening

`EditorChrome.drawWallDimensions` (`:145-257`) prints one figure per wall for the whole edge.
The segmented wall-piece · opening · wall-piece chain exists (`PlanEditing.chain:488-509`,
`OpeningGlyphs.drawChain:159-232`) but is drawn **only for the selected wall** — deselect and
the segmentation vanishes.

Every magicplan screenshot of a selected room shows the chain broken at every opening at once
(`owner-walkthrough.md` C2, and the 1.550 · 0.900 · 1.550 chains throughout). A door's width
is the number an operator checks first; it should not require selecting the wall it is in.

**Do** — Draw the segmented chain for every wall that has an opening, all the time. Keep the
single figure for walls without one.

**Territory:** `EditorChrome.swift`, `OpeningGlyphs.swift`, `PlanEditing.swift`. Do not touch
`PlanEditorView.swift` beyond the call site.

---

## ORD-19 — Elevation view

Absent entirely; no elevation symbol anywhere in `ios/App/App`. It is reached by double-tapping
a wall or from the view-mode menu, and it is the precondition for ORD-20.

**Do** — A per-wall straight-on projection (`owner-walkthrough.md` G1-G5): the wall face, the
two adjoining walls folded away as grey trapezoids, wall height down the left edge, wall
length along the bottom, the offset chain along the top, and for each opening its head and
sill height. Circular ← / → buttons step to the adjoining walls. Reached by double-tapping a
wall; the escape is a `2D` label where the back chevron sits.

Note the drafting convention in G3: height is drawn down **both** edges. That is deliberate,
not redundancy.

**Territory:** a new `ElevationView.swift`, plus the double-tap hook in `PlanEditorView.swift`.

---

## ORD-20 — Damage on the wall face  ⭐ the reason elevation matters

*"Let's say the middle half of the wall is damaged, so I can draw a square there in
approximate size. That's gonna mark as a damaged area... you give them different colour
coatings for you to find them easily after."* (`owner-walkthrough.md` G6)

**The schema is already right.** `0025_affected_areas.sql` has `surface in ('floor','wall')`,
`wall_index`, `damage_type`, `name` and `color`, with a constraint that a wall area must name
its wall. The gap is entirely above it: Swift's `AffectedArea` (`Models.swift:606-648`) has no
`wall_index` and no colour field, `NewArea` (`API.swift:290-311`) never sends a surface, and
`AreaEditor` (`FloorPlanView.swift:307-458`) drags corners in floor-plan metres with no
wall-face target. Damage colours exist twice as UI constants
(`FloorPlanView.swift:319-325`, `RoomDetailView.swift:420-428`) rather than once as data.

**Do** — (1) Swift model and API carry `surface`, `wallIndex` and `color`; the two duplicated
colour tables collapse into one that matches `areaShapes.ts` (`DAMAGE_TYPES`, `DAMAGE_COLOR`)
so the same damage is the same colour on both platforms. (2) Draw a rectangle on the wall face
in elevation, name it, set its cause; it saves as `surface='wall'` with the wall's index.
(3) It renders in elevation in its cause's colour, and the room's damage list shows wall areas
alongside floor areas.

**Done when** a wall area drawn in elevation survives a round trip to the database and back,
and the report's damage totals separate floor area from wall area — they are different trades
at different rates.

**Territory:** `Models.swift`, `API.swift`, `ElevationView.swift`, `RoomDetailView.swift`
damage tab. Depends on ORD-19.

---

## ORD-21 — Units, once

Hard-coded imperial: `FloorPlanGeometry.feetInches` (`:438-446`), `Measure`
(`Models.swift:777-788`), `MeasurementPanel` parses imperial only (`:61-66`). magicplan offers
Metric / Feet / Inches each with a precision — decimal places for metric, fractional
denominator for imperial (`owner-walkthrough.md` E6).

**Do** — One formatter taking `(system, precision)` and metres, used everywhere a length is
drawn or typed. Imperial stays the **default** — this market quotes in feet and inches — but
metric becomes reachable. Keep the permissive imperial parsing (`13' 6`, `12.5`); it is better
than the reference.

**Done when** one function formats every length in the app, and switching the setting changes
every drawn dimension.

**Territory:** `FloorPlanGeometry.swift`, `Models.swift`, `MeasurementPanel.swift`, plus the
web twin in `src/lib/`.

---

## Deliberately not ordered

- **Whether a scanned room arrives locked** (`owner-walkthrough.md` E5) — the owner said "I
  think" and the evidence is one padlock in one screenshot. `[owner-unsure]`. It decides
  whether ORD-09's export prints anything on an unedited room. Ask before building.
- **Add Corner / Add Wall / Split Room** at wall depth — seen in the action bar, never
  performed, no after-frames.
- **Room-as-selection** (move, rotate, duplicate a whole room on the canvas). Real in
  magicplan, but this trade scans rooms rather than composing them; low value until someone
  asks.

---

## ORD-22 — Commercial room types  ⚠️ needs an owner decision first

Found while building ORD-17. The reference's Select Room Type screen has a
**Residential / Commercial** segmented control, and the walkthrough confirms it
(`owner-walkthrough.md` A3). We have no commercial half: `ROOM_TYPES` in
`src/lib/crm/livingArea.ts` is 18 residential types and nothing else. The control was
omitted from ORD-17 rather than shipped as tabs that lie.

**Do not build this from a guess.** Two questions only the owner can answer:

1. **Which commercial types?** A restoration company's commercial jobs are not an office
   fit-out's rooms. Likely candidates are things like retail floor, warehouse, mechanical
   room, commercial kitchen, server room, common corridor, washroom block — but that list
   is a guess and guessing it wrong means an operator picks "Other" every time, which is
   exactly the failure ORD-06 existed to fix.
2. **How does living area treat them?** ANSI Z765 is a *residential* standard. A warehouse
   has no "living area" and the percentage model does not apply. Either commercial types
   opt out of the living-area engine entirely, or they need their own rule. Getting this
   wrong puts a number in a claim that no standard backs.

**Then** — types and rules in `livingArea.ts`, the segmented control in `CaptureFlow.swift`,
and the chips split by segment. The Swift and TypeScript type tables must stay twins.

**Territory:** `src/lib/crm/livingArea.ts`, `CaptureFlow.swift`, `API.swift`.

---

## Integration notes, not orders

- **Two dotted grids.** ORD-16 added `LevelCanvas.drawGrid`; the chrome work adds its own
  in `EditorChrome.swift`. One design, two implementations — dedupe to whichever is the
  better home, and keep the `+` crosshairs either way.
- **The floor-level action bar** currently offers one tile (`Add Room`) where
  `editor-chrome-design.md` §4 says `Insert · Rotate`. That was a territory boundary during
  parallel work, not a decision. Reconcile once the editor chrome lands.

---

## ORD-23 — The floor as a place, and one Insert verb

From `Docs/reference/magicplan/workflow-new-project.md`, walked on the device.

Two structural differences, both worth taking:

1. **Land on a floor.** They add a *floor*, arrive on that floor's empty canvas,
   and insert a room into it. We ask for the floor as one field in a capture
   chain and never put the operator on a floor as a place they can stand.
2. **Insert is one verb with five nouns** — Room · Object · Note · Photo · Form —
   the same menu at floor level and at wall level. We have separate entry points
   per kind, which is why adding a note and adding a photo feel unrelated.

**Territory:** `CaptureFlow.swift`, `LevelCanvas.swift` (`StoreyPlanView`),
`ProjectsView.swift`.

---

## ORD-24 — Two more ways to make a room

They offer five; we have three. Missing:

- **Add Square Room** — a rectangle template you then tweak. Cheap, and it is
  the fastest path for a plain room when the light is bad.
- **Import & Draw** — trace over a photo of an existing plan. The strongest of
  the five for insurance work: the builder's plan or the adjuster's sketch is
  often the only source for a storey nobody can scan, and tracing it produces
  real geometry rather than a photo in an appendix.

Import & Draw needs a scale-setting step (tap two points, type the real distance
between them) or every measurement off it is decorative. Do not ship it without
that.

**Territory:** `CaptureFlow.swift`, `RoomSketchView.swift`.

---

## ORD-25 — Ground surface, from a stated wall thickness  ⚠️ owner decided

Supersedes the refusal recorded in ORD-22's neighbourhood. The reference reports
three ground-surface figures; we reported one, because the other two need wall
thickness and a scan gives faces, not assemblies.

**The owner's answer:** make the thickness a setting, default 2×4, "here it is
mostly 2×4". That resolves it — a figure derived from a STATED thickness is
honest in a way an invented one is not, provided the statement travels with the
number.

Build:
- A wall-thickness setting per project (default 2×4 = 3½" stud + ½" board each
  side = 4½"; offer 2×6 and a typed value).
- `Ground surface without walls` — what we already report.
- `Ground surface with interior walls` — plus the partitions inside the outline.
- `Ground surface with all walls` — plus the exterior envelope.
- Every one of the three must state the thickness it used, in the ⓘ, in the API
  response and in the report. A figure derived from an assumption that does not
  travel with it is the exact failure `measureDefinitions.ts` exists to prevent.

**Still unresolved and must be flagged, not guessed:** telling an exterior wall
from a shared partition. Per-room scans do not say which is which. Until they
do, treat every wall of the storey's outer boundary as exterior and everything
inside it as partition, and say so in the definition.

**Territory:** `src/lib/crm/projectStatistics.ts`, `ProjectStatistics.swift`,
`measureDefinitions.ts`, `Theme.swift`.

---

## ORD-22 — CORRECTION, from the device

The Residential / Commercial split was observed in magicplan on 15 Aug 2026,
and **their commercial list has now been read**:

> Private Office · Shared Office · Open Space · Meeting Room · Conference Room ·
> Reception · Kitchenette · Cafeteria · Lounge · Waiting Room · Training Room ·
> Maintenance Room · Archives · Photocopy Room · Lab · …

That answers question 1 — in the negative. It is an **office fit-out**
vocabulary, and copying it would be worse than having no commercial half at
all. Nobody restoring a flooded commercial building picks `Photocopy Room`;
they pick a mechanical room, an electrical room, a server room, a retail floor,
a warehouse bay, storage, a washroom block, a corridor, a stairwell, a loading
dock. An operator who cannot find their room picks "Other", which is exactly
the failure ORD-06 existed to fix.

**So: take the split, not the list.** The control is confirmed real and worth
building. The types behind it must come from the owner's own jobs.

Question 2 is unchanged and still the owner's: ANSI Z765 is a residential
standard and does not apply to a warehouse, so commercial types either opt out
of the living-area engine or need their own rule.

---

## ORD-38 — Editing a wall area's shape: add and delete points

**Raised by the owner, 18 Aug 2026, while testing build 96:** *"for the
damaged area, I wanna be able to add and delete points."*

**Half of this already exists.** On the FLOOR plan, `AreaEditor` has had the
full corner editor since S3: hollow midpoint dots add a corner, tapping a
corner turns it into the red four-way handle and reveals `Delete point`,
live edge dimensions show while dragging. Nothing to build there — and note
it was hard to find before 18 Aug because every handle sat up to 139pt away
from the corner it belonged to (see S4).

**On the WALL face it does not exist at all.** `ElevationView` models an
affected area as `FaceRect` — two dragged corners, so a rectangle and only
ever a rectangle. There is no way to reopen a saved area's shape, no
handles, no add, no delete.

The reference has it, on the wall, and describes it exactly (object-model
§2b, "Editing the shape"): action bar `Insert · Edit Shape · Delete`; `Edit
Shape` captioned *"Tap to adjust points"*; tap a point for a red four-way
handle with a `Delete` button; drag it and the shape stops being
rectangular; live dimensions on the two adjoining edges; points added as
well as deleted, so an area can be an L or a T.

**Scope.** Port `AreaEditor`'s editing layer onto the wall face rather than
writing a second one — same corner array, same `PlanEditing.addCorner` /
`removeCorner` / `moveCorner`, same undo/redo — with the face transform in
place of `PlanTransform`. `FaceRect` stays for the initial drag-out, which
is the reference's own reductive gesture; what changes is that the result
becomes an editable polygon rather than a frozen rectangle.

**Watch for.** `AffectedArea.polygon` on a wall is in FACE metres (x along
the wall, y above the floor), not plan metres — the two must never meet the
same renderer. And read S4's note first: an overlay of handles must be
positioned in the space the drawing actually occupies, not the space its
container was offered.

---

## ORD-39 — Evidence on a moisture reading: photo + instrument icon

**Raised by the owner, 18 Aug 2026, explicitly as a later item:** *"in the
future, when we [have an] other humidity measurement icon, so we need to
attach the photo of the humidity reading to it too. If we're using ultra red
humidity, like, temperature, thermometer, detector … we have to have the
icon for it, and we have to be able to attach it too."*

The logic he stated is the report's: **a figure an adjuster is asked to
believe should carry the photograph it was read from.** Affected areas got
this on 18 Aug (S4). Moisture readings have not.

**Two parts.**

1. **A photo against a reading.** `project_files` already pins a photo to a
   room (`room_scan_id`), a wall (`wall_index`) and an affected area
   (`affected_area_id`). It has no column for a moisture reading, so this
   one DOES need a migration — the area work did not. Then the same read
   filter and the same `RoomPhotosSection` treatment.
2. **The instrument.** Which tool took the reading — pin meter, pinless
   meter, thermo-hygrometer, infrared camera — as a field on the reading
   with its own glyph, drawn on the reading's row and carried into the
   report. This is not decoration: a pin reading and an IR surface
   temperature are different measurements, and an adjuster who cannot tell
   which instrument produced a number can discount it. Same argument as
   `MeasureDefinition` makes for the statistics.

**Ask the owner which instruments before building the list** — the same
mistake ORD-22 records is available here. His own kit is the vocabulary,
not a catalogue of everything that exists.

**Glyphs are ours to draw**, per the standing exception: their artwork is
substituted with equivalents in the identical position and role.

---

## ORD-40 — An illustrated object library: doors, windows, fixtures

**Asked for by the owner, 18 Aug 2026**, after seeing the elevation
illustration in `OpeningDetailView` and wanting it everywhere:

> *"I think it's a good idea to make this kind of illustrations for all kind
> of items, like cabinets, toilets, different types of doors, sliding door,
> whatever kind of door and things exist here in North America. So I want you
> to go do research, and I want you to draw illustrations. So when we click
> insert button and we choose a door, I want to see illustrations and
> preferably colored illustrations. Even if it says the section 'doors', I
> want it to show one door that opens the door section. And when you click on
> it, it shows all the different doors with illustrations. And I also wanna
> have a tab that shows my favorite and most commonly used ones to start
> with... And also we need the search bar there to search."*

**Four distinct pieces, and only the first is small:**

1. **Replace `OpeningPicker`'s text rows with illustrated tiles.** Seven
   kinds exist today (`OpeningKind`); each needs a drawn tile rather than a
   label + width. The elevation drawing built for `OpeningDetailView` on 18
   Aug is the starting point and already covers doors/windows/passages.
2. **A category → detail hierarchy.** A "Doors" tile that opens a doors
   screen, per his description — the reference does the same
   (object-model §2's object library: *Annotations 25, Doors 17, Windows 15,
   Structural 27, Plumbing 57, Appliances 29, Kitchen Cabinets 37, Furniture
   126, Electrical 69*). Note the counts: theirs is a 300+ object catalogue.
3. **Favourites / recently-used tab.** The reference has `Recently used` as
   its own rail. Needs a store — `UserDefaults` is enough; nothing here is
   worth a table.
4. **Search.** Trivial once the catalogue is a real list rather than an enum.

**The hard part is NOT the UI — it is that a real catalogue is not an enum.**
`OpeningKind` is seven cases with hard-coded widths, heights and sills, and
every one of them is load-bearing: `width` sizes the wall knock-out, `height`
and `sill` drive net wall area and the elevation. A cabinet or a toilet is a
different KIND of thing entirely — it sits ON the floor, deducts no wall
area, and has no host edge. That is **ORD-36's objects takeoff**, which this
order overlaps and should be sequenced against rather than duplicated.

**Do the research first, as he asked**: North American stock sizes for the
door and window types this trade actually meets. `OpeningKind`'s existing
comments are the precedent — every figure there is a builder's stock size
with its inch derivation stated, never a bare metric number.

**Colour is a deliberate change of direction and worth confirming.** Every
drawing in this app is currently ink-on-paper monochrome, on purpose
(`Brand.Plan`), and the plan/report are meant to read as drafting. Coloured
illustrations in a PICKER are consistent with that — the reference's own
library is coloured while its plan is not — but the line between the two
should be explicit before drawing 50 of them.

---

## ORD-41 — Animated illustrations for the capture-method chooser

**Asked for by the owner, 18 Aug 2026**, about `AddRoomMethodSheet`'s two
cards:

> *"These illustrations I don't like... I want you to be more creative and
> make nice illustrations, maybe some animations. For the LiDAR, basically
> how it works is a person takes the phone and goes corner, and scans. For
> the manual mode, it goes corner to corner, draws the corners. I don't want
> it photorealistic, but I want a nice illustration, maybe animated. For this
> point it's better to have animated, so a person who's using it understands
> what does what."*

The two cards are `ScanMethodArt` (`LevelCanvas.swift`), drawn 15 Aug as
"our own isometric illustrations, drawn not traced". He is not rejecting
that they are ours — he is saying they do not TEACH the difference, which is
the one job a method chooser has.

**What each animation has to convey:**
- **Auto-Scan (LiDAR):** a person walking the perimeter holding a phone, the
  room filling in behind them. The point is "you walk it".
- **Draw manually:** taps landing corner to corner, edges snapping in between.
  The point is "you tap the corners".

**Practical notes for whoever builds it.** SwiftUI `TimelineView` +
`Canvas` is the right tool — no asset pipeline, no new dependency, and it
matches how every other drawing in this app is made. Keep them SHORT and
looping, and pause when off-screen. `Docs/reference/CAPTURE-PROTOCOL.md`'s
argument applies: an animation is a teaching aid, not decoration, so if it
does not make the choice obvious in one loop it has failed.

Also relevant: the same chooser is reached from two places (Insert → Room on
the floor canvas, and the project's own Add Floor Plan), so this is one
component, not two.

---

## ORD-42 — Edit Layout: tap-and-hold to move and rotate a room in place

**BUILT 19 Aug 2026, build 156** — `StoreyArranging.swift`, plus the lift
state and gestures in `StoreyCanvas` and the preview drawing in
`StoreyBaseLayer`. Asked what he wanted, the owner chose: rooms sit FLUSH
and stay two rooms (no shared-wall model — that is still open); free twist
snapping to 15° or to a neighbour's wall angle; press-and-hold to pick up,
tap still opens a room; flush contact PLUS alignment guides across the
whole sheet. Handles were not drawn — the room itself is the handle, which
is what press-and-hold already means. **His 18 Aug rule is withdrawn.** A lifted
room may be turned whether or not it touches another. Told that this
softened his own rule, 19 Aug: *"Yes. I think I was wrong. The rooms need
to turn because they turn in the magic plan too. So, yeah, it makes
sense."* So the paragraph below about honouring the detachment rule for
rotation is HISTORY, not a requirement — it survives to explain where the
rule came from and why it was dropped. The one place it still holds is the
floor-wide `Rotate` BUTTON, which turns every detached room at once
without anything being selected; letting that spin attached rooms would
turn the whole floor plan, which is the thing he actually objected to
(*"floorplan doesn't turn, separate rooms will"*).

**Shown by the owner, 18 Aug 2026**, with a screenshot of magicplan's own
mode — a selected `Bedroom` carrying a blue four-way move handle and a
curved rotate arrow directly on the room, action bar reduced to
`Insert · Duplicate · Delete…`:

> *"You tap and hold in the storey mode, and it automatically brings the
> screen, and you can move it around and turn. In magicplan you can do that
> on separate rooms even if it's a part of a big floor plan and if it's
> attached. But I don't see a point."*

This is `EditorAction.editLayout` — a verb the bar has always drawn and
never implemented, and one `interactions-editor.md`'s open-questions list
item 3 flags as unobserved in its RESULTS (*"No post-drag frame. Snap
increments, rotation pivot, and whether rooms snap wall-to-wall with
adjacent rooms are all unknown"*). His screenshot now answers what the mode
LOOKS like and how it is entered; what it does on release is still open.

**Note the divergence he chose, and keep it.** magicplan allows this on any
room, attached or not. He explicitly does not want that — his rule, from the
same conversation, is that only a room touching nothing else may turn (built
18 Aug as `StoreyLayout.detachedRooms`, wired to floor-depth `Rotate`).
Moving a room that shares a wall tears it off its neighbour and invents a
building that does not exist. **Whatever this order builds must honour the
detachment rule for ROTATION**; free MOVEMENT of an attached room is a
separate question worth putting back to him.

**Scope.**
1. Long-press a room on the storey canvas → layout mode for that room.
2. The two on-room handles from his screenshot: four-way move, curved
   rotate. Ours to draw, per the standing rule.
3. Drag to move → writes `planX`/`planY` (`API.placeRoom` already exists).
4. Rotate → `PlanEditing.rotatedQuarterTurn` exists and is already used by
   floor-depth Rotate; a free-angle version would need a real decision about
   snap increments, which the reference does not answer.
5. Action bar reduces to `Insert · Duplicate · Delete…` while in the mode.

**Sequencing.** `FloorCanvasView`'s long-press is currently unused, so the
gesture is free — but note the canvas already carries tap (enter room),
drag (pan) and pinch (zoom), and the owner asked specifically for one-finger
pan. A long-press that steals from the pan gesture would be a regression;
`.simultaneousGesture` and a minimum duration need testing on a real thumb,
not just in principle.

---

## ORD-43 — A real illustration set for the object library

**Raised by the owner, 18 Aug 2026**, after seeing our drawings beside the
reference's Doors screen: *"the windows don't look good. If we compare with
the illustrations that magicplan has, we're not good at all. So if you're
not able to do the illustrations yourself, maybe we can go and find it
somewhere that they can give us, like, these illustrations for free."*

**He is right, and the honest reading is that this is not a code problem.**
Builds 133 and 134 took the hand-coded drawings about as far as they go:
`ObjectGlyphs.figure` is 21 shape families of `Path` calls and
`SectionEmblem` is an isometric primitive set. Both are decent plan symbols
and neither is an illustration. What the reference ships — a shaded door
leaf, a wood floor strip, blue glass, a red swing arrow, per door type,
seventeen times — is a professional asset set. Another pass of vector code
closes very little of that gap.

**So the order is: get real assets, and ship them as assets.** Three routes,
and the licence decides more than the look does.

1. **A permissively-licensed set** — CC0, MIT or Apache. Redistributable in
   a commercial app with no attribution screen. The catch is coverage: line
   icon sets are everywhere, but a coherent ISOMETRIC set covering doors,
   windows, plumbing, cabinets and appliances is rare, and stitching four
   sets together looks stitched.
2. **An attribution set** — CC BY, the Noun Project's free tier. Far more
   choice, but every screen carrying one owes a credit, which means an
   acknowledgements screen and a rule nobody may forget when adding an
   object. Worth it only if the coverage is genuinely there.
3. **Generate a bespoke set as SVG** and ship it in the asset catalogue.
   This repo already carries a skill for exactly that (`.claude/skills`,
   icon design, SVG out). One prompt per catalogue entry, one house style,
   ours outright with no licence question at all.

**Recommendation: 3, with 1 as the fallback** for anything the generator
cannot make consistent. It is the only route that gives one coherent style
across a catalogue that will keep growing — and growth is certain, since
the reference's own library is 300+ objects to our 35.

**Whatever the route, the constraints are the same:**

- **The licence must permit commercial redistribution.** This ships to a
  paying customer's phone. Anything NonCommercial or ShareAlike is out, and
  "free to download" is not a licence.
- **Three drawings per object, not one.** The app already needs a catalogue
  tile, a plan symbol and a front elevation, and they are genuinely
  different views — a toilet from above is a tank and a bowl, from the front
  a tank over a pedestal. An asset set that only solves the tile leaves the
  other two hand-drawn, which is where we already are.
- **The plan symbol stays ink-on-paper.** `Brand.Plan` exists so the
  drawing reads as drafting beside a report. Coloured illustrations belong
  in the picker, which is the split the owner already agreed.
- **Slugs are the join.** `ObjectCatalog.Entry.slug` is what the database
  stores; an asset is named for its slug and nothing else has to change.

**Territory:** `ObjectGlyphs.swift`, `ObjectEmblems.swift`,
`ObjectCatalog.swift`, and a new asset catalogue. `EditorChrome.drawObject`
and `ElevationView.drawObjects` call through one routine each, so swapping
the source of the artwork touches two call sites, not twenty.

**Note the door catalogue is a separate gap and should be sequenced with
this.** The reference lists 17 doors and 15 windows to our 4 and 3 — arch,
bypass, folding, double folding, hinged, double hinged, pocket, double
pocket, door-with-window, French. Each new kind needs a real North American
stock width, because that width knocks the hole in the wall and comes off
the net wall area; the artwork alone would be a picture of a door we cannot
measure.

