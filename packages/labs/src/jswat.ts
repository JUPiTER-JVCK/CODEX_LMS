import { PUZZLES } from "@codex/widgets";
import { el, card, btn, row, note, register, clear } from "./dom";

register("jswat", () => {
  const { root, body } = card("Predict the result", "JavaScript converts types behind your back. Guess what each expression gives, then read why. Nothing here is a bug in your code: it is how the language is defined.", "web");
  let i = 0, score = 0, answered = false;
  const view = el("div");
  const draw = () => {
    clear(view);
    if (i >= PUZZLES.length) { view.append(el("p", { class: "lb-note", text: `Done: ${score} of ${PUZZLES.length} right. The cure is the same every time: use === , convert on purpose with Number() or String(), and never rely on coercion you cannot explain.` }), row(btn("Play again", () => { i = 0; score = 0; answered = false; draw(); }))); return; }
    const p = PUZZLES[i];
    const why = note("", "lb-why"); why.hidden = true;
    const choices = el("div", { class: "lb-row" }, ...p.choices.map((c) => el("button", { type: "button", class: "lb-btn lb-mono", on: { click: (e: Event) => {
      if (answered) return; answered = true;
      const ok = c === p.answer; if (ok) score++;
      (e.target as HTMLElement).classList.add(ok ? "right" : "wrong");
      choices.querySelectorAll("button").forEach((b) => { if (b.textContent === p.answer) b.classList.add("right"); (b as HTMLButtonElement).disabled = true; });
      why.hidden = false; why.textContent = (ok ? "Correct. " : `It is ${p.answer}. `) + p.why;
      next.hidden = false; next.focus();
    } } }, c)));
    const next = btn(i === PUZZLES.length - 1 ? "Finish" : "Next", () => { i++; answered = false; draw(); }); next.hidden = true;
    view.append(el("p", { class: "lb-puzzle lb-mono", text: p.expr }), choices, why, row(next, el("span", { class: "lb-dim", text: `${i + 1} of ${PUZZLES.length} · score ${score}` })));
  };
  body.append(view); draw();
  return root;
});
