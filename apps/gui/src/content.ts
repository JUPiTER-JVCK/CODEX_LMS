export interface ChapterMeta {
  id: string; title: string; sub: string; part: string; time: number | null; level: string | null;
  goals: string[]; blocks: number; exercises: number; commands: number;
}
export interface Outline { parts: [string, string][]; chapters: ChapterMeta[] }
export interface Block { t: string; [k: string]: any }
export interface Chapter extends Omit<ChapterMeta, "blocks" | "exercises" | "commands"> { blocks: Block[]; terms?: { term: string; def: string }[] }

import outlineJson from "../../../content/outline.json";
export const outline = outlineJson as unknown as Outline;

// One lazy chunk per chapter: the reader only downloads what it opens.
const loaders = import.meta.glob("../../../content/chapters/*.json", { import: "default" }) as Record<string, () => Promise<Chapter>>;
export function loadChapter(id: string): Promise<Chapter> {
  const key = Object.keys(loaders).find((k) => k.endsWith(`/${id}.json`));
  if (!key) return Promise.reject(new Error("unknown chapter " + id));
  return loaders[key]();
}
