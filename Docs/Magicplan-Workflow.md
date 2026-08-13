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
