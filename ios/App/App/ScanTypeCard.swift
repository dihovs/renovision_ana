import ARKit
import UIKit

/// The card at the edge of the scanner that names what you are pointing at,
/// and lets you disagree without stopping the walk.
///
/// **This replaces an overlay that should never have existed.** We were
/// drawing our own blue quads and amber badges over the top of the scanner —
/// projected flat onto the glass and recomputed on RoomPlan's geometry
/// callback, which is throttled and only fires when the GEOMETRY changes
/// while the camera moves every frame. It could not stick, it had no shape,
/// and it covered the thing that did.
///
/// `RoomCaptureView` already draws translucent white massing for every wall,
/// door, window and object it finds — in the AR scene, correctly shaped and
/// incapable of drifting. The owner's *"I want it to be a white silhouette,
/// and it needs to have a shape and the design of a door"* was a request for
/// what Apple was already drawing underneath ours.
///
/// So the silhouettes are gone and this is all that is left: the one thing
/// the reference adds that Apple does not — a small white card carrying the
/// glyph of what is being looked at, and a chevron to change it. Seen in his
/// own screenshot of magicplan mid-scan, at the right edge, over a doorway.
@available(iOS 17.0, *)
final class ScanTypeCard: UIView {

    /// What the card is currently naming. Nil hides it — pointing at bare
    /// wall should show nothing rather than the last thing you passed.
    struct Subject: Equatable {
        let id: UUID
        let glyph: String
        let label: String
        /// True once somebody has said what it is, drawn as a settled tick
        /// rather than an invitation.
        let answered: Bool
    }

    var subject: Subject? {
        didSet {
            guard subject != oldValue else { return }
            apply()
        }
    }

    var onTap: ((UUID) -> Void)?

    private let card = UIView()
    private let chevron = UIImageView()
    private let glyph = UIImageView()
    private let name = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false

        card.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.95)
        card.layer.cornerRadius = 14
        card.layer.cornerCurve = .continuous
        card.translatesAutoresizingMaskIntoConstraints = false
        addSubview(card)

        chevron.image = UIImage(
            systemName: "chevron.left",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold))
        chevron.tintColor = .secondaryLabel
        chevron.contentMode = .scaleAspectFit
        chevron.translatesAutoresizingMaskIntoConstraints = false

        glyph.tintColor = .label
        glyph.contentMode = .scaleAspectFit
        glyph.translatesAutoresizingMaskIntoConstraints = false

        name.font = .systemFont(ofSize: 11, weight: .semibold)
        name.textColor = .secondaryLabel
        name.textAlignment = .center
        name.numberOfLines = 1
        name.translatesAutoresizingMaskIntoConstraints = false

        card.addSubview(chevron)
        card.addSubview(glyph)
        card.addSubview(name)

        NSLayoutConstraint.activate([
            card.trailingAnchor.constraint(equalTo: trailingAnchor),
            card.centerYAnchor.constraint(equalTo: centerYAnchor),
            card.widthAnchor.constraint(equalToConstant: 84),
            card.heightAnchor.constraint(greaterThanOrEqualToConstant: 84),

            chevron.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 8),
            chevron.centerYAnchor.constraint(equalTo: glyph.centerYAnchor),
            chevron.widthAnchor.constraint(equalToConstant: 14),

            glyph.centerXAnchor.constraint(equalTo: card.centerXAnchor, constant: 8),
            glyph.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            glyph.widthAnchor.constraint(equalToConstant: 34),
            glyph.heightAnchor.constraint(equalToConstant: 34),

            name.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 4),
            name.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -4),
            name.topAnchor.constraint(equalTo: glyph.bottomAnchor, constant: 6),
            name.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -10),
        ])

        card.addGestureRecognizer(
            UITapGestureRecognizer(target: self, action: #selector(cardTapped)))
        card.isUserInteractionEnabled = true
        alpha = 0
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    /// Only the card takes touches. Everywhere else belongs to the scanner
    /// underneath — an overlay that swallowed the screen would break Apple's
    /// own guidance and its pinch-to-look controls.
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        !card.isHidden && alpha > 0.01 && card.frame.contains(point)
    }

    @objc private func cardTapped() {
        guard let subject else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        onTap?(subject.id)
    }

    private func apply() {
        guard let subject else {
            UIView.animate(withDuration: 0.18) { self.alpha = 0 }
            return
        }
        glyph.image = UIImage(
            systemName: subject.glyph,
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 30, weight: .regular))
        name.text = subject.label
        // The settled state is a weight change, not a colour: an operator
        // scanning a wet basement should not have to tell amber from orange
        // to know whether a question is still open.
        name.textColor = subject.answered ? .label : .secondaryLabel
        UIView.animate(withDuration: 0.18) { self.alpha = 1 }
    }
}
