// Display width, styled spans and word wrapping.

/** BMP symbols that terminals draw as two-cell emoji. */
const WIDE_BMP = new Set([
  0x231a, 0x231b, 0x23e9, 0x23ea, 0x23eb, 0x23ec, 0x23f0, 0x23f3, 0x25fd, 0x25fe, 0x2614, 0x2615, 0x267f, 0x2693, 0x26a1,
  0x26aa, 0x26ab, 0x26bd, 0x26be, 0x26c4, 0x26c5, 0x26ce, 0x26d4, 0x26ea, 0x26f2, 0x26f3, 0x26f5, 0x26fa, 0x26fd, 0x2705,
  0x270a, 0x270b, 0x2728, 0x274c, 0x274e, 0x2753, 0x2754, 0x2755, 0x2757, 0x2795, 0x2796, 0x2797, 0x27b0, 0x27bf, 0x2b1b,
  0x2b1c, 0x2b50, 0x2b55, ...Array.from({ length: 12 }, (_, i) => 0x2648 + i), ...Array.from({ length: 8 }, (_, i) => 0x2630 + i),
]);

/** Terminal cell width of one code point: 0 (combining), 1, or 2 (wide / emoji). */
export function cpWidth(cp: number): 0 | 1 | 2 {
  if (cp === 0) return 0;
  if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (cp < 0x300) return 1;
  if ((cp >= 0x300 && cp <= 0x36f) || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0xfe00 && cp <= 0xfe0f) ||
      cp === 0x2060 || cp === 0xfeff || (cp >= 0x20d0 && cp <= 0x20ff)) return 0;
  if (cp < 0x1100) return 1;
  if (
    cp <= 0x115f || cp === 0x2329 || cp === 0x232a ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) || (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1f64f) || (cp >= 0x1f680 && cp <= 0x1f6ff) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) || (cp >= 0x20000 && cp <= 0x3fffd) ||
    WIDE_BMP.has(cp)
  ) return 2;
  return 1;
}

export function strWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += cpWidth(ch.codePointAt(0)!);
  return w;
}

/** The longest prefix of `s` that fits in `max` cells. */
export function clipWidth(s: string, max: number): string {
  let w = 0, out = "";
  for (const ch of s) {
    const cw = cpWidth(ch.codePointAt(0)!);
    if (w + cw > max) break;
    w += cw; out += ch;
  }
  return out;
}

/** Fit `s` in `max` cells, ending with an ellipsis when it had to be cut. */
export function ellipsize(s: string, max: number): string {
  if (max <= 0) return "";
  if (strWidth(s) <= max) return s;
  return clipWidth(s, Math.max(0, max - 1)) + "…";
}

export function padEnd(s: string, w: number): string {
  const n = w - strWidth(s);
  return n > 0 ? s + " ".repeat(n) : s;
}

/** A colour is a theme token name ("fg", "accent", ...) or a literal "#rrggbb". */
export type Color = string | undefined;

export interface Style {
  fg?: Color;
  bg?: Color;
  b?: boolean;   // bold
  d?: boolean;   // dim
  i?: boolean;   // italic
  u?: boolean;   // underline
  inv?: boolean; // inverse
}

/** A run of text with one style. `act` names a click target (handled by the app). */
export interface Span extends Style {
  t: string;
  act?: string;
  tip?: string;
}

export const sp = (t: string, style: Style = {}, act?: string): Span => (act ? { t, ...style, act } : { t, ...style });

export function spansWidth(spans: Span[]): number {
  let w = 0;
  for (const s of spans) w += strWidth(s.t);
  return w;
}

export function spansText(spans: Span[]): string {
  return spans.map((s) => s.t).join("");
}

/** Cut spans to `max` cells. */
export function clipSpans(spans: Span[], max: number): Span[] {
  const out: Span[] = [];
  let w = 0;
  for (const s of spans) {
    const sw = strWidth(s.t);
    if (w + sw <= max) { out.push(s); w += sw; continue; }
    const rest = max - w;
    if (rest > 0) out.push({ ...s, t: clipWidth(s.t, rest) });
    break;
  }
  return out;
}

interface Atom { t: string; w: number; space: boolean; src: Span }

function atoms(spans: Span[]): Atom[] {
  const out: Atom[] = [];
  for (const s of spans) {
    // split into runs of spaces and non-spaces; newlines are handled by the caller
    const parts = s.t.match(/ +|[^ ]+/g) ?? [];
    for (const p of parts) out.push({ t: p, w: strWidth(p), space: p[0] === " ", src: s });
  }
  return out;
}

/** Drop spaces at the end of a wrapped line (they would only draw as a coloured tail). */
function trimEnd(line: Span[]): Span[] {
  while (line.length) {
    const last = line[line.length - 1];
    const t = last.t.replace(/ +$/, "");
    if (t === last.t) break;
    if (t) { last.t = t; break; }
    line.pop();
  }
  return line;
}

const push = (line: Span[], a: { t: string; src: Span }) => {
  const last = line[line.length - 1];
  const { t: _t, ...style } = a.src;
  if (last && last.fg === style.fg && last.bg === style.bg && last.b === style.b && last.d === style.d &&
      last.i === style.i && last.u === style.u && last.inv === style.inv && last.act === a.src.act) last.t += a.t;
  else line.push({ ...a.src, t: a.t });
};

/**
 * Word-wrap styled text to `width` cells. Lines after the first are indented by `hang` cells.
 * Words longer than a line are broken. Explicit "\n" in a span starts a new line.
 */
export function wrapSpans(spans: Span[], width: number, hang = 0): Span[][] {
  width = Math.max(1, width);
  // split on explicit newlines first
  const paras: Span[][] = [[]];
  for (const s of spans) {
    const bits = s.t.split("\n");
    bits.forEach((b, i) => {
      if (i > 0) paras.push([]);
      if (b) paras[paras.length - 1].push({ ...s, t: b });
    });
  }
  const lines: Span[][] = [];
  for (const para of paras) {
    let line: Span[] = [];
    let used = 0;
    let first = true;
    const room = () => width - (first ? 0 : hang);
    const startLine = () => {
      if (!first && hang) line.push({ t: " ".repeat(hang) });
      used = first ? 0 : hang;
    };
    const flush = () => { lines.push(trimEnd(line)); line = []; first = false; startLine(); };
    startLine();
    for (const a of atoms(para)) {
      if (a.space) {
        if (used > (first ? 0 : hang) && used + a.w <= width) { push(line, a); used += a.w; }
        else if (used > (first ? 0 : hang) && used + a.w > width) { /* trailing space dropped at a wrap */ }
        else if (first && used === 0) { push(line, a); used += a.w; } // leading spaces are kept on the first line
        continue;
      }
      if (used + a.w <= width) { push(line, a); used += a.w; continue; }
      if (used > (first ? 0 : hang)) flush();
      if (a.w <= room()) { push(line, a); used += a.w; continue; }
      // longer than a whole line: break it
      let rest = a.t;
      while (rest) {
        const avail = Math.max(1, width - used);
        const piece = clipWidth(rest, avail) || rest[0];
        push(line, { t: piece, src: a.src });
        rest = rest.slice(piece.length);
        used += strWidth(piece);
        if (rest) flush();
      }
    }
    lines.push(trimEnd(line));
  }
  return lines;
}
