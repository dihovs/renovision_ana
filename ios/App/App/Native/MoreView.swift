import SwiftUI

/// Everything that does not deserve a tab.
///
/// Five tabs is the useful limit on a phone, and the five chosen are the ones
/// touched daily. The rest of the CRM — leads, schedule, messages, the price
/// book, reports — still has to be reachable, and burying it in a plain list
/// makes finding anything a scroll.
///
/// So: a grid of tiles behind the ⋯ menu. Grouped by what the operator is
/// trying to do rather than alphabetically, because "I need to check a lead"
/// and "I need to send a quote" are different intents and the eye finds a
/// group faster than it reads a list.
///
/// Tiles marked native open a Swift screen. The rest open the web build in
/// place, honestly labelled, and each one disappears from this grid the day
/// it gets ported.
struct MoreView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var showStatus = false

    private let columns = [GridItem(.adaptive(minimum: 104), spacing: Brand.Space.small)]

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.large) {
                        // Native screens first — no web dot, because they are
                        // not the web.
                        VStack(alignment: .leading, spacing: Brand.Space.small) {
                            SectionHeading(title: "NATIVE")
                            NavigationLink {
                                ScheduleView()
                            } label: {
                                Card(padding: Brand.Space.small) {
                                    CardRow {
                                        Label("Schedule", systemImage: "calendar")
                                            .font(.system(size: 15, weight: .medium))
                                            .foregroundStyle(Brand.ink)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                            NavigationLink {
                                LeadsView()
                            } label: {
                                Card(padding: Brand.Space.small) {
                                    CardRow {
                                        Label("Leads", systemImage: "sparkles")
                                            .font(.system(size: 15, weight: .medium))
                                            .foregroundStyle(Brand.ink)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                            NavigationLink {
                                MessagesView()
                            } label: {
                                Card(padding: Brand.Space.small) {
                                    CardRow {
                                        Label("Messages", systemImage: "message.fill")
                                            .font(.system(size: 15, weight: .medium))
                                            .foregroundStyle(Brand.ink)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                            NavigationLink {
                                PhoneView()
                            } label: {
                                Card(padding: Brand.Space.small) {
                                    CardRow {
                                        Label("Phone", systemImage: "phone.fill")
                                            .font(.system(size: 15, weight: .medium))
                                            .foregroundStyle(Brand.ink)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }

                        ForEach(MoreGroup.all) { group in
                            VStack(alignment: .leading, spacing: Brand.Space.small) {
                                SectionHeading(title: group.title.uppercased())

                                LazyVGrid(columns: columns, spacing: Brand.Space.small) {
                                    ForEach(group.items) { item in
                                        NavigationLink(value: item) {
                                            MoreTile(item: item)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }

                        Card(padding: Brand.Space.small) {
                            CardRow {
                                UnitsSettingRow()
                                    .font(.system(size: 15, weight: .medium))
                            }
                        }

                        Button {
                            showStatus = true
                        } label: {
                            Card(padding: Brand.Space.small) {
                                CardRow {
                                    Label("Connection status", systemImage: "waveform.path.ecg")
                                        .font(.system(size: 15, weight: .medium))
                                        .foregroundStyle(Brand.ink)
                                }
                            }
                        }
                        .buttonStyle(.plain)

                        Text(
                            "Screens marked with a dot are still the web version inside the app. They are being rebuilt in Swift one at a time."
                        )
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.inkFaint)
                        .padding(.horizontal, Brand.Space.hair)
                    }
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.vertical, Brand.Space.base)
                }
            }
            .navigationTitle("More")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: MoreItem.self) { item in
                WebScreen(path: item.path)
                    .ignoresSafeArea(edges: .bottom)
                    .navigationTitle(item.title)
                    .navigationBarTitleDisplayMode(.inline)
            }
            .sheet(isPresented: $showStatus) { DiagnosticsView() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

struct MoreItem: Identifiable, Hashable {
    let title: String
    let icon: String
    let path: String
    /// Colour is a grouping cue, not decoration: on a grid of fourteen tiles
    /// the eye lands on the right area before it reads any label.
    let tint: Color

    var id: String { path }
}

struct MoreGroup: Identifiable {
    let title: String
    let items: [MoreItem]

    var id: String { title }

    static let all: [MoreGroup] = [
        MoreGroup(
            title: "Bringing work in",
            items: [
                MoreItem(title: "Inbox", icon: "tray.full", path: "/admin/inbox", tint: Brand.green),
                MoreItem(title: "Outreach", icon: "megaphone", path: "/admin/outreach", tint: Brand.green),
                MoreItem(title: "Call log", icon: "phone.arrow.down.left", path: "/admin/calls", tint: Brand.green),
                MoreItem(title: "Ana", icon: "waveform", path: "/admin/ana", tint: Brand.green),
            ]),
        MoreGroup(
            title: "Doing the work",
            items: [
                MoreItem(title: "Jobs", icon: "hammer", path: "/admin/jobs", tint: Brand.blue),
                MoreItem(title: "Tasks", icon: "checklist", path: "/admin/tasks", tint: Brand.blue),
            ]),
        MoreGroup(
            title: "Getting paid",
            items: [
                MoreItem(title: "Invoices", icon: "dollarsign.circle", path: "/admin/invoices", tint: Brand.blueDark),
                MoreItem(title: "Expenses", icon: "creditcard", path: "/admin/expenses", tint: Brand.blueDark),
                MoreItem(title: "Price book", icon: "list.bullet.rectangle", path: "/admin/price-book", tint: Brand.blueDark),
                MoreItem(title: "Reports", icon: "chart.bar", path: "/admin/reports", tint: Brand.blueDark),
            ]),
        MoreGroup(
            title: "Setup",
            items: [
                MoreItem(title: "Settings", icon: "gearshape", path: "/admin/settings", tint: Brand.inkSoft)
            ]),
    ]
}

private struct MoreTile: View {
    let item: MoreItem

    var body: some View {
        VStack(spacing: Brand.Space.tight) {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(item.tint.opacity(0.12))
                    Image(systemName: item.icon)
                        .font(.system(size: 22, weight: .medium))
                        .foregroundStyle(item.tint)
                }
                .frame(width: 54, height: 54)

                // The honest marker: this one is still the web build.
                Circle()
                    .fill(Brand.inkFaint.opacity(0.5))
                    .frame(width: 6, height: 6)
                    .offset(x: 2, y: -2)
            }

            Text(item.title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Brand.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Brand.Space.small)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.card)
                .strokeBorder(Brand.hairline, lineWidth: 0.5)
        )
    }
}
