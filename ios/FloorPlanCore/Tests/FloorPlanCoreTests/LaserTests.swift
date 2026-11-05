import XCTest
@testable import FloorPlanCore

/// Laser-meter readings (spec §13, T14).
final class LaserTests: XCTestCase {

    private func room() -> Room {
        Room(name: "R", corners: [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(0, 3)].map { Corner(p: $0) })
    }

    // T14 — a 3.457 m reading with wall 2 selected: wall 2 gets lockedLength
    // 3.457 and source .laser, and the selection moves to wall 3. Imperial
    // display 11 ft 4.1 in.
    func testT14ReadingLocksTheSelectedWallAndMovesOn() {
        var a = LaserAssignment(room: room(), selected: 2)
        a.receive(LaserReading(meters: 3.457, deviceID: "GLM-1"))
        XCTAssertEqual(a.room.walls[2].lockedLength, 3.457)
        XCTAssertEqual(a.room.walls[2].lengthSource, .laser(deviceID: "GLM-1"))
        XCTAssertEqual(a.selected, 3)
        XCTAssertEqual(Units.feetInches(3.457), "11 ft 4.1 in")
        // And round the corner back to wall 0.
        a.receive(LaserReading(meters: 3.0, deviceID: "GLM-1"))
        XCTAssertEqual(a.selected, 0)
    }

    func testNothingSelectedGoesToTheTrayThenOntoAWall() {
        var a = LaserAssignment(room: room())
        let r = LaserReading(meters: 4.02, deviceID: "sim")
        a.receive(r)
        XCTAssertEqual(a.pending.map(\.id), [r.id])
        XCTAssertNil(a.room.walls[0].lockedLength)
        a.place(r.id, on: 0)
        XCTAssertEqual(a.pending, [])
        XCTAssertEqual(a.room.walls[0].lockedLength, 4.02)
        XCTAssertEqual(a.selected, 1)
    }

    func testUndoTakesBackOneStep() {
        var a = LaserAssignment(room: room(), selected: 0)
        a.receive(LaserReading(meters: 4.1, deviceID: "sim"))
        a.receive(LaserReading(meters: 3.1, deviceID: "sim"))
        a.undo()
        XCTAssertEqual(a.room.walls[0].lockedLength, 4.1)
        XCTAssertNil(a.room.walls[1].lockedLength)
        XCTAssertEqual(a.selected, 1)
        a.undo()
        XCTAssertNil(a.room.walls[0].lockedLength)
        XCTAssertEqual(a.selected, 0)
        XCTAssertFalse(a.canUndo)
    }

    func testUnbelievableReadingsAreRefused() {
        var a = LaserAssignment(room: room(), selected: 0)
        a.receive(LaserReading(meters: 0, deviceID: "sim"))
        a.receive(LaserReading(meters: 250, deviceID: "sim"))
        XCTAssertNil(a.room.walls[0].lockedLength)
        XCTAssertEqual(a.selected, 0)
        XCTAssertNil(Laser.validated(-1))
        XCTAssertEqual(Laser.validated(200), 200)
    }

    func testPayloadDecoding() {
        // 3.457 as little-endian Float32.
        let f = Float(3.457).bitPattern
        let bytes = [UInt8(f & 0xFF), UInt8((f >> 8) & 0xFF), UInt8((f >> 16) & 0xFF), UInt8(f >> 24)]
        XCTAssertEqual(LaserPayload.float32Meters(offset: 0).meters(from: bytes) ?? 0, 3.457, accuracy: 1e-6)
        // The same number in feet with a units byte of 1.
        let ft = Float(11.342).bitPattern
        let ftBytes = [UInt8(1), UInt8(ft & 0xFF), UInt8((ft >> 8) & 0xFF), UInt8((ft >> 16) & 0xFF), UInt8(ft >> 24)]
        XCTAssertEqual(
            LaserPayload.float32WithUnit(offset: 1, unitOffset: 0).meters(from: ftBytes) ?? 0, 3.457, accuracy: 1e-3)
        // 3457 mm as a little-endian UInt16: 0x0D81.
        XCTAssertEqual(LaserPayload.intMillimeters(offset: 0, bytes: 2).meters(from: [0x81, 0x0D]), 3.457)
        // Too short, or not a distance.
        XCTAssertNil(LaserPayload.float32Meters(offset: 0).meters(from: [1, 2]))
        XCTAssertNil(LaserPayload.intMillimeters(offset: 0, bytes: 2).meters(from: [0, 0]))
    }
}
