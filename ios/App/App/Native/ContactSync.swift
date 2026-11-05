import Contacts
import SwiftUI

/// Two-way contact sync between the iPhone's Contacts and the CRM.
///
/// CRM → iPhone: every customer with a phone or an email is written into a
/// "Renovision" group, so an incoming call or text shows who it is. Each
/// contact we write carries a `renovision://client/<id>` link, which is how
/// we find it again to update it — never by name, which would one day
/// overwrite a different person. We only ever change contacts that carry
/// that link, and we never delete anything.
///
/// iPhone → CRM: contacts the CRM does not have (matched on the last ten
/// digits of a number, or on an email) are listed, and only the ones he
/// ticks are added as customers.
@MainActor
final class ContactSync: ObservableObject {
    static let shared = ContactSync()

    /// Keep the iPhone up to date on its own each time the app opens.
    @Published var auto = UserDefaults.standard.bool(forKey: "contactSync.auto") {
        didSet { UserDefaults.standard.set(auto, forKey: "contactSync.auto") }
    }
    private var lastRaw: Double {
        get { UserDefaults.standard.double(forKey: "contactSync.last") }
        set { UserDefaults.standard.set(newValue, forKey: "contactSync.last") }
    }

    @Published var running = false
    @Published var status: String?

    var last: Date? { lastRaw > 0 ? Date(timeIntervalSince1970: lastRaw) : nil }

    private let store = CNContactStore()
    private static let groupName = "Renovision"
    private static let linkLabel = "Renovision"
    static func link(for clientId: String) -> String { "renovision://client/\(clientId)" }

    var authorised: Bool {
        let status = CNContactStore.authorizationStatus(for: .contacts)
        if status == .authorized { return true }
        if #available(iOS 18.0, *), status == .limited { return true }
        return false
    }

    func requestAccess() async -> Bool {
        if authorised { return true }
        return (try? await store.requestAccess(for: .contacts)) ?? false
    }

    /// Called when the app comes to the front.
    func syncIfAuto() async {
        guard auto, authorised, !running else { return }
        if let last, Date().timeIntervalSince(last) < 6 * 3600 { return }
        _ = await pushCustomers()
    }

    // MARK: CRM → iPhone

    struct PushResult { var added = 0; var updated = 0; var unchanged = 0 }

    @discardableResult
    func pushCustomers() async -> PushResult? {
        guard await requestAccess() else {
            status = "Contacts access is off. Turn it on in Settings › Renovision."
            return nil
        }
        running = true
        defer { running = false }
        status = "Reading customers…"

        let clients: [ClientSummary]
        do {
            clients = try await API.shared.clients()
        } catch {
            status = error.localizedDescription
            return nil
        }

        do {
            let result = try write(clients.filter { $0.phone != nil || !$0.phones.isEmpty || $0.email != nil })
            lastRaw = Date().timeIntervalSince1970
            status = "iPhone updated: \(result.added) added, \(result.updated) updated."
            return result
        } catch {
            status = "Could not write to Contacts: \(error.localizedDescription)"
            return nil
        }
    }

    private static let keys: [CNKeyDescriptor] = [
        CNContactIdentifierKey, CNContactGivenNameKey, CNContactFamilyNameKey, CNContactOrganizationNameKey,
        CNContactPhoneNumbersKey, CNContactEmailAddressesKey, CNContactUrlAddressesKey, CNContactTypeKey,
    ].map { $0 as CNKeyDescriptor } + [CNContactFormatter.descriptorForRequiredKeys(for: .fullName)]

    private func write(_ clients: [ClientSummary]) throws -> PushResult {
        // Our contacts, by the client id in their link.
        var ours: [String: CNContact] = [:]
        let request = CNContactFetchRequest(keysToFetch: Self.keys)
        try store.enumerateContacts(with: request) { contact, _ in
            for url in contact.urlAddresses {
                let value = url.value as String
                if value.hasPrefix("renovision://client/") {
                    ours[String(value.dropFirst("renovision://client/".count))] = contact
                }
            }
        }

        let group = try ensureGroup()
        let save = CNSaveRequest()
        var result = PushResult()

        for client in clients {
            let phones = ([client.phone] + client.phones.map(\.number)).compactMap { $0 }.uniqued()
            let isCompany = client.company != nil && client.company == client.name
            let parts = client.name.split(separator: " ", maxSplits: 1).map(String.init)
            let given = isCompany ? "" : (parts.first ?? "")
            let family = isCompany ? "" : (parts.count > 1 ? parts[1] : "")

            if let existing = ours[client.id] {
                let same = existing.givenName == given && existing.familyName == family
                    && existing.organizationName == (client.company ?? "")
                    && Set(existing.phoneNumbers.map { Self.tail($0.value.stringValue) }) == Set(phones.map(Self.tail))
                    && Set(existing.emailAddresses.map { ($0.value as String).lowercased() }) == Set([client.email].compactMap { $0?.lowercased() })
                if same { result.unchanged += 1; continue }
                guard let mutable = existing.mutableCopy() as? CNMutableContact else { continue }
                fill(mutable, client: client, given: given, family: family, isCompany: isCompany, phones: phones)
                save.update(mutable)
                result.updated += 1
            } else {
                let contact = CNMutableContact()
                fill(contact, client: client, given: given, family: family, isCompany: isCompany, phones: phones)
                contact.urlAddresses = [CNLabeledValue(label: Self.linkLabel, value: Self.link(for: client.id) as NSString)]
                save.add(contact, toContainerWithIdentifier: nil)
                if let group { save.addMember(contact, to: group) }
                result.added += 1
            }
        }
        if result.added + result.updated > 0 { try store.execute(save) }
        return result
    }

    private func fill(_ contact: CNMutableContact, client: ClientSummary, given: String, family: String, isCompany: Bool, phones: [String]) {
        contact.contactType = isCompany ? .organization : .person
        contact.givenName = given
        contact.familyName = family
        contact.organizationName = client.company ?? ""
        contact.phoneNumbers = phones.enumerated().map { index, number in
            let type = client.phones.first { $0.number == number }?.type ?? "mobile"
            let label = type == "work" ? CNLabelWork : type == "home" ? CNLabelHome : index == 0 ? CNLabelPhoneNumberMobile : CNLabelOther
            return CNLabeledValue(label: label, value: CNPhoneNumber(stringValue: number))
        }
        contact.emailAddresses = [client.email].compactMap { $0 }.map { CNLabeledValue(label: CNLabelWork, value: $0 as NSString) }
    }

    /// The "Renovision" group, made once. Nil where the account (Exchange)
    /// does not support groups — the contacts are still written.
    private func ensureGroup() throws -> CNGroup? {
        if let found = try store.groups(matching: nil).first(where: { $0.name == Self.groupName }) { return found }
        let group = CNMutableGroup()
        group.name = Self.groupName
        let save = CNSaveRequest()
        save.add(group, toContainerWithIdentifier: nil)
        do {
            try store.execute(save)
        } catch {
            return nil
        }
        return try store.groups(matching: nil).first { $0.name == Self.groupName }
    }

    static func tail(_ number: String) -> String { String(number.filter(\.isNumber).suffix(10)) }

    // MARK: iPhone → CRM

    struct Candidate: Identifiable, Hashable {
        let id: String
        let given: String
        let family: String
        let company: String
        let phone: String
        let email: String
        var display: String {
            let person = [given, family].filter { !$0.isEmpty }.joined(separator: " ")
            return person.isEmpty ? company : person
        }
    }

    /// iPhone contacts with a number or an email that no customer has, and
    /// that are not ones we wrote ourselves.
    func candidates() async throws -> [Candidate] {
        guard await requestAccess() else { throw APIError.server("Contacts access is off. Turn it on in Settings › Renovision.") }
        let clients = try await API.shared.clients()
        let knownTails = Set(clients.flatMap { ([$0.phone] + $0.phones.map(\.number)).compactMap { $0 } }.map(Self.tail).filter { $0.count >= 7 })
        let knownEmails = Set(clients.compactMap { $0.email?.lowercased() })

        var out: [Candidate] = []
        let request = CNContactFetchRequest(keysToFetch: Self.keys)
        request.sortOrder = .userDefault
        try store.enumerateContacts(with: request) { contact, _ in
            if contact.urlAddresses.contains(where: { ($0.value as String).hasPrefix("renovision://") }) { return }
            let phone = contact.phoneNumbers.first?.value.stringValue ?? ""
            let email = (contact.emailAddresses.first?.value as String?) ?? ""
            guard !phone.isEmpty || !email.isEmpty else { return }
            let tails = contact.phoneNumbers.map { Self.tail($0.value.stringValue) }
            if tails.contains(where: knownTails.contains) { return }
            if contact.emailAddresses.contains(where: { knownEmails.contains(($0.value as String).lowercased()) }) { return }
            let c = Candidate(id: contact.identifier, given: contact.givenName, family: contact.familyName,
                              company: contact.organizationName, phone: phone, email: email)
            if !c.display.isEmpty { out.append(c) }
        }
        return out
    }

    /// Add the ticked contacts as customers. Returns how many were added.
    func importCandidates(_ picked: [Candidate]) async -> (added: Int, failed: Int) {
        running = true
        defer { running = false }
        var added = 0, failed = 0
        for c in picked {
            do {
                _ = try await API.shared.createClient(firstName: c.given, lastName: c.family, companyName: c.company,
                                                      phone: c.phone, email: c.email)
                added += 1
            } catch {
                failed += 1
            }
        }
        status = "Added \(added) to the CRM" + (failed > 0 ? ", \(failed) could not be added." : ".")
        // And straight back the other way, so the new customers carry their link.
        if added > 0 { _ = await pushCustomers() }
        return (added, failed)
    }
}

// MARK: - Screen

struct ContactSyncView: View {
    @ObservedObject private var sync = ContactSync.shared
    @State private var candidates: [ContactSync.Candidate]?
    @State private var picked = Set<String>()
    @State private var query = ""
    @State private var error: String?
    @State private var loading = false

    private var shown: [ContactSync.Candidate] {
        guard let candidates else { return [] }
        guard !query.isEmpty else { return candidates }
        return candidates.filter { $0.display.localizedCaseInsensitiveContains(query) || $0.phone.contains(query) }
    }

    var body: some View {
        List {
            Section {
                Button {
                    Task { await sync.pushCustomers() }
                } label: {
                    HStack {
                        Label("Put CRM customers on this iPhone", systemImage: "arrow.down.to.line")
                        Spacer()
                        if sync.running { ProgressView() }
                    }
                }
                .disabled(sync.running)
                Toggle("Keep them up to date automatically", isOn: $sync.auto)
                if let status = sync.status {
                    Text(status).font(.footnote).foregroundStyle(Brand.inkSoft)
                } else if let last = sync.last {
                    Text("Last updated \(last.formatted(.relative(presentation: .named)))").font(.footnote).foregroundStyle(Brand.inkSoft)
                }
            } header: {
                Text("CRM → iPhone")
            } footer: {
                Text("Customers go into a “Renovision” group, so calls and texts show their name. Only contacts this app made are ever changed, and nothing is deleted.")
            }

            Section {
                if candidates == nil {
                    Button {
                        Task { await loadCandidates() }
                    } label: {
                        HStack {
                            Label("Find iPhone contacts not in the CRM", systemImage: "arrow.up.to.line")
                            Spacer()
                            if loading { ProgressView() }
                        }
                    }
                    .disabled(loading)
                } else if shown.isEmpty {
                    Text(query.isEmpty ? "Every contact with a number is already in the CRM." : "Nothing matches.")
                        .foregroundStyle(Brand.inkSoft)
                } else {
                    ForEach(shown) { c in
                        Button {
                            if picked.contains(c.id) { picked.remove(c.id) } else { picked.insert(c.id) }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: picked.contains(c.id) ? "checkmark.circle.fill" : "circle")
                                    .font(.system(size: 20))
                                    .foregroundStyle(picked.contains(c.id) ? Brand.blue : Brand.inkFaint)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(c.display).foregroundStyle(Brand.ink)
                                    Text([c.phone, c.email].filter { !$0.isEmpty }.joined(separator: " · "))
                                        .font(.caption).foregroundStyle(Brand.inkSoft)
                                }
                            }
                        }
                    }
                }
                if let error { Text(error).font(.footnote).foregroundStyle(.red) }
            } header: {
                Text("iPhone → CRM")
            } footer: {
                Text("Tick the people who are customers. Only those are added.")
            }
        }
        .searchable(text: $query, prompt: "Search contacts")
        .navigationTitle("Contacts")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if !picked.isEmpty {
                Button {
                    Task {
                        let chosen = (candidates ?? []).filter { picked.contains($0.id) }
                        _ = await sync.importCandidates(chosen)
                        picked = []
                        await loadCandidates()
                    }
                } label: {
                    Text(sync.running ? "Adding…" : "Add \(picked.count) to the CRM")
                }
                .buttonStyle(PrimaryButtonStyle(enabled: !sync.running))
                .disabled(sync.running)
                .padding(.horizontal, Brand.Space.base)
                .padding(.vertical, Brand.Space.small)
                .background(.bar)
            }
        }
    }

    private func loadCandidates() async {
        loading = true
        defer { loading = false }
        do {
            candidates = try await ContactSync.shared.candidates()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}
