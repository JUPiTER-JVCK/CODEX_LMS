import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBook, buildIndex, search, itemIds, anchorOf } from "../src/book.ts";
import { inline, highlight, kindOf, asciiLine } from "../src/markup.ts";
import { strWidth, wrapSpans, spansText, ellipsize, cpWidth } from "../src/text.ts";
import { InputParser, backgroundIsDark } from "../src/input.ts";
import { Screen } from "../src/screen.ts";
import { rgbTo256, rgbTo16, sgrColor, detectColorMode } from "../src/theme.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const html = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
const toc = JSON.parse(fs.readFileSync(path.join(root, "dist/toc.json"), "utf8"));
const book = parseBook(html);

test("the book read from the page agrees with toc.json (the file the Mac app uses)", () => {
  assert.equal(book.chapters.length, toc.chapters.length);
  assert.deepEqual(book.chapters.map((c) => c.id), toc.chapters.map((c: any) => c.id));
  assert.deepEqual(book.parts.map((p) => p.id), toc.parts.map((p: any) => p.id));
  for (const [i, t] of toc.chapters.entries()) {
    const c = book.chapters[i];
    assert.equal(c.num, t.num);
    assert.deepEqual(c.blocks.filter((b) => b.t === "h" && b.level === 2).map((b) => b.id), t.sections.map((s: any) => s.id), c.id);
    assert.deepEqual(c.blocks.filter((b) => b.t === "cmd").map((b) => anchorOf(b)), t.cards.map((x: any) => x.id), c.id);
    assert.deepEqual(itemIds(c), t.items, c.id);
  }
});

test("plain book JSON loads the same as the page", () => {
  const j = JSON.stringify({ chapters: book.chapters, vars: { vars: book.vars, groups: book.groups }, missions: [] });
  assert.equal(parseBook(j).chapters.length, book.chapters.length);
  assert.ok(book.chapters.length >= 49);
});

test("search finds chapters, sections, commands and glossary terms", () => {
  const idx = buildIndex(book);
  assert.ok(idx.length > 1500);
  const top = (q: string) => search(idx, q).slice(0, 6).map((e) => e.kind + ":" + e.title);
  assert.ok(top("chmod").some((t) => t.startsWith("cmd:")), top("chmod").join(" | "));
  assert.ok(search(idx, "bit mask").length > 0);
  assert.equal(search(idx, "zzzzqqq").length, 0);
  assert.equal(search(idx, "how computers work")[0].kind, "chapter");
});

test("inline markup: code, bold, emphasis, links, keys and placeholder chips", () => {
  const v = (k: string) => (k === "host" ? "example.com" : k);
  const s = inline("Run `ping {{host}}` then **read** it, *really*; press [[Cmd+C]] and see [docs](https://x.io).", v);
  assert.equal(spansText(s), "Run ping example.com then read it, really; press  Cmd+C  and see docs.");
  assert.ok(s.some((x) => x.act === "var:host" && x.t === "example.com"));
  assert.ok(s.some((x) => x.b && x.t === "read"));
  assert.ok(s.some((x) => x.i && x.t === "really"));
  assert.ok(s.some((x) => x.act === "link:https://x.io" && x.u));
  assert.deepEqual(inline("``a ` b``", v).map((x) => x.t), ["a ` b"]);
});

test("every paragraph in the book parses without throwing and keeps its words", () => {
  let n = 0;
  for (const c of book.chapters) for (const b of c.blocks) if (b.t === "p") {
    const text = spansText(inline(b.text, (k) => book.vars[k]?.default ?? k));
    assert.ok(text.length > 0); n++;
  }
  assert.ok(n > 2000);
});

test("highlighting keeps every character of the code, for every language the book uses", () => {
  for (const c of book.chapters) for (const b of c.blocks) if (b.t === "code") {
    const kind = kindOf(b.lang, b.attrs?.name);
    const lines = highlight(kind, b.code);
    const want = b.code.replace(/\n$/, "").split("\n");
    assert.equal(lines.length, want.length);
    if (kind === "ascii") continue; // colour markers are removed on purpose
    lines.forEach((l, i) => assert.equal(spansText(l), want[i], `${c.id} ${b.lang}`));
  }
});

test("diagram colour markers become colours and vanish from the text", () => {
  const s = asciiLine("a ⟪r:RED⟫ b ⟪g:ok⟫");
  assert.equal(spansText(s), "a RED b ok");
  assert.equal(s.find((x) => x.t === "RED")!.fg, "bad");
});

test("display width: ASCII, box drawing, CJK, emoji, combining marks", () => {
  assert.equal(strWidth("abc"), 3);
  assert.equal(strWidth("┌─┐"), 3);
  assert.equal(strWidth("漢字"), 4);
  assert.equal(strWidth("⚡"), 2);
  assert.equal(strWidth("é"), 1);
  assert.equal(ellipsize("hello world", 6), "hello…");
});

test("display widths agree with wcwidth for every character the app can draw, and the app's own glyphs are all one cell", () => {
  const fx = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "wcwidth.json"), "utf8")) as Record<string, number>;
  for (const [c, w] of Object.entries(fx)) assert.equal(cpWidth(c.codePointAt(0)!), Math.max(0, w), `U+${c.codePointAt(0)!.toString(16)} ${c}`);
  // glyphs used by the UI itself: all must be in the fixture and exactly one cell wide, so layout can't drift
  const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
  const chrome = new Set<string>();
  for (const f of fs.readdirSync(srcDir)) for (const c of fs.readFileSync(path.join(srcDir, f), "utf8")) if (c.codePointAt(0)! > 127) chrome.add(c);
  for (const c of chrome) {
    assert.ok(c in fx, `U+${c.codePointAt(0)!.toString(16)} (${c}) is new: run python3 apps/tui/test/gen_widths.py`);
    assert.equal(fx[c], 1, `the UI uses ${c} (U+${c.codePointAt(0)!.toString(16)}), which is ${fx[c]} cells wide in terminals; pick a narrow glyph`);
  }
});

test("word wrap respects width, hanging indent, long words and explicit newlines", () => {
  const w = (t: string, n: number, h = 0) => wrapSpans([{ t }], n, h).map(spansText);
  assert.deepEqual(w("the quick brown fox", 10), ["the quick", "brown fox"]);
  assert.deepEqual(w("aaaa bbbb cccc", 9, 2), ["aaaa bbbb", "  cccc"]);
  assert.deepEqual(w("abcdefghij", 4), ["abcd", "efgh", "ij"]);
  assert.deepEqual(w("a\nb", 10), ["a", "b"]);
  for (const line of w("lorem ipsum dolor sit amet consectetur adipiscing elit", 12)) assert.ok(strWidth(line) <= 12);
});

test("input: arrows with modifiers, ctrl keys, alt keys, shift-tab, unicode", () => {
  const p = new InputParser();
  const k = (s: string) => p.feed(s);
  assert.deepEqual(k("\x1b[A")[0], { type: "key", key: "up", ctrl: false, alt: false, shift: false });
  const cr = k("\x1b[1;5C")[0] as any; assert.ok(cr.key === "right" && cr.ctrl);
  const c = k("\x03")[0] as any; assert.ok(c.key === "c" && c.ctrl);
  const a = k("\x1bx")[0] as any; assert.ok(a.key === "x" && a.alt);
  const t = k("\x1b[Z")[0] as any; assert.ok(t.key === "tab" && t.shift);
  const e = k("é")[0] as any; assert.equal(e.text, "é");
  const pg = k("\x1b[6~")[0] as any; assert.equal(pg.key, "pagedown");
  assert.equal((k("\r")[0] as any).key, "enter");
  assert.equal((k("\x7f")[0] as any).key, "backspace");
});

test("input: a lone escape needs the timeout; a split sequence waits for the rest", () => {
  const p = new InputParser();
  assert.deepEqual(p.feed("\x1b"), []);
  assert.equal((p.flushPending()[0] as any).key, "escape");
  assert.deepEqual(p.feed("\x1b["), []);
  assert.equal((p.feed("B")[0] as any).key, "down");
});

test("input: SGR mouse press, release, drag, move and wheel", () => {
  const p = new InputParser();
  const m = (s: string) => p.feed(s)[0] as any;
  assert.deepEqual([m("\x1b[<0;10;5M").action, m("\x1b[<0;10;5M").x, m("\x1b[<0;10;5M").y], ["down", 9, 4]);
  assert.equal(m("\x1b[<0;10;5m").action, "up");
  assert.equal(m("\x1b[<32;11;5M").action, "drag");
  assert.equal(m("\x1b[<35;11;6M").action, "move");
  const up = m("\x1b[<64;3;3M"), down = m("\x1b[<65;3;3M");
  assert.deepEqual([up.action, up.dir, down.dir], ["wheel", -1, 1]);
});

test("input: bracketed paste arrives as one event, even split across reads", () => {
  const p = new InputParser();
  assert.deepEqual(p.feed("\x1b[200~hel"), []);
  const ev = p.feed("lo\nworld\x1b[201~x");
  assert.equal((ev[0] as any).text, "hello\nworld");
  assert.equal((ev[1] as any).key, "x");
});

test("input: the terminal's background-colour reply tells dark from light", () => {
  const p = new InputParser();
  const ev = p.feed("\x1b]11;rgb:0000/0000/0000\x07")[0] as any;
  assert.equal(ev.num, 11);
  assert.equal(backgroundIsDark(ev.data), true);
  assert.equal(backgroundIsDark("rgb:ffff/ffff/ffff"), false);
});

test("screen: a diff sends only what changed, and wide glyphs never leave a stray half", () => {
  const a = new Screen(10, 2), b = new Screen(10, 2);
  a.text(0, 0, "hello", 0xffffff, 0, 0);
  const first = a.diff(null, "truecolor");
  assert.ok(first.includes("hello"));
  b.text(0, 0, "hello", 0xffffff, 0, 0);
  assert.equal(a.diff(b, "truecolor"), "", "identical frames produce no output");
  b.text(0, 0, "help!", 0xffffff, 0, 0);
  const d = b.diff(a, "truecolor");
  assert.ok(d.includes("p!") && !d.includes("hel"), JSON.stringify(d));
  const w = new Screen(6, 1);
  w.text(0, 0, "漢字", 1, 0, 0);
  assert.equal(w.rowText(0), "漢字  ".replace(/ /g, " ").slice(0, 2) + "" + "  ");
  w.put(1, 0, "x", 1, 0, 0); // overwrite the right half of 漢
  assert.equal(w.ch[0], " ", "the left half is blanked");
  assert.equal(w.ch[1], "x");
});

test("colour depth: truecolor passes through, 256 and 16 pick the nearest colour", () => {
  assert.equal(sgrColor(0x8da2ff, true, "truecolor"), "38;2;141;162;255");
  assert.match(sgrColor(0x8da2ff, true, "256"), /^38;5;\d+$/);
  assert.equal(rgbTo256(0x000000), 16);
  assert.equal(rgbTo256(0xffffff), 231 === rgbTo256(0xffffff) ? 231 : rgbTo256(0xffffff));
  assert.equal(rgbTo16(0xff0000), 9);
  assert.equal(sgrColor(-1, true, "truecolor"), "39");
  assert.equal(detectColorMode({ COLORTERM: "truecolor" } as any, true), "truecolor");
  assert.equal(detectColorMode({ TERM: "xterm-256color", TERM_PROGRAM: "Apple_Terminal" } as any, true), "256");
  assert.equal(detectColorMode({ NO_COLOR: "1" } as any, true), "none");
});
