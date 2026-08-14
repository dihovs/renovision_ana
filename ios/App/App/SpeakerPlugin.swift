import Foundation
import Capacitor
import AVFAudio

/**
 * Routes call audio to the loudspeaker or back to the earpiece.
 *
 * WKWebView has no JS API for this: `HTMLMediaElement.setSinkId()` is
 * unimplemented in WebKit, so a speaker toggle for the WebRTC softphone has
 * to come from native code. `overrideOutputAudioPort` is the same call the
 * system Phone app itself makes — it only takes effect while the audio
 * session is in `.playAndRecord`, which is exactly the category an active
 * WebRTC call already puts it in.
 */
@objc(SpeakerPlugin)
public class SpeakerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeakerPlugin"
    public let jsName = "Speaker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise)
    ]

    @objc func setEnabled(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        do {
            try AVAudioSession.sharedInstance().overrideOutputAudioPort(enabled ? .speaker : .none)
            call.resolve(["enabled": enabled])
        } catch {
            call.reject("Could not switch audio output.", nil, error)
        }
    }
}
