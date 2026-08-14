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
                guard let kind = PlanEditing.OpeningKind(rawValue: record.kind) else { continue }
                let placed = PlanEditing.WallOpening(
                    edge: record.edge, offset: record.offset, width: record.width, kind: kind)
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
                        kind: drawn))
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

    // MARK: - Outline

    /// Walk the walls end to end into a closed loop.
    ///
    /// Nearest-endpoint rather than exact, because scanned walls rarely meet
    /// exactly. Returns nothing rather than a wrong shape when they do not
    /// close.
    static func chainIntoPolygon(_ segments: [Segment], tolerance: Double = 0.25) -> [CGPoint] {
        guard segments.count >= 3 else { return [] }

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

            guard bestIndex >= 0, bestDistance <= tolerance, let end = bestEnd else { return [] }
            remaining.remove(at: bestIndex)
            points.append(end)
        }

        // It has to come back to where it started to be an outline at all.
        guard let start = points.first, let end = points.last,
            hypot(end.x - start.x, end.y - start.y) <= tolerance
        else { return [] }
        return points
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

    /// 17'-1" to the half inch — the drafted convention. Whole feet keep
    /// their -0"; under a foot drops the zero-feet prefix.
    static func feetInches(_ metres: Double) -> String {
        let half = (metres / 0.0254 * 2).rounded() / 2
        let feet = Int(half / 12)
        let rem = half - Double(feet) * 12
        let whole = Int(rem)
        let frac = rem.truncatingRemainder(dividingBy: 1) == 0.5 ? " 1/2" : ""
        if feet == 0 { return "\(whole)\(frac)\"" }
        return "\(feet)'-\(whole)\(frac)\""
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

        var bestPoint = CGPoint(x: width / 2, y: height / 2)
        var bestDistance = -1.0
        var gy = 0.2
        while gy < height {
            var gx = 0.2
            while gx < width {
                if inside(gx, gy) {
                    let d = edgeDistance(gx, gy)
                    if d > bestDistance {
                        bestDistance = d
                        bestPoint = CGPoint(x: gx, y: gy)
                    }
                }
                gx += 0.18
            }
            gy += 0.18
        }
        return bestPoint
    }
}
