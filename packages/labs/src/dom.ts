/** Tiny DOM helpers shared by the labs. The book's own helpers live on window.__core; these avoid depending on their exact shape. */
export type Kid = Node | string | number | null | false | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any>;

export function el<T extends keyof HTMLElementTagNameMap>(tag: T, props: Props = {}, ...kids: Kid[]): HTMLElementTagNameMap[T] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    // ARIA booleans are the strings "true" / "false"; an empty or missing attribute means something else to a screen reader
    if (k.startsWith("aria-") && typeof v === "boolean") { e.setAttribute(k, String(v)); continue; }
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "on") for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn as EventListener);
    else if (k === "value" || k === "checked" || k === "disabled" || k === "min" || k === "max" || k === "step") (e as unknown as Props)[k] = v;
    else e.setAttribute(k, v === true ? "" : String(v));
  }
  append(e, kids);
  return e;
}
export function append(parent: Element, kids: Kid[]) {
  for (const k of kids) if (k !== null && k !== false && k !== undefined) parent.append(k instanceof Node ? k : document.createTextNode(String(k)));
}
export function svg(tag: string, attrs: Record<string, string | number> = {}, ...kids: (SVGElement | string)[]): SVGElement {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  for (const k of kids) e.append(k);
  return e;
}
export const clear = (e: Element) => e.replaceChildren();

/** Index path from `root` down to `node`, so the same position can be found again after a re-render. */
function pathOf(root: Element, node: Element): number[] {
  const path: number[] = [];
  for (let n: Element | null = node; n && n !== root; n = n.parentElement) path.unshift(Array.prototype.indexOf.call(n.parentElement!.children, n));
  return path;
}
function resolve(root: Element, path: number[]): Element | null {
  let n: Element | null = root;
  for (const i of path) n = n?.children[i] ?? null;
  return n;
}
/**
 * Wrap a render function that rebuilds controls. If a control inside `container` has keyboard focus, focus moves to the
 * control in the same position afterwards, so pressing Space or Enter on a button does not throw the user back to the top of the page.
 */
export function live(container: Element, render: () => void): () => void {
  return () => {
    const a = document.activeElement;
    const path = a && a !== container && container.contains(a) ? pathOf(container, a) : null;
    render();
    const t = path && resolve(container, path);
    if (t instanceof HTMLElement) t.focus({ preventScroll: true });
  };
}

/** The standard widget card: same chrome as the book's own widgets (.wg). */
export function card(title: string, sub: string, extra = ""): { root: HTMLElement; body: HTMLElement } {
  const body = el("div", { class: "lb" });
  const root = el("div", { class: "wg lb-card " + extra }, el("h4", { text: title }), sub ? el("p", { class: "sub", text: sub }) : null, body);
  return { root, body };
}
export const row = (...kids: Kid[]) => el("div", { class: "lb-row" }, ...kids);
export function btn(label: string, fn: () => void, opts: { on?: boolean; title?: string } = {}): HTMLButtonElement {
  return el("button", { type: "button", class: "lb-btn" + (opts.on ? " on" : ""), title: opts.title, on: { click: fn } }, label);
}
/** A row of mutually exclusive buttons; calls onPick and keeps the highlight in sync. */
export function choice<T extends string>(items: [T, string][], value: T, onPick: (v: T) => void): HTMLElement {
  const wrap = el("div", { class: "lb-row", role: "group" });
  const paint = (cur: T) => { clear(wrap); for (const [v, label] of items) append(wrap, [btn(label, () => { onPick(v); show(v); }, { on: v === cur })]); };
  const show = (cur: T) => live(wrap, () => paint(cur))();
  paint(value);
  return wrap;
}
export function input(value: string, onInput: (v: string) => void, opts: { cls?: string; label: string; ph?: string; width?: string } = { label: "" }): HTMLInputElement {
  return el("input", { type: "text", class: "lb-in " + (opts.cls ?? ""), value, spellcheck: "false", autocomplete: "off", "aria-label": opts.label, placeholder: opts.ph, style: opts.width ? `width:${opts.width}` : undefined, on: { input: (e: Event) => onInput((e.target as HTMLInputElement).value) } });
}
export function range(min: number, max: number, value: number, onInput: (v: number) => void, label: string, step = 1): HTMLInputElement {
  return el("input", { type: "range", class: "lb-range", min, max, step, value, "aria-label": label, on: { input: (e: Event) => onInput(+(e.target as HTMLInputElement).value) } });
}
export function stat(label: string, value: string, warn = false): { root: HTMLElement; set: (v: string, warn?: boolean) => void } {
  const v = el("b", { text: value });
  const root = el("div", { class: "lb-stat" + (warn ? " warn" : "") }, el("span", { text: label }), v);
  return { root, set: (t, w = false) => { v.textContent = t; root.classList.toggle("warn", w); } };
}
export const note = (text: string, cls = "") => el("p", { class: "lb-note " + cls, text });
export const mono = (text: string, cls = "") => el("span", { class: "lb-mono " + cls, text });
export const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export function register(name: string, make: (args: Record<string, unknown>) => HTMLElement) {
  const w = window as unknown as { __widgets?: Record<string, unknown> };
  (w.__widgets = w.__widgets || {})[name] = (args: Record<string, unknown>) => make(args || {});
}
export const copy = (text: string, b?: HTMLElement) => {
  const k = (window as unknown as { __core?: { copyText?: (t: string, b?: HTMLElement) => void } }).__core;
  if (k?.copyText) k.copyText(text, b as HTMLElement); else void navigator.clipboard?.writeText(text);
};
