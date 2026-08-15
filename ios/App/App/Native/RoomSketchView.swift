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
    /// Observed so changing the unit redraws every dimension on the
    /// canvas, not just the keypad's own readout.
    @ObservedObject private var units = UnitSettings.shared
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
    @State private var showingViewModes = false
    @State private var showingLayers = false
    /// Drawing layers the layers stepper toggles (§3) — visibility only.
    @State private var showGrid = true
    @State private var showDimensions = true
    @State private var showOpenings = true

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

    private func push() {
        history.append(Snapshot(corners: corners, openings: openings))
    }

    private var sizeReady: Bool {
        guard let width, let length, let height else { return false }
        return width > 0.3 && width < 60 && length > 0.3 && length < 60 && height > 1 && height < 10
    }

    var body: some View {
        sketchPad.environment(\.colorScheme, .light)
    }

    /// The sketch pad, as a light document.
    ///
    /// Pinned to the light appearance because a drawing is ink on paper
    /// and paper does not invert. Fixing only the canvas would leave the
    /// chrome's ink inverting to near-white on top of white paper --
    /// trading an invisible drawing for invisible labels. It is also
    /// what the operator hands an adjuster: a plan that looks different
    /// on two phones is a plan whose measurements get questioned.
    private var sketchPad: some View {
        NavigationStack {
            ZStack {
                Brand.Plan.sheet.ignoresSafeArea()
                switch stage {
                case .size: sizeForm
                case .shape: shapeEditor
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                // §1's leading pill at the canvas; the size stage is a form,
                // not a drawing, and keeps the plain Cancel it always had —
                // chrome built for a canvas over a text form reads as noise.
                ToolbarItem(placement: .topBarLeading) {
                    if stage == .shape {
                        EditorBackPill(context: .room) { stage = .size }
                    } else {
                        Button("Cancel") { onCancel() }
                    }
                }
                ToolbarItem(placement: .principal) {
                    if stage == .shape {
                        EditorNavTitle(title: navTitle, subtitle: "New room")
                    } else {
                        EditorNavTitle(title: "Draw a room")
                    }
                }
                if stage == .shape {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Use it") {
                            onDone(corners, height ?? 2.44, openings)
                        }
                        .fontWeight(.bold)
                        .tint(Brand.blue)
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
                        // the plan editor, brand-blue crosshairs every fifth
                        // dot, drawn through this canvas's own mapping so it
                        // sits under the room, not behind the glass.
                        if showGrid {
                            EditorChrome.drawGrid(context: context, size: size)
                        }

                        guard corners.count >= 3 else { return }
                        let invalid = PlanEditing.selfIntersects(corners)

                        var floor = Path()
                        floor.move(to: pt(corners[0]))
                        for c in corners.dropFirst() { floor.addLine(to: pt(c)) }
                        floor.closeSubpath()

                        // §2: white with the fine tan tile grid, because this
                        // is the room you are inside. Same vocabulary as the
                        // plan editor, unconditional for the same reason —
                        // there is only ever the one room on this canvas.
                        context.fill(floor, with: .color(Brand.surface))
                        EditorChrome.tileGrid(floor, context: context, scale: scale)

                        for i in corners.indices {
                            let (a, b) = PlanEditing.edgeCorners(i, count: corners.count)
                            var wall = Path()
                            wall.move(to: pt(corners[a]))
                            wall.addLine(to: pt(corners[b]))
                            let selected = selection == .wall(i)
                            let core = selected ? 9 : max(3, 0.114 * scale)

                            // The wall's own footprint, under the black — see
                            // the note in PlanEditorView. Both canvases draw a
                            // wall the same way or the same room looks like
                            // two different buildings.
                            if !invalid {
                                context.stroke(
                                    wall, with: .color(Brand.Plan.wallFootprint),
                                    style: StrokeStyle(lineWidth: core + 7, lineCap: .butt))
                            }

                            context.stroke(
                                wall,
                                with: .color(invalid ? .red : (selected ? Brand.blue : Brand.Plan.ink)),
                                style: StrokeStyle(
                                    lineWidth: core,
                                    lineCap: .butt,
                                    dash: invalid ? [8, 5] : []))
                        }

                        // Openings, cut into their walls — band break, jamb
                        // caps, our own glyphs. Their split dimension chains
                        // are drawn with the wall dimensions below, so they
                        // appear on every wall that has one rather than only
                        // on the selected wall (ORD-18).
                        if showOpenings {
                            for (index, opening) in openings.enumerated() {
                                OpeningGlyphs.draw(
                                    opening,
                                    polygon: corners,
                                    selected: selection == .opening(index),
                                    context: context,
                                    toScreen: pt,
                                    scale: scale,
                                    inside: Brand.surface,
                                    outside: Brand.Plan.sheet)
                                if selection == .opening(index) {
                                    EditorChrome.drawOpeningSelection(
                                        context: context, polygon: corners, opening: opening,
                                        toScreen: pt, scale: scale)
                                }
                            }
                        }

                        // The selected wall's manipulators (§7) — the indigo
                        // diamond at its midpoint, the `▶◀` further along.
                        if case .wall(let index) = selection {
                            EditorChrome.drawWallHandles(
                                context: context, polygon: corners, edge: index,
                                toScreen: pt, winding: EditorChrome.winding(corners))
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
                        // as the plan editor, and the split chain on every
                        // wall that has an opening. A drawn room has no locks
                        // yet — every wall locks at save by definition — so
                        // the padlock set is empty here.
                        if showDimensions {
                            EditorChrome.drawWallDimensions(
                                context: context,
                                polygon: corners,
                                openings: showOpenings ? openings : [],
                                toScreen: pt,
                                proxySize: size,
                                selectedEdge: {
                                    if case .wall(let i) = selection { return i }
                                    return nil
                                }(),
                                lockedEdges: [],
                            format: units.format)
                        }
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
            .background(Brand.Plan.sheet)
            .overlay(alignment: .top) { floatingControls }

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

    /// §3. The same floating controls as the plan editor, minus a redo half
    /// this editor has never had: its history is a plain undo stack, so the
    /// redo side greys out permanently rather than being left off the pill —
    /// §3 is explicit that the pill never loses a half.
    private var floatingControls: some View {
        HStack(alignment: .top) {
            EditorUndoRedoPill(
                canUndo: !history.isEmpty,
                canRedo: false,
                onUndo: {
                    if let previous = history.popLast() {
                        corners = previous.corners
                        openings = previous.openings
                        selection = .none
                        // The walk indexes the polygon it started on;
                        // restored geometry may not be it.
                        measuring = nil
                    }
                },
                onRedo: {})

            Spacer()

            HStack(spacing: Brand.Space.tight) {
                EditorStepperPill {
                    showingLayers = true
                } content: {
                    Image(systemName: "square.stack.3d.up")
                        .font(.system(size: 15))
                }
                .popover(isPresented: $showingLayers) {
                    VStack(alignment: .leading, spacing: 0) {
                        layerToggle("Grid", isOn: $showGrid)
                        Divider()
                        layerToggle("Dimensions", isOn: $showDimensions)
                        Divider()
                        layerToggle("Doors & windows", isOn: $showOpenings)
                    }
                    .frame(width: 240)
                    .presentationCompactAdaptation(.popover)
                }

                EditorStepperPill {
                    showingViewModes = true
                } content: {
                    Text("2D").font(.system(size: 14, weight: .bold))
                }
                .popover(isPresented: $showingViewModes) {
                    EditorViewModeMenu(
                        current: .plan,
                        // A room being drawn has not been saved, so it has no
                        // scan id — and elevation is per-wall on a saved room
                        // (ORD-19 takes one). The blocking reason says the
                        // truth about our app rather than repeating the
                        // reference's "only available inside rooms".
                        elevationBlocked: "Available once this room is saved",
                        threeDBlocked: "Not built yet — the room editor is 2D",
                        onPick: { _ in showingViewModes = false })
                    .presentationCompactAdaptation(.popover)
                }
            }
        }
        .padding(Brand.Space.small)
    }

    private func layerToggle(_ label: String, isOn: Binding<Bool>) -> some View {
        Button {
            isOn.wrappedValue.toggle()
        } label: {
            HStack {
                Text(label)
                    .font(.system(size: 15))
                    .foregroundStyle(Brand.ink)
                Spacer()
                Image(systemName: "checkmark")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Brand.blue)
                    .opacity(isOn.wrappedValue ? 1 : 0)
            }
            .padding(.horizontal, Brand.Space.base)
            .padding(.vertical, Brand.Space.small)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    private var controls: some View {
        VStack(spacing: Brand.Space.small) {
            if PlanEditing.selfIntersects(corners) {
                Text("These walls cross. Straighten them out before using this room.")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(.horizontal, Brand.Space.base)
            }

            HStack {
                Text(Measure.sqftLabel(PlanEditing.area(corners)))
                    .font(.system(size: 17, weight: .bold).monospacedDigit())
                    .foregroundStyle(Brand.ink)
                Text("floor area")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkFaint)
                Spacer()
            }
            .padding(.horizontal, Brand.Space.base)

            // §4's bar — the same component and the same verbs as the plan
            // editor, so the two canvases stay one skill. No swipe-up
            // caption: this room has no inspector yet, because it does not
            // exist until "Use it".
            EditorActionBar(
                depth: barDepth,
                supported: supportedActions,
                onAction: perform)
        }
        .padding(.top, Brand.Space.small)
        .background(Brand.Plan.sheet)
    }

    /// The nav title changes with depth, the same as the plan editor's.
    private var navTitle: String {
        switch selection {
        case .none: return "Pull it into shape"
        case .wall: return "Wall"
        case .corner: return "Corner"
        case .opening(let index):
            guard openings.indices.contains(index) else { return "Pull it into shape" }
            return openings[index].kind.label
        }
    }

    /// This editor's selection as a depth the shared bar understands.
    private var barDepth: EditorDepth {
        switch selection {
        case .none:
            return .room(name: "New room")
        case .wall:
            return .wall(dragging: dragStart != nil)
        case .corner:
            return .corner
        case .opening(let index):
            guard openings.indices.contains(index) else { return .room(name: "New room") }
            return .opening(label: openings[index].kind.label)
        }
    }

    /// Which of §4's verbs this editor can perform. Opening authoring is
    /// always on — a drawn room has no detected openings to double-count,
    /// which is the one place this editor is more capable than the plan one.
    /// Everything absent here is absent for the reasons set out on
    /// `PlanEditorView.supportedActions`.
    private var supportedActions: Set<EditorAction> {
        switch selection {
        case .none:
            return [.setSize]
        case .wall:
            return [.insert, .addCorner]
        case .corner:
            return corners.count > 3 ? [.delete] : []
        case .opening:
            return [.delete]
        }
    }

    private func perform(_ action: EditorAction) {
        switch (action, selection) {
        case (.setSize, _):
            startMeasuring(at: 0)
        case (.insert, .wall):
            addingOpening = true
        case (.addCorner, .wall(let index)):
            addCorner(on: index)
        case (.delete, .corner(let index)):
            deleteCorner(index)
        case (.delete, .opening(let index)):
            deleteOpening(index)
        default:
            break
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
            liveLabel = UnitSettings.shared.format.format(PlanEditing.edgeLength(corners, index))

        case .corner(let index):
            corners = PlanEditing.moveCorner(
                start, index: index,
                to: CGPoint(
                    x: start[index].x + value.translation.width / scale,
                    y: start[index].y + value.translation.height / scale))
            let before = (index - 1 + corners.count) % corners.count
            liveLabel =
                "\(UnitSettings.shared.format.format(PlanEditing.edgeLength(corners, before)))  ·  \(UnitSettings.shared.format.format(PlanEditing.edgeLength(corners, index)))"

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
                .map(UnitSettings.shared.format.format)
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

