import ARKit
import RoomPlan
import SwiftUI

/// Scan a room and file it, in one pass — or several rooms, in one visit.
///
/// The chain the web build already has, now native: which floor, then capture,
/// then name it and accept it. The project is known before this opens — it is
/// presented from a project — so it is never asked for, which is the whole
/// point of reaching scanning through the job rather than through a tab.
///
/// A capture is NOT saved until the operator says so. The web version once
/// filed every scan the instant RoomPlan returned it, named "Room 3", which
/// kept bad captures and gave good ones a name nobody recognised a week later.
///
/// Multi-room is a loop inside this one sheet, not repeated visits to it.
/// After a room is filed the flow offers the next scan instead of closing,
/// because the value of staying is invisible but real: every room captured
/// while the sheet is open shares one AR world frame (`ScanSession`), which
/// is the only thing that lets the plan show the rooms where they actually
/// sit instead of packed side by side.
///
/// **Order of the chain (ORD-17, `owner-walkthrough.md` A1-A3).** Floor and
/// mode, then the room's TYPE, then the briefing, then the camera. The type
/// used to be asked at review, after the walk — which is the one thing the
/// owner's own session showed we had backwards. Asking first is not a nicety:
/// it is where the room's name comes from, so a job stops arriving as
/// `Room 3`, `Room 4`, `Room 5`.
struct CaptureFlow: View {
    let projectId: String
    let projectName: String
    /// Rooms already on this project, so a new one is numbered and positioned
    /// after them rather than colliding.
    let existingCount: Int
    /// The names already used on this project. Names now come from the room
    /// type (ORD-17), so a second bedroom would land as a second `Bedroom` —
    /// two identical rows in a claim file nobody can tell apart. Knowing what
    /// is taken is what lets the flow offer `Bedroom 2` instead.
    var existingNames: [String] = []
    /// Where the flow opens when the storey is already known — entered from a
    /// floor plan rather than from the project. The floor chooser still shows,
    /// because the MODE choice lives there and is one-way once made (A1).
    var initialLevel: String? = nil
    /// Skip the mode chooser and go straight to this mode.
    ///
    /// Set by `Add Floor`: picking a storey there has already answered both
    /// questions the chooser asks — which floor, and how it is being
    /// measured — so showing it again is a screen with nothing left to
    /// decide on it. The A1 note that the mode choice is one-way still
    /// holds; this only moves WHERE it is made, not how often.
    var initialMode: CaptureMode? = nil
    let onSaved: () -> Void
    /// The visit is over: the storey it was on, and everything it filed.
    /// ORD-16 — the operator lands on that storey's drawn plan, not on a list.
    /// Nil leaves the old behaviour (close, and go back to whatever presented
    /// this) for any caller that has nowhere to land.
    var onFinished: ((String, [FiledRoom]) -> Void)? = nil

    @Environment(\.dismiss) private var dismiss

    @State private var level = "Ground"
    @State private var stage: Stage = .chooseFloor
    /// How this room is being measured. One-way for the room once chosen
    /// (A1) — there is no switching mid-capture, so it is set at the floor
    /// chooser and only a new room resets it.
    @State private var mode: CaptureMode = .scan
    @State private var geometry: ScanGeometry?
    @State private var name = ""
    /// The living-area engine's input. nil until the operator picks — and a
    /// room cannot be saved untyped, because an untyped room silently counts
    /// as `other` at 100%, which counts basements at 100% until somebody
    /// notices.
    @State private var roomType: String?
    /// What the sanity pass made of the capture, computed BEFORE the review
    /// sheet shows so the sheet can lead with a problem instead of a row of
    /// confident-looking numbers. Nil for drawn rooms — a drawn rectangle
    /// is closed by construction and warning about it would be noise.
    @State private var analysis: ReviewAnalysis?
    /// The name the last filed room went out under. The saved stage reads
    /// this, not `name` — `name` can already belong to a discarded retake by
    /// the time the stage is on screen.
    @State private var lastSavedName = ""
    @State private var saving = false
    @State private var error: String?

    /// Everything captured this visit, and the AR session tying it together.
    @StateObject private var session = ScanSession()
    /// Rooms filed since this sheet opened — numbering and positions have to
    /// advance past them, and `existingCount` was read once at presentation.
    @State private var savedThisVisit = 0
    /// Whether the room under review came from the camera. A drawn room has
    /// no `CapturedRoom`, so it can neither join the merge set nor anchor a
    /// "scan another room" loop.
    @State private var lastWasScan = false
    /// What happened when the visit's rooms were registered together —
    /// shown on the saved stage, because a placement that silently failed
    /// would leave the operator expecting a plan the canvas cannot draw.
    @State private var placementNote: String?
    @State private var placementFailed = false
    /// The full 18-type living-area vocabulary, behind the More… chip.
    /// Loaded once from the living-area endpoint when the sheet first opens;
    /// the eight chips need no network and keep working without it.
    @State private var pickingMoreTypes = false
    @State private var allRoomTypes: [LivingRoomType] = []
    /// Everything filed since the sheet opened, carried to the plan the
    /// operator lands on. A scan held offline has no row to come back from the
    /// API, and "where is my scan" must still have an answer on that sheet.
    @State private var filedThisVisit: [FiledRoom] = []

    enum CaptureMode {
        case scan
        /// Start from a rectangle and pull it into shape.
        case draw
        /// Place each corner where the wall actually turns. The reference's
        /// `Draw Room`; sibling of `.draw`, not a replacement — a bedroom is
        /// fastest pulled from a rectangle, an L-shaped basement with a
        /// bulkhead has no rectangle to start from.
        case drawCorners
    }

    private enum Stage {
        case chooseFloor
        /// ORD-17: the type is chosen BEFORE the camera opens (A3), and the
        /// room's name comes from it.
        case chooseType
        /// The briefing that precedes every scan — every time, not only the
        /// first (A2).
        case briefing
        case capturing
        /// Drawing a room by hand, on the plan editor's canvas.
        case drawing
        /// Corner-by-corner drawing, `DrawRoomView`.
        case drawingCorners
        case review
        /// Filed. Offer the next room while the AR session still tracks.
        case saved
    }

    // ORD-12: one floor vocabulary. The list lives in FloorVocabulary (the
    // Swift twin of src/lib/crm/floors.ts), not here.
    //
    // ORD-15: most-common-first. The three storeys nearly every job is on —
    // mirror of COMMON_FLOOR_IDS in src/lib/crm/floors.ts, in the same
    // presentation order (Ground, then Basement — this trade lives in
    // basements — then 2nd). Filtered against the vocabulary so a drifted
    // spelling here could never offer a floor that does not exist; the rest
    // of the list comes from FloorVocabulary itself, behind "See more".
    private static let commonLevels = ["Ground", "Basement", "2nd"]
        .filter { FloorVocabulary.ids.contains($0) }
    private static let otherLevels = FloorVocabulary.ids
        .filter { !commonLevels.contains($0) }
    @State private var showAllFloors = false

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                switch stage {
                case .chooseFloor: floorChooser
                case .chooseType: typeChooser
                case .briefing: briefing
                case .capturing, .drawing, .drawingCorners: Color.clear
                case .review: review
                case .saved: savedStage
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    // Nothing to cancel once a room is filed — the saved
                    // stage's own buttons are the only honest exits.
                    if stage != .saved {
                        Button("Cancel") {
                            // Backing out after filing something still ends on
                            // that storey's plan: the rooms exist, and the
                            // project list is the destination this order was
                            // written to stop landing on.
                            if filedThisVisit.isEmpty {
                                session.end()
                                dismiss()
                            } else {
                                finish()
                            }
                        }
                    }
                }
            }
        }
        .fullScreenCover(
            isPresented: .init(get: { stage == .drawingCorners }, set: { _ in })
        ) {
            DrawRoomView(
                onCancel: { stage = .briefing },
                onDone: { polygon, ceiling, openings in
                    finishDrawn(polygon: polygon, ceiling: ceiling, openings: openings)
                })
        }
        .fullScreenCover(isPresented: .init(get: { stage == .drawing }, set: { _ in })) {
            RoomSketchView(
                // Back to the briefing, not to the start: the type and name
                // for this room have already been chosen and backing out of
                // the canvas is not a decision to unmake them.
                onCancel: { stage = .briefing },
                onDone: { polygon, ceiling, openings in
                    // Both streams meet here: the drawn room carries its
                    // authored openings (so net wall area is honest), and the
                    // visit counter and pre-review analysis from the
                    // shared-session loop all still apply. The name and type
                    // are NOT set here any more — they were chosen before the
                    // canvas opened (ORD-17).
                    geometry = ScanGeometry(
                        polygon: polygon, ceilingHeight: ceiling, authored: openings)
                    analysis = nil
                    lastWasScan = false
                    stage = .review
                })
        }
        .fullScreenCover(isPresented: .init(get: { stage == .capturing }, set: { _ in })) {
            RoomCaptureScreen(
                arSession: session.arSession,
                previousRooms: session.capturedRoomsSoFar
            ) { outcome in
                switch outcome {
                case .success(let room):
                    if #available(iOS 17.0, *) {
                        // Held for the merge as well as reviewed: every room
                        // of the visit has to stay in hand until
                        // StructureBuilder can register them against each
                        // other.
                        session.add(room)
                        let captured = ScanGeometry(room: room)
                        geometry = captured
                        // The name and type are already set — each room is
                        // typed on its own BEFORE its camera opens (ORD-17),
                        // which is what stops a bathroom being filed as a
                        // second kitchen by somebody saving fast.
                        //
                        // Still judged before the review appears: the analysis
                        // now feeds the marks on the storey plan (ORD-16)
                        // rather than a card the operator taps past.
                        analysis = ReviewAnalysis(geometry: captured)
                        lastWasScan = true
                        stage = .review
                    }
                case .failure(let failure):
                    let text = failure.localizedDescription
                    // Backing out is the ordinary way to abandon a scan and
                    // must not be dressed up as a fault.
                    error = text.localizedCaseInsensitiveContains("cancel") ? nil : text
                    // Back to the briefing: this room is still the room being
                    // measured, and its type does not need choosing twice.
                    stage = .briefing
                }
            }
            .ignoresSafeArea()
        }
        .onAppear {
            // Entered from a storey's own plan: that storey is already the
            // answer, so the chooser opens on it rather than on Ground.
            if let initialLevel, FloorVocabulary.ids.contains(initialLevel) {
                level = initialLevel
            }
            // A mode chosen before the flow opened means the chooser has
            // nothing left to ask: begin the room on that storey directly.
            if let initialMode, stage == .chooseFloor {
                startRoom(initialMode)
            }
        }
        .sheet(isPresented: $pickingMoreTypes) {
            FullRoomTypeSheet(
                projectId: projectId,
                selected: roomType,
                types: $allRoomTypes
            ) { picked, label in
                pickingMoreTypes = false
                choose(type: picked, label: label)
            }
        }
    }

    /// A type was chosen — which names the room and opens the way to the
    /// camera (ORD-17). The name is a default, not a verdict: the briefing
    /// screen that follows carries it in an editable field.
    private func choose(type id: String, label: String) {
        roomType = id
        name = availableName(from: label)
        stage = .briefing
    }

    /// The type's label, made unique against the names already on this job.
    ///
    /// Deriving names from types is what retires `Room 3` — but a house with
    /// three bedrooms would then file three rows called `Bedroom`, which is
    /// worse: a report has to be able to say WHICH bedroom. The second one
    /// becomes `Bedroom 2`.
    private func availableName(from label: String) -> String {
        let taken = Set(
            (existingNames + filedThisVisit.map(\.name))
                .map { $0.trimmed.lowercased() })
        guard taken.contains(label.lowercased()) else { return label }
        var n = 2
        while taken.contains("\(label) \(n)".lowercased()) { n += 1 }
        return "\(label) \(n)"
    }

    /// Begin a room: the type is asked first, so nothing here is carried over
    /// from the last one.
    private func startRoom(_ chosen: CaptureMode) {
        mode = chosen
        roomType = nil
        name = ""
        geometry = nil
        analysis = nil
        error = nil
        stage = .chooseType
    }

    /// Both drawing canvases land here, so a drawn room reaches `review`
    /// the same way whichever produced it — one save path, not two.
    private func finishDrawn(
        polygon: [CGPoint], ceiling: Double, openings: [PlanEditing.WallOpening]
    ) {
        geometry = ScanGeometry(polygon: polygon, ceilingHeight: ceiling, authored: openings)
        analysis = nil
        lastWasScan = false
        stage = .review
    }

    /// Which canvas a mode ends on. `.scan` goes by way of the briefing;
    /// both drawing modes have their own instructions on the canvas itself.
    private var canvasStage: Stage {
        switch mode {
        case .scan: return .capturing
        case .draw: return .drawing
        case .drawCorners: return .drawingCorners
        }
    }

    /// The eight common chips — plus the chosen type when it came from the
    /// full list, so a selection made behind More… stays visible as a
    /// selected chip instead of silently deselecting the row.
    private var chipOptions: [TypeChip] {
        var options = Self.typeChips
        if let roomType, !options.contains(where: { $0.id == roomType }) {
            let label = allRoomTypes.first { $0.id == roomType }?.label ?? roomType
            options.append(TypeChip(label: label, id: roomType))
        }
        return options
    }

    private var title: String {
        switch stage {
        case .chooseType: return "Select Room Type"
        case .briefing: return name.trimmed.isEmpty ? "Ready" : name.trimmed
        case .review: return "Is this the shape?"
        case .saved: return "Room saved"
        default: return "Add a room"
        }
    }

    // MARK: - Floor

    private var floorChooser: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Brand.Space.base) {
                Text(projectName)
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.inkSoft)

                SectionHeading(title: "WHICH FLOOR?", trailing: "Most common")

                // Most-common-first (ORD-15): the three storeys nearly every
                // job is on, the rest one tap behind See more — a picker
                // should not make the operator read Attic to find Basement.
                VStack(spacing: Brand.Space.tight) {
                    ForEach(Self.commonLevels, id: \.self) { option in
                        floorRow(option)
                    }
                }

                if showAllFloors {
                    SectionHeading(title: "OTHER FLOORS")
                        .padding(.top, Brand.Space.tight)

                    VStack(spacing: Brand.Space.tight) {
                        ForEach(Self.otherLevels, id: \.self) { option in
                            floorRow(option)
                        }
                    }
                } else {
                    Button {
                        withAnimation(.easeOut(duration: 0.15)) { showAllFloors = true }
                    } label: {
                        HStack(spacing: 4) {
                            Text("See more")
                            Image(systemName: "chevron.down")
                                .font(.system(size: 11, weight: .bold))
                        }
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Brand.blue)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Brand.Space.small)
                    }
                    .buttonStyle(.plain)
                }

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                if !RoomCaptureSession.isSupported {
                    Card {
                        Text("This device has no LiDAR sensor, so it cannot scan. Rooms can still be entered by hand on the web build.")
                            .font(.callout)
                            .foregroundStyle(.orange)
                    }
                }

                SectionHeading(title: "HOW WILL YOU MEASURE IT?")
                    .padding(.top, Brand.Space.small)

                // The mode choice is one-way for the room it starts (A1):
                // there is no switching once the walk begins, which is why it
                // is made here, in the open, and not offered again later.
                Text("Once a room is started this cannot be changed for it.")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkFaint)

                Button("Scan the room") { startRoom(.scan) }
                    .buttonStyle(PrimaryButtonStyle(enabled: RoomCaptureSession.isSupported))
                    .disabled(!RoomCaptureSession.isSupported)

                // Drawing works on any phone, in any light, in a gutted
                // basement with the power off — which is a normal Tuesday on
                // a water-damage job, and exactly when the camera cannot
                // track anything.
                Button {
                    startRoom(.draw)
                } label: {
                    HStack {
                        Image(systemName: "pencil.and.ruler")
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Draw it instead")
                                .font(.system(size: 15, weight: .bold))
                            Text("Start from a rectangle and pull it into shape. No camera needed.")
                                .font(.system(size: 12))
                                .foregroundStyle(Brand.inkSoft)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer()
                    }
                    .foregroundStyle(Brand.blue)
                    .padding(Brand.Space.base)
                    .frame(maxWidth: .infinity)
                    .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
                    .overlay(
                        RoundedRectangle(cornerRadius: Brand.Radius.card)
                            .strokeBorder(Brand.blue.opacity(0.3), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            .padding(Brand.Space.base)
        }
    }

    /// One floor as a selectable row — the same row whichever group it
    /// appears in, so "common" is an ordering, not a different control.
    private func floorRow(_ option: String) -> some View {
        Button {
            // A merge set is one storey. Rooms on different floors still
            // share the AR frame, but placing a basement against a kitchen
            // would write plan positions that mean nothing on either sheet.
            if level != option { session.resetRooms() }
            level = option
        } label: {
            Card(padding: Brand.Space.small) {
                HStack {
                    Text(option)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Brand.ink)
                    Spacer()
                    if level == option {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Brand.blue)
                    }
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Type, before the camera (ORD-17)

    /// The room's type, asked before anything is measured.
    ///
    /// The chips themselves are ORD-06's and are correct; only their place in
    /// the chain was wrong (`ORDERS.md`, ORD-06 CORRECTION). Same
    /// most-common-first shape as the floor list above it (ORD-15): the eight
    /// this trade actually walks into, the full eighteen one tap behind More.
    ///
    /// A tap here both types AND names the room and moves straight on — the
    /// name it derives is editable on the very next screen, so there is
    /// nothing here worth a confirm step.
    private var typeChooser: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Brand.Space.base) {
                Text("\(projectName) · \(level)")
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.inkSoft)

                SectionHeading(title: "WHAT KIND OF ROOM?", trailing: "Most common")

                Text(
                    "The room is named from this, and living area is counted from it. Both can be changed afterwards."
                )
                .font(.system(size: 12))
                .foregroundStyle(Brand.inkFaint)

                TypeChips(
                    options: chipOptions,
                    selected: roomType,
                    onMore: { pickingMoreTypes = true }
                ) { chip in
                    choose(type: chip.id, label: chip.label)
                }

                Button("Back") { stage = .chooseFloor }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Brand.inkSoft)
                    .frame(maxWidth: .infinity)
                    .padding(.top, Brand.Space.small)
            }
            .padding(Brand.Space.base)
        }
    }

    // MARK: - Briefing, every time (ORD-17 / A2)

    /// The screen between the type and the camera. It appears on EVERY room,
    /// not only the first — the owner was explicit about that (A2), and it is
    /// right: this is the last moment the operator is looking at the phone
    /// rather than through it.
    ///
    /// It carries the room's name, because a name derived from a type is a
    /// default and defaults have to be correctable somewhere. Here is the only
    /// honest place left: the review after the walk is down to the shape and
    /// two buttons (ORD-16).
    private var briefing: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Brand.Space.base) {
                SectionHeading(title: "NAME THIS ROOM", trailing: level)

                TextField("Kitchen, Basement bathroom…", text: $name)
                    .font(.system(size: 16))
                    .padding(Brand.Space.base)
                    .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
                    .overlay(
                        RoundedRectangle(cornerRadius: Brand.Radius.card)
                            .strokeBorder(Brand.hairline, lineWidth: 0.5))

                Button {
                    stage = .chooseType
                } label: {
                    HStack(spacing: 4) {
                        Text(typeLabel ?? "No type")
                        Text("· Change")
                            .foregroundStyle(Brand.blue)
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Brand.inkSoft)
                }
                .buttonStyle(.plain)

                Card {
                    VStack(alignment: .leading, spacing: Brand.Space.tight) {
                        Text(mode == .scan ? "Before you start" : "How drawing works")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Brand.ink)
                        ForEach(briefingPoints, id: \.self) { point in
                            HStack(alignment: .top, spacing: Brand.Space.tight) {
                                Text("·").foregroundStyle(Brand.inkFaint)
                                Text(point)
                                    .font(.system(size: 13))
                                    .foregroundStyle(Brand.inkSoft)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }

                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }

                if mode == .scan {
                    // A large button that must be tapped to begin (A2). Red
                    // because it starts a recording, the way a record button
                    // is red — it is not an accent, so the Brand.blue rule
                    // does not reach it.
                    Button {
                        error = nil
                        stage = .capturing
                    } label: {
                        Text("Start scanning")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 18)
                            .background(
                                Color(hex: 0xD0342C), in: .rect(cornerRadius: Brand.Radius.card))
                    }
                    .buttonStyle(.plain)
                    .disabled(name.trimmed.isEmpty)
                    .opacity(name.trimmed.isEmpty ? 0.5 : 1)
                } else {
                    Button(mode == .drawCorners ? "Start placing corners" : "Start drawing") {
                        error = nil
                        stage = canvasStage
                    }
                    .buttonStyle(PrimaryButtonStyle(enabled: !name.trimmed.isEmpty))
                    .disabled(name.trimmed.isEmpty)
                }
            }
            .padding(Brand.Space.base)
        }
    }

    private var typeLabel: String? {
        guard let roomType else { return nil }
        return chipOptions.first { $0.id == roomType }?.label
            ?? allRoomTypes.first { $0.id == roomType }?.label
            ?? roomType
    }

    private var briefingPoints: [String] {
        mode == .scan
            ? [
                "Stand inside the room and hold the phone up, screen towards you.",
                "Walk the whole perimeter, pointing at every wall in turn — the green outline closes when the room does.",
                "The white circle takes a photo mid-scan and files it against this room, so nothing has to be photographed twice.",
            ]
            : [
                "Start from a rectangle and pull the corners into the shape of the room.",
                "Type a wall's length to set it exactly — a typed length is marked as hand-set, and stays that way.",
                "Doors and windows go on afterwards, so the wall area is net of them.",
            ]
    }

    // MARK: - Review — the shape, and two ways out (ORD-16)

    /// What the owner asked for and nothing else: *"their review is good
    /// enough for me"* (A9) — the shape, Confirm, Discard.
    ///
    /// What used to be here and is now elsewhere, deliberately:
    ///
    /// - the **name** and the **type** are asked before the camera (ORD-17),
    ///   because they are decisions about a room, not about a capture;
    /// - the **stat band** and the wall/door/window count belong to a room
    ///   that exists — they are on the storey's info sheet and in the room's
    ///   own screen. Nobody standing in a wet basement audits a perimeter;
    /// - the **warnings** move onto the storey plan, attached to the room they
    ///   concern. They are not dropped: recomputed there from stored geometry,
    ///   they outlive this screen instead of being tapped past once.
    ///
    /// The one thing that stays with the shape is the dashed guessed edge.
    /// That is not commentary on the capture, it IS the shape — it says which
    /// part of the outline was never walked, which is precisely what "is this
    /// the shape?" is asking.
    private var review: some View {
        VStack(spacing: Brand.Space.base) {
            if let analysis, !analysis.plan.isEmpty {
                ReviewPlanPreview(plan: analysis.plan, outline: analysis.outline)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(Brand.Space.base)
            } else if let geometry, !FloorPlanGeometry.plan(from: geometry).isEmpty {
                // A drawn room has no analysis — it is closed by construction
                // — but it still has a shape to confirm.
                ReviewPlanPreview(plan: FloorPlanGeometry.plan(from: geometry), outline: nil)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(Brand.Space.base)
            } else {
                Spacer()
                Text("Nothing came back from that capture.")
                    .font(.callout)
                    .foregroundStyle(.orange)
                Spacer()
            }

            if let error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(.horizontal, Brand.Space.base)
            }

            VStack(spacing: Brand.Space.small) {
                Button(saving ? "Saving…" : "Confirm") {
                    Task { await save() }
                }
                .buttonStyle(PrimaryButtonStyle(enabled: !saving))
                .disabled(saving)

                // The reject path (INT-S11): destructive, present, and
                // visually subordinate — a bad capture must be as easy to
                // throw away as a good one is to keep.
                Button("Discard") {
                    // A rejected capture must leave the merge set, or the
                    // builder would register a room the operator threw away.
                    if lastWasScan { session.discardLastUnsaved() }
                    geometry = nil
                    analysis = nil
                    // Back to the briefing for this same room: its name and
                    // its type are still good, and the usual reason to discard
                    // is to walk it again. Never out of the flow entirely —
                    // discarding one room says nothing about being done.
                    stage = .briefing
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.red.opacity(0.8))
                .frame(maxWidth: .infinity)
                .disabled(saving)
            }
            .padding(.horizontal, Brand.Space.base)
            .padding(.bottom, Brand.Space.base)
        }
    }

    // MARK: - Saved: offer the next room

    /// The room is filed; the AR session is still tracking. This screen
    /// exists to say why staying is worth it — rooms scanned in one visit
    /// land on the plan where they actually sit — and to report honestly
    /// when that placement could not be delivered.
    private var savedStage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Brand.Space.base) {
                Card {
                    VStack(alignment: .leading, spacing: Brand.Space.tight) {
                        Text("\(lastSavedName.isEmpty ? "The room" : lastSavedName) is filed under \(level).")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Brand.ink)
                        Text(
                            savedThisVisit >= 2
                                ? "\(savedThisVisit) rooms this visit."
                                : "Keep going while the phone is still tracking: rooms scanned in one visit are placed on the plan the way they actually sit. Close this, and the next room starts from scratch."
                        )
                        .font(.system(size: 13))
                        .foregroundStyle(Brand.inkSoft)
                    }
                }

                if let placementNote {
                    Card {
                        Text(placementNote)
                            .font(.callout)
                            .foregroundStyle(placementFailed ? .orange : Brand.inkSoft)
                    }
                }

                // The loop (A10) — and it re-enters at the TYPE, never
                // straight at the camera: every room is typed before its own
                // walk, which is the whole of ORD-17.
                Button(mode == .scan ? "Scan another room" : "Draw another room") {
                    startRoom(mode)
                }
                .buttonStyle(PrimaryButtonStyle(enabled: true))

                Button("Done") { finish() }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Brand.inkSoft)
                    .frame(maxWidth: .infinity)
                    .padding(.top, Brand.Space.hair)
            }
            .padding(Brand.Space.base)
        }
    }

    /// Leaving the flow for good — and landing on the drawn plan for the
    /// storey just measured (ORD-16), which is the answer to *"where is my
    /// scan after the scanning"*. The rooms filed this visit go with it, so
    /// the sheet can draw one that is still queued for upload.
    private func finish() {
        session.end()
        onFinished?(level, filedThisVisit)
        dismiss()
    }

    /// The eight kinds of room this trade actually walks into, mapped onto
    /// the living-area vocabulary (`livingArea.ts` ROOM_TYPES ids — the
    /// string is the contract, the server never re-derives it). The full
    /// eighteen-type list stays available in the room detail for the odd
    /// crawl space; these eight cover the walk.
    private static let typeChips: [TypeChip] = [
        TypeChip(label: "Kitchen", id: "kitchen"),
        TypeChip(label: "Bathroom", id: "bathroom"),
        TypeChip(label: "Bedroom", id: "bedroom"),
        TypeChip(label: "Living room", id: "living_room"),
        TypeChip(label: "Hallway", id: "hallway"),
        TypeChip(label: "Laundry", id: "laundry"),
        TypeChip(label: "Storage", id: "storage"),
        TypeChip(label: "Garage", id: "garage"),
    ]

    private func save() async {
        guard let geometry else { return }
        saving = true
        error = nil

        let outcome = await ScanQueue.shared.save(
            ScanUpload(
                projectId: projectId,
                name: name.trimmed,
                level: level,
                position: existingCount + savedThisVisit,
                geometry: geometry,
                roomType: roomType))

        switch outcome {
        case .sent(let id):
            // The row id is what a position can later be written against.
            // A held scan has no row yet, so it keeps its measurement and
            // loses only its placement — the packed layout catches it.
            if lastWasScan { session.markLastSaved(id) }
            await finishSave(id: id, geometry: geometry, held: false)
        case .held:
            // Kept, not lost. The measurement is safe and the project
            // screen says how many are waiting — and the plan the operator
            // lands on draws it from this copy, so a basement with no signal
            // still ends on a room he can see.
            await finishSave(id: "held-\(UUID().uuidString)", geometry: geometry, held: true)
        case .lost(let reason):
            error = reason
        }
        saving = false
    }

    /// After a room is filed: register the visit's rooms together, then
    /// either offer the next scan or close.
    ///
    /// Placement runs after EVERY save from the second room on, not once at
    /// the end, because the operator can leave this flow any way they like —
    /// Done, Cancel, the home indicator — and positions already written must
    /// stay written. Re-running is harmless: the builder is deterministic
    /// for a fixed set of rooms, and the last write wins.
    private func finishSave(id: String, geometry: ScanGeometry, held: Bool) async {
        savedThisVisit += 1
        lastSavedName = name.trimmed
        filedThisVisit.append(
            FiledRoom(
                id: id,
                name: name.trimmed,
                level: level,
                floorAreaSqm: geometry.floorAreaSquareMeters,
                geometry: geometry,
                held: held))
        onSaved()

        guard lastWasScan else {
            // A drawn room cannot join a merge set, so there is no placement
            // to push — but it still ends on the loop, and Done from there
            // still lands on the plan (ORD-16).
            placementFailed = false
            placementNote = nil
            stage = .saved
            return
        }

        if session.roomCount >= 2 {
            switch await session.pushPlacements() {
            case .placed(let count):
                placementFailed = false
                placementNote = "The plan shows these \(count) rooms as they sit in the building."
            case .skipped:
                placementFailed = false
                placementNote = nil
            case .failed(let reason):
                placementFailed = true
                placementNote = reason
            }
        } else {
            placementFailed = false
            placementNote = nil
        }
        stage = .saved
    }
}

/// The RoomPlan capture screen, wrapped for SwiftUI.
///
/// `arSession` is the visit-wide AR session. Passing the same one into every
/// capture is what keeps consecutive rooms in one world frame — see
/// `ScanSession` for why that is the whole multi-room feature.
struct RoomCaptureScreen: UIViewControllerRepresentable {
    var arSession: ARSession?
    /// Rooms already captured this visit, for the mini-map: sharing the AR
    /// frame means the room being walked draws in true position against
    /// them.
    var previousRooms: [CapturedRoom] = []
    let onFinish: (Result<CapturedRoom, Error>) -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        guard #available(iOS 17.0, *) else { return UIViewController() }
        let controller = RoomScanViewController()
        controller.sharedARSession = arSession
        controller.previousRooms = previousRooms
        controller.onFinish = onFinish
        return controller
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {}
}

/// A room type a chip can select: the label the operator reads, the id the
/// living-area engine understands.
struct TypeChip: Hashable {
    let label: String
    let id: String
}

/// The full 18-type vocabulary behind the More… chip — `RoomTypePicker`
/// reused, fed by the living-area endpoint so the labels, percentages and
/// notes are the engine's own. With an honest failure state: the eight
/// chips keep working in a basement with no signal, so this sheet reports
/// the missing connection rather than spinning forever.
private struct FullRoomTypeSheet: View {
    let projectId: String
    let selected: String?
    /// Held by the flow, not this sheet — loaded once per capture visit.
    @Binding var types: [LivingRoomType]
    let onPick: (_ id: String, _ label: String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var failed = false

    var body: some View {
        if failed && types.isEmpty {
            VStack(spacing: Brand.Space.base) {
                Text("The full list needs a connection")
                    .font(.headline)
                    .foregroundStyle(Brand.ink)
                Text("It could not be fetched just now. The eight common types behind this sheet still work without one.")
                    .font(.callout)
                    .foregroundStyle(Brand.inkSoft)
                    .multilineTextAlignment(.center)
                Button("Try again") {
                    failed = false
                    Task { await load() }
                }
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Brand.blue)
                Button("Close") { dismiss() }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Brand.inkSoft)
            }
            .padding(Brand.Space.large)
        } else {
            SelectRoomTypeView(types: types, selected: selected) { picked in
                onPick(picked, types.first { $0.id == picked }?.label ?? picked)
            }
            .task { await load() }
        }
    }

    private func load() async {
        guard types.isEmpty else { return }
        do {
            types = try await API.shared.livingArea(projectId: projectId).roomTypes
        } catch {
            failed = true
        }
    }
}

/// A wrapping grid of room-type chips with a visible selected state — the
/// selection is a fact the save button depends on, so it has to be
/// legible at arm's length, not just a highlight that flashed once.
private struct TypeChips: View {
    let options: [TypeChip]
    let selected: String?
    var onMore: (() -> Void)?
    let onPick: (TypeChip) -> Void

    private let columns = [GridItem(.adaptive(minimum: 84), spacing: Brand.Space.tight)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: Brand.Space.tight) {
            ForEach(options, id: \.self) { option in
                let isOn = option.id == selected
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    onPick(option)
                } label: {
                    Text(option.label)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(isOn ? Color.white : Brand.inkSoft)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .frame(maxWidth: .infinity)
                        .background(
                            isOn ? Brand.blue : Brand.surfaceRaised,
                            in: .rect(cornerRadius: Brand.Radius.pill))
                }
                .buttonStyle(.plain)
            }

            // The rest of the vocabulary, one tap away (ORD-15) — a chip in
            // the row, not a separate control, because the operator's thumb
            // is already here.
            if let onMore {
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    onMore()
                } label: {
                    HStack(spacing: 3) {
                        Text("More")
                        Image(systemName: "ellipsis")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.blue)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .frame(maxWidth: .infinity)
                    .background(Brand.blue.opacity(0.08), in: .rect(cornerRadius: Brand.Radius.pill))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// The sanity pass a capture goes through before its review sheet shows.
///
/// Three checks, each catching a failure RoomPlan reports as success: an
/// area too small to be a room, a shape too thin to be one, and an outline
/// where too much of the perimeter had to be guessed. None of them blocks
/// saving — a bad capture can still be worth keeping on a job with no time
/// to rescan — but the sheet leads with the problem instead of a stat band.
struct ReviewAnalysis {
    let plan: FloorPlanGeometry.Plan
    /// The chained outline with its guessed closing edge, when the walls
    /// chain at all. Nil means fragments — not one open room but pieces.
    let outline: FloorPlanGeometry.InferredOutline?
    /// Worst first; the review leads with these when any exist.
    let problems: [String]
    /// The INT-S09-style sentence under the preview when an edge was
    /// guessed but the guess is small enough to stand.
    let inferredNote: String?

    init(geometry: ScanGeometry) {
        let plan = FloorPlanGeometry.plan(from: geometry)
        self.plan = plan
        let outline = FloorPlanGeometry.outlineWithClosure(plan.segments)
        self.outline = outline

        var problems: [String] = []

        // The same floor as `looksComplete`: three walls and half a square
        // metre. Below that, RoomPlan produced fragments, not a room.
        if geometry.walls.count < 3 {
            problems.append(
                "Only \(geometry.walls.count) wall\(geometry.walls.count == 1 ? "" : "s") came back. A room needs at least three."
            )
        }
        if geometry.floorAreaSquareMeters < 0.5 {
            problems.append(
                "Almost no floor was captured — \(Int(Measure.squareFeet(geometry.floorAreaSquareMeters).rounded())) sq ft."
            )
        }

        // A guessed edge that is a large share of the outline means the
        // figure below is not a measurement any more. 30% is a convention:
        // one missed wall of a rectangular room sits near 25%, so anything
        // beyond it means more than a wall went unwalked.
        var inferredNote: String?
        if geometry.walls.count >= 3 {
            if let outline {
                if let edge = outline.inferredEdge {
                    var perimeter = edge.length
                    for i in 0..<(outline.points.count - 1) {
                        perimeter += hypot(
                            outline.points[i + 1].x - outline.points[i].x,
                            outline.points[i + 1].y - outline.points[i].y)
                    }
                    let fraction = perimeter > 0 ? edge.length / perimeter : 1
                    if fraction > 0.3 {
                        problems.append(
                            "\(Int((fraction * 100).rounded()))% of this outline is guessed, not walked — the dashed edge below. The area is not a measurement at that point."
                        )
                    } else {
                        inferredNote =
                            "One edge was never walked. The dashed line closes the shape so the room is not lost — it is a guess, not a measurement."
                    }
                }
            } else {
                problems.append(
                    "The walls do not join up into one room — the shape below is pieces, and the floor figure is a sum of what was caught, not a closed room."
                )
            }
        }

        // No habitable room is a 12:1 sliver. A long corridor can be —
        // which is why this warns instead of blocking — but far more often
        // a reading like this is one wall and a strip of floor.
        if plan.width > 0.1, plan.height > 0.1 {
            let aspect = max(plan.width, plan.height) / min(plan.width, plan.height)
            if aspect > 12 {
                problems.append(
                    "This shape is unusually long and thin (\(Int(aspect.rounded())):1). If the room is not, the scan caught a wall rather than the room."
                )
            }
        }

        self.problems = problems
        self.inferredNote = inferredNote
    }
}

/// The review's plan preview: the walked walls solid, the guessed closing
/// edge dashed, the enclosed floor filled. Deliberately plainer than the
/// drafted plan — this is a moment-of-truth check, not a drawing.
private struct ReviewPlanPreview: View {
    let plan: FloorPlanGeometry.Plan
    let outline: FloorPlanGeometry.InferredOutline?

    var body: some View {
        Canvas { context, size in
            guard plan.width > 0.05, plan.height > 0.05 else { return }
            let pad: CGFloat = 14
            let scale = min(
                (size.width - pad * 2) / plan.width,
                (size.height - pad * 2) / plan.height)
            guard scale > 0 else { return }
            let ox = (size.width - plan.width * scale) / 2
            let oy = (size.height - plan.height * scale) / 2

            func pt(_ x: Double, _ y: Double) -> CGPoint {
                CGPoint(x: x * scale + ox, y: y * scale + oy)
            }

            // Fill whatever loop exists — including one closed by the
            // guess, because the dashed edge right on top of it says
            // exactly which part is guesswork.
            if let outline, outline.points.count >= 3 {
                var floor = Path()
                floor.move(to: pt(outline.points[0].x, outline.points[0].y))
                for p in outline.points.dropFirst() { floor.addLine(to: pt(p.x, p.y)) }
                floor.closeSubpath()
                context.fill(floor, with: .color(Color(hex: 0xEFEEF4)))
            }

            var walls = Path()
            for s in plan.segments {
                walls.move(to: pt(s.x1, s.y1))
                walls.addLine(to: pt(s.x2, s.y2))
            }
            context.stroke(
                walls, with: .color(Color(hex: 0x111111)),
                style: StrokeStyle(lineWidth: 3, lineCap: .round))

            if let edge = outline?.inferredEdge {
                var guess = Path()
                guess.move(to: pt(edge.x1, edge.y1))
                guess.addLine(to: pt(edge.x2, edge.y2))
                context.stroke(
                    guess, with: .color(.orange),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [6, 5]))
            }
        }
        .aspectRatio(
            CGFloat(max(plan.width, 0.1) / max(plan.height, 0.1)), contentMode: .fit)
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

/// The reference's `Select Room Type`: a Residential / Commercial segmented
/// control over a grouped list.
///
/// **The split is the reference's and is worth having. The commercial LIST
/// is half ours.** Theirs is an office fit-out vocabulary — Private Office,
/// Shared Office, Cafeteria — and a water-damage call in a commercial
/// building is in a mechanical room, an electrical room, a warehouse bay.
/// Both are offered: theirs first so a hand that knows magicplan finds what
/// it expects, ours after so the job has somewhere to file. See
/// `COMMERCIAL_ROOM_TYPES` for why every commercial type excludes living
/// area — ANSI Z765 measures a dwelling and means nothing in a warehouse.
struct SelectRoomTypeView: View {
    let types: [LivingRoomType]
    let selected: String?
    let onPick: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var commercial = false
    @State private var expanded = false

    /// The six the reference leads with, in its order. Everything else is
    /// one tap behind `See more` — a list of twenty on the screen you reach
    /// most often is a list nobody reads.
    private static let common = [
        "kitchen", "dining_room", "living_room", "bedroom", "bathroom", "balcony",
    ]

    private var shown: [LivingRoomType] {
        let pool = types.filter { $0.isCommercial == commercial }
        // Commercial has no "common six" to lead with — the reference shows
        // its whole list, and so does this.
        guard !commercial, !expanded else { return pool }
        let lead = Self.common.compactMap { id in pool.first { $0.id == id } }
        // A type chosen from behind See more stays visible rather than
        // silently vanishing from the short list that is on screen.
        if let selected, !lead.contains(where: { $0.id == selected }),
            let picked = pool.first(where: { $0.id == selected }) {
            return lead + [picked]
        }
        return lead
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(shown) { type in
                        Button {
                            onPick(type.id)
                            dismiss()
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(type.label)
                                        .font(.system(size: 17))
                                        .foregroundStyle(Brand.ink)
                                    if let note = type.note, !note.isEmpty {
                                        Text(note)
                                            .font(.system(size: 11))
                                            .foregroundStyle(Brand.inkFaint)
                                    }
                                }
                                Spacer()
                                if type.id == selected {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(Brand.blue)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }

                    if !commercial && !expanded {
                        Button("See more") { expanded = true }
                            .font(.system(size: 17))
                            .foregroundStyle(Brand.blue)
                    }
                } header: {
                    Text("Room Type")
                } footer: {
                    if commercial {
                        Text("Living area is not reported for commercial space: ANSI Z765 measures a dwelling. Floor area is still measured and still totalled.")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .safeAreaInset(edge: .top) {
                Picker("", selection: $commercial) {
                    Text("Residential").tag(false)
                    Text("Commercial").tag(true)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Brand.Space.base)
                .padding(.bottom, Brand.Space.small)
                .background(Brand.canvas)
            }
            .navigationTitle("Select Room Type")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "chevron.left") }
                }
            }
        }
    }
}
