import SwiftUI

/// Start a project.
///
/// Three fields, and only the name is required. The situation this is used in
/// is standing at a property that flooded an hour ago: the job exists, the
/// paperwork does not, and a form that refuses to record it until a customer
/// has been created is how measurements end up in somebody's notes app.
struct NewProjectSheet: View {
    let onCreated: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var clients: [ClientSummary] = []
    @State private var clientId: String?
    @State private var saving = false
    @State private var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.base) {
                        Field(label: "PROJECT NAME", text: $name, placeholder: "Tremblay — basement water loss")
                            .focused($focused)

                        VStack(alignment: .leading, spacing: Brand.Space.tight) {
                            SectionHeading(title: "CUSTOMER", trailing: "optional")
                            Menu {
                                Button("No customer yet") { clientId = nil }
                                Divider()
                                ForEach(clients) { client in
                                    Button(client.name) { clientId = client.id }
                                }
                            } label: {
                                Card(padding: Brand.Space.small) {
                                    HStack {
                                        Text(chosenName)
                                            .font(.system(size: 15))
                                            .foregroundStyle(clientId == nil ? Brand.inkFaint : Brand.ink)
                                        Spacer()
                                        Image(systemName: "chevron.up.chevron.down")
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundStyle(Brand.inkFaint)
                                    }
                                }
                            }
                        }

                        Field(
                            label: "WHAT HAPPENED", text: $description,
                            placeholder: "Burst supply line under the kitchen sink…", lines: 4)

                        if let error {
                            Text(error).font(.footnote).foregroundStyle(.red)
                        }

                        Button(saving ? "Creating…" : "Create project") {
                            Task { await create() }
                        }
                        .buttonStyle(PrimaryButtonStyle(enabled: !saving && !name.trimmed.isEmpty))
                        .disabled(saving || name.trimmed.isEmpty)
                    }
                    .padding(Brand.Space.base)
                }
            }
            .navigationTitle("New project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
            .task {
                focused = true
                clients = (try? await API.shared.clients()) ?? []
            }
        }
    }

    private var chosenName: String {
        guard let clientId else { return "No customer yet" }
        return clients.first { $0.id == clientId }?.name ?? "No customer yet"
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

/// Add a customer.
///
/// A name and a number. Billing addresses and tax rates are desk work, and a
/// form asking for them on a driveway is a form nobody finishes — what cannot
/// be recovered later is the phone number of the person standing in front of
/// you.
struct NewCustomerSheet: View {
    let onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var company = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var saving = false
    @State private var error: String?
    @FocusState private var focused: Bool

    private var canSave: Bool {
        !(firstName.trimmed.isEmpty && lastName.trimmed.isEmpty && company.trimmed.isEmpty)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.base) {
                        HStack(spacing: Brand.Space.small) {
                            Field(label: "FIRST NAME", text: $firstName, placeholder: "Marc")
                                .focused($focused)
                            Field(label: "SURNAME", text: $lastName, placeholder: "Tremblay")
                        }

                        Field(label: "COMPANY", text: $company, placeholder: "optional")

                        Field(
                            label: "PHONE", text: $phone, placeholder: "(450) 555-0123",
                            keyboard: .phonePad)

                        Field(
                            label: "EMAIL", text: $email, placeholder: "marc@example.ca",
                            keyboard: .emailAddress)

                        if let error {
                            Text(error).font(.footnote).foregroundStyle(.red)
                        }

                        Button(saving ? "Adding…" : "Add customer") {
                            Task { await create() }
                        }
                        .buttonStyle(PrimaryButtonStyle(enabled: !saving && canSave))
                        .disabled(saving || !canSave)

                        Text(
                            "Estimates and invoices will go to this email. Marketing consent is separate and is not switched on here."
                        )
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.inkFaint)
                    }
                    .padding(Brand.Space.base)
                }
            }
            .navigationTitle("New customer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
            .task { focused = true }
        }
    }

    private func create() async {
        saving = true
        error = nil
        do {
            _ = try await API.shared.createClient(
                firstName: firstName.trimmed,
                lastName: lastName.trimmed,
                companyName: company.trimmed,
                phone: phone.trimmed,
                email: email.trimmed)
            onCreated()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}

/// One labelled input, so every form in the app looks like the same form.
struct Field: View {
    let label: String
    @Binding var text: String
    var placeholder: String = ""
    var keyboard: UIKeyboardType = .default
    var lines: Int = 1

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
                    TextField(placeholder, text: $text)
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
