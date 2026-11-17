import SwiftUI
import CodexCore

struct ContentView: View {
    @Environment(BookStore.self) private var store
    @State private var query = ""

    var body: some View {
        NavigationSplitView {
            Sidebar(query: query)
                .navigationTitle("CODEX_LMS")
                #if os(macOS)
                .navigationSplitViewColumnWidth(min: 240, ideal: 290, max: 380)
                #endif
        } detail: {
            BookWebView(controller: store.web)
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(store.currentTitle)
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar { ReaderToolbar(store: store) }
        }
        .searchable(text: $query, placement: .sidebar, prompt: "Search commands and topics")
        .preferredColorScheme(store.colorScheme)
        .task { store.start() }
    }
}

/// Parts and chapters with progress, or search results while there is a query.
private struct Sidebar: View {
    @Environment(BookStore.self) private var store
    let query: String

    var body: some View {
        let selection = Binding<String?>(
            get: { store.currentPage },
            set: { if let r = $0 { store.open(r) } }
        )
        List(selection: selection) {
            if query.trimmingCharacters(in: .whitespaces).isEmpty {
                contents
            } else {
                results
            }
        }
        #if os(macOS)
        .listStyle(.sidebar)
        #endif
    }

    @ViewBuilder private var contents: some View {
        let total = store.overallProgress
        SwiftUI.Section {
            VStack(alignment: .leading, spacing: 6) {
                ProgressView(value: total.fraction)
                Text("\(total.done) of \(total.total) practice items done")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)
            .selectionDisabled()
        }
        ForEach(store.toc.parts) { part in
            let chapters = store.toc.chapters(in: part)
            let pages = part.id == "ref" ? store.toc.special : []
            if !chapters.isEmpty || !pages.isEmpty {
                SwiftUI.Section(part.title) {
                    ForEach(chapters) { c in
                        ChapterRow(chapter: c, progress: store.progress(for: c)).tag(c.id)
                    }
                    ForEach(pages) { p in
                        Label(p.title, systemImage: icon(for: p.id)).tag(p.id)
                    }
                }
            }
        }
    }

    @ViewBuilder private var results: some View {
        let hits = store.search.search(query)
        if hits.isEmpty {
            Text("No matches").foregroundStyle(.secondary).selectionDisabled()
        }
        ForEach(hits) { hit in
            VStack(alignment: .leading, spacing: 2) {
                Label {
                    Text(hit.title).font(hit.kind == .command ? .body.monospaced() : .body)
                } icon: {
                    Image(systemName: icon(for: hit.kind))
                }
                Text(hit.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .tag(hit.route)
        }
    }

    private func icon(for kind: SearchHit.Kind) -> String {
        switch kind {
        case .chapter: return "book"
        case .page: return "square.grid.2x2"
        case .section: return "number"
        case .command: return "terminal"
        }
    }

    private func icon(for page: String) -> String {
        switch page {
        case "atlas": return "terminal"
        case "practice": return "checklist"
        case "glossary": return "character.book.closed"
        case "values": return "slider.horizontal.3"
        default: return "doc"
        }
    }
}

private struct ChapterRow: View {
    let chapter: Chapter
    let progress: ItemProgress

    var body: some View {
        HStack(spacing: 10) {
            Text(chapter.numberLabel)
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: 22, alignment: .trailing)
            Text(chapter.plainTitle)
                .lineLimit(2)
            Spacer(minLength: 4)
            ProgressMark(progress: progress)
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(progress.total == 0 ? "" : "\(progress.done) of \(progress.total) done")
    }
}

/// A check mark when a chapter is finished, a small ring while it is in progress.
private struct ProgressMark: View {
    let progress: ItemProgress

    var body: some View {
        if progress.isComplete {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
        } else if progress.done > 0 {
            ZStack {
                Circle().stroke(.secondary.opacity(0.3), lineWidth: 2.5)
                Circle().trim(from: 0, to: progress.fraction)
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            .frame(width: 14, height: 14)
        }
    }
}

/// Back/forward, the current chapter's sections, and appearance.
private struct ReaderToolbar: ToolbarContent {
    let store: BookStore

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .navigation) {
            Button { store.web.goBack() } label: { Label("Back", systemImage: "chevron.backward") }
            Button { store.web.goForward() } label: { Label("Forward", systemImage: "chevron.forward") }
        }
        ToolbarItemGroup(placement: .primaryAction) {
            if let chapter = store.currentChapter, !chapter.sections.isEmpty {
                Menu {
                    Button("Top of Chapter") { store.open(chapter.id) }
                    Divider()
                    ForEach(chapter.sections) { s in
                        Button(s.plainText) { store.open("\(chapter.id)/\(s.id)") }
                    }
                } label: {
                    Label("Sections", systemImage: "list.bullet")
                }
            }
            Menu {
                Picker("Appearance", selection: Binding(get: { store.appearance }, set: { store.appearance = $0 })) {
                    ForEach(BookStore.Appearance.allCases) { Text($0.label).tag($0) }
                }
            } label: {
                Label("Appearance", systemImage: "circle.lefthalf.filled")
            }
        }
    }
}
