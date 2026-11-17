/** Bit-mask lab: apply AND / OR / XOR / NOT / shifts to a value with a mask. */
export type MaskOp = "AND" | "OR" | "XOR" | "CLEAR";
export interface MaskResult { width: number; value: number; mask: number; result: number; op: MaskOp; valueBits: string; maskBits: string; resultBits: string; kept: boolean[]; note: string }
const m32 = (n: number) => n >>> 0;
export function applyMask(op: MaskOp, value: number, mask: number, width = 8): MaskResult {
  const full = width === 32 ? 0xffffffff : 2 ** width - 1;
  const v = m32(value) & full, k = m32(mask) & full;
  const result = m32(op === "AND" ? v & k : op === "OR" ? v | k : op === "XOR" ? v ^ k : v & ~k) & full;
  const bits = (n: number) => n.toString(2).padStart(width, "0");
  const note =
    op === "AND" ? "Keeps a bit only where the mask has a 1; everything else becomes 0. Use it to extract."
    : op === "OR" ? "Sets every bit where the mask has a 1; the rest are untouched. Use it to turn flags on."
    : op === "XOR" ? "Flips every bit where the mask has a 1. Use it to toggle flags."
    : "Clears every bit where the mask has a 1 (AND with NOT mask). Use it to turn flags off.";
  return { width, value: v, mask: k, result, op, valueBits: bits(v), maskBits: bits(k), resultBits: bits(result), kept: [...bits(k)].map((c) => c === "1"), note };
}
export const cidrMask = (prefix: number) => (prefix === 0 ? 0 : m32(0xffffffff << (32 - prefix)));
export const ipToNum = (ip: string): number | null => {
  const p = ip.split(".").map(Number);
  return p.length === 4 && p.every((x) => Number.isInteger(x) && x >= 0 && x <= 255) ? m32(((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3]) : null;
};
export const numToIp = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
export const TCP_FLAGS: [string, number][] = [["FIN", 0x01], ["SYN", 0x02], ["RST", 0x04], ["PSH", 0x08], ["ACK", 0x10], ["URG", 0x20]];
export const flagNames = (byte: number) => TCP_FLAGS.filter(([, b]) => byte & b).map(([n]) => n);
