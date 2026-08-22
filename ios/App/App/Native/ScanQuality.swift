import RoomPlan

/// **What the scan itself knew was going wrong, kept until somebody can act
/// on it.**
///
/// The owner, 22 Aug 2026: *"what can we do for the LiDAR range?"* Nothing, at
/// the sensor — Apple's LiDAR is good for roughly five metres and there is no
/// API that changes that. But the interesting half of the question is what
/// happens when you exceed it, and there the answer was: **we were throwing
/// away the warning.**
///
/// `RoomCaptureSessionDelegate` has a `didProvide instruction:` callback that
/// fires continuously with `moveCloseToWall`, `moveAwayFromWall`, `slowDown`,
/// `turnOnLight`, `lowTexture` and `normal`. `RoomScanViewController`
/// implemented exactly one delegate method — `didUpdate` — so every one of
/// those was discarded. `moveCloseToWall` IS the range warning. The sensor has
/// been diagnosing this the whole time.
///
/// ## Why this records rather than displays
///
/// RoomPlan draws its own coaching on top of `RoomCaptureView`, so putting the
/// same words in our own pill would be two labels saying one thing and
/// competing for the same glance. The gap is not that the operator is never
/// told — it is that **being told is transient**. A warning that appears while
/// you are walking backwards holding a phone up, and is gone by the time you
/// look, has not really been delivered.
///
/// So this accumulates instead. What it is for is the moment AFTER Done, on
/// site, with the room still behind you: *three walls came in at low
/// confidence and the scan asked you to move closer eleven times — walk it
/// again before you drive away.* That is a question worth being asked once,
/// where re-walking still costs two minutes instead of a second visit.
///
/// The one instruction handled live is `turnOnLight`, and only because there
/// is now a control for it — see the torch in `ScanTorch`. Telling somebody
/// it is too dark is advice; lighting the button they can press is help.
struct ScanQuality {

    /// How many times each instruction fired. Counts, not a flag: being asked
    /// once to move closer while crossing a large room is normal, and being
    /// asked forty times is a room that was never in range.
    private(set) var instructionCounts: [String: Int] = [:]

    /// Walls RoomPlan itself marked `.low` confidence in the final room.
    ///
    /// This is the number that matters most, because it is the one that
    /// survives into the measurements — `ScanMiniMapView` already draws these
    /// dashed rather than solid, so the distinction was known and used, just
    /// never counted or reported.
    private(set) var lowConfidenceWalls = 0
    private(set) var totalWalls = 0

    mutating func record(_ instruction: RoomCaptureSession.Instruction) {
        instructionCounts[Self.name(instruction), default: 0] += 1
    }

    mutating func record(room: CapturedRoom) {
        totalWalls = room.walls.count
        lowConfidenceWalls = room.walls.filter { $0.confidence == .low }.count
    }

    static func name(_ instruction: RoomCaptureSession.Instruction) -> String {
        switch instruction {
        case .moveCloseToWall: return "moveCloseToWall"
        case .moveAwayFromWall: return "moveAwayFromWall"
        case .slowDown: return "slowDown"
        case .turnOnLight: return "turnOnLight"
        case .lowTexture: return "lowTexture"
        case .normal: return "normal"
        @unknown default: return "unknown"
        }
    }

    /// How often the operator was told they were out of range.
    var outOfRangePrompts: Int { instructionCounts["moveCloseToWall"] ?? 0 }

    /// Was this scan ever too dark to track well?
    var wasDark: Bool { (instructionCounts["turnOnLight"] ?? 0) > 0 }

    /// Is there anything here worth stopping the operator for?
    ///
    /// **The thresholds are ours and are deliberately not sensitive.** One
    /// "move closer" on the way across a big basement is how a scan of a big
    /// basement goes; a prompt that fires on every room is a prompt that gets
    /// dismissed without reading, which is worse than no prompt because it
    /// spends the operator's trust.
    var isWorthReporting: Bool {
        lowConfidenceWalls > 0 || outOfRangePrompts >= 8 || wasDark
    }

    /// One line for the log, and the raw material for whatever asks the
    /// operator about it later.
    var summary: String {
        var parts: [String] = ["SCANQUALITY: \(lowConfidenceWalls)/\(totalWalls) walls low confidence"]
        if outOfRangePrompts > 0 { parts.append("out-of-range prompts: \(outOfRangePrompts)") }
        if wasDark { parts.append("was told to turn on light") }
        let others = instructionCounts
            .filter { $0.key != "normal" }
            .sorted { $0.key < $1.key }
            .map { "\($0.key)=\($0.value)" }
        if !others.isEmpty { parts.append("[\(others.joined(separator: " "))]") }
        return parts.joined(separator: " · ")
    }
}
