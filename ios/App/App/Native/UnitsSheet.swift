import SwiftUI

/// The unit a measurement is written in, and the screen that sets it.
///
/// Matches the reference sheet in `Docs/reference/magicplan/editor-chrome-design.md` §9:
/// a system segmented control over a wheel of precisions, an apply button, and
/// the note that the choice reaches this project and new ones but not old
/// ones. The one deliberate difference is the default — this market quotes in
/// feet and inches, so metric is reachable rather than primary.

// MARK: - The setting

/// Where the choice lives.
///
/// One object, observed by every screen that writes a length down, so a change
/// takes effect everywhere at once rather than wherever the reader happened to
/// re-render. Backed by `UserDefaults` because it is a preference, not project
/// data — it belongs to the phone, not to the claim.
@MainActor
final class UnitSettings: ObservableObject {
    static let shared = UnitSettings()

    private static let key = "lengthFormat.v1"

    @Published var format: LengthFormat {
        didSet { persist() }
    }

    private init() {
        if let data = UserDefaults.standard.data(forKey: Self.key),
           let stored = try? JSONDecoder().decode(LengthFormat.self, from: data) {
            format = stored
        } else {
            format = .default
        }
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(format) else { return }
        UserDefaults.standard.set(data, forKey: Self.key)
    }

    /// The chosen format, readable from ANY actor.
    ///
    /// `shared` is main-actor isolated because it is an `ObservableObject`,
    /// which is right for the views that observe it — but `Measure`'s
    /// labels are called from report generation and other non-isolated
    /// code, and those must not print feet to an operator working in
    /// metres just because of where they were called from. Reads the same
    /// `UserDefaults` key `persist()` writes, so the two cannot disagree;
    /// a view that observes `shared` still redraws on change as before.
    nonisolated static var current: LengthFormat {
        guard let data = UserDefaults.standard.data(forKey: key),
            let stored = try? JSONDecoder().decode(LengthFormat.self, from: data)
        else { return .default }
        return stored
    }
}

// MARK: - The sheet

struct UnitsSheet: View {
    @ObservedObject private var settings = UnitSettings.shared
    @Environment(\.dismiss) private var dismiss

    /// Edited locally and committed on Apply, so backing out of the sheet
    /// leaves the setting alone. A units change re-labels every dimension in
    /// the app; it should take a deliberate tap, not a stray scroll.
    @State private var system: LengthFormat.System
    @State private var choice: LengthFormat

    init() {
        let current = UnitSettings.shared.format
        _system = State(initialValue: current.system)
        _choice = State(initialValue: current)
    }

    var body: some View {
        VStack(spacing: 0) {
            header

            VStack(spacing: 20) {
                Picker("", selection: $system) {
                    ForEach(LengthFormat.System.allCases) { option in
                        Text(option.title).tag(option)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: system) { _, now in
                    // Keep the row that is already in force if the operator
                    // comes back to a system, rather than snapping to the first.
                    let options = LengthFormat.presets(for: now)
                    choice = options.contains(settings.format) ? settings.format : options[0]
                }

                precisionWheel
            }
            .padding(20)
            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
            .padding(.horizontal, 16)

            Spacer(minLength: 0)

            footer
        }
        .background(Brand.surfaceRaised.ignoresSafeArea())
    }

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "ruler")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Brand.charcoal)
                .frame(width: 36, height: 36)
                .background(Brand.surfaceRaised, in: .rect(cornerRadius: 9))

            VStack(alignment: .leading, spacing: 1) {
                Text("Change Units").font(.system(size: 20, weight: .bold))
                Text("Pick a unit of measurement")
                    .font(.system(size: 14))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 30, height: 30)
                    .background(Brand.surfaceRaised, in: .circle)
            }
            .accessibilityLabel("Close")
        }
        .padding(16)
        .background(Brand.surface)
        .overlay(alignment: .bottom) { Divider() }
    }

    /// The precisions for the chosen system, the selected one in a capsule.
    ///
    /// Each row shows a length written that way rather than a description of
    /// the setting, so the choice is made by recognising the shape of the
    /// number. The metric rows are all the same length and differ only in
    /// digits; the imperial rows each carry the fraction that row can express,
    /// because three identically-formatted whole numbers would teach nothing.
    private var precisionWheel: some View {
        VStack(spacing: 4) {
            ForEach(Array(LengthFormat.presets(for: system).enumerated()), id: \.offset) { _, option in
                let selected = option == choice
                Button {
                    choice = option
                } label: {
                    Text(option.sample)
                        .font(.system(size: selected ? 26 : 22, weight: selected ? .semibold : .regular))
                        .foregroundStyle(selected ? Brand.charcoal : Color.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            selected ? Brand.surfaceRaised : .clear,
                            in: .rect(cornerRadius: Brand.Radius.pill)
                        )
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
        }
        .animation(.snappy(duration: 0.18), value: choice)
    }

    private var footer: some View {
        VStack(spacing: 10) {
            Button {
                settings.format = choice
                dismiss()
            } label: {
                Text("Apply Changes")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Brand.blue, in: .rect(cornerRadius: Brand.Radius.card))
            }

            Text("Changes affect this project and new ones. Projects already finished keep the units they were written in.")
                .font(.system(size: 13))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(16)
        .background(Brand.surface)
        .overlay(alignment: .top) { Divider() }
    }
}

// MARK: - The settings row that opens it

struct UnitsSettingRow: View {
    @ObservedObject private var settings = UnitSettings.shared
    @State private var showSheet = false

    var body: some View {
        Button { showSheet = true } label: {
            HStack {
                Label("Units", systemImage: "ruler")
                    .foregroundStyle(Brand.charcoal)
                Spacer()
                // The current setting, shown the way it writes a length, so
                // the row answers the question without being opened.
                Text(settings.format.sample)
                    .foregroundStyle(.secondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.tertiary)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showSheet) {
            UnitsSheet().presentationDetents([.medium, .large])
        }
    }
}
