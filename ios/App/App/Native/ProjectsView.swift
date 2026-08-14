import SwiftUI

/// Every property being worked on.
///
/// The first genuinely native CRM screen. What it buys over the WebView it
/// replaces is not appearance — it is that a list scrolls the way an iPhone
/// list scrolls, pull-to-refresh is the system's, and search is the system's.
/// Those are the things that made the wrapped version feel wrong and that no
/// amount of CSS was going to fix.
struct ProjectsView: View {
    let onSignedOut: () -> Void

    @State private var projects: [ProjectSummary]?
    @State private var error: String?
    @State private var query = ""

    private var shown: [ProjectSummary] {
        guard let projects else { return [] }
        guard !query.isEmpty else { return projects }
        return projects.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || ($0.clientName ?? "").localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if let error {
                    ContentUnavailableView {
                        Label("Could not load projects", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Try again") { Task { await load() } }
                    }
                } else if projects == nil {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if shown.isEmpty {
                    ContentUnavailableView(
                        query.isEmpty ? "No projects" : "No match",
                        systemImage: query.isEmpty ? "folder" : "magnifyingglass",
                        description: Text(
                            query.isEmpty
                                ? "A measurement belongs to a job. Create the project first and its floor plans live inside it."
                                : "Nothing matches “\(query)”.")
                    )
                } else {
                    List(shown) { project in
                        NavigationLink(value: project) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(project.name)
                                    .font(.body.weight(.semibold))
                                HStack(spacing: 6) {
                                    Text(project.clientName ?? "No client")
                                    if project.roomCount > 0 {
                                        Text("·")
                                        Text("^[\(project.roomCount) room](inflect: true) measured")
                                    }
                                }
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Projects")
            .navigationDestination(for: ProjectSummary.self) { ProjectDetailView(project: $0) }
            .searchable(text: $query, prompt: "Search projects or clients")
            .refreshable { await load() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Refresh") { Task { await load() } }
                        Button("Sign out", role: .destructive) { onSignedOut() }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
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

/// One property: its survey, its damage, its equipment.
struct ProjectDetailView: View {
    let project: ProjectSummary

    @State private var scans: [RoomScan]?
    @State private var equipment: [EquipmentPlacement] = []
    @State private var error: String?

    /// Storeys in building order, not the order they happened to be scanned —
    /// a basement measured last still belongs at the bottom of the list.
    private static let order = ["Basement", "Ground", "2nd", "3rd", "Attic"]

    private var levels: [String] {
        let found = Set((scans ?? []).map(\.level))
        let known = Self.order.filter(found.contains)
        let rest = found.subtracting(Self.order).sorted()
        return known + rest
    }

    private var floorAreaSqm: Double {
        (scans ?? []).reduce(0) { $0 + $1.floorAreaSqm }
    }

    private var wallAreaSqm: Double {
        (scans ?? []).reduce(0) { $0 + $1.wallLengthM * $1.ceilingHeightM }
    }

    var body: some View {
        List {
            Section {
                HStack(spacing: 0) {
                    Stat("Floor", Measure.sqftLabel(floorAreaSqm))
                    Divider()
                    Stat("Walls", Measure.sqftLabel(wallAreaSqm))
                    Divider()
                    Stat("Rooms", "\((scans ?? []).count)")
                }
                .frame(maxWidth: .infinity)
                .listRowInsets(EdgeInsets(top: 12, leading: 8, bottom: 12, trailing: 8))
            }

            if let error {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            }

            if scans == nil {
                Section { ProgressView() }
            } else if levels.isEmpty {
                Section {
                    Text("Nothing measured yet. Scan a room and it lands here.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            }

            ForEach(levels, id: \.self) { level in
                let rooms = (scans ?? []).filter { $0.level == level }
                Section(level) {
                    ForEach(rooms) { room in
                        NavigationLink(value: room) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(room.name).font(.body.weight(.medium))
                                    if room.stairCount > 0 {
                                        Text("Staircase — priced separately")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Text(Measure.sqftLabel(room.floorAreaSqm))
                                    .font(.subheadline.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            if !equipment.isEmpty {
                Section("Equipment") {
                    ForEach(equipment) { item in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.quantity > 1 ? "\(item.quantity)× \(item.kind)" : item.kind)
                                Text(item.isRunning ? "Still on site" : "Collected")
                                    .font(.caption2)
                                    .foregroundStyle(item.isRunning ? Color.brandBlue : .secondary)
                            }
                            Spacer()
                            Text("\(item.unitDays()) unit-days")
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: RoomScan.self) { RoomDetailView(room: $0) }
        .refreshable { await load() }
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

private struct Stat: View {
    let label: String
    let value: String

    init(_ label: String, _ value: String) {
        self.label = label
        self.value = value
    }

    var body: some View {
        VStack(spacing: 2) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.bold().monospacedDigit())
        }
        .frame(maxWidth: .infinity)
    }
}
