import Foundation
import SwiftUI

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

struct ProjectListResponse: Decodable {
    let projects: [ProjectSummary]
    /// Names already assigned to something, for the assign sheet's
    /// suggestions. Sent with the list so opening that sheet needs no second
    /// request from a phone that may be standing in a basement.
    let assignees: [String]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        projects = try c.decode([ProjectSummary].self, forKey: .projects)
        assignees = (try? c.decodeIfPresent([String].self, forKey: .assignees)) as? [String] ?? []
    }

    enum CodingKeys: String, CodingKey { case projects, assignees }
}

struct ProjectSummary: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let clientName: String?
    let roomCount: Int
    /// The largest room's geometry, for the card's thumbnail. Optional
    /// because a project with nothing measured has no plan to show — and
    /// because an older server does not send it at all, which must degrade
    /// to a placeholder rather than a failed decode of the whole list.
    let largestRoom: ScanGeometry?
    /// Who the job was handed to, by name. There is no staff table by
    /// design — see migration 0035 — so this is the whole of the answer.
    let assignedTo: String?
    let favorite: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, clientName, roomCount, largestRoom, assignedTo, favorite
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        clientName = try c.decodeIfPresent(String.self, forKey: .clientName)
        roomCount = try c.decodeIfPresent(Int.self, forKey: .roomCount) ?? 0
        // A malformed geometry costs this card its thumbnail, never the list.
        largestRoom = try? c.decodeIfPresent(ScanGeometry.self, forKey: .largestRoom)
        // Both absent on a server older than migration 0035, which must read
        // as "unassigned, not starred" rather than failing the whole list.
        assignedTo = try? c.decodeIfPresent(String.self, forKey: .assignedTo)
        favorite = (try? c.decodeIfPresent(Bool.self, forKey: .favorite)) as? Bool ?? false
    }

    // Identity is the id. Synthesised conformance would have to hash the
    // geometry too, which is both expensive and wrong: the same project with a
    // redrawn plan is still the same project, and navigation compares these.
    static func == (a: ProjectSummary, b: ProjectSummary) -> Bool { a.id == b.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
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

// MARK: - Dashboard

/// The home screen's whole payload, aggregated server-side.
struct DashboardSummary: Decodable {
    struct Projects: Decodable {
        let active: Int
        let total: Int
        let roomsMeasured: Int
    }

    struct Estimates: Decodable {
        let awaiting: Int
        let awaitingCents: Int
    }

    struct Invoices: Decodable {
        let outstanding: Int
        let outstandingCents: Int
    }

    struct Equipment: Decodable {
        let running: Int
        let unitDays: Int
    }

    struct Visit: Decodable, Identifiable {
        let id: String
        let title: String?
        let startsAt: Date
        let done: Bool

        enum CodingKeys: String, CodingKey { case id, title, startsAt, done }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            title = try? c.decodeIfPresent(String.self, forKey: .title)
            startsAt = ISO8601.date(try? c.decode(String.self, forKey: .startsAt))
            done = (try? c.decode(Bool.self, forKey: .done)) ?? false
        }
    }

    let projects: Projects
    let estimates: Estimates
    let invoices: Invoices
    let equipment: Equipment
    let visits: [Visit]
    let missedCalls: Int

    /// Only the things that are a task. A figure needing no action belongs in
    /// the numbers, not in a list headed "needs you".
    var attentionItems: [Attention] {
        var items: [Attention] = []
        if missedCalls > 0 {
            items.append(
                Attention(
                    icon: "phone.badge.waveform",
                    title: "^[\(missedCalls) missed call](inflect: true) today",
                    detail: "Somebody rang the business line and did not get through.",
                    tone: .urgent))
        }
        if estimates.awaiting > 0 {
            items.append(
                Attention(
                    icon: "doc.text",
                    title: "^[\(estimates.awaiting) estimate](inflect: true) waiting",
                    detail: "\(Money.short(estimates.awaitingCents)) out for an answer.",
                    tone: .waiting))
        }
        if invoices.outstanding > 0 {
            items.append(
                Attention(
                    icon: "dollarsign.circle",
                    title: "^[\(invoices.outstanding) invoice](inflect: true) unpaid",
                    detail: "\(Money.short(invoices.outstandingCents)) outstanding.",
                    tone: .money))
        }
        if equipment.running > 0 {
            items.append(
                Attention(
                    icon: "wind",
                    title: "^[\(equipment.running) unit](inflect: true) still on site",
                    detail: "\(equipment.unitDays) unit-days billed so far. Collect what has finished.",
                    tone: .running))
        }
        return items
    }

    struct Attention: Identifiable {
        let id = UUID()
        let icon: String
        let title: String
        let detail: String
        /// What KIND of attention, not what colour. Models describe the
        /// business; the view decides how to draw it.
        let tone: Tone

        enum Tone { case urgent, waiting, money, running }
    }
}

/// Cents to a short dollar string, in one place.
enum Money {
    static func short(_ cents: Int) -> String {
        let value = Double(cents) / 100
        if value >= 10_000 {
            return "$\(Int(value / 1000))k"
        }
        return "$\(Int(value.rounded()))"
    }
}

// MARK: - Living area

struct LivingAreaResponse: Decodable {
    let totals: LivingAreaTotals
    let definition: String
    let roomTypes: [LivingRoomType]
}

struct LivingAreaTotals: Decodable {
    let aboveGradeSqm: Double
    let belowGradeSqm: Double
    let totalSqm: Double
    let excludedSqm: Double
    let rooms: [LivingAreaRoomResult]
}

struct LivingAreaRoomResult: Decodable, Identifiable {
    let id: String
    let name: String
    let countedSqm: Double
    let band: String
    let percentApplied: Double
    let belowMinHeight: Bool
}

struct LivingRoomType: Decodable, Identifiable, Hashable {
    let id: String
    let label: String
    let percent: Double
    let band: String
    let note: String?
}

// MARK: - Schedule

struct VisitListResponse: Decodable { let visits: [VisitSummary] }

struct VisitSummary: Decodable, Identifiable, Hashable {
    let id: String
    let jobId: String
    let title: String?
    let jobTitle: String?
    let jobNumber: Int?
    let clientName: String?
    let startsAt: Date
    let allDay: Bool
    let done: Bool
    let notes: String?

    /// What the row is called: the visit's own title first, then the job it
    /// belongs to, then the customer — never a bare id.
    var displayTitle: String {
        if let title, !title.isEmpty { return title }
        if let jobTitle, !jobTitle.isEmpty { return jobTitle }
        return clientName ?? "Visit"
    }

    enum CodingKeys: String, CodingKey {
        case id, jobId, title, jobTitle, jobNumber, clientName, startsAt, allDay, done, notes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        jobId = (try? c.decode(String.self, forKey: .jobId)) ?? ""
        title = try? c.decodeIfPresent(String.self, forKey: .title)
        jobTitle = try? c.decodeIfPresent(String.self, forKey: .jobTitle)
        jobNumber = try? c.decodeIfPresent(Int.self, forKey: .jobNumber)
        clientName = try? c.decodeIfPresent(String.self, forKey: .clientName)
        startsAt = ISO8601.date(try? c.decode(String.self, forKey: .startsAt))
        allDay = (try? c.decode(Bool.self, forKey: .allDay)) ?? false
        done = (try? c.decode(Bool.self, forKey: .done)) ?? false
        notes = try? c.decodeIfPresent(String.self, forKey: .notes)
    }
}

// MARK: - Leads

struct LeadListResponse: Decodable { let leads: [LeadSummary] }

struct LeadSummary: Decodable, Identifiable, Hashable {
    let id: String
    let createdAt: Date
    let name: String
    let phone: String
    let email: String
    let address: String?
    let status: String
    let source: String
    let isEmergency: Bool
    let scopeSummary: String?
    let estimateExpected: String?
    /// Real stored read state — opened_at in the lead store — unlike SMS,
    /// where no such state exists and none is invented.
    let unopened: Bool
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case id, createdAt, name, phone, email, address, status, source,
            isEmergency, scopeSummary, estimateExpected, unopened, notes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        createdAt = ISO8601.date(try? c.decode(String.self, forKey: .createdAt))
        name = (try? c.decode(String.self, forKey: .name)) ?? ""
        phone = (try? c.decode(String.self, forKey: .phone)) ?? ""
        email = (try? c.decode(String.self, forKey: .email)) ?? ""
        address = try? c.decodeIfPresent(String.self, forKey: .address)
        status = (try? c.decode(String.self, forKey: .status)) ?? "new"
        source = (try? c.decode(String.self, forKey: .source)) ?? "website"
        isEmergency = (try? c.decode(Bool.self, forKey: .isEmergency)) ?? false
        scopeSummary = try? c.decodeIfPresent(String.self, forKey: .scopeSummary)
        estimateExpected = try? c.decodeIfPresent(String.self, forKey: .estimateExpected)
        unopened = (try? c.decode(Bool.self, forKey: .unopened)) ?? false
        notes = try? c.decodeIfPresent(String.self, forKey: .notes)
    }
}

// MARK: - Messages

struct ConversationListResponse: Decodable { let conversations: [SmsConversation] }

/// One texting relationship. There is no thread table anywhere — the E.164
/// number IS the identity, which is why this has no separate id.
struct SmsConversation: Decodable, Identifiable, Hashable {
    let phone: String
    let clientId: String?
    let clientName: String?
    let lastBody: String
    let lastDirection: String
    let lastAt: Date
    /// Newest message is theirs — the only "needs attention" state that
    /// exists. There is no read/unread anywhere, and inventing one here
    /// would show badges the web inbox cannot see.
    let awaitingReply: Bool
    let lastFailed: Bool
    let messageCount: Int
    let optedOut: Bool

    var id: String { phone }

    enum CodingKeys: String, CodingKey {
        case phone, clientId, clientName, lastBody, lastDirection, lastAt,
            awaitingReply, lastFailed, messageCount, optedOut
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        phone = try c.decode(String.self, forKey: .phone)
        clientId = try? c.decodeIfPresent(String.self, forKey: .clientId)
        clientName = try? c.decodeIfPresent(String.self, forKey: .clientName)
        lastBody = (try? c.decode(String.self, forKey: .lastBody)) ?? ""
        lastDirection = (try? c.decode(String.self, forKey: .lastDirection)) ?? "inbound"
        lastAt = ISO8601.date(try? c.decode(String.self, forKey: .lastAt))
        awaitingReply = (try? c.decode(Bool.self, forKey: .awaitingReply)) ?? false
        lastFailed = (try? c.decode(Bool.self, forKey: .lastFailed)) ?? false
        messageCount = (try? c.decode(Int.self, forKey: .messageCount)) ?? 0
        optedOut = (try? c.decode(Bool.self, forKey: .optedOut)) ?? false
    }
}

struct SmsThreadResponse: Decodable {
    let phone: String
    let client: AttributedClient?
    let optedOut: Bool
    let messages: [SmsMessage]

    struct AttributedClient: Decodable {
        let id: String
        let name: String
    }
}

struct SmsMessage: Decodable, Identifiable, Hashable {
    let id: String
    let direction: String
    let body: String
    /// "queued", "failed" or "received" — nothing else exists. There are no
    /// delivery receipts, so a "delivered" tick would be fabricated data.
    let status: String
    let error: String?
    let createdAt: Date

    var isOutbound: Bool { direction == "outbound" }

    enum CodingKeys: String, CodingKey { case id, direction, body, status, error, createdAt }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        direction = (try? c.decode(String.self, forKey: .direction)) ?? "inbound"
        body = (try? c.decode(String.self, forKey: .body)) ?? ""
        status = (try? c.decode(String.self, forKey: .status)) ?? "received"
        error = try? c.decodeIfPresent(String.self, forKey: .error)
        createdAt = ISO8601.date(try? c.decode(String.self, forKey: .createdAt))
    }
}

struct SendSmsResponse: Decodable {
    let sent: Bool
    let sid: String?
    let reason: String?
    /// The owner-readable sentence, mapped server-side to match the web
    /// inbox word for word. Show verbatim.
    let message: String?
}

// MARK: - Photos

struct PhotoListResponse: Decodable { let photos: [RoomPhoto] }

struct RoomPhoto: Decodable, Identifiable, Hashable {
    let id: String
    let filename: String
    let note: String?
    /// Signed per request and short-lived — never cache this across launches.
    let url: String?
}

// MARK: - Calls

struct CallListResponse: Decodable { let calls: [CallRecord] }

struct CallRecord: Decodable, Identifiable, Hashable {
    let id: String
    let fromNumber: String?
    let toNumber: String?
    let status: String
    let startedAt: Date
    let durationSeconds: Int?
    let answered: Bool
    let escalated: Bool

    enum CodingKeys: String, CodingKey {
        case id, status, answered, escalated
        case fromNumber, toNumber, startedAt, durationSeconds
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        fromNumber = try? c.decodeIfPresent(String.self, forKey: .fromNumber)
        toNumber = try? c.decodeIfPresent(String.self, forKey: .toNumber)
        status = (try? c.decode(String.self, forKey: .status)) ?? "completed"
        startedAt = ISO8601.date(try? c.decode(String.self, forKey: .startedAt))
        durationSeconds = try? c.decodeIfPresent(Int.self, forKey: .durationSeconds)
        answered = (try? c.decode(Bool.self, forKey: .answered)) ?? false
        escalated = (try? c.decode(Bool.self, forKey: .escalated)) ?? false
    }

    /// The number that is not ours. Every row in this log is a call involving
    /// the business line, so the useful half is the other party — showing our
    /// own number back to us would make every row look identical.
    var otherNumber: String {
        fromNumber ?? toNumber ?? "Unknown"
    }

    var icon: String {
        if !answered { return "phone.arrow.down.left" }
        return "phone.arrow.down.left"
    }

    var lengthLabel: String? {
        guard let seconds = durationSeconds, seconds > 0 else { return nil }
        return seconds < 60 ? "\(seconds)s" : "\(seconds / 60)m \(seconds % 60)s"
    }
}

// MARK: - Room scans

struct ScanListResponse: Decodable { let scans: [RoomScan] }

struct RoomScan: Decodable, Identifiable, Hashable {
    let id: String
    let projectId: String?
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
    /// The measurement blob, decoded. Optional because an old row saved
    /// before a field existed must still list, just without a drawing.
    let geometry: ScanGeometry?
    /// Bedroom, basement, garage… drives what counts as living area.
    let roomType: String?
    /// Hand-set 0-100 override. nil means "use the type's default", which is
    /// a different statement from zero.
    let livingPercent: Double?
    /// A hex colour for this room on the floor plan, separate from any
    /// damage colouring inside it. nil draws the plan's ordinary grey.
    let roomColor: String?

    enum CodingKeys: String, CodingKey {
        case id, name, level, position, geometry
        case roomType = "room_type"
        case livingPercent = "living_percent"
        case roomColor = "room_color"
        case projectId = "project_id"
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
        projectId = try? c.decodeIfPresent(String.self, forKey: .projectId)
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
        geometry = try? c.decodeIfPresent(ScanGeometry.self, forKey: .geometry)
        roomType = try? c.decodeIfPresent(String.self, forKey: .roomType)
        livingPercent = try? c.decodeIfPresent(Double.self, forKey: .livingPercent)
        roomColor = try? c.decodeIfPresent(String.self, forKey: .roomColor)
    }

    // Identity is the id, not the wall coordinates. Synthesising Hashable
    // over the whole geometry would mean hashing several hundred doubles on
    // every navigation comparison, and two rows with the same id ARE the same
    // room whatever the measurements say.
    static func == (a: RoomScan, b: RoomScan) -> Bool { a.id == b.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    /// The parsed plan colour, or nil to fall back to the plan's own grey.
    /// Same parse as `AffectedArea.displayColor` — a malformed or missing
    /// value degrades to no colour rather than a crash or a black room.
    var displayColor: Color? {
        guard let hex = roomColor?.trimmingCharacters(in: .whitespaces),
            hex.hasPrefix("#"), hex.count == 7,
            let value = UInt32(hex.dropFirst(), radix: 16)
        else { return nil }
        return Color(hex: value)
    }
}

// MARK: - Affected areas

/// The five causes an affected area can carry, and the colour each draws in.
///
/// ONE table, matching `src/lib/crm/areaShapes.ts` exactly — `DAMAGE_TYPES`
/// is the order (which is the order they are offered in), `DAMAGE_LABEL` the
/// wording, `DAMAGE_COLOR` the hex. This existed as two private tables of UI
/// constants, one in `FloorPlanView` and one in `RoomDetailView`, and a
/// duplicated colour table is a colour table that drifts. The same damage
/// showing in a different colour on the phone and on the web is a support
/// call, and the web is the side the adjuster reads.
///
/// The spelling is `mould`. That is the `damage_type` check constraint's
/// spelling in `0025_affected_areas.sql` and the vocabulary the rest of the
/// claim uses; `mold` would be refused by the database.
enum DamageCause: String, CaseIterable, Identifiable {
    case water, fire, mould, impact, other

    var id: String { rawValue }

    /// `DAMAGE_LABEL`.
    var label: String {
        switch self {
        case .water: return "Water"
        case .fire: return "Fire / smoke"
        case .mould: return "Mould"
        case .impact: return "Impact"
        case .other: return "Other"
        }
    }

    /// `DAMAGE_COLOR`, the same six digits.
    var hex: UInt32 {
        switch self {
        case .water: return 0x2B7FD4
        case .fire: return 0xE2673A
        case .mould: return 0x4F9D3A
        case .impact: return 0x8A63D2
        case .other: return 0x8A8A8E
        }
    }

    var color: Color { Color(hex: hex) }

    /// The `#rrggbb` the `color` column stores, lower case, so a colour
    /// written from the phone is byte-identical to one written from the web.
    var hexString: String { String(format: "#%06x", hex) }

    /// An unrecognised cause reads as water rather than throwing.
    /// `damage_type` is constrained in the database, so anything unfamiliar
    /// arrived from a vocabulary newer than this build — and water is the one
    /// this trade meets most.
    static func named(_ raw: String?) -> DamageCause {
        DamageCause(rawValue: raw ?? "") ?? .water
    }
}

struct AreaListResponse: Decodable { let areas: [AffectedArea] }

struct AffectedArea: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let damageType: String
    let areaSqm: Double
    /// `floor` or `wall`. Not decoration: a wet floor and a mouldy wall are
    /// different trades at different rates, they overlap in plan, and — see
    /// `polygon` — their shapes are not even in the same coordinate space.
    let surface: String
    /// Which wall a wall area sits on, indexed into the room polygon's edges
    /// exactly as `PlanEditing.WallOpening.edge` is. Nil for a floor area;
    /// the database constrains the pair both ways, so a wall area always has
    /// one and a floor area never does.
    let wallIndex: Int?
    /// An override colour, when one was chosen. Nil means "use the cause's
    /// default", which is what lets a category be recoloured later without
    /// orphaning every old area on a stale hex.
    let color: String?
    /// The shape, in metres — but in WHICH metres depends on `surface`.
    ///
    /// A floor area is in the plan's own space, the same one the walls are
    /// drawn in, so it needs no transform to line up with the room. A wall
    /// area is in its wall's FACE space: x along the wall from the edge's
    /// start corner, y above the floor. `ElevationView` documents that space
    /// in full; the short version is that the two must never be drawn with
    /// the same renderer.
    let polygon: [Point]
    /// A free-text note against this area — separate from the room's own
    /// notes, since "the drywall was already cut back here" is a fact about
    /// the region, not the room.
    let notes: String?
    /// Whether this area's width/height print on the wall elevation. Off by
    /// default: most areas mark WHERE damage is, not what it measures.
    let showDimensions: Bool

    struct Point: Decodable, Hashable {
        let x: Double
        let y: Double
    }

    enum CodingKeys: String, CodingKey {
        case id, name, surface, polygon, color, notes
        case wallIndex = "wall_index"
        case damageType = "damage_type"
        case areaSqm = "area_sqm"
        case showDimensions = "show_dimensions"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = (try? c.decode(String.self, forKey: .name)) ?? "Affected area"
        surface = (try? c.decode(String.self, forKey: .surface)) ?? "floor"
        wallIndex = try? c.decodeIfPresent(Int.self, forKey: .wallIndex)
        color = try? c.decodeIfPresent(String.self, forKey: .color)
        damageType = (try? c.decode(String.self, forKey: .damageType)) ?? "water"
        areaSqm = try c.decodeFlexibleDouble(.areaSqm)
        polygon = (try? c.decodeIfPresent([Point].self, forKey: .polygon)) ?? []
        notes = try? c.decodeIfPresent(String.self, forKey: .notes)
        showDimensions = (try? c.decode(Bool.self, forKey: .showDimensions)) ?? false
    }

    var cause: DamageCause { DamageCause.named(damageType) }

    var label: String { cause.label }

    var isWall: Bool { surface == "wall" }

    /// What it is drawn in: its own override, else its cause's default.
    /// `areaColor()` in `areaShapes.ts`, to the digit.
    var displayColor: Color {
        if let override = color?.trimmingCharacters(in: .whitespaces),
            override.hasPrefix("#"), override.count == 7,
            let value = UInt32(override.dropFirst(), radix: 16)
        {
            return Color(hex: value)
        }
        return cause.color
    }
}

// MARK: - Wall details

struct WallListResponse: Decodable { let walls: [RoomWall] }

/// A wall's own fields — object-model §2b. A wall has no id of its own; it
/// is edge N of the room's polygon, the same indexing `AffectedArea
/// .wallIndex` uses, so a wall nobody has touched simply has no row and this
/// never arrives for it. Callers default to `false`/`nil` for that case,
/// same as the server does.
struct RoomWall: Decodable, Hashable {
    let wallIndex: Int
    let loadBearing: Bool
    let displayElevation: Bool
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case wallIndex = "wall_index"
        case loadBearing = "load_bearing"
        case displayElevation = "display_elevation"
        case notes
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

    static func cubicFeet(_ cubicMetres: Double) -> Double { cubicMetres * 35.314_666_7 }

    /// Cubic feet, for the volume a dehumidifier is sized from. Rounded to a
    /// whole foot like the others — S500 sizing works in hundreds of cubic
    /// feet, so a decimal here would imply a precision the ceiling height
    /// does not have.
    static func cuftLabel(_ cubicMetres: Double) -> String {
        "\(Int(cubicFeet(cubicMetres).rounded())) cu ft"
    }
}
