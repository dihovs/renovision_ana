import MapKit
import PhotosUI
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
    /// The project being opened. A grid card is a button rather than a
    /// NavigationLink, so the push is driven from here.
    @State private var opened: ProjectSummary?
    @State private var filter: ProjectFilter = .all
    @State private var creatingNow = false
    @StateObject private var queue = ScanQueue.shared
    /// Set by the card's "…" menu; the confirmation dialog it drives is the
    /// only thing that actually calls `archive`. A one-tap Archive in a menu
    /// is one distracted thumb away from a real job disappearing off the
    /// list, and there is no undo surfaced anywhere yet.
    @State private var archiving: ProjectSummary?
    /// The project whose `Move` sheet is open, and the names to offer in it.
    @State private var assigning: ProjectSummary?
    @State private var assignees: [String] = []
    /// Guards Duplicate against a double tap making two copies of a job.
    @State private var duplicating = false

    /// The reference's own three: All / Favorites / Archived.
    ///
    /// This screen used to filter by measured / to-measure instead, on the
    /// reasoning that "has anybody been there yet" is what decides whether
    /// you drive out. That reasoning was not wrong, but it was not the
    /// owner's — and the standing instruction is that the interface matches
    /// what his hands already know. Measured-ness is still visible on every
    /// card's own caption, which is where it was doing its work anyway.
    ///
    /// `archived` is not a client-side filter like the other two: the
    /// ordinary list never contains an archived project, so choosing it
    /// re-queries the server.
    enum ProjectFilter: Hashable { case all, favorites, archived }

    private var shown: [ProjectSummary] {
        guard let projects else { return [] }
        // .archived is already the whole of what was fetched; .all excludes
        // nothing. Only favourites narrows what is in hand.
        let byFilter = filter == .favorites ? projects.filter(\.favorite) : projects
        guard !query.isEmpty else { return byFilter }
        return byFilter.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || ($0.clientName ?? "").localizedCaseInsensitiveContains(query)
        }
    }

    private var measured: Int { (projects ?? []).reduce(0) { $0 + $1.roomCount } }

    private var emptyTitle: String {
        if !query.isEmpty { return "No match" }
        switch filter {
        case .all: return "No projects yet"
        case .favorites: return "Nothing starred yet"
        case .archived: return "Nothing archived yet"
        }
    }

    private var emptyBody: String {
        if !query.isEmpty { return "Nothing matches “\(query)”." }
        switch filter {
        case .all:
            return "A measurement belongs to a job. Create the project first and its floor plans live inside it."
        case .favorites:
            return "Star a job from its ⋯ menu and it collects here — the handful you are actually working this week."
        case .archived:
            return "Archived jobs are kept indefinitely. Nothing measured under them is deleted, and any of them can be restored."
        }
    }

    var body: some View {
        // Pinned light, like the reference and like every other
        // surface that shows a drawing.
        list.environment(\.colorScheme, .light)
    }

    private var list: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                Brand.Plan.sheet.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Brand.Space.base) {
                        if let projects, !projects.isEmpty {
                            WorkspaceInfoRow(
                                projectCount: projects.count, pendingUploads: queue.pending.count)

                            FilterChips(
                                options: [
                                    (.all, "All", "briefcase"),
                                    (.favorites, "Favorites", "star"),
                                    (.archived, "Archived", "archivebox"),
                                ],
                                selection: $filter)
                            .padding(.bottom, 2)
                            // Archived lives behind its own query, so moving
                            // to or from it has to refetch rather than just
                            // narrow what is already on screen.
                            .onChange(of: filter) { previous, next in
                                if previous == .archived || next == .archived {
                                    Task { await load() }
                                }
                            }
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
                                    Text(emptyTitle)
                                        .font(.headline)
                                        .foregroundStyle(Brand.ink)
                                    Text(emptyBody)
                                        .font(.callout)
                                        .foregroundStyle(Brand.inkSoft)
                                }
                            }
                        } else {
                            projectGrid
                        }
                    }
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.top, Brand.Space.small)
                    // Clear of the floating button, which otherwise covers the
                    // last row exactly when the list is long enough to matter.
                    .padding(.bottom, Brand.Space.large)
                }
                .refreshable { await load() }

                EmptyView()
            }
            .navigationTitle("Projects")
            .navigationDestination(item: $opened) { ProjectDetailView(project: $0) }
            .searchable(text: $query, prompt: "Search projects or clients")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Refresh") { Task { await load() } }
                        Button("New project with details…") { creating = true }
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
            .sheet(item: $assigning) { project in
                AssignProjectSheet(
                    projectName: project.name,
                    current: project.assignedTo,
                    suggestions: assignees
                ) { person in
                    Task { await assign(project, to: person) }
                }
            }
            .confirmationDialog(
                archiving.map { "Archive “\($0.name)”?" } ?? "",
                isPresented: Binding(
                    get: { archiving != nil }, set: { if !$0 { archiving = nil } }),
                titleVisibility: .visible
            ) {
                Button("Archive", role: .destructive) {
                    if let project = archiving { Task { await archive(project) } }
                }
                Button("Cancel", role: .cancel) { archiving = nil }
            } message: {
                Text("It comes off this list. Nothing measured under it is touched, and it can be restored later.")
            }
            .task { await load() }
        }
    }

    /// Create and open, with no form in between.
    ///
    /// The reference does exactly this: its New Project tile makes the project
    /// on the spot, names it by default and drops you on it. Nothing about a
    /// job is known at the moment it starts — the address gets typed from the
    /// van, the client is often a claim number for the first hour — so a form
    /// demanding a name before anything can exist is a form answered with
    /// junk. The name is editable on the project itself, which is where the
    /// operator is standing when they finally know it.
    ///
    /// The old form is still there under the menu, for a job booked at a desk
    /// with the client and address already in hand.

    /// Extracted from `list`'s body on purpose. Inlined, the grid's closures
    /// (caption, thumbnail, menu, isFavorite — four of them, each generic
    /// over Item) pushed the whole ScrollView past what the Swift type
    /// checker will solve in reasonable time, and the build failed with
    /// exactly that message. Naming the sub-expression gives the solver a
    /// boundary to stop at.
    @ViewBuilder private var projectGrid: some View {
        // The reference's grid, measured off the device:
        // two columns, the dashed add tile first, the
        // label BELOW the card rather than inside it.
        CardGrid(
            items: shown,
            addLabel: "New Project",
            // No create tile among the archived: making a
            // new job from the drawer of put-away ones
            // would file it somewhere it cannot be seen.
            // Opens the form; the project is created by
            // Save inside it. Tapping + used to create on
            // the spot (the reference does), and that
            // filled the grid with empty "New project N"
            // rows every time somebody looked and came
            // back. A job with nothing in it is not a job.
            onAdd: filter == .archived ? nil : { creating = true },
            onOpen: { opened = $0 },
            caption: { project in
                // Who it is on takes the third line when
                // set: on a list of jobs, "Marc" answers
                // a question the room count does not.
                (project.name,
                 project.clientName ?? "No client",
                 project.assignedTo
                    ?? (project.roomCount > 0
                        ? "\(project.roomCount) room\(project.roomCount == 1 ? "" : "s")"
                        : "Not measured"))
            }
        ) { project in
            // The floor plan itself, drawn from the
            // largest room's geometry — the same renderer
            // the storey canvas uses, so a card and the
            // plan behind it cannot disagree. A project
            // with nothing measured has nothing to draw
            // and says so instead of faking a room.
            if let geometry = project.largestRoom {
                MiniPlan(geometry: geometry, floorRooms: project.floorRooms)
                    .padding(6)
            } else {
                Image(systemName: "doc")
                    .font(.system(size: 26, weight: .light))
                    .foregroundStyle(Brand.Plan.dimension.opacity(0.45))
            }
        } menu: { project in
            AnyView(
                ProjectCardMenu(
                    isFavorite: project.favorite,
                    isArchived: filter == .archived,
                    onFavorite: { Task { await toggleFavorite(project) } },
                    onMove: { assigning = project },
                    onDuplicate: { Task { await duplicate(project) } },
                    onArchive: { archiving = project },
                    onRestore: { Task { await restore(project) } }))
        } isFavorite: { project in
            project.favorite
        }
    }

    private func createNow() async {
        guard !creatingNow else { return }
        creatingNow = true
        defer { creatingNow = false }

        // Unique against what is on screen, so a phone that makes three in a
        // row does not show three identical cards.
        let base = "New project"
        let taken = Set((projects ?? []).map(\.name))
        var name = base
        var n = 2
        while taken.contains(name) {
            name = "\(base) \(n)"
            n += 1
        }

        do {
            let id = try await API.shared.createProject(
                name: name, clientId: nil, description: nil)
            await load()
            // Push the project just made, so the next tap is the work rather
            // than hunting for what was created.
            if let made = (projects ?? []).first(where: { $0.id == id }) { opened = made }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func restore(_ project: ProjectSummary) async {
        do {
            try await API.shared.restoreProject(id: project.id)
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func archive(_ project: ProjectSummary) async {
        archiving = nil
        do {
            try await API.shared.archiveProject(id: project.id)
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func toggleFavorite(_ project: ProjectSummary) async {
        do {
            try await API.shared.setProjectFavorite(id: project.id, favorite: !project.favorite)
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func assign(_ project: ProjectSummary, to person: String?) async {
        do {
            try await API.shared.assignProject(id: project.id, to: person)
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Copies the LAYOUT and opens the copy. Photos, moisture readings and
    /// equipment days are deliberately left behind — see `duplicateProject`
    /// server-side; they are evidence about one address and copying them
    /// into another job would fabricate a record rather than duplicate one.
    private func duplicate(_ project: ProjectSummary) async {
        guard !duplicating else { return }
        duplicating = true
        defer { duplicating = false }
        do {
            let id = try await API.shared.duplicateProject(id: project.id)
            await load()
            if let made = (projects ?? []).first(where: { $0.id == id }) { opened = made }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func load() async {
        do {
            let (list, people) = try await API.shared.projectsWithAssignees(
                archived: filter == .archived)
            projects = list
            assignees = people
            error = nil
        } catch APIError.notSignedIn {
            onSignedOut()
        } catch {
            self.error = error.localizedDescription
            if projects == nil { projects = [] }
        }
    }
}

/// The reference's account-switcher header, in the one shape that is
/// actually true here: this app is one operator, one company, cookie-signed
/// in as `rv_admin` — there is no workspace to switch and no per-user avatar
/// to show, so copying that chrome would be furniture, not information.
///
/// What IS real and belongs in the same slot: how many jobs are open, and
/// whether anything measured off-grid is still sitting on this phone. The
/// second one is the honest version of the reference's cloud glyph — not a
/// decoration, but `ScanQueue`'s own count of scans a basement's missing
/// signal left unsent, which already drives the banner on every project's
/// own screen. A phone fully synced says so as plainly as one still catching
/// up.
struct WorkspaceInfoRow: View {
    let projectCount: Int
    let pendingUploads: Int

    var body: some View {
        HStack {
            Text("\(projectCount) project\(projectCount == 1 ? "" : "s")")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Brand.Plan.labelSoft)

            Spacer()

            if pendingUploads > 0 {
                Label("\(pendingUploads) waiting to send", systemImage: "arrow.up.circle")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.orange)
            } else {
                Image(systemName: "checkmark.icloud")
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.Plan.labelSoft.opacity(0.7))
            }
        }
    }
}

/// The reference's small round "…" in a card's corner. The one action behind
/// it right now is Archive — this app has no per-project rename, duplicate or
/// share yet, and a menu item that does nothing is worse than a menu one item
/// shorter than the reference's own.
private struct ProjectCardMenu: View {
    let isFavorite: Bool
    /// True when this card is being shown under the `Archived` chip. An
    /// archived project's one useful action is coming back, and offering to
    /// archive it again would be a no-op dressed as a choice.
    let isArchived: Bool
    let onFavorite: () -> Void
    let onMove: () -> Void
    let onDuplicate: () -> Void
    let onArchive: () -> Void
    let onRestore: () -> Void

    var body: some View {
        Menu {
            if isArchived {
                Button(action: onRestore) {
                    Label("Restore", systemImage: "arrow.uturn.backward")
                }
            } else {
                // The reference's own order (INT-P03): Favorite · Move ·
                // Duplicate, then Archive separated below in red. Only the
                // destructive one carries an ellipsis, because only it asks a
                // second question.
                Button(action: onFavorite) {
                    Label(
                        isFavorite ? "Remove from favourites" : "Favourite",
                        systemImage: isFavorite ? "star.slash" : "star")
                }
                Button(action: onMove) { Label("Move", systemImage: "person.crop.circle") }
                Button(action: onDuplicate) { Label("Duplicate", systemImage: "doc.on.doc") }
                Divider()
                Button(role: .destructive, action: onArchive) {
                    Label("Archive…", systemImage: "archivebox")
                }
            }
        } label: {
            // The visible circle stays 24pt — matching the reference's own
            // scale — but the tappable area is the full 44pt HIG minimum,
            // anchored to the same corner so the extra hit area extends
            // inward rather than shifting the glyph off its drawn position.
            ZStack(alignment: .bottomTrailing) {
                Color.clear
                Image(systemName: "ellipsis")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Brand.Plan.label)
                    .frame(width: 24, height: 24)
                    .background(.regularMaterial, in: Circle())
                    .overlay(Circle().strokeBorder(Brand.Plan.dimension.opacity(0.15), lineWidth: 0.5))
            }
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
    }
}

/// `Move` — hand a job to somebody.
///
/// A name, typed or tapped, NOT a picker over an employee list: this app has
/// no staff table and migration 0035 explains why that is deliberate rather
/// than missing. The crew is a handful of names the owner knows, and the
/// suggestions here are simply the names already used on other jobs — so the
/// roster maintains itself and cannot list somebody who has never been given
/// any work.
struct AssignProjectSheet: View {
    let projectName: String
    let current: String?
    let suggestions: [String]
    let onAssign: (String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""

    private var trimmed: String { name.trimmed }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.base) {
                        Card {
                            VStack(alignment: .leading, spacing: Brand.Space.tight) {
                                Text("WHO IS ON IT")
                                    .font(.system(size: 10, weight: .heavy))
                                    .foregroundStyle(Brand.inkFaint)
                                TextField("Name", text: $name)
                                    .font(.system(size: 16, weight: .semibold))
                                    .textInputAutocapitalization(.words)
                                    .autocorrectionDisabled()
                            }
                        }

                        if !suggestions.isEmpty {
                            VStack(alignment: .leading, spacing: Brand.Space.small) {
                                SectionHeading(title: "ALREADY ON OTHER JOBS")
                                LazyVGrid(
                                    columns: [
                                        GridItem(.adaptive(minimum: 110), spacing: Brand.Space.tight)
                                    ],
                                    alignment: .leading, spacing: Brand.Space.tight
                                ) {
                                    ForEach(suggestions, id: \.self) { person in
                                        Button {
                                            name = person
                                        } label: {
                                            Text(person)
                                                .font(.system(size: 13, weight: .bold))
                                                .lineLimit(1)
                                                .foregroundStyle(
                                                    trimmed == person ? .white : Brand.inkSoft
                                                )
                                                .frame(maxWidth: .infinity)
                                                .padding(.vertical, 9)
                                                .background(
                                                    trimmed == person
                                                        ? Brand.charcoalDark : Brand.surfaceRaised,
                                                    in: .rect(cornerRadius: Brand.Radius.pill))
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }

                        Button("Assign") {
                            onAssign(trimmed.isEmpty ? nil : trimmed)
                            dismiss()
                        }
                        .buttonStyle(PrimaryButtonStyle(enabled: trimmed != (current ?? "")))
                        .disabled(trimmed == (current ?? ""))

                        // Clearing is its own act, not an empty Save: a job
                        // handed back to nobody is a real state, and making
                        // it reachable only by deleting text is how it gets
                        // done by accident.
                        if current != nil {
                            Button(role: .destructive) {
                                onAssign(nil)
                                dismiss()
                            } label: {
                                Label("Unassign", systemImage: "person.crop.circle.badge.xmark")
                                    .font(.system(size: 14, weight: .semibold))
                            }
                        }

                        Text("A name, not an account — there is nobody to set up first. Whoever you type here is offered back on the next job.")
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                    }
                    .padding(Brand.Space.base)
                }
            }
            .navigationTitle(projectName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
            .onAppear { name = current ?? "" }
        }
    }
}

/// The project's Forms tab, reached from the card above Statistics.
///
/// Empty by design for now, and honest about it: the reference's forms are a
/// template system (checklists, questionnaires, report templates) that has
/// not been built here. The row exists because the reference puts one there
/// and a hand looking for it should find it, not because it does anything
/// yet. `InspectorFormsTab` is the same empty state the room and wall
/// sheets already show — one copy, three places.
struct ProjectFormsView: View {
    let projectName: String

    var body: some View {
        Form {
            InspectorFormsTab(
                subject: "this project",
                footer:
                    "Claim details for the job live on the project itself; the drying record and the measurements live on each room.")
        }
        .navigationTitle("Forms")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// One property: its survey and its rooms.
struct ProjectDetailView: View {
    let project: ProjectSummary

    @State private var scans: [RoomScan]?
    @State private var error: String?
    @State private var capturing = false
    @State private var showingStatistics = false
    @State private var openRoom: RoomScan?
    /// ORD-16 — where a finished capture lands: the drawn plan for the storey
    /// just measured, not this list. Held in two steps because a push made
    /// while a sheet is still dismissing gets dropped: the flow records its
    /// intent here, and the sheet's own dismissal performs it.
    @State private var landingIntent: PlanLanding?
    @State private var landing: PlanLanding?
    /// The description and address, read separately from the list payload.
    @State private var record: ProjectRecord?
    @State private var editingDetails = false
    @State private var pickingLocation = false
    /// The Add Floor sheet, and the storey it chose. Two sheets cannot be up
    /// at once, so the level is held here and the capture flow is opened by
    /// the chooser's own dismissal.
    @State private var addingFloor = false
    @State private var pendingLevel: String?
    @State private var openFloor: String?
    @State private var projectFiles: [RoomPhoto] = []
    @State private var sharing = false
    @StateObject private var queue = ScanQueue.shared

    /// Storeys in building order, not the order they happened to be scanned —
    /// a basement measured last still belongs at the bottom of the list.
    private static let order = ["Basement", "Ground", "2nd", "3rd", "Attic"]

    private var levels: [String] {
        let found = Set((scans ?? []).map(\.level))
        return Self.order.filter(found.contains) + found.subtracting(Self.order).sorted()
    }

    private var floorAreaSqm: Double { (scans ?? []).reduce(0) { $0 + $1.floorAreaSqmTrusted } }
    private var wallAreaSqm: Double {
        (scans ?? []).reduce(0) { $0 + $1.wallAreaGrossSqm }
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Brand.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: Brand.Space.base) {
                    // Description, then the property address, then Forms —
                    // the reference's own order. All three are about WHICH
                    // job this is, and they sit above the numbers because
                    // that is the question you answer first on opening a
                    // job you have not seen for a week.
                    NavigationLink {
                        ProjectInfoView(projectId: project.id, record: record) {
                            Task { await load() }
                        }
                    } label: {
                        Card(padding: Brand.Space.small) {
                            HStack(alignment: .top, spacing: Brand.Space.small) {
                                Image(systemName: "text.alignleft")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Brand.inkFaint)
                                Text(
                                    record?.description?.isEmpty == false
                                        ? (record?.description ?? "")
                                        : "Add project description…")
                                    .font(.system(size: 15))
                                    .foregroundStyle(
                                        record?.description?.isEmpty == false
                                            ? Brand.ink : Brand.inkFaint)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                Image(systemName: "square.and.pencil")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Brand.blue)
                            }
                        }
                    }
                    .buttonStyle(.plain)

                    // Not wrapped in a Button: the card has two targets of
                    // its own — the map goes to Apple Maps, the text comes
                    // here to be edited — and an outer button would swallow
                    // both.
                    ProjectAddressCard(
                        lines: record?.addressLines ?? [],
                        query: [record?.addressLine1, record?.addressCity, record?.addressPostal]
                            .compactMap { $0 }
                            .filter { !$0.isEmpty }
                            .joined(separator: ", "),
                        onEdit: { pickingLocation = true })

                    // Forms, where the reference puts it: above Statistics,
                    // its own card with a chevron. Empty for now — the
                    // template machinery is S-level work — but the row is
                    // where the hand expects to find it.
                    NavigationLink {
                        ProjectFormsView(projectName: project.name)
                    } label: {
                        Card(padding: Brand.Space.small) {
                            CardRow {
                                Label("Forms", systemImage: "list.clipboard")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(Brand.ink)
                            }
                        }
                    }
                    .buttonStyle(.plain)

                    // Statistics, in the reference's own four: Floor Area ·
                    // Wall Area · # Floors · # Rooms, with See All beside the
                    // heading. Living area is NOT one of them — it belongs to
                    // the See All sheet, which is where a figure that needs a
                    // definition beside it can have one.
                    SectionHeadingRow(title: "Statistics", action: "See All") {
                        showingStatistics = true
                    }
                    StatBand(items: [
                        .init(
                            label: "Floor Area",
                            value: "\(Int(Measure.squareFeet(floorAreaSqm).rounded()))",
                            unit: "sq ft"),
                        .init(
                            label: "Wall Area",
                            value: "\(Int(Measure.squareFeet(wallAreaSqm).rounded()))",
                            unit: "sq ft"),
                        .init(label: "# Floors", value: "\(levels.count)"),
                        .init(label: "# Rooms", value: "\((scans ?? []).count)"),
                    ])

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
                    }

                    floorPlansSection

                    // Photos and Files, the reference's own two rails below
                    // the plans. Both are the JOB's own — a photo of the
                    // building from the street, the adjuster's letter —
                    // which is what "attached to no room" means. A room's
                    // photos stay on the room's own sheet.
                    SectionHeadingRow(title: "Photos")
                    Text("Add photos and share reports.")
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.inkSoft)
                    ProjectFileRail(
                        projectId: project.id,
                        files: projectFiles.filter { $0.isImage },
                        addLabel: "Add photo",
                        onChanged: { Task { await loadFiles() } })

                    SectionHeadingRow(title: "Files")
                    Text("Scan or upload documents from your device.")
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.inkSoft)
                    ProjectFileRail(
                        projectId: project.id,
                        files: projectFiles.filter { !$0.isImage },
                        addLabel: "Add file",
                        onChanged: { Task { await loadFiles() } })

                    ProjectAuthorshipBlock(
                        assignedTo: record?.assignedTo,
                        createdAt: record?.createdAt,
                        updatedAt: record?.updatedAt)

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
        }
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // The reference hangs the project's own actions off its title,
            // which keeps the toolbar free for share. Same set as the card's
            // ⋯ menu, plus the two that only make sense once you are inside.
            ToolbarItem(placement: .principal) {
                Menu {
                    Button { sharing = true } label: {
                        Label("Export…", systemImage: "square.and.arrow.up")
                    }
                    Divider()
                    NavigationLink {
                        ProjectInfoView(projectId: project.id, record: record) {
                            Task { await load() }
                        }
                    } label: {
                        Label("Edit Project Details", systemImage: "pencil")
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(project.name)
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Brand.ink)
                            .lineLimit(1)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Brand.inkSoft)
                    }
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { sharing = true } label: { Image(systemName: "square.and.arrow.up") }
            }
        }
        .sheet(isPresented: $sharing) {
            ProjectExportSheet(
                projectId: project.id,
                projectName: project.name,
                onShowFiles: {})
        }
        .sheet(
            isPresented: $addingFloor,
            onDismiss: {
                // Opened here rather than from the row's action: SwiftUI
                // will not raise a second view while the first is still
                // dismissing, and the floor would simply never appear.
                if let chosen = pendingLevel {
                    openFloor = chosen
                    pendingLevel = nil
                }
            }
        ) {
            AddFloorSheet(existing: Set(levels)) { level in pendingLevel = level }
        }
        .sheet(isPresented: $pickingLocation) {
            ProjectLocationPicker(
                projectName: project.name,
                initial: nil,
                initialQuery: [record?.addressLine1, record?.addressCity, record?.addressPostal]
                    .compactMap { $0 }
                    .filter { !$0.isEmpty }
                    .joined(separator: ", ")
            ) { line1, city, postal in
                Task {
                    await saveDetails(
                        ProjectDetailsSheet.Patch(
                            description: record?.description,
                            line1: line1, city: city, postal: postal))
                }
            }
        }
        .sheet(isPresented: $editingDetails) {
            ProjectDetailsSheet(projectName: project.name, record: record) { patch in
                Task { await saveDetails(patch) }
            }
        }
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
        .sheet(isPresented: $showingStatistics) {
            ProjectStatisticsSheet(rooms: scans ?? [], projectId: project.id)
        }
        .sheet(
            isPresented: $capturing,
            onDismiss: {
                landing = landingIntent
                landingIntent = nil
                pendingLevel = nil
            }
        ) {
            CaptureFlow(
                projectId: project.id,
                projectName: project.name,
                existingCount: (scans ?? []).count,
                existingNames: (scans ?? []).map(\.name),
                initialLevel: pendingLevel,
                // Add Floor lands on the drawing canvas: the reference's
                // floor screen IS that canvas, and picking a storey there
                // has already said how the room is being measured.
                initialMode: pendingLevel == nil ? nil : .draw,
                onSaved: { Task { await load() } },
                onFinished: { level, filed in
                    landingIntent = PlanLanding(level: level, filed: filed)
                })
        }
        // The one navigation hook ORD-16 asks of this screen: a finished
        // capture pushes the storey it was on, drawn.
        .navigationDestination(item: $openFloor) { level in
            FloorCanvasView(
                projectId: project.id, projectName: project.name, level: level)
        }
        .navigationDestination(item: $landing) { destination in
            StoreyPlanView(
                projectId: project.id,
                projectName: project.name,
                level: destination.level,
                arrivals: destination.filed)
        }
        .task {
            // Anything held from a previous visit goes up on arrival, before
            // the list is drawn, so a reconnected phone catches up quietly.
            if await ScanQueue.shared.flush() > 0 { await load() }
            await load()
        }
    }

    /// Pulled out of the row's own body: four ternaries inside one
    /// interpolated string, inside a builder already six levels deep, is
    /// what tipped the type checker over its time limit.

    /// Floor Plans — the reference's own section (object-model §2e): a rail
    /// of the plans that exist, led by the `+`, captioned with its sort
    /// order, with `See all (n)` opening the storeys in full below it.
    ///
    /// **This used to draw the `+` and nothing else.** The storeys were
    /// filed at the very bottom of the page, under Photos, Files and
    /// Created / Last modified — so the section that says "Floor Plans"
    /// held no floor plans, and the floor plans sat below everything with
    /// no heading tying them back. The owner found it immediately. It was
    /// also out of the documented page order, which puts Floor Plans above
    /// Photos and Files, not below them.
    ///
    /// Named rather than written inline for the reason `projectGrid` is:
    /// `CollectionShell`'s three trailing closures inside the page's
    /// `ScrollView` put the expression past what the type checker solves.
    @ViewBuilder private var floorPlansSection: some View {
        CollectionShell(
            title: "Floor Plans",
            count: levels.count,
            // Their caption states the order. On a job with a basement, a
            // ground floor and an attic, "sorted by floor level" is the
            // difference between reading the rail and searching it.
            caption: "Sorted by floor level.",
            onAdd: {
                openRoom = nil
                addingFloor = true
            }
        ) {
            EmptyView()
        } rail: {
            ForEach(levels, id: \.self) { level in
                FloorPlanTile(
                    level: level,
                    rooms: (scans ?? []).filter { $0.level == level },
                    onOpen: { openFloor = level },
                    onDelete: { Task { await deleteFloor(level) } })
            }
            if scans != nil && levels.isEmpty {
                // One ghost tile beside the +, so the row reads as a place
                // things go rather than as a lone button.
                GhostTile()
            }
        } expanded: {
            // `See all` — each storey in full: its drawing, its rooms as a
            // rail, and the full-width rows behind its own `See all`. This
            // is the content that used to sit at the bottom of the page,
            // now underneath the heading it belongs to.
            ForEach(levels, id: \.self) { level in
                storeySection(level)
            }
        }
    }

    /// One storey and its rooms. Extracted from the body for the same reason
    /// `projectGrid` was: `CollectionShell` takes three trailing closures,
    /// and nesting all of them inside a ForEach inside the page's ScrollView
    /// put the whole expression past what the type checker will solve.
    @ViewBuilder private func storeySection(_ level: String) -> some View {
                    let rooms = (scans ?? []).filter { $0.level == level }
                    let area = rooms.reduce(0) { $0 + $1.floorAreaSqmTrusted }

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
                                                Text(openingsCaption(room))
                                                    .font(.system(size: 12))
                                                    .foregroundStyle(Brand.inkFaint)
                                            }
                                            Spacer()
                                            Text(Measure.sqftLabel(room.floorAreaSqmTrusted))
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

    private func openingsCaption(_ room: RoomScan) -> String {
        let doors = "\(room.doorCount) door" + (room.doorCount == 1 ? "" : "s")
        let windows = "\(room.windowCount) window" + (room.windowCount == 1 ? "" : "s")
        return doors + " · " + windows
    }

    private func loadFiles() async {
        projectFiles = (try? await API.shared.projectFiles(projectId: project.id)) ?? []
    }

    private func saveDetails(_ patch: ProjectDetailsSheet.Patch) async {
        do {
            try await API.shared.updateProjectDetails(
                id: project.id,
                description: .some(patch.description),
                addressLine1: .some(patch.line1),
                addressCity: .some(patch.city),
                addressPostal: .some(patch.postal))
            record = try? await API.shared.project(id: project.id)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func load() async {
        do {
            scans = try await API.shared.scans(projectId: project.id)
            // The description and address come from their own endpoint; a
            // failure there costs those two fields, never the survey.
            record = try? await API.shared.project(id: project.id)
            await loadFiles()
            error = nil
        } catch {
            self.error = error.localizedDescription
            if scans == nil { scans = [] }
        }
    }

    /// Delete a whole storey.
    ///
    /// A floor is not a row — it is a STRING on every room standing on it —
    /// so this is the rooms, one call each. Sequentially and not
    /// concurrently, because a half-deleted floor is far easier to
    /// understand when it stopped at the room that failed than when four of
    /// seven went in parallel and the rest did not. The same reasoning
    /// `rotateDetachedRooms` records.
    ///
    /// `load()` runs whatever happened, so the rail shows what is really
    /// there rather than what was intended.
    private func deleteFloor(_ level: String) async {
        let doomed = (scans ?? []).filter { $0.level == level }
        for room in doomed {
            do {
                try await API.shared.deleteScan(id: room.id)
            } catch {
                self.error = "\(room.name) could not be deleted: \(error.localizedDescription)"
                break
            }
        }
        await load()
    }
}

/// Where a finished capture lands: a storey, and what the visit filed onto it.
/// Identity is the storey — landing twice on the same floor is one destination.
private struct PlanLanding: Hashable, Identifiable {
    let level: String
    let filed: [FiledRoom]

    var id: String { level }

    static func == (a: PlanLanding, b: PlanLanding) -> Bool { a.level == b.level }
    func hash(into hasher: inout Hasher) { hasher.combine(level) }
}

/// One room as a rail card — the same facts as the full row, sized for the
/// collection shell's horizontal rail. The row itself is one `See all` away.
private struct RoomRailCard: View {
    let room: RoomScan

    var body: some View {
        VStack(alignment: .leading, spacing: Brand.Space.tight) {
            // The room's OWN outline, not a generic mark. Six rooms on a rail
            // used to be six copies of one glyph; the shape is what lets you
            // pick the L-shaped one out without reading names. Falls back to
            // the glyph only when there is no geometry to draw — a typed room
            // that was never scanned.
            if room.geometry != nil {
                RoomThumbnail(room: room)
            } else {
                RoomGlyph(stairs: room.stairCount > 0)
            }
            Spacer(minLength: 0)
            Text(room.name)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Brand.ink)
                .lineLimit(1)
            Text(Measure.sqftLabel(room.floorAreaSqmTrusted))
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

/// Edit the job's description and the address of the property.
///
/// One sheet for both because they are the same question asked twice —
/// WHICH job is this — and because the reference reaches both from the same
/// two rows at the top of the page. Saving writes all four fields together,
/// which is safe: the server writes only the keys it is sent, and this sheet
/// is the only screen that sends any of them.
struct ProjectDetailsSheet: View {
    struct Patch {
        let description: String?
        let line1: String?
        let city: String?
        let postal: String?
    }

    let projectName: String
    let record: ProjectRecord?
    let onSave: (Patch) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var description = ""
    @State private var line1 = ""
    @State private var city = ""
    @State private var postal = ""
    @StateObject private var search = AddressSearch()

    var body: some View {
        NavigationStack {
            Form {
                Section("DESCRIPTION") {
                    TextField("What happened, in a line or two", text: $description, axis: .vertical)
                        .lineLimit(2...6)
                }
                Section("PROPERTY ADDRESS") {
                    // Search first, type second. An address typed blind into
                    // three boxes is the one that fails to geocode later and
                    // sends somebody to the wrong street; picking a real one
                    // Apple already knows about cannot. The fields below stay
                    // editable because a flooded triplex sometimes has a unit
                    // number no map knows.
                    TextField("Search an address", text: $search.query)
                        .textContentType(.fullStreetAddress)
                        .autocorrectionDisabled()

                    ForEach(search.results, id: \.self) { completion in
                        Button {
                            Task { await choose(completion) }
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(completion.title)
                                    .font(.system(size: 15))
                                    .foregroundStyle(Brand.ink)
                                if !completion.subtitle.isEmpty {
                                    Text(completion.subtitle)
                                        .font(.system(size: 12))
                                        .foregroundStyle(Brand.inkSoft)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }

                Section {
                    TextField("Street", text: $line1)
                        .textContentType(.streetAddressLine1)
                    TextField("City", text: $city)
                        .textContentType(.addressCity)
                    TextField("Postal code", text: $postal)
                        .textContentType(.postalCode)
                        .textInputAutocapitalization(.characters)
                }

                Section {
                    Text("The address of the property being worked on — not the client's billing address. They are often different, and this is the one the crew drives to.")
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.inkFaint)
                }
            }
            .navigationTitle(projectName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        onSave(
                            Patch(
                                description: description.trimmed,
                                line1: line1.trimmed,
                                city: city.trimmed,
                                postal: postal.trimmed))
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                description = record?.description ?? ""
                line1 = record?.addressLine1 ?? ""
                city = record?.addressCity ?? ""
                postal = record?.addressPostal ?? ""
            }
        }
    }

    /// Turn a chosen suggestion into the three stored fields.
    ///
    /// `MKLocalSearchCompletion` carries only display text; the structured
    /// parts come from resolving it, which is one more round trip and the
    /// reason this is not done for every suggestion as it appears.
    private func choose(_ completion: MKLocalSearchCompletion) async {
        let response = try? await MKLocalSearch(
            request: MKLocalSearch.Request(completion: completion)).start()
        guard let placemark = response?.mapItems.first?.placemark else {
            // Better a title in the street box than nothing: the operator can
            // correct it, and Save must never depend on a lookup succeeding.
            line1 = completion.title
            return
        }
        line1 = [placemark.subThoroughfare, placemark.thoroughfare]
            .compactMap { $0 }
            .joined(separator: " ")
        if line1.isEmpty { line1 = completion.title }
        city = placemark.locality ?? placemark.subAdministrativeArea ?? ""
        postal = placemark.postalCode ?? ""
        search.query = ""
    }
}

/// Apple's own address suggestions, as you type.
///
/// `MKLocalSearchCompleter` needs no key, no quota and no location
/// permission — it is asking Apple to complete a string, not asking where
/// the phone is. Restricted to addresses so a search for "Rue Saint" offers
/// streets rather than restaurants named after one.
@MainActor
final class AddressSearch: NSObject, ObservableObject, MKLocalSearchCompleterDelegate {
    @Published var results: [MKLocalSearchCompletion] = []
    @Published var query: String = "" {
        didSet { completer.queryFragment = query }
    }

    private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.resultTypes = .address
        completer.delegate = self
    }

    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        let found = completer.results
        Task { @MainActor in self.results = found }
    }

    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        // No signal, or a fragment Apple cannot complete. The typed fields
        // below are the fallback and still work, so this stays silent.
        Task { @MainActor in self.results = [] }
    }
}

/// A horizontal rail of the job's own photos or files, led by the dashed +.
///
/// Reuses `RoomPhotosSection`'s upload path through the same `/api/v1/photos`
/// POST, which already accepts a project with no room — that is exactly what
/// a job-level attachment is.
struct ProjectFileRail: View {
    let projectId: String
    let files: [RoomPhoto]
    let addLabel: String
    let onChanged: () -> Void

    @State private var picking = false

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Brand.Space.small) {
                AddTile(label: addLabel) { picking = true }
                ForEach(files) { file in
                    ProjectFileTile(file: file)
                }
                if files.isEmpty { GhostTile() }
            }
        }
        .sheet(isPresented: $picking) {
            ProjectFileUploader(projectId: projectId, onDone: onChanged)
        }
    }
}

/// One attachment: the image itself when it is one, a document glyph when it
/// is not. A PDF drawn as a grey rectangle tells you nothing; its NAME does.
private struct ProjectFileTile: View {
    let file: RoomPhoto

    var body: some View {
        VStack(spacing: 0) {
            if file.isImage, let url = file.url.flatMap(URL.init(string:)) {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    ProgressView()
                }
                .frame(width: 132, height: 114)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                VStack(spacing: 6) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 22))
                        .foregroundStyle(Brand.inkSoft)
                    Text(file.filename)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Brand.inkSoft)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 8)
                }
                .frame(width: 132, height: 114)
                .background(Brand.surface, in: .rect(cornerRadius: 12))
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Brand.hairline, lineWidth: 0.5))
    }
}

/// Attach a photo to the job itself rather than to a room.
///
/// The camera and the library both, because the two cases are different: a
/// picture of the building taken on arrival, and the adjuster's letter that
/// is already in Photos or Files. Uploads through the same `/api/v1/photos`
/// POST every room photo uses, with no `roomScanId` — which IS the definition
/// of a job-level attachment.
struct ProjectFileUploader: View {
    let projectId: String
    let onDone: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var picked: PhotosPickerItem?
    @State private var takingPhoto = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()
                VStack(spacing: Brand.Space.base) {
                    if busy {
                        ProgressView("Uploading…")
                    } else {
                        Button { takingPhoto = true } label: {
                            Label("Take a photo", systemImage: "camera")
                                .font(.system(size: 16, weight: .semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
                        }
                        .buttonStyle(.plain)

                        PhotosPicker(selection: $picked, matching: .images) {
                            Label("Choose from library", systemImage: "photo.on.rectangle")
                                .font(.system(size: 16, weight: .semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
                        }
                        .buttonStyle(.plain)
                    }

                    if let error {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }
                    Spacer()
                }
                .padding(Brand.Space.base)
            }
            .navigationTitle("Add to this job")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
            .fullScreenCover(isPresented: $takingPhoto) {
                CameraCapture { image in
                    takingPhoto = false
                    if let image { Task { await upload(image) } }
                }
                .ignoresSafeArea()
            }
            .onChange(of: picked) { _, item in
                guard let item else { return }
                Task {
                    if let data = try? await item.loadTransferable(type: Data.self),
                        let image = UIImage(data: data) {
                        await upload(image)
                    }
                }
            }
        }
    }

    private func upload(_ image: UIImage) async {
        guard let jpeg = image.jpegData(compressionQuality: 0.8) else { return }
        busy = true
        defer { busy = false }
        do {
            _ = try await API.shared.uploadPhoto(
                projectId: projectId, roomScanId: nil, affectedAreaId: nil,
                jpeg: jpeg, note: nil)
            onDone()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// Pick the property on a map.
///
/// The address is the thing this app is least able to get right by typing:
/// a triplex on a corner has two street names, a Québec postal code is six
/// characters nobody remembers, and half these jobs are recorded standing in
/// the driveway. So the map is the input, not a picture of the answer — drag
/// the pin, or search, and the address is READ OFF the map by reverse
/// geocoding rather than typed into it.
///
/// The pin is a fixed overlay at the centre of the screen rather than an
/// annotation on the map. That is what makes "drag the map, not the pin"
/// work: the map moves under a pin that never does, which is how every map
/// picker worth using behaves and is far easier with a thumb than dragging a
/// 30pt target around.
struct ProjectLocationPicker: View {
    let projectName: String
    let initial: CLLocationCoordinate2D?
    /// The address already on the job, if any. Opening the picker on a
    /// project that HAS an address at world zoom over North America — which
    /// is where an unseeded map lands — is useless; this geocodes it so the
    /// map opens on the property it is about.
    var initialQuery: String = ""

    let onUse: (_ line1: String, _ city: String, _ postal: String) -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var search = AddressSearch()
    @StateObject private var here = HereLocator()

    /// Opens over the service area at street zoom, never `.automatic`.
    ///
    /// `.automatic` with nothing to frame lands on the whole western
    /// hemisphere, which is not a map anybody can drop a pin on — and the
    /// first reverse geocode off it named a road in northern Manitoba. Laval
    /// is where this business works; a saved address or a location fix
    /// replaces this within a second of opening, and until then a wrong
    /// street is far more useful than a right continent.
    @State private var camera: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 45.5717, longitude: -73.7073),
            latitudinalMeters: 2500, longitudinalMeters: 2500))
    @State private var centre: CLLocationCoordinate2D?
    @State private var line1 = ""
    @State private var city = ""
    @State private var postal = ""
    @State private var hybrid = false
    @State private var looking = false

    private var readable: String {
        let tail = [city, postal].filter { !$0.isEmpty }.joined(separator: " ")
        return [line1, tail].filter { !$0.isEmpty }.joined(separator: ", ")
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ZStack(alignment: .bottom) {
                map
                if !search.results.isEmpty { suggestions } else { footer }
            }
        }
        .onAppear {
            if let initial {
                camera = .region(
                    MKCoordinateRegion(
                        center: initial, latitudinalMeters: 400, longitudinalMeters: 400))
                centre = initial
                Task { await readOff(initial) }
            } else if !initialQuery.trimmingCharacters(in: .whitespaces).isEmpty {
                Task {
                    if let found = try? await CLGeocoder().geocodeAddressString(initialQuery),
                        let spot = found.first?.location?.coordinate {
                        camera = .region(
                            MKCoordinateRegion(
                                center: spot, latitudinalMeters: 400, longitudinalMeters: 400))
                        centre = spot
                        await readOff(spot)
                    } else {
                        here.request()
                    }
                }
            } else {
                here.request()
            }
        }
        .onChange(of: here.coordinate) { _, found in
            // Only jumps when the operator has not already chosen somewhere:
            // a picker that yanks the map to the van every time a location
            // fix arrives is unusable.
            guard let found, centre == nil, initial == nil else { return }
            camera = .region(
                MKCoordinateRegion(
                    center: found, latitudinalMeters: 400, longitudinalMeters: 400))
            centre = found
            Task { await readOff(found) }
        }
    }

    private var header: some View {
        VStack(spacing: Brand.Space.small) {
            HStack(spacing: Brand.Space.small) {
                Image(systemName: "mappin.and.ellipse")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                    .frame(width: 38, height: 38)
                    .background(Brand.surfaceRaised, in: .rect(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Project Location")
                        .font(.system(size: 19, weight: .bold))
                        .foregroundStyle(Brand.ink)
                    Text(projectName)
                        .font(.system(size: 13))
                        .foregroundStyle(Brand.inkSoft)
                        .lineLimit(1)
                }
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Brand.inkSoft)
                        .frame(width: 32, height: 32)
                        .background(Brand.surfaceRaised, in: Circle())
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.inkFaint)
                TextField("Search or Enter Address", text: $search.query)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.words)
                if !search.query.isEmpty {
                    Button { search.query = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Brand.inkFaint)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .background(Brand.surfaceRaised, in: .rect(cornerRadius: 11))
        }
        .padding(Brand.Space.base)
        .background(Brand.canvas)
    }

    private var map: some View {
        Map(position: $camera, interactionModes: [.pan, .zoom])
            .mapStyle(hybrid ? .hybrid : .standard)
            .onMapCameraChange(frequency: .onEnd) { context in
                let middle = context.region.center
                centre = middle
                Task { await readOff(middle) }
            }
            // The pin sits ON the screen, not on the map, so the map slides
            // beneath it. Slightly above centre because the point of a pin is
            // its tip, not its middle.
            .overlay {
                Image(systemName: "mappin")
                    .font(.system(size: 30, weight: .medium))
                    .foregroundStyle(Brand.ink)
                    .shadow(color: .black.opacity(0.25), radius: 3, y: 2)
                    .offset(y: -15)
                    .allowsHitTesting(false)
            }
            .overlay(alignment: .topTrailing) {
                // .buttonStyle(.plain) and a fixed width on BOTH the stack
                // and each label: without them the default button style
                // stretched these to the full width of the overlay, so two
                // 42pt glyphs sat in the middle of two full-width white
                // bars across the top of the map.
                VStack(spacing: 0) {
                    Button { hybrid.toggle() } label: {
                        Image(systemName: hybrid ? "map.fill" : "map")
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    Divider().frame(width: 44)

                    Button {
                        here.request()
                        if let found = here.coordinate {
                            camera = .region(
                                MKCoordinateRegion(
                                    center: found,
                                    latitudinalMeters: 400, longitudinalMeters: 400))
                        }
                    } label: {
                        Image(systemName: "location")
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .frame(width: 44)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(Brand.ink)
                .background(Brand.surface, in: .rect(cornerRadius: 10))
                .shadow(color: .black.opacity(0.12), radius: 4, y: 2)
                .padding(Brand.Space.base)
            }
    }

    private var suggestions: some View {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(search.results, id: \.self) { completion in
                    Button {
                        Task { await jump(to: completion) }
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(completion.title)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Brand.ink)
                            if !completion.subtitle.isEmpty {
                                Text(completion.subtitle)
                                    .font(.system(size: 12))
                                    .foregroundStyle(Brand.inkSoft)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 11)
                        .padding(.horizontal, Brand.Space.base)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    Divider().padding(.leading, Brand.Space.base)
                }
            }
        }
        .frame(maxHeight: 280)
        .background(Brand.surface)
    }

    private var footer: some View {
        VStack(spacing: Brand.Space.small) {
            Text(looking ? "Finding the address…" : (readable.isEmpty ? "Drag the map to the property" : readable))
                .font(.system(size: 15))
                .foregroundStyle(readable.isEmpty ? Brand.inkSoft : Brand.ink)
                .multilineTextAlignment(.center)
                .lineLimit(2)

            Button {
                onUse(line1, city, postal)
                dismiss()
            } label: {
                Label("Use This Location", systemImage: "mappin.and.ellipse")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(readable.isEmpty ? Brand.inkFaint : Brand.blue)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(Brand.surfaceRaised, in: .rect(cornerRadius: 11))
            }
            .buttonStyle(.plain)
            .disabled(readable.isEmpty)
        }
        .padding(Brand.Space.base)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
        .padding(Brand.Space.base)
    }

    /// Reverse geocode: the map's centre → an address. This is the whole
    /// point of the screen — the operator positions a place and the app works
    /// out what it is called, rather than the other way round.
    private func readOff(_ coordinate: CLLocationCoordinate2D) async {
        looking = true
        defer { looking = false }
        let marks = try? await CLGeocoder().reverseGeocodeLocation(
            CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude))
        guard let mark = marks?.first else { return }
        line1 = [mark.subThoroughfare, mark.thoroughfare]
            .compactMap { $0 }
            .joined(separator: " ")
        city = mark.locality ?? mark.subAdministrativeArea ?? ""
        postal = mark.postalCode ?? ""
    }

    private func jump(to completion: MKLocalSearchCompletion) async {
        let response = try? await MKLocalSearch(
            request: MKLocalSearch.Request(completion: completion)).start()
        guard let placemark = response?.mapItems.first?.placemark else { return }
        let found = placemark.coordinate
        camera = .region(
            MKCoordinateRegion(center: found, latitudinalMeters: 300, longitudinalMeters: 300))
        centre = found
        search.query = ""
        await readOff(found)
    }
}

/// Where the phone is, asked once and only when a picker wants it.
///
/// Deliberately not a shared singleton watching location all day: this app
/// needs a fix at exactly one moment — "I am standing at the property" — and
/// a background location subscription would cost battery to answer a question
/// nobody is asking the rest of the time.
@MainActor
final class HereLocator: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var coordinate: CLLocationCoordinate2D?

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func request() {
        manager.requestWhenInUseAuthorization()
        manager.requestLocation()
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]
    ) {
        guard let found = locations.last?.coordinate else { return }
        Task { @MainActor in self.coordinate = found }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Denied, or no fix indoors. The map still works; it just opens where
        // it opens, and searching is the way in.
    }
}

extension CLLocationCoordinate2D: @retroactive Equatable {
    public static func == (a: CLLocationCoordinate2D, b: CLLocationCoordinate2D) -> Bool {
        a.latitude == b.latitude && a.longitude == b.longitude
    }
}

/// The reference's `Project Info` screen, behind the description pencil.
///
/// Name and description are the two things about a job that get corrected
/// most — a project made from the van is called "New project" until somebody
/// types what it actually is. The rest of the screen is read-only fact:
/// when it was created, and what its living-area rule is.
///
/// `New Field` is the reference's custom-field builder. The column exists
/// (`projects.custom`, migration 0026) and the claim template already writes
/// it, but a field BUILDER is its own screen and is not built here — the row
/// says so rather than pretending.
struct ProjectInfoView: View {
    let projectId: String
    let record: ProjectRecord?
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var saving = false
    @State private var error: String?

    private var created: String {
        guard let raw = record?.createdAt,
            let date = ISO8601DateFormatter.flexible.date(from: raw)
        else { return "—" }
        return date.formatted(.dateTime.month(.wide).day().year())
    }

    var body: some View {
        Form {
            Section {
                LabeledContent("Project Name") {
                    TextField("Name", text: $name)
                        .multilineTextAlignment(.trailing)
                        .textInputAutocapitalization(.words)
                }
                LabeledContent("Project Description") {
                    TextField("Add Text", text: $description, axis: .vertical)
                        .multilineTextAlignment(.trailing)
                        .lineLimit(1...4)
                }
            }

            Section("GENERAL") {
                LabeledContent("Project creation date", value: created)
                NavigationLink {
                    LivingAreaDetailView(projectId: projectId)
                } label: {
                    Text("Living Area Calculation")
                }
            }

            Section {
                HStack {
                    Label("New Field", systemImage: "plus")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Brand.inkFaint)
                    Spacer()
                }
            } footer: {
                Text("Custom fields are recorded on a project already — the claim template writes them — but building your own from the phone is not here yet.")
            }

            if let error {
                Section { Text(error).font(.footnote).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Project Info")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(saving ? "Saving…" : "Save") { Task { await save() } }
                    .fontWeight(.semibold)
                    .disabled(saving || name.trimmed.isEmpty)
            }
        }
        .onAppear {
            name = record?.name ?? ""
            description = record?.description ?? ""
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            try await API.shared.updateProjectDetails(
                id: projectId,
                name: .some(name.trimmed),
                description: .some(description.trimmed))
            onSaved()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// Living area, on its own screen because the figure needs its rule beside
/// it: ANSI Z765 counts finished space above grade, which is why a basement
/// full of measured floor does not raise it.
struct LivingAreaDetailView: View {
    let projectId: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Brand.Space.base) {
                LivingAreaCard(projectId: projectId)
            }
            .padding(Brand.Space.base)
        }
        .background(Brand.canvas)
        .navigationTitle("Living Area")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// When the job was made and when it was last touched.
///
/// The reference shows a person against each. This app has no user accounts
/// — one operator, signed in as admin — so naming one would be inventing an
/// identity nothing tracks. What IS true is who the job is assigned to, and
/// when it moved; that is what this shows, and the avatar carries their
/// initials when somebody is on it.
struct ProjectAuthorshipBlock: View {
    let assignedTo: String?
    let createdAt: String?
    let updatedAt: String?

    var body: some View {
        Card(padding: 0) {
            VStack(spacing: 0) {
                row(title: "Created", stamp: createdAt)
                Divider().padding(.leading, 62)
                row(title: "Last modified", stamp: updatedAt)
            }
        }
    }

    private func row(title: String, stamp: String?) -> some View {
        HStack(spacing: Brand.Space.small) {
            ZStack {
                Circle().fill(assignedTo == nil ? Brand.surfaceRaised : Brand.blue)
                if let initials {
                    Text(initials)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                } else {
                    Image(systemName: "person")
                        .font(.system(size: 15))
                        .foregroundStyle(Brand.inkFaint)
                }
            }
            .frame(width: 38, height: 38)

            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.inkFaint)
                Text(assignedTo ?? "Unassigned")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                Text(readable(stamp))
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkSoft)
            }
            Spacer()
        }
        .padding(Brand.Space.small)
    }

    private var initials: String? {
        guard let assignedTo, !assignedTo.isEmpty else { return nil }
        let parts = assignedTo.split(separator: " ")
        let letters = parts.prefix(2).compactMap { $0.first }
        return letters.isEmpty ? nil : String(letters).uppercased()
    }

    private func readable(_ raw: String?) -> String {
        guard let raw, let date = ISO8601DateFormatter.flexible.date(from: raw) else { return "—" }
        return date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
    }
}

extension ISO8601DateFormatter {
    /// Postgres sends fractional seconds; the default formatter refuses them
    /// and returns nil, which showed every date on this screen as a dash.
    static let flexible: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

/// The reference's `Export Floor Plans` sheet, behind the share button.
///
/// Laid out exactly as the reference so the hand finds each row where it
/// expects to, but honest about which ones do something. Three of the
/// reference's five exports are not built here, and one of them — the 3D
/// model — cannot be: this editor is 2D by design (`threeDBlocked`), so
/// there is no model to hand anybody. A row that opened a spinner and
/// produced nothing would be worse than a row that says so.
///
/// `Integrations` is the reference's second tab: cloud services a plan gets
/// pushed to. There are none here, and inventing the tab to hold an empty
/// state would be furniture, so it is a single honest row rather than a
/// segmented control with nothing behind it.
struct ProjectExportSheet: View {
    let projectId: String
    let projectName: String
    /// Called when the operator picks "Previously Generated Files", so the
    /// project page can take them to the Files rail rather than this sheet
    /// pretending to hold a second copy of it.
    let onShowFiles: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var makingReport = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Brand.Space.base) {
                    Card(padding: 0) {
                        VStack(spacing: 0) {
                            NavigationLink {
                                ReportShareView(projectId: projectId, projectName: projectName)
                            } label: {
                                ExportRow(
                                    icon: "list.clipboard",
                                    title: "Report PDF",
                                    caption: "Get your project report in PDF format",
                                    ready: true)
                            }
                            .buttonStyle(.plain)

                            Divider().padding(.leading, 58)
                            ExportRow(
                                icon: "doc.richtext",
                                title: "Sketch PDF",
                                caption: "The plan on its own, without the report around it",
                                ready: false)
                            Divider().padding(.leading, 58)
                            ExportRow(
                                icon: "photo.on.rectangle",
                                title: "Sketch Files",
                                caption: "The plan as an image — PNG, SVG",
                                ready: false)
                            Divider().padding(.leading, 58)
                            ExportRow(
                                icon: "cube",
                                title: "3D Model",
                                caption: "This editor is 2D by design, so there is no model to export",
                                ready: false)
                            Divider().padding(.leading, 58)
                            ExportRow(
                                icon: "ruler",
                                title: "Statistics",
                                caption: "Areas and perimeters of every room, as a file",
                                ready: false)
                        }
                    }

                    Button {
                        dismiss()
                        onShowFiles()
                    } label: {
                        Card(padding: Brand.Space.small) {
                            HStack(spacing: Brand.Space.small) {
                                Image(systemName: "doc.on.doc")
                                    .font(.system(size: 18))
                                    .foregroundStyle(Brand.blue)
                                    .frame(width: 30)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Previously Generated Files")
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundStyle(Brand.blue)
                                    Text("Everything already made for this job, in its Files section")
                                        .font(.system(size: 12))
                                        .foregroundStyle(Brand.inkSoft)
                                }
                                Spacer()
                                Image(systemName: "arrow.up.left")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Brand.blue)
                            }
                        }
                    }
                    .buttonStyle(.plain)

                    VStack(alignment: .leading, spacing: Brand.Space.small) {
                        SectionHeading(title: "SHARE LINKS")
                        Card(padding: 0) {
                            VStack(spacing: 0) {
                                NavigationLink {
                                    ReportShareView(projectId: projectId, projectName: projectName)
                                } label: {
                                    ExportRow(
                                        icon: "envelope",
                                        title: "Send a copy",
                                        caption: "Make the PDF and hand it to Mail, Messages or anything else",
                                        ready: true)
                                }
                                .buttonStyle(.plain)
                                Divider().padding(.leading, 58)
                                ExportRow(
                                    icon: "link",
                                    title: "Get Shareable Link",
                                    caption: "Crew links exist per job, not per project — not wired here yet",
                                    ready: false)
                            }
                        }
                    }

                    Text("Rows without an arrow are not built yet. They are listed so this sheet stays the shape you know, not to suggest they work.")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.inkFaint)
                        .padding(.top, Brand.Space.tight)
                }
                .padding(Brand.Space.base)
            }
            .background(Brand.canvas)
            .navigationTitle("Export Floor Plans")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Brand.inkSoft)
                            .frame(width: 30, height: 30)
                            .background(Brand.surfaceRaised, in: Circle())
                    }
                }
            }
        }
    }
}

/// One row of the export sheet. `ready` is the whole of the honesty: a row
/// that works carries a chevron and full-strength ink; one that does not is
/// dimmed and carries nothing to tap.
private struct ExportRow: View {
    let icon: String
    let title: String
    let caption: String
    let ready: Bool

    var body: some View {
        HStack(spacing: Brand.Space.small) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(ready ? Brand.ink : Brand.inkFaint)
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(ready ? Brand.ink : Brand.inkFaint)
                Text(caption)
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            if ready {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Brand.inkFaint)
            }
        }
        .padding(Brand.Space.small)
        .contentShape(Rectangle())
    }
}

/// The reference's `Add Floor` sheet, behind the + in Floor Plans.
///
/// Shape copied exactly: a grabber, a centred title, an ✕, then two grouped
/// lists — `Most common` and `Other floors` — each a plain row you tap.
///
/// TWO DELIBERATE DIFFERENCES IN THE CONTENT, both already settled in this
/// codebase and neither a slip:
///
/// **Basement sits in `Most common`.** The reference files every basement
/// under `Other floors`, which is an appraiser's ordering. This trade lives
/// in basements (`HANDOFF.md` §3), so it leads the short list.
///
/// **There is no `1st Floor`, and there must not be.** The reference reads
/// "1st" the European way — one storey ABOVE ground. Every row already
/// stored here reads it the North American way and calls that storey `2nd`.
/// Offering both spellings would file one physical storey under two names
/// and split every total that groups by level. `FloorVocabulary` and
/// `floors.ts` both carry this warning; changing it is a data migration, not
/// a list edit.
struct AddFloorSheet: View {
    /// Floors already on this project — shown with a check, and still
    /// tappable, because a storey can hold more than one room.
    let existing: Set<String>
    let onPick: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    /// The reference's five, with Basement standing where their `1st Floor`
    /// would be — same length, same job, our vocabulary.
    private static let common = ["Ground", "Basement", "2nd", "3rd", "4th"]

    private var others: [FloorVocabulary.Level] {
        FloorVocabulary.levels.filter { !Self.common.contains($0.id) }
    }

    private var commonLevels: [FloorVocabulary.Level] {
        Self.common.compactMap { id in FloorVocabulary.levels.first { $0.id == id } }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Most common") {
                    ForEach(commonLevels, id: \.id) { level in row(level) }
                }
                Section("Other floors") {
                    ForEach(others, id: \.id) { level in row(level) }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Add Floor")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Brand.inkSoft)
                            .frame(width: 30, height: 30)
                            .background(Brand.surfaceRaised, in: Circle())
                    }
                }
            }
        }
    }

    private func row(_ level: FloorVocabulary.Level) -> some View {
        Button {
            onPick(level.id)
            dismiss()
        } label: {
            HStack {
                Text(level.label)
                    .font(.system(size: 17))
                    .foregroundStyle(Brand.ink)
                Spacer()
                if existing.contains(level.id) {
                    // Already measured. Not disabled — a storey holds many
                    // rooms and the second one is added the same way.
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Brand.blue)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
