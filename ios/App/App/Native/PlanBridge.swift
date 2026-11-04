import CoreGraphics
import FloorPlanCore

/// The one crossing between this app's plan points and FloorPlanCore's.
///
/// **They are mirror images, and that is the whole reason this file exists.**
/// Every screen in the app draws plan metres with y growing DOWN, the way a
/// screen does (RoomPlan's z maps straight onto it — see `FloorPlanGeometry`).
/// The floor-plan spec (§1) puts the plan on X/Y with y UP, and defines
/// counter-clockwise in that frame. Handing an app point to the core as it
/// stands mirrors the room top to bottom, which reverses its winding: every
/// "counter-clockwise" check would pass on the rooms that are clockwise on
/// screen and reverse the ones that were right. Nothing would crash and
/// every area would still come out correct — it would only be the
/// orientation that was silently wrong, which is the worst way to be wrong.
///
/// So y is negated here, in both directions, and nowhere else. A flip of y
/// is its own inverse and keeps the drawing's visual orientation: a room
/// that goes round counter-clockwise on screen is counter-clockwise in the
/// spec's frame too.
enum PlanBridge {

    static func core(_ p: CGPoint) -> Vec2 { Vec2(Double(p.x), -Double(p.y)) }
    static func app(_ v: Vec2) -> CGPoint { CGPoint(x: v.x, y: -v.y) }

    static func core(_ points: [CGPoint]) -> [Vec2] { points.map(core) }
    static func app(_ points: [Vec2]) -> [CGPoint] { points.map(app) }

    /// Whether these app-frame corners close into a shape whose walls never
    /// cross or touch (spec §4, T15).
    static func isSimple(_ corners: [CGPoint]) -> Bool { Polygon.isSimple(core(corners)) }

    /// The same corners, wound counter-clockwise as the spec stores rooms
    /// (§1, T16) — counter-clockwise as seen on screen.
    static func counterClockwise(_ corners: [CGPoint]) -> [CGPoint] {
        Polygon.isCounterClockwise(core(corners)) ? corners : corners.reversed()
    }

    // MARK: - Squaring (spec §6, M3)

    enum SquareOutcome {
        /// The squared corners, in the SAME order and frame as given — so
        /// openings and locks keyed by edge index stay on their walls.
        case squared([CGPoint])
        /// Nothing changed. One line per locked wall that disagrees, worst
        /// first, as (app edge index, how far off in metres: positive means
        /// the right angles want it LONGER than its lock).
        case conflict(walls: [(edge: Int, off: Double)], crosses: Bool)
    }

    /// Square a room's outline, holding every locked edge at its current
    /// length.
    ///
    /// In the app a "locked" edge is one whose length was typed or lasered —
    /// the padlock — and the number IS its current length, so that is what
    /// the solver is told to keep. Corners go across by id and come back by
    /// id, which is what makes the solver's own counter-clockwise reordering
    /// invisible here.
    static func square(_ corners: [CGPoint], locked: Set<Int>) -> SquareOutcome {
        let n = corners.count
        var room = Room(name: "", corners: core(corners).map { Corner(p: $0) })
        for j in locked where j < n {
            room.walls[j].lockedLength = corners[j].distance(to: corners[(j + 1) % n])
        }
        let edgeOf = Dictionary(uniqueKeysWithValues: room.walls.indices.map { (room.walls[$0].id, $0) })

        switch Squaring.square(room) {
        case .solved(let out):
            let byID = Dictionary(uniqueKeysWithValues: out.corners.map { ($0.id, $0.p) })
            return .squared(room.corners.map { app(byID[$0.id] ?? $0.p) })
        case .conflict(let worst):
            var crosses = false
            var walls: [(edge: Int, off: Double)] = []
            for r in worst {
                switch r.kind {
                case .crossing: crosses = true
                case .length:
                    if let id = r.wallID, let edge = edgeOf[id] { walls.append((edge, r.value)) }
                case .angle: break
                }
            }
            return .conflict(walls: walls, crosses: crosses)
        }
    }

    // MARK: - Curved walls (spec §10, M5)
    //
    // A wall's curve is stored as a BULGE: metres, + away from the room,
    // − into it (`ScanGeometry.edgeBulge`). The spec's sagitta is "+ to the
    // right of travel", which is away from the room only in a
    // counter-clockwise outline — so the sign is converted here, from the
    // outline's real winding, and nowhere else.

    /// The bulges, if they line up with these corners edge for edge. An
    /// outline whose corner count changed under them has no curves left to
    /// trust, and is drawn and measured straight.
    static func aligned(_ bulges: [Double], _ corners: [CGPoint]) -> [Double]? {
        bulges.count == corners.count && bulges.contains(where: { $0 != 0 }) ? bulges : nil
    }

    /// The room in the core's model, curved walls included, counter-clockwise.
    static func room(_ corners: [CGPoint], bulges: [Double]) -> Room {
        let pts = core(corners)
        var room = Room(name: "", corners: pts.map { Corner(p: $0) })
        if let bulges = aligned(bulges, corners) {
            let ccw = Polygon.isCounterClockwise(pts)
            for (i, b) in bulges.enumerated() where b != 0 {
                room.walls[i].shape = .arc(sagitta: ccw ? b : -b)
            }
        }
        return room.counterClockwise()
    }

    /// Floor area with curved walls.
    static func area(_ corners: [CGPoint], bulges: [Double]) -> Double {
        corners.count >= 3 ? room(corners, bulges: bulges).area : 0
    }

    /// Points along edge i from its start corner to its end corner, in the
    /// app's own frame: just the two corners when straight, `steps + 1`
    /// points along the arc when curved.
    static func edgePoints(_ corners: [CGPoint], edge i: Int, bulge: Double, steps: Int = 24) -> [CGPoint] {
        let n = corners.count
        let a = corners[i], b = corners[(i + 1) % n]
        guard bulge != 0, n >= 3 else { return [a, b] }
        let ccw = Polygon.isCounterClockwise(core(corners))
        let sagitta = ccw ? bulge : -bulge
        return (0...steps).map { k in
            app(Arc.point(from: core(a), to: core(b), sagitta: sagitta, at: Double(k) / Double(steps)))
        }
    }

    /// The deepest a wall of this chord may bulge in v1 (§10): a semicircle.
    static func maxBulge(chord: Double) -> Double { chord / 2 }

    // MARK: - Ceilings (spec §11, M6)

    typealias CeilingRecord = ScanGeometry.CeilingRecord

    /// The room in the core's model with its ceiling, curved walls included,
    /// counter-clockwise. The record names walls by edge number in THESE
    /// corners; the walls get their ids here, before the core reorders
    /// anything, so every edge number lands on the wall it meant.
    static func room(_ corners: [CGPoint], bulges: [Double], ceiling record: CeilingRecord?, flat: Double) -> Room {
        let pts = core(corners)
        let n = pts.count
        var room = Room(name: "", corners: pts.map { Corner(p: $0) })
        let ccw = Polygon.isCounterClockwise(pts)
        if let bulges = aligned(bulges, corners) {
            for (i, b) in bulges.enumerated() where b != 0 { room.walls[i].shape = .arc(sagitta: ccw ? b : -b) }
        }
        func edge(_ i: Int?) -> Int? { i.flatMap { (0..<n).contains($0) ? $0 : nil } }
        /// Into the room from edge i: left of travel when counter-clockwise.
        func inward(_ i: Int) -> Vec2 {
            let a = pts[i], b = pts[(i + 1) % n]
            let len = max(a.distance(to: b), 1e-12)
            let u = (b - a) * (1 / len)
            return ccw ? Vec2(-u.y, u.x) : Vec2(u.y, -u.x)
        }

        switch record?.kind {
        case "sloped":
            if let lo = edge(record?.lowEdge), let hi = edge(record?.highEdge),
                let low = record?.low, let high = record?.high
            {
                room.ceiling = .sloped(lowHeight: low, highHeight: high,
                                       lowWallID: room.walls[lo].id, highWallID: room.walls[hi].id)
            } else {
                room.ceiling = .flat(height: flat)
            }
        case "vaulted":
            if let e = edge(record?.ridgeEdge), let eave = record?.eave, let ridge = record?.ridge {
                // Through the middle of the room, parallel to the chosen wall.
                let c = centroid(pts)
                let d = pts[(e + 1) % n] - pts[e]
                room.ceiling = .vaulted(eaveHeight: eave, ridgeHeight: ridge,
                                        ridgeAxis: RidgeAxis(a: c, b: c + d))
            } else {
                room.ceiling = .flat(height: flat)
            }
        case "zones":
            let base = record?.height ?? flat
            let zones: [HeightZone] = (record?.strips ?? []).compactMap { strip in
                guard let i = edge(strip.edge), strip.depth > 0 else { return nil }
                let a = pts[i], b = pts[(i + 1) % n], v = inward(i) * strip.depth
                return HeightZone(polygon: [a, b, b + v, a + v], height: strip.height)
            }
            room.ceiling = .zones(base: base, zones: zones)
        default:
            room.ceiling = .flat(height: record?.height ?? flat)
        }
        return room.counterClockwise()
    }

    /// The figures a ceiling gives this room — what is saved with it.
    static func ceilingFigures(_ corners: [CGPoint], bulges: [Double], ceiling record: CeilingRecord?, flat: Double)
        -> ScanGeometry.CeilingFigures?
    {
        guard corners.count >= 3 else { return nil }
        let r = room(corners, bulges: bulges, ceiling: record, flat: flat)
        let area = r.area
        guard area > 0 else { return nil }
        // Every profile is planes and flat pieces, so its extremes are at the
        // outline's corners, on a ridge, or at a zone's own height.
        var heights = r.outlinePolygon().map { r.ceilingHeight(at: $0) }
        switch r.ceiling {
        case .vaulted(_, let ridge, _): heights.append(ridge)
        case .zones(let base, let zones): heights += [base] + zones.map(\.height)
        default: break
        }
        let volume = r.volume
        return ScanGeometry.CeilingFigures(
            volumeCbm: volume,
            grossWallSqm: r.grossWallArea,
            ceilingSurfaceSqm: r.ceilingSurfaceArea,
            meanHeightM: volume / area,
            minHeightM: heights.min() ?? flat,
            maxHeightM: heights.max() ?? flat)
    }

    /// What is wrong with this ceiling, in words — nil when nothing.
    static func ceilingProblem(_ corners: [CGPoint], bulges: [Double], ceiling record: CeilingRecord?, flat: Double) -> String? {
        let r = room(corners, bulges: bulges, ceiling: record, flat: flat)
        guard let issue = r.ceilingIssues.first else { return nil }
        switch issue {
        case .unknownWall, .noRun: return "Pick a low wall and a different high wall across the room from it."
        case .nonPositiveHeight: return "Every height has to be more than zero."
        case .badRidge: return "The ridge has to be at least as high as the eaves."
        case .zoneOutsideRoom(let i): return "Zone \(i + 1) reaches outside the room — make it shallower."
        }
    }

    /// The lowest the ceiling comes over an opening's own span on edge
    /// `edge` — what its sill + height has to fit under (§9 with §11).
    static func ceilingOver(
        _ corners: [CGPoint], bulges: [Double], ceiling record: CeilingRecord?, flat: Double,
        edge: Int, offset: Double, width: Double
    ) -> Double {
        guard record != nil, record?.kind != "flat" else { return record?.height ?? flat }
        let r = room(corners, bulges: bulges, ceiling: record, flat: flat)
        // Find the same wall after the core's reordering: by its corners.
        let a = core(corners[edge]), b = core(corners[(edge + 1) % corners.count])
        for j in r.walls.indices {
            let p = r.points[j], q = r.points[(j + 1) % r.corners.count]
            if p == a, q == b { return r.ceilingMin(onWall: j, from: offset, width: width) }
            if p == b, q == a {
                // Reversed: the offset is measured from the other end.
                let chord = a.distance(to: b)
                return r.ceilingMin(onWall: j, from: chord - offset - width, width: width)
            }
        }
        return flat
    }

    /// What the plan draws of a shaped ceiling, in the app's frame: each
    /// bulkhead's footprint, and a vault's ridge as a long line through the
    /// room (the caller clips it to the floor).
    static func ceilingOverlay(_ corners: [CGPoint], bulges: [Double], ceiling record: CeilingRecord?, flat: Double)
        -> (zones: [[CGPoint]], ridge: (CGPoint, CGPoint)?)
    {
        guard let record, record.kind != "flat", corners.count >= 3 else { return ([], nil) }
        let r = room(corners, bulges: bulges, ceiling: record, flat: flat)
        switch r.ceiling {
        case .zones(_, let zones):
            return (zones.map { app($0.polygon) }, nil)
        case .vaulted(_, _, let axis):
            let d = axis.b - axis.a
            let len = max(d.length, 1e-9)
            let reach = 1000.0
            let u = d * (reach / len)
            return ([], (app(axis.a - u), app(axis.a + u)))
        default:
            return ([], nil)
        }
    }

    private static func centroid(_ p: [Vec2]) -> Vec2 {
        var a2 = 0.0, cx = 0.0, cy = 0.0
        for i in p.indices {
            let s = p[i], t = p[(i + 1) % p.count]
            let w = s.x * t.y - t.x * s.y
            a2 += w; cx += (s.x + t.x) * w; cy += (s.y + t.y) * w
        }
        guard abs(a2) > 1e-12 else { return p.first ?? Vec2(0, 0) }
        return Vec2(cx / (3 * a2), cy / (3 * a2))
    }
}

private extension CGPoint {
    func distance(to o: CGPoint) -> Double { hypot(o.x - x, o.y - y) }
}
