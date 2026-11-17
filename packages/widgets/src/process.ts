/** A tiny process table that reacts to signals the way Unix does. */
export type State = "R" | "S" | "T" | "Z" | "X"; // running, sleeping, stopped, zombie, gone
export interface Proc { pid: number; ppid: number; name: string; state: State; ignoresTerm?: boolean; note: string }
export type Signal = "SIGINT" | "SIGTERM" | "SIGKILL" | "SIGSTOP" | "SIGCONT" | "SIGHUP";
export const SIGNALS: [Signal, number, string][] = [
  ["SIGHUP", 1, "hang up: terminal closed (daemons reload their config)"], ["SIGINT", 2, "Ctrl-C: please stop"], ["SIGKILL", 9, "cannot be caught or ignored"],
  ["SIGTERM", 15, "polite request to exit (kill's default)"], ["SIGSTOP", 19, "pause; cannot be caught"], ["SIGCONT", 18, "resume a stopped process"],
];
export const initialProcs = (): Proc[] => [
  { pid: 1, ppid: 0, name: "launchd", state: "S", note: "the first process; adopts orphans" },
  { pid: 312, ppid: 1, name: "zsh", state: "S", note: "your shell" },
  { pid: 4410, ppid: 312, name: "ping 1.1.1.1", state: "R", note: "a well-behaved program" },
  { pid: 4411, ppid: 312, name: "stubborn.py", state: "S", ignoresTerm: true, note: "ignores SIGTERM and SIGINT" },
  { pid: 4412, ppid: 312, name: "worker (parent never wait()s)", state: "S", note: "when it exits it becomes a zombie" },
];
export function send(procs: Proc[], pid: number, sig: Signal): { procs: Proc[]; message: string } {
  const next = procs.map((p) => ({ ...p }));
  const p = next.find((x) => x.pid === pid);
  if (!p) return { procs, message: `kill: no such process ${pid}` };
  if (p.state === "X") return { procs, message: `kill: ${pid}: no such process` };
  if (p.state === "Z") return { procs, message: `${p.name} is already dead; only its parent calling wait() can remove the zombie` };
  if (p.pid === 1 && (sig === "SIGKILL" || sig === "SIGTERM" || sig === "SIGINT")) return { procs, message: "launchd (pid 1) ignores signals it does not handle: the system would be gone" };
  /** Mark the process dead; a child whose parent never wait()s lingers as a zombie. Returns true for a zombie. */
  const exit = (): boolean => {
    const zombie = p.name.startsWith("worker");
    p.state = zombie ? "Z" : "X";
    return zombie;
  };
  switch (sig) {
    case "SIGKILL": { const z = exit(); return { procs: next, message: z ? `${p.name} died but its parent has not wait()ed: it is now a zombie (state Z)` : `${p.name} killed. The kernel does it; the program never sees it.` }; }
    case "SIGTERM": case "SIGINT": case "SIGHUP":
      if (p.ignoresTerm && sig !== "SIGHUP") return { procs: next, message: `${p.name} caught ${sig} and carried on. Use SIGKILL if it must die.` };
      { const z = exit(); return { procs: next, message: z ? `${p.name} exited but is a zombie until its parent calls wait()` : `${p.name} exited cleanly after ${sig}` }; }
    case "SIGSTOP": p.state = "T"; return { procs: next, message: `${p.name} stopped (state T). Nothing runs until SIGCONT.` };
    case "SIGCONT": if (p.state !== "T") return { procs, message: `${p.name} was not stopped; SIGCONT does nothing` }; p.state = "S"; return { procs: next, message: `${p.name} resumed` };
  }
}
/** The parent finally calls wait(): zombies disappear. */
export function reap(procs: Proc[]): { procs: Proc[]; message: string } {
  const z = procs.filter((p) => p.state === "Z");
  if (!z.length) return { procs, message: "No zombies to reap." };
  return { procs: procs.map((p) => (p.state === "Z" ? { ...p, state: "X" as State } : p)), message: `Parent called wait(): ${z.length} zombie${z.length > 1 ? "s" : ""} removed` };
}
export const stateName: Record<State, string> = { R: "running", S: "sleeping", T: "stopped", Z: "zombie", X: "gone" };
