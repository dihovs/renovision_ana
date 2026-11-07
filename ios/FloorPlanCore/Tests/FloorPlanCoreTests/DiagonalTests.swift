import XCTest
@testable import FloorPlanCore

final class DiagonalTests: XCTestCase {
    let rect = [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(0, 3)]

    func testSquareRoomKeepsItsShapeAtItsOwnDiagonal() throws {
        let p = try XCTUnwrap(Diagonals.apply(rect, [Diagonal(a: 0, b: 2, length: 5)]))
        for (a, b) in zip(p, rect) { XCTAssertEqual(a.distance(to: b), 0, accuracy: 0.001) }
    }

    func testALongerDiagonalLeansTheRoomButKeepsEveryWall() throws {
        let p = try XCTUnwrap(Diagonals.apply(rect, [Diagonal(a: 0, b: 2, length: 5.2)]))
        XCTAssertEqual(p[0].distance(to: p[2]), 5.2, accuracy: 0.002)
        for j in 0..<4 {
            XCTAssertEqual(
                p[j].distance(to: p[(j + 1) % 4]), rect[j].distance(to: rect[(j + 1) % 4]), accuracy: 0.002)
        }
        // Out of square now: corner 1 is no longer 90°.
        let v1 = p[0] - p[1], v2 = p[2] - p[1]
        let cos = (v1.x * v2.x + v1.y * v2.y) / (3 * 4)
        XCTAssertGreaterThan(abs(cos), 0.05)
    }

    func testAnImpossibleDiagonalIsRefused() {
        XCTAssertNil(Diagonals.apply(rect, [Diagonal(a: 0, b: 2, length: 7.5)]))
    }

    func testAdjacentCornersAreNotADiagonal() {
        XCTAssertFalse(Diagonal.allowed(0, 1, count: 4))
        XCTAssertFalse(Diagonal.allowed(0, 3, count: 4))
        XCTAssertTrue(Diagonal.allowed(1, 3, count: 4))
    }
}
