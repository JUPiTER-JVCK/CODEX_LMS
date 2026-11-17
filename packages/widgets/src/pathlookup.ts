/** How the shell finds a command: walk $PATH left to right, first executable match wins. */
export interface PathStep { dir: string; hit: boolean; winner: boolean; shadowed: boolean }
export const DEFAULT_FS: Record<string, string[]> = {
  "/opt/homebrew/bin": ["python3", "git", "brew", "node", "wget"],
  "/usr/local/bin": ["python3", "node", "code"],
  "/usr/bin": ["python3", "git", "ls", "cat", "curl", "ssh", "zsh", "grep"],
  "/bin": ["ls", "cat", "zsh", "sh", "echo"],
  "/usr/sbin": ["ping", "lsof"],
  "/sbin": ["ifconfig", "route"],
};
export const DEFAULT_PATH = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
export function lookup(command: string, path: string, fs: Record<string, string[]> = DEFAULT_FS): { steps: PathStep[]; found: string | null; shadowed: string[] } {
  if (command.includes("/")) return { steps: [], found: command, shadowed: [] };
  const dirs = path.split(":").filter((d) => d.length > 0);
  let won = false;
  const steps = dirs.map((dir) => {
    const hit = !!command && (fs[dir] ?? []).includes(command);
    const step: PathStep = { dir, hit, winner: hit && !won, shadowed: hit && won };
    if (hit) won = true;
    return step;
  });
  const winner = steps.find((s) => s.winner);
  return { steps, found: winner ? `${winner.dir}/${command}` : null, shadowed: steps.filter((s) => s.shadowed).map((s) => `${s.dir}/${command}`) };
}

/** The same first-match-wins idea for Python's import system: sys.path is searched in order. */
export const PY_PATH = "(script folder):/usr/lib/python3.12:~/.venv/lib/python3.12/site-packages";
export const PY_FS: Record<string, string[]> = {
  "(script folder)": ["utils", "config"],
  "/usr/lib/python3.12": ["random", "json", "os", "socket", "string", "ipaddress"],
  "~/.venv/lib/python3.12/site-packages": ["requests", "yaml", "numpy"],
};
