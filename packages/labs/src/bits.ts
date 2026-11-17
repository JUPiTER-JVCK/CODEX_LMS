import { bitsInit, toggleBit, increment, decrement, shiftLeft, shiftRight, invert, setValue, bitArray, bitsView, type BitsState } from "@codex/widgets";
import { el, card, btn, row, stat, note, register, reduceMotion, live } from "./dom";

register("bitswitches", () => {
  const { root, body } = card("Bit switches", "Flip the bits. Each one is worth double the bit to its right, and the number is the sum of the bits that are on. Try 127, then +1.");
  let s: BitsState = bitsInit(8, 5);
  let timer = 0;
  const cells = el("div", { class: "lb-bits" });
  const dec = stat("decimal", ""), hex = stat("hex", ""), bin = stat("binary", ""), sgn = stat("signed (two's complement)", "");
  const warn = note("", "warn"); warn.hidden = true;
  const auto = btn("Count", () => { if (timer) { stopAuto(); } else { timer = window.setInterval(() => set(increment(s)), 450); auto.textContent = "Stop"; auto.classList.add("on"); } });
  const stopAuto = () => { clearInterval(timer); timer = 0; auto.textContent = "Count"; auto.classList.remove("on"); };
  function set(n: BitsState) { s = n; draw(); }
  const drawCells = live(cells, () => {
    cells.replaceChildren(...bitArray(s).map((b, i) => {
      const idx = s.width - 1 - i;
      return el("div", { class: "lb-bitcol" },
        el("span", { class: "lb-place", text: String(2 ** idx) }),
        el("button", { type: "button", class: "lb-bit" + (b ? " on" : ""), "aria-pressed": !!b, "aria-label": `bit ${idx}`, on: { click: () => { stopAuto(); set(toggleBit(s, idx)); } } }, String(b)),
        el("span", { class: "lb-contrib", text: b ? `+${2 ** idx}` : " " }));
    }));
  });
  function draw() {
    drawCells();
    const v = bitsView(s);
    dec.set(String(v.dec)); hex.set(v.hex); bin.set(v.bin); sgn.set(String(v.signed), v.signed < 0);
    warn.hidden = !s.overflow;
    warn.textContent = s.overflow ? `Overflow: the result did not fit in ${s.width} bits, so it wrapped around. This is the Year 2038 bug in miniature.` : "";
  }
  body.append(cells, row(dec.root, hex.root, bin.root, sgn.root), warn,
    row(btn("+1", () => set(increment(s))), btn("−1", () => set(decrement(s))), btn("<< 1", () => set(shiftLeft(s))), btn(">> 1", () => set(shiftRight(s))), btn("NOT", () => set(invert(s))),
      btn("127", () => set(setValue(s, 127))), btn("255", () => set(setValue(s, 255))), btn("clear", () => set(setValue(s, 0))), auto));
  if (reduceMotion()) auto.title = "Counts once every half second";
  draw();
  return root;
});
