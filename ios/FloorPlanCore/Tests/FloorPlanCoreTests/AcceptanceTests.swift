import XCTest
@testable import FloorPlanCore

/// The spec's acceptance tests (§15) that M1 owns: T1–T5, T15–T16, plus T17
/// and the display half of T14. Tolerance 1e-3 unless the spec says otherwise.
/// Each test's comment is the spec's own arithmetic, so a failure can be
/// checked by hand.
final class AcceptanceTests: XCTestCase {

    private let tol = 1e-3
    private func v(_ x: Double, _ y: Double) -> Vec2 { Vec2(x, y) }

    // T1 — Rectangle (0,0),(4,0),(4,3),(0,3): area 12, perimeter 14, signed +12 (CCW).
    func testT1Rectangle() {
        let p = [v(0, 0), v(4, 0), v(4, 3), v(0, 3)]
        XCTAssertEqual(Polygon.signedArea(p), 12, accuracy: tol)
        XCTAssertEqual(Polygon.area(p), 12, accuracy: tol)
        XCTAssertEqual(Polygon.perimeter(p), 14, accuracy: tol)
        XCTAssertTrue(Polygon.isCounterClockwise(p))
    }

    // T2 — L-shape: shoelace terms 0+12+6+9+15+0 = 42 → 21; check 6·2 + 3·3. Perimeter 22.
    func testT2LShape() {
        let p = [v(0, 0), v(6, 0), v(6, 2), v(3, 2), v(3, 5), v(0, 5)]
        XCTAssertEqual(Polygon.area(p), 21, accuracy: tol)
        XCTAssertEqual(Polygon.perimeter(p), 22, accuracy: tol)
    }

    // T3 — Open loop of four; a tap √0.05 = 0.2236 from corner 0 closes (< 0.25),
    // giving 4 corners and area 12. A tap 0.2828 away does not, and adds a 5th.
    func testT3AutoClose() {
        let open = [v(0, 0), v(4, 0), v(4, 3), v(0, 3)]

        var closes = OutlineCapture(points: open)
        XCTAssertEqual(closes.tap(v(0.20, 0.10)), .closed)
        XCTAssertEqual(closes.room?.corners.count, 4)
        XCTAssertEqual(closes.room?.area ?? 0, 12, accuracy: tol)

        var stays = OutlineCapture(points: open)
        XCTAssertEqual(stays.tap(v(0.20, 0.20)), .added(v(0.20, 0.20), snapped: false))
        XCTAssertEqual(stays.points.count, 5)
        XCTAssertFalse(stays.isClosed)
    }

    // T4 — Existing corner (2,0). A tap at (2.02,0) is 0.02 away (< 0.03) and
    // snaps onto it; at (2.04,0), 0.04 is over the threshold, so no snap.
    func testT4VertexSnap() {
        let capture = OutlineCapture(points: [v(0, 0), v(2, 0)])
        XCTAssertEqual(capture.snapTarget(for: v(2.02, 0)), v(2, 0))
        XCTAssertNil(capture.snapTarget(for: v(2.04, 0)))

        // The snap also applies to a corner in another room on the floor.
        let neighbour = OutlineCapture(points: [v(0, 0)], neighbourCorners: [v(2, 0)])
        XCTAssertEqual(neighbour.snapTarget(for: v(2.02, 0)), v(2, 0))
    }

    // T5 — Previous corner (1,1). (1.06,1.08) is √0.01 = 0.100 away, not below
    // 0.10, so it is accepted; (1.06,1.06) is 0.0849 away and rejected.
    func testT5MinimumWall() {
        var accepted = OutlineCapture(points: [v(1, 1)])
        if case .added = accepted.tap(v(1.06, 1.08)) {} else { XCTFail("0.100 m must be accepted") }

        var rejected = OutlineCapture(points: [v(1, 1)])
        guard case .tooShort(let d) = rejected.tap(v(1.06, 1.06)) else {
            return XCTFail("0.0849 m must be rejected")
        }
        XCTAssertEqual(d, 0.0849, accuracy: 1e-4)
        XCTAssertEqual(rejected.points.count, 1)
    }

    // T15 — Bowtie (0,0),(2,2),(2,0),(0,2): edges 0 and 2 cross at (1,1), so
    // closing is refused.
    func testT15BowtieRejected() {
        let p = [v(0, 0), v(2, 2), v(2, 0), v(0, 2)]
        XCTAssertFalse(Polygon.isSimple(p))
        let crossing = Polygon.firstSelfIntersection(p)
        XCTAssertEqual(crossing?.0, 0)
        XCTAssertEqual(crossing?.1, 2)

        var capture = OutlineCapture(points: p)
        XCTAssertEqual(capture.close(), .crossesItself)
        XCTAssertFalse(capture.isClosed)
    }

    // T16 — T2's polygon given clockwise: signed −21, auto-reversed to CCW,
    // area +21, still 6 walls.
    func testT16ClockwiseReversed() {
        let ccw = [v(0, 0), v(6, 0), v(6, 2), v(3, 2), v(3, 5), v(0, 5)]
        let cw = Array(ccw.reversed())
        XCTAssertEqual(Polygon.signedArea(cw), -21, accuracy: tol)

        let room = Room(name: "L", corners: cw.map { Corner(p: $0) }).counterClockwise()
        XCTAssertEqual(room.signedArea, 21, accuracy: tol)
        XCTAssertEqual(room.walls.count, 6)

        // Through capture as well: drawing clockwise still yields a CCW room.
        var capture = OutlineCapture(points: cw)
        XCTAssertEqual(capture.close(), .closed)
        XCTAssertEqual(capture.room?.signedArea ?? 0, 21, accuracy: tol)
    }

    // T17 — T1's area in imperial: 12 · 10.7639 = 129.17 ft².
    func testT17ImperialArea() {
        XCTAssertEqual(Units.squareFeet(12), 129.17, accuracy: 0.005)
        XCTAssertEqual(Units.area(12, in: .imperial), "129.17 ft²")
        XCTAssertEqual(Units.area(12, in: .metric), "12.00 m²")
    }

    // T14, display half — 3.457 m is 11.342 ft = 11 ft 4.1 in.
    func testT14FeetInchesDisplay() {
        XCTAssertEqual(Units.feet(3.457), 11.342, accuracy: tol)
        XCTAssertEqual(Units.feetInches(3.457), "11 ft 4.1 in")
        XCTAssertEqual(Units.feetInches(12 * 0.3048), "12 ft 0.0 in")
    }
}

/// Reversal keeps every wall's attachments with the right wall — the part
/// of T16 that a corner-count check cannot see.
final class ReversalTests: XCTestCase {

    func testWallsLocksArcsAndOpeningsFollowTheReversal() {
        // A 4 × 3 rectangle drawn CLOCKWISE: (0,0) → (0,3) → (4,3) → (4,0).
        let pts = [Vec2(0, 0), Vec2(0, 3), Vec2(4, 3), Vec2(4, 0)]
        var walls = pts.map { _ in Wall() }
        // Wall 1 is the top wall, (0,3) → (4,3): locked at 4.0, bulging.
        walls[1].lockedLength = 4.0
        walls[1].shape = .arc(sagitta: 0.3)
        let door = Opening(wallID: walls[1].id, kind: .door, offset: 0.5, width: 0.9, height: 2.03)
        let cw = Room(name: "R", corners: pts.map { Corner(p: $0) }, walls: walls, openings: [door])

        let room = cw.counterClockwise()
        XCTAssertGreaterThan(room.signedArea, 0)

        // The top wall must still sit between (4,3) and (0,3), now running
        // (4,3) → (0,3), keeping its lock.
        guard let k = room.walls.firstIndex(where: { $0.id == walls[1].id }) else {
            return XCTFail("the top wall was lost")
        }
        let a = room.corners[k].p
        let b = room.corners[(k + 1) % 4].p
        XCTAssertEqual(a, Vec2(4, 3))
        XCTAssertEqual(b, Vec2(0, 3))
        XCTAssertEqual(room.walls[k].lockedLength, 4.0)
        // Bulging outward means right of travel; travel reversed, so the sign flips.
        XCTAssertEqual(room.walls[k].shape, .arc(sagitta: -0.3))
        // The door was 0.5 m from (0,3); from the new start (4,3) it is 4 − 0.5 − 0.9.
        XCTAssertEqual(room.openings[0].offset, 2.6, accuracy: 1e-9)
    }

    func testAlreadyCounterClockwiseIsUntouched() {
        let room = Room(name: "R", corners: [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(0, 3)].map { Corner(p: $0) })
        XCTAssertEqual(room.counterClockwise().corners.map(\.id), room.corners.map(\.id))
    }

    func testTouchingAndOverlappingEdgesAreNotSimple() {
        // A corner landing on a non-neighbouring edge: touches, not crosses.
        XCTAssertFalse(Polygon.isSimple([Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(2, 0), Vec2(0, 3)]))
        // An ordinary L stays simple.
        XCTAssertTrue(Polygon.isSimple([Vec2(0, 0), Vec2(6, 0), Vec2(6, 2), Vec2(3, 2), Vec2(3, 5), Vec2(0, 5)]))
    }

    func testModelRoundTripsThroughJSON() throws {
        var room = Room(name: "Kitchen", corners: [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3)].map { Corner(p: $0) })
        room.walls[0].lengthSource = .laser(deviceID: "GLM50C-1")
        room.ceiling = .vaulted(eaveHeight: 2.4, ridgeHeight: 3.6, ridgeAxis: RidgeAxis(a: Vec2(0, 1.5), b: Vec2(4, 1.5)))
        let data = try JSONEncoder().encode(room)
        let back = try JSONDecoder().decode(Room.self, from: data)
        XCTAssertEqual(back.walls[0].lengthSource, .laser(deviceID: "GLM50C-1"))
        XCTAssertEqual(back.points, room.points)
        guard case .vaulted(_, let ridge, let axis) = back.ceiling else { return XCTFail("ceiling lost") }
        XCTAssertEqual(ridge, 3.6)
        XCTAssertEqual(axis.b, Vec2(4, 1.5))
    }
}
