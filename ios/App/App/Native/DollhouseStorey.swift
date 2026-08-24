import CoreGraphics
import Foundation

/// **The storey as one building.**
///
/// The owner, 24 Aug 2026, against magicplan's 3D: *"I want like theirs, one
/// continuous build."*
///
/// Until now every room built its own shell — its own floor, its own four
/// walls — and the storey was a set of islands standing side by side. Where
/// two rooms share a wall, that wall got drawn TWICE: once on each room's
/// own boundary, a few centimetres apart, with a sliver of nothing between
/// them. At any angle it reads as two thin walls with a gap, which is why
/// the model never knitted into a plan the way the reference does.
///
/// A party wall is one wall. This module is what turns per-room walls into
/// the storey's single wall network:
///
///   1. every room's walls are lifted into STOREY metres (its own plan
///      coordinates plus where the room sits on the floor),
///   2. walls that run alongside each other — near-parallel, within a
///      plausible wall thickness, actually overlapping — are collected into
///      one cluster,
///   3. each cluster becomes ONE wall on the mid-line between its members,
///      as thick as the gap they straddle, cut by the openings of every
///      room that contributed to it.
///
/// The last clause is the one that matters most: a doorway between two rooms
/// is recorded twice, once in each room, and a merged wall that only knew
/// about one of them would wall the other room's door shut.
///
/// The twin discipline is the one `FloorPlanGeometry` already follows — the
/// scan's own geometry is never edited, only read; everything here is a
/// drawing decision made at build time.
@available(iOS 17.0, *)
enum DollhouseStorey {

    /// One wall of the storey, in storey metres.
    struct Wall {
        var a: CGPoint
        var b: CGPoint
        /// How thick to build it: the gap the merged walls straddled, or the
        /// standard partition when nothing merged.
        var thickness: Double
        /// The tallest contributing room — a party wall between a room and a
        /// stairwell belongs to the taller of the two.
        var height: Double
        var holes: [Hole]

        var length: Double { hypot(b.x - a.x, b.y - a.y) }
    }

    /// A hole in a wall, positioned along its run rather than in the world:
    /// `start`/`end` are metres from end `a`, `sill`/`head` are heights.
    struct Hole {
        var start: Double
        var end: Double
        var sill: Double
        var head: Double
    }

    /// An opening lifted into storey metres, before it is matched to a wall.
    struct Opening {
        var a: CGPoint
        var b: CGPoint
        var sill: Double
        var head: Double
    }

    /// A wall lifted into storey metres, before it is merged.
    struct Piece {
        var a: CGPoint
        var b: CGPoint
        var height: Double
    }

    // MARK: - Tolerances
    //
    // Every one of these is a statement about buildings, not about floating
    // point, so each says what it means in metres.

    /// ~5°. Two walls further out of parallel than this are a corner, not a
    /// party wall, and merging them would swing a wall across a room.
    private static let parallelTolerance = 0.09
    /// The widest gap two room boundaries may straddle and still be called
    /// one wall. A stud partition is 90 mm and a party wall between two
    /// units can reach 300; beyond 450 they are two walls with something
    /// between them, and that something is usually a service shaft.
    private static let maxPartyGap = 0.45
    /// How much two walls must actually run alongside each other. Below
    /// this they merely touch at a corner.
    private static let minOverlap = 0.35
    /// Standard partition, when a wall has no twin to measure against.
    private static let defaultThickness = 0.09
    /// The widest a merged wall is allowed to be drawn, however far apart
    /// its members were — a scan with a metre of drift should not produce a
    /// wall you could sleep on.
    private static let maxThickness = 0.4

    // MARK: - The network

    /// Every wall of the storey, merged, with its openings already cut.
    static func network(pieces: [Piece], openings: [Opening]) -> [Wall] {
        let clusters = cluster(pieces)
        return clusters.compactMap { members in
            guard var wall = merge(members) else { return nil }
            wall.holes = holes(on: wall, openings: openings)
            return wall
        }
    }

    /// Group walls that are the same wall seen from different rooms.
    ///
    /// Union-find rather than pairwise merging: a corridor wall may be the
    /// party wall of three rooms in a row, and merging pairs greedily would
    /// leave the third one standing on its own.
    private static func cluster(_ pieces: [Piece]) -> [[Piece]] {
        var parent = Array(pieces.indices)
        func find(_ i: Int) -> Int {
            var root = i
            while parent[root] != root { root = parent[root] }
            var walk = i
            while parent[walk] != walk {
                let next = parent[walk]
                parent[walk] = root
                walk = next
            }
            return root
        }
        func union(_ i: Int, _ j: Int) {
            let a = find(i), b = find(j)
            if a != b { parent[a] = b }
        }

        for i in pieces.indices {
            for j in (i + 1)..<pieces.count where sameWall(pieces[i], pieces[j]) {
                union(i, j)
            }
        }

        var groups: [Int: [Piece]] = [:]
        for (index, piece) in pieces.enumerated() {
            groups[find(index), default: []].append(piece)
        }
        return Array(groups.values)
    }

    /// Are these two the same wall, seen from either side?
    static func sameWall(_ p: Piece, _ q: Piece) -> Bool {
        let (pdx, pdy) = (p.b.x - p.a.x, p.b.y - p.a.y)
        let (qdx, qdy) = (q.b.x - q.a.x, q.b.y - q.a.y)
        let pLength = hypot(pdx, pdy), qLength = hypot(qdx, qdy)
        guard pLength > 0.02, qLength > 0.02 else { return false }
        let ux = pdx / pLength, uy = pdy / pLength
        let vx = qdx / qLength, vy = qdy / qLength

        // Near-parallel, either direction — a wall drawn from the far end is
        // still the same wall.
        guard abs(ux * vy - uy * vx) < parallelTolerance else { return false }

        // Perpendicular distance from p's line to q's ends. Both must be
        // close: one end near and the other far is a wall at a slight angle
        // running away, not a twin.
        let d1 = perpendicular(of: q.a, fromLineThrough: p.a, direction: (ux, uy))
        let d2 = perpendicular(of: q.b, fromLineThrough: p.a, direction: (ux, uy))
        guard abs(d1) < maxPartyGap, abs(d2) < maxPartyGap else { return false }

        // And they must genuinely run alongside each other.
        let t1 = along(q.a, from: p.a, direction: (ux, uy))
        let t2 = along(q.b, from: p.a, direction: (ux, uy))
        let overlap = min(max(t1, t2), pLength) - max(min(t1, t2), 0)
        return overlap > minOverlap
    }

    /// One wall from a cluster: the mid-line of its members, spanning
    /// everything they covered between them.
    private static func merge(_ members: [Piece]) -> Wall? {
        guard let first = members.first else { return nil }
        guard members.count > 1 else {
            return Wall(
                a: first.a, b: first.b, thickness: defaultThickness,
                height: first.height, holes: [])
        }

        // A common direction, with every member's sign aligned to the first
        // so opposite-facing twins do not cancel each other out.
        let (fdx, fdy) = (first.b.x - first.a.x, first.b.y - first.a.y)
        let fLength = hypot(fdx, fdy)
        guard fLength > 0.02 else { return nil }
        let fx = fdx / fLength, fy = fdy / fLength

        var sumX = 0.0, sumY = 0.0
        for piece in members {
            var dx = piece.b.x - piece.a.x, dy = piece.b.y - piece.a.y
            let length = hypot(dx, dy)
            guard length > 0.02 else { continue }
            dx /= length
            dy /= length
            if dx * fx + dy * fy < 0 {
                dx = -dx
                dy = -dy
            }
            // Weighted by length: a two-metre wall says more about the
            // direction than a twenty-centimetre stub.
            sumX += dx * length
            sumY += dy * length
        }
        let dirLength = hypot(sumX, sumY)
        guard dirLength > 1e-6 else { return nil }
        let ux = sumX / dirLength, uy = sumY / dirLength

        // The mid-line: run through the centroid of every end.
        var cx = 0.0, cy = 0.0
        var ends: [CGPoint] = []
        for piece in members {
            ends.append(piece.a)
            ends.append(piece.b)
        }
        for point in ends {
            cx += point.x
            cy += point.y
        }
        cx /= Double(ends.count)
        cy /= Double(ends.count)
        let centre = CGPoint(x: cx, y: cy)

        var minT = Double.infinity, maxT = -Double.infinity
        var minPerp = Double.infinity, maxPerp = -Double.infinity
        for point in ends {
            let t = along(point, from: centre, direction: (ux, uy))
            minT = min(minT, t)
            maxT = max(maxT, t)
            let perp = perpendicular(of: point, fromLineThrough: centre, direction: (ux, uy))
            minPerp = min(minPerp, perp)
            maxPerp = max(maxPerp, perp)
        }
        guard maxT > minT else { return nil }

        let spread = maxPerp - minPerp
        let thickness = min(maxThickness, max(defaultThickness, spread))

        return Wall(
            a: CGPoint(x: centre.x + ux * minT, y: centre.y + uy * minT),
            b: CGPoint(x: centre.x + ux * maxT, y: centre.y + uy * maxT),
            thickness: thickness,
            height: members.map(\.height).max() ?? first.height,
            holes: [])
    }

    /// Which openings belong to this wall, as holes along its run.
    ///
    /// Gathered from EVERY room's openings, not one room's: a doorway
    /// between two rooms is recorded on both sides, and a merged wall that
    /// consulted only one of them would wall the other room's door shut.
    /// The tolerance is generous for the same reason `Dollhouse.holes` was —
    /// a detected opening is rarely flush with the wall plane it belongs to,
    /// and here the wall has also moved to the mid-line between two rooms.
    static func holes(on wall: Wall, openings: [Opening]) -> [Hole] {
        let dx = wall.b.x - wall.a.x, dy = wall.b.y - wall.a.y
        let length = hypot(dx, dy)
        guard length > 0.02 else { return [] }
        let ux = dx / length, uy = dy / length
        let reach = wall.thickness / 2 + 0.35

        var found: [Hole] = []
        for opening in openings {
            let p1 = perpendicular(of: opening.a, fromLineThrough: wall.a, direction: (ux, uy))
            let p2 = perpendicular(of: opening.b, fromLineThrough: wall.a, direction: (ux, uy))
            guard abs(p1) < reach, abs(p2) < reach else { continue }
            let t1 = along(opening.a, from: wall.a, direction: (ux, uy))
            let t2 = along(opening.b, from: wall.a, direction: (ux, uy))
            let lo = min(t1, t2), hi = max(t1, t2)
            guard hi > 0.02, lo < length - 0.02, hi - lo > 0.05 else { continue }
            found.append(
                Hole(
                    start: max(0, lo), end: min(length, hi),
                    sill: opening.sill, head: opening.head))
        }

        // Merged: the same doorway arrives from both rooms, a few
        // centimetres apart, and two overlapping holes cut twice — leaving a
        // sliver of wall standing in the middle of the door.
        return coalesce(found)
    }

    /// Fold overlapping holes into one, taking the widest extent of each.
    static func coalesce(_ holes: [Hole]) -> [Hole] {
        let sorted = holes.sorted { $0.start < $1.start }
        var out: [Hole] = []
        for hole in sorted {
            if var last = out.last, hole.start <= last.end + 0.02 {
                last.end = max(last.end, hole.end)
                last.sill = min(last.sill, hole.sill)
                last.head = max(last.head, hole.head)
                out[out.count - 1] = last
            } else {
                out.append(hole)
            }
        }
        return out
    }

    // MARK: - Small geometry

    /// Signed distance from the line through `origin` in `direction`.
    private static func perpendicular(
        of point: CGPoint, fromLineThrough origin: CGPoint, direction: (Double, Double)
    ) -> Double {
        (point.x - origin.x) * -direction.1 + (point.y - origin.y) * direction.0
    }

    /// How far along the direction the point lies.
    private static func along(
        _ point: CGPoint, from origin: CGPoint, direction: (Double, Double)
    ) -> Double {
        (point.x - origin.x) * direction.0 + (point.y - origin.y) * direction.1
    }
}
