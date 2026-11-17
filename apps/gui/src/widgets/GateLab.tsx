import { useState } from "react";
import { motion } from "framer-motion";
import { GATES, GATE_BLURB, GateKind, Bit, evalGate, isUnary, truthTable, fullAdder } from "@codex/widgets";

const FILL = "var(--accent)";
const OFF = "var(--wire-off)";

/** Right edge of each gate body (relative to the gate's own origin) and whether it has an output bubble. */
function geom(g: GateKind) {
  const end = g === "AND" || g === "NAND" ? 54 : g === "NOT" || g === "BUFFER" ? 50 : 58;
  const bubble = g === "NAND" || g === "NOR" || g === "XNOR" || g === "NOT";
  return { end, bubble, wireStart: 150 + end + (bubble ? 10 : 0) };
}

function GateShape({ g }: { g: GateKind }) {
  const stroke = "var(--text)";
  const body =
    g === "AND" || g === "NAND" ? "M0,0 H28 A26,26 0 0 1 28,52 H0 Z"
    : g === "OR" || g === "NOR" || g === "XOR" || g === "XNOR" ? "M0,0 Q30,0 58,26 Q30,52 0,52 Q14,26 0,0 Z"
    : "M0,0 L50,26 L0,52 Z";
  const { bubble, end } = geom(g);
  return (
    <g transform="translate(150,34)">
      <path d={body} fill="var(--panel-solid)" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      {(g === "XOR" || g === "XNOR") && <path d="M-9,0 Q5,26 -9,52" fill="none" stroke={stroke} strokeWidth="2.5" />}
      {bubble && <circle cx={end + 5} cy="26" r="5" fill="var(--panel-solid)" stroke={stroke} strokeWidth="2.5" />}
    </g>
  );
}

function Wire({ d, on }: { d: string; on: boolean }) {
  return (
    <motion.path d={d} fill="none" strokeWidth="4" strokeLinecap="round" animate={{ stroke: on ? FILL : OFF }} transition={{ duration: 0.2 }}
      style={{ filter: on ? "drop-shadow(0 0 5px var(--accent))" : "none" }} />
  );
}

export function GateLab() {
  const [g, setG] = useState<GateKind>("AND");
  const [a, setA] = useState<Bit>(1);
  const [b, setB] = useState<Bit>(0);
  const [mode, setMode] = useState<"gate" | "adder">("gate");
  const [cin, setCin] = useState<Bit>(0);
  const un = isUnary(g);
  const out = evalGate(g, a, b);
  const rows = truthTable(g);
  const add = fullAdder(a, b, cin);
  return (
    <div className="widget">
      <div className="widget-head">
        <h3>Logic gate lab</h3>
        <div className="seg">
          <button className={mode === "gate" ? "active" : ""} onClick={() => setMode("gate")}>Gates</button>
          <button className={mode === "adder" ? "active" : ""} onClick={() => setMode("adder")}>Full adder</button>
        </div>
      </div>

      {mode === "gate" ? (
        <>
          <div className="chips">
            {GATES.map((k) => (
              <button key={k} className={"chip btn" + (k === g ? " active" : "")} onClick={() => setG(k)}>{k}</button>
            ))}
          </div>
          <p className="muted">{GATE_BLURB[g]}</p>
          <svg viewBox="0 0 400 120" className="circuit" role="img" aria-label={`${g} gate with inputs ${a}${un ? "" : b} giving ${out}`}>
            <Wire d={un ? "M40,60 H150" : "M40,38 H100 V50 H150"} on={a === 1} />
            {!un && <Wire d="M40,82 H100 V70 H150" on={b === 1} />}
            <GateShape g={g} />
            <Wire d={`M${geom(g).wireStart},60 H330`} on={out === 1} />
            <motion.circle cx="352" cy="60" r="16" animate={{ fill: out ? FILL : "transparent", stroke: out ? FILL : OFF }} strokeWidth="3"
              style={{ filter: out ? "drop-shadow(0 0 10px var(--accent))" : "none" }} />
            <text x="352" y="66" textAnchor="middle" className="ioval" fill={out ? "#fff" : "var(--text)"}>{out}</text>
          </svg>
          <div className="btnrow center">
            <Toggle label="A" v={a} set={setA} />
            {!un && <Toggle label="B" v={b} set={setB} />}
          </div>
          <table className="truth">
            <thead><tr><th>A</th>{!un && <th>B</th>}<th>Y</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const hit = r.a === a && (un || r.b === b);
                return (
                  <tr key={`${r.a}${r.b}`} className={hit ? "hit" : ""}>
                    <td>{r.a}</td>{!un && <td>{r.b}</td>}<td className="y">{r.out}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <p className="muted">A full adder adds three bits: A, B and a carry in. It is two half adders (XOR + AND) and an OR. Chain eight of them and you have an 8-bit adder: the heart of a CPU's ALU.</p>
          <div className="btnrow center">
            <Toggle label="A" v={a} set={setA} />
            <Toggle label="B" v={b} set={setB} />
            <Toggle label="Cin" v={cin} set={setCin} />
          </div>
          <div className="adder-out">
            <motion.div className={"lamp" + (add.sum ? " on" : "")} animate={{ scale: add.sum ? 1.08 : 1 }}>
              <span>Sum</span><b>{add.sum}</b>
            </motion.div>
            <motion.div className={"lamp" + (add.carry ? " on" : "")} animate={{ scale: add.carry ? 1.08 : 1 }}>
              <span>Carry out</span><b>{add.carry}</b>
            </motion.div>
            <div className="equation mono">{a} + {b} + {cin} = <b>{add.carry}{add.sum}</b> <span className="muted">({a + b + cin} in decimal)</span></div>
          </div>
        </>
      )}
    </div>
  );
}

function Toggle({ label, v, set }: { label: string; v: Bit; set: (b: Bit) => void }) {
  return (
    <button className={"bigtoggle" + (v ? " on" : "")} onClick={() => set((v ^ 1) as Bit)} aria-pressed={!!v}>
      <span>{label}</span><b>{v}</b>
    </button>
  );
}
