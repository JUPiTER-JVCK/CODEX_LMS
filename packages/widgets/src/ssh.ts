/** Build a ~/.ssh/config Host block and the long ssh command it stands for. */
export interface SshHost { alias: string; host: string; user: string; port: number; identity: string; jump: string; forward: string; agent: boolean }
export const defaultHost = (): SshHost => ({ alias: "pi", host: "192.168.1.50", user: "pi", port: 22, identity: "~/.ssh/id_ed25519_lab", jump: "", forward: "", agent: false });
export function validate(h: SshHost): string[] {
  const errs: string[] = [];
  if (!/^[A-Za-z0-9._-]+$/.test(h.alias)) errs.push("Host alias: letters, digits, dot, dash or underscore only.");
  if (!h.host.trim()) errs.push("HostName is required.");
  if (!Number.isInteger(h.port) || h.port < 1 || h.port > 65535) errs.push("Port must be 1 to 65535.");
  if (h.forward && !/^\d+:[\w.-]+:\d+$/.test(h.forward)) errs.push("Forward looks like 8080:localhost:80 (local-port:host:port).");
  return errs;
}
export function configBlock(h: SshHost): string {
  const lines = [`Host ${h.alias}`, `    HostName ${h.host}`];
  if (h.user) lines.push(`    User ${h.user}`);
  if (h.port !== 22) lines.push(`    Port ${h.port}`);
  if (h.identity) lines.push(`    IdentityFile ${h.identity}`, "    IdentitiesOnly yes");
  if (h.jump) lines.push(`    ProxyJump ${h.jump}`);
  if (h.forward) lines.push(`    LocalForward ${h.forward.replace(/^(\d+):/, "$1 ")}`);
  if (h.agent) lines.push("    ForwardAgent yes");
  return lines.join("\n");
}
/** What you would have to type without the config entry. */
export function longCommand(h: SshHost): string {
  const a = ["ssh"];
  if (h.identity) a.push("-i", h.identity, "-o IdentitiesOnly=yes");
  if (h.port !== 22) a.push("-p", String(h.port));
  if (h.jump) a.push("-J", h.jump);
  if (h.forward) a.push("-L", h.forward);
  if (h.agent) a.push("-A");
  a.push(h.user ? `${h.user}@${h.host}` : h.host);
  return a.join(" ");
}
export const shortCommand = (h: SshHost) => `ssh ${h.alias}`;
