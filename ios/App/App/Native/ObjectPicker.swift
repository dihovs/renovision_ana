import SwiftUI

/// The Insert library — `All Objects`.
///
/// **Rebuilt 18 Aug 2026 against the owner's own screenshots of the
/// reference**, which he sent while testing the first version and asked to
/// see *"when clicking on the walls and on the floor itself."* His screens
/// settle the layout, and the standing instruction says to match them:
///
/// - Title `All Objects`, a search field pinned under it, `✕` to close.
/// - `Recently used` as a horizontal rail of tiles, each with a star in its
///   corner for favouriting — not a separate tab, and above the sections.
/// - The sections as a plain LIST: small illustration, name, the number of
///   things in it, chevron. Not the two-column tile grid the first version
///   had. Counts matter — they are what tells you a section is worth
///   opening.
/// - Their order, openings first: `Doors · Windows · Structural · Plumbing ·
///   Appliances · Kitchen Cabinets · Furniture · Electrical · HVAC ·
///   Restoration`.
///
/// **Doors and windows are IN this list**, which reverses the first
/// version's call to keep them out. The reasoning then — an opening is
/// authored on its wall, so a second route would be confusing — was about
/// the MODEL. He is talking about the LIST, and he is right: what he browses
/// is one library. `LibraryItem` is the seam that lets the list be one thing
/// while a door and a cabinet stay two.
struct ObjectLibraryPicker: View {
    /// Where this was opened from, which decides only what the caption says.
    /// The list itself never changes — a library that hides half its
    /// contents depending on what is selected is a library nobody trusts.
    var context: Context = .room
    let onPick: (LibraryItem) -> Void

    enum Context {
        case room
        case wall
        case floor

        var hint: String {
            switch self {
            case .room: return "Objects land in the middle of the room — drag them where they go."
            case .wall: return "A door or window goes in the wall you selected."
            case .floor: return "Choose one, then tap the room it goes in."
            }
        }
    }

    @Environment(\.dismiss) private var dismiss
    @State private var search = ""
    /// `ObjectHabits` is `UserDefaults` and publishes nothing, so the rail
    /// and the stars are refreshed by bumping this when they change.
    @State private var version = 0

    private var recent: [LibraryItem] {
        _ = version
        // Favourites first, then the rest of the recents — his ask was
        // "favorite and most commonly used ones to start with", and one rail
        // holding both in that priority is what his screenshot shows.
        let favourites = ObjectHabits.favourites.compactMap(LibrarySection.item(id:))
        let others = ObjectHabits.recent.compactMap(LibrarySection.item(id:))
            .filter { item in !favourites.contains { $0.id == item.id } }
        return favourites + others
    }

    var body: some View {
        NavigationStack {
            List {
                if !search.isEmpty {
                    let results = LibrarySection.search(search)
                    if results.isEmpty {
                        Text("Nothing matches “\(search)”.")
                            .font(.system(size: 15))
                            .foregroundStyle(Brand.inkSoft)
                    } else {
                        ForEach(results) { item in
                            Button { pick(item) } label: { itemRow(item) }
                                .buttonStyle(.plain)
                        }
                    }
                } else {
                    if !recent.isEmpty {
                        Section {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: Brand.Space.small) {
                                    ForEach(recent) { item in
                                        Button { pick(item) } label: {
                                            LibraryTile(item: item, version: version) {
                                                ObjectHabits.toggleFavourite(item.id)
                                                version += 1
                                            }
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                            .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 0))
                        } header: {
                            Text("Recently used")
                        }
                    }

                    Section {
                        ForEach(LibrarySection.allCases) { section in
                            NavigationLink {
                                LibrarySectionView(section: section, onPick: pick)
                            } label: {
                                sectionRow(section)
                            }
                        }
                    } footer: {
                        Text(context.hint)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("All Objects")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(
                text: $search, placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Search")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Brand.inkFaint)
                    }
                }
            }
            .sheet(
                isPresented: Binding(
                    get: { choosingSize != nil }, set: { if !$0 { choosingSize = nil } })
            ) {
                sizeSheet.presentationDetents([.medium, .large])
            }
        }
    }

    /// One section: illustration, name, count, chevron — his screenshot's
    /// own row.
    private func sectionRow(_ section: LibrarySection) -> some View {
        HStack(spacing: Brand.Space.base) {
            // **The section's own artwork, not a second set of drawings.**
            //
            // These rows carried `SectionEmblem` — emblems hand-drawn in
            // `Canvas` back when there was no artwork to point at. Next to
            // 341 commissioned icons they read as a different product, and
            // several were unrecognisable at this size. The row now shows a
            // real item from the section, chosen for its silhouette; see
            // `LibrarySection.emblemSlug`.
            SectionEmblemArt(slug: section.emblemSlug)
                .frame(width: 40, height: 40)
            Text(section.title)
                .font(.system(size: 17))
                .foregroundStyle(Brand.ink)
            Spacer()
            Text("\(section.items.count)")
                .font(.system(size: 15).monospacedDigit())
                .foregroundStyle(Brand.inkFaint)
        }
        .padding(.vertical, 2)
    }

    private func itemRow(_ item: LibraryItem) -> some View {
        HStack(spacing: Brand.Space.base) {
            LibraryArt(item: item)
                .frame(width: 38, height: 38)
            Text(item.name)
                .font(.system(size: 17))
                .foregroundStyle(Brand.ink)
            Spacer()
            Text(UnitSettings.shared.format.format(item.size.width))
                .font(.system(size: 13).monospacedDigit())
                .foregroundStyle(Brand.inkFaint)
        }
    }

    /// Chosen, but not yet handed over: a thing that comes in several
    /// sizes asks which one first.
    @State private var choosingSize: ObjectCatalog.Entry?

    private func pick(_ item: LibraryItem) {
        // **One tile, then the size** — the owner's call after using the
        // alternative: *"I don't wanna have three, four different kind of
        // refrigerators in the appliances place. I wanna choose one
        // refrigerator, and I want it to tell me to choose the size."*
        if case .object(let entry) = item, entry.stock.count > 1 {
            choosingSize = entry
            return
        }
        ObjectHabits.remember(item.id)
        version += 1
        onPick(item)
        dismiss()
    }

    /// The size sheet. Only ever raised for something sold in more than
    /// one, so it never asks a question with one answer.
    @ViewBuilder private var sizeSheet: some View {
        if let entry = choosingSize {
            NavigationStack {
                List(entry.stock) { size in
                    Button {
                        ObjectHabits.remember("object.\(entry.slug)")
                        version += 1
                        onPick(.object(entry.sized(size)))
                        choosingSize = nil
                        dismiss()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(size.label)
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(Brand.ink)
                                Text(
                                    UnitSettings.shared.format.format(size.width) + " × "
                                        + UnitSettings.shared.format.format(size.depth)
                                )
                                .font(.system(size: 12).monospacedDigit())
                                .foregroundStyle(Brand.inkSoft)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Brand.inkFaint)
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                }
                .navigationTitle(entry.name)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Back") { choosingSize = nil }
                    }
                }
                // The way out for a size that is not on the list: place the
                // usual one and correct it. Saying so here beats leaving
                // the operator to wonder whether the app can cope with a
                // fridge nobody stocks any more.
                .safeAreaInset(edge: .bottom) {
                    Text("Not on the list? Place one and type the real size in its details.")
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.inkSoft)
                        .multilineTextAlignment(.center)
                        .padding(Brand.Space.base)
                }
            }
        }
    }
}

/// One section's contents, as illustrated tiles — the screen behind a row.
struct LibrarySectionView: View {
    let section: LibrarySection
    let onPick: (LibraryItem) -> Void

    @State private var version = 0

    var body: some View {
        ScrollView {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 108), spacing: Brand.Space.small)],
                spacing: Brand.Space.small
            ) {
                ForEach(section.items) { item in
                    Button { onPick(item) } label: {
                        LibraryTile(item: item, version: version) {
                            ObjectHabits.toggleFavourite(item.id)
                            version += 1
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(Brand.Space.base)
        }
        .background(Brand.canvas)
        .navigationTitle(section.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// One item as a tile: the illustration, a star in the corner, the name and
/// its stock size — the size because it is what decides whether this is the
/// right entry, and hiding it would mean placing one to find out.
struct LibraryTile: View {
    let item: LibraryItem
    var version: Int = 0
    let onToggleFavourite: () -> Void

    var body: some View {
        VStack(spacing: Brand.Space.tight) {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    Brand.surfaceRaised
                    // **The drawings are square and the tile was not.** At
                    // 100x80 with 10pt of padding the art was height-limited
                    // to 60pt with 20pt of white either side of it — the
                    // icons read as small in their own tiles. The SVGs
                    // already carry a 16% margin of their own from the
                    // fitter, so a second generous one here is padding twice.
                    LibraryArt(item: item)
                        .padding(5)
                }
                // The star sits ON the tile, exactly as his screenshot has
                // it — filled when it is a favourite, hollow when it is not,
                // so one tap either way and no menu to find.
                Button(action: onToggleFavourite) {
                    Image(systemName: favourite ? "star.fill" : "star")
                        .font(.system(size: 13))
                        .foregroundStyle(favourite ? Brand.blue : Brand.inkFaint)
                        .padding(6)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
            .frame(width: 100, height: 86)
            .clipShape(.rect(cornerRadius: Brand.Radius.tile))

            Text(item.name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Brand.ink)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .frame(height: 30, alignment: .top)
        }
        .frame(width: 100)
    }

    private var favourite: Bool {
        _ = version
        return ObjectHabits.isFavourite(item.id)
    }
}

/// The coloured illustration for either kind of library item.
///
/// Objects draw their own plan figure. An opening draws the symbol it makes
/// in a wall — the band broken by a leaf and its swing — which is what a
/// door looks like on a plan and therefore what it should look like in the
/// list that places one.
struct LibraryArt: View {
    let item: LibraryItem

    var body: some View {
        switch item {
        case .object(let entry):
            ObjectTileArt(entry: entry)
        case .opening(let kind):
            // Openings take artwork the same way objects do — their slug is
            // the raw value, so a `door-doorSingle` asset replaces the drawn
            // symbol with an illustration when one exists.
            if ObjectArtwork.exists("door-\(kind.rawValue)") {
                ObjectArtwork(slug: "door-\(kind.rawValue)")
            } else {
                OpeningTileArt(kind: kind)
            }
        }
    }
}

/// The drawing that stands for a whole section in the list.
///
/// Falls back to the hand-drawn `SectionEmblem` only if the asset is missing,
/// so a section whose chosen item has no artwork still shows something rather
/// than a hole. With 341 icons installed that fallback should never fire —
/// it exists because a silent blank row is the worst of the three outcomes.
struct SectionEmblemArt: View {
    let slug: String
    var body: some View {
        if ObjectArtwork.exists(slug) {
            ObjectArtwork(slug: slug)
        } else {
            Image(systemName: "square.on.square")
                .font(.system(size: 20))
                .foregroundStyle(Brand.inkFaint)
        }
    }
}

/// A door or window as it appears in plan: the wall band, the knock-out, and
/// for a door the leaf and its quarter-circle swing.
struct OpeningTileArt: View {
    let kind: PlanEditing.OpeningKind

    var body: some View {
        Canvas { context, size in
            let inset = size.width * 0.12
            let wallY = size.height * 0.62
            let band = max(4, size.height * 0.1)
            let left = inset
            let right = size.width - inset
            // The knock-out is proportional to the real width, so a double
            // door reads wider than a single one at a glance.
            let holeWidth = (right - left) * min(0.8, kind.width / 2.0)
            let holeLeft = (left + right) / 2 - holeWidth / 2
            let holeRight = holeLeft + holeWidth

            var wall = Path()
            wall.addRect(
                CGRect(x: left, y: wallY - band / 2, width: holeLeft - left, height: band))
            wall.addRect(
                CGRect(x: holeRight, y: wallY - band / 2, width: right - holeRight, height: band))
            context.fill(wall, with: .color(ObjectGlyphs.Palette.concrete))
            context.stroke(wall, with: .color(ObjectGlyphs.Palette.ink), lineWidth: 1)

            switch kind.category {
            case .passage:
                // Nothing in the gap — that is what a cased opening IS.
                break

            case .window:
                var glass = Path()
                glass.addRect(
                    CGRect(
                        x: holeLeft, y: wallY - band / 2, width: holeWidth, height: band))
                context.fill(glass, with: .color(ObjectGlyphs.Palette.water))
                context.stroke(glass, with: .color(ObjectGlyphs.Palette.ink), lineWidth: 1)

            case .door:
                // The leaf, standing open, and the arc it sweeps — the
                // convention every floor plan uses.
                var leaf = Path()
                leaf.move(to: CGPoint(x: holeLeft, y: wallY))
                leaf.addLine(to: CGPoint(x: holeLeft, y: wallY - holeWidth))
                context.stroke(
                    leaf, with: .color(ObjectGlyphs.Palette.wood), lineWidth: max(2, band * 0.6))

                var arc = Path()
                arc.addArc(
                    center: CGPoint(x: holeLeft, y: wallY), radius: holeWidth,
                    startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
                context.stroke(
                    arc, with: .color(ObjectGlyphs.Palette.ink.opacity(0.55)),
                    style: StrokeStyle(lineWidth: 1, dash: [3, 2]))
            }
        }
    }
}
