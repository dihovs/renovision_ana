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
    ]

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
            scanVC.onFinish = { result in
                switch result {
                case .success(let room):
                    call.resolve(Self.serialize(room))
                case .failure(let error):
                    call.reject(error.localizedDescription)
                }
            }
            scanVC.modalPresentationStyle = .fullScreen
            presenter.present(scanVC, animated: true)
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

        // Stairs are the one object category that matters for pricing rather
        // than for a picture: a staircase in the scanned area changes the
        // scope (and RoomPlan's floor area does not account for its run), so
        // it is surfaced as a count rather than buried in the object list.
        let stairs = room.objects.filter { $0.category == .stairs }

        return [
            "walls": walls,
            "floors": floors,
            "doorCount": room.doors.count,
            "windowCount": room.windows.count,
            "openingCount": room.openings.count,
            "stairCount": stairs.count,
        ]
    }
}
