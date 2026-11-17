// Entry point: `codex-lms [options]`. Reads the book from the built page (dist/index.html or the bundled file).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBook, type Book } from "./book.ts";
import { layoutChapter, newUi, type Doc } from "./blocks.ts";
import { spansText } from "./text.ts";
import { runInteractive } from "./run.ts";

export const VERSION = "0.1.0";

export const HELP = `CODEX_LMS, the course in your terminal

usage: codex-lms [options]

  --book FILE        the built page to read the book from (default: dist/index.html or the file this runs from)
  --theme NAME       dark | light | system
  --no-mouse         do not turn on mouse reporting
  --no-splash        skip the animated title
  --list             print the chapters and exit
  --dump ID          print one chapter (or "all") as plain text and exit
  --width N          line width for --dump (default 100)
  --open IDS         with --dump: command cards to expand, comma separated, or "all"
  --version, --help

keys: / search   ↑↓ scroll   n p chapters   t theme   b sidebar   ? help   q quit`;

export interface Args {
  book?: string; theme?: string; mouse: boolean; splash: boolean; list: boolean; dump?: string; width: number; open?: string; version: boolean; help: boolean; state?: string;
}

export function parseArgs(argv: string[]): Args {
  const a: Args = { mouse: true, splash: true, list: false, width: 100, version: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const val = () => argv[++i];
    if (k === "--book") a.book = val();
    else if (k === "--theme") a.theme = val();
    else if (k === "--no-mouse") a.mouse = false;
    else if (k === "--no-splash") a.splash = false;
    else if (k === "--list") a.list = true;
    else if (k === "--dump") a.dump = val();
    else if (k === "--width") a.width = Number(val()) || 100;
    else if (k === "--open") a.open = val();
    else if (k === "--state") a.state = val();
    else if (k === "--version" || k === "-v") a.version = true;
    else if (k === "--help" || k === "-h") a.help = true;
    else if (!k.startsWith("-") && !a.book) a.book = k;
    else throw new Error(`unknown option ${k} (try --help)`);
  }
  return a;
}

/** Where the page lives: --book, $CODEX_LMS_BOOK, text handed over by the bundle, or dist/index.html next to the sources. */
export function readBookSource(args: Args): string {
  const g = globalThis as { __CODEX_BOOK_HTML?: string };
  if (g.__CODEX_BOOK_HTML) return g.__CODEX_BOOK_HTML;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const tries = [args.book, process.env.CODEX_LMS_BOOK, path.resolve(here, "../../../dist/index.html"), path.resolve(here, "index.html"), path.resolve(here, "../index.html")].filter(Boolean) as string[];
  for (const t of tries) { try { return fs.readFileSync(t, "utf8"); } catch { /* next */ } }
  throw new Error("cannot find the book: pass --book path/to/index.html (run python3 tools/build.py to create dist/index.html)");
}

export function docToText(doc: Doc): string {
  return doc.lines.map((l) => spansText(l.spans).replace(/\s+$/, "")).join("\n");
}

export function dumpChapter(book: Book, id: string, width: number, open?: string): string {
  const out: string[] = [];
  const ids = id === "all" ? book.chapters.map((c) => c.id) : [id];
  for (const cid of ids) {
    const c = book.byId.get(cid);
    if (!c) throw new Error(`no chapter "${cid}" (try --list)`);
    const ui = newUi();
    if (open) for (const b of c.blocks) if (b.t === "cmd" && (open === "all" || open.split(",").includes(b.id || ""))) ui.open["cmd-" + (b.id || b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))] = true;
    const i = book.chapters.indexOf(c);
    const doc = layoutChapter(c, {
      width, vars: (k) => book.vars[k]?.default ?? k, ui, isDone: () => false, labRows: () => undefined,
      prev: book.chapters[i - 1] && { id: book.chapters[i - 1].id, title: book.chapters[i - 1].title },
      next: book.chapters[i + 1] && { id: book.chapters[i + 1].id, title: book.chapters[i + 1].title },
      partTitle: book.parts.find((p) => p.id === c.part)?.title,
    });
    out.push(docToText(doc));
  }
  return out.join("\n\n");
}

export async function main(argv: string[]): Promise<number> {
  let args: Args;
  try { args = parseArgs(argv); } catch (e) { process.stderr.write(`codex-lms: ${(e as Error).message}\n`); return 2; }
  if (args.help) { process.stdout.write(HELP + "\n"); return 0; }
  if (args.version) { process.stdout.write(`codex-lms ${VERSION}\n`); return 0; }
  let book: Book;
  try { book = parseBook(readBookSource(args)); } catch (e) { process.stderr.write(`codex-lms: ${(e as Error).message}\n`); return 1; }
  if (args.list) {
    for (const c of book.chapters) process.stdout.write(`${String(c.num).padStart(2)}  ${c.id.padEnd(14)} ${c.title}\n`);
    return 0;
  }
  if (args.dump) {
    try { process.stdout.write(dumpChapter(book, args.dump, args.width, args.open) + "\n"); } catch (e) { process.stderr.write(`codex-lms: ${(e as Error).message}\n`); return 1; }
    return 0;
  }
  return runInteractive(book, { theme: args.theme, mouse: args.mouse, splash: args.splash, state: args.state });
}

const self = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (self === fileURLToPath(import.meta.url) || /codex-tui\.mjs$/.test(self)) main(process.argv.slice(2)).then((c) => process.exit(c));
