import CoreGraphics
import Foundation

/// Turning a stored scan into a drawable plan.
///
/// A faithful port of `toFloorPlan` in roomScan.ts, and it has to stay
/// faithful: the same `room_scans.geometry` blob is drawn by both halves of
/// the app, and a plan that differs between the phone and the report is a
/// plan nobody can trust. Each step below exists because of a specific bug
/// found on real scans, and the reasons are kept with them.
enum FloorPlanGeometry {

    struct Segment {
        var x1: Double
        var y1: Double
        var x2: Double
        var y2: Double

        var length: Double { hypot(x2 - x1, y2 - y1) }
    }

    struct Opening {
        var segment: Segment
        var kind: Kind
        /// The SPECIFIC kind, when this opening was authored by hand rather
        /// than detected — a single vs double vs sliding door, not just
        /// "a door". `kind` above is the coarse category every renderer has
        /// always switched on; this is what lets one draw two leaves for a
        /// double instead of one leaf for all three.
        ///
        /// Nil for a RoomPlan detection, which genuinely does not know: the
        /// sensor reports a door-shaped hole, not its hardware. A renderer
        /// falls back to the single-leaf convention there, which is what it
        /// drew for everything before this existed.
        var detail: PlanEditing.OpeningKind? = nil
        /// The authored hinge and swing, carried through so the STOREY draws
        /// the same door the room editor does. Adding a fact to one renderer
        /// and not the other is the specific mistake this file has already
        /// made three times.
        var hingeAtStart: Bool? = nil
        var swingInward: Bool? = nil

        enum Kind { case door, window, opening }
    }

    struct Plan {
        let segments: [Segment]
        let openings: [Opening]
        /// The outline, when the walls actually close into one. Empty
        /// otherwise — an L-shaped room scanned from one side genuinely has
        /// no outline and inventing one draws a fill that is not the room.
        let polygon: [CGPoint]
        let width: Double
        let height: Double

        var isEmpty: Bool { segments.isEmpty }
    }

    // MARK: - Entry point

    static func plan(from geometry: ScanGeometry) -> Plan {
        // A plan the operator corrected by hand replaces the scan's walls for
        // drawing purposes — but only for drawing. The sensor's own geometry
        // is still in the record underneath, untouched.
        if let edited = geometry.editedPolygon, edited.count >= 3 {
            let points = edited.map { CGPoint(x: $0.x, y: $0.y) }
            var segments: [Segment] = []
            for i in points.indices {
                let a = points[i]
                let b = points[(i + 1) % points.count]
                segments.append(Segment(x1: a.x, y1: a.y, x2: b.x, y2: b.y))
            }
            let xs = points.map { $0.x }
            let ys = points.map { $0.y }
            let minX = xs.min() ?? 0
            let minY = ys.min() ?? 0
            let shifted = segments.map {
                Segment(x1: $0.x1 - minX, y1: $0.y1 - minY, x2: $0.x2 - minX, y2: $0.y2 - minY)
            }

            // Openings the operator PLACED are keyed to this polygon's edges,
            // so they can be cut into the corrected walls exactly. Detected
            // openings stay out of an edited plan — they live in the scan's
            // own coordinate frame, which the corrected polygon has left.
            var openings: [Opening] = []
            for record in geometry.authoredOpenings ?? [] {
                guard let placed = PlanEditing.WallOpening(record) else { continue }
                let kind = placed.kind
                guard let (a, b) = PlanEditing.openingEndpoints(points, placed) else { continue }
                let drawn: Opening.Kind
                switch kind.category {
                case .door: drawn = .door
                case .window: drawn = .window
                case .passage: drawn = .opening
                }
                openings.append(
                    Opening(
                        segment: Segment(
                            x1: a.x - minX, y1: a.y - minY, x2: b.x - minX, y2: b.y - minY),
                        kind: drawn,
                        // Authored by hand, so the SPECIFIC kind is known —
                        // a renderer can draw two leaves for a double
                        // rather than the single-leaf fallback.
                        detail: kind,
                        hingeAtStart: placed.hingeAtStart,
                        swingInward: placed.swingInward))
            }

            // The outline repeats its first point, matching what
            // `chainIntoPolygon` produces — the editors reconstruct their
            // corners by dropping that closing point, and an outline without
            // it loses a real corner to the drop.
            var loop = points.map { CGPoint(x: $0.x - minX, y: $0.y - minY) }
            if let first = loop.first { loop.append(first) }
            return Plan(
                segments: shifted,
                openings: openings,
                polygon: loop,
                width: (xs.max() ?? 0) - minX,
                height: (ys.max() ?? 0) - minY)
        }

        // Each wall's endpoints are its centre ± half its length along its own
        // axis. RoomPlan's z grows toward the viewer and a screen's y grows
        // downward, so z maps to y directly and the result reads the right
        // way up.
        func span(centerX: Double, centerZ: Double, axisX: Double, axisZ: Double, length: Double)
            -> Segment
        {
            let half = length / 2
            return Segment(
                x1: centerX - axisX * half,
                y1: centerZ - axisZ * half,
                x2: centerX + axisX * half,
                y2: centerZ + axisZ * half)
        }

        let rawWalls = geometry.walls.map {
            span(centerX: $0.centerX, centerZ: $0.centerZ, axisX: $0.axisX, axisZ: $0.axisZ,
                 length: $0.lengthMeters)
        }
        guard !rawWalls.isEmpty else {
            return Plan(segments: [], openings: [], polygon: [], width: 0, height: 0)
        }

        var rawOpenings: [Opening] = []
        for door in geometry.doors {
            rawOpenings.append(
                Opening(
                    segment: span(centerX: door.centerX, centerZ: door.centerZ, axisX: door.axisX,
                                  axisZ: door.axisZ, length: door.widthMeters), kind: .door))
        }
        for window in geometry.windows {
            rawOpenings.append(
                Opening(
                    segment: span(centerX: window.centerX, centerZ: window.centerZ,
                                  axisX: window.axisX, axisZ: window.axisZ,
                                  length: window.widthMeters), kind: .window))
        }
        for gap in geometry.openings {
            rawOpenings.append(
                Opening(
                    segment: span(centerX: gap.centerX, centerZ: gap.centerZ, axisX: gap.axisX,
                                  axisZ: gap.axisZ, length: gap.widthMeters), kind: .opening))
        }

        // Rotated TOGETHER, by the angle the walls imply, so a door stays in
        // the wall it was cut from.
        let combined = squareToPage(rawWalls + rawOpenings.map(\.segment))
        let rotatedWalls = Array(combined.prefix(rawWalls.count))
        let rotatedOpenings = Array(combined.suffix(from: rawWalls.count))

        let aligned = alignCollinear(walls: rotatedWalls, openings: rotatedOpenings)

        // Normalised against the SAME origin, so openings still sit in their
        // walls after the plan is moved to (0, 0).
        let xs = aligned.walls.flatMap { [$0.x1, $0.x2] }
        let ys = aligned.walls.flatMap { [$0.y1, $0.y2] }
        let minX = xs.min() ?? 0
        let minY = ys.min() ?? 0

        func shift(_ s: Segment) -> Segment {
            Segment(x1: s.x1 - minX, y1: s.y1 - minY, x2: s.x2 - minX, y2: s.y2 - minY)
        }

        let segments = aligned.walls.map(shift)
        let openings = zip(aligned.openings, rawOpenings).map {
            Opening(segment: shift($0.0), kind: $0.1.kind)
        }

        return Plan(
            segments: segments,
            openings: openings,
            polygon: chainIntoPolygon(segments),
            width: (xs.max() ?? 0) - minX,
            height: (ys.max() ?? 0) - minY)
    }

    /// Every opening the scanner found, as plan-space segments with the
    /// family and height an editable opening needs.
    ///
    /// Reads them back out of the SAME `plan(from:)` that draws them, in the
    /// same order they were built (doors, then windows, then cased
    /// openings), rather than repeating the centre-and-axis maths — a second
    /// copy of that arithmetic is a second thing to drift, and drift here
    /// means a door adopted onto a different wall from the one it is drawn
    /// on.
    static func detections(in geometry: ScanGeometry)
        -> [(segment: (CGPoint, CGPoint), category: PlanEditing.OpeningKind.Category, height: Double)]
    {
        // An edited room's openings are already authored; this is only for
        // what a scan produced.
        guard geometry.editedPolygon == nil else { return [] }
        let plan = plan(from: geometry)
        let heights =
            geometry.doors.map(\.heightMeters) + geometry.windows.map(\.heightMeters)
            + geometry.openings.map(\.heightMeters)
        return plan.openings.enumerated().map { index, opening in
            let category: PlanEditing.OpeningKind.Category
            switch opening.kind {
            case .door: category = .door
            case .window: category = .window
            case .opening: category = .passage
            }
            return (
                segment: (
                    CGPoint(x: opening.segment.x1, y: opening.segment.y1),
                    CGPoint(x: opening.segment.x2, y: opening.segment.y2)
                ),
                category: category,
                height: index < heights.count ? heights[index] : 0
            )
        }
    }

    // MARK: - Squaring

    /// Turn the plan so the longest wall lies flat along the page.
    ///
    /// A scan is measured from wherever the operator was standing when they
    /// started, so a perfectly rectangular room comes out tilted at that
    /// arbitrary angle. This is a PURE ROTATION — no length, angle or area
    /// changes — folded onto the nearest quarter-turn, because turning a room
    /// by a quarter is the same room and the nearest one is least surprising.
    static func squareToPage(_ segments: [Segment]) -> [Segment] {
        guard !segments.isEmpty else { return segments }

        let longest = segments.max { $0.length < $1.length } ?? segments[0]
        var angle = atan2(longest.y2 - longest.y1, longest.x2 - longest.x1)
        while angle > .pi / 4 { angle -= .pi / 2 }
        while angle < -.pi / 4 { angle += .pi / 2 }
        if abs(angle) < 0.005 { return segments }

        let c = cos(-angle)
        let s = sin(-angle)
        return segments.map {
            Segment(
                x1: $0.x1 * c - $0.y1 * s,
                y1: $0.x1 * s + $0.y1 * c,
                x2: $0.x2 * c - $0.y2 * s,
                y2: $0.x2 * s + $0.y2 * c)
        }
    }

    // MARK: - Collinear alignment

    private static let collinearAngle = 4 * Double.pi / 180
    private static let collinearOffset = 0.07

    /// Bring walls that are already almost collinear onto one line.
    ///
    /// RoomPlan reports a wall interrupted by a doorway as TWO surfaces, each
    /// measured independently, so the halves of one physical wall come back a
    /// few centimetres apart and draw as a step on either side of the door.
    ///
    /// Deliberately narrow: a wall only moves when another is both
    /// near-parallel AND already on nearly the same line — which is to say
    /// when the scan measured one wall twice. 7 cm is thinner than any real
    /// framed wall, so two walls that close together ARE one wall.
    static func alignCollinear(walls: [Segment], openings: [Segment])
        -> (walls: [Segment], openings: [Segment])
    {
        guard walls.count >= 2 else { return (walls, openings) }

        /// A segment's line: direction folded onto [0, pi), and the signed
        /// perpendicular distance from the origin.
        func line(_ s: Segment) -> (angle: Double, offset: Double) {
            var angle = atan2(s.y2 - s.y1, s.x2 - s.x1)
            if angle < 0 { angle += .pi }
            if angle >= .pi { angle -= .pi }
            return (angle, s.x1 * sin(angle) - s.y1 * cos(angle))
        }

        let lines = walls.map(line)
        let lengths = walls.map(\.length)

        var groupOf = [Int](repeating: -1, count: walls.count)
        var groups: [[Int]] = []
        for i in walls.indices where groupOf[i] < 0 {
            var group = [i]
            groupOf[i] = groups.count
            for j in (i + 1)..<walls.count where groupOf[j] < 0 {
                var dAngle = abs(lines[i].angle - lines[j].angle)
                if dAngle > .pi / 2 { dAngle = .pi - dAngle }
                guard dAngle <= collinearAngle else { continue }
                guard abs(lines[i].offset - lines[j].offset) <= collinearOffset else { continue }
                group.append(j)
                groupOf[j] = groups.count
            }
            groups.append(group)
        }

        // Longer walls were measured over more surface and are trusted
        // proportionally more.
        var target = [Double](repeating: 0, count: walls.count)
        var targetAngle = [Double](repeating: 0, count: walls.count)
        for group in groups {
            let total = group.reduce(0.0) { $0 + lengths[$1] }
            let weight = total == 0 ? 1 : total
            let offset = group.reduce(0.0) { $0 + lines[$1].offset * lengths[$1] } / weight
            let angle = group.reduce(0.0) { $0 + lines[$1].angle * lengths[$1] } / weight
            for i in group {
                target[i] = offset
                targetAngle[i] = angle
            }
        }

        /// Slide a segment along its OWN normal — nothing rotates.
        func slide(_ s: Segment, angle: Double, by shift: Double) -> Segment {
            let nx = sin(angle)
            let ny = -cos(angle)
            return Segment(
                x1: s.x1 + nx * shift, y1: s.y1 + ny * shift,
                x2: s.x2 + nx * shift, y2: s.y2 + ny * shift)
        }

        let movedWalls = walls.enumerated().map {
            slide($0.element, angle: lines[$0.offset].angle, by: target[$0.offset] - lines[$0.offset].offset)
        }

        // Openings follow the wall they were cut from. One with no wall near
        // enough stays where the scan put it rather than being dragged
        // somewhere invented.
        let movedOpenings = openings.map { opening -> Segment in
            let l = line(opening)
            var best = -1
            var bestDistance = collinearOffset
            for i in walls.indices {
                var dAngle = abs(l.angle - targetAngle[i])
                if dAngle > .pi / 2 { dAngle = .pi - dAngle }
                guard dAngle <= collinearAngle else { continue }
                let distance = abs(l.offset - target[i])
                if distance < bestDistance {
                    bestDistance = distance
                    best = i
                }
            }
            guard best >= 0 else { return opening }
            return slide(opening, angle: l.angle, by: target[best] - l.offset)
        }

        return (movedWalls, movedOpenings)
    }

    // MARK: - Cleaning scanned walls

    /// Shorter than this is not a wall — a doorway stub or a scan artefact.
    static let minWallM = 0.12
    private static let collinearOffsetM = 0.12
    private static let collinearAngleDeg = 8.0

    /// Smallest angle between two undirected lines, in degrees (0…90).
    private static func angleBetween(_ a: Segment, _ b: Segment) -> Double {
        let a1 = atan2(a.y2 - a.y1, a.x2 - a.x1)
        let a2 = atan2(b.y2 - b.y1, b.x2 - b.x1)
        var d = abs(a1 - a2).truncatingRemainder(dividingBy: .pi)
        if d > .pi / 2 { d = .pi - d }
        return d * 180 / .pi
    }

    /// Perpendicular distance from a point to the infinite line through a segment.
    private static func offsetFromLine(_ s: Segment, _ px: Double, _ py: Double) -> Double {
        let dx = s.x2 - s.x1, dy = s.y2 - s.y1
        let len = hypot(dx, dy)
        if len == 0 { return hypot(px - s.x1, py - s.y1) }
        return abs(dy * (px - s.x1) - dx * (py - s.y1)) / len
    }

    /// Are these two pieces the same physical wall, cut in two or seen twice?
    private static func sameWall(_ a: Segment, _ b: Segment, weld: Double) -> Bool {
        guard angleBetween(a, b) <= collinearAngleDeg else { return false }
        // Both ends of b must sit on a's line. Parallel but offset is the two
        // sides of a partition — merging those deletes a wall that exists.
        guard offsetFromLine(a, b.x1, b.y1) <= collinearOffsetM,
            offsetFromLine(a, b.x2, b.y2) <= collinearOffsetM
        else { return false }

        let dx = a.x2 - a.x1, dy = a.y2 - a.y1
        let len = hypot(dx, dy)
        guard len > 0 else { return false }
        let ux = dx / len, uy = dy / len
        let project = { (px: Double, py: Double) in (px - a.x1) * ux + (py - a.y1) * uy }
        let b1 = project(b.x1, b.y1), b2 = project(b.x2, b.y2)
        // Collinear but metres apart are two walls with a gap — a room open
        // to a hallway — not one wall. Touching or overlapping only.
        return min(b1, b2) <= len + weld && 0 <= max(b1, b2) + weld
    }

    /// Merge two collinear pieces into the one wall they came from, by keeping
    /// the extremes along the longer one's direction. Summing their lengths
    /// instead would price a wall twice as long as the room.
    private static func mergeCollinear(_ a: Segment, _ b: Segment) -> Segment {
        let base = a.length >= b.length ? a : b
        let dx = base.x2 - base.x1, dy = base.y2 - base.y1
        let len = max(hypot(dx, dy), 1e-9)
        let ux = dx / len, uy = dy / len
        let points = [(a.x1, a.y1), (a.x2, a.y2), (b.x1, b.y1), (b.x2, b.y2)]
        var lo = Double.infinity, hi = -Double.infinity
        var loPoint = points[0], hiPoint = points[0]
        for p in points {
            let t = (p.0 - base.x1) * ux + (p.1 - base.y1) * uy
            if t < lo { lo = t; loPoint = p }
            if t > hi { hi = t; hiPoint = p }
        }
        return Segment(x1: loPoint.0, y1: loPoint.1, x2: hiPoint.0, y2: hiPoint.1)
    }

    /// Drop noise, merge one-wall-in-pieces, weld near corners.
    ///
    /// Order matters: merging first means two halves of a wall become one
    /// before their shared midpoint can be mistaken for a corner.
    static func cleanedForChaining(_ segments: [Segment], weld: Double = 0.30) -> [Segment] {
        var work = segments.filter { $0.length >= minWallM }

        var merged = true
        while merged {
            merged = false
            outer: for i in work.indices {
                for j in work.indices where j > i {
                    if sameWall(work[i], work[j], weld: weld) {
                        let combined = mergeCollinear(work[i], work[j])
                        work.remove(at: j)
                        work.remove(at: i)
                        work.append(combined)
                        merged = true
                        break outer
                    }
                }
            }
        }

        // Weld the endpoints that are the same corner into one point, so the
        // walk matches exactly rather than within a tolerance that can drift.
        var corners: [CGPoint] = []
        func snap(_ x: Double, _ y: Double) -> CGPoint {
            for c in corners where hypot(c.x - x, c.y - y) <= weld { return c }
            let p = CGPoint(x: x, y: y)
            corners.append(p)
            return p
        }
        return work.map { s in
            let a = snap(s.x1, s.y1)
            let b = snap(s.x2, s.y2)
            return Segment(x1: a.x, y1: a.y, x2: b.x, y2: b.y)
        }
    }

    // MARK: - Outline

    /// A room outline with, possibly, one edge the scan never walked.
    ///
    /// magicplan closes an open room and DASHES the guessed edge (INT-S09) —
    /// showing exactly what to distrust. This carries the data for that: the
    /// loop, and which edge of it is a guess rather than a measurement.
    struct InferredOutline {
        /// The loop, in chain order. When the walls closed on their own the
        /// last point lands back at the first; when an edge was inferred the
        /// loop closes from the last point to the first along `inferredEdge`.
        let points: [CGPoint]
        /// The edge nobody walked, guessed to close the shape. Nil when the
        /// walls met on their own.
        let inferredEdge: Segment?
    }

    /// Walk the walls end to end, and close the loop with ONE guessed edge
    /// if the walk stopped short.
    ///
    /// Nearest-endpoint rather than exact, because scanned walls rarely meet
    /// exactly. Returns nil when the pieces cannot be chained into a single
    /// run at all — walls that do not even connect are not a room with a
    /// missing edge, they are fragments, and closing fragments would be
    /// pure invention.
    static func outlineWithClosure(_ segments: [Segment], tolerance: Double = 0.25)
        -> InferredOutline?
    {
        // Clean before walking. RoomPlan does not give one segment per wall:
        // a long wall arrives in pieces, a wall seen twice arrives twice, a
        // doorway leaves a stub. Walking that raw made the chain fail on
        // ordinary rooms, and a failed chain meant an empty polygon, which
        // meant the editor drew the bounding box — a room with a nook
        // silently squared off, with nobody told. The twin of this pass, and
        // its tests, are in src/lib/wallChain.ts.
        let segments = cleanedForChaining(segments, weld: tolerance)
        guard segments.count >= 3 else { return nil }

        var remaining = Array(segments.dropFirst())
        let first = segments[0]
        var points: [CGPoint] = [
            CGPoint(x: first.x1, y: first.y1),
            CGPoint(x: first.x2, y: first.y2),
        ]

        while !remaining.isEmpty {
            let tail = points[points.count - 1]
            var bestIndex = -1
            var bestDistance = Double.infinity
            var bestEnd: CGPoint?

            for (index, segment) in remaining.enumerated() {
                let start = CGPoint(x: segment.x1, y: segment.y1)
                let end = CGPoint(x: segment.x2, y: segment.y2)
                let toStart = hypot(start.x - tail.x, start.y - tail.y)
                let toEnd = hypot(end.x - tail.x, end.y - tail.y)
                if toStart < bestDistance {
                    bestDistance = toStart
                    bestIndex = index
                    bestEnd = end
                }
                if toEnd < bestDistance {
                    bestDistance = toEnd
                    bestIndex = index
                    bestEnd = start
                }
            }

            guard bestIndex >= 0, bestDistance <= tolerance, let end = bestEnd else { return nil }
            remaining.remove(at: bestIndex)
            points.append(end)
        }

        guard let start = points.first, let end = points.last else { return nil }
        if hypot(end.x - start.x, end.y - start.y) <= tolerance {
            return InferredOutline(points: points, inferredEdge: nil)
        }
        // Every wall chained but the loop never came home: the one edge
        // nobody walked. Close it and SAY it is closed — the caller decides
        // whether to draw the guess (review does, dashed) or refuse it
        // (the plan fill does).
        return InferredOutline(
            points: points,
            inferredEdge: Segment(x1: end.x, y1: end.y, x2: start.x, y2: start.y))
    }

    /// Walk the walls end to end into a closed loop.
    ///
    /// Returns nothing rather than a wrong shape when they do not close on
    /// their own — the fill this feeds must never quietly include a guessed
    /// edge. The review sheet, which labels its guess, uses
    /// `outlineWithClosure` directly.
    static func chainIntoPolygon(_ segments: [Segment], tolerance: Double = 0.25) -> [CGPoint] {
        guard let outline = outlineWithClosure(segments, tolerance: tolerance),
            outline.inferredEdge == nil
        else { return [] }
        return outline.points
    }

    // MARK: - Area

    /// The area of a simple polygon, by the shoelace formula. Absolute value,
    /// so a shape drawn clockwise measures the same as one drawn the other
    /// way — the operator dragging corners has no idea which way round they
    /// are going and should not have to.
    static func polygonArea(_ points: [CGPoint]) -> Double {
        guard points.count >= 3 else { return 0 }
        var sum = 0.0
        for i in points.indices {
            let a = points[i]
            let b = points[(i + 1) % points.count]
            sum += a.x * b.y - b.x * a.y
        }
        return abs(sum) / 2
    }
}

// MARK: - Drafting helpers (v2 renderer)

extension FloorPlanGeometry {
    /// Points where two wall ends meet — the corners the two-pass stroke
    /// must close by extending each centreline half a thickness.
    static func joints(_ segments: [Segment], snap: Double = 0.06) -> [CGPoint] {
        var pts: [CGPoint] = []
        for s in segments {
            pts.append(CGPoint(x: s.x1, y: s.y1))
            pts.append(CGPoint(x: s.x2, y: s.y2))
        }
        var out: [CGPoint] = []
        for i in pts.indices {
            for j in (i + 1)..<pts.count
            where hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < snap {
                out.append(CGPoint(x: (pts[i].x + pts[j].x) / 2, y: (pts[i].y + pts[j].y) / 2))
            }
        }
        return out
    }

    /// What a dimension line says, in whatever unit the operator chose.
    ///
    /// This was a hard-coded `LengthFormat(system: .feet, …)` — on the
    /// reasoning that the plan's convention is a DECISION (half inches,
    /// drafting style) rather than a preference. That reasoning holds for
    /// the *style* and does not hold for the *system*, and the difference
    /// was visible on one drawing: overall dimensions read `3.67 m` from
    /// `UnitSettings` while the chain right beneath them read `4'-6 1/2"`
    /// from this constant. The owner, 18 Aug 2026: *"Keep the measurement
    /// units same across the page. If I choose metric, I don't wanna see
    /// the measurement of the door in inches or feet."*
    ///
    /// So the operator's own system and denominator now win, and only
    /// `style` is forced: `.drafting` is the architectural spelling
    /// (`17'-1"`, whole feet keeping their `-0"`) that belongs on a
    /// dimension line and nowhere else. On a metric setting `style` is
    /// inert — `writeBody` never consults it — so this is exactly "their
    /// unit, drafted".
    /// Reads `UnitSettings.current` rather than `.shared` — the same
    /// nonisolated snapshot `Measure` uses, and for the same reason: these
    /// are called from `Canvas` draw closures and from report code alike,
    /// and a dimension line must not print feet to an operator working in
    /// metres because of which actor it happened to be drawn from.
    static var planDimensions: LengthFormat {
        var format = UnitSettings.current
        format.style = .drafting
        return format
    }

    /// Kept as a name because every call site says it, though it is no
    /// longer necessarily feet and inches.
    static func feetInches(_ metres: Double) -> String {
        planDimensions.format(metres)
    }

    /// Read a length the way a contractor writes one: 12, 12.5, 12' 6,
    /// 12'6", 12-6. Returns METRES, or nil when there is no number in there.
    /// Deliberately permissive — this is typed with one thumb in a basement.
    static func parseFeetInches(_ input: String) -> Double? {
        let text = input.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty, text.rangeOfCharacter(from: .decimalDigits) != nil else { return nil }

        let feetToMetres = 0.3048
        let cleaned = text.replacingOccurrences(of: "\u{2019}", with: "'")
            .replacingOccurrences(of: "\u{201D}", with: "\"")

        // Feet and inches, however they are written.
        let patterns = [
            "^(-?[0-9]+(?:\\.[0-9]+)?)\\s*(?:'|ft|feet)\\s*([0-9]+(?:\\.[0-9]+)?)?\\s*(?:\"|in|inch|inches)?$",
            "^(-?[0-9]+(?:\\.[0-9]+)?)\\s*[- ]\\s*([0-9]+(?:\\.[0-9]+)?)$",
        ]
        for pattern in patterns {
            guard
                let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
                let match = regex.firstMatch(
                    in: cleaned, range: NSRange(cleaned.startIndex..., in: cleaned))
            else { continue }

            func group(_ i: Int) -> Double? {
                guard let r = Range(match.range(at: i), in: cleaned) else { return nil }
                return Double(cleaned[r])
            }
            guard let feet = group(1) else { continue }
            let inches = group(2) ?? 0
            return (abs(feet) + inches / 12) * (feet < 0 ? -1 : 1) * feetToMetres
        }

        // Plain feet, with or without a mark.
        let bare = cleaned.replacingOccurrences(
            of: "\\s*(?:'|ft|feet)\\s*$", with: "", options: [.regularExpression, .caseInsensitive])
        guard let plain = Double(bare) else { return nil }
        return plain * feetToMetres
    }

    /// Where a label sits: the point deepest inside the polygon, by grid
    /// sample — beats the centroid on an L-shaped room, where the centroid
    /// can fall outside the room entirely.
    static func labelAnchor(_ polygon: [CGPoint], width: Double, height: Double) -> CGPoint {
        guard polygon.count >= 3 else { return CGPoint(x: width / 2, y: height / 2) }

        func inside(_ x: Double, _ y: Double) -> Bool {
            var c = false
            var j = polygon.count - 1
            for i in polygon.indices {
                if (polygon[i].y > y) != (polygon[j].y > y),
                    x < (polygon[j].x - polygon[i].x) * (y - polygon[i].y)
                        / (polygon[j].y - polygon[i].y) + polygon[i].x {
                    c.toggle()
                }
                j = i
            }
            return c
        }

        func edgeDistance(_ x: Double, _ y: Double) -> Double {
            var best = Double.greatestFiniteMagnitude
            var j = polygon.count - 1
            for i in polygon.indices {
                let ax = polygon[j].x, ay = polygon[j].y
                let bx = polygon[i].x, by = polygon[i].y
                let l2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay)
                var t = l2 == 0 ? 0 : ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / l2
                t = min(1, max(0, t))
                best = min(best, hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))))
                j = i
            }
            return best
        }

        // The deepest point is rarely a POINT. On a rectangle every point on
        // the middle line is equally far from the walls, so "the deepest
        // one" is a segment, and taking the first one the scan meets puts
        // the label at the END of that segment — the left or top of the
        // room, not its middle.
        //
        // The owner caught it on a kitchen, 18 Aug 2026: *"the writing of
        // the kitchen with the square feet under is very small, and it's not
        // in the center."* Measured against the real scan: a 4.0 × 3.0
        // kitchen was 0.54 m off centre, a 6.0 × 3.6 living room 1.18 m, and
        // an 8.0 × 1.4 corridor 3.26 m — its label sat near one end. A
        // square room came out 0.06 m off, which is why this survived: the
        // one shape where the deepest set really is a single point is the
        // one shape it was checked on.
        //
        // So: take every point within a couple of centimetres of the best
        // clearance and average them. On a rectangle that is the middle of
        // the middle line, which is the centre. On an L it is the middle of
        // the fat part, which is where a label belongs and where the
        // bounding-box centre would not be.
        let tolerance = 0.02
        var bestDistance = -1.0
        var deepest: [CGPoint] = []
        var gy = 0.2
        while gy < height {
            var gx = 0.2
            while gx < width {
                if inside(gx, gy) {
                    let d = edgeDistance(gx, gy)
                    if d > bestDistance + tolerance {
                        bestDistance = d
                        deepest = [CGPoint(x: gx, y: gy)]
                    } else if d >= bestDistance - tolerance {
                        bestDistance = max(bestDistance, d)
                        deepest.append(CGPoint(x: gx, y: gy))
                    }
                }
                gx += 0.18
            }
            gy += 0.18
        }
        guard !deepest.isEmpty else { return CGPoint(x: width / 2, y: height / 2) }
        let sum = deepest.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x, y: $0.y + $1.y) }
        return CGPoint(x: sum.x / Double(deepest.count), y: sum.y / Double(deepest.count))
    }
}
