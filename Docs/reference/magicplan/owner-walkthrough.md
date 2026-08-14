# Owner walkthrough — magicplan scan and edit, narrated

**14 August 2026.** The owner ran a real magicplan session on his own phone, sent screenshots as
he went, and answered one to three questions per screenshot. This is the only reference material
in this repo gathered from someone who uses the app to earn money, and it is the only material
covering a scan of a real room and the editing that follows it.

## How to read the tags

| Tag | Means |
|---|---|
| `[seen]` | A screenshot of that exact screen was provided. Highest confidence |
| `[owner]` | The owner stated it. He uses the app daily; treat as reliable, but it is testimony |
| `[owner-unsure]` | The owner said he was not certain. **Do not implement as fact** |

The screenshots arrived through chat, not through the capture pipeline, so they are **not** filed
in `screens/`. Claims here cite the tag rather than a filename.

**Where this disagrees with `interactions-scan.md` / `interactions-editor.md`, this file wins on
flow ordering.** Those were captured by driving the app without a real scan to edit, which is
exactly the gap this fills. On any single screen's anatomy, the older files remain better —
they were read frame by frame.

---

## A. Capture flow

| id | | |
|---|---|---|
| A1 | `[owner]` | **The mode choice is one-way.** Once a scan mode is picked you are stuck with it for that room; there is no switching mid-scan |
| A2 | `[seen]` `[owner]` | **A briefing screen precedes every scan** — every time, not only the first. A large red button starts the scan and must be tapped |
| A3 | `[seen]` `[owner]` | **Room type is chosen before the camera opens**, immediately after the mode choice. Residential / Commercial, six common types, then *See more*. The room's name derives from the type |
| A4 | `[owner]` | **Mid-scan photo capture.** A white circle button takes a photo during the scan and attaches it to the room being scanned. "So in the future you don't have to take the photos separate" |
| A5 | `[owner]` | **Object classification never blocks.** A collapsible panel lists what was detected; everything keeps running while you read or change it, and you can carry on scanning |
| A6 | `[owner]` | **A question mark means unidentified.** Tap it to pick the object yourself. Leave it and the app auto-picks its best match from its own library. It never stops to ask |
| A7 | `[owner]` | Detected objects matter more for the 3D dollhouse than for the estimate — "not very important, but it's good to have because we're gonna build also dollhouse" |
| A8 | `[owner]` | **The green mini-map shows walls only** — no doors, no windows, deliberately. Its job is to show the room has *closed*, not to show contents. "It's better to not have doors and windows there" |
| A9 | `[owner]` | **The post-scan review is minimal** — the shape, and Confirm or Discard. "Their review is good enough for me" |
| A10 | `[owner]` | After confirming: scan another room, or Done. A loop |
| A11 | `[seen]` | **After Done you land directly on the floor's 2D plan, drawn.** No summary, no list, no intermediate screen |

## B. Floor level

| id | | |
|---|---|---|
| B1 | `[seen]` | Nav bar: back chevron paired with a floor-switcher glyph, floor name as title, help and share at the right |
| B2 | `[seen]` | Canvas: dotted grid, rooms drawn with poché walls. Each room carries **its name and its area, nothing else**. No dimensions at floor level |
| B3 | `[seen]` | Undo / redo pair top-left. Layers stepper and view-mode stepper top-right |
| B4 | `[seen]` | Action bar: **Insert · Rotate**. Below it, "Swipe up ↑ for *Floor* info" |
| B5 | `[seen]` | View-mode menu is three rows — 2D View, 3D View, Elevation View. At floor level Elevation is greyed, reason given: *"Only available inside rooms"* |
| B6 | `[seen]` | **3D is read-only.** The subtitle says "3D View • Read Only" and the action bar vanishes entirely |
| B7 | `[owner]` | **Ours should differ here.** magicplan makes 2D and 3D exclusive modes; the owner wants both at once. "On our application we have both of them at the same time — ours is better" |

## C. Room level

| id | | |
|---|---|---|
| C1 | `[seen]` | Tapping a room sets the title to the room name with the floor as subtitle. Corners appear as white dots |
| C2 | `[seen]` | Full dimension chains appear only at this depth — overall dimensions outside the room, and **chains segmented at every opening** |
| C3 | `[seen]` | Action bar: **Insert · Set Size · Edit Layout · Duplicate · Delete…** |
| C4 | `[seen]` | Elevation View becomes enabled. Its subtitle switches from the blocking reason to a hint: *"You can also double-tap on a wall"* |
| C5 | `[seen]` | **Set Size** opens the measurement panel with the whole-room dimension boxed and the confirm button reading **Next**, not Apply — it walks the room's dimensions in sequence, one keypad entry each |

## D. Wall level

| id | | |
|---|---|---|
| D1 | `[seen]` | Tapping a wall sets the title to "Wall". The wall highlights blue along its length |
| D2 | `[seen]` | Two manipulators appear: a round **diamond drag handle**, and a smaller double-arrow marker further along the wall |
| D3 | `[seen]` | Action bar: **Insert · Add Corner · Add Wall · Split Room · Delete…** |
| D4 | `[seen]` | **Dragging the handle moves the wall perpendicular to itself.** Observed 4.000 → 2.632: the two adjoining walls shortened to match, the polygon stayed closed, and every dimension updated live — including the door chain, which went 1.550 / 0.900 / 1.550 → 0.866 / **0.900** / 0.866. The door kept its width and stayed centred |
| D5 | `[seen]` | While a drag handle is engaged the action bar collapses to **Insert · Delete…** |
| D6 | `[seen]` | The dragged dimension did **not** gain a padlock — see E4 for the contrast |

## E. Measurements

| id | | |
|---|---|---|
| E1 | `[seen]` | Tapping a blue dimension opens **Change Measurement**: title, "Metric · *Change Unit…*", a **Laser** button, a large readout with its unit, the hint "Enter a value or use Bluetooth measures", a 0–9 keypad with decimal point and backspace, and a dark confirm button |
| E2 | `[seen]` | **The button row is the lock state.** A locked dimension shows *Laser* **and** *Unlock*; once unlocked, only *Laser* remains |
| E3 | `[seen]` | The confirm button reads **Apply** for a single dimension and **Next** when stepping through Set Size |
| E4 | `[seen]` | Typing 2.0 and applying redrew the room at 2.000 **and put a padlock beside the dimension**. Keypad entry marks a dimension as manually set. Dragging (D6) does not |
| E5 | `[owner-unsure]` | **Whether a freshly scanned room arrives already locked is not settled.** The owner: "I think the room initially was locked." The first screenshot does show a padlock on 4.000 before any editing. **Open — do not decide from this** |
| E6 | `[seen]` | *Change Unit…* opens **Change Units**: segmented Metric / Feet / Inches over a precision wheel. Metric — 2.50 m, 2.500 m, 250 cm, 250.0 cm. Feet — 1' 6", 1' 6" 1/2", 1' 6" 1/4". Inches — 18", 18" 1/2", 18" 1/4". Footer: "Changes will affect the current and new projects. Existing projects will not be affected" |
| E7 | `[seen]` | **Laser** opens *Connect Bluetooth Measures* — My Devices / Nearby Devices with a search spinner, and a "Learn how measuring works" link. A laser distance meter feeds the readout directly |

## F. Insert and objects

| id | | |
|---|---|---|
| F1 | `[seen]` | Insert offers **Room · Object · Note · Photo · Form** |
| F2 | `[seen]` | Object opens *All Objects*: search field, a **Recently used** rail, then categories with counts — Annotations 25, Doors 17, Windows 15, Structural 27, Plumbing 57, Appliances 29, Kitchen Cabinets 37, Furniture 126, Electrical 69 |
| F3 | `[seen]` | The Windows category is a grid of **types**, each illustrated with its operation shown by arrows: Arched, Awning, Bay, Bow, Casement, Fixed, and more. 15 in total |
| F4 | `[seen]` | Inserting a Fixed Window **snapped it into the selected wall** and gave it its own chain along that wall — 0.800 for the window, 0.754 for the offset below it |
| F5 | `[seen]` | Action bar at opening depth: **Insert · Replace with… · Duplicate · Delete…** |

## G. Elevation view — and why it matters here

| id | | |
|---|---|---|
| G1 | `[seen]` | Reached by double-tapping a wall, or from the view-mode menu |
| G2 | `[seen]` | The canvas swaps to a **straight-on projection of the wall face**, with the two adjoining walls folded away as grey trapezoids left and right. The nav leading glyph becomes a blue **2D** escape; the view-mode stepper shows an elevation glyph |
| G3 | `[seen]` | Dimensions: the offset chain along the top (0.754 / 0.800 / 0.446), **wall height** down the left (2.440), **wall length** along the bottom (2.000), and for the window its **head** height (0.240 below ceiling) and **sill** height (1.000 above floor) at the right |
| G4 | `[seen]` | Circular **←** and **→** buttons on the left and right edges step to the adjoining walls |
| G5 | `[seen]` | The action bar reduces to **Insert** |
| G6 | `[owner]` | **The reason elevation matters for restoration.** Draw a rectangle over the damaged part of the wall face, at approximate size, to mark it as a damaged area. The rectangles are **named** and **colour-coded by cause** — water damage, fire damage, mould — "for you to find them easily after". The owner calls these *add fields* |

---

## What this settles in `interactions-editor.md`

- **Open question 6** — *does a dragged wall set the padlock?* Answered **no** (D6); keypad entry does (E4).
- **The elevation wall stepper**, listed in `spec.md` §4.6a as "worth adding" — confirmed present (G4).
- **Scan-flow ordering** — room type is chosen *before the camera*, not at review. Our `CaptureFlow` had it at review.

## Still open

1. E5 — whether scanned dimensions arrive locked.
2. *Add Corner*, *Add Wall*, *Split Room* were never performed. No after-frames.
3. How a damage rectangle is actually drawn in elevation — the gesture, resizing, snapping. Described in words only, never captured.
4. Whether those rectangles are magicplan's generic custom-field feature or a distinct annotation type.

## Product decisions taken from this walkthrough

Ours, not magicplan facts. Recorded here because this conversation is where they were made.

- **Land directly in the floor-level 2D plan after Done.** Non-negotiable. The owner's words: *"where is my scan after the scanning, i need to see it right away"*.
- **Show 2D and 3D together** rather than as exclusive modes (B7).
- **Elevation view carries damage marking.** `affected_areas` already models it — `surface = 'wall'` plus `wall_index`, migration `0025_affected_areas.sql`. The elevation canvas is the missing half, not the schema.
- **Default to feet and inches.** Quebec insurance work is quoted imperial; metric is the fallback, not the default.
