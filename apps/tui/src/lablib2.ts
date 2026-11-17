// Eleven more terminal labs on the shared widget logic (see lablib.ts for the first seven).

import { DEFAULT_FS, DEFAULT_PATH, PY_FS, PY_PATH, lookup } from "@codex/widgets";
import { SAMPLE_VERSIONS, satisfies, parseRange } from "@codex/widgets";
import { CHARSETS, HASHES, crackTime, entropyBits, verdict } from "@codex/widgets";
import { avalanche } from "@codex/widgets";
import { SAMPLE_PATH, probe, traceroute } from "@codex/widgets";
import { PHASES, SCENARIOS, curlWriteOut, layout } from "@codex/widgets";
import { SIGNALS, initialProcs, reap, send, stateName, type Proc, type Signal } from "@codex/widgets";
import { PUZZLES } from "@codex/widgets";
import { binarySearch, linearSearch, sampleList, sortCount, type SortName } from "@codex/widgets";
import { configBlock, defaultHost, longCommand, shortCommand, validate, type SshHost } from "@codex/widgets";
import { SAMPLE_SECRET, b64urlEncode, decodeToken, makeToken, sampleToken, utf8 } from "@codex/widgets";
import { SAMPLES, dissect, hexToBytes } from "@codex/widgets";
import { register } from "./labs.ts";
import { chip, frame, input } from "./lablib.ts";
import { editField, field } from "./textedit.ts";
import { ellipsize, strWidth, type Style } from "./text.ts";
import { rect } from "./ui.ts";

const ON: Style = { fg: "accentInk", bg: "accent", b: true };
const T = (c: any, x: number, y: number, s: string, st: Style = {}) => c.p.text(x, y, s, { bg: "panel", fg: "fg", ...st });

// ---- PATH lookup ----
register("pathlookup", {
  init: (a) => (a?.mode === "py" ? { py: true, f: field("random") } : { py: false, f: field("python3") }),
  rows: (_w, st) => (st.py ? 10 : 12),
  draw(c, st) {
    const i = frame(c, st.py ? "Where does import look?" : "PATH lookup", "type a name   esc leave");
    input(c, i.x, i.y, 28, st.f);
    const r = lookup(st.f.text.trim(), st.py ? PY_PATH : DEFAULT_PATH, st.py ? PY_FS : DEFAULT_FS);
    r.steps.forEach((s, k) => T(c, i.x, i.y + 2 + k, `${s.winner ? "▶" : " "} ${s.dir.padEnd(34)} ${s.winner ? "found here: this one runs" : s.shadowed ? "also here, but shadowed" : s.hit ? "" : "not here"}`, { fg: s.winner ? "ok" : s.shadowed ? "warn" : "mute", b: s.winner }));
    T(c, i.x, i.y + 3 + r.steps.length, r.found ? `result: ${r.found}` : "command not found", { fg: r.found ? "ok" : "bad", b: true });
  },
  key: (e, st) => editField(st.f, e),
});

// ---- semver ----
register("semver", {
  init: () => ({ f: field("^1.2.3") }),
  rows: () => SAMPLE_VERSIONS.length + 5,
  draw(c, st) {
    const i = frame(c, "Semver ranges", "type a range like ^1.2.3, ~1.2.3, >=1.0.0 <2   esc leave");
    input(c, i.x, i.y, 26, st.f);
    const info = parseRange(st.f.text.trim());
    if (!info.ok) T(c, i.x, i.y + 2, info.error ?? "not a valid range", { fg: "warn" });
    SAMPLE_VERSIONS.forEach((v, k) => { const ok = info.ok && satisfies(v, st.f.text.trim()); T(c, i.x, i.y + 3 + k, `${ok ? "✓" : "✗"} ${v}`, { fg: ok ? "ok" : "dim", b: ok }); });
  },
  key: (e, st) => editField(st.f, e),
});

// ---- password cracking time ----
register("crackcalc", {
  init: () => ({ cs: 1, len: 8, h: 0 }),
  rows: () => 12,
  draw(c, st) {
    const i = frame(c, "How long to guess it?", "+ - length   tab character set   h hash   esc leave");
    let x = i.x;
    CHARSETS.forEach(([n], k) => { x = chip(c, x, i.y, n, "cs" + k, () => { st.cs = k; }, k === st.cs ? ON : {}); });
    x = chip(c, i.x, i.y + 1, "-", "lm", () => { st.len = Math.max(1, st.len - 1); });
    T(c, x, i.y + 1, `length ${st.len}`, { b: true }); chip(c, x + 10, i.y + 1, "+", "lp", () => { st.len = Math.min(40, st.len + 1); });
    x = i.x;
    HASHES.forEach(([n], k) => { x = chip(c, x, i.y + 3, n, "h" + k, () => { st.h = k; }, k === st.h ? ON : {}); });
    const bits = entropyBits(CHARSETS[st.cs][2], st.len), r = crackTime(bits, HASHES[st.h][1]);
    T(c, i.x, i.y + 5, `${bits.toFixed(1)} bits of entropy`, { fg: "mute" });
    T(c, i.x, i.y + 6, `average time to guess: ${r.text}`, { fg: r.seconds < 3600 ? "bad" : r.seconds < 3.2e7 ? "warn" : "ok", b: true });
    T(c, i.x, i.y + 7, verdict(r.seconds), { fg: "fg" });
    T(c, i.x, i.y + 8, ellipsize(HASHES[st.h][2], i.w), { fg: "dim" });
  },
  key(e, st) {
    if (e.key === "+" || e.key === "=") st.len = Math.min(40, st.len + 1); else if (e.key === "-") st.len = Math.max(1, st.len - 1);
    else if (e.key === "tab") st.cs = (st.cs + 1) % CHARSETS.length; else if (e.key === "h") st.h = (st.h + 1) % HASHES.length; else return false;
    return true;
  },
});

// ---- avalanche ----
register("avalanche", {
  init: () => ({ a: field("hello world"), b: field("hello worle"), which: 0 }),
  rows: () => 18,
  draw(c, st) {
    const i = frame(c, "Avalanche effect", "type   tab switches text   esc leave");
    const fa = c.focus && st.which === 0, fb = c.focus && st.which === 1;
    T(c, i.x, i.y, "A", { fg: "dim" }); input({ ...c, focus: fa } as any, i.x + 2, i.y, 40, st.a);
    T(c, i.x, i.y + 1, "B", { fg: "dim" }); input({ ...c, focus: fb } as any, i.x + 2, i.y + 1, 40, st.b);
    const r = avalanche(st.a.text, st.b.text);
    T(c, i.x, i.y + 3, "A  " + r.hexA, { fg: "mute" }); T(c, i.x, i.y + 4, "B  " + r.hexB, { fg: "mute" });
    T(c, i.x, i.y + 5, `${r.diff} of 256 bits differ (${r.pct}%). Ideal is about 50%.`, { fg: r.diff > 100 ? "ok" : "warn", b: true });
    for (let row = 0; row < 8; row++) { let s = ""; for (let k = 0; k < 32; k++) s += r.changed[row * 32 + k] ? "█" : "·"; T(c, i.x, i.y + 7 + row, s, { fg: "accent" }); }
  },
  key(e, st) { if (e.key === "tab") { st.which = 1 - st.which; return true; } return editField(st.which ? st.b : st.a, e); },
});

// ---- TTL and traceroute ----
register("ttltrace", {
  init: () => ({ ttl: 3 }),
  rows: () => SAMPLE_PATH.length + 7,
  draw(c, st) {
    const i = frame(c, "TTL and traceroute", "+ - change the TTL   esc leave");
    let x = chip(c, i.x, i.y, "-", "tm", () => { st.ttl = Math.max(1, st.ttl - 1); });
    T(c, x, i.y, `TTL ${st.ttl}`, { b: true }); chip(c, x + 7, i.y, "+", "tp", () => { st.ttl = Math.min(SAMPLE_PATH.length, st.ttl + 1); });
    const p = probe(SAMPLE_PATH, st.ttl);
    T(c, i.x, i.y + 2, ellipsize(`${p.reply} from ${p.from}${p.rtt !== null ? `  ${p.rtt} ms` : ""}`, i.w), { fg: p.reply === "silence" ? "warn" : "ok", b: true });
    T(c, i.x, i.y + 3, ellipsize(p.note, i.w), { fg: "mute" });
    traceroute(SAMPLE_PATH).forEach((h, k) => T(c, i.x, i.y + 5 + k, `${String(k + 1).padStart(2)}  ${h.from.padEnd(18)} ${h.rtt === null ? "*" : h.rtt + " ms"}`, { fg: k + 1 === st.ttl ? "accent" : "dim", b: k + 1 === st.ttl }));
  },
  key(e, st) { if (e.key === "+" || e.key === "=") st.ttl = Math.min(SAMPLE_PATH.length, st.ttl + 1); else if (e.key === "-") st.ttl = Math.max(1, st.ttl - 1); else return false; return true; },
});

// ---- request waterfall ----
register("netwaterfall", {
  init: () => ({ s: 0 }),
  rows: () => 14,
  draw(c, st) {
    const i = frame(c, "Request waterfall", "tab scenario   esc leave");
    let x = i.x;
    SCENARIOS.forEach(([n], k) => { x = chip(c, x, i.y, ellipsize(n, 18), "s" + k, () => { st.s = k; }, k === st.s ? ON : {}); });
    const L = layout(SCENARIOS[st.s][1]), barW = Math.max(10, i.w - 34);
    L.bars.forEach((b, k) => {
      const y = i.y + 2 + k, off = Math.round((b.startPct / 100) * barW), n = Math.max(b.ms ? 1 : 0, Math.round((b.pct / 100) * barW));
      T(c, i.x, y, b.name.padEnd(16), { fg: "mute" });
      T(c, i.x + 17 + off, y, "█".repeat(n), { fg: b === L.biggest ? "warn" : "accent" });
      T(c, i.x + 18 + off + n, y, b.ms + " ms", { fg: "dim" });
    });
    T(c, i.x, i.y + 9, `total ${L.total} ms. ${L.hint}`.slice(0, i.w), { fg: "ok", b: true });
    T(c, i.x, i.y + 10, ellipsize(curlWriteOut(SCENARIOS[st.s][1]).replace(/\s+/g, " "), i.w), { fg: "dim" });
  },
  key(e, st) { if (e.key === "tab") { st.s = (st.s + 1) % SCENARIOS.length; return true; } return false; },
});

// ---- signals and processes ----
register("procsim", {
  init: () => ({ procs: initialProcs() as Proc[], sel: 2, msg: "Pick a process, then send it a signal." }),
  rows: () => 16,
  draw(c, st) {
    const i = frame(c, "Signals and process states", "↑↓ pick   t term   k kill   s stop   c cont   r reap   esc leave");
    T(c, i.x, i.y, "PID    PPID  STATE    NAME", { fg: "dim", b: true });
    (st.procs as Proc[]).forEach((p, k) => {
      const rr = rect(i.x, i.y + 1 + k, i.w, 1);
      c.p.fill(rr, k === st.sel ? "sel" : "panel");
      c.p.text(i.x, rr.y, `${String(p.pid).padEnd(7)}${String(p.ppid).padEnd(6)}${(p.state + " " + stateName[p.state]).padEnd(11)}${p.name}`, { fg: p.state === "Z" ? "bad" : p.state === "T" ? "warn" : "fg", bg: k === st.sel ? "sel" : "panel" });
      c.hits.add({ rect: rr, id: "pr" + k, click: () => { c.grab(); st.sel = k; }, hover: true });
    });
    let x = i.x;
    for (const [sg] of SIGNALS) x = chip(c, x, i.y + 8, sg, sg, () => { const r = send(st.procs, st.procs[st.sel].pid, sg as Signal); st.procs = r.procs; st.msg = r.message; });
    chip(c, x, i.y + 8, "reap zombies", "reap", () => { const r = reap(st.procs); st.procs = r.procs; st.msg = r.message; });
    T(c, i.x, i.y + 10, ellipsize(st.procs[st.sel]?.note ?? "", i.w), { fg: "mute" });
    T(c, i.x, i.y + 11, ellipsize(st.msg, i.w), { fg: "ok", b: true });
  },
  key(e, st) {
    const sg: Record<string, Signal> = { t: "SIGTERM", k: "SIGKILL", s: "SIGSTOP", c: "SIGCONT", i: "SIGINT", h: "SIGHUP" };
    if (e.key === "down" || e.key === "j") st.sel = Math.min(st.procs.length - 1, st.sel + 1);
    else if (e.key === "up" || e.key === "k" && false) st.sel = Math.max(0, st.sel - 1);
    else if (sg[e.key]) { const r = send(st.procs, st.procs[st.sel].pid, sg[e.key]); st.procs = r.procs; st.msg = r.message; }
    else if (e.key === "r") { const r = reap(st.procs); st.procs = r.procs; st.msg = r.message; } else return false;
    return true;
  },
});

// ---- JavaScript coercion quiz ----
register("jswat", {
  init: () => ({ n: 0, pick: -1, score: 0 }),
  rows: () => 12,
  draw(c, st) {
    const i = frame(c, "Predict the result", "1-3 answer   n next   esc leave");
    const p = PUZZLES[st.n];
    T(c, i.x, i.y, `${st.n + 1}/${PUZZLES.length}   score ${st.score}`, { fg: "dim" });
    T(c, i.x, i.y + 2, p.expr, { fg: "shCmd", b: true });
    let x = i.x;
    p.choices.forEach((ch, k) => { x = chip(c, x, i.y + 4, ch, "ch" + k, () => pick(st, k), st.pick === k ? { fg: "accentInk", bg: ch === p.answer ? "ok" : "bad", b: true } : {}); });
    if (st.pick >= 0) { T(c, i.x, i.y + 6, p.choices[st.pick] === p.answer ? "Correct." : `Not quite: it is ${p.answer}.`, { fg: p.choices[st.pick] === p.answer ? "ok" : "bad", b: true }); T(c, i.x, i.y + 7, ellipsize(p.why, i.w), { fg: "mute" }); chip(c, i.x, i.y + 8, "next", "nx", () => next(st)); }
  },
  key(e, st) { if (/^[1-9]$/.test(e.key) && st.pick < 0) pick(st, Number(e.key) - 1); else if (e.key === "n") next(st); else return false; return true; },
});
function pick(st: any, k: number) { const p = PUZZLES[st.n]; if (st.pick >= 0 || k >= p.choices.length) return; st.pick = k; if (p.choices[k] === p.answer) st.score++; }
function next(st: any) { st.n = (st.n + 1) % PUZZLES.length; st.pick = -1; }

// ---- algorithm racer ----
register("algoracer", {
  init: () => ({ n: 16 }),
  rows: () => 12,
  draw(c, st) {
    const i = frame(c, "Search and sort racer", "+ - list size   esc leave");
    let x = chip(c, i.x, i.y, "-", "am", () => { st.n = Math.max(4, st.n / 2); });
    T(c, x, i.y, `${st.n} items`, { b: true }); chip(c, x + 10, i.y, "+", "ap", () => { st.n = Math.min(1024, st.n * 2); });
    const list = sampleList(st.n), sorted = [...list].sort((a, b) => a - b), target = sorted[Math.floor(st.n * 0.8)];
    const lin = linearSearch(list, target).steps.length, bin = binarySearch(sorted, target).steps.length;
    const bar = (label: string, n: number, max: number, y: number) => { T(c, i.x, y, label.padEnd(22), { fg: "mute" }); const w = Math.max(1, Math.round((n / max) * Math.max(10, i.w - 40))); T(c, i.x + 23, y, "█".repeat(w), { fg: "accent" }); T(c, i.x + 24 + w, y, String(n), { fg: "dim" }); };
    T(c, i.x, i.y + 2, `finding ${target}:`, { fg: "dim", b: true });
    bar("linear search", lin, lin, i.y + 3); bar("binary search", bin, lin, i.y + 4);
    T(c, i.x, i.y + 6, "sorting (comparisons):", { fg: "dim", b: true });
    const res = (["bubble", "insertion", "merge"] as SortName[]).map((s) => [s, sortCount(s, list).comparisons] as const);
    const max = Math.max(...res.map((r) => r[1]));
    res.forEach(([s, n], k) => bar(s + " sort", n, max, i.y + 7 + k));
  },
  key(e, st) { if (e.key === "+" || e.key === "=") st.n = Math.min(1024, st.n * 2); else if (e.key === "-") st.n = Math.max(4, st.n / 2); else return false; return true; },
});

// ---- ssh config ----
register("sshconfig", {
  init: () => ({ h: defaultHost() as SshHost }),
  rows: () => 20,
  draw(c, st) {
    const i = frame(c, "ssh config builder", "j jump host   a agent   p port   esc leave");
    const h: SshHost = st.h;
    let x = chip(c, i.x, i.y, h.jump ? "jump host: on" : "jump host: off", "j", () => { h.jump = h.jump ? "" : "bastion.example.com"; }, h.jump ? ON : {});
    x = chip(c, x, i.y, h.agent ? "agent forwarding: on" : "agent forwarding: off", "a", () => { h.agent = !h.agent; }, h.agent ? ON : {});
    chip(c, x, i.y, `port ${h.port}`, "p", () => { h.port = h.port === 22 ? 2222 : 22; });
    configBlock(h).split("\n").forEach((l, k) => T(c, i.x, i.y + 2 + k, l, { fg: "shCmd" }));
    const y = i.y + 3 + configBlock(h).split("\n").length;
    T(c, i.x, y, "instead of typing:", { fg: "dim" });
    for (const [k, l] of wrapLine(longCommand(h), i.w).entries()) T(c, i.x, y + 1 + k, l, { fg: "mute" });
    T(c, i.x, y + 3, shortCommand(h), { fg: "ok", b: true });
    const bad = validate(h); if (bad.length) T(c, i.x, y + 4, bad[0], { fg: "warn" });
  },
  key(e, st) { if (e.key === "j") st.h.jump = st.h.jump ? "" : "bastion.example.com"; else if (e.key === "a") st.h.agent = !st.h.agent; else if (e.key === "p") st.h.port = st.h.port === 22 ? 2222 : 22; else return false; return true; },
});
const wrapLine = (s: string, w: number) => (s.length <= w ? [s] : [s.slice(0, w), s.slice(w, 2 * w)]);

// ---- JWT ----
register("jwt", {
  init: () => ({ token: sampleToken(), msg: "" }),
  rows: () => 14,
  draw(c, st) {
    const i = frame(c, "Decode, forge, verify a JWT", "esc leave");
    const d = decodeToken(st.token, SAMPLE_SECRET);
    T(c, i.x, i.y, ellipsize(st.token, i.w), { fg: "dim" });
    if (d.ok) {
      T(c, i.x, i.y + 2, "header   " + JSON.stringify(d.header), { fg: "an1" });
      T(c, i.x, i.y + 3, ellipsize("payload  " + JSON.stringify(d.payload), i.w), { fg: "an2" });
      T(c, i.x, i.y + 4, d.signatureValid ? "signature valid" : "signature INVALID", { fg: d.signatureValid ? "ok" : "bad", b: true });
    } else T(c, i.x, i.y + 2, d.error ?? "bad token", { fg: "bad" });
    let x = chip(c, i.x, i.y + 6, "make myself admin (keep old signature)", "adm", () => tamper(st));
    chip(c, x, i.y + 6, "re-sign with the secret", "rs", () => resign(st));
    chip(c, i.x, i.y + 8, "reset", "rst", () => { st.token = sampleToken(); });
    T(c, i.x, i.y + 10, "Anyone can read a JWT. Only the secret can make a signature that verifies.", { fg: "mute" });
  },
  key(e, st) { if (e.key === "a") tamper(st); else if (e.key === "s") resign(st); else if (e.key === "r") st.token = sampleToken(); else return false; return true; },
});
function tamper(st: any) { const d = decodeToken(st.token, SAMPLE_SECRET); if (!d.ok || !d.parts) return; st.token = d.parts[0] + "." + b64urlEncode(utf8(JSON.stringify({ ...(d.payload as object), role: "admin" }))) + "." + d.parts[2]; }
function resign(st: any) { const d = decodeToken(st.token, SAMPLE_SECRET); if (d.ok) st.token = makeToken(d.header as object, d.payload as object, SAMPLE_SECRET); }

// ---- packet dissector ----
register("dissect", {
  init: () => ({ s: 0 }),
  rows: (_w, st) => 5 + Math.min(14, dissect(hexToBytes(Object.values(SAMPLES)[st.s].hex)).fields.length),
  draw(c, st) {
    const i = frame(c, "Take a packet apart", "tab sample   esc leave");
    const keys = Object.values(SAMPLES);
    let x = i.x;
    keys.forEach((k, n) => { x = chip(c, x, i.y, k.label, "d" + n, () => { st.s = n; c.relayout(); }, n === st.s ? ON : {}); });
    const r = dissect(hexToBytes(keys[st.s].hex));
    if (r.error) T(c, i.x, i.y + 2, r.error, { fg: "bad" });
    r.fields.slice(0, 14).forEach((f, k) => T(c, i.x, i.y + 2 + k, ellipsize(`${f.layer.padEnd(9)}${f.name.padEnd(22)}${String(f.value).padEnd(20)}${f.note}`, i.w), { fg: k % 2 ? "mute" : "fg" }));
  },
  key(e, st, ctl) { if (e.key === "tab") { st.s = (st.s + 1) % Object.keys(SAMPLES).length; ctl.relayout(); return true; } return false; },
});
void strWidth;
