# Floor Plan Editor — Interaction Log

Derived only from `docs/magicplan/screens/*.jpg` and `spec.md` §4.4–4.7. Every image path
below was verified to exist. Anything not directly visible in a frame is marked *[inferred]*.

Screenshots are macOS captures of an iPhone Mirroring window; the phone viewport is the
narrow panel on the right of each full frame. `*-detail.jpg` files are cropped enlargements
of the same state.

**Persistent editor chrome** (seen in `screens/19-floorplan-editor-2d.jpg`):
row 1 = back chevron + blue floor-plan glyph · title (+ subtitle at room/object depth) · `?` · export;
row 2 = undo / redo at left, two stepper pills at right (left pill = floor switcher, right pill = view mode);
bottom = contextual action bar with a grabber above it and the caption `Swipe up ↑ for <entity> info`.

---

### INT-E01 — Enter the editor from a project

| | |
|---|---|
| **Before** | `screens/12-project-detail-floorplans-photos.jpg` — project detail scrolled to the `Floor Plans` section: header `Floor Plans ›` + `See All (1)`, caption "Sorted by floor level", horizontal rail with a leading grey circular `+` and one thumbnail card captioned `2nd Floor` |
| **Action** | Single tap on the `2nd Floor` thumbnail in the rail |
| **After** | `screens/19-floorplan-editor-2d.jpg` — full-screen editor pushed on: title `2nd Floor`, canvas showing the whole floor in 2D, action bar `Insert | Rotate`, caption `Swipe up ↑ for 2nd Floor info`. The project's yellow `Workspace update available / Apply` banner persists into the editor |
| **Mechanism** | The rail item is a floor, not a project-level "open editor" button — the editor is entered *at* a floor. Selection depth starts at FLOOR (nothing selected inside the canvas), which is why the action bar is only two items. The sync banner rendering inside the editor means it lives above the navigation stack, not in the project screen |
| **Build note** | Route is `project → floor id → editor`. Editor takes the floor as its required parameter and initialises `selection = nil`; keep the sync banner in a global chrome layer so it survives navigation. |

---

### INT-E02 — Open the view-mode menu (and read the gating reason)

| | |
|---|---|
| **Before** | `screens/19-floorplan-editor-2d.jpg` — right-hand stepper pill in row 2 reads `2D` with up/down chevrons |
| **Action** | Single tap on the `2D` stepper pill |
| **After** | `screens/21-view-mode-menu.jpg` — popover anchored below the pill with three rows: `2D View` (leading ✓, trailing `2D`), `3D View` (trailing `3D`), and `Elevation View` rendered grey with a two-line subtitle *"Only available inside rooms"* and a trailing target-style glyph. The canvas and action bar behind are unchanged |
| **Mechanism** | View mode is a three-value enum on the editor, independent of selection — except that `elevation` has a precondition (`selection` must be a room or something inside a room). The disabled row still renders, with its precondition as subtitle, rather than being hidden |
| **Build note** | Model view mode as an enum with an `isAvailable(for: selection)` predicate that returns a reason string; render unavailable options greyed with the reason inline instead of removing them. |

---

### INT-E03 — Switch to 3D (read-only) and back

| | |
|---|---|
| **Before** | `screens/21-view-mode-menu.jpg` — menu open, `2D View` checked |
| **Action** | Single tap on the `3D View` row |
| **After** | `screens/23-3d-view.jpg` — menu dismisses; canvas becomes an extruded grey massing model of the same floor on a flat grey background (dotted grid and blue crosshairs gone). Title gains a subtitle `3D View • Read Only`. The bottom action bar and its grabber/caption are **removed entirely**. Undo/redo disappear from row 2; only the two stepper pills remain. Row 1's leading glyph changes from the floor-plan icon to a blue text label `2D` |
| **Mechanism** | 3D is a rendering of the same geometry with all editing affordances suppressed — no selection, no undo stack UI, no action bar. The nav-bar glyph flipping to a literal `2D` label is a one-tap escape hatch back to the editable mode. Spec §4.4 adds that one-finger drag pans in 3D |
| **Build note** | Same scene graph, different renderer + an `isEditable` flag that hides the whole action bar, undo/redo and hit-testing. Provide the "back to 2D" shortcut in the nav bar so users are never one menu away from editing. |

---

### INT-E04 — Open the floor switcher

| | |
|---|---|
| **Before** | `screens/19-floorplan-editor-2d.jpg` — left stepper pill in row 2 (small floor-stack glyph + chevrons) |
| **Action** | Single tap on the left stepper pill *[inferred — the same glyph also appears beside the back chevron in row 1, so either could be the trigger; no frame captures the tap target highlighted]* |
| **After** | `screens/24-floor-switcher.jpg` — full-screen sheet with a grabber: header glyph + `All Floor Plans` / `1 item`, `✕` at right; 2-column grid whose first cell is a dashed-border tile with a centred grey `+` captioned `Add Floor`, second cell is a plan thumbnail outlined in blue and captioned in blue `2nd Floor` |
| **Mechanism** | Blue outline + blue caption = current floor, a selection state rather than a checkmark. `n items` counts floors, not tiles (the `+` is excluded) |
| **Build note** | Reuse the "collection shell": dashed create-tile first, current item outlined in accent. Count label excludes the create tile. |

---

### INT-E05 — Add a floor

| | |
|---|---|
| **Before** | `screens/24-floor-switcher.jpg` — dashed `Add Floor` tile in the grid |
| **Action** | Single tap on the dashed `Add Floor` tile |
| **After** | `screens/25-add-floor-sheet.jpg` — sheet retitled `Add Floor` with `✕`; grouped scrolling list. Group `Most common`: Ground Floor, 1st Floor, 2nd Floor, 3rd Floor, 4th Floor. Group `Other floors`: Basement • Level 3, Basement • Level 2, Basement • Level 1, Land survey, Semi-Basement, Higher Ground Floor, 5th Floor, 6th, 7th, 8th, 9th… (scrolls on) |
| **Mechanism** | A floor is created by picking a *level identity* from a fixed vocabulary, not by typing a name. Basements are listed deepest-first and floors ascend, i.e. the list is ordered by signed level index. No free-text field here — floor renaming happens later in the floor inspector (`Floor Name`, INT-E24) |
| **Build note** | Ship an enum of floor levels with an integer sort key and a two-bucket presentation (common / other). Name is derived from the level and separately overridable. |

---

### INT-E06 — Land on a newly added, empty floor

| | |
|---|---|
| **Before** | `screens/25-add-floor-sheet.jpg` — `Ground Floor` row at the top of `Most common` |
| **Action** | Single tap on the `Ground Floor` row |
| **After** | `screens/26-empty-floor-editor.jpg` — sheet dismisses, editor title is now `Ground Floor`, canvas is an empty dotted grid, and the action bar has collapsed to a **single** full-width `Insert` item. Caption reads `Swipe up ↑ for Ground Floor info` |
| **Mechanism** | The action bar is derived from selection depth *and* content: at FLOOR level with zero rooms, `Rotate` is dropped (nothing to rotate), leaving only `Insert`. Selecting the floor level from the sheet also switches the editor's active floor, so the sheet is both creator and switcher |
| **Build note** | Compute action-bar items from `(selectionDepth, hasContent)`; don't ship a disabled `Rotate`. Creating a floor should immediately make it active. |

---

### INT-E07 — Open the Insert menu

| | |
|---|---|
| **Before** | `screens/19-floorplan-editor-2d.jpg` — FLOOR level, action bar `Insert | Rotate` |
| **Action** | Single tap on `Insert` (left item of the bottom action bar) |
| **After** | `screens/27-insert-menu.jpg` — a compact popover rises from the `Insert` item with five rows, label left / glyph right: `Room` (plan glyph), `Object` (sofa glyph), `Note` (text glyph), `Photo` (camera glyph), `Form` (clipboard glyph). Canvas and action bar stay put behind it |
| **Mechanism** | One insert vocabulary for every depth. Per spec §4.6 the items attach to the **current selection context**, so the same five rows mean different things at floor / room / object depth (e.g. `Note` on a selected door opens that door's notes) |
| **Build note** | A single `insert(kind:into: selection)` entry point. The menu is constant; the target is whatever is selected. |

---

### INT-E08 — Insert → Room → method chooser

| | |
|---|---|
| **Before** | `screens/27-insert-menu.jpg` — Insert popover open, `Room` is the first row |
| **Action** | Single tap on `Room` |
| **After** | `screens/28-add-room-method-chooser.jpg` — full-height sheet `Add Room` / "Choose a method", `✕`. Two large illustrated cards side by side, each with a dark `LiDAR` badge top-right: `Auto-Scan` — "Scan multiple rooms. Auto object detection." and `Manual-Scan` — "Scan one room. Manual object detection.". Below, three list rows with leading isometric glyphs and chevrons: `Add Square Room` — "Start with a template. Then tweak the shape."; `Draw Room` — "Add corner points to build the room shape."; `Add Filler…` — "Automatically fill the space between rooms." |
| **Mechanism** | Deliberate hierarchy: hardware paths get illustrated cards, manual fallbacks get rows. Per spec §4.6a the 5th row is contextual — `Import & Draw` on an empty floor, `Add Filler…` once rooms exist (this frame is from a populated floor) |
| **Build note** | Card vs row is a promotion decision, not a component difference. Make the last row context-dependent on whether the floor has geometry. |

---

### INT-E09 — Method → Select Room Type

| | |
|---|---|
| **Before** | `screens/28-add-room-method-chooser.jpg` — `Draw Room` row |
| **Action** | Single tap on a method row (frames captured for the `Draw Room` path) |
| **After** | `screens/30-select-room-type.jpg` — sheet replaced (back chevron top-left, so it is a push inside the sheet) titled `Select Room Type`. Stock segmented control `Residential | Commercial` with Residential selected. Group header `Room Type`, six rows — Kitchen, Dining Room, Living Room, Bedroom, Bathroom, Balcony — then a blue `See more` row |
| **Mechanism** | Every creation method funnels through the same classifier before geometry. Room type is a required attribute at creation, not an afterthought, because the Living Area Calculation is keyed off it (spec §3). Six-then-`See more` is the same "most common first" pattern as Add Floor |
| **Build note** | One shared `SelectRoomType` screen, pushed by all creation methods. Store `roomType` as a required field; drive living-area percentage from it. |

---

### INT-E10 — Draw Room canvas

| | |
|---|---|
| **Before** | `screens/30-select-room-type.jpg` — room type list |
| **Action** | Single tap on a room-type row |
| **After** | `screens/33-draw-room-canvas.jpg` — sheet dismisses into a dedicated drawing mode: nav bar is now `Cancel` (blue, left) · title `Draw Room` with subtitle *"Close the shape to save"* · undo / redo below. **No bottom action bar.** The canvas background changes from the dotted grid to a fine orange/pink squared grid, and all existing rooms are ghosted to thin light-grey outlines with no fills or labels |
| **Mechanism** | Drawing is a modal sub-mode with its own chrome and its own undo stack — `Cancel` replaces `back`, and the only exit that saves is closing the polygon. Ghosting existing rooms keeps them as snapping/alignment context without letting them be selected. The grid changing texture signals "you are now in a metric drawing space" |
| **Build note** | Push a modal draw session holding a temporary vertex list and its own undo stack; render committed geometry read-only underneath at low contrast. |

---

### INT-E11 — Place a corner point

| | |
|---|---|
| **Before** | `screens/33-draw-room-canvas.jpg` — empty draw session, no points |
| **Action** | Single tap anywhere on the canvas to place a corner; repeat to place the next |
| **After** | `screens/34-draw-room-handles-detail.jpg` (crop) — a small hollow white dot with a grey ring marks the previous corner, a thin dark segment runs from it, and the **active** corner is a large blue 4-way arrow manipulator with a white centre dot. Same state visible at phone scale in `screens/35-discard-changes-confirm.jpg` |
| **Mechanism** | Two handle vocabularies: hollow dot = committed vertex, blue 4-way = the vertex currently under manipulation. The 4-way arrows imply the active point is draggable in both axes, not just tappable. Nothing persists until the polygon closes (spec §4.6) |
| **Build note** | Keep `vertices[]` plus an `activeIndex`; render only the active vertex with a drag manipulator. Commit to the model on closure, not per tap. |

---

### INT-E12 — Cancel a draw → Discard Changes confirm

| | |
|---|---|
| **Before** | `screens/33-draw-room-canvas.jpg` / `screens/35-discard-changes-confirm.jpg` — draw session with at least one segment placed |
| **Action** | Single tap on `Cancel` in the nav bar |
| **After** | `screens/35-discard-changes-confirm.jpg` — a single-row popover drops from `Cancel`: red label `Discard Changes` with a red trash glyph. No "keep editing" row — dismissing the popover is the cancel path. The in-progress geometry is still visible behind it |
| **Mechanism** | Two-step destructive confirmation with exactly one affirmative action, coloured red, tethered to the control that triggered it. The absence of a negative row makes tap-outside the safe default |
| **Build note** | Confirm-by-popover anchored to the trigger; only the destructive option is a button. Applies to `Delete…` / `Archive…` too. |

---

### INT-E13 — Add Square Room → template room created

| | |
|---|---|
| **Before** | `screens/28-add-room-method-chooser.jpg` → `screens/30-select-room-type.jpg` — `Add Square Room` row, then a room type (`Living Room`) |
| **Action** | Single tap `Add Square Room`, then single tap the `Living Room` room-type row |
| **After** | `screens/36-square-room-created.jpg` and crop `screens/37-square-room-detail.jpg` — a 2.500 × 2.500 m square room is dropped onto the empty Ground Floor **already selected**. Title becomes `Living Room` with subtitle `Ground Floor`. The room renders as grey wall band + black inner line, fine white grid fill, four white circular corner handles with dark rings, and a blue `2.500` dimension string on all four sides with extension lines and tick ends. Action bar is now five items: `Insert · Set Size · Edit Layout · Duplicate · Delete…` (Delete red). Caption `Swipe up ↑ for Living Room info` |
| **Mechanism** | Creation auto-selects the new entity and pushes selection depth to ROOM, which is what rewrites the title (title + subtitle = entity + parent floor) and the action bar. `Set Size` is present only for template/square rooms — compare INT-E22 where a drawn/scanned room shows a four-item bar without it. Default template is 2.5 m square with no manual dimensions set |
| **Build note** | After insert, set `selection = newRoom`. Gate `Set Size` on a `isParametricRectangle` flag on the room, set at creation by the square-room template. |

---

### INT-E14 — Set Size → Change Measurement panel

| | |
|---|---|
| **Before** | `screens/36-square-room-created.jpg` — Living Room selected, action bar item 2 is `Set Size` |
| **Action** | Single tap on `Set Size` |
| **After** | `screens/38-change-measurement-panel.jpg` — a modal panel covers the bottom ~55% of the screen. Above it the canvas stays live but scrolls/zooms so the **active wall is highlighted**: the top wall is drawn heavy and its `2.500` label is boxed in blue. Panel contents top to bottom: title `Change Measurement` with subtitle `Metric • Change Unit…` (`Change Unit…` blue) and `✕` at right; full-width bordered button `⊕ Laser`; a large centred readout `2.500` with a small grey `m`; helper text *"Enter a value or use Bluetooth measures"*; a custom 4-row keypad `1 2 3 / 4 5 6 / 7 8 9 / . 0 ⌫`; full-width dark primary button `Next` |
| **Mechanism** | This is a wall-by-wall sequential entry wizard, not a form. The canvas is kept visible and the active wall is highlighted so the number always has a referent. The keypad is custom (no return/keyboard chrome, `.` in the bottom-left slot) because the domain has exactly one input type. `⊕ Laser` is a Bluetooth distance-meter pairing affordance sitting at the same level as manual entry |
| **Build note** | Build one `MeasurementEntry` component: active-wall highlight + big readout + custom pad + one primary button whose label depends on queue position. Do not use the system keyboard. |

---

### INT-E15 — Change Unit… → Change Units picker

| | |
|---|---|
| **Before** | `screens/38-change-measurement-panel.jpg` — subtitle `Metric • Change Unit…` |
| **Action** | Single tap on the blue `Change Unit…` link in the panel subtitle |
| **After** | `screens/39-change-units-metric.jpg` — full-screen sheet: leading glyph + `Change Units` / "Pick a unit of measurement", `✕`. Stock segmented control `Metric | Feet | Inches` (Metric selected). Below it a picker wheel whose highlighted middle row is `2.500 m`, with `2.50 m` above and `250 cm`, `250.0 cm` below. Blue full-width `Apply Changes` at the bottom, footnote *"Changes will affect the current and new projects. Existing projects will not be affected."* |
| **Mechanism** | Unit system and display precision are a **single combined choice** — the wheel enumerates precision variants of the selected system, all showing the same physical length so the user compares formats, not values. The footnote scopes the change: current project + future projects, existing ones untouched, i.e. the setting is copied onto a project at creation rather than read live from a global |
| **Build note** | One `unitFormat` value (system + precision) stored per project and mirrored into a global default. Render the wheel from the currently entered length so the options are self-illustrating. |

---

### INT-E16 — Switch unit system inside the picker

| | |
|---|---|
| **Before** | `screens/39-change-units-metric.jpg` — `Metric` segment selected, wheel showing metre/centimetre variants |
| **Action** | Single tap on the `Feet` segment, then on the `Inches` segment |
| **After** | `screens/40-change-units-feet.jpg` (crop) — `Feet` selected; wheel now reads `1' 6"` (highlighted), `1' 6" 1/2"`, `1' 6" 1/4"`. `screens/41-change-units-inches.jpg` (crop) — `Inches` selected; wheel reads `18"` (highlighted), `18" 1/2"`, `18" 1/4"` |
| **Mechanism** | The wheel repopulates per system while the underlying length is unchanged (1' 6" = 18" = the same value). Imperial precision is expressed as **fractions** (1/2, 1/4), metric as decimal places — two different precision ladders, not one shared "decimals" setting |
| **Build note** | Precision is a per-system enum: metric = decimal places, imperial = fractional denominator. Formatter takes `(system, precision)` and a length in metres. No frame captures the result of `Apply Changes`; *[inferred]* it dismisses back to the Change Measurement panel with the readout reformatted. |

---

### INT-E17 — Enter a value, tap Next → live geometry update

| | |
|---|---|
| **Before** | `screens/38-change-measurement-panel.jpg` — square room 2.500 × 2.500, top wall active, readout `2.500`, button `Next` |
| **Action** | Tap keypad digits to overwrite the readout (`4`, `.`, `0`, `0`, `0`), then single tap `Next` |
| **After** | `screens/42-measurement-next-live-resize.jpg` — the canvas above has **already redrawn**: the room is now a 4.000-wide rectangle, its top dimension reads `4.000` with a small padlock glyph, the bottom reads `4.000`. The active-wall highlight has moved to the **right** wall, whose `2.500` label is boxed in blue. The readout resets to that wall's current value `2.500`, and the primary button label has changed from `Next` to **`Apply`** |
| **Mechanism** | `Next` commits the current wall, advances the queue, and re-renders immediately — geometry updates *during* the wizard, not at the end. The queue for a rectangle is two entries (width, then height), not four, so the second tap is already the last: the button label is derived from `isLastInQueue`. The padlock appears on the wall the moment its value is committed |
| **Build note** | Drive the panel from a queue of wall references; `Next` = `commit + advance`, label = `queue.isLast ? "Apply" : "Next"`. Recompute and redraw geometry on every commit. Collapse opposite walls of a parametric rectangle into one queue entry. |

---

### INT-E18 — Apply → committed room

| | |
|---|---|
| **Before** | `screens/42-measurement-next-live-resize.jpg` — right wall active, readout `2.500`, button `Apply` |
| **Action** | Single tap on `Apply` |
| **After** | `screens/43-room-resized.jpg` — panel dismisses, canvas returns to full height, room committed at 4.000 × 2.500 and still selected (white corner handles, all four dimension strings, five-item action bar with `Set Size`). Title still `Living Room / Ground Floor` |
| **Mechanism** | `Apply` ends the wizard and returns to ROOM selection depth rather than deselecting — the user is expected to keep working on the same room (Edit Layout, Insert an object). Room stays parametric, so `Set Size` remains available for re-entry |
| **Build note** | Closing the measurement wizard restores the previous selection; it does not reset to floor level. |

---

### INT-E19 — Padlocks on manually set dimensions

| | |
|---|---|
| **Before** | `screens/36-square-room-created.jpg` / crop `screens/37-square-room-detail.jpg` — the untouched 2.500 square: four blue dimension strings, **no padlock on any of them** |
| **After** | `screens/43-room-resized.jpg` / crop `screens/44-manually-set-dimension-padlock.jpg` — after the wizard, the **top** `4.000` and the **right** `2.500` each carry a small dark padlock glyph immediately after the number. The **bottom** `4.000` and **left** `2.500` show the same values with **no** padlock |
| **Action** | None — this is the persistent visual consequence of INT-E17/E18 |
| **Mechanism** | `isManuallySet` is stored per *dimension*, and only the wall the user actually typed into gets it. The opposite wall carries an identical derived value and stays unlocked, which proves the flag records provenance, not equality. Spec §3 ties this to the export option *"Only dimensions that have been manually set"* — the padlock is the on-canvas preview of what that export will print |
| **Build note** | `isManuallySet: Bool` per dimension, set only by direct entry (keypad or laser), never by derivation or by drag. Render the padlock inline after the value. |

---

### INT-E20 — Enter Edit Layout

| | |
|---|---|
| **Before** | `screens/43-room-resized.jpg` — Living Room selected, action bar `Insert · Set Size · Edit Layout · Duplicate · Delete…` |
| **Action** | Single tap on `Edit Layout` (centre item, 4-way arrow glyph) |
| **After** | `screens/45-edit-layout-mode.jpg` and crop `screens/46-edit-layout-handles-detail.jpg` — room fill turns light blue with a blue inner border; **all dimension strings and corner handles disappear**; the centred label `Living Room / 10.00 m²` remains and two blue manipulators are drawn over it — a 4-way move arrow on the label's centre and a curved rotate arrow to its right. Action bar reduces to three items: `Insert · Duplicate · Delete…`. Title subtitle (`Ground Floor`) is dropped, leaving just `Living Room` |
| **Mechanism** | Edit Layout is a *placement* mode, not a *shape* mode: it moves and rotates the room as a rigid body, so per-wall dimensions are meaningless and are hidden, and size-editing actions (`Set Size`, `Edit Layout` itself) drop out of the bar. The blue fill is the mode indicator. Area (10.00 m²) stays visible because it is invariant under move/rotate |
| **Build note** | A sub-mode flag on the selected room that swaps the renderer (fill + manipulators, no dimensions) and filters the action bar. Transform is rigid: translation + rotation only. |

---

### INT-E21 — Move / rotate a room

| | |
|---|---|
| **Before** | `screens/45-edit-layout-mode.jpg` — blue room with 4-way move and curved rotate manipulators |
| **Action** | Press-and-drag the 4-way manipulator to translate; press-and-drag the curved arrow to rotate |
| **After** | **No after-frame was captured.** The screenshots show only the resting state of Edit Layout; no mid-drag or post-drag frame exists |
| **Mechanism** | *[inferred]* Two separate manipulators means translation and rotation are separate gestures on separate hit targets rather than a combined free transform; the curved arrow's position offset to the right of centre implies rotation about the room centroid with the handle as a lever |
| **Build note** | Two hit targets, two drag handlers, one transform. *[inferred]* Snap translation to the grid and rotation to increments, with live snapping feedback — nothing in the captures confirms either. |

---

### INT-E22 — Select a room by tapping it

| | |
|---|---|
| **Before** | `screens/19-floorplan-editor-2d.jpg` — 2nd Floor, nothing selected; all rooms grey-filled with centred `<name> <area>` labels, action bar `Insert | Rotate` |
| **Action** | Single tap inside a room's fill on the canvas (`Kitchen`) |
| **After** | `screens/47-room-selected.jpg` and crop `screens/48-room-selected-dimensions-detail.jpg` — title becomes `Kitchen` / `2nd Floor`. The tapped room gets the fine white/hatched fill and heavy black walls; **sibling rooms fade to thin grey outlines with no fills and no labels**. Every wall of the selected room gains a blue dimension string on extension lines with tick ends, including sub-segment chains where a wall is broken by openings (e.g. `9.116` overall with `1.026 / 1.510 / 0.882` beneath, `8.058` with `0.669 / 1.246` and `3.154`). Action bar becomes `Insert · Edit Layout · Duplicate · Delete…` — **four items, no `Set Size`** |
| **Mechanism** | Selection is by fill hit-test, and it changes global canvas rendering: unselected siblings are demoted to context. The multi-level dimension chain says walls are stored as segmented runs, not single lengths. The missing `Set Size` (vs INT-E13) confirms it is gated on the room being a parametric template rather than on selection depth |
| **Build note** | Selection state drives a per-room render style (`selected / sibling`). Wall model = ordered segments so the chain can be drawn at two levels. |

---

### INT-E23 — Open the room inspector

| | |
|---|---|
| **Before** | `screens/47-room-selected.jpg` — Kitchen selected, grabber above the action bar, caption `Swipe up ↑ for Kitchen info` |
| **Action** | Swipe up from the grabber / action bar (drag gesture from the bottom edge of the canvas upward) |
| **After** | `screens/49-room-inspector-details.jpg` — a multi-detent sheet rises to roughly full height, replacing the action bar. Segmented `Details | Photos & Notes | Forms` with Details active. Content: `Statistics` header with blue `See All`, then a 4-tile row `24.69 m² Floor Area · 54.81 m² Wall Area · 21.27 m Perimeter · 60.46 m³ Volume`; `Dimensions` group — `Ceiling Height 2.449 m` (stepper), `Living Area (%) 100`; `Affected Areas` header with an `(i)`, a blue `+ Add New Area` row and the explainer *"Define one or more affected areas (overlapping allowed) within a room or a wall. Affected areas can be included in your exports."*; `General` group — `Floor 2nd Floor ›`, `Room Type Other ›`, `Room Name Kitchen`, `Room Color` swatch; footer `+ New Field ↗` |
| **Mechanism** | The universal inspector: identical three-tab shell at floor, room and object depth, opened by the same swipe from the same grabber. Read-only computed statistics sit above editable fields — measurement output and measurement input in one surface. `Floor` being an editable row means room→floor reparenting is a property edit, not a drag |
| **Build note** | One `InspectorSheet<Entity>` with three fixed tabs; feed it a computed-stats block plus a field list. Make parent (`Floor`) an editable enum row. |

---

### INT-E24 — Open the floor inspector

| | |
|---|---|
| **Before** | `screens/26-empty-floor-editor.jpg` — FLOOR level, caption `Swipe up ↑ for Ground Floor info` |
| **Action** | Same swipe-up gesture with nothing selected |
| **After** | `screens/52-floor-inspector-wall-thickness.jpg` — the same sheet, headed by a row `(i) Ground Floor` with a collapse chevron at the right. Tabs `Details | Photos & Notes | Forms`. `Statistics` + `See All`: `10.00 m² Floor Area · 29.52 m² Wall Area · 24.40 m³ Volume · 1 # Rooms`. `Dimensions` group — `Ceiling Height 2.440 m`, **`Interior Wall Thickness 0.120 m`**, **`Exterior Wall Thickness 0.250 m`** (all steppers). `General` — `Floor Name` with grey placeholder `Add Text`. Footer `+ New Field ↗` and the explainer *"Collect important information and improve your reports by creating your own fields."* |
| **Mechanism** | Wall thickness is a **floor-level** property, not per wall or per room — one interior and one exterior value drive every wall on the floor. That is what makes the two area definitions in spec §3 computable (`with all walls` uses the exterior thickness). The stat tile set differs from the room's (`# Rooms` instead of `Perimeter`), so the tile row is entity-specific while the shell is shared |
| **Build note** | Store `interiorWallThickness` / `exteriorWallThickness` on Floor; classify each wall as interior or exterior from adjacency and pick the thickness at render/compute time. |

---

### INT-E25 — Object library opened with nothing selected (gated)

| | |
|---|---|
| **Before** | `screens/27-insert-menu.jpg` — Insert popover at FLOOR level (`2nd Floor`, no selection), row `Object` |
| **Action** | Single tap on `Object` |
| **After** | `screens/53-object-library-all-objects.jpg` — sheet over the editor: `Edit` (blue, left) · `All Objects` · `✕`; grey search field `Search`; a dismissible tip card *"DID YOU KNOW? You can now tap & hold to drag and drop the objects directly onto the canvas"* with its own `✕`; `Recently used` horizontal rail — **every card is dimmed grey with a circle-slash glyph and the overlay text "Only available in rooms"** (Arch Door, Rectangular mirror, Bath…); then the category list with counts: Annotations 25, Doors 17, Windows 15, Structural 27, Plumbing 57, Appliances 29, Kitchen Cabinets 37, Furniture 126, Electrical 69 (scrolls) |
| **Mechanism** | The gate is on *insertion*, not on browsing: the sheet, search and categories all open normally and only the object cards are disabled, each carrying its own reason. Objects therefore require a room parent in the data model — there is no floor-level object |
| **Build note** | `canInsertObject = selection is Room || selection is Object`. Disable the cards, not the sheet, and stamp the reason on the card itself. |

---

### INT-E26 — Category drill-down keeps the gate

| | |
|---|---|
| **Before** | `screens/53-object-library-all-objects.jpg` — category list, still nothing selected; full list with all 14 categories visible in `screens/54-object-library-categories.jpg` (…Outdoors 52, HVAC 34, Garage 13, Fire and Safety 136, Restoration 29, plus a footer `+ New Object ↗`) |
| **Action** | Single tap on the `Doors 17 ›` row |
| **After** | `screens/55-object-category-doors-gated.jpg` and crop `screens/56-object-gating-detail.jpg` — pushed screen: back chevron · `Doors` / `17 items` · `✕`; search; 2-column grid of cards (Arch Door, Bypass Door, Door with Window, Double Folding Door, Double Hinged Door, Double Pocket Door…). Each card carries an isometric render with a red swing-direction arrow and a favourite star top-right — and **every card is still dimmed with the circle-slash and "Only available in rooms"** |
| **Mechanism** | The disabled state is a property of each object card and is carried through navigation rather than re-evaluated per screen. The favourite star stays interactive-looking, implying favouriting is not gated by selection *[inferred — no frame shows a star being tapped]* |
| **Build note** | Compute the gate once in the library's view model and pass it down; render it on the card component so every grid inherits it. |

---

### INT-E27 — Select a room → library enables

| | |
|---|---|
| **Before** | `screens/53-object-library-all-objects.jpg` — `2nd Floor` title, all object cards dimmed |
| **Action** | Dismiss, tap a room on the canvas to select it (title becomes `Kitchen / 2nd Floor`), reopen `Insert → Object` |
| **After** | `screens/57-object-library-enabled-in-room.jpg` — byte-for-byte the same sheet layout, but the `Recently used` cards now render in **full colour with no overlay** (Arch Door with its red swing arrow, Rectangular mirror, Bath…) and the favourite stars are visible on each card. Title bar above the sheet reads `Kitchen / 2nd Floor` |
| **Mechanism** | The only variable is selection depth. The library does not need reopening logically — it re-derives from selection — which makes "disabled with a stated reason" a genuinely reversible affordance rather than a dead end |
| **Build note** | Bind the library's enabled state to the live selection so it flips without a reload. |

---

### INT-E28 — Insert an object → auto-snap into a wall

| | |
|---|---|
| **Before** | `screens/57-object-library-enabled-in-room.jpg` — library enabled with a room selected (the captured result is on the Ground Floor `Living Room`, 4.000 × 2.500) |
| **Action** | Single tap on an object card (`Arch Door`). *[inferred]* Per the tip card in the same sheet, tap-and-hold then drag onto the canvas is an alternative placement gesture — no frame captures it |
| **After** | `screens/59-object-inserted-arch-door.jpg` — sheet dismisses; the door is placed **in the top wall**, drawn as an opening in the wall band with a quarter-circle swing arc into the room, wrapped in a blue bounding box. Title becomes `Arch Door` / `Ground Floor` — note the subtitle is the **floor**, not the host room. Action bar becomes `Insert · Replace with… · Rotate · Duplicate · Delete…`. Caption `Swipe up ↑ for Arch Door info` |
| **Mechanism** | Insertion snaps to the nearest wall and immediately selects the new object (depth OBJECT). The object is stored as a wall opening with a position along that wall plus a swing direction — the arc is generated, not part of the catalogue render. Two new bar items appear at this depth: `Replace with…` and `Rotate` |
| **Build note** | `Object { catalogueRef, hostWall, offsetAlongWall, width, height, distanceToFloor, swing }`. On insert: pick nearest wall, clamp offset, select. |

---

### INT-E29 — Object dimension chain

| | |
|---|---|
| **Before** | `screens/43-room-resized.jpg` / crop `screens/44-manually-set-dimension-padlock.jpg` — the top wall carries a single dimension string `4.000 🔒` |
| **After** | `screens/59-object-inserted-arch-door.jpg` and crop `screens/60-object-dimension-chain-detail.jpg` — with the door selected, the host wall's dimension display **splits into two rows**: the overall `4.000 🔒` stays on the outer row, and an inner row reads `1.550 · 0.900 · 1.550` — left offset, object width, right offset. Small square drag handles sit at the two segment boundaries (aligned with the door jambs). The other three walls keep single strings |
| **Action** | *[inferred]* Drag a boundary handle along the wall to reposition the opening; the offsets and the object width are the editable quantities. **No before/after drag pair was captured** |
| **Mechanism** | 1.550 + 0.900 + 1.550 = 4.000 exactly, so the chain is a constraint over the parent wall length: the two offsets and the width sum to the wall. Only the host wall splits, and only while the object is selected — the chain is a selection-scoped projection of the wall, not stored geometry. The overall `4.000` keeps its padlock while the derived sub-segments have none |
| **Build note** | Render the chain from `(offset, width, wallLength - offset - width)`; dragging a handle edits `offset` and recomputes the trailing segment. Sub-segments are derived and never carry `isManuallySet`. |

---

### INT-E30 — Open the object inspector

| | |
|---|---|
| **Before** | `screens/59-object-inserted-arch-door.jpg` — Arch Door selected, caption `Swipe up ↑ for Arch Door info` |
| **Action** | Swipe up from the grabber above the action bar |
| **After** | `screens/61-object-inspector-details.jpg` — same inspector shell: header row `(i) Arch Door` with collapse chevron; `Details | Photos & Notes | Forms`. `Dimensions` group — `Width 0.900 m`, `Height 2.440 m`, `Distance to Floor 0.000 m`, each a stepper. Then a standalone card: glyph + `Include in PDF` with sub-label *"The dimensions above will not be included in a PDF export."* and an iOS toggle in the **off** position. `Settings` group — `Display Label  Never ›`. Footer `+ New Field ↗` + the same "create your own fields" explainer |
| **Mechanism** | Same shell, entity-specific field list, and **no Statistics tile row** — objects have no derived measurements, only declared ones. `Height 2.440 m` equals the floor's ceiling height, i.e. the arch door was created full-height from the floor default. `Distance to Floor 0.000` is the sill height, which is what lets the same field set describe a window |
| **Build note** | Reuse the inspector; make the stats block optional. Width/Height/DistanceToFloor is a sufficient opening model for doors and windows alike; default Height from the floor's ceiling height. |

---

### INT-E31 — Display Label options

| | |
|---|---|
| **Before** | `screens/61-object-inspector-details.jpg` — `Settings` group, row `Display Label  Never ›` |
| **Action** | Single tap on the `Display Label` row |
| **After** | `screens/62-display-label-options.jpg` — pushed screen, back chevron, title `Select 1 item`. Group header `Display Label`, four radio rows each pairing a radio with a small monochrome micro-diagram of a wall/label arrangement: `Never` (radio filled blue), `Above the object`, `Over the object`, `Below the object` |
| **Mechanism** | Enum-with-illustration pattern: each option ships a diagram because the words alone ("over" vs "above") are ambiguous on a plan. The generic title `Select 1 item` shows this is a reusable single-select component parameterised by the group header |
| **Build note** | One generic single-select screen taking `(groupTitle, options[label, diagram])`. Ship diagrams for any spatial enum. |

---

### INT-E32 — Replace with… (pre-filtered picker)

| | |
|---|---|
| **Before** | `screens/59-object-inserted-arch-door.jpg` — Arch Door selected, action bar item 2 is `Replace with…` |
| **Action** | Single tap on `Replace with…` |
| **After** | `screens/58-replace-with-prefiltered.jpg` — the object picker opens **already inside the `Doors` category** (`Doors` / `17 items`, back chevron, `✕`, search, 2-column grid) rather than at `All Objects`. All cards are fully enabled. Nav title above the sheet still reads `Arch Door / Ground Floor` |
| **Mechanism** | The picker is the same component as INT-E26 but launched with an initial category derived from the selected object's own category, and with a "replace" completion instead of "insert". The back chevron is still present, so the user can escape upward to all categories |
| **Build note** | `ObjectPicker(initialCategory:, mode: .insert | .replace(target:))`. Replace should preserve `hostWall`, `offsetAlongWall` and dimensions where compatible *[inferred — no after-frame of a completed replacement]*. |

---

### INT-E33 — Elevation unlocks inside a room

| | |
|---|---|
| **Before** | `screens/21-view-mode-menu.jpg` — FLOOR level, `Elevation View` greyed with *"Only available inside rooms"* |
| **Action** | Select something inside a room (here the Arch Door — title `Arch Door / Ground Floor`), then tap the view-mode stepper again |
| **After** | `screens/22-view-mode-menu-elevation-enabled.jpg` — the same three-row menu, but `Elevation View` is now black/enabled and its subtitle has changed from the blocking reason to a **hint**: *"You can also double-tap on a wall"* |
| **Mechanism** | One subtitle slot carrying two different message types — precondition when disabled, shortcut when enabled. The alternate gesture (double-tap a wall) is disclosed only once it is usable, and it selects the wall and switches mode in one action *[inferred — no frame captures the double-tap itself]* |
| **Build note** | Give menu rows an optional subtitle that resolves to `reason` when disabled and `hint` when enabled. Wire double-tap-on-wall to the same command. |

---

### INT-E34 — Elevation view

| | |
|---|---|
| **Before** | `screens/22-view-mode-menu-elevation-enabled.jpg` — menu open, `Elevation View` enabled, canvas in 2D plan |
| **Action** | Single tap on the `Elevation View` row |
| **After** | `screens/63-elevation-view.jpg` and crop `screens/64-elevation-view-detail.jpg` — the canvas swaps to a straight-on view of the host wall, with the two adjoining side walls folded away in grey perspective (trapezoids left and right). The door is drawn **architecturally** — a rectangular leaf with a handle and two transom lights above — inside a blue selection box. Dimensions: the offset chain `1.550 · 0.900 · 1.550` runs above the wall; wall height `2.440` runs vertically down **both** jambs/edges; wall length `4.000 🔒` runs below. The view-mode stepper glyph changes from `2D` to an elevation icon, and the nav-bar leading glyph becomes the blue `2D` escape label. Action bar drops `Rotate`: `Insert · Replace with… · Duplicate · Delete…` |
| **Mechanism** | Elevation is a per-wall 2D projection with its own dimension conventions (height on both edges is a drafting convention, not redundancy). `Rotate` disappears because in-plane rotation is undefined on a wall face — the action bar is filtered by view mode as well as selection depth. The padlock carries across views, confirming `isManuallySet` lives on the dimension, not the drawing |
| **Build note** | Elevation renderer takes a wall reference and draws face + folded neighbours + the same segment chain. Filter the action bar by `(selectionDepth, viewMode)`. Per spec §4.6a a `←/→` wall stepper exists to walk walls in sequence — worth adding. |

---

## Open questions

The screenshots do not answer these; none should be guessed at during implementation.

1. **Draw Room closure.** No frame shows a polygon being closed or the resulting room. Unknown: the close gesture (tap the first vertex? auto-close on proximity?), whether a snap/close indicator appears, and whether `Select Room Type` is shown before or after drawing for this path.
2. **Corner dragging while drawing.** The active vertex carries a 4-way manipulator, but no mid-drag frame exists. Unknown whether it snaps to grid, to axis, or to neighbouring room walls.
3. **Edit Layout move/rotate results.** No post-drag frame. Snap increments, rotation pivot, and whether rooms snap wall-to-wall with adjacent rooms are all unknown.
4. ~~**Floor-level `Rotate`.**~~ **CLOSED 24 Aug 2026** — the owner walked it
   on his own device and sent four frames, now saved as
   `screens/91-storey-rotate-frame1..4.webp`. They had been sent in a chat
   and never written to disk, which cost a build that guessed at the design;
   they are in the repo now for that reason.

   It arms a MODE, it does not turn by increments. What the frames show:

   * The plan turns as ONE rigid body, furniture and all, about the centre
     of the drawing.
   * **The grid does NOT turn.** It stays screen-aligned, and it is what
     makes the turn legible — the plan turns *on* the paper.
   * **Room labels stay screen-upright** through the turn.
   * **The affordance** is an amber pin on the drawing's corner, a dashed
     grey arc through it centred on the pivot, and a heavy blue
     DOUBLE-headed arrow at the pin, tangent to the arc.
   * **A pale grey ghost** of the plan's previous position sits under it,
     which is what says how far it has come.
   * The selected room is filled light blue with a blue border.
   * The view auto-zooms so the turning plan never leaves the screen — the
     owner caught this himself: *"did you see the auto zoom."*
5. **Object dimension-chain drag.** No before/after pair for dragging a chain handle. Unknown whether the offset is free or snapped, whether the object can be dragged past a corner onto the adjacent wall, and whether dragging a handle sets `isManuallySet` on the offset.
6. **Does a dragged wall set the padlock?** Only keypad entry was captured. Whether resizing by dragging a corner handle marks the dimension as manually set is unknown, and it changes what the "only manually set dimensions" export prints.
7. **`Apply Changes` in Change Units.** No after-frame; the return destination and whether the in-flight measurement is reformatted or reset is unverified.
8. **Laser pairing.** `⊕ Laser` was never tapped — pairing UI, device list and how a received measurement lands in the readout are undocumented.
9. **Tap-and-hold drag placement.** The library tip advertises drag-and-drop onto the canvas; no frame shows the drag, the drop target feedback, or what happens when dropped outside a room.
10. **Replace-with completion.** No frame after choosing a replacement. Whether position, width and custom fields survive the swap is unknown.
11. **Deselection.** No frame shows how selection is cleared (tap empty canvas? back chevron?), nor what the back chevron does at ROOM/OBJECT depth — pop one selection level or leave the editor.
    **Partly filled, 18 Aug 2026, from the owner's own use of the app rather
    than a captured frame:** tapping the canvas OUTSIDE the room's own shape
    is what leaves ROOM depth for FLOOR depth — there is no back chevron for
    this step at all. Take as an owner-observed fact, not a screenshot; still
    unknown whether it also clears a lesser selection (a selected wall/corner)
    in the same tap or needs one tap to deselect and a second to leave.
12. **Double-tap-on-wall.** Advertised in `screens/22-view-mode-menu-elevation-enabled.jpg` but never performed; unverified whether it works from floor level with no selection.
13. **Elevation wall stepper.** The `←/→` wall navigation is described in spec §4.6a from a recording but appears in none of these frames.
14. **3D interaction beyond panning.** Only a static 3D frame exists; rotate/orbit/zoom gestures and whether tapping a room in 3D selects it are unknown.
15. **`Edit` in the object library** (top-left of `screens/53-object-library-all-objects.jpg`) and **`+ New Object ↗`** (footer of `screens/54-object-library-categories.jpg`) were not opened.
16. **Multi-floor stacking.** Only one floor per project was captured in the editor, so alignment between floors and whether an upper floor traces the one below is unknown.
17. **`Affected Areas → + Add New Area`** (room inspector) was not exercised.
18. **Room `Color`** swatch behaviour and how colour affects canvas rendering were not captured.
