import Foundation

/// **Set Diagonal** — a measured distance between two corners that are not
/// on the same wall (Magicplan-Screen-Spec: tap a corner, `Set Diagonal`,
/// tap the opposite corner; the value locks like a typed wall and "pins
/// corner angles in out-of-square rooms").
///
/// Four walls measured by tape do not fix a room's shape: a 4 × 3 m outline
/// can lean into any parallelogram with the same sides. One diagonal does
/// fix it, which is why an out-of-square Quebec basement gets measured that
/// way. This solves for the corners that honour every diagonal while each
/// wall keeps its length — so the room bends at its corners, never stretches.
public struct Diagonal: Codable, Hashable, Sendable {
    /// Corner indices, `a < b`, never adjacent (that would be a wall).
    public var a: Int
    public var b: Int
    public var length: Meters

    public init(a: Int, b: Int, length: Meters) {
        self.a = min(a, b)
        self.b = max(a, b)
        self.length = length
    }

    /// Whether two corners of an `n`-corner outline can carry a diagonal.
    public static func allowed(_ i: Int, _ j: Int, count n: Int) -> Bool {
        guard n >= 4, i != j, (0..<n).contains(i), (0..<n).contains(j) else { return false }
        let d = abs(i - j)
        return d != 1 && d != n - 1
    }
}

public enum Diagonals {
    /// The outline moved so every diagonal measures its length, every wall
    /// keeps its present length, and nothing else moves more than it must.
    ///
    /// Weights follow magicplan's solver: a stated length (diagonal) 10 000,
    /// a wall's length 100, a corner staying put 0.01. Corner 0 is held and
    /// corner 1 slides only along wall 0, which removes the free rotation
    /// and translation exactly (2n − 3 unknowns).
    ///
    /// Returns nil when no shape can satisfy them — a diagonal longer than
    /// the walls around it can reach — rather than a room torn to fit.
    public static func apply(_ p0: [Vec2], _ diagonals: [Diagonal]) -> [Vec2]? {
        let n = p0.count
        let usable = diagonals.filter { Diagonal.allowed($0.a, $0.b, count: n) && $0.length > 0 }
        guard n >= 4, !usable.isEmpty else { return p0 }
        let walls = (0..<n).map { p0[$0].distance(to: p0[($0 + 1) % n]) }
        guard walls.allSatisfy({ $0 > 1e-6 }) else { return nil }
        let u = (p0[1] - p0[0]) * (1 / walls[0])
        let sD = 100.0, sW = 10.0, sP = 0.1

        func points(_ q: [Double]) -> [Vec2] {
            var p = p0
            p[1] = p0[0] + u * q[0]
            for i in 2..<n { p[i] = Vec2(q[2 * i - 3], q[2 * i - 2]) }
            return p
        }
        func residuals(_ q: [Double]) -> [Double] {
            let p = points(q)
            var r: [Double] = []
            for d in usable { r.append(sD * (p[d.a].distance(to: p[d.b]) - d.length)) }
            for j in 0..<n { r.append(sW * (p[j].distance(to: p[(j + 1) % n]) - walls[j])) }
            for i in 1..<n {
                r.append(sP * (p[i].x - p0[i].x))
                r.append(sP * (p[i].y - p0[i].y))
            }
            return r
        }
        func cost(_ r: [Double]) -> Double { r.reduce(0) { $0 + $1 * $1 } }

        var q: [Double] = [walls[0]]
        for i in 2..<n { q += [p0[i].x, p0[i].y] }
        var r = residuals(q)
        var c = cost(r)
        var lambda = 1e-3
        let m = q.count
        for _ in 0..<200 {
            let h = 1e-7
            var J = [[Double]](repeating: [Double](repeating: 0, count: m), count: r.count)
            for k in 0..<m {
                var qp = q, qm = q
                qp[k] += h
                qm[k] -= h
                let rp = residuals(qp), rm = residuals(qm)
                for row in 0..<r.count { J[row][k] = (rp[row] - rm[row]) / (2 * h) }
            }
            var H = [[Double]](repeating: [Double](repeating: 0, count: m), count: m)
            var g = [Double](repeating: 0, count: m)
            for row in 0..<r.count {
                let jr = J[row]
                for a in 0..<m where jr[a] != 0 {
                    g[a] += jr[a] * r[row]
                    for b in 0..<m { H[a][b] += jr[a] * jr[b] }
                }
            }
            for a in 0..<m { H[a][a] += lambda * max(H[a][a], 1e-12) }
            guard let dq = Linear.solve(H, g.map { -$0 }) else {
                lambda *= 10
                continue
            }
            let qn = zip(q, dq).map { $0 + $1 }
            let rn = residuals(qn)
            let cn = cost(rn)
            if cn < c {
                q = qn
                r = rn
                c = cn
                lambda /= 10
                if (dq.map(abs).max() ?? 0) < 1e-10 { break }
            } else {
                lambda *= 10
                if lambda > 1e12 { break }
            }
        }
        let p = points(q)
        // Within 5 mm on every diagonal and wall, or it is not a shape that
        // exists — say so instead of drawing one.
        for d in usable where abs(p[d.a].distance(to: p[d.b]) - d.length) > 0.005 { return nil }
        for j in 0..<n where abs(p[j].distance(to: p[(j + 1) % n]) - walls[j]) > 0.005 { return nil }
        return p
    }
}
