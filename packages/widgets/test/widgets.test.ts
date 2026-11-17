import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bitsInit, toggleBit, increment, decrement, shiftLeft, shiftRight, invert, bitsView, signed, bitArray,
  GATES, evalGate, truthTable, halfAdder, fullAdder, rippleAdd,
  subnetFromCidr, splitSubnet, parseIPv4, fmtIPv4,
  gateArt, truthTableArt, bitsArt, subnetArt,
} from "../src/index.ts";

test("bits: toggle and views", () => {
  let s = bitsInit(8);
  s = toggleBit(s, 7); s = toggleBit(s, 0);
  assert.equal(s.value, 129);
  const v = bitsView(s);
  assert.equal(v.bin, "1000 0001");
  assert.equal(v.hex, "0x81");
  assert.equal(v.signed, -127);
  assert.deepEqual(v.parts, [128, 1]);
  assert.equal(toggleBit(toggleBit(s, 7), 7).value, 129);
});

test("bits: wraparound sets overflow, like the year-2038 problem", () => {
  let s = bitsInit(8, 255);
  s = increment(s);
  assert.equal(s.value, 0); assert.equal(s.overflow, true);
  s = decrement(s);
  assert.equal(s.value, 255); assert.equal(s.overflow, true);
  assert.equal(signed(bitsInit(8, 127)), 127);
  assert.equal(signed(increment(bitsInit(8, 127))), -128);
});

test("bits: shifts and invert", () => {
  assert.equal(shiftLeft(bitsInit(8, 0b1100_0001)).value, 0b1000_0010);
  assert.equal(shiftLeft(bitsInit(8, 0b1100_0001)).overflow, true);
  assert.equal(shiftRight(bitsInit(8, 0b1000_0010)).value, 0b0100_0001);
  assert.equal(invert(bitsInit(8, 0b1010_0101)).value, 0b0101_1010);
  assert.deepEqual(bitArray(bitsInit(4, 5)), [0, 1, 0, 1]);
});

test("gates: truth tables are correct", () => {
  const expect: Record<string, number[]> = {
    AND: [0, 0, 0, 1], OR: [0, 1, 1, 1], NAND: [1, 1, 1, 0], NOR: [1, 0, 0, 0], XOR: [0, 1, 1, 0], XNOR: [1, 0, 0, 1],
  };
  for (const [g, col] of Object.entries(expect)) {
    assert.deepEqual(truthTable(g as never).map((r) => r.out), col, g);
  }
  assert.deepEqual(truthTable("NOT").map((r) => r.out), [1, 0]);
  assert.deepEqual(truthTable("BUFFER").map((r) => r.out), [0, 1]);
  assert.equal(GATES.length, 8);
});

test("gates: NAND is universal", () => {
  const nand = (a: 0 | 1, b: 0 | 1) => evalGate("NAND", a, b);
  for (const a of [0, 1] as const) for (const b of [0, 1] as const) {
    assert.equal(nand(nand(a, b), nand(a, b)), evalGate("AND", a, b));
    assert.equal(nand(nand(a, a), nand(b, b)), evalGate("OR", a, b));
  }
});

test("adders", () => {
  assert.deepEqual(halfAdder(1, 1), { sum: 0, carry: 1 });
  assert.deepEqual(fullAdder(1, 1, 1), { sum: 1, carry: 1 });
  for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
    const r = rippleAdd(a, b, 4);
    assert.equal(r.sum + r.carryOut * 16, a + b);
  }
});

test("subnet: /24 and /26 and edge cases", () => {
  const a = subnetFromCidr("192.168.1.130/26")!;
  assert.equal(a.network, "192.168.1.128");
  assert.equal(a.broadcast, "192.168.1.191");
  assert.equal(a.mask, "255.255.255.192");
  assert.equal(a.wildcard, "0.0.0.63");
  assert.equal(a.hosts, 62);
  assert.equal(a.firstHost, "192.168.1.129");
  assert.equal(a.lastHost, "192.168.1.190");
  assert.equal(a.cls, "C"); assert.equal(a.scope, "private");
  assert.equal(subnetFromCidr("10.0.0.0/8")!.hosts, 16777214);
  assert.equal(subnetFromCidr("10.0.0.1/32")!.hosts, 1);
  assert.equal(subnetFromCidr("10.0.0.0/31")!.hosts, 2);
  assert.equal(subnetFromCidr("0.0.0.0/0")!.mask, "0.0.0.0");
  assert.equal(subnetFromCidr("127.0.0.1/8")!.scope, "loopback");
  assert.equal(subnetFromCidr("999.1.1.1/8"), null);
  assert.equal(subnetFromCidr("1.2.3.4/33"), null);
  assert.equal(parseIPv4("255.255.255.255"), 4294967295);
  assert.equal(fmtIPv4(4294967295), "255.255.255.255");
});

test("subnet: split", () => {
  const kids = splitSubnet("192.168.1.0/24", 2);
  assert.deepEqual(kids.map((k) => k.network), ["192.168.1.0", "192.168.1.64", "192.168.1.128", "192.168.1.192"]);
  assert.ok(kids.every((k) => k.prefix === 26));
  assert.deepEqual(splitSubnet("10.0.0.0/30", 3), []);
});

test("ascii renderers produce aligned, non-empty frames", () => {
  for (const g of GATES) {
    const art = gateArt(g, 1, 0);
    assert.ok(art.length >= 3 && art.every((l) => l.length > 0), g);
    assert.ok(art.join("\n").includes(`Y:${evalGate(g, 1, 0)}`), g);
    assert.ok(truthTableArt(g, 1, 0).length >= 5);
  }
  assert.ok(bitsArt(bitsInit(8, 5)).join("\n").includes("0x05"));
  const sub = subnetArt(subnetFromCidr("192.168.1.130/26")!);
  assert.equal(new Set(sub.map((l) => l.length)).size, 1, "subnet box lines all equal width");
});
