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
            Section {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                    Figure("Floor", Measure.sqftLabel(room.floorAreaSqm), "Flooring, underlay")
                    Figure(
                        "Wall area",
                        Measure.sqftLabel(room.wallLengthM * room.ceilingHeightM),
                        "Paint, drywall — gross")
                    Figure("Perimeter", Measure.ftLabel(room.wallLengthM), "Baseboard, trim")
                    Figure(
                        "Ceiling",
                        String(format: "%.1f ft", Measure.feet(room.ceilingHeightM)),
                        "Tallest wall")
                }
                .listRowInsets(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
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
        .task { await load() }
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

    /// Matches DAMAGE_COLOR in areaShapes.ts. Two apps colouring the same
    /// damage differently is a support call.
    private func color(for damageType: String) -> Color {
        switch damageType {
        case "fire": return Color(red: 0.886, green: 0.404, blue: 0.227)
        case "mould": return Color(red: 0.310, green: 0.616, blue: 0.227)
        case "impact": return Color(red: 0.541, green: 0.388, blue: 0.824)
        case "other": return Color(red: 0.541, green: 0.541, blue: 0.557)
        default: return Color(red: 0.169, green: 0.498, blue: 0.831)
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
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.bold().monospacedDigit())
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(hint)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))
    }
}
