# Floor plan vs magicplan — gap audit (5 Nov 2026)

Source of truth for magicplan's rules: `~/Developer/magicplan-study/extracted/POLYGON_LOGIC.md`
(read out of their compiled Android app, with the exact numbers) plus their demo `plan.xml`
files, and the observed-behaviour docs in `Docs/reference/magicplan/`. We hold **no magicplan
source code**. We take ideas and numbers, never code or artwork.

## The one big difference: walls

magicplan builds **one wall graph per floor**:
- every wall has two faces;
- each face belongs to a room;
- shared end points ("axis points") join the walls.

Rooms are stored as inside outlines, like ours (`<floorRoom>` + `<point>`). The walls are
*rebuilt* from them by a pipeline:
1. exterior walls;
2. smoothing;
3. fixing holes;
4. dropping inconsistent walls;
5. finding the axis points;
6. assigning each face to a room;
7. attaching the doors;
8. clamping them.

A room's corner is where the two face lines cross, so it is calculated and never stored.

Ours: each room draws its own wall bands every frame. Whether an edge is shared is guessed by
probing 2 cm outside it (`StoreyViewport.swift:282-399`). Every overlap and notch bug we fixed
this week comes from this.

What follows from it:
1. **Snapped rooms touch with no wall between them.** Flush snap puts two rooms' inside lines
   on the same line (`StoreyArranging.swift:155`, `LevelCanvas.swift:3023`). magicplan keeps one
   wall thickness between them. As a result:
   - the shared wall eats 57 mm of each floor;
   - the building measures 114 mm short per partition.
2. **Partitions get drawn twice.** Rooms 2–16 cm apart each draw a full wall. That gives up to
   double thickness, poking into the neighbour.
3. **Corners only know their own room.** An outside wall next to a shared one still runs on
   into the neighbour. Where an edge changes from shared to outside partway along, you get a
   step.
4. **Thickness is one constant.** 0.114 is hard-coded in 7 renderers. magicplan has an interior
   width (0.12) and an exterior width (0.25) on the plan. Door holes always cut 0.208 m.

## Drawing / scanning a room

| magicplan | ours |
|---|---|
| 90° / 45° / 135° aim hint relative to the **previous wall** (0.2 coarse, 0.05 fine, wall ≥ 0.3) | none. Draw snaps to page axes + a 5 cm grid. |
| On close: whole room squared together (least squares) | drawn and AR rooms are never fitted; "Square" is a manual button |
| Snap tolerance by corner type: 3.5° straight, 7° normal, 15° / 20° door/short | one flat 10° for all, which flattens real 8° bends |
| Every wall keeps its measured length (weight 100; door openings 250) | length is held only for locked walls; sizes can drift |
| Wall under 0.3 m → angle clamped to ±90° | missing |
| Close only if area > 1 m² and both end turns > 75°, or within 0.2 m of the first corner | any 3 corners, or within 0.25 m |
| Guessed (bridge) edges marked SUGGESTED; failures IMPOSSIBLE / TIMEOUT | known inside WallChain, then thrown away (`ScanPayload.swift:651`); failures silent |
| Scans: chain first, then solve the whole room | each wall is turned to the page first (`squareNearlySquare`), then chained |

Other number differences, where theirs is the reference value:
- corner-link angle: 3° here vs our 25°;
- extension limit: 10 m vs 0.6 m;
- continuation sideways limit: 0.01 vs 0.08;
- search budget: 10k vs 20k.

## Editor

1. **A padlocked wall can be changed without a warning.** This happens through:
   - a corner drag;
   - Add Corner;
   - Bump Out;
   - Curve;
   - Split Room, which also drops every padlock.
2. **Undo has gaps.**
   - Object and area changes can't be undone.
   - The floor-view undo is a stub (`LevelCanvas.swift:2673`).
3. **Add Corner goes to the wall's midpoint, not the tap** (`PlanEditing.swift:620`).
4. **Corner drag has only a square snap.** There are no guide lines and no snapping to other
   corners or rooms.
5. **Draw Room:** no Redo, and a placed corner can't be dragged.
6. **The dimension chain drops the short piece beside a door** (`OpeningGlyphs.swift:329`).
7. **No Set Diagonal.** It has to be confirmed in magicplan first.
8. **Export:** Sketch PDF, 3D and Statistics are greyed out even though the files exist
   (`PlanFiles.swift`). The phone has no report options and no share link.
9. **Photos can't be moved** to another room.
10. **No warning when rooms overlap.**
11. **No magnifier.** It isn't in our research either, so it has to be captured from magicplan
    first.

`Docs/REFERENCE-STATUS.md` is stale: it lists units, keypad, objects, elevation, Edit Layout and
laser as missing, and all of them are built.

## Order to build

| Phase | What | Why first |
|---|---|---|
| 1 | Wall graph per floor: interior and exterior widths, one wall per shared pair centred in the gap, corners from crossing face lines, flush snap that leaves one wall thickness | fixes the whole family of overlap/notch bugs and the wrong building size |
| 2 | Drawing: 90/45/135 hint, square the whole room on close with magicplan's tolerances and length weights, close rule | every drawn room comes out square without the button |
| 3 | Editor safety: padlock confirm everywhere, full undo (objects + floor view), Add Corner at the tap | stops silent changes to measured walls |
| 4 | Scans: chain then solve, show guessed edges dashed, report failures | |
| 5 | Corner-drag guides, dimension pieces beside doors, overlap warning, export rows, move photos | |

Each phase gets geometry tests in `ios/FloorPlanCore/Tests`, one per rule in the study's
"ideas to test" list.
