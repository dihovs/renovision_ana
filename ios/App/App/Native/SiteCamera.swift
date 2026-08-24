import AVFoundation
import Photos
import SwiftUI
import UIKit

/// The camera, ours rather than the system's.
///
/// **Why this exists.** Until now a site photo came from
/// `UIImagePickerController` — Apple's camera in a box, which cannot be told
/// what to draw on top of itself. The reference's camera does four things
/// that box cannot:
///
/// 1. It **burns the date and time into the frame while you are aiming**, so
///    the operator sees the stamp before the shutter rather than discovering
///    it afterwards. His note, 20 Aug 2026: *"if you see on the photos,
///    there is a time stamp… So this is very important to know."*
/// 2. It offers **VIDEO and PHOTO in one place**, with the mode strip under
///    the shutter.
/// 3. It has the **lens buttons** — `.5`, `1x`, `2`, `3` — down the right,
///    which is how anyone photographs a whole wall in a bathroom.
/// 4. It keeps a **grid** on the preview. On a plumb building a level
///    photograph is worth having; a report of tilted rooms reads as careless.
///
/// **What is not here: 360.** Their third mode stitches an equirectangular
/// panorama, and shipping a tab that opens something else — or nothing —
/// would be worse than not shipping the tab. It is the one thing on this
/// screen that is theirs and not yet ours.
///
/// The chrome is otherwise theirs, read off his screenshot: `Cancel` top
/// left, the mode named across the top, thumbnail bottom left, the white
/// ring shutter, and the row of four controls above the mode strip.
struct SiteCameraView: View {
    /// A photograph, already stamped. Called once per shutter press; the
    /// camera stays open, because a room is never one photograph.
    let onPhoto: (UIImage) -> Void
    /// A recording landed in the phone's own Photos AND the operator chose
    /// to keep a copy on the job too. His instruction, 20 Aug, still
    /// governs the DEFAULT: *"this video shouldn't go to our server because
    /// it's heavy."* Every recording still saves to Photos and nothing
    /// uploads on its own — this fires only after an explicit "Keep on
    /// job", offered once per clip (see `videoKeepPrompt`). The temp file at
    /// this URL is the caller's to read and then discard; nothing else will
    /// delete it once this closure is called.
    var onVideo: ((URL) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @StateObject private var camera = SiteCameraController()
    @State private var mode: SiteCameraController.Mode = .photo
    /// A flash of white over the preview on capture — the only feedback that
    /// a photograph was actually taken when the frame barely changes.
    @State private var flashing = false
    /// A clip just finished and saved to Photos, waiting on the operator to
    /// say whether it also goes on the job. Set once per recording; cleared
    /// by either button in `videoKeepPrompt`, which is also what owns
    /// discarding the temp file when "Not now" is chosen.
    @State private var pendingVideo: URL?
    /// How many photos or clips this visit to the camera has produced. Drives
    /// nothing but the `Done` button, which has nothing to be done about until
    /// there is at least one.
    @State private var taken = 0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // **The CHROME keeps its safe area; only the black behind it does
            // not.** The owner: *"the camera is not scaled properly to the
            // size of my phone screen."* The whole view was presented with
            // `.ignoresSafeArea()`, so this stack ran edge to edge — the
            // header slid under the notch and the controls under the home
            // indicator, which is why a button at the bottom could not be
            // reached. Ignoring the safe area is right for the backdrop and
            // wrong for anything anybody has to press.
            VStack(spacing: 0) {
                header
                preview
                controls
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden()
        .onAppear { camera.begin(mode: mode) }
        .onDisappear { camera.end() }
        .onChange(of: mode) { _, new in camera.setMode(new) }
    }

    // MARK: - Top

    private var header: some View {
        ZStack {
            Text(mode == .photo ? "Photo" : "Video")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)

            HStack {
                Button("Cancel") { dismiss() }
                    .font(.system(size: 17))
                    .foregroundStyle(.white)
                Spacer()
                // **Done, once anything has been taken.**
                //
                // The owner: *"I don't see the button that says Done after the
                // photos are taken."* There wasn't one. The only way out of
                // this screen was the button labelled `Cancel` — which, after
                // shooting six photographs of a flooded basement, reads as
                // "throw them away". Every shot was in fact already uploaded
                // the moment it was taken, so Cancel was safe; nothing about
                // the screen said so.
                //
                // It appears only after the first capture, because a Done on
                // an empty camera is a second Cancel wearing a friendlier
                // word.
                if taken > 0 {
                    Button("Done") { dismiss() }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
        }
        .padding(.horizontal, Brand.Space.base)
        .frame(height: 44)
    }

    // MARK: - The frame

    private var preview: some View {
        GeometryReader { geo in
            ZStack {
                CameraPreview(session: camera.session)

                if camera.gridOn { RuleOfThirds() }

                // **The stamp, live.** Drawn here at the same corner and in
                // the same words the saved file will carry, so what the
                // operator frames is what the adjuster receives.
                TimelineView(.periodic(from: .now, by: 20)) { context in
                    Text(SiteCameraController.stampText(context.date))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .shadow(color: .black.opacity(0.7), radius: 3, y: 1)
                        .frame(maxWidth: .infinity, maxHeight: .infinity,
                               alignment: .bottomTrailing)
                        .padding(Brand.Space.base)
                }

                if camera.zoomLabels.count > 1 { lenses }

                if camera.recording { recordingClock }

                if flashing {
                    Color.white.transition(.opacity)
                }

                if let problem = camera.problem {
                    Text(problem)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .padding(Brand.Space.small)
                        .background(.black.opacity(0.7), in: .rect(cornerRadius: Brand.Radius.tile))
                        .padding(Brand.Space.large)
                }

                if let url = pendingVideo { videoKeepPrompt(url) }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipped()
        }
    }

    /// **The opt-in, once per clip.** Every recording already saved to
    /// Photos by the time this shows — this only asks whether a copy also
    /// goes on the job, which is what makes it show in the room's grid,
    /// print a duration badge, and be citable in the report. "Not now"
    /// changes nothing that already happened; the recording is still safe
    /// in Photos either way.
    private func videoKeepPrompt(_ url: URL) -> some View {
        VStack(spacing: Brand.Space.small) {
            Text("Saved to Photos. Keep a copy on this job too?")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
            HStack(spacing: Brand.Space.large) {
                Button("Not now") {
                    SiteCameraController.discardTemporaryRecording(at: url)
                    pendingVideo = nil
                }
                .font(.system(size: 15))
                .foregroundStyle(.white.opacity(0.75))

                Button("Keep on job") {
                    onVideo?(url)
                    pendingVideo = nil
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.yellow)
            }
        }
        .padding(Brand.Space.base)
        .frame(maxWidth: .infinity)
        .background(.black.opacity(0.8), in: .rect(cornerRadius: Brand.Radius.tile))
        .padding(Brand.Space.large)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
    }

    /// The lens buttons, stacked down the right edge as theirs are — and
    /// showing only the lenses this phone actually has. A `.5` on a handset
    /// with no ultra-wide is a button that silently does nothing.
    private var lenses: some View {
        VStack(spacing: 0) {
            ForEach(Array(camera.zoomLabels.enumerated()), id: \.offset) { index, label in
                Button {
                    camera.selectZoom(index)
                } label: {
                    Text(label)
                        .font(.system(size: 15, weight: index == camera.zoomIndex ? .bold : .regular))
                        .foregroundStyle(index == camera.zoomIndex ? Color.yellow : .white)
                        .frame(width: 44, height: 40)
                }
            }
        }
        .background(.black.opacity(0.35), in: .rect(cornerRadius: Brand.Radius.tile))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
        .padding(.trailing, Brand.Space.tight)
    }

    private var recordingClock: some View {
        HStack(spacing: Brand.Space.tight) {
            Circle().fill(.red).frame(width: 9, height: 9)
            Text(camera.elapsedText)
                .font(.system(size: 15, weight: .semibold).monospacedDigit())
                .foregroundStyle(.white)
        }
        .padding(.horizontal, Brand.Space.small)
        .padding(.vertical, 5)
        .background(.black.opacity(0.5), in: .capsule)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding(.top, Brand.Space.small)
    }

    // MARK: - Bottom

    private var controls: some View {
        VStack(spacing: Brand.Space.base) {
            // Their row of four. Ours is three: the fourth is a settings
            // gear opening a screen of magicplan's own preferences, and a
            // gear that opens nothing is worse than no gear.
            HStack(spacing: 0) {
                toolButton("arrow.triangle.2.circlepath", on: false) { camera.flip() }
                toolButton("grid", on: camera.gridOn) { camera.gridOn.toggle() }
                toolButton(
                    camera.flashOn ? "bolt.fill" : "bolt.slash",
                    on: camera.flashOn
                ) { camera.flashOn.toggle() }
            }
            .frame(maxWidth: .infinity)

            // The mode strip, in their words and their yellow.
            HStack(spacing: Brand.Space.large) {
                ForEach(SiteCameraController.Mode.allCases, id: \.self) { option in
                    Button {
                        guard !camera.recording else { return }
                        mode = option
                    } label: {
                        Text(option.title)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(option == mode ? Color.yellow : .white.opacity(0.7))
                    }
                }
            }

            ZStack {
                shutter

                HStack {
                    thumbnail
                    Spacer()
                }
                .padding(.horizontal, Brand.Space.large)
            }
        }
        .padding(.top, Brand.Space.base)
        .padding(.bottom, Brand.Space.small)
    }

    private var shutter: some View {
        Button {
            switch mode {
            case .photo:
                withAnimation(.easeOut(duration: 0.06)) { flashing = true }
                camera.capture { image in
                    withAnimation(.easeIn(duration: 0.18)) { flashing = false }
                    if let image {
                        onPhoto(image)
                        taken += 1
                    }
                }
            case .video:
                if camera.recording {
                    camera.stopRecording { saved, url in
                        if saved {
                            pendingVideo = url
                        } else {
                            SiteCameraController.discardTemporaryRecording(at: url)
                        }
                    }
                } else {
                    camera.startRecording()
                }
            }
        } label: {
            ZStack {
                Circle()
                    .stroke(.white, lineWidth: 4)
                    .frame(width: 74, height: 74)
                if mode == .video && camera.recording {
                    RoundedRectangle(cornerRadius: 6).fill(.red).frame(width: 30, height: 30)
                } else if mode == .video {
                    Circle().fill(.red).frame(width: 60, height: 60)
                } else {
                    Circle().fill(.white).frame(width: 60, height: 60)
                }
            }
        }
        .buttonStyle(.plain)
    }

    /// The last frame taken, bottom left — theirs shows it, and it is the
    /// only confirmation on this screen that the photograph exists.
    private var thumbnail: some View {
        Group {
            if let shot = camera.lastShot {
                Image(uiImage: shot)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 46, height: 46)
                    .clipShape(.rect(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.6)))
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(.white.opacity(0.12))
                    .frame(width: 46, height: 46)
            }
        }
    }

    private func toolButton(
        _ symbol: String, on: Bool, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 20))
                .foregroundStyle(on ? Color.yellow : .white)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}

/// Rule-of-thirds lines over the preview.
private struct RuleOfThirds: View {
    var body: some View {
        GeometryReader { geo in
            Path { path in
                for column in 1...2 {
                    let x = geo.size.width * CGFloat(column) / 3
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x, y: geo.size.height))
                }
                for row in 1...2 {
                    let y = geo.size.height * CGFloat(row) / 3
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: geo.size.width, y: y))
                }
            }
            .stroke(.white.opacity(0.35), lineWidth: 0.5)
        }
        .allowsHitTesting(false)
    }
}

/// The live picture. A plain `UIView` whose backing layer IS the preview
/// layer, so it resizes with the view instead of being kept in step by hand.
private struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.backgroundColor = .black
        view.layer.session = session
        view.layer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ view: PreviewView, context: Context) {}

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        override var layer: AVCaptureVideoPreviewLayer {
            super.layer as! AVCaptureVideoPreviewLayer
        }
    }
}

// MARK: - The session

/// Everything that talks to `AVFoundation`, so the view above stays a view.
final class SiteCameraController: NSObject, ObservableObject {
    enum Mode: CaseIterable {
        case video, photo
        var title: String { self == .video ? "VIDEO" : "PHOTO" }
    }

    @Published private(set) var lastShot: UIImage?
    @Published private(set) var recording = false
    @Published private(set) var elapsedText = "0:00"
    @Published private(set) var zoomLabels: [String] = []
    @Published private(set) var zoomIndex = 0
    @Published var flashOn = false
    @Published var gridOn = true
    @Published var problem: String?

    let session = AVCaptureSession()

    private let photoOutput = AVCapturePhotoOutput()
    private let movieOutput = AVCaptureMovieFileOutput()
    private var device: AVCaptureDevice?
    private var videoInput: AVCaptureDeviceInput?
    private var audioInput: AVCaptureDeviceInput?
    private var front = false
    private var mode: Mode = .photo
    /// The `videoZoomFactor` that shows the field of view people call `1x`.
    private var oneX: CGFloat = 1
    private var zoomStops: [CGFloat] = []
    private var onPhoto: ((UIImage?) -> Void)?
    private var onVideoSaved: ((Bool, URL) -> Void)?
    private var startedAt: Date?
    private var ticker: Timer?
    /// Everything that configures or runs the session, off the main thread —
    /// `startRunning` blocks, and blocking the main thread on a camera open
    /// is the hitch every user reads as the app freezing.
    private let work = DispatchQueue(label: "site.camera")

    /// A restoration photograph is evidence of a condition that will not
    /// exist tomorrow, so the moment goes in the frame. **Their format, to
    /// the letter, read off his screenshot: `Aug 20, 2026 • 10:53 PM`.**
    static func stampText(_ moment: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d, yyyy • h:mm a"
        return formatter.string(from: moment)
    }

    func begin(mode: Mode) {
        self.mode = mode
        work.async { [weak self] in
            guard let self else { return }
            self.configure()
            if !self.session.isRunning { self.session.startRunning() }
        }
    }

    func end() {
        stopTicker()
        work.async { [weak self] in
            guard let self else { return }
            if self.session.isRunning { self.session.stopRunning() }
        }
    }

    func setMode(_ new: Mode) {
        guard new != mode else { return }
        mode = new
        work.async { [weak self] in
            guard let self else { return }
            self.session.beginConfiguration()
            // A movie wants the video preset; a photograph wants every pixel
            // the sensor has. Neither is a good default for the other.
            self.session.sessionPreset = new == .video ? .high : .photo
            self.session.commitConfiguration()
        }
    }

    // MARK: Configuration

    private func configure() {
        guard session.inputs.isEmpty else { return }
        session.beginConfiguration()
        session.sessionPreset = mode == .video ? .high : .photo

        guard let camera = Self.bestCamera(front: front) else {
            session.commitConfiguration()
            report("No camera on this device.")
            return
        }
        device = camera
        do {
            let input = try AVCaptureDeviceInput(device: camera)
            if session.canAddInput(input) {
                session.addInput(input)
                videoInput = input
            }
        } catch {
            session.commitConfiguration()
            report("The camera would not open: \(error.localizedDescription)")
            return
        }

        // Sound, for video only — but added once, because pulling an input
        // in and out of a running session is a click in every recording.
        if let microphone = AVCaptureDevice.default(for: .audio),
            let input = try? AVCaptureDeviceInput(device: microphone),
            session.canAddInput(input) {
            session.addInput(input)
            audioInput = input
        }

        if session.canAddOutput(photoOutput) { session.addOutput(photoOutput) }
        if session.canAddOutput(movieOutput) { session.addOutput(movieOutput) }
        session.commitConfiguration()

        readZoomStops(camera)
    }

    /// The most capable back camera, so the lens buttons have something to
    /// switch between. `.builtInWideAngleCamera` is the floor, not the aim.
    private static func bestCamera(front: Bool) -> AVCaptureDevice? {
        let types: [AVCaptureDevice.DeviceType] = front
            ? [.builtInWideAngleCamera]
            : [.builtInTripleCamera, .builtInDualWideCamera, .builtInDualCamera,
               .builtInWideAngleCamera]
        for type in types {
            let found = AVCaptureDevice.DiscoverySession(
                deviceTypes: [type], mediaType: .video,
                position: front ? .front : .back
            ).devices.first
            if let found { return found }
        }
        return nil
    }

    /// **What `1x` means depends on the phone.** On a virtual device whose
    /// first lens is the ultra-wide, `videoZoomFactor == 1` is the `.5`
    /// view, and the number a person calls `1x` is the factor at which the
    /// wide lens takes over. On a phone with no ultra-wide, `1` is `1x`.
    /// Getting this backwards puts every photograph one lens too wide.
    private func readZoomStops(_ camera: AVCaptureDevice) {
        let switchovers = camera.virtualDeviceSwitchOverVideoZoomFactors
            .map { CGFloat(truncating: $0) }
        let ultraWideFirst =
            camera.constituentDevices.first?.deviceType == .builtInUltraWideCamera
        oneX = (ultraWideFirst ? switchovers.first : nil) ?? 1

        var stops: [CGFloat] = []
        var labels: [String] = []
        if oneX > 1 {
            stops.append(oneX / 2)
            labels.append(".5")
        }
        stops.append(oneX)
        labels.append("1x")
        for multiple in [CGFloat(2), CGFloat(3)]
        where oneX * multiple <= camera.maxAvailableVideoZoomFactor {
            stops.append(oneX * multiple)
            labels.append(multiple == 2 ? "2" : "3")
        }

        let index = labels.firstIndex(of: "1x") ?? 0
        DispatchQueue.main.async {
            self.zoomStops = stops
            self.zoomLabels = labels
            self.zoomIndex = index
        }
        apply(zoom: oneX)
    }

    func selectZoom(_ index: Int) {
        guard zoomStops.indices.contains(index) else { return }
        zoomIndex = index
        apply(zoom: zoomStops[index])
    }

    private func apply(zoom factor: CGFloat) {
        work.async { [weak self] in
            guard let self, let camera = self.device else { return }
            guard (try? camera.lockForConfiguration()) != nil else { return }
            camera.videoZoomFactor = min(
                max(factor, camera.minAvailableVideoZoomFactor),
                camera.maxAvailableVideoZoomFactor)
            camera.unlockForConfiguration()
        }
    }

    func flip() {
        guard !recording else { return }
        front.toggle()
        work.async { [weak self] in
            guard let self else { return }
            self.session.beginConfiguration()
            if let old = self.videoInput { self.session.removeInput(old) }
            guard let camera = Self.bestCamera(front: self.front),
                let input = try? AVCaptureDeviceInput(device: camera),
                self.session.canAddInput(input)
            else {
                // Put the old one back rather than leaving a black screen.
                if let old = self.videoInput { self.session.addInput(old) }
                self.session.commitConfiguration()
                return
            }
            self.session.addInput(input)
            self.videoInput = input
            self.device = camera
            self.session.commitConfiguration()
            self.readZoomStops(camera)
        }
    }

    // MARK: Photographs

    func capture(_ completion: @escaping (UIImage?) -> Void) {
        onPhoto = completion
        work.async { [weak self] in
            guard let self else { return }
            let settings = AVCapturePhotoSettings()
            if self.device?.hasFlash == true {
                settings.flashMode = self.flashOn ? .on : .off
            }
            // The screen is portrait and locked there; say so, rather than
            // shipping a photograph the report will print on its side.
            if let connection = self.photoOutput.connection(with: .video) {
                if connection.isVideoRotationAngleSupported(90) {
                    connection.videoRotationAngle = 90
                }
                if connection.isVideoMirroringSupported {
                    connection.isVideoMirrored = self.front
                }
            }
            self.photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }

    // MARK: Video

    func startRecording() {
        guard !recording else { return }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("site-\(UUID().uuidString).mov")
        work.async { [weak self] in
            guard let self else { return }
            // **Found the hard way, on the Simulator: `startRecording` THROWS
            // an `NSException` — not a Swift error — when there is no
            // active, enabled video connection, and an `NSException` cannot
            // be caught in Swift. It crashed the whole app outright rather
            // than reporting a message.** The Simulator has no camera at
            // all, but the same guard also protects a real device against
            // whatever left the connection in that state — a session that
            // failed to configure, a permission pulled mid-flight — turning
            // a hard crash into the same on-screen message every other
            // failure in this file already uses.
            guard let connection = self.movieOutput.connection(with: .video),
                connection.isActive, connection.isEnabled
            else {
                self.report("This device has no working camera for video.")
                return
            }
            if connection.isVideoRotationAngleSupported(90) {
                connection.videoRotationAngle = 90
            }
            if connection.isVideoMirroringSupported {
                connection.isVideoMirrored = self.front
            }
            self.movieOutput.startRecording(to: url, recordingDelegate: self)
            DispatchQueue.main.async {
                self.recording = true
                self.startedAt = Date()
                self.elapsedText = "0:00"
                self.startTicker()
            }
        }
    }

    func stopRecording(_ completion: @escaping (Bool, URL) -> Void) {
        guard recording else { return }
        onVideoSaved = completion
        stopTicker()
        work.async { [weak self] in self?.movieOutput.stopRecording() }
    }

    /// The view's job once it is done with a kept-or-discarded temp file —
    /// `finishVideo` below stops deleting it unconditionally, precisely so
    /// there is a window to offer "Keep on job" before it's gone.
    static func discardTemporaryRecording(at url: URL) {
        try? FileManager.default.removeItem(at: url)
    }

    private func startTicker() {
        ticker = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self, let start = self.startedAt else { return }
            let seconds = Int(Date().timeIntervalSince(start))
            DispatchQueue.main.async {
                self.elapsedText = String(format: "%d:%02d", seconds / 60, seconds % 60)
            }
        }
    }

    private func stopTicker() {
        ticker?.invalidate()
        ticker = nil
    }

    /// **The recording goes to the phone's own Photos first, always.** His
    /// instruction, 20 Aug 2026: *"I don't wanna load my server with photo
    /// cedar… this video shouldn't go to our server because it's heavy."*
    /// A minute of 4K is most of a gigabyte, and most site video is watched
    /// once, on the phone that took it — that stays the default. What
    /// changed for S7 is that the operator can now say a particular clip
    /// SHOULD go on the job too (`videoKeepPrompt`), so this no longer
    /// deletes the temp copy on a successful save — see `finishVideo`.
    private func saveToPhotos(_ url: URL) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self] status in
            guard status == .authorized || status == .limited else {
                self?.report("Saved nothing: this app cannot add to Photos. Settings › Renovision › Photos.")
                self?.finishVideo(false, url: url)
                return
            }
            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: url)
            } completionHandler: { saved, error in
                if !saved {
                    self?.report(
                        "The video did not save: \(error?.localizedDescription ?? "unknown reason").")
                }
                self?.finishVideo(saved, url: url)
            }
        }
    }

    private func finishVideo(_ saved: Bool, url: URL) {
        // Only a FAILED save has nothing worth keeping — a save nobody can
        // act on. A successful one is left in place: the view offers
        // "Keep on job" next, and whichever way that goes decides who
        // deletes the temp copy (`videoKeepPrompt`), not this function.
        if !saved {
            try? FileManager.default.removeItem(at: url)
        }
        DispatchQueue.main.async {
            let handler = self.onVideoSaved
            self.onVideoSaved = nil
            handler?(saved, url)
        }
    }

    private func report(_ message: String) {
        DispatchQueue.main.async {
            self.problem = message
            // Says its piece and goes. A camera with an error banner stuck
            // across it is a camera nobody can use.
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
                if self.problem == message { self.problem = nil }
            }
        }
    }
}

extension SiteCameraController: AVCapturePhotoCaptureDelegate {
    func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        let handler = onPhoto
        onPhoto = nil
        guard error == nil,
            let data = photo.fileDataRepresentation(),
            let image = UIImage(data: data)
        else {
            report("That photograph did not come out. Try again.")
            DispatchQueue.main.async { handler?(nil) }
            return
        }
        // Stamped HERE, at the moment of capture, from the same words the
        // preview was showing a fraction of a second ago.
        let stamped = image.stamped()
        DispatchQueue.main.async {
            self.lastShot = stamped
            handler?(stamped)
        }
    }
}

extension SiteCameraController: AVCaptureFileOutputRecordingDelegate {
    func fileOutput(
        _ output: AVCaptureFileOutput,
        didFinishRecordingTo outputFileURL: URL,
        from connections: [AVCaptureConnection],
        error: Error?
    ) {
        DispatchQueue.main.async {
            self.recording = false
            self.startedAt = nil
        }
        if let error {
            report("The recording stopped: \(error.localizedDescription)")
            finishVideo(false, url: outputFileURL)
            return
        }
        saveToPhotos(outputFileURL)
    }
}
