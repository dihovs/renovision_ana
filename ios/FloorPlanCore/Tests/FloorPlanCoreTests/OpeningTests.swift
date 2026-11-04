import XCTest
@testable import FloorPlanCore

/// Openings and wall area (spec §9, T11–T12).
final class OpeningTests: XCTestCase {

    /// A 4 m × 3 m room with a flat ceiling; wall 0 is the 4 m bottom wall.
    private func room(ceiling: Double = 2.4) -> Room {
        Room(name: "R", corners: [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(0, 3)].map { Corner(p: $0) },
             ceiling: .flat(height: ceiling))
    }

    // T11 — Wall 4 m, flat 2.4: gross 9.60. Door 0.9 × 2.1 (1.89) → 7.71.
    // Window 1.2 × 1.0 (1.20) → 6.51.
    func testT11NetWallArea() {
        var r = room()
        let wall = r.walls[0].id
        XCTAssertEqual(r.grossWallArea(0), 9.60, accuracy: 1e-3)
        r.openings.append(Opening(wallID: wall, kind: .door, offset: 0.2, width: 0.9, height: 2.1))
        XCTAssertEqual(r.netWallArea(0), 7.71, accuracy: 1e-3)
        r.openings.append(Opening(wallID: wall, kind: .window, offset: 2.0, width: 1.2, height: 1.0, sillHeight: 0.9))
        XCTAssertEqual(r.netWallArea(0), 6.51, accuracy: 1e-3)
        // The other three walls are untouched.
        XCTAssertEqual(r.netWallArea(1), 3 * 2.4, accuracy: 1e-3)
    }

    // T12 — Wall 4 m, door 0.9: at offset 3.5, 4.4 > 3.98 → rejected. At
    // offset 3.08, 3.98 is not over 3.98 → accepted.
    func testT12OpeningMustFitItsWall() {
        let r = room()
        let wall = r.walls[0].id
        let late = Opening(wallID: wall, kind: .door, offset: 3.5, width: 0.9, height: 2.03)
        guard case .pastWallEnd(let by)? = r.issues(for: late).first else { return XCTFail("3.5 must be rejected") }
        XCTAssertEqual(by, 0.42, accuracy: 1e-9)

        let flush = Opening(wallID: wall, kind: .door, offset: 3.08, width: 0.9, height: 2.03)
        XCTAssertEqual(r.issues(for: flush), [])
    }

    func testStartAtTheCornerIsAllowedButNotBeforeIt() {
        let r = room()
        let wall = r.walls[0].id
        XCTAssertEqual(r.issues(for: Opening(wallID: wall, kind: .door, offset: 0, width: 0.9, height: 2)), [])
        XCTAssertEqual(
            r.issues(for: Opening(wallID: wall, kind: .door, offset: -0.01, width: 0.9, height: 2)),
            [.startsBeforeWall])
    }

    func testSillPlusHeightMustStayUnderTheCeiling() {
        let r = room(ceiling: 2.0)
        let wall = r.walls[0].id
        // 0.9 + 1.2 = 2.1 over a 2.0 ceiling.
        let window = Opening.window(on: wall, offset: 1)
        guard case .aboveCeiling(let by)? = r.issues(for: window).first else { return XCTFail("must refuse") }
        XCTAssertEqual(by, 0.1, accuracy: 1e-9)
        // Exactly at the ceiling is fine.
        let fits = Opening(wallID: wall, kind: .window, offset: 1, width: 1, height: 1.1, sillHeight: 0.9)
        XCTAssertEqual(r.issues(for: fits), [])
    }

    func testOpeningsOnOneWallMustNotOverlap() {
        var r = room()
        let wall = r.walls[0].id
        let first = Opening(wallID: wall, kind: .door, offset: 0.5, width: 0.9, height: 2)
        r.openings = [first]
        let clash = Opening(wallID: wall, kind: .window, offset: 1.2, width: 1, height: 1, sillHeight: 0.9)
        XCTAssertEqual(r.issues(for: clash), [.overlaps(first.id)])
        // Jamb to jamb is fine.
        let beside = Opening(wallID: wall, kind: .window, offset: 1.4, width: 1, height: 1, sillHeight: 0.9)
        XCTAssertEqual(r.issues(for: beside), [])
        // Moving the existing door does not collide with itself.
        var moved = first
        moved.offset = 0.6
        XCTAssertEqual(r.issues(for: moved), [])
        // A different wall is a different wall.
        let otherWall = Opening(wallID: r.walls[2].id, kind: .door, offset: 0.5, width: 0.9, height: 2)
        XCTAssertEqual(r.issues(for: otherWall), [])
    }

    func testDeductionStopsAtTheCeiling() {
        // A 2.4 m-tall opening on a 0.3 m sill under a 2.4 m ceiling: only
        // 2.1 m of it is wall that existed.
        var r = room()
        r.openings = [Opening(wallID: r.walls[0].id, kind: .opening, offset: 1, width: 1, height: 2.4, sillHeight: 0.3)]
        XCTAssertEqual(r.netWallArea(0), 9.6 - 2.1, accuracy: 1e-9)
    }

    func testSpecDefaults() {
        let d = Opening.door(on: UUID(), offset: 0)
        XCTAssertEqual(d.width, 0.81)
        XCTAssertEqual(d.height, 2.03)
        XCTAssertEqual(d.sillHeight, 0)
        let w = Opening.window(on: UUID(), offset: 0)
        XCTAssertEqual([w.width, w.height, w.sillHeight], [1.0, 1.2, 0.9])
    }

    func testRoomTotals() {
        let r = room()
        XCTAssertEqual(r.grossWallArea, 14 * 2.4, accuracy: 1e-9)
        XCTAssertEqual(r.netWallArea, r.grossWallArea, accuracy: 1e-9)
    }
}
