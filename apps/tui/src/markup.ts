// Inline markup (`code`, **bold**, [[key]], {{placeholder}}, links) and syntax highlighting, as styled spans.

import { type Span, type Style } from "./text.ts";

export type VarFn = (key: string) => string;

// The same grammar as inl() in src/engine.js.
const INLINE =
  "``[ ]?((?:[^`]|`(?!`))+?)[ ]?``|`([^`]+)`|\\{\\{(\\w+)\\}\\}|\\[\\[([^\\]]+)\\]\\]|\\[([^\\]]+)\\]\\(([^)]+)\\)|\\*\\*([^*]+)\\*\\*|\\*([^*\\s][^*]*)\\*";

export const CODE_STYLE: Style = { fg: "fg", bg: "panel2" };
const CHIP: Style = { fg: "ph", bg: "phBg" };
const KBD: Style = { fg: "fg", bg: "panel2", b: true };

export function inline(text: string, vars: VarFn, base: Style = {}): Span[] {
  const out: Span[] = [];
  const re = new RegExp(INLINE, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  const plain = (s: string) => { if (s) out.push({ ...base, t: s }); };
  while ((m = re.exec(text))) {
    plain(text.slice(last, m.index));
    last = re.lastIndex;
    if (m[1] !== undefined) out.push({ ...base, ...CODE_STYLE, t: m[1] });
    else if (m[2] !== undefined) {
      for (const p of m[2].split(/(\{\{\w+\}\})/)) {
        const v = /^\{\{(\w+)\}\}$/.exec(p);
        if (v) out.push({ ...CHIP, t: vars(v[1]), act: "var:" + v[1] });
        else if (p) out.push({ ...base, ...CODE_STYLE, t: p });
      }
    } else if (m[3]) out.push({ ...base, ...CHIP, t: vars(m[3]), act: "var:" + m[3] });
    else if (m[4]) out.push({ ...base, ...KBD, t: " " + m[4] + " " });
    else if (m[5]) for (const s of inline(m[5], vars, { ...base, fg: "accent", u: true })) out.push({ ...s, act: "link:" + m[6] });
    else if (m[7]) out.push(...inline(m[7], vars, { ...base, b: true }));
    else out.push(...inline(m[8], vars, { ...base, i: true }));
  }
  plain(text.slice(last));
  return out;
}

/** Plain text of inline markup (for search and for the status bar). */
export function stripInline(text: string, vars: VarFn = (k) => k): string {
  return inline(text, vars).map((s) => s.t).join("");
}

// ---------- syntax highlighting ----------

interface HlState { tq: string | null; bc: boolean }
type Kind = "sh" | "term" | "py" | "js" | "html" | "css" | "json" | "ascii" | "text";

const sp = (t: string, fg?: string): Span => (fg ? { t, fg } : { t });

const SH_KW = /^(if|then|else|elif|fi|for|while|until|do|done|case|esac|function|in|select|time|\[\[|\]\]|!)$/;
const SH_PASS = /^(sudo|xargs|time|env|nohup|then|do|else|command|exec|watch|nice)$/;

function hlSh(line: string): Span[] {
  const out: Span[] = [];
  let i = 0, cmdPos = true;
  const n = line.length;
  while (i < n) {
    const c = line[i];
    const rest = line.slice(i);
    if (c === " " || c === "\t") { out.push(sp(c)); i++; continue; }
    if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) { out.push(sp(rest, "shCom")); break; }
    if (c === "'") { let j = line.indexOf("'", i + 1); if (j < 0) j = n - 1; out.push(sp(line.slice(i, j + 1), "shStr")); i = j + 1; cmdPos = false; continue; }
    if (c === '"') {
      let j = i + 1;
      while (j < n && line[j] !== '"') { if (line[j] === "\\") j++; j++; }
      const body = line.slice(i, j + 1);
      for (const part of body.split(/(\$\{[^}]*\}|\$\([^)]*\)|\$[A-Za-z_][A-Za-z0-9_]*|\$[?#@*0-9])/)) if (part) out.push(sp(part, part[0] === "$" && part.length > 1 ? "shVar" : "shStr"));
      i = j + 1; cmdPos = false; continue;
    }
    let m: RegExpExecArray | null;
    if (c === "$" && line[i + 1] === "(") { const t = line[i + 2] === "(" ? "$((" : "$("; out.push(sp(t, "shVar")); i += t.length; cmdPos = true; continue; }
    if ((m = /^(\|\||&&|\|&|\||;;|;|2>&1|&>>|&>|2>>|2>|>>|>&|>|<<<|<<|<|&|\(|\)|\{|\})/.exec(rest)) && !(m[0] === "{" && /^\{[^ ]/.test(rest))) {
      out.push(sp(m[0], "shOp")); i += m[0].length;
      if (/^(\|\||&&|\||;|\(|\|&|&|;;)$/.test(m[0])) cmdPos = true;
      continue;
    }
    const wm = /^(?:\$\{[^}]*\}|\$[A-Za-z_?#@*0-9][A-Za-z0-9_]*|\w+|[^\s|&;<>()'"$])+/.exec(rest) || /^\$/.exec(rest);
    const w = wm ? wm[0] : c;
    i += w.length;
    const plain = w.replace(/\w+/g, "x");
    if (/^\$/.test(w) && !cmdPos) out.push(sp(w, "shVar"));
    else if (SH_KW.test(w)) { out.push(sp(w, "shKw")); cmdPos = /^(then|do|else|elif|if|while|until|!)$/.test(w); }
    else if (cmdPos && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) { const eq = w.indexOf("="); out.push(sp(w.slice(0, eq + 1), "shVar")); if (w.slice(eq + 1)) out.push(sp(w.slice(eq + 1))); }
    else if (cmdPos) { out.push(sp(w, "shCmd")); cmdPos = SH_PASS.test(w); }
    else if (/^--?[A-Za-z0-9]/.test(plain)) out.push(sp(w, "shFlag"));
    else if (/^[0-9]+$/.test(plain)) out.push(sp(w, "shNum"));
    else out.push(sp(w));
  }
  return out;
}

interface Lang {
  kw: Set<string>; consts: Set<string>; builtins: Set<string>; line: string; block?: boolean; tq?: boolean; tick?: boolean; defKw: Set<string>;
}
const words = (s: string) => new Set(s.split(" "));
const PY: Lang = {
  kw: words("and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case"),
  consts: words("None True False self cls"),
  builtins: words("print len range int str float bool list dict set tuple type input open sum min max abs sorted reversed enumerate zip map filter any all isinstance hasattr getattr setattr round repr format id hex bin oct ord chr bytes bytearray super object Exception ValueError TypeError KeyError IndexError OSError"),
  line: "#", tq: true, defKw: words("def class"),
};
const JS: Lang = {
  kw: words("const let var function return if else for while do switch case break continue default new class extends import export from as await async try catch finally throw typeof instanceof of in delete void yield static get set"),
  consts: words("true false null undefined this NaN Infinity"),
  builtins: words("console window document Math JSON Object Array String Number Boolean Promise Map Set Date RegExp Error parseInt parseFloat fetch setTimeout setInterval require module process"),
  line: "//", block: true, tick: true, defKw: words("function class"),
};

function hlCode(line: string, L: Lang, st: HlState): Span[] {
  const out: Span[] = [];
  let i = 0;
  const n = line.length;
  let afterDef = false;
  if (st.tq) {
    const j = line.indexOf(st.tq);
    if (j < 0) return [sp(line, "shStr")];
    out.push(sp(line.slice(0, j + 3), "shStr")); st.tq = null; i = j + 3;
  }
  if (st.bc) {
    const j = line.indexOf("*/");
    if (j < 0) return [sp(line, "shCom")];
    out.push(sp(line.slice(0, j + 2), "shCom")); st.bc = false; i = j + 2;
  }
  while (i < n) {
    const c = line[i];
    const rest = line.slice(i);
    if (rest.startsWith(L.line)) { out.push(sp(rest, "shCom")); break; }
    if (L.block && rest.startsWith("/*")) {
      const j = line.indexOf("*/", i + 2);
      if (j < 0) { out.push(sp(rest, "shCom")); st.bc = true; break; }
      out.push(sp(line.slice(i, j + 2), "shCom")); i = j + 2; continue;
    }
    const sm = L.tq ? /^(?:[rRbBuUfF]{1,2})?("""|'''|"|')/.exec(rest) : /^(["'`])/.exec(rest);
    if (sm && (i === 0 || !/[A-Za-z0-9_]/.test(line[i - 1]) || sm[0].length > 1)) {
      const q = sm[1];
      const start = i;
      let j = i + sm[0].length;
      if (q.length === 3) {
        const k = line.indexOf(q, j);
        if (k < 0) { out.push(sp(line.slice(start), "shStr")); st.tq = q; i = n; break; }
        out.push(sp(line.slice(start, k + 3), "shStr")); i = k + 3; continue;
      }
      while (j < n && line[j] !== q) { if (line[j] === "\\") j++; j++; }
      out.push(sp(line.slice(start, j + 1), "shStr")); i = j + 1; continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(rest)) && (i === 0 || !/[A-Za-z0-9_]/.test(line[i - 1]))) {
      out.push(sp(m[0], "shNum")); i += m[0].length; continue;
    }
    if ((m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(rest))) {
      const w = m[0];
      i += w.length;
      if (afterDef) { out.push(sp(w, "shVar")); afterDef = false; }
      else if (L.kw.has(w)) { out.push(sp(w, "shKw")); afterDef = L.defKw.has(w); }
      else if (L.consts.has(w)) out.push(sp(w, "shNum"));
      else if (L.builtins.has(w)) out.push(sp(w, "shCmd"));
      else out.push(sp(w));
      continue;
    }
    if (c === "@" && L === PY && (m = /^@[A-Za-z_][\w.]*/.exec(rest))) { out.push(sp(m[0], "shVar")); i += m[0].length; continue; }
    out.push(sp(c)); i++;
  }
  return out;
}

function hlHtml(line: string, st: HlState): Span[] {
  const out: Span[] = [];
  let i = 0;
  if (st.bc) {
    const j = line.indexOf("-->");
    if (j < 0) return [sp(line, "shCom")];
    out.push(sp(line.slice(0, j + 3), "shCom")); st.bc = false; i = j + 3;
  }
  const re = /<!--|<\/?[A-Za-z][^\s>\/]*|\/?>|[A-Za-z_:][-A-Za-z0-9_:.]*(?==)|"[^"]*"|'[^']*'|&#?\w+;/g;
  re.lastIndex = i;
  let m: RegExpExecArray | null;
  let inTag = false;
  while ((m = re.exec(line))) {
    if (m.index > i) out.push(sp(line.slice(i, m.index)));
    const t = m[0];
    i = m.index + t.length;
    if (t === "<!--") {
      const j = line.indexOf("-->", i);
      if (j < 0) { out.push(sp(line.slice(m.index), "shCom")); st.bc = true; return out; }
      out.push(sp(line.slice(m.index, j + 3), "shCom")); i = j + 3; re.lastIndex = i; continue;
    }
    if (t[0] === "<") { out.push(sp(t, "shKw")); inTag = true; }
    else if (t === ">" || t === "/>") { out.push(sp(t, "shKw")); inTag = false; }
    else if (t[0] === '"' || t[0] === "'") out.push(sp(t, inTag ? "shStr" : undefined));
    else if (t[0] === "&") out.push(sp(t, "shNum"));
    else out.push(sp(t, inTag ? "shFlag" : undefined));
  }
  if (i < line.length) out.push(sp(line.slice(i)));
  return out;
}

function hlCss(line: string): Span[] {
  const out: Span[] = [];
  const re = /\/\*.*?\*\/|[A-Za-z-]+(?=\s*:)|#[0-9a-fA-F]{3,8}\b|\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?|"[^"]*"|'[^']*'|[.#][A-Za-z_-][\w-]*|@[a-z-]+/g;
  let i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > i) out.push(sp(line.slice(i, m.index)));
    const t = m[0];
    out.push(sp(t, t.startsWith("/*") ? "shCom" : /^["']/.test(t) ? "shStr" : /^[.#@]/.test(t) && !/^#[0-9a-fA-F]{3,8}$/.test(t) ? "shVar" : /^[\d#]/.test(t) ? "shNum" : "shFlag"));
    i = m.index + t.length;
  }
  if (i < line.length) out.push(sp(line.slice(i)));
  return out;
}

function hlJson(line: string): Span[] {
  const out: Span[] = [];
  const re = /"(?:[^"\\]|\\.)*"(?=\s*:)|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;
  let i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > i) out.push(sp(line.slice(i, m.index)));
    const t = m[0];
    const isKey = t[0] === '"' && /^\s*:/.test(line.slice(m.index + t.length));
    out.push(sp(t, t[0] === '"' ? (isKey ? "shVar" : "shStr") : /^[-\d]/.test(t) ? "shNum" : "shKw"));
    i = m.index + t.length;
  }
  if (i < line.length) out.push(sp(line.slice(i)));
  return out;
}

const ASCII_COLORS: Record<string, string> = { r: "bad", g: "an3", y: "an2", b: "shVar", c: "an1", m: "an5", w: "fg", d: "dim" };

/** Diagram lines carry ⟪r:text⟫ colour markers; turn them into spans. */
export function asciiLine(line: string): Span[] {
  const out: Span[] = [];
  const re = /⟪([rgybcmwd]):([^⟫]*)⟫/g;
  let i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > i) out.push(sp(line.slice(i, m.index), "mute"));
    out.push(sp(m[2], ASCII_COLORS[m[1]]));
    i = m.index + m[0].length;
  }
  if (i < line.length) out.push(sp(line.slice(i), "mute"));
  return out;
}

export function kindOf(lang: string, name?: string): Kind {
  switch (lang) {
    case "sh": return "sh";
    case "term": return "term";
    case "run": case "python": return "py";
    case "jsrun": case "js": return "js";
    case "html": case "xml": case "webplay": case "devtools": return "html";
    case "css": return "css";
    case "ascii": return "ascii";
    case "file": {
      const ext = /\.([A-Za-z0-9]+)$/.exec(name || "")?.[1]?.toLowerCase();
      if (ext === "py") return "py";
      if (ext === "js" || ext === "mjs") return "js";
      if (ext === "json") return "json";
      if (ext === "html" || ext === "htm" || ext === "xml" || ext === "svg") return "html";
      if (ext === "css") return "css";
      if (ext === "sh" || ext === "zsh" || ext === "bash") return "sh";
      return "text";
    }
    default: return "text";
  }
}

/** One list of spans per line of `code`. */
export function highlight(kind: Kind, code: string): Span[][] {
  const lines = code.replace(/\n$/, "").split("\n");
  const st: HlState = { tq: null, bc: false };
  return lines.map((ln) => {
    switch (kind) {
      case "sh": return hlSh(ln);
      case "term": {
        const m = /^(\$|%|>>>) (.*)$/.exec(ln);
        if (m) return [sp(m[1] + " ", "dim"), ...(m[1] === ">>>" ? hlCode(m[2], PY, st) : hlSh(m[2]))];
        if (/^\s*#/.test(ln)) return [sp(ln, "shCom")];
        return [sp(ln, "mute")];
      }
      case "py": return hlCode(ln, PY, st);
      case "js": return hlCode(ln, JS, st);
      case "html": return hlHtml(ln, st);
      case "css": return hlCss(ln);
      case "json": return hlJson(ln);
      case "ascii": return asciiLine(ln);
      default: return /^\s*#/.test(ln) ? [sp(ln, "shCom")] : [sp(ln)];
    }
  });
}
