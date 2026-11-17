import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { bitsInit, toggleBit, increment, decrement, shiftLeft, shiftRight, invert, setValue, bitArray, bitsView } from "@codex/widgets";

export function BinaryCounter() {
  const [s, setS] = useState(() => bitsInit(8, 5));
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setS((p) => increment(p)), 420);
    return () => clearInterval(t);
  }, [auto]);
  const bits = bitArray(s);
  const v = bitsView(s);
  return (
    <div className="widget">
      <div className="widget-head">
        <h3>Binary counter</h3>
        <span className="chip">{s.width}-bit register</span>
      </div>
      <p className="muted">Flip the switches. Each one is worth double the one to its right, and the number is just the sum of the ones that are on.</p>

      <div className="bitrow" role="group" aria-label="bits">
        {bits.map((b, i) => {
          const idx = s.width - 1 - i;
          return (
            <div key={idx} className="bitcol">
              <span className="place">{2 ** idx}</span>
              <button className={"switch" + (b ? " on" : "")} onClick={() => setS(toggleBit(s, idx))} aria-pressed={!!b} aria-label={`bit ${idx}`}>
                <motion.span className="knob" layout transition={{ type: "spring", stiffness: 600, damping: 32 }} />
              </button>
              <motion.span key={b} className="bitval" initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{b}</motion.span>
              <span className="sum">{b ? `+${2 ** idx}` : "·"}</span>
            </div>
          );
        })}
      </div>

      <div className="readouts">
        <Readout label="decimal" value={String(v.dec)} />
        <Readout label="hex" value={v.hex} />
        <Readout label="binary" value={v.bin} mono />
        <Readout label="signed (two's complement)" value={String(v.signed)} warn={v.signed < 0} />
      </div>

      <AnimatePresence>
        {s.overflow && (
          <motion.div className="banner warn" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            ⚠ Overflow: the result did not fit in {s.width} bits, so it wrapped around. This is how the Year 2038 bug works.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="btnrow">
        <button onClick={() => setS(increment(s))}>+1</button>
        <button onClick={() => setS(decrement(s))}>−1</button>
        <button onClick={() => setS(shiftLeft(s))}>≪ shift</button>
        <button onClick={() => setS(shiftRight(s))}>≫ shift</button>
        <button onClick={() => setS(invert(s))}>NOT</button>
        <button onClick={() => setS(setValue(s, 127))}>127</button>
        <button onClick={() => setS(setValue(s, 255))}>255</button>
        <button onClick={() => setS(setValue(s, 0))}>clear</button>
        <button className={auto ? "primary" : ""} onClick={() => setAuto(!auto)}>{auto ? "■ stop" : "▶ count"}</button>
      </div>
    </div>
  );
}

function Readout({ label, value, mono, warn }: { label: string; value: string; mono?: boolean; warn?: boolean }) {
  return (
    <div className={"readout" + (warn ? " warn" : "")}>
      <span className="label">{label}</span>
      <motion.span key={value} className={mono ? "val mono" : "val"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>{value}</motion.span>
    </div>
  );
}
