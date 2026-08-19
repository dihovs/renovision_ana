import CoreGraphics
import Foundation

/// The things that stand in a room: cabinets, toilets, vanities, appliances.
///
/// ORD-40, asked for by the owner on 18 Aug 2026 — *"cabinets, toilets,
/// different types of doors, sliding door, whatever kind of door and things
/// exist here in North America"* — and ORD-36's takeoff underneath it.
///
/// **An object is not an opening, and that distinction is the whole design.**
/// An opening lives IN a wall: keyed to an edge index, it knocks a hole in
/// the wall band, and its width and height DEDUCT from net wall area. An
/// object sits ON the floor: it has a position rather than a host edge, it
/// keeps its own height, and it deducts nothing from anything. `OpeningKind`
/// stays exactly as it is; this is a second, separate model beside it, which
/// is why nothing here tries to unify the two.
///
/// **Sizes are stock sizes, in inches, with the derivation stated** — the
/// precedent `OpeningKind` already set, and it matters for the same reason:
/// a bare metric number in this file would be a guess nobody could check,
/// where `30 * inch` is a millwork dimension an estimator recognises. These
/// are North American residential stock, not the reference's metric library.
///
/// The catalogue is a LIST, not an enum. The reference ships 300+ objects and
/// this one will grow for years; a case per fixture would mean recompiling
/// the app to add a bar sink, and the stored `kind` is a string precisely so
/// a row whose slug is not recognised yet is still a drawable box with a
/// name.
enum ObjectCatalog {

    private static let inch = 0.0254

    /// The reference's own top-level sections (object-model §2's library:
    /// Annotations, Doors, Windows, Structural, Plumbing, Appliances,
    /// Kitchen Cabinets, Furniture, Electrical), reduced to the ones a
    /// water-damage job actually meets and ordered by how often this trade
    /// meets them.
    ///
    /// Doors and Windows are deliberately ABSENT: they are openings, they
    /// live in a wall, and they are already authored through `Insert → Door
    /// or window` on the wall itself. Putting them here too would give the
    /// operator two routes to one thing that behave differently.
    enum Category: String, CaseIterable, Identifiable, Hashable {
        case plumbing = "Plumbing"
        case cabinets = "Kitchen & Bath Cabinets"
        case appliances = "Appliances"
        case mechanical = "Mechanical & Electrical"
        case furniture = "Furniture"
        case structural = "Structural"

        var id: String { rawValue }

        /// The one-line reason this section exists on a restoration job —
        /// shown under the section tile, because a category nobody can place
        /// is a category nobody opens.
        var caption: String {
            switch self {
            case .plumbing: return "Toilets, vanities, tubs — usually the source"
            case .cabinets: return "Base, wall and tall runs"
            case .appliances: return "What has to come out to dry a floor"
            case .mechanical: return "Furnace, tank, panel, baseboard heat"
            case .furniture: return "What was in the room"
            case .structural: return "Columns, stairs, bulkheads"
            }
        }
    }

    /// One catalogue entry: what it is called, how big it is, and what shape
    /// to draw. `slug` is what the database stores and must never change
    /// once it has been used — renaming a `name` is free, renaming a `slug`
    /// orphans every object already placed.
    struct Entry: Identifiable, Hashable {
        let slug: String
        let name: String
        let category: Category
        /// Metres, footprint. `height` is the object's own height standing on
        /// the floor — the owner was explicit that a cabinet keeps it.
        let width: Double
        let depth: Double
        let height: Double
        /// Which figure to draw. A dozen shapes cover a catalogue of any
        /// size, because what makes a toilet readable on a plan is its
        /// outline, not a portrait of it.
        let shape: Shape
        /// The inch derivation, stated so the number can be checked rather
        /// than trusted. Shown nowhere; it is for whoever reads this file.
        let sizeNote: String

        var id: String { slug }
    }

    /// The drawable families. Deliberately few: a plan symbol is a
    /// convention, and an estimator reads `toilet` off an outline the way
    /// they read a door off an arc.
    enum Shape: Hashable {
        case box
        case counter
        case toilet
        case tub
        case shower
        case sink
        case basinInCounter
        case cylinder
        case appliance
        case stairs
        case column
        case panel
    }

    /// Everything placeable, in the order each section shows it: most
    /// commonly met first, which is the rule this app already follows for
    /// room types and floor names.
    static let entries: [Entry] = [
        // MARK: Plumbing — where a water-damage job usually starts.
        Entry(
            slug: "toilet", name: "Toilet", category: .plumbing,
            width: 20 * inch, depth: 28 * inch, height: 30 * inch, shape: .toilet,
            sizeNote: "20×28in footprint, 30in to the tank lid — a standard two-piece."),
        Entry(
            slug: "vanity_24", name: "Vanity, 24\"", category: .plumbing,
            width: 24 * inch, depth: 21 * inch, height: 34.5 * inch, shape: .basinInCounter,
            sizeNote: "24in stock vanity, 21in deep, 34.5in to the counter."),
        Entry(
            slug: "vanity_36", name: "Vanity, 36\"", category: .plumbing,
            width: 36 * inch, depth: 21 * inch, height: 34.5 * inch, shape: .basinInCounter,
            sizeNote: "36in stock vanity — the common single-basin size."),
        Entry(
            slug: "vanity_60", name: "Vanity, 60\" double", category: .plumbing,
            width: 60 * inch, depth: 21 * inch, height: 34.5 * inch, shape: .basinInCounter,
            sizeNote: "60in double vanity, the stock two-basin width."),
        Entry(
            slug: "bathtub", name: "Bathtub", category: .plumbing,
            width: 60 * inch, depth: 30 * inch, height: 20 * inch, shape: .tub,
            sizeNote: "60×30in alcove tub — the near-universal North American size."),
        Entry(
            slug: "shower_stall", name: "Shower stall", category: .plumbing,
            width: 36 * inch, depth: 36 * inch, height: 78 * inch, shape: .shower,
            sizeNote: "36in square stock base; 78in to the top of the surround."),
        Entry(
            slug: "kitchen_sink", name: "Kitchen sink", category: .plumbing,
            width: 33 * inch, depth: 22 * inch, height: 9 * inch, shape: .sink,
            sizeNote: "33in double-bowl drop-in, 22in front to back."),
        Entry(
            slug: "laundry_tub", name: "Laundry tub", category: .plumbing,
            width: 23 * inch, depth: 23 * inch, height: 34 * inch, shape: .sink,
            sizeNote: "23in square utility tub — the basement standard."),
        Entry(
            slug: "water_heater", name: "Water heater", category: .plumbing,
            width: 22 * inch, depth: 22 * inch, height: 60 * inch, shape: .cylinder,
            sizeNote: "22in diameter, 60in tall — a 40–50 gallon tank."),
        Entry(
            slug: "sump_pit", name: "Sump pit", category: .plumbing,
            width: 18 * inch, depth: 18 * inch, height: 24 * inch, shape: .cylinder,
            sizeNote: "18in liner, 24in deep — the pit, not the pump."),

        // MARK: Cabinets — counted by the run, which is why quantity exists.
        Entry(
            slug: "base_cabinet", name: "Base cabinet", category: .cabinets,
            width: 24 * inch, depth: 24 * inch, height: 34.5 * inch, shape: .counter,
            sizeNote: "24in base unit; 34.5in carcass under a 1.5in top makes 36in."),
        Entry(
            slug: "wall_cabinet", name: "Wall cabinet", category: .cabinets,
            width: 30 * inch, depth: 12 * inch, height: 30 * inch, shape: .box,
            sizeNote: "30in wide, 12in deep — hung, so its own height is what matters."),
        Entry(
            slug: "tall_pantry", name: "Tall pantry", category: .cabinets,
            width: 24 * inch, depth: 24 * inch, height: 84 * inch, shape: .box,
            sizeNote: "24in pantry, 84in — floor to the standard soffit."),
        Entry(
            slug: "island", name: "Island", category: .cabinets,
            width: 72 * inch, depth: 36 * inch, height: 36 * inch, shape: .counter,
            sizeNote: "72×36in — the smallest island that still takes a stool."),
        Entry(
            slug: "countertop_run", name: "Countertop run", category: .cabinets,
            width: 96 * inch, depth: 25 * inch, height: 36 * inch, shape: .counter,
            sizeNote: "8ft of counter, 25in deep with the overhang."),

        // MARK: Appliances — what has to come out to dry a floor.
        Entry(
            slug: "refrigerator", name: "Refrigerator", category: .appliances,
            width: 36 * inch, depth: 30 * inch, height: 70 * inch, shape: .appliance,
            sizeNote: "36in French-door, 30in deep with the doors."),
        Entry(
            slug: "range", name: "Range", category: .appliances,
            width: 30 * inch, depth: 26 * inch, height: 36 * inch, shape: .appliance,
            sizeNote: "30in slide-in — the stock opening in every cabinet run."),
        Entry(
            slug: "dishwasher", name: "Dishwasher", category: .appliances,
            width: 24 * inch, depth: 24 * inch, height: 34 * inch, shape: .appliance,
            sizeNote: "24in built-in, sized to the base cabinet it replaces."),
        Entry(
            slug: "washer", name: "Washer", category: .appliances,
            width: 27 * inch, depth: 30 * inch, height: 38 * inch, shape: .appliance,
            sizeNote: "27in front-loader, 30in deep with the door shut."),
        Entry(
            slug: "dryer", name: "Dryer", category: .appliances,
            width: 27 * inch, depth: 30 * inch, height: 38 * inch, shape: .appliance,
            sizeNote: "27in, matched to the washer it stacks with."),

        // MARK: Mechanical and electrical — the basement's own furniture.
        Entry(
            slug: "furnace", name: "Furnace", category: .mechanical,
            width: 24 * inch, depth: 30 * inch, height: 60 * inch, shape: .appliance,
            sizeNote: "24in cabinet, 60in tall — a mid-efficiency upflow."),
        Entry(
            slug: "electrical_panel", name: "Electrical panel", category: .mechanical,
            width: 20 * inch, depth: 6 * inch, height: 30 * inch, shape: .panel,
            sizeNote: "20in wide, 6in proud of the wall — a 200A load centre."),
        Entry(
            slug: "baseboard_heater", name: "Baseboard heater", category: .mechanical,
            width: 48 * inch, depth: 3 * inch, height: 8 * inch, shape: .panel,
            sizeNote: "4ft element, 3in deep — and the first thing a wet floor reaches."),
        Entry(
            slug: "air_handler", name: "Air handler / HRV", category: .mechanical,
            width: 24 * inch, depth: 24 * inch, height: 36 * inch, shape: .box,
            sizeNote: "24in square cabinet, hung or floor-standing."),

        // MARK: Furniture — what was in the room, for the record.
        Entry(
            slug: "sofa", name: "Sofa", category: .furniture,
            width: 84 * inch, depth: 36 * inch, height: 34 * inch, shape: .box,
            sizeNote: "7ft three-seat — the common size on a contents list."),
        Entry(
            slug: "bed_queen", name: "Bed, queen", category: .furniture,
            width: 60 * inch, depth: 80 * inch, height: 24 * inch, shape: .box,
            sizeNote: "60×80in mattress, the North American queen."),
        Entry(
            slug: "dresser", name: "Dresser", category: .furniture,
            width: 60 * inch, depth: 18 * inch, height: 32 * inch, shape: .box,
            sizeNote: "60in six-drawer, 18in deep."),
        Entry(
            slug: "desk", name: "Desk", category: .furniture,
            width: 48 * inch, depth: 24 * inch, height: 30 * inch, shape: .box,
            sizeNote: "48×24in, the stock office size."),
        Entry(
            slug: "shelving", name: "Shelving unit", category: .furniture,
            width: 36 * inch, depth: 16 * inch, height: 72 * inch, shape: .box,
            sizeNote: "36in bay, 16in deep — basement storage racking."),

        // MARK: Structural — things that are in the way and cannot move.
        Entry(
            slug: "column", name: "Column / post", category: .structural,
            width: 8 * inch, depth: 8 * inch, height: 96 * inch, shape: .column,
            sizeNote: "8in steel post or built-up wood — a basement's usual."),
        Entry(
            slug: "stairs", name: "Stairs", category: .structural,
            width: 36 * inch, depth: 120 * inch, height: 96 * inch, shape: .stairs,
            sizeNote: "36in run, 10ft of horizontal travel for a storey."),
        Entry(
            slug: "bulkhead", name: "Bulkhead / soffit", category: .structural,
            width: 96 * inch, depth: 24 * inch, height: 12 * inch, shape: .box,
            sizeNote: "A boxed duct run — 24in deep, 12in down from the ceiling."),
        Entry(
            slug: "fireplace", name: "Fireplace", category: .structural,
            width: 48 * inch, depth: 24 * inch, height: 48 * inch, shape: .box,
            sizeNote: "48in surround, 24in of hearth into the room."),
    ]

    static func entry(slug: String) -> Entry? {
        entries.first { $0.slug == slug }
    }

    static func entries(in category: Category) -> [Entry] {
        entries.filter { $0.category == category }
    }

    /// Free-text search across name and category, which is what ORD-40's
    /// fourth piece asks for and is trivial now the catalogue is a list.
    static func search(_ term: String) -> [Entry] {
        let needle = term.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return [] }
        return entries.filter {
            $0.name.lowercased().contains(needle)
                || $0.category.rawValue.lowercased().contains(needle)
        }
    }

    /// The footprint of an entry at a rotation, as four corners in metres
    /// about its own centre — what the plan draws and what a hit test uses.
    static func footprint(width: Double, depth: Double, rotation: Double) -> [CGPoint] {
        let hw = width / 2
        let hd = depth / 2
        let radians = rotation * .pi / 180
        let c = cos(radians)
        let s = sin(radians)
        return [
            CGPoint(x: -hw, y: -hd), CGPoint(x: hw, y: -hd),
            CGPoint(x: hw, y: hd), CGPoint(x: -hw, y: hd),
        ].map { CGPoint(x: $0.x * c - $0.y * s, y: $0.x * s + $0.y * c) }
    }
}

// MARK: - Recently used and favourites

/// ORD-40's third piece: *"a tab that shows my favorite and most commonly
/// used ones to start with."*
///
/// `UserDefaults`, not a table. Nothing here is worth a migration, a network
/// round trip or a sync conflict — it is one operator's habit on one phone,
/// and the worst case of losing it is that the rail starts empty again.
enum ObjectHabits {
    private static let recentKey = "objects.recent"
    private static let favouriteKey = "objects.favourites"
    /// Long enough to cover a day's work, short enough that the rail is
    /// still a shortcut rather than a second catalogue.
    private static let recentLimit = 12

    static var recent: [String] {
        UserDefaults.standard.stringArray(forKey: recentKey) ?? []
    }

    /// Most recent first, and never duplicated — placing the same toilet
    /// twice should move it to the front, not fill the rail with toilets.
    static func remember(_ slug: String) {
        var list = recent.filter { $0 != slug }
        list.insert(slug, at: 0)
        UserDefaults.standard.set(Array(list.prefix(recentLimit)), forKey: recentKey)
    }

    static var favourites: [String] {
        UserDefaults.standard.stringArray(forKey: favouriteKey) ?? []
    }

    static func isFavourite(_ slug: String) -> Bool { favourites.contains(slug) }

    static func toggleFavourite(_ slug: String) {
        var list = favourites
        if let index = list.firstIndex(of: slug) {
            list.remove(at: index)
        } else {
            list.append(slug)
        }
        UserDefaults.standard.set(list, forKey: favouriteKey)
    }
}
