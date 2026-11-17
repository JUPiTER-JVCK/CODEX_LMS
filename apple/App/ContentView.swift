import SwiftUI
import CodexCore
#if os(macOS)
import AppKit
#endif

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
                .opacity(store.pageReady ? 1 : 0)
                .overlay {
                    if !store.pageReady { ProgressView().controlSize(.large) }
                }
                .animation(.easeOut(duration: 0.2), value: store.pageReady)
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(store.currentTitle)
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar { ReaderToolbar(store: store) }
        }
        .searchable(text: $query, placement: .sidebar, prompt: "Search commands and topics")
        #if os(macOS)
        // preferredColorScheme(nil) does not hand a Mac window back to the system appearance,
        // so "System" would stay stuck on the last forced mode. Set the app's appearance instead.
        .onChange(of: store.appearance, initial: true) { _, mode in
            NSApp.appearance = switch mode {
            case .system: nil
            case .light: NSAppearance(named: .aqua)
            case .dark: NSAppearance(named: .darkAqua)
            }
        }
        .frame(minWidth: 760, minHeight: 480)
        #else
        .preferredColorScheme(store.colorScheme)
        #endif
        .task { store.start() }
    }
}

/// Parts and chapters with progress, or search results while there is a query.
private struct Sidebar: View {
    @Environment(BookStore.self) private var store
    let query: String

    var body: some View {
        let selection = Binding<String?>(
            get: { store.selectedRow },
            set: { if let r = $0 { store.open(r) } }
        )
        let searching = !query.trimmingCharacters(in: .whitespaces).isEmpty
        let hits = searching ? store.search.search(query) : []
        List(selection: selection) {
            if searching {
                results(hits)
            } else {
                contents
            }
        }
        #if os(macOS)
        .listStyle(.sidebar)
        #endif
        .overlay {
            if searching && hits.isEmpty {
                ContentUnavailableView.search(text: query)
            }
        }
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
                        // The open chapter shows its sections underneath it.
                        if c.id == store.currentPage {
                            ForEach(c.sections) { s in
                                SectionRow(section: s).tag("\(c.id)/\(s.id)")
                            }
                        }
                    }
                    ForEach(pages) { p in
                        Label(p.title, systemImage: icon(for: p.id)).tag(p.id)
                    }
                }
            }
        }
    }

    @ViewBuilder private func results(_ hits: [SearchHit]) -> some View {
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
    @ScaledMetric(relativeTo: .caption) private var numberWidth: CGFloat = RowMetrics.number

    var body: some View {
        HStack(spacing: RowMetrics.gap) {
            Text(chapter.numberLabel)
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: numberWidth, alignment: .trailing)
            Text(chapter.plainTitle)
                .lineLimit(2)
            Spacer(minLength: 4)
            ProgressMark(progress: progress)
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(progress.total == 0 ? "" : "\(progress.done) of \(progress.total) done")
    }
}

/// Chapter rows put the number in a fixed column; section rows indent to the title after it.
private enum RowMetrics {
    static let number: CGFloat = 22
    static let gap: CGFloat = 10
}

/// A section of the open chapter, indented under the chapter's title.
private struct SectionRow: View {
    let section: ChapterSection
    // Scales with the same text style as the chapter number, so the indent stays aligned.
    @ScaledMetric(relativeTo: .caption) private var numberWidth: CGFloat = RowMetrics.number

    var body: some View {
        Text(section.plainText)
            .font(.callout)
            .foregroundStyle(.secondary)
            .lineLimit(2)
            .padding(.leading, numberWidth + RowMetrics.gap)
    }
}

/// A check mark when a chapter is finished, a small ring while it is in progress.
private struct ProgressMark: View {
    let progress: ItemProgress

    /// Ring and check share one footprint so titles and marks line up down the list.
    @ScaledMetric(relativeTo: .body) private var size: CGFloat = 15

    var body: some View {
        if progress.isComplete {
            Image(systemName: "checkmark.circle.fill")
                .resizable()
                .scaledToFit()
                .foregroundStyle(.green)
                .frame(width: size, height: size)
        } else if progress.done > 0 {
            ZStack {
                Circle().stroke(.secondary.opacity(0.3), lineWidth: 2)
                Circle().trim(from: 0, to: progress.fraction)
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            .padding(1)
            .frame(width: size, height: size)
        }
    }
}

/// Back/forward, the current chapter's sections, and appearance.
private struct ReaderToolbar: ToolbarContent {
    let store: BookStore

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .navigation) {
            Button { store.web.goBack() } label: { Label("Back", systemImage: "chevron.backward") }
                .disabled(!store.canGoBack)
                .help("Back")
            Button { store.web.goForward() } label: { Label("Forward", systemImage: "chevron.forward") }
                .disabled(!store.canGoForward)
                .help("Forward")
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
                .help("Jump to a section")
            }
            Menu {
                Picker("Appearance", selection: Binding(get: { store.appearance }, set: { store.appearance = $0 })) {
                    ForEach(BookStore.Appearance.allCases) { Text($0.label).tag($0) }
                }
                SwiftUI.Section("Text Size (\(Int((store.textZoom * 100).rounded()))%)") {
                    Button { store.zoomIn() } label: { Label("Larger", systemImage: "textformat.size.larger") }
                        .disabled(!store.canZoomIn)
                    Button { store.zoomOut() } label: { Label("Smaller", systemImage: "textformat.size.smaller") }
                        .disabled(!store.canZoomOut)
                    Button("Actual Size") { store.resetZoom() }
                        .disabled(store.textZoom == 1)
                }
            } label: {
                Label("Appearance", systemImage: "textformat.size")
            }
            .help("Appearance and text size")
        }
    }
}
