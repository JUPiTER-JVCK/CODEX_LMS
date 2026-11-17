import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface Cmd { id: string; label: string; hint?: string; group: string; run: () => void }

function score(q: string, t: string): number {
  if (!q) return 1;
  t = t.toLowerCase(); q = q.toLowerCase();
  if (t.includes(q)) return 100 - t.indexOf(q);
  let i = 0, s = 0;
  for (const c of t) if (c === q[i]) { i++; s++; }
  return i === q.length ? s : 0;
}

export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Cmd[] }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useMemo(
    () => commands.map((c) => ({ c, s: score(q, c.label + " " + c.group) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40).map((x) => x.c),
    [q, commands],
  );
  useEffect(() => { if (open) { setQ(""); setSel(0); } }, [open]);
  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    document.querySelector(".palette .row.sel")?.scrollIntoView({ block: "nearest" });
  }, [sel]);
  const run = (c?: Cmd) => { if (c) { onClose(); c.run(); } };
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.12 }} onMouseDown={onClose}>
          <motion.div className="palette glass" role="dialog" aria-label="Command palette" initial={{ y: -16, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: -10, scale: 0.98, opacity: 0, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }} onMouseDown={(e) => e.stopPropagation()}>
            <input ref={input} autoFocus value={q} placeholder="Jump to a chapter, widget or theme…" onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, list.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
                else if (e.key === "Enter") run(list[sel]);
                else if (e.key === "Escape") onClose();
              }} />
            <div className="rows">
              {list.map((c, i) => (
                <div key={c.id} className={"row" + (i === sel ? " sel" : "")} onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
                  <span className="grp">{c.group}</span><span className="lbl">{c.label}</span>{c.hint && <span className="hint">{c.hint}</span>}
                </div>
              ))}
              {list.length === 0 && <div className="empty">No matches</div>}
            </div>
            <div className="foot"><kbd>↑↓</kbd> navigate <kbd>↵</kbd> open <kbd>esc</kbd> close</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
