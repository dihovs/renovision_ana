import SwiftUI

/// Editing a plan with a finger.
///
/// Built to Docs/Interactive-Plan-Editor-Spec.md. The governing rule, and the
/// one that makes the whole thing safe to use one-handed on a job site:
///
///   **Two fingers navigate. One finger selects. One finger only EDITS what
///   is already selected.**
///
/// A stray thumb can pan and zoom all day without ever moving a wall. Nothing
/// is committed until Save, and the scan's own measurements are never
/// overwritten — an edited room keeps both, so "what did the laser say" is
/// always answerable.
struct PlanEditorView: View {
    let room: RoomScan
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss

    /// Corners of the room being edited. The polygon IS the model; walls are
    /// its edges, re-derived every frame, so there is no state in which a
    /// drag leaves a dangling wall.
    @State private var corners: [CGPoint] = []
    /// Doors and windows placed by hand, keyed to the polygon's edges. They
    /// travel with the corners through every undo as one snapshot, because an
    /// opening whose edge index outlives a corner edit is a door in the
    /// wrong wall.
    @State private var openings: [PlanEditing.WallOpening] = []
    @State private var history: [Snapshot] = []
    @State private var future: [Snapshot] = []

    @State private var selection: Selection = .none
    @State private var dragStart: Snapshot?
    @State private var snapEngaged = false
    @State private var liveLabel: String?
    /// The wall-by-wall measurement walk, when one is running. The queue is
    /// every wall in order starting from the one the operator asked about;
    /// the panel below the canvas drives it, the canvas highlights it.
    @State private var measuring: MeasureRun?
    @State private var addingOpening = false
    @State private var saving = false
    @State private var error: String?
    @State private var showDiscard = false
    /// Wall lengths the operator TYPED. A measured number and an entered one
    /// are different kinds of fact, and a claim file must be able to tell
    /// them apart.
    @State private var locked: Set<Int> = []
    @State private var lockedWarning: Int?

    struct Snapshot {
        var corners: [CGPoint]
        var openings: [PlanEditing.WallOpening]
        var locked: Set<Int>
    }

    /// Viewport, in the plan's own metres.
    @State private var zoom: CGFloat = 1
    @State private var pan: CGSize = .zero
    @GestureState private var pinch: CGFloat = 1
    @GestureState private var twoFingerPan: CGSize = .zero

    enum Selection: Equatable {
        case none
        case wall(Int)
        case corner(Int)
        /// Index into `openings`.
        case opening(Int)
    }


    // MARK: - Constants (from the spec's table)

    private let handleHit: CGFloat = 44
    private let handleDot: CGFloat = 13
    private let wallBand: CGFloat = 22
    private let captureRadius: CGFloat = 8

    private var scan: FloorPlanGeometry.Plan? {
        room.geometry.map { FloorPlanGeometry.plan(from: $0) }
    }

    private var isDirty: Bool { !history.isEmpty }

    private var invalid: Bool { PlanEditing.selfIntersects(corners) }

    /// Openings can be placed only where the scanner placed none: a typed or
    /// drawn room, or a scan that detected nothing. Detected openings live in
    /// the scan's own coordinate frame — mixing hand-placed ones into the
    /// same room risks deducting the same door twice, once as detected and
    /// once as declared.
    private var canAuthorOpenings: Bool {
        guard let geometry = room.geometry else { return true }
        if geometry.authoredOpenings != nil { return true }
        return geometry.doors.isEmpty && geometry.windows.isEmpty && geometry.openings.isEmpty
    }

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

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                VStack(spacing: 0) {
                    canvas
                    // While a measurement walk runs, the panel takes the
                    // controls' place — the canvas stays above, live, with
                    // the active wall highlighted.
                    if let run = measuring {
                        MeasurementPanel(
                            step: run.position,
                            total: run.queue.count,
                            current: PlanEditing.edgeLength(corners, run.active),
                            locked: locked.contains(run.active),
                            onCommit: { commitMeasurement($0) },
                            onUnlock: { locked.remove(run.active) },
                            onClose: { endMeasuring() })
                    } else {
                        controls
                    }
                }
            }
            .navigationTitle(room.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        if isDirty { showDiscard = true } else { dismiss() }
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        undo()
                    } label: {
                        Image(systemName: "arrow.uturn.backward")
                    }
                    .disabled(history.isEmpty)

                    Button {
                        redo()
                    } label: {
                        Image(systemName: "arrow.uturn.forward")
                    }
                    .disabled(future.isEmpty)

                    Button("Save") { Task { await save() } }
                        .fontWeight(.bold)
                        .disabled(saving || invalid || !isDirty)
                }
            }
            .task { load() }
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
            .confirmationDialog(
                "Discard your changes?", isPresented: $showDiscard, titleVisibility: .visible
            ) {
                Button("Discard", role: .destructive) { dismiss() }
                Button("Keep editing", role: .cancel) {}
            }
            .confirmationDialog(
                "A wall next to this one was measured by hand. Moving this wall changes it.",
                isPresented: Binding(
                    get: { lockedWarning != nil }, set: { if !$0 { lockedWarning = nil } }),
                titleVisibility: .visible
            ) {
                Button("Unlock and move it") {
                    if let index = lockedWarning {
                        let n = corners.count
                        locked.remove((index - 1 + n) % n)
                        locked.remove((index + 1) % n)
                    }
                    lockedWarning = nil
                }
                Button("Leave it alone", role: .cancel) { lockedWarning = nil }
            }
        }
    }

    // MARK: - Canvas

    private var canvas: some View {
        GeometryReader { proxy in
            let fit = fitScale(in: proxy.size)
            let scale = fit * zoom * pinch
            let centre = CGPoint(
                x: proxy.size.width / 2 + pan.width + twoFingerPan.width,
                y: proxy.size.height / 2 + pan.height + twoFingerPan.height)

            let toScreen = { (p: CGPoint) in
                self.screenPoint(p, centre: centre, scale: scale)
            }
            let toModel = { (p: CGPoint) in
                self.modelPoint(p, centre: centre, scale: scale)
            }

            ZStack {
                Canvas { context, _ in
                    let pt = toScreen

                    // The paper first: the half-metre dotted grid with its
                    // 2 m brand-blue crosshairs, behind everything, moving
                    // with the plan because it is drawn in the plan's own
                    // metres through the same mapping as the walls.
                    EditorChrome.drawGrid(
                        context: context, size: proxy.size,
                        toScreen: pt, toModel: toModel, scale: scale)

                    guard corners.count >= 3 else { return }

                    var floor = Path()
                    floor.move(to: pt(corners[0]))
                    for c in corners.dropFirst() { floor.addLine(to: pt(c)) }
                    floor.closeSubpath()
                    context.fill(floor, with: .color(Color(hex: 0xEFEEF4)))

                    // Any selection means the room is in hand, and the fill
                    // says so with a fine hatch — the flat grey alone can't,
                    // because the selected WALL already carries the blue.
                    if selection != .none {
                        EditorChrome.hatch(floor, context: context)
                    }

                    // Walls. The selected one is blue and thicker; an invalid
                    // shape goes dashed red — signalled, never blocked, since
                    // a finger often passes through a bad shape on its way to
                    // a good one.
                    for i in corners.indices {
                        let (a, b) = PlanEditing.edgeCorners(i, count: corners.count)
                        var wall = Path()
                        wall.move(to: pt(corners[a]))
                        wall.addLine(to: pt(corners[b]))

                        let isSelected = selection == .wall(i)
                        context.stroke(
                            wall,
                            with: .color(invalid ? .red : (isSelected ? Brand.blue : Color(hex: 0x111111))),
                            style: StrokeStyle(
                                lineWidth: isSelected ? max(6, 0.114 * scale + 4) : max(3, 0.114 * scale),
                                lineCap: .butt,
                                dash: invalid ? [8, 5] : []))
                    }

                    // Openings, cut into their walls: band break, jamb caps,
                    // our own glyphs. Drawn after the walls so the knock-out
                    // actually knocks out.
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

                    // The split dimension chain of the wall that owns the
                    // selection: offset · width · offset, the row that makes
                    // an opening's position a measurable fact.
                    if let edge = chainEdge {
                        OpeningGlyphs.drawChain(
                            edge: edge,
                            polygon: corners,
                            openings: openings,
                            context: context,
                            toScreen: pt,
                            proxySize: proxy.size)
                    }

                    // Corner handles, whenever anything is selected — they
                    // are what makes the shape feel grabbable.
                    if selection != .none {
                        for i in corners.indices {
                            let p = pt(corners[i])
                            let big = selection == .corner(i)
                            let r = (big ? handleDot + 3 : handleDot) / 2
                            context.fill(
                                Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)),
                                with: .color(big ? Brand.blue : .white))
                            context.stroke(
                                Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)),
                                with: .color(Brand.blue), lineWidth: 2)
                        }
                    }

                    // Every wall's length as a drafted string — witness
                    // lines, ticks, the figure along the run — offset
                    // OUTSIDE the walls where a dimension belongs, not a
                    // pill floating on the wall line. Locked values keep
                    // their padlock; the selected wall's string goes blue
                    // and bold with it.
                    EditorChrome.drawWallDimensions(
                        context: context,
                        polygon: corners,
                        toScreen: pt,
                        proxySize: proxy.size,
                        selectedEdge: {
                            if case .wall(let i) = selection { return i }
                            return nil
                        }(),
                        lockedEdges: locked)
                }

                // The live figure during a drag, well above the finger.
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
            // Two fingers navigate — always, whatever is selected.
            .gesture(
                SimultaneousGesture(
                    MagnificationGesture().updating($pinch) { value, state, _ in state = value }
                        .onEnded { value in
                            zoom = min(max(zoom * value, 0.5), 6)
                        },
                    DragGesture(minimumDistance: 0)
                        .updating($twoFingerPan) { _, _, _ in }
                )
            )
            .gesture(
                // One finger: edit what is selected, else select.
                DragGesture(minimumDistance: 4)
                    .onChanged { value in
                        handleDrag(value, scale: scale)
                    }
                    .onEnded { _ in
                        // A hand edit mid-walk becomes the walk's new ground
                        // truth — the next commit chains from what is on
                        // screen, not from before the drag.
                        if dragStart != nil, measuring != nil {
                            measuring?.baseline = corners
                            measuring?.typed = Array(repeating: nil, count: corners.count)
                        }
                        dragStart = nil
                        liveLabel = nil
                        snapEngaged = false
                    }
            )
            .onTapGesture { location in
                handleTap(toModel(location), scale: scale)
            }
        }
        .background(Brand.surface)
    }

    // MARK: - Gestures

    private func handleTap(_ point: CGPoint, scale: CGFloat) {
        let cornerTolerance = handleHit / 2 / scale
        for i in corners.indices where PlanEditing.length(PlanEditing.sub(corners[i], point)) < cornerTolerance {
            select(.corner(i))
            return
        }

        // Openings before walls: an opening lies ON its wall, so the wall
        // would otherwise always win the hit and the door could never be
        // picked up.
        let openingTolerance = wallBand / scale
        var bestOpening = -1
        var bestOpeningDistance = openingTolerance
        for i in openings.indices {
            let d = OpeningGlyphs.distance(to: openings[i], polygon: corners, from: point)
            if d < bestOpeningDistance {
                bestOpeningDistance = d
                bestOpening = i
            }
        }
        if bestOpening >= 0 {
            select(.opening(bestOpening))
            return
        }

        let wallTolerance = wallBand / scale
        var best = -1
        var bestDistance = wallTolerance
        for i in corners.indices {
            let d = distanceToEdge(point, index: i)
            if d < bestDistance {
                bestDistance = d
                best = i
            }
        }
        if best >= 0 {
            if measuring != nil {
                // Mid-walk, tapping a wall JUMPS the walk there — the queue
                // holds every wall, so the step counter stays honest.
                if let position = measuring?.queue.firstIndex(of: best) {
                    measuring?.position = position
                    select(.wall(best))
                }
            } else if selection == .wall(best) {
                // Tapping the already-selected wall's label opens the panel —
                // the dimension IS the control.
                startMeasuring(at: best)
            } else {
                select(.wall(best))
            }
            return
        }

        select(.none)
    }

    /// Model metres → screen points, about the plan's own middle so zooming
    /// does not walk the drawing off the edge.
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

    private func handleDrag(_ value: DragGesture.Value, scale: CGFloat) {
        guard selection != .none else { return }

        if dragStart == nil {
            dragStart = Snapshot(corners: corners, openings: openings, locked: locked)
            push()
        }
        guard let start = dragStart?.corners else { return }

        switch selection {
        case .wall(let index):
            // Dragging a wall changes its NEIGHBOURS' lengths, not its own —
            // so a locked neighbour is what has to be defended here.
            let n = start.count
            let neighbours = [(index - 1 + n) % n, (index + 1) % n]
            if neighbours.contains(where: { locked.contains($0) }), lockedWarning == nil {
                lockedWarning = index
                corners = start
                dragStart = nil
                return
            }

            let (a, b) = PlanEditing.edgeCorners(index, count: start.count)
            let direction = PlanEditing.normalised(PlanEditing.sub(start[b], start[a]))
            let sideways = PlanEditing.normal(direction)
            // Only the component across the wall counts; sliding along it
            // would move a wall through itself.
            let raw = PlanEditing.dot(
                CGPoint(x: value.translation.width / scale, y: value.translation.height / scale),
                sideways)

            let snap = PlanEditing.snapOffset(
                raw,
                candidates: PlanEditing.collinearCandidates(start, index: index),
                capture: captureRadius / scale,
                alreadyEngaged: snapEngaged)

            if snap.engaged && !snapEngaged {
                UISelectionFeedbackGenerator().selectionChanged()
            }
            snapEngaged = snap.engaged

            corners = PlanEditing.moveEdge(start, index: index, offset: snap.value)
            liveLabel = FloorPlanGeometry.feetInches(PlanEditing.edgeLength(corners, index))

        case .corner(let index):
            let moved = CGPoint(
                x: start[index].x + value.translation.width / scale,
                y: start[index].y + value.translation.height / scale)
            corners = PlanEditing.moveCorner(start, index: index, to: moved)
            let before = (index - 1 + corners.count) % corners.count
            liveLabel = "\(FloorPlanGeometry.feetInches(PlanEditing.edgeLength(corners, before)))  ·  \(FloorPlanGeometry.feetInches(PlanEditing.edgeLength(corners, index)))"

        case .opening(let index):
            guard let base = dragStart?.openings, base.indices.contains(index) else { return }
            let (a, b) = PlanEditing.edgeCorners(base[index].edge, count: start.count)
            let direction = PlanEditing.normalised(PlanEditing.sub(start[b], start[a]))
            // Only the component ALONG the wall counts — an opening slides in
            // its wall; it does not leave it.
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

    private func select(_ next: Selection) {
        guard selection != next else { return }
        UISelectionFeedbackGenerator().selectionChanged()
        withAnimation(.easeOut(duration: 0.15)) { selection = next }
    }

    // MARK: - Measurement walk

    /// Open the panel at a wall and queue every wall from there, in order —
    /// the walk the operator would make with a tape, starting where they
    /// are standing.
    private func startMeasuring(at edge: Int) {
        let n = corners.count
        guard n >= 3, edge >= 0, edge < n else { return }
        measuring = MeasureRun(
            queue: (0..<n).map { (edge + $0) % n },
            position: 0,
            baseline: corners,
            typed: Array(repeating: nil, count: n))
        select(.wall(edge))
    }

    /// One `Next`/`Apply`: apply the typed length if there is one, then
    /// advance. nil means "this wall is fine as it is" — skipping is how
    /// half the walls of a real room get treated.
    private func commitMeasurement(_ metres: Double?) {
        guard var run = measuring else { return }
        if let metres {
            push()
            if run.isLast {
                // The walk's closing wall is implied by all the others; a
                // value typed here anyway is applied the single-wall way,
                // and any inconsistency it carries lands on the neighbours
                // where the canvas shows it.
                corners = PlanEditing.setEdgeLength(corners, index: run.active, to: metres)
            } else {
                run.typed[run.active] = metres
                corners = PlanEditing.applyWalkLengths(
                    run.baseline, startEdge: run.queue[0], typed: run.typed)
            }
            // Typed IS locked. That is the whole point: the number came from
            // a person, and later drags must ask before overwriting it.
            locked.insert(run.active)
        }
        if run.isLast {
            endMeasuring()
        } else {
            run.position += 1
            measuring = run
            select(.wall(run.active))
        }
    }

    /// Close the panel. Values already committed stay committed — each
    /// `Next` was its own undoable step, so backing out of the walk is not
    /// the same as undoing it.
    private func endMeasuring() {
        measuring = nil
    }

    private func distanceToEdge(_ p: CGPoint, index: Int) -> Double {
        let (ai, bi) = PlanEditing.edgeCorners(index, count: corners.count)
        let a = corners[ai]
        let b = corners[bi]
        let ab = PlanEditing.sub(b, a)
        let l2 = PlanEditing.dot(ab, ab)
        guard l2 > 1e-9 else { return PlanEditing.length(PlanEditing.sub(p, a)) }
        var t = PlanEditing.dot(PlanEditing.sub(p, a), ab) / l2
        t = min(1, max(0, t))
        return PlanEditing.length(
            PlanEditing.sub(p, CGPoint(x: a.x + ab.x * t, y: a.y + ab.y * t)))
    }

    // MARK: - Controls

    private var controls: some View {
        VStack(spacing: Brand.Space.small) {
            if invalid {
                Text("These walls cross each other. Straighten them out to save.")
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
            if let error {
                Text(error).font(.footnote).foregroundStyle(.red)
            }

            // The shared contextual bar, in place of the old capsule strip —
            // it rewrites itself per selection, and both editors speak the
            // same verbs through it. Undo/redo stay in the toolbar and the
            // area readout stays below; only the verbs moved.
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
                    .font(.system(size: 15, weight: .bold).monospacedDigit())
                    .foregroundStyle(Brand.ink)
                Text("floor area")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkFaint)
                Spacer()
                if isDirty {
                    Text("Adjusted by hand")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.orange)
                }
            }
        }
        .padding(Brand.Space.base)
        .background(Brand.canvas)
    }

    /// This editor's selection, in the bar's shared shape. The capability
    /// answers travel with it: opening authoring is offered only where this
    /// editor allows it (`canAuthorOpenings` — a scanned room with detected
    /// openings refuses), and the last three corners are undeletable.
    private var barSelection: EditorBarSelection {
        switch selection {
        case .none:
            return .none(hint: "Tap a wall to select it. Two fingers to zoom and pan.")
        case .wall:
            return .wall(canAddOpening: canAuthorOpenings)
        case .corner:
            return .corner(deletable: corners.count > 3)
        case .opening(let index):
            guard openings.indices.contains(index) else {
                return .none(hint: "Tap a wall to select it. Two fingers to zoom and pan.")
            }
            let kind = openings[index].kind
            return .opening(label: kind.label, isWindow: kind.isWindowForBar)
        }
    }

    private func addCorner(on index: Int) {
        push()
        // The split renumbers every edge after it; openings and locks are
        // keyed by edge and must move too, or a door quietly changes wall.
        openings = PlanEditing.openingsAfterCornerAdded(
            openings, polygon: corners, splitEdge: index)
        locked = PlanEditing.lockedAfterCornerAdded(locked, splitEdge: index)
        let (next, made) = PlanEditing.addCorner(corners, onEdge: index)
        corners = next
        selection = .corner(made)
    }

    private func deleteCorner(_ index: Int) {
        push()
        openings = PlanEditing.openingsAfterCornerRemoved(
            openings, polygon: corners, corner: index)
        locked = PlanEditing.lockedAfterCornerRemoved(
            locked, corner: index, count: corners.count)
        corners = PlanEditing.removeCorner(corners, index: index)
        selection = .none
    }

    private func deleteOpening(_ index: Int) {
        guard openings.indices.contains(index) else { return }
        push()
        openings.remove(at: index)
        selection = .none
    }

    // MARK: - State

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
        let inset: CGFloat = 48
        return min(
            (size.width - inset * 2) / bounds.width,
            (size.height - inset * 2) / bounds.height)
    }

    private func load() {
        guard corners.isEmpty, let scan else { return }
        locked = Set(room.geometry?.lockedEdges ?? [])
        // The outline when the walls closed into one; the bounding box when
        // they did not, so an open scan is still editable rather than
        // refusing to appear.
        if scan.polygon.count >= 4 {
            corners = Array(scan.polygon.dropLast())
        } else {
            corners = [
                CGPoint(x: 0, y: 0), CGPoint(x: scan.width, y: 0),
                CGPoint(x: scan.width, y: scan.height), CGPoint(x: 0, y: scan.height),
            ]
        }
        // Placed openings come back in their editable form. An unknown kind
        // (from a newer build) is left out of the editor rather than guessed
        // at — deleting it here would delete it from the record on Save.
        openings = (room.geometry?.authoredOpenings ?? []).compactMap { record in
            guard let kind = PlanEditing.OpeningKind(rawValue: record.kind) else { return nil }
            return PlanEditing.WallOpening(
                edge: record.edge, offset: record.offset, width: record.width, kind: kind)
        }
    }

    private func push() {
        history.append(Snapshot(corners: corners, openings: openings, locked: locked))
        if history.count > 100 { history.removeFirst() }
        future.removeAll()
    }

    private func undo() {
        guard let previous = history.popLast() else { return }
        future.append(Snapshot(corners: corners, openings: openings, locked: locked))
        corners = previous.corners
        openings = previous.openings
        locked = previous.locked
        selection = .none
        // A measurement walk indexes the polygon it started on; geometry
        // restored from history may not be that polygon. End it.
        measuring = nil
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func redo() {
        guard let next = future.popLast() else { return }
        history.append(Snapshot(corners: corners, openings: openings, locked: locked))
        corners = next.corners
        openings = next.openings
        locked = next.locked
        selection = .none
        measuring = nil
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func save() async {
        saving = true
        error = nil
        do {
            try await API.shared.saveEditedPlan(
                roomId: room.id, corners: corners, locked: Array(locked).sorted(),
                // A room with detected openings says nothing about openings
                // here, so the detections survive the polygon correction.
                openings: canAuthorOpenings ? openings : nil,
                ceilingHeight: room.ceilingHeightM)
            onSaved()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}

/// Pick what goes into the selected wall.
///
/// Seven choices, not a catalogue: the doors and windows a water-damage
/// estimate actually meets, each with its builder's-stock width shown in the
/// units the operator thinks in. A kind that will not fit the wall is left
/// visible but disabled with the reason — same rule as the reference's
/// object library, without its object library.
struct OpeningPicker: View {
    let edgeLength: Double
    let fits: (PlanEditing.OpeningKind) -> Bool
    let onPick: (PlanEditing.OpeningKind) -> Void

    @Environment(\.dismiss) private var dismiss

    private static let doors: [PlanEditing.OpeningKind] = [
        .doorSingle, .doorDouble, .doorSliding, .doorCased,
    ]
    private static let windows: [PlanEditing.OpeningKind] = [
        .windowStandard, .windowWide, .windowSmall,
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.base) {
                        SectionHeading(title: "DOORS")
                        rows(Self.doors)

                        SectionHeading(title: "WINDOWS")
                            .padding(.top, Brand.Space.small)
                        rows(Self.windows)

                        Text("Widths are builders' stock sizes. The wall area a room is priced on drops by every opening placed here.")
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                            .padding(.top, Brand.Space.small)
                    }
                    .padding(Brand.Space.base)
                }
            }
            .navigationTitle("Add to this wall")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func rows(_ kinds: [PlanEditing.OpeningKind]) -> some View {
        VStack(spacing: Brand.Space.tight) {
            ForEach(kinds, id: \.self) { kind in
                let allowed = fits(kind)
                Button {
                    onPick(kind)
                } label: {
                    Card(padding: Brand.Space.small) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(kind.label)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(allowed ? Brand.ink : Brand.inkFaint)
                                Text(
                                    allowed
                                        ? FloorPlanGeometry.feetInches(kind.width) + " wide"
                                        : "Too wide for this wall"
                                )
                                .font(.system(size: 12))
                                .foregroundStyle(allowed ? Brand.inkSoft : .orange)
                            }
                            Spacer()
                            Image(systemName: "plus.circle")
                                .foregroundStyle(allowed ? Brand.blue : Brand.inkFaint)
                        }
                    }
                }
                .buttonStyle(.plain)
                .disabled(!allowed)
            }
        }
    }
}

