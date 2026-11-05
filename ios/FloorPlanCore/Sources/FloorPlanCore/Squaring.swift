import Foundation

/// The angle-squaring solver (spec §5–§6, T6–T7).
///
/// One call squares a whole room at once. Corners the operator drew a few
/// degrees off square are pulled onto exact multiples of 90°; walls whose
/// length was locked (typed, or from a laser) are held to that length almost
/// rigidly; everything else stays as close to the drawing as it can. When the
/// locks and the right angles cannot all hold together, nothing moves — the
/// result is a conflict naming the walls that disagree, and the room is left
/// exactly as it was so the operator can decide which measurement is wrong.
public struct SolverTuning: Codable, Sendable {
    /// A corner within this of 90°, 180° or 270° is squared; further off is a
    /// real angle and is left alone. Degrees.
    public var squareTolDegrees: Double = 10
    /// Residual weights (§6): angles in radians, lengths and anchors in metres.
    public var angleWeight: Double = 1
    public var lengthWeight: Double = 1000
    public var anchorWeight: Double = 0.01
    /// Levenberg–Marquardt control (§6).
    public var lambda0: Double = 1e-3
    public var maxIterations: Int = 50
    public var stepTolerance: Meters = 1e-6
    public var relativeCostTolerance: Double = 1e-10
    /// Acceptance (§6): every locked length within 1 mm, every squared angle
    /// within 0.1°.
    public var lockTolerance: Meters = 0.001
    public var angleToleranceDegrees: Double = 0.1
    /// How many times to re-solve with the anchors moved to the last answer
    /// — see `square`. One round is the spec's solver exactly.
    public var rounds: Int = 6
    /// The spec's gauge (§6): wall 0 keeps its direction. Right for a room
    /// someone DREW, whose first wall is where they put it. For a scan every
    /// wall is a degree or two off, and pinning one makes the rest bend to
    /// it — so the scan path turns this off and lets every corner's anchor
    /// decide the room's orientation together; only corner 0 stays put.
    public var pinFirstWall: Bool = true
    /// magicplan's per-corner tolerances (POLYGON_LOGIC Part B) instead of
    /// one flat `squareTolDegrees`: a near-straight corner 3.5° (15° beside
    /// a "flagged" neighbour), a real corner 7°, a corner at the end of a
    /// wall under 0.5 m 20°. Off by default — the plan editor's Square
    /// button keeps the flat 10° the owner is used to.
    public var perCornerTolerance: Bool = false
    /// Holds every UNLOCKED wall near the length it was drawn at, so the
    /// room's sizes do not drift while its corners square up (magicplan
    /// keeps every wall's measured length in its fit). 0 = off.
    public var drawnLengthWeight: Double = 0
    /// Holds corners that are NOT squared near their drawn angle (magicplan's
    /// weight 1 against 100 for a squared one). 0 = off.
    public var freeAngleWeight: Double = 0

    public init() {}

    /// What magicplan does when a room closes: per-corner tolerances,
    /// squared angles held 100× harder than free ones, and every wall kept
    /// near its drawn length. Their ORDER is kept — squared angles, then free
    /// angles, then lengths — but scaled so a squared corner still lands
    /// within this solver's 0.1° acceptance: at their raw 100 / 1 / 1 a
    /// rough scan settled 2–5° off square and was refused as a conflict
    /// (WallChainTests, 5 Nov 2026). Locks (1000 on metres) still beat
    /// lengths; a locked wall against a right angle still conflicts.
    public static var onClose: SolverTuning {
        var t = SolverTuning()
        t.perCornerTolerance = true
        t.angleWeight = 10_000
        t.freeAngleWeight = 100
        t.drawnLengthWeight = 1
        return t
    }
}

/// One thing the solver could not satisfy, and by how much.
public struct Residual: Equatable, Sendable {
    public enum Kind: Equatable, Sendable {
        /// Wall j's length is off its lock. Value in metres, measured minus locked.
        case length(wall: Int)
        /// Corner i's angle is off its target. Value in degrees.
        case angle(corner: Int)
        /// Walls i and j cross. Value 0.
        case crossing(wall: Int, with: Int)
    }
    public var kind: Kind
    public var value: Double
    /// The wall or corner by id. Indices above count in the COUNTER-CLOCKWISE
    /// room the solver worked on, which is reversed from the caller's when
    /// the caller's was clockwise — the id is what survives that.
    public var wallID: UUID?
    public var cornerID: UUID?
}

public enum SolveResult: Sendable {
    /// The squared room. Corner and wall ids, locks and openings are kept.
    case solved(Room)
    /// Nothing changed; the worst offenders first.
    case conflict(worst: [Residual])
}

public enum Squaring {

    /// The interior angle at corner i of a counter-clockwise loop, in (0, 2π):
    /// θ = atan2(a × b, a · b) with a = c(i+1) − c(i), b = c(i−1) − c(i).
    public static func interiorAngle(_ p: [Vec2], _ i: Int) -> Double {
        let n = p.count
        let a = p[(i + 1) % n] - p[i]
        let b = p[(i - 1 + n) % n] - p[i]
        var t = atan2(a.cross(b), a.dot(b))
        if t <= 0 { t += 2 * .pi }
        return t
    }

    /// Square a room. The room must be closed and counter-clockwise.
    public static func square(_ room: Room, tuning: SolverTuning = SolverTuning()) -> SolveResult {
        let start = room.counterClockwise()
        let p0 = start.points
        let n = p0.count
        guard n >= 3 else { return .solved(room) }

        let targets = angleTargets(start, p0, tuning)
        let locks: [(Int, Meters)] = start.walls.indices.compactMap { j in
            start.walls[j].lockedLength.map { (j, $0) }
        }

        // Solved in rounds, the anchors re-centred on the last round's answer.
        //
        // **A departure from §6, and why.** The anchor term (weight 0.01) keeps
        // corners near the drawing, and it never stops pulling. When a lock
        // forces a real move — a wall drawn at 4.05 m and lasered at 4.20 m
        // has to grow 15 cm, and the opposite wall with it — the anchors
        // resist that move, and the balance left a corner 0.18° off square:
        // a perfectly consistent room failing the spec's own 0.1° acceptance
        // and reported as a conflict. Re-centring removes the pull against a
        // move the lock already made, while still keeping each round near
        // the last. Locks and right angles that genuinely disagree (T7) stay
        // in disagreement however many rounds run, so they still conflict.
        var anchor = p0
        var solved = p0
        var failures: [Residual] = []
        for _ in 0..<tuning.rounds {
            solved = solve(
                p0: anchor, targets: targets, locks: locks, angleWeight: tuning.angleWeight, tuning: tuning,
                drawn: p0)
            failures = check(solved, targets: targets, locks: locks, tuning: tuning)
            if failures.isEmpty { break }
            anchor = solved
        }
        guard failures.isEmpty else {
            let worst = explain(p0: p0, targets: targets, locks: locks, failures: failures, tuning: tuning)
            return .conflict(worst: worst.map { r in
                var r = r
                switch r.kind {
                case .length(let j): r.wallID = start.walls[j].id
                case .angle(let i): r.cornerID = start.corners[i].id
                case .crossing(let j, _): r.wallID = start.walls[j].id
                }
                return r
            })
        }

        var out = start
        for i in 0..<n { out.corners[i].p = solved[i] }
        return .solved(out)
    }

    // MARK: - Targets

    /// Which corners get squared, chosen ONCE from the drawing (§6): a corner
    /// near a multiple of 90° targets it exactly; a user-locked angle uses its
    /// own value; every other corner is free.
    static func angleTargets(_ room: Room, _ p: [Vec2], _ tuning: SolverTuning) -> [(Int, Double)] {
        return room.corners.indices.compactMap { i in
            if let locked = room.corners[i].lockedAngle { return (i, locked) }
            let theta = interiorAngle(p, i)
            let target = (theta / (.pi / 2)).rounded() * (.pi / 2)
            // 0° and 360° are not corners a room can have.
            guard target > 0, target < 2 * .pi else { return nil }
            let degrees = tuning.perCornerTolerance ? cornerTolerance(p, i) : tuning.squareTolDegrees
            guard abs(theta - target) <= degrees * .pi / 180 else { return nil }
            return (i, target)
        }
    }

    /// The turn at corner i in degrees: + left, − right, 0 straight on.
    static func turnDegrees(_ p: [Vec2], _ i: Int) -> Double {
        (.pi - interiorAngle(p, i)) * 180 / .pi
    }

    /// magicplan's snap tolerance for one corner (POLYGON_LOGIC Part B2).
    static func cornerTolerance(_ p: [Vec2], _ i: Int) -> Double {
        let n = p.count
        let prev = (i - 1 + n) % n, next = (i + 1) % n
        let turn = turnDegrees(p, i)
        let quarter = (turn / 90).rounded()
        let wallIn = p[prev].distance(to: p[i])
        let wallOut = p[i].distance(to: p[next])
        // A right angle at the end of a short wall — a jog, a closet return:
        // forgiving, because a short wall's direction is the least certain.
        if abs(quarter) == 1, min(wallIn, wallOut) < 0.5 { return 20 }
        if quarter != 0 { return 7 }
        // Near-straight: a real slight bend is kept unless a neighbour says
        // the wall is ragged anyway.
        let before = turnDegrees(p, prev), after = turnDegrees(p, next)
        let flagged =
            before * after <= 0
            || abs(before) >= 45 || abs(after) >= 45
            || wallIn >= 0.5 || wallOut >= 0.5
        return flagged ? 15 : 3.5
    }

    // MARK: - Solve

    /// Levenberg–Marquardt on the weighted residuals (§6).
    ///
    /// The three rigid-motion freedoms are removed by construction rather than
    /// by a penalty: corner 0 never moves, and corner 1 may only slide along
    /// wall 0's original direction. So the unknowns are that slide plus the
    /// x and y of corners 2…n−1 — 2n − 3 numbers, exactly the shape's own
    /// degrees of freedom (§5).
    static func solve(
        p0: [Vec2], targets: [(Int, Double)], locks: [(Int, Meters)], angleWeight: Double,
        tuning: SolverTuning, drawn: [Vec2]? = nil
    ) -> [Vec2] {
        let drawn = drawn ?? p0
        let squared = Set(targets.map(\.0))
        let lockedWalls = Set(locks.map(\.0))
        let freeAngles: [(Int, Double)] =
            tuning.freeAngleWeight > 0
            ? drawn.indices.filter { !squared.contains($0) }.map { ($0, interiorAngle(drawn, $0)) } : []
        let drawnLengths: [(Int, Double)] =
            tuning.drawnLengthWeight > 0
            ? drawn.indices.filter { !lockedWalls.contains($0) }
                .map { ($0, drawn[$0].distance(to: drawn[($0 + 1) % drawn.count])) } : []
        let sF = tuning.freeAngleWeight.squareRoot()
        let sD = tuning.drawnLengthWeight.squareRoot()
        let n = p0.count
        let u = (p0[1] - p0[0]) * (1 / max(p0[1].distance(to: p0[0]), 1e-12))

        let pin = tuning.pinFirstWall
        func points(_ q: [Double]) -> [Vec2] {
            var p = p0
            if pin {
                p[1] = p0[0] + u * q[0]
                for i in 2..<n { p[i] = Vec2(q[2 * i - 3], q[2 * i - 2]) }
            } else {
                for i in 1..<n { p[i] = Vec2(q[2 * i - 2], q[2 * i - 1]) }
            }
            return p
        }

        let sA = angleWeight.squareRoot()
        let sL = tuning.lengthWeight.squareRoot()
        let sP = tuning.anchorWeight.squareRoot()

        func residuals(_ q: [Double]) -> [Double] {
            let p = points(q)
            var r: [Double] = []
            r.reserveCapacity(targets.count + locks.count + 2 * n)
            for (i, target) in targets { r.append(sA * wrap(interiorAngle(p, i) - target)) }
            for (j, length) in locks { r.append(sL * (p[j].distance(to: p[(j + 1) % n]) - length)) }
            for (i, angle) in freeAngles { r.append(sF * wrap(interiorAngle(p, i) - angle)) }
            for (j, length) in drawnLengths { r.append(sD * (p[j].distance(to: p[(j + 1) % n]) - length)) }
            for i in 1..<n {
                r.append(sP * (p[i].x - p0[i].x))
                r.append(sP * (p[i].y - p0[i].y))
            }
            return r
        }

        func cost(_ r: [Double]) -> Double { r.reduce(0) { $0 + $1 * $1 } }

        var q: [Double] = pin ? [p0[1].distance(to: p0[0])] : []
        for i in (pin ? 2 : 1)..<n { q += [p0[i].x, p0[i].y] }

        var r = residuals(q)
        var c = cost(r)
        var lambda = tuning.lambda0
        let m = q.count

        for _ in 0..<tuning.maxIterations {
            // Numeric Jacobian, central differences.
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
                let drop = (c - cn) / max(c, 1e-300)
                q = qn
                r = rn
                c = cn
                lambda /= 10
                if (dq.map(abs).max() ?? 0) < tuning.stepTolerance || drop < tuning.relativeCostTolerance { break }
            } else {
                lambda *= 10
            }
        }
        return points(q)
    }

    /// An angle difference folded into (−π, π].
    static func wrap(_ a: Double) -> Double {
        var x = a.truncatingRemainder(dividingBy: 2 * .pi)
        if x > .pi { x -= 2 * .pi }
        if x <= -.pi { x += 2 * .pi }
        return x
    }

    // MARK: - Acceptance

    /// Everything the solved shape gets wrong (§6): a crossing, a lock off by
    /// more than 1 mm, a squared corner off by more than 0.1°. Empty means
    /// accepted.
    static func check(
        _ p: [Vec2], targets: [(Int, Double)], locks: [(Int, Meters)], tuning: SolverTuning
    ) -> [Residual] {
        var out: [Residual] = []
        if let (i, j) = Polygon.firstSelfIntersection(p) {
            out.append(Residual(kind: .crossing(wall: i, with: j), value: 0))
        }
        let n = p.count
        for (j, length) in locks {
            let off = p[j].distance(to: p[(j + 1) % n]) - length
            if abs(off) > tuning.lockTolerance { out.append(Residual(kind: .length(wall: j), value: off)) }
        }
        for (i, target) in targets {
            let off = wrap(interiorAngle(p, i) - target) * 180 / .pi
            if abs(off) > tuning.angleToleranceDegrees { out.append(Residual(kind: .angle(corner: i), value: off)) }
        }
        return out
    }

    /// Which walls are to blame.
    ///
    /// When locks fight the right angles, the solver keeps the locks (they
    /// weigh 1000× more) and lets the angles give — so its own failures name
    /// CORNERS, which is not what the operator can act on. He measured walls.
    /// So the conflict is re-asked the other way round: hold every squared
    /// angle hard and see how far each locked wall then is from its lock.
    /// On T7's 4 × 3 rectangle locked 4, 3, 4, 3.10, that answer is exactly
    /// the useful one — walls 1 and 3 each 5 cm out, walls 0 and 2 fine.
    static func explain(
        p0: [Vec2], targets: [(Int, Double)], locks: [(Int, Meters)], failures: [Residual],
        tuning: SolverTuning
    ) -> [Residual] {
        let crossings = failures.filter {
            if case .crossing = $0.kind { return true } else { return false }
        }
        var lockOffs: [Residual] = []
        if !locks.isEmpty, !targets.isEmpty {
            let rigid = solve(p0: p0, targets: targets, locks: locks, angleWeight: 1e8, tuning: tuning)
            let n = p0.count
            lockOffs = locks.compactMap { j, length in
                let off = rigid[j].distance(to: rigid[(j + 1) % n]) - length
                return abs(off) > tuning.lockTolerance ? Residual(kind: .length(wall: j), value: off) : nil
            }
        }
        let rest = lockOffs.isEmpty ? failures.filter { !crossings.contains($0) } : lockOffs
        return crossings + rest.sorted { abs($0.value) > abs($1.value) }
    }
}

/// Small dense linear algebra — the systems here are 2n − 3 square, a few
/// dozen at most, so Gaussian elimination with partial pivoting is plenty
/// and keeps the package free of any framework.
enum Linear {
    static func solve(_ A: [[Double]], _ b: [Double]) -> [Double]? {
        let n = b.count
        var M = A
        var x = b
        for col in 0..<n {
            var pivot = col
            for row in (col + 1)..<max(col + 1, n) where abs(M[row][col]) > abs(M[pivot][col]) { pivot = row }
            guard abs(M[pivot][col]) > 1e-18 else { return nil }
            if pivot != col {
                M.swapAt(pivot, col)
                x.swapAt(pivot, col)
            }
            for row in (col + 1)..<max(col + 1, n) {
                let f = M[row][col] / M[col][col]
                if f == 0 { continue }
                for k in col..<n { M[row][k] -= f * M[col][k] }
                x[row] -= f * x[col]
            }
        }
        for col in stride(from: n - 1, through: 0, by: -1) {
            var s = x[col]
            for k in (col + 1)..<max(col + 1, n) { s -= M[col][k] * x[k] }
            x[col] = s / M[col][col]
        }
        return x
    }
}
