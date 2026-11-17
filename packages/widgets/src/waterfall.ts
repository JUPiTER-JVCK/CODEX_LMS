/** Request timing: the phases curl -w and the browser Network panel report. */
export interface Timing { dns: number; connect: number; tls: number; request: number; wait: number; download: number }
export const PHASES: [keyof Timing, string, string][] = [
  ["dns", "DNS lookup", "name to address (cached lookups cost about 0)"],
  ["connect", "TCP connect", "one round trip for SYN and SYN-ACK"],
  ["tls", "TLS handshake", "one more round trip with TLS 1.3 (two with TLS 1.2)"],
  ["request", "Send request", "usually tiny"],
  ["wait", "Waiting (TTFB)", "the server thinking: queries, rendering"],
  ["download", "Download", "bytes over the wire; grows with size and shrinks with bandwidth"],
];
export const SCENARIOS: [string, Timing][] = [
  ["Cold connection, far server", { dns: 40, connect: 90, tls: 95, request: 1, wait: 180, download: 60 }],
  ["Warm connection (keep-alive)", { dns: 0, connect: 0, tls: 0, request: 1, wait: 180, download: 60 }],
  ["Nearby CDN edge", { dns: 15, connect: 12, tls: 14, request: 1, wait: 25, download: 20 }],
  ["Slow database query", { dns: 5, connect: 10, tls: 12, request: 1, wait: 900, download: 15 }],
  ["Huge download", { dns: 5, connect: 10, tls: 12, request: 1, wait: 40, download: 1400 }],
];
export function layout(t: Timing) {
  const total = PHASES.reduce((n, [k]) => n + t[k], 0);
  let at = 0;
  const bars = PHASES.map(([k, name]) => { const b = { key: k, name, ms: t[k], start: at, pct: total ? (t[k] / total) * 100 : 0, startPct: total ? (at / total) * 100 : 0 }; at += t[k]; return b; });
  const biggest = bars.reduce((a, b) => (b.ms > a.ms ? b : a), bars[0]);
  const hint =
    total === 0 ? "No time at all."
    : biggest.key === "wait" ? "The server is the bottleneck: look at queries, caching and server-side work, not the network."
    : biggest.key === "download" ? "Transfer time dominates: compress, shrink images, or serve fewer bytes."
    : ["dns", "connect", "tls"].includes(biggest.key) ? "Connection set-up dominates: reuse connections (keep-alive, HTTP/2), use a nearer edge, enable TLS 1.3."
    : "Balanced: no single phase stands out.";
  return { total, bars, biggest, hint };
}
/** The curl -w line for these numbers (cumulative, like time_connect). */
export function curlWriteOut(t: Timing): string {
  const c1 = t.dns, c2 = c1 + t.connect, c3 = c2 + t.tls, c4 = c3 + t.request + t.wait, c5 = c4 + t.download;
  const s = (ms: number) => (ms / 1000).toFixed(3);
  return `time_namelookup ${s(c1)}\ntime_connect    ${s(c2)}\ntime_appconnect ${s(c3)}\ntime_starttransfer ${s(c4)}\ntime_total      ${s(c5)}`;
}
