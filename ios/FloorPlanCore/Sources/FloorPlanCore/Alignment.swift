import Foundation

/// Rooms side by side on a floor (spec §12, M7, T13).
///
/// Everything here works in FLOOR coordinates — each room's corners already
/// carried through its own transform — because two rooms can only be
/// compared in one frame.
public struct AlignmentTuning: Codable, Sendable {
    /// Walls this close to anti-parallel can snap together. Degrees.
    public var parallelDegrees: Double = 3
    /// …and this close (the gap to close), metres — about one wall thickness
    /// (§4 `wallSnap`).
    public var wallSnap: Meters = 0.10
    /// Two walls are SHARED once they overlap at least this much along their
    /// length.
    public var sharedOverlap: Meters = 0.30
    /// How close two faces must be to count as the same wall (flush) or as
    /// the two faces of one partition (`partition` apart).
    public var sharedTolerance: Meters = 0.01

    public init() {}
}

/// Where a dragged room should land so one of its walls sits against a
/// neighbour's.
public struct PlacementSnap: Equatable, Sendable {
    /// Turn the moving room by this much (radians, counter-clockwise) about
    /// `pivot`, THEN move it by `translation`.
    public var rotation: Double
    public var pivot: Vec2
    public var translation: Vec2
    /// Which walls met: (moving room's wall, neighbour index, neighbour's wall).
    public var wall: Int
    public var neighbour: Int
    public var neighbourWall: Int
    /// What the snap closed, metres — for "snapped 6 cm" feedback.
    public var gapClosed: Meters
}

public struct SharedWall: Equatable, Sendable {
    public var roomA: Int
    public var wallA: Int
    public var roomB: Int
    public var wallB: Int
    /// Along the walls, metres.
    public var overlap: Meters
}

public enum Alignment {

    /// The best snap for a room being dragged (§12 placement snap): among
    /// every pair of walls — one of its, one a neighbour's — that are
    /// anti-parallel within 3°, overlap along their length, and are within
    /// `wallSnap` of the target gap, the one needing the smallest move.
    ///
    /// `gap` is the spacing to leave: 0 puts the faces together (the spec's
    /// default, T13), one wall thickness leaves room for an interior
    /// partition between two inside-face outlines.
    public static func snap(
        moving: [Vec2], neighbours: [[Vec2]], gap: Meters = 0,
        tuning: AlignmentTuning = AlignmentTuning()
    ) -> PlacementSnap? {
        let tol = tuning.parallelDegrees * .pi / 180
        var best: PlacementSnap?
        var bestMove: Double?
        for i in moving.indices {
            let a0 = moving[i], a1 = moving[(i + 1) % moving.count]
            let la = a0.distance(to: a1)
            guard la > 1e-9 else { continue }
            for (k, other) in neighbours.enumerated() {
                for j in other.indices {
                    let b0 = other[j], b1 = other[(j + 1) % other.count]
                    let lb = b0.distance(to: b1)
                    guard lb > 1e-9 else { continue }
                    let ua = (a1 - a0) * (1 / la), ub = (b1 - b0) * (1 / lb)
                    // Anti-parallel: two rooms meeting at a wall run it in
                    // opposite directions round their outlines.
                    let angle = atan2(ua.cross(ub * -1), ua.dot(ub * -1))
                    guard abs(angle) <= tol else { continue }

                    // Turn the moving wall exactly anti-parallel, about its
                    // own middle, and measure again from there.
                    let pivot = (a0 + a1) * 0.5
                    let r0 = rotate(a0, by: angle, about: pivot), r1 = rotate(a1, by: angle, about: pivot)

                    // Overlap along the neighbour's wall.
                    let t0 = (r0 - b0).dot(ub), t1 = (r1 - b0).dot(ub)
                    let overlap = min(max(t0, t1), lb) - max(min(t0, t1), 0)
                    guard overlap > 0 else { continue }

                    // The neighbour's OUTWARD side is where the moving room
                    // belongs: the side the moving wall's middle is on.
                    var n = Vec2(-ub.y, ub.x)
                    let side = (pivot - b0).dot(n)
                    if side < 0 { n = n * -1 }
                    let distance = abs(side)
                    let error = distance - gap
                    guard abs(error) <= tuning.wallSnap + 1e-12 else { continue }
                    // How far the room has to move for this one: the slide,
                    // plus how far the turn swings the wall's ends.
                    let move = abs(error) + abs(angle) * la / 2
                    if let b = bestMove, b <= move { continue }
                    bestMove = move
                    best = PlacementSnap(
                        rotation: angle, pivot: pivot, translation: n * -error,
                        wall: i, neighbour: k, neighbourWall: j, gapClosed: error)
                }
            }
        }
        return best
    }

    /// Apply a snap to the moving room's corners.
    public static func apply(_ snap: PlacementSnap, to points: [Vec2]) -> [Vec2] {
        points.map { rotate($0, by: snap.rotation, about: snap.pivot) + snap.translation }
    }

    /// Every pair of walls, in different rooms, that are the same wall seen
    /// from both sides (§12): anti-parallel within 3°, their faces `gap`
    /// apart (0 flush, or one partition), overlapping ≥ 0.30 m.
    public static func sharedWalls(
        _ rooms: [[Vec2]], gap: Meters = 0, tuning: AlignmentTuning = AlignmentTuning()
    ) -> [SharedWall] {
        let tol = tuning.parallelDegrees * .pi / 180
        var out: [SharedWall] = []
        for a in rooms.indices {
            for b in rooms.indices where b > a {
                for i in rooms[a].indices {
                    let a0 = rooms[a][i], a1 = rooms[a][(i + 1) % rooms[a].count]
                    let la = a0.distance(to: a1)
                    guard la > 1e-9 else { continue }
                    let ua = (a1 - a0) * (1 / la)
                    for j in rooms[b].indices {
                        let b0 = rooms[b][j], b1 = rooms[b][(j + 1) % rooms[b].count]
                        let lb = b0.distance(to: b1)
                        guard lb > 1e-9 else { continue }
                        let ub = (b1 - b0) * (1 / lb)
                        guard abs(atan2(ua.cross(ub * -1), ua.dot(ub * -1))) <= tol else { continue }
                        let n = Vec2(-ub.y, ub.x)
                        let mid = (a0 + a1) * 0.5
                        guard abs(abs((mid - b0).dot(n)) - gap) <= tuning.sharedTolerance else { continue }
                        let t0 = (a0 - b0).dot(ub), t1 = (a1 - b0).dot(ub)
                        let overlap = min(max(t0, t1), lb) - max(min(t0, t1), 0)
                        guard overlap >= tuning.sharedOverlap - 1e-9 else { continue }
                        out.append(SharedWall(roomA: a, wallA: i, roomB: b, wallB: j, overlap: overlap))
                    }
                }
            }
        }
        return out
    }

    // MARK: - Floor totals

    /// Σ room areas (§12 net).
    public static func netArea(_ rooms: [Room]) -> Double { rooms.reduce(0) { $0 + $1.area } }

    /// The area of the union of every room, each grown outward by half the
    /// wall thickness (§12 gross). A partition between two rooms is counted
    /// once — each side grows into it — and two rooms placed flush overlap
    /// in their growth, which the union counts once.
    public static func grossArea(_ rooms: [[Vec2]], wallThickness: Meters) -> Double {
        let grown = rooms.filter { $0.count >= 3 }.map { offset($0, by: wallThickness / 2) }
        return unionArea(grown)
    }

    /// A polygon grown outward by `d` (mitred corners), either winding.
    public static func offset(_ p: [Vec2], by d: Meters) -> [Vec2] {
        let n = p.count
        guard n >= 3, d != 0 else { return p }
        // Outward is right of travel when counter-clockwise, left when not.
        let s: Double = Polygon.isCounterClockwise(p) ? 1 : -1
        func outward(_ i: Int) -> Vec2 {
            let a = p[i], b = p[(i + 1) % n]
            let u = (b - a) * (1 / max(a.distance(to: b), 1e-12))
            return Vec2(u.y, -u.x) * s
        }
        return (0..<n).map { i in
            let prev = (i - 1 + n) % n
            let n1 = outward(prev), n2 = outward(i)
            // The corner moves along the bisector far enough that both walls
            // move by exactly d: d / cos(half the turn).
            let bis = n1 + n2
            let len = bis.length
            guard len > 1e-9 else { return p[i] + n2 * d }
            let unit = bis * (1 / len)
            let cosHalf = max(unit.dot(n2), 0.2)
            return p[i] + unit * (d / cosHalf)
        }
    }

    /// Exact area of a union of simple polygons, by sweeping a line across y
    /// and integrating the length of the union of their spans. Between two
    /// "events" — every vertex height and every height where two edges cross —
    /// each polygon's span is linear in y, so the union length is too, and
    /// its value at the middle of the slab times the slab's height is exact.
    public static func unionArea(_ polygons: [[Vec2]]) -> Double {
        let edges: [(Vec2, Vec2)] = polygons.flatMap { p in p.indices.map { (p[$0], p[($0 + 1) % p.count]) } }
        var ys = Set(polygons.flatMap { $0.map(\.y) })
        for i in edges.indices {
            for j in edges.indices where j > i {
                if let y = crossingY(edges[i], edges[j]) { ys.insert(y) }
            }
        }
        let levels = ys.sorted()
        var total = 0.0
        for k in 0..<max(levels.count - 1, 0) {
            let y0 = levels[k], y1 = levels[k + 1]
            guard y1 - y0 > 1e-12 else { continue }
            let y = (y0 + y1) / 2
            // Each polygon's inside along this line, as x intervals.
            var spans: [(Double, Double)] = []
            for p in polygons {
                var xs: [Double] = []
                for i in p.indices {
                    let a = p[i], b = p[(i + 1) % p.count]
                    if (a.y > y) != (b.y > y) { xs.append(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x)) }
                }
                xs.sort()
                var m = 0
                while m + 1 < xs.count {
                    spans.append((xs[m], xs[m + 1]))
                    m += 2
                }
            }
            spans.sort { $0.0 < $1.0 }
            var covered = 0.0
            var cur: (Double, Double)?
            for s in spans {
                if let c = cur, s.0 <= c.1 {
                    cur = (c.0, max(c.1, s.1))
                } else {
                    if let c = cur { covered += c.1 - c.0 }
                    cur = s
                }
            }
            if let c = cur { covered += c.1 - c.0 }
            total += covered * (y1 - y0)
        }
        return total
    }

    static func crossingY(_ e: (Vec2, Vec2), _ f: (Vec2, Vec2)) -> Double? {
        let r = e.1 - e.0, s = f.1 - f.0
        let den = r.cross(s)
        guard abs(den) > 1e-15 else { return nil }
        let t = (f.0 - e.0).cross(s) / den
        let u = (f.0 - e.0).cross(r) / den
        guard t > 1e-12, t < 1 - 1e-12, u > 1e-12, u < 1 - 1e-12 else { return nil }
        return e.0.y + r.y * t
    }

    static func rotate(_ p: Vec2, by angle: Double, about c: Vec2) -> Vec2 {
        guard angle != 0 else { return p }
        let d = p - c
        return Vec2(c.x + d.x * cos(angle) - d.y * sin(angle), c.y + d.x * sin(angle) + d.y * cos(angle))
    }
}
