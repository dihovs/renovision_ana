# Floor-plan spec — the remaining plan

The owner, 4 Nov 2026: *"Do it all, make a plan and go step by step."*
Source of truth: `Docs/vinsnipe-floor-plan-spec.md`. Core maths:
`ios/FloorPlanCore` (`swift test`). App bridge: `ios/App/App/Native/PlanBridge.swift`.

Each step: build → test → install on his iPhone → commit (prefix = step id) →
next. Pushed at the end of each lettered group.

## Done — all of it, 3–4 Nov 2026 (builds 220–233, branch mobile-app)
M1 core model · M2 drawing rules · M3 Square · M4 openings · M5 curved walls ·
M6 ceilings · M7 rooms side by side · M8 Manual-Scan (AR corners) ·
A1–A4 · B1–B3 (M9 laser) · C1–C4 (M10 exports) · D1–D3 (M11 LiDAR outline) ·
E1–E3 (M12 import, undo audit, notes).

FloorPlanCore: `swift test` — 75 tests, the spec's T1–T17 among them.

## Still open, deliberately
- Every build since 227 was installed blind or not at all: the owner's iPhone
  was unavailable from the M8 build on. Nothing from M8 onward has been
  tried on a screen.
- Leica DISTO driver is UNVERIFIED (community UUIDs); Bosch GLM absent
  (protocol unpublished). Confirm a reading against a tape first.
- Openings on a curved wall cut its chord, not its arc.
- The app's room-drag snap still only slides; the core's turn-to-square
  is not applied (turning a room rewrites its outline here).
- Scans before 4 Nov keep the old outline chain on phone and web; scans
  since carry the M11 outline. Old scans with a raw capture
  (room_scan_captures, since step 1) could be re-run — not done.
- Imported shaped ceilings come in flat at their average height.
- IFC4 export: v2 per the spec.

## A — finish what M5–M7 left open
- **A1** Storey canvas + room thumbnails draw curved walls; storey shows
  bulkheads and ridges.
- **A2** Web plan drawing (`FloorPlan.tsx`, report) draws curved walls from
  `edgeBulge`.
- **A3** Elevation view follows sloped / vaulted / bulkhead ceilings.
- **A4** Shared walls shown on the storey; a locked length carried across a
  shared wall to the neighbour's copy.

## B — M9 laser meter (spec §13, T14)
- **B1** `LaserMeterDriver` protocol, reading parse/validate (0 < m ≤ 200),
  simulator driver; core test T14 (assignment + auto-advance + imperial).
- **B2** CoreBluetooth manager: scan by driver service UUIDs, RSSI list,
  connect, notify, remember the peripheral.
- **B3** Plan editor: reading → selected wall's locked length, advance to the
  next wall CCW; pending-readings tray; undo.
- Vendor drivers need each maker's GATT documentation (spec open question 3) —
  shipped as the simulator plus any vendor that can be verified.

## C — M10 exports (spec §14)
- **C1** DXF (R2000, mm, layers, LWPOLYLINE with bulge — T8's 0.2500).
- **C2** SVG (1 unit = 1 mm) and CSV/JSON room tables.
- **C3** glTF 2.0 (walls extruded to the ceiling, openings cut), USDZ via
  ModelIO where available.
- **C4** Share sheet on the floor view. IFC4 deferred (spec: v2 priority).

## D — M11 RoomPlan into the same model (spec §8)
- **D1** Wall chaining → closed polygon: cheapest closed chain with bridge
  ("suggested") edges, from Docs/magicplan study + spec `vertexSnap`.
- **D2** Then the M3 solver with every length unlocked.
- **D3** The roomOutline scorecard (`src/lib/roomOutline.*`): the four
  `it.fails` targets must pass; re-run old scans from `room_scan_captures`.

## E — M12 persistence and polish (spec §2)
- **E1** Native JSON project export/import (the Codable model).
- **E2** Undo/redo audit across every new edit.
- **E3** Final pass: demo icons off by default, handoff notes updated.
