// A single-line text field: cursor movement and editing keys, shared by search, prompts and labs.

import type { InputEvent, KeyEvent } from "./input.ts";

export interface TextField { text: string; cur: number }

export const field = (text = ""): TextField => ({ text, cur: text.length });

/** Apply a key (or paste) to the field. Returns true when the text or cursor changed. */
export function editField(f: TextField, e: InputEvent): boolean {
  if (e.type === "paste") {
    const t = e.text.replace(/\r?\n/g, " ");
    f.text = f.text.slice(0, f.cur) + t + f.text.slice(f.cur);
    f.cur += t.length;
    return true;
  }
  if (e.type !== "key") return false;
  const k = e as KeyEvent;
  const before = f.text + "|" + f.cur;
  if (k.ctrl && !k.alt) {
    if (k.key === "a") f.cur = 0;
    else if (k.key === "e") f.cur = f.text.length;
    else if (k.key === "u") { f.text = f.text.slice(f.cur); f.cur = 0; }
    else if (k.key === "k") f.text = f.text.slice(0, f.cur);
    else if (k.key === "w") { const m = /\S*\s*$/.exec(f.text.slice(0, f.cur)); const n = m ? m[0].length : 0; f.text = f.text.slice(0, f.cur - n) + f.text.slice(f.cur); f.cur -= n; }
    else if (k.key === "b") f.cur = Math.max(0, f.cur - 1);
    else if (k.key === "f") f.cur = Math.min(f.text.length, f.cur + 1);
    else return false;
  } else if (k.key === "left") f.cur = Math.max(0, f.cur - 1);
  else if (k.key === "right") f.cur = Math.min(f.text.length, f.cur + 1);
  else if (k.key === "home") f.cur = 0;
  else if (k.key === "end") f.cur = f.text.length;
  else if (k.key === "backspace") { if (f.cur > 0) { f.text = f.text.slice(0, f.cur - 1) + f.text.slice(f.cur); f.cur--; } }
  else if (k.key === "delete") f.text = f.text.slice(0, f.cur) + f.text.slice(f.cur + 1);
  else if (k.text && !k.alt && !k.ctrl) { f.text = f.text.slice(0, f.cur) + k.text + f.text.slice(f.cur); f.cur += k.text.length; }
  else return false;
  return before !== f.text + "|" + f.cur;
}
