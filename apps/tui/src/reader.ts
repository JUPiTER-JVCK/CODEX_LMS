import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../content");
export interface ChapterMeta { id: string; title: string; sub: string; part: string; time: number | null; level: string | null; goals: string[]; commands: number; exercises: number }
export interface Outline { parts: [string, string][]; chapters: ChapterMeta[] }
export const outline: Outline = JSON.parse(readFileSync(path.join(ROOT, "outline.json"), "utf8"));
export const loadChapter = (id: string): { blocks: any[] } => JSON.parse(readFileSync(path.join(ROOT, "chapters", id + ".json"), "utf8"));

/** A styled run of text. */
export interface Seg { t: string; bold?: boolean; dim?: boolean; color?: "accent" | "accent2" | "good" | "warn" | "muted" }
export type Line = Seg[];

function inline(text: string, base: Omit<Seg, "t"> = {}): Seg[] {
  const clean = String(text ?? "").replace(/\{\{(\w+)\}\}/g, "$1");
  return clean.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).filter(Boolean).map((p) =>
    p.startsWith("`") ? { ...base, t: p.slice(1, -1), color: "accent2" as const }
    : p.startsWith("**") ? { ...base, t: p.slice(2, -2), bold: true }
    : p.length > 2 && p.startsWith("*") && p.endsWith("*") ? { ...base, t: p.slice(1, -1), color: "accent" as const }
    : { ...base, t: p });
}

/** Greedy word wrap that keeps segment styles. */
export function wrap(segs: Seg[], width: number, indent = ""): Line[] {
  const out: Line[] = [];
  let line: Line = [], len = 0;
  const push = () => { out.push(line); line = indent ? [{ t: indent }] : []; len = indent.length; };
  if (indent) { line = [{ t: indent }]; len = indent.length; }
  for (const s of segs) {
    for (const w of s.t.split(/(\s+)/)) {
      if (!w) continue;
      if (/^\s+$/.test(w)) { if (len > indent.length) { line.push({ ...s, t: " " }); len++; } continue; }
      if (len + w.length > width && len > indent.length) push();
      for (let i = 0; i < w.length; i += width - indent.length) {
        const piece = w.slice(i, i + width - indent.length);
        if (len + piece.length > width) push();
        line.push({ ...s, t: piece }); len += piece.length;
      }
    }
  }
  if (line.length > (indent ? 1 : 0) || out.length === 0) out.push(line);
  return out;
}

const blank: Line = [];
export function renderBlocks(blocks: any[], width: number): Line[] {
  const L: Line[] = [];
  for (const b of blocks) {
    switch (b.t) {
      case "h":
        L.push(blank, [{ t: (b.level === 2 ? "▌ " : "› ") + b.text, bold: true, color: b.level === 2 ? "accent" : "accent2" }]);
        if (b.level === 2) L.push([{ t: "─".repeat(Math.min(width, b.text.length + 2)), color: "muted" }]);
        break;
      case "p": L.push(...wrap(inline(b.text), width), blank); break;
      case "ul": case "ol":
        b.items.forEach((it: any, i: number) => L.push(...wrap([{ t: (b.t === "ol" ? `${i + 1}. ` : "• "), color: "accent" }, ...inline(it.text)], width, "   ")));
        L.push(blank); break;
      case "code": {
        const art = b.lang === "ascii";
        L.push([{ t: art ? "┈ diagram ┈" : `┈ ${b.lang || "code"} ┈`, dim: true, color: "muted" }]);
        for (const l of String(b.code).split("\n")) L.push([{ t: "  " + l.slice(0, width - 2), color: art ? "accent2" : undefined }]);
        L.push(blank); break;
      }
      case "callout":
        L.push([{ t: `┃ ${String(b.title || b.kind).toUpperCase()}`, bold: true, color: b.kind === "warn" || b.kind === "warning" ? "warn" : "good" }]);
        for (const l of renderBlocks(b.blocks || [], width - 2)) L.push([{ t: "┃ ", color: "muted" }, ...l]);
        break;
      case "table":
        L.push([{ t: b.head.join("  │  "), bold: true, color: "accent" }]);
        for (const r of b.rows) L.push(...wrap(inline(r.join("  │  ")), width));
        L.push(blank); break;
      case "cmd":
        L.push([{ t: "$ " + b.name, bold: true, color: "accent2" }, { t: "  " + (b.sum ?? ""), color: "muted" }]);
        if (b.syntax) L.push([{ t: "  " + b.syntax.split("\n")[0], dim: true }]);
        L.push(blank); break;
      case "anatomy":
        L.push([{ t: b.title, bold: true, color: "accent" }]);
        for (const t of b.tokens) L.push(...wrap([{ t: "  " + String(t.tok).replace(/\{\{(\w+)\}\}/g, "$1") + "  ", color: "accent2" }, { t: t.exp, color: "muted" }], width, "    "));
        L.push(blank); break;
      case "exercise": case "checkpoint": case "project": case "widget":
        L.push([{ t: `[${b.t}] `, color: "warn" }, { t: String(b.title || b.name), bold: true }, { t: "  (open in the GUI or classic site)", dim: true }], blank);
        break;
    }
  }
  return L;
}
