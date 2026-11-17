/** npm-style semantic version ranges: exact, ^, ~, comparators, x-ranges, AND (space) and OR (||). */
export type V = [number, number, number];
export function parseVersion(s: string): V | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(s.trim());
  return m ? [+m[1], +m[2], +m[3]] : null;
}
const cmp = (a: V, b: V) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const parts = (s: string): (number | null)[] | null => {
  const p = s.replace(/^v/, "").split(".");
  if (p.length < 1 || p.length > 3) return null;
  const out: (number | null)[] = [];
  for (const x of p) { if (/^[xX*]$/.test(x)) out.push(null); else if (/^\d+$/.test(x)) out.push(+x); else return null; }
  while (out.length < 3) out.push(null);
  return out;
};
interface Bound { lo: V; hi: V | null; hiInclusive?: boolean; explain: string }
/** Expand one comparator (like ^1.2.3 or >=2.0.0) into a [lo, hi) interval. */
function expand(tok: string): Bound | null {
  const m = /^(\^|~|>=|<=|>|<|=)?\s*(.+)$/.exec(tok);
  if (!m) return null;
  const op = m[1] ?? "=", p = parts(m[2]);
  if (!p) return null;
  const [a, b, c] = p;
  const lo: V = [a ?? 0, b ?? 0, c ?? 0];
  if (op === "^") {
    if (a === null) return { lo: [0, 0, 0], hi: null, explain: "any version" };
    if (a > 0 || b === null) return { lo, hi: [a + 1, 0, 0], explain: `>=${lo.join(".")} <${a + 1}.0.0 (same major)` };
    if (b > 0 || c === null) return { lo, hi: [0, b + 1, 0], explain: `>=${lo.join(".")} <0.${b + 1}.0 (0.x: minor is the breaking level)` };
    return { lo, hi: [0, 0, (c as number) + 1], explain: `>=${lo.join(".")} <0.0.${(c as number) + 1} (0.0.x: only that patch)` };
  }
  if (op === "~") {
    if (a === null) return { lo: [0, 0, 0], hi: null, explain: "any version" };
    if (b === null) return { lo, hi: [a + 1, 0, 0], explain: `>=${lo.join(".")} <${a + 1}.0.0` };
    return { lo, hi: [a, b + 1, 0], explain: `>=${lo.join(".")} <${a}.${b + 1}.0 (same minor)` };
  }
  if (op === "=" || op === "") {
    if (a === null) return { lo: [0, 0, 0], hi: null, explain: "any version" };
    if (b === null) return { lo, hi: [a + 1, 0, 0], explain: `>=${lo.join(".")} <${a + 1}.0.0` };
    if (c === null) return { lo, hi: [a, b + 1, 0], explain: `>=${lo.join(".")} <${a}.${b + 1}.0` };
    return { lo, hi: [a, b, c + 1], explain: `exactly ${lo.join(".")}` };
  }
  if (op === ">=") return { lo, hi: null, explain: `>=${lo.join(".")}` };
  if (op === ">") return { lo: [lo[0], lo[1], lo[2] + 1], hi: null, explain: `>${lo.join(".")}` };
  if (op === "<") return { lo: [0, 0, 0], hi: lo, explain: `<${lo.join(".")}` };
  return { lo: [0, 0, 0], hi: [lo[0], lo[1], lo[2] + 1], explain: `<=${lo.join(".")}` };
}
export interface RangeInfo { ok: boolean; error?: string; sets: Bound[][] }
export function parseRange(range: string): RangeInfo {
  const sets: Bound[][] = [];
  for (const alt of range.split("||")) {
    const toks = alt.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) return { ok: false, error: "Empty range", sets: [] };
    const set: Bound[] = [];
    for (let i = 0; i < toks.length; i++) {
      let t = toks[i];
      if (/^(\^|~|>=|<=|>|<|=)$/.test(t) && toks[i + 1]) t += toks[++i]; // "^ 1.2.3"
      const b = expand(t);
      if (!b) return { ok: false, error: `Cannot read "${t}"`, sets: [] };
      set.push(b);
    }
    sets.push(set);
  }
  return { ok: true, sets };
}
export function satisfies(version: string, range: string): boolean {
  const v = parseVersion(version), r = parseRange(range);
  if (!v || !r.ok) return false;
  return r.sets.some((set) => set.every((b) => cmp(v, b.lo) >= 0 && (b.hi === null || cmp(v, b.hi) < 0)));
}
export const SAMPLE_VERSIONS = ["0.2.9", "0.3.0", "1.0.0", "1.2.2", "1.2.3", "1.2.9", "1.3.0", "1.9.9", "2.0.0", "2.1.0", "3.0.0"];
