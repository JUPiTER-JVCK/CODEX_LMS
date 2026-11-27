// The interactive app: state, input handling and drawing. No terminal in here, so tests can drive it headlessly.

import { buildIndex, itemIds, search, type Book, type Chapter, type Entry } from "./book.ts";
import { layoutChapter, newUi, type Doc, type UiState } from "./blocks.ts";
import type { InputEvent, KeyEvent, MouseEvent } from "./input.ts";
import { LABS, type LabCtx } from "./labs.ts";
import "./lablib.ts";
import "./lablib2.ts";
import { A_BOLD, A_INV, A_UNDER, Screen } from "./screen.ts";
import { buildSpecial, SPECIAL_IDS, SPECIAL_TITLES } from "./specials.ts";
import { drawSplash, SPLASH_MS } from "./splash.ts";
import type { Store } from "./state.ts";
import { editField, editFieldEx, field, type TextField } from "./textedit.ts";
import { clipSpans, clipWidth, ellipsize, spansWidth, strWidth, type Span, type Style } from "./text.ts";
import { Theme, type ColorMode, type ThemeName } from "./theme.ts";
import { HitMap, Painter, rect, type Rect, type Region } from "./ui.ts";

export interface Host { copy(text: string): void; quit(): void }
export interface AppOptions { cols: number; rows: number; theme?: string; sysDark?: boolean; splash?: boolean; now?: () => number; colorMode?: ColorMode }

/** Below MIN_COLS x MIN_ROWS nothing fits sensibly, so the app says so instead of drawing a broken page. */
export const MIN_COLS = 30, MIN_ROWS = 10;
const MAX_W = 110, DOCK_MIN = 100;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Overlay =
  | { kind: "palette"; f: TextField; sel: number; top: number; results: Entry[] }
  | { kind: "help"; top: number }
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
  /** The contents list was closed because the window got too narrow to dock it; it comes back when the window widens again. */
  private sbAutoClosed = false;
  private colorMode: ColorMode;
  private maxPre = 0;
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
    this.colorMode = o.colorMode ?? "truecolor";
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
  /** The contents list is a drawer over the page (not docked beside it). */
  private get drawer() { return this.sbOpen && !this.docked; }
  /** Wider windows get a wider list, so chapter titles are not cut; a drawer never takes more than most of the window. */
  private get sbW(): number {
    const w = clamp(Math.round(this.cols * 0.25), 30, 40);
    return this.docked ? w : Math.min(w, Math.max(16, this.cols - 10));
  }
  private get tooSmall() { return this.cols < MIN_COLS || this.rows < MIN_ROWS; }
  private readerRect(): Rect { const sbw = this.docked ? this.sbW + 1 : 0; return rect(sbw, 1, Math.max(10, this.cols - sbw), Math.max(1, this.rows - 2)); }
  private contentW(): number { return clamp(this.readerRect().w - 5, 24, MAX_W); }
  private contentX(rd: Rect): number { return rd.x + Math.max(2, Math.floor((rd.w - 1 - this.contentW()) / 2)); }
  vars = (k: string): string => { const v = this.store.vals[k]; return v !== undefined && v !== "" ? String(v) : this.book.vars[k]?.default ?? k; };
  private splashActive() { return this.splashAt !== null && this.now() - this.splashAt < SPLASH_MS; }

  resize(cols: number, rows: number) {
    const wasDocked = this.docked;
    this.cols = cols; this.rows = rows;
    // A list docked beside the page must not turn into a drawer covering it when the window narrows (and returns when it widens).
    if (wasDocked && cols < DOCK_MIN) { this.sbOpen = false; this.sbFocus = false; this.sbAutoClosed = true; }
    else if (cols >= DOCK_MIN && this.sbAutoClosed) { this.sbOpen = true; this.sbAutoClosed = false; }
    this.relayout();
    this.scroll = clamp(this.scroll, 0, this.maxScroll());
    this.hscroll = clamp(this.hscroll, 0, this.maxPan());
    this.syncSidebar();
  }

  private toggleSidebar() {
    this.sbAutoClosed = false;
    this.sbOpen = !this.sbOpen;
    this.sbFocus = this.sbOpen && !this.docked; // a drawer takes the keyboard; the docked list only when asked for with `s`
    if (!this.sbOpen) this.sbFocus = false;
    this.relayout();
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
    this.maxPre = 0;
    for (const l of this.doc.lines) if (l.pre) this.maxPre = Math.max(this.maxPre, spansWidth(l.spans));
    this.hscroll = clamp(this.hscroll, 0, this.maxPan());
  }

  private labState(key: string, name: string, args: any) {
    if (!this.labSt.has(key)) this.labSt.set(key, LABS[name].init(args));
    return this.labSt.get(key);
  }

  private maxScroll() { return Math.max(0, this.doc.lines.length - this.readerRect().h); }
  private scrollBy(n: number) { this.scroll = clamp(this.scroll + n, 0, this.maxScroll()); }
  /** How far the diagrams can slide: until their widest line ends at the right edge, no further. */
  private maxPan() { return Math.max(0, this.maxPre - this.contentW()); }
  private pan(n: number) { this.hscroll = clamp(this.hscroll + n, 0, this.maxPan()); }

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
    if (i >= 0) { this.sbCur = i; const h = Math.max(1, this.rows - 4); if (i < this.sbTop || i >= this.sbTop + h) this.sbTop = Math.max(0, i - 3); }
  }
  private openRow(r: SbRow) {
    if (r.kind === "part") { if (this.collapsed.has(r.id)) this.collapsed.delete(r.id); else this.collapsed.add(r.id); }
    else if (r.kind === "chapter" || r.kind === "special") { this.go(r.id); this.closeDrawer(); }
    else if (r.kind === "section") { this.go(r.id, r.anchor); this.closeDrawer(); }
  }

  private closeDrawer() { if (this.drawer) { this.sbOpen = false; this.sbFocus = false; this.relayout(); } }

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
      case "sidebar": this.toggleSidebar(); break;
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
  /** Feed one input event. Returns false when it cannot have changed anything on screen (a pointer drifting over empty space), so the caller can skip the frame. */
  handle(ev: InputEvent): boolean {
    if (this.splashAt !== null && (ev.type === "key" || (ev.type === "mouse" && ev.action === "down"))) { const was = this.splashActive(); this.splashAt = null; if (was) return true; }
    if (ev.type === "key") { this.hoverId = null; this.onKey(ev); return true; }
    if (ev.type === "mouse") return this.onMouse(ev);
    if (ev.type === "paste") { this.onPaste(ev.text); return true; }
    return false;
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
      // A lab scrolled out of sight must not keep swallowing keys the reader cannot see being typed.
      if (w && !this.widgetVisible(w)) this.labFocus = null;
    }
    if (this.labFocus) {
      const w = this.widgets.find((x) => x.key === this.labFocus);
      if (e.key === "escape") { this.labFocus = null; return; }
      const lab = w && LABS[w.name];
      if (lab?.key && lab.key(e, this.labState(w!.key, w!.name, w!.args), { relayout: () => this.relayout(), toast: (m) => this.toast(m) })) return;
    }
    if (this.sbFocus && this.sbOpen) return this.onSidebarKey(e);
    const k = e.key;
    const page = Math.max(1, this.readerRect().h - 2);
    if (this.globalKey(e)) return;
    if (k === "b" && !e.ctrl) return this.toggleSidebar();
    if (k === "s" && !e.ctrl) { if (!this.sbOpen) { this.sbOpen = true; this.relayout(); } this.sbFocus = true; return; }
    if (k === "n" && !e.ctrl) return this.step(1);
    if (k === "p" && !e.ctrl) return this.step(-1);
    if (k === "]") return this.jumpSection(1);
    if (k === "[") return this.jumpSection(-1);
    if (k === "e" && !e.ctrl) return this.toggleAllCards();
    if (k === "down" || k === "j") return this.scrollBy(1);
    if (k === "up" || k === "k") return this.scrollBy(-1);
    if (k === "space" && e.shift) return this.scrollBy(-page);
    if (k === "pagedown" || k === "space" || (e.ctrl && (k === "d" || k === "f"))) return this.scrollBy(k === "space" || k === "pagedown" || k === "f" ? page : Math.floor(page / 2));
    if (k === "pageup" || k === "u" || (e.ctrl && (k === "u" || k === "b"))) return this.scrollBy(-(k === "pageup" || k === "b" ? page : Math.floor(page / 2)));
    if (k === "home" || k === "g") { this.scroll = 0; return; }
    if (k === "end" || k === "G") { this.scroll = this.maxScroll(); return; }
    if (k === "right" || k === "l") return this.pan(8);
    if (k === "left" || k === "h") return this.pan(-8);
    if (k === "tab") return this.focusNext(e.shift ? -1 : 1);
    if (k === "escape") { this.focusIdx = -1; return; }
    if (k === "enter") { if (this.focusIdx >= 0 && this.acts[this.focusIdx]) this.act(this.acts[this.focusIdx].act); else if (this.widgets.length) this.grabNearestLab(); return; }
    if (e.ctrl && k === "l") return;
  }

  /** Keys every mode shares: quit, search, help, theme. Returns true when it took the key. */
  private globalKey(e: KeyEvent): boolean {
    const k = e.key;
    if (k === "q" && !e.ctrl) { this.host.quit(); return true; }
    if (k === "/" || (e.ctrl && (k === "p" || k === "k"))) { this.openPalette(); return true; }
    if (k === "?" || k === "f1") { this.overlay = { kind: "help", top: 0 }; return true; }
    if (k === "t" && !e.ctrl) { this.cycleTheme(); return true; }
    return false;
  }

  private widgetVisible(w: { line: number; rows: number }) { return w.line < this.scroll + this.readerRect().h && w.line + w.rows > this.scroll; }

  private grabNearestLab() {
    const mid = this.scroll + Math.floor(this.readerRect().h / 2);
    // Only a lab on screen: Enter must not silently hand the keyboard to one far above or below.
    const w = [...this.widgets].filter((x) => LABS[x.name] && this.widgetVisible(x)).sort((a, b) => Math.abs(a.line - mid) - Math.abs(b.line - mid))[0];
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
    if (this.drawer && (k === "escape" || k === "s" || k === "tab" || k === "b")) { this.sbOpen = false; this.sbFocus = false; this.relayout(); return; }
    if (k === "escape" || k === "s" || k === "tab") { this.sbFocus = false; return; }
    if (k === "b" && !e.ctrl) return this.toggleSidebar();
    if (this.globalKey(e)) return;
    if (k === "down" || k === "j") this.sbCur = Math.min(rows.length - 1, this.sbCur + 1);
    else if (k === "up" || k === "k") this.sbCur = Math.max(0, this.sbCur - 1);
    else if (k === "pagedown") this.sbCur = Math.min(rows.length - 1, this.sbCur + 10);
    else if (k === "pageup") this.sbCur = Math.max(0, this.sbCur - 10);
    else if (k === "home" || k === "g") this.sbCur = 0;
    else if (k === "end" || k === "G") this.sbCur = rows.length - 1;
    else if (k === "enter" || k === "right" || k === "l" || k === "space") { const r = rows[this.sbCur]; if (r) { this.openRow(r); if (r.kind === "chapter" || r.kind === "special" || r.kind === "section") this.sbFocus = false; } }
    else if (k === "left" || k === "h") { const r = rows[this.sbCur]; if (r?.kind === "part") this.collapsed.add(r.id); }
    const h = Math.max(1, this.rows - 4);
    if (this.sbCur < this.sbTop) this.sbTop = this.sbCur;
    if (this.sbCur >= this.sbTop + h) this.sbTop = this.sbCur - h + 1;
  }

  private onOverlayKey(o: Overlay, e: KeyEvent) {
    if (e.key === "escape" || (e.ctrl && e.key === "c")) { this.overlay = null; return; }
    if (o.kind === "help") {
      const { vis, total } = this.helpBox(), max = Math.max(0, total - vis), k = e.key;
      if (max > 0 && !e.ctrl) { // too tall for this window: the arrow keys scroll it, anything else closes it
        if (k === "down" || k === "j") { o.top = clamp(o.top + 1, 0, max); return; }
        if (k === "up" || k === "k") { o.top = clamp(o.top - 1, 0, max); return; }
        if (k === "pagedown" || k === "space") { o.top = clamp(o.top + vis, 0, max); return; }
        if (k === "pageup") { o.top = clamp(o.top - vis, 0, max); return; }
        if (k === "home" || k === "g") { o.top = 0; return; }
        if (k === "end" || k === "G") { o.top = max; return; }
      }
      this.overlay = null;
      return;
    }
    if (o.kind === "prompt") {
      if (e.key === "enter") { this.overlay = null; o.submit(o.f.text); return; }
      editField(o.f, e);
      return;
    }
    const n = o.results.length, vis = this.paletteRows();
    if (e.key === "down" || (e.ctrl && e.key === "n")) o.sel = Math.max(0, Math.min(n - 1, o.sel + 1));
    else if (e.key === "up" || (e.ctrl && e.key === "p")) o.sel = Math.max(0, o.sel - 1);
    else if (e.key === "pagedown") o.sel = Math.max(0, Math.min(n - 1, o.sel + vis));
    else if (e.key === "pageup") o.sel = Math.max(0, o.sel - vis);
    else if (e.key === "enter") { const r = o.results[o.sel]; this.overlay = null; if (r) this.go(r.route); return; }
    else { if (editFieldEx(o.f, e).changed) this.refreshPalette(o); return; }
    if (o.sel < o.top) o.top = o.sel;
    if (o.sel >= o.top + vis) o.top = o.sel - vis + 1;
  }
  private paletteRows() { return clamp(this.rows - 8, 2, 18); }

  /** Returns true when the event can have changed what is on screen. */
  private onMouse(e: MouseEvent): boolean {
    const { x, y } = e;
    const o = this.overlay;
    if (e.action === "wheel") {
      this.hoverId = null; // what is under the pointer is about to change
      if (o?.kind === "palette") { o.top = clamp(o.top + e.dir! * 3, 0, Math.max(0, o.results.length - this.paletteRows())); return true; }
      if (o?.kind === "help") { const { vis, total } = this.helpBox(); o.top = clamp(o.top + e.dir! * 3, 0, Math.max(0, total - vis)); return true; }
      if (o) return false;
      const r = this.hits.at(x, y, (z) => !!z.wheel);
      if (r) { r.wheel!(e.dir!, !!e.horizontal || e.shift); return true; }
      if (e.horizontal || e.shift) this.pan(e.dir! * 8); else this.scrollBy(e.dir! * 3);
      return true;
    }
    if (e.action === "move") { const r = this.hits.at(x, y, (z) => !!z.hover); const id = r?.id ?? null; if (id === this.hoverId) return false; this.hoverId = id; return true; }
    if (e.action === "up") { const was = this.dragging !== null; this.dragging = null; return was; }
    if (e.action === "drag") { if (!this.dragging) return false; this.dragging.drag!(x, y); return true; }
    if (e.action === "down" && e.button === 0) {
      // While a dialog or the contents drawer is open the page behind it has no regions (see scrim()), so a click outside lands on the scrim.
      const r = this.hits.at(x, y, (z) => !!(z.click || z.drag));
      if (!r && o) { if (o.kind !== "prompt") this.overlay = null; return true; }
      this.dragging = r?.drag ? r : null;
      r?.click?.(x, y);
      r?.drag?.(x, y);
      this.focusIdx = -1;
      return true;
    }
    return false;
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
    if (this.tooSmall) { this.drawTooSmall(p); return scr; }
    if (this.layoutW !== this.contentW()) this.relayout();
    this.scroll = clamp(this.scroll, 0, this.maxScroll());
    this.hscroll = clamp(this.hscroll, 0, this.maxPan());
    this.drawReader(p);
    if (this.drawer) this.scrim(p, this.readerRect(), () => this.closeDrawer());
    if (this.sbShown) this.drawSidebar(p);
    this.drawTop(p);
    this.drawBottom(p);
    const o = this.overlay;
    if (o) {
      this.scrim(p, rect(0, 0, this.cols, this.rows), () => { if (o.kind !== "prompt") this.overlay = null; });
      if (o.kind === "palette") this.drawPalette(p, o);
      else if (o.kind === "help") this.drawHelp(p, o);
      else this.drawPrompt(p, o);
    }
    return scr;
  }

  /**
   * Put what is drawn so far in `r` behind a dialog or drawer: dimmed, and unclickable. The regions of everything
   * underneath are dropped so a click outside lands on the scrim (which closes the dialog) and never presses a
   * button or link hiding behind it; the wheel does not scroll the page behind it either.
   */
  private scrim(p: Painter, r: Rect, onClick: () => void) {
    p.dim(r, 0.62, this.colorMode === "none" || this.colorMode === "16");
    p.hits.clear();
    p.hits.add({ rect: r, id: "scrim", click: onClick, wheel: () => {} });
  }

  private drawTooSmall(p: Painter) {
    const lines = ["Window too small", `needs ${MIN_COLS}×${MIN_ROWS}, is ${this.cols}×${this.rows}`];
    const y0 = Math.max(0, Math.floor((this.rows - lines.length) / 2));
    lines.forEach((l, i) => {
      if (y0 + i >= this.rows) return;
      const t = ellipsize(l, this.cols);
      p.text(Math.max(0, Math.floor((this.cols - strWidth(t)) / 2)), y0 + i, t, { fg: i ? "dim" : "fg", b: !i });
    });
  }

  /** A clickable area. `hover` is what the pointer does to it: "ul" underlines (inline buttons), a theme token tints a whole row, false does nothing. */
  private region(p: Painter, r: Rect, id: string, click: () => void, extra: Partial<Region> = {}, hover: string | false = "ul") {
    p.hits.add({ rect: r, id, click, hover: hover !== false, ...extra });
    if (p.hoverId !== id || hover === false) return;
    if (hover === "ul") p.decorate(r, A_UNDER); else p.decorate(r, 0, hover);
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
    p.text(0, 0, this.drawer ? " ✕ " : " ≡ ", st("mute"));
    this.region(p, rect(0, 0, 3, 1), "tb:burger", () => this.act("sidebar:"));
    let x = 3;
    p.text(x, 0, "CODEX_LMS", st("accent", { b: true })); x += 10;
    const [d, t] = this.totalProgress();
    const bar = t ? Math.round((d / t) * 10) : 0;
    const search = " ⌕ Search  / ";
    const theme = ` ◐ ${this.themePref === "" ? "System" : this.themePref === "light" ? "Light" : "Dark"} `;
    const prog = `${"▰".repeat(bar)}${"▱".repeat(10 - bar)} ${d}/${t} `;
    const right = strWidth(search) + strWidth(theme) + strWidth(prog) + 2;
    if (w - x - right > 6) p.text(x, 0, "· " + ellipsize(this.chapter.title, w - x - right - 3), st("mute"));
    let rx = w - strWidth(theme);
    p.text(rx, 0, theme, { fg: "fg", bg: "panel2" });
    this.region(p, rect(rx, 0, strWidth(theme), 1), "tb:theme", () => this.act("theme:"));
    rx -= strWidth(search) + 1;
    p.text(rx, 0, search, { fg: "fg", bg: "panel2" });
    this.region(p, rect(rx, 0, strWidth(search), 1), "tb:search", () => this.act("search:"));
    rx -= strWidth(prog) + 1;
    if (rx > x + 12) p.text(rx, 0, prog, st("dim"));
  }

  /** The key hints for the current mode. A lower `pri` is kept longer when the window is too narrow for all of them. */
  private footerHints(): { k: string; v: string; pri: number }[] {
    if (this.labFocus) return [{ k: "esc", v: "leave lab", pri: 0 }];
    if (this.sbFocus && this.sbOpen) {
      return [{ k: "↑↓", v: "move", pri: 1 }, { k: "enter", v: "open", pri: 0 }, { k: "esc", v: this.drawer ? "close" : "back", pri: 0 }, { k: "/", v: "search", pri: 2 }, { k: "?", v: "help", pri: 1 }];
    }
    return [
      { k: "↑↓", v: "scroll", pri: 1 }, { k: "n p", v: "chapter", pri: 2 }, { k: "[ ]", v: "section", pri: 3 }, { k: "tab", v: "select", pri: 3 },
      { k: "/", v: "search", pri: 1 }, { k: "t", v: "theme", pri: 4 }, { k: "b", v: "sidebar", pri: 4 }, { k: "?", v: "help", pri: 0 }, { k: "q", v: "quit", pri: 0 },
    ];
  }

  private drawBottom(p: Painter) {
    const y = this.rows - 1, w = this.cols;
    p.fill(rect(0, y, w, 1), "panel");
    const pct = this.maxScroll() ? Math.round((this.scroll / this.maxScroll()) * 100) : 100;
    const right = ` ${pct}% `;
    p.text(w - right.length, y, right, { fg: "mute", bg: "panel" });
    const room = w - right.length - 2;
    if (this.toastMsg && this.now() < this.toastMsg.until) { p.text(1, y, ` ${ellipsize(this.toastMsg.text, Math.max(1, room - 2))} `, { fg: "accentInk", bg: "accent", b: true }); return; }
    // Drop the least important hints first, so "? help" and "q quit" are the last to go on a narrow window.
    const gap = w >= 100 ? 3 : 2;
    const hints = this.footerHints();
    const width = (hs: typeof hints) => hs.reduce((a, h) => a + strWidth(h.k) + 1 + strWidth(h.v) + gap, -gap);
    let kept = hints.slice();
    while (kept.length > 1 && width(kept) > room) {
      const worst = Math.max(...kept.map((h) => h.pri));
      if (worst === 0) break;
      kept.splice(kept.map((h) => h.pri).lastIndexOf(worst), 1);
    }
    let x = 1;
    for (const h of kept) {
      const seg = strWidth(h.k) + 1 + strWidth(h.v);
      if (x + seg > 1 + room) break;
      p.text(x, y, h.k, { fg: "accent", bg: "panel", b: true });
      p.text(x + strWidth(h.k) + 1, y, h.v, { fg: "mute", bg: "panel" });
      x += seg + gap;
    }
  }

  private drawSidebar(p: Painter) {
    const W = this.sbW;
    const r = rect(0, 1, W, this.rows - 2);
    p.fill(r, "panel");
    if (this.docked) for (let y = 1; y < this.rows - 1; y++) p.text(W, y, "│", { fg: "line" });
    else for (let y = 1; y < this.rows - 1; y++) p.text(W - 1, y, "▕", { fg: "line", bg: "panel" });
    const rows = this.sbRows();
    const h = Math.max(1, this.rows - 4);
    this.sbTop = clamp(this.sbTop, 0, Math.max(0, rows.length - h));
    p.hits.add({ rect: r, id: "sb", wheel: (d) => { this.sbTop = clamp(this.sbTop + d * 3, 0, Math.max(0, rows.length - h)); } });
    p.text(2, 1, "CONTENTS", { fg: "dim", b: true, bg: "panel" });
    if (this.drawer) {
      p.text(W - 6, 1, " ✕ ", { fg: "mute", bg: "panel2" });
      this.region(p, rect(W - 6, 1, 3, 1), "sb:close", () => this.closeDrawer());
    }
    const curSection = this.currentSection();
    const avail = W - 5; // one cell of air before the scroll track
    for (let i = 0; i < h; i++) {
      const row = rows[this.sbTop + i];
      if (!row) break;
      const y = 2 + i, idx = this.sbTop + i;
      const rr = rect(0, y, W - 1, 1);
      const isCur = (row.kind === "chapter" || row.kind === "special") && row.id === this.chapterId;
      const cursor = this.sbFocus && idx === this.sbCur;
      // Two different marks: the keyboard cursor (a strong tint and ›) and the page you are on (a soft tint and ▌), so they never look alike.
      const bg = cursor ? "sel" : isCur ? "hover" : "panel";
      p.fill(rr, bg);
      const base: Style = { bg };
      if (cursor || isCur) p.text(0, y, cursor ? "›" : "▌", { ...base, fg: "accent", b: true });
      if (row.kind === "part") {
        const open = !this.collapsed.has(row.id);
        p.text(1 + (cursor ? 1 : 0), y, `${open ? "▾" : "▸"} ${ellipsize(row.text.toUpperCase(), avail - 2)}`, { ...base, fg: cursor ? "fg" : "dim", b: true });
      } else if (row.kind === "head") {
        p.text(1, y, "─ " + row.text.toUpperCase() + " ", { ...base, fg: "dim", b: true });
      } else if (row.kind === "chapter") {
        const c = this.book.byId.get(row.id)!;
        const [d, t] = this.progress(c);
        const g = !t ? "·" : d === t ? "●" : d ? "◐" : "○";
        p.text(2, y, g, { ...base, fg: d === t && t ? "ok" : d ? "warn" : "dim" });
        p.text(4, y, String(row.num).padStart(2, "0"), { ...base, fg: "dim" });
        p.text(7, y, ellipsize(row.text, avail - 5), { ...base, fg: isCur ? "accent" : "fg", b: isCur || cursor });
      } else if (row.kind === "special") {
        p.text(3, y, ellipsize(row.text, avail - 2), { ...base, fg: isCur ? "accent" : "fg", b: isCur || cursor });
      } else {
        const on = row.anchor === curSection;
        p.text(7, y, (on ? "▸ " : "· ") + ellipsize(row.text, avail - 9), { ...base, fg: on || cursor ? "accent" : "mute", b: cursor });
      }
      this.region(p, rr, "sb:" + idx, () => { this.sbCur = idx; this.openRow(row); }, {}, cursor || isCur ? false : "hover");
    }
    if (rows.length > h) { // a track, with a thumb the size of the visible share
      const th = Math.max(1, Math.round((h * h) / rows.length)), top = Math.round((this.sbTop / Math.max(1, rows.length - h)) * (h - th));
      for (let i = 0; i < h; i++) p.text(W - 2, 2 + i, i >= top && i < top + th ? "┃" : "│", { fg: i >= top && i < top + th ? "mute" : "line", bg: "panel" });
    }
  }

  private currentSection(): string | undefined {
    let cur: string | undefined;
    for (const s of this.sections()) if (s.line <= this.scroll + 2) cur = s.anchor;
    return cur;
  }

  /** A dialog: a rounded box on the scrim. It keeps the top and bottom bars visible, wherever the window is short. */
  private box(p: Painter, r: Rect, title: string) {
    p.box(r, { fg: "accent", bg: "panel2" }, "panel2");
    p.text(r.x + 2, r.y, ` ${title} `, { fg: "accent", bg: "panel2", b: true });
    p.hits.add({ rect: r, id: "ov", click: () => {} });
  }
  private dialogRect(w: number, h: number): Rect {
    const y = Math.max(1, Math.min(Math.floor((this.rows - h) / 3), this.rows - 1 - h));
    return rect(Math.floor((this.cols - w) / 2), y, w, h);
  }

  private drawPalette(p: Painter, o: Extract<Overlay, { kind: "palette" }>) {
    const w = Math.min(86, this.cols - 4), vis = this.paletteRows(), h = vis + 5;
    const r = this.dialogRect(w, h);
    this.box(p, r, "Search");
    const bg = "panel2";
    const fw = w - 8;
    p.text(r.x + 2, r.y + 1, "⌕ ", { fg: "accent", bg, b: true });
    const v = fieldView(o.f, fw);
    if (o.f.text) p.text(r.x + 4, r.y + 1, v.text, { fg: "fg", bg });
    else p.text(r.x + 6, r.y + 1, ellipsize("chapters, sections, commands, terms…", fw - 2), { fg: "dim", bg });
    p.cursor(r.x + 4 + v.cx, r.y + 1, cursorChar(o.f));
    p.text(r.x + 1, r.y + 2, "─".repeat(w - 2), { fg: "line", bg });
    const shown = o.results.slice(o.top, o.top + vis);
    if (!shown.length) p.text(r.x + 3, r.y + 4, "Nothing matches that.", { fg: "mute", bg });
    // Titles share one column and the descriptions line up after it, so a long result list can be scanned down the page.
    const tw = clamp(Math.max(0, ...shown.map((e) => strWidth(e.title))), 8, Math.floor((w - 12) * 0.55));
    shown.forEach((e, i) => {
      const idx = o.top + i, y = r.y + 3 + i, sel = idx === o.sel;
      const rbg = sel ? "sel" : bg;
      const rr = rect(r.x + 1, y, w - 2, 1);
      p.fill(rr, rbg);
      const b = KIND_BADGE[e.kind];
      p.text(r.x + 2, y, sel ? "▌" : " ", { fg: "accent", bg: rbg });
      p.text(r.x + 3, y, b[0], { fg: b[1], bg: rbg, b: true });
      p.text(r.x + 7, y, ellipsize(e.title, tw), { fg: sel ? "accent" : "fg", bg: rbg, b: sel });
      p.text(r.x + 9 + tw, y, ellipsize(e.detail.replace(/\s+/g, " "), Math.max(0, w - 12 - tw)), { fg: sel ? "mute" : "dim", bg: rbg });
      this.region(p, rr, "pal:" + idx, () => { this.overlay = null; this.go(e.route); }, {}, sel ? false : "hover");
    });
    const n = o.results.length;
    if (n > vis) {
      const th = Math.max(1, Math.round((vis * vis) / n)), top = Math.round((o.top / Math.max(1, n - vis)) * (vis - th));
      for (let i = 0; i < vis; i++) p.text(r.x + w - 2, r.y + 3 + i, i >= top && i < top + th ? "┃" : "│", { fg: i >= top && i < top + th ? "mute" : "line", bg });
    }
    const foot = `${n ? `${o.sel + 1} of ${n} result${n === 1 ? "" : "s"}` : "no results"}   ↑↓ select   enter open   esc close`;
    p.text(r.x + 2, r.y + h - 2, ellipsize(foot, w - 4), { fg: "dim", bg });
  }

  private drawPrompt(p: Painter, o: Extract<Overlay, { kind: "prompt" }>) {
    const w = Math.min(70, this.cols - 4), h = 7;
    const r = this.dialogRect(w, h);
    this.box(p, r, o.label);
    const bg = "panel2";
    if (o.desc) p.text(r.x + 2, r.y + 1, ellipsize(o.desc, w - 4), { fg: "mute", bg });
    p.fill(rect(r.x + 2, r.y + 3, w - 4, 1), "panel");
    const v = fieldView(o.f, w - 8);
    p.text(r.x + 3, r.y + 3, v.text, { fg: "fg", bg: "panel" });
    p.cursor(r.x + 3 + v.cx, r.y + 3, cursorChar(o.f));
    p.text(r.x + 2, r.y + 5, ellipsize(o.hint, w - 4), { fg: "dim", bg });
  }

  private helpLines(): [string, string][] {
    return [
      ["↑ ↓  j k", "scroll"], ["space  PgDn  ctrl-f", "page down"], ["shift-space  PgUp  ctrl-b", "page up"], ["ctrl-d  ctrl-u", "half a page down / up"],
      ["g  G  Home  End", "top / bottom"], ["n  p", "next / previous chapter"], ["]  [", "next / previous section"], ["← →  h l", "pan wide diagrams sideways"],
      ["tab  shift-tab", "step through buttons and links"], ["enter", "press the selected button, or enter a lab"], ["e", "expand or collapse every command card"],
      ["/  ctrl-p", "search everything"], ["s", "move around the contents list"], ["b", "show or hide the contents"], ["t", "theme: system, light, dark"],
      ["q  ctrl-c", "quit"], ["click  wheel", "press things · scroll (shift+wheel pans)"],
    ];
  }
  /** The help dialog and how many of its lines fit; it scrolls when the window is shorter than the list. */
  private helpBox(): { r: Rect; vis: number; total: number } {
    const total = this.helpLines().length;
    const h = Math.min(total + 5, this.rows - 2); // border, blank, the lines, blank, footer, border
    return { r: this.dialogRect(Math.min(76, this.cols - 4), h), vis: h - 5, total };
  }

  private drawHelp(p: Painter, o: Extract<Overlay, { kind: "help" }>) {
    const { r, vis, total } = this.helpBox();
    const w = r.w, max = Math.max(0, total - vis);
    o.top = clamp(o.top, 0, max);
    this.box(p, r, "Keys");
    const bg = "panel2";
    this.helpLines().slice(o.top, o.top + vis).forEach(([k, v], i) => {
      p.text(r.x + 3, r.y + 2 + i, ellipsize(k, 26), { fg: "accent", bg, b: true });
      p.text(r.x + 30, r.y + 2 + i, ellipsize(v, Math.max(0, w - 33)), { fg: "fg", bg });
    });
    if (max > 0) { // a thumb on the right edge, and a hint that the arrow keys scroll
      const th = Math.max(1, Math.round((vis * vis) / total)), top = Math.round((o.top / max) * (vis - th));
      for (let i = 0; i < vis; i++) p.text(r.x + w - 2, r.y + 2 + i, i >= top && i < top + th ? "┃" : "│", { fg: i >= top && i < top + th ? "mute" : "line", bg });
    }
    p.text(r.x + 3, r.y + r.h - 2, ellipsize(max > 0 ? "↑↓ scroll   esc or any other key closes" : "esc or any key closes", w - 6), { fg: "dim", bg });
  }
}

/** The part of a text field to draw in `fw` cells, scrolled so the cursor is always inside it, and where the cursor lands. */
function fieldView(f: TextField, fw: number): { text: string; cx: number } {
  let s0 = 0;
  while (s0 < f.cur && strWidth(f.text.slice(s0, f.cur)) > fw - 1) s0++;
  if (s0 > 0 && /[\udc00-\udfff]/.test(f.text[s0] ?? "")) s0++; // never start in the middle of a surrogate pair
  return { text: clipWidth(f.text.slice(s0), fw), cx: strWidth(f.text.slice(s0, f.cur)) };
}
/** The character under a field's cursor (a space at the end). */
function cursorChar(f: TextField): string { const cp = f.text.codePointAt(f.cur); return cp === undefined ? " " : String.fromCodePoint(cp); }
