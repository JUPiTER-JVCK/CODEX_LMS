import { avalanche } from "@codex/widgets";
import { el, card, btn, row, register, input, clear } from "./dom";

register("avalanche", () => {
  const { root, body } = card("Avalanche effect", "Change one character and about half of the 256 digest bits flip. That is why a hash works as a fingerprint: you cannot steer it by making small edits.", "net");
  let a = "hello", b = "hellp";
  const out = el("div");
  const draw = () => {
    clear(out);
    const r = avalanche(a, b);
    out.append(el("p", { class: "lb-mono lb-hex" }, el("span", { class: "lb-dim", text: "SHA-256(A) " }), r.hexA), el("p", { class: "lb-mono lb-hex" }, el("span", { class: "lb-dim", text: "SHA-256(B) " }), r.hexB),
      el("div", { class: "lb-bitmap", role: "img", "aria-label": `${r.diff} of 256 digest bits differ` }, ...r.changed.map((c) => el("i", { class: c ? "d" : "" }))),
      el("p", { class: "lb-note", text: `${r.diff} of 256 bits differ (${r.pct}%). ${r.diff === 0 ? "Identical input gives an identical digest." : "Unrelated digests differ in about 128 bits (50%)."}` }));
  };
  const ia = input(a, (v) => { a = v; draw(); }, { label: "input A", width: "11em" }), ib = input(b, (v) => { b = v; draw(); }, { label: "input B", width: "11em" });
  body.append(row(ia, ib, btn("Make equal", () => { b = a; ib.value = b; draw(); }), btn("Flip one bit of B", () => { b = a.slice(0, -1) + String.fromCharCode((a.charCodeAt(a.length - 1) || 65) ^ 1); ib.value = b; draw(); })), out);
  draw();
  return root;
});
