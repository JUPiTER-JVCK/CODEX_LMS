import { SAMPLE_PATH, probe, traceroute } from "@codex/widgets";
import { el, card, btn, row, note, register, clear, range } from "./dom";

register("ttltrace", () => {
  const { root, body } = card("TTL and traceroute", "Every router subtracts 1 from a packet's TTL. When it reaches 0 the router drops the packet and tells you who it was. traceroute sends probes with TTL 1, 2, 3... to map the path.", "net");
  let ttl = 3;
  const path = el("div", { class: "lb-path" }), result = note(""), trace = el("pre", { class: "lb-pre" });
  const draw = () => {
    clear(path);
    const p = probe(SAMPLE_PATH, ttl);
    SAMPLE_PATH.forEach((h, i) => {
      const reached = i <= Math.min(ttl, SAMPLE_PATH.length - 1), dies = i === ttl && ttl < SAMPLE_PATH.length - 1;
      path.append(el("div", { class: "lb-hop" + (reached ? " reached" : "") + (dies ? " dies" : "") }, el("span", { class: "dot" }), el("b", { text: i === 0 ? "you" : `hop ${i}` }), el("span", { class: "lb-dim", text: h.name }), el("span", { class: "lb-mono", text: h.ip }), el("span", { class: "lb-ttl lb-mono", text: i <= ttl ? `TTL ${Math.max(0, ttl - i)}` : "" })));
    });
    result.textContent = `Probe with TTL ${ttl}: ${p.reply === "time-exceeded" ? `answered by ${p.from} after ${p.rtt} ms (ICMP time exceeded). ` : p.reply === "silence" ? "no answer (shown as * in traceroute). " : `reached ${p.from} in ${p.rtt} ms (echo reply). `}${p.note}`;
    trace.textContent = "$ traceroute example.com\n" + traceroute(SAMPLE_PATH).map((q, i) => ` ${i + 1}  ${q.reply === "silence" ? "* * *" : `${q.from}  ${q.rtt?.toFixed(1)} ms`}`).join("\n");
  };
  const lbl = el("span", { class: "lb-lbl", text: `TTL ${ttl}` });
  body.append(row(lbl, range(1, 8, ttl, (v) => { ttl = v; lbl.textContent = `TTL ${v}`; draw(); }, "TTL"), btn("Low TTL", () => { ttl = 2; lbl.textContent = "TTL 2"; draw(); }), btn("Enough TTL", () => { ttl = 8; lbl.textContent = "TTL 8"; draw(); })), path, result, trace);
  draw();
  return root;
});
