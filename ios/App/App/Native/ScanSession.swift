import ARKit
import CoreGraphics
import Foundation
import RoomPlan

/// One visit's worth of scanning: every room captured while the flow was
/// open, and the AR session that ties them together.
///
/// RoomPlan measures each room from wherever the operator was standing when
/// capture began. Two rooms scanned in SEPARATE AR sessions carry no
/// information about where they sit relative to each other — which is why
/// the floor canvas has always shelf-packed them under a disclaimer. Keeping
/// ONE `ARSession` alive across every room of a visit changes that: the
/// second room is measured in the same world frame as the first, and
/// `StructureBuilder` can register the set into a single structure whose
/// rooms sit where they sit in the building. Without the shared session the
/// builder has nothing to register against and throws
/// `.invalidRoomLocation` — the shared session is the load-bearing part,
/// not an optimisation.
///
/// This is the native wiring of what `RoomScanPlugin.mergeScans` does for
/// the web scanner: the same `StructureBuilder`, the same
/// `.beautifyObjects`, called directly in Swift rather than over the
/// Capacitor bridge. The difference is what happens to the answer — the
/// merged structure is reduced to one `plan_x`/`plan_y` per room, the same
/// columns the operator's own drags write, so both floor canvases place the
/// rooms truly with no new rendering path to maintain.
@MainActor
final class ScanSession: ObservableObject {

    /// A room captured this visit, and the server id it was filed under.
    /// `scanId` stays nil for a scan held offline — a held room can still be
    /// merged (the builder runs on the phone) but its position has nowhere
    /// to be written until it has a row.
    private struct Entry {
        let captured: CapturedRoom
        var scanId: String?
    }

    /// The one world frame every room of this visit is measured in. Created
    /// with the session and reused by every `RoomCaptureView` the flow
    /// presents; `RoomScanViewController` stops each capture with
    /// `pauseARSession: false` so tracking survives the walk to the next
    /// room.
    let arSession = ARSession()

    private var entries: [Entry] = []

    /// How many rooms this visit has captured — the flow uses it to decide
    /// whether "place them together" is even a sentence worth saying.
    var roomCount: Int { entries.count }

    /// A room the capture screen just returned, not yet saved.
    func add(_ room: CapturedRoom) {
        entries.append(Entry(captured: room, scanId: nil))
    }

    /// The review's "Scan again" is a retake, not another room: the rejected
    /// capture must leave the merge set, or the builder would register a
    /// room the operator threw away.
    func discardLastUnsaved() {
        if let last = entries.last, last.scanId == nil {
            entries.removeLast()
        }
    }

    /// The row id the last-captured room was filed under, once saving
    /// succeeds. Positions are written by PATCHing rows, so a room with no
    /// id keeps its measurement and loses only its placement.
    func markLastSaved(_ id: String) {
        guard !entries.isEmpty else { return }
        entries[entries.count - 1].scanId = id
    }

    /// Changing floors mid-visit starts a new merge set. Rooms on different
    /// storeys share the AR world frame but not a floor plan — registering a
    /// basement against a kitchen would write positions that mean nothing on
    /// either sheet.
    func resetRooms() {
        entries = []
    }

    /// The whole flow is closing. The AR session would otherwise keep the
    /// camera and tracking alive indefinitely — it is deliberately NOT
    /// paused between rooms, so the deliberate exits call this.
    func end() {
        arSession.pause()
    }

    deinit {
        // The flow can also die without a deliberate exit — a swipe-down, a
        // parent screen going away. `onDisappear` cannot be used for this:
        // presenting the capture cover fires it too, which would pause
        // tracking at the exact moment scanning starts.
        arSession.pause()
    }

    // MARK: - Placement

    enum PlacementOutcome {
        /// Positions written for this many rooms.
        case placed(Int)
        /// Nothing to do — fewer than two rooms, or none of them has a row.
        case skipped
        /// The builder could not register the rooms, or the writes failed.
        /// The rooms themselves are safe; only their arrangement is lost.
        case failed(String)
    }

    /// Register every room of this visit against the others and write each
    /// one's position on the floor sheet.
    ///
    /// Runs after every save from the second room on, not once at the end:
    /// the operator can leave the flow any way they like — Done, Cancel, the
    /// home indicator — and the positions already written stay written.
    /// Re-running is harmless; the builder is deterministic for a fixed set
    /// of rooms and the last write wins.
    func pushPlacements() async -> PlacementOutcome {
        let captured = entries.map(\.captured)
        guard captured.count >= 2, entries.contains(where: { $0.scanId != nil }) else {
            return .skipped
        }

        let structure: CapturedStructure
        do {
            // `.beautifyObjects` squares up walls a scan left a degree or
            // two off — the same option the plugin's mergeScans uses, kept
            // identical so the two paths cannot drift apart in behaviour.
            let builder = StructureBuilder(options: [.beautifyObjects])
            structure = try await builder.capturedStructure(from: captured)
        } catch {
            // `.invalidRoomLocation` lands here when tracking was lost
            // between rooms. Honest failure: the rooms stay packed, exactly
            // as if they had been scanned on separate visits.
            return .failed("The phone could not work out how these rooms sit together, so they will appear side by side until placed by hand.")
        }

        let corners = pageCorners(of: structure)

        var written = 0
        var failures = 0
        for entry in entries {
            guard let id = entry.scanId,
                  let corner = corners[entry.captured.identifier] else { continue }
            do {
                try await API.shared.placeRoom(roomId: id, x: corner.x, y: corner.y)
                written += 1
            } catch {
                failures += 1
            }
        }

        if written == 0 {
            return .failed("The rooms were filed, but their positions could not be written — they will appear side by side until placed by hand.")
        }
        // Partial writes degrade to the packed fallback for the missing
        // rooms; the canvas handles a mixed sheet already.
        return failures > 0
            ? .failed("Some room positions could not be written — those rooms will appear side by side until placed by hand.")
            : .placed(written)
    }

    /// Each registered room's top-left corner on the floor sheet, keyed by
    /// the room's capture identifier, in metres of plan space.
    ///
    /// Both floor canvases draw a room by normalising it to its own origin
    /// (`FloorPlanGeometry.plan` shifts the min corner to 0,0 after folding
    /// the room square to the page), then translating to `plan_x`/`plan_y`.
    /// So the position that makes the composite true is: rotate the WHOLE
    /// registered structure square to the page with the same quarter-turn
    /// fold, and take each room's min corner in that shared frame, re-based
    /// so the structure's own min corner is the sheet origin.
    ///
    /// Two honest approximations live here. The stored geometry of each
    /// room is its raw capture, not the builder's beautified copy — the
    /// record of what the sensor said is deliberately never rewritten — so
    /// a pose correction the builder applied can offset a drawn shape from
    /// its slot by centimetres. And each room's own drawing folds by its own
    /// longest wall where this fold uses the structure's; the two agree
    /// whenever the rooms share one orthogonal grid, which `.beautifyObjects`
    /// enforces for anything but a genuinely diagonal room.
    private func pageCorners(of structure: CapturedStructure) -> [UUID: CGPoint] {
        // A wall's endpoints are its centre ± half its length along its own
        // axis — the same span maths as FloorPlanGeometry, in the same
        // x/z plane (y is up in RoomPlan's world).
        func segments(of room: CapturedRoom) -> [FloorPlanGeometry.Segment] {
            room.walls.map { wall in
                let centre = wall.transform.columns.3
                let axis = wall.transform.columns.0
                let half = Double(wall.dimensions.x) / 2
                return FloorPlanGeometry.Segment(
                    x1: Double(centre.x) - Double(axis.x) * half,
                    y1: Double(centre.z) - Double(axis.z) * half,
                    x2: Double(centre.x) + Double(axis.x) * half,
                    y2: Double(centre.z) + Double(axis.z) * half)
            }
        }

        let perRoom = structure.rooms.map { (id: $0.identifier, segments: segments(of: $0)) }
        let allSegments = perRoom.flatMap(\.segments)
        guard let longest = allSegments.max(by: { $0.length < $1.length }) else { return [:] }

        // The same fold FloorPlanGeometry.squareToPage applies: the longest
        // wall flat along the page, by the nearest quarter turn.
        var angle = atan2(longest.y2 - longest.y1, longest.x2 - longest.x1)
        while angle > .pi / 4 { angle -= .pi / 2 }
        while angle < -.pi / 4 { angle += .pi / 2 }
        let c = cos(-angle)
        let s = sin(-angle)

        var corners: [UUID: CGPoint] = [:]
        var sheetMinX = Double.infinity
        var sheetMinY = Double.infinity
        for room in perRoom where !room.segments.isEmpty {
            var minX = Double.infinity
            var minY = Double.infinity
            for segment in room.segments {
                for (x, y) in [(segment.x1, segment.y1), (segment.x2, segment.y2)] {
                    minX = min(minX, x * c - y * s)
                    minY = min(minY, x * s + y * c)
                }
            }
            corners[room.id] = CGPoint(x: minX, y: minY)
            sheetMinX = min(sheetMinX, minX)
            sheetMinY = min(sheetMinY, minY)
        }

        // Re-based so the structure's own corner is the origin: positions
        // stay small and positive, and the canvases re-base against the
        // whole sheet anyway.
        return corners.mapValues { CGPoint(x: $0.x - sheetMinX, y: $0.y - sheetMinY) }
    }
}
