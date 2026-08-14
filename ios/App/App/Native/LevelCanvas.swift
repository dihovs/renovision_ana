import SwiftUI

/// A whole storey on one sheet — every room drawn to scale, tappable.
///
/// The arrangement is packed, not surveyed, and that honesty is inherited
/// from the web canvas: RoomPlan measures each room from wherever the
/// operator stood, so separately-scanned rooms carry no true relative
/// position. Rooms the operator has dragged into place on the web keep those
/// positions here (plan_x/plan_y); the rest fall into tidy rows. Nothing is
/// ever resized — the layout is arbitrary, the shapes are measurements.
struct LevelCanvas: View {
    let rooms: [RoomScan]
    let onTap: (RoomScan) -> Void

    private struct Slot {
        let room: RoomScan
        let plan: FloorPlanGeometry.Plan
        var x: Double
        var y: Double
    }

    /// Shelf-packed slots, honouring dragged positions where they exist.
    private var layout: (slots: [Slot], width: Double, height: Double) {
        let gap = 1.2
        var slots: [Slot] = []
        for room in rooms {
            guard let geometry = room.geometry else { continue }
            let plan = FloorPlanGeometry.plan(from: geometry)
            guard !plan.isEmpty else { continue }
            slots.append(Slot(room: room, plan: plan, x: 0, y: 0))
        }
        guard !slots.isEmpty else { return ([], 0, 0) }

        // Pack the unplaced into rows aiming at a squarish sheet.
        let totalArea = slots.reduce(0.0) { $0 + $1.plan.width * $1.plan.height }
        let widest = slots.map(\.plan.width).max() ?? 1
        let target = max((totalArea).squareRoot() * 1.4, widest)

        var x = 0.0
        var y = 0.0
        var rowHeight = 0.0
        for i in slots.indices {
            if let px = slots[i].room.planX, let py = slots[i].room.planY {
                slots[i].x = px
                slots[i].y = py
                continue
            }
            if x > 0, x + slots[i].plan.width > target {
                x = 0
                y += rowHeight + gap
                rowHeight = 0
            }
            slots[i].x = x
            slots[i].y = y
            x += slots[i].plan.width + gap
            rowHeight = max(rowHeight, slots[i].plan.height)
        }

        // Re-base so dragged-negative rooms stay on the sheet.
        let minX = slots.map(\.x).min() ?? 0
        let minY = slots.map(\.y).min() ?? 0
        for i in slots.indices {
            slots[i].x -= minX
            slots[i].y -= minY
        }
        let width = slots.map { $0.x + $0.plan.width }.max() ?? 1
        let height = slots.map { $0.y + $0.plan.height }.max() ?? 1
        return (slots, width, height)
    }

    var body: some View {
        let layout = self.layout
        if layout.slots.isEmpty {
            EmptyView()
        } else {
            GeometryReader { proxy in
                let pad: CGFloat = 10
                let scale = min(
                    (proxy.size.width - pad * 2) / layout.width,
                    (proxy.size.height - pad * 2) / layout.height)
                let ox = pad + (proxy.size.width - pad * 2 - layout.width * scale) / 2
                let oy = pad + (proxy.size.height - pad * 2 - layout.height * scale) / 2

                Canvas { context, _ in
                    let ink = Color(hex: 0x111111)
                    let bg = Color(uiColor: .systemBackground)

                    for slot in layout.slots {
                        func pt(_ px: Double, _ py: Double) -> CGPoint {
                            CGPoint(
                                x: (slot.x + px) * scale + ox,
                                y: (slot.y + py) * scale + oy)
                        }

                        if slot.plan.polygon.count >= 3 {
                            var floor = Path()
                            floor.move(to: pt(slot.plan.polygon[0].x, slot.plan.polygon[0].y))
                            for p in slot.plan.polygon.dropFirst() { floor.addLine(to: pt(p.x, p.y)) }
                            floor.closeSubpath()
                            context.fill(floor, with: .color(Color(hex: 0xEFEEF4)))
                        }

                        // Sheet level-of-detail: solid bands and honest gaps —
                        // the spec's thumbnail tier, because six rooms on a
                        // phone width leave no room for symbols.
                        let band = max(2, 0.114 * scale)
                        var walls = Path()
                        for s in slot.plan.segments {
                            walls.move(to: pt(s.x1, s.y1))
                            walls.addLine(to: pt(s.x2, s.y2))
                        }
                        context.stroke(
                            walls, with: .color(ink),
                            style: StrokeStyle(lineWidth: band, lineCap: .square))

                        for opening in slot.plan.openings {
                            var cut = Path()
                            cut.move(to: pt(opening.segment.x1, opening.segment.y1))
                            cut.addLine(to: pt(opening.segment.x2, opening.segment.y2))
                            context.stroke(
                                cut, with: .color(bg),
                                style: StrokeStyle(lineWidth: band + 1.5, lineCap: .butt))
                        }

                        // Name + area, when the room plots big enough to hold
                        // them.
                        let plotWidth = slot.plan.width * scale
                        if plotWidth >= 64 {
                            let centre = pt(slot.plan.width / 2, slot.plan.height / 2)
                            let name = context.resolve(
                                Text(slot.room.name)
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(Color(hex: 0x1A1A1A)))
                            let sqft = context.resolve(
                                Text(Measure.sqftLabel(slot.room.floorAreaSqm))
                                    .font(.system(size: 9))
                                    .foregroundStyle(Color(hex: 0x666666)))
                            let box = name.measure(in: proxy.size)
                            context.fill(
                                Path(
                                    roundedRect: CGRect(
                                        x: centre.x - box.width / 2 - 3, y: centre.y - 14,
                                        width: box.width + 6, height: 28),
                                    cornerRadius: 3),
                                with: .color(bg.opacity(0.8)))
                            context.draw(name, at: CGPoint(x: centre.x, y: centre.y - 5), anchor: .center)
                            context.draw(sqft, at: CGPoint(x: centre.x, y: centre.y + 8), anchor: .center)
                        }
                    }
                }
                .contentShape(.rect)
                .onTapGesture { location in
                    // Hit-test in plan space; first slot whose box contains
                    // the tap wins.
                    let px = (location.x - ox) / scale
                    let py = (location.y - oy) / scale
                    if let hit = layout.slots.first(where: { slot in
                        px >= slot.x && px <= slot.x + slot.plan.width && py >= slot.y
                            && py <= slot.y + slot.plan.height
                    }) {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        onTap(hit.room)
                    }
                }
            }
            .aspectRatio(CGFloat(max(layout.width, 0.1) / max(layout.height, 0.1)), contentMode: .fit)
            .frame(maxHeight: 320)
        }
    }
}

/// What counts as living area on this property, and why.
///
/// The totals AND the working. A living-area figure with no breakdown is one
/// an adjuster has to take on faith, and they will not — so every room that
/// contributed nothing says why it contributed nothing, right there.
struct LivingAreaCard: View {
    let projectId: String

    @State private var result: LivingAreaResponse?
    @State private var expanded = false
    @State private var showDefinition = false

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Brand.Space.small) {
                Button {
                    showDefinition = true
                } label: {
                    HStack(spacing: 4) {
                        Text("LIVING AREA")
                            .font(.system(size: 10, weight: .heavy))
                            .tracking(0.3)
                        Image(systemName: "info.circle").font(.system(size: 9))
                    }
                    .foregroundStyle(Brand.inkFaint)
                }
                .buttonStyle(.plain)

                if let totals = result?.totals {
                    HStack(alignment: .firstTextBaseline, spacing: Brand.Space.base) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(Measure.sqftLabel(totals.aboveGradeSqm))
                                .font(.system(size: 22, weight: .bold, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(Brand.ink)
                            Text("above grade")
                                .font(.system(size: 11))
                                .foregroundStyle(Brand.inkFaint)
                        }

                        if totals.belowGradeSqm > 0 {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(Measure.sqftLabel(totals.belowGradeSqm))
                                    .font(.system(size: 17, weight: .semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(Brand.inkSoft)
                                Text("below grade")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Brand.inkFaint)
                            }
                        }
                        Spacer()
                    }

                    // Kept separate and never summed into the headline: a
                    // figure that silently includes a basement is the most
                    // common way a living-area number gets challenged.
                    if totals.excludedSqm > 0 {
                        Text("\(Measure.sqftLabel(totals.excludedSqm)) measured but not counted")
                            .font(.system(size: 11))
                            .foregroundStyle(.orange)
                    }

                    Button {
                        expanded.toggle()
                    } label: {
                        Text(expanded ? "Hide the working" : "Show the working")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Brand.blue)
                    }
                    .buttonStyle(.plain)

                    if expanded {
                        VStack(spacing: 5) {
                            ForEach(totals.rooms) { room in
                                HStack(spacing: Brand.Space.tight) {
                                    Text(room.name)
                                        .font(.system(size: 12))
                                        .foregroundStyle(Brand.ink)
                                        .lineLimit(1)
                                    Spacer()
                                    if room.belowMinHeight {
                                        Text("ceiling under 7 ft")
                                            .font(.system(size: 10))
                                            .foregroundStyle(.orange)
                                    } else if room.band == "excluded" {
                                        Text("not living area")
                                            .font(.system(size: 10))
                                            .foregroundStyle(Brand.inkFaint)
                                    } else if room.percentApplied != 100 {
                                        Text("\(Int(room.percentApplied))%")
                                            .font(.system(size: 10))
                                            .foregroundStyle(Brand.inkFaint)
                                    }
                                    Text(Measure.sqftLabel(room.countedSqm))
                                        .font(.system(size: 12, weight: .semibold))
                                        .monospacedDigit()
                                        .foregroundStyle(
                                            room.countedSqm > 0 ? Brand.ink : Brand.inkFaint)
                                }
                            }
                        }
                        .padding(.top, 2)
                    }
                } else {
                    Text("Measure some rooms and set their types to see this.")
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.inkSoft)
                }
            }
        }
        .task {
            result = try? await API.shared.livingArea(projectId: projectId)
        }
        .popover(isPresented: $showDefinition) {
            VStack(alignment: .leading, spacing: Brand.Space.small) {
                Text("Living area")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Brand.ink)
                Text(result?.definition ?? "")
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(Brand.Space.base)
            .frame(width: 320)
            .presentationCompactAdaptation(.popover)
        }
    }
}
