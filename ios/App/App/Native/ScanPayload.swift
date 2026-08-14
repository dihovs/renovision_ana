import Foundation
import RoomPlan

/// A captured room, in the shape the API stores.
///
/// Field-for-field identical to what `RoomScanPlugin.geometryPayload` sends
/// from the WebView, and that is a hard requirement rather than a nicety: the
/// same `room_scans.geometry` blob is read back by `toFloorPlan` in
/// TypeScript to draw the plan, compute wall area and place affected areas.
/// A native scan that stored its walls under different keys would save
/// perfectly and then draw nothing.
///
/// Metres and square metres throughout, as RoomPlan reports them. Every
/// imperial figure in either app is derived on the way out.
struct ScanGeometry: Codable {
    struct Surface: Codable {
        let lengthMeters: Double
        let widthMeters: Double
        let heightMeters: Double
        let centerX: Double
        let centerZ: Double
        let axisX: Double
        let axisZ: Double
    }

    struct Floor: Codable {
        let areaSquareMeters: Double
    }

    let walls: [Surface]
    let floors: [Floor]
    let doors: [Surface]
    let windows: [Surface]
    /// Cased openings — the doorless gaps that CONNECT rooms. Without their
    /// geometry a merged plan draws sealed boxes.
    let openings: [Surface]
    let doorCount: Int
    let windowCount: Int
    let openingCount: Int
    let stairCount: Int

    // MARK: - From RoomPlan

    @available(iOS 17.0, *)
    init(room: CapturedRoom) {
        func map(_ list: [CapturedRoom.Surface]) -> [Surface] {
            list.map { surface in
                // `dimensions` is the surface's own width × height in metres:
                // a wall's length is x, its height is y. The transform's 4th
                // column is its centre in world space and the 1st column is
                // its own x-axis in world space — together enough to lay the
                // plan out from above rather than just list numbers. y is up
                // in RoomPlan's world, so the plan lives in x/z.
                let centre = surface.transform.columns.3
                let axis = surface.transform.columns.0
                return Surface(
                    lengthMeters: Double(surface.dimensions.x),
                    widthMeters: Double(surface.dimensions.x),
                    heightMeters: Double(surface.dimensions.y),
                    centerX: Double(centre.x),
                    centerZ: Double(centre.z),
                    axisX: Double(axis.x),
                    axisZ: Double(axis.z))
            }
        }

        walls = map(room.walls)
        // x TIMES Y, not x times z. Every RoomPlan surface is a plane in its
        // own local X-Y, laid flat by the node transform — so a floor's depth
        // is y and its z is ~0. Multiplying by z gave every room a floor area
        // of zero, which shipped once and must not ship again.
        floors = room.floors.map { Floor(areaSquareMeters: Double($0.dimensions.x * $0.dimensions.y)) }
        doors = map(room.doors)
        windows = map(room.windows)
        openings = map(room.openings)
        doorCount = room.doors.count
        windowCount = room.windows.count
        openingCount = room.openings.count
        // Stairs matter for pricing rather than for a picture: a staircase
        // changes the scope, and RoomPlan's floor area ignores its run.
        stairCount = room.objects.filter { $0.category == .stairs }.count
    }

    // MARK: - Derived figures
    //
    // Computed here and sent with the geometry, matching what `saveScan` in
    // roomScan.ts sends. The server deliberately does not recompute them — it
    // was not there — so these ARE the measurements, and they have to agree
    // with what the plan later draws.

    /// Every floor surface added up. A room RoomPlan split into two floor
    /// planes is still one floor.
    var floorAreaSquareMeters: Double {
        floors.reduce(0) { $0 + $1.areaSquareMeters }
    }

    /// Perimeter — what baseboard and trim are priced against.
    var wallLengthMeters: Double {
        walls.reduce(0) { $0 + $1.lengthMeters }
    }

    /// The tallest wall. RoomPlan reports each wall's own height and they
    /// disagree by centimetres; the tallest is the one that matters for
    /// paint, and an average would quietly under-report a sloped ceiling.
    var ceilingHeightMeters: Double {
        walls.map(\.heightMeters).max() ?? 0
    }

    /// Whether this looks like a room at all. Three walls and some floor is
    /// the floor of a real capture; below that the operator should be told
    /// while they are still standing in it.
    var looksComplete: Bool {
        walls.count >= 3 && floorAreaSquareMeters > 0.5
    }
}

/// What gets POSTed to /api/v1/scans.
struct ScanUpload: Encodable {
    let projectId: String
    let name: String
    let level: String
    let position: Int
    let floorAreaSqm: Double
    let wallLengthM: Double
    let ceilingHeightM: Double
    let doorCount: Int
    let windowCount: Int
    let stairCount: Int
    let geometry: ScanGeometry

    init(projectId: String, name: String, level: String, position: Int, geometry: ScanGeometry) {
        self.projectId = projectId
        self.name = name
        self.level = level
        self.position = position
        self.floorAreaSqm = geometry.floorAreaSquareMeters
        self.wallLengthM = geometry.wallLengthMeters
        self.ceilingHeightM = geometry.ceilingHeightMeters
        self.doorCount = geometry.doorCount
        self.windowCount = geometry.windowCount
        self.stairCount = geometry.stairCount
        self.geometry = geometry
    }
}
