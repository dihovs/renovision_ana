import SwiftUI

/// One wall, inspected in place — a sheet over the plan editor, reached by
/// selecting a wall and swiping up, exactly as the room sheet is reached
/// from the storey canvas.
///
/// The reference gives a wall the same three-tab shell as any other object
/// (object-model §2b): `Details · Photos & Notes · Forms`, with the wall's
/// own dimensions, its own affected areas, and two settings the room sheet
/// has no equivalent for — `Display Elevation in Report` and `Load-Bearing
/// Wall`. The tab set and header are lifted from `RoomDetailView` rather
/// than rewritten, per S1's note.
struct WallDetailView: View {
    let room: RoomScan
    let wallIndex: Int
    /// Computed by the editor from the corners on screen, not fetched — a
    /// wall's length is a fact about the room's geometry, which the editor
    /// already holds, not a field this sheet owns.
    let lengthM: Double
    /// Opens the elevation view on this wall so a new area can be dragged
    /// out on its face (`ElevationView`'s own drag-to-draw) — the plan
    /// editor owns that presentation, not this sheet.
    let onAddArea: () -> Void

    private enum Tab: String, CaseIterable, Identifiable {
        case details = "Details"
        case photos = "Photos & Notes"
        case forms = "Forms"
        var id: String { rawValue }
    }

    @Environment(\.dismiss) private var dismiss

    @State private var tab = Tab.details
    @State private var areas: [AffectedArea] = []
    @State private var loading = true
    @State private var error: String?
    @State private var editingArea: AffectedArea?
    @State private var loadBearing = false
    @State private var displayElevation = false
    @State private var loadedFlags = false
    @State private var savingFlag = false
    @State private var detent: PresentationDetent = .medium

    private var wallAreas: [AffectedArea] {
        areas.filter { $0.isWall && $0.wallIndex == wallIndex }
    }

    var body: some View {
        VStack(spacing: 0) {
            header

            Picker("Section", selection: $tab) {
                ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, Brand.Space.base)
            .padding(.bottom, Brand.Space.tight)

            List {
                switch tab {
                case .details: detailsTab
                case .photos: photosTab
                case .forms: formsTab
                }

                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .refreshable { await load() }
        }
        .background(Brand.canvas)
        .presentationDetents([.medium, .large], selection: $detent)
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.enabled(upThrough: .medium))
        .sheet(item: $editingArea) { area in
            AffectedAreaSheet(area: area) { Task { await load() } }
        }
        .task { await load() }
    }

    /// `ⓘ Wall n`, with the same collapse chevron as the room sheet.
    private var header: some View {
        HStack(spacing: Brand.Space.small) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 17))
                .foregroundStyle(Brand.blue)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 1) {
                Text("Wall \(wallIndex + 1)")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Brand.ink)
                    .lineLimit(1)
                Text("\(room.name) · \(Measure.ftLabel(lengthM))")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkFaint)
            }
            Spacer()
            Button {
                if detent == .large { detent = .medium } else { dismiss() }
            } label: {
                Image(systemName: "chevron.down.circle.fill")
                    .font(.system(size: 24))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(Brand.inkFaint)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(detent == .large ? "Collapse" : "Close")
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.top, Brand.Space.base)
        .padding(.bottom, Brand.Space.small)
    }

    // MARK: - Details

    @ViewBuilder private var detailsTab: some View {
        dimensionsSection
        affectedAreasSection
        settingsSection
    }

    private var dimensionsSection: some View {
        Section {
            StatisticRowView(row: .init(id: "length", label: "Length", value: Measure.ftLabel(lengthM), meaning: nil))
        } header: {
            Text("Dimensions")
        }
    }

    /// This wall's own damage, filtered from the room's areas — the same
    /// list `RoomDetailView` reads, narrowed to this edge.
    @ViewBuilder private var affectedAreasSection: some View {
        Section {
            if loading {
                ProgressView()
            } else if wallAreas.isEmpty {
                Text("Nothing marked on this wall.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(wallAreas) { area in
                    areaRow(area)
                }
            }
            Button {
                dismiss()
                onAddArea()
            } label: {
                Label("Add New Area", systemImage: "plus.circle.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Brand.blue)
            }
        } header: {
            HStack {
                Text("Affected Areas")
                Spacer()
                if !wallAreas.isEmpty {
                    Text(Measure.sqftLabel(wallAreas.reduce(0) { $0 + $1.areaSqm }))
                        .font(.caption.monospacedDigit())
                }
            }
        } footer: {
            Text("One or more areas, overlapping allowed, on this wall — all of them print. Opens the wall's own face to draw on.")
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
        }
    }

    private func areaRow(_ area: AffectedArea) -> some View {
        Button {
            editingArea = area
        } label: {
            HStack {
                Circle()
                    .fill(area.displayColor)
                    .frame(width: 10, height: 10)
                Text(area.name)
                    .foregroundStyle(Brand.ink)
                Spacer()
                Text(Measure.sqftLabel(area.areaSqm))
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.inkFaint)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    /// The reference's two wall-only flags (object-model §2b). Both persist
    /// immediately on toggle — there is no separate Save on this sheet, the
    /// same as the room sheet's own General fields.
    private var settingsSection: some View {
        Section {
            Toggle(isOn: $displayElevation) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Display Elevation in Report")
                        .foregroundStyle(Brand.ink)
                    Text("Include this wall's elevation drawing even if nothing is marked on it.")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.inkFaint)
                }
            }
            .tint(Brand.blue)
            .disabled(savingFlag)
            .onChange(of: displayElevation) { _, value in
                Task { await saveFlag(displayElevation: value) }
            }

            Toggle(isOn: $loadBearing) {
                Text("Load-Bearing Wall")
                    .foregroundStyle(Brand.ink)
            }
            .tint(Brand.blue)
            .disabled(savingFlag)
            .onChange(of: loadBearing) { _, value in
                Task { await saveFlag(loadBearing: value) }
            }
        } header: {
            Text("Settings")
        } footer: {
            Text("A wall with damage marked prints its elevation regardless of this toggle — it only adds an undamaged wall shown for context.")
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
        }
    }

    // MARK: - Photos & Notes

    @ViewBuilder private var photosTab: some View {
        if let projectId = room.projectId {
            RoomPhotosSection(projectId: projectId, roomScanId: room.id, wallIndex: wallIndex)
        } else {
            Section {
                Text("This room is not attached to a project yet, so photos have nowhere to file.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Forms

    @ViewBuilder private var formsTab: some View {
        InspectorFormsTab(
            subject: "this wall",
            footer: "The damage marking above, and the room's own drying log, are the record an adjuster reads today.")
    }

    // MARK: - Load / save

    private func load() async {
        loading = true
        async let a = API.shared.areas(roomScanId: room.id)
        async let w = API.shared.walls(roomScanId: room.id)
        areas = (try? await a) ?? []
        let walls = (try? await w) ?? []
        if !loadedFlags {
            loadedFlags = true
            if let mine = walls.first(where: { $0.wallIndex == wallIndex }) {
                loadBearing = mine.loadBearing
                displayElevation = mine.displayElevation
            }
        }
        loading = false
    }

    private func saveFlag(loadBearing: Bool? = nil, displayElevation: Bool? = nil) async {
        savingFlag = true
        do {
            try await API.shared.updateWall(
                roomScanId: room.id, wallIndex: wallIndex,
                loadBearing: loadBearing, displayElevation: displayElevation)
        } catch {
            self.error = error.localizedDescription
        }
        savingFlag = false
    }
}
