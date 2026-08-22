import Foundation

/// **What a thing is called by the person holding the phone.**
///
/// The owner, 22 Aug 2026, after scanning his own condo: *"I have a TV, and it
/// detected as a TV. It's very good. But when I'm searching for a TV, I really
/// have to search television. Someone might never search television. They might
/// search as TV, and it's not gonna bring."*
///
/// He is right, and the failure is worse than it looks. `Television` does not
/// contain the letters `tv` in any order a substring match can find, so the
/// search does not rank it low — it returns **nothing at all**, and an empty
/// result reads as *we do not have one*. The operator's next move is to give up
/// and leave the television off the claim, which is a line item lost to
/// vocabulary.
///
/// ## Why query expansion rather than keywords on each entry
///
/// The obvious fix is a `keywords` array on `ObjectCatalog.Entry`. That means
/// authoring synonyms for 304 entries, and every entry added later starts
/// unsearchable until somebody remembers. Expansion inverts it: the table is
/// keyed by the WORD, so `tv ↔ television` is written once and works for every
/// present and future entry whose name contains "television" — the catalogue
/// entry, the RoomPlan suggestion, a wall-mount bracket added next year.
///
/// The groups are **equivalence classes, not aliases**: every term in a group
/// matches every other. So `fridge`, `refrigerator` and `frigo` are one fact
/// written once, not three redirects needing a canonical winner.
///
/// ## The French terms are deliberate, and are NOT the app changing language
///
/// The interface stays English — the owner's explicit instruction, and nothing
/// here touches a label. This is the INPUT side: a Québec restoration tech
/// standing in a flooded basement may well type `laveuse` or `fournaise`
/// because that is the word in their head. Search is the one place where
/// meeting them there costs nothing and refusing costs a line item. If he wants
/// them gone they lift out as data with no code change.
enum ObjectSearch {

    /// Terms that mean the same thing to the person typing them.
    ///
    /// Rules for adding to this table:
    /// - Write the SHORT form people actually type, not only the correct noun.
    /// - Keep every term lowercase and free of punctuation; the matcher
    ///   lowercases the query but does not strip anything else.
    /// - A term may appear in more than one group. `sink` and `basin` overlap
    ///   with `vanity`; both expansions are wanted, and the matcher unions
    ///   every group a term appears in rather than picking one.
    /// - Do NOT add a term that would drag in a wrong line item. `stove` and
    ///   `range` are the same appliance and belong together; `oven` and
    ///   `microwave` are not, and pricing a built-in wall oven as a microwave
    ///   is a real error with a real number on it.
    static let groups: [[String]] = [
        // Appliances — where the short forms are most entrenched.
        ["tv", "television", "telly", "flatscreen", "flat screen"],
        ["fridge", "refrigerator", "frigo", "icebox"],
        ["stove", "range", "cooktop", "cuisiniere", "cuisinière", "poele", "poêle"],
        ["dishwasher", "lave-vaisselle", "lave vaisselle", "laveuse a vaisselle"],
        ["washer", "washing machine", "laveuse"],
        ["dryer", "secheuse", "sécheuse"],
        ["microwave", "micro-ondes", "micro ondes"],
        ["freezer", "congelateur", "congélateur"],

        // Plumbing.
        ["toilet", "wc", "water closet", "commode", "toilette"],
        ["sink", "basin", "lavabo", "evier", "évier"],
        ["bathtub", "tub", "baignoire"],
        ["shower", "douche"],
        ["water heater", "hot water tank", "boiler", "chauffe-eau", "chauffe eau"],
        ["sump pump", "sump", "pompe"],

        // HVAC and mechanical — the room this trade lives in.
        ["furnace", "fournaise"],
        ["ac", "a/c", "air conditioner", "air conditioning", "climatiseur"],
        ["heat pump", "thermopump", "thermopompe"],
        ["dehumidifier", "deshumidificateur", "déshumidificateur"],
        ["air exchanger", "hrv", "vrc", "echangeur d'air", "echangeur"],
        ["water softener", "adoucisseur"],

        // Structure and openings.
        ["stairs", "staircase", "stairway", "escalier"],
        ["fireplace", "foyer"],
        ["door", "porte"],
        ["window", "fenetre", "fenêtre"],
        ["closet", "wardrobe", "garde-robe", "garde robe", "placard"],

        // Restoration equipment — his own kit, and the words it is ordered by.
        ["dehu", "dehumidifier"],
        ["air mover", "blower", "fan", "ventilateur"],
        ["hepa", "air scrubber", "scrubber"],

        // Furniture.
        ["sofa", "couch", "chesterfield", "divan", "canape", "canapé"],
        ["bed", "lit"],
        ["table", "desk", "bureau"],
        ["chair", "chaise"],
        ["cabinet", "cupboard", "armoire"],
        ["counter", "countertop", "comptoir"],
    ]

    /// Every term that means the same as this one, including itself.
    ///
    /// Unions across groups, so a term appearing in two groups expands to
    /// both. Built once — the table is a constant and this is called on every
    /// keystroke of a search field.
    private static let expansions: [String: Set<String>] = {
        var map: [String: Set<String>] = [:]
        for group in groups {
            for term in group {
                map[term, default: [term]].formUnion(group)
            }
        }
        return map
    }()

    /// The set of needles a typed query should actually be matched against.
    ///
    /// Always contains the query itself, so a term with no synonyms behaves
    /// exactly as it did before this file existed — this can only ever ADD
    /// results, never remove one.
    ///
    /// Expansion is on the WHOLE trimmed query, not word by word. "tv stand"
    /// is its own phrase and expanding the `tv` inside it to `television
    /// stand` would be guessing at a compound this table knows nothing about;
    /// the raw query still matches "TV stand" by substring if such an entry
    /// exists.
    static func needles(for query: String) -> [String] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return [] }
        guard let synonyms = expansions[needle] else { return [needle] }
        // Sorted so the order is stable between launches — an unordered Set
        // would let identical searches return differently-ordered results.
        return synonyms.sorted()
    }

    /// Does any expansion of `query` appear in any of `fields`?
    ///
    /// `fields` are the entry's own searchable strings — its name, its
    /// category, its slug. The slug is included because it carries words the
    /// display name drops: `water_heater_tankless` is findable by "tankless"
    /// even though the name reads "Water heater".
    static func matches(query: String, fields: [String]) -> Bool {
        let needles = needles(for: query)
        guard !needles.isEmpty else { return false }
        let haystack = fields.map { $0.lowercased().replacingOccurrences(of: "_", with: " ") }
        return needles.contains { needle in
            haystack.contains { $0.contains(needle) }
        }
    }
}
