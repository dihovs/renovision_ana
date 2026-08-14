import PhotosUI
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

    @State private var photos: [RoomPhoto]?
    @State private var takingPhoto = false
    @State private var pickedItem: PhotosPickerItem?
    @State private var uploading = false
    @State private var error: String?

    var body: some View {
        Section {
            if let photos, !photos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Brand.Space.tight) {
                        ForEach(photos) { photo in
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
                    }
                }
                .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
            }

            HStack(spacing: Brand.Space.base) {
                Button {
                    takingPhoto = true
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
                Text("Photos")
                Spacer()
                if let photos, !photos.isEmpty {
                    Text("\(photos.count)").font(.caption.monospacedDigit())
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
        .fullScreenCover(isPresented: $takingPhoto) {
            CameraCapture { image in
                takingPhoto = false
                if let image { Task { await upload(image) } }
            }
            .ignoresSafeArea()
        }
    }

    private func load() async {
        photos = (try? await API.shared.photos(roomScanId: roomScanId)) ?? []
    }

    private func upload(_ image: UIImage) async {
        uploading = true
        error = nil

        // Longest edge capped at 2048 and recompressed. A 48-megapixel HEIC
        // is wasted on a report photo printed at a third of a page, and it is
        // minutes of upload on a job-site connection.
        let jpeg = image.resized(maxEdge: 2048).jpegData(compressionQuality: 0.8)

        guard let jpeg else {
            error = "Could not read that photo."
            uploading = false
            return
        }

        do {
            _ = try await API.shared.uploadPhoto(
                projectId: projectId, roomScanId: roomScanId, affectedAreaId: nil,
                jpeg: jpeg, note: nil)
            await load()
        } catch {
            self.error = error.localizedDescription
        }
        uploading = false
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
