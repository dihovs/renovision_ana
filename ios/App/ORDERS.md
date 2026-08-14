
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
