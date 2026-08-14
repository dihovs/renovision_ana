# Reference status — RenoVision source vs `magicplan-rebuild` docs

Audit of branch `mobile-app` against `/Users/artush/Documents/magicplan-rebuild/docs/`.
Source-of-truth is this repository; the reference docs and `docs/renovision/AUDIT.md` are
compared against it, not the other way round. Report only — no files were changed.

Counts: **BUILT 12 · PARTIAL 16 · ABSENT 25** (19 scan + 34 editor entries).

---

## 1. Stack reality

**What this app is.** Two front ends over one Next.js API and one Postgres (Supabase).

- **Next.js 15 App Router + React, TypeScript.** `src/app/(internal)/admin/**` is the whole
  CRM (leads, clients, quotes, invoices, jobs, price book, dialer, WhatsApp, reports).
  `src/app/api/v1/**` is the HTTP API both front ends use.
- **Native iOS is now the root, and it is SwiftUI.** `ios/App/App/SceneDelegate.swift:19`
  sets `window.rootViewController = UIHostingController(rootView: AppShell())`.
  `ios/App/App/Native/AppShell.swift:MainTabs` is a five-tab SwiftUI app (Home, Projects,
  Customers, Estimates, Scan). ~11k lines of Swift in `ios/App/App/Native/`.
- **Capacitor is a hosted subsystem, not the shell.** `ios/App/App/Native/WebScreen.swift`
  wraps `MainViewController` (a `CAPBridgeViewController`) to host not-yet-ported admin
  pages. It is used in exactly two places: `CustomersView.swift:237` and `MoreView.swift:127`.
  `MainViewController.capacitorDidLoad` is what registers `SpeakerPlugin` and
  `RoomScanPlugin` — so Capacitor plugins only exist inside a `WebScreen`.
- **Persistence is Postgres via the Next API.** `src/lib/crm/db.ts` uses the Supabase
  service-role key server-side and bypasses RLS. The Swift side speaks HTTP
  (`ios/App/App/Native/API.swift`). Offline holding is `localStorage`
  (`src/lib/scanQueue.ts:19`) on the web and a disk queue in
  `ios/App/App/Native/ScanQueue.swift`.
- **Geometry maths is duplicated in two languages, deliberately.**
  `src/lib/roomScan.ts` and `ios/App/App/Native/FloorPlanGeometry.swift` implement the same
  pipeline (square-to-page rotation, collinear-wall alignment, polygon chaining).
  `ScanPayload.swift:16` states the field-for-field contract.

**Where the reference docs assume the wrong stack.**

- The docs' SwiftUI assumption is now **broadly right** for the UI layer — that has changed
  since `AUDIT.md` was written. It is wrong for anything below the view layer.
- **SwiftData / a local object graph is wrong.** There is no SwiftData, no Core Data, no
  local model store. `MVP.md` §2's "map `CapturedRoom` into the model at import" is honoured,
  but the model is `public.room_scans` in Postgres with an opaque `geometry jsonb` blob
  (`supabase/migrations/0024_room_scans.sql:48`), reached over HTTP. There is no offline
  read path — `LevelCanvas`/`FloorWorkspace` show nothing without a network.
- **`interactions-scan.md`'s "one geometry model, several ways to populate it" is right; its
  implied single-process editor is not.** The plan editor is Swift
  (`Native/PlanEditorView.swift` + `Native/PlanEditing.swift`), the plan *renderer* exists
  twice (`src/components/admin/FloorPlan.tsx` and `Native/FloorPlanView.swift`), and the
  measurement definitions exist twice (`src/lib/roomScan.ts`, `Native/ScanPayload.swift`).
  Any "build this once" instruction in the docs lands twice here.
- **`spec.md` §3's entity hierarchy is only partly realised.** There is no `Floor` entity —
  `room_scans.level` is a text label over a fixed five-value list
  (`FloorWorkspace.tsx:55`, `ScanStart.tsx:22`, `CaptureFlow.swift:39`), which is why
  floor-level properties (INT-E24 wall thickness, ceiling height) have nowhere to live.
  There is no `Object` entity at all.
- **`AUDIT.md`'s claim that the reference is "pointed at a different product" is correct and
  understated.** This repo is a restoration CRM with a scanner in it; roughly 90% of
  `src/app/(internal)/admin` has no magicplan analogue.

---

## 2. Scan flow — INT-S01..S19

Legend: "Apple" = supplied by `RoomCaptureView`/`RoomPlan`, not hand-built.

| INT | Reference behaviour | Status | Where | Notes |
|---|---|---|---|---|
| S01 | Full-screen "For best results…" tips gate with five physics rules before the AR session | **ABSENT** | `FloorWorkspace.tsx:401` (`picking === "how"` sheet) | The method chooser carries one line of coaching per mode (`modes` array, `FloorWorkspace.tsx:160-185`). No gate, no five rules, no `Begin`. Similar prose exists in the orphaned `RoomScanner.tsx:246-251` and in `CaptureFlow.swift:130-136`. |
| S02 | `Begin` → calibration, "Point camera at top edge of wall" | **BUILT (Apple)** | `RoomScanViewController.swift:52` `captureView.captureSession.run(...)` | Apple's coaching overlay verbatim. Nothing hand-built; no equivalent copy line of our own. |
| S03 | In-world white massing model during capture | **BUILT (Apple)** | `RoomScanViewController.swift:13` `RoomCaptureView` | The class comment (`:4-8`) states it owns "the session lifecycle and the Done/Cancel chrome around it, not any 3D rendering". |
| S04 | Toggle to a 2D mini-map card: green wall polyline, orange live wall, green cone pose cursor | **ABSENT** | — | `RoomScanViewController` declares `RoomCaptureSessionDelegate` but implements no `captureSession(_:didUpdate:)`; the only delegate method is `captureView(didPresent:error:)` (`:80`). Nothing subscribes to in-flight geometry, so there is no data source for a mini-map. Reference calls this "the single best idea in their scan". |
| S05 | Openings detected as first-class elements, marked during capture | **BUILT (Apple)** | `RoomScanPlugin.swift:303-347` `geometryPayload`; `ScanPayload.swift:150-152` | On-screen marking is Apple's. Doors, windows and cased openings are all carried through with full transforms and re-drawn in the plan (`FloorPlan.tsx:140-203`). The centre diamond marker is Apple's, not ours. |
| S06 | Collapsed detected-object rail at the right edge | **ABSENT** | `RoomScanPlugin.swift:346` | `CapturedRoom.objects` is reduced to `stairCount` and discarded. No object list, no confirm/reject. |
| S07 | Pre-emptive "Your room might be incomplete… / Finish Anyway" popover **during** capture | **ABSENT** | `ScanReview.tsx:57`; `ScanPayload.swift:189` `looksComplete` | The test exists (`walls.length < 3 \|\| floorSqFt < 5`) but only fires **after** the session ends, on the review sheet. The reference's whole point — catch it while the operator is still in the room — is not met. |
| S08 | Stop → closure/validation before anything persists | **BUILT** | `RoomScanViewController.swift:61-92`; `FloorWorkspace.tsx:206` `keepRoom` | Nothing writes until `Save room`. `cancelTapped` nils `onFinish` first (`:72`) so a cancelled room cannot arrive later as a success. |
| S09 | Review Scan sheet: warning badge, plan preview, **dashed inferred closing edge**, Confirm / Discard | **PARTIAL** | `src/components/admin/ScanReview.tsx`; `CaptureFlow.swift:180-255` | Built: preview, floor/perimeter/ceiling stats, incompleteness warning, naming, quick-name chips, primary/secondary hierarchy. Missing: no closure is ever attempted, so there is no guessed edge to dash. `chainIntoPolygon` returns `[]` rather than closing (`roomScan.ts:503,536,544`), and `FloorPlan.tsx` then draws walls with no fill — the user is not told *which* edge is missing. |
| S10 | `Confirm` → back to camera, "Scan another room", `Done` exits; multi-room stitched in one session | **PARTIAL** | `FloorWorkspace.tsx:187` `startScan`; `RoomScanPlugin.swift:119` `mergeScans` | Chaining is at app level: save → back to the floor → `Add` → a **new** `RoomCaptureSession`. `StructureBuilder(options: [.beautifyObjects])` is fully implemented and held rooms accumulate in `RoomScanPlugin.capturedRooms` (`:41`) — but **`mergeScans` is unreachable from any mounted UI**. Its only caller is `RoomScanner.tsx:121`, and no route imports `RoomScanner` (verified: only `ScanStart` and `FloorWorkspace` are mounted). Rooms are therefore packed, not stitched (`src/lib/floorLayout.ts:1-17`, `LevelCanvas.swift:5-10`). |
| S11 | `Discard & Rescan` under `Confirm Scan` | **BUILT** | `ScanReview.tsx:142-165`; `CaptureFlow.swift:247` | Web has both `Scan again` (re-enters the same measurement mode, `FloorWorkspace.tsx:441-446`) and `Discard`. Native has `Scan again` only — no discard-without-save other than `Cancel`. |
| S12 | `Select Room Type` sheet after capture (residential/commercial, six common + See more) | **PARTIAL** | `src/lib/crm/livingArea.ts:56` `ROOM_TYPES`; `RoomDetailView.swift:250-259` `RoomTypePicker` | The vocabulary and the living-area rules exist and are persisted (`0030_living_area.sql`, `room_scans.room_type`). But it is **not prompted after a scan** — it is buried in the native room detail sheet, and there is **no web UI for it at all** (grep for `roomType` in `src/components` returns nothing). `ScanReview` offers quick *names* (`QUICK_NAMES`, `:171`), not types. |
| S13 | Commercial room-type vocabulary behind a segmented control | **ABSENT** | `livingArea.ts:56-115` | 18 residential/restoration types, one flat list, no segmentation. Extensible (text column, no CHECK) as the reference advises. |
| S14 | Each room re-calibrates; previous rooms retained in the session | **BUILT** | `RoomScanViewController.swift:44-53`; `RoomScanPlugin.swift:78` | Each `Add` presents a fresh controller and runs a new session, so calibration repeats. Retention exists in `Self.capturedRooms` with `removeScan`/`resetScans` housekeeping — but see S10, nothing consumes it. |
| S15 | `Configure Floor Plan` gate: Plumbing / Appliances / Furniture checkboxes, remember-my-choices | **ABSENT** | `RoomScanPlugin.swift:346` | No object categories are ever serialized, so there is nothing to filter. |
| S16 | Video consent modal, privacy-preserving option primary | **ABSENT** | — | No scan video is captured or stored anywhere. Not applicable rather than missing. |
| S17 | Result as an ordinary editable 2D room | **BUILT** | `src/components/admin/FloorPlan.tsx`; `Native/FloorPlanView.swift`; `FloorCanvas.tsx` | Drafting conventions are there: true-thickness wall bands (`FloorPlan.tsx:39` `T = 0.114`), openings cut out with jamb caps, three-line window symbol, **quarter-circle door swing arc** (`FloorPlan.tsx:196` → `Door`, `:383`), two dimension tiers on witness lines, scale bar (`:237`). Scanned and typed rooms converge on one `RoomScanResult` (`manualRoom.ts:74`). |
| S18 | 3D read-only result | **BUILT** | `ios/App/App/RoomModelViewController.swift`; `RoomSheet.tsx:152-167` | SceneKit orbit viewer with clamped elevation, Model I/O normal rebuild and planar UV projection (`:8-24`) — beyond what the reference describes. USDZ exported at capture time (`RoomScanPlugin.swift:217` `exportModel`, `.parametric`). **Caveat: only reachable from the web `RoomSheet`**, i.e. only inside a `WebScreen`; no SwiftUI entry point exists (`showModel` has no caller in `ios/App/App/Native/`). |
| S19 | Wall elevation view with ←/→ wall steppers | **ABSENT** | — | No elevation renderer in either front end. |

**BUILT 8 · PARTIAL 3 · ABSENT 8**

---

## 3. Editor and measurement — INT-E01..E34

The editor is Swift-only: `Native/PlanEditorView.swift` (gestures, chrome) over
`Native/PlanEditing.swift` (pure polygon maths), entered from
`RoomDetailView.swift:259`. There is no web plan editor — `FloorCanvas.tsx` only
selects and translates whole rooms.

| INT | Reference behaviour | Status | Where | Notes |
|---|---|---|---|---|
| E01 | Enter editor **at a floor** from the project's Floor Plans rail | **PARTIAL** | `src/app/(internal)/admin/projects/[id]/floors/[level]/page.tsx` → `FloorWorkspace`; `FloorPlanSection.tsx` | The rail and the floor route exist. But editing is entered **at a room**, not a floor: `RoomDetailView → PlanEditorView(room:)`. There is no floor-level selection depth. |
| E02 | View-mode enum (2D / 3D / Elevation) with `isAvailable(for:)` reasons | **ABSENT** | — | No view-mode control anywhere. |
| E03 | 3D read-only as a *mode* of the same canvas | **PARTIAL** | `RoomModelViewController.swift` | Exists as a separate modal USDZ viewer, not a view mode; web entry only (see S18). |
| E04 | In-editor floor switcher grid, current floor outlined | **PARTIAL** | `FloorPlanSection.tsx:25` `FLOOR_ORDER`; `src/lib/floorMemory.ts` | A floor rail exists on the project detail page, with device-local memory of floors created but not yet measured. Not reachable from inside the editor. |
| E05 | Add Floor from a fixed level vocabulary with a signed sort key | **PARTIAL** | `AddFloorPlan.tsx`; `FloorWorkspace.tsx:55` | Fixed list `["Basement","Ground","2nd","3rd","Attic"]`, hard-coded in four places (`FloorWorkspace.tsx:55`, `ScanStart.tsx:22`, `CaptureFlow.swift:39`, `FloorPlanSection.tsx:25`). No signed index, no "other floors" bucket, no rename. |
| E06 | Empty floor state, action bar derived from content | **BUILT** | `FloorWorkspace.tsx:320-330` | "Nothing measured on this floor" + a single `Add`. Matches the reference's derive-from-content rule. |
| E07 | One Insert vocabulary (Room / Object / Note / Photo / Form) attached to current selection | **PARTIAL** | `FloorWorkspace.tsx:389-399` | Sheet offers Room, Photo (`disabled`), Note (`disabled`). No Object, no Form. Photos/notes do exist, but on the room sheet (`RoomEvidence.tsx`), not via Insert. |
| E08 | Method chooser: Auto-Scan / Manual-Scan cards + Square / Draw / Filler rows | **PARTIAL** | `FloorWorkspace.tsx:160-185` `modes`; `CaptureFlow.swift:138-172` | Web: `lidar` (LiDAR gated on `roomScanSupport`), `corners` (`available: false`, "Coming next"), `manual`. Native: "Scan the room" / "Draw it instead". No template, no filler, no import. |
| E09 | `Select Room Type` **before** geometry, on every creation path | **ABSENT** | — | Type is never asked at creation on any path. See S12. |
| E10 | Draw Room modal sub-mode with its own undo stack, ghosted siblings | **PARTIAL** | `Native/RoomSketchView.swift` | Exists as a full-screen mode with its own history and the same canvas as the editor, but it starts from a **typed rectangle** (`stage = .size`, `:17`) rather than a blank drawing space. No sibling ghosting (nothing else is on the canvas). Web equivalent `ManualRoomEntry.tsx` is numeric-only. |
| E11 | Tap-to-place corner points, hollow-dot committed / blue 4-way active | **ABSENT** | `PlanEditing.swift:189` `addCorner` | No point-by-point polygon construction. Corners are only ever added by **splitting an existing edge at its midpoint**. |
| E12 | Cancel a draw → destructive-only confirm | **BUILT** | `PlanEditorView.swift:128-133`; `:89` | `confirmationDialog("Discard your changes?")` gated on `isDirty`, with `Discard` (destructive) / `Keep editing`. Adds the negative row the reference's popover omits — a defensible divergence. |
| E13 | `Add Square Room` template → parametric rectangle, `Set Size` gated on `isParametricRectangle` | **PARTIAL** | `manualRoom.ts:74` `makeRectangularRoom`; `RoomSketchView.swift:19-21` | Real dimensions are typed up front (better than a 2.5 m default), but there is no template/parametric flag, so nothing gates a `Set Size` re-entry — every room is an arbitrary polygon after creation. |
| E14 | `Set Size` → Change Measurement: active-wall highlight, custom keypad, live redraw, `Next`→`Apply` queue, `⊕ Laser` | **PARTIAL** | `PlanEditorView.swift:574-643` `LengthSheet` | Built: per-wall entry, current value shown, feet-and-inches parsing (`FloorPlanGeometry.parseFeetInches`), range validation (0.10–50 m), live redraw on Apply, and a live figure during drag (`:379` `liveLabel`). Missing: **system keyboard** (`.keyboardType(.numbersAndPunctuation)`, `:605`) not a custom pad; no wall queue / `Next`; no laser; the wall is highlighted on the canvas behind but the sheet is a `.presentationDetents([.height(300)])` sheet, not a panel over a live canvas. |
| E15 | `Change Unit…` picker, unit system + precision as one value per project | **ABSENT** | `FloorPlanGeometry.feetInches`; `manualRoom.ts:17` | Imperial is hard-coded end to end. Metres are the storage unit; feet-and-inches the only display format. |
| E16 | Metric / Feet / Inches with per-system precision ladders | **ABSENT** | — | — |
| E17 | `Next` commits + advances the queue, geometry redraws mid-wizard, padlock appears on commit | **ABSENT** | — | Single-wall sheet; no queue exists. (The padlock half of this **is** built — see E19.) |
| E18 | `Apply` ends the wizard and restores the prior selection | **BUILT** | `PlanEditorView.swift:114-127` | `onApply` calls `push()`, `PlanEditing.setEdgeLength`, `locked.insert(edge)`, and returns to the editor with the room still live. |
| E19 | **Padlock on manually set dimensions**; `isManuallySet` per dimension, provenance not equality | **BUILT** | `PlanEditorView.swift:39` `locked: Set<Int>`, `:230` 🔒 glyph, `:115-126`; `ScanPayload.swift:59` `lockedEdges`; `crm/roomScans.ts:171,201`; `api/v1/scans/[id]/route.ts:31-36` | Fully implemented and persisted into `room_scans.geometry.lockedEdges`. Goes **beyond** the reference: dragging a wall whose neighbour is locked raises a confirmation ("A wall next to this one was measured by hand…", `:134-149`, guard at `:351`) with an explicit unlock, and `LengthSheet` offers "Unlock — go back to the measured length" (`:623`). A drawn room locks every edge by construction (`ScanPayload.swift:119`). Set only by typed entry, never by drag — exactly the reference's rule. |
| E20 | `Edit Layout`: rigid move + rotate, dimensions hidden, action bar filtered | **PARTIAL** | `FloorWorkspace.tsx:333-360` "Arrange rooms"; `FloorCanvas.tsx:34-38`; `0027_room_positions.sql` | Translation only, web only, and it moves **whole rooms on a floor**, not a room within an editor. It is a mode (not a long-press) as the reference recommends, and positions persist (`plan_x`/`plan_y`, NULL ≠ 0,0). Native `LevelCanvas.swift:43` honours the positions but cannot set them. |
| E21 | Move / rotate manipulators | **PARTIAL** | as E20 | **No rotation anywhere.** Translation is a pointer drag with a grab offset (`FloorCanvas.tsx:43`). |
| E22 | Tap to select; siblings demote to outlines; per-wall dimension chains incl. sub-segments | **PARTIAL** | `FloorCanvas.tsx:15-19`, `:130`; `FloorPlan.tsx:208-236` | Selection zooms to the room and fades the rest (`zoomTo` in `floorLayout.ts`). Two dimension tiers exist — overall span outer, per-wall inner (`:213-235`) — but **no sub-segment chain around openings**, and the inner tier is dropped when `dense` (`:32`, merged floors). |
| E23 | Room inspector: 3-tab shell, stats tiles, Dimensions, Affected Areas, General, custom fields | **PARTIAL** | `src/components/admin/RoomSheet.tsx`; `Native/RoomDetailView.swift` | Built: 4 stat tiles (Floor / Walls / Perim. / Ceiling, `RoomSheet.tsx:145-150`), name, Affected Areas with `+ Add new area` and per-area sq ft (`:170-242`), moisture log, photos/notes (`RoomEvidence`), delete. Native adds room type and living %. Missing: the three-tab shell, ceiling-height stepper (ceiling is read-only, derived), room colour, custom fields, `+ New Field`. |
| E24 | Floor inspector with **interior / exterior wall thickness** as floor properties | **ABSENT** | `FloorPlan.tsx:35-39` | Wall thickness is a **drawing constant** (`const T = 0.114`, commented "2×4 partition + drywall"), used for rendering only and never in any measurement. There is no floor entity to hang it on. This is what makes spec §3's two ground-surface definitions uncomputable here. |
| E25 | Object library opens with cards gated by selection | **ABSENT** | — | No object catalogue. |
| E26 | Category drill-down keeps the gate | **ABSENT** | — | — |
| E27 | Selecting a room enables the library live | **ABSENT** | — | — |
| E28 | **Insert an object → auto-snap into a wall** (doors/windows as placeable openings) | **ABSENT** | `FloorPlan.tsx:140-203` (render only) | Doors and windows are **read-only detections**. `RoomScanResult.doors/windows/openings` come only from `CapturedRoom` (`RoomScanPlugin.swift:311`, `ScanPayload.swift:150`), and `makeRectangularRoom` sets all three to `[]` with a deliberate comment (`manualRoom.ts:92-96`). Nothing in either front end creates, moves, resizes or deletes an opening. Rendering is good (swing arc, jamb caps, window symbol); authoring does not exist. |
| E29 | Object dimension chain constrained to the host wall | **ABSENT** | — | — |
| E30 | Object inspector (Width / Height / Distance to Floor / Include in PDF) | **ABSENT** | — | — |
| E31 | Display Label enum with diagrams | **ABSENT** | — | — |
| E32 | `Replace with…` pre-filtered picker | **ABSENT** | — | — |
| E33 | Elevation gating with reason/hint subtitle | **ABSENT** | — | — |
| E34 | Elevation view: wall face, folded neighbours, segment chain, padlock carried across | **ABSENT** | — | — |

**BUILT 4 · PARTIAL 13 · ABSENT 17**

### Explicitly checked, as asked

- **Wall-length entry UI** — exists, Swift only, system keyboard, one wall at a time
  (`PlanEditorView.swift:574`). The reference's custom keypad and sequential walk are absent.
- **Dimension locking / provenance (`lockedEdges`)** — **fully built**, in Swift, in the API,
  and in the database blob. This is the single biggest correction to `AUDIT.md`.
- **Corner dragging** — built: `PlanEditorView.swift:381-388` (`case .corner`) →
  `PlanEditing.moveCorner`, quantised to 1 cm (`PlanEditing.swift:19`), with a live
  two-length label. `Add corner` (`:437-445`) and `Delete corner` (`:447-456`, refused below
  four corners) both work. Wall drag solves neighbour intersections properly
  (`PlanEditing.dragEdge`, `:95`) with a `translateEdge` fallback for near-parallel
  neighbours, snapping to collinear alignments and 5 cm multiples with hysteresis
  (`snapOffset`, `:283`), and self-intersection is signalled-not-blocked
  (`selfIntersects`, `:220`; Save disabled at `PlanEditorView.swift:110`).
- **Doors and windows placement** — absent. Detection and rendering only.

---

## 4. Measurement definitions

All storage is metres / m². Imperial is a presentation layer
(`roomScan.ts:620` `metersToFeet`, `:624` `squareMetersToSquareFeet`).

### What this codebase computes

| Figure | Definition in code | Where |
|---|---|---|
| **Floor area** | `Σ floors[].areaSquareMeters` | `roomScan.ts:270` `totalFloorAreaSquareMeters`; `ScanPayload.swift:170` |
| — source, scanned | `CapturedRoom.Surface.dimensions.x × dimensions.y` per floor surface | `RoomScanPlugin.swift:333`; `ScanPayload.swift:149` (both carry the comment that using `z` shipped once and gave every room zero area) |
| — source, typed | `width × length` | `manualRoom.ts:90` |
| — source, drawn/edited | absolute shoelace over the polygon | `ScanPayload.swift:100-108`; `PlanEditing.swift:253`; `crm/roomScans.ts:185-193` |
| **Perimeter** | `Σ walls[].lengthMeters` — a plain sum of RoomPlan wall-surface lengths, **not** a traced loop | `roomScan.ts:266` `totalWallLengthMeters`; `ScanPayload.swift:175` |
| — after a hand edit | `Σ` polygon edge lengths, written back to `wall_length_m` | `crm/roomScans.ts:191` |
| **Ceiling height** | `max(walls[].heightMeters)` — the **tallest** wall, explicitly not an average | `roomScan.ts:276`; `ScanPayload.swift:182` |
| **Opening area** | `Σ width × (height ?? 0)` over doors + windows + cased openings; a missing height deducts nothing | `roomScan.ts:281` `openingAreaSquareMeters` |
| **Wall area — gross** | `perimeter × ceilingHeight` | `roomScan.ts:303` |
| **Wall area — net** | `max(0, gross − openingArea)` | `roomScan.ts:304` |
| **Volume** | **not computed anywhere** | grep: no volume/m³ figure exists in `src/lib`, `src/components/admin` or `ios/App/App` |
| **Wall thickness** | a drawing constant `0.114 m`, never used in a measurement | `FloorPlan.tsx:39` |

Which figure is shown where: `FloorWorkspace.tsx:256` and `RoomSheet.tsx:71` display the
**net** wall area under the label "Walls"; `RoomScanner.tsx:582` (orphaned) is the only place
that prints gross alongside it. `ScanReview` shows Floor / Perimeter / Ceiling only.

Test coverage (`src/lib/roomScan.test.ts`) pins these against a real magicplan measurement
(their "1st bedroom", 5.205 × 3.300 m): floor 17.18 m² / 184.9 sq ft (`:121-123`), perimeter
17.01 m against magicplan's reported 17.00 m (`:126-128`), gross 41.66 m² (`:142`), net
= gross − 3.51 m² (`:145`), net floored at zero (`:148-156`), height-less opening deducts
nothing (`:158-168`), ceiling = tallest wall (`:170`).

### Against `spec.md` §3

magicplan's controlled room, 4.000 × 2.500 m, ceiling 2.440 m, interior walls 0.120 m,
exterior 0.250 m:

- **Ceiling perimeter 13.00 m** = `2 × (4.000 + 2.500)` — the interior clear perimeter at the
  ceiling.
- **Ground perimeter 12.10 m** — shorter, consistent with wall-base insets.
- **Walls without openings 29.52 m²** = `12.10 × 2.440` — derived from the **ground**
  perimeter.
- **Walls with openings 31.72 m²** = `13.00 × 2.440` — the ceiling perimeter × height.
  (`interactions-project.md:174` reports both figures for that room.)

This codebase's `totalWallLengthMeters` on that room would return **13.00 m**, and its
`gross` would return **31.72 m²** — i.e. it reproduces magicplan's *ceiling* perimeter and
its *"Walls with openings"* line exactly, and does not produce the 12.10 / 29.52 pair at all.
It cannot: the ground/ceiling distinction requires a wall thickness, and there is none in the
data model (see E24).

**This is a definitional difference, not a defect.** The two definitions answer different
questions:

- *Ground perimeter × height* (magicplan's `Walls without openings`) is a structural/appraisal
  figure — the wall area measured to the base of the wall, insets included.
- *Interior (ceiling) perimeter × height, net of openings* is what a painter, drywaller or
  baseboard installer buys. This codebase prices paint, drywall and baseboard
  (`RoomScanner.tsx:547-555` labels the tiles "Flooring, underlay" / "Paint, drywall" /
  "Baseboard, trim"), and for those trades the interior clear perimeter is the right choice —
  and the opening deduction, which magicplan's 29.52 does **not** apply, is a material
  improvement for that purpose.

**What a human should verify** (none of this is determinable from the code alone):

1. Whether `CapturedRoom.Surface.dimensions.x` on a wall is the length at the wall's **face**
   or at its **centre plane**. Every downstream figure inherits the answer, and Apple's
   documentation is the only source. Currently **unverified**.
2. That RoomPlan reports a wall broken by a doorway as two surfaces and that summing them
   does not double-count the jamb. `alignCollinearWalls` (`roomScan.ts:415`) assumes exactly
   this split (4° / 7 cm) for *drawing*, but `totalWallLengthMeters` sums the raw list
   regardless.
3. Whether baseboard should be priced on the summed wall list or on the closed polygon
   perimeter — these differ whenever the polygon does not close, and the code silently uses
   the former.
4. That the "Walls" tile users see is net, not gross, and that this is what the estimates
   consume. Gross is currently visible only in dead code.
5. Whether volume is needed for the report (magicplan reports it; this app does not compute
   it) and, if so, whether it is `floorArea × ceilingHeight` or the ANSI-clipped variant used
   for living area (`livingArea.ts:MIN_LIVING_HEIGHT_M`).
6. Whether magicplan's 29.52 m² really has no opening deduction. If it does, the comparison
   above is wrong and both numbers need re-deriving.

### One real inconsistency found while checking this

`saveEditedPolygon` (`crm/roomScans.ts:168-215`) recomputes `floor_area_sqm` and
`wall_length_m` from the corrected outline and writes `geometry.editedPolygon` **beside** the
original walls. The native renderer honours that (`FloorPlanGeometry.swift:48` — edited
polygon replaces the walls for drawing). The **web does not**:
`src/lib/roomScan.ts:toFloorPlan` never reads `editedPolygon`, and `FloorWorkspace.tsx:252-263`
and `RoomSheet.tsx:70-73` recompute totals from `room.geometry` rather than reading the
corrected `floor_area_sqm` / `wall_length_m` columns. So a room corrected on the phone shows
its **uncorrected** plan and totals in the web admin, while the database, the report and the
living-area endpoint (which read the columns) show the corrected ones. Verified by grep:
`editedPolygon` has no consumer in `src/`.

---

## 5. Migration `0024_room_scans`

**What it defines** (`supabase/migrations/0024_room_scans.sql`):

- `create table if not exists public.room_scans` — `id uuid pk default gen_random_uuid()`,
  `created_at`/`updated_at timestamptz default now()`,
  `project_id uuid not null references public.projects(id) on delete cascade`,
  `name text not null`, `level text not null default 'Ground'`,
  `position integer not null default 0`,
  `floor_area_sqm` / `wall_length_m` / `ceiling_height_m numeric not null default 0`,
  `door_count` / `window_count` / `stair_count integer not null default 0`,
  `geometry jsonb not null default '{}'::jsonb`, `notes text`.
- `create index if not exists room_scans_project_idx on public.room_scans (project_id, level, position)`.
- **RLS:** `alter table public.room_scans enable row level security;` followed by
  `grant all on public.room_scans to service_role;` — **and no policies are created.**

**Is that broken?** No, and it matches the repo's convention. RLS is enabled with zero
policies, so `anon` and `authenticated` can read nothing; the app reaches the table only
through `src/lib/crm/db.ts`, which builds the client with `SUPABASE_SERVICE_ROLE_KEY`
(`db.ts:12,20`) and therefore bypasses RLS. Only two migrations in the repo create policies
(`0015_projects.sql:131`, `0002_lead_photos.sql:28`), and both are for `storage.objects`,
which enforces RLS even for granted roles. `updated_at` has a default but **no trigger** —
every writer sets it explicitly (`roomScans.ts:132,211`).

**Later migrations that alter it:**

| Migration | Change |
|---|---|
| `0025_affected_areas.sql` | New table `affected_areas` with `room_scan_id ... on delete cascade`. |
| `0027_room_positions.sql` | `add column if not exists plan_x numeric, plan_y numeric`. |
| `0028_room_evidence.sql` | Adds `project_files.room_scan_id` FK → `room_scans` (cascade) + partial index. |
| `0029_drying_log.sql` | `moisture_readings.room_scan_id` FK → `room_scans` (cascade); equipment table likewise. |
| `0030_living_area.sql` | `add column if not exists room_type text, living_percent numeric check (0..100)`. |

Nothing drops, renames or retypes a column. Everything is `if not exists`, so the file is
idempotent and re-runnable.

**What would make it fail, or look like it failed** — in descending order of likelihood, from
the code's own diagnostics:

1. **PostgREST schema cache staleness, misreported as a missing table.** `isMissingTable`
   (`db.ts:54-65`) treats `42P01`, `PGRST205` **and `PGRST200`** as "missing table" and raises
   `MigrationPendingError` with the text the shipped app showed: *"The `room_scans` table is
   not reachable — run the migration in supabase/migrations, or reload Supabase's schema
   cache."* `PGRST200` is a **failed embed**, not a missing table. `listProjects`
   (`crm/projects.ts:203`) selects `"*, clients(...), project_files(...), room_scans(name,
   floor_area_sqm, geometry)"` — if PostgREST has not cached the `projects → room_scans`
   relationship, that embed fails and, in call sites that do not check `isEmbedFailure` first,
   surfaces as "table missing" on a table that exists. `db.ts:67-84` documents that this has
   already happened once. `listProjects` was subsequently hardened with an `isEmbedFailure`
   fallback to a plain `select("*")` (`projects.ts:207-212`); `listRoomScans`
   (`roomScans.ts:71`) and `getRoomScanProject` (`:148`) were **not**. Remedy is
   `notify pgrst, 'reload schema';`, which `supabase/RUN_ME_floor_plans.sql:15-19` already
   documents.
2. **`0015_projects.sql` not applied.** The `references public.projects(id)` would abort the
   whole file. `0024` has no ordering guard beyond its number.
3. **`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` unset on the deployment.** `db()` returns
   `null` (`db.ts:18`), `requireDb()` throws "Database is not configured" — a *different*
   message, so this is distinguishable. `GET /api/v1/health` (`src/app/api/v1/health/route.ts`)
   reports env presence, table presence and per-column presence, including
   `room_scans.plan_x` for `0027`.
4. **`gen_random_uuid()` unavailable** — needs `pgcrypto`/pg13+. Not enabled by this file;
   assumed from earlier migrations.
5. **Being skipped by the operator.** There is no migration runner in the repo — no
   `supabase/config.toml`, no CLI, no npm script (`package.json` scripts are
   dev/build/start/lint/test/leads:export). Application is manual, via the Supabase SQL
   editor, using `supabase/RUN_ME_floor_plans.sql` (0023–0030 concatenated). Skipping the
   later half of that paste is the most likely way to get a table that exists without
   `plan_x`, `room_type` or `living_percent` — which `/api/v1/health`'s `COLUMNS` list exists
   precisely to catch.

Nothing was executed to produce this section.

---

## 6. Corrections to `docs/renovision/AUDIT.md`

The audit is dated 14 Aug 2026 and describes a shipped build. The source is ahead of it. Ten
claims are now wrong or need qualifying.

1. **§0 "the backend is broken … `room_scans` missing."**
   Qualify. The migration file is present and correct (§5). The banner text is produced by
   `MigrationPendingError`, which fires on `PGRST200` — a *failed embed* — as well as on a
   genuinely absent table (`db.ts:54-65`, and see the class's own comment at `:67-76`, which
   records this exact misdiagnosis). Before running anything, check
   `GET /api/v1/health`; the fix may be `notify pgrst, 'reload schema';` rather than a
   migration.

2. **§0 "The queue message is also misleading … attributes the failure to *no signal*."**
   Still true as UI copy (`FloorWorkspace.tsx:293-297`), but the *logic* already
   distinguishes the two cases: `saveScanResilient` only queues when `isOffline(error)`
   (`scanQueue.ts:36-48,133`) and re-throws a server refusal, and `flushScans` drops a scan
   the server rejected on its merits rather than retrying forever (`:173-179`). The bug is
   the sentence, not the mechanism.

3. **§2 "Projects list … No filters, no per-row actions, no archive."**
   Wrong on filters and archive. `src/app/(internal)/admin/projects/page.tsx:27-34,75-81`
   reads a `status` search param, renders All + per-status chips from `PROJECT_STATUSES`, and
   excludes archived by default (`projects.ts:198` `.neq("status","archived")`). Per-row
   actions are still absent; `ProjectStatusPill` is display-only.

4. **§2 "Project detail … No photos, no files, no floor concept surfaced."**
   Wrong. `projects/[id]/page.tsx` imports and renders `FloorPlanSection` (`:232`, a floors
   rail over `FLOOR_ORDER` with device-local memory of unmeasured floors), `ProjectFiles`
   (`:317`), `EquipmentLog` (`:257`) and a Report section (`:242`). Room-scoped photos and
   notes exist too (`RoomEvidence.tsx`, `0028_room_evidence.sql`).

5. **§2 "Living Area placeholder."**
   Wrong. Implemented end to end: `0030_living_area.sql`, `src/lib/crm/livingArea.ts` (ANSI
   Z765, `MIN_LIVING_HEIGHT_M = 7 × 0.3048` derived not typed, 18 room types with above /
   below / excluded bands and per-room overrides), `GET|PATCH /api/v1/living-area`, tested in
   `livingArea.test.ts`, surfaced natively in `LevelCanvas.swift:177` `LivingAreaCard` and
   `ProjectsView.swift:208`. Still **absent from the web UI** — no component references it.

6. **§2 / §4.4 "Dimension provenance — no locked-vs-derived distinction, so there is nothing
   to drive 'only manually-set dimensions' in a report."**
   Wrong. `lockedEdges` is built, rendered as a 🔒 glyph, defended against destructive drags,
   unlockable, and persisted: `PlanEditorView.swift:39,115-126,134-149,230,351`,
   `ScanPayload.swift:59,119`, `API.swift:441-453`, `api/v1/scans/[id]/route.ts:31-36`,
   `crm/roomScans.ts:171,201`. What is still missing is the *export option* that consumes it.

7. **§2 "Shape editor … Partial. Missing: … room move/rotate."**
   Partly wrong. Room **move** exists (`FloorWorkspace` "Arrange rooms" →
   `FloorCanvas.onPlace` → `plan_x`/`plan_y`, `0027_room_positions.sql`). **Rotate** is still
   absent. Multi-room shared walls still absent.

8. **§2 "3D / Elevation: None found."**
   Half wrong. 3D exists and is substantial: `RoomModelViewController.swift` (SceneKit orbit,
   Model I/O normal rebuild, planar UVs, clamped elevation), fed by
   `RoomScanPlugin.exportModel` (`.parametric` USDZ) and reached from `RoomSheet.tsx:152-167`.
   The audit could not see it because it is only reachable inside a `WebScreen`. Elevation is
   correctly reported as absent.

9. **§2 "Export: Unknown. Entry point exists."**
   Resolvable now: `projects/[id]/report/page.tsx` renders
   `src/components/admin/ReportDocument.tsx` with typed `ReportRoom`s; `PrintButton.tsx` and
   `ios/App/App/Native/ReportShare.swift` complete the path. Not five export types, no page
   layout, no title block.

10. **§5 "Not verified: the camera scan path … biggest hole in this audit."**
    Answerable from source without a device. The capture UI is Apple's `RoomCaptureView`
    presented full-screen by `RoomScanViewController` (116 lines: session lifecycle plus a
    Cancel and a Done capsule button). There is **no hand-built HUD**: no mini-map (S04), no
    in-capture incompleteness warning (S07), no object rail (S06), no room-type prompt at
    capture (S12). Everything the operator sees while walking is Apple's.

11. **§5 "Corner dragging and `Add corner` — controls seen, behaviour not exercised."**
    Determinable from source: both are implemented, with quantisation, snapping with
    hysteresis, undo/redo, and self-intersection signalling. See §3, "Explicitly checked".

12. **§4 gap 6 "Verify the measurement formulas … `rv-11` reports Perimeter 44 ft for a
    12×10 room — that is the ceiling perimeter."**
    The observation is correct and the code confirms it (`roomScan.ts:266`), but the framing
    ("silent-wrong territory") should be softened — see §4. For paint, drywall and baseboard
    the interior perimeter is the defensible choice; what is genuinely missing is that the
    app never *states* which definition it used, and never computes volume.

Not contradicted, and still accurate: §1's product framing; §3's list of genuine advantages;
§6's correction about the "NAME THIS ROOM" screenshot being RenoVision's own.

---

## 7. Genuine gaps

Ranked. Each is something the code demonstrably does not do.

1. **`mergeScans` is dead code.** `StructureBuilder` multi-room stitching is fully
   implemented in `RoomScanPlugin.swift:119-148`, and its only caller is
   `RoomScanner.tsx:121`, a component no route mounts. Every floor plan in the shipped
   product is therefore shelf-packed with an explicit disclaimer
   (`floorLayout.ts:1-17`) when the real registration is already written and paid for. This
   is the highest-value fix in the repo: wire `mergeScans` into `FloorWorkspace` or
   `CaptureFlow`, or delete the plugin methods and the orphan file.

2. **Edited plans do not reach the web.** `toFloorPlan` ignores `geometry.editedPolygon`, and
   `FloorWorkspace`/`RoomSheet` recompute totals from `geometry` rather than reading the
   corrected `floor_area_sqm`/`wall_length_m` columns. A room corrected on the phone shows
   two different sets of numbers depending on which screen you are on. See §4.

3. **No doors or windows can be authored.** Openings exist only as RoomPlan detections. A
   typed or drawn room has none by construction (`manualRoom.ts:92-96`,
   `ScanPayload.swift:110-114`), so its **net wall area equals its gross** — the paint figure
   for every non-LiDAR room is systematically high by one door and one window. Four door
   types and three window types would close this.

4. **In-capture feedback (INT-S04, INT-S07).** No mini-map, no pose cursor, no open-polygon
   warning while the operator is still in the room. `RoomScanViewController` implements no
   `didUpdate` delegate method, so there is no live geometry stream to build either from.
   The reference singles out the mini-map as the best idea in magicplan's scan.

5. **The review sheet never attempts closure.** `chainIntoPolygon` returns `[]` rather than
   inferring a closing edge, so an incompletely walked room is drawn as loose walls with no
   fill and no indication of which edge is missing — where magicplan closes it and dashes the
   guess (INT-S09).

6. **Room type is not asked at capture, and has no web UI.** The rules engine is complete and
   drives living area; the only way to set the input is a sheet three taps into the native
   room detail (`RoomDetailView.swift:250`). Every scanned room defaults to `other`
   (`livingArea.ts:roomTypeRule` falls through to the last entry), so living area silently
   counts basements at 100% until someone classifies them by hand.

7. **No volume, and no wall thickness.** magicplan reports both; this app computes neither
   (§4). Without a wall thickness there is no way to produce the ground-vs-ceiling perimeter
   pair, the "ground surface with all walls" figure, or an interior/exterior wall
   distinction — and no floor entity to store it on.

8. **The measurement definitions are never stated in the product.** `spec.md` §3's `(i)`
   definitions are the thing that makes magicplan's figures defensible in a dispute. This app
   has one such definition (`LIVING_AREA_DEFINITION`, shipped with the living-area response)
   and none for floor area, perimeter or wall area. Given the divergence in §4, saying which
   definition was used is worth more here than matching magicplan's.

9. **Wall-length entry is a system-keyboard sheet.** No custom keypad, no wall-by-wall
   `Next`→`Apply` queue, no live panel over a live canvas, no laser input (INT-E14).

10. **No elevation view (INT-S19 / INT-E33-34), no view-mode axis (INT-E02), no room
    rotation (INT-E21), no object catalogue (INT-E25-E32), no unit picker (INT-E15-16).**
    Correctly deferred; listed for completeness.

11. **The floor vocabulary is hard-coded in four places** — `FloorWorkspace.tsx:55`,
    `ScanStart.tsx:22`, `CaptureFlow.swift:39`, `FloorPlanSection.tsx:25` — with no signed
    level index and no rename. Adding "4th" means editing four files in two languages.

12. **`listRoomScans` and `getRoomScanProject` have no `isEmbedFailure` fallback.**
    `listProjects` was hardened after the schema-cache incident (`projects.ts:207-212`); the
    two room-scan readers were not, so a stale cache still surfaces there as "run the
    migration" (§5, item 1).

13. **`RoomScanner.tsx` (667 lines) is unreferenced.** It is the last consumer of
    `mergeScans`, `removeScanAt`, `resetScans` and the gross-wall-area display. Either it is
    the design intent for multi-room and should be revived, or it is stale and should go —
    leaving it is how the merge feature stays invisible.
