/** Take apart an Ethernet + IPv4 + TCP/UDP frame and name every byte range. */
export interface Field { layer: "Ethernet" | "IPv4" | "TCP" | "UDP" | "Payload"; name: string; start: number; len: number; value: string; note: string }
export const hexToBytes = (h: string) => Uint8Array.from((h.replace(/[^0-9a-fA-F]/g, "").match(/../g) ?? []).map((x) => parseInt(x, 16)));
const be = (b: Uint8Array, o: number, n: number) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[o + i]; return v; };
const mac = (b: Uint8Array, o: number) => [...b.slice(o, o + 6)].map((x) => x.toString(16).padStart(2, "0")).join(":");
const ip = (b: Uint8Array, o: number) => [...b.slice(o, o + 4)].join(".");
function tcpOptions(o: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < o.length;) {
    const k = o[i];
    if (k === 0) break;
    if (k === 1) { out.push("NOP"); i++; continue; }
    const len = o[i + 1] || 2;
    out.push(k === 2 ? `MSS ${be(o, i + 2, 2)}` : k === 3 ? `window scale ${o[i + 2]}` : k === 4 ? "SACK permitted" : k === 8 ? "timestamps" : `option ${k}`);
    i += len;
  }
  return out.join(", ");
}
export const TCP_FLAG_NAMES = ["FIN", "SYN", "RST", "PSH", "ACK", "URG", "ECE", "CWR"];
export function dissect(bytes: Uint8Array): { fields: Field[]; error?: string } {
  const f: Field[] = [];
  const add = (layer: Field["layer"], name: string, start: number, len: number, value: string, note = "") => f.push({ layer, name, start, len, value, note });
  if (bytes.length < 34) return { fields: f, error: "Too short: an Ethernet header (14 bytes) plus an IPv4 header (20) is the minimum." };
  add("Ethernet", "Destination MAC", 0, 6, mac(bytes, 0), "who should receive this frame on the local link");
  add("Ethernet", "Source MAC", 6, 6, mac(bytes, 6), "the sender's network card");
  const et = be(bytes, 12, 2);
  add("Ethernet", "EtherType", 12, 2, "0x" + et.toString(16).padStart(4, "0"), et === 0x0800 ? "IPv4 follows" : et === 0x86dd ? "IPv6 follows" : et === 0x0806 ? "ARP follows" : "unknown payload");
  if (et !== 0x0800) return { fields: f, error: "Only IPv4 frames are dissected here." };
  const o = 14, ihl = (bytes[o] & 15) * 4, proto = bytes[o + 9];
  add("IPv4", "Version / IHL", o, 1, `${bytes[o] >> 4} / ${ihl} bytes`, "version 4; header length in 4-byte words");
  add("IPv4", "DSCP / ECN", o + 1, 1, "0x" + bytes[o + 1].toString(16).padStart(2, "0"), "traffic class (usually 0)");
  add("IPv4", "Total length", o + 2, 2, String(be(bytes, o + 2, 2)), "IP header + everything after it");
  add("IPv4", "Identification", o + 4, 2, "0x" + be(bytes, o + 4, 2).toString(16).padStart(4, "0"), "groups the fragments of one packet");
  add("IPv4", "Flags / fragment offset", o + 6, 2, "0x" + be(bytes, o + 6, 2).toString(16).padStart(4, "0"), (bytes[o + 6] & 0x40) ? "DF set: do not fragment" : "may be fragmented");
  add("IPv4", "TTL", o + 8, 1, String(bytes[o + 8]), "hops left before a router drops it");
  add("IPv4", "Protocol", o + 9, 1, `${proto} (${proto === 6 ? "TCP" : proto === 17 ? "UDP" : proto === 1 ? "ICMP" : "other"})`, "which transport protocol follows");
  add("IPv4", "Header checksum", o + 10, 2, "0x" + be(bytes, o + 10, 2).toString(16).padStart(4, "0"), "detects corruption of the header");
  add("IPv4", "Source IP", o + 12, 4, ip(bytes, o + 12), "where the packet came from");
  add("IPv4", "Destination IP", o + 16, 4, ip(bytes, o + 16), "where it is going");
  const t = o + ihl;
  if (proto === 6 && bytes.length >= t + 20) {
    const off = (bytes[t + 12] >> 4) * 4, fl = bytes[t + 13];
    add("TCP", "Source port", t, 2, String(be(bytes, t, 2)), "the client's ephemeral port");
    add("TCP", "Destination port", t + 2, 2, String(be(bytes, t + 2, 2)), "the service being contacted");
    add("TCP", "Sequence number", t + 4, 4, String(be(bytes, t + 4, 4)), "position of the first payload byte");
    add("TCP", "Acknowledgement", t + 8, 4, String(be(bytes, t + 8, 4)), "next byte the sender expects");
    add("TCP", "Data offset", t + 12, 1, `${off} bytes`, "length of the TCP header");
    add("TCP", "Flags", t + 13, 1, TCP_FLAG_NAMES.filter((_, i) => fl & (1 << i)).join("+") || "none", "one bit each: SYN opens, ACK confirms, FIN closes, RST aborts");
    add("TCP", "Window", t + 14, 2, String(be(bytes, t + 14, 2)), "how many bytes the sender can accept");
    add("TCP", "Checksum", t + 16, 2, "0x" + be(bytes, t + 16, 2).toString(16).padStart(4, "0"), "covers header, payload and a pseudo-header");
    add("TCP", "Urgent pointer", t + 18, 2, String(be(bytes, t + 18, 2)), "only meaningful with the URG flag (almost never used)");
    if (off > 20) add("TCP", "Options", t + 20, off - 20, tcpOptions(bytes.slice(t + 20, t + off)), "negotiated extras, usually only on SYN segments");
    if (bytes.length > t + off) add("Payload", "Application data", t + off, bytes.length - t - off, `${bytes.length - t - off} bytes`, "what the application wrote");
  } else if (proto === 17 && bytes.length >= t + 8) {
    add("UDP", "Source port", t, 2, String(be(bytes, t, 2)), "ephemeral port chosen by the client");
    add("UDP", "Destination port", t + 2, 2, String(be(bytes, t + 2, 2)), be(bytes, t + 2, 2) === 53 ? "53 = DNS" : "the service being contacted");
    add("UDP", "Length", t + 4, 2, String(be(bytes, t + 4, 2)), "UDP header (8) + payload");
    add("UDP", "Checksum", t + 6, 2, "0x" + be(bytes, t + 6, 2).toString(16).padStart(4, "0"), "optional in IPv4");
    if (bytes.length > t + 8) add("Payload", "Application data", t + 8, bytes.length - t - 8, `${bytes.length - t - 8} bytes`, "for port 53 this is a DNS message");
  }
  return { fields: f };
}
/** A TCP SYN from a Mac to a web server, and a DNS query: real structure, made-up addresses. */
export const SAMPLES: Record<string, { label: string; hex: string }> = {
  syn: { label: "TCP SYN (start of a handshake)", hex: "5254 0012 3502 a4 83 e7 12 34 56 0800 45 00 0030 1c46 4000 40 06 b1ee c0a8 0117 5db8 d822 c738 0050 8bb3 5f0a 0000 0000 7002 ffff 1c1b 0000 0204 05b4 0402 0101".replace(/ /g, "") },
  dns: { label: "DNS query for example.com", hex: "5254 0012 3502 a483 e712 3456 0800 4500 0039 0000 4000 4011 b2c3 c0a8 0117 0101 0101 c4a1 0035 0025 9e12 abcd 0100 0001 0000 0000 0000 0765 7861 6d70 6c65 0363 6f6d 0000 0100 01".replace(/ /g, "") },
};
