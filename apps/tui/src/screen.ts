// A cell buffer with a diffing flush: draw whole frames, send only what changed.

import { cpWidth } from "./text.ts";
import { sgrColor, type ColorMode } from "./theme.ts";

export const A_BOLD = 1, A_DIM = 2, A_ITALIC = 4, A_UNDER = 8, A_INV = 16;

export class Screen {
  readonly w: number;
  readonly h: number;
  readonly ch: string[];      // grapheme per cell; "" marks the right half of a wide glyph
  readonly fg: Int32Array;    // 0xRRGGBB, -1 = terminal default
  readonly bg: Int32Array;
  readonly at: Uint8Array;

  constructor(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    const n = this.w * this.h;
    this.ch = new Array(n).fill(" ");
    this.fg = new Int32Array(n).fill(-1);
    this.bg = new Int32Array(n).fill(-1);
    this.at = new Uint8Array(n);
  }

  clear(bg = -1, fg = -1): void {
    this.ch.fill(" "); this.fg.fill(fg); this.bg.fill(bg); this.at.fill(0);
  }

  /** Write one glyph (already segmented) at a cell, fixing up any wide glyph it overlaps. */
  put(x: number, y: number, g: string, fg: number, bg: number, at: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    const cw = cpWidth(g.codePointAt(0)!);
    if (cw === 0) return 0;
    const i = y * this.w + x;
    if (bg === -2) bg = this.bg[i]; // inherit the background underneath
    if (cw === 2 && x + 1 >= this.w) { // would be cut in half: draw a space instead
      this.set(i, " ", fg, bg, at);
      return 1;
    }
    this.breakWide(x, y);
    if (cw === 2) this.breakWide(x + 1, y);
    this.set(i, g, fg, bg, at);
    if (cw === 2) this.set(i + 1, "", fg, bg, at);
    return cw;
  }

  private set(i: number, g: string, fg: number, bg: number, at: number) {
    this.ch[i] = g; this.fg[i] = fg; this.bg[i] = bg; this.at[i] = at;
  }

  /** If (x,y) is half of a wide glyph, blank the whole glyph so no stray half remains. */
  private breakWide(x: number, y: number) {
    const i = y * this.w + x;
    if (this.ch[i] === "" && x > 0) this.set(i - 1, " ", this.fg[i - 1], this.bg[i - 1], this.at[i - 1]);
    else if (x + 1 < this.w && this.ch[i + 1] === "" ) this.set(i + 1, " ", this.fg[i + 1], this.bg[i + 1], this.at[i + 1]);
  }

  /** Paint `text` starting at (x,y), clipped to [x0, x1). Returns the x after the last painted cell. */
  text(x: number, y: number, text: string, fg: number, bg: number, at: number, x0 = 0, x1 = this.w): number {
    if (y < 0 || y >= this.h) return x;
    for (const g of text) {
      const cw = cpWidth(g.codePointAt(0)!);
      if (cw === 0) continue;
      if (x + cw <= x0) { x += cw; continue; }
      if (x < x0 || x + cw > x1) { if (x >= x1) break; x += cw; continue; }
      this.put(x, y, g, fg, bg, at);
      x += cw;
    }
    return x;
  }

  fill(x: number, y: number, w: number, h: number, bg: number, fg = -1, g = " ") {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) {
        this.breakWide(xx, yy);
        this.set(yy * this.w + xx, g, fg, bg, 0);
      }
  }

  /** Plain text of one row (wide-glyph halves skipped); used by tests and --dump. */
  rowText(y: number): string {
    let s = "";
    for (let x = 0; x < this.w; x++) s += this.ch[y * this.w + x];
    return s;
  }

  toText(): string {
    const rows: string[] = [];
    for (let y = 0; y < this.h; y++) rows.push(this.rowText(y).replace(/\s+$/, ""));
    return rows.join("\n");
  }

  /**
   * Bytes that turn the terminal from `prev` into this screen (or draw everything when prev is
   * null or a different size). Cursor moves and SGR changes are kept to a minimum.
   */
  diff(prev: Screen | null, mode: ColorMode): string {
    const full = !prev || prev.w !== this.w || prev.h !== this.h;
    let out = "";
    let cfg = -2, cbg = -2, cat = -1; // current terminal pen (-2 = unknown)
    let cx = -1, cy = -1;             // where the terminal cursor is
    const w = this.w;
    for (let y = 0; y < this.h; y++) {
      const row = y * w;
      let x = 0;
      while (x < w) {
        const i = row + x;
        const same = !full && prev!.ch[i] === this.ch[i] && prev!.fg[i] === this.fg[i] && prev!.bg[i] === this.bg[i] && prev!.at[i] === this.at[i];
        if (same || this.ch[i] === "") { x++; continue; }
        if (cy !== y || cx !== x) { out += `\x1b[${y + 1};${x + 1}H`; cy = y; cx = x; }
        if (this.fg[i] !== cfg || this.bg[i] !== cbg || this.at[i] !== cat) {
          const a = this.at[i];
          let sgr = "0";
          if (a & A_BOLD) sgr += ";1";
          if (a & A_DIM) sgr += ";2";
          if (a & A_ITALIC) sgr += ";3";
          if (a & A_UNDER) sgr += ";4";
          if (a & A_INV) sgr += ";7";
          if (mode !== "none") {
            if (this.fg[i] >= 0) sgr += ";" + sgrColor(this.fg[i], true, mode);
            if (this.bg[i] >= 0) sgr += ";" + sgrColor(this.bg[i], false, mode);
          }
          out += `\x1b[${sgr}m`;
          cfg = this.fg[i]; cbg = this.bg[i]; cat = a;
        }
        out += this.ch[i];
        const cw = this.ch[i + 1] === "" && x + 1 < w ? 2 : 1;
        cx += cw; x += cw;
      }
    }
    return out ? out + "\x1b[0m" : "";
  }

  clone(): Screen {
    const s = new Screen(this.w, this.h);
    for (let i = 0; i < this.ch.length; i++) s.ch[i] = this.ch[i];
    s.fg.set(this.fg); s.bg.set(this.bg); s.at.set(this.at);
    return s;
  }
}
