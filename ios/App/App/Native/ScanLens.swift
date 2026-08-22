import ARKit
import AVFoundation
import RoomPlan

/// **Can a scan be run on the ultra-wide lens?**
///
/// The owner, 22 Aug 2026, after watching Polycam: *"I noticed Polycam is
/// actually using the widest angle lens. Maybe we can choose before starting
/// what lens we want, depending on the place we're scanning. So when we're in
/// the place, we see what the place is, and we understand what lens we need."*
///
/// The reason it is a good idea: a wide lens is worth most in exactly the rooms
/// this trade works in. A bathroom or a mechanical room has nowhere to stand
/// back to, and a narrow field of view means shuffling backwards into a wall
/// trying to get a whole wall in frame.
///
/// ## Why this file is a probe and not a feature
///
/// The first answer given was "impossible, `RoomCaptureSession.Configuration`
/// has one property". That was too strong, and wrong in a way worth recording:
/// the lens is not chosen through RoomPlan's `Configuration` at all. It would
/// be chosen through the **ARSession's** `ARWorldTrackingConfiguration
/// .videoFormat` — and iOS 17's `RoomCaptureSession(arSession:)` means we can
/// supply that session, which this app ALREADY does (`ScanSession.arSession`,
/// passed through `CaptureFlow` so every room of a visit shares one world
/// frame). So the door is not locked. It was never tried.
///
/// Two facts have to be established, in order, and only the first is knowable
/// without an experiment:
///
/// 1. **Does ARKit world tracking offer an ultra-wide format on this device at
///    all?** `ARVideoFormat.captureDeviceType` is READ-ONLY — a format
///    describes which camera it uses; you do not set the camera, you pick a
///    format that happens to use it. So if no supported format reports
///    `.builtInUltraWideCamera`, the answer is a hard no and nothing else
///    matters. **That is what this file measures.**
/// 2. **Would RoomPlan accept a session configured that way?** RoomPlan runs
///    its own configuration on the session it is given, and
///    `RoomCaptureSession.CaptureError.invalidARConfiguration` exists
///    precisely because it validates. Only worth attempting if (1) says yes.
///
/// Note the phone almost certainly HAS an ultra-wide camera — every Pro since
/// the 11 does, and Polycam clearly uses it. That is not the question. The
/// question is whether **ARKit's world tracking** will drive it, which is a
/// different and much narrower one: world tracking is calibrated against a
/// specific camera's intrinsics, and Polycam's wide view may well come from
/// their own non-ARKit capture path rather than from a setting we could match.
enum ScanLens {

    struct Format {
        let deviceType: String
        let width: Int
        let height: Int
        let fps: Int
        let isUltraWide: Bool
    }

    /// Every video format ARKit will run world tracking with, on THIS device.
    static var worldTrackingFormats: [Format] {
        ARWorldTrackingConfiguration.supportedVideoFormats.map { format in
            Format(
                deviceType: format.captureDeviceType.rawValue,
                width: Int(format.imageResolution.width),
                height: Int(format.imageResolution.height),
                fps: format.framesPerSecond,
                isUltraWide: format.captureDeviceType == .builtInUltraWideCamera)
        }
    }

    /// Does the hardware have an ultra-wide camera at all, regardless of what
    /// ARKit will do with it?
    ///
    /// Kept separate from `worldTrackingFormats` on purpose: the two answers
    /// together are what distinguishes "this phone cannot" from "ARKit will
    /// not", and only the second is a limitation we might work around.
    static var deviceHasUltraWide: Bool {
        !AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInUltraWideCamera], mediaType: .video, position: .back
        ).devices.isEmpty
    }

    /// The formats that would let a scan run ultra-wide, if any.
    static var ultraWideFormats: [Format] { worldTrackingFormats.filter(\.isUltraWide) }

    /// A single block of text answering the owner's question, written to the
    /// log at scan start.
    ///
    /// Deliberately a log line and not a screen. This is a measurement taken
    /// once on his hardware to decide whether a feature is possible; building
    /// a lens picker before knowing the answer would be building a control
    /// with nothing to control.
    static var report: String {
        var out = "SCANLENS: device has ultra-wide camera: \(deviceHasUltraWide)\n"
        out += "SCANLENS: ARWorldTrackingConfiguration supports \(worldTrackingFormats.count) format(s)\n"
        for f in worldTrackingFormats {
            out +=
                "SCANLENS:   \(f.width)x\(f.height) @\(f.fps)fps  \(f.deviceType)"
                + (f.isUltraWide ? "  <-- ULTRA-WIDE\n" : "\n")
        }
        out +=
            ultraWideFormats.isEmpty
            ? "SCANLENS: VERDICT — no ultra-wide format for world tracking. A lens picker is not buildable on this path.\n"
            : "SCANLENS: VERDICT — \(ultraWideFormats.count) ultra-wide format(s) available. Next step: try RoomCaptureSession(arSession:) with one and watch for .invalidARConfiguration.\n"
        return out
    }
}
