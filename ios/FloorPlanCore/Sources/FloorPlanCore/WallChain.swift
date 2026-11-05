import Foundation

/// A LiDAR scan's walls into one closed room outline (spec §8 RoomPlan path,
/// M11).
///
/// RoomPlan reports walls as separate panels, not a loop: a long wall can
/// come in two pieces, a door frame leaves a stub, a closet's back face shows
/// through its doorway, and corners never quite meet. This finds the outline
/// those walls describe:
///
/// 1. **Clean.** Drop stubs; merge pieces of one wall (near-parallel, on one
///    line, touching) into one.
/// 2. **Link.** For every ordered pair of wall ends, the ways one can lead to
///    the next, each with a cost:
///    - a CORNER, where their lines cross — costing how far each wall had to
///      be extended or cut back to get there;
///    - a CONTINUATION, the next piece of the same straight wall — costing
///      the gap;
///    - a BRIDGE straight across a gap, marked suggested — costing its
///      length, more for a turn that is not square.
/// 3. **Search.** Depth-first over walls and their two directions, cheapest
///    links first, with branch-and-bound on the running cost: the cheapest
///    closed loop that never crosses itself. A wall may be left out at the
///    price of its own length, which is how a closet's back face or a stray
///    panel is dropped without dragging the outline through it.
///
/// Built from the published ideas in the owner's study of how the reference
/// does it (Docs: magicplan study, Part A) and the spec's own thresholds —
/// not a port of anyone's code.
public enum WallChain {

    public struct Segment: Equatable, Sendable {
        public var a: Vec2
        public var b: Vec2
        public init(_ a: Vec2, _ b: Vec2) {
            self.a = a
            self.b = b
        }
        public var length: Double { a.distance(to: b) }
    }

    public enum EdgeKind: Equatable, Sendable { case confirmed, suggested }

    public struct Outline: Equatable, Sendable {
        /// Corners, counter-clockwise.
        public var points: [Vec2]
        /// kinds[i] is the edge from point i to point i+1.
        public var kinds: [EdgeKind]
        public var suggestedCount: Int { kinds.filter { $0 == .suggested }.count }
    }

    public struct Tuning: Sendable {
        public var minWall: Meters = 0.12
        /// Pieces of one wall: this close to parallel, degrees…
        public var mergeAngleDegrees: Double = 6
        /// …this close to one line, metres…
        public var mergeOffset: Meters = 0.08
        /// …and overlapping or this close end to end.
        public var mergeGap: Meters = 0.30
        /// Walls less than this far from parallel cannot meet at a corner.
        public var cornerMinDegrees: Double = 25
        /// How far a wall may be extended or cut back to reach a corner.
        public var maxExtension: Meters = 0.6
        /// Turn penalty weight for a bridge.
        public var bridgeTurnWeight: Double = 1.5
        public var searchBudget: Int = 20_000
        public init() {}
    }

    // MARK: - Entry

    /// The outline, or nil when nothing closes.
    public static func outline(_ walls: [Segment], tuning: Tuning = Tuning()) -> Outline? {
        let pieces = clean(walls, tuning)
        guard pieces.count >= 3 else { return nil }
        let links = buildLinks(pieces, tuning)
        guard let chain = search(pieces, links, tuning) else { return nil }
        return assemble(pieces, chain)
    }

    // MARK: - Clean

    static func clean(_ walls: [Segment], _ t: Tuning) -> [Segment] {
        var work = walls.filter { $0.length >= t.minWall }
        let angleTol = t.mergeAngleDegrees * .pi / 180
        var merged = true
        while merged {
            merged = false
            outer: for i in work.indices {
                for j in work.indices where j > i {
                    if let m = merge(work[i], work[j], angleTol, t) {
                        work[i] = m
                        work.remove(at: j)
                        merged = true
                        break outer
                    }
                }
            }
        }
        return work
    }

    /// Two pieces of one wall become one, on the longer piece's direction at
    /// their length-weighted offset; nil when they are not one wall.
    static func merge(_ p: Segment, _ q: Segment, _ angleTol: Double, _ t: Tuning) -> Segment? {
        let base = p.length >= q.length ? p : q
        let other = p.length >= q.length ? q : p
        let u = (base.b - base.a) * (1 / base.length)
        let v = (other.b - other.a) * (1 / max(other.length, 1e-12))
        guard abs(u.cross(v)) <= sin(angleTol) else { return nil }
        let nrm = Vec2(-u.y, u.x)
        let off = { (x: Vec2) in (x - base.a).dot(nrm) }
        guard abs(off(other.a)) <= t.mergeOffset, abs(off(other.b)) <= t.mergeOffset else { return nil }
        let along = { (x: Vec2) in (x - base.a).dot(u) }
        let lo = min(along(other.a), along(other.b)), hi = max(along(other.a), along(other.b))
        guard lo <= base.length + t.mergeGap, hi >= -t.mergeGap else { return nil }
        let total = base.length + other.length
        let shift = (off((other.a + other.b) * 0.5) * other.length) / total
        let s = min(0, lo), e = max(base.length, hi)
        return Segment(base.a + u * s + nrm * shift, base.a + u * e + nrm * shift)
    }

    // MARK: - Links

    /// A wall walked one way: `dir` 0 is a → b, 1 is b → a.
    struct Node: Hashable { let wall: Int; let dir: Int }

    struct Link {
        let to: Node
        let cost: Double
        /// The corner(s) this link puts in the outline, in order.
        let corners: [Vec2]
        let bridge: Bool
    }

    static func ends(_ s: Segment, _ dir: Int) -> (Vec2, Vec2) { dir == 0 ? (s.a, s.b) : (s.b, s.a) }

    static func buildLinks(_ w: [Segment], _ t: Tuning) -> [Node: [Link]] {
        let cornerMin = sin(t.cornerMinDegrees * .pi / 180)
        var out: [Node: [Link]] = [:]
        for i in w.indices {
            for di in 0..<2 {
                let (ia, ib) = ends(w[i], di)
                let li = w[i].length
                let ui = (ib - ia) * (1 / li)
                var links: [Link] = []
                for j in w.indices where j != i {
                    for dj in 0..<2 {
                        let (ja, jb) = ends(w[j], dj)
                        let lj = w[j].length
                        let uj = (jb - ja) * (1 / lj)
                        let node = Node(wall: j, dir: dj)
                        let cross = ui.cross(uj)
                        // A corner or a continuation, when one fits — and a
                        // bridge either way below, so a pair that is neither
                        // still has a way across.
                        if abs(cross) >= cornerMin {
                            // Corner: where the lines cross. It must lie past
                            // the middle of i (we leave i through its end) and
                            // before the middle of j (we enter j at its start).
                            let tI = (ja - ia).cross(uj) / cross
                            let tJ = (ja - ia).cross(ui) / cross
                            let x = ia + ui * tI
                            let extI = tI - li, extJ = -tJ
                            if tI > li / 2, tJ < lj / 2, abs(extI) <= t.maxExtension, abs(extJ) <= t.maxExtension {
                                links.append(Link(to: node, cost: abs(extI) + abs(extJ), corners: [x], bridge: false))
                            }
                        } else if ui.dot(uj) > 0.98 {
                            // Continuation: j carries on along i's line.
                            let gap = (ja - ib).dot(ui)
                            let side = abs((ja - ia).cross(ui))
                            if gap > -t.mergeGap, side <= t.mergeOffset {
                                links.append(Link(to: node, cost: max(gap, 0) + side, corners: [], bridge: false))
                            }
                        }
                        // A bridge, end of i straight to start of j.
                        let gapLen = ib.distance(to: ja)
                        guard gapLen > 1e-6, gapLen <= 3 else { continue }
                        let ub = (ja - ib) * (1 / gapLen)
                        func penalty(_ a: Vec2, _ b: Vec2) -> Double {
                            let ang = abs(atan2(a.cross(b), a.dot(b)))
                            if ang <= 3 * .pi / 4 { return (1 - cos(4 * ang)) / 2 }
                            return (ang - 3 * .pi / 4) * 7.5 / (.pi / 4)
                        }
                        let turn = penalty(ui, ub) + penalty(ub, uj)
                        links.append(Link(to: node, cost: gapLen * (1 + t.bridgeTurnWeight * turn) + 0.05,
                                          corners: [ib, ja], bridge: true))
                    }
                }
                out[Node(wall: i, dir: di)] = links.sorted { $0.cost < $1.cost }
            }
        }
        return out
    }

    // MARK: - Search

    struct Step { let node: Node; let link: Link? }

    static func search(_ w: [Segment], _ links: [Node: [Link]], _ t: Tuning) -> [Step]? {
        // Start on the longest wall — it is certainly part of the room.
        guard let start = w.indices.max(by: { w[$0].length < w[$1].length }) else { return nil }
        var best: (cost: Double, chain: [Step])?
        var budget = t.searchBudget
        let skipCost = w.map { $0.length }

        func dfs(_ path: [Step], _ used: Set<Int>, _ cost: Double, _ pts: [Vec2]) {
            guard budget > 0 else { return }
            budget -= 1
            let here = path.last!.node
            // Leaving out the walls not yet used costs their length — a
            // lower bound for any completion of this path.
            let unused = w.indices.filter { !used.contains($0) }.reduce(0.0) { $0 + skipCost[$1] }
            if let b = best, cost >= b.cost { return }
            for link in links[here] ?? [] {
                let next = link.to
                if next.wall == start {
                    guard next.dir == path[0].node.dir, used.count >= 3 else { continue }
                    let total = cost + link.cost + unused
                    if let b = best, total >= b.cost { continue }
                    let closed = path + [Step(node: next, link: link)]
                    let poly = corners(w, closed)
                    guard poly.count >= 3, Polygon.isSimple(poly), Polygon.area(poly) > 0.5 else { continue }
                    best = (total, closed)
                    continue
                }
                guard !used.contains(next.wall) else { continue }
                if let b = best, cost + link.cost >= b.cost { continue }
                dfs(path + [Step(node: next, link: link)], used.union([next.wall]), cost + link.cost, pts)
            }
        }

        for dir in 0..<2 {
            dfs([Step(node: Node(wall: start, dir: dir), link: nil)], [start], 0, [])
        }
        return best?.chain
    }

    /// The corners a chain makes (its closing step back onto the start
    /// included as the last link).
    static func corners(_ w: [Segment], _ chain: [Step]) -> [Vec2] {
        var out: [Vec2] = []
        for step in chain.dropFirst() { out += step.link?.corners ?? [] }
        // Consecutive duplicates, and a last point equal to the first.
        var clean: [Vec2] = []
        for p in out where clean.last.map({ $0.distance(to: p) > 1e-6 }) ?? true { clean.append(p) }
        if clean.count > 1, clean.first!.distance(to: clean.last!) < 1e-6 { clean.removeLast() }
        return clean
    }

    static func assemble(_ w: [Segment], _ chain: [Step]) -> Outline? {
        var pts: [Vec2] = []
        var kinds: [EdgeKind] = []
        for step in chain.dropFirst() {
            guard let link = step.link else { continue }
            if link.bridge {
                // The bridge's first corner ends a real wall; the edge from it
                // is the guessed one.
                pts.append(link.corners[0]); kinds.append(.suggested)
                pts.append(link.corners[1]); kinds.append(.confirmed)
            } else if let c = link.corners.first {
                pts.append(c); kinds.append(.confirmed)
            }
        }
        // Collapse duplicates and straight-through points (a continuation
        // leaves none; a corner between two pieces of one line can).
        var i = 0
        while pts.count > 3 && i < pts.count {
            let n = pts.count
            let prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n]
            let dup = cur.distance(to: next) < 1e-4
            let straight = abs((cur - prev).cross(next - cur)) < 1e-6 * max((cur - prev).length * (next - cur).length, 1e-12)
                && (cur - prev).dot(next - cur) > 0
            if dup || (straight && kinds[(i - 1 + n) % n] == kinds[i]) {
                pts.remove(at: i)
                kinds.remove(at: i)
            } else {
                i += 1
            }
        }
        // A wall the scan reported in two pieces a few centimetres out of
        // line comes back bridged by a short jog. That is one wall: the two
        // ends of the jog fold into one point halfway between them, and the
        // edge is a wall again.
        var j = 0
        while pts.count > 3 && j < pts.count {
            let n = pts.count
            guard kinds[j] == .suggested else { j += 1; continue }
            let a = pts[(j - 1 + n) % n], p = pts[j], q = pts[(j + 1) % n], b = pts[(j + 2) % n]
            let u = p - a, v = b - q
            let lu = u.length, lv = v.length
            let parallel = lu > 1e-9 && lv > 1e-9 && u.dot(v) / (lu * lv) > cos(12 * .pi / 180)
            // A bridge only a few centimetres long between walls that turn a
            // real corner is not a missing piece of wall: the two stopped
            // short of their corner. The corner is where their lines cross.
            let cross = u.cross(v)
            if !parallel, p.distance(to: q) <= 0.15, lu > 1e-9, lv > 1e-9, abs(cross) > 1e-9 {
                let t = (q - a).cross(v) / cross
                let x = a + u * t
                if x.distance(to: (p + q) * 0.5) <= 0.3 {
                    pts[j] = x
                    kinds[j] = .confirmed
                    let drop = (j + 1) % n
                    pts.remove(at: drop)
                    kinds.remove(at: drop)
                    if drop < j { j -= 1 }
                    continue
                }
            }
            if parallel, p.distance(to: q) <= 0.3 {
                let mid = (p + q) * 0.5
                pts[j] = mid
                kinds[j] = .confirmed
                let drop = (j + 1) % n
                pts.remove(at: drop)
                kinds.remove(at: drop)
                if drop < j { j -= 1 }
                // The fold leaves a near-straight point: drop it too.
                let m = pts.count
                let jj = (j + m) % m
                let aa = pts[(jj - 1 + m) % m], cc = pts[(jj + 1) % m]
                let t1 = pts[jj] - aa, t2 = cc - pts[jj]
                if t1.length > 1e-9, t2.length > 1e-9, t1.dot(t2) / (t1.length * t2.length) > cos(8 * .pi / 180),
                    kinds[(jj - 1 + m) % m] == kinds[jj]
                {
                    pts.remove(at: jj)
                    kinds.remove(at: jj)
                }
            } else {
                j += 1
            }
        }
        guard pts.count >= 3 else { return nil }
        if Polygon.signedArea(pts) < 0 {
            pts.reverse()
            // Edge i (point i → i+1) reversed is the old edge n-2-i.
            let n = kinds.count
            kinds = (0..<n).map { kinds[((n - 2 - $0) % n + n) % n] }
        }
        return Outline(points: pts, kinds: kinds)
    }

    // MARK: - With squaring (spec §8: "then run the squaring solver with all
    // lengths unlocked")

    public static func squaredOutline(_ walls: [Segment], tuning: Tuning = Tuning()) -> Outline? {
        guard var o = outline(walls, tuning: tuning) else { return nil }
        let room = Room(name: "", corners: o.points.map { Corner(p: $0) })
        // The whole room at once, by magicplan's rules (POLYGON_LOGIC Part
        // B): a corner squared only within its own tolerance (a real slight
        // bend is kept), every wall held near the length the scan measured.
        // No wall's direction is pinned — on a scan every wall is a degree
        // or two off, and pinning one bends the rest to it.
        var solver = SolverTuning.onClose
        solver.pinFirstWall = false
        if case .solved(let squared) = Squaring.square(room, tuning: solver) {
            o.points = squared.points
        } else {
            // Refused (it would cross, or a corner would not settle): the
            // flat solve the scan path always used.
            var flat = SolverTuning()
            flat.pinFirstWall = false
            if case .solved(let squared) = Squaring.square(room, tuning: flat) { o.points = squared.points }
        }
        return o
    }
}
