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
    /// A recording landed in the phone's own Photos. Videos do not go to the
    /// server — his instruction, 20 Aug: *"this video shouldn't go to our
    /// server because it's heavy."*
    var onVideo: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @StateObject private var camera = SiteCameraController()
    @State private var mode: SiteCameraController.Mode = .photo
    /// A flash of white over the preview on capture — the only feedback that
    /// a photograph was actually taken when the frame barely changes.
    @State private var flashing = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

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
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipped()
        }
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
                    if let image { onPhoto(image) }
                }
            case .video:
                if camera.recording {
                    camera.stopRecording { saved in if saved { onVideo?() } }
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
    private var onVideoSaved: ((Bool) -> Void)?
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
            if let connection = self.movieOutput.connection(with: .video) {
                if connection.isVideoRotationAngleSupported(90) {
                    connection.videoRotationAngle = 90
                }
                if connection.isVideoMirroringSupported {
                    connection.isVideoMirrored = self.front
                }
            }
            self.movieOutput.startRecording(to: url, recordingDelegate: self)
        }
        DispatchQueue.main.async {
            self.recording = true
            self.startedAt = Date()
            self.elapsedText = "0:00"
            self.startTicker()
        }
    }

    func stopRecording(_ completion: @escaping (Bool) -> Void) {
        guard recording else { return }
        onVideoSaved = completion
        stopTicker()
        work.async { [weak self] in self?.movieOutput.stopRecording() }
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

    /// **The recording goes to the phone's own Photos, never to us.** His
    /// instruction, 20 Aug 2026: *"I don't wanna load my server with photo
    /// cedar… this video shouldn't go to our server because it's heavy."*
    /// A minute of 4K is most of a gigabyte, and a restoration crew's
    /// evidence video is watched once, on the phone that took it.
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
        // The temporary copy is deleted either way. Keeping it would fill
        // the phone with recordings nothing points at.
        try? FileManager.default.removeItem(at: url)
        DispatchQueue.main.async {
            let handler = self.onVideoSaved
            self.onVideoSaved = nil
            handler?(saved)
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
