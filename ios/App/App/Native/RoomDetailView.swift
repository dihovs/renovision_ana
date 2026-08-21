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
/// tabs move around is one the thumb cannot learn.
///
/// The set is the reference's: `Details · Photos & Notes · Forms`
/// (object-model §2, §2d). Damage used to be a tab of its own here, and the
/// owner's correction was specific: *"Damage and drying shouldn't be here. It
/// should appear when we push up more, and there we have to have add areas."*
/// So affected areas sit **inside Details**, reached by scrolling, exactly
/// where the reference puts them — and the drying log, which the reference has
/// no equivalent for at all, follows them rather than opening a fourth tab.
struct RoomDetailView: View {
    let room: RoomScan

    init(room: RoomScan) {
        self.room = room
        // The header and the General field both read a name the operator can
        // change, and `room` is a snapshot that will not hear about it.
        _roomName = State(initialValue: room.name)
        _savedName = State(initialValue: room.name)
    }

    /// The fixed tab set. Raw values are the segment labels.
    private enum Tab: String, CaseIterable, Identifiable {
        case details = "Details"
        case photos = "Photos & Notes"
        case forms = "Forms"
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
    /// The room's name, editable in General. Seeded from `room` once, then
    /// owned here — a reload cannot be allowed to overwrite it with the stale
    /// snapshot this view was constructed from.
    @State private var roomName: String
    /// The name the server has. What `roomName` is compared against, because
    /// `room` keeps reporting the name this view was constructed with.
    @State private var savedName: String
    @FocusState private var nameFocused: Bool
    /// Living area, 0–100. `livingOverridden` is the difference between a
    /// hand-set 100% and a 100% that came from the room type — `nil` in the
    /// database means "follow the type", which is not the same statement.
    @State private var livingDraft: Double = 100
    @State private var livingOverridden = false
    @State private var livingLoaded = false
    /// The override the server holds — `nil` for "follows the room type".
    @State private var savedLiving: Double?
    @State private var showingStatistics = false
    /// The detent the sheet is at, so the header chevron can collapse it the
    /// way the reference's does.
    @State private var detent: PresentationDetent = .medium

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
                case .photos: photosTab
                case .forms: formsTab
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
        .presentationDetents([.medium, .large], selection: $detent)
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.enabled(upThrough: .medium))
        .sheet(isPresented: $drawing) {
            if let plan {
                AreaEditor(plan: plan, existing: drawnAreas) { name, type, polygon, notes in
                    Task {
                        _ = try? await API.shared.createArea(
                            roomScanId: room.id, name: name, damageType: type,
                            surface: "floor", polygon: polygon, notes: notes)
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
            PlanEditorView(room: room, inspectorIsBehind: true) { Task { await load() } }
        }
        .sheet(isPresented: $logging) {
            ReadingSheet(roomId: room.id) { Task { await load() } }
        }
        .sheet(item: $editingArea) { area in
            AffectedAreaSheet(area: area, room: room) { Task { await load() } }
        }
        .sheet(isPresented: $showingStatistics) {
            RoomStatisticsSheet(room: room)
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

    /// `ⓘ name`, with a chevron to collapse — the reference's own header
    /// (object-model §2). The room name used to be a navigation title; a
    /// sheet has no bar, so the identity moves here — and the level joins it,
    /// because with the push gone there is no parent screen on view to say
    /// which storey this room belongs to at large detent.
    private var header: some View {
        HStack(spacing: Brand.Space.small) {
            // The badge that marks this as an inspected thing, not a control:
            // the ⓘ that opens a definition is the one ON A FIGURE, and two
            // ⓘs meaning different things in one sheet is worse than none.
            Image(systemName: "info.circle.fill")
                .font(.system(size: 17))
                .foregroundStyle(Brand.blue)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 1) {
                Text(roomName)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Brand.ink)
                    .lineLimit(1)
                Text("\(room.level) · \(Measure.sqftLabel(room.floorAreaSqmTrusted))")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkFaint)
            }
            Spacer()
            // One control, two steps, like theirs: pulled up it comes back
            // down to the canvas; already down, it closes. The thumb at the
            // bottom of a large sheet is not going to drag it.
            Button {
                if detent == .large { detent = .medium } else { dismiss() }
            } label: {
                Image(systemName: "chevron.down.circle.fill")
                    .font(.system(size: 24))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(Brand.inkFaint)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(detent == .large ? "Collapse" : "Close")
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.top, Brand.Space.base)
        .padding(.bottom, Brand.Space.small)
    }

    // MARK: - Details

    /// Everything the room IS, in the reference's order (object-model §2d):
    /// Statistics → Dimensions → Affected Areas → General. The drawing leads,
    /// which they have no need of — their sheet sits over the plan it
    /// describes and ours is opened from a list as often as from the canvas.
    /// The drying log is ours alone and goes after the damage it belongs to,
    /// so General still ends the tab.
    @ViewBuilder private var detailsTab: some View {
        planSection
        statisticsSection
        dimensionsSection
        affectedAreasSection
        moistureSection
        generalSection
    }

    /// The room, drawn — and the way into editing it.
    ///
    /// A separate "Adjust the plan" button used to sit under this drawing.
    /// It is gone: tapping the drawing itself is the affordance now, on the
    /// owner's own instruction, 18 Aug 2026 — the same rule that makes a
    /// room's OWN tap on the storey canvas activate editing, applied here
    /// too, so there is one gesture for "edit this plan" everywhere the
    /// plan is drawn, not a picture plus a separate button beside it.
    @ViewBuilder private var planSection: some View {
        if let plan, !plan.isEmpty {
            Section {
                Button {
                    editingPlan = true
                } label: {
                    ZStack(alignment: .bottomTrailing) {
                        FloorPlanView(
                            plan: plan, areas: drawnAreas,
                            label: (roomName, Int(Measure.squareFeet(room.floorAreaSqmTrusted).rounded()))
                        )
                        // The only signal left that this drawing is a
                        // button now that the row under it is gone — a
                        // pencil, the way `pencil.and.ruler` on the old
                        // button already said "adjust".
                        Image(systemName: "pencil.circle.fill")
                            .font(.system(size: 24))
                            .symbolRenderingMode(.palette)
                            .foregroundStyle(Brand.blue, Brand.surface)
                            .padding(6)
                    }
                    .frame(height: 240)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                .listRowBackground(Brand.surface)
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

    }

    /// Four figures and a way to the rest, as the reference leads its room
    /// sheet (object-model §2d: `Floor · Wall · Perimeter · Volume`).
    ///
    /// Every figure states what it means — an adjuster who cannot tell which
    /// definition a number used is an adjuster who can discount it. The
    /// figures that used to make this a six-up — ceiling height and baseboard
    /// length — are not lost: ceiling height is a Dimensions field now, and
    /// baseboard is in `See All`, which is where their own list puts it
    /// (as "Ground perimeter").
    @ViewBuilder private var statisticsSection: some View {
        Section {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                DefinedFigure(
                    value: Measure.sqftLabel(room.floorAreaSqmTrusted), unit: nil,
                    meaning: .floorArea)
                DefinedFigure(
                    value: Measure.sqftLabel(room.wallAreaGrossSqm),
                    unit: "gross", meaning: .wallArea)
                DefinedFigure(
                    value: Measure.ftLabel(room.wallLengthM), unit: nil, meaning: .perimeter)
                DefinedFigure(
                    value: Measure.cuftLabel(room.floorAreaSqmTrusted * room.ceilingHeightM),
                    unit: nil, meaning: .volume)
            }
            .listRowInsets(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))

            Button {
                showingStatistics = true
            } label: {
                HStack {
                    Text("See all")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Brand.blue)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Brand.inkFaint)
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
        } header: {
            Text("Statistics")
        }
    }

    /// Ceiling Height and Living Area (%), the reference's two Dimensions
    /// fields for a room.
    ///
    /// Ceiling height is **read-only here**: it is a measurement the scan
    /// took, and the PATCH route says so in as many words. Living area is the
    /// opposite kind of number — a judgement about what counts, which is why
    /// `living_percent` exists to be overridden at all.
    @ViewBuilder private var dimensionsSection: some View {
        Section {
            StatisticRowView(
                row: .init(
                    id: "ceiling", label: "Ceiling height",
                    value: String(format: "%.1f ft", Measure.feet(room.ceilingHeightM)),
                    meaning: .ceiling))

            Stepper(value: $livingDraft, in: 0...100, step: 5) {
                HStack {
                    Text("Living area")
                        .font(.system(size: 15))
                        .foregroundStyle(Brand.ink)
                    Spacer()
                    Text("\(Int(livingDraft.rounded()))%")
                        .font(.system(size: 15, weight: .semibold).monospacedDigit())
                        .foregroundStyle(livingOverridden ? Brand.blue : Brand.inkFaint)
                }
            } onEditingChanged: { editing in
                // Fires on press and again on release. Saving on release
                // means one write per adjustment rather than one per 5%.
                guard !editing else { return }
                Task { await saveLivingPercent(livingDraft) }
            }
            .disabled(savingRoomField)

            if livingOverridden {
                Button("Use the room type's \(Int(typeDefaultPercent.rounded()))%") {
                    Task { await saveLivingPercent(nil) }
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Brand.blue)
            }
        } header: {
            Text("Dimensions")
        } footer: {
            Text(
                livingOverridden
                    ? "Set by hand for this room. Clearing it returns to whatever the room type says."
                    : "From the room type. Adjust it and this room stops following the type."
            )
            .font(.system(size: 11))
            .foregroundStyle(Brand.inkFaint)
        }
    }

    // MARK: - General

    /// Floor, Room Type, Room Name, Room Color — the reference's General
    /// block, in its order (object-model §2d), and last on the tab.
    @ViewBuilder private var generalSection: some View {
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

            // Committed on Return or when the field is left — not on every
            // keystroke, which would be a PATCH per letter.
            HStack {
                Text("Room name")
                    .font(.system(size: 15))
                    .foregroundStyle(Brand.ink)
                TextField("Room", text: $roomName)
                    .font(.system(size: 15))
                    .multilineTextAlignment(.trailing)
                    .focused($nameFocused)
                    .submitLabel(.done)
                    .onSubmit { Task { await saveRoomName() } }
            }
            .onChange(of: nameFocused) { _, focused in
                if !focused { Task { await saveRoomName() } }
            }

            // The plan's ordinary grey by default; a swatch says "this room,
            // deliberately" the way a highlighter does on a paper drawing.
            // The circle with a slash is the way back to no colour at all —
            // clearing a choice needs its own target, not just picking
            // nothing.
            VStack(alignment: .leading, spacing: Brand.Space.tight) {
                Text("Room colour")
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
        } header: {
            Text("General")
        } footer: {
            VStack(alignment: .leading, spacing: Brand.Space.hair) {
                if let note = roomTypes.first(where: { $0.id == chosenType })?.note {
                    Text(note)
                } else {
                    Text("The room type decides how much of this room counts as living area — the figure coverage is quoted against.")
                }
                Text("Room colour is separate from damage colouring — this is the room itself, on the floor sheet.")
            }
            .font(.system(size: 11))
            .foregroundStyle(Brand.inkFaint)
        }
    }

    // MARK: - Damage and drying

    /// The damage, inside Details and reached by scrolling — where the owner
    /// asked for it and where the reference has it (object-model §2d). Areas
    /// may overlap, and may sit on a floor or on a wall.
    @ViewBuilder private var affectedAreasSection: some View {
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
                    Label("Add New Area", systemImage: "plus.circle.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Brand.blue)
                }
            }
        } header: {
            HStack {
                Text("Affected Areas")
                Spacer()
                if !areas.isEmpty {
                    // Two figures, never one. Which surface a square foot is
                    // on decides what it costs to put right.
                    Text(damageTotals).font(.caption.monospacedDigit())
                }
            }
        } footer: {
            // Their own note says as much — one or more areas, overlapping
            // allowed, on a room or a wall, and they travel into the exports.
            // The second sentence is ours: this button draws on the floor
            // plan, and a wall area is outlined on the wall's own face.
            Text(
                "One or more areas, overlapping allowed, on the floor or on a wall — all of them print. "
                    + "This adds a floor area; wall damage is outlined in elevation, by opening the plan and facing the wall."
            )
            .font(.system(size: 11))
            .foregroundStyle(Brand.inkFaint)
        }
    }

    /// The drying record — moisture readings and their trend. magicplan has
    /// no equivalent; it goes after the damage it belongs to, so General
    /// still ends the tab.
    @ViewBuilder private var moistureSection: some View {
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

    private func areaRow(_ area: AffectedArea, where place: String) -> some View {
        AffectedAreaRow(area: area, place: place) { editingArea = area }
    }

    private var damageTotals: String {
        var parts: [String] = []
        if floorDamagedSqm > 0 { parts.append("Floor \(Measure.sqftLabel(floorDamagedSqm))") }
        if wallDamagedSqm > 0 { parts.append("Wall \(Measure.sqftLabel(wallDamagedSqm))") }
        return parts.joined(separator: " · ")
    }

    // MARK: - Photos & Notes

    /// The evidence — photographs, and what the operator has to say about
    /// them. The notes half was missing for months while the tab was called
    /// `Photos & Notes`: `PATCH /api/v1/scans/{id}` has always taken a
    /// `notes` field and the report has always printed it, so the only thing
    /// absent was a box on the phone standing in the room.
    @ViewBuilder private var photosTab: some View {
        if let projectId = room.projectId {
            RoomPhotosSection(projectId: projectId, roomScanId: room.id)
            RoomNotesSection(roomId: room.id, initial: room.notes)
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

    // MARK: - Forms

    /// The reference's third tab, with the reference's empty state — which is
    /// all it has ever shown us: forms there are authored in their cloud and
    /// attached per object, and none was observed in use (object-model §2).
    ///
    /// It is here because the tab set is fixed and the thumb learns three
    /// positions, not two. What it must not do is claim a feature: the tab
    /// says plainly that nothing is set up, and points at the record this
    /// trade actually files instead.
    @ViewBuilder private var formsTab: some View {
        InspectorFormsTab(
            subject: "this room",
            footer: "The damage marking and the drying log, under Details, are the record an adjuster reads today.")
    }

    // MARK: - Derived

    private var typeLabel: String {
        guard let chosenType else { return "Not set" }
        return roomTypes.first { $0.id == chosenType }?.label ?? chosenType
    }

    /// What the room type says counts as living area, before any override.
    /// 100 when nobody has said — an unclassified room is not silently
    /// discounted.
    private var typeDefaultPercent: Double {
        roomTypes.first { $0.id == chosenType }?.percent ?? 100
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
    private var drawnAreas: [DrawnArea] {
        floorAreas.compactMap { area in
            guard area.polygon.count >= 3 else { return nil }
            return DrawnArea(
                polygon: area.polygon.map { CGPoint(x: $0.x, y: $0.y) },
                colour: area.displayColor,
                dimensioned: area.showDimensions)
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

        // Read from the room once, then owned here — `room` is the snapshot
        // this view was built with and will keep reporting the old value
        // after a save. An unoverridden room follows its type, including
        // when the type changes underneath it.
        if !livingLoaded {
            livingLoaded = true
            savedLiving = room.livingPercent
            livingOverridden = room.livingPercent != nil
            livingDraft = room.livingPercent ?? typeDefaultPercent
        } else if !livingOverridden {
            livingDraft = typeDefaultPercent
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

    /// Renaming writes only when the text actually changed. The field is left
    /// on every scroll past it, and a PATCH per scroll is a PATCH per scroll.
    /// An empty name is not a rename — a room with no name cannot be found on
    /// a list — so the field goes back rather than clearing it.
    private func saveRoomName() async {
        let trimmed = roomName.trimmed
        guard !trimmed.isEmpty else {
            roomName = savedName
            return
        }
        roomName = trimmed
        guard trimmed != savedName else { return }
        savingRoomField = true
        do {
            try await API.shared.renameRoom(roomId: room.id, name: trimmed)
            savedName = trimmed
        } catch {
            roomName = savedName
            self.error = error.localizedDescription
        }
        savingRoomField = false
    }

    /// `nil` clears the override and hands the room back to its type — which
    /// is a different statement from 0%, and the database keeps them apart.
    ///
    /// Writes nothing when nothing changed. The stepper reports the end of an
    /// edit even when the value was already at 0 or 100 and did not move, and
    /// saving that would silently convert "follows its type" into a hand-set
    /// figure the operator never chose.
    private func saveLivingPercent(_ percent: Double?) async {
        let rounded = percent.map { $0.rounded() }
        guard rounded != savedLiving else { return }
        savingRoomField = true
        do {
            try await API.shared.setLivingPercent(roomId: room.id, percent: rounded)
            savedLiving = rounded
            livingOverridden = rounded != nil
            if rounded == nil { livingDraft = typeDefaultPercent }
        } catch {
            livingDraft = savedLiving ?? typeDefaultPercent
            livingOverridden = savedLiving != nil
            self.error = error.localizedDescription
        }
        savingRoomField = false
    }
}

/// Every figure this room reports, with its definition behind it — the
/// reference's `See All` from the room sheet's Statistics block.
///
/// Deliberately room-scoped rather than reusing `ProjectStatisticsSheet`:
/// "Floors 1, Rooms 1" is noise on one room, and baseboard length — their
/// "Ground perimeter", the figure trim is priced on — belongs here where the
/// four-up has no space for it. The reference's fuller list (the three
/// ground-surface variants, the living-area rows, the Objects tab) is S9.
struct RoomStatisticsSheet: View {
    let room: RoomScan

    @Environment(\.dismiss) private var dismiss
    /// The objects standing in this room — the takeoff `room_objects` was
    /// built for, and until now the only part of it with no screen.
    @State private var objects: [RoomObject] = []

    private var measurements: [ProjectStats.Row] {
        [
            .init(
                id: "floorArea", label: "Floor area",
                value: Measure.sqftLabel(room.floorAreaSqmTrusted), meaning: .floorArea),
            .init(
                id: "wallArea", label: "Wall area (gross)",
                value: Measure.sqftLabel(room.wallAreaGrossSqm),
                meaning: .wallArea),
            .init(
                id: "perimeter", label: "Perimeter",
                value: Measure.ftLabel(room.wallLengthM), meaning: .perimeter),
            // Falls back to the perimeter when there is no geometry to read
            // doorways out of — equal, not absent, because a room with no
            // detected doors genuinely has no deduction.
            .init(
                id: "baseboard", label: "Baseboard length",
                value: Measure.ftLabel(room.geometry?.baseboardLengthM ?? room.wallLengthM),
                meaning: .baseboard),
            .init(
                id: "ceiling", label: "Ceiling height",
                value: String(format: "%.1f ft", Measure.feet(room.ceilingHeightM)),
                meaning: .ceiling),
            .init(
                id: "volume", label: "Volume",
                value: Measure.cuftLabel(room.floorAreaSqmTrusted * room.ceilingHeightM),
                meaning: .volume),
        ]
    }

    private var counts: [ProjectStats.Row] {
        var rows: [ProjectStats.Row] = [
            .init(id: "doors", label: "Doors", value: "\(room.doorCount)", meaning: nil),
            .init(id: "windows", label: "Windows", value: "\(room.windowCount)", meaning: nil),
        ]
        if room.stairCount > 0 {
            rows.append(
                .init(id: "stairs", label: "Staircases", value: "\(room.stairCount)", meaning: nil))
        }
        return rows
    }

    /// The takeoff: what is in this room, counted.
    ///
    /// **This is the whole reason objects are a table.** The owner, asked
    /// what an object has to do on a job: *"if replaced, if there is
    /// damage, it needs to be counted, there is installation involved
    /// also, i need to have an option to include or exclude it like any
    /// other item."* The disposition and the include switch have been in
    /// the object's own sheet since it was built; the COUNTING had nowhere
    /// to appear.
    ///
    /// Three rules, all of them his:
    ///
    /// - **Excluded objects are not here at all.** Not counted and greyed —
    ///   absent, the way an unticked line is absent from an estimate.
    /// - **Quantities are summed, not rows counted.** One row can stand for
    ///   eight identical base cabinets along a run.
    /// - **Grouped by what happens to them**, because "remove" and "reset"
    ///   are different money and a total that mixed them would have to be
    ///   taken apart again by whoever prices it.
    private var takeoff: [ProjectStats.Row] {
        // Annotations are writing, not things — a label saying "water line
        // here" is not one of anything and must never appear in a count.
        let counted = objects.filter { $0.included && $0.entry?.isAnnotation != true }
        guard !counted.isEmpty else { return [] }

        var totals: [String: Int] = [:]
        for object in counted {
            totals[object.displayName, default: 0] += object.quantity
        }
        return totals.keys.sorted().map { name in
            .init(id: "object.\(name)", label: name, value: "\(totals[name] ?? 0)", meaning: nil)
        }
    }

    /// What is being DONE to them, which is the half a count alone cannot
    /// say. Only the dispositions actually present — a job with nothing to
    /// reset should not carry a "Reset: 0" line.
    private var work: [ProjectStats.Row] {
        var totals: [String: Int] = [:]
        for object in objects
        where object.included && object.disposition != "none"
            && object.entry?.isAnnotation != true
        {
            totals[object.dispositionLabel, default: 0] += object.quantity
        }
        return totals.keys.sorted().map {
            .init(id: "work.\($0)", label: $0, value: "\(totals[$0] ?? 0)", meaning: nil)
        }
    }

    private var excluded: Int {
        objects.filter { !$0.included }.reduce(0) { $0 + $1.quantity }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Measurements") {
                    ForEach(measurements) { StatisticRowView(row: $0) }
                }

                if !takeoff.isEmpty {
                    Section {
                        ForEach(takeoff) { StatisticRowView(row: $0) }
                    } header: {
                        Text("Objects in this room")
                    } footer: {
                        if excluded > 0 {
                            Text(
                                "\(excluded) more \(excluded == 1 ? "is" : "are") on the plan but excluded from the claim."
                            )
                        }
                    }
                }

                if !work.isEmpty {
                    Section {
                        ForEach(work) { StatisticRowView(row: $0) }
                    } header: {
                        Text("Work on those objects")
                    } footer: {
                        Text("Removing, resetting and replacing are different labour lines — they are counted apart rather than totalled together.")
                    }
                }
                Section {
                    ForEach(counts) { StatisticRowView(row: $0) }
                } header: {
                    Text("Objects")
                } footer: {
                    if room.stairCount > 0 {
                        Text("Treads and risers are not in the floor area — price them separately.")
                    }
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
            .task {
                objects = (try? await API.shared.objects(roomScanId: room.id)) ?? []
            }
        }
    }
}



/// What the `Fill Color` chevron opens — the reference's colour matrix,
/// with `Reset`.
///
/// The matrix is built rather than collected: six hues across, three values
/// down, and its **middle row is the cause table itself** (`DamageCause.hex`
/// in `DAMAGE_TYPES` order). So the row an area already sits on is the row
/// it starts from, and stepping sideways keeps the drawing inside the
/// palette the rest of the plan uses instead of introducing a hue nothing
/// else on it has.
///
/// `Reset` is not a swatch and must not be one. Nil in the `color` column
/// does not mean "no colour" — it means "follow the cause", which is what
/// lets a cause be recoloured later without orphaning every old area on a
/// stale hex. See `API.ColorEdit`.
struct AreaFillColorPicker: View {
    let selected: String?
    let cause: DamageCause
    let onPick: (String) -> Void
    let onReset: () -> Void

    @Environment(\.dismiss) private var dismiss

    static let matrix: [String] = [
        "#1f5fa8", "#a8431f", "#2f6f22", "#5f3f9e", "#5f5f63", "#8a1f3f",
        "#2b7fd4", "#e2673a", "#4f9d3a", "#8a63d2", "#8a8a8e", "#d4437a",
        "#6fb0e8", "#f0a184", "#8ecb7d", "#b79ce6", "#c2c6cc", "#f094ac",
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                VStack(alignment: .leading, spacing: Brand.Space.base) {
                    LazyVGrid(
                        columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 6),
                        spacing: 10
                    ) {
                        ForEach(Self.matrix, id: \.self) { hex in
                            swatch(hex)
                        }
                    }

                    Text(
                        selected == nil
                            ? "Following \(cause.label.lowercased()) — the cause's own colour."
                            : "Overridden. Reset puts it back to the cause's colour."
                    )
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkFaint)

                    Spacer()
                }
                .padding(Brand.Space.base)
            }
            .navigationTitle("Fill Colour")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    // Disabled when there is nothing to reset — a live
                    // control that does nothing teaches the operator to
                    // distrust the ones that do.
                    Button("Reset") {
                        onReset()
                        dismiss()
                    }
                    .disabled(selected == nil)
                }
            }
            .presentationDetents([.height(320), .medium])
        }
    }

    private func swatch(_ hex: String) -> some View {
        let value = UInt32(hex.dropFirst(), radix: 16) ?? 0
        let isSelected = selected == hex
        return Button {
            onPick(hex)
            dismiss()
        } label: {
            Circle()
                .fill(Color(hex: value))
                .frame(height: 38)
                .overlay(
                    Circle().strokeBorder(isSelected ? Brand.blue : .clear, lineWidth: 3)
                        .padding(-3))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isSelected ? "Colour \(hex), selected" : "Colour \(hex)")
    }
}

/// One marked region, laid out as the reference lays its row (object-model
/// §2b): swatch · name over its surface · area · the glyph that opens it.
///
/// One view rather than one per sheet. The room's list and the wall's list
/// were showing the same object two different ways — the wall's row had no
/// subtitle at all — and a row that changes shape depending on which screen
/// reached it is a row that has to be re-read every time.
///
/// The subtitle carries the cause as well as the surface, which theirs
/// cannot: they have no causes. It is stated on the row rather than left to
/// a grouping header because these rows end up read one at a time, in a
/// report and over a phone.
struct AffectedAreaRow: View {
    let area: AffectedArea
    /// Where it is, in words — `Floor`, or `Wall 3`.
    let place: String
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: Brand.Space.small) {
                Circle()
                    .fill(area.displayColor)
                    .frame(width: 10, height: 10)

                VStack(alignment: .leading, spacing: 1) {
                    Text(area.name)
                        .foregroundStyle(Brand.ink)
                        .lineLimit(1)
                    Text("\(place) · \(area.label)")
                        .font(.caption2)
                        .italic()
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: Brand.Space.tight)

                // A dimensioned area says so here, because the toggle that
                // set it lives two taps away and its effect is on a drawing
                // this row is not.
                if area.showDimensions {
                    Image(systemName: "ruler")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Brand.inkFaint)
                        .accessibilityLabel("Dimensions shown")
                }

                Text(Measure.sqftLabel(area.areaSqm))
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)

                // A tappable row that does not look tappable is a row nobody
                // taps. The glyph is the only signal it opens anything.
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.inkFaint)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }
}

/// One affected area's inspector — object-model §2b.
///
/// The reference gives an area the same three-tab shell as any other
/// object: `Details · Photos & Notes · Forms`, with `Dimensions → Area`
/// read-only, `General → Name` and `Fill Color` (a full matrix with
/// `Reset`), and `Settings → Show Dimensions`. That shell is lifted from
/// `WallDetailView` rather than rewritten, per S1's note — the tab set is
/// fixed and a thumb learns three positions once.
///
/// **What is ours and stays ours:** the damage cause. magicplan's areas
/// carry a name and a colour and nothing else; here the cause decides the
/// trade and the rate, an adjuster asks for it, and the database constrains
/// it. It sits in General with the name, because it is also what the fill
/// colour defaults to.
///
/// Every field commits on its own, as the room and wall sheets do. There is
/// no Save: an inspector that can be closed with unsaved edits in it is an
/// inspector that loses them.
struct AffectedAreaSheet: View {
    let area: AffectedArea
    /// The room this area was marked in — needed to file a photo, which
    /// belongs to a project through its room.
    let room: RoomScan
    let onChanged: () -> Void

    private enum Tab: String, CaseIterable, Identifiable {
        case details = "Details"
        case photos = "Photos & Notes"
        case forms = "Forms"
        var id: String { rawValue }
    }

    @Environment(\.dismiss) private var dismiss

    @State private var tab = Tab.details
    @State private var name: String
    @State private var notes: String
    @State private var showDimensions: Bool
    @State private var cause: DamageCause
    /// The override, `#rrggbb` or nil. Nil is not "no colour" — it is
    /// "follow the cause", which is why `Reset` and a swatch are different
    /// controls rather than one being the absence of the other.
    @State private var colorOverride: String?
    @State private var saving = false
    @State private var confirmingDelete = false
    @State private var error: String?
    @State private var detent: PresentationDetent = .medium
    @State private var pickingColor = false
    @FocusState private var nameFocused: Bool
    @FocusState private var notesFocused: Bool

    init(area: AffectedArea, room: RoomScan, onChanged: @escaping () -> Void) {
        self.area = area
        self.room = room
        self.onChanged = onChanged
        _name = State(initialValue: area.name)
        _notes = State(initialValue: area.notes ?? "")
        _showDimensions = State(initialValue: area.showDimensions)
        _cause = State(initialValue: area.cause)
        _colorOverride = State(initialValue: area.color?.trimmed.lowercased())
    }

    /// What this area draws in right now, from LOCAL state — the row that
    /// opened this sheet holds the value as it was fetched, and a swatch
    /// that does not recolour the header the instant it is tapped reads as
    /// a control that did nothing.
    private var displayColor: Color {
        if let hex = colorOverride, hex.hasPrefix("#"), hex.count == 7,
            let value = UInt32(hex.dropFirst(), radix: 16)
        {
            return Color(hex: value)
        }
        return cause.color
    }

    private var place: String {
        area.isWall ? "Wall \((area.wallIndex ?? 0) + 1)" : "Floor"
    }

    var body: some View {
        VStack(spacing: 0) {
            header

            Picker("Section", selection: $tab) {
                ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, Brand.Space.base)
            .padding(.bottom, Brand.Space.tight)

            List {
                switch tab {
                case .details: detailsTab
                case .photos: photosTab
                case .forms: formsTab
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
        }
        .background(Brand.canvas)
        .presentationDetents([.medium, .large], selection: $detent)
        .presentationDragIndicator(.visible)
        .sheet(isPresented: $pickingColor) {
            AreaFillColorPicker(
                selected: colorOverride,
                cause: cause,
                onPick: { hex in Task { await saveColor(.set(hex)) } },
                onReset: { Task { await saveColor(.reset) } })
        }
        .confirmationDialog(
            "Delete \(name.trimmed.isEmpty ? area.name : name.trimmed)?",
            isPresented: $confirmingDelete, titleVisibility: .visible
        ) {
            Button("Delete area", role: .destructive) { Task { await delete() } }
            Button("Keep it", role: .cancel) {}
        } message: {
            Text("Its measurement, its note, its photos and its dimension setting go with it. This cannot be undone.")
        }
    }

    /// `ⓘ name`, with the same collapse chevron as the room and wall sheets.
    /// The swatch is here because colour is this object's identity on the
    /// plan — it is the first thing the row that opened this sheet showed.
    private var header: some View {
        HStack(spacing: Brand.Space.small) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 17))
                .foregroundStyle(Brand.blue)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 1) {
                Text(name.trimmed.isEmpty ? area.name : name.trimmed)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Brand.ink)
                    .lineLimit(1)
                HStack(spacing: 5) {
                    Circle()
                        .fill(displayColor)
                        .frame(width: 8, height: 8)
                    Text("\(place) · \(cause.label) · \(Measure.sqftLabel(area.areaSqm))")
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.inkFaint)
                }
            }
            Spacer()
            Button {
                if detent == .large { detent = .medium } else { dismiss() }
            } label: {
                Image(systemName: "chevron.down.circle.fill")
                    .font(.system(size: 24))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(Brand.inkFaint)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(detent == .large ? "Collapse" : "Close")
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.top, Brand.Space.base)
        .padding(.bottom, Brand.Space.small)
    }

    // MARK: - Details

    @ViewBuilder private var detailsTab: some View {
        dimensionsSection
        generalSection
        settingsSection
        newFieldSection
        deleteSection
    }

    /// Read-only, exactly as theirs is. The measurement follows the shape,
    /// and the shape is edited on the plan — a typed area would be a figure
    /// with no drawing behind it, which is the one thing a claim cannot use.
    private var dimensionsSection: some View {
        Section {
            StatisticRowView(
                row: .init(
                    id: "area", label: "Area", value: Measure.sqftLabel(area.areaSqm),
                    meaning: .damaged))
        } header: {
            Text("Dimensions")
        } footer: {
            Text("Computed from the marked shape. Redraw the area on the plan to change it.")
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
        }
    }

    private var generalSection: some View {
        Section {
            // Committed on Return or when the field is left — not on every
            // keystroke, which would be a PATCH per letter.
            HStack {
                Text("Name")
                    .font(.system(size: 15))
                    .foregroundStyle(Brand.ink)
                TextField("Affected area", text: $name)
                    .font(.system(size: 15))
                    .multilineTextAlignment(.trailing)
                    .focused($nameFocused)
                    .submitLabel(.done)
                    .onSubmit { Task { await saveName() } }
            }
            .onChange(of: nameFocused) { _, focused in
                if !focused { Task { await saveName() } }
            }

            VStack(alignment: .leading, spacing: Brand.Space.tight) {
                Text("Damage cause")
                    .font(.system(size: 15))
                    .foregroundStyle(Brand.ink)
                DamageCausePicker(cause: $cause)
            }
            .padding(.vertical, 2)
            .onChange(of: cause) { _, picked in
                Task { await save(damageType: picked.rawValue) }
            }

            fillColorRow
        } header: {
            Text("General")
        } footer: {
            Text("The cause decides the trade, the rate, and the colour this area draws in. A fill colour overrides that colour here only — it never changes what the area is.")
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
        }
    }

    /// The reference's `Fill Color`: a ROW — swatch and a chevron — that
    /// opens the matrix. Not the matrix inline.
    ///
    /// Built inline first, and the owner sent the real screen back: theirs
    /// is one row in `General`, level with `Name`, showing the colour in a
    /// circle with a disclosure chevron beside it. The matrix and `Reset`
    /// are what that chevron opens. Position is what a hand learns, and a
    /// grid of eighteen swatches sitting in the middle of General pushes
    /// every field below it down the screen.
    private var fillColorRow: some View {
        Button {
            pickingColor = true
        } label: {
            HStack {
                Text("Fill Colour")
                    .font(.system(size: 15))
                    .foregroundStyle(Brand.ink)
                Spacer()
                Circle()
                    .fill(displayColor)
                    .frame(width: 26, height: 26)
                    .overlay(Circle().strokeBorder(Brand.inkFaint.opacity(0.3), lineWidth: 1))
                Image(systemName: "chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.inkFaint)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .disabled(saving)
    }

    /// Their `+ New Field`, in its place at the foot of Details with its own
    /// caption. Custom fields on an AREA are not built — the project has
    /// them (migration 0026) and an area does not — so this says so plainly
    /// rather than opening something that cannot save. A row that lies about
    /// what it does is worse than a row that is honest about not being
    /// finished yet.
    private var newFieldSection: some View {
        Section {
            HStack {
                Image(systemName: "plus")
                    .font(.system(size: 15, weight: .semibold))
                Text("New Field")
                    .font(.system(size: 15, weight: .semibold))
                Spacer()
                Image(systemName: "arrow.up.forward")
                    .font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(Brand.inkFaint)
        } footer: {
            Text("Collect important information and improve your reports by creating your own fields. Custom fields exist on a project; on an affected area they are not built yet.")
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
        }
    }

    /// Their `Settings` block. The toggle is theirs; what it drives is ours
    /// on both surfaces — a wall area's figures print on the elevation
    /// (`ElevationView`), a floor area's beside it on the plan
    /// (`FloorPlanView` step 6).
    private var settingsSection: some View {
        Section {
            Toggle(isOn: $showDimensions) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Show Dimensions")
                        .foregroundStyle(Brand.ink)
                    Text(
                        area.isWall
                            ? "Print this area's width and height on the wall elevation."
                            : "Print this area's width and height beside it on the floor plan."
                    )
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.inkFaint)
                }
            }
            .tint(Brand.blue)
            .disabled(saving)
            .onChange(of: showDimensions) { _, value in
                Task { await save(showDimensions: value) }
            }
        } header: {
            Text("Settings")
        }
    }

    private var deleteSection: some View {
        Section {
            Button("Delete this area", role: .destructive) {
                confirmingDelete = true
            }
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.red)
            .frame(maxWidth: .infinity)
            .disabled(saving)
        }
    }

    // MARK: - Photos & Notes

    /// The reference's second tab, attached to the AREA and not merely to
    /// its room — object-model §2b, and the whole point of the tab existing
    /// here at all. A photo of the wet patch behind the vanity is evidence
    /// about that patch; filed against the room it becomes one of forty
    /// nobody can attribute a month later. It still shows in the room's own
    /// grid, which reads everything filed against the room.
    @ViewBuilder private var photosTab: some View {
        if let projectId = room.projectId {
            RoomPhotosSection(
                projectId: projectId, roomScanId: room.id, affectedAreaId: area.id,
                title: "Photos of this area")
        } else {
            Section {
                Text("This room is not attached to a project yet, so photos have nowhere to file.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }

        Section {
            TextField(
                "What's here, what was already cut back — whatever the next visit needs to know.",
                text: $notes, axis: .vertical
            )
            .lineLimit(3...8)
            .focused($notesFocused)
            .onChange(of: notesFocused) { _, focused in
                if !focused { Task { await save(notes: notes.trimmed) } }
            }
        } header: {
            Text("Notes")
        } footer: {
            Text("Saved when you tap away. This note is about the area, not the room — the room keeps its own.")
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
        }
    }

    // MARK: - Forms

    @ViewBuilder private var formsTab: some View {
        InspectorFormsTab(
            subject: "this area",
            footer: "The cause, the measurement and the photos above are what an adjuster reads for a marked region today.")
    }

    // MARK: - Persistence

    private func saveName() async {
        let trimmed = name.trimmed
        guard trimmed != area.name, !trimmed.isEmpty else { return }
        await save(name: trimmed)
    }

    private func saveColor(_ edit: API.ColorEdit) async {
        // Optimistic: the swatch ring and the header dot move now, and go
        // back if the write fails. A colour that lags a round trip reads as
        // a tap that missed.
        let previous = colorOverride
        switch edit {
        case .set(let hex): colorOverride = hex
        case .reset: colorOverride = nil
        case .leave: return
        }
        await save(color: edit, rollback: { colorOverride = previous })
    }

    private func save(
        name: String? = nil, notes: String? = nil, showDimensions: Bool? = nil,
        damageType: String? = nil, color: API.ColorEdit = .leave,
        rollback: (() -> Void)? = nil
    ) async {
        saving = true
        error = nil
        do {
            try await API.shared.updateArea(
                id: area.id, name: name, notes: notes, showDimensions: showDimensions,
                damageType: damageType, color: color)
            onChanged()
        } catch {
            rollback?()
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


/// The reference's third tab, with the reference's empty state — which is
/// all it has ever shown us: forms there are authored in their cloud and
/// attached per object, and none was observed in use (object-model §2).
/// Shared by every inspector sheet (room, wall, …) rather than written once
/// per sheet — the tab set is fixed and the empty state says the same thing
/// everywhere except which record it points at instead.
struct InspectorFormsTab: View {
    /// What "this room" / "this wall" reads as in the empty-state copy.
    let subject: String
    /// Where the real record for this subject actually lives.
    let footer: String

    var body: some View {
        Section {
            VStack(alignment: .leading, spacing: Brand.Space.small) {
                Image(systemName: "list.bullet.rectangle.portrait")
                    .font(.system(size: 28))
                    .foregroundStyle(Brand.inkFaint)
                Text("No forms yet.")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                Text("Forms are the checklists and sign-off sheets a job is closed with. None are set up for \(subject).")
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, Brand.Space.small)
        } footer: {
            Text(footer)
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
        }
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
