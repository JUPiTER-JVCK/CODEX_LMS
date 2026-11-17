import Foundation

/// Any JSON value. The web engine stores numbers, booleans and strings in its state, and the
/// app must hand back exactly what it was given, so values are kept as they are.
public enum JSONValue: Codable, Hashable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let b = try? c.decode(Bool.self) {
            self = .bool(b)
        } else if let d = try? c.decode(Double.self) {
            self = .number(d)
        } else if let s = try? c.decode(String.self) {
            self = .string(s)
        } else if let a = try? c.decode([JSONValue].self) {
            self = .array(a)
        } else {
            self = .object(try c.decode([String: JSONValue].self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let b): try c.encode(b)
        case .number(let d):
            // Keep whole numbers whole, so 1 stays 1 and not 1.0.
            if d.rounded() == d, abs(d) < 1e15 { try c.encode(Int64(d)) } else { try c.encode(d) }
        case .string(let s): try c.encode(s)
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        }
    }
}

/// The web engine's saved state (`S` in src/engine.js): placeholder values, finished practice
/// items, theme and the last chapter read.
public struct BookState: Codable, Hashable, Sendable {
    public var vals: [String: JSONValue]
    public var done: [String: JSONValue]
    /// "" follows the system, otherwise "light" or "dark".
    public var theme: String
    public var last: String

    public init(vals: [String: JSONValue] = [:], done: [String: JSONValue] = [:], theme: String = "", last: String = "") {
        self.vals = vals
        self.done = done
        self.theme = theme
        self.last = last
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        vals = (try? c.decodeIfPresent([String: JSONValue].self, forKey: .vals)) ?? [:]
        done = (try? c.decodeIfPresent([String: JSONValue].self, forKey: .done)) ?? [:]
        theme = (try? c.decodeIfPresent(String.self, forKey: .theme)) ?? ""
        last = (try? c.decodeIfPresent(String.self, forKey: .last)) ?? ""
    }

    /// Parses saved state; anything unreadable gives a fresh state rather than an error.
    public static func decode(_ data: Data) -> BookState {
        (try? JSONDecoder().decode(BookState.self, from: data)) ?? BookState()
    }

    public func encoded() -> Data {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys]
        return (try? e.encode(self)) ?? Data("{}".utf8)
    }

    /// Same rule as the engine: an item is done when it has a value other than `false`.
    public func isDone(_ id: String) -> Bool {
        switch done[id] {
        case .none, .some(.null), .some(.bool(false)): return false
        default: return true
        }
    }

    public func progress(for chapter: Chapter) -> ItemProgress {
        ItemProgress(done: chapter.items.filter(isDone).count, total: chapter.items.count)
    }

    public func progress(for toc: TOC) -> ItemProgress {
        toc.chapters.reduce(ItemProgress(done: 0, total: 0)) { sum, c in
            let p = progress(for: c)
            return ItemProgress(done: sum.done + p.done, total: sum.total + p.total)
        }
    }
}

public struct ItemProgress: Hashable, Sendable {
    public var done: Int
    public var total: Int

    public init(done: Int, total: Int) {
        self.done = done
        self.total = total
    }

    public var fraction: Double { total == 0 ? 0 : Double(done) / Double(total) }
    public var isComplete: Bool { total > 0 && done == total }
}
