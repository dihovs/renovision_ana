import SwiftUI

/// The little isometric drawing beside each section in the object library.
///
/// **A third kind of drawing, and each has its own job.** By build 133 this
/// app had two — the coloured top-down tile that shows what will land on the
/// plan, and the ink front elevation. The owner's screenshot of the
/// reference's section list settles the third: the row icons there are
/// **monochrome isometric line drawings** — a stair flight, a basin with its
/// tap, a washing machine, an armchair, a plug, a fan unit, a toolbox.
///
/// That is not a plan symbol and it should not be one. A row icon is a
/// CATEGORY EMBLEM: its job is to be recognised in a list at 38 points, and
/// a little three-quarter drawing of the thing does that far better than the
/// outline it makes on a floor. The top-down rule the owner chose still
/// holds where it belongs — on the tiles that place an object, where the
/// picture teaches the symbol.
///
/// Drawn, not traced, per the standing instruction: these are built from
/// isometric primitives — boxes, discs and a few lines — rather than copied
/// from the reference's own artwork.
enum ObjectEmblems {

    // MARK: - The isometric projection

    /// A point in the drawing's own 3D space → the page.
    ///
    /// The standard 2:1 isometric every technical illustration uses: x runs
    /// down-right, y runs down-left, z is up. `unit` is one cube edge.
    ///
    /// The same projection `ScanMethodArt` already draws its capture-method
    /// illustrations in, so the two sets look like they came from one hand.
    static func iso(_ x: Double, _ y: Double, _ z: Double, unit: CGFloat, origin: CGPoint)
        -> CGPoint
    {
        CGPoint(
            x: origin.x + (CGFloat(x) - CGFloat(y)) * unit * 0.866,
            y: origin.y + (CGFloat(x) + CGFloat(y)) * unit * 0.5 - CGFloat(z) * unit)
    }

    /// One isometric box, as its three visible faces.
    ///
    /// Faces rather than a wireframe: a filled top, left and right is what
    /// makes a box read as solid at 38 points, where twelve edges read as a
    /// scribble. Returned as three paths so a caller can shade them
    /// differently — the top lighter than the sides is the whole of what
    /// makes an isometric drawing look lit.
    static func boxFaces(
        at o: (x: Double, y: Double, z: Double), size s: (w: Double, d: Double, h: Double),
        unit: CGFloat, origin: CGPoint
    ) -> (top: Path, left: Path, right: Path) {
        func p(_ x: Double, _ y: Double, _ z: Double) -> CGPoint {
            iso(o.x + x, o.y + y, o.z + z, unit: unit, origin: origin)
        }

        var top = Path()
        top.move(to: p(0, 0, s.h))
        top.addLine(to: p(s.w, 0, s.h))
        top.addLine(to: p(s.w, s.d, s.h))
        top.addLine(to: p(0, s.d, s.h))
        top.closeSubpath()

        // The face looking down-left, and the one looking down-right.
        var left = Path()
        left.move(to: p(0, s.d, s.h))
        left.addLine(to: p(s.w, s.d, s.h))
        left.addLine(to: p(s.w, s.d, 0))
        left.addLine(to: p(0, s.d, 0))
        left.closeSubpath()

        var right = Path()
        right.move(to: p(s.w, 0, s.h))
        right.addLine(to: p(s.w, s.d, s.h))
        right.addLine(to: p(s.w, s.d, 0))
        right.addLine(to: p(s.w, 0, 0))
        right.closeSubpath()

        return (top, left, right)
    }
}

/// One section's emblem, drawn to fill what it is given.
struct SectionEmblem: View {
    let section: LibrarySection

    var body: some View {
        Canvas { context, size in
            // One unit is a fraction of the box, so every emblem is drawn in
            // the same scale and they sit as a set rather than as ten
            // drawings that happen to be near each other.
            let unit = min(size.width, size.height) / 3.4
            let origin = CGPoint(x: size.width / 2, y: size.height * 0.62)
            draw(context: context, unit: unit, origin: origin)
        }
    }

    // Line art: one ink, three weights of fill. Fixed in both appearances
    // like `Brand.Plan`, because an illustration that inverts stops looking
    // like the thing it draws.
    private var ink: Color { Color(hex: 0x2E3238) }
    private var topFill: Color { Color(hex: 0xFFFFFF) }
    private var leftFill: Color { Color(hex: 0xE7E9EC) }
    private var rightFill: Color { Color(hex: 0xF4F5F7) }

    private func draw(context: GraphicsContext, unit: CGFloat, origin: CGPoint) {
        let weight = max(0.9, unit * 0.075)

        func p(_ x: Double, _ y: Double, _ z: Double) -> CGPoint {
            ObjectEmblems.iso(x, y, z, unit: unit, origin: origin)
        }

        /// Draw a solid isometric box: three shaded faces, then its edges.
        func box(
            _ ox: Double, _ oy: Double, _ oz: Double,
            _ w: Double, _ d: Double, _ h: Double
        ) {
            let faces = ObjectEmblems.boxFaces(
                at: (ox, oy, oz), size: (w, d, h), unit: unit, origin: origin)
            context.fill(faces.left, with: .color(leftFill))
            context.fill(faces.right, with: .color(rightFill))
            context.fill(faces.top, with: .color(topFill))
            for face in [faces.left, faces.right, faces.top] {
                context.stroke(face, with: .color(ink), lineWidth: weight)
            }
        }

        func line(_ a: CGPoint, _ b: CGPoint, _ w: CGFloat = 1) {
            var path = Path()
            path.move(to: a)
            path.addLine(to: b)
            context.stroke(path, with: .color(ink), lineWidth: weight * w)
        }

        /// A disc lying on a vertical face — a washer door, a fan.
        func disc(at centre: CGPoint, radius: CGFloat, fill: Color? = nil) {
            let rect = CGRect(
                x: centre.x - radius, y: centre.y - radius * 0.92,
                width: radius * 2, height: radius * 1.84)
            if let fill { context.fill(Path(ellipseIn: rect), with: .color(fill)) }
            context.stroke(Path(ellipseIn: rect), with: .color(ink), lineWidth: weight)
        }

        switch section {
        case .doors:
            // A frame with a leaf standing open into the room.
            box(0, 0, 0, 0.18, 1.2, 2)
            box(1.5, 0, 0, 0.18, 1.2, 2)
            // The lintel over the opening.
            box(0, 0, 2, 1.68, 1.2, 0.18)
            // The open leaf, swung toward the viewer on the near jamb.
            var leaf = Path()
            leaf.move(to: p(1.5, 1.2, 0))
            leaf.addLine(to: p(1.5, 1.2, 1.95))
            leaf.addLine(to: p(2.5, 2.5, 1.95))
            leaf.addLine(to: p(2.5, 2.5, 0))
            leaf.closeSubpath()
            context.fill(leaf, with: .color(topFill))
            context.stroke(leaf, with: .color(ink), lineWidth: weight)
            // The handle.
            disc(at: p(2.3, 2.25, 1), radius: unit * 0.07, fill: ink)

        case .windows:
            // A frame with two casements, one cracked open.
            box(0, 0, 0.4, 0.16, 1.9, 1.5)
            box(1.9, 0, 0.4, 0.16, 1.9, 1.5)
            box(0, 0, 0.4, 2.06, 1.9, 0.16)
            box(0, 0, 1.74, 2.06, 1.9, 0.16)
            var glass = Path()
            glass.move(to: p(0.16, 0.95, 0.56))
            glass.addLine(to: p(1.9, 0.95, 0.56))
            glass.addLine(to: p(1.9, 0.95, 1.74))
            glass.addLine(to: p(0.16, 0.95, 1.74))
            glass.closeSubpath()
            context.fill(glass, with: .color(Color(hex: 0xDCE8F2)))
            context.stroke(glass, with: .color(ink), lineWidth: weight)
            line(p(1.03, 0.95, 0.56), p(1.03, 0.95, 1.74))

        case .catalogue(let category):
            switch category {
            case .structural:
                // A flight of steps, each tread a box on the one below.
                for i in 0..<4 {
                    let step = Double(i)
                    box(step * 0.5, 0, step * 0.42, 0.5, 1.6, 0.42)
                }

            case .plumbing:
                // A basin on a pedestal, with a tap arching over it.
                box(0.35, 0.35, 0, 1.1, 1.1, 1.1)
                box(0, 0, 1.1, 1.8, 1.8, 0.3)
                let bowl = CGRect(
                    x: p(0.9, 0.9, 1.4).x - unit * 0.55, y: p(0.9, 0.9, 1.4).y - unit * 0.3,
                    width: unit * 1.1, height: unit * 0.6)
                context.fill(Path(ellipseIn: bowl), with: .color(Color(hex: 0xDCE8F2)))
                context.stroke(Path(ellipseIn: bowl), with: .color(ink), lineWidth: weight)
                var tap = Path()
                tap.move(to: p(0.25, 0.25, 1.4))
                tap.addQuadCurve(to: p(0.9, 0.9, 1.55), control: p(0.25, 0.25, 2.3))
                context.stroke(tap, with: .color(ink), lineWidth: weight * 1.3)

            case .appliances:
                // A front-loader: a box with a round door and a panel.
                box(0, 0, 0, 1.7, 1.5, 2)
                disc(at: p(1.7, 0.75, 0.85), radius: unit * 0.42, fill: Color(hex: 0xDCE8F2))
                line(p(1.7, 0.2, 1.75), p(1.7, 1.3, 1.75), 0.8)

            case .cabinets:
                // A base unit: carcass, counter overhanging it, two doors.
                box(0, 0, 0, 1.9, 1.5, 1.7)
                box(-0.1, -0.1, 1.7, 2.1, 1.7, 0.22)
                line(p(1.9, 0.75, 0), p(1.9, 0.75, 1.7))
                disc(at: p(1.9, 0.55, 1.45), radius: unit * 0.06, fill: ink)
                disc(at: p(1.9, 0.95, 1.45), radius: unit * 0.06, fill: ink)

            case .furniture:
                // An armchair: seat, back, two arms.
                box(0.3, 0.3, 0, 1.4, 1.4, 0.6)
                box(0.3, 0.3, 0.6, 1.4, 0.25, 0.9)
                box(0.05, 0.3, 0.35, 0.25, 1.4, 0.5)
                box(1.7, 0.3, 0.35, 0.25, 1.4, 0.5)

            case .electrical:
                // A plug on its cord, in front of an outlet plate.
                box(0, 0, 0.2, 0.12, 1.5, 1.5)
                disc(at: p(0.12, 0.75, 0.95), radius: unit * 0.09, fill: topFill)
                box(0.6, 0.5, 0.7, 0.5, 0.5, 0.5)
                line(p(0.12, 0.62, 0.95), p(0.6, 0.62, 0.95), 1.2)
                line(p(0.12, 0.88, 0.95), p(0.6, 0.88, 0.95), 1.2)
                var cord = Path()
                cord.move(to: p(1.1, 0.75, 0.95))
                cord.addQuadCurve(to: p(1.9, 1.6, 0.2), control: p(1.9, 0.75, 0.6))
                context.stroke(cord, with: .color(ink), lineWidth: weight * 1.1)

            case .hvac:
                // A fan unit: a box with a bladed disc on its face.
                box(0, 0, 0, 1.6, 1.6, 1.6)
                let centre = p(1.6, 0.8, 0.8)
                disc(at: centre, radius: unit * 0.5, fill: topFill)
                for i in 0..<4 {
                    let angle = Double(i) * .pi / 2 + 0.4
                    line(
                        centre,
                        CGPoint(
                            x: centre.x + cos(angle) * unit * 0.45,
                            y: centre.y + sin(angle) * unit * 0.42),
                        0.8)
                }

            case .safety:
                // An extinguisher on its bracket: the body, the neck, and
                // the hose over its shoulder.
                box(0.6, 0.6, 0, 0.8, 0.8, 1.6)
                box(0.85, 0.85, 1.6, 0.3, 0.3, 0.3)
                var hose = Path()
                hose.move(to: p(1.0, 0.85, 1.85))
                hose.addQuadCurve(to: p(1.7, 1.5, 0.8), control: p(1.9, 1.0, 1.8))
                context.stroke(hose, with: .color(ink), lineWidth: weight * 1.2)

            case .outdoors:
                // A deck: boards on posts, which is what most of this
                // section is standing on.
                box(0, 0, 0.7, 2.2, 1.6, 0.18)
                for i in 1..<5 {
                    let x = 2.2 * Double(i) / 5
                    line(p(x, 0, 0.88), p(x, 1.6, 0.88), 0.7)
                }
                for (x, y) in [(0.15, 0.15), (1.95, 0.15), (0.15, 1.45), (1.95, 1.45)] {
                    line(p(x, y, 0.7), p(x, y, 0), 1.2)
                }

            case .restoration:
                // A toolbox: a body, a lid band and a handle over it.
                box(0, 0, 0, 2, 1.3, 0.9)
                box(-0.08, -0.08, 0.9, 2.16, 1.46, 0.22)
                var handle = Path()
                handle.move(to: p(0.5, 0.65, 1.12))
                handle.addQuadCurve(to: p(1.5, 0.65, 1.12), control: p(1, 0.65, 2.1))
                context.stroke(handle, with: .color(ink), lineWidth: weight * 1.2)
            }
        }
    }
}
