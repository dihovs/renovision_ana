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

    // §9: an opening's offset is along the chord, and it is DRAWN on the arc.
    // T9's arc, (0,0) → (4,0) bulging up to (2,1), centre (2,−1.5), R 2.5:
    // the chord point 0.5 m along stands up to (0.5, 0.5) — √(1.5² + 2²) = 2.5.
    func testPointOverChordStandsOnTheArc() {
        let a = Vec2(0, 0), b = Vec2(4, 0)
        // Up is to the LEFT of a → b, so the sagitta is negative.
        let top = Arc.pointOverChord(from: a, to: b, sagitta: -1, at: 2)
        XCTAssertEqual(top.x, 2, accuracy: 1e-9); XCTAssertEqual(top.y, 1, accuracy: 1e-9)
        let p = Arc.pointOverChord(from: a, to: b, sagitta: -1, at: 0.5)
        XCTAssertEqual(p.x, 0.5, accuracy: 1e-9); XCTAssertEqual(p.y, 0.5, accuracy: 1e-9)
        // The ends are the corners; a straight wall is the chord point.
        XCTAssertEqual(Arc.pointOverChord(from: a, to: b, sagitta: -1, at: 0).distance(to: a), 0, accuracy: 1e-9)
        XCTAssertEqual(Arc.pointOverChord(from: a, to: b, sagitta: -1, at: 4).distance(to: b), 0, accuracy: 1e-9)
        XCTAssertEqual(Arc.pointOverChord(from: a, to: b, sagitta: 0, at: 1.5).x, 1.5, accuracy: 1e-12)
    }

    /// A 4 × 3 room whose first wall bulges out 0.5 (T8's arc), with a door
    /// 1 m along it: centre (2, 3.75), R 4.25.
    private func curvedRoomWithDoor() -> (Room, Opening) {
        var r = Room(name: "R", corners: [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(0, 3)].map { Corner(p: $0) })
        r.walls[0].shape = .arc(sagitta: 0.5)
        let door = Opening(wallID: r.walls[0].id, kind: .door, offset: 1, width: 0.9, height: 2.03)
        r.openings = [door]
        return (r, door)
    }

    func testADoorOnACurvedWallSitsInTheCurve() throws {
        let (room, door) = curvedRoomWithDoor()
        let (s, e) = try XCTUnwrap(room.jambs(of: door))
        let centre = Vec2(2, 3.75)
        XCTAssertEqual(s.distance(to: centre), 4.25, accuracy: 1e-9)
        XCTAssertEqual(e.distance(to: centre), 4.25, accuracy: 1e-9)
        // Still 1 m and 1.9 m along the chord, as stored (§9).
        XCTAssertEqual(s.x, 1, accuracy: 1e-9)
        XCTAssertEqual(e.x, 1.9, accuracy: 1e-9)
        XCTAssertLessThan(s.y, -0.3)   // out in the bulge, not on the chord
    }

    func testADoorOnAStraightWallIsUnchanged() throws {
        var (room, door) = curvedRoomWithDoor()
        room.walls[0].shape = .straight
        let (s, e) = try XCTUnwrap(room.jambs(of: door))
        XCTAssertEqual(s.x, 1, accuracy: 1e-12); XCTAssertEqual(s.y, 0, accuracy: 1e-12)
        XCTAssertEqual(e.x, 1.9, accuracy: 1e-12); XCTAssertEqual(e.y, 0, accuracy: 1e-12)
    }

    // The 3D model's hole is cut at the same jambs, on the curve.
    func testThe3DHoleIsCutOnTheCurve() throws {
        let (room, door) = curvedRoomWithDoor()
        let (s, e) = try XCTUnwrap(room.jambs(of: door))
        let walls = try XCTUnwrap(Model3D.mesh([room]).positions[.walls])
        for jamb in [s, e] {
            XCTAssertTrue(walls.contains { abs($0.x - jamb.x) < 1e-9 && abs($0.y - jamb.y) < 1e-9 && abs($0.z - 2.03) < 1e-9 },
                          "the door head meets the jamb at \(jamb)")
        }
    }

    // And the DXF's opening line joins those jambs.
    func testTheDXFOpeningLineIsOnTheCurve() throws {
        let (room, door) = curvedRoomWithDoor()
        let (s, e) = try XCTUnwrap(room.jambs(of: door))
        let dxf = Export.dxf([room])
        let lines = dxf.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }
        let at = try XCTUnwrap(lines.firstIndex(of: "OPENINGS").flatMap { first in
            lines.indices.dropFirst(first + 1).first { lines[$0] == "OPENINGS" } })
        func value(_ code: String) -> Double? {
            guard let k = lines[at...].firstIndex(of: code) else { return nil }
            return Double(lines[k + 1])
        }
        XCTAssertEqual(try XCTUnwrap(value("10")), s.x * 1000, accuracy: 0.6)
        XCTAssertEqual(try XCTUnwrap(value("20")), s.y * 1000, accuracy: 0.6)
        XCTAssertEqual(try XCTUnwrap(value("11")), e.x * 1000, accuracy: 0.6)
        XCTAssertEqual(try XCTUnwrap(value("21")), e.y * 1000, accuracy: 0.6)
    }
}
