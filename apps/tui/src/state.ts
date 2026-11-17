// Saved progress. Same file and same fields as the Mac app (state.json), so they share your place.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function statePath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.CODEX_LMS_STATE) return env.CODEX_LMS_STATE;
  const home = os.homedir();
  if (process.platform === "darwin") return path.join(home, "Library", "Application Support", "CODEX_LMS", "state.json");
  return path.join(env.XDG_DATA_HOME || path.join(home, ".local", "share"), "CODEX_LMS", "state.json");
}

export class Store {
  vals: Record<string, any> = {};
  done: Record<string, any> = {};
  theme = "";
  last = "";
  private raw: Record<string, any> = {};
  private timer: ReturnType<typeof setTimeout> | null = null;
  readonly file: string | null;

  /** `file` null keeps everything in memory (tests, read-only media). */
  constructor(file: string | null = statePath()) {
    this.file = file;
    if (!file) return;
    try {
      const j = JSON.parse(fs.readFileSync(file, "utf8"));
      if (j && typeof j === "object") {
        this.raw = j;
        this.vals = j.vals && typeof j.vals === "object" ? j.vals : {};
        this.done = j.done && typeof j.done === "object" ? j.done : {};
        this.theme = typeof j.theme === "string" ? j.theme : "";
        this.last = typeof j.last === "string" ? j.last : "";
      }
    } catch { /* first run, or unreadable: start fresh */ }
  }

  isDone(id: string) { return this.done[id] !== undefined && this.done[id] !== false; }

  mark(id: string, on: boolean) {
    if (on) this.done[id] = 1; else delete this.done[id];
    this.save();
  }

  setVal(key: string, v: string, dflt: string) {
    if (v === "" || v === dflt) delete this.vals[key]; else this.vals[key] = v;
    this.save();
  }

  /** Debounced write; unknown fields written by other versions are kept. */
  save() {
    if (!this.file) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
    this.timer.unref?.();
  }

  flush() {
    if (!this.file) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const data = { ...this.raw, vals: this.vals, done: this.done, theme: this.theme, last: this.last };
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + "." + process.pid + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(data));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      process.stderr.write(`codex-lms: could not save progress (${(e as Error).message})\n`);
    }
  }
}
