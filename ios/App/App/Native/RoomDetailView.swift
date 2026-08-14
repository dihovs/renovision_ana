import SwiftUI

/// One room: what it measures, what is damaged in it, and how it is drying.
///
/// The order is the order the work happens in. Measurements first because
/// everything else is derived from them, then the damage, then the drying
/// record — which is the part an adjuster reads and the part magicplan's own
/// report has no room for at all.
struct RoomDetailView: View {
    let room: RoomScan

    @State private var areas: [AffectedArea] = []
    @State private var readings: [MoistureReading] = []
    @State private var loading = true
    @State private var error: String?
    @State private var drawing = false
    @State private var logging = false
    @State private var editingPlan = false

    private var damagedSqm: Double { areas.reduce(0) { $0 + $1.areaSqm } }

    /// Oldest and newest material readings — the sentence an adjuster actually
    /// reads, stated once rather than left to be inferred from a table.
    private var trend: (from: Double, to: Double)? {
        let measured = readings.compactMap { r -> (Date, Double)? in
            guard let v = r.materialPercent else { return nil }
            return (r.takenAt, v)
        }
        .sorted { $0.0 < $1.0 }
        guard measured.count >= 2, let first = measured.first, let last = measured.last else {
            return nil
        }
        return (first.1, last.1)
    }

    var body: some View {
        List {
            if let plan, !plan.isEmpty {
                Section {
                    FloorPlanView(
                        plan: plan, areas: drawnAreas,
                        label: (room.name, Int(Measure.squareFeet(room.floorAreaSqm).rounded()))
                    )
                    .frame(height: 240)
                        .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                        .listRowBackground(Brand.surface)

                    Button {
                        editingPlan = true
                    } label: {
                        Label("Adjust the plan", systemImage: "pencil.and.ruler")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Brand.blue)
                    }
                } footer: {
                    if room.geometry?.editedPolygon != nil {
                        Label(
                            "Adjusted by hand. The scan's own measurements are kept underneath.",
                            systemImage: "hand.draw")
                            .font(.system(size: 11))
                            .foregroundStyle(.orange)
                    }
                }
            }

            Section {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                    // Every figure states what it means — an adjuster who
                    // cannot tell which definition a number used is an
                    // adjuster who can discount it.
                    DefinedFigure(
                        value: Measure.sqftLabel(room.floorAreaSqm), unit: nil,
                        meaning: .floorArea)
                    DefinedFigure(
                        value: Measure.sqftLabel(room.wallLengthM * room.ceilingHeightM),
                        unit: "gross", meaning: .wallArea)
                    DefinedFigure(
                        value: Measure.ftLabel(room.wallLengthM), unit: nil, meaning: .perimeter)
                    DefinedFigure(
                        value: String(format: "%.1f ft", Measure.feet(room.ceilingHeightM)),
                        unit: nil, meaning: .ceiling)
                }
                .listRowInsets(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
            }

            if let projectId = room.projectId {
                RoomPhotosSection(projectId: projectId, roomScanId: room.id)
            }

            Section {
                LabeledContent("Doors", value: "\(room.doorCount)")
                LabeledContent("Windows", value: "\(room.windowCount)")
                if room.stairCount > 0 {
                    LabeledContent("Staircases", value: "\(room.stairCount)")
                    Text("Treads and risers are not in the floor area above — price them separately.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Section {
                if loading {
                    ProgressView()
                } else if areas.isEmpty {
                    Text("Nothing marked. The wet, burnt or mouldy part of this room is the figure an estimate is priced from.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(areas) { area in
                        HStack {
                            Circle()
                                .fill(color(for: area.damageType))
                                .frame(width: 10, height: 10)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(area.name)
                                Text(area.label).font(.caption2).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(Measure.sqftLabel(area.areaSqm))
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                if plan != nil && !(plan?.isEmpty ?? true) {
                    Button {
                        drawing = true
                    } label: {
                        Label("Add a new area", systemImage: "plus.circle.fill")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Brand.blue)
                    }
                }
            } header: {
                HStack {
                    Text("Affected areas")
                    Spacer()
                    if !areas.isEmpty {
                        Text(Measure.sqftLabel(damagedSqm)).font(.caption.monospacedDigit())
                    }
                }
            }

            Section {
                if readings.isEmpty && !loading {
                    Text("No readings. One per visit, trending down, is what proves the drying was needed and when it could stop.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(readings) { reading in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(reading.location.isEmpty ? (reading.material ?? "Reading") : reading.location)
                                    .font(.subheadline.weight(.medium))
                                Spacer()
                                Text(reading.takenAt, format: .dateTime.month(.abbreviated).day())
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            HStack(spacing: 10) {
                                if let mc = reading.materialPercent {
                                    Text("\(Int(mc))% MC").font(.caption.bold().monospacedDigit())
                                }
                                if let rh = reading.relativeHumidity {
                                    Text("\(Int(rh))% RH").font(.caption.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                                if let t = reading.temperatureC {
                                    Text("\(Int(t))°C").font(.caption.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
                Button {
                    logging = true
                } label: {
                    Label("Log a reading", systemImage: "plus.circle.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Brand.blue)
                }
            } header: {
                HStack {
                    Text("Moisture")
                    Spacer()
                    if let trend {
                        Text("\(Int(trend.from))% → \(Int(trend.to))%")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(trend.to < trend.from ? .green : .secondary)
                    }
                }
            }

            if let error {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            }
        }
        .navigationTitle(room.name)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .sheet(isPresented: $drawing) {
            if let plan {
                AreaEditor(plan: plan, existing: drawnAreas) { name, type, polygon in
                    Task {
                        try? await API.shared.createArea(
                            roomScanId: room.id, name: name, damageType: type, polygon: polygon)
                        drawing = false
                        await load()
                    }
                }
            }
        }
        .sheet(isPresented: $editingPlan) {
            PlanEditorView(room: room) { Task { await load() } }
        }
        .sheet(isPresented: $logging) {
            ReadingSheet(roomId: room.id) { Task { await load() } }
        }
        .task { await load() }
    }

    /// The plan, computed once from the stored geometry.
    private var plan: FloorPlanGeometry.Plan? {
        guard let geometry = room.geometry else { return nil }
        return FloorPlanGeometry.plan(from: geometry)
    }

    /// Areas in the plan's own coordinates, ready to draw.
    private var drawnAreas: [(polygon: [CGPoint], colour: Color)] {
        areas.compactMap { area in
            guard area.polygon.count >= 3 else { return nil }
            return (area.polygon.map { CGPoint(x: $0.x, y: $0.y) }, color(for: area.damageType))
        }
    }

    private func load() async {
        loading = true
        // Independent of each other: a room can have damage marked and no
        // readings yet, and one failing must not blank the other.
        async let a = API.shared.areas(roomScanId: room.id)
        async let m = API.shared.moisture(roomScanId: room.id)
        areas = (try? await a) ?? []
        readings = (try? await m) ?? []
        loading = false
    }

    /// Exactly DAMAGE_COLOR from areaShapes.ts. Two apps colouring the same
    /// damage differently is a support call, so these are the hex values from
    /// that file rather than anything re-picked to suit the native palette.
    private func color(for damageType: String) -> Color {
        switch damageType {
        case "fire": return Color(hex: 0xE2673A)
        case "mould": return Color(hex: 0x4F9D3A)
        case "impact": return Color(hex: 0x8A63D2)
        case "other": return Color(hex: 0x8A8A8E)
        default: return Color(hex: 0x2B7FD4)
        }
    }
}

private struct Figure: View {
    let label: String
    let value: String
    let hint: String

    init(_ label: String, _ value: String, _ hint: String) {
        self.label = label
        self.value = value
        self.hint = hint
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.3)
                .foregroundStyle(Brand.inkFaint)
            Text(value)
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Brand.ink)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            // What the figure is FOR. A number on its own is a fact; a number
            // with the trade it prices is a decision.
            Text(hint)
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Brand.Space.small)
        .background(Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.tile))
    }
}
