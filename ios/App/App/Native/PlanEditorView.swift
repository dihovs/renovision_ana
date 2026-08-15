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

    /// Which projection the canvas is drawing (§3/§5). The plan editor opens
    /// in 2D and, in this build, stays there — see `threeDBlocked` below.
    @State private var mode: EditorViewMode = .plan
    @State private var showingViewModes = false
    @State private var showingLayers = false
    @State private var showingHelp = false
    /// Drawing layers the layers stepper toggles (§3). Visibility only — no
    /// geometry is touched, so nothing here can be mistaken for an edit.
    @State private var showGrid = true
    @State private var showDimensions = true
    @State private var showOpenings = true

    /// The wall the elevation view is looking at, when one is open.
    ///
    /// ORD-19's `ElevationView` is being built in parallel and does not exist
    /// in this worktree. The state, the double-tap that sets it and the
    /// view-mode row that sets it are all wired; only the presentation itself
    /// is stubbed — see `elevationPresentation` at the bottom of this file.
    @State private var elevationWall: Int?

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

    var body: some View {
        editor.environment(\.colorScheme, .light)
    }

    /// The editor, as a light document.
    ///
    /// Pinned to the light appearance because a drawing is ink on paper
    /// and paper does not invert. Fixing only the canvas would leave the
    /// chrome's ink inverting to near-white on top of white paper --
    /// trading an invisible drawing for invisible labels. It is also
    /// what the operator hands an adjuster: a plan that looks different
    /// on two phones is a plan whose measurements get questioned.
    private var editor: some View {
        NavigationStack {
            ZStack {
                Brand.Plan.sheet.ignoresSafeArea()

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
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                // §1. Leading is the pill — a back chevron beside a context
                // glyph saying what you would go back TO. From here that is
                // the room's own inspector, so the glyph is the room one.
                ToolbarItem(placement: .topBarLeading) {
                    EditorBackPill(context: .room) {
                        if isDirty { showDiscard = true } else { dismiss() }
                    }
                }
                // Centre: bold title, grey subtitle, both changing with
                // depth — `Wall` / `Ground Floor`, `Window` / `Ground Floor`.
                ToolbarItem(placement: .principal) {
                    EditorNavTitle(title: navTitle, subtitle: navSubtitle)
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        showingHelp = true
                    } label: {
                        Image(systemName: "questionmark.circle")
                            .font(.system(size: 17))
                    }
                    .tint(Brand.blue)

                    // Save is ours, not the reference's: magicplan saves
                    // continuously and has no such button, but this editor
                    // posts a corrected polygon to the API and the operator
                    // has to be able to say when. It takes the slot §1 gives
                    // the share glyph, which would have nothing to share
                    // from a room whose edits are not committed yet.
                    Button("Save") { Task { await save() } }
                        .fontWeight(.bold)
                        .tint(Brand.blue)
                        .disabled(saving || invalid || !isDirty)
                }
            }
            .popover(isPresented: $showingHelp) { helpCard }
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
            // ORD-19's elevation view, full screen over the plan. The state,
            // the double-tap and the view-mode row are all live; only what
            // gets presented is stubbed — see `elevationPresentation`.
            .fullScreenCover(
                isPresented: Binding(
                    get: { elevationWall != nil },
                    set: { if !$0 { closeElevation() } })
            ) {
                elevationPresentation
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
                    // brand-blue crosshairs every fifth dot, behind
                    // everything, moving with the plan because it is drawn in
                    // the plan's own metres through the same mapping as the
                    // walls.
                    if showGrid {
                        EditorChrome.drawGrid(
                            context: context, size: proxy.size,
                            toScreen: pt, toModel: toModel, scale: scale)
                    }

                    guard corners.count >= 3 else { return }

                    var floor = Path()
                    floor.move(to: pt(corners[0]))
                    for c in corners.dropFirst() { floor.addLine(to: pt(c)) }
                    floor.closeSubpath()

                    // §2: the room you are INSIDE is white with a fine tan
                    // tile grid; the grey fill is for the rooms you are not
                    // in. An editor only ever holds the one room, and you
                    // are in it — so this is unconditional, and it no longer
                    // waits on a selection the way the old hatch did.
                    context.fill(floor, with: .color(Brand.surface))
                    EditorChrome.tileGrid(floor, context: context)

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
                            with: .color(invalid ? .red : (isSelected ? Brand.blue : Brand.Plan.ink)),
                            style: StrokeStyle(
                                lineWidth: isSelected ? max(6, 0.114 * scale + 4) : max(3, 0.114 * scale),
                                lineCap: .butt,
                                dash: invalid ? [8, 5] : []))
                    }

                    // Openings, cut into their walls: band break, jamb caps,
                    // our own glyphs. Drawn after the walls so the knock-out
                    // actually knocks out. A selected one gains the thin
                    // brand-blue rectangle §7 draws around it.
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

                    // The selected wall's manipulators (§7): the indigo
                    // diamond handle at its midpoint and the `▶◀` marker
                    // further along. Affordances for the drag that already
                    // works, not a new gesture.
                    if case .wall(let index) = selection {
                        EditorChrome.drawWallHandles(
                            context: context, polygon: corners, edge: index,
                            toScreen: pt, winding: EditorChrome.winding(corners))
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

                    // Every wall's dimensions as a drafted string — witness
                    // lines, arrowheads, the figure along the run — offset
                    // OUTSIDE the walls where a dimension belongs, not a
                    // pill floating on the wall line. Any wall carrying an
                    // opening also gets its split chain on the row beneath,
                    // whatever is selected (ORD-18). Locked values keep
                    // their padlock; the selected wall's string goes bold.
                    if showDimensions {
                        EditorChrome.drawWallDimensions(
                            context: context,
                            polygon: corners,
                            openings: showOpenings ? openings : [],
                            toScreen: pt,
                            proxySize: proxy.size,
                            selectedEdge: {
                                if case .wall(let i) = selection { return i }
                                return nil
                            }(),
                            lockedEdges: locked)
                    }
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
            // Double-tap a wall to open it in elevation (G1). Declared
            // BEFORE the single tap so SwiftUI gives the two-tap gesture
            // first refusal; the other order makes the single tap win every
            // time and the double never fires.
            .onTapGesture(count: 2) { location in
                openElevation(at: toModel(location), scale: scale)
            }
            .onTapGesture { location in
                handleTap(toModel(location), scale: scale)
            }
        }
        .background(Brand.Plan.sheet)
        // §3's floating controls, over the canvas rather than in the bar:
        // undo/redo top-left, the layers and view-mode steppers top-right.
        .overlay(alignment: .top) { floatingControls }
    }

    /// §3. One undo/redo pill on the left, two stepper pills on the right.
    private var floatingControls: some View {
        HStack(alignment: .top) {
            EditorUndoRedoPill(
                canUndo: !history.isEmpty,
                canRedo: !future.isEmpty,
                onUndo: undo,
                onRedo: redo)

            Spacer()

            HStack(spacing: Brand.Space.tight) {
                // The layers stepper. §3 draws it but never says what it
                // controls, and guessing a feature would be inventing one —
                // so it does the plainest thing its own glyph promises:
                // which layers of the drawing are visible. Visibility only;
                // nothing here changes a number or the geometry.
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
                    if let shortcut = mode.shortcut {
                        Text(shortcut).font(.system(size: 14, weight: .bold))
                    } else {
                        Image(systemName: EditorViewMode.elevationGlyph)
                            .font(.system(size: 15))
                    }
                }
                .popover(isPresented: $showingViewModes) {
                    EditorViewModeMenu(
                        current: mode,
                        // Inside a room, so §5's blocking reason does not
                        // apply and the slot carries the shortcut hint.
                        elevationBlocked: nil,
                        threeDBlocked: "Not built yet — the plan editor is 2D",
                        onPick: { picked in
                            showingViewModes = false
                            if picked == .elevation { openElevation(atSelectedWall: true) }
                        })
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

    // MARK: - Elevation (ORD-19's view, reached from here)

    /// Double-tap a wall to see it head-on (G1). The tap has to land on a
    /// wall — double-tapping empty canvas does nothing rather than opening
    /// an arbitrary elevation.
    private func openElevation(at point: CGPoint, scale: CGFloat) {
        let tolerance = wallBand / scale
        var best = -1
        var bestDistance = tolerance
        for i in corners.indices {
            let d = distanceToEdge(point, index: i)
            if d < bestDistance {
                bestDistance = d
                best = i
            }
        }
        guard best >= 0 else { return }
        select(.wall(best))
        elevationWall = best
        mode = .elevation
    }

    /// The other way in: §5's Elevation row. It opens the wall already
    /// selected, or the first wall when the selection is the room — C4 makes
    /// the row available at room depth, so it must resolve to some wall.
    private func openElevation(atSelectedWall: Bool) {
        guard corners.count >= 3 else { return }
        if case .wall(let index) = selection {
            elevationWall = index
        } else {
            elevationWall = 0
            select(.wall(0))
        }
        mode = .elevation
    }

    /// Leaving elevation is the `2D` escape where the back chevron sits (G2).
    private func closeElevation() {
        elevationWall = nil
        mode = .plan
    }

    /// The wall index as the binding `ElevationView` takes, so its own ← / →
    /// stepper can walk to the adjoining walls and this editor's selection
    /// follows it back.
    private var elevationWallBinding: Binding<Int> {
        Binding(
            get: { elevationWall ?? 0 },
            set: { index in
                elevationWall = index
                if corners.indices.contains(index) { selection = .wall(index) }
            })
    }

    /// The wall, seen straight on.
    ///
    /// `wallIndex` is a binding rather than a value because the view's own
    /// ← / → arrows step it, and the editor's selection has to follow — a
    /// wall face showing one wall while the plan behind it has another
    /// selected is how an operator marks damage on the wrong wall.
    private var elevationPresentation: some View {
        ElevationView(
            corners: corners,
            openings: openings,
            ceilingHeight: room.ceilingHeightM,
            roomScanId: room.id,
            wallIndex: elevationWallBinding,
            onClose: closeElevation)
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
                    .padding(.horizontal, Brand.Space.base)
            }
            if let error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(.horizontal, Brand.Space.base)
            }

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
            .padding(.horizontal, Brand.Space.base)

            // §4's bar: grabber, equal-width icon-above-label tiles, the
            // destructive one red and ellipsised, and the swipe-up caption
            // under it. It rewrites itself per (depth, view mode), and both
            // editors speak the same verbs through it.
            EditorActionBar(
                depth: barDepth,
                mode: mode,
                supported: supportedActions,
                onAction: perform,
                // The swipe-up leads back to this room's inspector — which
                // is the very sheet that presented this editor, so the
                // gesture is a dismissal rather than a second presentation.
                onInfo: { if isDirty { showDiscard = true } else { dismiss() } })
        }
        .padding(.top, Brand.Space.small)
        .background(Brand.Plan.sheet)
    }

    /// This editor's selection as a depth the shared bar understands.
    ///
    /// Nothing selected IS room depth here: you are inside the room by
    /// virtue of the editor being open, so the bar shows the room's verbs
    /// rather than the hint line it used to.
    private var barDepth: EditorDepth {
        switch selection {
        case .none:
            return .room(name: room.name)
        case .wall:
            // A held drag handle collapses the bar to two (§4, D5).
            return .wall(dragging: dragStart != nil)
        case .corner:
            return .corner
        case .opening(let index):
            guard openings.indices.contains(index) else { return .room(name: room.name) }
            return .opening(label: openings[index].kind.label)
        }
    }

    /// Which of §4's verbs this editor can actually perform right now.
    ///
    /// Everything the bar draws but this set omits renders greyed in place.
    /// Three reasons a verb is absent, and they are worth telling apart:
    ///
    /// - **Never observed.** Add Wall and Split Room appear in the
    ///   reference's bar but were never performed and have no after-frames;
    ///   ORDERS lists them as deliberately not ordered. A guess at what they
    ///   do would be improvising a substitute for evidence.
    /// - **Not this screen's business.** Duplicating or deleting the room,
    ///   or rotating it, act on the storey that owns it, not on the polygon
    ///   this editor has open. Edit Layout is what this whole screen already
    ///   is, so it has nowhere to go.
    /// - **Not applicable to the selection.** Insert needs a wall to put an
    ///   opening in, and refuses on a scanned room that already carries
    ///   detected openings — `canAuthorOpenings` — because deducting the
    ///   same door twice is money. A triangle's last three corners cannot be
    ///   deleted, and Delete on a wall would leave a room that is not closed.
    private var supportedActions: Set<EditorAction> {
        switch selection {
        case .none:
            // Set Size walks every wall through the keypad — exactly what
            // C5 describes, and already built.
            return [.setSize]
        case .wall:
            return canAuthorOpenings ? [.insert, .addCorner] : [.addCorner]
        case .corner:
            return corners.count > 3 ? [.delete] : []
        case .opening:
            return [.delete]
        }
    }

    /// One bar tap. Only the verbs in `supportedActions` can arrive here —
    /// the rest are disabled in the bar — so this maps each to the editor's
    /// existing operation and ignores nothing silently.
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

    /// §1's help. The gestures this canvas answers to, in one card — the
    /// place the old "tap a wall to select it" hint went when §4 gave the
    /// bar's empty state the room's verbs instead.
    private var helpCard: some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            Text("Editing this plan")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Brand.ink)
            ForEach(
                [
                    "Two fingers pan and zoom — always, whatever is selected.",
                    "One finger selects. It only moves what is already selected.",
                    "Tap a wall, then tap its dimension to type an exact length.",
                    "Double-tap a wall to see it head-on in elevation.",
                    "A padlock marks a length somebody typed. Drags ask before changing one.",
                ], id: \.self
            ) { line in
                Text("•  " + line)
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Brand.Space.base)
        .frame(width: 320)
        .presentationCompactAdaptation(.popover)
    }

    // MARK: - Nav bar titles (§1)

    /// The title changes with depth: the room's name at room depth, the kind
    /// of thing selected below it.
    private var navTitle: String {
        switch selection {
        case .none: return room.name
        case .wall: return "Wall"
        case .corner: return "Corner"
        case .opening(let index):
            guard openings.indices.contains(index) else { return room.name }
            return openings[index].kind.label
        }
    }

    /// The subtitle carries the parent — the storey, once you are deeper
    /// than the room itself.
    private var navSubtitle: String? {
        EditorChrome.floorSubtitle(room.level)
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
                Brand.Plan.sheet.ignoresSafeArea()

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

