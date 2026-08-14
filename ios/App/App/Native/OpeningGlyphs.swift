import SwiftUI

/// The opening glyphs the room editors draw.
///
/// Our own drafting, not anyone's icon set, following the conventions the
/// plan renderer already established: a break knocked out of the wall band
/// with jamb caps at cut weight, a leaf with a quarter swing arc for a door,
/// a three-line symbol for a window. Hinge side and swing direction are
/// CONVENTIONS, not measurements — a drawn room records neither, so the leaf
/// hinges at the jamb nearer a corner and swings into the room, the way a
/// draughtsman would guess it.
///
/// One implementation for both editors (`PlanEditorView`, `RoomSketchView`),
/// because two hand-copies of an arc is how the two canvases drift apart.
enum OpeningGlyphs {

    /// The wall band thickness the editors draw with, in metres — the same
    /// 2×4-partition-plus-drywall convention as the renderers.
    static let bandT = 0.114

    /// Draw one opening into an editor canvas. `toScreen` is the editor's
    /// own model-to-screen mapping; `scale` its points-per-metre.
    static func draw(
        _ opening: PlanEditing.WallOpening,
        polygon: [CGPoint],
        selected: Bool,
        context: GraphicsContext,
        toScreen: (CGPoint) -> CGPoint,
        scale: CGFloat,
        background: Color
    ) {
        guard let (a, b) = PlanEditing.openingEndpoints(polygon, opening) else { return }
        let A = toScreen(a)
        let B = toScreen(b)
        let w = hypot(B.x - A.x, B.y - A.y)
        guard w > 2 else { return }

        let ux = (B.x - A.x) / w
        let uy = (B.y - A.y) / w
        let nx = -uy
        let ny = ux
        let tPts = bandT * scale
        let ink = selected ? Brand.blue : Color(hex: 0x111111)

        // 1. Knock the band out. Slightly wider than the wall stroke so no
        // sliver of wall survives antialiasing at the jambs.
        var cut = Path()
        cut.move(to: A)
        cut.addLine(to: B)
        context.stroke(
            cut, with: .color(background),
            style: StrokeStyle(lineWidth: max(3, tPts) + 3, lineCap: .butt))

        // 2. Jamb caps — the cut faces either side of the gap.
        for p in [A, B] {
            var jamb = Path()
            jamb.move(to: CGPoint(x: p.x - nx * tPts / 2, y: p.y - ny * tPts / 2))
            jamb.addLine(to: CGPoint(x: p.x + nx * tPts / 2, y: p.y + ny * tPts / 2))
            context.stroke(jamb, with: .color(ink), lineWidth: 1.4)
        }

        // Which way is "into the room": toward the outline's own middle.
        var cx = 0.0
        var cy = 0.0
        for p in polygon {
            cx += p.x
            cy += p.y
        }
        cx /= Double(max(polygon.count, 1))
        cy /= Double(max(polygon.count, 1))
        let centre = toScreen(CGPoint(x: cx, y: cy))
        let mid = CGPoint(x: (A.x + B.x) / 2, y: (A.y + B.y) / 2)
        let side: CGFloat = ((centre.x - mid.x) * nx + (centre.y - mid.y) * ny) >= 0 ? 1 : -1

        func leafAndArc(hinge H: CGPoint, latch L: CGPoint) {
            let r = hypot(L.x - H.x, L.y - H.y)
            guard r > 2 else { return }
            let tip = CGPoint(
                x: H.x + side * nx * r,
                y: H.y + side * ny * r)

            var leaf = Path()
            leaf.move(to: H)
            leaf.addLine(to: tip)
            context.stroke(leaf, with: .color(ink), lineWidth: 1)

            let a0 = Angle(radians: atan2(tip.y - H.y, tip.x - H.x))
            let a1 = Angle(radians: atan2(L.y - H.y, L.x - H.x))
            var delta = a1.radians - a0.radians
            while delta > .pi { delta -= 2 * .pi }
            while delta < -.pi { delta += 2 * .pi }
            var arc = Path()
            arc.addArc(center: H, radius: r, startAngle: a0, endAngle: a1, clockwise: delta < 0)
            context.stroke(arc, with: .color(ink), lineWidth: 0.7)
        }

        switch opening.kind {
        case .doorSingle:
            // Hinge at the jamb nearer a corner of the host edge — the side
            // a framer would hang it from.
            let (ai, bi) = PlanEditing.edgeCorners(opening.edge, count: polygon.count)
            let cornerA = toScreen(polygon[ai])
            let cornerB = toScreen(polygon[bi])
            let hingeAtA =
                hypot(A.x - cornerA.x, A.y - cornerA.y) <= hypot(B.x - cornerB.x, B.y - cornerB.y)
            leafAndArc(hinge: hingeAtA ? A : B, latch: hingeAtA ? B : A)

        case .doorDouble:
            // Two leaves, each hinged at its own jamb, meeting in the middle.
            leafAndArc(hinge: A, latch: mid)
            leafAndArc(hinge: B, latch: mid)

        case .doorSliding:
            // The bypass convention: two panels, each just over half the
            // width, offset either side of the centreline so the overlap at
            // the middle reads.
            let panel = w * 0.55
            let off = max(1.5, tPts * 0.25)
            for (from, sign) in [(A, 1.0), (B, -1.0)] {
                var track = Path()
                let start = CGPoint(
                    x: from.x - sign * nx * off, y: from.y - sign * ny * off)
                track.move(to: start)
                track.addLine(
                    to: CGPoint(x: start.x + sign * ux * panel, y: start.y + sign * uy * panel))
                context.stroke(track, with: .color(ink), lineWidth: 1.2)
            }

        case .doorCased:
            // A passage: nothing closes it, so nothing more than the break
            // and its jambs — plus a hairline across the gap so the gap
            // itself stays tappable and visibly deliberate.
            var sill = Path()
            sill.move(to: A)
            sill.addLine(to: B)
            context.stroke(
                sill, with: .color(ink),
                style: StrokeStyle(lineWidth: 0.7, dash: [4, 3]))

        case .windowStandard, .windowWide, .windowSmall:
            // Frame lines either side of the band, glazing on the centre —
            // the three-line window, same as the plan renderer.
            for s in [1.0, -1.0] {
                var frame = Path()
                frame.move(to: CGPoint(x: A.x + s * nx * tPts / 2, y: A.y + s * ny * tPts / 2))
                frame.addLine(to: CGPoint(x: B.x + s * nx * tPts / 2, y: B.y + s * ny * tPts / 2))
                context.stroke(frame, with: .color(ink), lineWidth: 1)
            }
            var glass = Path()
            glass.move(to: A)
            glass.addLine(to: B)
            context.stroke(glass, with: .color(ink), lineWidth: 0.7)
        }
    }

    /// The split dimension chain of one wall: offset · width · offset (and
    /// longer, with more openings), drawn a step inside the room so it reads
    /// as the wall's second row under the overall length.
    static func drawChain(
        edge: Int,
        polygon: [CGPoint],
        openings: [PlanEditing.WallOpening],
        context: GraphicsContext,
        toScreen: (CGPoint) -> CGPoint,
        proxySize: CGSize
    ) {
        let pieces = PlanEditing.chain(polygon, edge: edge, openings: openings)
        // One piece means no opening — the overall label already says it.
        guard pieces.count > 1 else { return }

        let (ai, bi) = PlanEditing.edgeCorners(edge, count: polygon.count)
        let A = toScreen(polygon[ai])
        let B = toScreen(polygon[bi])
        let len = hypot(B.x - A.x, B.y - A.y)
        guard len > 1 else { return }
        let ux = (B.x - A.x) / len
        let uy = (B.y - A.y) / len
        let nx = -uy
        let ny = ux

        var cx = 0.0
        var cy = 0.0
        for p in polygon {
            cx += p.x
            cy += p.y
        }
        let centre = toScreen(
            CGPoint(x: cx / Double(max(polygon.count, 1)), y: cy / Double(max(polygon.count, 1))))
        let mid = CGPoint(x: (A.x + B.x) / 2, y: (A.y + B.y) / 2)
        let inward: CGFloat = ((centre.x - mid.x) * nx + (centre.y - mid.y) * ny) >= 0 ? 1 : -1

        let total = pieces.reduce(0, +)
        guard total > 0 else { return }

        var cursor = 0.0
        for (index, piece) in pieces.enumerated() {
            let fraction = (cursor + piece / 2) / total
            cursor += piece
            guard piece > 0.02 else { continue }

            let at = CGPoint(
                x: A.x + ux * len * fraction + inward * nx * 22,
                y: A.y + uy * len * fraction + inward * ny * 22)
            // Openings sit at the odd indices by construction of the chain.
            let isOpening = index % 2 == 1
            let text = context.resolve(
                Text(FloorPlanGeometry.feetInches(piece))
                    .font(.system(size: 9, weight: isOpening ? .bold : .regular))
                    .foregroundStyle(isOpening ? Brand.blue : Color(hex: 0x4A4A50)))
            let size = text.measure(in: proxySize)
            let box = CGRect(
                x: at.x - size.width / 2 - 4, y: at.y - 8,
                width: size.width + 8, height: 16)
            context.fill(
                Path(roundedRect: box, cornerRadius: 8),
                with: .color(Color.white.opacity(0.9)))
            context.draw(text, at: at, anchor: .center)

            // A tick where each piece meets the next, so the chain reads as
            // one measured run rather than three floating numbers.
            if index < pieces.count - 1 {
                let boundary = cursor / total
                let bp = CGPoint(
                    x: A.x + ux * len * boundary + inward * nx * 22,
                    y: A.y + uy * len * boundary + inward * ny * 22)
                var tick = Path()
                tick.move(to: CGPoint(x: bp.x - nx * 4, y: bp.y - ny * 4))
                tick.addLine(to: CGPoint(x: bp.x + nx * 4, y: bp.y + ny * 4))
                context.stroke(tick, with: .color(Color(hex: 0x6B6B70)), lineWidth: 1)
            }
        }
    }

    /// Screen-space distance from a point to an opening, for hit-testing.
    static func distance(
        to opening: PlanEditing.WallOpening, polygon: [CGPoint], from point: CGPoint
    ) -> Double {
        guard let (a, b) = PlanEditing.openingEndpoints(polygon, opening) else { return .infinity }
        let ab = PlanEditing.sub(b, a)
        let l2 = PlanEditing.dot(ab, ab)
        guard l2 > 1e-9 else { return PlanEditing.length(PlanEditing.sub(point, a)) }
        var t = PlanEditing.dot(PlanEditing.sub(point, a), ab) / l2
        t = min(1, max(0, t))
        return PlanEditing.length(
            PlanEditing.sub(point, CGPoint(x: a.x + ab.x * t, y: a.y + ab.y * t)))
    }
}
