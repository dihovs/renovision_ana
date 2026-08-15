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
                }
                .buttonStyle(.plain)
            }

            ForEach(items) { item in
                let text = caption(item)
                Button { onOpen(item) } label: {
                    VStack(spacing: 8) {
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
                }
                .buttonStyle(.plain)
            }
        }
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
            let corners = plan.polygon
            guard corners.count >= 3 else { return }

            let xs = corners.map(\.x), ys = corners.map(\.y)
            let minX = xs.min()!, maxX = xs.max()!
            let minY = ys.min()!, maxY = ys.max()!
            let w = max(maxX - minX, 0.001), h = max(maxY - minY, 0.001)
            // Fit with a margin, and never scale UP past life size on screen —
            // a one-room job should not fill the card edge to edge while a
            // whole storey shrinks to fit.
            let scale = min(size.width / w, size.height / h) * 0.86
            let ox = (size.width - w * scale) / 2 - minX * scale
            let oy = (size.height - h * scale) / 2 - minY * scale

            var path = Path()
            for (i, p) in corners.enumerated() {
                let point = CGPoint(x: p.x * scale + ox, y: p.y * scale + oy)
                if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
            }
            path.closeSubpath()

            context.fill(path, with: .color(Brand.Plan.floorMuted))
            context.stroke(
                path, with: .color(Brand.Plan.ink),
                style: StrokeStyle(lineWidth: 2.5, lineJoin: .miter))
        }
    }
}
