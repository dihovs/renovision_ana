import UIKit
import SceneKit

/**
 * The dollhouse: the scanned room as a 3D model on a plain background.
 *
 * SceneKit rather than QuickLook. QuickLook is one line of code and comes
 * with AR for free, but AR is exactly what is wrong here — it opens onto the
 * camera, so the model is shown floating in whatever room you happen to be
 * standing in. The point of a dollhouse is to look AT the room, on a neutral
 * ground, the way Magicplan shows it.
 *
 * `allowsCameraControl` gives the standard pinch/rotate/pan gestures, and
 * `autoenablesDefaultLighting` plus the two lights below keep the walls
 * legible from any angle instead of going flat black when orbited behind.
 */
final class RoomModelViewController: UIViewController {
    private let url: URL

    init(url: URL) {
        self.url = url
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.secondarySystemBackground

        let sceneView = SCNView(frame: .zero)
        sceneView.translatesAutoresizingMaskIntoConstraints = false
        sceneView.allowsCameraControl = true
        sceneView.autoenablesDefaultLighting = true
        sceneView.antialiasingMode = .multisampling4X
        // The same neutral grey as the view behind it, so the model reads as
        // sitting on a surface rather than in a box.
        sceneView.backgroundColor = UIColor.secondarySystemBackground

        if let scene = try? SCNScene(url: url) {
            // A soft key light plus ambient: the default lighting alone
            // leaves the inside faces of walls unreadably dark.
            let key = SCNNode()
            key.light = SCNLight()
            key.light?.type = .directional
            key.light?.intensity = 700
            key.eulerAngles = SCNVector3(-Float.pi / 3, Float.pi / 4, 0)
            scene.rootNode.addChildNode(key)

            let ambient = SCNNode()
            ambient.light = SCNLight()
            ambient.light?.type = .ambient
            ambient.light?.intensity = 450
            scene.rootNode.addChildNode(ambient)

            sceneView.scene = scene
            // Frames the whole room on open, at a slight angle, rather than
            // starting nose-against-a-wall.
            sceneView.pointOfView = nil
            sceneView.defaultCameraController.interactionMode = .orbitTurntable
        }

        view.addSubview(sceneView)
        NSLayoutConstraint.activate([
            sceneView.topAnchor.constraint(equalTo: view.topAnchor),
            sceneView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sceneView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            sceneView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        var config = UIButton.Configuration.filled()
        config.title = "Done"
        config.baseBackgroundColor = UIColor.black.withAlphaComponent(0.55)
        config.cornerStyle = .capsule
        let done = UIButton(configuration: config, primaryAction: UIAction { [weak self] _ in
            self?.dismiss(animated: true)
        })
        done.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(done)
        NSLayoutConstraint.activate([
            done.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            done.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
        ])
    }
}
