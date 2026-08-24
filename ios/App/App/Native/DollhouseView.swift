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
    /// Written to the diagnostics file the moment this screen appears, in
    /// every state including the empty one.
    let diagnosis: String

    @Environment(\.dismiss) private var dismiss
    @State private var allOpen = false
    @State private var showContents = true

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

                    // `.allowsHitTesting(false)` on the spacer-filled stack:
                    // a `VStack` with a `Spacer` in a `ZStack` takes the FULL
                    // height of the screen even though only the button is
                    // drawn, and anything laid over the scene is something the
                    // scene never gets to be orbited or tapped through. Same
                    // family as HANDOFF §4 — check what a control is SIZED as
                    // before reading its handler.
                    VStack(spacing: Brand.Space.small) {
                        Spacer().allowsHitTesting(false)
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
                    .allowsHitTesting(false)
            }
            .task { ScanLens.appendToDiagnostics(diagnosis) }
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
        // **Objects were missing from this line, and their absence cost a
        // round.** The owner asked why his wall-mounted television was not in
        // the model; the tally could say how many walls and openings there
        // were and nothing at all about how many things were standing in the
        // room, so "it is not drawn" and "it is drawn on the floor where you
        // did not look" were indistinguishable. Detected and placed are
        // counted separately because they come from different places and fail
        // for different reasons.
        let detected = rooms.reduce(0) { $0 + $1.plan.objects.count }
        let placed = rooms.reduce(0) { $0 + $1.placed.count }
        let span = Dollhouse.bounds(of: rooms).span
        return Text(
            "\(roomsOnFloor) on floor · \(rooms.count) built · \(walls) walls · "
                + "\(openings) openings · \(detected)+\(placed) objects · "
                + "\(String(format: "%.1f", span)) m")
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(.ultraThinMaterial, in: Capsule())
    }

    private var controls: some View {
        HStack(spacing: Brand.Space.small) {
            Button {
                showContents.toggle()
                Dollhouse.setContentsVisible(showContents, in: Dollhouse.Registry.shared.scene)
            } label: {
                Label(
                    showContents ? "Hide contents" : "Show contents",
                    systemImage: showContents ? "shippingbox.fill" : "shippingbox")
            }
            .font(.system(size: 15, weight: .semibold))
            .padding(.horizontal, Brand.Space.base)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial, in: Capsule())

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
        let scene = Dollhouse.scene(rooms: rooms)
        view.scene = scene
        // **Our own camera, not SceneKit's.** The owner: *"when I am turning
        // it, it goes all the way down so we can look at the floor plan from
        // bottom up… like it's sitting on your face. I want the rotation to
        // be limited."*
        //
        // `allowsCameraControl` gives a free turntable with no pitch limit,
        // and there is no property to clamp it — the controller owns the
        // transform outright. So the rig below replaces it: a yaw node at the
        // model's centre, a pitch node inside it, and the camera pushed back
        // along z. Clamping is then just clamping one number, and the camera
        // can never travel under the floor and look up through it.
        view.allowsCameraControl = false
        view.autoenablesDefaultLighting = false
        view.antialiasingMode = .multisampling4X
        view.backgroundColor = UIColor(white: 0.94, alpha: 1)
        view.pointOfView = scene.rootNode.childNode(withName: "camera", recursively: true)
        context.coordinator.rig = scene.rootNode.childNode(withName: "rig", recursively: false)
        context.coordinator.view = view
        context.coordinator.configure(distance: Float(max(6.0, Dollhouse.bounds(of: rooms).span * 1.35)))

        let tap = UITapGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.tapped(_:)))
        view.addGestureRecognizer(tap)
        let orbit = UIPanGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.orbited(_:)))
        orbit.maximumNumberOfTouches = 1
        view.addGestureRecognizer(orbit)
        let zoom = UIPinchGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.zoomed(_:)))
        view.addGestureRecognizer(zoom)
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject {
        weak var view: SCNView?
        weak var rig: SCNNode?

        /// **The limits, and why these numbers.**
        ///
        /// 12° is low enough to look along a floor and read the far wall, and
        /// still above the horizon, so the ground never rises past the model.
        /// 78° stops just short of straight down — at 90° a dollhouse becomes
        /// the 2D floor plan we already have, and the rooms lose the depth
        /// that is the entire reason for this screen.
        private let minPitch: Float = 12 * .pi / 180
        private let maxPitch: Float = 78 * .pi / 180
        private var yaw: Float = 0
        private var pitch: Float = 40 * .pi / 180
        private var distance: Float = 12
        private var startDistance: Float = 12
        private var lastPan: CGPoint = .zero

        func configure(distance: Float) {
            self.distance = distance
            apply()
        }

        @objc func orbited(_ gesture: UIPanGestureRecognizer) {
            guard let view else { return }
            let point = gesture.translation(in: view)
            if gesture.state == .began { lastPan = .zero }
            let dx = Float(point.x - lastPan.x)
            let dy = Float(point.y - lastPan.y)
            lastPan = point
            yaw -= dx * 0.006
            pitch = min(maxPitch, max(minPitch, pitch + dy * 0.006))
            apply()
        }

        @objc func zoomed(_ gesture: UIPinchGestureRecognizer) {
            if gesture.state == .began { startDistance = distance }
            // Clamped so a pinch can neither bury the camera inside a wall nor
            // throw the model away to a dot.
            distance = min(200, max(1.5, startDistance / Float(gesture.scale)))
            apply()
        }

        private func apply() {
            guard let rig else { return }
            SCNTransaction.begin()
            SCNTransaction.animationDuration = 0
            rig.eulerAngles = SCNVector3(0, yaw, 0)
            rig.childNode(withName: "pitch", recursively: false)?
                .eulerAngles = SCNVector3(-pitch, 0, 0)
            rig.childNode(withName: "pitch", recursively: false)?
                .childNode(withName: "camera", recursively: false)?
                .position = SCNVector3(0, 0, distance)
            SCNTransaction.commit()
        }

        /// Walk up from whatever was hit to the carrier that owns a leaf. The
        /// hit is nearly always the panel geometry, which is a child.
        @objc func tapped(_ gesture: UITapGestureRecognizer) {
            guard let view else { return }
            let hits = view.hitTest(gesture.location(in: view), options: [
                .searchMode: SCNHitTestSearchMode.all.rawValue
            ])
            for hit in hits {
                if let leaf = Dollhouse.Registry.shared.leaf(for: hit.node) {
                    leaf.toggle()
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    return
                }
            }
        }
    }
}
