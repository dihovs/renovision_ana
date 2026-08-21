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
        /// RoomPlan's own identifier for this detection, when it came from a
        /// scan. Carried so an answer the operator gave DURING the walk —
        /// "that is a bifold, not a single" — can still be matched to the
        /// right hole when the room is filed minutes later.
        ///
        /// **Stored as `detectionId`, not `id`, as a precaution.** A field
        /// called `id` inside a stored blob collides with whatever that blob
        /// already keeps under the name, and a collision here does not
        /// produce a wrong value — it THROWS. The surface fails to decode,
        /// the whole `ScanGeometry` fails with it, and `RoomScan` swallows
        /// that in a `try?`, so the room arrives with `geometry == nil`: it
        /// still lists, its area still totals, and the plan is simply blank.
        /// A whole floor can go dark and nothing anywhere reports an error.
        ///
        /// This was NOT the cause of the blank floor it was written chasing
        /// — that turned out to be seeded rooms that never had geometry —
        /// but the hazard is real and costs nothing to avoid.
        var detectionId: String?
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

    /// What RoomPlan recognised standing in the room — a refrigerator, a
    /// toilet, a chair. Stored beside the walls in the SCAN's own world
    /// frame, exactly like the surfaces above, and turned into plan
    /// coordinates by the one pipeline that already rotates and normalises
    /// everything else (`FloorPlanGeometry.plan(from:)`).
    ///
    /// Optional: every scan taken before this existed has none, and a
    /// synthesised `Decodable` would fail those rooms outright.
    var detected: [DetectedObject]?

    struct DetectedObject: Codable {
        /// RoomPlan's own identifier, so an answer the operator gave
        /// mid-scan can still find this object when the room is filed.
        let id: String
        /// `CapturedRoom.Object.Category` as a string — text, so an unknown
        /// future category degrades to "ask" rather than to a decode failure.
        let category: String
        /// True when RoomPlan itself was unsure. A low-confidence guess
        /// placed silently is a fixture on an estimate nobody saw.
        let lowConfidence: Bool
        let centerX: Double
        let centerZ: Double
        let axisX: Double
        let axisZ: Double
        let widthMeters: Double
        let depthMeters: Double
        let heightMeters: Double
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

    /// Interior stub walls — partitions standing INSIDE a room rather than
    /// bounding it.
    ///
    /// The reference's `Add Wall`, watched on the owner's phone 19 Aug 2026:
    /// it drops a wall that is not an edge of the room's outline. A closet
    /// divider, a knee wall, the half-wall beside a stair. Every other wall
    /// in this codebase is an edge of the polygon, which is why these need a
    /// list of their own — modelling one as a corner in the outline would
    /// carve the room in two, and a room with a closet in it is still one
    /// room.
    ///
    /// In the room's own plan metres, the same space `authoredOpenings` and
    /// the objects are in. Optional, because every room saved before this
    /// existed has none.
    ///
    /// **They do not touch any area figure yet, on purpose.** Wall area feeds
    /// the estimate and then the claim, and whether a partition adds one face
    /// or two — and whether a knee wall counts at all — is a pricing decision
    /// with money attached, not something to infer from the fact that a line
    /// was drawn. Drawn, measured, moved and deleted first; counted when the
    /// owner says how.
    var interiorWalls: [InteriorWall]?

    struct InteriorWall: Codable, Hashable {
        let x1: Double
        let y1: Double
        let x2: Double
        let y2: Double

        /// How high it stands. **Nil means full ceiling height**, which is
        /// what a plain interior wall is.
        ///
        /// **The owner's office, 20 Aug 2026:** a storage closet built inside
        /// a larger room from two partitions and a door, about eight feet
        /// high in a taller room. *"We should be able to add a wall, and we
        /// should be able to customize the height and the length of the
        /// wall, and the app needs to understand that it doesn't reach the
        /// ceiling."*
        ///
        /// Optional rather than defaulted to the ceiling, because those are
        /// different statements: nil is "nobody said, so assume it goes all
        /// the way", and a number is "somebody measured this". A claim has
        /// to be able to tell them apart, exactly as a typed wall length is
        /// distinguished from a scanned one.
        var heightM: Double?

        /// Whether both sides get finished. A partition standing IN a room
        /// has two faces in that room and both get drywall, tape and paint —
        /// which is why this defaults to true and a room's own perimeter
        /// wall, with its far side in another room, does not get counted
        /// twice.
        var bothFaces: Bool?

        var lengthM: Double { hypot(x2 - x1, y2 - y1) }

        /// Finished surface this partition contributes, given the room it
        /// stands in.
        func areaSqm(ceilingHeight: Double) -> Double {
            let height = heightM ?? ceilingHeight
            return lengthM * height * ((bothFaces ?? true) ? 2 : 1)
        }
    }

    struct AuthoredOpening: Codable, Hashable {
        let edge: Int
        /// Metres from the edge's start corner to the near jamb.
        let offset: Double
        let width: Double
        /// Floor to head / floor to sill, metres — independently editable
        /// per opening since 18 Aug 2026 (`PlanEditing.WallOpening`'s own
        /// header explains why). BOTH are `Decodable` as OPTIONAL, on their
        /// own `CodingKeys`, and defaulted from `kind`'s own catalog figure
        /// when absent — every room saved before this date has neither key
        /// in its stored JSON, and a synthesized `Decodable` would fail
        /// those rooms outright rather than degrade gracefully.
        let height: Double
        let sill: Double
        /// `PlanEditing.OpeningKind` rawValue, stored as text so the blob
        /// stays readable and an unknown future kind degrades to nothing
        /// rather than to a decoding failure.
        let kind: String
        /// Which jamb the door is hinged on, and which way it opens — both
        /// nil until somebody says, because nothing in a scan records
        /// either. `PlanEditing.WallOpening`'s own header carries the
        /// argument for why these are stored rather than detected.
        let hingeAtStart: Bool?
        let swingInward: Bool?

        enum CodingKeys: String, CodingKey {
            case edge, offset, width, height, sill, kind, hingeAtStart, swingInward
        }

        init(
            edge: Int, offset: Double, width: Double, height: Double, sill: Double, kind: String,
            hingeAtStart: Bool? = nil, swingInward: Bool? = nil
        ) {
            self.edge = edge
            self.offset = offset
            self.width = width
            self.height = height
            self.sill = sill
            self.kind = kind
            self.hingeAtStart = hingeAtStart
            self.swingInward = swingInward
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            edge = try c.decode(Int.self, forKey: .edge)
            offset = try c.decode(Double.self, forKey: .offset)
            width = try c.decode(Double.self, forKey: .width)
            kind = try c.decode(String.self, forKey: .kind)
            let fallback = PlanEditing.OpeningKind(rawValue: kind)
            height = try c.decodeIfPresent(Double.self, forKey: .height) ?? fallback?.height ?? 0
            sill = try c.decodeIfPresent(Double.self, forKey: .sill) ?? fallback?.sill ?? 0
            hingeAtStart = try c.decodeIfPresent(Bool.self, forKey: .hingeAtStart)
            swingInward = try c.decodeIfPresent(Bool.self, forKey: .swingInward)
        }
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
                edge: $0.edge, offset: $0.offset, width: $0.width, height: $0.height,
                sill: $0.sill, kind: $0.kind.rawValue)
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
                edge: record.edge, offset: record.offset, width: record.width,
                height: record.height, sill: record.sill, kind: kind)
            guard let (a, b) = PlanEditing.openingEndpoints(polygon, opening) else { continue }
            let dx = b.x - a.x
            let dy = b.y - a.y
            let width = hypot(dx, dy)
            guard width > 0.01 else { continue }
            let surface = Surface(
                lengthMeters: width,
                widthMeters: width,
                // The opening's OWN height now, not the kind's catalog
                // figure — independently editable since 18 Aug 2026, and
                // net wall area has to deduct what was actually declared,
                // not what a kind starts at by default.
                heightMeters: min(opening.height, ceilingHeight),
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
                    edge: $0.edge, offset: $0.offset, width: $0.width, height: $0.height,
                    sill: $0.sill, kind: $0.kind.rawValue)
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
                    detectionId: surface.identifier.uuidString,
                    lengthMeters: Double(surface.dimensions.x),
                    widthMeters: Double(surface.dimensions.x),
                    heightMeters: Double(surface.dimensions.y),
                    centerX: Double(centre.x),
                    centerZ: Double(centre.z),
                    axisX: Double(axis.x),
                    axisZ: Double(axis.z))
            }
        }

        detected = room.objects.map { object in
            let centre = object.transform.columns.3
            let axis = object.transform.columns.0
            return DetectedObject(
                id: object.identifier.uuidString,
                category: String(describing: object.category),
                lowConfidence: object.confidence == .low,
                centerX: Double(centre.x),
                centerZ: Double(centre.z),
                axisX: Double(axis.x),
                axisZ: Double(axis.z),
                widthMeters: Double(object.dimensions.x),
                // RoomPlan's object box is width x height x depth in its own
                // local frame: x across, y up, z through. On a PLAN the
                // depth is z, which is the mistake `floors` above already
                // records having shipped once.
                depthMeters: Double(object.dimensions.z),
                heightMeters: Double(object.dimensions.y))
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
    /// The floor, in square metres.
    ///
    /// **From the OUTLINE, not from RoomPlan's floor patches.** Summing the
    /// patches is what shipped, and it double-counts: RoomPlan reports the
    /// floor as several overlapping rectangles, not as one polygon, so a
    /// room can come back with more floor than its own bounding box
    /// contains — which is impossible for any real floor and is exactly how
    /// this was caught. The owner's report showed `AREA: 87.21 m²` beside
    /// `WIDTH: 7.559 m • LENGTH: 5.137 m`, and 7.559 × 5.137 is 38.8.
    ///
    /// Floor area is the headline figure on a claim. It is also the one an
    /// adjuster can check with a tape in thirty seconds.
    ///
    /// So: the corrected outline where a person has drawn one, the chained
    /// walls where the scan closed on its own, and only then the patches —
    /// clamped to the extent, because nothing can cover more ground than it
    /// stands on.
    var floorAreaSquareMeters: Double {
        if let edited = editedPolygon, edited.count >= 3 {
            let area = FloorPlanGeometry.polygonArea(
                edited.map { CGPoint(x: $0.x, y: $0.y) })
            if area > 0.5 { return area }
        }
        let plan = FloorPlanGeometry.plan(from: self)
        if plan.polygon.count >= 4 {
            let area = FloorPlanGeometry.polygonArea(
                Array(plan.polygon.dropLast()))
            if area > 0.5 { return area }
        }
        let summed = floors.reduce(0) { $0 + $1.areaSquareMeters }
        let extent = plan.width * plan.height
        return extent > 0.5 ? min(summed, extent) : summed
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

// MARK: - Openings: stored form <-> editable form

/// The ONE translation between an opening as it is stored and an opening as
/// the editors work on it.
///
/// It was written out by hand in seven places. Every field added since has
/// had to be remembered in all seven, and the ones that were not remembered
/// did not fail — they silently dropped the value on the next round trip,
/// which is the worst way for this to go wrong: the operator sets a door's
/// swing, saves, reopens, and it is simply back to the default with nothing
/// to explain it. This file has already been bitten three times by the same
/// shape of mistake (see the ledger's note on "two places drawing the same
/// thing by two different rules"), so the translation lives once.
extension PlanEditing.WallOpening {
    /// Nil for a kind this build does not know — an opening placed by a
    /// newer version. Skipped rather than guessed: a door of unknown type
    /// drawn as a single leaf is a claim nobody made.
    init?(_ record: ScanGeometry.AuthoredOpening) {
        guard let kind = PlanEditing.OpeningKind(rawValue: record.kind) else { return nil }
        self.init(
            edge: record.edge, offset: record.offset, width: record.width,
            height: record.height, sill: record.sill, kind: kind,
            hingeAtStart: record.hingeAtStart, swingInward: record.swingInward)
    }

    var stored: ScanGeometry.AuthoredOpening {
        ScanGeometry.AuthoredOpening(
            edge: edge, offset: offset, width: width, height: height, sill: sill,
            kind: kind.rawValue, hingeAtStart: hingeAtStart, swingInward: swingInward)
    }
}
