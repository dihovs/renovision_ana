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
///
/// The canvas, the handles, the gestures, the action bar, the sheets one
/// room's own inspector and its walls open into — everything a plan editor
/// draws and answers to, MINUS the chrome that says whose screen it is.
///
/// Split out from `PlanEditorView` on 18 Aug 2026, the day tapping a room on
/// the storey canvas stopped presenting this as a new screen. The owner, in
/// his own words, after watching magicplan do it: *"it activates the editing
/// mode. It doesn't pull up anything for anything. It just activates on that
/// main canvas."* A `.sheet` always slides up as a screen, however it is
/// dressed — the only way to "just activate" is for the SAME view that was
/// already on screen to start drawing this instead, which means this content
/// cannot own its own `NavigationStack` or toolbar, because whoever hosts it
/// (a sheet, or the storey canvas in place) owns those.
///
/// Two hosts, both below:
/// - `PlanEditorView` — a `NavigationStack` around this, presented as a
///   sheet from `RoomDetailView`'s "Adjust the plan". `onExit` dismisses it.
/// - `FloorCanvasView` — no `NavigationStack` of its own; this is swapped in
///   for its storey view directly, inside the SAME screen the app already
///   pushed. `onExit` steps back to the floor instead.
struct RoomEditorCore: View {
    let room: RoomScan
    /// What leaving this room (nothing selected, back pressed, or dirty
    /// discarded) actually does. A sheet host dismisses; the storey canvas
    /// steps back to floor depth. Either way this view's own `@State` — the
    /// whole in-progress edit — goes with it, which is what makes Discard
    /// correct by construction rather than something to reset by hand.
    let onExit: () -> Void
    /// True when the room's own inspector is the screen this editor opened
    /// OVER — `RoomDetailView`'s "Adjust the plan". Then the swipe-up is
    /// `onExit`, because the inspector is already behind and raising a
    /// second copy of it on top of itself would be nonsense.
    ///
    /// False when entered from the storey canvas, where nothing is behind —
    /// so the swipe-up has to PRESENT the inspector, which is the gesture
    /// the reference uses for every inspector.
    var inspectorIsBehind: Bool = false
    /// The back pill's glyph: which kind of "back" this is. `.room` says
    /// "back to this room's inspector" (the standalone sheet's own case);
    /// `.floor` says "back to the storey" (the embedded case). Both read
    /// correctly against `EditorBackPill`'s own table.
    var backContext: EditorBackPill.Context = .room
    /// The storey's own shared, animated camera — nil for the standalone
    /// sheet, which has no floor to zoom out to and frames itself exactly
    /// as it always has. Set by `FloorCanvasView`, which reads the SAME
    /// `StoreyViewport` on the SAME frame for its own always-present
    /// `StoreyBaseLayer` — that agreement, not any transition code, is what
    /// makes entering and leaving a room read as one continuous zoom rather
    /// than two views swapping. Full account on `StoreyViewport` itself.
    ///
    /// `zoom`/`pan` still apply on top of it, unchanged in role: the SAME
    /// fine adjustment they already give the standalone editor's own frozen
    /// bounds. Nothing below needed to learn a second transform for this —
    /// `bounds` becomes this viewport's own `bounds` when it is set, and
    /// `screenPoint`/`modelPoint` do not change at all.
    var externalViewport: StoreyViewport? = nil
    /// The coordinate space `FloorCanvasView` tags its shared-viewport
    /// content with, so this editor's own canvas can work out where it
    /// sits inside it. See `canvas`'s `centre` for why that matters.
    static let storeySpace = "RoomEditorCore.storeySpace"
    /// Where THIS room's own local corner space sits inside the floor —
    /// `StoreyRoom.origin`. Zero for the standalone sheet, where local and
    /// floor space are the same thing because there is no floor. `corners`
    /// itself is never touched by this; only the screen projection is.
    var roomOrigin: CGPoint = .zero
    /// Something chosen from the library at FLOOR depth, waiting for the
    /// room it goes in — the owner asked for the library *"on the floor
    /// itself"* as well as on a wall, and at floor depth there is no room to
    /// put it in until he taps one. `LevelCanvas` carries the choice through
    /// the tap and hands it over here.
    ///
    /// An object lands in the middle of the room; a door or window has to
    /// wait one more tap for its wall, which is the same pending state the
    /// Insert menu already uses.
    var initialLibraryItem: LibraryItem? = nil
    let onSaved: () -> Void

    /// Observed so changing the unit redraws every dimension on the
    /// canvas, not just the keypad's own readout.
    @ObservedObject private var units = UnitSettings.shared

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
    /// Cumulative-to-incremental bookkeeping for the one-finger pan —
    /// `DragGesture` reports the total since the gesture began, this holds
    /// the last total so each frame applies only its own delta.
    @State private var lastPanDrag: CGSize = .zero
    @State private var snapEngaged = false
    @State private var liveLabel: String?
    /// The wall-by-wall measurement walk, when one is running. The queue is
    /// every wall in order starting from the one the operator asked about;
    /// the panel below the canvas drives it, the canvas highlights it.
    @State private var measuring: MeasureRun?
    @State private var addingOpening = false
    /// Objects standing in this room — S8. Server rows, not part of the
    /// polygon's own undo history: placing a cabinet is a write, not an
    /// edit of the geometry, so it is saved immediately and `Discard` does
    /// not take it back.
    @State private var objects: [RoomObject] = []
    @State private var placingObject = false
    /// A door or window chosen from the Insert menu with no wall selected
    /// yet — it is waiting for the operator to tap the wall it goes in.
    ///
    /// The owner asked for this route directly, 18 Aug 2026: *"doors and
    /// windows i want to be able to choose from the insert menu itself also
    /// from the floorplan look, when i choose a wall and click insert."* Two
    /// routes to the same placement, and they must not be two behaviours —
    /// both end in `PlanEditing.placeOpening` on a named edge.
    @State private var pendingOpening: PlanEditing.OpeningKind?
    @State private var inspectingObject: RoomObject?
    /// Where an object drag started, in plan metres, so each frame applies
    /// the whole translation from the original rather than accumulating.
    @State private var objectDragStart: CGPoint?
    /// The room-depth Insert menu (§4's five nouns).
    @State private var insertMenuOpen = false
    @State private var saving = false
    @State private var error: String?
    @State private var showDiscard = false
    @State private var confirmingRoomDelete = false
    /// Wall lengths the operator TYPED. A measured number and an entered one
    /// are different kinds of fact, and a claim file must be able to tell
    /// them apart.
    @State private var locked: Set<Int> = []
    @State private var lockedWarning: Int?
    /// True when the scan's walls never closed and this rectangle is a
    /// placeholder rather than the room. Everything derived from it — the
    /// floor area under the canvas most of all — is a guess until the
    /// operator drags it onto the real walls and saves.
    @State private var outlineGuessed = false

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

    /// The room's own inspector, raised by the swipe-up when this editor was
    /// entered straight from the storey canvas rather than from the sheet.
    @State private var inspectingRoom = false
    /// The wall whose inspector is open — set by the swipe-up on a selected
    /// wall (object-model §2b), the same gesture that reaches the room's own
    /// sheet from the storey canvas.
    @State private var inspectingWall: Int?
    /// Index into `openings` for the swipe-up's own third case — a door or
    /// window's inspector. Before 18 Aug 2026 there was no such case: a
    /// selected opening's swipe-up fell through to the room's own sheet,
    /// same as nothing being selected at all.
    @State private var inspectingOpening: Int?

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

    /// Viewport. `zoom` multiplies the fit scale; `pan` slides the camera in
    /// screen points. Both are driven by `PlanNavigationGesture`, which is
    /// UIKit because two-finger-only is not something SwiftUI can say.
    @State private var zoom: CGFloat = 1
    @State private var pan: CGSize = .zero
    /// The canvas's own size, needed to zoom about the fingers rather than
    /// the middle of the screen — the pinch callback has no geometry proxy.
    @State private var canvasSize: CGSize = .zero

    enum Selection: Equatable {
        case none
        case wall(Int)
        case corner(Int)
        /// Index into `openings`.
        case opening(Int)
        /// A placed object, by its server id rather than an index — objects
        /// are rows that arrive from a fetch and can be reordered by a
        /// reload, where openings are positions in this editor's own array.
        case object(String)
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

    /// **Every host must pin this to `.environment(\.colorScheme, .light)`.**
    /// A drawing is ink on paper and paper does not invert; fixing only the
    /// canvas would leave the chrome's ink inverting to near-white on top of
    /// white paper — trading an invisible drawing for invisible labels. It
    /// is also what the operator hands an adjuster: a plan that looks
    /// different on two phones is a plan whose measurements get questioned.
    /// Not applied here, deliberately — this content has no wrapper of its
    /// own to hang it on, so `PlanEditorView` and `FloorCanvasView` each
    /// apply it themselves, at their own call site.
    var body: some View {
        ZStack {
            // `.paper`, not `.sheet` — the owner's word for it, 18 Aug 2026,
            // comparing the two side by side: "I like the look of the story
            // canvas better. It's more lighter... The editor is more dark."
            // One background for both now, not two.
            Brand.Plan.paper.ignoresSafeArea()

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
        // Only the standalone sheet gets a hidden system back button to
        // suppress — the embedded case has none to begin with, since
        // `editingRoom` is state on the SAME screen, not a stack push.
        // Hiding it there anyway is what stops the system's own auto-back
        // from reappearing once the custom pill below is omitted, and
        // popping past floor depth straight to the project by accident.
        .navigationBarBackButtonHidden(backContext == .floor)
        .toolbar {
            // §1's pill exists for the STANDALONE sheet only. Embedded in
            // the storey canvas there is nothing to chevron back to in the
            // top bar — the owner's own instruction, 18 Aug 2026, after
            // showing what magicplan actually does: tapping the canvas
            // OUTSIDE the room is what leaves it, no button for it. See
            // `handleTap`'s outside-the-room branch, which carries the same
            // discard check this pill used to.
            if backContext == .room {
                ToolbarItem(placement: .topBarLeading) {
                    EditorBackPill(context: backContext) {
                        if isDirty { showDiscard = true } else { onExit() }
                    }
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
            if case .wall = selection {} else {
                // No wall chosen yet — reached from the Insert menu. The
                // kind is picked here and the wall is tapped next, so
                // `fits` is asked of EVERY wall: a 60" double door that
                // fits nowhere in the room should not be offered, but one
                // that fits on the long wall should be, even though the
                // short wall could not take it.
                OpeningPicker(
                    edgeLength: (0..<max(corners.count, 1))
                        .map { PlanEditing.edgeLength(corners, $0) }.max() ?? 0,
                    fits: { kind in
                        corners.indices.contains {
                            PlanEditing.placeOpening(
                                kind, onEdge: $0, of: corners, avoiding: openings) != nil
                        }
                    }
                ) { kind in
                    pendingOpening = kind
                    addingOpening = false
                }
            }
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
        .sheet(isPresented: $placingObject) {
            ObjectLibraryPicker(context: libraryContext) { item in
                switch item {
                case .opening(let kind):
                    // A door or window from the library. With a wall already
                    // selected it goes straight in; without one it waits for
                    // the tap that names its wall.
                    if case .wall(let edge) = selection,
                        let placed = PlanEditing.placeOpening(
                            kind, onEdge: edge, of: corners, avoiding: openings)
                    {
                        push()
                        openings.append(placed)
                        select(.opening(openings.count - 1))
                    } else {
                        pendingOpening = kind
                    }
                case .object(let entry):
                    placeChosen(entry)
                }
            }
        }
        .sheet(item: $inspectingObject) { object in
            ObjectDetailView(object: object) { changed in
                if changed { Task { await loadObjects() } }
            } onDelete: {
                Task { await removeObject(object.id) }
            }
        }
        .task { await loadObjects() }
        .task {
            // Handed in from the floor: place it, or wait for the wall.
            guard let initialLibraryItem else { return }
            switch initialLibraryItem {
            case .object(let entry): await place(entry)
            case .opening(let kind): pendingOpening = kind
            }
        }
        .sheet(isPresented: $inspectingRoom) {
            RoomDetailView(room: room)
        }
        .sheet(
            isPresented: Binding(
                get: { inspectingWall != nil }, set: { if !$0 { inspectingWall = nil } })
        ) {
            if let index = inspectingWall {
                WallDetailView(
                    room: room, wallIndex: index,
                    lengthM: PlanEditing.edgeLength(corners, index),
                    onAddArea: { openElevation(atSelectedWall: true) })
            }
        }
        .sheet(
            isPresented: Binding(
                get: { inspectingOpening != nil }, set: { if !$0 { inspectingOpening = nil } })
        ) {
            if let index = inspectingOpening, openings.indices.contains(index) {
                OpeningDetailView(
                    opening: openings[index],
                    onKindChanged: { newKind in
                        push()
                        // Width resets to the new kind's own catalog figure
                        // too — the sheet's own picker already resets its
                        // LOCAL height/sill state the same way; this is the
                        // STORED side of that same decision. Not run through
                        // `placeOpening`'s own fit search, since the opening
                        // already has a slot on this wall and is only
                        // changing what fills it, not where.
                        openings[index].kind = newKind
                        openings[index].width = newKind.width
                        openings[index].height = newKind.height
                        openings[index].sill = newKind.sill
                    },
                    onDimensionsChanged: { newHeight, newSill in
                        push()
                        openings[index].height = newHeight
                        openings[index].sill = newSill
                    },
                    onDelete: { deleteOpening(index) })
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
            // Save belongs here now, not just Discard/Keep editing — the
            // owner's own words, 18 Aug 2026: "if their changes are done,
            // it needs to ask me if I wanna save it or discard." Leaving
            // with unsaved edits used to offer only the destructive choice
            // or staying; this is the third, ordinary one, same `save()`
            // the toolbar's own button already calls.
            Button("Save") { Task { await save() } }
                .disabled(invalid)
            Button("Discard", role: .destructive) { onExit() }
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

    // MARK: - Canvas

    private var canvas: some View {
        GeometryReader { proxy in
            // `externalViewport.scale` already IS a fit-to-canvas scale —
            // computed the identical way `fitScale` computes its own, just
            // over `bounds` in floor space instead of the room's local
            // extent. Composing `* zoom` on top either way is what keeps a
            // live pinch working exactly the same regardless of which
            // camera is underneath it.
            let fit = externalViewport?.scale ?? fitScale(in: proxy.size)
            let scale = fit * zoom
            // `centre` is where floor-space `bounds.mid` lands, in THIS
            // canvas's own local coordinates.
            //
            // Standalone, that is simply the middle of the canvas. Embedded
            // it is NOT, and assuming it was is what the owner saw: "the
            // story mode is located lower... when I click in the room, it
            // kind of jumps up." `StoreyBaseLayer` fills the whole screen,
            // so its viewport centres on the FULL height — but this canvas
            // is in a `VStack` above the action bar, so its own middle sits
            // higher up the screen than that. Same scale, different centre,
            // and the drawing jumped by exactly half the action bar.
            //
            // So: take the shared viewport's own full-screen centre and
            // express it in this canvas's local space by subtracting where
            // this canvas starts. `pan` still rides on top, unchanged.
            let storeyFrame = proxy.frame(in: .named(Self.storeySpace))
            let centre: CGPoint = {
                guard let externalViewport else {
                    return CGPoint(
                        x: proxy.size.width / 2 + pan.width,
                        y: proxy.size.height / 2 + pan.height)
                }
                return CGPoint(
                    x: externalViewport.canvasSize.width / 2 - storeyFrame.minX + pan.width,
                    y: externalViewport.canvasSize.height / 2 - storeyFrame.minY + pan.height)
            }()

            // `roomOrigin` shifts a LOCAL point (what `corners` always is,
            // save file and all) into FLOOR space before it meets `bounds`,
            // which is in floor space whenever `externalViewport` is set.
            // Zero when it is not, so this is a no-op for the standalone
            // sheet and `screenPoint`/`modelPoint` themselves never had to
            // learn there are two coordinate spaces now.
            let toScreen = { (p: CGPoint) in
                self.screenPoint(
                    CGPoint(x: p.x + self.roomOrigin.x, y: p.y + self.roomOrigin.y),
                    centre: centre, scale: scale)
            }
            let toModel = { (p: CGPoint) in
                let floorPoint = self.modelPoint(p, centre: centre, scale: scale)
                return CGPoint(
                    x: floorPoint.x - self.roomOrigin.x, y: floorPoint.y - self.roomOrigin.y)
            }

            ZStack {
                Canvas { context, _ in
                    let pt = toScreen

                    // The paper first: the half-metre dotted grid with its
                    // brand-blue crosshairs every fifth dot, behind
                    // everything — and pinned to the plan's own metres, so
                    // it zooms and pans locked to the walls rather than
                    // sitting still under them.
                    //
                    // That is the owner's divergence from the reference,
                    // asked for 18 Aug 2026 and explained in full on
                    // `EditorChrome.drawGrid`. The mapping is handed over
                    // rather than reinvented: model (0, 0) on screen, and
                    // the same metres→points scale the walls use.
                    if showGrid {
                        EditorChrome.drawGrid(
                            context: context, size: proxy.size,
                            model: (origin: pt(.zero), scale: scale))
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
                    EditorChrome.tileGrid(floor, context: context, scale: scale)

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
                        let core = isSelected ? max(6, 0.114 * scale + 4) : max(3, 0.114 * scale)

                        // A wall is a BAND, not a line. The reference draws the
                        // wall black with a grey band around it, and the grey
                        // is the assembly's own thickness — the footprint the
                        // wall occupies rather than the face you measure to.
                        // Without it a plan reads as a sketch; with it, it
                        // reads as a drawing of a building. Drawn under the
                        // black so the measured face stays exactly where it
                        // was: this adds nothing to any dimension.
                        if !invalid {
                            context.stroke(
                                wall, with: .color(Brand.Plan.wallFootprint),
                                style: StrokeStyle(lineWidth: core + 7, lineCap: .butt))
                        }

                        context.stroke(
                            wall,
                            with: .color(invalid ? .red : (isSelected ? Brand.blue : Brand.Plan.ink)),
                            style: StrokeStyle(
                                lineWidth: core,
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

                    // Objects standing on the floor — S8. **Ink, not the
                    // catalogue's colour**: the picker is browsed and
                    // colour makes it scannable, but this drawing is read
                    // beside a report and `Brand.Plan` exists to keep it
                    // reading as drafting. The owner agreed the split.
                    //
                    // Drawn AFTER the walls and openings so an object
                    // against a wall sits over the band rather than under
                    // it, and before the dimensions, which belong on top of
                    // everything.
                    for object in objects {
                        EditorChrome.drawObject(
                            object, context: context, toScreen: pt, scale: scale,
                            selected: selection == .object(object.id))
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

                    // Corner handles, ALWAYS — the reference shows them on an
                    // untouched room, and they are what says the shape can be
                    // grabbed at all. Hiding them until something is selected
                    // meant the first drag had to be guessed at.
                    if true {
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
                            lockedEdges: locked,
                            format: units.format)

                        // ORD-23. The room's overall bounding extent, one
                        // line further out than every per-wall figure —
                        // the second of object-model §5's "two dimensions,
                        // not one". On a slanted wall the two disagree on
                        // purpose: the wall says what a tape reads along
                        // it, this says how deep the room is.
                        EditorChrome.drawOverallDimensions(
                            context: context,
                            polygon: corners,
                            toScreen: pt,
                            proxySize: proxy.size,
                            format: units.format)
                    }

                    // ORD-31. The two edges either side of the corner in
                    // the hand, measured live, ON the edges — where the
                    // area editor has had them since S3.
                    EditorChrome.drawLiveEdgeDimensions(
                        context: context,
                        polygon: corners,
                        edges: liveEdges,
                        toScreen: pt,
                        proxySize: proxy.size,
                        format: units.format)
                }

                // While a door or window from the Insert menu is waiting
                // for its wall. A mode with no visible state is a mode
                // nobody can leave — this says what the app is waiting for
                // and offers the way out.
                if let pendingOpening {
                    VStack {
                        HStack(spacing: Brand.Space.small) {
                            Text("Tap the wall for the \(pendingOpening.label.lowercased())")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.white)
                            Button("Cancel") { self.pendingOpening = nil }
                                .font(.system(size: 14, weight: .semibold))
                                .tint(.white)
                        }
                        .padding(.horizontal, Brand.Space.base)
                        .padding(.vertical, Brand.Space.small)
                        .background(Brand.blue, in: .capsule)
                        .padding(.top, 12)
                        Spacer()
                    }
                }

                // The live figure during a drag, well above the finger —
                // for the drags that have no natural edge to sit on. A
                // corner drag DOES (ORD-31 draws it there, on both
                // adjoining edges), and printing the same two numbers a
                // second time in a floating capsule would be one reading
                // too many.
                if let liveLabel, liveEdges.isEmpty {
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
            // Two fingers navigate — always, whatever is selected. UIKit,
            // because "two fingers only" is the whole point and SwiftUI's
            // DragGesture fires on one finger just the same; see
            // PlanNavigationGesture for why the previous attempt was inert.
            .background(
                PlanNavigationGesture(
                    onZoom: { factor, focus in zoomBy(factor, about: focus) },
                    onPan: { delta in
                        pan.width += delta.width
                        pan.height += delta.height
                    })
            )
            .onAppear { canvasSize = proxy.size }
            .onChange(of: proxy.size) { canvasSize = $0 }
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
                        lastPanDrag = .zero
                        endObjectDrag()
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
        .background(Brand.Plan.paper)
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

        // The dimension string is a control in its own right, and it is
        // OUTBOARD of the room, so nothing else competes for the tap. Tested
        // first anyway: it is the smallest target on the canvas and the one
        // the operator is aiming at when they hit it.
        //
        // This is the only route to a locked wall. A padlock means somebody
        // typed that length, and until now un-typing it meant re-running the
        // whole Set Size walk; the panel this opens carries Unlock for the
        // wall you actually pointed at.
        // Re-enabled 18 Aug 2026. This was switched off behind `if false`
        // during a bisect — "temporarily", to find what was swallowing
        // canvas taps — and never switched back on, which is why tapping a
        // dimension did nothing for as long as anyone can remember. It is
        // also why SECTIONS lists "the dimension-tap unlock" as one of the
        // two things still unverified on device: it could not have worked.
        //
        // The owner hit the consequence directly, 18 Aug 2026: *"the length
        // is 3.64 m. If I click on it, I wanna be able to open that
        // calculator thing... right now when I'm clicking on it, it detects
        // it as I'm clicking outside of the room and goes to the storey
        // mode."* Exactly so — dimensions are drawn OUTBOARD of the walls,
        // so with this branch dead every dimension tap fell through to the
        // tap-outside-to-leave branch at the bottom of this function.
        // Position in the order matters as much as being enabled at all.
        // `showDimensions` guards it because a hidden number is not a
        // control: with the dimension layer off, this branch would claim
        // taps on blank canvas outboard of the walls and open a keypad for
        // a figure that is not on screen.
        //
        // **THE WALL WINS A TIE, and that is the owner's own report**, 18
        // Aug 2026: *"when I click to the wall by accident, I'm able to
        // click the measurement… I'm not opening the properties of the wall
        // itself, but I'm actually messing up with the measurements."* The
        // dimension was tested first and unconditionally, so anywhere the
        // two targets overlapped, the number took the tap — and the number
        // opens a keypad that CHANGES the room, where the wall only selects.
        // When a tap is ambiguous, the reversible thing must win.
        //
        // So a tap that lands on a wall's own band is a tap on that wall,
        // full stop. The dimension keeps every tap outboard of the band,
        // which is where it is drawn — and `plainRow` moved out to 28 so
        // there is real space between the two rather than a shared edge.
        let onAWall = corners.indices.contains { distanceToEdge(point, index: $0) < wallBand / scale }
        if showDimensions, measuring == nil, !onAWall,
            let edge = EditorChrome.dimensionHit(at: point, polygon: corners, scale: scale)
        {
            startMeasuring(at: edge)
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

        // Objects, after openings and before walls. An object stands INSIDE
        // the room while walls are its edges, so the two rarely compete —
        // but a cabinet pushed against a wall overlaps the band, and the
        // thing the finger is aiming at there is the cabinet.
        if let hit = objects.last(where: { objectContains($0, point) }) {
            select(.object(hit.id))
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
            // A door or window chosen from the Insert menu is waiting for
            // its wall — this tap names it. Tested before the selection
            // branches below, because while something is pending, tapping a
            // wall MEANS "put it here" and nothing else.
            if let kind = pendingOpening {
                if let placed = PlanEditing.placeOpening(
                    kind, onEdge: best, of: corners, avoiding: openings)
                {
                    push()
                    openings.append(placed)
                    pendingOpening = nil
                    select(.opening(openings.count - 1))
                } else {
                    // It does not fit this wall. Say so and keep the pending
                    // kind, so the next tap can try a longer one — dropping
                    // it silently would read as the tap doing nothing.
                    error = "A \(kind.label.lowercased()) does not fit on that wall."
                }
                return
            }
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

        // Nothing hit — every test above already had its own generous
        // tolerance, so this tap landed on open canvas. Two different
        // things that can mean, and the owner drew the line between them
        // precisely, 18 Aug 2026: *"when some item is selected, when I
        // click outside, I want it to go back to the inspection editing
        // mode"* — not all the way out. So a SELECTED wall, corner or
        // opening just deselects here, however far outside the room the
        // tap landed — this is a step IN, not a step OUT.
        if selection != .none {
            select(.none)
            return
        }

        // Only with NOTHING already selected — "the entire room" itself is
        // what is focused, his words — does a tap OUTSIDE the room's own
        // shape step out one level further, to the storey. Same dirty
        // check the back-pill always ran; mid-measurement-walk it is left
        // alone rather than abandoning a walk the operator did not ask to
        // leave.
        if backContext == .floor, measuring == nil, !PlanEditing.contains(corners, point: point) {
            if isDirty { showDiscard = true } else { onExit() }
            return
        }

        select(.none)
    }

    /// Zoom about the fingers, not about the middle of the screen.
    ///
    /// Pinching on a corner should magnify THAT corner — zooming about the
    /// centre instead slides whatever you were looking at off the edge, which
    /// on a long room means chasing the thing you were trying to inspect.
    ///
    /// The camera is `centre = size/2 + pan`, so holding the point under the
    /// fingers still means moving `centre` to `focus - (focus - centre) ·
    /// factor` — a pan delta of `(focus - centre) · (1 - factor)`. Clamping
    /// zoom first means a pinch past either stop stops panning too, rather
    /// than sliding the plan while the scale refuses to change.
    private func zoomBy(_ factor: CGFloat, about focus: CGPoint) {
        let clamped = min(max(zoom * factor, 0.5), 6)
        let applied = clamped / zoom
        guard applied != 1 else { return }
        zoom = clamped

        let centre = CGPoint(
            x: canvasSize.width / 2 + pan.width,
            y: canvasSize.height / 2 + pan.height)
        pan.width += (focus.x - centre.x) * (1 - applied)
        pan.height += (focus.y - centre.y) * (1 - applied)
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
        // Nothing selected: ONE finger moves the paper.
        //
        // This does not weaken the rule at the top of this file — it fills
        // the gap the rule left. "One finger only EDITS what is already
        // selected" was enforced by returning here and doing NOTHING, so
        // a one-finger drag on empty canvas was simply a dead gesture. It
        // now pans, which is what the owner asked for ("for moving, it
        // needs to be one finger operation") and what magicplan does. A
        // stray thumb still cannot move a wall: that needs the wall
        // selected first, and then this same drag edits it instead.
        guard selection != .none else {
            let dx = value.translation.width - lastPanDrag.width
            let dy = value.translation.height - lastPanDrag.height
            lastPanDrag = value.translation
            pan.width += dx
            pan.height += dy
            return
        }

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
            liveLabel = UnitSettings.shared.format.format(PlanEditing.edgeLength(corners, index))

        case .corner(let index):
            let moved = CGPoint(
                x: start[index].x + value.translation.width / scale,
                y: start[index].y + value.translation.height / scale)
            // Magnetic at square — his own word for it. See
            // `PlanEditing.snapCornerSquare`. Same haptic tick the wall
            // drag's own snap fires, so both magnets feel like one feature.
            let squared = PlanEditing.snapCornerSquare(
                start, index: index, to: moved,
                capture: captureRadius / scale, alreadyEngaged: snapEngaged)
            if squared.engaged && !snapEngaged {
                UISelectionFeedbackGenerator().selectionChanged()
            }
            snapEngaged = squared.engaged
            corners = PlanEditing.moveCorner(start, index: index, to: squared.point)
            let before = (index - 1 + corners.count) % corners.count
            liveLabel = "\(UnitSettings.shared.format.format(PlanEditing.edgeLength(corners, before)))  ·  \(UnitSettings.shared.format.format(PlanEditing.edgeLength(corners, index)))"

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
                .map(UnitSettings.shared.format.format)
                .joined(separator: "  ·  ")

        case .object(let id):
            guard let object = objects.first(where: { $0.id == id }) else { break }
            if objectDragStart == nil {
                objectDragStart = CGPoint(x: object.x, y: object.y)
            }
            guard let origin = objectDragStart else { break }
            let moved = CGPoint(
                x: origin.x + value.translation.width / scale,
                y: origin.y + value.translation.height / scale)

            // Flush to a wall when it comes near one — his ask, and how
            // these things are actually installed. Sets rotation as well as
            // position: "against the wall" means square to it.
            let snap = PlanEditing.snapObjectToWall(
                corners, centre: moved, width: object.width, depth: object.depth,
                capture: captureRadius * 2 / scale, alreadyEngaged: snapEngaged)
            if snap.engaged && !snapEngaged {
                UISelectionFeedbackGenerator().selectionChanged()
            }
            snapEngaged = snap.engaged

            // Moved in the local array only — the write happens once, on
            // lift, in `endObjectDrag`. A PATCH per frame would be sixty
            // requests a second from a phone on a job-site connection.
            let landing = snap.engaged ? snap.centre : moved
            replaceObject(id) {
                let placed = $0.moved(to: PlanEditing.quantise(landing))
                return snap.engaged ? placed.rotated(to: snap.rotation) : placed
            }
            liveLabel = nil

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

        // Openings first, same as `handleTap` — a door's own drawn glyph
        // (the leaf, the swing arc) reaches well off the wall's own
        // centreline into the room, so a double-tap that lands ON the
        // glyph — the natural place to tap a door — could sit outside
        // `distanceToEdge`'s tolerance for the wall underneath it even
        // though `OpeningGlyphs.distance` (below) still finds it. The
        // owner caught exactly this gap, 18 Aug 2026: elevation opened
        // fine double-tapping a bare wall, never double-tapping a door.
        var bestOpeningDistance = tolerance
        var openingEdge = -1
        for opening in openings {
            let d = OpeningGlyphs.distance(to: opening, polygon: corners, from: point)
            if d < bestOpeningDistance {
                bestOpeningDistance = d
                openingEdge = opening.edge
            }
        }
        if openingEdge >= 0 {
            select(.wall(openingEdge))
            elevationWall = openingEdge
            mode = .elevation
            return
        }

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
            // A binding, so dragging a door along its wall on the face
            // writes straight back into the editor's own openings and rides
            // the same Save. `push()` on first change is handled by the
            // editor's own history when Save runs; the face has no undo of
            // its own by design — it is a view onto this editor's state,
            // not a second editor.
            openings: $openings,
            ceilingHeight: room.ceilingHeightM,
            roomScanId: room.id,
            objects: objects,
            onPlaceObject: { entry, along in
                Task { await placeAgainstWall(entry, edge: elevationWall ?? 0, along: along) }
            },
            // Sliding an object on the face writes the same way sliding it
            // on the plan does — one PATCH, on lift. Objects are rows, so
            // this is saved the moment it lands and rides no Save button.
            onMoveObject: { object, along in
                Task { await slideAgainstWall(object, edge: elevationWall ?? 0, along: along) }
            },
            // The face edits THIS editor's openings through a binding, so
            // it has to say when it does — a binding carries the value, not
            // the intent. `push()` is what makes the room dirty, and dirty
            // is what makes leaving ask before discarding.
            onWillEdit: { push() },
            wallIndex: elevationWallBinding,
            onClose: closeElevation)
    }

    /// Copy this room, geometry and all, onto the same storey.
    ///
    /// A real second room rather than a reference: two identical bedrooms are
    /// two rooms to dry, two floors to price and two rows in a claim, and an
    /// edit to one must never silently change the other.
    ///
    /// It copies what the scan MEASURED, not the corrections made in this
    /// editor — unsaved edits belong to the room being edited, and carrying
    /// them into a copy would put an unreviewed outline into a new record.
    private func duplicateRoom() async {
        guard let projectId = room.projectId, let geometry = room.geometry else { return }
        do {
            // Every measurement is derived from the geometry by the
            // initialiser rather than copied field by field, so a duplicate
            // cannot end up stating an area its own outline disagrees with.
            _ = try await API.shared.saveScan(ScanUpload(
                projectId: projectId,
                name: "\(room.name) copy",
                level: room.level,
                position: room.position + 1,
                geometry: geometry,
                roomType: room.roomType))
            onSaved()
            onExit()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func deleteRoom() async {
        do {
            try await API.shared.deleteScan(id: room.id)
            onSaved()
            onExit()
        } catch {
            self.error = error.localizedDescription
        }
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

            // The scan never closed, so this shape is ours, not the room's.
            // Said before the figure it produced, in the operator's own
            // terms, with the one action that fixes it.
            if outlineGuessed {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(.orange)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("These walls never joined up")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Brand.ink)
                        Text("The scan stopped short, so this rectangle is a placeholder — not the room. Drag the corners onto the real walls, or rescan.")
                            .font(.system(size: 12))
                            .foregroundStyle(Brand.inkSoft)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, Brand.Space.base)
                .padding(.bottom, Brand.Space.hair)
            }

            HStack {
                Text(Measure.sqftLabel(PlanEditing.area(corners)))
                    .font(.system(size: 15, weight: .bold).monospacedDigit())
                    .foregroundStyle(outlineGuessed ? Brand.inkSoft : Brand.ink)
                // Never the bare words "floor area" over a number nobody
                // measured — the label carries the doubt with the figure,
                // because the figure is what gets copied into an estimate.
                Text(outlineGuessed ? "placeholder, not measured" : "floor area")
                    .font(.system(size: 12))
                    .foregroundStyle(outlineGuessed ? .orange : Brand.inkFaint)
                Spacer()
                if isDirty {
                    Text("Adjusted by hand")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.orange)
                }
            }
            .padding(.horizontal, Brand.Space.base)

            // The room-depth Insert menu, over the bar that opened it and
            // anchored to it — the same arrangement `LevelCanvas` uses at
            // floor depth, so the gesture is one gesture in both places.
            if insertMenuOpen {
                insertMenu
                    .padding(.horizontal, Brand.Space.base)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }

            // §4's bar: grabber, equal-width icon-above-label tiles, the
            // destructive one red and ellipsised, and the swipe-up caption
            // under it. It rewrites itself per (depth, view mode), and both
            // editors speak the same verbs through it.
            EditorActionBar(
                depth: barDepth,
                mode: mode,
                supported: supportedActions,
                hidden: hiddenActions,
                onAction: perform,
                // A wall or an opening selected swipes up into ITS OWN
                // inspector (object-model §2b) rather than the room's — the
                // owner's own complaint, 18 Aug 2026, about the opening
                // case specifically: *"no matter what I select, when I
                // pull it up, it shows me the details of the room
                // itself... I want us to see the properties of the window
                // and of the door."* With NOTHING selected it is still the
                // ROOM's inspector — presented here when the editor was
                // entered from the canvas, or a dismissal back to it when
                // the inspector is the screen underneath.
                onInfo: {
                    if case .object(let id) = selection {
                        // An object's own inspector, the same rule the wall
                        // and the opening already follow: swipe up on what
                        // is SELECTED, not on the room around it.
                        inspectingObject = objects.first { $0.id == id }
                    } else if case .wall(let index) = selection {
                        inspectingWall = index
                    } else if case .opening(let index) = selection {
                        inspectingOpening = index
                    } else if inspectorIsBehind {
                        if isDirty { showDiscard = true } else { onExit() }
                    } else {
                        inspectingRoom = true
                    }
                })
        }
        .padding(.top, Brand.Space.small)
        .background(Brand.Plan.paper)
        .confirmationDialog(
            "Delete \(room.name)?",
            isPresented: $confirmingRoomDelete, titleVisibility: .visible
        ) {
            Button("Delete room", role: .destructive) { Task { await deleteRoom() } }
            Button("Keep it", role: .cancel) {}
        } message: {
            // Say what goes with it. A room carries its damage, its readings
            // and its photos, and an operator who has to discover that
            // afterwards has lost evidence rather than a measurement.
            Text("Its measurements, damage areas, moisture readings and photos go too. This cannot be undone.")
        }
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
        case .object(let id):
            guard let object = objects.first(where: { $0.id == id }) else {
                return .room(name: room.name)
            }
            return .object(label: object.displayName)
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
            // Room depth. The reference enables all five here, and its own
            // screen settles what they act on: the ROOM, not the storey —
            // which reverses the earlier call to grey Duplicate and Delete.
            //
            // Insert and Edit Layout stay greyed, and that is not the same
            // decision. Insert at room level opens their Room/Object/Note/
            // Photo/Form menu, which we do not have; Edit Layout is a
            // reposition mode nobody has observed performing anything. Those
            // remain unimplemented rather than guessed. Duplicate and Delete
            // are enabled because we can actually do them.
            // `Insert` became live with S8: their room-depth menu is
            // Room · Object · Note · Photo · Form, and Object is now built.
            // The menu itself still shows the other four greyed with their
            // reasons, the way the floor canvas's own already does.
            return [.insert, .setSize, .duplicate, .delete]
        case .wall:
            return canAuthorOpenings ? [.insert, .addCorner] : [.addCorner]
        case .corner:
            return corners.count > 3 ? [.delete] : []
        case .object:
            // Everything the reference's object bar offers that we can
            // actually do. `Insert` stays greyed for the same reason it does
            // at room depth — their five-noun menu is not all built — while
            // Rotate, Duplicate, Delete and Replace with… all act on a row
            // this editor owns outright.
            return [.rotate, .duplicate, .delete, .replaceWith]
        case .opening:
            // `Insert` and `Duplicate` stay greyed for the same reason
            // Insert-at-room-depth does above: never observed doing
            // anything, not guessed at. `Rotate` joins them 18 Aug 2026 —
            // present in the reference's own bar (his screenshot corrected
            // the table above to include it), but what it rotates on a
            // DOOR — the leaf's swing? the whole opening 90°? — was never
            // captured either. `Replace with…` and `Delete` are enabled
            // because both are actually built: the first opens this same
            // sheet's own Kind picker, the second removes it outright.
            return [.replaceWith, .delete]
        }
    }

    /// The verbs that do not apply to this shape at all, and are removed
    /// from the bar rather than greyed.
    ///
    /// One entry so far. **`Set Size` on a room that is not a rectangle**:
    /// the walk behind it types a width and a length, and a width and a
    /// length do not describe an L. The reference removes the verb outright
    /// and puts it back the moment the room is a rectangle again — so the
    /// bar only ever offers what the shape can answer. Pull a corner out of
    /// square and it goes; pull it back and it returns, because this is
    /// recomputed from `corners` every render rather than latched.
    private var hiddenActions: Set<EditorAction> {
        PlanEditing.isRectangle(corners) ? [] : [.setSize]
    }

    // MARK: - Objects (S8)

    /// Is this point inside the object's footprint?
    ///
    /// The footprint is rotated, so this is a point-in-polygon test rather
    /// than a rect containment — `ObjectCatalog.footprint` builds the four
    /// corners about the centre and `PlanEditing.contains` does the rest,
    /// which is the same test the room's own outline already uses.
    private func objectContains(_ object: RoomObject, _ point: CGPoint) -> Bool {
        let corners = ObjectCatalog.footprint(
            width: object.width, depth: object.depth, rotation: object.rotation
        ).map { CGPoint(x: $0.x + object.x, y: $0.y + object.y) }
        return PlanEditing.contains(corners, point: point)
    }

    private func replaceObject(_ id: String, _ transform: (RoomObject) -> RoomObject) {
        guard let index = objects.firstIndex(where: { $0.id == id }) else { return }
        objects[index] = transform(objects[index])
    }

    private func loadObjects() async {
        objects = (try? await API.shared.objects(roomScanId: room.id)) ?? objects
    }

    /// Place a chosen catalogue entry.
    ///
    /// At the ROOM'S CENTROID rather than under the finger, because the
    /// picker is a full-screen sheet — there is no finger position to place
    /// it at when the sheet dismisses. Landing in the middle of the room,
    /// selected, means the very next drag moves it where it belongs, which
    /// is one gesture rather than a placement mode to learn.
    /// Placing a chosen object, or replacing the selected one with it.
    ///
    /// "Replace with…" reopens this same library, so choosing while an
    /// object is selected means swap — and a swap keeps where the old one
    /// stood and which way it faced, because that is the part the operator
    /// already got right.
    private func placeChosen(_ entry: ObjectCatalog.Entry) {
        if case .object(let id) = selection,
            let existing = objects.first(where: { $0.id == id })
        {
            Task {
                await removeObject(id)
                await place(
                    entry, at: CGPoint(x: existing.x, y: existing.y),
                    rotation: existing.rotation)
            }
        } else {
            Task { await place(entry) }
        }
    }

    /// What the library's caption says it is about to do. The list is the
    /// same list either way.
    private var libraryContext: ObjectLibraryPicker.Context {
        if case .wall = selection { return .wall }
        return .room
    }

    private func place(
        _ entry: ObjectCatalog.Entry, at position: CGPoint? = nil, rotation: Double = 0
    ) async {
        let centre = position
            ?? CGPoint(x: bounds.midX - roomOrigin.x, y: bounds.midY - roomOrigin.y)
        do {
            let id = try await API.shared.createObject(
                roomScanId: room.id, kind: entry.slug, at: centre, rotation: rotation,
                width: entry.width, depth: entry.depth, height: entry.height)
            await loadObjects()
            select(.object(id))
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Place an object flush against a named wall, at a distance along it.
    ///
    /// The elevation's own Insert route. It knows the wall — you are looking
    /// straight at it — so the object goes in square and flush rather than
    /// landing mid-room to be dragged. The arithmetic is the SAME rest
    /// position `PlanEditing.snapObjectToWall` uses, half a wall band
    /// inboard of the centreline, so an object inserted from the face and
    /// one dragged into place end up in the same spot.
    private func placeAgainstWall(
        _ entry: ObjectCatalog.Entry, edge: Int, along: Double
    ) async {
        guard corners.indices.contains(edge) else { return }
        let (ai, bi) = PlanEditing.edgeCorners(edge, count: corners.count)
        let a = corners[ai]
        let b = corners[bi]
        let run = PlanEditing.length(PlanEditing.sub(b, a))
        guard run > 0.05 else { return }
        let d = PlanEditing.normalised(PlanEditing.sub(b, a))
        let winding = PlanEditing.polygonWinding(corners)
        let inward = CGPoint(x: -winding * d.y, y: winding * d.x)
        let rest = entry.depth / 2 + PlanEditing.wallFaceInset
        // Kept fully on the wall it was placed against.
        let clamped = min(max(along, entry.width / 2), max(run - entry.width / 2, entry.width / 2))
        let centre = CGPoint(
            x: a.x + d.x * clamped + inward.x * rest,
            y: a.y + d.y * clamped + inward.y * rest)
        let heading = atan2(d.y, d.x) * 180 / .pi + (winding > 0 ? 0 : 180)
        await place(
            entry, at: centre, rotation: heading.truncatingRemainder(dividingBy: 360))
    }

    /// Slide an existing object along the wall it stands against.
    ///
    /// The elevation's own drag. It keeps the object flush and square —
    /// only the distance along the wall changes — which is the whole of
    /// what a wall face can say about where a fixture sits. The arithmetic
    /// is `placeAgainstWall`'s, so an object slid on the face and one
    /// dragged on the plan come to rest by the same rule.
    private func slideAgainstWall(_ object: RoomObject, edge: Int, along: Double) async {
        guard corners.indices.contains(edge) else { return }
        let (ai, bi) = PlanEditing.edgeCorners(edge, count: corners.count)
        let a = corners[ai]
        let b = corners[bi]
        let run = PlanEditing.length(PlanEditing.sub(b, a))
        guard run > 0.05 else { return }
        let d = PlanEditing.normalised(PlanEditing.sub(b, a))
        let winding = PlanEditing.polygonWinding(corners)
        let inward = CGPoint(x: -winding * d.y, y: winding * d.x)
        let rest = object.depth / 2 + PlanEditing.wallFaceInset
        let clamped = min(
            max(along, object.width / 2), max(run - object.width / 2, object.width / 2))
        let centre = PlanEditing.quantise(
            CGPoint(
                x: a.x + d.x * clamped + inward.x * rest,
                y: a.y + d.y * clamped + inward.y * rest))
        replaceObject(object.id) { $0.moved(to: centre) }
        await patchObject(object.id, at: centre)
    }

    /// The write at the end of a drag — once, not per frame.
    private func endObjectDrag() {
        guard objectDragStart != nil, case .object(let id) = selection,
            let object = objects.first(where: { $0.id == id })
        else {
            objectDragStart = nil
            return
        }
        objectDragStart = nil
        // Rotation goes with it: a snap turned the object square to its
        // wall, and saving the position without the heading would put it
        // back at whatever angle it was dragged at.
        Task {
            await patchObject(
                id, at: CGPoint(x: object.x, y: object.y), rotation: object.rotation)
        }
    }

    private func patchObject(
        _ id: String, at point: CGPoint? = nil, rotation: Double? = nil
    ) async {
        // Optimistic locally so the drawing does not wait on the network,
        // then reconciled by the reload — the same shape every other write
        // in this editor uses.
        if let rotation { replaceObject(id) { $0.rotated(to: rotation) } }
        do {
            try await API.shared.updateObject(id: id, at: point, rotation: rotation)
        } catch {
            self.error = error.localizedDescription
            await loadObjects()
        }
    }

    private func duplicateObject(_ id: String) async {
        guard let object = objects.first(where: { $0.id == id }) else { return }
        do {
            // Offset half its own width, so the copy is visibly a second
            // object rather than sitting exactly on the first where nobody
            // can tell one was made.
            let newId = try await API.shared.createObject(
                roomScanId: room.id, kind: object.kind,
                at: CGPoint(x: object.x + object.width / 2, y: object.y + object.depth / 2),
                rotation: object.rotation,
                width: object.width, depth: object.depth, height: object.height)
            await loadObjects()
            select(.object(newId))
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func removeObject(_ id: String) async {
        do {
            try await API.shared.deleteObject(id: id)
            select(.none)
            await loadObjects()
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// §4's room-depth Insert: their five nouns, in their order, with the
    /// four that are not built greyed and saying why — the same treatment
    /// `LevelCanvas` already gives the floor-depth copy of this menu.
    @ViewBuilder private var insertMenu: some View {
        VStack(spacing: 0) {
            insertRow("Room", icon: "square.dashed", enabled: false, note: "Add rooms on the floor") {}
            Divider()
            insertRow("Object", icon: "bed.double", enabled: true) {
                placingObject = true
            }
            Divider()
            // His own ask: doors and windows reachable from the menu as
            // well as from a selected wall. With a wall already selected it
            // goes straight in; without one, the kind is chosen first and
            // the wall is tapped after.
            insertRow(
                "Door or window", icon: "door.left.hand.open", enabled: true,
                note: {
                    if case .wall = selection { return nil }
                    return "Choose one, then tap the wall"
                }()
            ) {
                placingObject = true
            }
            Divider()
            insertRow("Note", icon: "note.text", enabled: false, note: "Not stored yet") {}
            Divider()
            insertRow("Photo", icon: "camera", enabled: false, note: "In the room's own inspector") {}
            Divider()
            insertRow("Form", icon: "list.clipboard", enabled: false, note: "No templates yet") {}
        }
        .frame(width: 260)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
        .shadow(color: .black.opacity(0.14), radius: 10, y: 4)
    }

    private func insertRow(
        _ title: String, icon: String, enabled: Bool, note: String? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            guard enabled else { return }
            withAnimation(.snappy(duration: 0.15)) { insertMenuOpen = false }
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
                    .font(.system(size: 16))
                    .foregroundStyle(enabled ? Brand.blue : Brand.inkFaint)
            }
            .padding(.horizontal, Brand.Space.base)
            .padding(.vertical, Brand.Space.small)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    /// Which edges carry a live figure right now — ORD-31.
    ///
    /// The two either side of the corner being dragged, and only while it is
    /// being dragged. Empty otherwise, which is also what tells the floating
    /// label to draw itself: exactly one of the two is ever on screen.
    ///
    /// Behind `showDimensions` with everything else the layer switch hides.
    /// A drag still reports itself when dimensions are off — the floating
    /// label takes over, because this returns empty and stands aside.
    private var liveEdges: [Int] {
        guard showDimensions, dragStart != nil, corners.count >= 3,
            case .corner(let index) = selection
        else { return [] }
        return [(index - 1 + corners.count) % corners.count, index]
    }

    /// One bar tap. Only the verbs in `supportedActions` can arrive here —
    /// the rest are disabled in the bar — so this maps each to the editor's
    /// existing operation and ignores nothing silently.
    private func perform(_ action: EditorAction) {
        switch (action, selection) {
        case (.setSize, _):
            startMeasuring(at: 0)
        case (.duplicate, .none):
            Task { await duplicateRoom() }
        case (.delete, .none):
            confirmingRoomDelete = true
        case (.insert, .wall):
            // The same library as everywhere else — his ask, on his own
            // screenshots: the object list is what opens *"when clicking on
            // the walls and on the floor itself."* It still lands the door
            // in THIS wall, because a wall is selected.
            placingObject = true
        case (.addCorner, .wall(let index)):
            addCorner(on: index)
        case (.delete, .corner(let index)):
            deleteCorner(index)
        case (.delete, .opening(let index)):
            deleteOpening(index)
        case (.rotate, .object(let id)):
            // A quarter turn, which is what rotating a cabinet against a
            // wall actually means. Free rotation would need a handle and a
            // gesture; nobody has asked for one, and a stock unit sits
            // square to a wall in every room this trade works in.
            guard let object = objects.first(where: { $0.id == id }) else { break }
            Task { await patchObject(id, rotation: (object.rotation + 90).truncatingRemainder(dividingBy: 360)) }
        case (.duplicate, .object(let id)):
            Task { await duplicateObject(id) }
        case (.delete, .object(let id)):
            Task { await removeObject(id) }
        case (.replaceWith, .object):
            // The catalogue again: "replace with" on an object means swap
            // this cabinet for a different one, keeping where it stands.
            placingObject = true
        case (.insert, .none):
            withAnimation(.snappy(duration: 0.18)) { insertMenuOpen.toggle() }
        case (.replaceWith, .opening(let index)):
            // Opens the SAME sheet the swipe-up already reaches — its Kind
            // section, at the top, is what "Replace with…" means for
            // something with no catalogue of its own to browse: swap this
            // door or window for a different one of the same family.
            inspectingOpening = index
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
        case .object(let id):
            return objects.first { $0.id == id }?.displayName ?? room.name
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

    /// The frame the canvas draws through, FROZEN when the room opens.
    ///
    /// This used to be recomputed from the live corners every frame, and the
    /// result was that the camera chased every edit. Drag the top wall down
    /// and the room got shorter, so the fit scale grew and the drawing
    /// re-centred — which on screen looks exactly like the bottom wall rising
    /// to meet the top one and both side walls shrinking symmetrically. The
    /// geometry was right the whole time; the viewport was moving underneath
    /// it, and no amount of correct maths reads as correct through a moving
    /// camera.
    ///
    /// A drawing does not rescale while you draw on it. Frozen at open, the
    /// wall you drag is the only thing that moves, which is the whole point of
    /// dragging it. Two fingers still pan and zoom whenever the room needs
    /// re-framing.
    @State private var frozenBounds: CGRect?

    /// The externally-driven viewport's OWN bounds double as the frozen
    /// camera when embedded — `StoreyRoom.floorBounds` is built from the
    /// room's geometry once, at focus, and does not track live edits any
    /// more than `frozenBounds` below does for the standalone case. Both
    /// exist for the same reason; only where each one gets computed
    /// differs.
    private var bounds: CGRect { externalViewport?.bounds ?? (frozenBounds ?? measuredBounds) }

    /// The corners' actual extent — what the frame is set FROM, at open, and
    /// what a deliberate re-fit would read again.
    private var measuredBounds: CGRect {
        guard !corners.isEmpty else { return CGRect(x: 0, y: 0, width: 1, height: 1) }
        let xs = corners.map(\.x)
        let ys = corners.map(\.y)
        return CGRect(
            x: xs.min()!, y: ys.min()!,
            width: max(xs.max()! - xs.min()!, 0.1),
            height: max(ys.max()! - ys.min()!, 0.1))
    }

    /// Room metres → points, framed so the DIMENSIONS fit, not just the
    /// walls.
    ///
    /// The inset was 48 while the outermost thing drawn was a per-wall
    /// figure. ORD-23 put an overall line outboard of those, and a frame
    /// that fits only the walls clips the number the operator opened the
    /// room to read — so with the dimension layer on, the margin is the one
    /// `EditorChrome.overallExtentRow` needs plus its own type. Turn
    /// dimensions off and the room takes the space back.
    ///
    /// Standalone only. Entered from the storey canvas the camera is the
    /// shared `StoreyViewport`, and `LevelCanvas.cameraBounds` leaves the
    /// same margin there — in metres, so it interpolates with the zoom
    /// rather than jumping at the start of it.
    private func fitScale(in size: CGSize) -> CGFloat {
        let inset: CGFloat =
            showDimensions ? EditorChrome.overallExtentRow + EditorChrome.textLift + 12 : 48
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
        //
        // But the box is NOT a measurement, and it must never look like one.
        // A scan whose walls never met is an incomplete walk — a room with a
        // nook, or one the operator only got half way round — and squaring it
        // off produces a clean rectangle with a plausible area that nobody
        // measured. That figure reaches an estimate and then a claim. So the
        // fallback is kept, and flagged, loudly, until the operator has
        // actually corrected it.
        if scan.polygon.count >= 4 {
            corners = Array(scan.polygon.dropLast())
            outlineGuessed = false
        } else {
            corners = [
                CGPoint(x: 0, y: 0), CGPoint(x: scan.width, y: 0),
                CGPoint(x: scan.width, y: scan.height), CGPoint(x: 0, y: scan.height),
            ]
            outlineGuessed = true
        }
        // Placed openings come back in their editable form. An unknown kind
        // (from a newer build) is left out of the editor rather than guessed
        // at — deleting it here would delete it from the record on Save.
        openings = (room.geometry?.authoredOpenings ?? []).compactMap { record in
            guard let kind = PlanEditing.OpeningKind(rawValue: record.kind) else { return nil }
            return PlanEditing.WallOpening(
                edge: record.edge, offset: record.offset, width: record.width,
                height: record.height, sill: record.sill, kind: kind)
        }

        // Freeze the viewport to the room's extent AS OPENED. `measuredBounds`
        // is now correct for `corners`, so this is the one moment to capture
        // it — every drag after this reads through `frozenBounds` instead,
        // so the camera stops chasing the edit. Two-finger pan/zoom still
        // works on top of this frame; nothing re-fits it automatically.
        frozenBounds = measuredBounds
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
            onExit()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}

/// The standalone entry point: `RoomEditorCore` inside its own
/// `NavigationStack`, presented as a sheet from `RoomDetailView`'s "Adjust
/// the plan". Call sites are unchanged from before the 18 Aug 2026 split —
/// this exists so they do not have to know the core was ever extracted.
struct PlanEditorView: View {
    let room: RoomScan
    var inspectorIsBehind: Bool = false
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            RoomEditorCore(
                room: room, onExit: { dismiss() }, inspectorIsBehind: inspectorIsBehind,
                onSaved: onSaved)
        }
        .environment(\.colorScheme, .light)
    }
}

/// One door or window's own inspector — object-model §2's property sheet,
/// scoped to what this app actually stores about an opening today.
///
/// Reached by selecting one on the plan and swiping up. Before 18 Aug 2026
/// that gesture fell through to the ROOM's inspector regardless of what was
/// selected — the owner caught it directly: *"no matter what I select,
/// when I pull it up, it shows me the details of the room itself... I want
/// us to see the properties of the window and of the door and also to see
/// the illustration."*
///
/// **Deliberately smaller than the reference's own sheet.** Theirs has
/// Width, Height and Distance to Floor all independently editable, plus
/// Include in PDF and Display Label (object-model §2). An opening here has
/// no id and no database row of its own — it lives inside the room's
/// `geometry` JSON, saved only when the room itself saves — so width and
/// height come from `OpeningKind`'s own catalog (the builder's-stock sizes
/// this trade already frames to) rather than free-form fields, and there
/// is nowhere yet to hang a sill height, a PDF toggle, or photos filed
/// against one opening specifically (`project_files` has no column for
/// it). **Kind CAN be changed here** — the one edit that is genuinely
/// useful and safe to build today, since it is only ever swapping one
/// catalog entry for another, held in memory like every other edit until
/// the room's own Save, and routed through the same undo history.
struct OpeningDetailView: View {
    let opening: PlanEditing.WallOpening
    let onKindChanged: (PlanEditing.OpeningKind) -> Void
    /// Height, then distance-to-floor — the reference has three editable
    /// fields (object-model §2), this sheet ships two. Width sits back
    /// with the catalog on purpose: it is the one dimension that is
    /// GEOMETRICALLY load-bearing — it decides jamb spacing on the wall
    /// and can collide with a neighbouring opening — and validating that
    /// safely needs the wall's own length and its other openings, neither
    /// of which this isolated sheet has. `slideOpening` already does that
    /// arithmetic for a DRAG; a free-typed width doing it blind risked
    /// silently producing a door too wide for the wall it sits in. Height
    /// and sill have no such constraint — nothing on the 2D plan reads
    /// either one, both are already `min(_, ceiling)` clamped wherever
    /// they land — so there was nothing unsafe about shipping them today.
    let onDimensionsChanged: (Double, Double) -> Void
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var kind: PlanEditing.OpeningKind
    @State private var height: Double
    @State private var sill: Double
    @State private var confirmingDelete = false
    @State private var detent: PresentationDetent = .medium

    init(
        opening: PlanEditing.WallOpening, onKindChanged: @escaping (PlanEditing.OpeningKind) -> Void,
        onDimensionsChanged: @escaping (Double, Double) -> Void,
        onDelete: @escaping () -> Void
    ) {
        self.opening = opening
        self.onKindChanged = onKindChanged
        self.onDimensionsChanged = onDimensionsChanged
        self.onDelete = onDelete
        _kind = State(initialValue: opening.kind)
        _height = State(initialValue: opening.height)
        _sill = State(initialValue: opening.sill)
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            List {
                Section {
                    illustration
                        .frame(height: 120)
                        .frame(maxWidth: .infinity)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Brand.surface)
                }

                Section {
                    ForEach(
                        kind.category == .passage
                            ? [.doorCased] : (kind.category == .door ? Self.doors : Self.windows),
                        id: \.self
                    ) { option in
                        Button {
                            // Height and sill reset to the NEW kind's own
                            // catalog figures — a standard window switched
                            // to wide should read as a wide window's own
                            // typical size, not keep the old one's numbers
                            // stamped on a different kind. Width does the
                            // same on the PARENT side, in `onKindChanged`.
                            kind = option
                            height = option.height
                            sill = option.sill
                            onKindChanged(option)
                        } label: {
                            HStack {
                                Text(option.label).foregroundStyle(Brand.ink)
                                Spacer()
                                Text(UnitSettings.shared.format.format(option.width))
                                    .font(.system(size: 13))
                                    .foregroundStyle(Brand.inkFaint)
                                if option == kind {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundStyle(Brand.blue)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text(kind.category == .passage ? "Kind" : "Kind — \(kind.category == .door ? "doors" : "windows")")
                }

                Section {
                    StatisticRowView(
                        row: .init(
                            id: "width", label: "Width",
                            value: UnitSettings.shared.format.format(opening.width), meaning: nil))
                    OpeningDimensionStepper(label: "Height", value: $height) {
                        onDimensionsChanged(height, sill)
                    }
                    OpeningDimensionStepper(label: "Distance to Floor", value: $sill) {
                        onDimensionsChanged(height, sill)
                    }
                } header: {
                    Text("Dimensions")
                } footer: {
                    Text("Width follows the kind above, sized to fit the wall. Height and Distance to Floor are this opening's own — the reference's own third field, for the sill height this app never had anywhere to store until now.")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.inkFaint)
                }

                Section {
                    Button(
                        "Delete this \(kind.category == .window ? "window" : kind.category == .door ? "door" : "opening")",
                        role: .destructive
                    ) {
                        confirmingDelete = true
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .scrollContentBackground(.hidden)
        }
        .background(Brand.Plan.paper)
        .presentationDetents([.medium, .large], selection: $detent)
        .presentationDragIndicator(.visible)
        .confirmationDialog(
            "Delete this \(kind.label.lowercased())?",
            isPresented: $confirmingDelete, titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                onDelete()
                dismiss()
            }
            Button("Keep it", role: .cancel) {}
        }
    }

    private static let doors: [PlanEditing.OpeningKind] = [.doorSingle, .doorDouble, .doorSliding]
    private static let windows: [PlanEditing.OpeningKind] = [
        .windowStandard, .windowWide, .windowSmall,
    ]

    private var header: some View {
        HStack(spacing: Brand.Space.small) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 17))
                .foregroundStyle(Brand.blue)
                .accessibilityHidden(true)
            Text(kind.label)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Brand.ink)
            Spacer()
            Button {
                if detent == .large { detent = .medium } else { dismiss() }
            } label: {
                Image(systemName: "chevron.down.circle.fill")
                    .font(.system(size: 24))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(Brand.inkFaint)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(detent == .large ? "Collapse" : "Close")
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.top, Brand.Space.base)
        .padding(.bottom, Brand.Space.small)
    }

    /// The opening drawn as it appears IN ELEVATION — straight on, standing
    /// on the floor at its own sill height, at its own real proportions.
    ///
    /// The owner asked for exactly this, 18 Aug 2026: *"when we click on the
    /// door and we swipe up, do you think it's a good idea to see the actual
    /// illustration of the door, the way that it looks on the elevation
    /// view?"* It is, and for a reason beyond looks: the two fields directly
    /// below this drawing are Height and Distance to Floor, and an elevation
    /// is the ONE view in which both are visible at once. A plan symbol
    /// shows neither. Stepping the sill up now visibly lifts the drawing off
    /// the floor line, so the number and the picture check each other.
    ///
    /// Proportional, not to scale with anything else on screen: the widest
    /// dimension fills the box, so a 2'-wide hopper and a 6'-wide slider
    /// both read clearly at 120pt tall. Conventions follow
    /// `ElevationView`'s own — floor line heavy, opening outlined, glazing
    /// bars for a window, a leaf-and-handle for a door.
    private var illustration: some View {
        Canvas { context, size in
            let ink = Brand.Plan.ink
            let floorY = size.height - 18
            let headroom = floorY - 14

            // Fit the tallest thing being drawn (sill + height) into the
            // available headroom, so a high-silled window still lands
            // inside the box rather than off the top of it.
            let total = max(sill + height, 0.3)
            let ppm = headroom / total
            let openingH = height * ppm
            let sillH = sill * ppm
            let openingW = min(size.width - 56, max(40, opening.width * ppm))
            let x0 = (size.width - openingW) / 2
            let topY = floorY - sillH - openingH

            // The floor, and the wall either side — the context that makes
            // "distance to floor" mean something.
            var floor = Path()
            floor.move(to: CGPoint(x: 12, y: floorY))
            floor.addLine(to: CGPoint(x: size.width - 12, y: floorY))
            context.stroke(
                floor, with: .color(ink), style: StrokeStyle(lineWidth: 2.5, lineCap: .square))

            let rect = CGRect(x: x0, y: topY, width: openingW, height: openingH)

            switch kind.category {
            case .window:
                context.fill(Path(rect), with: .color(Brand.blue.opacity(0.07)))
                context.stroke(Path(rect), with: .color(ink), lineWidth: 1.6)
                // Glazing bars, the elevation convention: one vertical, one
                // horizontal, so it reads as a window and not a panel.
                var bars = Path()
                bars.move(to: CGPoint(x: rect.midX, y: rect.minY))
                bars.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
                bars.move(to: CGPoint(x: rect.minX, y: rect.midY))
                bars.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
                context.stroke(bars, with: .color(ink.opacity(0.55)), lineWidth: 0.9)
                // The sill itself, drawn heavier — it is the field being
                // edited two rows below.
                if sillH > 2 {
                    var sillLine = Path()
                    sillLine.move(to: CGPoint(x: rect.minX - 4, y: rect.maxY))
                    sillLine.addLine(to: CGPoint(x: rect.maxX + 4, y: rect.maxY))
                    context.stroke(sillLine, with: .color(ink), lineWidth: 2)
                }

            case .door:
                context.fill(Path(rect), with: .color(Brand.blue.opacity(0.07)))
                context.stroke(Path(rect), with: .color(ink), lineWidth: 1.6)
                if kind == .doorDouble {
                    var meeting = Path()
                    meeting.move(to: CGPoint(x: rect.midX, y: rect.minY))
                    meeting.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
                    context.stroke(meeting, with: .color(ink.opacity(0.7)), lineWidth: 1.1)
                } else if kind == .doorSliding {
                    // Two panels, bypassing — the elevation reading of the
                    // same convention the plan glyph draws in section.
                    var split = Path()
                    split.move(to: CGPoint(x: rect.midX, y: rect.minY))
                    split.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
                    context.stroke(
                        split, with: .color(ink.opacity(0.7)),
                        style: StrokeStyle(lineWidth: 1.1, dash: [4, 3]))
                } else {
                    // A handle, on the latch side — the one mark that makes
                    // a rectangle read as a door at a glance.
                    let knobY = rect.midY
                    let knobX = rect.maxX - max(8, openingW * 0.14)
                    context.fill(
                        Path(ellipseIn: CGRect(x: knobX - 2.5, y: knobY - 2.5, width: 5, height: 5)),
                        with: .color(ink))
                }

            case .passage:
                // No leaf and no sill — a cased opening is a hole with
                // jambs and a head, so that is exactly what is drawn.
                var frame = Path()
                frame.move(to: CGPoint(x: rect.minX, y: rect.maxY))
                frame.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
                frame.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
                frame.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
                context.stroke(
                    frame, with: .color(ink), style: StrokeStyle(lineWidth: 1.6, dash: [5, 3]))
            }
        }
    }
}

/// One editable length row for `OpeningDetailView` — the formatted value on
/// the right with native stepper chevrons, echoing the reference's own
/// `0.900 m ⌃⌄` control (object-model §2) without reproducing its exact
/// widget, which this platform does not have a stock equivalent for.
///
/// Steps a fixed inch (`0.0254 m`) regardless of the operator's own display
/// unit — the same builder's-stock granularity every catalog width in this
/// app is already defined in, so a step never lands on an number that reads
/// as oddly precise in feet-and-inches.
private struct OpeningDimensionStepper: View {
    let label: String
    @Binding var value: Double
    let onCommit: () -> Void

    private static let step = 0.0254
    private static let maxMetres = 6.0

    var body: some View {
        Stepper {
            HStack {
                Text(label).foregroundStyle(Brand.ink)
                Spacer()
                Text(UnitSettings.shared.format.format(value))
                    .foregroundStyle(Brand.inkFaint)
                    .monospacedDigit()
            }
        } onIncrement: {
            value = min(Self.maxMetres, value + Self.step)
            onCommit()
        } onDecrement: {
            value = max(0, value - Self.step)
            onCommit()
        }
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
                                        ? UnitSettings.shared.format.format(kind.width) + " wide"
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

