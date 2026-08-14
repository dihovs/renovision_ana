import SwiftUI

/// The phone, drawn like the iPhone's own Phone app.
///
/// Matched deliberately — pure black stage, a floating pill of tabs at the
/// bottom, big grey keys, red missed calls with direction arrows — because
/// the operator flips between this and the real dialer all day, and a layout
/// that matches is one that muscle memory already knows.
///
/// The connections are the system's too: long-press a call for Message /
/// Add to Contact / Delete, and every conversation carries a call button.
/// Calls and messages are two views of the same person, not two apps.
struct PhoneView: View {
    @StateObject private var calls = CallManager.shared
    @State private var tab: Tab = .calls
    @State private var typed = ""
    @State private var recents: [CallRecord]?
    @State private var contacts: [ClientSummary]?
    @State private var voice: Health.Voice?
    @State private var query = ""

    // Sheet targets. Item-based so one sheet mechanism serves every row.
    @State private var messaging: PhoneTarget?
    @State private var creatingContact: PhoneTarget?
    @State private var attaching: PhoneTarget?

    enum Tab { case calls, contacts, keypad }

    struct PhoneTarget: Identifiable {
        let number: String
        var id: String { number }
    }

    private var missedCount: Int {
        (recents ?? []).filter { !$0.answered }.count
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                // The system Phone app's stage: true black in the dark, plain
                // white in the light. Brand colour stays on the content.
                Color(.systemBackground).ignoresSafeArea()

                Group {
                    switch tab {
                    case .calls: callsList
                    case .contacts: contactList
                    case .keypad: keypad
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                pillBar
            }
            .navigationTitle(tab == .calls ? "Calls" : tab == .contacts ? "Contacts" : "")
            .navigationBarTitleDisplayMode(.inline)
            .dismissableWhenPresented()
            .task {
                async let r: Void = loadRecents()
                async let c: Void = loadContacts()
                voice = try? await API.shared.health().voice
                _ = await (r, c)
            }
        }
        .fullScreenCover(isPresented: .constant(calls.state.isBusy)) { InCallView() }
        .sheet(item: $messaging) { target in
            NavigationStack {
                MessageThreadView(
                    phone: target.number, displayName: contactName(for: target.number))
            }
        }
        .sheet(item: $creatingContact) { target in
            NewCustomerSheet(prefillPhone: target.number) { _ in
                Task { await loadContacts() }
            }
        }
        .sheet(item: $attaching) { target in
            AttachNumberSheet(number: target.number) {
                Task { await loadContacts() }
            }
        }
    }

    // MARK: - The floating bar

    private var pillBar: some View {
        HStack(spacing: Brand.Space.small) {
            HStack(spacing: 0) {
                pillItem(.calls, icon: "clock.fill", label: "Calls", badge: missedCount)
                pillItem(.contacts, icon: "person.crop.circle.fill", label: "Contacts")
                pillItem(.keypad, icon: "circle.grid.3x3.fill", label: "Keypad")
            }
            .padding(4)
            .background(.ultraThinMaterial, in: .capsule)

            Button {
                tab = .contacts
            } label: {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.primary)
                    .frame(width: 52, height: 52)
                    .background(.ultraThinMaterial, in: .circle)
            }
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.bottom, Brand.Space.tight)
    }

    private func pillItem(_ target: Tab, icon: String, label: String, badge: Int = 0) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            tab = target
        } label: {
            VStack(spacing: 2) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: icon)
                        .font(.system(size: 19, weight: .medium))
                    if badge > 0 {
                        Text(badge > 99 ? "99+" : "\(badge)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1.5)
                            .background(.red, in: .capsule)
                            .offset(x: 12, y: -8)
                    }
                }
                Text(label).font(.system(size: 11, weight: .medium))
            }
            .foregroundStyle(tab == target ? Brand.blue : .secondary)
            .frame(width: 84, height: 52)
            .background(
                tab == target ? AnyShapeStyle(.thickMaterial) : AnyShapeStyle(.clear),
                in: .capsule)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Calls

    private var callsList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if let voice, !voice.configured {
                    VStack(alignment: .leading, spacing: 3) {
                        Label(
                            "Calling is not switched on",
                            systemImage: "exclamationmark.triangle.fill"
                        )
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.orange)
                        Text(
                            "Unset on this deployment: \(voice.missing.joined(separator: ", ")). Tick Preview as well as Production in Vercel."
                        )
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Brand.Space.base)
                }

                if recents == nil {
                    ProgressView().padding(.top, 60)
                } else if recents!.isEmpty {
                    Text("No calls yet. Calls to the business number land here.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .padding(.top, 60)
                        .padding(.horizontal, Brand.Space.section)
                        .multilineTextAlignment(.center)
                } else {
                    ForEach(recents!) { record in
                        CallRow(
                            record: record,
                            name: contactName(for: record.otherNumber),
                            onCall: {
                                Task {
                                    await calls.place(
                                        to: record.otherNumber,
                                        label: contactName(for: record.otherNumber))
                                }
                            }
                        )
                        .contextMenu {
                            Button {
                                Task {
                                    await calls.place(
                                        to: record.otherNumber,
                                        label: contactName(for: record.otherNumber))
                                }
                            } label: {
                                Label("Call", systemImage: "phone")
                            }
                            Button {
                                messaging = PhoneTarget(number: record.otherNumber)
                            } label: {
                                Label("Message", systemImage: "message")
                            }
                            Divider()
                            Button {
                                attaching = PhoneTarget(number: record.otherNumber)
                            } label: {
                                Label(
                                    "Add to Existing Contact",
                                    systemImage: "person.crop.circle.badge.plus")
                            }
                            Button {
                                creatingContact = PhoneTarget(number: record.otherNumber)
                            } label: {
                                Label("Create New Contact", systemImage: "person.crop.circle")
                            }
                            Divider()
                            Button(role: .destructive) {
                                Task {
                                    try? await API.shared.deleteCall(id: record.id)
                                    await loadRecents()
                                }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }

                        Divider().padding(.leading, 76)
                    }
                }
            }
            .padding(.bottom, 90)
        }
        .refreshable { await loadRecents() }
    }

    // MARK: - Contacts

    private var contactList: some View {
        ScrollView {
            LazyVStack(spacing: Brand.Space.small) {
                // A custom field rather than .searchable: the floating pill
                // owns the bottom of this screen, and the system search bar
                // fights it for the same space.
                TextField("Search customers", text: $query)
                    .font(.system(size: 16))
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.vertical, Brand.Space.small)
                    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))

                if contacts == nil {
                    ProgressView().padding(.top, 40)
                } else if filteredContacts.isEmpty {
                    Text(
                        query.isEmpty
                            ? "No customers with a number yet."
                            : "Nothing matches “\(query)”."
                    )
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .padding(.top, 40)
                } else {
                    ForEach(filteredContacts) { contact in
                        ContactCard(contact: contact) { number in
                            Task { await calls.place(to: number, label: contact.name) }
                        }
                        .contextMenu {
                            if let number = contact.phone ?? contact.phones.first?.number {
                                Button {
                                    messaging = PhoneTarget(number: number)
                                } label: {
                                    Label("Message", systemImage: "message")
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, Brand.Space.base)
            .padding(.bottom, 90)
        }
        .refreshable { await loadContacts() }
    }

    private var filteredContacts: [ClientSummary] {
        let withNumbers = (contacts ?? []).filter { !$0.phones.isEmpty || $0.phone != nil }
        guard !query.isEmpty else { return withNumbers }
        return withNumbers.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || ($0.company ?? "").localizedCaseInsensitiveContains(query)
                || $0.phones.contains { $0.number.contains(query.filter(\.isNumber)) }
        }
    }

    // MARK: - Keypad

    private var keypad: some View {
        VStack(spacing: 0) {
            Spacer()

            Text(typed.isEmpty ? " " : CallManager.pretty(CallManager.normalise(typed)))
                .font(.system(size: 36, weight: .regular, design: .rounded))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .frame(height: 48)
                .padding(.horizontal, Brand.Space.large)

            if let error = calls.lastError {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Brand.Space.large)
            }

            Spacer()

            VStack(spacing: 12) {
                ForEach(Self.rows, id: \.first!.digit) { row in
                    HStack(spacing: 24) {
                        ForEach(row, id: \.digit) { key in
                            DialKey(digit: key.digit, letters: key.letters) {
                                typed.append(key.digit)
                            }
                        }
                    }
                }

                // The call row mirrors the system: green centred, delete to
                // its right only while there is something to delete.
                HStack(spacing: 24) {
                    Color.clear.frame(width: 78, height: 78)

                    Button {
                        Task { await calls.place(to: typed) }
                    } label: {
                        Image(systemName: "phone.fill")
                            .font(.system(size: 30))
                            .foregroundStyle(.white)
                            .frame(width: 78, height: 78)
                            .background(Color(hex: 0x34C759), in: .circle)
                    }
                    .disabled(typed.isEmpty)
                    .opacity(typed.isEmpty ? 0.5 : 1)

                    Button {
                        if !typed.isEmpty { typed.removeLast() }
                    } label: {
                        Image(systemName: "delete.left.fill")
                            .font(.system(size: 24))
                            .foregroundStyle(.secondary)
                            .frame(width: 78, height: 78)
                    }
                    .opacity(typed.isEmpty ? 0 : 1)
                }
            }
            .padding(.bottom, 104)
        }
    }

    private struct Key {
        let digit: String
        let letters: String
    }

    private static let rows: [[Key]] = [
        [.init(digit: "1", letters: ""), .init(digit: "2", letters: "ABC"), .init(digit: "3", letters: "DEF")],
        [.init(digit: "4", letters: "GHI"), .init(digit: "5", letters: "JKL"), .init(digit: "6", letters: "MNO")],
        [.init(digit: "7", letters: "PQRS"), .init(digit: "8", letters: "TUV"), .init(digit: "9", letters: "WXYZ")],
        [.init(digit: "*", letters: ""), .init(digit: "0", letters: "+"), .init(digit: "#", letters: "")],
    ]

    // MARK: - Data

    private func loadRecents() async {
        recents = (try? await API.shared.calls()) ?? []
    }

    private func loadContacts() async {
        contacts = (try? await API.shared.clients()) ?? []
    }

    /// The name this number belongs to, when we know it — matched on the
    /// last ten digits, the same rule the server's attribution uses.
    private func contactName(for number: String) -> String? {
        let tail = String(number.filter(\.isNumber).suffix(10))
        guard !tail.isEmpty else { return nil }
        return (contacts ?? []).first { contact in
            contact.phones.contains { String($0.number.filter(\.isNumber).suffix(10)) == tail }
                || (contact.phone.map { String($0.filter(\.isNumber).suffix(10)) == tail } ?? false)
        }?.name
    }
}

// MARK: - Rows

private struct CallRow: View {
    let record: CallRecord
    let name: String?
    let onCall: () -> Void

    var body: some View {
        HStack(spacing: Brand.Space.small) {
            ZStack {
                Circle().fill(Color(.secondarySystemBackground))
                if let name, let first = name.first {
                    Text(String(first).uppercased())
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.secondary)
                } else {
                    Image(systemName: "person.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 2) {
                Text(name ?? CallManager.pretty(CallManager.normalise(record.otherNumber)))
                    .font(.system(size: 16, weight: .medium))
                    // Red for missed, exactly as the system draws it — the
                    // colour IS the information on a fast scroll.
                    .foregroundStyle(record.answered ? Color.primary : Color.red)

                HStack(spacing: 4) {
                    Image(systemName: "arrow.down.left")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(record.answered ? Color.secondary : Color.red)
                    Text(subtitle)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                    if record.escalated {
                        StatusBadge(text: "escalated", tone: .warning)
                    }
                }
            }

            Spacer()

            Text(shortTime(record.startedAt))
                .font(.system(size: 14))
                .monospacedDigit()
                .foregroundStyle(.secondary)

            Button(action: onCall) {
                Image(systemName: "phone.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Brand.blue)
                    .frame(width: 38, height: 38)
                    .background(Color(.secondarySystemBackground), in: .circle)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Brand.Space.base)
        .padding(.vertical, Brand.Space.small)
        .contentShape(.rect)
    }

    private var subtitle: String {
        if !record.answered { return "Missed" }
        if let length = record.lengthLabel { return length }
        return "Renovision line"
    }
}

private struct DialKey: View {
    let digit: String
    let letters: String
    let action: () -> Void

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            VStack(spacing: 1) {
                Text(digit)
                    .font(.system(size: 34, weight: .regular, design: .rounded))
                    .foregroundStyle(.primary)
                if !letters.isEmpty {
                    Text(letters)
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(1.6)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 78, height: 78)
            .background(Color(.secondarySystemBackground), in: .circle)
        }
        .buttonStyle(.plain)
    }
}

private struct ContactCard: View {
    let contact: ClientSummary
    let onCall: (String) -> Void

    private var numbers: [ClientSummary.Phone] {
        contact.phones.isEmpty
            ? (contact.phone.map { [.init(number: $0, type: "main", primary: true)] } ?? [])
            : contact.phones
    }

    var body: some View {
        Card(padding: Brand.Space.small) {
            VStack(alignment: .leading, spacing: Brand.Space.small) {
                HStack(spacing: Brand.Space.small) {
                    ZStack {
                        Circle().fill(Brand.blue.opacity(0.12))
                        Text(initials)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Brand.blue)
                    }
                    .frame(width: 40, height: 40)

                    VStack(alignment: .leading, spacing: 1) {
                        Text(contact.name)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Brand.ink)
                        if let company = contact.company, !company.isEmpty {
                            Text(company)
                                .font(.system(size: 12))
                                .foregroundStyle(Brand.inkFaint)
                        }
                    }
                    Spacer()
                }

                ForEach(numbers, id: \.number) { phone in
                    Button {
                        onCall(phone.number)
                    } label: {
                        HStack {
                            Text(CallManager.pretty(CallManager.normalise(phone.number)))
                                .font(.system(size: 14, weight: .medium))
                                .monospacedDigit()
                                .foregroundStyle(Brand.blue)
                            Text(phone.type)
                                .font(.system(size: 11))
                                .foregroundStyle(Brand.inkFaint)
                            Spacer()
                            Image(systemName: "phone.fill")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 32, height: 32)
                                .background(Brand.green, in: .circle)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var initials: String {
        contact.name.split(separator: " ").prefix(2).map { String($0.prefix(1)).uppercased() }
            .joined()
    }
}

// MARK: - Add to existing contact

/// Pick which customer a number belongs to. The server does a phones-only
/// update, so nothing else on the record can be clobbered from a call row.
private struct AttachNumberSheet: View {
    let number: String
    let onDone: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var clients: [ClientSummary] = []
    @State private var query = ""
    @State private var error: String?

    private var shown: [ClientSummary] {
        guard !query.isEmpty else { return clients }
        return clients.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(CallManager.pretty(CallManager.normalise(number)))
                        .font(.system(size: 17, weight: .semibold).monospacedDigit())
                } header: {
                    Text("Add this number to")
                }

                if let error {
                    Text(error).foregroundStyle(.red).font(.footnote)
                }

                ForEach(shown) { client in
                    Button {
                        Task {
                            do {
                                try await API.shared.attachPhone(clientId: client.id, number: number)
                                onDone()
                                dismiss()
                            } catch {
                                self.error = error.localizedDescription
                            }
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(client.name).foregroundStyle(Brand.ink)
                            if let company = client.company, !company.isEmpty {
                                Text(company).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .searchable(text: $query)
            .navigationTitle("Choose customer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
            .task { clients = (try? await API.shared.clients()) ?? [] }
        }
    }
}

// MARK: - In call

/// What is on screen while a call is up. Controls sit where the system's own
/// call screen puts them, so muscle memory works; the keypad sends DTMF,
/// which is what an insurance line's menu asks for.
struct InCallView: View {
    @StateObject private var calls = CallManager.shared
    @State private var showKeypad = false
    @State private var elapsed = 0

    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Brand.charcoalDark.ignoresSafeArea()

            VStack(spacing: Brand.Space.large) {
                Spacer().frame(height: 40)

                VStack(spacing: Brand.Space.tight) {
                    Text(calls.remoteLabel)
                        .font(.system(size: 30, weight: .semibold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    Text(statusLine)
                        .font(.system(size: 15))
                        .monospacedDigit()
                        .foregroundStyle(.white.opacity(0.6))
                }

                Spacer()

                if showKeypad {
                    dtmfPad
                } else {
                    controls
                }

                Spacer()

                Button {
                    calls.hangUp()
                } label: {
                    Image(systemName: "phone.down.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(.white)
                        .frame(width: 74, height: 74)
                        .background(Color.red, in: .circle)
                }
                .padding(.bottom, Brand.Space.section)
            }
            .padding(.horizontal, Brand.Space.large)
        }
        .onReceive(tick) { _ in
            if let started = calls.startedAt {
                elapsed = Int(Date().timeIntervalSince(started))
            }
        }
    }

    private var statusLine: String {
        switch calls.state {
        case .connecting: return "Calling…"
        case .ringing: return "Ringing…"
        case .active: return String(format: "%d:%02d", elapsed / 60, elapsed % 60)
        case .ended(let reason): return reason ?? "Call ended"
        case .idle: return ""
        }
    }

    private var controls: some View {
        HStack(spacing: Brand.Space.section) {
            CallToggle(
                icon: calls.isMuted ? "mic.slash.fill" : "mic.fill", label: "Mute",
                on: calls.isMuted
            ) {
                calls.toggleMute()
            }
            CallToggle(icon: "circle.grid.3x3.fill", label: "Keypad", on: showKeypad) {
                showKeypad = true
            }
            CallToggle(
                icon: calls.isOnSpeaker ? "speaker.wave.3.fill" : "speaker.fill",
                label: "Speaker", on: calls.isOnSpeaker
            ) {
                calls.toggleSpeaker()
            }
        }
    }

    private var dtmfPad: some View {
        VStack(spacing: 12) {
            ForEach(["123", "456", "789", "*0#"], id: \.self) { row in
                HStack(spacing: 22) {
                    ForEach(Array(row).map(String.init), id: \.self) { digit in
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            calls.sendDigits(digit)
                        } label: {
                            Text(digit)
                                .font(.system(size: 28, design: .rounded))
                                .foregroundStyle(.white)
                                .frame(width: 66, height: 66)
                                .background(.white.opacity(0.12), in: .circle)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            Button("Hide") { showKeypad = false }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white.opacity(0.7))
                .padding(.top, Brand.Space.tight)
        }
    }
}

private struct CallToggle: View {
    let icon: String
    let label: String
    let on: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Brand.Space.tight) {
                Image(systemName: icon)
                    .font(.system(size: 24))
                    .foregroundStyle(on ? Brand.charcoalDark : .white)
                    .frame(width: 70, height: 70)
                    .background(on ? Color.white : Color.white.opacity(0.12), in: .circle)
                Text(label)
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.75))
            }
        }
        .buttonStyle(.plain)
    }
}
