import SwiftUI

/// The app's five slots: Home · Projects · ＋ · Customers · More.
///
/// The field-service layout: the everyday places on the bar, a raised ＋ in
/// the middle that creates anything from anywhere, and a More list for the
/// rest. Projects keeps its tab because the floor plans live there and are
/// used every day; Schedule moved into More and onto Home.
struct AppTabs: View {
    let onSignedOut: () -> Void

    enum Tab: Hashable { case home, projects, create, customers, more }

    @State private var tab: Tab = .home
    @State private var lastTab: Tab = .home
    @State private var creating = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        TabView(selection: $tab) {
            HomeView(onSignedOut: onSignedOut)
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(Tab.home)

            ProjectsView(onSignedOut: onSignedOut)
                .tabItem { Label("Projects", systemImage: "folder.fill") }
                .tag(Tab.projects)

            // A slot, not a screen: choosing it opens the create menu and the
            // bar goes back to where it was.
            Color.clear
                .tabItem { Label("Create", systemImage: "plus.circle.fill") }
                .accessibilityLabel("Create")
                .tag(Tab.create)

            CustomersView()
                .tabItem { Label("Customers", systemImage: "person.2.fill") }
                .tag(Tab.customers)

            MoreTab(onSignedOut: onSignedOut)
                .tabItem { Label("More", systemImage: "ellipsis") }
                .tag(Tab.more)
        }
        .onChange(of: tab) { old, new in
            if new == .create {
                tab = old
                creating = true
            } else {
                lastTab = new
            }
        }
        .sheet(isPresented: $creating) { CreateMenu() }
        // Contacts kept current on their own, when he turned that on.
        .task { await ContactSync.shared.syncIfAuto() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await ContactSync.shared.syncIfAuto() } }
        }
    }
}

// MARK: - Create

/// What the ＋ makes. Native where the form is native, the web form where
/// it is not yet — every tile does something.
struct CreateMenu: View {
    @Environment(\.dismiss) private var dismiss
    @State private var open: Item?
    @State private var form: Item?
    /// Half height for the menu itself; full height the moment it opens a
    /// screen — Measure ends on a floor plan, which in half a screen was a
    /// postage stamp (5 Nov 2026).
    @State private var detent: PresentationDetent = .medium

    enum Item: String, Identifiable {
        case customer, project, estimate, quote, measure, expense, task
        var id: String { rawValue }
    }

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    tile(.customer, "Customer", "person.badge.plus", Brand.blue)
                    tile(.estimate, "Estimate", "ruler", Brand.green)
                    tile(.project, "Project", "folder.badge.plus", Brand.blueDark)
                    tile(.quote, "Quote", "doc.text", Brand.blue)
                    tile(.measure, "Measure", "camera.viewfinder", Brand.green)
                    tile(.expense, "Expense", "creditcard", Brand.blueDark)
                }
                .padding(Brand.Space.base)
            }
            .background(Brand.canvas)
            .navigationTitle("Create")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
            .navigationDestination(item: $open) { item in
                switch item {
                case .estimate:
                    web("/admin/estimates#new", "New estimate")
                case .quote:
                    web("/admin/quotes/new", "New quote")
                case .expense:
                    web("/admin/expenses", "Expenses")
                case .task:
                    web("/admin/tasks", "Tasks")
                case .measure:
                    ScanEntryView()
                case .customer, .project:
                    EmptyView()
                }
            }
            .sheet(item: $form) { item in
                if item == .customer {
                    NewCustomerSheet { _ in dismiss() }
                } else {
                    NewProjectSheet { _ in dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large], selection: $detent)
        .onChange(of: open) { _, now in if now != nil { detent = .large } }
    }

    private func tile(_ item: Item, _ title: String, _ icon: String, _ tint: Color) -> some View {
        Button {
            if item == .customer || item == .project { form = item } else { open = item }
        } label: {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 22, weight: .semibold))
                    .frame(width: 52, height: 52)
                    .background(tint.opacity(0.12), in: .circle)
                    .foregroundStyle(tint)
                Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(Brand.ink)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Brand.Radius.card).strokeBorder(Brand.hairline, lineWidth: 0.5))
        }
        .buttonStyle(.plain)
    }

    private func web(_ path: String, _ title: String) -> some View {
        WebScreen(path: path)
            .ignoresSafeArea(edges: .bottom)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - More

/// Everything that is not on the bar, as a plain list: icon, name, chevron.
struct MoreTab: View {
    let onSignedOut: () -> Void

    @State private var showClassic = false
    @State private var showStatus = false
    @StateObject private var push = PushRegistration.shared

    private enum Destination: Hashable {
        case schedule, leads, messages, quotes, scan, contacts
        case web(path: String, title: String)
    }

    private struct Row: Identifiable {
        let title: String
        let icon: String
        let tint: Color
        let destination: Destination
        var id: String { title }
    }

    private var groups: [(String, [Row])] {
        [
            ("Work", [
                Row(title: "Schedule", icon: "calendar", tint: Brand.blue, destination: .schedule),
                Row(title: "Jobs", icon: "wrench.and.screwdriver", tint: Brand.blue, destination: .web(path: "/admin/jobs", title: "Jobs")),
                Row(title: "Estimates", icon: "ruler", tint: Brand.green, destination: .web(path: "/admin/estimates", title: "Estimates")),
                Row(title: "Quotes", icon: "doc.text", tint: Brand.blue, destination: .quotes),
                Row(title: "Leads", icon: "sparkles", tint: Brand.green, destination: .leads),
                Row(title: "Tasks", icon: "checklist", tint: Brand.blue, destination: .web(path: "/admin/tasks", title: "Tasks")),
                Row(title: "Measure a room", icon: "camera.viewfinder", tint: Brand.green, destination: .scan),
            ]),
            ("Team", [
                Row(title: "Team", icon: "person.3", tint: Brand.blueDark, destination: .web(path: "/admin/team", title: "Team")),
                Row(title: "Timesheets", icon: "clock", tint: Brand.blueDark, destination: .web(path: "/admin/timesheets", title: "Timesheets")),
                Row(title: "Checklists", icon: "checkmark.rectangle.stack", tint: Brand.blueDark, destination: .web(path: "/admin/checklists", title: "Checklists")),
            ]),
            ("Talk", [
                Row(title: "Messages", icon: "message", tint: Brand.green, destination: .messages),
                Row(title: "Inbox", icon: "tray.full", tint: Brand.green, destination: .web(path: "/admin/inbox", title: "Inbox")),
                Row(title: "Call log", icon: "phone.arrow.down.left", tint: Brand.green, destination: .web(path: "/admin/calls", title: "Call log")),
                Row(title: "Ana", icon: "waveform", tint: Brand.green, destination: .web(path: "/admin/ana", title: "Ana")),
            ]),
            ("Money", [
                Row(title: "Invoices", icon: "doc.plaintext", tint: Brand.blueDark, destination: .web(path: "/admin/invoices", title: "Invoices")),
                Row(title: "Expenses", icon: "creditcard", tint: Brand.blueDark, destination: .web(path: "/admin/expenses", title: "Expenses")),
                Row(title: "Products & services", icon: "list.bullet.rectangle", tint: Brand.blueDark, destination: .web(path: "/admin/price-book", title: "Price book")),
                Row(title: "Reports", icon: "chart.bar", tint: Brand.blueDark, destination: .web(path: "/admin/reports", title: "Reports")),
            ]),
        ]
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Brand.Space.large) {
                    ForEach(groups, id: \.0) { group in
                        VStack(alignment: .leading, spacing: Brand.Space.small) {
                            SectionHeading(title: group.0.uppercased())
                            GroupedCard {
                                ForEach(Array(group.1.enumerated()), id: \.element.id) { index, row in
                                    if index > 0 { RowDivider() }
                                    NavigationLink(value: row.destination) {
                                        IconRow(title: row.title) { IconTile(icon: row.icon, tint: row.tint) } trailing: { EmptyView() }
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: Brand.Space.small) {
                        SectionHeading(title: "APP")
                        GroupedCard {
                            NavigationLink(value: Destination.contacts) {
                                IconRow(title: "Sync contacts") { IconTile(icon: "person.crop.circle.badge.checkmark", tint: Brand.green) } trailing: { EmptyView() }
                            }
                            .buttonStyle(.plain)
                            RowDivider()
                            Button { PushRegistration.shared.enable() } label: {
                                IconRow(title: push.authorised ? "Notifications are on" : "Turn on notifications", showsChevron: false) {
                                    IconTile(icon: push.authorised ? "bell.badge.fill" : "bell", tint: Brand.inkSoft)
                                } trailing: { EmptyView() }
                            }
                            .buttonStyle(.plain)
                            RowDivider()
                            NavigationLink(value: Destination.web(path: "/admin/settings", title: "Settings")) {
                                IconRow(title: "Settings") { IconTile(icon: "gearshape", tint: Brand.inkSoft) } trailing: { EmptyView() }
                            }
                            .buttonStyle(.plain)
                            RowDivider()
                            Button { showStatus = true } label: {
                                IconRow(title: "Connection") { IconTile(icon: "antenna.radiowaves.left.and.right", tint: Brand.inkSoft) } trailing: { EmptyView() }
                            }
                            .buttonStyle(.plain)
                            RowDivider()
                            Button { showClassic = true } label: {
                                IconRow(title: "All tools and floor-plan options") { IconTile(icon: "square.grid.2x2", tint: Brand.inkSoft) } trailing: { EmptyView() }
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    Button(role: .destructive) { onSignedOut() } label: {
                        Text("Sign out")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
                            .overlay(RoundedRectangle(cornerRadius: Brand.Radius.card).strokeBorder(Brand.hairline, lineWidth: 0.5))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, Brand.Space.base)
                .padding(.top, Brand.Space.small)
                .padding(.bottom, Brand.Space.section)
            }
            .background(Brand.canvas)
            .navigationTitle("More")
            .navigationDestination(for: Destination.self) { destination in
                Group {
                switch destination {
                case .schedule: ScheduleView()
                case .leads: LeadsView()
                case .messages: MessagesView()
                case .quotes: EstimatesView()
                case .scan: ScanEntryView()
                case .contacts: ContactSyncView()
                case .web(let path, let title):
                    WebScreen(path: path)
                        .ignoresSafeArea(edges: .bottom)
                        .navigationTitle(title)
                        .navigationBarTitleDisplayMode(.inline)
                }
                }
                .environment(\.isPushed, true)
            }
            .sheet(isPresented: $showClassic) { MoreView() }
            .sheet(isPresented: $showStatus) { DiagnosticsView() }
        }
    }

}
