import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBook } from "../src/book.ts";
import { App } from "../src/app.ts";
import { Store } from "../src/state.ts";
import { Screen } from "../src/screen.ts";
import { InputParser } from "../src/input.ts";
import { cpWidth } from "../src/text.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const book = parseBook(fs.readFileSync(path.join(root, "dist/index.html"), "utf8"));

/** A minimal terminal: cursor positioning and printing with real cell widths. Enough to replay our own output. */
class MiniTerm {
  cells: string[][];
  x = 0; y = 0;
  constructor(readonly w: number, readonly h: number) { this.cells = Array.from({ length: h }, () => Array(w).fill(" ")); }
  feed(s: string) {
    for (let i = 0; i < s.length;) {
      if (s[i] === "\x1b") {
        const m = /^\x1b\[([0-9;]*)([A-Za-z])/.exec(s.slice(i, i + 64));
        if (!m) throw new Error("bad escape at " + i);
        if (m[2] === "H") { const [r, c] = m[1].split(";").map(Number); this.y = r - 1; this.x = c - 1; }
        else if (m[2] !== "m") throw new Error("unexpected CSI " + m[0]);
        i += m[0].length;
        continue;
      }
      const cp = s.codePointAt(i)!; const ch = String.fromCodePoint(cp); i += ch.length;
      const cw = cpWidth(cp);
      if (cw === 0) continue;
      if (this.x + cw > this.w) continue; // autowrap is off: output past the edge is dropped
      this.cells[this.y][this.x] = ch;
      if (cw === 2) this.cells[this.y][this.x + 1] = "";
      this.x += cw;
    }
  }
  text() { return this.cells.map((r) => r.join("").replace(/\s+$/, "")).join("\n"); }
}

test("replaying every diff reproduces every frame, through a long real session (wide glyphs included)", () => {
  const w = 120, h = 36;
  const app = new App(book, new Store(null), { copy() {}, quit() {} }, { cols: w, rows: h, splash: false, theme: "dark" });
  const parser = new InputParser();
  const term = new MiniTerm(w, h);
  let prev: Screen | null = null;
  const step = (what: string) => {
    const scr = app.render();
    term.feed(scr.diff(prev, "truecolor"));
    prev = scr;
    assert.equal(term.text(), scr.toText(), "after: " + what);
  };
  const send = (raw: string, what = JSON.stringify(raw)) => { for (const e of parser.feed(raw)) app.handle(e); step(what); };
  step("first frame");
  const session = [" ", " ", "j", "n", "n", "/", "net", "\x1b[B", "\r", "G", "g", "t", "t", "b", "b", "e", "e", "\t", "\t", "\x1b[<65;60;20M", "\x1b[<65;60;20M",
    "p", "[", "]", "?", " ", "n", "n", "n", "/", "漢", "\x7f", "bit", "\r", "s", "j", "j", "\r"];
  for (const k of session) send(k);
  for (const id of ["glossary", "atlas", "values", "practice", "crypto", "apis"]) { app.go(id); step("go " + id); for (let i = 0; i < 6; i++) send(" "); }
});
