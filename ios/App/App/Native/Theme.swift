import SwiftUI

/// The app's visual language, in one place.
///
/// Two influences, both deliberate. The SHAPE is Jobber's: a bottom tab bar,
/// card-based lists on a grouped background, status badges, and a floating
/// action button bottom-right that changes meaning with the screen. That
/// arrangement is what a field-service app looks like to somebody who already
/// uses one, and it is worth matching rather than inventing.
///
/// The DENSITY is Magicplan's: a statistics band above the content, figures
/// in tabular numerals, measurements grouped tightly enough to read in one
/// glance while standing in a basement.
///
/// The COLOURS are Renovision's own, taken from `globals.css` rather than
/// eyeballed — #2b5c9e, #4e9e2e, #23272c. An earlier version of this file had
/// a brand blue of #1f70d1 with a comment claiming it matched the web. It did
/// not. Colours are read from the source of truth or they drift.
enum Brand {
    // MARK: - Palette (exact, from src/app/globals.css)

    static let blue = Color(hex: 0x2B5C9E)
    static let blueDark = Color(hex: 0x1F4677)
    static let blueLight = Color(hex: 0xEAF1FB)

    static let green = Color(hex: 0x4E9E2E)
    static let greenDark = Color(hex: 0x3D7D24)
    static let greenLight = Color(hex: 0xEEF8E9)
    static let greenSoft = Color(hex: 0x6FBF4C)

    static let charcoal = Color(hex: 0x2B2B2B)
    static let charcoalDark = Color(hex: 0x23272C)
    static let charcoalDarkLight = Color(hex: 0x33383F)

    // MARK: - Semantic surfaces
    //
    // Adaptive rather than fixed: the app is used in a bright driveway and in
    // an unlit basement on the same afternoon, and a light-only palette is
    // genuinely harder to read in one of those.

    /// What the whole screen sits on.
    static let canvas = Color(light: 0xF4F5F7, dark: 0x111316)

    /// A card.
    static let surface = Color(light: 0xFFFFFF, dark: 0x1C1F24)

    /// A card sitting on a card — a nested measurement tile.
    static let surfaceRaised = Color(light: 0xF7F8FA, dark: 0x24282E)

    /// Hairlines and dividers.
    static let hairline = Color(light: 0xE4E6EA, dark: 0x2E333A)

    static let ink = Color(light: 0x2B2B2B, dark: 0xF2F3F5)
    static let inkSoft = Color(light: 0x62666D, dark: 0x9BA1AA)
    static let inkFaint = Color(light: 0x8E939B, dark: 0x6E747D)

    // MARK: - Spacing
    //
    // A 4pt scale. Named rather than numeric so a screen says why a gap is
    // the size it is; ad-hoc padding is how two lists end up looking like
    // two different apps.

    enum Space {
        static let hair: CGFloat = 2
        static let tight: CGFloat = 6
        static let small: CGFloat = 10
        static let base: CGFloat = 14
        static let large: CGFloat = 20
        static let section: CGFloat = 28
    }

    enum Radius {
        static let tile: CGFloat = 10
        static let card: CGFloat = 16
        static let sheet: CGFloat = 24
        static let pill: CGFloat = 999
    }
}

// MARK: - Status

/// A coloured badge. Jobber leans on these hard, and the reason is sound: on
/// a list of twenty jobs the status is what the operator is actually scanning
/// for, and a word in grey text does not survive being glanced at.
enum StatusTone {
    case active, done, warning, neutral, info

    var fill: Color {
        switch self {
        case .active: return Brand.green.opacity(0.14)
        case .done: return Brand.blue.opacity(0.12)
        case .warning: return Color.orange.opacity(0.16)
        case .neutral: return Brand.inkSoft.opacity(0.12)
        case .info: return Brand.blueLight
        }
    }

    var text: Color {
        switch self {
        case .active: return Brand.greenDark
        case .done: return Brand.blue
        case .warning: return Color.orange
        case .neutral: return Brand.inkSoft
        case .info: return Brand.blueDark
        }
    }
}

struct StatusBadge: View {
    let text: String
    var tone: StatusTone = .neutral

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .heavy))
            .tracking(0.4)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tone.fill, in: .rect(cornerRadius: Brand.Radius.pill))
            .foregroundStyle(tone.text)
    }
}

// MARK: - Card

/// The unit every list is built from.
struct Card<Content: View>: View {
    var padding: CGFloat = Brand.Space.base
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
            // A hairline instead of a heavy shadow: stacked cards with real
            // shadows turn a scrolling list into mud, and the border survives
            // dark mode where a shadow disappears entirely.
            .overlay(
                RoundedRectangle(cornerRadius: Brand.Radius.card)
                    .strokeBorder(Brand.hairline, lineWidth: 0.5)
            )
    }
}

/// A row that pushes into somewhere, with the chevron the system would draw.
struct CardRow<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        HStack(spacing: Brand.Space.small) {
            content
            Spacer(minLength: Brand.Space.tight)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Brand.inkFaint)
        }
    }
}

// MARK: - Statistics band

/// The figures a job is judged by, across the top. Lifted from Magicplan,
/// where the equivalent band is the first thing on a project — because every
/// other number in the file is derived from these.
struct StatBand: View {
    struct Item: Identifiable {
        let id = UUID()
        let label: String
        let value: String
        var unit: String?
    }

    let items: [Item]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                VStack(spacing: 3) {
                    Text(item.label.uppercased())
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(0.3)
                        .foregroundStyle(.white.opacity(0.55))
                    HStack(alignment: .firstTextBaseline, spacing: 2) {
                        Text(item.value)
                            .font(.system(size: 19, weight: .bold, design: .rounded))
                            .monospacedDigit()
                        if let unit = item.unit {
                            Text(unit)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.55))
                        }
                    }
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                }
                .frame(maxWidth: .infinity)

                if index < items.count - 1 {
                    Rectangle()
                        .fill(.white.opacity(0.12))
                        .frame(width: 1, height: 30)
                }
            }
        }
        .padding(.vertical, Brand.Space.base)
        .padding(.horizontal, Brand.Space.small)
        .background(Brand.charcoalDark, in: .rect(cornerRadius: Brand.Radius.card))
    }
}

// MARK: - Floating action button

/// The "+" bottom-right. Jobber's is context-aware — a plus on most screens,
/// a camera on a visit — and that is copied here rather than a single global
/// action, because the useful thing to add depends entirely on where you are.
struct FloatingAction: View {
    var icon: String = "plus"
    var label: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Brand.Space.tight) {
                Image(systemName: icon).font(.system(size: 17, weight: .bold))
                if let label {
                    Text(label).font(.system(size: 15, weight: .bold))
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, label == nil ? 18 : 20)
            .frame(height: 54)
            .background(Brand.blue, in: .rect(cornerRadius: Brand.Radius.pill))
            .shadow(color: Brand.blue.opacity(0.35), radius: 12, y: 5)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Section heading

struct SectionHeading: View {
    let title: String
    var trailing: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.system(size: 13, weight: .heavy))
                .tracking(0.3)
                .foregroundStyle(Brand.inkSoft)
            Spacer()
            if let trailing {
                Text(trailing)
                    .font(.system(size: 12, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Brand.inkFaint)
            }
        }
    }
}

// MARK: - Primary button

struct PrimaryButtonStyle: ButtonStyle {
    var tone: Color = Brand.blue
    var enabled = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(tone, in: .rect(cornerRadius: Brand.Radius.card))
            .opacity(enabled ? (configuration.isPressed ? 0.85 : 1) : 0.4)
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

// MARK: - Colour helpers

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1)
    }

    /// One colour that knows what to be in each appearance. Declaring both
    /// here keeps a screen from having to ask which mode it is in.
    init(light: UInt32, dark: UInt32) {
        self.init(
            UIColor { trait in
                let hex = trait.userInterfaceStyle == .dark ? dark : light
                return UIColor(
                    red: CGFloat((hex >> 16) & 0xFF) / 255,
                    green: CGFloat((hex >> 8) & 0xFF) / 255,
                    blue: CGFloat(hex & 0xFF) / 255,
                    alpha: 1)
            })
    }
}
