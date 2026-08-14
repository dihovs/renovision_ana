import Foundation
import Network

/// Scans the phone is holding because there was no signal when they were taken.
///
/// The job is a basement and a basement has no bars. Walking a room with the
/// phone up for two minutes and then losing the measurement to a failed POST
/// is the worst failure this app can have: the room is still wet, the operator
/// is now upstairs, and the only copy of what they measured is gone.
///
/// So a save that fails for want of a network is not an error shown to the
/// operator — it is a scan held on disk and sent when there is signal. A save
/// the SERVER refused is a different thing entirely and is re-thrown, because
/// retrying a request that was understood and rejected hides a real bug behind
/// a queue that only grows.
///
/// On disk rather than in UserDefaults: a room's geometry runs to tens of
/// kilobytes and UserDefaults is the wrong place for anything that size.
@MainActor
final class ScanQueue: ObservableObject {
    static let shared = ScanQueue()

    /// What is waiting, newest last. Published so a banner can say so without
    /// polling.
    @Published private(set) var pending: [Held] = []
    @Published private(set) var lastError: String?

    struct Held: Identifiable, Codable {
        let id: UUID
        let projectId: String
        let name: String
        let level: String
        let queuedAt: Date
        /// The upload, encoded once at the point of failure. Kept as data so
        /// a future change to ScanUpload cannot silently reinterpret a scan
        /// that was taken under the old shape.
        let payload: Data
    }

    private let monitor = NWPathMonitor()
    private var flushing = false

    private var folder: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("PendingScans", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private init() {
        load()

        // Sending on reconnect is the whole point: the operator should never
        // have to remember to come back and press something.
        monitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied else { return }
            Task { @MainActor in await self?.flush() }
        }
        monitor.start(queue: DispatchQueue(label: "scanqueue.network"))
    }

    // MARK: - Saving

    enum Outcome {
        case sent(String)
        /// Held on the phone. Not a failure — the measurement is safe.
        case held
        /// Neither the server nor the phone could take it. The operator is
        /// still in the room and can rescan, so this must be said plainly.
        case lost(String)
    }

    func save(_ upload: ScanUpload) async -> Outcome {
        do {
            let id = try await API.shared.saveScan(upload)
            return .sent(id)
        } catch let error as APIError {
            switch error {
            case .offline:
                return hold(upload) ? .held : .lost("This phone has no room left to hold the scan.")
            case .serverNotReady(let message):
                // The measurement is fine; the DATABASE is missing its table.
                // Losing a walked room over an unrun migration would punish
                // the operator for the server's state — hold it, and the
                // queue sends it the moment the SQL has been run.
                lastError = message
                return hold(upload) ? .held : .lost("This phone has no room left to hold the scan.")
            default:
                return .lost(error.localizedDescription)
            }
        } catch {
            // A URLError that never became an APIError is still a network
            // problem; anything else came back with an answer.
            if (error as? URLError) != nil {
                return hold(upload) ? .held : .lost("This phone has no room left to hold the scan.")
            }
            return .lost(error.localizedDescription)
        }
    }

    private func hold(_ upload: ScanUpload) -> Bool {
        do {
            let payload = try JSONEncoder().encode(upload)
            let held = Held(
                id: UUID(), projectId: upload.projectId, name: upload.name,
                level: upload.level, queuedAt: Date(), payload: payload)
            let url = folder.appendingPathComponent("\(held.id.uuidString).json")
            try JSONEncoder().encode(held).write(to: url, options: .atomic)
            pending.append(held)
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    // MARK: - Sending

    /// Try to send everything held.
    ///
    /// Stops at the first network failure rather than grinding through the
    /// queue: if one request could not reach the server neither will the next,
    /// and each attempt costs an upload of geometry on a phone that is
    /// probably on cellular.
    @discardableResult
    func flush() async -> Int {
        guard !flushing, !pending.isEmpty else { return 0 }
        flushing = true
        defer { flushing = false }

        var sent = 0
        while let next = pending.first {
            do {
                let upload = try JSONDecoder().decode(ScanUpload.self, from: next.payload)
                _ = try await API.shared.saveScan(upload)
                drop(next)
                sent += 1
            } catch let error as APIError {
                if case .offline = error { break }
                // Not ready is not a refusal: the whole queue waits for the
                // migration, nothing gets dropped.
                if case .serverNotReady(let message) = error {
                    lastError = message
                    break
                }
                // The server refused this one on its merits. Drop it rather
                // than letting a single malformed scan block every scan
                // behind it forever — but say so, because a measurement is
                // being discarded.
                lastError = "A held scan was refused: \(error.localizedDescription)"
                drop(next)
            } catch {
                if (error as? URLError) != nil { break }
                lastError = "A held scan was refused: \(error.localizedDescription)"
                drop(next)
            }
        }
        return sent
    }

    func discard(_ held: Held) {
        drop(held)
    }

    private func drop(_ held: Held) {
        try? FileManager.default.removeItem(
            at: folder.appendingPathComponent("\(held.id.uuidString).json"))
        pending.removeAll { $0.id == held.id }
    }

    // MARK: - Disk

    private func load() {
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: folder, includingPropertiesForKeys: nil)
        else { return }

        pending = files
            .filter { $0.pathExtension == "json" }
            .compactMap { url in
                guard let data = try? Data(contentsOf: url) else { return nil }
                return try? JSONDecoder().decode(Held.self, from: data)
            }
            .sorted { $0.queuedAt < $1.queuedAt }
    }

    /// What is held for one project, so a project screen can say so.
    func pending(for projectId: String) -> [Held] {
        pending.filter { $0.projectId == projectId }
    }
}
