import Foundation
import WebKit
#if os(macOS)
import AppKit
#else
import UIKit
#endif

/// Owns the WKWebView that shows the book, and the bridge between the page and the app.
///
/// Page to app: the engine (src/engine.js) saves through `window.__store`, which the injected
/// script below routes to the "codex" message handler, and posts `{type: "route"}` whenever the
/// page changes. App to page: navigation sets `location.hash`; state changes call
/// `window.__applyState`.
@MainActor
final class WebController: NSObject {
    let webView: WKWebView

    /// Current saved state as JSON text; read each time the page loads.
    var stateProvider: () -> String = { "{}" }
    var onSave: (String) -> Void = { _ in }
    var onRoute: (_ id: String, _ section: String, _ title: String) -> Void = { _, _, _ in }
    var onLoaded: () -> Void = {}
    var onHistoryChange: (_ canGoBack: Bool, _ canGoForward: Bool) -> Void = { _, _ in }

    private var started = false
    private var observations: [NSKeyValueObservation] = []

    override init() {
        let config = WKWebViewConfiguration()
        if let root = Bundle.main.url(forResource: "dist", withExtension: nil) {
            config.setURLSchemeHandler(BundleSchemeHandler(root: root), forURLScheme: BundleSchemeHandler.scheme)
        }
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        #if os(iOS)
        config.allowsInlineMediaPlayback = true
        #endif
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        config.userContentController.add(WeakMessageHandler(self), name: "codex")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        #if os(iOS)
        // Let the app's background show until the page paints its own (no white flash in dark mode).
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        #endif
        // Back/forward enablement follows the page's history, including in-page (#hash) moves.
        // KVO for WKWebView arrives on the main thread.
        let update: (WKWebView, NSKeyValueObservedChange<Bool>) -> Void = { [weak self] view, _ in
            MainActor.assumeIsolated { self?.onHistoryChange(view.canGoBack, view.canGoForward) }
        }
        observations = [
            webView.observe(\.canGoBack, options: [.new], changeHandler: update),
            webView.observe(\.canGoForward, options: [.new], changeHandler: update),
        ]
        if #available(macOS 13.3, iOS 16.4, *) {
            webView.isInspectable = true
        }
    }

    /// Loads the book once, at `#route`.
    func start(route: String) {
        guard !started else { return }
        started = true
        installBridge()
        var c = URLComponents(url: BundleSchemeHandler.indexURL, resolvingAgainstBaseURL: false)!
        c.fragment = route
        webView.load(URLRequest(url: c.url ?? BundleSchemeHandler.indexURL))
    }

    func navigate(to route: String) {
        // Setting the same hash again fires no event; re-run the engine's router so the
        // page still scrolls back to that section.
        evaluate("""
        (function(h){ if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h; })(\(Self.jsString("#" + route)));
        """)
    }

    func goBack() { if webView.canGoBack { webView.goBack() } }
    func goForward() { if webView.canGoForward { webView.goForward() } }

    func reload() {
        // The bridge script carries the saved state, so refresh it before the page reloads.
        installBridge()
        webView.reload()
    }

    /// Pushes new state into the running page (used for theme changes made in the app).
    func apply(stateJSON: String) {
        evaluate("""
        (function(s){ if (!s.theme) document.documentElement.removeAttribute('data-theme');
          if (window.__applyState) window.__applyState(s); })(JSON.parse(\(Self.jsString(stateJSON))));
        """)
    }

    private func evaluate(_ js: String) {
        webView.evaluateJavaScript(js) { _, error in
            if let error { NSLog("CODEX_LMS: script failed: %@", String(describing: error)) }
        }
    }

    private func installBridge() {
        let ucc = webView.configuration.userContentController
        ucc.removeAllUserScripts()
        let source = """
        window.__app = 1;
        window.__store = {
          load: function () { try { return JSON.parse(\(Self.jsString(stateProvider()))); } catch (e) { return null; } },
          save: function (s) { try { window.webkit.messageHandlers.codex.postMessage({ type: 'save', state: JSON.stringify(s) }); } catch (e) { } }
        };
        """
        ucc.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    /// A JavaScript string literal for any text.
    static func jsString(_ s: String) -> String {
        let data = (try? JSONEncoder().encode(s)) ?? Data("\"\"".utf8)
        return String(decoding: data, as: UTF8.self)
            .replacingOccurrences(of: "\u{2028}", with: "\\u2028")
            .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
    }

    fileprivate func handle(_ body: Any) {
        guard let msg = body as? [String: Any], let type = msg["type"] as? String else { return }
        switch type {
        case "save":
            if let state = msg["state"] as? String { onSave(state) }
        case "route":
            onRoute(msg["id"] as? String ?? "", msg["sec"] as? String ?? "", msg["title"] as? String ?? "")
        default:
            break
        }
    }

    fileprivate static func openExternally(_ url: URL) {
        #if os(macOS)
        NSWorkspace.shared.open(url)
        #else
        UIApplication.shared.open(url)
        #endif
    }
}

extension WebController: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url, let scheme = url.scheme?.lowercased() else { return .allow }
        let mainFrame = action.targetFrame?.isMainFrame ?? true
        // Web links leave the app and open in the browser; the book itself and the playground
        // frames (about:, blob:, data:) stay inside.
        if mainFrame, ["http", "https", "mailto"].contains(scheme) {
            Self.openExternally(url)
            return .cancel
        }
        return .allow
    }

    // target="_blank" and window.open: open web links in the browser instead of a new view.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, ["http", "https", "mailto"].contains(url.scheme?.lowercased() ?? "") {
            Self.openExternally(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        onLoaded()
    }

    // Show the web view even if the load failed, so the reader never sits behind a spinner.
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        NSLog("CODEX_LMS: page failed: %@", String(describing: error))
        onLoaded()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        NSLog("CODEX_LMS: page failed to start: %@", String(describing: error))
        onLoaded()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        reload()
    }
}

/// WKUserContentController keeps its handlers alive; this breaks the retain cycle.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WebController?

    init(_ target: WebController) {
        self.target = target
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let body = message.body
        MainActor.assumeIsolated { target?.handle(body) }
    }
}
