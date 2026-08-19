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
    @State private var confirmingDelete = false
    @State private var error: String?

    init(object: RoomObject, onClose: @escaping (Bool) -> Void, onDelete: @escaping () -> Void) {
        self.object = object
        self.onClose = onClose
        self.onDelete = onDelete
        _name = State(initialValue: object.name ?? "")
        _disposition = State(initialValue: object.disposition)
        _included = State(initialValue: object.included)
        _quantity = State(initialValue: object.quantity)
        _notes = State(initialValue: object.notes ?? "")
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

                Section("Size") {
                    // Read-only for now, and honestly so rather than
                    // offering fields that write nothing: the catalogue's
                    // stock size is right until it is not, and editing it
                    // needs the same measurement panel the walls use rather
                    // than three loose text fields.
                    LabeledContent("Width", value: units.format.format(object.width))
                    LabeledContent("Depth", value: units.format.format(object.depth))
                    LabeledContent("Height", value: units.format.format(object.height))
                    LabeledContent("Rotation", value: "\(Int(object.rotation))°")
                }

                Section("Notes") {
                    TextField("Anything worth recording", text: $notes, axis: .vertical)
                        .lineLimit(2...6)
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
        let anything =
            nameChanged || disposition != object.disposition || included != object.included
            || quantity != object.quantity || notes != (object.notes ?? "")

        guard anything else {
            onClose(false)
            dismiss()
            return
        }

        do {
            try await API.shared.updateObject(
                id: object.id,
                name: nameChanged ? newName : nil,
                disposition: disposition != object.disposition ? disposition : nil,
                included: included != object.included ? included : nil,
                quantity: quantity != object.quantity ? quantity : nil,
                notes: notes != (object.notes ?? "") ? notes : nil)
            onClose(true)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
