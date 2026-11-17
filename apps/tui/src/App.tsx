import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { THEMES, gradient } from "./theme.js";
import { outline, ChapterMeta } from "./reader.js";
import { Logo, Pane } from "./ui.js";
import { Clickable, MouseProvider, isMouseInput, useWheel } from "./mouse.js";
import { Reader, BitsScreen, GatesScreen, SubnetScreen } from "./screens.js";

type Item = { kind: "header"; label: string } | { kind: "home" } | { kind: "widget"; id: "bits" | "gates" | "subnet"; label: string } | { kind: "chapter"; meta: ChapterMeta };
const SIDEBAR_W = 32;

function buildItems(): Item[] {
  const items: Item[] = [{ kind: "home" }, { kind: "header", label: "WIDGETS" },
    { kind: "widget", id: "bits", label: "Binary counter" }, { kind: "widget", id: "gates", label: "Logic gate lab" }, { kind: "widget", id: "subnet", label: "Subnet calculator" }];
  for (const [pid, name] of outline.parts) {
    const cs = outline.chapters.filter((c) => c.part === pid);
    if (!cs.length) continue;
    items.push({ kind: "header", label: name.toUpperCase() }, ...cs.map((meta) => ({ kind: "chapter" as const, meta })));
  }
  return items;
}

const useTerminalSize = () => {
  const { stdout } = useStdout();
  const [size, setSize] = useState({ w: stdout.columns || 100, h: stdout.rows || 30 });
  useEffect(() => {
    const on = () => setSize({ w: stdout.columns || 100, h: stdout.rows || 30 });
    stdout.on("resize", on);
    return () => { stdout.off("resize", on); };
  }, [stdout]);
  return size;
};

export function App() {
  return <MouseProvider><Main /></MouseProvider>;
}

function Main() {
  const { exit } = useApp();
  const { w, h } = useTerminalSize();
  const [themeIx, setThemeIx] = useState(0);
  const th = THEMES[themeIx];
  const [phase, setPhase] = useState<"splash" | "main">("splash");
  const [tick, setTick] = useState(0);
  const items = useMemo(buildItems, []);
  const [sel, setSel] = useState(0);
  const [focus, setFocus] = useState<"nav" | "content">("nav");
  const [offset, setOffset] = useState(0);

  const bodyH = h - 3; // header + footer + spare line so Ink never fills the whole screen
  const navRows = bodyH - 3;

  // animation clock only runs where something animates
  useEffect(() => {
    if (phase === "main" && items[sel].kind !== "home") return;
    const t = setInterval(() => setTick((x) => x + 1), 90);
    return () => clearInterval(t);
  }, [phase, sel, items]);
  useEffect(() => {
    if (phase !== "splash") return;
    const t = setTimeout(() => setPhase("main"), 1700);
    return () => clearTimeout(t);
  }, [phase]);

  const selectable = (i: number) => items[i].kind !== "header";
  const move = (d: 1 | -1) => setSel((s) => { let i = s + d; while (i >= 0 && i < items.length && !selectable(i)) i += d; return i < 0 || i >= items.length ? s : i; });
  useEffect(() => {
    setOffset((o) => (sel < o + 1 ? Math.max(0, sel - 1) : sel >= o + navRows ? sel - navRows + 1 : o));
  }, [sel, navRows]);

  useInput((input, key) => {
    if (isMouseInput(input)) return;
    if (phase === "splash") { setPhase("main"); return; }
    if (input === "q" && focus === "nav") exit();
    else if (key.ctrl && input === "c") exit();
    else if (input === "t") setThemeIx((i) => (i + 1) % THEMES.length);
    else if (key.tab) setFocus((f) => (f === "nav" ? "content" : "nav"));
    else if (key.escape) setFocus("nav");
    else if (focus === "nav") {
      if (key.downArrow || input === "j") move(1);
      else if (key.upArrow || input === "k") move(-1);
      else if (key.return || key.rightArrow) setFocus("content");
    }
  });
  useWheel((d, c) => { if (c <= SIDEBAR_W) setOffset((o) => Math.max(0, Math.min(items.length - navRows, o + d * 3))); });

  const open = (i: number) => { if (selectable(i)) { setSel(i); setFocus("content"); } };
  const cur = items[sel];
  const contentW = w - SIDEBAR_W - 5;

  if (phase === "splash") {
    const reveal = Math.min(1, tick / 10);
    const bar = Math.min(30, Math.round((tick / 18) * 30));
    return (
      <Box flexDirection="column" height={h - 1} alignItems="center" justifyContent="center">
        <Logo th={th} tick={tick} reveal={reveal} />
        <Box marginTop={1}><Text color={th.muted}>computing, from first principles</Text></Box>
        <Box marginTop={1}>
          <Text color={th.accent}>{"━".repeat(bar)}</Text><Text color={th.muted}>{"─".repeat(30 - bar)}</Text>
        </Box>
        <Text color={th.muted} dimColor>press any key</Text>
      </Box>
    );
  }

  const visible = items.slice(offset, offset + navRows);
  return (
    <Box flexDirection="column" height={h - 1} width={w}>
      <Box justifyContent="space-between" paddingX={1}>
        <Text bold>{[..."◆ CODEX"].map((ch, i) => <Text key={i} color={gradient(th.grad, i / 7 + tick * 0.02)}>{ch}</Text>)}</Text>
        <Clickable id="theme" onClick={() => setThemeIx((i) => (i + 1) % THEMES.length)}><Text color={th.muted}>theme: <Text color={th.accent2}>{th.name}</Text> (t)</Text></Clickable>
      </Box>
      <Box height={bodyH}>
        <Pane title="Contents" focused={focus === "nav"} th={th} width={SIDEBAR_W} height={bodyH}>
          {visible.map((it, k) => {
            const i = offset + k;
            if (it.kind === "header") return <Text key={i} color={th.accent} bold dimColor>{it.label}</Text>;
            const active = i === sel;
            const label = it.kind === "home" ? "⌂ Home" : it.kind === "widget" ? "✦ " + it.label : "  " + it.meta.title;
            return (
              <Clickable key={i} id={"nav" + i} onClick={() => open(i)}>
                <Text wrap="truncate-end" color={active ? th.bg : th.text} backgroundColor={active ? th.accent : undefined} bold={active}>
                  {(active ? "▸" : " ") + label}
                </Text>
              </Clickable>
            );
          })}
        </Pane>
        <Pane
          title={cur.kind === "chapter" ? cur.meta.title : cur.kind === "widget" ? cur.label : "Welcome"}
          focused={focus === "content"} th={th} height={bodyH}>
          <Clickable id="content-focus" onClick={() => setFocus("content")} flexDirection="column">
            {cur.kind === "home" && <Home th={th} tick={tick} />}
            {cur.kind === "widget" && cur.id === "bits" && <BitsScreen th={th} focused={focus === "content"} />}
            {cur.kind === "widget" && cur.id === "gates" && <GatesScreen th={th} focused={focus === "content"} />}
            {cur.kind === "widget" && cur.id === "subnet" && <SubnetScreen th={th} focused={focus === "content"} />}
            {cur.kind === "chapter" && <Reader meta={cur.meta} th={th} focused={focus === "content"} width={contentW} height={bodyH - 3} />}
          </Clickable>
        </Pane>
      </Box>
      <Box paddingX={1}>
        <Text color={th.muted}>↑↓ move · ↵/→ open · tab switch pane · esc back · t theme · q quit · mouse: click &amp; scroll</Text>
      </Box>
    </Box>
  );
}

function Home({ th, tick }: { th: (typeof THEMES)[number]; tick: number }) {
  const total = outline.chapters.length;
  const cmds = outline.chapters.reduce((a, c) => a + c.commands, 0);
  const ex = outline.chapters.reduce((a, c) => a + c.exercises, 0);
  return (
    <Box flexDirection="column" marginTop={1}>
      <Logo th={th} tick={tick} />
      <Box marginTop={1} flexDirection="column">
        <Text>Learn by <Text bold color={th.accent2}>poking things</Text>: the macOS terminal, networks, Python, the web, servers and crypto.</Text>
        <Box marginTop={1}>
          <Text color={th.accent} bold>{total}</Text><Text color={th.muted}> chapters   </Text>
          <Text color={th.accent} bold>{cmds}</Text><Text color={th.muted}> command cards   </Text>
          <Text color={th.accent} bold>{ex}</Text><Text color={th.muted}> exercises   </Text>
          <Text color={th.accent} bold>3</Text><Text color={th.muted}> live widgets</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={th.muted}>Try the <Text color={th.accent2}>✦ widgets</Text> in the sidebar, or open a chapter and read it here.</Text>
          <Text color={th.muted}>Everything is clickable, and the same logic powers the desktop app.</Text>
        </Box>
      </Box>
    </Box>
  );
}
