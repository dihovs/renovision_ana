import SwiftUI

/// Build a room by placing its corners, one tap at a time.
///
/// The reference's `Draw Room`, and the sibling of `RoomSketchView`: that
/// one starts from a rectangle and pulls it into shape, this one starts from
/// nothing and puts the corners where the walls actually are. The two suit
/// different rooms. A bedroom is a rectangle with a notch and is fastest
/// pulled; an L-shaped basement with a chimney breast and a stair bulkhead
/// has no rectangle to start from, and dragging one into that shape is more
/// work than simply walking the outline.
///
/// It shares `RoomSketchView`'s exact contract — `onDone(corners, ceiling,
/// openings)` — so `CaptureFlow` saves a drawn room the same way whichever
/// of the two produced it, and neither becomes a second save path to keep
/// correct.
///
/// # Why taps place corners rather than a finger tracing
///
/// Freehand already exists for affected areas (S3) and is right there: a wet
/// patch has no true edges, so any smooth outline is as honest as another. A
/// ROOM has exact corners, and a traced one would have to be simplified into
/// a polygon that is no longer what the operator drew. Tapping states each
/// corner exactly once, which is also how a tape measure is read.
///
/// # Drawn ON the floor, not beside it
///
/// The owner, 11 Oct 2026, after a sixteen-room house came out of this
/// canvas as sixteen boxes in a grid: *"You didn't really draw a real house.
/// You just drew a bunch of squares and just put them together."* Each room
/// used to be drawn alone on blank paper and then shelf-packed onto the
/// storey, so the second room had nothing to be drawn against and every
/// house had to be reassembled afterwards by hand, box by box.
///
/// So the rooms already on the storey are drawn here, behind the new one, in
/// the floor's own metres — and a corner tapped beside one of their walls
/// lands against it, a partition's thickness away (see `DrawSnapping`). The
/// corners come back in the same floor metres, so the caller can file the
/// room exactly where it was drawn instead of wherever the packer finds a
/// gap. Pinch zooms and a one-finger drag moves the sheet, because a house is
/// bigger than a phone: the fixed 50 pt/m this used to draw at ran out at
/// about eight metres, which is narrower than an ordinary open-plan dining
/// room.
struct DrawRoomView: View {
    /// A room already on this storey, in FLOOR metres — the frame the floor
    /// canvas draws in, so a corner drawn against it lands where the floor
    /// will show it.
    struct Neighbour: Identifiable {
        let id: String
        let name: String
        /// The outline, without the repeated closing point.
        let polygon: [CGPoint]
        /// A porch, balcony or deck: the wall between it and the house is
        /// an exterior wall, not a partition.
        var outdoor = false
    }

    /// Room types that are outside the house — see `Neighbour.outdoor`.
    static let outdoorTypes: Set<String> = ["balcony", "porch", "commercial_balcony"]

    var neighbours: [Neighbour] = []
    /// Whether the room being drawn is itself outside the house.
    var outdoor = false
    let onCancel: () -> Void
    let onDone: ([CGPoint], Double, [PlanEditing.WallOpening]) -> Void

    @ObservedObject private var units = UnitSettings.shared

    /// Corners in PLAN METRES, in the order tapped — floor metres when
    /// there are neighbours, so they can be filed where they were drawn.
    @State private var corners: [CGPoint] = []
    /// Remembered from the last room drawn: a house's ceilings are mostly
    /// one height, and retyping 10 into twenty rooms of the owner's second
    /// reference plan was twenty chances to forget it.
    @AppStorage("drawRoom.ceiling") private var heightText = "8"
    /// The next wall's length, typed — see `addTypedWall`.
    @State private var wallText = ""
    /// Where the operator has put the sheet: the floor point at the middle
    /// of the canvas and the metres per point. Nil until the first tap,
    /// pinch or pan — until then the view is FITTED, worked out afresh from
    /// the canvas's size on every frame, so a canvas that is still settling
    /// (it opens while the name field's keyboard is going down) can never
    /// leave a stale framing behind. Frozen at the first touch, so the
    /// drawing never rescales under a finger mid-outline.
    @State private var manual: Viewport?
    @State private var closed = false

    struct Viewport: Equatable {
        var centre: CGPoint
        var metresPerPoint: Double
    }
    /// Where the last corner came from, said in words under the canvas — a
    /// corner that jumped onto a wall without saying so reads as a bug.
    @State private var snapNote: String?

    /// Gesture bookkeeping: both gestures report totals since they began.
    @State private var pinchStart: (mpp: Double, anchor: CGPoint, location: CGPoint)?
    @State private var panStart: CGPoint?

    /// Snap to 5 cm. A fingertip is never trusted for a final number here
    /// any more than it is in the plan editor — `PlanEditing.quantum` is the
    /// store-level rounding; this is the coarser one a tap deserves.
    private let snap = 0.05
    /// How close, in screen points, a tap must be to a corner or a wall to
    /// land on it. Points rather than metres so it feels the same at any
    /// zoom.
    private let cornerReach: Double = 16
    private let wallReach: Double = 13
    private let alignReach: Double = 9
    /// ...and never further than this in METRES. Zoomed out to a whole
    /// house, 16 points is most of a metre, and a corner meant for one wall
    /// was pulled onto a room next door — the reach has to stay smaller than
    /// the rooms it is choosing between. Zoom in to snap from further.
    private let cornerReachMax = 0.30
    private let wallReachMax = 0.25
    private let alignReachMax = 0.15

    private static let minMetresPerPoint = 0.004
    private static let maxMetresPerPoint = 0.2

    private var ceilingM: Double {
        UnitSettings.shared.format.parse(heightText) ?? 2.44
    }

    private var areaSqm: Double { PlanEditing.area(corners) }

    private var canClose: Bool { corners.count >= 3 && !closed }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                GeometryReader { proxy in
                    ZStack(alignment: .bottomTrailing) {
                        Brand.Plan.paper
                        Canvas { context, size in
                            EditorChrome.drawGrid(
                                context: context, size: size,
                                model: (
                                    origin: toScreen(.zero, size),
                                    scale: 1 / viewport(size).metresPerPoint
                                ))
                            drawNeighbours(context: context, size: size)
                            draw(context: context, size: size)
                        }
                        fitButton
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { location in place(location, in: proxy.size) }
                    .gesture(pinch(proxy.size))
                    .simultaneousGesture(pan(proxy.size))
                }
                .clipped()

                controls
            }
            .navigationTitle("Draw Room")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel", action: onCancel) }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Undo") { undo() }.disabled(corners.isEmpty)
                }
            }
        }
    }

    // MARK: - Viewport

    /// Plan metres → screen points. Derived every frame from the same centre
    /// and scale the taps invert through, so a placed corner cannot land
    /// somewhere other than where it was tapped.
    private func toScreen(_ p: CGPoint, _ size: CGSize) -> CGPoint {
        let view = viewport(size)
        return CGPoint(
            x: size.width / 2 + (p.x - view.centre.x) / view.metresPerPoint,
            y: size.height / 2 + (p.y - view.centre.y) / view.metresPerPoint)
    }

    private func toModel(_ p: CGPoint, _ size: CGSize) -> CGPoint {
        let view = viewport(size)
        return CGPoint(
            x: view.centre.x + (p.x - size.width / 2) * view.metresPerPoint,
            y: view.centre.y + (p.y - size.height / 2) * view.metresPerPoint)
    }

    /// What the canvas is showing: the operator's own framing once they
    /// have touched it, the fitted one until then.
    private func viewport(_ size: CGSize) -> Viewport {
        manual ?? fitted(size)
    }

    /// The whole storey with room around it to draw the next room in, or —
    /// on an empty floor — the old 50 pt/m about the middle, which suits one
    /// ordinary room.
    private func fitted(_ size: CGSize) -> Viewport {
        let points = neighbours.flatMap(\.polygon) + corners
        guard let box = Self.bounds(points), size.width > 10, size.height > 10 else {
            return Viewport(centre: .zero, metresPerPoint: 0.02)
        }
        // Two and a half metres of paper round the plan: enough to draw an
        // ordinary room against any outside wall without panning first.
        let padded = box.insetBy(dx: -2.5, dy: -2.5)
        return Viewport(
            centre: CGPoint(x: padded.midX, y: padded.midY),
            metresPerPoint: Self.clamped(
                max(padded.width / size.width, padded.height / size.height)))
    }

    /// Back to fitted — which also takes in the corners placed so far.
    private var fitButton: some View {
        Button {
            withAnimation(.snappy(duration: 0.2)) { manual = nil }
        } label: {
            Image(systemName: "arrow.up.left.and.arrow.down.right")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Brand.blue)
                .frame(width: 40, height: 40)
                .background(Brand.surfaceRaised, in: .rect(cornerRadius: 10))
                .shadow(color: .black.opacity(0.08), radius: 4, y: 1)
        }
        .buttonStyle(.plain)
        .padding(12)
        .accessibilityLabel("Fit the whole floor")
    }

    /// Two fingers zoom about the point between them — the floor stays under
    /// the fingers instead of sliding toward the middle of the screen.
    private func pinch(_ size: CGSize) -> some Gesture {
        MagnifyGesture()
            .onChanged { value in
                if pinchStart == nil {
                    pinchStart = (
                        viewport(size).metresPerPoint, toModel(value.startLocation, size),
                        value.startLocation
                    )
                }
                guard let start = pinchStart else { return }
                let mpp = Self.clamped(start.mpp / max(value.magnification, 0.01))
                manual = Viewport(
                    centre: CGPoint(
                        x: start.anchor.x - (start.location.x - size.width / 2) * mpp,
                        y: start.anchor.y - (start.location.y - size.height / 2) * mpp),
                    metresPerPoint: mpp)
            }
            .onEnded { _ in pinchStart = nil }
    }

    /// One finger moves the sheet. Twelve points before it counts, so a tap
    /// with a little wobble still places its corner.
    private func pan(_ size: CGSize) -> some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                // A pinch owns the viewport while it lasts; letting its first
                // finger pan as well makes the two fight over the centre.
                guard pinchStart == nil else { return }
                let view = viewport(size)
                if panStart == nil { panStart = view.centre }
                guard let start = panStart else { return }
                manual = Viewport(
                    centre: CGPoint(
                        x: start.x - value.translation.width * view.metresPerPoint,
                        y: start.y - value.translation.height * view.metresPerPoint),
                    metresPerPoint: view.metresPerPoint)
            }
            .onEnded { _ in panStart = nil }
    }

    private static func clamped(_ mpp: Double) -> Double {
        min(max(mpp, minMetresPerPoint), maxMetresPerPoint)
    }

    private static func bounds(_ points: [CGPoint]) -> CGRect? {
        guard let minX = points.map(\.x).min(), let maxX = points.map(\.x).max(),
            let minY = points.map(\.y).min(), let maxY = points.map(\.y).max()
        else { return nil }
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    // MARK: - Canvas

    /// The rooms already on the storey: grey, named, and plainly not the one
    /// being drawn.
    private func drawNeighbours(context: GraphicsContext, size: CGSize) {
        for neighbour in neighbours where neighbour.polygon.count >= 3 {
            let points = neighbour.polygon.map { toScreen($0, size) }
            var path = Path()
            path.move(to: points[0])
            for p in points.dropFirst() { path.addLine(to: p) }
            path.closeSubpath()
            context.fill(path, with: .color(Brand.Plan.floorMuted))
            // The wall's own thickness at this zoom, as the storey draws it,
            // so a shared wall reads as one wall the moment it is shared.
            let band = max(2, 0.114 / viewport(size).metresPerPoint)
            context.stroke(
                path, with: .color(Brand.Plan.wallFootprint),
                style: StrokeStyle(lineWidth: band, lineJoin: .miter))
            context.stroke(path, with: .color(Brand.Plan.ink.opacity(0.45)), lineWidth: 1)

            let centroid = StoreyArranging.centroid(neighbour.polygon)
            let label = context.resolve(
                Text(neighbour.name)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.inkFaint))
            context.draw(label, at: toScreen(centroid, size), anchor: .center)
        }
    }

    private func draw(context: GraphicsContext, size: CGSize) {
        guard !corners.isEmpty else { return }
        let points = corners.map { toScreen($0, size) }

        var path = Path()
        path.move(to: points[0])
        for p in points.dropFirst() { path.addLine(to: p) }
        if closed { path.closeSubpath() }

        if closed {
            context.fill(path, with: .color(Brand.blue.opacity(0.08)))
        }
        context.stroke(
            path, with: .color(Brand.Plan.ink),
            style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))

        // Each wall's length, beside the wall. This is the whole reason to
        // draw rather than type: the number appears where the tape would be
        // held. OUTSIDE the outline, not on the line — centred on it, the
        // wall struck straight through every figure and "7' 7"" read as a
        // crossed-out number.
        let middle = CGPoint(
            x: points.map(\.x).reduce(0, +) / Double(points.count),
            y: points.map(\.y).reduce(0, +) / Double(points.count))
        let count = closed ? points.count : points.count - 1
        if count > 0 {
            for i in 0..<count {
                let a = corners[i]
                let b = corners[(i + 1) % corners.count]
                let pa = points[i]
                let pb = points[(i + 1) % points.count]
                let mid = CGPoint(x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2)
                let along = hypot(pb.x - pa.x, pb.y - pa.y)
                guard along > 1 else { continue }
                var normal = CGPoint(x: -(pb.y - pa.y) / along, y: (pb.x - pa.x) / along)
                if (mid.x - middle.x) * normal.x + (mid.y - middle.y) * normal.y < 0 {
                    normal = CGPoint(x: -normal.x, y: -normal.y)
                }
                // A wall shared with the room next door has that room on its
                // outside, and a label put there sat on the neighbour's own
                // name. Inside, instead, wherever the outside is taken.
                let probe = CGPoint(
                    x: (a.x + b.x) / 2 + normal.x * 0.25, y: (a.y + b.y) / 2 + normal.y * 0.25)
                if neighbours.contains(where: { DrawSnapping.contains($0.polygon, probe) }) {
                    normal = CGPoint(x: -normal.x, y: -normal.y)
                }
                let length = hypot(b.x - a.x, b.y - a.y)
                let text = context.resolve(
                    Text(units.format.format(length))
                        .font(.system(size: 11, weight: .bold).monospacedDigit())
                        .foregroundStyle(Brand.ink))
                let half = text.measure(in: CGSize(width: 200, height: 40))
                // Far enough out that the label's own box clears the line,
                // whichever way the wall runs.
                let offset = 6 + abs(normal.x) * half.width / 2 + abs(normal.y) * half.height / 2
                context.draw(
                    text, at: CGPoint(x: mid.x + normal.x * offset, y: mid.y + normal.y * offset),
                    anchor: .center)
            }
        }

        for (i, p) in points.enumerated() {
            // The first corner is the one you close onto, so it is the one
            // that has to be findable.
            let first = i == 0 && !closed
            context.fill(
                Path(ellipseIn: CGRect(x: p.x - 6, y: p.y - 6, width: 12, height: 12)),
                with: .color(first ? Brand.blue : Brand.Plan.ink))
            context.stroke(
                Path(ellipseIn: CGRect(x: p.x - 6, y: p.y - 6, width: 12, height: 12)),
                with: .color(.white), lineWidth: 2)
        }
    }

    // MARK: - Editing

    private func place(_ location: CGPoint, in size: CGSize) {
        guard !closed else { return }
        // The first corner freezes the framing it was tapped against: the
        // fitted view takes in the corners too, and must not rescale itself
        // around the outline as it grows.
        let view = viewport(size)
        if manual == nil { manual = view }

        // Tapping the first corner closes the outline — the same gesture a
        // hand already expects from every polygon tool.
        if corners.count >= 3, let first = corners.first {
            let onScreen = toScreen(first, size)
            if hypot(onScreen.x - location.x, onScreen.y - location.y) < 22 {
                closed = true
                snapNote = nil
                return
            }
        }
        let landed = DrawSnapping.snap(
            toModel(location, size),
            corners: corners,
            // A partition between two rooms of the house; an exterior wall
            // where either side is outdoors — the same stated figures the
            // footprint totals use. The owner's reference plan measures
            // 0.112 m for every partition in it.
            neighbours: neighbours.map {
                (
                    $0.name, $0.polygon,
                    outdoor || $0.outdoor
                        ? WallThickness.default.exteriorM : WallThickness.default.interiorM
                )
            },
            grid: snap,
            cornerReach: min(cornerReach * view.metresPerPoint, cornerReachMax),
            wallReach: min(wallReach * view.metresPerPoint, wallReachMax),
            alignReach: min(alignReach * view.metresPerPoint, alignReachMax))
        snapNote = landed.note
        corners.append(landed.point)
    }

    /// **A wall typed, not tapped.** Drawing from a plan or a tape, the
    /// operator KNOWS the length — 18' 8 — and a fingertip on a zoomed-out
    /// house lands within a few centimetres of it at best, so every room
    /// drawn from the owner's second reference plan would have needed Set
    /// Size afterwards (11 Oct 2026). The magicplan way instead: tap the
    /// first corner, which snaps against the room next door, then type each
    /// wall and say which way it runs. Rectangles, L-shapes and bump-outs
    /// all come out exact, and the outline closes itself when the last wall
    /// comes back to where it started.
    private func addTypedWall(dx: Double, dy: Double) {
        guard !closed, let last = corners.last,
            let metres = units.format.parse(wallText), metres > 0.05
        else { return }
        let next = CGPoint(x: last.x + dx * metres, y: last.y + dy * metres)
        if corners.count >= 3, let first = corners.first,
            hypot(first.x - next.x, first.y - next.y) < 0.02
        {
            closed = true
            snapNote = nil
        } else {
            corners.append(next)
            snapNote = "Typed: \(units.format.format(metres)) wall"
        }
        // Back to the fitted view, which takes in the outline as well as the
        // rooms behind it. A tapped corner is always on screen; a typed one
        // can be fourteen feet past the edge, and the outline then ran off
        // the sheet where nobody could see it close.
        manual = nil
        wallText = ""
    }

    private var typedWallRow: some View {
        let ready = !closed && !corners.isEmpty
        return HStack(spacing: 6) {
            Text("WALL")
                .font(.system(size: 10, weight: .heavy))
                .foregroundStyle(Brand.inkFaint)
            TextField(corners.isEmpty ? "tap a corner first" : "length", text: $wallText)
                .keyboardType(.numbersAndPunctuation)
                .font(.system(size: 15, weight: .semibold))
                .frame(minWidth: 70)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(Brand.surfaceRaised, in: .rect(cornerRadius: 8))
                .disabled(!ready)
            ForEach(
                [("arrow.left", -1.0, 0.0), ("arrow.up", 0, -1), ("arrow.down", 0, 1),
                 ("arrow.right", 1, 0)], id: \.0
            ) { symbol, dx, dy in
                Button { addTypedWall(dx: dx, dy: dy) } label: {
                    Image(systemName: symbol)
                        .font(.system(size: 15, weight: .bold))
                        .frame(width: 38, height: 32)
                        .background(Brand.surfaceRaised, in: .rect(cornerRadius: 8))
                }
                .disabled(!ready || units.format.parse(wallText) == nil)
                .accessibilityLabel("Wall \(symbol.replacingOccurrences(of: "arrow.", with: ""))")
            }
        }
    }

    private func undo() {
        if closed { closed = false } else if !corners.isEmpty { corners.removeLast() }
        snapNote = nil
    }

    // MARK: - Controls

    private var prompt: String {
        if closed { return "\(Int(Measure.squareFeet(areaSqm).rounded())) sq ft" }
        if let snapNote { return snapNote }
        if corners.count >= 3 { return "Tap the blue corner to close" }
        return neighbours.isEmpty
            ? "Tap each corner of the room"
            : "Tap each corner — beside another room, it lands against its wall"
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            HStack {
                // Two lines held whether or not they are used: the canvas
                // takes whatever height is left, and a prompt that grew by a
                // line after a tap moved the whole drawing under the finger.
                Text(prompt)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(closed ? Brand.ink : Brand.inkSoft)
                    .lineLimit(2, reservesSpace: true)
                    .minimumScaleFactor(0.8)
                Spacer()
                if canClose {
                    Button("Close shape") {
                        closed = true
                        snapNote = nil
                    }
                    .font(.system(size: 14, weight: .bold))
                }
            }

            typedWallRow

            HStack(spacing: Brand.Space.small) {
                Text("CEILING")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(Brand.inkFaint)
                TextField("8", text: $heightText)
                    // Feet and inches: a plan says 11'-6" CLG. HT., and a
                    // decimal pad has no apostrophe to type that with.
                    .keyboardType(.numbersAndPunctuation)
                    .font(.system(size: 15, weight: .semibold))
                    .frame(width: 90)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Brand.surfaceRaised, in: .rect(cornerRadius: 8))
                Spacer()
            }

            Button("Use this room") {
                onDone(corners, ceilingM, [])
            }
            .buttonStyle(PrimaryButtonStyle(enabled: closed && areaSqm > 0.5))
            .disabled(!closed || areaSqm <= 0.5)

            Text(
                neighbours.isEmpty
                    ? "Pinch to zoom, drag to move the sheet. Openings are added afterwards, on the plan — a door is easier to place against a wall that already exists than to predict while drawing one."
                    : "The rooms already on this floor are drawn behind. Pinch to zoom, drag to move the sheet. Doors and windows go on afterwards, on the plan."
            )
            .font(.system(size: 11))
            .foregroundStyle(Brand.inkFaint)
        }
        .padding(Brand.Space.base)
        .background(Brand.canvas)
    }
}

/// Where a tapped corner actually lands. Pure, so it can be reasoned about —
/// and tested — without a canvas.
///
/// # A wall has a thickness
///
/// An outline is the INSIDE face of a room's walls — that is what a scan
/// measures and what every figure on the estimate is taken from — so two
/// rooms either side of a partition are one partition apart, not touching.
/// The first version of this snapped a new room straight onto its
/// neighbour's outline, and the owner's own reference plan showed why that
/// is wrong: a row of six rooms and a row of three, all at their true inside
/// sizes, came out 0.7 m different in length, because the six-room row has
/// four more partitions in it. Solved for the gap that makes the rows agree,
/// the plan gives 0.117 m — a 2×4 partition, `WallThickness`'s own figure.
///
/// So a corner tapped BESIDE another room lands against the far face of the
/// wall between them, one partition out. A corner tapped ON another room —
/// inside its outline — shares its edge exactly instead: that is an
/// open-plan join, where there is no wall to leave room for.
///
/// In order, first match wins:
///
/// 1. **One of this room's own corners**, so the outline can close. And no
///    snap below is taken if it would knock a straight edge — a tap in line
///    with the previous corner — a few centimetres off square.
/// 2. **A neighbour's corner**, carried across whichever of its two walls the
///    tap is beside — so a bedroom drawn next to a closet starts level with
///    the closet's top, one partition to its right. Beyond both walls at
///    once, the outside corner of the wall itself.
/// 3. **A neighbour's wall** within `wallReach`, on its far face (or on the
///    edge itself, from inside). Along a square wall the other coordinate
///    lines up with any nearby corner, or failing that the grid.
/// 4. **The grid**, with each axis lining up with any nearby corner's — so a
///    room drawn past the end of another continues its wall line instead of
///    stepping 3 cm off it. The grid counts from this room's first corner,
///    so the walls come out at whole 5 cm lengths wherever the room starts.
enum DrawSnapping {
    struct Landing {
        let point: CGPoint
        /// Said under the canvas when the tap was moved onto something.
        let note: String?
    }

    static func snap(
        _ raw: CGPoint,
        corners: [CGPoint],
        neighbours: [(name: String, polygon: [CGPoint], wall: Double)],
        grid: Double,
        cornerReach: Double,
        wallReach: Double,
        alignReach: Double
    ) -> Landing {
        // 1. One of this room's own corners.
        var own: (point: CGPoint, distance: Double)?
        for p in corners {
            let d = hypot(p.x - raw.x, p.y - raw.y)
            if d <= cornerReach, own == nil || d < own!.distance { own = (p, d) }
        }
        if let own { return Landing(point: own.point, note: nil) }

        // **Keep a straight edge straight.** A tap in line with the previous
        // corner is an edge meant square — a wall snap that would knock it a
        // few centimetres off line is not help. Bathroom 1, drawn under the
        // storage room, came out with its top wall tilted 6 cm toward the
        // storage room's wall before this.
        let previous = corners.last
        func bends(_ q: CGPoint) -> Bool {
            guard let previous else { return false }
            let offX = abs(q.x - previous.x), offY = abs(q.y - previous.y)
            let tapX = abs(raw.x - previous.x), tapY = abs(raw.y - previous.y)
            return (tapY < alignReach && offY > 0.005) || (tapX < alignReach && offX > 0.005)
        }

        // Which room the tap is inside, if any: from there it means "share
        // this edge", from outside "put a wall between".
        let host = neighbours.firstIndex { contains($0.polygon, raw) }
        // Inside a room, that room is the only one being drawn against: a
        // hallway corner put on the edge of the entry it opens into must not
        // be pulled to the bedroom wall on the far side of it.
        let rooms = neighbours.enumerated().filter {
            $0.element.polygon.count >= 3 && (host == nil || $0.offset == host)
        }
        let everyRoom = neighbours.filter { $0.polygon.count >= 3 }

        // 2. A neighbour's corner.
        var corner: (point: CGPoint, distance: Double, note: String)?
        for (index, room) in rooms {
            let polygon = room.polygon
            for i in polygon.indices {
                let c = polygon[i]
                let target: CGPoint
                if index == host {
                    target = c
                } else {
                    let before = outwardNormal(polygon, (i + polygon.count - 1) % polygon.count)
                    let after = outwardNormal(polygon, i)
                    let v = CGPoint(x: raw.x - c.x, y: raw.y - c.y)
                    let outBefore = v.x * before.x + v.y * before.y
                    let outAfter = v.x * after.x + v.y * after.y
                    if outBefore > room.wall / 2, outAfter > room.wall / 2 {
                        // Beyond BOTH walls: the outside corner of the wall
                        // itself — a porch that stands proud of the house
                        // by the depth of its front wall.
                        let dot = before.x * after.x + before.y * after.y
                        let scale = room.wall / max(1 + dot, 0.1)
                        target = CGPoint(
                            x: c.x + (before.x + after.x) * scale,
                            y: c.y + (before.y + after.y) * scale)
                    } else {
                        let across = outBefore >= outAfter ? before : after
                        target = CGPoint(
                            x: c.x + across.x * room.wall, y: c.y + across.y * room.wall)
                    }
                }
                let d = hypot(target.x - raw.x, target.y - raw.y)
                guard d <= cornerReach, corner == nil || d < corner!.distance, !bends(target)
                else { continue }
                corner = (
                    target, d,
                    index == host ? "On \(room.name)'s corner" : "Against \(room.name)'s wall"
                )
            }
        }
        if let corner { return Landing(point: corner.point, note: corner.note) }

        // What a coordinate lines up with, nearest first in each tier: this
        // room's own corners, then the other rooms' corners, then the far
        // faces of their walls, then the grid.
        let origin = corners.first
        let near = everyRoom.flatMap { $0.polygon }
        let far = everyRoom.flatMap { offset($0.polygon, by: $0.wall) }
        func lineUpX(_ v: Double) -> Double {
            lineUp(v, corners.map { Double($0.x) }, alignReach)
                ?? lineUp(v, near.map { Double($0.x) }, alignReach)
                ?? lineUp(v, far.map { Double($0.x) }, alignReach)
                ?? onGrid(v, origin.map { Double($0.x) }, grid)
        }
        func lineUpY(_ v: Double) -> Double {
            lineUp(v, corners.map { Double($0.y) }, alignReach)
                ?? lineUp(v, near.map { Double($0.y) }, alignReach)
                ?? lineUp(v, far.map { Double($0.y) }, alignReach)
                ?? onGrid(v, origin.map { Double($0.y) }, grid)
        }

        // 3. A neighbour's wall.
        var onWall: (point: CGPoint, distance: Double, note: String)?
        for (index, room) in rooms {
            let polygon = room.polygon
            let shared = index == host
            let wall = room.wall
            for i in polygon.indices {
                var a = polygon[i]
                var b = polygon[(i + 1) % polygon.count]
                if !shared {
                    // The far face, run on past both ends by the wall's own
                    // thickness — the corner of a wall is solid too.
                    let n = outwardNormal(polygon, i)
                    let length = hypot(b.x - a.x, b.y - a.y)
                    guard length > 1e-6 else { continue }
                    let u = CGPoint(x: (b.x - a.x) / length, y: (b.y - a.y) / length)
                    a = CGPoint(x: a.x + n.x * wall - u.x * wall, y: a.y + n.y * wall - u.y * wall)
                    b = CGPoint(x: b.x + n.x * wall + u.x * wall, y: b.y + n.y * wall + u.y * wall)
                }
                guard let (foot, d) = project(raw, a, b), d <= wallReach else { continue }
                guard onWall == nil || d < onWall!.distance else { continue }
                var point = foot
                if abs(b.x - a.x) < 1e-6 {
                    point = CGPoint(
                        x: a.x, y: clamp(lineUpY(raw.y), min(a.y, b.y), max(a.y, b.y)))
                } else if abs(b.y - a.y) < 1e-6 {
                    point = CGPoint(
                        x: clamp(lineUpX(raw.x), min(a.x, b.x), max(a.x, b.x)), y: a.y)
                }
                guard !bends(point) else { continue }
                onWall = (
                    point, d,
                    shared ? "On \(room.name)'s edge — no wall between" : "Against \(room.name)'s wall"
                )
            }
        }
        if let onWall { return Landing(point: onWall.point, note: onWall.note) }

        // 4. The grid, lined up.
        return Landing(point: CGPoint(x: lineUpX(raw.x), y: lineUpY(raw.y)), note: nil)
    }

    /// The nearest of `candidates` within `reach`, if any.
    private static func lineUp(_ value: Double, _ candidates: [Double], _ reach: Double) -> Double? {
        var best: Double?
        for c in candidates where abs(c - value) <= reach {
            if best == nil || abs(c - value) < abs(best! - value) { best = c }
        }
        return best
    }

    /// The 5 cm grid, counted from `origin` when there is one.
    private static func onGrid(_ value: Double, _ origin: Double?, _ grid: Double) -> Double {
        let base = origin ?? 0
        return base + ((value - base) / grid).rounded() * grid
    }

    /// The unit normal of edge `i` (corner `i` to `i + 1`) pointing out of
    /// the room. Tested against the polygon rather than taken from its
    /// winding, which depends on which way somebody happened to tap.
    static func outwardNormal(_ polygon: [CGPoint], _ i: Int) -> CGPoint {
        let a = polygon[i]
        let b = polygon[(i + 1) % polygon.count]
        let length = hypot(b.x - a.x, b.y - a.y)
        guard length > 1e-9 else { return .zero }
        let n = CGPoint(x: -(b.y - a.y) / length, y: (b.x - a.x) / length)
        let probe = CGPoint(x: (a.x + b.x) / 2 + n.x * 1e-3, y: (a.y + b.y) / 2 + n.y * 1e-3)
        return contains(polygon, probe) ? CGPoint(x: -n.x, y: -n.y) : n
    }

    /// The polygon grown outward by `distance`, mitred at each corner — the
    /// far face of every wall.
    static func offset(_ polygon: [CGPoint], by distance: Double) -> [CGPoint] {
        guard polygon.count >= 3 else { return polygon }
        let count = polygon.count
        return polygon.indices.map { i in
            let before = outwardNormal(polygon, (i + count - 1) % count)
            let after = outwardNormal(polygon, i)
            // The mitre: the point `distance` out from BOTH walls.
            let sum = CGPoint(x: before.x + after.x, y: before.y + after.y)
            let dot = before.x * after.x + before.y * after.y
            let scale = distance / max(1 + dot, 0.1)
            return CGPoint(x: polygon[i].x + sum.x * scale, y: polygon[i].y + sum.y * scale)
        }
    }

    /// Even-odd point in polygon.
    static func contains(_ polygon: [CGPoint], _ p: CGPoint) -> Bool {
        guard polygon.count >= 3 else { return false }
        var inside = false
        var j = polygon.count - 1
        for i in polygon.indices {
            let a = polygon[i]
            let b = polygon[j]
            if (a.y > p.y) != (b.y > p.y),
                p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x
            {
                inside.toggle()
            }
            j = i
        }
        return inside
    }

    private static func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double {
        min(max(v, lo), hi)
    }

    /// The foot of the perpendicular from `p` to segment `ab`, and how far
    /// away it is — nil when the foot falls off either end.
    private static func project(_ p: CGPoint, _ a: CGPoint, _ b: CGPoint) -> (CGPoint, Double)? {
        let dx = b.x - a.x
        let dy = b.y - a.y
        let lengthSquared = dx * dx + dy * dy
        guard lengthSquared > 1e-9 else { return nil }
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared
        guard t >= -0.001, t <= 1.001 else { return nil }
        let foot = CGPoint(x: a.x + t * dx, y: a.y + t * dy)
        return (foot, hypot(p.x - foot.x, p.y - foot.y))
    }
}
