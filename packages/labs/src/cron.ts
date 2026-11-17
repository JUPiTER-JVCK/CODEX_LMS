import { explain, nextRuns, parseCron, CRON_PRESETS } from "@codex/widgets";
import { el, card, btn, row, register, input, clear } from "./dom";

const NAMES = ["minute", "hour", "day of month", "month", "day of week"];
register("cron", () => {
  const { root, body } = card("Cron expression explainer", "Five fields decide when a job runs. Type an expression or start from a preset; the next five run times are computed for your clock.", "zsh");
  let expr = "30 8 * * 1-5";
  const out = el("div");
  const fmt = (d: Date) => d.toLocaleString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const draw = () => {
    clear(out);
    const parsed = parseCron(expr), parts = expr.trim().split(/\s+/), runs = nextRuns(expr, new Date(), 5);
    out.append(el("div", { class: "lb-cronfields" }, ...NAMES.map((n, i) => el("div", {}, el("b", { class: "lb-mono", text: parts[i] ?? "·" }), el("span", { text: n })))),
      el("p", { class: "lb-note" + ("error" in parsed ? " warn" : ""), text: "error" in parsed ? parsed.error : `Runs ${explain(expr)}.` }),
      runs.length ? el("ul", { class: "lb-runs lb-mono" }, ...runs.map((d) => el("li", { text: fmt(d) }))) : "error" in parsed ? "" : el("p", { class: "lb-note warn", text: "That date combination never occurs (for example February 30)." }));
  };
  const field = input(expr, (v) => { expr = v; draw(); }, { label: "cron expression", cls: "lb-mono big", width: "13em" });
  body.append(row(field, ...CRON_PRESETS.map(([e, l]) => btn(l, () => { expr = e; field.value = e; draw(); }, { title: e }))), out);
  draw();
  return root;
});
