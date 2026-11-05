import SwiftUI

/// Start a project.
///
/// Three things, and only the name is required. The situation this is used in
/// is standing at a property that flooded an hour ago: the job exists, the
/// paperwork does not, and a form that refuses to record it until a customer
/// has been created is how measurements end up in somebody's notes app.
///
/// Redesigned 5 Nov 2026 (owner: "ours looks a bit too crowded"): grouped
/// cards with the fields inline, the Home look, instead of a caps label and a
/// box per field; the customer is picked from a searchable list rather than a
/// menu that grew one line per customer.
struct NewProjectSheet: View {
    let onCreated: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var clients: [ClientSummary] = []
    @State private var clientId: String?
    @State private var saving = false
    @State private var error: String?
    @State private var addingCustomer = false
    @State private var pickingCustomer = false
    @FocusState private var focused: Bool

    private var chosen: ClientSummary? { clients.first { $0.id == clientId } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Brand.Space.large) {
                    GroupedCard {
                        TextField("Project name", text: $name)
                            .font(.system(size: 17, weight: .semibold))
                            .textInputAutocapitalization(.words)
                            .focused($focused)
                            .padding(.horizontal, Brand.Space.base)
                            .padding(.vertical, 14)
                    }

                    VStack(alignment: .leading, spacing: Brand.Space.small) {
                        SectionHeading(title: "CUSTOMER", trailing: "optional")
                        GroupedCard { customerRows }
                    }

                    VStack(alignment: .leading, spacing: Brand.Space.small) {
                        SectionHeading(title: "WHAT HAPPENED", trailing: "optional")
                        GroupedCard {
                            TextField("Burst supply line under the kitchen sink…", text: $description, axis: .vertical)
                                .font(.system(size: 15))
                                .lineLimit(3...6)
                                .padding(.horizontal, Brand.Space.base)
                                .padding(.vertical, 12)
                        }
                    }

                    if let error {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }
                }
                .padding(Brand.Space.base)
            }
            .background(Brand.canvas)
            .navigationTitle("New project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                // Top right, like the iPhone's own forms: a button at the
                // bottom sat on top of the fields once the keyboard was up.
                ToolbarItem(placement: .topBarTrailing) {
                    if saving {
                        ProgressView()
                    } else {
                        Button("Create") { Task { await create() } }
                            .fontWeight(.semibold)
                            .disabled(name.trimmed.isEmpty)
                    }
                }
            }
            .task {
                focused = true
                clients = PreviewData.on ? CustomersView.previewClients : ((try? await API.shared.clients()) ?? [])
            }
            .sheet(isPresented: $pickingCustomer) {
                CustomerPickerSheet(clients: clients) { clientId = $0 }
            }
            .sheet(isPresented: $addingCustomer) {
                NewCustomerSheet { newId in
                    Task {
                        // Reload and select the one just made, so the operator
                        // is not left to find their own customer in a list
                        // they just added to.
                        clients = (try? await API.shared.clients()) ?? []
                        clientId = newId
                    }
                }
            }
        }
    }

    @ViewBuilder private var customerRows: some View {
        if let chosen {
            IconRow(title: chosen.name, detail: chosen.phone ?? chosen.email, showsChevron: false) {
                InitialsAvatar(name: chosen.name)
            } trailing: {
                Button { clientId = nil } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(Brand.inkFaint)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove customer")
            }
            RowDivider()
            Button { pickingCustomer = true } label: {
                IconRow(title: "Change customer", showsChevron: true) {
                    IconTile(icon: "arrow.left.arrow.right", tint: Brand.inkSoft)
                } trailing: { EmptyView() }
            }
            .buttonStyle(.plain)
        } else {
            // New first: on a first visit the customer usually does not
            // exist yet.
            Button { addingCustomer = true } label: {
                IconRow(title: "New customer", detail: "Name and a number", showsChevron: true) {
                    IconTile(icon: "person.badge.plus", tint: Brand.green)
                } trailing: { EmptyView() }
            }
            .buttonStyle(.plain)
            if !clients.isEmpty {
                RowDivider()
                Button { pickingCustomer = true } label: {
                    IconRow(title: "Existing customer", detail: "\(clients.count) on file", showsChevron: true) {
                        IconTile(icon: "person.2", tint: Brand.blue)
                    } trailing: { EmptyView() }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func create() async {
        saving = true
        error = nil
        do {
            let id = try await API.shared.createProject(
                name: name.trimmed,
                clientId: clientId,
                description: description.trimmed.isEmpty ? nil : description.trimmed)
            onCreated(id)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}

/// Pick a customer from a searchable list — one tap, no scrolling a menu.
struct CustomerPickerSheet: View {
    let clients: [ClientSummary]
    let onPick: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var shown: [ClientSummary] {
        guard !query.isEmpty else { return clients }
        return clients.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || ($0.company ?? "").localizedCaseInsensitiveContains(query)
                || ($0.phone ?? "").filter(\.isNumber).contains(query.filter(\.isNumber).isEmpty ? "\u{0}" : query.filter(\.isNumber))
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                GroupedCard {
                    ForEach(Array(shown.enumerated()), id: \.element.id) { index, client in
                        if index > 0 { RowDivider() }
                        Button {
                            onPick(client.id)
                            dismiss()
                        } label: {
                            IconRow(title: client.name, detail: client.phone ?? client.email, showsChevron: false) {
                                InitialsAvatar(name: client.name)
                            } trailing: { EmptyView() }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(Brand.Space.base)
            }
            .background(Brand.canvas)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Name, company or number")
            .navigationTitle("Customer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
        }
    }
}

/// Add a customer.
///
/// A name and a number. Billing addresses and tax rates are desk work, and a
/// form asking for them on a driveway is a form nobody finishes — what cannot
/// be recovered later is the phone number of the person standing in front of
/// you. Laid out like the iPhone's own new-contact card: two grouped cards,
/// fields inline.
struct NewCustomerSheet: View {
    /// The new customer's id, so a caller that needed one — the project form,
    /// mid-flow — can select it without asking the operator to find it.
    let onCreated: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var company = ""
    @State private var phone: String
    @State private var email = ""
    @State private var saving = false
    @State private var error: String?
    @FocusState private var focused: Bool

    /// `prefillPhone` serves "Create New Contact" on a call row — the number
    /// is the one thing already known, and retyping it is how digits get
    /// transposed.
    init(prefillPhone: String = "", onCreated: @escaping (String) -> Void) {
        self.onCreated = onCreated
        _phone = State(initialValue: prefillPhone)
    }

    private var displayName: String {
        let person = "\(firstName.trimmed) \(lastName.trimmed)".trimmed
        return person.isEmpty ? company.trimmed : person
    }

    private var canSave: Bool {
        !(firstName.trimmed.isEmpty && lastName.trimmed.isEmpty && company.trimmed.isEmpty)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Brand.Space.large) {
                    Group {
                        if displayName.isEmpty {
                            Image(systemName: "person.fill")
                                .font(.system(size: 30))
                                .foregroundStyle(Brand.blue)
                                .frame(width: 72, height: 72)
                                .background(Brand.blue.opacity(0.13), in: .circle)
                        } else {
                            InitialsAvatar(name: displayName, size: 72)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, Brand.Space.small)

                    GroupedCard {
                        InlineField(placeholder: "First name", text: $firstName)
                            .focused($focused)
                        RowDivider(inset: Brand.Space.base)
                        InlineField(placeholder: "Surname", text: $lastName)
                        RowDivider(inset: Brand.Space.base)
                        InlineField(placeholder: "Company (optional)", text: $company)
                    }

                    GroupedCard {
                        InlineField(placeholder: "Phone", text: $phone, icon: "phone.fill", tint: Brand.green, keyboard: .phonePad)
                        RowDivider()
                        InlineField(placeholder: "Email", text: $email, icon: "envelope.fill", tint: Brand.blue, keyboard: .emailAddress)
                    }

                    Text("Estimates and invoices go to this email. Marketing consent is separate.")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.inkFaint)
                        .padding(.horizontal, 4)

                    if let error {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }
                }
                .padding(Brand.Space.base)
            }
            .background(Brand.canvas)
            .navigationTitle("New customer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    if saving {
                        ProgressView()
                    } else {
                        Button("Add") { Task { await create() } }
                            .fontWeight(.semibold)
                            .disabled(!canSave)
                    }
                }
            }
            .task { focused = true }
        }
    }

    private func create() async {
        saving = true
        error = nil
        do {
            let id = try await API.shared.createClient(
                firstName: firstName.trimmed,
                lastName: lastName.trimmed,
                companyName: company.trimmed,
                phone: phone.trimmed,
                email: email.trimmed)
            onCreated(id)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}

/// A field that is a row of a grouped card, placeholder as its label — the
/// way the iPhone's own contact card asks for a name.
struct InlineField: View {
    let placeholder: String
    @Binding var text: String
    var icon: String?
    var tint: Color = Brand.blue
    var keyboard: UIKeyboardType = .default

    var body: some View {
        HStack(spacing: Brand.Space.small) {
            if let icon { IconTile(icon: icon, tint: tint) }
            TextField(placeholder, text: $text)
                .font(.system(size: 16))
                .keyboardType(keyboard)
                .autocorrectionDisabled(keyboard != .default)
                .textInputAutocapitalization(keyboard == .default ? .words : .never)
                .textContentType(keyboard == .phonePad ? .telephoneNumber : keyboard == .emailAddress ? .emailAddress : nil)
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.vertical, icon == nil ? 14 : 9)
    }
}

/// One labelled input, so every form in the app looks like the same form.
struct Field: View {
    let label: String
    @Binding var text: String
    var placeholder: String = ""
    var keyboard: UIKeyboardType = .default
    var lines: Int = 1
    /// For a number that is REPLACED rather than edited, like a room's width.
    /// Tapping the field empties it and shows the old value as the hint, and
    /// leaving it empty puts the old value back. Without this, typing 18' 8
    /// into a field holding 12 made "1218' 8" — a 12,187 sq ft room (found
    /// drawing the owner's second reference plan, 11 Oct 2026).
    var clearsOnFocus = false

    @FocusState private var focused: Bool
    @State private var before: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Brand.Space.tight) {
            Text(label)
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.3)
                .foregroundStyle(Brand.inkFaint)

            Group {
                if lines > 1 {
                    TextField(placeholder, text: $text, axis: .vertical)
                        .lineLimit(lines...lines)
                } else {
                    TextField(before ?? placeholder, text: $text)
                }
            }
            .focused($focused)
            .onChange(of: focused) { _, isFocused in
                guard clearsOnFocus else { return }
                if isFocused {
                    before = text
                    text = ""
                } else {
                    if text.trimmingCharacters(in: .whitespaces).isEmpty, let before {
                        text = before
                    }
                    before = nil
                }
            }
            .font(.system(size: 16))
            .keyboardType(keyboard)
            .autocorrectionDisabled(keyboard == .emailAddress)
            .textInputAutocapitalization(keyboard == .emailAddress ? .never : .words)
            .padding(Brand.Space.base)
            .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: Brand.Radius.card)
                    .strokeBorder(Brand.hairline, lineWidth: 0.5))
        }
    }
}

/// Put equipment on site.
///
/// The kinds are suggestions, not an enum — the rental catalogue changes, and
/// a form that refuses a new machine gets worked around with a lie. Quantity
/// is a stepper because "6 air movers" is one line, not six taps of a form.
struct AddEquipmentSheet: View {
    let projectId: String
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var kind = ""
    @State private var quantity = 1
    @State private var saving = false
    @State private var error: String?

    private static let kinds = [
        "Air mover", "LGR dehumidifier", "Conventional dehumidifier",
        "Air scrubber / HEPA", "Heater", "Injectidry / wall drying", "Ozone generator",
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.base) {
                        SectionHeading(title: "WHAT LANDED ON SITE?")

                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 150), spacing: Brand.Space.tight)],
                            spacing: Brand.Space.tight
                        ) {
                            ForEach(Self.kinds, id: \.self) { option in
                                Button {
                                    kind = option
                                } label: {
                                    Text(option)
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundStyle(kind == option ? .white : Brand.inkSoft)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 12)
                                        .background(
                                            kind == option ? Brand.charcoalDark : Brand.surface,
                                            in: .rect(cornerRadius: Brand.Radius.tile))
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        Field(label: "OR TYPE IT", text: $kind, placeholder: "What is it?")

                        Stepper(value: $quantity, in: 1...50) {
                            Text("^[\(quantity) unit](inflect: true)")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        .padding(Brand.Space.base)
                        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))

                        if let error {
                            Text(error).font(.footnote).foregroundStyle(.red)
                        }

                        Button(saving ? "Adding…" : "On site from now") {
                            Task { await save() }
                        }
                        .buttonStyle(PrimaryButtonStyle(enabled: !saving && !kind.trimmed.isEmpty))
                        .disabled(saving || kind.trimmed.isEmpty)

                        Text("The clock starts now and stops when you mark it collected. Both days bill — delivered Monday, collected Wednesday is three days.")
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                    }
                    .padding(Brand.Space.base)
                }
            }
            .navigationTitle("Add equipment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
        }
    }

    private func save() async {
        saving = true
        error = nil
        do {
            try await API.shared.addEquipment(
                projectId: projectId, kind: kind.trimmed, quantity: quantity)
            onSaved()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}
