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
                // **`bare=1`, the same view the PDF route renders.** Without
                // it this webview showed the whole CRM around the document —
                // the Projects nav, a Sign out link, a second `Download PDF`
                // button and two option checkboxes — inside a screen whose
                // own button says `Make the PDF`. Two buttons that do nearly
                // the same thing is how he pressed the wrong one last time.
                path: "/admin/projects/\(projectId)/report?bare=1",
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
                    .buttonStyle(PrimaryButtonStyle(enabled: !rendering))
                    .disabled(rendering)
                }
            }
            .padding(Brand.Space.base)
            .background(.thinMaterial)
        }
        .navigationTitle("Report")
        .navigationBarTitleDisplayMode(.inline)
    }

    /// **The PDF comes from the server, not from this webview.**
    ///
    /// `WKWebView.pdf(configuration:)` lays the document out at the WEB
    /// VIEW's width and hands back pages that size — so a phone produced a
    /// 390-point-wide PDF of a document designed for US Letter. It looked
    /// right on the phone that made it and wrong in every inbox it reached.
    ///
    /// `/report/pdf` drives a real browser at Letter and is already the one
    /// the web uses. Asking for that file means the report a phone sends and
    /// the report a desk sends are the same bytes — which was the whole point
    /// of having one renderer. The webview above is now purely a preview.
    @MainActor
    private func render() async {
        rendering = true
        error = nil
        defer { rendering = false }
        guard let url = URL(
            string: "/admin/projects/\(projectId)/report/pdf", relativeTo: API.baseURL)
        else {
            error = "Could not build the report address."
            return
        }
        do {
            var request = URLRequest(url: url)
            // 120s server-side: a property with a dozen rooms and their
            // photographs is a genuinely large page to lay out.
            request.timeoutInterval = 180
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard status == 200 else {
                error = status == 401
                    ? "This phone is signed out. Sign in again and try once more."
                    : "The server could not build the PDF (\(status))."
                return
            }
            // A sign-in page is HTML with a 200 on it. Check the bytes are a
            // PDF rather than trusting the status — handing somebody a
            // "report" that is a login form is worse than an error.
            guard data.count > 4, data.prefix(4) == Data("%PDF".utf8) else {
                error = "The server sent something that is not a PDF."
                return
            }
            pdf = data
        } catch {
            self.error = "Could not fetch the PDF: \(error.localizedDescription)"
        }
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

        // **A Letter page laid out at Letter, then scaled to fit the glass.**
        // The report's sheet is 17.6cm — about 665 CSS pixels — and a phone
        // viewport is nearer 390, so at `width=device-width` the document
        // ran off the right edge and the fourth cover figure was cut in
        // half. Widening the LAYOUT viewport lets WebKit shrink the whole
        // sheet the way Safari does with any desktop page, so what is on
        // screen is the page as it will print.
        let fit = WKUserScript(
            source: """
                var tag = document.querySelector('meta[name=viewport]')
                    || document.head.appendChild(document.createElement('meta'));
                tag.name = 'viewport';
                tag.content = 'width=700, initial-scale=' + (window.innerWidth / 700);
                """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true)
        config.userContentController.addUserScript(fit)
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
