import SwiftUI

/// The look Home set (4 Nov 2026, the owner's "apply it everywhere"), as
/// parts every CRM screen is built from:
///
/// - `HeroCard`     — the blue summary card at the top of a screen: what
///                    matters now, in one glance, with one way onward.
/// - `RoundAction`  — a round button with a label and an iPhone-style badge.
/// - `GroupedCard`  — one white card holding rows separated by hairlines.
/// - `IconRow`      — a row: tinted icon tile, title, detail, trailing, chevron.
/// - `FigureTile`   — a figure with its label and a line of context.
///
/// The Projects and floor-plan screens are NOT built from these: they stay a
/// copy of the reference app until the owner has finished testing them.

// MARK: - Hero

struct HeroCard<Content: View>: View {
    let title: String
    let icon: String
    var trailing: String?
    var actionTitle: String?
    var action: (() -> Void)?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            HStack {
                Label(title, systemImage: icon)
                    .font(.system(size: 13, weight: .bold))
                Spacer()
                if let trailing {
                    Text(trailing).font(.system(size: 13, weight: .semibold))
                }
            }
            .foregroundStyle(.white.opacity(0.85))

            content
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let actionTitle, let action {
                Button(action: action) {
                    HStack {
                        Text(actionTitle).font(.system(size: 14, weight: .bold))
                        Spacer()
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(Brand.blue)
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(.white, in: .rect(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
        }
        .padding(Brand.Space.base)
        .background(
            LinearGradient(colors: [Brand.blue, Brand.blueDark], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: .rect(cornerRadius: Brand.Radius.card))
    }
}

/// The big figure inside a hero: a small caps label over a large value.
struct HeroFigure: View {
    let label: String
    let value: String
    var note: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .heavy)).tracking(0.5)
                .opacity(0.7)
            Text(value)
                .font(.system(size: 28, weight: .bold, design: .rounded)).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.6)
            if let note {
                Text(note).font(.system(size: 13, weight: .medium)).opacity(0.85)
            }
        }
    }
}

// MARK: - Round actions

struct RoundAction: View {
    let icon: String
    let label: String
    let tint: Color
    /// How many are waiting. Zero draws nothing — a badge showing `0` is a
    /// claim that something is there.
    var badge: Int = 0
    /// The singular noun the count is of, for VoiceOver.
    var badgeNoun: String = "new item"
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(width: 56, height: 56)
                    .background(Brand.surface, in: .circle)
                    .overlay(Circle().strokeBorder(Brand.hairline, lineWidth: 0.5))
                    .overlay(alignment: .topTrailing) { badgeView }
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(badge > 0 ? "\(label), ^[\(badge) \(badgeNoun)](inflect: true)" : label)
        .accessibilityAddTraits(.isButton)
    }

    @ViewBuilder private var badgeView: some View {
        if badge > 0 {
            Text(badge > 99 ? "99+" : "\(badge)")
                .font(.system(size: 11, weight: .bold).monospacedDigit())
                .foregroundStyle(.white)
                .padding(.horizontal, 5)
                .frame(minWidth: 18, minHeight: 18)
                .background(Color.red, in: .capsule)
                .overlay(Capsule().strokeBorder(Brand.canvas, lineWidth: 1.5))
                .offset(x: 4, y: -2)
                .transition(.scale.combined(with: .opacity))
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: badge)
        }
    }
}

// MARK: - Grouped rows

/// One white card holding rows; put `RowDivider()` between them.
struct GroupedCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) { content }
            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Brand.Radius.card).strokeBorder(Brand.hairline, lineWidth: 0.5))
    }
}

struct RowDivider: View {
    var inset: CGFloat = 60
    var body: some View { Divider().overlay(Brand.hairline).padding(.leading, inset) }
}

/// The square tinted icon that leads a row.
struct IconTile: View {
    let icon: String
    let tint: Color
    var body: some View {
        Image(systemName: icon)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: 34, height: 34)
            .background(tint.opacity(0.13), in: .rect(cornerRadius: 9))
    }
}

/// Initials in a circle, for people.
struct InitialsAvatar: View {
    let name: String
    var size: CGFloat = 34
    var tint: Color = Brand.blue

    var body: some View {
        Text(initials)
            .font(.system(size: size * 0.38, weight: .bold))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(tint.opacity(0.13), in: .circle)
    }

    private var initials: String {
        let parts = name.split(separator: " ").filter { $0.first?.isLetter == true }
        let first = parts.first?.prefix(1) ?? "?"
        let last = parts.count > 1 ? parts.last!.prefix(1) : ""
        return (first + last).uppercased()
    }
}

/// A row: leading view, title, detail, a trailing value, and a chevron.
struct IconRow<Leading: View, Trailing: View>: View {
    let title: String
    var detail: String?
    var showsChevron = true
    @ViewBuilder var leading: Leading
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(spacing: Brand.Space.small) {
            leading
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 15, weight: .semibold)).foregroundStyle(Brand.ink).lineLimit(1)
                if let detail, !detail.isEmpty {
                    Text(detail).font(.system(size: 12)).foregroundStyle(Brand.inkFaint).lineLimit(1)
                }
            }
            Spacer(minLength: Brand.Space.tight)
            trailing
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Brand.inkFaint)
            }
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

// MARK: - Figures

/// One figure, in a tile: what it is, the number, a line of context.
struct FigureTile: View {
    let label: String
    let value: String
    /// A localized key so "^[3 quote](inflect: true)" reads "3 quotes".
    let note: LocalizedStringKey
    let icon: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label.uppercased())
                    .font(.system(size: 10, weight: .heavy)).tracking(0.3)
                    .foregroundStyle(Brand.inkFaint)
                Spacer()
                Image(systemName: icon).font(.system(size: 13, weight: .semibold)).foregroundStyle(tint)
            }
            Text(value)
                .font(.system(size: 24, weight: .bold, design: .rounded)).monospacedDigit()
                .foregroundStyle(Brand.ink)
                .lineLimit(1).minimumScaleFactor(0.6)
            Text(note).font(.system(size: 12)).foregroundStyle(Brand.inkSoft).lineLimit(1)
        }
        .padding(Brand.Space.base)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Brand.Radius.card).strokeBorder(Brand.hairline, lineWidth: 0.5))
    }
}

/// A screen's own header, in the Home style: small line over a bold title.
struct ScreenHeader<Trailing: View>: View {
    let subtitle: String?
    let title: String
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                if let subtitle {
                    Text(subtitle).font(.system(size: 13, weight: .semibold)).foregroundStyle(Brand.inkFaint)
                }
                Text(title).font(.system(size: 28, weight: .bold)).foregroundStyle(Brand.ink)
            }
            Spacer()
            trailing
        }
        .padding(.top, Brand.Space.small)
    }
}

/// A round header button, like Home's ⋯.
struct HeaderCircleButton: View {
    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Brand.ink)
                .frame(width: 40, height: 40)
                .background(Brand.surface, in: .circle)
                .overlay(Circle().strokeBorder(Brand.hairline, lineWidth: 0.5))
        }
        .accessibilityLabel(label)
    }
}
