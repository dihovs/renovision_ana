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
            Self.paint(scene)
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

    /**
     * Give the model surfaces you can tell apart.
     *
     * RoomPlan's USDZ export arrives untextured — every surface takes the
     * default white material, so a white wall meets a white floor meets a
     * white ceiling and the result is a white blob with faint edges. That is
     * not a lighting problem and no amount of lamps fixes it; the geometry
     * needs materials.
     *
     * RoomPlan names its nodes by category ("Wall0", "Floor0", "Door3"…),
     * which is the only handle available for telling them apart after
     * export. Anything unrecognised is left alone rather than guessed at.
     *
     * Colours follow the convention a floor plan already uses, and that
     * Magicplan's 3D view uses too: a warm floor, off-white walls, dark
     * openings so doors and windows read as holes rather than panels.
     */
    private static func paint(_ scene: SCNScene) {
        let floor = material(UIColor(red: 0.78, green: 0.72, blue: 0.64, alpha: 1), roughness: 0.9)
        let wall = material(UIColor(red: 0.96, green: 0.96, blue: 0.95, alpha: 1), roughness: 0.85)
        let ceiling = material(UIColor(red: 0.99, green: 0.99, blue: 0.99, alpha: 1), roughness: 0.9)
        let opening = material(UIColor(red: 0.25, green: 0.28, blue: 0.33, alpha: 1), roughness: 0.6)
        let object = material(UIColor(red: 0.62, green: 0.66, blue: 0.72, alpha: 1), roughness: 0.7)

        scene.rootNode.enumerateChildNodes { node, _ in
            guard let geometry = node.geometry else { return }
            let name = (node.name ?? "").lowercased()

            switch true {
            case name.contains("floor"):
                geometry.materials = [floor]
            case name.contains("ceiling"):
                geometry.materials = [ceiling]
            case name.contains("wall"):
                geometry.materials = [wall]
            case name.contains("door"), name.contains("window"), name.contains("opening"):
                geometry.materials = [opening]
            case name.contains("storage"), name.contains("table"), name.contains("sofa"),
                 name.contains("bed"), name.contains("chair"), name.contains("cabinet"),
                 name.contains("appliance"), name.contains("stairs"), name.contains("object"):
                geometry.materials = [object]
            default:
                break
            }
        }
    }

    /// Physically-based, so the walls catch the light and read as surfaces
    /// with an orientation rather than as flat fill.
    private static func material(_ colour: UIColor, roughness: CGFloat) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = colour
        m.roughness.contents = roughness
        m.metalness.contents = 0.0
        // Walls are single-sided in the export, so the inside of the room is
        // invisible from outside without this — which looks like a missing
        // wall rather than a room seen from the back.
        m.isDoubleSided = true
        return m
    }
}
