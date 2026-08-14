# Interactive Plan Editor Spec

Scope: make the existing `FloorPlanView` (SwiftUI `Canvas` drawing `FloorPlanGeometry.Plan` — wall-centreline `segments` in metres, `openings`, `polygon`, `width`, `height`, fit-to-view scale) interactive on iPhone. The scan measurement is data: every edit is explicit, reversible, and stored separately from the scan. Interaction model follows the patterns shared by the well-reviewed mobile editors (magicplan, Floor Plan Creator, Concepts, SketchUp iPad): **select-then-act, drag for rough + typed for exact, snap-by-default with feedback, visible (not blocked) invalid states, undo as the safety net**.

Legend: **⚠︎ unverified** = not confirmed by any primary source in the research; our design decision or inference. Everything else is grounded in documented behaviour of shipping apps or Apple documentation.

---

## 0. Architecture invariants (apply to every section)

**Single transform.** One `CGAffineTransform` `modelToScreen` (metres → screen pt) is the source of truth: `scale` (pt/m) + `offset`, owned by a `PlanViewportModel`. It is applied *inside* the `GraphicsContext` via `context.concatenate(_:)` when drawing (not via `.scaleEffect`, which rasterises blurry and hides the math), and its `.inverted()` is applied to every gesture point before hit-testing or snapping. All tolerances below are specified in **screen pt** and converted to model metres by dividing by the current `scale` — so tap targets stay thumb-sized at every zoom.

**Draft-only editing.** The editor mutates a value-type `draft: FloorPlanGeometry.Plan` copy. The scan geometry is never touched (§5).

**Geometry representation.** Edits operate on the room `polygon` (ordered vertices, metres); `segments` are the polygon's edges and are re-derived after every edit so the polygon is closed by construction — the magicplan room-based model: no dangling walls, no open loops, ever. Openings store `(wallIndex, offsetAlongWallMetres, widthMetres, kind)` and are re-anchored when their wall changes length (clamp `offset` so the opening stays on the wall; flag it invalid — dashed red — if the wall becomes shorter than the opening).

**Two-layer Canvas for performance.** Layer A: static `Canvas` (`rendersAsynchronously: true`) drawing everything *not* being manipulated. Layer B: lightweight overlay `Canvas` drawing only the selected element, its handles, live dimension label, and snap guides — this is the only layer redrawn per drag frame (documented 30% → 6% CPU pattern from splitting static/dynamic Canvas content). Plain `@State`/`@Observable` changes drive redraw; no `TimelineView` needed (Canvas doesn't animate on its own).

---

## 1. VIEW — zoom, pan, fit

### 1.1 Gesture stack

SwiftUI's own gestures are single-finger only (no finger-count API) and `MagnificationGesture` provides no centroid, so content drifts from under the fingers (Apple forums FB9162379). Therefore navigation uses **bridged UIKit recognizers**; selection/edit uses SwiftUI gestures. iOS 16 floor assumed (**⚠︎ unverified** — confirm the app's actual deployment target).

| # | Recognizer | Fingers | Owns |
|---|---|---|---|
| G1 | `UIPinchGestureRecognizer` (bridged) | 2 | Zoom, anchored at pinch centroid |
| G2 | `UIPanGestureRecognizer`, `minimumNumberOfTouches = 2` (bridged) | 2 | Pan |
| G3 | `SpatialTapGesture` | 1 tap | Selection (§2) |
| G4 | `DragGesture(minimumDistance: 4)` | 1 drag | Edit **iff** the drag begins on an armed handle or the selected element's body; otherwise **pan** |
| G5 | `TapGesture(count: 2)` + location via simultaneous `SpatialTapGesture` | double-tap | Toggle fit ↔ 2.5× zoom at tap point |

- **Bridging:** iOS 18+: `UIGestureRecognizerRepresentable` (attach with plain `.gesture()`, use `context.converter` — `CoordinateSpaceConverter` — to get touch points in SwiftUI view space). Pre-18: transparent `UIViewRepresentable` overlay; `Coordinator` is `UIGestureRecognizerDelegate` and returns `true` from `shouldRecognizeSimultaneouslyWith` so pinch+pan run together (zoom-while-panning, Maps-style).
- **Disambiguation rule (the whole model in one line):** *two fingers always navigate; one finger selects; one finger only edits what is already selected.* This is Procreate's finger-count split fused with magicplan's selection-first guard — a stray finger can never move geometry. (magicplan's exact unselected-drag behaviour is **⚠︎ unverified inference**; the rule as stated is our design.)
- **Anchored zoom math:** on pinch, `offset += (centroid − offset) × (1 − newScale/oldScale)` using the recognizer's centroid in view space, so the point under the fingers stays put.

### 1.2 Zoom limits and fit

- `fitScale` = scale that fits the plan bbox into the view minus **24 pt** inset on all sides.
- Zoom range: **min 0.5 × fitScale**, **max = max(6 × fitScale, 250 pt/m)** (250 pt/m ≈ 2.5 pt per cm — enough to tap a 5 cm feature). Rubber-band beyond limits during gesture, spring back on release (0.25 s).
- **Fit-on-open:** open at exactly `fitScale`, centred; no animation on first layout. Double-tap when at ≤ 1.1 × fitScale zooms to 2.5 × fitScale at the tap point; otherwise animates back to fit (0.25 s easeOut).

---

## 2. SELECT

Selection colour is **blue** (`Color.accentColor`, default iOS blue) — magicplan's documented state across rooms, walls, labels, and handles is blue; the "yellow selection" idea could not be verified in any current doc (**⚠︎** yellow appears nowhere; treat it as folklore).

### 2.1 Hit-test priority on tap (model-space point `p = screenPoint × inverse`)

1. **Corner handle** (only when armed, §3.4) — hit disc 44 pt.
2. **Opening** — within 22 pt of the opening's span on its wall (openings beat walls so a door on a wall is reachable).
3. **Wall** — perpendicular distance from `p` to segment ≤ **22 pt / scale** (a 44 pt band, satisfying HIG 44×44 pt; equivalently `path.copy(strokingWithWidth: max(44, wallThickness×scale)/scale).contains(p)` — the classic stroked-path hit-test, which used a 35 pt minimum for 1 pt lines; we round up to HIG's 44).
4. **Room interior** — `polygon.contains(p)`.
5. **Nothing** — clear selection.

Ties (tap in two walls' bands near a corner): nearest perpendicular distance wins.

### 2.2 Selection states & feedback

| State | Visual | Also |
|---|---|---|
| Room | Polygon outline 3 pt blue, interior tint blue 8% opacity; all corner handles shown (12 pt dots) | Room name pill top of canvas (magicplan shows the name to confirm what's selected before destructive actions) |
| Wall | Wall drawn 2× thickness in blue; its two corner handles armed; its **dimension label becomes a blue pill button** (§3.3); "+" midpoint affordance (§3.5); context bar appears (Delete Corner / Add Corner / Done) | Haptic `.selection` on selection change |
| Opening | Opening glyph tinted blue + blue width label | v1: read-only; v2 editable (§4) |
| None | — | Tap empty always clears; no drill-out taps needed |

Selection transitions animate 0.15 s easeOut. One-level model (tap wall directly, no tap-room-first): our plans are single-room scans, so magicplan's two-level room→wall gate adds a tap without adding safety here (**⚠︎ design deviation**, revisit if multi-room plans ship).

---

## 3. EDIT v1 — the magicplan feel

All edits below: commit **on finger-up** (plus undo), not magicplan's tap-away-to-release (**⚠︎ deviation**: commit-on-release is the standard iOS expectation; tap-away is retained only as "tap empty = deselect").

### 3.1 Drag a selected wall along its normal

- Gesture G4 starting anywhere in the selected wall's 44 pt band.
- Project the drag translation onto the wall's normal; ignore the tangential component. The wall's *infinite line* is offset by the projected delta; its two endpoints are recomputed as **intersections of the offset line with the two neighbouring edges' lines** — so the dragged wall keeps its direction, the neighbours keep theirs and stretch/shorten, and the polygon stays closed (this is what "adjoining walls of the same room extend/shorten" means geometrically; magicplan documents the behaviour, not the math — **⚠︎ math is ours**). Degenerate case (neighbour parallel within 0.5°): translate the shared vertex rigidly instead.
- Neighbouring **rooms never stretch** (single room in v1; matches magicplan's independent-polygon model).
- **Live dimension labels** during drag on layer B: the dragged wall's length *and both neighbours' lengths*, updating per frame, formatted per §3.3.
- **Self-intersection**: never blocked — the offending walls render **dashed red** and Save is disabled while invalid (magicplan's dotted-line pattern: signal, don't block).

### 3.2 Snapping (walls and corners)

- **Quantise always**: every candidate position is rounded to **1 cm** in model space before display. Finger precision is never trusted for the final number (rough-by-drag, exact-by-keypad principle).
- **Detents** (magnetic, with haptic tick):
  - wall offset at **5 cm multiples** from its drag-start position;
  - **collinear** with any other wall of the polygon (perpendicular offset ≤ 8 pt);
  - **parallel/perpendicular** (corner drag): adjacent-wall angle within ±4° of 90° or 180°.
- Capture radius **8 pt** screen; escape by continuing **12 pt** past the detent (capture < escape gives hysteresis so the snap doesn't flicker). Fast flicks (> 600 pt/s) bypass detents entirely — Procreate's velocity gate, so snapping never fights a coarse move.
- **Feedback per detent engagement**: green guide line on layer B (magicplan's green indicators) + one haptic tick. Haptic: iOS 17+ `.sensoryFeedback(.selection, trigger: snappedValue)`; iOS 16 `UISelectionFeedbackGenerator.selectionChanged()` with `prepare()` at drag start and re-`prepare()` after each fire (Taptic prepared state lasts only seconds). Note the semantically ideal `.alignment` feedback is **macOS-only** — use `.selection` on iPhone.

### 3.3 Numeric entry — tap the dimension label

The rendered dimension is itself the control (magicplan, Floor Plan Creator, RoomSketcher all converge on this).

- Selected wall's label = blue pill, min hit target 44 pt tall. Tap → **bottom sheet** (`presentationDetents([.height(260)])`): current length pre-filled, **decimal pad keyboard**, unit toggle m/cm, **Apply** (exact label, per magicplan) and Cancel. Free keyboard entry, not magicplan's scroll wheel (**⚠︎** magicplan's picker-only UI is itself uncertain in the docs; a keypad is the Floor Plan Creator pattern and strictly better on iPhone).
- Apply: wall is resized to the typed length **about its midpoint** — endpoints move along the wall's own axis, both neighbours re-intersect as in §3.1. (**⚠︎** magicplan's which-end-moves rule is undocumented; midpoint-symmetric is our deterministic choice.) Input validated: 0.10 m ≤ length ≤ 50 m, else inline error, Apply disabled.
- **Auto-lock after typed entry** — the single most valuable protection pattern found: the dimension gets a **lock glyph**; a later drag that would change a locked dimension pauses and shows a confirm alert ("This length was entered by hand. Unlock and change it?" Unlock / Cancel). Tap a locked label → same sheet with an **Unlock** action. Scan-derived dimensions start unlocked (**⚠︎** consider auto-locking all scan dimensions instead; magicplan locks only *manually edited* ones — follow that for v1).

### 3.4 Corner drag

- Corner handles: **12 pt visual dot, 44 pt hit disc** (HIG minimum; no surveyed app publishes its handle sizes — 12/44 is ours). Armed when their wall or the room is selected.
- Drag freely; both adjacent walls follow (vertex moves, edges re-derive). Snaps per §3.2 (right-angle detent, axis alignment with other vertices within 8 pt, 1 cm quantise). Live labels: both adjacent wall lengths.
- While dragging, the handle renders enlarged (16 pt) with the **fingertip-offset trick optional for v2** (RoomSketcher's displaced cursor); v1 relies on the enlarged dot + labels being drawn 60 pt above the touch.

### 3.5 Add corner

- Selected wall shows a **"+" affordance at its midpoint** (28 pt visual, 44 pt hit). Tap: inserts a vertex at the exact midpoint, splitting the segment into two equal, independently draggable walls (magicplan's Add Corner outcome, simplified from its pick-a-position triangles to fixed midpoint per requirements). New vertex auto-selects as a corner, ready to drag. One undo entry.

### 3.6 Delete corner

- Select a corner (tap its handle) → context bar shows **Delete Corner**: removes the vertex, merging the two walls into one straight segment. Disabled when the polygon has ≤ 3 vertices or when an opening sits on either merged wall and wouldn't fit the merged span (then dashed-red preview instead). No confirmation dialog — undo is the safety net (magicplan's stated philosophy). (**⚠︎** magicplan documents no corner deletion at all; this whole flow is ours.)

### 3.7 Undo / redo

- **Granularity: one snapshot per committed user action** — drag-end (wall or corner), Apply in the numeric sheet, add corner, delete corner. Never per-frame. Snapshot = the whole `draft` Plan value (tens of vertices; copying is free).
- Stack cap **100**; unlimited within that. Both **Undo and Redo buttons always visible** in the top bar — reviews punish magicplan's missing redo; this is the cheap win. Wire through `UndoManager` so the system three-finger swipe left/right and three-finger double-tap also work (HIG: gestures supplement, never replace, visible controls).
- Stack clears on Save or Cancel. Haptic `.impact(.light)` on undo/redo fire.

---

## 4. EDIT v2 — deferred

1. **Move/rotate whole room** (needed only when a level sheet composes multiple rooms): tap-and-hold the room → drag with **green snap indicators** for wall-to-wall assembly magnetism; rotation via a **curved-arrow handle** offset from the room, free-form with detents at 15° and a strong detent at 90° (**⚠︎** magicplan documents no increments; detents are ours). Overlaps render dashed, never blocked.
2. **Drag an opening along its wall**: 1-D drag clamped to `[0, wallLength − openingWidth]`, quantised 1 cm, detents at 5 cm and at wall-centre, same tick.
3. **Resize opening by typed width**: tap its width label → same numeric sheet, same auto-lock.
4. Displaced-cursor drag for corners (§3.4), and "duplicate opening" via long-press context menu (HIG: context menus for the few most relevant per-item commands only).

---

## 5. SAFETY — scan data is sacred

```swift
struct RoomGeometryRecord: Codable {
    let scan: FloorPlanGeometry.Plan        // immutable, written once at scan time
    var edited: FloorPlanGeometry.Plan?     // nil until first hand edit is SAVED
    var editedAt: Date?
    var isAdjustedByHand: Bool { edited != nil }
}
```

- Renderer displays `edited ?? scan`. A persistent **"Adjusted by hand"** badge shows whenever `edited != nil`, with a **Revert to scan** action (confirmation dialog — this one *is* destructive to saved edits) that nulls `edited`.
- **Session flow:** entering edit mode copies the displayed plan into `draft`. All gestures mutate `draft` only. Top bar: **Cancel** (discards draft; if dirty, confirmation dialog "Discard changes?") and **Save** (disabled while geometry is invalid/dashed-red; one explicit commit → `edited = draft`, single server write of the full record, both fields). Navigation-away with a dirty draft triggers the same discard dialog. No autosave — magicplan's leave-to-save model is exactly the "objects moved themselves" complaint generator in its reviews; explicit Save is the requirement and the right call.
- Server payload always carries **both** `scan` and `edited`; the scan measurement is never overwritten, silently or otherwise.

---

## 6. Constants

| Constant | Value | Basis |
|---|---|---|
| Fit inset | 24 pt | ⚠︎ ours |
| Zoom min / max | 0.5 × fit / max(6 × fit, 250 pt/m) | ⚠︎ ours; limits themselves standard |
| Double-tap zoom target | 2.5 × fitScale | ⚠︎ ours |
| Wall hit band | 44 pt (22 pt per side) | HIG 44 pt; 35 pt-min stroked-path precedent |
| Corner handle: visual / hit | 12 pt / 44 pt | HIG 44 pt; visual size ⚠︎ ours |
| Dragging handle visual | 16 pt | ⚠︎ ours |
| "+" add-corner affordance | 28 pt visual / 44 pt hit | ⚠︎ ours |
| Quantisation | 1 cm, always | requirement |
| Snap detent grid | 5 cm | requirement |
| Snap capture / escape | 8 pt / 12 pt | Procreate distance setting range 1–50 px; exact values ⚠︎ ours |
| Angle detent | 90°/180° ± 4° | ⚠︎ ours (no app documents thresholds) |
| Velocity snap-bypass | > 600 pt/s | Procreate velocity gate; number ⚠︎ ours |
| Drag start threshold (G4) | 4 pt | ⚠︎ ours |
| Haptics | snap detent `.selection` · select `.selection` · undo/redo `.impact(.light)` · Save success `.success` | `.alignment` unavailable on iOS |
| Animations | selection 0.15 s easeOut · zoom-to-fit 0.25 s easeOut · zoom rubber-band spring 0.25 s | ⚠︎ ours |
| Invalid geometry | dashed red, dash [6, 4] pt, Save disabled | magicplan dotted-walls pattern; dash values ⚠︎ ours |
| Length input range | 0.10 – 50 m | ⚠︎ ours |
| Undo stack cap | 100 | ⚠︎ ours |
| Wall stroke (selected) | 2 × base thickness, blue | magicplan blue state |

---

## 7. Consolidated unverified list

1. magicplan specifics taken as direction, not gospel: yellow selection (refuted — blue everywhere), keypad availability in its measurement popup, corner deletion (undocumented), snap thresholds, rotation increments, unselected-drag = pan, which endpoint moves on typed length. Where undocumented, this spec substitutes its own rule and marks it.
2. Apple-side: `MagnifyGesture.Value` property names and the iOS 16 top-left-anchor pinch bug were not confirmed against rendered Apple docs — hence the UIKit-bridge decision, which sidesteps both. `SpatialTapGesture` is iOS 16 per the primary quote, but one summary said 18 — **verify against the deployment target before building G3/G5**.
3. All numeric values flagged ⚠︎ in §6 are engineering defaults chosen inside documented ranges; tune on device in the first build, they are not research findings.
4. No source reveals what magicplan renders with internally; the two-layer Canvas architecture is assembled from general SwiftUI Canvas performance sources, not a floor-plan app's engineering writeup.