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
| **S2** | Wall inspector | NOT STARTED | S1 | `PlanEditorView.swift`, new `WallDetailView.swift` |
| **S3** | Affected areas — freehand drawing | NOT STARTED | — | `FloorPlanView.swift`, `PlanEditing.swift` |
| **S4** | Affected areas — remaining parity | NOT STARTED | S1 | `FloorPlanView.swift`, `AffectedAreaSheet` |
| **S5** | Plan editor parity | NOT STARTED | — | `PlanEditorView.swift`, `EditorChrome.swift` |
| **S6** | Photo editor — blur first | NOT STARTED | — | new `PhotoEditor*.swift` |
| **S7** | Video and 360 capture | NOT STARTED | S6 | `RoomPhotosSection`, API, migration |
| **S8** | Objects — doors, windows, catalogue | NOT STARTED | S5 | `OpeningGlyphs.swift`, `PlanEditing.swift` |
| **S9** | Statistics and takeoff | NOT STARTED | S1 | `Measure`, `measureDefinitions.ts` |
| **S10** | Report parity | NOT STARTED | S9 | `ReportDocument.tsx` |
| **S11** | Commercial room types | **BLOCKED** | owner input | `livingArea.ts`, `CaptureFlow.swift` |
| **S12** | Project and floor screens | NOT STARTED | — | `ProjectsView.swift`, `LevelCanvas.swift` |
| **S13** | Icon set | NOT STARTED | — | new `Glyphs.swift` |

**Two verifications** were folded into the sections that own them: the
dimension-tap unlock into **S5**, the project-card plan into **S12**. The
project-card plan was confirmed 17 Aug 2026, incidentally, while checking S1 —
"My Condo"'s card draws correctly. The dimension-tap unlock is still open.

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

---

## S4 — Affected areas, remaining parity

**Read.** `object-model.md` §2b, the area inspector table.

**In scope.** `Show Dimensions` per area; photos and notes attached to the *area*
rather than only its room; Fill Color as a full swatch matrix with Reset; the
area's own row layout — swatch · name / *surface* · area · expand glyph.

**Keep.** Our damage-cause chips. magicplan has only name + colour; cause decides
trade and rate here.

---

## S5 — Plan editor parity

**In scope.**
- **Verify the dimension tap** opens the measurement panel with `Unlock`. Built,
  never seen working. The string is drawn **10pt beyond** its dimension line, not
  on it — that off-by-10 has already broken this twice.
- **ORD-23** — the overall bounding dimension line, outboard of the per-wall
  ones. Without it a non-rectangular room cannot answer "how deep is it".
- **ORD-31** — live edge dimensions while dragging, in the plan editor. The area
  editor has them; this does not.
- Set Size should **hide** on a non-rectangular room, not grey — the reference
  removes it and restores it when the room is a rectangle again.

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

---

## S12 — Project and floor screens

**In scope.** Verify **the project card draws a plan** (was a stale PostgREST
cache plus a `largest_room` embed falling back — should be fixed, never
confirmed). The address card rendered as a map. Collection rails that **state
their sort order** — "Sorted by floor level", "Sorted by last modified" — which
on a 39-photo job is the difference between finding a photo and scrolling. Floor
sheet parity, including the per-level wall-thickness override that the data model
already supports but no screen can set.

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
