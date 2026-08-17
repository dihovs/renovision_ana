import SwiftUI

/// The whole property in numbers.
///
/// The Swift twin of `src/lib/crm/projectStatistics.ts` — same rows, same
/// arithmetic, same two departures from the reference:
///
/// **Volume is promoted.** The reference lists it last, as trivia. Drying is
/// sized from cubic footage under IICRC S500, so here it sits with the
/// measurements an estimate is built from, and it is stated in cubic feet
/// because that is the unit a dehumidifier's coverage is published in.
///
/// **The three ground-surface variants are absent.** The reference reports
/// ground surface "with all walls", "with interior walls" and "without walls".
/// Those need the thickness of every wall and which side belongs to which
/// room. A scan gives wall faces, not wall assemblies. Computing them would
/// mean inventing a thickness and printing the result as a measurement — one
/// honest floor area, defined, beats three fabricated ones.
enum ProjectStats {
    struct Row: Identifiable {
        let id: String
        let label: String
        let value: String
        /// Counts have no definition — "how many doors" needs no defending.
        let meaning: MeasureDefinition?
    }

    static func cubicFeet(_ cubicMetres: Double) -> Double { cubicMetres * 35.314_666_7 }

    /// Guards every figure. A scan held offline, or a room mid-edit, can
    /// arrive with a hole in it, and one bad room must not turn the whole
    /// sheet into "nan sq ft".
    private static func sum(_ rooms: [RoomScan], _ pick: (RoomScan) -> Double) -> Double {
        rooms.reduce(0) { total, room in
            let value = pick(room)
            return total + (value.isFinite ? value : 0)
        }
    }

    /// Gross wall area: perimeter × ceiling height, the same definition the
    /// room sheet and the report already use.
    static func grossWallSqm(_ rooms: [RoomScan]) -> Double {
        sum(rooms) { $0.wallLengthM * $0.ceilingHeightM }
    }

    static func floorAreaSqm(_ rooms: [RoomScan]) -> Double { sum(rooms) { $0.floorAreaSqm } }
    static func perimeterM(_ rooms: [RoomScan]) -> Double { sum(rooms) { $0.wallLengthM } }

    /// Summed PER ROOM. A basement and a stairwell have different ceilings,
    /// and multiplying one blended height by the total floor area describes
    /// neither of them.
    static func volumeCbm(_ rooms: [RoomScan]) -> Double {
        sum(rooms) { $0.floorAreaSqm * $0.ceilingHeightM }
    }

    static func volumeLabel(_ rooms: [RoomScan]) -> String {
        "\(Int(cubicFeet(volumeCbm(rooms)).rounded()))"
    }

    static func summary(_ rooms: [RoomScan]) -> [Row] {
        // Distinct storeys, not rooms-with-a-level: three rooms on the ground
        // floor are one floor.
        let floors = Set(rooms.map(\.level).filter { !$0.isEmpty }).count
        return [
            Row(id: "floors", label: "Floors", value: "\(floors)", meaning: nil),
            Row(id: "rooms", label: "Rooms", value: "\(rooms.count)", meaning: nil),
            Row(id: "doors", label: "Doors",
                value: "\(rooms.reduce(0) { $0 + $1.doorCount })", meaning: nil),
            Row(id: "windows", label: "Windows",
                value: "\(rooms.reduce(0) { $0 + $1.windowCount })", meaning: nil),
            Row(id: "stairs", label: "Stairs",
                value: "\(rooms.reduce(0) { $0 + $1.stairCount })", meaning: nil),
        ]
    }

    static func measurements(_ rooms: [RoomScan]) -> [Row] {
        [
            Row(id: "floorArea", label: "Floor area",
                value: Measure.sqftLabel(floorAreaSqm(rooms)), meaning: .floorArea),
            Row(id: "wallArea", label: "Wall area (gross)",
                value: Measure.sqftLabel(grossWallSqm(rooms)), meaning: .wallArea),
            Row(id: "perimeter", label: "Perimeter",
                value: Measure.ftLabel(perimeterM(rooms)), meaning: .perimeter),
            Row(id: "volume", label: "Volume",
                value: "\(volumeLabel(rooms)) cu ft", meaning: .volume),
        ]
    }
}

/// Three figures and a room count across the top of a project — how big is
/// this job, answered before you have scrolled into any one room.
///
/// Built from `DefinedFigure`, so every number carries its ⓘ and reads the
/// same as the ones on the room sheet.
struct ProjectStatisticsBand: View {
    let rooms: [RoomScan]
    var onSeeAll: () -> Void

    var body: some View {
        VStack(spacing: Brand.Space.hair) {
            Button(action: onSeeAll) {
                SectionHeading(title: "STATISTICS", trailing: "See all")
            }
            .buttonStyle(.plain)

            Card(padding: Brand.Space.small) {
                // Floor area, wall area and volume are what an estimate starts
                // from. Perimeter and the counts live behind `See all` —
                // beyond three figures plus scale, none of them stay readable
                // at this width.
                HStack(alignment: .top, spacing: Brand.Space.small) {
                    DefinedFigure(
                        value: Measure.sqftLabel(ProjectStats.floorAreaSqm(rooms)),
                        unit: nil, meaning: .floorArea)
                    DefinedFigure(
                        value: Measure.sqftLabel(ProjectStats.grossWallSqm(rooms)),
                        unit: "gross", meaning: .wallArea)
                    DefinedFigure(
                        value: ProjectStats.volumeLabel(rooms),
                        unit: "cu ft", meaning: .volume)
                }
            }
        }
    }
}

/// Every figure, with the definition behind it — the reference's own idea,
/// and a good one: an ⓘ on each row means no number is taken on faith.
struct ProjectStatisticsSheet: View {
    let rooms: [RoomScan]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Summary") {
                    ForEach(ProjectStats.summary(rooms)) { StatisticRowView(row: $0) }
                }
                Section("Measurements") {
                    ForEach(ProjectStats.measurements(rooms)) { StatisticRowView(row: $0) }
                }
                Section {
                    Text("""
                        Every measurement here is taken to the wall faces the scan detected. \
                        Where an outline was corrected by hand, the corrected outline is what \
                        was measured.
                        """)
                        .font(.footnote)
                        .foregroundStyle(Brand.inkFaint)
                }
            }
            .navigationTitle("Statistics")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

/// One figure and its ⓘ. Shared with the room-level sheet — the definition
/// popover must read identically wherever a number is shown, which is the
/// whole point of having definitions.
struct StatisticRowView: View {
    let row: ProjectStats.Row
    @State private var showing = false

    var body: some View {
        HStack(spacing: Brand.Space.hair) {
            Text(row.label).foregroundStyle(Brand.ink)
            if row.meaning != nil {
                Image(systemName: "info.circle")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.blue)
            }
            Spacer()
            Text(row.value)
                .monospacedDigit()
                .foregroundStyle(Brand.inkSoft)
        }
        .contentShape(Rectangle())
        .onTapGesture { if row.meaning != nil { showing = true } }
        .popover(isPresented: $showing) {
            if let meaning = row.meaning {
                VStack(alignment: .leading, spacing: Brand.Space.small) {
                    Text(meaning.title)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Brand.ink)
                    Text(meaning.definition)
                        .font(.system(size: 14))
                        .foregroundStyle(Brand.inkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(Brand.Space.base)
                .frame(width: 300)
                .presentationCompactAdaptation(.popover)
            }
        }
    }
}
