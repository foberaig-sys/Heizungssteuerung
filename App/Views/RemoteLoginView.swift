import SwiftUI
import WebKit

/// Zeigt das Secomea-Portal (remote.keba.com/app). Sobald der Nutzer "WebHmi" → "WWW" öffnet,
/// landet der Browser auf `https://remote.keba.com:<Port>`. Diese Adresse und die Sitzungs-Cookies
/// übernehmen wir und sprechen ab dann direkt mit der JSON-Schnittstelle der HMI.
struct RemoteLoginView: View {
    var onConnected: (URL, [HTTPCookie]) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            RemoteWebView(startURL: URL(string: "https://remote.keba.com/app")!) { url, cookies in
                onConnected(url, cookies)
                dismiss()
            }
            .ignoresSafeArea(edges: .bottom)
            .safeAreaInset(edge: .top) {
                Label("Anmelden, Anlage aufklappen, „WebHmi“ und dann „WWW“ antippen.",
                      systemImage: "info.circle")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    .background(.bar)
            }
            .navigationTitle("KEBA Fernzugriff")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
        }
    }
}

struct RemoteWebView: UIViewRepresentable {
    let startURL: URL
    let onHMIReached: (URL, [HTTPCookie]) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onHMIReached: onHMIReached)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        // Persistenter Speicher: Secomea-Login bleibt erhalten, iOS kann das Passwort automatisch ausfüllen.
        configuration.websiteDataStore = .default()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.load(URLRequest(url: startURL))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let onHMIReached: (URL, [HTTPCookie]) -> Void
        private var captured = false

        init(onHMIReached: @escaping (URL, [HTTPCookie]) -> Void) {
            self.onHMIReached = onHMIReached
        }

        /// "WWW" öffnet die HMI in einem neuen Fenster; wir laden sie stattdessen im selben WebView.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
                webView.load(URLRequest(url: url))
            }
            return nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard !captured, let url = webView.url, let base = Self.hmiBaseURL(from: url) else { return }
            captured = true
            webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
                let relevant = cookies.filter { $0.domain.hasSuffix("keba.com") }
                DispatchQueue.main.async {
                    self.onHMIReached(base, relevant)
                }
            }
        }

        /// `https://remote.keba.com:58841/...` → `https://remote.keba.com:58841`
        static func hmiBaseURL(from url: URL) -> URL? {
            guard url.scheme == "https", let host = url.host, host.hasSuffix("keba.com"),
                  let port = url.port, port != 443 else {
                return nil
            }
            var components = URLComponents()
            components.scheme = "https"
            components.host = host
            components.port = port
            return components.url
        }
    }
}
