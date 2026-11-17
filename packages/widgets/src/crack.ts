/** How long a brute-force guess takes, given the character set, the length and the hash. */
export const CHARSETS: [string, string, number][] = [["digits", "0-9", 10], ["lowercase", "a-z", 26], ["lower + upper", "a-zA-Z", 52], ["letters + digits", "a-zA-Z0-9", 62], ["printable ASCII", "all 94 symbols", 94]];
export const HASHES: [string, number, string][] = [
  ["MD5 / SHA-1 (fast)", 1e11, "designed for speed; a GPU rig tries about 100 billion per second"],
  ["SHA-256 (fast)", 2e10, "still a fast hash: wrong tool for passwords"],
  ["bcrypt cost 12", 2e4, "deliberately slow: about 20 thousand per second on a GPU rig"],
  ["Argon2id (64 MiB)", 2e3, "slow and memory-hungry, which also limits GPUs"],
];
export const entropyBits = (charset: number, length: number) => length * Math.log2(charset);
export function crackTime(bits: number, rate: number): { seconds: number; text: string } {
  const seconds = Math.pow(2, bits - 1) / rate; // on average the answer is found halfway through the space
  return { seconds, text: duration(seconds) };
}
export function duration(s: number): string {
  if (s < 1) return "instantly";
  const units: [string, number][] = [["years", 31_557_600], ["days", 86_400], ["hours", 3_600], ["minutes", 60], ["seconds", 1]];
  if (s >= 31_557_600 * 1e9) return `${(s / 31_557_600).toExponential(1)} years`;
  for (const [n, size] of units) if (s >= size) { const v = s / size; return `${v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(1).replace(/\.0$/, "")} ${n}`; }
  return "instantly";
}
export const verdict = (seconds: number) => seconds < 3600 ? "Weak: falls within an hour" : seconds < 86_400 * 365 ? "Marginal: months at most" : seconds < 31_557_600 * 1e4 ? "Reasonable against a single machine" : "Strong against brute force";
