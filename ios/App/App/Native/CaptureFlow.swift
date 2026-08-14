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

                    if !geometry.looksComplete {
                        Card {
                            Text(
                                "This capture looks incomplete — \(geometry.walls.count) wall\(geometry.walls.count == 1 ? "" : "s") and \(Int(Measure.squareFeet(geometry.floorAreaSquareMeters).rounded())) sq ft of floor. Walk it again with the phone up, pointing at every wall in turn."
                            )
                            .font(.callout)
                            .foregroundStyle(.orange)
                        }
                    }

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

                // Typing on a phone with wet gloves on is the actual
                // situation this is used in.
                FlowChips(options: Self.quickNames) { name = $0 }

                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }

                Button(saving ? "Saving…" : "Save room") {
                    Task { await save() }
                }
                .buttonStyle(PrimaryButtonStyle(enabled: !saving && !name.trimmed.isEmpty))
                .disabled(saving || name.trimmed.isEmpty)

                Button("Scan again") {
                    // A retake, not another room: the rejected capture must
                    // leave the merge set, or the builder would register a
                    // room the operator threw away.
                    if lastWasScan { session.discardLastUnsaved() }
                    stage = .capturing
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Brand.inkSoft)
                .frame(maxWidth: .infinity)
                .padding(.top, Brand.Space.hair)
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
                        Text("\(name.trimmed.isEmpty ? "The room" : name.trimmed) is filed under \(level).")
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

    private static let quickNames = [
        "Kitchen", "Bathroom", "Bedroom", "Living room", "Hallway", "Laundry", "Storage", "Garage",
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
                geometry: geometry))

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

/// A wrapping row of tappable suggestions.
private struct FlowChips: View {
    let options: [String]
    let onPick: (String) -> Void

    private let columns = [GridItem(.adaptive(minimum: 84), spacing: Brand.Space.tight)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: Brand.Space.tight) {
            ForEach(options, id: \.self) { option in
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    onPick(option)
                } label: {
                    Text(option)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Brand.inkSoft)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .frame(maxWidth: .infinity)
                        .background(Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.pill))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
