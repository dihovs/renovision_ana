import SwiftUI
import UIKit

/// Drawing an object twice: coloured in the catalogue, ink on the plan.
///
/// **That split is the owner's own call, 18 Aug 2026.** He asked for coloured
/// illustrations in the picker — *"preferably colored illustrations"* — and
/// agreed the plan stays ink on paper. It is what the reference does too: its
/// object library is coloured while its floor plan is not, and the reason is
/// not taste. A catalogue is browsed, so colour is what makes fifty tiles
/// scannable; a floor plan is a drawing an adjuster reads alongside a report,
/// and a coloured toilet on it reads as a diagram rather than a drafting
/// sheet. `Brand.Plan` exists to keep the second true.
///
/// **Drawn, not traced.** The one narrow exception in the standing
/// instruction covers exactly this: the reference's own artwork is replaced
/// with our equivalents in the identical position and role. These are
/// primitive shapes assembled per `ObjectCatalog.Shape` — a dozen figures
/// covering a catalogue of any size, because what makes a toilet readable is
/// its outline, not a portrait of it.
enum ObjectGlyphs {

    // MARK: - The catalogue's colours

    /// A quiet palette, one tone per family, so a section reads as a section
    /// at a glance. Fixed in both appearances like `Brand.Plan`: these are
    /// illustrations, and an illustration that inverts stops looking like
    /// the thing it draws.
    enum Palette {
        static let porcelain = Color(hex: 0xF4F6F8)
        static let porcelainEdge = Color(hex: 0xC3CBD4)
        static let water = Color(hex: 0xBFDCF0)
        static let wood = Color(hex: 0xD8B187)
        static let woodEdge = Color(hex: 0xA9805A)
        static let steel = Color(hex: 0xD5D9DE)
        static let steelEdge = Color(hex: 0x9AA2AB)
        static let fabric = Color(hex: 0xC9C4DE)
        static let fabricEdge = Color(hex: 0x9089B4)
        static let concrete = Color(hex: 0xCFCFCB)
        static let concreteEdge = Color(hex: 0x97978F)
        static let ink = Color(hex: 0x3A3F45)
    }

    /// Which pair of tones a shape is drawn in.
    static func tones(for entry: ObjectCatalog.Entry) -> (fill: Color, edge: Color) {
        switch entry.category {
        case .plumbing: return (Palette.porcelain, Palette.porcelainEdge)
        case .cabinets: return (Palette.wood, Palette.woodEdge)
        case .appliances, .electrical, .hvac, .restoration:
            return (Palette.steel, Palette.steelEdge)
        case .furniture: return (Palette.fabric, Palette.fabricEdge)
        case .structural: return (Palette.concrete, Palette.concreteEdge)
        }
    }
}

// MARK: - The coloured tile

/// The generated artwork for a catalogue entry, if we have any.
///
/// **ORD-43.** Hand-coded vector art has a ceiling and builds 133–134 hit
/// it: what the reference ships is an illustration set, not plan symbols.
/// So the catalogue TILES take real artwork — an image named for the
/// entry's slug, dropped into the asset catalogue.
///
/// **Tiles only, and that is the design.** The plan symbol and the front
/// elevation stay code-drawn, because they have to rotate with the object,
/// scale from a 130pt thumbnail to a full sheet, and stay ink-on-paper so
/// the drawing reads as drafting beside a report. An image does none of
/// those. A tile is a fixed size at a fixed angle, which is exactly what
/// artwork is good at.
///
/// **Missing is a normal state, not a failure.** The set arrives a few at a
/// time; anything without artwork yet falls back to the drawing it has
/// today, so the catalogue is never broken and never half-empty.
struct ObjectArtwork: View {
    let slug: String

    /// The asset name for a slug. One rule, so adding a picture means
    /// dropping in a file called `object-toilet` and nothing else.
    static func assetName(for slug: String) -> String { "object-\(slug)" }

    static func exists(_ slug: String) -> Bool {
        UIImage(named: assetName(for: slug)) != nil
    }

    var body: some View {
        Image(Self.assetName(for: slug))
            .resizable()
            .interpolation(.high)
            .aspectRatio(contentMode: .fit)
    }
}

/// One catalogue illustration, drawn to fill whatever it is given.
///
/// A plan view rather than a perspective, and deliberately: the operator is
/// about to place this thing on a floor plan, and a tile that shows what will
/// appear on the plan teaches the symbol at the moment it is being chosen.
struct ObjectTileArt: View {
    let entry: ObjectCatalog.Entry

    var body: some View {
        // Real artwork when it exists — see `ObjectArtwork`.
        if ObjectArtwork.exists(entry.slug) {
            ObjectArtwork(slug: entry.slug)
        } else {
            drawn
        }
    }

    private var drawn: some View {
        Canvas { context, size in
            let tones = ObjectGlyphs.tones(for: entry)
            // The object's own proportions inside the tile, so a 7ft sofa
            // reads as long and a column reads as small. Padded, so nothing
            // touches the tile's edge.
            let box = Self.aspectBox(
                width: entry.width, depth: entry.depth,
                in: CGRect(origin: .zero, size: size).insetBy(dx: size.width * 0.14, dy: size.height * 0.14))
            draw(entry.shape, in: box, context: context, tones: tones)
        }
    }

    /// The object's footprint, fitted to the tile with its aspect kept.
    static func aspectBox(width: Double, depth: Double, in bounds: CGRect) -> CGRect {
        guard width > 0, depth > 0, bounds.width > 0, bounds.height > 0 else { return bounds }
        let scale = min(bounds.width / width, bounds.height / depth)
        let w = width * scale
        let h = depth * scale
        return CGRect(
            x: bounds.midX - w / 2, y: bounds.midY - h / 2, width: w, height: h)
    }

    private func draw(
        _ shape: ObjectCatalog.Shape, in box: CGRect, context: GraphicsContext,
        tones: (fill: Color, edge: Color)
    ) {
        ObjectGlyphs.figure(shape, in: box, context: context, tones: tones)
    }
}

extension ObjectGlyphs {

    /// One object's plan figure, drawn into whatever box it is given.
    ///
    /// **Shared by the coloured catalogue tile and the ink plan symbol**, and
    /// that sharing is the point rather than a convenience. The owner, on
    /// build 125: *"when I'm choosing the toilet, I don't see the silhouette
    /// of the toilet. I just see a rectangular shape… we need to see the
    /// toilet to understand what is it."* Right — and the fix that lasts is
    /// one figure drawn in two palettes, because a toilet that looked one
    /// way in the picker and another on the plan would be two drawings to
    /// keep in step, and they would drift.
    ///
    /// He also said to KEEP the rectangle: *"it's good to keep this
    /// rectangular shape… this rectangular shape is kind of gonna show all
    /// around measure of the toilet."* So the box stays as the object's
    /// measured extent and the figure sits inside it — which is exactly how
    /// a fixture is drawn on a real plan, outline plus envelope.
    static func figure(
        _ shape: ObjectCatalog.Shape, in box: CGRect, context: GraphicsContext,
        tones: (fill: Color, edge: Color)
    ) {
        let line = max(1, min(box.width, box.height) * 0.04)

        func stroke(_ path: Path, fill: Color? = nil, weight: CGFloat = 1) {
            context.fill(path, with: .color(fill ?? tones.fill))
            context.stroke(path, with: .color(tones.edge), lineWidth: line * weight)
        }

        /// A hairline detail — the marks that turn an outline into a thing.
        func detail(_ path: Path, weight: CGFloat = 0.7) {
            context.stroke(path, with: .color(tones.edge), lineWidth: line * weight)
        }

        func rounded(_ rect: CGRect, _ radius: CGFloat) -> Path {
            Path(roundedRect: rect, cornerRadius: radius)
        }

        switch shape {
        case .box, .column:
            stroke(rounded(box, box.width * 0.05))
            if shape == .column {
                // Cross-hatched, the drafting convention for something
                // solid you cannot build through.
                var hatch = Path()
                hatch.move(to: CGPoint(x: box.minX, y: box.minY))
                hatch.addLine(to: CGPoint(x: box.maxX, y: box.maxY))
                hatch.move(to: CGPoint(x: box.maxX, y: box.minY))
                hatch.addLine(to: CGPoint(x: box.minX, y: box.maxY))
                detail(hatch)
            }

        case .counter:
            // A run of base units: carcass, a door split per unit, and the
            // counter nosing along the front.
            stroke(rounded(box, box.width * 0.02))
            let units = max(1, Int((box.width / max(box.height, 1)).rounded()))
            if units > 1 {
                var splits = Path()
                for i in 1..<units {
                    let x = box.minX + box.width * CGFloat(i) / CGFloat(units)
                    splits.move(to: CGPoint(x: x, y: box.minY))
                    splits.addLine(to: CGPoint(x: x, y: box.maxY))
                }
                detail(splits)
            }
            var nosing = Path()
            nosing.move(to: CGPoint(x: box.minX, y: box.maxY - box.height * 0.16))
            nosing.addLine(to: CGPoint(x: box.maxX, y: box.maxY - box.height * 0.16))
            detail(nosing, weight: 0.9)

        case .wallCabinet:
            // Dashed, because it is ABOVE the floor — the convention for
            // anything hung, and what tells a wall unit from a base one at
            // a glance on the plan.
            context.fill(rounded(box, box.width * 0.03), with: .color(tones.fill))
            context.stroke(
                rounded(box, box.width * 0.03), with: .color(tones.edge),
                style: StrokeStyle(lineWidth: line, dash: [line * 3, line * 2]))
            var split = Path()
            split.move(to: CGPoint(x: box.midX, y: box.minY))
            split.addLine(to: CGPoint(x: box.midX, y: box.maxY))
            detail(split)

        case .toilet:
            // Tank at the back, seat ring in front, lid line between.
            let tank = CGRect(
                x: box.minX + box.width * 0.08, y: box.minY,
                width: box.width * 0.84, height: box.height * 0.3)
            stroke(rounded(tank, line * 1.5))
            let bowl = CGRect(
                x: box.minX + box.width * 0.04, y: box.minY + box.height * 0.28,
                width: box.width * 0.92, height: box.height * 0.72)
            stroke(Path(ellipseIn: bowl))
            detail(Path(ellipseIn: bowl.insetBy(dx: bowl.width * 0.16, dy: bowl.height * 0.16)))

        case .basinInCounter:
            stroke(rounded(box, box.width * 0.03))
            let basin = CGRect(
                x: box.midX - box.width * 0.19, y: box.midY - box.height * 0.2,
                width: box.width * 0.38, height: box.height * 0.46)
            stroke(Path(ellipseIn: basin), fill: Palette.water, weight: 0.8)
            // The tap, against the back edge — which also says which way
            // the vanity faces.
            var tap = Path()
            tap.move(to: CGPoint(x: box.midX, y: box.minY + box.height * 0.08))
            tap.addLine(to: CGPoint(x: box.midX, y: basin.minY))
            detail(tap, weight: 1.2)

        case .tub:
            stroke(rounded(box, min(box.width, box.height) * 0.12))
            let inner = box.insetBy(dx: box.width * 0.08, dy: box.height * 0.1)
            stroke(
                rounded(inner, min(inner.width, inner.height) * 0.18),
                fill: Palette.water, weight: 0.8)
            // Drain and tap at one end — a tub has a head and a foot.
            let d = min(inner.width, inner.height) * 0.16
            detail(
                Path(
                    ellipseIn: CGRect(
                        x: inner.maxX - d * 1.8, y: inner.midY - d / 2, width: d, height: d)))
            var tap = Path()
            tap.move(to: CGPoint(x: inner.maxX - d * 0.4, y: inner.midY - d))
            tap.addLine(to: CGPoint(x: box.maxX, y: inner.midY - d))
            detail(tap, weight: 1.2)

        case .shower:
            stroke(rounded(box, line))
            // The two diagonals of a shower base, and the drain where they
            // meet — the plan symbol every drawing uses.
            var cross = Path()
            cross.move(to: CGPoint(x: box.minX, y: box.minY))
            cross.addLine(to: CGPoint(x: box.maxX, y: box.maxY))
            cross.move(to: CGPoint(x: box.maxX, y: box.minY))
            cross.addLine(to: CGPoint(x: box.minX, y: box.maxY))
            detail(cross)
            let drain = min(box.width, box.height) * 0.14
            stroke(
                Path(
                    ellipseIn: CGRect(
                        x: box.midX - drain / 2, y: box.midY - drain / 2,
                        width: drain, height: drain)),
                weight: 0.8)

        case .sink:
            stroke(rounded(box, box.width * 0.04))
            // Two bowls, which is what a kitchen sink is here — the divider
            // is the detail that stops it reading as a plain tray.
            let inset = box.insetBy(dx: box.width * 0.08, dy: box.height * 0.16)
            let bowlWidth = inset.width * 0.46
            for x in [inset.minX, inset.maxX - bowlWidth] {
                stroke(
                    rounded(
                        CGRect(x: x, y: inset.minY, width: bowlWidth, height: inset.height),
                        line * 1.5),
                    fill: Palette.water, weight: 0.8)
            }
            var tap = Path()
            tap.move(to: CGPoint(x: box.midX, y: box.minY + box.height * 0.06))
            tap.addLine(to: CGPoint(x: box.midX, y: box.midY))
            detail(tap, weight: 1.2)

        case .cylinder:
            stroke(Path(ellipseIn: box))
            detail(Path(ellipseIn: box.insetBy(dx: box.width * 0.24, dy: box.height * 0.24)))

        case .stove:
            stroke(rounded(box, box.width * 0.04))
            // Four burners, which is the one detail that makes a range read
            // as a range from above.
            let r = min(box.width, box.height) * 0.19
            for dx in [-1.0, 1.0] {
                for dy in [-1.0, 1.0] {
                    let c = CGPoint(
                        x: box.midX + CGFloat(dx) * box.width * 0.22,
                        y: box.midY + CGFloat(dy) * box.height * 0.2)
                    detail(
                        Path(
                            ellipseIn: CGRect(
                                x: c.x - r / 2, y: c.y - r / 2, width: r, height: r)),
                        weight: 0.9)
                }
            }

        case .fridge:
            stroke(rounded(box, box.width * 0.05))
            // The door split down the middle and the handles either side of
            // it — a French door fridge, seen from above.
            var split = Path()
            split.move(to: CGPoint(x: box.midX, y: box.minY))
            split.addLine(to: CGPoint(x: box.midX, y: box.maxY))
            detail(split)
            var handles = Path()
            for dx in [-1.0, 1.0] {
                let x = box.midX + CGFloat(dx) * box.width * 0.1
                handles.move(to: CGPoint(x: x, y: box.maxY - box.height * 0.28))
                handles.addLine(to: CGPoint(x: x, y: box.maxY - box.height * 0.08))
            }
            detail(handles, weight: 1.3)

        case .machine:
            stroke(rounded(box, box.width * 0.05))
            let door = min(box.width, box.height) * 0.52
            stroke(
                Path(
                    ellipseIn: CGRect(
                        x: box.midX - door / 2, y: box.midY - door / 2,
                        width: door, height: door)),
                fill: Palette.porcelain, weight: 0.8)
            detail(
                Path(
                    ellipseIn: CGRect(
                        x: box.midX - door / 4, y: box.midY - door / 4,
                        width: door / 2, height: door / 2)))

        case .sofa:
            // Back along one edge, an arm at each end, and the seat between
            // them — the shape a sofa makes on a plan.
            stroke(rounded(box, box.width * 0.04))
            let arm = box.width * 0.12
            let backDepth = box.height * 0.26
            var frame = Path()
            frame.addRect(
                CGRect(x: box.minX, y: box.minY, width: box.width, height: backDepth))
            frame.addRect(
                CGRect(
                    x: box.minX, y: box.minY, width: arm, height: box.height))
            frame.addRect(
                CGRect(
                    x: box.maxX - arm, y: box.minY, width: arm, height: box.height))
            context.fill(frame, with: .color(tones.edge.opacity(0.18)))
            detail(frame)
            // Cushion divisions across the seat.
            let seats = max(2, Int((box.width / max(box.height, 1)).rounded()) + 1)
            var splits = Path()
            for i in 1..<seats {
                let x = box.minX + arm + (box.width - arm * 2) * CGFloat(i) / CGFloat(seats)
                splits.move(to: CGPoint(x: x, y: box.minY + backDepth))
                splits.addLine(to: CGPoint(x: x, y: box.maxY))
            }
            detail(splits)

        case .bed:
            stroke(rounded(box, box.width * 0.04))
            // Pillows at the head, and the turned-back corner of the sheet
            // — the two marks that make a rectangle a bed.
            let pillowBand = box.height * 0.22
            for dx in [-1.0, 1.0] {
                let w = box.width * 0.38
                let x = box.midX + CGFloat(dx) * box.width * 0.23 - w / 2
                stroke(
                    rounded(
                        CGRect(
                            x: x, y: box.minY + pillowBand * 0.22,
                            width: w, height: pillowBand * 0.66),
                        line * 2),
                    weight: 0.8)
            }
            var turn = Path()
            turn.move(to: CGPoint(x: box.maxX - box.width * 0.3, y: box.maxY))
            turn.addLine(to: CGPoint(x: box.maxX, y: box.maxY - box.height * 0.22))
            detail(turn)

        case .table:
            stroke(rounded(box, box.width * 0.04))
            detail(rounded(box.insetBy(dx: box.width * 0.1, dy: box.height * 0.12), line * 2))

        case .shelving:
            stroke(rounded(box, box.width * 0.03))
            // Shelf lines across the depth — a bookcase from above is a run
            // of them.
            let shelves = max(2, Int((box.width / max(box.height, 1)).rounded()) + 1)
            var lines = Path()
            for i in 1..<shelves {
                let x = box.minX + box.width * CGFloat(i) / CGFloat(shelves)
                lines.move(to: CGPoint(x: x, y: box.minY))
                lines.addLine(to: CGPoint(x: x, y: box.maxY))
            }
            detail(lines)

        case .equipment:
            // Our own gear: a body with a vent grille at one end, so the
            // drawing says which way it is blowing.
            stroke(rounded(box, box.width * 0.08))
            let grille = CGRect(
                x: box.maxX - box.width * 0.3, y: box.minY + box.height * 0.14,
                width: box.width * 0.2, height: box.height * 0.72)
            var bars = Path()
            let count = 4
            for i in 0...count {
                let y = grille.minY + grille.height * CGFloat(i) / CGFloat(count)
                bars.move(to: CGPoint(x: grille.minX, y: y))
                bars.addLine(to: CGPoint(x: grille.maxX, y: y))
            }
            detail(bars, weight: 0.9)

        case .stairs:
            stroke(Path(box))
            let treads = 7
            var lines = Path()
            for i in 1..<treads {
                let y = box.minY + box.height * CGFloat(i) / CGFloat(treads)
                lines.move(to: CGPoint(x: box.minX, y: y))
                lines.addLine(to: CGPoint(x: box.maxX, y: y))
            }
            detail(lines)
            var arrow = Path()
            arrow.move(to: CGPoint(x: box.midX, y: box.maxY - box.height * 0.06))
            arrow.addLine(to: CGPoint(x: box.midX, y: box.minY + box.height * 0.1))
            arrow.move(to: CGPoint(x: box.midX - box.width * 0.12, y: box.minY + box.height * 0.22))
            arrow.addLine(to: CGPoint(x: box.midX, y: box.minY + box.height * 0.1))
            arrow.addLine(to: CGPoint(x: box.midX + box.width * 0.12, y: box.minY + box.height * 0.22))
            context.stroke(arrow, with: .color(Palette.ink), lineWidth: line * 0.8)

        case .panel:
            stroke(rounded(box, line))
            var bars = Path()
            for i in 1...3 {
                let y = box.minY + box.height * CGFloat(i) / 4
                bars.move(to: CGPoint(x: box.minX + box.width * 0.15, y: y))
                bars.addLine(to: CGPoint(x: box.maxX - box.width * 0.15, y: y))
            }
            detail(bars)
        }
    }
}

extension ObjectGlyphs {

    /// One object's FRONT elevation, drawn into the box it occupies on a
    /// wall face.
    ///
    /// **A second figure, not the plan one reused**, and the owner found the
    /// reason on build 128: *"on the elevation view, I don't see the toilet
    /// itself. I just see a square."* A plan symbol IS a square from the
    /// front — a toilet seen from above is a tank and a bowl, seen from the
    /// front it is a tank over a pedestal. They are different drawings of
    /// the same object because they are different views, and no amount of
    /// rotating the plan figure produces the elevation.
    ///
    /// Same rule as everywhere else in this file: primitive shapes, drawn
    /// not traced, one figure per family rather than one per catalogue
    /// entry.
    ///
    /// The box is the object's true extent on the face — width along the
    /// wall, its own height from the floor — so a figure that fills it is
    /// to scale, and the outline stays the measured envelope.
    static func elevationFigure(
        _ shape: ObjectCatalog.Shape, in box: CGRect, context: GraphicsContext,
        tones: (fill: Color, edge: Color)
    ) {
        let line = max(1, min(box.width, box.height) * 0.04)

        func stroke(_ path: Path, fill: Color? = nil, weight: CGFloat = 1) {
            context.fill(path, with: .color(fill ?? tones.fill))
            context.stroke(path, with: .color(tones.edge), lineWidth: line * weight)
        }

        switch shape {
        case .toilet:
            // Tank standing at the back, bowl and pedestal in front of it.
            let tank = CGRect(
                x: box.minX + box.width * 0.06, y: box.minY,
                width: box.width * 0.88, height: box.height * 0.42)
            stroke(Path(roundedRect: tank, cornerRadius: line * 2))
            let bowl = CGRect(
                x: box.minX, y: box.minY + box.height * 0.40,
                width: box.width, height: box.height * 0.28)
            stroke(Path(roundedRect: bowl, cornerRadius: line * 2))
            // The pedestal, narrower than the bowl — the shape that makes
            // a toilet a toilet from the front.
            let foot = CGRect(
                x: box.minX + box.width * 0.22, y: box.minY + box.height * 0.66,
                width: box.width * 0.56, height: box.height * 0.34)
            stroke(Path(foot))

        case .basinInCounter:
            // A vanity: counter slab, a basin dished into it, doors under.
            let top = CGRect(
                x: box.minX, y: box.minY, width: box.width, height: box.height * 0.12)
            stroke(Path(top))
            let carcass = CGRect(
                x: box.minX + box.width * 0.03, y: box.minY + box.height * 0.12,
                width: box.width * 0.94, height: box.height * 0.88)
            stroke(Path(carcass))
            var split = Path()
            split.move(to: CGPoint(x: carcass.midX, y: carcass.minY))
            split.addLine(to: CGPoint(x: carcass.midX, y: carcass.maxY))
            context.stroke(split, with: .color(tones.edge), lineWidth: line * 0.7)

        case .counter:
            let top = CGRect(
                x: box.minX, y: box.minY, width: box.width, height: box.height * 0.1)
            stroke(Path(top))
            let carcass = CGRect(
                x: box.minX + box.width * 0.02, y: box.minY + box.height * 0.1,
                width: box.width * 0.96, height: box.height * 0.9)
            stroke(Path(carcass))
            // Door splits every 600mm-ish of run, so a long counter reads
            // as a run of units rather than one slab.
            let doors = max(1, Int((box.width / max(box.height, 1)) * 1.6))
            if doors > 1 {
                var splits = Path()
                for i in 1..<doors {
                    let x = carcass.minX + carcass.width * CGFloat(i) / CGFloat(doors)
                    splits.move(to: CGPoint(x: x, y: carcass.minY))
                    splits.addLine(to: CGPoint(x: x, y: carcass.maxY))
                }
                context.stroke(splits, with: .color(tones.edge), lineWidth: line * 0.7)
            }

        case .tub:
            // Seen from the side: the rim, and the apron below it.
            stroke(Path(roundedRect: box, cornerRadius: min(box.width, box.height) * 0.08))
            var rim = Path()
            rim.move(to: CGPoint(x: box.minX, y: box.minY + box.height * 0.22))
            rim.addLine(to: CGPoint(x: box.maxX, y: box.minY + box.height * 0.22))
            context.stroke(rim, with: .color(tones.edge), lineWidth: line * 0.8)

        case .shower:
            stroke(Path(box))
            // The head, on its riser — what says shower rather than closet.
            var riser = Path()
            riser.move(to: CGPoint(x: box.midX, y: box.minY + box.height * 0.08))
            riser.addLine(to: CGPoint(x: box.midX, y: box.minY + box.height * 0.28))
            context.stroke(riser, with: .color(tones.edge), lineWidth: line)
            let head = min(box.width, box.height) * 0.12
            stroke(
                Path(
                    ellipseIn: CGRect(
                        x: box.midX - head / 2, y: box.minY + box.height * 0.04,
                        width: head, height: head)),
                weight: 0.8)

        case .sink:
            stroke(Path(box))
            let basin = box.insetBy(dx: box.width * 0.14, dy: box.height * 0.2)
            stroke(
                Path(roundedRect: basin, cornerRadius: min(basin.width, basin.height) * 0.2),
                fill: Palette.water, weight: 0.8)

        case .machine, .fridge, .stove:
            stroke(Path(roundedRect: box, cornerRadius: line * 2))
            // The round door of a washer or dryer — the one appliance
            // detail that reads at any size. A fridge and a range get the
            // same face here on purpose: from the front they are a box with
            // a door, and inventing distinguishing marks nobody observed
            // would be improvising.
            let door = min(box.width, box.height) * 0.5
            stroke(
                Path(
                    ellipseIn: CGRect(
                        x: box.midX - door / 2, y: box.midY - door / 2,
                        width: door, height: door)),
                fill: Palette.porcelain, weight: 0.8)

        case .cylinder:
            // A tank standing on the floor: straight sides, domed top.
            var body = Path()
            let shoulder = box.minY + box.height * 0.12
            body.move(to: CGPoint(x: box.minX, y: box.maxY))
            body.addLine(to: CGPoint(x: box.minX, y: shoulder))
            body.addQuadCurve(
                to: CGPoint(x: box.maxX, y: shoulder),
                control: CGPoint(x: box.midX, y: box.minY - box.height * 0.06))
            body.addLine(to: CGPoint(x: box.maxX, y: box.maxY))
            body.closeSubpath()
            stroke(body)

        case .stairs:
            // The profile: a flight climbing away from the wall.
            var steps = Path()
            let count = 6
            steps.move(to: CGPoint(x: box.minX, y: box.maxY))
            for i in 0..<count {
                let x = box.minX + box.width * CGFloat(i) / CGFloat(count)
                let nextX = box.minX + box.width * CGFloat(i + 1) / CGFloat(count)
                let y = box.maxY - box.height * CGFloat(i + 1) / CGFloat(count)
                steps.addLine(to: CGPoint(x: x, y: y))
                steps.addLine(to: CGPoint(x: nextX, y: y))
            }
            steps.addLine(to: CGPoint(x: box.maxX, y: box.maxY))
            steps.closeSubpath()
            stroke(steps)

        case .panel:
            stroke(Path(roundedRect: box, cornerRadius: line))
            var bars = Path()
            for i in 1...3 {
                let y = box.minY + box.height * CGFloat(i) / 4
                bars.move(to: CGPoint(x: box.minX + box.width * 0.12, y: y))
                bars.addLine(to: CGPoint(x: box.maxX - box.width * 0.12, y: y))
            }
            context.stroke(bars, with: .color(tones.edge), lineWidth: line * 0.7)

        case .box, .column, .wallCabinet, .sofa, .bed, .table, .shelving, .equipment:
            stroke(Path(roundedRect: box, cornerRadius: line))
        }
    }
}
