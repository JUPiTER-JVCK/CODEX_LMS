import { dissect, hexToBytes, SAMPLES, type Field } from "@codex/widgets";
import { el, card, row, register, clear, choice, live } from "./dom";

register("dissect", () => {
  const { root, body } = card("Take a packet apart", "A captured frame is just bytes. Click a field to see which bytes it covers, or click a byte to find its field. Colours show the layers: Ethernet, IP, then TCP or UDP.", "net");
  let key = "syn", sel = -1;
  const out = el("div");
  const draw = live(out, () => {
    clear(out);
    const bytes = hexToBytes(SAMPLES[key].hex), { fields, error } = dissect(bytes);
    const fieldAt = (i: number) => fields.findIndex((f) => i >= f.start && i < f.start + f.len);
    const cls = (f: Field) => f.layer.toLowerCase();
    const hex = el("div", { class: "lb-hexdump lb-mono" });
    for (let off = 0; off < bytes.length; off += 16) {
      const line = el("div", { class: "lb-hline" }, el("span", { class: "off", text: off.toString(16).padStart(4, "0") }));
      for (let i = off; i < Math.min(off + 16, bytes.length); i++) {
        const fi = fieldAt(i);
        line.append(el("span", { class: "lb-byte " + (fi >= 0 ? cls(fields[fi]) : "") + (fi === sel ? " sel" : ""), role: "button", tabindex: -1, on: { click: () => { sel = fi; draw(); } } }, bytes[i].toString(16).padStart(2, "0")));
      }
      hex.append(line);
    }
    const tbl = el("div", { class: "tw" }, el("table", { class: "lb-fields" }, el("tbody", {}, ...fields.map((f, i) => el("tr", { class: cls(f) + (i === sel ? " hit" : ""), tabindex: 0, role: "button", "aria-label": `${f.name}: ${f.value}`,
      on: { click: () => { sel = i; draw(); }, keydown: (e: Event) => { if ((e as KeyboardEvent).key === "Enter") { sel = i; draw(); } } } },
      el("td", { class: "ly", text: f.layer }), el("td", { text: f.name }), el("td", { class: "lb-mono", text: f.value }), el("td", { class: "lb-dim", text: f.note }))))));
    out.append(el("div", { class: "lb-split wide" }, hex, tbl), error ? el("p", { class: "lb-note warn", text: error }) : "",
      sel >= 0 ? el("p", { class: "lb-note", text: `${fields[sel].name}: bytes ${fields[sel].start}–${fields[sel].start + fields[sel].len - 1} (${fields[sel].len} byte${fields[sel].len > 1 ? "s" : ""}) = ${fields[sel].value}. ${fields[sel].note}.` }) : "");
  });
  body.append(row(choice<string>(Object.entries(SAMPLES).map(([k, v]) => [k, v.label] as [string, string]), key, (v) => { key = v; sel = -1; draw(); })), out);
  draw();
  return root;
});
