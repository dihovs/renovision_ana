import XCTest
@testable import FloorPlanCore

/// The 3D model and its glTF (spec §14).
final class Model3DTests: XCTestCase {

    private func rect(ceiling: CeilingProfile = .flat(height: 2.4)) -> Room {
        Room(name: "R", corners: [Vec2(0, 0), Vec2(4, 0), Vec2(4, 3), Vec2(0, 3)].map { Corner(p: $0) },
             ceiling: ceiling)
    }

    /// Area of a part's triangles, by Heron-free cross products.
    private func area(_ mesh: Mesh3D, _ part: Mesh3D.Part) -> Double {
        guard let p = mesh.positions[part], let t = mesh.triangles[part] else { return 0 }
        var total = 0.0
        for k in stride(from: 0, to: t.count, by: 3) {
            let a = p[Int(t[k])], b = p[Int(t[k + 1])], c = p[Int(t[k + 2])]
            let u = b - a, v = c - a
            let x = SIMD3(u.y * v.z - u.z * v.y, u.z * v.x - u.x * v.z, u.x * v.y - u.y * v.x)
            total += (x.x * x.x + x.y * x.y + x.z * x.z).squareRoot() / 2
        }
        return total
    }

    func testABoxRoom() {
        let mesh = Model3D.mesh([rect()])
        XCTAssertEqual(mesh.triangleCount(.floor), 2)
        XCTAssertEqual(mesh.triangleCount(.ceiling), 2)
        XCTAssertEqual(mesh.triangleCount(.walls), 8)
        XCTAssertEqual(area(mesh, .floor), 12, accuracy: 1e-9)
        XCTAssertEqual(area(mesh, .walls), 14 * 2.4, accuracy: 1e-9)
    }

    // The walls in 3D are exactly the net wall area: the door's hole is cut.
    func testOpeningsAreCut() {
        var r = rect()
        r.openings = [
            Opening(wallID: r.walls[0].id, kind: .door, offset: 1, width: 0.9, height: 2.1),
            Opening(wallID: r.walls[1].id, kind: .window, offset: 1, width: 1, height: 1.2, sillHeight: 0.9),
        ]
        let mesh = Model3D.mesh([r])
        XCTAssertEqual(area(mesh, .walls), r.netWallArea, accuracy: 1e-9)
    }

    // Under T10's slope the walls match the spec's 37.8 m² and the ceiling
    // its 12.2376 m².
    func testSlopedCeilingMatchesT10() {
        let base = rect()
        let r = { var x = base; x.ceiling = .sloped(lowHeight: 2.4, highHeight: 3.0, lowWallID: x.walls[0].id, highWallID: x.walls[2].id); return x }()
        let mesh = Model3D.mesh([r])
        XCTAssertEqual(area(mesh, .walls), 37.8, accuracy: 1e-6)
        XCTAssertEqual(area(mesh, .ceiling), 12.2376, accuracy: 1e-3)
    }

    func testAnLIsTriangulatedWithoutLosingArea() {
        let l = Room(name: "L", corners: [Vec2(0, 0), Vec2(6, 0), Vec2(6, 2), Vec2(3, 2), Vec2(3, 5), Vec2(0, 5)].map { Corner(p: $0) })
        XCTAssertEqual(area(Model3D.mesh([l]), .floor), 21, accuracy: 1e-9)
        // Clockwise input too.
        XCTAssertEqual(Model3D.triangulate(Array(l.points.reversed())).count, 4)
    }

    func testGLTFIsWellFormed() throws {
        let data = Model3D.gltf(Model3D.mesh([rect()]))
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual((json["asset"] as? [String: Any])?["version"] as? String, "2.0")
        let meshes = try XCTUnwrap(json["meshes"] as? [[String: Any]])
        XCTAssertEqual(meshes.count, 3)
        let accessors = try XCTUnwrap(json["accessors"] as? [[String: Any]])
        // Floor: 6 vertices (2 triangles, unshared), 6 indices.
        XCTAssertEqual(accessors[0]["count"] as? Int, 6)
        // Y is up: the walls reach 2.4 m.
        let wallMax = try XCTUnwrap(accessors[2]["max"] as? [Double])
        XCTAssertEqual(wallMax[1], 2.4, accuracy: 1e-6)
        // The embedded buffer decodes to its declared length.
        let buffer = try XCTUnwrap((json["buffers"] as? [[String: Any]])?.first)
        let uri = try XCTUnwrap(buffer["uri"] as? String)
        let decoded = try XCTUnwrap(Data(base64Encoded: String(uri.dropFirst("data:application/octet-stream;base64,".count))))
        XCTAssertEqual(decoded.count, buffer["byteLength"] as? Int)
    }
}
