import PhotosUI
import AVFoundation
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
    @State private var pickedItem: PhotosPickerItem?
    @State private var uploading = false
    @State private var error: String?
    /// The photo open full-screen, if any — the route to the editor.
    @State private var viewing: RoomPhoto?
    /// Photos this phone is still holding, so the grid shows them the moment
    /// they are taken rather than after the server has them.
    @ObservedObject private var queue = PhotoQueue.shared

    /// What this phone is holding for THIS grid — the room, or the wall, or
    /// the area, matched the same way the server's own filter matches.
    private var waiting: [PhotoQueue.Held] {
        queue.pending(
            roomScanId: roomScanId, wallIndex: wallIndex, affectedAreaId: affectedAreaId)
    }

    var body: some View {
        Section {
            if (photos.map { !$0.isEmpty } ?? false) || !waiting.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Brand.Space.tight) {
                        ForEach(photos ?? []) { photo in
                            // Tappable, which they were not until S6. A
                            // photo that can be uploaded and never looked
                            // at again on the phone that took it is half a
                            // feature — and the reference reaches its
                            // editor from the viewer's `Edit`, so there was
                            // nowhere for blur to live either.
                            Button {
                                viewing = photo
                            } label: {
                                AsyncImage(url: photo.url.flatMap(URL.init)) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image.resizable().scaledToFill()
                                    default:
                                        Brand.surfaceRaised
                                    }
                                }
                                .frame(width: 96, height: 96)
                                .clipShape(.rect(cornerRadius: Brand.Radius.tile))
                            }
                            .buttonStyle(.plain)
                        }

                        // Held on this phone: drawn exactly like the rest,
                        // with a cloud mark. A photo that has been taken IS
                        // in the record as far as the operator is concerned,
                        // and hiding it until the server agrees would make
                        // them take it twice.
                        ForEach(waiting) { held in
                            ZStack(alignment: .bottomTrailing) {
                                if let image = queue.image(for: held) {
                                    Image(uiImage: image)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 96, height: 96)
                                        .clipShape(.rect(cornerRadius: Brand.Radius.tile))
                                } else {
                                    Brand.surfaceRaised
                                        .frame(width: 96, height: 96)
                                        .clipShape(.rect(cornerRadius: Brand.Radius.tile))
                                }
                                Image(systemName: "icloud.and.arrow.up")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .padding(4)
                                    .background(Brand.charcoal.opacity(0.75), in: .capsule)
                                    .padding(5)
                            }
                        }
                    }
                }
                .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
            }

            HStack(spacing: Brand.Space.base) {
                Button {
                    openCamera()
                } label: {
                    Label("Camera", systemImage: "camera.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Brand.blue)
                }
                .buttonStyle(.plain)

                // The library too, because the useful photo is sometimes the
                // one taken an hour ago before the app was open.
                PhotosPicker(selection: $pickedItem, matching: .images) {
                    Label("Library", systemImage: "photo.on.rectangle")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Brand.blue)
                }
                .buttonStyle(.plain)

                if uploading {
                    ProgressView().controlSize(.small)
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
        .fullScreenCover(isPresented: $takingPhoto) {
            CameraCapture { image in
                takingPhoto = false
                if let image { Task { await upload(image) } }
            }
            .ignoresSafeArea()
        }
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
    private func openCamera() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            takingPhoto = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                Task { @MainActor in
                    if granted {
                        takingPhoto = true
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
        // The list may already have it if the send was quick; if not, the
        // pending row below stands in until it lands.
        await load()
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
