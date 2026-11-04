import Foundation

/// Plain polygon maths on corner positions (spec §1, §4, §15 T1–T2, T15–T16).
///
/// Straight walls only. Arc walls (M5) add or subtract their segment area on
/// top of the shoelace here; until then a room's area is its corner polygon.
public enum Polygon {

    /// Signed shoelace area. Positive for counter-clockwise, which is the
    /// orientation every room in this package is stored in.
    public static func signedArea(_ p: [Vec2]) -> Double {
        guard p.count >= 3 else { return 0 }
        var twice = 0.0
        for i in p.indices {
            let a = p[i]
            let b = p[(i + 1) % p.count]
            twice += a.x * b.y - b.x * a.y
        }
        return twice / 2
    }

    public static func area(_ p: [Vec2]) -> Double { abs(signedArea(p)) }

    public static func isCounterClockwise(_ p: [Vec2]) -> Bool { signedArea(p) > 0 }

    /// The closed loop's length, last corner back to the first included.
    public static func perimeter(_ p: [Vec2]) -> Double {
        guard p.count >= 2 else { return 0 }
        var total = 0.0
        for i in p.indices { total += p[i].distance(to: p[(i + 1) % p.count]) }
        return total
    }

    /// Two edges that cross, by index, or nil when the loop is simple.
    ///
    /// Edge i runs corner i → corner i+1. Neighbouring edges share a corner by
    /// construction and are not compared; every other pair must not touch at
    /// all — crossing, touching at a point, or overlapping along a line are
    /// all refused, because each of them makes "the area of this room" mean
    /// two different things.
    public static func firstSelfIntersection(_ p: [Vec2]) -> (Int, Int)? {
        let n = p.count
        guard n >= 4 else { return nil }
        for i in 0..<n {
            for j in (i + 1)..<n {
                // Neighbours, including the wrap-around pair (last, first).
                if j == i + 1 || (i == 0 && j == n - 1) { continue }
                if segmentsTouch(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n]) { return (i, j) }
            }
        }
        return nil
    }

    public static func isSimple(_ p: [Vec2]) -> Bool { firstSelfIntersection(p) == nil }

    /// Do segments ab and cd share any point?
    static func segmentsTouch(_ a: Vec2, _ b: Vec2, _ c: Vec2, _ d: Vec2) -> Bool {
        let eps = 1e-12
        let d1 = (b - a).cross(c - a)
        let d2 = (b - a).cross(d - a)
        let d3 = (d - c).cross(a - c)
        let d4 = (d - c).cross(b - c)
        if ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps))
            && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))
        {
            return true
        }
        // Touching or collinear: an endpoint lying on the other segment.
        func onSegment(_ p: Vec2, _ q: Vec2, _ r: Vec2) -> Bool {
            min(p.x, q.x) - eps <= r.x && r.x <= max(p.x, q.x) + eps
                && min(p.y, q.y) - eps <= r.y && r.y <= max(p.y, q.y) + eps
        }
        if abs(d1) <= eps && onSegment(a, b, c) { return true }
        if abs(d2) <= eps && onSegment(a, b, d) { return true }
        if abs(d3) <= eps && onSegment(c, d, a) { return true }
        if abs(d4) <= eps && onSegment(c, d, b) { return true }
        return false
    }
}

extension Room {

    public var signedArea: Double { Polygon.signedArea(points) }
    /// Floor area in m². Straight walls only until M5 adds arc segments.
    public var area: Double { Polygon.area(points) }
    public var perimeter: Double { Polygon.perimeter(points) }
    public var isSimple: Bool { Polygon.isSimple(points) }

    /// The chord length of wall i.
    public func wallLength(_ i: Int) -> Meters {
        points[i].distance(to: points[(i + 1) % corners.count])
    }

    /// The same room, counter-clockwise (§1: "inputs with negative area get
    /// reversed"). Unchanged when it already is.
    ///
    /// Reversing is more than flipping the corner list, because three things
    /// are defined BY the direction of travel and each must follow:
    /// - which wall sits between which corners — wall i must still run
    ///   corner i → i+1 in the new order, so walls are re-indexed;
    /// - an arc's sagitta, whose sign means "bulges to the RIGHT of the wall's
    ///   direction" — reversing the direction swaps right for left;
    /// - an opening's offset, measured from the wall's START — the old start
    ///   is the new end, so the offset is taken from the other end.
    public func counterClockwise() -> Room {
        guard corners.count >= 3, signedArea < 0 else { return self }
        let n = corners.count
        var out = self
        out.corners = Array(corners.reversed())
        // New corner k is old corner n-1-k, so new wall k (k → k+1) is the
        // old wall between old corners n-2-k and n-1-k: old wall n-2-k.
        out.walls = (0..<n).map { k in
            var wall = walls[((n - 2 - k) % n + n) % n]
            if case .arc(let s) = wall.shape { wall.shape = .arc(sagitta: -s) }
            return wall
        }
        let lengths = Dictionary(
            uniqueKeysWithValues: walls.indices.map { (walls[$0].id, wallLength($0)) })
        out.openings = openings.map { opening in
            var o = opening
            if let chord = lengths[o.wallID] { o.offset = chord - o.offset - o.width }
            return o
        }
        return out
    }
}
