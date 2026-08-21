import ARKit
import RoomPlan
import SwiftUI
import UIKit

/**
 * The actual scanning screen. RoomPlan supplies the AR visualization and the
 * live wall-detection guidance itself — this class owns the session
 * lifecycle, the Done/Cancel chrome, and the two pieces RoomPlan does not
 * give you: a live 2D mini-map with a pose cursor, and an open-outline
 * warning while the operator is still standing in the room.
 *
 * Both hang off `captureSession(_:didUpdate:)`. Apple's in-world massing
 * shows what was CAUGHT; only a plan view shows what is MISSING — the
 * operator can watch the polygon fail to close while walking back to fix it
 * is still an option, which is worth more than any after-the-fact warning.
 */
@available(iOS 17.0, *)
final class RoomScanViewController: UIViewController, RoomCaptureSessionDelegate, RoomCaptureViewDelegate {
    var onFinish: ((Result<CapturedRoom, Error>) -> Void)?

    /// Rooms already captured this visit, drawn dim on the mini-map. They
    /// share the visit's AR world frame (see `sharedARSession`), so the
    /// in-progress room draws in true position against them and the map
    /// reads as a floor filling in, not a lone shape.
    var previousRooms: [CapturedRoom] = []

    /**
     * The AR session shared across every room of one capture visit, when
     * there is one. Set before the view loads (the SwiftUI wrapper assigns
     * it at construction).
     *
     * This is what multi-room placement hangs on: rooms captured in one
     * continuous AR session share a world frame, so `StructureBuilder` can
     * register them against each other. Rooms captured in separate sessions
     * are each measured from wherever the operator happened to be standing,
     * and the builder refuses the set (`.invalidRoomLocation`). When this is
     * set, stopping uses `pauseARSession: false` so tracking survives the
     * walk to the next room — pausing between rooms would sever exactly the
     * continuity the shared session exists to provide.
     */
    var sharedARSession: ARSession?

    private lazy var captureView: RoomCaptureView = {
        if let shared = sharedARSession {
            return RoomCaptureView(frame: .zero, arSession: shared)
        }
        return RoomCaptureView(frame: .zero)
    }()
    private var isScanning = false

    /// Answers given during this capture — see `ScanChoices`. Handed in by
    /// the flow, so what the operator settles here survives the walk to the
    /// review sheet that files it.
    var choices: ScanChoices?

    private let miniMap = ScanMiniMapView()
    /// Names what the camera is pointed at, and opens to change it. The
    /// SILHOUETTES are `RoomCaptureView`'s own — see `ScanTypeCard` for why
    /// ours were deleted rather than improved.
    private let typeCard = ScanTypeCard()
    /// The last room streamed, kept so a tap can look up what it hit — the
    /// overlay carries only identifiers and screen geometry, deliberately,
    /// so it stays a drawing layer with no opinion about RoomPlan.
    private var liveRoom: CapturedRoom?
    private weak var shutter: UIButton?
    private let openWarning = PillLabel()
    /// When this capture started walking — the open-outline warning holds
    /// off this long, because every scan is "open" for its first minute and
    /// nagging from wall three onward teaches the operator to ignore it.
    private var scanStart = Date()
    /// Throttle for map redraws: `didUpdate` can fire many times a second
    /// and redrawing a Canvas that fast burns battery for no visible gain.
    private var lastMapUpdate = Date.distantPast
    private var poseTimer: Timer?

    override func viewDidLoad() {
        super.viewDidLoad()
        captureView.captureSession.delegate = self
        captureView.delegate = self

        captureView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(captureView)
        NSLayoutConstraint.activate([
            captureView.topAnchor.constraint(equalTo: view.topAnchor),
            captureView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            captureView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            captureView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        let cancelButton = chromeButton(title: "Cancel", action: #selector(cancelTapped))
        let doneButton = chromeButton(title: "Done", action: #selector(doneTapped))
        doneButton.backgroundColor = UIColor.systemGreen.withAlphaComponent(0.9)

        // THE SHUTTER. A white disc inside a white ring, which is what a
        // camera button looks like on this platform and what the reference
        // puts beside its own stop button.
        //
        // The briefing screen has promised this for longer than it has
        // existed — "the white circle takes a photo mid-scan" — which is the
        // worse half of it being missing: the app was describing a button
        // nobody could find.
        //
        // Why it earns the space: the operator is already standing in front
        // of the damage with the phone up. Making them finish the walk, find
        // the room, and photograph it again is asking for the same trip
        // twice, and the second trip is the one that gets skipped.
        let shutter = UIButton(type: .custom)
        shutter.translatesAutoresizingMaskIntoConstraints = false
        shutter.backgroundColor = .white
        shutter.layer.cornerRadius = 27
        shutter.layer.borderColor = UIColor.white.cgColor
        shutter.layer.borderWidth = 3
        shutter.accessibilityLabel = "Take a photo"
        shutter.addTarget(self, action: #selector(shutterTapped), for: .touchUpInside)

        let shutterRing = UIView()
        shutterRing.translatesAutoresizingMaskIntoConstraints = false
        shutterRing.backgroundColor = .clear
        shutterRing.layer.cornerRadius = 34
        shutterRing.layer.borderColor = UIColor.white.cgColor
        shutterRing.layer.borderWidth = 3
        shutterRing.isUserInteractionEnabled = false

        // Top-leading, small: Apple's coaching text owns the top centre and
        // its live model preview owns the bottom, so this corner is the one
        // place a card can live without covering guidance.
        miniMap.translatesAutoresizingMaskIntoConstraints = false
        miniMap.previousRooms = previousRooms.map { ScanSession.wallSegments(of: $0) }

        // The pre-emptive warning (the reference's "might be incomplete"
        // popover, our copy): told while still in the room, above the
        // buttons, not after the walk. Done stays live — finishing an open
        // room is allowed, it just must not be a surprise.
        openWarning.text = "The outline hasn't closed — the gap shows on the map."
        openWarning.font = .systemFont(ofSize: 13, weight: .semibold)
        openWarning.textColor = UIColor.systemOrange
        openWarning.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        openWarning.textAlignment = .center
        openWarning.numberOfLines = 0
        openWarning.layer.cornerRadius = 10
        openWarning.layer.masksToBounds = true
        openWarning.isHidden = true
        openWarning.translatesAutoresizingMaskIntoConstraints = false

        // Right edge, vertically centred — where the reference puts it, and
        // the one part of the screen Apple's own guidance does not use.
        typeCard.translatesAutoresizingMaskIntoConstraints = false
        typeCard.onTap = { [weak self] id in self?.askAbout(id) }
        view.addSubview(typeCard)
        NSLayoutConstraint.activate([
            typeCard.trailingAnchor.constraint(
                equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: 12),
            typeCard.topAnchor.constraint(equalTo: view.topAnchor),
            typeCard.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            typeCard.widthAnchor.constraint(equalToConstant: 96),
        ])

        view.addSubview(shutterRing)
        view.addSubview(shutter)
        view.addSubview(cancelButton)
        view.addSubview(doneButton)
        view.addSubview(miniMap)
        view.addSubview(openWarning)
        NSLayoutConstraint.activate([
            cancelButton.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            cancelButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            doneButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            doneButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            miniMap.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 12),
            miniMap.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            miniMap.widthAnchor.constraint(equalToConstant: 150),
            miniMap.heightAnchor.constraint(equalToConstant: 150),
            openWarning.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            openWarning.bottomAnchor.constraint(equalTo: doneButton.topAnchor, constant: -14),
            openWarning.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, constant: -48),

            // Centred between Cancel and Done, which is the one piece of the
            // bottom bar nothing else claims.
            shutterRing.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            shutterRing.centerYAnchor.constraint(equalTo: doneButton.centerYAnchor),
            shutterRing.widthAnchor.constraint(equalToConstant: 68),
            shutterRing.heightAnchor.constraint(equalToConstant: 68),
            shutter.centerXAnchor.constraint(equalTo: shutterRing.centerXAnchor),
            shutter.centerYAnchor.constraint(equalTo: shutterRing.centerYAnchor),
            shutter.widthAnchor.constraint(equalToConstant: 54),
            shutter.heightAnchor.constraint(equalToConstant: 54),
        ])
        self.shutter = shutter
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !isScanning else { return }
        isScanning = true
        scanStart = Date()
        // Walking a room is minutes of holding the phone up without touching
        // the screen, which is exactly what the idle timer counts as idle —
        // and a scan that sleeps halfway through is a scan started again.
        UIApplication.shared.isIdleTimerDisabled = true
        captureView.captureSession.run(configuration: RoomCaptureSession.Configuration())

        // The pose cursor runs on its own clock, not on `didUpdate`: the
        // geometry stream goes quiet when nothing new is detected, and a
        // cursor that freezes mid-walk reads as a crash.
        poseTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.updatePose()
        }
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        poseTimer?.invalidate()
        poseTimer = nil
        // Never leave it off: the whole phone stops sleeping otherwise.
        UIApplication.shared.isIdleTimerDisabled = false
    }

    // MARK: - Live geometry

    /// The in-progress room, streamed while the operator walks. This is the
    /// data source Apple's UI never surfaces flat: from it the map draws
    /// what has been caught, and the closure test says whether the walls
    /// join up yet.
    func captureSession(_ session: RoomCaptureSession, didUpdate room: CapturedRoom) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let now = Date()
            guard now.timeIntervalSince(self.lastMapUpdate) > 0.15 else { return }
            self.lastMapUpdate = now

            let segments = ScanSession.wallSegments(of: room)
            self.miniMap.walls = zip(segments, room.walls).map {
                (segment: $0, solid: $1.confidence != .low)
            }

            // Open means: the walls chain into one run that has not come
            // home yet, or do not even chain. The trigger threshold is OUR
            // convention — the reference never showed what fires theirs
            // (its open question #2) — chosen so the warning appears only
            // once a real attempt at a room exists and stays quiet for the
            // first stretch of every scan, which is always open.
            self.liveRoom = room
            self.refreshDetections(room)

            let outline = FloorPlanGeometry.outlineWithClosure(segments)
            let isOpen = outline?.inferredEdge != nil || outline == nil
            let attempted = room.walls.count >= 3
            let pastGrace = now.timeIntervalSince(self.scanStart) > 15
            self.setWarningVisible(attempted && pastGrace && isOpen)
        }
    }

    // MARK: - Answering a detection

    /// The operator disagrees, or the badge is a question mark. Either way
    /// the answer is given HERE, mid-scan, with the thing still in front of
    /// them — which is the entire reason this is not a list afterwards.
    private func askAbout(_ id: UUID) {
        guard let room = liveRoom, let choices else { return }

        let isOpening =
            room.doors.contains { $0.identifier == id }
            || room.windows.contains { $0.identifier == id }
            || room.openings.contains { $0.identifier == id }

        let picker = ObjectLibraryPicker(context: isOpening ? .wall : .room) { [weak self] item in
            guard let self else { return }
            switch item {
            case .opening(let kind):
                choices.set(.opening(kind), for: id)
            case .object(let entry):
                choices.set(.object(entry.slug), for: id)
            }
            self.dismiss(animated: true) {
                // A door earns the second question straight away, while the
                // operator is still looking at it and knows which way it
                // swings. Asking later, off a plan, is asking them to
                // remember a room.
                if case .opening(let kind) = item, kind.swings {
                    self.askSwing(for: id)
                }
                if let room = self.liveRoom { self.refreshDetections(room) }
            }
        }

        let host = UIHostingController(rootView: picker)
        host.modalPresentationStyle = .pageSheet
        if let sheet = host.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
        }
        present(host, animated: true)
    }

    /// Which way it opens, in the only words that mean anything while you
    /// are standing in the room. His own: *"it can make an arrow. So going
    /// from you or coming to you."*
    private func askSwing(for id: UUID) {
        let sheet = UIAlertController(
            title: "Which way does it open?",
            message: "You are standing in the room. Nothing in a scan records this — it is worth two seconds now.",
            preferredStyle: .actionSheet)
        sheet.addAction(
            UIAlertAction(title: "Toward me — into this room", style: .default) { [weak self] _ in
                self?.choices?.setSwing(inward: true, for: id)
            })
        sheet.addAction(
            UIAlertAction(title: "Away from me — out of this room", style: .default) {
                [weak self] _ in
                self?.choices?.setSwing(inward: false, for: id)
            })
        sheet.addAction(UIAlertAction(title: "Skip", style: .cancel))
        // iPad wants an anchor or it refuses to present at all.
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(
            x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        present(sheet, animated: true)
    }

    // MARK: - What you are pointing at

    /// Choose the one detection the card should name.
    ///
    /// **No projection, and that is the point.** The old overlay projected
    /// every detection's corners onto the glass and redrew them, which is
    /// what made them lag: a screen-space drawing has to be recomputed every
    /// frame or it is wrong, and it was being recomputed on RoomPlan's
    /// geometry clock. Nothing here is anchored to the world — the card sits
    /// at the edge of the screen — so this only has to answer "which one",
    /// and "which one" changes slowly enough that the geometry clock is
    /// exactly right for it.
    ///
    /// The test is the camera's own forward axis: a detection counts if it
    /// is in FRONT and within a cone about where the phone is aimed, and the
    /// most centred one wins. That is what "pointing at it" means, and it
    /// costs one matrix multiply each.
    private func refreshDetections(_ room: CapturedRoom) {
        guard let frame = captureView.captureSession.arSession.currentFrame else {
            typeCard.subject = nil
            return
        }
        let toCamera = frame.camera.transform.inverse

        var best: (subject: ScanTypeCard.Subject, score: Float)?

        /// Smaller is better: the angle off the camera's axis, in radians.
        func aim(_ transform: simd_float4x4) -> Float? {
            let local = toCamera * transform.columns.3
            // The camera looks along its own -z. Behind it is not "pointing
            // at", however close.
            guard local.z < -0.2 else { return nil }
            let distance = simd_length(simd_float3(local.x, local.y, local.z))
            guard distance < 6 else { return nil }
            let offAxis = atan2(hypot(local.x, local.y), -local.z)
            // About 35°, which is roughly what fills the middle of the
            // screen — wide enough to catch a door you are walking through,
            // narrow enough that it names ONE thing.
            guard offAxis < 0.61 else { return nil }
            return offAxis
        }

        func consider(_ subject: ScanTypeCard.Subject, _ transform: simd_float4x4) {
            guard let score = aim(transform) else { return }
            if best == nil || score < best!.score { best = (subject, score) }
        }

        func openings(_ list: [CapturedRoom.Surface], isWindow: Bool, isPassage: Bool) {
            for surface in list {
                let answered = choices?.answer(for: surface.identifier)
                if case .ignored = answered { continue }
                let kind: PlanEditing.OpeningKind
                if case .opening(let chosen) = answered {
                    kind = chosen
                } else {
                    kind = ScanCatalogue.openingKind(
                        width: Double(surface.dimensions.x), isWindow: isWindow,
                        isPassage: isPassage)
                }
                consider(
                    ScanTypeCard.Subject(
                        id: surface.identifier,
                        glyph: isWindow ? "windshield.front.and.wiper" : "door.left.hand.closed",
                        label: kind.label, answered: answered != nil),
                    surface.transform)
            }
        }

        openings(room.doors, isWindow: false, isPassage: false)
        openings(room.windows, isWindow: true, isPassage: false)
        openings(room.openings, isWindow: false, isPassage: true)

        for object in room.objects {
            let answered = choices?.answer(for: object.identifier)
            if case .ignored = answered { continue }
            let glyph: String
            let label: String
            if case .object(let slug) = answered, let entry = ObjectCatalog.entry(slug: slug) {
                glyph = entry.glyph
                label = entry.name
            } else {
                let suggestion = ScanCatalogue.suggestion(
                    for: object.category, confidence: object.confidence)
                glyph = ScanCatalogue.glyph(for: suggestion)
                label = suggestion.label
            }
            consider(
                ScanTypeCard.Subject(
                    id: object.identifier, glyph: glyph, label: label,
                    answered: answered != nil),
                object.transform)
        }

        typeCard.subject = best?.subject
    }

    private func setWarningVisible(_ visible: Bool) {
        guard openWarning.isHidden != !visible else { return }
        UIView.transition(with: openWarning, duration: 0.25, options: .transitionCrossDissolve) {
            self.openWarning.isHidden = !visible
        }
    }

    private func updatePose() {
        guard let frame = captureView.captureSession.arSession.currentFrame else { return }
        let camera = frame.camera.transform
        // The camera looks along its own -z; projected onto the world's
        // floor plane (x/z, since y is up) that is the heading the cursor's
        // wedge points. The position column is where the operator stands.
        let forward = camera.columns.2
        miniMap.pose = ScanMiniMapView.Pose(
            x: Double(camera.columns.3.x),
            y: Double(camera.columns.3.z),
            heading: atan2(Double(-forward.z), Double(-forward.x)))
    }

    /// Stop this room's capture. With a shared AR session the underlying
    /// tracking is deliberately left running — see `sharedARSession` — and
    /// the owner of that session is responsible for pausing it when the
    /// whole visit ends.
    private func stopCapture() {
        if sharedARSession != nil {
            captureView.captureSession.stop(pauseARSession: false)
        } else {
            captureView.captureSession.stop()
        }
    }

    /// Take the frame that is on screen right now.
    ///
    /// Straight off the AR session rather than through `AVCapturePhotoOutput`:
    /// a second capture pipeline cannot have the camera while RoomPlan is
    /// using it, and the frame the operator is looking at IS the photograph
    /// they mean to take.
    ///
    /// Held by `ScanChoices` until the room is filed, because a photograph is
    /// a row against a ROOM and the room has no id yet.
    @objc private func shutterTapped() {
        guard let frame = captureView.captureSession.arSession.currentFrame else { return }

        // ARKit hands the buffer in the sensor's own landscape orientation.
        // `.right` is what turns that into the portrait the operator is
        // holding — without it every scan photo arrives on its side.
        let image = CIImage(cvPixelBuffer: frame.capturedImage).oriented(.right)
        let context = CIContext()
        guard let cgImage = context.createCGImage(image, from: image.extent) else { return }

        Task { @MainActor in
            choices?.addPhoto(UIImage(cgImage: cgImage))
        }

        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        // The shutter blink every camera does — the only confirmation there
        // is room for, and the operator is looking at the wall rather than
        // at the button.
        let flash = UIView(frame: view.bounds)
        flash.backgroundColor = .white
        flash.isUserInteractionEnabled = false
        view.addSubview(flash)
        UIView.animate(withDuration: 0.28, animations: { flash.alpha = 0 }) { _ in
            flash.removeFromSuperview()
        }
    }

    @objc private func doneTapped() {
        // Stopping hands the final, processed CapturedRoom to
        // captureView(didPresent:error:) below — not to a completion here.
        stopCapture()
    }

    @objc private func cancelTapped() {
        // Consume the callback NOW. stop() still drives the normal
        // completion path, so without this the cancelled room arrives
        // seconds later as a success — and a half-walked scan the operator
        // deliberately discarded would enter the merge set anyway.
        let finish = onFinish
        onFinish = nil
        stopCapture()
        dismiss(animated: true) {
            finish?(.failure(RoomScanError.cancelled))
        }
    }

    func captureView(didPresent processedResult: CapturedRoom, error: (any Error)?) {
        // One delivery only — nil after a cancel, and nil-ed here so a
        // double-fire cannot resolve the same plugin call twice.
        guard let finish = onFinish else { return }
        onFinish = nil
        dismiss(animated: true) {
            if let error {
                finish(.failure(error))
            } else {
                finish(.success(processedResult))
            }
        }
    }

    private func chromeButton(title: String, action: Selector) -> UIButton {
        var config = UIButton.Configuration.filled()
        config.title = title
        config.baseBackgroundColor = UIColor.black.withAlphaComponent(0.55)
        config.cornerStyle = .capsule
        let button = UIButton(configuration: config, primaryAction: nil)
        button.addTarget(self, action: action, for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }
}

/// A label that keeps its text off its own rounded edges. UILabel has no
/// padding of its own, and a warning whose words touch the pill border
/// reads as a rendering bug rather than a message.
final class PillLabel: UILabel {
    private let insets = UIEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)

    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: insets))
    }

    override var intrinsicContentSize: CGSize {
        let size = super.intrinsicContentSize
        return CGSize(
            width: size.width + insets.left + insets.right,
            height: size.height + insets.top + insets.bottom)
    }
}

enum RoomScanError: LocalizedError {
    case cancelled
    case unsupportedDevice

    var errorDescription: String? {
        switch self {
        case .cancelled: return "The scan was cancelled."
        case .unsupportedDevice: return "This device has no LiDAR scanner."
        }
    }
}

/**
 * The live 2D mini-map: the floor plan as it is being caught, with a pose
 * cursor for where the operator stands and which way they face.
 *
 * This is the piece that turns scanning from blind sweeping into a
 * steerable task. Apple's in-world massing shows captured geometry in 3D,
 * anchored in the room — good for "did it catch that wall", useless for
 * "does the outline close". Only a flat plan shows the missing edge while
 * walking back to fix it is still an option.
 *
 * Drawn from scratch (the functional idea is the reference's; the drawing
 * is ours): walked walls in white — dashed while RoomPlan is still unsure
 * of them — the guessed closing edge dashed orange exactly as the review
 * sheet will draw it, earlier rooms of the visit dim and filled, and the
 * pose as a dot with a heading wedge. World-frame, north never rotates:
 * a map that spins with the phone cannot be glanced at.
 */
@available(iOS 17.0, *)
final class ScanMiniMapView: UIView {
    struct Pose {
        var x: Double
        var y: Double
        /// Radians in plan space, the way the camera faces.
        var heading: Double
    }

    /// The in-progress room's walls. `solid` is RoomPlan's own confidence —
    /// a wall the framework is still unsure of draws dashed rather than
    /// pretending to be as real as the others.
    var walls: [(segment: FloorPlanGeometry.Segment, solid: Bool)] = [] {
        didSet { setNeedsDisplay() }
    }
    /// Earlier rooms of this visit, in the same world frame.
    var previousRooms: [[FloorPlanGeometry.Segment]] = [] {
        didSet { setNeedsDisplay() }
    }
    var pose: Pose? {
        didSet { setNeedsDisplay() }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = UIColor.black.withAlphaComponent(0.55)
        layer.cornerRadius = 12
        layer.masksToBounds = true
        isOpaque = false
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }

        // Fit everything known so far — walls, earlier rooms, the operator —
        // in one box. The span floor keeps the first seconds of a scan from
        // rendering a two-metre wall across the whole card.
        var minX = Double.infinity, minY = Double.infinity
        var maxX = -Double.infinity, maxY = -Double.infinity
        func extend(_ x: Double, _ y: Double) {
            minX = min(minX, x); minY = min(minY, y)
            maxX = max(maxX, x); maxY = max(maxY, y)
        }
        for room in previousRooms {
            for s in room {
                extend(s.x1, s.y1)
                extend(s.x2, s.y2)
            }
        }
        for wall in walls {
            extend(wall.segment.x1, wall.segment.y1)
            extend(wall.segment.x2, wall.segment.y2)
        }
        if let pose { extend(pose.x, pose.y) }
        guard minX.isFinite else { return }

        let pad = 12.0
        let spanW = max(maxX - minX, 3.0)
        let spanH = max(maxY - minY, 3.0)
        let scale = min(
            (Double(bounds.width) - pad * 2) / spanW,
            (Double(bounds.height) - pad * 2) / spanH)
        let cx = (minX + maxX) / 2
        let cy = (minY + maxY) / 2
        func pt(_ x: Double, _ y: Double) -> CGPoint {
            CGPoint(
                x: (x - cx) * scale + Double(bounds.midX),
                y: (y - cy) * scale + Double(bounds.midY))
        }

        // Earlier rooms: dim, filled when their outline closed, so what is
        // already banked reads as ground rather than competing with the
        // room being walked right now.
        for room in previousRooms {
            let outline = FloorPlanGeometry.outlineWithClosure(room)
            if let outline, outline.inferredEdge == nil, outline.points.count >= 3 {
                ctx.beginPath()
                ctx.move(to: pt(outline.points[0].x, outline.points[0].y))
                for p in outline.points.dropFirst() { ctx.addLine(to: pt(p.x, p.y)) }
                ctx.closePath()
                ctx.setFillColor(UIColor.white.withAlphaComponent(0.12).cgColor)
                ctx.fillPath()
            }
            ctx.setStrokeColor(UIColor.white.withAlphaComponent(0.3).cgColor)
            ctx.setLineWidth(1.5)
            ctx.setLineDash(phase: 0, lengths: [])
            ctx.beginPath()
            for s in room {
                ctx.move(to: pt(s.x1, s.y1))
                ctx.addLine(to: pt(s.x2, s.y2))
            }
            ctx.strokePath()
        }

        // The room being walked. Confident walls solid, uncertain ones
        // dashed — the framework's own confidence, shown rather than hidden.
        ctx.setLineCap(.round)
        for wall in walls {
            let s = wall.segment
            ctx.setStrokeColor(
                UIColor.white.withAlphaComponent(wall.solid ? 0.95 : 0.45).cgColor)
            ctx.setLineWidth(wall.solid ? 2.5 : 2)
            ctx.setLineDash(phase: 0, lengths: wall.solid ? [] : [4, 3])
            ctx.beginPath()
            ctx.move(to: pt(s.x1, s.y1))
            ctx.addLine(to: pt(s.x2, s.y2))
            ctx.strokePath()
        }

        // The edge that would have to be guessed if the scan stopped now —
        // the same dashed orange the review sheet uses, so the operator
        // learns one vocabulary: dashed orange means "nobody walked this".
        if walls.count >= 3 {
            let segments = walls.map(\.segment)
            if let edge = FloorPlanGeometry.outlineWithClosure(segments)?.inferredEdge {
                ctx.setStrokeColor(UIColor.systemOrange.cgColor)
                ctx.setLineWidth(2)
                ctx.setLineDash(phase: 0, lengths: [5, 4])
                ctx.beginPath()
                ctx.move(to: pt(edge.x1, edge.y1))
                ctx.addLine(to: pt(edge.x2, edge.y2))
                ctx.strokePath()
            }
        }
        ctx.setLineDash(phase: 0, lengths: [])

        // The operator: a dot where they stand, a wedge the way they face.
        if let pose {
            let at = pt(pose.x, pose.y)
            let wedge = 0.45
            let reach = 16.0
            ctx.beginPath()
            ctx.move(to: at)
            ctx.addLine(
                to: CGPoint(
                    x: at.x + cos(pose.heading - wedge) * reach,
                    y: at.y + sin(pose.heading - wedge) * reach))
            ctx.addLine(
                to: CGPoint(
                    x: at.x + cos(pose.heading + wedge) * reach,
                    y: at.y + sin(pose.heading + wedge) * reach))
            ctx.closePath()
            ctx.setFillColor(UIColor.systemBlue.withAlphaComponent(0.3).cgColor)
            ctx.fillPath()

            ctx.beginPath()
            ctx.addEllipse(in: CGRect(x: at.x - 4.5, y: at.y - 4.5, width: 9, height: 9))
            ctx.setFillColor(UIColor.systemBlue.cgColor)
            ctx.fillPath()
        }
    }
}
