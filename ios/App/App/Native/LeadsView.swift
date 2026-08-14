import SwiftUI

/// The lead pipeline — who asked for help, and where each ask stands.
///
/// Unlike messages, read state here is REAL: `opened_at` exists in the store
/// precisely so the pipeline can show what nobody has looked at, and opening
/// a lead deliberately never advances its status. Reading is not working.
struct LeadsView: View {
    @State private var leads: [LeadSummary]?
    @State private var error: String?
    @State private var filter: String = "active"
    @State private var open: LeadSummary?
    @StateObject private var calls = CallManager.shared

    private static let filters: [(id: String, label: String)] = [
        ("active", "Active"), ("new", "New"), ("quoted", "Quoted"),
        ("won", "Won"), ("lost", "Lost"),
    ]

    private var shown: [LeadSummary] {
        guard let leads else { return [] }
        switch filter {
        case "active": return leads.filter { !["won", "lost"].contains($0.status) }
        case "new": return leads.filter { $0.status == "new" }
        case "quoted": return leads.filter { $0.status == "quoted" }
        case "won": return leads.filter { $0.status == "won" }
        case "lost": return leads.filter { $0.status == "lost" }
        default: return leads
        }
    }

    var body: some View {
        ZStack {
            Brand.canvas.ignoresSafeArea()

            ScrollView {
                LazyVStack(spacing: Brand.Space.small, pinnedViews: []) {
                    // Filter chips, not a segmented control: five states do
                    // not fit one at phone width.
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Brand.Space.tight) {
                            ForEach(Self.filters, id: \.id) { f in
                                Button {
                                    filter = f.id
                                } label: {
                                    Text(f.label)
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundStyle(filter == f.id ? .white : Brand.inkSoft)
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 8)
                                        .background(
                                            filter == f.id ? Brand.charcoalDark : Brand.surface,
                                            in: .capsule)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, Brand.Space.base)
                    }
                    .padding(.horizontal, -Brand.Space.base)

                    if let error {
                        Card {
                            Label(error, systemImage: "exclamationmark.triangle.fill")
                                .font(.callout)
                                .foregroundStyle(.orange)
                        }
                    }

                    if leads == nil {
                        ProgressView().padding(.top, 60)
                    } else if shown.isEmpty {
                        Card {
                            Text("Nothing here. Leads from the website, the phone line and WhatsApp all land in this list.")
                                .font(.callout)
                                .foregroundStyle(Brand.inkSoft)
                        }
                    } else {
                        ForEach(shown) { lead in
                            Button {
                                open = lead
                                // Recorded, never advancing: opened_at is
                                // separate from status by design.
                                Task {
                                    try? await API.shared.touchLead(id: lead.id)
                                    await load()
                                }
                            } label: {
                                LeadCard(lead: lead)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, Brand.Space.base)
                .padding(.top, Brand.Space.small)
                .padding(.bottom, Brand.Space.large)
            }
            .refreshable { await load() }
        }
        .navigationTitle("Leads")
        .dismissableWhenPresented()
        .task { await load() }
        .sheet(item: $open) { lead in
            LeadDetailSheet(lead: lead) { Task { await load() } }
        }
        .fullScreenCover(isPresented: .constant(calls.state.isBusy)) { InCallView() }
    }

    private func load() async {
        do {
            leads = try await API.shared.leads()
            error = nil
        } catch {
            self.error = error.localizedDescription
            if leads == nil { leads = [] }
        }
    }
}

private struct LeadCard: View {
    let lead: LeadSummary

    private var tone: StatusTone {
        switch lead.status {
        case "new": return .info
        case "won": return .active
        case "lost": return .neutral
        case "quoted": return .done
        default: return .neutral
        }
    }

    var body: some View {
        Card(padding: Brand.Space.small) {
            HStack(alignment: .top, spacing: Brand.Space.small) {
                // The unopened dot — the one piece of read state in this app
                // that is genuinely stored rather than invented.
                Circle()
                    .fill(lead.unopened ? Brand.blue : .clear)
                    .frame(width: 8, height: 8)
                    .padding(.top, 6)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: Brand.Space.tight) {
                        Text(lead.name.isEmpty ? "No name" : lead.name)
                            .font(.system(size: 15, weight: lead.unopened ? .bold : .semibold))
                            .foregroundStyle(Brand.ink)
                        if lead.isEmergency {
                            StatusBadge(text: "emergency", tone: .warning)
                        }
                        StatusBadge(text: lead.status, tone: tone)
                    }

                    if let scope = lead.scopeSummary, !scope.isEmpty {
                        Text(scope)
                            .font(.system(size: 13))
                            .foregroundStyle(Brand.inkSoft)
                            .lineLimit(2)
                    }

                    HStack(spacing: Brand.Space.tight) {
                        Text(lead.source)
                        if let address = lead.address, !address.isEmpty {
                            Text("·")
                            Text(address).lineLimit(1)
                        }
                    }
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.inkFaint)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(shortTime(lead.createdAt))
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.inkFaint)
                    if let expected = lead.estimateExpected, !expected.isEmpty {
                        Text(expected)
                            .font(.system(size: 13, weight: .bold))
                            .monospacedDigit()
                            .foregroundStyle(Brand.greenDark)
                    }
                }
            }
        }
    }
}

/// One lead, with the three things worth doing to it: call, text, move it.
private struct LeadDetailSheet: View {
    let lead: LeadSummary
    let onChanged: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var messaging = false
    @StateObject private var calls = CallManager.shared

    private static let statuses = ["new", "contacted", "quoted", "won", "lost"]

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.base) {
                        Card {
                            VStack(alignment: .leading, spacing: Brand.Space.tight) {
                                Text(lead.name.isEmpty ? "No name" : lead.name)
                                    .font(.system(size: 20, weight: .bold))
                                    .foregroundStyle(Brand.ink)
                                if let address = lead.address, !address.isEmpty {
                                    Text(address).font(.system(size: 14)).foregroundStyle(Brand.inkSoft)
                                }
                                if !lead.phone.isEmpty {
                                    Text(CallManager.pretty(CallManager.normalise(lead.phone)))
                                        .font(.system(size: 14).monospacedDigit())
                                        .foregroundStyle(Brand.inkSoft)
                                }
                                if !lead.email.isEmpty {
                                    Text(lead.email).font(.system(size: 14)).foregroundStyle(Brand.inkSoft)
                                }
                            }
                        }

                        if !lead.phone.isEmpty {
                            HStack(spacing: Brand.Space.small) {
                                Button {
                                    Task { await calls.place(to: lead.phone, label: lead.name) }
                                } label: {
                                    Label("Call", systemImage: "phone.fill")
                                        .font(.system(size: 15, weight: .bold))
                                        .foregroundStyle(.white)
                                        .frame(maxWidth: .infinity, minHeight: 48)
                                        .background(Brand.green, in: .rect(cornerRadius: Brand.Radius.card))
                                }
                                .buttonStyle(.plain)

                                Button {
                                    messaging = true
                                } label: {
                                    Label("Message", systemImage: "message.fill")
                                        .font(.system(size: 15, weight: .bold))
                                        .foregroundStyle(.white)
                                        .frame(maxWidth: .infinity, minHeight: 48)
                                        .background(Brand.blue, in: .rect(cornerRadius: Brand.Radius.card))
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        if let scope = lead.scopeSummary, !scope.isEmpty {
                            Card {
                                VStack(alignment: .leading, spacing: Brand.Space.tight) {
                                    SectionHeading(title: "WHAT THEY DESCRIBED")
                                    Text(scope).font(.system(size: 14)).foregroundStyle(Brand.ink)
                                }
                            }
                        }

                        if let notes = lead.notes, !notes.isEmpty {
                            Card {
                                VStack(alignment: .leading, spacing: Brand.Space.tight) {
                                    SectionHeading(title: "NOTES")
                                    Text(notes).font(.system(size: 14)).foregroundStyle(Brand.ink)
                                }
                            }
                        }

                        SectionHeading(title: "MOVE IT ALONG")
                        HStack(spacing: Brand.Space.tight) {
                            ForEach(Self.statuses, id: \.self) { status in
                                Button {
                                    Task {
                                        try? await API.shared.setLeadStatus(id: lead.id, status: status)
                                        onChanged()
                                        dismiss()
                                    }
                                } label: {
                                    Text(status)
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(lead.status == status ? .white : Brand.inkSoft)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 10)
                                        .background(
                                            lead.status == status ? Brand.charcoalDark : Brand.surface,
                                            in: .rect(cornerRadius: Brand.Radius.tile))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(Brand.Space.base)
                }
            }
            .navigationTitle("Lead")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } }
            }
            .sheet(isPresented: $messaging) {
                NavigationStack {
                    MessageThreadView(phone: lead.phone, displayName: lead.name)
                }
            }
        }
        .fullScreenCover(isPresented: .constant(calls.state.isBusy)) { InCallView() }
    }
}
