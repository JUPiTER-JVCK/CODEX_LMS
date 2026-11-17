import XCTest
@testable import CodexCore

final class CodexCoreTests: XCTestCase {
    /// The real table of contents the build writes; the app bundles this same file.
    static let tocURL = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent() // CodexCoreTests
        .deletingLastPathComponent() // Tests
        .deletingLastPathComponent() // apple
        .deletingLastPathComponent() // repo root
        .appendingPathComponent("dist/toc.json")

    func loadTOC() throws -> TOC { try TOC.load(from: Self.tocURL) }

    func testTOCDecodes() throws {
        let toc = try loadTOC()
        XCTAssertEqual(toc.parts.first?.id, "start")
        XCTAssertGreaterThanOrEqual(toc.chapters.count, 40)
        XCTAssertEqual(Set(toc.chapters.map(\.id)).count, toc.chapters.count, "chapter ids are unique")
        XCTAssertEqual(toc.chapters.first?.id, "welcome")
        XCTAssertEqual(toc.chapters.map(\.num), Array(0..<toc.chapters.count))
        for c in toc.chapters {
            XCTAssertNotNil(toc.parts.first { $0.id == c.part }, "chapter \(c.id) has a known part")
        }
        XCTAssertNotNil(toc.specialPage(id: "atlas"))
        XCTAssertGreaterThan(toc.chapters.reduce(0) { $0 + $1.items.count }, 0)
    }

    func testSearchFindsCommandFirst() throws {
        let toc = try loadTOC()
        let hits = BookSearch(toc: toc).search("grep")
        XCTAssertEqual(hits.first?.kind, .command)
        XCTAssertEqual(hits.first?.title, "grep")
        XCTAssertTrue(hits.first?.route.contains("/cmd-") ?? false)
    }

    func testSearchFindsChapterAndSections() throws {
        let toc = try loadTOC()
        let hits = BookSearch(toc: toc).search("dns")
        XCTAssertTrue(hits.contains { $0.kind == .chapter && $0.chapterID == "dns" })
        XCTAssertTrue(hits.contains { $0.kind == .section && $0.chapterID == "dns" })
        XCTAssertTrue(BookSearch(toc: toc).search("   ").isEmpty)
        XCTAssertTrue(BookSearch(toc: toc).search("atlas").contains { $0.kind == .page && $0.route == "atlas" })
    }

    func testStateRoundTripKeepsValues() throws {
        let json = #"{"vals":{"host":"my.example"},"done":{"a":1,"b":false,"c":3,"d":0.5},"theme":"dark","last":"dns"}"#
        let s = BookState.decode(Data(json.utf8))
        XCTAssertEqual(s.theme, "dark")
        XCTAssertEqual(s.last, "dns")
        XCTAssertTrue(s.isDone("a"))
        XCTAssertFalse(s.isDone("b"))
        XCTAssertTrue(s.isDone("c"))
        XCTAssertFalse(s.isDone("missing"))
        let again = BookState.decode(s.encoded())
        XCTAssertEqual(again, s)
        let text = String(decoding: s.encoded(), as: UTF8.self)
        XCTAssertTrue(text.contains(#""a":1"#), text)
        XCTAssertTrue(text.contains(#""b":false"#), text)
    }

    func testBadStateGivesFreshState() {
        XCTAssertEqual(BookState.decode(Data("not json".utf8)), BookState())
        XCTAssertEqual(BookState.decode(Data("{}".utf8)), BookState())
    }

    func testProgress() {
        let c = Chapter(id: "x", num: 1, title: "X", sub: "", part: "found", time: 5, level: "", sections: [], cards: [], items: ["e1", "e2", "p#0"])
        var s = BookState()
        XCTAssertEqual(s.progress(for: c), ItemProgress(done: 0, total: 3))
        s.done["e1"] = .number(1)
        s.done["p#0"] = .bool(true)
        s.done["e2"] = .bool(false)
        XCTAssertEqual(s.progress(for: c).done, 2)
        XCTAssertFalse(s.progress(for: c).isComplete)
        s.done["e2"] = .number(1)
        XCTAssertTrue(s.progress(for: c).isComplete)
    }

    func testInlinePlain() {
        XCTAssertEqual(Inline.plain("Use `ls` and **ssh** to {{host}}"), "Use ls and ssh to host")
    }
}
