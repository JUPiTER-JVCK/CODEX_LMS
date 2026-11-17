# Desktop shell (Tauri 2)

The window wraps the React app in `../src`. Not compiled in CI yet.

```sh
# one-time: Rust toolchain + platform deps (https://tauri.app/start/prerequisites/)
cd apps/gui
npx tauri icon path/to/1024x1024.png   # generates src-tauri/icons/
npm run tauri dev                      # native window with hot reload
npm run tauri build                    # installer / .app / .msi
```

`titleBarStyle: Overlay` gives the macOS traffic-light look; the app's top bar is already a drag region
(`data-tauri-drag-region`). For in-place upgrades add `tauri-plugin-updater` (signing key + manifest URL).
