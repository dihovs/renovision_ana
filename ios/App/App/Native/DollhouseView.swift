import SceneKit
import SwiftUI

/// The dollhouse screen: the storey in 3D, with everything that opens, opening.
///
/// See `Dollhouse` for how the model is built. This file is only the screen
/// around it — the camera, the gestures, and the two controls that earn their
/// place.
///
/// **The camera is SceneKit's own** (`allowsCameraControl`). One finger
/// orbits, two pan, pinch zooms. Writing a bespoke camera rig here would have
/// meant re-solving gestures this app has already had rejected twice on the
/// 2D canvas, to arrive at the same behaviour Apple ships for a property.
///
/// **Tapping a door opens that door.** It is the first thing anybody tries on
/// a dollhouse, and a model where the doors move only via a toolbar button is
/// a model that feels like a diagram.
@available(iOS 17.0, *)
struct DollhouseScreen: View {
    let title: String
    let rooms: [Dollhouse.Room]

    @Environment(\.dismiss) private var dismiss
    @State private var allOpen = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                if rooms.isEmpty {
                    ContentUnavailableView(
                        "Nothing to show yet",
                        systemImage: "cube.transparent",
                        description: Text(
                            "Scan or draw a room on this floor and it will stand up here."))
                } else {
                    DollhouseSceneView(rooms: rooms)
                        .ignoresSafeArea(edges: .bottom)

                    controls
                        .padding(.bottom, Brand.Space.base)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 16, weight: .semibold))
                }
            }
        }
    }

    private var controls: some View {
        HStack(spacing: Brand.Space.small) {
            Button {
                allOpen.toggle()
                for leaf in Dollhouse.Registry.shared.leaves {
                    leaf.set(open: allOpen)
                }
            } label: {
                Label(
                    allOpen ? "Close all" : "Open all",
                    systemImage: allOpen ? "door.left.hand.closed" : "door.left.hand.open")
            }
            .font(.system(size: 15, weight: .semibold))
            .padding(.horizontal, Brand.Space.base)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial, in: Capsule())
        }
    }
}

/// The `SCNView` itself.
///
/// **Built once.** `updateUIView` deliberately does nothing: the leaves hold
/// their own open/closed state on the nodes, and rebuilding the scene on a
/// SwiftUI update would slam every door shut mid-animation and lose the
/// camera the operator had just orbited into place.
@available(iOS 17.0, *)
struct DollhouseSceneView: UIViewRepresentable {
    let rooms: [Dollhouse.Room]

    func makeUIView(context: Context) -> SCNView {
        // Leaves register themselves as the tree is built, so the registry is
        // cleared immediately before rather than after — a scene built twice
        // would otherwise leave the first set behind and `Open all` would
        // animate doors that are no longer on screen.
        Dollhouse.Registry.shared.reset()

        let view = SCNView()
        view.scene = Dollhouse.scene(rooms: rooms)
        view.allowsCameraControl = true
        view.defaultCameraController.interactionMode = .orbitTurntable
        view.defaultCameraController.inertiaEnabled = true
        view.autoenablesDefaultLighting = false
        view.antialiasingMode = .multisampling4X
        view.backgroundColor = UIColor(white: 0.94, alpha: 1)
        view.pointOfView = camera(for: view.scene)

        let tap = UITapGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.tapped(_:)))
        view.addGestureRecognizer(tap)
        context.coordinator.view = view
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    /// Looking down at about 40°, far enough out to hold the whole storey.
    ///
    /// The angle matters: too flat and the far walls hide the near rooms even
    /// with front-face culling; straight down and it stops being a dollhouse
    /// and becomes the floor plan we already have in 2D.
    private func camera(for scene: SCNScene?) -> SCNNode {
        let node = SCNNode()
        node.camera = SCNCamera()
        node.camera?.fieldOfView = 50
        node.camera?.zNear = 0.05
        node.camera?.zFar = 500

        var span = 10.0
        if let world = scene?.rootNode.childNode(withName: "world", recursively: false) {
            let (minB, maxB) = world.boundingBox
            span = Double(max(maxB.x - minB.x, maxB.z - minB.z))
        }
        let distance = max(6.0, span * 1.35)
        node.position = SCNVector3(0, Float(distance * 0.72), Float(distance * 0.86))
        node.eulerAngles = SCNVector3(-Float.pi / 4.5, 0, 0)
        return node
    }

    final class Coordinator: NSObject {
        weak var view: SCNView?

        /// Walk up from whatever was hit to the carrier that owns a leaf. The
        /// hit is nearly always the panel geometry, which is a child.
        @objc func tapped(_ gesture: UITapGestureRecognizer) {
            guard let view else { return }
            let hits = view.hitTest(gesture.location(in: view), options: [
                .searchMode: SCNHitTestSearchMode.all.rawValue
            ])
            for hit in hits {
                var node: SCNNode? = hit.node
                while let current = node {
                    if let leaf = current.value(forUndefinedKey: "leaf") as? Dollhouse.Leaf {
                        leaf.toggle()
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        return
                    }
                    node = current.parent
                }
            }
        }
    }
}
