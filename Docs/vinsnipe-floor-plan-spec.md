# VinSnipe Floor Plan — Product & Engineering Spec (v1)

Original requirements for VinSnipe's own iPhone floor-plan measurement app. Everything here comes from public engineering concepts: ARKit, RoomPlan, the shoelace formula, least squares, BLE GATT, and open export formats.

## 1. Overview, goals, non-goals
**Goal:** A contractor walks a property with an iPhone and leaves with an accurate, editable, dimensioned floor plan in about 5 minutes per room. Areas are good to ±1%, and the plan exports to PDF, DXF and more.

**Goals**
- Polygon room capture by AR taps or manual drawing.
- Lengths can be locked from a laser meter.
- One-tap angle squaring.
- Openings, curved walls and non-flat ceilings.
- Multiple rooms and floors.

**Non-goals for v1**
- Furniture modelling.
- Photoreal 3D.
- Android.
- Cloud collaboration.
- Cost estimating (that's a v2 hook).

**Conventions**
- SI units only, in meters, stored as Double. Imperial is display-only.
- The plan is the X/Y plane with Y up, and Z is height.
- **Polygons are counter-clockwise (CCW)**, so the signed shoelace area is positive. Inputs with negative area get reversed.
- Wall i runs from corner i to corner (i+1) mod n. The interior is to the left of each wall.

## 2. Build order
1. M1 Core geometry package (pure Swift, no UI): the data model, shoelace area, perimeter, self-intersection check, and unit tests §15 T1–T5 and T15–T16.
2. M2 2D editor: draw by tapping on a canvas, snapping, auto-close, dragging vertices, typing a length to lock it (T3–T5).
3. M3 Squaring solver with locked lengths (T6, T7).
4. M4 Openings with wall-area math (T11, T12).
5. M5 Curved walls (T8, T9).
6. M6 Ceiling profiles and volume (T10).
7. M7 Multiple rooms and floors, alignment and shared walls (T13).
8. M8 AR capture with ARKit raycasting, feeding the M2 editor.
9. M9 BLE laser meter (T14).
10. M10 Exports: PDF, SVG, DXF, then USDZ/glTF, then IFC.
11. M11 RoomPlan alternate path, which imports into the same model.
12. M12 Persistence (Codable JSON and file packages), undo/redo, and polish.

## 3. Data model
```swift
typealias Meters = Double
struct Vec2: Codable, Hashable { var x: Meters; var y: Meters }

struct Project: Codable, Identifiable { let id: UUID; var name: String; var address: String?
  var floors: [Floor]; var displayUnits: UnitSystem /* .metric | .imperial */; var createdAt: Date }

struct Floor: Codable, Identifiable { let id: UUID; var name: String; var level: Int
  var elevation: Meters          // finished-floor Z relative to level 0
  var rooms: [Room] }

struct Room: Codable, Identifiable { let id: UUID; var name: String
  var corners: [Corner]          // CCW, closed implicitly (last -> first)
  var walls: [Wall]              // walls[i] = corners[i] -> corners[(i+1)%n]; count == corners.count
  var openings: [Opening]
  var ceiling: CeilingProfile
  var origin: Vec2; var rotation: Double   // room->floor transform (radians)
  var isClosed: Bool }

struct Corner: Codable, Identifiable { let id: UUID; var p: Vec2   // room-local
  var angleLocked: Bool = false; var lockedAngle: Double? }        // interior angle, radians

enum WallShape: Codable { case straight; case arc(sagitta: Meters) } // +sagitta bulges outward (to the right of the wall direction)
struct Wall: Codable, Identifiable { let id: UUID; var shape: WallShape = .straight
  var lockedLength: Meters?       // chord length when locked
  var thickness: Meters = 0.12
  var sharedWith: WallRef?        // (roomID, wallID) of the coincident wall in another room
  var lengthSource: LengthSource } // .drawn | .ar | .typed | .laser(deviceID)

enum OpeningKind: String, Codable { case door, window, opening, slidingDoor, garageDoor }
struct Opening: Codable, Identifiable { let id: UUID; var wallID: UUID; var kind: OpeningKind
  var offset: Meters    // from wall start to opening's near edge, along the chord
  var width: Meters; var height: Meters; var sillHeight: Meters  // 0 for doors
  var swing: Swing? /* .leftIn/.leftOut/.rightIn/.rightOut */ }

enum CeilingProfile: Codable {
  case flat(height: Meters)
  case sloped(lowHeight: Meters, highHeight: Meters, lowWallID: UUID, highWallID: UUID) // a plane; the low wall and high wall are opposite
  case vaulted(eaveHeight: Meters, ridgeHeight: Meters, ridgeAxis: (Vec2, Vec2))           // two planes meeting at the ridge
  case zones([HeightZone]) }      // multi-height: each zone is a sub-polygon with its own flat height
struct HeightZone: Codable { var polygon: [Vec2]; var height: Meters }
```
(Make `ridgeAxis` a small Codable struct. A tuple is shown above only for brevity.)

## 4. Polygon capture
All of these thresholds are **tunable** and live in one `CaptureTuning` struct:

| Name | Default | Rationale |
|---|---|---|
| `vertexSnap` | **0.03 m** | This is roughly the noise of an AR raycast on a wall/floor edge at 2–3 m. Snapping below this merges jitter, and above it you start merging real 5 cm jogs such as trim or pilasters. |
| `autoClose` | **0.25 m** | On a phone screen a finger covers about 20–30 cm of floor at a normal standing distance. Closing a loop should be forgiving, and the closing wall is rarely shorter than 25 cm. |
| `minWall` | **0.10 m** | Real jogs under 10 cm are rare and usually just trim. Rejecting shorter walls removes double taps. A user can still type a shorter wall explicitly. |
| `angleSnap` | **±3°** of 90° or 180°, used during drawing as a guide | People hand-draw within about 3°. Snapping larger angles hides real out-of-square rooms. |
| `wallSnap` (multi-room) | **0.10 m** | This covers about one wall thickness, so neighbouring rooms snap together. |

Rules:
- **Vertex snap:** if a new or dragged point is within `vertexSnap` of an existing corner (in any room on the floor), use that corner's position.
- **Auto-close:** with 3 or more corners, if the new tap is within `autoClose` of corner 0, close the loop without adding a point. Then enforce CCW by reversing if the signed area is below 0. Reject the shape if it self-intersects.
- **Minimum wall:** a tap less than `minWall` from the previous corner is ignored and shows a toast.
- **Edit/drag:** dragging a corner moves only that corner. The walls on either side keep any locked length *only if* the solver can satisfy it. Otherwise the lock flag shows a conflict badge, and the lock is never silently dropped.
  - Long-press a wall to insert a corner at its midpoint.
  - Swipe a corner to delete it if 3 or more remain.
  - All of these actions can be undone.

## 5. Wall length constraints
- Locking a wall sets `lockedLength` to the chord length. Sources are typed input, laser, or "lock current".
- Locked lengths are hard-ish constraints in the solver: weight `wL = 1000` against `wA = 1` for angles, in residual units of m and rad respectively. The solver treats them as near-equalities.
- The UI shows locked walls in a solid colour with a lock glyph, and unlocked walls dimmed.
- A closed n-gon has 2n−3 degrees of freedom up to rigid motion. If you lock all n lengths, n−3 DOF remain, so the shape is determined by the angles. When locks are inconsistent with a closed polygon (T7), the solver reports the closure residual and highlights the worst walls.

## 6. Angle squaring solver
**Unknowns:** corner positions x ∈ ℝ²ⁿ. Corner 0 is pinned and wall 0's direction is fixed, which removes the 3 gauge DOF.

**Targets:** for every corner whose interior angle θᵢ is within `squareTol` = **±10°** (tunable) of 90°, 180° or 270°, the target is that multiple of 90°. User-locked angles use their own value. Other corners are left free.

**Residuals:**
- Angle, rᴬᵢ = wrap(θᵢ(x) − θ*ᵢ), with weight wA = 1. The target-angle set is chosen once before solving.
- Locked length, rᴸⱼ = |c_{j+1} − c_j| − Lⱼ, with weight wL = 1000.
- Anchor, rᴾᵢ = |cᵢ − cᵢ⁰|, with weight wP = 0.01. This keeps unconstrained corners near what the user drew and regularizes the problem.

**Objective:** minimize Σ wA·rᴬ² + Σ wL·rᴸ² + Σ wP·rᴾ².

**Method:** Levenberg–Marquardt on the weighted residuals with a numeric or analytic Jacobian.
- λ₀ = 1e-3. Divide λ by 10 when the cost drops, multiply by 10 when it rises.
- At most 50 iterations.
- Stop when ‖Δx‖∞ < 1e-6 m or the relative cost drop < 1e-10.
- After solving, verify: no self-intersection, every locked length within 1 mm, and squared angles within 0.1°. If any check fails, return `.conflict(worst: [residual])` and keep the original geometry so the user can undo.

```swift
func square(_ room: Room, tuning: SolverTuning) -> SolveResult {
  var x = room.corners.flatMap { [$0.p.x, $0.p.y] }; let x0 = x
  let targets = room.corners.indices.compactMap { i -> (Int, Double)? in
    if let a = room.corners[i].lockedAngle { return (i, a) }
    let t = (interiorAngle(x, i) / (.pi/2)).rounded() * (.pi/2)
    return abs(interiorAngle(x, i) - t) <= tuning.squareTol ? (i, t) : nil }
  var lambda = 1e-3
  for _ in 0..<50 {
    let (r, J) = residualsAndJacobian(x, x0, targets, room.walls, tuning)  // rows pre-multiplied by sqrt(w)
    var H = J.transpose * J; H.addDiagonal(lambda * H.diagonal); let g = J.transpose * r
    let dx = H.solve(-g).zeroingGauge(pinCorner: 0, pinDirection: 0)
    let xNew = x + dx
    if cost(xNew) < cost(x) { x = xNew; lambda /= 10 } else { lambda *= 10; continue }
    if dx.maxAbs < 1e-6 { break } }
  return validate(x, room, tuning)  // intersection + locks + angles
}
```
Interior angle (CCW): θᵢ = atan2(cross(a,b), dot(a,b)) mapped to (0, 2π), where a = c_{i+1} − cᵢ and b = c_{i−1} − cᵢ.

## 7. Nine-step capture flow
1. **Project:** create or select a project, enter the address, choose units.
2. **Floor:** pick or create a floor and set its level name.
3. **Room:** name the room from presets (Kitchen, Bed 1…).
4. **Capture outline:** walk the room tapping floor–wall corners in AR, or draw in 2D. The loop auto-closes.
5. **Measure:** select each wall and fire the laser meter, or type a value, to lock lengths. Aim for all walls except one.
6. **Square:** tap "Square". The solver runs, and any conflicts are shown.
7. **Openings:** tap a wall and add a door or window with offset, width, height and sill.
8. **Ceiling:** set the height (laser pointed up) and choose flat, sloped, vaulted or zones.
9. **Place & review:** drop the room on the floor plan, snap it to neighbours, review area totals, then export.

## 8. iPhone AR capture
- `ARWorldTrackingConfiguration` with `planeDetection = [.horizontal, .vertical]`. If `ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)` is true (LiDAR), turn on `sceneReconstruction = .mesh` for better raycasts. LiDAR is optional and every feature must work without it.
- Taps use `ARView.raycast(from:allowing:.estimatedPlane, alignment: .horizontal)`. Prefer `.existingPlaneGeometry` hits on the floor plane when available.
  - Project hits onto the floor plane: Y = floorY in ARKit's Y-up world, then map to plan (x, −z).
  - Show a reticle and a live rubber-band wall with its length.
- Corner capture aid: offer to raycast two vertical wall planes and intersect their floor lines to get a precise corner. Fall back to the raw floor hit.
- Show a tracking-quality banner. Block taps while `trackingState != .normal`.
- **RoomPlan alternate path (iOS 16+, LiDAR):** run a `RoomCaptureSession`. From the resulting `CapturedRoom`, map `walls`, `doors`, `windows` and `openings` (with dimensions and transform) into Room, Wall and Opening by projecting wall bottoms to 2D, then chaining endpoints with `vertexSnap`. Then run the squaring solver with all lengths unlocked. Keep the USDZ export from RoomPlan as an optional attachment.

## 9. Doors & windows
- Every opening belongs to one wall.
  - Must hold: 0 ≤ offset and offset + width ≤ wall chord length − 0.02 m. The 2 cm reveal is tunable.
  - Must hold: sill + height ≤ the ceiling height at that wall.
  - Openings on the same wall must not overlap.
- **Defaults (tunable):**
  - Door 0.81 × 2.03 m, sill 0. This is a common North American 32″ × 80″ door.
  - Window 1.0 × 1.2 m, sill 0.9 m.
- Net wall area = gross wall area − Σ (width × height) of the openings on that wall.
- For arc walls, the offset is measured along the chord, and the opening is drawn on the arc.
- In 2D, doors show a swing arc and windows show a triple line.
- An opening on a shared wall is mirrored into the neighbouring room automatically.

## 10. Curved walls
- An arc is stored by chord c and sagitta s (signed).
  - R = c²/(8|s|) + |s|/2
  - half-angle φ = asin(c / (2R))
  - arc length = 2Rφ
  - segment area = R²(2φ − sin 2φ)/2
- Room area = shoelace area of the corners ± Σ segment area. Add the segment if the arc bulges outward, subtract it if it bulges inward.
- If |s| > c/2 (more than a semicircle), use φ' = π − φ. Version 1 limits |s| to c/2 or less.
- **3-point entry:** the endpoints plus a tapped mid-arc point P. Compute the circumcentre to get the centre, then R, then s = R − distance(centre, chord midpoint), with the sign taken from the side P lies on.
- The squaring solver treats an arc wall as its chord. A locked length on an arc wall locks the chord.

## 11. Ceiling height
- **flat:** volume = A·h. Each wall area = length·h.
- **sloped:** a plane from the low wall (height hL) to the opposite high wall (hH) over a horizontal distance d.
  - In a rectangle, volume = A·(hL + hH)/2.
  - Side walls are trapezoids with area = d·(hL + hH)/2.
  - Ceiling surface = A / cos α, where α = atan((hH − hL)/d).
  - For general polygons, integrate the plane height over the polygon: volume = A·h(centroid), which is exact for a plane.
- **vaulted:** two planes meeting at the ridge. Split the polygon along the ridge axis and apply the sloped rule to each half.
- **zones:** a base flat height, and each zone polygon (clipped to the room) overrides the base height. Volume = Σ A_zone·h_zone + (A − Σ A_zone)·h_base.
- The laser "up" reading sets the height at the selected wall or zone.

## 12. Multi-room alignment & shared walls
- Each room has its own local frame plus a transform (origin, rotation) into the floor frame.
- **Placement snap:** while dragging a room, for each pair of walls (one in the moving room, one in a neighbour) that are anti-parallel within 3° and less than `wallSnap` (0.10 m) apart, offer a snap. Rotate to make them exactly anti-parallel, then translate along the normal to close the gap. A gap of one wall thickness is an option for interior walls.
- After a snap, mark the walls as `sharedWith` each other if their overlap is at least 0.30 m. Edits to a locked length on a shared wall propagate to both walls. The squaring solver of the second room treats the shared wall's direction as fixed.
- Floor totals:
  - Σ room areas gives the net area.
  - Gross area = area of the union of rooms offset by half the wall thickness.
- **Multiple floors:** align floors with a user-picked common corner (for example a stair corner), plus a rotation.

## 13. Bluetooth laser meter integration
- Use generic BLE through CoreBluetooth with a `LaserMeterDriver` protocol and one driver per vendor. Many meters expose a vendor GATT service with a notify characteristic that delivers distance as float32 or int (mm), with a units byte.
  1. Scan with the service UUIDs of the known drivers. Show RSSI-sorted devices.
  2. Connect, discover services, subscribe to the notify characteristic. Store the peripheral UUID so the meter reconnects on later launches.
  3. Parse the value to meters, rejecting values ≤ 0 or > 200 m.
  4. Store the reading with its timestamp.
- **Assignment:** a reading goes to the **currently selected wall** (or ceiling field). It sets `lockedLength` and `lengthSource = .laser`, then auto-advances the selection to the next CCW wall.
  - A reading that arrives with nothing selected goes to a "pending readings" tray the user can drag onto walls.
  - Undo is supported.
- **Laser offset:** meters measure from the rear edge by default, so no correction is applied. A per-device setting can add ±mm. The value shown is the value stored.
- **Simulator driver:** a fake peripheral for tests and CI.

## 14. Export formats
- **PDF:** vector, one page per floor, dimensioned walls, room names and areas, scale bar, and a totals table. Rendered with Core Graphics `UIGraphicsPDFRenderer`.
- **SVG:** the same drawing, with 1 user unit = 1 mm.
- **DXF (ASCII, R2000/AC1015):** units in mm (`$INSUNITS=4`). Layers WALLS, OPENINGS, DIMENSIONS, TEXT, ROOMS.
  - Walls are closed LWPOLYLINEs. An arc wall uses the bulge value tan(θ/4), where θ = 2φ is the included angle, so bulge = tan(φ/2). The sign follows the sagitta. For T8 the bulge is tan(0.244979) = 0.2500, which equals 2s/c = 1/4.
- **USDZ / glTF 2.0:** extrude walls by ceiling height minus openings. Floor and ceiling meshes, in meters, Y-up.
- **IFC4 (v2 priority):** IfcBuildingStorey, IfcSpace, IfcWallStandardCase, IfcDoor and IfcWindow. Write via a small IFC-SPF writer.
- **CSV/JSON:** room table with area, perimeter, volume, and wall areas net of openings. JSON is the native Codable model and the backup format.

## 15. Acceptance tests
Tolerance is 1e-3 unless stated. Polygons are CCW, in meters.

| # | Setup | Expected |
|---|---|---|
| T1 | Rectangle (0,0),(4,0),(4,3),(0,3) | Area 12.000. Perimeter 14.000. Signed area +12, so it's CCW. |
| T2 | L-shape (0,0),(6,0),(6,2),(3,2),(3,5),(0,5) | Shoelace terms 0+12+6+9+15+0 = 42, so area 21.000. Check: 6·2 + 3·3 = 21. Perimeter 6+2+3+3+3+5 = 22.000. |
| T3 | Open loop (0,0),(4,0),(4,3),(0,3). Tap at (0.20,0.10) | Distance to corner 0 = √0.05 = 0.2236, which is under 0.25, so it auto-closes. 4 corners, area 12. A tap at (0.20,0.20), distance 0.2828, does **not** close and adds a 5th corner. |
| T4 | Existing corner (2,0). Tap at (2.02,0.00) | Distance 0.02, under 0.03, so it snaps to (2,0). Tap (2.04,0): 0.04 is over the threshold, so there's no snap. |
| T5 | Previous corner (1,1). Tap (1.06,1.08) | Distance √(0.0036+0.0064) = 0.100, which is not below 0.10, so it's accepted. Tap (1.06,1.06): 0.0849, under 0.10, so it's rejected. |
| T6 | Quad (0,0),(4,0),(4.05,3),(0,3), no locks | Area before = (0+12+12.15+0)/2 = 12.075. After squaring, all 4 angles are 90°±0.1°, there's no intersection, and the area is in [12.0,12.15]. |
| T7 | T1 rectangle with locks 4,3,4,3.10 | All right angles can't hold with these lengths, so the closure is inconsistent. The result is `.conflict`, the worst residuals are on walls 1 and 3 (~0.05 m each), and the geometry is unchanged. |
| T8 | Arc wall, chord 4, sagitta 0.5 | R = 16/4 + 0.25 = 4.25. sin φ = 2/4.25 = 0.470588, cos φ = 0.882353, φ = atan(8/15) = 0.489957 rad. Arc length = 8.5·0.489957 = 4.1646. sin 2φ = 0.830450. Segment area = 18.0625·(0.979915 − 0.830450)/2 = 1.3499. |
| T9 | 3-point arc (0,0),(2,1),(4,0) | Chord 4, sagitta 1, R = 16/8 + 0.5 = 2.5. Centre (2,−1.5). Check: √(4+2.25) = 2.5, and 1 − (−1.5) = 2.5. |
| T10 | T1 room, sloped 2.4 m at the wall y=0 rising to 3.0 m at the wall y=3 | Volume = 12·2.7 = 32.400. Walls: 4·2.4 = 9.6, 4·3.0 = 12.0, sides 3·2.7 = 8.1 each, total 37.800. α = atan(0.6/3) = 11.310°. Ceiling = 4·√(9.36) = 4·3.05941 = 12.2376. |
| T11 | Wall 4 m, flat 2.4. Door 0.9×2.1, window 1.2×1.0 | Gross 9.60. Minus 1.89 for the door gives 7.71. Minus 1.20 for the window gives **6.51**. |
| T12 | Wall 4 m. Door width 0.9 at offset 3.5 | 3.5 + 0.9 = 4.4, over 3.98, so it's rejected. At offset 3.08: 3.98, not over 3.98, so it's accepted. |
| T13 | Room A = T1. Room B 3×3 dropped at x=4.06 ((4.06,0)…(7.06,3)) | Gap 0.06, under 0.10, so B snaps by −0.06 to (4,0),(7,0),(7,3),(4,3). The shared wall is 3.0 m. Floor net area 12 + 9 = 21.000. |
| T14 | BLE reading 3.457 m with wall 2 selected | Wall 2 gets lockedLength 3.457 and source .laser, and the selection moves to wall 3. Imperial display: 3.457/0.3048 = 11.342 ft = 11 ft 4.1 in (0.342·12 = 4.10). |
| T15 | Bowtie (0,0),(2,2),(2,0),(0,2) | Self-intersection detected (edges 0 and 2 cross at (1,1)), so the close is rejected. |
| T16 | T2 polygon given clockwise (reversed order) | Signed area −21, so it's auto-reversed to CCW with area +21. The wall count stays 6. |
| T17 | T1 area in imperial | 12 · 10.7639 = 129.17 ft². |

## 16. Open questions
1. Is RoomPlan the primary path on LiDAR phones, with tap capture as the fallback, or the other way round?
2. Should interior wall thickness be modelled in the solver, or only at export?
3. Which BLE laser brands come first? Each needs vendor GATT documentation or a partner agreement.
4. Do gross area rules follow ANSI Z765 or a local Québec/Canada standard?
5. Is IFC required for v1 customers, or can it wait until v2?
6. Do we need sync and accounts for v1, or is local-only with file export enough?
7. Should the default for squaring be on, or opt-in per room?
8. Should arcs with |s| > c/2 (bay windows, rotundas) be supported?
