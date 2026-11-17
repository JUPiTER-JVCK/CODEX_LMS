import SwiftUI
import WebKit

/// Puts the controller's WKWebView into SwiftUI. The web view is created once and reused, so
/// the page (and any running Python) survives SwiftUI redraws.
#if os(macOS)
struct BookWebView: NSViewRepresentable {
    let controller: WebController

    func makeNSView(context: Context) -> WKWebView { controller.webView }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
#else
struct BookWebView: UIViewRepresentable {
    let controller: WebController

    func makeUIView(context: Context) -> WKWebView { controller.webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
#endif
