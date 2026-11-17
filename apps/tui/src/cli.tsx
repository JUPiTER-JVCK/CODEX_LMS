#!/usr/bin/env -S npx tsx
import React from "react";
import { render } from "ink";
import { App } from "./App.js";

if (!process.stdout.isTTY) {
  console.error("codex: needs an interactive terminal (a TTY).");
  process.exit(1);
}
// Alternate screen: the app owns the whole window and restores your shell on exit.
process.stdout.write("\x1b[?1049h\x1b[?25l");
const restore = () => process.stdout.write("\x1b[?25h\x1b[?1049l");
process.on("exit", restore);
const app = render(<App />, { exitOnCtrlC: true });
app.waitUntilExit().then(() => process.exit(0));
