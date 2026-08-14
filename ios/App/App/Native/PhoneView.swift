import SwiftUI

/// The phone: a keypad, the contact book, and the in-call screen.
///
/// Built to feel like the iPhone's own Phone app, because that is what was
/// asked for and because it is the right answer — a dialer that behaves
/// differently from the one on the same device is a dialer people misdial on.
/// Big round keys, letters under the digits, a green call button, and mute /
/// speaker / keypad in the same places the system puts them.
struct PhoneView: View {
    @StateObject private var calls = CallManager.shared
    @State private var typed = ""
    @State private var contacts: [ClientSummary]?
    @State private var mode: Mode = .recents
    @State private var recents: [CallRecord]?
    @State private var query = ""

    enum Mode: String, CaseIterable {
        case recents = "Recents"
        case keypad = "Keypad"
        case contacts = "Contacts"
    }

    private var filtered: [ClientSummary] {
        let withNumbers = (contacts ?? []).filter { !$0.phones.isEmpty || $0.phone != nil }
        guard !query.isEmpty else { return withNumbers }
        return withNumbers.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || ($0.company ?? "").localizedCaseInsensitiveContains(query)
                || $0.phones.contains { $0.number.contains(query) }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                VStack(spacing: 0) {
                    Picker("", selection: $mode) {
                        ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.bottom, Brand.Space.small)

                    switch mode {
                    case .recents: recentList
                    case .keypad: keypad
                    case .contacts: contactList
                    }
                }
            }
            .navigationTitle("Phone")
            .dismissableWhenPresented()
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await loadContacts()
                await loadRecents()
            }
        }
        // The in-call screen covers everything, the way a call does on a phone.
        .fullScreenCover(isPresented: .constant(calls.state.isBusy)) {
            InCallView()
        }
    }

    // MARK: - Keypad

    private var keypad: some View {
        VStack(spacing: 0) {
            Spacer(minLength: Brand.Space.small)

            Text(typed.isEmpty ? " " : CallManager.pretty(CallManager.normalise(typed)))
                .font(.system(size: 34, weight: .regular, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Brand.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .frame(height: 46)
                .padding(.horizontal, Brand.Space.large)

            if let error = calls.lastError {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Brand.Space.large)
            }

            Spacer(minLength: Brand.Space.small)

            VStack(spacing: 14) {
                ForEach(Self.rows, id: \.first!.digit) { row in
                    HStack(spacing: 26) {
                        ForEach(row, id: \.digit) { key in
                            DialKey(digit: key.digit, letters: key.letters) {
                                typed.append(key.digit)
                            }
                        }
                    }
                }
            }

            Spacer(minLength: Brand.Space.base)

            HStack {
                // Balances the delete button so the call key sits centred, the
                // way it does in the system dialer.
                Color.clear.frame(width: 68, height: 68)

                Spacer()

                Button {
                    Task { await calls.place(to: typed) }
                } label: {
                    Image(systemName: "phone.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(.white)
                        .frame(width: 74, height: 74)
                        .background(typed.isEmpty ? Brand.inkFaint : Brand.green, in: .circle)
                }
                .disabled(typed.isEmpty)

                Spacer()

                Button {
                    if !typed.isEmpty { typed.removeLast() }
                } label: {
                    Image(systemName: "delete.left.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(typed.isEmpty ? .clear : Brand.inkSoft)
                        .frame(width: 68, height: 68)
                }
                .disabled(typed.isEmpty)
            }
            .padding(.horizontal, Brand.Space.large)
            .padding(.bottom, Brand.Space.large)
        }
    }

    // MARK: - Contacts

    private var contactList: some View {
        ScrollView {
            LazyVStack(spacing: Brand.Space.small) {
                if contacts == nil {
                    ProgressView().padding(.top, 40)
                } else if filtered.isEmpty {
                    Card {
                        Text(
                            query.isEmpty
                                ? "No customers with a phone number yet."
                                : "Nothing matches “\(query)”."
                        )
                        .font(.callout)
                        .foregroundStyle(Brand.inkSoft)
                    }
                } else {
                    ForEach(filtered) { contact in
                        ContactCard(contact: contact) { number in
                            Task { await calls.place(to: number, label: contact.name) }
                        }
                    }
                }
            }
            .padding(.horizontal, Brand.Space.base)
            .padding(.bottom, Brand.Space.large)
        }
        .searchable(text: $query, prompt: "Search customers")
        .refreshable { await loadContacts() }
    }

    private func loadContacts() async {
        contacts = (try? await API.shared.clients()) ?? []
    }

    private func loadRecents() async {
        recents = (try? await API.shared.calls()) ?? []
    }

    // MARK: - Recents

    /// Who called, who was called, and whether anybody actually spoke. The
    /// last of those matters most: a row for a call that rang out should not
    /// look like one that was answered, or the log stops being scannable.
    private var recentList: some View {
        ScrollView {
            LazyVStack(spacing: Brand.Space.small) {
                if recents == nil {
                    ProgressView().padding(.top, 40)
                } else if recents!.isEmpty {
                    Card {
                        Text("No calls yet. Calls placed here and calls to the business number both land in this list.")
                            .font(.callout)
                            .foregroundStyle(Brand.inkSoft)
                    }
                } else {
                    ForEach(recents!) { record in
                        RecentRow(record: record) { number in
                            Task { await calls.place(to: number) }
                        }
                    }
                }
            }
            .padding(.horizontal, Brand.Space.base)
            .padding(.bottom, Brand.Space.large)
        }
        .refreshable { await loadRecents() }
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
}

// MARK: - Pieces

private struct DialKey: View {
    let digit: String
    let letters: String
    let action: () -> Void

    var body: some View {
        Button {
            // The system dialer clicks; a silent keypad feels broken even when
            // it is working.
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            VStack(spacing: 1) {
                Text(digit)
                    .font(.system(size: 32, weight: .regular, design: .rounded))
                    .foregroundStyle(Brand.ink)
                if !letters.isEmpty {
                    Text(letters)
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(1.4)
                        .foregroundStyle(Brand.inkSoft)
                }
            }
            .frame(width: 74, height: 74)
            .background(Brand.surface, in: .circle)
            .overlay(Circle().strokeBorder(Brand.hairline, lineWidth: 0.5))
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

                // Every number, not a guess at the right one: calling a
                // landline when the customer is on site wastes the call.
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
        let parts = contact.name.split(separator: " ").prefix(2)
        return parts.map { String($0.prefix(1)).uppercased() }.joined()
    }
}

// MARK: - In call

/// What is on screen while a call is up.
///
/// The controls sit where the iPhone's own call screen puts them — mute top
/// left, keypad top middle, speaker top right — so muscle memory works. The
/// keypad here sends DTMF, which is what an insurance line's menu asks for.
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
        case .active:
            return String(format: "%d:%02d", elapsed / 60, elapsed % 60)
        case .ended(let reason): return reason ?? "Call ended"
        case .idle: return ""
        }
    }

    private var controls: some View {
        HStack(spacing: Brand.Space.section) {
            CallToggle(icon: calls.isMuted ? "mic.slash.fill" : "mic.fill", label: "Mute", on: calls.isMuted) {
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


/// One line in Recents.
private struct RecentRow: View {
    let record: CallRecord
    let onCall: (String) -> Void

    var body: some View {
        Card(padding: Brand.Space.small) {
            HStack(spacing: Brand.Space.small) {
                Image(systemName: record.icon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(record.answered ? Brand.inkSoft : .red)
                    .frame(width: 26)

                VStack(alignment: .leading, spacing: 2) {
                    Text(CallManager.pretty(CallManager.normalise(record.otherNumber)))
                        .font(.system(size: 15, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(record.answered ? Brand.ink : .red)
                    HStack(spacing: 5) {
                        Text(record.startedAt, format: .dateTime.month(.abbreviated).day().hour().minute())
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                        if let length = record.lengthLabel {
                            Text("·").font(.system(size: 11)).foregroundStyle(Brand.inkFaint)
                            Text(length).font(.system(size: 11).monospacedDigit())
                                .foregroundStyle(Brand.inkFaint)
                        }
                        if record.escalated {
                            StatusBadge(text: "escalated", tone: .warning)
                        }
                    }
                }

                Spacer()

                Button {
                    onCall(record.otherNumber)
                } label: {
                    Image(systemName: "phone.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 32, height: 32)
                        .background(Brand.green, in: .circle)
                }
                .buttonStyle(.plain)
            }
        }
    }
}
