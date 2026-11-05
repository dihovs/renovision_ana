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
    @State private var showLeads = false
    @State private var showMore = false
    @State private var phoning = false
    @State private var texting = false
    @StateObject private var calls = CallManager.shared

    /// Where a Home row leads. Pushed inside Home's own stack, so Back
    /// returns here.
    private enum Route: Hashable {
        case schedule, quotes
        case web(path: String, title: String)
    }
    @State private var route: Route?

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.large) {
                        header

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
                            todayCard(summary)
                            quickActions(summary)
                            toDoSection(summary)
                            businessSection(summary)
                        }
                    }
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.top, Brand.Space.tight)
                    .padding(.bottom, Brand.Space.section)
                }
                .refreshable { await load() }
            }
            // The greeting is the title; a second "Today" above it said the
            // same thing twice.
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(item: $route) { route in
                switch route {
                case .schedule: ScheduleView()
                case .quotes: EstimatesView()
                case .web(let path, let title):
                    WebScreen(path: path)
                        .ignoresSafeArea(edges: .bottom)
                        .navigationTitle(title)
                        .navigationBarTitleDisplayMode(.inline)
                }
            }
            .sheet(isPresented: $showMore) { MoreView() }
            .task { await load() }
        }
        .fullScreenCover(isPresented: .constant(calls.state.isBusy)) { InCallView() }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text(Date(), format: .dateTime.weekday(.wide).day().month(.wide))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Brand.inkFaint)
                Text(salutation)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Brand.ink)
            }
            Spacer()
            Menu {
                Button("Refresh", systemImage: "arrow.clockwise") { Task { await load() } }
                Button("All tools", systemImage: "square.grid.2x2") { showMore = true }
                Divider()
                Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) { onSignedOut() }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Brand.ink)
                    .frame(width: 40, height: 40)
                    .background(Brand.surface, in: .circle)
                    .overlay(Circle().strokeBorder(Brand.hairline, lineWidth: 0.5))
            }
            .accessibilityLabel("Options")
        }
        .padding(.top, Brand.Space.small)
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

    // MARK: - Today

    /// The day, in one card: how many visits, what is next, and the way into
    /// the full schedule. Blue so it is the first thing the eye lands on.
    private func todayCard(_ summary: DashboardSummary) -> some View {
        let open = summary.visits.filter { !$0.done }
        let next = open.first { $0.startsAt > .now } ?? open.first
        return VStack(alignment: .leading, spacing: Brand.Space.small) {
            HStack {
                Label("Today", systemImage: "calendar")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white.opacity(0.85))
                Spacer()
                Text(summary.visits.isEmpty ? "No visits" : "^[\(summary.visits.count) visit](inflect: true)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.85))
            }

            if let next {
                VStack(alignment: .leading, spacing: 2) {
                    Text("NEXT")
                        .font(.system(size: 10, weight: .heavy)).tracking(0.5)
                        .foregroundStyle(.white.opacity(0.7))
                    Text(next.title ?? "Site visit")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                    Text(next.startsAt, format: .dateTime.hour().minute())
                        .font(.system(size: 15, weight: .semibold)).monospacedDigit()
                        .foregroundStyle(.white.opacity(0.9))
                }
                if summary.visits.count > 1 {
                    VStack(spacing: 6) {
                        ForEach(summary.visits.filter { $0.id != next.id }.prefix(3)) { visit in
                            HStack(spacing: Brand.Space.small) {
                                Text(visit.startsAt, format: .dateTime.hour().minute())
                                    .font(.system(size: 13, weight: .bold)).monospacedDigit()
                                    .frame(width: 52, alignment: .leading)
                                Text(visit.title ?? "Visit").font(.system(size: 14)).lineLimit(1)
                                    .strikethrough(visit.done)
                                Spacer()
                                if visit.done { Image(systemName: "checkmark.circle.fill") }
                            }
                            .foregroundStyle(.white.opacity(visit.done ? 0.6 : 0.95))
                        }
                    }
                    .padding(.top, 4)
                }
            } else {
                Text(summary.visits.isEmpty ? "Nothing booked today." : "Every visit today is done.")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)
            }

            Button {
                route = .schedule
            } label: {
                HStack {
                    Text("Open schedule").font(.system(size: 14, weight: .bold))
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold))
                }
                .foregroundStyle(Brand.blue)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(.white, in: .rect(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .padding(Brand.Space.base)
        .background(
            LinearGradient(colors: [Brand.blue, Brand.blueDark], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: .rect(cornerRadius: Brand.Radius.card))
    }

    // MARK: - Quick actions

    /// **Leads, calls and texts — the things that arrive while the phone is
    /// in a pocket** — with iPhone-style counts that clear once opened (his
    /// instructions of 21 Aug). Round, in one row, like a phone's own
    /// actions; Schedule joins them so the day is one tap away too.
    private func quickActions(_ summary: DashboardSummary) -> some View {
        HStack(spacing: 0) {
            QuickAction(icon: "sparkles", label: "Leads", tint: Brand.blue,
                        badge: summary.leadBadge, badgeNoun: "new lead") {
                showLeads = true
            }
            QuickAction(icon: "phone.fill", label: "Phone", tint: Brand.green,
                        badge: summary.callBadge, badgeNoun: "missed call") {
                phoning = true
                Task { await API.shared.markSeen("calls") }
            }
            QuickAction(icon: "message.fill", label: "Messages", tint: Brand.blueDark,
                        badge: summary.messageBadge, badgeNoun: "unread message") {
                texting = true
                Task { await API.shared.markSeen("messages") }
            }
            QuickAction(icon: "calendar", label: "Schedule", tint: Brand.blue) {
                route = .schedule
            }
        }
        .sheet(isPresented: $showLeads) { NavigationStack { LeadsView() } }
        .sheet(isPresented: $phoning) { PhoneView() }
        .sheet(isPresented: $texting) { NavigationStack { MessagesView() } }
        // Marking a surface seen changes a number this screen is drawing, so
        // the screen has to ask again — otherwise the badge sits there until
        // the next pull-to-refresh and the tap looks like it did nothing.
        .onChange(of: phoning) { _, open in if !open { Task { await load() } } }
        .onChange(of: texting) { _, open in if !open { Task { await load() } } }
        .onChange(of: showLeads) { _, open in if !open { Task { await load() } } }
    }

    // MARK: - To do

    /// Only what is actually a task, each one a row that opens the thing.
    private func toDoSection(_ summary: DashboardSummary) -> some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            SectionHeading(title: "TO DO")
            VStack(spacing: 0) {
                let rows = toDoRows(summary)
                if rows.isEmpty {
                    HStack(spacing: Brand.Space.small) {
                        Image(systemName: "checkmark.seal.fill").foregroundStyle(Brand.green)
                        Text("You're all caught up.").font(.system(size: 15, weight: .semibold)).foregroundStyle(Brand.ink)
                        Spacer()
                    }
                    .padding(Brand.Space.base)
                }
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    if index > 0 { Divider().overlay(Brand.hairline).padding(.leading, 60) }
                    Button(action: row.action) {
                        HStack(spacing: Brand.Space.small) {
                            Image(systemName: row.icon)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(row.tint)
                                .frame(width: 34, height: 34)
                                .background(row.tint.opacity(0.13), in: .rect(cornerRadius: 9))
                            VStack(alignment: .leading, spacing: 1) {
                                Text(row.title).font(.system(size: 15, weight: .semibold)).foregroundStyle(Brand.ink)
                                Text(row.detail).font(.system(size: 12)).foregroundStyle(Brand.inkFaint).lineLimit(1)
                            }
                            Spacer(minLength: Brand.Space.tight)
                            Text(row.count)
                                .font(.system(size: 15, weight: .bold)).monospacedDigit()
                                .foregroundStyle(row.tint)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(Brand.inkFaint)
                        }
                        .padding(.horizontal, Brand.Space.base)
                        .padding(.vertical, 12)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Brand.Radius.card).strokeBorder(Brand.hairline, lineWidth: 0.5))
        }
    }

    private struct ToDoRow {
        let icon: String
        let tint: Color
        let title: String
        let detail: String
        let count: String
        let action: () -> Void
    }

    private func toDoRows(_ summary: DashboardSummary) -> [ToDoRow] {
        var rows: [ToDoRow] = []
        if summary.leadBadge > 0 {
            rows.append(.init(icon: "sparkles", tint: Brand.blue, title: "New requests",
                              detail: "Leads nobody has opened yet.", count: "\(summary.leadBadge)") { showLeads = true })
        }
        if summary.missedCalls > 0 {
            rows.append(.init(icon: "phone.badge.waveform", tint: .red, title: "Missed calls today",
                              detail: "Rang the business line and did not get through.", count: "\(summary.missedCalls)") {
                phoning = true
            })
        }
        if summary.estimates.awaiting > 0 {
            rows.append(.init(icon: "doc.text", tint: Brand.blue, title: "Quotes waiting for an answer",
                              detail: "\(Money.short(summary.estimates.awaitingCents)) out with customers.",
                              count: "\(summary.estimates.awaiting)") { route = .quotes })
        }
        if summary.invoices.outstanding > 0 {
            rows.append(.init(icon: "dollarsign.circle", tint: .orange, title: "Invoices unpaid",
                              detail: "\(Money.short(summary.invoices.outstandingCents)) still owing.",
                              count: "\(summary.invoices.outstanding)") { route = .web(path: "/admin/invoices", title: "Invoices") })
        }
        if summary.equipment.running > 0 {
            rows.append(.init(icon: "wind", tint: Brand.green, title: "Equipment on site",
                              detail: "\(summary.equipment.unitDays) unit-days so far — pick up when dry.",
                              count: "\(summary.equipment.running)") { route = .web(path: "/admin/projects", title: "Projects") })
        }
        return rows
    }

    // MARK: - The business

    private func businessSection(_ summary: DashboardSummary) -> some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            SectionHeading(title: "THE BUSINESS")
            LazyVGrid(columns: [GridItem(.flexible(), spacing: Brand.Space.small), GridItem(.flexible(), spacing: Brand.Space.small)],
                      spacing: Brand.Space.small) {
                FigureTile(label: "Quotes out", value: Money.short(summary.estimates.awaitingCents),
                           note: "^[\(summary.estimates.awaiting) quote](inflect: true)", icon: "doc.text", tint: Brand.blue)
                FigureTile(label: "Owing to you", value: Money.short(summary.invoices.outstandingCents),
                           note: "^[\(summary.invoices.outstanding) invoice](inflect: true)", icon: "dollarsign.circle", tint: .orange)
                FigureTile(label: "Active jobs", value: "\(summary.projects.active)",
                           note: "of \(summary.projects.total) projects", icon: "folder", tint: Brand.blueDark)
                FigureTile(label: "Drying", value: "\(summary.equipment.running)",
                           note: "^[\(summary.projects.roomsMeasured) room](inflect: true) measured", icon: "wind", tint: Brand.green)
            }
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
    /// How many are waiting. Zero draws nothing at all — a badge showing `0`
    /// is a claim that something is there.
    var badge: Int = 0
    /// The singular noun the count is of, for the screen reader: a red dot
    /// with a number in it says nothing out loud.
    var badgeNoun: String = "new item"
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(width: 56, height: 56)
                    .background(Brand.surface, in: .circle)
                    .overlay(Circle().strokeBorder(Brand.hairline, lineWidth: 0.5))
                    .overlay(alignment: .topTrailing) { badgeView }
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.ink)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            badge > 0
                ? "\(label), ^[\(badge) \(badgeNoun)](inflect: true)"
                : label)
        .accessibilityAddTraits(.isButton)
    }

    /// **The system's badge, not an approximation of it.**
    ///
    /// A capsule rather than a circle so `12` does not squeeze; a minimum
    /// width so `1` is still round; monospaced digits so the thing does not
    /// jump a pixel as the count changes under a glance. `99+` because four
    /// digits on a 100-point tile is a smear, and past ninety-nine the exact
    /// number has stopped being the point.
    ///
    /// It sits ON the corner, half outside the card, which is what makes it
    /// read as attached to the tile rather than printed inside it.
    @ViewBuilder private var badgeView: some View {
        if badge > 0 {
            Text(badge > 99 ? "99+" : "\(badge)")
                .font(.system(size: 11, weight: .bold).monospacedDigit())
                .foregroundStyle(.white)
                .padding(.horizontal, 5)
                .frame(minWidth: 18, minHeight: 18)
                .background(Color.red, in: .capsule)
                .overlay(Capsule().strokeBorder(Brand.canvas, lineWidth: 1.5))
                .offset(x: 4, y: -2)
                .transition(.scale.combined(with: .opacity))
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: badge)
        }
    }
}

/// One figure, in a tile: what it is, the number, a line of context.
private struct FigureTile: View {
    let label: String
    let value: String
    let note: String
    let icon: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label.uppercased())
                    .font(.system(size: 10, weight: .heavy)).tracking(0.3)
                    .foregroundStyle(Brand.inkFaint)
                Spacer()
                Image(systemName: icon).font(.system(size: 13, weight: .semibold)).foregroundStyle(tint)
            }
            Text(value)
                .font(.system(size: 24, weight: .bold, design: .rounded)).monospacedDigit()
                .foregroundStyle(Brand.ink)
                .lineLimit(1).minimumScaleFactor(0.6)
            Text(note).font(.system(size: 12)).foregroundStyle(Brand.inkSoft).lineLimit(1)
        }
        .padding(Brand.Space.base)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Brand.Radius.card).strokeBorder(Brand.hairline, lineWidth: 0.5))
    }
}
