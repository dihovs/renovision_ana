import RoomPlan
import SwiftUI

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
        let gap = 1.2
        var slots: [Slot] = []
        for room in rooms {
            guard let geometry = room.geometry else { continue }
            let plan = FloorPlanGeometry.plan(from: geometry)
            guard !plan.isEmpty else { continue }
            slots.append(
                Slot(
                    piece: Piece(
                        id: room.id, name: room.name, areaSqm: room.floorAreaSqm, plan: plan,
                        planX: room.planX, planY: room.planY, room: room, filed: nil),
                    x: 0, y: 0))
        }
        // A held room that has since landed arrives twice — once from the API,
        // once from the flow's own copy. The row wins; it is the same room.
        for item in pending where !rooms.contains(where: { $0.id == item.id }) {
            let plan = FloorPlanGeometry.plan(from: item.geometry)
            guard !plan.isEmpty else { continue }
            slots.append(
                Slot(
                    piece: Piece(
                        id: item.id, name: item.name, areaSqm: item.floorAreaSqm, plan: plan,
                        planX: nil, planY: nil, room: nil, filed: item),
                    x: 0, y: 0))
        }
        guard !slots.isEmpty else { return ([], 0, 0) }

        // Pack the unplaced into rows aiming at a squarish sheet.
        let totalArea = slots.reduce(0.0) { $0 + $1.plan.width * $1.plan.height }
        let widest = slots.map(\.plan.width).max() ?? 1
        let target = max((totalArea).squareRoot() * 1.4, widest)

        var x = 0.0
        var y = 0.0
        var rowHeight = 0.0
        for i in slots.indices {
            if let px = slots[i].piece.planX, let py = slots[i].piece.planY {
                slots[i].x = px
                slots[i].y = py
                continue
            }
            if x > 0, x + slots[i].plan.width > target {
                x = 0
                y += rowHeight + gap
                rowHeight = 0
            }
            slots[i].x = x
            slots[i].y = y
            x += slots[i].plan.width + gap
            rowHeight = max(rowHeight, slots[i].plan.height)
        }

        // Re-base so dragged-negative rooms stay on the sheet.
        let minX = slots.map(\.x).min() ?? 0
        let minY = slots.map(\.y).min() ?? 0
        for i in slots.indices {
            slots[i].x -= minX
            slots[i].y -= minY
        }
        let width = slots.map { $0.x + $0.plan.width }.max() ?? 1
        let height = slots.map { $0.y + $0.plan.height }.max() ?? 1
        return (slots, width, height)
    }

    var body: some View {
        let layout = self.layout
        if layout.slots.isEmpty {
            EmptyView()
        } else {
            GeometryReader { proxy in
                let pad: CGFloat = 10
                let scale = min(
                    (proxy.size.width - pad * 2) / layout.width,
                    (proxy.size.height - pad * 2) / layout.height)
                let ox = pad + (proxy.size.width - pad * 2 - layout.width * scale) / 2
                let oy = pad + (proxy.size.height - pad * 2 - layout.height * scale) / 2

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

                        if plotWidth >= 64 {
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
                            // Sized up on the owner's word, 18 Aug 2026 —
                            // 11/9 was legible on a desk and not on a job
                            // site. The plate grows with the type rather
                            // than staying at the old 28pt, or the second
                            // line would hang off the bottom of it.
                            let name = context.resolve(
                                Text(slot.piece.name)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(Brand.Plan.label))
                            let sqft = context.resolve(
                                Text(Measure.sqftLabel(slot.piece.areaSqm))
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(Brand.Plan.labelSoft))
                            let box = name.measure(in: proxy.size)
                            let sqftBox = sqft.measure(in: proxy.size)
                            let plateWidth = max(box.width, sqftBox.width) + 10
                            context.fill(
                                Path(
                                    roundedRect: CGRect(
                                        x: centre.x - plateWidth / 2, y: centre.y - 18,
                                        width: plateWidth, height: 36),
                                    cornerRadius: 4),
                                with: .color(bg.opacity(0.8)))
                            context.draw(name, at: CGPoint(x: centre.x, y: centre.y - 7), anchor: .center)
                            context.draw(sqft, at: CGPoint(x: centre.x, y: centre.y + 9), anchor: .center)
                        }
                    }
                }
                .contentShape(.rect)
                .onTapGesture { location in
                    // Hit-test in plan space; first slot whose box contains
                    // the tap wins.
                    let px = (location.x - ox) / scale
                    let py = (location.y - oy) / scale
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
        rooms.reduce(0) { $0 + $1.floorAreaSqm } + pending.reduce(0) { $0 + $1.floorAreaSqm }
    }
    private var wallAreaSqm: Double {
        rooms.reduce(0) { $0 + $1.wallLengthM * $1.ceilingHeightM }
    }

    /// Held rooms are included: a floor's footprint should not jump when a
    /// phone finds a bar. They carry an area and a perimeter like any other.
    private var surfaces: WallThickness.Surfaces {
        WallThickness.groundSurfaces(
            rooms: rooms.map { (floorAreaSqm: $0.floorAreaSqm, perimeterM: $0.wallLengthM) }
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
    @State private var inserting = false
    /// The room whose plan is being adjusted — what a tap on the canvas
    /// opens now. Its inspector is a swipe up from in there.
    @State private var editingRoom: RoomScan?
    @State private var switchingFloor = false
    @State private var sharing = false
    @State private var showingHelp = false
    @State private var insertOpen = false
    @State private var addingPhoto = false
    @State private var floorInfo = false
    @State private var choosingMethod = false
    @State private var picked = false
    @State private var method: CaptureFlow.CaptureMode = .draw
    /// Viewport. One finger pans and a pinch zooms, because nothing on this
    /// screen is selectable — the room editor needs two fingers to keep a
    /// stray thumb from moving a wall, but here a drag can only ever mean
    /// "move the paper".
    @State private var zoom: CGFloat = 1
    @State private var pan: CGSize = .zero
    @GestureState private var pinch: CGFloat = 1
    @GestureState private var drag: CGSize = .zero

    /// Which storey is on screen: the one navigated to, until the floors
    /// stepper picks another.
    private var showing: String { switched ?? level }

    private var rooms: [RoomScan] { (scans ?? []).filter { $0.level == showing } }

    private var label: String {
        FloorVocabulary.levels.first { $0.id == showing }?.label ?? showing
    }

    var body: some View {
        ZStack {
            Brand.Plan.paper.ignoresSafeArea()

            // The paper AND what is on it, moving together.
            //
            // The grid was fixed at first, on the reasoning that screen
            // pitch is the paper and paper does not magnify. That is right
            // for a room editor whose drawing fills the frame, and wrong
            // here: with an empty floor the only thing that moved was a
            // label, so the canvas read as broken. A floor plan surface has
            // to feel like a sheet you are sliding under glass.
            //
            // Oversized deliberately. At the widest zoom-out a screen-sized
            // grid would show its own edges as the pan ran past them, and an
            // edge is the one thing paper must not appear to have.
            // Color.clear is the layout, the plate is only an overlay on
            // it. That is the whole reason this is not a plain ZStack: an
            // overlay does not size its host, whereas a 2400pt sibling made
            // the surrounding stack 2400pt tall and pushed the action bar
            // and the steppers clean off the screen — the canvas was all
            // that was left visible.
            //
            // Color.clear also fills whatever space it is offered, so the
            // gesture area is the screen rather than the drawing: sized to
            // the drawing, an empty floor left almost nothing to grab and
            // the canvas appeared inert.
            Color.clear
                .overlay {
                    ZStack {
                        Canvas { context, size in
                            EditorChrome.drawGrid(context: context, size: size)
                        }
                        .frame(width: 2400, height: 2400)

                        if !rooms.isEmpty {
                            // Straight into the editor, on the owner's
                            // instruction 18 Aug 2026: *"when I click on it,
                            // I don't want to have this pop up menu that
                            // says adjust or whatever. When I click, it
                            // automatically should go to the adjustment
                            // mode."* The room's inspector is a swipe up
                            // from inside the editor — his choice of where
                            // it should live, and the gesture the reference
                            // uses for every inspector.
                            LevelCanvas(rooms: rooms) { room in editingRoom = room }
                                .padding(Brand.Space.base)
                        }
                    }
                    .scaleEffect(zoom * pinch)
                    .offset(x: pan.width + drag.width, y: pan.height + drag.height)
                }
                .clipped()
            .contentShape(Rectangle())
            .gesture(
                SimultaneousGesture(
                    MagnificationGesture()
                        .updating($pinch) { value, state, _ in state = value }
                        .onEnded { value in zoom = min(max(zoom * value, 0.4), 6) },
                    DragGesture()
                        .updating($drag) { value, state, _ in state = value.translation }
                        .onEnded { value in
                            pan.width += value.translation.width
                            pan.height += value.translation.height
                        }
                )
            )

            // The editor chrome, at floor depth. Undo/redo is drawn and
            // greyed rather than hidden: §3 of editor-chrome-design says the
            // pill never disappears, and a control that vanishes teaches the
            // hand a different screen each time.
            VStack {
                HStack(alignment: .top) {
                    EditorUndoRedoPill(
                        canUndo: false, canRedo: false, onUndo: {}, onRedo: {})
                    Spacer()
                    HStack(spacing: Brand.Space.small) {
                        EditorStepperPill(action: { switchingFloor = true }) {
                            Image(systemName: "square.3.layers.3d")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Brand.ink)
                        }
                        if zoom != 1 || pan != .zero {
                            Button {
                                withAnimation(.snappy) { zoom = 1; pan = .zero }
                            } label: {
                                Image(systemName: "arrow.counterclockwise")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Brand.ink)
                                    .frame(width: 34, height: 34)
                                    .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.tile))
                            }
                            .buttonStyle(.plain)
                        }
                        EditorStepperPill(action: {}) {
                            Text("2D")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(Brand.ink)
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
                    if insertOpen {
                        insertMenu
                            .padding(.horizontal, Brand.Space.base)
                            .padding(.bottom, Brand.Space.small)
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                    }
                    EditorActionBar(
                        depth: .floor(name: label),
                        supported: [.insert],
                        onAction: { action in
                            if action == .insert {
                                withAnimation(.snappy(duration: 0.18)) { insertOpen.toggle() }
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
        .navigationTitle(label)
        .navigationBarTitleDisplayMode(.inline)
        // The tab bar goes away here. This screen is a drawing surface with
        // its own action bar at the foot, and two bars stacked on each other
        // meant the tabs sat over Insert — the one control the screen exists
        // to offer. A canvas is somewhere you are working, not somewhere you
        // switch away from.
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { showingHelp = true } label: {
                    Image(systemName: "questionmark.circle")
                }
                Button { sharing = true } label: {
                    Image(systemName: "square.and.arrow.up")
                }
            }
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
        .sheet(item: $editingRoom, onDismiss: { Task { await load() } }) { room in
            // Nothing is behind this, so the editor's swipe-up presents the
            // room's inspector rather than dismissing into it.
            PlanEditorView(room: room) { Task { await load() } }
                .id(room.id)
        }
        .task { await load() }
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
            insertRow("Object", icon: "bed.double", enabled: false, note: "In a room, on a wall") {}
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

    private func load() async {
        scans = (try? await API.shared.scans(projectId: projectId)) ?? []
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
                            glyph: "square.dashed",
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
                                glyph: "hand.draw",
                                enabled: true
                            ) {
                                onPick(.drawCorners)
                                dismiss()
                            }
                            Divider().padding(.leading, 62)
                            methodRow(
                                title: "Import & Draw",
                                caption: "Trace over an image of an existing plan.",
                                glyph: "photo.on.rectangle.angled",
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

    private func methodRow(
        title: String, caption: String, glyph: String, enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: { if enabled { action() } }) {
            HStack(spacing: Brand.Space.small) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Brand.Plan.floorMuted)
                    .frame(width: 46, height: 46)
                    .overlay(
                        Image(systemName: glyph)
                            .font(.system(size: 18))
                            .foregroundStyle(enabled ? Brand.blue : Brand.inkFaint))
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

    private var floorAreaSqm: Double { rooms.reduce(0) { $0 + $1.floorAreaSqm } }
    private var wallAreaSqm: Double {
        rooms.reduce(0) { $0 + $1.wallLengthM * $1.ceilingHeightM }
    }
    private var volumeCuM: Double {
        rooms.reduce(0) { $0 + $1.floorAreaSqm * $1.ceilingHeightM }
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
    enum Kind { case auto, manual }
    let kind: Kind
    var enabled: Bool = true

    var body: some View {
        Canvas { context, size in
            let ink = enabled ? Brand.Plan.ink : Brand.inkFaint
            let accent = enabled ? Brand.blue : Brand.inkFaint
            // Isometric: x goes right-and-down, y goes left-and-down, the
            // same 2:1 projection an architectural axo uses.
            let unit = min(size.width, size.height) / (kind == .auto ? 7.0 : 5.2)
            let origin = CGPoint(x: size.width / 2, y: size.height / 2 + unit * 0.6)
            func iso(_ x: Double, _ y: Double) -> CGPoint {
                CGPoint(
                    x: origin.x + (x - y) * unit * 0.86,
                    y: origin.y + (x + y) * unit * 0.5)
            }

            func room(_ x: Double, _ y: Double, _ w: Double, _ h: Double, fill: Bool) {
                var path = Path()
                path.move(to: iso(x, y))
                path.addLine(to: iso(x + w, y))
                path.addLine(to: iso(x + w, y + h))
                path.addLine(to: iso(x, y + h))
                path.closeSubpath()
                if fill {
                    context.fill(path, with: .color(accent.opacity(0.16)))
                }
                context.stroke(path, with: .color(ink), lineWidth: 1.4)
            }

            switch kind {
            case .auto:
                // Three rooms sharing walls — a floor, not a box.
                room(-2.2, -1.4, 2.2, 1.5, fill: true)
                room(0, -1.4, 1.8, 1.5, fill: false)
                room(-2.2, 0.1, 4.0, 1.4, fill: false)

                // The walk: a dashed path threading all three.
                var walk = Path()
                walk.move(to: iso(-1.1, -0.6))
                walk.addLine(to: iso(0.9, -0.6))
                walk.addLine(to: iso(0.9, 0.8))
                walk.addLine(to: iso(-1.1, 0.8))
                context.stroke(
                    walk, with: .color(accent),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [5, 4]))
                // Where the walk ends, so it reads as a direction.
                let tip = iso(-1.1, 0.8)
                context.fill(
                    Path(ellipseIn: CGRect(x: tip.x - 4, y: tip.y - 4, width: 8, height: 8)),
                    with: .color(accent))

            case .manual:
                // One room, and a cone from a standpoint inside it: aimed,
                // not walked.
                room(-1.6, -1.2, 3.2, 2.4, fill: false)

                let stand = iso(-0.9, 0.7)
                var cone = Path()
                cone.move(to: stand)
                cone.addLine(to: iso(1.6, -1.2))
                cone.addLine(to: iso(1.6, 0.4))
                cone.closeSubpath()
                context.fill(cone, with: .color(accent.opacity(0.22)))
                context.stroke(cone, with: .color(accent), lineWidth: 1.2)

                // The far wall it is aimed at, drawn heavier — the surface
                // being measured right now.
                var target = Path()
                target.move(to: iso(1.6, -1.2))
                target.addLine(to: iso(1.6, 1.2))
                context.stroke(target, with: .color(accent), lineWidth: 3)

                context.fill(
                    Path(ellipseIn: CGRect(x: stand.x - 5, y: stand.y - 5, width: 10, height: 10)),
                    with: .color(ink))
            }
        }
    }
}
