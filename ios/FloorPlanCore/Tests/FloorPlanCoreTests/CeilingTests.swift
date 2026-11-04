import XCTest
@testable import FloorPlanCore

/// Ceilings, volume and wall area (spec §11, T10).
final class CeilingTests: XCTestCase {

    /// T1's 4 × 3 room. Walls: 0 bottom (y=0), 1 right (x=4), 2 top (y=3), 3 left.
    private func rect(_ ceiling: (Room) -> CeilingProfile) -> Room {
        var r = Room(name: "R", corners: [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(0, 3)].map { Corner(p: $0) })
        r.ceiling = ceiling(r)
        return r
    }

    // T10 — T1's room, sloped 2.4 m at the wall y=0 rising to 3.0 m at the
    // wall y=3. Volume 12 · 2.7 = 32.400. Walls 9.6 + 12.0 + 8.1 + 8.1 =
    // 37.800. α = atan(0.6/3) = 11.310°. Ceiling 4 · √9.36 = 12.2376.
    func testT10SlopedCeiling() {
        let r = rect { .sloped(lowHeight: 2.4, highHeight: 3.0, lowWallID: $0.walls[0].id, highWallID: $0.walls[2].id) }
        XCTAssertEqual(r.ceilingIssues, [])
        XCTAssertEqual(r.volume, 32.400, accuracy: 1e-3)
        XCTAssertEqual(r.grossWallArea(0), 9.6, accuracy: 1e-3)
        XCTAssertEqual(r.grossWallArea(2), 12.0, accuracy: 1e-3)
        XCTAssertEqual(r.grossWallArea(1), 8.1, accuracy: 1e-3)
        XCTAssertEqual(r.grossWallArea(3), 8.1, accuracy: 1e-3)
        XCTAssertEqual(r.grossWallArea, 37.800, accuracy: 1e-3)
        XCTAssertEqual(r.slopePlane(low: 2.4, high: 3.0, lowWallID: r.walls[0].id, highWallID: r.walls[2].id)!.angle * 180 / .pi,
                       11.310, accuracy: 1e-3)
        XCTAssertEqual(r.ceilingSurfaceArea, 12.2376, accuracy: 1e-3)
        XCTAssertEqual(r.ceilingHeight(at: Vec2(2, 1.5)), 2.7, accuracy: 1e-9)
    }

    func testFlatCeiling() {
        let r = rect { _ in .flat(height: 2.44) }
        XCTAssertEqual(r.volume, 12 * 2.44, accuracy: 1e-9)
        XCTAssertEqual(r.grossWallArea, 14 * 2.44, accuracy: 1e-9)
        XCTAssertEqual(r.ceilingSurfaceArea, 12, accuracy: 1e-9)
    }

    // A gable: ridge along the room's middle (y = 1.5) at 3.0, eaves 2.4 on
    // the long walls. Each half is 4 × 1.5 averaging 2.7 → volume 32.4.
    // Long walls 4 × 2.4 = 9.6 each. Gable ends: 3 × 2.4 + ½ · 3 · 0.6 =
    // 8.1 each. Ceiling: two planes of 6 m² at tan α = 0.6 / 1.5.
    func testVaultedGable() {
        let r = rect { _ in .vaulted(eaveHeight: 2.4, ridgeHeight: 3.0, ridgeAxis: RidgeAxis(a: Vec2(0, 1.5), b: Vec2(4, 1.5))) }
        XCTAssertEqual(r.ceilingIssues, [])
        XCTAssertEqual(r.volume, 32.4, accuracy: 1e-3)
        XCTAssertEqual(r.grossWallArea(0), 9.6, accuracy: 1e-3)
        XCTAssertEqual(r.grossWallArea(2), 9.6, accuracy: 1e-3)
        XCTAssertEqual(r.grossWallArea(1), 8.1, accuracy: 1e-3)
        XCTAssertEqual(r.grossWallArea(3), 8.1, accuracy: 1e-3)
        let cosA = 1.5 / (1.5 * 1.5 + 0.36).squareRoot()
        XCTAssertEqual(r.ceilingSurfaceArea, 2 * 6 / cosA, accuracy: 1e-3)
        XCTAssertEqual(r.ceilingHeight(at: Vec2(1, 1.5)), 3.0, accuracy: 1e-9)
        XCTAssertEqual(r.ceilingHeight(at: Vec2(1, 0)), 2.4, accuracy: 1e-9)
    }

    // A bulkhead: base 2.4, a 0.6 m strip along wall 0 dropped to 2.1.
    // Volume 2.4 · 2.1 + 9.6 · 2.4 = 28.08. Wall 0 runs under it: 4 · 2.1.
    // The side walls are 0.6 at 2.1 and 2.4 at 2.4: 7.02 each.
    func testZonesWithABulkhead() {
        let strip = HeightZone(polygon: [Vec2(0, 0), Vec2(4, 0), Vec2(4, 0.6), Vec2(0, 0.6)], height: 2.1)
        let r = rect { _ in .zones(base: 2.4, zones: [strip]) }
        XCTAssertEqual(r.ceilingIssues, [])
        XCTAssertEqual(r.volume, 28.08, accuracy: 1e-3)
        XCTAssertEqual(r.grossWallArea(0), 8.4, accuracy: 1e-3)
        XCTAssertEqual(r.grossWallArea(2), 9.6, accuracy: 1e-3)
        XCTAssertEqual(r.grossWallArea(1), 7.02, accuracy: 0.01)
        XCTAssertEqual(r.ceilingSurfaceArea, 12, accuracy: 1e-9)
    }

    func testZoneOutsideTheRoomIsReported() {
        let spill = HeightZone(polygon: [Vec2(3, 0), Vec2(5, 0), Vec2(5, 1), Vec2(3, 1)], height: 2.1)
        let r = rect { _ in .zones(base: 2.4, zones: [spill]) }
        XCTAssertEqual(r.ceilingIssues, [.zoneOutsideRoom(0)])
    }

    // Under a slope a window fits at the high end of a side wall and not at
    // the low end: the check is against the ceiling over its own span.
    func testOpeningUnderASlope() {
        var r = rect { .sloped(lowHeight: 2.0, highHeight: 3.0, lowWallID: $0.walls[0].id, highWallID: $0.walls[2].id) }
        let side = r.walls[1].id // runs (4,0) → (4,3), low end first
        let low = Opening(wallID: side, kind: .window, offset: 0.2, width: 0.8, height: 1.4, sillHeight: 0.9)
        let high = Opening(wallID: side, kind: .window, offset: 2.0, width: 0.8, height: 1.4, sillHeight: 0.9)
        if case .aboveCeiling? = r.issues(for: low).first {} else { XCTFail("2.3 m over a 2.07 m ceiling must not fit") }
        XCTAssertEqual(r.issues(for: high), [])
        // And its deduction is the whole window, which is all under the ceiling.
        r.openings = [high]
        XCTAssertEqual(r.netWallArea(1), r.grossWallArea(1) - 0.8 * 1.4, accuracy: 1e-6)
    }

    func testSlopeOnAWrongWallIsReported() {
        let r = rect { .sloped(lowHeight: 2.4, highHeight: 3.0, lowWallID: $0.walls[0].id, highWallID: $0.walls[0].id) }
        XCTAssertEqual(r.ceilingIssues, [.noRun])
        let s = rect { _ in .sloped(lowHeight: 2.4, highHeight: 3.0, lowWallID: UUID(), highWallID: UUID()) }
        XCTAssertEqual(s.ceilingIssues, [.unknownWall])
    }

    func testCurvedWallUnderAFlatCeiling() {
        var r = rect { _ in .flat(height: 2.4) }
        r.walls[0].shape = .arc(sagitta: 0.5) // bows out of the room, below y = 0
        XCTAssertEqual(r.volume, r.area * 2.4, accuracy: 1e-9)
        XCTAssertEqual(r.grossWallArea(0), Arc(chord: 4, sagitta: 0.5).length * 2.4, accuracy: 1e-9)
    }

    func testZonesRoundTripThroughJSON() throws {
        let r = rect { _ in .zones(base: 2.4, zones: [HeightZone(polygon: [Vec2(0, 0), Vec2(1, 0), Vec2(1, 1)], height: 2.1)]) }
        let back = try JSONDecoder().decode(Room.self, from: JSONEncoder().encode(r))
        guard case .zones(let base, let zones) = back.ceiling else { return XCTFail("lost") }
        XCTAssertEqual(base, 2.4)
        XCTAssertEqual(zones.first?.height, 2.1)
    }
}
