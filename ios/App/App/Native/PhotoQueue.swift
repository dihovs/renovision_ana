import Foundation
import Network
import UIKit

/// Photographs the phone is holding because there was no signal when they
/// were taken.
///
/// **The owner's ask, and it is the same argument `ScanQueue` was built on:**
/// *"when they're in a place when there is no Internet, I want them to be
/// able to upload the photos so it can go and stick to the floor plan. And
/// whenever they have an Internet, it will upload."*
///
/// A restoration photograph is evidence of a condition that will not exist
/// tomorrow — the water is being extracted, the drywall is coming out. A
/// photo lost to a failed POST in a basement cannot be retaken next week,
/// and the operator will not know it was lost until an adjuster asks for it.
/// So an upload that fails for want of a network is not an error: it is a
/// file on disk and a promise to send it.
///
/// **It also fixes the waiting.** Even with signal, a 2 MB upload on a job
/// site takes seconds the operator does not have while holding a phone in a
/// wet room. Every photo now lands on disk first and uploads behind them —
/// the shutter is never blocked on the network.
///
/// The three rules `ScanQueue` established, kept:
///
/// - **A network failure is HELD; a refusal is REPORTED.** Retrying a
///   request the server understood and rejected hides a real bug behind a
///   queue that only grows.
/// - **On disk, not in `UserDefaults`.** A JPEG is megabytes.
/// - **Sent on reconnect, without anyone remembering to press anything.**
@MainActor
final class PhotoQueue: ObservableObject {
    static let shared = PhotoQueue()

    /// What is waiting, oldest first — so a room's photos arrive in the order
    /// they were taken, which is the order their captions will number them.
    @Published private(set) var pending: [Held] = []
    @Published private(set) var lastError: String?

    /// One photograph waiting its turn. The image lives beside this file
    /// rather than inside it: a base64 JPEG in JSON is a third bigger and
    /// has to be decoded to be shown.
    struct Held: Identifiable, Codable, Equatable {
        let id: UUID
        let projectId: String
        let roomScanId: String?
        let affectedAreaId: String?
        let wallIndex: Int?
        let note: String?
        let queuedAt: Date

        var imageName: String { "\(id.uuidString).jpg" }
    }

    private let monitor = NWPathMonitor()
    private var flushing = false

    private var folder: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("PendingPhotos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private init() {
        load()
        monitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied else { return }
            Task { @MainActor in await self?.flush() }
        }
        monitor.start(queue: DispatchQueue(label: "photoqueue.network"))
    }

    // MARK: - Taking one

    /// Hold a photograph and start trying to send it.
    ///
    /// **Always returns immediately.** The operator's next tap is never
    /// waiting on an upload — the file is safe on disk before this returns,
    /// and the send happens behind them.
    func enqueue(
        _ image: UIImage, projectId: String, roomScanId: String?, affectedAreaId: String?,
        wallIndex: Int?, note: String?
    ) -> Bool {
        // Capped and recompressed exactly as the direct upload did: a
        // 48-megapixel HEIC is wasted on a report photo printed at a third
        // of a page, and it is minutes of upload on a job-site connection.
        guard let jpeg = image.resized(maxEdge: 2048).jpegData(compressionQuality: 0.8) else {
            lastError = "Could not read that photo."
            return false
        }

        let held = Held(
            id: UUID(), projectId: projectId, roomScanId: roomScanId,
            affectedAreaId: affectedAreaId, wallIndex: wallIndex, note: note,
            queuedAt: Date())

        do {
            try jpeg.write(to: folder.appendingPathComponent(held.imageName), options: .atomic)
            try JSONEncoder().encode(held).write(
                to: folder.appendingPathComponent("\(held.id.uuidString).json"), options: .atomic)
            pending.append(held)
        } catch {
            lastError = error.localizedDescription
            return false
        }

        Task { await flush() }
        return true
    }

    /// The image a held photo is waiting to send — what a thumbnail draws so
    /// a queued photo looks like a photo rather than a placeholder.
    func image(for held: Held) -> UIImage? {
        UIImage(contentsOfFile: folder.appendingPathComponent(held.imageName).path)
    }

    /// What is waiting for one room, so its own grid can show them.
    func pending(roomScanId: String, wallIndex: Int?, affectedAreaId: String?) -> [Held] {
        pending.filter {
            $0.roomScanId == roomScanId && $0.wallIndex == wallIndex
                && $0.affectedAreaId == affectedAreaId
        }
    }

    // MARK: - Sending

    /// Try to send everything held.
    ///
    /// Stops at the first network failure rather than grinding through the
    /// queue: if one upload could not reach the server neither will the next,
    /// and each attempt costs megabytes on a phone that is probably on
    /// cellular.
    @discardableResult
    func flush() async -> Int {
        guard !flushing, !pending.isEmpty else { return 0 }
        flushing = true
        defer { flushing = false }

        var sent = 0
        while let next = pending.first {
            guard let jpeg = try? Data(contentsOf: folder.appendingPathComponent(next.imageName))
            else {
                // The file is gone from under us. Dropping the record is the
                // only honest thing left — a queue entry with no image will
                // never succeed and would block everything behind it.
                drop(next)
                continue
            }

            do {
                _ = try await API.shared.uploadPhoto(
                    projectId: next.projectId, roomScanId: next.roomScanId,
                    affectedAreaId: next.affectedAreaId, wallIndex: next.wallIndex,
                    jpeg: jpeg, note: next.note)
                drop(next)
                sent += 1
            } catch let error as APIError {
                switch error {
                case .offline:
                    // Still no signal. Everything stays; try again on the
                    // next reconnect.
                    return sent
                case .notSignedIn:
                    lastError = "Sign in to upload the photos this phone is holding."
                    return sent
                case .serverNotReady(let message):
                    lastError = message
                    return sent
                default:
                    // The server understood and refused. Say so, and drop it:
                    // a photo the server will always reject would otherwise
                    // block every photo behind it forever.
                    lastError = error.localizedDescription
                    drop(next)
                }
            } catch {
                if (error as? URLError) != nil { return sent }
                lastError = error.localizedDescription
                drop(next)
            }
        }
        return sent
    }

    // MARK: - Disk

    private func drop(_ held: Held) {
        try? FileManager.default.removeItem(at: folder.appendingPathComponent(held.imageName))
        try? FileManager.default.removeItem(
            at: folder.appendingPathComponent("\(held.id.uuidString).json"))
        pending.removeAll { $0.id == held.id }
    }

    private func load() {
        let files =
            (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil))
            ?? []
        pending =
            files
            .filter { $0.pathExtension == "json" }
            .compactMap { url in
                guard let data = try? Data(contentsOf: url) else { return nil }
                return try? JSONDecoder().decode(Held.self, from: data)
            }
            .sorted { $0.queuedAt < $1.queuedAt }
    }
}

extension UIImage {
    /// Burn the moment it was taken into the corner of the photograph.
    ///
    /// **The owner, 20 Aug 2026, on the reference's own scan photos:** *"if
    /// you see on the photos, there is a time stamp… these photos get
    /// uploaded with the time stamp. So this is very important to know."*
    ///
    /// He is right, and the reason is specific to this trade. A restoration
    /// photograph is evidence of a condition that will not exist tomorrow —
    /// the water is being extracted, the drywall is coming out — and its
    /// value to an adjuster depends entirely on *when* it was taken. A date
    /// in a database column proves when a ROW was written. A date drawn into
    /// the pixels travels with the image: into the report, into a PDF, into
    /// an email forwarded three times, onto a printout in a file. It cannot
    /// be separated from the thing it describes, which is the whole point.
    ///
    /// Only for photographs this app TAKES. A picture chosen from the
    /// library was taken at some other time, and stamping it with now would
    /// be a false statement of exactly the kind this exists to prevent.
    func stamped(at moment: Date = Date()) -> UIImage {
        // **Their words and their corner**, read off his screenshot of the
        // reference's own camera: `Aug 20, 2026 • 10:53 PM`, bottom right.
        // This used to print `2026-08-20 22:53` bottom left behind a black
        // plate. Both were defensible and neither was what he is comparing
        // ours against — and on a claim file where the two documents sit
        // side by side, a different date format reads as a different tool.
        let text = SiteCameraController.stampText(moment) as NSString

        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { context in
            draw(at: .zero)

            // Sized off the image rather than fixed: the same photo is read
            // on a phone and printed a third of a page wide, and a 12pt
            // stamp disappears at one of those.
            let fontSize = max(18, size.height * 0.022)
            let font = UIFont.systemFont(ofSize: fontSize, weight: .semibold)

            // A shadow rather than a plate. Theirs is plain white text, and
            // it survives a white ceiling — half these photographs are of
            // ceilings — because the glyphs carry their own dark edge.
            let shadow = NSShadow()
            shadow.shadowColor = UIColor.black.withAlphaComponent(0.75)
            shadow.shadowBlurRadius = fontSize * 0.25
            shadow.shadowOffset = CGSize(width: 0, height: fontSize * 0.06)

            let attributes: [NSAttributedString.Key: Any] = [
                .font: font,
                .foregroundColor: UIColor.white,
                .shadow: shadow,
            ]
            let textSize = text.size(withAttributes: attributes)
            let pad = fontSize * 0.9
            text.draw(
                at: CGPoint(
                    x: size.width - textSize.width - pad,
                    y: size.height - textSize.height - pad),
                withAttributes: attributes)
            _ = context
        }
    }
}
