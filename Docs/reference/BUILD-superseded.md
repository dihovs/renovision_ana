# Build plan

**Target:** a personal, single-user floor-plan capture and editing app for iOS.
**Reference:** `docs/magicplan/spec.md` — read it before building any screen.

Scope decision already made: personal use. That deletes a large slice of the reference —
workspaces, workspace switcher, member avatars, invites, roles, subscription, sharing links,
collaborative sync, and the forms builder. Everything below assumes one user, one device,
local-first storage.

---

## 0. The finding that determines everything

**Apple's RoomPlan framework does the Auto-Scan.** It is not something you have to build.

RoomPlan (iOS 16+, requires LiDAR) runs an ARKit session and returns a `CapturedRoom`
containing:

- **Surfaces** — walls, doors, windows, openings, floors, each with dimensions and a transform
- **Objects** — bed, sofa, table, chair, storage, refrigerator, oven, stove, dishwasher,
  washer/dryer, sink, toilet, bathtub, television, fireplace, stairs
- Confidence values per element, and a USDZ export

iOS 17 added `RoomBuilder` / `CapturedStructure` for stitching **multiple rooms** into one
structure — which is exactly magicplan's "Auto-Scan: scan multiple rooms" chain.

Implications, in order of importance:

1. **The hardest-looking feature is a framework call.** The scan HUD in §4.6a — edge tracing,
   surface planes, door/window rectangles — is largely RoomPlan's own `RoomCaptureView`
   coaching overlay. magicplan's contribution is the inset mini-map, the room-type prompt,
   and the Review Scan step.
2. **You are locked to iOS + LiDAR.** No Android, no cross-platform, no non-LiDAR fallback
   unless you build the "Detect Corners" style legacy path yourself. Accept this and use
   SwiftUI natively rather than fighting a wrapper.
3. **Re-plan the effort.** The scan is weeks, not months. The real work is everything
   *after* the scan: editing geometry, the measurement model, and rendering a plan you'd
   actually hand to someone.

Verify the current API surface against Apple's docs before committing — this is from
knowledge, not from a doc I just read.

---

## 1. Where the real difficulty is

Ranked honestly, hardest first:

| Rank | Area | Why |
|---|---|---|
| 1 | **Editable geometry model** | Rooms sharing walls, dragging a corner updating two rooms, manually-set dimensions locking while derived ones recompute. This is a constraint solver, not a data structure. §3 of the spec. |
| 2 | **2D plan rendering** | Wall bands with thickness, door swing arcs, window breaks, dimension chains with offsets, labels that avoid collisions. Looks trivial, is not. |
| 3 | **Measurement correctness** | Ground vs ceiling perimeter, wall area from ground perimeter, living-area percentages. Verified formulas in §3 — implement them exactly. |
| 4 | **PDF export** | Scale selection, page layout, title block. Tedious but well-understood. |
| 5 | **Scan** | RoomPlan does it. |
| 6 | **CRUD/inspectors** | Volume of work, low risk. |

---

## 2. Phases

### Phase 0 — RoomPlan spike (days)

One screen, one button, `RoomCaptureView`. Scan a room, dump `CapturedRoom` to JSON, look at
it. Answer before writing anything else:

- How good is the geometry in *your* spaces?
- Are walls axis-aligned enough to snap, or do they need cleanup?
- Do doors/windows land where you'd want them?
- What does multi-room stitching actually produce?

Everything downstream depends on the answer. Do not skip this.

### Phase 1 — Capture → persist → render

- Project / Floor / Room / Wall / Object entities per spec §3
- SwiftData or Core Data, local-first, no sync
- RoomPlan capture → your own model (do **not** let `CapturedRoom` be your schema)
- Static 2D top-down render: wall bands, room fill, name + area label
- Project list and project detail, stripped of everything in the deleted slice

Milestone: scan a room, close the app, reopen it, see the plan.

### Phase 2 — Editing and measurement

The part that makes it yours rather than a RoomPlan demo.

- Room selection, wall selection
- **Change Measurement panel** (spec §4.5) — custom numeric keypad, wall-by-wall
  `Next` → `Apply`, live geometry preview. Copy this interaction closely; it is the best
  idea in the reference.
- `isManuallySet` per dimension, with the padlock affordance
- Corner drag, room move/rotate (Edit Layout, §4.4)
- Derived statistics using the §3 formulas — with unit tests against the verified test-room
  numbers (4.000 × 2.500 m, ceiling 2.440, interior 0.120, exterior 0.250 → floor 10.00 m²,
  footprint 13.50 m², ceiling perimeter 13.00 m, ground perimeter 12.10 m, wall area
  29.52 m², volume 24.40 m³)

Milestone: scan a room, correct a wall you know is wrong, get a right number.

### Phase 3 — Annotation

- Photos and notes attached to room/object (spec §4.4, §4.7)
- A **small** object catalogue — doors, windows, plumbing, electrical. Dozens, not 666.
  Draw them yourself as SVG/paths; do not copy theirs.
- Object inspector: width, height, distance to floor, label mode

### Phase 4 — Output

- PDF via `PDFKit` / `UIGraphicsPDFRenderer`
- Scale-to-fit page, dimension toggles, photo pages
- DXF if you want CAD interop — it is a text format, more tedious than hard
- USDZ comes free from RoomPlan

---

## 3. Things from the reference worth copying exactly

From spec §6, the ones that carry their weight:

1. **Universal inspector** — one swipe-up sheet, same tabs, for floor / room / object
2. **Contextual bottom action bar** — rewrites per selection depth
3. **Change Measurement panel** — custom keypad, sequential walls, live preview
4. **Padlocked manual dimensions** — the whole edit model hangs off this
5. **Live mini-map during scan** — the one genuinely clever thing in their scan HUD
6. **Capability gating with a stated reason** — never a silent dead control
7. **Most-common-first lists** with `See more`

## 4. Things to do differently

- **Review Scan needs a reject path.** Theirs confirms a degenerate sliver with no way out
  (§4.6a). Add "rescan this room".
- **Name projects on creation.** Theirs creates seven identical "My New Project"s.
- **Wire the export preview to real data**, not a static sample thumbnail.
- **Don't build the field-template system.** It exists because they sell to insurers. For
  personal use, hardcode the handful of fields you want.

## 5. Non-goals

Workspaces · multi-user · sharing links · subscription · forms builder · integrations ·
666-object catalogue · Android · non-LiDAR devices.
