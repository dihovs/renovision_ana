# Object illustrations — the ChatGPT SVG route

**ORD-43.** How the catalogue's artwork gets made using a ChatGPT
subscription rather than a paid image API.

## Why SVG code and not generated pictures

Ask GPT for SVG MARKUP, not for images. It is better on every axis that
matters here:

- **No image quota.** Text output, not picture generation.
- **Crisp at any size**, and a few kilobytes each rather than a few hundred.
- **Readable and fixable.** SVG is text, so a wrong drawing can be corrected
  rather than re-rolled and hoped over.
- **A whole section per reply**, so this is about eight copy-pastes instead
  of forty-two.

## What this covers

Only the **catalogue tiles** — the pictures you browse when placing an
object. The plan symbol and the wall elevation stay drawn in code, because
they rotate with the object, scale from a thumbnail to a full sheet, and
must stay ink-on-paper so the drawing reads as drafting beside a report.
Artwork does none of that.

**Anything missing keeps the drawing it has today**, so the set can arrive
one section at a time and the catalogue is never half-empty.

## How to run it

1. Open a new ChatGPT chat. Paste **the style block** below. It will confirm.
2. Paste **one batch** at a time from the sections after it.
3. Copy its whole reply into a file — the whole thing, markers included.
   Name it anything; put it anywhere.
4. Tell me the file path. I split it, check every SVG, and wire them in.

If a drawing comes back wrong, say so in the same chat — "the toilet tank is
on the wrong side, redo it" — and paste the corrected block over the old one.

---

## Step 1 — the style block

Paste this first, once:

```
You are drawing an icon set for a floor-plan app used by a water-damage
restoration company in Quebec. I need SVG CODE, not images.

Follow these rules for EVERY icon, so the whole set looks like one hand drew it:

- **Isometric three-quarter view**, seen from above and slightly to the left,
  consistent 30-degree angle throughout. Never straight-on, never top-down.
- **Clean vector line art**: even outlines in #2E3238 at 2px, flat fills, no
  gradients, no textures, no photorealism, no drop shadows except one soft
  grey ellipse directly under the object.
- **Palette**: #F4F6F8 and #E7E9EC for porcelain and steel, #D8B187 for wood,
  #DCE8F2 for glass and water, #CFCFCB for concrete. Muted, never saturated.
- **No background, no room, no walls, no floor plane, no text, no labels.**
- `viewBox="0 0 100 100"`, object centred, filling about 80% of the frame.
- North American residential fixtures, not European.

OUTPUT FORMAT — this matters, a script reads your reply:

For each item, output exactly this, with nothing else between blocks:

===SLUG: the-slug-i-gave-you
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">...</svg>
```

No commentary, no explanation, no markdown headings. Just the marker line and
the fenced SVG, repeated for every item in the batch.
```

---

## Step 2 — the batches


### Batch: Plumbing (7 items)

```
Draw these 7 items, following the style rules exactly:

- slug `toilet` — Toilet. 20×28in footprint, 30in to the tank lid — a standard two-piece.
- slug `bathtub` — Bathtub. 60×30in alcove tub — the near-universal North American size.
- slug `shower_stall` — Shower stall. 36in square stock base; 78in to the top of the surround.
- slug `kitchen_sink` — Kitchen sink. 33in double-bowl drop-in, 22in front to back.
- slug `laundry_tub` — Laundry tub. 23in square utility tub — the basement standard.
- slug `water_heater` — Water heater. 22in diameter, 60in tall — a 40–50 gallon tank.
- slug `sump_pit` — Sump pit. 18in liner, 24in deep — the pit, not the pump.
```

### Batch: Kitchen Cabinets (5 items)

```
Draw these 5 items, following the style rules exactly:

- slug `base_cabinet` — Base cabinet. 24in base unit; 34.5in carcass under a 1.5in top makes 36in.
- slug `wall_cabinet` — Wall cabinet. 30in wide, 12in deep — hung, so its own height is what matters.
- slug `tall_pantry` — Tall pantry. 24in pantry, 84in — floor to the standard soffit.
- slug `island` — Island. 72×36in — the smallest island that still takes a stool.
- slug `countertop_run` — Countertop run. 8ft of counter, 25in deep with the overhang.
```

### Batch: Appliances (5 items)

```
Draw these 5 items, following the style rules exactly:

- slug `refrigerator` — Refrigerator. 36in French-door, 30in deep with the doors.
- slug `range` — Range. 30in slide-in — the stock opening in every cabinet run.
- slug `dishwasher` — Dishwasher. 24in built-in, sized to the base cabinet it replaces.
- slug `washer` — Washer. 27in front-loader, 30in deep with the door shut.
- slug `dryer` — Dryer. 27in, matched to the washer it stacks with.
```

### Batch: Electrical (2 items)

```
Draw these 2 items, following the style rules exactly:

- slug `electrical_panel` — Electrical panel. 20in wide, 6in proud of the wall — a 200A load centre.
- slug `baseboard_heater` — Baseboard heater. 4ft element, 3in deep — and the first thing a wet floor reaches.
```

### Batch: HVAC (2 items)

```
Draw these 2 items, following the style rules exactly:

- slug `furnace` — Furnace. 24in cabinet, 60in tall — a mid-efficiency upflow.
- slug `air_handler` — Air handler / HRV. 24in square cabinet, hung or floor-standing.
```

### Batch: Furniture (5 items)

```
Draw these 5 items, following the style rules exactly:

- slug `sofa` — Sofa. 7ft three-seat — the common size on a contents list.
- slug `bed_queen` — Bed, queen. 60×80in mattress, the North American queen.
- slug `dresser` — Dresser. 60in six-drawer, 18in deep.
- slug `desk` — Desk. 48×24in, the stock office size.
- slug `shelving` — Shelving unit. 36in bay, 16in deep — basement storage racking.
```

### Batch: Structural (4 items)

```
Draw these 4 items, following the style rules exactly:

- slug `column` — Column / post. 8in steel post or built-up wood — a basement's usual.
- slug `stairs` — Stairs. 36in run, 10ft of horizontal travel for a storey.
- slug `bulkhead` — Bulkhead / soffit. A boxed duct run — 24in deep, 12in down from the ceiling.
- slug `fireplace` — Fireplace. 48in surround, 24in of hearth into the room.
```

### Batch: Restoration (4 items)

```
Draw these 4 items, following the style rules exactly:

- slug `dehumidifier` — Dehumidifier. 20in square footprint — an LGR on its own wheels.
- slug `air_mover` — Air mover. 18in axial mover, the one that sits in every doorway.
- slug `air_scrubber` — Air scrubber. 20in HEPA scrubber, 500 CFM class.
- slug `containment` — Containment barrier. 8ft of poly on a zip pole — drawn as the line it is.
```

### Batch: Doors and windows (7 items)

**These need one extra rule** — add this sentence to the batch:

> For each door or window, draw the frame in the wall opening and show the
> leaf. Add a red (#C0392B) curved arrow at the base showing which way it
> swings or slides. The arrow is not decoration: it is the only thing that
> tells a slider from a hinged door from a cased opening.

```
Draw these 7 items, following the style rules exactly:

- slug `door-doorSingle` — Door. 32in single leaf, 80in tall, hinged, shown swung open
- slug `door-doorDouble` — Double door. 60in pair, 80in tall, both leaves swung open
- slug `door-doorSliding` — Sliding door. 72in patio slider, 80in tall, one panel slid behind the other
- slug `door-doorCased` — Opening (no door). 48in cased opening, a finished frame with no leaf at all
- slug `door-windowStandard` — Window. 36in wide, 48in tall, sill at 36in, single hung
- slug `door-windowWide` — Wide window. 60in wide, 48in tall, two panes side by side
- slug `door-windowSmall` — Small window. 24in basement hopper, hinged at the bottom
```

---

## What happens next

Give me the file and I run `scripts/split-object-svgs.py` over it: every
block is validated as real SVG, written to
`ios/App/App/Native/Artwork/<slug>.svg`, and registered in the asset
catalogue. Then I build and you judge it on the phone.

**The doors are the risky ones.** A toilet is a well-known object and GPT
will draw it fine. "Bypass door with an arrow showing which way it slides"
is a technical drawing convention, and the first pass may come back as
seven similar doors. If iterating in the chat does not fix it, I will say
so rather than shipping seven identical doors.

