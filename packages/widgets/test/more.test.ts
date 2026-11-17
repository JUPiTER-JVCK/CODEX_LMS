import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import {
  sha256Hex, sha256, hmacSha256, utf8, toHex, avalanche,
  utf8Breakdown, utf8Summary,
  applyMask, cidrMask, ipToNum, numToIp, flagNames,
  lookup, DEFAULT_PATH,
  b64urlEncode, b64urlDecode, makeToken, decodeToken, sampleToken, SAMPLE_SECRET,
  parseCron, explain, nextRuns,
} from "../src/index.ts";

test("sha256 matches node:crypto across lengths", () => {
  for (const s of ["", "abc", "hello", "a".repeat(55), "a".repeat(56), "a".repeat(64), "a".repeat(1000), "漢字 🎼"]) {
    assert.equal(sha256Hex(s), createHash("sha256").update(s).digest("hex"), s.slice(0, 10));
  }
});
test("hmac-sha256 matches node:crypto, including long keys", () => {
  for (const [k, m] of [["key", "The quick brown fox"], ["k".repeat(100), "msg"], ["", ""]]) {
    assert.equal(toHex(hmacSha256(utf8(k), utf8(m))), createHmac("sha256", k).update(m).digest("hex"));
  }
});
test("avalanche: one character flips about half the bits", () => {
  const r = avalanche("hello", "hellp");
  assert.ok(r.diff > 90 && r.diff < 170, String(r.diff));
  assert.equal(r.changed.length, 256);
  assert.equal(avalanche("same", "same").diff, 0);
});
test("utf8 breakdown", () => {
  const p = utf8Breakdown("A€𝄞é");
  assert.deepEqual(p.map((x) => x.bytes.length), [1, 3, 4, 2]);
  assert.equal(p[1].cpHex, "U+20AC");
  assert.deepEqual(p[1].bytes, [0xe2, 0x82, 0xac]);
  assert.deepEqual(utf8Summary("café"), { chars: 4, bytes: 5 });
});
test("mask ops", () => {
  const r = applyMask("AND", 0b1011_0110, 0b1111_0000);
  assert.equal(r.resultBits, "10110000");
  assert.equal(applyMask("OR", 0b0000_0001, 0b1000_0000).result, 0b1000_0001);
  assert.equal(applyMask("XOR", 0b1111_0000, 0b1010_1010).result, 0b0101_1010);
  assert.equal(applyMask("CLEAR", 0b1111_1111, 0b0000_1111).result, 0b1111_0000);
  const net = applyMask("AND", ipToNum("192.168.1.23")!, cidrMask(24), 32);
  assert.equal(numToIp(net.result), "192.168.1.0");
  assert.equal(numToIp(cidrMask(26)), "255.255.255.192");
  assert.deepEqual(flagNames(0x12), ["SYN", "ACK"]);
  assert.equal(ipToNum("256.1.1.1"), null);
});
test("PATH lookup: first match wins, later ones are shadowed", () => {
  const r = lookup("python3", DEFAULT_PATH);
  assert.equal(r.found, "/opt/homebrew/bin/python3");
  assert.deepEqual(r.shadowed, ["/usr/local/bin/python3", "/usr/bin/python3"]);
  assert.equal(lookup("nope", DEFAULT_PATH).found, null);
  assert.equal(lookup("ls", "/bin:/usr/bin").found, "/bin/ls");
  assert.equal(lookup("./run.sh", DEFAULT_PATH).found, "./run.sh");
});
test("base64url round trips and rejects junk", () => {
  for (const s of ["", "a", "ab", "abc", "abcd", "?>~~"]) assert.equal(new TextDecoder().decode(b64urlDecode(b64urlEncode(utf8(s)))!), s);
  assert.equal(b64urlEncode(utf8("any carnal pleas")), Buffer.from("any carnal pleas").toString("base64url"));
  assert.equal(b64urlDecode("a$b"), null);
});
test("JWT: sign, verify, tamper", () => {
  const t = sampleToken();
  const d = decodeToken(t, SAMPLE_SECRET);
  assert.ok(d.ok && d.signatureValid);
  assert.equal((d.payload as any).name, "Ada");
  assert.equal(decodeToken(t, "wrong").signatureValid, false);
  const [h, , s] = t.split(".");
  const evil = `${h}.${b64urlEncode(utf8(JSON.stringify({ sub: "42", role: "admin" })))}.${s}`;
  assert.equal(decodeToken(evil, SAMPLE_SECRET).signatureValid, false);
  assert.equal(decodeToken("a.b", "x").ok, false);
  // reference vector from jwt.io (HS256, secret "your-256-bit-secret")
  const ref = makeToken({ alg: "HS256", typ: "JWT" }, { sub: "1234567890", name: "John Doe", iat: 1516239022 }, "your-256-bit-secret");
  assert.equal(ref, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
});
test("cron parse, explain and next runs", () => {
  assert.ok("error" in parseCron("* * * *"));
  assert.ok("error" in parseCron("61 * * * *"));
  assert.equal(explain("*/5 * * * *"), "every 5 minutes");
  assert.equal(explain("0 3 * * *"), "at 03:00");
  assert.equal(explain("30 8 * * 1-5"), "at 08:30, on Monday, Tuesday, Wednesday, Thursday, Friday");
  const from = new Date(2026, 0, 14, 10, 7, 30); // Wed 14 Jan 2026 10:07:30
  assert.deepEqual(nextRuns("*/5 * * * *", from, 3).map((d) => d.getMinutes()), [10, 15, 20]);
  const monthly = nextRuns("0 0 1 * *", from, 2);
  assert.deepEqual(monthly.map((d) => [d.getMonth(), d.getDate(), d.getHours()]), [[1, 1, 0], [2, 1, 0]]);
  const wk = nextRuns("30 8 * * 1-5", new Date(2026, 0, 16, 9, 0), 2); // Fri 9:00 -> next Mon, Tue
  assert.deepEqual(wk.map((d) => d.getDay()), [1, 2]);
  assert.deepEqual(nextRuns("0 0 30 2 *", from, 1), []); // Feb 30 never happens
});
