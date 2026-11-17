import { TIERS, scaled } from "@codex/widgets";
import { el, card, row, register, clear, choice } from "./dom";

register("latencyladder", () => {
  const { root, body } = card("The latency ladder", "Computers are so fast that the gaps between memory, disk and network are hard to feel. Stretch time until one nanosecond lasts a whole second and the gaps become obvious.");
  let per = 1;
  const out = el("div");
  const draw = () => {
    clear(out);
    const max = Math.log10(TIERS[TIERS.length - 1].ns / TIERS[0].ns);
    out.append(el("div", { class: "lb-ladder" }, ...TIERS.map((t) => el("div", { class: "lb-lrow" },
      el("span", { class: "lb-nm", text: t.name }), el("span", { class: "lb-bar" }, el("i", { style: `width:${Math.max(2, (Math.log10(t.ns / TIERS[0].ns) / max) * 100)}%` })),
      el("span", { class: "lb-mono lb-hu", text: scaled(t.ns, per) }), el("span", { class: "lb-dim lb-ns", text: `${t.ns < 1 ? t.ns : t.ns.toLocaleString("en-US")} ns · ${t.note}` })))),
      el("p", { class: "lb-note", text: "Bars use a logarithmic scale, so each step to the right is a factor of ten. If one CPU cycle felt like a second, a trip to another continent would take years." }));
  };
  body.append(row(el("span", { class: "lb-lbl", text: "1 nanosecond lasts" }), choice<string>([["1", "1 second"], ["60", "1 minute"], ["3600", "1 hour"]], "1", (v) => { per = +v; draw(); })), out);
  draw();
  return root;
});
