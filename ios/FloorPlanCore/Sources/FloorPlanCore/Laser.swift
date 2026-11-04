import Foundation

/// Laser-meter readings, and where they go (spec §13, M9, T14).
///
/// The Bluetooth side lives in the app (CoreBluetooth cannot be tested on
/// the Mac); this is everything that can: what a reading IS, whether it is
/// believable, and what it does to a room.
public struct LaserReading: Codable, Equatable, Sendable, Identifiable {
    public let id: UUID
    public let meters: Meters
    public let deviceID: String
    public let at: Date

    public init(id: UUID = UUID(), meters: Meters, deviceID: String, at: Date = Date()) {
        self.id = id
        self.meters = meters
        self.deviceID = deviceID
        self.at = at
    }
}

/// How a meter's notify payload becomes metres. Each driver says which.
public enum LaserPayload: Sendable {
    /// Little-endian Float32, metres.
    case float32Meters(offset: Int)
    /// Little-endian Float32 in the unit named by a units byte.
    case float32WithUnit(offset: Int, unitOffset: Int)
    /// Little-endian unsigned integer millimetres, 2 or 4 bytes.
    case intMillimeters(offset: Int, bytes: Int)

    /// Metres, or nil when the payload is short or the value is not a
    /// believable distance (§13: refuse ≤ 0 or > 200 m).
    public func meters(from data: [UInt8], unitScale: (UInt8) -> Double? = LaserPayload.defaultUnit) -> Meters? {
        func le(_ o: Int, _ n: Int) -> UInt64? {
            guard o >= 0, o + n <= data.count else { return nil }
            var v: UInt64 = 0
            for k in (0..<n).reversed() { v = (v << 8) | UInt64(data[o + k]) }
            return v
        }
        let value: Double?
        switch self {
        case .float32Meters(let o):
            value = le(o, 4).map { Double(Float(bitPattern: UInt32($0))) }
        case .float32WithUnit(let o, let u):
            guard u < data.count, let scale = unitScale(data[u]) else { return nil }
            value = le(o, 4).map { Double(Float(bitPattern: UInt32($0))) * scale }
        case .intMillimeters(let o, let n):
            value = le(o, n).map { Double($0) / 1000 }
        }
        return value.flatMap(Laser.validated)
    }

    /// 0 metres, 1 feet, 2 inches, 3 millimetres — the common encoding; a
    /// driver whose meter differs supplies its own.
    public static func defaultUnit(_ byte: UInt8) -> Double? {
        switch byte {
        case 0: return 1
        case 1: return 0.3048
        case 2: return 0.0254
        case 3: return 0.001
        default: return nil
        }
    }
}

public enum Laser {
    /// §13: a reading ≤ 0 or > 200 m is not a distance, it is noise.
    public static func validated(_ m: Double) -> Meters? {
        m.isFinite && m > 0 && m <= 200 ? m : nil
    }
}

/// Readings landing on walls (§13 "Assignment").
///
/// A reading goes to the SELECTED wall: it sets that wall's locked length
/// and source, and the selection moves on to the next wall counter-clockwise
/// — so measuring a room is aim, fire, aim, fire, round the room. A reading
/// with nothing selected waits in a tray to be put on a wall by hand. Every
/// step can be undone.
public struct LaserAssignment: Sendable {
    public private(set) var room: Room
    /// The wall the next reading lands on, nil when none is selected.
    public var selected: Int?
    public private(set) var pending: [LaserReading] = []
    private var history: [(Room, Int?, [LaserReading])] = []

    public init(room: Room, selected: Int? = nil) {
        self.room = room
        self.selected = selected
    }

    /// A reading from the meter.
    public mutating func receive(_ reading: LaserReading) {
        guard Laser.validated(reading.meters) != nil else { return }
        guard let wall = selected, room.walls.indices.contains(wall) else {
            history.append((room, selected, pending))
            pending.append(reading)
            return
        }
        assign(reading, to: wall)
    }

    /// A reading from the tray, put on a wall by hand.
    public mutating func place(_ readingID: UUID, on wall: Int) {
        guard let i = pending.firstIndex(where: { $0.id == readingID }), room.walls.indices.contains(wall)
        else { return }
        let reading = pending[i]
        history.append((room, selected, pending))
        pending.remove(at: i)
        lock(reading, wall)
        selected = (wall + 1) % room.walls.count
    }

    public mutating func undo() {
        guard let last = history.popLast() else { return }
        (room, selected, pending) = last
    }

    public var canUndo: Bool { !history.isEmpty }

    private mutating func assign(_ reading: LaserReading, to wall: Int) {
        history.append((room, selected, pending))
        lock(reading, wall)
        // Next wall counter-clockwise: rooms are stored CCW (§1), so +1.
        selected = (wall + 1) % room.walls.count
    }

    private mutating func lock(_ reading: LaserReading, _ wall: Int) {
        room.walls[wall].lockedLength = reading.meters
        room.walls[wall].lengthSource = .laser(deviceID: reading.deviceID)
    }
}
