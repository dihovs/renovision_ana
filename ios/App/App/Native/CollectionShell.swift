import SwiftUI

/// The collection shell — one shape for every browsable section.
///
/// The reference reuses a single shell for Floor Plans, Photos, Files and
/// Objects alike (spec §6.3): a section title with a chevron, a small
/// caption, a `See all (n)` affordance, and a horizontal rail of cards led
/// by a dashed `+` tile. This is the native twin of
/// `src/components/admin/CollectionShell.tsx` — the same anatomy, drawn
/// with this app's own tokens.
///
/// `See all (n)` reveals the section's detailed view BELOW the rail rather
/// than replacing it, so nothing the rail offers — the `+` tile included —
/// ever becomes unreachable while the detail is open.
struct CollectionShell<Banner: View, Rail: View, Expanded: View>: View {
    let title: String
    /// How many items the collection holds — the (n) in `See all (n)`.
    let count: Int
    /// The line under the title — say something true about the order
    /// ("Sorted by floor level"), or carry the section's totals.
    var caption: String?
    /// What the dashed `+` tile does; nil drops the tile.
    var onAdd: (() -> Void)?
    private let banner: Banner
    private let rail: Rail
    private let expanded: Expanded

    @State private var showAll = false

    init(
        title: String,
        count: Int,
        caption: String? = nil,
        onAdd: (() -> Void)? = nil,
        @ViewBuilder banner: () -> Banner,
        @ViewBuilder rail: () -> Rail,
        @ViewBuilder expanded: () -> Expanded
    ) {
        self.title = title
        self.count = count
        self.caption = caption
        self.onAdd = onAdd
        self.banner = banner()
        self.rail = rail()
        self.expanded = expanded()
    }

    /// `See all` earns its place only when there is a detail view to show
    /// and something in it. `EmptyView` is checked by type, which is what a
    /// caller passing `expanded: {}` produced.
    private var expandable: Bool {
        count > 0 && Expanded.self != EmptyView.self
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            HStack(alignment: .firstTextBaseline) {
                if expandable {
                    Button {
                        withAnimation(.easeOut(duration: 0.15)) { showAll.toggle() }
                    } label: {
                        header
                    }
                    .buttonStyle(.plain)
                } else {
                    header
                }

                Spacer()

                if expandable {
                    Button(showAll ? "See less" : "See all (\(count))") {
                        withAnimation(.easeOut(duration: 0.15)) { showAll.toggle() }
                    }
                    .font(.system(size: 12, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Brand.blue)
                    .buttonStyle(.plain)
                }
            }

            if let caption {
                Text(caption)
                    .font(.system(size: 12, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Brand.inkFaint)
            }

            banner

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Brand.Space.small) {
                    if let onAdd {
                        DashedAddTile(label: "Add to \(title)", action: onAdd)
                    }
                    rail
                }
            }

            if showAll {
                expanded
            }
        }
    }

    private var header: some View {
        HStack(spacing: 4) {
            Text(title)
                .font(.system(size: 13, weight: .heavy))
                .tracking(0.3)
                .foregroundStyle(Brand.inkSoft)
            Image(systemName: "chevron.right")
                .font(.system(size: 10, weight: .heavy))
                .foregroundStyle(Brand.inkFaint)
                .rotationEffect(.degrees(showAll ? 90 : 0))
        }
    }
}

/// The creation tile that leads every rail: 2px dashed border, centred `+`,
/// the same radius as the cards beside it. It stretches to the height of
/// its rail-mates, so it always reads as one of them.
struct DashedAddTile: View {
    var label: String = "Add"
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Brand.inkFaint)
                .frame(width: 72)
                .frame(minHeight: 96, maxHeight: .infinity)
                .background(
                    Brand.surfaceRaised.opacity(0.6),
                    in: .rect(cornerRadius: Brand.Radius.card)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Brand.Radius.card)
                        .strokeBorder(
                            Brand.inkFaint.opacity(0.55),
                            style: StrokeStyle(lineWidth: 2, dash: [6, 5]))
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}
