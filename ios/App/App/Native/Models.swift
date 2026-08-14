import Foundation

/// The shapes the API actually returns.
///
/// Deliberately mirrors the JSON rather than tidying it: the database column
/// names come through as `floor_area_sqm`, and renaming them here would mean
/// two vocabularies for one field and a mapping layer to keep correct. Where a
/// name would be actively confusing in Swift, `CodingKeys` does the work and
/// the reason is written down.
///
/// Every measurement is METRES or SQUARE METRES, as stored. Feet are a
/// presentation concern and are converted at the edge, in `Measure`, never in
/// the model — the same rule the TypeScript side follows, so a figure cannot
/// disagree between the two halves of the app.

// MARK: - Health

struct Health: Decodable {
    let ok: Bool
    let diagnosis: String
    let env: Env
    let voice: Voice?
    let tables: [String: String]?

    /// Whether calling is configured. Separate from the database because it
    /// fails separately, and "error" on the dialer with no detail is the
    /// least useful report an app can give.
    struct Voice: Decodable {
        let configured: Bool
        let missing: [String]
    }

    struct Env: Decodable {
        let supabaseURL: Bool
        let supabaseServiceRoleKey: Bool
        let isConfigured: Bool

        enum CodingKeys: String, CodingKey {
            case supabaseURL = "SUPABASE_URL"
            case supabaseServiceRoleKey = "SUPABASE_SERVICE_ROLE_KEY"
            case isConfigured
        }
    }

    /// Which migrations are still to run, phrased as the API phrased them.
    var pending: [String] {
        (tables ?? [:])
            .filter { $0.value.hasPrefix("missing") }
            .map { "\($0.key): \($0.value)" }
            .sorted()
    }
}

// MARK: - Projects

struct ProjectListResponse: Decodable { let projects: [ProjectSummary] }

struct ProjectSummary: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let clientName: String?
    let roomCount: Int
}

// MARK: - Clients

struct ClientListResponse: Decodable { let clients: [ClientSummary] }

struct ClientSummary: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let company: String?
    /// The primary number, and every number. The dialer offers a choice when
    /// somebody has a mobile and a landline rather than guessing wrong.
    let phone: String?
    let phones: [Phone]
    let email: String?
    let propertyCount: Int

    struct Phone: Decodable, Hashable {
        let number: String
        let type: String
        let primary: Bool
    }
}

// MARK: - Estimates

struct QuoteListResponse: Decodable { let quotes: [QuoteSummary] }

struct QuoteSummary: Decodable, Identifiable, Hashable {
    let id: String
    let quoteNumber: Int
    let clientName: String
    let title: String?
    let status: String
    /// Cents, as stored. Formatting money in two places is how the figure on
    /// the phone ends up disagreeing with the one the customer was sent.
    let totalCents: Int
    let sentAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, status, title
        case quoteNumber = "quote_number"
        case clientName = "client_name"
        case totalCents = "total_cents"
        case sentAt = "sent_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        quoteNumber = (try? c.decode(Int.self, forKey: .quoteNumber)) ?? 0
        clientName = (try? c.decode(String.self, forKey: .clientName)) ?? "No client"
        title = try? c.decodeIfPresent(String.self, forKey: .title)
        status = (try? c.decode(String.self, forKey: .status)) ?? "draft"
        totalCents = (try? c.decode(Int.self, forKey: .totalCents)) ?? 0
        if let raw = try? c.decodeIfPresent(String.self, forKey: .sentAt) {
            sentAt = ISO8601.date(raw)
        } else {
            sentAt = nil
        }
    }

    /// Sent, and nobody has said yes or no. The only state on this screen
    /// that is a task rather than a record.
    var isAwaitingAnswer: Bool {
        ["sent", "viewed", "changes_requested"].contains(status)
    }

    /// Days since it went out — nil for a draft, which cannot be overdue for
    /// an answer nobody was asked for.
    var daysWaiting: Int? {
        guard let sentAt, isAwaitingAnswer else { return nil }
        return Calendar.current.dateComponents([.day], from: sentAt, to: Date()).day
    }

    var statusLabel: String {
        switch status {
        case "changes_requested": return "changes"
        case "converted": return "won"
        default: return status
        }
    }
}

// MARK: - Room scans

struct ScanListResponse: Decodable { let scans: [RoomScan] }

struct RoomScan: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let level: String
    let position: Int
    let floorAreaSqm: Double
    let wallLengthM: Double
    let ceilingHeightM: Double
    let doorCount: Int
    let windowCount: Int
    let stairCount: Int
    let planX: Double?
    let planY: Double?

    enum CodingKeys: String, CodingKey {
        case id, name, level, position
        case floorAreaSqm = "floor_area_sqm"
        case wallLengthM = "wall_length_m"
        case ceilingHeightM = "ceiling_height_m"
        case doorCount = "door_count"
        case windowCount = "window_count"
        case stairCount = "stair_count"
        case planX = "plan_x"
        case planY = "plan_y"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        level = try c.decode(String.self, forKey: .level)
        position = (try? c.decode(Int.self, forKey: .position)) ?? 0
        // Postgres numerics arrive as JSON numbers, but a value that has been
        // through a jsonb round trip can come back as a string. Decoding both
        // costs four lines and saves a screen that renders nothing.
        floorAreaSqm = try c.decodeFlexibleDouble(.floorAreaSqm)
        wallLengthM = try c.decodeFlexibleDouble(.wallLengthM)
        ceilingHeightM = try c.decodeFlexibleDouble(.ceilingHeightM)
        doorCount = (try? c.decode(Int.self, forKey: .doorCount)) ?? 0
        windowCount = (try? c.decode(Int.self, forKey: .windowCount)) ?? 0
        stairCount = (try? c.decode(Int.self, forKey: .stairCount)) ?? 0
        planX = try? c.decodeIfPresent(Double.self, forKey: .planX)
        planY = try? c.decodeIfPresent(Double.self, forKey: .planY)
    }
}

// MARK: - Affected areas

struct AreaListResponse: Decodable { let areas: [AffectedArea] }

struct AffectedArea: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let damageType: String
    let areaSqm: Double
    let surface: String

    enum CodingKeys: String, CodingKey {
        case id, name, surface
        case damageType = "damage_type"
        case areaSqm = "area_sqm"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = (try? c.decode(String.self, forKey: .name)) ?? "Affected area"
        surface = (try? c.decode(String.self, forKey: .surface)) ?? "floor"
        damageType = (try? c.decode(String.self, forKey: .damageType)) ?? "water"
        areaSqm = try c.decodeFlexibleDouble(.areaSqm)
    }

    /// The label and colour a cause is shown in, matching the web exactly —
    /// two apps that colour the same damage differently is a support call.
    var label: String {
        switch damageType {
        case "fire": return "Fire / smoke"
        case "mould": return "Mould"
        case "impact": return "Impact"
        case "other": return "Other"
        default: return "Water"
        }
    }
}

// MARK: - Drying log

struct MoistureListResponse: Decodable { let readings: [MoistureReading] }

struct MoistureReading: Decodable, Identifiable, Hashable {
    let id: String
    let takenAt: Date
    let location: String
    let material: String?
    /// Nullable throughout, on purpose. Instruments differ — a pin meter reads
    /// material moisture and nothing else — and a zero written for "not
    /// measured" is a fabricated reading sitting in a claim file.
    let materialPercent: Double?
    let relativeHumidity: Double?
    let temperatureC: Double?

    enum CodingKeys: String, CodingKey {
        case id, location, material
        case takenAt = "taken_at"
        case materialPercent = "material_percent"
        case relativeHumidity = "relative_humidity"
        case temperatureC = "temperature_c"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        location = (try? c.decode(String.self, forKey: .location)) ?? ""
        material = try? c.decodeIfPresent(String.self, forKey: .material)
        takenAt = ISO8601.date(try? c.decode(String.self, forKey: .takenAt))
        materialPercent = try c.decodeFlexibleOptionalDouble(.materialPercent)
        relativeHumidity = try c.decodeFlexibleOptionalDouble(.relativeHumidity)
        temperatureC = try c.decodeFlexibleOptionalDouble(.temperatureC)
    }
}

struct EquipmentListResponse: Decodable { let equipment: [EquipmentPlacement] }

struct EquipmentPlacement: Decodable, Identifiable, Hashable {
    let id: String
    let kind: String
    let quantity: Int
    let inServiceAt: Date
    let outOfServiceAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, kind, quantity
        case inServiceAt = "in_service_at"
        case outOfServiceAt = "out_of_service_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kind = (try? c.decode(String.self, forKey: .kind)) ?? "Equipment"
        quantity = (try? c.decode(Int.self, forKey: .quantity)) ?? 1
        inServiceAt = ISO8601.date(try? c.decode(String.self, forKey: .inServiceAt))
        if let raw = try? c.decodeIfPresent(String.self, forKey: .outOfServiceAt) {
            outOfServiceAt = ISO8601.date(raw)
        } else {
            outOfServiceAt = nil
        }
    }

    var isRunning: Bool { outOfServiceAt == nil }

    /// Billable unit-days. Both end days count — delivered Monday, collected
    /// Wednesday is three days — and equipment still on site counts to `asOf`,
    /// so a live job shows a growing number rather than a blank. This mirrors
    /// `unitDays` in dryingLog.ts exactly; the two must never disagree, since
    /// one of them ends up on an invoice.
    func unitDays(asOf: Date = Date()) -> Int {
        let end = outOfServiceAt ?? asOf
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        let start = cal.startOfDay(for: inServiceAt)
        let finish = cal.startOfDay(for: end)
        guard let days = cal.dateComponents([.day], from: start, to: finish).day, days >= 0 else {
            return 0
        }
        return (days + 1) * quantity
    }
}

// MARK: - Decoding helpers

private enum ISO8601 {
    /// Postgres timestamps arrive with or without fractional seconds
    /// depending on the column and the driver. One formatter that accepts
    /// neither variant is how a date silently becomes 1970.
    static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static let plain = ISO8601DateFormatter()

    static func date(_ raw: String?) -> Date {
        guard let raw else { return Date() }
        return withFraction.date(from: raw) ?? plain.date(from: raw) ?? Date()
    }
}

private extension KeyedDecodingContainer {
    /// Numerics that may arrive as a number or as a string.
    func decodeFlexibleDouble(_ key: Key) throws -> Double {
        if let value = try? decode(Double.self, forKey: key) { return value }
        if let text = try? decode(String.self, forKey: key), let value = Double(text) {
            return value
        }
        return 0
    }

    func decodeFlexibleOptionalDouble(_ key: Key) throws -> Double? {
        if let value = try? decodeIfPresent(Double.self, forKey: key) { return value }
        if let text = try? decodeIfPresent(String.self, forKey: key) {
            return Double(text)
        }
        return nil
    }
}

// MARK: - Units

/// Metres in, imperial out. One place, so a square-foot figure cannot
/// disagree between two screens.
enum Measure {
    static func squareFeet(_ squareMetres: Double) -> Double { squareMetres * 10.763_910_4 }
    static func feet(_ metres: Double) -> Double { metres / 0.3048 }

    static func sqftLabel(_ squareMetres: Double) -> String {
        "\(Int(squareFeet(squareMetres).rounded())) sq ft"
    }

    static func ftLabel(_ metres: Double) -> String {
        "\(Int(feet(metres).rounded())) ft"
    }
}
