import { GATES, GATE_BLURB, evalGate, isUnary, truthTable, fullAdder, rippleAdd, type GateKind, type Bit } from "@codex/widgets";
import { el, svg, card, btn, row, note, register, clear, range, live } from "./dom";

const BODY: Record<GateKind, { d: string; end: number }> = {
  AND: { d: "M0,0 H26 A26,26 0 0 1 26,52 H0 Z", end: 52 }, NAND: { d: "M0,0 H26 A26,26 0 0 1 26,52 H0 Z", end: 52 },
  OR: { d: "M0,0 Q30,0 58,26 Q30,52 0,52 Q14,26 0,0 Z", end: 58 }, NOR: { d: "M0,0 Q30,0 58,26 Q30,52 0,52 Q14,26 0,0 Z", end: 58 },
  XOR: { d: "M0,0 Q30,0 58,26 Q30,52 0,52 Q14,26 0,0 Z", end: 58 }, XNOR: { d: "M0,0 Q30,0 58,26 Q30,52 0,52 Q14,26 0,0 Z", end: 58 },
  NOT: { d: "M0,0 L48,26 L0,52 Z", end: 48 }, BUFFER: { d: "M0,0 L48,26 L0,52 Z", end: 48 },
};
const BUBBLE = new Set<GateKind>(["NAND", "NOR", "XNOR", "NOT"]);

function circuit(g: GateKind, a: Bit, b: Bit, out: Bit): SVGElement {
  const un = isUnary(g), x0 = 120, outStart = x0 + BODY[g].end + (BUBBLE.has(g) ? 10 : 0);
  const wire = (d: string, on: boolean) => svg("path", { d, fill: "none", "stroke-width": 3, "stroke-linecap": "round", stroke: on ? "var(--fg)" : "var(--line)" });
  const gate = svg("g", { transform: `translate(${x0},29)` },
    svg("path", { d: BODY[g].d, fill: "var(--panel2)", stroke: "var(--fg)", "stroke-width": 2.5, "stroke-linejoin": "round" }));
  if (g === "XOR" || g === "XNOR") gate.append(svg("path", { d: "M-9,0 Q5,26 -9,52", fill: "none", stroke: "var(--fg)", "stroke-width": 2.5 }));
  if (BUBBLE.has(g)) gate.append(svg("circle", { cx: BODY[g].end + 5, cy: 26, r: 5, fill: "var(--panel2)", stroke: "var(--fg)", "stroke-width": 2.5 }));
  const t = (x: number, y: number, s: string, fill = "var(--mute)", anchor = "start") => { const e = svg("text", { x, y, fill, "text-anchor": anchor, "font-size": 13, "font-family": "var(--font-mono)", "font-weight": 600 }); e.textContent = s; return e; };
  const root = svg("svg", { viewBox: "0 0 360 110", class: "lb-circuit", role: "img", "aria-label": `${g} gate, inputs ${un ? a : `${a} and ${b}`}, output ${out}` },
    wire(un ? `M30,55 H${x0}` : `M30,35 H80 V43 H${x0}`, !!a), un ? "" : wire(`M30,75 H80 V67 H${x0}`, !!b), gate, wire(`M${outStart},55 H300`, !!out),
    svg("circle", { cx: 322, cy: 55, r: 15, fill: out ? "var(--fg)" : "none", stroke: out ? "var(--fg)" : "var(--line)", "stroke-width": 3 }),
    t(322, 60, String(out), out ? "var(--bg)" : "var(--fg)", "middle"), t(12, un ? 59 : 39, "A"), un ? "" : t(12, 79, "B"));
  return root;
}

register("gates", () => {
  const { root, body } = card("Logic gates and adders", "Gates are the atoms of a CPU. Pick one, flip the inputs, and see which truth-table row applies. The Adders tab builds binary addition out of them.");
  let g: GateKind = "XOR", a: Bit = 1, b: Bit = 0, cin: Bit = 0, mode: "gate" | "adder" = "gate", x = 11, y = 6;
  const tabs = el("div", { class: "lb-seg", role: "tablist" });
  const view = el("div");
  const flip = (v: Bit): Bit => (v ^ 1) as Bit;
  const bitBtn = (label: string, get: () => Bit, set: () => void) => el("button", { type: "button", class: "lb-bit sm" + (get() ? " on" : ""), "aria-pressed": !!get(), "aria-label": label, on: { click: set } }, String(get()));
  function drawTabs() {
    clear(tabs);
    tabs.append(btn("Gates", () => { mode = "gate"; draw(); }, { on: mode === "gate" }), btn("Adders", () => { mode = "adder"; draw(); }, { on: mode === "adder" }));
  }
  const holder = el("div", {}, tabs, view);
  const draw = live(holder, render);
  function render() {
    drawTabs(); clear(view);
    if (mode === "gate") {
      const un = isUnary(g), out = evalGate(g, a, b);
      const table = el("table", { class: "lb-truth" }, el("thead", {}, el("tr", {}, el("th", { text: "A" }), un ? "" : el("th", { text: "B" }), el("th", { text: "Y" }))),
        el("tbody", {}, ...truthTable(g).map((r) => el("tr", { class: r.a === a && (un || r.b === b) ? "hit" : "" }, el("td", { text: String(r.a) }), un ? "" : el("td", { text: String(r.b) }), el("td", { text: String(r.out) })))));
      view.append(
        row(...GATES.map((k) => btn(k, () => { g = k; draw(); }, { on: k === g }))), note(GATE_BLURB[g]),
        el("div", { class: "lb-split" }, el("div", {}, circuit(g, a, b, out),
          row(el("span", { class: "lb-lbl", text: "A" }), bitBtn("input A", () => a, () => { a = flip(a); draw(); }), un ? "" : el("span", { class: "lb-lbl", text: "B" }), un ? "" : bitBtn("input B", () => b, () => { b = flip(b); draw(); }))), table));
    } else {
      const f = fullAdder(a, b, cin), rip = rippleAdd(x, y, 4);
      view.append(note("A full adder adds three bits (A, B and a carry in) using two XORs, two ANDs and an OR. Chain four and you can add 4-bit numbers: the heart of a CPU's ALU."),
        row(el("span", { class: "lb-lbl", text: "A" }), bitBtn("A", () => a, () => { a = flip(a); draw(); }), el("span", { class: "lb-lbl", text: "B" }), bitBtn("B", () => b, () => { b = flip(b); draw(); }),
          el("span", { class: "lb-lbl", text: "carry in" }), bitBtn("carry in", () => cin, () => { cin = flip(cin); draw(); }),
          el("span", { class: "lb-mono", text: `${a} + ${b} + ${cin} = ${f.carry}${f.sum}   (sum ${f.sum}, carry out ${f.carry})` })),
        el("h5", { class: "lb-sub", text: "Four chained full adders" }),
        row(el("label", { class: "lb-lbl" }, `A = ${x} `, range(0, 15, x, (v) => { x = v; draw(); }, "A value")), el("label", { class: "lb-lbl" }, `B = ${y} `, range(0, 15, y, (v) => { y = v; draw(); }, "B value"))),
        el("div", { class: "lb-ripple" }, ...[3, 2, 1, 0].map((i) => el("div", { class: "lb-rcell" }, el("span", { class: "lb-dim", text: `bit ${i}` }), el("span", { text: `${(x >> i) & 1} + ${(y >> i) & 1}` }), el("b", { text: String(rip.trace[i].sum) }), el("span", { class: "lb-dim", text: `carry ${rip.trace[i].carry}` })))),
        el("p", { class: "lb-note lb-mono", text: `${x.toString(2).padStart(4, "0")} + ${y.toString(2).padStart(4, "0")} = ${rip.carryOut}${rip.sum.toString(2).padStart(4, "0")}  (${x + y})${rip.carryOut ? "   carry out: a 4-bit result overflowed" : ""}` }));
    }
  }
  body.append(holder); render();
  return root;
});
