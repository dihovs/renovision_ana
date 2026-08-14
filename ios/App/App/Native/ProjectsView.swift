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

                    if let error {
                        Card {
                            Label(error, systemImage: "exclamationmark.triangle.fill")
                                .font(.footnote)
                                .foregroundStyle(.orange)
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

                    ForEach(levels, id: \.self) { level in
                        let rooms = (scans ?? []).filter { $0.level == level }
                        let area = rooms.reduce(0) { $0 + $1.floorAreaSqm }

                        VStack(alignment: .leading, spacing: Brand.Space.small) {
                            SectionHeading(
                                title: level.uppercased(),
                                trailing: "\(Measure.sqftLabel(area)) · \(rooms.count) room\(rooms.count == 1 ? "" : "s")"
                            )

                            ForEach(rooms) { room in
                                NavigationLink(value: room) {
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

                    if !equipment.isEmpty {
                        VStack(alignment: .leading, spacing: Brand.Space.small) {
                            SectionHeading(
                                title: "EQUIPMENT",
                                trailing: runningUnits > 0 ? "\(runningUnits) running" : nil)

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
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, Brand.Space.base)
                .padding(.top, Brand.Space.small)
                .padding(.bottom, 96)
            }
            .refreshable { await load() }

            // A camera rather than a plus, the way Jobber's turns into one on
            // a visit: on a property, the thing you add is a measured room.
            FloatingAction(icon: "camera.viewfinder", label: "Scan") {
                capturing = true
            }
            .padding(.trailing, Brand.Space.large)
            .padding(.bottom, Brand.Space.large)
        }
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: RoomScan.self) { RoomDetailView(room: $0) }
        .sheet(isPresented: $capturing) {
            CaptureFlow(
                projectId: project.id,
                projectName: project.name,
                existingCount: (scans ?? []).count,
                onSaved: { Task { await load() } })
        }
        .task { await load() }
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
