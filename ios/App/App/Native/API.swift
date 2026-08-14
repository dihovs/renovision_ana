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
    case server(String)
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn:
            return "Signed out. Enter the admin password again."
        case .offline:
            return "No connection. This will work again when you have signal."
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

        guard (200..<300).contains(http.statusCode) else {
            // The API's own message is far more useful than the status code:
            // "An affected area needs at least three corners" beats "400".
            let message =
                (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
                ?? "Request failed (\(http.statusCode))."
            throw APIError.server(message)
        }

        return data
    }

    private struct ErrorBody: Decodable { let error: String }

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

    // MARK: - Affected areas

    func areas(roomScanId: String) async throws -> [AffectedArea] {
        let encoded = roomScanId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? roomScanId
        return try await get("/api/v1/areas?roomScanId=\(encoded)", as: AreaListResponse.self).areas
    }

    // MARK: - Drying log

    func moisture(roomScanId: String) async throws -> [MoistureReading] {
        let encoded = roomScanId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? roomScanId
        return try await get(
            "/api/v1/moisture?roomScanId=\(encoded)", as: MoistureListResponse.self
        ).readings
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
