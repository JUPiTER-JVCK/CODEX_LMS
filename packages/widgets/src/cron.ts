/** Cron: parse a 5-field expression, explain it in words, list the next runs. */
const RANGES: [string, number, number][] = [["minute", 0, 59], ["hour", 0, 23], ["day of month", 1, 31], ["month", 1, 12], ["day of week", 0, 6]];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function field(src: string, lo: number, hi: number): number[] | null {
  const set = new Set<number>();
  for (const part of src.split(",")) {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
    if (!m) return null;
    let a = lo, b = hi;
    if (m[1] !== "*") { const r = m[1].split("-").map(Number); a = r[0]; b = r.length > 1 ? r[1] : m[2] ? hi : r[0]; }
    const step = m[2] ? Number(m[2]) : 1;
    if (step < 1 || a < lo || b > hi || a > b) return null;
    for (let v = a; v <= b; v += step) set.add(v);
  }
  return [...set].sort((x, y) => x - y);
}
export interface Cron { fields: number[][]; raw: string[]; domStar: boolean; dowStar: boolean }
export function parseCron(expr: string): Cron | { error: string } {
  const raw = expr.trim().split(/\s+/);
  if (raw.length !== 5) return { error: "Cron needs exactly 5 fields: minute hour day-of-month month day-of-week." };
  const fields: number[][] = [];
  for (let i = 0; i < 5; i++) {
    let src = raw[i];
    if (i === 4) src = src.replace(/\b7\b/g, "0");
    const f = field(src, RANGES[i][1], RANGES[i][2]);
    if (!f || f.length === 0) return { error: `Bad ${RANGES[i][0]} field "${raw[i]}" (allowed ${RANGES[i][1]}-${RANGES[i][2]}).` };
    fields.push(f);
  }
  return { fields, raw, domStar: raw[2] === "*", dowStar: raw[4] === "*" };
}
const pad = (n: number) => String(n).padStart(2, "0");
function listWords(raw: string, f: number[], name: (n: number) => string, unit: string): string {
  if (raw === "*") return `every ${unit}`;
  const step = /^\*\/(\d+)$/.exec(raw);
  if (step) return `every ${step[1]} ${unit}s`;
  return f.map(name).join(", ");
}
export function explain(expr: string): string {
  const c = parseCron(expr);
  if ("error" in c) return c.error;
  const [min, hr, dom, mon, dow] = c.fields;
  const [rm, rh, rd, rmo, rw] = c.raw;
  let when: string;
  if (rm === "*" && rh === "*") when = "every minute";
  else if (/^\*\/\d+$/.test(rm) && rh === "*") when = `every ${rm.slice(2)} minutes`;
  else if (rh === "*") when = `at minute ${min.join(", ")} of every hour`;
  else if (min.length === 1 && hr.length === 1) when = `at ${pad(hr[0])}:${pad(min[0])}`;
  else when = `at minute ${min.join(", ")} past hour ${hr.join(", ")}`;
  const extra: string[] = [];
  if (!c.domStar) extra.push(`on day ${listWords(rd, dom, String, "day")} of the month`);
  if (rmo !== "*") extra.push(`in ${listWords(rmo, mon, (n) => MONTHS[n - 1], "month")}`);
  if (!c.dowStar) extra.push(`on ${listWords(rw, dow, (n) => DAYS[n], "weekday")}`);
  const both = !c.domStar && !c.dowStar ? " (cron runs when EITHER the day of month OR the weekday matches)" : "";
  return [when, ...extra].join(", ") + both;
}
/** Next n run times strictly after `from` (local time). */
export function nextRuns(expr: string, from: Date, n = 5): Date[] {
  const c = parseCron(expr);
  if ("error" in c) return [];
  const [min, hr, dom, mon, dow] = c.fields;
  const out: Date[] = [];
  const d = new Date(from.getTime()); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + 1);
  for (let guard = 0; out.length < n && guard < 366 * 24 * 60 * 5; guard++) {
    const dayOk = c.domStar && c.dowStar ? true : c.domStar ? dow.includes(d.getDay()) : c.dowStar ? dom.includes(d.getDate()) : dom.includes(d.getDate()) || dow.includes(d.getDay());
    if (!mon.includes(d.getMonth() + 1) || !dayOk) { d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); continue; }
    if (!hr.includes(d.getHours())) { d.setHours(d.getHours() + 1, 0, 0, 0); continue; }
    if (!min.includes(d.getMinutes())) { d.setMinutes(d.getMinutes() + 1, 0, 0); continue; }
    out.push(new Date(d.getTime()));
    d.setMinutes(d.getMinutes() + 1);
  }
  return out;
}
export const CRON_PRESETS: [string, string][] = [["*/5 * * * *", "every 5 minutes"], ["0 3 * * *", "3 am daily"], ["30 8 * * 1-5", "weekday mornings"], ["0 0 1 * *", "monthly"], ["15 14 1 * *", "first of the month"]];
