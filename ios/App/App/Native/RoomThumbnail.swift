import SwiftUI

/// One room's own plan, small.
///
/// The room cards used to carry `RoomGlyph` — a generic plan-shaped mark,
/// identical for every room. Six rooms on a rail looked like six copies of one
/// symbol, which is why the owner said he could not see a thumbnail: there was
/// nothing to see. A card that shows the room's actual outline is how you pick
/// the L-shaped one out of a list without reading names.
///
/// The presentation is the FLOOR-LEVEL one, deliberately — poché walls, flat
/// grey floor, nothing else. `Docs/reference/magicplan/object-model.md` §7:
/// the reference draws its plan two ways, a quiet thumbnail tier at floor
/// level and the live drawing with dimensions and handles inside a room. Ours
/// was drawing the live version small, which at 124pt is noise. No dimensions,
/// no corner handles, no grid, no label — the card already says the name and
/// the area underneath.
///
/// Draws the WALL SEGMENTS rather than the polygon outline, for the reason
/// `f391bab` gives on the project card: a room whose walls never closed has no
/// polygon, and a thumbnail that vanishes for exactly the rooms that need
/// attention is worse than one that shows the sticks it does have.
struct RoomThumbnail: View {
    let room: RoomScan
    var size: CGFloat = 46

    var body: some View {
        Canvas { context, canvas in
            guard let geometry = room.geometry else { return }
            let plan = FloorPlanGeometry.plan(from: geometry)
            guard plan.width > 0, plan.height > 0 else { return }

            // Fit with a hair of margin so a wall band is never clipped by the
            // card's own edge.
            let inset: CGFloat = 3
            let scale = min(
                (canvas.width - inset * 2) / plan.width,
                (canvas.height - inset * 2) / plan.height)
            guard scale.isFinite, scale > 0 else { return }
            let ox = (canvas.width - plan.width * scale) / 2
            let oy = (canvas.height - plan.height * scale) / 2
            func pt(_ x: Double, _ y: Double) -> CGPoint {
                CGPoint(x: x * scale + ox, y: y * scale + oy)
            }

            if plan.polygon.count >= 3 {
                var floor = Path()
                floor.move(to: pt(plan.polygon[0].x, plan.polygon[0].y))
                for p in plan.polygon.dropFirst() { floor.addLine(to: pt(p.x, p.y)) }
                floor.closeSubpath()
                context.fill(floor, with: .color(Brand.Plan.floorMuted))
            }

            // Same band rule as the storey sheet, floored so a small room on a
            // small card still reads as walls rather than hairlines.
            var walls = Path()
            for s in plan.segments {
                walls.move(to: pt(s.x1, s.y1))
                walls.addLine(to: pt(s.x2, s.y2))
            }
            context.stroke(
                walls, with: .color(Brand.Plan.ink),
                style: StrokeStyle(lineWidth: max(1.5, 0.114 * scale), lineCap: .square))

            // Openings knocked back out of the band, so a doorway reads as a
            // gap. The floor colour, not white: the card sits on white.
            for opening in plan.openings {
                var cut = Path()
                cut.move(to: pt(opening.segment.x1, opening.segment.y1))
                cut.addLine(to: pt(opening.segment.x2, opening.segment.y2))
                context.stroke(
                    cut, with: .color(Brand.Plan.floorMuted),
                    style: StrokeStyle(lineWidth: max(1.5, 0.114 * scale), lineCap: .butt))
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
