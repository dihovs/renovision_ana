import RoomPlan
import SwiftUI

/// Scanning, reached as a verb.
///
/// A technician thinks "I am going to scan this house", so the tab stays while
/// the scanner is being tested daily. What it must not do is scan into
/// nowhere: a measurement with no property attached is a record of work
/// nobody can bill, and the web build had exactly that problem until it was
/// closed. So this asks which property and then hands straight to the same
/// capture flow a project uses. One capture path, two doors into it.
struct ScanEntryView: View {
    @State private var projects: [ProjectSummary]?
    @State private var chosen: ProjectSummary?
    @State private var error: String?
    @State private var query = ""

    private var shown: [ProjectSummary] {
        guard let projects else { return [] }
        guard !query.isEmpty else { return projects }
        return projects.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || ($0.clientName ?? "").localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.base) {
                        if !RoomCaptureSession.isSupported {
                            Card {
                                VStack(alignment: .leading, spacing: Brand.Space.tight) {
                                    Text("This device can't scan")
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundStyle(Brand.ink)
                                    Text(
                                        "Room scanning needs the LiDAR sensor — iPhone Pro from 12 onward, or iPad Pro from 2020."
                                    )
                                    .font(.callout)
                                    .foregroundStyle(Brand.inkSoft)
                                }
                            }
                        }

                        if let error {
                            Card {
                                Label(error, systemImage: "exclamationmark.triangle.fill")
                                    .font(.callout)
                                    .foregroundStyle(.orange)
                            }
                        }

                        SectionHeading(title: "WHICH PROPERTY?")

                        if projects == nil {
                            ProgressView().frame(maxWidth: .infinity).padding(.top, 30)
                        } else if shown.isEmpty {
                            Card {
                                Text(
                                    query.isEmpty
                                        ? "No projects yet. A measurement belongs to a job — create the project first and its rooms live inside it."
                                        : "Nothing matches “\(query)”."
                                )
                                .font(.callout)
                                .foregroundStyle(Brand.inkSoft)
                            }
                        } else {
                            ForEach(shown) { project in
                                Button {
                                    chosen = project
                                } label: {
                                    Card(padding: Brand.Space.small) {
                                        CardRow {
                                            VStack(alignment: .leading, spacing: 3) {
                                                Text(project.name)
                                                    .font(.system(size: 15, weight: .semibold))
                                                    .foregroundStyle(Brand.ink)
                                                    .multilineTextAlignment(.leading)
                                                Text(
                                                    project.roomCount > 0
                                                        ? "\(project.clientName ?? "No client") · \(project.roomCount) measured"
                                                        : (project.clientName ?? "No client")
                                                )
                                                .font(.system(size: 12))
                                                .foregroundStyle(Brand.inkFaint)
                                            }
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(Brand.Space.base)
                }
                .refreshable { await load() }
            }
            .navigationTitle("Scan")
            .searchable(text: $query, prompt: "Search projects")
            .task { await load() }
            .sheet(item: $chosen) { project in
                CaptureFlow(
                    projectId: project.id,
                    projectName: project.name,
                    existingCount: project.roomCount,
                    onSaved: { Task { await load() } })
            }
        }
    }

    private func load() async {
        do {
            projects = try await API.shared.projects()
            error = nil
        } catch {
            self.error = error.localizedDescription
            if projects == nil { projects = [] }
        }
    }
}
