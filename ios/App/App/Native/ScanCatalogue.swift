import Foundation
import RoomPlan

/// What RoomPlan saw, said in this app's own vocabulary.
///
/// **The gap this closes.** RoomPlan classifies sixteen kinds of thing and
/// this app has a 77-entry catalogue, and until now nothing joined the two:
/// every fixture on a scanned job was placed again by hand, in an app that
/// had just been told where the refrigerator was. That is the single biggest
/// piece of wasted work left in the scanner.
///
/// **And it is a SUGGESTION, never an answer.** RoomPlan reports a category
/// and a confidence, and the categories are coarse — `.storage` is the
/// catch-all a linen closet, a bookcase and a bifold wardrobe all land in,
/// and `.washerDryer` is one category for two appliances that are priced
/// separately on every claim this trade writes. So each mapping below says
/// what it is confident of and what it is not, and everything the operator
/// has to settle is offered rather than guessed.
///
/// The owner asked for exactly that, 20 Aug 2026: *"when it doesn't
/// recognize, let's say, it's a folding door of the closet… it shows you the
/// question mark. You click on the question mark, and you choose what is
/// it."*
@available(iOS 17.0, *)
enum ScanCatalogue {

    /// What the overlay should say about one detection.
    struct Suggestion {
        /// The catalogue slug to place, or nil when there is no honest
        /// guess and the operator has to say.
        let slug: String?
        /// What to write under the silhouette.
        let label: String
        /// True when RoomPlan found something and could not name it well
        /// enough to act on — drawn as a question mark, which is an
        /// invitation rather than a claim.
        let uncertain: Bool
    }

    /// One detected object, read.
    ///
    /// `confidence` is taken seriously: a low-confidence guess placed
    /// silently is a fixture on an estimate that nobody saw, which is worse
    /// than a question mark.
    static func suggestion(
        for category: CapturedRoom.Object.Category, confidence: CapturedRoom.Confidence
    ) -> Suggestion {
        let (slug, label, coarse) = read(category)
        // Coarse categories and low confidence both end in the same place —
        // asking — but for different reasons, and both are honest.
        let uncertain = coarse || confidence == .low
        return Suggestion(slug: uncertain ? nil : slug, label: label, uncertain: uncertain)
    }

    /// The same question, asked of a category that has been through storage
    /// as a string.
    ///
    /// One reading, not two: the live enum and the stored name have to agree
    /// about what a `.storage` is, and `String(describing:)` is what wrote
    /// the name in the first place.
    static func suggestion(forCategoryName name: String, lowConfidence: Bool) -> Suggestion {
        let (slug, label, coarse) = readName(name)
        let uncertain = coarse || lowConfidence
        return Suggestion(slug: uncertain ? nil : slug, label: label, uncertain: uncertain)
    }

    private static func readName(_ name: String) -> (String?, String, Bool) {
        switch name {
        case "refrigerator": return ("refrigerator", "Refrigerator", false)
        case "dishwasher": return ("dishwasher", "Dishwasher", false)
        case "oven", "stove": return ("range", "Range", false)
        case "toilet": return ("toilet", "Toilet", false)
        case "bathtub": return ("bathtub", "Bathtub", false)
        case "fireplace": return ("fireplace", "Fireplace", false)
        case "stairs": return ("stairs", "Stairs", false)
        case "bed": return ("bed_queen", "Bed", false)
        case "sofa": return ("sofa", "Sofa", false)
        case "television": return ("television", "Television", false)
        case "table": return ("table", "Table", false)
        case "chair": return ("chair", "Chair", false)
        case "sink": return (nil, "Sink", true)
        case "washerDryer": return (nil, "Washer or dryer", true)
        case "storage": return (nil, "Storage", true)
        default: return (nil, "Something", true)
        }
    }

    /// slug, label, and whether the category is too coarse to act on alone.
    private static func read(
        _ category: CapturedRoom.Object.Category
    ) -> (String?, String, Bool) {
        switch category {
        case .refrigerator: return ("refrigerator", "Refrigerator", false)
        case .dishwasher: return ("dishwasher", "Dishwasher", false)
        case .oven, .stove: return ("range", "Range", false)
        case .toilet: return ("toilet", "Toilet", false)
        case .bathtub: return ("bathtub", "Bathtub", false)
        case .fireplace: return ("fireplace", "Fireplace", false)
        case .stairs: return ("stairs", "Stairs", false)
        case .bed: return ("bed_queen", "Bed", false)
        case .sofa: return ("sofa", "Sofa", false)

        // Contents, not fixtures — and named anyway, because RoomPlan is
        // good at them and a question mark about a chair is work handed
        // back to the operator for nothing. They earned catalogue entries
        // on 20 Aug 2026 for exactly this reason.
        case .television: return ("television", "Television", false)
        case .table: return ("table", "Table", false)
        case .chair: return ("chair", "Chair", false)

        // A sink is a kitchen sink, a bathroom vanity or a laundry tub, and
        // they are three different lines on an estimate. RoomPlan cannot
        // tell them apart and neither can this, so it asks.
        case .sink: return (nil, "Sink", true)

        // ONE category, TWO appliances, priced separately on every claim.
        // Placing "washer" for a dryer would be a wrong line item with a
        // real number against it.
        case .washerDryer: return (nil, "Washer or dryer", true)

        // The catch-all. A linen closet, a bookcase, a bifold wardrobe and a
        // kitchen pantry all arrive here — this is the case the owner named
        // when he asked for the question mark.
        case .storage: return (nil, "Storage", true)

        @unknown default: return (nil, "Something", true)
        }
    }

    /// The symbol drawn in the middle of a detection's silhouette.
    ///
    /// A question mark where there is nothing confident to draw — the badge
    /// IS the control, so it has to read as a question being asked rather
    /// than as a label being applied.
    static func glyph(for suggestion: Suggestion) -> String {
        guard let slug = suggestion.slug else { return "questionmark" }
        return ObjectCatalog.entry(slug: slug)?.glyph ?? "square.dashed"
    }

    /// What a detected door or window starts as.
    ///
    /// RoomPlan reports a door-shaped hole and a window-shaped hole and
    /// nothing more — not the leaf count, not the mechanism, not the hinge.
    /// So the kind is inferred from WIDTH, which is the one thing it does
    /// measure, against the stock sizes this market frames to. A guess from
    /// a real measurement, offered for correction.
    static func openingKind(width: Double, isWindow: Bool, isPassage: Bool)
        -> PlanEditing.OpeningKind
    {
        if isPassage { return .doorCased }
        if isWindow {
            if width >= 1.7 { return .windowBay }
            if width >= 1.2 { return .windowWide }
            if width <= 0.7 { return .windowSmall }
            return .windowStandard
        }
        // Doors. A 5-foot hole is a double or a patio slider; a 2-foot one
        // is a closet. The single door is the default because it is what
        // most holes in most houses are.
        if width >= 2.2 { return .doorGarage }
        if width >= 1.4 { return .doorDouble }
        if width <= 0.71 { return .doorSingle }
        return .doorSingle
    }
}


/// Which family a detected object belongs to, and whether the operator wants
/// that family on the plan at all.
///
/// **This is how the reference stops a scan burying a plan in furniture, and
/// it is a better answer than the one we had.** magicplan's `Configure Floor
/// Plan` sheet asks once, before generating: Plumbing Fixtures, Appliances,
/// Furniture — three checkboxes and a `Remember my choices` toggle. Not a
/// question per detection.
///
/// The owner, 20 Aug 2026: *"I can click and adjust it if I see something is
/// wrong, but I don't want to have to adjust everything manually."* An
/// operator who never wants furniture on a water-damage plan turns it off
/// once and is never asked again.
@available(iOS 17.0, *)
enum ScanObjectFamily: String, CaseIterable, Identifiable {
    case plumbing
    case appliances
    case furniture

    var id: String { rawValue }

    var label: String {
        switch self {
        case .plumbing: return "Plumbing Fixtures"
        case .appliances: return "Appliances"
        case .furniture: return "Furniture"
        }
    }

    var examples: String {
        switch self {
        case .plumbing: return "Like Bathtub, Sink, Toilet, etc."
        case .appliances: return "Like Oven, Dishwasher, etc."
        case .furniture: return "Like Sofa, Bed, Table, Chair, etc."
        }
    }

    /// Which family a RoomPlan category falls in. Nil for the ones that are
    /// none of the three — stairs and a fireplace are the BUILDING, not its
    /// contents, and are never filtered out.
    static func of(_ category: String) -> ScanObjectFamily? {
        switch category {
        case "toilet", "bathtub", "sink": return .plumbing
        case "refrigerator", "dishwasher", "oven", "stove", "washerDryer": return .appliances
        case "bed", "sofa", "chair", "table", "television", "storage": return .furniture
        default: return nil
        }
    }
}

/// The three checkboxes, remembered.
///
/// `UserDefaults`, like `ObjectHabits`: a preference about how this operator
/// works, not a fact about a job, and it has to survive the app being killed
/// between two rooms of the same house.
@available(iOS 17.0, *)
@MainActor
final class ScanObjectFilter: ObservableObject {
    static let shared = ScanObjectFilter()

    @Published var included: Set<ScanObjectFamily> {
        didSet { save() }
    }
    /// Off means the sheet asks again next time, which is what an unticked
    /// "Remember my choices" means.
    @Published var remember: Bool {
        didSet { UserDefaults.standard.set(remember, forKey: Self.rememberKey) }
    }

    private static let key = "scan.objectFamilies"
    private static let rememberKey = "scan.objectFamilies.remember"

    private init() {
        let defaults = UserDefaults.standard
        remember = defaults.object(forKey: Self.rememberKey) as? Bool ?? true
        if let stored = defaults.array(forKey: Self.key) as? [String] {
            included = Set(stored.compactMap(ScanObjectFamily.init(rawValue:)))
        } else {
            // All three on to begin with, which is what their sheet ships
            // with — a first scan should show everything it found and let
            // the operator turn off what they do not want.
            included = Set(ScanObjectFamily.allCases)
        }
    }

    func includes(category: String) -> Bool {
        guard let family = ScanObjectFamily.of(category) else { return true }
        return included.contains(family)
    }

    func toggle(_ family: ScanObjectFamily) {
        if included.contains(family) { included.remove(family) } else { included.insert(family) }
    }

    private func save() {
        UserDefaults.standard.set(included.map(\.rawValue), forKey: Self.key)
    }
}
