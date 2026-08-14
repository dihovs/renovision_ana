# Magicplan — Screen-by-Screen Workflow Spec

**Target:** Next.js web CRM + iOS (Capacitor + Apple RoomPlan) app for a Quebec water-damage restoration contractor doing **direct insurance work**.
**Purpose of this document:** give engineers the exact screen chain, per-screen control inventory, and data rules needed to build a magicplan-equivalent capture → document → price → export workflow.
**Status:** implementation spec derived from documentation research. It is a **model to build against**, not a description of our current app.

---

## 0. How to read this document

### 0.1 Label conventions

| Marker | Meaning |
|---|---|
| `"Label"` in double quotes | String that appeared verbatim in a fetched magicplan help page. Safe to treat as magicplan's real label. |
| `"Label"` **(UNCONFIRMED)** | The string appears in magicplan docs but with conflicting variants, or was reproduced by a summarizer rather than read directly. Do not treat as fact. |
| `Label` **(OURS)** | Research did not confirm any magicplan label for this control. This is our proposed string. Ours to change freely. |
| **(GAP)** | Magicplan has no equivalent. We are inventing the capability, usually because insurance work demands it. |

### 0.2 Two hard caveats engineers must internalise

1. **None of the magicplan research came from a running build of the app.** It came from help-center prose, marketing pages, API docs, and screen-recording frames of a *staging* build. Screen names like "Home Screen", "Project Dashboard", "Floor Level", "Room Level" are magicplan's **documentation headings** — it is unknown whether those strings appear in the product's title bars at all.
2. **We are not cloning magicplan's labels — we are cloning its chain.** The client's complaint is that our app has no chain: no path from opening a job to standing in a wet basement and coming out with a measured, photographed, priced room. Section 1 is the deliverable. Everything after it is detail.

### 0.3 The one architectural decision to copy

Magicplan is **room-based, not wall-based**. Verbatim: *"magicplan is a room-based program. Rather than simply adding a wall, you'll need to add a new room."* You cannot subdivide a space by drawing a wall. Rooms are created individually and then **assembled** (dragged together until they snap) into a floor.

This is the single most load-bearing constraint. Apple RoomPlan produces room-shaped output, so this maps cleanly onto our stack. **Adopt it.** Do not build a wall-graph editor.

---

## 1. NAVIGATION MAP

### 1.1 The primary chain — open a project → finish a scanned room

This is the chain. Every screen below must exist, be reachable, and have a defined back destination.

```
[App launch]
│
└─ SCREEN 1 — Project List                          (magicplan: "Home Screen")
   │  grid/list of project tiles + "Search bar" + "Favorites" / "Archived"
   │
   ├─ tap "+ New Project" ──────────► creates project, lands on SCREEN 2
   └─ tap an existing project tile ─► SCREEN 2
      │
      └─ SCREEN 2 — Project Dashboard               (magicplan: "Project Dashboard")
         │  scrolling sections: description/details, Statistics strip,
         │  "Floor Plans" section (list of floors), "Photos", "Files"
         │
         ├─ tap (+) on "Floor Plans"  ─► SCREEN 3
         └─ tap an existing floor row ─► SCREEN 4
            │
            ├─ SCREEN 3 — Floor Type Chooser        (pop-up, magicplan: floor-type pop-up)
            │  │  list of floor types; "Roof" confirmed at the bottom
            │  └─ pick a type ─► floor is created ─► lands on SCREEN 4 for that floor
            │
            └─ SCREEN 4 — Floor Plan Editor         (magicplan: "Floor Level")
               │  2D canvas of every room on THIS floor only. Never two floors stacked.
               │  Bottom-right "Floors" switcher. "3D". Undo/Redo. "i" → floor details.
               │
               └─ tap "+ Insert"  ─► SCREEN 5
                  │
                  └─ SCREEN 5 — Insert Menu         (pop-up)
                     │  confirmed entries on a normal floor: "Room", "Object"
                     │
                     └─ tap "Room" ─► SCREEN 6
                        │
                        └─ SCREEN 6 — Add a Room     (magicplan: the "Add a Room" pop-up)
                           │  THE CAPTURE-MODE CHOOSER. Entries (order UNCONFIRMED):
                           │    "Auto-Scan"            — LiDAR, multi-room  [RoomPlan]
                           │    "Start Manual-Scan"    — ARKit, one room
                           │    "Add a square room"    — no camera
                           │    "Draw Room"            — free-form on a grid
                           │    "Import and draw"      — trace over a photo
                           │    "Insert a filler"      — close gaps between rooms
                           │
                           ├─ SCREEN 7 — Room Type Picker
                           │     Residential / Commercial groupings.
                           │     ⚠ POSITION IN CHAIN IS CONTRADICTORY IN THE DOCS.
                           │     Our decision: put it AFTER capture, at commit time
                           │     (see §2.7 rationale) — one less gate before the camera.
                           │
                           └─ pick "Auto-Scan" ─► SCREEN 8
                              │
                              └─ SCREEN 8 — Auto-Scan Capture (camera, full screen)
                                 │  live wall detection; white = detecting,
                                 │  green = captured, orange = bad scan.
                                 │  red record button · white photo shutter · 2D/3D toggle
                                 │
                                 ├─ tap record to end room ─► "Confirm Scan" / "Discard & Rescan"
                                 ├─ repeat for more rooms (multi-room session)
                                 └─ tap "Done" ─► SCREEN 9
                                    │
                                    └─ SCREEN 9 — "Configure Floor Plan"
                                       │  "Include Objects" (Plumbing Fixtures /
                                       │  Appliances / Furniture) · "Session Replay"
                                       │
                                       └─ tap "Generate Floor Plan" ─► back to SCREEN 4
                                          with the scanned room(s) placed on the canvas
                                          │
                                          └─ tap a room ─► SCREEN 10
                                             │
                                             └─ SCREEN 10 — Room Editor  (magicplan: "Room Level")
                                                │  one room: walls, dimensions, objects.
                                                │  Room name shown top-right.
                                                │  "Edit Layout" · "Split Room" · "Merge Rooms"
                                                │  "Duplicate" · "Delete" · "Set Diagonal" · "+ Add"
                                                │
                                                └─ tap "i" (tablet) / swipe up (phone) ─► SCREEN 11
                                                   │
                                                   └─ SCREEN 11 — Detail Sheet
                                                      tabs: "Details" | "Photos & Notes" | "Forms"
                                                      • Details → "Measures" (ceiling height),
                                                        "General" (name, type, color, floor
                                                        assignment), custom Fields, statistics
                                                      • Photos & Notes → camera / library / note
                                                      • Forms → published room-level forms
                                                      • "Affected Area" → "Add New Area" ─► SCREEN 12
                                                         │
                                                         └─ SCREEN 12 — Affected Area Editor
                                                            polygon on the room floor,
                                                            pre-selected to the whole floor;
                                                            drag corners · tap edge to add corner ·
                                                            tap blue measurement to type exact ·
                                                            Name · Fill Color · "Done"
                                                            ─► back to SCREEN 11

                        ROOM IS "FINISHED" WHEN:
                          geometry captured (8→9) + name/type set (7 or 11)
                          + affected area drawn (12) + photos attached (11)
                          + moisture readings placed (§2.23) + form completed (11)
```

### 1.2 Branch chains off the same spine

```
SCREEN 4 (Floor Plan Editor)
├─ "+ Insert" → "Object" ──────────► Object Catalog (categories incl. "Restoration",
│                                     "Annotation", "Structural") → place → Object Editor
├─ "Floors" (bottom right) ────────► floor switcher (one floor at a time, never stacked)
├─ "3D" ───────────────────────────► 3D view of THIS floor only
└─ "Edit Layout" on a room ────────► assembly mode: drag room, green snap indicators,
                                      blue curved arrow rotates that one room

SCREEN 10 (Room Editor)
├─ tap a wall ─► Wall Selection: "Add Corner" · "Add Wall" · "Split Room" · "Delete"
│                └─ "i" → Wall Detail Sheet → "Affected Area" → wall-mounted damage area
│                └─ "Elevation" icon → Elevation View (required to see/edit wall areas)
├─ tap a corner ─► blue drag arrow · "Set Diagonal"
└─ tap a blue measurement ─► "Change Measurement" pop-up
                              scroll picker · "Apply" · "Unlock" · Bluetooth laser

SCREEN 2 (Project Dashboard)
├─ "Photos" section (+) ───────────► project photo roll-up
├─ "Files" ────────────────────────► generated exports + uploaded docs → PDF editor
├─ Statistics strip → "See All..." ► full project statistics
└─ Files and Sharing ──────────────► Report PDF · Sketch PDF · "Statistics" ·
                                      "Estimate Files" · "Verisk" (ESX → Xactimate)

Estimator (tablet/desktop only in magicplan)
Project → Estimate → line item → Quantity field → calculator icon
   → "Formula" modal (per-room measured variables) → "= (Save)" → Quantity
   → Totals: Costs → +Markup → −Discount → Subtotal → +Tax → Total
   → "Export" → export preset panel → PDF/XLS
```

### 1.3 Back/exit semantics (define these before writing a line of code)

| From | Back goes to | Notes |
|---|---|---|
| Detail Sheet (11) | Room Editor (10) | Sheet dismiss, no data loss; saves are per-field. |
| Room Editor (10) | Floor Plan Editor (4) | Selection cleared. |
| Affected Area Editor (12) | Detail Sheet (11) | "Done" commits geometry. |
| Auto-Scan (8) | Floor Plan Editor (4) | Abandoning mid-scan must warn — scan data is unrecoverable. |
| "Configure Floor Plan" (9) | forward only, to (4) | This is a commit gate, not a browsing screen. |
| Manual-Scan AR | "Exit AR" → "Yes, I'm sure" → (4) | Two-step confirm is correct; copy it. |
| Floor Plan Editor (4) | Project Dashboard (2) | |

---

## 2. SCREEN-BY-SCREEN SPECIFICATION

---

### 2.1 SCREEN 1 — Project List (magicplan "Home Screen")

**Shows:** grid of project thumbnails. This is the CRM's job list; in our product it must be the *same* list as the web CRM's job list, not a parallel universe.

| Control | Label | Leads to |
|---|---|---|
| New project tile | `"+ New Project"` (also documented as "the New Project box with the plus sign (+)") | Creates a project and lands directly on the Project Dashboard — **no intake modal**. Magicplan collects name/description/address on the dashboard afterwards. **OURS: override this.** For insurance work we need claim identity captured at creation (§4). |
| Project search | `"Search bar"` | Filters the grid. |
| Category filter | `"Favorites"` / `"Archived"` (upper left) | Filters the grid. Favoriting is what makes a project **available offline** — carry this rule over verbatim; it is the offline-caching switch. |
| Scope switcher | Workspace / Team menu (upper left) | Switches ownership scope. |
| Project context menu | long-press tile, or the `"..."` ellipsis on the tile (lower right) | Menu items confirmed in prose: Favorite, `"Duplicate"`, move to workspace, archive. Exact menu strings for move/archive **UNCONFIRMED**. |
| Profile | `"Profile"` icon, bottom navigation bar | Account/app settings. Other bottom-nav tabs are **UNCONFIRMED** — only "Profile" was confirmed. |

**Duplicate dialog:** name the copy, choose destination workspace, toggle "include the original project's data", tap `"Duplicate"`. Without data, *"the new project will keep the same floor plan but start with a clean slate for reports, forms, and other project details."*

---

### 2.2 SCREEN 2 — Project Dashboard

**Shows:** a **scrolling stack of named sections**, not a tab bar. (Inferred from "locate the 'Floor Plans' section", "Scroll to locate the 'Photos' section" — the tabbed-vs-scrolled question is **UNCONFIRMED**; see §5.) Sections confirmed to exist, order **UNCONFIRMED**:

- project description block (name, description, author, creation date, living-area setting, custom Fields)
- statistics strip
- `"Floor Plans"` section — the floor list
- `"Photos"` section
- `"Files"` section — *"View all of your magicplan exports for the project"*
- project-level Details / Photos & Notes / Forms

| Control | Label | Leads to |
|---|---|---|
| Add floor | `(+)` on the `"Floor Plans"` section — the same action is written `"+ Add Floor"` elsewhere, and the section is called `"Floors"` in one article. **Three doc generations, one action.** **OURS: standardise on `+ Add Floor`.** | Floor Type Chooser (2.3) |
| Open floor | tap a floor row | Floor Plan Editor (2.4) |
| Floor menu | `"..."` next to a floor, or tap-and-hold | `"Duplicate Floor"` and delete. **Delete's exact menu string is UNCONFIRMED.** |
| Add photos | `(+)` on the `"Photos"` section | Camera / library. |
| Expand statistics | `"See All..."` | Full statistics list (2.19) |
| Project details | `"i"` icon upper right (tablet) / swipe up from the bottom (phone) | Detail Sheet for the project: "Details" / "Photos & Notes" / "Forms" |
| Exports | `"Files and Sharing"` | Export hub (2.20) |
| Estimate | button exists; **label UNCONFIRMED** — "Create an estimate" did not survive a verbatim re-read. **OURS: `New Estimate`.** | Estimator |

**Duplicate Floor dialog** (one dialog serves both duplicate-in-place and copy-to-another-project): source shown under "Project Name"; a `"To"` section picking an existing or new destination project; a floor-type selector; toggles for including `"Notes, Fields, Forms, or Media"`; then `"Duplicate"`. Same-project duplication = keep the original project selected and pick a different floor level.

---

### 2.3 SCREEN 3 — Floor Type Chooser (pop-up)

**Shows:** a list of floor types. **The full list is the single biggest gap in the research.** Only two values were ever confirmed: `"Roof"` (explicitly at the bottom of the list) and `"Land Survey"`. "Ground Floor" and "1st Floor" appear only as prose examples of floor *names*, never as menu entries.

**Do not hardcode a floor-type list from this research.**

**OURS — proposed list for Quebec residential water damage** (flat, no hierarchy, free-text renameable afterwards):
`Sous-sol / Basement` · `Rez-de-chaussée / Ground Floor` · `1er étage / 1st Floor` · `2e étage / 2nd Floor` · `Grenier / Attic` · `Garage` · `Toit / Roof` · `Autre / Other`

Basement matters disproportionately: it is where the water is, and it is what drives the Above Grade / Below Grade split in statistics.

**Also unknown and needing a decision from us:**
- **Floor ordering.** Completely unconfirmed in magicplan. No sort order, no drag-to-reorder, no numeric index found. **OURS: give every floor an integer `level` (basement = −1, ground = 0) and sort descending. Ship drag-to-reorder.**
- **Whether two floors of the same type can coexist.** Unknown. **OURS: allow it.**
- **Naming.** Floors have a `"Floor Name"` attribute so they are renameable, but whether the initial name derives from the type is unconfirmed. **OURS: type sets the initial name; renaming is free text and does not change the type.**

---

### 2.4 SCREEN 4 — Floor Plan Editor (magicplan "Floor Level")

**Shows:** the 2D assembled plan for **one floor only**. Verbatim hard limit: *"It is not possible to render two floors on top of each other in magicplan."* Overlapping rooms are a visible defect state — grey lines in 2D, grey shadow with black ceiling patches in 3D.

| Control | Label | Leads to |
|---|---|---|
| Add | `"+ Insert"` — written `"+ Add"` in the object and stairs articles. Same control, drifting docs. **OURS: standardise on `+ Insert`.** | Insert Menu (2.5) |
| Floor switcher | `"Floors"` (bottom right) | Swaps the editor to another level. A **switcher**, not a stacking control. |
| Rotate whole floor | `"Rotate"` (left side) | Green arrow appears centre-screen; drag to spin the **entire floor**; tap outside to confirm. This is the only cross-floor alignment tool that exists. |
| 3D | `"3D"` (top left on phone, bottom left on tablet) | 3D of this floor only (2.21) |
| Floor details | `"i"` icon in the top toolbar | Floor Detail Sheet: `"Measures"` → ceiling height; interior/exterior wall thickness; `"Floor Name"` |
| Undo / Redo | Undo & Redo (bottom right on tablet, upper left on mobile) | Works **across all rooms and floors**, not just the current selection. |
| Room actions (with a room selected) | `"Edit Layout"` · `"Duplicate"` · `"Delete"` · `"Merge Rooms"` | See 2.16 |

**Device-class placement rule — consistent across the whole product, adopt it wholesale:**
- Editor menu: **left side on tablet, bottom navigation on phone**
- Detail sheet: `"i"` icon upper right on tablet, **swipe up from the bottom action bar** on phone
- Undo/Redo: bottom right tablet / upper left mobile
- `"3D"`: top left phone / bottom left tablet
- Current selection name renders **upper right of the toolbar**

**Wall thickness is per-floor, not per-wall.** Verbatim: *"it is not possible to change the thickness of individual walls, you can only set an interior and an exterior wall thickness for each floor."* Default values are **UNCONFIRMED**. **OURS: interior 100 mm / exterior 200 mm, both editable.**

---

### 2.5 SCREEN 5 — Insert Menu (pop-up)

**Confirmed entries on a normal floor: `"Room"` and `"Object"`. That is all that was confirmed.** On a `"Land Survey"` floor the same button instead offers "Building Layout", "Terrain Layout", "Easement", "Street", "Objects > Outdoors" — irrelevant to us.

Whether a normal floor's Insert menu also offers annotation / text / dimension / photo / 360 / affected-area entries is **UNCONFIRMED**.

**OURS — ship exactly two entries at floor level:** `Room` and `Object`. Everything else lives inside a room. Resist menu growth here; this is the highest-traffic decision point on site.

---

### 2.6 SCREEN 6 — "Add a Room" (the capture-mode chooser)

**This is the most important screen in the product.** It is where a technician standing in a flooded basement decides how the room gets measured. The pop-up name `"Add a Room"` is confirmed verbatim.

| Entry | Label | What it is | Device gate |
|---|---|---|---|
| LiDAR whole-floor sweep | `"Auto-Scan"` (whether the in-app string carries "Start" or "LiDAR" is **UNCONFIRMED**) | Apple RoomPlan. Multi-room, one session, captures furniture and fixtures. | **LiDAR + iOS 17+**: iPhone 12 Pro / Pro Max, iPad Pro or newer |
| ARKit single-room | `"Start Manual-Scan"` | One room at a time. Two sub-modes: Wall Mode (LiDAR) and Corner Mode (ARKit). | Corner Mode: any ARKit device. Wall Mode: LiDAR devices. |
| No-camera fallback | `"Add a square room"` (the FAQ writes "Add a Square Room" — casing **UNCONFIRMED**) | Drops a square you resize. | Any device |
| Free-form | `"Draw Room"` — also appears as "Free Form Room" and "Define corners" across current pages. **The live string is UNCONFIRMED; "Draw Room" is the best guess** (it is in the most recently refreshed page). | Tap corner locations on a background grid. | Any device |
| Trace a plan | `"Import and draw"` (also "Import & Draw") | Photo/JPG background, set scale once, trace rooms over it. | Any device |
| Gap closer | `"Insert a filler"` | Then choose Filler Room or Filler Wall; blue arrows position it. | Any device |

**Ordering of this pop-up is UNCONFIRMED** — the list above was assembled from six separate articles, none of which showed them together.

**OURS — order for a water-damage crew, most-used first:**
`Auto-Scan` → `Manual-Scan` → `Square Room` → `Draw Room` → `Import & Draw` → `Filler`

**OURS — gating behaviour:** magicplan's docs never say whether unavailable modes are hidden or shown-disabled. **Show them disabled with a one-line reason** ("Requires iPhone 12 Pro or newer"). A hidden control on a jobsite reads as a bug; a disabled one reads as a device limitation.

**Restoration-specific guidance to surface in the UI** — this is magicplan's own documented recommendation and it is good advice:
> *"use the room scan to quickly capture the visible areas of the floor plan and then switch to manual room creation to capture rooms with severe damage or no accessibility."*

For badly damaged or dark properties the documented sequence is: Square Room or Draw Room → connect a Bluetooth laser → measure every wall → repeat per room → assemble.

---

### 2.7 SCREEN 7 — Room Type Picker

**Shows:** room types grouped into Residential and Commercial. **The actual list of room types was never found on any page.** `"Other"` is the only type confirmed, and only from the sloped-ceiling article. **Do not treat any room-type list as verified.**

**Position in the chain is genuinely contradictory across magicplan's own docs:**
- Auto-Scan article: `+ Insert` → `Room` → *select room type* → `Auto-Scan`
- Add-a-Floor article: `+ Insert` → `Room` → *select the draw method* → *select room type*
- Manual-Scan article: `Start Manual-Scan` → *select room type*

**OURS — decision: room type is assigned AFTER capture, at the commit step.** Rationale: Auto-Scan produces several rooms per session; asking for a type before the camera opens is incoherent for a multi-room sweep. Put the type picker on the "Configure Floor Plan" commit screen (2.9) as a per-detected-room row, and make it editable forever afterwards in the Detail Sheet.

**OURS — room type list for Quebec residential restoration** (ship bilingual, FR primary — magicplan's French strings were never researched and must be authored by us):
`Cuisine` · `Salle de bain` · `Salle d'eau` · `Chambre` · `Salon` · `Salle familiale` · `Salle à manger` · `Corridor` · `Escalier` · `Sous-sol non fini` · `Salle de lavage` · `Salle mécanique` · `Garde-robe` · `Rangement` · `Garage` · `Vide sanitaire` · `Autre`

**Room name vs room type:** magicplan's rename article says it *"allows you to assign a room name or room type to each room"* but explicitly never explains the relationship. Whether type drives a default name, drives estimating logic, or is cosmetic is **UNCONFIRMED**. **OURS: type sets the default name and is a first-class key for estimate line-item defaults. Name is free text and overrides.**

---

### 2.8 SCREEN 8 — Auto-Scan Capture (RoomPlan)

**Shows:** full-screen camera with live wall detection, tips overlay on entry, and a live 2D-or-3D preview of the plan being built.

**Colour semantics are load-bearing — replicate exactly:**
- **white lines** = wall currently being detected
- **green** = wall captured successfully / room closed
- **orange** = improperly scanned wall

| Control | Label | Behaviour |
|---|---|---|
| Start/stop room | red record button | Tap to begin a room; tap again to end that room. |
| Photo mid-scan | white photo shutter button | Captures a photo without leaving the scan. Non-negotiable for restoration. |
| View toggle | 2D/3D — **button label and location UNCONFIRMED** | **OURS: a `2D`/`3D` segmented control, top centre.** |
| Commit a room | `"Confirm Scan"` / `"Discard & Rescan"` — **placement UNCONFIRMED** | Per-room gate before continuing the session. |
| End session | `"Done"` | → "Configure Floor Plan" (2.9) |

**Rules to enforce:**
- Auto-Scan detects walls, windows and doorways automatically. Every other object requires deliberately pointing the camera at it.
- Auto-Scan **cannot** capture staircases, beams, or vaulted/sloped ceilings. These must be added afterwards as objects. Surface this as an on-screen tip.
- A room **disappears from the 2D plan** if its walls did not properly close. The app auto-closes when there is enough data; otherwise the user must rescan. Detect this and say so explicitly rather than silently dropping a room.
- Keep ≥10% device storage free or layouts drift. Warn below threshold.
- As of a July 2026 changelog entry, LiDAR Auto-Scan detects **full-height partial walls only**.
- **How ceiling height is determined in LiDAR modes is UNCONFIRMED.** Only Corner Mode has a documented ceiling-height step. **OURS: take RoomPlan's ceiling height, write it to the room, and show it as an editable field pre-filled — never silently defaulted.**

---

### 2.9 SCREEN 9 — "Configure Floor Plan" (post-scan commit gate)

**Shows:** what actually lands in the generated plan.

| Control | Label | Behaviour |
|---|---|---|
| Object filter | `"Include Objects"` — categories: Plumbing Fixtures, Appliances, Furniture | Choose which detected object classes to keep. |
| Scan recording | `"Session Replay"` | Saves a video of the scan session; can be disabled here. **For insurance work, default this ON** — it is contemporaneous evidence of site condition. |
| Commit | `"Generate Floor Plan"` | Builds the 2D/3D plan and returns to the Floor Plan Editor. |

**OURS — add to this screen:** a per-detected-room row with a room-type dropdown (see 2.7) and an editable name. This is the natural place to name rooms while the technician still remembers which is which. **Whether magicplan auto-labels RoomPlan-classified rooms is UNCONFIRMED.** RoomPlan does classify; use its classification as the pre-filled default.

---

### 2.10 Manual-Scan — AR capture (Wall Mode / Corner Mode)

Manual-Scan **defaults to Wall Mode** on capable devices; Corner Mode is the fallback you toggle to. You can switch between them **mid-scan without restarting** — explicitly recommended when a wall is blocked from view. This is exactly the flooded-basement case (furniture piled against walls), so it matters to us.

**Corner Mode (ARKit, no LiDAR), documented step order:**
1. Aim at floor corners; the corner is marked automatically or you tap. A **green corner-placement indicator** shows where the next corner will land. A white grid helps you aim through furniture.
2. Close the perimeter by aiming at the first corner, or tap `"Done"`.
3. Set ceiling height: use the grid to travel from floor to ceiling, then tap the screen.
4. Add windows and doors: aim at each opening and tap — a **green highlight** appears where one is detected.
5. Tap `"Exit AR"`, then `"Yes, I'm sure"`. The plan is created automatically.

**Wall Mode (LiDAR), documented step order:**
1. Follow the calibration prompts — point at your feet, then at the ceiling. (Exact prompt strings are the article's description, **not confirmed app strings**.)
2. Point at one wall after another; each is recognised and **turns green with a green check mark**.
3. If a wall is blocked, tap `"Wall Mode"` to fall back to Corner Mode.

| Control | Label | Notes |
|---|---|---|
| Mode toggle | `"Wall Mode"` button, right side of screen | Toggles Wall ↔ Corner. |
| Undo | undo arrow, top right | |
| Photo | camera button | |
| Finish perimeter | `"Done"` | Corner Mode |
| Exit | `"Exit AR"` → `"Yes, I'm sure"` | **Whether Wall Mode shares this exit sequence is UNCONFIRMED — assume yes.** |

**Wall Mode is documented as detecting walls, ceilings, doors, windows and outlets, but there is no step-by-step for how an outlet is captured, and outlets do not appear in the numbered steps.** Treat outlet detection as unproven.

**Accuracy guidance to surface as tips:** stay in the same position in the room for the whole scan; if foot calibration fails, move to better lighting and circle the device.

---

### 2.11–2.14 The non-camera capture modes

**`"Draw Room"`** — canvas with a background grid *"to estimate the length and angle of your walls"*. Tap each corner location, then fix the dimensions afterwards. Max corner count **UNCONFIRMED**.

**`"Add a square room"`** — drops a square you then resize, reshape (add corners), move, or measure with a Bluetooth laser. This is the fallback that actually matters on damaged sites.

**`"Import and draw"`** — take or choose a photo → a dotted scale line appears → drag the **blue arrow symbol** to lay it on a known measurement → `"Done"` → enter the dimension manually or via laser → then trace rooms over it with `+ Insert` → `Room`. A `"hide image"` / `"show image"` toggle exists.
> **Hard rule:** *"You cannot change the scale after creating your floor plan."* One shot. Make the scale-setting step unmistakable. Android's version accepts **JPG only**.

**`"Insert a filler"`** — choose Filler Room or Filler Wall (**the literal button strings are UNCONFIRMED**, only prose), then drag **blue arrows** into the empty space; it fills the gap automatically on release. Edit afterwards via the `"i"` icon next to its name.

---

### 2.15 SCREEN 10 — Room Editor (magicplan "Room Level")

**Shows:** one selected room — walls, dimensions, objects, annotations. Room name in the **upper right of the toolbar**. Wall measurements in **blue text**; manually-edited measurements carry a small **lock icon**. Docs say *"grid lines will appear in the room"* on selection.

⚠ **Whether tapping a room zooms to it or dims the other rooms is NOT documented anywhere.** Only two behaviours were confirmed: the selected room is *"outlined in blue"*, and tapping navigates to Room Level. **Trap:** the only documented grey-out in the whole editor is the **overlap error state** — do not conflate the two. **OURS: on selection, fade non-selected rooms to ~30% and ease-zoom to fit the selection. Verify against a real magicplan build before claiming parity.**

| Control | Label | Leads to |
|---|---|---|
| Details | `"i"` next to the room name (tablet) / swipe up (phone) | Detail Sheet (2.16) |
| Reposition | `"Edit Layout"` | Assembly mode (2.18) |
| Divide | `"Split Room"` | **What happens immediately after tapping is NOT documented** — two rooms instantly? a room-type prompt? a drag mode? **OURS: enters a drag mode using the wall's inverted-triangle handles, then commits two rooms, the new one inheriting type and ceiling height.** |
| Combine | `"Merge Rooms"` | Green arrows appear on mergeable neighbours; tap one to unite. **What happens to the shared wall and which name/type survives is NOT documented.** **OURS: shared wall deleted, larger room's name and type win, user prompted once.** |
| Copy | `"Duplicate"` | Exactly three variants: *"Duplicate an identical version of your room"*, *"Duplicate and flip the room horizontally"*, *"Duplicate and flip the room vertically"*. **Where the copy lands on the canvas is NOT documented.** **OURS: offset 0.5 m down-right, auto-selected, in Edit Layout mode.** |
| Remove | `"Delete"` | |
| Diagonal | `"Set Diagonal"` | Then tap the opposing corner; creates an editable diagonal measurement, laser-fillable. Essential for out-of-square Quebec basements. |
| Add | `"+ Add"` → `"Object"` | Object catalog (2.22) |
| Wall view | `"Elevation"` icon, next to the `"2D"` icon | Elevation View (2.17) |

**Tap targets inside the room:**
- **a wall** → wall selected (turns blue), **inverted triangle indicators** appear along its length to designate a position. Menu: `"Add Corner"` · `"Add Wall"` (partial wall) · `"Split Room"` · `"Delete"`.
- **a corner** → blue directional drag arrow. Dragging creates an angled wall; tapping outside releases and sets it. **How to delete or move a corner after adding is NOT documented.**
- **a blue measurement** → "Change Measurement" (2.19).

**Partial wall rules:** added with `"Add Wall"`, held and dragged into position, resized with two fingers or via the `"i"` icon next to `"Wall"`. **Partial walls cannot connect to each other** — documented workaround is to split the room instead. Wall objects work with partial walls but **not** with partition walls.

---

### 2.16 SCREEN 11 — Detail Sheet (the universal three-tab sheet)

**The single most reusable component in the product.** The same three-tab sheet attaches to **project, floor, room, wall, and object**. The tab set is uniform; only the body changes.

**Tabs, in this documented order:**

| Tab | Label | Contents |
|---|---|---|
| 1 | `"Details"` | Statistics for the element + its editable properties + custom Fields |
| 2 | `"Photos & Notes"` | Photos, videos, free-text note |
| 3 | `"Forms"` | Published forms scoped to that element level |

**Room "Details" tab — confirmed sub-sections (order within the tab is UNCONFIRMED):**
- `"Measures"` — Ceiling Height, entered manually or via Bluetooth Laser Measurer
- `"General"` — Room Name, room type, room color, **and the floor assignment attribute**
- Custom **Fields** render *"under the 'Details' tab"* — **exact position within the tab is UNCONFIRMED**
- `"Affected Area"` field with `"Add New Area"`
- Statistics block with a `"See All"` affordance (**that the room-level sheet specifically has "See All" is UNCONFIRMED**)

**Room name editing:** edit the `"Room Name"` field, then tap `"Save"` in the upper right.

**Moving a room between floors is an attribute edit, not a drag.** Verbatim: *"Scroll down to 'General' and tap on the floor attribute, a menu will appear that allows you to select a new floor for your room."* Copy this exactly — it is far more reliable on a phone than any drag interaction.

**"Photos & Notes" tab:**

| Control | Label | Behaviour |
|---|---|---|
| Add media | `"+"` icon | Opens camera / Photo Library |
| Video | camera mode selector, bottom right, including `"Video"` | Record → `"Next"`. **Capped at 5 minutes per clip.** Videos show a play icon and duration top-right. |
| Commit media | `"Save All"` | |
| Note | Notes box → type → `"Done"` on keyboard → `"Save"` | **Whether this is one free-text field per element or multiple timestamped entries is UNCONFIRMED.** The workflow reads like a single field and the API lists `notes` as a single value. **OURS: multiple timestamped, authored note entries. Insurance work needs a chronological record, not one editable blob.** |

**"Forms" tab:** lists published forms for that element level. Documented restoration template names include `"Water Damage Inspection Form"`, `"Mold Remediation Checklist"`, `"Flood Restoration Checklist"`, `"Client Intake Questionnaire"`. Form field types: text, photo upload, measurement, date, checklist item, questionnaire response, and — per the marketing page — e-signatures.

**Universal completeness marker:** attaching any photo, note, or completed form flags the element on the plan with *"a helpful yellow annotation bubble"*. **This is the plan doubling as a completeness checklist. Build it.** For a restoration crew it is the difference between a defensible file and a rejected claim.

**Custom Fields architecture:** authored **in the web Cloud only**, applied to one of `Project` / `All Floors` / `All Walls` / `All Rooms` / `Categories & Objects`, then **published** to a workspace or team before they appear on mobile. Constraint: *"Only one Field can be applied to each of the options mentioned above."* Field types: `"Yes / No"`, `"List"`, `"Multi-select"`, `"Text"`, `"Distance"`, `"Number"`, `"Photo"`, `"Color"`, `"Date and Time"`. Mandatory fields do **not** block PDF export by default.

---

### 2.17 Elevation View

**Shows:** a wall head-on with the objects attached to or beside it. **Required** to draw or see a wall-mounted affected area — in normal 2D such an area renders only as a thin bar along the wall.

| Control | Label | Behaviour |
|---|---|---|
| Enter | `"Elevation"` icon, next to the `"2D"` icon (also reachable via a viewfinder control) | |
| Navigate | arrows on either side of the wall | Move to adjacent walls |
| Edit | drag objects; two fingers to resize; tap a visible dimension to type it; laser via the details menu | |
| Report inclusion | `"Display elevation in report"` toggle (in the wall's Detail Sheet; also written `"Display in Elevation Report"`) | **Wall elevations are excluded from the report by default.** |

For water damage this screen is where **flood-cut height** gets documented. It is not optional for us.

---

### 2.18 Assembly — "Edit Layout"

**Shows:** the room picked up for repositioning against the rest of the floor. A **blue curved arrow** on the side of the room rotates that single room. **Green indicators** appear as snap guides while dragging.

- Hold and drag the room toward another; green indicators appear to help them snap.
- Captured doors and openings are automatically included.
- **Wall thickness adjusts automatically** based on the measurements added.
- `"Merge Rooms"` puts a green arrow on each mergeable neighbour; tapping it unites the two.

**Snapping mechanics are entirely unquantified in the research** — no snap tolerance, no statement about 90°/45° rotation snapping, no grid snapping, no numeric angle entry. The angled-walls article describes drag-only positioning with no snapping at all. **OURS: 150 mm translation snap, 5° rotation snap with hard detents at 0/45/90/135/180, and a numeric angle field on the wall detail sheet.**

**Overlap is a defect state, not a feature** (even though magicplan tolerates it): grey lines in 2D, grey shadow with black ceiling patches in 3D, and *"Rooms must be properly assembled first or the [3D] view displays incorrectly."* Note that **Xactimate does not support overlapping rooms and loses that data on ESX export** — for direct insurance work, overlap must be a blocking validation, not a warning.

---

### 2.19 "Change Measurement" pop-up

Reached by tapping a blue measurement numeral, or via the detail menu.

| Control | Label | Behaviour |
|---|---|---|
| Value | scroll wheel / scrollable value picker | |
| Commit | `"Apply"` | Commits the value **and locks it** (lock icon appears) |
| Unlock | `"Unlock"` | Required before a locked dimension will move again |
| Drag override | `"Confirm"` | Alternative to Unlock: drag the wall and confirm the alert |
| Units | `"Units"` | |
| Laser | `"Laser"` → `"My Devices"` / `"Nearby Devices"` → `"Connect"` → measure on the device → `"Done"` | **PrecisionLink.** Supported: Bosch, DeWalt, Hilti, Johnson Level, Leica, Mileseey, Stabila, Stanley; digital tapes REEKON T1, T1M 16ft, T1M 25ft. |

**The locking rule is the most important data rule in the editor.** A manually-entered or laser-verified dimension is a **human assertion** and outranks scanned geometry. It is protected from change during room assembly and during other dimension edits; surrounding geometry rescales around it. Replicate exactly — this is how a technician overrides a bad LiDAR read, and on an insurance file the overridden number is the defensible one.

---

### 2.20 Object catalog and Object Editor

**Catalog:** category browser plus search (swipe down in the object menu to reveal it). Stated at **300+ objects**. Drag-and-drop on tablets and phones. `"More"` in the upper right manages `"Visible Folders"` / `"Hidden Folders"`.

**Categories that matter to us:**

| Category | Confirmed contents |
|---|---|
| `"Restoration"` | Water: `"Dehumidifiers"`, `"Air Movers"`, `"Wall Humid Zone"`, `"Wall Cavity Dryer"`, `"E-TES"`. Fire: `"Air Scrubbers"`, `"Ozone Generators"`. Mold: `"Moisture Meters"`, `"Humid Zone"`, `"Hydroxyl Machine"`. Moisture meters can be generic or a specific Tramex model (e.g. CMEX5). |
| `"Annotation"` | `"Photo"` and `"360 Panorama"` objects. Described as marking areas needing repair, installation, removal, inspection, draining, drying, or cleaning. Also holds the `"Elevation"` annotation object. |
| `"Structural"` | Staircases: `"Staircase"`, `"L-Shaped"`, `"U-Shaped"`, `"Round U-Shaped"`, `"Spiral"`, `"Corner Landing"`. Beams. |

> **Note for product:** magicplan **paywalls** annotations, restoration objects, alarm/security, fire/safety, medical, and flooring behind a Report or Estimate subscription. For a single-contractor product this is a non-issue — but it means restoration users are magicplan's upsell target, which is our opening.

**Object Editor (magicplan "Object Level"):**

| Control | Label | Behaviour |
|---|---|---|
| Details | `"i"` next to the object name | Width, Depth, Height, Distance to Floor, Display Label toggle, `"Mirror Object"` toggle under `"General"`, type-specific attributes, Circuit Number on some electrical objects, `"Include in PDF"` for dimensions |
| Rotate | curved arrow (floor objects) / rotate option in the editor menu (wall objects) | |
| Resize | two-finger pinch outward/inward | ⚠ **Pinch is documented as OBJECT resize.** That means canvas zoom must use a different gesture, which is unusual and affects our whole gesture model. **UNVERIFIED and must be checked in a real build before we commit.** |
| Distance tool | *"Measure the distance between the selected object and another object or wall"* | |
| `"Duplicate"` / `"Delete"` | | |

**Floor objects vs wall objects:** floor objects move freely and may sit on the floor, hang from the ceiling, or carry a distance-from-floor. Wall objects attach only to walls, carry a height above floor, and have an elevation view. **Doors and windows are special: they cut through the wall surface, which affects statistics exports.** No other wall object does.

**Staircase rules — read carefully, they are counter-intuitive:**
- Staircases **cannot be scanned**. Add them manually after any scan.
- Staircases **do not link floors as data**. You add one stair object to the lower floor and a second, independent one to the upper floor.
- `"Leads to"` (upper or lower floor) affects **only the 3D rendering of that one floor**. It creates no connection between levels.
- Additional attributes: `"Corner Landing"` (steps vs flat landing) and `"Up Arrow"` (direction indicator).
- **Whether a staircase footprint deducts from room floor area or living area is UNCONFIRMED.**

---

### 2.21 Moisture readings and equipment (the restoration core)

**Moisture readings attach to a placed moisture-meter object, which pins them to a location on the plan. A reading is NOT a property of the room.**

Flow: place a `"Moisture Meters"` object → open its Detail Sheet → `"Use Moisture Meter"` (starts a Bluetooth scan, shows a device list) → pick the Tramex device → `"Use Readings"` imports the live reading onto that object at that plan location.

A Tramex import can populate up to five data points: **moisture content, relative humidity, air temperature, humidity ratio / specific humidity, surface temperature** — but not all models supply all five, so the field set is meter-dependent.

Readings are **time-series by design**: the docs instruct you to repeat the capture at the same location over time to compare.

**Equipment is documented by placing an object at its physical location, not by entering a count.** Placement is what generates the usage/location/deployment record used for billing.

**This is where magicplan is weakest and where we should beat it.** Confirmed gaps, all of which matter for Quebec direct-insurance water work:

| Gap | Status in magicplan | **OURS (GAP — build it)** |
|---|---|---|
| Manual reading entry without a paired meter | **UNCONFIRMED** whether possible | Always allow typed readings. Most crews do not own a Bluetooth Tramex. |
| Material type against a reading (drywall / wood / concrete) | Not found anywhere | Required field on every reading |
| Dry standard / dry goal | Not found. No IICRC, S500, GPP, or psychrometrics anywhere in the docs | Per-material dry standard, set from an unaffected reference reading |
| Monitoring visit as an entity | Marketing claims "tracked across monitoring visits"; **no help article defines a visit/day record** | First-class `MonitoringVisit` (date, technician, ambient conditions, all readings taken that day) |
| Drying chamber grouping rooms + equipment | **UNCONFIRMED** — a blog title exists, no in-app entity | `Chambre de séchage` grouping rooms and equipment |
| Equipment serial number, on/off timestamps, daily hours | Marketing claims it; **the equipment help article contained only object names, no fields** | Full deployment record: serial, placed-at, removed-at, computed equipment-days |
| Cause of loss / IICRC water Category 1–3 and Class 1–4 | **Never mentioned on any page.** The only classification on an affected area is free-text Name + Fill Color | Structured enum on the affected area |
| Ceiling affected areas | Documented for floors and walls only. **Do not assume ceilings are supported.** | Support ceiling as a third surface |

---

### 2.22 SCREEN 12 — Affected Area Editor

**The single most important restoration primitive.** An affected area is a named, coloured, auto-measured polygon drawn on **a room's floor or a specific wall**.

**Entry:** element Detail Sheet → `"Affected Area"` field → `"Add New Area"`.

| Control | Label | Behaviour |
|---|---|---|
| Reshape | drag corners | Recomputes area live |
| Add corner | tap an edge | |
| Exact dimension | tap a blue measurement → **measure picker** | Type it, or fill from **PrecisionLink** (Bluetooth laser / digital tape) |
| Name | `"Name"` | Free text. **This is the only damage classification magicplan has.** |
| Colour | `"Fill Color"` | Manual, user-driven. Restoration contractors use it as a status code — the docs give red = major work, yellow = minor repairs, green = complete. |
| Area | `"Area Calculation"` | **Auto-displayed, read-only.** Never entered. |
| Display | `"Settings"` → `"Show dimensions"`, `"Show label"` | Controls what prints on the plan |
| Commit | `"Done"` | |

**Rules:**
- **A new area starts with the entire floor pre-selected.** The interaction is subtractive/refining, not drawn-from-scratch. This is exactly right for water damage — start with "the whole room is wet" and pull it back.
- **Surface parentage is immutable:** *"Affected areas created on walls cannot be moved to floors, and vice versa."*
- To create a wall area you must tap the room, then tap the wall, then `"Add New Area"` from the **wall's** Detail Sheet, and you must be in **Elevation View** to see and edit it properly.
- An affected area behaves like a standard object — movable, nameable, colourable — and is itself a container: it can carry photos, 360s, videos, notes, and forms.
- Measurements propagate automatically to: **Report PDF** (marked with a **yellow number icon**), **Statistics Report** (at the bottom), the **API**, and the **ESX/Xactimate export**. They are also selectable in the Estimator as a quantity source.
- **UNCONFIRMED:** whether one room can hold several affected areas (almost certainly yes, never stated); whether an affected area yields **linear feet / perimeter / volume** as separately exposed values (only area and edge dimensions were confirmed); and **no delete flow was described on any page**.
- **Marketing calls Affected Areas "AI-powered" with real-time 3D calculation. The help center describes a purely manual polygon. Assume manual. Treat the AI framing as marketing.**

---

### 2.23 Statistics ("See All")

Read-only derived values, reachable from the Project Dashboard strip via `"See All..."` and from element Detail Sheets. Two tabs: a `"Rooms"` tab (room-by-room breakdown) and an `"Objects"` tab (counts per object type, no dimensions). Each statistic carries an `"i"` icon explaining its calculation — **copy that; it prevents the "why is this number different" support call.**

**Confirmed statistic names and meanings:**

| Name | Meaning |
|---|---|
| `"Floors"` / `"Rooms"` / `"Doors"` / `"Windows"` | Counts across the whole project |
| `"Ground Surface with All Walls"` | Footprint to the outside face of exterior walls |
| `"Ground Surface with Interior Walls"` | To the inside face of exterior walls |
| `"Ground Surface without Walls"` | Usable interior space; excludes wall thickness, interior walls, structural objects |
| `"Walls with Openings"` | Gross interior wall surface, height × width per wall, openings included |
| `"Walls without Openings"` | **Net paintable wall area** — windows and doors deducted |
| `"Ceiling Perimeter"` | Total length of all interior walls, no deduction for openings |
| `"Ground Perimeter"` | Same, **minus door widths** |
| `"Above Grade Living Area"` / `"Below Grade Living Area"` / `"Total Living Area"` | Per the Living Area Calculation rules |
| `"Volume"` | length × width × height per room; project total = sum of room volumes |

**Ceiling area is NOT a documented statistic.** It presumably equals a ground-surface variant, but that is inference. **OURS: expose `Ceiling Area` explicitly — restoration scopes it constantly.**

**Living Area Calculation** is configured once at project level (project `"i"` → `"General"` → `"Living Area Calculation"`, at the bottom). It combines: per-room inclusion **percentage** (example: Kitchen 100% + Balcony 50%), wall inclusion/exclusion, and a **minimum room height threshold** (example: 7 feet) below which area is auto-excluded. Based on ANSI Z765 or DIN 277.

**How Above Grade vs Below Grade is actually determined was never found.** It is almost certainly driven by floor type (basement = below grade) but **no page states the rule and no per-floor above/below toggle was confirmed**. **OURS: derive from the floor's `level` integer (< 0 = below grade), with an explicit per-floor override toggle.**

---

### 2.24 3D view

Renders **one floor**. Rooms must be assembled correctly or it displays incorrectly.

**Two behaviours that will generate bug reports if we copy them:**
1. **3D ignores per-room ceiling heights** — it uses the highest room ceiling height on the floor. A floor with mixed heights renders wrong. **OURS: honour per-room heights. This is a magicplan bug, not a feature.**
2. **No stacked/all-floors view exists anywhere in the product.** A community request to see all floors in one 3D view was answered by magicplan staff on 26 May 2025 as *"This feature is not currently on our roadmap."*

Gestures: two fingers zoom and turn, one finger moves the model. Web Cloud adds a floor drop-down in the lower left (hidden when a project has one floor) and an embeddable model via `"</> Embed 3D model"` → `"Copy"`.

**No dollhouse view, roof toggle, wall-transparency toggle, or furniture toggle was found in any documentation.** Absence of evidence, not confirmed absence.

**Cross-floor alignment is manual and orientation-only.** There is no shared origin, no reference grid, no inter-floor snapping. The only tool is `"Rotate"` (whole floor). The commonly cited procedure — rotate each floor to match, then place a marker object at a common point on every level — comes from a **third-party page that could not be fetched (HTTP 403)** and is therefore unverified.

**Sloped and vaulted ceilings do not exist in magicplan.** Two documented workarounds: a flat `"Roof"` floor with a room of type `"Other"` on it, or `"Elevation"` annotation objects placed at points in the room. The feature request has 283 voters and is marked Planned with no date. **Whether "Elevation" values feed volume or surface-area calculations is UNCONFIRMED — assume they are purely visual annotation.**

Also: **it is not possible to set different floor heights within the same room.** Split-levels must be modelled as separate floor levels.

---

### 2.25 Export hub — "Files and Sharing"

The central export screen for a project. Reached from the Project Dashboard left menu, or via the export icon at the upper right of a floor level. Each export row has a settings/configure control beside it; tapping the row name generates the file. A preview opens automatically; closing it returns to the floor level. Generated files land in the `"Files"` section.

| Export | Contents |
|---|---|
| **Report PDF** | Sketch, photos, notes, details, custom forms. **The only export with the `"Include Attachments"` controls.** |
| **Sketch PDF** | Plan only — floor plan with dimensions and details. No photos/notes/forms. |
| **Sketch Files** | SVG, JPG, PNG, DXF. **DXF excludes dimensions.** |
| `"Statistics"` | PDF or CSV covering rooms, objects, surfaces, measurements. Affected-area measurements appear at the bottom. **Exact column names are UNCONFIRMED.** |
| `"Estimate Files"` | PDF or XLS. **Only appears if the estimate total exceeds 0.** |
| `"Verisk"` | ESX for Xactimate. |
| 3D | IFC, OBJ, USDZ. USDZ *"includes objects... all objects that can be seen in the 3D view"*. |

**Export configuration — `"Customize Your Exports"`, confirmed option groups:**

| Group | Options |
|---|---|
| Page Layout | `"All floor plans on a single page"` / `"One floor plan per page"` / `"One floor plan per page, then two room plans per page"` / `"One floor plan per page and one room plan per page"` |
| Page Size | US Letter, US Legal, US Tabloid, A4, A3, A2; Portrait or Landscape |
| Room Labels | `"Show all room names"` / `"Show main room names only"` / `"Hide room labels"` |
| Scale | Display Scale on/off; Floor Scale and Room Scale with `"Scale that maximizes the plan size"` or `"Automatically select the closest scale in the list"`, plus manual 1:1 to 1:1000; `"Rotate plan to maximize scale"`; `"Use the same scale for all floors"` |
| Floor Plan Dimensions | `"Detailed dimensions"` / `"Main dimensions"` / `"Area"` / `"Only dimensions that have been manually set"` |
| Room Plan Dimensions | `"All dimensions"` / `"Only the two main dimensions"` / `"Only dimensions that have been manually set"` / `"No dimensions"` |
| Include Attachments (Report PDF only) | Dimensions, Fields, `"Photos, 360 images & Videos"`, Notes, Forms |
| Picture Size | Small / Medium / Large |
| Disclaimer | Editable text, default supplied, renders at the bottom of pages |
| Title Block | `"Display Title Block"`, `"Display a number of rooms"`, `"Display Area"` — renders company logo, contact & name, location, and property name & photo as a header |

**Export rules:**
- **Overwrite is the default** — generating an export replaces the previous file of that type. History requires enabling `"Export File Versioning"` in Cloud Settings. **OURS: version by default. On an insurance file, silently overwriting a previously issued report is unacceptable.**
- Photos and notes render in the Report PDF **under the element they were attached to**, so report body order follows the plan hierarchy.
- **PDF edits never mutate the original:** *"Changes made to your PDF will automatically be saved as a copy, preserving the original PDF."*
- Branding comes from the **Company Profile** (logo + watermark + company info), per Workspace and per Team, injected into the Title Block. **Exact Company Profile field names are UNCONFIRMED.**
- Form **instructions are internal** and never appear in the Report PDF. Text that must appear in the export has to be set as a question's `"default value"`.
- Photo Report: Photos tab → export icon → `"Web Gallery"` or `"Export as PDF"` → title, description, page size, rows per sheet, toggles for timestamps/album creator/captions → `"Generate PDF"` or `"Publish to Web"`. Ordering is inherited from the Photos section's current sort.

**Xactimate / ESX (relevant to us only if the Quebec insurer's adjuster uses Xactimate — many do):**
- Requires a PRO subscription; **US and Canada only**.
- Payload: floor plan sketch, dimensions, objects, affected areas, photos and photo metadata.
- Windows and doors survive but **arrive without a specific sub-type**.
- **Xactimate is wall-based while magicplan is room-based**, so parity is not guaranteed: walls get split into segments at connections and angle changes, fixtures can be rotated wrongly, and **overlapping rooms lose data entirely**.
- Xactimate caps photos at **100 MB per project**; oversized exports fail, with manual photo import as the fallback. Compression is offered.
- App flow emails a download link.
- The Symbility / CoreLogic (Cotality) equivalent is claimed to be an **FML** export. **This was never verified on a real page — treat the format name as unconfirmed.**

---

### 2.26 Estimator (web/tablet only)

Magicplan states plainly: *"The Estimating feature can only be accessed on a tablet connected to internet or on a desktop."* **OURS: put the estimator in the Next.js web CRM only. Do not build it into the phone app.**

**Price List detail** — header fields: `"Price List Unique ID"` (e.g. PL202500016), `"Validity Period"`, `"Created By"`, `"Status"` (`"Unpublished"`). Body is a hierarchical table: **Item Description | Category | Location | Quantity | Unit Cost | Total**. Sections are numbered outline-style (`1 Preparation work`, `1.1 Inspection and estimation costs`) with per-section entry counts and totals. Controls: `"Export"`, `"Settings"`, `"+ Add"` per section, row drag handles, row checkboxes.

**`"Price List Settings"` modal** — `"Locked Properties"`: *"Locked properties can't be edited when items are added to an estimate from a price list."* Seven toggles, in order: **Name, Code, Category, Description, Quantity and Unit, Price, Internal Notes**.

**Bulk import template** (`price-list-template.xlsx`), 22 columns A→V:
`Element | Code | Section Code | Name | Description | Category | Location | Quantity | Unit | Labor Unit Price | Material Unit Price | Equipment Unit Price | Other Unit Price | Markup name | Markup % | Markup Applies To | Discount name | Discount % | Discount Applies To | Tax name | Tax % | Tax Applies To`
Column A `Element` is a dropdown of `Section` / `Item` — that is how hierarchy is expressed in a flat file. Unit dropdown observed: `h, m2, m, E, ft2, ft, ft3, m3` (list continues).

**Estimate detail** — header: `"Estimate Unique ID"` (E202400023), `"Date of issue"`, `"Valid until"`, `"Status"`, `"Created By"`. Then a `"Customer"` card, an `"Opening Statement"` textarea (~5000 char budget), a view switcher (`"Room View"` / `"Category View"` / `"Custom View"`), the line-item body **grouped by room with a thumbnail of that room's sketch** (`"Ground Floor • Kitchen"`), then Totals and a `"Closing Statement"`.

Toolbar: `"Undo"`, `"Redo"`, `"Duplicate"`, `"Export"`, `"…"`, `"Options"`, `"Hide floor plan"`, `"+ Add"`.

`"+ Add"` has exactly three entries: **`"From Price List"` · `"New Item"` · `"Subsection"`**.

**Status dropdown:** `draft` → `sent` → `accepted` / `rejected`. User-set, never automatic.

**Line item side panel:** `"Costs"` section with `"Quantity"` (with a **calculator icon inside the field**) and `"Unit"`. Then a cost block headed `"Cost"` — which becomes `"Cost per m2"` once a unit is chosen — holding four currency rows: **Equipment, Material, Labor, Other**. Then computed extensions, `"Subtotal of Costs"`, a `"Markup"` section, and `"Total price:"`.

> **Verified arithmetic:** quantity 17.70 × (equipment 1 + material 2 + labor 3) → 17.70 / 35.40 / 53.10, subtotal $106.20.
> **Line total = quantity × (labor + material + equipment + other unit prices).**

**`"Formula"` modal — the bridge from sketch to money. This is the mechanism to copy.**
Opened by the calculator icon in the Quantity field. Shows an expression area where inserted variables appear as **chips carrying their live value** (`"wA (17.70m2)"`), a status line showing `Location: Kitchen` and the live evaluation `= 0.00`, a 3×3 grid of purple measurement variables pre-loaded with **this room's measured values**, and a numeric keypad (`Clear`, `(`, `)`, digits, `/ * - +`) with a full-width gold `"= (Save)"` button.

The nine variables: `fA` `cA` `wA` `oA` `rP` `rH` `oW` `oD` `oH`.

⚠ **Only ONE variable meaning was ever confirmed:** a tooltip reading `"Total wall area of reference"` for `wA`. The other eight are guesses, and the observed values (`rP` 1000.00 m and `rH` 244.00 m for a 6.25 m² room) are implausible enough that even the researcher distrusted their own inference. **Do not hardcode these meanings.**

**OURS — our own variable set, explicit and self-documenting** (no cryptic two-letter codes; every one gets a tooltip and a live value):
`FloorArea` · `CeilingArea` · `WallAreaGross` · `WallAreaNet` (openings deducted) · `Perimeter` · `PerimeterLessDoors` · `CeilingHeight` · `Volume` · `AffectedFloorArea` · `AffectedWallArea` · `AffectedPerimeter`

**Whether openings are deducted from wall area automatically was never confirmed anywhere.** Making `WallAreaGross` and `WallAreaNet` two separate, named variables removes the ambiguity permanently.

**Totals block** — expandable rows in this exact order: **Costs → Markup → Discount → Subtotal → Tax → Total.** Markup, Discount and Tax each expand to list applied rules by name, percentage and amount, each with its own `"+ Add"`.

> **Verified:** 116.82 + 4.67 − 0.00 = 121.49 subtotal; 121.49 + 6.07 = 127.57 total.
> **Markup is computed on costs, not on the running subtotal:** 4.00% of $116.82 = $4.67 exactly.
> **Whether Discount is computed on costs or on costs+markup is UNCONFIRMED.**

**`"New Rule"` side panel:** `"Name"`, `"Percentage"`, `"Cost Group"` (observed `All`, `Labor`), `"Type"` (observed `Markup`, `Tax`; `Discount` is documented in prose and has its own totals bucket but was never seen in the dropdown). A Labor-scoped tax renders with the tag `LBR`.

**Export preset panel:** `"Your presets"`, `"Name"`, `"Group items by"`, `"Filter items"`, six Item-detail checkboxes (**Code, Description, Private Notes, Quantity, Unit cost, Total**), three Cost-rule checkboxes (**Markup, Discount, Taxes**), Section visibility rows (`"Title Block"`, `"Opening Statement"`) with eye icons, then `"Update preset"` / `"Save as new preset"` / `"Export"`. **Copy the preset concept** — it is how one estimate serves both the client-facing and internal-margin versions.

**Two magicplan absences that matter for Quebec direct insurance work:**
- **No invoice object, invoice screen, or invoice API exists in magicplan.** The only mention is an API guide example of pushing an estimate into someone else's ERP as a draft invoice. If we need estimate → invoice, magicplan is not a model.
- **No confirmed GST/QST two-tax or compound-tax setup was seen.** Cost rules are flat percentages scoped by cost group. **OURS (GAP): Quebec needs TPS 5% + TVQ 9.975%, both applied to the pre-tax subtotal (not compound since 2013). Model taxes as an ordered list with an explicit `appliesTo: subtotal | subtotal+priorTaxes` flag so we are never wrong again.**
- **Approval with e-signature is a marketing claim only** — never seen in any UI, help article, or API. The status enum has no signature artifact.
- **Assemblies / kits / bundles do not appear to exist.** Only Sections, Subsections, and individual items.

---

## 3. DERIVED vs ENTERED

This is the rule that decides what we let users edit, what we recompute, and what survives a re-scan. Get it wrong and either the numbers drift or the technician's field judgement gets overwritten.

### 3.1 DERIVED — computed, read-only, recomputed on every geometry change

Never editable. Never persisted as a user value. Always recomputed.

| Value | Source | Formula (where confirmed) |
|---|---|---|
| Floor area / `"Ground Surface"` (three variants) | room polygon + wall thickness | with All Walls / with Interior Walls / without Walls |
| `"Walls with Openings"` | wall polygons | height × width per wall |
| `"Walls without Openings"` | wall polygons − openings | window and door areas deducted |
| `"Ceiling Perimeter"` | wall lengths | no deduction |
| `"Ground Perimeter"` | wall lengths − door widths | |
| `"Volume"` | room geometry | length × width × height; project total = sum of room volumes |
| Ceiling area | room polygon | **OURS — not a magicplan statistic** |
| Affected-area square footage | polygon | `"Area Calculation"` is *auto-displayed*, never entered |
| Living Area (Above/Below/Total) | ground surface × rules | per-room %, wall inclusion, min-height threshold |
| Object counts, door/window counts | plan contents | |
| Estimate line extension | quantity × Σ(4 unit prices) | **verified: 17.70 × (1+2+3) = 106.20** |
| Estimate totals ladder | line totals + rules | Costs → +Markup → −Discount → Subtotal → +Tax → Total |
| Markup amount | % of **costs**, not of subtotal | **verified: 4% of 116.82 = 4.67** |
| Formula-modal variables | current room measurements | live values, injected as chips |
| Yellow annotation bubble presence | existence of photo/note/form | pure function of attachments |

**Rule:** if it has a unit of area, length, volume, or currency-extension, it is derived. No exceptions.

### 3.2 ENTERED — human judgement, editable forever, must survive re-scan

| Value | Where | Why it is judgement |
|---|---|---|
| Room Name, room type | `"General"` | Naming is interpretation, not measurement |
| Room color | `"General"` | Used operationally as a status code (red = major, yellow = minor, green = complete) |
| Affected-area `"Name"` and `"Fill Color"` | Affected area | **In magicplan this is the ONLY damage classification that exists.** For us it must be supplemented with a structured cause-of-loss / IICRC category. |
| Notes, photos, videos | `"Photos & Notes"` | |
| Form answers | `"Forms"` | |
| Custom Field values | `"Details"` | |
| Equipment placement | Restoration objects | Placement *is* the deployment record |
| Moisture readings | on a meter object | Imported from Bluetooth **or typed** (OURS) — either way, an observation, not a computation |
| Estimate line item selection, category, notes | Estimator | |
| Cost rules (markup/discount/tax %) | Totals | |
| Estimate status | `draft/sent/accepted/rejected` | User-set, never automatic |
| Opening / Closing statements | Estimate | |
| Export preset configuration | Export panel | |
| `"Session Replay"` on/off, `"Include Objects"` | Configure Floor Plan | |

### 3.3 The third category — ENTERED MEASUREMENTS that override DERIVED geometry

This is the subtle one and the one most likely to be implemented wrong.

| Value | Behaviour |
|---|---|
| A dimension typed into `"Change Measurement"` or filled from a laser | **Locks** (lock icon). Protected from change during assembly and during other dimension edits. Surrounding geometry rescales *around* it. Requires explicit `"Unlock"` or a drag confirmed with `"Confirm"` to move. |
| `"Set Diagonal"` value | Same lock semantics. Pins corner angles in out-of-square rooms. |
| Ceiling Height at floor level | Cascades to every room on the floor — **except** rooms whose height was already individually changed. **First-write-wins.** |
| Ceiling Height at room level | Overrides the floor value permanently for that room. |
| Interior / exterior wall thickness | Per **floor**, not per wall. Feeds all three Ground Surface variants. |
| Import & Draw scale | **Set once, permanently.** *"You cannot change the scale after creating your floor plan."* |
| Estimate quantity typed directly | Overrides the formula result. |

**The governing principle for our build:**

> A **laser-verified or hand-typed dimension outranks a scan.** A **scan outranks a default.** Nothing silently overwrites a locked value. Every locked value renders with the lock icon, and every derived value that depends on one recomputes visibly.

On an insurance file, the locked number is the defensible number. It is the one the technician stood in the room and measured. Protect it.

---

## 4. Insurance-work deltas (GAP — magicplan does not have these)

Called out separately because the research is unambiguous: **no evidence was found that magicplan carries any structured claim data.** The Xactimate integration page mentions no claim number, policy number, adjuster, carrier, date of loss, or deductible. Confirmed project fields are only: name, description, author, creation date, address, assignee, living-area setting, plus custom Fields. **Do not model built-in claim fields on the strength of magicplan.** If magicplan users have them, they built them as Custom Forms.

For a Quebec contractor doing direct insurance work, these belong in the **project schema as first-class fields**, not as custom forms:

`Numéro de réclamation` (claim no.) · `Assureur` (carrier) · `Numéro de police` · `Date du sinistre` (date of loss) · `Cause du sinistre` (cause of loss) · `Catégorie d'eau IICRC 1–3` · `Classe IICRC 1–4` · `Expert en sinistre` (adjuster: name, phone, email) · `Franchise` (deductible) · `Assuré` (insured party, distinct from the site contact) · `Adresse du sinistre` (distinct from the billing address) · `Statut du dossier` (job status)

Also note: **magicplan has no native job-status workflow.** We do, and it is a CRM feature, not a floor-plan feature — keep it on the project record, surfaced on the Project Dashboard.

**Localisation:** every magicplan string in this document is **English only**. French help pages exist (`help.magicplan.app/fr/...`) but were never read. **All Quebec French strings must be authored by us and reviewed by the client** — a Quebec restoration contractor's vocabulary (sinistre, dégât d'eau, assèchement, expert en sinistre, réclamation) is specific and getting it wrong will cost credibility on day one.

---

## 5. CONFIRMED vs UNCERTAIN

Engineers will treat "confirmed" as fact. Everything below is sorted on that basis, ruthlessly. **A label reproduced by a summarising model over a fetched page is NOT confirmed** unless it appeared, short and identical, across independent pages.

### 5.1 CONFIRMED — build against these

**Architecture**
- Hierarchy is strictly **Project → Floor → Room → Object**, with **Wall** as a peer detail level under Room.
- The `"Details"` / `"Photos & Notes"` / `"Forms"` sheet attaches at **all five levels**. Tab set is uniform.
- **Room-based, not wall-based.** *"Rather than adding walls directly, users must create new rooms to divide spaces."* Verbatim FAQ: *"magicplan is a room-based program. Rather than simply adding a wall, you'll need to add a new room."*
- A project must exist before a floor; a floor before a room. No documented way to add a room without first picking a floor type.
- A room's floor membership is an **editable attribute** in `"General"`, not a drag or move operation.
- Rooms are created individually and then **assembled**.
- **No vertical stacking.** Verbatim: *"It is not possible to render two floors on top of each other in magicplan."* Confirmed further by a magicplan staff answer (26 May 2025) declining the all-floors-3D request.
- Staircases do not link floors as data; you place one on each floor and set `"Leads to"` on each. Effect is 3D-rendering only.
- Wall thickness is **per-floor**, not per-wall.
- Ceiling height cascades floor → rooms, **except** rooms already individually changed (first-write-wins).
- 3D uses the **highest** room ceiling height on the floor, ignoring per-room values.
- Only one floor height per room; split-levels require separate floor levels.
- Undo/Redo spans all rooms and all floors.
- Affected-area surface parentage is **immutable**: wall areas cannot move to floors, and vice versa.
- A new affected area starts with **the entire floor pre-selected**.
- Overlapping rooms are a defect state: grey lines in 2D, grey shadow + black ceiling in 3D; 3D breaks; **Xactimate loses the data**.
- Partial walls cannot connect to each other. Wall objects work with partial walls but not partition walls.
- Doors and windows cut through the wall surface and affect statistics; other wall objects do not.

**Labels (each appeared quoted across independent pages)**
`"+ Insert"` · `"+ Add Floor"` · `"Add a Room"` · `"Add a square room"` · `"Draw Room"` · `"Import and draw"` · `"Insert a filler"` · `"Start Manual-Scan"` · `"Auto-Scan"` · `"Wall Mode"` · `"Exit AR"` · `"Yes, I'm sure"` · `"Confirm Scan"` · `"Discard & Rescan"` · `"Configure Floor Plan"` · `"Include Objects"` · `"Session Replay"` · `"Generate Floor Plan"` · `"Room Name"` · `"Details"` / `"Photos & Notes"` / `"Forms"` · `"Measures"` · `"General"` · `"Affected Area"` · `"Add New Area"` · `"Fill Color"` · `"Show dimensions"` / `"Show label"` · `"Change Measurement"` · `"Apply"` / `"Unlock"` / `"Confirm"` · `"Set Diagonal"` · `"Edit Layout"` · `"Split Room"` · `"Merge Rooms"` · `"Add Corner"` / `"Add Wall"` · `"Elevation"` · `"Duplicate Floor"` · `"Floors"` · `"See All..."` · `"Files and Sharing"` · `"Files"` · `"Verisk"` · `"Roof"` · `"Use Moisture Meter"` / `"Use Readings"` · `"Display elevation in report"` · `"From Price List"` / `"New Item"` / `"Subsection"` · `"Locked Properties"` · `"= (Save)"` · `"Estimate Files"`

**Device gating (three tiers, documented)**
- Corner Mode: any ARKit device (iPhone 11 and older, iPhone 12 / iPad Pro and newer)
- Wall Mode: LiDAR required (iPhone 12 Pro / Pro Max, iPad Pro and newer)
- Auto-Scan: **LiDAR AND iOS 17+**
- App baseline iOS 15 for all non-scan features
- **Android has no scanning at all** — confirmed across three separate pages. Limited to Add a Square Room, Draw Room, Import & Draw.

**Behaviour**
- Auto-Scan colour semantics: white = detecting, green = captured, orange = improperly scanned. Wall Mode: green + green check mark. Corner Mode: green indicator for next corner, green highlight for a detected opening.
- Auto-Scan **cannot** capture staircases, beams, or vaulted/sloped ceilings.
- A room disappears from 2D if walls did not properly close.
- Auto-Scan detects walls, windows, doorways automatically; other objects need deliberate aiming.
- Import & Draw scale is permanent. JPG only on Android.
- Manually-edited dimensions **lock** and are protected during assembly.
- Photos can be captured mid-scan in both scan modes.
- Yellow annotation bubble appears on any element carrying a photo, note, or completed form.
- Video capped at **5 minutes** per clip.
- Room duplication offers exactly three variants: identical, flip-H, flip-V.
- Duplicate-floor and copy-floor-to-another-project are **one dialog**.
- Favoriting a project is what makes it **available offline**.
- Custom Fields are authored in the Cloud and must be **published** before appearing in the app. One Field set per target.
- Mandatory fields do **not** block PDF export by default.
- **Floor plans cannot be created or edited in the Cloud.** All geometry editing is app-only.
- Estimating requires a **tablet with internet, or desktop** — not a phone.
- Export **overwrites** by default unless `"Export File Versioning"` is on.
- Estimate export blocked unless the total exceeds 0.
- Estimate categories export in **alphabetical** order.
- DXF excludes dimensions.
- ESX requires PRO, US/Canada only, 100 MB photo cap.
- Form instructions never appear in the Report PDF; use a question's `"default value"`.
- PDF edits save as a copy, preserving the original.
- Device-class UI placement rule (left menu tablet / bottom nav phone; `"i"` tablet / swipe-up phone; etc.).
- Line total = quantity × Σ(labor + material + equipment + other). **Verified arithmetically.**
- Totals order: Costs → +Markup → −Discount → Subtotal → +Tax → Total. **Verified twice.**
- Markup computed on **costs**. **Verified: 4% of 116.82 = 4.67.**
- Estimate status enum: draft / sent / accepted / rejected.
- `"+ Add"` in an estimate has exactly three entries.
- Tramex import supplies up to five data points, meter-dependent.
- Moisture readings attach to a placed meter object and are time-series by design.
- Xactimate rebuilds geometry from walls; parity is not guaranteed; doors/windows lose sub-type.

### 5.2 UNCERTAIN — do not treat as fact; verify in a real build or decide ourselves

**Method caveat that colours everything:** none of this research came from a running app. Most came from help-center prose converted to markdown and passed through a summarising model. Estimator screens came from **screen-recording frames of a staging build** carrying a persistent BETA banner, dated Aug 2024 and Jul 2025. One article is tagged version 9.5.0 and the help center has a `/migrated/` URL namespace. `"The New magicplan"` page confirms a recent reorganisation (the `"i"` icon moved to the top toolbar, selection name moved to upper right, object menu redesigned), so **older articles may describe a dead UI**. No YouTube transcript was ever successfully retrieved; nothing here is video-sourced. The CSIRO third-party guide returned HTTP 403.

**Lists that must not be hardcoded**
- **The floor type list.** Only `"Roof"` and `"Land Survey"` confirmed. "Ground Floor"/"1st Floor" appear only as prose examples of floor *names*. Basement/Attic/Garage/Mezzanine/Crawlspace existence unknown.
- **The room type list.** Never found on any page. `"Other"` confirmed from one article. A summariser rendered "Living Room, Kitchen, Bedroom, etc." — the "etc." proves it was improvising.
- **The complete `"+ Insert"` menu at floor level.** Only `"Room"` and `"Object"` confirmed. Whether annotation/text/dimension/photo/360/affected-area entries exist is unknown. The menu-structure page's phrase "objects and annotations" hints at an Annotation entry that could not be confirmed.
- **The `"Add a Room"` pop-up's contents and order.** Assembled from six articles that each mention one entry. No page listed them together.
- **Full Unit dropdown** (saw h, m2, m, E, ft2, ft, ft3, m3; list was still scrolling).
- **Full option lists** for `"Markup Applies To"`, `"Discount Applies To"`, `"Tax Applies To"`, `"Cost Group"` (only `All` and `Labor` seen) and the cost-rule `"Type"` dropdown (only `Markup` and `Tax` seen; `Discount` documented in prose only).
- **Home screen bottom navigation** — only `"Profile"` confirmed.
- **Statistics export column names** — never confirmed. The workspace-statistics CSV columns that *were* confirmed are a **different, admin-only usage export** and must not be confused with room statistics.
- **Company Profile field names** — only "logo", "watermark", and unnamed "company details".

**Contradictions in magicplan's own docs**
- `"+ Insert"` vs `"+ Add"` — same control, or two? Unverified.
- `"Floor Plans"` vs `"Floors"` section name vs standalone `"+ Add Floor"` — possibly three UI generations.
- `"Draw Room"` vs `"Free Form Room"` vs `"Define corners"` — all three appear on current pages.
- `"Add a square room"` vs "Add a Square Room"; `"Import and draw"` vs "Import & Draw".
- **Room type before or after capture mode** — three articles, three different orders.
- Whether the `"Auto-Scan"` entry carries "Start" or "LiDAR" in its label.
- Android scanning rationale: magicplan blames absence of LiDAR, which does not explain why ARKit-only Corner Mode is also unavailable on ARCore devices. **The functional fact (no Android scanning) is confirmed across three pages; the reasoning is not.**

**Behaviours never documented**
- **What happens visually when you tap a room** — no zoom animation, no dimming of other rooms found anywhere. Only "outlined in blue" + navigates to Room Level. **Trap: the only documented grey-out is the overlap error state. Do not conflate.**
- **What `"Split Room"` does immediately after the tap.**
- **What happens to the shared wall on merge**, and which name/type survives.
- **Where a duplicated room lands** on the canvas, and whether it must be re-snapped.
- **Duplicating a room onto a different floor** — not documented. Duplicate-then-reassign-floor-attribute is an inference.
- **How to delete or move a corner** once added.
- **Deleting a floor** — action named in prose, exact menu string and confirmation dialog never seen. Same for archive/move on projects.
- **Deleting an affected area** — no flow or label found on any page.
- **Whether multi-select exists** anywhere. Never mentioned. Assume single-selection.
- **Long-press semantics** beyond room-move and floor-menu.
- **Snapping mechanics**, quantitatively: tolerance, 90°/45° rotation snap, grid snap, numeric angle entry. The angled-walls article mentions none of it.
- **Canvas pan/zoom gesture.** Pinch is documented as **object resize**, which is unusual and implies canvas zoom uses something else. **Unverified and it affects the entire gesture model — check this first.**
- **Default interior/exterior wall thickness values.** Never stated.
- **Undo stack depth.** Never stated.
- **Whether unavailable capture modes are hidden or shown-disabled.**
- **How ceiling height is determined in Wall Mode and Auto-Scan.** Only Corner Mode has a documented step.
- **Outlet detection in Wall Mode** — claimed on two pages, no step-by-step, absent from the numbered steps.
- **Whether Wall Mode ends with the same `"Exit AR"` → `"Yes, I'm sure"` sequence.** Assumed, unverified.
- **Whether the undo arrow and camera button exist in Auto-Scan** or only Manual-Scan.
- **Whether Auto-Scan auto-labels RoomPlan-classified room types.**
- **Whether stair footprints deduct from floor or living area.**
- **Per-mode limits** — max rooms per Auto-Scan session, max corners in Draw Room, scan time limits. Nothing found.
- **Whether the app's 3D view has its own floor selector** (the Cloud's is confirmed).
- **Whether interior-vs-exterior displayed dimensions are clear or centreline.**
- **Whether wall selection is possible directly from Floor Level** or only after entering a room.
- **The `"..."` room-management menu at Floor Level** — the menu-structure page says it manages rooms (add/duplicate/delete/merge); the add-a-new-floor article never mentions it. Contents unverified.

**Structure and layout never confirmed**
- **Whether the Project Dashboard is tabbed or scrolled**, and the exact set and order of its sections.
- **Whether project creation prompts for anything**, or whether a project can exist unnamed.
- **The order of sections inside the room `"Details"` tab.** `"Measures"`, `"General"` and a statistics block are all confirmed to exist; nothing lists them top-to-bottom.
- **Where custom Fields render within the Details tab.**
- **Whether the room sheet shows a compact statistics summary with `"See All"` or the full list inline.**
- **Which statistics appear per-room vs project-only.**
- **Whether there is an objects list inside the room sheet.**
- **Whether there is a `"Surfaces"` section in room details** — no page describes one. Do not assume.
- **Whether notes are one field or multiple entries.**
- **Whether per-photo captions exist inside Photos & Notes** (`"Photo Descriptions"` is mentioned as a photo-app feature).
- **How floors are ordered / whether they can be reordered / whether a floor has a numeric level.**
- **Whether two floors of the same type can coexist.**
- **How floors are named initially and whether renaming changes the type.**
- **Whether screen names ("Home Screen", "Project Dashboard", "Floor Level", "Room Level", "Object Level") appear anywhere in the actual UI.**
- **The Cloud Projects list** — columns, filters, sort, status chips. Entirely unconfirmed.
- **The page-by-page section order of a generated Report PDF.** Only fragments are confirmed: Title Block is a header at the beginning, Disclaimer sits at the bottom of pages, Page Layout controls plan pagination, photos can go on dedicated pages, affected-area stats sit at the bottom of the Statistics Report. **Get a real sample PDF before building the report generator.**
- **No cover-page concept was found** — magicplan appears to use the Title Block instead.
- **Whether elevation views appear in reports at all.** Nothing found either way.
- **Whether a 3D/dollhouse render is embedded as a report page.** Not confirmed.
- **Whether named, selectable report templates exist.** No evidence. The nearest confirmed mechanism is Custom Forms plus saved export settings.
- **Estimate PDF internals** — section headings, column names, grouping.
- **Whether export configurations persist across projects**, and page-size defaults.

**Estimator specifically**
- **Eight of the nine Formula variable meanings.** Only `wA` = *"Total wall area of reference"* was read from a tooltip. Observed values (`rP` 1000.00 m, `rH` 244.00 m for a 6.25 m² room) are implausible enough to distrust the obvious inferences.
- **Whether the variable list is fixed at nine** or varies by room type; whether object-level variables exist.
- **Whether openings are auto-deducted from wall area.** Never confirmed.
- **The markup base in the line-item side panel.** $106.20 → $116.70 is a $10.50 delta, not a clean percentage. The Markup section was never expanded. **Do not infer a line-level markup rule from this.**
- **Whether line-level and estimate-level markup stack.**
- **Whether Discount is computed on costs or on costs+markup.**
- **Whether a price-list item can carry a stored default formula.** The items-library page claims a "quantity formula"; the import spreadsheet has a plain Quantity column and **no formula column**. These do not reconcile.
- **Currency/tax settings detail** — a currency dropdown was seen but never opened; no Quebec two-tax or compound-tax option was ever observed; per-line tax exemption and rounding rules were never investigated.
- **What `"Unpublished"` actually gates**, and public/Craftsman price-list activation semantics.
- **`"Options"` and `"Custom View"`** on the estimate screen were visible but never opened.
- **"Partial application areas using a visual editor", multi-selection applying one item to several rooms** — blog copy only, never seen in any UI.
- **"Xactimate codes built in"** — from a "Get early access" page, so possibly unshipped.
- The 41-minute estimator webinar has no transcript and was never watched; its chapter list names several unanswered questions (bulk CSV import of line items, bulk delete from a room, how app-created estimates surface in the web portal).

**Marketing claims that could NOT be corroborated in the help center — treat as false until proven**
- **Approval / e-signature flow** ("quotes your customers can approve with one tap", "Approvals with Signatures"). Never seen in any UI, article, or API.
- **Named report variants** ("Full Project Report", "Photos Report", "Moisture Report").
- **A first-class moisture-reading field or drying-log table in reports.** The restoration-equipment article gave object names only, no fields, no report tables.
- **Equipment serial numbers, on/off timestamps, quantity, daily hours** as actual fields.
- **AI-powered affected-area detection.** Help center describes a manual polygon.
- **Drying chambers as an in-app entity.**
- **"Reference Areas"** as the ESX name for affected areas — from a marketing-page summary, not from the help center or an ESX spec.
- **FML as the Symbility/CoreLogic export format** — from a search snippet, never verified on a real page.
- **A third-party review claiming AR manual sketch "works on any iOS or Android device with a camera"** — this **directly contradicts** magicplan's own docs. Do not build against it. The same review misdated PrecisionLink by a year.
- **Before/after photo tagging.** No tag or category system exists in the photo documentation.
- **JSON project export / webhooks.** An API key exists and Zapier is listed; no JSON export or webhook was confirmed.

**Never researched at all**
- French / Quebec French localisation of any label.
- Quebec-specific insurer workflows.
- Pricing and entitlement tiers beyond the noted paywalls.
- The magicplan.com marketing site and support.magicplan.app.

---

## 6. BUILD ORDER

Smallest sequence of changes that produces a working **project → floor plan → add → scan mode → scan → room detail** chain. Ship in this order. **Do not start a phase before its predecessor is usable on a phone in a basement.**

Each phase is gated: the client must be able to run the phase's exit test on a real device before the next phase begins. (Per the standing mobile-app workflow: phased with review gates, `mobile-app` branch only.)

---

### Phase 0 — Decisions and schema (no UI)

Nothing below can be built twice cheaply. Settle these first.

1. **Adopt room-based architecture.** No wall-graph editor, ever. Write it into the data model: a Floor owns Rooms; a Room owns a closed polygon, Walls derived from that polygon, and Objects.
2. **Schema:** `Project → Floor → Room → { Wall, Object, AffectedArea }`, with a polymorphic `Detail` attachment (photos, notes, form responses, custom field values) at **all five levels**.
3. **Floor gets an integer `level`** (basement = −1). Magicplan has no floor ordering; we do. Above/below grade derives from it, with an override.
4. **Derived vs entered split (§3) encoded in the model**, not in the UI layer. Derived values are computed properties with no setters. Entered measurements carry a `locked: boolean` and a `source: scan | manual | laser`.
5. **Project schema carries the insurance fields (§4) natively.** Not as custom forms.
6. **FR-first string table.** Every label in the app goes through it from commit one. Retrofitting bilingual strings after Phase 4 costs three times as much.

**Exit test:** a seed script creates a project with two floors, three rooms, and one affected area, and the derived statistics compute correctly with no UI at all.

---

### Phase 1 — The spine, without any camera

The chain must exist and be navigable before any capture technology touches it. This is the phase that answers the client's actual complaint.

1. **Project List** — tiles, search, `+ New Project`. Creation opens an intake sheet capturing claim identity (§4), *then* lands on the dashboard. (Deliberate divergence from magicplan.)
2. **Project Dashboard** — scrolling sections: details, `Floor Plans` list, `Photos`, `Files`. Statistics strip can be a stub showing zeros.
3. **Floor Type Chooser** → creates a floor → lands on the Floor Plan Editor.
4. **Floor Plan Editor** — 2D canvas, `Floors` switcher (bottom right), `+ Insert`, `i` for floor details, Undo/Redo.
5. **Insert Menu** — `Room` and `Object` only.
6. **Add a Room** chooser — **with only `Add a square room` and `Draw Room` live**, everything else visibly disabled with a reason.
7. **Room Editor** — selection, blue outline, dim-and-zoom on select, wall/corner tap targets.
8. **Detail Sheet** — three tabs, with only `Details` populated (`Measures` ceiling height, `General` name/type/color/floor assignment).
9. **Back/exit semantics from §1.3.**

**Exit test on a real phone:** create a job, add a basement, drop a square room, resize it to 4 m × 3 m, name it "Salle mécanique", set ceiling height, and see the floor area compute. If that takes more than 90 seconds, the chain is wrong — fix it here, not later.

---

### Phase 2 — Capture

Now the camera. RoomPlan first because it is the highest-value and the stack already has it.

1. **`Auto-Scan` via RoomPlan** — full-screen capture, record button, photo shutter, live 2D/3D toggle, white/green/orange wall semantics, `Confirm Scan` / `Discard & Rescan` per room, `Done`.
2. **`Configure Floor Plan` commit gate** — `Include Objects`, `Session Replay` (default ON), **plus our per-room name and type rows**, then `Generate Floor Plan`.
3. **Device gating** with disabled entries and honest reasons. Storage check at <10%.
4. **Failure handling:** a room whose walls did not close must be named and surfaced, never silently dropped.
5. **`Change Measurement`** — scroll picker, `Apply`, the **lock**, `Unlock`, `Confirm`-on-drag. Ceiling height from the scan is pre-filled and editable, never silently defaulted.
6. **Assembly:** `Edit Layout`, drag, green snap indicators, blue curved arrow rotation, `Merge Rooms`. **Overlap is a blocking validation** (Xactimate loses overlapping data).

**Exit test:** scan a real three-room basement in one Auto-Scan session, correct one wall with a typed dimension, confirm the lock icon appears and that assembling the rooms does not move the locked wall.

---

### Phase 3 — Documentation (this is the product for a restoration contractor)

1. **`Photos & Notes` tab** — camera, library, video (5-min cap), multiple timestamped notes, attached at room / wall / object level.
2. **Yellow annotation bubble** on any element carrying a photo, note, or form. The plan becomes the completeness checklist.
3. **`Affected Area` editor** — floor areas first: `Add New Area`, whole-floor pre-selection, corner drag, tap-edge-to-add-corner, tap-measurement-to-type, `Name`, `Fill Color`, `Show dimensions` / `Show label`, `Done`, **plus a structured cause-of-loss and IICRC category/class**.
4. **`Elevation` view + wall affected areas** — required for flood-cut height. Ships with the `Display elevation in report` toggle.
5. **Object catalog** with the `Restoration` and `Annotation` categories: dehumidifiers, air movers, air scrubbers, moisture meters, photo pins.
6. **Moisture readings** — placed on a meter object, **typed entry first**, Bluetooth import second. Material type and dry standard on every reading. Grouped under a dated `MonitoringVisit`.
7. **`Forms` tab** — form runner on mobile; form builder in the web CRM.

**Exit test:** produce a complete file for one flooded basement: three rooms scanned, affected areas drawn on floors and on the flood-cut walls, twelve photos attached to the right elements, day-1 moisture readings recorded, and every documented element showing its yellow bubble.

---

### Phase 4 — Output

Nothing before this point is billable. Nothing after this point matters if the chain above is broken.

1. **Statistics** — all confirmed statistics plus our `Ceiling Area`, with the per-statistic `i` explainer.
2. **Report PDF** — Title Block from the Company Profile, attachment toggles (Dimensions, Fields, Photos/360/Videos, Notes, Forms), page layout, room labels, scale, disclaimer. **Versioned, never overwritten.**
3. **`Files and Sharing`** hub + the `Files` repository.
4. **Photo report** — PDF and shareable web gallery.
5. **Statistics export** — PDF and CSV.

**Exit test:** the client sends a generated report to a real adjuster and it is accepted without a follow-up request for information.

---

### Phase 5 — Money (web CRM only)

1. **Price list** with the four cost buckets (Labor / Material / Equipment / Other), sections and items, XLSX import.
2. **Estimate** grouped by room with the room sketch thumbnail, `From Price List` / `New Item` / `Subsection`, status enum.
3. **Formula modal** with **our explicit variable names** (§2.26), live values, keypad, save-back to quantity.
4. **Totals ladder** in the confirmed order, markup on costs, **TPS/TVQ modelled correctly** with an explicit compounding flag.
5. **Export presets** — client-facing and internal versions of the same estimate.

---

### Phase 6 — Interop (only if the client's carriers demand it)

1. **ESX / Verisk export** — blocked by any overlapping room; photo compression against the 100 MB cap.
2. Cotality / Symbility export — **verify the format name before quoting a date. FML is unconfirmed.**
3. API + webhooks for the CRM's own accounting.

---

### Explicitly deferred (magicplan does not have these either)

Stacked multi-floor view · dollhouse 3D · true sloped/vaulted ceilings · automatic staircase linking between floors · cross-floor spatial alignment · assemblies/kits in the estimator · AI damage detection. All are either absent from magicplan, declined on its roadmap, or unverified marketing. None of them is on the path from "flooded basement" to "paid invoice."