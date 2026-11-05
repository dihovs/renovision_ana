import SwiftUI

/// Curve one wall (floor-plan spec §10, M5).
///
/// The curve is typed as the spec stores it: how far the middle of the wall
/// stands off the straight line between its corners, and which way — out of
/// the room or into it. The corners do not move; the wall between them bows.
/// Up to a semicircle (half the wall's length), which is v1's limit.
///
/// Feet and inches or metres, like every other dimension field here.
struct WallCurveSheet: View {
    /// The straight-line length between the wall's corners, metres.
    let chord: Double
    /// Its current bulge: + out of the room, − into it, 0 straight.
    let current: Double
    let apply: (_ bulge: Double) -> Void

    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var units = UnitSettings.shared
    @State private var depth = ""
    @State private var inward = false
    @State private var refused = false

    private var limit: Double { PlanBridge.maxBulge(chord: chord) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Text(inward ? "Bows in by" : "Bows out by")
                        Spacer()
                        TextField("—", text: $depth)
                            .keyboardType(.numbersAndPunctuation)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 120)
                    }
                    Picker("Direction", selection: $inward) {
                        Text("Out of the room").tag(false)
                        Text("Into the room").tag(true)
                    }
                    .pickerStyle(.segmented)
                } footer: {
                    Text(
                        refused
                            ? "Between 0 and \(units.format.format(limit)) — half of this \(units.format.format(chord)) wall, a semicircle."
                            : "How far the middle of the wall stands off the straight line between its corners. This wall is \(units.format.format(chord)) corner to corner."
                    )
                    .foregroundStyle(refused ? Color.red : Brand.inkSoft)
                }

                if current != 0 {
                    Section {
                        Button("Make it straight", role: .destructive) {
                            apply(0)
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle("Curve")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Apply") {
                        guard let d = units.format.parse(depth), d > 0, d <= limit + 1e-9 else {
                            refused = true
                            return
                        }
                        apply(inward ? -d : d)
                        dismiss()
                    }
                    .bold()
                }
            }
            .onAppear {
                if current != 0 {
                    depth = units.format.format(abs(current))
                    inward = current < 0
                }
            }
        }
    }
}
