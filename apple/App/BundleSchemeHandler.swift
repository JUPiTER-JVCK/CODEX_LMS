import Foundation
import WebKit

/// Serves the bundled book (`dist/` copied into the app) at `codex://book/...`.
///
/// The page can't be loaded from `file://`: the in-page Python starts a Web Worker and fetches
/// WebAssembly, and WebKit blocks both for file URLs. A custom scheme gives the page a real
/// origin, so the worker, `fetch` and `WebAssembly.instantiateStreaming` work offline.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "codex"
    static let indexURL = URL(string: "codex://book/index.html")!

    private let root: URL

    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else {
            task.didFailWithError(URLError(.badURL))
            return
        }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        // Only files inside the bundled book; no "../" escapes.
        guard file.path.hasPrefix(root.path + "/"),
              let data = try? Data(contentsOf: file, options: .mappedIfSafe) else {
            respond(task, url: url, status: 404, type: "text/plain; charset=utf-8", data: Data("Not found".utf8))
            return
        }
        respond(task, url: url, status: 200, type: Self.mimeType(for: file.pathExtension), data: data)
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        // Responses are sent synchronously in start, so there is nothing to cancel.
    }

    private func respond(_ task: WKURLSchemeTask, url: URL, status: Int, type: String, data: Data) {
        let headers = [
            "Content-Type": type,
            "Content-Length": String(data.count),
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
        ]
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else {
            task.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    static func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "wasm": return "application/wasm"
        case "txt", "py": return "text/plain; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        default: return "application/octet-stream"
        }
    }
}
