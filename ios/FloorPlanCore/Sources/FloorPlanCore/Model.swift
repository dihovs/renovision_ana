import Foundation

// The data model of the floor-plan spec (§3), as written there.
//
// Conventions (§1), held everywhere in this package:
// - SI metres, stored as Double. Imperial is a display concern only.
// - The plan is the X/Y plane, Y up; Z is height.
// - Polygons are COUNTER-CLOCKWISE, so the signed shoelace area is positive.
// - Wall i runs from corner i to corner (i+1) mod n; the room is on its left.

public typealias Meters = Double

public struct Vec2: Codable, Hashable, Sendable {
    public var x: Meters
    public var y: Meters
    public init(_ x: Meters, _ y: Meters) {
        self.x = x
        self.y = y
    }
    public init(x: Meters, y: Meters) { self.init(x, y) }

    public static func + (a: Vec2, b: Vec2) -> Vec2 { Vec2(a.x + b.x, a.y + b.y) }
    public static func - (a: Vec2, b: Vec2) -> Vec2 { Vec2(a.x - b.x, a.y - b.y) }
    public static func * (a: Vec2, k: Double) -> Vec2 { Vec2(a.x * k, a.y * k) }

    public var length: Meters { (x * x + y * y).squareRoot() }
    public func distance(to other: Vec2) -> Meters { (self - other).length }
    public func dot(_ o: Vec2) -> Double { x * o.x + y * o.y }
    /// The z of the 3D cross product: positive when `o` turns left of `self`.
    public func cross(_ o: Vec2) -> Double { x * o.y - y * o.x }
}

public enum UnitSystem: String, Codable, Sendable { case metric, imperial }

public struct Project: Codable, Identifiable, Sendable {
    public let id: UUID
    public var name: String
    public var address: String?
    public var floors: [Floor]
    public var displayUnits: UnitSystem
    public var createdAt: Date

    public init(
        id: UUID = UUID(), name: String, address: String? = nil, floors: [Floor] = [],
        displayUnits: UnitSystem = .imperial, createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.address = address
        self.floors = floors
        self.displayUnits = displayUnits
        self.createdAt = createdAt
    }
}

public struct Floor: Codable, Identifiable, Sendable {
    public let id: UUID
    public var name: String
    public var level: Int
    /// Finished-floor Z relative to level 0.
    public var elevation: Meters
    public var rooms: [Room]

    public init(id: UUID = UUID(), name: String, level: Int, elevation: Meters = 0, rooms: [Room] = []) {
        self.id = id
        self.name = name
        self.level = level
        self.elevation = elevation
        self.rooms = rooms
    }
}

public struct Room: Codable, Identifiable, Sendable {
    public let id: UUID
    public var name: String
    /// Counter-clockwise, closed implicitly (last → first).
    public var corners: [Corner]
    /// `walls[i]` runs `corners[i] → corners[(i+1) % n]`; one wall per corner.
    public var walls: [Wall]
    public var openings: [Opening]
    public var ceiling: CeilingProfile
    /// Room → floor transform.
    public var origin: Vec2
    /// Radians.
    public var rotation: Double
    public var isClosed: Bool

    public init(
        id: UUID = UUID(), name: String, corners: [Corner], walls: [Wall]? = nil,
        openings: [Opening] = [], ceiling: CeilingProfile = .flat(height: 2.44),
        origin: Vec2 = Vec2(0, 0), rotation: Double = 0, isClosed: Bool = true
    ) {
        self.id = id
        self.name = name
        self.corners = corners
        self.walls = walls ?? corners.map { _ in Wall() }
        self.openings = openings
        self.ceiling = ceiling
        self.origin = origin
        self.rotation = rotation
        self.isClosed = isClosed
    }

    /// The corner positions, in order.
    public var points: [Vec2] { corners.map(\.p) }
}

public struct Corner: Codable, Identifiable, Sendable {
    public let id: UUID
    /// Room-local.
    public var p: Vec2
    public var angleLocked: Bool
    /// Interior angle, radians.
    public var lockedAngle: Double?

    public init(id: UUID = UUID(), p: Vec2, angleLocked: Bool = false, lockedAngle: Double? = nil) {
        self.id = id
        self.p = p
        self.angleLocked = angleLocked
        self.lockedAngle = lockedAngle
    }
}

public enum WallShape: Codable, Sendable, Equatable {
    case straight
    /// Positive sagitta bulges OUTWARD — to the right of the wall's direction.
    case arc(sagitta: Meters)
}

public struct WallRef: Codable, Hashable, Sendable {
    public var roomID: UUID
    public var wallID: UUID
    public init(roomID: UUID, wallID: UUID) {
        self.roomID = roomID
        self.wallID = wallID
    }
}

public enum LengthSource: Codable, Hashable, Sendable {
    case drawn, ar, typed
    case laser(deviceID: String)
}

public struct Wall: Codable, Identifiable, Sendable {
    public let id: UUID
    public var shape: WallShape
    /// The chord length, when locked.
    public var lockedLength: Meters?
    public var thickness: Meters
    /// The coincident wall in another room.
    public var sharedWith: WallRef?
    public var lengthSource: LengthSource

    public init(
        id: UUID = UUID(), shape: WallShape = .straight, lockedLength: Meters? = nil,
        thickness: Meters = 0.12, sharedWith: WallRef? = nil, lengthSource: LengthSource = .drawn
    ) {
        self.id = id
        self.shape = shape
        self.lockedLength = lockedLength
        self.thickness = thickness
        self.sharedWith = sharedWith
        self.lengthSource = lengthSource
    }
}

public enum OpeningKind: String, Codable, Sendable { case door, window, opening, slidingDoor, garageDoor }

public enum Swing: String, Codable, Sendable { case leftIn, leftOut, rightIn, rightOut }

public struct Opening: Codable, Identifiable, Sendable {
    public let id: UUID
    public var wallID: UUID
    public var kind: OpeningKind
    /// From the wall's start to the opening's near edge, along the chord.
    public var offset: Meters
    public var width: Meters
    public var height: Meters
    /// 0 for doors.
    public var sillHeight: Meters
    public var swing: Swing?

    public init(
        id: UUID = UUID(), wallID: UUID, kind: OpeningKind, offset: Meters, width: Meters,
        height: Meters, sillHeight: Meters = 0, swing: Swing? = nil
    ) {
        self.id = id
        self.wallID = wallID
        self.kind = kind
        self.offset = offset
        self.width = width
        self.height = height
        self.sillHeight = sillHeight
        self.swing = swing
    }
}

/// The ridge of a vaulted ceiling, as a line through two plan points. The
/// spec shows a tuple for brevity and asks for a small Codable struct.
public struct RidgeAxis: Codable, Hashable, Sendable {
    public var a: Vec2
    public var b: Vec2
    public init(a: Vec2, b: Vec2) {
        self.a = a
        self.b = b
    }
}

public struct HeightZone: Codable, Sendable {
    public var polygon: [Vec2]
    public var height: Meters
    public init(polygon: [Vec2], height: Meters) {
        self.polygon = polygon
        self.height = height
    }
}

public enum CeilingProfile: Codable, Sendable {
    case flat(height: Meters)
    /// A plane; the low wall and the high wall are opposite each other.
    case sloped(lowHeight: Meters, highHeight: Meters, lowWallID: UUID, highWallID: UUID)
    /// Two planes meeting at the ridge.
    case vaulted(eaveHeight: Meters, ridgeHeight: Meters, ridgeAxis: RidgeAxis)
    /// Multi-height: each zone is a sub-polygon with its own flat height.
    case zones([HeightZone])
}
