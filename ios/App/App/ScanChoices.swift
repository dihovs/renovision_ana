import Foundation
import RoomPlan
import SwiftUI
import UIKit

/// What the operator settled DURING a scan, before anything was filed.
///
/// The overlay asks about a detection the moment it appears; this is where
/// the answer waits until the room is saved. Keyed by RoomPlan's own
/// `identifier`, which is stable across every `didUpdate` of one capture —
/// the position of a door in `room.doors` is not, so an index would rebind
/// the answer to a different door the moment the array reordered.
///
/// **Lives for one capture and no longer.** These identifiers mean nothing
/// after the session ends, so nothing here is persisted; an answer that
/// outlived its scan would be an answer about a door that no longer exists.
@available(iOS 17.0, *)
@MainActor
final class ScanChoices: ObservableObject {

    /// What a person said one detection actually is.
    enum Answer: Equatable {
        /// A door or window: a specific kind from the opening catalogue.
        case opening(PlanEditing.OpeningKind)
        /// An object: a catalogue slug.
        case object(String)
        /// Seen and deliberately dismissed — RoomPlan found something that
        /// is not worth recording. Kept rather than forgotten so the badge
        /// stops asking, which is the difference between an overlay that
        /// settles down as you work and one that nags for the whole scan.
        case ignored
    }

    @Published private(set) var answers: [UUID: Answer] = [:]

    /// Which door swings which way, decided on the spot. Separate from
    /// `answers` because it is a second, independent question about the same
    /// detection — the owner asked for both in one breath: choose the type,
    /// and *"it can make an arrow. So going from you or coming to you."*
    @Published private(set) var swings: [UUID: Bool] = [:]

    /// Photographs taken DURING the walk, waiting for the room to exist.
    ///
    /// **His ask, 20 Aug 2026**, pointing at the reference's own shutter
    /// beside its stop button: *"you can see a take a picture button."* And
    /// the briefing screen has been promising this for longer than the
    /// button has existed.
    ///
    /// Held in memory rather than filed immediately, because a photograph is
    /// a row against a ROOM and the room has no id until the capture is
    /// saved. They go to `PhotoQueue` at that moment, which is also what
    /// gets them uploaded from a basement with no signal.
    @Published private(set) var photos: [UIImage] = []

    func addPhoto(_ image: UIImage) { photos.append(image) }

    /// Handed over once the room has a row. Cleared in the same breath: a
    /// second room in the same visit must not inherit the first one's
    /// photographs.
    func takePhotos() -> [UIImage] {
        let taken = photos
        photos = []
        return taken
    }

    func answer(for id: UUID) -> Answer? { answers[id] }

    func set(_ answer: Answer, for id: UUID) { answers[id] = answer }

    func setSwing(inward: Bool, for id: UUID) { swings[id] = inward }

    func swing(for id: UUID) -> Bool? { swings[id] }

    /// Everything settled, ready to be applied when the room is filed.
    var isEmpty: Bool { answers.isEmpty && swings.isEmpty }

    func reset() {
        answers = [:]
        swings = [:]
        photos = []
    }
}
