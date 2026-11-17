import Foundation

/// The book's table of contents, as written by `tools/build.py` to `dist/toc.json`.
public struct TOC: Codable, Hashable, Sendable {
    public var version: Int
    public var parts: [Part]
    public var chapters: [Chapter]
    /// Pages the web engine generates itself (Command Atlas, Practice Hub, Glossary, My Values).
    public var special: [SpecialPage]

    public init(version: Int = 1, parts: [Part], chapters: [Chapter], special: [SpecialPage]) {
        self.version = version
        self.parts = parts
        self.chapters = chapters
        self.special = special
    }

    public static func load(from url: URL) throws -> TOC {
        try JSONDecoder().decode(TOC.self, from: Data(contentsOf: url))
    }

    public func chapters(in part: Part) -> [Chapter] {
        chapters.filter { $0.part == part.id }
    }

    public func chapter(id: String) -> Chapter? {
        chapters.first { $0.id == id }
    }

    public func specialPage(id: String) -> SpecialPage? {
        special.first { $0.id == id }
    }

    /// Title of a chapter or special page, for window titles.
    public func title(of id: String) -> String? {
        chapter(id: id)?.plainTitle ?? specialPage(id: id)?.title
    }
}

public struct Part: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var title: String
}

public struct Chapter: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    /// Chapter number shown in the book (00, 01, ...).
    public var num: Int
    public var title: String
    public var sub: String
    public var part: String
    /// Estimated minutes.
    public var time: Int
    public var level: String
    /// Level-2 headings, in order. `id` is the anchor inside the chapter (`#<chapter>/<id>`).
    public var sections: [ChapterSection]
    /// Command cards. `id` is the card's anchor (`#<chapter>/<id>`).
    public var cards: [Card]
    /// Ids of exercises, checkpoints and project steps: the keys progress is saved under.
    public var items: [String]

    public var plainTitle: String { Inline.plain(title) }
    public var numberLabel: String { num < 10 ? "0\(num)" : "\(num)" }
}

public struct ChapterSection: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var text: String
    public var level: Int

    public var plainText: String { Inline.plain(text) }
}

public struct Card: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var sum: String
    public var cat: String
}

public struct SpecialPage: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var sub: String
}

/// Inline markup used in the book's text (`code`, **bold**, {{placeholder}}).
public enum Inline {
    /// The text without inline markup, for native labels and search.
    public static func plain(_ s: String) -> String {
        var out = s.replacingOccurrences(of: "**", with: "")
        out = out.replacingOccurrences(of: "`", with: "")
        out = out.replacingOccurrences(of: "{{", with: "")
        out = out.replacingOccurrences(of: "}}", with: "")
        return out
    }
}
