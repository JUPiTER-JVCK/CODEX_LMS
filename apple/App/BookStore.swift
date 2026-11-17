import Foundation
import Observation
import SwiftUI
import CodexCore

/// App state: the table of contents, the reader's saved progress and the page being shown.
@MainActor
@Observable
final class BookStore {
    let toc: TOC
    @ObservationIgnored let search: BookSearch
    @ObservationIgnored let web = WebController()

    private(set) var state: BookState
    /// Chapter or special page id that is showing.
    private(set) var currentPage: String
    private(set) var currentSection: String = ""
    private(set) var currentTitle: String = "CODEX_LMS"

    @ObservationIgnored private var rawState: String
    @ObservationIgnored private let stateURL: URL

    init() {
        guard let url = Bundle.main.url(forResource: "toc", withExtension: "json", subdirectory: "dist"),
              let toc = try? TOC.load(from: url) else {
            preconditionFailure("dist/toc.json is missing from the app bundle; run python3 tools/build.py")
        }
        self.toc = toc
        search = BookSearch(toc: toc)

        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("CODEX_LMS", isDirectory: true)
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        stateURL = support.appendingPathComponent("state.json")
        let data = (try? Data(contentsOf: stateURL)) ?? Data("{}".utf8)
        rawState = String(decoding: data, as: UTF8.self)
        state = BookState.decode(data)
        currentPage = state.last.isEmpty ? (toc.chapters.first?.id ?? "welcome") : state.last
        currentTitle = toc.title(of: currentPage) ?? "CODEX_LMS"

        web.stateProvider = { [unowned self] in self.rawState }
        web.onSave = { [unowned self] json in self.save(json) }
        web.onRoute = { [unowned self] id, sec, title in self.didRoute(id: id, section: sec, title: title) }
    }

    func start() {
        web.start(route: currentPage)
    }

    // MARK: navigation

    /// Shows a chapter, special page or `chapter/anchor`.
    func open(_ route: String) {
        let id = String(route.split(separator: "/", maxSplits: 1).first ?? "")
        guard !id.isEmpty else { return }
        if route == currentPage && currentSection.isEmpty { return }
        currentPage = id
        web.navigate(to: route)
    }

    var currentChapter: Chapter? { toc.chapter(id: currentPage) }

    var continueRoute: String? { state.last.isEmpty ? nil : state.last }

    private func didRoute(id: String, section: String, title: String) {
        currentPage = id
        currentSection = section
        currentTitle = toc.title(of: id) ?? Inline.plain(title)
    }

    // MARK: state

    private func save(_ json: String) {
        rawState = json
        let data = Data(json.utf8)
        state = BookState.decode(data)
        do {
            try data.write(to: stateURL, options: .atomic)
        } catch {
            NSLog("CODEX_LMS: could not save progress: %@", String(describing: error))
        }
    }

    func progress(for chapter: Chapter) -> ItemProgress { state.progress(for: chapter) }

    var overallProgress: ItemProgress { state.progress(for: toc) }

    // MARK: appearance

    enum Appearance: String, CaseIterable, Identifiable {
        case system = "", light, dark
        var id: String { rawValue }
        var label: String {
            switch self {
            case .system: return "System"
            case .light: return "Light"
            case .dark: return "Dark"
            }
        }
    }

    var appearance: Appearance {
        get { Appearance(rawValue: state.theme) ?? .system }
        set {
            var s = state
            s.theme = newValue.rawValue
            let json = String(decoding: s.encoded(), as: UTF8.self)
            save(json)
            web.apply(stateJSON: json)
        }
    }

    var colorScheme: ColorScheme? {
        switch appearance {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}
