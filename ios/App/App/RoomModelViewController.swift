import UIKit
import SceneKit
import SceneKit.ModelIO
import ModelIO
import Metal

/**
 * The dollhouse: the scanned room as a 3D model on a plain background.
 *
 * Every choice in here was verified by rendering REAL scans from this phone
 * offscreen on the Mac and looking at the images (scratchpad harness,
 * render.swift) — the first version shipped blind and was white-on-white.
 * What that harness proved, all of it invisible in a green build:
 *
 *   - RoomPlan's USDZ ships broken normals ("invalid normals data"), so
 *     lighting cannot shade anything until Model I/O rebuilds them.
 *   - It ships NO texture coordinates, so a floor texture samples one
 *     undefined point and paints the floor a single flat colour.
 *   - Every surface is a plane in its LOCAL X-Y laid flat by the node's
 *     transform — so planar UVs must project onto the two axes the geometry
 *     actually spans, not onto world X-Z.
 *   - The default camera orbits the world origin, which is wherever the
 *     scan happened to start — recentring the model is what makes rotation
 *     feel attached to the room instead of flinging it around the screen.
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

        let sceneView = SCNView(frame: .zero)
        sceneView.translatesAutoresizingMaskIntoConstraints = false
        sceneView.antialiasingMode = .multisampling4X
        // The harness palette is tuned for exactly this backdrop — change
        // one and the other stops reading.
        let backdrop = UIColor(red: 0.72, green: 0.73, blue: 0.75, alpha: 1)
        view.backgroundColor = backdrop
        sceneView.backgroundColor = backdrop

        // Model I/O first: it can rebuild the normals the export corrupted.
        let asset = MDLAsset(url: url)
        asset.loadTextures()
        Self.fixNormals(in: asset)
        let scene = SCNScene(mdlAsset: asset)
        scene.background.contents = backdrop

        Self.paint(scene)

        // Recentre on the geometry (markers sit outside the room and would
        // skew the pivot), so orbiting rotates the room about itself.
        let (bmin, bmax) = Self.geometryBounds(of: scene.rootNode)
        let center = SCNVector3((bmin.x + bmax.x) / 2, (bmin.y + bmax.y) / 2, (bmin.z + bmax.z) / 2)
        let wrapper = SCNNode()
        for child in scene.rootNode.childNodes { wrapper.addChildNode(child) }
        wrapper.position = SCNVector3(-center.x, -center.y, -center.z)
        scene.rootNode.addChildNode(wrapper)

        Self.light(scene)

        // Start at the dollhouse angle, framing the whole room.
        let dx = bmax.x - bmin.x, dy = bmax.y - bmin.y, dz = bmax.z - bmin.z
        let radius = 0.5 * (dx * dx + dy * dy + dz * dz).squareRoot()
        let camNode = SCNNode()
        camNode.camera = SCNCamera()
        // Managed z-range: a fixed zNear of 1.0 slices the walls open the
        // moment a pinch zooms inside a metre of them.
        camNode.camera!.automaticallyAdjustsZRange = true
        let elevation: Float = 0.9, dist = max(radius, 0.5) * 1.9
        camNode.position = SCNVector3(dist * cos(elevation) * 0.56,
                                      dist * sin(elevation),
                                      dist * cos(elevation) * 0.83)
        camNode.look(at: SCNVector3Zero)
        scene.rootNode.addChildNode(camNode)

        sceneView.scene = scene
        sceneView.pointOfView = camNode
        // No autoenabled lighting on top of our own — that double exposure
        // is part of what washed the first version out.
        sceneView.autoenablesDefaultLighting = false

        // One finger orbits the room about its centre, two fingers pan,
        // pinch zooms — the grammar every 3D viewer on iOS shares. The
        // turntable mode keeps the floor level so the model can never end
        // up upside down.
        sceneView.allowsCameraControl = true
        sceneView.defaultCameraController.interactionMode = .orbitTurntable
        sceneView.defaultCameraController.target = SCNVector3Zero
        sceneView.defaultCameraController.inertiaEnabled = true

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

    // MARK: - Geometry repair

    private static func fixNormals(in asset: MDLAsset) {
        for i in 0..<asset.count { fixNormals(asset.object(at: i)) }
    }

    private static func fixNormals(_ object: MDLObject) {
        if let mesh = object as? MDLMesh {
            // The crease path needs per-face-unique vertices to split hard
            // edges; without this it can emit zero normals for some meshes.
            try? mesh.makeVerticesUniqueAndReturnError()
            mesh.addNormals(withAttributeNamed: MDLVertexAttributeNormal, creaseThreshold: 0.9)
        }
        for child in object.children.objects { fixNormals(child) }
    }

    /**
     * Planar texture coordinates, projected onto the two axes the geometry
     * actually spans. One texture tile covers two metres of real floor.
     */
    private static func withPlanarUVs(_ geometry: SCNGeometry) -> SCNGeometry {
        guard let vertexSource = geometry.sources(for: .vertex).first else { return geometry }
        let count = vertexSource.vectorCount
        let stride = vertexSource.dataStride
        let offset = vertexSource.dataOffset

        var positions: [(Float, Float, Float)] = []
        positions.reserveCapacity(count)
        vertexSource.data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
            for i in 0..<count {
                let base = raw.baseAddress! + i * stride + offset
                positions.append((base.load(fromByteOffset: 0, as: Float.self),
                                  base.load(fromByteOffset: 4, as: Float.self),
                                  base.load(fromByteOffset: 8, as: Float.self)))
            }
        }

        func extent(_ axis: Int) -> Float {
            let values = positions.map { [$0.0, $0.1, $0.2][axis] }
            return (values.max() ?? 0) - (values.min() ?? 0)
        }
        let ranked = [0, 1, 2].sorted { extent($0) > extent($1) }
        let (ua, va) = (ranked[0], ranked[1])
        let uvs: [CGPoint] = positions.map { p in
            let arr = [p.0, p.1, p.2]
            return CGPoint(x: CGFloat(arr[ua]) / 2.0, y: CGFloat(arr[va]) / 2.0)
        }

        return SCNGeometry(
            sources: geometry.sources + [SCNGeometrySource(textureCoordinates: uvs)],
            elements: geometry.elements,
        )
    }

    // MARK: - Materials

    private static func paint(_ scene: SCNScene) {
        let floorMat = material(roughness: 0.85, texture: plankTexture())
        let wallMat = material(red: 0.97, green: 0.965, blue: 0.95, roughness: 0.8)
        let openingMat = material(red: 0.22, green: 0.25, blue: 0.30, roughness: 0.5)
        let objectMat = material(red: 0.88, green: 0.88, blue: 0.87, roughness: 0.65)

        func walk(_ node: SCNNode) {
            if let geometry = node.geometry {
                let name = (node.name ?? "").lowercased()
                if name.contains("floor") {
                    node.geometry = withPlanarUVs(geometry)
                    node.geometry!.materials = [floorMat]
                } else if name.contains("wall") {
                    geometry.materials = [wallMat]
                } else if name.contains("door") || name.contains("window") || name.contains("opening") {
                    geometry.materials = [openingMat]
                } else if !name.isEmpty {
                    geometry.materials = [objectMat]
                }
            }
            for child in node.childNodes { walk(child) }
        }
        walk(scene.rootNode)
    }

    private static func material(
        red: CGFloat = 1, green: CGFloat = 1, blue: CGFloat = 1,
        roughness: CGFloat, texture: UIImage? = nil,
    ) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        if let texture {
            m.diffuse.contents = texture
            m.diffuse.wrapS = .repeat
            m.diffuse.wrapT = .repeat
            m.diffuse.mipFilter = .linear
            m.diffuse.maxAnisotropy = 16
        } else {
            m.diffuse.contents = UIColor(red: red, green: green, blue: blue, alpha: 1)
        }
        m.roughness.contents = roughness
        m.metalness.contents = 0.0
        // The export's walls are single-sided and would vanish seen from
        // outside — which reads as a missing wall, not a viewpoint.
        m.isDoubleSided = true
        return m
    }

    /// Greige planks, one tile = 2 m × 2 m of floor. Drawn rather than
    /// bundled: an asset can go missing from a build, a function cannot.
    private static func plankTexture() -> UIImage {
        let size = 1024
        let plankH = size / 6
        // scale 1: the default inherits the screen's 3x and silently makes
        // the bitmap 3072² — 9x the memory the harness verified, for planks
        // nobody zooms into. sRGB to match the verified colours exactly.
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        format.preferredRange = .standard
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: format)
        return renderer.image { context in
            let ctx = context.cgContext
            for row in 0..<6 {
                let tone = 0.58 + Double.random(in: -0.11...0.11)
                ctx.setFillColor(CGColor(srgbRed: tone + 0.03, green: tone - 0.005, blue: tone - 0.045, alpha: 1))
                ctx.fill(CGRect(x: 0, y: row * plankH, width: size, height: plankH))
                ctx.setFillColor(CGColor(srgbRed: 0.34, green: 0.31, blue: 0.28, alpha: 1))
                ctx.fill(CGRect(x: 0, y: row * plankH, width: size, height: 7))
                let joint = Int.random(in: size / 5...(4 * size / 5))
                ctx.fill(CGRect(x: joint, y: row * plankH, width: 7, height: plankH))
                for _ in 0..<10 {
                    let g = tone - Double.random(in: 0.04...0.12)
                    ctx.setStrokeColor(CGColor(srgbRed: g + 0.02, green: g - 0.01, blue: g - 0.05, alpha: 0.6))
                    ctx.setLineWidth(CGFloat.random(in: 0.8...2.2))
                    let y = CGFloat(row * plankH) + CGFloat.random(in: 5...CGFloat(plankH - 5))
                    ctx.move(to: CGPoint(x: 0, y: y))
                    ctx.addLine(to: CGPoint(x: CGFloat(size), y: y + CGFloat.random(in: -4...4)))
                    ctx.strokePath()
                }
            }
        }
    }

    // MARK: - Lighting and bounds

    private static func light(_ scene: SCNScene) {
        let ambient = SCNNode()
        ambient.light = SCNLight()
        ambient.light!.type = .ambient
        ambient.light!.intensity = 400
        scene.rootNode.addChildNode(ambient)

        let key = SCNNode()
        key.light = SCNLight()
        key.light!.type = .directional
        key.light!.intensity = 900
        key.light!.castsShadow = true
        key.light!.shadowMode = .forward
        key.light!.shadowSampleCount = 16
        key.light!.shadowRadius = 10
        key.light!.shadowColor = UIColor(white: 0, alpha: 0.28)
        key.eulerAngles = SCNVector3(-Float.pi / 3, Float.pi / 5, 0)
        scene.rootNode.addChildNode(key)

        let fill = SCNNode()
        fill.light = SCNLight()
        fill.light!.type = .directional
        fill.light!.intensity = 350
        fill.light!.castsShadow = false
        fill.eulerAngles = SCNVector3(-Float.pi / 4, Float.pi + Float.pi / 4, 0)
        scene.rootNode.addChildNode(fill)
    }

    /// Bounds of the geometry only — RoomPlan's section markers are empty
    /// nodes that can sit far outside the room and would skew the centre.
    private static func geometryBounds(of root: SCNNode) -> (SCNVector3, SCNVector3) {
        var lo = SCNVector3(Float.greatestFiniteMagnitude, Float.greatestFiniteMagnitude, Float.greatestFiniteMagnitude)
        var hi = SCNVector3(-Float.greatestFiniteMagnitude, -Float.greatestFiniteMagnitude, -Float.greatestFiniteMagnitude)
        func grow(_ node: SCNNode) {
            if node.geometry != nil {
                let (nmin, nmax) = node.boundingBox
                for corner in [SCNVector3(nmin.x, nmin.y, nmin.z), SCNVector3(nmax.x, nmin.y, nmin.z),
                               SCNVector3(nmin.x, nmax.y, nmin.z), SCNVector3(nmin.x, nmin.y, nmax.z),
                               SCNVector3(nmax.x, nmax.y, nmin.z), SCNVector3(nmax.x, nmin.y, nmax.z),
                               SCNVector3(nmin.x, nmax.y, nmax.z), SCNVector3(nmax.x, nmax.y, nmax.z)] {
                    let w = node.convertPosition(corner, to: nil)
                    lo = SCNVector3(min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z))
                    hi = SCNVector3(max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z))
                }
            }
            for child in node.childNodes { grow(child) }
        }
        grow(root)
        if lo.x > hi.x { return (SCNVector3Zero, SCNVector3Zero) }
        return (lo, hi)
    }
}
