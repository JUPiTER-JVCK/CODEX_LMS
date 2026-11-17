import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  bitsInit, toggleBit, increment, decrement, shiftLeft, shiftRight, invert, setValue, bitArray, bitsView, bitsArt,
  GATES, GATE_BLURB, GateKind, Bit, evalGate, isUnary, gateArt, truthTableArt, fullAdder,
  parseCidr, subnetInfo, subnetArt, splitSubnet, fmtIPv4,
} from "@codex/widgets";
import { Theme } from "./theme.js";
import { Button } from "./ui.js";
import { Clickable, isMouseInput, useWheel } from "./mouse.js";
import { Line, Seg, loadChapter, renderBlocks, ChapterMeta } from "./reader.js";

const col = (th: Theme, c?: Seg["color"]) => (c ? th[c] : th.text);

/* ------------------------------------------------------------------ reader */
export function Reader({ meta, th, focused, width, height }: { meta: ChapterMeta; th: Theme; focused: boolean; width: number; height: number }) {
  const [top, setTop] = useState(0);
  const lines: Line[] = useMemo(() => {
    const head: Line[] = [
      [{ t: `${meta.time ?? "?"} min · ${meta.level ?? ""} · ${meta.commands} commands · ${meta.exercises} exercises`, color: "muted" }],
      [{ t: meta.sub, dim: true }], [],
      ...(meta.goals.length ? [[{ t: "You will be able to", bold: true, color: "accent2" as const }] as Line, ...meta.goals.map((g) => [{ t: " ✓ ", color: "good" as const }, { t: g }] as Line), []] : []),
    ];
    return [...head, ...renderBlocks(loadChapter(meta.id).blocks, width)];
  }, [meta.id, width]);
  const view = Math.max(3, height - 3);
  const max = Math.max(0, lines.length - view);
  useEffect(() => setTop(0), [meta.id]);
  const scroll = (d: number) => setTop((t) => Math.max(0, Math.min(max, t + d)));
  useInput((input, key) => {
    if (!focused || isMouseInput(input)) return;
    if (key.downArrow || input === "j") scroll(1);
    else if (key.upArrow || input === "k") scroll(-1);
    else if (key.pageDown || input === " ") scroll(view - 1);
    else if (key.pageUp) scroll(-(view - 1));
    else if (input === "g") setTop(0);
    else if (input === "G") setTop(max);
  });
  useWheel((d, c) => { if (c > 31) scroll(d * 3); });
  const pct = max === 0 ? 100 : Math.round((100 * top) / max);
  const barH = view, thumb = Math.max(1, Math.round((view * view) / Math.max(view, lines.length)));
  const thumbTop = max === 0 ? 0 : Math.round(((barH - thumb) * top) / max);
  return (
    <Box flexDirection="column">
    <Box flexDirection="row">
      <Box flexDirection="column" width={width}>
        {lines.slice(top, top + view).map((l, i) => (
          <Text key={i} wrap="truncate-end">
            {l.length === 0 ? " " : l.map((s, j) => <Text key={j} bold={s.bold} dimColor={s.dim} color={col(th, s.color)}>{s.t}</Text>)}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column" marginLeft={1}>
        {Array.from({ length: barH }, (_, i) => <Text key={i} color={i >= thumbTop && i < thumbTop + thumb ? th.accent : th.muted}>{i >= thumbTop && i < thumbTop + thumb ? "█" : "│"}</Text>)}
      </Box>
    </Box>
    <Text color={th.muted}>{`${pct}% · ↑↓ / wheel scroll · space page · g/G top/bottom`}</Text>
    </Box>
  );
}

/* -------------------------------------------------------------------- bits */
export function BitsScreen({ th, focused }: { th: Theme; focused: boolean }) {
  const [s, setS] = useState(() => bitsInit(8, 5));
  const [sel, setSel] = useState(7);
  const bits = bitArray(s);
  const v = bitsView(s);
  useInput((input, key) => {
    if (!focused || isMouseInput(input)) return;
    if (key.leftArrow) setSel((x) => Math.min(7, x + 1));
    else if (key.rightArrow) setSel((x) => Math.max(0, x - 1));
    else if (input === " " || key.return) setS((p) => toggleBit(p, sel));
    else if (input === "+" || input === "=") setS(increment);
    else if (input === "-") setS(decrement);
    else if (input === "<") setS((p) => shiftLeft(p));
    else if (input === ">") setS((p) => shiftRight(p));
    else if (input === "n") setS(invert);
    else if (input === "c") setS((p) => setValue(p, 0));
    else if (/^[0-1]$/.test(input)) setS((p) => { const on = bitArray(p)[7 - sel] === 1; return (input === "1") === on ? p : toggleBit(p, sel); });
  });
  return (
    <Box flexDirection="column">
      <Text color={th.muted}>Click a bit (or ←/→ and space) to flip it. Each bit is worth double the one on its right.</Text>
      <Box marginTop={1}>
        {bits.map((b, i) => {
          const idx = 7 - i;
          const on = b === 1;
          return (
            <Clickable key={idx} id={`bit${idx}`} onClick={() => { setSel(idx); setS((p) => toggleBit(p, idx)); }} flexDirection="column" alignItems="center" marginRight={1}>
              <Text color={th.muted}>{String(2 ** idx).padStart(3)}</Text>
              <Box borderStyle={sel === idx && focused ? "bold" : "round"} borderColor={on ? th.accent2 : th.muted} width={5} justifyContent="center">
                <Text color={on ? th.accent2 : th.muted} bold>{on ? " █ " : " ░ "}</Text>
              </Box>
              <Text color={on ? th.accent2 : th.muted} bold>{b}</Text>
              <Text color={th.good}>{on ? `+${2 ** idx}` : " "}</Text>
            </Clickable>
          );
        })}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>decimal <Text bold color={th.accent2}>{v.dec}</Text>   hex <Text bold color={th.accent2}>{v.hex}</Text>   binary <Text bold color={th.accent2}>{v.bin}</Text></Text>
        <Text>signed (two's complement) <Text bold color={v.signed < 0 ? th.warn : th.accent2}>{v.signed}</Text></Text>
        {s.overflow ? <Text color={th.warn} bold>⚠ overflow: wrapped around in {s.width} bits (this is the Year 2038 bug)</Text> : <Text> </Text>}
      </Box>
      <Box marginTop={1}>
        <Button id="b+" label="+1" th={th} onClick={() => setS(increment)} />
        <Button id="b-" label="−1" th={th} onClick={() => setS(decrement)} />
        <Button id="b<" label="≪" th={th} onClick={() => setS((p) => shiftLeft(p))} />
        <Button id="b>" label="≫" th={th} onClick={() => setS((p) => shiftRight(p))} />
        <Button id="bn" label="NOT" th={th} onClick={() => setS(invert)} />
        <Button id="b127" label="127" th={th} onClick={() => setS((p) => setValue(p, 127))} />
        <Button id="b255" label="255" th={th} onClick={() => setS((p) => setValue(p, 255))} />
        <Button id="bc" label="clear" th={th} onClick={() => setS((p) => setValue(p, 0))} />
      </Box>
      <Text color={th.muted} dimColor>keys: ←/→ select · space flip · + − · &lt; &gt; shift · n not · c clear · 0/1 set</Text>
    </Box>
  );
}

/* ------------------------------------------------------------------- gates */
export function GatesScreen({ th, focused }: { th: Theme; focused: boolean }) {
  const [g, setG] = useState<GateKind>("AND");
  const [a, setA] = useState<Bit>(1);
  const [b, setB] = useState<Bit>(0);
  const [adder, setAdder] = useState(false);
  const [cin, setCin] = useState<Bit>(0);
  useInput((input, key) => {
    if (!focused || isMouseInput(input)) return;
    const i = GATES.indexOf(g);
    if (key.rightArrow) setG(GATES[(i + 1) % GATES.length]);
    else if (key.leftArrow) setG(GATES[(i + GATES.length - 1) % GATES.length]);
    else if (input === "a") setA((x) => (x ^ 1) as Bit);
    else if (input === "b") setB((x) => (x ^ 1) as Bit);
    else if (input === "c") setCin((x) => (x ^ 1) as Bit);
    else if (input === "m") setAdder((x) => !x);
  });
  const out = evalGate(g, a, b);
  const add = fullAdder(a, b, cin);
  return (
    <Box flexDirection="column">
      <Box>
        <Button id="m-gate" label="Gates" th={th} active={!adder} onClick={() => setAdder(false)} />
        <Button id="m-add" label="Full adder" th={th} active={adder} onClick={() => setAdder(true)} />
      </Box>
      {!adder ? (
        <>
          <Box marginTop={1} flexWrap="wrap">
            {GATES.map((k) => <Button key={k} id={"g" + k} label={k} th={th} active={k === g} onClick={() => setG(k)} />)}
          </Box>
          <Text color={th.muted} wrap="wrap">{GATE_BLURB[g]}</Text>
          <Box marginTop={1}>
            <Box flexDirection="column" marginRight={4}>
              {gateArt(g, a, b).map((l, i) => <Text key={i} color={out ? th.accent2 : th.muted} bold={!!out}>{l}</Text>)}
            </Box>
            <Box flexDirection="column">
              {truthTableArt(g, a, isUnary(g) ? 0 : b).map((l, i) => <Text key={i} color={l.startsWith("▶") ? th.accent : th.text} bold={l.startsWith("▶")}>{l}</Text>)}
            </Box>
          </Box>
          <Box marginTop={1}>
            <Button id="tA" label={`A = ${a}`} th={th} active={!!a} onClick={() => setA((x) => (x ^ 1) as Bit)} />
            {!isUnary(g) && <Button id="tB" label={`B = ${b}`} th={th} active={!!b} onClick={() => setB((x) => (x ^ 1) as Bit)} />}
            <Text> → </Text><Text bold color={out ? th.accent2 : th.muted}>Y = {out}</Text>
          </Box>
        </>
      ) : (
        <>
          <Text color={th.muted} wrap="wrap">A full adder adds A + B + carry-in. Chain eight and you have an 8-bit adder, the heart of an ALU.</Text>
          <Box marginTop={1}>
            <Button id="tA" label={`A = ${a}`} th={th} active={!!a} onClick={() => setA((x) => (x ^ 1) as Bit)} />
            <Button id="tB" label={`B = ${b}`} th={th} active={!!b} onClick={() => setB((x) => (x ^ 1) as Bit)} />
            <Button id="tC" label={`Cin = ${cin}`} th={th} active={!!cin} onClick={() => setCin((x) => (x ^ 1) as Bit)} />
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text bold color={th.accent2}>{`   ┌─────────┐`}</Text>
            <Text bold color={th.accent2}>{`A ─┤         ├─ Sum   = ${add.sum}`}</Text>
            <Text bold color={th.accent2}>{`B ─┤  FULL   │`}</Text>
            <Text bold color={th.accent2}>{`Ci ┤  ADDER  ├─ Carry = ${add.carry}`}</Text>
            <Text bold color={th.accent2}>{`   └─────────┘`}</Text>
            <Text>{`${a} + ${b} + ${cin} = `}<Text bold color={th.accent}>{`${add.carry}${add.sum}`}</Text><Text color={th.muted}>{`  (${a + b + cin} in decimal)`}</Text></Text>
          </Box>
        </>
      )}
      <Text color={th.muted} dimColor>keys: ←/→ gate · a b c toggle inputs · m mode</Text>
    </Box>
  );
}

/* ------------------------------------------------------------------ subnet */
export function SubnetScreen({ th, focused }: { th: Theme; focused: boolean }) {
  const [text, setText] = useState("192.168.1.130/26");
  const [extra, setExtra] = useState(0);
  const p = parseCidr(text);
  const setPrefix = (n: number) => p && setText(`${fmtIPv4(p.ip)}/${Math.max(0, Math.min(32, n))}`);
  useInput((input, key) => {
    if (!focused || isMouseInput(input)) return;
    if (key.leftArrow) setPrefix((p?.prefix ?? 24) - 1);
    else if (key.rightArrow) setPrefix((p?.prefix ?? 24) + 1);
    else if (key.backspace || key.delete) setText((t) => t.slice(0, -1));
    else if (key.upArrow) setExtra((e) => Math.min(3, e + 1));
    else if (key.downArrow) setExtra((e) => Math.max(0, e - 1));
    else if (/^[0-9./]$/.test(input)) setText((t) => (t.length < 18 ? t + input : t));
    else if (input === "r") setText("");
  });
  const info = p ? subnetInfo(p.ip, p.prefix) : null;
  const kids = p && extra ? splitSubnet(`${fmtIPv4(p.ip)}/${p.prefix}`, extra) : [];
  return (
    <Box flexDirection="column">
      <Text color={th.muted}>Type an address/prefix. ←/→ move the network/host boundary. ↑/↓ split into subnets.</Text>
      <Box marginTop={1}>
        <Text color={th.accent2}>▸ </Text><Text bold color={p ? th.text : th.warn}>{text}</Text><Text color={th.accent}>▌</Text>
        <Box marginLeft={2}>
          <Button id="p-" label="− prefix" th={th} onClick={() => setPrefix((p?.prefix ?? 24) - 1)} />
          <Button id="p+" label="+ prefix" th={th} onClick={() => setPrefix((p?.prefix ?? 24) + 1)} />
        </Box>
      </Box>
      {info ? (
        <Box flexDirection="column" marginTop={1}>
          {subnetArt(info).map((l, i) => <Text key={i} color={i === 9 ? th.accent2 : i === 10 ? th.accent : th.text}>{l}</Text>)}
          <Box marginTop={0}>
            <Text color={th.muted}>split: </Text>
            {[0, 1, 2, 3].map((n) => <Button key={n} id={"s" + n} label={n ? `${2 ** n}` : "none"} th={th} active={extra === n} onClick={() => setExtra(n)} />)}
          </Box>
          {kids.map((k) => <Text key={k.network} color={th.text}>  {(k.network + "/" + k.prefix).padEnd(20)}<Text color={th.muted}>{k.firstHost} – {k.lastHost}</Text></Text>)}
        </Box>
      ) : <Text color={th.warn}>Enter an address like 10.0.0.0/8</Text>}
    </Box>
  );
}
