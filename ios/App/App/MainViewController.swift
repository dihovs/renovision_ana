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
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SpeakerPlugin())
        bridge?.registerPluginInstance(RoomScanPlugin())
    }
}
