import Foundation

/// Ceilings, volume and wall area (spec §11, M6, T10).
///
/// Everything here starts from one question — how high is the ceiling at
/// this point of the plan — and answers the rest from it:
///
/// - **Volume** is the ceiling height integrated over the floor. Every
///   profile is made of planes, and the integral of a plane over a region is
///   that region's area times the plane's height at its centroid — exact, no
///   sampling. A sloped ceiling is one plane; a vaulted one is two, split at
///   the ridge; zones are flat pieces.
/// - **Wall area** is the ceiling height integrated ALONG each wall. A wall
///   under a slope is a trapezoid, and integrating the top edge gives that
///   exactly for a straight wall; curved walls and the step at a zone's edge
///   are sampled finely enough to be exact to a fraction of a cm².
/// - **Ceiling surface** is each plane's area over the cosine of its slope.
///
/// Rooms are counter-clockwise (§1), so a wall's inside is on its left.
public enum CeilingIssue: Equatable, Sendable {
    /// A sloped ceiling's low or high wall is not a wall of this room.
    case unknownWall
    /// The low and high walls are the same wall, or have no distance between them.
    case noRun
    /// A height of zero or below.
    case nonPositiveHeight
    /// A vaulted ceiling whose ridge is lower than its eaves, or whose ridge
    /// axis is a point.
    case badRidge
    /// Zone i reaches outside the room.
    case zoneOutsideRoom(Int)
}

extension Room {

    // MARK: - The outline, as points

    /// The outline as a polygon, with each curved wall replaced by `steps`
    /// short chords — what the plane integrals and the half-plane split need.
    public func outlinePolygon(steps: Int = 48) -> [Vec2] {
        let p = points
        let n = p.count
        var out: [Vec2] = []
        for i in 0..<n {
            let a = p[i], b = p[(i + 1) % n]
            if case .arc(let s) = walls[i].shape, s != 0 {
                for k in 0..<steps { out.append(Arc.point(from: a, to: b, sagitta: s, at: Double(k) / Double(steps))) }
            } else {
                out.append(a)
            }
        }
        return out
    }

    /// Points along wall i's face, start to end — 2 for a straight wall.
    func wallSamples(_ i: Int, steps: Int) -> [Vec2] {
        let n = corners.count
        let a = points[i], b = points[(i + 1) % n]
        var s = 0.0
        if case .arc(let sag) = walls[i].shape { s = sag }
        return (0...steps).map { k in Arc.point(from: a, to: b, sagitta: s, at: Double(k) / Double(steps)) }
    }

    // MARK: - Height

    /// The ceiling height at plan point p.
    public func ceilingHeight(at p: Vec2) -> Meters {
        switch ceiling {
        case .flat(let h):
            return h
        case .sloped(let low, let high, let lowID, let highID):
            guard let plane = slopePlane(low: low, high: high, lowWallID: lowID, highWallID: highID) else { return low }
            return plane.height(p)
        case .vaulted(let eave, let ridge, let axis):
            guard let v = vault(eave: eave, ridge: ridge, axis: axis) else { return eave }
            return v.height(p)
        case .zones(let base, let zones):
            for zone in zones where Self.contains(zone.polygon, p) { return zone.height }
            return base
        }
    }

    /// One tilted plane: height `low` along the low wall's line, rising
    /// toward the high wall to reach `high` there (§11 sloped).
    struct SlopePlane {
        let origin: Vec2
        /// Unit vector pointing up the slope, across the room.
        let uphill: Vec2
        let run: Meters
        let low: Meters
        let high: Meters
        func height(_ p: Vec2) -> Meters { low + (high - low) * (p - origin).dot(uphill) / run }
        /// Slope angle α, tan α = rise / run.
        var angle: Double { atan(abs(high - low) / run) }
    }

    func slopePlane(low: Meters, high: Meters, lowWallID: UUID, highWallID: UUID) -> SlopePlane? {
        guard let jl = wallIndex(lowWallID), let jh = wallIndex(highWallID), jl != jh else { return nil }
        let n = corners.count
        let a = points[jl], b = points[(jl + 1) % n]
        let len = a.distance(to: b)
        guard len > 0 else { return nil }
        let u = (b - a) * (1 / len)
        // Into the room is LEFT of travel in a counter-clockwise room.
        let inward = Vec2(-u.y, u.x)
        // "The low wall and high wall are opposite": the run is how far the
        // high wall's middle stands from the low wall's line.
        let highMid = (points[jh] + points[(jh + 1) % n]) * 0.5
        let run = (highMid - a).dot(inward)
        guard run > 1e-9 else { return nil }
        return SlopePlane(origin: a, uphill: inward, run: run, low: low, high: high)
    }

    /// A vault: a ridge line at `ridge`, falling on each side to `eave` at
    /// the point of the room farthest from the ridge on that side.
    struct Vault {
        let a: Vec2
        let u: Vec2
        let eave: Meters
        let ridge: Meters
        /// Farthest the room reaches from the ridge on its left (+) and right (−).
        let reachLeft: Meters
        let reachRight: Meters
        func signedDistance(_ p: Vec2) -> Double { u.cross(p - a) }
        func height(_ p: Vec2) -> Meters {
            let s = signedDistance(p)
            let reach = s >= 0 ? reachLeft : reachRight
            guard reach > 1e-9 else { return ridge }
            return ridge - (ridge - eave) * min(abs(s) / reach, 1)
        }
    }

    func vault(eave: Meters, ridge: Meters, axis: RidgeAxis) -> Vault? {
        let len = axis.a.distance(to: axis.b)
        guard len > 1e-9 else { return nil }
        let u = (axis.b - axis.a) * (1 / len)
        let outline = outlinePolygon()
        let s = outline.map { u.cross($0 - axis.a) }
        return Vault(a: axis.a, u: u, eave: eave, ridge: ridge,
                     reachLeft: max(0, s.max() ?? 0), reachRight: max(0, -(s.min() ?? 0)))
    }

    // MARK: - Volume

    /// The air in the room, m³ (§11).
    public var volume: Double {
        switch ceiling {
        case .flat(let h):
            return area * h
        case .sloped:
            // Exact for a plane: A · h(centroid).
            let (a, c) = Self.areaAndCentroid(outlinePolygon())
            return a * ceilingHeight(at: c)
        case .vaulted(let eave, let ridge, let axis):
            guard let v = vault(eave: eave, ridge: ridge, axis: axis) else { return area * eave }
            // Each half is one plane: split at the ridge, A · h(centroid) each.
            return [1.0, -1.0].reduce(0) { sum, side in
                let half = Self.clip(outlinePolygon(), keepingSideOf: v.a, v.u, side: side)
                let (a, c) = Self.areaAndCentroid(half)
                return sum + a * v.height(c)
            }
        case .zones(let base, let zones):
            let zoned = zones.reduce(0.0) { $0 + Polygon.area($1.polygon) * $1.height }
            let zonedArea = zones.reduce(0.0) { $0 + Polygon.area($1.polygon) }
            return zoned + (area - zonedArea) * base
        }
    }

    // MARK: - Ceiling surface

    /// The ceiling's own surface, m² — larger than the floor under a slope
    /// (A / cos α per plane), the same as the floor when flat (§11).
    public var ceilingSurfaceArea: Double {
        switch ceiling {
        case .flat, .zones:
            return area
        case .sloped(let low, let high, let lowID, let highID):
            guard let plane = slopePlane(low: low, high: high, lowWallID: lowID, highWallID: highID) else { return area }
            return area / cos(plane.angle)
        case .vaulted(let eave, let ridge, let axis):
            guard let v = vault(eave: eave, ridge: ridge, axis: axis) else { return area }
            return [(1.0, v.reachLeft), (-1.0, v.reachRight)].reduce(0) { sum, side in
                let (a, _) = Self.areaAndCentroid(Self.clip(outlinePolygon(), keepingSideOf: v.a, v.u, side: side.0))
                guard side.1 > 1e-9 else { return sum + a }
                return sum + a / cos(atan((ridge - eave) / side.1))
            }
        }
    }

    // MARK: - Walls

    /// How finely a wall's top edge is followed. A straight wall under a
    /// flat or sloped ceiling is exact with any count; this matters only for
    /// a curve, a ridge crossing or a zone's step.
    static let wallSteps = 512

    /// Gross area of wall j (§11): its run along the face × the ceiling over
    /// it, integrated — a trapezoid under a slope, a gable under a vault.
    public func grossWallArea(_ j: Int) -> Double {
        if case .flat(let h) = ceiling { return wallRun(j) * h }
        let straight = { () -> Bool in if case .arc(let s) = walls[j].shape { return s == 0 }; return true }()
        if straight, case .sloped = ceiling {
            // A straight wall under one plane: exactly a trapezoid.
            let n = corners.count
            return wallLength(j) * (ceilingHeight(at: points[j]) + ceilingHeight(at: points[(j + 1) % n])) / 2
        }
        let pts = wallSamples(j, steps: Self.wallSteps)
        var total = 0.0
        for k in 0..<(pts.count - 1) {
            let mid = (pts[k] + pts[k + 1]) * 0.5
            total += pts[k].distance(to: pts[k + 1]) * ceilingHeight(at: mid)
        }
        return total
    }

    /// The lowest the ceiling comes over part of wall j: from `offset` along
    /// its chord, for `width` — what an opening there has to fit under.
    public func ceilingMin(onWall j: Int, from offset: Meters = 0, width: Meters? = nil) -> Meters {
        if case .flat(let h) = ceiling { return h }
        let n = corners.count
        let a = points[j], b = points[(j + 1) % n]
        let chord = a.distance(to: b)
        guard chord > 0 else { return ceilingHeight(at: a) }
        let t0 = max(0, min(1, offset / chord))
        let t1 = max(t0, min(1, (offset + (width ?? chord - offset)) / chord))
        let steps = 64
        return (0...steps).map { k -> Meters in
            let t = t0 + (t1 - t0) * Double(k) / Double(steps)
            return ceilingHeight(at: a + (b - a) * t)
        }.min() ?? ceilingHeight(at: a)
    }

    // MARK: - Checks

    /// What is wrong with this room's ceiling, if anything.
    public var ceilingIssues: [CeilingIssue] {
        switch ceiling {
        case .flat(let h):
            return h > 0 ? [] : [.nonPositiveHeight]
        case .sloped(let low, let high, let lowID, let highID):
            guard wallIndex(lowID) != nil, wallIndex(highID) != nil else { return [.unknownWall] }
            var out: [CeilingIssue] = []
            if slopePlane(low: low, high: high, lowWallID: lowID, highWallID: highID) == nil { out.append(.noRun) }
            if low <= 0 || high <= 0 { out.append(.nonPositiveHeight) }
            return out
        case .vaulted(let eave, let ridge, let axis):
            var out: [CeilingIssue] = []
            if eave <= 0 { out.append(.nonPositiveHeight) }
            if ridge < eave || axis.a.distance(to: axis.b) < 1e-9 { out.append(.badRidge) }
            return out
        case .zones(let base, let zones):
            var out: [CeilingIssue] = []
            if base <= 0 || zones.contains(where: { $0.height <= 0 }) { out.append(.nonPositiveHeight) }
            // Zones are not clipped to the room in v1: one that reaches
            // outside would count air that is not in the room, so it is
            // reported instead.
            let outline = outlinePolygon()
            for (i, zone) in zones.enumerated()
            where zone.polygon.contains(where: { !Self.contains(outline, $0) }) {
                out.append(.zoneOutsideRoom(i))
            }
            return out
        }
    }

    // MARK: - Polygon helpers

    /// Area and centroid of a simple polygon (either winding).
    static func areaAndCentroid(_ p: [Vec2]) -> (Double, Vec2) {
        guard p.count >= 3 else { return (0, p.first ?? Vec2(0, 0)) }
        var a2 = 0.0, cx = 0.0, cy = 0.0
        for i in p.indices {
            let s = p[i], t = p[(i + 1) % p.count]
            let w = s.x * t.y - t.x * s.y
            a2 += w
            cx += (s.x + t.x) * w
            cy += (s.y + t.y) * w
        }
        guard abs(a2) > 1e-15 else { return (0, p[0]) }
        return (abs(a2) / 2, Vec2(cx / (3 * a2), cy / (3 * a2)))
    }

    /// The part of polygon p on one side of the line through `a` along `u`:
    /// side +1 keeps the left, −1 the right. Sutherland–Hodgman against a
    /// half-plane, which is correct for any simple polygon.
    static func clip(_ p: [Vec2], keepingSideOf a: Vec2, _ u: Vec2, side: Double) -> [Vec2] {
        func s(_ q: Vec2) -> Double { side * u.cross(q - a) }
        var out: [Vec2] = []
        for i in p.indices {
            let cur = p[i], nxt = p[(i + 1) % p.count]
            let sc = s(cur), sn = s(nxt)
            if sc >= 0 { out.append(cur) }
            if (sc >= 0) != (sn >= 0) {
                let t = sc / (sc - sn)
                out.append(cur + (nxt - cur) * t)
            }
        }
        return out
    }

    /// Point in polygon, boundary counted as inside.
    static func contains(_ poly: [Vec2], _ p: Vec2) -> Bool {
        guard poly.count >= 3 else { return false }
        var inside = false
        for i in poly.indices {
            let a = poly[i], b = poly[(i + 1) % poly.count]
            // On the edge counts as inside.
            let ab = b - a, ap = p - a
            if abs(ab.cross(ap)) < 1e-9, ap.dot(ab) >= -1e-12, ap.dot(ab) <= ab.dot(ab) + 1e-12 { return true }
            if (a.y > p.y) != (b.y > p.y) {
                let x = a.x + (p.y - a.y) / (b.y - a.y) * (b.x - a.x)
                if p.x < x { inside.toggle() }
            }
        }
        return inside
    }
}
