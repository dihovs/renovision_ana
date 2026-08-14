import UIKit
import Capacitor

/**
 * The app's bridge controller, existing solely to register the plugins this
 * app ships itself.
 *
 * Capacitor only auto-registers what it finds in `capacitor.config.json`'s
 * `packageClassList`, and `npx cap sync` builds that list from installed npm
 * packages — so a Swift plugin written directly in this target is never in
 * it, no matter that it compiles and conforms to CAPBridgedPlugin. Without
 * the explicit registration below, `registerPlugin("Speaker")` and
 * `registerPlugin("RoomScan")` on the JS side resolve to a bridge that has
 * never heard of them, and every call throws.
 *
 * That failure is quiet in exactly the wrong way: the JS wrappers catch the
 * throw and fall back, so the speaker toggle silently did nothing and the
 * room scanner reported "this device has no LiDAR" on an iPhone 17 Pro Max.
 * Any future app-local plugin has to be added here too.
 */
class MainViewController: CAPBridgeViewController {
    /// Which admin page to open. Set by `WebScreen` before the view loads, so
    /// the not-yet-ported screens can each host the page they represent
    /// instead of every one of them landing on Home.
    var startPath: String?

    /// Guards against reloading the same page every time SwiftUI re-renders
    /// the parent — `updateUIViewController` fires far more often than the
    /// page needs to change, and each reload would throw away scroll position
    /// and any half-typed form.
    private var currentPath: String?

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SpeakerPlugin())
        bridge?.registerPluginInstance(RoomScanPlugin())

        // Done here rather than in viewDidLoad: the bridge, and therefore its
        // web view, does not exist until this point.
        if let startPath { navigate(to: startPath) }
    }

    func navigate(to path: String) {
        guard path != currentPath else { return }
        guard let url = URL(string: path, relativeTo: API.baseURL) else { return }
        guard let webView = bridge?.webView else {
            // Asked before the bridge was ready. Remember it; capacitorDidLoad
            // will pick it up rather than the request being dropped.
            startPath = path
            return
        }
        currentPath = path
        webView.load(URLRequest(url: url))
    }
}
