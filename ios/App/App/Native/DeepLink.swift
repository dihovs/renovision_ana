import Foundation
import UserNotifications

/// Where a tapped notification should land.
///
/// The owner, 27 Aug 2026, on the first push that ever reached his phone:
/// "when I click on the banner, it just opened the app. I wanted to open the
/// app and go directly to the messages." A notification that only launches the
/// app makes him do the search he was just told the answer to.
///
/// The server has been sending the destination all along — `notifyNewMessage`
/// puts `/admin/messages/<phone>` in the payload, `notifyNewLead` puts
/// `/admin/leads` — and nothing on the phone read it. There was no
/// `UNUserNotificationCenterDelegate` at all, so iOS did the default thing:
/// foreground the app and stop.
///
/// Paths are matched rather than trusted. They arrive from the network, and
/// the set of screens worth opening from a banner is small and known; an
/// unrecognised path opens the app and nothing else, which is what used to
/// happen every time anyway.
@MainActor
final class DeepLink: ObservableObject {
    static let shared = DeepLink()

    enum Destination: Identifiable, Hashable {
        /// A conversation, addressed by the number in E.164 with the `+` back
        /// on. The web route drops it — see `notifyNewMessage` — and
        /// `MessageThreadView` wants it, so this is where it goes back.
        case messageThread(phone: String)
        case leads

        var id: String {
            switch self {
            case .messageThread(let phone): return "thread:\(phone)"
            case .leads: return "leads"
            }
        }
    }

    /// Set when a notification is tapped, cleared when the screen it asked for
    /// closes. `@Published` rather than a callback because the tap can land
    /// before the UI that handles it exists — a cold launch from a banner runs
    /// this delegate before the first `body` — and a stored value is simply
    /// read whenever the shell gets there.
    @Published var pending: Destination?

    private init() {}

    /// Parse an APNs payload. Returns nothing for anything unrecognised.
    func destination(for userInfo: [AnyHashable: Any]) -> Destination? {
        guard let path = userInfo["path"] as? String else { return nil }

        if path == "/admin/leads" { return .leads }

        // "/admin/messages/15145550188" — everything after the last slash, and
        // only if it looks like a phone number. A prefix match alone would
        // accept "/admin/messages" itself and open a thread with no number.
        let prefix = "/admin/messages/"
        if path.hasPrefix(prefix) {
            let digits = String(path.dropFirst(prefix.count))
            guard digits.count >= 10, digits.allSatisfy(\.isNumber) else { return nil }
            return .messageThread(phone: "+\(digits)")
        }

        return nil
    }

    func handle(_ userInfo: [AnyHashable: Any]) {
        guard let destination = destination(for: userInfo) else { return }
        pending = destination
    }
}
