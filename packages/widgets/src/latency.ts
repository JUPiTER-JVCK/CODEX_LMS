/** Latency ladder: scale nanoseconds up so that 1 ns = 1 second, to feel the gaps between storage tiers. */
export interface Tier { name: string; ns: number; note: string }
export const TIERS: Tier[] = [
  { name: "CPU cycle (3 GHz)", ns: 0.33, note: "the unit of work" },
  { name: "L1 cache hit", ns: 1, note: "on the core itself" },
  { name: "L2 cache hit", ns: 4, note: "still on the chip" },
  { name: "Main memory (RAM)", ns: 100, note: "a trip off the chip" },
  { name: "NVMe SSD read", ns: 100_000, note: "flash, over PCIe" },
  { name: "Round trip inside a data centre", ns: 500_000, note: "same building" },
  { name: "Spinning disk seek", ns: 10_000_000, note: "a moving arm" },
  { name: "Round trip, California to Netherlands", ns: 150_000_000, note: "speed of light in fibre" },
];
export function humanTime(seconds: number): string {
  const units: [string, number][] = [["year", 31_557_600], ["month", 2_629_800], ["day", 86_400], ["hour", 3_600], ["minute", 60], ["second", 1]];
  for (const [name, size] of units) {
    if (seconds >= size) {
      const n = seconds / size;
      const txt = n >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, "");
      return `${txt} ${name}${txt === "1" ? "" : "s"}`;
    }
  }
  return `${seconds.toFixed(2)} seconds`;
}
/** How long a latency would take if one nanosecond lasted `secondsPerNs` seconds. */
export const scaled = (ns: number, secondsPerNs = 1) => humanTime(ns * secondsPerNs);
