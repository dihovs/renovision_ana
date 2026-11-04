import Foundation

/// The rooms as a 3D model (spec §14 "USDZ / glTF"): floor, walls extruded
/// to the ceiling with openings cut out, and the ceiling — in metres, Y up.
///
/// Built once as plain triangles (`Mesh3D`) so every format writes the same
/// geometry: glTF 2.0 here, USDZ in the app from the same mesh.
public struct Mesh3D: Sendable {
    public enum Part: String, CaseIterable, Sendable { case floor, walls, ceiling }

    /// Plan (x, y) and height z, metres.
    public var positions: [Part: [SIMD3<Double>]] = [:]
    public var triangles: [Part: [UInt32]] = [:]

    mutating func add(_ part: Part, _ a: SIMD3<Double>, _ b: SIMD3<Double>, _ c: SIMD3<Double>) {
        var p = positions[part] ?? []
        let base = UInt32(p.count)
        p += [a, b, c]
        positions[part] = p
        triangles[part, default: []] += [base, base + 1, base + 2]
    }

    mutating func quad(_ part: Part, _ a: SIMD3<Double>, _ b: SIMD3<Double>, _ c: SIMD3<Double>, _ d: SIMD3<Double>) {
        add(part, a, b, c)
        add(part, a, c, d)
    }

    public func triangleCount(_ part: Part) -> Int { (triangles[part]?.count ?? 0) / 3 }
}

public enum Model3D {

    /// Every room on a floor, at its place on the floor.
    public static func mesh(_ rooms: [Room]) -> Mesh3D {
        var mesh = Mesh3D()
        for room in rooms { add(room, to: &mesh) }
        return mesh
    }

    static func add(_ room: Room, to mesh: inout Mesh3D) {
        let n = room.corners.count
        guard n >= 3 else { return }
        // Everything is worked out in the room's own frame, where the ceiling
        // knows its walls, then carried onto the floor.
        let c = cos(room.rotation), s = sin(room.rotation)
        func floor(_ p: Vec2, _ z: Double) -> SIMD3<Double> {
            SIMD3(room.origin.x + p.x * c - p.y * s, room.origin.y + p.x * s + p.y * c, z)
        }
        func h(_ p: Vec2) -> Double { room.ceilingHeight(at: p) }

        // Floor and ceiling: the outline (curves followed), triangulated.
        let outline = room.outlinePolygon(steps: 16)
        for t in triangulate(outline) {
            let (a, b, cc) = (outline[t.0], outline[t.1], outline[t.2])
            mesh.add(.floor, floor(a, 0), floor(b, 0), floor(cc, 0))
            // Wound the other way so it faces down, into the room.
            mesh.add(.ceiling, floor(a, h(a)), floor(cc, h(cc)), floor(b, h(b)))
        }

        // Walls: each wall's face, with its openings cut out.
        for i in 0..<n {
            let a = room.points[i], b = room.points[(i + 1) % n]
            let chord = a.distance(to: b)
            guard chord > 1e-6 else { continue }
            var sag = 0.0
            if case .arc(let v) = room.walls[i].shape { sag = v }
            // Along the chord, where each opening's hole is (§9 offsets are
            // measured along the chord).
            let holes = room.openings.filter { $0.wallID == room.walls[i].id }
                .map { (from: max(0, $0.offset), to: min(chord, $0.offset + $0.width), sill: $0.sillHeight, head: $0.sillHeight + $0.height) }
                .sorted { $0.from < $1.from }
            // Cut points along the wall: its ends, every jamb, and — on a
            // curve — enough steps to follow it.
            var cuts: Set<Double> = [0, chord]
            for hole in holes { cuts.formUnion([hole.from, hole.to]) }
            if sag != 0 { for k in 1..<16 { cuts.insert(chord * Double(k) / 16) } }
            let stops = cuts.sorted()
            func at(_ d: Double) -> Vec2 { Arc.point(from: a, to: b, sagitta: sag, at: d / chord) }

            for k in 0..<(stops.count - 1) {
                let d0 = stops[k], d1 = stops[k + 1]
                guard d1 - d0 > 1e-6 else { continue }
                let p0 = at(d0), p1 = at(d1)
                let top0 = h(p0), top1 = h(p1)
                let mid = (d0 + d1) / 2
                if let hole = holes.first(where: { mid > $0.from && mid < $0.to }) {
                    // Below the sill, and above the head up to the ceiling.
                    if hole.sill > 0 {
                        mesh.quad(.walls, floor(p0, 0), floor(p1, 0), floor(p1, min(hole.sill, top1)), floor(p0, min(hole.sill, top0)))
                    }
                    if hole.head < min(top0, top1) {
                        mesh.quad(.walls, floor(p0, hole.head), floor(p1, hole.head), floor(p1, top1), floor(p0, top0))
                    }
                } else {
                    mesh.quad(.walls, floor(p0, 0), floor(p1, 0), floor(p1, top1), floor(p0, top0))
                }
            }
        }
    }

    /// Ear-clipping triangulation of a simple polygon, either winding.
    /// Returns index triples into `p`, counter-clockwise.
    public static func triangulate(_ p: [Vec2]) -> [(Int, Int, Int)] {
        var idx = Array(p.indices)
        guard idx.count >= 3 else { return [] }
        if Polygon.signedArea(p) < 0 { idx.reverse() }
        var out: [(Int, Int, Int)] = []
        var guardCount = 0
        while idx.count > 3 && guardCount < 10_000 {
            guardCount += 1
            var clipped = false
            for k in idx.indices {
                let i0 = idx[(k - 1 + idx.count) % idx.count], i1 = idx[k], i2 = idx[(k + 1) % idx.count]
                let a = p[i0], b = p[i1], c = p[i2]
                // Convex, and no other corner inside the ear.
                guard (b - a).cross(c - b) > 1e-12 else { continue }
                let inside = idx.contains { j in
                    j != i0 && j != i1 && j != i2 && pointInTriangle(p[j], a, b, c)
                }
                if inside { continue }
                out.append((i0, i1, i2))
                idx.remove(at: k)
                clipped = true
                break
            }
            // Degenerate leftovers (collinear runs): drop a vertex and go on.
            if !clipped { idx.remove(at: 0) }
        }
        if idx.count == 3 { out.append((idx[0], idx[1], idx[2])) }
        return out
    }

    static func pointInTriangle(_ p: Vec2, _ a: Vec2, _ b: Vec2, _ c: Vec2) -> Bool {
        let d1 = (b - a).cross(p - a), d2 = (c - b).cross(p - b), d3 = (a - c).cross(p - c)
        return d1 >= -1e-12 && d2 >= -1e-12 && d3 >= -1e-12
    }

    // MARK: - glTF 2.0

    /// One self-contained .gltf: JSON with its binary buffer embedded as a
    /// base64 data URI, one mesh per part (floor, walls, ceiling) with its
    /// own plain material. Y up, metres (§14): plan (x, y) → (x, −y), height
    /// → Y, so the plan reads the right way round from above.
    public static func gltf(_ mesh: Mesh3D) -> Data {
        var buffer = Data()
        var bufferViews: [[String: Any]] = []
        var accessors: [[String: Any]] = []
        var meshes: [[String: Any]] = []
        var nodes: [[String: Any]] = []
        let colours: [Mesh3D.Part: [Double]] = [
            .floor: [0.78, 0.72, 0.62, 1], .walls: [0.93, 0.93, 0.91, 1], .ceiling: [0.97, 0.97, 0.97, 1],
        ]
        var materials: [[String: Any]] = []

        func align() { while buffer.count % 4 != 0 { buffer.append(0) } }

        for part in Mesh3D.Part.allCases {
            guard let pos = mesh.positions[part], let tri = mesh.triangles[part], !tri.isEmpty else { continue }
            let gl = pos.map { SIMD3<Float>(Float($0.x), Float($0.z), Float(-$0.y)) }

            align()
            let posOffset = buffer.count
            for v in gl { for f in [v.x, v.y, v.z] { withUnsafeBytes(of: f.bitPattern.littleEndian) { buffer.append(contentsOf: $0) } } }
            let posLength = buffer.count - posOffset
            align()
            let idxOffset = buffer.count
            for i in tri { withUnsafeBytes(of: i.littleEndian) { buffer.append(contentsOf: $0) } }
            let idxLength = buffer.count - idxOffset

            bufferViews.append(["buffer": 0, "byteOffset": posOffset, "byteLength": posLength, "target": 34962])
            bufferViews.append(["buffer": 0, "byteOffset": idxOffset, "byteLength": idxLength, "target": 34963])
            let minV = [gl.map(\.x).min()!, gl.map(\.y).min()!, gl.map(\.z).min()!].map(Double.init)
            let maxV = [gl.map(\.x).max()!, gl.map(\.y).max()!, gl.map(\.z).max()!].map(Double.init)
            accessors.append(["bufferView": bufferViews.count - 2, "componentType": 5126, "count": gl.count,
                              "type": "VEC3", "min": minV, "max": maxV])
            accessors.append(["bufferView": bufferViews.count - 1, "componentType": 5125, "count": tri.count,
                              "type": "SCALAR"])
            materials.append(["name": part.rawValue, "doubleSided": true,
                              "pbrMetallicRoughness": ["baseColorFactor": colours[part]!, "metallicFactor": 0.0, "roughnessFactor": 0.9]])
            meshes.append(["name": part.rawValue, "primitives": [[
                "attributes": ["POSITION": accessors.count - 2], "indices": accessors.count - 1,
                "material": materials.count - 1, "mode": 4,
            ]]])
            nodes.append(["name": part.rawValue, "mesh": meshes.count - 1])
        }

        let json: [String: Any] = [
            "asset": ["version": "2.0", "generator": "Renovision FloorPlanCore"],
            "scene": 0,
            "scenes": [["nodes": Array(nodes.indices)]],
            "nodes": nodes, "meshes": meshes, "materials": materials,
            "accessors": accessors, "bufferViews": bufferViews,
            "buffers": [["byteLength": buffer.count,
                         "uri": "data:application/octet-stream;base64," + buffer.base64EncodedString()]],
        ]
        return (try? JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])) ?? Data()
    }
}
