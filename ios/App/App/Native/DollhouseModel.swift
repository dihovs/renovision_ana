import SceneKit
import UIKit

/// **Furniture that looks like furniture.**
///
/// The owner, 23 Aug 2026, comparing the dollhouse to magicplan's: *"you see
/// all these boxes. We have to have 3D models instead — there's a sofa,
/// there's a table."*
///
/// ## Why these are built rather than imported
///
/// `AGENTS.md` is explicit that the reference's 3D renders are a functional
/// requirement and not artwork to copy, and there is no model file in this
/// project to load. So each form is composed from primitives at the object's
/// OWN measured size — a sofa is a plinth, a back and two arms, a table is a
/// top and four legs. That has two properties a bought model would not:
///
/// - **It fits the measurement.** A catalogue sofa is 84 inches and a scanned
///   one is whatever the LiDAR read; both get a sofa of exactly that size
///   rather than a stock model scaled until it lies about its dimensions.
/// - **It cannot contradict the takeoff.** The thing on screen is assembled
///   from the same width, depth and height the estimate is priced from.
///
/// ## Why it switches on `Shape`
///
/// `ObjectCatalog.Shape` already exists and already carries exactly this
/// judgement — its own comment says a dozen shapes cover a catalogue of any
/// size, "because what makes a toilet readable on a plan is its outline, not a
/// portrait of it". The 2D plan symbols switch on it, so switching on it here
/// means a new catalogue entry gets a 3D form for free, and the plan and the
/// model can never disagree about what kind of thing something is.
///
/// ## The look
///
/// White massing with visible seams, matching the reference: these are
/// **models of furniture, not pictures of it**. An adjuster has to read the
/// room, and a photorealistic sofa in a claim document invites an argument
/// about whose sofa it was. Seam lines are inset panels in a slightly darker
/// tone rather than textures, so they stay crisp at every zoom.
@available(iOS 17.0, *)
enum DollhouseModel {

    private static let body = UIColor(red: 0.955, green: 0.955, blue: 0.960, alpha: 1)
    private static let seam = UIColor(red: 0.855, green: 0.860, blue: 0.875, alpha: 1)
    private static let dark = UIColor(red: 0.42, green: 0.44, blue: 0.47, alpha: 1)
    private static let glass = UIColor(red: 0.72, green: 0.82, blue: 0.88, alpha: 1)

    private static func material(_ colour: UIColor, transparency: CGFloat = 1) -> SCNMaterial {
        let m = SCNMaterial()
        m.diffuse.contents = colour
        m.lightingModel = .physicallyBased
        m.roughness.contents = 0.9
        m.metalness.contents = 0.0
        m.transparency = transparency
        return m
    }

    /// A box in the object's own local space, sized and placed in metres,
    /// where the object's centre is the origin and y is up from the floor.
    private static func slab(
        _ w: Double, _ h: Double, _ d: Double, x: Double = 0, y: Double, z: Double = 0,
        colour: UIColor = body, radius: CGFloat = 0.012, transparency: CGFloat = 1
    ) -> SCNNode {
        let box = SCNBox(
            width: CGFloat(max(0.004, w)), height: CGFloat(max(0.004, h)),
            length: CGFloat(max(0.004, d)), chamferRadius: radius)
        box.materials = [material(colour, transparency: transparency)]
        let node = SCNNode(geometry: box)
        node.position = SCNVector3(Float(x), Float(y), Float(z))
        return node
    }

    private static func post(
        _ radius: Double, _ h: Double, x: Double, y: Double, z: Double,
        colour: UIColor = dark
    ) -> SCNNode {
        let cyl = SCNCylinder(radius: CGFloat(radius), height: CGFloat(max(0.004, h)))
        cyl.radialSegmentCount = 12
        cyl.materials = [material(colour)]
        let node = SCNNode(geometry: cyl)
        node.position = SCNVector3(Float(x), Float(y), Float(z))
        return node
    }

    /// Build one object's form. `width` runs local x, `depth` local z, and the
    /// result is centred on the origin with the floor at `-height / 2`, so the
    /// caller positions it by its centre exactly as a plain box was.
    static func build(
        shape: ObjectCatalog.Shape, width w: Double, depth d: Double, height h: Double,
        included: Bool
    ) -> SCNNode {
        let node = SCNNode()
        let floor = -h / 2

        /// Local y for something whose BOTTOM sits `from` above the floor and
        /// which is `tall` high — the arithmetic every part below needs.
        func level(_ from: Double, _ tall: Double) -> Double { floor + from + tall / 2 }

        switch shape {
        case .sofa, .chair:
            // Plinth, back, two arms. A chair is the same object at one seat
            // wide, which is exactly why the catalogue keeps them one family.
            let armW = min(0.16, w * 0.16)
            let backD = min(0.18, d * 0.22)
            let seatH = h * 0.42
            node.addChildNode(slab(w, seatH, d, y: level(0, seatH)))
            node.addChildNode(
                slab(w, h - seatH, backD, y: level(seatH, h - seatH), z: (d - backD) / 2))
            for side in [-1.0, 1.0] {
                node.addChildNode(
                    slab(
                        armW, h * 0.66 - seatH, d - backD, x: side * (w - armW) / 2,
                        y: level(seatH, h * 0.66 - seatH), z: -backD / 2))
            }
            // The cushion joint, which is what makes it read as seating
            // rather than as a crate.
            node.addChildNode(
                slab(
                    w - armW * 2, 0.012, d - backD, y: level(seatH, 0.012), z: -backD / 2,
                    colour: seam, radius: 0))

        case .bed:
            let baseH = h * 0.45
            node.addChildNode(slab(w, baseH, d, y: level(0, baseH)))
            // Headboard at the far end.
            node.addChildNode(
                slab(w, h - baseH, 0.06, y: level(baseH, h - baseH), z: (d - 0.06) / 2))
            // Mattress and a pillow, so the end you sleep at is obvious.
            node.addChildNode(
                slab(w * 0.96, 0.06, d * 0.94, y: level(baseH, 0.06), colour: seam, radius: 0.02))
            node.addChildNode(
                slab(
                    w * 0.7, 0.05, d * 0.16, y: level(baseH + 0.06, 0.05),
                    z: d * 0.32, colour: seam, radius: 0.02))

        case .table:
            let topH = min(0.05, h * 0.12)
            node.addChildNode(slab(w, topH, d, y: level(h - topH, topH)))
            let inset = 0.07
            for sx in [-1.0, 1.0] {
                for sz in [-1.0, 1.0] {
                    node.addChildNode(
                        post(
                            0.022, h - topH, x: sx * (w / 2 - inset),
                            y: level(0, h - topH), z: sz * (d / 2 - inset)))
                }
            }

        case .counter, .basinInCounter:
            let topH = 0.04
            node.addChildNode(slab(w, h - topH, d * 0.96, y: level(0, h - topH)))
            node.addChildNode(slab(w, topH, d, y: level(h - topH, topH), colour: seam))
            // A kickspace, which is what tells a counter from a crate.
            node.addChildNode(
                slab(w, 0.10, 0.05, y: level(0, 0.10), z: -(d * 0.96) / 2, colour: dark, radius: 0))
            if shape == .basinInCounter {
                let bowl = SCNCylinder(radius: CGFloat(min(w, d) * 0.20), height: 0.03)
                bowl.materials = [material(seam)]
                let node2 = SCNNode(geometry: bowl)
                node2.position = SCNVector3(0, Float(level(h, 0.001)), 0)
                node.addChildNode(node2)
            }

        case .wallCabinet, .shelving:
            node.addChildNode(slab(w, h, d, y: level(0, h)))
            // Two shelf lines, so it reads as storage from any angle.
            for i in 1...2 {
                node.addChildNode(
                    slab(
                        w, 0.01, d + 0.004, y: level(h * Double(i) / 3, 0.01),
                        colour: seam, radius: 0))
            }

        case .fridge, .machine, .stove:
            node.addChildNode(slab(w, h, d, y: level(0, h)))
            // The door split, and a handle or a hob depending which it is.
            if shape == .fridge {
                node.addChildNode(
                    slab(w, 0.012, 0.004, y: level(h * 0.62, 0.012), z: d / 2, colour: dark, radius: 0))
                node.addChildNode(
                    slab(0.03, h * 0.4, 0.03, x: w * 0.34, y: level(h * 0.18, h * 0.4), z: d / 2,
                        colour: dark))
            } else if shape == .stove {
                node.addChildNode(
                    slab(w * 0.92, 0.014, d * 0.9, y: level(h, 0.014), colour: dark, radius: 0))
                for sx in [-1.0, 1.0] {
                    for sz in [-1.0, 1.0] {
                        node.addChildNode(
                            post(
                                min(w, d) * 0.11, 0.008, x: sx * w * 0.22,
                                y: level(h + 0.012, 0.008), z: sz * d * 0.2, colour: seam))
                    }
                }
            } else {
                let door = SCNCylinder(radius: CGFloat(min(w, h) * 0.28), height: 0.02)
                door.radialSegmentCount = 16
                door.materials = [material(glass)]
                let porthole = SCNNode(geometry: door)
                porthole.eulerAngles = SCNVector3(Float.pi / 2, 0, 0)
                porthole.position = SCNVector3(0, Float(level(h * 0.55, 0.02)), Float(d / 2))
                node.addChildNode(porthole)
            }

        case .toilet:
            // Bowl, tank, seat — the silhouette everyone recognises from above
            // and from the side alike.
            let tankD = d * 0.28
            node.addChildNode(
                slab(w * 0.85, h, tankD, y: level(0, h), z: (d - tankD) / 2))
            let bowl = SCNCapsule(capRadius: CGFloat(w * 0.42), height: CGFloat(d * 0.72))
            bowl.materials = [material(body)]
            let bowlNode = SCNNode(geometry: bowl)
            bowlNode.eulerAngles = SCNVector3(Float.pi / 2, 0, 0)
            bowlNode.scale = SCNVector3(1, 1, 0.62)
            bowlNode.position = SCNVector3(0, Float(level(0, h * 0.62)), Float(-d * 0.14))
            node.addChildNode(bowlNode)

        case .tub:
            node.addChildNode(slab(w, h, d, y: level(0, h)))
            // The hollow, inset — a bath is a box with a hole in it.
            node.addChildNode(
                slab(
                    w - 0.12, 0.02, d - 0.12, y: level(h, 0.001), colour: seam, radius: 0.03))

        case .shower:
            node.addChildNode(slab(w, 0.08, d, y: level(0, 0.08), colour: seam))
            // Two glass panels, which is what a shower reads as in a model.
            node.addChildNode(
                slab(w, h - 0.08, 0.015, y: level(0.08, h - 0.08), z: d / 2,
                    colour: glass, transparency: 0.35))
            node.addChildNode(
                slab(0.015, h - 0.08, d, x: w / 2, y: level(0.08, h - 0.08),
                    colour: glass, transparency: 0.35))

        case .sink:
            let bowl = SCNCylinder(radius: CGFloat(min(w, d) * 0.42), height: CGFloat(h * 0.5))
            bowl.radialSegmentCount = 16
            bowl.materials = [material(body)]
            let bowlNode = SCNNode(geometry: bowl)
            bowlNode.position = SCNVector3(0, Float(level(h * 0.5, h * 0.5)), 0)
            node.addChildNode(bowlNode)
            node.addChildNode(post(0.03, h * 0.5, x: 0, y: level(0, h * 0.5), z: 0))

        case .stairs:
            // Real treads. A flight drawn as a ramp is the one object where a
            // box actively misleads — it is a fall hazard and a rebuild line.
            let treads = max(3, Int(h / 0.19))
            for i in 0..<treads {
                let rise = h * Double(i + 1) / Double(treads)
                let run = d / Double(treads)
                node.addChildNode(
                    slab(
                        w, 0.04, run, y: level(rise - 0.04, 0.04),
                        z: -d / 2 + run * (Double(i) + 0.5)))
                node.addChildNode(
                    slab(
                        w, rise, 0.03, y: level(0, rise),
                        z: -d / 2 + run * Double(i), colour: seam, radius: 0))
            }

        case .column:
            node.addChildNode(post(min(w, d) / 2, h, x: 0, y: level(0, h), z: 0, colour: body))

        case .cylinder:
            node.addChildNode(post(min(w, d) / 2, h, x: 0, y: level(0, h), z: 0, colour: body))

        case .panel:
            node.addChildNode(slab(w, h, min(d, 0.05), y: level(0, h)))

        case .equipment:
            node.addChildNode(slab(w, h, d, y: level(0, h)))
            // The vent end, so which way our own gear is blowing is visible.
            let vent = SCNCylinder(radius: CGFloat(min(w, h) * 0.32), height: 0.03)
            vent.radialSegmentCount = 16
            vent.materials = [material(dark)]
            let ventNode = SCNNode(geometry: vent)
            ventNode.eulerAngles = SCNVector3(Float.pi / 2, 0, 0)
            ventNode.position = SCNVector3(0, Float(level(h * 0.5, 0.03)), Float(d / 2))
            node.addChildNode(ventNode)

        case .box:
            node.addChildNode(slab(w, h, d, y: level(0, h)))
        }

        // **Excluded still draws.** It is in the room and out of the claim,
        // and a model that deleted it would disagree with the plan beside it.
        if !included {
            node.enumerateHierarchy { child, _ in
                child.geometry?.materials.forEach { $0.transparency = 0.28 }
            }
        }
        return node
    }
}
