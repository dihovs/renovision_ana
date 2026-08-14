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
                ProgressView().controlSize(.large)
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
    }
}

struct MainTabs: View {
    let onSignedOut: () -> Void

    var body: some View {
        TabView {
            ProjectsView(onSignedOut: onSignedOut)
                .tabItem { Label("Projects", systemImage: "folder") }

            ScanEntryView()
                .tabItem { Label("Scan", systemImage: "camera.viewfinder") }

            MoreView()
                .tabItem { Label("More", systemImage: "square.grid.2x2") }

            DiagnosticsView()
                .tabItem { Label("Status", systemImage: "waveform.path.ecg") }
        }
        .tint(.brandBlue)
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
        VStack(spacing: 18) {
            Spacer()

            VStack(spacing: 6) {
                Image(systemName: "house.lodge")
                    .font(.system(size: 40, weight: .semibold))
                    .foregroundStyle(Color.brandBlue)
                Text("Renovision AnA")
                    .font(.title2.bold())
                Text("Sign in to the admin")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 10) {
                SecureField("Admin password", text: $password)
                    .textContentType(.password)
                    .submitLabel(.go)
                    .focused($focused)
                    .padding(14)
                    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 14))
                    .onSubmit { Task { await signIn() } }

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task { await signIn() }
                } label: {
                    HStack {
                        if busy { ProgressView().tint(.white) }
                        Text(busy ? "Signing in…" : "Sign in").bold()
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                }
                .background(Color.brandBlue, in: .rect(cornerRadius: 14))
                .foregroundStyle(.white)
                .disabled(busy || password.isEmpty)
                .opacity(busy || password.isEmpty ? 0.5 : 1)
            }
            .padding(.horizontal, 24)

            Spacer()
            Spacer()
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

extension Color {
    /// Matched to the web app's --brand-blue, so the two halves of the app do
    /// not look like two products during the changeover.
    static let brandBlue = Color(red: 0.12, green: 0.44, blue: 0.82)
}

/// One way of showing "loading / empty / failed", because three screens each
/// inventing their own is how an app starts to feel unfinished.
struct LoadState<T>: View where T: Sendable {
    let value: T?
    let error: String?
    let empty: String
    let isEmpty: (T) -> Bool
    let content: (T) -> AnyView

    var body: some View {
        if let error {
            ContentUnavailableView {
                Label("Could not load", systemImage: "exclamationmark.triangle")
            } description: {
                Text(error)
            }
        } else if let value {
            if isEmpty(value) {
                ContentUnavailableView("Nothing here yet", systemImage: "tray", description: Text(empty))
            } else {
                content(value)
            }
        } else {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
