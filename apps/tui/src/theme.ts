export interface Theme { name: string; bg: string; text: string; muted: string; accent: string; accent2: string; good: string; warn: string; panel: string; grad: [string, string, string] }
export const THEMES: Theme[] = [
  { name: "aurora", bg: "#0b0a14", text: "#ece9ff", muted: "#8a86ad", accent: "#8b7bff", accent2: "#36e1d0", good: "#46e3a3", warn: "#ffb454", panel: "#1a1733", grad: ["#8b7bff", "#36e1d0", "#ff7ac6"] },
  { name: "terminal", bg: "#050a06", text: "#c9f7d3", muted: "#5f9a6d", accent: "#3dff7a", accent2: "#b6ff4a", good: "#3dff7a", warn: "#ffd24a", panel: "#0b2412", grad: ["#1fbf5a", "#3dff7a", "#b6ff4a"] },
  { name: "ember", bg: "#120a08", text: "#ffe9dc", muted: "#b08a78", accent: "#ff7a45", accent2: "#ffc247", good: "#9be564", warn: "#ff4d6d", panel: "#2a1410", grad: ["#ff4d6d", "#ff7a45", "#ffc247"] },
];

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return "#" + f(r1, r2) + f(g1, g2) + f(b1, b2);
}
/** Sample a 3-stop gradient at t (wraps around). */
export function gradient(g: [string, string, string], t: number): string {
  t = ((t % 1) + 1) % 1;
  return t < 0.5 ? mix(g[0], g[1], t * 2) : mix(g[1], g[2], (t - 0.5) * 2);
}
