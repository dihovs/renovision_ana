import Foundation

/// Every capture threshold, in one place (spec §4). Tunable, with the spec's
/// defaults and its reasons beside each.
public struct CaptureTuning: Codable, Sendable {
    /// About the noise of an AR raycast at 2–3 m. Below it merges jitter;
    /// above it starts merging real 5 cm jogs (trim, pilasters).
    public var vertexSnap: Meters = 0.03
    /// A finger covers 20–30 cm of floor at standing distance; a closing wall
    /// is rarely shorter than this.
    public var autoClose: Meters = 0.25
    /// Real jogs under 10 cm are rare and usually trim; rejecting shorter
    /// walls removes double taps. A shorter wall can still be typed.
    public var minWall: Meters = 0.10
    /// Drawing guide only, around 90° and 180°.
    public var angleSnapDegrees: Double = 3
    /// About one wall thickness, so neighbouring rooms snap together.
    public var wallSnap: Meters = 0.10

    public init() {}
}

/// A room outline being drawn tap by tap (spec §4 rules, §15 T3–T5, T15–T16).
public struct OutlineCapture: Sendable {

    public enum TapResult: Equatable, Sendable {
        /// A new corner, at this position (snapped or not).
        case added(Vec2, snapped: Bool)
        /// The loop closed; `room` is ready, counter-clockwise.
        case closed
        /// Too close to the previous corner (§4 minimum wall). Show a toast.
        case tooShort(Meters)
        /// Closing would make the outline cross itself (T15). Nothing changed.
        case crossesItself
    }

    public var tuning: CaptureTuning
    public private(set) var points: [Vec2] = []
    public private(set) var room: Room?
    /// Corners of the OTHER rooms on this floor — a vertex snaps to any of
    /// them as well as to this outline's own (§4 "in any room on the floor").
    public var neighbourCorners: [Vec2]

    public init(tuning: CaptureTuning = CaptureTuning(), neighbourCorners: [Vec2] = []) {
        self.tuning = tuning
        self.neighbourCorners = neighbourCorners
    }

    /// Start from corners already placed (resuming, or a test's setup).
    public init(points: [Vec2], tuning: CaptureTuning = CaptureTuning(), neighbourCorners: [Vec2] = []) {
        self.init(tuning: tuning, neighbourCorners: neighbourCorners)
        self.points = points
    }

    public var isClosed: Bool { room != nil }

    /// The nearest existing corner within `vertexSnap`, or nil.
    ///
    /// Strictly within: a tap exactly `vertexSnap` away is a different corner.
    public func snapTarget(for p: Vec2) -> Vec2? {
        var best: (Vec2, Double)?
        for c in points + neighbourCorners {
            let d = c.distance(to: p)
            if d < tuning.vertexSnap, d < (best?.1 ?? .infinity) { best = (c, d) }
        }
        return best?.0
    }

    /// One tap on the floor (or the 2D canvas).
    ///
    /// The order matters and is the spec's: a tap near corner 0 CLOSES before
    /// anything else is asked of it — otherwise the closing tap, which lands
    /// near the first corner and so a long way from nothing, would be judged
    /// as a new corner first.
    public mutating func tap(_ raw: Vec2) -> TapResult {
        precondition(room == nil, "the outline is already closed")

        if points.count >= 3, let first = points.first, first.distance(to: raw) < tuning.autoClose {
            return close()
        }

        let snapped = snapTarget(for: raw)
        let p = snapped ?? raw

        // "Less than minWall" rejects; exactly minWall is a wall (T5 — the
        // spec's own boundary case lands on 0.100). The epsilon is there so a
        // value that is 0.1 on paper is not refused for being 0.0999999 in
        // binary.
        if let last = points.last {
            let d = last.distance(to: p)
            if d < tuning.minWall - 1e-9 { return .tooShort(d) }
        }

        points.append(p)
        return .added(p, snapped: snapped != nil)
    }

    /// Close the loop now (also what a "Close" button does).
    public mutating func close() -> TapResult {
        guard points.count >= 3 else { return .tooShort(0) }
        if !Polygon.isSimple(points) { return .crossesItself }
        room = Room(name: "", corners: points.map { Corner(p: $0) }).counterClockwise()
        return .closed
    }
}

/// **The turn hint while drawing** (magicplan, POLYGON_LOGIC Part D).
///
/// While the next corner is being aimed, the aim is compared with the last
/// wall turned 90°, then 45°, then 135° (either way). The first of those whose
/// line passes within `coarse` of the aim is the candidate; it is used only
/// when the aim is within `fine` of it. The hinted point keeps the length the
/// operator is aiming at and fixes only the angle — so a wall tapped 3° off
/// square lands square, and one meant at 60° is left alone.
public enum AimHint {
    public static let coarse: Meters = 0.2
    public static let fine: Meters = 0.05
    /// The last wall must be at least this long to have a direction worth
    /// following, and the aim at least this far from the last corner.
    public static let minWall: Meters = 0.3
    public static let minReach: Meters = 0.15

    public struct Hint: Equatable, Sendable {
        public var point: Vec2
        /// The turn from the last wall, degrees: ±90, ±45 or ±135.
        public var degrees: Double
    }

    /// `points` are the corners placed so far; nil when there is no hint.
    public static func hint(points: [Vec2], aim: Vec2) -> Hint? {
        guard points.count >= 2 else { return nil }
        let last = points[points.count - 1]
        let before = points[points.count - 2]
        let wall = last - before
        let wallLength = wall.length
        let reach = aim.distance(to: last)
        guard wallLength >= minWall, reach >= minReach else { return nil }
        let u = wall * (1 / wallLength)
        let toAim = aim - last
        for degrees in [90.0, 45.0, 135.0] {
            var best: (Hint, Double)?
            for sign in [1.0, -1.0] {
                let a = degrees * sign * .pi / 180
                let d = Vec2(u.x * cos(a) - u.y * sin(a), u.x * sin(a) + u.y * cos(a))
                // Only ahead along the candidate line, never behind it.
                let along = toAim.dot(d)
                guard along > 0 else { continue }
                let miss = abs(toAim.cross(d))
                guard miss < coarse else { continue }
                let hint = Hint(point: last + d * reach, degrees: degrees * sign)
                if miss < (best?.1 ?? .infinity) { best = (hint, miss) }
            }
            if let (hint, miss) = best { return miss < fine ? hint : nil }
        }
        return nil
    }
}

/// **When a room may be closed** (magicplan, POLYGON_LOGIC Part A): when the
/// aim is within 0.2 m of the first corner, or when the corners so far
/// already enclose more than 1 m² AND the outline turns sharply (over 75°)
/// at both its first and its last corner — so a sliver, or a shape that
/// would close along a slant nobody drew, is not one tap from being saved.
public enum CloseRule {
    public static let nearFirst: Meters = 0.2
    public static let minArea: Double = 1
    public static let minEndTurnDegrees: Double = 75

    public static func canClose(points: [Vec2], aim: Vec2? = nil) -> Bool {
        guard points.count >= 3 else { return false }
        if let aim, let first = points.first, aim.distance(to: first) < nearFirst { return true }
        guard abs(Polygon.signedArea(points)) > minArea else { return false }
        func turn(_ i: Int) -> Double {
            let n = points.count
            let a = points[i] - points[(i - 1 + n) % n]
            let b = points[(i + 1) % n] - points[i]
            return abs(atan2(a.cross(b), a.dot(b))) * 180 / .pi
        }
        return min(turn(0), turn(points.count - 1)) > minEndTurnDegrees
    }
}
