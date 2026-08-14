import SwiftUI

/// A room drawn as a plan.
///
/// The drafting conventions a printed floor plan actually uses, matched to
/// the web renderer: solid walls with real thickness, a light floor behind
/// them, openings cut clean out of the wall. A room the operator recognises
/// on paper has to be the same room they see on the phone, or one of the two
/// stops being believed.
struct FloorPlanView: View {
    let plan: FloorPlanGeometry.Plan
    /// Damaged regions drawn over the floor, in the plan's own metres.
    var areas: [(polygon: [CGPoint], colour: Color)] = []
    /// A shape being dragged right now, above everything else.
    var draft: (polygon: [CGPoint], colour: Color)?

    var body: some View {
        GeometryReader { proxy in
            let scale = fitScale(in: proxy.size)
            let offset = centreOffset(in: proxy.size, scale: scale)

            ZStack(alignment: .topLeading) {
                Canvas { context, _ in
                    func point(_ p: CGPoint) -> CGPoint {
                        CGPoint(x: p.x * scale + offset.x, y: p.y * scale + offset.y)
                    }

                    // The floor, behind the walls.
                    if plan.polygon.count >= 3 {
                        var path = Path()
                        path.move(to: point(plan.polygon[0]))
                        for p in plan.polygon.dropFirst() { path.addLine(to: point(p)) }
                        path.closeSubpath()
                        context.fill(path, with: .color(Color(hex: 0xEBEBEB)))
                    }

                    // Damage, over the floor and under the walls — a wet
                    // patch is on the floor, not on top of the building.
                    for area in areas where area.polygon.count >= 3 {
                        var path = Path()
                        path.move(to: point(area.polygon[0]))
                        for p in area.polygon.dropFirst() { path.addLine(to: point(p)) }
                        path.closeSubpath()
                        context.fill(path, with: .color(area.colour.opacity(0.28)))
                        context.stroke(path, with: .color(area.colour), lineWidth: 1.5)
                    }

                    if let draft, draft.polygon.count >= 3 {
                        var path = Path()
                        path.move(to: point(draft.polygon[0]))
                        for p in draft.polygon.dropFirst() { path.addLine(to: point(p)) }
                        path.closeSubpath()
                        context.fill(path, with: .color(draft.colour.opacity(0.3)))
                        context.stroke(path, with: .color(draft.colour), lineWidth: 2)
                    }

                    // Walls, with real thickness — a hairline reads as a
                    // sketch rather than a plan.
                    for wall in plan.segments {
                        var path = Path()
                        path.move(to: point(CGPoint(x: wall.x1, y: wall.y1)))
                        path.addLine(to: point(CGPoint(x: wall.x2, y: wall.y2)))
                        context.stroke(
                            path, with: .color(Brand.ink),
                            style: StrokeStyle(lineWidth: max(2, 0.11 * scale), lineCap: .square))
                    }

                    // Openings cut back out of the wall they sit in, so a
                    // door is a gap rather than a mark drawn on top.
                    for opening in plan.openings {
                        var path = Path()
                        path.move(to: point(CGPoint(x: opening.segment.x1, y: opening.segment.y1)))
                        path.addLine(to: point(CGPoint(x: opening.segment.x2, y: opening.segment.y2)))
                        context.stroke(
                            path, with: .color(Brand.surface),
                            style: StrokeStyle(lineWidth: max(2, 0.13 * scale), lineCap: .butt))

                        // A window keeps a thin line through the gap; a door
                        // and a cased opening are left open.
                        if opening.kind == .window {
                            context.stroke(
                                path, with: .color(Brand.inkSoft),
                                style: StrokeStyle(lineWidth: max(1, 0.02 * scale)))
                        }
                    }
                }
            }
        }
        .aspectRatio(aspect, contentMode: .fit)
    }

    private var aspect: CGFloat {
        guard plan.width > 0, plan.height > 0 else { return 1 }
        return CGFloat(plan.width / plan.height)
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
    @State private var damageType = "water"
    @State private var saving = false

    private static let types: [(id: String, label: String, colour: UInt32)] = [
        ("water", "Water", 0x2B7FD4),
        ("fire", "Fire / smoke", 0xE2673A),
        ("mould", "Mould", 0x4F9D3A),
        ("impact", "Impact", 0x8A63D2),
        ("other", "Other", 0x8A8A8E),
    ]

    private var colour: Color {
        Color(hex: Self.types.first { $0.id == damageType }?.colour ?? 0x2B7FD4)
    }

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

                        HStack(spacing: Brand.Space.tight) {
                            ForEach(Self.types, id: \.id) { type in
                                Button {
                                    damageType = type.id
                                } label: {
                                    Text(type.label)
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundStyle(damageType == type.id ? .white : Brand.inkSoft)
                                        .padding(.horizontal, 9)
                                        .padding(.vertical, 7)
                                        .background(
                                            damageType == type.id
                                                ? Color(hex: type.colour) : Brand.surfaceRaised,
                                            in: .rect(cornerRadius: Brand.Radius.pill))
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        Text("Drag the corners in to the damaged part. It opens covering the whole room.")
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                    }
                    .padding(Brand.Space.base)
                    .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))

                    Button(saving ? "Saving…" : "Save area") {
                        saving = true
                        onSave(name.trimmed, damageType, corners)
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
