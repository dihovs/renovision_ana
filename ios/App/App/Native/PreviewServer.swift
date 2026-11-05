import CoreGraphics
import Foundation

/// **An offline stand-in for the server, in `-uiPreview` simulator builds
/// only** — so the floor view and the room editor can be opened and tested
/// on the simulator without anyone's sign-in (5 Nov 2026: "please test it
/// after every step, like deep test").
///
/// It serves one sample project, "Sample house", with three drawn rooms on
/// the main floor, and keeps every write in memory for the life of the app:
/// a corner moved and saved is still moved when the room is opened again.
/// Nothing here touches the network, and nothing here runs unless the app
/// was launched with `-uiPreview`, which only a test launch passes.
///
/// Not real data, not a real person's house.
actor PreviewServer {
    static let shared = PreviewServer()

    private let projectID = "preview-project"
    private var rooms: [[String: Any]] = []
    private var objects: [String: [[String: Any]]] = [:]
    private var areas: [String: [[String: Any]]] = [:]
    private var floorAngles: [String: Double] = [:]
    private var nextID = 1

    /// Every request the app made, newest last — what a test reads back to
    /// confirm a save actually went out.
    private(set) var log: [String] = []

    init() {
        func room(_ id: String, _ name: String, _ polygon: [CGPoint], at x: Double, _ y: Double)
            -> [String: Any]
        {
            // The living room gets a door into the kitchen and a window, so
            // the 3D's openings have something to cut.
            let authored: [PlanEditing.WallOpening] =
                id == "preview-living"
                ? [
                    PlanEditing.WallOpening(
                        edge: 1, offset: 1.5, width: 0.9, height: 2.03, sill: 0, kind: .doorSingle),
                    PlanEditing.WallOpening(
                        edge: 0, offset: 1.8, width: 1.4, height: 1.2, sill: 0.9, kind: .windowStandard),
                ] : []
            let geometry = ScanGeometry(polygon: polygon, ceilingHeight: 2.44, authored: authored)
            var json = (try? JSONSerialization.jsonObject(with: JSONEncoder().encode(geometry)))
                as? [String: Any] ?? [:]
            // Drawn rooms lock every wall; the sample starts unlocked except
            // where a test wants a padlock (the kitchen's first wall).
            json["lockedEdges"] = id == "preview-kitchen" ? [0] : []
            return [
                "id": id, "project_id": projectID, "name": name, "level": "main",
                "position": 0, "floor_area_sqm": PlanEditing.area(polygon),
                "wall_length_m": Self.perimeter(polygon), "ceiling_height_m": 2.44,
                "plan_x": x, "plan_y": y, "geometry": json,
            ]
        }
        objects["preview-kitchen"] = [[
            "id": "preview-fridge", "kind": "refrigerator", "name": NSNull(), "x": 0.5, "y": 0.4,
            "rotation": 0, "width": 0.76, "depth": 0.76, "height": 1.78, "disposition": "none",
            "included": true, "quantity": 1,
        ]]
        let partition = StoreyLayout.interiorWall
        rooms = [
            room(
                "preview-living", "Living room",
                [CGPoint(x: 0, y: 0), CGPoint(x: 5, y: 0), CGPoint(x: 5, y: 4), CGPoint(x: 0, y: 4)],
                at: 0, 0),
            room(
                "preview-kitchen", "Kitchen",
                [CGPoint(x: 0, y: 0), CGPoint(x: 3.5, y: 0), CGPoint(x: 3.5, y: 4), CGPoint(x: 0, y: 4)],
                at: 5 + partition, 0),
            room(
                "preview-bath", "Bathroom",
                [
                    CGPoint(x: 0, y: 0), CGPoint(x: 2.5, y: 0), CGPoint(x: 2.5, y: 1.2),
                    CGPoint(x: 1.6, y: 1.2), CGPoint(x: 1.6, y: 2.2), CGPoint(x: 0, y: 2.2),
                ],
                at: 0, 4 + partition),
        ]
        if let office = Self.scannedOffice(projectID: projectID, at: 5 + partition + 3.5 + partition) {
            rooms.append(office)
        }
    }

    /// A SCANNED room, not a drawn one: walls as the sensor reports them,
    /// with 1.4 m of the back wall never seen — so the chain has to bridge
    /// it, and the bridge is the guessed edge the editor draws dashed.
    static func scannedOffice(projectID: String, at x: Double) -> [String: Any]? {
        let rect = [CGPoint(x: 0, y: 0), CGPoint(x: 4, y: 0), CGPoint(x: 4, y: 3), CGPoint(x: 0, y: 3)]
        let drawn = ScanGeometry(polygon: rect, ceilingHeight: 2.44)
        guard var json = (try? JSONSerialization.jsonObject(with: JSONEncoder().encode(drawn)))
            as? [String: Any], var walls = json["walls"] as? [[String: Any]], walls.count == 4
        else { return nil }
        // Wall 2 runs (4,3) → (0,3) and wall 3 (0,3) → (0,0). The scanner
        // never saw the corner between them: wall 2 stops 0.8 m short of it
        // and wall 3 starts 0.8 m below it, so the chain has to bridge it.
        var top = walls[2]
        top["lengthMeters"] = 3.2
        top["widthMeters"] = 3.2
        top["centerX"] = 2.4
        var left = walls[3]
        left["lengthMeters"] = 2.2
        left["widthMeters"] = 2.2
        left["centerZ"] = 1.1
        walls[2] = top
        walls[3] = left
        json["walls"] = walls
        json["editedPolygon"] = nil
        json["lockedEdges"] = nil
        json["authoredOpenings"] = nil
        guard let data = try? JSONSerialization.data(withJSONObject: json),
            var scan = try? JSONDecoder().decode(ScanGeometry.self, from: data),
            let chained = ScanGeometry.chainedOutline(of: scan)
        else { return nil }
        scan.importedOutline = chained.points
        scan.outlineGuessedEdges = chained.guessed
        guard let out = (try? JSONSerialization.jsonObject(with: JSONEncoder().encode(scan))) as? [String: Any]
        else { return nil }
        return [
            "id": "preview-office", "project_id": projectID, "name": "Office (scanned)",
            "level": "main", "position": 0, "floor_area_sqm": 12, "wall_length_m": 14,
            "ceiling_height_m": 2.9, "plan_x": x, "plan_y": 0, "geometry": out,
        ]
    }

    // MARK: - Routing

    func handle(path: String, method: String, body: Data?) throws -> Data {
        log.append("\(method) \(path)")
        let url = URL(string: path, relativeTo: URL(string: "https://preview.invalid"))!
        let parts = url.path.split(separator: "/").map(String.init)  // api v1 …
        let query = Dictionary(
            (URLComponents(url: url, resolvingAgainstBaseURL: true)?.queryItems ?? []).map {
                ($0.name, $0.value ?? "")
            }, uniquingKeysWith: { a, _ in a })
        let input = body.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any] ?? [:]
        let resource = parts.count > 2 ? parts[2] : ""
        let id = parts.count > 3 ? parts[3] : nil

        switch (method, resource) {
        case ("GET", "health"), (_, "auth"), (_, "seen"), (_, "push"):
            return try json(["ok": true])
        case ("GET", "projects") where id == nil:
            return try json(["projects": [projectSummary()], "assignees": []])
        case ("GET", "projects"):
            return try json(["project": NSNull()])
        case ("GET", "scans"):
            if let id, parts.count > 4, parts[4] == "walls" { return try json(["walls": []]) }
            _ = id
            return try json(["scans": rooms, "floorDisplay": floorAngles])
        case ("POST", "scans"):
            // A room filed by a capture: kept like any other.
            let newID = makeID("room")
            let geometry = input["geometry"] as? [String: Any] ?? [:]
            var points: [CGPoint] = []
            if let edited = geometry["editedPolygon"] as? [[String: Double]] {
                points = edited.map { CGPoint(x: $0["x"] ?? 0, y: $0["y"] ?? 0) }
            }
            rooms.append([
                "id": newID, "project_id": projectID, "name": input["name"] ?? "Room",
                "level": input["level"] ?? "main", "position": rooms.count,
                "floor_area_sqm": points.count >= 3 ? PlanEditing.area(points) : 0,
                "wall_length_m": points.count >= 3 ? Self.perimeter(points) : 0,
                "ceiling_height_m": 2.44, "geometry": geometry,
            ])
            return try json(["id": newID])
        case ("PATCH", "scans"):
            if let id { patchRoom(id, input) }
            return try json(["ok": true])
        case ("PATCH", "floors"):
            if let level = query["level"], let angle = input["displayAngle"] as? Double {
                floorAngles[level] = angle
            }
            return try json(["ok": true])
        case ("GET", "objects"):
            let list = query["roomScanId"].map { objects[$0] ?? [] } ?? objects.values.flatMap { $0 }
            return try json(["objects": list])
        case ("POST", "objects"):
            let newID = makeID("object")
            var object = input
            object["id"] = newID
            object["disposition"] = object["disposition"] ?? "none"
            object["included"] = object["included"] ?? true
            object["quantity"] = object["quantity"] ?? 1
            let room = input["roomScanId"] as? String ?? ""
            objects[room, default: []].append(object)
            return try json(["id": newID])
        case ("PATCH", "objects"):
            if let target = query["id"] {
                for (room, list) in objects {
                    objects[room] = list.map { o in
                        guard o["id"] as? String == target else { return o }
                        return o.merging(input) { _, new in new }
                    }
                }
            }
            return try json(["ok": true])
        case ("DELETE", "objects"):
            if let target = query["id"] {
                for (room, list) in objects { objects[room] = list.filter { $0["id"] as? String != target } }
            }
            return try json(["ok": true])
        case ("GET", "areas"):
            return try json(["areas": query["roomScanId"].map { areas[$0] ?? [] } ?? []])
        case ("POST", "areas"):
            let newID = makeID("area")
            let room = input["roomScanId"] as? String ?? ""
            var area: [String: Any] = ["id": newID, "area_sqm": 0]
            area["name"] = input["name"]
            area["surface"] = input["surface"]
            area["polygon"] = input["polygon"]
            area["damage_type"] = input["damageType"]
            area["wall_index"] = input["wallIndex"]
            areas[room, default: []].append(area)
            return try json(["id": newID])
        case ("PATCH", "areas"):
            if let id {
                for (room, list) in areas {
                    areas[room] = list.map { a in
                        guard a["id"] as? String == id else { return a }
                        var a = a
                        if let polygon = input["polygon"] { a["polygon"] = polygon }
                        if let name = input["name"] { a["name"] = name }
                        return a
                    }
                }
            }
            return try json(["ok": true])
        case ("DELETE", "areas"):
            if let id { for (room, list) in areas { areas[room] = list.filter { $0["id"] as? String != id } } }
            return try json(["ok": true])
        case ("GET", "photos"): return try json(["photos": []])
        case ("GET", "moisture"): return try json(["readings": []])
        case ("GET", "equipment"): return try json(["equipment": []])
        default:
            throw APIError.server("Not in the sample: \(method) \(url.path)")
        }
    }

    // MARK: - Pieces

    static func perimeter(_ p: [CGPoint]) -> Double {
        p.indices.reduce(0) { $0 + hypot(p[($1 + 1) % p.count].x - p[$1].x, p[($1 + 1) % p.count].y - p[$1].y) }
    }

    private func makeID(_ prefix: String) -> String {
        nextID += 1
        return "preview-\(prefix)-\(nextID)"
    }

    private func json(_ value: Any) throws -> Data {
        try JSONSerialization.data(withJSONObject: value)
    }

    private func projectSummary() -> [String: Any] {
        [
            "id": projectID, "name": "Sample house", "clientName": "Sample client",
            "roomCount": rooms.count, "favorite": false,
            "largestRoom": rooms.first?["geometry"] ?? NSNull(),
            "floorRooms": rooms.map { r -> [String: Any] in
                ["geometry": r["geometry"] ?? [:], "planX": r["plan_x"] ?? 0, "planY": r["plan_y"] ?? 0, "objects": []]
            },
        ]
    }

    /// A room PATCH: plan edits go into the geometry, everything else onto
    /// the row, by the same names the server stores them under.
    private func patchRoom(_ id: String, _ input: [String: Any]) {
        guard let index = rooms.firstIndex(where: { $0["id"] as? String == id }) else { return }
        var room = rooms[index]
        var geometry = room["geometry"] as? [String: Any] ?? [:]
        let geometryKeys = [
            "editedPolygon", "lockedEdges", "authoredOpenings", "interiorWalls", "doors", "windows",
            "openings", "doorCount", "windowCount", "openingCount", "edgeBulge", "ceilingProfile",
            "ceilingFigures",
        ]
        for key in geometryKeys { if let value = input[key] { geometry[key] = value } }
        if let polygon = input["editedPolygon"] as? [[String: Double]] {
            let points = polygon.map { CGPoint(x: $0["x"] ?? 0, y: $0["y"] ?? 0) }
            room["floor_area_sqm"] = PlanEditing.area(points)
            room["wall_length_m"] = Self.perimeter(points)
        }
        room["geometry"] = geometry
        let rowKeys = [
            "planX": "plan_x", "planY": "plan_y", "level": "level", "name": "name",
            "roomType": "room_type", "notes": "notes", "roomColor": "room_color",
            "livingPercent": "living_percent",
        ]
        for (key, column) in rowKeys { if let value = input[key] { room[column] = value } }
        rooms[index] = room
    }
}
