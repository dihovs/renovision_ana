import Foundation
import RoomPlan
import SwiftUI

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

    func answer(for id: UUID) -> Answer? { answers[id] }

    func set(_ answer: Answer, for id: UUID) { answers[id] = answer }

    func setSwing(inward: Bool, for id: UUID) { swings[id] = inward }

    func swing(for id: UUID) -> Bool? { swings[id] }

    /// Everything settled, ready to be applied when the room is filed.
    var isEmpty: Bool { answers.isEmpty && swings.isEmpty }

    func reset() {
        answers = [:]
        swings = [:]
    }
}
