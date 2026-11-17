// Connects the app to the real terminal: render loop, clipboard, theme detection, clean exit.

import { spawn } from "node:child_process";
import type { Book } from "./book.ts";
import { App } from "./app.ts";
import { backgroundIsDark } from "./input.ts";
import type { Screen } from "./screen.ts";
import { Store, statePath } from "./state.ts";
import { Term } from "./term.ts";

export interface RunOptions { theme?: string; mouse: boolean; splash: boolean; state?: string }

/** Copy through whatever the machine offers; OSC 52 is the fallback that works over ssh. */
function clipboard(term: Term, text: string) {
  const tryCmd = (cmd: string, args: string[]) => {
    try {
      const c = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
      c.on("error", () => term.copy(text));
      c.stdin.on("error", () => {});
      c.stdin.end(text);
      return true;
    } catch { return false; }
  };
  if (process.platform === "darwin" && !process.env.SSH_TTY) { if (tryCmd("pbcopy", [])) return; }
  else if (process.platform === "linux" && !process.env.SSH_TTY) {
    if (process.env.WAYLAND_DISPLAY && tryCmd("wl-copy", [])) return;
    if (process.env.DISPLAY && tryCmd("xclip", ["-selection", "clipboard"])) return;
  }
  term.copy(text);
}

export async function runInteractive(book: Book, o: RunOptions): Promise<number> {
  const term = new Term();
  if (!term.out.isTTY || !term.inp.isTTY) {
    process.stderr.write("codex-lms: this needs an interactive terminal. Try --list, or --dump <chapter> to print one.\n");
    return 1;
  }
  const store = new Store(o.state ?? statePath());
  let quitting = false;
  const app = new App(book, store, { copy: (t) => clipboard(term, t), quit: () => quit() }, {
    cols: term.cols, rows: term.rows, theme: o.theme, splash: o.splash,
  });
  const quit = () => {
    if (quitting) return;
    quitting = true;
    store.flush();
    term.stop();
    process.exit(0);
  };

  term.start({ mouse: o.mouse, title: "CODEX_LMS" });
  let prev: Screen | null = null;
  let queued = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const draw = (full = false) => {
    queued = false;
    if (quitting) return;
    if (full) prev = null;
    if (app.cols !== term.cols || app.rows !== term.rows) { app.resize(term.cols, term.rows); prev = null; }
    const scr = app.render();
    const out = scr.diff(prev, term.colorMode);
    prev = scr;
    if (out) term.write("\x1b[?2026h" + out + "\x1b[?2026l");
    if (timer) clearTimeout(timer);
    timer = null;
    if (app.wantsTick()) timer = setTimeout(() => draw(), 33);
  };
  const request = () => { if (!queued) { queued = true; setImmediate(() => draw()); } };

  term.on((e) => { app.handle(e); request(); });
  term.onResize(() => { app.resize(term.cols, term.rows); draw(true); });
  process.on("SIGCONT", () => draw(true));
  draw(true);

  // Ask the terminal whether it is dark or light, so "System" means something here too.
  if (!o.theme || o.theme === "system") {
    term.queryBackground().then((data) => {
      const dark = data ? backgroundIsDark(data) : null;
      if (dark !== null && dark !== app.sysDark) { app.sysDark = dark; request(); }
    });
  }
  return new Promise<number>(() => { /* runs until quit() exits the process */ });
}
