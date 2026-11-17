import { el, card, btn, row, register, clear } from "./dom";

const SAMPLES: [string, string][] = [
  ["Basic page", '<h1>Hello</h1>\n<p>A <em>short</em> page with a <a href="/docs">link</a>.</p>\n<ul>\n  <li>one</li>\n  <li>two</li>\n</ul>'],
  ["Missing end tags", "<p>First paragraph\n<p>Second paragraph\n<ul><li>one<li>two</ul>"],
  ["Bad nesting", "<b>bold <i>both</b> italic?</i>"],
  ["Table without tbody", "<table><tr><td>a<td>b</table>"],
];
function tree(node: Node, depth: number, out: HTMLElement) {
  if (node.nodeType === 1) {
    const e = node as Element;
    const attrs = [...e.attributes].map((a) => ` ${a.name}="${a.value}"`).join("");
    out.append(el("div", { class: "lb-tn", style: `--d:${depth}` }, el("span", { class: "lb-tg", text: `<${e.localName}${attrs}>` })));
    node.childNodes.forEach((c) => tree(c, depth + 1, out));
  } else if (node.nodeType === 3) {
    const t = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (t) out.append(el("div", { class: "lb-tn t", style: `--d:${depth}`, text: `"${t}"` }));
  } else if (node.nodeType === 8) out.append(el("div", { class: "lb-tn cm", style: `--d:${depth}`, text: `<!-- ${node.textContent} -->` }));
}
register("domtree", () => {
  const { root, body } = card("HTML to DOM tree", "Browsers never show you your markup. They parse it into a tree, repairing mistakes on the way. Edit the HTML and compare it with what the parser actually built.", "web");
  let src = SAMPLES[0][1];
  const view = el("div", { class: "lb-tree" }), count = el("p", { class: "lb-note" });
  const draw = () => {
    clear(view);
    const doc = new DOMParser().parseFromString(src, "text/html");
    doc.body.childNodes.forEach((c) => tree(c, 0, view));
    const elems = doc.body.querySelectorAll("*").length;
    count.textContent = `${elems} element${elems === 1 ? "" : "s"} inside <body>. The parser also added <html>, <head> and <body> for you.`;
  };
  const ta = el("textarea", { class: "lb-in lb-mono lb-ta", rows: 7, spellcheck: "false", "aria-label": "HTML source", on: { input: (e: Event) => { src = (e.target as HTMLTextAreaElement).value; draw(); } } });
  ta.value = src;
  body.append(row(...SAMPLES.map(([n, s]) => btn(n, () => { src = s; ta.value = s; draw(); }))), el("div", { class: "lb-split" }, el("div", {}, el("h5", { class: "lb-sub", text: "what you wrote" }), ta), el("div", {}, el("h5", { class: "lb-sub", text: "what the browser built" }), view)), count);
  draw();
  return root;
});
