# Floor Plan Renderer Spec v2

Upgrade path from "one thick stroke per wall" to an architect-grade plan. All model geometry in **metres**; all stroke widths, text, dashes, and annotation offsets in **device points (pt), never multiplied by the zoom transform**. The one bridging quantity is `pxPerMetre` (current zoom): `tPts = t_m × pxPerMetre` is a wall's on-screen thickness and drives every level-of-detail decision below.

Rules marked **⚠ UNCERTAIN** are derived or unstandardised; everything else is sourced convention.

---

## 0. Global constants

| Name | Value | Meaning |
|---|---|---|
| `T_INT` | 0.114 m | interior wall thickness (given) |
| `T_EXT` | 0.250 m | exterior wall thickness default ⚠ UNCERTAIN (US frame vs EU masonry differ; use flag if scan ever provides one) |
| `SNAP_EPS` | 0.03 m | endpoint clustering / T-projection tolerance |
| `PAR_EPS` | 1e-6 | cross-product threshold for "parallel" |
| `MITER_LIMIT` | 4.0 | bevel below θ ≈ 29° (1/sin(θ/2) > 4) |
| `W_CUT` | 1.4 pt (0.50 mm) | cut wall profile / jamb faces — heaviest line on sheet |
| `W_MED` | 1.0 pt (0.35 mm) | door leaf, window frame/mullion, fixtures |
| `W_THIN` | 0.7 pt (0.25 mm) | swing arc, glazing line, sills |
| `W_ANNO` | 0.5 pt (0.18 mm) | dimension/witness/leader lines, hatching |
| `W_DASH` | 0.4 pt (0.13 mm) | above-cut-plane dashed (headers), dash 8 pt / gap 3 pt |
| mm→pt | `pt = mm × 2.8346` | |

Exterior-wall detection (no flag in data): a wall segment whose centreline lies within **0.05 m** of the floor-polygon union's outer boundary for ≥ 80% of its length → exterior (`T_EXT`); else interior (`T_INT`). ⚠ UNCERTAIN heuristic — mislabels garage/party walls; prefer an explicit flag when available.

---

## 1. Walls: double line + poché

### 1.1 Never do
- Never stroke the centreline. Never render a wall as a single stroked line with `lineWidth = thickness` (wrong joins/caps, no independent fill).
- Never draw an internal line between two joined walls of the same type, or across the mouth of a T-branch.
- Never round or extend a free wall end: free ends are cut **square**, end edge ⊥ centreline, length `t`.

### 1.2 Pre-pass on the centreline graph (before any polygon)
1. Cluster endpoints within `SNAP_EPS = 0.03 m` to a shared joint (average position).
2. If an endpoint lies within 0.03 m of another wall's centreline **interior**, project it onto that line → true T-junction node.
3. Merge collinear same-thickness walls sharing a joint (`|cross(d1,d2)| < PAR_EPS`) into one segment.

Junction resolution happens on this graph; geometry is generated only after it.

### 1.3 Wall body polygon
For centreline `P0→P1`, `d = normalize(P1−P0)`, `n = (−d.y, d.x)`, thickness `t`:

```
body = [P0 + n·t/2,  P1 + n·t/2,  P1 − n·t/2,  P0 − n·t/2]   // closed quad
```

### 1.4 Corner (L) join — analytic mitre
Two walls meeting at joint `J`, incoming dir `d1`, outgoing `d2`, thicknesses `t1`, `t2`. For each side `s ∈ {+1, −1}`:
- Line L1: point `J + s·n1·t1/2`, direction `d1`. Line L2: point `J + s·n2·t2/2`, direction `d2`.
- Corner vertex for side `s` = intersection(L1, L2). These two vertices replace the four quad corners at `J`.

Equal-`t` check value: mitre vertex distance from `J` = `(t/2)/sin(θ/2)`, θ = interior angle.

**Mitre limit:** if `1/sin(θ/2) > 4.0`, bevel — emit the two offset endpoints and join with a straight chord instead of the intersection.
**Parallel guard:** if `|cross(d1,d2)| < 1e-6`, no intersection exists — butt the quads (equal `t`: merged in pre-pass; unequal `t`: legitimate face step, keep it).

### 1.5 T-junction
Branch B meets through-wall A's interior: **do not mitre.** B's centreline already ends on A's centreline (pre-pass). Clip B's body against A's near face line (A's offset line on B's side): B's two face lines terminate exactly on A's face; A's faces run unbroken; no line across B's mouth. This is the only valid configuration (Revit rule).

**Priority for unequal types:** exterior/structural priority 500, interior partition 1000 (lower number wins, ACA convention). Equal priority → mitre per 1.4. Unequal → winner's polygon drawn whole; loser's polygon clipped by (subtracted against) the winner's before union. Result: exterior faces continuous, partition dies into the inner face. ⚠ UNCERTAIN: mitring unequal-thickness corners instead is also defensible; priority-clipping matches ACA/Archicad and is recommended.

### 1.6 Assembly — union, then fill + stroke
**Primary implementation:** boolean-union all wall bodies (post priority-clipping) into one multipolygon. `fill(union)` = poché; `stroke(outerBoundary(union))` at `W_CUT`. This produces mitres, T-cleanups, and internal-edge removal automatically and satisfies the rule that the cut profile is continuous and never crosses another cut line.

SwiftUI Canvas has no boolean ops. Two compliant routes:
- **(a) Analytic contour walk (recommended):** walk the wall graph emitting the mitred/butted vertices from 1.4/1.5 directly — you get the outer contour without a general clipper. Fill with `.winding` (nonzero), stroke only that contour.
- **(b) Two-pass stroke trick (fallback):** put **all** centrelines in one Path; extend every segment past each shared joint by `t/2`. Pass A: stroke width `tPts + 2·W_CUT`, `.butt` caps, colour = line colour. Pass B: stroke same path, width `tPts`, colour = poché. Pass B after all of Pass A gives face lines, square corners, and T-cleanup for free. **Constraints:** exact only for uniform `t` and corners within ±10° of orthogonal (⚠ non-90° corners notch/overshoot); openings must be knocked out by painting background-coloured cutters (1.8) after both passes, then re-drawing jamb caps.

### 1.7 Poché fill by effective scale (and legibility clamp)
Compute `tPts = t × pxPerMetre` for the median wall:

| `tPts` | Fill | Outline |
|---|---|---|
| < 4.5 pt | solid near-black `#111` band, **no separate outline** | — |
| 4.5 – 12 pt | solid black | `W_CUT` black |
| > 12 pt | 45% grey (or hatch) | `W_CUT` black |

Rationale: small-scale plans blacken cut walls; large-scale drop to middle grey (Ching). The 4.5 pt cutoff is the clamp `tPts < 3 × W_CUT` at which the two face strokes visually merge — below it, render the wall as a solid band of **min width 1.5 pt** so it never disappears. ⚠ UNCERTAIN: both numeric thresholds are derived from the qualitative rule, not published values.

### 1.8 Openings — boolean subtraction
Opening of width `w`, centred at distance `s+w/2` along the centreline: cutter rectangle = length `w` along `d`, height `t + ε` across `n` (`ε = 2 / pxPerMetre`, i.e. ~2 px in metres, so it cleanly crosses both faces). Subtract from the union (or paint background-colour in fallback (b)). Then draw **jamb caps**: at each end of the cutter, segment from `−t/2·n` to `+t/2·n`, stroked at `W_CUT` — jambs are cut by the plan plane and carry full cut weight. An opening with no door/window stays exactly like this: a plain gap + jamb caps. Optional at print level: dashed header lines (`W_DASH`, dash 8/gap 3 pt) along both faces across the gap. ⚠ jamb reveals/returns: omit below 1:50 equivalent; plain gaps recommended everywhere.

---

## 2. Door symbol

Input: opening centreline segment (`A→B` on wall, jamb points), clear width `w = |B−A|`, wall dir `u`, normal `n`, thickness `t`.

### 2.1 Hinge + swing heuristic (data has neither — ⚠ UNCERTAIN, both rules are inference)
- **Hinge jamb** = the jamb (`A` or `B`) with the smaller centreline distance to the nearest wall-graph joint (doors hinge next to the adjoining wall so the leaf opens flat against it). Tie (Δ < 0.1 m): pick `A`.
- **Swing side** `sside = ±n` = the side whose containing floor polygon has the **larger area** (doors open into rooms, away from halls — approximation). If only one side has a floor polygon (entry door), swing to that side (inward). Doors on bathrooms (`label ∈ {BATH, WC, SHOWER}` and `area < 4 m²`): swing **out** of the small room is common but not universal — default still inward, flag for manual override.

### 2.2 Geometry
- Hinge point `H = hingeJamb + sside·(t/2)` (on the swing-side wall **face**, not the centreline ⚠ face-side is the safer default; centreline hinging appears in simplified renderers).
- **Leaf:** from `H` perpendicular to wall: tip `T = H + sside·w`. Draw as a single segment at `W_MED` when leaf plots < 3 pt wide; as a rectangle `w × 0.04 m` when `0.04 × pxPerMetre ≥ 3 pt`.
- **Arc:** centre `H`, radius `w`, 90° sweep from `T` to latch point `L = otherJamb + sside·(t/2)`. Weight `W_THIN`. ⚠ 90° is the dominant convention; some offices use 30–45° in tight plans — make it a style parameter, default 90°.
- Wall break + jamb caps per 1.8; leaf length = arc radius = clear width `w` exactly.
- Default widths if `w` missing: interior 0.81 m, entry 0.91 m, bath 0.61–0.76 m.
- Variants (only if type data exists): double = two mirrored `w/2` leaves+arcs meeting at mid-opening; sliding = two rects `~w/2 + 0.05 m` long, offsets `±t/6·n`, no arc; pocket = leaf half-projecting from one jamb + dashed cavity `w` long beyond it; bifold = 45° V panels of `w/4`. Non-swinging doors never get an arc.

---

## 3. Window symbol

Inside the subtracted `w × t` break (wall outline gapped only for the fill — the band is re-populated):
1. Two **frame lines** along the wall faces, jamb-to-jamb, at offsets `±t/2·n` — weight `W_MED`.
2. One **glazing line** on the wall centreline, `A→B` — weight `W_THIN`. (Double-glazed style: two lines at `±t/6·n`. Pick one style plan-wide. ⚠ 2- vs 3-line is office preference; 3-line is the most repeated.)
3. Jamb caps at both ends at `W_CUT` (per 1.8).

Sills are **not** cut by the plan plane → never at `W_CUT` (Ching, explicit). Suppress the glazing line and draw a single mid-line when the cavity plots < **2 pt** between the frame lines; suppress the whole 3-line symbol below LEVEL 1 (see §7) and leave frame lines only.

---

## 4. Dimensions

### 4.1 What gets dimensioned, per tier
- **Tier 1 (innermost):** opening centres — each door/window to its centreline, along each exterior wall.
- **Tier 2:** wall-to-wall / jog subtotals (exterior).
- **Tier 3 (outermost):** overall footprint, one per orthogonal direction.
- Interior partitions: separate short strings inside rooms, only at LEVEL 3 (print) or when `pxPerMetre ≥ 50`. Never mix interior and exterior on one string.
- Reference faces: exterior walls to **outside face**; openings to **centre**; interior walls to **centreline** (matches the data model — note it in the legend; NKBA would use finished face ⚠ both legitimate).

### 4.2 Layout — offsets as multiples of `T_EXT` (model space)
| Quantity | Rule | @ `T_EXT`=0.25 → paper @1:50 |
|---|---|---|
| Witness (extension) line start gap from wall face | `0.25 × T_EXT` | 62 mm real ≈ 1.25 mm ≈ 1/16" ✓ |
| Witness overrun past outermost dim line | `0.5 × T_EXT` | 3 mm paper ✓ |
| Tier-1 string offset from outer face | `3 × T_EXT` | 15 mm paper ✓ |
| Each further tier beyond previous | `2 × T_EXT` | 10 mm paper ✓ |

On screen these multiply by `pxPerMetre`; clamp string spacing to a minimum of **14 pt** device so strings never collapse at low zoom (⚠ clamp value derived).

### 4.3 Terminators and text
- Terminator: **45° tick**, 3 pt long, centred on the witness/dim intersection, stroked bottom-left→top-right (rotate with the line), weight `W_ANNO` (tick may be one step heavier ⚠ office preference). No arrowheads on dim lines; arrowheads only on leaders.
- Dim line runs **unbroken**; text centred along it, baseline **1.5 pt above** the line, rotated to line angle θ; if `90° < θ ≤ 270°` add 180° (must read from bottom/right).
- Text height: 8 pt device on screen; 2.4 mm (3/32") at print. Dim/witness lines at `W_ANNO`, ~1/3 of `W_CUT`.

### 4.4 Feet-inches formatting
```
inches_total = metres / 0.0254, rounded to nearest 0.5   // ½" precision
feet = floor(inches_total / 12); rem = inches_total − 12·feet
```
- `feet > 0`: `F'-R"` with fraction as ½ (e.g. `10'-4 1/2"`); whole feet **must** show `-0"` → `4'-0"`.
- `feet == 0`: inches only, no `0'` prefix → `10"`, `6 1/2"`.
- Never leave ≥ 12" in inches (write `1'-4"`, not `16"`); never mix formats. (⚠ `0'-8"` is a tolerated variant of `8"` — don't mix.)
- Metric mode: whole **mm, no suffix**, one note "ALL DIMENSIONS IN mm".

---

## 5. Room labels

- Anchor: **pole of inaccessibility** of the floor polygon (grid-sample at 0.1 m, take max-distance-to-boundary point) — beats centroid on L-shapes.
- Line 1: room name, ALL CAPS, horizontal always. Line 2: area directly beneath at **70%** of name size, lighter grey (`#666`), format `142 SQFT` (`area_m² × 10.764`, round to integer) or `13.2 m²`.
- Sizes: screen name = **11 pt** minimum, never smaller — resolve collisions by moving/dropping, never shrinking below minimum (NKBA rule). Print: 2.4–3 mm.
- Fit test: room's smaller plan dimension in device pts must be ≥ `3 ×` text height **and** name width ≤ 90% of room width at the anchor.
- Collision fallback ladder: (1) drop the area line; (2) abbreviate name (`BEDROOM→BED`, `BATHROOM→BATH`, `CLOSET→CL`, `KITCHEN→KIT`); (3) move label outside the room with a straight leader at `W_ANNO`, arrowhead at room end, leader angle constrained to 0/45/90°; (4) drop label entirely (thumbnail level).
- Label background: opaque white knockout rect padded 2 pt when overlapping any linework.

---

## 6. Stairs (data = riser count only, optional bounding hint)

**Honestly drawable with a bounding rect + count `nR`:**
- Run rectangle = the bounding rect; travel axis = its long axis.
- Tread lines: `nR − 1` segments ⊥ travel axis, evenly spaced at `treadDepth = longSide / nR`; stroke `W_MED`. Sanity clamp: if `treadDepth` ∉ [0.22, 0.33] m, the hint is probably not a single straight run — draw the rect with a diagonal cross + text `STAIR nR` instead of fake treads.
- Centreline along mid-run at `W_ANNO`, small 1.5 pt-radius circle at one end. Text `nR R` beside it at label size ×0.7.

**Not honestly drawable — omit, do not guess:**
- Ascent direction (arrow must point up; unknowable from a count) → **no arrowhead, no UP/DN text** unless a direction flag arrives. ⚠ Drawing an arbitrary arrow is a factual claim about the building; skip it.
- Cut-plane zigzag break line (requires knowing which end is up) → omit; show full run solid.
- L/U/winder shape, landings, spiral form → cannot be inferred from count; straight-run assumption only, flagged in legend as "stair indicative".

**With no bounding hint at all:** draw nothing geometric; place a text tag `STAIR (nR R)` with leader at the wall the stair data references, if any.

---

## 7. LEVELS table

Select by `S = pxPerMetre` (device px per model metre). Thresholds ⚠ derived from the paper-scale conventions, tune ±20%.

| | **L0 Thumbnail** `S < 6` (plan < ~150 pt) | **L1 Phone fit-to-screen** `6 ≤ S < 25` | **L2 Phone zoomed** `25 ≤ S < 80` | **L3 Print / report** (fixed 1:50 or 1:100, pick closest that fits page — never "fit to page") |
|---|---|---|---|---|
| Walls | solid `#111` bands, min 1.5 pt, no outline | per §1.7 clamp (mostly solid black) | black or grey fill + `W_CUT` outline per §1.7 | 1:100 → black fill; 1:50 → 45% grey + `W_CUT` |
| Openings | gaps only, no jamb caps | gaps + jamb caps | full | full + dashed headers on cased openings |
| Doors | gap only | leaf (single line) + arc | leaf + arc; rect leaf if ≥ 3 pt | full, rect leaf at 1:50 |
| Windows | gap only | frame lines only | 3-line symbol if cavity ≥ 2 pt | 3-line symbol |
| Dimensions | none | none (optional overall W×H under the plan as text) | Tier 3 + Tier 2 exterior | all tiers + interior strings |
| Labels | none | names only, fallback ladder active, min 11 pt | name + area | name + area, 2.4–3 mm |
| Stairs | omit | rect + centreline only | treads + centreline + `nR R` | full per §6 |
| North arrow / scale bar / disclaimer | none | none | scale bar (live, round-number length, 4 segments) | north arrow + graphic scale bar + written scale + disclaimer line |

Universal omission rule: drop any feature whose plotted/device size < **1 pt** (≈ 1 mm paper); simplify fixtures to blocks when they'd plot < 2 pt.

---

## 8. Draw order (bottom → top)

1. Floor polygon fills (per-room, flat tints by type: BEDROOM / wet (BATH·SHOWER·WC) / outdoor / default — single label→colour map)
2. Wall poché fill (union)
3. Opening knockouts
4. Wall cut-profile stroke + jamb caps (`W_CUT`)
5. Door leaves (`W_MED`), swing arcs (`W_THIN`)
6. Window frames (`W_MED`), glazing (`W_THIN`)
7. Stairs, fixtures (`W_MED`, white fill)
8. Dashed above-cut elements (`W_DASH`)
9. Dimensions (`W_ANNO`)
10. Labels + leaders (opaque knockouts)
11. Page furniture (north arrow, scale bar, disclaimer)

---

## 9. Consolidated uncertainty register

1. Black/grey poché pt-thresholds (§1.7) and the `3×W_CUT` clamp — derived, no published numerics.
2. Exterior detection heuristic and `T_EXT = 0.25` — region-specific; prefer explicit flags.
3. Hinge-near-corner and swing-into-larger-room heuristics — pure inference; expose manual override.
4. Hinge on face vs centreline — face chosen; not explicitly mandated anywhere.
5. 90° swing arc, arc exact weight, 2- vs 3-line glazing — style parameters, defaults given.
6. Priority-clip vs mitre at unequal-thickness corners — industry genuinely split (Revit/ACA/Archicad differ); ACA-style priority chosen.
7. Dimension-offset-as-`t`-multiples calibrated at 1:50 only; use device-pt clamps at other zooms.
8. Scale bar internal proportions (segment counts/blocks) — common practice, unverified.
9. LEVELS `pxPerMetre` breakpoints — derived mapping of paper scales to screen; tune on device.
10. Stair conventions beyond a straight run — not drawable from a count; anything more is fabrication.