import SwiftUI

/// The day, at a glance.
///
/// Jobber opens on Home for a good reason: the first question in the morning
/// is "where am I going and what is chasing me", not "show me a list of every
/// project". So this leads with today's visits, then the things that are
/// tasks rather than records — estimates waiting on an answer, money
/// outstanding, equipment still running somewhere costing rental.
///
/// One request behind it, not six. Six round trips over a job-site connection
/// is the difference between a screen that gets used and one that gets
/// skipped.
struct HomeView: View {
    let onSignedOut: () -> Void

    @State private var summary: DashboardSummary?
    @State private var error: String?
    @State private var scanning = false
    @State private var showMore = false
    @State private var phoning = false
    @State private var texting = false
    @StateObject private var calls = CallManager.shared

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.large) {
                        greeting

                        if let error {
                            Card {
                                Label(error, systemImage: "exclamationmark.triangle.fill")
                                    .font(.callout)
                                    .foregroundStyle(.orange)
                            }
                        }

                        if summary == nil && error == nil {
                            ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                        }

                        if let summary {
                            todaySection(summary)
                            attentionSection(summary)
                            quickActions
                            figuresSection(summary)
                        }
                    }
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.top, Brand.Space.tight)
                    .padding(.bottom, Brand.Space.section)
                }
                .refreshable { await load() }
            }
            .navigationTitle("Today")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Refresh") { Task { await load() } }
                        Button("More") { showMore = true }
                        Divider()
                        Button("Sign out", role: .destructive) { onSignedOut() }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $showMore) { MoreView() }
            .task { await load() }
        }
        .fullScreenCover(isPresented: .constant(calls.state.isBusy)) { InCallView() }
    }

    // MARK: - Sections

    private var greeting: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(Date(), format: .dateTime.weekday(.wide).day().month(.wide))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Brand.inkFaint)
            Text(salutation)
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(Brand.ink)
        }
    }

    /// Reads the clock rather than saying "Hello" all day — a small thing
    /// that makes the screen feel like it knows what time it is.
    private var salutation: String {
        switch Calendar.current.component(.hour, from: Date()) {
        case 0..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        default: return "Good evening"
        }
    }

    private func todaySection(_ summary: DashboardSummary) -> some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            SectionHeading(
                title: "TODAY",
                trailing: summary.visits.isEmpty ? nil : "\(summary.visits.count) scheduled")

            if summary.visits.isEmpty {
                Card {
                    Text("Nothing scheduled today.")
                        .font(.callout)
                        .foregroundStyle(Brand.inkSoft)
                }
            } else {
                ForEach(summary.visits) { visit in
                    Card(padding: Brand.Space.small) {
                        HStack(spacing: Brand.Space.small) {
                            VStack(spacing: 0) {
                                Text(visit.startsAt, format: .dateTime.hour().minute())
                                    .font(.system(size: 13, weight: .bold))
                                    .monospacedDigit()
                                    .foregroundStyle(visit.done ? Brand.inkFaint : Brand.blue)
                            }
                            .frame(width: 54)

                            Text(visit.title ?? "Visit")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(visit.done ? Brand.inkFaint : Brand.ink)
                                .strikethrough(visit.done, color: Brand.inkFaint)

                            Spacer()

                            if visit.done {
                                StatusBadge(text: "done", tone: .active)
                            }
                        }
                    }
                }
            }
        }
    }

    /// Only what is actually a task. A figure that needs no action belongs in
    /// the numbers further down, not in a list called "needs you".
    private func attentionSection(_ summary: DashboardSummary) -> some View {
        let items = summary.attentionItems
        return Group {
            if !items.isEmpty {
                VStack(alignment: .leading, spacing: Brand.Space.small) {
                    SectionHeading(title: "NEEDS YOU")
                    ForEach(items) { item in
                        Card(padding: Brand.Space.small) {
                            HStack(spacing: Brand.Space.small) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 9)
                                        .fill(colour(item.tone).opacity(0.13))
                                    Image(systemName: item.icon)
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(colour(item.tone))
                                }
                                .frame(width: 34, height: 34)

                                VStack(alignment: .leading, spacing: 1) {
                                    Text(item.title)
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(Brand.ink)
                                    Text(item.detail)
                                        .font(.system(size: 12))
                                        .foregroundStyle(Brand.inkFaint)
                                }
                                Spacer()
                            }
                        }
                    }
                }
            }
        }
    }

    private func colour(_ tone: DashboardSummary.Attention.Tone) -> Color {
        switch tone {
        case .urgent: return .red
        case .waiting: return Brand.blue
        case .money: return .orange
        case .running: return Brand.green
        }
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            SectionHeading(title: "QUICK")
            HStack(spacing: Brand.Space.small) {
                QuickAction(icon: "camera.viewfinder", label: "Scan a room", tint: Brand.blue) {
                    scanning = true
                }
                QuickAction(icon: "phone.fill", label: "Phone", tint: Brand.green) {
                    phoning = true
                }
                QuickAction(icon: "message.fill", label: "Messages", tint: Brand.blueDark) {
                    texting = true
                }
            }
        }
        .sheet(isPresented: $scanning) { ScanEntryView() }
        .sheet(isPresented: $phoning) { PhoneView() }
        .sheet(isPresented: $texting) { NavigationStack { MessagesView() } }
    }

    private func figuresSection(_ summary: DashboardSummary) -> some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            SectionHeading(title: "THE BUSINESS")
            StatBand(items: [
                .init(label: "Active jobs", value: "\(summary.projects.active)"),
                .init(label: "Rooms", value: "\(summary.projects.roomsMeasured)"),
                .init(label: "Drying", value: "\(summary.equipment.running)"),
            ])
        }
    }

    private func load() async {
        do {
            summary = try await API.shared.dashboard()
            error = nil
        } catch APIError.notSignedIn {
            onSignedOut()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct QuickAction: View {
    let icon: String
    let label: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Brand.Space.tight) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(tint)
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.ink)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Brand.Space.base)
            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: Brand.Radius.card)
                    .strokeBorder(Brand.hairline, lineWidth: 0.5))
        }
        .buttonStyle(.plain)
    }
}
