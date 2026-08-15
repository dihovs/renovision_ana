import SwiftUI

/// One room, inspected in place — a sheet over the storey canvas, not a
/// screen that replaces it.
///
/// The reference's strongest structural idea (spec §6.1, INT-E23): every
/// entity gets the same swipe-up, multi-detent inspector with the same fixed
/// tabs, and the plan stays visible behind it. Losing sight of the drawing to
/// read a number about the drawing is the thing being fixed — at the medium
/// detent the storey canvas is still there above this sheet, and tapping a
/// sibling room on it swaps the inspector rather than stacking a screen.
///
/// Three tabs, fixed order, the same for every room — an inspector whose
/// tabs move around is one the thumb cannot learn. Where magicplan's third
/// tab is "Forms", ours is "Damage & Drying": this trade's forms ARE the
/// damage record, and the adjuster who reads it is the reason it exists.
struct RoomDetailView: View {
    let room: RoomScan

    /// The fixed tab set. Raw values are the segment labels.
    private enum Tab: String, CaseIterable, Identifiable {
        case details = "Details"
        case damage = "Damage & Drying"
        case photos = "Photos & Notes"
        var id: String { rawValue }
    }

    @Environment(\.dismiss) private var dismiss

    @State private var tab = Tab.details
    @State private var areas: [AffectedArea] = []
    @State private var readings: [MoistureReading] = []
    @State private var loading = true
    @State private var error: String?
    @State private var drawing = false
    @State private var logging = false
    @State private var editingPlan = false
    @State private var pickingType = false
    /// The area whose inspector is open — rename, notes, and whether its
    /// dimensions print on the elevation.
    @State private var editingArea: AffectedArea?
    @State private var roomTypes: [LivingRoomType] = []
    @State private var chosenType: String?
    @State private var pickingFloor = false
    @State private var chosenLevel = ""
    @State private var chosenColor: String?
    @State private var savingRoomField = false

    /// Floor and wall damage, kept apart all the way to the screen.
    ///
    /// Not a presentational nicety: stripping out 40 sq ft of wet subfloor
    /// and stripping 40 sq ft of mouldy drywall are different trades at
    /// different rates, and a single total is a figure no estimator can use
    /// and no adjuster should accept. The surfaces also overlap in plan, so
    /// summing them would double-count the footprint besides.
    private var floorAreas: [AffectedArea] { areas.filter { !$0.isWall } }
    private var wallAreas: [AffectedArea] { areas.filter(\.isWall) }

    private var floorDamagedSqm: Double { floorAreas.reduce(0) { $0 + $1.areaSqm } }
    private var wallDamagedSqm: Double { wallAreas.reduce(0) { $0 + $1.areaSqm } }

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
        VStack(spacing: 0) {
            header

            // A segmented control rather than a navigation bar: at the medium
            // detent every point of chrome comes straight out of the content,
            // and the three-tab strip is the whole identity of the inspector
            // anyway (reference §6.1 — same shell for every entity).
            Picker("Section", selection: $tab) {
                ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, Brand.Space.base)
            .padding(.bottom, Brand.Space.tight)

            List {
                switch tab {
                case .details: detailsTab
                case .damage: damageTab
                case .photos: photosTab
                }

                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .refreshable { await load() }
        }
        .background(Brand.canvas)
        // Medium and large only — no collapsed micro-detent. At medium the
        // storey canvas behind stays visible AND live: background interaction
        // is what lets a tap on a sibling room swap this inspector in place
        // instead of forcing close-then-reopen.
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.enabled(upThrough: .medium))
        .sheet(isPresented: $drawing) {
            if let plan {
                AreaEditor(plan: plan, existing: drawnAreas) { name, type, polygon in
                    Task {
                        _ = try? await API.shared.createArea(
                            roomScanId: room.id, name: name, damageType: type,
                            surface: "floor", polygon: polygon)
                        drawing = false
                        await load()
                    }
                }
            }
        }
        .sheet(isPresented: $pickingType) {
            RoomTypePicker(types: roomTypes, selected: chosenType) { picked in
                chosenType = picked
                pickingType = false
                Task {
                    try? await API.shared.setRoomType(roomId: room.id, type: picked)
                    await load()
                }
            }
        }
        .sheet(isPresented: $editingPlan) {
            PlanEditorView(room: room) { Task { await load() } }
        }
        .sheet(isPresented: $logging) {
            ReadingSheet(roomId: room.id) { Task { await load() } }
        }
        .sheet(item: $editingArea) { area in
            AffectedAreaSheet(area: area) { Task { await load() } }
        }
        .sheet(isPresented: $pickingFloor) {
            FloorPicker(selected: chosenLevel) { picked in
                chosenLevel = picked
                pickingFloor = false
                Task { await saveRoomLevel(picked) }
            }
        }
        .task { await load() }
    }

    /// Name, where it is, how big it is, and a way out. The room name used to
    /// be a navigation title; a sheet has no bar, so the identity moves here —
    /// and the level joins it, because with the push gone there is no parent
    /// screen on view to say which storey this room belongs to at large detent.
    private var header: some View {
        HStack(spacing: Brand.Space.small) {
            VStack(alignment: .leading, spacing: 1) {
                Text(room.name)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Brand.ink)
                    .lineLimit(1)
                Text("\(room.level) · \(Measure.sqftLabel(room.floorAreaSqm))")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkFaint)
            }
            Spacer()
            // The grabber already dismisses; the button is for the thumb that
            // is at the bottom of a large-detent sheet and not going to drag.
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 24))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(Brand.inkFaint)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.top, Brand.Space.base)
        .padding(.bottom, Brand.Space.small)
    }

    // MARK: - Details

    /// What the room IS: its drawing, its figures, its classification.
    @ViewBuilder private var detailsTab: some View {
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
                // Baseboard beside the perimeter it is derived from, so the
                // shorter number is obviously the trim one rather than looking
                // like a contradiction. Falls back to the perimeter when there
                // is no geometry to read doorways out of — equal, not absent,
                // because a room with no detected doors genuinely has no
                // deduction.
                DefinedFigure(
                    value: Measure.ftLabel(room.geometry?.baseboardLengthM ?? room.wallLengthM),
                    unit: nil, meaning: .baseboard)
                DefinedFigure(
                    value: Measure.cuftLabel(room.floorAreaSqm * room.ceilingHeightM),
                    unit: nil, meaning: .volume)
            }
            .listRowInsets(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
        }

        Section {
            Button {
                pickingType = true
            } label: {
                HStack {
                    Text("Room type")
                        .foregroundStyle(Brand.ink)
                    Spacer()
                    Text(typeLabel)
                        .foregroundStyle(chosenType == nil ? Brand.inkFaint : Brand.blue)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Brand.inkFaint)
                }
                .font(.system(size: 15))
            }
            .buttonStyle(.plain)
        } footer: {
            if let note = roomTypes.first(where: { $0.id == chosenType })?.note {
                Text(note).font(.system(size: 11)).foregroundStyle(Brand.inkSoft)
            } else {
                Text("Decides how much of this room counts as living area — the figure coverage is quoted against.")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.inkFaint)
            }
        }

        Section {
            Button {
                pickingFloor = true
            } label: {
                HStack {
                    Text("Floor")
                        .foregroundStyle(Brand.ink)
                    Spacer()
                    Text(FloorVocabulary.levels.first { $0.id == chosenLevel }?.label ?? chosenLevel)
                        .foregroundStyle(Brand.blue)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Brand.inkFaint)
                }
                .font(.system(size: 15))
            }
            .buttonStyle(.plain)
            .disabled(savingRoomField)

            // The plan's ordinary grey by default; a swatch says "this room,
            // deliberately" the way a highlighter does on a paper drawing.
            // The circle with a slash is the way back to no colour at all —
            // clearing a choice needs its own target, not just picking
            // nothing.
            VStack(alignment: .leading, spacing: Brand.Space.tight) {
                Text("Colour on the plan")
                    .font(.system(size: 15))
                    .foregroundStyle(Brand.ink)
                HStack(spacing: 10) {
                    swatch(nil)
                    ForEach(Self.roomColors, id: \.self) { hex in
                        swatch(hex)
                    }
                }
            }
            .padding(.vertical, 2)
        } footer: {
            Text("Separate from damage colouring — this is the room itself, on the floor sheet.")
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
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
    }

    // MARK: - Damage & Drying

    /// What is WRONG with the room and the proof it is being fixed. The order
    /// is the order the work happens in: the damage is marked first because
    /// the estimate is priced from it, then the drying record — the part
    /// magicplan's own report has no room for at all.
    @ViewBuilder private var damageTab: some View {
        Section {
            if loading {
                ProgressView()
            } else if areas.isEmpty {
                Text("Nothing marked. The wet, burnt or mouldy part of this room is the figure an estimate is priced from.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            } else {
                // Floor first, then the walls in wall order — the order the
                // work is scoped in, and the order the two totals in the
                // header are read in.
                ForEach(floorAreas) { area in
                    areaRow(area, where: "Floor")
                }
                ForEach(wallAreas.sorted { ($0.wallIndex ?? 0) < ($1.wallIndex ?? 0) }) { area in
                    areaRow(area, where: "Wall \((area.wallIndex ?? 0) + 1)")
                }
            }
            if plan != nil && !(plan?.isEmpty ?? true) {
                Button {
                    drawing = true
                } label: {
                    Label("Add a floor area", systemImage: "plus.circle.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Brand.blue)
                }
            }
        } header: {
            HStack {
                Text("Affected areas")
                Spacer()
                if !areas.isEmpty {
                    // Two figures, never one. Which surface a square foot is
                    // on decides what it costs to put right.
                    Text(damageTotals).font(.caption.monospacedDigit())
                }
            }
        } footer: {
            if wallAreas.isEmpty {
                Text("Wall damage is marked in elevation — open the plan, face a wall, and outline it there.")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.inkFaint)
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
    }

    /// One marked region: its cause's colour, its name, and where it is.
    /// The surface is stated on the row rather than implied by a grouping
    /// header, because these rows end up read one at a time.
    private func areaRow(_ area: AffectedArea, where place: String) -> some View {
        Button {
            editingArea = area
        } label: {
            HStack {
                Circle()
                    .fill(area.displayColor)
                    .frame(width: 10, height: 10)
                VStack(alignment: .leading, spacing: 1) {
                    Text(area.name)
                        .foregroundStyle(Brand.ink)
                    Text("\(place) · \(area.label)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(Measure.sqftLabel(area.areaSqm))
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
                // A tappable row that does not look tappable is a row nobody
                // taps. The chevron is the only signal; the row itself still
                // reads exactly as it did before.
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.inkFaint)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    private var damageTotals: String {
        var parts: [String] = []
        if floorDamagedSqm > 0 { parts.append("Floor \(Measure.sqftLabel(floorDamagedSqm))") }
        if wallDamagedSqm > 0 { parts.append("Wall \(Measure.sqftLabel(wallDamagedSqm))") }
        return parts.joined(separator: " · ")
    }

    // MARK: - Photos & Notes

    /// The evidence. Photos only for now: room notes live in the web's
    /// RoomEvidence panel and there is no native endpoint for them yet —
    /// when one exists it belongs in this tab, under the photos, not on a
    /// fourth tab (the tab set is fixed; reference §6.1).
    @ViewBuilder private var photosTab: some View {
        if let projectId = room.projectId {
            RoomPhotosSection(projectId: projectId, roomScanId: room.id)
        } else {
            // A scan not yet attached to a project has nowhere to file a
            // photo. Said plainly rather than showing a camera that fails.
            Section {
                Text("This room is not attached to a project yet, so photos have nowhere to file.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Derived

    private var typeLabel: String {
        guard let chosenType else { return "Not set" }
        return roomTypes.first { $0.id == chosenType }?.label ?? chosenType
    }

    /// Distinct from `DamageCause`'s palette on purpose: a room highlighted
    /// teal must never read as if it were marked for water damage.
    private static let roomColors: [UInt32] = [0x2FB6A8, 0x5B6FE0, 0xE0587F, 0xE8A93A, 0x7A8599]

    /// The `#rrggbb` a swatch is stored and compared as — `DamageCause
    /// .hexString`'s exact format, lower case, so a colour written from the
    /// phone matches one written from the web byte for byte.
    private static func hexString(_ value: UInt32) -> String { String(format: "#%06x", value) }

    /// One swatch. `nil` is "no colour" — its own circle with a slash, not
    /// merely the absence of a selected one, because clearing a choice needs
    /// somewhere to tap exactly as much as making one does.
    private func swatch(_ value: UInt32?) -> some View {
        let hex = value.map(Self.hexString)
        let selected = chosenColor == hex
        return Button {
            guard !savingRoomField else { return }
            chosenColor = hex
            Task { await saveRoomColor(hex) }
        } label: {
            ZStack {
                Circle()
                    .fill(value.map { Color(hex: $0) } ?? Brand.Plan.floorMuted)
                if value == nil {
                    Image(systemName: "slash.circle")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Brand.inkFaint)
                }
            }
            .frame(width: 26, height: 26)
            .overlay(
                Circle().strokeBorder(selected ? Brand.blue : .clear, lineWidth: 2.5)
                    .padding(-3))
        }
        .buttonStyle(.plain)
    }

    /// The plan, computed once from the stored geometry.
    private var plan: FloorPlanGeometry.Plan? {
        guard let geometry = room.geometry else { return nil }
        return FloorPlanGeometry.plan(from: geometry)
    }

    /// Areas in the plan's own coordinates, ready to draw.
    ///
    /// FLOOR ONLY, and that filter is load-bearing. A wall area's polygon is
    /// in its wall's face space — distance along the wall by height above the
    /// floor — so drawing one on the plan would put a rectangle somewhere in
    /// the room bearing no relation to the damage. Wall areas are drawn where
    /// they were measured, in `ElevationView`.
    private var drawnAreas: [(polygon: [CGPoint], colour: Color)] {
        floorAreas.compactMap { area in
            guard area.polygon.count >= 3 else { return nil }
            return (area.polygon.map { CGPoint(x: $0.x, y: $0.y) }, area.displayColor)
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

        // The type list and the room's own type. Fetched from the project's
        // living-area endpoint so the labels and rules are the server's, not
        // a second copy drifting in the app.
        if chosenType == nil { chosenType = room.roomType }
        if chosenLevel.isEmpty { chosenLevel = room.level }
        if chosenColor == nil { chosenColor = room.roomColor }
        if roomTypes.isEmpty, let projectId = room.projectId {
            roomTypes = (try? await API.shared.livingArea(projectId: projectId).roomTypes) ?? []
        }
        loading = false
    }

    /// The measurements travel with the room; only which floor sheet it
    /// files under changes. A failed save reverts the picker to the room's
    /// own level rather than leaving the UI claiming a move that did not
    /// happen — the same "optimistic, then honest" pattern the type picker
    /// already follows.
    private func saveRoomLevel(_ level: String) async {
        savingRoomField = true
        do {
            try await API.shared.moveRoom(roomId: room.id, toLevel: level)
        } catch {
            chosenLevel = room.level
            self.error = error.localizedDescription
        }
        savingRoomField = false
    }

    private func saveRoomColor(_ hex: String?) async {
        savingRoomField = true
        do {
            try await API.shared.setRoomColor(roomId: room.id, hex: hex)
        } catch {
            chosenColor = room.roomColor
            self.error = error.localizedDescription
        }
        savingRoomField = false
    }
}

/// One affected area's inspector — its name, a note about it, and whether it
/// gets dimensioned on the wall elevation. Reshaping and recolouring stay
/// where they already work well: the drag on the elevation face, and the web
/// editor. This sheet is the surface for the fields that have no home yet.
struct AffectedAreaSheet: View {
    let area: AffectedArea
    let onChanged: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var notes: String
    @State private var showDimensions: Bool
    @State private var saving = false
    @State private var confirmingDelete = false
    @State private var error: String?

    init(area: AffectedArea, onChanged: @escaping () -> Void) {
        self.area = area
        self.onChanged = onChanged
        _name = State(initialValue: area.name)
        _notes = State(initialValue: area.notes ?? "")
        _showDimensions = State(initialValue: area.showDimensions)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.base) {
                        HStack {
                            Circle()
                                .fill(area.displayColor)
                                .frame(width: 12, height: 12)
                            Text(area.isWall ? "On the wall" : "On the floor")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Brand.inkSoft)
                            Spacer()
                            Text(Measure.sqftLabel(area.areaSqm))
                                .font(.system(size: 13, weight: .bold).monospacedDigit())
                                .foregroundStyle(Brand.inkFaint)
                        }

                        Field(label: "NAME", text: $name, placeholder: "Affected area")

                        VStack(alignment: .leading, spacing: Brand.Space.tight) {
                            Text("NOTES")
                                .font(.system(size: 10, weight: .heavy))
                                .foregroundStyle(Brand.inkFaint)
                            TextField(
                                "What's here, what was already cut back — whatever the next visit needs to know.",
                                text: $notes, axis: .vertical
                            )
                            .lineLimit(3...6)
                            .padding(Brand.Space.small)
                            .background(Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.tile))
                        }

                        // Only meaningful on a wall — a floor area has no
                        // elevation to print its dimensions on.
                        if area.isWall {
                            Toggle(isOn: $showDimensions) {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text("Show dimensions")
                                        .foregroundStyle(Brand.ink)
                                    Text("Print this area's width and height on the wall elevation.")
                                        .font(.system(size: 11))
                                        .foregroundStyle(Brand.inkFaint)
                                }
                            }
                            .tint(Brand.blue)
                        }

                        if let error {
                            Text(error).font(.footnote).foregroundStyle(.red)
                        }

                        Button(saving ? "Saving…" : "Save") {
                            Task { await save() }
                        }
                        .buttonStyle(PrimaryButtonStyle(enabled: !saving))
                        .disabled(saving)

                        Button("Delete this area", role: .destructive) {
                            confirmingDelete = true
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity)
                    }
                    .padding(Brand.Space.base)
                }
            }
            .navigationTitle(area.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
            .confirmationDialog(
                "Delete \(area.name)?",
                isPresented: $confirmingDelete, titleVisibility: .visible
            ) {
                Button("Delete area", role: .destructive) { Task { await delete() } }
                Button("Keep it", role: .cancel) {}
            } message: {
                Text("Its measurement, note and dimension setting go with it. This cannot be undone.")
            }
        }
    }

    private func save() async {
        saving = true
        error = nil
        do {
            try await API.shared.updateArea(
                id: area.id,
                name: name.trimmed.isEmpty ? nil : name.trimmed,
                notes: notes.trimmed,
                showDimensions: showDimensions)
            onChanged()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }

    private func delete() async {
        saving = true
        error = nil
        do {
            try await API.shared.deleteArea(id: area.id)
            onChanged()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}

/// Which storey a room files under — `FloorVocabulary`'s own list, in
/// building order, so a basement and an attic are never adjacent by
/// accident of alphabetical sort.
struct FloorPicker: View {
    let selected: String
    let onPick: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(FloorVocabulary.levels.sorted { $0.index > $1.index }, id: \.id) { level in
                    Button {
                        onPick(level.id)
                    } label: {
                        HStack {
                            Text(level.label)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Brand.ink)
                            Spacer()
                            if level.id == selected {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(Brand.blue)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Move to floor")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
        }
    }
}
