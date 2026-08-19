import CoreImage
import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit

/// Looking at a claim photo, and redacting it.
///
/// Built to `Docs/reference/magicplan/object-model.md` §2a, which maps their
/// editor in full: chrome is `Cancel · undo · redo · Done`, and four MODES
/// switched by the icon row at the very bottom — Draw, Pixelate, Crop and
/// transform, Adjustments — each replacing the controls above it.
///
/// **Only Pixelate is built, and that is deliberate.** S6's own instruction
/// is "do blur first and ship it alone", because blur is not a nice-to-have
/// on this job: a restoration photo routinely catches a driver's licence on
/// a kitchen counter, a face, or a plate through a window, and with no way
/// to redact, the only safe thing an operator can do is NOT TAKE THE PHOTO.
/// That is evidence lost off a claim. The other three modes are conveniences
/// beside it.
///
/// The three unbuilt modes are drawn in their places, greyed — the rule this
/// app already follows for `Add Wall` and `Split Room` on the plan editor's
/// bar. The row the owner learns is the row the reference has; a mode that
/// is merely absent teaches a layout that will change under him later.
struct PhotoEditorView: View {
    /// The photo being edited, at whatever resolution it was stored.
    let original: UIImage
    /// Where a redacted copy gets filed. The same coordinates the photo was
    /// uploaded under, so the copy lands exactly where the original was.
    let projectId: String
    let roomScanId: String?
    let affectedAreaId: String?
    let wallIndex: Int?
    /// The photo this replaces. Deleted only after the redacted copy has
    /// been accepted by the server — see `commit`.
    let replacing: RoomPhoto
    let onFinished: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .pixelate
    /// The redactions, in the image's OWN pixel coordinates rather than the
    /// screen's — so the preview and the full-resolution render are the same
    /// arithmetic, and a redaction cannot land somewhere else in the file
    /// than where the finger drew it.
    @State private var redactions: [CGRect] = []
    @State private var future: [[CGRect]] = []
    @State private var dragging: CGRect?
    @State private var preview: UIImage?
    @State private var saving = false
    @State private var error: String?
    @State private var confirmingDone = false

    /// §2a's four modes, in the reference's own order.
    enum Mode: CaseIterable, Hashable {
        case draw
        case pixelate
        case crop
        case adjust

        var label: String {
            switch self {
            case .draw: return "Draw"
            case .pixelate: return "Pixelate"
            case .crop: return "Crop"
            case .adjust: return "Adjust"
            }
        }

        var icon: String {
            switch self {
            case .draw: return "scribble"
            case .pixelate: return "mosaic"
            case .crop: return "crop.rotate"
            case .adjust: return "dial.min"
            }
        }

        /// Built, or drawn in its place and greyed. Only Pixelate so far.
        var isBuilt: Bool { self == .pixelate }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                canvas
                Divider()
                controls
                modeRow
            }
            .background(Brand.canvas)
            .navigationTitle("Edit Photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                // §2a puts undo and redo in the chrome, between Cancel and
                // Done — not in the tool area, where they would come and go
                // with the mode.
                ToolbarItemGroup(placement: .principal) {
                    Button {
                        undo()
                    } label: {
                        Image(systemName: "arrow.uturn.backward")
                    }
                    .disabled(redactions.isEmpty)

                    Button {
                        redo()
                    } label: {
                        Image(systemName: "arrow.uturn.forward")
                    }
                    .disabled(future.isEmpty)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView().controlSize(.small)
                    } else {
                        Button("Done") { confirmingDone = true }
                            .fontWeight(.semibold)
                            .disabled(redactions.isEmpty)
                    }
                }
            }
            // Redaction destroys, and it says so before it does it. The
            // original is deleted from the server on Done — that IS the
            // feature, since a blurred copy sitting beside a readable
            // original redacts nothing — but it is not something to discover
            // afterwards.
            .confirmationDialog(
                "Replace the original with the redacted copy?",
                isPresented: $confirmingDone, titleVisibility: .visible
            ) {
                Button("Replace and delete original", role: .destructive) {
                    Task { await commit() }
                }
                Button("Keep editing", role: .cancel) {}
            } message: {
                Text(
                    "The unblurred photo is deleted from the server. That is the point of blurring it — but it cannot be undone."
                )
            }
            .alert(
                "Could not save",
                isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })
            ) {
                Button("OK", role: .cancel) { error = nil }
            } message: {
                Text(error ?? "")
            }
        }
        .interactiveDismissDisabled(!redactions.isEmpty)
    }

    // MARK: - The image, and the finger on it

    private var canvas: some View {
        GeometryReader { proxy in
            // The drawn rect, not the offered one. `scaledToFit` means the
            // image occupies less than it was given on one axis, and an
            // overlay positioned in the OFFER lands off the picture by
            // however much — the S4 bug, which cost a session on the plan
            // editor and would repeat here exactly.
            let drawn = Self.fitted(image: original.size, in: proxy.size)

            ZStack {
                Color.black
                Image(uiImage: preview ?? original)
                    .resizable()
                    .scaledToFit()
                    .frame(width: drawn.width, height: drawn.height)
                    .overlay(alignment: .topLeading) {
                        // The rectangle being dragged right now, drawn as an
                        // outline over the picture. Committed ones are not
                        // drawn here — they are IN the preview image, which
                        // is what makes what you see what you get.
                        if let dragging {
                            let onScreen = Self.toScreen(dragging, image: original.size, drawn: drawn)
                            Rectangle()
                                .strokeBorder(Color.yellow, lineWidth: 2)
                                .frame(width: onScreen.width, height: onScreen.height)
                                .offset(x: onScreen.minX, y: onScreen.minY)
                        }
                    }
                    .contentShape(.rect)
                    .gesture(
                        mode.isBuilt
                            ? DragGesture(minimumDistance: 6)
                                .onChanged { value in
                                    dragging = Self.rect(
                                        from: value.startLocation, to: value.location,
                                        image: original.size, drawn: drawn)
                                }
                                .onEnded { _ in
                                    if let dragging, dragging.width > 4, dragging.height > 4 {
                                        redactions.append(dragging)
                                        future.removeAll()
                                        rebuildPreview()
                                    }
                                    dragging = nil
                                }
                            : nil
                    )
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
    }

    // MARK: - The mode's own controls

    @ViewBuilder private var controls: some View {
        switch mode {
        case .pixelate:
            // §2a: "No options at all: the tool row disappears and you drag
            // directly on the image." So this is a caption, not a toolbar —
            // saying the one thing the operator needs to know, since a mode
            // with no controls otherwise looks like a mode that is broken.
            VStack(spacing: 4) {
                Text("Drag across anything that must not be readable.")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                Text(
                    redactions.isEmpty
                        ? "Faces, documents, licence plates."
                        : "\(redactions.count) area\(redactions.count == 1 ? "" : "s") blurred · Done replaces the original"
                )
                .font(.system(size: 12))
                .foregroundStyle(Brand.inkSoft)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Brand.Space.base)
        default:
            VStack(spacing: 4) {
                Text("\(mode.label) isn't built yet")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                Text("Blur shipped first — it is what a claim photo needs.")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkSoft)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Brand.Space.base)
        }
    }

    /// §2a's bottom icon row — four modes, in their order, whether or not
    /// they do anything yet.
    private var modeRow: some View {
        HStack(spacing: 0) {
            ForEach(Mode.allCases, id: \.self) { candidate in
                Button {
                    mode = candidate
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: candidate.icon)
                            .font(.system(size: 20))
                        Text(candidate.label)
                            .font(.system(size: 11))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Brand.Space.small)
                    .foregroundStyle(mode == candidate ? Brand.blue : Brand.inkSoft)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .disabled(!candidate.isBuilt)
                .opacity(candidate.isBuilt ? 1 : 0.35)
            }
        }
        .background(Brand.surface)
    }

    // MARK: - History

    private func undo() {
        guard !redactions.isEmpty else { return }
        future.append(redactions)
        redactions.removeLast()
        rebuildPreview()
    }

    private func redo() {
        guard let next = future.popLast() else { return }
        redactions = next
        rebuildPreview()
    }

    // MARK: - Rendering

    /// Redraw the on-screen preview from the redaction list.
    ///
    /// The SAME routine renders what gets uploaded — see `commit` — so the
    /// operator cannot be shown one redaction and file another.
    private func rebuildPreview() {
        preview = Self.redacted(original, regions: redactions)
    }

    private func commit() async {
        saving = true
        error = nil
        defer { saving = false }

        guard let flat = Self.redacted(original, regions: redactions),
            let jpeg = flat.jpegData(compressionQuality: 0.85)
        else {
            error = "Could not render the redacted photo."
            return
        }

        do {
            // Upload FIRST. If this fails there is still exactly one photo,
            // the unredacted one, and the operator can try again. Deleting
            // first would risk having neither.
            _ = try await API.shared.uploadPhoto(
                projectId: projectId, roomScanId: roomScanId, affectedAreaId: affectedAreaId,
                wallIndex: wallIndex, jpeg: jpeg, note: replacing.note)
            // Only now is the readable original worth removing — and it must
            // be removed, or the blur was decoration.
            try await API.shared.deletePhoto(id: replacing.id)
            onFinished()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Geometry and pixels

    /// What a `scaledToFit` image actually occupies inside a container.
    ///
    /// Shared by the gesture and the overlay so the two agree by
    /// construction. `FloorPlanView` taught this the expensive way: a view
    /// that constrains its own size does not fill what it was offered, and
    /// an overlay positioned in the offer sits wrong by the difference.
    static func fitted(image: CGSize, in container: CGSize) -> CGRect {
        guard image.width > 0, image.height > 0 else { return .zero }
        let scale = min(container.width / image.width, container.height / image.height)
        let size = CGSize(width: image.width * scale, height: image.height * scale)
        return CGRect(
            x: (container.width - size.width) / 2,
            y: (container.height - size.height) / 2,
            width: size.width, height: size.height)
    }

    /// Two screen points → one rect in the IMAGE's own pixels.
    ///
    /// Clamped to the image, because a finger that runs off the edge of the
    /// picture means "to the edge", not "past it" — and a region outside the
    /// bitmap silently redacts nothing.
    static func rect(from a: CGPoint, to b: CGPoint, image: CGSize, drawn: CGRect) -> CGRect {
        guard drawn.width > 0, drawn.height > 0 else { return .zero }
        let scale = image.width / drawn.width
        let x0 = min(a.x, b.x) * scale
        let x1 = max(a.x, b.x) * scale
        let y0 = min(a.y, b.y) * scale
        let y1 = max(a.y, b.y) * scale
        let clamped = CGRect(x: x0, y: y0, width: x1 - x0, height: y1 - y0)
            .intersection(CGRect(origin: .zero, size: image))
        return clamped.isNull ? .zero : clamped
    }

    /// One image-pixel rect back to the drawn image's own coordinates.
    static func toScreen(_ rect: CGRect, image: CGSize, drawn: CGRect) -> CGRect {
        guard image.width > 0 else { return .zero }
        let scale = drawn.width / image.width
        return CGRect(
            x: rect.minX * scale, y: rect.minY * scale,
            width: rect.width * scale, height: rect.height * scale)
    }

    /// The redaction itself: pixelate each region, and draw it back over the
    /// picture.
    ///
    /// **Pixelate rather than blur, and the difference matters.** A Gaussian
    /// blur is a reversible-looking operation — it preserves the low
    /// frequencies, and text under a light blur has repeatedly been read
    /// back out by deconvolution. Pixellation at a coarse cell throws the
    /// information away instead. The reference calls this mode "Pixelate /
    /// blur"; where the two disagree, the one that actually destroys the
    /// pixels is the one a claim photo needs.
    ///
    /// The cell is scaled to the REGION, not fixed: a 40pt cell over a
    /// licence plate in a 4000px photo leaves the plate perfectly readable.
    /// An eighth of the region's short side, floored at 12px, keeps the
    /// redaction destructive at any size.
    ///
    /// Returns nil rather than the original on failure — a caller that
    /// cannot tell "redacted" from "unchanged" is how an unredacted photo
    /// gets uploaded as a redacted one.
    static func redacted(_ image: UIImage, regions: [CGRect]) -> UIImage? {
        guard !regions.isEmpty else { return image }
        guard let cgImage = image.cgImage else { return nil }

        let context = CIContext()
        let full = CIImage(cgImage: cgImage)
        // Core Image's origin is bottom-left; UIKit's is top-left, and the
        // rects arrived in UIKit's. Flipping here rather than at every use
        // keeps one conversion in one place.
        let height = full.extent.height

        var output = full
        for region in regions {
            let flipped = CGRect(
                x: region.minX, y: height - region.maxY,
                width: region.width, height: region.height)
            guard flipped.width > 1, flipped.height > 1 else { continue }

            let filter = CIFilter.pixellate()
            filter.inputImage = full
            filter.scale = Float(max(12, min(flipped.width, flipped.height) / 8))
            filter.center = CGPoint(x: flipped.midX, y: flipped.midY)
            guard let pixelated = filter.outputImage else { continue }

            // `CIPixellate` returns an image the size of the whole picture;
            // cropping it to the region is what confines the effect, and
            // compositing that over the running output is what lets several
            // redactions stack without each one undoing the last.
            output = pixelated.cropped(to: flipped).composited(over: output)
        }

        guard let rendered = context.createCGImage(output, from: full.extent) else { return nil }
        return UIImage(cgImage: rendered, scale: image.scale, orientation: image.imageOrientation)
    }
}

// MARK: - The viewer the editor is reached from

/// One photo, full screen, with `Edit`.
///
/// §2a reaches the editor from the photo viewer's `Edit`, and until now this
/// app had no viewer at all — the thumbnails in `RoomPhotosSection` were not
/// even tappable, so a photo could be uploaded and then never looked at on
/// the phone that took it.
struct PhotoViewer: View {
    let photo: RoomPhoto
    let projectId: String
    let roomScanId: String?
    let affectedAreaId: String?
    let wallIndex: Int?
    /// Called when an edit replaced this photo, so the grid behind can
    /// reload — the id it was drawing no longer exists.
    let onReplaced: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var loaded: UIImage?
    @State private var editing = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                if let loaded {
                    Image(uiImage: loaded)
                        .resizable()
                        .scaledToFit()
                } else {
                    ProgressView().tint(.white)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Edit") { editing = true }
                        .disabled(loaded == nil)
                }
            }
            .task { await load() }
            .fullScreenCover(isPresented: $editing) {
                if let loaded {
                    PhotoEditorView(
                        original: loaded,
                        projectId: projectId,
                        roomScanId: roomScanId,
                        affectedAreaId: affectedAreaId,
                        wallIndex: wallIndex,
                        replacing: photo,
                        onFinished: {
                            onReplaced()
                            dismiss()
                        })
                }
            }
        }
    }

    /// Fetched at full stored resolution rather than reusing the grid's
    /// thumbnail: an editor that redacts a 96pt copy would upload a 96pt
    /// photo over a 2048px one.
    private func load() async {
        guard let url = photo.url.flatMap(URL.init) else { return }
        if let (data, _) = try? await URLSession.shared.data(from: url) {
            loaded = UIImage(data: data)
        }
    }
}
