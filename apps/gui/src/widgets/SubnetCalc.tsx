import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { parseCidr, subnetInfo, splitSubnet, fmtIPv4 } from "@codex/widgets";

export function SubnetCalc() {
  const [text, setText] = useState("192.168.1.130/26");
  const [extra, setExtra] = useState(0);
  const parsed = parseCidr(text);
  const info = useMemo(() => (parsed ? subnetInfo(parsed.ip, parsed.prefix) : null), [text]);
  const kids = useMemo(() => (parsed && extra ? splitSubnet(`${fmtIPv4(parsed.ip)}/${parsed.prefix}`, extra) : []), [text, extra]);

  const setPrefix = (p: number) => parsed && setText(`${fmtIPv4(parsed.ip)}/${p}`);

  return (
    <div className="widget">
      <div className="widget-head">
        <h3>Subnet calculator</h3>
        <span className="chip">IPv4 · CIDR</span>
      </div>
      <p className="muted">Type an address with a prefix, or drag the slider to move the line between the network part and the host part.</p>
      <div className="inputrow">
        <input className={"cidr mono" + (parsed ? "" : " bad")} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="address/prefix" />
        <input type="range" min={0} max={32} value={parsed?.prefix ?? 24} onChange={(e) => setPrefix(Number(e.target.value))} aria-label="prefix length" />
        <span className="chip">/{parsed?.prefix ?? "?"}</span>
      </div>

      {info ? (
        <>
          <div className="bitstrip mono" aria-label="address bits">
            {info.ipBinary.split("").map((c, i) => {
              if (c === ".") return <span key={i} className="sep">.</span>;
              const pos = i - Math.floor(i / 9);
              const net = pos < info.prefix;
              return (
                <motion.span key={i} layout className={"bit " + (net ? "net" : "host")} animate={{ opacity: 1 }} initial={{ opacity: 0.4 }}>{c}</motion.span>
              );
            })}
          </div>
          <div className="legend"><span className="sw net" /> network ({info.networkBits} bits) <span className="sw host" /> host ({info.hostBits} bits)</div>
          <div className="grid2">
            {([
              ["Network", info.network], ["Broadcast", info.broadcast], ["Subnet mask", info.mask], ["Wildcard", info.wildcard],
              ["First host", info.firstHost], ["Last host", info.lastHost],
              ["Usable hosts", info.hosts.toLocaleString()], ["Class / scope", `${info.cls} · ${info.scope}`],
            ] as const).map(([k, v]) => (
              <div className="readout" key={k}>
                <span className="label">{k}</span>
                <motion.span key={v} className="val mono" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>{v}</motion.span>
              </div>
            ))}
          </div>
          <div className="btnrow">
            <span className="muted">Split into</span>
            {[0, 1, 2, 3].map((n) => (
              <button key={n} className={extra === n ? "primary" : ""} onClick={() => setExtra(n)} disabled={info.prefix + n > 30}>
                {n === 0 ? "none" : `${2 ** n} subnets`}
              </button>
            ))}
          </div>
          <AnimatePresence>
            {kids.length > 0 && (
              <motion.div className="kids" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                {kids.map((k, i) => (
                  <motion.div key={k.network} className="kid" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                    <b className="mono">{k.network}/{k.prefix}</b>
                    <span className="muted mono">{k.firstHost} – {k.lastHost}</span>
                    <span className="chip">{k.hosts} hosts</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className="banner warn">Enter an address like <code>10.0.0.0/8</code> (four numbers 0–255, a slash, then 0–32).</div>
      )}
    </div>
  );
}
