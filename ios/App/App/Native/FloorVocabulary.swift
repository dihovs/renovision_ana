import Foundation

/// The storeys a building has, in building order.
///
/// The Swift half of ORD-12's single floor vocabulary. The canonical source
/// is src/lib/crm/floors.ts — the ids here are the EXACT stored strings from
/// that file, in the same signed-index order, and any change must land in
/// both places together. Swift cannot import TypeScript, so this twin exists;
/// what it must never do is drift, which is why it carries the index too
/// rather than leaving order to the array position alone.
enum FloorVocabulary {
    struct Level {
        /// The stored id — written to room_scans.level verbatim, so renaming
        /// one is a data migration, not an edit here.
        let id: String
        let label: String
        /// Signed storeys from the ground: basement -1, ground 0, up from
        /// there. Sorting by this puts a building in elevation order however
        /// the rows come back.
        let index: Int
    }

    /// Mirror of FLOOR_LEVELS in src/lib/crm/floors.ts.
    static let levels: [Level] = [
        Level(id: "Basement", label: "Basement", index: -1),
        Level(id: "Ground", label: "Ground", index: 0),
        Level(id: "2nd", label: "2nd", index: 1),
        Level(id: "3rd", label: "3rd", index: 2),
        Level(id: "Attic", label: "Attic", index: 3),
    ]

    static var ids: [String] { levels.map(\.id) }
}
