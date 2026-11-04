import FloorPlanCore
import SceneKit
import SwiftUI

/// The plan as files for other software (floor-plan spec §14, M10): DXF and
/// SVG for drawing programs, glTF and USDZ for 3D, a CSV room table and the
/// native JSON. The PDF is the project report, one screen back.
///
/// Each floor is laid out exactly as the floor view lays it out
/// (`StoreyLayout`), so a DXF opens as the house, not as rooms stacked at
/// the origin.
struct PlanFilesView: View {
    let projectId: String
    let projectName: String

    @State private var files: [URL] = []
    @State private var error: String?
    @State private var working = true

    var body: some View {
        List {
            if working {
                HStack { ProgressView(); Text("Making the files…").foregroundStyle(Brand.inkSoft) }
            }
            if let error { Text(error).foregroundStyle(.red) }
            if !files.isEmpty {
                Section {
                    ShareLink(items: files) {
                        Label("Send all \(files.count) files", systemImage: "square.and.arrow.up.on.square")
                    }
                }
                Section {
                    ForEach(files, id: \.self) { url in
                        ShareLink(item: url) {
                            HStack {
                                Image(systemName: icon(for: url.pathExtension))
                                    .frame(width: 24).foregroundStyle(Brand.blue)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(url.lastPathComponent).foregroundStyle(Brand.ink)
                                    Text(caption(for: url.pathExtension)).font(.caption).foregroundStyle(Brand.inkSoft)
                                }
                            }
                        }
                    }
                } footer: {
                    Text("DXF and SVG are in millimetres. 3D files are in metres, ceiling shapes and openings included.")
                }
            }
        }
        .navigationTitle("Plan files")
        .navigationBarTitleDisplayMode(.inline)
        .task { await make() }
    }

    private func make() async {
        defer { working = false }
        do {
            let scans = try await API.shared.scans(projectId: projectId)
            files = try Self.write(scans: scans, projectName: projectName)
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Every file, written to a fresh folder in the temporary directory.
    static func write(scans: [RoomScan], projectName: String) throws -> [URL] {
        let safe = projectName.components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>")).joined(separator: "-")
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("plan-files/\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        let levels = Array(Set(scans.map(\.level))).sorted()
        var urls: [URL] = []
        var everyRoom: [Room] = []
        var floors: [FloorPlanCore.Floor] = []

        for (index, level) in levels.enumerated() {
            let layout = StoreyLayout(scans.filter { $0.level == level })
            let rooms: [Room] = layout.rooms.compactMap { placed in
                var loop = placed.plan.polygon
                if loop.count > 1, loop.first == loop.last { loop.removeLast() }
                guard loop.count >= 3 else { return nil }
                let onFloor = loop.map { CGPoint(x: $0.x + placed.origin.x, y: $0.y + placed.origin.y) }
                let g = placed.room.geometry
                return PlanBridge.room(
                    onFloor, bulges: placed.plan.bulges, ceiling: g?.ceilingProfile,
                    flat: placed.room.ceilingHeightM, name: placed.room.name,
                    openings: (g?.authoredOpenings ?? []).compactMap(PlanEditing.WallOpening.init))
            }
            guard !rooms.isEmpty else { continue }
            everyRoom += rooms
            floors.append(FloorPlanCore.Floor(name: level, level: index, rooms: rooms))

            let base = "\(safe) — \(level)"
            urls.append(try save(Export.dxf(rooms), dir, "\(base).dxf"))
            urls.append(try save(Export.svg(rooms), dir, "\(base).svg"))
            let mesh = Model3D.mesh(rooms)
            let gltf = dir.appendingPathComponent("\(base).gltf")
            try Model3D.gltf(mesh).write(to: gltf)
            urls.append(gltf)
            let usdz = dir.appendingPathComponent("\(base).usdz")
            if Self.scene(mesh).write(to: usdz, options: nil, delegate: nil, progressHandler: nil) {
                urls.append(usdz)
            }
        }
        guard !everyRoom.isEmpty else { throw PlanFilesError.noRooms }
        urls.append(try save(Export.csv(everyRoom), dir, "\(safe) — rooms.csv"))
        let project = Project(name: projectName, floors: floors)
        let json = dir.appendingPathComponent("\(safe).json")
        try Export.json(project).write(to: json)
        urls.append(json)
        return urls
    }

    enum PlanFilesError: LocalizedError {
        case noRooms
        var errorDescription: String? { "This project has no rooms with a closed outline to export yet." }
    }

    private static func save(_ text: String, _ dir: URL, _ name: String) throws -> URL {
        let url = dir.appendingPathComponent(name)
        try text.write(to: url, atomically: true, encoding: .utf8)
        return url
    }

    /// The same mesh as SceneKit geometry, for USDZ. Y up, metres.
    static func scene(_ mesh: Mesh3D) -> SCNScene {
        let scene = SCNScene()
        let colours: [Mesh3D.Part: UIColor] = [
            .floor: UIColor(red: 0.78, green: 0.72, blue: 0.62, alpha: 1),
            .walls: UIColor(white: 0.93, alpha: 1), .ceiling: UIColor(white: 0.97, alpha: 1),
        ]
        for part in Mesh3D.Part.allCases {
            guard let pos = mesh.positions[part], let tri = mesh.triangles[part], !tri.isEmpty else { continue }
            let vertices = pos.map { SCNVector3(Float($0.x), Float($0.z), Float(-$0.y)) }
            let source = SCNGeometrySource(vertices: vertices)
            let element = SCNGeometryElement(indices: tri, primitiveType: .triangles)
            let geometry = SCNGeometry(sources: [source], elements: [element])
            let material = SCNMaterial()
            material.diffuse.contents = colours[part]
            material.isDoubleSided = true
            geometry.materials = [material]
            let node = SCNNode(geometry: geometry)
            node.name = part.rawValue
            scene.rootNode.addChildNode(node)
        }
        return scene
    }

    private func icon(for ext: String) -> String {
        switch ext {
        case "dxf", "svg": return "square.and.pencil"
        case "gltf", "usdz": return "cube"
        case "csv": return "tablecells"
        default: return "doc.text"
        }
    }

    private func caption(for ext: String) -> String {
        switch ext {
        case "dxf": return "AutoCAD and most CAD programs"
        case "svg": return "Vector drawing, opens in a browser"
        case "gltf": return "3D — Blender, SketchUp, web viewers"
        case "usdz": return "3D — opens on any iPhone or Mac"
        case "csv": return "Room table for a spreadsheet"
        default: return "Full plan data — this app's own format"
        }
    }
}
