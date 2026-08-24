import SwiftUI

/// One placed object's own inspector — S8.
///
/// The screen where an object stops being a picture on a plan and becomes a
/// line item. Everything the owner asked for when he was asked what an
/// object has to do lives here: *"if replaced, if there is damage, it needs
/// to be counted, there is installation involved also, i need to have an
/// option to include or exclude it like any other item."*
///
/// Laid out the way every other inspector in this app is, because they are
/// one screen the operator learns once: Details first, the switch that
/// decides whether it counts second, dimensions after, and the destructive
/// action alone at the bottom.
struct ObjectDetailView: View {
    let object: RoomObject
    /// True when something was actually written, so the caller reloads only
    /// when there is a reason to.
    let onClose: (Bool) -> Void
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var units = UnitSettings.shared

    @State private var name: String
    @State private var disposition: String
    @State private var included: Bool
    @State private var quantity: Int
    @State private var notes: String
    @State private var changed = false
    @State private var widthText: String
    @State private var depthText: String
    @State private var heightText: String
    @State private var confirmingDelete = false
    @State private var error: String?
    @State private var suggestion: String?
    @State private var polishing = false

    init(object: RoomObject, onClose: @escaping (Bool) -> Void, onDelete: @escaping () -> Void) {
        self.object = object
        self.onClose = onClose
        self.onDelete = onDelete
        _name = State(initialValue: object.name ?? "")
        _disposition = State(initialValue: object.disposition)
        _included = State(initialValue: object.included)
        _quantity = State(initialValue: object.quantity)
        _notes = State(initialValue: object.notes ?? "")
        let format = UnitSettings.current
        _widthText = State(initialValue: format.format(object.width))
        _depthText = State(initialValue: format.format(object.depth))
        _heightText = State(initialValue: format.format(object.height))
    }

    /// One editable dimension, in the operator's own units.
    private func sizeRow(_ label: String, text: Binding<String>) -> some View {
        HStack {
            Text(label)
            Spacer()
            TextField(label, text: text)
                .multilineTextAlignment(.trailing)
                .keyboardType(.decimalPad)
                .foregroundStyle(Brand.ink)
                .frame(maxWidth: 130)
        }
    }

    /// The sizes this object is sold in — empty when it comes in one,
    /// which is what hides the list.
    private var sizeOptions: [ObjectCatalog.Stock] { object.entry?.stock ?? [] }

    /// Whether the fields currently hold this stock size, so the list can
    /// tick the one in force. Compared on the numbers rather than a stored
    /// choice: the size IS the measurement, and a tick that disagreed with
    /// the figures underneath would be the lie worth avoiding.
    private func matches(_ size: ObjectCatalog.Stock) -> Bool {
        guard let typed = typedSize else { return false }
        return abs(typed.width - size.width) < 0.005 && abs(typed.depth - size.depth) < 0.005
            && abs(typed.height - size.height) < 0.005
    }

    /// The three dimensions as metres, or nil where a field cannot be read.
    private var typedSize: (width: Double, depth: Double, height: Double)? {
        guard let w = units.format.parse(widthText), let d = units.format.parse(depthText),
            let h = units.format.parse(heightText),
            w > 0.01, d > 0.01, h > 0.01
        else { return nil }
        return (w, d, h)
    }

    /// Whether what is in the fields differs from the catalogue's stock
    /// size — which is what "measured by hand" means for an object.
    private var handSet: Bool {
        guard let typed = typedSize else { return object.sizeHandSet }
        guard let entry = object.entry else { return true }
        let off = { (a: Double, b: Double) in abs(a - b) > 0.005 }
        // A size off the STOCK LIST is not hand-measured, whichever one it
        // is — a 30-inch fridge is as much a catalogue fact as a 36-inch
        // one. Only a figure that matches none of them was measured, which
        // is what the padlock is for.
        if !entry.stock.isEmpty {
            return object.sizeHandSet && !sizeOptions.contains(where: matches)
                || !sizeOptions.contains(where: matches)
        }
        return object.sizeHandSet || off(typed.width, entry.width)
            || off(typed.depth, entry.depth) || off(typed.height, entry.height)
    }

    /// The five, in the order a job actually goes: nothing, out, out and
    /// back, out and new, or covered where it stands.
    private static let dispositions: [(value: String, label: String, note: String)] = [
        ("none", "In place", "Undamaged — nothing to do"),
        ("remove", "Remove & dispose", "Taken out and thrown away"),
        ("reset", "Remove & reset", "Taken out and put back — a toilet pulled to lift flooring"),
        ("replace", "Replace", "Taken out, a new one installed"),
        ("protect", "Protect in place", "Masked or covered where it stands"),
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Text("Name")
                        Spacer()
                        TextField(object.entry?.name ?? object.kind, text: $name)
                            .multilineTextAlignment(.trailing)
                            .foregroundStyle(Brand.ink)
                    }
                    if let entry = object.entry {
                        LabeledContent("Catalogue", value: entry.category.rawValue)
                    }
                    Stepper(
                        "Quantity: \(quantity)", value: $quantity, in: 1...99
                    )
                } header: {
                    Text("Details")
                } footer: {
                    Text(
                        "One object can stand for several identical ones — eight base cabinets in a run are one line, not eight placements."
                    )
                }

                Section {
                    Picker("What happens to it", selection: $disposition) {
                        ForEach(Self.dispositions, id: \.value) { option in
                            Text(option.label).tag(option.value)
                        }
                    }
                    if let note = Self.dispositions.first(where: { $0.value == disposition })?.note {
                        Text(note)
                            .font(.system(size: 12))
                            .foregroundStyle(Brand.inkSoft)
                    }

                    Toggle("Include in the claim", isOn: $included)
                } header: {
                    Text("On this job")
                } footer: {
                    Text(
                        included
                            ? "Counted in this room's takeoff."
                            : "Stays on the plan, drawn dashed, and is left out of every count."
                    )
                }

                // **Choosing the size, inside the object.** His report on
                // build 146: *"I'm putting the refrigerator. It's not asking
                // me to choose the size… it's showing me the refrigerator
                // thirty six inch, and that's it."* The four widths are four
                // catalogue tiles, which is what he chose — but the tile he
                // tapped came from the Recently-used rail, which goes
                // straight to the one he used last, so no choice was ever
                // offered.
                //
                // Here is where changing your mind belongs anyway: one tap
                // from 36in to 33in, on the object already standing in the
                // room, rather than delete-and-place-again.
                if sizeOptions.count > 1 {
                    Section {
                        ForEach(sizeOptions) { size in
                            Button {
                                widthText = units.format.format(size.width)
                                depthText = units.format.format(size.depth)
                                heightText = units.format.format(size.height)
                                name = "\(object.entry?.name ?? "") \(size.label)"
                                    .trimmingCharacters(in: .whitespaces)
                            } label: {
                                HStack {
                                    Text(size.label)
                                        .foregroundStyle(Brand.ink)
                                    Spacer()
                                    Text(
                                        UnitSettings.shared.format.format(size.width) + " × "
                                            + UnitSettings.shared.format.format(size.depth)
                                    )
                                    .font(.system(size: 13).monospacedDigit())
                                    .foregroundStyle(Brand.inkSoft)
                                    if matches(size) {
                                        Image(systemName: "checkmark")
                                            .font(.system(size: 13, weight: .bold))
                                            .foregroundStyle(Brand.blue)
                                    }
                                }
                                .contentShape(.rect)
                            }
                            .buttonStyle(.plain)
                        }
                    } header: {
                        Text("Standard sizes")
                    } footer: {
                        Text("Choosing one sets the measurements below. Type over them if this one was measured.")
                    }
                }

                Section {
                    // **Editable, because a real building does not read the
                    // catalogue.** The owner: *"I need to have a place that
                    // actually we can adjust and put it manually in case we
                    // get something weird that is not a standard size."*
                    // Old duplexes are full of appliances that fit the hole
                    // that was there.
                    //
                    // In the operator's OWN units, and parsed back through
                    // the same formatter — type 32 in an imperial setting
                    // and you get 32 inches, not 32 metres.
                    sizeRow("Width", text: $widthText)
                    sizeRow("Depth", text: $depthText)
                    sizeRow("Height", text: $heightText)
                    LabeledContent("Rotation", value: "\(Int(object.rotation))°")
                } header: {
                    HStack {
                        Text("Size")
                        if handSet {
                            // The padlock a typed wall length already
                            // carries. Same mark, same meaning: somebody put
                            // a tape on this, and a claim is entitled to
                            // know which figures were measured.
                            Image(systemName: "lock.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(Brand.blue)
                        }
                    }
                } footer: {
                    Text(
                        handSet
                            ? "Measured by hand. Reset returns it to the catalogue size."
                            : "The catalogue's stock size. Type a different figure if this one was measured."
                    )
                }

                if handSet, let entry = object.entry {
                    Section {
                        Button {
                            widthText = units.format.format(entry.width)
                            depthText = units.format.format(entry.depth)
                            heightText = units.format.format(entry.height)
                        } label: {
                            Label("Reset to catalogue size", systemImage: "arrow.uturn.backward")
                                .font(.system(size: 14))
                        }
                    }
                }

                Section("Notes") {
                    TextField("Anything worth recording", text: $notes, axis: .vertical)
                        .lineLimit(2...6)

                    // TIDY UP — the same suggestion-only AI editor the room
                    // and area notes carry. It never replaces what he typed:
                    // what he typed is what he saw, and the server is under
                    // orders to add nothing.
                    if !notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Button {
                            polishing = true
                            Task {
                                do {
                                    suggestion = try await API.shared.polish(
                                        note: notes.trimmingCharacters(in: .whitespacesAndNewlines))
                                } catch {
                                    self.error = error.localizedDescription
                                }
                                polishing = false
                            }
                        } label: {
                            Label(
                                polishing ? "Tidying…" : "Tidy up",
                                systemImage: "wand.and.sparkles")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Brand.blue)
                        }
                        .buttonStyle(.plain)
                        .disabled(polishing)
                    }

                    if let suggestion {
                        VStack(alignment: .leading, spacing: Brand.Space.tight) {
                            Text(suggestion)
                                .font(.system(size: 14))
                                .foregroundStyle(Brand.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            HStack {
                                Button("Use this") {
                                    notes = suggestion
                                    self.suggestion = nil
                                }
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(Brand.blue)
                                Spacer()
                                Button("Keep mine") { self.suggestion = nil }
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Brand.inkSoft)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }

                Section {
                    Button(role: .destructive) {
                        confirmingDelete = true
                    } label: {
                        Label("Remove from the plan", systemImage: "trash")
                    }
                } footer: {
                    Text("Deleting takes it off the drawing. To keep it on the plan but out of the claim, turn off Include instead.")
                }
            }
            .navigationTitle(object.displayName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { Task { await save() } }
                        .fontWeight(.semibold)
                }
            }
            .confirmationDialog(
                "Remove \(object.displayName)?", isPresented: $confirmingDelete,
                titleVisibility: .visible
            ) {
                Button("Remove", role: .destructive) {
                    onDelete()
                    dismiss()
                }
                Button("Keep it", role: .cancel) {}
            }
            .alert(
                "Could not save",
                isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })
            ) {
                Button("OK", role: .cancel) { error = nil }
            } message: {
                Text(error ?? "")
            }
        }
    }

    private func save() async {
        // Only what actually differs. Every /api/v1 route here reads an
        // absent key as "not mentioned", so sending the unchanged fields
        // would be noise at best and a race with another edit at worst.
        let newName = name.trimmingCharacters(in: .whitespaces)
        let nameChanged = newName != (object.name ?? "")
        let typed = typedSize
        let sizeChanged =
            typed.map {
                abs($0.width - object.width) > 0.005 || abs($0.depth - object.depth) > 0.005
                    || abs($0.height - object.height) > 0.005
            } ?? false
        let kindChanged = false
        let anything =
            nameChanged || disposition != object.disposition || included != object.included
            || quantity != object.quantity || notes != (object.notes ?? "") || sizeChanged
            || kindChanged

        guard anything else {
            onClose(false)
            dismiss()
            return
        }

        do {
            try await API.shared.updateObject(
                id: object.id,
                name: nameChanged ? newName : nil,
                width: sizeChanged ? typed?.width : nil,
                depth: sizeChanged ? typed?.depth : nil,
                height: sizeChanged ? typed?.height : nil,
                disposition: disposition != object.disposition ? disposition : nil,
                included: included != object.included ? included : nil,
                quantity: quantity != object.quantity ? quantity : nil,
                // Marked the moment a figure is typed, and left alone
                // otherwise — resetting to the catalogue size clears it,
                // which is what `handSet` recomputes above.
                // Picking a standard size is not measuring one: a size off
                // the list leaves the padlock off, typing an odd figure
                // sets it.
                sizeHandSet: sizeChanged ? handSet : nil,
                notes: notes != (object.notes ?? "") ? notes : nil)
            onClose(true)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
