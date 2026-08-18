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
        Level(id: "Ground", label: "Ground Floor", index: 0),
        Level(id: "Higher Ground", label: "Higher Ground Floor", index: 5),
        Level(id: "2nd", label: "2nd Floor", index: 10),
        Level(id: "3rd", label: "3rd Floor", index: 20),
        Level(id: "4th", label: "4th Floor", index: 30),
        Level(id: "5th", label: "5th Floor", index: 40),
        Level(id: "6th", label: "6th Floor", index: 50),
        Level(id: "7th", label: "7th Floor", index: 60),
        Level(id: "8th", label: "8th Floor", index: 70),
        Level(id: "9th", label: "9th Floor", index: 80),
        Level(id: "10th", label: "10th Floor", index: 90),
        Level(id: "11th", label: "11th Floor", index: 100),
        Level(id: "12th", label: "12th Floor", index: 110),
        Level(id: "13th", label: "13th Floor", index: 120),
        Level(id: "14th", label: "14th Floor", index: 130),
        Level(id: "15th", label: "15th Floor", index: 140),
        Level(id: "16th", label: "16th Floor", index: 150),
        Level(id: "17th", label: "17th Floor", index: 160),
        Level(id: "18th", label: "18th Floor", index: 170),
        Level(id: "19th", label: "19th Floor", index: 180),
        Level(id: "20th", label: "20th Floor", index: 190),
        Level(id: "21st", label: "21st Floor", index: 200),
        Level(id: "22nd", label: "22nd Floor", index: 210),
        Level(id: "23rd", label: "23rd Floor", index: 220),
        Level(id: "24th", label: "24th Floor", index: 230),
        Level(id: "25th", label: "25th Floor", index: 240),
        Level(id: "26th", label: "26th Floor", index: 250),
        Level(id: "27th", label: "27th Floor", index: 260),
        Level(id: "28th", label: "28th Floor", index: 270),
        Level(id: "29th", label: "29th Floor", index: 280),
        Level(id: "30th", label: "30th Floor", index: 290),
        Level(id: "31st", label: "31st Floor", index: 300),
        Level(id: "32nd", label: "32nd Floor", index: 310),
        Level(id: "33rd", label: "33rd Floor", index: 320),
        Level(id: "34th", label: "34th Floor", index: 330),
        Level(id: "35th", label: "35th Floor", index: 340),
        Level(id: "36th", label: "36th Floor", index: 350),
        Level(id: "37th", label: "37th Floor", index: 360),
        Level(id: "38th", label: "38th Floor", index: 370),
        Level(id: "39th", label: "39th Floor", index: 380),
        Level(id: "40th", label: "40th Floor", index: 390),
        Level(id: "41st", label: "41st Floor", index: 400),
        Level(id: "42nd", label: "42nd Floor", index: 410),
        Level(id: "43rd", label: "43rd Floor", index: 420),
        Level(id: "44th", label: "44th Floor", index: 430),
        Level(id: "45th", label: "45th Floor", index: 440),
        Level(id: "46th", label: "46th Floor", index: 450),
        Level(id: "47th", label: "47th Floor", index: 460),
        Level(id: "48th", label: "48th Floor", index: 470),
        Level(id: "49th", label: "49th Floor", index: 480),
        Level(id: "50th", label: "50th Floor", index: 490),
        Level(id: "Attic", label: "Attic", index: 1000),
        Level(id: "Roof", label: "Roof", index: 1100),
    ]

    static var ids: [String] { levels.map(\.id) }
}
