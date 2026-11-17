// Turns the bytes a terminal sends into key, mouse, paste, focus and OSC events.

export interface KeyEvent {
  type: "key";
  /** "a".."z" (lower case unless shift was held for a letter), "up", "down", "enter", "escape", "tab", "backspace", "pageup", "f1"... */
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** The typed character when this key produces one (space and printable text). */
  text?: string;
}
export interface MouseEvent {
  type: "mouse";
  action: "down" | "up" | "drag" | "move" | "wheel";
  button: 0 | 1 | 2 | -1; // left, middle, right, none
  x: number; // 0-based cell
  y: number;
  dir?: -1 | 1; // wheel: -1 up/left, 1 down/right
  horizontal?: boolean; // wheel: a sideways wheel (or trackpad swipe)
  ctrl: boolean; alt: boolean; shift: boolean;
}
export interface PasteEvent { type: "paste"; text: string }
export interface FocusEvent { type: "focus"; focused: boolean }
export interface OscEvent { type: "osc"; num: number; data: string }
export type InputEvent = KeyEvent | MouseEvent | PasteEvent | FocusEvent | OscEvent;

const key = (k: string, mods = 0, text?: string): KeyEvent =>
  ({ type: "key", key: k, shift: !!(mods & 1), alt: !!(mods & 2), ctrl: !!(mods & 4), ...(text !== undefined ? { text } : {}) });

const CSI_TILDE: Record<number, string> = {
  1: "home", 2: "insert", 3: "delete", 4: "end", 5: "pageup", 6: "pagedown", 7: "home", 8: "end",
  11: "f1", 12: "f2", 13: "f3", 14: "f4", 15: "f5", 17: "f6", 18: "f7", 19: "f8", 20: "f9", 21: "f10", 23: "f11", 24: "f12",
};
const CSI_LETTER: Record<string, string> = { A: "up", B: "down", C: "right", D: "left", H: "home", F: "end", P: "f1", Q: "f2", R: "f3", S: "f4" };

/** xterm modifier parameter (1 + bits: shift=1, alt=2, ctrl=4) -> our bits. */
const modsOf = (p: number | undefined) => (p && p > 1 ? p - 1 : 0) & 7;

export class InputParser {
  private buf = "";
  private pasting: string | null = null;

  /** Feed decoded text from stdin; returns the events it completes. */
  feed(chunk: string): InputEvent[] {
    this.buf += chunk;
    const out: InputEvent[] = [];
    for (;;) {
      if (this.pasting !== null) {
        const end = this.buf.indexOf("\x1b[201~");
        if (end < 0) { this.pasting += this.buf; this.buf = ""; break; }
        this.pasting += this.buf.slice(0, end);
        this.buf = this.buf.slice(end + 6);
        out.push({ type: "paste", text: this.pasting });
        this.pasting = null;
        continue;
      }
      if (!this.buf) break;
      const n = this.one(out);
      if (n === 0) break; // incomplete sequence: wait for more bytes
      this.buf = this.buf.slice(n);
    }
    return out;
  }

  /** Call after a short pause with no input: a lone ESC is the Escape key, not the start of a sequence. */
  flushPending(): InputEvent[] {
    if (this.buf === "\x1b") { this.buf = ""; return [key("escape")]; }
    if (this.buf && this.buf[0] === "\x1b" && this.buf.length < 8 && !/[\x40-\x7e]$/.test(this.buf.slice(1))) {
      const rest = this.buf; this.buf = "";
      return [key("escape"), ...rest.slice(1).split("").map((c) => key(c, 0, c))];
    }
    return [];
  }

  /** Parse one event from the front of the buffer. Returns bytes consumed, 0 when incomplete. */
  private one(out: InputEvent[]): number {
    const s = this.buf;
    const c = s[0];
    if (c === "\x1b") {
      if (s.length === 1) return 0;
      const d = s[1];
      if (d === "[") return this.csi(out);
      if (d === "O") {
        if (s.length < 3) return 0;
        const k = CSI_LETTER[s[2]];
        out.push(key(k ?? "unknown"));
        return 3;
      }
      if (d === "]") return this.osc(out);
      if (d === "\x1b") { out.push(key("escape")); return 1; }
      // Alt + key
      const cp = s.codePointAt(1)!;
      const len = 1 + (cp > 0xffff ? 2 : 1);
      const ch = String.fromCodePoint(cp);
      const ev = this.plain(ch);
      ev.alt = true;
      out.push(ev);
      return len;
    }
    const cp = s.codePointAt(0)!;
    const len = cp > 0xffff ? 2 : 1;
    out.push(this.plain(String.fromCodePoint(cp)));
    return len;
  }

  private plain(ch: string): KeyEvent {
    const code = ch.codePointAt(0)!;
    if (ch === "\r" || ch === "\n") return key("enter");
    if (ch === "\t") return key("tab");
    if (ch === "\x7f" || ch === "\b") return key("backspace");
    if (ch === " ") return key("space", 0, " ");
    if (code === 0) return key("space", 4, " ");
    if (code >= 1 && code <= 26) return key(String.fromCharCode(96 + code), 4);
    if (code >= 28 && code <= 31) return key(String.fromCharCode(52 + code - 28), 4);
    const upper = ch !== ch.toLowerCase() && ch === ch.toUpperCase();
    return key(ch, upper ? 1 : 0, ch);
  }

  private csi(out: InputEvent[]): number {
    const s = this.buf;
    let i = 2;
    while (i < s.length && /[0-9;:<>?=]/.test(s[i])) i++;
    while (i < s.length && /[ -/]/.test(s[i])) i++;
    if (i >= s.length) return 0;
    const fin = s[i];
    const params = s.slice(2, i).replace(/^[<>?=]/, "").split(/[;:]/).map((p) => (p === "" ? undefined : Number(p)));
    const len = i + 1;
    if (s[2] === "<" && (fin === "M" || fin === "m")) { // SGR mouse
      const [b = 0, x = 1, y = 1] = params as number[];
      const mods = { shift: !!(b & 4), alt: !!(b & 8), ctrl: !!(b & 16) };
      const base = b & 3;
      if (b & 64) out.push({ type: "mouse", action: "wheel", button: -1, x: x - 1, y: y - 1, dir: base === 0 || base === 2 ? -1 : 1, horizontal: base >= 2, ...mods });
      else if (fin === "m") out.push({ type: "mouse", action: "up", button: base as 0 | 1 | 2, x: x - 1, y: y - 1, ...mods });
      else if (b & 32) out.push({ type: "mouse", action: base === 3 ? "move" : "drag", button: base === 3 ? -1 : (base as 0 | 1 | 2), x: x - 1, y: y - 1, ...mods });
      else out.push({ type: "mouse", action: "down", button: base as 0 | 1 | 2, x: x - 1, y: y - 1, ...mods });
      return len;
    }
    if (fin === "~") {
      const p = params[0];
      if (p === 200) { this.pasting = ""; return len; }
      if (p === 201) return len;
      const k = p !== undefined ? CSI_TILDE[p] : undefined;
      out.push(key(k ?? "unknown", modsOf(params[1])));
      return len;
    }
    if (fin === "Z") { out.push(key("tab", 1)); return len; }
    if (fin === "I" || fin === "O") { out.push({ type: "focus", focused: fin === "I" }); return len; }
    if (fin === "u") { // kitty / CSI-u: code point and modifiers
      const cp = params[0] ?? 0;
      const m = modsOf(params[1]);
      const ch = cp === 13 ? "enter" : cp === 9 ? "tab" : cp === 27 ? "escape" : cp === 127 ? "backspace" : String.fromCodePoint(cp);
      out.push(key(ch, m, cp >= 32 && cp !== 127 ? String.fromCodePoint(cp) : undefined));
      return len;
    }
    const k = CSI_LETTER[fin];
    if (k) { out.push(key(k, modsOf(params[1] ?? (params.length > 1 ? params[1] : undefined)))); return len; }
    out.push(key("unknown"));
    return len;
  }

  /** OSC replies such as the background-colour answer; terminated by BEL or ST. */
  private osc(out: InputEvent[]): number {
    const s = this.buf;
    const bel = s.indexOf("\x07", 2);
    const st = s.indexOf("\x1b\\", 2);
    let end = -1, tl = 0;
    if (bel >= 0 && (st < 0 || bel < st)) { end = bel; tl = 1; } else if (st >= 0) { end = st; tl = 2; }
    if (end < 0) return s.length > 512 ? s.length : 0; // give up on garbage
    const body = s.slice(2, end);
    const semi = body.indexOf(";");
    out.push({ type: "osc", num: Number(semi < 0 ? body : body.slice(0, semi)), data: semi < 0 ? "" : body.slice(semi + 1) });
    return end + tl;
  }
}

/** Parse an OSC 11 reply ("rgb:rrrr/gggg/bbbb") and say whether the background is dark. */
export function backgroundIsDark(data: string): boolean | null {
  const m = /rgb:([0-9a-f]+)\/([0-9a-f]+)\/([0-9a-f]+)/i.exec(data);
  if (!m) return null;
  const f = (h: string) => parseInt(h, 16) / (16 ** h.length - 1);
  const lum = 0.2126 * f(m[1]) + 0.7152 * f(m[2]) + 0.0722 * f(m[3]);
  return lum < 0.5;
}
