import SwiftUI

/// The room's ceiling (floor-plan spec §11, M6): flat, sloped, vaulted, or
/// flat with zones at their own heights.
///
/// Every shape is entered against the room's own WALLS — the low wall and
/// the high wall of a slope, the wall a ridge runs parallel to, the wall a
/// bulkhead runs along — because that is how a ceiling is described on site
/// ("it drops to seven foot over the cabinets") and because a shape tied to
/// walls follows the room when a corner is dragged afterwards.
///
/// The figures underneath are worked out live from the same core that saves
/// them, so what he reads here is what the estimate gets.
struct CeilingSheet: View {
    typealias Record = ScanGeometry.CeilingRecord

    let corners: [CGPoint]
    let bulges: [Double]
    /// The room's height as it stands, for a flat ceiling and as the start
    /// for every other kind.
    let flatHeight: Double
    let current: Record?
    let apply: (Record) -> Void

    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var units = UnitSettings.shared

    private enum Kind: String, CaseIterable, Identifiable {
        case flat, sloped, vaulted, zones
        var id: String { rawValue }
        var label: String {
            switch self {
            case .flat: return "Flat"
            case .sloped: return "Sloped"
            case .vaulted: return "Vaulted"
            case .zones: return "Bulkheads"
            }
        }
    }

    @State private var kind: Kind = .flat
    @State private var height = ""
    @State private var low = ""
    @State private var high = ""
    @State private var lowEdge = 0
    @State private var highEdge = 0
    @State private var eave = ""
    @State private var ridge = ""
    @State private var ridgeEdge = 0
    @State private var strips: [StripRow] = []

    struct StripRow: Identifiable, Equatable {
        let id = UUID()
        var edge: Int
        var depth: String
        var height: String
    }

    private var format: LengthFormat { units.format }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Ceiling", selection: $kind) {
                        ForEach(Kind.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }

                switch kind {
                case .flat:
                    Section { field("Height", $height) }
                case .sloped:
                    Section {
                        wallPicker("Low side", $lowEdge)
                        field("Height there", $low)
                        wallPicker("High side", $highEdge)
                        field("Height there", $high)
                    } footer: {
                        Text("The ceiling rises in a straight slope from the low wall to the wall across from it.")
                    }
                case .vaulted:
                    Section {
                        wallPicker("Ridge runs along", $ridgeEdge)
                        field("Ridge height", $ridge)
                        field("Height at the walls", $eave)
                    } footer: {
                        Text("Two slopes meeting at a ridge down the middle of the room, parallel to the wall you pick.")
                    }
                case .zones:
                    Section { field("Ceiling height", $height) }
                    ForEach($strips) { $strip in
                        Section {
                            wallPicker("Along", $strip.edge)
                            field("Comes out", $strip.depth)
                            field("Drops to", $strip.height)
                            Button("Remove", role: .destructive) { strips.removeAll { $0.id == strip.id } }
                        }
                    }
                    Section {
                        Button("Add a bulkhead or soffit") {
                            strips.append(StripRow(edge: 0, depth: format.format(0.6), height: format.format(max(flatHeight - 0.3, 1))))
                        }
                    } footer: {
                        Text("A lower strip along a wall — over kitchen cabinets, around a beam or a duct.")
                    }
                }

                Section("Measures") {
                    if let problem {
                        Text(problem).foregroundStyle(.red)
                    } else if let figures {
                        row("Volume", "\(Int((figures.volumeCbm * 35.3147).rounded())) cu ft")
                        row("Wall area", Measure.sqftLabel(figures.grossWallSqm))
                        row("Ceiling area", Measure.sqftLabel(figures.ceilingSurfaceSqm))
                        row(
                            "Height",
                            abs(figures.maxHeightM - figures.minHeightM) < 0.005
                                ? format.format(figures.minHeightM)
                                : "\(format.format(figures.minHeightM)) – \(format.format(figures.maxHeightM))")
                    } else {
                        Text("Fill in every height.").foregroundStyle(Brand.inkSoft)
                    }
                }
            }
            .navigationTitle("Ceiling")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Apply") {
                        guard let record, problem == nil else { return }
                        apply(record)
                        dismiss()
                    }
                    .bold()
                    .disabled(record == nil || problem != nil)
                }
            }
            .onAppear(perform: load)
        }
    }

    // MARK: - The record being built

    private var record: Record? {
        func p(_ s: String) -> Double? { format.parse(s).flatMap { $0 > 0 ? $0 : nil } }
        switch kind {
        case .flat:
            return p(height).map { Record.flat($0) }
        case .sloped:
            guard let l = p(low), let h = p(high) else { return nil }
            return Record(kind: "sloped", low: l, high: h, lowEdge: lowEdge, highEdge: highEdge)
        case .vaulted:
            guard let e = p(eave), let r = p(ridge) else { return nil }
            return Record(kind: "vaulted", eave: e, ridge: r, ridgeEdge: ridgeEdge)
        case .zones:
            guard let base = p(height) else { return nil }
            var made: [Record.Strip] = []
            for s in strips {
                guard let d = p(s.depth), let h = p(s.height) else { return nil }
                made.append(Record.Strip(edge: s.edge, depth: d, height: h))
            }
            return Record(kind: "zones", height: base, strips: made)
        }
    }

    private var figures: ScanGeometry.CeilingFigures? {
        record.flatMap { PlanBridge.ceilingFigures(corners, bulges: bulges, ceiling: $0, flat: flatHeight) }
    }

    private var problem: String? {
        guard let record else { return nil }
        if record.kind == "sloped", record.lowEdge == record.highEdge {
            return "The high side has to be a different wall from the low side."
        }
        return PlanBridge.ceilingProblem(corners, bulges: bulges, ceiling: record, flat: flatHeight)
    }

    private func load() {
        let f = { (v: Double?) in format.format(v ?? flatHeight) }
        height = f(current?.height)
        low = f(current?.low)
        high = f(current?.high ?? flatHeight + 0.6)
        eave = f(current?.eave)
        ridge = f(current?.ridge ?? flatHeight + 1.2)
        lowEdge = current?.lowEdge ?? 0
        highEdge = current?.highEdge ?? opposite(of: 0)
        ridgeEdge = current?.ridgeEdge ?? longestEdge
        strips = (current?.strips ?? []).map {
            StripRow(edge: $0.edge, depth: format.format($0.depth), height: format.format($0.height))
        }
        kind = Kind(rawValue: current?.kind ?? "flat") ?? .flat
    }

    // MARK: - Walls

    private func length(_ i: Int) -> Double {
        let a = corners[i], b = corners[(i + 1) % corners.count]
        return hypot(b.x - a.x, b.y - a.y)
    }

    private var longestEdge: Int { corners.indices.max { length($0) < length($1) } ?? 0 }

    /// The wall most nearly facing wall i from across the room.
    private func opposite(of i: Int) -> Int {
        let n = corners.count
        guard n >= 3 else { return 0 }
        func dir(_ k: Int) -> CGPoint {
            let a = corners[k], b = corners[(k + 1) % n]
            let l = max(hypot(b.x - a.x, b.y - a.y), 1e-9)
            return CGPoint(x: (b.x - a.x) / l, y: (b.y - a.y) / l)
        }
        let d = dir(i)
        // Anti-parallel, and the longest such, is "the wall across the room".
        return corners.indices.filter { $0 != i }.max { a, b in
            let da = dir(a), db = dir(b)
            let sa = -(da.x * d.x + da.y * d.y), sb = -(db.x * d.x + db.y * d.y)
            return sa == sb ? length(a) < length(b) : sa < sb
        } ?? (i + 1) % n
    }

    private func wallPicker(_ label: String, _ selection: Binding<Int>) -> some View {
        Picker(label, selection: selection) {
            ForEach(corners.indices, id: \.self) { i in
                Text("Wall \(i + 1) · \(format.format(length(i)))").tag(i)
            }
        }
    }

    private func field(_ label: String, _ text: Binding<String>) -> some View {
        HStack {
            Text(label)
            Spacer()
            TextField("—", text: text)
                .keyboardType(.numbersAndPunctuation)
                .multilineTextAlignment(.trailing)
                .frame(width: 120)
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
            Spacer()
            Text(value).foregroundStyle(Brand.inkSoft)
        }
    }
}
