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
}

private extension CGPoint {
    func distance(to o: CGPoint) -> Double { hypot(o.x - x, o.y - y) }
}
