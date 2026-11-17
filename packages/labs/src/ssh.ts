import { defaultHost, configBlock, longCommand, shortCommand, validate, type SshHost } from "@codex/widgets";
import { el, card, btn, row, register, input, clear, copy } from "./dom";

register("sshconfig", () => {
  const { root, body } = card("Build an ssh config entry", "Fill in the connection details. The widget writes the ~/.ssh/config block and shows the long command it replaces, so you can see what every option does.", "net");
  const h: SshHost = defaultHost();
  const out = el("div");
  const field = (label: string, key: keyof SshHost, ph = "", w = "11em") => el("label", { class: "lb-field" }, el("span", { text: label }), input(String(h[key]), (v) => { (h as unknown as Record<string, unknown>)[key] = key === "port" ? Number(v) || 0 : v; draw(); }, { label, ph, width: w, cls: "lb-mono" }));
  function draw() {
    clear(out);
    const errs = validate(h), cfg = configBlock(h), long = longCommand(h);
    if (errs.length) { out.append(el("ul", { class: "lb-errs" }, ...errs.map((e) => el("li", { text: e })))); return; }
    const copyBtn = btn("Copy config", () => copy(cfg, copyBtn));
    out.append(el("div", { class: "lb-split" }, el("div", {}, el("h5", { class: "lb-sub", text: "~/.ssh/config" }), el("pre", { class: "lb-pre", text: cfg }), copyBtn),
      el("div", {}, el("h5", { class: "lb-sub", text: "without the entry you would type" }), el("pre", { class: "lb-pre", text: long }), el("h5", { class: "lb-sub", text: "with it" }), el("pre", { class: "lb-pre", text: shortCommand(h) }))));
  }
  const agent = el("input", { type: "checkbox", "aria-label": "ForwardAgent", on: { change: (e: Event) => { h.agent = (e.target as HTMLInputElement).checked; draw(); } } });
  body.append(row(field("alias", "alias", "pi", "6em"), field("HostName", "host", "192.168.1.50"), field("User", "user", "pi", "7em"), field("Port", "port", "22", "5em")),
    row(field("IdentityFile", "identity", "~/.ssh/id_ed25519", "15em"), field("ProxyJump", "jump", "bastion (optional)", "11em"), field("LocalForward", "forward", "8080:localhost:80", "11em"), el("label", { class: "lb-field" }, el("span", { text: "ForwardAgent" }), agent)), out);
  draw();
  return root;
});
