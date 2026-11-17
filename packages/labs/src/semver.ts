import { parseRange, satisfies, SAMPLE_VERSIONS } from "@codex/widgets";
import { el, card, btn, row, note, register, input, clear } from "./dom";

register("semver", () => {
  const { root, body } = card("Which versions does this range allow?", "package.json lists ranges, not exact versions. ^ allows changes that do not touch the left-most non-zero number, ~ allows patch updates only. Try a few.", "web");
  let range = "^1.2.3";
  const out = el("div");
  const draw = () => {
    clear(out);
    const r = parseRange(range);
    if (!r.ok) { out.append(note(r.error ?? "Cannot read the range", "warn")); return; }
    out.append(el("p", { class: "lb-note lb-mono", text: "means " + r.sets.map((s) => s.map((b) => b.explain).join(" and ")).join("  or  ") }),
      el("div", { class: "lb-vers" }, ...SAMPLE_VERSIONS.map((v) => { const ok = satisfies(v, range); return el("span", { class: "lb-ver lb-mono " + (ok ? "ok" : "no"), title: ok ? "installed by npm" : "not allowed" }, (ok ? "✓ " : "✗ ") + v); })));
  };
  const field = input(range, (v) => { range = v; draw(); }, { label: "version range", cls: "lb-mono big", width: "12em" });
  body.append(row(field, ...["^1.2.3", "~1.2.3", "^0.2.3", ">=1.2.3 <2.0.0", "1.x", "^1.0.0 || ^3.0.0"].map((p) => btn(p, () => { range = p; field.value = p; draw(); }))), out);
  draw();
  return root;
});
