/** UTF-8 encoder breakdown: characters -> code points -> bytes. */
export interface CharInfo { ch: string; cp: number; cpHex: string; bytes: number[]; bin: string[]; kind: "ascii" | "2-byte" | "3-byte" | "4-byte" }
export function utf8Breakdown(text: string): CharInfo[] {
  const enc = new TextEncoder();
  return [...text].map((ch) => {
    const cp = ch.codePointAt(0)!;
    const bytes = [...enc.encode(ch)];
    return {
      ch, cp, cpHex: "U+" + cp.toString(16).toUpperCase().padStart(4, "0"), bytes,
      bin: bytes.map((b) => b.toString(2).padStart(8, "0")),
      kind: bytes.length === 1 ? "ascii" : bytes.length === 2 ? "2-byte" : bytes.length === 3 ? "3-byte" : "4-byte",
    };
  });
}
export function utf8Summary(text: string) {
  const parts = utf8Breakdown(text);
  return { chars: parts.length, bytes: parts.reduce((n, p) => n + p.bytes.length, 0) };
}
/** The bit pattern template for a UTF-8 sequence of the given length, e.g. 110xxxxx 10xxxxxx. */
export const utf8Template = (n: number) => ["0xxxxxxx", "110xxxxx 10xxxxxx", "1110xxxx 10xxxxxx 10xxxxxx", "11110xxx 10xxxxxx 10xxxxxx 10xxxxxx"][n - 1];
