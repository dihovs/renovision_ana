import SwiftUI

/// Draw a room by hand.
///
/// The fallback that matters more than it sounds. LiDAR needs a Pro phone;
/// the camera modes need light and texture to track against. A gutted
/// basement at eight in the evening with the power off has neither, and that
/// is an ordinary Tuesday on a water-damage job. A tape measure and a finger
/// always work.
///
/// It opens as a rectangle you type the size of, because almost every room
/// is one — and then it is the same canvas as the plan editor, so an L-shaped
/// basement is that rectangle with a corner pulled in. Nothing new to learn.
struct RoomSketchView: View {
    let onCancel: () -> Void
    let onDone: ([CGPoint], Double, [PlanEditing.WallOpening]) -> Void

    @State private var stage: Stage = .size
    @State private var widthText = "12"
    @State private var lengthText = "10"
    @State private var heightText = "8"
    @State private var corners: [CGPoint] = []
    /// Doors and windows placed on the drawn walls. Snapshotted with the
    /// corners, because they are keyed to edge indices — an undo that
    /// restored one without the other would hang a door on the wrong wall.
    @State private var openings: [PlanEditing.WallOpening] = []
    @State private var history: [Snapshot] = []
    @State private var selection: Selection = .none
    @State private var dragStart: Snapshot?
    @State private var snapEngaged = false
    @State private var liveLabel: String?
    /// The wall-by-wall measurement walk, when one is running — same panel
    /// and same walk as the plan editor.
    @State private var measuring: MeasureRun?
    @State private var addingOpening = false

    private enum Stage { case size, shape }

    private struct Snapshot {
        var corners: [CGPoint]
        var openings: [PlanEditing.WallOpening]
    }

    private enum Selection: Equatable {
        case none
        case wall(Int)
        case corner(Int)
        /// Index into `openings`.
        case opening(Int)
    }

    private var width: Double? { FloorPlanGeometry.parseFeetInches(widthText) }
    private var length: Double? { FloorPlanGeometry.parseFeetInches(lengthText) }
    private var height: Double? { FloorPlanGeometry.parseFeetInches(heightText) }

    /// The wall whose dimension chain is split right now: the selected wall,
    /// or the host wall of the selected opening.
    private var chainEdge: Int? {
        switch selection {
        case .wall(let index):
            return openings.contains { $0.edge == index } ? index : nil
        case .opening(let index):
            return openings.indices.contains(index) ? openings[index].edge : nil
        case .none, .corner:
            return nil
        }
    }

    private func push() {
        history.append(Snapshot(corners: corners, openings: openings))
    }

    private var sizeReady: Bool {
        guard let width, let length, let height else { return false }
        return width > 0.3 && width < 60 && length > 0.3 && length < 60 && height > 1 && height < 10
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()
                switch stage {
                case .size: sizeForm
                case .shape: shapeEditor
                }
            }
            .navigationTitle(stage == .size ? "Draw a room" : "Pull it into shape")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { onCancel() }
                }
                if stage == .shape {
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        Button {
                            if let previous = history.popLast() {
                                corners = previous.corners
                                openings = previous.openings
                                selection = .none
                                // The walk indexes the polygon it started
                                // on; restored geometry may not be it.
                                measuring = nil
                            }
                        } label: {
                            Image(systemName: "arrow.uturn.backward")
                        }
                        .disabled(history.isEmpty)

                        Button("Use it") {
                            onDone(corners, height ?? 2.44, openings)
                        }
                        .fontWeight(.bold)
                        .disabled(PlanEditing.selfIntersects(corners))
                    }
                }
            }
            .sheet(isPresented: $addingOpening) {
                if case .wall(let edge) = selection {
                    OpeningPicker(
                        edgeLength: PlanEditing.edgeLength(corners, edge),
                        fits: { kind in
                            PlanEditing.placeOpening(
                                kind, onEdge: edge, of: corners, avoiding: openings) != nil
                        }
                    ) { kind in
                        if let placed = PlanEditing.placeOpening(
                            kind, onEdge: edge, of: corners, avoiding: openings)
                        {
                            push()
                            openings.append(placed)
                            selection = .opening(openings.count - 1)
                        }
                        addingOpening = false
                    }
                }
            }
        }
    }

    // MARK: - Measurement walk

    /// Open the panel at a wall and queue every wall from there, in order —
    /// the walk the operator would make with a tape.
    private func startMeasuring(at edge: Int) {
        let n = corners.count
        guard n >= 3, edge >= 0, edge < n else { return }
        measuring = MeasureRun(
            queue: (0..<n).map { (edge + $0) % n },
            position: 0,
            baseline: corners,
            typed: Array(repeating: nil, count: n))
        selection = .wall(edge)
    }

    /// One `Next`/`Apply`: apply the typed length if any, then advance.
    /// nil means "this wall is fine as it is".
    private func commitMeasurement(_ metres: Double?) {
        guard var run = measuring else { return }
        if let metres {
            push()
            if run.isLast {
                // The walk's closing wall is implied by all the others; a
                // value typed here anyway is applied the single-wall way.
                corners = PlanEditing.setEdgeLength(corners, index: run.active, to: metres)
            } else {
                run.typed[run.active] = metres
                corners = PlanEditing.applyWalkLengths(
                    run.baseline, startEdge: run.queue[0], typed: run.typed)
            }
        }
        if run.isLast {
            measuring = nil
        } else {
            run.position += 1
            measuring = run
            selection = .wall(run.active)
        }
    }

    // MARK: - Size

    private var sizeForm: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Brand.Space.base) {
                Text("Most rooms are a rectangle. Start with one, then pull any corner in for an L or a bump-out.")
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.inkSoft)

                Field(label: "WIDTH", text: $widthText, placeholder: "12' 6")
                Field(label: "LENGTH", text: $lengthText, placeholder: "10'")
                Field(label: "CEILING HEIGHT", text: $heightText, placeholder: "8'")

                // The live figure is the cheapest error check there is: a
                // slipped decimal shows up instantly as an absurd area.
                if let width, let length {
                    HStack {
                        Text(Measure.sqftLabel(width * length))
                            .font(.system(size: 26, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(.white)
                        Text("floor area")
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.6))
                        Spacer()
                    }
                    .padding(Brand.Space.base)
                    .background(Brand.charcoalDark, in: .rect(cornerRadius: Brand.Radius.card))
                }

                Text("Feet and inches — type 12' 6, or 12.5.")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.inkFaint)

                Button("Draw it") {
                    guard let width, let length else { return }
                    corners = [
                        CGPoint(x: 0, y: 0), CGPoint(x: width, y: 0),
                        CGPoint(x: width, y: length), CGPoint(x: 0, y: length),
                    ]
                    stage = .shape
                }
                .buttonStyle(PrimaryButtonStyle(enabled: sizeReady))
                .disabled(!sizeReady)
            }
            .padding(Brand.Space.base)
        }
    }

    // MARK: - Shape

    private var shapeEditor: some View {
        VStack(spacing: 0) {
            GeometryReader { proxy in
                let scale = fitScale(in: proxy.size)
                let centre = CGPoint(x: proxy.size.width / 2, y: proxy.size.height / 2)

                let toScreen = { (p: CGPoint) in
                    self.screenPoint(p, centre: centre, scale: scale)
                }
                let toModel = { (p: CGPoint) in
                    self.modelPoint(p, centre: centre, scale: scale)
                }

                ZStack {
                    Canvas { context, size in
                        let pt = toScreen

                        // The paper first: the same half-metre dotted grid as
                        // the plan editor, brand-blue crosshairs on the 2 m
                        // majors, drawn through this canvas's own mapping so
                        // it sits under the room, not behind the glass.
                        EditorChrome.drawGrid(
                            context: context, size: size,
                            toScreen: pt, toModel: toModel, scale: scale)

                        guard corners.count >= 3 else { return }
                        let invalid = PlanEditing.selfIntersects(corners)

                        var floor = Path()
                        floor.move(to: pt(corners[0]))
                        for c in corners.dropFirst() { floor.addLine(to: pt(c)) }
                        floor.closeSubpath()
                        context.fill(floor, with: .color(Color(hex: 0xEFEEF4)))

                        // Any selection means the room is in hand — the fill
                        // hatches to say so, same vocabulary as the plan
                        // editor.
                        if selection != .none {
                            EditorChrome.hatch(floor, context: context)
                        }

                        for i in corners.indices {
                            let (a, b) = PlanEditing.edgeCorners(i, count: corners.count)
                            var wall = Path()
                            wall.move(to: pt(corners[a]))
                            wall.addLine(to: pt(corners[b]))
                            let selected = selection == .wall(i)
                            context.stroke(
                                wall,
                                with: .color(invalid ? .red : (selected ? Brand.blue : Color(hex: 0x111111))),
                                style: StrokeStyle(
                                    lineWidth: selected ? 9 : max(3, 0.114 * scale),
                                    lineCap: .butt,
                                    dash: invalid ? [8, 5] : []))
                        }

                        // Openings, cut into their walls — band break, jamb
                        // caps, our own glyphs — then the split dimension
                        // chain for the wall that owns the selection.
                        for (index, opening) in openings.enumerated() {
                            OpeningGlyphs.draw(
                                opening,
                                polygon: corners,
                                selected: selection == .opening(index),
                                context: context,
                                toScreen: pt,
                                scale: scale,
                                background: Brand.surface)
                        }
                        if let edge = chainEdge {
                            OpeningGlyphs.drawChain(
                                edge: edge,
                                polygon: corners,
                                openings: openings,
                                context: context,
                                toScreen: pt,
                                proxySize: proxy.size)
                        }

                        for i in corners.indices {
                            let p = pt(corners[i])
                            let big = selection == .corner(i)
                            let r: CGFloat = big ? 9 : 7
                            context.fill(
                                Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)),
                                with: .color(big ? Brand.blue : .white))
                            context.stroke(
                                Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)),
                                with: .color(Brand.blue), lineWidth: 2)
                        }

                        // Drafted dimension strings outside the walls, same
                        // as the plan editor. A drawn room has no locks yet
                        // — every wall locks at save by definition — so the
                        // padlock set is empty here.
                        EditorChrome.drawWallDimensions(
                            context: context,
                            polygon: corners,
                            toScreen: pt,
                            proxySize: size,
                            selectedEdge: {
                                if case .wall(let i) = selection { return i }
                                return nil
                            }(),
                            lockedEdges: [])
                    }

                    if let liveLabel {
                        VStack {
                            Text(liveLabel)
                                .font(.system(size: 15, weight: .bold).monospacedDigit())
                                .foregroundStyle(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(Brand.charcoalDark, in: .capsule)
                                .padding(.top, 12)
                            Spacer()
                        }
                    }
                }
                .contentShape(.rect)
                .gesture(
                    DragGesture(minimumDistance: 4)
                        .onChanged { value in drag(value, scale: scale) }
                        .onEnded { _ in
                            // A hand edit mid-walk becomes the walk's new
                            // ground truth.
                            if dragStart != nil, measuring != nil {
                                measuring?.baseline = corners
                                measuring?.typed = Array(repeating: nil, count: corners.count)
                            }
                            dragStart = nil
                            liveLabel = nil
                            snapEngaged = false
                        }
                )
                .onTapGesture { location in tap(toModel(location), scale: scale) }
            }
            .background(Brand.surface)

            // While a measurement walk runs, the panel takes the controls'
            // place — the canvas stays above with the active wall
            // highlighted, redrawing as each value lands.
            if let run = measuring {
                MeasurementPanel(
                    step: run.position,
                    total: run.queue.count,
                    current: PlanEditing.edgeLength(corners, run.active),
                    // A drawn room's every wall is a typed number by
                    // definition and locks at save; mid-draw there is no
                    // lock to show or defend.
                    locked: false,
                    onCommit: { commitMeasurement($0) },
                    onClose: { measuring = nil })
            } else {
                controls
            }
        }
    }

    private var controls: some View {
        VStack(spacing: Brand.Space.small) {
            if PlanEditing.selfIntersects(corners) {
                Text("These walls cross. Straighten them out before using this room.")
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            // The shared contextual bar — the same component and the same
            // verbs as the plan editor, so the two canvases stay one skill.
            // This editor authors openings unconditionally (a drawn room has
            // no scan to conflict with), so the wall case always offers it.
            EditorActionBar(
                selection: barSelection,
                onTypeLength: {
                    if case .wall(let index) = selection { startMeasuring(at: index) }
                },
                onAddCorner: {
                    if case .wall(let index) = selection { addCorner(on: index) }
                },
                onAddOpening: { addingOpening = true },
                onDeleteCorner: {
                    if case .corner(let index) = selection { deleteCorner(index) }
                },
                onDeleteOpening: {
                    if case .opening(let index) = selection { deleteOpening(index) }
                })

            HStack {
                Text(Measure.sqftLabel(PlanEditing.area(corners)))
                    .font(.system(size: 17, weight: .bold).monospacedDigit())
                    .foregroundStyle(Brand.ink)
                Text("floor area")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkFaint)
                Spacer()
            }
        }
        .padding(Brand.Space.base)
        .background(Brand.canvas)
    }

    /// This editor's selection, in the bar's shared shape. Opening authoring
    /// is always on — a drawn room has no detected openings to double-count.
    private var barSelection: EditorBarSelection {
        switch selection {
        case .none:
            return .none(hint: "Tap a wall to move it, or a corner to drag it.")
        case .wall:
            return .wall(canAddOpening: true)
        case .corner:
            return .corner(deletable: corners.count > 3)
        case .opening(let index):
            guard openings.indices.contains(index) else {
                return .none(hint: "Tap a wall to move it, or a corner to drag it.")
            }
            let kind = openings[index].kind
            return .opening(label: kind.label, isWindow: kind.isWindowForBar)
        }
    }

    private func addCorner(on index: Int) {
        push()
        // Openings are keyed by edge index; the split renumbers the edges,
        // so they move together.
        openings = PlanEditing.openingsAfterCornerAdded(
            openings, polygon: corners, splitEdge: index)
        let (next, made) = PlanEditing.addCorner(corners, onEdge: index)
        corners = next
        selection = .corner(made)
    }

    private func deleteCorner(_ index: Int) {
        push()
        openings = PlanEditing.openingsAfterCornerRemoved(
            openings, polygon: corners, corner: index)
        corners = PlanEditing.removeCorner(corners, index: index)
        selection = .none
    }

    private func deleteOpening(_ index: Int) {
        guard openings.indices.contains(index) else { return }
        push()
        openings.remove(at: index)
        selection = .none
    }

    // MARK: - Gestures

    private func tap(_ point: CGPoint, scale: CGFloat) {
        let cornerTolerance = 22 / scale
        for i in corners.indices
        where PlanEditing.length(PlanEditing.sub(corners[i], point)) < cornerTolerance {
            UISelectionFeedbackGenerator().selectionChanged()
            selection = .corner(i)
            return
        }

        // Openings before walls: an opening lies ON its wall, so the wall
        // would otherwise always win the hit.
        var bestOpening = -1
        var bestOpeningDistance = 22 / scale
        for i in openings.indices {
            let d = OpeningGlyphs.distance(to: openings[i], polygon: corners, from: point)
            if d < bestOpeningDistance {
                bestOpeningDistance = d
                bestOpening = i
            }
        }
        if bestOpening >= 0 {
            UISelectionFeedbackGenerator().selectionChanged()
            selection = .opening(bestOpening)
            return
        }

        var best = -1
        var bestDistance = 22 / scale
        for i in corners.indices {
            let d = distanceToEdge(point, index: i)
            if d < bestDistance {
                bestDistance = d
                best = i
            }
        }
        if best >= 0, measuring != nil {
            // Mid-walk, tapping a wall JUMPS the walk there — the queue
            // holds every wall, so the step counter stays honest.
            if let position = measuring?.queue.firstIndex(of: best) {
                measuring?.position = position
                UISelectionFeedbackGenerator().selectionChanged()
                selection = .wall(best)
            }
            return
        }
        UISelectionFeedbackGenerator().selectionChanged()
        selection = best >= 0 ? .wall(best) : .none
    }

    private func drag(_ value: DragGesture.Value, scale: CGFloat) {
        guard selection != .none else { return }
        if dragStart == nil {
            dragStart = Snapshot(corners: corners, openings: openings)
            push()
        }
        guard let start = dragStart?.corners else { return }

        switch selection {
        case .wall(let index):
            let (a, b) = PlanEditing.edgeCorners(index, count: start.count)
            let sideways = PlanEditing.normal(
                PlanEditing.normalised(PlanEditing.sub(start[b], start[a])))
            let raw = PlanEditing.dot(
                CGPoint(x: value.translation.width / scale, y: value.translation.height / scale),
                sideways)
            let snap = PlanEditing.snapOffset(
                raw,
                candidates: PlanEditing.collinearCandidates(start, index: index),
                capture: 8 / scale,
                alreadyEngaged: snapEngaged)
            if snap.engaged && !snapEngaged { UISelectionFeedbackGenerator().selectionChanged() }
            snapEngaged = snap.engaged
            corners = PlanEditing.moveEdge(start, index: index, offset: snap.value)
            liveLabel = FloorPlanGeometry.feetInches(PlanEditing.edgeLength(corners, index))

        case .corner(let index):
            corners = PlanEditing.moveCorner(
                start, index: index,
                to: CGPoint(
                    x: start[index].x + value.translation.width / scale,
                    y: start[index].y + value.translation.height / scale))
            let before = (index - 1 + corners.count) % corners.count
            liveLabel =
                "\(FloorPlanGeometry.feetInches(PlanEditing.edgeLength(corners, before)))  ·  \(FloorPlanGeometry.feetInches(PlanEditing.edgeLength(corners, index)))"

        case .opening(let index):
            guard let base = dragStart?.openings, base.indices.contains(index) else { return }
            let (a, b) = PlanEditing.edgeCorners(base[index].edge, count: start.count)
            let direction = PlanEditing.normalised(PlanEditing.sub(start[b], start[a]))
            // Only the component ALONG the wall counts — an opening slides
            // in its wall; it does not leave it.
            let along = PlanEditing.dot(
                CGPoint(x: value.translation.width / scale, y: value.translation.height / scale),
                direction)
            openings[index] = PlanEditing.slideOpening(
                base[index], along: corners, by: along,
                avoiding: openings.enumerated().filter { $0.offset != index }.map(\.element))
            liveLabel = PlanEditing.chain(corners, edge: base[index].edge, openings: openings)
                .map(FloorPlanGeometry.feetInches)
                .joined(separator: "  ·  ")

        case .none:
            break
        }
    }

    private func distanceToEdge(_ p: CGPoint, index: Int) -> Double {
        let (ai, bi) = PlanEditing.edgeCorners(index, count: corners.count)
        let a = corners[ai]
        let ab = PlanEditing.sub(corners[bi], a)
        let l2 = PlanEditing.dot(ab, ab)
        guard l2 > 1e-9 else { return PlanEditing.length(PlanEditing.sub(p, a)) }
        var t = PlanEditing.dot(PlanEditing.sub(p, a), ab) / l2
        t = min(1, max(0, t))
        return PlanEditing.length(
            PlanEditing.sub(p, CGPoint(x: a.x + ab.x * t, y: a.y + ab.y * t)))
    }

    // MARK: - Viewport

    private var bounds: CGRect {
        guard !corners.isEmpty else { return CGRect(x: 0, y: 0, width: 1, height: 1) }
        let xs = corners.map(\.x)
        let ys = corners.map(\.y)
        return CGRect(
            x: xs.min()!, y: ys.min()!,
            width: max(xs.max()! - xs.min()!, 0.1),
            height: max(ys.max()! - ys.min()!, 0.1))
    }

    private func fitScale(in size: CGSize) -> CGFloat {
        min((size.width - 80) / bounds.width, (size.height - 80) / bounds.height)
    }

    private func screenPoint(_ p: CGPoint, centre: CGPoint, scale: CGFloat) -> CGPoint {
        CGPoint(
            x: centre.x + (p.x - bounds.midX) * scale,
            y: centre.y + (p.y - bounds.midY) * scale)
    }

    private func modelPoint(_ p: CGPoint, centre: CGPoint, scale: CGFloat) -> CGPoint {
        CGPoint(
            x: (p.x - centre.x) / scale + bounds.midX,
            y: (p.y - centre.y) / scale + bounds.midY)
    }
}

