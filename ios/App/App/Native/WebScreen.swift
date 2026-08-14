import Capacitor
import SwiftUI
import UIKit

/// The screens that have not been ported to Swift yet.
///
/// This is the bridge across the rewrite, and it is deliberate. The native app
/// begins with a handful of screens; the business runs on about thirty —
/// clients, estimates, invoices, the price book, the dialer, Ana. Rooting
/// straight to SwiftUI and shipping would take all of those away on the same
/// afternoon they are being used.
///
/// So the shell is native and everything inside it becomes native one screen
/// at a time, with this hosting whatever has not been reached yet. Each port
/// deletes one entry from `WebDestination` and the app is whole at every step.
/// When the last entry goes, so does this file.
///
/// It hosts `MainViewController` rather than a bare `WKWebView` because that
/// subclass is what registers this app's own plugins — camera, speaker,
/// RoomPlan — with the Capacitor bridge. A plain web view would load the same
/// pages with the native capabilities quietly missing.
struct WebScreen: UIViewControllerRepresentable {
    /// Path on the admin site, e.g. "/admin/clients".
    let path: String

    func makeUIViewController(context: Context) -> MainViewController {
        let controller = MainViewController()
        controller.startPath = path
        return controller
    }

    func updateUIViewController(_ controller: MainViewController, context: Context) {
        controller.navigate(to: path)
    }
}
