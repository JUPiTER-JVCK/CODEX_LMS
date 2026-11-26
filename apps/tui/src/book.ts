// The book as the page sees it: chapters, parts, placeholder values, a search index. Read from the built page.

export interface Block { t: string; [k: string]: any }
export interface Term { term: string; def: string }
export interface Chapter {
  id: string; title: string; sub: string; part: string; num: number; time: number; level: string;
  goals: string[]; blocks: Block[]; terms: Term[]; file: string;
}
export interface VarDef { g?: string; label: string; default: string; desc?: string }
export interface Book {
  chapters: Chapter[];
  byId: Map<string, Chapter>;
  parts: { id: string; title: string }[];
  vars: Record<string, VarDef>;
  groups: { id: string; label: string }[];
  missions: any[];
}

const DEFAULT_PARTS: [string, string][] = [
  ["start", "Start here"], ["found", "Foundations"], ["code", "Learn to Code"], ["zsh", "The shell (zsh)"], ["net", "Networking"], ["py", "Python"],
  ["web", "Web development"], ["srv", "Servers, APIs & Cloud"], ["sec", "Security"], ["proj", "Projects"], ["ref", "Reference"],
];

export const slug = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Anchor id of a block, the same rule the page uses for its links. */
export function anchorOf(b: Block): string | undefined {
  if (b.t === "h") return b.id;
  if (b.t === "cmd") return b.id ? "cmd-" + b.id : "cmd-" + slug(b.name);
  if (b.t === "exercise" || b.t === "checkpoint" || b.t === "project") return b.id;
  return undefined;
}

/** Ids that progress is stored under (same as itemIds() in the page engine). */
export function itemIds(c: Chapter): string[] {
  const ids: string[] = [];
  for (const b of c.blocks) {
    if (b.t === "exercise" || b.t === "checkpoint") ids.push(b.id);
    else if (b.t === "project") {
      const n = (b.blocks as Block[]).filter((x) => x.t === "h" && x.level === 3).length;
      for (let i = 0; i < n; i++) ids.push(b.id + "#" + i);
    }
  }
  return ids;
}

/** Pull window.__BOOK (and the part list) out of the built page, or accept plain book JSON. */
export function parseBook(source: string): Book {
  let raw: any;
  let parts = DEFAULT_PARTS;
  const head = source.trimStart()[0];
  if (head === "{") raw = JSON.parse(source);
  else {
    const a = source.indexOf("window.__BOOK=");
    if (a < 0) throw new Error("this file does not contain the book (no window.__BOOK)");
    const start = a + "window.__BOOK=".length;
    const end = source.indexOf(";</script>", start);
    raw = JSON.parse(source.slice(start, end < 0 ? undefined : end));
    const pm = /var PARTS = (\[\[.*?\]\]);/.exec(source);
    if (pm) { try { parts = JSON.parse(pm[1].replace(/'/g, '"')); } catch { /* keep defaults */ } }
  }
  const chapters: Chapter[] = [...raw.chapters].sort((a: any, b: any) => (a.file || "").localeCompare(b.file || ""));
  chapters.forEach((c, i) => { c.num = i; c.terms = c.terms || []; c.goals = c.goals || []; });
  const vars: Record<string, VarDef> = { ...(raw.vars?.vars || {}) };
  for (const c of chapters) for (const b of c.blocks) if (b.t === "var" && !vars[b.key]) vars[b.key] = { label: b.key, default: b.default || "", desc: b.desc || "" };
  return {
    chapters, byId: new Map(chapters.map((c) => [c.id, c])),
    parts: parts.map(([id, title]) => ({ id, title })), vars, groups: raw.vars?.groups || [], missions: raw.missions || [],
  };
}

// ---------- search ----------

export interface Entry {
  kind: "chapter" | "section" | "cmd" | "term" | "exercise";
  title: string; detail: string; route: string; chapter: string; hay: string; weight: number;
}

export function buildIndex(book: Book): Entry[] {
  const out: Entry[] = [];
  const add = (kind: Entry["kind"], title: string, detail: string, route: string, chapter: string, weight: number, extra = "") =>
    out.push({ kind, title, detail, route, chapter, weight, hay: (title + " " + detail + " " + extra).toLowerCase() });
  for (const c of book.chapters) {
    add("chapter", c.title, c.sub, c.id, c.id, 40, c.goals.join(" "));
    for (const b of c.blocks) {
      if (b.t === "h" && b.level === 2) add("section", b.text, c.title, c.id + "#" + b.id, c.id, 25);
      else if (b.t === "cmd") add("cmd", b.name, b.sum || "", c.id + "#" + anchorOf(b), c.id, 18, (b.syntax || "") + " " + (b.tags || []).join(" ") + " " + (b.cat || ""));
      else if (b.t === "exercise") add("exercise", b.title, c.title, c.id + "#" + b.id, c.id, 8);
    }
    for (const t of c.terms) add("term", t.term, t.def, c.id, c.id, 10);
  }
  return out;
}

/** All words must appear; titles that start with or contain the words rank first. */
export function search(index: Entry[], query: string, limit = 80): Entry[] {
  const toks = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const scored: [number, Entry][] = [];
  for (const e of index) {
    let s = e.weight;
    let ok = true;
    const t = e.title.toLowerCase();
    for (const k of toks) {
      if (t.startsWith(k)) s += 100;
      else if (new RegExp("\\b" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(t)) s += 70;
      else if (t.includes(k)) s += 50;
      else if (e.hay.includes(k)) s += 12;
      else { ok = false; break; }
    }
    if (!ok && toks.length === 1 && toks[0].length >= 3) { // loose fallback: letters in order inside the title
      let i = 0;
      for (const ch of t) if (ch === toks[0][i]) i++;
      if (i === toks[0].length) { ok = true; s = e.weight; }
    }
    if (ok) scored.push([s - Math.min(20, e.title.length / 4), e]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map((x) => x[1]);
}
