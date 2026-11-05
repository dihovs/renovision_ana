import ARKit
import FloorPlanCore
import RealityKit
import SwiftUI

/// **Manual-Scan: walk the room and tap its corners through the camera**
/// (floor-plan spec §8, M8).
///
/// The capture the reference calls Manual-Scan, and the one that works on any
/// recent iPhone — it needs world tracking and a floor, not LiDAR. The
/// operator aims the crosshair at each floor–wall corner in turn and taps; the
/// app drops a corner there, draws the wall back to the last one with its
/// length, and closes the room when he comes back to the first.
///
/// How a tap becomes a corner, in order of trust:
/// 1. **Two walls meeting.** When ARKit has found the two vertical planes that
///    meet at this corner, the corner is where their floor lines cross — exact
///    to the plane fit, not to where a hand happened to point.
/// 2. **The floor.** Otherwise the aim point on the floor plane.
/// Either way it then goes through the same capture rules as drawing on
/// paper (spec §4, `OutlineCapture`): 3 cm snap to an existing corner, 25 cm
/// auto-close, walls under 10 cm ignored.
///
/// Taps are refused while tracking is not normal (§8): a corner placed while
/// ARKit is guessing is a corner in the wrong place, and nothing downstream
/// can tell.
struct ARCornerCaptureView: View {
    let onCancel: () -> Void
    /// Same contract as `DrawRoomView`: corners in plan metres, the ceiling,
    /// and openings (none — they go on afterwards, on the plan).
    let onDone: ([CGPoint], Double, [PlanEditing.WallOpening]) -> Void

    @StateObject private var model = ARCornerModel()
    @ObservedObject private var units = UnitSettings.shared
    /// Shared with `DrawRoomView`: a house's ceilings are mostly one height.
    @AppStorage("drawRoom.ceiling") private var heightText = "8"

    var body: some View {
        ZStack {
            ARCornerViewContainer(model: model)
                .ignoresSafeArea()
                .onTapGesture { location in model.addCorner(at: location) }

            overlay.allowsHitTesting(false)

            VStack(spacing: 0) {
                topBar
                Spacer()
                bottomBar
            }
        }
        .onChange(of: model.closedCorners) { _, corners in
            guard let corners else { return }
            onDone(corners, UnitSettings.shared.format.parse(heightText) ?? 2.44, [])
        }
    }

    // MARK: - Drawn over the camera

    private var overlay: some View {
        Canvas { context, size in
            // The walls placed so far, and the one being aimed.
            let pts = model.cornerScreens
            if let first = pts.first {
                var path = Path()
                path.move(to: first)
                for p in pts.dropFirst() { path.addLine(to: p) }
                context.stroke(path, with: .color(.white), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                context.stroke(path, with: .color(Brand.blue), style: StrokeStyle(lineWidth: 2, lineCap: .round))
            }
            if let last = pts.last, let aim = model.aimScreen, model.canPlace {
                var band = Path()
                band.move(to: last)
                band.addLine(to: aim)
                context.stroke(band, with: .color(.white), style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
            }
            for (i, p) in pts.enumerated() {
                let r: CGFloat = i == 0 ? 8 : 5
                context.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)),
                             with: .color(i == 0 ? Brand.blue : .white))
            }
            // The crosshair, at the middle of the screen — where Add Corner
            // aims. Green when two walls have been found meeting there.
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let tint: Color = !model.canPlace ? .orange : (model.aimLockedToCorner ? .green : .white)
            context.stroke(Path(ellipseIn: CGRect(x: c.x - 18, y: c.y - 18, width: 36, height: 36)),
                           with: .color(tint), lineWidth: 2)
            context.fill(Path(ellipseIn: CGRect(x: c.x - 3, y: c.y - 3, width: 6, height: 6)), with: .color(tint))
        }
        .overlay(alignment: .topLeading) {
            // The live wall's length, next to the band's middle.
            if let label = model.liveLength.map({ units.format.format($0) }),
                let last = model.cornerScreens.last, let aim = model.aimScreen
            {
                Text(label)
                    .font(.system(size: 15, weight: .bold))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(.black.opacity(0.6), in: Capsule())
                    .foregroundStyle(.white)
                    .position(x: (last.x + aim.x) / 2, y: (last.y + aim.y) / 2 - 18)
            }
        }
    }

    private var topBar: some View {
        HStack(alignment: .top) {
            Button { model.pause(); onCancel() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .bold))
                    .frame(width: 36, height: 36)
                    .background(.black.opacity(0.5), in: Circle())
                    .foregroundStyle(.white)
            }
            Spacer()
            Text(model.message)
                .font(.system(size: 15, weight: .semibold))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(model.canPlace ? .black.opacity(0.55) : .orange.opacity(0.85), in: Capsule())
                .foregroundStyle(.white)
            Spacer()
            Color.clear.frame(width: 36, height: 36)
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.top, 8)
    }

    private var bottomBar: some View {
        VStack(spacing: Brand.Space.small) {
            HStack(spacing: 8) {
                Text("CEILING")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(.white.opacity(0.8))
                TextField("8", text: $heightText)
                    .keyboardType(.numbersAndPunctuation)
                    .font(.system(size: 15, weight: .semibold))
                    .frame(width: 80)
                    .padding(.horizontal, 8).padding(.vertical, 6)
                    .background(.white.opacity(0.9), in: .rect(cornerRadius: 8))
                Spacer()
                if model.area > 0 {
                    Text(Measure.sqftLabel(model.area))
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                }
            }
            HStack(spacing: Brand.Space.small) {
                Button { model.undo() } label: { label("Undo", "arrow.uturn.backward") }
                    .disabled(model.cornerCount == 0)
                Button { model.addCornerAtCrosshair() } label: {
                    Text("Add corner")
                        .font(.system(size: 17, weight: .bold))
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(model.canPlace ? Brand.blue : Color.gray, in: .rect(cornerRadius: 14))
                        .foregroundStyle(.white)
                }
                .disabled(!model.canPlace)
                Button { model.close() } label: { label("Close", "checkmark") }
                    .disabled(model.cornerCount < 3)
            }
        }
        .padding(Brand.Space.base)
        .background(.black.opacity(0.35))
    }

    private func label(_ text: String, _ icon: String) -> some View {
        VStack(spacing: 2) {
            Image(systemName: icon).font(.system(size: 17, weight: .bold))
            Text(text).font(.system(size: 11, weight: .semibold))
        }
        .frame(width: 64, height: 52)
        .background(.white.opacity(0.9), in: .rect(cornerRadius: 14))
        .foregroundStyle(Brand.ink)
    }
}

// MARK: - The AR view

private struct ARCornerViewContainer: UIViewRepresentable {
    let model: ARCornerModel
    func makeUIView(context: Context) -> ARView {
        let view = ARView(frame: .zero, cameraMode: .ar, automaticallyConfigureSession: false)
        model.attach(view)
        return view
    }
    func updateUIView(_ uiView: ARView, context: Context) {}
}

// MARK: - The capture

@MainActor
final class ARCornerModel: NSObject, ObservableObject, ARSessionDelegate {
    @Published var message = "Point at the floor and move the phone slowly"
    @Published var canPlace = false
    @Published var aimScreen: CGPoint?
    @Published var aimLockedToCorner = false
    @Published var cornerScreens: [CGPoint] = []
    @Published var liveLength: Double?
    @Published var cornerCount = 0
    @Published var area: Double = 0
    /// Set once the loop closes — the room, in plan metres, square to the page.
    @Published var closedCorners: [CGPoint]?

    private weak var view: ARView?
    /// The corners in WORLD space, on the floor.
    private var world: [SIMD3<Float>] = []
    private var capture = OutlineCapture()
    private var floorY: Float?
    private var tracking = false
    private var frameCount = 0

    func attach(_ view: ARView) {
        self.view = view
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal, .vertical]
        // LiDAR's mesh makes raycasts better where there is one; every part of
        // this works without it (§8).
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            config.sceneReconstruction = .mesh
        }
        view.session.delegate = self
        view.session.run(config)
    }

    func pause() { view?.session.pause() }

    // MARK: Frames

    nonisolated func session(_ session: ARSession, didUpdate frame: ARFrame) {
        let state = frame.camera.trackingState
        let camera = frame.camera.transform
        let anchors = frame.anchors.compactMap { $0 as? ARPlaneAnchor }
        Task { @MainActor in self.update(state: state, camera: camera, planes: anchors) }
    }

    private func update(state: ARCamera.TrackingState, camera: simd_float4x4, planes: [ARPlaneAnchor]) {
        frameCount += 1
        guard frameCount % 2 == 0, let view else { return }

        if case .normal = state { tracking = true } else { tracking = false }

        // The floor: the lowest horizontal plane well below the phone.
        let cameraY = camera.columns.3.y
        let floors = planes.filter { $0.alignment == .horizontal }
            .map { $0.transform.columns.3.y }
            .filter { $0 < cameraY - 0.5 }
        if let lowest = floors.min() { floorY = lowest }

        let centre = CGPoint(x: view.bounds.midX, y: view.bounds.midY)
        let aim = floorPoint(at: centre)
        if let aim {
            let (point, locked) = cornerAid(aim, planes: planes)
            aimScreen = screen(point, camera: camera)
            aimLockedToCorner = locked
            if let last = world.last { liveLength = Double(simd_distance(last, point)) } else { liveLength = nil }
        } else {
            aimScreen = nil
            aimLockedToCorner = false
            liveLength = nil
        }
        cornerScreens = world.compactMap { screen($0, camera: camera) }

        canPlace = tracking && floorY != nil && aim != nil && closedCorners == nil
        if !tracking {
            message = "Hold still — the camera is finding its place"
        } else if floorY == nil {
            message = "Point at the floor and move the phone slowly"
        } else if world.isEmpty {
            message = "Aim at a corner where the wall meets the floor, then tap"
        } else if world.count >= 3 {
            message = "Next corner — or come back to the first to close"
        } else {
            message = "Aim at the next corner"
        }
    }

    // MARK: Placing

    func addCornerAtCrosshair() {
        guard let view else { return }
        addCorner(at: CGPoint(x: view.bounds.midX, y: view.bounds.midY))
    }

    /// A tap at a screen point (§8: the raycast is from where he tapped).
    func addCorner(at location: CGPoint) {
        guard canPlace, let raw = floorPoint(at: location) else { return }
        let planes = view?.session.currentFrame?.anchors.compactMap { $0 as? ARPlaneAnchor } ?? []
        let (point, locked) = cornerAid(raw, planes: planes)

        switch capture.tap(plan(point)) {
        case .added(let p, let snapped):
            world.append(SIMD3(Float(p.x), point.y, Float(-p.y)))
            UIImpactFeedbackGenerator(style: locked || snapped ? .rigid : .medium).impactOccurred()
            refreshArea()
        case .closed:
            finish()
        case .tooShort:
            UINotificationFeedbackGenerator().notificationOccurred(.warning)
            message = "Too close to the last corner — walls under 4 in are ignored"
        case .crossesItself:
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            message = "The walls would cross — undo a corner, then close"
        }
        cornerCount = capture.points.count
    }

    func undo() {
        guard !world.isEmpty else { return }
        world.removeLast()
        capture = OutlineCapture(points: Array(capture.points.dropLast()))
        cornerCount = capture.points.count
        refreshArea()
    }

    func close() {
        switch capture.close() {
        case .closed: finish()
        case .crossesItself:
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            message = "The walls would cross — undo a corner, then close"
        default: break
        }
    }

    private func finish() {
        guard let room = capture.room else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        pause()
        closedCorners = Self.squaredToPage(PlanBridge.app(room.points))
    }

    private func refreshArea() {
        area = capture.points.count >= 3 ? Polygon.area(capture.points) : 0
    }

    // MARK: Geometry

    /// World point → the core's plan (spec §8: plan (x, −z), y up).
    private func plan(_ p: SIMD3<Float>) -> Vec2 { Vec2(Double(p.x), -Double(p.z)) }

    /// Where a screen point meets the floor plane.
    private func floorPoint(at location: CGPoint) -> SIMD3<Float>? {
        guard let view, let floorY else { return nil }
        // A plane ARKit has actually measured first; an estimate otherwise.
        let hit = view.raycast(from: location, allowing: .existingPlaneGeometry, alignment: .horizontal).first
            ?? view.raycast(from: location, allowing: .estimatedPlane, alignment: .horizontal).first
        if let hit {
            let p = hit.worldTransform.columns.3
            // Projected onto the floor (§8): a hit on a low table is the
            // floor beneath it as far as a plan is concerned.
            return SIMD3(p.x, floorY, p.z)
        }
        // No surface under the ray: intersect it with the floor plane itself.
        guard let ray = view.ray(through: location), abs(ray.direction.y) > 1e-4 else { return nil }
        let t = (floorY - ray.origin.y) / ray.direction.y
        guard t > 0, t < 15 else { return nil }
        return ray.origin + ray.direction * t
    }

    /// The corner aid (§8): if two walls ARKit has found meet near this
    /// point, the corner is where their floor lines cross.
    private func cornerAid(_ p: SIMD3<Float>, planes: [ARPlaneAnchor]) -> (SIMD3<Float>, Bool) {
        struct Line { let c: SIMD2<Float>; let n: SIMD2<Float> }
        let here = SIMD2(p.x, p.z)
        let lines: [Line] = planes.filter { $0.alignment == .vertical }.compactMap { a in
            let t = a.transform
            let normal = SIMD2(t.columns.1.x, t.columns.1.z)
            let len = simd_length(normal)
            guard len > 0.5 else { return nil }
            let n = normal / len
            let centre = t * SIMD4(a.center.x, a.center.y, a.center.z, 1)
            let c = SIMD2(centre.x, centre.z)
            // Near the wall's line, and not past the end of the wall ARKit saw.
            guard abs(simd_dot(here - c, n)) < 0.3 else { return nil }
            let along = abs(simd_dot(here - c, SIMD2(-n.y, n.x)))
            guard along < a.planeExtent.width / 2 + 0.5 else { return nil }
            return Line(c: c, n: n)
        }
        var best: (SIMD2<Float>, Float)?
        for i in lines.indices {
            for j in lines.indices where j > i {
                let a = lines[i], b = lines[j]
                // Walls at a real corner, not two pieces of one wall.
                let cross = a.n.x * b.n.y - a.n.y * b.n.x
                guard abs(cross) > 0.5 else { continue }
                // Points x with n·x = n·c on both lines.
                let da = simd_dot(a.n, a.c), db = simd_dot(b.n, b.c)
                let x = SIMD2((da * b.n.y - db * a.n.y) / cross, (a.n.x * db - b.n.x * da) / cross)
                let d = simd_distance(x, here)
                guard d < 0.35, d < (best?.1 ?? .infinity) else { continue }
                best = (x, d)
            }
        }
        if let (x, _) = best { return (SIMD3(x.x, p.y, x.y), true) }
        return (p, false)
    }

    private func screen(_ p: SIMD3<Float>, camera: simd_float4x4) -> CGPoint? {
        // Only points in front of the camera; behind it the projection flips.
        let toPoint = p - SIMD3(camera.columns.3.x, camera.columns.3.y, camera.columns.3.z)
        let forward = -SIMD3(camera.columns.2.x, camera.columns.2.y, camera.columns.2.z)
        guard simd_dot(toPoint, forward) > 0.05 else { return nil }
        return view?.project(p)
    }

    /// The outline turned so its longest wall lies along the page, folded to
    /// the nearest quarter turn, and moved to the origin — the same squaring
    /// a scanned room gets (`FloorPlanGeometry.squareToPage`). A pure turn:
    /// no length, angle or area changes.
    static func squaredToPage(_ pts: [CGPoint]) -> [CGPoint] {
        guard pts.count >= 2 else { return pts }
        let n = pts.count
        let longest = (0..<n).max {
            hypot(pts[($0 + 1) % n].x - pts[$0].x, pts[($0 + 1) % n].y - pts[$0].y)
                < hypot(pts[($1 + 1) % n].x - pts[$1].x, pts[($1 + 1) % n].y - pts[$1].y)
        } ?? 0
        let a = pts[longest], b = pts[(longest + 1) % n]
        var angle = atan2(b.y - a.y, b.x - a.x)
        while angle > .pi / 4 { angle -= .pi / 2 }
        while angle < -.pi / 4 { angle += .pi / 2 }
        let c = cos(-angle), s = sin(-angle)
        let turned = pts.map { CGPoint(x: $0.x * c - $0.y * s, y: $0.x * s + $0.y * c) }
        let minX = turned.map(\.x).min() ?? 0, minY = turned.map(\.y).min() ?? 0
        return turned.map { CGPoint(x: $0.x - minX, y: $0.y - minY) }
    }
}
