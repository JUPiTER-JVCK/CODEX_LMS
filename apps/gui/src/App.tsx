import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { outline, loadChapter, Chapter, ChapterMeta } from "./content";
import { usePersisted } from "./store";
import { Blocks, Inline } from "./components/Blocks";
import { CommandPalette, Cmd } from "./components/CommandPalette";
import { BinaryCounter } from "./widgets/BinaryCounter";
import { GateLab } from "./widgets/GateLab";
import { SubnetCalc } from "./widgets/SubnetCalc";

type View = { kind: "home" } | { kind: "lab" } | { kind: "chapter"; id: string };
const THEMES = [["aurora", "Aurora"], ["terminal", "Terminal"], ["paper", "Paper"]] as const;

/** Which interactive widgets belong next to which chapter. */
const CHAPTER_WIDGETS: Record<string, ("bits" | "gates" | "subnet")[]> = {
  computers: ["bits", "gates"],
  addressing: ["subnet", "bits"],
  networks: ["subnet"],
  "net-local": ["subnet"],
};
const WIDGETS = { bits: BinaryCounter, gates: GateLab, subnet: SubnetCalc };

export function App() {
  const [view, setView] = usePersisted<View>("codex.view", { kind: "home" });
  const [theme, setTheme] = usePersisted<string>("codex.theme", "aurora");
  const [done, setDone] = usePersisted<string[]>("codex.done", []);
  const [palette, setPalette] = useState(false);
  const [openParts, setOpenParts] = usePersisted<string[]>("codex.parts", ["start", "found"]);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const go = useCallback((v: View) => { setView(v); document.querySelector(".main")?.scrollTo({ top: 0 }); }, [setView]);
  const byPart = useMemo(() => outline.parts.map(([id, name]) => ({ id, name, chapters: outline.chapters.filter((c) => c.part === id) })).filter((p) => p.chapters.length), []);
  const doneSet = new Set(done);
  const pct = Math.round((100 * done.filter((d) => outline.chapters.some((c) => c.id === d)).length) / outline.chapters.length);
  const current = view.kind === "chapter" ? outline.chapters.find((c) => c.id === view.id) : undefined;

  const commands: Cmd[] = useMemo(() => [
    { id: "home", label: "Home", group: "Go", run: () => go({ kind: "home" }) },
    { id: "lab", label: "Widget lab", group: "Go", hint: "all interactive tools", run: () => go({ kind: "lab" }) },
    ...THEMES.map(([id, name]) => ({ id: "t-" + id, label: `Theme: ${name}`, group: "Theme", run: () => setTheme(id) })),
    ...outline.chapters.map((c) => ({ id: c.id, label: c.title, group: "Chapter", hint: c.sub.slice(0, 60), run: () => go({ kind: "chapter", id: c.id }) })),
  ], [go, setTheme]);

  return (
    <div className="app">
      <div className="aurora" aria-hidden><i /><i /><i /></div>
      <header className="titlebar glass" data-tauri-drag-region>
        <div className="brand" data-tauri-drag-region><span className="logo">◆</span> CODEX</div>
        <button className="searchbtn" onClick={() => setPalette(true)}>
          <span>Search chapters, widgets, themes…</span><kbd>⌘K</kbd>
        </button>
        <div className="seg themes" role="group" aria-label="theme">
          {THEMES.map(([id, name]) => (
            <button key={id} className={theme === id ? "active" : ""} onClick={() => setTheme(id)} title={name}>{name}</button>
          ))}
        </div>
      </header>

      <aside className="sidebar glass">
        <nav>
          <button className={"navitem" + (view.kind === "home" ? " active" : "")} onClick={() => go({ kind: "home" })}>⌂ Home</button>
          <button className={"navitem" + (view.kind === "lab" ? " active" : "")} onClick={() => go({ kind: "lab" })}>✦ Widget lab</button>
        </nav>
        <div className="progress">
          <div className="ring" style={{ ["--p" as string]: pct }}><b>{pct}%</b></div>
          <div><b>{done.length}</b> of {outline.chapters.length} chapters<br /><span className="muted">saved on this device</span></div>
        </div>
        <div className="parts">
          {byPart.map((p) => {
            const open = openParts.includes(p.id) || (view.kind === "chapter" && current?.part === p.id);
            return (
              <div key={p.id} className="part">
                <button className="parthead" onClick={() => setOpenParts((o) => (o.includes(p.id) ? o.filter((x) => x !== p.id) : [...o, p.id]))}>
                  <motion.span animate={{ rotate: open ? 90 : 0 }}>▸</motion.span> {p.name}
                  <span className="count">{p.chapters.filter((c) => doneSet.has(c.id)).length}/{p.chapters.length}</span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                      {p.chapters.map((c) => (
                        <button key={c.id} className={"chapteritem" + (view.kind === "chapter" && view.id === c.id ? " active" : "")} onClick={() => go({ kind: "chapter", id: c.id })}>
                          <span className={"dot" + (doneSet.has(c.id) ? " done" : "")} />{c.title}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div key={view.kind + ("id" in view ? view.id : "")} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            {view.kind === "home" && <Home go={go} done={done} />}
            {view.kind === "lab" && <Lab />}
            {view.kind === "chapter" && current && (
              <ChapterView meta={current} done={doneSet.has(current.id)} onToggleDone={() => setDone((d) => (d.includes(current.id) ? d.filter((x) => x !== current.id) : [...d, current.id]))}
                next={outline.chapters[outline.chapters.indexOf(current) + 1]} go={go} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <CommandPalette open={palette} onClose={() => setPalette(false)} commands={commands} />
    </div>
  );
}

function Home({ go, done }: { go: (v: View) => void; done: string[] }) {
  const next = outline.chapters.find((c) => !done.includes(c.id)) ?? outline.chapters[0];
  const stats = [
    [outline.chapters.length, "chapters"],
    [outline.chapters.reduce((a, c) => a + c.commands, 0), "command cards"],
    [outline.chapters.reduce((a, c) => a + c.exercises, 0), "exercises"],
    [3, "live widgets"],
  ];
  return (
    <div className="page">
      <motion.h1 className="hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>Learn by <span className="grad">poking things</span>.</motion.h1>
      <p className="lede">From the macOS terminal to networks, Python, the web, servers and crypto. Every idea has something you can flip, type or break.</p>
      <div className="stats">
        {stats.map(([n, l], i) => (
          <motion.div key={l} className="stat glass" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
            <b>{n}</b><span>{l}</span>
          </motion.div>
        ))}
      </div>
      <div className="cta-row">
        <motion.button className="cta glass" whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={() => go({ kind: "chapter", id: next.id })}>
          <span className="eyebrow">{done.length ? "Continue" : "Start here"}</span><b>{next.title}</b><span className="muted">{next.sub}</span>
        </motion.button>
        <motion.button className="cta glass" whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={() => go({ kind: "lab" })}>
          <span className="eyebrow">Play</span><b>Widget lab</b><span className="muted">Binary counter, logic gates, subnet calculator</span>
        </motion.button>
      </div>
    </div>
  );
}

function Lab() {
  return (
    <div className="page wide">
      <h1>Widget lab</h1>
      <p className="lede">Every widget here runs the same logic engine as the terminal version.</p>
      <div className="labgrid"><BinaryCounter /><GateLab /><SubnetCalc /></div>
    </div>
  );
}

function ChapterView({ meta, done, onToggleDone, next, go }: { meta: ChapterMeta; done: boolean; onToggleDone: () => void; next?: ChapterMeta; go: (v: View) => void }) {
  const [ch, setCh] = useState<Chapter | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { setCh(null); setErr(""); loadChapter(meta.id).then(setCh).catch((e) => setErr(String(e))); }, [meta.id]);
  const widgets = CHAPTER_WIDGETS[meta.id] ?? [];
  return (
    <article className="page chapter">
      <div className="eyebrow">{outline.parts.find(([id]) => id === meta.part)?.[1]}{meta.time ? ` · ${meta.time} min` : ""}{meta.level ? ` · ${meta.level}` : ""}</div>
      <h1>{meta.title}</h1>
      <p className="lede"><Inline text={meta.sub} /></p>
      {meta.goals.length > 0 && (
        <div className="goals glass"><b>You will be able to</b><ul>{meta.goals.map((g, i) => <li key={i}><Inline text={g} /></li>)}</ul></div>
      )}
      {widgets.length > 0 && (
        <section className="tryit"><div className="eyebrow">Try it</div>
          {widgets.map((w) => { const W = WIDGETS[w]; return <W key={w} />; })}
        </section>
      )}
      {err && <div className="banner warn">{err}</div>}
      {!ch && !err && <div className="skeleton" aria-busy="true"><i /><i /><i /></div>}
      {ch && <Blocks blocks={ch.blocks} />}
      <div className="chapter-foot glass">
        <button className={done ? "primary" : ""} onClick={onToggleDone}>{done ? "✓ Completed" : "Mark complete"}</button>
        {next && <button onClick={() => go({ kind: "chapter", id: next.id })}>Next: {next.title} →</button>}
      </div>
    </article>
  );
}
