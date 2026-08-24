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
        var tint: Color? = nil
        /// **The catalogue objects the operator placed** — cabinets,
        /// appliances, fixtures. Separate from `plan.objects`, which is only
        /// what the SCANNER recognised, and the reason the first dollhouse
        /// came up as bare rooms: it drew the detections and never asked for
        /// the things anybody had actually put on the plan.
        var placed: [RoomObject] = []
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

    private static let wallInk = UIColor(red: 0.965, green: 0.965, blue: 0.960, alpha: 1)
    /// **The cut top of the wall, and it is nearly black on purpose.**
    ///
    /// Read off the reference's own 3D view, 23 Aug 2026: their walls are
    /// sliced at waist height and the cut face is a heavy charcoal band. It is
    /// the poché of a plan drawing standing up — the one mark that says a wall
    /// has substance — and the first attempt here used a polite grey a shade
    /// off the face, which read as no thickness at all.
    private static let wallCapInk = UIColor(red: 0.16, green: 0.17, blue: 0.18, alpha: 1)

    /// **How high the walls are cut.**
    ///
    /// The whole model changed shape around this number. The first dollhouse
    /// stood walls full height and hid the near ones with front-face culling,
    /// which meant: no wall tops (they face the camera, so they culled first),
    /// z-fighting wherever two pieces met, and a camera permanently inside one
    /// room. The reference does the obvious thing instead — slice every wall
    /// at about waist height and look down into the whole floor at once.
    ///
    /// Everything improves at once. Culling is unnecessary, so tops draw and
    /// the fighting stops; every room is visible together; and there is a
    /// third less geometry.
    ///
    /// 1.15 m sits above a counter and below a door head, so a counter run
    /// still reads as a counter and every doorway still reads as a hole.
    private static let cutHeight = 1.15
    /// Door leaves are WHITE, not the wood tone the first pass used.
    ///
    /// The reference's leaves are plain white panels, and it is the right
    /// call for a claim document: a brown door is a guess about somebody's
    /// house, and this model is evidence, not decoration.
    private static let leafInk = UIColor(red: 0.985, green: 0.985, blue: 0.985, alpha: 1)
    /// Barely tinted, for the same reason — enough to read as glazing, not
    /// enough to look like a swimming pool. The first version was a saturated
    /// blue that dominated every wall it sat in.
    private static let glassInk = UIColor(red: 0.86, green: 0.90, blue: 0.93, alpha: 1)
    private static let objectInk = UIColor(red: 0.88, green: 0.88, blue: 0.89, alpha: 1)

    /// **90 mm, which is a real stud wall.** 2x4 framing plus 12.7 mm board
    /// each side is about 114; an interior partition drawn at 90 reads right
    /// without eating the small rooms this trade works in.
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

        // Merge each room's shell — see the note on `shell` in `node(for:)`.
        for room in world.childNodes {
            guard let shell = room.childNode(withName: "shell", recursively: false) else {
                continue
            }
            let merged = shell.flattenedClone()
            merged.name = "shell"
            room.replaceChildNode(shell, with: merged)
        }

        // Centre the model on the origin so the camera orbits its middle
        // rather than its corner.
        let (centre, span) = bounds(of: rooms)
        world.position = SCNVector3(Float(-centre.x), 0, Float(-centre.y))
        scene.rootNode.addChildNode(world)

        addLighting(to: scene, span: span)
        scene.rootNode.addChildNode(cameraRig(span: span))
        Registry.shared.scene = scene

        // **Written to a file, because asking for it has not worked.** Three
        // builds have now come back "empty" or "the same", and the one line
        // that separates the possible causes is a line nobody has read off
        // the screen. `ScanLens.appendToDiagnostics` already goes somewhere
        // `devicectl device copy from` can fetch as an ordinary user, so the
        // fact can be collected instead of requested.
        ScanLens.appendToDiagnostics(diagnosis(rooms: rooms, scene: scene, span: span))
        return scene
    }

    /// Everything that could make this screen look empty, measured rather
    /// than assumed.
    private static func diagnosis(rooms: [Room], scene: SCNScene, span: Double) -> String {
        var out = "DOLLHOUSE: rooms=\(rooms.count) span=\(String(format: "%.2f", span))\n"
        for room in rooms.prefix(12) {
            out +=
                "DOLLHOUSE:   \(room.name) origin=(\(String(format: "%.2f", room.origin.x)),"
                + "\(String(format: "%.2f", room.origin.y))) "
                + "size=\(String(format: "%.2f", room.plan.width))x"
                + "\(String(format: "%.2f", room.plan.height)) "
                + "segments=\(room.plan.segments.count) openings=\(room.plan.openings.count) "
                + "polygon=\(room.plan.polygon.count) ceiling=\(String(format: "%.2f", room.ceilingHeight))\n"
        }
        // What actually ended up in the graph, which is the question the room
        // counts above cannot answer.
        var geometryNodes = 0
        var totalNodes = 0
        scene.rootNode.enumerateHierarchy { node, _ in
            totalNodes += 1
            if node.geometry != nil { geometryNodes += 1 }
        }
        out += "DOLLHOUSE: nodes=\(totalNodes) withGeometry=\(geometryNodes) "
        out += "leaves=\(Registry.shared.leaves.count) "
        out += "camera=\(scene.rootNode.childNode(withName: "camera", recursively: false) != nil)\n"
        return out
    }

    /// The camera rig: **yaw → pitch → camera**, so orbit is two angles and
    /// a distance rather than a free-floating transform.
    ///
    /// The first version built a camera and handed it straight to
    /// `SCNView.pointOfView` without adding it to the graph. A detached point
    /// of view renders nothing, which is precisely what the owner saw.
    ///
    /// The rig shape is what makes the limits possible: `DollhouseSceneView`
    /// clamps the pitch node's one angle, and no amount of dragging can put
    /// the camera below the floor looking up. SceneKit's own
    /// `allowsCameraControl` offers no such clamp, which is why it is off.
    ///
    /// Lifted to eye height above the model's floor so the default view looks
    /// slightly DOWN into the rooms rather than at their skirting.
    static func cameraRig(span: Double) -> SCNNode {
        let rig = SCNNode()
        rig.name = "rig"
        rig.position = SCNVector3(0, 0.9, 0)

        let pitch = SCNNode()
        pitch.name = "pitch"
        pitch.eulerAngles = SCNVector3(-40 * Float.pi / 180, 0, 0)
        rig.addChildNode(pitch)

        let camera = SCNNode()
        camera.name = "camera"
        camera.camera = SCNCamera()
        camera.camera?.fieldOfView = 50
        camera.camera?.zNear = 0.05
        camera.camera?.zFar = 1000
        camera.position = SCNVector3(0, 0, Float(max(6.0, span * 1.35)))
        pitch.addChildNode(camera)
        return rig
    }

    private static func addLighting(to scene: SCNScene, span: Double) {
        let sun = SCNNode()
        sun.light = SCNLight()
        sun.light?.type = .directional
        sun.light?.intensity = 780
        sun.light?.castsShadow = true
        // **Forward, small map, few samples.** The owner: *"when I turn things
        // around, we have a lot of stutter."* Deferred shadows at radius 6 are
        // a full-screen pass with a wide blur every single frame, which is
        // most of a phone's budget for a model this simple. Forward with a
        // modest map costs a fraction and at this scale looks the same.
        sun.light?.shadowMode = .forward
        sun.light?.shadowMapSize = CGSize(width: 1024, height: 1024)
        sun.light?.shadowSampleCount = 4
        sun.light?.shadowRadius = 2
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

        // **The static shell, under one node so it can be merged.** Thirteen
        // walls cut around eight openings is well over a hundred separate draw
        // calls, and not one of them ever moves. `flattenedClone` in `scene`
        // collapses this subtree into a single mesh; doors and contents stay
        // outside it because those DO move and still have to be tapped.
        let shell = SCNNode()
        shell.name = "shell"
        shell.addChildNode(floorNode(room))
        for segment in room.plan.segments {
            shell.addChildNode(wallNode(segment, room: room))
        }
        node.addChildNode(shell)
        for opening in room.plan.openings {
            if let leaf = leafNode(opening, room: room) { node.addChildNode(leaf) }
        }
        // Scanner detections first, then everything placed by hand. A placed
        // object wins where both describe the same thing: the operator has
        // already corrected the scan by putting it there.
        let placedIsAnnotation: (RoomObject) -> Bool = { $0.entry?.isAnnotation == true }
        let detected = room.plan.objects.filter { object in
            !room.placed.contains {
                hypot($0.x - Double(object.centre.x), $0.y - Double(object.centre.y)) < 0.4
            }
        }
        // **All contents under one node**, so the operator can take them out
        // of the picture in a tap. The owner: *"we have to have ability to
        // keep or remove the appliances."* Hiding a subtree beats rebuilding
        // the scene — a rebuild would slam every door shut and lose the
        // camera he had just orbited into place.
        let contents = SCNNode()
        contents.name = "contents"
        for object in detected { contents.addChildNode(detectedNode(object)) }
        for object in room.placed where !placedIsAnnotation(object) {
            contents.addChildNode(placedNode(object))
        }
        node.addChildNode(contents)
        return node
    }

    /// One catalogue object, standing on the floor at its measured footprint.
    ///
    /// **Height is the object's own**, per the owner's standing instruction
    /// that a cabinet keeps its height and stands on the floor — which is the
    /// whole reason objects are not openings.
    ///
    /// An EXCLUDED object draws pale and translucent rather than vanishing:
    /// it is still in the room, just out of the claim, and a model that
    /// deleted it would disagree with the plan beside it.
    static func placedNode(_ object: RoomObject) -> SCNNode {
        let entry = object.entry
        let width = max(0.08, object.width)
        let depth = max(0.08, object.depth)
        let height = max(0.10, object.height)

        let node = SCNNode()
        node.name = "object:\(object.id)"
        node.addChildNode(
            DollhouseModel.build(
                shape: entry?.shape ?? .box, width: width, depth: depth, height: height,
                included: object.included))
        node.position = SCNVector3(
            Float(object.x), Float(mountHeight(for: entry, height: height)), Float(object.y))
        node.eulerAngles = SCNVector3(0, Float(-object.rotation * .pi / 180), 0)
        return node
    }

    /// **How far off the floor the thing actually hangs.**
    ///
    /// The owner, looking at his own living room in the model: *"why doesn't
    /// it show the TV on the wall? There is a TV on the wall."* It WAS being
    /// drawn — lying flat on the floor, a 55-inch panel four inches deep,
    /// easy to miss and completely wrong.
    ///
    /// **This is the fourth time the same gap has bitten**: a skylight is in
    /// the roof, a storm window sits over another window, a wall A/C hangs
    /// high on a wall, and now a television. Nothing in `RoomObject` or in
    /// `ObjectCatalog.Entry` can say where a thing is mounted, and the
    /// television's own `sizeNote` even admits it — *"wall-hung or on a
    /// stand"* — in prose that no code can read.
    ///
    /// **This is a stopgap and is deliberately shallow.** It reads the SHAPE,
    /// which is the only structured hint the catalogue has, and lifts the two
    /// families that are always mounted. The real fix is a `mount` on the
    /// catalogue entry — floor, wall, ceiling — which is a change to a
    /// compiled table rather than a migration, and which `Docs/Custom-Objects-Spec.md`
    /// should carry alongside the questions it already asks the owner. Until
    /// then a `shelving` object that genuinely does stand on the floor will be
    /// lifted wrongly, and that is a visible error rather than a quiet one.
    private static func mountHeight(for entry: ObjectCatalog.Entry?, height: Double) -> Double {
        switch entry?.shape {
        case .wallCabinet:
            // Underside at 1.4 m is the standard against a 0.9 m counter.
            return 1.4 + height / 2
        case .shelving where entry?.slug == "television":
            // Centre at eye height sitting down, which is where a television
            // is actually hung.
            return 1.1 + height / 2
        default:
            return height / 2
        }
    }

    /// The slab. Uses the room's real outline where it has one, so an L-shaped
    /// room gets an L-shaped floor rather than the bounding box it fits in.
    /// A floorboard texture, drawn once and reused.
    ///
    /// The owner: *"floor has no texture."* A flat fill reads as a diagram; a
    /// grain and a plank joint read as a room. Generated rather than shipped
    /// as an asset because it has to tile seamlessly at any room size, and a
    /// drawn one can guarantee that where a photograph cannot.
    private static let floorTexture: UIImage = {
        let side: CGFloat = 512
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
        return renderer.image { ctx in
            let g = ctx.cgContext
            UIColor(red: 0.855, green: 0.815, blue: 0.760, alpha: 1).setFill()
            g.fill(CGRect(x: 0, y: 0, width: side, height: side))
            // Four courses of boards, each course offset half a board so the
            // butt joints stagger the way laid flooring does.
            let courses = 4
            let boardH = side / CGFloat(courses)
            for row in 0..<courses {
                let y = CGFloat(row) * boardH
                UIColor(white: 0, alpha: 0.10).setStroke()
                g.setLineWidth(1.5)
                g.move(to: CGPoint(x: 0, y: y))
                g.addLine(to: CGPoint(x: side, y: y))
                g.strokePath()
                let offset = row.isMultiple(of: 2) ? 0.0 : side / 4
                for joint in stride(from: offset, to: side, by: side / 2) {
                    UIColor(white: 0, alpha: 0.13).setStroke()
                    g.setLineWidth(1.2)
                    g.move(to: CGPoint(x: joint, y: y))
                    g.addLine(to: CGPoint(x: joint, y: y + boardH))
                    g.strokePath()
                }
                // Grain: a few faint lengthwise strokes per board.
                for i in 0..<3 {
                    let gy = y + boardH * (CGFloat(i) + 1) / 4
                    UIColor(white: 0.35, alpha: 0.05).setStroke()
                    g.setLineWidth(1)
                    g.move(to: CGPoint(x: 0, y: gy))
                    g.addLine(to: CGPoint(x: side, y: gy))
                    g.strokePath()
                }
            }
        }
    }()

    private static func floorNode(_ room: Room) -> SCNNode {
        let slabDepth = 0.06
        let colour = room.tint.map { UIColor($0).withAlphaComponent(1) } ?? UIColor.white

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
            m.diffuse.contents = floorTexture
            m.diffuse.wrapS = .repeat
            m.diffuse.wrapT = .repeat
            // One tile per 1.2 m of floor, so a board is board-sized in a
            // cupboard and in a living room alike rather than stretching to
            // fit whatever room it landed in.
            let tiles = Float(max(room.plan.width, room.plan.height) / 1.2)
            m.diffuse.contentsTransform = SCNMatrix4MakeScale(tiles, tiles, 1)
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
        // A room with a ceiling lower than the cut keeps its own ceiling —
        // a crawlspace should not be sliced taller than it is.
        let cut = min(cutHeight, height)

        /// A piece of wall spanning `from`..`to` along the run, `bottom`..`top`
        /// in height.
        func piece(from: Double, to: Double, bottom: Double, top: Double) {
            // Nothing above the cut is built at all — that is the saving, and
            // the reason a room is visible from above without any culling.
            let top = min(top, cut)
            guard top > bottom else { return }

            // **Grown by a hair at each end.** Two boxes that butt on exactly
            // the same plane give the depth buffer two surfaces at one depth,
            // and it picks per pixel, per frame — which is what the owner saw
            // as vertical lines down the walls. Overlapping by a millimetre
            // means one is unambiguously inside the other and there is
            // nothing left to fight over.
            let bleed = 0.001
            let w = (to - from) + bleed * 2
            let h = top - bottom
            guard w > 0.015, h > 0.015 else { return }

            let box = SCNBox(
                width: CGFloat(w), height: CGFloat(h),
                length: CGFloat(wallThickness), chamferRadius: 0)
            // **Per-face materials, so the cap needs no geometry of its own.**
            // `SCNBox` takes six, in the order front, right, back, left, top,
            // bottom. Giving the top its own dark material is the whole of the
            // poché — the separate capping slab it replaces was half-buried in
            // the wall beneath it, and the sawtooth along every wall top was
            // those two surfaces fighting.
            let face = material(wallInk)
            let capFace = material(wallCapInk)
            box.materials = [face, face, face, face, capFace, face]

            let piece = SCNNode(geometry: box)
            piece.position = SCNVector3(
                Float(from - bleed + w / 2 - length / 2), Float(bottom + h / 2), 0)
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

        // **Which way is into the room.** The owner: *"the doors open wrong
        // directions."* They were swinging on a fixed sign, so half of them
        // opened through the wall and out of the building.
        //
        // The room's own polygon answers it: step off the opening's midpoint
        // along the wall's normal and see which side lands inside. That is
        // the same "is this wall an outer wall" test the report's outer
        // dimension chain already uses, asked of one opening instead of one
        // wall — and it beats trusting `swingInward`, which is nil on every
        // door RoomPlan detected rather than someone authored.
        let inward = interiorSign(for: seg, room: room)
        let leaf = Leaf(motion: motion, width: width, height: height, inward: inward)

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

        // **Named, not key-value-coded.** The first version hung the `Leaf`
        // on the node with `setValue(_:forUndefinedKey:)`. `SCNNode` does not
        // promise to store arbitrary keys — at best the value is dropped and
        // every tap silently finds nothing, at worst KVC raises. Either way
        // the doors do not open, which is exactly what was reported. A name
        // and an index into the registry cannot fail either way.
        carrier.name = "leaf:\(Registry.shared.leaves.count)"
        Registry.shared.leaves.append(leaf)
        return carrier
    }

    /// +1 when the room's interior lies to the LEFT of the segment's
    /// direction, -1 when it lies to the right. Falls back to +1 for a room
    /// with no closed outline, which is the same convention every other
    /// renderer here uses when the geometry cannot say.
    private static func interiorSign(
        for seg: FloorPlanGeometry.Segment, room: Room
    ) -> Double {
        guard room.plan.polygon.count >= 3 else { return 1 }
        let dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1
        let length = hypot(dx, dy)
        guard length > 0.001 else { return 1 }
        let mid = CGPoint(x: (seg.x1 + seg.x2) / 2, y: (seg.y1 + seg.y2) / 2)
        // A quarter metre off the face — far enough to clear the wall's own
        // thickness, near enough to stay in the room it belongs to.
        let nx = -dy / length * 0.25, ny = dx / length * 0.25
        let probe = CGPoint(x: mid.x + nx, y: mid.y + ny)
        return contains(room.plan.polygon, probe) ? 1 : -1
    }

    /// Even-odd point in polygon. Small enough to keep here rather than reach
    /// for a shared one — this is the only 3D consumer of it.
    private static func contains(_ polygon: [CGPoint], _ point: CGPoint) -> Bool {
        var inside = false
        var j = polygon.count - 1
        for i in polygon.indices {
            let a = polygon[i], b = polygon[j]
            if (a.y > point.y) != (b.y > point.y),
                point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x
            {
                inside.toggle()
            }
            j = i
        }
        return inside
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
        /// +1 or -1: which side of the wall the room is on, so a leaf swings
        /// into the room instead of out through the building.
        let inward: Double
        var panels: [Panel] = []
        private(set) var isOpen = false

        init(motion: LeafMotion, width: Double, height: Double, inward: Double) {
            self.motion = motion
            self.width = width
            self.height = height
            self.inward = inward
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
                // Hinged at `panel.side`, swinging toward the room's inside.
                let angle = open ? Float(-panel.side * inward * 1.65) : 0
                node.eulerAngles = SCNVector3(0, angle, 0)
            case .fold:
                // A fold is a swing that only gets halfway, with the leaf
                // squashed to the width it folds down to. Cheaper than
                // hinging two sub-panels and reads the same at this size.
                node.eulerAngles = SCNVector3(0, open ? Float(-panel.side * inward * 1.3) : 0, 0)
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
                node.eulerAngles = SCNVector3(open ? Float(0.9 * inward) : 0, 0, 0)
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

    /// Show or hide everything standing in the rooms.
    static func setContentsVisible(_ visible: Bool, in scene: SCNScene?) {
        scene?.rootNode.enumerateHierarchy { node, _ in
            if node.name == "contents" { node.isHidden = !visible }
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
        /// The scene currently on screen, so the chrome can reach into it
        /// without the SwiftUI view holding a reference SwiftUI would rebuild.
        weak var scene: SCNScene?
        func reset() {
            leaves.removeAll()
            scene = nil
        }

        /// The leaf a node belongs to, found by the name its carrier was
        /// given. Walks up, because a tap lands on the panel geometry and the
        /// carrier is its parent.
        func leaf(for node: SCNNode) -> Leaf? {
            var current: SCNNode? = node
            while let here = current {
                if let name = here.name, name.hasPrefix("leaf:"),
                    let index = Int(name.dropFirst("leaf:".count)),
                    leaves.indices.contains(index)
                {
                    return leaves[index]
                }
                current = here.parent
            }
            return nil
        }
    }

    // MARK: - Objects

    /// A SCANNER detection, modelled the same way a placed object is.
    ///
    /// **This was the half that would have gone on looking like boxes.** The
    /// first pass at real 3D forms only touched `placedNode` — the things the
    /// operator puts down by hand. But the sofa and table in a scanned room
    /// are detections, so the very objects the owner was pointing at would
    /// have stayed crates while the ones he had never placed got modelled.
    ///
    /// RoomPlan reports a category string, `ScanCatalogue` already turns that
    /// into a catalogue slug, and the entry carries the `Shape`. So the same
    /// three-step lookup the scan review uses gives a detection a real form,
    /// and a detected sofa and a placed sofa are the same object on screen —
    /// which they should be, because they are the same sofa.
    private static func detectedNode(_ object: FloorPlanGeometry.Plan.PlacedObject) -> SCNNode {
        let width = max(0.1, object.width)
        let depth = max(0.1, object.depth)
        let height = max(0.1, object.height)

        let slug = ScanCatalogue.suggestion(
            forCategoryName: object.category, lowConfidence: object.lowConfidence
        ).slug
        let entry = slug.flatMap { ObjectCatalog.entry(slug: $0) }

        let node = SCNNode()
        node.addChildNode(
            DollhouseModel.build(
                shape: entry?.shape ?? .box, width: width, depth: depth, height: height,
                included: true))
        node.position = SCNVector3(
            Float(object.centre.x),
            Float(mountHeight(for: entry, height: height)),
            Float(object.centre.y))
        node.eulerAngles = SCNVector3(0, Float(-object.rotation * .pi / 180), 0)
        return node
    }
}
