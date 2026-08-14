import SwiftUI
import UIKit
import WebKit

/// The report, from the phone, into an adjuster's inbox.
///
/// The document itself is the web report — deliberately, because it is the
/// deliverable and there must be exactly one of it. What was missing was the
/// path from a phone to a PDF: WKWebView has no window.print, so the web
/// page's own print button is dead inside an app. This renders the same page
/// and turns it into a real PDF with the WebKit API instead, which then goes
/// wherever iOS can send anything — Mail, AirDrop, Files, WhatsApp.
struct ReportShareView: View {
    let projectId: String
    let projectName: String

    @State private var pdf: Data?
    @State private var rendering = false
    @State private var error: String?
    @State private var webView: WKWebView?
    @State private var pageLoaded = false

    var body: some View {
        ZStack(alignment: .bottom) {
            ReportWebView(
                path: "/admin/projects/\(projectId)/report",
                onReady: { view in
                    webView = view
                    pageLoaded = true
                },
                onError: { error = $0 })
            .ignoresSafeArea(edges: .bottom)

            VStack(spacing: Brand.Space.tight) {
                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(.horizontal, Brand.Space.base)
                }

                if let pdf {
                    ShareLink(
                        item: PDFFile(data: pdf, name: "\(projectName) — report.pdf"),
                        preview: SharePreview("\(projectName) — report")
                    ) {
                        Label("Send the PDF", systemImage: "square.and.arrow.up")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .background(Brand.green, in: .rect(cornerRadius: Brand.Radius.card))
                    }
                } else {
                    Button {
                        Task { await render() }
                    } label: {
                        HStack(spacing: Brand.Space.tight) {
                            if rendering { ProgressView().tint(.white) }
                            Text(rendering ? "Making the PDF…" : "Make the PDF")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle(enabled: pageLoaded && !rendering))
                    .disabled(!pageLoaded || rendering)
                }
            }
            .padding(Brand.Space.base)
            .background(.thinMaterial)
        }
        .navigationTitle("Report")
        .navigationBarTitleDisplayMode(.inline)
    }

    @MainActor
    private func render() async {
        guard let webView else { return }
        rendering = true
        error = nil
        do {
            // The whole document, not the viewport: the report is many pages
            // and a screenshot of the visible third would be a screenshot,
            // not a report.
            let config = WKPDFConfiguration()
            pdf = try await webView.pdf(configuration: config)
        } catch {
            self.error = "Could not make the PDF: \(error.localizedDescription)"
        }
        rendering = false
    }
}

/// A named PDF for the share sheet — the filename is what the adjuster sees
/// in their inbox, and "attachment-1.pdf" reads as carelessness.
struct PDFFile: Transferable {
    let data: Data
    let name: String

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .pdf) { file in
            file.data
        }
        .suggestedFileName { file in file.name }
    }
}

/// The report page, in a plain WKWebView that shares the app's cookie store —
/// the admin session lives there, and a webview with its own store would land
/// on the sign-in screen instead of the report.
private struct ReportWebView: UIViewRepresentable {
    let path: String
    let onReady: (WKWebView) -> Void
    let onError: (String) -> Void

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator

        // The session cookie is in the shared HTTP store; hand it to WebKit
        // explicitly rather than hoping the stores converge in time.
        let cookies = HTTPCookieStorage.shared.cookies(for: API.baseURL) ?? []
        let group = DispatchGroup()
        for cookie in cookies {
            group.enter()
            view.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) { group.leave() }
        }
        group.notify(queue: .main) {
            if let url = URL(string: path, relativeTo: API.baseURL) {
                view.load(URLRequest(url: url))
            }
        }
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onReady: onReady, onError: onError)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let onReady: (WKWebView) -> Void
        let onError: (String) -> Void

        init(onReady: @escaping (WKWebView) -> Void, onError: @escaping (String) -> Void) {
            self.onReady = onReady
            self.onError = onError
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            onReady(webView)
        }

        func webView(
            _ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error
        ) {
            onError(error.localizedDescription)
        }
    }
}
