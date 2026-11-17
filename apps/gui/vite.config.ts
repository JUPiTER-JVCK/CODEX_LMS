import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Tauri expects a fixed dev port and relative asset paths in the built bundle.
export default defineConfig({
  plugins: [react()],
  base: "./",
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    // content/ lives at the monorepo root, outside this app
    fs: { allow: [path.resolve(__dirname, "../..")] },
  },
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
});
