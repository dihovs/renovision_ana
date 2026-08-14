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
