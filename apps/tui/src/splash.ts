// The animated title: block letters that sweep in with a travelling colour gradient.

import { hexToInt, mix, PALETTES } from "./theme.ts";
import { type Painter, rect } from "./ui.ts";

const GLYPHS: Record<string, string[]> = {
  C: [" ████", "█    ", "█    ", "█    ", " ████"],
  O: [" ███ ", "█   █", "█   █", "█   █", " ███ "],
  D: ["████ ", "█   █", "█   █", "█   █", "████ "],
  E: ["█████", "█    ", "████ ", "█    ", "█████"],
  X: ["█   █", " █ █ ", "  █  ", " █ █ ", "█   █"],
  _: ["     ", "     ", "     ", "     ", "█████"],
  L: ["█    ", "█    ", "█    ", "█    ", "█████"],
  M: ["█   █", "██ ██", "█ █ █", "█   █", "█   █"],
  S: [" ████", "█    ", " ███ ", "    █", "████ "],
};

const WORD = "CODEX_LMS";
export const LOGO_ROWS = 5;
export const LOGO_COLS = WORD.length * 5 + (WORD.length - 1);
export const SPLASH_MS = 1500;

export function logoLines(): string[] {
  const rows: string[] = [];
  for (let r = 0; r < LOGO_ROWS; r++) rows.push(WORD.split("").map((ch) => GLYPHS[ch][r]).join(" "));
  return rows;
}

/** Piecewise gradient through three palette colours; `t` wraps around. */
function gradient(stops: number[], t: number): number {
  t = ((t % 1) + 1) % 1;
  const seg = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(seg));
  return mix(stops[i], stops[i + 1], seg - i);
}

/** Paint the title screen `ms` milliseconds after it started. */
export function drawSplash(p: Painter, ms: number, subtitle: string) {
  const { w, h } = p.scr;
  const pal = PALETTES[p.theme.name];
  const stops = [hexToInt(pal.an1), hexToInt(pal.an5), hexToInt(pal.an4), hexToInt(pal.an1)];
  p.fill(rect(0, 0, w, h), "bg");
  const rows = logoLines();
  const narrow = w < LOGO_COLS + 4;
  const x0 = Math.floor((w - (narrow ? 9 : LOGO_COLS)) / 2);
  const y0 = Math.floor((h - (narrow ? 3 : LOGO_ROWS + 4)) / 2);
  const reveal = Math.min(1, ms / 650);
  if (narrow) {
    p.text(x0, y0, "CODEX_LMS", { fg: "accent", b: true });
  } else {
    const shown = Math.floor(reveal * (LOGO_COLS + 4));
    for (let r = 0; r < LOGO_ROWS; r++) {
      for (let c = 0; c < LOGO_COLS; c++) {
        const ch = rows[r][c];
        if (ch === " " || c > shown) continue;
        const edge = shown - c < 3; // a bright leading edge while it sweeps in
        let rgb = gradient(stops, c / LOGO_COLS - ms / 1800 + r * 0.03);
        if (edge && reveal < 1) rgb = mix(rgb, 0xffffff, 0.55);
        const hex = "#" + rgb.toString(16).padStart(6, "0");
        p.text(x0 + c, y0 + r, ch, { fg: hex, b: true });
      }
    }
  }
  const sy = y0 + (narrow ? 2 : LOGO_ROWS + 1);
  const typed = Math.max(0, Math.min(subtitle.length, Math.floor((ms - 500) / 18)));
  const sx = Math.floor((w - subtitle.length) / 2);
  p.text(sx, sy, subtitle.slice(0, typed), { fg: "mute" });
  if (ms > 1000) p.text(Math.floor((w - 22) / 2), sy + 2, "press any key to begin", { fg: "dim" });
}
