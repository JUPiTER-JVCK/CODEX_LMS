# CODEX_LMS

A hands-on book of networking, zsh, Python and web development for macOS Terminal, PyCharm and the browser (originally titled "Prompt, Packet, Python").

## Run it

It is a static site. Serve the folder and open `index.html`:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000. The Python exercises run in-browser via the bundled Pyodide runtime in `py/`, so they need to be served over HTTP (not opened as a `file://` URL).

## Layout

- `index.html` – the whole book (content, styles, interactive widgets)
- `py/` – Pyodide runtime and worker used by the Python exercises
