import SwiftUI

/// The card grid the reference uses everywhere it lists things — projects,
/// floor plans, rooms.
///
/// Measured off the owner's own phone rather than guessed. Every part of the
/// shape carries its weight:
///
/// * **Two columns, not a horizontal rail.** A rail shows three items and
///   hides the rest behind a swipe nobody makes. A grid shows the whole job.
/// * **The add tile comes first**, dashed, same size as a real card. Creating
///   the next thing is the most common action on a list screen and it should
///   not be a floating button covering the last row.
/// * **The label sits BELOW the card, centred.** Inside the tile it competes
///   with the drawing; below it, the drawing stays a drawing.
/// * **White card on a light-grey page.** The card is the paper the plan is
///   drawn on — the same reason `Brand.Plan` exists.
///
/// Up to three lines under each card: name, then a secondary line, then a
/// tertiary one. That is exactly what a project needs — name, address, time —
/// and a floor plan uses only the first.
struct CardGrid<Item: Identifiable, Thumbnail: View>: View {
    let items: [Item]
    var addLabel: String
    var onAdd: (() -> Void)?
    var onOpen: (Item) -> Void
    /// Name, secondary, tertiary. Empty strings are simply not drawn.
    var caption: (Item) -> (String, String?, String?)
    @ViewBuilder var thumbnail: (Item) -> Thumbnail
    /// The reference's "…" in the card's bottom-right corner. Optional and
    /// type-erased rather than a second generic: most callers (rooms, floor
    /// plans) have no per-item action yet, and forcing them to name a menu
    /// type just to pass `nil` is a worse API than one closure that some
    /// callers skip.
    var menu: ((Item) -> AnyView)?
    /// The reference's star badge, top-trailing on the card — its own colour
    /// here rather than the reference's yellow, since the glyph and its
    /// colour are exactly the part of the reference this project draws its
    /// own rather than traces (`HANDOFF.md` §2). Optional for the same
    /// reason `menu` is: most callers have nothing to star yet.
    var isFavorite: ((Item) -> Bool)?

    private let columns = [
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14),
    ]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .center, spacing: 18) {
            if let onAdd {
                Button(action: onAdd) {
                    VStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(
                                Brand.Plan.dimension.opacity(0.5),
                                style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                            .aspectRatio(1.16, contentMode: .fit)
                            .overlay(
                                Image(systemName: "plus")
                                    .font(.system(size: 22, weight: .regular))
                                    .foregroundStyle(Brand.Plan.dimension))
                        Text(addLabel)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Brand.Plan.label)
                        // Keeps the add tile's overall height equal to a card
                        // carrying two caption lines, so row one sits straight.
                        Color.clear.frame(height: 1)
                    }
                    // The tile is drawn with `strokeBorder`, which fills
                    // NOTHING — only the 1.5pt dashed outline is a shape, and
                    // only a shape takes a tap. Without this the middle of
                    // the tile, which is the whole target a thumb aims at,
                    // was inert: the button could only be hit on the dashed
                    // line itself, on the small plus glyph, or on the label
                    // underneath. It read as "New Project does nothing",
                    // while the occasional lucky tap did create one.
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }

            ForEach(items) { item in
                let text = caption(item)
                VStack(spacing: 8) {
                    // The menu is a SIBLING overlay on top of the card's own
                    // Button, not content nested inside its label — an
                    // interactive control nested inside another control's
                    // label fights it for the tap rather than winning its
                    // own corner outright, which a native `Menu` needs to
                    // open reliably rather than just triggering `onOpen`.
                    ZStack(alignment: .bottomTrailing) {
                        Button { onOpen(item) } label: {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Brand.Plan.paper)
                                .aspectRatio(1.16, contentMode: .fit)
                                .overlay(
                                    thumbnail(item)
                                        .clipShape(RoundedRectangle(cornerRadius: 12)))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .strokeBorder(Brand.Plan.dimension.opacity(0.18), lineWidth: 0.5))
                                .shadow(color: .black.opacity(0.06), radius: 3, y: 1)
                        }
                        .buttonStyle(.plain)

                        if let menu {
                            menu(item)
                                .padding(6)
                        }
                    }
                    .overlay(alignment: .topTrailing) {
                        if isFavorite?(item) == true {
                            Image(systemName: "star.fill")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 22, height: 22)
                                .background(Brand.blue, in: Circle())
                                .overlay(Circle().strokeBorder(.white, lineWidth: 1.5))
                                .padding(6)
                                .allowsHitTesting(false)
                        }
                    }

                    Button { onOpen(item) } label: {
                        VStack(spacing: 1) {
                            Text(text.0)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Brand.Plan.label)
                                .lineLimit(1)
                            if let second = text.1, !second.isEmpty {
                                Text(second)
                                    .font(.system(size: 11))
                                    .foregroundStyle(Brand.Plan.labelSoft)
                                    .lineLimit(1)
                            }
                            if let third = text.2, !third.isEmpty {
                                Text(third)
                                    .font(.system(size: 10))
                                    .foregroundStyle(Brand.Plan.labelSoft.opacity(0.8))
                                    .lineLimit(1)
                            }
                        }
                        .multilineTextAlignment(.center)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

/// The reference's dashed `+` tile at the head of a rail.
///
/// Solid-filled behind the dashes on purpose: a tile drawn only with
/// `strokeBorder` fills nothing, so only the 1.5pt outline takes a tap and
/// the middle of the tile — the whole target a thumb aims at — is inert.
/// That exact mistake made `New Project` look broken for a day.
struct AddTile: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(Brand.Plan.dimension)
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.Plan.labelSoft)
                    .lineLimit(1)
            }
            .frame(width: 132, height: 114)
            .background(Brand.Plan.paper.opacity(0.6), in: .rect(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(
                        Brand.Plan.dimension.opacity(0.5),
                        style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// An empty dashed outline beside the `+`. Draws nothing and does nothing —
/// it is the reference's way of saying "things go along here", which a lone
/// button on its own does not say.
struct GhostTile: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 12)
            .strokeBorder(
                Brand.Plan.dimension.opacity(0.28),
                style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
            .frame(width: 132, height: 114)
            .allowsHitTesting(false)
    }
}

/// The filter chips above a grid — `All` as a filled pill, the rest outlined.
///
/// The selected chip is SOLID and the others are not, which is the whole of
/// how it reads at a glance; using colour alone would fail the operator
/// looking at this in sunlight with wet hands.
struct FilterChips<Value: Hashable>: View {
    let options: [(value: Value, label: String, icon: String)]
    @Binding var selection: Value

    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.value) { option in
                let active = option.value == selection
                Button {
                    selection = option.value
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: option.icon).font(.system(size: 11, weight: .semibold))
                        Text(option.label).font(.system(size: 13, weight: .semibold))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .foregroundStyle(active ? Brand.Plan.paper : Brand.Plan.label)
                    .background(
                        Capsule().fill(active ? Brand.Plan.label : Brand.Plan.paper))
                    .overlay(
                        Capsule().strokeBorder(
                            Brand.Plan.dimension.opacity(active ? 0 : 0.3), lineWidth: 0.5))
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
    }
}

/// A floor plan at thumbnail size — walls only, no labels, no dimensions.
///
/// Deliberately not the full renderer. At 150 points across, a dimension
/// string is three grey pixels and a room name is a smudge; what survives at
/// this size is the SHAPE, and the shape is what tells one job from another
/// in a grid. Drawn from the same `FloorPlanGeometry` the storey canvas uses,
/// so the card and the plan behind it cannot disagree about the outline.
struct MiniPlan: View {
    let geometry: ScanGeometry

    var body: some View {
        Canvas { context, size in
            let plan = FloorPlanGeometry.plan(from: geometry)
            guard !plan.segments.isEmpty else { return }

            // Bounds come from the SEGMENTS, not the polygon. `plan.polygon`
            // is empty whenever the walls do not close — deliberately, since
            // inventing an outline would draw a fill that is not the room —
            // and a scan that failed to close is exactly the one whose
            // thumbnail matters most, because its shape is how you notice.
            let xs = plan.segments.flatMap { [$0.x1, $0.x2] }
            let ys = plan.segments.flatMap { [$0.y1, $0.y2] }
            guard let minX = xs.min(), let maxX = xs.max(),
                  let minY = ys.min(), let maxY = ys.max() else { return }

            let w = max(maxX - minX, 0.001), h = max(maxY - minY, 0.001)
            let scale = min(size.width / w, size.height / h) * 0.86
            let ox = (size.width - w * scale) / 2 - minX * scale
            let oy = (size.height - h * scale) / 2 - minY * scale
            let pt = { (x: Double, y: Double) in
                CGPoint(x: x * scale + ox, y: y * scale + oy)
            }

            // The floor, only when there is a real outline to fill.
            if plan.polygon.count >= 3 {
                var floor = Path()
                for (i, p) in plan.polygon.enumerated() {
                    let q = pt(p.x, p.y)
                    if i == 0 { floor.move(to: q) } else { floor.addLine(to: q) }
                }
                floor.closeSubpath()
                context.fill(floor, with: .color(Brand.Plan.floorMuted))
            }

            var walls = Path()
            for s in plan.segments {
                walls.move(to: pt(s.x1, s.y1))
                walls.addLine(to: pt(s.x2, s.y2))
            }
            context.stroke(
                walls, with: .color(Brand.Plan.ink),
                style: StrokeStyle(lineWidth: 2.2, lineCap: .square))

            // A door or window is a gap in the wall, cut back to the paper
            // colour, the same convention `LevelCanvas` draws with. Without
            // this a card's own walls were unconditionally solid, so a room
            // with a door on it looked identical to one with none — the
            // thing this card exists to show at a glance was the one thing
            // it could not show.
            for opening in plan.openings {
                var cut = Path()
                cut.move(to: pt(opening.segment.x1, opening.segment.y1))
                cut.addLine(to: pt(opening.segment.x2, opening.segment.y2))
                context.stroke(
                    cut, with: .color(Brand.Plan.paper),
                    style: StrokeStyle(lineWidth: 3.7, lineCap: .butt))
            }
        }
    }
}
