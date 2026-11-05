import SwiftUI

/// The schedule: what is happening, day by day.
///
/// Overdue first and loud. A visit that never got ticked off is not history —
/// it is either work someone forgot to record or work that never happened,
/// and both are the most important row on the board. Then today, then what
/// is coming.
struct ScheduleView: View {
    @State private var visits: [VisitSummary]?
    @State private var error: String?

    private var overdue: [VisitSummary] {
        (visits ?? []).filter { !$0.done && $0.startsAt < Calendar.current.startOfDay(for: Date()) }
    }

    /// Days from today forward, keyed to their visits, in order.
    private var days: [(day: Date, visits: [VisitSummary])] {
        let today = Calendar.current.startOfDay(for: Date())
        let upcoming = (visits ?? []).filter { $0.startsAt >= today }
        let grouped = Dictionary(grouping: upcoming) {
            Calendar.current.startOfDay(for: $0.startsAt)
        }
        return grouped.keys.sorted().map { ($0, grouped[$0]!.sorted { $0.startsAt < $1.startsAt }) }
    }

    private var todays: [VisitSummary] {
        (visits ?? []).filter { Calendar.current.isDateInToday($0.startsAt) }
    }

    var body: some View {
        ZStack {
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

                    if visits == nil {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                    } else {
                        hero
                    }

                    if !overdue.isEmpty {
                        VStack(alignment: .leading, spacing: Brand.Space.small) {
                            SectionHeading(title: "OVERDUE — NEVER TICKED OFF", trailing: "\(overdue.count)")
                            GroupedCard {
                                ForEach(Array(overdue.enumerated()), id: \.element.id) { index, visit in
                                    if index > 0 { RowDivider(inset: 56) }
                                    VisitRow(visit: visit, overdue: true) { await load() }
                                }
                            }
                        }
                    }

                    ForEach(days, id: \.day) { entry in
                        VStack(alignment: .leading, spacing: Brand.Space.small) {
                            SectionHeading(title: dayTitle(entry.day), trailing: "\(entry.visits.count)")
                            GroupedCard {
                                ForEach(Array(entry.visits.enumerated()), id: \.element.id) { index, visit in
                                    if index > 0 { RowDivider(inset: 56) }
                                    VisitRow(visit: visit, overdue: false) { await load() }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, Brand.Space.base)
                .padding(.top, Brand.Space.small)
                .padding(.bottom, Brand.Space.section)
            }
            .refreshable { await load() }
        }
        .navigationTitle("Schedule")
        .dismissableWhenPresented()
        .task { await load() }
    }

    /// Today in one card, the way Home opens.
    private var hero: some View {
        let open = todays.filter { !$0.done }
        let next = open.first { $0.startsAt > .now } ?? open.first
        let upcoming = days.reduce(0) { $0 + $1.visits.count }
        return HeroCard(title: "Today", icon: "calendar",
                        trailing: todays.isEmpty ? "No visits" : "\(todays.count - open.count) of \(todays.count) done") {
            if let next {
                VStack(alignment: .leading, spacing: 2) {
                    Text("NEXT").font(.system(size: 10, weight: .heavy)).tracking(0.5).opacity(0.7)
                    Text(next.displayTitle).font(.system(size: 20, weight: .bold)).lineLimit(2)
                    Text([next.allDay ? "All day" : next.startsAt.formatted(date: .omitted, time: .shortened),
                          next.clientName].compactMap { $0 }.joined(separator: " · "))
                        .font(.system(size: 15, weight: .semibold)).opacity(0.9)
                }
            } else {
                Text(todays.isEmpty ? "Nothing booked today." : "Every visit today is done.")
                    .font(.system(size: 20, weight: .bold))
            }
            Text(verbatim: (upcoming == 1 ? "1 visit" : "\(upcoming) visits") + " on the calendar" + (overdue.isEmpty ? "." : ", \(overdue.count) overdue."))
                .font(.system(size: 13, weight: .medium)).opacity(0.85)
                .padding(.top, 2)
        }
    }

    private func dayTitle(_ day: Date) -> String {
        if Calendar.current.isDateInToday(day) { return "TODAY" }
        if Calendar.current.isDateInTomorrow(day) { return "TOMORROW" }
        return day.formatted(.dateTime.weekday(.wide).day().month(.abbreviated)).uppercased()
    }

    private func load() async {
        #if DEBUG
        if PreviewData.on { visits = PreviewData.visits; return }
        #endif
        do {
            visits = try await API.shared.visits()
            error = nil
        } catch {
            self.error = error.localizedDescription
            if visits == nil { visits = [] }
        }
    }
}

private struct VisitRow: View {
    let visit: VisitSummary
    let overdue: Bool
    let onChanged: () async -> Void

    @State private var toggling = false

    var body: some View {
            HStack(spacing: Brand.Space.small) {
                // The tick IS the schedule action that happens on site;
                // everything else about a visit is desk work.
                Button {
                    guard !toggling else { return }
                    toggling = true
                    Task {
                        try? await API.shared.setVisitDone(id: visit.id, done: !visit.done)
                        await onChanged()
                        toggling = false
                    }
                } label: {
                    Image(systemName: visit.done ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 24))
                        .foregroundStyle(visit.done ? Brand.green : Brand.inkFaint)
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 2) {
                    Text(visit.displayTitle)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(visit.done ? Brand.inkFaint : Brand.ink)
                        .strikethrough(visit.done, color: Brand.inkFaint)

                    HStack(spacing: 4) {
                        if overdue {
                            Text(visit.startsAt.formatted(.dateTime.month(.abbreviated).day()))
                                .foregroundStyle(.red)
                        }
                        Text(
                            visit.allDay
                                ? "All day"
                                : visit.startsAt.formatted(date: .omitted, time: .shortened))
                        if let client = visit.clientName {
                            Text("·")
                            Text(client)
                        }
                    }
                    .font(.system(size: 12))
                    .foregroundStyle(overdue ? .red : Brand.inkFaint)
                }

                Spacer()

                if let number = visit.jobNumber {
                    Text(verbatim: "#\(number)")
                        .font(.system(size: 12, weight: .bold).monospacedDigit())
                        .foregroundStyle(Brand.inkFaint)
                }
            }
            .padding(.horizontal, Brand.Space.base)
            .padding(.vertical, 12)
            .background(overdue ? Color.red.opacity(0.04) : .clear)
    }
}
