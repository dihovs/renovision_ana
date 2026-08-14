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
