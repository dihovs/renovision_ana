import UIKit
import RoomPlan

/**
 * The actual scanning screen. RoomPlan supplies the AR visualization and the
 * live wall-detection guidance itself — this class only owns the session
 * lifecycle and the Done/Cancel chrome around it, not any 3D rendering.
 */
@available(iOS 17.0, *)
final class RoomScanViewController: UIViewController, RoomCaptureSessionDelegate, RoomCaptureViewDelegate {
    var onFinish: ((Result<CapturedRoom, Error>) -> Void)?

    private let captureView = RoomCaptureView(frame: .zero)
    private var isScanning = false

    override func viewDidLoad() {
        super.viewDidLoad()
        captureView.captureSession.delegate = self
        captureView.delegate = self

        captureView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(captureView)
        NSLayoutConstraint.activate([
            captureView.topAnchor.constraint(equalTo: view.topAnchor),
            captureView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            captureView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            captureView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        let cancelButton = chromeButton(title: "Cancel", action: #selector(cancelTapped))
        let doneButton = chromeButton(title: "Done", action: #selector(doneTapped))
        doneButton.backgroundColor = UIColor.systemGreen.withAlphaComponent(0.9)

        view.addSubview(cancelButton)
        view.addSubview(doneButton)
        NSLayoutConstraint.activate([
            cancelButton.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            cancelButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            doneButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            doneButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !isScanning else { return }
        isScanning = true
        // Walking a room is minutes of holding the phone up without touching
        // the screen, which is exactly what the idle timer counts as idle —
        // and a scan that sleeps halfway through is a scan started again.
        UIApplication.shared.isIdleTimerDisabled = true
        captureView.captureSession.run(configuration: RoomCaptureSession.Configuration())
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        // Never leave it off: the whole phone stops sleeping otherwise.
        UIApplication.shared.isIdleTimerDisabled = false
    }

    @objc private func doneTapped() {
        // Stopping hands the final, processed CapturedRoom to
        // captureView(didPresent:error:) below — not to a completion here.
        captureView.captureSession.stop()
    }

    @objc private func cancelTapped() {
        // Consume the callback NOW. stop() still drives the normal
        // completion path, so without this the cancelled room arrives
        // seconds later as a success — and a half-walked scan the operator
        // deliberately discarded would enter the merge set anyway.
        let finish = onFinish
        onFinish = nil
        captureView.captureSession.stop()
        dismiss(animated: true) {
            finish?(.failure(RoomScanError.cancelled))
        }
    }

    func captureView(didPresent processedResult: CapturedRoom, error: (any Error)?) {
        // One delivery only — nil after a cancel, and nil-ed here so a
        // double-fire cannot resolve the same plugin call twice.
        guard let finish = onFinish else { return }
        onFinish = nil
        dismiss(animated: true) {
            if let error {
                finish(.failure(error))
            } else {
                finish(.success(processedResult))
            }
        }
    }

    private func chromeButton(title: String, action: Selector) -> UIButton {
        var config = UIButton.Configuration.filled()
        config.title = title
        config.baseBackgroundColor = UIColor.black.withAlphaComponent(0.55)
        config.cornerStyle = .capsule
        let button = UIButton(configuration: config, primaryAction: nil)
        button.addTarget(self, action: action, for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }
}

enum RoomScanError: LocalizedError {
    case cancelled
    case unsupportedDevice

    var errorDescription: String? {
        switch self {
        case .cancelled: return "The scan was cancelled."
        case .unsupportedDevice: return "This device has no LiDAR scanner."
        }
    }
}
