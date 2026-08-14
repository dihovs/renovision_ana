import SwiftUI

/// Every property being worked on.
///
/// Cards on a grouped canvas rather than a plain `List`, which is the shape a
/// field-service app has and the shape the operator already knows from Jobber.
/// A row carries the three things worth scanning for — who, where in the job
/// it is, and how much has been measured — and nothing else.
struct ProjectsView: View {
    let onSignedOut: () -> Void

    @State private var projects: [ProjectSummary]?
    @State private var error: String?
    @State private var query = ""
    @State private var showStatus = false
    @State private var showMore = false
    @State private var creating = false

    private var shown: [ProjectSummary] {
        guard let projects else { return [] }
        guard !query.isEmpty else { return projects }
        return projects.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || ($0.clientName ?? "").localizedCaseInsensitiveContains(query)
        }
    }

    private var measured: Int { (projects ?? []).reduce(0) { $0 + $1.roomCount } }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Brand.Space.base) {
                        if let projects, !projects.isEmpty {
                            StatBand(items: [
                                .init(label: "Projects", value: "\(projects.count)"),
                                .init(label: "Rooms", value: "\(measured)"),
                                .init(
                                    label: "Active",
                                    value: "\(projects.filter { $0.roomCount > 0 }.count)"),
                            ])
                        }

                        if let error {
                            Card {
                                Label {
                                    Text(error).font(.callout)
                                } icon: {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .foregroundStyle(.orange)
                                }
                                Button("Try again") { Task { await load() } }
                                    .font(.footnote.bold())
                                    .foregroundStyle(Brand.blue)
                                    .padding(.top, Brand.Space.tight)
                            }
                        }

                        if projects == nil {
                            ProgressView().padding(.top, 60)
                        } else if shown.isEmpty {
                            Card {
                                VStack(alignment: .leading, spacing: Brand.Space.tight) {
                                    Text(query.isEmpty ? "No projects yet" : "No match")
                                        .font(.headline)
                                        .foregroundStyle(Brand.ink)
                                    Text(
                                        query.isEmpty
                                            ? "A measurement belongs to a job. Create the project first and its floor plans live inside it."
                                            : "Nothing matches “\(query)”."
                                    )
                                    .font(.callout)
                                    .foregroundStyle(Brand.inkSoft)
                                }
                            }
                        } else {
                            ForEach(shown) { project in
                                NavigationLink(value: project) {
                                    Card {
                                        CardRow {
                                            VStack(alignment: .leading, spacing: 5) {
                                                Text(project.name)
                                                    .font(.system(size: 16, weight: .semibold))
                                                    .foregroundStyle(Brand.ink)
                                                    .multilineTextAlignment(.leading)

                                                Text(project.clientName ?? "No client")
                                                    .font(.system(size: 13))
                                                    .foregroundStyle(Brand.inkSoft)

                                                if project.roomCount > 0 {
                                                    StatusBadge(
                                                        text:
                                                            "\(project.roomCount) room\(project.roomCount == 1 ? "" : "s") measured",
                                                        tone: .active)
                                                } else {
                                                    StatusBadge(text: "Not measured", tone: .neutral)
                                                }
                                            }
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.top, Brand.Space.small)
                    // Clear of the floating button, which otherwise covers the
                    // last row exactly when the list is long enough to matter.
                    .padding(.bottom, 96)
                }
                .refreshable { await load() }

                FloatingAction(icon: "plus") { creating = true }
                    .padding(.trailing, Brand.Space.large)
                    .padding(.bottom, Brand.Space.large)
            }
            .navigationTitle("Projects")
            .navigationDestination(for: ProjectSummary.self) { ProjectDetailView(project: $0) }
            .searchable(text: $query, prompt: "Search projects or clients")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Refresh") { Task { await load() } }
                        Button("Other screens") { showMore = true }
                        Button("Connection status") { showStatus = true }
                        Divider()
                        Button("Sign out", role: .destructive) { onSignedOut() }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $showStatus) { DiagnosticsView() }
            .sheet(isPresented: $showMore) { MoreView() }
            .sheet(isPresented: $creating) {
                NewProjectSheet { _ in Task { await load() } }
            }
            .task { await load() }
        }
    }

    private func load() async {
        do {
            projects = try await API.shared.projects()
            error = nil
        } catch APIError.notSignedIn {
            onSignedOut()
        } catch {
            self.error = error.localizedDescription
            if projects == nil { projects = [] }
        }
    }
}

/// One property: its survey, its rooms, its equipment.
struct ProjectDetailView: View {
    let project: ProjectSummary

    @State private var scans: [RoomScan]?
    @State private var equipment: [EquipmentPlacement] = []
    @State private var error: String?
    @State private var capturing = false
    @State private var addingEquipment = false
    @State private var openRoom: RoomScan?
    @StateObject private var queue = ScanQueue.shared

    /// Storeys in building order, not the order they happened to be scanned —
    /// a basement measured last still belongs at the bottom of the list.
    private static let order = ["Basement", "Ground", "2nd", "3rd", "Attic"]

    private var levels: [String] {
        let found = Set((scans ?? []).map(\.level))
        return Self.order.filter(found.contains) + found.subtracting(Self.order).sorted()
    }

    private var floorAreaSqm: Double { (scans ?? []).reduce(0) { $0 + $1.floorAreaSqm } }
    private var wallAreaSqm: Double {
        (scans ?? []).reduce(0) { $0 + $1.wallLengthM * $1.ceilingHeightM }
    }
    private var runningUnits: Int { equipment.filter(\.isRunning).count }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Brand.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: Brand.Space.base) {
                    StatBand(items: [
                        .init(
                            label: "Floor",
                            value: "\(Int(Measure.squareFeet(floorAreaSqm).rounded()))",
                            unit: "sq ft"),
                        .init(
                            label: "Walls",
                            value: "\(Int(Measure.squareFeet(wallAreaSqm).rounded()))",
                            unit: "sq ft"),
                        .init(label: "Rooms", value: "\((scans ?? []).count)"),
                    ])

                    // Living area sits directly under the raw floor figure,
                    // because the difference between the two is the point:
                    // coverage is quoted against this one, not that one.
                    LivingAreaCard(projectId: project.id)

                    if let error {
                        Card {
                            Label(error, systemImage: "exclamationmark.triangle.fill")
                                .font(.footnote)
                                .foregroundStyle(.orange)
                        }
                    }

                    // Held scans, said plainly. A measurement the operator
                    // believes was filed and was not is the worst outcome
                    // this screen can produce.
                    if !queue.pending(for: project.id).isEmpty {
                        let held = queue.pending(for: project.id)
                        Card {
                            VStack(alignment: .leading, spacing: Brand.Space.tight) {
                                Label(
                                    "^[\(held.count) room](inflect: true) waiting to upload",
                                    systemImage: "arrow.up.circle"
                                )
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(.orange)
                                Text(
                                    "Measured with no signal and held on this phone. They send themselves as soon as you have a connection — nothing to do."
                                )
                                .font(.system(size: 12))
                                .foregroundStyle(Brand.inkSoft)
                                ForEach(held) { item in
                                    Text("· \(item.name) — \(item.level)")
                                        .font(.system(size: 12))
                                        .foregroundStyle(Brand.inkFaint)
                                }
                            }
                        }
                    }

                    if scans == nil {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                    } else if levels.isEmpty {
                        Card {
                            VStack(alignment: .leading, spacing: Brand.Space.tight) {
                                Text("Nothing measured yet").font(.headline).foregroundStyle(Brand.ink)
                                Text("Scan a room and it lands here, on the floor you scanned it on.")
                                    .font(.callout)
                                    .foregroundStyle(Brand.inkSoft)
                            }
                        }
                    }

                    // Each storey through the collection shell (ORD-15): the
                    // rooms as a rail led by the dashed + tile, the storey
                    // drawing above it, the full-width rows behind `See all`.
                    ForEach(levels, id: \.self) { level in
                        let rooms = (scans ?? []).filter { $0.level == level }
                        let area = rooms.reduce(0) { $0 + $1.floorAreaSqm }

                        CollectionShell(
                            title: level.uppercased(),
                            count: rooms.count,
                            caption:
                                "\(Measure.sqftLabel(area)) · \(rooms.count) room\(rooms.count == 1 ? "" : "s")",
                            onAdd: { capturing = true }
                        ) {
                            // The storey as one drawing, tappable — the plan
                            // view of the same rooms railed below it.
                            if rooms.contains(where: { $0.geometry != nil }) {
                                Card(padding: Brand.Space.small) {
                                    LevelCanvas(rooms: rooms) { room in
                                        openRoom = room
                                    }
                                }
                            }
                        } rail: {
                            ForEach(rooms) { room in
                                NavigationLink(value: room) {
                                    RoomRailCard(room: room)
                                }
                                .buttonStyle(.plain)
                            }
                        } expanded: {
                            ForEach(rooms) { room in
                                // A button, not a NavigationLink: the room
                                // detail is an inspector sheet over this
                                // screen, so a row tap and a canvas tap are
                                // the same act — select the room.
                                Button {
                                    openRoom = room
                                } label: {
                                    Card(padding: Brand.Space.small) {
                                        CardRow {
                                            HStack(spacing: Brand.Space.small) {
                                                RoomGlyph(stairs: room.stairCount > 0)
                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text(room.name)
                                                        .font(.system(size: 15, weight: .semibold))
                                                        .foregroundStyle(Brand.ink)
                                                    Text(
                                                        "\(room.doorCount) door\(room.doorCount == 1 ? "" : "s") · \(room.windowCount) window\(room.windowCount == 1 ? "" : "s")"
                                                    )
                                                    .font(.system(size: 12))
                                                    .foregroundStyle(Brand.inkFaint)
                                                }
                                                Spacer()
                                                Text(Measure.sqftLabel(room.floorAreaSqm))
                                                    .font(.system(size: 14, weight: .bold))
                                                    .monospacedDigit()
                                                    .foregroundStyle(Brand.inkSoft)
                                            }
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: Brand.Space.small) {
                        HStack {
                            SectionHeading(
                                title: "EQUIPMENT",
                                trailing: runningUnits > 0 ? "\(runningUnits) running" : nil)
                            Spacer()
                            Button {
                                // Same one-sheet rule as the Scan button:
                                // the inspector may be up at medium detent.
                                openRoom = nil
                                addingEquipment = true
                            } label: {
                                Label("Add", systemImage: "plus.circle.fill")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundStyle(Brand.blue)
                            }
                            .buttonStyle(.plain)
                        }

                        if equipment.isEmpty {
                            Card(padding: Brand.Space.small) {
                                Text("Air movers and dehumidifiers bill per unit per day. Logged when they land, they bill themselves.")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Brand.inkSoft)
                            }
                        }

                        ForEach(equipment) { item in
                            Card(padding: Brand.Space.small) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(
                                            item.quantity > 1
                                                ? "\(item.quantity)× \(item.kind)" : item.kind
                                        )
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(Brand.ink)
                                        StatusBadge(
                                            text: item.isRunning ? "On site" : "Collected",
                                            tone: item.isRunning ? .active : .neutral)
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 1) {
                                        Text("\(item.unitDays())")
                                            .font(.system(size: 17, weight: .bold))
                                            .monospacedDigit()
                                            .foregroundStyle(Brand.ink)
                                        Text("unit-days")
                                            .font(.system(size: 10, weight: .semibold))
                                            .foregroundStyle(Brand.inkFaint)
                                    }
                                    if item.isRunning {
                                        Button {
                                            Task {
                                                try? await API.shared.collectEquipment(id: item.id)
                                                await load()
                                            }
                                        } label: {
                                            Text("Collected")
                                                .font(.system(size: 12, weight: .bold))
                                                .foregroundStyle(Brand.inkSoft)
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 7)
                                                .background(Brand.surfaceRaised, in: .capsule)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }

                    // The report, one tap from the job it describes.
                    NavigationLink {
                        ReportShareView(projectId: project.id, projectName: project.name)
                    } label: {
                        Card(padding: Brand.Space.small) {
                            CardRow {
                                Label("Report — make and send the PDF", systemImage: "doc.richtext")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(Brand.ink)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, Brand.Space.base)
                .padding(.top, Brand.Space.small)
                .padding(.bottom, 96)
            }
            .refreshable { await load() }

            // A camera rather than a plus, the way Jobber's turns into one on
            // a visit: on a property, the thing you add is a measured room.
            FloatingAction(icon: "camera.viewfinder", label: "Scan") {
                // Reachable while the room inspector sits at its medium
                // detent (background interaction is on). One view cannot
                // present two sheets, so close the inspector first and let
                // SwiftUI sequence the swap.
                openRoom = nil
                capturing = true
            }
            .padding(.trailing, Brand.Space.large)
            .padding(.bottom, Brand.Space.large)
        }
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.large)
        // The room detail is a sheet, not a push (ORD-13): at its medium
        // detent the storey canvas stays visible behind it, and tapping a
        // sibling room there re-targets this binding, which swaps the sheet's
        // content in place. `.id(room.id)` makes that swap a fresh view —
        // without it the new room would inherit the old one's loaded areas
        // and readings, because sheet content keeps its @State while the
        // sheet stays up. Reload on dismiss because the inspector can change
        // what this screen shows — a re-typed room moves the living-area
        // figure, an adjusted plan redraws the canvas.
        .sheet(item: $openRoom, onDismiss: { Task { await load() } }) { room in
            RoomDetailView(room: room)
                .id(room.id)
        }
        .sheet(isPresented: $addingEquipment) {
            AddEquipmentSheet(projectId: project.id) { Task { await load() } }
        }
        .sheet(isPresented: $capturing) {
            CaptureFlow(
                projectId: project.id,
                projectName: project.name,
                existingCount: (scans ?? []).count,
                onSaved: { Task { await load() } })
        }
        .task {
            // Anything held from a previous visit goes up on arrival, before
            // the list is drawn, so a reconnected phone catches up quietly.
            if await ScanQueue.shared.flush() > 0 { await load() }
            await load()
        }
    }

    private func load() async {
        do {
            async let s = API.shared.scans(projectId: project.id)
            async let e = API.shared.equipment(projectId: project.id)
            scans = try await s
            // Equipment failing is not a reason to hide the survey — the two
            // are independent, and a job may simply have no drying on it.
            equipment = (try? await e) ?? []
            error = nil
        } catch {
            self.error = error.localizedDescription
            if scans == nil { scans = [] }
        }
    }
}

/// One room as a rail card — the same facts as the full row, sized for the
/// collection shell's horizontal rail. The row itself is one `See all` away.
private struct RoomRailCard: View {
    let room: RoomScan

    var body: some View {
        VStack(alignment: .leading, spacing: Brand.Space.tight) {
            RoomGlyph(stairs: room.stairCount > 0)
            Spacer(minLength: 0)
            Text(room.name)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Brand.ink)
                .lineLimit(1)
            Text(Measure.sqftLabel(room.floorAreaSqm))
                .font(.system(size: 11, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(Brand.inkSoft)
        }
        .padding(Brand.Space.small)
        .frame(width: 124, height: 108, alignment: .topLeading)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.card)
                .strokeBorder(Brand.hairline, lineWidth: 0.5))
    }
}

/// A small plan-shaped mark, so a room reads as a room in a list of them.
private struct RoomGlyph: View {
    let stairs: Bool

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 6)
                .fill(Brand.blue.opacity(0.10))
            Image(systemName: stairs ? "stairs" : "square.split.bottomrightquarter")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Brand.blue)
        }
        .frame(width: 36, height: 36)
    }
}
