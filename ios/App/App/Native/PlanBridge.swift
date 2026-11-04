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
}
