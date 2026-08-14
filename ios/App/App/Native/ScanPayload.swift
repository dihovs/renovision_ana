import CoreGraphics
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

    /// The outline after the operator corrected it by hand.
    ///
    /// Sits BESIDE the sensor's own walls rather than replacing them, so
    /// "what did the laser actually say" stays answerable after a correction
    /// — which is the question an adjuster asks when a figure changes between
    /// the first visit and the invoice. Optional, because every scan taken
    /// before the editor existed has none.
    var editedPolygon: [EditedPoint]?

    /// Which wall lengths were TYPED rather than measured, by edge index.
    ///
    /// A number somebody entered by hand is a different kind of fact from one
    /// a sensor produced, and a claim file has to be able to tell them apart:
    /// "which of these did you measure?" is a fair question and the answer
    /// must not be a shrug. A locked length also refuses to be changed by a
    /// stray drag without asking first.
    var lockedEdges: [Int]?

    struct EditedPoint: Codable, Hashable {
        let x: Double
        let y: Double
    }

    // MARK: - From RoomPlan

    @available(iOS 17.0, *)
    /// Build a room from a drawn outline, with no sensor involved.
    ///
    /// The same shape the scanner produces, so a drawn room is a room
    /// everywhere downstream — plan, totals, damage areas, report — with no
    /// second kind of room for every future feature to learn about.
    ///
    /// Openings are empty, deliberately. Wall area is priced net of doors and
    /// windows, so inventing an opening nobody drew would be inventing money.
    init(polygon: [CGPoint], ceilingHeight: Double) {
        var madeWalls: [Surface] = []
        for i in polygon.indices {
            let a = polygon[i]
            let b = polygon[(i + 1) % polygon.count]
            let dx = b.x - a.x
            let dy = b.y - a.y
            let length = hypot(dx, dy)
            guard length > 0.01 else { continue }
            madeWalls.append(
                Surface(
                    lengthMeters: length,
                    widthMeters: length,
                    heightMeters: ceilingHeight,
                    centerX: (a.x + b.x) / 2,
                    centerZ: (a.y + b.y) / 2,
                    axisX: dx / length,
                    axisZ: dy / length))
        }

        // Shoelace, absolute — a room traced either way round measures the
        // same, because somebody dragging corners has no idea which way they
        // are going.
        var twice = 0.0
        for i in polygon.indices {
            let a = polygon[i]
            let b = polygon[(i + 1) % polygon.count]
            twice += a.x * b.y - b.x * a.y
        }

        self.walls = madeWalls
        self.floors = [Floor(areaSquareMeters: abs(twice) / 2)]
        self.doors = []
        self.windows = []
        self.openings = []
        self.doorCount = 0
        self.windowCount = 0
        self.openingCount = 0
        self.stairCount = 0
        self.editedPolygon = polygon.map { EditedPoint(x: $0.x, y: $0.y) }
        // A drawn room is typed by definition — every wall of it is a number
        // somebody entered, so every wall is locked.
        self.lockedEdges = Array(0..<madeWalls.count)
    }

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
///
/// Decodable as well as Encodable because a scan taken with no signal is
/// written to disk and read back later — possibly after the app has been
/// killed and relaunched.
struct ScanUpload: Codable {
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
