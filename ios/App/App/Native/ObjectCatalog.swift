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

    /// **Their order and their names**, taken off the owner's own
    /// screenshots of the library, 18 Aug 2026 — `Doors 17 · Windows 15 ·
    /// Structural 27 · Plumbing 57 · Appliances 29 · Kitchen Cabinets 37 ·
    /// Furniture 126 · Electrical 69 · HVAC 34 · Restoration 29`. The
    /// standing instruction is that the list he scrolls is the list he
    /// already knows, so the sections sit in his order rather than in one
    /// sorted by how often this trade meets them.
    ///
    /// Their `Annotations`, `Outdoors`, `Garage` and `Fire and Safety` are
    /// not here yet — nothing to put in them that this trade would place.
    /// **`Restoration` is theirs too** and is the one section we can fill
    /// better than they can: it is this company's own equipment.
    ///
    /// Doors and Windows are NOT in this enum: they are openings, they live
    /// in a wall, and `ObjectLibrary` below is what puts them in the same
    /// list as these without pretending they are the same kind of thing.
    enum Category: String, CaseIterable, Identifiable, Hashable {
        /// **Marks on the drawing rather than things in the room.** Their
        /// list leads with these and ours had none: a label, an arrow, a
        /// north point, a flag against something worth saying in words.
        ///
        /// They are stored as objects because they ARE positioned things
        /// with a place on a plan — but they carry no size worth measuring,
        /// deduct nothing, and are never counted in a takeoff. `isAnnotation`
        /// is what keeps them out of the totals.
        case annotations = "Annotations"
        case structural = "Structural"
        case plumbing = "Plumbing"
        case appliances = "Appliances"
        case cabinets = "Kitchen Cabinets"
        case furniture = "Furniture"
        case electrical = "Electrical"
        case hvac = "HVAC"
        case restoration = "Restoration"
        case safety = "Fire & Safety"
        case outdoors = "Outdoors"
        case garage = "Garage"

        var id: String { rawValue }

        /// The one-line reason this section exists on a restoration job —
        /// shown under the section tile, because a category nobody can place
        /// is a category nobody opens.
        var caption: String {
            switch self {
            case .plumbing: return "Toilets, vanities, tubs — usually the source"
            case .cabinets: return "Base, wall and tall runs"
            case .appliances: return "What has to come out to dry a floor"
            case .electrical: return "Panel, baseboard heat"
            case .hvac: return "Furnace, air handler, water heater"
            case .furniture: return "What was in the room"
            case .structural: return "Columns, stairs, bulkheads"
            case .restoration: return "Our own equipment, on the plan where it stands"
            case .annotations: return "Write on the drawing — labels, arrows, north"
            case .garage: return "What is in the garage"
            case .safety: return "Extinguishers, alarms, shut-offs, exits"
            case .outdoors: return "Decks, steps, drains, what surrounds the building"
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
        /// The sizes this thing is sold in.
        ///
        /// **One entry, several sizes** — the owner's call after using the
        /// alternative: *"I don't wanna have, like, three, four different
        /// kind of refrigerators in the appliances place. I wanna choose one
        /// refrigerator, and I want it to tell me to choose the size."*
        /// Right, and it reads better: a fridge is one thing that comes in
        /// widths, not four things that happen to look alike.
        ///
        /// Empty for anything sold in one size, which is what tells the
        /// picker there is nothing to ask.
        var stock: [Stock] = []

        var id: String { slug }

        /// A mark on the drawing rather than a thing in the room.
        ///
        /// Annotations are never counted in a takeoff, never deduct
        /// anything, and are drawn as what they say rather than as a
        /// footprint with a symbol in it. One flag, checked in the three
        /// places that would otherwise treat them as fixtures.
        var isAnnotation: Bool { category == .annotations }

        /// Whether placing this asks for words first. A label with nothing
        /// written on it is a blank box nobody can interpret later.
        var needsText: Bool { slug == "note_label" || slug == "note_arrow" }

        /// This entry at one of its stock sizes — see `ObjectCatalog.sized`.
        func sized(_ stock: Stock) -> Entry { ObjectCatalog.sized(self, stock) }


        /// The mark that goes INSIDE the footprint on a floor plan.
        ///
        /// **The owner's own reference, and it settles what a plan symbol
        /// is.** He sent magicplan drawing a fridge as a plain rectangle
        /// with a SNOWFLAKE in it: *"I want like this."* Which is right,
        /// and it is what a plan symbol has always been — the outline
        /// carries the measurement and a glyph says what the thing is. It
        /// replaces both earlier attempts: the outline with two ticks
        /// nobody could read, and the isometric picture, which is a
        /// catalogue illustration doing a drafting job.
        ///
        /// SF Symbols, deliberately. Apple ships fixtures — `refrigerator`,
        /// `washer`, `toilet`, `bathtub`, `sofa`, `stairs` — they are
        /// drawn to one optical weight, and a glyph nobody has to maintain
        /// is a glyph that cannot drift from the rest of the set.
        var glyph: String {
            switch slug {
            case "toilet": return "toilet"
            case "bathtub": return "bathtub"
            case "shower_stall": return "shower"
            case "kitchen_sink", "laundry_tub": return "sink"
            case "vanity_24": return "sink"
            case "water_heater": return "water.waves"
            case "sump_pit": return "drop"
            case "refrigerator": return "refrigerator"
            case "range": return "oven"
            case "dishwasher": return "dishwasher"
            case "washer": return "washer"
            case "dryer": return "dryer"
            case "furnace": return "flame"
            case "air_handler": return "wind"
            case "electrical_panel": return "bolt"
            case "baseboard_heater": return "thermometer.medium"
            case "base_cabinet", "wall_cabinet", "tall_pantry", "dresser": return "cabinet"
            case "island", "countertop_run": return "rectangle.split.3x1"
            case "sofa": return "sofa"
            case "bed_queen": return "bed.double"
            case "desk", "table": return "table.furniture"
            case "shelving": return "books.vertical"
            case "chair": return "chair"
            case "television": return "tv"
            case "stairs": return "stairs"
            case "column": return "square.split.diagonal"
            case "bulkhead": return "rectangle"
            case "fireplace": return "fireplace"
            case "dehumidifier": return "humidity"
            case "air_mover": return "fan.desk"
            case "air_scrubber": return "aqi.medium"
            case "containment": return "rectangle.dashed"
            case "dehumidifier_lgr", "dehumidifier_desiccant": return "humidity"
            case "air_mover_axial", "air_mover_centrifugal", "wall_cavity_dryer":
                return "fan.desk"
            case "hydroxyl_generator", "ozone_generator": return "aqi.medium"
            case "heater_drying": return "heater.vertical"
            case "extraction_unit": return "drop.triangle"
            case "moisture_sensor": return "sensor"
            case "drying_mat": return "rectangle.grid.1x2"
            case "smoke_alarm": return "smoke"
            case "co_alarm": return "carbon.dioxide.cloud"
            case "extinguisher": return "flame.circle"
            case "water_shutoff": return "spigot"
            case "gas_shutoff": return "flame"
            case "floor_drain": return "drop.circle"
            case "exit_sign": return "figure.walk.departure"
            case "hazard_marker": return "exclamationmark.triangle"
            case "deck": return "square.split.bottomrightquarter"
            case "exterior_steps": return "stairs"
            case "window_well": return "rectangle.portrait"
            case "downspout": return "arrow.down.to.line"
            case "ac_condenser": return "wind.snow"
            case "note_label": return "text.bubble"
            case "note_arrow": return "arrow.up.right"
            case "note_north": return "location.north.circle"
            case "note_flag": return "flag"
            case "note_source": return "drop.triangle.fill"
            case "car": return "car"
            case "workbench": return "hammer"
            case "garage_shelving": return "square.grid.3x3"
            case "garage_opener": return "gearshape"
            case "utility_sink": return "sink"
            default: return "square"
            }
        }
    }

    /// One size a thing is sold in.
    struct Stock: Identifiable, Hashable {
        let label: String
        let width: Double
        let depth: Double
        let height: Double
        var id: String { label }
    }

    /// The drawable families. Deliberately few: a plan symbol is a
    /// convention, and an estimator reads `toilet` off an outline the way
    /// they read a door off an arc.
    enum Shape: Hashable {
        case box
        case counter
        case wallCabinet
        case toilet
        case tub
        case shower
        case sink
        case basinInCounter
        case cylinder
        case stove
        case fridge
        /// Anything with a round door seen from above — washer, dryer,
        /// dishwasher. One family because from the top they ARE one shape.
        case machine
        case sofa
        case bed
        case table
        case shelving
        case stairs
        case column
        case panel
        /// Our own gear: a blower or a dehumidifier, drawn with the vent
        /// that says which end the air comes out of.
        case equipment
    }

    /// Everything placeable, in the order each section shows it: most
    /// commonly met first, which is the rule this app already follows for
    /// room types and floor names.
    static let entries: [Entry] = [
        // MARK: Plumbing — where a water-damage job usually starts.
        Entry(
            slug: "toilet", name: "Toilet", category: .plumbing,
            width: 20 * inch, depth: 30 * inch, height: 30 * inch, shape: .toilet,
            sizeNote: "20x30in, 12in rough-in — the standard two-piece in most homes.",
            stock: [
                Stock(label: "Elongated", width: 20 * inch, depth: 30 * inch, height: 30 * inch),
                Stock(label: "Round front", width: 20 * inch, depth: 27 * inch, height: 29 * inch),
            ]),
        Entry(
            slug: "vanity_24", name: "Vanity", category: .plumbing,
            width: 24 * inch, depth: 21 * inch, height: 34.5 * inch, shape: .basinInCounter,
            sizeNote: "24in stock vanity, 21in deep, 34.5in to the counter.",
            stock: [
                Stock(label: "24\"", width: 24 * inch, depth: 21 * inch, height: 34.5 * inch),
                Stock(label: "30\"", width: 30 * inch, depth: 21 * inch, height: 34.5 * inch),
                Stock(label: "36\"", width: 36 * inch, depth: 21 * inch, height: 34.5 * inch),
                Stock(label: "48\"", width: 48 * inch, depth: 21 * inch, height: 34.5 * inch),
                Stock(label: "60\" double", width: 60 * inch, depth: 21 * inch, height: 34.5 * inch),
            ]),
        Entry(
            slug: "bathtub", name: "Bathtub", category: .plumbing,
            width: 60 * inch, depth: 30 * inch, height: 20 * inch, shape: .tub,
            sizeNote: "60x30in alcove tub — the near-universal North American size.",
            stock: [
                Stock(label: "60\" alcove", width: 60 * inch, depth: 30 * inch, height: 20 * inch),
                Stock(label: "54\" alcove", width: 54 * inch, depth: 30 * inch, height: 20 * inch),
                Stock(label: "66\" soaker", width: 66 * inch, depth: 32 * inch, height: 22 * inch),
            ]),
        Entry(
            slug: "shower_stall", name: "Shower stall", category: .plumbing,
            width: 36 * inch, depth: 36 * inch, height: 78 * inch, shape: .shower,
            sizeNote: "36in square stock base; 78in to the top of the surround.",
            stock: [
                Stock(label: "36\" square", width: 36 * inch, depth: 36 * inch, height: 78 * inch),
                Stock(label: "32\" square", width: 32 * inch, depth: 32 * inch, height: 78 * inch),
                Stock(label: "60\" x 32\"", width: 60 * inch, depth: 32 * inch, height: 78 * inch),
            ]),
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
            width: 20 * inch, depth: 20 * inch, height: 58 * inch, shape: .cylinder,
            sizeNote: "20in diameter, 58in tall — a 40 gallon tank.",
            stock: [
                Stock(label: "40 gallon", width: 20 * inch, depth: 20 * inch, height: 58 * inch),
                Stock(label: "50 gallon", width: 22 * inch, depth: 22 * inch, height: 62 * inch),
                Stock(label: "60 gallon", width: 24 * inch, depth: 24 * inch, height: 64 * inch),
                Stock(label: "Tankless", width: 14 * inch, depth: 9 * inch, height: 24 * inch),
            ]),
        Entry(
            slug: "sump_pit", name: "Sump pit", category: .plumbing,
            width: 18 * inch, depth: 18 * inch, height: 24 * inch, shape: .cylinder,
            sizeNote: "18in liner, 24in deep — the pit, not the pump."),

        // MARK: Cabinets — counted by the run, which is why quantity exists.
        Entry(
            slug: "base_cabinet", name: "Base cabinet", category: .cabinets,
            width: 24 * inch, depth: 24 * inch, height: 34.5 * inch, shape: .counter,
            sizeNote: "24in base unit; 34.5in carcass under a 1.5in top makes 36in.",
            stock: [
                Stock(label: "24\"", width: 24 * inch, depth: 24 * inch, height: 34.5 * inch),
                Stock(label: "30\"", width: 30 * inch, depth: 24 * inch, height: 34.5 * inch),
                Stock(label: "36\"", width: 36 * inch, depth: 24 * inch, height: 34.5 * inch),
            ]),
        Entry(
            slug: "wall_cabinet", name: "Wall cabinet", category: .cabinets,
            width: 30 * inch, depth: 12 * inch, height: 30 * inch, shape: .wallCabinet,
            sizeNote: "30in wide, 12in deep — hung, so its own height is what matters."),
        Entry(
            slug: "tall_pantry", name: "Tall pantry", category: .cabinets,
            width: 24 * inch, depth: 24 * inch, height: 84 * inch, shape: .wallCabinet,
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
        // **Sizes are stocked, not invented.** The owner asked for the real
        // ones — *"they all have different sizes… what are the most common
        // sizes in the market?"* — so an appliance that ships in three
        // widths is three entries, the way a 300-object library does it.
        // Picking the right one beats placing a guess and correcting it,
        // and the width is not cosmetic: it is what the cabinet opening was
        // built to and what a replacement has to fit.
        Entry(
            slug: "refrigerator", name: "Refrigerator", category: .appliances,
            width: 36 * inch, depth: 30 * inch, height: 70 * inch, shape: .fridge,
            sizeNote: "36in French-door, 30in deep with the doors — the common new build.",
            stock: [
                Stock(label: "30\" top-freezer", width: 30 * inch, depth: 32 * inch, height: 66 * inch),
                Stock(label: "33\" side-by-side", width: 33 * inch, depth: 32 * inch, height: 68 * inch),
                Stock(label: "36\" French door", width: 36 * inch, depth: 30 * inch, height: 70 * inch),
                Stock(label: "36\" counter-depth", width: 36 * inch, depth: 25 * inch, height: 70 * inch),
            ]),
        Entry(
            slug: "range", name: "Range", category: .appliances,
            width: 30 * inch, depth: 26 * inch, height: 36 * inch, shape: .stove,
            sizeNote: "30in slide-in — the stock opening in every cabinet run.",
            stock: [
                Stock(label: "30\" slide-in", width: 30 * inch, depth: 26 * inch, height: 36 * inch),
                Stock(label: "24\" apartment", width: 24 * inch, depth: 25 * inch, height: 36 * inch),
                Stock(label: "36\" pro", width: 36 * inch, depth: 27 * inch, height: 36 * inch),
            ]),
        Entry(
            slug: "dishwasher", name: "Dishwasher", category: .appliances,
            width: 24 * inch, depth: 24 * inch, height: 34 * inch, shape: .machine,
            sizeNote: "24in built-in, sized to the base cabinet it replaces — nearly all of them.",
            stock: [
                Stock(label: "24\" standard", width: 24 * inch, depth: 24 * inch, height: 34 * inch),
                Stock(label: "18\" compact", width: 18 * inch, depth: 24 * inch, height: 34 * inch),
            ]),
        Entry(
            slug: "washer", name: "Washer", category: .appliances,
            width: 27 * inch, depth: 30 * inch, height: 38 * inch, shape: .machine,
            sizeNote: "27in front-loader, 30in deep with the door shut.",
            stock: [
                Stock(label: "27\" front-load", width: 27 * inch, depth: 30 * inch, height: 38 * inch),
                Stock(label: "27.5\" top-load", width: 27.5 * inch, depth: 27 * inch, height: 42 * inch),
                Stock(label: "24\" compact", width: 24 * inch, depth: 24 * inch, height: 33 * inch),
                Stock(label: "Stacked pair", width: 27 * inch, depth: 31 * inch, height: 76 * inch),
            ]),
        Entry(
            slug: "dryer", name: "Dryer", category: .appliances,
            width: 27 * inch, depth: 30 * inch, height: 38 * inch, shape: .machine,
            sizeNote: "27in, matched to the washer it stacks with.",
            stock: [
                Stock(label: "27\" standard", width: 27 * inch, depth: 30 * inch, height: 38 * inch),
                Stock(label: "24\" compact", width: 24 * inch, depth: 25 * inch, height: 33 * inch),
            ]),

        // MARK: Mechanical and electrical — the basement's own furniture.
        Entry(
            slug: "furnace", name: "Furnace", category: .hvac,
            width: 24 * inch, depth: 30 * inch, height: 60 * inch, shape: .box,
            sizeNote: "24in cabinet, 60in tall — a mid-efficiency upflow."),
        Entry(
            slug: "electrical_panel", name: "Electrical panel", category: .electrical,
            width: 20 * inch, depth: 6 * inch, height: 30 * inch, shape: .panel,
            sizeNote: "20in wide, 6in proud of the wall — a 200A load centre."),
        Entry(
            slug: "baseboard_heater", name: "Baseboard heater", category: .electrical,
            width: 48 * inch, depth: 3 * inch, height: 8 * inch, shape: .panel,
            sizeNote: "4ft element, 3in deep — and the first thing a wet floor reaches."),
        Entry(
            slug: "air_handler", name: "Air handler / HRV", category: .hvac,
            width: 24 * inch, depth: 24 * inch, height: 36 * inch, shape: .box,
            sizeNote: "24in square cabinet, hung or floor-standing."),

        // MARK: Furniture — what was in the room, for the record.
        Entry(
            slug: "sofa", name: "Sofa", category: .furniture,
            width: 84 * inch, depth: 36 * inch, height: 34 * inch, shape: .sofa,
            sizeNote: "7ft three-seat — the common size on a contents list."),
        Entry(
            slug: "bed_queen", name: "Bed, queen", category: .furniture,
            width: 60 * inch, depth: 80 * inch, height: 24 * inch, shape: .bed,
            sizeNote: "60×80in mattress, the North American queen."),
        Entry(
            slug: "dresser", name: "Dresser", category: .furniture,
            width: 60 * inch, depth: 18 * inch, height: 32 * inch, shape: .shelving,
            sizeNote: "60in six-drawer, 18in deep."),
        Entry(
            slug: "desk", name: "Desk", category: .furniture,
            width: 48 * inch, depth: 24 * inch, height: 30 * inch, shape: .table,
            sizeNote: "48×24in, the stock office size."),
        Entry(
            slug: "shelving", name: "Shelving unit", category: .furniture,
            width: 36 * inch, depth: 16 * inch, height: 72 * inch, shape: .shelving,
            sizeNote: "36in bay, 16in deep — basement storage racking."),

        // Contents rather than fixtures, and here for ONE reason: RoomPlan
        // finds them, reliably, and without an entry to land on the scanner
        // had to answer "I don't know" about a chair. The owner, 20 Aug
        // 2026: *"when it's detecting a chair, it needs to show that it's a
        // chair, not a question mark, because it was very good with the
        // chairs, with the tables."* He is right — refusing to name
        // something the sensor is confident and correct about is not
        // caution, it is just work handed back to him.
        Entry(
            slug: "chair", name: "Chair", category: .furniture,
            width: 20 * inch, depth: 20 * inch, height: 32 * inch, shape: .table,
            sizeNote: "20in seat — a dining or office chair."),
        Entry(
            slug: "table", name: "Table", category: .furniture,
            width: 60 * inch, depth: 36 * inch, height: 30 * inch, shape: .table,
            sizeNote: "60×36in, the common dining size."),
        Entry(
            slug: "television", name: "Television", category: .furniture,
            width: 55 * inch, depth: 4 * inch, height: 32 * inch, shape: .shelving,
            sizeNote: "55in diagonal, wall-hung or on a stand."),

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
        // MARK: Restoration — their section, and the one we can fill better.
        Entry(
            slug: "dehumidifier", name: "Dehumidifier", category: .restoration,
            width: 20 * inch, depth: 20 * inch, height: 33 * inch, shape: .equipment,
            sizeNote: "20in square footprint — an LGR on its own wheels."),
        Entry(
            slug: "air_mover", name: "Air mover", category: .restoration,
            width: 18 * inch, depth: 18 * inch, height: 17 * inch, shape: .equipment,
            sizeNote: "18in axial mover, the one that sits in every doorway."),
        Entry(
            slug: "air_scrubber", name: "Air scrubber", category: .restoration,
            width: 20 * inch, depth: 20 * inch, height: 26 * inch, shape: .equipment,
            sizeNote: "20in HEPA scrubber, 500 CFM class."),
        // The equipment a drying job actually runs, by what it IS rather
        // than by brand. The reference lists named models — `Phoenix 250
        // MAX LGR`, `Tramex CMEX5` — and naming a model is a promise to
        // maintain a price list of other people's product lines. What a
        // claim needs is the CLASS and the footprint: an LGR dehumidifier
        // stands where it stands whoever made it.
        Entry(
            slug: "dehumidifier_lgr", name: "Dehumidifier, LGR", category: .restoration,
            width: 22 * inch, depth: 22 * inch, height: 34 * inch, shape: .equipment,
            sizeNote: "22in LGR on castors — the workhorse of a structural dry."),
        Entry(
            slug: "dehumidifier_desiccant", name: "Dehumidifier, desiccant",
            category: .restoration,
            width: 30 * inch, depth: 24 * inch, height: 40 * inch, shape: .equipment,
            sizeNote: "30in desiccant — for a cold building where an LGR stalls."),
        Entry(
            slug: "air_mover_axial", name: "Air mover, axial", category: .restoration,
            width: 18 * inch, depth: 18 * inch, height: 17 * inch, shape: .equipment,
            sizeNote: "18in axial — the one that sits in a doorway."),
        Entry(
            slug: "air_mover_centrifugal", name: "Air mover, centrifugal",
            category: .restoration,
            width: 20 * inch, depth: 17 * inch, height: 17 * inch, shape: .equipment,
            sizeNote: "20in snail — aimed along a wall or under a cabinet kick."),
        Entry(
            slug: "wall_cavity_dryer", name: "Wall cavity dryer", category: .restoration,
            width: 20 * inch, depth: 14 * inch, height: 14 * inch, shape: .equipment,
            sizeNote: "Drives air into a stud bay through drilled holes."),
        Entry(
            slug: "hydroxyl_generator", name: "Hydroxyl generator", category: .restoration,
            width: 22 * inch, depth: 15 * inch, height: 20 * inch, shape: .equipment,
            sizeNote: "22in hydroxyl — runs with people in the building, unlike ozone."),
        Entry(
            slug: "ozone_generator", name: "Ozone generator", category: .restoration,
            width: 14 * inch, depth: 12 * inch, height: 12 * inch, shape: .equipment,
            sizeNote: "14in ozone — the building must be empty while it runs."),
        Entry(
            slug: "heater_drying", name: "Drying heater", category: .restoration,
            width: 20 * inch, depth: 18 * inch, height: 22 * inch, shape: .equipment,
            sizeNote: "Portable heat, to hold a cold basement at drying temperature."),
        Entry(
            slug: "extraction_unit", name: "Extraction unit", category: .restoration,
            width: 24 * inch, depth: 20 * inch, height: 30 * inch, shape: .equipment,
            sizeNote: "Portable extractor for standing water and saturated carpet."),
        Entry(
            slug: "moisture_sensor", name: "Moisture sensor", category: .restoration,
            width: 4 * inch, depth: 2 * inch, height: 4 * inch, shape: .panel,
            sizeNote: "A logging sensor left in place — the record an adjuster reads."),
        Entry(
            slug: "drying_mat", name: "Floor drying mat", category: .restoration,
            width: 24 * inch, depth: 20 * inch, height: 1 * inch, shape: .panel,
            sizeNote: "Pulls water up through hardwood rather than lifting it."),
        Entry(
            slug: "containment", name: "Containment barrier", category: .restoration,
            width: 96 * inch, depth: 2 * inch, height: 96 * inch, shape: .panel,
            sizeNote: "8ft of poly on a zip pole — drawn as the line it is."),

        // MARK: Annotations — writing on the drawing.
        //
        // Sizes here are the mark's own extent on the plan, not a
        // measurement of anything: a label is as big as its words. They are
        // deliberately small so an annotation never reads as a fixture.
        Entry(
            slug: "note_label", name: "Text label", category: .annotations,
            width: 24 * inch, depth: 8 * inch, height: 0, shape: .panel,
            sizeNote: "Words on the plan — 'water line here', 'cut for inspection'."),
        Entry(
            slug: "note_arrow", name: "Arrow", category: .annotations,
            width: 24 * inch, depth: 8 * inch, height: 0, shape: .panel,
            sizeNote: "Points at what the words are about."),
        Entry(
            slug: "note_north", name: "North arrow", category: .annotations,
            width: 12 * inch, depth: 12 * inch, height: 0, shape: .panel,
            sizeNote: "Which way the building faces — an adjuster's first question on a site plan."),
        Entry(
            slug: "note_flag", name: "Flag", category: .annotations,
            width: 10 * inch, depth: 10 * inch, height: 0, shape: .panel,
            sizeNote: "Marks a spot to come back to."),
        Entry(
            slug: "note_source", name: "Water source", category: .annotations,
            width: 12 * inch, depth: 12 * inch, height: 0, shape: .panel,
            sizeNote: "Where it came FROM — the single most important mark on a water claim."),

        // MARK: Garage.
        Entry(
            slug: "car", name: "Car", category: .garage,
            width: 72 * inch, depth: 180 * inch, height: 58 * inch, shape: .box,
            sizeNote: "6x15ft — a mid-size sedan, for whether a bay is usable."),
        Entry(
            slug: "workbench", name: "Workbench", category: .garage,
            width: 72 * inch, depth: 30 * inch, height: 36 * inch, shape: .counter,
            sizeNote: "6ft bench along a wall."),
        Entry(
            slug: "garage_shelving", name: "Garage shelving", category: .garage,
            width: 48 * inch, depth: 24 * inch, height: 72 * inch, shape: .shelving,
            sizeNote: "48in steel racking — and usually what is holding the wet boxes."),
        Entry(
            slug: "garage_opener", name: "Door opener", category: .garage,
            width: 12 * inch, depth: 30 * inch, height: 10 * inch, shape: .box,
            sizeNote: "Ceiling mounted over the bay."),
        Entry(
            slug: "utility_sink", name: "Utility sink", category: .garage,
            width: 24 * inch, depth: 22 * inch, height: 34 * inch, shape: .sink,
            sizeNote: "24in garage sink."),

        // MARK: Fire & Safety — what is ON the building, not in it.
        //
        // The reference carries 136 of these and most are industrial
        // signage: "Do not use lift when fire", "Counterrotating rollers".
        // A restoration claim needs the ones that are actually IN a house
        // and the ones a technician must find on arrival — a shut-off you
        // cannot locate is the difference between a wet room and a wet
        // storey.
        //
        // Small footprints because most of these hang on a wall rather than
        // stand on a floor. They still carry a position, which is the whole
        // point: this is a map of where the safety kit is.
        Entry(
            slug: "smoke_alarm", name: "Smoke alarm", category: .safety,
            width: 6 * inch, depth: 6 * inch, height: 2 * inch, shape: .panel,
            sizeNote: "Ceiling mounted; drawn where it is, since code counts them per storey."),
        Entry(
            slug: "co_alarm", name: "Carbon monoxide alarm", category: .safety,
            width: 6 * inch, depth: 4 * inch, height: 2 * inch, shape: .panel,
            sizeNote: "Required near sleeping areas in Québec."),
        Entry(
            slug: "extinguisher", name: "Fire extinguisher", category: .safety,
            width: 8 * inch, depth: 6 * inch, height: 20 * inch, shape: .cylinder,
            sizeNote: "A 5lb ABC on its bracket."),
        Entry(
            slug: "water_shutoff", name: "Water shut-off", category: .safety,
            width: 6 * inch, depth: 4 * inch, height: 6 * inch, shape: .panel,
            sizeNote: "THE most useful mark on a water-damage plan: where the water stops."),
        Entry(
            slug: "gas_shutoff", name: "Gas shut-off", category: .safety,
            width: 6 * inch, depth: 4 * inch, height: 6 * inch, shape: .panel,
            sizeNote: "Found before work starts, not during it."),
        Entry(
            slug: "floor_drain", name: "Floor drain", category: .safety,
            width: 6 * inch, depth: 6 * inch, height: 1 * inch, shape: .cylinder,
            sizeNote: "Where the water went, and where an extractor discharges."),
        Entry(
            slug: "exit_sign", name: "Exit", category: .safety,
            width: 12 * inch, depth: 3 * inch, height: 8 * inch, shape: .panel,
            sizeNote: "Commercial work: the exit an occupant is directed to."),
        Entry(
            slug: "hazard_marker", name: "Hazard", category: .safety,
            width: 8 * inch, depth: 8 * inch, height: 8 * inch, shape: .panel,
            sizeNote: "Anything on site that will hurt somebody — a hole, a live panel, asbestos."),

        // MARK: Outdoors — the building's own surroundings.
        Entry(
            slug: "deck", name: "Deck", category: .outdoors,
            width: 144 * inch, depth: 96 * inch, height: 36 * inch, shape: .counter,
            sizeNote: "12x8ft, a common rear deck. Often the water path into a basement."),
        Entry(
            slug: "exterior_steps", name: "Exterior steps", category: .outdoors,
            width: 48 * inch, depth: 60 * inch, height: 48 * inch, shape: .stairs,
            sizeNote: "48in wide, five risers to a door."),
        Entry(
            slug: "window_well", name: "Window well", category: .outdoors,
            width: 42 * inch, depth: 24 * inch, height: 36 * inch, shape: .box,
            sizeNote: "42in well at an egress window — and a common way water gets in."),
        Entry(
            slug: "downspout", name: "Downspout", category: .outdoors,
            width: 4 * inch, depth: 3 * inch, height: 120 * inch, shape: .cylinder,
            sizeNote: "Where the roof discharges — the first thing to check on a wet foundation."),
        Entry(
            slug: "ac_condenser", name: "A/C condenser", category: .outdoors,
            width: 30 * inch, depth: 30 * inch, height: 32 * inch, shape: .equipment,
            sizeNote: "30in outdoor unit on its pad."),

        Entry(
            slug: "fireplace", name: "Fireplace", category: .structural,
            width: 48 * inch, depth: 24 * inch, height: 48 * inch, shape: .box,
            sizeNote: "48in surround, 24in of hearth into the room."),
    ]

    /// The same catalogue entry at one of its stock sizes.
    ///
    /// The SLUG does not change — a 30-inch fridge and a 36-inch one are
    /// one fridge at two sizes, which is the whole point of collapsing the
    /// variants back into one entry. What changes is the measurement, and
    /// the size's own label goes on as the object's name so the plan says
    /// which one it is.
    static func sized(_ entry: Entry, _ stock: Stock) -> Entry {
        var copy = entry
        copy = Entry(
            slug: entry.slug, name: "\(entry.name), \(stock.label)",
            category: entry.category, width: stock.width, depth: stock.depth,
            height: stock.height, shape: entry.shape, sizeNote: entry.sizeNote,
            stock: entry.stock)
        return copy
    }

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

// MARK: - One library, two kinds of thing

/// Everything the Insert library offers, openings and objects together.
///
/// **Why this type exists.** The owner sent two screenshots of the
/// reference's library, 18 Aug 2026, and asked for it *"when clicking on the
/// walls and on the floor itself"* — one list, `Doors 17 · Windows 15 ·
/// Structural 27 · Plumbing 57 …`, doors and windows sitting in it beside
/// cabinets and toilets.
///
/// So the LIST is one list, because that is what he browses. The MODEL stays
/// two models, because a door and a cabinet are genuinely different: an
/// opening lives in a wall and deducts wall area, an object stands on the
/// floor and deducts nothing. This enum is the seam — the picker returns one
/// of these and the caller does the right thing with each.
///
/// Getting that seam wrong in the other direction is what the schema comment
/// warns about: a cabinet modelled as an opening would start subtracting
/// wall area that is still there.
enum LibraryItem: Identifiable, Hashable {
    case opening(PlanEditing.OpeningKind)
    case object(ObjectCatalog.Entry)

    var id: String {
        switch self {
        case .opening(let kind): return "opening.\(kind.rawValue)"
        case .object(let entry): return "object.\(entry.slug)"
        }
    }

    var name: String {
        switch self {
        case .opening(let kind): return kind.label
        case .object(let entry): return entry.name
        }
    }

    /// Footprint width and depth, for the tile art. An opening has no depth
    /// of its own — it is a hole in a wall — so it is drawn as the wall
    /// thickness it interrupts, which is what its plan symbol already is.
    var size: (width: Double, depth: Double) {
        switch self {
        case .opening(let kind): return (kind.width, 0.12)
        case .object(let entry): return (entry.width, entry.depth)
        }
    }
}

/// The library's sections, in the reference's own order — openings first,
/// exactly as his screenshots show them.
enum LibrarySection: Identifiable, Hashable, CaseIterable {
    case doors
    case windows
    case catalogue(ObjectCatalog.Category)

    static var allCases: [LibrarySection] {
        [.doors, .windows] + ObjectCatalog.Category.allCases.map(LibrarySection.catalogue)
    }

    var id: String { title }

    var title: String {
        switch self {
        case .doors: return "Doors"
        case .windows: return "Windows"
        case .catalogue(let category): return category.rawValue
        }
    }

    var items: [LibraryItem] {
        switch self {
        case .doors:
            return [
                .doorSingle, .doorDouble, .doorPocket, .doorBifold, .doorBypass,
                .doorFrench, .doorSliding, .doorPatio, .doorEntry, .doorGarage,
                .doorCased,
            ].map(LibraryItem.opening)
        case .windows:
            return [
                .windowStandard, .windowDoubleHung, .windowCasement, .windowSliding,
                .windowWide, .windowPicture, .windowBay, .windowEgress, .windowSmall,
            ].map(LibraryItem.opening)
        case .catalogue(let category):
            return ObjectCatalog.entries(in: category).map(LibraryItem.object)
        }
    }

    /// Free text across every section — ORD-40's fourth piece.
    static func search(_ term: String) -> [LibraryItem] {
        let needle = term.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return [] }
        return allCases.flatMap(\.items).filter {
            $0.name.lowercased().contains(needle)
        }
    }

    static func item(id: String) -> LibraryItem? {
        allCases.flatMap(\.items).first { $0.id == id }
    }
}
