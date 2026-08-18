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
        case windowStandard
        case windowWide
        case windowSmall

        /// Which of the geometry's three arrays this lands in downstream.
        enum Category { case door, window, passage }

        var category: Category {
            switch self {
            case .doorSingle, .doorDouble, .doorSliding: return .door
            case .doorCased: return .passage
            case .windowStandard, .windowWide, .windowSmall: return .window
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
