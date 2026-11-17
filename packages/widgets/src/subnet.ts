/** IPv4 subnet calculator. Pure functions. */
export interface SubnetInfo {
  ip: string;
  prefix: number;
  mask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  hosts: number;
  ipBinary: string;
  maskBinary: string;
  networkBits: number;
  hostBits: number;
  cls: "A" | "B" | "C" | "D" | "E";
  scope: "private" | "loopback" | "link-local" | "public";
}

export function parseIPv4(s: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim());
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some((x) => x > 255)) return null;
  return ((o[0] * 256 + o[1]) * 256 + o[2]) * 256 + o[3];
}
export const fmtIPv4 = (n: number) => [24, 16, 8, 0].map((sh) => Math.floor(n / 2 ** sh) % 256).join(".");
const bin32 = (n: number) => n.toString(2).padStart(32, "0").replace(/(.{8})(?=.)/g, "$1.");

export function maskFor(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function parseCidr(input: string): { ip: number; prefix: number } | null {
  const m = /^\s*([\d.]+)\s*\/\s*(\d{1,2})\s*$/.exec(input);
  if (!m) return null;
  const ip = parseIPv4(m[1]);
  const prefix = Number(m[2]);
  if (ip === null || prefix < 0 || prefix > 32) return null;
  return { ip, prefix };
}

export function subnetInfo(ip: number, prefix: number): SubnetInfo {
  const mask = maskFor(prefix);
  const net = (ip & mask) >>> 0;
  const bc = (net | (~mask >>> 0)) >>> 0;
  const hostBits = 32 - prefix;
  const hosts = prefix >= 31 ? (prefix === 31 ? 2 : 1) : 2 ** hostBits - 2;
  const first = prefix >= 31 ? net : net + 1;
  const last = prefix >= 31 ? bc : bc - 1;
  const top = Math.floor(ip / 2 ** 24);
  const second = Math.floor(ip / 2 ** 16) % 256;
  const cls = top < 128 ? "A" : top < 192 ? "B" : top < 224 ? "C" : top < 240 ? "D" : "E";
  const scope =
    top === 127 ? "loopback"
    : top === 10 || (top === 172 && second >= 16 && second <= 31) || (top === 192 && second === 168) ? "private"
    : top === 169 && second === 254 ? "link-local"
    : "public";
  return {
    ip: fmtIPv4(ip), prefix, mask: fmtIPv4(mask), wildcard: fmtIPv4(~mask >>> 0),
    network: fmtIPv4(net), broadcast: fmtIPv4(bc), firstHost: fmtIPv4(first), lastHost: fmtIPv4(last),
    hosts, ipBinary: bin32(ip), maskBinary: bin32(mask), networkBits: prefix, hostBits, cls, scope,
  };
}

export function subnetFromCidr(input: string): SubnetInfo | null {
  const p = parseCidr(input);
  return p ? subnetInfo(p.ip, p.prefix) : null;
}

/** Split a network into 2^extra equal child subnets. */
export function splitSubnet(input: string, extraBits: number): SubnetInfo[] {
  const p = parseCidr(input);
  if (!p || extraBits < 0 || p.prefix + extraBits > 32 || extraBits > 6) return [];
  const newPrefix = p.prefix + extraBits;
  const base = (p.ip & maskFor(p.prefix)) >>> 0;
  const size = 2 ** (32 - newPrefix);
  return Array.from({ length: 2 ** extraBits }, (_, i) => subnetInfo(base + i * size, newPrefix));
}
