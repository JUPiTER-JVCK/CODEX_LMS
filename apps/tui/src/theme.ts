// Palettes (the same tokens as the web page's design) and colour-depth handling.

export type ThemeName = "dark" | "light";
export type ColorMode = "truecolor" | "256" | "16" | "none";

/** token -> "#rrggbb". Mirrors :root in src/style.css so the page, the Mac app and the terminal agree. */
const DARK: Record<string, string> = {
  bg: "#09090b", panel: "#111113", panel2: "#18181b", line: "#27272a", fg: "#ececee", mute: "#a1a1aa", dim: "#7c7c86",
  accent: "#8da2ff", accentInk: "#09090b", ok: "#5fbf8a", bad: "#ee7078", warn: "#e0b05f", codeBg: "#0c0c0e", codeFg: "#e4e4e7",
  shCmd: "#8fd1a8", shFlag: "#d6b37a", shStr: "#d99a73", shVar: "#86b3e6", shOp: "#d98aa8", shCom: "#7c7c86", shNum: "#b79ae6", shKw: "#d98aa8",
  ph: "#e8c776", phBg: "#2a2412",
  an1: "#7fb4d6", an2: "#d6b676", an3: "#86c9a0", an4: "#d596b0", an5: "#aa9be0", an6: "#d9a07a", an7: "#8da2ff", an8: "#b4c872",
  hover: "#1f1f24", sel: "#1d2340",
};
const LIGHT: Record<string, string> = {
  bg: "#fafafa", panel: "#ffffff", panel2: "#f4f4f5", line: "#e4e4e7", fg: "#18181b", mute: "#52525b", dim: "#6b6b74",
  accent: "#3a4fd7", accentInk: "#ffffff", ok: "#1a7f4b", bad: "#c2362f", warn: "#9a6200", codeBg: "#f1f1f3", codeFg: "#27272a",
  shCmd: "#1f7a4a", shFlag: "#8a5a00", shStr: "#a8481c", shVar: "#1d5fa8", shOp: "#a8285a", shCom: "#71717a", shNum: "#6a42b8", shKw: "#a8285a",
  ph: "#7a5200", phBg: "#fdf1cc",
  an1: "#1a6c9a", an2: "#8a5a00", an3: "#1f7a4a", an4: "#a8285a", an5: "#5b3fb5", an6: "#b04a14", an7: "#3a4fd7", an8: "#5c7a10",
  hover: "#ececef", sel: "#dfe3fb",
};

export const PALETTES: Record<ThemeName, Record<string, string>> = { dark: DARK, light: LIGHT };

export function hexToInt(hex: string): number {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
}

export class Theme {
  readonly name: ThemeName;
  private cache = new Map<string, number>();
  constructor(name: ThemeName) { this.name = name; }

  /** Resolve a token ("accent") or a literal ("#112233") to 0xRRGGBB. `undefined` means the terminal default (-1). */
  rgb(c: string | undefined): number {
    if (c === undefined) return -1;
    const hit = this.cache.get(c);
    if (hit !== undefined) return hit;
    const hex = c.startsWith("#") ? c : PALETTES[this.name][c];
    const v = hex ? hexToInt(hex) : -1;
    this.cache.set(c, v);
    return v;
  }
}

/** Mix two 0xRRGGBB colours; t=0 gives a, t=1 gives b. Used for the animated banner and soft highlights. */
export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// ---- colour depth ----

const ANSI16: number[] = [
  0x000000, 0xcd0000, 0x00cd00, 0xcdcd00, 0x0000ee, 0xcd00cd, 0x00cdcd, 0xe5e5e5,
  0x7f7f7f, 0xff0000, 0x00ff00, 0xffff00, 0x5c5cff, 0xff00ff, 0x00ffff, 0xffffff,
];
const CUBE = [0, 95, 135, 175, 215, 255];

function dist(r: number, g: number, b: number, c: number): number {
  const dr = r - ((c >> 16) & 255), dg = g - ((c >> 8) & 255), db = b - (c & 255);
  return dr * dr * 3 + dg * dg * 4 + db * db * 2; // weighted: the eye is most sensitive to green
}

/** Nearest xterm-256 palette index for an RGB colour. */
export function rgbTo256(rgb: number): number {
  const r = (rgb >> 16) & 255, g = (rgb >> 8) & 255, b = rgb & 255;
  const q = (v: number) => (v < 48 ? 0 : v < 115 ? 1 : Math.min(5, Math.floor((v - 35) / 40)));
  const ci = 16 + 36 * q(r) + 6 * q(g) + q(b);
  const cc = (CUBE[q(r)] << 16) | (CUBE[q(g)] << 8) | CUBE[q(b)];
  const avg = Math.round((r + g + b) / 3);
  const gi = Math.min(23, Math.max(0, Math.round((avg - 8) / 10)));
  const gv = 8 + gi * 10;
  const gc = (gv << 16) | (gv << 8) | gv;
  return dist(r, g, b, gc) < dist(r, g, b, cc) ? 232 + gi : ci;
}

export function rgbTo16(rgb: number): number {
  const r = (rgb >> 16) & 255, g = (rgb >> 8) & 255, b = rgb & 255;
  let best = 0, bd = Infinity;
  for (let i = 0; i < 16; i++) { const d = dist(r, g, b, ANSI16[i]); if (d < bd) { bd = d; best = i; } }
  return best;
}

/** SGR parameters (without the leading ESC[ or trailing m) selecting a colour. */
export function sgrColor(rgb: number, fg: boolean, mode: ColorMode): string {
  if (rgb < 0 || mode === "none") return fg ? "39" : "49";
  if (mode === "truecolor") return `${fg ? 38 : 48};2;${(rgb >> 16) & 255};${(rgb >> 8) & 255};${rgb & 255}`;
  if (mode === "256") return `${fg ? 38 : 48};5;${rgbTo256(rgb)}`;
  const i = rgbTo16(rgb);
  return String(i < 8 ? (fg ? 30 : 40) + i : (fg ? 90 : 100) + (i - 8));
}

/** Work out how many colours the terminal can show. */
export function detectColorMode(env: NodeJS.ProcessEnv = process.env, isTTY = true): ColorMode {
  if (env.NO_COLOR) return "none";
  if (!isTTY) return "none";
  const ct = (env.COLORTERM || "").toLowerCase();
  if (ct.includes("truecolor") || ct.includes("24bit")) return "truecolor";
  const prog = env.TERM_PROGRAM || "";
  if (["iTerm.app", "WezTerm", "ghostty", "vscode", "Hyper", "Tabby", "WarpTerminal"].includes(prog)) return "truecolor";
  if (env.WT_SESSION || env.KITTY_WINDOW_ID || env.ALACRITTY_LOG || env.VTE_VERSION) return "truecolor";
  const term = env.TERM || "";
  if (term === "dumb") return "none";
  if (term.includes("256color") || term.includes("xterm-direct")) return "256";
  if (term.startsWith("xterm") || term.startsWith("screen") || term.startsWith("tmux") || term.startsWith("rxvt")) return "256";
  return "16";
}
