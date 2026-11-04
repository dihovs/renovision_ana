import XCTest
@testable import FloorPlanCore

/// Rooms side by side (spec §12, T13).
final class AlignmentTests: XCTestCase {

    private func rect(_ x: Double, _ y: Double, _ w: Double, _ h: Double) -> [Vec2] {
        [Vec2(x, y), Vec2(x + w, y), Vec2(x + w, y + h), Vec2(x, y + h)]
    }

    // T13 — Room A = T1. Room B 3×3 dropped at x = 4.06: gap 0.06 < 0.10, so B
    // snaps by −0.06 to (4,0),(7,0),(7,3),(4,3). Shared wall 3.0 m. Net 21.000.
    func testT13SnapAndShare() {
        let a = rect(0, 0, 4, 3)
        let b = rect(4.06, 0, 3, 3)
        guard let snap = Alignment.snap(moving: b, neighbours: [a]) else { return XCTFail("0.06 must snap") }
        XCTAssertEqual(snap.gapClosed, 0.06, accuracy: 1e-9)
        XCTAssertEqual(snap.rotation, 0, accuracy: 1e-12)
        let placed = Alignment.apply(snap, to: b)
        for (p, q) in zip(placed, rect(4, 0, 3, 3)) { XCTAssertEqual(p.distance(to: q), 0, accuracy: 1e-9) }

        let shared = Alignment.sharedWalls([a, placed])
        XCTAssertEqual(shared.count, 1)
        XCTAssertEqual(shared.first?.overlap ?? 0, 3.0, accuracy: 1e-9)
        XCTAssertEqual(shared.first?.wallA, 1) // A's right wall
        XCTAssertEqual(shared.first?.wallB, 3) // B's left wall

        let rooms = [a, placed].map { Room(name: "", corners: $0.map { Corner(p: $0) }) }
        XCTAssertEqual(Alignment.netArea(rooms), 21.000, accuracy: 1e-3)
    }

    func testTooFarDoesNotSnap() {
        XCTAssertNil(Alignment.snap(moving: rect(4.12, 0, 3, 3), neighbours: [rect(0, 0, 4, 3)]))
    }

    // A few degrees off: turned exactly anti-parallel, then closed.
    func testSlightlyTurnedRoomIsSquaredAndClosed() {
        let a = rect(0, 0, 4, 3)
        let pivot = Vec2(5.5, 1.5)
        let b = rect(4.05, 0, 3, 3).map { Alignment.rotate($0, by: 2 * .pi / 180, about: pivot) }
        guard let snap = Alignment.snap(moving: b, neighbours: [a]) else { return XCTFail("must snap") }
        let placed = Alignment.apply(snap, to: b)
        // Its left wall now lies exactly on x = 4.
        XCTAssertEqual(placed[0].x, 4, accuracy: 1e-9)
        XCTAssertEqual(placed[3].x, 4, accuracy: 1e-9)
        // 5° off is a real angle, not a snap.
        let turned = rect(4.05, 0, 3, 3).map { Alignment.rotate($0, by: 5 * .pi / 180, about: pivot) }
        XCTAssertNil(Alignment.snap(moving: turned, neighbours: [a]))
    }

    // A partition apart: snap to one wall thickness instead of flush.
    func testSnapLeavingAPartition() {
        let a = rect(0, 0, 4, 3)
        guard let snap = Alignment.snap(moving: rect(4.15, 0, 3, 3), neighbours: [a], gap: 0.114) else {
            return XCTFail("must snap")
        }
        XCTAssertEqual(Alignment.apply(snap, to: rect(4.15, 0, 3, 3))[0].x, 4.114, accuracy: 1e-9)
        XCTAssertEqual(Alignment.sharedWalls([a, rect(4.114, 0, 3, 3)], gap: 0.114).count, 1)
    }

    func testShortOverlapIsNotShared() {
        // B only overlaps A's right wall by 0.25 m.
        XCTAssertEqual(Alignment.sharedWalls([rect(0, 0, 4, 3), rect(4, 2.75, 3, 3)]).count, 0)
        XCTAssertEqual(Alignment.sharedWalls([rect(0, 0, 4, 3), rect(4, 2.7, 3, 3)]).count, 1)
    }

    // Gross: each room grown by half of a 0.12 wall. Flush rooms overlap in
    // their growth and the union counts it once: −0.06…7.06 × −0.06…3.06.
    func testGrossAreaIsTheUnionOfHalfWallOutlines() {
        let gross = Alignment.grossArea([rect(0, 0, 4, 3), rect(4, 0, 3, 3)], wallThickness: 0.12)
        XCTAssertEqual(gross, 7.12 * 3.12, accuracy: 1e-9)
        // A partition apart, the two growths meet exactly: same outline.
        let apart = Alignment.grossArea([rect(0, 0, 4, 3), rect(4.12, 0, 3, 3)], wallThickness: 0.12)
        XCTAssertEqual(apart, 7.24 * 3.12, accuracy: 1e-9)
    }

    func testUnionOfAnLAndAnOverlappingSquare() {
        // An L (area 21) and a 2×2 square overlapping it by 1 in a corner.
        let l = [Vec2(0, 0), Vec2(6, 0), Vec2(6, 2), Vec2(3, 2), Vec2(3, 5), Vec2(0, 5)]
        let sq = rect(5, 1, 2, 2) // overlaps the L on (5..6)×(1..2) = 1
        XCTAssertEqual(Alignment.unionArea([l, sq]), 21 + 4 - 1, accuracy: 1e-9)
    }
}
