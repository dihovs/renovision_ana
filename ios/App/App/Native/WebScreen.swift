import Capacitor
import SwiftUI
import UIKit

/// The screens that have not been ported to Swift yet.
///
/// This is the bridge across the rewrite, and it is deliberate. The native app
/// begins with a handful of screens; the business runs on about thirty —
/// clients, estimates, invoices, the price book, the dialer, Ana. Rooting
/// straight to SwiftUI and shipping would take all of those away on the same
/// afternoon they are being used.
///
/// So the shell is native and everything inside it becomes native one screen
/// at a time, with this hosting whatever has not been reached yet. Each port
/// deletes one entry from `WebDestination` and the app is whole at every step.
/// When the last entry goes, so does this file.
///
/// It hosts `MainViewController` rather than a bare `WKWebView` because that
/// subclass is what registers this app's own plugins — camera, speaker,
/// RoomPlan — with the Capacitor bridge. A plain web view would load the same
/// pages with the native capabilities quietly missing.
struct WebScreen: UIViewControllerRepresentable {
    /// Path on the admin site, e.g. "/admin/clients".
    let path: String

    func makeUIViewController(context: Context) -> MainViewController {
        let controller = MainViewController()
        controller.startPath = path
        return controller
    }

    func updateUIViewController(_ controller: MainViewController, context: Context) {
        controller.navigate(to: path)
    }
}

/// The parts of the CRM still served by the web build, in the order they are
/// worth porting: the ones used on site first.
enum WebDestination: String, CaseIterable, Identifiable {
    case clients = "/admin/clients"
    case quotes = "/admin/quotes"
    case invoices = "/admin/invoices"
    case schedule = "/admin/schedule"
    case jobs = "/admin/jobs"
    case priceBook = "/admin/price-book"
    case messages = "/admin/messages"
    case settings = "/admin/settings"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .clients: return "Clients"
        case .quotes: return "Estimates"
        case .invoices: return "Invoices"
        case .schedule: return "Schedule"
        case .jobs: return "Jobs"
        case .priceBook: return "Price book"
        case .messages: return "Messages"
        case .settings: return "Settings"
        }
    }

    var icon: String {
        switch self {
        case .clients: return "person.2"
        case .quotes: return "doc.text"
        case .invoices: return "dollarsign.circle"
        case .schedule: return "calendar"
        case .jobs: return "hammer"
        case .priceBook: return "list.bullet.rectangle"
        case .messages: return "message"
        case .settings: return "gearshape"
        }
    }
}

/// The list of not-yet-native screens. Honest about what it is, because a
/// user who taps "Clients" and gets a web page should know why it feels
/// different from the screen they were just on.
struct MoreView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(WebDestination.allCases) { destination in
                        NavigationLink(value: destination) {
                            Label(destination.title, systemImage: destination.icon)
                        }
                    }
                }

                Section {
                    Text(
                        "These screens are still the web version inside the app. They are being rebuilt in Swift one at a time — Projects and Rooms already have been."
                    )
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("More")
            .navigationDestination(for: WebDestination.self) { destination in
                WebScreen(path: destination.rawValue)
                    .ignoresSafeArea(edges: .bottom)
                    .navigationTitle(destination.title)
                    .navigationBarTitleDisplayMode(.inline)
            }
        }
    }
}
