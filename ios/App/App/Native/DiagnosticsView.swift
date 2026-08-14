import SwiftUI

/// What this build can actually reach.
///
/// Exists because an evening was lost to "no database connected" — a message
/// that does not say whether the credentials are missing on this deployment,
/// wrong, or the tables were never created. Those have three different fixes.
/// This asks the server and prints the answer, so the question is settled in
/// ten seconds by looking rather than by guessing over a phone call.
struct DiagnosticsView: View {
    @State private var health: Health?
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if loading && health == nil {
                        ProgressView()
                    } else if let health {
                        Label {
                            Text(health.diagnosis)
                                .font(.callout)
                        } icon: {
                            Image(systemName: health.ok ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                                .foregroundStyle(health.ok ? .green : .orange)
                        }
                    } else if let error {
                        Label(error, systemImage: "xmark.circle.fill")
                            .foregroundStyle(.red)
                            .font(.callout)
                    }
                }

                if let env = health?.env {
                    Section("Credentials on this deployment") {
                        Row("SUPABASE_URL", ok: env.supabaseURL)
                        Row("SUPABASE_SERVICE_ROLE_KEY", ok: env.supabaseServiceRoleKey)
                    }

                    if !env.isConfigured {
                        Section {
                            Text(
                                "A Vercel preview branch does not inherit variables scoped to Production only. In Vercel → Settings → Environment Variables, tick Preview for both, then redeploy."
                            )
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        }
                    }
                }

                if let tables = health?.tables, !tables.isEmpty {
                    Section("Tables") {
                        ForEach(tables.keys.sorted(), id: \.self) { key in
                            let state = tables[key] ?? ""
                            HStack(alignment: .firstTextBaseline) {
                                Text(key).font(.subheadline.monospaced())
                                Spacer()
                                Text(state == "ok" ? "ok" : state)
                                    .font(.caption)
                                    .multilineTextAlignment(.trailing)
                                    .foregroundStyle(state == "ok" ? .green : .orange)
                            }
                        }
                    }
                }

                Section {
                    Text("Server: \(API.baseURL.host() ?? "—")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Status")
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        loading = true
        do {
            health = try await API.shared.health()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }
}

private struct Row: View {
    let name: String
    let ok: Bool

    init(_ name: String, ok: Bool) {
        self.name = name
        self.ok = ok
    }

    var body: some View {
        HStack {
            Text(name).font(.subheadline.monospaced())
            Spacer()
            Image(systemName: ok ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(ok ? .green : .red)
        }
    }
}

/// Scanning, reached natively.
///
/// The capture itself is already native — RoomPlan, presented by
/// `RoomScanPlugin`. What this screen replaces is the web chooser in front of
/// it. Kept deliberately thin for now: the full project → floor → mode chain
/// lives in the web build and is being ported behind it, and shipping a second
/// half-built chooser would give the app two capture paths again, which is the
/// exact problem that was just fixed.
struct ScanEntryView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label("Scanning", systemImage: "camera.viewfinder")
            } description: {
                Text(
                    "Room capture is native already. The project and floor chooser in front of it is being ported next — open a project to see what has been measured."
                )
            }
            .navigationTitle("Scan")
        }
    }
}
