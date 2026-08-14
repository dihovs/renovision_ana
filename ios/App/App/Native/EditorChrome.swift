import SwiftUI

/// The drafting-table chrome both room editors share.
///
/// `PlanEditorView` and `RoomSketchView` are one drawing surface reached from
/// two directions — a scanned room being corrected and a blank room being
/// drawn. Every visual word they do not share is a word the operator has to
/// learn twice, so the words live here: the dotted grid the plan sits on, the
/// hatch that means "this room is in hand", the drafted dimension strings,
/// and the bottom bar that says what the selected thing can do. Same
/// reasoning that put the opening glyphs in `OpeningGlyphs` and the keypad in
/// `MeasurementPanel` — two hand-copies is how two canvases drift apart.
///
/// All colour comes from `Brand`. The reference's canvas vocabulary is the
/// pattern being reused — grid, hatch, extension lines, contextual bar — but
/// its system-blue trade dress is not; ours is the brand blue throughout.
enum EditorChrome {

    // MARK: - Dotted grid

    /// The paper. A dot every half metre of MODEL space, a brand-blue
    /// crosshair every two, drawn behind everything else so the room reads
    /// as sitting on a sheet rather than floating in a void.
    ///
    /// Model space, not screen space, deliberately: the grid must pan and
    /// zoom with the plan, because it is the sheet the room is drawn on —
    /// a screen-fixed texture would slide under the walls and read as
    /// wallpaper behind glass. That is why the editor's own metres→points
    /// mapping comes in as closures instead of this function inventing one.
    ///
    /// 0.5 m pitch because that is the scale of the things being drawn —
    /// door widths, wall jogs, closet depths are all judged in half-metre
    /// steps — and the 2 m majors give the eye a coarse count without a
    /// single ruled line competing with the walls.
    ///
    /// The fade: below ~8 pt of screen pitch the dots stop being countable
    /// marks and merge into grey smear, which is worse than no grid. So the
    /// grid fades over a few points of pitch and is simply absent below the
    /// threshold — which doubles as the volume guard, since the dot count
    /// only explodes at exactly the zooms where the grid has faded out.
    static func drawGrid(
        context: GraphicsContext,
        size: CGSize,
        toScreen: (CGPoint) -> CGPoint,
        toModel: (CGPoint) -> CGPoint,
        scale: CGFloat
    ) {
        let pitch = 0.5
        let pitchPts = pitch * scale
        guard pitchPts.isFinite, pitchPts > 0 else { return }

        // A ramp, not a pop: zooming through the threshold should feel like
        // the paper receding, not a layer being switched off.
        let alpha = min(max((pitchPts - 8) / 4, 0), 1)
        guard alpha > 0.01 else { return }

        // The visible window, in the plan's own metres, snapped down to the
        // grid so the first line is on-pitch rather than at the screen edge.
        let a = toModel(.zero)
        let b = toModel(CGPoint(x: size.width, y: size.height))
        let minX = (min(a.x, b.x) / pitch).rounded(.down) * pitch
        let minY = (min(a.y, b.y) / pitch).rounded(.down) * pitch
        let cols = Int((max(a.x, b.x) - minX) / pitch) + 1
        let rows = Int((max(a.y, b.y) - minY) / pitch) + 1
        // The fade already bounds this; the cap is a belt for the braces.
        guard cols > 0, rows > 0, cols * rows <= 40_000 else { return }

        var dots = Path()
        var crosses = Path()
        let r: CGFloat = 1.1
        let arm: CGFloat = 3.5
        // Crosshairs on the 2 m majors — every fourth half-metre line. The
        // index test is on the MODEL multiple, not the loop counter, so the
        // majors stay pinned to the same model lines while panning.
        let major = 4

        for ci in 0..<cols {
            let x = minX + Double(ci) * pitch
            let xi = Int((x / pitch).rounded())
            for ri in 0..<rows {
                let y = minY + Double(ri) * pitch
                let yi = Int((y / pitch).rounded())
                let p = toScreen(CGPoint(x: x, y: y))
                if xi % major == 0, yi % major == 0 {
                    crosses.move(to: CGPoint(x: p.x - arm, y: p.y))
                    crosses.addLine(to: CGPoint(x: p.x + arm, y: p.y))
                    crosses.move(to: CGPoint(x: p.x, y: p.y - arm))
                    crosses.addLine(to: CGPoint(x: p.x, y: p.y + arm))
                } else {
                    dots.addEllipse(
                        in: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2))
                }
            }
        }
        context.fill(dots, with: .color(Brand.inkFaint.opacity(0.35 * alpha)))
        context.stroke(
            crosses, with: .color(Brand.blue.opacity(0.45 * alpha)), lineWidth: 1)
    }

    // MARK: - Selection hatch

    /// The engaged room's fill: fine diagonals, clipped to the outline.
    ///
    /// Drawn as Canvas strokes at FIXED POINT spacing, deliberately. An image
    /// tile would pixelate under zoom; a pattern fill anchored to model space
    /// would change density as the zoom changes, making "selected" look
    /// different at every magnification. Lines redrawn per frame at constant
    /// point pitch cost almost nothing and always look like the same state.
    ///
    /// The base fill underneath stays — the hatch is a layer of meaning on
    /// top of the floor, not a replacement for it.
    static func hatch(_ outline: Path, context: GraphicsContext) {
        let box = outline.boundingRect
        guard box.width > 0, box.height > 0 else { return }

        // A value copy of the context clips privately: the clip dies with
        // the copy, so nothing drawn after the hatch is affected.
        var clipped = context
        clipped.clip(to: outline)

        // 45° lines; the step along x is the perpendicular pitch × √2.
        let step: CGFloat = 6 * 1.41421356
        var lines = Path()
        var x = box.minX - box.height
        while x < box.maxX {
            lines.move(to: CGPoint(x: x, y: box.minY))
            lines.addLine(to: CGPoint(x: x + box.height, y: box.maxY))
            x += step
        }
        clipped.stroke(
            lines, with: .color(Brand.blue.opacity(0.28)), lineWidth: 0.5)
    }

    // MARK: - Drafted wall dimensions

    /// The grey a dimension line and its witness lines are drawn in (§6).
    static let dimensionGrey = Color(light: 0x8A8F97, dark: 0x7B818A)

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
    static func drawWallDimensions(
        context: GraphicsContext,
        polygon: [CGPoint],
        openings: [PlanEditing.WallOpening],
        toScreen: (CGPoint) -> CGPoint,
        proxySize: CGSize,
        selectedEdge: Int?,
        lockedEdges: Set<Int>
    ) {
        guard polygon.count >= 3 else { return }

        // Which side is OUT is a property of the polygon's winding, not of
        // its centroid — an L-shaped room has walls whose outside faces the
        // centroid, and a centroid test would draw their dimensions through
        // the room. The shoelace sign gives the winding; for a positively
        // wound loop the interior is to the left of each directed edge, so
        // outward is the right normal, and the negative case mirrors.
        var shoelace = 0.0
        for i in polygon.indices {
            let p = polygon[i]
            let q = polygon[(i + 1) % polygon.count]
            shoelace += p.x * q.y - q.x * p.y
        }
        let winding: CGFloat = shoelace >= 0 ? 1 : -1

        // The rows, outboard of the wall. `chainRow` is where a split chain
        // sits; `overallRow` is where the whole-wall figure sits when there
        // is a chain under it, and `plainRow` when there is not.
        let chainRow: CGFloat = 17
        let overallRow: CGFloat = 38
        let plainRow: CGFloat = 18
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
            var figure = Text(FloorPlanGeometry.feetInches(metres))
                .foregroundStyle(Brand.blue)
            if lockedEdges.contains(i) {
                figure = figure + Text(" ") + Text(Image(systemName: "lock.fill"))
                    .foregroundStyle(Brand.ink)
            }
            let text = context.resolve(
                figure.font(.system(size: 15, weight: selected ? .bold : .regular)))
            let size = text.measure(in: proxySize)
            let at = CGPoint(
                x: (da.x + db.x) / 2 + nx * 10,
                y: (da.y + db.y) / 2 + ny * 10)

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
}

// MARK: - Contextual action bar

/// What the bar has to know about the selection — a shared shape, because
/// each editor keeps its own private `Selection` enum (they index different
/// state) and the bar must not care which editor it is under.
enum EditorBarSelection {
    case none(hint: String)
    /// `canAddOpening` is capability, not mood: the plan editor refuses to
    /// author openings into a room whose scan already detected some, and the
    /// bar only ever offers what the editor underneath actually supports.
    case wall(canAddOpening: Bool)
    /// A triangle is the floor of a closed room; the last three corners are
    /// not deletable and the bar shows the control disabled rather than
    /// hiding it, so the refusal is visible.
    case corner(deletable: Bool)
    case opening(label: String, isWindow: Bool)
}

/// The bottom bar both editors share, rewriting itself per selection depth —
/// the reference's contextual-action-bar pattern (§6.2): the operator never
/// hunts a menu, because the bar under their thumb always says what the
/// selected thing can do. Nothing selected shows the hint; a wall offers its
/// three verbs; a corner and an opening each offer deletion, tinted red and
/// pinned trailing (§6.6), where a destructive control is expected to live.
///
/// The bar owns no state and mutates nothing — every tap calls back into the
/// editor that owns the geometry, so undo, opening renumbering and lock
/// bookkeeping stay exactly where they were.
struct EditorActionBar: View {
    let selection: EditorBarSelection
    var onTypeLength: () -> Void = {}
    var onAddCorner: () -> Void = {}
    var onAddOpening: () -> Void = {}
    var onDeleteCorner: () -> Void = {}
    var onDeleteOpening: () -> Void = {}

    var body: some View {
        HStack(spacing: Brand.Space.tight) {
            switch selection {
            case .none(let hint):
                Text(hint)
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkSoft)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)

            case .wall(let canAddOpening):
                item("Type length", icon: "keyboard", action: onTypeLength)
                    .frame(maxWidth: .infinity)
                item("Add corner", icon: "plus.circle", action: onAddCorner)
                    .frame(maxWidth: .infinity)
                if canAddOpening {
                    item("Add opening", icon: "door.left.hand.open", action: onAddOpening)
                        .frame(maxWidth: .infinity)
                }

            case .corner(let deletable):
                Spacer()
                item(
                    "Delete corner", icon: "minus.circle", destructive: true,
                    action: onDeleteCorner)
                .disabled(!deletable)
                .opacity(deletable ? 1 : 0.35)

            case .opening(let label, let isWindow):
                // The kind is stated, not just implied by the glyph on the
                // canvas — the bar is where the selection says its name.
                HStack(spacing: Brand.Space.tight) {
                    Image(systemName: isWindow ? "rectangle.split.3x1" : "door.left.hand.open")
                        .font(.system(size: 15, weight: .semibold))
                    Text(label)
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundStyle(Brand.ink)
                .padding(.leading, Brand.Space.tight)
                Spacer()
                item("Delete", icon: "trash", destructive: true, action: onDeleteOpening)
            }
        }
        // A constant height whatever the selection, so tapping around the
        // room never makes the canvas above jump.
        .frame(minHeight: 58)
        .padding(.horizontal, Brand.Space.small)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.card)
                .strokeBorder(Brand.hairline, lineWidth: 0.5))
    }

    /// One bar item: icon over label, the reference's bottom-bar idiom, in
    /// our colours — brand blue for verbs, red only for the destructive one.
    private func item(
        _ label: String, icon: String, destructive: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(destructive ? Color.red : Brand.blue)
            .padding(.horizontal, Brand.Space.tight)
            .padding(.vertical, Brand.Space.tight)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }
}

extension PlanEditing.OpeningKind {
    /// Grouping for the bar's glyph only — the geometry's own `category`
    /// distinguishes passages from doors, but on the bar a cased opening
    /// reads best under the door glyph it was authored beside.
    var isWindowForBar: Bool { category == .window }
}
