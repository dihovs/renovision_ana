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
        // Half the storey's span plus a margin: the whole floor lands on
        // screen at the pose it opens in, which is the point of opening
        // straight down.
        context.coordinator.configure(
            zoom: Float(max(4.0, Dollhouse.bounds(of: rooms).span * 0.62)))

        // **One finger moves the model, two fingers turn it.** The owner,
        // 24 Aug: *"we should be able to turn it with two fingers only, and
        // when we use one finger, we should actually move it around."* It is
        // also the gesture the storey canvas already teaches — one-finger pan
        // was asked for there by name — so the same hand does the same thing
        // on both screens.
        let move = UIPanGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.moved(_:)))
        move.maximumNumberOfTouches = 1
        view.addGestureRecognizer(move)

        let orbit = UIPanGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.orbited(_:)))
        orbit.minimumNumberOfTouches = 2
        orbit.maximumNumberOfTouches = 2
        view.addGestureRecognizer(orbit)

        let zoom = UIPinchGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.zoomed(_:)))
        // Pinch and two-finger orbit share the same two fingers: a spread is
        // a zoom, a slide is a turn, and both at once does both — which is
        // how every map behaves.
        zoom.delegate = context.coordinator
        orbit.delegate = context.coordinator
        view.addGestureRecognizer(zoom)
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
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
        /// Straight down. The screen OPENS here — the plan he was just
        /// reading — so switching from 2D reads as a tilt rather than a jump
        /// into a diorama (owner, 24 Aug). The 23 Aug clamp stopped at 78°
        /// to avoid "just the 2D plan we already have"; he looked at both
        /// and chose the plan.
        private let maxPitch: Float = .pi / 2
        private var yaw: Float = 0
        private var pitch: Float = .pi / 2
        /// How much of the world fits the screen height, in metres — the
        /// orthographic camera's zoom. Named `distance` no longer; nothing
        /// moves toward the model, the frustum just widens.
        private var zoom: Float = 12
        private var startZoom: Float = 12
        private var lastPan: CGPoint = .zero
        /// The finger's last position, in view points — the pan works from
        /// where the finger WAS rather than from a running translation, so
        /// each frame's move is measured against the camera as it stands.
        private var lastTouch: CGPoint = .zero
        /// Where the rig is looking. Panning slides this target across the
        /// ground; the camera keeps orbiting whatever it now holds, so a
        /// turn after a pan spins around the corner just moved to rather
        /// than snapping back to the middle of the floor.
        private var target = SCNVector3Zero

        /// Pinch and two-finger orbit must run together, or the first one to
        /// recognise locks the other out for the rest of the gesture.
        func gestureRecognizer(
            _ gesture: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer
        ) -> Bool { true }

        func configure(zoom: Float) {
            self.zoom = zoom
            apply()
        }

        /// ONE finger: **grab the model and move it.**
        ///
        /// The owner, 24 Aug: *"the gesture is bad, up and down goes left to
        /// right and opposite, I want to kind of grab it and move around
        /// like a real object."*
        ///
        /// Two builds tried to get this right by projecting the drag onto
        /// the ground with sines and cosines of the yaw, and both got a sign
        /// wrong somewhere — which is what "up and down goes left to right"
        /// is. The arithmetic was never the point: what he described is
        /// grabbing, and grabbing has an exact meaning that needs no
        /// trigonometry at all. **The floor under your finger stays under
        /// your finger.**
        ///
        /// So each frame both the finger's old and new positions are cast
        /// back onto the floor plane through the camera as it stands right
        /// now, and the rig moves by the difference between where those two
        /// rays land. It is self-correcting by construction: any yaw, any
        /// tilt, any zoom, and a wrong sign is impossible because no sign is
        /// ever written down.
        @objc func moved(_ gesture: UIPanGestureRecognizer) {
            guard let view else { return }
            let here = gesture.location(in: view)
            if gesture.state == .began {
                lastTouch = here
                return
            }
            guard let from = ground(lastTouch, in: view), let to = ground(here, in: view)
            else {
                lastTouch = here
                return
            }
            // Move the camera's target OPPOSITE the world travel, so the
            // ground appears to follow the hand rather than flee it.
            target.x -= to.x - from.x
            target.z -= to.z - from.z
            lastTouch = here
            apply()
        }

        /// Where a point on screen meets the floor plane, in world metres.
        ///
        /// Unprojected at both ends of the depth range to get the ray the
        /// pixel stands for, then walked to y = 0. Returns nil when the ray
        /// runs parallel to the floor — at a grazing tilt there is no answer,
        /// and refusing to move beats sliding the storey to infinity.
        private func ground(_ point: CGPoint, in view: SCNView) -> SCNVector3? {
            let near = view.unprojectPoint(SCNVector3(Float(point.x), Float(point.y), 0))
            let far = view.unprojectPoint(SCNVector3(Float(point.x), Float(point.y), 1))
            let dy = far.y - near.y
            guard abs(dy) > 1e-5 else { return nil }
            let t = -near.y / dy
            guard t.isFinite else { return nil }
            return SCNVector3(
                near.x + (far.x - near.x) * t, 0, near.z + (far.z - near.z) * t)
        }

        /// TWO fingers: turn and tilt.
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
            if gesture.state == .began { startZoom = zoom }
            // Clamped so a pinch can neither crop inside a single wall nor
            // throw the storey away to a dot.
            zoom = min(200, max(1.5, startZoom / Float(gesture.scale)))
            apply()
        }

        private func apply() {
            guard let rig else { return }
            SCNTransaction.begin()
            SCNTransaction.animationDuration = 0
            rig.position = target
            rig.eulerAngles = SCNVector3(0, yaw, 0)
            rig.childNode(withName: "pitch", recursively: false)?
                .eulerAngles = SCNVector3(-pitch, 0, 0)
            // The camera stays parked; zoom widens the orthographic
            // frustum instead of moving it, so nothing can clip through a
            // wall on the way in.
            rig.childNode(withName: "pitch", recursively: false)?
                .childNode(withName: "camera", recursively: false)?
                .camera?.orthographicScale = Double(zoom)
            SCNTransaction.commit()
        }

    }
}
