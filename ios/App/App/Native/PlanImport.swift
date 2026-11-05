import PDFKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// **A plan somebody else drew, redrawn here as rooms.**
///
/// The owner, 11 Oct 2026, after two reference plans were rebuilt by hand:
/// *"I want this process to be automated. I want to be able to upload the
/// floor plan from someone that already drew it, and I want our app to be
/// able to redraw it, even if it's just a photo."*
///
/// The rooms are filed exactly the way a room drawn by hand is — the same
/// `ScanGeometry(polygon:ceilingHeight:authored:)`, the same save, the same
/// placement — so an imported room is an ordinary room everywhere after
/// this: editor, estimate, report. Nothing is filed until the operator has
/// seen the result and said yes.
struct PlanImportSheet: View {
    let projectId: String
    let level: String
    let floorLabel: String
    /// The floor as it is, in floor metres — an imported plan is set down
    /// beside whatever is already drawn rather than on top of it.
    let existing: [CaptureFlow.FloorContextRoom]
    let existingCount: Int
    let onFiled: () -> Void

    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var units = UnitSettings.shared

    private enum Stage {
        case choose
        case reading
        case review(PlanImportResult)
        case filing(done: Int, of: Int)
        case failed(String)
    }
    @State private var stage: Stage = .choose
    @State private var photo: PhotosPickerItem?
    @State private var choosingFile = false

    var body: some View {
        NavigationStack {
            Group {
                switch stage {
                case .choose: chooser
                case .reading: reading
                case .review(let result): review(result)
                case .filing(let done, let total): filing(done, total)
                case .failed(let message): failed(message)
                }
            }
            .navigationTitle("Plan from a drawing")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if case .filing = stage {} else { Button("Cancel") { dismiss() } }
                }
            }
        }
        .onChange(of: photo) { _, item in
            guard let item else { return }
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self),
                    let image = UIImage(data: data)
                else {
                    stage = .failed("That photo could not be opened.")
                    return
                }
                await read(image)
            }
        }
        .fileImporter(isPresented: $choosingFile, allowedContentTypes: [.pdf, .image]) { result in
            guard case .success(let url) = result else { return }
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            let image: UIImage?
            if url.pathExtension.lowercased() == "pdf" {
                image = PDFDocument(url: url).flatMap { Self.render(firstPageOf: $0) }
            } else {
                image = (try? Data(contentsOf: url)).flatMap(UIImage.init(data:))
            }
            guard let image else {
                stage = .failed("That file could not be opened as a plan.")
                return
            }
            Task { await read(image) }
        }
    }

    // MARK: - Stages

    private var chooser: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Brand.Space.base) {
                Text("A floor plan somebody else drew — a PDF page, a screenshot, or a photo of a printed sheet — read into rooms on \(floorLabel), with their doors and windows.")
                    .font(.system(size: 15))
                    .foregroundStyle(Brand.inkSoft)

                PhotosPicker(selection: $photo, matching: .images) {
                    Label("Photo or screenshot", systemImage: "photo")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryButtonStyle(enabled: true))

                Button {
                    choosingFile = true
                } label: {
                    Label("PDF or image file", systemImage: "doc")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryButtonStyle(enabled: true))

                Text("Works best with the room sizes or areas printed on the plan — they set the scale. Read on this phone; nothing is sent anywhere, and nothing is added until you have seen the result.")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkFaint)
            }
            .padding(Brand.Space.base)
        }
    }

    private var reading: some View {
        VStack(spacing: Brand.Space.base) {
            ProgressView().controlSize(.large)
            Text("Reading the plan")
                .font(.system(size: 17, weight: .semibold))
            Text("A few seconds, on this phone. The room names and sizes are read off the drawing, then each room is lined up with its walls.")
                .font(.system(size: 14))
                .foregroundStyle(Brand.inkSoft)
                .multilineTextAlignment(.center)
        }
        .padding(Brand.Space.base * 2)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func review(_ result: PlanImportResult) -> some View {
        VStack(spacing: 0) {
            PlanImportPreview(rooms: result.rooms)
                .frame(maxWidth: .infinity)
                .frame(height: 300)
                .background(Brand.Plan.paper)

            List {
                if !result.notes.isEmpty {
                    Section("Worth checking") {
                        ForEach(result.notes, id: \.self) { Text($0).font(.system(size: 14)) }
                    }
                }
                Section("\(result.rooms.count) rooms") {
                    ForEach(result.rooms) { room in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(room.name).font(.system(size: 15, weight: .semibold))
                                Spacer()
                                Text("\(units.format.format(room.size.w)) × \(units.format.format(room.size.h))")
                                    .font(.system(size: 13).monospacedDigit())
                                    .foregroundStyle(Brand.inkSoft)
                            }
                            let doors = room.openings.filter { $0.kind.hasPrefix("door") }.count
                            let windows = room.openings.count - doors
                            if doors + windows > 0 {
                                Text("\(doors) door\(doors == 1 ? "" : "s"), \(windows) window\(windows == 1 ? "" : "s")")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Brand.inkFaint)
                            }
                            if let note = room.note {
                                Text(note).font(.system(size: 12)).foregroundStyle(.orange)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)

            VStack(spacing: Brand.Space.small) {
                Button("Add \(result.rooms.count) rooms to \(floorLabel)") {
                    Task { await file(result) }
                }
                .buttonStyle(PrimaryButtonStyle(enabled: !result.rooms.isEmpty))
                .disabled(result.rooms.isEmpty)
                Button("Choose another plan") { stage = .choose }
                    .font(.system(size: 15))
            }
            .padding(Brand.Space.base)
        }
    }

    private func filing(_ done: Int, _ total: Int) -> some View {
        VStack(spacing: Brand.Space.base) {
            ProgressView(value: Double(done), total: Double(max(total, 1)))
            Text("Adding room \(min(done + 1, total)) of \(total)")
                .font(.system(size: 15, weight: .semibold))
        }
        .padding(Brand.Space.base * 2)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func failed(_ message: String) -> some View {
        VStack(spacing: Brand.Space.base) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 30))
                .foregroundStyle(.orange)
            Text(message)
                .font(.system(size: 15))
                .multilineTextAlignment(.center)
            Button("Try another plan") { stage = .choose }
                .buttonStyle(PrimaryButtonStyle(enabled: true))
        }
        .padding(Brand.Space.base * 2)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Work

    /// Read on the phone itself — Vision for the printed names and sizes,
    /// the image's own ink for the walls (`PlanReader`). Nothing leaves the
    /// device, and it takes a second or two.
    private func read(_ image: UIImage) async {
        stage = .reading
        guard let sheet = Self.flattened(image) else {
            stage = .failed("That image could not be prepared.")
            return
        }
        do {
            let reading = try await Task.detached(priority: .userInitiated) {
                try PlanReader.read(sheet)
            }.value
            stage = .review(PlanImportResult(rooms: reading.rooms, notes: reading.notes))
        } catch {
            stage = .failed(error.localizedDescription)
        }
    }

    /// File every room, then put each where the drawing put it.
    ///
    /// Beside the floor's existing rooms, two metres to their right, when
    /// there are any — an import never lands on top of work already done.
    /// Those rooms' own positions are written first if they were never
    /// saved, the same freeze `CaptureFlow.placeDrawnRoom` does, so the
    /// packer cannot move them out from beside the imported plan afterwards.
    private func file(_ result: PlanImportResult) async {
        let total = result.rooms.count
        stage = .filing(done: 0, of: total)

        var offsetX = 0.0
        var offsetY = 0.0
        let points = existing.filter { $0.level == level }.flatMap(\.polygon)
        if let maxX = points.map(\.x).max(), let minY = points.map(\.y).min() {
            offsetX = maxX + 2
            offsetY = minY
            for room in existing where room.level == level {
                let saved =
                    room.planX.map { abs($0 - room.origin.x) < 0.005 } == true
                    && room.planY.map { abs($0 - room.origin.y) < 0.005 } == true
                guard !saved else { continue }
                try? await API.shared.placeRoom(roomId: room.id, x: room.origin.x, y: room.origin.y)
            }
        }

        var failures: [String] = []
        for (index, room) in result.rooms.enumerated() {
            stage = .filing(done: index, of: total)
            let polygon = room.polygon.map { CGPoint(x: $0.x, y: $0.y) }
            let openings: [PlanEditing.WallOpening] = room.openings.compactMap { opening in
                guard let kind = PlanEditing.OpeningKind(rawValue: opening.kind) else { return nil }
                return PlanEditing.WallOpening(
                    edge: opening.edge, offset: opening.offset, width: opening.width,
                    height: kind.height, sill: kind.sill, kind: kind)
            }
            // Eight feet where the plan says nothing — the ceiling a drawn
            // room defaults to anyway.
            let geometry = ScanGeometry(
                polygon: polygon, ceilingHeight: room.ceilingHeightM ?? 2.44, authored: openings)
            let upload = ScanUpload(
                projectId: projectId, name: room.name, level: level,
                position: existingCount + index, geometry: geometry, roomType: room.roomType)
            do {
                let id = try await API.shared.saveScan(upload)
                try await API.shared.placeRoom(
                    roomId: id, x: room.planX + offsetX, y: room.planY + offsetY)
            } catch {
                failures.append(room.name)
            }
        }

        onFiled()
        if failures.isEmpty {
            dismiss()
        } else {
            stage = .failed("Added \(total - failures.count) of \(total). These did not save: \(failures.joined(separator: ", ")).")
        }
    }

    // MARK: - Images

    /// The image upright on white, at most 2200 px on the long side —
    /// past that the reader only spends longer on the same walls.
    static func flattened(_ image: UIImage) -> CGImage? {
        let longEdge = max(image.size.width, image.size.height)
        guard longEdge > 0 else { return nil }
        let scale = min(1, 2200 / longEdge)
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size))
        }.cgImage
    }

    static func render(firstPageOf document: PDFDocument) -> UIImage? {
        guard let page = document.page(at: 0) else { return nil }
        let box = page.bounds(for: .mediaBox)
        let scale = 2200 / max(box.width, box.height)
        return page.thumbnail(of: CGSize(width: box.width * scale, height: box.height * scale), for: .mediaBox)
    }
}

/// The rooms as read, before anything is filed — outlines, names, and the
/// doors (brown) and windows (blue) on their walls.
private struct PlanImportPreview: View {
    let rooms: [PlanImportResult.Room]

    var body: some View {
        Canvas { context, size in
            let floor = rooms.map { room in
                room.polygon.map { CGPoint(x: $0.x + room.planX, y: $0.y + room.planY) }
            }
            let all = floor.flatMap { $0 }
            guard let minX = all.map(\.x).min(), let maxX = all.map(\.x).max(),
                let minY = all.map(\.y).min(), let maxY = all.map(\.y).max()
            else { return }
            let pad = 16.0
            let scale = min((size.width - pad * 2) / max(maxX - minX, 0.1), (size.height - pad * 2) / max(maxY - minY, 0.1))
            let ox = (size.width - (maxX - minX) * scale) / 2
            let oy = (size.height - (maxY - minY) * scale) / 2
            let pt = { (p: CGPoint) in CGPoint(x: ox + (p.x - minX) * scale, y: oy + (p.y - minY) * scale) }

            for (room, outline) in zip(rooms, floor) where outline.count >= 3 {
                var path = Path()
                path.move(to: pt(outline[0]))
                for p in outline.dropFirst() { path.addLine(to: pt(p)) }
                path.closeSubpath()
                context.fill(path, with: .color(room.outdoor ? Brand.Plan.paper : Brand.Plan.floorMuted))
                context.stroke(path, with: .color(Brand.Plan.ink), lineWidth: room.outdoor ? 0.6 : 1.4)

                for opening in room.openings where outline.indices.contains(opening.edge) {
                    let a = outline[opening.edge]
                    let b = outline[(opening.edge + 1) % outline.count]
                    let length = hypot(b.x - a.x, b.y - a.y)
                    guard length > 0 else { continue }
                    let ux = (b.x - a.x) / length, uy = (b.y - a.y) / length
                    var mark = Path()
                    mark.move(to: pt(CGPoint(x: a.x + ux * opening.offset, y: a.y + uy * opening.offset)))
                    mark.addLine(to: pt(CGPoint(
                        x: a.x + ux * (opening.offset + opening.width),
                        y: a.y + uy * (opening.offset + opening.width))))
                    context.stroke(
                        mark, with: .color(opening.kind.hasPrefix("window") ? .blue : .brown), lineWidth: 3)
                }

                let box = (outline.map(\.x).max()! - outline.map(\.x).min()!) * scale
                if box > 24 {
                    let centre = pt(CGPoint(
                        x: outline.map(\.x).reduce(0, +) / Double(outline.count),
                        y: outline.map(\.y).reduce(0, +) / Double(outline.count)))
                    context.draw(
                        Text(room.name).font(.system(size: min(11, max(6, box * 0.1)), weight: .semibold))
                            .foregroundColor(Brand.Plan.label),
                        at: centre)
                }
            }
        }
    }
}
