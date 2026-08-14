import SwiftUI

/// A wall-by-wall walk through a room's lengths: which walls, where the
/// walk stands, and what has been typed so far. Owned by the editor running
/// it; the panel below only reads the position.
///
/// `baseline` is the polygon as it stood when the walk began — the frozen
/// directions `PlanEditing.applyWalkLengths` chains typed lengths along. A
/// hand edit mid-walk refreshes it, so the walk continues from what is on
/// screen rather than resurrecting the shape from before the drag.
struct MeasureRun {
    var queue: [Int]
    var position: Int
    var baseline: [CGPoint]
    /// Typed lengths by EDGE index; nil keeps the wall as drawn.
    var typed: [Double?]
    var active: Int { queue[position] }
    var isLast: Bool { position == queue.count - 1 }
}

/// Wall lengths, entered the way a tape measure is read out.
///
/// A purpose-built measurement panel, replacing the system-keyboard sheet:
/// the domain has exactly one input type, so the keypad is ours — digits, a
/// decimal, a backspace, and the two marks a contractor's number actually
/// carries, feet and inches. Parsing stays imperial-first
/// (`FloorPlanGeometry.parseFeetInches` — 13' 6, 12.5), which is better than
/// a metric readout for this market and is the reason the panel does not
/// copy its reference further than the idea.
///
/// It walks the room wall by wall: `Next` commits and advances, `Apply`
/// commits the last and closes. The canvas stays visible above with the
/// active wall highlighted, and every commit redraws the room immediately —
/// the number always has a referent, and a wrong one is seen while the
/// operator is still holding the tape. An empty entry skips the wall
/// unchanged, because half the walls in a real room are fine as dragged.
///
/// One component for both editors (`PlanEditorView`, `RoomSketchView`).
/// The parent owns the queue and the geometry; the panel owns nothing but
/// the text being typed.
struct MeasurementPanel: View {
    /// Which wall of how many, purely for the header and the button label.
    let step: Int
    let total: Int
    /// The active wall's current length, metres — the readout's placeholder,
    /// so the operator confirms with a glance instead of retyping.
    let current: Double
    /// Whether this wall's length was already typed by hand.
    let locked: Bool
    /// Commit: metres to apply, or nil to leave the wall as it is. The
    /// parent advances the walk either way.
    let onCommit: (Double?) -> Void
    /// Remove the active wall's lock, where locking exists.
    var onUnlock: (() -> Void)?
    let onClose: () -> Void

    @State private var text = ""

    private var isLast: Bool { step >= total - 1 }

    private var parsed: Double? {
        guard let metres = FloorPlanGeometry.parseFeetInches(text) else { return nil }
        // Same range the sheet enforced: under 4 inches is a typo, over 164
        // feet is a warehouse with a slipped digit.
        return (metres >= 0.10 && metres <= 50) ? metres : nil
    }

    /// Ready to advance: nothing typed (skip), or a number in range.
    private var canAdvance: Bool { text.isEmpty || parsed != nil }

    var body: some View {
        VStack(spacing: Brand.Space.small) {
            // Header: where the walk is, and the way out.
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Wall length")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Brand.ink)
                    Text("Wall \(step + 1) of \(total)")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.inkSoft)
                }
                Spacer()
                Button {
                    onClose()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(Brand.inkFaint)
                }
                .buttonStyle(.plain)
            }

            // The readout. The wall's current length sits greyed until a
            // digit replaces it — confirm by glance, overwrite by thumb.
            HStack(alignment: .firstTextBaseline) {
                Text(text.isEmpty ? FloorPlanGeometry.feetInches(current) : text)
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(text.isEmpty ? Brand.inkFaint : Brand.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                Spacer()
                if locked {
                    // The padlock the plan draws, in the panel too: this
                    // number was entered by hand and is defended.
                    Label("Set by hand", systemImage: "lock.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.orange)
                }
            }
            .padding(.horizontal, Brand.Space.small)
            .padding(.vertical, Brand.Space.tight)
            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))

            if !text.isEmpty && parsed == nil {
                Text("Between 4 inches and 164 feet — 13' 6, or 12.5.")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            // The marks a written measurement carries. A separate row, not
            // buried in the pad, because they are what make 13' 6 typeable
            // at all.
            HStack(spacing: Brand.Space.tight) {
                key("′ ft") { text += "'" }
                key("″ in") { text += "\"" }
                if let onUnlock, locked {
                    Button {
                        onUnlock()
                    } label: {
                        Text("Unlock")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.orange)
                            .frame(maxWidth: .infinity)
                            .frame(height: 40)
                            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
                    }
                    .buttonStyle(.plain)
                }
            }

            // The pad: three columns, the reference's row order, our keys.
            VStack(spacing: Brand.Space.tight) {
                ForEach([["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]], id: \.self) { row in
                    HStack(spacing: Brand.Space.tight) {
                        ForEach(row, id: \.self) { digit in
                            key(digit) { text += digit }
                        }
                    }
                }
                HStack(spacing: Brand.Space.tight) {
                    key(".") { text += "." }
                    key("0") { text += "0" }
                    key(systemImage: "delete.left") {
                        if !text.isEmpty { text.removeLast() }
                    }
                }
            }

            Button(isLast ? "Apply" : "Next") {
                onCommit(text.isEmpty ? nil : parsed)
                text = ""
            }
            .buttonStyle(PrimaryButtonStyle(enabled: canAdvance))
            .disabled(!canAdvance)
        }
        .padding(Brand.Space.base)
        .background(Brand.canvas)
        // A new wall means a new entry; the readout must not carry the last
        // wall's half-typed number onto this one.
        .onChange(of: step) { _, _ in text = "" }
    }

    private func key(_ label: String, action: @escaping () -> Void) -> some View {
        keyBody(action: action) {
            Text(label)
                .font(.system(size: 20, weight: .semibold, design: .rounded))
                .foregroundStyle(Brand.ink)
        }
    }

    private func key(systemImage: String, action: @escaping () -> Void) -> some View {
        keyBody(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Brand.ink)
        }
    }

    private func keyBody(action: @escaping () -> Void, @ViewBuilder label: () -> some View)
        -> some View
    {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            label()
                .frame(maxWidth: .infinity)
                .frame(height: 40)
                .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
        }
        .buttonStyle(.plain)
    }
}
