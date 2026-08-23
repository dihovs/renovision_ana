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
    /// How many rooms this storey has AT ALL, before any were rejected for
    /// having no usable geometry. Passed in rather than derived, because the
    /// gap between this and `rooms.count` is the whole diagnosis.
    let roomsOnFloor: Int

    @Environment(\.dismiss) private var dismiss
    @State private var allOpen = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                if rooms.isEmpty {
                    ContentUnavailableView(
                        roomsOnFloor == 0 ? "No rooms on this floor" : "No usable geometry",
                        systemImage: "cube.transparent",
                        description: Text(
                            roomsOnFloor == 0
                                ? "Scan or draw a room on this floor and it will stand up here."
                                : "\(roomsOnFloor) room(s) are on this floor, but none carry the wall geometry this needs."
                        ))
                } else {
                    DollhouseSceneView(rooms: rooms)
                        .ignoresSafeArea(edges: .bottom)

                    VStack(spacing: Brand.Space.small) {
                        Spacer()
                        controls
                    }
                    .padding(.bottom, 44)
                }

                // **Always on screen, both states.** The first version put the
                // tally inside the non-empty branch — that is, everywhere
                // except the case it exists to diagnose. The screen came back
                // empty twice and the one line that would have said why was
                // the line that had been switched off.
                tally
                    .padding(.bottom, Brand.Space.base)
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

    /// What was actually put in the scene.
    ///
    /// Kept after the first empty-screen report, and worth keeping: it is the
    /// one line that separates "the storey had no geometry to build from" from
    /// "the model was built and the camera was pointed at nothing". Those have
    /// identical symptoms and completely different fixes, and guessing between
    /// them cost a build.
    private var tally: some View {
        let walls = rooms.reduce(0) { $0 + $1.plan.segments.count }
        let openings = rooms.reduce(0) { $0 + $1.plan.openings.count }
        let span = Dollhouse.bounds(of: rooms).span
        return Text(
            "\(roomsOnFloor) on floor · \(rooms.count) built · \(walls) walls · "
                + "\(openings) openings · \(String(format: "%.1f", span)) m")
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(.ultraThinMaterial, in: Capsule())
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
        // The camera lives IN the scene now — see `Dollhouse.cameraNode`. A
        // detached `pointOfView` renders nothing, which is what shipped first.
        view.pointOfView = view.scene?.rootNode.childNode(withName: "camera", recursively: false)

        let tap = UITapGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.tapped(_:)))
        view.addGestureRecognizer(tap)
        context.coordinator.view = view
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

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
