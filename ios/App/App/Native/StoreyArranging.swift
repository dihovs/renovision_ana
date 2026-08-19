import CoreGraphics
import Foundation

/// Laying a floor out by hand: the arithmetic behind picking one room up,
/// turning it, and pushing it against another until they sit flush.
///
/// **The owner's ask, 19 Aug 2026:** *"let's say we have two separate rooms,
/// we should be able to hold on it, and it should allow us to move it around
/// and turn it… we should be able to bring them together. And when they're
/// together, they have to have some alignment, logic, maybe some snapping
/// action."*
///
/// Asked what "together" should MEAN, he chose the smaller of the two: the
/// rooms sit flush and their positions are saved, and they stay two separate
/// rooms with two separate areas and two separate wall lists. Nothing merges.
/// That line matters here — this file moves rooms and nothing else. It never
/// rewrites a wall, never marks one interior, never touches an area. A shared
/// wall is a different model and will be its own order.
///
/// Everything is FLOOR metres — polygons arrive with `StoreyRoom.origin`
/// already added, which is the only space in which two rooms can be compared
/// at all.
enum StoreyArranging {

    /// A line drawn while a room is in the air, saying WHY it just jumped:
    /// this edge lines up with that one. Without it a snap is a room moving
    /// on its own, which reads as a bug rather than as help.
    struct Guide: Identifiable, Equatable {
        enum Axis { case vertical, horizontal }
        let id: Int
        let axis: Axis
        /// Floor metres — x for a vertical guide, y for a horizontal one.
        let position: Double
        /// The run of the line, so it reaches both rooms and stops.
        let from: Double
        let to: Double
    }

    struct Result: Equatable {
        /// What to add to the room's position, on top of the finger's own
        /// travel, in floor metres.
        var offset: CGSize = .zero
        var guides: [Guide] = []
        /// A wall landed against a wall — worth a haptic, where a mere
        /// alignment guide is not.
        var flush: Bool = false
    }

    // MARK: - Moving

    /// Where a room being dragged should actually land.
    ///
    /// Two corrections at most, in this order and for this reason: a FLUSH
    /// correction (a wall onto a wall) is what the operator is trying to do,
    /// so it wins outright; an ALIGNMENT correction is then allowed only
    /// along the axis the flush left free, because applying both on the same
    /// axis would undo the flush and leave a visible gap. With no wall in
    /// range, both axes are free and the room lines up with anything on the
    /// sheet.
    ///
    /// `tolerance` is floor metres, and the caller derives it from the zoom —
    /// a fixed number of screen points, so snapping feels the same whether
    /// the whole storey is on screen or one room fills it.
    static func snap(moving: [CGPoint], others: [[CGPoint]], tolerance: Double) -> Result {
        guard moving.count >= 3, !others.isEmpty, tolerance > 0 else { return Result() }
        var result = Result()

        // 1. A wall onto a wall.
        var constrained: CGVector?
        if let flush = flushCorrection(moving: moving, others: others, tolerance: tolerance) {
            result.offset = CGSize(width: flush.vector.dx, height: flush.vector.dy)
            result.flush = true
            constrained = flush.normal
        }

        // 2. Edges and centres lining up, on whatever axis is still free.
        let shifted = moving.map {
            CGPoint(x: $0.x + result.offset.width, y: $0.y + result.offset.height)
        }
        var freeX = true
        var freeY = true
        if let n = constrained {
            // The flush pushed the room along its wall's normal. Correcting
            // again on that same axis is exactly what would pull it back off
            // the wall.
            if abs(n.dx) >= abs(n.dy) { freeX = false } else { freeY = false }
        }

        let box = bounds(shifted)
        var nextGuideID = 0
        var bestX: (delta: Double, guide: Guide)?
        var bestY: (delta: Double, guide: Guide)?

        for other in others {
            let o = bounds(other)

            if freeX {
                for (mine, theirs) in [
                    (Double(box.minX), Double(o.minX)), (Double(box.midX), Double(o.midX)),
                    (Double(box.maxX), Double(o.maxX)),
                ] {
                    let delta = theirs - mine
                    guard abs(delta) <= tolerance else { continue }
                    guard bestX == nil || abs(delta) < abs(bestX!.delta) else { continue }
                    nextGuideID += 1
                    bestX = (
                        delta,
                        Guide(
                            id: nextGuideID, axis: .vertical, position: theirs,
                            from: Double(min(box.minY, o.minY)), to: Double(max(box.maxY, o.maxY)))
                    )
                }
            }

            if freeY {
                for (mine, theirs) in [
                    (Double(box.minY), Double(o.minY)), (Double(box.midY), Double(o.midY)),
                    (Double(box.maxY), Double(o.maxY)),
                ] {
                    let delta = theirs - mine
                    guard abs(delta) <= tolerance else { continue }
                    guard bestY == nil || abs(delta) < abs(bestY!.delta) else { continue }
                    nextGuideID += 1
                    bestY = (
                        delta,
                        Guide(
                            id: nextGuideID, axis: .horizontal, position: theirs,
                            from: Double(min(box.minX, o.minX)), to: Double(max(box.maxX, o.maxX)))
                    )
                }
            }
        }

        if let x = bestX {
            result.offset.width += CGFloat(x.delta)
            result.guides.append(x.guide)
        }
        if let y = bestY {
            result.offset.height += CGFloat(y.delta)
            result.guides.append(y.guide)
        }
        return result
    }

    private struct Flush {
        let vector: CGVector
        /// The wall's own normal — the direction the correction ran along,
        /// which is the axis the alignment pass must then leave alone.
        let normal: CGVector
    }

    /// The smallest push that puts one of this room's walls onto one of
    /// theirs.
    ///
    /// Coincident CENTRELINES, not a wall's thickness apart: a wall is drawn
    /// as a band centred on the polygon outline, so two rooms whose outlines
    /// coincide draw one band and read as a shared wall — which is what
    /// pushing two rooms together is supposed to look like. Leaving a gap of
    /// one thickness would draw two walls with a hairline of paper between
    /// them.
    private static func flushCorrection(
        moving: [CGPoint], others: [[CGPoint]], tolerance: Double
    ) -> Flush? {
        var best: Flush?
        var bestMagnitude = tolerance * 1.0001

        for a in edges(moving) {
            let la = hypot(a.1.x - a.0.x, a.1.y - a.0.y)
            // A stub of a wall is not something anyone is trying to align.
            guard la > 0.3 else { continue }
            let ua = CGVector(dx: (a.1.x - a.0.x) / la, dy: (a.1.y - a.0.y) / la)

            for other in others {
                for b in edges(other) {
                    let lb = hypot(b.1.x - b.0.x, b.1.y - b.0.y)
                    guard lb > 0.3 else { continue }
                    let ub = CGVector(dx: (b.1.x - b.0.x) / lb, dy: (b.1.y - b.0.y) / lb)

                    // Parallel within 4°, and antiparallel counts: two rooms
                    // meeting at a wall have that wall running opposite ways
                    // round their two outlines, always.
                    guard abs(ua.dx * ub.dy - ua.dy * ub.dx) < 0.0698 else { continue }

                    // They have to overlap ALONG the wall. Without this, a
                    // room three metres down the corridor would drag itself
                    // sideways onto a wall it never touches.
                    let t0 = (a.0.x - b.0.x) * ub.dx + (a.0.y - b.0.y) * ub.dy
                    let t1 = (a.1.x - b.0.x) * ub.dx + (a.1.y - b.0.y) * ub.dy
                    let overlap = min(max(t0, t1), lb) - max(min(t0, t1), 0)
                    guard overlap > 0.25 else { continue }

                    let n = CGVector(dx: -ub.dy, dy: ub.dx)
                    let d = (a.0.x - b.0.x) * n.dx + (a.0.y - b.0.y) * n.dy
                    guard abs(d) < bestMagnitude else { continue }
                    bestMagnitude = abs(d)
                    best = Flush(vector: CGVector(dx: -d * n.dx, dy: -d * n.dy), normal: n)
                }
            }
        }
        return best
    }

    // MARK: - Turning

    /// How far a twist should ACTUALLY turn the room.
    ///
    /// The gesture reports a free angle; this lands it somewhere deliberate.
    /// A neighbour's wall angle wins when one is within 6°, because matching
    /// the building you are standing in beats matching the grid. Otherwise
    /// the nearest 15°, which keeps a square room square and still allows the
    /// angled wing that real houses have.
    ///
    /// Snapping is applied to the room's RESULTING orientation, not to the
    /// twist — snapping the twist alone would faithfully preserve whatever
    /// crookedness the room already had.
    static func snappedTwist(baseAngle: Double, twist: Double, neighbourAngles: [Double]) -> Double {
        let quarter = Double.pi / 2
        let target = baseAngle + twist

        /// Everything folded into one quadrant: as far as squareness goes a
        /// wall and the wall opposite it are the same line.
        func fold(_ angle: Double) -> Double {
            let m = angle.truncatingRemainder(dividingBy: quarter)
            return m < 0 ? m + quarter : m
        }

        let mine = fold(target)
        var bestCorrection: Double?

        for neighbour in neighbourAngles {
            var delta = fold(neighbour) - mine
            if delta > quarter / 2 { delta -= quarter }
            if delta < -quarter / 2 { delta += quarter }
            guard abs(delta) <= 6 * .pi / 180 else { continue }
            if bestCorrection == nil || abs(delta) < abs(bestCorrection!) { bestCorrection = delta }
        }

        if bestCorrection == nil {
            let step = 15 * Double.pi / 180
            var delta = (mine / step).rounded() * step - mine
            if delta > quarter / 2 { delta -= quarter }
            if delta < -quarter / 2 { delta += quarter }
            bestCorrection = delta
        }

        return twist + (bestCorrection ?? 0)
    }

    /// The direction of a polygon's longest wall — what `snappedTwist` reads
    /// as the room's current orientation, because the longest wall is the one
    /// a person would say the room "runs along".
    static func longestWallAngle(_ polygon: [CGPoint]) -> Double {
        var best = 0.0
        var bestLength = 0.0
        for edge in edges(polygon) {
            let length = hypot(edge.1.x - edge.0.x, edge.1.y - edge.0.y)
            guard length > bestLength else { continue }
            bestLength = length
            best = atan2(edge.1.y - edge.0.y, edge.1.x - edge.0.x)
        }
        return best
    }

    /// Every wall angle on a floor, for a turning room to match itself to.
    static func wallAngles(_ polygons: [[CGPoint]]) -> [Double] {
        var angles: [Double] = []
        for polygon in polygons {
            for edge in edges(polygon) where hypot(edge.1.x - edge.0.x, edge.1.y - edge.0.y) > 0.3 {
                angles.append(atan2(edge.1.y - edge.0.y, edge.1.x - edge.0.x))
            }
        }
        return angles
    }

    /// A polygon turned about a point.
    static func rotate(_ polygon: [CGPoint], by radians: Double, about pivot: CGPoint) -> [CGPoint] {
        guard radians != 0 else { return polygon }
        let c = cos(radians)
        let s = sin(radians)
        return polygon.map { p in
            let dx = p.x - pivot.x
            let dy = p.y - pivot.y
            return CGPoint(x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c)
        }
    }

    /// The pivot a room turns about.
    ///
    /// The closing point is dropped first. A `Plan.polygon` repeats its first
    /// point to close the loop, and averaging it twice pulls the pivot toward
    /// that one corner — on a 4×3 room, 40cm off centre, which is a room that
    /// visibly walks sideways every time it is twisted.
    static func centroid(_ polygon: [CGPoint]) -> CGPoint {
        var points = polygon
        if points.count > 1, let f = points.first, let l = points.last,
            abs(f.x - l.x) < 1e-9, abs(f.y - l.y) < 1e-9
        {
            points.removeLast()
        }
        guard !points.isEmpty else { return .zero }
        var x = 0.0
        var y = 0.0
        for p in points {
            x += p.x
            y += p.y
        }
        return CGPoint(x: x / Double(points.count), y: y / Double(points.count))
    }

    static func bounds(_ polygon: [CGPoint]) -> CGRect {
        guard let first = polygon.first else { return .zero }
        var minX = first.x
        var maxX = first.x
        var minY = first.y
        var maxY = first.y
        for p in polygon.dropFirst() {
            minX = min(minX, p.x)
            maxX = max(maxX, p.x)
            minY = min(minY, p.y)
            maxY = max(maxY, p.y)
        }
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    /// Closed-loop edges. A `Plan.polygon` may or may not repeat its first
    /// point as its last — both shapes reach here, and a duplicated point
    /// would otherwise contribute a zero-length edge that the length guards
    /// happen to drop but the angle list would not.
    private static func edges(_ polygon: [CGPoint]) -> [(CGPoint, CGPoint)] {
        var points = polygon
        if points.count > 1, let f = points.first, let l = points.last,
            abs(f.x - l.x) < 1e-9, abs(f.y - l.y) < 1e-9
        {
            points.removeLast()
        }
        guard points.count >= 2 else { return [] }
        return points.indices.map { (points[$0], points[($0 + 1) % points.count]) }
    }
}
