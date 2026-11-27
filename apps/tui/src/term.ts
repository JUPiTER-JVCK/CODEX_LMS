// The real terminal: raw mode, alternate screen, mouse, and putting everything back on exit.

import { InputParser, type InputEvent } from "./input.ts";
import { detectColorMode, type ColorMode } from "./theme.ts";
import { StringDecoder } from "node:string_decoder";

// \x1b[22;0t / \x1b[23;0t save and restore the window title, so quitting does not leave "CODEX_LMS" in the tab.
const ENTER = "\x1b[22;0t\x1b[?1049h\x1b[?25l\x1b[?7l\x1b[?2004h\x1b[?1004h";
const MOUSE_ON = "\x1b[?1000h\x1b[?1002h\x1b[?1003h\x1b[?1006h";
const MOUSE_OFF = "\x1b[?1006l\x1b[?1003l\x1b[?1002l\x1b[?1000l";
const LEAVE = "\x1b[0m\x1b[?1004l\x1b[?2004l\x1b[?7h\x1b[?25h\x1b[?1049l\x1b[23;0t";

export interface TermOptions { mouse: boolean; title?: string }

export class Term {
  readonly out: NodeJS.WriteStream;
  readonly inp: NodeJS.ReadStream;
  colorMode: ColorMode;
  private parser = new InputParser();
  private decoder = new StringDecoder("utf8");
  private handlers: ((e: InputEvent) => void)[] = [];
  private resizeHandlers: (() => void)[] = [];
  private escTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private opts: TermOptions = { mouse: true };

  constructor(out: NodeJS.WriteStream = process.stdout, inp: NodeJS.ReadStream = process.stdin) {
    this.out = out;
    this.inp = inp;
    this.colorMode = detectColorMode(process.env, !!out.isTTY);
  }

  get cols(): number { return this.out.columns || 80; }
  get rows(): number { return this.out.rows || 24; }

  on(cb: (e: InputEvent) => void) { this.handlers.push(cb); }
  onResize(cb: () => void) { this.resizeHandlers.push(cb); }
  write(s: string) { if (s) this.out.write(s); }

  private emit(evs: InputEvent[]) { for (const e of evs) for (const h of this.handlers) h(e); }

  private onData = (d: Buffer | string) => {
    const text = typeof d === "string" ? d : this.decoder.write(d);
    if (this.escTimer) { clearTimeout(this.escTimer); this.escTimer = null; }
    this.emit(this.parser.feed(text));
    this.escTimer = setTimeout(() => { this.escTimer = null; this.emit(this.parser.flushPending()); }, 25);
  };
  private onResizeEv = () => { for (const h of this.resizeHandlers) h(); };
  private cleanup = () => { this.stop(); };
  private onSignal = () => { this.stop(); process.exit(130); };
  private onCrash = (err: unknown) => {
    this.stop();
    process.stderr.write(`\ncodex-lms crashed: ${err instanceof Error ? err.stack || err.message : String(err)}\n`);
    process.exit(1);
  };

  start(opts: TermOptions) {
    if (this.started) return;
    this.started = true;
    this.opts = opts;
    if (this.inp.isTTY) this.inp.setRawMode(true);
    this.inp.resume();
    this.inp.on("data", this.onData);
    this.out.on("resize", this.onResizeEv);
    this.write(ENTER + (opts.mouse ? MOUSE_ON : ""));
    if (opts.title) this.write(`\x1b]0;${opts.title}\x07`);
    process.once("exit", this.cleanup);
    for (const s of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.once(s, this.onSignal);
    process.once("uncaughtException", this.onCrash);
    process.once("unhandledRejection", this.onCrash);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    if (this.escTimer) clearTimeout(this.escTimer);
    this.inp.off("data", this.onData);
    this.out.off("resize", this.onResizeEv);
    try { if (this.inp.isTTY) this.inp.setRawMode(false); } catch { /* already closed */ }
    this.inp.pause();
    // Write synchronously enough that the shell prompt comes back clean.
    this.out.write((this.opts.mouse ? MOUSE_OFF : "") + LEAVE);
  }

  /** Copy text to the system clipboard through the terminal (OSC 52); works in iTerm2, kitty, WezTerm, Ghostty, tmux, ssh. */
  copy(text: string) {
    this.write(`\x1b]52;c;${Buffer.from(text, "utf8").toString("base64")}\x07`);
  }

  /** Ask the terminal for its background colour (OSC 11); resolves null when it does not answer. */
  queryBackground(timeoutMs = 150): Promise<string | null> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: string | null) => { if (done) return; done = true; clearTimeout(t); this.handlers = this.handlers.filter((h) => h !== h2); resolve(v); };
      const h2 = (e: InputEvent) => { if (e.type === "osc" && e.num === 11) finish(e.data); };
      const t = setTimeout(() => finish(null), timeoutMs);
      this.handlers.push(h2);
      this.write("\x1b]11;?\x1b\\");
    });
  }
}
