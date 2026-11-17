import { PHASES, SCENARIOS, layout, curlWriteOut, type Timing } from "@codex/widgets";
import { el, card, row, note, register, clear, range, choice } from "./dom";

register("netwaterfall", () => {
  const { root, body } = card("Request waterfall", "Every request passes through the same phases. The browser Network panel draws them as a waterfall; curl -w prints them as numbers. Drag a phase and see where the time goes.", "web");
  const t: Timing = { ...SCENARIOS[0][1] };
  const bars = el("div", { class: "lb-water" }), hint = note(""), curl = el("pre", { class: "lb-pre" }), sliders = el("div", { class: "lb-sliders" });
  const draw = () => {
    clear(bars);
    const l = layout(t);
    for (const b of l.bars) bars.append(el("div", { class: "lb-wrow" }, el("span", { class: "lb-nm", text: b.name }), el("span", { class: "lb-track" }, el("i", { class: b.key === l.biggest.key ? "lb-big" : "", style: `left:${b.startPct}%;width:${Math.max(b.ms ? 0.6 : 0, b.pct)}%` })), el("b", { class: "lb-mono", text: `${b.ms} ms` })));
    bars.append(el("div", { class: "lb-wrow tot" }, el("span", { class: "lb-nm", text: "Total" }), el("span", { class: "lb-track" }), el("b", { class: "lb-mono", text: `${l.total} ms` })));
    hint.textContent = l.hint; curl.textContent = "$ curl -s -o /dev/null -w '...' https://example.com/\n" + curlWriteOut(t);
  };
  const drawSliders = () => {
    clear(sliders);
    for (const [k, name, why] of PHASES) { const v = el("b", { class: "lb-mono", text: `${t[k]} ms` }); sliders.append(el("label", { class: "lb-slider", title: why }, el("span", { text: name }), range(0, k === "download" || k === "wait" ? 1500 : 200, t[k], (x) => { t[k] = x; v.textContent = `${x} ms`; draw(); }, name), v)); }
  };
  body.append(row(el("span", { class: "lb-lbl", text: "Scenario" }), choice<string>(SCENARIOS.map(([n], i) => [String(i), n] as [string, string]), "0", (v) => { Object.assign(t, SCENARIOS[+v][1]); drawSliders(); draw(); })), bars, hint, sliders, curl);
  drawSliders(); draw();
  return root;
});
