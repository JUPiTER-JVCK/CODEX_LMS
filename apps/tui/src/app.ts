// The interactive app: state, input handling and drawing. No terminal in here, so tests can drive it headlessly.

import { buildIndex, itemIds, search, type Book, type Chapter, type Entry } from "./book.ts";
import { layoutChapter, newUi, type Doc, type UiState } from "./blocks.ts";
import type { InputEvent, KeyEvent, MouseEvent } from "./input.ts";
import { LABS, type LabCtx } from "./labs.ts";
import "./lablib.ts";
import { A_BOLD, A_INV, A_UNDER, Screen } from "./screen.ts";
import { buildSpecial, SPECIAL_IDS, SPECIAL_TITLES } from "./specials.ts";
import { drawSplash, SPLASH_MS } from "./splash.ts";
import type { Store } from "./state.ts";
import { editField, field, type TextField } from "./textedit.ts";
import { clipSpans, ellipsize, spansWidth, strWidth, type Span, type Style } from "./text.ts";
import { Theme, type ThemeName } from "./theme.ts";
import { HitMap, Painter, rect, type Rect, type Region } from "./ui.ts";

export interface Host { copy(text: string): void; quit(): void }
export interface AppOptions { cols: number; rows: number; theme?: string; sysDark?: boolean; splash?: boolean; now?: () => number }

const SB_W = 32, MAX_W = 110, DOCK_MIN = 100;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Overlay =
  | { kind: "palette"; f: TextField; sel: number; top: number; results: Entry[] }
  | { kind: "help" }
  | { kind: "prompt"; f: TextField; label: string; desc: string; hint: string; submit: (text: string) => void };

interface SbRow { kind: "head" | "part" | "chapter" | "section" | "special"; id: string; anchor?: string; text: string; num?: number }

const KIND_BADGE: Record<string, [string, string]> = { chapter: ["CH", "accent"], section: [" §", "mute"], cmd: [" $", "shCmd"], term: ["Aa", "an5"], exercise: [" ✎", "warn"] };

export class App {
  readonly hits = new HitMap();
  cols: number;
  rows: number;
  chapterId = "";
  chapter!: Chapter;
  doc!: Doc;
  scroll = 0;
  hscroll = 0;
  overlay: Overlay | null = null;
  toastMsg: { text: string; until: number } | null = null;
  splashAt: number | null;
  themePref: "" | ThemeName;
  sysDark: boolean;
  private now: () => number;
  private ui: UiState = newUi();
  private uiByCh = new Map<string, UiState>();
  private layoutW = -1;
  private widgets: { line: number; rows: number; key: string; name: string; args: any }[] = [];
  private acts: { line: number; act: string }[] = [];
  private focusIdx = -1;
  private labSt = new Map<string, any>();
  private labFocus: string | null = null;
  private sbOpen: boolean;
  private sbFocus = false;
  private sbCur = 0;
  private sbTop = 0;
  private collapsed = new Set<string>();
  private hoverId: string | null = null;
  private dragging: Region | null = null;
  private index: Entry[] | null = null;
  private prog = new Map<string, [number, number]>();
  private lastRd: Rect = rect(0, 0, 0, 0);
  private pendingRelayout = false;

  constructor(readonly book: Book, readonly store: Store, readonly host: Host, o: AppOptions) {
    this.cols = o.cols; this.rows = o.rows;
    this.now = o.now ?? Date.now;
    const pref = o.theme ?? store.theme;
    this.themePref = pref === "dark" || pref === "light" ? pref : "";
    this.sysDark = o.sysDark ?? true;
    this.sbOpen = o.cols >= DOCK_MIN;
    const last = store.last.split("#")[0];
    const start = book.byId.has(last) || SPECIAL_IDS.includes(last) ? last : book.chapters[0].id;
    this.splashAt = o.splash === false ? null : this.now();
    this.go(start, undefined, true);
  }

  // ---------- theme, geometry ----------
  get themeName(): ThemeName { return this.themePref || (this.sysDark ? "dark" : "light"); }
  private get docked() { return this.sbOpen && this.cols >= DOCK_MIN; }
  private get sbShown() { return this.sbOpen; }
  private readerRect(): Rect { const sbw = this.docked ? SB_W + 1 : 0; return rect(sbw, 1, Math.max(10, this.cols - sbw), Math.max(1, this.rows - 2)); }
  private contentW(): number { return clamp(this.readerRect().w - 5, 24, MAX_W); }
  private contentX(rd: Rect): number { return rd.x + Math.max(2, Math.floor((rd.w - 1 - this.contentW()) / 2)); }
  vars = (k: string): string => { const v = this.store.vals[k]; return v !== undefined && v !== "" ? String(v) : this.book.vars[k]?.default ?? k; };
  private splashActive() { return this.splashAt !== null && this.now() - this.splashAt < SPLASH_MS; }

  resize(cols: number, rows: number) {
    this.cols = cols; this.rows = rows;
    if (cols < DOCK_MIN && this.docked === false) { /* overlay mode keeps its own state */ }
    this.relayout();
    this.scroll = clamp(this.scroll, 0, this.maxScroll());
  }

  wantsTick(): boolean {
    if (this.splashActive()) return true;
    if (this.toastMsg && this.now() < this.toastMsg.until) return true;
    return this.widgets.some((w) => { const lab = LABS[w.name]; return lab?.animated?.(this.labState(w.key, w.name, w.args)); });
  }

  toast(text: string, ms = 2200) { this.toastMsg = { text, until: this.now() + ms }; }

  // ---------- navigation ----------
  private chapterFor(id: string): Chapter { return this.book.byId.get(id) ?? buildSpecial(this.book, this.store, id) ?? this.book.chapters[0]; }

  go(route: string, anchor?: string, initial = false) {
    const [id, a] = route.split("#");
    const target = anchor ?? a;
    const known = this.book.byId.has(id) || SPECIAL_IDS.includes(id);
    if (!known) { this.toast(`No page "${id}"`); return; }
    if (id !== this.chapterId) {
      this.uiByCh.set(this.chapterId, this.ui);
      this.chapterId = id;
      this.ui = this.uiByCh.get(id) ?? newUi();
      this.hscroll = 0; this.focusIdx = -1; this.labFocus = null;
    }
    this.layoutW = -1;
    this.relayout();
    const line = target ? this.doc.anchors.get(target) : undefined;
    this.scroll = clamp(line !== undefined ? Math.max(0, line - 1) : 0, 0, this.maxScroll());
    if (!initial || !SPECIAL_IDS.includes(id)) { this.store.last = id; this.store.save(); }
    this.syncSidebar();
  }

  private relayout() {
    const c = this.chapterFor(this.chapterId);
    this.chapter = c;
    const i = this.book.chapters.indexOf(c);
    const nav = (x?: Chapter) => (x ? { id: x.id, title: x.title } : undefined);
    this.doc = layoutChapter(c, {
      width: this.contentW(), vars: this.vars, ui: this.ui, isDone: (id) => this.store.isDone(id),
      labRows: (key, name, args, w) => { const lab = LABS[name]; return lab ? lab.rows(w, this.labState(key, name, args)) : undefined; },
      prev: i > 0 ? nav(this.book.chapters[i - 1]) : undefined, next: i >= 0 ? nav(this.book.chapters[i + 1]) : undefined,
      partTitle: this.book.parts.find((p) => p.id === c.part)?.title,
    });
    this.layoutW = this.contentW();
    this.widgets = [];
    this.acts = [];
    this.doc.lines.forEach((l, idx) => {
      if (l.widget) this.widgets.push({ line: idx, ...l.widget });
      let last = "";
      for (const s of l.spans) { if (s.act && s.act !== last) { this.acts.push({ line: idx, act: s.act }); last = s.act; } else if (!s.act) last = ""; }
    });
    this.focusIdx = Math.min(this.focusIdx, this.acts.length - 1);
    this.prog.clear();
  }

  private labState(key: string, name: string, args: any) {
    if (!this.labSt.has(key)) this.labSt.set(key, LABS[name].init(args));
    return this.labSt.get(key);
  }

  private maxScroll() { return Math.max(0, this.doc.lines.length - this.readerRect().h); }
  private scrollBy(n: number) { this.scroll = clamp(this.scroll + n, 0, this.maxScroll()); }
  private pan(n: number) { this.hscroll = Math.max(0, this.hscroll + n); }

  private chapterIndex() { return this.book.chapters.findIndex((c) => c.id === this.chapterId); }
  private step(d: number) {
    const i = this.chapterIndex();
    const j = clamp((i < 0 ? 0 : i) + d, 0, this.book.chapters.length - 1);
    if (j !== i) this.go(this.book.chapters[j].id);
  }
  private sections(): { anchor: string; line: number }[] {
    return this.chapter.blocks.filter((b) => b.t === "h" && b.level === 2).map((b) => ({ anchor: b.id as string, line: this.doc.anchors.get(b.id) ?? 0 }));
  }
  private jumpSection(d: number) {
    const s = this.sections();
    if (!s.length) return;
    const cur = s.filter((x) => x.line <= this.scroll + 1).length - 1;
    const j = clamp(d > 0 ? cur + 1 : (s[cur]?.line ?? 0) < this.scroll ? cur : cur - 1, -1, s.length - 1);
    this.scroll = j < 0 ? 0 : clamp(s[j].line - 1, 0, this.maxScroll());
  }

  // ---------- sidebar ----------
  private progress(c: Chapter): [number, number] {
    let p = this.prog.get(c.id);
    if (!p) { const ids = itemIds(c); p = [ids.filter((i) => this.store.isDone(i)).length, ids.length]; this.prog.set(c.id, p); }
    return p;
  }
  private totalProgress(): [number, number] {
    let d = 0, t = 0;
    for (const c of this.book.chapters) { const [a, b] = this.progress(c); d += a; t += b; }
    return [d, t];
  }
  private sbRows(): SbRow[] {
    const rows: SbRow[] = [];
    for (const part of this.book.parts) {
      const chs = this.book.chapters.filter((c) => c.part === part.id);
      if (!chs.length) continue;
      rows.push({ kind: "part", id: part.id, text: part.title });
      if (this.collapsed.has(part.id)) continue;
      for (const c of chs) {
        rows.push({ kind: "chapter", id: c.id, text: c.title, num: c.num });
        if (c.id === this.chapterId) for (const s of this.chapter.blocks) if (s.t === "h" && s.level === 2) rows.push({ kind: "section", id: c.id, anchor: s.id, text: s.text });
      }
    }
    rows.push({ kind: "head", id: "tools", text: "Tools" });
    for (const id of SPECIAL_IDS) rows.push({ kind: "special", id, text: SPECIAL_TITLES[id].title });
    return rows;
  }
  private syncSidebar() {
    const rows = this.sbRows();
    const i = rows.findIndex((r) => (r.kind === "chapter" || r.kind === "special") && r.id === this.chapterId);
    if (i >= 0) { this.sbCur = i; const h = this.rows - 4; if (i < this.sbTop || i >= this.sbTop + h) this.sbTop = Math.max(0, i - 3); }
  }
  private openRow(r: SbRow) {
    if (r.kind === "part") { if (this.collapsed.has(r.id)) this.collapsed.delete(r.id); else this.collapsed.add(r.id); }
    else if (r.kind === "chapter" || r.kind === "special") { this.go(r.id); if (!this.docked) this.sbOpen = false; }
    else if (r.kind === "section") { this.go(r.id, r.anchor); if (!this.docked) this.sbOpen = false; }
  }

  // ---------- actions ----------
  act(a: string) {
    const i = a.indexOf(":");
    const kind = a.slice(0, i), arg = a.slice(i + 1);
    switch (kind) {
      case "copy": {
        const t = this.doc.copy.get(arg);
        if (t !== undefined) { this.host.copy(t); this.toast(`Copied ${t.split("\n").length} line${t.includes("\n") ? "s" : ""} to the clipboard`); }
        break;
      }
      case "open": this.ui.open[arg] = !this.ui.open[arg]; this.relayout(); break;
      case "hint": this.ui.hints[arg] = (this.ui.hints[arg] || 0) + 1; this.relayout(); break;
      case "sol": this.ui.sol[arg] = !this.ui.sol[arg]; this.relayout(); break;
      case "done": this.store.mark(arg, !this.store.isDone(arg)); this.relayout(); break;
      case "ans": this.answer(arg); break;
      case "var": this.openPrompt(arg); break;
      case "ask": this.openAnswerPrompt(arg); break;
      case "link": this.host.copy(arg); this.toast(arg.startsWith("http") ? "Link copied; paste it in a browser" : "Copied " + arg); break;
      case "go": this.go(arg); break;
      case "theme": this.cycleTheme(); break;
      case "sidebar": this.sbOpen = !this.sbOpen; this.relayout(); break;
      case "search": this.openPalette(); break;
    }
  }

  private answer(arg: string) {
    const j = arg.lastIndexOf(":"), qk = arg.slice(0, j), oi = Number(arg.slice(j + 1));
    const q = this.doc.quiz.get(qk);
    if (!q) return;
    const cur = this.ui.ans[qk] || [];
    this.ui.ans[qk] = q.multi ? (cur.includes(oi) ? cur.filter((x) => x !== oi) : [...cur, oi]) : [oi];
    this.checkCheckpoint(qk);
  }

  /** A typed answer is right when it matches an accepted answer after trim, lower-case and whitespace collapse (same rule as the page). */
  submitTyped(qk: string, text: string) {
    const q = this.doc.quiz.get(qk);
    if (!q?.typed) return;
    const norm = (s: string) => String(s).trim().toLowerCase().replace(/\s+/g, " ");
    this.ui.txt[qk] = text.trim();
    this.ui.ans[qk] = [q.typed.map(norm).includes(norm(text)) ? 1 : -1];
    this.checkCheckpoint(qk);
  }

  private checkCheckpoint(qk: string) {
    const cp = qk.slice(0, qk.lastIndexOf(":"));
    const keys = [...this.doc.quiz.keys()].filter((k) => k.startsWith(cp + ":"));
    const good = keys.every((k) => {
      const z = this.doc.quiz.get(k)!, s = this.ui.ans[k] || [];
      return z.typed ? s[0] === 1 : z.ok.every((x) => s.includes(x)) && s.every((x) => z.ok.includes(x));
    });
    if (good && !this.store.isDone(cp)) { this.store.mark(cp, true); this.toast("Checkpoint complete"); }
    this.relayout();
  }

  cycleTheme() {
    this.themePref = this.themePref === "" ? "light" : this.themePref === "light" ? "dark" : "";
    this.store.theme = this.themePref;
    this.store.save();
    this.toast("Theme: " + (this.themePref === "" ? "System" : this.themePref === "light" ? "Light" : "Dark"));
  }

  private openPalette() {
    this.index ??= buildIndex(this.book);
    this.overlay = { kind: "palette", f: field(), sel: 0, top: 0, results: this.paletteResults("") };
  }
  private paletteResults(q: string): Entry[] {
    if (!q.trim()) return this.index!.filter((e) => e.kind === "chapter");
    return search(this.index!, q);
  }
  private openPrompt(key: string) {
    const d = this.book.vars[key];
    const label = d?.label ?? key, dflt = d?.default ?? key;
    this.overlay = {
      kind: "prompt", f: field(this.store.vals[key] !== undefined ? String(this.store.vals[key]) : ""), label,
      desc: `${d?.desc ?? ""}  Default: ${dflt}`.trim(), hint: "enter save   esc cancel   empty = default",
      submit: (text) => { this.store.setVal(key, text.trim(), dflt); this.relayout(); this.toast(text.trim() ? `${label} set` : `${label} reset`); },
    };
  }
  private openAnswerPrompt(qk: string) {
    this.overlay = { kind: "prompt", f: field(this.ui.txt[qk] ?? ""), label: "Your answer", desc: "Type the answer and press enter.", hint: "enter check   esc cancel", submit: (text) => this.submitTyped(qk, text) };
  }

  // ---------- input ----------
  handle(ev: InputEvent) {
    if (this.splashAt !== null && (ev.type === "key" || (ev.type === "mouse" && ev.action === "down"))) { const was = this.splashActive(); this.splashAt = null; if (was) return; }
    if (ev.type === "key") this.onKey(ev);
    else if (ev.type === "mouse") this.onMouse(ev);
    else if (ev.type === "paste") this.onPaste(ev.text);
  }

  private onPaste(text: string) {
    const o = this.overlay;
    if (o && (o.kind === "palette" || o.kind === "prompt")) { editField(o.f, { type: "paste", text }); if (o.kind === "palette") this.refreshPalette(o); }
  }

  private refreshPalette(o: Extract<Overlay, { kind: "palette" }>) { o.results = this.paletteResults(o.f.text); o.sel = 0; o.top = 0; }

  private onKey(e: KeyEvent) {
    const o = this.overlay;
    if (o) return this.onOverlayKey(o, e);
    if (e.ctrl && e.key === "c") return this.host.quit();
    if (this.labFocus) {
      const w = this.widgets.find((x) => x.key === this.labFocus);
      if (e.key === "escape") { this.labFocus = null; return; }
      const lab = w && LABS[w.name];
      if (lab?.key && lab.key(e, this.labState(w!.key, w!.name, w!.args), { relayout: () => this.relayout(), toast: (m) => this.toast(m) })) return;
    }
    if (this.sbFocus && this.sbOpen) return this.onSidebarKey(e);
    const k = e.key;
    const page = Math.max(1, this.readerRect().h - 2);
    if (k === "q" && !e.ctrl) return this.host.quit();
    if (k === "/" || (e.ctrl && (k === "p" || k === "k"))) return this.openPalette();
    if (k === "?" || k === "f1") { this.overlay = { kind: "help" }; return; }
    if (k === "t" && !e.ctrl) return this.cycleTheme();
    if (k === "b" && !e.ctrl) { this.sbOpen = !this.sbOpen; this.relayout(); return; }
    if (k === "s" && !e.ctrl) { if (!this.sbOpen) { this.sbOpen = true; this.relayout(); } this.sbFocus = true; return; }
    if (k === "n" && !e.ctrl) return this.step(1);
    if (k === "p" && !e.ctrl) return this.step(-1);
    if (k === "]") return this.jumpSection(1);
    if (k === "[") return this.jumpSection(-1);
    if (k === "e" && !e.ctrl) return this.toggleAllCards();
    if (k === "down" || k === "j") return this.scrollBy(1);
    if (k === "up" || k === "k") return this.scrollBy(-1);
    if (k === "pagedown" || k === "space" || (e.ctrl && k === "d")) return this.scrollBy(k === "space" || k === "pagedown" ? page : Math.floor(page / 2));
    if (k === "pageup" || k === "u" || (e.ctrl && k === "u")) return this.scrollBy(-(k === "pageup" ? page : Math.floor(page / 2)));
    if (k === "home" || k === "g") { this.scroll = 0; return; }
    if (k === "end" || k === "G") { this.scroll = this.maxScroll(); return; }
    if (k === "right" || k === "l") return this.pan(8);
    if (k === "left" || k === "h") return this.pan(-8);
    if (k === "tab") return this.focusNext(e.shift ? -1 : 1);
    if (k === "escape") { this.focusIdx = -1; return; }
    if (k === "enter") { if (this.focusIdx >= 0 && this.acts[this.focusIdx]) this.act(this.acts[this.focusIdx].act); else if (this.widgets.length) this.grabNearestLab(); return; }
    if (e.ctrl && k === "l") return;
  }

  private grabNearestLab() {
    const mid = this.scroll + Math.floor(this.readerRect().h / 2);
    const w = [...this.widgets].filter((x) => LABS[x.name]).sort((a, b) => Math.abs(a.line - mid) - Math.abs(b.line - mid))[0];
    if (w) this.labFocus = w.key;
  }

  private toggleAllCards() {
    const cards = this.chapter.blocks.filter((b) => b.t === "cmd");
    if (!cards.length) return;
    const ids = cards.map((b) => "cmd-" + (b.id || b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")));
    const open = !ids.every((i) => this.ui.open[i]);
    for (const i of ids) this.ui.open[i] = open;
    this.relayout();
    this.toast(open ? "All command cards expanded" : "All command cards collapsed");
  }

  private focusNext(d: number) {
    if (!this.acts.length) return;
    let i = this.focusIdx;
    if (i < 0) {
      const first = this.acts.findIndex((a) => a.line >= this.scroll);
      i = d > 0 ? (first < 0 ? 0 : first) : this.acts.length - 1;
    } else i = (i + d + this.acts.length) % this.acts.length;
    this.focusIdx = i;
    const line = this.acts[i].line, h = this.readerRect().h;
    if (line < this.scroll || line >= this.scroll + h - 1) this.scroll = clamp(line - Math.floor(h / 3), 0, this.maxScroll());
  }

  private onSidebarKey(e: KeyEvent) {
    const rows = this.sbRows();
    const k = e.key;
    if (k === "escape" || k === "s" || k === "tab") { this.sbFocus = false; return; }
    if (k === "down" || k === "j") this.sbCur = Math.min(rows.length - 1, this.sbCur + 1);
    else if (k === "up" || k === "k") this.sbCur = Math.max(0, this.sbCur - 1);
    else if (k === "pagedown") this.sbCur = Math.min(rows.length - 1, this.sbCur + 10);
    else if (k === "pageup") this.sbCur = Math.max(0, this.sbCur - 10);
    else if (k === "home" || k === "g") this.sbCur = 0;
    else if (k === "end" || k === "G") this.sbCur = rows.length - 1;
    else if (k === "enter" || k === "right" || k === "l" || k === "space") { const r = rows[this.sbCur]; if (r) { this.openRow(r); if (r.kind === "chapter" || r.kind === "special" || r.kind === "section") this.sbFocus = false; } }
    else if ((k === "left" || k === "h") && rows[this.sbCur]?.kind === "part") this.collapsed.add(rows[this.sbCur].id);
    else if (k === "q") return this.host.quit();
    const h = this.rows - 4;
    if (this.sbCur < this.sbTop) this.sbTop = this.sbCur;
    if (this.sbCur >= this.sbTop + h) this.sbTop = this.sbCur - h + 1;
  }

  private onOverlayKey(o: Overlay, e: KeyEvent) {
    if (o.kind === "help") { this.overlay = null; return; }
    if (e.key === "escape" || (e.ctrl && e.key === "c")) { this.overlay = null; return; }
    if (o.kind === "prompt") {
      if (e.key === "enter") { this.overlay = null; o.submit(o.f.text); return; }
      editField(o.f, e);
      return;
    }
    const n = o.results.length, vis = this.paletteRows();
    if (e.key === "down" || (e.ctrl && e.key === "n")) o.sel = Math.min(n - 1, o.sel + 1);
    else if (e.key === "up" || (e.ctrl && e.key === "p")) o.sel = Math.max(0, o.sel - 1);
    else if (e.key === "pagedown") o.sel = Math.min(n - 1, o.sel + vis);
    else if (e.key === "pageup") o.sel = Math.max(0, o.sel - vis);
    else if (e.key === "enter") { const r = o.results[o.sel]; this.overlay = null; if (r) this.go(r.route); return; }
    else { if (editField(o.f, e)) this.refreshPalette(o); return; }
    if (o.sel < o.top) o.top = o.sel;
    if (o.sel >= o.top + vis) o.top = o.sel - vis + 1;
  }
  private paletteRows() { return Math.max(3, Math.min(18, this.rows - 8)); }

  private onMouse(e: MouseEvent) {
    const { x, y } = e;
    const o = this.overlay;
    if (e.action === "wheel") {
      if (o?.kind === "palette") { o.top = clamp(o.top + e.dir! * 3, 0, Math.max(0, o.results.length - this.paletteRows())); return; }
      if (o) return;
      const r = this.hits.at(x, y, (z) => !!z.wheel);
      if (r) return r.wheel!(e.dir!, !!e.horizontal || e.shift);
      if (e.horizontal || e.shift) this.pan(e.dir! * 8); else this.scrollBy(e.dir! * 3);
      return;
    }
    if (e.action === "move") { const r = this.hits.at(x, y, (z) => !!z.hover); const id = r?.id ?? null; if (id !== this.hoverId) this.hoverId = id; return; }
    if (e.action === "up") { this.dragging = null; return; }
    if (e.action === "drag") { if (this.dragging) this.dragging.drag!(x, y); return; }
    if (e.action === "down" && e.button === 0) {
      const r = this.hits.at(x, y, (z) => !!(z.click || z.drag));
      if (!r && o) { if (o.kind !== "prompt") this.overlay = null; return; }
      this.dragging = r?.drag ? r : null;
      r?.click?.(x, y);
      r?.drag?.(x, y);
      this.focusIdx = -1;
    }
  }

  // ---------- drawing ----------
  render(): Screen {
    const theme = new Theme(this.themeName);
    const scr = new Screen(this.cols, this.rows);
    scr.clear(theme.rgb("bg"), theme.rgb("fg"));
    this.hits.clear();
    const p = new Painter(scr, theme, this.hits);
    p.hoverId = this.hoverId;
    if (this.splashActive()) { drawSplash(p, this.now() - this.splashAt!, "A hands-on course for your Mac terminal"); return scr; }
    if (this.layoutW !== this.contentW()) this.relayout();
    this.scroll = clamp(this.scroll, 0, this.maxScroll());
    this.drawReader(p);
    if (this.sbShown) this.drawSidebar(p);
    this.drawTop(p);
    this.drawBottom(p);
    const o = this.overlay;
    if (o?.kind === "palette") this.drawPalette(p, o);
    else if (o?.kind === "help") this.drawHelp(p);
    else if (o?.kind === "prompt") this.drawPrompt(p, o);
    return scr;
  }

  private region(p: Painter, r: Rect, id: string, click: () => void, extra: Partial<Region> = {}) {
    p.hits.add({ rect: r, id, click, hover: true, ...extra });
    if (p.hoverId === id) p.decorate(r, A_UNDER);
  }

  private drawReader(p: Painter) {
    const rd = this.readerRect();
    this.lastRd = rd;
    const cw = this.contentW(), cx = this.contentX(rd);
    const area = rect(cx, rd.y, cw, rd.h);
    const lines = this.doc.lines;
    const focused = this.focusIdx >= 0 ? this.acts[this.focusIdx] : undefined;
    p.within(rd, () => {
      for (let row = 0; row < rd.h; row++) {
        const idx = this.scroll + row;
        const l = lines[idx];
        if (!l) break;
        const y = rd.y + row;
        if (l.bg) p.fill(rect(cx, y, cw, 1), l.bg);
        const base: Style = { fg: "fg", bg: l.bg };
        let seen = "", n = 0;
        const onAct = (act: string, r: Rect) => {
          const id = `a:${idx}:${n++}`;
          this.region(p, r, id, () => this.act(act));
          if (focused && focused.line === idx && focused.act === act && act !== seen) { p.decorate(r, A_INV); seen = act; }
        };
        if (l.pre) {
          p.within(area, () => p.spans(cx - this.hscroll, y, l.spans, base, onAct));
          const lw = spansWidth(l.spans);
          if (this.hscroll > 0) p.text(cx - 1, y, "‹", { fg: "accent", b: true });
          if (lw - this.hscroll > cw) p.text(cx + cw, y, "›", { fg: "accent", b: true });
        } else p.within(area, () => p.spans(cx, y, l.spans, base, onAct));
      }
      for (const w of this.widgets) {
        if (w.line >= this.scroll + rd.h || w.line + w.rows <= this.scroll) continue;
        const lab = LABS[w.name];
        if (!lab) continue;
        const r = rect(cx, rd.y + w.line - this.scroll, cw, w.rows);
        p.hits.add({ rect: r, id: "lab:" + w.key, click: () => { this.labFocus = w.key; } });
        const ctx: LabCtx = {
          p, r, hits: p.hits, focus: this.labFocus === w.key, hoverId: this.hoverId, now: this.now(),
          relayout: () => { this.pendingRelayout = true; }, toast: (m) => this.toast(m), grab: () => { this.labFocus = w.key; },
        };
        p.within(r, () => lab.draw(ctx, this.labState(w.key, w.name, w.args)));
      }
    });
    if (this.pendingRelayout) { this.pendingRelayout = false; this.relayout(); }
    // scrollbar
    const total = lines.length;
    if (total > rd.h) {
      const x = rd.x + rd.w - 1, th = Math.max(1, Math.round((rd.h * rd.h) / total)), travel = rd.h - th;
      const top = this.maxScroll() ? Math.round((this.scroll / this.maxScroll()) * travel) : 0;
      for (let i = 0; i < rd.h; i++) p.text(x, rd.y + i, i >= top && i < top + th ? "┃" : "│", { fg: i >= top && i < top + th ? "mute" : "line" });
      const to = (yy: number) => { this.scroll = clamp(Math.round(((yy - rd.y - th / 2) / Math.max(1, travel)) * this.maxScroll()), 0, this.maxScroll()); };
      p.hits.add({ rect: rect(x, rd.y, 1, rd.h), id: "scrollbar", click: (_x, yy) => to(yy), drag: (_x, yy) => to(yy) });
    }
  }

  private drawTop(p: Painter) {
    const w = this.cols;
    p.fill(rect(0, 0, w, 1), "panel");
    const st = (fg: string, extra: Style = {}): Style => ({ fg, bg: "panel", ...extra });
    let x = 0;
    const burger = rect(0, 0, 3, 1);
    p.text(0, 0, " ≡ ", st("mute"));
    this.region(p, burger, "tb:burger", () => this.act("sidebar:"));
    x = 3;
    p.text(x, 0, "CODEX_LMS", st("accent", { b: true })); x += 10;
    const [d, t] = this.totalProgress();
    const bar = t ? Math.round((d / t) * 10) : 0;
    const search = " ⌕ Search  / ";
    const theme = ` ◐ ${this.themePref === "" ? "System" : this.themePref === "light" ? "Light" : "Dark"} `;
    const prog = `${"▰".repeat(bar)}${"▱".repeat(10 - bar)} ${d}/${t} `;
    const right = strWidth(search) + strWidth(theme) + strWidth(prog) + 2;
    const title = this.chapter.title;
    if (w - x - right > 6) p.text(x, 0, "· " + ellipsize(title, w - x - right - 3), st("mute"));
    let rx = w - strWidth(theme);
    p.text(rx, 0, theme, { fg: "fg", bg: "panel2" });
    this.region(p, rect(rx, 0, strWidth(theme), 1), "tb:theme", () => this.act("theme:"));
    rx -= strWidth(search) + 1;
    p.text(rx, 0, search, { fg: "fg", bg: "panel2" });
    this.region(p, rect(rx, 0, strWidth(search), 1), "tb:search", () => this.act("search:"));
    rx -= strWidth(prog) + 1;
    if (rx > x + 12) p.text(rx, 0, prog, st("dim"));
    p.text(0, 0, "", {});
  }

  private drawBottom(p: Painter) {
    const y = this.rows - 1, w = this.cols;
    p.fill(rect(0, y, w, 1), "panel");
    const total = this.doc.lines.length, pct = this.maxScroll() ? Math.round((this.scroll / this.maxScroll()) * 100) : 100;
    const right = ` ${pct}% `;
    p.text(w - right.length, y, right, { fg: "mute", bg: "panel" });
    if (this.toastMsg && this.now() < this.toastMsg.until) { p.text(1, y, ` ${this.toastMsg.text} `, { fg: "accentInk", bg: "accent", b: true }); return; }
    const hints: [string, string][] = this.labFocus ? [["esc", "leave lab"]] : this.sbFocus ? [["↑↓", "move"], ["enter", "open"], ["esc", "back"]] :
      [["↑↓", "scroll"], ["n p", "chapter"], ["[ ]", "section"], ["tab", "select"], ["/", "search"], ["t", "theme"], ["b", "sidebar"], ["?", "help"], ["q", "quit"]];
    let x = 1;
    for (const [k, v] of hints) {
      const seg = k.length + v.length + 3;
      if (x + seg > w - right.length - 1) break;
      p.text(x, y, k, { fg: "accent", bg: "panel", b: true });
      p.text(x + k.length + 1, y, v, { fg: "mute", bg: "panel" });
      x += seg + 1;
    }
    void total;
  }

  private drawSidebar(p: Painter) {
    const rd = this.readerRect();
    const docked = this.docked;
    const r = rect(0, 1, SB_W, this.rows - 2);
    p.fill(r, "panel");
    if (docked) for (let y = 1; y < this.rows - 1; y++) p.text(SB_W, y, "│", { fg: "line" });
    else for (let y = 1; y < this.rows - 1; y++) p.text(SB_W - 1, y, "▕", { fg: "line", bg: "panel" });
    p.hits.add({ rect: r, id: "sb", wheel: (d) => { this.sbTop = clamp(this.sbTop + d * 3, 0, Math.max(0, this.sbRows().length - (this.rows - 4))); } });
    void rd;
    const rows = this.sbRows();
    const h = this.rows - 4;
    p.text(2, 1, "CONTENTS", { fg: "dim", b: true, bg: "panel" });
    const curSection = this.currentSection();
    for (let i = 0; i < h; i++) {
      const row = rows[this.sbTop + i];
      if (!row) break;
      const y = 2 + i;
      const rr = rect(0, y, SB_W - 1, 1);
      const idx = this.sbTop + i;
      const isCur = (row.kind === "chapter" || row.kind === "special") && row.id === this.chapterId;
      const cursor = this.sbFocus && idx === this.sbCur;
      const bg = cursor ? "sel" : isCur ? "sel" : "panel";
      p.fill(rr, bg);
      const base: Style = { bg };
      const avail = SB_W - 4;
      if (row.kind === "part") {
        const open = !this.collapsed.has(row.id);
        p.text(1, y, `${open ? "▾" : "▸"} ${ellipsize(row.text.toUpperCase(), avail - 2)}`, { ...base, fg: "dim", b: true });
      } else if (row.kind === "head") {
        p.text(1, y, "─ " + row.text.toUpperCase() + " ", { ...base, fg: "dim", b: true });
      } else if (row.kind === "chapter") {
        const c = this.book.byId.get(row.id)!;
        const [d, t] = this.progress(c);
        const g = !t ? "·" : d === t ? "●" : d ? "◐" : "○";
        p.text(isCur ? 0 : 1, y, isCur ? "▌" : " ", { ...base, fg: "accent" });
        p.text(2, y, g, { ...base, fg: d === t && t ? "ok" : d ? "warn" : "dim" });
        p.text(4, y, String(row.num).padStart(2, "0"), { ...base, fg: "dim" });
        p.text(7, y, ellipsize(row.text, avail - 5), { ...base, fg: isCur ? "accent" : "fg", b: isCur });
      } else if (row.kind === "special") {
        p.text(isCur ? 0 : 1, y, isCur ? "▌" : " ", { ...base, fg: "accent" });
        p.text(3, y, ellipsize(row.text, avail - 2), { ...base, fg: isCur ? "accent" : "fg", b: isCur });
      } else {
        const on = row.anchor === curSection;
        p.text(7, y, (on ? "▸ " : "· ") + ellipsize(row.text, avail - 9), { ...base, fg: on ? "accent" : "mute" });
      }
      this.region(p, rr, "sb:" + idx, () => { this.sbCur = idx; this.openRow(row); }, {});
      if (cursor) p.decorate(rr, A_BOLD);
    }
    if (rows.length > h) p.text(SB_W - 2, 2 + Math.round((this.sbTop / Math.max(1, rows.length - h)) * (h - 1)), "┃", { fg: "mute", bg: "panel" });
  }

  private currentSection(): string | undefined {
    let cur: string | undefined;
    for (const s of this.sections()) if (s.line <= this.scroll + 2) cur = s.anchor;
    return cur;
  }

  private box(p: Painter, r: Rect, title: string) {
    p.fill(rect(r.x + 1, r.y + 1, r.w, r.h), "bg"); // soft shadow
    p.box(r, { fg: "accent", bg: "panel2" }, "panel2");
    p.text(r.x + 2, r.y, ` ${title} `, { fg: "accent", bg: "panel2", b: true });
    p.hits.add({ rect: r, id: "ov", click: () => {} });
  }

  private drawPalette(p: Painter, o: Extract<Overlay, { kind: "palette" }>) {
    const w = Math.min(86, this.cols - 4), vis = this.paletteRows(), h = vis + 5;
    const r = rect(Math.floor((this.cols - w) / 2), Math.max(1, Math.floor((this.rows - h) / 3)), w, h);
    this.box(p, r, "Search");
    const bg = "panel2";
    p.text(r.x + 2, r.y + 1, "⌕ ", { fg: "accent", bg, b: true });
    const q = o.f.text;
    if (q) p.text(r.x + 4, r.y + 1, q, { fg: "fg", bg });
    else p.text(r.x + 6, r.y + 1, "chapters, sections, commands, terms…", { fg: "dim", bg });
    p.text(r.x + 4 + strWidth(q.slice(0, o.f.cur)), r.y + 1, q[o.f.cur] ?? " ", { fg: "accentInk", bg: "accent" });
    p.text(r.x + 1, r.y + 2, "─".repeat(w - 2), { fg: "line", bg });
    if (!o.results.length) p.text(r.x + 3, r.y + 4, "Nothing matches that.", { fg: "mute", bg });
    for (let i = 0; i < vis; i++) {
      const e = o.results[o.top + i];
      if (!e) break;
      const idx = o.top + i, y = r.y + 3 + i, sel = idx === o.sel;
      const rr = rect(r.x + 1, y, w - 2, 1);
      p.fill(rr, sel ? "sel" : bg);
      const b = KIND_BADGE[e.kind];
      p.text(r.x + 2, y, sel ? "▌" : " ", { fg: "accent", bg: sel ? "sel" : bg });
      p.text(r.x + 3, y, b[0], { fg: b[1], bg: sel ? "sel" : bg, b: true });
      const tw = Math.min(strWidth(e.title), Math.floor((w - 12) * 0.6));
      p.text(r.x + 7, y, ellipsize(e.title, tw), { fg: sel ? "accent" : "fg", bg: sel ? "sel" : bg, b: sel });
      p.text(r.x + 8 + tw, y, ellipsize(e.detail.replace(/\s+/g, " "), Math.max(0, w - 12 - tw)), { fg: "dim", bg: sel ? "sel" : bg });
      this.region(p, rr, "pal:" + idx, () => { this.overlay = null; this.go(e.route); });
    }
    const foot = `${o.results.length} result${o.results.length === 1 ? "" : "s"}   ↑↓ select   enter open   esc close`;
    p.text(r.x + 2, r.y + h - 2, ellipsize(foot, w - 4), { fg: "dim", bg });
  }

  private drawPrompt(p: Painter, o: Extract<Overlay, { kind: "prompt" }>) {
    const w = Math.min(70, this.cols - 4), h = 7;
    const r = rect(Math.floor((this.cols - w) / 2), Math.floor((this.rows - h) / 3), w, h);
    this.box(p, r, o.label);
    const bg = "panel2";
    if (o.desc) p.text(r.x + 2, r.y + 1, ellipsize(o.desc, w - 4), { fg: "mute", bg });
    p.fill(rect(r.x + 2, r.y + 3, w - 4, 1), "panel");
    p.text(r.x + 3, r.y + 3, ellipsize(o.f.text, w - 8), { fg: "fg", bg: "panel" });
    p.text(r.x + 3 + strWidth(o.f.text.slice(0, o.f.cur)), r.y + 3, o.f.text[o.f.cur] ?? " ", { fg: "accentInk", bg: "accent" });
    p.text(r.x + 2, r.y + 5, o.hint, { fg: "dim", bg });
  }

  private drawHelp(p: Painter) {
    const L: [string, string][] = [
      ["↑ ↓  j k", "scroll"], ["space  PgDn / PgUp", "page down / up"], ["g  G", "top / bottom"], ["n  p", "next / previous chapter"],
      ["]  [", "next / previous section"], ["← →  h l", "pan wide diagrams sideways"], ["tab  shift-tab", "step through buttons and links"],
      ["enter", "press the selected button, or enter a lab"], ["e", "expand or collapse every command card"], ["/  ctrl-p", "search everything"],
      ["s", "move around the contents list"], ["b", "show or hide the contents"], ["t", "theme: system, light, dark"], ["?", "this help"], ["q  ctrl-c", "quit"],
    ];
    const w = Math.min(70, this.cols - 4), h = L.length + 8;
    const r = rect(Math.floor((this.cols - w) / 2), Math.max(1, Math.floor((this.rows - h) / 3)), w, h);
    this.box(p, r, "Keys");
    const bg = "panel2";
    L.forEach(([k, v], i) => { p.text(r.x + 3, r.y + 2 + i, k, { fg: "accent", bg, b: true }); p.text(r.x + 26, r.y + 2 + i, ellipsize(v, w - 29), { fg: "fg", bg }); });
    const y = r.y + 3 + L.length;
    p.text(r.x + 3, y, "Mouse", { fg: "dim", bg, b: true });
    p.text(r.x + 3, y + 1, ellipsize("click buttons, links and rows · wheel scrolls · shift+wheel pans", w - 6), { fg: "mute", bg });
    p.text(r.x + 3, y + 2, ellipsize("progress is saved to the same file the Mac app uses", w - 6), { fg: "mute", bg });
    p.text(r.x + 3, r.y + h - 2, "press any key to close", { fg: "dim", bg });
  }
}
