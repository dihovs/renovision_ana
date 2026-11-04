import XCTest
@testable import FloorPlanCore

/// Curved walls (spec §10, T8–T9).
final class ArcTests: XCTestCase {

    // T8 — chord 4, sagitta 0.5: R = 16/4 + 0.25 = 4.25; φ = atan(8/15) =
    // 0.489957; arc length 8.5 · 0.489957 = 4.1646; segment area
    // 18.0625 · (0.979915 − 0.830450) / 2 = 1.3499.
    func testT8ArcMeasurements() {
        let arc = Arc(chord: 4, sagitta: 0.5)
        XCTAssertEqual(arc.radius, 4.25, accuracy: 1e-9)
        XCTAssertEqual(arc.halfAngle, atan(8.0 / 15), accuracy: 1e-9)
        XCTAssertEqual(arc.halfAngle, 0.489957, accuracy: 1e-6)
        XCTAssertEqual(arc.length, 4.1646, accuracy: 1e-3)
        XCTAssertEqual(arc.segmentArea, 1.3499, accuracy: 1e-3)
        XCTAssertTrue(arc.isSupported)
    }

    // T9 — 3-point arc (0,0),(2,1),(4,0): chord 4, sagitta 1, R = 16/8 + 0.5 =
    // 2.5, centre (2, −1.5). Check: √(4 + 2.25) = 2.5 and 1 − (−1.5) = 2.5.
    func testT9ThreePointArc() {
        guard let (arc, centre) = Arc.through(start: Vec2(0, 0), mid: Vec2(2, 1), end: Vec2(4, 0)) else {
            return XCTFail("three points that are not in line make an arc")
        }
        XCTAssertEqual(arc.chord, 4, accuracy: 1e-9)
        XCTAssertEqual(abs(arc.sagitta), 1, accuracy: 1e-9)
        XCTAssertEqual(arc.radius, 2.5, accuracy: 1e-9)
        XCTAssertEqual(centre.x, 2, accuracy: 1e-9)
        XCTAssertEqual(centre.y, -1.5, accuracy: 1e-9)
        // (2,1) is LEFT of travel (0,0) → (4,0); positive means right, so −1.
        XCTAssertEqual(arc.sagitta, -1, accuracy: 1e-9)
        // Mirrored: the same arc bulging to the right is +1.
        XCTAssertEqual(Arc.through(start: Vec2(0, 0), mid: Vec2(2, -1), end: Vec2(4, 0))?.arc.sagitta ?? 0, 1, accuracy: 1e-9)
        // In a line: no arc.
        XCTAssertNil(Arc.through(start: Vec2(0, 0), mid: Vec2(2, 0), end: Vec2(4, 0)))
    }

    /// A 4 × 3 counter-clockwise room whose bottom wall (wall 0, (0,0) → (4,0))
    /// is curved. Right of that wall is −y: outside the room.
    private func roomWithCurvedBottom(_ sagitta: Double) -> Room {
        var r = Room(name: "R", corners: [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(0, 3)].map { Corner(p: $0) },
                     ceiling: .flat(height: 2.4))
        r.walls[0].shape = .arc(sagitta: sagitta)
        return r
    }

    func testOutwardBulgeAddsAreaInwardSubtracts() {
        let seg = Arc(chord: 4, sagitta: 0.5).segmentArea
        XCTAssertEqual(roomWithCurvedBottom(0.5).area, 12 + seg, accuracy: 1e-9)
        XCTAssertEqual(roomWithCurvedBottom(-0.5).area, 12 - seg, accuracy: 1e-9)
        XCTAssertEqual(roomWithCurvedBottom(0).area, 12, accuracy: 1e-9)
    }

    func testPerimeterAndWallAreaFollowTheCurve() {
        let r = roomWithCurvedBottom(0.5)
        let run = Arc(chord: 4, sagitta: 0.5).length
        XCTAssertEqual(r.perimeter, run + 3 + 4 + 3, accuracy: 1e-9)
        XCTAssertEqual(r.grossWallArea(0), run * 2.4, accuracy: 1e-9)
        // The squaring solver and the opening rules still see the chord.
        XCTAssertEqual(r.wallLength(0), 4, accuracy: 1e-9)
    }

    func testDrawingPointsLieOnTheArcAndBulgeTheRightWay() {
        let a = Vec2(0, 0), b = Vec2(4, 0)
        let arc = Arc(chord: 4, sagitta: 0.5)
        XCTAssertEqual(Arc.point(from: a, to: b, sagitta: 0.5, at: 0).distance(to: a), 0, accuracy: 1e-9)
        XCTAssertEqual(Arc.point(from: a, to: b, sagitta: 0.5, at: 1).distance(to: b), 0, accuracy: 1e-9)
        // Half way: the top of the bulge, 0.5 to the RIGHT of travel (−y).
        let mid = Arc.point(from: a, to: b, sagitta: 0.5, at: 0.5)
        XCTAssertEqual(mid.x, 2, accuracy: 1e-9)
        XCTAssertEqual(mid.y, -0.5, accuracy: 1e-9)
        XCTAssertEqual(Arc.point(from: a, to: b, sagitta: -0.5, at: 0.5).y, 0.5, accuracy: 1e-9)
        // Every sample is one radius from the centre (2, −0.5 + 4.25).
        let centre = Vec2(2, -0.5 + arc.radius)
        for k in 0...10 {
            let p = Arc.point(from: a, to: b, sagitta: 0.5, at: Double(k) / 10)
            XCTAssertEqual(p.distance(to: centre), arc.radius, accuracy: 1e-9)
        }
    }

    func testSemicircleIsTheLimit() {
        XCTAssertTrue(Arc(chord: 4, sagitta: 2).isSupported)
        XCTAssertFalse(Arc(chord: 4, sagitta: 2.01).isSupported)
        // A semicircle: length πR with R = 2.
        XCTAssertEqual(Arc(chord: 4, sagitta: 2).length, .pi * 2, accuracy: 1e-9)
    }
}
