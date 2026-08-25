import RoomPlan
import SwiftUI

/// Where every room on a storey sits, in floor metres — shelf-packed for
/// whatever has no dragged position, honouring `planX`/`planY` for whatever
/// does.
///
/// Factored out of `LevelCanvas.layout` on 18 Aug 2026 so `StoreyCanvas`
/// (which needs the SAME placement to draw the floor a room is being
/// zoomed out of) calls the same function rather than a second copy that
/// can drift from this one. `internal`, not `private` — both live in this
/// module but different files.
enum StoreyPacking {
    struct Item {
        let id: String
        let width: Double
        let height: Double
        let planX: Double?
        let planY: Double?
    }
    struct Placed {
        let id: String
        var x: Double
        var y: Double
    }

    static func pack(_ items: [Item]) -> (placed: [Placed], width: Double, height: Double) {
        guard !items.isEmpty else { return ([], 0, 0) }

        let gap = 1.2
        var placed = items.map { Placed(id: $0.id, x: 0, y: 0) }

        // Pack the unplaced into rows aiming at a squarish sheet.
        let totalArea = items.reduce(0.0) { $0 + $1.width * $1.height }
        let widest = items.map(\.width).max() ?? 1
        let target = max(totalArea.squareRoot() * 1.4, widest)

        var x = 0.0
        var y = 0.0
        var rowHeight = 0.0
        for i in items.indices {
            if let px = items[i].planX, let py = items[i].planY {
                placed[i].x = px
                placed[i].y = py
                continue
            }
            if x > 0, x + items[i].width > target {
                x = 0
                y += rowHeight + gap
                rowHeight = 0
            }
            placed[i].x = x
            placed[i].y = y
            x += items[i].width + gap
            rowHeight = max(rowHeight, items[i].height)
        }

        // Re-base so dragged-negative rooms stay on the sheet.
        let minX = placed.map(\.x).min() ?? 0
        let minY = placed.map(\.y).min() ?? 0
        for i in placed.indices {
            placed[i].x -= minX
            placed[i].y -= minY
        }
        let width = zip(placed, items).map { $0.x + $1.width }.max() ?? 1
        let height = zip(placed, items).map { $0.y + $1.height }.max() ?? 1
        return (placed, width, height)
    }
}

/// A whole storey on one sheet — every room drawn to scale, tappable.
///
/// Placement comes from `plan_x`/`plan_y` where it exists: rooms scanned in
/// one capture visit are registered against each other by StructureBuilder
/// (`ScanSession.swift`) and arrive with true positions, and rooms the
/// operator dragged into place on the web keep those positions too. The
/// rest — manual entry, separately-scanned rooms — fall into tidy packed
/// rows, because RoomPlan measures each room from wherever the operator
/// stood and rooms from separate visits carry no true relative position.
/// Nothing is ever resized — a packed layout is arbitrary, the shapes are
/// measurements.
struct LevelCanvas: View {
    let rooms: [RoomScan]
    /// Rooms filed this visit that have no row to come back from the API yet —
    /// a scan held on a phone with no signal. The storey plan the operator
    /// lands on after Done (ORD-16) has to show the room he just walked, and
    /// a basement with the power off is a normal Tuesday on this trade, so a
    /// held room is drawn from the copy the capture flow still holds rather
    /// than left off the sheet until the phone finds a bar.
    var pending: [FiledRoom] = []
    /// Ids of rooms whose geometry did not survive the sanity pass. Drawn with
    /// a mark on the room itself, because a warning about a room belongs on
    /// the room (ORD-16), not on a card the operator already tapped past.
    var flagged: Set<String> = []
    /// Ids to draw the eye to — the rooms just measured. "Where is my scan
    /// after the scanning" is answered by the plan opening with the new room
    /// already picked out, not by making the operator find it.
    var spotlight: Set<String> = []
    /// **What is standing in each room, keyed by room id.**
    ///
    /// The owner, 23 Aug 2026: *"the illustration is only inside of the floor
    /// plan. It's not on the thumbnail, and it's not in the storey. I want to
    /// have it everywhere the same."* `EditorChrome.drawObject` even carries
    /// a `labelled: false` mode whose comment says "off at storey scale" —
    /// the drawing was ready for this canvas and this canvas never asked for
    /// it. It does now, so a storey plan is a drawing of a property rather
    /// than of empty rectangles.
    var objects: [String: [RoomObject]] = [:]
    /// The damaged regions, keyed by room id. Floor areas only: a wall
    /// area's polygon lives in its wall's own face space and would be drawn
    /// as nonsense on a plan. On a claim document this is the whole point of
    /// the drawing — the shaded patch is what the estimate's quantities are
    /// measured from.
    var areas: [String: [AffectedArea]] = [:]
    /// **A live turn of the whole storey, in radians.**
    ///
    /// Passed IN rather than owned here, because it belongs to whoever is
    /// running the gesture — this component's job is to draw a storey at an
    /// angle, not to decide what the angle is. Nil is upright.
    var turn: Double? = nil
    /// The drafting-paper grid behind the rooms (`editor-chrome-design.md` §2):
    /// fine dots, every fifth one a `+` crosshair. Off for the thumbnail on
    /// the project screen, where it would only be noise at that size.
    var grid: Bool = false
    /// Nil fills whatever height it is given — the full-storey sheet. The
    /// default keeps the project screen's thumbnail exactly as it was.
    var maxHeight: CGFloat? = 320
    /// Only meaningful alongside `pending`; a held room has no row to open.
    var onTapPending: ((FiledRoom) -> Void)? = nil
    /// Declared last so `LevelCanvas(rooms:) { … }` keeps binding its trailing
    /// closure here.
    let onTap: (RoomScan) -> Void

    /// One drawable room, whatever its provenance — a filed row or a scan
    /// still waiting to upload. The drawing is identical either way; only
    /// what a tap can open differs.
    private struct Piece {
        let id: String
        let name: String
        let areaSqm: Double
        let plan: FloorPlanGeometry.Plan
        let planX: Double?
        let planY: Double?
        let room: RoomScan?
        let filed: FiledRoom?
    }

    private struct Slot {
        let piece: Piece
        var x: Double
        var y: Double

        var plan: FloorPlanGeometry.Plan { piece.plan }
    }

    /// Shelf-packed slots, honouring dragged positions where they exist.
    private var layout: (slots: [Slot], width: Double, height: Double) {
        var pieces: [Piece] = []
        for room in rooms {
            guard let geometry = room.geometry else { continue }
            let plan = FloorPlanGeometry.plan(from: geometry)
            guard !plan.isEmpty else { continue }
            pieces.append(
                Piece(
                    id: room.id, name: room.name, areaSqm: room.floorAreaSqmTrusted, plan: plan,
                    planX: room.planX, planY: room.planY, room: room, filed: nil))
        }
        // A held room that has since landed arrives twice — once from the API,
        // once from the flow's own copy. The row wins; it is the same room.
        for item in pending where !rooms.contains(where: { $0.id == item.id }) {
            let plan = FloorPlanGeometry.plan(from: item.geometry)
            guard !plan.isEmpty else { continue }
            pieces.append(
                Piece(
                    id: item.id, name: item.name, areaSqm: item.floorAreaSqm, plan: plan,
                    planX: nil, planY: nil, room: nil, filed: item))
        }
        guard !pieces.isEmpty else { return ([], 0, 0) }

        let packed = StoreyPacking.pack(
            pieces.map {
                StoreyPacking.Item(
                    id: $0.id, width: $0.plan.width, height: $0.plan.height, planX: $0.planX,
                    planY: $0.planY)
            })
        let byID = Dictionary(uniqueKeysWithValues: packed.placed.map { ($0.id, $0) })
        let slots = pieces.map { piece in
            Slot(piece: piece, x: byID[piece.id]?.x ?? 0, y: byID[piece.id]?.y ?? 0)
        }
        return (slots, packed.width, packed.height)
    }

    var body: some View {
        let layout = self.layout
        if layout.slots.isEmpty {
            EmptyView()
        } else {
            GeometryReader { proxy in
                // Proportional, not flat. A flat 10pt border reads fine on
                // the 320pt-tall card this was built for, but the SAME 10pt
                // on a tight 62pt tile (`FloorPlanTile`, added 18 Aug) is
                // most of nothing — the room fills the tile edge to edge,
                // no paper visible around it. The owner's word for it:
                // "too zoomed in." 12% keeps a small tile breathing and
                // barely moves the 320pt case (10pt → ~38pt there).
                // 12% on a full sheet, but a hard floor of 4 rather than 8
                // on a thumbnail — on a 68pt tile, 8pt of padding each side
                // is a quarter of the height spent on margin, which is the
                // other half of "the plan is too small".
                let pad = max(4, min(proxy.size.width, proxy.size.height) * 0.12)

                // **Turn the sheet if the drawing fits better sideways.**
                //
                // The owner, 24 Aug 2026: *"on the storey make it bigger,
                // rotate to fit if needed."* A long narrow storey on a
                // portrait phone — his 2nd floor is 5 m by 11 — fits its
                // height and wastes both margins, and the plan comes out
                // small for no reason other than which way the paper
                // happens to be turned. A draughtsman turns the sheet.
                //
                // Measured, not assumed: the scale is computed both ways and
                // the drawing turns only when turning genuinely earns room.
                // The 1.15 threshold keeps a near-square plan from flipping
                // for a couple of percent, which would be disorienting every
                // time the storey opened.
                let free = CGSize(
                    width: max(1, proxy.size.width - pad * 2),
                    height: max(1, proxy.size.height - pad * 2))
                let upright = min(free.width / layout.width, free.height / layout.height)
                let turned = min(free.height / layout.width, free.width / layout.height)
                let rotate = turned > upright * 1.15
                // **Refit live while the storey is being turned.** The
                // drawing's UPRIGHT box is what `layout` reports; at an angle
                // its screen box is bigger — width·|cos| + height·|sin| — and
                // fitting the upright box would let the corners run off
                // exactly at 45°, where they stick out most. Recomputed every
                // frame from the live angle, which is what keeps the plan
                // framed through the whole gesture rather than only at the
                // ends of it.
                //
                // An expression, not an `if`: this is a ViewBuilder block,
                // where a bare statement is read as a view and a `()` is not
                // one.
                let scale: CGFloat = {
                    guard let angle = turn else { return rotate ? turned : upright }
                    let c = abs(cos(angle)), s = abs(sin(angle))
                    let spanX = layout.width * c + layout.height * s
                    let spanY = layout.width * s + layout.height * c
                    return min(free.width / spanX, free.height / spanY)
                }()

                // When turned, the drawing is laid out in a box of swapped
                // proportions and the whole canvas is rotated a quarter turn
                // at the end — so every coordinate below stays in the plan's
                // own space and nothing else in this canvas has to know.
                let boxWidth = rotate ? proxy.size.height : proxy.size.width
                let boxHeight = rotate ? proxy.size.width : proxy.size.height
                let ox = pad + (boxWidth - pad * 2 - layout.width * scale) / 2
                let oy = pad + (boxHeight - pad * 2 - layout.height * scale) / 2

                Canvas { context, canvasSize in
                    let ink = Brand.Plan.ink
                    let bg = Brand.Plan.paper

                    if grid {
                        EditorChrome.drawGrid(
                            context: context, size: canvasSize,
                            pitch: 15, dotRadius: 0.6, arm: 2.6)
                    }

                    for slot in layout.slots {
                        let isNew = spotlight.contains(slot.piece.id)
                        func pt(_ px: Double, _ py: Double) -> CGPoint {
                            CGPoint(
                                x: (slot.x + px) * scale + ox,
                                y: (slot.y + py) * scale + oy)
                        }

                        if slot.plan.polygon.count >= 3 {
                            var floor = Path()
                            floor.move(to: pt(slot.plan.polygon[0].x, slot.plan.polygon[0].y))
                            for p in slot.plan.polygon.dropFirst() { floor.addLine(to: pt(p.x, p.y)) }
                            floor.closeSubpath()
                            // The room just measured is white, the way the room
                            // you are inside is white in the editor
                            // (`editor-chrome-design.md` §2) — the others stay
                            // grey, UNLESS the operator gave this one its own
                            // colour (ORD-37), which then wins: a colour
                            // chosen on purpose says more than "not the one
                            // just scanned".
                            let fill: Color
                            if isNew {
                                fill = Brand.Plan.paper
                            } else if let custom = slot.piece.room?.displayColor {
                                fill = custom.opacity(0.35)
                            } else {
                                fill = Brand.Plan.floorMuted
                            }
                            context.fill(floor, with: .color(fill))
                            if isNew {
                                context.stroke(
                                    floor, with: .color(Brand.blue.opacity(0.55)),
                                    style: StrokeStyle(lineWidth: 1.5))
                            }
                        }

                        // Sheet level-of-detail: solid bands and honest gaps —
                        // the spec's thumbnail tier, because six rooms on a
                        // phone width leave no room for symbols.
                        let band = max(2, 0.114 * scale)
                        var walls = Path()
                        for s in slot.plan.segments {
                            walls.move(to: pt(s.x1, s.y1))
                            walls.addLine(to: pt(s.x2, s.y2))
                        }
                        context.stroke(
                            walls, with: .color(ink),
                            style: StrokeStyle(lineWidth: band, lineCap: .square))

                        for opening in slot.plan.openings {
                            var cut = Path()
                            cut.move(to: pt(opening.segment.x1, opening.segment.y1))
                            cut.addLine(to: pt(opening.segment.x2, opening.segment.y2))
                            context.stroke(
                                cut, with: .color(bg),
                                style: StrokeStyle(lineWidth: band + 1.5, lineCap: .butt))
                        }

                        // **The damage, under the furniture.** A shaded patch
                        // is what the estimate's quantities are measured
                        // from, and a drawing that omits it leaves a figure
                        // an adjuster cannot point at. Drawn before the
                        // objects so a vanity standing in a wet patch still
                        // reads as a vanity.
                        for area in areas[slot.piece.id] ?? [] where area.surface != "wall" {
                            EditorChrome.drawArea(
                                polygon: area.polygon.map { CGPoint(x: $0.x, y: $0.y) },
                                tone: area.displayColor, context: context,
                                toScreen: { pt($0.x, $0.y) })
                        }

                        // **The furniture, at storey scale.** Unlabelled —
                        // the room's own name plate owns that space and a
                        // hundred-point room cannot carry both, which is
                        // exactly what `drawObject`'s own comment says.
                        for object in objects[slot.piece.id] ?? [] where object.included {
                            EditorChrome.drawObject(
                                object, context: context,
                                toScreen: { pt($0.x, $0.y) },
                                scale: scale, selected: false, labelled: false)
                        }

                        // Name + area, when the room plots big enough to hold
                        // them.
                        let plotWidth = slot.plan.width * scale

                        // A warning belongs on the room it is about (ORD-16).
                        // Drawn inside the room's own top-left corner, so it
                        // travels with the shape however the sheet is packed.
                        if flagged.contains(slot.piece.id), plotWidth >= 40 {
                            let mark = context.resolve(
                                Text(Image(systemName: "exclamationmark.triangle.fill"))
                                    .font(.system(size: 11))
                                    .foregroundStyle(Color.orange))
                            let corner = pt(0, 0)
                            context.draw(
                                mark, at: CGPoint(x: corner.x + 10, y: corner.y + 10),
                                anchor: .center)
                        }

                        // 40, not 64: the label scales now, so a room that
                        // was too narrow for 14pt type is wide enough for
                        // the 8pt version of it.
                        if plotWidth >= 40 {
                            // The point deepest inside the room's own shape,
                            // not the bounding box's midpoint. The two agree
                            // on a plain rectangle, which is why this bug sat
                            // unnoticed — but an L-shaped room's bounding-box
                            // centre can land outside the room entirely,
                            // which reads as "the label isn't in the middle"
                            // because it genuinely is not.
                            let anchor = FloorPlanGeometry.labelAnchor(
                                slot.plan.polygon, width: slot.plan.width, height: slot.plan.height)
                            let centre = pt(anchor.x, anchor.y)
                            // **The type is sized to the DRAWING, not fixed.**
                            // Sized up on the owner's word on 18 Aug — 11/9
                            // was legible on a desk and not on a job site —
                            // but a fixed 14/11 then swallowed the tile on
                            // the project page's Floor Plans rail, where the
                            // whole storey is 60 points across: *"on this
                            // card the plan is too small and the writing is
                            // big, make it like magicplan."* Right, and the
                            // fault was fixing a size that has to work at
                            // 60pt and at 320. It is a fraction of the
                            // room's own drawn width now, clamped at both
                            // ends: 14 on the full sheet exactly as before,
                            // small enough on a thumbnail that the plan is
                            // what the card shows.
                            let nameSize = min(14, max(7, plotWidth * 0.13))
                            let areaSize = nameSize * 0.78
                            let name = context.resolve(
                                Text(slot.piece.name)
                                    .font(.system(size: nameSize, weight: .bold))
                                    .foregroundStyle(Brand.Plan.label))
                            let sqft = context.resolve(
                                Text(Measure.sqftLabel(slot.piece.areaSqm))
                                    .font(.system(size: areaSize, weight: .medium))
                                    .foregroundStyle(Brand.Plan.labelSoft))
                            let box = name.measure(in: proxy.size)
                            let sqftBox = sqft.measure(in: proxy.size)
                            let plateWidth = max(box.width, sqftBox.width) + nameSize * 0.7
                            let plateHeight = nameSize + areaSize + nameSize * 0.8
                            // The knock-out plate only where the label would
                            // otherwise sit on the walls. On a thumbnail the
                            // type is small enough to read against the floor
                            // fill, and a plate there is a grey slab over
                            // the drawing — which is what the card was
                            // showing.
                            if nameSize >= 11 {
                                context.fill(
                                    Path(
                                        roundedRect: CGRect(
                                            x: centre.x - plateWidth / 2,
                                            y: centre.y - plateHeight / 2,
                                            width: plateWidth, height: plateHeight),
                                        cornerRadius: 4),
                                    with: .color(bg.opacity(0.8)))
                            }
                            context.draw(
                                name, at: CGPoint(x: centre.x, y: centre.y - areaSize * 0.62),
                                anchor: .center)
                            context.draw(
                                sqft, at: CGPoint(x: centre.x, y: centre.y + nameSize * 0.62),
                                anchor: .center)
                        }
                    }
                }
                // Laid out in the box the drawing was fitted to, then
                // turned as a whole. Everything above stays in plan space —
                // only these two lines know the sheet was rotated.
                .frame(width: boxWidth, height: boxHeight)
                // The sheet's own quarter turn (fit), then the storey's live
                // turn (the gesture) on top of it. Two rotations rather than
                // one sum, because they mean different things: the first is
                // how the paper is oriented, the second is how the building
                // is drawn on it.
                .rotationEffect(.degrees(rotate ? 90 : 0))
                .rotationEffect(.radians(turn ?? 0))
                .frame(width: proxy.size.width, height: proxy.size.height)
                .contentShape(.rect)
                .onTapGesture { location in
                    // Hit-test in plan space; first slot whose box contains
                    // the tap wins. The tap arrives in the ROTATED frame, so
                    // it is turned back before it is asked about rooms —
                    // without this, tapping a room on a turned sheet opens
                    // whichever room happens to sit at the mirrored spot.
                    let local =
                        rotate
                        ? CGPoint(x: location.y, y: proxy.size.width - location.x)
                        : location
                    let px = (local.x - ox) / scale
                    let py = (local.y - oy) / scale
                    if let hit = layout.slots.first(where: { slot in
                        px >= slot.x && px <= slot.x + slot.plan.width && py >= slot.y
                            && py <= slot.y + slot.plan.height
                    }) {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        if let room = hit.piece.room {
                            onTap(room)
                        } else if let filed = hit.piece.filed {
                            onTapPending?(filed)
                        }
                    }
                }
            }
            .modifier(PlanSheetSizing(aspect: layout.width / layout.height, maxHeight: maxHeight))
        }
    }

    /// The drafting-paper grid: fine dots on a regular pitch, every fifth one
    /// replaced by a slightly larger, slightly more saturated `+` crosshair
    /// (`editor-chrome-design.md` §2). The crosshairs are the whole character
    /// of it — a plain dot field reads as a placeholder texture.
}

/// Two sizings for one drawing: the project screen's thumbnail keeps its
/// shape and its 320pt ceiling, the full-storey sheet fills what it is given.
private struct PlanSheetSizing: ViewModifier {
    let aspect: Double
    let maxHeight: CGFloat?

    func body(content: Content) -> some View {
        if let maxHeight {
            content
                .aspectRatio(CGFloat(max(aspect, 0.1)), contentMode: .fit)
                .frame(maxHeight: maxHeight)
        } else {
            content.frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

/// A room filed during a capture visit, carried straight to the plan the
/// operator lands on (ORD-16).
///
/// A scan that went up has a row and comes back from the API like any other.
/// A scan held offline has none — and the plan the owner asked to see must
/// still show the room he just walked, so the flow hands over its own copy
/// and the canvas draws it the same.
struct FiledRoom: Identifiable, Hashable {
    /// The server row id where there is one, otherwise a local id that exists
    /// only to keep the room distinct on this sheet.
    let id: String
    let name: String
    let level: String
    let floorAreaSqm: Double
    let geometry: ScanGeometry
    /// True while the scan is still on the phone waiting for a connection.
    let held: Bool

    static func == (a: FiledRoom, b: FiledRoom) -> Bool { a.id == b.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

/// What counts as living area on this property, and why.
///
/// The totals AND the working. A living-area figure with no breakdown is one
/// an adjuster has to take on faith, and they will not — so every room that
/// contributed nothing says why it contributed nothing, right there.
struct LivingAreaCard: View {
    let projectId: String

    @State private var result: LivingAreaResponse?
    @State private var expanded = false
    @State private var showDefinition = false

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Brand.Space.small) {
                Button {
                    showDefinition = true
                } label: {
                    HStack(spacing: 4) {
                        Text("LIVING AREA")
                            .font(.system(size: 10, weight: .heavy))
                            .tracking(0.3)
                        Image(systemName: "info.circle").font(.system(size: 9))
                    }
                    .foregroundStyle(Brand.inkFaint)
                }
                .buttonStyle(.plain)

                if let totals = result?.totals {
                    HStack(alignment: .firstTextBaseline, spacing: Brand.Space.base) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(Measure.sqftLabel(totals.aboveGradeSqm))
                                .font(.system(size: 22, weight: .bold, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(Brand.ink)
                            Text("above grade")
                                .font(.system(size: 11))
                                .foregroundStyle(Brand.inkFaint)
                        }

                        if totals.belowGradeSqm > 0 {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(Measure.sqftLabel(totals.belowGradeSqm))
                                    .font(.system(size: 17, weight: .semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(Brand.inkSoft)
                                Text("below grade")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Brand.inkFaint)
                            }
                        }
                        Spacer()
                    }

                    // Kept separate and never summed into the headline: a
                    // figure that silently includes a basement is the most
                    // common way a living-area number gets challenged.
                    if totals.excludedSqm > 0 {
                        Text("\(Measure.sqftLabel(totals.excludedSqm)) measured but not counted")
                            .font(.system(size: 11))
                            .foregroundStyle(.orange)
                    }

                    Button {
                        expanded.toggle()
                    } label: {
                        Text(expanded ? "Hide the working" : "Show the working")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Brand.blue)
                    }
                    .buttonStyle(.plain)

                    if expanded {
                        VStack(spacing: 5) {
                            ForEach(totals.rooms) { room in
                                HStack(spacing: Brand.Space.tight) {
                                    Text(room.name)
                                        .font(.system(size: 12))
                                        .foregroundStyle(Brand.ink)
                                        .lineLimit(1)
                                    Spacer()
                                    if room.belowMinHeight {
                                        Text("ceiling under 7 ft")
                                            .font(.system(size: 10))
                                            .foregroundStyle(.orange)
                                    } else if room.band == "excluded" {
                                        Text("not living area")
                                            .font(.system(size: 10))
                                            .foregroundStyle(Brand.inkFaint)
                                    } else if room.percentApplied != 100 {
                                        Text("\(Int(room.percentApplied))%")
                                            .font(.system(size: 10))
                                            .foregroundStyle(Brand.inkFaint)
                                    }
                                    Text(Measure.sqftLabel(room.countedSqm))
                                        .font(.system(size: 12, weight: .semibold))
                                        .monospacedDigit()
                                        .foregroundStyle(
                                            room.countedSqm > 0 ? Brand.ink : Brand.inkFaint)
                                }
                            }
                        }
                        .padding(.top, 2)
                    }
                } else {
                    Text("Measure some rooms and set their types to see this.")
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.inkSoft)
                }
            }
        }
        .task {
            result = try? await API.shared.livingArea(projectId: projectId)
        }
        .popover(isPresented: $showDefinition) {
            VStack(alignment: .leading, spacing: Brand.Space.small) {
                Text("Living area")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Brand.ink)
                Text(result?.definition ?? "")
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(Brand.Space.base)
            .frame(width: 320)
            .presentationCompactAdaptation(.popover)
        }
    }
}

/// The storey, drawn — where a finished capture lands (ORD-16).
///
/// The owner's loudest complaint was *"where is my scan after the scanning, I
/// need to see it right away"*: the flow used to end on a project list, so the
/// answer to "did that work?" was three taps away. Done now arrives here, on
/// the floor just scanned, with the new room picked out in white.
///
/// The warnings the review used to carry live here too, attached to the room
/// they are about. That is more than a move — recomputed from stored geometry
/// rather than remembered from the capture, they now cover every room on the
/// sheet, including ones scanned last week, and they survive being tapped past.
///
/// Chrome follows `editor-chrome-design.md` §1, §2 and §4 — the leading pill,
/// the dotted grid with its crosshairs, the grabber and the icon-above-label
/// tile. Every accent that would be system blue is `Brand.blue`.
struct StoreyPlanView: View {
    let projectId: String
    let projectName: String
    let level: String
    /// Rooms filed by the capture visit that led here. Held scans among them
    /// have no row yet and are drawn from this copy.
    let arrivals: [FiledRoom]

    @Environment(\.dismiss) private var dismiss

    @State private var scans: [RoomScan]?
    @State private var filed: [FiledRoom]
    @State private var openRoom: RoomScan?
    @State private var capturing = false
    @State private var showingHelp = false
    @State private var insertOpen = false
    @State private var addingPhoto = false
    @State private var showingFloorInfo = false
    @State private var error: String?

    init(projectId: String, projectName: String, level: String, arrivals: [FiledRoom]) {
        self.projectId = projectId
        self.projectName = projectName
        self.level = level
        self.arrivals = arrivals
        _filed = State(initialValue: arrivals)
    }

    private var rooms: [RoomScan] { (scans ?? []).filter { $0.level == level } }
    private var pending: [FiledRoom] { filed.filter { $0.level == level } }
    /// The rooms this visit produced — the sheet opens with these in white.
    private var spotlight: Set<String> { Set(filed.map(\.id)) }

    /// What the capture sanity pass makes of every room on this storey.
    ///
    /// Recomputed from geometry rather than carried over from the review,
    /// which is what lets an old room be flagged too. A drawn room is closed
    /// by construction and produces nothing, so it stays quiet.
    private var concerns: [Concern] {
        var out: [Concern] = []
        for room in rooms {
            guard let geometry = room.geometry else { continue }
            let problems = ReviewAnalysis(geometry: geometry).problems
            guard !problems.isEmpty else { continue }
            out.append(Concern(id: room.id, name: room.name, problems: problems, room: room))
        }
        for item in pending where !rooms.contains(where: { $0.id == item.id }) {
            let problems = ReviewAnalysis(geometry: item.geometry).problems
            guard !problems.isEmpty else { continue }
            out.append(Concern(id: item.id, name: item.name, problems: problems, room: nil))
        }
        return out
    }

    private struct Concern: Identifiable {
        let id: String
        let name: String
        let problems: [String]
        let room: RoomScan?
    }

    /// `Ground` is a storey id; `Ground Floor` is what it is called out loud.
    private var storeyTitle: String {
        ["Basement", "Attic"].contains(level) ? level : "\(level) Floor"
    }

    var body: some View {
        VStack(spacing: 0) {
            navBar

            ZStack {
                Brand.canvas

                if scans == nil {
                    ProgressView()
                } else if rooms.isEmpty && pending.isEmpty {
                    VStack(spacing: Brand.Space.tight) {
                        Text("Nothing drawn on this floor yet")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Brand.ink)
                        Text("Measure a room and it appears here, to scale.")
                            .font(.system(size: 13))
                            .foregroundStyle(Brand.inkSoft)
                    }
                } else {
                    LevelCanvas(
                        rooms: rooms,
                        pending: pending,
                        flagged: Set(concerns.map(\.id)),
                        spotlight: spotlight,
                        grid: true,
                        maxHeight: nil,
                        onTapPending: { _ in showingFloorInfo = true }
                    ) { room in
                        openRoom = room
                    }
                    .padding(Brand.Space.small)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            warningStrip
            actionBar
        }
        .background(Brand.canvas)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(item: $openRoom, onDismiss: { Task { await load() } }) { room in
            RoomDetailView(room: room).id(room.id)
        }
        .sheet(isPresented: $showingFloorInfo) {
            StoreyInfoSheet(
                storey: storeyTitle, rooms: rooms, pending: pending, concerns: concerns.count)
        }
        .sheet(isPresented: $capturing) {
            CaptureFlow(
                projectId: projectId,
                projectName: projectName,
                existingCount: (scans ?? []).count,
                existingNames: (scans ?? []).map(\.name),
                initialLevel: level,
                onSaved: { Task { await load() } },
                // Already standing on the plan: a finished capture reloads
                // this sheet rather than navigating anywhere new.
                onFinished: { _, arrived in
                    filed = arrived
                    Task { await load() }
                })
        }
        .task { await load() }
    }

    // MARK: - Nav bar (§1)

    private var navBar: some View {
        HStack(spacing: Brand.Space.small) {
            Button {
                dismiss()
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "chevron.left")
                    // The context glyph says what you would go back TO — at
                    // floor level, the storey switcher.
                    Image(systemName: "square.split.1x2")
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Brand.blue)
                .padding(.horizontal, 11)
                .padding(.vertical, 7)
                .background(Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.tile))
            }
            .buttonStyle(.plain)

            Spacer(minLength: 0)

            VStack(spacing: 1) {
                Text(storeyTitle)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Brand.ink)
                Text(projectName)
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.inkSoft)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            HStack(spacing: Brand.Space.small) {
                Button { showingHelp = true } label: {
                    Image(systemName: "questionmark.circle")
                }
                .buttonStyle(.plain)

                NavigationLink {
                    ReportShareView(projectId: projectId, projectName: projectName)
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .buttonStyle(.plain)
            }
            .font(.system(size: 17))
            .foregroundStyle(Brand.blue)
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.vertical, Brand.Space.small)
        .background(Brand.canvas)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Brand.hairline).frame(height: 0.5)
        }
        .popover(isPresented: $showingHelp) {
            VStack(alignment: .leading, spacing: Brand.Space.small) {
                Text("This floor, to scale")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Brand.ink)
                Text(
                    "Rooms measured in one visit sit where they sit in the building. Rooms measured on separate visits carry no relative position, so they are packed into rows — the shapes are still measurements, the arrangement is not. Tap a room to open it; an amber mark means the capture had a problem worth reading."
                )
                .font(.system(size: 14))
                .foregroundStyle(Brand.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
            }
            .padding(Brand.Space.base)
            .frame(width: 320)
            .presentationCompactAdaptation(.popover)
        }
    }

    // MARK: - The warnings, attached to their room (ORD-16)

    @ViewBuilder
    private var warningStrip: some View {
        if !concerns.isEmpty || pending.contains(where: \.held) || error != nil {
            ScrollView {
                VStack(alignment: .leading, spacing: Brand.Space.tight) {
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(.orange)
                    }

                    // Said here rather than left to be noticed: a room drawn on
                    // this sheet that has not reached the server yet is a fact
                    // the operator is entitled to before he drives away.
                    if pending.contains(where: \.held) {
                        let held = pending.filter(\.held).count
                        Text(
                            "^[\(held) room](inflect: true) on this floor is drawn from this phone and still waiting to upload. It sends itself as soon as there is a connection."
                        )
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.inkSoft)
                    }

                    ForEach(concerns) { concern in
                        Button {
                            if let room = concern.room { openRoom = room }
                        } label: {
                            HStack(alignment: .top, spacing: Brand.Space.tight) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.system(size: 11))
                                    .foregroundStyle(.orange)
                                    .padding(.top, 2)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(concern.name)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(Brand.ink)
                                    ForEach(concern.problems, id: \.self) { problem in
                                        Text(problem)
                                            .font(.system(size: 12))
                                            .foregroundStyle(Brand.inkSoft)
                                            .fixedSize(horizontal: false, vertical: true)
                                            .multilineTextAlignment(.leading)
                                    }
                                }
                                Spacer(minLength: 0)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Brand.Space.base)
                .padding(.vertical, Brand.Space.small)
            }
            .frame(maxHeight: 132)
            .background(Brand.surface)
            .overlay(alignment: .top) {
                Rectangle().fill(Brand.hairline).frame(height: 0.5)
            }
        }
    }

    // MARK: - Action bar (§4)

    private var actionBar: some View {
        VStack(spacing: Brand.Space.small) {
            Capsule()
                .fill(Brand.inkFaint.opacity(0.4))
                .frame(width: 36, height: 5)

            // One tile, the way §4 reduces the bar to a single `Insert` in
            // elevation. The floor-level pair in that table is Insert · Rotate
            // — both editor actions, and the editor is not this screen's to
            // build. What this screen can honestly do is take the next room.
            Button {
                capturing = true
            } label: {
                VStack(spacing: 4) {
                    Image(systemName: "camera.viewfinder")
                        .font(.system(size: 22))
                    Text("Add Room")
                        .font(.system(size: 13))
                }
                .foregroundStyle(Brand.blue)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Brand.Space.small)
                .background(Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.tile))
            }
            .buttonStyle(.plain)
            .frame(maxWidth: 210)

            Text("Swipe up ↑ for Floor info")
                .font(.system(size: 13))
                .foregroundStyle(Brand.inkFaint)
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.top, Brand.Space.small)
        .padding(.bottom, Brand.Space.tight)
        .frame(maxWidth: .infinity)
        .background(Brand.canvas)
        .contentShape(.rect)
        // The gesture the bar advertises, on the bar itself: attached to the
        // whole screen it would fight the canvas's tap and the warning
        // strip's scroll, and the grabber is what says "drag here" anyway.
        .gesture(
            DragGesture(minimumDistance: 20)
                .onEnded { drag in
                    if drag.translation.height < -30 { showingFloorInfo = true }
                }
        )
    }

    private func load() async {
        do {
            let loaded = try await API.shared.scans(projectId: projectId)
            scans = loaded
            // A held room that has since landed is the same room twice. Drop
            // the local copy once its row exists.
            filed = filed.filter { item in !loaded.contains { $0.id == item.id } }
            error = nil
        } catch {
            // The plan still draws — whatever this visit filed is in hand, and
            // that is the room the operator came here to look at.
            if scans == nil { scans = [] }
            self.error = "This floor could not be refreshed just now: \(error.localizedDescription)"
        }
    }
}

/// The storey's own figures — what the action bar's `Swipe up ↑` reaches.
private struct StoreyInfoSheet: View {
    let storey: String
    let rooms: [RoomScan]
    let pending: [FiledRoom]
    let concerns: Int

    @Environment(\.dismiss) private var dismiss

    private var floorAreaSqm: Double {
        // Split rather than one expression: with two reduces and a `+` the
        // type-checker gives up on the whole property.
        let filed: Double = rooms.reduce(0) { $0 + $1.floorAreaSqmTrusted }
        // A held room has no row yet, so it has only what the capture
        // measured — there is no stored column for it to disagree with.
        let held: Double = pending.reduce(0) { $0 + $1.floorAreaSqm }
        return filed + held
    }
    private var wallAreaSqm: Double {
        rooms.reduce(0) { $0 + $1.wallAreaGrossSqm }
    }

    /// Held rooms are included: a floor's footprint should not jump when a
    /// phone finds a bar. They carry an area and a perimeter like any other.
    private var surfaces: WallThickness.Surfaces {
        WallThickness.groundSurfaces(
            rooms: rooms.map { (floorAreaSqm: $0.floorAreaSqmTrusted, perimeterM: $0.wallLengthM) }
                + pending.map {
                    // A held room has no row to read a perimeter column from,
                    // but it carries the geometry the perimeter comes from.
                    (floorAreaSqm: $0.floorAreaSqm, perimeterM: $0.geometry.perimeterM)
                })
    }

    private func footprintFigure(_ label: String, _ sqm: Double) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("\(Int(Measure.squareFeet(sqm).rounded()))")
                .font(.system(size: 15, weight: .bold).monospacedDigit())
                .foregroundStyle(Brand.ink)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(Brand.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Brand.Space.base) {
                    StatBand(items: [
                        .init(
                            label: "Floor",
                            value: "\(Int(Measure.squareFeet(floorAreaSqm).rounded()))",
                            unit: "sq ft"),
                        .init(
                            label: "Walls",
                            value: "\(Int(Measure.squareFeet(wallAreaSqm).rounded()))",
                            unit: "sq ft"),
                        .init(label: "Rooms", value: "\(rooms.count + pending.count)"),
                    ])

                    if concerns > 0 {
                        Card {
                            Text(
                                "^[\(concerns) room](inflect: true) on this floor has a capture worth re-reading — the amber marks on the plan."
                            )
                            .font(.system(size: 13))
                            .foregroundStyle(.orange)
                        }
                    }

                    // The footprint including wall assemblies. Stated as
                    // derived from an assumed thickness, never as measured —
                    // the scan sees wall faces and cannot know what is inside
                    // them.
                    Card {
                        VStack(alignment: .leading, spacing: Brand.Space.tight) {
                            HStack {
                                Text("Footprint")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Brand.ink)
                                Spacer()
                                Text(WallThickness.Assembly.stud2x4.shortLabel)
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(Brand.inkFaint)
                            }
                            HStack(spacing: Brand.Space.base) {
                                footprintFigure("Clear floor", surfaces.withoutWalls)
                                footprintFigure("With partitions", surfaces.withInteriorWalls)
                                footprintFigure("With all walls", surfaces.withAllWalls)
                            }
                            Text(
                                "Computed from an assumed 2×4 partition and 2×6 exterior, not measured — a scan sees wall faces, not what is inside them. \"With all walls\" reads slightly under a true outside-face figure, because a room scanned on its own cannot tell an exterior wall from one it shares."
                            )
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                            .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    // Which definition produced the figure is the question an
                    // adjuster asks, so it is stated rather than assumed.
                    Card {
                        VStack(alignment: .leading, spacing: Brand.Space.tight) {
                            Text("Wall area on this floor is interior perimeter × ceiling height.")
                                .font(.system(size: 12))
                                .foregroundStyle(Brand.inkSoft)
                            Text(
                                "Rooms still waiting to upload count in the floor figure and not in the wall figure — a held room has no row to read a perimeter from yet."
                            )
                            .font(.system(size: 12))
                            .foregroundStyle(Brand.inkFaint)
                        }
                    }
                }
                .padding(Brand.Space.base)
            }
            .background(Brand.canvas)
            .navigationTitle("\(storey) info")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

/// A storey, as its own editing surface — the screen `Add Floor` lands on.
///
/// The reference opens a chosen floor onto an empty drafting canvas with a
/// single `+ Insert` at the foot, NOT straight into a room. That distinction
/// matters: the floor is a place things go, and until something is on it the
/// screen's whole job is to say so and offer the one verb that changes it.
///
/// Nothing here draws a new canvas. The grid is `EditorChrome.drawGrid`, the
/// bar is `EditorActionBar` at `.floor` depth (which §4 of
/// `editor-chrome-design.md` already defines as `Insert · Rotate`), the
/// rooms are `LevelCanvas`, and `Insert` opens the drawing flow that already
/// exists — `CaptureFlow` in `.draw` mode. The owner's correction, kept
/// here because it is the point: *"it is the same thing when we manually
/// create a room, we have that function already, just the placement is
/// wrong."*
struct FloorCanvasView: View {
    let projectId: String
    let projectName: String
    let level: String

    @Environment(\.dismiss) private var dismiss
    /// The storey chosen from the floors stepper. Held rather than pushed:
    /// switching floors REPLACES what this screen shows, so a stack of
    /// half-seen floors never builds up behind the back button.
    @State private var switched: String?
    @State private var scans: [RoomScan]?
    /// Degrees, this floor's own saved turn. 0 is upright and is also what a
    /// floor that has never been turned reads as — the two are the same
    /// fact. See migration 0043 and `commitTurn()`.
    @State private var floorDisplayAngle: Double = 0
    @State private var inserting = false
    @State private var dollhouse = false
    /// 3D was picked while the view-mode popover was still on screen; the
    /// cover presents once it has finished going down. Same one-at-a-time
    /// presentation rule the insert sheets already chain around.
    @State private var pending3D = false
    /// Which room's editor is MOUNTED — its whole lifecycle, entry fade-in
    /// through exit fade-out. Stays set a little past the moment the owner
    /// asks to leave, on purpose: see `exitFocusedRoom`.
    @State private var focusedRoomID: String?
    /// What the shared CAMERA is currently aimed at — nil for the whole
    /// floor. Set together with `focusedRoomID` on entry; cleared
    /// IMMEDIATELY on exit, which is what starts the zoom-out the instant
    /// the owner asks to leave, rather than waiting for the fade to finish
    /// first. Two states, not one, because the camera and the overlay's
    /// own mount lifecycle need to move on different clocks — full account
    /// on `exitFocusedRoom`.
    @State private var cameraFocusID: String?
    /// 0 at floor depth, 1 focused on `focusedRoomID` — the ONE thing
    /// `AnimatedStoreyViewport` also animates alongside `cameraBounds`, so
    /// the base layer's fade and the camera's zoom move on the same frame.
    @State private var focusProgress: CGFloat = 0
    /// Floor-depth's own pan and zoom, folded into the shared camera rather
    /// than layered on top of it as a second transform — panning IS moving
    /// the framed rectangle, zooming IS shrinking it. Restored 18 Aug 2026
    /// on the owner's word ("for moving, it needs to be one finger
    /// operation, and to zoom, it needs to be two finger operation") after
    /// the shared-canvas rewrite dropped them.
    ///
    /// `floorPanM` is in floor METRES, not screen points, so it stays
    /// meaningful across zoom levels. Both survive a trip into a room and
    /// back — `cameraBounds` simply ignores them while focused — so
    /// leaving a room returns to the framing you left, not to a reset one.
    @State private var floorZoom: CGFloat = 1
    @State private var floorPanM: CGSize = .zero
    /// Cumulative-to-incremental bookkeeping. `DragGesture`/
    /// `MagnificationGesture` both report totals since the gesture began;
    /// these hold the last total so each frame applies only its own delta.
    @State private var lastFloorDrag: CGSize = .zero
    @State private var lastFloorPinch: CGFloat = 1

    /// Arranging a floor by hand — the owner's ask of 19 Aug 2026: *"we
    /// should be able to hold on it, and it should allow us to move it
    /// around and turn it… we should be able to bring them together."*
    ///
    /// A lifted room is a room in the AIR: moved and turned freely, drawn
    /// where the finger has it, and written only when the gesture ends. It
    /// stays lifted after the finger comes up so it can then be twisted —
    /// a two-finger twist and a one-finger hold cannot be the same gesture.
    /// A tap anywhere sets it down.
    @State private var lifted: StoreyBaseLayer.LiftedRoom?
    @State private var guides: [StoreyArranging.Guide] = []
    /// The lifted room's offset when the CURRENT drag began — a room can be
    /// dragged more than once before it is set down, and `DragGesture`
    /// reports translation from its own start, not from the room's home.
    @State private var liftDragStart: CGSize = .zero
    /// True for the length of the press-and-drag that picks a room up, so
    /// the plain move gesture does not also claim the same finger and apply
    /// the travel twice.
    @State private var lifting = false
    /// How far the finger had already travelled when the hold completed, so
    /// the drift inside `maximumDistance` is not applied as a move.
    @State private var liftGrabTranslation: CGSize = .zero
    /// Where the finger currently is, and how far it has come — kept by the
    /// observing drag so the long press has somewhere to aim when it
    /// matures. `LongPressGesture` carries no location of its own.
    @State private var touchDown: CGPoint?
    @State private var touchTravel: CGSize = .zero
    /// Whether a wall was against a wall on the last frame, so the snap gets
    /// exactly one haptic rather than one per frame it stays snapped.
    @State private var wasFlush = false
    /// The angle from the lifted room's centre to the finger when a drag on
    /// the turn handle began — a turn is measured from there, so the room does
    /// not jump to meet the finger on the first frame.
    @State private var turnGrabAngle: Double?
    /// Aiming a merge: the lifted room wears a target and every room it
    /// touches wears an arrow pointing into it. Watched on the reference,
    /// 19 Aug 2026 — see `PlanEditing.mergeRooms`.
    @State private var merging = false

    // MARK: - Turning the storey (24 Aug 2026)
    //
    // **The reference's rotate, which is three things at once**, read off
    // the owner's four frames of it: the plan turns as ONE rigid body, the
    // view refits continuously so the drawing never leaves the screen, and
    // the angle snaps. His ask: *"when I turn, I want to see the grid, and I
    // want it to snap — forty-five degrees, ninety degrees, and so on."*
    //
    // The refit is not a nicety. A rectangle turned 45° needs about 1,4× the
    // upright room to hold it, so without refitting, the corners run off the
    // screen at exactly the angle the operator is watching most closely.

    /// Live angle while turning, in radians. Nil when not turning.
    @State private var turning: Double?
    /// Where the angle was when the drag began, so the gesture is relative.
    @State private var turnStart: Double = 0
    /// The last detent announced, so the haptic fires once per notch rather
    /// than on every frame inside it.
    @State private var lastDetent: Int?

    /// Every 45°, which is what he asked for: the four squares and the four
    /// diagonals. A drawing is almost always meant to sit on one of these,
    /// and the ones between are the exception rather than the rule.
    private static let turnDetent = Double.pi / 4
    /// How near a detent counts as on it. 6° is close enough to feel like a
    /// magnet and far enough that a deliberate 30° is still reachable.
    private static let turnSnapWindow = 6 * Double.pi / 180

    /// The angle a released turn lands on.
    static func snappedTurn(_ angle: Double) -> Double {
        let nearest = (angle / turnDetent).rounded() * turnDetent
        return abs(angle - nearest) <= turnSnapWindow ? nearest : angle
    }

    /// Which detent an angle is sitting in, for the haptic. Nil between them.
    static func turnDetentIndex(_ angle: Double) -> Int? {
        let nearest = (angle / turnDetent).rounded()
        return abs(angle - nearest * turnDetent) <= turnSnapWindow
            ? Int(nearest.truncatingRemainder(dividingBy: 8)) : nil
    }
    @State private var mergeError: String?
    @State private var showingFloorViewModes = false
    @State private var switchingFloor = false
    @State private var sharing = false
    @State private var showingHelp = false
    @State private var insertOpen = false
    @State private var addingPhoto = false
    @State private var floorInfo = false
    @State private var choosingMethod = false
    @State private var picked = false
    @State private var method: CaptureFlow.CaptureMode = .draw

    /// Which storey is on screen: the one navigated to, until the floors
    /// stepper picks another.
    private var showing: String { switched ?? level }

    private var rooms: [RoomScan] { (scans ?? []).filter { $0.level == showing } }

    /// Every count between the API and the scene, in one line.
    ///
    /// **Written unconditionally**, because the last two attempts at
    /// instrumenting this both put the readout inside the branch that only
    /// runs when there IS something to show — which is never the case being
    /// diagnosed. Three builds went by with the answer switched off in
    /// exactly the state that needed it.
    private var dollhouseDiagnosis: String {
        let onFloor = rooms
        let withGeometry = onFloor.filter { $0.geometry != nil }
        let levels = Set((scans ?? []).map(\.level)).sorted().joined(separator: ",")
        var out = "DOLLHOUSE-DATA: scans=\(scans?.count ?? -1) showing=\(showing) "
        out += "levelsPresent=[\(levels)] onFloor=\(onFloor.count) "
        out += "withGeometry=\(withGeometry.count) built=\(dollhouseRooms.count)\n"
        for room in withGeometry.prefix(10) {
            let plan = room.geometry.map { FloorPlanGeometry.plan(from: $0) }
            out += "DOLLHOUSE-DATA:   \(room.name) level=\(room.level) "
            out += "segments=\(plan?.segments.count ?? -1) "
            out += "polygon=\(plan?.polygon.count ?? -1) "
            out += "empty=\(plan?.isEmpty.description ?? "nil")\n"
        }
        return out
    }

    /// The storey, ready to stand up.
    ///
    /// **Placed by `StoreyPacking.pack`, which is the same call the 2D canvas
    /// makes.** A dollhouse that put a room somewhere the floor plan does not
    /// would be worse than no dollhouse — and this project has already paid
    /// once for two copies of one layout, when the phone and the report
    /// disagreed about a storey.
    /// **The storey's raw geometry, written out verbatim.**
    ///
    /// The owner, 24 Aug 2026, looking at a sample estimate drawn with
    /// invented rooms: *"now use a real plan from my app."* Fair — a demo
    /// drawn from a room nobody scanned proves the layout and nothing else.
    ///
    /// `ScanGeometry` is `Codable` and is EXACTLY what the web's `FloorPlan`
    /// takes, so a JSON dump of it here can be fed straight to the real
    /// renderer on the other side. No second format, no transcription: the
    /// same blob the server already stores, out through the same file
    /// `devicectl` can already fetch.
    ///
    /// Written once per storey open, and only ever read by a developer with
    /// the phone on a cable.
    private func exportGeometry(_ scans: [RoomScan]) {
        struct Export: Encodable {
            let id: String
            let name: String
            let level: String
            let ceilingHeightM: Double
            let planX: Double?
            let planY: Double?
            let geometry: ScanGeometry
        }
        let payload = scans.compactMap { scan -> Export? in
            guard let geometry = scan.geometry else { return nil }
            return Export(
                id: scan.id, name: scan.name, level: scan.level,
                ceilingHeightM: scan.ceilingHeightM,
                planX: scan.planX, planY: scan.planY, geometry: geometry)
        }
        guard !payload.isEmpty,
            let data = try? JSONEncoder().encode(payload),
            let json = String(data: data, encoding: .utf8)
        else { return }
        ScanLens.writeGeometryExport(json)
    }

    private var dollhouseRooms: [Dollhouse.Room] {
        let usable: [(room: RoomScan, plan: FloorPlanGeometry.Plan)] =
            rooms.compactMap { room in
                guard let geometry = room.geometry else { return nil }
                let plan = FloorPlanGeometry.plan(from: geometry)
                return plan.isEmpty ? nil : (room, plan)
            }
        guard !usable.isEmpty else { return [] }
        exportGeometry(usable.map(\.room))
        let packed = StoreyPacking.pack(
            usable.map {
                StoreyPacking.Item(
                    id: $0.room.id, width: $0.plan.width, height: $0.plan.height,
                    planX: $0.room.planX, planY: $0.room.planY)
            })
        let byID = Dictionary(uniqueKeysWithValues: packed.placed.map { ($0.id, $0) })
        return usable.map { room, plan in
            Dollhouse.Room(
                id: room.id, name: room.name, plan: plan,
                origin: CGPoint(x: byID[room.id]?.x ?? 0, y: byID[room.id]?.y ?? 0),
                ceilingHeight: room.ceilingHeightM,
                // `RoomScan` carries no colour of its own — the colour a room
                // shows on the 2D plan comes from its affected areas, not from
                // the room. So the slabs are neutral, and that is the honest
                // answer rather than inventing a field to tint them with.
                tint: nil,
                placed: roomObjects[room.id] ?? [])
        }
    }

    private var label: String {
        FloorVocabulary.levels.first { $0.id == showing }?.label ?? showing
    }

    /// Every room on this storey, placed in floor space — the SAME layout
    /// both the base layer and the camera's own floor-wide target read.
    ///
    /// CACHED, not computed. It was a plain `{ StoreyLayout(rooms) }`
    /// computed property at first, read three separate times in `body` —
    /// each read re-runs `FloorPlanGeometry.plan(from:)` for every room on
    /// the floor, from the raw scan geometry, including its own wall
    /// squaring and collinear alignment. Harmless at a glance, and wrong
    /// the instant `AnimatedStoreyViewport` is mid-transition: its
    /// `Animatable` conformance re-invokes `body` on every interpolated
    /// frame — some 18 of them across a 0.3s animation — so three fresh
    /// re-computations per frame is over fifty full re-derivations of the
    /// floor's geometry during ONE zoom. That is exactly what a dropped,
    /// stuttering frame rate looks like, and the owner's own word for the
    /// result was "jerky" — a real bug, not a description of what a
    /// correctly-timed animation looks like. Refreshed explicitly, on data
    /// changes only, via `refreshLayout()`.
    @State private var cachedLayout = StoreyLayout([])

    private func refreshLayout() {
        cachedLayout = StoreyLayout(rooms)
    }

    private var focusedRoom: RoomScan? {
        guard let focusedRoomID else { return nil }
        return rooms.first { $0.id == focusedRoomID }
    }

    /// What the storey's persisted turn rotates about — its own centre, the
    /// one value `StoreyViewport.pivot` and `cameraBounds` must agree on or
    /// the framing describes a different rectangle than the one being drawn.
    private var turnPivot: CGPoint {
        let box = cachedLayout.drawnBounds
        return CGPoint(x: box.midX, y: box.midY)
    }

    /// **The angle the storey is drawn at right now**, radians — what is
    /// saved, plus whatever the finger has added since Rotate was armed.
    ///
    /// ONE angle through ONE seam. The live turn used to be a
    /// `.rotationEffect` on the view while the saved turn went through
    /// `StoreyViewport` — two mechanisms for one idea, and they did not
    /// agree. The view transform span about the VIEW's centre, which the
    /// drawing is not centred on once the chrome strips are subtracted, so
    /// turning walked the plan up and to the left and off the screen; and
    /// the paper behind it, being a greedy `Color`, is bigger than the
    /// canvas, so it swung across the drawing as a white sheet. The owner
    /// described all of it exactly: *"it kind of goes up, and then it goes
    /// in the left, and then it gets hidden behind my screen. And then
    /// there is, like, some white thing that covers it."*
    ///
    /// Through the viewport there is nothing to anchor and nothing to
    /// refit: the camera frames an angle-independent square (`framed(_:)`),
    /// drawing is fitted into it, and a tap mid-turn maps back through the
    /// same rotation it was drawn with. Committing a turn changes which
    /// half of this sum carries the angle and nothing else, so the drawing
    /// does not move at the moment it is saved.
    private var liveAngle: Double {
        floorDisplayAngle * .pi / 180 + (turning ?? 0)
    }

    /// **A framing that does not depend on the angle — the turntable.**
    ///
    /// The owner, having watched three versions of this: *"I want it to be
    /// fixed in the center. And when I turn, it stays there, and just it
    /// turns on the canvas. I don't want the canvas to turn. I want the
    /// floor plan to turn on the canvas."*
    ///
    /// That rules out re-framing per angle, which is what the previous
    /// version did: it fitted the exact bounding box of the turned storey,
    /// so the box changed shape on every frame of a drag and the drawing
    /// swelled and shrank and slid inside it. Fitted tightly, yes — and
    /// never still.
    ///
    /// A SQUARE on the drawing's own diagonal, centred on it, is the same
    /// rectangle at every angle. The plan is then drawn at one scale, about
    /// one point, and simply turns: a record on a turntable rather than a
    /// photograph being re-cropped. It costs the difference between the
    /// diagonal and the long side — about 9% on his 5 × 11.17 m floor —
    /// and buys a drawing that holds still.
    private func framed(_ rect: CGRect) -> CGRect {
        let side = hypot(rect.width, rect.height)
        guard side > 0.05 else { return rect }
        return CGRect(
            x: rect.midX - side / 2, y: rect.midY - side / 2, width: side, height: side)
    }

    /// What the shared camera is CURRENTLY aimed at, in floor metres — the
    /// value `AnimatedStoreyViewport` animates. Driven by `cameraFocusID`,
    /// not `focusedRoomID`: see `exitFocusedRoom` for why the two clear on
    /// different clocks.
    private var cameraBounds: CGRect {
        guard let cameraFocusID, let storeyRoom = cachedLayout.room(id: cameraFocusID) else {
            return framed(adjustedFloorBounds)
        }
        // Framed with room outboard of the walls, because what the editor
        // draws is wider than the room: per-wall dimension lines, and since
        // ORD-23 an overall extent line outside those again. Fit the walls
        // alone and the outermost figure is off the edge of the canvas.
        //
        // Expressed as a FRACTION of the room rather than as a viewport
        // inset, and that is the whole point: `bounds` is the value
        // `AnimatedStoreyViewport` interpolates, so a margin expressed here
        // zooms continuously with everything else. An inset changed at the
        // moment focus is taken would step the base layer's scale on the
        // first frame of the transition — a pop, in the one animation this
        // app has already had rejected twice for not reading as one
        // continuous zoom.
        //
        // 0.22 each side is `EditorChrome.overallExtentRow` and its type
        // against a room filling a phone canvas; being proportional it
        // holds at any room size, since the scale adjusts with it.
        //
        // The frame is the WHOLE CONNECTED PLAN, not the one room — the
        // owner, 19 Aug 2026: *"when I touch on it, I should see the entire
        // floor plan getting activated."* A room joined to others is a part
        // of a building and framing it alone crops the building away. The
        // MARGIN stays proportional to the room being edited, though, not to
        // the plan: it exists to clear that room's own dimension lines, and
        // 0.22 of a six-room floor would push the room itself into the
        // middle distance.
        let bounds = storeyRoom.floorBounds
        let plan = cachedLayout.groupBounds(of: cameraFocusID) ?? bounds
        return framed(plan.insetBy(dx: -bounds.width * 0.22, dy: -bounds.height * 0.22))
    }

    /// The whole floor, moved and scaled by whatever the fingers have done
    /// at floor depth. Zooming IN frames a SMALLER rectangle, which is why
    /// this divides rather than multiplies.
    private var adjustedFloorBounds: CGRect {
        // What is DRAWN, not the rooms' own rectangle — see
        // `StoreyLayout.drawnBounds`. Framing the smaller one clips the
        // swing arcs upright and makes a turn look off-centre.
        let base = cachedLayout.drawnBounds
        let z = max(floorZoom, 0.01)
        let w = base.width / z
        let h = base.height / z
        return CGRect(
            x: base.midX + floorPanM.width - w / 2,
            y: base.midY + floorPanM.height - h / 2,
            width: w, height: h)
    }

    /// Chosen from the library at floor depth and waiting for the room it
    /// goes in. The owner asked for the library *"when clicking on the walls
    /// and on the floor itself"*; on the floor there is no room yet, so the
    /// choice is held here and the next room tap spends it.
    /// Every room's objects on this floor, keyed by room id — what
    /// `StoreyBaseLayer` draws so the storey shows fixtures, not bare boxes.
    @State private var roomObjects: [String: [RoomObject]] = [:]
    /// Every room's damaged areas on this floor, keyed by room id — what
    /// `StoreyBaseLayer` shades so the storey shows the damage.
    @State private var roomAreas: [String: [AffectedArea]] = [:]
    @State private var pendingLibraryItem: LibraryItem?
    @State private var choosingLibraryItem = false

    private static let roomTransitionDuration: Double = 0.3
    private static let roomTransitionAnimation: Animation = .easeInOut(duration: roomTransitionDuration)

    /// Tap a room on the floor — everything about entering it moves
    /// together, in one animated transaction: the camera zooms toward its
    /// bounds, the base layer's own grey rendering of it fades, and
    /// `RoomEditorCore` (mounted the instant `focusedRoomID` is set) fades
    /// its white, handled version in over the top.
    private func enterRoom(_ room: RoomScan) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        focusedRoomID = room.id
        withAnimation(Self.roomTransitionAnimation) {
            cameraFocusID = room.id
            focusProgress = 1
        }
    }

    /// The rest of the floor, in the focused room's own local metres — what
    /// `RoomEditorCore` draws greyed around the room being edited.
    ///
    /// EVERY other room on the storey, not just the connected ones. The
    /// camera frames the connected plan, so a room off on its own is
    /// normally outside the view anyway — but if the operator pans over to
    /// it, it should be there, and it should be tappable. Deciding what to
    /// DRAW by the same touching test that decides what to FRAME would make
    /// a room vanish the moment it was dragged a centimetre clear.
    private func neighbourOutlines(around room: RoomScan) -> [RoomEditorCore.Neighbour] {
        guard let focused = cachedLayout.room(id: room.id) else { return [] }
        return cachedLayout.rooms.compactMap { other in
            guard other.id != room.id else { return nil }
            var polygon = other.plan.polygon
            if polygon.count >= 4 { polygon.removeLast() }
            guard polygon.count >= 3 else { return nil }
            return RoomEditorCore.Neighbour(
                id: other.id,
                polygon: polygon.map {
                    CGPoint(
                        x: other.origin.x + $0.x - focused.origin.x,
                        y: other.origin.y + $0.y - focused.origin.y)
                })
        }
    }

    /// Move the rooms next door after a room's own outline changed.
    ///
    /// **His case, and his instinct was right:** *"let's say there is, like,
    /// three rooms and then the middle room we're trying to make it smaller.
    /// So I think in this case, it has to bring the other room with it."*
    /// The rooms were measured one at a time and pushed together; a middle
    /// room re-measured shorter really does bring the far end of the house
    /// closer. See `StoreyArranging.carry`.
    ///
    /// The edited room moves too, and that is not the same thing. Its stored
    /// polygon is re-based to its own corner on the way back out
    /// (`FloorPlanGeometry.plan(from:)`), so an edit that moved the outline's
    /// low corner would slide the room across the sheet unless its position
    /// takes the same step back. Both are worked out against ONE offset:
    /// before and after share the frame `origin - minBefore`.
    private func carryNeighbours(of roomId: String, from before: [CGPoint], to after: [CGPoint])
        async
    {
        guard let room = cachedLayout.room(id: roomId) else { return }
        let minBefore = StoreyArranging.bounds(before).origin
        let minAfter = StoreyArranging.bounds(after).origin
        let frame = CGPoint(x: room.origin.x - minBefore.x, y: room.origin.y - minBefore.y)
        func onFloor(_ polygon: [CGPoint]) -> [CGPoint] {
            polygon.map { CGPoint(x: frame.x + $0.x, y: frame.y + $0.y) }
        }

        let others = cachedLayout.rooms.filter { $0.id != roomId }
            .map { (id: $0.id, polygon: floorPolygon($0)) }
        let shifts = StoreyArranging.carry(
            edited: onFloor(before), to: onFloor(after), others: others)

        let ownShift = CGSize(
            width: minAfter.x - minBefore.x, height: minAfter.y - minBefore.y)
        let ownMoved = abs(ownShift.width) + abs(ownShift.height) > 0.001
        guard ownMoved || !shifts.isEmpty else { return }

        // Every room's position, for the same reason `commitPlacement` writes
        // them all: a floor that has been arranged by hand must stop being
        // re-packed, and a shifted room whose neighbours still have no stored
        // position would be re-packed away from it on the next load.
        for other in cachedLayout.rooms {
            var x = other.origin.x
            var y = other.origin.y
            if other.id == roomId {
                x += ownShift.width
                y += ownShift.height
            } else if let shift = shifts[other.id] {
                x += shift.width
                y += shift.height
            }
            let unchanged =
                other.room.planX != nil && other.room.planY != nil
                && abs((other.room.planX ?? 0) - x) < 0.005
                && abs((other.room.planY ?? 0) - y) < 0.005
            guard !unchanged else { continue }
            try? await API.shared.placeRoom(roomId: other.id, x: x, y: y)
        }
        await load()
    }

    /// Leave the focused room — tap outside it, discard, Save, Duplicate,
    /// Delete, all funnel here through `RoomEditorCore`'s own `onExit`.
    ///
    /// Two clocks, not one, and the split is deliberate. `cameraFocusID`
    /// clears NOW, so the shared viewport starts zooming back out to the
    /// whole floor the instant the owner asks to leave — waiting for
    /// anything else first would be exactly the lag that read as a jump
    /// before. `focusedRoomID` — which keeps `RoomEditorCore` MOUNTED, and
    /// tells the base layer which room to keep fading back in — clears
    /// only once the animation has actually finished: unmounting it
    /// immediately would cut its own fade-out to nothing, the same failure
    /// a plain `if/else` branch swap already had.
    private func exitFocusedRoom() {
        withAnimation(Self.roomTransitionAnimation) {
            cameraFocusID = nil
            focusProgress = 0
            // Zoom out to the WHOLE floor, centred — not back to whatever
            // pan and zoom the floor happened to be left at before the room
            // was opened. The owner, 18 Aug 2026: *"when I zoom in and I
            // move it, and then when I zoom out, it kind of jumps to the
            // previous position that story remembered. It doesn't really
            // zoom out and smoothly bring it to the center."*
            //
            // It was animating the whole way even then — but it was
            // animating toward a stale off-centre framing, so the END of an
            // otherwise smooth zoom landed somewhere unrelated to the room
            // just left, which reads as a jump however smoothly it got
            // there. Resetting INSIDE the same `withAnimation` means the
            // framing interpolates too, so the whole thing is one
            // continuous pull-back to the centred floor.
            floorPanM = .zero
            floorZoom = 1
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.roomTransitionDuration) {
            focusedRoomID = nil
        }
        // Objects are written the moment they are placed — they are rows,
        // not part of the geometry's Save — so leaving a room is exactly
        // when this floor's copy of them has gone stale. Without this the
        // storey kept drawing the objects it loaded when the screen opened,
        // which is the owner's report: place a toilet, step out, and the
        // storey shows a room with no toilet in it.
        // Areas go stale on the way out for exactly the same reason — they
        // are rows written the moment they are drawn, not part of the
        // geometry's Save — and the symptom would be his own report again:
        // mark a wet patch, step out, and the storey shows a dry room.
        Task {
            await loadObjects()
            await loadAreas()
        }
    }

    var body: some View {
        // ONE screen, ALWAYS. `StoreyBaseLayer` never unmounts once a floor
        // has rooms — it draws every room, at whatever the shared,
        // ANIMATED camera currently frames, from the whole storey down to
        // one room's own extent. `RoomEditorCore` mounts over the top only
        // once a room is focused, and fades in through the SAME camera —
        // both read `viewport` on the same frame, which is the one thing
        // that makes this a continuous zoom rather than two drawings
        // trading places. Full account on `StoreyViewport.swift`, written
        // the day the owner rejected a fade-based swap twice and said
        // plainly: "change the structure, make it like magic plan."
        GeometryReader { proxy in
            AnimatedStoreyViewport(
                bounds: cameraBounds, progress: focusProgress, canvasSize: proxy.size, inset: 28,
                chromeTop: Self.chromeTop, chromeBottom: Self.chromeBottom,
                angle: liveAngle, pivot: turnPivot
            ) { viewport, progress in
                ZStack {
                    Brand.Plan.paper.ignoresSafeArea()

                    // A FLOOR WITH NOTHING TO DRAW SAYS SO.
                    //
                    // `cachedLayout` holds only rooms that have geometry, so
                    // an empty layout with a non-empty floor means exactly
                    // one thing: the rooms are filed but none of them has an
                    // outline — typed areas, an import, a seed. The screen
                    // used to render that as blank paper, which is
                    // indistinguishable from a drawing that failed, and it is
                    // what the owner reported as *"there is nothing, just an
                    // empty card"*. He was right that it looked broken. It
                    // was not broken; it was silent.
                    //
                    // The floor-plan TILE has said this properly all along.
                    // The screen behind it did not, which is the same
                    // mistake in the other direction: two places showing one
                    // fact, one of them mute.
                    if cachedLayout.rooms.isEmpty, focusedRoomID == nil {
                        VStack(spacing: Brand.Space.tight) {
                            Image(systemName: "square.dashed")
                                .font(.system(size: 26))
                                .foregroundStyle(Brand.Plan.labelSoft)
                            Text(
                                rooms.isEmpty
                                    ? "Nothing drawn on this floor yet"
                                    : "\(rooms.count) room\(rooms.count == 1 ? "" : "s") here, none measured"
                            )
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Brand.ink)
                            Text(
                                rooms.isEmpty
                                    ? "Measure a room and it appears here, to scale."
                                    : "They have names and areas but no outline, so there is nothing to draw. Scan or draw one and it lands here."
                            )
                            .font(.system(size: 13))
                            .foregroundStyle(Brand.inkSoft)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, Brand.Space.large)
                        }
                    }

                    StoreyBaseLayer(
                        layout: cachedLayout, viewport: viewport, focusedRoomID: focusedRoomID,
                        focusProgress: progress, grid: true,
                        objects: roomObjects,
                        areas: roomAreas,
                        // **Arming Rotate has to LOOK like something.** The
                        // owner, on build 214: *"I click the rotate button
                        // and nothing happens."* Exactly so — the handle,
                        // its dashed ring, the direction arrow and the
                        // green-on-detent pin were all written and none of
                        // them had ever been drawn, because this argument
                        // was never passed and defaults to nil. Rotate arms
                        // a turn the finger then makes; without the handle
                        // there was nothing on screen to say so, and no
                        // reason to guess that dragging was the next move.
                        // It also keeps the room labels upright through the
                        // turn, which is the other thing this value is for.
                        turn: turning,
                        // Where it stood before this drag — the saved half
                        // of `liveAngle`, which is what the ghost shows.
                        ghostAngle: floorDisplayAngle * .pi / 180,
                        lifted: lifted, guides: guides,
                        mergeArrows: merging ? mergeArrowsToDraw : [],
                        // A tap while something is in the air SETS IT DOWN
                        // rather than opening a room. Opening a room on the
                        // tap that was meant to end an arrangement is how a
                        // careful layout gets lost behind a screen the
                        // operator did not ask for.
                        onTapRoom: { room in
                            if merging {
                                // Aiming: this tap names the room to absorb.
                                // Anything that is not a target sets the mode
                                // down rather than doing something else.
                                if mergeTargets.contains(where: { $0.id == room.id }) {
                                    Task { await mergeLifted(with: room.id) }
                                } else {
                                    withAnimation(.snappy(duration: 0.15)) { merging = false }
                                }
                            } else if lifted != nil {
                                setDown()
                            } else {
                                enterRoom(room)
                            }
                        },
                        onTapEmpty: {
                            if merging {
                                withAnimation(.snappy(duration: 0.15)) { merging = false }
                            } else {
                                setDown()
                            }
                        }
                    )
                    // No `.rotationEffect` and no `.scaleEffect` here any
                    // more: the live turn goes through `liveAngle` into the
                    // viewport, with the rest of the drawing. See its note.
                    // **The storey turns under the finger while Rotate is
                    // armed**, and it notches every 45°.
                    //
                    // The angle is taken from the finger's position about the
                    // screen's centre rather than from its horizontal travel:
                    // a turn should follow the hand around the drawing, and
                    // a sideways-swipe-means-degrees mapping stops making
                    // sense the moment the plan is past 90°.
                    //
                    // **While Rotate is armed the canvas is DEAD to
                    // everything else.** The owner: *"when we activate the
                    // rotation mode, I want the canvas to completely stop
                    // and ignore my gestures."*
                    //
                    // It was not: the floor pan, the pinch and the
                    // press-and-hold that lifts a room all stayed live
                    // underneath, so one drag turned the storey AND panned
                    // the sheet under it at the same time. Two transforms
                    // moving at once is unreadable, and it is a large part
                    // of why turning felt as though it wandered.
                    //
                    // Applied HERE, before the overlay below, so it takes
                    // the gestures attached above it and leaves the turn's
                    // own gesture — which is added after — working.
                    .allowsHitTesting(turning == nil)
                    .overlay {
                        if turning != nil {
                            GeometryReader { proxy in
                                let centre = CGPoint(
                                    x: proxy.size.width / 2, y: proxy.size.height / 2)
                                Color.clear
                                    .contentShape(.rect)
                                    .gesture(
                                        DragGesture(minimumDistance: 0)
                                            .onChanged { drag in
                                                let from = atan2(
                                                    drag.startLocation.y - centre.y,
                                                    drag.startLocation.x - centre.x)
                                                let to = atan2(
                                                    drag.location.y - centre.y,
                                                    drag.location.x - centre.x)
                                                let raw = turnStart + (to - from)
                                                let landed = Self.snappedTurn(raw)
                                                turning = landed
                                                // One tick per notch entered,
                                                // not one per frame inside it.
                                                let detent = Self.turnDetentIndex(landed)
                                                if detent != lastDetent {
                                                    if detent != nil {
                                                        UIImpactFeedbackGenerator(style: .light)
                                                            .impactOccurred()
                                                    }
                                                    lastDetent = detent
                                                }
                                            }
                                            .onEnded { _ in
                                                turnStart = turning ?? 0
                                            }
                                    )
                            }
                        }
                    }
                    // PRESS AND HOLD to pick a room up, then keep dragging
                    // in the same motion.
                    //
                    // TWO gestures side by side, and the split is the whole
                    // point. The drag only WATCHES — it records where the
                    // finger went down and how far it has come. The long
                    // press decides, on its `onEnded`, that the hold has
                    // been earned.
                    //
                    // Both halves are bugs the owner hit, one build apart.
                    //
                    // Build 160: `sequenced` publishes its second value only
                    // once the DRAG produces one, so a finger resting
                    // perfectly still — which is exactly what a long press
                    // IS — never lifted anything.
                    //
                    // Build 162, fixing that the wrong way: `LongPressGesture`
                    // reports `onChanged(true)` the instant the finger lands,
                    // not when the duration is met. `onChanged` means "the
                    // press began", and only `onEnded` means "the press
                    // succeeded". Reading the first as the second turned
                    // every tap into a lift, and his report was exact:
                    // *"when I tap on it, I expect it to go to the editor
                    // mode, but it doesn't. Instead it's giving me the mode
                    // to pull the room."*
                    .simultaneousGesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                touchDown = value.startLocation
                                touchTravel = value.translation
                                guard lifting else { return }
                                moveLifted(
                                    by: CGSize(
                                        width: value.translation.width - liftGrabTranslation.width,
                                        height: value.translation.height - liftGrabTranslation.height),
                                    viewport: viewport)
                            }
                            .onEnded { _ in
                                touchDown = nil
                                touchTravel = .zero
                                guard lifting else { return }
                                lifting = false
                                liftGrabTranslation = .zero
                                Task { await commitPlacement() }
                            }
                    )
                    .simultaneousGesture(
                        LongPressGesture(minimumDuration: 0.4, maximumDistance: 12)
                            .onEnded { _ in
                                guard focusedRoomID == nil, !lifting, let touchDown else { return }
                                pickUp(at: touchDown, viewport: viewport)
                                // Whatever the finger drifted DURING the hold
                                // is not a drag of the room.
                                liftGrabTranslation = touchTravel
                            }
                    )
                    // Dragging a room that is ALREADY in the air. Same
                    // arithmetic, different entry: once lifted it moves on
                    // a plain drag, with no second hold to sit through.
                    .simultaneousGesture(
                        DragGesture(minimumDistance: 4)
                            .onChanged { value in
                                guard !lifting, lifted != nil, focusedRoomID == nil
                                else { return }
                                // The turn handle first: it sits OUTSIDE the
                                // room's own box on a small room, so testing
                                // the box first would make it unreachable
                                // exactly where it is needed most.
                                if turnGrabAngle != nil
                                    || grabbedTurnHandle(value.startLocation, viewport: viewport)
                                {
                                    turnLiftedToward(value.location, viewport: viewport)
                                    return
                                }
                                guard startedOnLiftedRoom(value.startLocation, viewport: viewport)
                                else { return }
                                moveLifted(by: value.translation, viewport: viewport)
                            }
                            .onEnded { value in
                                guard !lifting, lifted != nil, focusedRoomID == nil else { return }
                                let turning = turnGrabAngle != nil
                                turnGrabAngle = nil
                                guard turning
                                    || startedOnLiftedRoom(value.startLocation, viewport: viewport)
                                else { return }
                                Task { await commitPlacement() }
                            }
                    )
                    // TWO FINGERS TWIST the lifted room. Free, then landed
                    // on something deliberate — see
                    // `StoreyArranging.snappedTwist`.
                    .simultaneousGesture(
                        RotateGesture(minimumAngleDelta: .degrees(2))
                            .onChanged { value in
                                guard lifted != nil, focusedRoomID == nil else { return }
                                twistLifted(by: value.rotation.radians)
                            }
                            .onEnded { _ in
                                guard lifted != nil else { return }
                                Task { await commitPlacement() }
                            }
                    )
                    // ONE finger moves the paper, TWO fingers zoom it —
                    // the owner's own instruction, and safe HERE in a way
                    // it is not inside a room: nothing on the floor is
                    // draggable, so a one-finger drag can only ever mean
                    // "move the sheet". (Inside a room the same gesture has
                    // to stay reserved for editing whatever is selected —
                    // see `RoomEditorCore.handleDrag`, which pans only when
                    // nothing is.)
                    //
                    // Deliberately NOT wrapped in `withAnimation`: these
                    // track the finger frame by frame and must land exactly
                    // where it is, not ease toward it. `minimumDistance: 8`
                    // leaves the base layer's own tap-to-enter intact.
                    .simultaneousGesture(
                        DragGesture(minimumDistance: 8)
                            .onChanged { value in
                                // A room in the air owns the one finger on
                                // the glass; moving the sheet under it as
                                // well would move both at once.
                                guard focusedRoomID == nil, lifted == nil, viewport.scale > 0
                                else { return }
                                let dx = value.translation.width - lastFloorDrag.width
                                let dy = value.translation.height - lastFloorDrag.height
                                lastFloorDrag = value.translation
                                // Through `modelVector`, so panning follows
                                // the finger on a turned storey instead of
                                // running off at the storey's own angle.
                                let step = viewport.modelVector(
                                    CGSize(width: dx, height: dy))
                                floorPanM.width -= step.width
                                floorPanM.height -= step.height
                            }
                            .onEnded { _ in lastFloorDrag = .zero }
                    )
                    .simultaneousGesture(
                        MagnificationGesture()
                            .onChanged { value in
                                // Two fingers TWIST a lifted room; they must
                                // not also zoom the sheet out from under it.
                                guard focusedRoomID == nil, lifted == nil, lastFloorPinch > 0
                                else { return }
                                let delta = value / lastFloorPinch
                                lastFloorPinch = value
                                floorZoom = min(max(floorZoom * delta, 0.4), 6)
                            }
                            .onEnded { _ in lastFloorPinch = 1 }
                    )
                    // Own gesture and own buttons both go quiet together —
                    // a tap meant for the canvas underneath must not also
                    // land on a floor-depth control mid-fade.
                    .allowsHitTesting(focusedRoomID == nil)

                    if let room = focusedRoom {
                        RoomEditorCore(
                            room: room,
                            onExit: { exitFocusedRoom() },
                            backContext: .floor,
                            externalViewport: viewport,
                            roomOrigin: cachedLayout.room(id: room.id)?.origin ?? .zero,
                            initialLibraryItem: pendingLibraryItem,
                            neighbours: neighbourOutlines(around: room),
                            siblingNames: rooms.map(\.name),
                            onSwitchRoom: { id in
                                guard let next = rooms.first(where: { $0.id == id }) else { return }
                                enterRoom(next)
                            },
                            onOutlineChanged: { before, after in
                                Task { await carryNeighbours(of: room.id, from: before, to: after) }
                            },
                            onSaved: { Task { await load() } }
                        )
                        // Spent the moment it is handed over — it is one
                        // placement, not a mode, and leaving it set would
                        // put a second toilet in the next room entered.
                        .onAppear { pendingLibraryItem = nil }
                        .id(room.id)
                        .opacity(progress)
                    }

                    // Floor-depth's own chrome — undo/redo (always
                    // disabled here; nothing to undo before a room is
                    // open), the floor stepper, Insert · Rotate. Stays
                    // MOUNTED through the whole transition so `1 - progress`
                    // can fade it, rather than an `if` popping it away on
                    // frame one while `RoomEditorCore`'s own chrome is
                    // still arriving.
                    floorChrome(label: label)
                        .alert(
                            "Could not merge those rooms",
                            isPresented: Binding(
                                get: { mergeError != nil }, set: { if !$0 { mergeError = nil } })
                        ) {
                            Button("OK", role: .cancel) { mergeError = nil }
                        } message: {
                            Text(mergeError ?? "")
                        }
                        .opacity(1 - progress)
                        .allowsHitTesting(focusedRoomID == nil)
                }
                // What `RoomEditorCore`'s canvas measures itself against to
                // find its own offset inside this screen — without it, its
                // drawing sits half an action bar higher than the base
                // layer's and the two visibly jump apart. See that view's
                // own `centre`.
                .coordinateSpace(name: RoomEditorCore.storeySpace)
            }
        }
        // Pinned once, here, for the whole screen — `RoomEditorCore`'s own
        // header says every host must do this ("a drawing is ink on paper
        // and paper does not invert"), and this IS its host now whenever a
        // room is focused. `Brand.Plan.*` is fixed hex either way, so this
        // is really about the CHROME around the drawing — the back-pill,
        // Save button, action bar labels — reading correctly if the phone
        // itself is in Dark Mode.
        .environment(\.colorScheme, .light)
        // The nav bar itself is NOT animated — `RoomEditorCore`'s own
        // toolbar (back-pill, title, help/save) simply IS the toolbar
        // once it is mounted, for as long as it is mounted, which lasts
        // through its own fade-out too. A lingering "Kitchen / 1st Floor"
        // title for the last fraction of a second of the exit animation
        // is the one seam this pass accepted rather than chasing further —
        // SwiftUI toolbar items do not fade with the view that declares
        // them, and splitting that timing from the mount lifecycle is a
        // second, separate piece of work.
        .navigationTitle(focusedRoomID == nil ? label : "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            if focusedRoomID == nil {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { showingHelp = true } label: {
                        Image(systemName: "questionmark.circle")
                    }
                    Button { sharing = true } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
        }
        .onChange(of: showingFloorViewModes) { _, open in
            guard !open, pending3D else { return }
            pending3D = false
            ScanLens.appendToDiagnostics("DOLLHOUSE-OPEN\n" + dollhouseDiagnosis)
            dollhouse = true
        }
        .fullScreenCover(isPresented: $dollhouse) {
            DollhouseScreen(
                title: showing, rooms: dollhouseRooms, roomsOnFloor: rooms.count,
                diagnosis: dollhouseDiagnosis,
                displayAngleRadians: floorDisplayAngle * .pi / 180)
        }
        .sheet(isPresented: $sharing) {
            // The same export sheet the project carries — one screen, two
            // ways in, rather than a second copy that drifts from it.
            ProjectExportSheet(
                projectId: projectId, projectName: projectName, onShowFiles: {})
        }
        .sheet(isPresented: $switchingFloor) {
            AddFloorSheet(existing: Set((scans ?? []).map(\.level))) { picked in
                switched = picked
                refreshLayout()
            }
        }
        .alert("Floor plan", isPresented: $showingHelp) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("This is the floor itself. Insert adds a room to it — start from a rectangle and pull it into shape. Tap a room once it is drawn to open its details.")
        }
        .sheet(
            isPresented: $choosingMethod,
            onDismiss: {
                // Raised by the chooser's dismissal for the same reason Add
                // Floor's is: SwiftUI will not put up a second sheet while
                // the first is still going down.
                if picked { inserting = true; picked = false }
            }
        ) {
            AddRoomMethodSheet { chosen in
                method = chosen
                picked = true
            }
        }
        .sheet(isPresented: $floorInfo) {
            FloorDetailView(level: showing, label: label, rooms: rooms)
        }
        .sheet(isPresented: $choosingLibraryItem) {
            ObjectLibraryPicker(context: .floor) { item in
                pendingLibraryItem = item
            }
        }
        .sheet(isPresented: $addingPhoto, onDismiss: { Task { await load() } }) {
            ProjectFileUploader(projectId: projectId) { Task { await load() } }
        }
        .sheet(isPresented: $inserting, onDismiss: { Task { await load() } }) {
            CaptureFlow(
                projectId: projectId,
                projectName: projectName,
                existingCount: (scans ?? []).count,
                existingNames: (scans ?? []).map(\.name),
                initialLevel: level,
                // Insert IS the mode choice on this screen, so the chooser
                // has nothing left to ask.
                initialMode: method,
                onSaved: { Task { await load() } },
                onFinished: { _, _ in })
        }
        .task { await load() }
    }

    /// Floor-depth's own controls — extracted unchanged from what used to
    /// be `floorContent`'s VStack, so `body` can fade the WHOLE thing with
    /// one `.opacity` rather than fading each piece separately.
    ///
    /// Free one-finger pan and pinch-zoom AT floor depth — real in the
    /// `if/else`-swap version this replaced — are gone for this pass. The
    /// camera is wholly the shared, animated one now, aimed at either the
    /// whole floor or one room; giving floor depth its OWN additional
    /// pan/zoom on top would mean composing a SECOND adjustment layer into
    /// `StoreyViewport`, on top of the one `RoomEditorCore`'s `zoom`/`pan`
    /// already compose in in `RoomEditorCore`, which is exactly the kind of
    /// scope this pass deliberately did not take on blind. A real,
    /// separate follow-up if a crowded floor needs it — flagged, not
    /// silently dropped.
    /// **What `floorChrome` below covers, in screen points.**
    ///
    /// The chrome floats OVER the canvas rather than sitting beside it, so
    /// the plan has to be fitted to what is left rather than to the whole
    /// screen — see `StoreyViewport.chromeTop`. These live here, next to
    /// the views that cause them, because that is where somebody changing
    /// the bar's height will be looking.
    ///
    /// Top: the undo/redo pill and the floor/2D steppers, a 44pt row plus
    /// its padding. Bottom: `EditorActionBar`, the "Swipe up ↑ for … info"
    /// caption under it, and the home indicator's own strip.
    ///
    /// Deliberately a little generous. Being 10pt shy puts a wall under a
    /// button, which is the complaint; being 10pt over costs 10pt of paper,
    /// which nobody has ever reported.
    private static let chromeTop: CGFloat = 60
    private static let chromeBottom: CGFloat = 140

    private func floorChrome(label: String) -> some View {
        VStack {
            HStack(alignment: .top) {
                EditorUndoRedoPill(
                    canUndo: false, canRedo: false, onUndo: {}, onRedo: {})
                Spacer()
                HStack(spacing: Brand.Space.tight) {
                    EditorStepperPill(action: { switchingFloor = true }) {
                        Image(systemName: "square.3.layers.3d")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Brand.ink)
                    }

                    // The 2D/3D stepper belongs at FLOOR depth too, not
                    // only inside a room — the owner's own reason, 18 Aug
                    // 2026: *"this is when we click 3D and we wanna see the
                    // entire house without going inside of a room."* That
                    // is the whole point of a storey-level 3D, and it is
                    // where the reference puts the control as well.
                    //
                    // **3D goes to the dollhouse now.** This greyed row is
                    // what the owner meant every time he said the 3D button
                    // was "not active" — it predates the dollhouse and sat
                    // saying "Not built yet" for five builds after that
                    // stopped being true, while a separate toolbar cube
                    // nobody was tapping got all the fixes. One control the
                    // hand already knows beats a second one it has to find.
                    // Elevation stays blocked for a different and permanent
                    // reason: an elevation is a WALL seen straight on, and
                    // a floor has no walls of its own — only rooms do.
                    EditorStepperPill(action: { showingFloorViewModes = true }) {
                        Text("2D")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Brand.ink)
                    }
                    .popover(isPresented: $showingFloorViewModes) {
                        EditorViewModeMenu(
                            current: .plan,
                            elevationBlocked: "Open a room — an elevation is one wall, seen straight on",
                            threeDBlocked: nil,
                            onPick: { picked in
                                showingFloorViewModes = false
                                // Not presented from HERE: a cover raised
                                // while the popover is still going down is
                                // dropped, the same SwiftUI rule the insert
                                // sheets below already chain around. The
                                // popover's collapse hands over via
                                // pending3D → onChange.
                                if picked == .threeD { pending3D = true }
                            })
                            .presentationCompactAdaptation(.popover)
                    }
                }
            }
            .padding(Brand.Space.base)
            Spacer()
            // The reference's Insert menu rises from the bar rather
            // than replacing the screen: what you are inserting INTO
            // stays visible behind it, which is the whole reason it is a
            // popover and not a push.
            VStack(spacing: 0) {
                // A choice waiting for its room. A mode with no visible
                // state is a mode nobody can leave, so it says what it is
                // waiting for and offers the way out.
                if let pendingLibraryItem {
                    HStack(spacing: Brand.Space.small) {
                        Text("Tap the room for the \(pendingLibraryItem.name.lowercased())")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                        Button("Cancel") { self.pendingLibraryItem = nil }
                            .font(.system(size: 14, weight: .semibold))
                            .tint(.white)
                    }
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.vertical, Brand.Space.small)
                    .background(Brand.blue, in: .capsule)
                    .padding(.bottom, Brand.Space.small)
                }

                // Aiming a merge. Same shape as the pill above and for the
                // same reason: the bullseye and the arrows say a choice is
                // being asked for, but not WHICH end of the arrow to press.
                // The owner sent a screenshot of exactly this state asking
                // what he was looking at.
                if merging {
                    HStack(spacing: Brand.Space.small) {
                        Text(
                            mergeTargets.count == 1
                                ? "Tap the room the arrow comes from"
                                : "Tap the room to merge in"
                        )
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        Button("Cancel") {
                            withAnimation(.snappy(duration: 0.15)) { merging = false }
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .tint(.white)
                    }
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.vertical, Brand.Space.small)
                    .background(Brand.blue, in: .capsule)
                    .padding(.bottom, Brand.Space.small)
                }

                if insertOpen {
                    insertMenu
                        .padding(.horizontal, Brand.Space.base)
                        .padding(.bottom, Brand.Space.small)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }
                EditorActionBar(
                    depth: .floor(name: label),
                    // Rotate earns its place only when there is something it
                    // is ALLOWED to turn — see `StoreyLayout.detachedRooms`
                    // and the owner's own rule recorded there. On a floor
                    // whose rooms are all joined up it stays dimmed, which
                    // is now a true statement about this floor rather than
                    // an unimplemented button.
                    supported: floorVerbs,
                    onAction: { action in
                        switch action {
                        case .insert:
                            withAnimation(.snappy(duration: 0.18)) { insertOpen.toggle() }
                        case .rotate:
                            // With a room in the air, Rotate is about THAT
                            // room — turning the whole floor while somebody
                            // is holding one piece of it is not what the
                            // button means any more.
                            if lifted != nil {
                                twistLifted(by: .pi / 2)
                                UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                                Task { await commitPlacement() }
                            } else if turning == nil {
                                // **Enter the turn**, rather than perform one.
                                // The reference's Rotate arms a handle and
                                // hands the angle to the finger; a button that
                                // jumps 90° cannot land on 45 and cannot be
                                // felt. Starting at the current angle means
                                // tapping it twice is a no-op rather than a
                                // surprise.
                                withAnimation(.snappy(duration: 0.2)) { turning = 0 }
                                lastDetent = 0
                                // **And the drag starts from zero.** The
                                // gesture computes `turnStart + delta`, and
                                // `turnStart` is left holding the last
                                // turn's angle when one is committed — so
                                // the SECOND time Rotate was armed, the
                                // first touch snapped the storey round by
                                // whatever it had been turned by before,
                                // without the finger having moved.
                                turnStart = 0
                                UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                            } else {
                                Task { await commitTurn() }
                            }
                        case .mergeRooms:
                            // A MODE, not an act — the reference's own
                            // shape, and the right one: merging destroys a
                            // room, so naming which one is a second,
                            // deliberate tap rather than a guess about
                            // which neighbour was meant.
                            withAnimation(.snappy(duration: 0.15)) { merging.toggle() }
                        default:
                            break
                        }
                    },
                    // Passing this is what draws the
                    // "Swipe up ↑ for … info" caption AND its gesture —
                    // the bar refuses to promise a swipe it cannot
                    // deliver, so the caption only appears with a
                    // handler behind it.
                    onInfo: { floorInfo = true })
            }
        }
        .ignoresSafeArea(edges: .bottom)
    }

    /// The reference's five, in its order. Two of them work here; three do
    /// not, and are drawn dimmed with the reason rather than left out — the
    /// owner tests this app by muscle memory, and a row that has moved is
    /// worse than a row that says "not yet".
    ///
    /// **Object** is doors and windows, which are placed against a WALL —
    /// there are no walls at floor depth, only rooms that have them. It
    /// belongs to the room editor, and S8 owns it.
    /// **Note** would be a note pinned on the plan; nothing stores one.
    /// **Form** needs the template builder that S-level work has not reached.
    @ViewBuilder private var insertMenu: some View {
        VStack(spacing: 0) {
            insertRow("Room", icon: "square.dashed", enabled: true) {
                choosingMethod = true
            }
            Divider()
            // Live since S8. At floor depth the library opens the same way
            // it does inside a room; what differs is only that the room is
            // named by the NEXT tap rather than already known.
            insertRow(
                "Object", icon: "bed.double", enabled: true,
                note: "Choose one, then tap the room"
            ) {
                choosingLibraryItem = true
            }
            Divider()
            insertRow("Note", icon: "note.text", enabled: false, note: "Not stored yet") {}
            Divider()
            insertRow("Photo", icon: "camera", enabled: true) {
                addingPhoto = true
            }
            Divider()
            insertRow("Form", icon: "list.clipboard", enabled: false, note: "No templates yet") {}
        }
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
        .shadow(color: .black.opacity(0.14), radius: 10, y: 4)
    }

    private func insertRow(
        _ title: String, icon: String, enabled: Bool, note: String? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            guard enabled else { return }
            withAnimation(.snappy(duration: 0.15)) { insertOpen = false }
            action()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 17))
                        .foregroundStyle(enabled ? Brand.ink : Brand.inkFaint)
                    if let note {
                        Text(note)
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                    }
                }
                Spacer()
                Image(systemName: icon)
                    .font(.system(size: 17))
                    .foregroundStyle(enabled ? Brand.ink : Brand.inkFaint)
            }
            .padding(.horizontal, Brand.Space.base)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }

    // MARK: - Arranging a floor by hand

    /// One room's outline in FLOOR metres, optionally as it would sit after
    /// a move and a turn — the only space in which two rooms can be compared.
    private func floorPolygon(_ room: StoreyRoom, offset: CGSize = .zero, angle: Double = 0)
        -> [CGPoint]
    {
        let pivot = StoreyArranging.centroid(room.plan.polygon)
        return StoreyArranging.rotate(room.plan.polygon, by: angle, about: pivot).map {
            CGPoint(x: room.origin.x + $0.x + offset.width, y: room.origin.y + $0.y + offset.height)
        }
    }

    /// Which room a point on the glass is over.
    private func room(at point: CGPoint, viewport: StoreyViewport) -> StoreyRoom? {
        let floor = viewport.model(point)
        return cachedLayout.rooms.first { room in
            floor.x >= room.origin.x && floor.x <= room.origin.x + room.plan.width
                && floor.y >= room.origin.y && floor.y <= room.origin.y + room.plan.height
        }
    }

    private func startedOnLiftedRoom(_ point: CGPoint, viewport: StoreyViewport) -> Bool {
        guard let lifted, let room = cachedLayout.room(id: lifted.id) else { return false }
        // The room's CURRENT box, offset included — after a drag it is not
        // where the layout still says it is.
        let box = StoreyArranging.bounds(
            floorPolygon(room, offset: lifted.offset, angle: lifted.angle))
        return box.insetBy(dx: -0.15, dy: -0.15).contains(viewport.model(point))
    }

    private func pickUp(at point: CGPoint, viewport: StoreyViewport) {
        guard let room = room(at: point, viewport: viewport) else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        lifted = StoreyBaseLayer.LiftedRoom(id: room.id)
        liftDragStart = .zero
        wasFlush = false
        lifting = true
    }

    /// Set the lifted room down. Nothing is saved here — every gesture
    /// already wrote when it ended, so setting down only ends the mode, and
    /// a room left in the air by a backgrounded app has still had its move
    /// recorded.
    private func setDown() {
        guard lifted != nil else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        // `lifting` too: a press-and-drag that is cancelled rather than ended
        // — a call arriving, the app backgrounded — leaves it set, and a
        // stuck `lifting` blocks the plain move gesture for good.
        lifting = false
        turnGrabAngle = nil
        withAnimation(.snappy(duration: 0.15)) {
            lifted = nil
            guides = []
        }
    }

    /// Follow the finger, then correct for whatever it came near.
    ///
    /// The tolerance is a fixed 14 SCREEN points converted to metres, so
    /// snapping has the same feel whether the whole storey is on screen or
    /// one room fills it — a fixed distance in metres would be unusable at
    /// one zoom and invisible at the other.
    private func moveLifted(by translation: CGSize, viewport: StoreyViewport) {
        guard var lift = lifted, viewport.scale > 0, let room = cachedLayout.room(id: lift.id)
        else { return }

        // `modelVector`, not a bare divide: on a turned storey the plan's
        // axes are not the screen's, and dividing alone sends a room off at
        // the storey's angle — reversed outright at 180°.
        let step = viewport.modelVector(translation)
        let free = CGSize(
            width: liftDragStart.width + step.width,
            height: liftDragStart.height + step.height)

        let moving = floorPolygon(room, offset: free, angle: lift.angle)
        let others = cachedLayout.rooms.filter { $0.id != lift.id }.map { floorPolygon($0) }
        let result = StoreyArranging.snap(
            moving: moving, others: others, tolerance: 14 / viewport.scale)

        lift.offset = CGSize(
            width: free.width + result.offset.width, height: free.height + result.offset.height)
        lifted = lift
        guides = result.guides

        // One tick when a wall lands on a wall, not one per frame it stays
        // there — a haptic that repeats reads as a stutter, not as contact.
        if result.flush, !wasFlush { UIImpactFeedbackGenerator(style: .rigid).impactOccurred() }
        wasFlush = result.flush
    }

    /// The floor bar's verbs. `Merge Rooms` appears only with a room in the
    /// air that actually touches another — a verb that cannot fire is worse
    /// than a verb that is not there.
    private var floorVerbs: Set<EditorAction> {
        var verbs: Set<EditorAction> = [.insert]
        if !rotatableRooms.isEmpty || lifted != nil { verbs.insert(.rotate) }
        if !mergeTargets.isEmpty { verbs.insert(.mergeRooms) }
        return verbs
    }

    /// The rooms the lifted one could be merged with: the ones it shares a
    /// wall with, and whose union is a shape we can actually write.
    private var mergeTargets: [StoreyRoom] {
        guard let lifted, let room = cachedLayout.room(id: lifted.id) else { return [] }
        // The room where the FINGER has it, not where it is stored. Waiting
        // for the save to land before offering the verb meant pushing two
        // rooms together and watching the bar stay dark for as long as the
        // network took — and for ever, on a phone with no signal.
        let mine = floorPolygon(room, offset: lifted.offset, angle: lifted.angle)
        return cachedLayout.rooms.filter { other in
            other.id != room.id
                && PlanEditing.mergeRooms(mine, floorPolygon(other)) != nil
        }
    }

    private var mergeArrowsToDraw: [StoreyBaseLayer.MergeArrow] {
        guard lifted != nil else { return [] }
        // `to` is unused: the layer already knows where the target room is,
        // and passing it twice is a second copy to drift.
        return mergeTargets.map { target in
            let pivot = StoreyArranging.centroid(target.plan.polygon)
            return StoreyBaseLayer.MergeArrow(
                id: target.id,
                from: CGPoint(x: target.origin.x + pivot.x, y: target.origin.y + pivot.y),
                to: .zero)
        }
    }

    /// Absorb one room into the lifted one.
    ///
    /// The LIFTED room survives — it is the one the operator picked up and
    /// aimed from, so it is the one they are thinking of as "the room". Its
    /// outline becomes the union, and the other row is removed.
    ///
    /// The union is written BEFORE the other room is deleted. If the write
    /// fails there are still two rooms and nothing is lost; deleting first
    /// and then failing would lose one outright.
    private func mergeLifted(with otherId: String) async {
        guard let lift = lifted, let room = cachedLayout.room(id: lift.id),
            let other = cachedLayout.room(id: otherId),
            let union = PlanEditing.mergeRooms(floorPolygon(room), floorPolygon(other))
        else { return }

        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
        let corner = StoreyArranging.bounds(union).origin
        let local = union.map { CGPoint(x: $0.x - corner.x, y: $0.y - corner.y) }

        do {
            // Locked lengths and authored openings are both keyed to edges
            // that no longer exist — the outline is a different shape with a
            // different number of walls. Openings are dropped rather than
            // guessed at; the operator is told.
            try await API.shared.saveEditedPlan(
                roomId: room.id, corners: local, locked: [], openings: [],
                ceilingHeight: room.room.ceilingHeightM)
            try await API.shared.placeRoom(roomId: room.id, x: corner.x, y: corner.y)
            try await API.shared.deleteScan(id: otherId)
        } catch {
            mergeError = error.localizedDescription
        }

        withAnimation(.snappy(duration: 0.15)) {
            merging = false
            lifted = nil
            guides = []
        }
        await load()
    }

    /// Where the lifted room's centre is on screen right now — what both
    /// handles are placed from.
    private func liftedCentre(_ viewport: StoreyViewport) -> CGPoint? {
        guard let lifted, let room = cachedLayout.room(id: lifted.id) else { return nil }
        let pivot = StoreyArranging.centroid(room.plan.polygon)
        return viewport.point(
            CGPoint(
                x: room.origin.x + pivot.x + lifted.offset.width,
                y: room.origin.y + pivot.y + lifted.offset.height))
    }

    /// Did this drag start on the turn handle? Records where the finger was
    /// so the turn is measured from there rather than snapping the room round
    /// to meet it.
    private func grabbedTurnHandle(_ point: CGPoint, viewport: StoreyViewport) -> Bool {
        guard let centre = liftedCentre(viewport) else { return false }
        let handle = StoreyBaseLayer.handlePoints(centre: centre).turn
        guard hypot(point.x - handle.x, point.y - handle.y) <= 26 else { return false }
        turnGrabAngle = atan2(point.y - centre.y, point.x - centre.x)
        return true
    }

    /// Turn the lifted room to follow one finger on the handle.
    private func turnLiftedToward(_ point: CGPoint, viewport: StoreyViewport) {
        guard let grabbed = turnGrabAngle, let centre = liftedCentre(viewport) else { return }
        twistLifted(by: atan2(point.y - centre.y, point.x - centre.x) - grabbed)
    }

    private func twistLifted(by radians: Double) {
        guard var lift = lifted, let room = cachedLayout.room(id: lift.id) else { return }
        let neighbours = StoreyArranging.wallAngles(
            cachedLayout.rooms.filter { $0.id != lift.id }.map { floorPolygon($0) })
        lift.angle = StoreyArranging.snappedTwist(
            baseAngle: StoreyArranging.longestWallAngle(room.plan.polygon),
            twist: radians, neighbourAngles: neighbours)
        lifted = lift
    }

    /// Write what the gesture just did.
    ///
    /// A TURN rewrites the room's own polygon, because a room has no stored
    /// angle — the same thing the floor-wide quarter-turn has always done.
    /// Which means the room's objects have to be turned with it: they are
    /// stored in the room's own plan metres, and a polygon that rotates
    /// while its toilet does not is a toilet standing in the garden.
    ///
    /// A MOVE writes `plan_x`/`plan_y` for EVERY room on the floor, not just
    /// the one that moved. The packer only auto-arranges rooms that have no
    /// stored position, so freezing them all is what stops the other rooms
    /// shuffling themselves the next time the floor loads — once a floor has
    /// been arranged by hand, it stays arranged.
    private func commitPlacement() async {
        guard let lift = lifted, let room = cachedLayout.room(id: lift.id) else { return }

        var originShift = CGSize.zero

        if abs(lift.angle) > 0.0005 {
            var corners = room.plan.polygon
            if corners.count >= 4 { corners.removeLast() }
            guard corners.count >= 3 else { return }

            let pivot = StoreyArranging.centroid(room.plan.polygon)
            let turned = StoreyArranging.rotate(corners, by: lift.angle, about: pivot)
            let before = StoreyArranging.bounds(corners).origin
            let after = StoreyArranging.bounds(turned).origin
            // Re-based to its own corner, the way `plan(from:)` will re-base
            // it on the way back out — and the room's position moves by the
            // same amount, so it turns where it stands instead of walking
            // sideways every time it is twisted.
            let placed = turned.map {
                PlanEditing.quantise(CGPoint(x: $0.x - after.x, y: $0.y - after.y))
            }
            originShift = CGSize(width: after.x - before.x, height: after.y - before.y)

            let openings = (room.room.geometry?.authoredOpenings ?? [])
                .compactMap(PlanEditing.WallOpening.init)
            // Openings are keyed to an EDGE INDEX, and locked lengths to the
            // same, so both ride the rotation untouched — the polygon turned,
            // its edges did not renumber.
            try? await API.shared.saveEditedPlan(
                roomId: room.id, corners: placed,
                locked: room.room.geometry?.lockedEdges ?? [],
                openings: openings,
                ceilingHeight: room.room.ceilingHeightM)

            let degrees = lift.angle * 180 / .pi
            let c = cos(lift.angle)
            let sn = sin(lift.angle)
            for object in roomObjects[room.id] ?? [] {
                let dx = object.x - pivot.x
                let dy = object.y - pivot.y
                let moved = CGPoint(
                    x: pivot.x + dx * c - dy * sn - after.x + before.x,
                    y: pivot.y + dx * sn + dy * c - after.y + before.y)
                try? await API.shared.updateObject(
                    id: object.id, at: moved, rotation: object.rotation + degrees)
            }
        }

        // Every room's position, so the packer stops rearranging the floor
        // under a layout somebody just made by hand.
        for other in cachedLayout.rooms {
            var x = other.origin.x
            var y = other.origin.y
            if other.id == lift.id {
                x += lift.offset.width + originShift.width
                y += lift.offset.height + originShift.height
            }
            let unchanged =
                other.room.planX != nil && other.room.planY != nil
                && abs((other.room.planX ?? 0) - x) < 0.005
                && abs((other.room.planY ?? 0) - y) < 0.005
            guard !unchanged else { continue }
            try? await API.shared.placeRoom(roomId: other.id, x: x, y: y)
        }

        // Reloaded and zeroed in ONE synchronous step. Clearing the offset
        // before the new layout arrives snaps the room back to where it
        // started for a frame; clearing it after a further await does the
        // same in the other direction.
        scans = (try? await API.shared.scans(projectId: projectId)) ?? []
        refreshLayout()
        lifted?.offset = .zero
        lifted?.angle = 0
        liftDragStart = .zero
        guides = []
        wasFlush = false
        await loadObjects()
    }

    /// Rooms a quarter-turn may move — detached ones only, per the owner's
    /// own rule. Read from the cached layout, so this costs nothing per
    /// frame the way recomputing the packing would.
    private var rotatableRooms: [StoreyRoom] {
        guard focusedRoomID == nil else { return [] }
        return cachedLayout.detachedRooms
    }

    // `turnAnchor` and `turnFitScale` lived here and are gone. Both existed
    // only to prop up the `.rotationEffect`/`.scaleEffect` pair that used to
    // draw the live turn: one to move the pivot off the view's centre, the
    // other to shrink the drawing so a turned storey still fitted. Routing
    // the live angle through `StoreyViewport` deletes the need for both —
    // the camera frames the turned box and the drawing is fitted into it, in
    // the same one place that already framed everything else.

    /// **Commit the turn the finger just made — one number, not a rewrite.**
    ///
    /// A storey's angle is a DISPLAY FACT, not a measurement. The rooms did
    /// not move, their walls did not change shape, nothing was measured
    /// differently — only the direction the sheet is being read from.
    ///
    /// This used to rotate every room's polygon and save it back through
    /// `saveEditedPlan`, the same call a corrected wall goes through, plus
    /// `placeRoom` for each position and `updateObject` for every fixture.
    /// That turned pristine RoomPlan scans into edited ones: a floor turned
    /// this way lost 26 auto-detected objects, and it could not be
    /// re-scanned to get them back. The angle now lives in its own row
    /// (migration 0043) and is applied in `StoreyViewport.point`/`.model`,
    /// so there is no longer any code path that CAN write a turn into a
    /// room's real geometry.
    ///
    /// The turn is cumulative — the live drag is a delta on whatever the
    /// storey is already at, which is what the preview `.rotationEffect`
    /// shows on top of the already-turned drawing.
    private func commitTurn() async {
        guard let angle = turning else { return }
        let snapped = Self.snappedTurn(angle)
        lastDetent = nil

        // **The angle changes hands without the drawing moving.**
        //
        // `liveAngle` is saved + live, so clearing `turning` before the
        // saved half has caught up drops the storey back to where it was,
        // and the round trip then puts it back — which is exactly what the
        // owner saw: *"it kind of comes back and then goes to the turned
        // position."* Moving both in ONE step keeps the sum, and therefore
        // the picture, unchanged at the moment of the commit.
        let settled = (floorDisplayAngle + snapped * 180 / .pi)
            .truncatingRemainder(dividingBy: 360)
        let previous = floorDisplayAngle
        floorDisplayAngle = settled
        turning = nil

        guard abs(snapped) > 0.001 else { return }
        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()

        do {
            try await API.shared.setFloorDisplayAngle(
                projectId: projectId, level: level, degrees: settled)
        } catch {
            // Put the drawing back to what is actually stored rather than
            // leaving it showing a turn the server never took. Silence here
            // is how a turn that failed looked exactly like one that worked.
            floorDisplayAngle = previous
            ScanLens.appendToDiagnostics(
                "STOREY-TURN: save FAILED level=\(level) degrees=\(settled) "
                    + String(describing: error).prefix(160))
            return
        }
        ScanLens.appendToDiagnostics(
            "STOREY-TURN: saved level=\(level) degrees=\(String(format: "%.1f", settled))")
    }

    private func load() async {
        scans = (try? await API.shared.scans(projectId: projectId)) ?? []
        floorDisplayAngle = (try? await API.shared.floorDisplayAngles(projectId: projectId))?[level] ?? 0
        refreshLayout()
        await loadObjects()
        await loadAreas()
    }

    /// Every room's objects, so the storey draws its fixtures too.
    ///
    /// One request per room, run concurrently. A floor-wide endpoint would
    /// be one request instead of eight, but it would also be a second query
    /// path to keep correct for a saving that does not show on a phone —
    /// these run in parallel and the rooms are already all in hand.
    private func loadObjects() async {
        let ids = (scans ?? []).map(\.id)
        guard !ids.isEmpty else { return }
        var found: [String: [RoomObject]] = [:]
        await withTaskGroup(of: (String, [RoomObject]).self) { group in
            for id in ids {
                group.addTask {
                    (id, (try? await API.shared.objects(roomScanId: id)) ?? [])
                }
            }
            for await (id, list) in group where !list.isEmpty { found[id] = list }
        }
        roomObjects = found
    }

    /// Every room's damaged areas, so the storey shows the damage and not
    /// just the walls around it.
    ///
    /// **It writes down what it got.** `try?` here would turn a 401, a
    /// decode mismatch and "this room genuinely has no damage" into the
    /// same empty dictionary, and the screen cannot tell those apart — the
    /// owner sees a dry room either way and reports "still not showing"
    /// with nothing to go on. §9d's rule, applied where it was missing:
    /// make the app write down what it built, then ask the file rather
    /// than the picture.
    private func loadAreas() async {
        let ids = (scans ?? []).map(\.id)
        guard !ids.isEmpty else { return }
        var found: [String: [AffectedArea]] = [:]
        var report = "STOREY-AREAS: level=\(level) rooms=\(ids.count)\n"
        await withTaskGroup(of: (String, [AffectedArea], String?).self) { group in
            for id in ids {
                group.addTask {
                    do {
                        return (id, try await API.shared.areas(roomScanId: id), nil)
                    } catch {
                        return (id, [], String(describing: error).prefix(160).description)
                    }
                }
            }
            for await (id, list, failure) in group {
                if !list.isEmpty { found[id] = list }
                let short = id.prefix(8)
                if let failure {
                    report += "STOREY-AREAS:   \(short) FAILED \(failure)\n"
                    continue
                }
                report += "STOREY-AREAS:   \(short) areas=\(list.count)"
                for area in list {
                    let xs = area.polygon.map(\.x), ys = area.polygon.map(\.y)
                    let box =
                        xs.isEmpty
                        ? "empty"
                        : String(
                            format: "x %.2f..%.2f y %.2f..%.2f",
                            xs.min() ?? 0, xs.max() ?? 0, ys.min() ?? 0, ys.max() ?? 0)
                    report += " [\(area.surface) pts=\(area.polygon.count) \(box)]"
                }
                report += "\n"
            }
        }
        roomAreas = found
        ScanLens.appendToDiagnostics(report)
    }
}

/// The reference's `Add Room` — choose how the room gets measured.
///
/// Insert → Room used to go straight to drawing. The reference asks first,
/// because the two real answers are genuinely different jobs: walk the room
/// with the phone, or draw it from the doorway. Both already exist here as
/// `CaptureFlow`'s two modes; this is the chooser they deserved.
///
/// THE LiDAR BADGE IS A REAL CHECK, not decoration: `RoomCaptureSession
/// .isSupported` is the same test the scan flow itself gates on. On a phone
/// without it the scan cards say so and cannot be tapped, rather than
/// offering a scan that would open to an error.
///
/// Three of the reference's five are not built and are drawn dimmed with
/// the reason. `Manual-Scan` is not a second scanner we are missing — Apple's
/// RoomPlan detects objects itself, and there is no manual-detection variant
/// to expose. `Draw Room` (place corner points one at a time) and
/// `Import & Draw` (trace over a photo of an existing plan) are real
/// features nobody has written yet.
struct AddRoomMethodSheet: View {
    let onPick: (CaptureFlow.CaptureMode) -> Void

    @Environment(\.dismiss) private var dismiss

    private var lidar: Bool { RoomCaptureSession.isSupported }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Brand.Space.base) {
                    HStack(spacing: Brand.Space.small) {
                        methodCard(
                            title: "Auto-Scan",
                            caption: "Walk the rooms with the phone. Objects found for you.",
                            art: .auto,
                            enabled: lidar
                        ) {
                            onPick(.scan)
                            dismiss()
                        }
                        methodCard(
                            title: "Manual-Scan",
                            caption: "RoomPlan detects objects itself — there is no manual variant.",
                            art: .manual,
                            enabled: false
                        ) {}
                    }

                    Card(padding: 0) {
                        methodRow(
                            title: "Add Square Room",
                            caption: "Start with a rectangle. Then pull it into shape.",
                            art: .square,
                            enabled: true
                        ) {
                            onPick(.draw)
                            dismiss()
                        }
                    }

                    Card(padding: 0) {
                        VStack(spacing: 0) {
                            methodRow(
                                title: "Draw Room",
                                caption: "Add corner points to build the room shape.",
                                art: .corners,
                                enabled: true
                            ) {
                                onPick(.drawCorners)
                                dismiss()
                            }
                            Divider().padding(.leading, 62)
                            methodRow(
                                title: "Import & Draw",
                                caption: "Trace over an image of an existing plan.",
                                art: .trace,
                                enabled: false
                            ) {}
                        }
                    }

                    if !lidar {
                        Text("This phone has no LiDAR, so scanning is unavailable. Drawing needs no camera and measures just as well when you have a tape.")
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                    }
                }
                .padding(Brand.Space.base)
            }
            .background(Brand.canvas)
            .navigationTitle("Add Room")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Brand.inkSoft)
                            .frame(width: 30, height: 30)
                            .background(Brand.surfaceRaised, in: Circle())
                    }
                }
            }
        }
    }

    private func methodCard(
        title: String, caption: String, art: ScanMethodArt.Kind, enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: { if enabled { action() } }) {
            VStack(alignment: .leading, spacing: Brand.Space.small) {
                ZStack(alignment: .topTrailing) {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Brand.Plan.floorMuted)
                        .frame(height: 92)
                        .overlay(ScanMethodArt(kind: art, enabled: enabled).padding(6))
                    Label("LiDAR", systemImage: "cube.transparent")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(
                            (enabled ? Brand.charcoalDark : Brand.inkFaint),
                            in: .rect(cornerRadius: 6))
                        .padding(6)
                }
                Text(title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(enabled ? Brand.ink : Brand.inkFaint)
                Text(caption)
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(Brand.Space.small)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }

    /// **A drawing of the method, not a system glyph.**
    ///
    /// These two rows carried `square.dashed` and `hand.draw` — SF Symbols
    /// standing in for the two manual ways to make a room. The owner, looking
    /// at this sheet: *"I don't like these icons here. They are, like, very,
    /// very basic."* He is right, and the reason is that a symbol names a
    /// method while a drawing SHOWS it: `square.dashed` says "square", where
    /// the drawing says "start from a rectangle and drag its corners out",
    /// which is the actual difference between this row and the one under it.
    private func methodRow(
        title: String, caption: String, art: ScanMethodArt.Kind, enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: { if enabled { action() } }) {
            HStack(spacing: Brand.Space.small) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Brand.Plan.floorMuted)
                    .frame(width: 52, height: 52)
                    .overlay(ScanMethodArt(kind: art, enabled: enabled).padding(4))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(enabled ? Brand.ink : Brand.inkFaint)
                    Text(caption)
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.inkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                if enabled {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Brand.inkFaint)
                }
            }
            .padding(Brand.Space.small)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

/// The floor's own inspector — the swipe-up from the Insert bar.
///
/// Same shell as the room's and the wall's: `Details · Photos & Notes ·
/// Forms`, header with a collapse chevron, two detents. `object-model.md`
/// §2c is the layout.
///
/// **Everything here is read-only, and that is a data fact rather than a
/// choice about screens.** The reference's floor sheet edits three things —
/// ceiling height, interior wall thickness, exterior wall thickness — and
/// names the floor. This app stores none of them PER FLOOR: a storey is a
/// string on `room_scans.level`, not a row, so there is nowhere to put a
/// floor's name or its own thickness override. The figures shown are
/// therefore derived from the rooms on the storey, and every one of them
/// says where it came from rather than pretending to be settable.
///
/// Making them editable is a migration (a `floors` table keyed by project +
/// level), not a screen — written up in S12.
struct FloorDetailView: View {
    let level: String
    let label: String
    let rooms: [RoomScan]

    @Environment(\.dismiss) private var dismiss
    @State private var detent: PresentationDetent = .medium
    @State private var tab = 0

    private var floorAreaSqm: Double { rooms.reduce(0) { $0 + $1.floorAreaSqmTrusted } }
    private var wallAreaSqm: Double {
        rooms.reduce(0) { $0 + $1.wallAreaGrossSqm }
    }
    private var volumeCuM: Double {
        rooms.reduce(0) { $0 + $1.floorAreaSqmTrusted * $1.ceilingHeightM }
    }
    /// The tallest room's, not an average: a storey's ceiling height is a
    /// property of the building, and averaging two rooms that disagree
    /// invents a height neither of them has.
    private var ceiling: Double { rooms.map(\.ceilingHeightM).max() ?? 0 }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack(spacing: Brand.Space.small) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 15))
                        .foregroundStyle(Brand.blue)
                    Text(label)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Brand.ink)
                    Spacer()
                    Button {
                        if detent == .large { detent = .medium } else { dismiss() }
                    } label: {
                        Image(systemName: "chevron.down")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Brand.inkSoft)
                    }
                    .buttonStyle(.plain)
                }
                .padding(Brand.Space.base)

                Picker("", selection: $tab) {
                    Text("Details").tag(0)
                    Text("Photos & Notes").tag(1)
                    Text("Forms").tag(2)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Brand.Space.base)

                Form {
                    switch tab {
                    case 0: detailsTab
                    case 1:
                        Section {
                            Text("A photo belongs to a room or to the job. A storey is not a row here, so there is nowhere to file one against.")
                                .font(.system(size: 12))
                                .foregroundStyle(Brand.inkSoft)
                        }
                    default:
                        InspectorFormsTab(
                            subject: "this floor",
                            footer: "Claim details live on the project; measurements live on each room.")
                    }
                }
            }
            .background(Brand.canvas)
            .navigationBarHidden(true)
        }
        .presentationDetents([.medium, .large], selection: $detent)
        .presentationBackgroundInteraction(.enabled(upThrough: .medium))
    }

    @ViewBuilder private var detailsTab: some View {
        Section("STATISTICS") {
            StatBand(items: [
                .init(
                    label: "Floor Area",
                    value: "\(Int(Measure.squareFeet(floorAreaSqm).rounded()))", unit: "sq ft"),
                .init(
                    label: "Wall Area",
                    value: "\(Int(Measure.squareFeet(wallAreaSqm).rounded()))", unit: "sq ft"),
                .init(
                    label: "Volume",
                    value: "\(Int(Measure.cubicFeet(volumeCuM).rounded()))", unit: "cu ft"),
                .init(label: "# Rooms", value: "\(rooms.count)"),
            ])
            .listRowInsets(EdgeInsets())
        }

        Section {
            LabeledContent("Ceiling Height", value: Measure.ftLabel(ceiling))
        } header: {
            Text("DIMENSIONS")
        } footer: {
            Text("Measured, not set — the tallest room on this floor. Wall thickness is a project-wide setting; a per-floor override needs a floors table that does not exist yet.")
        }

        Section {
            LabeledContent("Floor", value: label)
        } header: {
            Text("GENERAL")
        } footer: {
            Text("A storey is a label on each room rather than a record of its own, so it has no name to give it and nothing else to carry.")
        }
    }
}

/// The Add Room cards' artwork, drawn rather than traced.
///
/// `AGENTS.md` is explicit: reuse the reference's workflow and IA, draw our
/// own icons and illustrations. So these are built from the same isometric
/// projection the plan drawings use, not copies of theirs — and they carry
/// the one distinction the two cards exist to make.
///
/// **Auto-Scan** shows SEVERAL rooms with a path threading through them:
/// you walk the building and it keeps up. **Manual-Scan** shows ONE room
/// with a cone from a fixed standpoint: you stand still and aim at each
/// surface. That difference is the whole of the choice, and a generic
/// camera glyph on both would have said none of it.
struct ScanMethodArt: View {
    enum Kind { case auto, manual, square, corners, trace }
    let kind: Kind
    var enabled: Bool = true

    /// The slug for this method's commissioned drawing.
    private var slug: String {
        switch kind {
        case .auto: return "method-autoscan"
        case .manual: return "method-manual"
        case .square: return "method-square"
        case .corners: return "method-corners"
        case .trace: return "method-trace"
        }
    }

    /// **Real artwork when it exists, the drawn version when it does not** —
    /// the same fallback rule `ObjectTileArt` follows for the catalogue.
    ///
    /// The owner rejected the hand-coded `Canvas` version twice ("very, very
    /// basic"), and the reason it looked cheap was that it was speaking a
    /// different language from the 341 commissioned object icons beside it:
    /// thin blue outlines with no mass, against isometric solids with lit and
    /// shaded faces and a soft ground shadow. `scripts/draw-method-artwork.py`
    /// draws these in that same language and carries the palette, read
    /// straight off `refrigerator.svg`.
    ///
    /// The Canvas drawing is kept rather than deleted because it is the
    /// fallback that keeps this sheet from ever showing a hole, which is the
    /// same reason `ObjectTileArt` keeps its own.
    var body: some View {
        if ObjectArtwork.exists(slug) {
            ObjectArtwork(slug: slug)
                // Disabled means Manual-Scan, which exists only to say it is
                // not a separate method here. Greyed and faded rather than
                // hidden, so the row still reads as a thing you cannot pick.
                .grayscale(enabled ? 0 : 1)
                .opacity(enabled ? 1 : 0.45)
        } else {
            drawn
        }
    }

    private var drawn: some View {
        Canvas { context, size in
            let ink = enabled ? Brand.Plan.ink : Brand.inkFaint
            let accent = enabled ? Brand.blue : Brand.inkFaint
            // Faces are shaded by which way they point, the way an axo is:
            // one wall plane catches the light, the other is in shade, and
            // the floor is lighter than both. Three tones is all it takes to
            // read as a volume instead of an outline.
            let lit = enabled ? accent.opacity(0.26) : Brand.inkFaint.opacity(0.14)
            let shade = enabled ? accent.opacity(0.40) : Brand.inkFaint.opacity(0.22)
            let floor = enabled ? accent.opacity(0.10) : Brand.inkFaint.opacity(0.07)

            let span: Double = {
                switch kind {
                case .auto: return 7.0
                case .manual: return 5.2
                case .square: return 5.0
                case .corners: return 5.0
                case .trace: return 5.0
                }
            }()
            let unit = min(size.width, size.height) / span
            let origin = CGPoint(x: size.width / 2, y: size.height / 2 + unit * 0.9)

            /// 2:1 isometric with a z axis. `z` is height in the same units as
            /// the plan, so a wall is drawn by lifting its own footprint.
            func iso(_ x: Double, _ y: Double, _ z: Double = 0) -> CGPoint {
                CGPoint(
                    x: origin.x + (x - y) * unit * 0.86,
                    y: origin.y + (x + y) * unit * 0.5 - z * unit * 0.72)
            }

            func poly(_ pts: [CGPoint]) -> Path {
                var path = Path()
                guard let first = pts.first else { return path }
                path.move(to: first)
                for p in pts.dropFirst() { path.addLine(to: p) }
                path.closeSubpath()
                return path
            }

            /// A room as a solid: floor slab, then each wall extruded from its
            /// own footprint edge. Back walls are drawn before front ones so
            /// the near walls overlap them, which is what gives the depth.
            func room(
                _ x: Double, _ y: Double, _ w: Double, _ h: Double,
                height wall: Double = 0.62, slab: Bool = true
            ) {
                if slab {
                    context.fill(
                        poly([iso(x, y), iso(x + w, y), iso(x + w, y + h), iso(x, y + h)]),
                        with: .color(floor))
                }
                // Back two walls (away from the viewer), then front two.
                let edges: [(Double, Double, Double, Double, Bool)] = [
                    (x, y, x + w, y, true),
                    (x, y, x, y + h, false),
                    (x, y + h, x + w, y + h, true),
                    (x + w, y, x + w, y + h, false),
                ]
                for (x1, y1, x2, y2, litFace) in edges {
                    let face = poly([
                        iso(x1, y1), iso(x2, y2), iso(x2, y2, wall), iso(x1, y1, wall),
                    ])
                    context.fill(face, with: .color(litFace ? lit : shade))
                    context.stroke(face, with: .color(ink), lineWidth: 1.1)
                }
            }

            /// The phone, drawn small and iso-aligned. It is what the operator
            /// is actually holding, and putting it in the picture is the
            /// quickest way to say "this method involves you moving".
            func phone(at p: CGPoint, tilt: Double = 0) {
                let w = unit * 0.42, h = unit * 0.78
                let body = CGRect(x: p.x - w / 2, y: p.y - h / 2, width: w, height: h)
                context.drawLayer { layer in
                    layer.translateBy(x: p.x, y: p.y)
                    layer.rotate(by: .radians(tilt))
                    layer.translateBy(x: -p.x, y: -p.y)
                    layer.fill(
                        Path(roundedRect: body, cornerRadius: w * 0.22), with: .color(.white))
                    layer.stroke(
                        Path(roundedRect: body, cornerRadius: w * 0.22), with: .color(ink),
                        lineWidth: 1.3)
                    layer.fill(
                        Path(
                            roundedRect: body.insetBy(dx: w * 0.16, dy: h * 0.14),
                            cornerRadius: w * 0.1), with: .color(accent.opacity(0.55)))
                }
            }

            switch kind {
            case .auto:
                // Three rooms sharing walls — a floor, not a box. Low walls so
                // the walk stays visible over them.
                room(-2.2, -1.5, 2.2, 1.5, height: 0.5)
                room(0.05, -1.5, 1.8, 1.5, height: 0.5)
                room(-2.2, 0.1, 4.05, 1.4, height: 0.5)

                // The walk threading all three, drawn ON the floor.
                var walk = Path()
                walk.move(to: iso(-1.1, -0.7))
                walk.addLine(to: iso(0.95, -0.7))
                walk.addLine(to: iso(0.95, 0.85))
                walk.addLine(to: iso(-1.1, 0.85))
                context.stroke(
                    walk, with: .color(accent),
                    style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round, dash: [5, 4]))
                // Where the walk started, and where it is now.
                let from = iso(-1.1, -0.7)
                context.fill(
                    Path(ellipseIn: CGRect(x: from.x - 3.5, y: from.y - 3.5, width: 7, height: 7)),
                    with: .color(ink.opacity(0.45)))
                phone(at: iso(-1.1, 0.85, 0.55), tilt: -0.12)

            case .manual:
                // One room, and a cone from a standpoint inside it: aimed,
                // not walked.
                room(-1.6, -1.2, 3.2, 2.4, height: 0.7)
                let stand = iso(-0.9, 0.7)
                let cone = poly([stand, iso(1.6, -1.2, 0.2), iso(1.6, 0.4, 0.2)])
                context.fill(cone, with: .color(accent.opacity(0.20)))
                context.stroke(cone, with: .color(accent), lineWidth: 1.2)
                var target = Path()
                target.move(to: iso(1.6, -1.2))
                target.addLine(to: iso(1.6, -1.2, 0.7))
                context.stroke(target, with: .color(accent), lineWidth: 3)
                phone(at: iso(-0.9, 0.7, 0.5), tilt: 0.1)

            case .square:
                // Start with a rectangle, then pull it into shape: the room is
                // solid, and the handles are what you drag. The ghost shows
                // where a drag is going, which is the whole of the method.
                room(-1.3, -1.0, 2.6, 2.0, height: 0.66)
                let ghost = poly([
                    iso(1.3, -1.0), iso(2.1, -1.0), iso(2.1, 1.0), iso(1.3, 1.0),
                ])
                context.stroke(
                    ghost, with: .color(accent),
                    style: StrokeStyle(lineWidth: 1.4, dash: [4, 3]))
                // Corner handles on the near face, where a thumb would land.
                for (hx, hy) in [(-1.3, 1.0), (1.3, 1.0), (1.3, -1.0)] {
                    let p = iso(hx, hy, 0.66)
                    let r = unit * 0.16
                    context.fill(
                        Path(roundedRect: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2),
                             cornerRadius: r * 0.35),
                        with: .color(.white))
                    context.stroke(
                        Path(roundedRect: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2),
                             cornerRadius: r * 0.35),
                        with: .color(accent), lineWidth: 1.6)
                }

            case .trace:
                // A photograph of an existing plan with a new outline being
                // traced over it. Flat on purpose — this is the one method
                // that starts from a picture rather than from the building,
                // so it is the one drawing with no isometric room in it.
                let sheet = CGRect(
                    x: origin.x - unit * 1.6, y: origin.y - unit * 2.3,
                    width: unit * 3.2, height: unit * 2.4)
                context.fill(
                    Path(roundedRect: sheet, cornerRadius: unit * 0.14), with: .color(.white))
                context.stroke(
                    Path(roundedRect: sheet, cornerRadius: unit * 0.14), with: .color(ink),
                    lineWidth: 1.3)
                var underlay = Path()
                underlay.addRect(sheet.insetBy(dx: unit * 0.42, dy: unit * 0.36))
                context.stroke(underlay, with: .color(ink.opacity(0.22)), lineWidth: 3)
                var traced = Path()
                traced.move(to: CGPoint(x: sheet.minX + unit * 0.42, y: sheet.maxY - unit * 0.36))
                traced.addLine(to: CGPoint(x: sheet.minX + unit * 0.42, y: sheet.minY + unit * 0.36))
                traced.addLine(to: CGPoint(x: sheet.maxX - unit * 0.42, y: sheet.minY + unit * 0.36))
                context.stroke(
                    traced, with: .color(accent),
                    style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
                let nib = CGPoint(x: sheet.maxX - unit * 0.42, y: sheet.minY + unit * 0.36)
                context.fill(
                    Path(ellipseIn: CGRect(x: nib.x - 4, y: nib.y - 4, width: 8, height: 8)),
                    with: .color(accent))

            case .corners:
                // Corner by corner, and deliberately an L: a shape you could
                // not have got from the rectangle above. Three edges are
                // committed, the fourth is still following the finger.
                let pts: [(Double, Double)] = [
                    (-1.4, -1.0), (0.9, -1.0), (0.9, 0.1), (1.9, 0.1),
                ]
                context.fill(
                    poly([
                        iso(-1.4, -1.0), iso(0.9, -1.0), iso(0.9, 0.1), iso(1.9, 0.1),
                        iso(1.9, 1.2), iso(-1.4, 1.2),
                    ]), with: .color(floor))
                var laid = Path()
                laid.move(to: iso(pts[0].0, pts[0].1))
                for pt in pts.dropFirst() { laid.addLine(to: iso(pt.0, pt.1)) }
                context.stroke(
                    laid, with: .color(ink),
                    style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
                // The edge still being placed.
                var pending = Path()
                pending.move(to: iso(1.9, 0.1))
                pending.addLine(to: iso(1.9, 1.2))
                context.stroke(
                    pending, with: .color(accent),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [4, 3]))
                // Committed corners as dots; the live one as a ring.
                for pt in pts {
                    let p = iso(pt.0, pt.1)
                    context.fill(
                        Path(ellipseIn: CGRect(x: p.x - 3.4, y: p.y - 3.4, width: 6.8, height: 6.8)),
                        with: .color(ink))
                }
                let live = iso(1.9, 1.2)
                context.fill(
                    Path(ellipseIn: CGRect(x: live.x - 6, y: live.y - 6, width: 12, height: 12)),
                    with: .color(.white))
                context.stroke(
                    Path(ellipseIn: CGRect(x: live.x - 6, y: live.y - 6, width: 12, height: 12)),
                    with: .color(accent), lineWidth: 2.2)
            }
        }
    }
}
