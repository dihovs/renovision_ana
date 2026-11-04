import Foundation

/// Doors and windows on walls (spec §9, M4, T11–T12).
///
/// Every opening belongs to exactly one wall and is placed by an offset along
/// that wall's chord from its start corner. The rules here are the spec's
/// "must hold" list; `issues` reports every one an opening breaks, and the
/// wall-area figures deduct only what is actually a hole in the wall.
public struct OpeningTuning: Codable, Sendable {
    /// Wall left clear past an opening's far jamb, so it never runs into the
    /// wall's end corner (§9 — "the 2 cm reveal is tunable").
    public var reveal: Meters = 0.02
    /// Common North American 32″ × 80″ door, on the floor.
    public var doorWidth: Meters = 0.81
    public var doorHeight: Meters = 2.03
    public var windowWidth: Meters = 1.0
    public var windowHeight: Meters = 1.2
    public var windowSill: Meters = 0.9

    public init() {}
}

public enum OpeningIssue: Equatable, Sendable {
    /// The wall it names is not in this room.
    case noSuchWall
    /// offset < 0.
    case startsBeforeWall
    /// offset + width > chord − reveal. Value: by how much, metres.
    case pastWallEnd(Meters)
    /// sill + height > the ceiling at that wall. Value: by how much, metres.
    case aboveCeiling(Meters)
    /// Shares wall with another opening on the same wall.
    case overlaps(UUID)
    /// Zero or negative width or height.
    case degenerate
}

extension Opening {
    /// A door with the spec's defaults, starting `offset` along its wall.
    public static func door(on wall: UUID, offset: Meters, tuning: OpeningTuning = OpeningTuning()) -> Opening {
        Opening(wallID: wall, kind: .door, offset: offset, width: tuning.doorWidth,
                height: tuning.doorHeight, sillHeight: 0)
    }

    public static func window(on wall: UUID, offset: Meters, tuning: OpeningTuning = OpeningTuning()) -> Opening {
        Opening(wallID: wall, kind: .window, offset: offset, width: tuning.windowWidth,
                height: tuning.windowHeight, sillHeight: tuning.windowSill)
    }
}

extension Room {

    /// The index of a wall, by id.
    public func wallIndex(_ id: UUID) -> Int? { walls.firstIndex { $0.id == id } }

    /// Everything this opening gets wrong in this room (§9). Empty means it
    /// may be placed. `ignoring` excludes openings from the overlap check —
    /// the opening itself, when an existing one is being moved.
    public func issues(
        for opening: Opening, ignoring: Set<UUID> = [], tuning: OpeningTuning = OpeningTuning()
    ) -> [OpeningIssue] {
        guard let j = wallIndex(opening.wallID) else { return [.noSuchWall] }
        guard opening.width > 0, opening.height > 0 else { return [.degenerate] }
        let eps = 1e-9
        var out: [OpeningIssue] = []
        let chord = wallLength(j)
        if opening.offset < -eps { out.append(.startsBeforeWall) }
        // "Must hold: offset + width ≤ chord − reveal" — equal is allowed
        // (T12's 3.08 + 0.9 = 3.98 on a 4 m wall).
        let past = opening.offset + opening.width - (chord - tuning.reveal)
        if past > eps { out.append(.pastWallEnd(past)) }
        // Against the LOWEST ceiling over the opening's own span: under a
        // sloped ceiling the same window fits at the high end of a wall and
        // not at the low end.
        let over = opening.sillHeight + opening.height
            - ceilingMin(onWall: j, from: opening.offset, width: opening.width)
        if over > eps { out.append(.aboveCeiling(over)) }
        for other in openings where other.wallID == opening.wallID
            && other.id != opening.id && !ignoring.contains(other.id)
        {
            // Touching jamb to jamb is two openings side by side, not overlap.
            if opening.offset < other.offset + other.width - eps,
                other.offset < opening.offset + opening.width - eps
            {
                out.append(.overlaps(other.id))
            }
        }
        return out
    }

    /// Where an opening's two jambs are, in the room's own frame: offset and
    /// offset + width along its wall's chord, stood up onto the arc when the
    /// wall is curved (§9 "drawn on the arc"). Nil when its wall is gone.
    public func jambs(of opening: Opening) -> (start: Vec2, end: Vec2)? {
        guard let j = wallIndex(opening.wallID) else { return nil }
        let a = points[j], b = points[(j + 1) % points.count]
        var sag = 0.0
        if case .arc(let v) = walls[j].shape { sag = v }
        return (Arc.pointOverChord(from: a, to: b, sagitta: sag, at: opening.offset),
                Arc.pointOverChord(from: a, to: b, sagitta: sag, at: opening.offset + opening.width))
    }

    /// Net area of wall j (§9): its area under the ceiling (§11, see
    /// `grossWallArea`) less width × height of each opening on it. An opening
    /// is deducted only as far as it is under the ceiling over its own span —
    /// part of a hole above the ceiling is not wall that was there to paint.
    public func netWallArea(_ j: Int) -> Double {
        let holes = openings.filter { $0.wallID == walls[j].id }.reduce(0.0) { sum, o in
            let top = ceilingMin(onWall: j, from: o.offset, width: o.width)
            return sum + o.width * max(0, min(o.height, top - o.sillHeight))
        }
        return max(0, grossWallArea(j) - holes)
    }

    public var grossWallArea: Double { walls.indices.reduce(0) { $0 + grossWallArea($1) } }
    public var netWallArea: Double { walls.indices.reduce(0) { $0 + netWallArea($1) } }
}
