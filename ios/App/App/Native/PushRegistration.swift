import Foundation
import UIKit
import UserNotifications

/// Asking for notifications, and telling the server where to send them.
///
/// **The owner's ask, 20 Aug 2026:** *"I wanna get notifications so I can go
/// and actually check what's going on."*
///
/// Three things have to line up and each fails silently on its own, which is
/// why they are all in one file with the reasons written down:
///
/// 1. **Permission.** Asked once, by iOS, and never again — a refusal is
///    permanent until he changes it in Settings. So it is asked at a moment
///    that makes sense rather than on first launch, when nobody knows yet
///    what the app is for.
/// 2. **The token.** Apple issues it, can reissue it at any time — after a
///    restore, an update, or for no stated reason — and a stale one is a
///    notification that goes nowhere. So it is registered on EVERY launch,
///    not only the first.
/// 3. **The environment.** A token minted against the sandbox is refused
///    flat by the production gateway and the other way round. A build
///    installed by cable from Xcode is a DEVELOPMENT build, and saying so is
///    what stops every notification failing with an error that does not
///    mention it.
@MainActor
final class PushRegistration: NSObject, ObservableObject {
    static let shared = PushRegistration()

    @Published private(set) var authorised = false

    /// Development unless this was built for release. `DEBUG` is the honest
    /// test: it is exactly the builds that get a development provisioning
    /// profile, which is exactly the tokens the sandbox gateway accepts.
    private var environment: String {
        #if DEBUG
            return "development"
        #else
            return "production"
        #endif
    }

    /// Ask, then register. Safe to call repeatedly — iOS shows its dialog
    /// once and answers from memory afterwards.
    func enable() {
        UNUserNotificationCenter.current().requestAuthorization(options: [
            .alert, .badge, .sound,
        ]) { [weak self] granted, error in
            if let error {
                print("[push] authorisation failed: \(error.localizedDescription)")
            }
            Task { @MainActor in
                self?.authorised = granted
                // Registering without permission is pointless: Apple issues
                // a token but delivers nothing, so the server would hold a
                // row that can never produce a banner.
                guard granted else { return }
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    /// Re-register if he has already said yes, without asking again.
    func refreshIfAuthorised() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            Task { @MainActor in
                let ok = settings.authorizationStatus == .authorized
                self.authorised = ok
                guard ok else { return }
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    /// Apple handed us a token. Hex, because that is the only form the APNs
    /// endpoint accepts.
    func received(_ deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task {
            do {
                try await API.shared.registerPushToken(hex, environment: environment)
            } catch {
                // Worth a line and nothing more: a failed registration costs
                // notifications, never the work the operator is doing.
                print("[push] could not register: \(error.localizedDescription)")
            }
        }
    }

    func failed(_ error: Error) {
        print("[push] Apple refused to register: \(error.localizedDescription)")
    }
}
