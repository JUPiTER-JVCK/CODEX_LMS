// Terminal labs: small interactive views that live inside the chapters that teach them.

import type { KeyEvent } from "./input.ts";
import type { HitMap, Painter, Rect } from "./ui.ts";

export interface LabCtx {
  p: Painter;
  /** Where the lab draws (already clipped to the visible part of the reader). */
  r: Rect;
  hits: HitMap;
  /** The lab has keyboard focus (it was clicked or Entered). */
  focus: boolean;
  hoverId: string | null;
  now: number;
  /** Ask the app to redo the layout (the lab changed height). */
  relayout(): void;
  toast(msg: string): void;
  /** Make the lab take keyboard focus. */
  grab(): void;
}

export interface Lab {
  /** Rows the lab needs at this width and state. */
  rows(width: number, st: any): number;
  init(args: any): any;
  draw(c: LabCtx, st: any): void;
  /** Keys while focused; return true when handled. */
  key?(e: KeyEvent, st: any, c: { relayout(): void; toast(m: string): void }): boolean;
  /** Animated labs say so, so the app keeps its frame timer running. */
  animated?(st: any): boolean;
}

export const LABS: Record<string, Lab> = {};
export const register = (name: string, lab: Lab) => { LABS[name] = lab; };
