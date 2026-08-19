import CoreGraphics
import Foundation

/// The geometry behind editing a plan by hand.
///
/// Pure functions on a closed polygon of room corners, kept apart from any
/// view so the maths can be reasoned about — and tested — without a gesture
/// in sight. Built to Docs/Interactive-Plan-Editor-Spec.md.
///
/// The governing idea, taken from every well-reviewed plan editor: a room is
/// a CLOSED POLYGON, always. Walls are its edges, derived rather than stored,
/// so there is no state in which a drag leaves a dangling wall or an open
/// loop. Whatever the finger does, the room is still a room.
enum PlanEditing {

    /// Metres. Every candidate position is rounded to this before it is shown
    /// or stored — a fingertip is never trusted for the final number. Rough
    /// by drag, exact by keypad.
    static let quantum = 0.01

    // MARK: - Small vector helpers

    static func sub(_ a: CGPoint, _ b: CGPoint) -> CGPoint {
        CGPoint(x: a.x - b.x, y: a.y - b.y)
    }

    static func length(_ v: CGPoint) -> Double { hypot(v.x, v.y) }

    static func normalised(_ v: CGPoint) -> CGPoint {
        let l = length(v)
        guard l > 1e-9 else { return CGPoint(x: 1, y: 0) }
        return CGPoint(x: v.x / l, y: v.y / l)
    }

    /// The left-hand normal of a direction.
    static func normal(_ d: CGPoint) -> CGPoint { CGPoint(x: -d.y, y: d.x) }

    static func dot(_ a: CGPoint, _ b: CGPoint) -> Double { a.x * b.x + a.y * b.y }

    static func cross(_ a: CGPoint, _ b: CGPoint) -> Double { a.x * b.y - a.y * b.x }

    static func quantise(_ value: Double) -> Double {
        (value / quantum).rounded() * quantum
    }

    static func quantise(_ p: CGPoint) -> CGPoint {
        CGPoint(x: quantise(p.x), y: quantise(p.y))
    }

    // MARK: - Lines

    /// Where two infinite lines cross, or nil when they are parallel enough
    /// that the answer would be meaningless.
    ///
    /// The tolerance is on the SINE of the angle between them, so it means
    /// the same thing regardless of how long the walls are: 0.0087 is half a
    /// degree, the point past which an intersection shoots off far enough to
    /// be nonsense.
    static func intersection(
        pointA: CGPoint, dirA: CGPoint, pointB: CGPoint, dirB: CGPoint
    ) -> CGPoint? {
        let denominator = cross(dirA, dirB)
        guard abs(denominator) > 0.0087 else { return nil }
        let t = cross(sub(pointB, pointA), dirB) / denominator
        return CGPoint(x: pointA.x + dirA.x * t, y: pointA.y + dirA.y * t)
    }

    // MARK: - Polygon edges

    /// Corner indices of edge `i`: from corner i to corner i+1, wrapping.
    static func edgeCorners(_ index: Int, count: Int) -> (Int, Int) {
        (index, (index + 1) % count)
    }

    static func edgeLength(_ polygon: [CGPoint], _ index: Int) -> Double {
        guard polygon.count >= 2 else { return 0 }
        let (a, b) = edgeCorners(index, count: polygon.count)
        return length(sub(polygon[b], polygon[a]))
    }

    // MARK: - Wall drag

    /// Slide one wall sideways, letting its neighbours stretch to meet it.
    ///
    /// The dragged wall keeps its own direction and the two walls either side
    /// keep theirs; only the two shared corners move, to wherever the offset
    /// line now crosses the neighbours' lines. That is what "the adjoining
    /// walls extend or shorten" means geometrically, and it is the single
    /// behaviour that makes dragging a wall feel like editing a room rather
    /// than breaking one.
    ///
    /// `offset` is signed along the wall's own normal, in metres. Returns nil
    /// when a neighbour is too near parallel for an intersection to mean
    /// anything — the caller falls back to `translateEdge`.
    static func dragEdge(_ polygon: [CGPoint], index: Int, offset: Double) -> [CGPoint]? {
        let n = polygon.count
        guard n >= 3, index >= 0, index < n else { return nil }

        let (aIndex, bIndex) = edgeCorners(index, count: n)
        let previousIndex = (aIndex - 1 + n) % n
        let nextIndex = (bIndex + 1) % n

        let direction = normalised(sub(polygon[bIndex], polygon[aIndex]))
        let sideways = normal(direction)
        let shift = CGPoint(x: sideways.x * offset, y: sideways.y * offset)

        // The dragged wall's line, moved sideways but pointing the same way.
        let movedA = CGPoint(x: polygon[aIndex].x + shift.x, y: polygon[aIndex].y + shift.y)

        let previousDirection = normalised(sub(polygon[aIndex], polygon[previousIndex]))
        let nextDirection = normalised(sub(polygon[nextIndex], polygon[bIndex]))

        guard
            let newA = intersection(
                pointA: movedA, dirA: direction,
                pointB: polygon[previousIndex], dirB: previousDirection),
            let newB = intersection(
                pointA: movedA, dirA: direction,
                pointB: polygon[nextIndex], dirB: nextDirection)
        else { return nil }

        var result = polygon
        result[aIndex] = quantise(newA)
        result[bIndex] = quantise(newB)
        return result
    }

    /// Move a wall rigidly, taking its corners with it.
    ///
    /// The fallback when a neighbour runs parallel to the wall being dragged:
    /// there is no honest intersection to solve for, so both ends simply
    /// travel together rather than being flung to infinity.
    static func translateEdge(_ polygon: [CGPoint], index: Int, offset: Double) -> [CGPoint] {
        let n = polygon.count
        guard n >= 3, index >= 0, index < n else { return polygon }
        let (a, b) = edgeCorners(index, count: n)
        let sideways = normal(normalised(sub(polygon[b], polygon[a])))
        let shift = CGPoint(x: sideways.x * offset, y: sideways.y * offset)

        var result = polygon
        result[a] = quantise(CGPoint(x: polygon[a].x + shift.x, y: polygon[a].y + shift.y))
        result[b] = quantise(CGPoint(x: polygon[b].x + shift.x, y: polygon[b].y + shift.y))
        return result
    }

    /// Drag one wall, taking the honest path and falling back when it fails.
    static func moveEdge(_ polygon: [CGPoint], index: Int, offset: Double) -> [CGPoint] {
        dragEdge(polygon, index: index, offset: offset)
            ?? translateEdge(polygon, index: index, offset: offset)
    }

    // MARK: - Typed length

    /// Resize a wall to an exact length, symmetrically about its midpoint.
    ///
    /// Which end should move is a genuine choice with no right answer — no
    /// editor documents its rule — so this moves both ends equally. The
    /// result does not depend on which corner happened to be first, which
    /// makes typing the same number twice idempotent.
    static func setEdgeLength(_ polygon: [CGPoint], index: Int, to target: Double) -> [CGPoint] {
        let n = polygon.count
        guard n >= 3, index >= 0, index < n, target > 0 else { return polygon }
        let (a, b) = edgeCorners(index, count: n)

        let direction = normalised(sub(polygon[b], polygon[a]))
        let midpoint = CGPoint(
            x: (polygon[a].x + polygon[b].x) / 2, y: (polygon[a].y + polygon[b].y) / 2)
        let half = target / 2

        var result = polygon
        result[a] = quantise(
            CGPoint(x: midpoint.x - direction.x * half, y: midpoint.y - direction.y * half))
        result[b] = quantise(
            CGPoint(x: midpoint.x + direction.x * half, y: midpoint.y + direction.y * half))
        return result
    }

    /// Rebuild a room from one trusted corner, the wall directions it was
    /// drawn with, and the lengths typed so far — the maths behind the
    /// wall-by-wall measurement walk.
    ///
    /// The symmetric resize above is right for a single wall and wrong for a
    /// sequence: it moves the shared corner BEHIND the walk and quietly
    /// changes the wall just typed. Here the walk is honest instead: anchor
    /// at the start edge's first corner, freeze every wall's direction as it
    /// was when the walk began, and chain each wall's length — typed where
    /// typed, as-drawn where not — corner by corner, the way a tape is run
    /// from the corner you already trust. Every typed wall lands exactly and
    /// stays exactly.
    ///
    /// The LAST edge of the walk is derived, never chained: a closed room's
    /// final wall is already implied by all the others and their angles, so
    /// it absorbs whatever inconsistency the typed numbers carry — visibly,
    /// on the canvas, rather than by silently corrupting a number somebody
    /// entered. `typed` is indexed by edge; a nil keeps that wall as drawn.
    static func applyWalkLengths(
        _ baseline: [CGPoint], startEdge: Int, typed: [Double?]
    ) -> [CGPoint] {
        let n = baseline.count
        guard n >= 3, startEdge >= 0, startEdge < n, typed.count == n else { return baseline }

        var result = baseline
        // Walk n-1 edges from the anchor; the edge that returns to the
        // anchor is the derived one.
        for i in 0..<(n - 1) {
            let edge = (startEdge + i) % n
            let (a, b) = edgeCorners(edge, count: n)
            let direction = normalised(sub(baseline[b], baseline[a]))
            let length = typed[edge] ?? edgeLength(baseline, edge)
            guard length > 0 else { continue }
            result[b] = quantise(
                CGPoint(
                    x: result[a].x + direction.x * length,
                    y: result[a].y + direction.y * length))
        }
        return result
    }

    // MARK: - Corners

    static func moveCorner(_ polygon: [CGPoint], index: Int, to point: CGPoint) -> [CGPoint] {
        guard index >= 0, index < polygon.count else { return polygon }
        var result = polygon
        result[index] = quantise(point)
        return result
    }

    /// Split a wall in two at its midpoint. Returns the polygon and the index
    /// of the corner just made, so the caller can select it immediately.
    static func addCorner(_ polygon: [CGPoint], onEdge index: Int) -> ([CGPoint], Int) {
        let n = polygon.count
        guard n >= 3, index >= 0, index < n else { return (polygon, -1) }
        let (a, b) = edgeCorners(index, count: n)
        let midpoint = quantise(
            CGPoint(x: (polygon[a].x + polygon[b].x) / 2, y: (polygon[a].y + polygon[b].y) / 2))

        var result = polygon
        result.insert(midpoint, at: a + 1)
        return (result, a + 1)
    }

    /// Remove a corner, merging its two walls into one.
    ///
    /// Refused below four corners: three is the fewest that encloses
    /// anything, and a room that can be dissolved by tapping is not a room.
    static func removeCorner(_ polygon: [CGPoint], index: Int) -> [CGPoint] {
        guard polygon.count > 3, index >= 0, index < polygon.count else { return polygon }
        var result = polygon
        result.remove(at: index)
        return result
    }

    // MARK: - Validity

    /// True when two non-adjacent walls cross — a bow-tie.
    ///
    /// Never used to block a drag. The offending walls are drawn dashed red
    /// and Save is refused while it lasts: signal, do not block, because a
    /// finger often passes through an invalid shape on its way to a valid
    /// one, and a gesture that fights back is worse than one that warns.
    static func selfIntersects(_ polygon: [CGPoint]) -> Bool {
        let n = polygon.count
        guard n >= 4 else { return false }

        func segmentsCross(_ p1: CGPoint, _ p2: CGPoint, _ p3: CGPoint, _ p4: CGPoint) -> Bool {
            let d1 = sub(p2, p1)
            let d2 = sub(p4, p3)
            let denominator = cross(d1, d2)
            guard abs(denominator) > 1e-12 else { return false }
            let t = cross(sub(p3, p1), d2) / denominator
            let u = cross(sub(p3, p1), d1) / denominator
            // Strictly inside both, so merely touching at a shared corner —
            // which every adjacent pair does — is not a crossing.
            return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9
        }

        for i in 0..<n {
            for j in (i + 1)..<n {
                // Adjacent edges share a corner by definition; skip them and
                // the wrap-around pair.
                if j == i + 1 || (i == 0 && j == n - 1) { continue }
                let (a1, b1) = edgeCorners(i, count: n)
                let (a2, b2) = edgeCorners(j, count: n)
                if segmentsCross(polygon[a1], polygon[b1], polygon[a2], polygon[b2]) {
                    return true
                }
            }
        }
        return false
    }

    // MARK: - Freehand capture

    /// Ramer–Douglas–Peucker on an open path: keep only the points a
    /// straight line between two others could not stand in for, within
    /// `tolerance` (same units as the points — plan metres, here).
    ///
    /// A finger's drag comes back as dozens of samples a frame apart; stored
    /// as-is that is not a polygon a corner editor can select and drag, it
    /// is a point cloud. This is the standard reduction, kept here rather
    /// than inline so `simplifyClosed` below can share it.
    static func simplify(_ points: [CGPoint], tolerance: Double) -> [CGPoint] {
        guard points.count > 2 else { return points }

        func perpendicularDistance(_ p: CGPoint, _ a: CGPoint, _ b: CGPoint) -> Double {
            let d = sub(b, a)
            let len = length(d)
            guard len > 1e-9 else { return length(sub(p, a)) }
            let t = dot(sub(p, a), d) / (len * len)
            let proj = CGPoint(x: a.x + d.x * t, y: a.y + d.y * t)
            return length(sub(p, proj))
        }

        func reduce(_ pts: [CGPoint]) -> [CGPoint] {
            guard pts.count > 2, let first = pts.first, let last = pts.last else { return pts }
            var maxDistance = 0.0
            var splitIndex = 0
            for i in 1..<(pts.count - 1) {
                let d = perpendicularDistance(pts[i], first, last)
                if d > maxDistance {
                    maxDistance = d
                    splitIndex = i
                }
            }
            guard maxDistance > tolerance else { return [first, last] }
            let left = reduce(Array(pts[0...splitIndex]))
            let right = reduce(Array(pts[splitIndex...]))
            return left.dropLast() + right
        }

        return reduce(points)
    }

    /// The same reduction for a CLOSED loop — what a finger actually draws.
    ///
    /// `simplify` needs two distinct endpoints to measure every other point
    /// against; a loop has none. The standard trick is to close it first —
    /// append the start point back onto the end — and simplify that as an
    /// open path: every point's distance is then measured from the anchor
    /// where the finger both started and lifted, which is the one point a
    /// freehand loop is guaranteed to pass near twice. Fed straight back
    /// into `simplify`, the anchor survives as both ends of the result, so
    /// the duplicate is dropped once reduction is done.
    static func simplifyClosed(_ points: [CGPoint], tolerance: Double) -> [CGPoint] {
        guard let first = points.first, points.count > 2 else { return points }
        var simplified = simplify(points + [first], tolerance: tolerance)
        if simplified.count > 1, length(sub(simplified[0], simplified[simplified.count - 1])) < 1e-9
        {
            simplified.removeLast()
        }
        return simplified
    }

    /// The shoelace area, absolute — a room drawn clockwise measures the same
    /// as one drawn the other way.
    static func area(_ polygon: [CGPoint]) -> Double {
        guard polygon.count >= 3 else { return 0 }
        var sum = 0.0
        for i in polygon.indices {
            let a = polygon[i]
            let b = polygon[(i + 1) % polygon.count]
            sum += a.x * b.y - b.x * a.y
        }
        return abs(sum) / 2
    }

    /// Is this room a rectangle?
    ///
    /// Asked by the editors to decide whether `Set Size` is offered at all.
    /// The reference REMOVES that verb from the bar on a room that is not a
    /// rectangle and restores it when the shape becomes one again — because
    /// the walk behind it types a width and a length, and a width and a
    /// length do not describe an L. Greying it would say "not now"; the
    /// reference says "not a thing you can do to this shape", and the bar
    /// stays the one the owner learned by only ever offering verbs that
    /// apply.
    ///
    /// Four corners, four square angles. Nothing is said about the SIDES:
    /// a square is a rectangle, and the walk sets both dimensions anyway.
    ///
    /// **The tolerance is not fussiness.** Every corner this editor produces
    /// is quantised to `quantum` — one centimetre — so a 1 m wall built by
    /// dragging can sit 0.57° off square while being as square as this app
    /// can represent. A hair over one degree keeps that case, and a shape a
    /// hand deliberately pulled out of square is always far past it.
    static func isRectangle(_ polygon: [CGPoint], tolerance: Double = 1.2 * .pi / 180) -> Bool {
        guard polygon.count == 4 else { return false }
        let limit = sin(tolerance)
        // A collapsed edge has no direction, and `normalised` answers with a
        // placeholder rather than nothing — so it is ruled out here instead
        // of being allowed to pass as a right angle by accident.
        let collapsed = polygon.indices.contains {
            length(sub(polygon[($0 + 1) % 4], polygon[$0])) < 1e-6
        }
        guard !collapsed else { return false }
        for i in polygon.indices {
            let previous = normalised(sub(polygon[i], polygon[(i + 3) % 4]))
            let next = normalised(sub(polygon[(i + 1) % 4], polygon[i]))
            // Perpendicular means the DOT is zero; comparing it against the
            // sine of the angle is what makes the tolerance an angle rather
            // than a length, at any size of room.
            guard abs(dot(previous, next)) < limit else { return false }
        }
        return true
    }

    /// Standard ray-casting point-in-polygon, same shape as
    /// `FloorPlanGeometry.labelAnchor`'s private `inside()` — kept here,
    /// shared, rather than reinvented a third time. A tap that is not near
    /// any corner, opening or wall band and lands outside the room entirely
    /// is what tells `RoomEditorCore` the operator is done with this room —
    /// the reference's own gesture (§ interactions-editor.md, "no frame
    /// shows how selection is cleared" — the owner filled that gap from
    /// memory, 18 Aug 2026: tap the canvas outside the room, it goes back).
    static func contains(_ polygon: [CGPoint], point: CGPoint) -> Bool {
        guard polygon.count >= 3 else { return false }
        var inside = false
        var j = polygon.count - 1
        for i in polygon.indices {
            let a = polygon[i], b = polygon[j]
            if (a.y > point.y) != (b.y > point.y),
                point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x
            {
                inside.toggle()
            }
            j = i
        }
        return inside
    }

    // MARK: - Openings

    /// A door or window authored onto a wall by hand.
    ///
    /// Lives on an EDGE, not at a world coordinate: `offset` is metres from
    /// the edge's start corner to the near jamb. That way the opening rides
    /// its wall through every drag and resize — a door in a wall stays in
    /// that wall, which is the one invariant an opening has in real life.
    struct WallOpening: Equatable {
        var edge: Int
        /// Metres from the edge's start corner to the near jamb.
        var offset: Double
        var width: Double
        /// Floor to head, metres. Starts as `kind.height` when placed — same
        /// precedent as `width`, which has always started as `kind.width`
        /// and been its own field from that point on — but is independently
        /// editable from `OpeningDetailView`, 18 Aug 2026: the owner's own
        /// reference screenshot showed Width, Height and Distance to Floor
        /// as three separate stepper fields, none of them tied back to a
        /// catalog entry once an opening exists.
        var height: Double
        /// Floor to the BOTTOM of the opening, metres — the reference's
        /// "Distance to Floor" (object-model §2), and the one field this
        /// app never had anywhere to hang until now. `OpeningKind.sill`
        /// already existed as the catalog DEFAULT (ORD-24: zero for every
        /// door, a real figure for each window); this is that default, now
        /// promoted to a per-instance field the same way `width`/`height`
        /// are, so lowering one particular window's sill does not touch
        /// the catalog every other window of that kind still starts from.
        var sill: Double
        var kind: OpeningKind
    }

    /// The seven openings a water-damage estimate actually meets.
    ///
    /// Widths and heights are STARTING conventions, not measurements — the
    /// builders' stock sizes this market is framed to, stated in inches and
    /// derived, never typed as bare metres. The width is what the net wall
    /// area deducts, so a wrong default here is money; these are the sizes an
    /// adjuster will not argue with.
    enum OpeningKind: String, CaseIterable {
        case doorSingle
        case doorDouble
        case doorSliding
        /// A cased opening — a doorless passage between rooms. Authored with
        /// the doors but filed with the connective openings, because that is
        /// what it is: a gap that connects, not a door that closes.
        case doorCased
        /// **The rest of the doors a North American house actually has**,
        /// added 19 Aug 2026 on the owner's ask that the library stop being
        /// four kinds. Each is a real mechanism with a real stock width,
        /// because the width is what knocks the hole in the wall and comes
        /// off net wall area — a picture of a door we cannot measure would
        /// be worse than no door at all.
        case doorPocket
        case doorBifold
        case doorBypass
        case doorFrench
        case doorPatio
        case doorEntry
        case doorGarage
        case windowStandard
        case windowWide
        case windowSmall
        case windowDoubleHung
        case windowCasement
        case windowSliding
        case windowPicture
        case windowEgress
        case windowBay

        /// Which of the geometry's three arrays this lands in downstream.
        enum Category { case door, window, passage }

        var category: Category {
            switch self {
            case .doorSingle, .doorDouble, .doorSliding, .doorPocket, .doorBifold,
                .doorBypass, .doorFrench, .doorPatio, .doorEntry, .doorGarage:
                return .door
            case .doorCased:
                return .passage
            case .windowStandard, .windowWide, .windowSmall, .windowDoubleHung,
                .windowCasement, .windowSliding, .windowPicture, .windowEgress,
                .windowBay:
                return .window
            }
        }

        private static let inch = 0.0254

        var width: Double {
            switch self {
            case .doorSingle: return 32 * Self.inch
            case .doorDouble: return 60 * Self.inch
            case .doorSliding: return 72 * Self.inch
            case .doorCased: return 48 * Self.inch
            case .windowStandard: return 36 * Self.inch
            case .windowWide: return 60 * Self.inch
            case .windowSmall: return 24 * Self.inch
            // Stock widths, every one of them a size a supplier sells.
            case .doorPocket: return 32 * Self.inch
            case .doorBifold: return 30 * Self.inch
            case .doorBypass: return 60 * Self.inch
            case .doorFrench: return 60 * Self.inch
            case .doorPatio: return 72 * Self.inch
            case .doorEntry: return 36 * Self.inch
            case .doorGarage: return 96 * Self.inch
            case .windowDoubleHung: return 36 * Self.inch
            case .windowCasement: return 24 * Self.inch
            case .windowSliding: return 48 * Self.inch
            case .windowPicture: return 72 * Self.inch
            case .windowEgress: return 36 * Self.inch
            case .windowBay: return 72 * Self.inch
            }
        }

        /// What the net wall area deducts, with the width. Doors are the 6'8"
        /// builder's standard; windows a nominal 4', the small one a basement
        /// hopper's 2'.
        var height: Double {
            switch self {
            case .doorSingle, .doorDouble, .doorSliding, .doorCased:
                return 80 * Self.inch
            case .windowStandard, .windowWide:
                return 48 * Self.inch
            case .windowSmall:
                return 24 * Self.inch
            case .doorPocket, .doorBifold, .doorBypass, .doorFrench, .doorPatio,
                .doorEntry:
                return 80 * Self.inch
            // A garage door is the one opening measured in feet: 7ft is the
            // stock height, and it is most of a wall.
            case .doorGarage:
                return 84 * Self.inch
            case .windowDoubleHung:
                return 60 * Self.inch
            case .windowCasement:
                return 48 * Self.inch
            case .windowSliding:
                return 36 * Self.inch
            case .windowPicture:
                return 48 * Self.inch
            // Code egress: the sill low enough and the opening big enough to
            // climb out of. A finished basement legally needs one, and
            // whether a room HAS one changes what may be rebuilt there.
            case .windowEgress:
                return 48 * Self.inch
            case .windowBay:
                return 48 * Self.inch
            }
        }

        /// Height of the opening's underside above the floor — a window's
        /// sill, and zero for anything you walk through.
        ///
        /// This is the ONLY thing that distinguishes a door from a window.
        /// magicplan models it exactly this way and calls it `Distance to
        /// Floor` (`Docs/reference/magicplan/object-model.md` §2): there is no
        /// door type and no window type, only an object whose underside
        /// happens to sit on the floor. Keeping the same shape here means the
        /// two cases stop being different kinds of thing everywhere
        /// downstream.
        ///
        /// It is also a measurement in its own right. An elevation cannot draw
        /// a window in the right place without it, and a water line at 18"
        /// either crosses a sill or does not — which decides whether the
        /// window is in the claim.
        ///
        /// Standard sills: a punched window at 3', a wide one lower at 2'6"
        /// because it is usually a picture window, a basement hopper high at
        /// 6' since it sits at grade.
        var sill: Double {
            switch self {
            case .doorSingle, .doorDouble, .doorSliding, .doorCased:
                return 0
            case .windowStandard: return 36 * Self.inch
            case .windowWide: return 30 * Self.inch
            case .windowSmall: return 72 * Self.inch
            // Anything you walk through sits on the floor, whatever its
            // mechanism — that is what `sill` means.
            case .doorPocket, .doorBifold, .doorBypass, .doorFrench, .doorPatio,
                .doorEntry, .doorGarage:
                return 0
            case .windowDoubleHung: return 30 * Self.inch
            case .windowCasement: return 36 * Self.inch
            case .windowSliding: return 42 * Self.inch
            case .windowPicture: return 30 * Self.inch
            // Egress sills are LOW by code — no more than 44in to the sill,
            // and usually well under it in a basement. It is also why an
            // egress window is so often in a water claim: the lowest glass
            // in the house.
            case .windowEgress: return 36 * Self.inch
            case .windowBay: return 24 * Self.inch
            }
        }

        /// The top of the opening above the floor. Derived, never stored — a
        /// sill and a height that disagreed with a head would be one fact
        /// recorded twice.
        var head: Double { sill + height }

        var label: String {
            switch self {
            case .doorSingle: return "Door"
            case .doorDouble: return "Double door"
            case .doorSliding: return "Sliding door"
            case .doorCased: return "Opening (no door)"
            case .windowStandard: return "Window"
            case .windowWide: return "Wide window"
            case .windowSmall: return "Small window"
            case .doorPocket: return "Pocket door"
            case .doorBifold: return "Bifold door"
            case .doorBypass: return "Bypass door"
            case .doorFrench: return "French doors"
            case .doorPatio: return "Patio slider"
            case .doorEntry: return "Exterior entry door"
            case .doorGarage: return "Garage door"
            case .windowDoubleHung: return "Double-hung window"
            case .windowCasement: return "Casement window"
            case .windowSliding: return "Sliding window"
            case .windowPicture: return "Picture window"
            case .windowEgress: return "Egress window"
            case .windowBay: return "Bay window"
            }
        }
    }

    /// How close to a corner a jamb may sit. Real framing needs a king stud;
    /// drawings that let a door touch a corner exactly draw ambiguously.
    static let jambMargin = 0.05

    /// Pin an opening inside its wall. When the wall is too short for the
    /// margins the opening is centred instead — a visible overhang the
    /// operator will fix, rather than a silently deleted door.
    static func clampedOffset(offset: Double, width: Double, edgeLength: Double) -> Double {
        guard edgeLength - width >= 2 * jambMargin else { return (edgeLength - width) / 2 }
        return min(max(offset, jambMargin), edgeLength - width - jambMargin)
    }

    /// Place a kind on an edge, in the middle of the widest gap left between
    /// the openings already there. nil when no gap fits it — the caller
    /// disables that choice rather than overlapping two deductions.
    static func placeOpening(
        _ kind: OpeningKind, onEdge edge: Int, of polygon: [CGPoint],
        avoiding existing: [WallOpening]
    ) -> WallOpening? {
        let length = edgeLength(polygon, edge)
        // Jambs of what is already on this wall, in order, bracketed by the
        // corners' margins so every gap is computed one way.
        var stops: [(from: Double, to: Double)] = [(0, jambMargin)]
        for other in existing where other.edge == edge {
            let start = clampedOffset(offset: other.offset, width: other.width, edgeLength: length)
            stops.append((start, start + other.width))
        }
        stops.append((length - jambMargin, length))
        stops.sort { $0.from < $1.from }

        var bestStart = 0.0
        var bestRun = -1.0
        for i in 0..<(stops.count - 1) {
            let run = stops[i + 1].from - stops[i].to
            if run > bestRun {
                bestRun = run
                bestStart = stops[i].to
            }
        }
        guard bestRun >= kind.width else { return nil }
        return WallOpening(
            edge: edge,
            offset: quantise(bestStart + (bestRun - kind.width) / 2),
            width: kind.width,
            height: kind.height,
            sill: kind.sill,
            kind: kind)
    }

    /// The jamb endpoints in the polygon's own space, clamped into the wall.
    static func openingEndpoints(_ polygon: [CGPoint], _ opening: WallOpening)
        -> (a: CGPoint, b: CGPoint)?
    {
        let n = polygon.count
        guard n >= 3, opening.edge >= 0, opening.edge < n else { return nil }
        let (ai, bi) = edgeCorners(opening.edge, count: n)
        let length = edgeLength(polygon, opening.edge)
        guard length > 1e-9 else { return nil }
        let direction = normalised(sub(polygon[bi], polygon[ai]))
        let start = clampedOffset(offset: opening.offset, width: opening.width, edgeLength: length)
        return (
            CGPoint(
                x: polygon[ai].x + direction.x * start,
                y: polygon[ai].y + direction.y * start),
            CGPoint(
                x: polygon[ai].x + direction.x * (start + opening.width),
                y: polygon[ai].y + direction.y * (start + opening.width)))
    }

    /// Slide an opening along its wall, stopped by the corners' margins and
    /// by the other openings on the same wall — two doors cannot share studs,
    /// and two deductions must not share wall.
    static func slideOpening(
        _ opening: WallOpening, along polygon: [CGPoint], by delta: Double,
        avoiding others: [WallOpening]
    ) -> WallOpening {
        let length = edgeLength(polygon, opening.edge)
        var lower = jambMargin
        var upper = length - opening.width - jambMargin
        for other in others where other.edge == opening.edge && other != opening {
            let otherStart = clampedOffset(
                offset: other.offset, width: other.width, edgeLength: length)
            if otherStart >= opening.offset {
                upper = min(upper, otherStart - opening.width)
            } else {
                lower = max(lower, otherStart + other.width)
            }
        }
        guard upper >= lower else { return opening }
        var moved = opening
        moved.offset = quantise(min(max(opening.offset + delta, lower), upper))
        return moved
    }

    /// The dimension chain of one wall: the pieces from corner to corner,
    /// alternating gap · opening · gap …, summing to the wall exactly. This
    /// is a PROJECTION of the wall, derived fresh each time — never stored,
    /// so it cannot disagree with the wall it describes.
    static func chain(_ polygon: [CGPoint], edge: Int, openings: [WallOpening]) -> [Double] {
        let length = edgeLength(polygon, edge)
        guard length > 0 else { return [] }
        let sorted = openings
            .filter { $0.edge == edge }
            .map { opening -> (start: Double, width: Double) in
                (clampedOffset(offset: opening.offset, width: opening.width, edgeLength: length),
                 opening.width)
            }
            .sorted { $0.start < $1.start }
        guard !sorted.isEmpty else { return [length] }

        var pieces: [Double] = []
        var cursor = 0.0
        for piece in sorted {
            pieces.append(piece.start - cursor)
            pieces.append(piece.width)
            cursor = piece.start + piece.width
        }
        pieces.append(length - cursor)
        return pieces
    }

    // MARK: - Openings through topology changes
    //
    // Corner edits renumber the edges, and everything keyed by edge index —
    // openings, locked lengths — has to be renumbered with them or it
    // silently attaches to the wrong wall. The polygon passed in is always
    // the one from BEFORE the change.

    /// After `addCorner` split `splitEdge` at its midpoint: later edges shift
    /// up one, and an opening on the split edge goes to whichever half holds
    /// its centre.
    static func openingsAfterCornerAdded(
        _ openings: [WallOpening], polygon: [CGPoint], splitEdge: Int
    ) -> [WallOpening] {
        let half = edgeLength(polygon, splitEdge) / 2
        return openings.map { opening in
            var moved = opening
            if opening.edge > splitEdge {
                moved.edge += 1
            } else if opening.edge == splitEdge {
                let centre = opening.offset + opening.width / 2
                if centre > half {
                    moved.edge += 1
                    moved.offset = opening.offset - half
                }
            }
            return moved
        }
    }

    /// After `removeCorner` merged the two edges either side of `corner`:
    /// later edges shift down one, and openings on the merged pair land on
    /// the merged edge — the second edge's offsets pushed past the first.
    ///
    /// The merged edge is the straight chord, not the sum of the two old
    /// Turn a room a quarter-turn about its own centre.
    ///
    /// Clockwise on screen, where y grows downward: `(x, y) → (-y, x)` about
    /// the centroid. Openings need no adjustment at all — a `WallOpening`
    /// lives on an EDGE INDEX with an offset along it, and rotating every
    /// corner leaves edge N still edge N, the same length, with the same
    /// opening the same distance along it. That is the whole benefit of
    /// storing openings against edges rather than world coordinates.
    ///
    /// The centroid is the plain average of the corners, not the polygon's
    /// area centroid: the two differ on an L, and the average is what keeps
    /// a room visually where it was — which is the only thing this needs to
    /// do, since nothing downstream depends on which point was pivoted about.
    static func rotatedQuarterTurn(_ polygon: [CGPoint]) -> [CGPoint] {
        guard polygon.count >= 3 else { return polygon }
        var cx = 0.0
        var cy = 0.0
        for p in polygon {
            cx += p.x
            cy += p.y
        }
        cx /= Double(polygon.count)
        cy /= Double(polygon.count)
        return polygon.map { p in
            let dx = p.x - cx
            let dy = p.y - cy
            return quantise(CGPoint(x: cx - dy, y: cy + dx))
        }
    }

    /// walls, so the offsets are approximate for a deep corner. The corner
    /// being deleted is almost always a near-collinear kink, where the chord
    /// and the sum agree; the clamp catches the rest.
    static func openingsAfterCornerRemoved(
        _ openings: [WallOpening], polygon: [CGPoint], corner: Int
    ) -> [WallOpening] {
        let n = polygon.count
        let firstEdge = (corner - 1 + n) % n
        let secondEdge = corner
        let firstLength = edgeLength(polygon, firstEdge)
        // Where the merged pair lives after the renumbering: corner 0 merges
        // the wrap-around pair into the LAST new edge, every other corner
        // merges into the edge before it.
        let mergedEdge = corner == 0 ? n - 2 : corner - 1
        return openings.map { opening in
            var moved = opening
            if opening.edge == firstEdge {
                moved.edge = mergedEdge
            } else if opening.edge == secondEdge {
                moved.edge = mergedEdge
                moved.offset = opening.offset + firstLength
            } else if corner > 0 && opening.edge > secondEdge {
                moved.edge -= 1
            } else if corner == 0 {
                moved.edge -= 1
            }
            return moved
        }
    }

    /// Locked-length indices through the same renumbering. The split edge's
    /// own lock is dropped: the typed number was for the whole wall, and
    /// neither half is that wall any more.
    static func lockedAfterCornerAdded(_ locked: Set<Int>, splitEdge: Int) -> Set<Int> {
        Set(locked.compactMap { edge in
            if edge == splitEdge { return nil }
            return edge > splitEdge ? edge + 1 : edge
        })
    }

    /// Both merged edges lose their locks — the merged wall is a new length
    /// nobody typed.
    static func lockedAfterCornerRemoved(_ locked: Set<Int>, corner: Int, count n: Int)
        -> Set<Int>
    {
        let firstEdge = (corner - 1 + n) % n
        let secondEdge = corner
        return Set(locked.compactMap { edge in
            if edge == firstEdge || edge == secondEdge { return nil }
            if corner > 0 { return edge > secondEdge ? edge - 1 : edge }
            return edge - 1
        })
    }

    // MARK: - Snapping

    /// What a drag settled on, and whether that was a detent worth a tick.
    struct Snap {
        let value: Double
        /// True when a magnetic position captured the value — the caller
        /// fires one haptic tick per engagement, never per frame.
        let engaged: Bool
    }

    /// Pull a wall offset toward positions worth landing on.
    ///
    /// Two magnets, both in metres and both converted from a screen-point
    /// capture radius by the caller, so the pull feels the same at every zoom
    /// rather than growing as the plan is magnified.
    ///
    /// `candidates` are alignments worth snapping to — the offsets at which
    /// this wall would sit flush with another. Five-centimetre multiples come
    /// free, because rooms are built to round numbers far more often than not.
    static func snapOffset(
        _ offset: Double,
        candidates: [Double],
        capture: Double,
        alreadyEngaged: Bool
    ) -> Snap {
        // Hysteresis: it takes more movement to escape a detent than to fall
        // into one, so a hovering finger does not flutter in and out.
        let radius = alreadyEngaged ? capture * 1.5 : capture

        var best: Double?
        var bestDistance = radius

        for candidate in candidates {
            let distance = abs(offset - candidate)
            if distance < bestDistance {
                bestDistance = distance
                best = candidate
            }
        }

        let round5 = (offset / 0.05).rounded() * 0.05
        if abs(offset - round5) < bestDistance {
            bestDistance = abs(offset - round5)
            best = round5
        }

        if let best {
            return Snap(value: quantise(best), engaged: true)
        }
        return Snap(value: quantise(offset), engaged: false)
    }

    /// Pull a dragged CORNER so its two walls meet square.
    ///
    /// The owner asked for it in exactly those terms, 18 Aug 2026: *"when we
    /// change the wall, let's say we drop from an angle, and then we wanna
    /// bring it back — when it's exactly ninety degree, I want it to be
    /// magnetic."* Dragging a corner off square is easy; landing back ON
    /// square by eye is not, and a room that is 89.4° reads as square on a
    /// plan while being wrong in every figure derived from it.
    ///
    /// **Thales' circle.** The set of points at which the angle subtended by
    /// the two neighbours is exactly 90° is the circle whose DIAMETER is the
    /// segment joining them — that is the whole locus, not an approximation
    /// of it, so snapping to the nearest point on that circle is exactly
    /// "make this corner square" and nothing else.
    ///
    /// The first attempt at this (build 111) got the geometry wrong in a way
    /// worth recording, because it looked plausible: it took the
    /// perpendicular foot from each NEIGHBOUR, which squares the angle at
    /// the neighbour rather than at the corner under the finger. The owner
    /// reported it simply as "not working", and it genuinely never fired for
    /// the case he was doing — pulling one corner of a rectangle back into
    /// square.
    ///
    /// Returns the point unchanged when the circle is further than `capture`,
    /// so a deliberately angled wall is never fought. `capture` is metres,
    /// the caller converting from a screen radius exactly as `snapOffset`'s
    /// is, so the pull feels identical at every zoom.
    static func snapCornerSquare(
        _ polygon: [CGPoint], index: Int, to proposed: CGPoint, capture: Double,
        alreadyEngaged: Bool
    ) -> Snap2 {
        let n = polygon.count
        guard n >= 3, index >= 0, index < n else {
            return Snap2(point: proposed, engaged: false)
        }
        // Same hysteresis rule `snapOffset` uses: harder to leave a detent
        // than to fall into one, so a hovering finger does not flutter.
        let radius = alreadyEngaged ? capture * 1.5 : capture

        let prev = polygon[(index - 1 + n) % n]
        let next = polygon[(index + 1) % n]

        let centre = CGPoint(x: (prev.x + next.x) / 2, y: (prev.y + next.y) / 2)
        let circleR = length(sub(next, prev)) / 2
        guard circleR > 0.05 else { return Snap2(point: proposed, engaged: false) }

        let out = sub(proposed, centre)
        let d = length(out)
        // Dead centre: every direction is equally square, so there is no
        // one nearest point and nothing sensible to snap to.
        guard d > 1e-6 else { return Snap2(point: proposed, engaged: false) }

        // How far the finger is from the circle itself, not from its centre.
        let gap = abs(d - circleR)
        guard gap < radius else { return Snap2(point: proposed, engaged: false) }

        let onCircle = CGPoint(
            x: centre.x + out.x / d * circleR,
            y: centre.y + out.y / d * circleR)
        return Snap2(
            point: CGPoint(x: quantise(onCircle.x), y: quantise(onCircle.y)), engaged: true)
    }

    /// A snapped POINT and whether a magnet caught it — the two-dimensional
    /// counterpart to `Snap`, which carries a single offset.
    struct Snap2 {
        let point: CGPoint
        let engaged: Bool
    }

    // MARK: - Objects against walls (S8)

    /// An object snapped flush to a wall: where it sits, which way it faces,
    /// and which wall caught it.
    struct ObjectSnap {
        let centre: CGPoint
        /// Degrees clockwise, the same convention `ObjectCatalog.footprint`
        /// and `room_objects.rotation` use.
        let rotation: Double
        let engaged: Bool
        /// The wall it snapped to, so a caller can tell the elevation which
        /// face this thing belongs on.
        let edge: Int?
    }

    /// Pull a dragged object flush against the nearest wall.
    ///
    /// The owner's ask, plainly: *"objects and toilets need to snap to the
    /// wall."* Which is how they are actually installed — a vanity, a
    /// toilet, a run of base cabinets all sit with their backs to a wall,
    /// and dragging one into place by eye leaves a two-centimetre gap that
    /// is wrong on the plan and wrong in the elevation.
    ///
    /// Snapping sets BOTH position and rotation, because "against the wall"
    /// means square to it: a cabinet at 3° off a wall is not a cabinet
    /// anybody installed. The object's own +depth axis is turned to face
    /// INTO the room, so its back is what meets the wall.
    ///
    /// The magnet is on the BACK EDGE, not the centre — `depth / 2` in from
    /// the centre — so a deep vanity and a shallow one both catch at the
    /// same distance from the wall rather than the deep one catching first.
    ///
    /// Slid along the wall it stays put: only the perpendicular is snapped,
    /// and the position along the run is the operator's, clamped so the
    /// object cannot hang off the end of the wall it is against.
    /// Half the wall band, which is what "flush" actually means.
    ///
    /// **The bug this constant fixes**, reported on build 127 with a
    /// screenshot: *"it looks like it's going inside of the wall."* It was.
    /// A room's `corners` are the wall's CENTRELINE, but a wall is drawn as
    /// a band of `OpeningGlyphs.bandT` straddling that line — so an object
    /// snapped flush to the centreline overlaps the inner face by half the
    /// wall's thickness. On a 114mm stud wall that is 57mm of toilet inside
    /// the drywall.
    ///
    /// The face an object actually stands against is half a band INBOARD of
    /// the line, and that is what this offsets by.
    static let wallFaceInset = OpeningGlyphs.bandT / 2

    static func snapObjectToWall(
        _ polygon: [CGPoint], centre: CGPoint, width: Double, depth: Double,
        capture: Double, alreadyEngaged: Bool
    ) -> ObjectSnap {
        guard polygon.count >= 3 else {
            return ObjectSnap(centre: centre, rotation: 0, engaged: false, edge: nil)
        }
        // Same hysteresis the wall and corner magnets use: harder to leave a
        // detent than to fall into one, so a hovering finger does not
        // flutter between snapped and free.
        let radius = alreadyEngaged ? capture * 1.5 : capture
        let winding = polygonWinding(polygon)

        var best: ObjectSnap?
        var bestGap = radius

        for i in polygon.indices {
            let (ai, bi) = edgeCorners(i, count: polygon.count)
            let a = polygon[ai]
            let b = polygon[bi]
            let run = length(sub(b, a))
            guard run > 0.1 else { continue }
            let d = normalised(sub(b, a))
            // Interior side. Taken from the winding rather than from a
            // centroid test, for the reason `drawWallDimensions` documents:
            // an L-shaped room has walls whose outside faces the centroid.
            let inward = CGPoint(x: -winding * d.y, y: winding * d.x)

            let offset = sub(centre, a)
            let along = dot(offset, d)
            let across = dot(offset, inward)

            // Behind the wall, or nowhere near its run — not this wall.
            guard across > -0.05, along > -width / 2, along < run + width / 2 else { continue }

            // Flush against the wall's inner FACE, not its centreline —
            // see `wallFaceInset`.
            let restAt = depth / 2 + Self.wallFaceInset
            let gap = abs(across - restAt)
            guard gap < bestGap else { continue }

            // Square to the wall, back against it. `footprint` maps local
            // +y through a +90° turn, so aligning local +x with the wall
            // direction puts local +y on the inward normal exactly when the
            // winding is positive; the half turn fixes the other case.
            let heading = atan2(d.y, d.x) * 180 / .pi + (winding > 0 ? 0 : 180)
            let clamped = min(max(along, width / 2), max(run - width / 2, width / 2))

            bestGap = gap
            best = ObjectSnap(
                centre: CGPoint(
                    x: a.x + d.x * clamped + inward.x * restAt,
                    y: a.y + d.y * clamped + inward.y * restAt),
                rotation: heading.truncatingRemainder(dividingBy: 360),
                engaged: true,
                edge: i)
        }

        return best ?? ObjectSnap(centre: centre, rotation: 0, engaged: false, edge: nil)
    }

    /// +1 when the polygon is wound so the interior lies to the LEFT of each
    /// directed edge, -1 otherwise. Shared with `EditorChrome.winding`,
    /// which computes the same thing for the same reason; this copy is here
    /// so the geometry does not have to import a view file.
    static func polygonWinding(_ polygon: [CGPoint]) -> Double {
        // The SHOELACE, and the same sign convention as
        // `EditorChrome.winding` — deliberately identical, because the
        // inward normal derived here has to agree with the outward normal
        // that file draws dimensions along. Two windings with opposite
        // signs would put every snapped object through the wall.
        var shoelace = 0.0
        for i in polygon.indices {
            let p = polygon[i]
            let q = polygon[(i + 1) % polygon.count]
            shoelace += p.x * q.y - q.x * p.y
        }
        return shoelace >= 0 ? 1 : -1
    }

    /// Perpendicular distances at which the dragged wall would line up with
    /// each other wall running the same way — the "flush with that wall"
    /// magnets.
    static func collinearCandidates(_ polygon: [CGPoint], index: Int) -> [Double] {
        let n = polygon.count
        guard n >= 3, index >= 0, index < n else { return [] }
        let (a, b) = edgeCorners(index, count: n)
        let direction = normalised(sub(polygon[b], polygon[a]))
        let sideways = normal(direction)

        var out: [Double] = []
        for other in 0..<n where other != index {
            let (oa, ob) = edgeCorners(other, count: n)
            let otherDirection = normalised(sub(polygon[ob], polygon[oa]))
            // Only walls running the same way can be lined up with.
            guard abs(cross(direction, otherDirection)) < 0.07 else { continue }
            out.append(dot(sub(polygon[oa], polygon[a]), sideways))
        }
        return out
    }
}

// MARK: - Objects that belong to a wall

extension PlanEditing {
    /// Where an object sits RELATIVE TO A WALL, so it can be put back on that
    /// wall after the wall has moved.
    ///
    /// **The owner, 19 Aug 2026:** *"let's say sometime I have a fridge on the
    /// wall, and I'm bringing wall down. This fridge is stuck to the wall. It
    /// needs to move with the wall. But in my case, it just stays outside, and
    /// we have to move things around again."* Confirmed against the reference
    /// the same evening: pulling a kitchen's right wall in by 0.385 m carried
    /// the fridge with it, still flush, and re-split the door chain on the
    /// wall above.
    ///
    /// An object stores a position in the room, not a host wall — deliberately,
    /// since a cabinet in the middle of a floor belongs to no wall. So the
    /// anchor is DERIVED at the moment a drag starts, and only for objects
    /// actually against a wall. Everything else stays exactly where it is,
    /// which is the right answer for an island or a table.
    struct WallAnchor {
        let edge: Int
        /// Metres along the wall from its first corner. Absolute rather than
        /// fractional: a wall being dragged changes its NEIGHBOURS' lengths,
        /// and a fridge two metres from the corner should still be two metres
        /// from that corner afterwards, not two-thirds of a longer wall.
        let along: Double
        /// Metres out from the wall's line, signed along the wall's normal —
        /// what keeps the object flush rather than re-centring it.
        let offset: Double
        /// The object's heading relative to the wall's own direction, so a
        /// wall dragged out of square turns the object with it.
        let turn: Double
    }

    /// The wall an object is standing against, if any.
    ///
    /// `reach` is how far from a wall still counts as "against" it — the
    /// caller passes the object's own half-depth plus a little, so a wide
    /// cabinet is caught by the wall it touches and a table in the middle of
    /// the room is caught by nothing.
    static func wallAnchor(
        centre: CGPoint, rotation: Double, reach: Double, polygon: [CGPoint]
    ) -> WallAnchor? {
        guard polygon.count >= 3 else { return nil }
        var best: WallAnchor?
        var bestDistance = reach

        for i in polygon.indices {
            let (ai, bi) = edgeCorners(i, count: polygon.count)
            let a = polygon[ai]
            let b = polygon[bi]
            let length = self.length(sub(b, a))
            guard length > 0.05 else { continue }
            let direction = normalised(sub(b, a))
            let sideways = normal(direction)

            let relative = sub(centre, a)
            let along = dot(relative, direction)
            // Past either end is not "against this wall" — without this, the
            // wall opposite a narrow room would claim an object standing at
            // the far corner of a different one.
            guard along >= -0.05, along <= length + 0.05 else { continue }

            let offset = dot(relative, sideways)
            guard abs(offset) < bestDistance else { continue }
            bestDistance = abs(offset)
            best = WallAnchor(
                edge: i, along: along, offset: offset,
                turn: rotation - direction.angleDegrees)
        }
        return best
    }

    /// Put an anchored object back on its wall, wherever that wall is now.
    static func placed(_ anchor: WallAnchor, on polygon: [CGPoint])
        -> (centre: CGPoint, rotation: Double)?
    {
        guard polygon.count >= 3, anchor.edge < polygon.count else { return nil }
        let (ai, bi) = edgeCorners(anchor.edge, count: polygon.count)
        let a = polygon[ai]
        let b = polygon[bi]
        guard length(sub(b, a)) > 0.05 else { return nil }
        let direction = normalised(sub(b, a))
        let sideways = normal(direction)
        return (
            CGPoint(
                x: a.x + direction.x * anchor.along + sideways.x * anchor.offset,
                y: a.y + direction.y * anchor.along + sideways.y * anchor.offset),
            anchor.turn + direction.angleDegrees
        )
    }
}

extension CGPoint {
    /// This vector's heading in degrees clockwise from +x — the same
    /// convention `RoomObject.rotation` is stored in.
    fileprivate var angleDegrees: Double { atan2(y, x) * 180 / .pi }
}
