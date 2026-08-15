import Foundation

/// Wall thickness, and the footprint figures that depend on it.
///
/// The Swift twin of `src/lib/crm/wallThickness.ts`; the numbers and the model
/// must not diverge, since a footprint that differs between the phone and the
/// report is worse than one neither reports.
///
/// # Why this is stated, not measured
///
/// A LiDAR scan measures wall FACES, not assemblies. It cannot tell a 2×4
/// partition from a 2×6, so these figures were refused outright until the
/// operator could state the thickness — which is exactly how the reference
/// works, per floor, interior and exterior kept apart
/// (`Docs/reference/magicplan/object-model.md` §2c).
///
/// # What it still cannot know
///
/// Our rooms are scanned one at a time and are not registered into a single
/// footprint, so a room cannot know which of its walls a neighbour sits
/// behind. Each room is grown by HALF its wall thickness: a shared partition
/// takes half from each side and is counted once, correctly, while an
/// exterior wall contributes only its inner half. `withAllWalls` is therefore
/// an under-estimate, and its definition says so.
enum WallThickness {
    private static let inch = 0.0254

    /// Finished thickness, not nominal lumber. A 2×4 wall is 3½" of stud plus
    /// ½" of board each side — 4½". Anyone typing "4 inches" is describing the
    /// stud, not the wall.
    enum Assembly: Double, CaseIterable, Identifiable {
        case stud2x4 = 0.1143
        case stud2x6 = 0.1651
        case exterior2x6 = 0.1778
        case concrete8 = 0.2032

        var id: Double { rawValue }

        var label: String {
            switch self {
            case .stud2x4: return "2×4 stud, drywall both sides"
            case .stud2x6: return "2×6 stud"
            case .exterior2x6: return "2×6 exterior with sheathing"
            case .concrete8: return "8\" poured concrete"
            }
        }

        var shortLabel: String {
            switch self {
            case .stud2x4: return "2×4"
            case .stud2x6: return "2×6"
            case .exterior2x6: return "2×6 ext"
            case .concrete8: return "8\" concrete"
            }
        }
    }

    struct Pair: Equatable, Codable {
        var interiorM: Double
        var exteriorM: Double
    }

    /// 2×4 partitions, 2×6 exterior — what most of this trade's jobs are.
    static let `default` = Pair(
        interiorM: Assembly.stud2x4.rawValue,
        exteriorM: Assembly.exterior2x6.rawValue)

    /// A room's footprint including half the walls bounding it.
    ///
    /// The corner term of a polygon offset is deliberately dropped: exact only
    /// for convex shapes, worth under two thousandths of a square metre on a
    /// 4 × 3 room, and far below what the scan is accurate to. A term that is
    /// right for circles and wrong for rooms is false precision.
    static func footprintWithHalfWalls(
        floorAreaSqm: Double, perimeterM: Double, thicknessM: Double
    ) -> Double {
        guard floorAreaSqm.isFinite, perimeterM.isFinite else { return 0 }
        guard thicknessM.isFinite, thicknessM > 0 else { return max(0, floorAreaSqm) }
        return max(0, floorAreaSqm + (perimeterM * thicknessM) / 2)
    }

    struct Surfaces {
        let withoutWalls: Double
        let withInteriorWalls: Double
        let withAllWalls: Double
    }

    /// The three figures the reference publishes, from a stated thickness.
    ///
    /// On a one-room floor the middle equals the first — there are no
    /// partitions to add, and the reference reports exactly that.
    static func groundSurfaces(
        rooms: [(floorAreaSqm: Double, perimeterM: Double)],
        thickness: Pair = WallThickness.default
    ) -> Surfaces {
        let clear = rooms.reduce(0.0) { $0 + ($1.floorAreaSqm.isFinite ? $1.floorAreaSqm : 0) }

        let interior =
            rooms.count < 2
            ? clear
            : rooms.reduce(0.0) {
                $0
                    + footprintWithHalfWalls(
                        floorAreaSqm: $1.floorAreaSqm, perimeterM: $1.perimeterM,
                        thicknessM: thickness.interiorM)
            }

        let all = rooms.reduce(0.0) {
            $0
                + footprintWithHalfWalls(
                    floorAreaSqm: $1.floorAreaSqm, perimeterM: $1.perimeterM,
                    thicknessM: thickness.exteriorM)
        }

        return Surfaces(withoutWalls: clear, withInteriorWalls: interior, withAllWalls: all)
    }
}
