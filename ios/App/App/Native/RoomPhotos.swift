import PhotosUI
import AVFoundation
import AVKit
import SwiftUI
import UIKit

/// Photographs on a room.
///
/// Evidence is most of a restoration claim — nine of the twenty pages in the
/// report this app is measured against are photo grids — and a photo is only
/// worth having if it is attached to something. "Which room was this?" is a
/// question nobody can answer from a filename a week later, which is exactly
/// why these upload against the room rather than into a loose project pile.
struct RoomPhotosSection: View {
    let projectId: String
    let roomScanId: String
    /// When set, this is a WALL's own photos (object-model §2b) rather than
    /// the room's general pile — a different tab, filtered on both read and
    /// write so the two never mix.
    var wallIndex: Int? = nil
    /// When set, this is one AFFECTED AREA's own photos — same idea one
    /// level down. "The wet patch behind the vanity" is evidence about the
    /// patch; filed only against the room it becomes one of forty photos
    /// nobody can attribute a month later.
    var affectedAreaId: String? = nil
    /// What the section calls itself. The room's pile is just `Photos`; a
    /// narrowed one says whose.
    var title: String = "Photos"

    @State private var photos: [RoomPhoto]?
    @State private var takingPhoto = false
    /// Whether the camera cover actually made it ON SCREEN — set by the
    /// cover's own `onAppear`/`onDisappear`, not by the flag that requested
    /// it. The two differ exactly when the system drops a presentation, which
    /// is the fault `presentCamera` exists to survive.
    @State private var cameraOnScreen = false
    @State private var pickedItem: PhotosPickerItem?
    /// The library sheet, opened from the `+` menu rather than by its own
    /// button — a `PhotosPicker` cannot be a row inside a `Menu`.
    @State private var choosingFromLibrary = false
    @State private var uploading = false
    @State private var error: String?
    /// The photo open full-screen, if any — the route to the editor.
    @State private var viewing: RoomPhoto?
    /// A VIDEO open full-screen — its own route, `VideoPlayerView`, never
    /// `PhotoViewer`. The reference gives a video the same viewer chrome
    /// minus `Edit`; this app draws that as a genuinely separate, simpler
    /// screen rather than teaching the photo viewer and its editor route to
    /// understand a media kind neither was built for.
    @State private var viewingVideo: RoomPhoto?
    @State private var uploadingVideo = false
    /// Photos this phone is still holding, so the grid shows them the moment
    /// they are taken rather than after the server has them.
    @ObservedObject private var queue = PhotoQueue.shared

    /// What this phone is holding for THIS grid — the room, or the wall, or
    /// the area, matched the same way the server's own filter matches.
    private var waiting: [PhotoQueue.Held] {
        queue.pending(
            roomScanId: roomScanId, wallIndex: wallIndex, affectedAreaId: affectedAreaId)
    }

    /// Four across, as theirs is.
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 4)

    var body: some View {
        Section {
            // **Their photo well, duplicated.** One card, four tiles across,
            // `+` in the first slot and DASHED empty slots filling out the
            // grid. The dashes are not decoration: they say how many
            // photographs this thing is expecting, and a room that shows
            // eight empty slots gets eight photographs. The horizontal strip
            // this replaced showed nothing at all until the first one was
            // taken, so there was never anything on screen asking for one.
            LazyVGrid(columns: columns, spacing: 8) {
                addTile

                ForEach(photos ?? []) { photo in
                    // Tappable, which they were not until S6. A photo that
                    // can be uploaded and never looked at again on the phone
                    // that took it is half a feature — and the reference
                    // reaches its editor from the viewer's `Edit`, so there
                    // was nowhere for blur to live either. A VIDEO routes to
                    // its own viewer (S7) — never the photo one, which has
                    // no idea what to do with a clip and an `Edit` button
                    // the reference explicitly does not offer on video.
                    Button {
                        if photo.isVideo {
                            viewingVideo = photo
                        } else {
                            viewing = photo
                        }
                    } label: {
                        ZStack(alignment: .bottomTrailing) {
                            square {
                                // A video's poster frame stands in for the
                                // clip itself — a grid of moving thumbnails
                                // is not what six-tiles-across was built for.
                                let faceURL = (photo.isVideo ? photo.thumbnailUrl : photo.url)
                                    .flatMap(URL.init)
                                AsyncImage(url: faceURL) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image.resizable().scaledToFill()
                                    default:
                                        if photo.isVideo {
                                            Brand.surface.overlay {
                                                Image(systemName: "video.fill")
                                                    .foregroundStyle(Brand.inkFaint)
                                            }
                                        } else {
                                            Brand.surface
                                        }
                                    }
                                }
                            }
                            // The reference's duration badge — `0:30`,
                            // `0:03`, `m:ss` with no leading zero on minutes
                            // (`object-model.md` §2e). Same corner and same
                            // visual family as the "uploading" cloud badge
                            // below, so a tile only ever wears one kind of
                            // overlay at a time.
                            if let label = photo.durationLabel {
                                Text(label)
                                    .font(.system(size: 11, weight: .semibold).monospacedDigit())
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 2)
                                    .background(Brand.charcoal.opacity(0.75), in: .capsule)
                                    .padding(5)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }

                // Held on this phone: drawn exactly like the rest, with a
                // cloud mark. A photo that has been taken IS in the record as
                // far as the operator is concerned, and hiding it until the
                // server agrees would make them take it twice.
                ForEach(waiting) { held in
                    ZStack(alignment: .bottomTrailing) {
                        square {
                            if let image = queue.image(for: held) {
                                Image(uiImage: image).resizable().scaledToFill()
                            } else {
                                Brand.surface
                            }
                        }
                        Image(systemName: "icloud.and.arrow.up")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(4)
                            .background(Brand.charcoal.opacity(0.75), in: .capsule)
                            .padding(5)
                    }
                }

                ForEach(0..<emptySlots, id: \.self) { _ in
                    Color.clear
                        .aspectRatio(1, contentMode: .fit)
                        .overlay {
                            RoundedRectangle(cornerRadius: Brand.Radius.tile)
                                .strokeBorder(
                                    Brand.inkFaint.opacity(0.45),
                                    style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                        }
                }
            }
            .padding(Brand.Space.small)
            .background(Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.card))
            .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))

            if uploading {
                ProgressView().controlSize(.small)
            }

            if uploadingVideo {
                HStack(spacing: Brand.Space.tight) {
                    ProgressView().controlSize(.small)
                    Text("Uploading video…").font(.footnote).foregroundStyle(Brand.inkFaint)
                }
            }

            if let error {
                Text(error).font(.footnote).foregroundStyle(.red)
            }
        } header: {
            HStack {
                Text(title)
                Spacer()
                if let photos, !photos.isEmpty || !waiting.isEmpty {
                    Text("\(photos.count + waiting.count)")
                        .font(.caption.monospacedDigit())
                }
                if !waiting.isEmpty {
                    // Says what is happening rather than leaving a cloud
                    // badge to be interpreted.
                    Text("\(waiting.count) waiting to upload")
                        .font(.caption)
                        .foregroundStyle(Brand.inkFaint)
                }
            }
        }
        .task { await load() }
        // A queued photo left the queue — it either landed on the server or
        // failed out. Either way the server's list is the truth now, and
        // this is the ONE place the grid re-fetches after a capture; see the
        // note in `upload(_:)` for the lag that fetching per shot caused.
        .onChange(of: waiting.count) { old, new in
            if new < old { Task { await load() } }
        }
        .onChange(of: pickedItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self),
                    let image = UIImage(data: data) {
                    await upload(image)
                }
                pickedItem = nil
            }
        }
        .fullScreenCover(item: $viewing) { photo in
            PhotoViewer(
                photo: photo,
                projectId: projectId,
                roomScanId: roomScanId,
                affectedAreaId: affectedAreaId,
                wallIndex: wallIndex,
                // A redaction uploads a new photo and deletes the old one,
                // so the id this grid was drawing is gone. Reload rather
                // than patch: the list is the server's answer, not ours.
                onReplaced: { Task { await load() } })
        }
        .fullScreenCover(item: $viewingVideo) { photo in
            VideoPlayerView(photo: photo)
        }
        .photosPicker(isPresented: $choosingFromLibrary, selection: $pickedItem, matching: .images)
        .fullScreenCover(isPresented: $takingPhoto) {
            // Ours, not the system's — the reference's camera stamps the
            // frame as you aim and offers the lens buttons, and neither is
            // possible inside `UIImagePickerController`.
            // No `.ignoresSafeArea()` here any more — see the note in
            // `SiteCameraView.body`. It pushed the header under the notch and
            // the controls under the home indicator, and the view already
            // takes the whole screen without it.
            SiteCameraView(
                onPhoto: { image in Task { await upload(image) } },
                onVideo: { url in Task { await upload(video: url) } })
                // Ground truth for `presentCamera`'s retry: the cover is on
                // screen when IT says so, not when the flag asked for it.
                .onAppear { cameraOnScreen = true }
                .onDisappear { cameraOnScreen = false }
        }
    }

    /// One tile of the well. `Color.clear` at a 1:1 fit is what makes a
    /// flexible grid column square — a photograph told to fill a square
    /// resizes the square instead, and the row grows to whatever the tallest
    /// picture wanted to be.
    private func square<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay { content() }
            .clipShape(.rect(cornerRadius: Brand.Radius.tile))
    }

    /// **The `+`, and the menu it opens.** His screenshot of the reference:
    /// tapping it raises two rows — `Camera / Take Photo, 360 or Video` and
    /// `Photo Library / Choose Photo or Video` — rather than jumping
    /// straight into a camera. That matters on site: half the useful
    /// photographs were taken an hour before the app was open, and a `+`
    /// that always opens a viewfinder makes those unreachable.
    ///
    /// Ours says `Take a photo or video`, without the 360 — see
    /// `SiteCameraView` for why that mode is not here.
    private var addTile: some View {
        Menu {
            Button {
                openCamera()
            } label: {
                Text("Camera")
                Text("Take a photo or video")
                Image(systemName: "camera")
            }
            Button {
                choosingFromLibrary = true
            } label: {
                Text("Photo Library")
                Text("Choose a photo")
                Image(systemName: "photo.on.rectangle")
            }
        } label: {
            square {
                Brand.surface.overlay {
                    Image(systemName: "plus")
                        .font(.system(size: 22, weight: .light))
                        .foregroundStyle(Brand.inkSoft)
                }
            }
        }
    }

    /// Enough dashed slots to fill the grid out to two full rows, and to
    /// complete whatever row the real photographs end on after that.
    private var emptySlots: Int {
        let used = 1 + (photos?.count ?? 0) + waiting.count
        let rows = max(2, Int((Double(used) / 4).rounded(.up)))
        return max(0, rows * 4 - used)
    }

    /// Ask for the camera BEFORE presenting one.
    ///
    /// **His report, 20 Aug 2026:** *"when I click on the camera, the camera
    /// opens and closes one time first. And then the second time when I
    /// click, it opens."*
    ///
    /// That is the signature of presenting `UIImagePickerController` with
    /// `.camera` before iOS has granted access. The picker comes up, the
    /// permission alert comes up over it, and the picker — which has no
    /// camera to show — tears itself down. By the second tap permission has
    /// been granted, so it works, and the fault looks intermittent.
    ///
    /// `requestAccess` returns immediately when the answer is already known,
    /// so this costs nothing after the first time.
    /// **Present, then verify it presented, and retry once if it did not.**
    ///
    /// The owner, 20 Aug: *"the camera opens and then closes, and then the
    /// second time when I click, it opens."* The first fix was a fixed 350 ms
    /// wait for the `+` menu's dismissal (SwiftUI drops a cover raised while
    /// another presentation is still going down, and a `Menu` has no
    /// dismissal callback to chain on). **He reported the identical symptom
    /// again on 23 Aug, with that fix installed and verified on the device**
    /// — so the timer either loses the race some of the time or the drop has
    /// a second cause entirely, and a longer guess would just lose more
    /// slowly.
    ///
    /// So the guess is replaced with a check. `cameraOnScreen` is set by the
    /// cover's own `onAppear` — ground truth, not intent. If the request
    /// flag is up but the camera never arrived, the presentation was
    /// dropped: log WHICH state it died in (the diagnostics file has
    /// answered three "it doesn't work" reports already), take the flag
    /// down, let the failed presentation finish collapsing, and raise it
    /// once more. One retry, not a loop — if the second attempt also dies,
    /// something is structurally wrong and hammering the presenter would
    /// only make the screen flicker.
    @MainActor
    private func presentCamera() {
        Task {
            // Still outwaits the menu's dismissal — the retry below is the
            // net, not the plan.
            try? await Task.sleep(for: .milliseconds(350))
            takingPhoto = true

            // A cover that is going to survive is on screen well inside a
            // second; one that got dropped never arrives at all.
            try? await Task.sleep(for: .milliseconds(900))
            guard !cameraOnScreen else { return }
            ScanLens.appendToDiagnostics(
                "CAMERA-DROP: cover requested but never appeared "
                    + "(takingPhoto=\(takingPhoto)) — re-presenting once")
            takingPhoto = false
            try? await Task.sleep(for: .milliseconds(300))
            takingPhoto = true
        }
    }

    private func openCamera() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            presentCamera()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                Task { @MainActor in
                    if granted {
                        // The permission alert is itself a presentation, and
                        // it has to be gone before the camera can rise.
                        presentCamera()
                    } else {
                        // Not an error to retry — a decision, and the only
                        // place it can be changed is Settings.
                        error = "Camera access is off for this app. Settings › Renovision › Camera."
                    }
                }
            }
        default:
            error = "Camera access is off for this app. Settings › Renovision › Camera."
        }
    }

    private func load() async {
        photos =
            (try? await API.shared.photos(
                roomScanId: roomScanId, wallIndex: wallIndex,
                affectedAreaId: affectedAreaId)) ?? []
    }

    /// Take the photo, hold it, and let it upload behind the operator.
    ///
    /// **Never blocks on the network**, which is the owner's ask and the
    /// right shape besides: *"they're in a place when there is no Internet,
    /// I want them to be able to upload the photos… and whenever they have
    /// an Internet, it will upload."*
    ///
    /// A restoration photograph records a condition that will not exist
    /// tomorrow — the water is being extracted, the drywall is coming out.
    /// Losing one to a failed POST in a basement is losing it for good, and
    /// nobody finds out until an adjuster asks. `PhotoQueue` writes it to
    /// disk first and sends it when there is signal.
    private func upload(_ image: UIImage) async {
        error = nil
        let held = PhotoQueue.shared.enqueue(
            image, projectId: projectId, roomScanId: roomScanId,
            affectedAreaId: affectedAreaId, wallIndex: wallIndex, note: nil)
        if !held {
            error = PhotoQueue.shared.lastError ?? "Could not save that photo on this phone."
            return
        }
        // **No server round-trip here — that was the lag.** This used to
        // `await load()` on every shot, so each press of the shutter cost a
        // full photo-list fetch from wherever the operator was standing,
        // which on a job-site connection is seconds — the owner reported it
        // twice. The queue's pending row (`waiting`, observed reactively)
        // already puts the photo on the grid the instant it is taken; the
        // reload belongs at the moment an upload LANDS, and `onChange` of
        // the waiting count below does exactly that.
    }

    /// A kept recording, end to end: poster frame, duration, upload.
    ///
    /// **Not queued, unlike a photo.** `PhotoQueue` exists so a photo taken
    /// with no signal is never lost — but this only runs once the operator
    /// has explicitly chosen to keep a clip that is already safe in Photos
    /// regardless of what happens next, so a failed upload here costs
    /// nothing worse than trying again. A queue built for megabytes is also
    /// the wrong shape for something that can be most of a gigabyte.
    private func upload(video url: URL) async {
        error = nil
        uploadingVideo = true
        defer { uploadingVideo = false }

        let asset = AVURLAsset(url: url)
        var durationSeconds: Int?
        if let loaded = try? await asset.load(.duration), loaded.seconds.isFinite, loaded.seconds > 0 {
            durationSeconds = Int(loaded.seconds.rounded())
        }

        var thumbnailPath: String?
        if let poster = await Self.posterFrame(for: asset), let jpeg = poster.jpegData(compressionQuality: 0.7) {
            thumbnailPath = try? await API.shared.uploadVideoThumbnail(
                projectId: projectId, roomScanId: roomScanId, affectedAreaId: affectedAreaId,
                jpeg: jpeg)
        }

        guard let data = try? Data(contentsOf: url) else {
            error = "Could not read that recording."
            SiteCameraController.discardTemporaryRecording(at: url)
            return
        }

        do {
            _ = try await API.shared.uploadVideo(
                projectId: projectId, roomScanId: roomScanId, affectedAreaId: affectedAreaId,
                wallIndex: wallIndex, data: data, filename: "video-\(UUID().uuidString).mov",
                contentType: "video/quicktime", durationSeconds: durationSeconds,
                thumbnailPath: thumbnailPath)
            await load()
        } catch {
            self.error = "That video did not upload: \(error.localizedDescription)"
        }
        SiteCameraController.discardTemporaryRecording(at: url)
    }

    /// The frame at time zero, for the grid tile and the report's poster.
    /// `AVAssetImageGenerator.image(at:)` (iOS 16+) rather than the older
    /// callback form — one awaited call, no continuation to get wrong.
    private static func posterFrame(for asset: AVURLAsset) async -> UIImage? {
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        guard let result = try? await generator.image(at: .zero) else { return nil }
        return UIImage(cgImage: result.image)
    }
}

/// A video, full screen — the reference's own note on this (§2e): "the video
/// viewer is the photo viewer with one difference: no `Edit`." Built as its
/// own screen rather than a mode of `PhotoViewer`, which loads bytes into a
/// `UIImage` and has nowhere for that difference to live; `AVPlayer` streams
/// straight from the signed URL, so there is no full-file download to wait
/// on the way `PhotoViewer` needs before it can show anything.
struct VideoPlayerView: View {
    let photo: RoomPhoto

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                if let url = photo.url.flatMap(URL.init) {
                    VideoPlayer(player: AVPlayer(url: url))
                } else {
                    Text("This video is not available right now.")
                        .foregroundStyle(.white)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

/// The system camera, full screen.
struct CameraCapture: UIViewControllerRepresentable {
    let onCapture: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        // The simulator has no camera, and presenting a camera picker there
        // crashes rather than failing politely.
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            picker.sourceType = .camera
        }
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onCapture: onCapture) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onCapture: (UIImage?) -> Void

        init(onCapture: @escaping (UIImage?) -> Void) {
            self.onCapture = onCapture
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            onCapture(info[.originalImage] as? UIImage)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onCapture(nil)
        }
    }
}

extension UIImage {
    /// Scale down so the longest edge is at most `maxEdge`, preserving
    /// orientation. Never scales up.
    func resized(maxEdge: CGFloat) -> UIImage {
        let longest = max(size.width, size.height)
        guard longest > maxEdge else { return self }
        let ratio = maxEdge / longest
        let target = CGSize(width: size.width * ratio, height: size.height * ratio)
        return UIGraphicsImageRenderer(size: target).image { _ in
            draw(in: CGRect(origin: .zero, size: target))
        }
    }
}

/// Choose what kind of room this is.
///
/// Not cosmetic: the type decides how much of the room counts as living
/// area, and whether it counts above or below grade. A basement labelled
/// "bedroom" inflates the figure a carrier is quoting against, which is the
/// kind of error that gets found late and expensively.
struct RoomTypePicker: View {
    let types: [LivingRoomType]
    let selected: String?
    let onPick: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(types) { type in
                    Button {
                        onPick(type.id)
                    } label: {
                        HStack(alignment: .top, spacing: Brand.Space.small) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(type.label)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(Brand.ink)

                                HStack(spacing: 5) {
                                    // What it will do to the number, stated
                                    // before the choice rather than after.
                                    Text("\(Int(type.percent))% living area")
                                    if type.band == "below" {
                                        Text("· below grade")
                                    } else if type.band == "excluded" {
                                        Text("· never counts")
                                    }
                                }
                                .font(.system(size: 12))
                                .foregroundStyle(type.band == "above" ? Brand.greenDark : .orange)

                                if let note = type.note {
                                    Text(note)
                                        .font(.system(size: 11))
                                        .foregroundStyle(Brand.inkSoft)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            Spacer()
                            if selected == type.id {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(Brand.blue)
                            }
                        }
                        .padding(.vertical, 3)
                    }
                    .buttonStyle(.plain)
                }
            }
            .navigationTitle("Room type")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
            .overlay {
                if types.isEmpty { ProgressView() }
            }
        }
    }
}

/// The other half of `Photos & Notes`.
///
/// **This tab was called `Photos & Notes` and had no notes in it.** The
/// column has been on the server all along and the report has always printed
/// it under the room; what was missing was any way to write it from the one
/// device that is actually standing in the room. So a note about a room got
/// typed at a desk hours later, from memory, or not at all.
///
/// The reference's own box, from his screenshot: a `Notes` heading and a
/// grey field reading `Add note…`. Ours adds `Tidy up`, which the affected
/// area's notes already have and for the same reason he asked for it: *"I'm
/// just saying whatever I can with my language, and it doesn't sound
/// professional."*
struct RoomNotesSection: View {
    let roomId: String
    /// What the room arrived carrying. Read once — after that this view owns
    /// the text, and a reload that overwrote a half-typed sentence would be
    /// the worst bug this screen could have.
    let initial: String?

    @State private var notes = ""
    @State private var loaded = false
    @State private var saving = false
    @State private var error: String?
    @State private var suggestion: String?
    @State private var polishing = false
    /// The last text the server accepted, so an unchanged box never PATCHes.
    @State private var onServer = ""
    @State private var saveTask: Task<Void, Never>?
    @FocusState private var writing: Bool

    var body: some View {
        Section {
            ZStack(alignment: .topLeading) {
                if notes.isEmpty {
                    Text("Add note…")
                        .font(.system(size: 15))
                        .foregroundStyle(Brand.inkFaint)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 8)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $notes)
                    .font(.system(size: 15))
                    .foregroundStyle(Brand.ink)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 96)
                    .focused($writing)
            }
            .padding(Brand.Space.tight)
            .background(Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.card))
            .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 8, trailing: 12))

            if !notes.trimmed.isEmpty {
                HStack(spacing: Brand.Space.base) {
                    // It SUGGESTS. The rewrite appears below his own words
                    // with a button to take it — it never replaces what he
                    // typed, because what he typed is what he saw.
                    Button {
                        polishing = true
                        error = nil
                        Task {
                            do {
                                suggestion = try await API.shared.polish(note: notes.trimmed)
                            } catch {
                                self.error = error.localizedDescription
                            }
                            polishing = false
                        }
                    } label: {
                        Label(
                            polishing ? "Tidying…" : "Tidy up",
                            systemImage: "wand.and.sparkles")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Brand.blue)
                    }
                    .buttonStyle(.plain)
                    .disabled(polishing)

                    Spacer()
                    if saving { ProgressView().controlSize(.small) }
                }
            }

            if let suggestion {
                VStack(alignment: .leading, spacing: Brand.Space.tight) {
                    Text(suggestion)
                        .font(.system(size: 14))
                        .foregroundStyle(Brand.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack {
                        Button("Use this") {
                            notes = suggestion
                            self.suggestion = nil
                            // The debounce below would catch this anyway;
                            // taking a suggestion is deliberate enough to
                            // write straight away.
                            Task { await save() }
                        }
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Brand.blue)
                        Spacer()
                        Button("Keep mine") { self.suggestion = nil }
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Brand.inkSoft)
                    }
                }
                .padding(Brand.Space.small)
                .background(Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.tile))
            }

            if let error {
                Text(error).font(.footnote).foregroundStyle(.red)
            }
        } header: {
            Text("Notes")
        }
        .onAppear {
            guard !loaded else { return }
            // A draft written earlier in this session beats the room the
            // panel was handed: the inspector is rebuilt from a room list
            // fetched when the storey opened, so after one edit that list is
            // already out of date and would show an empty box over the
            // operator's own sentence.
            notes = RoomNoteDrafts.shared.note(for: roomId) ?? initial ?? ""
            onServer = notes
            loaded = true
        }
        // **Saved on a pause in typing, not on losing focus.**
        //
        // Focus was the first attempt and it silently lost a note in
        // testing: the keyboard went away, the text stayed on screen, and
        // nothing was written — a tap that dismisses a keyboard does not
        // always travel back through `@FocusState`. A note that looks saved
        // and is not is the worst possible failure for this box, so the
        // trigger is now the text itself. A second of quiet, then a PATCH.
        .onChange(of: notes) { _, _ in
            guard loaded else { return }
            saveTask?.cancel()
            saveTask = Task {
                try? await Task.sleep(for: .milliseconds(900))
                guard !Task.isCancelled else { return }
                await save()
            }
        }
        // And again on the way out, in case the last keystroke was recent.
        .onDisappear {
            saveTask?.cancel()
            let text = notes
            guard loaded, text != onServer else { return }
            RoomNoteDrafts.shared.remember(text, for: roomId)
            Task { try? await API.shared.setRoomNotes(roomId: roomId, notes: text) }
        }
    }

    private func save() async {
        let text = notes
        guard text != onServer else { return }
        saving = true
        error = nil
        do {
            try await API.shared.setRoomNotes(roomId: roomId, notes: text)
            onServer = text
            RoomNoteDrafts.shared.remember(text, for: roomId)
        } catch {
            self.error = "That note did not save: \(error.localizedDescription)"
        }
        saving = false
    }
}

/// What this phone has written about a room since it launched.
///
/// The same idea as `PhotoQueue`, one field wide: the inspector is rebuilt
/// from a room list that was fetched when the storey opened, so the moment a
/// note is saved that list is stale. Without this the operator writes a
/// sentence, closes the panel, opens it again and sees an empty box — and
/// the reasonable conclusion from that is that the app lost their note.
@MainActor
final class RoomNoteDrafts {
    static let shared = RoomNoteDrafts()
    private var byRoom: [String: String] = [:]

    func note(for roomId: String) -> String? { byRoom[roomId] }
    func remember(_ text: String, for roomId: String) { byRoom[roomId] = text }
}
