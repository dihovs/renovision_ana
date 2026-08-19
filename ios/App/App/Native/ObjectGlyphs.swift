import SwiftUI

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

/// One catalogue illustration, drawn to fill whatever it is given.
///
/// A plan view rather than a perspective, and deliberately: the operator is
/// about to place this thing on a floor plan, and a tile that shows what will
/// appear on the plan teaches the symbol at the moment it is being chosen.
struct ObjectTileArt: View {
    let entry: ObjectCatalog.Entry

    var body: some View {
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
        let line = max(1.2, min(box.width, box.height) * 0.045)

        func stroke(_ path: Path, fill: Color? = nil) {
            context.fill(path, with: .color(fill ?? tones.fill))
            context.stroke(path, with: .color(tones.edge), lineWidth: line)
        }

        switch shape {
        case .box, .appliance, .column:
            stroke(Path(roundedRect: box, cornerRadius: box.width * 0.06))
            if shape == .appliance {
                // A door line, which is what tells a fridge from a crate.
                var door = Path()
                door.move(to: CGPoint(x: box.midX, y: box.minY))
                door.addLine(to: CGPoint(x: box.midX, y: box.maxY))
                context.stroke(door, with: .color(tones.edge), lineWidth: line * 0.8)
            }

        case .counter:
            stroke(Path(roundedRect: box, cornerRadius: box.width * 0.04))
            // The counter's front lip, drawn as the near edge — the mark
            // that says which way it faces.
            var lip = Path()
            lip.move(to: CGPoint(x: box.minX, y: box.maxY - box.height * 0.18))
            lip.addLine(to: CGPoint(x: box.maxX, y: box.maxY - box.height * 0.18))
            context.stroke(lip, with: .color(tones.edge), lineWidth: line * 0.8)

        case .toilet:
            // Tank at the back, bowl in front — the plan symbol every
            // drawing uses.
            let tank = CGRect(
                x: box.minX + box.width * 0.1, y: box.minY,
                width: box.width * 0.8, height: box.height * 0.28)
            stroke(Path(roundedRect: tank, cornerRadius: line))
            let bowl = CGRect(
                x: box.minX, y: box.minY + box.height * 0.26,
                width: box.width, height: box.height * 0.74)
            stroke(Path(ellipseIn: bowl))

        case .tub:
            stroke(Path(roundedRect: box, cornerRadius: min(box.width, box.height) * 0.14))
            let inner = box.insetBy(dx: box.width * 0.09, dy: box.height * 0.14)
            stroke(
                Path(roundedRect: inner, cornerRadius: min(inner.width, inner.height) * 0.2),
                fill: ObjectGlyphs.Palette.water)
            // The drain end, so the tub has an orientation.
            let drain = CGSize(width: min(box.width, box.height) * 0.09, height: 0)
            context.stroke(
                Path(
                    ellipseIn: CGRect(
                        x: inner.maxX - drain.width * 1.6, y: inner.midY - drain.width / 2,
                        width: drain.width, height: drain.width)),
                with: .color(tones.edge), lineWidth: line * 0.8)

        case .shower:
            stroke(Path(roundedRect: box, cornerRadius: line))
            // The diagonal that says "shower" on every plan ever drawn.
            var slash = Path()
            slash.move(to: CGPoint(x: box.minX, y: box.maxY))
            slash.addLine(to: CGPoint(x: box.maxX, y: box.minY))
            context.stroke(slash, with: .color(tones.edge), lineWidth: line * 0.8)
            let drain = min(box.width, box.height) * 0.12
            context.stroke(
                Path(
                    ellipseIn: CGRect(
                        x: box.midX - drain / 2, y: box.midY - drain / 2,
                        width: drain, height: drain)),
                with: .color(tones.edge), lineWidth: line * 0.8)

        case .sink:
            stroke(Path(roundedRect: box, cornerRadius: box.width * 0.05))
            let basin = box.insetBy(dx: box.width * 0.12, dy: box.height * 0.16)
            stroke(
                Path(roundedRect: basin, cornerRadius: min(basin.width, basin.height) * 0.16),
                fill: ObjectGlyphs.Palette.water)

        case .basinInCounter:
            // A vanity is a counter with a basin in it — drawn as exactly
            // that, because that is what has to come out.
            stroke(Path(roundedRect: box, cornerRadius: box.width * 0.04))
            let basin = CGRect(
                x: box.midX - box.width * 0.17, y: box.midY - box.height * 0.22,
                width: box.width * 0.34, height: box.height * 0.44)
            stroke(Path(ellipseIn: basin), fill: ObjectGlyphs.Palette.water)

        case .cylinder:
            stroke(Path(ellipseIn: box))
            let inner = box.insetBy(dx: box.width * 0.22, dy: box.height * 0.22)
            context.stroke(Path(ellipseIn: inner), with: .color(tones.edge), lineWidth: line * 0.7)

        case .stairs:
            stroke(Path(box))
            // Treads across the run, and an arrow saying which way is up —
            // the drafting convention, and the thing that makes a stair
            // readable rather than a striped rectangle.
            let treads = 7
            var lines = Path()
            for i in 1..<treads {
                let y = box.minY + box.height * CGFloat(i) / CGFloat(treads)
                lines.move(to: CGPoint(x: box.minX, y: y))
                lines.addLine(to: CGPoint(x: box.maxX, y: y))
            }
            context.stroke(lines, with: .color(tones.edge), lineWidth: line * 0.7)
            var arrow = Path()
            arrow.move(to: CGPoint(x: box.midX, y: box.maxY - box.height * 0.06))
            arrow.addLine(to: CGPoint(x: box.midX, y: box.minY + box.height * 0.1))
            arrow.move(to: CGPoint(x: box.midX - box.width * 0.12, y: box.minY + box.height * 0.22))
            arrow.addLine(to: CGPoint(x: box.midX, y: box.minY + box.height * 0.1))
            arrow.addLine(to: CGPoint(x: box.midX + box.width * 0.12, y: box.minY + box.height * 0.22))
            context.stroke(arrow, with: .color(ObjectGlyphs.Palette.ink), lineWidth: line * 0.8)

        case .panel:
            stroke(Path(roundedRect: box, cornerRadius: line))
            var bars = Path()
            for i in 1...3 {
                let y = box.minY + box.height * CGFloat(i) / 4
                bars.move(to: CGPoint(x: box.minX + box.width * 0.15, y: y))
                bars.addLine(to: CGPoint(x: box.maxX - box.width * 0.15, y: y))
            }
            context.stroke(bars, with: .color(tones.edge), lineWidth: line * 0.7)
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

        case .appliance:
            stroke(Path(roundedRect: box, cornerRadius: line * 2))
            // The round door of a washer or dryer, which is the one
            // appliance detail that reads at any size.
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

        case .box, .column:
            stroke(Path(roundedRect: box, cornerRadius: line))
        }
    }
}
