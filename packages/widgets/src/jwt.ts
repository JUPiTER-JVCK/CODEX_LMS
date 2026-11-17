/** Decode, edit and verify HS256 JSON Web Tokens. */
import { hmacSha256, utf8 } from "./sha256.js";
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export function b64urlEncode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "") + (i + 2 < bytes.length ? B64[n & 63] : "");
  }
  return out;
}
export function b64urlDecode(s: string): Uint8Array | null {
  const clean = s.replace(/=+$/, "");
  if (/[^A-Za-z0-9_-]/.test(clean) || clean.length % 4 === 1) return null;
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (const c of clean) { buf = (buf << 6) | B64.indexOf(c); bits += 6; if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); buf &= (1 << bits) - 1; } }
  return Uint8Array.from(out);
}
export const signHS256 = (headerB64: string, payloadB64: string, secret: string) => b64urlEncode(hmacSha256(utf8(secret), utf8(`${headerB64}.${payloadB64}`)));
export function makeToken(header: object, payload: object, secret: string): string {
  const h = b64urlEncode(utf8(JSON.stringify(header))), p = b64urlEncode(utf8(JSON.stringify(payload)));
  return `${h}.${p}.${signHS256(h, p, secret)}`;
}
export interface Decoded { ok: boolean; error?: string; header?: unknown; payload?: unknown; signatureValid?: boolean; parts?: string[] }
export function decodeToken(token: string, secret: string): Decoded {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return { ok: false, error: "A JWT has exactly three parts separated by dots." };
  try {
    const h = b64urlDecode(parts[0]), p = b64urlDecode(parts[1]);
    if (!h || !p) return { ok: false, error: "A part is not valid base64url.", parts };
    const dec = new TextDecoder();
    const header = JSON.parse(dec.decode(h)), payload = JSON.parse(dec.decode(p));
    return { ok: true, header, payload, parts, signatureValid: header?.alg === "HS256" && signHS256(parts[0], parts[1], secret) === parts[2] };
  } catch { return { ok: false, error: "The header or payload is not valid JSON.", parts }; }
}
export const SAMPLE_SECRET = "lab-secret";
export const sampleToken = () => makeToken({ alg: "HS256", typ: "JWT" }, { sub: "42", name: "Ada", role: "user", exp: 1893456000 }, SAMPLE_SECRET);
