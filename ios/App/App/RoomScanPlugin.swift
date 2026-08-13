import Foundation
import Capacitor
import RoomPlan

/**
 * Bridges a RoomPlan scan to JS. Presents Apple's own capture UI (the
 * dollhouse-style live AR view and wall-detection guidance are RoomPlan's,
 * not ours) and hands back plain measurements — wall lengths, floor area,
 * opening counts — for the web side to turn into estimate line items.
 *
 * iOS 17+ and a LiDAR scanner only (iPhone 12 Pro or later Pro models, iPad
 * Pro 2020+) — `isSupported` exists so the JS side can hide the feature
 * entirely rather than offer a button that fails. iOS 17 rather than 16
 * because `CapturedRoom.floors` only exists from 17, and floor area is the
 * single most useful number here; every LiDAR-capable device runs 17.
 */
@objc(RoomScanPlugin)
public class RoomScanPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RoomScanPlugin"
    public let jsName = "RoomScan"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startScan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "mergeScans", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetScans", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeScan", returnType: CAPPluginReturnPromise),
    ]

    /**
     * Every room captured on this floor, kept so they can be merged.
     *
     * This is what makes a connected floor plan possible at all. Each
     * `CapturedRoom` is measured in its OWN coordinate space, so laying two
     * of them side by side without merging would place both rooms on top of
     * each other at the origin. `StructureBuilder` is the only thing that
     * knows how they actually fit together — it re-registers the scans
     * against each other and returns one structure in a shared space.
     */
    @available(iOS 17.0, *)
    private static var capturedRooms: [CapturedRoom] = []

    /// Kept alive between `startScan` and `showModel`: the viewer needs a file
    /// on disk, and re-exporting on every tap would mean re-walking the room.
    private var modelURLs: [String: URL] = [:]

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 17.0, *) {
            call.resolve(["supported": RoomCaptureSession.isSupported])
        } else {
            call.resolve(["supported": false])
        }
    }

    @objc func startScan(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *) else {
            call.reject("Room scanning needs iOS 17 or later.")
            return
        }
        guard RoomCaptureSession.isSupported else {
            call.reject("This device has no LiDAR scanner.")
            return
        }

        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("No screen to present the scan from.")
                return
            }
            let scanVC = RoomScanViewController()
            scanVC.onFinish = { [weak self] result in
                switch result {
                case .success(let room):
                    // Kept for the merge. Every room on a floor has to be
                    // held until StructureBuilder can register them against
                    // each other — a room discarded here is a room that can
                    // never be placed on the plan.
                    Self.capturedRooms.append(room)

                    var payload = Self.serialize(room)
                    // Export the dollhouse now, while the CapturedRoom is in
                    // hand — it is the only moment it exists. The id goes back
                    // with the measurements so `showModel` can find the file
                    // again without the JS side ever handling a path.
                    if let id = self?.exportModel(room) {
                        payload["modelId"] = id
                        // The exact payload the web side receives, written
                        // beside the model. Reconstructing this from the
                        // USDZ export gives DIFFERENT numbers (the node
                        // transforms are not the surface transforms), so
                        // tuning the floor plan against a reconstruction is
                        // tuning against noise. This is the ground truth.
                        Self.writePayloadDump(payload, id: id)
                    }
                    payload["roomsCaptured"] = Self.capturedRooms.count
                    call.resolve(payload)
                case .failure(let error):
                    call.reject(error.localizedDescription)
                }
            }
            scanVC.modalPresentationStyle = .fullScreen
            presenter.present(scanVC, animated: true)
        }
    }

    /**
     * Merge every room scanned so far into one connected floor plan.
     *
     * This is the difference between a pile of room drawings and a plan of a
     * property. Each `CapturedRoom` is measured in its own coordinate space —
     * laid out naively, every room would sit on top of the others at the
     * origin. `StructureBuilder` re-registers the scans against each other
     * and returns them in one shared space, which is what makes a hallway
     * actually connect the two rooms either side of it.
     *
     * Needs at least two rooms. With one, the merged answer is the room
     * itself and the round trip through the builder buys nothing.
     */
    @objc func mergeScans(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *) else {
            call.reject("Merging needs iOS 17 or later.")
            return
        }
        let rooms = Self.capturedRooms
        guard rooms.count >= 2 else {
            call.reject("Scan at least two rooms before merging them.")
            return
        }

        Task {
            do {
                // `.beautifyObjects` squares up walls that a scan left a
                // degree or two off — the same tidying a drafted plan gets,
                // and without it the merged outline reads as hand-drawn.
                let builder = StructureBuilder(options: [.beautifyObjects])
                let structure = try await builder.capturedStructure(from: rooms)

                var payload = Self.serializeStructure(structure)
                // modelURLs is read and written on the main thread everywhere
                // else; keep this write there too rather than racing it.
                let id = await MainActor.run { self.exportStructure(structure) }
                if let id { payload["modelId"] = id }
                call.resolve(payload)
            } catch {
                call.reject("Could not merge the scans: \(error.localizedDescription)")
            }
        }
    }

    /// Start a new property. Without this the next job's first scan would be
    /// merged into the last job's floor.
    @objc func resetScans(_ call: CAPPluginCall) {
        if #available(iOS 17.0, *) { Self.capturedRooms = [] }
        call.resolve(["ok": true])
    }

    /// Drop one held room, by capture order. Without this, "Remove this
    /// room" on the screen leaves the room in the native merge set — the
    /// next Combine quietly includes a room the operator deleted.
    @objc func removeScan(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *) else { call.resolve(["ok": true]); return }
        guard let index = call.getInt("index"),
              index >= 0, index < Self.capturedRooms.count else {
            call.reject("No held scan at that position.")
            return
        }
        Self.capturedRooms.remove(at: index)
        call.resolve(["roomsCaptured": Self.capturedRooms.count])
    }

    /**
     * The dollhouse: the scanned room as a 3D model on a plain background,
     * pinch and orbit to look around it.
     *
     * Not QuickLook, which was the first attempt — it opens onto the camera
     * in AR, so the room floats in whatever room you are standing in. The
     * point is to look at the model on a neutral ground.
     */
    @objc func showModel(_ call: CAPPluginCall) {
        guard let id = call.getString("modelId"), let url = modelURLs[id],
              FileManager.default.fileExists(atPath: url.path) else {
            // Caches is purgeable: iOS may delete the file while the id is
            // still held, and a missing file renders as an empty grey viewer
            // with no explanation. Refuse honestly instead.
            call.reject("That model is no longer available — scan the room again.")
            return
        }

        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("No screen to present the model from.")
                return
            }
            let viewer = RoomModelViewController(url: url)
            viewer.modalPresentationStyle = .fullScreen
            presenter.present(viewer, animated: true)
            call.resolve(["ok": true])
        }
    }

    /// Dumps a plugin payload to Caches for offline inspection. Diagnostic
    /// only — nothing reads it back, and a failure is not worth surfacing.
    private static func writePayloadDump(_ payload: [String: Any], id: String) {
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted])
        else { return }
        let url = FileManager.default
            .urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("payload-\(id).json")
        try? data.write(to: url)
    }

    /// Writes the room to a USDZ in the app's cache and returns its id.
    /// Cache rather than Documents: it is regenerable from a rescan and has
    /// no business surviving as user data or being backed up.
    @available(iOS 17.0, *)
    private func exportModel(_ room: CapturedRoom) -> String? {
        let id = UUID().uuidString
        let url = FileManager.default
            .urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("room-\(id).usdz")
        do {
            // `.parametric` is the clean built geometry — flat walls, real
            // door and window cutouts — rather than the raw scan mesh, which
            // is noisy and looks like a point cloud rather than a room.
            try room.export(to: url, exportOptions: .parametric)
            modelURLs[id] = url
            return id
        } catch {
            CAPLog.print("⚡️ RoomScan: could not export the model — \(error.localizedDescription)")
            return nil
        }
    }

    /// The merged structure, in the same shape a single room reports, so the
    /// drawing code does not care which it was handed. `sections` is the one
    /// addition: the merge knows which room is which, and a plan that can
    /// label "Kitchen" is worth more than an unlabelled outline.
    @available(iOS 17.0, *)
    private static func serializeStructure(_ structure: CapturedStructure) -> [String: Any] {
        var payload = geometryPayload(
            walls: structure.walls,
            floors: structure.floors,
            doors: structure.doors,
            windows: structure.windows,
            openings: structure.openings,
            objects: structure.objects,
        )
        payload["sections"] = structure.sections.map { section -> [String: Any] in
            let centre = section.center
            return [
                "label": section.label.rawValue,
                "centerX": Double(centre.x),
                "centerZ": Double(centre.z),
            ]
        }
        return payload
    }

    @available(iOS 17.0, *)
    private func exportStructure(_ structure: CapturedStructure) -> String? {
        let id = UUID().uuidString
        let url = FileManager.default
            .urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("structure-\(id).usdz")
        do {
            try structure.export(to: url, exportOptions: .parametric)
            modelURLs[id] = url
            return id
        } catch {
            CAPLog.print("⚡️ RoomScan: could not export the structure — \(error.localizedDescription)")
            return nil
        }
    }

    /// Plain numbers only — cm-accuracy geometry a customer never asked to
    /// see, reduced to what an estimate actually needs: how much flooring,
    /// how much baseboard, how much wall to paint or drywall.
    @available(iOS 17.0, *)
    private static func serialize(_ room: CapturedRoom) -> [String: Any] {
        geometryPayload(
            walls: room.walls,
            floors: room.floors,
            doors: room.doors,
            windows: room.windows,
            openings: room.openings,
            objects: room.objects,
        )
    }

    /**
     * The shared shape of a plan, whether it came from one room or a merged
     * structure — the drawing code should not have to know which.
     *
     * `dimensions` is the surface's own width x height in metres: a wall's
     * length is x, its height is y. The transform's 4th column is its centre
     * in world space and the 1st column is its own x-axis in world space;
     * together those are enough to lay the plan out from above, which is the
     * difference between a list of numbers and an actual drawing. y is up in
     * RoomPlan's world, so the plan lives in x/z.
     */
    @available(iOS 17.0, *)
    private static func geometryPayload(
        walls: [CapturedRoom.Surface],
        floors: [CapturedRoom.Surface],
        doors: [CapturedRoom.Surface],
        windows: [CapturedRoom.Surface],
        openings: [CapturedRoom.Surface],
        objects: [CapturedRoom.Object],
    ) -> [String: Any] {
        func surfaces(_ list: [CapturedRoom.Surface]) -> [[String: Any]] {
            list.map { surface in
                let centre = surface.transform.columns.3
                let axis = surface.transform.columns.0
                return [
                    "lengthMeters": Double(surface.dimensions.x),
                    "widthMeters": Double(surface.dimensions.x),
                    "heightMeters": Double(surface.dimensions.y),
                    "centerX": Double(centre.x),
                    "centerZ": Double(centre.z),
                    "axisX": Double(axis.x),
                    "axisZ": Double(axis.z),
                ]
            }
        }

        return [
            "walls": surfaces(walls),
            // width x depth is the honest approximation RoomPlan's own
            // dimensions give per surface; an irregular room is the sum of
            // more than one floor surface, which this still adds correctly.
            "floors": floors.map { ["areaSquareMeters": Double($0.dimensions.x * $0.dimensions.z)] },
            "doors": surfaces(doors),
            "windows": surfaces(windows),
            // Cased openings — doorless passages — with full geometry, so a
            // plan can cut the gap that CONNECTS two rooms. A count alone
            // draws sealed boxes.
            "openings": surfaces(openings),
            "doorCount": doors.count,
            "windowCount": windows.count,
            "openingCount": openings.count,
            // Stairs are the one object category that matters for pricing
            // rather than for a picture: a staircase changes the scope, and
            // RoomPlan's floor area does not account for its run.
            "stairCount": objects.filter { $0.category == .stairs }.count,
        ]
    }
}
