import { applyMask, cidrMask, ipToNum, numToIp, flagNames, TCP_FLAGS, type MaskOp } from "@codex/widgets";
import { el, card, btn, row, note, register, input, range, clear, live } from "./dom";

const SYM: Record<MaskOp, string> = { AND: "&", OR: "|", XOR: "^", CLEAR: "& ~" };
function bitsRow(label: string, bits: string, keep?: boolean[], toggle?: (i: number) => void) {
  return el("div", { class: "lb-maskrow" }, el("span", { class: "lb-rowlabel", text: label }),
    el("div", { class: "lb-maskbits" }, ...[...bits].map((c, i) => el(toggle ? "button" : "span", {
      type: toggle ? "button" : undefined, class: "lb-mb" + (c === "1" ? " one" : "") + (keep?.[i] ? " keep" : "") + (i % 8 === 0 && i > 0 ? " gap" : ""),
      "aria-label": toggle ? `bit ${bits.length - 1 - i}, currently ${c}` : undefined, on: toggle ? { click: () => toggle(i) } : undefined }, c))));
}

register("bitmask", (args) => {
  if (args.mode === "ip") {
    const { root, body } = card("Mask an address", "ANDing an address with a netmask keeps the network part and zeroes the host part. Drag the prefix and watch the boundary move.");
    let ip = "192.168.1.23", prefix = 24;
    const out = el("div");
    const draw = () => {
      clear(out);
      const n = ipToNum(ip);
      if (n === null) { out.append(note("Enter four numbers from 0 to 255 separated by dots.", "warn")); return; }
      const m = cidrMask(prefix), r = applyMask("AND", n, m, 32), host = applyMask("AND", n, ~m >>> 0, 32);
      out.append(bitsRow("address", r.valueBits), bitsRow("mask", r.maskBits, r.kept), bitsRow("address & mask", r.resultBits, r.kept),
        el("p", { class: "lb-note lb-mono", text: `${ip} & ${numToIp(m)} = ${numToIp(r.result)}  (network)    host part ${numToIp(host.result)}` }));
    };
    const pl = el("span", { class: "lb-lbl", text: `/${prefix}` });
    body.append(row(input(ip, (v) => { ip = v; draw(); }, { label: "IPv4 address", width: "11em" }), pl, range(0, 32, prefix, (v) => { prefix = v; pl.textContent = `/${v}`; draw(); }, "prefix length")), out);
    draw();
    return root;
  }
  const { root, body } = card("Bit mask lab", "A mask picks bits out of a value, sets them, flips them or clears them. Click any bit in the value or the mask to flip it.");
  let op: MaskOp = "AND", value = 0b1011_0110, mask = 0b1111_0000, flags = 0x12;
  const ops = el("div", { class: "lb-row" }), view = el("div"), flagRow = el("div", { class: "lb-row" });
  const drawOps = () => { clear(ops); for (const o of ["AND", "OR", "XOR", "CLEAR"] as MaskOp[]) ops.append(btn(o === "CLEAR" ? "clear (& ~)" : `${o} (${SYM[o]})`, () => { op = o; draw(); }, { on: o === op })); };
  const holder = el("div", {}, ops, view, el("h5", { class: "lb-sub", text: "Real use: the TCP flag byte holds one flag per bit" }), flagRow);
  const draw = live(holder, () => {
    drawOps(); clear(view);
    const r = applyMask(op, value, mask, 8), hx = (n: number) => "0x" + n.toString(16).padStart(2, "0");
    view.append(bitsRow("value", r.valueBits, undefined, (i) => { value ^= 1 << (7 - i); draw(); }), bitsRow(`mask  ${SYM[op]}`, r.maskBits, r.kept, (i) => { mask ^= 1 << (7 - i); draw(); }), bitsRow("result", r.resultBits, r.kept),
      note(r.note), el("p", { class: "lb-note lb-mono", text: `${hx(value)} ${SYM[op]} ${hx(mask)} = ${hx(r.result)}  (${r.result})` }));
    clear(flagRow);
    for (const [name, bit] of TCP_FLAGS.slice().reverse()) flagRow.append(btn(name, () => { flags ^= bit; draw(); }, { on: !!(flags & bit) }));
    flagRow.append(el("span", { class: "lb-mono lb-dim", text: `byte ${hx(flags)} = ${flagNames(flags).join(" + ") || "no flags"}${flags === 0x12 ? "  (a SYN-ACK: second step of a handshake)" : flags === 0x02 ? "  (a connection request)" : ""}` }));
  });
  body.append(holder);
  draw();
  return root;
});
