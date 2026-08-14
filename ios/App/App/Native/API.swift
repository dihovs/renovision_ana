import CoreGraphics
import Foundation

/// Talks to the CRM's JSON API.
///
/// The whole reason this file exists: none of the app's writes were reachable
/// from native code, because every mutation in the web CRM is a Next.js Server
/// Action — a POST to the current page with an RSC-encoded body whose action
/// IDs are build-time hashes that change on every deploy. Swift cannot call
/// those. `/api/v1/*` is the ordinary JSON surface built alongside them, and
/// it is the only door native screens come through.
///
/// Auth is a cookie, exactly as in a browser. `adminAuth` sets `rv_admin` — an
/// HMAC of a fixed marker keyed by the admin password — and `URLSession` keeps
/// it in the shared cookie store, so signing in once here behaves the same way
/// signing in once in the WebView does. No token scheme was invented for
/// native; inventing one would have meant a second auth path to keep correct.
enum APIError: LocalizedError {
    case notSignedIn
    case offline
    /// The server answered but its database is missing a table — a migration
    /// has not been run yet. Distinct from a refusal: the request was fine,
    /// the server is not ready, and retrying after the SQL runs will work.
    case serverNotReady(String)
    case server(String)
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn:
            return "Signed out. Enter the admin password again."
        case .offline:
            return "No connection. This will work again when you have signal."
        case .serverNotReady(let message):
            return message
        case .server(let message):
            return message
        case .decoding(let detail):
            // Surfaced rather than swallowed: a shape mismatch between the API
            // and these models is a bug worth seeing on the device, not a
            // blank screen to guess about.
            return "The server sent something unexpected. \(detail)"
        }
    }
}

actor API {
    static let shared = API()

    /// The same deployment the WebView points at, so native and web screens
    /// are never looking at two different databases mid-migration.
    static let baseURL = URL(
        string: "https://renovision-ana-git-mobile-app-renovision-an-a.vercel.app")!

    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.httpShouldSetCookies = true
        config.httpCookieAcceptPolicy = .always
        // A phone in a basement should fail in seconds, not hang for a minute
        // holding a spinner over a screen the operator needs.
        config.timeoutIntervalForRequest = 20
        config.waitsForConnectivity = false
        self.session = URLSession(configuration: config)
    }

    // MARK: - Transport

    private func request(
        _ path: String,
        method: String = "GET",
        body: (some Encodable)? = Optional<String>.none
    ) async throws -> Data {
        guard let url = URL(string: path, relativeTo: Self.baseURL) else {
            throw APIError.server("Bad path: \(path)")
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch let error as URLError where error.isOffline {
            throw APIError.offline
        } catch {
            throw APIError.server(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.server("No response.")
        }

        // 401 is not an error to report — it is a state the UI reacts to by
        // showing the password screen, so it gets its own case.
        if http.statusCode == 401 { throw APIError.notSignedIn }

        if http.statusCode == 503 {
            if let pending = try? JSONDecoder().decode(PendingBody.self, from: data),
                pending.migrationPending == true {
                throw APIError.serverNotReady(
                    pending.error ?? "The server's database is missing a table.")
            }
        }

        guard (200..<300).contains(http.statusCode) else {
            // The API's own message is far more useful than the status code:
            // "An affected area needs at least three corners" beats "400".
            let body = try? JSONDecoder().decode(ErrorBody.self, from: data)
            var message = body?.error ?? "Request failed (\(http.statusCode))."
            if let missing = body?.missing, !missing.isEmpty {
                message += " Not set: \(missing.joined(separator: ", "))."
            }
            throw APIError.server(message)
        }

        return data
    }

    /// The API's error shape. `missing` is only sent by the voice-token
    /// route, and it is the single most useful field in the whole app when a
    /// call fails: the answer is almost always one unset variable, and
    /// "Calling is not configured" without saying which one sends somebody
    /// hunting through a dashboard.
    private struct PendingBody: Decodable {
        let error: String?
        let migrationPending: Bool?
    }

    private struct ErrorBody: Decodable {
        let error: String
        let missing: [String]?
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw APIError.decoding(String(describing: error).prefix(200).description)
        }
    }

    private func get<T: Decodable>(_ path: String, as type: T.Type) async throws -> T {
        try decode(type, from: try await request(path))
    }

    // MARK: - Session

    private struct AuthBody: Encodable { let password: String }
    private struct OK: Decodable { let ok: Bool? }

    /// Sign in with the admin password. The cookie that comes back is what
    /// every later call is authorised by; the password is never stored.
    func signIn(password: String) async throws {
        _ = try await request("/api/v1/auth", method: "POST", body: AuthBody(password: password))
    }

    /// Whether this device still holds a valid session, asked cheaply.
    func isSignedIn() async -> Bool {
        do {
            _ = try await request("/api/v1/health")
            return true
        } catch {
            return false
        }
    }

    // MARK: - Voice

    private struct VoiceToken: Decodable { let token: String; let identity: String }

    /// A short-lived Twilio access token. Outgoing-only by construction on the
    /// server — see accessToken.ts — and re-minted per call rather than held,
    /// since it expires within the hour and a stale one fails at the worst
    /// possible moment.
    func voiceToken() async throws -> String {
        try await get("/api/voice/token", as: VoiceToken.self).token
    }

    // MARK: - Clients

    func clients(search: String? = nil) async throws -> [ClientSummary] {
        var path = "/api/v1/clients"
        if let search, !search.isEmpty,
            let encoded = search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            path += "?search=\(encoded)"
        }
        return try await get(path, as: ClientListResponse.self).clients
    }

    // MARK: - Estimates

    func quotes() async throws -> [QuoteSummary] {
        try await get("/api/v1/quotes", as: QuoteListResponse.self).quotes
    }

    // MARK: - Creating

    private struct NewProject: Encodable {
        let name: String
        let clientId: String?
        let description: String?
    }

    func createProject(name: String, clientId: String?, description: String?) async throws -> String {
        struct Created: Decodable { let id: String }
        let data = try await request(
            "/api/v1/projects", method: "POST",
            body: NewProject(name: name, clientId: clientId, description: description))
        return try decode(Created.self, from: data).id
    }

    private struct NewClient: Encodable {
        let firstName: String
        let lastName: String
        let companyName: String
        let phone: String
        let email: String
    }

    func createClient(
        firstName: String, lastName: String, companyName: String, phone: String, email: String
    ) async throws -> String {
        struct Created: Decodable { let id: String }
        let data = try await request(
            "/api/v1/clients", method: "POST",
            body: NewClient(
                firstName: firstName, lastName: lastName, companyName: companyName,
                phone: phone, email: email))
        return try decode(Created.self, from: data).id
    }

    // MARK: - Dashboard

    func dashboard() async throws -> DashboardSummary {
        try await get("/api/v1/dashboard", as: DashboardSummary.self)
    }

    // MARK: - Calls

    func calls() async throws -> [CallRecord] {
        try await get("/api/v1/calls", as: CallListResponse.self).calls
    }

    // MARK: - Health

    func health() async throws -> Health {
        try await get("/api/v1/health", as: Health.self)
    }

    // MARK: - Projects

    func projects() async throws -> [ProjectSummary] {
        try await get("/api/v1/projects", as: ProjectListResponse.self).projects
    }

    // MARK: - Scans

    func scans(projectId: String) async throws -> [RoomScan] {
        let encoded = projectId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? projectId
        return try await get("/api/v1/scans?projectId=\(encoded)", as: ScanListResponse.self).scans
    }

    /// File a finished capture against a project.
    ///
    /// The measurements go up as taken. The server deliberately does not
    /// recompute them — it was not there — so what is sent here IS the record.
    func saveScan(_ upload: ScanUpload) async throws -> String {
        struct Created: Decodable { let id: String }
        let data = try await request("/api/v1/scans", method: "POST", body: upload)
        return try decode(Created.self, from: data).id
    }

    // MARK: - Affected areas

    func areas(roomScanId: String) async throws -> [AffectedArea] {
        let encoded = roomScanId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? roomScanId
        return try await get("/api/v1/areas?roomScanId=\(encoded)", as: AreaListResponse.self).areas
    }

    private struct NewArea: Encodable {
        struct Point: Encodable {
            let x: Double
            let y: Double
        }
        let roomScanId: String
        let name: String
        let damageType: String
        let polygon: [Point]
    }

    func createArea(roomScanId: String, name: String, damageType: String, polygon: [CGPoint])
        async throws -> String
    {
        struct Created: Decodable { let id: String }
        let data = try await request(
            "/api/v1/areas", method: "POST",
            body: NewArea(
                roomScanId: roomScanId, name: name, damageType: damageType,
                polygon: polygon.map { .init(x: Double($0.x), y: Double($0.y)) }))
        return try decode(Created.self, from: data).id
    }

    private struct NewReading: Encodable {
        let roomScanId: String
        let location: String
        let material: String?
        let materialPercent: Double?
        let relativeHumidity: Double?
        let temperatureC: Double?
    }

    func createReading(
        roomScanId: String, location: String, material: String?,
        materialPercent: Double?, relativeHumidity: Double?, temperatureC: Double?
    ) async throws -> String {
        struct Created: Decodable { let id: String }
        let data = try await request(
            "/api/v1/moisture", method: "POST",
            body: NewReading(
                roomScanId: roomScanId, location: location, material: material,
                materialPercent: materialPercent, relativeHumidity: relativeHumidity,
                temperatureC: temperatureC))
        return try decode(Created.self, from: data).id
    }

    // MARK: - Living area

    func livingArea(projectId: String) async throws -> LivingAreaResponse {
        let encoded = projectId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? projectId
        return try await get("/api/v1/living-area?projectId=\(encoded)", as: LivingAreaResponse.self)
    }

    private struct RoomTypePatch: Encodable {
        let roomType: String?
    }

    func setRoomType(roomId: String, type: String?) async throws {
        _ = try await request(
            "/api/v1/scans/\(roomId)", method: "PATCH", body: RoomTypePatch(roomType: type))
    }

    // MARK: - Schedule

    func visits() async throws -> [VisitSummary] {
        try await get("/api/v1/visits", as: VisitListResponse.self).visits
    }

    private struct VisitDone: Encodable { let completed: Bool }

    func setVisitDone(id: String, done: Bool) async throws {
        _ = try await request(
            "/api/v1/visits/\(id)", method: "PATCH", body: VisitDone(completed: done))
    }

    // MARK: - Leads

    func leads() async throws -> [LeadSummary] {
        try await get("/api/v1/leads", as: LeadListResponse.self).leads
    }

    private struct LeadPatch: Encodable {
        var opened: Bool?
        var status: String?
    }

    /// Record that a lead was looked at. Never advances status — reading is
    /// not working, and the store keeps the two separate on purpose.
    func touchLead(id: String) async throws {
        _ = try await request(
            "/api/v1/leads/\(id)", method: "PATCH", body: LeadPatch(opened: true, status: nil))
    }

    func setLeadStatus(id: String, status: String) async throws {
        _ = try await request(
            "/api/v1/leads/\(id)", method: "PATCH", body: LeadPatch(opened: nil, status: status))
    }

    // MARK: - Messages

    /// The path segment carries the number without its plus — the server
    /// rebuilds and validates it. One consistent stripping, or one customer
    /// becomes two threads.
    private func phoneSegment(_ phone: String) -> String {
        phone.filter(\.isNumber)
    }

    func conversations() async throws -> [SmsConversation] {
        try await get("/api/v1/messages", as: ConversationListResponse.self).conversations
    }

    func thread(phone: String) async throws -> SmsThreadResponse {
        try await get("/api/v1/messages/\(phoneSegment(phone))", as: SmsThreadResponse.self)
    }

    private struct SendSmsBody: Encodable {
        let body: String
        let locale: String
    }

    func sendSms(phone: String, body: String, locale: String = "fr") async throws -> SendSmsResponse {
        let data = try await request(
            "/api/v1/messages/\(phoneSegment(phone))", method: "POST",
            body: SendSmsBody(body: body, locale: locale))
        return try decode(SendSmsResponse.self, from: data)
    }

    // MARK: - Call log actions

    func deleteCall(id: String) async throws {
        _ = try await request("/api/v1/calls/\(id)", method: "DELETE", body: Optional<String>.none)
    }

    private struct AttachPhone: Encodable {
        let addPhone: String
        let type: String
    }

    /// "Add to Existing Contact" — a phones-only update on the server, so
    /// nothing else about the record can be clobbered from a call row.
    func attachPhone(clientId: String, number: String) async throws {
        _ = try await request(
            "/api/v1/clients/\(clientId)", method: "PATCH",
            body: AttachPhone(addPhone: number, type: "mobile"))
    }

    private struct EditedPlan: Encodable {
        struct Point: Encodable {
            let x: Double
            let y: Double
        }
        let editedPolygon: [Point]
        let lockedEdges: [Int]
        /// Openings placed by hand, in their editable edge-keyed form AND as
        /// the synthesized centre-plus-axis surfaces everything downstream
        /// already reads. Synthesized here, not on the server — the server
        /// does not recompute measurements, because it was not there.
        ///
        /// nil means "this save says nothing about openings" and the keys are
        /// left out of the JSON entirely, so a scanned room's DETECTED doors
        /// are never overwritten by a polygon correction. An empty array is a
        /// different statement: the operator removed the last one.
        let authoredOpenings: [ScanGeometry.AuthoredOpening]?
        let doors: [ScanGeometry.Surface]?
        let windows: [ScanGeometry.Surface]?
        let openings: [ScanGeometry.Surface]?
        let doorCount: Int?
        let windowCount: Int?
        let openingCount: Int?
    }

    /// Save a plan corrected by hand. The scan's own measurements are kept —
    /// the server files this beside them, never over them. Pass `openings`
    /// only for rooms whose openings are authored rather than detected.
    func saveEditedPlan(
        roomId: String, corners: [CGPoint], locked: [Int] = [],
        openings placed: [PlanEditing.WallOpening]? = nil, ceilingHeight: Double = 0
    ) async throws {
        let synthesized = placed.map {
            ScanGeometry.surfaces(
                for: $0, polygon: corners,
                // A room with no recorded ceiling still has to deduct
                // SOMETHING for a door; the builder's 8' is the least
                // surprising stand-in.
                ceilingHeight: ceilingHeight > 0 ? ceilingHeight : 2.44)
        }
        _ = try await request(
            "/api/v1/scans/\(roomId)", method: "PATCH",
            body: EditedPlan(
                editedPolygon: corners.map { .init(x: Double($0.x), y: Double($0.y)) },
                lockedEdges: locked,
                authoredOpenings: placed.map {
                    $0.map {
                        ScanGeometry.AuthoredOpening(
                            edge: $0.edge, offset: $0.offset, width: $0.width,
                            kind: $0.kind.rawValue)
                    }
                },
                doors: synthesized?.doors,
                windows: synthesized?.windows,
                openings: synthesized?.passages,
                doorCount: synthesized?.doors.count,
                windowCount: synthesized?.windows.count,
                openingCount: synthesized?.passages.count))
    }

    // MARK: - Photos

    func photos(roomScanId: String) async throws -> [RoomPhoto] {
        let encoded = roomScanId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? roomScanId
        return try await get("/api/v1/photos?roomScanId=\(encoded)", as: PhotoListResponse.self).photos
    }

    /// Upload one photo, multipart. Base64 JSON would inflate a 3 MB phone
    /// photo by a third on the connection that is already the bottleneck.
    func uploadPhoto(
        projectId: String, roomScanId: String?, affectedAreaId: String?, jpeg: Data, note: String?
    ) async throws -> String {
        guard let url = URL(string: "/api/v1/photos", relativeTo: Self.baseURL) else {
            throw APIError.server("Bad path.")
        }

        let boundary = "rv-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append(
                "Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n"
                    .data(using: .utf8)!)
        }
        field("projectId", projectId)
        if let roomScanId { field("roomScanId", roomScanId) }
        if let affectedAreaId { field("affectedAreaId", affectedAreaId) }
        if let note, !note.isEmpty { field("note", note) }

        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append(
            "Content-Disposition: form-data; name=\"file\"; filename=\"photo.jpg\"\r\n"
                .data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(jpeg)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body

        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIError.server("No response.") }
        if http.statusCode == 401 { throw APIError.notSignedIn }
        guard (200..<300).contains(http.statusCode) else {
            let bodyText = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            throw APIError.server(bodyText ?? "Upload failed (\(http.statusCode)).")
        }
        struct Created: Decodable { let id: String }
        return try decode(Created.self, from: data).id
    }

    // MARK: - Drying log

    func moisture(roomScanId: String) async throws -> [MoistureReading] {
        let encoded = roomScanId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? roomScanId
        return try await get(
            "/api/v1/moisture?roomScanId=\(encoded)", as: MoistureListResponse.self
        ).readings
    }

    private struct NewEquipment: Encodable {
        let projectId: String
        let kind: String
        let quantity: Int
    }

    func addEquipment(projectId: String, kind: String, quantity: Int) async throws {
        _ = try await request(
            "/api/v1/equipment", method: "POST",
            body: NewEquipment(projectId: projectId, kind: kind, quantity: quantity))
    }

    private struct Collect: Encodable { let outOfServiceAt: String }

    /// Stop the clock on a unit. The timestamp is minted here, now, because
    /// "collected" means this moment — a server default would also work, but
    /// an explicit time is one the operator watched happen.
    func collectEquipment(id: String) async throws {
        _ = try await request(
            "/api/v1/equipment/\(id)", method: "PATCH",
            body: Collect(outOfServiceAt: ISO8601DateFormatter().string(from: Date())))
    }

    func equipment(projectId: String) async throws -> [EquipmentPlacement] {
        let encoded = projectId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? projectId
        return try await get(
            "/api/v1/equipment?projectId=\(encoded)", as: EquipmentListResponse.self
        ).equipment
    }
}

private extension URLError {
    /// The several ways iOS says "there is no network right now", which are
    /// worth distinguishing from a server that answered with a refusal.
    var isOffline: Bool {
        [.notConnectedToInternet, .networkConnectionLost, .dataNotAllowed,
         .cannotConnectToHost, .cannotFindHost, .timedOut].contains(code)
    }
}
