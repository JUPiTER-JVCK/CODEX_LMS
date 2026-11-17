import { utf8Breakdown, utf8Summary, utf8Template } from "@codex/widgets";
import { el, card, btn, row, register, input, clear } from "./dom";

register("utf8", () => {
  const { root, body } = card("Text to bytes", "Type anything. Each character has a code point, and UTF-8 stores each code point in one to four bytes. Try é, €, 漢 and 🎼.");
  let text = "café €";
  const out = el("div");
  const draw = () => {
    clear(out);
    const parts = utf8Breakdown(text), sum = utf8Summary(text);
    out.append(el("div", { class: "lb-utf" }, ...parts.slice(0, 24).map((p) => el("div", { class: "lb-utfcard k" + p.bytes.length },
      el("span", { class: "lb-u-ch", text: p.ch === " " ? "␣" : p.ch }), el("span", { class: "lb-mono lb-u-cp", text: p.cpHex }),
      el("span", { class: "lb-mono lb-u-by", text: p.bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ") }),
      el("span", { class: "lb-mono lb-u-bn", text: p.bin.join(" ") }), el("span", { class: "lb-mono lb-u-tpl", text: utf8Template(p.bytes.length) })))),
      el("p", { class: "lb-note", text: `${sum.chars} characters, ${sum.bytes} bytes. ${sum.bytes > sum.chars ? "More bytes than characters: len(text) and len(text.encode()) differ." : "All ASCII: one byte per character."}${parts.length > 24 ? " (first 24 shown)" : ""}` }));
  };
  const field = input(text, (v) => { text = v; draw(); }, { label: "text to encode", width: "14em" });
  body.append(row(field, ...["café", "A€", "漢字", "🎼 music"].map((p) => btn(p, () => { text = p; field.value = p; draw(); }))), out);
  draw();
  return root;
});
