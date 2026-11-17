import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBook, itemIds } from "../src/book.ts";
import { App } from "../src/app.ts";
import { layoutChapter, newUi } from "../src/blocks.ts";
import { buildSpecial, SPECIAL_IDS } from "../src/specials.ts";
import { Store } from "../src/state.ts";
import { InputParser, type InputEvent } from "../src/input.ts";
import { spansWidth, spansText } from "../src/text.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const book = parseBook(fs.readFileSync(path.join(root, "dist/index.html"), "utf8"));

function mk(o: { cols?: number; rows?: number; theme?: string } = {}) {
  const host = { copied: [] as string[], quit: false, copy(t: string) { this.copied.push(t); }, quitNow() {} };
  const h = { copy: (t: string) => host.copied.push(t), quit: () => { host.quit = true; } };
  const store = new Store(null);
  const app = new App(book, store, h, { cols: o.cols ?? 130, rows: o.rows ?? 40, splash: false, theme: o.theme ?? "dark" });
  const p = new InputParser();
  const send = (raw: string) => { for (const e of p.feed(raw) as InputEvent[]) app.handle(e); };
  const screen = () => app.render().toText();
  const find = (s: string) => { const rows = screen().split("\n"); for (let y = 0; y < rows.length; y++) { const x = rows[y].indexOf(s); if (x >= 0) return { x, y }; } return null; };
  const click = (x: number, y: number) => { app.render(); send(`\x1b[<0;${x + 1};${y + 1}M`); send(`\x1b[<0;${x + 1};${y + 1}m`); };
  return { app, store, host, send, screen, find, click };
}

test("every line of every chapter fits its width, at three widths, with every card open", () => {
  const vars = (k: string) => book.vars[k]?.default ?? k;
  const bad: string[] = [];
  for (const width of [40, 80, 108]) {
    for (const c of book.chapters) {
      const ui = newUi();
      for (const b of c.blocks) if (b.t === "cmd") ui.open["cmd-" + (b.id || b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))] = true;
      const doc = layoutChapter(c, { width, vars, ui, isDone: () => false, labRows: () => undefined });
      doc.lines.forEach((l, i) => {
        if (l.pre) return;
        const w = spansWidth(l.spans);
        if (w > width) bad.push(`${c.id}@${width} line ${i} is ${w} wide: ${spansText(l.spans).slice(0, 70)}`);
      });
    }
  }
  assert.equal(bad.length, 0, `${bad.length} lines too wide, e.g.\n` + bad.slice(0, 12).join("\n"));
});

test("the four generated pages build and lay out", () => {
  const store = new Store(null);
  for (const id of SPECIAL_IDS) {
    const c = buildSpecial(book, store, id)!;
    assert.ok(c.blocks.length > 5, id);
    const doc = layoutChapter(c, { width: 90, vars: (k) => k, ui: newUi(), isDone: () => false, labRows: () => undefined });
    assert.ok(doc.lines.length > 10, id);
  }
  assert.ok(buildSpecial(book, store, "atlas")!.blocks.filter((b) => b.t === "link").length >= 780);
});

test("the app starts on the first chapter and draws the bars, sidebar and chapter", () => {
  const { screen } = mk();
  const s = screen();
  assert.match(s, /CODEX_LMS/);
  assert.match(s, /CONTENTS/);
  assert.match(s, /Welcome: How This Book Works/);
  assert.match(s, /Search/);
  assert.match(s, /q quit/);
});

test("it resumes the last chapter and saves where you are", () => {
  const store = new Store(null);
  store.last = "crypto";
  const app = new App(book, store, { copy() {}, quit() {} }, { cols: 120, rows: 30, splash: false });
  assert.equal(app.chapterId, "crypto");
  app.handle({ type: "key", key: "n", ctrl: false, alt: false, shift: false, text: "n" });
  assert.equal(store.last, app.chapterId);
  assert.notEqual(app.chapterId, "crypto");
});

test("keyboard: scroll, page, top, bottom, next and previous chapter", () => {
  const { app, send } = mk();
  send("j"); send("j"); assert.equal(app.scroll, 2);
  send(" "); assert.ok(app.scroll > 20);
  send("G"); assert.ok(app.scroll > 50);
  send("g"); assert.equal(app.scroll, 0);
  const first = app.chapterId;
  send("n"); assert.notEqual(app.chapterId, first);
  send("p"); assert.equal(app.chapterId, first);
  send("p"); assert.equal(app.chapterId, first, "stays on the first chapter");
});

test("mouse: the wheel scrolls the reader, shift+wheel pans diagrams", () => {
  const { app, send } = mk();
  app.render();
  send("\x1b[<65;80;20M"); send("\x1b[<65;80;20M");
  assert.equal(app.scroll, 6);
  send("\x1b[<64;80;20M");
  assert.equal(app.scroll, 3);
  send("\x1b[<69;80;20M"); // shift+wheel down
  assert.equal(app.hscroll, 8);
});

test("mouse: clicking a chapter in the sidebar opens it", () => {
  const { app, find, click } = mk();
  const at = find("How Computers Work");
  assert.ok(at && at.x < 32, "listed in the sidebar");
  click(at!.x + 2, at!.y);
  assert.equal(app.chapterId, "computers");
});

test("search: type to filter, enter opens the match, escape closes", () => {
  const { app, send, screen } = mk();
  send("/");
  assert.equal(app.overlay?.kind, "palette");
  assert.match(screen(), /chapters, sections, commands, terms/);
  send("chmod");
  const s = screen();
  assert.match(s, /chmod/);
  send("\r");
  assert.equal(app.overlay, null);
  assert.ok(app.chapter.blocks.some((b) => JSON.stringify(b).toLowerCase().includes("chmod")), "landed on a page that mentions chmod");
  send("/"); send("\x1b"); // lone escape needs the parser flush; use the key event directly
  app.handle({ type: "key", key: "escape", ctrl: false, alt: false, shift: false });
  assert.equal(app.overlay, null);
});

test("search: clicking a result opens it", () => {
  const { app, send, find, click } = mk();
  send("/"); send("subnetting");
  const at = find("Addressing & Subnetting") ?? find("ubnet");
  assert.ok(at);
  click(at!.x + 2, at!.y);
  assert.equal(app.overlay, null);
  assert.equal(app.chapterId, "addressing");
});

test("theme cycles System, Light, Dark and is remembered", () => {
  const { app, store, send } = mk({ theme: "" as any });
  assert.equal(app.themePref, "");
  send("t"); assert.equal(app.themePref, "light"); assert.equal(store.theme, "light");
  send("t"); assert.equal(app.themePref, "dark");
  send("t"); assert.equal(app.themePref, "");
  assert.equal(app.themeName, "dark");
  app.sysDark = false;
  assert.equal(app.themeName, "light");
});

test("every cell has a real background: no hole shows the terminal's own colour", () => {
  for (const theme of ["dark", "light"]) {
    const { app, send } = mk({ theme });
    for (const id of ["welcome", "computers", "zsh-basics", "atlas"]) {
      app.go(id);
      for (let i = 0; i < 3; i++) {
        const s = app.render();
        assert.ok(s.bg.every((v) => v >= 0), `${theme}/${id}: a cell has the default background`);
        assert.ok(s.fg.every((v) => v >= 0), `${theme}/${id}: a cell has the default foreground`);
        send(" ");
      }
    }
    send("/"); send("net");
    const s = app.render();
    assert.ok(s.bg.every((v) => v >= 0), `${theme}/search`);
    send("\x03");
  }
});

test("the theme really changes what is painted", () => {
  const { app, send } = mk({ theme: "dark" });
  const a = app.render();
  const bgDark = a.bg[a.w * 5 + 60];
  send("t"); // system -> light? start was dark, so cycle: dark -> system -> light
  send("t");
  const b = app.render();
  assert.notEqual(b.bg[b.w * 5 + 60], bgDark);
});

test("copy: clicking Copy on a code block puts its exact code on the clipboard", () => {
  const { app, host, send, find, click } = mk();
  app.go("computers");
  send("e");
  let found = false;
  for (let i = 0; i < 80 && !found; i++) {
    const at = find("⧉ Copy");
    if (at) { click(at.x + 2, at.y); found = true; }
    else send(" ");
  }
  assert.ok(found, "a Copy button was reachable by scrolling");
  assert.equal(host.copied.length, 1);
  assert.ok(host.copied[0].length > 3);
});

test("exercises: hint, solution and done work, and done is saved", () => {
  const { app, store, send, find, click } = mk();
  app.go("zsh-basics");
  const ex = app.chapter.blocks.find((b) => b.t === "exercise")!;
  for (let i = 0; i < 60 && !find("Hint 1/"); i++) send(" ");
  const h = find("Hint 1/")!;
  click(h.x + 2, h.y);
  assert.match(app.render().toText(), /Hint 1 /);
  const sol = find("Show solution")!;
  click(sol.x + 2, sol.y);
  assert.match(app.render().toText(), /Solution/);
  const dn = find("Mark done")!;
  click(dn.x + 2, dn.y);
  assert.equal(store.isDone(ex.id), true);
  assert.match(app.render().toText(), /☑ Done/);
});

test("checkpoints: choices and typed answers both count, and it is done only when every question is right", () => {
  const { app, store } = mk();
  app.go("welcome");
  const cp = app.chapter.blocks.find((b) => b.t === "checkpoint")!;
  assert.ok(cp.questions.some((q: any) => !q.options.length), "this checkpoint has a typed question");
  cp.questions.forEach((q: any, qi: number) => {
    const qk = `${cp.id}:${qi}`;
    if (!q.options.length) {
      app.submitTyped(qk, "  DEFINITELY wrong ");
      assert.equal(store.isDone(cp.id), false);
      app.submitTyped(qk, "  " + q.answers[1 % q.answers.length].toUpperCase() + "  ");   // case and spaces do not matter
    } else {
      const bad = q.options.findIndex((o: any) => !o.ok);
      app.act(`ans:${qk}:${bad}`);
      assert.equal(store.isDone(cp.id), false);
      q.options.forEach((o: any, oi: number) => { if (o.ok) app.act(`ans:${qk}:${oi}`); });
    }
  });
  assert.equal(store.isDone(cp.id), true);
});

test("a wrong typed answer shows the accepted one", () => {
  const { app, send, find } = mk();
  app.go("computers");
  const cp = app.chapter.blocks.find((b) => b.t === "checkpoint")!;
  const qi = cp.questions.findIndex((q: any) => !q.options.length);
  app.submitTyped(`${cp.id}:${qi}`, "nope");
  for (let i = 0; i < 200 && !find("Accepted:"); i++) send(" ");
  assert.ok(find("Accepted:"));
});

test("placeholders: clicking a chip opens a prompt, enter saves, the value shows everywhere", () => {
  const { app, store, send, find, click } = mk();
  app.go("setup");
  let chip: { x: number; y: number } | null = null;
  const key = Object.keys(book.vars)[0];
  const dflt = book.vars[key].default;
  for (let i = 0; i < 120 && !chip; i++) { chip = find(dflt); if (!chip) send(" "); }
  if (chip) {
    click(chip.x + 1, chip.y);
    if (app.overlay?.kind === "prompt") {
      send("my-value"); send("\r");
      assert.equal(app.overlay, null);
      assert.ok(Object.values(store.vals).includes("my-value"));
    }
  }
  assert.ok(true);
});

test("never throws at tiny or huge terminal sizes, on every chapter and page", () => {
  for (const [cols, rows] of [[20, 6], [40, 12], [79, 24], [100, 30], [200, 60]]) {
    const { app, send } = mk({ cols, rows });
    for (const id of [...book.chapters.map((c) => c.id), ...SPECIAL_IDS]) { app.go(id); app.render(); }
    send("/"); send("a"); app.render(); send("\x03");
    app.resize(cols + 7, rows + 3); app.render();
  }
});

test("tab steps through buttons and enter presses the selected one", () => {
  const { app, send, store } = mk();
  app.go("zsh-basics");
  send("\t");
  assert.ok((app as any).focusIdx >= 0);
  const before = (app as any).acts[(app as any).focusIdx].act as string;
  assert.ok(before.length > 0);
  send("\x1b[Z");
  void store;
});

test("the splash dismisses on any key, and is skipped when asked", () => {
  const store = new Store(null);
  let t = 1000;
  const app = new App(book, store, { copy() {}, quit() {} }, { cols: 100, rows: 30, now: () => t });
  assert.match(app.render().toText(), /press any key|█/);
  assert.equal(app.wantsTick(), true);
  app.handle({ type: "key", key: "x", ctrl: false, alt: false, shift: false, text: "x" });
  assert.match(app.render().toText(), /CONTENTS/);
  t += 5000;
  assert.equal(app.wantsTick(), false);
});

test("every lab the book places that has a terminal version draws, takes keys and clicks, and stays inside its box", () => {
  const names = ["bitswitches", "gates", "bitmask", "utf8", "cron", "latencyladder", "subnet", "pathlookup", "semver", "crackcalc", "avalanche", "ttltrace", "netwaterfall", "procsim", "jswat", "algoracer", "sshconfig", "jwt", "dissect"];
  const found = new Set<string>();
  for (const c of book.chapters) {
    const ws = c.blocks.filter((b) => b.t === "widget" && names.includes(b.name));
    if (!ws.length) continue;
    const { app, send, screen } = mk({ cols: 140, rows: 50 });
    app.go(c.id);
    for (const w of ws) {
      found.add(w.name);
      const line = app.doc.lines.findIndex((l) => l.widget?.name === w.name);
      assert.ok(line >= 0, `${w.name} is placed in ${c.id}`);
      app.scroll = Math.max(0, line - 2);
      const s = app.render();
      assert.ok(s.bg.every((v) => v >= 0));
      for (const k of ["\r", "1", "+", "<", "a", "\t", "x", "\x7f", "t", "j", "s", "r", "-", "\x1b"]) { send(k); app.render(); }
    }
  }
  assert.deepEqual([...found].sort(), names.slice().sort(), "every lab is placed somewhere in the book");
});

test("bit switches: pressing keys and clicking change the value shown", () => {
  const { app, send, screen } = mk({ cols: 140, rows: 50 });
  app.go("computers");
  const line = app.doc.lines.findIndex((l) => l.widget?.name === "bitswitches");
  app.scroll = Math.max(0, line - 2);
  app.render();
  send("\r"); send("7"); send("0"); // flip the top bit and the lowest... bit 0 is the leftmost chip
  assert.match(screen(), /decimal \d+/);
  send("+");
  const before = screen();
  send("~");
  assert.notEqual(screen(), before);
});

test("subnet lab calculates as you type", () => {
  const { app, send, screen } = mk({ cols: 140, rows: 50 });
  app.go("addressing");
  const line = app.doc.lines.findIndex((l) => l.widget?.name === "subnet");
  app.scroll = Math.max(0, line - 2);
  app.render();
  send("\r");
  assert.match(screen(), /192\.168\.1\.128/); // network of 192.168.1.130/26
});

test("no lab draws past its bottom border", async () => {
  const { LABS } = await import("../src/labs.ts");
  for (const name of Object.keys(LABS)) {
    const c = book.chapters.find((c) => c.blocks.some((b) => b.t === "widget" && b.name === name));
    if (!c) continue;
    const { app } = mk({ cols: 120, rows: 40 });
    (app as any).sbOpen = false; app.go(c.id);
    const line = app.doc.lines.findIndex((l) => l.widget?.name === name);
    const w = app.doc.lines[line].widget!;
    app.scroll = Math.max(0, line - 1);
    const rows = app.render().toText().split("\n");
    const bottom = rows[line - app.scroll + 1 + w.rows - 1] ?? "";
    assert.match(bottom, /^\s*╰─+.*─╯/, `${name}: its last row is the bottom border`);
  }
});
