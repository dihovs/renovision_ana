import XCTest
@testable import FloorPlanCore

/// magicplan's drawing rules (POLYGON_LOGIC Parts A, B, D), one test per
/// idea in the study's "Ideas to test" list that these rules cover.
final class MagicplanRulesTests: XCTestCase {

    private func room(_ pts: [Vec2]) -> Room {
        Room(name: "", corners: pts.map { Corner(p: $0) }).counterClockwise()
    }

    private func angles(_ r: Room) -> [Double] {
        let p = r.points
        return p.indices.map { Squaring.interiorAngle(p, $0) * 180 / .pi }
    }

    /// A 4 × 3 room with one corner pushed so that it is about 5° off square.
    private var skewed: [Vec2] { [Vec2(0, 0), Vec2(4, 0), Vec2(4.1, 3), Vec2(0, 3)] }

    // Idea 1, for an ordinary corner: 5° off squares (tolerance 7°).
    func testOrdinaryCornerFiveDegreesOffSquares() {
        guard case .solved(let out) = Squaring.square(room(skewed), tuning: .onClose) else {
            return XCTFail("conflict")
        }
        for a in angles(out) { XCTAssertEqual(a, 90, accuracy: 0.1) }
    }

    // …and 9° off does not (7° tolerance), where the flat 10° would square it.
    func testOrdinaryCornerNineDegreesOffStays() {
        let p = [Vec2(0, 0), Vec2(4, 0), Vec2(4.48, 3), Vec2(0, 3)]  // ≈ 9.1°
        let tuning = SolverTuning.onClose
        let targets = Squaring.angleTargets(room(p), room(p).points, tuning)
        XCTAssertLessThan(targets.count, 4)
        var flat = SolverTuning()
        flat.squareTolDegrees = 10
        XCTAssertEqual(Squaring.angleTargets(room(p), room(p).points, flat).count, 4)
    }

    // A right angle at the end of a short wall is forgiving: 20°.
    func testShortWallCornerIsForgiving() {
        let p = [Vec2(0, 0), Vec2(3, 0), Vec2(3, 2), Vec2(2.6, 2.05), Vec2(2.6, 3), Vec2(0, 3)]
        let r = room(p)
        let pts = r.points
        let i = pts.firstIndex { abs($0.x - 3) < 1e-9 && abs($0.y - 2) < 1e-9 }!
        XCTAssertEqual(Squaring.cornerTolerance(pts, i), 20)
    }

    // Wall lengths are kept while squaring: no wall moves more than ~6 cm.
    func testDrawnLengthsKept() {
        guard case .solved(let out) = Squaring.square(room(skewed), tuning: .onClose) else {
            return XCTFail("conflict")
        }
        let before = room(skewed).points, after = out.points
        for j in before.indices {
            let a = before[j].distance(to: before[(j + 1) % 4])
            let b = after[j].distance(to: after[(j + 1) % 4])
            XCTAssertEqual(a, b, accuracy: 0.06)
        }
    }

    // A lock still wins over the drawn lengths.
    func testLockStillWins() {
        var r = room(skewed)
        r.walls[0].lockedLength = 4.2
        guard case .solved(let out) = Squaring.square(r, tuning: .onClose) else {
            return XCTFail("conflict")
        }
        XCTAssertEqual(out.points[0].distance(to: out.points[1]), 4.2, accuracy: 0.001)
    }

    // Aim hint: 3° off a right turn snaps to 90°, keeping the length.
    func testAimHintSnapsNearRightTurn() {
        let pts = [Vec2(0, 0), Vec2(3, 0)]
        let a = 93.0 * .pi / 180
        let aim = Vec2(3 + 0.8 * cos(a), 0.8 * sin(a))
        let hint = AimHint.hint(points: pts, aim: aim)
        XCTAssertEqual(hint?.degrees, 90)
        XCTAssertEqual(hint!.point.x, 3, accuracy: 1e-9)
        XCTAssertEqual(hint!.point.y, 0.8, accuracy: 1e-9)
    }

    // …a 45° wall gets the 45° hint; 60° gets none.
    func testAimHint45AndNone() {
        let pts = [Vec2(0, 0), Vec2(3, 0)]
        func aim(_ deg: Double) -> Vec2 {
            Vec2(3 + 1.0 * cos(deg * .pi / 180), 1.0 * sin(deg * .pi / 180))
        }
        XCTAssertEqual(AimHint.hint(points: pts, aim: aim(-46))?.degrees, -45)
        XCTAssertNil(AimHint.hint(points: pts, aim: aim(60)))
    }

    // No hint off a wall under 0.3 m, or with the aim right on the corner.
    func testAimHintNeedsAWallAndReach() {
        XCTAssertNil(AimHint.hint(points: [Vec2(0, 0), Vec2(0.2, 0)], aim: Vec2(0.2, 1)))
        XCTAssertNil(AimHint.hint(points: [Vec2(0, 0), Vec2(3, 0)], aim: Vec2(3, 0.1)))
    }

    // Close rule: an L of three corners already enclosing a room may close;
    // a sliver may not; aiming at the first corner always may.
    func testCloseRule() {
        let l = [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3)]
        XCTAssertTrue(CloseRule.canClose(points: l))  // a triangle is a room
        // A run of walls going nowhere: the closing wall would meet the
        // first wall almost straight on.
        let run = [Vec2(0, 0), Vec2(3, 0), Vec2(5, 1.5), Vec2(7, 0.9)]
        XCTAssertFalse(CloseRule.canClose(points: run))
        let u = [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(0, 3)]
        XCTAssertTrue(CloseRule.canClose(points: u))
        let sliver = [Vec2(0, 0), Vec2(4, 0), Vec2(4, 0.2), Vec2(0, 0.2)]
        XCTAssertFalse(CloseRule.canClose(points: sliver))
        XCTAssertTrue(CloseRule.canClose(points: l, aim: Vec2(0.1, 0.1)))
    }
}
