import React from "react";
import { Box, Text } from "ink";
import { Theme, gradient } from "./theme.js";
import { Clickable } from "./mouse.js";

export const LOGO = [
  " ██████╗ ██████╗ ██████╗ ███████╗██╗  ██╗",
  "██╔════╝██╔═══██╗██╔══██╗██╔════╝╚██╗██╔╝",
  "██║     ██║   ██║██║  ██║█████╗   ╚███╔╝ ",
  "██║     ██║   ██║██║  ██║██╔══╝   ██╔██╗ ",
  "╚██████╗╚██████╔╝██████╔╝███████╗██╔╝ ██╗",
  " ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝",
];

/** The logo with a colour wave travelling across it. `reveal` (0..1) shows rows progressively. */
export function Logo({ th, tick, reveal = 1 }: { th: Theme; tick: number; reveal?: number }) {
  const rows = Math.ceil(LOGO.length * reveal);
  return (
    <Box flexDirection="column">
      {LOGO.map((row, y) => {
        if (y >= rows) return <Text key={y}> </Text>;
        const runs: { c: string; t: string }[] = [];
        [...row].forEach((ch, x) => {
          const q = Math.round((x / row.length + y * 0.04 + tick * 0.025) * 24) / 24;
          const c = gradient(th.grad, q);
          const last = runs[runs.length - 1];
          if (last && last.c === c) last.t += ch; else runs.push({ c, t: ch });
        });
        return <Text key={y}>{runs.map((r, i) => <Text key={i} color={r.c}>{r.t}</Text>)}</Text>;
      })}
    </Box>
  );
}

export function Button({ id, label, onClick, th, active, width }: { id: string; label: string; onClick: () => void; th: Theme; active?: boolean; width?: number }) {
  return (
    <Clickable id={id} onClick={onClick} marginRight={1}>
      <Text color={active ? th.bg : th.accent2} backgroundColor={active ? th.accent : undefined} bold={active}>
        {" " + (width ? label.padEnd(width - 2) : label) + " "}
      </Text>
    </Clickable>
  );
}

export function Pane({ title, focused, th, children, width, height }: { title: string; focused: boolean; th: Theme; children: React.ReactNode; width?: number | string; height?: number }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={focused ? th.accent : th.muted} paddingX={1} width={width} height={height} flexGrow={width ? 0 : 1} flexShrink={width ? 0 : 1}>
      <Text color={focused ? th.accent2 : th.muted} bold>{title}</Text>
      {children}
    </Box>
  );
}
