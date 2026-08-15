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

    /// The interior perimeter — the full run of wall, doorways included.
    var perimeterM: Double { walls.reduce(0) { $0 + $1.lengthMeters } }

    /// Baseboard length: the perimeter with every doorway taken out.
    ///
    /// What trim is actually priced against, and it is NOT the perimeter —
    /// baseboard and shoe moulding do not cross a doorway. On a room with two
    /// doors that is most of a metre, charged per linear foot.
    ///
    /// What interrupts trim is anything you walk THROUGH: a door, or a cased
    /// opening. A window does not — trim runs under it. That is the same
    /// `sill == 0` rule as `PlanEditing.OpeningKind.sill`, carried here by
    /// which list a surface landed in, since RoomPlan reports no sill of its
    /// own.
    ///
    /// The TypeScript twin is `baseboardLengthMeters` in src/lib/roomScan.ts.
    /// Clamped at zero: a bad scan reporting a door wider than its room must
    /// not price a negative run.
    var baseboardLengthM: Double {
        let doorways = (doors + openings).reduce(0) { $0 + $1.widthMeters }
        return max(0, perimeterM - doorways)
    }

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

    /// Doors and windows the operator PLACED on a drawn or typed room, kept
    /// in their editable form: which edge of the (edited) polygon, how far
    /// along it, how wide, and what kind.
    ///
    /// The `doors`/`windows`/`openings` arrays above are synthesized from
    /// these so that everything downstream — renderer, net wall area, report
    /// — reads openings the one way it already knows. This list is the
    /// editor's source of truth for re-opening the room, and the record of
    /// what the operator actually declared: a placed door and a detected one
    /// are different kinds of fact, exactly like a typed length and a
    /// measured one.
    var authoredOpenings: [AuthoredOpening]?

    struct AuthoredOpening: Codable, Hashable {
        let edge: Int
        /// Metres from the edge's start corner to the near jamb.
        let offset: Double
        let width: Double
        /// `PlanEditing.OpeningKind` rawValue, stored as text so the blob
        /// stays readable and an unknown future kind degrades to nothing
        /// rather than to a decoding failure.
        let kind: String
    }

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
    /// Openings appear only when the operator placed them. Wall area is
    /// priced net of doors and windows, so an opening nobody declared would
    /// be inventing money — but so is ignoring the door every room has: a
    /// drawn room with no way to carry one reports its gross wall area as
    /// net, systematically high.
    init(polygon: [CGPoint], ceilingHeight: Double, authored: [PlanEditing.WallOpening] = []) {
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

        let placed = Self.surfaces(
            for: authored, polygon: polygon, ceilingHeight: ceilingHeight)

        self.walls = madeWalls
        self.floors = [Floor(areaSquareMeters: abs(twice) / 2)]
        self.doors = placed.doors
        self.windows = placed.windows
        self.openings = placed.passages
        self.doorCount = placed.doors.count
        self.windowCount = placed.windows.count
        self.openingCount = placed.passages.count
        self.stairCount = 0
        self.editedPolygon = polygon.map { EditedPoint(x: $0.x, y: $0.y) }
        // A drawn room is typed by definition — every wall of it is a number
        // somebody entered, so every wall is locked.
        self.lockedEdges = Array(0..<madeWalls.count)
        self.authoredOpenings = authored.map {
            AuthoredOpening(
                edge: $0.edge, offset: $0.offset, width: $0.width, kind: $0.kind.rawValue)
        }
    }

    /// Synthesize the downstream form of the authored openings: the same
    /// centre-plus-axis surfaces a RoomPlan detection produces, in the
    /// polygon's own space, so the renderer cuts them into their walls and
    /// the net wall area deducts them with no new code path anywhere.
    ///
    /// Heights are the kind's convention clamped to the ceiling — a 6'8"
    /// door in a 6' crawl space must not deduct wall that does not exist.
    static func surfaces(
        for authored: [ScanGeometry.AuthoredOpening], polygon: [CGPoint], ceilingHeight: Double
    ) -> (doors: [Surface], windows: [Surface], passages: [Surface]) {
        var doors: [Surface] = []
        var windows: [Surface] = []
        var passages: [Surface] = []

        for record in authored {
            // An unknown kind came from a newer build; skipping it here only
            // affects the synthesized copies — the authored record itself
            // survives untouched.
            guard let kind = PlanEditing.OpeningKind(rawValue: record.kind) else { continue }
            let opening = PlanEditing.WallOpening(
                edge: record.edge, offset: record.offset, width: record.width, kind: kind)
            guard let (a, b) = PlanEditing.openingEndpoints(polygon, opening) else { continue }
            let dx = b.x - a.x
            let dy = b.y - a.y
            let width = hypot(dx, dy)
            guard width > 0.01 else { continue }
            let surface = Surface(
                lengthMeters: width,
                widthMeters: width,
                heightMeters: min(kind.height, ceilingHeight),
                centerX: (a.x + b.x) / 2,
                centerZ: (a.y + b.y) / 2,
                axisX: dx / width,
                axisZ: dy / width)
            switch kind.category {
            case .door: doors.append(surface)
            case .window: windows.append(surface)
            case .passage: passages.append(surface)
            }
        }
        return (doors, windows, passages)
    }

    static func surfaces(
        for authored: [PlanEditing.WallOpening], polygon: [CGPoint], ceilingHeight: Double
    ) -> (doors: [Surface], windows: [Surface], passages: [Surface]) {
        surfaces(
            for: authored.map {
                AuthoredOpening(
                    edge: $0.edge, offset: $0.offset, width: $0.width, kind: $0.kind.rawValue)
            },
            polygon: polygon, ceilingHeight: ceilingHeight)
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
    /// The living-area vocabulary id, asked at capture. Rides the POST
    /// rather than a follow-up PATCH so a scan held offline still lands
    /// typed — an untyped room silently counts as `other` at 100%, which
    /// counts basements as living area. Optional in the CODEC only, for
    /// scans held on disk from before the field existed.
    let roomType: String?

    init(
        projectId: String, name: String, level: String, position: Int, geometry: ScanGeometry,
        roomType: String? = nil
    ) {
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
        self.roomType = roomType
    }
}
