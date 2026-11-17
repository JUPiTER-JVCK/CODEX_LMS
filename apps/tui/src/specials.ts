// The four generated pages (Command Atlas, Practice Hub, Glossary, My Values), built from the book as ordinary blocks.

import { anchorOf, itemIds, type Block, type Book, type Chapter } from "./book.ts";
import type { Store } from "./state.ts";

export const SPECIAL_IDS = ["practice", "atlas", "glossary", "values"];
export const SPECIAL_TITLES: Record<string, { title: string; sub: string }> = {
  atlas: { title: "Command Atlas", sub: "Every command in the book, grouped by purpose" },
  practice: { title: "Practice Hub", sub: "Exercises, checkpoints and projects, with what you have finished" },
  glossary: { title: "Glossary", sub: "Every term, one line each" },
  values: { title: "My Values", sub: "Set the placeholders once; every command in the book uses them" },
};

const base = (id: string, blocks: Block[]): Chapter => ({
  id, title: SPECIAL_TITLES[id].title, sub: SPECIAL_TITLES[id].sub, part: "ref", num: -1, time: 0, level: "", goals: [], terms: [], file: "~" + id, blocks,
});

export function buildSpecial(book: Book, store: Store, id: string): Chapter | undefined {
  const blocks: Block[] = [];
  if (id === "atlas") {
    const by = new Map<string, { name: string; sum: string; route: string }[]>();
    let n = 0;
    for (const c of book.chapters) for (const b of c.blocks) if (b.t === "cmd") {
      const cat = b.cat || "other";
      if (!by.has(cat)) by.set(cat, []);
      by.get(cat)!.push({ name: b.name, sum: b.sum || "", route: c.id + "#" + anchorOf(b) });
      n++;
    }
    blocks.push({ t: "p", text: `${n} commands. Select one to open its card in the chapter that teaches it.` });
    for (const [cat, list] of [...by].sort((a, b) => a[0].localeCompare(b[0]))) {
      blocks.push({ t: "h", level: 2, text: cat, id: "cat-" + cat });
      for (const x of list.sort((a, b) => a.name.localeCompare(b.name))) blocks.push({ t: "link", left: x.name, right: x.sum, route: x.route });
    }
  } else if (id === "glossary") {
    const all = book.chapters.flatMap((c) => c.terms.map((t) => ({ ...t, route: c.id }))).sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()));
    blocks.push({ t: "p", text: `${all.length} terms. Select one to jump to the chapter that defines it.` });
    let letter = "";
    for (const t of all) {
      const l = (t.term[0] || "#").toUpperCase();
      if (l !== letter) { letter = l; blocks.push({ t: "h", level: 2, text: l, id: "g-" + l }); }
      blocks.push({ t: "link", left: t.term, right: t.def, route: t.route });
    }
  } else if (id === "values") {
    blocks.push({ t: "p", text: "Select a value to change it. Commands throughout the book show your value in place of the yellow placeholder, and the Mac app and the page share it." });
    const groups = book.groups.length ? book.groups : [{ id: "", label: "Values" }];
    for (const g of groups) {
      const keys = Object.keys(book.vars).filter((k) => (book.vars[k].g ?? "") === g.id);
      if (!keys.length) continue;
      blocks.push({ t: "h", level: 2, text: g.label, id: "v-" + g.id });
      for (const k of keys) blocks.push({ t: "var", key: k, desc: `${book.vars[k].label}. ${book.vars[k].desc || ""}` });
    }
  } else if (id === "practice") {
    let total = 0, done = 0;
    const per: { c: Chapter; items: Block[] }[] = [];
    for (const c of book.chapters) {
      const items = c.blocks.filter((b) => b.t === "exercise" || b.t === "checkpoint" || b.t === "project");
      if (!items.length) continue;
      per.push({ c, items });
      for (const i of itemIds(c)) { total++; if (store.isDone(i)) done++; }
    }
    blocks.push({ t: "p", text: `${done} of ${total} practice items done. Select an item to open it.` });
    for (const { c, items } of per) {
      blocks.push({ t: "h", level: 2, text: `${String(c.num).padStart(2, "0")}  ${c.title}`, id: "p-" + c.id });
      for (const b of items) {
        const ok = b.t === "project" ? itemIds({ ...c, blocks: [b] }).every((i) => store.isDone(i)) : store.isDone(b.id);
        blocks.push({ t: "link", left: `${ok ? "☑" : "☐"} ${b.title}`, right: b.t, route: c.id + "#" + b.id });
      }
    }
  } else return undefined;
  return base(id, blocks);
}
