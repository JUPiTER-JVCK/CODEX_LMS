// Turns a chapter's blocks into display lines for a given width. Pure: no terminal, no state of its own.

import { anchorOf, itemIds, type Block, type Chapter } from "./book.ts";
import { highlight, inline, kindOf, type VarFn } from "./markup.ts";
import { clipSpans, ellipsize, spansWidth, strWidth, wrapSpans, type Span, type Style } from "./text.ts";

export interface DocLine {
  spans: Span[];
  /** Theme token that fills the whole line. */
  bg?: string;
  anchor?: string;
  /** Diagram line: shifts sideways with the pan keys instead of wrapping. */
  pre?: boolean;
  /** First line of a terminal lab; the app paints the lab over `rows` lines. */
  widget?: { key: string; name: string; args: any; rows: number };
}

/** Everything the reader can change about how blocks look (revealed hints, chosen answers, open cards). */
export interface UiState {
  hints: Record<string, number>;
  sol: Record<string, boolean>;
  /** Chosen option indexes per question; for typed answers [1] = right, [-1] = wrong. */
  ans: Record<string, number[]>;
  open: Record<string, boolean>;
  /** What was typed into typed-answer questions. */
  txt: Record<string, string>;
}
export const newUi = (): UiState => ({ hints: {}, sol: {}, ans: {}, open: {}, txt: {} });
export interface QuizInfo { ok: number[]; multi: boolean; typed?: string[] }

export interface LayoutCtx {
  width: number;
  vars: VarFn;
  ui: UiState;
  isDone(id: string): boolean;
  /** Rows a terminal lab needs at this width; undefined means only the page has that lab. */
  labRows(key: string, name: string, args: any, width: number): number | undefined;
  prev?: { id: string; title: string };
  next?: { id: string; title: string };
  partTitle?: string;
}

export interface Doc {
  lines: DocLine[];
  anchors: Map<string, number>;
  /** Text behind each copy:<key> action. */
  copy: Map<string, string>;
  /** Checkpoint question ids -> number of correct options, so the app can score answers. */
  quiz: Map<string, QuizInfo>;
}

class Builder {
  lines: DocLine[] = [];
  anchors = new Map<string, number>();
  copy = new Map<string, string>();
  quiz = new Map<string, QuizInfo>();
  push(l: DocLine) { this.lines.push(l); }
  gap() {
    const last = this.lines[this.lines.length - 1];
    if (last && (last.spans.length || last.bg || last.widget)) this.lines.push({ spans: [] });
  }
  mark(id?: string) { if (id && !this.anchors.has(id)) this.anchors.set(id, this.lines.length); }
  sub(): Builder { const b = new Builder(); b.copy = this.copy; b.quiz = this.quiz; return b; }
}

const LABEL: Record<string, string> = {
  term: "TERMINAL", sh: "ZSH", run: "PYTHON", python: "PYTHON", jsrun: "JAVASCRIPT", js: "JAVASCRIPT", file: "FILE", ascii: "DIAGRAM",
  text: "TEXT", webplay: "HTML · CSS · JS", devtools: "DEVTOOLS", html: "HTML", css: "CSS", xml: "XML",
};
const RUNS = new Set(["run", "jsrun", "webplay"]);

const CALLOUT: Record<string, { icon: string; label: string; fg: string }> = {
  tip: { icon: "✦", label: "Tip", fg: "ok" }, gotcha: { icon: "▲", label: "Gotcha", fg: "warn" }, try: { icon: "▶", label: "Try it", fg: "accent" },
  mac: { icon: "⌘", label: "On your Mac", fg: "an5" }, warn: { icon: "▲", label: "Warning", fg: "warn" }, danger: { icon: "✖", label: "Danger", fg: "bad" },
  note: { icon: "●", label: "Note", fg: "mute" }, why: { icon: "?", label: "Why", fg: "an1" }, deep: { icon: "◆", label: "Going deeper", fg: "an5" },
};
/** Prose (paragraphs, list items) never runs wider than this, however wide the window is; code, tables and diagrams keep the full width. */
export const PROSE_W = 80;
const CHIPS = ["an1", "an2", "an3", "an4", "an5", "an6", "an7", "an8"];

const txt = (t: string, st: Style = {}): Span => ({ t, ...st });
const spaces = (n: number): string => (n > 0 ? " ".repeat(n) : "");
const padTo = (spans: Span[], w: number, st: Style = {}): Span[] => {
  const n = w - spansWidth(spans);
  return n > 0 ? [...spans, txt(spaces(n), st)] : spans;
};

/** Put every inner line inside rounded-box borders. */
function boxed(inner: DocLine[], w: number, color: string, title: Span[], right: Span[], bgTok?: string): DocLine[] {
  const iw = w - 4;
  const bs: Style = { fg: color };
  if (spansWidth(right) > w - 16) right = []; // no room for a side label on a narrow screen
  const rw = spansWidth(right);
  const tt = clipSpans(title, Math.max(2, w - 9 - (rw ? rw + 2 : 0)));
  const fillN = Math.max(0, rw ? w - 8 - spansWidth(tt) - rw : w - 5 - spansWidth(tt));
  const top: Span[] = [txt("╭─ ", bs), ...tt, txt(" " + "─".repeat(fillN) + (rw ? " " : ""), bs), ...right, txt(rw ? " ─╮" : "╮", bs)];
  const out: DocLine[] = [{ spans: clipSpans(top, w) }];
  for (const l of inner) {
    const bg = l.bg ?? bgTok;
    const body = clipSpans(l.spans, iw).map((s) => (s.bg || !bg ? s : { ...s, bg }));
    const row: Span[] = [txt("│ ", bs), ...padTo(body, iw, bg ? { bg } : {}), txt(" │", bs)];
    out.push({ spans: row, anchor: l.anchor, widget: l.widget });
  }
  out.push({ spans: [txt("╰" + "─".repeat(w - 2) + "╯", bs)] });
  return out;
}

function paragraph(b: Block, w: number, ctx: LayoutCtx, B: Builder, base: Style = { fg: "fg" }) {
  for (const l of wrapSpans(inline(b.text, ctx.vars, base), Math.min(w, PROSE_W))) B.push({ spans: l });
}

function listLines(items: any[], ordered: boolean, w: number, ctx: LayoutCtx, B: Builder, depth: number) {
  items.forEach((it, i) => {
    const text = typeof it === "string" ? it : it.text;
    const bullet = ordered ? `${i + 1}.` : depth ? "◦" : "•";
    const pre = spaces(depth * 2) + bullet + " ";
    const pw = strWidth(pre);
    wrapSpans(inline(text, ctx.vars, { fg: "fg" }), Math.max(8, Math.min(w, PROSE_W) - pw)).forEach((l, j) =>
      B.push({ spans: [txt(j === 0 ? pre : spaces(pw), { fg: "accent" }), ...l] }));
    if (typeof it !== "string" && it.children?.length) listLines(it.children, false, w, ctx, B, depth + 1);
  });
}

function codeBlock(b: Block, w: number, ctx: LayoutCtx, B: Builder, key: string) {
  const kind = kindOf(b.lang, b.attrs?.name);
  B.gap();
  if (kind === "ascii") {
    const rows = highlight("ascii", b.code);
    for (const r of rows) B.push({ spans: [txt(" "), ...r], bg: "panel", pre: true });
    return;
  }
  const label = b.attrs?.name ? String(b.attrs.name) : LABEL[b.lang] || String(b.lang).toUpperCase();
  const runs = RUNS.has(b.lang);
  const barFg = runs || b.lang === "sh" || b.lang === "term" ? "accent" : "dim";
  B.copy.set(key, b.code.replace(/\n$/, ""));
  const copy = txt(" ⧉ Copy ", { fg: "mute", bg: "panel2" });
  const head: Span[] = clipSpans([txt("▏ ", { fg: barFg }), txt(label, { fg: "dim", b: true }), ...(runs && w >= 64 ? [txt("  runs in the page and the app", { fg: "dim" })] : [])], Math.max(4, w - 9));
  const hw = spansWidth(head);
  B.push({ spans: [...head, txt(spaces(w - hw - 8)), { ...copy, act: "copy:" + key }], bg: "codeBg" });
  const rows = highlight(kind, b.code);
  const bar = (j: number): Span => (j === 0 ? txt("▏ ", { fg: barFg }) : txt("▏↳", { fg: barFg }));
  for (const r of rows) {
    const parts = wrapSpans(r.length ? r : [txt("")], w - 3, 0);
    parts.forEach((p, j) => B.push({ spans: [bar(j), ...p], bg: "codeBg" }));
  }
  if (b.out) {
    B.push({ spans: [txt("▏ ", { fg: barFg }), txt("── output ──", { fg: "dim" })], bg: "codeBg" });
    for (const ln of String(b.out).replace(/\n$/, "").split("\n"))
      for (const p of wrapSpans([txt(ln, { fg: "mute" })], w - 3)) B.push({ spans: [txt("▏ ", { fg: barFg }), ...p], bg: "codeBg" });
  }
}

function cmdCard(b: Block, w: number, ctx: LayoutCtx, B: Builder, key: string) {
  const id = anchorOf(b)!;
  const open = !!ctx.ui.open[id];
  B.gap();
  B.mark(id);
  const inner: DocLine[] = [];
  for (const l of wrapSpans(inline(b.sum || "", ctx.vars, { fg: "fg" }), w - 4)) inner.push({ spans: l });
  if (b.syntax) {
    B.copy.set(key, String(b.syntax).split(/\s{3,}/)[0]);
    for (const row of String(b.syntax).split("\n"))
      for (const p of wrapSpans([txt(row, { fg: "shCmd" })], w - 6)) inner.push({ spans: [txt(" " + p.map((s) => s.t).join(""), { fg: "shCmd" })], bg: "codeBg" });
  }
  const chev = open ? "▾" : "▸";
  inner.push({ spans: [{ ...txt(`${chev} How it works`, { fg: "accent", b: true }), act: "open:" + id }, txt("   "), { ...txt("⧉ copy syntax", { fg: "dim" }), act: "copy:" + key }] });
  if (open) {
    const sub = B.sub();
    (b.how || []).forEach((x: Block, i: number) => block(x, w - 4, ctx, sub, key + "." + i));
    inner.push({ spans: [] }, ...sub.lines.filter((l, i) => !(i === 0 && !l.spans.length)).map((l) => ({ ...l, pre: false })));
    if (b.tags?.length) { inner.push({ spans: [] }); inner.push({ spans: [txt(b.tags.map((t: string) => "#" + t).join("  "), { fg: "dim" })] }); }
  }
  const right: Span[] = [txt([b.cat, b.os].filter(Boolean).join(" · "), { fg: "dim" })];
  for (const l of boxed(inner, w, "line", [txt(b.name, { fg: "accent", b: true })], right)) B.push(l);
}

function tableBlock(b: Block, w: number, ctx: LayoutCtx, B: Builder) {
  const head: string[] = b.head, rows: string[][] = b.rows, cols = head.length;
  B.gap();
  if (b.title) for (const l of wrapSpans([txt(b.title, { fg: "mute", b: true })], w, 0)) B.push({ spans: l });
  const cell = (s: string, hd: boolean): Span[] => inline(s, ctx.vars, hd ? { fg: "accent", b: true } : { fg: "fg" });
  const avail = w - (cols + 1) - 2 * cols;
  if (avail < cols * 7) { // too narrow for a grid: one small card per row
    for (const r of rows) {
      r.forEach((c, i) => { for (const l of wrapSpans([txt(head[i] + ": ", { fg: "accent", b: true }), ...cell(c, false)], w, 2)) B.push({ spans: l }); });
      B.push({ spans: [txt("─".repeat(Math.min(w, 24)), { fg: "line" })] });
    }
    return;
  }
  const nat = head.map((h, i) => Math.min(60, Math.max(spansWidth(cell(h, true)), ...rows.map((r) => spansWidth(cell(r[i] ?? "", false))))));
  const widths = nat.slice();
  while (widths.reduce((a, c) => a + c, 0) > avail) {
    let m = 0;
    widths.forEach((x, i) => { if (x > widths[m]) m = i; });
    if (widths[m] <= 6) break;
    widths[m]--;
  }
  const ls: Style = { fg: "line" };
  const rule = (l: string, m: string, r: string) => ({ spans: [txt(l + widths.map((x) => "─".repeat(x + 2)).join(m) + r, ls)] });
  const rowLines = (r: string[], hd: boolean): DocLine[] => {
    const cells = r.map((c, i) => wrapSpans(cell(c ?? "", hd), widths[i]));
    const h = Math.max(...cells.map((c) => c.length));
    const out: DocLine[] = [];
    for (let k = 0; k < h; k++) {
      const spans: Span[] = [txt("│", ls)];
      cells.forEach((c, i) => { spans.push(txt(" "), ...padTo(c[k] ?? [], widths[i]), txt(" │", ls)); });
      out.push({ spans });
    }
    return out;
  };
  B.push(rule("┌", "┬", "┐"));
  rowLines(head, true).forEach((l) => B.push(l));
  B.push(rule("├", "┼", "┤"));
  const multi = rows.some((r) => r.some((c, i) => spansWidth(cell(c, false)) > widths[i]));
  rows.forEach((r, i) => { rowLines(r, false).forEach((l) => B.push(l)); if (multi && i < rows.length - 1) B.push(rule("├", "┼", "┤")); });
  B.push(rule("└", "┴", "┘"));
}

function calloutBlock(b: Block, w: number, ctx: LayoutCtx, B: Builder, key: string) {
  const m = CALLOUT[b.kind] ?? CALLOUT.note;
  B.gap();
  const sub = B.sub();
  (b.blocks || []).forEach((x: Block, i: number) => block(x, w - 3, ctx, sub, key + "." + i));
  const bar = txt("▎ ", { fg: m.fg });
  const head: Span[] = [txt(`${m.icon} ${b.title || m.label}`, { fg: m.fg, b: true })];
  if (b.title) head.push(txt("  " + m.label.toUpperCase(), { fg: "dim" }));
  for (const l of wrapSpans(head, w - 2)) B.push({ spans: [bar, ...l], bg: "panel" });
  for (const l of sub.lines) { if (l === sub.lines[0] && !l.spans.length) continue; B.push({ spans: [bar, ...clipSpans(l.spans, w - 2)], bg: l.bg ?? "panel", anchor: l.anchor, widget: l.widget }); }
}

function anatomyBlock(b: Block, w: number, ctx: LayoutCtx, B: Builder) {
  B.gap();
  for (const l of wrapSpans([txt("Anatomy", { fg: "an1", b: true }), txt("  " + (b.title || ""), { fg: "mute" })], w - 2)) B.push({ spans: [txt("▎ ", { fg: "an1" }), ...l], bg: "panel" });
  const toks: { t: string; exp: string }[] = b.tokens.map((x: any) => ({ t: ellipsize(String(x.tok).replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => ctx.vars(k)), Math.max(6, Math.floor(w / 2) - 5)), exp: x.exp }));
  let row1: Span[] = [], row2: Span[] = [], used = 0;
  const flush = () => { if (used) { B.push({ spans: [txt("▎ ", { fg: "an1" }), ...row1], bg: "panel" }); B.push({ spans: [txt("▎ ", { fg: "an1" }), ...row2], bg: "panel" }); } row1 = []; row2 = []; used = 0; };
  toks.forEach((x, i) => {
    const c = CHIPS[i % CHIPS.length], tw = strWidth(x.t);
    if (used && used + tw + 2 > w - 3) flush();
    row1.push(txt(x.t + "  ", { fg: c, b: true }));
    row2.push(txt("▔".repeat(tw) + "  ", { fg: c }));
    used += tw + 2;
  });
  flush();
  toks.forEach((x, i) => {
    const c = CHIPS[i % CHIPS.length];
    const pre = [txt("▎ ", { fg: "an1" }), txt("● ", { fg: c }), txt(x.t, { fg: c, b: true }), txt("  ")];
    const lead = spansWidth(pre);
    wrapSpans(inline(x.exp, ctx.vars, { fg: "fg" }), Math.max(10, w - lead)).forEach((l, j) =>
      B.push({ spans: j === 0 ? [...pre, ...l] : [txt("▎ ", { fg: "an1" }), txt(spaces(lead - 2)), ...l], bg: "panel" }));
  });
}

const chip = (label: string, act: string, fg = "fg", bg = "panel2"): Span => ({ ...txt(` ${label} `, { fg, bg, b: true }), act });

function exerciseBlock(b: Block, w: number, ctx: LayoutCtx, B: Builder, key: string) {
  const id: string = b.id;
  const done = ctx.isDone(id);
  const nh = (b.hints || []).length, sh = ctx.ui.hints[id] || 0, showSol = !!ctx.ui.sol[id];
  B.gap();
  B.mark(id);
  const sub = B.sub();
  (b.task || []).forEach((x: Block, i: number) => block(x, w - 4, ctx, sub, key + ".t" + i));
  const inner: DocLine[] = sub.lines.filter((l, i) => !(i === 0 && !l.spans.length));
  for (let i = 0; i < sh; i++) {
    inner.push({ spans: [] });
    wrapSpans([txt(`Hint ${i + 1}  `, { fg: "warn", b: true }), ...inline(b.hints[i], ctx.vars, { fg: "fg" })], w - 4, 7).forEach((l) => inner.push({ spans: l }));
  }
  if (showSol) {
    inner.push({ spans: [] }, { spans: [txt("Solution", { fg: "ok", b: true })] });
    const s = B.sub();
    codeBlock({ t: "code", lang: b.lang === "python" ? "run" : b.lang === "javascript" ? "js" : b.lang || "sh", attrs: {}, code: String(b.solution) } as Block, w - 4, ctx, s, key + ".sol");
    inner.push(...s.lines.filter((l, i) => !(i === 0 && !l.spans.length)));
    (b.why || []).forEach((x: Block, i: number) => { inner.push({ spans: [] }); const q = B.sub(); block(x, w - 4, ctx, q, key + ".w" + i); inner.push(...q.lines.filter((l, i2) => !(i2 === 0 && !l.spans.length))); });
  }
  const acts: Span[] = [];
  if (nh && sh < nh) acts.push(chip(`Hint ${sh + 1}/${nh}`, "hint:" + id, "warn"), txt(" "));
  acts.push(chip(showSol ? "Hide solution" : "Show solution", "sol:" + id, "ok"), txt(" "));
  acts.push(chip(done ? "☑ Done" : "☐ Mark done", "done:" + id, done ? "accentInk" : "fg", done ? "ok" : "panel2"));
  inner.push({ spans: [] }, { spans: acts });
  if (b.type !== "think") inner.push({ spans: [txt("Self-check here; the page and the Mac app can also run and auto-check it.", { fg: "dim" })] });
  const label = b.type === "terminal" ? "terminal" : b.type === "py" ? "Python" : b.type === "js" ? "JavaScript" : "think it through";
  for (const l of boxed(inner, w, done ? "ok" : "line", [txt("✎ Exercise", { fg: "warn", b: true }), txt("  " + b.title, { fg: "fg", b: true })], [txt(label, { fg: "dim" })])) B.push(l);
}

function checkpointBlock(b: Block, w: number, ctx: LayoutCtx, B: Builder) {
  const id: string = b.id;
  B.gap();
  B.mark(id);
  const inner: DocLine[] = [];
  let right = 0;
  (b.questions as any[]).forEach((q, qi) => {
    const qk = id + ":" + qi;
    const typed = !(q.options as any[]).length && (q.answers as string[])?.length ? (q.answers as string[]) : undefined;
    const oks = (q.options as any[]).map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0);
    const multi = oks.length > 1;
    B.quiz.set(qk, { ok: oks, multi, typed });
    const sel = ctx.ui.ans[qk] || [];
    const good = typed ? sel[0] === 1 : oks.every((i) => sel.includes(i)) && sel.every((i) => oks.includes(i));
    if (good) right++;
    if (qi) inner.push({ spans: [] });
    wrapSpans([txt(`${qi + 1}. `, { fg: "accent", b: true }), ...inline(q.q, ctx.vars, { fg: "fg", b: true })], w - 4, 3).forEach((l) => inner.push({ spans: l }));
    if (typed) {
      const said = ctx.ui.txt[qk];
      const fg = sel[0] === 1 ? "ok" : sel[0] === -1 ? "bad" : "fg";
      inner.push({ spans: [txt("   "), { ...txt(` ✎ ${said ? said : "type your answer"} `, { fg: said ? fg : "dim", bg: "panel2", b: !!said }), act: "ask:" + qk }] });
      if (sel.length) {
        const verdict = sel[0] === 1 ? txt("   ✓ Correct. ", { fg: "ok", b: true }) : txt(`   ✗ Accepted: ${typed[0]}. `, { fg: "bad", b: true });
        wrapSpans([verdict, ...(q.why ? inline(q.why, ctx.vars, { fg: "mute" }) : [])], w - 4, 3).forEach((l) => inner.push({ spans: l }));
      }
      return;
    }
    if (multi) inner.push({ spans: [txt("   choose all that apply", { fg: "dim" })] });
    (q.options as any[]).forEach((o, oi) => {
      const on = sel.includes(oi);
      const mark = on ? (o.ok ? "✓" : "✗") : multi ? "□" : "○";
      const fg = on ? (o.ok ? "ok" : "bad") : "fg";
      const lead = txt(`  ${mark} `, { fg: on ? fg : "accent", b: on });
      wrapSpans(inline(o.text, ctx.vars, { fg }), w - 8, 4).forEach((l, j) =>
        inner.push({ spans: j === 0 ? [{ ...lead, act: `ans:${qk}:${oi}` }, ...l.map((s) => ({ ...s, act: `ans:${qk}:${oi}` }))] : [txt("    "), ...l] }));
    });
    if (good || (!multi && sel.length)) {
      const verdict = good ? txt("   ✓ Correct. ", { fg: "ok", b: true }) : txt("   ✗ Not quite. ", { fg: "bad", b: true });
      if (q.why) wrapSpans([verdict, ...inline(q.why, ctx.vars, { fg: "mute" })], w - 4, 3).forEach((l) => inner.push({ spans: l }));
      else inner.push({ spans: [verdict] });
    }
  });
  const total = (b.questions as any[]).length;
  const done = ctx.isDone(id);
  inner.push({ spans: [] }, { spans: [txt(`${right}/${total} correct  `, { fg: right === total ? "ok" : "mute", b: true }), chip(done ? "☑ Done" : "☐ Mark done", "done:" + id, done ? "accentInk" : "fg", done ? "ok" : "panel2")] });
  for (const l of boxed(inner, w, done ? "ok" : "line", [txt("◇ Checkpoint", { fg: "an1", b: true }), txt("  " + b.title, { fg: "fg", b: true })], [])) B.push(l);
}

function projectBlock(b: Block, w: number, ctx: LayoutCtx, B: Builder, key: string) {
  B.gap();
  B.mark(b.id);
  const sub = B.sub();
  let step = 0;
  (b.blocks as Block[]).forEach((x, i) => {
    if (x.t === "h" && x.level === 3) {
      const sid = `${b.id}#${step++}`;
      const on = ctx.isDone(sid);
      sub.gap();
      sub.mark(sid);
      sub.push({ spans: [{ ...txt(on ? "☑ " : "☐ ", { fg: on ? "ok" : "accent", b: true }), act: "done:" + sid }, { ...txt(x.text, { fg: "fg", b: true }), act: "done:" + sid }] });
    } else block(x, w - 4, ctx, sub, key + "." + i);
  });
  const inner: DocLine[] = [];
  if (b.skills?.length) inner.push({ spans: [txt("Skills  ", { fg: "dim" }), txt((b.skills as string[]).join(" · "), { fg: "mute" })] }, { spans: [] });
  inner.push(...sub.lines.filter((l, i) => !(i === 0 && !l.spans.length)));
  for (const l of boxed(inner, w, "line", [txt("▣ Project", { fg: "an5", b: true }), txt("  " + b.title, { fg: "fg", b: true })], [txt(`${b.level} · ~${b.time} min`, { fg: "dim" })])) B.push(l);
}

function widgetBlock(b: Block, w: number, ctx: LayoutCtx, B: Builder, key: string) {
  B.gap();
  const rows = ctx.labRows(key, b.name, b.args, w);
  if (rows !== undefined) {
    for (let i = 0; i < rows; i++) B.push({ spans: [], widget: i === 0 ? { key, name: b.name, args: b.args, rows } : undefined });
    return;
  }
  const inner: DocLine[] = [{ spans: [txt("This interactive lab lives in the page and the Mac app.", { fg: "mute" })] }, { spans: [txt("Open this chapter there to use it.", { fg: "dim" })] }];
  for (const l of boxed(inner, w, "line", [txt("⚙ Lab", { fg: "dim", b: true }), txt("  " + b.name, { fg: "mute" })], [])) B.push(l);
}

function varBlock(b: Block, w: number, ctx: LayoutCtx, B: Builder) {
  B.gap();
  const row: Span[] = [txt("⌗ ", { fg: "ph" }), { ...txt(ctx.vars(b.key), { fg: "ph", bg: "phBg" }), act: "var:" + b.key }, txt("  " + (b.desc || "click to set your own value"), { fg: "dim" })];
  for (const l of wrapSpans(row, w, 2)) B.push({ spans: l });
}

function block(b: Block, w: number, ctx: LayoutCtx, B: Builder, key: string) {
  switch (b.t) {
    case "p": B.gap(); paragraph(b, w, ctx, B); break;
    case "h": {
      B.gap();
      B.mark(b.id);
      const lead = b.level === 2 ? "▍ " : "▸ ";
      wrapSpans([txt(b.text, { fg: "fg", b: true })], Math.max(4, w - 2)).forEach((l, j) =>
        B.push({ spans: [txt(j === 0 ? lead : "  ", { fg: "accent", b: b.level === 2 }), ...l], anchor: j === 0 ? b.id : undefined }));
      if (b.level === 2) B.push({ spans: [txt("─".repeat(w), { fg: "line" })] });
      break;
    }
    case "ul": case "ol": B.gap(); listLines(b.items, b.t === "ol", w, ctx, B, 0); break;
    case "code": codeBlock(b, w, ctx, B, key); break;
    case "cmd": cmdCard(b, w, ctx, B, key); break;
    case "table": tableBlock(b, w, ctx, B); break;
    case "callout": calloutBlock(b, w, ctx, B, key); break;
    case "anatomy": anatomyBlock(b, w, ctx, B); break;
    case "exercise": exerciseBlock(b, w, ctx, B, key); break;
    case "checkpoint": checkpointBlock(b, w, ctx, B); break;
    case "project": projectBlock(b, w, ctx, B, key); break;
    case "widget": widgetBlock(b, w, ctx, B, key); break;
    case "var": varBlock(b, w, ctx, B); break;
    case "link": {
      const lead = [txt(b.left, { fg: "accent", b: true, u: false })];
      const rest = b.right ? [txt("  "), ...inline(b.right, ctx.vars, { fg: "mute" })] : [];
      wrapSpans([...lead, ...rest], w, 2).forEach((l) => B.push({ spans: l.map((x) => ({ ...x, act: "go:" + b.route })) }));
      break;
    }
    default: break;
  }
}

/** Lay short labels out in as few lines as fit `w`, breaking only between labels (never inside one). */
export function flowLabels(labels: string[], w: number, sep: string): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const l of labels) {
    if (!cur) cur = ellipsize(l, w);
    else if (strWidth(cur + sep + l) <= w) cur += sep + l;
    else { lines.push(cur); cur = ellipsize(l, w); }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function layoutChapter(c: Chapter, ctx: LayoutCtx): Doc {
  const w = Math.max(24, ctx.width);
  const B = new Builder();
  // header
  const ids = itemIds(c);
  const done = ids.filter((i) => ctx.isDone(i)).length;
  const meta = flowLabels([c.num >= 0 ? `CHAPTER ${String(c.num).padStart(2, "0")}` : "TOOLS", ctx.partTitle?.toUpperCase() ?? "", c.time ? `${c.time} MIN` : "", c.level?.toUpperCase() ?? ""].filter(Boolean), w, w >= 60 ? "  ·  " : " · ");
  B.push({ spans: [] });
  for (const m of meta) B.push({ spans: [txt(m, { fg: "dim", b: true })] });
  for (const l of wrapSpans([txt(c.title, { fg: "fg", b: true })], w)) B.push({ spans: l });
  for (const l of wrapSpans([txt(c.sub || "", { fg: "mute" })], Math.min(w, PROSE_W))) B.push({ spans: l });
  B.push({ spans: [txt("━".repeat(Math.min(w, 16)), { fg: "accent" })] });
  if (ids.length) B.push({ spans: [txt(`${done}/${ids.length} practice items done`, { fg: done === ids.length ? "ok" : "dim" })] });
  if (c.goals.length) {
    B.gap();
    B.push({ spans: [txt("In this chapter", { fg: "dim", b: true })] });
    for (const g of c.goals) wrapSpans(inline(g, ctx.vars, { fg: "fg" }), Math.min(w, PROSE_W) - 2).forEach((l, j) => B.push({ spans: [txt(j === 0 ? "› " : "  ", { fg: "accent" }), ...l] }));
  }
  c.blocks.forEach((b, i) => block(b, w, ctx, B, c.id + ":" + i));
  if (c.terms.length) {
    B.gap();
    B.mark("terms");
    B.push({ spans: [txt("▍", { fg: "accent", b: true }), txt(" Terms in this chapter", { fg: "fg", b: true })] });
    B.push({ spans: [txt("─".repeat(w), { fg: "line" })] });
    for (const t of c.terms) wrapSpans([txt(t.term, { fg: "accent", b: true }), txt("  "), ...inline(t.def, ctx.vars, { fg: "mute" })], w, 2).forEach((l) => B.push({ spans: l }));
  }
  B.gap();
  const nav: Span[] = [];
  if (ctx.prev) nav.push({ ...txt(` ‹ ${ellipsize(ctx.prev.title, Math.max(8, Math.floor(w / 2) - 8))} `, { fg: "fg", bg: "panel2" }), act: "go:" + ctx.prev.id });
  if (ctx.prev && ctx.next) nav.push(txt("  "));
  if (ctx.next) nav.push({ ...txt(` ${ellipsize(ctx.next.title, Math.max(8, Math.floor(w / 2) - 8))} › `, { fg: "accentInk", bg: "accent", b: true }), act: "go:" + ctx.next.id });
  B.push({ spans: nav });
  B.push({ spans: [] });
  return { lines: B.lines, anchors: B.anchors, copy: B.copy, quiz: B.quiz };
}
