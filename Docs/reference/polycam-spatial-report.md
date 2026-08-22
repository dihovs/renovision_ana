# Polycam's Spatial Report — read against ours

**Source:** `[Polycam Spatial Report] 2026-08-22.pdf`, 10 pages, the owner's own
condo at 2930 Rue Frégault, Laval. Scanned and exported 22 Aug 2026, sent by him
the same day: *"let's see if there is anything we can borrow and implement with
whatever we have and make it better."*

**Read as text with PDFKit**, per `Docs/reference/CAPTURE-PROTOCOL.md`. This is
the second real vendor artefact this project has — `Report-Estimate-Blueprint.md`
is reverse-engineered from his magicplan export, and the same rule applies: a
real export beats any observation of a UI.

**One caveat that shapes everything below.** It is the free sample tier. Every
table has its headers and its row labels and **no values** — "Sample only.
Upgrade to Polycam's Business Plan." So this document is evidence of *what they
report*, never of *what their numbers are*. No figure here can be checked
against ours.

---

## 1. Structure

1. **Overview** — total exterior floor area, total livable floor area, total
   wall area, total window area, total volume, total perimeter in rooms, and
   **latitude / longitude / altitude**. Room names listed beside it.
2. **Table of contents** with page numbers per room.
3. **A whole-project summary table** — one row per room: floor area, wall area,
   dimensions, perimeter, ceiling height, room volume.
4. **Per-room sections** — floor plan, Overview block, then schedules by
   category: Furniture, Fixtures, Appliances, Openings, and casing lengths.
5. **A legal disclaimer** on page 1: estimates, informational purposes, verify
   independently, not liable.

## 2. Worth borrowing, best first

### 2.1 Numbered callouts keyed to schedule tables — the best idea in it

Every object on the room plan carries a number, and each number is a row in a
table below with `W (m) H (m) D (m)`. `1 Chair · 2 Chair · 3 Dining chair …`,
`1 Cabinet … 9 Cabinet`, `1 Dishwasher · 2 Fridge · 3 Oven · 4 Stove`.

**This is what makes an object list checkable.** A takeoff that says "Cabinet ×
9" is a claim; a plan with nine numbered cabinets on it is the same claim with
its working shown, and an adjuster can count them. We now have both halves — the
report draws room plans (`ReportStoreyPlan.tsx`, `PlanObjects.tsx`) and S9 has an
objects takeoff — and no join between them. The number IS the join.

### 2.2 The plan repeats on every continued page

Pages 4, 5, 6 and 7 are all the Kitchen, each carrying the same floor plan
because the schedules spill across four pages. Trivially cheap, and it means a
row of numbers is never on a page without its key. Our report already had a
17-sections-printing-as-19-sheets problem; whatever solves pagination should
carry the plan forward the same way.

### 2.3 Casing lengths — a trim takeoff we do not have

> *Total casing lengths. Calculated from casing width entered in settings:
> Window casing width = 4 cm. Door casing width = 4 cm. L (m). Windows. Doors.*

Linear metres of door casing and window casing, from a **settable** casing
width. We already do baseboard length (`ORD-34/35`); casing is the same family
and the same kind of line on an estimate. It falls straight out of geometry we
already hold — every opening's width and height are known — so this is arithmetic
plus one setting, not a feature.

### 2.4 Inscribed dimensions

They print two rectangles per room: **bounding box** (smallest rectangle
containing the room) and **inscribed** (largest rectangle that fits inside it).
`ORD-23` gave us the bounding box already. Inscribed is the one we lack, and it
is arguably worth more to this trade than to theirs: it is the clear rectangle
that air movers and dehumidifiers actually have to stand in.

### 2.5 Schedules grouped with counts

`Furniture — Chair x 2, Dining chair x 4, Dining table x 1, Side table x 1`.
`Fixtures — Cabinet x 9`. `Appliances — Dishwasher x 1, Fridge x 1 …`.
`Openings — Window x 1, Door x 5`, with `W (m) H (m) Area (m²)` per opening.

This validates S9's Objects tab as designed and hands us their exact grouping and
wording for free. Note the openings schedule carries **area per opening** — which
is the number that came off net wall area, itemised, and therefore the number an
adjuster would want to see rather than take on trust.

### 2.6 Coordinates and a disclaimer

Latitude, longitude and altitude in the overview. We already capture a real map
location (`Project Location`, MapKit), so printing the coordinates is a display
change, and on an insurance file it is evidence of where the work was.

The disclaimer is worth having for the same reason — a report that states its own
accuracy scope is stronger in a dispute than one that implies certainty.

## 3. Deliberately NOT borrowing

**Their wall-area naming, which is the trap `HANDOFF.md` §3 already flags.**
They print `Wall area (incl. openings)` and `Wall area (excl. openings)`. That is
the same reversal magicplan makes with "walls with openings / without openings",
and read the wrong way it is a several-square-metre error on a small room. Our
`{gross, net}` stays. **This is now the second independent vendor to name it
confusingly**, which strengthens the existing decision rather than reopening it.

Their category assignments are also loose — a TV filed under Appliances — and
ours are better suited to a claim.

## 4. The finding that matters most, and it is not about the report

Their schedules distinguish **Cabinet** (nine of them), **Dining chair** from
**Chair**, **Sofa double** from **Sofa extension**, **Side table**, and **Oven**
from **Stove**.

**RoomPlan cannot make any of those distinctions.** Its object categories are
sixteen coarse ones — `storage`, `table`, `chair`, `sofa`, `refrigerator`,
`stove`, `oven`, `dishwasher`, `sink`, `washerDryer`, `toilet`, `bathtub`,
`bed`, `television`, `fireplace`, `stairs` — with **no cabinet at all**;
`ScanCatalogue.read` maps `.storage` to the question-mark case precisely because
a linen closet, a bookcase and a kitchen pantry all arrive there together.

So **Polycam is not using RoomPlan's object detection. They trained their own.**

Two consequences, and they are the answer to the owner's *"do we need a vision
AI API?"* question:

1. **His dishwasher miss is real and fixable in principle** — Polycam found one
   in the same kitchen. It is not a law of physics.
2. **Closing that gap means a custom detection model, not an API call on a
   photo.** A general vision model can label a frame; it cannot place a
   dishwasher in 3D with a measured footprint, which is the part that makes an
   object useful here. That is a different and much larger project than it
   sounds, and it competes directly with the cheap answer already specified:
   a per-room-type expected-fixtures checklist (`Docs/Guided-Protocol-Spec.md`),
   which catches every miss rather than the ones a model happens to get, works
   with no signal in a basement, and costs nothing per job.

## 5. Suggested order, if he wants these

1. **Numbered callouts + schedules** (§2.1, §2.5) — biggest gain, uses only what
   is already built, and makes the objects work visible in the deliverable.
2. **Casing lengths** (§2.3) — arithmetic plus one setting.
3. **Plan repeated on continued pages** (§2.2) — pagination work anyway.
4. **Inscribed dimensions** (§2.4) — a real geometry job, and the one item here
   that wants tests on the TypeScript side first, like every other measure.
5. **Coordinates and disclaimer** (§2.6) — cosmetic, do it while in the file.
