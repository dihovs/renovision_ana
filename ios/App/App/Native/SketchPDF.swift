import PDFKit
import SwiftUI

/// **Sketch PDF** — the plan on its own, one floor per page, without the
/// report around it (the reference's export row of the same name). Drawn by
/// the same `LevelCanvas` the project's floor cards use, so the sheet is the
/// drawing the operator already knows.
struct SketchPDFView: View {
    let projectId: String
    let projectName: String

    @State private var url: URL?
    @State private var error: String?

    var body: some View {
        Group {
            if let url {
                PDFPreview(url: url)
                    .ignoresSafeArea(edges: .bottom)
            } else if let error {
                Text(error).foregroundStyle(.red).padding()
            } else {
                ProgressView("Drawing the plan…")
            }
        }
        .navigationTitle("Sketch PDF")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let url {
                ToolbarItem(placement: .topBarTrailing) {
                    ShareLink(item: url) { Image(systemName: "square.and.arrow.up") }
                }
            }
        }
        .task { await make() }
    }

    @MainActor
    private func make() async {
        do {
            let scans = try await API.shared.scans(projectId: projectId)
            // Per room: a project-wide list carries no room id.
            var byRoom: [String: [RoomObject]] = [:]
            for scan in scans {
                if let list = try? await API.shared.objects(roomScanId: scan.id), !list.isEmpty {
                    byRoom[scan.id] = list
                }
            }
            let levels = Array(Set(scans.map(\.level))).sorted()
            guard !levels.isEmpty else {
                error = "Nothing measured yet — there is no plan to draw."
                return
            }
            let page = CGRect(x: 0, y: 0, width: 792, height: 612)  // US Letter, landscape
            let safe = projectName.replacingOccurrences(of: "/", with: "-")
            let file = FileManager.default.temporaryDirectory
                .appendingPathComponent("\(safe) — Sketch.pdf")
            let pdf = UIGraphicsPDFRenderer(bounds: page)
            try pdf.writePDF(to: file) { context in
                for level in levels {
                    context.beginPage()
                    let rooms = scans.filter { $0.level == level }
                    let sheet = SketchPage(
                        project: projectName, floor: DollhouseScreen.floorName(level), rooms: rooms,
                        objects: byRoom.filter { key, _ in rooms.contains { $0.id == key } })
                        .frame(width: page.width, height: page.height)
                    let renderer = ImageRenderer(content: sheet)
                    renderer.proposedSize = ProposedViewSize(page.size)
                    renderer.render { _, draw in
                        // ImageRenderer draws y-up; the PDF page is y-down.
                        let cg = context.cgContext
                        cg.saveGState()
                        cg.translateBy(x: 0, y: page.height)
                        cg.scaleBy(x: 1, y: -1)
                        draw(cg)
                        cg.restoreGState()
                    }
                }
            }
            url = file
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// One floor, on paper.
private struct SketchPage: View {
    let project: String
    let floor: String
    let rooms: [RoomScan]
    let objects: [String: [RoomObject]]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(project).font(.system(size: 18, weight: .bold))
                Text(floor).font(.system(size: 14)).foregroundStyle(.secondary)
                Spacer()
                Text(Date.now.formatted(date: .abbreviated, time: .omitted))
                    .font(.system(size: 11)).foregroundStyle(.secondary)
            }
            LevelCanvas(rooms: rooms, objects: objects, maxHeight: nil) { _ in }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(36)
        .background(Color.white)
    }
}

private struct PDFPreview: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.document = PDFDocument(url: url)
        return view
    }
    func updateUIView(_ view: PDFView, context: Context) {}
}
