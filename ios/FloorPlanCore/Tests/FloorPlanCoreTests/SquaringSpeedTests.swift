import XCTest
@testable import FloorPlanCore

final class SquaringSpeedTests: XCTestCase {
    /// A 12-corner room drawn a little crooked squares in well under a
    /// second (it runs on the main thread when a room is closed).
    func testTwelveCornersIsQuick() {
        let pts: [Vec2] = [
            Vec2(0, 0), Vec2(5, 0.05), Vec2(5.02, 2), Vec2(4, 2.03), Vec2(4.03, 3), Vec2(6, 3.02),
            Vec2(6.01, 6), Vec2(3, 6.05), Vec2(2.97, 5), Vec2(1, 5.02), Vec2(1.02, 4), Vec2(-0.03, 4.01),
        ]
        let room = Room(name: "", corners: pts.map { Corner(p: $0) })
        let start = Date()
        guard case .solved = Squaring.square(room, tuning: .onClose) else { return XCTFail("conflict") }
        let seconds = Date().timeIntervalSince(start)
        print("12-corner onClose squaring: \(seconds)s")
        XCTAssertLessThan(seconds, 0.5)
    }
}
