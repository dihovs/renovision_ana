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
    /// Extended from the reference's Add Floor list, walked on the device.
    /// "1st Floor" is deliberately absent: the reference means one storey
    /// ABOVE ground by it, this codebase and its stored rows call that "2nd",
    /// and holding both spellings would split every total that groups by
    /// level. See the note on FLOOR_LEVELS in src/lib/crm/floors.ts.
    ///
    /// Indexes are spaced by tens so a half-storey has somewhere to sit
    /// without renumbering the building.
    static let levels: [Level] = [
        Level(id: "Land survey", label: "Land survey", index: -1000),
        Level(id: "Basement 3", label: "Basement • Level 3", index: -30),
        Level(id: "Basement 2", label: "Basement • Level 2", index: -20),
        Level(id: "Basement", label: "Basement", index: -10),
        Level(id: "Semi-Basement", label: "Semi-Basement", index: -5),
        Level(id: "Ground", label: "Ground", index: 0),
        Level(id: "Higher Ground", label: "Higher Ground Floor", index: 5),
        Level(id: "2nd", label: "2nd", index: 10),
        Level(id: "3rd", label: "3rd", index: 20),
        Level(id: "4th", label: "4th", index: 30),
        Level(id: "5th", label: "5th", index: 40),
        Level(id: "6th", label: "6th", index: 50),
        Level(id: "Attic", label: "Attic", index: 1000),
    ]

    static var ids: [String] { levels.map(\.id) }
}
