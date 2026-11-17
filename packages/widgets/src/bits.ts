/** Binary counter / bit register. Pure state machine: no UI. */
export interface BitsState {
  width: number;
  value: number; // unsigned, 0 .. 2^width-1
  /** set by the last increment/decrement/shift when the result wrapped */
  overflow: boolean;
}

export const bitsInit = (width = 8, value = 0): BitsState => ({
  width,
  value: mask(width, value),
  overflow: false,
});

const mask = (width: number, v: number) => ((v % 2 ** width) + 2 ** width) % 2 ** width;

export function toggleBit(s: BitsState, index: number): BitsState {
  if (index < 0 || index >= s.width) return s;
  const bit = 2 ** index;
  const on = Math.floor(s.value / bit) % 2 === 1;
  return { ...s, value: s.value + (on ? -bit : bit), overflow: false };
}

export function addBits(s: BitsState, delta: number): BitsState {
  const raw = s.value + delta;
  return { ...s, value: mask(s.width, raw), overflow: raw < 0 || raw >= 2 ** s.width };
}
export const increment = (s: BitsState) => addBits(s, 1);
export const decrement = (s: BitsState) => addBits(s, -1);

export function shiftLeft(s: BitsState, n = 1): BitsState {
  const raw = s.value * 2 ** n;
  return { ...s, value: mask(s.width, raw), overflow: raw >= 2 ** s.width };
}
export function shiftRight(s: BitsState, n = 1): BitsState {
  return { ...s, value: Math.floor(s.value / 2 ** n), overflow: false };
}
export function invert(s: BitsState): BitsState {
  return { ...s, value: 2 ** s.width - 1 - s.value, overflow: false };
}
export function setValue(s: BitsState, v: number): BitsState {
  return { ...s, value: mask(s.width, Math.trunc(v)), overflow: false };
}

/** Bits MSB first: [1,0,1,...] */
export function bitArray(s: BitsState): number[] {
  const out: number[] = [];
  for (let i = s.width - 1; i >= 0; i--) out.push(Math.floor(s.value / 2 ** i) % 2);
  return out;
}

/** Two's-complement reading of the same bits. */
export const signed = (s: BitsState) => (s.value >= 2 ** (s.width - 1) ? s.value - 2 ** s.width : s.value);

export interface BitsView {
  bin: string;
  hex: string;
  dec: number;
  signed: number;
  /** place values of the set bits, e.g. [128, 8, 1] */
  parts: number[];
}
export function bitsView(s: BitsState): BitsView {
  const bits = bitArray(s);
  return {
    bin: bits.join("").replace(/(.{4})(?=.)/g, "$1 "),
    hex: "0x" + s.value.toString(16).toUpperCase().padStart(Math.ceil(s.width / 4), "0"),
    dec: s.value,
    signed: signed(s),
    parts: bits.map((b, i) => (b ? 2 ** (s.width - 1 - i) : 0)).filter(Boolean),
  };
}
