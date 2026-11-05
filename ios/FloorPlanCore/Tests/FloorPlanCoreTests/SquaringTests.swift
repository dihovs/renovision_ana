import XCTest
@testable import FloorPlanCore

/// The squaring solver (spec §6), against T6 and T7 and the cases around them.
final class SquaringTests: XCTestCase {

    private func room(_ pts: [(Double, Double)], locks: [Int: Double] = [:]) -> Room {
        var r = Room(name: "R", corners: pts.map { Corner(p: Vec2($0.0, $0.1)) })
        for (j, l) in locks { r.walls[j].lockedLength = l }
        return r
    }

    private func degrees(_ r: Room, _ i: Int) -> Double { Squaring.interiorAngle(r.points, i) * 180 / .pi }

    // T6 — Quad (0,0),(4,0),(4.05,3),(0,3), no locks. Area before 12.075.
    // After squaring: all four angles 90° ± 0.1°, no crossing, area in [12.0, 12.15].
    func testT6SquaresAQuad() {
        let before = room([(0, 0), (4, 0), (4.05, 3), (0, 3)])
        XCTAssertEqual(before.area, 12.075, accuracy: 1e-3)

        guard case .solved(let after) = Squaring.square(before) else { return XCTFail("T6 must solve") }
        for i in 0..<4 { XCTAssertEqual(degrees(after, i), 90, accuracy: 0.1, "corner \(i)") }
        XCTAssertTrue(after.isSimple)
        XCTAssertGreaterThanOrEqual(after.area, 12.0)
        XCTAssertLessThanOrEqual(after.area, 12.15)
        // Corner 0 is pinned and wall 0 keeps its direction (§6 gauge).
        XCTAssertEqual(after.points[0], Vec2(0, 0))
        XCTAssertEqual(after.points[1].y, 0, accuracy: 1e-9)
    }

    // T7 — T1's rectangle locked 4, 3, 4, 3.10: right angles cannot hold with
    // those lengths. Conflict; the worst residuals are walls 1 and 3 (~0.05 m
    // each); the geometry is unchanged.
    func testT7InconsistentLocksAreAConflict() {
        let before = room([(0, 0), (4, 0), (4, 3), (0, 3)], locks: [0: 4, 1: 3, 2: 4, 3: 3.10])
        guard case .conflict(let worst) = Squaring.square(before) else { return XCTFail("T7 must conflict") }

        let walls = worst.compactMap { r -> (Int, Double)? in
            if case .length(let j) = r.kind { return (j, r.value) }
            return nil
        }
        XCTAssertEqual(Set(walls.prefix(2).map(\.0)), [1, 3])
        for (_, off) in walls.prefix(2) { XCTAssertEqual(abs(off), 0.05, accuracy: 0.005) }
        XCTAssertFalse(walls.contains { $0.0 == 0 || $0.0 == 2 }, "walls 0 and 2 agree with the right angles")
        // "The geometry is unchanged": the input room is a value and conflict
        // returns no room — nothing for a caller to apply.
        XCTAssertEqual(before.points, [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(0, 3)])
    }

    // T7 drawn CLOCKWISE: the solver works counter-clockwise internally, so
    // its indices are reversed — the ids must still name the caller's walls.
    func testT7ClockwiseNamesTheCallersWalls() {
        // (0,0) → (0,3) → (4,3) → (4,0): walls 0 and 2 are the 3 m sides.
        let before = room([(0, 0), (0, 3), (4, 3), (4, 0)], locks: [0: 3.10, 1: 4, 2: 3, 3: 4])
        guard case .conflict(let worst) = Squaring.square(before) else { return XCTFail("must conflict") }
        let named = Set(worst.prefix(2).compactMap(\.wallID))
        XCTAssertEqual(named, [before.walls[0].id, before.walls[2].id])
    }

    // A lock is kept to the millimetre while the room squares around it.
    // (MagicPlan's own suite has the same case: lock the bottom wall at 4.20.)
    func testLockedWallIsHeldWhileSquaring() {
        let before = room([(0, 0), (4.05, 0.03), (4.02, 3.01), (-0.02, 2.98)], locks: [0: 4.20])
        guard case .solved(let after) = Squaring.square(before) else { return XCTFail("must solve") }
        XCTAssertEqual(after.wallLength(0), 4.20, accuracy: 0.001)
        XCTAssertEqual(after.wallLength(2), 4.20, accuracy: 0.002, "opposite wall follows the lock")
        for i in 0..<4 { XCTAssertEqual(degrees(after, i), 90, accuracy: 0.1) }
    }

    // A real 45° corner wall is further than 10° from any multiple of 90°,
    // so it is left as drawn while the square corners around it are squared.
    func testRealAngledWallIsNotForcedSquare() {
        // 14' × 12' with one corner cut at 45°, in metres, a little noisy.
        let ft = 0.3048
        let before = room([
            (0, 0), (14 * ft + 0.02, 0), (14 * ft, 9 * ft + 0.02), (11 * ft, 12 * ft), (0, 12 * ft - 0.02),
        ])
        guard case .solved(let after) = Squaring.square(before) else { return XCTFail("must solve") }
        XCTAssertEqual(degrees(after, 0), 90, accuracy: 0.1)
        XCTAssertEqual(degrees(after, 1), 90, accuracy: 0.1)
        XCTAssertEqual(degrees(after, 4), 90, accuracy: 0.1)
        // The two chamfer corners are each 135°, and stay near it — not 90, not 180.
        XCTAssertEqual(degrees(after, 2), 135, accuracy: 2)
        XCTAssertEqual(degrees(after, 3), 135, accuracy: 2)
    }

    // An L-shape, a degree or so off everywhere, comes out with six exact
    // corners: five at 90° and the inside corner at 270°.
    func testLShapeSquaresIncludingTheReflexCorner() {
        let before = room([(0, 0), (6.03, 0.02), (6.0, 2.04), (3.02, 1.98), (2.97, 5.02), (0.03, 4.98)])
        guard case .solved(let after) = Squaring.square(before) else { return XCTFail("must solve") }
        let expected = [90.0, 90, 90, 270, 90, 90]
        for i in 0..<6 { XCTAssertEqual(degrees(after, i), expected[i], accuracy: 0.1, "corner \(i)") }
        XCTAssertEqual(after.area, 21, accuracy: 0.25)
    }

    // Already square: nothing to do, nothing moves.
    func testSquareRoomIsUnchanged() {
        let before = room([(0, 0), (4, 0), (4, 3), (0, 3)])
        guard case .solved(let after) = Squaring.square(before) else { return XCTFail("must solve") }
        for (a, b) in zip(after.points, before.points) { XCTAssertEqual(a.distance(to: b), 0, accuracy: 1e-6) }
    }

    // Ids, locks and openings survive — squaring moves corners and nothing else.
    func testSquaringKeepsIdentity() {
        var before = room([(0, 0), (4, 0), (4.05, 3), (0, 3)], locks: [0: 4])
        before.openings = [Opening(wallID: before.walls[1].id, kind: .door, offset: 1, width: 0.9, height: 2.03)]
        guard case .solved(let after) = Squaring.square(before) else { return XCTFail("must solve") }
        XCTAssertEqual(after.corners.map(\.id), before.corners.map(\.id))
        XCTAssertEqual(after.walls.map(\.id), before.walls.map(\.id))
        XCTAssertEqual(after.walls[0].lockedLength, 4)
        XCTAssertEqual(after.openings.map(\.id), before.openings.map(\.id))
    }

    func testInteriorAngleConvention() {
        // CCW rectangle: every interior angle 90°; CCW L: the inside corner 270°.
        let rect = [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(0, 3)]
        XCTAssertEqual(Squaring.interiorAngle(rect, 0) * 180 / .pi, 90, accuracy: 1e-9)
        let l = [Vec2(0, 0), Vec2(6, 0), Vec2(6, 2), Vec2(3, 2), Vec2(3, 5), Vec2(0, 5)]
        XCTAssertEqual(Squaring.interiorAngle(l, 3) * 180 / .pi, 270, accuracy: 1e-9)
    }
}
