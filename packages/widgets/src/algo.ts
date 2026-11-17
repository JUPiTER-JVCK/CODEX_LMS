/** Search and sort traces with step counts, for "algorithms with intuition". */
export interface SearchStep { index: number; value: number; lo?: number; hi?: number; found: boolean }
export function linearSearch(a: number[], target: number): { steps: SearchStep[]; found: number } {
  const steps: SearchStep[] = [];
  for (let i = 0; i < a.length; i++) {
    const found = a[i] === target;
    steps.push({ index: i, value: a[i], found });
    if (found) return { steps, found: i };
  }
  return { steps, found: -1 };
}
export function binarySearch(a: number[], target: number): { steps: SearchStep[]; found: number } {
  const steps: SearchStep[] = [];
  let lo = 0, hi = a.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const found = a[mid] === target;
    steps.push({ index: mid, value: a[mid], lo, hi, found });
    if (found) return { steps, found: mid };
    if (a[mid] < target) lo = mid + 1; else hi = mid - 1;
  }
  return { steps, found: -1 };
}
export type SortName = "bubble" | "insertion" | "merge";
/** Sorts a copy and returns the number of comparisons and writes (element moves). */
export function sortCount(name: SortName, input: number[]): { sorted: number[]; comparisons: number; moves: number } {
  const a = input.slice();
  let comparisons = 0, moves = 0;
  if (name === "bubble") {
    for (let end = a.length - 1; end > 0; end--) {
      let swapped = false;
      for (let i = 0; i < end; i++) { comparisons++; if (a[i] > a[i + 1]) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; moves += 2; swapped = true; } }
      if (!swapped) break;
    }
    return { sorted: a, comparisons, moves };
  }
  if (name === "insertion") {
    for (let i = 1; i < a.length; i++) {
      const v = a[i]; let j = i - 1;
      while (j >= 0) { comparisons++; if (a[j] > v) { a[j + 1] = a[j]; moves++; j--; } else break; }
      a[j + 1] = v; moves++;
    }
    return { sorted: a, comparisons, moves };
  }
  const merge = (xs: number[]): number[] => {
    if (xs.length <= 1) return xs;
    const mid = xs.length >> 1, l = merge(xs.slice(0, mid)), r = merge(xs.slice(mid)), out: number[] = [];
    let i = 0, j = 0;
    while (i < l.length && j < r.length) { comparisons++; out.push(l[i] <= r[j] ? l[i++] : r[j++]); moves++; }
    while (i < l.length) { out.push(l[i++]); moves++; }
    while (j < r.length) { out.push(r[j++]); moves++; }
    return out;
  };
  return { sorted: merge(a), comparisons, moves };
}
/** A reproducible pseudo-random list (xorshift) so the lab shows the same data every time. */
export function sampleList(n: number, seed = 7): number[] {
  let s = seed >>> 0 || 1;
  const out: number[] = [];
  for (let i = 0; i < n; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; out.push(s % 1000); }
  return out;
}
