# Object illustrations — the prompt sheet

**ORD-43.** How the catalogue's artwork gets made, and the exact words to
make it with.

## What this is for

Only the **catalogue tiles** — the pictures you browse when placing an
object. The plan symbol and the wall elevation stay drawn in code, because
they rotate with the object, scale from a thumbnail to a full sheet, and
have to stay ink-on-paper so the drawing reads as drafting beside a report.
Artwork cannot do any of that. A tile is a fixed size at a fixed angle,
which is exactly what artwork is good at.

## How to use it

1. Paste **the style block** below into ChatGPT once, at the top of a new
   chat. It is what makes forty pictures look like one set instead of forty
   pictures.
2. Then paste **one item line** at a time. Ask for a PNG with a transparent
   background.
3. Save it named exactly `object-<slug>.png` — the slug is in the first
   column. For doors and windows the name is `door-<slug>.png`.
4. Put the files anywhere and tell me; I add them to the asset catalogue.

**Anything missing keeps the drawing it has today.** The app checks for
artwork per object and falls back on its own figure, so you can do eight
tonight and eight next week and nothing is ever broken or half-empty.

## A note on rights

Images you generate in ChatGPT are yours to use commercially under OpenAI's
terms — worth confirming against your own plan, but it is the reason this
route was chosen over a free icon set: no attribution screen and no licence
to honour every time an object is added.

---

## The style block — paste this first

> I am building an icon set for a floor-plan app used by a water-damage
> restoration company. I will ask you for one object at a time. Every image
> must follow these rules exactly, so that the whole set looks like one
> hand drew it:
>
> - **Isometric three-quarter view**, viewed from above and slightly to the
>   left, at a consistent 30° angle. Never straight-on, never top-down.
> - **Clean vector-style line art**: even dark charcoal outlines, flat fills,
>   no gradients, no textures, no photorealism.
> - **A soft, restrained palette** — light greys and off-whites for
>   porcelain and steel, warm light oak for wood, pale blue for glass and
>   water. Muted, not saturated.
> - **A soft grey shadow directly under the object only.** No ground plane,
>   no room, no wall, no background scenery.
> - **Transparent background. The object fills the frame** with a small
>   even margin, centred, square canvas.
> - **No text, no labels, no dimensions, no arrows** unless I ask for one.
> - North American residential fixtures, not European ones.
>
> Confirm you understand, and I will send the first object.

---

## The objects

One line each. The slug is the filename.


### Plumbing

| Save as | Prompt to paste |
|---|---|
| `object-toilet.png` | Toilet. 20×28in footprint, 30in to the tank lid — a standard two-piece. |
| `object-bathtub.png` | Bathtub. 60×30in alcove tub — the near-universal North American size. |
| `object-shower_stall.png` | Shower stall. 36in square stock base; 78in to the top of the surround. |
| `object-kitchen_sink.png` | Kitchen sink. 33in double-bowl drop-in, 22in front to back. |
| `object-laundry_tub.png` | Laundry tub. 23in square utility tub — the basement standard. |
| `object-water_heater.png` | Water heater. 22in diameter, 60in tall — a 40–50 gallon tank. |
| `object-sump_pit.png` | Sump pit. 18in liner, 24in deep — the pit, not the pump. |

### Kitchen Cabinets

| Save as | Prompt to paste |
|---|---|
| `object-base_cabinet.png` | Base cabinet. 24in base unit; 34.5in carcass under a 1.5in top makes 36in. |
| `object-wall_cabinet.png` | Wall cabinet. 30in wide, 12in deep — hung, so its own height is what matters. |
| `object-tall_pantry.png` | Tall pantry. 24in pantry, 84in — floor to the standard soffit. |
| `object-island.png` | Island. 72×36in — the smallest island that still takes a stool. |
| `object-countertop_run.png` | Countertop run. 8ft of counter, 25in deep with the overhang. |

### Appliances

| Save as | Prompt to paste |
|---|---|
| `object-refrigerator.png` | Refrigerator. 36in French-door, 30in deep with the doors. |
| `object-range.png` | Range. 30in slide-in — the stock opening in every cabinet run. |
| `object-dishwasher.png` | Dishwasher. 24in built-in, sized to the base cabinet it replaces. |
| `object-washer.png` | Washer. 27in front-loader, 30in deep with the door shut. |
| `object-dryer.png` | Dryer. 27in, matched to the washer it stacks with. |

### Electrical

| Save as | Prompt to paste |
|---|---|
| `object-electrical_panel.png` | Electrical panel. 20in wide, 6in proud of the wall — a 200A load centre. |
| `object-baseboard_heater.png` | Baseboard heater. 4ft element, 3in deep — and the first thing a wet floor reaches. |

### HVAC

| Save as | Prompt to paste |
|---|---|
| `object-furnace.png` | Furnace. 24in cabinet, 60in tall — a mid-efficiency upflow. |
| `object-air_handler.png` | Air handler / HRV. 24in square cabinet, hung or floor-standing. |

### Furniture

| Save as | Prompt to paste |
|---|---|
| `object-sofa.png` | Sofa. 7ft three-seat — the common size on a contents list. |
| `object-bed_queen.png` | Bed, queen. 60×80in mattress, the North American queen. |
| `object-dresser.png` | Dresser. 60in six-drawer, 18in deep. |
| `object-desk.png` | Desk. 48×24in, the stock office size. |
| `object-shelving.png` | Shelving unit. 36in bay, 16in deep — basement storage racking. |

### Structural

| Save as | Prompt to paste |
|---|---|
| `object-column.png` | Column / post. 8in steel post or built-up wood — a basement's usual. |
| `object-stairs.png` | Stairs. 36in run, 10ft of horizontal travel for a storey. |
| `object-bulkhead.png` | Bulkhead / soffit. A boxed duct run — 24in deep, 12in down from the ceiling. |
| `object-fireplace.png` | Fireplace. 48in surround, 24in of hearth into the room. |

### Restoration

| Save as | Prompt to paste |
|---|---|
| `object-dehumidifier.png` | Dehumidifier. 20in square footprint — an LGR on its own wheels. |
| `object-air_mover.png` | Air mover. 18in axial mover, the one that sits in every doorway. |
| `object-air_scrubber.png` | Air scrubber. 20in HEPA scrubber, 500 CFM class. |
| `object-containment.png` | Containment barrier. 8ft of poly on a zip pole — drawn as the line it is. |

---

## Doors and windows

These are the ones that prompted the whole order — the reference's door
tiles are the set we are furthest from. They want one extra rule, so add
this sentence to each prompt:

> Draw it as it would appear standing in a wall opening: the frame, the
> leaf, and a red arrow on the floor showing which way it swings or slides.

The red arrow is not decoration. It is the only thing that tells a bypass
door from a folding door from a pocket door — all three are the same
rectangle otherwise.

| Save as | Prompt to paste |
|---|---|
| `door-doorSingle.png` | Door. 32in single leaf, 80in tall — the builder's standard |
| `door-doorDouble.png` | Double door. 60in pair, 80in tall |
| `door-doorSliding.png` | Sliding door. 72in patio slider, 80in tall |
| `door-doorCased.png` | Opening (no door). 48in cased opening, no leaf at all |
| `door-windowStandard.png` | Window. 36in wide, 48in tall, sill at 36in |
| `door-windowWide.png` | Wide window. 60in wide, 48in tall |
| `door-windowSmall.png` | Small window. 24in basement hopper |

---

## When they are done

Send me the folder. I add them to the asset catalogue under the names
above, and they replace the drawn figures on sight — no code change per
object, because the slug IS the join.

**What is still not covered**, and is worth knowing before you start: the
reference lists **17 doors and 15 windows** to our four and three. Adding a
kind is not just a picture — each needs a real North American stock width,
because that width knocks the hole in the wall and comes off the net wall
area. Artwork for a door we cannot measure would be a picture of a door.
Tell me which types your jobs actually meet and I will add them properly.

