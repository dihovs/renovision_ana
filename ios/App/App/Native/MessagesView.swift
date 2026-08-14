import SwiftUI

/// Text conversations, the way the iPhone's Messages app arranges them —
/// because the operator flips between this and the real thing all day, and a
/// second layout to learn is a tax on every glance.
///
/// The semantics underneath are the CRM's, not Apple's, and the differences
/// are deliberate:
///   - "needs a reply" is the only attention state. There is no read/unread
///     anywhere in the pipeline, and inventing one would show badges the web
///     inbox cannot see.
///   - No delivery ticks. Outbound status is "queued" or "failed", nothing
///     else exists, and a fabricated checkmark is worse than none.
///   - An opted-out number loses its composer entirely. The refusal happens
///     before typing, not after.
struct MessagesView: View {
    @State private var conversations: [SmsConversation]?
    @State private var error: String?
    @State private var query = ""

    private var shown: [SmsConversation] {
        guard let conversations else { return [] }
        guard !query.isEmpty else { return conversations }
        return conversations.filter {
            ($0.clientName ?? "").localizedCaseInsensitiveContains(query)
                || $0.phone.contains(query.filter(\.isNumber))
                || $0.lastBody.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        ZStack {
            Brand.canvas.ignoresSafeArea()

            ScrollView {
                LazyVStack(spacing: Brand.Space.small) {
                    if let error {
                        Card {
                            Label(error, systemImage: "exclamationmark.triangle.fill")
                                .font(.callout)
                                .foregroundStyle(.orange)
                        }
                    }

                    if conversations == nil {
                        ProgressView().padding(.top, 60)
                    } else if shown.isEmpty {
                        Card {
                            Text(
                                query.isEmpty
                                    ? "No conversations yet. Texts to the business number land here."
                                    : "Nothing matches “\(query)”."
                            )
                            .font(.callout)
                            .foregroundStyle(Brand.inkSoft)
                        }
                    } else {
                        ForEach(shown) { conversation in
                            NavigationLink(value: conversation) {
                                ConversationRow(conversation: conversation)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, Brand.Space.base)
                .padding(.top, Brand.Space.small)
                .padding(.bottom, Brand.Space.large)
            }
            .refreshable { await load() }
        }
        .navigationTitle("Messages")
        .dismissableWhenPresented()
        .searchable(text: $query, prompt: "Search names, numbers, texts")
        .navigationDestination(for: SmsConversation.self) { conversation in
            MessageThreadView(phone: conversation.phone, displayName: conversation.clientName)
        }
        .task { await load() }
    }

    private func load() async {
        do {
            conversations = try await API.shared.conversations()
            error = nil
        } catch {
            self.error = error.localizedDescription
            if conversations == nil { conversations = [] }
        }
    }
}

private struct ConversationRow: View {
    let conversation: SmsConversation

    var body: some View {
        Card(padding: Brand.Space.small) {
            HStack(spacing: Brand.Space.small) {
                ZStack {
                    Circle().fill(Brand.blue.opacity(0.12))
                    Text(initials)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Brand.blue)
                }
                .frame(width: 42, height: 42)

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: Brand.Space.tight) {
                        Text(conversation.clientName
                             ?? CallManager.pretty(CallManager.normalise(conversation.phone)))
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Brand.ink)
                            .lineLimit(1)

                        if conversation.awaitingReply {
                            StatusBadge(text: "reply", tone: .info)
                        }
                        if conversation.lastFailed {
                            StatusBadge(text: "failed", tone: .warning)
                        }
                        if conversation.optedOut {
                            StatusBadge(text: "opted out", tone: .neutral)
                        }
                    }

                    Text((conversation.lastDirection == "outbound" ? "You: " : "") + conversation.lastBody)
                        .font(.system(size: 13))
                        .foregroundStyle(Brand.inkSoft)
                        .lineLimit(2)
                }

                Spacer()

                Text(shortTime(conversation.lastAt))
                    .font(.system(size: 12))
                    .monospacedDigit()
                    .foregroundStyle(Brand.inkFaint)
            }
        }
    }

    private var initials: String {
        guard let name = conversation.clientName, !name.isEmpty else { return "#" }
        return name.split(separator: " ").prefix(2).map { String($0.prefix(1)).uppercased() }.joined()
    }
}

/// Today shows the clock, anything older shows the date — the same rule the
/// system apps use, because a timestamp that switches format by age is one
/// the eye can sort without reading.
func shortTime(_ date: Date) -> String {
    if Calendar.current.isDateInToday(date) {
        return date.formatted(date: .omitted, time: .shortened)
    }
    return date.formatted(.dateTime.month(.abbreviated).day())
}

// MARK: - Thread

/// One conversation, bubbles and a composer.
struct MessageThreadView: View {
    let phone: String
    var displayName: String?

    @State private var thread: SmsThreadResponse?
    @State private var draft = ""
    @State private var sending = false
    @State private var sendError: String?
    @StateObject private var calls = CallManager.shared

    /// Inbound is push-only into the database with no notification path to
    /// the app, so an open thread polls. Six seconds is fast enough to feel
    /// live in a two-way exchange without hammering a job-site connection.
    private let poll = Timer.publish(every: 6, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: Brand.Space.tight) {
                        ForEach(thread?.messages ?? []) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }
                    }
                    .padding(Brand.Space.base)
                }
                .onChange(of: thread?.messages.count ?? 0) { _, _ in
                    if let last = thread?.messages.last?.id {
                        withAnimation { proxy.scrollTo(last, anchor: .bottom) }
                    }
                }
            }

            if thread?.optedOut == true {
                // No composer at all. This number told us to stop; offering a
                // text box with a post-hoc error would read as "try anyway".
                Text("This number asked us to stop texting. It has to come from them to start again.")
                    .font(.footnote)
                    .foregroundStyle(Brand.inkSoft)
                    .frame(maxWidth: .infinity)
                    .padding(Brand.Space.base)
                    .background(Brand.surfaceRaised)
            } else {
                composer
            }
        }
        .background(Brand.canvas)
        .navigationTitle(displayName ?? CallManager.pretty(CallManager.normalise(phone)))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // The other half of "calls and messages are connected": a call is
            // one tap from any conversation, the way it is in the system app.
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await calls.place(to: phone, label: displayName) }
                } label: {
                    Image(systemName: "phone.fill")
                }
            }
        }
        .task { await load() }
        .onReceive(poll) { _ in Task { await load() } }
        .fullScreenCover(isPresented: .constant(calls.state.isBusy)) { InCallView() }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: Brand.Space.tight) {
            if let sendError {
                Text(sendError)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            HStack(spacing: Brand.Space.small) {
                TextField("Text message", text: $draft, axis: .vertical)
                    .lineLimit(1...5)
                    .font(.system(size: 16))
                    .padding(.horizontal, Brand.Space.base)
                    .padding(.vertical, Brand.Space.small)
                    .background(Brand.surface, in: .rect(cornerRadius: 22))
                    .overlay(
                        RoundedRectangle(cornerRadius: 22)
                            .strokeBorder(Brand.hairline, lineWidth: 0.5))

                Button {
                    Task { await send() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(canSend ? Brand.blue : Brand.inkFaint)
                }
                .disabled(!canSend)
            }

            // 1200 is the server's cap. The count appears only when it starts
            // to matter, because a character counter on a two-word text is
            // noise.
            if draft.count > 900 {
                Text("\(draft.count)/1200")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(draft.count > 1200 ? .red : Brand.inkFaint)
            }
        }
        .padding(Brand.Space.small)
        .background(Brand.canvas)
    }

    private var canSend: Bool {
        !sending && !draft.trimmed.isEmpty && draft.count <= 1200
    }

    private func load() async {
        thread = try? await API.shared.thread(phone: phone)
    }

    private func send() async {
        let text = draft.trimmed
        guard !text.isEmpty else { return }
        sending = true
        sendError = nil
        do {
            let result = try await API.shared.sendSms(phone: phone, body: text)
            if result.sent {
                // Cleared only on success: a failed send keeps the words, the
                // same as the web inbox, because retyping a paragraph on a
                // job site is a real cost.
                draft = ""
            } else {
                sendError = result.message ?? "It did not go through."
            }
            // Refetched either way — opt-outs arrive by webhook seconds
            // before a send, and the thread is the source of truth.
            await load()
        } catch {
            sendError = error.localizedDescription
        }
        sending = false
    }
}

private struct MessageBubble: View {
    let message: SmsMessage

    var body: some View {
        VStack(alignment: message.isOutbound ? .trailing : .leading, spacing: 2) {
            Text(message.body)
                .font(.system(size: 16))
                .foregroundStyle(message.isOutbound ? .white : Brand.ink)
                .padding(.horizontal, Brand.Space.base)
                .padding(.vertical, Brand.Space.small)
                .background(
                    message.isOutbound ? Brand.blue : Brand.surfaceRaised,
                    in: .rect(cornerRadius: 18))

            HStack(spacing: 4) {
                Text(shortTime(message.createdAt))
                if message.status == "failed" {
                    Text("· not delivered").foregroundStyle(.red)
                }
            }
            .font(.system(size: 10))
            .foregroundStyle(Brand.inkFaint)
        }
        .frame(maxWidth: .infinity, alignment: message.isOutbound ? .trailing : .leading)
        .padding(message.isOutbound ? .leading : .trailing, 48)
    }
}
