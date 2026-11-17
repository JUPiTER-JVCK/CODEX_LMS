// Seven terminal labs on the shared widget logic (packages/widgets), registered by name.

import { bitArray, bitsInit, bitsView, decrement, increment, invert, shiftLeft, shiftRight, toggleBit, setValue, type BitsState } from "@codex/widgets";
import { GATES, GATE_BLURB, evalGate, gateArt, isUnary, type Bit, type GateKind } from "@codex/widgets";
import { applyMask, cidrMask, ipToNum, numToIp, flagNames, type MaskOp } from "@codex/widgets";
import { utf8Breakdown } from "@codex/widgets";
import { CRON_PRESETS, explain, nextRuns } from "@codex/widgets";
import { TIERS, scaled } from "@codex/widgets";
import { subnetFromCidr } from "@codex/widgets";
import { register, type LabCtx } from "./labs.ts";
import { editField, field, type TextField } from "./textedit.ts";
import { ellipsize, strWidth, type Style } from "./text.ts";
import { rect, type Rect } from "./ui.ts";
import { A_UNDER } from "./screen.ts";

type Ctl = { relayout(): void; toast(m: string): void };

/** The lab's box; returns the inside. */
export function frame(c: LabCtx, title: string, hint: string): Rect {
  const { p, r } = c;
  p.box(r, { fg: c.focus ? "accent" : "line", bg: "panel" }, "panel");
  p.text(r.x + 2, r.y, ` ${title} `, { fg: "accent", bg: "panel", b: true });
  const h = " " + (c.focus ? hint : "click or press enter to use") + " ";
  p.text(r.x + r.w - 2 - strWidth(h), r.y + r.h - 1, h, { fg: "dim", bg: "panel" });
  return rect(r.x + 2, r.y + 1, r.w - 4, r.h - 2);
}

/** A clickable chip. Returns the x after it. */
export function chip(c: LabCtx, x: number, y: number, label: string, id: string, on: () => void, st: Style = {}): number {
  const t = ` ${label} `;
  const style: Style = { fg: st.fg ?? "fg", bg: st.bg ?? "panel2", b: st.b ?? false };
  c.p.text(x, y, t, style);
  const rr = rect(x, y, strWidth(t), 1);
  c.hits.add({ rect: rr, id, click: () => { c.grab(); on(); }, hover: true });
  if (c.hoverId === id) c.p.decorate(rr, A_UNDER);
  return x + strWidth(t) + 1;
}

export function input(c: LabCtx, x: number, y: number, w: number, f: TextField) {
  c.p.fill(rect(x, y, w, 1), "codeBg");
  c.p.text(x + 1, y, ellipsize(f.text, w - 2), { fg: "fg", bg: "codeBg" });
  if (c.focus) c.p.text(x + 1 + strWidth(f.text.slice(0, f.cur)), y, f.text[f.cur] ?? " ", { fg: "accentInk", bg: "accent" });
}

const bitChip = (b: number) => (b ? " 1 " : " 0 ");

// ---- bit switches ----
register("bitswitches", {
  init: () => ({ s: bitsInit(8, 0) as BitsState }),
  rows: () => 9,
  draw(c, st) {
    const i = frame(c, "Bit switches", "0-7 flip a bit   + - add   < > shift   ~ invert   esc leave");
    const s: BitsState = st.s, bits = bitArray(s), v = bitsView(s);
    for (let k = 0; k < s.width; k++) {
      const x = i.x + k * 6;
      c.p.text(x, i.y, String(2 ** (s.width - 1 - k)).padStart(4), { fg: "dim", bg: "panel" });
      chip(c, x, i.y + 1, bitChip(bits[k]).trim().padStart(2).padEnd(3), "bit" + k, () => { st.s = toggleBit(s, k); }, { fg: bits[k] ? "accentInk" : "mute", bg: bits[k] ? "accent" : "panel2", b: true });
    }
    c.p.text(i.x, i.y + 3, `binary ${v.bin}`, { fg: "fg", bg: "panel" });
    c.p.text(i.x, i.y + 4, `decimal ${String(v.dec).padEnd(6)} hex ${v.hex.padEnd(8)} signed ${v.signed}`, { fg: "fg", bg: "panel" });
    c.p.text(i.x, i.y + 5, v.parts.length ? v.parts.join(" + ") + " = " + v.dec : "no bits set", { fg: "mute", bg: "panel" });
    let x = i.x;
    const ops: [string, (s: BitsState) => BitsState][] = [["+1", increment], ["-1", decrement], ["<<", (z) => shiftLeft(z)], [">>", (z) => shiftRight(z)], ["NOT", invert], ["0", (z) => setValue(z, 0)]];
    for (const [l, f] of ops) x = chip(c, x, i.y + 6, l, "op" + l, () => { st.s = f(st.s); });
    if (s.overflow) c.p.text(x + 1, i.y + 6, "wrapped around (overflow)", { fg: "warn", bg: "panel", b: true });
  },
  key(e, st) {
    const k = e.key;
    if (/^[0-7]$/.test(k)) st.s = toggleBit(st.s, Number(k)); else if (k === "+" || k === "=") st.s = increment(st.s);
    else if (k === "-") st.s = decrement(st.s); else if (k === "<") st.s = shiftLeft(st.s); else if (k === ">") st.s = shiftRight(st.s);
    else if (k === "~") st.s = invert(st.s); else return false;
    return true;
  },
});

// ---- logic gates ----
register("gates", {
  init: () => ({ g: 0, a: 1 as Bit, b: 0 as Bit }),
  rows: (_w, st) => 7 + gateArt(GATES[st.g] as GateKind, 0, 0).length,
  draw(c, st) {
    const i = frame(c, "Logic gates", "tab gate   a flip A   b flip B   esc leave");
    const g = GATES[st.g] as GateKind;
    let x = i.x;
    GATES.forEach((n, k) => { x = chip(c, x, i.y, n, "g" + k, () => { st.g = k; c.relayout(); }, k === st.g ? { fg: "accentInk", bg: "accent", b: true } : {}); });
    c.p.text(i.x, i.y + 1, ellipsize(GATE_BLURB[g], i.w), { fg: "mute", bg: "panel" });
    const art = gateArt(g, st.a, st.b);
    art.forEach((l, k) => c.p.text(i.x, i.y + 3 + k, l, { fg: "fg", bg: "panel" }));
    let y = i.y + 3 + art.length;
    x = chip(c, i.x, y, `A = ${st.a}`, "ga", () => { st.a = (1 - st.a) as Bit; }, { fg: st.a ? "accentInk" : "mute", bg: st.a ? "accent" : "panel2", b: true });
    if (!isUnary(g)) x = chip(c, x, y, `B = ${st.b}`, "gb", () => { st.b = (1 - st.b) as Bit; }, { fg: st.b ? "accentInk" : "mute", bg: st.b ? "accent" : "panel2", b: true });
    c.p.text(x + 1, y, `output ${evalGate(g, st.a, st.b)}`, { fg: evalGate(g, st.a, st.b) ? "ok" : "mute", bg: "panel", b: true });
  },
  key(e, st, ctl) {
    if (e.key === "tab") { st.g = (st.g + (e.shift ? GATES.length - 1 : 1)) % GATES.length; ctl.relayout(); }
    else if (e.key === "a") st.a = (1 - st.a) as Bit; else if (e.key === "b") st.b = (1 - st.b) as Bit; else return false;
    return true;
  },
});

// ---- bit mask ----
const OPS: MaskOp[] = ["AND", "OR", "XOR", "CLEAR"];
register("bitmask", {
  init: (args) => (args?.mode === "ip" ? { ip: true, prefix: 24, op: 0, v: 0, m: 0 } : { ip: false, op: 0, v: 0xca, m: 0x0f, prefix: 24 }),
  rows: (_w, st) => (st.ip ? 8 : 9),
  draw(c, st) {
    const i = frame(c, st.ip ? "Mask an address" : "Bit mask lab", st.ip ? "< > change the prefix   esc leave" : "0-7 flip mask bit   tab operation   esc leave");
    if (st.ip) {
      const ip = ipToNum("192.168.1.23")!, m = cidrMask(st.prefix);
      c.p.text(i.x, i.y, "address        192.168.1.23", { fg: "fg", bg: "panel" });
      c.p.text(i.x, i.y + 1, `mask    /${String(st.prefix).padEnd(2)}   ${numToIp(m)}`, { fg: "fg", bg: "panel" });
      c.p.text(i.x, i.y + 2, `AND  =  network  ${numToIp((ip & m) >>> 0)}`, { fg: "ok", bg: "panel", b: true });
      c.p.text(i.x, i.y + 3, `host part        ${numToIp((ip & ~m) >>> 0)}`, { fg: "mute", bg: "panel" });
      let x = i.x;
      for (const p of [8, 16, 24, 26, 30]) x = chip(c, x, i.y + 5, "/" + p, "p" + p, () => { st.prefix = p; }, p === st.prefix ? { fg: "accentInk", bg: "accent", b: true } : {});
      return;
    }
    const op = OPS[st.op], r = applyMask(op, st.v, st.m, 8);
    const row = (y: number, label: string, bits: string, fg: string) => { c.p.text(i.x, y, label.padEnd(8), { fg: "dim", bg: "panel" }); c.p.text(i.x + 9, y, bits.replace(/(.{4})/, "$1 "), { fg, bg: "panel", b: true }); };
    row(i.y, "value", r.valueBits, "fg");
    row(i.y + 1, "mask", r.maskBits, "accent");
    row(i.y + 2, op, r.resultBits, "ok");
    for (let k = 0; k < 8; k++) chip(c, i.x + 9 + k * 4 + (k > 3 ? 1 : 0), i.y + 3, String(7 - k), "m" + k, () => { st.m ^= 1 << (7 - k); }, { fg: "mute" });
    c.p.text(i.x, i.y + 4, `${r.value} ${op} ${r.mask} = ${r.result}   ${flagNames(r.result).join(" ")}`, { fg: "mute", bg: "panel" });
    let x = i.x;
    OPS.forEach((o, k) => { x = chip(c, x, i.y + 6, o, "o" + k, () => { st.op = k; }, k === st.op ? { fg: "accentInk", bg: "accent", b: true } : {}); });
  },
  key(e, st) {
    if (st.ip) { if (e.key === "<" || e.key === "left") st.prefix = Math.max(0, st.prefix - 1); else if (e.key === ">" || e.key === "right") st.prefix = Math.min(32, st.prefix + 1); else return false; return true; }
    if (/^[0-7]$/.test(e.key)) st.m ^= 1 << (7 - Number(e.key)); else if (e.key === "tab") st.op = (st.op + 1) % OPS.length; else return false;
    return true;
  },
});

// ---- UTF-8 ----
register("utf8", {
  init: () => ({ f: field("A\u00e9\u20ac\u{1F600}") }),
  rows: (_w, st) => 5 + Math.min(8, [...st.f.text].length),
  draw(c, st) {
    const i = frame(c, "Text to bytes", "type to change the text   esc leave");
    input(c, i.x, i.y, Math.min(40, i.w), st.f);
    c.p.text(i.x, i.y + 2, "char  code point   UTF-8 bytes", { fg: "dim", bg: "panel", b: true });
    utf8Breakdown(st.f.text).slice(0, 8).forEach((ch, k) => {
      const y = i.y + 3 + k;
      c.p.text(i.x, y, ch.ch === " " ? "·" : ch.ch, { fg: "accent", bg: "panel", b: true });
      c.p.text(i.x + 6, y, ch.cpHex.padEnd(11), { fg: "fg", bg: "panel" });
      c.p.text(i.x + 18, y, ellipsize(ch.bin.join(" ") + "  (" + ch.bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ") + ")", i.w - 18), { fg: "mute", bg: "panel" });
    });
  },
  key(e, st, ctl) { if (editField(st.f, e)) { ctl.relayout(); return true; } return false; },
});

// ---- cron ----
register("cron", {
  init: () => ({ f: field("*/15 9-17 * * 1-5") }),
  rows: () => 12,
  draw(c, st) {
    const i = frame(c, "Cron explainer", "type an expression   esc leave");
    input(c, i.x, i.y, Math.min(34, i.w), st.f);
    c.p.text(i.x, i.y + 1, "minute hour day-of-month month weekday", { fg: "dim", bg: "panel" });
    c.p.text(i.x, i.y + 3, ellipsize(explain(st.f.text), i.w), { fg: "ok", bg: "panel", b: true });
    const runs = nextRuns(st.f.text, new Date(), 5);
    runs.forEach((d, k) => c.p.text(i.x, i.y + 5 + k, d.toISOString().slice(0, 16).replace("T", "  ") + " UTC", { fg: "fg", bg: "panel" }));
    let x = i.x + 30;
    CRON_PRESETS.slice(0, 4).forEach(([e, l], k) => { if (x + strWidth(l) + 3 < i.x + i.w) x = chip(c, x, i.y + 5 + k, l, "c" + k, () => { st.f = field(e); }); });
  },
  key(e, st) { return editField(st.f, e); },
});

// ---- latency ladder ----
register("latencyladder", {
  init: () => ({ human: true }),
  rows: () => TIERS.length + 4,
  draw(c, st) {
    const i = frame(c, "Latency ladder", "esc leave");
    chip(c, i.x, i.y, st.human ? "1 ns = 1 second" : "real time", "lat", () => { st.human = !st.human; });
    const nameW = 38, barW = Math.max(6, i.w - nameW - 16);
    TIERS.forEach((t, k) => {
      const y = i.y + 2 + k, n = Math.max(1, Math.round(((Math.log10(t.ns) + 0.5) / 8.5) * barW));
      c.p.text(i.x, y, ellipsize(t.name, nameW - 1), { fg: "fg", bg: "panel" });
      c.p.text(i.x + nameW, y, "█".repeat(n), { fg: k < 3 ? "ok" : k < 6 ? "warn" : "bad", bg: "panel" });
      const label = st.human ? scaled(t.ns) : t.ns >= 1e6 ? (t.ns / 1e6) + " ms" : t.ns >= 1e3 ? (t.ns / 1e3) + " us" : t.ns + " ns";
      c.p.text(i.x + nameW + n + 1, y, label, { fg: "mute", bg: "panel" });
    });
  },
});

// ---- subnet ----
register("subnet", {
  init: () => ({ f: field("192.168.1.130/26") }),
  rows: () => 12,
  draw(c, st) {
    const i = frame(c, "Subnet calculator", "type an address/prefix   esc leave");
    input(c, i.x, i.y, Math.min(30, i.w), st.f);
    const s = subnetFromCidr(st.f.text.trim());
    if (!s) { c.p.text(i.x, i.y + 2, "type something like 10.0.0.5/24", { fg: "warn", bg: "panel" }); return; }
    const L: [string, string][] = [["mask", `${s.mask}  (/${s.prefix})`], ["network", s.network], ["broadcast", s.broadcast], ["hosts", `${s.firstHost} - ${s.lastHost}   (${s.hosts} usable)`], ["class / scope", `${s.cls}, ${s.scope}`]];
    L.forEach(([k, v], n) => { c.p.text(i.x, i.y + 2 + n, k.padEnd(14), { fg: "dim", bg: "panel" }); c.p.text(i.x + 14, i.y + 2 + n, ellipsize(v, i.w - 14), { fg: "fg", bg: "panel", b: n === 1 }); });
    const net = s.ipBinary.replace(/\./g, "").slice(0, s.prefix), host = s.ipBinary.replace(/\./g, "").slice(s.prefix);
    const dot = (b: string, off: number) => b.split("").map((ch, k) => ((off + k) % 8 === 0 && off + k ? "." : "") + ch).join("");
    c.p.text(i.x, i.y + 8, dot(net, 0), { fg: "accent", bg: "panel", b: true });
    c.p.text(i.x + strWidth(dot(net, 0)) + (s.prefix % 8 === 0 && s.prefix < 32 ? 1 : 0), i.y + 8, dot(host, s.prefix).replace(/^\./, ""), { fg: "warn", bg: "panel", b: true });
    c.p.text(i.x, i.y + 9, `${s.networkBits} network bits (blue), ${s.hostBits} host bits (amber)`, { fg: "dim", bg: "panel" });
  },
  key(e, st) { return editField(st.f, e); },
});
