import RoomPlan
import SwiftUI
import UIKit

/// Room capture, opened natively.
///
/// The scanner has always been native — `RoomScanViewController` drives
/// Apple's RoomPlan directly. What was missing was a native way IN: the Scan
/// tab was a placeholder that explained itself and did nothing, which from
/// the outside is indistinguishable from a broken button.
///
/// This presents the capture controller straight from SwiftUI, with no
/// Capacitor bridge in the path at all.
struct ScanEntryView: View {
    @State private var supported = RoomCaptureSession.isSupported
    @State private var scanning = false
    @State private var result: CapturedRoom?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                VStack(spacing: Brand.Space.large) {
                    Spacer()

                    ZStack {
                        Circle()
                            .fill(Brand.blue.opacity(0.10))
                            .frame(width: 128, height: 128)
                        Image(systemName: "camera.viewfinder")
                            .font(.system(size: 52, weight: .light))
                            .foregroundStyle(Brand.blue)
                    }

                    VStack(spacing: Brand.Space.tight) {
                        Text(supported ? "Measure a room" : "This device can't scan")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(Brand.ink)
                        Text(
                            supported
                                ? "Walk the room slowly with the phone up, pointing at every wall in turn."
                                : "Room scanning needs the LiDAR sensor — iPhone Pro from 12 onward, or iPad Pro from 2020."
                        )
                        .font(.system(size: 14))
                        .foregroundStyle(Brand.inkSoft)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Brand.Space.section)
                    }

                    if let result {
                        Card {
                            VStack(alignment: .leading, spacing: Brand.Space.tight) {
                                Text("Last scan")
                                    .font(.system(size: 11, weight: .heavy))
                                    .foregroundStyle(Brand.inkFaint)
                                Text(
                                    "\(result.walls.count) walls · \(result.doors.count) doors · \(result.windows.count) windows"
                                )
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Brand.ink)
                                // Said plainly rather than implied by a missing
                                // button: a measurement the operator believes
                                // was filed and was not is the worst outcome
                                // this screen can produce.
                                Text(
                                    "Not saved to a project. Saving from here needs the project and floor chooser, which is next."
                                )
                                .font(.system(size: 12))
                                .foregroundStyle(.orange)
                            }
                        }
                        .padding(.horizontal, Brand.Space.base)
                    }

                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, Brand.Space.large)
                    }

                    Spacer()

                    Button("Start scan") { scanning = true }
                        .buttonStyle(PrimaryButtonStyle(enabled: supported))
                        .disabled(!supported)
                        .padding(.horizontal, Brand.Space.large)
                        .padding(.bottom, Brand.Space.large)
                }
            }
            .navigationTitle("Scan")
            .navigationBarTitleDisplayMode(.inline)
        }
        .fullScreenCover(isPresented: $scanning) {
            RoomCapture { outcome in
                scanning = false
                switch outcome {
                case .success(let room):
                    result = room
                    error = nil
                case .failure(let failure):
                    // Backing out is the ordinary way to abandon a scan and
                    // must not look like a fault.
                    let text = failure.localizedDescription
                    error = text.localizedCaseInsensitiveContains("cancel") ? nil : text
                }
            }
            .ignoresSafeArea()
        }
    }
}

/// The RoomPlan capture screen, wrapped for SwiftUI.
private struct RoomCapture: UIViewControllerRepresentable {
    let onFinish: (Result<CapturedRoom, Error>) -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        guard #available(iOS 17.0, *) else {
            return UIViewController()
        }
        let controller = RoomScanViewController()
        controller.onFinish = onFinish
        return controller
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {}
}
