import { test } from "node:test";
import assert from "node:assert/strict";
import {
  humanTime, scaled, TIERS,
  linearSearch, binarySearch, sortCount, sampleList,
  initialProcs, send, reap,
  defaultHost, configBlock, longCommand, validate,
  PUZZLES, show,
  layout, SCENARIOS, curlWriteOut,
  satisfies, parseRange, parseVersion, SAMPLE_VERSIONS,
  probe, traceroute, SAMPLE_PATH,
  dissect, hexToBytes, SAMPLES,
  entropyBits, crackTime, duration, CHARSETS, HASHES,
} from "../src/index.ts";

test("latency ladder: 1 ns = 1 s", () => {
  assert.equal(scaled(1), "1 second");
  assert.equal(scaled(100), "1.7 minutes");
  assert.match(scaled(100_000), /day/);
  assert.match(scaled(150_000_000), /years?/);
  assert.equal(humanTime(0.33), "0.33 seconds");
  assert.ok(TIERS.every((t, i) => i === 0 || t.ns >= TIERS[i - 1].ns), "tiers are ordered");
});

test("search: binary search needs about log2(n) steps", () => {
  const a = Array.from({ length: 1024 }, (_, i) => i * 2);
  const lin = linearSearch(a, 2046), bin = binarySearch(a, 2046);
  assert.equal(lin.steps.length, 1024);
  assert.ok(bin.steps.length <= 11, String(bin.steps.length));
  assert.equal(bin.found, 1023);
  assert.equal(binarySearch(a, 3).found, -1);
  assert.equal(linearSearch([5, 6], 9).found, -1);
});
test("sorts: all correct, merge sort does fewer comparisons than bubble", () => {
  const data = sampleList(60);
  const expected = data.slice().sort((x, y) => x - y);
  const r = (["bubble", "insertion", "merge"] as const).map((n) => ({ n, ...sortCount(n, data) }));
  for (const x of r) assert.deepEqual(x.sorted, expected, x.n);
  assert.ok(r[2].comparisons < r[0].comparisons);
  assert.deepEqual(sampleList(5), sampleList(5), "deterministic");
  assert.equal(sortCount("bubble", [1, 2, 3, 4]).comparisons, 3, "bubble stops early on sorted input");
  assert.deepEqual(sortCount("merge", []).sorted, []);
});

test("signals: TERM, KILL, STOP/CONT, zombies", () => {
  let procs = initialProcs();
  let r = send(procs, 4410, "SIGSTOP"); assert.equal(r.procs.find((p) => p.pid === 4410)!.state, "T");
  r = send(r.procs, 4410, "SIGCONT"); assert.equal(r.procs.find((p) => p.pid === 4410)!.state, "S");
  r = send(r.procs, 4411, "SIGTERM"); assert.match(r.message, /carried on/); assert.equal(r.procs.find((p) => p.pid === 4411)!.state, "S");
  r = send(r.procs, 4411, "SIGKILL"); assert.equal(r.procs.find((p) => p.pid === 4411)!.state, "X");
  r = send(r.procs, 4412, "SIGTERM"); assert.equal(r.procs.find((p) => p.pid === 4412)!.state, "Z");
  assert.match(send(r.procs, 4412, "SIGKILL").message, /zombie/);
  const reaped = reap(r.procs); assert.equal(reaped.procs.find((p) => p.pid === 4412)!.state, "X");
  assert.match(reap(reaped.procs).message, /No zombies/);
  assert.match(send(procs, 1, "SIGKILL").message, /pid 1/);
  assert.match(send(procs, 999, "SIGTERM").message, /no such process/);
  assert.match(send(procs, 4410, "SIGCONT").message, /not stopped/);
  assert.equal(procs.find((p) => p.pid === 4410)!.state, "R", "input not mutated");
});

test("ssh config and equivalent command", () => {
  const h = { ...defaultHost(), jump: "bastion", port: 2222, forward: "8080:localhost:80", agent: true };
  const cfg = configBlock(h);
  assert.match(cfg, /^Host pi\n {4}HostName 192.168.1.50/);
  assert.match(cfg, /Port 2222/); assert.match(cfg, /ProxyJump bastion/); assert.match(cfg, /LocalForward 8080 localhost:80/); assert.match(cfg, /ForwardAgent yes/);
  assert.equal(longCommand(h), "ssh -i ~/.ssh/id_ed25519_lab -o IdentitiesOnly=yes -p 2222 -J bastion -L 8080:localhost:80 -A pi@192.168.1.50");
  assert.equal(longCommand(defaultHost()), "ssh -i ~/.ssh/id_ed25519_lab -o IdentitiesOnly=yes pi@192.168.1.50");
  assert.deepEqual(validate(defaultHost()), []);
  assert.equal(validate({ ...defaultHost(), alias: "a b", port: 70000, forward: "x" }).length, 3);
});

test("JavaScript puzzles: every answer is what the engine really prints", () => {
  for (const p of PUZZLES) {
    const actual = show(new Function(`return (${p.expr})`)());
    assert.equal(actual, p.answer, p.expr);
    assert.ok(p.choices.includes(p.answer), `${p.expr}: answer among choices`);
  }
  assert.equal(PUZZLES.length >= 10, true);
});

test("waterfall layout adds up and gives advice", () => {
  for (const [, t] of SCENARIOS) {
    const l = layout(t);
    assert.equal(Math.round(l.bars.reduce((n, b) => n + b.pct, 0)), 100);
    assert.ok(l.bars.every((b, i) => i === 0 || Math.abs(b.startPct - (l.bars[i - 1].startPct + l.bars[i - 1].pct)) < 1e-9));
  }
  assert.match(layout(SCENARIOS[3][1]).hint, /server/);
  assert.match(layout(SCENARIOS[4][1]).hint, /Transfer/);
  assert.match(layout(SCENARIOS[0][1]).hint, /Balanced|set-up|server/);
  assert.match(curlWriteOut(SCENARIOS[1][1]), /time_total      0.241/);
});

test("semver ranges match npm's rules", () => {
  const ok = (v: string, r: string) => satisfies(v, r);
  assert.ok(ok("1.2.3", "^1.2.3") && ok("1.9.9", "^1.2.3") && !ok("2.0.0", "^1.2.3") && !ok("1.2.2", "^1.2.3"));
  assert.ok(ok("0.2.9", "^0.2.3") && !ok("0.3.0", "^0.2.3"));
  assert.ok(ok("0.0.3", "^0.0.3") && !ok("0.0.4", "^0.0.3"));
  assert.ok(ok("1.2.9", "~1.2.3") && !ok("1.3.0", "~1.2.3") && ok("1.9.0", "~1"));
  assert.ok(ok("2.0.0", ">=1.2.3 <3.0.0") && !ok("3.0.0", ">=1.2.3 <3.0.0"));
  assert.ok(ok("1.0.0", "1.x") && ok("1.7.1", "1") && !ok("2.0.0", "1.x"));
  assert.ok(ok("3.0.0", "^1.0.0 || ^3.0.0") && !ok("2.5.0", "^1.0.0 || ^3.0.0"));
  assert.ok(ok("1.2.4", ">1.2.3") && !ok("1.2.3", ">1.2.3") && ok("1.2.3", "<=1.2.3") && ok("9.9.9", "*"));
  assert.ok(ok("1.2.3", "^ 1.2.3"), "operator then space");
  assert.equal(parseRange("^banana").ok, false);
  assert.equal(parseVersion("1.2"), null);
  assert.deepEqual(SAMPLE_VERSIONS.filter((v) => satisfies(v, "^1.2.3")), ["1.2.3", "1.2.9", "1.3.0", "1.9.9"]);
});

test("traceroute: TTL decides who answers", () => {
  assert.equal(probe(SAMPLE_PATH, 1).from, "192.168.1.1");
  assert.equal(probe(SAMPLE_PATH, 1).reply, "time-exceeded");
  assert.equal(probe(SAMPLE_PATH, 4).reply, "silence");
  const last = probe(SAMPLE_PATH, 6);
  assert.equal(last.reply, "echo-reply"); assert.equal(last.from, "93.184.216.34");
  assert.equal(probe(SAMPLE_PATH, 30).ttlAtArrival, 24);
  assert.equal(traceroute(SAMPLE_PATH).length, 6);
});

test("packet dissection names every byte range", () => {
  const syn = dissect(hexToBytes(SAMPLES.syn.hex));
  assert.equal(syn.error, undefined);
  const get = (n: string) => syn.fields.find((f) => f.name === n)!;
  assert.equal(get("Protocol").value, "6 (TCP)");
  assert.equal(get("Source IP").value, "192.168.1.23");
  assert.equal(get("Destination port").value, "80");
  assert.equal(get("Flags").value, "SYN");
  assert.equal(get("TTL").value, "64");
  const total = syn.fields.filter((f) => f.layer !== "Payload").reduce((n, f) => n + f.len, 0);
  assert.equal(total, 14 + 20 + 28, "fields tile the headers exactly (TCP header is 28 bytes with options)");
  assert.equal(get("Options").value, "MSS 1460, SACK permitted, NOP, NOP");
  for (const k of ["syn", "dns"]) { const b = hexToBytes(SAMPLES[k].hex); assert.equal((b[16] << 8) | b[17], b.length - 14, `${k}: IPv4 total length matches the frame`); }
  assert.ok(syn.fields.every((f, i) => i === 0 || f.start === syn.fields[i - 1].start + syn.fields[i - 1].len), "no gaps or overlaps");
  const dns = dissect(hexToBytes(SAMPLES.dns.hex));
  assert.equal(dns.fields.find((f) => f.name === "Destination port")!.note, "53 = DNS");
  assert.equal(dns.fields.at(-1)!.layer, "Payload");
  assert.ok(dissect(hexToBytes("0011")).error);
  assert.match(dissect(hexToBytes(SAMPLES.syn.hex.replace("0800", "0806"))).error!, /IPv4/);
});

test("password entropy and crack time", () => {
  assert.equal(Math.round(entropyBits(26, 8)), 38);
  assert.equal(Math.round(entropyBits(94, 12)), 79);
  const fast = HASHES[0][1], slow = HASHES[2][1];
  assert.equal(crackTime(entropyBits(10, 6), fast).text, "instantly");
  assert.ok(crackTime(entropyBits(62, 8), slow).seconds > crackTime(entropyBits(62, 8), fast).seconds * 1000);
  assert.equal(duration(90), "1.5 minutes");
  assert.equal(duration(7200), "2 hours");
  assert.match(duration(1e30), /e\+/);
  assert.equal(CHARSETS.length, 5);
});
