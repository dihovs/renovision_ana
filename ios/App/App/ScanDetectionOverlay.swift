import ARKit
import UIKit

/// The half-transparent silhouettes drawn over what the scanner has found,
/// while the operator is still standing in the room.
///
/// **The owner's ask, 20 Aug 2026, in full:** *"when you point on the window
/// it draws a half transparent silhouette of the window on the window itself,
/// and it kind of pastes the illustration of the window that it thinks it
/// should be there. But if you don't agree, you can click on that… during
/// this scan, you can click on that and choose the right one. And same
/// applies to the objects that it doesn't recognize… it shows you the
/// question mark. You click on the question mark, and you choose what is
/// it."*
///
/// **Why this is a flat overlay and not 3D content.** `RoomCaptureView`
/// renders its own scene and takes no nodes of ours, so there is nothing to
/// add a SceneKit box to. What there IS, on every frame, is a camera with a
/// known projection — so each detection's four corners are projected to
/// screen points and the quad is drawn here, on top. It tracks the world
/// because the projection is recomputed each frame, not because it lives in
/// it.
///
/// The badge IS the control. There is no separate button: the thing you
/// disagree with is the thing you tap, which is the whole point of doing this
/// during the scan rather than in a list afterwards.
@available(iOS 17.0, *)
final class ScanDetectionOverlay: UIView {

    /// One detection, already projected into this view's coordinates.
    struct Mark {
        let id: UUID
        /// The silhouette, in screen points, wound in order.
        let quad: [CGPoint]
        let centre: CGPoint
        /// SF Symbol. A question mark when nothing confident can be said.
        let glyph: String
        let label: String
        /// Draws the ring in amber and the glyph as a question — an
        /// invitation to answer, not a claim to correct.
        let uncertain: Bool
        /// True once the operator has said what it is, so a settled
        /// detection stops asking.
        let answered: Bool
    }

    var marks: [Mark] = [] {
        didSet { setNeedsDisplay() }
    }

    /// Tapped a silhouette. The id is the detection's own stable identifier,
    /// which survives every `didUpdate` for the length of the capture.
    var onTap: ((UUID) -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        // Transparent everywhere it is not drawing, so the scanner's own
        // guidance and Apple's massing stay visible and touchable.
        isUserInteractionEnabled = true
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // MARK: - Drawing

    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext() else { return }

        for mark in marks {
            guard mark.quad.count >= 3 else { continue }

            let path = UIBezierPath()
            path.move(to: mark.quad[0])
            for point in mark.quad.dropFirst() { path.addLine(to: point) }
            path.close()

            let tint: UIColor =
                mark.uncertain && !mark.answered
                ? UIColor.systemOrange
                : UIColor.systemBlue

            // Half transparent, his word for it — the wall behind has to
            // stay readable or the overlay is a sticker rather than a
            // silhouette.
            context.setFillColor(tint.withAlphaComponent(0.22).cgColor)
            path.fill()
            context.setStrokeColor(tint.withAlphaComponent(0.95).cgColor)
            path.lineWidth = 2
            path.stroke()

            drawBadge(mark, tint: tint, in: context)
        }
    }

    private func drawBadge(_ mark: Mark, tint: UIColor, in context: CGContext) {
        let radius: CGFloat = 21
        let circle = CGRect(
            x: mark.centre.x - radius, y: mark.centre.y - radius,
            width: radius * 2, height: radius * 2)

        context.setFillColor(UIColor.black.withAlphaComponent(0.55).cgColor)
        context.fillEllipse(in: circle)
        context.setStrokeColor(tint.cgColor)
        context.setLineWidth(2)
        context.strokeEllipse(in: circle)

        let configuration = UIImage.SymbolConfiguration(pointSize: 19, weight: .semibold)
        if let symbol = UIImage(systemName: mark.glyph, withConfiguration: configuration)?
            .withTintColor(.white, renderingMode: .alwaysOriginal)
        {
            let size = symbol.size
            symbol.draw(
                in: CGRect(
                    x: mark.centre.x - size.width / 2, y: mark.centre.y - size.height / 2,
                    width: size.width, height: size.height))
        }

        // The name under the badge, so the operator can disagree with a
        // WORD rather than having to interpret a pictogram at arm's length
        // in a wet basement.
        let text = mark.label as NSString
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 12, weight: .semibold),
            .foregroundColor: UIColor.white,
        ]
        let textSize = text.size(withAttributes: attributes)
        let plate = CGRect(
            x: mark.centre.x - textSize.width / 2 - 6,
            y: mark.centre.y + radius + 5,
            width: textSize.width + 12, height: textSize.height + 4)
        context.setFillColor(UIColor.black.withAlphaComponent(0.55).cgColor)
        UIBezierPath(roundedRect: plate, cornerRadius: 5).fill()
        text.draw(
            at: CGPoint(x: plate.minX + 6, y: plate.minY + 2), withAttributes: attributes)
    }

    // MARK: - Touch

    /// Only the badges and their silhouettes take touches. Everywhere else
    /// the tap belongs to the scanner underneath — an overlay that swallowed
    /// the whole screen would break Apple's own guidance UI.
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        hit(point) != nil
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let location = touches.first?.location(in: self), let mark = hit(location) else {
            return
        }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        onTap?(mark.id)
    }

    private func hit(_ point: CGPoint) -> Mark? {
        // Badge first, and generously: it is the target the finger is aimed
        // at, and it sits inside the silhouette so testing the quad first
        // would let a big window swallow every tap meant for its badge.
        for mark in marks where hypot(point.x - mark.centre.x, point.y - mark.centre.y) <= 30 {
            return mark
        }
        for mark in marks where mark.quad.count >= 3 {
            let path = UIBezierPath()
            path.move(to: mark.quad[0])
            for p in mark.quad.dropFirst() { path.addLine(to: p) }
            path.close()
            if path.contains(point) { return mark }
        }
        return nil
    }
}
