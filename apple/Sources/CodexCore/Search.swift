import Foundation

public struct SearchHit: Hashable, Identifiable, Sendable {
    public enum Kind: String, Hashable, Sendable {
        case chapter, page, section, command
    }

    public var id: Int
    public var kind: Kind
    public var chapterID: String
    /// Section or card anchor inside the chapter, or nil for the chapter itself.
    public var anchor: String?
    public var title: String
    /// Chapter title for sections and commands, the subtitle for chapters and pages.
    public var detail: String
    public var score: Int

    /// The hash the web engine routes on: `chapter` or `chapter/anchor`.
    public var route: String { anchor.map { "\(chapterID)/\($0)" } ?? chapterID }
}

/// Search over chapter titles, section headings and command cards, ranked so that exact
/// command names and title matches come first.
public struct BookSearch: Sendable {
    private struct Entry: Sendable {
        var hit: SearchHit
        var key: String
        var all: String
    }

    private let entries: [Entry]

    public init(toc: TOC) {
        var list: [Entry] = []
        func add(_ kind: SearchHit.Kind, _ chapter: String, _ anchor: String?, _ title: String, _ detail: String, _ extra: String = "") {
            let hit = SearchHit(id: list.count, kind: kind, chapterID: chapter, anchor: anchor, title: title, detail: detail, score: 0)
            list.append(Entry(hit: hit, key: BookSearch.norm(title), all: BookSearch.norm(title + " " + detail + " " + extra)))
        }
        for c in toc.chapters {
            add(.chapter, c.id, nil, c.plainTitle, Inline.plain(c.sub))
            for s in c.sections {
                add(.section, c.id, s.id, s.plainText, c.plainTitle)
            }
            for k in c.cards {
                add(.command, c.id, k.id, k.name, c.plainTitle, Inline.plain(k.sum))
            }
        }
        for p in toc.special {
            add(.page, p.id, nil, p.title, p.sub)
        }
        entries = list
    }

    public func search(_ query: String, limit: Int = 60) -> [SearchHit] {
        let q = BookSearch.norm(query).trimmingCharacters(in: .whitespacesAndNewlines)
        let tokens = q.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard !tokens.isEmpty else { return [] }
        var hits: [SearchHit] = []
        for e in entries where tokens.allSatisfy({ e.all.contains($0) }) {
            var s: Int
            if e.key == q { s = 100 } else if e.key.hasPrefix(q) { s = 60 } else if e.key.contains(q) { s = 40 } else { s = 0 }
            s += tokens.filter { e.key.contains($0) }.count * 10
            switch e.hit.kind {
            case .command: s += 6
            case .chapter, .page: s += 4
            case .section: s += 2
            }
            var h = e.hit
            h.score = s
            hits.append(h)
        }
        hits.sort { a, b in
            if a.score != b.score { return a.score > b.score }
            if a.title.count != b.title.count { return a.title.count < b.title.count }
            return a.id < b.id
        }
        return Array(hits.prefix(limit))
    }

    static func norm(_ s: String) -> String {
        Inline.plain(s).folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
    }
}
