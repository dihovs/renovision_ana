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
                    LazyVStack(spacing: Brand.Space.small) {
                        if let error {
                            Card {
                                Label(error, systemImage: "exclamationmark.triangle.fill")
                                    .font(.callout)
                                    .foregroundStyle(.orange)
                            }
                        }

                        if clients == nil {
                            ProgressView().padding(.top, 60)
                        } else if shown.isEmpty {
                            Card {
                                Text(query.isEmpty ? "No customers yet." : "Nothing matches “\(query)”.")
                                    .font(.callout)
                                    .foregroundStyle(Brand.inkSoft)
                            }
                        } else {
                            ForEach(shown) { client in
                                CustomerCard(client: client) { number in
                                    Task { await calls.place(to: number, label: client.name) }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.top, Brand.Space.small)
                    .padding(.bottom, 96)
                }
                .refreshable { await load() }

                FloatingAction(icon: "person.badge.plus") {}
                    .padding(.trailing, Brand.Space.large)
                    .padding(.bottom, Brand.Space.large)
            }
            .navigationTitle("Customers")
            .searchable(text: $query, prompt: "Search customers")
            .task { await load() }
        }
        .fullScreenCover(isPresented: .constant(calls.state.isBusy)) { InCallView() }
    }

    private func load() async {
        do {
            clients = try await API.shared.clients()
            error = nil
        } catch {
            self.error = error.localizedDescription
            if clients == nil { clients = [] }
        }
    }
}

private struct CustomerCard: View {
    let client: ClientSummary
    let onCall: (String) -> Void

    private var primaryNumber: String? {
        client.phone ?? client.phones.first?.number
    }

    var body: some View {
        Card(padding: Brand.Space.small) {
            HStack(spacing: Brand.Space.small) {
                ZStack {
                    Circle().fill(Brand.blue.opacity(0.12))
                    Text(initials)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Brand.blue)
                }
                .frame(width: 44, height: 44)

                VStack(alignment: .leading, spacing: 2) {
                    Text(client.name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Brand.ink)
                    if let company = client.company, !company.isEmpty {
                        Text(company)
                            .font(.system(size: 12))
                            .foregroundStyle(Brand.inkFaint)
                    } else if client.propertyCount > 0 {
                        Text("^[\(client.propertyCount) property](inflect: true)")
                            .font(.system(size: 12))
                            .foregroundStyle(Brand.inkFaint)
                    }
                }

                Spacer()

                // The one action worth a tap from a list. Absent rather than
                // disabled when there is no number — a dead button invites
                // tapping it again.
                if let number = primaryNumber {
                    Button {
                        onCall(number)
                    } label: {
                        Image(systemName: "phone.fill")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 38, height: 38)
                            .background(Brand.green, in: .circle)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
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

    private var awaiting: [QuoteSummary] { (invoices ?? []).filter(\.isAwaitingAnswer) }
    private var rest: [QuoteSummary] { (invoices ?? []).filter { !$0.isAwaitingAnswer } }
    private var awaitingCents: Int { awaiting.reduce(0) { $0 + $1.totalCents } }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    LazyVStack(spacing: Brand.Space.base) {
                        if let invoices, !invoices.isEmpty {
                            StatBand(items: [
                                .init(label: "Out for answer", value: money(awaitingCents)),
                                .init(label: "Waiting", value: "\(awaiting.count)"),
                                .init(label: "Total", value: "\(invoices.count)"),
                            ])
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
                                ForEach(awaiting) { QuoteCard(quote: $0) }
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
                                    ForEach(rest) { QuoteCard(quote: $0) }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.top, Brand.Space.small)
                    .padding(.bottom, 96)
                }
                .refreshable { await load() }

                FloatingAction(icon: "plus") {}
                    .padding(.trailing, Brand.Space.large)
                    .padding(.bottom, Brand.Space.large)
            }
            .navigationTitle("Estimates")
            .task { await load() }
        }
    }

    private func load() async {
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
        Card(padding: Brand.Space.small) {
            HStack(spacing: Brand.Space.small) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: Brand.Space.tight) {
                        Text("#\(quote.quoteNumber)")
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
        }
    }
}

/// Cents to dollars, in the app's one place for it.
private func money(_ cents: Int) -> String {
    let value = Double(cents) / 100
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "CAD"
    formatter.maximumFractionDigits = value.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 2
    formatter.locale = Locale(identifier: "en_CA")
    return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
}
