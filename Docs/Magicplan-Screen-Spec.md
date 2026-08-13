# Magicplan — Screen-by-Screen Workflow Spec

**For:** engineers building the magicplan-equivalent capture workflow inside the Renovision Ana CRM (Next.js `src/app/(internal)/admin/*` + Capacitor iOS shell + Apple RoomPlan via `RoomScanPlugin.swift`).
**Written:** 2026-08-13. **Client:** Quebec water-damage restoration contractor doing direct insurance work.
**The complaint this document answers:** the app has scanning, and it has projects, but there is no chain that walks a technician from *a job* to *a measured room*. Section 1 is that chain. Everything else supports it.

---

## 0. How to read this document

### 0.1 Evidence tiers

Every magicplan fact below carries a tier. Engineers may treat A and B as fact. C is a working assumption. D must be verified before a line of code depends on it.

| Tier | Meaning |
|---|---|
| **A** | Observed first-hand in the live magicplan app / cloud on Renovision's own account, Aug 2026. Recorded in `/Users/artush/Developer/renovision_ana/Docs/Magicplan-Workflow.md`. |
| **B** | The exact string appeared in quotation marks on two or more independently fetched help.magicplan.app pages. |
| **C** | Quoted on one fetched page, or a paraphrase of prose on a fetched page. Meaning is reliable; exact characters are not. |
| **D** | Marketing page, third-party review, search-result snippet, or inference. **Unverified.** |

Two research passes disagree in places (research was text-only from the help centre; the in-repo doc was hands-on). Where they conflict, section 4.3 names the conflict rather than picking a winner silently.

### 0.2 Label rules

- Magicplan labels are quoted `"like this"` with a tier.
- Labels for **our** product are marked **(OURS)**.
- Labels marked **(OURS — shipped)** already exist in this codebase; use them, do not reinvent them.
- Labels marked **(OURS — proposed)** are my suggestion filling a gap the research did not confirm. They are proposals, not findings.
- **Do not invent magicplan labels.** If a label is not below, it was not confirmed.

---

## 1. NAVIGATION MAP

### 1.1 Magicplan's chain, project to finished room

Reconstructed. Ordering inside the two pop-ups is **not** confirmed (see 4.2).

```
Home Screen                                    [B]
 │  tile: "New Project" (+)                    [B]
 │  tile: an existing project
 ▼
Project Dashboard  (a.k.a. "the project screen")   [B]
 │  scrolling sections: description · statistics · "Floor Plans" · "Photos" · "Files"
 │  section "Floor Plans"  →  (+)  /  "+ Add Floor"   [B, two wordings]
 │      ▼
 │   floor-type pop-up  ("select the desired floor type")   [C — list NOT enumerated anywhere]
 │      │  confirmed entries: "Roof", "Land Survey"   [C]
 │      ▼  picking a type CREATES the floor and drops you on it
 ▼
Floor Level  (the floor plan canvas / editor)   [B]
 │  "+ Insert"  (written "+ Add" in other articles — same control, assumed)   [B / conflict]
 │      ├─ "Room"      [B]
 │      ├─ "Object"    [B]
 │      └─ "Note", "Photo", "Form"   [A — observed; the help centre never lists these]
 │  "Floors" (bottom right) — floor switcher    [C]
 │  "Rotate", "Edit Layout", "Merge Rooms", "3D", Undo/Redo, "i"   [C]
 │      ▼ (Insert → Room)
 │   "Add a Room" pop-up — THE MODE CHOOSER      [B]
 │      ├─ "Start Manual-Scan"   [C]   iOS, ARKit; sub-modes "Wall Mode" (LiDAR) / Corner Mode
 │      ├─ "Auto-Scan"           [C]   iOS, LiDAR + iOS 17, multi-room
 │      ├─ "Add a square room"   [B]
 │      ├─ "Draw Room"           [B]   (a.k.a "Free Form Room" / "Define corners" — 3 names in live docs)
 │      ├─ "Import and draw"     [B]
 │      └─ "Insert a filler"     [B]   → "Filler Room" / "Filler Wall" [C]
 │      ▼
 │   room-type picker — Residential / Commercial groupings   [C]
 │      ⚠ whether this comes BEFORE or AFTER the mode choice is contradictory across three
 │        magicplan articles. Do not copy an order from this document.
 │      ▼
 │   ── capture ──────────────────────────────────────────────
 │   Auto-Scan session               [C]
 │     red record button · white photo shutter · 2D/3D toggle
 │     white lines = detecting · green = captured · orange = bad scan
 │     stop → "Confirm Scan" / "Discard & Rescan" → repeat rooms → "Done"
 │       ▼
 │     "Configure Floor Plan" window   [C]
 │       "Include Objects" (Plumbing Fixtures / Appliances / Furniture) ·
 │       "Session Replay" toggle · "Generate Floor Plan"
 │
 │   Manual-Scan session              [C]
 │     Corner Mode: aim at floor corner → tap → close perimeter or "Done"
 │       → set ceiling height by travelling floor-to-ceiling on the grid → tap
 │       → tap each door/window (green highlight) → "Exit AR" → "Yes, I'm sure"
 │     Wall Mode: calibrate (feet, then ceiling) → point at each wall → wall turns
 │       green with a check mark → toggle "Wall Mode" to fall back to corners
 │   ─────────────────────────────────────────────────────────
 │      ▼  the room lands on the floor as a free-floating shape
 │   assembly: drag / rotate / snap (green indicators) / "Merge Rooms" / fillers   [C]
 ▼
Room Level                                      [B]
 │  "i" (tablet) or swipe up (phone)  →  three tabs: "Details" · "Photos & Notes" · "Forms"  [B]
 │  Details: "Room Name" · room type · room colour · Ceiling Height · living area ·
 │           General → floor attribute (this is how a room MOVES floors)  [B]
 │  "Affected Area" → "Add New Area"   [B]  ← the restoration primitive
 │  "Duplicate" (identical / flip H / flip V) · "Split Room" · "Merge Rooms" ·
 │  "Set Diagonal" · "Edit Layout" · "Delete"   [C]
 │      ├─ tap a wall  ▼
 │      │   Wall Level  →  "Add Corner" · "Add Wall" · "Split Room" · "Delete" · "Elevation"  [C]
 │      │     wall Details: Length · "Display in Elevation Report" · Load Bearing ·
 │      │     its own "Affected Area"   [C]
 │      └─ tap an object  ▼
 │          Object Level  →  Width · Depth · Height · Distance to Floor · Duplicate · Delete  [C]
 ▼
DONE — the room is measured, named, typed, and carries its damage.
```

**Load-bearing architectural fact [B, stated in magicplan's own FAQ]:** magicplan is **room-based, not wall-based**. You cannot subdivide a space by drawing a wall; you add another room, or you use "Split Room". Every capture mode produces a *room*. Copy this or reject it deliberately — it decides your whole data model.

### 1.2 Our chain, on our routes

This is the deliverable. `[shipped]` = exists in the repo today. `[gap]` = the break the client is complaining about.

```
Tab bar  (AdminShell.tsx)
 │
 ├─ "Scan"  →  /admin/scan                                        [shipped, ORPHAN — see BO-3]
 │     RoomScanner with no project and no floor. This tab IS the complaint:
 │     it scans into nowhere. It must stop being the front door.
 │
 └─ "Projects"  →  /admin/projects                                [shipped]
       │  project row
       ▼
    /admin/projects/[id]              (project page)              [shipped]
       │  Statistics band: Floor area · Wall area · Floors · Rooms  [shipped, derived]
       │  Claim details                                             [gap — BO-6]
       │  section "Floor plans"                                     [shipped]
       │     button "Add floor plan"  (OURS — shipped)
       │        ▼ sheet "Which floor?"  (OURS — shipped)
       │          Basement · Ground · 2nd · 3rd · Attic  (fixed list, AddFloorPlan.tsx)
       │          ⚠ a floor picked here does NOT persist until a room exists on it.
       │            Back out and the floor is gone. THE CHAIN BREAKS HERE.  [gap — BO-1]
       │        ▼
       │     floor row  →
       ▼
    /admin/projects/[id]/floors/[level]     (floor workspace)      [shipped]
       │  dark header: project name · level · Floor / Walls / Perimeter   [shipped, derived]
       │  grid of room cards (thumbnail plan + name + sq ft)              [shipped]
       │  pinned button "Add"  (OURS — shipped)
       │     ▼ sheet "Add to this floor"  (OURS — shipped)
       │        ├─ "Room"    (OURS — shipped)  ─┐
       │        ├─ "Photo"   (OURS — shipped, disabled: "Coming next.")
       │        └─ "Note"    (OURS — shipped, disabled: "Coming next.")
       │                                        │
       │        ▼ sheet "How do you want to measure it?"  (OURS — shipped)
       │           ├─ "Scan the room"          LiDAR / RoomPlan   [shipped]
       │           ├─ "Point at the corners"   ARKit, no LiDAR    [gap — BO-5, task #9]
       │           └─ "Enter the dimensions"   square room        [gap — BO-5]
       │        ▼
       │     native scan  (RoomScanPlugin.startScan → RoomScanViewController)   [shipped]
       │        ▼
       │     ⚠ NO REVIEW STEP. The result is saved immediately as "Room N" with no
       │       type, no confirm, no rescan.  [gap — BO-2]
       │        ▼
       │     back to the floor workspace, room card appears
       │  room card tap
       ▼
    RoomSheet  (bottom sheet over the floor)                       [shipped]
       │  editable name field  (aria-label "Room name")            [shipped, entered]
       │  plan drawing (FloorPlan.tsx)                             [shipped, derived]
       │  Floor · Walls · Perim. · Ceiling                          [shipped, derived]
       │  section "Affected areas"  (OURS — shipped)
       │     └─ AffectedAreaEditor → polygon, name, damage type     [shipped]
       │  room type                                                 [gap — BO-2]
       │  move to another floor                                     [gap — BO-1]
       │  wall level / elevation                                    [gap — BO-7]
       ▼
    DONE
```

**The five breaks, in the order they hurt:**

1. A floor with no rooms does not exist. `getProjectSurvey` derives `levels` from `room_scans`, so "Add floor plan" → back → the floor is gone. The chain has no memory.
2. Nothing happens *after* the scan. No name, no room type, no confirm/discard, no rescan. magicplan's equivalent moment is `"Confirm Scan"` / `"Discard & Rescan"` / `"Configure Floor Plan"` [C].
3. The Scan tab bypasses the chain entirely and is the most prominent way in.
4. Two of three capture modes are disabled, so any technician on a non-Pro iPhone has *no* way to add a room at all.
5. No claim fields on the project, which for direct insurance work is the data the adjuster pays against.

---

## 2. SCREEN-BY-SCREEN

Format per screen: what it shows → control table (label, source, destination) → states.

### S1 — Project list · `/admin/projects` [shipped]

**Shows:** projects for the workspace, each with client, status pill, dates.
**Magicplan equivalent:** Home Screen [B] — grid of project tiles, `"Search bar"`, `"Favorites"` / `"Archived"` category buttons, workspace/team switcher, `"Profile"` in a bottom bar, and a per-tile `"..."` menu offering Favorite / `"Duplicate"` / move / archive [C]. Favoriting is what makes a project available offline [C].

| Control | Source | Leads to |
|---|---|---|
| Project row | OURS — shipped | S2 |
| "New project" | OURS — proposed (label unverified in magicplan; their tile reads `"New Project"` [B]) | S2 with a fresh project |

**Do not build now:** favourites, archive, workspaces. One contractor, one workspace.

### S2 — Project page · `/admin/projects/[id]` [shipped]

**Shows, in order:** header (name, client link, status pill) · Started / Created / Files · description · **Statistics** (Floor area, Wall area, Floors, Rooms — all derived) · **Floor plans** · status buttons · Estimates · Files · Jobs.

Magicplan's dashboard is a **scrolling stack of named sections, not tabs** [C, inferred from "locate the 'Floor Plans' section" / "Scroll to locate the 'Photos' section"]. Ours already matches. Their section is called `"Floor Plans"` in one article and `"Floors"` in another [B/C conflict — ours says "Floor plans", keep it].

| Control | Source | Leads to |
|---|---|---|
| "Add floor plan" | OURS — shipped | S3 sheet |
| Floor row (e.g. "Basement · 412 sq ft · 3 rooms") | OURS — shipped | S4 |
| Room thumbnail card | OURS — shipped | S4 (currently the floor, not the room — should deep-link to the room after BO-4) |
| "New estimate" | OURS — shipped | `/admin/quotes/new?project=…` |
| Claim details | OURS — proposed, **BO-6** | inline editor |

**States:** DB unconfigured → migration notice. `survey === null` (0024 not run) → migration notice. Zero floors → "No floor measured yet…" (already written, and after BO-1 this copy must change, because a floor can then exist with zero rooms).

### S3 — Floor picker sheet · "Which floor?" [shipped]

**Shows:** a fixed list — Basement · Ground · 2nd · 3rd · Attic — with already-measured storeys marked "measured" and sorted last.

This is a deliberate and correct divergence. Magicplan's floor-type list **could not be enumerated by any researcher**; only `"Roof"` and `"Land Survey"` were ever confirmed [C]. Ordering of floors is completely undocumented [uncertain]. Our fixed Quebec-house list is better than guessing theirs; the code comment in `AddFloorPlan.tsx` already gives the reason (free text splits "Bsmt" from "Basement" across two rows in every roll-up).

| Control | Source | Leads to |
|---|---|---|
| A level row | OURS — shipped | navigates to S4 for that level |
| "Cancel" | OURS — shipped | dismiss |

**Change required (BO-1):** picking a level must **create a floor record**, not just navigate. Add `sort_order` from the fixed list so floors sort Basement → Attic deterministically.

### S4 — Floor workspace · `/admin/projects/[id]/floors/[level]` [shipped]

**Shows:** dark header (project name over level name) with three derived figures — Floor, Walls, Perimeter — then a two-column grid of room cards, each a mini plan plus name plus sq ft. Back link to the project.

Magicplan's Floor Level [B] additionally carries: `"Floors"` floor switcher bottom-right, `"Rotate"` (rotates the whole floor, not one room), `"Edit Layout"`, `"Merge Rooms"`, `"3D"`, Undo/Redo, and floor Details (Ceiling Height, interior/exterior wall thickness, Floor Name) [C]. **Wall thickness is per-floor, not per-wall** [C, quoted] — if we ever draw thickness, copy that.

| Control | Label source | Leads to |
|---|---|---|
| "Add" (pinned, full-width, thumb-height) | OURS — shipped | S5 |
| Room card | OURS — shipped | S9 RoomSheet |
| Back link (project name) | OURS — shipped | S2 |
| Floor switcher | OURS — proposed ("Floors", matching magicplan [C]) | sibling floor |
| Floor details (ceiling height default) | OURS — proposed, later | inline |

**States:** loading · "Nothing measured on this floor" empty card (already written and good) · error banner · `busy` → the Add button reads "Scanning…".

### S5 — "Add to this floor" sheet [shipped]

**Shows:** an iOS action-sheet of what can be placed on a floor.

Magicplan's `"+ Insert"` on a normal floor is confirmed to offer `"Room"` and `"Object"` [B]; the in-app pass also saw **Note, Photo, Form** [A]. The help centre never lists the full menu [uncertain]. Ours currently offers Room (live), Photo and Note (disabled, "Coming next.").

| Control | Source | Leads to |
|---|---|---|
| "Room" | OURS — shipped | S6 |
| "Photo" | OURS — shipped, disabled | (BO-8) |
| "Note" | OURS — shipped, disabled | (BO-8) |
| "Cancel" | OURS — shipped | dismiss |

**Do not add "Object" yet.** A furniture/equipment catalogue is a large build and is not on the critical chain. It arrives with equipment placement.

### S6 — "How do you want to measure it?" sheet [shipped]

The direct analogue of magicplan's `"Add a Room"` pop-up [B]. Ours has three entries; the copy is already device-aware, which is the part that matters.

| Control | Source | State today | Leads to |
|---|---|---|---|
| "Scan the room" — "Walk the room with the phone up. Fastest and most accurate." | OURS — shipped | enabled iff `roomScanSupport() === "supported"` | S7 |
| "Point at the corners" — "Stand still and tap each corner. For phones without LiDAR." | OURS — shipped | disabled, "Coming next." | S8 (BO-5) |
| "Enter the dimensions" — "Type width and length for a square room." | OURS — shipped | disabled, "Coming next." | numeric form (BO-5) |

**Device gating, magicplan's tiers [C, consistent across three pages]:** Corner Mode = any ARKit iPhone; Wall Mode = LiDAR (12 Pro / Pro Max / iPad Pro+); Auto-Scan = LiDAR **and** iOS 17+. Android gets no scanning at all. Our `ScanSupport` already distinguishes `supported` / `no-lidar` / `not-native` / `plugin-missing` — keep that fourth state, its comment records a build lost to a missing plugin registration masquerading as a hardware limit.

**Unresolved and cheap to get wrong:** whether unavailable modes should be **hidden or shown-disabled**. Magicplan's behaviour is unknown [uncertain]. Ours shows them disabled with a reason. Keep that — a technician needs to know the corner mode exists and why it is unavailable, not wonder where it went.

**Room type:** magicplan asks for it around here, but three of their own articles disagree on whether it comes before or after the mode choice [uncertain]. **We put it after capture** (S8), because a technician standing in a wet basement should start the scan first and label afterwards.

### S7 — Scan session (LiDAR / RoomPlan) [shipped, native]

Native `RoomScanViewController` presented by `RoomScanPlugin`. Apple's RoomCaptureView supplies its own chrome; we do not restyle it.

Magicplan's Auto-Scan chrome, for reference [C]: red record button, white photo shutter, live 2D/3D toggle, and colour semantics that are load-bearing — **white lines = detecting, green = captured, orange = improperly scanned**. Then `"Confirm Scan"` / `"Discard & Rescan"`, repeat per room, `"Done"`, then the `"Configure Floor Plan"` window with `"Include Objects"` (Plumbing Fixtures / Appliances / Furniture), a `"Session Replay"` toggle, and `"Generate Floor Plan"`.

| Control | Source | Leads to |
|---|---|---|
| Apple's capture controls | Apple | end of capture |
| Cancel / back out | Apple + our plugin | S4, no room saved (our code already treats `/cancel/i` as not-an-error — correct) |

**Failure to handle, already handled once:** Capacitor resolves with `{}` instead of rejecting when a payload contains a `NaN` double. `scanRoom()` checks `Array.isArray(result?.walls)` and throws a readable error. Any new capture mode must repeat that check.

### S8 — Post-scan review **[does not exist — BO-2]**

The single largest missing screen. Right now `startScan()` saves `Room ${position + 1}` and returns to the grid. There is no moment where the technician confirms what was captured.

**Proposed contents (OURS — proposed):**

| Control | Label (OURS — proposed) | Leads to |
|---|---|---|
| Plan preview + headline figures | — | — |
| Room name field, pre-filled | "Room name" | — |
| Room type picker | "What is this room?" | list below |
| Save | "Save room" | S4 with the room added |
| Rescan | "Scan again" | S7, discarding this capture |
| Discard | "Discard" | S4, nothing saved |

**Room type list:** **no researcher confirmed magicplan's list** — only that there are Residential and Commercial groupings and an `"Other"` type [uncertain]. Do not copy a list from this document. Ours, proposed for Quebec residential water work: Kitchen · Bathroom · Bedroom · Living room · Dining room · Hallway · Stairs · Laundry · Basement · Garage · Closet · Other. Ship it as data, in French and English, editable in settings — the type will later drive default price-book lines, so it is not cosmetic.

Whether magicplan's room *type* drives the room *name*, the estimating logic, or nothing at all is explicitly undocumented [uncertain]. Ours: type is a separate field from name; name defaults from type ("Bathroom", "Bathroom 2"), and type is what estimating reads.

### S9 — RoomSheet (room level) [shipped]

**Shows, in order:** name field · plan drawing · four derived figures (Floor / Walls / Perim. / Ceiling) · **Affected areas** section with per-area colour dot, name, sq ft, remove · 3D model button when `modelId` exists · delete.

The order is right and matches magicplan's own emphasis: measurements first, damage second. Magicplan's Room Level Details contains Room Name, room type, room colour, Ceiling Height, living-area calculation, and — importantly — the **floor assignment as an editable attribute** [B]. In magicplan you do not *move* a room between floors; you edit its floor attribute. Copy that exactly; it is far simpler than drag-and-drop and it is what the data model wants.

| Control | Source | Leads to |
|---|---|---|
| Room name (inline field) | OURS — shipped | saves on blur |
| Affected areas → add | OURS — shipped | S10 |
| Area row → remove | OURS — shipped | delete with confirm |
| View 3D | OURS — shipped | native model viewer |
| Delete room | OURS — shipped | S4 |
| Room type | OURS — proposed, BO-2 | inline picker |
| Floor | OURS — proposed ("Floor", mirroring magicplan's General → floor attribute [B]) | reassigns level |
| Wall list / elevation | OURS — proposed, BO-7 | S11 |

**Magicplan behaviour worth copying, and the sharpest disagreement in the research [A vs uncertain]:** tapping a room on the floor plan **zooms to it, greys out every other room, and opens its detail sheet**; deselected the plan shows names and areas with no dimensions, selected it shows full dimension tiers with witness lines and corner handles — *two distinct drawing states, not one plan with a highlight* [A, observed]. The help-centre researcher could not confirm any of this and warns it is undocumented. Treat the observation as the spec and the help centre as silent, **not** as contradicting.

### S10 — Affected area editor [shipped]

The restoration primitive, and the bridge from a measurement to an invoice.

**Confirmed magicplan behaviour [B/C], all of which our schema already anticipates:**
- An area belongs to **a room's floor or one specific wall** — never free-floating.
- Creating one **pre-seeds the entire surface**, then you shrink it. The interaction is subtractive. [C, quoted: "The entire floor will appear pre-selected."]
- Editing: drag a corner · tap an edge to insert a corner · type an exact figure · take it off a Bluetooth laser (`PrecisionLink`).
- Fields: **Name**, **Fill Color**, auto area, toggles for `"Show dimensions"` and `"Show label"` (numbered, editable).
- `"Wall-based areas cannot transfer to floors and vice versa."` [C, quoted]
- Overlapping areas are allowed [A].
- Photos, 360s, videos, notes and forms attach **to the area itself** [C] — the evidence sits on the damage, not on the room.
- They flow into report PDFs, statistics reports, the API, and the Xactimate ESX as **`"Reference Areas"`** [C].

| Control | Source | Leads to |
|---|---|---|
| Polygon corner handles | OURS — shipped | live area recompute |
| Area name field | OURS — shipped | — |
| Damage type chips — Water / Fire / smoke / Mould / Impact / Other | OURS — shipped (`DAMAGE_LABEL`) | sets default colour |
| Save / Cancel | OURS — shipped | S9 |
| Pre-seed whole surface | OURS — proposed, **behaviour change** | — |
| Attach photo to the area | OURS — proposed, BO-8 | camera |

**Where we already beat magicplan, and should say so:** magicplan has **no confirmed structured damage-type field** — only a free-text name and a fill colour [uncertain, flagged by two researchers]. IICRC Category 1/2/3 and Class 1–4 appear only in their marketing blog, never as app fields. Our `damage_type` enum is in the database with the colours bound to it. Keep it, and extend it to CAT/Class at claim level (BO-6).

### S11 — Wall level / elevation **[does not exist — BO-7]**

Magicplan's wall is a peer detail level under the room [B]: tap a wall → `"Add Corner"` · `"Add Wall"` (a partial wall) · `"Split Room"` · `"Delete"` · `"Elevation"` [C]. Wall Details carry Length, a `"Display in Elevation Report"` toggle, a Load Bearing indicator, and the wall's own `"Affected Area"` [C]. A wall affected area is drawn in **Elevation View** and renders on the 2D plan as a thin bar [C].

For a water-damage contractor this is not optional — flood cuts, wet drywall and mould are wall-surface quantities. But it is downstream of a working chain. `affected_areas.surface='wall'` and `wall_index` already exist in migration 0025; the UI does not.

### S12 — Claim details on the project **[does not exist — BO-6]**

The one field set in this whole document that came from **direct observation of magicplan's restoration field template** [A], and the one that decides whether an adjuster pays:

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
| ↳ Category of Water | List (conditional) | CAT 1, CAT 2, CAT 3, Not Defined |
| ↳ Class of Water | List (conditional) | Class 1, Class 2, Class 3, Not defined |
| ↳ Enter Other Type of Loss | Text (conditional) | |
| Loss Date | Date | |

The indented three appear only when Type of Loss = Water. Available field types observed: Yes/No, List, Multi-select, Text, **Distance**, Number, Photo, Color, Date and Time; each can be mandatory, defaulted, and conditional [A].

Note the help-centre researchers independently found **no evidence of any built-in claim, carrier, adjuster or date-of-loss field** and concluded these must be custom Fields [uncertain]. The observation pass shows they exist as a shipped *template* of custom Fields. Both are true: the mechanism is generic custom fields, the content is a restoration template. Build ours as data on top of the existing `app_settings.custom_fields` / `CustomFieldDef` system used by `ClientForm.tsx`, extended with conditional logic and Photo/Date types.

---

## 3. DERIVED vs ENTERED

The rule: **a measurement is derived and read-only; a judgement is entered and editable.** Getting this wrong is how a survey becomes unfalsifiable and an adjuster stops trusting the report.

### 3.1 Derived — computed from geometry, never typed

| Value | Computed by | Notes |
|---|---|---|
| Floor area | `totalFloorAreaSquareMeters` | per room; summed per floor; summed per project |
| Wall area, gross and net | `wallAreaSquareMeters(...).net` | net = gross minus door and window area. **The headline "Wall Area" is the NET figure** [A — their own example: 252 m² gross, 35.9 m² doors, 3.76 m² windows, 213 m² net] |
| Perimeter | `totalWallLengthMeters` | |
| Ceiling height | `ceilingHeightMeters` | derived from wall heights; magicplan makes this an *entered* step in Corner Mode [C] — see 3.3 |
| Opening area | `openingAreaSquareMeters` | scans saved before the plugin emitted heights treat them as zero rather than guessing a standard door — correct, keep it |
| Volume | area × height | not yet computed; magicplan reports it [C] |
| Affected area sq ft | polygon shoelace | `area_sqm` column is a **cache**, not a source |
| Floor and project roll-ups | sum of rooms | |
| Estimate line total | quantity × unit cost | [C] |

Storage discipline, already correct in migration 0024 and worth restating: **store SI, render imperial.** "Storing feet would bake one conversion into the record and lose the source measurement." Quebec is metric on paper and imperial in the trades; the DB should not have to care.

`room_scans.floor_area_sqm`, `wall_length_m`, `ceiling_height_m` are denormalised caches of `geometry`. Anything that edits geometry must rewrite them in the same transaction, or the project statistics silently drift from the plans they summarise.

### 3.2 Entered — judgement, always editable

Room name · room type · floor assignment · room colour (status) · damage type · affected-area name and colour · notes · photos · claim details (carrier, claim number, adjuster, Type of Loss, CAT, Class, Loss Date) · equipment placement and in/out dates · moisture readings taken by hand · line-item selection · project and estimate status.

Magicplan expresses **status as colour on the plan** [C] — yellow assessing, orange in progress, green done — so opening a floor plan tells you what is damaged, what must happen, what machinery is on site and how far along each room is, without reading a word [A]. That is worth copying and costs one column.

### 3.3 The third category: a measurement a human overrode

Magicplan's model, confirmed and worth copying wholesale [C]:

- Typing a dimension **locks** it — a lock icon appears next to the value.
- A locked dimension is **immune to room assembly and to other dimension edits**. Surrounding geometry rescales around it.
- Changing it back requires an explicit `"Unlock"`, or dragging the wall and confirming.
- Scale in `"Import and draw"` is a **one-shot decision**: "You cannot change the scale after creating your floor plan."

Our rules:

1. An override is a **separate column**, never a write over the scanned value. Keep both; the scan is evidence.
2. An overridden value is **visibly marked** in the UI and in the adjuster-facing report. Provenance is the product on insurance work.
3. Ceiling height is the first place this bites: RoomPlan derives it, Corner Mode makes a human enter it, and a sloped or partially-demolished ceiling makes both wrong. Allow a per-room override; keep the derived value beside it.
4. Never let a human type a *total*. Floor area, wall area and roll-ups have no override path — if they are wrong the geometry is wrong, and that is what gets fixed.

---

## 4. CONFIRMED vs UNCERTAIN

Every researcher's caveats, merged. Engineers: **section 4.1 is fact. Everything from 4.2 down is not.**

### 4.1 Confirmed (Tier A or B, safe to build against)

**Structure**
- Hierarchy is Project → Floor → Room → Object, with Wall as a peer detail level under Room. [B]
- A project must exist before a floor; a floor before a room. No documented way to add a room without first choosing a floor. [B]
- magicplan is room-based, not wall-based. `"Rather than simply adding a wall, you'll need to add a new room."` [B, quoted twice]
- A room's floor membership is an **editable attribute** in Details → General, not a drag or a move command. [B]
- Photos & Notes and Forms attach at project, floor, room, wall **and** object level. [B]
- The info panel is one control with two gestures: `"i"` upper right on tablet, swipe up from the bottom on phone; it always holds the same three tabs, `"Details"` · `"Photos & Notes"` · `"Forms"`. [B]
- Editor menus sit on the left on tablets and in the bottom navigation on phones, consistently across features. [C, but consistent across many pages]

**Capture**
- Mode names `"Add a square room"`, `"Draw Room"`, `"Import and draw"`, `"Insert a filler"` and the pop-up name `"Add a Room"`. [B]
- Corner Mode = ARKit, any recent iPhone. Wall Mode = LiDAR. Auto-Scan = LiDAR + iOS 17. Android has no scanning at all. [C, consistent across three pages]
- You can switch Wall ↔ Corner mid-scan without restarting. [C]
- Auto-Scan cannot capture staircases, beams, or vaulted/sloped ceilings. [C]
- Auto-Scan colour semantics: white = detecting, green = captured, orange = bad. [C]
- For restoration specifically, magicplan's own guidance is a **hybrid**: scan the accessible rooms, then create severely damaged or inaccessible rooms manually with Square Room / Define Corners plus a Bluetooth laser. [C]

**Damage**
- An affected area is parented to a room's floor or one specific wall, is pre-seeded as the entire surface, and cannot move between floor and wall. [B/C]
- Its fields are Name, Fill Color, auto-calculated area, `"Show dimensions"`, `"Show label"`. [C]
- Photos, 360s, videos, notes and forms attach to the area itself. [C]
- Affected areas export to Xactimate ESX as `"Reference Areas"`; the Xactimate integration requires a PRO subscription and is enabled per workspace. [C]
- Moisture readings attach to a **moisture meter object placed on the plan**, are date-stamped, and accumulate as a time series per location; the fields returned depend on the device, so every reading field must be independently nullable. [C]

**Estimating**
- `"The Estimating feature can only be accessed on a tablet connected to internet or on a desktop."` [C, quoted] The phone captures; the cloud prices.
- An estimate is a child of a project; a project can hold several. [C, corroborated by their API path]
- Line items are materials / labour / services; total = quantity × unit cost, summed live. [C]
- Cost rules are one abstraction covering tax, markup and discount, applied globally or per line. [C]
- Templates carry line items + cost rules + project settings. [C]
- Status values: Sent, Accepted, Approved, Rejected. [C]
- Export requires a non-zero total, and **floor plan sketches cannot be included in an exported estimate** — their words. [C]
- magicplan has **no invoicing**, and no accounting integration on their integrations page. The estimate is a terminal document. [C, plus a well-argued inference — this is our opening]

**Restoration/insurance field set** — the Claim Details table in S12. [A]

**Interactive plan behaviour** — tap a room, zoom, grey the rest, open the sheet; two distinct drawing states. [A]

### 4.2 Uncertain (merged; do not build against these)

**Labels and menus**
- The **floor type list** was never enumerated on any page. Only `"Roof"` and `"Land Survey"` confirmed. "Ground Floor"/"1st Floor" appear only as prose examples. **Do not hardcode a floor-type list from this research.**
- **Floor ordering** is completely undocumented — no sort order, no drag-to-reorder, no level index. Unknown whether two floors of the same type can coexist.
- **Floor naming**: `"Floor Name"` exists as an attribute, but whether the initial name comes from the type, whether renaming is free text, and whether renaming changes the type are all unknown.
- The **room type list** is unconfirmed. Only "Residential and Commercial options" and an `"Other"` type. One summary produced "Living Room, Kitchen, Bedroom, etc." — the "etc." reveals the summariser improvising.
- The **complete `"+ Insert"` menu** at floor level is unconfirmed beyond `"Room"` and `"Object"` (help centre) plus Note/Photo/Form (observation).
- `"+ Insert"` vs `"+ Add"`: two different label sets across articles, assumed to be one control with drifting docs. Unverified.
- `"Floor Plans"` vs `"Floors"` vs a standalone `"+ Add Floor"` — possibly three UI generations.
- `"Draw Room"` vs `"Free Form Room"` vs `"Define corners"` — all three appear on current pages.
- Whether the Auto-Scan entry reads `"Auto-Scan"`, `"LiDAR Auto-Scan"` or `"Start Auto-Scan"`.
- Capitalisation of `"Add a square room"` / `"Add a Square Room"` and `"Import and draw"` / `"Import & Draw"`.
- Whether the screen names `"Home Screen"` / `"Project Dashboard"` / `"Floor Level"` / `"Room Level"` appear anywhere in the actual UI or only in their docs.
- The complete editor menu at each selection state. Every list in section 2 is a union assembled from separate feature articles; ordering is unknown and the lists are probably incomplete.

**Flow order**
- Whether the **room-type picker comes before or after the capture-mode choice**. Three magicplan articles give three answers. Verify in the app.
- Whether unavailable capture modes are hidden or shown-disabled on incapable devices.
- Whether Wall Mode ends with the same `"Exit AR"` → `"Yes, I'm sure"` as Corner Mode.
- How ceiling height is determined in Wall Mode and Auto-Scan. Only Corner Mode has a documented step.
- Whether Auto-Scan auto-labels detected room types (RoomPlan can classify) or the user assigns every type by hand.
- What happens immediately after `"Split Room"`; what happens to the shared wall on `"Merge Rooms"`, and which room's name survives.
- Where a duplicated room appears on the canvas and whether it must be re-snapped.
- Whether a room can be duplicated onto a *different* floor. Undocumented; duplicate-then-reassign-the-floor-attribute is an inference.
- Whether project creation prompts for anything, or a project can exist unnamed.

**Mechanics with no numbers**
- Snap tolerance, rotation snapping to 90/45°, grid snapping, any angle entry field. The angled-walls article mentions no snapping at all.
- Default interior/exterior wall thickness values. Undo stack depth. Max rooms per Auto-Scan session, max corners, scan time limits.
- Whether displayed wall dimensions are interior clear or centreline.
- Canvas pan/zoom gesture — pinch is documented as *object resize*, which is unusual and may mean canvas zoom uses something else. Affects the entire gesture model; check it.
- Whether multi-select (several rooms or objects) exists at all.
- How to delete or move a corner once added.

**Restoration and estimating gaps — the ones that matter most to this client**
- **Equipment logging is the biggest hole.** Marketing says magicplan lets you "manage usage, location, and deployment times", but the actual help article on equipment placement contains no steps, no start/stop dates, no run-hours, no quantity. Their own blog suggests using custom attributes for it — which implies it is user-configured, not a feature. Equipment is billed **per unit per day**; if placement carries no dates, the drying period cannot become an invoice line. Unconfirmed either way, and a genuine opening.
- Whether a "dry log" is a named report type. Their reports page named only Photos Report, Full Project Report, Moisture Report.
- Whether daily monitoring visits are a modelled entity (a visit with a date, readings and equipment state) or just repeated readings on objects.
- Dry standard / dry goal / benchmark readings as fields. Psychrometrics (GPP, vapour pressure, dehu sizing) — nothing found at all.
- Whether affected areas can attach to **ceilings**. Only floors and walls confirmed.
- Whether an affected area carries a depth or height (flood cut height, cavity depth) or a linear-feet output alongside square footage. Only square footage confirmed.
- Whether a room can hold multiple affected areas and whether overlaps are summed or deduplicated. (Observation says overlaps are *allowed* [A]; the arithmetic is unknown.)
- Whether affected-area shapes can be concave, have holes, or auto-deduct obstructions.
- Whether custom Fields can scope to affected areas — the confirmed scope list is Project / All Floors / All Walls / All Rooms / Categories & Objects, and affected areas are **not** in it.
- **Whether an affected area's square footage automatically becomes a line-item quantity inside magicplan's own estimator.** The observation pass says areas "can be selected in the Estimator as the quantity for a line item" [A]; the help-centre pass could confirm only the ESX path [uncertain]. This is the single most valuable mechanic in the product. Verify by hand before designing ours around it.
- **No formula language was found anywhere.** "Auto-calculate quantities" is a claim with zero documented implementation. Do not model a formula engine on the assumption they have one.
- How a line item binds to a measurement (user picks a measurement type? inferred from unit? inferred from category?) — three plausible answers, none confirmed.
- Whether estimator "groups"/"modules" are reusable priced assemblies or just section headers. The API wording leans organisational.
- Price-list entry structure: SKU, unit of measure, separate labour/material rates, description — all unconfirmed. Only "category" is confirmed to exist. Price-list import is unconfirmed.
- Markup mechanics: percentage vs fixed, on cost vs on price, visible or hidden on the customer PDF — nothing.
- **Tax: nothing about multiple simultaneous rates, compound tax, or GST+QST.** One magicplan blog listed granular tax control as *not yet available*. **For a Quebec contractor this may be an outright gap in their product** — verify, because if their tax model is single-rate, parity is not the goal here.
- **The signature flow is unresolved.** Marketing says "Approvals with Signatures"; the help article that would explain it 404s. Whether a signature is captured live on the device or is a blank block printed on the PDF for wet signing is unknown, and it matters.
- What "Customer View" is — a hosted link, an in-app mode, or just the PDF.
- Whether accepting/signing changes the estimate status automatically; and what distinguishes "Accepted" from "Approved" (their own marketing omits "Accepted").
- Whether line items can carry photos, notes, or scope text.
- Rounding, waste/overage factors, minimum charges, unit conversion.
- Whether the Estimator API can write, or only read.

**Method caveats that apply to everything above**
- Four of five researchers read pages through a **summarising fetch tool**, not raw HTML. Even quoted short labels are a model's reproduction. Short repeated strings are ~90% reliable; anything longer than a few words is paraphrase.
- **No video evidence exists in this research.** Every YouTube fetch returned boilerplate. The Estimator webinar and the room-editing tutorial are the best remaining sources and should be watched by a human.
- **No French/Quebec localisation was researched at all.** French help pages exist (`help.magicplan.app/fr/…`). If any of their vocabulary is to be mirrored in our FR strings, it must be pulled separately.
- Some articles are version-stamped 9.5.0 and there is a `/migrated/` URL namespace; "The New magicplan" page confirms a recent reorganisation. Some labels above are certainly stale.
- Subscription gating is partly guesswork: Xactimate = PRO is confirmed; "restoration objects require a Report or Estimate subscription" came from a search snippet only.

### 4.3 Direct contradictions to settle by hand

| # | Claim | Against | Resolve by |
|---|---|---|---|
| 1 | Tap-a-room zooms and greys the others [A] | Help centre documents no such behaviour [uncertain] | Trust A; it is first-hand. Re-verify while building BO-4. |
| 2 | Insert menu offers Note/Photo/Form [A] | Help centre confirms only Room and Object [B] | Open the menu and photograph it. |
| 3 | Manual-Scan works on non-Pro iPhones [A] | Wall Mode needs LiDAR [C] | Both true — Manual-Scan has two sub-modes. No conflict. |
| 4 | Affected area usable as an estimator quantity [A] | Unconfirmed; only ESX export confirmed [uncertain] | The highest-value question in this document. |
| 5 | A third-party review claims AR sketching works on Android [D] | magicplan's own docs say no scanning on Android, on three pages [C] | The review is wrong. Ignore it. |
| 6 | The same review calls PrecisionLink a May 2026 capture mode [D] | magicplan's newsroom: April 2025, a laser-meter integration [C] | The review is wrong. Ignore it. |

---

## 5. BUILD ORDER

The smallest sequence that gives the contractor a working **project → floor plan → add → scan mode → scan → room detail** chain. Steps 1–4 are the chain. Everything after is value on top of a chain that already works. Do not reorder; each step depends on the one above it.

---

**BO-1 — Make a floor a real thing.** *(the chain currently has no memory)*

Today `getProjectSurvey` derives `levels` from `room_scans`, so a floor created via "Add floor plan" evaporates the moment you navigate back. That single fact is most of the client's complaint.

- Migration `0026_project_floors.sql`: `project_floors (id, project_id, name, sort_order, ceiling_height_m default 2.44, created_at)`. Seed order from the existing fixed list: Basement 0, Ground 1, 2nd 2, 3rd 3, Attic 4.
- `room_scans` gains `floor_id uuid references project_floors(id)`; backfill by matching `level` text; keep `level` for one release, then drop.
- `AddFloorPlan.tsx` creates the row, then navigates. `/floors/[level]` becomes `/floors/[floorId]` (keep a redirect from the old level route — links exist in the wild).
- `getProjectSurvey` lists floors from the table and left-joins rooms, so an empty floor renders with a real empty state.
- Room level reassignment on the RoomSheet — a picker, not a drag, exactly as magicplan does it [B].

*Acceptance:* add a floor, back out, reopen the project — the floor is still there with "0 rooms". Move a room from Ground to Basement from the RoomSheet; both floors' totals change.

---

**BO-2 — Add the post-scan review screen.** *(the chain currently has no ending)*

- New `ScanReview` step between `scanRoom()` resolving and `saveScan()` firing: plan preview, headline figures, **room name** (pre-filled from type), **room type** picker, and three actions — "Save room" / "Scan again" / "Discard" (all OURS — proposed).
- `room_scans` gains `room_type text`. Ship the type list as bilingual data, not a hardcoded array — it will drive price-book defaults later.
- Keep the `Array.isArray(result?.walls)` guard; surface a bad scan here, where "Scan again" is one tap away.

*Acceptance:* a scan that is cancelled saves nothing and shows no error. A scan that succeeds cannot reach the floor grid without a name and a type. "Scan again" discards the first capture — verify against the native merge set (`removeScanAt`), or the next Combine silently includes a room the operator deleted.

---

**BO-3 — Close the orphan door.** *(stop the app teaching the wrong path)*

- `/admin/scan` stops being a standalone scanner. Either it becomes "pick a project → pick a floor → scan" (which lands on BO-2's flow), or the tab is repointed at `/admin/projects` and the page kept as a developer-only hardware check.
- Recommended: keep the tab (a technician thinks in verbs), make it a two-tap project/floor chooser that funnels into the same S6 sheet. One capture path, two entrances.

*Acceptance:* there is no route in the app that produces a room not attached to a project and a floor.

---

**BO-4 — Make the floor plan interactive.** *(the chain becomes a plan, not a list)*

- Floor workspace renders all rooms of the floor on one canvas instead of a card grid.
- Tap a room → **zoom to it, grey the others, open the RoomSheet** [A]. Two drawing states, not one plan with a highlight: deselected shows name and area only; selected shows dimensions and corner handles.
- Assembly can wait. Rooms may sit unassembled at first; the tap-select-inspect loop is what makes the plan feel like a plan.

*Acceptance:* a three-room floor renders as one drawing; tapping any room dims the rest and opens its sheet; tapping outside restores the floor view.

> **--- MVP chain complete here. ---** Project → floor → add → mode → scan → review → room detail, end to end, with nothing that dead-ends. Ship it, put it on the contractor's phone, and watch him use it before building anything below.

---

**BO-5 — The two non-LiDAR capture modes.** *(device coverage; open task #9)*

- "Point at the corners" — ARKit raycast, no LiDAR, works on every recent iPhone. This is magicplan's Corner Mode and it is why they still support old phones. Ceiling height is an explicit step here [C].
- "Enter the dimensions" — width × length square room, then reshape. The fallback that works in a dark, gutted basement where no camera will track. magicplan's own restoration guidance recommends exactly this plus a Bluetooth laser [C].
- Both feed the same `RoomScanResult` shape and the same BO-2 review screen.

---

**BO-6 — Claim details on the project.** *(direct insurance work; the adjuster's data)*

Build the S12 field set on top of the existing `CustomFieldDef` system, adding conditional logic plus Photo and Date types. Category and Class of Water appear only when Type of Loss = Water.

---

**BO-7 — Wall level, elevation view, wall affected areas.**

`affected_areas.surface='wall'` and `wall_index` already exist in migration 0025. Add the wall list on the RoomSheet, a head-on elevation view, and the area editor on a wall surface. Enforce magicplan's rule: **a wall area can never become a floor area** [C]. Flood cuts and wet drywall are wall quantities and they are most of the money.

---

**BO-8 — Evidence on the damage.**

Photos, notes and moisture readings attached **to the affected area itself**, not just the room [C] — plus the "Photo" and "Note" entries on the Add sheet, which are already stubbed. Moisture readings as a date-stamped series per location, every field independently nullable (device-dependent [C]). A reading logged per room per visit, trending down, *is* the drying log, and it is worth more to an adjuster than another photo.

---

**BO-9 — Affected area → quote line.**

Bind a measured area to a price-book line so the quantity comes from the geometry. This is the one place we can beat magicplan immediately and cheaply, because our estimate and our plan live in the same app — theirs are on different devices, and **their exported estimate cannot even include the sketch** [C]. Add equipment placement with in-service and out-of-service dates while you are here: equipment bills per unit per day, and magicplan's own docs are silent on whether they track it [uncertain].

---

**BO-10 — The report.**

HTML printed to PDF (theirs is Chrome/Skia [A], so the approach is proven). Use their observed toggle set as the specification: layout and paper size, plan rendering and scale, dimension detail level for floor plans and room plans, content toggles for dimensions/custom fields/photos/notes/forms, photo sizing, and a header/footer title block with logo, contact, property details and statistics [A].

---

### Out of scope, deliberately

Objects catalogue, filler rooms, split/merge, import-and-draw, 360 tours, land survey floors, multi-workspace, and anything requiring a Bluetooth laser. None of them are on the chain. Revisit after the contractor has used BO-1 through BO-5 on ten real jobs — his complaints at that point are worth more than this entire research corpus.