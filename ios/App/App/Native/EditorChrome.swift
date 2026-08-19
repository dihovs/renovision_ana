import SwiftUI

/// The drafting-table chrome both room editors share.
///
/// `PlanEditorView` and `RoomSketchView` are one drawing surface reached from
/// two directions — a scanned room being corrected and a blank room being
/// drawn. Every visual word they do not share is a word the operator has to
/// learn twice, so the words live here: the dotted grid the plan sits on, the
/// tan tile grid that means "you are inside this room", the drafted dimension
/// strings and their chains, the wall manipulators, and the whole chrome —
/// nav bar, floating pills, view-mode menu, bottom action bar. Same reasoning
/// that put the opening glyphs in `OpeningGlyphs` and the keypad in
/// `MeasurementPanel`: two hand-copies is how two canvases drift apart.
///
/// The layout is `Docs/reference/magicplan/editor-chrome-design.md`, which
/// transcribes the screenshots the owner sent with the instruction *"I want
/// exactly the design that I send you on the photos. Just keep the hint of my
/// company."* Section numbers in the comments below refer to it.
///
/// What "the hint of my company" means precisely: the LAYOUT is copied — where
/// things sit, how they group, what changes with state. The icon set is not;
/// those are SF Symbols, Apple's and ours to use. And every accent that is
/// system blue in the screenshots is `Brand.blue` here. Never system blue.
enum EditorChrome {

    // MARK: - Dotted grid

    /// The paper. A dot every half metre of MODEL space, and every FIFTH dot
    /// replaced by a brand-blue `+` crosshair (§2), drawn behind everything
    /// else so the room reads as sitting on a sheet rather than floating in a
    /// void. The crosshairs are what give it the drafting-paper feel and §2
    /// is explicit that they must not be dropped.
    ///
    /// **Two modes, and which one you get is the caller's choice.**
    ///
    /// Without `model`, the lattice is in SCREEN space: fixed pitch, the
    /// paper under glass. That is what magicplan does — the reference
    /// research changed a wall from 2.5 m to 4.0 m and watched both grids,
    /// and object-model §8 records the split so nobody reverses it by
    /// accident: floor tile grid model space, background dots screen space.
    ///
    /// With `model`, the lattice is pinned to the plan's own metres, so it
    /// zooms and pans locked to the walls. **This is a deliberate
    /// divergence, asked for by the owner on 18 Aug 2026** after using the
    /// editor: *"when I zoom in and out on my floor plan, the floor plan
    /// itself zooms in and out with the grid inside, but the canvas outside
    /// of it stays still. I want the canvas also to move in and out because
    /// they have to be, like, together."* He was told what the reference
    /// does and chose to diverge. It is not a bug and must not be "fixed"
    /// back to §8 without asking him.
    ///
    /// The screen-space version exists because the model-space one was
    /// tried first and had a real fault: the dots spread apart when zooming
    /// in and packed into a grey smear when zooming out. So model mode
    /// carries the three things that fault needs — an alpha fade through
    /// the unreadable zooms, a hard cutoff below them, and majors counted
    /// from the MODEL origin rather than the view's, so they do not swim
    /// while panning. The cutoff doubles as the volume guard: the dot count
    /// can only explode at zooms where the grid has already faded out.
    ///
    /// 0.5 m pitch because that is the scale of the things being drawn —
    /// door widths, wall jogs, closet depths are all judged in half-metre
    /// steps — and the majors every fifth dot give the eye a coarse count
    /// without a single ruled line competing with the walls.
    static func drawGrid(
        context: GraphicsContext,
        size: CGSize,
        pitch: CGFloat = 22,
        dotRadius: CGFloat = 1.1,
        arm: CGFloat = 3.5,
        /// Pass the screen point of model (0, 0) and the metres→points
        /// scale to pin the grid to the plan. Nil keeps it screen-fixed.
        model: (origin: CGPoint, scale: CGFloat)? = nil
    ) {
        guard size.width > 0, size.height > 0 else { return }
        if let model {
            drawModelGrid(
                context: context, size: size, origin: model.origin, scale: model.scale,
                dotRadius: dotRadius, arm: arm)
            return
        }
        // SCREEN pitch, not model pitch. The grid is the paper, not the
        // drawing: it belongs to the view the way graph paper under glass
        // belongs to the desk, and glass does not magnify when the sheet on
        // top of it is scaled.
        //
        // This used to be generated at a 0.5 m model pitch and transformed,
        // so zooming in spread the dots apart and zooming out packed them
        // into grey smear — the grid appeared to breathe, and the operator
        // lost the fixed reference that made panning legible. Which is
        // exactly the argument `tileGrid` below already makes for the tan
        // floor grid; the background grid simply never got it.
        //
        // Fixed pitch also deletes three things the model-space version
        // needed: the alpha fade through the unreadable zooms, the dot-count
        // cap, and the model-multiple test that kept the majors from
        // swimming while panning. None of them can arise now.
        let major = 5

        var dots = Path()
        var crosses = Path()
        let r = dotRadius

        let cols = Int(size.width / pitch) + 1
        let rows = Int(size.height / pitch) + 1

        for ci in 0...cols {
            let x = CGFloat(ci) * pitch
            for ri in 0...rows {
                let y = CGFloat(ri) * pitch
                // Every fifth intersection is a crosshair (§2), counted from
                // the view's own origin so the majors sit still.
                if ci % major == 0, ri % major == 0 {
                    crosses.move(to: CGPoint(x: x - arm, y: y))
                    crosses.addLine(to: CGPoint(x: x + arm, y: y))
                    crosses.move(to: CGPoint(x: x, y: y - arm))
                    crosses.addLine(to: CGPoint(x: x, y: y + arm))
                } else {
                    dots.addEllipse(
                        in: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2))
                }
            }
        }
        context.fill(dots, with: .color(Brand.Plan.grid.opacity(0.55)))
        context.stroke(crosses, with: .color(Brand.Plan.gridCross.opacity(0.85)), lineWidth: 1)
    }

    /// The model-space lattice — the owner's divergence, above.
    ///
    /// `origin` is where model (0, 0) lands on screen and `scale` is metres
    /// → points, which together are the whole mapping: the editor's
    /// transform is a scale and a translate with no rotation, so the grid
    /// can be laid out arithmetically instead of transforming every dot.
    private static func drawModelGrid(
        context: GraphicsContext,
        size: CGSize,
        origin: CGPoint,
        scale: CGFloat,
        dotRadius: CGFloat,
        arm: CGFloat
    ) {
        /// Half a metre, the pitch the whole grid is reasoned in.
        let step: CGFloat = 0.5
        let major = 5

        let screenPitch = step * scale
        guard screenPitch.isFinite, screenPitch > 0 else { return }

        // Below `vanish` the dots are closer than the eye separates and the
        // sheet becomes a grey wash — worse than no sheet. Between `vanish`
        // and `full` it fades, so zooming out dissolves the paper rather
        // than smearing it.
        let vanish: CGFloat = 6
        let full: CGFloat = 12
        guard screenPitch > vanish else { return }
        let fade = min(1, (screenPitch - vanish) / (full - vanish))

        // Which model steps are on screen. Counted from the model origin,
        // not the view's, so a major stays a major while panning — the
        // failure that made the first model-space grid swim.
        let firstCol = Int(floor((0 - origin.x) / screenPitch))
        let lastCol = Int(ceil((size.width - origin.x) / screenPitch))
        let firstRow = Int(floor((0 - origin.y) / screenPitch))
        let lastRow = Int(ceil((size.height - origin.y) / screenPitch))
        guard lastCol >= firstCol, lastRow >= firstRow else { return }

        // Belt and braces on the volume: the fade cutoff already bounds
        // this, but a caller passing a wild scale should not lock the UI.
        guard (lastCol - firstCol + 1) * (lastRow - firstRow + 1) <= 40_000 else { return }

        var dots = Path()
        var crosses = Path()
        let r = dotRadius

        for ci in firstCol...lastCol {
            let x = origin.x + CGFloat(ci) * screenPitch
            for ri in firstRow...lastRow {
                let y = origin.y + CGFloat(ri) * screenPitch
                // `%` on a negative index is negative in Swift, so the test
                // has to be modulus-safe or the majors go missing on the
                // half of the plan left of and above the origin.
                if ci % major == 0, ri % major == 0 {
                    crosses.move(to: CGPoint(x: x - arm, y: y))
                    crosses.addLine(to: CGPoint(x: x + arm, y: y))
                    crosses.move(to: CGPoint(x: x, y: y - arm))
                    crosses.addLine(to: CGPoint(x: x, y: y + arm))
                } else {
                    dots.addEllipse(
                        in: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2))
                }
            }
        }
        context.fill(dots, with: .color(Brand.Plan.grid.opacity(0.55 * fade)))
        context.stroke(
            crosses, with: .color(Brand.Plan.gridCross.opacity(0.85 * fade)), lineWidth: 1)
    }

    // MARK: - The floor you are standing in

    /// The tan tile grid over the room you are INSIDE (§2).
    ///
    /// At floor level every room is flat grey; the one you have gone into is
    /// white with a fine tan/terracotta grid over it, and the surrounding
    /// rooms stay grey and un-gridded. That single difference is what makes
    /// "inside a room" legible without a modal — and in these two editors it
    /// is unconditional, because an editor only ever holds the one room and
    /// you are by definition inside it.
    ///
    /// It replaces the blue diagonal hatch that used to mean "selected". The
    /// hatch was carrying the wrong idea: selection is already said by the
    /// blue wall and the corner dots, and hatching the whole floor for it
    /// left nothing to say which room the canvas is about.
    ///
    /// Drawn as Canvas strokes at FIXED POINT spacing, deliberately. An image
    /// tile would pixelate under zoom; a pattern fill anchored to model space
    /// would change density as the zoom changes, making the same floor look
    /// different at every magnification. Lines redrawn per frame at constant
    /// point pitch cost almost nothing and always look the same.
    static let tile = Brand.Plan.tile

    static func tileGrid(_ outline: Path, context: GraphicsContext, scale: CGFloat) {
        let box = outline.boundingRect
        guard box.width > 0, box.height > 0, scale.isFinite, scale > 0 else { return }

        // MODEL space, not screen space — the opposite rule to `drawGrid`
        // above, and deliberately so. The background dots are the paper the
        // drawing sits on and must not move; this grid is ON the floor. It is
        // a scale reference: counting cells is how you judge whether a jog is
        // a closet or a chimney, and a grid whose cell stops meaning a fixed
        // distance answers no question at all.
        //
        // Verified against the reference by measuring the same room at two
        // zooms: the cell COUNT stayed constant while the room changed size,
        // which is only true of a model-space grid. An earlier version of
        // this function used fixed point pitch on the reasoning that constant
        // density looks steadier. It does — and it means nothing.
        let minor = 0.25
        let majorEvery = 4

        // Below this the cells are closer than a hairline and the floor turns
        // grey. Fade rather than pop, and drop out entirely when unreadable.
        let cell = CGFloat(minor) * scale
        let alpha = min(max((cell - 3) / 3, 0), 1)
        guard alpha > 0.01 else { return }

        var clipped = context
        clipped.clip(to: outline)

        var minorLines = Path()
        var majorLines = Path()

        // Anchored to the box's own origin so the grid does not crawl across
        // the floor as a corner is dragged.
        var i = 0
        var x = box.minX
        while x <= box.maxX {
            var line = Path()
            line.move(to: CGPoint(x: x, y: box.minY))
            line.addLine(to: CGPoint(x: x, y: box.maxY))
            if i % majorEvery == 0 { majorLines.addPath(line) } else { minorLines.addPath(line) }
            x += cell
            i += 1
        }
        i = 0
        var y = box.minY
        while y <= box.maxY {
            var line = Path()
            line.move(to: CGPoint(x: box.minX, y: y))
            line.addLine(to: CGPoint(x: box.maxX, y: y))
            if i % majorEvery == 0 { majorLines.addPath(line) } else { minorLines.addPath(line) }
            y += cell
            i += 1
        }

        clipped.stroke(minorLines, with: .color(tile.opacity(0.28 * alpha)), lineWidth: 0.5)
        clipped.stroke(majorLines, with: .color(tile.opacity(0.55 * alpha)), lineWidth: 0.6)
    }

    // MARK: - Drafted wall dimensions

    /// The grey a dimension line and its witness lines are drawn in (§6).
    static let dimensionGrey = Brand.Plan.dimension

    /// A pair of opposed arrowheads at one point on a dimension line — the
    /// mark §6 asks for at every segment boundary, and the fine head at each
    /// end of an overall run. Drawn as two filled darts pointing along the
    /// line in both directions, so one mark serves the segment either side.
    static func arrowheads(
        at p: CGPoint, along u: (CGFloat, CGFloat), context: GraphicsContext, color: Color
    ) {
        let len: CGFloat = 4
        let half: CGFloat = 1.7
        let nx = -u.1
        let ny = u.0
        var heads = Path()
        for sign in [CGFloat(1), -1] {
            let tail = CGPoint(x: p.x + u.0 * len * sign, y: p.y + u.1 * len * sign)
            heads.move(to: p)
            heads.addLine(to: CGPoint(x: tail.x + nx * half, y: tail.y + ny * half))
            heads.addLine(to: CGPoint(x: tail.x - nx * half, y: tail.y - ny * half))
            heads.closeSubpath()
        }
        context.fill(heads, with: .color(color))
    }

    /// Every wall's dimensions: witness lines off the corners, a thin
    /// dimension line offset OUTSIDE the wall, fine arrowheads at the ends,
    /// the figure rotated along the run — and, on any wall that carries an
    /// opening, the SPLIT CHAIN on its own row between the wall and that
    /// overall line.
    ///
    /// **ORD-18.** The chain used to appear only on the selected wall, so
    /// deselecting made every door width vanish. A door's width is the first
    /// number an operator checks and it must not be behind a selection, so
    /// the chain is now a property of the wall — drawn wherever there is an
    /// opening, whatever is selected. Walls without an opening keep the
    /// single figure alone; there is nothing to split.
    ///
    /// The two rows are laid out the way the reference draws them: overall
    /// on the OUTER row, chain INBOARD of it, both outside the wall, witness
    /// lines running from the wall past both. That is why `off` is decided
    /// per wall — a wall with a chain needs its overall figure pushed out to
    /// clear the row beneath it, and `chainLayout` has to be asked first
    /// because it is what knows whether the row will be drawn at all.
    ///
    /// The padlock survives, moved to where §6 puts it: immediately AFTER a
    /// hand-set number, not before it.
    // The dimension rows, outboard of the wall, in points. Type-level because
    // the renderer and the hit test MUST agree on them: when they did not,
    // the target sat 10pt short of the digits and tapping a dimension
    // silently did nothing, through two build-and-install cycles.
    static let chainRow: CGFloat = 17
    static let overallRow: CGFloat = 38
    /// Pushed out from 18 to 28 on 18 Aug 2026, at the owner's report:
    /// *"when I click to the wall by accident, I'm able to click the
    /// measurement… I'm not opening the properties of the wall itself, but
    /// I'm actually messing up with the measurements."* At 18 the string's
    /// anchor sat 28pt off the wall while the wall's own tap band is 22pt
    /// wide — six points of clearance for a thumb. At 28 the anchor is 38pt
    /// out and the two targets no longer share a fingertip. The hit test
    /// reads this constant, so moving the number moved its target with it.
    static let plainRow: CGFloat = 28
    /// How far past its own dimension line the string is anchored. This is
    /// the 10pt that was missed.
    static let textLift: CGFloat = 10

    /// Where a wall's dimension string is centred.
    ///
    /// The single definition of that position. `drawWallDimensions` draws at
    /// it and `dimensionHit` tests against it, so the drawn number and its
    /// tap target cannot drift apart again — the earlier bug was two copies
    /// of this arithmetic, one of them missing a term.
    ///
    /// Unit-agnostic: pass screen points to place the text, plan metres (with
    /// the offsets divided by scale) to hit-test it.
    static func dimensionAnchor(
        a: CGPoint, b: CGPoint, winding: CGFloat, rowOffset: CGFloat, lift: CGFloat
    ) -> CGPoint? {
        let len = hypot(b.x - a.x, b.y - a.y)
        guard len > 0 else { return nil }
        let ux = (b.x - a.x) / len
        let uy = (b.y - a.y) / len
        let nx = winding * uy
        let ny = -winding * ux
        let out = rowOffset + lift
        return CGPoint(x: (a.x + b.x) / 2 + nx * out, y: (a.y + b.y) / 2 + ny * out)
    }

    /// Which wall's dimension string the operator tapped, if any.
    ///
    /// The number IS the control — that is how the reference works, and it is
    /// the natural gesture: you tap the figure you want to change, not the
    /// wall behind it. Without this the only way to a wall's measurement was
    /// to select the wall and tap it a second time, which nobody guesses, and
    /// the only way to UNLOCK a typed length was to run the whole Set Size
    /// walk again.
    ///
    /// Placement is recomputed the same way `drawWallDimensions` places it,
    /// so the target sits where the string was actually drawn. Both rows are
    /// tested — 18pt out when the wall carries no opening chain, 38pt when it
    /// does — because deciding which applies needs a GraphicsContext to
    /// measure text in, and a hit test has none. Accepting either is right
    /// anyway: the operator aimed at a number, and only one is ever there.
    /// `point`, `polygon` and the result are all in the plan's own metres —
    /// the space the editor's tap handler works in. The row offsets and the
    /// hit radius are in POINTS, so they are divided by `scale` to land in
    /// metres, which also means the target stays a constant size on screen at
    /// any zoom.
    static func dimensionHit(
        at point: CGPoint,
        polygon: [CGPoint],
        scale: CGFloat,
        /// Was 30, which was too generous once it turned out something DOES
        /// compete for the space: the wall itself, whose own band is 22pt.
        /// A 30pt radius in every direction meant the dimension claimed
        /// taps that landed on the wall. 20 keeps the number comfortably
        /// tappable — it is still twice the type's own height — without
        /// reaching back across the wall.
        radius: CGFloat = 20
    ) -> Int? {
        guard polygon.count >= 3, scale > 0 else { return nil }
        let winding = Self.winding(polygon)

        var best: Int?
        var bestDistance = radius / scale

        for i in polygon.indices {
            let (ai, bi) = PlanEditing.edgeCorners(i, count: polygon.count)

            // Both rows are tried: which one applies depends on whether the
            // wall carries an opening chain, and deciding that needs a
            // GraphicsContext to measure text in, which a hit test has none
            // of. Only one row is ever drawn, so testing both costs nothing.
            for row in [Self.plainRow, Self.overallRow] {
                guard
                    let label = Self.dimensionAnchor(
                        a: polygon[ai], b: polygon[bi], winding: winding,
                        rowOffset: row / scale, lift: Self.textLift / scale)
                else { continue }
                let d = hypot(point.x - label.x, point.y - label.y)
                if d < bestDistance {
                    bestDistance = d
                    best = i
                }
            }
        }
        return best
    }

    static func drawWallDimensions(
        context: GraphicsContext,
        polygon: [CGPoint],
        openings: [PlanEditing.WallOpening],
        toScreen: (CGPoint) -> CGPoint,
        proxySize: CGSize,
        selectedEdge: Int?,
        lockedEdges: Set<Int>,
        /// Passed in rather than read from the shared setting: this is a
        /// nonisolated drawing routine and the setting lives on the main
        /// actor. The caller is a view body, which already has it.
        format: LengthFormat
    ) {
        guard polygon.count >= 3 else { return }

        // Which side is OUT is a property of the polygon's winding, not of
        // its centroid — an L-shaped room has walls whose outside faces the
        // centroid, and a centroid test would draw their dimensions through
        // the room. For a positively wound loop the interior is to the left
        // of each directed edge, so outward is the right normal.
        let winding = Self.winding(polygon)

        // The rows, outboard of the wall. `chainRow` is where a split chain
        // sits; `overallRow` is where the whole-wall figure sits when there
        // is a chain under it, and `plainRow` when there is not.
        let chainRow = Self.chainRow
        let overallRow = Self.overallRow
        let plainRow = Self.plainRow
        let gap: CGFloat = 3
        let overrun: CGFloat = 4

        for i in polygon.indices {
            let metres = PlanEditing.edgeLength(polygon, i)
            // A sliver mid-drag gets no string; the live label carries it.
            guard metres > 0.15 else { continue }

            let (ai, bi) = PlanEditing.edgeCorners(i, count: polygon.count)
            let A = toScreen(polygon[ai])
            let B = toScreen(polygon[bi])
            let len = hypot(B.x - A.x, B.y - A.y)
            guard len > 1 else { continue }

            let ux = (B.x - A.x) / len
            let uy = (B.y - A.y) / len
            let nx = winding * uy
            let ny = -winding * ux

            // Asked BEFORE the rows are placed: whether this wall gets a
            // chain row is what decides how far out the overall line goes.
            let layout = OpeningGlyphs.chainLayout(
                edge: i, polygon: polygon, openings: openings,
                screenLength: len, context: context, proxySize: proxySize)
            let hasChain = !layout.isEmpty
            let off = hasChain ? overallRow : plainRow

            let selected = selectedEdge == i
            let lineColor = selected ? Brand.blue : dimensionGrey

            let da = CGPoint(x: A.x + nx * off, y: A.y + ny * off)
            let db = CGPoint(x: B.x + nx * off, y: B.y + ny * off)

            // Witness lines: a breath of gap at the wall, a hair of overrun
            // past the dimension line — the drafting convention that makes
            // the string read as measuring THIS wall. Dotted, per §6.
            var witness = Path()
            witness.move(to: CGPoint(x: A.x + nx * gap, y: A.y + ny * gap))
            witness.addLine(
                to: CGPoint(x: da.x + nx * overrun, y: da.y + ny * overrun))
            witness.move(to: CGPoint(x: B.x + nx * gap, y: B.y + ny * gap))
            witness.addLine(
                to: CGPoint(x: db.x + nx * overrun, y: db.y + ny * overrun))
            context.stroke(
                witness, with: .color(lineColor),
                style: StrokeStyle(lineWidth: 0.6, dash: [1.5, 2.5]))

            var line = Path()
            line.move(to: da)
            line.addLine(to: db)
            context.stroke(
                line, with: .color(lineColor), lineWidth: selected ? 1.1 : 0.7)

            // Fine arrowheads at each end, per §6 — the opposed pair reads
            // the same whatever angle the wall runs at, where an oblique
            // tick has to be rotated to stay legible.
            for p in [da, db] {
                arrowheads(at: p, along: (ux, uy), context: context, color: lineColor)
            }

            // The chain row, between the wall and the overall line. Every
            // wall that has an opening, whatever is selected — ORD-18.
            if hasChain {
                OpeningGlyphs.drawChain(
                    edge: i, polygon: polygon, layout: layout,
                    context: context, toScreen: toScreen, proxySize: proxySize,
                    offset: chainRow, winding: winding)
            }

            // The figure, along the run and the right way up: a wall read
            // from either end is the same wall, so text past vertical flips
            // rather than printing upside down.
            var angle = atan2(uy, ux)
            if angle > .pi / 2 { angle -= .pi } else if angle < -.pi / 2 { angle += .pi }

            // Blue number, and the padlock immediately AFTER a hand-set one
            // (§6) — an SF Symbol in the same string, so it sits on the
            // digits' own baseline at their own size whatever the zoom. The
            // lock keeps its own ink colour: §6 asks for a black filled
            // padlock, and a blue one would read as part of the number.
            var figure = Text(format.format(metres))
                .foregroundStyle(Brand.blue)
            if lockedEdges.contains(i) {
                figure = figure + Text(" ") + Text(Image(systemName: "lock.fill"))
                    .foregroundStyle(Brand.ink)
            }
            let text = context.resolve(
                figure.font(.system(size: 15, weight: selected ? .bold : .regular)))
            let size = text.measure(in: proxySize)
            // Shared with `dimensionHit`, so the number and its tap target
            // are the same point by construction.
            guard
                let at = Self.dimensionAnchor(
                    a: A, b: B, winding: winding, rowOffset: off, lift: Self.textLift)
            else { continue }

            context.drawLayer { layer in
                layer.translateBy(x: at.x, y: at.y)
                layer.rotate(by: Angle(radians: Double(angle)))
                // A soft knockout, not a badge: the grid dots clear from
                // under the digits the way ruled paper clears under ink,
                // without reintroducing the pill this replaced.
                layer.fill(
                    Path(
                        roundedRect: CGRect(
                            x: -size.width / 2 - 3, y: -size.height / 2 - 1,
                            width: size.width + 6, height: size.height + 2),
                        cornerRadius: 3),
                    with: .color(Brand.surface.opacity(0.8)))
                layer.draw(text, at: .zero, anchor: .center)
            }
        }
    }

    // MARK: - The overall extent (ORD-23)

    /// How far outboard of the room's bounding box the overall dimension
    /// lines run. Past `overallRow` + `textLift` + half a line of type, so
    /// the outer line clears the per-wall row beneath it whatever a wall
    /// carries.
    static let overallExtentRow: CGFloat = 56

    /// The room's overall bounding extent — width along the bottom, depth up
    /// the left — on their own outer lines, outboard of every per-wall one.
    ///
    /// **Two different quantities, not one** (object-model §5, and the owner
    /// caught it himself on a trapezoid): a wall's own length is what a tape
    /// reads along that wall — 2.610 on the slanted side — while the overall
    /// vertical extent of the same room is 2.500. Their app draws both. With
    /// only the first, a room that is not a rectangle cannot answer "how
    /// deep is it", which is the question an estimator asks first.
    ///
    /// Orthogonal by definition, and independent of any wall being slanted:
    /// this measures the bounding box, so it is the same figure however the
    /// walls run inside it. On a true rectangle it agrees with the two wall
    /// lengths it sits outside, and that is not redundancy worth suppressing
    /// — the reference draws it there too, and a figure that appears only on
    /// odd-shaped rooms is a figure nobody learns to look for.
    ///
    /// Drawn in the same hand as the per-wall lines — dotted witness lines,
    /// fine opposed arrowheads, the figure along the run — because it is the
    /// same kind of statement, one level further out.
    ///
    /// **It is dropped rather than drawn across the room** when there is no
    /// room left outboard on screen: zoomed in far enough that a wall is
    /// past the edge of the canvas, an "outer" line would have to be drawn
    /// INSIDE the plan, and a dimension line lying across the thing it
    /// measures reads as a wall. The camera is set up to leave the margin at
    /// the framing both editors open at — see `RoomEditorCore.fitScale` and
    /// `LevelCanvas.cameraBounds`.
    static func drawOverallDimensions(
        context: GraphicsContext,
        polygon: [CGPoint],
        toScreen: (CGPoint) -> CGPoint,
        proxySize: CGSize,
        format: LengthFormat
    ) {
        guard polygon.count >= 3 else { return }

        let xs = polygon.map(\.x)
        let ys = polygon.map(\.y)
        let minX = xs.min()!, maxX = xs.max()!
        let minY = ys.min()!, maxY = ys.max()!

        // The box's own corners, taken through the SAME projection the walls
        // use rather than assembled from screen extremes — one transform,
        // one answer, and no second copy of the arithmetic to drift.
        let topLeft = toScreen(CGPoint(x: minX, y: minY))
        let bottomRight = toScreen(CGPoint(x: maxX, y: maxY))
        let left = min(topLeft.x, bottomRight.x)
        let right = max(topLeft.x, bottomRight.x)
        let top = min(topLeft.y, bottomRight.y)
        let bottom = max(topLeft.y, bottomRight.y)

        // Nothing to measure: a room dragged down to a sliver gets no outer
        // line, the same way a sliver wall gets no figure.
        guard right - left > 1, bottom - top > 1 else { return }

        // Width along the bottom.
        if bottom + overallExtentRow + textLift + 12 < proxySize.height {
            run(
                context: context,
                from: CGPoint(x: left, y: bottom), to: CGPoint(x: right, y: bottom),
                normal: (0, 1), metres: maxX - minX, format: format, proxySize: proxySize)
        }

        // Depth up the left. The normal points AWAY from the room, so the
        // line, its witness lines and its figure all step out together.
        if left - (overallExtentRow + textLift + 12) > 0 {
            run(
                context: context,
                from: CGPoint(x: left, y: top), to: CGPoint(x: left, y: bottom),
                normal: (-1, 0), metres: maxY - minY, format: format, proxySize: proxySize)
        }
    }

    /// One overall dimension run: witness lines, the line itself, arrowheads,
    /// the figure. Shared by the two calls above so the horizontal and the
    /// vertical cannot be drawn to two different conventions.
    private static func run(
        context: GraphicsContext,
        from a: CGPoint, to b: CGPoint,
        normal: (CGFloat, CGFloat),
        metres: Double,
        format: LengthFormat,
        proxySize: CGSize
    ) {
        let length = hypot(b.x - a.x, b.y - a.y)
        guard length > 1 else { return }
        let ux = (b.x - a.x) / length
        let uy = (b.y - a.y) / length
        let (nx, ny) = normal
        let off = overallExtentRow
        let gap: CGFloat = 3
        let overrun: CGFloat = 4

        let da = CGPoint(x: a.x + nx * off, y: a.y + ny * off)
        let db = CGPoint(x: b.x + nx * off, y: b.y + ny * off)

        var witness = Path()
        witness.move(to: CGPoint(x: a.x + nx * gap, y: a.y + ny * gap))
        witness.addLine(to: CGPoint(x: da.x + nx * overrun, y: da.y + ny * overrun))
        witness.move(to: CGPoint(x: b.x + nx * gap, y: b.y + ny * gap))
        witness.addLine(to: CGPoint(x: db.x + nx * overrun, y: db.y + ny * overrun))
        context.stroke(
            witness, with: .color(dimensionGrey),
            style: StrokeStyle(lineWidth: 0.6, dash: [1.5, 2.5]))

        var line = Path()
        line.move(to: da)
        line.addLine(to: db)
        context.stroke(line, with: .color(dimensionGrey), lineWidth: 0.7)

        for p in [da, db] {
            arrowheads(at: p, along: (ux, uy), context: context, color: dimensionGrey)
        }

        var angle = atan2(uy, ux)
        if angle > .pi / 2 { angle -= .pi } else if angle < -.pi / 2 { angle += .pi }

        let text = context.resolve(
            Text(format.format(metres))
                .foregroundStyle(Brand.blue)
                .font(.system(size: 15, weight: .regular)))
        let size = text.measure(in: proxySize)
        let at = CGPoint(
            x: (a.x + b.x) / 2 + nx * (off + textLift),
            y: (a.y + b.y) / 2 + ny * (off + textLift))

        context.drawLayer { layer in
            layer.translateBy(x: at.x, y: at.y)
            layer.rotate(by: Angle(radians: Double(angle)))
            layer.fill(
                Path(
                    roundedRect: CGRect(
                        x: -size.width / 2 - 3, y: -size.height / 2 - 1,
                        width: size.width + 6, height: size.height + 2),
                    cornerRadius: 3),
                with: .color(Brand.surface.opacity(0.8)))
            layer.draw(text, at: .zero, anchor: .center)
        }
    }

    // MARK: - Objects on the floor (S8)

    /// One object's footprint on the plan, in INK.
    ///
    /// The catalogue's illustrations are coloured because a catalogue is
    /// browsed; this drawing is read beside a report, and `Brand.Plan` is
    /// what keeps it reading as drafting rather than as a diagram. The owner
    /// agreed the split, and it is the reference's own — its object library
    /// is coloured while its floor plan is not.
    ///
    /// An outline, its name, and nothing else. An object is context on a
    /// floor plan: what an adjuster needs from it is "there was a vanity
    /// here, this big", not a portrait.
    ///
    /// **An EXCLUDED object is drawn dashed and pale.** It is still in the
    /// room — the operator said so by leaving it on the plan — but it is not
    /// in the claim, and a drawing that showed the two identically would
    /// make the count impossible to check against the picture.
    static func drawObject(
        _ object: RoomObject,
        context: GraphicsContext,
        toScreen: (CGPoint) -> CGPoint,
        scale: CGFloat,
        selected: Bool,
        /// Whether to print the object's name under it. Off at storey scale,
        /// where the room's own name plate already owns that space and a
        /// hundred-point-wide room cannot carry both.
        labelled: Bool = true
    ) {
        let corners = ObjectCatalog.footprint(
            width: object.width, depth: object.depth, rotation: object.rotation
        ).map { CGPoint(x: $0.x + object.x, y: $0.y + object.y) }
        guard corners.count == 4 else { return }

        var path = Path()
        path.move(to: toScreen(corners[0]))
        for corner in corners.dropFirst() { path.addLine(to: toScreen(corner)) }
        path.closeSubpath()

        let ink = selected ? Brand.blue : Brand.Plan.ink
        let alpha = object.included ? 1.0 : 0.45

        // The envelope: the object's measured extent, which the owner asked
        // to keep — *"it's good to keep this rectangular shape… it is kind
        // of gonna show all around measure of the toilet."* Drawn first and
        // lightly, so it reads as the box around the thing rather than as
        // the thing.
        context.fill(path, with: .color(Brand.surface.opacity(object.included ? 0.9 : 0.5)))
        context.stroke(
            path, with: .color(ink.opacity(alpha * 0.55)),
            style: StrokeStyle(
                lineWidth: selected ? 2.0 : 1.0,
                dash: object.included ? [] : [5, 4]))

        // The figure itself, inside the envelope — his other half of the
        // same report: *"I don't see the silhouette of the toilet."* Drawn
        // in the SAME routine the catalogue tile uses, so the symbol he
        // chose is the symbol he gets, in ink instead of colour.
        //
        // Rotated in a layer rather than by rotating every path: the figure
        // is authored square, once, and the layer carries the object's own
        // heading.
        let centre = toScreen(CGPoint(x: object.x, y: object.y))
        let widthPts = object.width * scale
        let depthPts = object.depth * scale

        // **The catalogue's own illustration, on the plan.** The owner's
        // call, looking at a fridge drawn as an outline with two ticks on
        // it: *"I don't like the top down view… it should be the nice
        // isometric drawing."*
        //
        // This is a deliberate divergence from drafting convention and from
        // what this file argued for a build ago. A floor plan is
        // conventionally orthographic, and `Brand.Plan` exists to keep this
        // drawing reading as drafting — but he is the one who has to
        // recognise a room at a glance on a job, and an illustration he
        // recognises beats a symbol he has to decode. Note the cost, since
        // somebody will meet it: an isometric drawing has a fixed viewing
        // angle, so an object rotated 180° is drawn upside down rather than
        // seen from the other side.
        //
        // Only where there is room for it. Below about 24pt the picture is
        // a smudge and the drawn symbol reads better, which is also what
        // keeps the storey and the project card legible.
        if ObjectArtwork.exists(object.kind), widthPts >= 24, depthPts >= 24 {
            context.drawLayer { layer in
                layer.translateBy(x: centre.x, y: centre.y)
                // **The picture does NOT rotate with the object, and the
                // envelope does.** An isometric drawing has one fixed
                // viewing angle: turn it 180° and you do not see the fridge
                // from behind, you see an upside-down fridge. So the
                // rectangle carries the orientation — it is the measured
                // footprint and must be true — while the illustration stays
                // upright and legible, which is the only job it has.
                layer.opacity = alpha
                // Square art, rectangular footprint: fitted to the LONGER
                // side and centred, so a sofa's drawing spans its length
                // rather than being squashed into its depth.
                let side = max(widthPts, depthPts)
                layer.draw(
                    Image(ObjectArtwork.assetName(for: object.kind)),
                    in: CGRect(x: -side / 2, y: -side / 2, width: side, height: side))
            }
        } else if let shape = object.entry?.shape, widthPts > 10, depthPts > 10 {
            context.drawLayer { layer in
                layer.translateBy(x: centre.x, y: centre.y)
                layer.rotate(by: Angle(degrees: object.rotation))
                ObjectGlyphs.figure(
                    shape,
                    in: CGRect(
                        x: -widthPts / 2, y: -depthPts / 2,
                        width: widthPts, height: depthPts),
                    context: layer,
                    // Ink on paper, not the catalogue's colour: `Brand.Plan`
                    // is what keeps this drawing reading as drafting beside
                    // a report. The picker is where the colour lives.
                    tones: (
                        fill: Brand.surface.opacity(alpha),
                        edge: ink.opacity(alpha)
                    ))
            }
        }

        // The name, under the figure rather than across it — a label drawn
        // over the silhouette hides the thing it names. Only when there is
        // room for it: at floor zoom a cabinet is 20 points across.
        guard labelled, widthPts >= 44 else { return }

        let text = context.resolve(
            Text(object.displayName)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(ink))
        let size = text.measure(in: CGSize(width: widthPts, height: 40))
        guard size.width <= widthPts - 4 else { return }
        context.draw(
            text, at: CGPoint(x: centre.x, y: centre.y + depthPts / 2 + size.height * 0.7),
            anchor: .center)
    }

    // MARK: - Live dimensions during a drag (ORD-31)

    /// The lengths of the edges either side of the corner being dragged,
    /// drawn ON those edges while the finger is down.
    ///
    /// object-model §2b, on editing a shape: *"Live dimensions appear on the
    /// two edges adjoining the dragged point."* `AreaEditor` has had them
    /// since S3 and they are the whole reason that gesture is usable — a
    /// damaged patch is matched to a tape measure, not eyeballed, and the
    /// same is true of a wall. This is that layer, ported, so the plan
    /// editor and the area editor read the same.
    ///
    /// At the edge MIDPOINTS, which is what puts them clear of the finger:
    /// the two edges adjoining a dragged corner run away from it, so their
    /// middles are the furthest points on them from the hand.
    ///
    /// Red, like the area editor's — not the drafting grey of a settled
    /// dimension. These are live and provisional; they disappear on lift,
    /// and the drafted figure that replaces them is the one that counts.
    static func drawLiveEdgeDimensions(
        context: GraphicsContext,
        polygon: [CGPoint],
        edges: [Int],
        toScreen: (CGPoint) -> CGPoint,
        proxySize: CGSize,
        format: LengthFormat
    ) {
        guard polygon.count >= 3 else { return }
        for edge in edges where polygon.indices.contains(edge) {
            let (ai, bi) = PlanEditing.edgeCorners(edge, count: polygon.count)
            let A = toScreen(polygon[ai])
            let B = toScreen(polygon[bi])
            let at = CGPoint(x: (A.x + B.x) / 2, y: (A.y + B.y) / 2)

            let text = context.resolve(
                Text(format.format(PlanEditing.edgeLength(polygon, edge)))
                    .foregroundStyle(.white)
                    .font(.system(size: 12, weight: .bold).monospacedDigit()))
            let size = text.measure(in: proxySize)
            context.fill(
                Path(
                    roundedRect: CGRect(
                        x: at.x - size.width / 2 - 5, y: at.y - size.height / 2 - 2,
                        width: size.width + 10, height: size.height + 4),
                    cornerRadius: (size.height + 4) / 2),
                with: .color(.red.opacity(0.9)))
            context.draw(text, at: at, anchor: .center)
        }
    }

    // MARK: - The selected wall's manipulators (§7)

    /// The indigo diamond drag handle at the wall's midpoint, and the small
    /// pair of opposed triangles further along the same wall.
    ///
    /// Both are affordances, not new gestures: dragging a selected wall
    /// already works anywhere on it (`PlanEditing.dragEdge`), and these say
    /// so. The handle sits at the midpoint offset OUTBOARD, where a thumb
    /// pulling the wall outward does not cover the number it is changing;
    /// the `▶◀` marker sits three-quarters along, far enough from the handle
    /// that the two never merge on a short wall.
    static func drawWallHandles(
        context: GraphicsContext,
        polygon: [CGPoint],
        edge: Int,
        toScreen: (CGPoint) -> CGPoint,
        winding: CGFloat
    ) {
        guard polygon.count >= 3, edge >= 0, edge < polygon.count else { return }
        let (ai, bi) = PlanEditing.edgeCorners(edge, count: polygon.count)
        let A = toScreen(polygon[ai])
        let B = toScreen(polygon[bi])
        let len = hypot(B.x - A.x, B.y - A.y)
        guard len > 24 else { return }

        let ux = (B.x - A.x) / len
        let uy = (B.y - A.y) / len
        // Outboard, the same sense the dimensions use, so the handle and the
        // figure it moves are never on opposite sides of the wall.
        let nx = winding * uy
        let ny = -winding * ux

        // The diamond handle: white ring, indigo fill, a diamond split by a
        // line across the wall's own direction — the split says which way it
        // travels, which is the one thing a drag handle has to communicate.
        let centre = CGPoint(
            x: (A.x + B.x) / 2 + nx * 15, y: (A.y + B.y) / 2 + ny * 15)
        let r: CGFloat = 13
        let disc = Path(
            ellipseIn: CGRect(x: centre.x - r, y: centre.y - r, width: r * 2, height: r * 2))
        context.fill(disc, with: .color(.white))
        context.stroke(disc, with: .color(.white), lineWidth: 2)
        context.fill(
            Path(
                ellipseIn: CGRect(
                    x: centre.x - r + 2, y: centre.y - r + 2,
                    width: (r - 2) * 2, height: (r - 2) * 2)),
            with: .color(handleIndigo))

        let d: CGFloat = 5.5
        var diamond = Path()
        diamond.move(to: CGPoint(x: centre.x + ux * d, y: centre.y + uy * d))
        diamond.addLine(to: CGPoint(x: centre.x + nx * d, y: centre.y + ny * d))
        diamond.addLine(to: CGPoint(x: centre.x - ux * d, y: centre.y - uy * d))
        diamond.addLine(to: CGPoint(x: centre.x - nx * d, y: centre.y - ny * d))
        diamond.closeSubpath()
        context.stroke(diamond, with: .color(.white), lineWidth: 1.2)
        var split = Path()
        split.move(to: CGPoint(x: centre.x - nx * d, y: centre.y - ny * d))
        split.addLine(to: CGPoint(x: centre.x + nx * d, y: centre.y + ny * d))
        context.stroke(split, with: .color(.white), lineWidth: 1.2)

        // The secondary marker, three-quarters along: opposed triangles on
        // the wall line itself.
        let at = CGPoint(x: A.x + ux * len * 0.78, y: A.y + uy * len * 0.78)
        let gap: CGFloat = 1.6
        let size: CGFloat = 5
        var marks = Path()
        for sign in [CGFloat(1), -1] {
            let tip = CGPoint(x: at.x + ux * gap * sign, y: at.y + uy * gap * sign)
            let base = CGPoint(x: tip.x + ux * size * sign, y: tip.y + uy * size * sign)
            marks.move(to: tip)
            marks.addLine(to: CGPoint(x: base.x + nx * size * 0.6, y: base.y + ny * size * 0.6))
            marks.addLine(to: CGPoint(x: base.x - nx * size * 0.6, y: base.y - ny * size * 0.6))
            marks.closeSubpath()
        }
        context.fill(marks, with: .color(.white))
    }

    /// The drag handle's fill. Indigo rather than `Brand.blue` deliberately:
    /// the wall underneath is already brand blue, and a handle in the same
    /// colour disappears into it. §7 calls for indigo and this is why.
    static let handleIndigo = Color(hex: 0x4B3FA8)

    /// The thin `Brand.blue` rectangle §7 draws around a selected opening.
    static func drawOpeningSelection(
        context: GraphicsContext,
        polygon: [CGPoint],
        opening: PlanEditing.WallOpening,
        toScreen: (CGPoint) -> CGPoint,
        scale: CGFloat
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

        // ASYMMETRIC, and that is the whole point. This box was centred on
        // the wall — half its depth either side — which put most of it
        // OUTSIDE the room while the leaf and swing arc it was meant to
        // enclose go entirely INSIDE. The owner, 18 Aug 2026: *"I don't
        // wanna see just the door as a small rectangular. I want that
        // rectangular square to include also the opening thing... the thing
        // that shows what direction the door opens."*
        //
        // Which way is in: toward the outline's own middle, the same test
        // `OpeningGlyphs.draw` uses to decide which way to swing the leaf,
        // so the box and the arc can never disagree about which side they
        // are on.
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

        // How far the swing actually reaches, which is NOT the opening's
        // width for every kind — the owner caught the box being "too big"
        // on a double door, and he was right: a double's two leaves are
        // each HALF the width, so the arc reaches half as far as a single
        // of the same overall size. A slider's panels do not swing out at
        // all. Sizing the box off `w` alone made all three the widest case.
        let band = OpeningGlyphs.bandT * scale
        let swing: CGFloat
        switch opening.kind {
        case .doorSingle, .doorCased: swing = w
        case .doorDouble: swing = w / 2
        // Bypass panels stay in the wall; the box only has to clear the
        // track marks either side of the centreline.
        case .doorSliding: swing = band
        case .windowStandard, .windowWide, .windowSmall: swing = band
        }
        let inward = opening.kind.category == .door ? max(12, swing * 1.06) : band
        let outward = max(4, band * 0.6)

        var box = Path()
        box.move(to: CGPoint(x: A.x - nx * side * outward, y: A.y - ny * side * outward))
        box.addLine(to: CGPoint(x: B.x - nx * side * outward, y: B.y - ny * side * outward))
        box.addLine(to: CGPoint(x: B.x + nx * side * inward, y: B.y + ny * side * inward))
        box.addLine(to: CGPoint(x: A.x + nx * side * inward, y: A.y + ny * side * inward))
        box.closeSubpath()
        context.stroke(box, with: .color(Brand.blue), lineWidth: 1.2)
    }

    /// The polygon's winding, +1 when the interior lies to the left of each
    /// directed edge. Every "which side is out" question in this file goes
    /// through it, so the dimensions, the chain and the drag handle all agree
    /// on which side of a wall is outdoors — a centroid test does not, and an
    /// L-shaped room is where that shows.
    static func winding(_ polygon: [CGPoint]) -> CGFloat {
        var shoelace = 0.0
        for i in polygon.indices {
            let p = polygon[i]
            let q = polygon[(i + 1) % polygon.count]
            shoelace += p.x * q.y - q.x * p.y
        }
        return shoelace >= 0 ? 1 : -1
    }

    // MARK: - Naming the storey

    /// The nav subtitle's floor name: `Ground` becomes `Ground Floor`, and
    /// the two storeys that are already nouns are left alone — "Basement
    /// Floor" is not a thing anybody says.
    static func floorSubtitle(_ level: String) -> String {
        let label = FloorVocabulary.levels.first { $0.id == level }?.label ?? level
        switch label {
        case "Basement", "Attic": return label
        default: return "\(label) Floor"
        }
    }
}

// MARK: - Where the editor is, and what it is showing

/// Which projection the canvas is drawing (§3, §5).
///
/// A mode, not a screen: the nav bar, the floating pills and the action bar
/// are all functions of it, which is why it is one value rather than three
/// booleans in three views.
enum EditorViewMode: String, CaseIterable, Identifiable {
    case plan
    case threeD
    case elevation

    var id: String { rawValue }

    var title: String {
        switch self {
        case .plan: return "2D View"
        case .threeD: return "3D View"
        case .elevation: return "Elevation View"
        }
    }

    /// What the stepper pill and the menu's right-hand column show. Elevation
    /// has no two-letter name, so it carries the glyph §5 transcribes.
    var shortcut: String? {
        switch self {
        case .plan: return "2D"
        case .threeD: return "3D"
        case .elevation: return nil
        }
    }

    static let elevationGlyph = "plus.circle"
}

/// How deep into the plan the selection has gone (§4).
///
/// The bar is a function of `(depth, mode)` and nothing else, so the depth
/// has to be a value both editors can produce from their own private
/// `Selection` enums — they index different state and neither should have to
/// know the other's.
enum EditorDepth: Equatable {
    case floor(name: String)
    case room(name: String)
    /// `dragging` is the drag handle being held: §4 gives that its own row,
    /// because a bar full of verbs under a finger that is mid-drag offers
    /// things that cannot be tapped anyway.
    case wall(dragging: Bool)
    /// Ours, not in §4's table — magicplan has no corner depth. It follows
    /// the drag-engaged row's shape because it offers the same two things.
    case corner
    case opening(label: String)
    /// Something standing ON the floor — a cabinet, a toilet, a vanity (S8).
    /// A separate depth from `.opening` because they are separate models:
    /// an opening lives IN a wall and deducts wall area, an object stands on
    /// the floor and deducts nothing.
    case object(label: String)

    /// What the swipe-up caption calls this — `<name>` in
    /// "Swipe up ↑ for <name> info".
    var infoName: String {
        switch self {
        case .floor(let name): return name
        case .room(let name): return name
        case .wall: return "Wall"
        case .corner: return "Corner"
        case .opening(let label): return label
        case .object(let label): return label
        }
    }
}

/// One verb the bar can offer. An enum rather than ten closures, because the
/// bar's contents are a table lookup and a table of cases stays readable
/// where a table of callbacks does not.
enum EditorAction: Hashable {
    case insert
    case rotate
    case setSize
    case editLayout
    case duplicate
    case addCorner
    case addWall
    case splitRoom
    case replaceWith
    case delete

    var label: String {
        switch self {
        case .insert: return "Insert"
        case .rotate: return "Rotate"
        case .setSize: return "Set Size"
        case .editLayout: return "Edit Layout"
        case .duplicate: return "Duplicate"
        case .addCorner: return "Add Corner"
        case .addWall: return "Add Wall"
        case .splitRoom: return "Split Room"
        case .replaceWith: return "Replace with..."
        // The ellipsis is not decoration: §4 gives destructive labels one
        // because they confirm before they act.
        case .delete: return "Delete..."
        }
    }

    /// SF Symbols throughout — the reference's icon set is its own trade
    /// dress and is deliberately not copied; the shapes below are Apple's.
    var icon: String {
        switch self {
        case .insert: return "plus"
        case .rotate: return "arrow.clockwise"
        case .setSize: return "ruler"
        case .editLayout: return "square.and.pencil"
        case .duplicate: return "square.on.square"
        case .addCorner: return "plus.circle"
        case .addWall: return "plus.rectangle"
        case .splitRoom: return "scissors"
        case .replaceWith: return "arrow.triangle.2.circlepath"
        case .delete: return "trash"
        }
    }

    var isDestructive: Bool { self == .delete }

    /// §4's table, exactly. View mode wins over depth: 3D has no bar at all,
    /// and elevation reduces to a single verb whatever is selected under it.
    static func bar(depth: EditorDepth, mode: EditorViewMode) -> [EditorAction] {
        switch mode {
        case .threeD:
            return []
        case .elevation:
            return [.insert]
        case .plan:
            break
        }
        switch depth {
        case .floor:
            return [.insert, .rotate]
        case .room:
            return [.insert, .setSize, .editLayout, .duplicate, .delete]
        case .wall(let dragging):
            return dragging
                ? [.insert, .delete]
                : [.insert, .addCorner, .addWall, .splitRoom, .delete]
        case .corner:
            return [.insert, .delete]
        case .object:
            // The reference's own bar for a placed object, read off
            // `interactions-editor.md` §"object inserted": `Insert ·
            // Replace with… · Rotate · Duplicate · Delete…`. Identical to
            // the opening bar below, and that is not a coincidence — in
            // their model a door and a cabinet are both objects, and only
            // ours needs to tell them apart because only ours deducts wall
            // area for one of them.
            return [.insert, .replaceWith, .rotate, .duplicate, .delete]
        case .opening:
            // Corrected 18 Aug 2026 against the owner's own screenshot of a
            // selected door — five verbs, `Rotate` among them, where this
            // table had four. Whatever this table was built from the first
            // time missed it; his own screen is the freshest, most direct
            // evidence available and wins over what shipped before it.
            return [.insert, .replaceWith, .rotate, .duplicate, .delete]
        }
    }
}

// MARK: - Bottom action bar (§4)

/// The bar across the bottom, rewriting itself per `(depth, view mode)`.
///
/// The operator never hunts a menu, because the bar under their thumb always
/// says what the selected thing can do. What it SHOWS is §4's table verbatim;
/// what it ENABLES is `supported`, which each editor recomputes every render
/// from its own capabilities.
///
/// **Disabled rather than hidden, deliberately.** Several of §4's verbs were
/// seen in the reference's bar but never performed — no after-frames exist
/// for Add Wall or Split Room, and ORDERS lists them as deliberately not
/// ordered. Implementing a guess at what they do would be improvising a
/// substitute for evidence; dropping them would quietly redesign a bar the
/// owner asked for exactly. So they are drawn in their place, greyed: the
/// layout is the one he sent, and the refusal is visible rather than
/// mysterious — the rule the corner control already followed when a
/// triangle's last three corners cannot be deleted.
///
/// The bar owns no state and mutates nothing. Every tap calls back into the
/// editor that owns the geometry, so undo, opening renumbering and lock
/// bookkeeping stay exactly where they were.
struct EditorActionBar: View {
    let depth: EditorDepth
    var mode: EditorViewMode = .plan
    /// The verbs this editor can actually perform right now. Everything else
    /// in the row renders greyed.
    let supported: Set<EditorAction>
    /// The verbs that are not merely unavailable but **do not apply to this
    /// thing at all**, and are removed from the row rather than greyed.
    ///
    /// The distinction is the reference's own, seen on `Set Size`: on a room
    /// that is not a rectangle the verb is GONE, and it comes back the
    /// moment the shape is a rectangle again. Grey says "not now"; absent
    /// says "not a question you can ask of this shape". Everything the
    /// header above argues for greying — Add Wall, Split Room, the verbs
    /// observed but never performed — is unchanged by this: those stay in
    /// place, greyed, because they DO apply and we simply cannot do them.
    var hidden: Set<EditorAction> = []
    let onAction: (EditorAction) -> Void
    /// The swipe-up gesture into the inspector. nil where there is no
    /// inspector to reach — and then the caption is not drawn either, because
    /// a caption promising a gesture that does nothing is worse than none.
    var onInfo: (() -> Void)?

    private var actions: [EditorAction] {
        EditorAction.bar(depth: depth, mode: mode).filter { !hidden.contains($0) }
    }

    var body: some View {
        // 3D is read-only, and §4 gives it no bar at all.
        if actions.isEmpty {
            EmptyView()
        } else {
            VStack(spacing: Brand.Space.small) {
                // The grabber: this panel is the handle for the swipe-up.
                Capsule()
                    .fill(Brand.inkFaint.opacity(0.5))
                    .frame(width: 36, height: 5)

                HStack(spacing: Brand.Space.tight) {
                    ForEach(actions, id: \.self) { action in
                        tile(action)
                    }
                }

                if onInfo != nil {
                    Text("Swipe up ↑ for \(depth.infoName) info")
                        .font(.system(size: 13))
                        .foregroundStyle(Brand.inkSoft)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
            .padding(.top, Brand.Space.tight)
            .padding(.horizontal, Brand.Space.small)
            .padding(.bottom, Brand.Space.small)
            .frame(maxWidth: .infinity)
            // One sheet with rounded top corners, the way it sits in the
            // screenshots — the grabber above it reads as the sheet's own
            // handle rather than a mark floating on the background.
            .background(
                UnevenRoundedRectangle(
                    topLeadingRadius: Brand.Radius.sheet,
                    topTrailingRadius: Brand.Radius.sheet
                )
                .fill(Brand.surface)
                .ignoresSafeArea(edges: .bottom))
            .contentShape(.rect)
            .gesture(
                DragGesture(minimumDistance: 20)
                    .onEnded { value in
                        if value.translation.height < -20 { onInfo?() }
                    })
        }
    }

    /// One tile: equal width, light grey fill, icon above label (§4).
    private func tile(_ action: EditorAction) -> some View {
        let enabled = supported.contains(action)
        return Button {
            onAction(action)
        } label: {
            VStack(spacing: 4) {
                Image(systemName: action.icon)
                    .font(.system(size: 22, weight: .regular))
                Text(action.label)
                    .font(.system(size: 13))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .foregroundStyle(action.isDestructive ? Color.red : Brand.blue)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Brand.Space.small)
            .background(Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.tile))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.35)
    }
}

// MARK: - Navigation bar (§1)

/// The leading pill: one rounded rect holding a back chevron and a context
/// glyph that says what you would go back TO.
struct EditorBackPill: View {
    /// §1's table: a floor-switcher at floor level, a single-room glyph
    /// inside a room, and the literal text `2D` in 3D or elevation — where it
    /// is an escape hatch rather than a chevron target.
    enum Context: Equatable {
        case floor
        case room
        case escapeTo2D
    }

    let context: Context
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 3) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold))
                switch context {
                case .floor:
                    Image(systemName: "rectangle.split.2x1")
                        .font(.system(size: 15, weight: .regular))
                case .room:
                    Image(systemName: "square.dashed")
                        .font(.system(size: 15, weight: .regular))
                case .escapeTo2D:
                    Text("2D").font(.system(size: 14, weight: .bold))
                }
            }
            .foregroundStyle(Brand.blue)
            .padding(.horizontal, Brand.Space.small)
            .padding(.vertical, 5)
            .background(Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.tile))
        }
        .buttonStyle(.plain)
    }
}

/// The centre slot: title bold, an optional grey subtitle under it carrying
/// the parent or the mode (§1's second table).
struct EditorNavTitle: View {
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(spacing: 1) {
            Text(title)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Brand.ink)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.inkSoft)
            }
        }
        .lineLimit(1)
    }
}

// MARK: - Floating controls (§3)

/// Top-left: one pill, two halves split by a hairline. Unavailable actions
/// grey out IN PLACE — the pill never disappears, so the thumb learns one
/// position rather than hunting a control that comes and goes.
struct EditorUndoRedoPill: View {
    let canUndo: Bool
    let canRedo: Bool
    let onUndo: () -> Void
    let onRedo: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            half("arrow.uturn.backward", enabled: canUndo, action: onUndo)
            Rectangle()
                .fill(Brand.hairline)
                .frame(width: 0.5, height: 22)
            half("arrow.uturn.forward", enabled: canRedo, action: onRedo)
        }
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.tile))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.tile)
                .strokeBorder(Brand.hairline, lineWidth: 0.5))
    }

    private func half(_ icon: String, enabled: Bool, action: @escaping () -> Void)
        -> some View
    {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(enabled ? Brand.blue : Brand.inkFaint.opacity(0.5))
                .frame(width: 40, height: 34)
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

/// Top-right: a white pill with a chevron-up-down stepper glyph on its right.
/// Two of them sit there — the layers one and the view-mode one — so the
/// shell is shared and only the leading content differs.
struct EditorStepperPill<Content: View>: View {
    let action: () -> Void
    @ViewBuilder var content: Content

    var body: some View {
        Button(action: action) {
            HStack(spacing: Brand.Space.tight) {
                content
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.inkSoft)
            }
            .foregroundStyle(Brand.blue)
            .padding(.horizontal, Brand.Space.small)
            .frame(height: 34)
            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.tile))
            .overlay(
                RoundedRectangle(cornerRadius: Brand.Radius.tile)
                    .strokeBorder(Brand.hairline, lineWidth: 0.5))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - View-mode menu (§5)

/// The floating card under the view stepper: three rows, the current one
/// carrying a leading checkmark, each with its shortcut glyph right-aligned.
///
/// The Elevation row is the interesting one. It has ONE subtitle slot
/// carrying TWO kinds of message: disabled, the subtitle is the blocking
/// reason; enabled, that same line becomes the shortcut hint. Worth keeping
/// exactly — it is how a user learns the double-tap at all, since the
/// sentence that told them why they could not use it is replaced in place by
/// the one telling them the fast way in.
struct EditorViewModeMenu: View {
    let current: EditorViewMode
    /// nil when Elevation can be entered; otherwise the reason it cannot.
    let elevationBlocked: String?
    /// Same, for 3D.
    let threeDBlocked: String?
    let onPick: (EditorViewMode) -> Void

    var body: some View {
        VStack(spacing: 0) {
            row(.plan, blocked: nil, subtitle: nil)
            divider(thick: false)
            row(.threeD, blocked: threeDBlocked, subtitle: threeDBlocked)
            // §5: the third row is separated by a thicker divider.
            divider(thick: true)
            row(
                .elevation, blocked: elevationBlocked,
                subtitle: elevationBlocked ?? "You can also double-tap on a wall")
        }
        .frame(width: 274)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.card)
                .strokeBorder(Brand.hairline, lineWidth: 0.5))
        .shadow(color: .black.opacity(0.16), radius: 14, y: 6)
    }

    private func divider(thick: Bool) -> some View {
        Rectangle()
            .fill(Brand.hairline)
            .frame(height: thick ? 4 : 0.5)
    }

    private func row(_ mode: EditorViewMode, blocked: String?, subtitle: String?)
        -> some View
    {
        let enabled = blocked == nil
        return Button {
            onPick(mode)
        } label: {
            HStack(spacing: Brand.Space.small) {
                Image(systemName: "checkmark")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Brand.blue)
                    .opacity(current == mode ? 1 : 0)
                VStack(alignment: .leading, spacing: 1) {
                    Text(mode.title)
                        .font(.system(size: 15))
                        .foregroundStyle(Brand.ink)
                    if let subtitle {
                        Text(subtitle)
                            .font(.system(size: 12))
                            .foregroundStyle(Brand.inkSoft)
                            .fixedSize(horizontal: false, vertical: true)
                            .multilineTextAlignment(.leading)
                    }
                }
                Spacer(minLength: Brand.Space.small)
                if let shortcut = mode.shortcut {
                    Text(shortcut)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Brand.inkSoft)
                } else {
                    Image(systemName: EditorViewMode.elevationGlyph)
                        .font(.system(size: 14))
                        .foregroundStyle(Brand.inkSoft)
                }
            }
            .padding(.horizontal, Brand.Space.base)
            .padding(.vertical, Brand.Space.small)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        // The WHOLE row greys, per §5 — reason and title together, so the
        // sentence reads as belonging to the thing it is refusing.
        .opacity(enabled ? 1 : 0.4)
    }
}

