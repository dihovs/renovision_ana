# Editor chrome — exact visual design

Transcribed from the owner's screenshots, 14 Aug 2026, at his instruction: *"I want exactly
the design that I send you on the photos. Just keep the hint of my company."*

**What that means precisely.** Copy the *layout* — where things sit, how they group, what
changes with state. Do **not** copy the icon set, the object illustrations or the 3D renders;
those are magicplan's trade dress. Use SF Symbols, which are Apple's and ours to use. The one
deliberate divergence is colour: every accent that is system blue in the screenshots is
`Brand.blue` (#2B5C9E) here. Never system blue.

---

## 1. Navigation bar

Three slots, all on the standard grouped-background grey.

**Leading** — a single rounded-rect pill, light grey fill, containing *two* glyphs side by
side: a back chevron and a context glyph, both `Brand.blue`. The context glyph says what you
would go back *to*, and it changes with depth:

| Depth | Context glyph |
|---|---|
| Floor level | a two-pane floor-switcher glyph |
| Inside a room | a single-room glyph |
| In 3D or elevation | the literal text `2D` — the escape hatch, not a chevron target |

**Centre** — title bold, ~17pt, black. Optional subtitle below it, ~13pt, grey. The subtitle
carries the parent or the mode:

| Screen | Title | Subtitle |
|---|---|---|
| Floor level | `2nd Floor` | — |
| Room selected | `2nd bedroom` | `2nd Floor` |
| Wall selected | `Wall` | `Ground Floor` |
| Opening selected | `Fixed Window` | `Ground Floor` |
| 3D | `2nd Floor` | `3D View • Read Only` |

**Trailing** — two glyphs in `Brand.blue`: a circled question mark, then a share glyph.

## 2. Canvas

- Background: very light grey, flat.
- **Dotted grid.** Fine dots on a regular pitch, and every fifth dot is replaced by a small
  `+` crosshair, slightly larger and a touch more saturated. Both in a pale blue-grey. The
  crosshairs are what give it the drafting-paper feel — do not drop them.
- Rooms at floor level: light grey fill (~#E4E4E6), black poché walls, name and area centred.
- The room you are inside: **white** fill with a fine tan/terracotta tile grid over it. The
  surrounding rooms stay grey and un-gridded. This is what makes "inside a room" legible
  without a modal.
- Walls: solid black, thick. Exterior and interior read the same weight.
- Corners of the selected room: white filled circles with a thin dark ring.

## 3. Floating controls

**Top-left — undo / redo.** One white rounded-rect pill containing two halves split by a
hairline divider. Left is undo (curved arrow left), right is redo (curved arrow right).
Unavailable actions grey out in place; the pill never disappears.

**Top-right — two separate white pills**, each with a chevron-up-down stepper glyph on its
right:

1. a layers glyph (stacked sheets)
2. the current view mode as text: `2D`, `3D`, or an elevation glyph

Tapping the second opens the view-mode menu (§5).

## 4. Bottom action bar

A panel across the bottom on the light grouped background, with a **grabber** — a short
rounded horizontal bar, centred, above the buttons.

Buttons are equal-width rounded-rect tiles, light grey fill, **icon above label**, icon ~22pt,
label ~13pt. Destructive items are red — glyph and label both — and their label ends in an
ellipsis (`Delete...`), because they confirm.

Below the row, centred, grey, ~13pt: `Swipe up ↑ for <name> info` — where `<name>` is
whatever is selected. That is the gesture into the inspector (ORD-13's sheet).

**The bar is a function of `(selection depth, view mode)`:**

| Depth | Buttons |
|---|---|
| Floor level | Insert · Rotate |
| Room | Insert · Set Size · Edit Layout · Duplicate · Delete... |
| Wall | Insert · Add Corner · Add Wall · Split Room · Delete... |
| Wall, drag handle engaged | Insert · Delete... |
| Opening | Insert · Replace with... · Duplicate · Delete... |
| Elevation | Insert |
| 3D | *no bar at all* |

## 5. View-mode menu

A floating rounded card under the view stepper, three rows, each with its shortcut glyph
right-aligned. The current mode carries a leading checkmark.

```
✓  2D View                    2D
   3D View                    3D
   ─────────────────────────────
   Elevation View              ⊕
   You can also double-tap on a wall
```

The third row is separated by a thicker divider and carries a **subtitle that changes
meaning**: when disabled it is the blocking reason (*"Only available inside rooms"*, whole row
greyed); when enabled it is a shortcut hint (*"You can also double-tap on a wall"*). One slot,
two message types.

## 6. Dimensions

- Numbers in `Brand.blue`, ~15pt, on the canvas background (no plate).
- Dimension lines thin grey with fine arrowheads; witness lines dotted grey.
- **Overall** dimensions sit outside the room, top and bottom, left and right.
- **Chains** sit inboard of the overall line and break at every opening:
  `1.550 ⇥ 0.900 ⇤ 1.550`. Segment boundaries are drawn as small opposed arrowheads.
- A **padlock** — small, black, filled — sits immediately after a number that was set by hand.
- In elevation, height is drawn down **both** left and right edges. That is a drafting
  convention, not a bug; keep it.

## 7. Selection styling

| | |
|---|---|
| Selected wall | the wall's full length filled `Brand.blue`, over the black poché |
| Drag handle | a circle, white ring, filled indigo, containing a diamond split by a vertical line — sits at the wall's midpoint, offset outboard |
| Secondary marker | a small pair of opposed triangles (`▶◀`) further along the same wall |
| Selected opening | a thin `Brand.blue` rectangle outlining it, with its own dimension chain |

## 8. Measurement panel

Bottom sheet, white, rounded top corners.

```
Change Measurement                                    (✕)
Metric • Change Unit…            ← "Change Unit…" is Brand.blue, tappable
─────────────────────────────────────────────────────────
[  ⊕ Laser  ]  [  🔒 Unlock  ]   ← Unlock present ONLY when locked
─────────────────────────────────────────────────────────
                  2.500 m         ← ~44pt, unit ~24pt grey
       Enter a value or use Bluetooth measures
   ┌─────┐  ┌─────┐  ┌─────┐
   │  1  │  │  2  │  │  3  │      white tiles, rounded, ~28pt
   ...  4 rows, last is  •  0  ⌫
   ┌───────────────────────────────────────┐
   │              Apply                    │   full width, BLACK fill,
   └───────────────────────────────────────┘   white text, ~17pt semibold
```

The confirm button reads **`Next`** while stepping through a room (Set Size) and **`Apply`**
on the last one. The button row above the readout *is* the lock state: locked shows
`Laser` + `Unlock`; unlocked shows `Laser` alone, full width.

## 9. Change Units sheet

Segmented control `Metric | Feet | Inches` at the top, then a **scroll wheel of precisions**
for the chosen system, the selected row in a grey rounded capsule:

| System | Precisions |
|---|---|
| Metric | `2.50 m` · `2.500 m` · `250 cm` · `250.0 cm` |
| Feet | `1' 6"` · `1' 6" 1/2"` · `1' 6" 1/4"` |
| Inches | `18"` · `18" 1/2"` · `18" 1/4"` |

Full-width **`Apply Changes`** button at the bottom — this one is `Brand.blue` filled, not
black, because it commits a setting rather than a value. Footnote under it, grey, centred:
*"Changes will affect the current and new projects. Existing projects will not be affected."*

**Our default is Feet**, not Metric. This market quotes imperial.

## 10. Elevation view

- The wall face straight on, white, with the same tan tile grid as a selected room.
- The two adjoining walls fold away as **grey trapezoids**, left and right, their outer edges
  slanting away from the face.
- Openings drawn architecturally on the face — a window as concentric rectangles, a door as a
  leaf with a handle.
- Dimensions: offset chain along the top; wall height down both edges; wall length along the
  bottom; and for each opening, its **head** height (down from the ceiling) and **sill**
  height (up from the floor) at the right.
- Circular white **←** and **→** buttons, one at each side edge, vertically centred, stepping
  to the adjoining walls.
- Action bar reduces to `Insert`.

## 11. Object library

Full-height sheet. `Edit` at the left of its header, title centred, `✕` at the right. Search
field below. Then a dismissible tip card, a **Recently used** horizontal rail of square
preview tiles each with a favourite star, then a grouped list of categories: icon, name,
count, chevron. Drilling in gives a **two-column grid** of type tiles, each a square preview
with the name beneath and a favourite star.

Our own line: category names and counts are functional and ours to choose; the illustrations
inside the tiles must be drawn by us, not copied.
