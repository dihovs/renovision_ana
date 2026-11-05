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
