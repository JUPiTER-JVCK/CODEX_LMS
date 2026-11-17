/** Logic gates, truth tables and small adder circuits. Pure functions. */
export type GateKind = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR" | "BUFFER";
export type Bit = 0 | 1;

export const GATES: GateKind[] = ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "BUFFER"];
export const isUnary = (g: GateKind) => g === "NOT" || g === "BUFFER";

export function evalGate(g: GateKind, a: Bit, b: Bit = 0): Bit {
  switch (g) {
    case "AND": return (a & b) as Bit;
    case "OR": return (a | b) as Bit;
    case "NOT": return (a ^ 1) as Bit;
    case "BUFFER": return a;
    case "NAND": return ((a & b) ^ 1) as Bit;
    case "NOR": return ((a | b) ^ 1) as Bit;
    case "XOR": return (a ^ b) as Bit;
    case "XNOR": return ((a ^ b) ^ 1) as Bit;
  }
}

export interface TruthRow { a: Bit; b: Bit; out: Bit }
export function truthTable(g: GateKind): TruthRow[] {
  if (isUnary(g)) return ([0, 1] as Bit[]).map((a) => ({ a, b: 0, out: evalGate(g, a) }));
  const rows: TruthRow[] = [];
  for (const a of [0, 1] as Bit[]) for (const b of [0, 1] as Bit[]) rows.push({ a, b, out: evalGate(g, a, b) });
  return rows;
}

export const GATE_BLURB: Record<GateKind, string> = {
  AND: "Output is 1 only when every input is 1.",
  OR: "Output is 1 when at least one input is 1.",
  NOT: "Flips the input: 0 becomes 1, 1 becomes 0.",
  NAND: "AND, then flipped. It is universal: any circuit can be built from NANDs alone.",
  NOR: "OR, then flipped. Also universal.",
  XOR: "Output is 1 when the inputs differ. This is the sum bit of binary addition.",
  XNOR: "Output is 1 when the inputs match: an equality check.",
  BUFFER: "Passes the input through. Real buffers restore signal strength.",
};

export function halfAdder(a: Bit, b: Bit): { sum: Bit; carry: Bit } {
  return { sum: evalGate("XOR", a, b), carry: evalGate("AND", a, b) };
}
export function fullAdder(a: Bit, b: Bit, cin: Bit): { sum: Bit; carry: Bit } {
  const h1 = halfAdder(a, b);
  const h2 = halfAdder(h1.sum, cin);
  return { sum: h2.sum, carry: evalGate("OR", h1.carry, h2.carry) };
}

/** Ripple-carry add of two n-bit values through chained full adders. */
export function rippleAdd(a: number, b: number, width = 4): { sum: number; carryOut: Bit; trace: { sum: Bit; carry: Bit }[] } {
  let carry: Bit = 0;
  let sum = 0;
  const trace: { sum: Bit; carry: Bit }[] = [];
  for (let i = 0; i < width; i++) {
    const r = fullAdder(((a >> i) & 1) as Bit, ((b >> i) & 1) as Bit, carry);
    sum |= r.sum << i;
    carry = r.carry;
    trace.push(r);
  }
  return { sum, carryOut: carry, trace };
}
