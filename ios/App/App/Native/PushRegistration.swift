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

    /// What actually happened, in words, for the More screen to show.
    ///
    /// Every step here fails silently by nature: iOS refuses a token without
    /// saying so, and a failed upload was a `print` nobody sees. That silence
    /// cost an evening — the server could prove the key worked and that NO
    /// device had registered, and there was no way to ask the PHONE which
    /// half it had failed at. Now it says.
    @Published private(set) var status: String?

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
                if let error {
                    self?.status = "iOS refused: \(error.localizedDescription)"
                } else if !granted {
                    self?.status =
                        "You declined. iOS only asks once — allow it in Settings › Renovision AnA › Notifications."
                } else {
                    self?.status = "Allowed. Asking Apple for a token…"
                }
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
        status = "Apple issued a token. Sending it to the server…"
        Task {
            do {
                try await API.shared.registerPushToken(hex, environment: environment)
                // The ONLY state that means a notification can actually
                // arrive. Every step before this can pass and still leave the
                // server with nothing to send to.
                status = "Registered — \(environment) token filed with the server."
            } catch {
                // Said ON SCREEN, not only to a console nobody is watching.
                // The commonest cause is an expired session — the token
                // endpoint sits behind the same auth as everything else — and
                // that is fixable in seconds by somebody who is told.
                status =
                    "Server refused it: \(error.localizedDescription) — if that mentions authorisation, sign out and back in."
                print("[push] could not register: \(error.localizedDescription)")
            }
        }
    }

    func failed(_ error: Error) {
        status = "Apple would not issue a token: \(error.localizedDescription)"
        print("[push] Apple refused to register: \(error.localizedDescription)")
    }
}
