import { linearSearch, binarySearch, sortCount, sampleList, type SortName } from "@codex/widgets";
import { el, card, btn, row, note, register, clear, range, reduceMotion } from "./dom";

register("algoracer", () => {
  const { root, body } = card("Search and sort, by counting steps", "Linear search checks items one by one; binary search halves a sorted list each time. Pick a target and race them, then compare how three sorts scale.");
  const arr = Array.from({ length: 64 }, (_, i) => i * 3 + 1);
  let target = arr[44], timer = 0;
  const lane = (name: string) => { const cells = el("div", { class: "lb-cells" }, ...arr.map((v) => el("span", { class: "lb-cell", title: String(v) }))); const count = el("b", { text: "0" }); return { cells, count, root: el("div", { class: "lb-lane" }, el("span", { class: "lb-lanename", text: name }), cells, el("span", { class: "lb-lanecount" }, count, " steps")) }; };
  const lin = lane("linear"), bin = lane("binary");
  const msg = note("");
  const reset = () => { clearInterval(timer); for (const l of [lin, bin]) { l.cells.querySelectorAll(".lb-cell").forEach((c) => (c.className = "lb-cell")); l.count.textContent = "0"; } };
  const showAll = () => {
    reset();
    const l = linearSearch(arr, target), b = binarySearch(arr, target);
    const paint = (lane_: typeof lin, steps: { index: number; found: boolean }[]) => { steps.forEach((s) => lane_.cells.children[s.index].classList.add(s.found ? "hit" : "seen")); lane_.count.textContent = String(steps.length); };
    paint(lin, l.steps); paint(bin, b.steps);
    msg.textContent = `Looking for ${target} in ${arr.length} sorted numbers: linear needed ${l.steps.length} checks, binary ${b.steps.length}. Doubling the list adds one binary step but doubles the linear worst case.`;
  };
  const race = () => {
    if (reduceMotion()) { showAll(); return; }
    reset();
    const l = linearSearch(arr, target).steps, b = binarySearch(arr, target).steps;
    let i = 0;
    timer = window.setInterval(() => {
      if (i < l.length) { lin.cells.children[l[i].index].classList.add(l[i].found ? "hit" : "seen"); lin.count.textContent = String(i + 1); }
      if (i < b.length) { bin.cells.children[b[i].index].classList.add(b[i].found ? "hit" : "seen"); bin.count.textContent = String(i + 1); }
      if (++i >= Math.max(l.length, b.length)) { clearInterval(timer); showAll(); }
    }, 90);
  };
  const pick = el("select", { class: "lb-in", "aria-label": "target value", on: { change: (e: Event) => { target = +(e.target as HTMLSelectElement).value; showAll(); } } },
    ...[0, 10, 30, 44, 63].map((i) => el("option", { value: arr[i], selected: arr[i] === target }, `${arr[i]} (position ${i + 1})`)), el("option", { value: 2 }, "2 (not in the list)"));
  // sorts
  let n = 40;
  const table = el("div");
  const drawSorts = () => {
    clear(table);
    const data = sampleList(n), names: [SortName, string][] = [["bubble", "Bubble sort"], ["insertion", "Insertion sort"], ["merge", "Merge sort"]];
    const res = names.map(([k, label]) => ({ label, ...sortCount(k, data) })), most = Math.max(...res.map((r) => r.comparisons));
    table.append(el("div", { class: "lb-sorts" }, ...res.map((r) => el("div", { class: "lb-srow" }, el("span", { text: r.label }), el("span", { class: "lb-bar" }, el("i", { style: `width:${(r.comparisons / most) * 100}%` })), el("b", { class: "lb-mono", text: `${r.comparisons.toLocaleString("en-US")} comparisons` })))),
      el("p", { class: "lb-note", text: `Sorting ${n} random numbers. Bubble and insertion sort grow with n²; merge sort grows with n·log n, which is why it wins as lists get long.` }));
  };
  const nl = el("span", { class: "lb-lbl", text: `${n} numbers to sort` });
  body.append(row(el("span", { class: "lb-lbl", text: "Find" }), pick, btn("Race", race), btn("Show result", showAll)), lin.root, bin.root, msg,
    el("h5", { class: "lb-sub", text: "Sorting three ways" }), row(nl, range(8, 200, n, (v) => { n = v; nl.textContent = `${v} numbers to sort`; drawSorts(); }, "number of items")), table);
  showAll(); drawSorts();
  return root;
});
