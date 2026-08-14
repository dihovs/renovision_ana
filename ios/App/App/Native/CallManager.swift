import AVFoundation
import CallKit
import Combine
import Foundation
import TwilioVoice

/// The phone.
///
/// This is what the WebView dialer could never be. A call placed here goes
/// through **CallKit**, so it is a real iPhone call: it appears on the lock
/// screen, it survives the app being backgrounded, it holds when a cellular
/// call arrives, it routes to CarPlay and AirPods, and it lands in the system
/// call history. A WebRTC call inside a web page has none of that — it dies
/// the moment the phone locks, which on a job site is most of the time.
///
/// **Outgoing only, deliberately.** `accessToken.ts` mints a token with the
/// outgoing grant and nothing else, and its reasoning is worth repeating: a
/// leaked token that could register an incoming client would silently
/// intercept customers calling the business, which is far worse than an
/// unauthorised outbound call. Receiving calls here needs a VoIP push
/// certificate and an incoming grant — a deliberate decision with a security
/// cost, not an oversight to quietly fix.
@MainActor
final class CallManager: NSObject, ObservableObject {
    static let shared = CallManager()

    enum State: Equatable {
        case idle
        case connecting
        case ringing
        case active
        case ended(String?)

        var isBusy: Bool {
            switch self {
            case .idle, .ended: return false
            case .connecting, .ringing, .active: return true
            }
        }
    }

    @Published private(set) var state: State = .idle
    @Published private(set) var remoteLabel: String = ""
    @Published private(set) var isMuted = false
    @Published private(set) var isOnSpeaker = false
    @Published private(set) var startedAt: Date?
    @Published var lastError: String?

    private var call: Call?
    private var callKitUUID: UUID?
    private let callKitProvider: CXProvider
    private let callController = CXCallController()

    private override init() {
        let config = CXProviderConfiguration()
        config.supportsVideo = false
        config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.phoneNumber, .generic]
        // The name shown on the lock screen and in Recents. Without it the
        // system falls back to the bundle name, and the operator sees a call
        // from "App".
        config.iconTemplateImageData = nil
        callKitProvider = CXProvider(configuration: config)

        super.init()
        callKitProvider.setDelegate(self, queue: nil)
    }

    // MARK: - Placing a call

    /// Dial a number. `label` is what the operator should see — a client's
    /// name where we know it, the number where we do not.
    func place(to number: String, label: String? = nil) async {
        guard !state.isBusy else { return }

        let cleaned = Self.normalise(number)
        guard !cleaned.isEmpty else {
            lastError = "Enter a number to call."
            return
        }

        // Asked before dialling rather than at first packet, so a refusal is a
        // clear message instead of a call that connects to silence.
        guard await Self.requestMicrophone() else {
            lastError = "Calling needs the microphone. Enable it in Settings → Renovision."
            return
        }

        remoteLabel = label ?? Self.pretty(cleaned)
        state = .connecting
        lastError = nil

        // CallKit is told first. Doing it the other way round produces a call
        // that is audible before the system knows it exists, which is what
        // makes some VoIP apps drop audio when the screen locks.
        let uuid = UUID()
        callKitUUID = uuid
        let handle = CXHandle(type: .phoneNumber, value: cleaned)
        let action = CXStartCallAction(call: uuid, handle: handle)
        action.contactIdentifier = remoteLabel

        do {
            try await callController.request(CXTransaction(action: action))
        } catch {
            state = .ended(error.localizedDescription)
            lastError = error.localizedDescription
            return
        }

        do {
            let token = try await API.shared.voiceToken()
            let options = ConnectOptions(accessToken: token) { builder in
                // The TwiML app reads `To` and dials it. The parameter name is
                // fixed by the server side in /api/voice/softphone.
                builder.params = ["To": cleaned]
                builder.uuid = uuid
            }
            call = TwilioVoiceSDK.connect(options: options, delegate: self)
        } catch {
            lastError = error.localizedDescription
            state = .ended(error.localizedDescription)
            endCallKit(uuid: uuid, reason: .failed)
        }
    }

    // MARK: - In-call controls

    func toggleMute() {
        guard let call else { return }
        call.isMuted.toggle()
        isMuted = call.isMuted
    }

    func toggleSpeaker() {
        isOnSpeaker.toggle()
        route(toSpeaker: isOnSpeaker)
    }

    /// Send a DTMF tone — the digits an IVR asks for once a call is up.
    func sendDigits(_ digits: String) {
        call?.sendDigits(digits)
    }

    func hangUp() {
        guard let uuid = callKitUUID else {
            call?.disconnect()
            return
        }
        // Through CallKit, so the system UI and this app agree about what
        // just happened. Disconnecting the Twilio call directly leaves the
        // green in-call banner on screen.
        Task {
            try? await callController.request(CXTransaction(action: CXEndCallAction(call: uuid)))
        }
    }

    // MARK: - Audio

    private func route(toSpeaker speaker: Bool) {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.overrideOutputAudioPort(speaker ? .speaker : .none)
        } catch {
            lastError = "Could not switch the speaker."
        }
    }

    private func endCallKit(uuid: UUID, reason: CXCallEndedReason) {
        callKitProvider.reportCall(with: uuid, endedAt: Date(), reason: reason)
        cleanUp()
    }

    private func cleanUp() {
        call = nil
        callKitUUID = nil
        isMuted = false
        isOnSpeaker = false
        startedAt = nil
    }

    // MARK: - Helpers

    /// Keep digits and a leading +. Twilio wants E.164; a number typed with
    /// brackets and dashes is the normal case, not the exception.
    static func normalise(_ raw: String) -> String {
        var digits = raw.filter { $0.isNumber || $0 == "+" }
        if digits.hasPrefix("+") {
            digits = "+" + digits.dropFirst().filter(\.isNumber)
        }
        // A bare 10-digit number in Quebec is North American; without the
        // country code Twilio rejects it outright.
        if !digits.hasPrefix("+") && digits.count == 10 { return "+1" + digits }
        if !digits.hasPrefix("+") && digits.count == 11 && digits.hasPrefix("1") {
            return "+" + digits
        }
        return digits
    }

    static func pretty(_ e164: String) -> String {
        let digits = e164.filter(\.isNumber)
        guard digits.count == 11, digits.hasPrefix("1") else { return e164 }
        let n = Array(digits.dropFirst())
        return "(\(String(n[0...2]))) \(String(n[3...5]))-\(String(n[6...9]))"
    }

    private static func requestMicrophone() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }
}

// MARK: - Twilio

extension CallManager: CallDelegate {
    nonisolated func callDidConnect(call: Call) {
        Task { @MainActor in
            state = .active
            startedAt = Date()
            if let uuid = callKitUUID {
                callKitProvider.reportOutgoingCall(with: uuid, connectedAt: Date())
            }
        }
    }

    nonisolated func callDidStartRinging(call: Call) {
        Task { @MainActor in
            state = .ringing
            if let uuid = callKitUUID {
                callKitProvider.reportOutgoingCall(with: uuid, startedConnectingAt: Date())
            }
        }
    }

    nonisolated func callDidFailToConnect(call: Call, error: Error) {
        Task { @MainActor in
            lastError = error.localizedDescription
            state = .ended(error.localizedDescription)
            if let uuid = callKitUUID { endCallKit(uuid: uuid, reason: .failed) }
        }
    }

    nonisolated func callDidDisconnect(call: Call, error: Error?) {
        Task { @MainActor in
            state = .ended(error?.localizedDescription)
            if let uuid = callKitUUID {
                endCallKit(uuid: uuid, reason: error == nil ? .remoteEnded : .failed)
            }
        }
    }
}

// MARK: - CallKit

extension CallManager: CXProviderDelegate {
    nonisolated func providerDidReset(_ provider: CXProvider) {
        Task { @MainActor in
            call?.disconnect()
            cleanUp()
            state = .idle
        }
    }

    nonisolated func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        // Twilio manages the audio session itself; answering here just tells
        // CallKit the request was accepted.
        action.fulfill()
    }

    nonisolated func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        Task { @MainActor in
            call?.disconnect()
            cleanUp()
            state = .idle
        }
        action.fulfill()
    }

    /// The system mute button — the one on the CallKit screen and on CarPlay.
    /// Kept in step with our own, or the two disagree about what the caller
    /// can hear.
    nonisolated func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        Task { @MainActor in
            call?.isMuted = action.isMuted
            isMuted = action.isMuted
        }
        action.fulfill()
    }

    nonisolated func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        TwilioVoiceSDK.audioDevice.isEnabled = true
    }

    nonisolated func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        TwilioVoiceSDK.audioDevice.isEnabled = false
    }
}
