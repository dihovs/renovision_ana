import SwiftUI

/// A room drawn as an architect drafts one.
///
/// The v2 renderer, from the researched spec: pochéd double-line walls whose
/// corners close square (the two-pass stroke technique), openings knocked out
/// with jamb caps at cut weight, a three-line window symbol, a door with its
/// leaf and quarter swing, tick-terminated dimensions in drafted feet-inches,
/// and the room's name at the pole of inaccessibility. The web renderer and
/// the printed report follow the same constants — one drawing, three places.
struct FloorPlanView: View {
    let plan: FloorPlanGeometry.Plan
    /// Damaged regions over the floor, in the plan's own metres.
    var areas: [(polygon: [CGPoint], colour: Color)] = []
    /// A shape being dragged right now, above everything else.
    var draft: (polygon: [CGPoint], colour: Color)?
    /// Room name + area, drawn on the plan itself at full sizes.
    var label: (name: String, sqft: Int)?

    /// Real interior wall: 2×4 partition + drywall.
    private let T = 0.114
    /// The cut-face line weight, in device points — never scaled by zoom.
    private let cutPt: CGFloat = 1.4

    var body: some View {
        Canvas { context, size in
            guard plan.width > 0.1, plan.height > 0.1 else { return }

            // Dimensions need margin to live in; a thumbnail-sized canvas
            // drops them entirely (the spec's smallest level).
            let showDims = size.width >= 240
            let inTop: CGFloat = showDims ? 34 : 10
            let inRight: CGFloat = showDims ? 48 : 10
            let inLeft: CGFloat = 12
            let inBottom: CGFloat = 12

            let scale = min(
                (size.width - inLeft - inRight) / plan.width,
                (size.height - inTop - inBottom) / plan.height)
            guard scale > 0 else { return }
            let ox = inLeft + (size.width - inLeft - inRight - plan.width * scale) / 2
            let oy = inTop + (size.height - inTop - inBottom - plan.height * scale) / 2

            func pt(_ x: Double, _ y: Double) -> CGPoint {
                CGPoint(x: x * scale + ox, y: y * scale + oy)
            }
            func pt(_ p: CGPoint) -> CGPoint { pt(p.x, p.y) }

            let ink = Brand.Plan.ink
            let tPts = T * scale

            // 1. Floor.
            if plan.polygon.count >= 3 {
                var floor = Path()
                floor.move(to: pt(plan.polygon[0]))
                for p in plan.polygon.dropFirst() { floor.addLine(to: pt(p)) }
                floor.closeSubpath()
                context.fill(floor, with: .color(Brand.Plan.floorMuted))
            }

            // 2. Damage, over the floor and under the walls.
            for area in areas where area.polygon.count >= 3 {
                var path = Path()
                path.move(to: pt(area.polygon[0]))
                for p in area.polygon.dropFirst() { path.addLine(to: pt(p)) }
                path.closeSubpath()
                context.fill(path, with: .color(area.colour.opacity(0.28)))
                context.stroke(path, with: .color(area.colour), lineWidth: 1.5)
            }
            if let draft, draft.polygon.count >= 3 {
                var path = Path()
                path.move(to: pt(draft.polygon[0]))
                for p in draft.polygon.dropFirst() { path.addLine(to: pt(p)) }
                path.closeSubpath()
                context.fill(path, with: .color(draft.colour.opacity(0.3)))
                context.stroke(path, with: .color(draft.colour), lineWidth: 2)
            }

            // 3. Walls — two passes. Centrelines extended half a thickness at
            // shared joints, so corners close square; the wider ink pass
            // leaves the heavier cut faces either side of the poché.
            let joints = FloorPlanGeometry.joints(plan.segments)
            func nearJoint(_ x: Double, _ y: Double) -> Bool {
                joints.contains { hypot($0.x - x, $0.y - y) < 0.06 }
            }

            var walls = Path()
            for s in plan.segments {
                let L = s.length
                guard L > 0 else { continue }
                let ux = (s.x2 - s.x1) / L
                let uy = (s.y2 - s.y1) / L
                let e1 = nearJoint(s.x1, s.y1) ? T / 2 : 0
                let e2 = nearJoint(s.x2, s.y2) ? T / 2 : 0
                walls.move(to: pt(s.x1 - ux * e1, s.y1 - uy * e1))
                walls.addLine(to: pt(s.x2 + ux * e2, s.y2 + uy * e2))
            }

            // Poché by effective scale: black at plan sizes, 45% grey with
            // black faces once the band is wide enough to read as a cavity.
            let poche: Color = tPts > 12 ? Color(white: 0.55) : ink
            context.stroke(
                walls, with: .color(ink),
                style: StrokeStyle(lineWidth: max(2, tPts + 2 * cutPt), lineCap: .butt))
            context.stroke(
                walls, with: .color(poche),
                style: StrokeStyle(lineWidth: max(1.5, tPts), lineCap: .butt))

            // 4. Openings: knock the band out, cap the jambs, then the symbol.
            let bg = Brand.Plan.paper
            for opening in plan.openings {
                let s = opening.segment
                let w = s.length
                guard w > 0.05 else { continue }
                let ux = (s.x2 - s.x1) / w
                let uy = (s.y2 - s.y1) / w
                let nx = -uy
                let ny = ux

                var cut = Path()
                cut.move(to: pt(s.x1, s.y1))
                cut.addLine(to: pt(s.x2, s.y2))
                context.stroke(
                    cut, with: .color(bg),
                    style: StrokeStyle(lineWidth: max(2, tPts + 2 * cutPt) + 2, lineCap: .butt))

                guard showDims || size.width >= 150 else { continue }

                // Jamb caps — the jambs are cut by the plan plane and carry
                // full cut weight.
                for (jx, jy) in [(s.x1, s.y1), (s.x2, s.y2)] {
                    var jamb = Path()
                    jamb.move(to: pt(jx - nx * T / 2, jy - ny * T / 2))
                    jamb.addLine(to: pt(jx + nx * T / 2, jy + ny * T / 2))
                    context.stroke(jamb, with: .color(ink), lineWidth: cutPt)
                }

                switch opening.kind {
                case .window:
                    for side in [1.0, -1.0] {
                        var frame = Path()
                        frame.move(to: pt(s.x1 + side * nx * T / 2, s.y1 + side * ny * T / 2))
                        frame.addLine(to: pt(s.x2 + side * nx * T / 2, s.y2 + side * ny * T / 2))
                        context.stroke(frame, with: .color(ink), lineWidth: 1)
                    }
                    // Glazing on the centreline — suppressed when the cavity
                    // is too narrow to hold three distinct lines.
                    if tPts >= 4 {
                        var glass = Path()
                        glass.move(to: pt(s.x1, s.y1))
                        glass.addLine(to: pt(s.x2, s.y2))
                        context.stroke(glass, with: .color(ink), lineWidth: 0.7)
                    }

                case .door where w >= 0.45:
                    // Hinge at the jamb nearer a wall joint; swing toward the
                    // room's interior. Conventions, not measurements — the
                    // scan records neither.
                    func jointDistance(_ x: Double, _ y: Double) -> Double {
                        joints.map { hypot($0.x - x, $0.y - y) }.min() ?? 9
                    }
                    let hingeAtStart = jointDistance(s.x1, s.y1) <= jointDistance(s.x2, s.y2)
                    let (hx, hy, lx, ly) = hingeAtStart
                        ? (s.x1, s.y1, s.x2, s.y2) : (s.x2, s.y2, s.x1, s.y1)

                    var cx = plan.width / 2
                    var cy = plan.height / 2
                    if plan.polygon.count >= 3 {
                        cx = plan.polygon.reduce(0) { $0 + $1.x } / Double(plan.polygon.count)
                        cy = plan.polygon.reduce(0) { $0 + $1.y } / Double(plan.polygon.count)
                    }
                    let sideSign: Double = ((cx - hx) * nx + (cy - hy) * ny) >= 0 ? 1 : -1

                    let H = pt(hx + sideSign * nx * T / 2, hy + sideSign * ny * T / 2)
                    let latch = pt(lx + sideSign * nx * T / 2, ly + sideSign * ny * T / 2)
                    let tip = pt(
                        hx + sideSign * nx * (T / 2 + w) - 0,
                        hy + sideSign * ny * (T / 2 + w))

                    var leaf = Path()
                    leaf.move(to: H)
                    leaf.addLine(to: tip)
                    context.stroke(leaf, with: .color(ink), lineWidth: 1)

                    let r = hypot(tip.x - H.x, tip.y - H.y)
                    let a0 = Angle(radians: atan2(tip.y - H.y, tip.x - H.x))
                    let a1 = Angle(radians: atan2(latch.y - H.y, latch.x - H.x))
                    // Sweep the quarter that goes tip → latch the short way.
                    var delta = a1.radians - a0.radians
                    while delta > .pi { delta -= 2 * .pi }
                    while delta < -.pi { delta += 2 * .pi }
                    var arc = Path()
                    arc.addArc(
                        center: H, radius: r, startAngle: a0,
                        endAngle: a1, clockwise: delta < 0)
                    context.stroke(arc, with: .color(ink), lineWidth: 0.7)

                default:
                    break
                }
            }

            // 5. Dimensions — the overall spans, top and right, terminated
            // with drafting ticks rather than arrowheads.
            if showDims {
                let grey = Color(hex: 0x6B6B70)
                let off: CGFloat = 20
                let overrun: CGFloat = 4
                let gap: CGFloat = 3
                let tick: CGFloat = 3.5

                func dimension(
                    from a: CGPoint, to b: CGPoint, outward: CGVector, text: String,
                    rotated: Bool
                ) {
                    let da = CGPoint(x: a.x + outward.dx * off, y: a.y + outward.dy * off)
                    let db = CGPoint(x: b.x + outward.dx * off, y: b.y + outward.dy * off)

                    var witness = Path()
                    witness.move(to: CGPoint(x: a.x + outward.dx * gap, y: a.y + outward.dy * gap))
                    witness.addLine(
                        to: CGPoint(
                            x: da.x + outward.dx * overrun, y: da.y + outward.dy * overrun))
                    witness.move(to: CGPoint(x: b.x + outward.dx * gap, y: b.y + outward.dy * gap))
                    witness.addLine(
                        to: CGPoint(
                            x: db.x + outward.dx * overrun, y: db.y + outward.dy * overrun))
                    context.stroke(witness, with: .color(grey), lineWidth: 0.6)

                    var line = Path()
                    line.move(to: da)
                    line.addLine(to: db)
                    context.stroke(line, with: .color(grey), lineWidth: 0.7)

                    for p in [da, db] {
                        var t = Path()
                        t.move(to: CGPoint(x: p.x - tick, y: p.y + tick))
                        t.addLine(to: CGPoint(x: p.x + tick, y: p.y - tick))
                        context.stroke(t, with: .color(grey), lineWidth: 1.1)
                    }

                    let mid = CGPoint(
                        x: (da.x + db.x) / 2 + outward.dx * 9,
                        y: (da.y + db.y) / 2 + outward.dy * 9)
                    let resolved = context.resolve(
                        Text(text).font(.system(size: 9, weight: .semibold)).foregroundStyle(grey))
                    if rotated {
                        context.drawLayer { layer in
                            layer.translateBy(x: mid.x, y: mid.y)
                            layer.rotate(by: .degrees(-90))
                            layer.draw(resolved, at: .zero, anchor: .center)
                        }
                    } else {
                        context.draw(resolved, at: mid, anchor: .center)
                    }
                }

                dimension(
                    from: pt(0, 0), to: pt(plan.width, 0), outward: CGVector(dx: 0, dy: -1),
                    text: UnitSettings.shared.format.format(plan.width), rotated: false)
                dimension(
                    from: pt(plan.width, 0), to: pt(plan.width, plan.height),
                    outward: CGVector(dx: 1, dy: 0),
                    text: UnitSettings.shared.format.format(plan.height), rotated: true)
            }

            // 6. The room's own label, deepest inside its outline.
            if let label, showDims, plan.polygon.count >= 3 {
                let anchor = FloorPlanGeometry.labelAnchor(
                    plan.polygon, width: plan.width, height: plan.height)
                let at = pt(anchor)
                let name = context.resolve(
                    Text(label.name.uppercased())
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Brand.Plan.label))
                let area = context.resolve(
                    Text("\(label.sqft) SQFT")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Brand.Plan.labelSoft))
                let nameSize = name.measure(in: size)
                let pad: CGFloat = 4
                let box = CGRect(
                    x: at.x - nameSize.width / 2 - pad, y: at.y - 11 - pad,
                    width: nameSize.width + pad * 2, height: 26 + pad * 2)
                context.fill(
                    Path(roundedRect: box, cornerRadius: 3), with: .color(bg.opacity(0.82)))
                context.draw(name, at: CGPoint(x: at.x, y: at.y - 3), anchor: .center)
                context.draw(area, at: CGPoint(x: at.x, y: at.y + 11), anchor: .center)
            }
        }
        .aspectRatio(aspect, contentMode: .fit)
    }

    private var aspect: CGFloat {
        guard plan.width > 0, plan.height > 0 else { return 1 }
        return CGFloat(plan.width / plan.height)
    }
}

/// Mark the damaged part of a room, on its plan.
///
/// REDUCTIVE, like the web editor and like the tools an estimator already
/// uses: a new area opens covering the whole floor and gets pulled in to the
/// wet part. Drawing from nothing would mean tracing a shape freehand on a
/// phone while standing in a basement, which is slower and less accurate than
/// dragging four corners.
struct AreaEditor: View {
    let plan: FloorPlanGeometry.Plan
    let existing: [(polygon: [CGPoint], colour: Color)]
    let onSave: (String, String, [CGPoint]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var corners: [CGPoint] = []
    @State private var dragging: Int?
    @State private var name = "Affected area"
    @State private var cause: DamageCause = .water
    @State private var saving = false

    private var colour: Color { cause.color }

    private var areaSqm: Double { FloorPlanGeometry.polygonArea(corners) }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                VStack(spacing: Brand.Space.base) {
                    GeometryReader { proxy in
                        let scale = fitScale(in: proxy.size)
                        let offset = centreOffset(in: proxy.size, scale: scale)

                        ZStack(alignment: .topLeading) {
                            FloorPlanView(
                                plan: plan, areas: existing,
                                draft: (corners, colour))

                            // Corner handles. Generous targets — this is
                            // dragged with a thumb, in a basement.
                            ForEach(corners.indices, id: \.self) { index in
                                Circle()
                                    .fill(colour)
                                    .overlay(Circle().strokeBorder(.white, lineWidth: 2))
                                    .frame(width: 26, height: 26)
                                    .position(
                                        x: corners[index].x * scale + offset.x,
                                        y: corners[index].y * scale + offset.y
                                    )
                                    .gesture(
                                        DragGesture()
                                            .onChanged { value in
                                                corners[index] = CGPoint(
                                                    x: (value.location.x - offset.x) / scale,
                                                    y: (value.location.y - offset.y) / scale)
                                            }
                                    )
                            }
                        }
                    }
                    .frame(maxHeight: 360)
                    .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))

                    VStack(alignment: .leading, spacing: Brand.Space.small) {
                        HStack {
                            TextField("Name", text: $name)
                                .font(.system(size: 16, weight: .semibold))
                            Spacer()
                            Text("\(Int(Measure.squareFeet(areaSqm).rounded())) sq ft")
                                .font(.system(size: 18, weight: .bold))
                                .monospacedDigit()
                                .foregroundStyle(Brand.ink)
                        }

                        DamageCausePicker(cause: $cause)

                        Text("Drag the corners in to the damaged part. It opens covering the whole room.")
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                    }
                    .padding(Brand.Space.base)
                    .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))

                    Button(saving ? "Saving…" : "Save area") {
                        saving = true
                        onSave(name.trimmed, cause.rawValue, corners)
                    }
                    .buttonStyle(PrimaryButtonStyle(enabled: !saving && areaSqm > 0))
                    .disabled(saving || areaSqm <= 0)
                }
                .padding(Brand.Space.base)
            }
            .navigationTitle("Affected area")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
            .onAppear(perform: seed)
        }
    }

    /// Opens covering the room: its outline when the walls closed into one,
    /// otherwise the bounding box, which is still a sane thing to pull in
    /// from when a scan left the room open.
    private func seed() {
        guard corners.isEmpty else { return }
        if plan.polygon.count >= 4 {
            corners = Array(plan.polygon.dropLast())
        } else {
            corners = [
                CGPoint(x: 0, y: 0),
                CGPoint(x: plan.width, y: 0),
                CGPoint(x: plan.width, y: plan.height),
                CGPoint(x: 0, y: plan.height),
            ]
        }
    }

    private func fitScale(in size: CGSize) -> CGFloat {
        guard plan.width > 0, plan.height > 0 else { return 1 }
        let pad: CGFloat = 12
        return min(
            (size.width - pad * 2) / CGFloat(plan.width),
            (size.height - pad * 2) / CGFloat(plan.height))
    }

    private func centreOffset(in size: CGSize, scale: CGFloat) -> CGPoint {
        CGPoint(
            x: (size.width - CGFloat(plan.width) * scale) / 2,
            y: (size.height - CGFloat(plan.height) * scale) / 2)
    }
}

/// The cause chips, in `DAMAGE_TYPES` order, each in its own colour.
///
/// One control rather than one per editor: the chips ARE the colour table
/// made visible, and the whole point of collapsing that table into
/// `DamageCause` is that there is no second place for it to drift in. The
/// floor editor and the elevation face both draw this.
struct DamageCausePicker: View {
    @Binding var cause: DamageCause

    var body: some View {
        HStack(spacing: Brand.Space.tight) {
            ForEach(DamageCause.allCases) { option in
                Button {
                    cause = option
                } label: {
                    Text(option.label)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(cause == option ? .white : Brand.inkSoft)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 7)
                        .background(
                            cause == option ? option.color : Brand.surfaceRaised,
                            in: .rect(cornerRadius: Brand.Radius.pill))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// Log one moisture reading.
///
/// Every field optional except that ONE must be filled: instruments differ,
/// and a pin meter that only reads material moisture should not be made to
/// invent a humidity. What is refused is an entirely empty reading, which
/// shows on the drying curve as a gap somebody has to explain.
struct ReadingSheet: View {
    let roomId: String
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var location = ""
    @State private var material = ""
    @State private var mc = ""
    @State private var rh = ""
    @State private var temp = ""
    @State private var saving = false
    @State private var error: String?

    private static let materials = [
        "Drywall", "Subfloor", "Framing / studs", "Concrete", "Insulation", "Hardwood",
    ]

    private var hasAnyReading: Bool {
        [mc, rh, temp].contains { Double($0.trimmed) != nil }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.base) {
                        Field(
                            label: "WHERE", text: $location,
                            placeholder: "North wall, 24in up")

                        VStack(alignment: .leading, spacing: Brand.Space.tight) {
                            Text("MATERIAL")
                                .font(.system(size: 10, weight: .heavy))
                                .foregroundStyle(Brand.inkFaint)
                            LazyVGrid(
                                columns: [GridItem(.adaptive(minimum: 96), spacing: Brand.Space.tight)],
                                alignment: .leading, spacing: Brand.Space.tight
                            ) {
                                ForEach(Self.materials, id: \.self) { option in
                                    Button {
                                        material = material == option ? "" : option
                                    } label: {
                                        Text(option)
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundStyle(material == option ? .white : Brand.inkSoft)
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 8)
                                            .background(
                                                material == option ? Brand.charcoalDark : Brand.surfaceRaised,
                                                in: .rect(cornerRadius: Brand.Radius.pill))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        HStack(spacing: Brand.Space.small) {
                            Field(label: "% MC", text: $mc, placeholder: "—", keyboard: .decimalPad)
                            Field(label: "% RH", text: $rh, placeholder: "—", keyboard: .decimalPad)
                            Field(label: "°C", text: $temp, placeholder: "—", keyboard: .decimalPad)
                        }

                        if let error {
                            Text(error).font(.footnote).foregroundStyle(.red)
                        }

                        Button(saving ? "Saving…" : "Save reading") {
                            Task { await save() }
                        }
                        .buttonStyle(PrimaryButtonStyle(enabled: !saving && hasAnyReading))
                        .disabled(saving || !hasAnyReading)

                        Text("Fill in whatever the instrument gave you. Nothing is assumed — a blank stays blank rather than becoming a zero in the claim file.")
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                    }
                    .padding(Brand.Space.base)
                }
            }
            .navigationTitle("Moisture reading")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
        }
    }

    private func save() async {
        saving = true
        error = nil
        do {
            _ = try await API.shared.createReading(
                roomScanId: roomId,
                location: location.trimmed,
                material: material.isEmpty ? nil : material,
                materialPercent: Double(mc.trimmed),
                relativeHumidity: Double(rh.trimmed),
                temperatureC: Double(temp.trimmed))
            onSaved()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}
