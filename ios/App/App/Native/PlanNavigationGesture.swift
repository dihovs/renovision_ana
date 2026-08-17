import SwiftUI
import UIKit

/// Two-finger pan and pinch for the plan editor, in UIKit because SwiftUI
/// cannot express the one rule the editor is built on.
///
/// **"Two fingers navigate. One finger selects. One finger only EDITS what is
/// already selected."** That rule is what makes the editor safe to use
/// one-handed on a job site — a stray thumb can move the camera all day
/// without ever moving a wall.
///
/// SwiftUI's `DragGesture` cannot say "two fingers only": it fires on one
/// finger just the same, so a pan gesture written with it competes with every
/// selection and every wall drag on the canvas. The previous attempt here hit
/// exactly that, and was left with an empty `.updating { _, _, _ in }` body —
/// pan silently did nothing for as long as the editor has existed, and the
/// pinch tangled into the same `SimultaneousGesture` did not work either.
///
/// `UIPanGestureRecognizer` CAN say it, with `minimumNumberOfTouches = 2`, so
/// that is what this installs. This representable's own view is an inert
/// zero-size marker with interaction disabled — it never swallows a touch —
/// placed via `.background(…)` on the canvas, which makes it a SIBLING of the
/// canvas, not a wrapper around it. Recognizers put on the marker or its
/// immediate host would never see a touch aimed at the drawing, so `install`
/// walks up one further step to the first ancestor shared with the canvas;
/// that IS in the canvas's hit-test chain, and recognizers on a parent still
/// see touches that land in children, so the canvas below keeps every one of
/// its own gestures:
///
/// * `shouldReceive` confines navigation to the canvas's own rectangle — the
///   shared ancestor is full-screen, and would otherwise also catch drags
///   meant for the toolbar or the action bar.
/// * `cancelsTouchesInView = false` — a two-finger pan does not yank the touch
///   out from under a SwiftUI gesture that was already tracking it.
/// * `delegate` returning true for simultaneous recognition — pinch and pan
///   run together, which is how a real two-finger navigation feels.
///
/// One finger never reaches either recognizer, so selection, wall drags and
/// both tap gestures are untouched by design rather than by luck.
struct PlanNavigationGesture: UIViewRepresentable {
    /// Multiplicative zoom delta since the last callback, and the pinch's
    /// midpoint in the container's coordinates so the zoom can be taken about
    /// the fingers rather than the middle of the screen.
    let onZoom: (CGFloat, CGPoint) -> Void
    /// Translation delta since the last callback, in points.
    let onPan: (CGSize) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> UIView {
        let marker = UIView()
        marker.isUserInteractionEnabled = false
        marker.backgroundColor = .clear

        // The hierarchy does not exist yet inside makeUIView; installing on
        // the next runloop turn is what gives it something to walk.
        DispatchQueue.main.async { context.coordinator.install(from: marker) }
        return marker
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.parent = self
        // A view moved between containers (a sheet re-presented over it, a
        // rotation) leaves the recognizers on the old one, where they would
        // never fire again.
        context.coordinator.install(from: uiView)
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var parent: PlanNavigationGesture
        private weak var installedOn: UIView?
        /// The canvas's own rectangle, used to keep navigation off the
        /// toolbar and the action bar the full-screen host also covers.
        private weak var regionView: UIView?
        private lazy var pan: UIPanGestureRecognizer = {
            let recognizer = UIPanGestureRecognizer(target: self, action: #selector(handlePan))
            recognizer.minimumNumberOfTouches = 2
            recognizer.maximumNumberOfTouches = 2
            recognizer.cancelsTouchesInView = false
            recognizer.delegate = self
            return recognizer
        }()
        private lazy var pinch: UIPinchGestureRecognizer = {
            let recognizer = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch))
            recognizer.cancelsTouchesInView = false
            recognizer.delegate = self
            return recognizer
        }()

        init(_ parent: PlanNavigationGesture) {
            self.parent = parent
        }

        /// Install on the nearest ancestor that the canvas's own touches
        /// actually travel through.
        ///
        /// `.background(…)` renders this representable as a SIBLING of the
        /// canvas, not a wrapper around it: the adaptor host that owns our
        /// marker holds only the marker, so recognizers put there never see a
        /// touch aimed at the drawing. The first shared ancestor is one level
        /// further up, and that IS in the canvas's hit-test chain.
        ///
        /// That ancestor is full-screen, so `shouldReceive` below confines
        /// navigation back to the canvas's own rectangle — which the marker
        /// already reports exactly, `.background` being sized to the view it
        /// backs. Toolbar and the action bar below keep their own gestures.
        func install(from marker: UIView) {
            guard let region = marker.superview, let host = region.superview else { return }
            regionView = region
            guard installedOn !== host else { return }
            installedOn?.removeGestureRecognizer(pan)
            installedOn?.removeGestureRecognizer(pinch)
            host.addGestureRecognizer(pan)
            host.addGestureRecognizer(pinch)
            installedOn = host
        }

        /// Deltas, not totals: the recognizer's running value is reset every
        /// callback so the view can simply accumulate, and a gesture that
        /// begins while another is mid-flight cannot jump the camera.
        @objc private func handlePan(_ recognizer: UIPanGestureRecognizer) {
            guard let view = recognizer.view else { return }
            let translation = recognizer.translation(in: view)
            recognizer.setTranslation(.zero, in: view)
            parent.onPan(CGSize(width: translation.x, height: translation.y))
        }

        @objc private func handlePinch(_ recognizer: UIPinchGestureRecognizer) {
            guard let view = recognizer.view, recognizer.numberOfTouches >= 2 else { return }
            let factor = recognizer.scale
            recognizer.scale = 1
            parent.onZoom(factor, recognizer.location(in: view))
        }

        /// Pinch and pan together, and neither one blocking the canvas's own
        /// SwiftUI gestures underneath.
        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer
        ) -> Bool { true }

        /// Only touches on the drawing itself navigate.
        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch
        ) -> Bool {
            guard let region = regionView else { return true }
            return region.bounds.contains(touch.location(in: region))
        }
    }
}
