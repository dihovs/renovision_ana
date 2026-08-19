import SwiftUI

/// Choosing something to put in a room.
///
/// ORD-40, in the owner's own description of it: *"when we click insert
/// button and we choose a door, I want to see illustrations and preferably
/// colored illustrations. Even if it says the section 'doors', I want it to
/// show one door that opens the door section. And when you click on it, it
/// shows all the different doors with illustrations. And I also wanna have a
/// tab that shows my favorite and most commonly used ones to start with...
/// And also we need the search bar there to search."*
///
/// So: a section grid whose tiles are themselves illustrations, a detail
/// screen per section, a rail of what he actually uses, and search. All four
/// of those are here.
///
/// **Recently used and favourites come FIRST**, above the sections. On a job
/// this catalogue is not browsed — the same eight things get placed all day,
/// and a rail that puts them one tap away is the difference between the
/// catalogue being used and being avoided.
struct ObjectPicker: View {
    /// What was chosen. The caller places it; this screen never writes.
    let onPick: (ObjectCatalog.Entry) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var search = ""
    /// Re-read rather than observed: `ObjectHabits` is `UserDefaults` and has
    /// no publisher, so the rail is refreshed when this view knows something
    /// changed — favouriting, or coming back from a placement.
    @State private var habitsVersion = 0

    private var results: [ObjectCatalog.Entry] { ObjectCatalog.search(search) }

    private var favourites: [ObjectCatalog.Entry] {
        _ = habitsVersion
        return ObjectHabits.favourites.compactMap(ObjectCatalog.entry(slug:))
    }

    private var recent: [ObjectCatalog.Entry] {
        _ = habitsVersion
        return ObjectHabits.recent.compactMap(ObjectCatalog.entry(slug:))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Brand.Space.large) {
                    if !search.isEmpty {
                        if results.isEmpty {
                            Text("Nothing matches “\(search)”.")
                                .font(.system(size: 15))
                                .foregroundStyle(Brand.inkSoft)
                                .padding(.horizontal, Brand.Space.base)
                        } else {
                            grid(results, title: "Results")
                        }
                    } else {
                        if !favourites.isEmpty {
                            rail(favourites, title: "Favourites")
                        }
                        if !recent.isEmpty {
                            rail(recent, title: "Recently used")
                        }
                        sections
                    }
                }
                .padding(.vertical, Brand.Space.base)
            }
            .background(Brand.canvas)
            .navigationTitle("Insert Object")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, prompt: "Search objects")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    /// The section grid. Each tile draws its own section's most
    /// representative object — his ask exactly: *"even if it says the section
    /// 'doors', I want it to show one door that opens the door section."*
    private var sections: some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            Text("All objects")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Brand.inkSoft)
                .padding(.horizontal, Brand.Space.base)

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 150), spacing: Brand.Space.small)],
                spacing: Brand.Space.small
            ) {
                ForEach(ObjectCatalog.Category.allCases) { category in
                    NavigationLink {
                        ObjectSection(category: category, onPick: pick)
                    } label: {
                        sectionTile(category)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Brand.Space.base)
        }
    }

    private func sectionTile(_ category: ObjectCatalog.Category) -> some View {
        // The first entry in a section is its most commonly met one — the
        // catalogue is ordered that way on purpose — so it is also the right
        // thing to draw on the section's own tile.
        let face = ObjectCatalog.entries(in: category).first

        return VStack(alignment: .leading, spacing: Brand.Space.tight) {
            ZStack {
                Brand.surfaceRaised
                if let face {
                    ObjectTileArt(entry: face)
                        .padding(Brand.Space.small)
                }
            }
            .frame(height: 96)
            .clipShape(.rect(cornerRadius: Brand.Radius.tile))

            Text(category.rawValue)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Brand.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(category.caption)
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Brand.Space.small)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
    }

    private func rail(_ entries: [ObjectCatalog.Entry], title: String) -> some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Brand.inkSoft)
                .padding(.horizontal, Brand.Space.base)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Brand.Space.small) {
                    ForEach(entries) { entry in
                        Button { pick(entry) } label: {
                            ObjectTile(entry: entry, compact: true)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Brand.Space.base)
            }
        }
    }

    private func grid(_ entries: [ObjectCatalog.Entry], title: String) -> some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Brand.inkSoft)
                .padding(.horizontal, Brand.Space.base)

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 110), spacing: Brand.Space.small)],
                spacing: Brand.Space.small
            ) {
                ForEach(entries) { entry in
                    Button { pick(entry) } label: {
                        ObjectTile(entry: entry, compact: false)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Brand.Space.base)
        }
    }

    private func pick(_ entry: ObjectCatalog.Entry) {
        ObjectHabits.remember(entry.slug)
        habitsVersion += 1
        onPick(entry)
        dismiss()
    }
}

/// One section's contents — every object in it, as illustrated tiles.
struct ObjectSection: View {
    let category: ObjectCatalog.Category
    let onPick: (ObjectCatalog.Entry) -> Void

    /// Bumped on a favourite toggle so the stars redraw; `ObjectHabits` is
    /// `UserDefaults` and publishes nothing on its own.
    @State private var version = 0

    var body: some View {
        ScrollView {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 110), spacing: Brand.Space.small)],
                spacing: Brand.Space.small
            ) {
                ForEach(ObjectCatalog.entries(in: category)) { entry in
                    Button { onPick(entry) } label: {
                        ObjectTile(entry: entry, compact: false, version: version)
                    }
                    .buttonStyle(.plain)
                    // Long-press to favourite: the rail at the top of the
                    // picker is only useful if filling it costs nothing, and
                    // a star on every tile would compete with the tap that
                    // places the object.
                    .contextMenu {
                        Button {
                            ObjectHabits.toggleFavourite(entry.slug)
                            version += 1
                        } label: {
                            Label(
                                ObjectHabits.isFavourite(entry.slug)
                                    ? "Remove from favourites" : "Add to favourites",
                                systemImage: ObjectHabits.isFavourite(entry.slug)
                                    ? "star.slash" : "star")
                        }
                    }
                }
            }
            .padding(Brand.Space.base)
        }
        .background(Brand.canvas)
        .navigationTitle(category.rawValue)
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// One catalogue entry as a tile: the illustration, its name, and its stock
/// size — because the size is what decides whether this is the right entry,
/// and hiding it would mean placing one to find out.
struct ObjectTile: View {
    let entry: ObjectCatalog.Entry
    var compact: Bool = false
    var version: Int = 0

    var body: some View {
        VStack(spacing: Brand.Space.tight) {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    Brand.surfaceRaised
                    ObjectTileArt(entry: entry)
                        .padding(Brand.Space.small)
                }
                if favourite {
                    Image(systemName: "star.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.blue)
                        .padding(5)
                }
            }
            .frame(width: compact ? 86 : nil, height: compact ? 72 : 84)
            .clipShape(.rect(cornerRadius: Brand.Radius.tile))

            Text(entry.name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Brand.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.75)

            if !compact {
                // The operator's OWN unit system, like every other figure in
                // this app — a stock size printed in inches under a plan
                // reading in metres is the complaint that produced that
                // rule in the first place.
                Text(
                    UnitSettings.shared.format.format(entry.width) + " × "
                        + UnitSettings.shared.format.format(entry.depth)
                )
                    .font(.system(size: 10).monospacedDigit())
                    .foregroundStyle(Brand.inkFaint)
                    .lineLimit(1)
            }
        }
        .frame(width: compact ? 86 : nil)
        .padding(compact ? 0 : Brand.Space.tight)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.tile))
    }

    private var favourite: Bool {
        _ = version
        return ObjectHabits.isFavourite(entry.slug)
    }
}
