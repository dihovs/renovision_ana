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
struct CaptureFlow: View {
    let projectId: String
    let projectName: String
    /// Rooms already on this project, so a new one is numbered and positioned
    /// after them rather than colliding.
    let existingCount: Int
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var level = "Ground"
    @State private var stage: Stage = .chooseFloor
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

    private enum Stage {
        case chooseFloor
        case capturing
        /// Drawing a room by hand, on the plan editor's canvas.
        case drawing
        case review
        /// Filed. Offer the next room while the AR session still tracks.
        case saved
    }

    private static let levels = ["Basement", "Ground", "2nd", "3rd", "Attic"]

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                switch stage {
                case .chooseFloor: floorChooser
                case .capturing, .drawing: Color.clear
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
                            session.end()
                            dismiss()
                        }
                    }
                }
            }
        }
        .fullScreenCover(isPresented: .init(get: { stage == .drawing }, set: { _ in })) {
            RoomSketchView(
                onCancel: { stage = .chooseFloor },
                onDone: { polygon, ceiling in
                    geometry = ScanGeometry(polygon: polygon, ceilingHeight: ceiling)
                    name = "Room \(existingCount + savedThisVisit + 1)"
                    roomType = nil
                    analysis = nil
                    lastWasScan = false
                    stage = .review
                })
        }
        .fullScreenCover(isPresented: .init(get: { stage == .capturing }, set: { _ in })) {
            RoomCaptureScreen(arSession: session.arSession) { outcome in
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
                        name = "Room \(existingCount + savedThisVisit + 1)"
                        // Each room is typed on its own: carrying the last
                        // room's type forward would file a bathroom as a
                        // second kitchen the moment somebody saves fast.
                        roomType = nil
                        // Judged BEFORE the sheet appears, so a bad capture
                        // opens on its problem, not on a success state.
                        analysis = ReviewAnalysis(geometry: captured)
                        lastWasScan = true
                        stage = .review
                    }
                case .failure(let failure):
                    let text = failure.localizedDescription
                    // Backing out is the ordinary way to abandon a scan and
                    // must not be dressed up as a fault.
                    error = text.localizedCaseInsensitiveContains("cancel") ? nil : text
                    stage = .chooseFloor
                }
            }
            .ignoresSafeArea()
        }
    }

    private var title: String {
        switch stage {
        case .review: return "Room measured"
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

                SectionHeading(title: "WHICH FLOOR?")

                VStack(spacing: Brand.Space.tight) {
                    ForEach(Self.levels, id: \.self) { option in
                        Button {
                            // A merge set is one storey. Rooms on different
                            // floors still share the AR frame, but placing a
                            // basement against a kitchen would write plan
                            // positions that mean nothing on either sheet.
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

                Button("Scan the room") { stage = .capturing }
                    .buttonStyle(PrimaryButtonStyle(enabled: RoomCaptureSession.isSupported))
                    .disabled(!RoomCaptureSession.isSupported)

                // Drawing works on any phone, in any light, in a gutted
                // basement with the power off — which is a normal Tuesday on
                // a water-damage job, and exactly when the camera cannot
                // track anything.
                Button {
                    stage = .drawing
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

    // MARK: - Review

    private var review: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Brand.Space.base) {
                if let geometry {
                    // A capture that failed the sanity pass opens on the
                    // problem. The numbers still follow — they are real
                    // sums of what was caught — but they do not get to
                    // stand first pretending the capture went well.
                    // magicplan leads with a green tick it cannot justify
                    // (INT-S09); that is the one part not worth copying.
                    if let analysis, !analysis.problems.isEmpty {
                        Card {
                            VStack(alignment: .leading, spacing: Brand.Space.tight) {
                                ForEach(analysis.problems, id: \.self) { problem in
                                    Text(problem)
                                        .font(.callout)
                                        .foregroundStyle(.orange)
                                }
                                Text(
                                    "Walk it again with the phone up, pointing at every wall in turn — or save it and correct the plan by hand later."
                                )
                                .font(.system(size: 12))
                                .foregroundStyle(Brand.inkSoft)
                            }
                        }
                    }

                    // The shape that was caught, with the guessed closing
                    // edge dashed — showing WHICH edge is a guess tells the
                    // operator exactly what to distrust.
                    if let analysis, !analysis.plan.isEmpty {
                        Card(padding: Brand.Space.small) {
                            VStack(alignment: .leading, spacing: Brand.Space.tight) {
                                ReviewPlanPreview(
                                    plan: analysis.plan, outline: analysis.outline)
                                    .frame(maxHeight: 220)
                                if let note = analysis.inferredNote {
                                    Text(note)
                                        .font(.system(size: 12))
                                        .foregroundStyle(Brand.inkSoft)
                                }
                            }
                        }
                    }

                    StatBand(items: [
                        .init(
                            label: "Floor",
                            value: "\(Int(Measure.squareFeet(geometry.floorAreaSquareMeters).rounded()))",
                            unit: "sq ft"),
                        .init(
                            label: "Perimeter",
                            value: "\(Int(Measure.feet(geometry.wallLengthMeters).rounded()))",
                            unit: "ft"),
                        .init(
                            label: "Ceiling",
                            value: String(format: "%.1f", Measure.feet(geometry.ceilingHeightMeters)),
                            unit: "ft"),
                    ])

                    Card {
                        VStack(alignment: .leading, spacing: Brand.Space.tight) {
                            Text("\(geometry.walls.count) walls · \(geometry.doorCount) doors · \(geometry.windowCount) windows")
                                .font(.system(size: 14))
                                .foregroundStyle(Brand.inkSoft)
                            if geometry.stairCount > 0 {
                                Text("\(geometry.stairCount) staircase — priced separately, not in the floor area")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Brand.blue)
                            }
                        }
                    }
                }

                SectionHeading(title: "NAME THIS ROOM", trailing: level)

                TextField("Kitchen, Basement bathroom…", text: $name)
                    .font(.system(size: 16))
                    .padding(Brand.Space.base)
                    .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
                    .overlay(
                        RoundedRectangle(cornerRadius: Brand.Radius.card)
                            .strokeBorder(Brand.hairline, lineWidth: 0.5))

                SectionHeading(title: "WHAT KIND OF ROOM?")
                    .padding(.top, Brand.Space.small)

                // Chips, not a picker — tapping with wet gloves on is the
                // actual situation this is used in. The type feeds the
                // living-area engine, which is why a room cannot be saved
                // without one: an untyped room falls through to `other` at
                // 100% and a basement quietly becomes living area. Picking
                // a type also names a room still wearing its auto number,
                // which is what the old quick-name chips existed for.
                TypeChips(options: Self.typeChips, selected: roomType) { chip in
                    roomType = chip.id
                    if name.trimmed.isEmpty || name == autoName { name = chip.label }
                }

                if roomType == nil {
                    Text("Pick what kind of room this is — living area is counted from it.")
                        .font(.footnote)
                        .foregroundStyle(Brand.inkSoft)
                }

                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }

                Button(saving ? "Saving…" : "Save room") {
                    Task { await save() }
                }
                .buttonStyle(
                    PrimaryButtonStyle(enabled: !saving && !name.trimmed.isEmpty && roomType != nil)
                )
                .disabled(saving || name.trimmed.isEmpty || roomType == nil)

                Button(lastWasScan ? "Scan again" : "Draw it again") {
                    // A retake, not another room: the rejected capture must
                    // leave the merge set, or the builder would register a
                    // room the operator threw away.
                    if lastWasScan { session.discardLastUnsaved() }
                    stage = lastWasScan ? .capturing : .drawing
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Brand.inkSoft)
                .frame(maxWidth: .infinity)
                .padding(.top, Brand.Space.hair)

                // The reject path (INT-S11): destructive, present, and
                // visually subordinate to the primary — a bad capture must
                // be as easy to throw away as a good one is to keep.
                Button("Discard this capture") {
                    if lastWasScan { session.discardLastUnsaved() }
                    geometry = nil
                    analysis = nil
                    // Back into the visit if one is running, otherwise to
                    // the start — never out of the flow entirely, because
                    // discarding one room says nothing about being done.
                    stage = savedThisVisit > 0 && lastWasScan ? .saved : .chooseFloor
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.red.opacity(0.75))
                .frame(maxWidth: .infinity)
            }
            .padding(Brand.Space.base)
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

                Button("Scan another room") { stage = .capturing }
                    .buttonStyle(PrimaryButtonStyle(enabled: true))

                Button("Done") {
                    session.end()
                    dismiss()
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Brand.inkSoft)
                .frame(maxWidth: .infinity)
                .padding(.top, Brand.Space.hair)
            }
            .padding(Brand.Space.base)
        }
    }

    /// The room's auto-numbered placeholder name. Kept as a computed value
    /// so "has the operator actually named this?" stays answerable — a type
    /// chip only overwrites a name nobody chose.
    private var autoName: String {
        "Room \(existingCount + savedThisVisit + 1)"
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
            await finishSave()
        case .held:
            // Kept, not lost. The measurement is safe and the project
            // screen says how many are waiting.
            await finishSave()
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
    private func finishSave() async {
        savedThisVisit += 1
        lastSavedName = name.trimmed
        onSaved()

        guard lastWasScan else {
            // A drawn room cannot join a merge set or continue an AR
            // session; the one-room-and-out flow is still the right shape.
            session.end()
            dismiss()
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
    let onFinish: (Result<CapturedRoom, Error>) -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        guard #available(iOS 17.0, *) else { return UIViewController() }
        let controller = RoomScanViewController()
        controller.sharedARSession = arSession
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

/// A wrapping grid of room-type chips with a visible selected state — the
/// selection is a fact the save button depends on, so it has to be
/// legible at arm's length, not just a highlight that flashed once.
private struct TypeChips: View {
    let options: [TypeChip]
    let selected: String?
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
