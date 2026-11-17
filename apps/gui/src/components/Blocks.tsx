import { Fragment, ReactNode, useState } from "react";
import type { Block } from "../content";

/** Minimal inline markdown: **bold**, `code`, *em*. */
export function Inline({ text }: { text: string }) {
  const clean = String(text ?? "").replace(/\{\{(\w+)\}\}/g, "$1");
  const parts = clean.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") ? <code key={i}>{p.slice(1, -1)}</code>
        : p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong>
        : p.startsWith("*") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em>
        : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const isArt = lang === "ascii";
  return (
    <div className={"codeblock" + (isArt ? " art" : "")}>
      <div className="codebar">
        <span>{isArt ? "diagram" : lang || "text"}</span>
        {!isArt && (
          <button onClick={() => { navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {}); }}>
            {copied ? "copied ✓" : "copy"}
          </button>
        )}
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }): ReactNode {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h": return b.level === 2 ? <h2 key={i} id={b.id}>{b.text}</h2> : <h3 key={i} id={b.id}>{b.text}</h3>;
          case "p": return <p key={i}><Inline text={b.text} /></p>;
          case "ul": return <ul key={i}>{b.items.map((it: any, j: number) => <li key={j}><Inline text={it.text} /></li>)}</ul>;
          case "ol": return <ol key={i}>{b.items.map((it: any, j: number) => <li key={j}><Inline text={it.text} /></li>)}</ol>;
          case "code": return <CodeBlock key={i} code={b.code} lang={b.lang} />;
          case "callout":
            return (
              <aside key={i} className={"callout " + (b.kind || "note")}>
                <div className="ctitle">{b.title || b.kind}</div>
                <Blocks blocks={b.blocks || []} />
              </aside>
            );
          case "table":
            return (
              <div key={i} className="tablewrap"><table>
                <thead><tr>{b.head.map((h: string, j: number) => <th key={j}>{h}</th>)}</tr></thead>
                <tbody>{b.rows.map((r: string[], j: number) => <tr key={j}>{r.map((c, k) => <td key={k}><Inline text={c} /></td>)}</tr>)}</tbody>
              </table></div>
            );
          case "cmd":
            return (
              <details key={i} className="cmdcard">
                <summary><code className="cmdname">{b.name}</code><span className="cmdsum"><Inline text={b.sum} /></span></summary>
                {b.syntax && <CodeBlock code={b.syntax} lang="syntax" />}
                {b.how && <Blocks blocks={b.how} />}
              </details>
            );
          case "anatomy":
            return (
              <div key={i} className="anatomy">
                <div className="ctitle">{b.title}</div>
                <div className="atoks">{b.tokens.map((t: any, j: number) => (
                  <div key={j} className="atok"><code>{String(t.tok).replace(/\{\{(\w+)\}\}/g, "$1")}</code><span>{t.exp}</span></div>
                ))}</div>
              </div>
            );
          case "exercise":
          case "checkpoint":
          case "project":
          case "widget":
            return (
              <div key={i} className="stub">
                <span className="stubtag">{b.t}</span> <b>{b.title || b.name}</b>
                <span className="muted"> — runs in the classic site (<code>dist/index.html</code>); native version coming to this app.</span>
              </div>
            );
          default: return null;
        }
      })}
    </>
  );
}
