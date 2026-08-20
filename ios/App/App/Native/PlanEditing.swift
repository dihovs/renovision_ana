import CoreGraphics
import Foundation

/// The geometry behind editing a plan by hand.
///
/// Pure functions on a closed polygon of room corners, kept apart from any
/// view so the maths can be reasoned about — and tested — without a gesture
/// in sight. Built to Docs/Interactive-Plan-Editor-Spec.md.
///
/// The governing idea, taken from every well-reviewed plan editor: a room is
/// a CLOSED POLYGON, always. Walls are its edges, derived rather than stored,
/// so there is no state in which a drag leaves a dangling wall or an open
/// loop. Whatever the finger does, the room is still a room.
enum PlanEditing {

    /// Metres. Every candidate position is rounded to this before it is shown
    /// or stored — a fingertip is never trusted for the final number. Rough
    /// by drag, exact by keypad.
    static let quantum = 0.01

    // MARK: - Small vector helpers

    static func sub(_ a: CGPoint, _ b: CGPoint) -> CGPoint {
        CGPoint(x: a.x - b.x, y: a.y - b.y)
    }

    static func length(_ v: CGPoint) -> Double { hypot(v.x, v.y) }

    static func normalised(_ v: CGPoint) -> CGPoint {
        let l = length(v)
        guard l > 1e-9 else { return CGPoint(x: 1, y: 0) }
        return CGPoint(x: v.x / l, y: v.y / l)
    }

    /// The left-hand normal of a direction.
    static func normal(_ d: CGPoint) -> CGPoint { CGPoint(x: -d.y, y: d.x) }

    static func dot(_ a: CGPoint, _ b: CGPoint) -> Double { a.x * b.x + a.y * b.y }

    static func cross(_ a: CGPoint, _ b: CGPoint) -> Double { a.x * b.y - a.y * b.x }

    static func quantise(_ value: Double) -> Double {
        (value / quantum).rounded() * quantum
    }

    static func quantise(_ p: CGPoint) -> CGPoint {
        CGPoint(x: quantise(p.x), y: quantise(p.y))
    }

    // MARK: - Lines

    /// Where two infinite lines cross, or nil when they are parallel enough
    /// that the answer would be meaningless.
    ///
    /// The tolerance is on the SINE of the angle between them, so it means
    /// the same thing regardless of how long the walls are: 0.0087 is half a
    /// degree, the point past which an intersection shoots off far enough to
    /// be nonsense.
    static func intersection(
        pointA: CGPoint, dirA: CGPoint, pointB: CGPoint, dirB: CGPoint
    ) -> CGPoint? {
        let denominator = cross(dirA, dirB)
        guard abs(denominator) > 0.0087 else { return nil }
        let t = cross(sub(pointB, pointA), dirB) / denominator
        return CGPoint(x: pointA.x + dirA.x * t, y: pointA.y + dirA.y * t)
    }

    // MARK: - Polygon edges

    /// Corner indices of edge `i`: from corner i to corner i+1, wrapping.
    static func edgeCorners(_ index: Int, count: Int) -> (Int, Int) {
        (index, (index + 1) % count)
    }

    static func edgeLength(_ polygon: [CGPoint], _ index: Int) -> Double {
        guard polygon.count >= 2 else { return 0 }
        let (a, b) = edgeCorners(index, count: polygon.count)
        return length(sub(polygon[b], polygon[a]))
    }

    // MARK: - Wall drag

    /// Slide one wall sideways, letting its neighbours stretch to meet it.
    ///
    /// The dragged wall keeps its own direction and the two walls either side
    /// keep theirs; only the two shared corners move, to wherever the offset
    /// line now crosses the neighbours' lines. That is what "the adjoining
    /// walls extend or shorten" means geometrically, and it is the single
    /// behaviour that makes dragging a wall feel like editing a room rather
    /// than breaking one.
    ///
    /// `offset` is signed along the wall's own normal, in metres. Returns nil
    /// when a neighbour is too near parallel for an intersection to mean
    /// anything — the caller falls back to `translateEdge`.
    static func dragEdge(_ polygon: [CGPoint], index: Int, offset: Double) -> [CGPoint]? {
        let n = polygon.count
        guard n >= 3, index >= 0, index < n else { return nil }

        let (aIndex, bIndex) = edgeCorners(index, count: n)
        let previousIndex = (aIndex - 1 + n) % n
        let nextIndex = (bIndex + 1) % n

        let direction = normalised(sub(polygon[bIndex], polygon[aIndex]))
        let sideways = normal(direction)
        let shift = CGPoint(x: sideways.x * offset, y: sideways.y * offset)

        // The dragged wall's line, moved sideways but pointing the same way.
        let movedA = CGPoint(x: polygon[aIndex].x + shift.x, y: polygon[aIndex].y + shift.y)

        let previousDirection = normalised(sub(polygon[aIndex], polygon[previousIndex]))
        let nextDirection = normalised(sub(polygon[nextIndex], polygon[bIndex]))

        guard
            let newA = intersection(
                pointA: movedA, dirA: direction,
                pointB: polygon[previousIndex], dirB: previousDirection),
            let newB = intersection(
                pointA: movedA, dirA: direction,
                pointB: polygon[nextIndex], dirB: nextDirection)
        else { return nil }

        var result = polygon
        result[aIndex] = quantise(newA)
        result[bIndex] = quantise(newB)
        return result
    }

    /// Move a wall rigidly, taking its corners with it.
    ///
    /// The fallback when a neighbour runs parallel to the wall being dragged:
    /// there is no honest intersection to solve for, so both ends simply
    /// travel together rather than being flung to infinity.
    static func translateEdge(_ polygon: [CGPoint], index: Int, offset: Double) -> [CGPoint] {
        let n = polygon.count
        guard n >= 3, index >= 0, index < n else { return polygon }
        let (a, b) = edgeCorners(index, count: n)
        let sideways = normal(normalised(sub(polygon[b], polygon[a])))
        let shift = CGPoint(x: sideways.x * offset, y: sideways.y * offset)

        var result = polygon
        result[a] = quantise(CGPoint(x: polygon[a].x + shift.x, y: polygon[a].y + shift.y))
        result[b] = quantise(CGPoint(x: polygon[b].x + shift.x, y: polygon[b].y + shift.y))
        return result
    }

    /// Drag one wall, taking the honest path and falling back when it fails.
    static func moveEdge(_ polygon: [CGPoint], index: Int, offset: Double) -> [CGPoint] {
        dragEdge(polygon, index: index, offset: offset)
            ?? translateEdge(polygon, index: index, offset: offset)
    }

    // MARK: - Adopting what the scanner found

    /// The catalogue entry a measured opening most likely is.
    ///
    /// **The owner, 19 Aug 2026:** *"for lidar scan i need door window
    /// autodetection, and type suggestion from our item list."* RoomPlan
    /// reports a door as a width and a height and nothing else — it has no
    /// idea whether it is looking at a bifold or a patio slider. Our
    /// catalogue does know, because every entry carries the stock size that
    /// makes it that thing, so the nearest stock width in the right family is
    /// the best guess available and a far better starting point than "door".
    ///
    /// A SUGGESTION, and it must stay one: it is offered on a row the
    /// operator can change, never written as though it were measured.
    static func suggestedKind(category: OpeningKind.Category, width: Double, height: Double)
        -> OpeningKind
    {
        let family = OpeningKind.allCases.filter { $0.category == category }
        guard let first = family.first else { return .doorSingle }
        // Width decides; height breaks ties, which is what separates a
        // picture window from a standard one of the same run.
        return family.min { a, b in
            let da = abs(a.width - width)
            let db = abs(b.width - width)
            if abs(da - db) > 0.02 { return da < db }
            return abs(a.height - height) < abs(b.height - height)
        } ?? first
    }

    /// Turn what the scanner found into openings the editor can select,
    /// move and re-type.
    ///
    /// RoomPlan's doors and windows have always been DRAWN — they are in
    /// `Plan.openings` — but they were never anything you could touch: they
    /// live as centres and axes in the scan's own frame, while an editable
    /// opening is an EDGE INDEX and a distance along it. This is the
    /// conversion between the two, and without it a scanned room's doors
    /// could only be deleted by rescanning the room.
    ///
    /// Anything that cannot be sat on a wall is dropped rather than forced.
    /// A detection floating in the middle of the room is a mis-read, and a
    /// mis-read pinned to the nearest wall is a door in the wrong place that
    /// looks deliberate.
    static func adopt(
        detected: [(
            segment: (CGPoint, CGPoint), category: OpeningKind.Category, height: Double,
            id: String?
        )],
        polygon: [CGPoint]
    ) -> [(opening: WallOpening, id: String?)] {
        let points = withoutClosingPoint(polygon)
        let n = points.count
        guard n >= 3 else { return [] }

        var adopted: [(opening: WallOpening, id: String?)] = []
        for item in detected {
            let a = item.segment.0
            let b = item.segment.1
            let width = length(sub(b, a))
            guard width > 0.15 else { continue }
            let middle = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)

            var bestEdge = -1
            var bestDistance = 0.35
            for i in points.indices {
                let (ci, di) = edgeCorners(i, count: n)
                let edgeLength = length(sub(points[di], points[ci]))
                guard edgeLength > width * 0.8 else { continue }
                let along = normalised(sub(points[di], points[ci]))
                // Parallel within about 8°: a detection square to the wall it
                // claims is a detection of something else.
                let run = normalised(sub(b, a))
                guard abs(along.x * run.y - along.y * run.x) < 0.14 else { continue }
                let across = normal(along)
                let gap = abs(dot(sub(middle, points[ci]), across))
                guard gap < bestDistance else { continue }
                let t = dot(sub(middle, points[ci]), along)
                guard t > -0.1, t < edgeLength + 0.1 else { continue }
                bestDistance = gap
                bestEdge = i
            }
            guard bestEdge >= 0 else { continue }

            let (ci, di) = edgeCorners(bestEdge, count: n)
            let edgeLength = length(sub(points[di], points[ci]))
            let along = normalised(sub(points[di], points[ci]))
            let centre = dot(sub(middle, points[ci]), along)
            // Held inside its own wall: a door reported wider than the wall
            // it sits on would otherwise be stored at a negative distance.
            let clampedWidth = min(width, edgeLength)
            let offset = min(max(centre - clampedWidth / 2, 0), max(edgeLength - clampedWidth, 0))

            let kind = suggestedKind(
                category: item.category, width: clampedWidth, height: item.height)
            let opening = WallOpening(
                edge: bestEdge, offset: quantise(offset), width: quantise(clampedWidth),
                // The MEASURED height where there is one; the catalogue's
                // sill, because RoomPlan reports no height above the floor
                // and a guessed sill on a real window is better than a
                // window sitting on the ground.
                height: item.height > 0.2 ? item.height : kind.height,
                sill: kind.sill, kind: kind)
            adopted.append((opening, item.id))
        }
        return adopted
    }

    // MARK: - Interior walls

    /// Where a new partition should run, started from a point on one of the
    /// room's own walls.
    ///
    /// The reference's `Add Wall` drops a stub that is NOT an edge of the
    /// outline — a closet divider, a knee wall, the half-wall beside a stair.
    /// It starts on the wall you tapped and runs straight into the room,
    /// which is how a partition is actually built: it lands on something.
    ///
    /// The length is cast against the room rather than assumed. A metre of
    /// wall inside a 700mm cupboard would poke out the far side, so the ray
    /// is measured to whatever it hits and the stub takes a fraction of that
    /// — long enough to grab and drag, short enough to be obviously a stub
    /// rather than a wall somebody meant to finish.
    static func stubWall(
        in polygon: [CGPoint], edge: Int, at point: CGPoint, maxLength: Double = 1.0
    ) -> (CGPoint, CGPoint)? {
        let points = withoutClosingPoint(polygon)
        let n = points.count
        guard n >= 3, points.indices.contains(edge) else { return nil }

        let (ai, bi) = edgeCorners(edge, count: n)
        let a = points[ai]
        let b = points[bi]
        let run = sub(b, a)
        let len = length(run)
        guard len > 0.05 else { return nil }
        let along = normalised(run)

        // Held to the wall it starts on, and off its corners: a stub landing
        // exactly on a corner has no wall to stand on.
        var t = dot(sub(point, a), along)
        t = min(max(t, 0.1), len - 0.1)
        guard t > 0 else { return nil }
        let foot = CGPoint(x: a.x + along.x * t, y: a.y + along.y * t)

        // Into the room, not out of it.
        //
        // Winding says which way that is — but it is CHECKED rather than
        // trusted, because getting the sign backwards puts the wall outside
        // the building, which is what the first version did and what a
        // screenshot of a stub hanging in the garden showed immediately. A
        // step off the wall either way, and whichever lands inside the room
        // wins. The polygon is the authority on its own inside.
        let sign = polygonWinding(points) >= 0 ? 1.0 : -1.0
        var inward = CGPoint(x: -along.y * sign, y: along.x * sign)
        let probe = 0.02
        if !contains(points, point: CGPoint(x: foot.x + inward.x * probe, y: foot.y + inward.y * probe)) {
            inward = CGPoint(x: -inward.x, y: -inward.y)
        }

        // How far before it would leave the room.
        var clearance = Double.greatestFiniteMagnitude
        for i in points.indices where i != edge {
            let (ci, di) = edgeCorners(i, count: n)
            guard
                let hit = rayHit(
                    origin: foot, direction: inward, segment: (points[ci], points[di]))
            else { continue }
            clearance = min(clearance, hit)
        }
        guard clearance.isFinite, clearance > 0.25 else { return nil }

        let reach = min(maxLength, clearance * 0.6)
        let tip = CGPoint(x: foot.x + inward.x * reach, y: foot.y + inward.y * reach)
        return (quantise(foot), quantise(tip))
    }

    /// Distance from `origin` along `direction` to a segment, or nil.
    private static func rayHit(
        origin: CGPoint, direction: CGPoint, segment: (CGPoint, CGPoint)
    ) -> Double? {
        let seg = sub(segment.1, segment.0)
        let denominator = direction.x * seg.y - direction.y * seg.x
        guard abs(denominator) > 1e-9 else { return nil }
        let delta = sub(segment.0, origin)
        let t = (delta.x * seg.y - delta.y * seg.x) / denominator
        let u = (delta.x * direction.y - delta.y * direction.x) / denominator
        guard t > 1e-6, u >= -1e-6, u <= 1 + 1e-6 else { return nil }
        return t
    }

    /// How far a point is from a partition, for hit-testing.
    static func distance(to wall: ScanGeometry.InteriorWall, from point: CGPoint) -> Double {
        let a = CGPoint(x: wall.x1, y: wall.y1)
        let b = CGPoint(x: wall.x2, y: wall.y2)
        let ab = sub(b, a)
        let squared = dot(ab, ab)
        guard squared > 1e-9 else { return length(sub(point, a)) }
        var t = dot(sub(point, a), ab) / squared
        t = min(1, max(0, t))
        return length(sub(point, CGPoint(x: a.x + ab.x * t, y: a.y + ab.y * t)))
    }

    // MARK: - Mirroring

    /// Which way a duplicate is flipped.
    ///
    /// The reference offers `Identical · Flip Horizontally · Flip Vertically`
    /// when a room is duplicated — watched on the owner's own phone, 19 Aug
    /// 2026 — and it is the right set for houses: a pair of bathrooms either
    /// side of a party wall are the same room mirrored, not the same room
    /// again.
    enum FlipAxis {
        /// Mirrored left to right.
        case horizontal
        /// Mirrored top to bottom.
        case vertical
    }

    /// A room mirrored, with its openings carried across.
    ///
    /// Two things have to happen at once and neither is optional.
    ///
    /// **The winding is restored.** Mirroring reverses a loop's direction, and
    /// this codebase reads inside-versus-outside from the winding — see
    /// `EditorChrome.drawWallDimensions`. A mirrored room left wound the other
    /// way would draw every dimension line THROUGH the room. So the points
    /// are reversed after mirroring, which puts the winding back.
    ///
    /// **The openings are renumbered.** Reversing renumbers every edge, and an
    /// opening is stored as an edge index plus a distance from that edge's
    /// start corner. Both change: edge `e` becomes edge `n - 2 - e`, and the
    /// distance is measured from the other end, so a door 1m from the left
    /// jamb of a 4m wall becomes a door 2.1m along the mirrored one. Leave
    /// either alone and the doors move to different walls.
    static func mirrored(
        _ polygon: [CGPoint], openings: [WallOpening], across axis: FlipAxis
    ) -> (polygon: [CGPoint], openings: [WallOpening]) {
        let points = withoutClosingPoint(polygon)
        let n = points.count
        guard n >= 3 else { return (polygon, openings) }

        let flipped = points.map { p in
            axis == .horizontal ? CGPoint(x: -p.x, y: p.y) : CGPoint(x: p.x, y: -p.y)
        }
        let reversed: [CGPoint] = (0..<n).map { flipped[n - 1 - $0] }
        let minX = reversed.map(\.x).min() ?? 0
        let minY = reversed.map(\.y).min() ?? 0
        let placed = reversed.map { quantise(CGPoint(x: $0.x - minX, y: $0.y - minY)) }

        let moved = openings.compactMap { opening -> WallOpening? in
            guard points.indices.contains(opening.edge) else { return nil }
            let length = edgeLength(points, opening.edge)
            let edge = ((n - 2 - opening.edge) % n + n) % n
            // Clamped rather than trusted: a stored opening wider than the
            // wall it claims (an older build, a wall since shortened) would
            // otherwise come out at a negative distance.
            let offset = max(0, length - opening.offset - opening.width)
            return WallOpening(
                edge: edge, offset: offset, width: opening.width,
                height: opening.height, sill: opening.sill, kind: opening.kind)
        }
        return (placed, moved)
    }

    /// Where an object standing in a room ends up when the room is mirrored.
    ///
    /// The position mirrors across the room's own extent, and so does the
    /// HEADING — a cabinet against the left wall has to end up against the
    /// right wall facing the same way into the room, and a copy that kept its
    /// old rotation would have it facing the wall.
    static func mirroredObject(
        x: Double, y: Double, rotationDegrees: Double, in extent: CGSize, across axis: FlipAxis
    ) -> (x: Double, y: Double, rotationDegrees: Double) {
        func wrap(_ degrees: Double) -> Double {
            let d = degrees.truncatingRemainder(dividingBy: 360)
            return d < 0 ? d + 360 : d
        }
        switch axis {
        case .horizontal:
            return (extent.width - x, y, wrap(180 - rotationDegrees))
        case .vertical:
            return (x, extent.height - y, wrap(-rotationDegrees))
        }
    }

    // MARK: - Naming

    /// What to call a copy of a room.
    ///
    /// **The owner, 19 Aug 2026:** *"when we duplicate, it says copy copy,
    /// fix it."* Right — appending the word unconditionally stacked it, so a
    /// third bedroom was `Bedroom copy copy` and a fourth would have been
    /// `Bedroom copy copy copy`. The word is a marker, not part of the name,
    /// and a marker only goes on once.
    ///
    /// Numbered from there, Finder's convention, because the alternative on a
    /// job with four identical units is four rooms called the same thing on
    /// one estimate. The number is chosen against the names actually in use,
    /// so deleting the middle copy of three does not leave the next duplicate
    /// colliding with one that is still there.
    static func copyName(of name: String, avoiding taken: [String]) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        // Strip a marker this name already carries, so the count continues
        // rather than restarting one level deeper.
        var base = trimmed
        if let range = base.range(of: #"\s+copy(\s+\d+)?$"#, options: [.regularExpression, .caseInsensitive]) {
            base = String(base[base.startIndex..<range.lowerBound])
        }
        base = base.trimmingCharacters(in: .whitespaces)
        // A room actually called "copy" keeps its name rather than becoming
        // a nameless " copy".
        if base.isEmpty { base = trimmed }

        let used = Set(taken.map { $0.trimmingCharacters(in: .whitespaces).lowercased() })
        let first = "\(base) copy"
        if !used.contains(first.lowercased()) { return first }
        // 2 is the first number worth printing: the unnumbered one IS the
        // first copy.
        var n = 2
        while used.contains("\(base) copy \(n)".lowercased()) { n += 1 }
        return "\(base) copy \(n)"
    }

    // MARK: - Typed length

    /// Which end of a room holds still while the other moves to meet a typed
    /// length.
    enum LengthAnchor {
        /// Both ends move equally — a room standing on its own.
        case centre
        /// The low end along the wall's own direction holds.
        case low
        /// The high end holds.
        case high
    }

    /// Resize a wall to an exact length.
    ///
    /// **A rectangle stays a rectangle.** This is the owner's report of 19
    /// Aug 2026, and it was a real bug: *"when I adjusted the left side, then
    /// after I adjusted the right side, it felt like one side got shortened
    /// from up, and then the other side got shortened from the down, and then
    /// the room changed the shape. So it didn't get square."* Exactly so.
    /// This used to move the typed wall's own two corners about the wall's own
    /// midpoint and nothing else — so shortening the left wall of a square
    /// left the right wall where it was, and the top and bottom walls came
    /// away slanted. Doing it again on the right wall sheared it the other
    /// way. Two typed numbers, both landing exactly, and a room that is no
    /// longer square.
    ///
    /// A typed length on a rectangle's wall is not a statement about that ONE
    /// wall. It is a statement about how deep the room is, so the whole
    /// rectangle takes it: the walls parallel to the typed one both become
    /// `target`, and the walls across the ends slide without turning.
    ///
    /// On a room that is NOT a rectangle there is no such reading — an L has
    /// two walls running the same way with genuinely different lengths — so
    /// that case keeps the old midpoint behaviour, which changes only the
    /// wall that was typed.
    ///
    /// `anchoring` decides which end holds still, and the caller works it out
    /// from the rooms next door: *"if a room is standing alone and not
    /// attached to anyone, it has to shrink equally. And if it's attached to
    /// another room, we're not touching the attached part."*
    static func setEdgeLength(
        _ polygon: [CGPoint], index: Int, to target: Double,
        anchoring: LengthAnchor = .centre
    ) -> [CGPoint] {
        let n = polygon.count
        guard n >= 3, index >= 0, index < n, target > 0 else { return polygon }
        let (a, b) = edgeCorners(index, count: n)
        let direction = normalised(sub(polygon[b], polygon[a]))

        guard isRectangle(polygon) else {
            // Not a rectangle: move this wall's own two ends about its own
            // midpoint, which is what this has always done. Symmetric so the
            // answer does not depend on which corner happened to be first,
            // and typing the same number twice is idempotent.
            let midpoint = CGPoint(
                x: (polygon[a].x + polygon[b].x) / 2, y: (polygon[a].y + polygon[b].y) / 2)
            let half = target / 2
            var result = polygon
            result[a] = quantise(
                CGPoint(x: midpoint.x - direction.x * half, y: midpoint.y - direction.y * half))
            result[b] = quantise(
                CGPoint(x: midpoint.x + direction.x * half, y: midpoint.y + direction.y * half))
            return result
        }

        // Scale the whole outline along the typed wall's direction. Across
        // that direction nothing changes at all, which is what keeps every
        // corner square.
        let projections = polygon.map { dot(sub($0, polygon[a]), direction) }
        guard let low = projections.min(), let high = projections.max(), high - low > 1e-6
        else { return polygon }

        let hold: Double
        switch anchoring {
        case .centre: hold = (low + high) / 2
        case .low: hold = low
        case .high: hold = high
        }
        let factor = target / (high - low)

        var result = polygon
        for i in polygon.indices {
            let moved = hold + (projections[i] - hold) * factor - projections[i]
            result[i] = quantise(
                CGPoint(
                    x: polygon[i].x + direction.x * moved,
                    y: polygon[i].y + direction.y * moved))
        }
        return result
    }

    /// Rebuild a room from one trusted corner, the wall directions it was
    /// drawn with, and the lengths typed so far — the maths behind the
    /// wall-by-wall measurement walk.
    ///
    /// The symmetric resize above is right for a single wall and wrong for a
    /// sequence: it moves the shared corner BEHIND the walk and quietly
    /// changes the wall just typed. Here the walk is honest instead: anchor
    /// at the start edge's first corner, freeze every wall's direction as it
    /// was when the walk began, and chain each wall's length — typed where
    /// typed, as-drawn where not — corner by corner, the way a tape is run
    /// from the corner you already trust. Every typed wall lands exactly and
    /// stays exactly.
    ///
    /// The LAST edge of the walk is derived, never chained: a closed room's
    /// final wall is already implied by all the others and their angles, so
    /// it absorbs whatever inconsistency the typed numbers carry — visibly,
    /// on the canvas, rather than by silently corrupting a number somebody
    /// entered. `typed` is indexed by edge; a nil keeps that wall as drawn.
    static func applyWalkLengths(
        _ baseline: [CGPoint], startEdge: Int, typed: [Double?]
    ) -> [CGPoint] {
        let n = baseline.count
        guard n >= 3, startEdge >= 0, startEdge < n, typed.count == n else { return baseline }

        var result = baseline
        // Walk n-1 edges from the anchor; the edge that returns to the
        // anchor is the derived one.
        for i in 0..<(n - 1) {
            let edge = (startEdge + i) % n
            let (a, b) = edgeCorners(edge, count: n)
            let direction = normalised(sub(baseline[b], baseline[a]))
            let length = typed[edge] ?? edgeLength(baseline, edge)
            guard length > 0 else { continue }
            result[b] = quantise(
                CGPoint(
                    x: result[a].x + direction.x * length,
                    y: result[a].y + direction.y * length))
        }
        return result
    }

    // MARK: - Corners

    static func moveCorner(_ polygon: [CGPoint], index: Int, to point: CGPoint) -> [CGPoint] {
        guard index >= 0, index < polygon.count else { return polygon }
        var result = polygon
        result[index] = quantise(point)
        return result
    }

    /// Split a wall in two at its midpoint. Returns the polygon and the index
    /// of the corner just made, so the caller can select it immediately.
    static func addCorner(_ polygon: [CGPoint], onEdge index: Int) -> ([CGPoint], Int) {
        let n = polygon.count
        guard n >= 3, index >= 0, index < n else { return (polygon, -1) }
        let (a, b) = edgeCorners(index, count: n)
        let midpoint = quantise(
            CGPoint(x: (polygon[a].x + polygon[b].x) / 2, y: (polygon[a].y + polygon[b].y) / 2))

        var result = polygon
        result.insert(midpoint, at: a + 1)
        return (result, a + 1)
    }

    /// Remove a corner, merging its two walls into one.
    ///
    /// Refused below four corners: three is the fewest that encloses
    /// anything, and a room that can be dissolved by tapping is not a room.
    static func removeCorner(_ polygon: [CGPoint], index: Int) -> [CGPoint] {
        guard polygon.count > 3, index >= 0, index < polygon.count else { return polygon }
        var result = polygon
        result.remove(at: index)
        return result
    }

    // MARK: - Validity

    /// True when two non-adjacent walls cross — a bow-tie.
    ///
    /// Never used to block a drag. The offending walls are drawn dashed red
    /// and Save is refused while it lasts: signal, do not block, because a
    /// finger often passes through an invalid shape on its way to a valid
    /// one, and a gesture that fights back is worse than one that warns.
    static func selfIntersects(_ polygon: [CGPoint]) -> Bool {
        let n = polygon.count
        guard n >= 4 else { return false }

        func segmentsCross(_ p1: CGPoint, _ p2: CGPoint, _ p3: CGPoint, _ p4: CGPoint) -> Bool {
            let d1 = sub(p2, p1)
            let d2 = sub(p4, p3)
            let denominator = cross(d1, d2)
            guard abs(denominator) > 1e-12 else { return false }
            let t = cross(sub(p3, p1), d2) / denominator
            let u = cross(sub(p3, p1), d1) / denominator
            // Strictly inside both, so merely touching at a shared corner —
            // which every adjacent pair does — is not a crossing.
            return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9
        }

        for i in 0..<n {
            for j in (i + 1)..<n {
                // Adjacent edges share a corner by definition; skip them and
                // the wrap-around pair.
                if j == i + 1 || (i == 0 && j == n - 1) { continue }
                let (a1, b1) = edgeCorners(i, count: n)
                let (a2, b2) = edgeCorners(j, count: n)
                if segmentsCross(polygon[a1], polygon[b1], polygon[a2], polygon[b2]) {
                    return true
                }
            }
        }
        return false
    }

    // MARK: - Freehand capture

    /// Ramer–Douglas–Peucker on an open path: keep only the points a
    /// straight line between two others could not stand in for, within
    /// `tolerance` (same units as the points — plan metres, here).
    ///
    /// A finger's drag comes back as dozens of samples a frame apart; stored
    /// as-is that is not a polygon a corner editor can select and drag, it
    /// is a point cloud. This is the standard reduction, kept here rather
    /// than inline so `simplifyClosed` below can share it.
    static func simplify(_ points: [CGPoint], tolerance: Double) -> [CGPoint] {
        guard points.count > 2 else { return points }

        func perpendicularDistance(_ p: CGPoint, _ a: CGPoint, _ b: CGPoint) -> Double {
            let d = sub(b, a)
            let len = length(d)
            guard len > 1e-9 else { return length(sub(p, a)) }
            let t = dot(sub(p, a), d) / (len * len)
            let proj = CGPoint(x: a.x + d.x * t, y: a.y + d.y * t)
            return length(sub(p, proj))
        }

        func reduce(_ pts: [CGPoint]) -> [CGPoint] {
            guard pts.count > 2, let first = pts.first, let last = pts.last else { return pts }
            var maxDistance = 0.0
            var splitIndex = 0
            for i in 1..<(pts.count - 1) {
                let d = perpendicularDistance(pts[i], first, last)
                if d > maxDistance {
                    maxDistance = d
                    splitIndex = i
                }
            }
            guard maxDistance > tolerance else { return [first, last] }
            let left = reduce(Array(pts[0...splitIndex]))
            let right = reduce(Array(pts[splitIndex...]))
            return left.dropLast() + right
        }

        return reduce(points)
    }

    /// The same reduction for a CLOSED loop — what a finger actually draws.
    ///
    /// `simplify` needs two distinct endpoints to measure every other point
    /// against; a loop has none. The standard trick is to close it first —
    /// append the start point back onto the end — and simplify that as an
    /// open path: every point's distance is then measured from the anchor
    /// where the finger both started and lifted, which is the one point a
    /// freehand loop is guaranteed to pass near twice. Fed straight back
    /// into `simplify`, the anchor survives as both ends of the result, so
    /// the duplicate is dropped once reduction is done.
    static func simplifyClosed(_ points: [CGPoint], tolerance: Double) -> [CGPoint] {
        guard let first = points.first, points.count > 2 else { return points }
        var simplified = simplify(points + [first], tolerance: tolerance)
        if simplified.count > 1, length(sub(simplified[0], simplified[simplified.count - 1])) < 1e-9
        {
            simplified.removeLast()
        }
        return simplified
    }

    /// The shoelace area, absolute — a room drawn clockwise measures the same
    /// as one drawn the other way.
    static func area(_ polygon: [CGPoint]) -> Double {
        guard polygon.count >= 3 else { return 0 }
        var sum = 0.0
        for i in polygon.indices {
            let a = polygon[i]
            let b = polygon[(i + 1) % polygon.count]
            sum += a.x * b.y - b.x * a.y
        }
        return abs(sum) / 2
    }

    /// Is this room a rectangle?
    ///
    /// Asked by the editors to decide whether `Set Size` is offered at all.
    /// The reference REMOVES that verb from the bar on a room that is not a
    /// rectangle and restores it when the shape becomes one again — because
    /// the walk behind it types a width and a length, and a width and a
    /// length do not describe an L. Greying it would say "not now"; the
    /// reference says "not a thing you can do to this shape", and the bar
    /// stays the one the owner learned by only ever offering verbs that
    /// apply.
    ///
    /// Four corners, four square angles. Nothing is said about the SIDES:
    /// a square is a rectangle, and the walk sets both dimensions anyway.
    ///
    /// **The tolerance is not fussiness.** Every corner this editor produces
    /// is quantised to `quantum` — one centimetre — so a 1 m wall built by
    /// dragging can sit 0.57° off square while being as square as this app
    /// can represent. A hair over one degree keeps that case, and a shape a
    /// hand deliberately pulled out of square is always far past it.
    /// A polygon without the repeated first point some of them carry.
    ///
    /// `FloorPlanGeometry.Plan.polygon` closes its loop by repeating the
    /// first corner; `PlanEditorView.corners` does not. Anything that counts
    /// corners has to say which it means, and the answer is always "the real
    /// ones".
    static func withoutClosingPoint(_ polygon: [CGPoint]) -> [CGPoint] {
        guard polygon.count > 1, let first = polygon.first, let last = polygon.last,
            abs(first.x - last.x) < 1e-9, abs(first.y - last.y) < 1e-9
        else { return polygon }
        return Array(polygon.dropLast())
    }

    static func isRectangle(_ polygon: [CGPoint], tolerance: Double = 1.2 * .pi / 180) -> Bool {
        guard polygon.count == 4 else { return false }
        let limit = sin(tolerance)
        // A collapsed edge has no direction, and `normalised` answers with a
        // placeholder rather than nothing — so it is ruled out here instead
        // of being allowed to pass as a right angle by accident.
        let collapsed = polygon.indices.contains {
            length(sub(polygon[($0 + 1) % 4], polygon[$0])) < 1e-6
        }
        guard !collapsed else { return false }
        for i in polygon.indices {
            let previous = normalised(sub(polygon[i], polygon[(i + 3) % 4]))
            let next = normalised(sub(polygon[(i + 1) % 4], polygon[i]))
            // Perpendicular means the DOT is zero; comparing it against the
            // sine of the angle is what makes the tolerance an angle rather
            // than a length, at any size of room.
            guard abs(dot(previous, next)) < limit else { return false }
        }
        return true
    }

    /// Standard ray-casting point-in-polygon, same shape as
    /// `FloorPlanGeometry.labelAnchor`'s private `inside()` — kept here,
    /// shared, rather than reinvented a third time. A tap that is not near
    /// any corner, opening or wall band and lands outside the room entirely
    /// is what tells `RoomEditorCore` the operator is done with this room —
    /// the reference's own gesture (§ interactions-editor.md, "no frame
    /// shows how selection is cleared" — the owner filled that gap from
    /// memory, 18 Aug 2026: tap the canvas outside the room, it goes back).
    static func contains(_ polygon: [CGPoint], point: CGPoint) -> Bool {
        guard polygon.count >= 3 else { return false }
        var inside = false
        var j = polygon.count - 1
        for i in polygon.indices {
            let a = polygon[i], b = polygon[j]
            if (a.y > point.y) != (b.y > point.y),
                point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x
            {
                inside.toggle()
            }
            j = i
        }
        return inside
    }

    // MARK: - Openings

    /// A door or window authored onto a wall by hand.
    ///
    /// Lives on an EDGE, not at a world coordinate: `offset` is metres from
    /// the edge's start corner to the near jamb. That way the opening rides
    /// its wall through every drag and resize — a door in a wall stays in
    /// that wall, which is the one invariant an opening has in real life.
    struct WallOpening: Equatable {
        var edge: Int
        /// Metres from the edge's start corner to the near jamb.
        var offset: Double
        var width: Double
        /// Floor to head, metres. Starts as `kind.height` when placed — same
        /// precedent as `width`, which has always started as `kind.width`
        /// and been its own field from that point on — but is independently
        /// editable from `OpeningDetailView`, 18 Aug 2026: the owner's own
        /// reference screenshot showed Width, Height and Distance to Floor
        /// as three separate stepper fields, none of them tied back to a
        /// catalog entry once an opening exists.
        var height: Double
        /// Floor to the BOTTOM of the opening, metres — the reference's
        /// "Distance to Floor" (object-model §2), and the one field this
        /// app never had anywhere to hang until now. `OpeningKind.sill`
        /// already existed as the catalog DEFAULT (ORD-24: zero for every
        /// door, a real figure for each window); this is that default, now
        /// promoted to a per-instance field the same way `width`/`height`
        /// are, so lowering one particular window's sill does not touch
        /// the catalog every other window of that kind still starts from.
        var sill: Double
        var kind: OpeningKind

        /// Which jamb the door is hinged on, and which way it opens.
        ///
        /// **Not detectable, which is the whole reason it is stored.** RoomPlan
        /// reports a door's width, its height, and whether it was standing
        /// open. It says nothing about the hinge. So this cannot be read off
        /// a scan at any quality — the owner asked for "door opening
        /// direction recognition", and the honest answer is that there is
        /// nothing to recognise it from; what there can be is a control that
        /// takes two taps and then draws the truth.
        ///
        /// `nil` means nobody has said, and the drawing falls back to the
        /// convention it has always used: hinged at the jamb nearer a corner,
        /// swinging into the room. Every door drawn before today is nil, and
        /// a convention is not a fact — so a door somebody HAS set must look
        /// no different from one they have not, or the plan would be claiming
        /// knowledge it does not have. The difference lives in the record,
        /// not in the ink.
        var hingeAtStart: Bool?
        /// True when the leaf swings into THIS room, false when it swings
        /// away from it.
        var swingInward: Bool?
    }

    /// The seven openings a water-damage estimate actually meets.
    ///
    /// Widths and heights are STARTING conventions, not measurements — the
    /// builders' stock sizes this market is framed to, stated in inches and
    /// derived, never typed as bare metres. The width is what the net wall
    /// area deducts, so a wrong default here is money; these are the sizes an
    /// adjuster will not argue with.
    enum OpeningKind: String, CaseIterable {
        case doorSingle
        case doorDouble
        case doorSliding
        /// A cased opening — a doorless passage between rooms. Authored with
        /// the doors but filed with the connective openings, because that is
        /// what it is: a gap that connects, not a door that closes.
        case doorCased
        /// **The rest of the doors a North American house actually has**,
        /// added 19 Aug 2026 on the owner's ask that the library stop being
        /// four kinds. Each is a real mechanism with a real stock width,
        /// because the width is what knocks the hole in the wall and comes
        /// off net wall area — a picture of a door we cannot measure would
        /// be worse than no door at all.
        case doorPocket
        case doorBifold
        case doorBypass
        case doorFrench
        case doorPatio
        case doorEntry
        case doorGarage
        case windowStandard
        case windowWide
        case windowSmall
        case windowDoubleHung
        case windowCasement
        case windowSliding
        case windowPicture
        case windowEgress
        case windowBay

        /// Which of the geometry's three arrays this lands in downstream.
        enum Category { case door, window, passage }

        /// Does this open on a hinge at all?
        ///
        /// A sliding, bypass, pocket or bifold door has no swing to draw and
        /// no side to open toward — the panel runs in its own plane. A garage
        /// door goes up. Asking about the swing of any of those is asking a
        /// question with no answer, so the control is not offered.
        var swings: Bool {
            switch self {
            case .doorSingle, .doorDouble, .doorFrench, .doorEntry: return true
            default: return false
            }
        }

        /// Is there ONE leaf, so that "which jamb" is a real question?
        ///
        /// A double and a French door are hinged at BOTH jambs and meet in
        /// the middle; there is no hinge side to choose. They still have a
        /// swing direction, which is why the two questions are separate.
        var hasOneLeaf: Bool {
            switch self {
            case .doorSingle, .doorEntry: return true
            default: return false
            }
        }

        var category: Category {
            switch self {
            case .doorSingle, .doorDouble, .doorSliding, .doorPocket, .doorBifold,
                .doorBypass, .doorFrench, .doorPatio, .doorEntry, .doorGarage:
                return .door
            case .doorCased:
                return .passage
            case .windowStandard, .windowWide, .windowSmall, .windowDoubleHung,
                .windowCasement, .windowSliding, .windowPicture, .windowEgress,
                .windowBay:
                return .window
            }
        }

        private static let inch = 0.0254

        var width: Double {
            switch self {
            case .doorSingle: return 32 * Self.inch
            case .doorDouble: return 60 * Self.inch
            case .doorSliding: return 72 * Self.inch
            case .doorCased: return 48 * Self.inch
            case .windowStandard: return 36 * Self.inch
            case .windowWide: return 60 * Self.inch
            case .windowSmall: return 24 * Self.inch
            // Stock widths, every one of them a size a supplier sells.
            case .doorPocket: return 32 * Self.inch
            case .doorBifold: return 30 * Self.inch
            case .doorBypass: return 60 * Self.inch
            case .doorFrench: return 60 * Self.inch
            case .doorPatio: return 72 * Self.inch
            case .doorEntry: return 36 * Self.inch
            case .doorGarage: return 96 * Self.inch
            case .windowDoubleHung: return 36 * Self.inch
            case .windowCasement: return 24 * Self.inch
            case .windowSliding: return 48 * Self.inch
            case .windowPicture: return 72 * Self.inch
            case .windowEgress: return 36 * Self.inch
            case .windowBay: return 72 * Self.inch
            }
        }

        /// What the net wall area deducts, with the width. Doors are the 6'8"
        /// builder's standard; windows a nominal 4', the small one a basement
        /// hopper's 2'.
        var height: Double {
            switch self {
            case .doorSingle, .doorDouble, .doorSliding, .doorCased:
                return 80 * Self.inch
            case .windowStandard, .windowWide:
                return 48 * Self.inch
            case .windowSmall:
                return 24 * Self.inch
            case .doorPocket, .doorBifold, .doorBypass, .doorFrench, .doorPatio,
                .doorEntry:
                return 80 * Self.inch
            // A garage door is the one opening measured in feet: 7ft is the
            // stock height, and it is most of a wall.
            case .doorGarage:
                return 84 * Self.inch
            case .windowDoubleHung:
                return 60 * Self.inch
            case .windowCasement:
                return 48 * Self.inch
            case .windowSliding:
                return 36 * Self.inch
            case .windowPicture:
                return 48 * Self.inch
            // Code egress: the sill low enough and the opening big enough to
            // climb out of. A finished basement legally needs one, and
            // whether a room HAS one changes what may be rebuilt there.
            case .windowEgress:
                return 48 * Self.inch
            case .windowBay:
                return 48 * Self.inch
            }
        }

        /// Height of the opening's underside above the floor — a window's
        /// sill, and zero for anything you walk through.
        ///
        /// This is the ONLY thing that distinguishes a door from a window.
        /// magicplan models it exactly this way and calls it `Distance to
        /// Floor` (`Docs/reference/magicplan/object-model.md` §2): there is no
        /// door type and no window type, only an object whose underside
        /// happens to sit on the floor. Keeping the same shape here means the
        /// two cases stop being different kinds of thing everywhere
        /// downstream.
        ///
        /// It is also a measurement in its own right. An elevation cannot draw
        /// a window in the right place without it, and a water line at 18"
        /// either crosses a sill or does not — which decides whether the
        /// window is in the claim.
        ///
        /// Standard sills: a punched window at 3', a wide one lower at 2'6"
        /// because it is usually a picture window, a basement hopper high at
        /// 6' since it sits at grade.
        var sill: Double {
            switch self {
            case .doorSingle, .doorDouble, .doorSliding, .doorCased:
                return 0
            case .windowStandard: return 36 * Self.inch
            case .windowWide: return 30 * Self.inch
            case .windowSmall: return 72 * Self.inch
            // Anything you walk through sits on the floor, whatever its
            // mechanism — that is what `sill` means.
            case .doorPocket, .doorBifold, .doorBypass, .doorFrench, .doorPatio,
                .doorEntry, .doorGarage:
                return 0
            case .windowDoubleHung: return 30 * Self.inch
            case .windowCasement: return 36 * Self.inch
            case .windowSliding: return 42 * Self.inch
            case .windowPicture: return 30 * Self.inch
            // Egress sills are LOW by code — no more than 44in to the sill,
            // and usually well under it in a basement. It is also why an
            // egress window is so often in a water claim: the lowest glass
            // in the house.
            case .windowEgress: return 36 * Self.inch
            case .windowBay: return 24 * Self.inch
            }
        }

        /// The top of the opening above the floor. Derived, never stored — a
        /// sill and a height that disagreed with a head would be one fact
        /// recorded twice.
        var head: Double { sill + height }

        var label: String {
            switch self {
            case .doorSingle: return "Door"
            case .doorDouble: return "Double door"
            case .doorSliding: return "Sliding door"
            case .doorCased: return "Opening (no door)"
            case .windowStandard: return "Window"
            case .windowWide: return "Wide window"
            case .windowSmall: return "Small window"
            case .doorPocket: return "Pocket door"
            case .doorBifold: return "Bifold door"
            case .doorBypass: return "Bypass door"
            case .doorFrench: return "French doors"
            case .doorPatio: return "Patio slider"
            case .doorEntry: return "Exterior entry door"
            case .doorGarage: return "Garage door"
            case .windowDoubleHung: return "Double-hung window"
            case .windowCasement: return "Casement window"
            case .windowSliding: return "Sliding window"
            case .windowPicture: return "Picture window"
            case .windowEgress: return "Egress window"
            case .windowBay: return "Bay window"
            }
        }
    }

    /// How close to a corner a jamb may sit. Real framing needs a king stud;
    /// drawings that let a door touch a corner exactly draw ambiguously.
    static let jambMargin = 0.05

    /// Pin an opening inside its wall. When the wall is too short for the
    /// margins the opening is centred instead — a visible overhang the
    /// operator will fix, rather than a silently deleted door.
    static func clampedOffset(offset: Double, width: Double, edgeLength: Double) -> Double {
        guard edgeLength - width >= 2 * jambMargin else { return (edgeLength - width) / 2 }
        return min(max(offset, jambMargin), edgeLength - width - jambMargin)
    }

    /// Place a kind on an edge, in the middle of the widest gap left between
    /// the openings already there. nil when no gap fits it — the caller
    /// disables that choice rather than overlapping two deductions.
    static func placeOpening(
        _ kind: OpeningKind, onEdge edge: Int, of polygon: [CGPoint],
        avoiding existing: [WallOpening]
    ) -> WallOpening? {
        let length = edgeLength(polygon, edge)
        // Jambs of what is already on this wall, in order, bracketed by the
        // corners' margins so every gap is computed one way.
        var stops: [(from: Double, to: Double)] = [(0, jambMargin)]
        for other in existing where other.edge == edge {
            let start = clampedOffset(offset: other.offset, width: other.width, edgeLength: length)
            stops.append((start, start + other.width))
        }
        stops.append((length - jambMargin, length))
        stops.sort { $0.from < $1.from }

        var bestStart = 0.0
        var bestRun = -1.0
        for i in 0..<(stops.count - 1) {
            let run = stops[i + 1].from - stops[i].to
            if run > bestRun {
                bestRun = run
                bestStart = stops[i].to
            }
        }
        guard bestRun >= kind.width else { return nil }
        return WallOpening(
            edge: edge,
            offset: quantise(bestStart + (bestRun - kind.width) / 2),
            width: kind.width,
            height: kind.height,
            sill: kind.sill,
            kind: kind)
    }

    /// The jamb endpoints in the polygon's own space, clamped into the wall.
    static func openingEndpoints(_ polygon: [CGPoint], _ opening: WallOpening)
        -> (a: CGPoint, b: CGPoint)?
    {
        let n = polygon.count
        guard n >= 3, opening.edge >= 0, opening.edge < n else { return nil }
        let (ai, bi) = edgeCorners(opening.edge, count: n)
        let length = edgeLength(polygon, opening.edge)
        guard length > 1e-9 else { return nil }
        let direction = normalised(sub(polygon[bi], polygon[ai]))
        let start = clampedOffset(offset: opening.offset, width: opening.width, edgeLength: length)
        return (
            CGPoint(
                x: polygon[ai].x + direction.x * start,
                y: polygon[ai].y + direction.y * start),
            CGPoint(
                x: polygon[ai].x + direction.x * (start + opening.width),
                y: polygon[ai].y + direction.y * (start + opening.width)))
    }

    /// Slide an opening along its wall, stopped by the corners' margins and
    /// by the other openings on the same wall — two doors cannot share studs,
    /// and two deductions must not share wall.
    static func slideOpening(
        _ opening: WallOpening, along polygon: [CGPoint], by delta: Double,
        avoiding others: [WallOpening]
    ) -> WallOpening {
        let length = edgeLength(polygon, opening.edge)
        var lower = jambMargin
        var upper = length - opening.width - jambMargin
        for other in others where other.edge == opening.edge && other != opening {
            let otherStart = clampedOffset(
                offset: other.offset, width: other.width, edgeLength: length)
            if otherStart >= opening.offset {
                upper = min(upper, otherStart - opening.width)
            } else {
                lower = max(lower, otherStart + other.width)
            }
        }
        guard upper >= lower else { return opening }
        var moved = opening
        moved.offset = quantise(min(max(opening.offset + delta, lower), upper))
        return moved
    }

    /// The dimension chain of one wall: the pieces from corner to corner,
    /// alternating gap · opening · gap …, summing to the wall exactly. This
    /// is a PROJECTION of the wall, derived fresh each time — never stored,
    /// so it cannot disagree with the wall it describes.
    static func chain(_ polygon: [CGPoint], edge: Int, openings: [WallOpening]) -> [Double] {
        let length = edgeLength(polygon, edge)
        guard length > 0 else { return [] }
        let sorted = openings
            .filter { $0.edge == edge }
            .map { opening -> (start: Double, width: Double) in
                (clampedOffset(offset: opening.offset, width: opening.width, edgeLength: length),
                 opening.width)
            }
            .sorted { $0.start < $1.start }
        guard !sorted.isEmpty else { return [length] }

        var pieces: [Double] = []
        var cursor = 0.0
        for piece in sorted {
            pieces.append(piece.start - cursor)
            pieces.append(piece.width)
            cursor = piece.start + piece.width
        }
        pieces.append(length - cursor)
        return pieces
    }

    // MARK: - Openings through topology changes
    //
    // Corner edits renumber the edges, and everything keyed by edge index —
    // openings, locked lengths — has to be renumbered with them or it
    // silently attaches to the wrong wall. The polygon passed in is always
    // the one from BEFORE the change.

    /// After `addCorner` split `splitEdge` at its midpoint: later edges shift
    /// up one, and an opening on the split edge goes to whichever half holds
    /// its centre.
    static func openingsAfterCornerAdded(
        _ openings: [WallOpening], polygon: [CGPoint], splitEdge: Int
    ) -> [WallOpening] {
        let half = edgeLength(polygon, splitEdge) / 2
        return openings.map { opening in
            var moved = opening
            if opening.edge > splitEdge {
                moved.edge += 1
            } else if opening.edge == splitEdge {
                let centre = opening.offset + opening.width / 2
                if centre > half {
                    moved.edge += 1
                    moved.offset = opening.offset - half
                }
            }
            return moved
        }
    }

    /// After `removeCorner` merged the two edges either side of `corner`:
    /// later edges shift down one, and openings on the merged pair land on
    /// the merged edge — the second edge's offsets pushed past the first.
    ///
    /// The merged edge is the straight chord, not the sum of the two old
    /// Turn a room a quarter-turn about its own centre.
    ///
    /// Clockwise on screen, where y grows downward: `(x, y) → (-y, x)` about
    /// the centroid. Openings need no adjustment at all — a `WallOpening`
    /// lives on an EDGE INDEX with an offset along it, and rotating every
    /// corner leaves edge N still edge N, the same length, with the same
    /// opening the same distance along it. That is the whole benefit of
    /// storing openings against edges rather than world coordinates.
    ///
    /// The centroid is the plain average of the corners, not the polygon's
    /// area centroid: the two differ on an L, and the average is what keeps
    /// a room visually where it was — which is the only thing this needs to
    /// do, since nothing downstream depends on which point was pivoted about.
    static func rotatedQuarterTurn(_ polygon: [CGPoint]) -> [CGPoint] {
        guard polygon.count >= 3 else { return polygon }
        var cx = 0.0
        var cy = 0.0
        for p in polygon {
            cx += p.x
            cy += p.y
        }
        cx /= Double(polygon.count)
        cy /= Double(polygon.count)
        return polygon.map { p in
            let dx = p.x - cx
            let dy = p.y - cy
            return quantise(CGPoint(x: cx - dy, y: cy + dx))
        }
    }

    /// walls, so the offsets are approximate for a deep corner. The corner
    /// being deleted is almost always a near-collinear kink, where the chord
    /// and the sum agree; the clamp catches the rest.
    static func openingsAfterCornerRemoved(
        _ openings: [WallOpening], polygon: [CGPoint], corner: Int
    ) -> [WallOpening] {
        let n = polygon.count
        let firstEdge = (corner - 1 + n) % n
        let secondEdge = corner
        let firstLength = edgeLength(polygon, firstEdge)
        // Where the merged pair lives after the renumbering: corner 0 merges
        // the wrap-around pair into the LAST new edge, every other corner
        // merges into the edge before it.
        let mergedEdge = corner == 0 ? n - 2 : corner - 1
        return openings.map { opening in
            var moved = opening
            if opening.edge == firstEdge {
                moved.edge = mergedEdge
            } else if opening.edge == secondEdge {
                moved.edge = mergedEdge
                moved.offset = opening.offset + firstLength
            } else if corner > 0 && opening.edge > secondEdge {
                moved.edge -= 1
            } else if corner == 0 {
                moved.edge -= 1
            }
            return moved
        }
    }

    /// Locked-length indices through the same renumbering. The split edge's
    /// own lock is dropped: the typed number was for the whole wall, and
    /// neither half is that wall any more.
    static func lockedAfterCornerAdded(_ locked: Set<Int>, splitEdge: Int) -> Set<Int> {
        Set(locked.compactMap { edge in
            if edge == splitEdge { return nil }
            return edge > splitEdge ? edge + 1 : edge
        })
    }

    /// Both merged edges lose their locks — the merged wall is a new length
    /// nobody typed.
    static func lockedAfterCornerRemoved(_ locked: Set<Int>, corner: Int, count n: Int)
        -> Set<Int>
    {
        let firstEdge = (corner - 1 + n) % n
        let secondEdge = corner
        return Set(locked.compactMap { edge in
            if edge == firstEdge || edge == secondEdge { return nil }
            if corner > 0 { return edge > secondEdge ? edge - 1 : edge }
            return edge - 1
        })
    }

    // MARK: - Snapping

    /// What a drag settled on, and whether that was a detent worth a tick.
    struct Snap {
        let value: Double
        /// True when a magnetic position captured the value — the caller
        /// fires one haptic tick per engagement, never per frame.
        let engaged: Bool
    }

    /// Pull a wall offset toward positions worth landing on.
    ///
    /// Two magnets, both in metres and both converted from a screen-point
    /// capture radius by the caller, so the pull feels the same at every zoom
    /// rather than growing as the plan is magnified.
    ///
    /// `candidates` are alignments worth snapping to — the offsets at which
    /// this wall would sit flush with another. Five-centimetre multiples come
    /// free, because rooms are built to round numbers far more often than not.
    static func snapOffset(
        _ offset: Double,
        candidates: [Double],
        capture: Double,
        alreadyEngaged: Bool
    ) -> Snap {
        // Hysteresis: it takes more movement to escape a detent than to fall
        // into one, so a hovering finger does not flutter in and out.
        let radius = alreadyEngaged ? capture * 1.5 : capture

        var best: Double?
        var bestDistance = radius

        for candidate in candidates {
            let distance = abs(offset - candidate)
            if distance < bestDistance {
                bestDistance = distance
                best = candidate
            }
        }

        let round5 = (offset / 0.05).rounded() * 0.05
        if abs(offset - round5) < bestDistance {
            bestDistance = abs(offset - round5)
            best = round5
        }

        if let best {
            return Snap(value: quantise(best), engaged: true)
        }
        return Snap(value: quantise(offset), engaged: false)
    }

    /// Pull a dragged CORNER so its two walls meet square.
    ///
    /// The owner asked for it in exactly those terms, 18 Aug 2026: *"when we
    /// change the wall, let's say we drop from an angle, and then we wanna
    /// bring it back — when it's exactly ninety degree, I want it to be
    /// magnetic."* Dragging a corner off square is easy; landing back ON
    /// square by eye is not, and a room that is 89.4° reads as square on a
    /// plan while being wrong in every figure derived from it.
    ///
    /// **Thales' circle.** The set of points at which the angle subtended by
    /// the two neighbours is exactly 90° is the circle whose DIAMETER is the
    /// segment joining them — that is the whole locus, not an approximation
    /// of it, so snapping to the nearest point on that circle is exactly
    /// "make this corner square" and nothing else.
    ///
    /// The first attempt at this (build 111) got the geometry wrong in a way
    /// worth recording, because it looked plausible: it took the
    /// perpendicular foot from each NEIGHBOUR, which squares the angle at
    /// the neighbour rather than at the corner under the finger. The owner
    /// reported it simply as "not working", and it genuinely never fired for
    /// the case he was doing — pulling one corner of a rectangle back into
    /// square.
    ///
    /// Returns the point unchanged when the circle is further than `capture`,
    /// so a deliberately angled wall is never fought. `capture` is metres,
    /// the caller converting from a screen radius exactly as `snapOffset`'s
    /// is, so the pull feels identical at every zoom.
    static func snapCornerSquare(
        _ polygon: [CGPoint], index: Int, to proposed: CGPoint, capture: Double,
        alreadyEngaged: Bool
    ) -> Snap2 {
        let n = polygon.count
        guard n >= 3, index >= 0, index < n else {
            return Snap2(point: proposed, engaged: false)
        }
        // Same hysteresis rule `snapOffset` uses: harder to leave a detent
        // than to fall into one, so a hovering finger does not flutter.
        let radius = alreadyEngaged ? capture * 1.5 : capture

        let prev = polygon[(index - 1 + n) % n]
        let next = polygon[(index + 1) % n]

        let centre = CGPoint(x: (prev.x + next.x) / 2, y: (prev.y + next.y) / 2)
        let circleR = length(sub(next, prev)) / 2
        guard circleR > 0.05 else { return Snap2(point: proposed, engaged: false) }

        let out = sub(proposed, centre)
        let d = length(out)
        // Dead centre: every direction is equally square, so there is no
        // one nearest point and nothing sensible to snap to.
        guard d > 1e-6 else { return Snap2(point: proposed, engaged: false) }

        // How far the finger is from the circle itself, not from its centre.
        let gap = abs(d - circleR)
        guard gap < radius else { return Snap2(point: proposed, engaged: false) }

        let onCircle = CGPoint(
            x: centre.x + out.x / d * circleR,
            y: centre.y + out.y / d * circleR)
        return Snap2(
            point: CGPoint(x: quantise(onCircle.x), y: quantise(onCircle.y)), engaged: true)
    }

    /// A snapped POINT and whether a magnet caught it — the two-dimensional
    /// counterpart to `Snap`, which carries a single offset.
    struct Snap2 {
        let point: CGPoint
        let engaged: Bool
    }

    // MARK: - Objects against walls (S8)

    /// An object snapped flush to a wall: where it sits, which way it faces,
    /// and which wall caught it.
    struct ObjectSnap {
        let centre: CGPoint
        /// Degrees clockwise, the same convention `ObjectCatalog.footprint`
        /// and `room_objects.rotation` use.
        let rotation: Double
        let engaged: Bool
        /// The wall it snapped to, so a caller can tell the elevation which
        /// face this thing belongs on.
        let edge: Int?
    }

    /// Pull a dragged object flush against the nearest wall.
    ///
    /// The owner's ask, plainly: *"objects and toilets need to snap to the
    /// wall."* Which is how they are actually installed — a vanity, a
    /// toilet, a run of base cabinets all sit with their backs to a wall,
    /// and dragging one into place by eye leaves a two-centimetre gap that
    /// is wrong on the plan and wrong in the elevation.
    ///
    /// Snapping sets BOTH position and rotation, because "against the wall"
    /// means square to it: a cabinet at 3° off a wall is not a cabinet
    /// anybody installed. The object's own +depth axis is turned to face
    /// INTO the room, so its back is what meets the wall.
    ///
    /// The magnet is on the BACK EDGE, not the centre — `depth / 2` in from
    /// the centre — so a deep vanity and a shallow one both catch at the
    /// same distance from the wall rather than the deep one catching first.
    ///
    /// Slid along the wall it stays put: only the perpendicular is snapped,
    /// and the position along the run is the operator's, clamped so the
    /// object cannot hang off the end of the wall it is against.
    /// Half the wall band, which is what "flush" actually means.
    ///
    /// **The bug this constant fixes**, reported on build 127 with a
    /// screenshot: *"it looks like it's going inside of the wall."* It was.
    /// A room's `corners` are the wall's CENTRELINE, but a wall is drawn as
    /// a band of `OpeningGlyphs.bandT` straddling that line — so an object
    /// snapped flush to the centreline overlaps the inner face by half the
    /// wall's thickness. On a 114mm stud wall that is 57mm of toilet inside
    /// the drywall.
    ///
    /// The face an object actually stands against is half a band INBOARD of
    /// the line, and that is what this offsets by.
    static let wallFaceInset = OpeningGlyphs.bandT / 2

    static func snapObjectToWall(
        _ polygon: [CGPoint], centre: CGPoint, width: Double, depth: Double,
        capture: Double, alreadyEngaged: Bool
    ) -> ObjectSnap {
        guard polygon.count >= 3 else {
            return ObjectSnap(centre: centre, rotation: 0, engaged: false, edge: nil)
        }
        // Same hysteresis the wall and corner magnets use: harder to leave a
        // detent than to fall into one, so a hovering finger does not
        // flutter between snapped and free.
        let radius = alreadyEngaged ? capture * 1.5 : capture
        let winding = polygonWinding(polygon)

        var best: ObjectSnap?
        var bestGap = radius

        for i in polygon.indices {
            let (ai, bi) = edgeCorners(i, count: polygon.count)
            let a = polygon[ai]
            let b = polygon[bi]
            let run = length(sub(b, a))
            guard run > 0.1 else { continue }
            let d = normalised(sub(b, a))
            // Interior side. Taken from the winding rather than from a
            // centroid test, for the reason `drawWallDimensions` documents:
            // an L-shaped room has walls whose outside faces the centroid.
            let inward = CGPoint(x: -winding * d.y, y: winding * d.x)

            let offset = sub(centre, a)
            let along = dot(offset, d)
            let across = dot(offset, inward)

            // Behind the wall, or nowhere near its run — not this wall.
            guard across > -0.05, along > -width / 2, along < run + width / 2 else { continue }

            // Flush against the wall's inner FACE, not its centreline —
            // see `wallFaceInset`.
            let restAt = depth / 2 + Self.wallFaceInset
            let gap = abs(across - restAt)
            guard gap < bestGap else { continue }

            // Square to the wall, back against it. `footprint` maps local
            // +y through a +90° turn, so aligning local +x with the wall
            // direction puts local +y on the inward normal exactly when the
            // winding is positive; the half turn fixes the other case.
            let heading = atan2(d.y, d.x) * 180 / .pi + (winding > 0 ? 0 : 180)
            let clamped = min(max(along, width / 2), max(run - width / 2, width / 2))

            bestGap = gap
            best = ObjectSnap(
                centre: CGPoint(
                    x: a.x + d.x * clamped + inward.x * restAt,
                    y: a.y + d.y * clamped + inward.y * restAt),
                rotation: heading.truncatingRemainder(dividingBy: 360),
                engaged: true,
                edge: i)
        }

        return best ?? ObjectSnap(centre: centre, rotation: 0, engaged: false, edge: nil)
    }

    /// +1 when the polygon is wound so the interior lies to the LEFT of each
    /// directed edge, -1 otherwise. Shared with `EditorChrome.winding`,
    /// which computes the same thing for the same reason; this copy is here
    /// so the geometry does not have to import a view file.
    static func polygonWinding(_ polygon: [CGPoint]) -> Double {
        // The SHOELACE, and the same sign convention as
        // `EditorChrome.winding` — deliberately identical, because the
        // inward normal derived here has to agree with the outward normal
        // that file draws dimensions along. Two windings with opposite
        // signs would put every snapped object through the wall.
        var shoelace = 0.0
        for i in polygon.indices {
            let p = polygon[i]
            let q = polygon[(i + 1) % polygon.count]
            shoelace += p.x * q.y - q.x * p.y
        }
        return shoelace >= 0 ? 1 : -1
    }

    /// Perpendicular distances at which the dragged wall would line up with
    /// each other wall running the same way — the "flush with that wall"
    /// magnets.
    static func collinearCandidates(_ polygon: [CGPoint], index: Int) -> [Double] {
        collinearAlignments(polygon, index: index).map(\.offset)
    }

    /// The same candidates, but each still knowing WHICH wall it came from —
    /// so the canvas can draw the line the finger is about to land on.
    ///
    /// **The owner, 19 Aug 2026**, watching the reference beside ours: *"Do
    /// you see the silhouette? Do you see the green lines? The gray lines
    /// that are not active? I want you to understand what are these for, and
    /// I think these are very useful for us."* They are: the snap has been
    /// here since the plan editor was built, but it was INVISIBLE — a wall
    /// jumped and buzzed and never said what it had lined up with. Showing
    /// the other alignments greyed says what ELSE is available before the
    /// finger gets there, which is the difference between a magnet that
    /// works and a magnet you can aim.
    struct Alignment {
        /// How far the dragged wall must move to land on this line.
        let offset: Double
        /// Two points ON the line, in the room's own metres — carried rather
        /// than an edge index because the useful lines mostly belong to
        /// OTHER rooms, which this room's `corners` know nothing about.
        let a: CGPoint
        let b: CGPoint
    }

    /// Every straight run the wall under the finger could land on.
    ///
    /// `others` are the neighbouring rooms' outlines, already shifted into
    /// this room's own metres — and they are the whole point. A rectangle's
    /// only self-alignment is the wall opposite, and landing on THAT means a
    /// room of zero width, so a guide list built from one room alone would
    /// be a feature that never fires. What an operator is actually doing is
    /// pulling a wall out until it runs true with the room next door.
    static func collinearAlignments(
        _ polygon: [CGPoint], index: Int, others: [[CGPoint]] = []
    ) -> [Alignment] {
        let n = polygon.count
        guard n >= 3, index >= 0, index < n else { return [] }
        let (a, b) = edgeCorners(index, count: n)
        let direction = normalised(sub(polygon[b], polygon[a]))
        let sideways = normal(direction)

        var out: [Alignment] = []

        func consider(_ p: CGPoint, _ q: CGPoint) {
            let length = self.length(sub(q, p))
            guard length > 0.2 else { return }
            // Only walls running the same way can be lined up with.
            guard abs(cross(direction, normalised(sub(q, p)))) < 0.07 else { return }
            let offset = dot(sub(p, polygon[a]), sideways)
            // One line per straight run: two rooms sharing a wall would
            // otherwise stack three identical guides on the same pixels.
            guard !out.contains(where: { abs($0.offset - offset) < 0.01 }) else { return }
            out.append(Alignment(offset: offset, a: p, b: q))
        }

        for other in 0..<n where other != index {
            let (oa, ob) = edgeCorners(other, count: n)
            consider(polygon[oa], polygon[ob])
        }
        for outline in others {
            for i in outline.indices {
                consider(outline[i], outline[(i + 1) % outline.count])
            }
        }
        return out
    }
}

// MARK: - Objects that belong to a wall

extension PlanEditing {
    /// Where an object sits RELATIVE TO A WALL, so it can be put back on that
    /// wall after the wall has moved.
    ///
    /// **The owner, 19 Aug 2026:** *"let's say sometime I have a fridge on the
    /// wall, and I'm bringing wall down. This fridge is stuck to the wall. It
    /// needs to move with the wall. But in my case, it just stays outside, and
    /// we have to move things around again."* Confirmed against the reference
    /// the same evening: pulling a kitchen's right wall in by 0.385 m carried
    /// the fridge with it, still flush, and re-split the door chain on the
    /// wall above.
    ///
    /// An object stores a position in the room, not a host wall — deliberately,
    /// since a cabinet in the middle of a floor belongs to no wall. So the
    /// anchor is DERIVED at the moment a drag starts, and only for objects
    /// actually against a wall. Everything else stays exactly where it is,
    /// which is the right answer for an island or a table.
    struct WallAnchor {
        let edge: Int
        /// Metres along the wall from its first corner. Absolute rather than
        /// fractional: a wall being dragged changes its NEIGHBOURS' lengths,
        /// and a fridge two metres from the corner should still be two metres
        /// from that corner afterwards, not two-thirds of a longer wall.
        let along: Double
        /// Metres out from the wall's line, signed along the wall's normal —
        /// what keeps the object flush rather than re-centring it.
        let offset: Double
        /// The object's heading relative to the wall's own direction, so a
        /// wall dragged out of square turns the object with it.
        let turn: Double
    }

    /// The wall an object is standing against, if any.
    ///
    /// `reach` is how far from a wall still counts as "against" it — the
    /// caller passes the object's own half-depth plus a little, so a wide
    /// cabinet is caught by the wall it touches and a table in the middle of
    /// the room is caught by nothing.
    static func wallAnchor(
        centre: CGPoint, rotation: Double, reach: Double, polygon: [CGPoint]
    ) -> WallAnchor? {
        guard polygon.count >= 3 else { return nil }
        var best: WallAnchor?
        var bestDistance = reach

        for i in polygon.indices {
            let (ai, bi) = edgeCorners(i, count: polygon.count)
            let a = polygon[ai]
            let b = polygon[bi]
            let length = self.length(sub(b, a))
            guard length > 0.05 else { continue }
            let direction = normalised(sub(b, a))
            let sideways = normal(direction)

            let relative = sub(centre, a)
            let along = dot(relative, direction)
            // Past either end is not "against this wall" — without this, the
            // wall opposite a narrow room would claim an object standing at
            // the far corner of a different one.
            guard along >= -0.05, along <= length + 0.05 else { continue }

            let offset = dot(relative, sideways)
            guard abs(offset) < bestDistance else { continue }
            bestDistance = abs(offset)
            best = WallAnchor(
                edge: i, along: along, offset: offset,
                turn: rotation - direction.angleDegrees)
        }
        return best
    }

    /// Put an anchored object back on its wall, wherever that wall is now.
    static func placed(_ anchor: WallAnchor, on polygon: [CGPoint])
        -> (centre: CGPoint, rotation: Double)?
    {
        guard polygon.count >= 3, anchor.edge < polygon.count else { return nil }
        let (ai, bi) = edgeCorners(anchor.edge, count: polygon.count)
        let a = polygon[ai]
        let b = polygon[bi]
        guard length(sub(b, a)) > 0.05 else { return nil }
        let direction = normalised(sub(b, a))
        let sideways = normal(direction)
        return (
            CGPoint(
                x: a.x + direction.x * anchor.along + sideways.x * anchor.offset,
                y: a.y + direction.y * anchor.along + sideways.y * anchor.offset),
            anchor.turn + direction.angleDegrees
        )
    }
}

extension CGPoint {
    /// This vector's heading in degrees clockwise from +x — the same
    /// convention `RoomObject.rotation` is stored in.
    fileprivate var angleDegrees: Double { atan2(y, x) * 180 / .pi }
}

// MARK: - Splitting a room in two

extension PlanEditing {
    /// One room cut into two.
    ///
    /// **Measured on the reference, 19 Aug 2026**, on the owner's own
    /// kitchen: a 2.497 x 3.111 room, its right wall selected and tapped
    /// 0.79 m up from the bottom, became a 5.67 sq m kitchen and a new
    /// 2.497 x 0.722 room below it, sitting flush and carrying the same
    /// name. The fridge stayed with the piece it was standing in.
    ///
    /// So the rule is: cut through the point on the wall the finger touched,
    /// on a line square to that wall. The ORIGINAL row keeps the larger
    /// piece — the room somebody named and photographed should stay the room
    /// — and the offcut becomes a new one.
    struct RoomSplit {
        let kept: [CGPoint]
        let made: [CGPoint]
        let keptOpenings: [WallOpening]
        let madeOpenings: [WallOpening]
        /// Openings the cut destroyed — a door lying across the line has no
        /// wall left to live in. Counted so the operator can be told rather
        /// than left to notice.
        let lost: Int
        /// Where each piece's own corner ended up relative to the room's, in
        /// the room's own metres. `plan(from:)` re-bases every polygon to its
        /// own corner, so without these the two halves would both jump to
        /// wherever the old outline started.
        let keptShift: CGSize
        let madeShift: CGSize
    }

    /// Cut `polygon` square to `edge`, through `point`.
    ///
    /// **Rectangles only, for now.** A half-plane clip is exact on a convex
    /// outline and quietly wrong on an L, and an L is the shape where an
    /// operator would most want to check the answer. The reference has not
    /// been watched splitting one, so this refuses rather than inventing a
    /// polygon — see ORD-44.
    static func splitRoom(
        _ raw: [CGPoint], edge: Int, at point: CGPoint, openings: [WallOpening]
    ) -> RoomSplit? {
        let polygon = withoutClosingPoint(raw)
        let n = polygon.count
        guard n == 4, isRectangle(polygon), edge >= 0, edge < n else { return nil }
        let (a, b) = edgeCorners(edge, count: n)
        let direction = normalised(sub(polygon[b], polygon[a]))
        let sideways = normal(direction)

        let along = polygon.map { dot(sub($0, polygon[a]), direction) }
        let across = polygon.map { dot(sub($0, polygon[a]), sideways) }
        guard let low = along.min(), let high = along.max() else { return nil }
        let cut = dot(sub(point, polygon[a]), direction)
        // Refuse a cut that would leave a sliver nobody could work in, which
        // is also what stops a mis-tap at a corner producing a zero-area room.
        guard cut - low > 0.3, high - cut > 0.3 else { return nil }

        func piece(_ lo: Double, _ hi: Double) -> [CGPoint] {
            polygon.indices.map { i in
                let clamped = min(max(along[i], lo), hi)
                // Only the corners the CUT moved are recomputed. Every other
                // corner is handed back exactly as it was, so splitting a
                // 2.497 m room does not quietly make it 2.500 — a cut
                // divides a measurement, it does not restate it.
                guard abs(clamped - along[i]) > 1e-9 else { return polygon[i] }
                let landed = quantise(clamped)
                return CGPoint(
                    x: polygon[a].x + direction.x * landed + sideways.x * across[i],
                    y: polygon[a].y + direction.y * landed + sideways.y * across[i])
            }
        }

        let lower = piece(low, cut)
        let upper = piece(cut, high)
        // The larger piece stays the room that was already there.
        let keepLower = (cut - low) >= (high - cut)
        let kept = keepLower ? lower : upper
        let made = keepLower ? upper : lower

        let origin = StoreyArranging.bounds(polygon).origin
        let keptOrigin = StoreyArranging.bounds(kept).origin
        let madeOrigin = StoreyArranging.bounds(made).origin

        var keptOpenings: [WallOpening] = []
        var madeOpenings: [WallOpening] = []
        var lost = 0
        for opening in openings {
            if let moved = rehome(opening, from: polygon, to: kept) {
                keptOpenings.append(moved)
            } else if let moved = rehome(opening, from: polygon, to: made) {
                madeOpenings.append(moved)
            } else {
                // It lay across the cut, or on a wall that is now two walls
                // and fits neither.
                lost += 1
            }
        }

        return RoomSplit(
            kept: kept, made: made,
            keptOpenings: keptOpenings, madeOpenings: madeOpenings, lost: lost,
            keptShift: CGSize(width: keptOrigin.x - origin.x, height: keptOrigin.y - origin.y),
            madeShift: CGSize(width: madeOrigin.x - origin.x, height: madeOrigin.y - origin.y))
    }

    /// The same door, re-keyed onto whichever wall of the new outline it now
    /// sits on — or nil if no single wall holds all of it.
    ///
    /// Done by GEOMETRY rather than by chasing edge indices through the cut.
    /// Indices renumber, walls split in two and pieces swap which end is
    /// which; where the door physically is does not change at all, and is the
    /// only thing worth matching on.
    private static func rehome(
        _ opening: WallOpening, from polygon: [CGPoint], to piece: [CGPoint]
    ) -> WallOpening? {
        guard let (start, end) = openingEndpoints(polygon, opening) else { return nil }
        for i in piece.indices {
            let (ea, eb) = edgeCorners(i, count: piece.count)
            let a = piece[ea]
            let b = piece[eb]
            let length = self.length(sub(b, a))
            guard length > 0.05 else { continue }
            let direction = normalised(sub(b, a))
            let sideways = normal(direction)

            // Both ends have to be ON this wall's line and WITHIN its run.
            let offA = dot(sub(start, a), sideways)
            let offB = dot(sub(end, a), sideways)
            guard abs(offA) < 0.03, abs(offB) < 0.03 else { continue }
            let alongA = dot(sub(start, a), direction)
            let alongB = dot(sub(end, a), direction)
            let from = min(alongA, alongB)
            let to = max(alongA, alongB)
            guard from > -0.02, to < length + 0.02 else { continue }

            return WallOpening(
                edge: i, offset: max(0, from), width: opening.width,
                height: opening.height, sill: opening.sill, kind: opening.kind)
        }
        return nil
    }
}

// MARK: - Merging two rooms into one

extension PlanEditing {
    /// Two rooms that share a wall, made into one.
    ///
    /// **Watched on the reference, 19 Aug 2026.** Its `Merge Rooms` is a
    /// TARGETING mode, not an instant verb: the selected room takes a
    /// bullseye, every attached neighbour grows a green arrow pointing into
    /// it, and tapping an arrow performs the merge. Two 2.5 x 2.0 rooms
    /// pushed together became one 5.0 x 2.0 room, the shared wall gone and a
    /// single row left behind.
    ///
    /// Both rooms arrive in the SAME space — floor metres — because two
    /// rooms have nothing to say to each other in their own local ones.
    ///
    /// **Rectangles only.** The union of two arbitrary polygons is a real
    /// clipping problem; the union of two flush rectangles is a walk around
    /// eight points, and two flush rectangles is what a merge is for. A
    /// non-rectangle returns nil and the caller says so.
    static func mergeRooms(_ rawA: [CGPoint], _ rawB: [CGPoint]) -> [CGPoint]? {
        // `Plan.polygon` repeats its first point to close the loop and the
        // editor's own `corners` do not. Both reach here, and a five-point
        // square is not a rectangle to any test that checks a count — which
        // is exactly how Merge Rooms shipped in 160 and never once appeared.
        let a = withoutClosingPoint(rawA)
        let b = withoutClosingPoint(rawB)
        guard a.count == 4, b.count == 4, isRectangle(a), isRectangle(b) else { return nil }

        // The shared wall: a pair of edges running the same way, on the same
        // line, overlapping along it.
        for i in a.indices {
            let (ai, bi) = edgeCorners(i, count: 4)
            let origin = a[ai]
            let direction = normalised(sub(a[bi], origin))
            let sideways = normal(direction)

            let alongA = a.map { dot(sub($0, origin), direction) }
            let acrossA = a.map { dot(sub($0, origin), sideways) }
            let alongB = b.map { dot(sub($0, origin), direction) }
            let acrossB = b.map { dot(sub($0, origin), sideways) }

            guard let a0 = alongA.min(), let a1 = alongA.max(),
                let b0 = alongB.min(), let b1 = alongB.max(),
                let ac0 = acrossA.min(), let ac1 = acrossA.max(),
                let bc0 = acrossB.min(), let bc1 = acrossB.max()
            else { continue }

            // B has to sit against A across this wall, on one side or the
            // other, and the two have to actually share a run of it.
            let seam: Double
            if abs(bc0 - ac1) < 0.05 {
                seam = (bc0 + ac1) / 2
            } else if abs(bc1 - ac0) < 0.05 {
                seam = (bc1 + ac0) / 2
            } else {
                continue
            }
            guard min(a1, b1) - max(a0, b0) > 0.25 else { continue }

            // Walk the outline. `low` is whichever room lies on the smaller
            // side of the seam, so one walk covers both orientations.
            let aIsLow = ac1 <= seam + 0.001
            let low = aIsLow ? (ac0, a0, a1) : (bc0, b0, b1)
            let high = aIsLow ? (bc1, b0, b1) : (ac1, a0, a1)

            var ring: [(Double, Double)] = [
                (low.0, low.1), (low.0, low.2),
                (seam, low.2), (seam, high.2),
                (high.0, high.2), (high.0, high.1),
                (seam, high.1), (seam, low.1),
            ]
            // Where the two rooms line up, the seam points are on the
            // straight run between their neighbours and are not corners at
            // all. Left in, they would make a "rectangle" of six points that
            // `isRectangle` would refuse ever afterwards.
            ring = ring.enumerated().filter { index, point in
                let before = ring[(index + ring.count - 1) % ring.count]
                let after = ring[(index + 1) % ring.count]
                let d1 = (point.0 - before.0, point.1 - before.1)
                let d2 = (after.0 - point.0, after.1 - point.1)
                return abs(d1.0 * d2.1 - d1.1 * d2.0) > 1e-6
            }.map(\.element)

            guard ring.count >= 4 else { continue }
            return ring.map { across, along in
                quantise(
                    CGPoint(
                        x: origin.x + direction.x * along + sideways.x * across,
                        y: origin.y + direction.y * along + sideways.y * across))
            }
        }
        return nil
    }
}
