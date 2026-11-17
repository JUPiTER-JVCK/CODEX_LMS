import React, { createContext, useContext, useEffect, useRef } from "react";
import { useInput, useStdout, type DOMElement } from "ink";

/**
 * Mouse support for Ink. Ink has no mouse API, so we turn on SGR mouse reporting and parse the escape
 * sequences that arrive through Ink's own input hook (adding a second stdin listener would fight Ink for the stream).
 * Click targets register their on-screen rectangles, computed from Ink's yoga layout.
 */
interface Region { node: DOMElement; onClick: (col: number, row: number) => void }
interface Ctx { regions: Map<string, Region>; wheel: { current: ((dir: -1 | 1, col: number) => void) | null } }
const MouseCtx = createContext<Ctx | null>(null);

const MOUSE_RE = /\[<(\d+);(\d+);(\d+)([Mm])/g;
export const isMouseInput = (s: string) => /\[<\d+;\d+;\d+[Mm]/.test(s);

function rectOf(node: DOMElement) {
  let x = 0, y = 0;
  for (let n: DOMElement | undefined = node; n; n = n.parentNode) {
    const yn = (n as any).yogaNode;
    if (yn) { x += yn.getComputedLeft(); y += yn.getComputedTop(); }
  }
  const yn = (node as any).yogaNode;
  return { x, y, w: yn ? yn.getComputedWidth() : 0, h: yn ? yn.getComputedHeight() : 0 };
}

export function MouseProvider({ children }: { children: React.ReactNode }) {
  const ctx = useRef<Ctx>({ regions: new Map(), wheel: { current: null } });
  const { stdout } = useStdout();
  useEffect(() => {
    stdout.write("\x1b[?1000h\x1b[?1006h");
    return () => { stdout.write("\x1b[?1006l\x1b[?1000l"); };
  }, [stdout]);
  useInput((input) => {
    if (!isMouseInput(input)) return;
    for (const m of input.matchAll(MOUSE_RE)) {
      const code = Number(m[1]), col = Number(m[2]) - 1, row = Number(m[3]) - 1;
      if (code === 64 || code === 65) { ctx.current.wheel.current?.(code === 64 ? -1 : 1, col); continue; }
      if (m[4] !== "M" || (code & 3) !== 0 || code >= 32) continue; // left button press only
      // innermost target wins: the smallest rectangle containing the pointer
      const hits = [...ctx.current.regions.values()].map((r) => ({ r, b: rectOf(r.node) })).filter(({ b }) =>
        col >= b.x && col < b.x + b.w && row >= b.y && row < b.y + b.h);
      hits.sort((p, q) => p.b.w * p.b.h - q.b.w * q.b.h);
      hits[0]?.r.onClick(col, row);
    }
  });
  return <MouseCtx.Provider value={ctx.current}>{children}</MouseCtx.Provider>;
}

/** Attach to a <Box ref={...}>: clicks inside it call onClick. */
export function useClickable(id: string, onClick: (col: number, row: number) => void) {
  const ctx = useContext(MouseCtx)!;
  const ref = useRef<DOMElement>(null);
  const cb = useRef(onClick); cb.current = onClick;
  useEffect(() => {
    if (ref.current) ctx.regions.set(id, { node: ref.current, onClick: (c, r) => cb.current(c, r) });
    return () => { ctx.regions.delete(id); };
  });
  return ref;
}

export function useWheel(handler: (dir: -1 | 1, col: number) => void) {
  const ctx = useContext(MouseCtx)!;
  const h = useRef(handler); h.current = handler;
  useEffect(() => {
    ctx.wheel.current = (d, c) => h.current(d, c);
    return () => { ctx.wheel.current = null; };
  }, [ctx]);
}

export function Clickable({ id, onClick, children, ...box }: { id: string; onClick: (c: number, r: number) => void; children: React.ReactNode } & Record<string, any>) {
  const ref = useClickable(id, onClick);
  return <BoxLike ref={ref} {...box}>{children}</BoxLike>;
}
import { Box } from "ink";
const BoxLike = Box as any;
