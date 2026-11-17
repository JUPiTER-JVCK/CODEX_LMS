/** ASCII renderers: the same widget state as the GUI draws, as plain text lines. */
import { GateKind, Bit, evalGate, isUnary, truthTable } from "./logic.js";
import { BitsState, bitArray, bitsView } from "./bits.js";
import { SubnetInfo } from "./subnet.js";

const symbol: Record<GateKind, string> = {
  AND: "&", NAND: "&", OR: "≥1", NOR: "≥1", XOR: "=1", XNOR: "=1", NOT: "1", BUFFER: "1",
};
const bubble = (g: GateKind) => g === "NAND" || g === "NOR" || g === "XNOR" || g === "NOT";

/** IEC rectangular gate with live wire values. */
export function gateArt(g: GateKind, a: Bit, b: Bit = 0): string[] {
  const out = evalGate(g, a, b);
  const sym = symbol[g].padStart(2).padEnd(3);
  const o = bubble(g) ? "○" : "─";
  if (isUnary(g)) {
    return [
      "          ┌─────┐",
      ` A:${a} ─────┤ ${sym} ├${o}──── Y:${out}`,
      "          └─────┘",
    ];
  }
  return [
    "          ┌─────┐",
    ` A:${a} ─────┤     ├`,
    `          │ ${sym} │${o}──── Y:${out}`,
    ` B:${b} ─────┤     ├`,
    "          └─────┘",
  ];
}

export function truthTableArt(g: GateKind, a?: Bit, b?: Bit): string[] {
  const rows = truthTable(g);
  const un = isUnary(g);
  const head = un ? "│ A │ Y │" : "│ A │ B │ Y │";
  const rule = (l: string, m: string, r: string) => l + (un ? "───" + m + "───" : "───" + m + "───" + m + "───") + r;
  const lines = [rule("┌", "┬", "┐"), head, rule("├", "┼", "┤")];
  for (const r of rows) {
    const hit = a !== undefined && r.a === a && (un || r.b === b);
    const cells = un ? ` ${r.a} │ ${r.out} ` : ` ${r.a} │ ${r.b} │ ${r.out} `;
    lines.push((hit ? "▶" : "│") + cells.replace(/^ /, " ") + (hit ? "◀" : "│"));
  }
  lines.push(rule("└", "┴", "┘"));
  return lines;
}

export function bitsArt(s: BitsState): string[] {
  const bits = bitArray(s);
  const place = bits.map((_, i) => String(2 ** (s.width - 1 - i)).padStart(3));
  const box = bits.map((b) => (b ? "█" : "░"));
  const v = bitsView(s);
  return [
    "  " + place.join(" "),
    "  " + box.map((c) => ` ${c}${c} `.slice(0, 3)).join(" "),
    "  " + bits.map((b) => ` ${b} `).join(" "),
    `  bin ${v.bin}   hex ${v.hex}   dec ${v.dec}   signed ${v.signed}${s.overflow ? "   ⚠ overflow" : ""}`,
  ];
}

export function subnetArt(i: SubnetInfo): string[] {
  const W = 52;
  const row = (k: string, v: string) => `│ ${k.padEnd(12)}${v}`.padEnd(W + 1) + "│";
  // underline the network bits of the binary address, leave host bits blank
  let left = i.prefix;
  const marks = i.ipBinary.split("").map((c) => (c === "." ? " " : left-- > 0 ? "▔" : " ")).join("");
  return [
    "┌" + "─".repeat(W) + "┐",
    row("address", `${i.ip}/${i.prefix}`),
    row("mask", i.mask),
    row("network", i.network),
    row("broadcast", i.broadcast),
    row("host range", `${i.firstHost} – ${i.lastHost}`),
    row("usable", String(i.hosts)),
    row("class/scope", `${i.cls} / ${i.scope}`),
    "├" + "─".repeat(W) + "┤",
    row("binary", i.ipBinary),
    row("", marks.trimEnd()),
    row("", `${i.networkBits} network bits · ${i.hostBits} host bits`),
    "└" + "─".repeat(W) + "┘",
  ];
}
