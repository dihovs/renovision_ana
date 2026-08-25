import CoreLocation
import MapKit
import SwiftUI

/// The card grid the reference uses everywhere it lists things — projects,
/// floor plans, rooms.
///
/// Measured off the owner's own phone rather than guessed. Every part of the
/// shape carries its weight:
///
/// * **Two columns, not a horizontal rail.** A rail shows three items and
///   hides the rest behind a swipe nobody makes. A grid shows the whole job.
/// * **The add tile comes first**, dashed, same size as a real card. Creating
///   the next thing is the most common action on a list screen and it should
///   not be a floating button covering the last row.
/// * **The label sits BELOW the card, centred.** Inside the tile it competes
///   with the drawing; below it, the drawing stays a drawing.
/// * **White card on a light-grey page.** The card is the paper the plan is
///   drawn on — the same reason `Brand.Plan` exists.
///
/// Up to three lines under each card: name, then a secondary line, then a
/// tertiary one. That is exactly what a project needs — name, address, time —
/// and a floor plan uses only the first.
struct CardGrid<Item: Identifiable, Thumbnail: View>: View {
    let items: [Item]
    var addLabel: String
    var onAdd: (() -> Void)?
    var onOpen: (Item) -> Void
    /// Name, secondary, tertiary. Empty strings are simply not drawn.
    var caption: (Item) -> (String, String?, String?)
    @ViewBuilder var thumbnail: (Item) -> Thumbnail
    /// The reference's "…" in the card's bottom-right corner. Optional and
    /// type-erased rather than a second generic: most callers (rooms, floor
    /// plans) have no per-item action yet, and forcing them to name a menu
    /// type just to pass `nil` is a worse API than one closure that some
    /// callers skip.
    var menu: ((Item) -> AnyView)?
    /// The reference's star badge, top-trailing on the card — its own colour
    /// here rather than the reference's yellow, since the glyph and its
    /// colour are exactly the part of the reference this project draws its
    /// own rather than traces (`HANDOFF.md` §2). Optional for the same
    /// reason `menu` is: most callers have nothing to star yet.
    var isFavorite: ((Item) -> Bool)?

    private let columns = [
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14),
    ]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .center, spacing: 18) {
            if let onAdd {
                Button(action: onAdd) {
                    VStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(
                                Brand.Plan.dimension.opacity(0.5),
                                style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                            .aspectRatio(1.16, contentMode: .fit)
                            .overlay(
                                Image(systemName: "plus")
                                    .font(.system(size: 22, weight: .regular))
                                    .foregroundStyle(Brand.Plan.dimension))
                        Text(addLabel)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Brand.Plan.label)
                        // Keeps the add tile's overall height equal to a card
                        // carrying two caption lines, so row one sits straight.
                        Color.clear.frame(height: 1)
                    }
                    // The tile is drawn with `strokeBorder`, which fills
                    // NOTHING — only the 1.5pt dashed outline is a shape, and
                    // only a shape takes a tap. Without this the middle of
                    // the tile, which is the whole target a thumb aims at,
                    // was inert: the button could only be hit on the dashed
                    // line itself, on the small plus glyph, or on the label
                    // underneath. It read as "New Project does nothing",
                    // while the occasional lucky tap did create one.
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }

            ForEach(items) { item in
                let text = caption(item)
                VStack(spacing: 8) {
                    // The menu is a SIBLING overlay on top of the card's own
                    // Button, not content nested inside its label — an
                    // interactive control nested inside another control's
                    // label fights it for the tap rather than winning its
                    // own corner outright, which a native `Menu` needs to
                    // open reliably rather than just triggering `onOpen`.
                    ZStack(alignment: .bottomTrailing) {
                        Button { onOpen(item) } label: {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Brand.Plan.paper)
                                .aspectRatio(1.16, contentMode: .fit)
                                .overlay(
                                    thumbnail(item)
                                        .clipShape(RoundedRectangle(cornerRadius: 12)))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .strokeBorder(Brand.Plan.dimension.opacity(0.18), lineWidth: 0.5))
                                .shadow(color: .black.opacity(0.06), radius: 3, y: 1)
                        }
                        .buttonStyle(.plain)

                        if let menu {
                            menu(item)
                                .padding(6)
                        }
                    }
                    .overlay(alignment: .topTrailing) {
                        if isFavorite?(item) == true {
                            Image(systemName: "star.fill")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 22, height: 22)
                                .background(Brand.blue, in: Circle())
                                .overlay(Circle().strokeBorder(.white, lineWidth: 1.5))
                                .padding(6)
                                .allowsHitTesting(false)
                        }
                    }

                    Button { onOpen(item) } label: {
                        VStack(spacing: 1) {
                            Text(text.0)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Brand.Plan.label)
                                .lineLimit(1)
                            if let second = text.1, !second.isEmpty {
                                Text(second)
                                    .font(.system(size: 11))
                                    .foregroundStyle(Brand.Plan.labelSoft)
                                    .lineLimit(1)
                            }
                            if let third = text.2, !third.isEmpty {
                                Text(third)
                                    .font(.system(size: 10))
                                    .foregroundStyle(Brand.Plan.labelSoft.opacity(0.8))
                                    .lineLimit(1)
                            }
                        }
                        .multilineTextAlignment(.center)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

/// The reference's dashed `+` tile at the head of a rail.
///
/// Solid-filled behind the dashes on purpose: a tile drawn only with
/// `strokeBorder` fills nothing, so only the 1.5pt outline takes a tap and
/// the middle of the tile — the whole target a thumb aims at — is inert.
/// That exact mistake made `New Project` look broken for a day.
struct AddTile: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(Brand.Plan.dimension)
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.Plan.labelSoft)
                    .lineLimit(1)
            }
            .frame(width: 132, height: 114)
            .background(Brand.Plan.paper.opacity(0.6), in: .rect(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(
                        Brand.Plan.dimension.opacity(0.5),
                        style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// An empty dashed outline beside the `+`. Draws nothing and does nothing —
/// it is the reference's way of saying "things go along here", which a lone
/// button on its own does not say.
struct GhostTile: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 12)
            .strokeBorder(
                Brand.Plan.dimension.opacity(0.28),
                style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
            .frame(width: 132, height: 114)
            .allowsHitTesting(false)
    }
}

/// One storey, as a tile in the project page's Floor Plans rail.
///
/// The reference's Floor Plans section is a rail of the plans that exist,
/// led by the `+` (object-model §2e). Ours drew the `+` and nothing else,
/// and filed the storeys themselves at the very bottom of the page — below
/// Photos, Files and Created / Last modified. The owner put it plainly:
/// *"when I go up to the project, I wanna see the floor plan where is the
/// add floor plan button… whatever is already existing should be beside
/// this add floor plan button, not under everything, separate."*
///
/// So the storey is a tile: its own drawing, its name, and what it holds.
/// Tapping it opens the storey, which is what choosing a floor has always
/// meant here.
struct FloorPlanTile: View {
    let level: String
    let rooms: [RoomScan]
    /// What is standing in each room, and what is damaged, keyed by room id.
    /// The tile is a DRAWING of the property, and the owner comparing it
    /// with the reference put the gap plainly, 24 Aug 2026: *"the floorplan
    /// here is small, make it bigger, like in the magicplan, with furnitures
    /// and also damaged area."*
    var objects: [String: [RoomObject]] = [:]
    var areas: [String: [AffectedArea]] = [:]
    let onOpen: () -> Void
    /// Remove the whole storey. Nil leaves the tile exactly as it was — the
    /// rail on a screen with no way to reload should not offer to delete.
    var onDelete: (() -> Void)? = nil

    @State private var confirmingDelete = false

    private var areaSqm: Double { rooms.reduce(0) { $0 + $1.floorAreaSqmTrusted } }
    private var drawable: Bool { rooms.contains { $0.geometry != nil } }

    var body: some View {
        Button(action: onOpen) {
            VStack(spacing: 0) {
                ZStack {
                    // **The sheet sits in a grey well, not on white paper.**
                    // The owner, 24 Aug 2026, on the reference's project
                    // grid: *"they have a big grey colour for the card, and
                    // then they have the white frame around. It makes it
                    // better, more luxury, more professional."* He is
                    // describing figure and ground: a white card floating on
                    // a grey page has nothing holding it, while a grey field
                    // inside a white border reads as a mounted drawing. The
                    // drawing itself keeps its own paper — it is the well
                    // behind it that turns grey.
                    Brand.Plan.floorMuted
                    if drawable {
                        // The storey's own drawing, at thumbnail size and
                        // with the drafting grid off — it would only be
                        // noise this small. Hit testing off so the tile is
                        // one target, not one per room inside it.
                        LevelCanvas(
                            rooms: rooms, objects: objects, areas: areas,
                            grid: false, maxHeight: 168
                        ) { _ in }
                        .allowsHitTesting(false)
                        .padding(4)
                    } else {
                        // A floor that exists but has nothing measured on it
                        // yet. Says so, rather than showing blank paper that
                        // reads as a drawing that failed.
                        Image(systemName: "square.dashed")
                            .font(.system(size: 20))
                            .foregroundStyle(Brand.Plan.labelSoft)
                    }
                }
                // **Big enough to be a drawing.** It was 92pt tall inside a
                // 132pt tile, which is a stamp: at that size the furniture
                // is invisible and a damaged patch is a smudge, so the
                // drawing could only ever be an outline. The reference's
                // card is most of the screen's width and reads as a plan at
                // a glance. Grown to match, and the furniture and damage
                // below are what the extra room is FOR — a bigger picture of
                // an empty outline would be no better, only larger.
                .frame(height: 180)
                .clipped()

                VStack(spacing: 1) {
                    Text(level)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Brand.ink)
                        .lineLimit(1)
                    Text(
                        rooms.isEmpty
                            ? "No rooms yet"
                            : "\(rooms.count) room\(rooms.count == 1 ? "" : "s") · \(Measure.sqftLabel(areaSqm))"
                    )
                    .font(.system(size: 11))
                    .monospacedDigit()
                    .foregroundStyle(Brand.inkFaint)
                    .lineLimit(1)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 7)
                .background(Brand.surface)
            }
            .frame(width: 260)
            .clipShape(.rect(cornerRadius: Brand.Radius.card - 4))
            // The white frame the owner pointed at: a band of card around
            // the drawing, with the corner radius stepped so the inner
            // clip sits concentrically inside the outer one rather than
            // running parallel to it at a constant offset.
            .padding(5)
            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: Brand.Radius.card)
                    .strokeBorder(Brand.Plan.dimension.opacity(0.16), lineWidth: 1))
            .shadow(color: .black.opacity(0.06), radius: 6, y: 2)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(level), \(rooms.count) rooms")
        // The three dots the project cards have always had, on the floor
        // card, because a whole storey could be created and never removed.
        // The owner, 20 Aug 2026: *"let's say we have side by side two,
        // three, five scans or whatever. I wanna get rid of one of them, the
        // entire card. I'm not able. I think I need to have like three dots
        // so I can click on it and remove it."*
        //
        // OVERLAID rather than put in the caption row: the tile is one
        // button and the menu is a second target inside it, which is the
        // same arrangement `ProjectCardMenu` already uses — 24pt of visible
        // glyph inside a 44pt tap area, anchored to the corner so the extra
        // area grows inward instead of moving the dots.
        .overlay(alignment: .topTrailing) {
            if let onDelete {
                Menu {
                    Button(role: .destructive) { confirmingDelete = true } label: {
                        Label("Delete floor…", systemImage: "trash")
                    }
                } label: {
                    ZStack(alignment: .topTrailing) {
                        Color.clear
                        Image(systemName: "ellipsis")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Brand.Plan.label)
                            .frame(width: 24, height: 24)
                            .background(.regularMaterial, in: Circle())
                            .overlay(
                                Circle().strokeBorder(
                                    Brand.Plan.dimension.opacity(0.15), lineWidth: 0.5))
                            .padding(4)
                    }
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
                }
                // A floor is not a row. It is a STRING on every room that
                // sits on it, so deleting one deletes those rooms and their
                // measurements — which is why the question says how many
                // rather than asking "are you sure".
                .confirmationDialog(
                    rooms.isEmpty
                        ? "Delete \(level)?"
                        : "Delete \(level) and its \(rooms.count) room\(rooms.count == 1 ? "" : "s")?",
                    isPresented: $confirmingDelete, titleVisibility: .visible
                ) {
                    Button("Delete", role: .destructive, action: onDelete)
                    Button("Keep it", role: .cancel) {}
                } message: {
                    Text(
                        rooms.isEmpty
                            ? "Nothing has been measured on this floor yet."
                            : "Everything measured on this floor goes with it — the rooms, their walls, and the photos filed against them. This cannot be undone.")
                }
            }
        }
    }
}

/// The filter chips above a grid — `All` as a filled pill, the rest outlined.
///
/// The selected chip is SOLID and the others are not, which is the whole of
/// how it reads at a glance; using colour alone would fail the operator
/// looking at this in sunlight with wet hands.
struct FilterChips<Value: Hashable>: View {
    let options: [(value: Value, label: String, icon: String)]
    @Binding var selection: Value

    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.value) { option in
                let active = option.value == selection
                Button {
                    selection = option.value
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: option.icon).font(.system(size: 11, weight: .semibold))
                        Text(option.label).font(.system(size: 13, weight: .semibold))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .foregroundStyle(active ? Brand.Plan.paper : Brand.Plan.label)
                    .background(
                        Capsule().fill(active ? Brand.Plan.label : Brand.Plan.paper))
                    .overlay(
                        Capsule().strokeBorder(
                            Brand.Plan.dimension.opacity(active ? 0 : 0.3), lineWidth: 0.5))
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
    }
}

/// A floor plan at thumbnail size — walls only, no labels, no dimensions.
///
/// Deliberately not the full renderer. At 150 points across, a dimension
/// string is three grey pixels and a room name is a smudge; what survives at
/// this size is the SHAPE, and the shape is what tells one job from another
/// in a grid. Drawn from the same `FloorPlanGeometry` the storey canvas uses,
/// so the card and the plan behind it cannot disagree about the outline.
struct MiniPlan: View {
    /// The largest room — the fallback, and all an older server sends.
    let geometry: ScanGeometry
    /// Every room on the busiest storey. When this has more than one, the
    /// card draws the FLOOR: the owner's own ask, pointing at a nine-room
    /// condo card in magicplan — *"you see how nice it is displayed. I
    /// would like to have a look like this... and also you can see the
    /// doors, how the door opening arches."*
    var floorRooms: [ProjectSummary.PlacedRoom] = []

    var body: some View {
        Canvas { context, size in
            let plans = resolvedPlans
            guard !plans.isEmpty else { return }

            // Placement through the SAME shelf-packer the storey canvas
            // uses, so a card and the floor behind it lay their rooms out
            // identically rather than by two rules that can drift.
            let packed = StoreyPacking.pack(
                plans.enumerated().map { index, item in
                    StoreyPacking.Item(
                        id: "\(index)", width: item.plan.width, height: item.plan.height,
                        planX: item.planX, planY: item.planY)
                })
            let placedByID = Dictionary(
                uniqueKeysWithValues: packed.placed.map { ($0.id, $0) })

            let w = max(packed.width, 0.001)
            let h = max(packed.height, 0.001)
            // 0.78, not 0.86 — "zoom a bit out to demonstrate... there's
            // like a white frame going around." The margin IS the frame:
            // paper visible on all four sides rather than walls running to
            // the tile's own edge.
            let scale = min(size.width / w, size.height / h) * 0.78
            let ox = (size.width - w * scale) / 2
            let oy = (size.height - h * scale) / 2

            for (index, item) in plans.enumerated() {
                let origin = placedByID["\(index)"]
                let dx = (origin?.x ?? 0) * scale + ox
                let dy = (origin?.y ?? 0) * scale + oy
                let plan = item.plan
                func pt(_ x: Double, _ y: Double) -> CGPoint {
                    CGPoint(x: x * scale + dx, y: y * scale + dy)
                }

                if plan.polygon.count >= 3 {
                    var floor = Path()
                    for (i, p) in plan.polygon.enumerated() {
                        let q = pt(p.x, p.y)
                        if i == 0 { floor.move(to: q) } else { floor.addLine(to: q) }
                    }
                    floor.closeSubpath()
                    context.fill(floor, with: .color(Brand.Plan.floorMuted))
                }

                // Mitred at the corners by stroking the closed outline as
                // ONE path — the same fix `StoreyBaseLayer` needed, for the
                // same reason: separate per-segment subpaths never join, so
                // any corner that is not square-on gapped or spurred.
                let band = max(1.4, 0.114 * scale)
                if plan.polygon.count >= 3 {
                    var outline = Path()
                    outline.move(to: pt(plan.polygon[0].x, plan.polygon[0].y))
                    for p in plan.polygon.dropFirst() { outline.addLine(to: pt(p.x, p.y)) }
                    outline.closeSubpath()
                    context.stroke(
                        outline, with: .color(Brand.Plan.ink),
                        style: StrokeStyle(lineWidth: band, lineCap: .butt, lineJoin: .miter))
                } else {
                    var walls = Path()
                    for s in plan.segments {
                        walls.move(to: pt(s.x1, s.y1))
                        walls.addLine(to: pt(s.x2, s.y2))
                    }
                    context.stroke(
                        walls, with: .color(Brand.Plan.ink),
                        style: StrokeStyle(lineWidth: band, lineCap: .round))
                }

                // **The damage, under the fixtures.** The owner, on build
                // 217, looking at the project grid: *"need affected area
                // here also."* Right — a card is a summary of the CLAIM, and
                // a claim's drawing without its shaded patch is a picture of
                // a building. Same renderer as the storey and the plan
                // editor, so one patch cannot be two colours in two places.
                //
                // Wall areas never arrive: the server drops them, because a
                // wall area's polygon is in its wall's own face space.
                for area in item.areas {
                    EditorChrome.drawArea(
                        polygon: area.polygon.map { CGPoint(x: $0.x, y: $0.y) },
                        tone: area.displayColor, context: context,
                        toScreen: { pt($0.x, $0.y) })
                }

                // The fixtures, in ink like everything else on a card.
                // Symbol only — no envelope box and no name at 130 points
                // across, where both would be noise. Below a few points of
                // width nothing is drawn at all, which is the same rule the
                // door arc below follows.
                // The SAME symbol the plan and the storey draw — his ask
                // that it be *"everywhere the same"*. The card was drawing
                // its own silhouette, which is how a thumbnail ends up
                // disagreeing with the drawing it is a thumbnail of.
                for object in item.objects {
                    let w = object.width * scale
                    let d = object.depth * scale
                    guard w >= 6, d >= 6 else { continue }
                    let centre = pt(object.x, object.y)

                    var box = Path()
                    let corners = ObjectCatalog.footprint(
                        width: object.width, depth: object.depth, rotation: object.rotation
                    ).map { pt(object.x + $0.x, object.y + $0.y) }
                    if let first = corners.first {
                        box.move(to: first)
                        for c in corners.dropFirst() { box.addLine(to: c) }
                        box.closeSubpath()
                    }
                    context.fill(box, with: .color(Brand.Plan.paper))
                    context.stroke(box, with: .color(Brand.Plan.ink), lineWidth: 0.8)

                    guard w >= 10, d >= 10,
                        let entry = ObjectCatalog.entry(slug: object.kind)
                    else { continue }
                    let symbol = context.resolve(
                        Text(Image(systemName: entry.glyph))
                            .font(.system(size: min(w, d) * 0.55))
                            .foregroundStyle(Brand.Plan.ink))
                    context.draw(symbol, at: centre, anchor: .center)
                }

                for opening in plan.openings {
                    let seg = opening.segment
                    let length = hypot(seg.x2 - seg.x1, seg.y2 - seg.y1)
                    guard length > 0.01 else { continue }

                    // Knock the gap out of the wall band first — a door is a
                    // hole, whatever is drawn in it afterwards.
                    var cut = Path()
                    cut.move(to: pt(seg.x1, seg.y1))
                    cut.addLine(to: pt(seg.x2, seg.y2))
                    context.stroke(
                        cut, with: .color(Brand.Plan.paper),
                        style: StrokeStyle(lineWidth: band + 1.2, lineCap: .butt))

                    // The swing arc, which is what makes a plan read as a
                    // plan. Skipped below a few points of width, where it
                    // would be a smudge rather than a symbol.
                    guard opening.kind == .door, length * scale >= 9 else { continue }
                    let ux = (seg.x2 - seg.x1) / length
                    let uy = (seg.y2 - seg.y1) / length
                    let nx = -uy, ny = ux
                    // Swing toward the room's own middle, so the leaf opens
                    // inward the way a draughtsman would draw it.
                    var cx = 0.0, cy = 0.0
                    for p in plan.polygon { cx += p.x; cy += p.y }
                    let count = Double(max(plan.polygon.count, 1))
                    cx /= count
                    cy /= count
                    let midX = (seg.x1 + seg.x2) / 2, midY = (seg.y1 + seg.y2) / 2
                    let side: Double = ((cx - midX) * nx + (cy - midY) * ny) >= 0 ? 1 : -1

                    let hinge = pt(seg.x1, seg.y1)
                    let tip = pt(seg.x1 + side * nx * length, seg.y1 + side * ny * length)
                    let latch = pt(seg.x2, seg.y2)

                    var leaf = Path()
                    leaf.move(to: hinge)
                    leaf.addLine(to: tip)
                    context.stroke(leaf, with: .color(Brand.Plan.ink), lineWidth: 0.8)

                    let r = hypot(tip.x - hinge.x, tip.y - hinge.y)
                    let a0 = Angle(radians: atan2(tip.y - hinge.y, tip.x - hinge.x))
                    let a1 = Angle(radians: atan2(latch.y - hinge.y, latch.x - hinge.x))
                    var delta = a1.radians - a0.radians
                    while delta > .pi { delta -= 2 * .pi }
                    while delta < -.pi { delta += 2 * .pi }
                    var arc = Path()
                    arc.addArc(
                        center: hinge, radius: r, startAngle: a0, endAngle: a1,
                        clockwise: delta < 0)
                    context.stroke(arc, with: .color(Brand.Plan.ink.opacity(0.7)), lineWidth: 0.6)
                }
            }
        }
    }

    /// The rooms to draw, with their placements — the whole storey when the
    /// server sent one, otherwise the single largest room, which is what
    /// this card drew before and what an older server still returns.
    private typealias Resolved = (
        plan: FloorPlanGeometry.Plan, planX: Double?, planY: Double?,
        objects: [ProjectSummary.CardObject], areas: [ProjectSummary.CardArea]
    )

    private var resolvedPlans: [Resolved] {
        if !floorRooms.isEmpty {
            let built = floorRooms.compactMap { room -> Resolved? in
                let plan = FloorPlanGeometry.plan(from: room.geometry)
                guard !plan.segments.isEmpty else { return nil }
                return (plan, room.planX, room.planY, room.objects, room.areas)
            }
            if !built.isEmpty { return built }
        }
        let plan = FloorPlanGeometry.plan(from: geometry)
        guard !plan.segments.isEmpty else { return [] }
        // The single-room fallback carries no fixtures and no damage: an
        // older server does not send them, and `largestRoom` never did.
        return [(plan, nil, nil, [], [])]
    }
}

/// The property address, with a real map of it.
///
/// MapKit renders and geocodes free on device — no key, no quota — so the
/// plate is the actual place rather than a drawn stand-in. Two targets, and
/// they are deliberately different actions: the MAP opens Apple Maps with
/// driving directions, because a crew looking at an address wants to leave;
/// the TEXT opens the editor, because anybody else looking at it wants to
/// correct a typo.
///
/// Geocoding is best-effort. It needs signal, it can fail on a half-typed
/// address, and a basement has neither — so a failure falls back to the
/// plain plate and the card keeps working. The address text is never gated
/// behind the lookup succeeding.
struct ProjectAddressCard: View {
    let lines: [String]
    /// The full one-line address to look up. Kept separate from `lines`
    /// because a geocoder wants "123 Rue X, Laval, H7N 1A1" in one string,
    /// while the card draws it in three.
    let query: String
    let onEdit: () -> Void

    @State private var coordinate: CLLocationCoordinate2D?

    var body: some View {
        Card(padding: Brand.Space.small) {
            HStack(spacing: Brand.Space.small) {
                mapPlate
                Button(action: onEdit) {
                    HStack(spacing: Brand.Space.small) {
                        VStack(alignment: .leading, spacing: 2) {
                            if lines.isEmpty {
                                Text("Address Line #1")
                                    .font(.system(size: 15))
                                    .foregroundStyle(Brand.inkFaint)
                                Text("City, State")
                                    .font(.system(size: 13))
                                    .foregroundStyle(Brand.inkFaint)
                                Text("Postal Code")
                                    .font(.system(size: 13))
                                    .foregroundStyle(Brand.inkFaint)
                            } else {
                                ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                                    Text(line)
                                        .font(.system(size: index == 0 ? 15 : 13,
                                                      weight: index == 0 ? .semibold : .regular))
                                        .foregroundStyle(index == 0 ? Brand.ink : Brand.inkSoft)
                                        .multilineTextAlignment(.leading)
                                }
                            }
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Brand.inkFaint)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .task(id: query) { await locate() }
    }

    @ViewBuilder private var mapPlate: some View {
        Group {
            if let coordinate {
                Button {
                    let item = MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
                    item.name = lines.first ?? "Property"
                    item.openInMaps(
                        launchOptions: [
                            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving
                        ])
                } label: {
                    Map(
                        initialPosition: .region(
                            MKCoordinateRegion(
                                center: coordinate,
                                latitudinalMeters: 350, longitudinalMeters: 350)),
                        interactionModes: []
                    ) {
                        Marker("", coordinate: coordinate).tint(Brand.blue)
                    }
                    .frame(width: 62, height: 52)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(alignment: .bottomTrailing) {
                        // Says the plate is a way out of the app, not just a
                        // picture — otherwise nobody discovers the tap.
                        Image(systemName: "arrow.triangle.turn.up.right.circle.fill")
                            .font(.system(size: 12))
                            .foregroundStyle(Brand.blue)
                            .background(Circle().fill(.white))
                            .padding(2)
                    }
                }
                .buttonStyle(.plain)
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 8).fill(Brand.Plan.floorMuted)
                    Image(systemName: "map")
                        .font(.system(size: 18))
                        .foregroundStyle(Brand.Plan.dimension.opacity(0.7))
                }
                .frame(width: 62, height: 52)
            }
        }
    }

    private func locate() async {
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else {
            coordinate = nil
            return
        }
        let found = try? await CLGeocoder().geocodeAddressString(query)
        coordinate = found?.first?.location?.coordinate
    }
}
