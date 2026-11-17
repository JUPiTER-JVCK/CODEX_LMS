import { lookup, DEFAULT_PATH, DEFAULT_FS, PY_PATH, PY_FS } from "@codex/widgets";
import { el, card, btn, row, note, register, input, clear } from "./dom";

register("pathlookup", (args) => {
  const py = args.mode === "python";
  const fsBase = py ? PY_FS : DEFAULT_FS, basePath = py ? PY_PATH : DEFAULT_PATH;
  const { root, body } = card(py ? "Where does import look?" : "PATH lookup",
    py ? "Python searches sys.path from first to last and imports the first match. Add a file called random.py next to your script and see what happens."
       : "The shell walks $PATH from left to right and runs the first match. Reorder the folders and a different program wins.", py ? "py" : "zsh");
  let path = basePath, cmd = py ? "random" : "python3", local = false;
  const out = el("div");
  const names = py ? ["random", "json", "requests", "utils", "nope"] : ["python3", "git", "ls", "node", "ping", "nope"];
  const draw = () => {
    clear(out);
    const fs = py && local ? { ...fsBase, "(script folder)": [...fsBase["(script folder)"], "random"] } : fsBase;
    const r = lookup(cmd.trim(), path, fs);
    out.append(el("ol", { class: "lb-pathlist lb-mono" }, ...r.steps.map((s, i) => el("li", { class: s.winner ? "win" : s.shadowed ? "shadow" : "" },
      el("span", { class: "lb-n", text: String(i + 1) }), el("span", { class: "lb-dir", text: s.dir }),
      el("span", { class: "lb-res", text: s.winner ? `✓ ${cmd} found here: this one is used` : s.shadowed ? "✗ also has it, but is never reached" : fs[s.dir] ? "no match, keep looking" : "not in this lab" })))),
      el("p", { class: "lb-note lb-mono" }, ...(r.found ? ["→ ", el("b", { text: r.found }), r.shadowed.length ? el("span", { class: "lb-dim", text: `  (hides ${r.shadowed.join(", ")})` }) : ""] : [py ? `ModuleNotFoundError: No module named '${cmd}'` : `zsh: command not found: ${cmd}`])));
  };
  const cmdIn = input(cmd, (v) => { cmd = v; draw(); }, { label: py ? "module name" : "command", cls: "lb-mono", width: "10em" });
  const pathIn = input(path, (v) => { path = v; draw(); }, { label: py ? "sys.path" : "PATH", cls: "lb-mono", width: "min(100%,34em)" });
  body.append(row(el("span", { class: "lb-mono lb-dim", text: py ? "import" : "$ type -a" }), cmdIn, ...names.map((c) => btn(c, () => { cmd = c; cmdIn.value = c; draw(); }))),
    row(el("span", { class: "lb-mono lb-dim", text: py ? "sys.path" : "PATH" }), pathIn, btn("Reverse", () => { path = path.split(":").reverse().join(":"); pathIn.value = path; draw(); }), btn("Reset", () => { path = basePath; pathIn.value = path; local = false; draw(); }),
      py ? btn("Add random.py next to my script", () => { local = !local; draw(); }, { title: "Toggle a local file that shadows the standard library" }) : ""), out);
  draw();
  return root;
});
