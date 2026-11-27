// A single-line text field: cursor movement and editing keys, shared by search, prompts and labs.

import type { InputEvent, KeyEvent } from "./input.ts";

export interface TextField { text: string; cur: number }

export const field = (text = ""): TextField => ({ text, cur: text.length });

/** Length (in UTF-16 units) of the character just before / at `i`, so an emoji is one step and not two. */
const before = (t: string, i: number) => (i >= 2 && /[\udc00-\udfff]/.test(t[i - 1]) && /[\ud800-\udbff]/.test(t[i - 2]) ? 2 : 1);
const after = (t: string, i: number) => (/[\ud800-\udbff]/.test(t[i] ?? "") && /[\udc00-\udfff]/.test(t[i + 1] ?? "") ? 2 : 1);

/**
 * Apply a key (or paste) to the field.
 * `handled` is true for every key a text field owns, even one that changes nothing (End at the end of the text,
 * Left at the start), so the page never reacts to it; `changed` is true when the text or cursor moved.
 */
export function editFieldEx(f: TextField, e: InputEvent): { handled: boolean; changed: boolean } {
  const was = f.text + "|" + f.cur;
  const done = (handled: boolean) => ({ handled, changed: handled && was !== f.text + "|" + f.cur });
  if (e.type === "paste") {
    const t = e.text.replace(/\r?\n/g, " ");
    f.text = f.text.slice(0, f.cur) + t + f.text.slice(f.cur);
    f.cur += t.length;
    return done(true);
  }
  if (e.type !== "key") return done(false);
  const k = e as KeyEvent;
  if (k.ctrl && !k.alt) {
    if (k.key === "a") f.cur = 0;
    else if (k.key === "e") f.cur = f.text.length;
    else if (k.key === "u") { f.text = f.text.slice(f.cur); f.cur = 0; }
    else if (k.key === "k") f.text = f.text.slice(0, f.cur);
    else if (k.key === "w") { const m = /\S*\s*$/.exec(f.text.slice(0, f.cur)); const n = m ? m[0].length : 0; f.text = f.text.slice(0, f.cur - n) + f.text.slice(f.cur); f.cur -= n; }
    else if (k.key === "b") f.cur = Math.max(0, f.cur - before(f.text, f.cur));
    else if (k.key === "f") f.cur = Math.min(f.text.length, f.cur + after(f.text, f.cur));
    else return done(false);
  } else if (k.key === "left") f.cur = Math.max(0, f.cur - before(f.text, f.cur));
  else if (k.key === "right") f.cur = Math.min(f.text.length, f.cur + after(f.text, f.cur));
  else if (k.key === "home") f.cur = 0;
  else if (k.key === "end") f.cur = f.text.length;
  else if (k.key === "backspace") { if (f.cur > 0) { const n = before(f.text, f.cur); f.text = f.text.slice(0, f.cur - n) + f.text.slice(f.cur); f.cur -= n; } }
  else if (k.key === "delete") f.text = f.text.slice(0, f.cur) + f.text.slice(f.cur + after(f.text, f.cur));
  else if (k.text && !k.alt && !k.ctrl) { f.text = f.text.slice(0, f.cur) + k.text + f.text.slice(f.cur); f.cur += k.text.length; }
  else return done(false);
  return done(true);
}

/** Apply a key (or paste) to the field. Returns true when the text or cursor changed. */
export function editField(f: TextField, e: InputEvent): boolean { return editFieldEx(f, e).changed; }
