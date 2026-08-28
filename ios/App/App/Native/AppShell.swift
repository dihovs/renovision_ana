import SwiftUI

/// The native app's root.
///
/// Three states, and the distinction between them is the whole point: signed
/// out, signed in, or connected-but-broken. That last one has cost real time —
/// "no database connected" was reported by the web CRM without saying whether
/// the credentials were missing on this deployment, wrong, or the tables
/// simply were not created yet. The native app asks `/api/v1/health` at launch
/// and says which it is.
struct AppShell: View {
    /// The whole app is a light document, like the reference.
    ///
    /// A floor plan is ink on paper, and the screens around it stopped
    /// matching it: paper-white drawings sat inside dark chrome, and the two
    /// read as different apps. Every Brand colour is already declared as
    /// Color(light:dark:), so pinning the appearance here switches all of
    /// them at once — there is no screen that can be half-converted, which is
    /// exactly the failure the per-screen pins were starting to create.
    ///
    /// Those per-screen pins on the editor, sketch pad and projects list are
    /// now redundant. They are harmless and left in place: each states why
    /// ITS surface must be light regardless of what the app around it does,
    /// which stays true if this ever becomes a preference.
    private let appearance: ColorScheme = .light

    @State private var phase: Phase = .checking

    enum Phase {
        case checking
        case signedOut
        case ready
    }

    var body: some View {
        Group {
            switch phase {
            case .checking:
                ZStack {
                    Brand.canvas.ignoresSafeArea()
                    ProgressView().controlSize(.large)
                }
            case .signedOut:
                SignInView { phase = .ready }
            case .ready:
                MainTabs(onSignedOut: { phase = .signedOut })
            }
        }
        .task {
            // A cookie survives app launches, so most starts skip the password
            // screen entirely — the same behaviour the WebView had.
            phase = await API.shared.isSignedIn() ? .ready : .signedOut
        }
        .preferredColorScheme(appearance)
        .environment(\.colorScheme, appearance)
    }
}

struct MainTabs: View {
    let onSignedOut: () -> Void

    @StateObject private var deepLink = DeepLink.shared

    var body: some View {
        // Five tabs, which is iOS's limit before it collapses them into a
        // "More" list of its own. Everything not here is reachable from the
        // menu on Projects — a tab is for what gets used daily, and the
        // connection diagnostic is not that.
        TabView {
            HomeView(onSignedOut: onSignedOut)
                .tabItem { Label("Home", systemImage: "house.fill") }

            ProjectsView(onSignedOut: onSignedOut)
                .tabItem { Label("Projects", systemImage: "folder.fill") }

            CustomersView()
                .tabItem { Label("Customers", systemImage: "person.2.fill") }

            EstimatesView()
                .tabItem { Label("Estimates", systemImage: "doc.text.fill") }

            // The Scan tab is gone deliberately, and so is the floating Scan
            // button that used to sit on a project. Scanning is a step inside
            // a job, not a destination beside it — the reference starts a
            // floor plan from the + in a project's Floor Plans rail, and so
            // does this now. `ScanEntryView` still exists, for a measurement
            // taken before anybody has made the job — it moved to More on
            // 21 Aug when Home's third tile became Leads.
        }
        .tint(Brand.blue)
        // Presented OVER the tabs rather than navigated to inside one.
        //
        // Messages is not a tab — it is reached from More, and from a tile on
        // Home — so "go to the thread" would otherwise mean selecting a tab,
        // pushing a list, and then pushing the thread, three animations deep
        // into a stack he then has to climb back out of. A notification is a
        // pointer to one thing; it presents that thing, and closing it puts
        // him back exactly where he was.
        .sheet(item: $deepLink.pending) { destination in
            NavigationStack {
                switch destination {
                case .messageThread(let phone):
                    // No display name: the notification's title carries it,
                    // and the thread looks the client up itself.
                    // MessageThreadView is normally PUSHED, so it relies on a
                    // back button it does not have when it is the root of a
                    // sheet. Without this the thread is a room with no door.
                    MessageThreadView(phone: phone, displayName: nil)
                        .dismissableWhenPresented()
                case .leads:
                    LeadsView()
                }
            }
            .tint(Brand.blue)
        }
    }
}

// MARK: - Sign in

struct SignInView: View {
    let onSignedIn: () -> Void

    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            Brand.canvas.ignoresSafeArea()

            VStack(spacing: Brand.Space.large) {
            Spacer()

            VStack(spacing: Brand.Space.small) {
                ZStack {
                    RoundedRectangle(cornerRadius: 20)
                        .fill(Brand.blue)
                        .frame(width: 76, height: 76)
                    Image(systemName: "drop.fill")
                        .font(.system(size: 32, weight: .semibold))
                        .foregroundStyle(.white)
                }
                Text("Renovision AnA")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Brand.ink)
                Text("Water damage · restoration · Laval")
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.inkSoft)
            }

            VStack(spacing: 10) {
                SecureField("Admin password", text: $password)
                    .textContentType(.password)
                    .submitLabel(.go)
                    .focused($focused)
                    .padding(Brand.Space.base)
                    .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
                    .overlay(
                        RoundedRectangle(cornerRadius: Brand.Radius.card)
                            .strokeBorder(Brand.hairline, lineWidth: 0.5)
                    )
                    .onSubmit { Task { await signIn() } }

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 2)
                }

                Button {
                    Task { await signIn() }
                } label: {
                    HStack(spacing: Brand.Space.tight) {
                        if busy { ProgressView().tint(.white) }
                        Text(busy ? "Signing in…" : "Sign in")
                    }
                }
                .buttonStyle(PrimaryButtonStyle(enabled: !busy && !password.isEmpty))
                .disabled(busy || password.isEmpty)
            }
            .padding(.horizontal, 24)

            Spacer()
            Spacer()
            }
        }
        .onAppear { focused = true }
    }

    private func signIn() async {
        guard !password.isEmpty else { return }
        busy = true
        error = nil
        do {
            try await API.shared.signIn(password: password)
            // Not kept: the cookie is the credential from here on, and holding
            // the password in memory buys nothing.
            password = ""
            onSignedIn()
        } catch {
            self.error = error.localizedDescription
        }
        busy = false
    }
}

// MARK: - Shared style

// Brand colours live in Theme.swift, read from globals.css. This file used
// to declare its own `brandBlue` of #1f70d1 with a comment claiming it matched
// the web app — it did not, and two blues one shade apart is worse than one
// wrong blue, because nobody can tell which screen is the broken one.
