/** traceroute: send probes with TTL 1, 2, 3...; each router that drops TTL to 0 answers "time exceeded". */
export interface Hop { name: string; ip: string; rtt: number; silent?: boolean }
export const SAMPLE_PATH: Hop[] = [
  { name: "your Mac", ip: "192.168.1.23", rtt: 0 },
  { name: "home router", ip: "192.168.1.1", rtt: 1.4 },
  { name: "ISP gateway", ip: "10.20.0.1", rtt: 8.9 },
  { name: "ISP core", ip: "72.14.215.85", rtt: 11.2 },
  { name: "(firewall: no reply)", ip: "*", rtt: 0, silent: true },
  { name: "backbone exchange", ip: "206.126.236.12", rtt: 24.7 },
  { name: "example.com", ip: "93.184.216.34", rtt: 31.5 },
];
export interface Probe { ttl: number; ttlAtArrival: number; reply: "time-exceeded" | "echo-reply" | "silence"; from: string; rtt: number | null; note: string }
export function probe(path: Hop[], ttl: number): Probe {
  const dest = path.length - 1;
  const hopIndex = Math.min(ttl, dest);
  const hop = path[hopIndex];
  if (ttl >= dest) return { ttl, ttlAtArrival: ttl - dest, reply: "echo-reply", from: hop.ip, rtt: hop.rtt, note: `Arrived with TTL ${ttl - dest} left: the destination answers normally.` };
  if (hop.silent) return { ttl, ttlAtArrival: 0, reply: "silence", from: "*", rtt: null, note: "This router dropped the packet but filters ICMP, so nothing comes back." };
  return { ttl, ttlAtArrival: 0, reply: "time-exceeded", from: hop.ip, rtt: hop.rtt, note: `TTL hit 0 at ${hop.name}; it sent ICMP time exceeded back to you.` };
}
export const traceroute = (path: Hop[]) => Array.from({ length: path.length - 1 }, (_, i) => probe(path, i + 1));
