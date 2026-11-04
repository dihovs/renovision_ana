import XCTest
@testable import FloorPlanCore

/// Exports (spec §14).
final class ExportTests: XCTestCase {

    private func room(_ name: String, at origin: Vec2 = Vec2(0, 0)) -> Room {
        Room(name: name, corners: [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(0, 3)].map { Corner(p: $0) },
             origin: origin)
    }

    // T8 in DXF: chord 4, sagitta 0.5 → bulge tan(0.244979) = 0.2500 = 2s/c.
    func testT8BulgeInDXF() {
        var r = room("Bay")
        r.walls[0].shape = .arc(sagitta: 0.5)
        XCTAssertEqual(r.dxfBulge(0), 0.25, accuracy: 1e-4)
        XCTAssertEqual(r.dxfBulge(0), 2 * 0.5 / 4, accuracy: 1e-9)
        XCTAssertEqual(r.dxfBulge(1), 0)
        r.walls[0].shape = .arc(sagitta: -0.5)
        XCTAssertEqual(r.dxfBulge(0), -0.25, accuracy: 1e-4)

        let dxf = Export.dxf([{ var x = r; x.walls[0].shape = .arc(sagitta: 0.5); return x }()])
        XCTAssertTrue(dxf.contains("AC1015"))
        XCTAssertTrue(dxf.contains("$INSUNITS\n70\n4"))
        XCTAssertTrue(dxf.contains("LWPOLYLINE"))
        XCTAssertTrue(dxf.contains("42\n0.250000"))
        for layer in ["WALLS", "OPENINGS", "DIMENSIONS", "TEXT", "ROOMS"] { XCTAssertTrue(dxf.contains("2\n\(layer)\n")) }
        XCTAssertTrue(dxf.hasSuffix("EOF\n"))
    }

    func testDXFIsInMillimetresAndPlacedOnTheFloor() {
        let dxf = Export.dxf([room("A"), room("B", at: Vec2(4, 0))])
        // Room B's first corner sits at x = 4000 mm.
        XCTAssertTrue(dxf.contains("10\n4000.0\n20\n0.0"))
        XCTAssertTrue(dxf.contains("10\n8000.0\n20\n0.0"))
        // Every group code is followed by a value: an even number of lines.
        XCTAssertEqual(dxf.split(separator: "\n", omittingEmptySubsequences: false).dropLast().count % 2, 0)
    }

    func testOpeningsGoOnTheirLayer() {
        var r = room("A")
        r.openings = [Opening(wallID: r.walls[0].id, kind: .door, offset: 1, width: 0.9, height: 2.03)]
        let dxf = Export.dxf([r])
        XCTAssertTrue(dxf.contains("LINE\n8\nOPENINGS\n10\n1000.0\n20\n0.0"))
        XCTAssertTrue(dxf.contains("11\n1900.0\n21\n0.0"))
    }

    func testSVGIsMillimetresWithNamesAndAreas() {
        let svg = Export.svg([room("Kitchen & Bath")])
        XCTAssertTrue(svg.hasPrefix("<svg"))
        // 4 m + 0.5 m padding each side.
        XCTAssertTrue(svg.contains("width=\"5000mm\""))
        XCTAssertTrue(svg.contains("Kitchen &amp; Bath"))
        XCTAssertTrue(svg.contains("129.17 ft²"))
    }

    func testCSVRoomTable() {
        var r = room("Bedroom")
        r.ceiling = .flat(height: 2.4)
        r.openings = [Opening(wallID: r.walls[0].id, kind: .door, offset: 1, width: 0.9, height: 2.1)]
        let lines = Export.csv([r, room("Hall")]).split(separator: "\n")
        XCTAssertEqual(lines.count, 4)
        XCTAssertEqual(lines[1], "\"Bedroom\",12.000,14.000,28.800,33.600,31.710")
        XCTAssertTrue(lines[3].hasPrefix("\"Total\",24.000,28.000"))
    }

    func testJSONRoundTrip() throws {
        var r = room("Living")
        r.walls[2].shape = .arc(sagitta: 0.4)
        r.walls[1].lockedLength = 3
        let project = Project(name: "123 Main", floors: [Floor(name: "Ground", level: 0, rooms: [r])])
        let back = try Export.project(from: Export.json(project))
        XCTAssertEqual(back.name, "123 Main")
        XCTAssertEqual(back.floors[0].rooms[0].walls[2].shape, .arc(sagitta: 0.4))
        XCTAssertEqual(back.floors[0].rooms[0].walls[1].lockedLength, 3)
        XCTAssertEqual(back.floors[0].rooms[0].area, r.area, accuracy: 1e-12)
    }
}
