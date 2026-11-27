// Terminal-specific behaviour: small windows, dialogs and the contents drawer sitting on top of the page,
// keys that belong to a text field, and what the footer keeps when it runs out of room.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBook, type Chapter } from "../src/book.ts";
import { App, MIN_COLS, MIN_ROWS } from "../src/app.ts";
import { flowLabels, layoutChapter, newUi, PROSE_W } from "../src/blocks.ts";
import { InputParser, type InputEvent } from "../src/input.ts";
import { A_DIM, A_INV } from "../src/screen.ts";
import { Store } from "../src/state.ts";
import { editFieldEx, field } from "../src/textedit.ts";
import { ellipsize, spansWidth, strWidth } from "../src/text.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const book = parseBook(fs.readFileSync(path.join(root, "dist/index.html"), "utf8"));

function mk(o: { cols?: number; rows?: number } = {}) {
  const host = { quit: false };
  const app = new App(book, new Store(null), { copy() {}, quit: () => { host.quit = true; } }, { cols: o.cols ?? 130, rows: o.rows ?? 40, splash: false, theme: "dark" });
  const p = new InputParser();
  const send = (raw: string) => { for (const e of [...p.feed(raw), ...p.flushPending()] as InputEvent[]) app.handle(e); }; // flushPending: a lone ESC is the Escape key once the 25 ms pause has passed
  const screen = () => app.render().toText();
  const find = (s: string) => { const rows = screen().split("\n"); for (let y = 0; y < rows.length; y++) { const x = rows[y].indexOf(s); if (x >= 0) return { x, y }; } return null; };
  const click = (x: number, y: number) => { app.render(); send(`\x1b[<0;${x + 1};${y + 1}M`); send(`\x1b[<0;${x + 1};${y + 1}m`); };
  const ids = () => { app.render(); return app.hits.regions.map((r) => r.id); };
  const priv = app as any;
  return { app, host, send, screen, find, click, ids, priv };
}

const lastRow = (s: string) => s.split("\n").at(-1)!;

// ---------- small windows ----------

test("below the minimum size the app says so instead of drawing a broken page", () => {
  const { app } = mk({ cols: MIN_COLS - 1, rows: 24 });
  assert.match(app.render().toText(), /Window too small/);
  const short = mk({ cols: 100, rows: MIN_ROWS - 1 });
  assert.match(short.screen(), /Window too small/);
  assert.doesNotMatch(mk({ cols: MIN_COLS, rows: MIN_ROWS }).screen(), /Window too small/);
});

test("no line of any chapter, header included, is wider than the page, down to the smallest supported window", () => {
  for (const width of [24, 30, 45]) {
    for (const c of book.chapters) {
      const doc = layoutChapter(c, { width, vars: (k) => k, ui: newUi(), isDone: () => false, labRows: () => undefined, partTitle: book.parts.find((p) => p.id === c.part)?.title });
      doc.lines.forEach((l, i) => { if (!l.pre) assert.ok(spansWidth(l.spans) <= Math.max(24, width), `${c.id}@${width} line ${i} is ${spansWidth(l.spans)} wide`); });
    }
  }
});

test("the chapter meta line breaks between labels, never inside one", () => {
  const labels = ["CHAPTER 04", "ADDRESSING AND SUBNETTING", "25 MIN", "INTERMEDIATE"];
  const lines = flowLabels(labels, 30, " · ");
  assert.ok(lines.length > 1);
  for (const l of lines) assert.ok(strWidth(l) <= 30, l);
  assert.equal(lines.join(" ").replace(/ · /g, " ").replace(/\s+/g, " "), labels.join(" "));
  assert.deepEqual(flowLabels(labels, 200, " · "), [labels.join(" · ")]);
  assert.equal(flowLabels(["x".repeat(50)], 20, " · ")[0].length, 20, "a label longer than the line is cut with an ellipsis");
});

test("prose stays at a readable line length in a wide window, while code and tables keep the full width", () => {
  const c: Chapter = {
    id: "t", title: "T", sub: "", part: "x", num: 1, time: 1, level: "", goals: [], terms: [], file: "",
    blocks: [{ t: "p", text: "word ".repeat(80) } as any, { t: "ul", items: ["item ".repeat(60)] } as any, { t: "code", lang: "sh", attrs: {}, code: "x".repeat(100) } as any],
  };
  const doc = layoutChapter(c, { width: 110, vars: (k) => k, ui: newUi(), isDone: () => false, labRows: () => undefined });
  const widths = doc.lines.map((l) => spansWidth(l.spans));
  const prose = doc.lines.filter((l) => /^(word |•|\s+item|item )/.test(l.spans.map((s) => s.t).join("")));
  assert.ok(prose.length > 6);
  for (const l of prose) assert.ok(spansWidth(l.spans) <= PROSE_W, `prose line is ${spansWidth(l.spans)} wide`);
  assert.ok(Math.max(...widths) > PROSE_W, "the code block still uses the width");
});

test("an ellipsis never follows a space", () => {
  assert.equal(ellipsize("Welcome: How This Book Works", 24), "Welcome: How This Book…");
  assert.equal(ellipsize("short", 24), "short");
});

// ---------- footer ----------

test("the footer gives up the least important hints first, and keeps help and quit", () => {
  for (const cols of [30, 36, 48, 64, 80, 110]) {
    const row = lastRow(mk({ cols, rows: 24 }).screen());
    assert.match(row, /\? help/, `${cols} cols: ${row}`);
    assert.match(row, /q quit/, `${cols} cols: ${row}`);
  }
  assert.match(lastRow(mk({ cols: 130, rows: 24 }).screen()), /t theme.*b sidebar/, "everything shows when there is room");
});

test("a long message in the footer is cut to fit and never covers the scroll position", () => {
  const { app, screen } = mk({ cols: 50, rows: 24 });
  app.toast("x".repeat(200));
  const row = lastRow(screen());
  assert.match(row, /…/);
  assert.match(row, /\d+%\s*$/);
});

// ---------- dialogs and the contents drawer sit on a scrim ----------

test("while a dialog is open nothing behind it can be pressed, and a click outside closes it", () => {
  const { app, send, find, click, ids } = mk();
  const row = find("How Computers Work")!;
  send("?");
  const open = ids();
  assert.ok(open.every((id) => id === "scrim" || id === "ov"), `only the scrim and the dialog are live, got ${open.filter((i) => i !== "scrim" && i !== "ov").join(",")}`);
  click(row.x + 2, row.y); // where the sidebar entry is, outside the dialog
  assert.equal(app.overlay, null, "the click closed the dialog");
  assert.equal(app.chapterId, "welcome", "and did not also open the chapter hiding behind it");
  send("/");
  assert.ok(ids().every((id) => id === "scrim" || id === "ov" || id.startsWith("pal:")));
});

test("the wheel does not scroll the page behind a dialog", () => {
  const { app, send } = mk();
  send("?");
  send("\x1b[<65;60;20M");
  assert.equal(app.scroll, 0);
});

test("a prompt is not dismissed by a stray click (the text typed so far is kept)", () => {
  const { app, send, click } = mk();
  send("/"); (app as any).overlay = { kind: "prompt", f: field("abc"), label: "L", desc: "", hint: "", submit() {} };
  click(2, 20);
  assert.equal(app.overlay?.kind, "prompt");
});

test("narrow window: the contents list is a drawer that owns the keyboard, closes with esc, a click outside, or a choice", () => {
  const { app, send, click, ids, priv } = mk({ cols: 80, rows: 24 });
  assert.equal(priv.sbOpen, false, "closed to begin with when it cannot dock");
  send("b");
  assert.equal(priv.sbOpen, true);
  assert.equal(priv.sbFocus, true, "opening it hands it the keyboard");
  const open = ids();
  assert.ok(!open.some((id) => id.startsWith("a:")), "no link or button of the page behind it is live");
  assert.ok(open.includes("scrim"));
  send("j"); send("j");
  assert.equal(app.scroll, 0, "arrow keys move in the list, not in the page behind it");
  send("\x1b");
  assert.equal(priv.sbOpen, false, "esc closes it");
  send("b"); click(70, 12);
  assert.equal(priv.sbOpen, false, "a click on the dimmed page closes it");
  send("b");
  while (priv.sbRows()[priv.sbCur].id === "welcome") send("j"); // down to another chapter
  send("\r");
  assert.equal(priv.sbOpen, false, "choosing something closes it");
  assert.notEqual(app.chapterId, "welcome", "and it went there");
  send("b"); click(priv.sbW - 5, 1); // the ✕ in the drawer's header
  assert.equal(priv.sbOpen, false, "the ✕ closes it for mouse users");
});

test("the contents list that was docked closes when the window narrows and comes back when it widens", () => {
  const { app, priv } = mk({ cols: 130, rows: 30 });
  assert.equal(priv.sbOpen, true);
  app.resize(90, 30);
  assert.equal(priv.sbOpen, false, "it does not turn into a drawer covering the page");
  app.resize(130, 30);
  assert.equal(priv.sbOpen, true, "and returns");
  priv.toggleSidebar(); // the reader hides it on purpose
  app.resize(90, 30); app.resize(130, 30);
  assert.equal(priv.sbOpen, false, "a list closed on purpose stays closed");
});

test("the sidebar widens with the window so titles are not cut, and a drawer never takes the whole window", () => {
  const w = (cols: number) => (mk({ cols, rows: 30 }).priv.sbW as number);
  assert.ok(w(100) >= 30 && w(200) <= 40 && w(200) > w(100));
  const d = mk({ cols: 40, rows: 30 });
  d.send("b");
  assert.ok(d.priv.sbW <= 40 - 10);
});

test("keyboard cursor and current page look different in the contents list", () => {
  const { app, send, screen } = mk({ cols: 130, rows: 30 });
  send("s"); send("j"); send("j"); send("j");
  const rows = screen().split("\n");
  assert.ok(rows.some((r) => r.startsWith("›")), "the keyboard cursor has its own mark");
  assert.ok(rows.some((r) => r.startsWith("▌")), "the current chapter keeps its bar");
  assert.equal(app.chapterId, "welcome");
});

// ---------- keys that belong to a text field ----------

test("a text field owns its editing keys even when they change nothing", () => {
  const f = field("ab");
  assert.deepEqual(editFieldEx(f, { type: "key", key: "end", ctrl: false, alt: false, shift: false }), { handled: true, changed: false });
  assert.deepEqual(editFieldEx(f, { type: "key", key: "right", ctrl: false, alt: false, shift: false }), { handled: true, changed: false });
  f.cur = 0;
  assert.deepEqual(editFieldEx(f, { type: "key", key: "backspace", ctrl: false, alt: false, shift: false }), { handled: true, changed: false });
  assert.equal(editFieldEx(f, { type: "key", key: "up", ctrl: false, alt: false, shift: false }).handled, false, "arrows up and down are the page's");
  assert.equal(editFieldEx(f, { type: "key", key: "x", ctrl: false, alt: false, shift: false, text: "x" }).changed, true);
});

test("backspace, arrows and delete step over a whole emoji, not half of it", () => {
  const key = (k: string) => ({ type: "key", key: k, ctrl: false, alt: false, shift: false }) as InputEvent;
  const f = field("a😀b");
  f.cur = 3; // after the emoji
  editFieldEx(f, key("backspace"));
  assert.equal(f.text, "ab");
  const g = field("😀");
  editFieldEx(g, key("left")); assert.equal(g.cur, 0);
  editFieldEx(g, key("right")); assert.equal(g.cur, 2);
  g.cur = 0; editFieldEx(g, key("delete")); assert.equal(g.text, "");
});

test("End and Home inside a focused text lab stay in the field instead of jumping the page", () => {
  const { app, send, priv } = mk({ cols: 140, rows: 50 });
  const c = book.chapters.find((c) => c.blocks.some((b) => b.t === "widget" && b.name === "utf8"))!;
  app.go(c.id);
  const line = app.doc.lines.findIndex((l) => l.widget?.name === "utf8");
  app.scroll = Math.max(0, line - 2);
  app.render();
  send("\r");
  assert.ok(priv.labFocus, "the lab has the keyboard");
  const at = app.scroll;
  send("\x1b[F"); send("\x1b[F"); send("\x1b[H"); send("\x1b[H");
  assert.equal(app.scroll, at, "End/Home did not scroll the page");
});

test("Enter only grabs a lab that is on screen, and a lab scrolled out of sight lets go of the keys", () => {
  const { app, send, priv } = mk({ cols: 140, rows: 50 });
  app.go("computers");
  const line = app.doc.lines.findIndex((l) => l.widget?.name === "bitswitches");
  assert.ok(line > app.rows, "the lab starts below the first screen");
  app.scroll = 0; app.render();
  send("\r");
  assert.equal(priv.labFocus, null, "nothing on screen to enter");
  app.scroll = Math.max(0, line - 2); app.render();
  send("\r");
  assert.ok(priv.labFocus);
  app.scroll = 0; app.render();
  send("x");
  assert.equal(priv.labFocus, null, "it let go once it was out of sight");
});

// ---------- help, palette, prompt ----------

test("the help dialog fits any window: it keeps both bars visible and scrolls when it is too tall", () => {
  const { app, send, screen } = mk({ cols: 100, rows: 14 });
  send("?");
  const s = screen().split("\n");
  assert.match(s[0], /CODEX_LMS/, "the top bar is not covered");
  assert.match(s[13], /\? help/, "the footer is not covered");
  const first = s.find((r) => /scroll\b/.test(r) && /│/.test(r));
  assert.ok(first, "starts at the top of the list");
  send("j"); send("j"); send("j");
  assert.equal(app.overlay?.kind, "help", "j scrolls instead of closing");
  assert.notEqual(screen(), s.join("\n"));
  send("\x1b");
  assert.equal(app.overlay, null);
  const tall = mk({ cols: 100, rows: 40 });
  tall.send("?"); tall.send("j");
  assert.equal(tall.app.overlay, null, "when everything fits, any key closes it as before");
});

test("search results line up: titles share a column and descriptions start together", () => {
  const { send, screen } = mk({ cols: 110, rows: 30 });
  send("/"); for (const ch of "dns") send(ch);
  const rows = screen().split("\n").filter((r) => /│\s*[▌ ]\s*(CH|\$|Aa| §)/.test(r));
  assert.ok(rows.length >= 4);
  const starts = rows.map((r) => { const m = /(CH|\$|Aa| §)\s{1,2}(.*?)\s{2,}(\S)/.exec(r); return m ? r.indexOf(m[3], r.indexOf(m[2]) + m[2].length) : -1; });
  assert.ok(starts.every((x) => x > 0), rows.join("\n"));
  assert.equal(new Set(starts).size, 1, "one description column: " + starts.join(","));
  assert.match(screen(), /1 of \d+ results/);
});

test("a long answer in a prompt scrolls inside its box with the cursor kept in view", () => {
  const { app, send, screen } = mk({ cols: 60, rows: 24 });
  (app as any).overlay = { kind: "prompt", f: field("x".repeat(200)), label: "L", desc: "d", hint: "h", submit() {} };
  const s = screen().split("\n");
  const row = s.find((r) => /│\s+x{10}/.test(r))!;
  assert.ok(row, "the field is drawn");
  assert.ok(strWidth(row) <= 60);
  void send;
});

// ---------- cheap frames ----------

test("handle() says whether a frame is needed: a pointer drifting over empty space needs none", () => {
  const { app, find } = mk();
  const move = (x: number, y: number): InputEvent => ({ type: "mouse", action: "move", button: -1, x, y, ctrl: false, alt: false, shift: false });
  app.render();
  assert.equal(app.handle(move(60, 1)), false, "empty reader margin: nothing changes");
  assert.equal(app.handle(move(61, 1)), false);
  const link = find("Search")!;
  assert.equal(app.handle(move(link.x + 2, link.y)), true, "the search button lights up");
  assert.equal(app.handle(move(link.x + 3, link.y)), false, "still the same button");
  assert.equal(app.handle({ type: "focus", focused: true }), false);
});

test("a key press clears a stale hover highlight", () => {
  const { app, find, send, priv } = mk();
  const b = find("Search")!;
  app.handle({ type: "mouse", action: "move", button: -1, x: b.x + 2, y: b.y, ctrl: false, alt: false, shift: false });
  assert.ok(priv.hoverId);
  send("j");
  assert.equal(priv.hoverId, null);
});

test("shift-space and ctrl-b page back, ctrl-f pages forward", () => {
  const { app, send } = mk();
  send("\x06"); const down = app.scroll;
  assert.ok(down > 10);
  send("\x06");
  send("\x1b[32;2u"); // shift+space (kitty protocol)
  assert.ok(app.scroll < down * 2 && app.scroll >= down);
  send("\x02");
  assert.ok(app.scroll < down * 2);
});

// ---------- terminals without colour ----------

test("with no colour, the page behind a dialog is dimmed by attribute and a text cursor is inverse video", () => {
  const draw = (mode: "none" | "truecolor", dialog: boolean) => {
    const app = new App(book, new Store(null), { copy() {}, quit() {} }, { cols: 100, rows: 30, splash: false, theme: "dark", colorMode: mode });
    const p = new InputParser();
    if (dialog) for (const ch of "/dns") for (const e of p.feed(ch)) app.handle(e);
    return app.render();
  };
  const none = draw("none", true);
  const behind = 28 * none.w + 60; // reader area, far from the dialog
  assert.ok(none.at[behind] & A_DIM, "dim attribute where colours cannot be dimmed");
  const cur = Array.from(none.at).findIndex((a) => a & A_INV);
  assert.ok(cur >= 0, "the cursor is an inverse cell, so it shows without colour");
  assert.equal(none.ch[cur - 1], "s", "right after what was typed");
  assert.equal(Array.from(none.at).filter((a) => a & A_INV).length, 1, "and nothing else is inverse");
  const withDialog = draw("truecolor", true), without = draw("truecolor", false);
  assert.equal(withDialog.at[behind] & A_DIM, 0, "with colour the dimming is done with colour, not an attribute");
  assert.equal(withDialog.ch[behind], without.ch[behind], "the same text is there");
  assert.notEqual(withDialog.fg[behind], without.fg[behind], "but its colour has moved toward the background");
});
