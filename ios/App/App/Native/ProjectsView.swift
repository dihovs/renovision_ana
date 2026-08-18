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
                MiniPlan(geometry: geometry)
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

    private var floorAreaSqm: Double { (scans ?? []).reduce(0) { $0 + $1.floorAreaSqm } }
    private var wallAreaSqm: Double {
        (scans ?? []).reduce(0) { $0 + $1.wallLengthM * $1.ceilingHeightM }
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
                    Button {
                        editingDetails = true
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
                        onEdit: { editingDetails = true })

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

                    // Floor Plans, the reference's own heading for the
                    // storeys and their rooms, with its explanatory caption.
                    SectionHeadingRow(title: "Floor Plans")
                    Text("Create, edit and share floor plans.")
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.inkSoft)

                    // The + that starts a floor plan, and the ONLY way into
                    // the scanner from a project now that the floating Scan
                    // button and the Scan tab are gone. The reference puts it
                    // exactly here, leading the rail; a measurement is a step
                    // inside a job rather than a destination beside it.
                    //
                    // It leads a rail even when there is nothing beside it
                    // yet, which is what the reference's empty state IS — a
                    // dashed tile inviting the first one, not a paragraph
                    // explaining the absence.
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Brand.Space.small) {
                            AddTile(label: "Add floor plan") {
                                openRoom = nil
                                capturing = true
                            }
                            if scans != nil && levels.isEmpty {
                                // One ghost tile beside the +, so the row
                                // reads as a place things go rather than as a
                                // lone button.
                                GhostTile()
                            }
                        }
                    }

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
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { sharing = true } label: { Image(systemName: "square.and.arrow.up") }
            }
        }
        .navigationDestination(isPresented: $sharing) {
            ReportShareView(projectId: project.id, projectName: project.name)
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
            ProjectStatisticsSheet(rooms: scans ?? [])
        }
        .sheet(
            isPresented: $capturing,
            onDismiss: {
                landing = landingIntent
                landingIntent = nil
            }
        ) {
            CaptureFlow(
                projectId: project.id,
                projectName: project.name,
                existingCount: (scans ?? []).count,
                existingNames: (scans ?? []).map(\.name),
                onSaved: { Task { await load() } },
                onFinished: { level, filed in
                    landingIntent = PlanLanding(level: level, filed: filed)
                })
        }
        // The one navigation hook ORD-16 asks of this screen: a finished
        // capture pushes the storey it was on, drawn.
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

    var body: some View {
        NavigationStack {
            Form {
                Section("DESCRIPTION") {
                    TextField("What happened, in a line or two", text: $description, axis: .vertical)
                        .lineLimit(2...6)
                }
                Section("PROPERTY ADDRESS") {
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
