import Foundation

/// Exports (spec §14, M10): DXF, SVG, CSV and JSON.
///
/// Every exporter works from rooms already placed on the floor
/// (`Room.floorPoints`), so a file opened in CAD shows the house as it is
/// laid out in the app, not every room stacked at the origin.
extension Room {
    /// The corners in FLOOR coordinates: turned by `rotation` about the
    /// room's own origin, then moved by `origin` (§12 room → floor transform).
    public var floorPoints: [Vec2] { points.map(onFloor) }

    /// One point of the room's own frame, carried onto the floor.
    public func onFloor(_ p: Vec2) -> Vec2 {
        let c = cos(rotation), s = sin(rotation)
        return Vec2(origin.x + p.x * c - p.y * s, origin.y + p.x * s + p.y * c)
    }

    /// Wall i's DXF bulge: tan(θ/4) with θ the included angle — tan(φ/2) —
    /// signed like the sagitta (positive = to the right of travel, which is
    /// DXF's positive, counter-clockwise-from-start arc in a y-up drawing).
    public func dxfBulge(_ i: Int) -> Double {
        let a = arc(i)
        guard !a.isStraight else { return 0 }
        return tan(a.halfAngle / 2) * (a.sagitta > 0 ? 1 : -1)
    }
}

public enum Export {

    // MARK: - DXF (R2000 / AC1015, millimetres)

    /// An ASCII DXF of one floor. Layers WALLS, OPENINGS, DIMENSIONS, TEXT,
    /// ROOMS (§14). Each room is a closed LWPOLYLINE on WALLS with each
    /// curved wall as a bulge; its name and area are TEXT on TEXT; each
    /// wall's length is TEXT on DIMENSIONS at its middle; each opening is a
    /// LINE across its width on OPENINGS.
    public static func dxf(_ rooms: [Room], units: UnitSystem = .imperial) -> String {
        var out: [String] = []
        func pair(_ code: Int, _ value: String) { out += [String(code), value] }
        func mm(_ m: Double) -> String { String(format: "%.1f", m * 1000) }

        pair(0, "SECTION"); pair(2, "HEADER")
        pair(9, "$ACADVER"); pair(1, "AC1015")
        pair(9, "$INSUNITS"); pair(70, "4")
        pair(0, "ENDSEC")

        pair(0, "SECTION"); pair(2, "TABLES")
        pair(0, "TABLE"); pair(2, "LAYER"); pair(70, "5")
        for (name, colour) in [("WALLS", 7), ("OPENINGS", 4), ("DIMENSIONS", 8), ("TEXT", 7), ("ROOMS", 3)] {
            pair(0, "LAYER"); pair(2, name); pair(70, "0"); pair(62, String(colour)); pair(6, "CONTINUOUS")
        }
        pair(0, "ENDTAB")
        pair(0, "ENDSEC")

        pair(0, "SECTION"); pair(2, "ENTITIES")
        for room in rooms {
            let p = room.floorPoints
            let n = p.count
            guard n >= 3 else { continue }
            pair(0, "LWPOLYLINE"); pair(8, "WALLS"); pair(100, "AcDbEntity"); pair(100, "AcDbPolyline")
            pair(90, String(n)); pair(70, "1")
            for i in 0..<n {
                pair(10, mm(p[i].x)); pair(20, mm(p[i].y))
                let b = room.dxfBulge(i)
                if b != 0 { pair(42, String(format: "%.6f", b)) }
            }

            // Room label at the corners' average — fine for a label.
            let cx = p.map(\.x).reduce(0, +) / Double(n), cy = p.map(\.y).reduce(0, +) / Double(n)
            text(&out, layer: "TEXT", at: Vec2(cx, cy), height: 0.2, room.name)
            text(&out, layer: "TEXT", at: Vec2(cx, cy - 0.3), height: 0.15, Units.area(room.area, in: units))

            for i in 0..<n {
                let a = p[i], b = p[(i + 1) % n]
                let mid = (a + b) * 0.5
                let len = room.wallRun(i)
                text(&out, layer: "DIMENSIONS", at: mid, height: 0.12,
                     units == .imperial ? Units.feetInches(len) : String(format: "%.2f m", len))
            }

            for o in room.openings {
                // On a curved wall the line joins the two jambs ON the arc.
                guard let (j0, j1) = room.jambs(of: o) else { continue }
                let s = room.onFloor(j0), e = room.onFloor(j1)
                pair(0, "LINE"); pair(8, "OPENINGS")
                pair(10, mm(s.x)); pair(20, mm(s.y)); pair(30, "0")
                pair(11, mm(e.x)); pair(21, mm(e.y)); pair(31, "0")
            }
        }
        pair(0, "ENDSEC")
        pair(0, "EOF")
        return out.joined(separator: "\n") + "\n"
    }

    private static func text(_ out: inout [String], layer: String, at p: Vec2, height: Double, _ s: String) {
        out += ["0", "TEXT", "8", layer,
                "10", String(format: "%.1f", p.x * 1000), "20", String(format: "%.1f", p.y * 1000), "30", "0",
                "40", String(format: "%.1f", height * 1000), "1", s.replacingOccurrences(of: "\n", with: " ")]
    }

    // MARK: - SVG (1 user unit = 1 mm)

    /// The same drawing as SVG, 1 unit = 1 mm (§14). SVG's y grows down, so y
    /// is flipped; curved walls are drawn as arcs sampled finely along their
    /// length.
    public static func svg(_ rooms: [Room], units: UnitSystem = .imperial) -> String {
        let outlines: [(Room, [Vec2])] = rooms.compactMap { room in
            let floor = room.floorPoints
            guard floor.count >= 3 else { return nil }
            var pts: [Vec2] = []
            for i in floor.indices {
                let a = floor[i], b = floor[(i + 1) % floor.count]
                var sag = 0.0
                if case .arc(let s) = room.walls[i].shape { sag = s }
                let steps = sag == 0 ? 1 : 32
                for k in 0..<steps { pts.append(Arc.point(from: a, to: b, sagitta: sag, at: Double(k) / Double(steps))) }
            }
            return (room, pts)
        }
        let all = outlines.flatMap(\.1)
        guard let minX = all.map(\.x).min(), let maxX = all.map(\.x).max(),
            let minY = all.map(\.y).min(), let maxY = all.map(\.y).max()
        else { return "<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n" }
        let pad = 0.5
        func x(_ v: Double) -> String { String(format: "%.1f", (v - minX + pad) * 1000) }
        func y(_ v: Double) -> String { String(format: "%.1f", (maxY - v + pad) * 1000) }
        let w = (maxX - minX + 2 * pad) * 1000, h = (maxY - minY + 2 * pad) * 1000

        var s = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"\(Int(w))mm\" height=\"\(Int(h))mm\" viewBox=\"0 0 \(Int(w)) \(Int(h))\">\n"
        for (room, pts) in outlines {
            let d = pts.enumerated().map { "\($0.offset == 0 ? "M" : "L")\(x($0.element.x)) \(y($0.element.y))" }.joined(separator: " ")
            s += "  <g id=\"\(xml(room.name))\">\n"
            s += "    <path d=\"\(d) Z\" fill=\"#f4f1ea\" stroke=\"#111\" stroke-width=\"120\" stroke-linejoin=\"miter\"/>\n"
            let c = room.floorPoints
            let cx = c.map(\.x).reduce(0, +) / Double(c.count), cy = c.map(\.y).reduce(0, +) / Double(c.count)
            s += "    <text x=\"\(x(cx))\" y=\"\(y(cy))\" font-size=\"220\" text-anchor=\"middle\" font-family=\"Helvetica\">\(xml(room.name))</text>\n"
            s += "    <text x=\"\(x(cx))\" y=\"\(y(cy - 0.3))\" font-size=\"160\" text-anchor=\"middle\" font-family=\"Helvetica\">\(xml(Units.area(room.area, in: units)))</text>\n"
            s += "  </g>\n"
        }
        return s + "</svg>\n"
    }

    private static func xml(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;").replacingOccurrences(of: "\"", with: "&quot;")
    }

    // MARK: - CSV / JSON

    /// The room table (§14): area, perimeter, volume, and wall areas net of
    /// openings, one row per room plus a total — metres, as stored.
    public static func csv(_ rooms: [Room]) -> String {
        func f(_ v: Double) -> String { String(format: "%.3f", v) }
        func q(_ s: String) -> String { "\"" + s.replacingOccurrences(of: "\"", with: "\"\"") + "\"" }
        var lines = ["Room,Floor area (m²),Perimeter (m),Volume (m³),Wall area gross (m²),Wall area net (m²)"]
        for r in rooms {
            lines.append([q(r.name), f(r.area), f(r.perimeter), f(r.volume), f(r.grossWallArea), f(r.netWallArea)].joined(separator: ","))
        }
        let sum = { (k: (Room) -> Double) in rooms.reduce(0) { $0 + k($1) } }
        lines.append([q("Total"), f(sum { $0.area }), f(sum { $0.perimeter }), f(sum { $0.volume }),
                      f(sum { $0.grossWallArea }), f(sum { $0.netWallArea })].joined(separator: ","))
        return lines.joined(separator: "\n") + "\n"
    }

    /// The native format and backup (§14): the Codable model itself.
    public static func json(_ project: Project) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(project)
    }

    public static func project(from data: Data) throws -> Project {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(Project.self, from: data)
    }
}
