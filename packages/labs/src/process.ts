import { initialProcs, send, reap, SIGNALS, stateName, type Proc, type Signal } from "@codex/widgets";
import { el, card, btn, row, note, register, clear, live } from "./dom";

register("procsim", () => {
  const { root, body } = card("Signals and process states", "Pick a process, then send it a signal. Some can be ignored, some cannot, and a child whose parent never calls wait() lingers as a zombie.", "zsh");
  let procs: Proc[] = initialProcs(), sel = 4410;
  const msg = note("Select a process and send a signal."), tbl = el("div"), sigs = el("div", { class: "lb-row" });
  const holder = el("div", { class: "lb" }, tbl, row(el("span", { class: "lb-lbl", text: "kill -" }), sigs));
  const draw = live(holder, () => {
    clear(tbl);
    tbl.append(el("div", { class: "tw" }, el("table", { class: "lb-proc" }, el("thead", {}, el("tr", {}, ...["PID", "PPID", "STATE", "COMMAND", ""].map((h) => el("th", { text: h })))),
      el("tbody", {}, ...procs.map((p) => el("tr", { class: (p.pid === sel ? "hit " : "") + "st-" + p.state, tabindex: 0, role: "button", "aria-label": `select process ${p.pid}`,
        on: { click: () => { sel = p.pid; draw(); }, keydown: (e: Event) => { if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") { e.preventDefault(); sel = p.pid; draw(); } } } },
        el("td", { class: "lb-mono", text: String(p.pid) }), el("td", { class: "lb-mono", text: String(p.ppid) }), el("td", {}, el("span", { class: "lb-state", text: `${p.state} ${stateName[p.state]}` })), el("td", { class: "lb-mono", text: p.name }), el("td", { class: "lb-dim", text: p.note })))))));
    clear(sigs);
    for (const [name, num, why] of SIGNALS) sigs.append(btn(`${name} (${num})`, () => { const r = send(procs, sel, name as Signal); procs = r.procs; msg.textContent = r.message; draw(); }, { title: why }));
    sigs.append(btn("Parent calls wait()", () => { const r = reap(procs); procs = r.procs; msg.textContent = r.message; draw(); }, { title: "reap zombies" }), btn("Reset", () => { procs = initialProcs(); msg.textContent = "Table reset."; draw(); }));
  });
  body.append(holder, msg, note("Try SIGTERM on stubborn.py (it ignores it), then SIGKILL. Send SIGTERM to the worker to make a zombie, then let its parent reap it.", "lb-dim"));
  draw();
  return root;
});
