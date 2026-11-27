// Immediate-mode drawing: a painter that resolves theme tokens, and a hit map rebuilt every frame.

import { Screen, A_BOLD, A_DIM, A_INV, A_ITALIC, A_UNDER } from "./screen.ts";
import { mix, type Theme } from "./theme.ts";
import { type Span, type Style, strWidth } from "./text.ts";

export interface Rect { x: number; y: number; w: number; h: number }
export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export interface Region {
  rect: Rect;
  id: string;
  click?: (x: number, y: number) => void;
  wheel?: (dir: -1 | 1, horizontal: boolean) => void;
  drag?: (x: number, y: number) => void;
  /** Highlight this region while the pointer is over it. */
  hover?: boolean;
}

export class HitMap {
  regions: Region[] = [];
  clear() { this.regions.length = 0; }
  add(r: Region) { this.regions.push(r); }
  /** The region drawn last (on top) that contains the point. */
  at(x: number, y: number, pick: (r: Region) => boolean = () => true): Region | undefined {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (inRect(r.rect, x, y) && pick(r)) return r;
    }
    return undefined;
  }
}

export class Painter {
  clip: Rect;
  hoverId: string | null = null;
  focusId: string | null = null;
  constructor(readonly scr: Screen, readonly theme: Theme, readonly hits: HitMap) {
    this.clip = rect(0, 0, scr.w, scr.h);
  }

  /** Run `fn` with drawing limited to `r` (intersected with the current clip). */
  within<T>(r: Rect, fn: () => T): T {
    const prev = this.clip;
    const x0 = Math.max(prev.x, r.x), y0 = Math.max(prev.y, r.y);
    const x1 = Math.min(prev.x + prev.w, r.x + r.w), y1 = Math.min(prev.y + prev.h, r.y + r.h);
    this.clip = { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
    try { return fn(); } finally { this.clip = prev; }
  }

  private attrs(st: Style): number {
    return (st.b ? A_BOLD : 0) | (st.d ? A_DIM : 0) | (st.i ? A_ITALIC : 0) | (st.u ? A_UNDER : 0) | (st.inv ? A_INV : 0);
  }

  fill(r: Rect, bg: string | undefined) {
    const c = this.clip;
    const x0 = Math.max(c.x, r.x), y0 = Math.max(c.y, r.y);
    const x1 = Math.min(c.x + c.w, r.x + r.w), y1 = Math.min(c.y + c.h, r.y + r.h);
    if (x1 > x0 && y1 > y0) this.scr.fill(x0, y0, x1 - x0, y1 - y0, this.theme.rgb(bg), this.theme.rgb("fg"));
  }

  /** Draw plain text; returns the x after it. */
  text(x: number, y: number, s: string, st: Style = {}): number {
    const c = this.clip;
    if (y < c.y || y >= c.y + c.h) return x + strWidth(s);
    // No colour given: text takes the theme's foreground and keeps whatever background is already there (-2),
    // so a glyph never punches a terminal-default hole in the app's surface.
    return this.scr.text(x, y, s, this.theme.rgb(st.fg ?? "fg"), st.bg === undefined ? -2 : this.theme.rgb(st.bg), this.attrs(st), c.x, c.x + c.w);
  }

  /**
   * Draw spans left to right starting at x. `base` supplies defaults (a line background, say).
   * Spans with `act` register a click region through `onAct`. Returns the x after the last cell.
   */
  spans(x: number, y: number, spans: Span[], base: Style = {}, onAct?: (act: string, r: Rect, span: Span) => void): number {
    for (const s of spans) {
      const st: Style = { ...base, ...s, fg: s.fg ?? base.fg, bg: s.bg ?? base.bg };
      const x0 = x;
      x = this.text(x, y, s.t, st);
      if (s.act && onAct && x > x0) onAct(s.act, rect(x0, y, x - x0, 1), s);
    }
    return x;
  }

  /** Add attributes (and optionally a background) to cells already drawn, e.g. hover and focus highlights. */
  decorate(r: Rect, attrs: number, bg?: string) {
    const c = this.clip;
    const x0 = Math.max(c.x, r.x), y0 = Math.max(c.y, r.y);
    const x1 = Math.min(c.x + c.w, r.x + r.w), y1 = Math.min(c.y + c.h, r.y + r.h);
    const rgb = bg ? this.theme.rgb(bg) : -1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * this.scr.w + x;
      this.scr.at[i] |= attrs;
      if (bg) this.scr.bg[i] = rgb;
    }
  }

  /** A text cursor: the cell under it, inverted, so it shows with any colour depth (and with none). */
  cursor(x: number, y: number, ch = " ") { this.text(x, y, ch, { inv: true }); }

  /**
   * Push what is already drawn in `r` into the background (a scrim behind a dialog or an open drawer):
   * text colours move toward their own background; where colour is unavailable `attr` adds the dim attribute instead.
   */
  dim(r: Rect, t = 0.6, attr = false) {
    const c = this.clip;
    const x0 = Math.max(c.x, r.x), y0 = Math.max(c.y, r.y);
    const x1 = Math.min(c.x + c.w, r.x + r.w), y1 = Math.min(c.y + c.h, r.y + r.h);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * this.scr.w + x;
      const f = this.scr.fg[i], b = this.scr.bg[i];
      if (f >= 0 && b >= 0) this.scr.fg[i] = mix(f, b, t);
      if (attr) this.scr.at[i] |= A_DIM;
    }
  }

  hline(x: number, y: number, w: number, ch: string, st: Style) { this.text(x, y, ch.repeat(Math.max(0, w)), st); }

  /** Rounded box outline (does not fill the inside unless `bg` is given). */
  box(r: Rect, st: Style, bg?: string) {
    if (r.w < 2 || r.h < 2) return;
    if (bg) this.fill(r, bg);
    const s = { ...st, bg: st.bg ?? bg };
    this.text(r.x, r.y, "╭" + "─".repeat(r.w - 2) + "╮", s);
    this.text(r.x, r.y + r.h - 1, "╰" + "─".repeat(r.w - 2) + "╯", s);
    for (let i = 1; i < r.h - 1; i++) { this.text(r.x, r.y + i, "│", s); this.text(r.x + r.w - 1, r.y + i, "│", s); }
  }
}
