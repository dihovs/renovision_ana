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
    ///
    /// The gap is knocked out in TWO colours, not one. A wall band straddles
    /// the room's boundary — half of it lies over the floor, half over the
    /// canvas outside — and since §2 made those two different colours (white
    /// floor, grey canvas), one flat knock-out would show the wrong colour
    /// through on one side of every door in the room.
    static func draw(
        _ opening: PlanEditing.WallOpening,
        polygon: [CGPoint],
        selected: Bool,
        context: GraphicsContext,
        toScreen: (CGPoint) -> CGPoint,
        scale: CGFloat,
        inside: Color,
        outside: Color
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

        // 1. Knock the band out. The whole width goes first in the outside
        // colour — slightly wider than the wall stroke so no sliver of wall
        // survives antialiasing — then the inner half is repainted in the
        // floor's colour, overlapping the centreline by a hair so the black
        // wall leaves no seam between the two.
        let reach = max(3, tPts) / 2 + 1.5
        var cut = Path()
        cut.move(to: A)
        cut.addLine(to: B)
        context.stroke(
            cut, with: .color(outside),
            style: StrokeStyle(lineWidth: reach * 2, lineCap: .butt))

        var inner = Path()
        inner.move(to: CGPoint(x: A.x - side * nx * 0.75, y: A.y - side * ny * 0.75))
        inner.addLine(to: CGPoint(x: B.x - side * nx * 0.75, y: B.y - side * ny * 0.75))
        inner.addLine(to: CGPoint(x: B.x + side * nx * reach, y: B.y + side * ny * reach))
        inner.addLine(to: CGPoint(x: A.x + side * nx * reach, y: A.y + side * ny * reach))
        inner.closeSubpath()
        context.fill(inner, with: .color(inside))

        // 2. Jamb caps — the cut faces either side of the gap.
        for p in [A, B] {
            var jamb = Path()
            jamb.move(to: CGPoint(x: p.x - nx * tPts / 2, y: p.y - ny * tPts / 2))
            jamb.addLine(to: CGPoint(x: p.x + nx * tPts / 2, y: p.y + ny * tPts / 2))
            context.stroke(jamb, with: .color(ink), lineWidth: 1.4)
        }

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
        case .doorSingle, .doorEntry:
            // Hinge at the jamb nearer a corner of the host edge — the side
            // a framer would hang it from. An exterior entry door swings the
            // same way on a plan; what differs is its width and the wall it
            // is in, not its symbol.
            let (ai, bi) = PlanEditing.edgeCorners(opening.edge, count: polygon.count)
            let cornerA = toScreen(polygon[ai])
            let cornerB = toScreen(polygon[bi])
            let hingeAtA =
                hypot(A.x - cornerA.x, A.y - cornerA.y) <= hypot(B.x - cornerB.x, B.y - cornerB.y)
            leafAndArc(hinge: hingeAtA ? A : B, latch: hingeAtA ? B : A)

        case .doorDouble, .doorFrench:
            // Two leaves, each hinged at its own jamb, meeting in the middle.
            // French doors are the same symbol — they differ in being glazed,
            // which a plan cannot show and an elevation can.
            leafAndArc(hinge: A, latch: mid)
            leafAndArc(hinge: B, latch: mid)

        case .doorSliding, .doorBypass, .doorPatio:
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

        case .doorPocket:
            // A pocket door disappears INTO the wall, so its symbol is the
            // leaf drawn inside the wall band rather than swinging out of
            // it — the one door you can stand in front of with no clearance
            // at all, which is why it is worth telling apart on a plan.
            var slot = Path()
            slot.move(to: CGPoint(x: A.x + nx * tPts * 0.35, y: A.y + ny * tPts * 0.35))
            slot.addLine(to: CGPoint(x: B.x + nx * tPts * 0.35, y: B.y + ny * tPts * 0.35))
            context.stroke(
                slot, with: .color(ink),
                style: StrokeStyle(lineWidth: 1.4, dash: [5, 3]))

        case .doorBifold:
            // Folded in the middle: two half-leaves at an angle, which is
            // what a bifold looks like standing open.
            let half = w / 2
            let fold = CGPoint(
                x: mid.x + nx * half * 0.5, y: mid.y + ny * half * 0.5)
            var leaves = Path()
            leaves.move(to: A)
            leaves.addLine(to: fold)
            leaves.addLine(to: B)
            context.stroke(leaves, with: .color(ink), lineWidth: 1.2)

        case .doorGarage:
            // A garage door has no swing on a plan — it goes up. Drawn as
            // the panelled leaf across the opening, which is what an
            // elevation of it shows too.
            var panels = Path()
            for i in 1..<4 {
                let t = CGFloat(i) / 4
                let p = CGPoint(x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t)
                panels.move(to: CGPoint(x: p.x - nx * tPts / 2, y: p.y - ny * tPts / 2))
                panels.addLine(to: CGPoint(x: p.x + nx * tPts / 2, y: p.y + ny * tPts / 2))
            }
            context.stroke(panels, with: .color(ink), lineWidth: 0.8)

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

        case .windowStandard, .windowWide, .windowSmall, .windowDoubleHung,
            .windowCasement, .windowSliding, .windowPicture, .windowEgress,
            .windowBay:
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

    // MARK: - The split dimension chain

    /// Which figures of a wall's chain there is room to print, worked out
    /// before anything is drawn.
    ///
    /// Two questions have to be answered in that order — "is this chain worth
    /// a row at all?" and "which of its figures fit?" — because the answer to
    /// the first decides how far out the OVERALL dimension line has to sit,
    /// and that is settled by `EditorChrome.drawWallDimensions` before a
    /// single line is stroked. Hence a layout pass separate from the draw.
    struct ChainLayout {
        /// The pieces, alternating wall · opening · wall …, metres.
        let pieces: [Double]
        /// Indices of the pieces whose figure survived collision pruning.
        let labelled: Set<Int>
        /// Nothing to draw: no opening, or nothing legible left after pruning.
        var isEmpty: Bool { pieces.count < 2 || labelled.isEmpty }
    }

    /// Decide the chain's figures for one wall.
    ///
    /// **The collision rule, and why it is this one.** A chain is printed
    /// along the wall it measures, so each figure has only its own segment's
    /// run to sit in — and on a 0.9 m door at low zoom that run is a few
    /// points wide. Something has to give, and the choice of what is not
    /// arbitrary: ORD-18 exists because *a door's width is the first number
    /// an operator checks*. So the priority is fixed —
    ///
    /// 1. **An opening's figure is never suppressed.** It is the reason the
    ///    chain is drawn. If it will not fit inside its own segment it is
    ///    printed anyway and allowed to overhang its arrowheads; a door width
    ///    spilling a few points past its jambs is still readable, and still
    ///    unambiguous, because it is the only figure between that pair of
    ///    opposed arrowheads.
    /// 2. **A wall piece's figure is dropped** when it does not fit inside
    ///    its own run, or when it would collide with a figure already kept.
    ///    Its information is not lost — the overall dimension one row further
    ///    out still states the wall, and the arrowheads still show where the
    ///    piece begins and ends. A missing offset is a smaller lie than two
    ///    numbers printed on top of each other.
    /// 3. **If nothing survives, the whole row is dropped** (`isEmpty`) and
    ///    the wall keeps the single overall figure alone — ink with no
    ///    information is worse than no ink.
    ///
    /// Openings are pruned first precisely so the wall pieces are the ones
    /// that yield to them, never the other way round.
    static func chainLayout(
        edge: Int,
        polygon: [CGPoint],
        openings: [PlanEditing.WallOpening],
        screenLength: CGFloat,
        context: GraphicsContext,
        proxySize: CGSize
    ) -> ChainLayout {
        let pieces = PlanEditing.chain(polygon, edge: edge, openings: openings)
        let total = pieces.reduce(0, +)
        guard pieces.count > 1, total > 0, screenLength > 1 else {
            return ChainLayout(pieces: pieces, labelled: [])
        }

        // Each piece's centre and half-width along the run, in screen points.
        var cursor = 0.0
        var spans: [(centre: CGFloat, half: CGFloat, run: CGFloat)] = []
        for (index, piece) in pieces.enumerated() {
            let centre = CGFloat((cursor + piece / 2) / total) * screenLength
            let run = CGFloat(piece / total) * screenLength
            cursor += piece
            // Measured at the weight it will be DRAWN at — an opening's
            // figure is bold and therefore wider, and measuring it regular
            // would let a wall piece be kept that then collides with it.
            let width = chainText(piece, isOpening: index % 2 == 1, context: context)
                .measure(in: proxySize).width
            spans.append((centre, width / 2, run))
        }

        var kept = Set<Int>()
        // Screen intervals along the run that a kept figure already occupies,
        // each padded by 3pt so two figures never touch shoulders.
        var taken: [ClosedRange<CGFloat>] = []

        func footprint(_ index: Int) -> ClosedRange<CGFloat> {
            let half = spans[index].half + 3
            return (spans[index].centre - half)...(spans[index].centre + half)
        }
        func keep(_ index: Int) {
            kept.insert(index)
            taken.append(footprint(index))
        }

        // Pass 1 — openings, unconditionally. They sit at the odd indices by
        // construction of `PlanEditing.chain`.
        for index in pieces.indices where index % 2 == 1 && pieces[index] > 0.02 {
            keep(index)
        }
        // Pass 2 — wall pieces, only where they fit their own run and clear
        // everything already kept.
        for index in pieces.indices where index % 2 == 0 && pieces[index] > 0.02 {
            guard spans[index].half * 2 <= spans[index].run - 4 else { continue }
            guard !taken.contains(where: { $0.overlaps(footprint(index)) }) else { continue }
            keep(index)
        }

        return ChainLayout(pieces: pieces, labelled: kept)
    }

    /// One chain figure, resolved. Openings carry the weight because they are
    /// the number being looked for; both are brand blue per the design's §6.
    private static func chainText(
        _ metres: Double, isOpening: Bool, context: GraphicsContext
    ) -> GraphicsContext.ResolvedText {
        context.resolve(
            Text(FloorPlanGeometry.feetInches(metres))
                .font(.system(size: 12, weight: isOpening ? .bold : .regular))
                .foregroundStyle(Brand.blue))
    }

    /// Draw the split chain of one wall: wall-piece · opening · wall-piece,
    /// on its own dimension row OUTSIDE the wall and INBOARD of the overall
    /// line — the arrangement in the reference's own drawing, where `4.000`
    /// sits on the outer row and `1.550 · 0.900 · 1.550` on the inner one.
    ///
    /// Segment boundaries are small opposed arrowheads, not the plain ticks
    /// this used to draw, and the figures sit on the canvas with no plate
    /// behind them (§6). `offset` is points outboard of the wall; `winding`
    /// is the polygon's orientation, so "outboard" means the same thing here
    /// as it does for the overall dimension drawn beside it.
    static func drawChain(
        edge: Int,
        polygon: [CGPoint],
        layout: ChainLayout,
        context: GraphicsContext,
        toScreen: (CGPoint) -> CGPoint,
        proxySize: CGSize,
        offset: CGFloat,
        winding: CGFloat
    ) {
        guard !layout.isEmpty else { return }
        let pieces = layout.pieces
        let total = pieces.reduce(0, +)
        guard total > 0 else { return }

        let (ai, bi) = PlanEditing.edgeCorners(edge, count: polygon.count)
        let A = toScreen(polygon[ai])
        let B = toScreen(polygon[bi])
        let len = hypot(B.x - A.x, B.y - A.y)
        guard len > 1 else { return }
        let ux = (B.x - A.x) / len
        let uy = (B.y - A.y) / len
        let nx = winding * uy
        let ny = -winding * ux

        // A point at `along` points from the start corner, on the chain row.
        func at(_ along: CGFloat) -> CGPoint {
            CGPoint(x: A.x + ux * along + nx * offset, y: A.y + uy * along + ny * offset)
        }

        let line = EditorChrome.dimensionGrey
        var rule = Path()
        rule.move(to: at(0))
        rule.addLine(to: at(len))
        context.stroke(rule, with: .color(line), lineWidth: 0.6)

        // The boundaries: every place one piece ends and the next begins, and
        // the two ends of the wall. Opposed arrowheads point INTO the segment
        // either side, which is what makes a chain read as a chain.
        var cursor = 0.0
        var boundaries: [CGFloat] = [0]
        for piece in pieces {
            cursor += piece
            boundaries.append(CGFloat(cursor / total) * len)
        }
        for boundary in boundaries {
            let p = at(boundary)
            // A short witness stub down to the wall, so the boundary is
            // visibly the jamb it came from rather than a mark in space.
            var stub = Path()
            stub.move(to: CGPoint(x: p.x - nx * (offset - 3), y: p.y - ny * (offset - 3)))
            stub.addLine(to: CGPoint(x: p.x + nx * 3, y: p.y + ny * 3))
            context.stroke(
                stub, with: .color(line),
                style: StrokeStyle(lineWidth: 0.5, dash: [1.5, 2.5]))
            EditorChrome.arrowheads(at: p, along: (ux, uy), context: context, color: line)
        }

        cursor = 0.0
        for (index, piece) in pieces.enumerated() {
            let centre = CGFloat((cursor + piece / 2) / total) * len
            cursor += piece
            guard layout.labelled.contains(index) else { continue }

            let text = chainText(piece, isOpening: index % 2 == 1, context: context)
            let size = text.measure(in: proxySize)
            let p = at(centre)
            // Along the run and the right way up, same rule as the overall
            // figure: a wall read from either end is the same wall.
            var angle = atan2(uy, ux)
            if angle > .pi / 2 { angle -= .pi } else if angle < -.pi / 2 { angle += .pi }

            context.drawLayer { layer in
                layer.translateBy(x: p.x, y: p.y)
                layer.rotate(by: Angle(radians: Double(angle)))
                // The figures sit ON the rule, so the rule is knocked out
                // from under them — no plate, per §6, just cleared paper.
                layer.fill(
                    Path(
                        CGRect(
                            x: -size.width / 2 - 3, y: -size.height / 2,
                            width: size.width + 6, height: size.height)),
                    with: .color(Brand.surface))
                layer.draw(text, at: .zero, anchor: .center)
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
