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

        // Detected, but this catalogue has no entry for them — it is a
        // RESTORATION catalogue, built around what gets wet and what gets
        // replaced, and a dining chair is contents rather than a fixture.
        // Marked rather than dropped: the operator can still name it as
        // something the catalogue does carry, and a silhouette with a
        // question mark is a truer report than silence.
        case .television: return (nil, "Television", true)
        case .table: return (nil, "Table", true)
        case .chair: return (nil, "Chair", true)

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
