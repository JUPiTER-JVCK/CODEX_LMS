import { CHARSETS, HASHES, entropyBits, crackTime, verdict } from "@codex/widgets";
import { el, card, btn, row, register, range, clear, live } from "./dom";

register("crackcalc", () => {
  const { root, body } = card("How long to guess it?", "A brute-force attacker tries every combination. Length and character set set the search space, and the hash decides how fast each try is. Compare a fast hash with a slow one.", "net");
  let cs = 3, len = 10, h = 0;
  const out = el("div");
  const draw = () => {
    clear(out);
    const bits = entropyBits(CHARSETS[cs][2], len);
    const rows = HASHES.map(([name, rate, why], i) => { const t = crackTime(bits, rate); return el("tr", { class: i === h ? "hit" : "" }, el("td", { text: name }), el("td", { class: "lb-mono", text: t.text }), el("td", { class: "lb-dim", text: verdict(t.seconds) })); });
    out.append(el("p", { class: "lb-note", text: `${len} characters from ${CHARSETS[cs][1]} = ${CHARSETS[cs][2]}^${len} combinations ≈ ${bits.toFixed(0)} bits of entropy.` }),
      el("div", { class: "tw" }, el("table", {}, el("thead", {}, el("tr", {}, ...["hash", "average time to find it", "verdict"].map((x) => el("th", { text: x })))), el("tbody", {}, ...rows))),
      el("p", { class: "lb-note", text: HASHES[h][2] + ". A random 4-word passphrase is about 50 bits; a human-chosen \"complex\" 8-character password is often below 30." }));
  };
  const lenLbl = el("span", { class: "lb-lbl", text: `${len} characters` });
  const sets = el("div", { class: "lb-row" });
  const drawSets = live(sets, () => { clear(sets); CHARSETS.forEach(([name], i) => sets.append(btn(name, () => { cs = i; drawSets(); draw(); }, { on: i === cs }))); });
  const hashes = el("div", { class: "lb-row" });
  const drawHashes = live(hashes, () => { clear(hashes); HASHES.forEach(([name], i) => hashes.append(btn(name, () => { h = i; drawHashes(); draw(); }, { on: i === h }))); });
  body.append(sets, row(lenLbl, range(4, 24, len, (v) => { len = v; lenLbl.textContent = `${v} characters`; draw(); }, "password length")), hashes, out);
  drawSets(); drawHashes(); draw();
  return root;
});
