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
    ]

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
                    var payload = Self.serialize(room)
                    // Export the dollhouse now, while the CapturedRoom is in
                    // hand — it is the only moment it exists. The id goes back
                    // with the measurements so `showModel` can find the file
                    // again without the JS side ever handling a path.
                    if let id = self?.exportModel(room) {
                        payload["modelId"] = id
                    }
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
     * The dollhouse: the scanned room as a 3D model on a plain background,
     * pinch and orbit to look around it.
     *
     * Not QuickLook, which was the first attempt — it opens onto the camera
     * in AR, so the room floats in whatever room you are standing in. The
     * point is to look at the model on a neutral ground.
     */
    @objc func showModel(_ call: CAPPluginCall) {
        guard let id = call.getString("modelId"), let url = modelURLs[id] else {
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

    /// Plain numbers only — cm-accuracy geometry a customer never asked to
    /// see, reduced to what an estimate actually needs: how much flooring,
    /// how much baseboard, how much wall to paint or drywall.
    @available(iOS 17.0, *)
    private static func serialize(_ room: CapturedRoom) -> [String: Any] {
        // `dimensions` is the surface's own width × height in metres — the
        // wall's length is x, its height is y. (The polygon-corner route
        // measures the same thing the long way round and is iOS 17-only
        // anyway.)
        //
        // The transform's 4th column is the wall's centre in world space and
        // its 1st column is the wall's own x-axis in world space — together
        // those are enough to lay the room out from above, which is the
        // difference between a list of numbers and an actual floor plan.
        // y is up in RoomPlan's world, so the plan lives in x/z.
        let walls = room.walls.map { surface -> [String: Any] in
            let centre = surface.transform.columns.3
            let axis = surface.transform.columns.0
            return [
                "lengthMeters": Double(surface.dimensions.x),
                "heightMeters": Double(surface.dimensions.y),
                "centerX": Double(centre.x),
                "centerZ": Double(centre.z),
                "axisX": Double(axis.x),
                "axisZ": Double(axis.z),
            ]
        }

        let floors = room.floors.map { surface -> [String: Any] in
            // width × depth is the honest approximation RoomPlan's own
            // dimensions give per surface; an irregular room is the sum of
            // more than one floor surface, which this still adds correctly.
            ["areaSquareMeters": Double(surface.dimensions.x * surface.dimensions.z)]
        }

        // Doors and windows carry the same centre/axis/width as walls, so the
        // plan can cut real openings into the walls instead of drawing an
        // unbroken box — which is the difference between a floor plan and an
        // outline. Counts alone (what this returned before) can't do that.
        func openings(_ surfaces: [CapturedRoom.Surface]) -> [[String: Any]] {
            surfaces.map { surface in
                let centre = surface.transform.columns.3
                let axis = surface.transform.columns.0
                return [
                    "widthMeters": Double(surface.dimensions.x),
                    "centerX": Double(centre.x),
                    "centerZ": Double(centre.z),
                    "axisX": Double(axis.x),
                    "axisZ": Double(axis.z),
                ]
            }
        }

        // Stairs are the one object category that matters for pricing rather
        // than for a picture: a staircase in the scanned area changes the
        // scope (and RoomPlan's floor area does not account for its run), so
        // it is surfaced as a count rather than buried in the object list.
        let stairs = room.objects.filter { $0.category == .stairs }

        return [
            "walls": walls,
            "floors": floors,
            "doors": openings(room.doors),
            "windows": openings(room.windows),
            "doorCount": room.doors.count,
            "windowCount": room.windows.count,
            "openingCount": room.openings.count,
            "stairCount": stairs.count,
        ]
    }
}
