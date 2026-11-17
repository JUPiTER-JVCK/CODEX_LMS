import { sampleToken, decodeToken, SAMPLE_SECRET, b64urlEncode, utf8, makeToken } from "@codex/widgets";
import { el, card, btn, row, register, input, clear } from "./dom";

register("jwt", () => {
  const { root, body } = card("Decode, forge and verify a JWT", "The payload is only encoded, not encrypted: anyone can read it. The signature is what protects it, so editing the payload breaks the signature.", "net");
  let token = sampleToken(), secret = SAMPLE_SECRET;
  const out = el("div");
  const tokenIn = el("textarea", { class: "lb-in lb-mono lb-token", rows: 3, spellcheck: "false", "aria-label": "JWT", on: { input: (e: Event) => { token = (e.target as HTMLTextAreaElement).value; draw(); } } });
  const secretIn = input(secret, (v) => { secret = v; draw(); }, { label: "signing secret", cls: "lb-mono", width: "10em" });
  function draw() {
    clear(out);
    const d = decodeToken(token, secret), [h, p, s] = token.trim().split(".");
    out.append(el("p", { class: "lb-mono lb-tokenline" }, el("span", { class: "lb-t1", text: h ?? "" }), ".", el("span", { class: "lb-t2", text: p ?? "" }), ".", el("span", { class: "lb-t3", text: s ?? "" })));
    if (d.ok) {
      out.append(el("div", { class: "lb-split" },
        el("div", {}, el("h5", { class: "lb-sub lb-t1", text: "header" }), el("pre", { class: "lb-pre", text: JSON.stringify(d.header, null, 2) })),
        el("div", {}, el("h5", { class: "lb-sub lb-t2", text: "payload" }), el("pre", { class: "lb-pre", text: JSON.stringify(d.payload, null, 2) }))),
        el("p", { class: "lb-note " + (d.signatureValid ? "ok" : "warn"), text: d.signatureValid ? "Signature valid: a server holding this secret would trust the token." : "Signature INVALID: the server rejects it, because the signature no longer matches the header and payload." }));
    } else out.append(el("p", { class: "lb-note warn", text: d.error ?? "Cannot decode" }));
  }
  const set = (t: string) => { token = t; tokenIn.value = t; draw(); };
  tokenIn.value = token;
  body.append(tokenIn, row(btn("Forge role: admin", () => { const d = decodeToken(token, secret); if (d.ok && d.parts) set(`${d.parts[0]}.${b64urlEncode(utf8(JSON.stringify({ ...(d.payload as object), role: "admin" })))}.${d.parts[2]}`); }, { title: "Edit the payload but keep the old signature" }),
    btn("Re-sign with the secret", () => { const d = decodeToken(token, secret); if (d.ok) set(makeToken(d.header as object, d.payload as object, secret)); }), btn("Reset", () => { secret = SAMPLE_SECRET; secretIn.value = secret; set(sampleToken()); }),
    el("span", { class: "lb-lbl", text: "secret" }), secretIn), out);
  draw();
  return root;
});
