// Renovision AnA — the storey turn, checked against the real source.
//
//   swiftc scripts/storey-turn-check.swift \
//     ios/App/App/Native/StoreyArranging.swift -o /tmp/storey-turn-check \
//     && /tmp/storey-turn-check
//
// **Why this file exists at all.** A storey's angle is a display fact: it is
// applied in `StoreyViewport.point()`/`.model()` for the 2D canvas and by one
// turntable node in `Dollhouse.scene` for the 3D one, and it is written
// nowhere near a room's saved geometry (migration 0043). Both of those are
// arithmetic, and arithmetic is cheap to MEASURE and expensive to argue
// about — `HANDOFF.md` §9d: *compile and RUN the real source before shipping
// geometry.* Everything below runs against `StoreyArranging.rotate` and
// SceneKit's own transforms, not a transcription of them.
//
// **And why it lives in `scripts/` rather than /tmp.** §6b records the
// artwork fitter being rewritten twice because it lived in /tmp, and says to
// move it here. Same lesson, applied the first time instead of the third.
//
// It is not wired into CI — Swift has no test target in this project, which
// is the same reason `StoreyArranging`'s own geometry is mirrored by hand
// from the TypeScript side. Run it when this transform changes.

import Foundation
import SceneKit

@main
enum StoreyTurnCheck {

    // MARK: - The 2D seam

    /// The composition `StoreyViewport.point`/`.model` perform, around the
    /// real `StoreyArranging.rotate`. Only the composition is restated here;
    /// the rotation itself is the shipped function.
    struct Viewport {
        var bounds: CGRect
        var canvasSize: CGSize
        var inset: CGFloat = 28
        var angle: Double = 0
        var pivot: CGPoint = .zero

        var scale: CGFloat {
            guard bounds.width > 0.05, bounds.height > 0.05, canvasSize.width > 0,
                canvasSize.height > 0
            else { return 1 }
            return min(
                (canvasSize.width - inset * 2) / bounds.width,
                (canvasSize.height - inset * 2) / bounds.height)
        }

        var origin: CGPoint {
            let s = scale
            return CGPoint(
                x: inset + (canvasSize.width - inset * 2 - bounds.width * s) / 2 - bounds.minX * s,
                y: inset + (canvasSize.height - inset * 2 - bounds.height * s) / 2 - bounds.minY * s)
        }

        func point(_ floorPoint: CGPoint) -> CGPoint {
            let r = angle == 0 ? floorPoint : StoreyArranging.rotate([floorPoint], by: angle, about: pivot)[0]
            let o = origin, s = scale
            return CGPoint(x: r.x * s + o.x, y: r.y * s + o.y)
        }

        func model(_ screenPoint: CGPoint) -> CGPoint {
            let o = origin, s = scale
            let floor = CGPoint(x: (screenPoint.x - o.x) / s, y: (screenPoint.y - o.y) / s)
            return angle == 0 ? floor : StoreyArranging.rotate([floor], by: -angle, about: pivot)[0]
        }
    }

    /// `FloorCanvasView.turned(_:)` — the framing correction. A rectangle of
    /// unrotated floor is not a rectangle after a turn, so the camera has to
    /// frame the box its four turned corners need.
    static func turnedBox(_ rect: CGRect, by angle: Double, about pivot: CGPoint) -> CGRect {
        guard angle != 0 else { return rect }
        let corners = StoreyArranging.rotate(
            [
                CGPoint(x: rect.minX, y: rect.minY), CGPoint(x: rect.maxX, y: rect.minY),
                CGPoint(x: rect.maxX, y: rect.maxY), CGPoint(x: rect.minX, y: rect.maxY),
            ], by: angle, about: pivot)
        let xs = corners.map(\.x), ys = corners.map(\.y)
        return CGRect(
            x: xs.min()!, y: ys.min()!, width: xs.max()! - xs.min()!, height: ys.max()! - ys.min()!)
    }

    // MARK: - The 3D turntable

    /// The EXACT node hierarchy `Dollhouse.scene` builds, and where a storey
    /// point lands once it has been through it. SCNNode transforms are pure
    /// maths — no rendering, no device — so this is measurable here.
    static func dollhouseWorldPoint(
        storey p: CGPoint, centre: CGPoint, displayAngleRadians: Double
    ) -> SCNVector3 {
        let world = SCNNode()
        world.position = SCNVector3(CGFloat(-centre.x), 0, CGFloat(-centre.y))

        let turntable = SCNNode()
        turntable.eulerAngles = SCNVector3(0, CGFloat(-displayAngleRadians), 0)
        turntable.addChildNode(world)

        // A room sits at absolute storey coordinates inside `world`; the
        // plan's y is SceneKit's z.
        let marker = SCNNode()
        marker.position = SCNVector3(CGFloat(p.x), 0, CGFloat(p.y))
        world.addChildNode(marker)

        let root = SCNNode()
        root.addChildNode(turntable)
        return marker.convertPosition(SCNVector3Zero, to: root)
    }

    // MARK: - Running them

    static var failures = 0

    static func check(_ label: String, _ ok: Bool, _ detail: String = "") {
        if ok {
            print("  ok   \(label)")
        } else {
            print("  FAIL \(label) \(detail)")
            failures += 1
        }
    }

    static func near(_ a: CGPoint, _ b: CGPoint, _ tol: CGFloat = 1e-4) -> Bool {
        abs(a.x - b.x) < tol && abs(a.y - b.y) < tol
    }

    /// The angles worth testing. **The asymmetric ones carry the proof** — a
    /// sign error mirrors the layout, which 90° and 180° can hide and 45°
    /// and 137° cannot.
    static let angles: [Double] = [0, 45, 90, 137, 180, -90, 270]

    static func main() {
        let canvas = CGSize(width: 390, height: 700)
        let floor = CGRect(x: 0, y: 0, width: 8, height: 5)
        let pivot = CGPoint(x: floor.midX, y: floor.midY)
        let samples = [
            CGPoint(x: 0, y: 0), CGPoint(x: 8, y: 5), CGPoint(x: 8, y: 0),
            CGPoint(x: 0, y: 5), CGPoint(x: 3.2, y: 1.1), CGPoint(x: -2, y: 7),
        ]

        // 1. THE INVARIANT HIT-TESTING DEPENDS ON. If this fails, a tap lands
        // on a different room than the one drawn under the finger — which is
        // the whole reason the angle lives in this one seam.
        print("\nmodel(point(p)) == p")
        for degrees in angles {
            let v = Viewport(
                bounds: floor, canvasSize: canvas, angle: degrees * .pi / 180, pivot: pivot)
            let ok = samples.allSatisfy { near(v.model(v.point($0)), $0) }
            check("\(Int(degrees))° round trip, \(samples.count) points", ok)
        }

        // 2. The storey turns about its own centre rather than walking across
        // the sheet.
        print("\nthe pivot does not move")
        let upright = Viewport(bounds: floor, canvasSize: canvas)
        for degrees in angles {
            let v = Viewport(
                bounds: floor, canvasSize: canvas, angle: degrees * .pi / 180, pivot: pivot)
            check("\(Int(degrees))°", near(v.point(pivot), upright.point(pivot)))
        }

        // 3. A turn changes no measurement. A turn that DID would be the exact
        // bug this whole design exists to make impossible.
        print("\nlength is preserved")
        for degrees in angles {
            let a = StoreyArranging.rotate(
                [CGPoint(x: 0, y: 0)], by: degrees * .pi / 180, about: pivot)[0]
            let b = StoreyArranging.rotate(
                [CGPoint(x: 8, y: 5)], by: degrees * .pi / 180, about: pivot)[0]
            check(
                "\(Int(degrees))°",
                abs(hypot(b.x - a.x, b.y - a.y) - hypot(8.0, 5.0)) < 1e-9)
        }

        // 4. The framing correction. Fitting the upright rectangle runs a
        // turned storey off the canvas, worst at 45°.
        print("\nthe camera frames what the turn actually needs")
        let square = turnedBox(floor, by: .pi / 2, about: pivot)
        check(
            "90° swaps the span to 5×8",
            abs(square.width - 5) < 1e-9 && abs(square.height - 8) < 1e-9)
        check(
            "90° keeps the centre",
            abs(square.midX - pivot.x) < 1e-9 && abs(square.midY - pivot.y) < 1e-9)
        let diagonal = turnedBox(floor, by: .pi / 4, about: pivot)
        let want = 8 * cos(Double.pi / 4) + 5 * sin(Double.pi / 4)
        check("45° needs the diagonal span", abs(Double(diagonal.width) - want) < 1e-9)
        check("45° is wider than upright", diagonal.width > floor.width)

        // 5. THE SIGN. SceneKit's +Y rotation runs opposite to the plan's
        // screen-space sense of clockwise, so the turntable negates. Measured
        // against the 2D canvas rather than argued about.
        print("\n3D reads the floor from the same direction as 2D")
        let centre = CGPoint(x: floor.midX, y: floor.midY)
        for degrees in angles {
            let angle = degrees * .pi / 180
            let ok = samples.allSatisfy { p in
                let scene = dollhouseWorldPoint(
                    storey: p, centre: centre, displayAngleRadians: angle)
                let t = StoreyArranging.rotate([p], by: angle, about: centre)[0]
                return abs(Double(scene.x) - Double(t.x - centre.x)) < 1e-6
                    && abs(Double(scene.z) - Double(t.y - centre.y)) < 1e-6
            }
            check("\(Int(degrees))°, \(samples.count) points", ok)
        }

        print("")
        print(failures == 0 ? "ALL CHECKS PASSED" : "\(failures) CHECK(S) FAILED")
        exit(failures == 0 ? 0 : 1)
    }
}
