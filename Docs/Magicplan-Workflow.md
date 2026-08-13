# Magicplan's workflow, as observed

Studied directly in their web app (cloud.magicplan.app) and iOS app, on
Renovision's own account, August 2026. This is what they actually do — not a
guess from marketing pages.

## The object model

```
Workspace
  └ Project            ← the property + the claim
      ├ Floor          ← "Ground Floor", "2nd Floor", "Basement • Level 1"
      │   └ Room       ← scanned or drawn; has its own geometry + info
      │       └ Affected Area   ← the damaged region, priced separately
      ├ Photos         ← tagged "2nd Floor • 3rd bedroom"
      ├ Files          ← the generated PDF report lives here
      └ Forms          ← SOPs / checklists per project
```

Two things to note. A **floor is a real container**, not a label — you add one
before you can add a room, and rooms are always inside one. And an **affected
area belongs to a room or a wall**, which is what makes damage priceable
separately from the room that contains it.

## Add a room: five methods, only two need LiDAR

From Insert → Room:

| Method | Needs LiDAR | What it is |
|---|---|---|
| Auto-Scan | yes | Walk several rooms, automatic object detection |
| Manual-Scan | yes | One room, manual object placement |
| Add Square Room | no | Start from a rectangle, then reshape |
| Draw Room | no | Tap each corner to build the polygon |
| Import & Draw | no | Trace over a photo of an existing plan |

The Insert menu also offers **Object, Note, Photo, Form** — a room is one of
five things that can be placed on a floor, not the only thing.

**Manual-Scan is the important one for us.** Point the phone at a floor
corner, hold; a ring fills to confirm the corner is captured; walk corner to
corner tracing the room; at the end, raise the pointer from the last corner to
the ceiling to capture height. That is ARKit raycasting, not LiDAR — it works
on every non-Pro iPhone, which is most of them.

## Statistics: what they actually compute

Per floor and per room, from the room detail sheet:

- Surface with walls / without walls / with interior walls
- Above grade, below grade, and total living area
- **Walls with openings** and **walls without openings** — the headline "Wall
  Area" is the SECOND one. Doors and windows are deducted. (Their example:
  252 m² gross, 35.9 m² doors, 3.76 m² windows, 213 m² net.)
- Exterior perimeter
- Volume
- Counts: floors, rooms, doors, windows

Per room the sheet leads with four figures — **Floor Area, Wall Area,
Perimeter, Volume** — then Ceiling Height and Living Area (%), then Affected
Areas, then General (floor, room type, room name, room colour).

## The floor plan is interactive

Tapping a room zooms to it, greys out every other room, and opens its detail
sheet. Deselected, the plan shows the whole floor with each room's name and
area written inside it and no dimensions. Selected, the room gets full
dimension tiers on all four sides with witness lines and corner handles.

Two distinct drawing states, not one plan with a highlight.

## Claim Details — the restoration/insurance field set

Their default field set for restoration and adjusting firms, applied at
**Project** level. This is IICRC S500 vocabulary and it is what an adjuster
expects to see:

| Field | Type | Options |
|---|---|---|
| Front View Photo | Photo | |
| Job Number | Text | |
| Carrier Name | Text | |
| Insurance Claim Number | Text | |
| Adjuster Name | Text | |
| Adjuster Email | Text | |
| Property Type | List | Residential, Commercial |
| Type of Loss | List | Water, Fire, Vehicle Impact, Trauma, Environmental, Other |
| └ Category of Water | List | CAT 1, CAT 2, CAT 3, Not Defined |
| └ Class of Water | List | Class 1, Class 2, Class 3, Not defined |
| └ Enter Other Type of Loss | Text | |
| Loss Date | Date | |

The indented fields are **conditional** — Category and Class of Water only
appear when Type of Loss is Water. CAT is contamination (clean / grey /
black); Class is evaporation load. Both drive what a carrier will pay for.

Field types available: Yes/No, List, Multi-select, Text, **Distance**,
Number, Photo, Color, Date and Time. Each can be marked mandatory, given a
default, and given conditional logic.

## What this means for us

Renovision does **direct insurance work**, so the claim field set is not a
nice-to-have — it is the data an adjuster needs before they will pay.

We already have most of the substrate:

- `projects` + `room_scans` (0024) — the Project → Floor → Room spine, with
  floor as a text label rather than a table
- `app_settings.custom_fields` + `CustomFieldDef` — a custom-field system
  already exists for clients (`ClientForm.tsx`), with select/checkbox/
  number/date/text types. Extending it to projects, adding conditional
  logic and Photo/Distance types, is the shortest path to Claim Details.
- The quote engine, which is where an affected area's measurements have to
  land to become money.

What is genuinely missing, in the order it is worth building:

1. **Affected areas** — a damaged region on a room or wall, with its own
   measured area, colour-coded by damage type, priced as its own line. This
   is the feature that connects a scan to an insurance estimate.
2. **Claim Details fields on a project** — extend the existing custom-field
   system, including conditional logic.
3. **Interactive floor plan** — tap to select, grey the rest, detail sheet.
4. **Manual corner scan** — ARKit, no LiDAR, works on any iPhone.
5. **The PDF report** — theirs is HTML printed by Chrome (Skia/PDF in the
   file metadata), which is exactly reproducible here.

---

# Estimation and reports, in detail

Second pass, from their help centre and the Estimator screens. The estimating
tier is not on this account, so the mechanics below come from their own
documentation rather than from clicking it.

## Affected areas — the bridge from scan to money

This is the feature that connects a measurement to an invoice, and it is
worth copying closely.

- Added from a room's or a **wall's** detail sheet: "Affected Areas" →
  **Add New Area**. A room area and a wall area are different things and
  cannot be moved between the two.
- It opens with **the entire surface pre-selected**, then you shrink it —
  reshaping is the interaction, not drawing from nothing. Drag a corner;
  tap an edge to insert a corner; type an exact figure via the measurement
  picker; or take the number straight off a Bluetooth laser measure.
- Fields: **Name**, **Fill Colour**, and toggles for showing dimensions and
  labels. Colour is the coding — water vs fire vs mould reads at a glance.
- The area is **computed automatically** and shown in the chosen units.
- **Photos, 360s, videos, notes and forms attach to the area itself**, not
  just to the room — so the evidence sits on the damage.
- Overlapping areas are explicitly allowed (their own hint text says so),
  which matters: a wet floor and a mouldy wall can overlap in plan.
- They surface in the **report PDF** (marked with a numbered icon), at the
  **bottom of the statistics report**, over the **API**, and — the important
  one — **they can be selected in the Estimator as the quantity for a line
  item**.

## The estimator

Structure:

- An **estimate** belongs to a project and carries client details.
- **Line items** for materials, labour or services, from predefined
  categories or written fresh. Quantity × unit cost totals automatically.
- **Cost rules** — tax, markup, discount — applied globally or per line.
- **Templates** bundle line items + cost rules + settings for reuse.
- **Price lists** hold the frequently used items and fixed costs. US users
  get Craftsman Book price lists built in.
- **Status** is a real workflow: Sent → Accepted → Approved → Rejected.
- Export as branded **PDF or XLS**, with logo, terms and notes.

The linkage that makes it worth having: quantities bind to the sketch.
Working in **room view** you select a room, a wall, or an object and apply an
item to it, and the quantity comes from that surface's own measurement.

Two limits worth knowing, both in their own docs:

- **Estimating is desktop/tablet only** — it explicitly does not run on a
  phone.
- **Floor plan sketches cannot be included in an exported estimate.** Their
  words. The plan lives in the report; the estimate is a document of numbers.
  We can do better here trivially, since our quote already renders in the
  same app that draws the plan.

## The report

Their report is HTML printed through Chrome (`Skia/PDF` in the file
metadata), which is exactly how we would build it. Options they expose:

**Layout** — all floors on one page / one floor per page / one floor per page
plus two rooms per page / plus one room per page. Paper: US Letter, Legal,
Tabloid, A4, A3, A2. Portrait or landscape.

**Plan rendering** — room labels all / main rooms only / hidden; floor scale
and room scale each auto-optimised or fixed; rotate the plan to maximise
scale on the page; force one scale across all floors.

**Dimensions, floor plans** — detailed (walls, windows, doors) / main only
(length × width) / area only / manually-set only.
**Dimensions, room plans** — all / two main / manually-set only / none.

**Content toggles** — dimensions, custom fields, photos and 360s and videos,
notes, forms.

**Photos** — small, medium or large, on dedicated pages.

**Header and footer** — disclaimer text, and a title block carrying company
logo, contact details, location, property details, plus optional room-count
and property-area statistics.

## Where this leaves our build order

Unchanged in shape, sharper in detail:

1. **Affected areas.** Room-or-wall, reshape-from-full, name + colour, auto
   area, attachments on the area itself, overlapping allowed. Then bind the
   measured area to a quote line — which is the one place we can beat them
   immediately, because our estimate and our plan live in the same app.
2. **Claim Details fields** on a project, with conditional logic.
3. **Interactive floor plan** — tap to select, grey the rest, detail sheet.
4. **Manual corner scan** (ARKit, any iPhone).
5. **The report** — HTML → PDF, with their toggle set as the specification.

---

# Restoration: the parts specific to damage work

Third pass. This is the material closest to what Renovision actually does,
and it is where the product stops being a floor-plan app and becomes a
restoration tool.

## Four ways damage gets recorded

1. **Photos** — attached to a floor, a room, an object, an affected area, or
   a 360 tour. Evidence, for the adjuster.
2. **Annotation objects** — markers placed on the plan that say what has to
   HAPPEN, from a fixed vocabulary: **repair, installation, removal,
   inspection, draining, drying, cleaning**. This is scope, drawn in place.
3. **Restoration objects** — the equipment actually deployed, placed on the
   plan where it stands.
4. **Room colour** — a room-level status colour for severity or progress
   (their example: yellow assessing, orange in progress, green done).

Note what this gives you: opening a plan shows what is damaged, what has to
be done about it, what machinery is on site, and how far along each room is —
all at once, without reading a word.

## The equipment library, by loss type

- **Water** — dehumidifiers, air movers, wall humid zones, wall cavity
  dryers, E-TES units
- **Fire** — air scrubbers, ozone generators
- **Mould** — moisture meters, humid zones, hydroxyl machines

Custom objects cover anything missing. Their documentation stops short of
saying whether placement records dates, duration or run-hours per unit — and
that matters, because equipment is billed **per unit per day**. If they do
not track it, that is a gap worth filling rather than copying.

## Instruments they read from

- **Bluetooth laser measurer** — dimensions straight into the plan, and into
  an affected area's shape
- **FLIR thermal camera** — hidden moisture behind surfaces, plus electrical
  and insulation faults
- **360 camera** — whole-room panoramas for the tour
- **Humidity / temperature meter** — environmental readings, which is how
  drying gets verified

## What this tells us to build

The restoration loop is: **assess → scope → deploy equipment → monitor drying
→ document → bill.** Their tooling covers the middle of that well and the two
ends loosely.

The openings, concretely:

- **Equipment is billed per unit per day.** If placement does not carry
  in-service and out-of-service dates, the drying period cannot become an
  invoice line by itself. Ours should: place a dehumidifier, set the dates,
  and the quote line writes itself.
- **Moisture readings are the proof a carrier pays against.** A reading
  logged per room per visit, trending down, is the drying log. That is a
  small table and a chart, and it is worth more to an adjuster than another
  photo.
- **Annotation objects are scope in place.** Their seven verbs map almost
  one-to-one onto price-book categories — a "removal" marker on a wall with
  an affected area of 40 sq ft is a demolition line waiting to be written.

None of this needs new measurement technology. It needs the scan, the
affected area, and a date — all of which we either have or are about to.
