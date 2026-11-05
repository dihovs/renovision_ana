import SwiftUI

/// One customer, everything about them, on one screen.
///
/// Laid out the way field-service apps lay a client out: who they are, then
/// four round actions (call, text, email, drive there), then the totals that
/// say where the money stands, then every piece of work in pipeline order —
/// requests, estimates, quotes, projects, jobs, invoices. Tapping a row does
/// not jump straight into it: it slides up the things you can do with it.
/// The one thing this screen exists to start — an estimate — is pinned to
/// the bottom.
struct CustomerHubView: View {
    let client: ClientSummary

    @State private var hub: CustomerHub?
    @State private var error: String?
    @State private var acting: CustomerHub.Row?
    @State private var destination: HubDestination?
    @State private var startingEstimate = false
    @State private var pickingProperty = false
    @StateObject private var calls = CallManager.shared
    @Environment(\.openURL) private var openURL

    enum HubDestination: Hashable {
        case web(path: String, title: String)
        case project(ProjectSummary)
        case messages(phone: String)
    }

    private var phone: String? { hub?.phones.first ?? client.phone ?? client.phones.first?.number }
    private var email: String? { hub?.emails.first ?? client.email }
    private var address: String? { hub?.properties.first?.label }

    var body: some View {
        ZStack {
            Brand.canvas.ignoresSafeArea()
            ScrollView {
                VStack(spacing: Brand.Space.base) {
                    header
                    if let error {
                        Card {
                            Label(error, systemImage: "exclamationmark.triangle.fill")
                                .font(.callout).foregroundStyle(.orange)
                        }
                    }
                    if let hub {
                        section("Requests", icon: "tray", rows: hub.requests, empty: "No requests on file.")
                        section("Estimates", icon: "ruler", rows: hub.estimates,
                                empty: hub.estimatesKnown ? "No estimates yet. Start one below." : "Estimates appear here once the latest CRM is live.")
                        section("Quotes", icon: "doc.text", rows: hub.quotes, empty: "No quotes yet.")
                        section("Projects", icon: "folder", rows: hub.projects, empty: "No projects yet.")
                        section("Jobs", icon: "wrench.and.screwdriver", rows: hub.jobs, empty: "No jobs yet.")
                        section("Invoices", icon: "doc.plaintext", rows: hub.invoices, empty: "No invoices yet.")
                        if !hub.properties.isEmpty { propertiesCard(hub) }
                    } else if error == nil {
                        ProgressView().padding(.top, 40)
                    }
                }
                .padding(.horizontal, Brand.Space.base)
                .padding(.top, Brand.Space.small)
                .padding(.bottom, Brand.Space.large)
            }
            .refreshable { await load() }
        }
        .navigationTitle(client.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Open on the web", systemImage: "safari") {
                        destination = .web(path: "/admin/clients/\(client.id)", title: client.name)
                    }
                    Button("Edit customer", systemImage: "pencil") {
                        destination = .web(path: "/admin/clients/\(client.id)/edit", title: "Edit")
                    }
                    Button("New quote", systemImage: "doc.text") {
                        destination = .web(path: "/admin/quotes/new?client=\(client.id)", title: "New quote")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        // The primary action, always within thumb's reach.
        .safeAreaInset(edge: .bottom) {
            Button {
                if (hub?.properties.count ?? 0) > 1 { pickingProperty = true } else { Task { await newEstimate(propertyId: nil) } }
            } label: {
                HStack(spacing: Brand.Space.tight) {
                    if startingEstimate { ProgressView().tint(.white) } else { Image(systemName: "ruler") }
                    Text(startingEstimate ? "Opening the estimator…" : "New estimate")
                }
            }
            .buttonStyle(PrimaryButtonStyle(enabled: !startingEstimate))
            .disabled(startingEstimate)
            .padding(.horizontal, Brand.Space.base)
            .padding(.vertical, Brand.Space.small)
            .background(.bar)
        }
        .confirmationDialog("Estimate for which property?", isPresented: $pickingProperty, titleVisibility: .visible) {
            ForEach(hub?.properties ?? [], id: \.id) { property in
                Button(property.label) { Task { await newEstimate(propertyId: property.id) } }
            }
        }
        .confirmationDialog(acting?.title ?? "", isPresented: Binding(get: { acting != nil }, set: { if !$0 { acting = nil } }),
                            titleVisibility: .visible, presenting: acting) { row in
            actions(for: row)
        }
        .navigationDestination(item: $destination) { destination in
            switch destination {
            case .web(let path, let title):
                WebScreen(path: path)
                    .ignoresSafeArea(edges: .bottom)
                    .navigationTitle(title)
                    .navigationBarTitleDisplayMode(.inline)
            case .project(let project):
                ProjectDetailView(project: project)
            case .messages(let phone):
                MessageThreadView(phone: phone, displayName: client.name)
            }
        }
        .task { await load() }
    }

    // MARK: Header

    private var header: some View {
        Card {
            VStack(spacing: Brand.Space.base) {
                HStack(spacing: Brand.Space.small) {
                    ZStack {
                        Circle().fill(Brand.blue)
                        Text(initials).font(.system(size: 18, weight: .bold)).foregroundStyle(.white)
                    }
                    .frame(width: 52, height: 52)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(client.name).font(.system(size: 20, weight: .bold)).foregroundStyle(Brand.ink)
                        if let sub = hub?.person ?? client.company, !sub.isEmpty {
                            Text(sub).font(.system(size: 13)).foregroundStyle(Brand.inkSoft)
                        }
                        if let address {
                            Text(address).font(.system(size: 12)).foregroundStyle(Brand.inkFaint).lineLimit(1)
                        }
                    }
                    Spacer(minLength: 0)
                }

                HStack(spacing: 0) {
                    QuickActionButton(title: "Call", icon: "phone.fill", enabled: phone != nil) {
                        if let phone { Task { await calls.place(to: phone, label: client.name) } }
                    }
                    QuickActionButton(title: "Text", icon: "message.fill", enabled: phone != nil) {
                        if let phone { destination = .messages(phone: phone) }
                    }
                    QuickActionButton(title: "Email", icon: "envelope.fill", enabled: email != nil) {
                        if let email, let url = URL(string: "mailto:\(email)") { openURL(url) }
                    }
                    QuickActionButton(title: "Directions", icon: "location.fill", enabled: address != nil) {
                        if let address,
                           let q = address.replacingOccurrences(of: " · ", with: ", ").addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
                           let url = URL(string: "http://maps.apple.com/?q=\(q)") { openURL(url) }
                    }
                }

                if let hub {
                    HStack(spacing: Brand.Space.tight) {
                        StatTileView(label: "Open estimates", value: money(hub.openEstimateCents))
                        StatTileView(label: "Active jobs", value: "\(hub.activeJobs)")
                        StatTileView(label: "Owing", value: money(hub.owingCents), alert: hub.owingCents > 0)
                    }
                }
            }
        }
    }

    private var initials: String {
        let parts = client.name.split(separator: " ")
        let first = parts.first?.prefix(1) ?? "?"
        let last = parts.count > 1 ? parts.last!.prefix(1) : ""
        return (first + last).uppercased()
    }

    // MARK: Sections

    @ViewBuilder
    private func section(_ title: String, icon: String, rows: [CustomerHub.Row], empty: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: Brand.Space.tight) {
                Image(systemName: icon).font(.system(size: 13, weight: .semibold)).foregroundStyle(Brand.blue)
                Text(title).font(.system(size: 15, weight: .bold)).foregroundStyle(Brand.ink)
                if !rows.isEmpty {
                    Text("\(rows.count)")
                        .font(.system(size: 11, weight: .bold))
                        .padding(.horizontal, 6).padding(.vertical, 1)
                        .background(Brand.inkSoft.opacity(0.12), in: .capsule)
                        .foregroundStyle(Brand.inkSoft)
                }
                Spacer()
            }
            .padding(.horizontal, Brand.Space.base)
            .padding(.vertical, Brand.Space.small)

            if rows.isEmpty {
                Text(empty)
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.inkFaint)
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.bottom, Brand.Space.base)
            } else {
                ForEach(rows) { row in
                    Divider().overlay(Brand.hairline)
                    Button { acting = row } label: { HubRowView(row: row) }
                        .buttonStyle(.plain)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Brand.Radius.card).strokeBorder(Brand.hairline, lineWidth: 0.5))
    }

    private func propertiesCard(_ hub: CustomerHub) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Brand.Space.tight) {
                Label("Properties", systemImage: "house").font(.system(size: 15, weight: .bold)).foregroundStyle(Brand.ink)
                ForEach(hub.properties, id: \.id) { property in
                    Text(property.label).font(.system(size: 14)).foregroundStyle(Brand.inkSoft)
                }
            }
        }
    }

    // MARK: Row actions

    @ViewBuilder
    private func actions(for row: CustomerHub.Row) -> some View {
        switch row.kind {
        case .project:
            Button("Open project") { Task { await openProject(row) } }
            Button("Start an estimate for it") {
                destination = .web(path: "/admin/projects/\(row.id)/estimate", title: "Estimate")
            }
        case .estimate:
            Button("Open estimate") { destination = .web(path: row.path, title: "Estimate") }
            Button("Printable estimate") { destination = .web(path: row.path + "/print", title: "Estimate") }
        case .quote:
            Button("Open quote") { destination = .web(path: row.path, title: row.title) }
        case .job:
            Button("Open job") { destination = .web(path: row.path, title: row.title) }
        case .invoice:
            Button("Open invoice") { destination = .web(path: row.path, title: row.title) }
        case .request:
            Button("Open requests") { destination = .web(path: row.path, title: "Requests") }
        }
        if let phone {
            Button("Call \(client.name)") { Task { await calls.place(to: phone, label: client.name) } }
            Button("Text \(client.name)") { destination = .messages(phone: phone) }
        }
        Button("Cancel", role: .cancel) {}
    }

    /// Projects open in the native project screen — the floor plans live
    /// there — and only fall back to the web if the list cannot be read.
    private func openProject(_ row: CustomerHub.Row) async {
        if let project = try? await API.shared.projects().first(where: { $0.id == row.id }) {
            destination = .project(project)
        } else {
            destination = .web(path: row.path, title: row.title)
        }
    }

    // MARK: Loading

    private func load() async {
        do {
            hub = try await API.shared.customerHub(for: client)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func newEstimate(propertyId: String?) async {
        startingEstimate = true
        defer { startingEstimate = false }
        do {
            if let path = try await API.shared.startEstimate(clientId: client.id, propertyId: propertyId) {
                destination = .web(path: path, title: "New estimate")
                await load()
            } else {
                // An older server: its own form, preset to this customer.
                destination = .web(path: "/admin/projects/new?client=\(client.id)", title: "New project")
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Pieces

private struct QuickActionButton: View {
    let title: String
    let icon: String
    let enabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 46, height: 46)
                    .background(enabled ? Brand.blueLight : Brand.inkSoft.opacity(0.08), in: .circle)
                    .foregroundStyle(enabled ? Brand.blue : Brand.inkFaint)
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(enabled ? Brand.ink : Brand.inkFaint)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

private struct StatTileView: View {
    let label: String
    let value: String
    var alert = false

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .heavy)).tracking(0.3)
                .foregroundStyle(Brand.inkFaint)
            Text(value)
                .font(.system(size: 16, weight: .bold, design: .rounded)).monospacedDigit()
                .foregroundStyle(alert ? Color.red : Brand.ink)
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.tile))
    }
}

private struct HubRowView: View {
    let row: CustomerHub.Row

    var body: some View {
        HStack(spacing: Brand.Space.small) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: Brand.Space.tight) {
                    Text(row.title).font(.system(size: 15, weight: .semibold)).foregroundStyle(Brand.ink).lineLimit(1)
                    StatusBadge(text: statusLabel, tone: tone)
                }
                if let subtitle = row.subtitle, !subtitle.isEmpty {
                    Text(subtitle).font(.system(size: 12)).foregroundStyle(Brand.inkSoft).lineLimit(1)
                }
            }
            Spacer(minLength: Brand.Space.tight)
            VStack(alignment: .trailing, spacing: 2) {
                if let cents = row.amountCents {
                    Text(money(cents)).font(.system(size: 14, weight: .bold)).monospacedDigit().foregroundStyle(Brand.ink)
                }
                if let date = shortDate(row.date) {
                    Text(date).font(.system(size: 11)).foregroundStyle(Brand.inkFaint)
                }
            }
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(Brand.inkFaint)
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    private var statusLabel: String {
        switch row.status {
        case "changes_requested": return "Changes"
        case "in_progress": return "In progress"
        case "part_paid": return "Part paid"
        case "bad_debt": return "Written off"
        case "on_hold": return "On hold"
        case "complete": return "Done"
        default: return row.status.replacingOccurrences(of: "_", with: " ")
        }
    }

    /// Blue underway, amber waiting, green done or paid, red needs you.
    private var tone: StatusTone {
        switch row.status {
        case "approved", "converted", "paid", "complete", "done", "won", "final": return .active
        case "sent", "viewed", "scheduled", "in_progress", "active", "contacted", "quoted": return .done
        case "draft", "unscheduled", "changes_requested", "part_paid", "on_hold", "new": return .warning
        default: return .neutral
        }
    }

    private func shortDate(_ value: String?) -> String? {
        guard let value, value.count >= 10 else { return nil }
        let day = String(value.prefix(10))
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        parser.locale = Locale(identifier: "en_US_POSIX")
        guard let date = parser.date(from: day) else { return nil }
        let out = DateFormatter()
        out.dateFormat = Calendar.current.isDate(date, equalTo: .now, toGranularity: .year) ? "MMM d" : "MMM d, yyyy"
        return out.string(from: date)
    }
}
