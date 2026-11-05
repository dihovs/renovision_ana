import SwiftUI

/// The customer book.
///
/// A card per customer with the actions that matter on site attached to it —
/// call, text, email — rather than buried behind a detail screen. On a
/// driveway the operator wants to phone somebody, not read their record.
struct CustomersView: View {
    @State private var clients: [ClientSummary]?
    @State private var error: String?
    @State private var query = ""
    @StateObject private var calls = CallManager.shared
    @State private var creating = false
    /// The customer whose hub is open — the web client page, which lists
    /// everything for them (requests, estimates, quotes, jobs, invoices).
    @State private var opened: ClientSummary?
    @State private var syncing = false
    @State private var phoning = false

    private var shown: [ClientSummary] {
        guard let clients else { return [] }
        guard !query.isEmpty else { return clients }
        return clients.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || ($0.company ?? "").localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: Brand.Space.large) {
                        if let error {
                            Card {
                                Label(error, systemImage: "exclamationmark.triangle.fill")
                                    .font(.callout)
                                    .foregroundStyle(.orange)
                            }
                        }

                        if let clients, query.isEmpty {
                            HeroCard(title: "Your customers", icon: "person.2.fill",
                                     trailing: "\(clients.filter { $0.propertyCount > 0 }.count) with a property") {
                                HeroFigure(label: "Customers", value: "\(clients.count)",
                                           note: "\(clients.filter { $0.phone != nil || !$0.phones.isEmpty }.count) you can call or text")
                            }
                            HStack(spacing: 0) {
                                RoundAction(icon: "person.badge.plus", label: "New", tint: Brand.blue) { creating = true }
                                RoundAction(icon: "person.crop.circle.badge.checkmark", label: "Sync contacts", tint: Brand.green) { syncing = true }
                                RoundAction(icon: "phone.fill", label: "Phone", tint: Brand.green) { phoning = true }
                            }
                        }

                        if clients == nil {
                            ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                        } else if shown.isEmpty {
                            Card {
                                Text(query.isEmpty ? "No customers yet." : "Nothing matches “\(query)”.")
                                    .font(.callout)
                                    .foregroundStyle(Brand.inkSoft)
                            }
                        } else {
                            VStack(alignment: .leading, spacing: Brand.Space.small) {
                                SectionHeading(title: query.isEmpty ? "ALL CUSTOMERS" : "MATCHES", trailing: "\(shown.count)")
                                GroupedCard {
                                    ForEach(Array(shown.enumerated()), id: \.element.id) { index, client in
                                        if index > 0 { RowDivider(inset: 62) }
                                        CustomerCard(client: client, onOpen: { opened = client }) { number in
                                            Task { await calls.place(to: number, label: client.name) }
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

            }
            .navigationTitle("Customers")
            .navigationDestination(item: $opened) { client in
                CustomerHubView(client: client)
            }
            .searchable(text: $query, prompt: "Search customers")
            .sheet(isPresented: $creating) {
                NewCustomerSheet { _ in Task { await load() } }
            }
            .sheet(isPresented: $syncing, onDismiss: { Task { await load() } }) {
                NavigationStack { ContactSyncView() }
            }
            .sheet(isPresented: $phoning) { PhoneView() }
            .task { await load() }
        }
        .fullScreenCover(isPresented: .constant(calls.state.isBusy)) { InCallView() }
    }

    private func load() async {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-uiPreview") {
            clients = Self.previewClients
            return
        }
        #endif
        do {
            clients = try await API.shared.clients()
            error = nil
        } catch {
            self.error = error.localizedDescription
            if clients == nil { clients = [] }
        }
    }
}

#if DEBUG
extension CustomersView {
    /// Sample customers for `-uiPreview` simulator screenshots. Not real people.
    static var previewClients: [ClientSummary] {
        let json = """
        [{"id":"1","name":"Marie Tremblay","company":null,"phone":"+15145550101","phones":[{"number":"+15145550101","type":"mobile","primary":true}],"email":"marie@example.com","propertyCount":1},
         {"id":"2","name":"Syndicat Clark 7027","company":"Syndicat Clark 7027","phone":"+15145550102","phones":[{"number":"+15145550102","type":"work","primary":true}],"email":null,"propertyCount":5},
         {"id":"3","name":"Jean Gagnon","company":null,"phone":null,"phones":[],"email":"jg@example.com","propertyCount":0},
         {"id":"4","name":"Hymus Industrial","company":"Hymus Industrial","phone":"+15145550104","phones":[{"number":"+15145550104","type":"work","primary":true}],"email":null,"propertyCount":2}]
        """
        return (try? JSONDecoder().decode([ClientSummary].self, from: Data(json.utf8))) ?? []
    }
}
#endif

private struct CustomerCard: View {
    let client: ClientSummary
    let onOpen: () -> Void
    let onCall: (String) -> Void

    private var primaryNumber: String? {
        client.phone ?? client.phones.first?.number
    }

    var body: some View {
        IconRow(title: client.name,
                detail: (client.company.flatMap { $0.isEmpty || $0 == client.name ? nil : $0 })
                    ?? (client.propertyCount > 0 ? (client.propertyCount == 1 ? "1 property" : "\(client.propertyCount) properties") : client.email)) {
            InitialsAvatar(name: client.name, size: 40)
        } trailing: {
            // The one action worth a tap from a list. Absent rather than
            // disabled when there is no number — a dead button invites
            // tapping it again.
            if let number = primaryNumber {
                Button {
                    onCall(number)
                } label: {
                    Image(systemName: "phone.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 34, height: 34)
                        .background(Brand.green, in: .circle)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Call \(client.name)")
            }
        }
        // A tap anywhere but the call button opens the customer's hub; the
        // Button keeps its own touches.
        .onTapGesture(perform: onOpen)
        .accessibilityAddTraits(.isButton)
    }

    private var initials: String {
        let parts = client.name.split(separator: " ").prefix(2)
        return parts.map { String($0.prefix(1)).uppercased() }.joined()
    }
}

/// Estimates — what has been quoted, and what is waiting on an answer.
///
/// Ordered by what needs chasing rather than by date. An estimate that has
/// been sent and not answered is a job that has not been won yet, and it is
/// the only thing on this screen that is a task rather than a record.
struct EstimatesView: View {
    @State private var invoices: [QuoteSummary]?
    @State private var error: String?
    @State private var showPaid = false
    @State private var buildingQuote = false

    private var awaiting: [QuoteSummary] { (invoices ?? []).filter(\.isAwaitingAnswer) }
    private var rest: [QuoteSummary] { (invoices ?? []).filter { !$0.isAwaitingAnswer } }
    private var awaitingCents: Int { awaiting.reduce(0) { $0 + $1.totalCents } }

    // Pushed from More now (no stack of its own) — it was a tab root.
    var body: some View {
            ZStack(alignment: .bottomTrailing) {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    LazyVStack(spacing: Brand.Space.base) {
                        if let invoices {
                            HeroCard(title: "Quotes", icon: "doc.text.fill",
                                     trailing: "\(invoices.count) in all",
                                     actionTitle: "Build a new quote", action: { buildingQuote = true }) {
                                HeroFigure(label: "Out for an answer", value: money(awaitingCents),
                                           note: awaiting.count == 1 ? "1 quote waiting on the customer" : "\(awaiting.count) quotes waiting on the customers")
                            }
                        }

                        if let error {
                            Card {
                                Label(error, systemImage: "exclamationmark.triangle.fill")
                                    .font(.callout)
                                    .foregroundStyle(.orange)
                            }
                        }

                        if invoices == nil {
                            ProgressView().padding(.top, 40)
                        } else if invoices!.isEmpty {
                            Card {
                                Text("No estimates yet.")
                                    .font(.callout)
                                    .foregroundStyle(Brand.inkSoft)
                            }
                        }

                        if !awaiting.isEmpty {
                            VStack(alignment: .leading, spacing: Brand.Space.small) {
                                SectionHeading(
                                    title: "WAITING ON AN ANSWER", trailing: money(awaitingCents))
                                GroupedCard {
                                    ForEach(Array(awaiting.enumerated()), id: \.element.id) { index, quote in
                                        if index > 0 { RowDivider(inset: Brand.Space.base) }
                                        QuoteCard(quote: quote)
                                    }
                                }
                            }
                        }

                        if !rest.isEmpty {
                            VStack(alignment: .leading, spacing: Brand.Space.small) {
                                Button {
                                    withAnimation(.easeOut(duration: 0.18)) { showPaid.toggle() }
                                } label: {
                                    SectionHeading(
                                        title: showPaid ? "EVERYTHING ELSE" : "EVERYTHING ELSE — TAP TO SHOW",
                                        trailing: "\(rest.count)")
                                }
                                .buttonStyle(.plain)

                                if showPaid {
                                    GroupedCard {
                                        ForEach(Array(rest.enumerated()), id: \.element.id) { index, quote in
                                            if index > 0 { RowDivider(inset: Brand.Space.base) }
                                            QuoteCard(quote: quote)
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

            }
            .navigationTitle("Quotes")
            .sheet(isPresented: $buildingQuote) {
                NavigationStack {
                    WebScreen(path: "/admin/quotes/new")
                        .ignoresSafeArea(edges: .bottom)
                        .navigationTitle("New estimate")
                        .navigationBarTitleDisplayMode(.inline)
                }
            }
            .task { await load() }
    }

    private func load() async {
        #if DEBUG
        if PreviewData.on { invoices = PreviewData.quotes; return }
        #endif
        do {
            invoices = try await API.shared.quotes()
            error = nil
        } catch {
            self.error = error.localizedDescription
            if invoices == nil { invoices = [] }
        }
    }
}

private struct QuoteCard: View {
    let quote: QuoteSummary

    private var tone: StatusTone {
        switch quote.status {
        case "approved", "converted": return .active
        case "declined": return .warning
        case "draft": return .neutral
        case "changes_requested": return .warning
        default: return .info
        }
    }

    var body: some View {
            HStack(spacing: Brand.Space.small) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: Brand.Space.tight) {
                        Text(verbatim: "#\(quote.quoteNumber)")
                            .font(.system(size: 12, weight: .bold))
                            .monospacedDigit()
                            .foregroundStyle(Brand.inkFaint)
                        StatusBadge(text: quote.statusLabel, tone: tone)
                    }
                    Text(quote.clientName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Brand.ink)
                    if let title = quote.title, !title.isEmpty {
                        Text(title)
                            .font(.system(size: 12))
                            .foregroundStyle(Brand.inkFaint)
                            .lineLimit(1)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(money(quote.totalCents))
                        .font(.system(size: 16, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(Brand.ink)
                    // How long it has been sitting, but only once it has
                    // actually been sent — a draft nobody has seen is not
                    // overdue for an answer.
                    if let days = quote.daysWaiting {
                        Text(days == 0 ? "sent today" : "\(days)d waiting")
                            .font(.system(size: 11, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(days >= 7 ? .orange : Brand.inkFaint)
                    }
                }
            }
            .padding(.horizontal, Brand.Space.base)
            .padding(.vertical, 12)
    }
}

/// Cents to dollars, in the app's one place for it.
func money(_ cents: Int) -> String {
    let value = Double(cents) / 100
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "CAD"
    formatter.maximumFractionDigits = value.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 2
    formatter.locale = Locale(identifier: "en_CA")
    return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
}
