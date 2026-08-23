import SceneKit
import SwiftUI

/// **The storey as a dollhouse**, with doors and windows that open.
///
/// The owner, 23 Aug 2026: *"I want you to build a 3D dollhouse look, and I
/// want the doors and windows to be animated to open and close."*
///
/// Everything here is built from geometry the app already holds — the same
/// `FloorPlanGeometry.Plan` the 2D canvas draws and the report prints, placed
/// by the same `StoreyPacking.pack`. **Nothing is measured twice.** A
/// dollhouse that disagreed with the floor plan about where a wall is would be
/// worse than no dollhouse, and this project has already learned that lesson
/// once with the phone and the report.
///
/// ## Why the openings are cut rather than drawn
///
/// A wall is not one box with a picture of a door on it. Each wall is split
/// into the pieces that actually stand: a pier, then the panel under a window,
/// then the panel over it, then the next pier. So an opening is a genuine hole
/// you can see through and put a swinging leaf into, and its size is the size
/// that came off the net wall area — the drawing cannot drift from the
/// arithmetic because it IS the arithmetic.
///
/// ## Why the near walls vanish
///
/// `cullMode = .front` on the wall material. Only back faces draw, so whatever
/// stands between the camera and the room is not rendered and the room is open
/// from every angle. That is the whole dollhouse effect, and it costs one line
/// rather than a per-frame visibility pass. Leaves are double-sided so a door
/// is still a door when you orbit behind it.
///
/// ## Why the animation is driven by `OpeningKind`
///
/// A sliding door that swings is a lie about the building. `LeafMotion` reads
/// the authored kind and moves it the way that kind actually moves — a pocket
/// door disappears into the wall, a garage door lifts, an awning window tilts
/// from its head because that is where its hinge is, a bifold folds in half.
/// Those distinctions were built into `OpeningKind` for the sake of the plan
/// symbols and the net wall area; here they pay for themselves a third time.
@available(iOS 17.0, *)
enum Dollhouse {

    /// One room, ready to build: its plan, where it sits on the storey, and
    /// how tall its walls are.
    struct Room {
        let id: String
        let name: String
        let plan: FloorPlanGeometry.Plan
        /// Storey origin in floor metres, from `StoreyPacking`.
        let origin: CGPoint
        let ceilingHeight: Double
        /// The room's own colour, when the operator set one.
        let tint: Color?
    }

    // MARK: - Materials

    private static func material(_ colour: UIColor, cull: SCNCullMode = .back) -> SCNMaterial {
        let m = SCNMaterial()
        m.diffuse.contents = colour
        m.lightingModel = .physicallyBased
        m.roughness.contents = 0.85
        m.metalness.contents = 0.0
        m.cullMode = cull
        return m
    }

    private static let wallInk = UIColor(red: 0.96, green: 0.97, blue: 0.98, alpha: 1)
    private static let floorInk = UIColor(red: 0.87, green: 0.89, blue: 0.91, alpha: 1)
    private static let leafInk = UIColor(red: 0.78, green: 0.71, blue: 0.62, alpha: 1)
    private static let glassInk = UIColor(red: 0.62, green: 0.78, blue: 0.90, alpha: 0.55)

    private static let wallThickness = 0.09

    // MARK: - Building

    /// How big the storey is, in floor metres, computed from the ROOM DATA.
    ///
    /// **Not from `SCNNode.boundingBox`, which was the bug that shipped an
    /// empty screen.** That property reports the bounds of a node's own
    /// geometry, and the container holding every room has no geometry of its
    /// own — so it came back empty, the model was centred on garbage and the
    /// camera was placed a distance computed from a zero span. Every room's
    /// footprint is already known here; asking SceneKit was never necessary.
    static func bounds(of rooms: [Room]) -> (centre: CGPoint, span: Double) {
        guard !rooms.isEmpty else { return (.zero, 10) }
        let minX = rooms.map { $0.origin.x }.min() ?? 0
        let minY = rooms.map { $0.origin.y }.min() ?? 0
        let maxX = rooms.map { $0.origin.x + $0.plan.width }.max() ?? 1
        let maxY = rooms.map { $0.origin.y + $0.plan.height }.max() ?? 1
        return (
            CGPoint(x: (minX + maxX) / 2, y: (minY + maxY) / 2),
            max(Double(maxX - minX), Double(maxY - minY), 2)
        )
    }

    static func scene(rooms: [Room]) -> SCNScene {
        let scene = SCNScene()
        scene.background.contents = UIColor(white: 0.94, alpha: 1)

        let world = SCNNode()
        world.name = "world"
        for room in rooms { world.addChildNode(node(for: room)) }

        // Centre the model on the origin so the camera orbits its middle
        // rather than its corner.
        let (centre, span) = bounds(of: rooms)
        world.position = SCNVector3(Float(-centre.x), 0, Float(-centre.y))
        scene.rootNode.addChildNode(world)

        addLighting(to: scene, span: span)
        scene.rootNode.addChildNode(cameraNode(span: span))
        return scene
    }

    /// The camera, **inside the scene**.
    ///
    /// The first version built this and handed it straight to
    /// `SCNView.pointOfView` without ever adding it to the graph. A detached
    /// point of view renders nothing at all, which is precisely what the
    /// owner saw.
    ///
    /// Looking down at about 40°: too flat and the far walls hide the near
    /// rooms even with front-face culling; straight down and it stops being a
    /// dollhouse and becomes the floor plan we already have in 2D.
    static func cameraNode(span: Double) -> SCNNode {
        let node = SCNNode()
        node.name = "camera"
        node.camera = SCNCamera()
        node.camera?.fieldOfView = 50
        node.camera?.zNear = 0.05
        node.camera?.zFar = 1000
        let distance = max(6.0, span * 1.35)
        node.position = SCNVector3(0, Float(distance * 0.72), Float(distance * 0.86))
        node.eulerAngles = SCNVector3(-Float.pi / 4.5, 0, 0)
        return node
    }

    private static func addLighting(to scene: SCNScene, span: Double) {
        let sun = SCNNode()
        sun.light = SCNLight()
        sun.light?.type = .directional
        sun.light?.intensity = 780
        sun.light?.castsShadow = true
        sun.light?.shadowMode = .deferred
        sun.light?.shadowRadius = 6
        sun.light?.shadowColor = UIColor(white: 0, alpha: 0.28)
        sun.eulerAngles = SCNVector3(-Float.pi / 3, Float.pi / 5, 0)
        scene.rootNode.addChildNode(sun)

        let fill = SCNNode()
        fill.light = SCNLight()
        fill.light?.type = .ambient
        fill.light?.intensity = 520
        fill.light?.color = UIColor(white: 0.95, alpha: 1)
        scene.rootNode.addChildNode(fill)
    }

    private static func node(for room: Room) -> SCNNode {
        let node = SCNNode()
        node.name = "room:\(room.id)"
        node.position = SCNVector3(Float(room.origin.x), 0, Float(room.origin.y))

        node.addChildNode(floorNode(room))
        for segment in room.plan.segments {
            node.addChildNode(wallNode(segment, room: room))
        }
        for opening in room.plan.openings {
            if let leaf = leafNode(opening, room: room) { node.addChildNode(leaf) }
        }
        for object in room.plan.objects {
            node.addChildNode(objectNode(object))
        }
        return node
    }

    /// The slab. Uses the room's real outline where it has one, so an L-shaped
    /// room gets an L-shaped floor rather than the bounding box it fits in.
    private static func floorNode(_ room: Room) -> SCNNode {
        let slabDepth = 0.06
        let colour = room.tint.map { UIColor($0).withAlphaComponent(1) } ?? floorInk

        if room.plan.polygon.count >= 3 {
            let path = UIBezierPath()
            path.move(to: room.plan.polygon[0])
            for p in room.plan.polygon.dropFirst() { path.addLine(to: p) }
            path.close()
            let shape = SCNShape(path: path, extrusionDepth: CGFloat(slabDepth))
            // Double-sided deliberately: `SCNShape` extrudes along +z and the
            // slab is then rotated flat, which can leave its normals pointing
            // at the ground. A floor nobody can see from above is the same
            // symptom as having no floor.
            let m = material(colour)
            m.isDoubleSided = true
            shape.materials = [m]
            let node = SCNNode(geometry: shape)
            // SCNShape extrudes along +z from a path in the x/y plane, so it
            // is stood down flat and lifted to sit just under the walls.
            node.eulerAngles = SCNVector3(Float.pi / 2, 0, 0)
            node.position = SCNVector3(0, Float(-slabDepth / 2), 0)
            return node
        }

        // No closed outline — an L-shaped room scanned from one side genuinely
        // has none. A bounding slab is still better than a floating set of
        // walls with nothing under them.
        let box = SCNBox(
            width: CGFloat(room.plan.width), height: CGFloat(slabDepth),
            length: CGFloat(room.plan.height), chamferRadius: 0)
        box.materials = [material(colour)]
        let node = SCNNode(geometry: box)
        node.position = SCNVector3(
            Float(room.plan.width / 2), Float(-slabDepth / 2), Float(room.plan.height / 2))
        return node
    }

    // MARK: - Walls, with real holes in them

    /// Where an opening sits along a wall, and how tall it is.
    private struct Hole {
        let start: Double
        let end: Double
        let sill: Double
        let head: Double
    }

    /// Which openings belong to this wall, expressed as distances along it.
    ///
    /// An opening carries its own sub-segment rather than a wall index, so
    /// membership is geometric: project both ends onto the wall's line, and
    /// keep it when it lies along the wall and close to it. The 0.3 m
    /// tolerance is generous on purpose — a detected door is rarely perfectly
    /// flush with the wall plane the editor later straightened.
    private static func holes(on segment: FloorPlanGeometry.Segment, room: Room) -> [Hole] {
        let ax = segment.x1, ay = segment.y1
        let dx = segment.x2 - ax, dy = segment.y2 - ay
        let length = hypot(dx, dy)
        guard length > 0.01 else { return [] }
        let ux = dx / length, uy = dy / length

        var found: [Hole] = []
        for opening in room.plan.openings {
            let p1 = CGPoint(x: opening.segment.x1, y: opening.segment.y1)
            let p2 = CGPoint(x: opening.segment.x2, y: opening.segment.y2)
            let t1 = (Double(p1.x) - ax) * ux + (Double(p1.y) - ay) * uy
            let t2 = (Double(p2.x) - ax) * ux + (Double(p2.y) - ay) * uy
            let perp1 = abs((Double(p1.x) - ax) * -uy + (Double(p1.y) - ay) * ux)
            let perp2 = abs((Double(p2.x) - ax) * -uy + (Double(p2.y) - ay) * ux)
            guard perp1 < 0.3, perp2 < 0.3 else { continue }
            let lo = min(t1, t2), hi = max(t1, t2)
            guard hi > 0.02, lo < length - 0.02 else { continue }

            let (sill, head) = extent(of: opening, ceiling: room.ceilingHeight)
            found.append(
                Hole(
                    start: max(0, lo), end: min(length, hi), sill: sill,
                    head: min(head, room.ceilingHeight)))
        }
        return found.sorted { $0.start < $1.start }
    }

    /// How high an opening's hole runs.
    ///
    /// An authored opening knows exactly — `OpeningKind` carries the stock
    /// sill and height, and those are the numbers net wall area is computed
    /// from. A RoomPlan detection does not report a sill at all, so the
    /// coarse category supplies the convention: anything you walk through
    /// starts at the floor, a window starts at a sill.
    private static func extent(
        of opening: FloorPlanGeometry.Opening, ceiling: Double
    ) -> (Double, Double) {
        if let detail = opening.detail {
            return (detail.sill, detail.sill + detail.height)
        }
        switch opening.kind {
        case .door, .opening: return (0, min(2.03, ceiling))
        case .window: return (0.9, min(2.1, ceiling))
        }
    }

    /// One wall, as the pieces that actually stand.
    private static func wallNode(
        _ segment: FloorPlanGeometry.Segment, room: Room
    ) -> SCNNode {
        let node = SCNNode()
        let length = segment.length
        guard length > 0.02 else { return node }

        let holes = holes(on: segment, room: room)
        let height = room.ceilingHeight

        /// A piece of wall spanning `from`..`to` along the run, `bottom`..`top`
        /// in height.
        func piece(from: Double, to: Double, bottom: Double, top: Double) {
            let w = to - from
            let h = top - bottom
            guard w > 0.015, h > 0.015 else { return }
            let box = SCNBox(
                width: CGFloat(w), height: CGFloat(h),
                length: CGFloat(wallThickness), chamferRadius: 0)
            box.materials = [material(wallInk, cull: .front)]
            let piece = SCNNode(geometry: box)
            piece.position = SCNVector3(Float(from + w / 2 - length / 2), Float(bottom + h / 2), 0)
            node.addChildNode(piece)
        }

        var cursor = 0.0
        for hole in holes {
            piece(from: cursor, to: hole.start, bottom: 0, top: height)
            // Under the sill, and over the head. A door has no under; a
            // window at the ceiling has no over. Both fall out of the
            // guard in `piece` rather than needing a special case.
            piece(from: hole.start, to: hole.end, bottom: 0, top: hole.sill)
            piece(from: hole.start, to: hole.end, bottom: hole.head, top: height)
            cursor = max(cursor, hole.end)
        }
        piece(from: cursor, to: length, bottom: 0, top: height)

        // Stand the run in the room. Plan y is SceneKit z.
        let mid = SCNVector3(
            Float((segment.x1 + segment.x2) / 2), 0, Float((segment.y1 + segment.y2) / 2))
        node.position = mid
        node.eulerAngles = SCNVector3(
            0, Float(-atan2(segment.y2 - segment.y1, segment.x2 - segment.x1)), 0)
        return node
    }

    // MARK: - The leaves, and how each kind moves

    /// How this opening's leaf actually moves.
    ///
    /// The whole point of switching on the authored kind: a sliding door that
    /// swings open is a lie about the building, and this app already knows the
    /// difference because net wall area needed it.
    enum LeafMotion {
        /// Hinged at one jamb.
        case swing(hingeAtStart: Bool)
        /// Hinged at BOTH jambs, meeting in the middle.
        case pair
        /// Runs along the wall, staying in its own plane.
        case slide
        /// Runs into the wall and disappears.
        case pocket
        /// Lifts, like a garage door.
        case lift
        /// Hinged at the head, swinging out at the bottom — an awning.
        case tiltTop
        /// Hinged at the sill, tipping in at the top — a hopper.
        case tiltBottom
        /// Folds in half against one jamb.
        case fold(pair: Bool)
        /// Nothing moves. A cased opening has no leaf at all; a picture
        /// window and glass block have one that does not open, and pretending
        /// otherwise would be the same lie as the swinging slider.
        case fixed
    }

    static func motion(for opening: FloorPlanGeometry.Opening) -> LeafMotion {
        guard let kind = opening.detail else {
            // A detection knows only door / window / hole. The single-leaf
            // swing is the same convention every other renderer here falls
            // back to when the hardware is unknown.
            switch opening.kind {
            case .opening: return .fixed
            case .door: return .swing(hingeAtStart: opening.hingeAtStart ?? true)
            case .window: return .swing(hingeAtStart: true)
            }
        }
        switch kind {
        case .doorSingle, .doorEntry:
            return .swing(hingeAtStart: opening.hingeAtStart ?? true)
        case .doorDouble, .doorFrench:
            return .pair
        case .doorSliding, .doorBypass, .doorPatio:
            return .slide
        case .doorPocket:
            return .pocket
        case .doorGarage:
            return .lift
        case .doorBifold:
            return .fold(pair: false)
        case .doorBifoldDouble:
            return .fold(pair: true)
        case .doorCased:
            return .fixed
        case .windowAwning, .windowTransom:
            return .tiltTop
        case .windowSmall, .windowHalfRound:
            return .tiltBottom
        case .windowSliding, .windowDoubleHung:
            return .slide
        case .windowPicture, .windowGlassBlock, .windowBay, .windowBow:
            return .fixed
        case .windowStandard, .windowCasement, .windowEgress, .windowWide:
            return .swing(hingeAtStart: true)
        }
    }

    /// A leaf, positioned in its hole and pivoted so it moves correctly.
    ///
    /// Every leaf is built along its own local x with the pivot moved to the
    /// hinge, which is what makes `rotateBy` about y swing it on the jamb
    /// rather than spin it about its middle.
    private static func leafNode(
        _ opening: FloorPlanGeometry.Opening, room: Room
    ) -> SCNNode? {
        let motion = motion(for: opening)
        if case .fixed = motion, opening.kind == .opening { return nil }

        let seg = opening.segment
        let width = seg.length
        guard width > 0.05 else { return nil }
        let (sill, head) = extent(of: opening, ceiling: room.ceilingHeight)
        let height = head - sill
        guard height > 0.05 else { return nil }

        let isGlass = opening.kind == .window
        let carrier = SCNNode()
        carrier.name = "leaf"
        carrier.position = SCNVector3(
            Float((seg.x1 + seg.x2) / 2), Float(sill + height / 2),
            Float((seg.y1 + seg.y2) / 2))
        carrier.eulerAngles = SCNVector3(0, Float(-atan2(seg.y2 - seg.y1, seg.x2 - seg.x1)), 0)

        func panel(width w: Double, height h: Double) -> SCNNode {
            let box = SCNBox(
                width: CGFloat(w), height: CGFloat(h), length: 0.035, chamferRadius: 0.004)
            let m = material(isGlass ? glassInk : leafInk)
            m.isDoubleSided = true
            if isGlass { m.transparency = 0.55 }
            box.materials = [m]
            return SCNNode(geometry: box)
        }

        let leaf = Leaf(motion: motion, width: width, height: height)

        switch motion {
        case .pair, .fold(pair: true):
            for side in [-1.0, 1.0] {
                let half = width / 2
                let node = panel(width: half, height: height)
                // Pivot to the jamb this half hangs from.
                node.pivot = SCNMatrix4MakeTranslation(Float(side * half / 2), 0, 0)
                node.position = SCNVector3(Float(side * half / 2), 0, 0)
                carrier.addChildNode(node)
                leaf.panels.append(Leaf.Panel(node: node, side: side))
            }
        case .swing(let hingeAtStart):
            let side = hingeAtStart ? -1.0 : 1.0
            let node = panel(width: width, height: height)
            node.pivot = SCNMatrix4MakeTranslation(Float(side * width / 2), 0, 0)
            node.position = SCNVector3(Float(side * width / 2), 0, 0)
            carrier.addChildNode(node)
            leaf.panels.append(Leaf.Panel(node: node, side: side))
        case .fold(pair: false):
            let node = panel(width: width, height: height)
            node.pivot = SCNMatrix4MakeTranslation(Float(-width / 2), 0, 0)
            node.position = SCNVector3(Float(-width / 2), 0, 0)
            carrier.addChildNode(node)
            leaf.panels.append(Leaf.Panel(node: node, side: -1))
        default:
            let node = panel(width: width, height: height)
            carrier.addChildNode(node)
            leaf.panels.append(Leaf.Panel(node: node, side: 1))
        }

        carrier.setValue(leaf, forUndefinedKey: "leaf")
        Registry.shared.leaves.append(leaf)
        return carrier
    }

    /// One openable thing, and the state needed to open it.
    final class Leaf {
        struct Panel {
            let node: SCNNode
            /// -1 hinged at the start jamb, +1 at the end.
            let side: Double
        }
        let motion: LeafMotion
        let width: Double
        let height: Double
        var panels: [Panel] = []
        private(set) var isOpen = false

        init(motion: LeafMotion, width: Double, height: Double) {
            self.motion = motion
            self.width = width
            self.height = height
        }

        func set(open: Bool, animated: Bool = true) {
            guard open != isOpen else { return }
            isOpen = open
            let duration = animated ? 0.55 : 0.0
            for panel in panels { apply(panel, open: open, duration: duration) }
        }

        func toggle() { set(open: !isOpen) }

        private func apply(_ panel: Panel, open: Bool, duration: TimeInterval) {
            let node = panel.node
            SCNTransaction.begin()
            SCNTransaction.animationDuration = duration
            SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            switch motion {
            case .swing, .pair:
                // Swings AWAY from the hinge side, which reads as opening
                // into the room the camera is looking into.
                let angle = open ? Float(-panel.side * 1.65) : 0
                node.eulerAngles = SCNVector3(0, angle, 0)
            case .fold:
                // A fold is a swing that only gets halfway, with the leaf
                // squashed to the width it folds down to. Cheaper than
                // hinging two sub-panels and reads the same at this size.
                node.eulerAngles = SCNVector3(0, open ? Float(-panel.side * 1.3) : 0, 0)
                node.scale = SCNVector3(open ? 0.5 : 1, 1, 1)
            case .slide:
                node.position = SCNVector3(
                    Float(open ? width * 0.92 : 0), node.position.y, node.position.z)
            case .pocket:
                node.position = SCNVector3(
                    Float(open ? width * 0.98 : 0), node.position.y, node.position.z)
                node.opacity = open ? 0.15 : 1
            case .lift:
                node.position = SCNVector3(
                    node.position.x, Float(open ? height * 0.95 : 0), node.position.z)
            case .tiltTop:
                // Hinged at the head: the pivot goes to the top edge and the
                // bottom swings out.
                node.pivot = SCNMatrix4MakeTranslation(0, Float(height / 2), 0)
                node.position = SCNVector3(node.position.x, Float(height / 2), node.position.z)
                node.eulerAngles = SCNVector3(open ? 0.9 : 0, 0, 0)
            case .tiltBottom:
                node.pivot = SCNMatrix4MakeTranslation(0, Float(-height / 2), 0)
                node.position = SCNVector3(node.position.x, Float(-height / 2), node.position.z)
                node.eulerAngles = SCNVector3(open ? -0.75 : 0, 0, 0)
            case .fixed:
                break
            }
            SCNTransaction.commit()
        }
    }

    /// Every leaf in the scene currently being built.
    ///
    /// A registry rather than a return value because leaves are created deep
    /// inside the node tree and the screen needs all of them to run
    /// `Open all`. Cleared before each build — a scene is built once per
    /// presentation, so there is no lifetime subtlety to get wrong here.
    final class Registry {
        static let shared = Registry()
        var leaves: [Leaf] = []
        func reset() { leaves.removeAll() }
    }

    // MARK: - Objects

    private static func objectNode(_ object: FloorPlanGeometry.Plan.PlacedObject) -> SCNNode {
        let height = max(0.15, object.height)
        let box = SCNBox(
            width: CGFloat(max(0.1, object.width)), height: CGFloat(height),
            length: CGFloat(max(0.1, object.depth)), chamferRadius: 0.02)
        box.materials = [material(UIColor(red: 0.72, green: 0.75, blue: 0.79, alpha: 1))]
        let node = SCNNode(geometry: box)
        node.position = SCNVector3(
            Float(object.centre.x), Float(height / 2), Float(object.centre.y))
        node.eulerAngles = SCNVector3(0, Float(-object.rotation * .pi / 180), 0)
        return node
    }
}
