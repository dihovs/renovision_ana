import Foundation

/// Curved walls (spec §10, M5, T8–T9).
///
/// An arc wall is stored as its chord — the straight line between its two
/// corners, which is what every other rule in the spec measures (squaring,
/// locks, opening offsets) — plus a signed sagitta: how far the middle of the
/// arc stands off that chord. Positive bulges OUTWARD, to the right of the
/// wall's direction, which in a counter-clockwise room is away from the room.
public struct Arc: Equatable, Sendable {
    public let chord: Meters
    /// Signed; |sagitta| ≤ chord / 2 in v1 (no more than a semicircle).
    public let sagitta: Meters

    public init(chord: Meters, sagitta: Meters) {
        self.chord = chord
        self.sagitta = sagitta
    }

    public var isStraight: Bool { abs(sagitta) < 1e-12 || chord <= 0 }

    /// R = c² / (8|s|) + |s| / 2.
    public var radius: Meters {
        isStraight ? .infinity : chord * chord / (8 * abs(sagitta)) + abs(sagitta) / 2
    }

    /// Half the angle the arc subtends at its centre: φ = asin(c / 2R).
    /// Past a semicircle (|s| > c/2) the arc takes the long way round,
    /// φ' = π − φ — computed, though v1 refuses to store such an arc.
    public var halfAngle: Double {
        guard !isStraight else { return 0 }
        let phi = asin(min(1, chord / (2 * radius)))
        return abs(sagitta) > chord / 2 ? .pi - phi : phi
    }

    /// The length along the curve, 2Rφ. The chord when straight.
    public var length: Meters { isStraight ? chord : 2 * radius * halfAngle }

    /// The area between the arc and its chord, R²(2φ − sin 2φ) / 2. Always
    /// positive; `signedSegmentArea` carries the in-or-out.
    public var segmentArea: Double {
        guard !isStraight else { return 0 }
        let r = radius, phi = halfAngle
        return r * r * (2 * phi - sin(2 * phi)) / 2
    }

    /// What this wall adds to the room's area: + bulging out, − bulging in.
    public var signedSegmentArea: Double { sagitta >= 0 ? segmentArea : -segmentArea }

    /// Whether v1 can store this arc (§10: |s| ≤ c/2).
    public var isSupported: Bool { abs(sagitta) <= chord / 2 + 1e-12 }

    /// The arc through a wall's two ends and a third point on it (§10 "3-point
    /// entry"): circumcentre → R → s = R − |centre − chord midpoint|, signed by
    /// the side P lies on. Nil when the three points are in a line — a
    /// straight wall, which the caller stores as `.straight`.
    ///
    /// Valid for arcs up to a semicircle, where the centre and P lie on
    /// opposite sides of the chord.
    public static func through(start a: Vec2, mid p: Vec2, end b: Vec2) -> (arc: Arc, centre: Vec2)? {
        let d = 2 * (a.x * (p.y - b.y) + p.x * (b.y - a.y) + b.x * (a.y - p.y))
        guard abs(d) > 1e-12 else { return nil }
        let a2 = a.x * a.x + a.y * a.y
        let p2 = p.x * p.x + p.y * p.y
        let b2 = b.x * b.x + b.y * b.y
        let centre = Vec2(
            (a2 * (p.y - b.y) + p2 * (b.y - a.y) + b2 * (a.y - p.y)) / d,
            (a2 * (b.x - p.x) + p2 * (a.x - b.x) + b2 * (p.x - a.x)) / d)
        let r = centre.distance(to: a)
        let mid = (a + b) * 0.5
        let magnitude = r - centre.distance(to: mid)
        // Right of a → b is positive (outward in a CCW room).
        let right = (b - a).cross(p - a) < 0
        return (Arc(chord: a.distance(to: b), sagitta: right ? magnitude : -magnitude), centre)
    }

    /// The point on the arc at fraction t of the way along it (0 = start,
    /// 1 = end), for drawing. `a → b` is the wall's direction.
    public static func point(from a: Vec2, to b: Vec2, sagitta s: Meters, at t: Double) -> Vec2 {
        let chord = a.distance(to: b)
        guard abs(s) > 1e-12, chord > 0 else { return a + (b - a) * t }
        let arc = Arc(chord: chord, sagitta: s)
        let u = (b - a) * (1 / chord)
        let right = Vec2(u.y, -u.x)
        let mid = (a + b) * 0.5
        // The centre lies on the far side of the chord from the bulge.
        let centre = mid - right * ((arc.radius - abs(s)) * (s > 0 ? 1 : -1))
        let start = atan2(a.y - centre.y, a.x - centre.x)
        // Sweep through the bulge. With the bulge to the right the centre is
        // to the left, and going a → bulge → b about it is counter-clockwise:
        // a positive sweep. Mirrored for a bulge to the left.
        let sweep = 2 * arc.halfAngle * (s > 0 ? 1 : -1)
        let angle = start + sweep * t
        return Vec2(centre.x + arc.radius * cos(angle), centre.y + arc.radius * sin(angle))
    }
}

extension Room {

    /// Wall i as an arc (a straight wall is an arc with sagitta 0).
    public func arc(_ i: Int) -> Arc {
        if case .arc(let s) = walls[i].shape { return Arc(chord: wallLength(i), sagitta: s) }
        return Arc(chord: wallLength(i), sagitta: 0)
    }

    /// The length of wall i along its face — the arc length for a curved one.
    public func wallRun(_ i: Int) -> Meters { arc(i).length }
}
