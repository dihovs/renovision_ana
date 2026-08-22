import AVFoundation
import RoomPlan
import UIKit

/// **The scan tells your hand what it just saw.**
///
/// Borrowed from Polycam at the owner's ask, 22 Aug 2026, after scanning his
/// own condo with it: *"my phone vibrates like tick tick tick tick. It shows
/// when it sees a new line, when it puts a new point cloud, it gives a slight
/// vibration. The app feels alive. I want to implement that also."*
///
/// ## What we tick on, and why it is not what Polycam ticks on
///
/// Polycam is a point-cloud scanner, so it ticks on POINTS — a texture of
/// activity that says *I am working*. RoomPlan does not stream points; it
/// streams a `CapturedRoom` of walls, doors, windows, openings and objects,
/// each with a stable identifier. So the honest translation is to tick when a
/// piece of the room becomes KNOWN.
///
/// That is the better signal anyway, and it is worth being deliberate about
/// rather than treating as a limitation. A tick that fires on points says
/// "the sensor is on", which the operator can already see. A tick that fires
/// when a wall or a dishwasher is recognised answers the question they
/// actually have while walking backwards holding a phone up: **did it get
/// that one?** They learn the rhythm in one room, and after that a silent
/// corner is information.
///
/// Two weights, because two things are worth different amounts:
///
/// - `.light` for a new surface — another wall, door or window landed.
/// - `.medium` for a new object — it recognised the fridge. Rarer, more
///   interesting, and the thing most likely to be missed and need a second
///   pass.
///
/// ## The rules that keep it from being a nuisance
///
/// - **One tick per update at most.** RoomPlan's first callback can arrive
///   carrying four walls at once, and four simultaneous taps is a buzz, not a
///   tick. Several new pieces in one update coalesce into the single heaviest.
/// - **A floor between ticks.** `didUpdate` can fire many times a second;
///   `minimumGap` keeps the fastest possible rhythm at something a hand reads
///   as separate taps rather than a vibration.
/// - **Nothing on the first update.** A scan resumed onto an existing room, or
///   RoomPlan's initial burst, would otherwise open with a machine-gun. The
///   first update only records what is already known.
/// - **Off is one switch.** `UserDefaults`, defaulting on, so it can be
///   silenced without a build if it turns out to grate over a long day. It is
///   deliberately not a screen yet — see the note on `isEnabled`.
@available(iOS 17.0, *)
final class ScanCaptureFeel {
    /// Identifiers already felt. RoomPlan's identifiers are stable across
    /// updates, so this is a set of "things the operator has been told about".
    ///
    /// A merge — RoomPlan deciding two wall fragments were always one wall —
    /// can retire two identifiers and mint one, which reads here as a new
    /// surface and ticks. That is correct: the room's geometry genuinely just
    /// changed, and the operator is better off feeling it than not.
    private var feltSurfaces: Set<UUID> = []
    private var feltObjects: Set<UUID> = []
    private var seenFirstUpdate = false
    private var lastTick = Date.distantPast

    /// Fast enough to feel like a response, slow enough that two ticks never
    /// blur into one buzz. 0.12s was chosen as roughly the shortest gap a hand
    /// reads as two separate taps.
    private let minimumGap: TimeInterval = 0.12

    private let light = UIImpactFeedbackGenerator(style: .light)
    private let medium = UIImpactFeedbackGenerator(style: .medium)

    /// **Not a settings screen, on purpose.** Haptics during a scan is the kind
    /// of thing that delights for a week and then annoys, and nobody knows yet
    /// which way this one goes. A defaults key can be flipped from a debug
    /// build or a future toggle without committing a screen to it now; if the
    /// owner still likes it in a month, promote it into the scan options card
    /// beside the existing three checkboxes.
    static var isEnabled: Bool {
        get {
            UserDefaults.standard.object(forKey: "scanHaptics") as? Bool ?? true
        }
        set { UserDefaults.standard.set(newValue, forKey: "scanHaptics") }
    }

    init() {
        light.prepare()
        medium.prepare()
    }

    /// Call on every `captureSession(_:didUpdate:)`, before any throttle.
    func felt(_ room: CapturedRoom, at now: Date) {
        let surfaces = Set(
            room.walls.map(\.identifier) + room.doors.map(\.identifier)
                + room.windows.map(\.identifier) + room.openings.map(\.identifier))
        let objects = Set(room.objects.map(\.identifier))

        defer {
            feltSurfaces = surfaces
            feltObjects = objects
            seenFirstUpdate = true
        }

        // The first update establishes the baseline and says nothing. Without
        // this a resumed scan announces the whole room it already had.
        guard seenFirstUpdate, Self.isEnabled else { return }

        let newObjects = !objects.subtracting(feltObjects).isEmpty
        let newSurfaces = !surfaces.subtracting(feltSurfaces).isEmpty
        guard newObjects || newSurfaces else { return }
        guard now.timeIntervalSince(lastTick) >= minimumGap else { return }
        lastTick = now

        // Coalesced: an update that brought both a wall and a fridge is one
        // tap at the heavier weight, not two.
        if newObjects {
            medium.impactOccurred()
            medium.prepare()
        } else {
            light.impactOccurred()
            light.prepare()
        }
    }
}

/// The scan screen's torch, kept apart from the view controller so turning it
/// off on the way out cannot depend on a button still existing.
///
/// **RoomPlan owns the capture session; this reaches past it to the device.**
/// That is allowed — the torch is a property of the hardware, not of the
/// session — but it is also why `set(on:)` is defensive: a configuration lock
/// can fail, and an ARKit reconfiguration can drop the torch back off without
/// telling anyone. `isOn` therefore reads the DEVICE every time rather than
/// caching, so the button can never claim light that is not there.
enum ScanTorch {
    private static var device: AVCaptureDevice? {
        guard let device = AVCaptureDevice.default(for: .video), device.hasTorch else {
            return nil
        }
        return device
    }

    static var isAvailable: Bool { device != nil }

    static var isOn: Bool { device?.torchMode == .on }

    static func set(on: Bool) {
        guard let device else { return }
        do {
            try device.lockForConfiguration()
            device.torchMode = on ? .on : .off
            device.unlockForConfiguration()
        } catch {
            // Nothing to do and nothing worth interrupting a scan for. The
            // button re-reads the device, so it will simply show the truth.
        }
    }
}
