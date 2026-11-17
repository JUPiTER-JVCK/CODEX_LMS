# CODEX_LMS

A hands-on, book-style course for learning on a Mac: macOS Terminal (zsh), networking, Python, web development
(HTML, CSS, JavaScript, DevTools, DOM, XML, Node.js) and servers, APIs, encryption and cloud. It is one
self-contained web page with runnable Python and JavaScript, a simulated terminal, interactive labs, exercises
with automatic checks, quizzes and projects.

- 47 chapters in 9 parts, 776 command cards
- Python runs in the browser (Pyodide); JavaScript runs in a sandbox with a built-in practice REST API
- Dark and light themes, works on phones

## Read it locally

    cd dist
    python3 -m http.server 8765

Then open http://localhost:8765/index.html. Opening `index.html` by double-clicking works for reading, but the
in-page Python needs to be served over HTTP.

## Project layout

| Path | What it is |
|---|---|
| `data/book.json` | chapters 00-37 and 42-44 plus reference pages, as parsed JSON |
| `chapters/ch_*.py` | chapters 38-41 (Servers, APIs & Cloud), written with the helpers in `chapters/lib.py` |
| `data/outcache.json` | real outputs of every runnable block in chapters 38-41 |
| `src/engine.js` | page engine: rendering, navigation, search, progress, runners, earlier widgets |
| `src/ws-*.js`, `src/srv.add.css` | labs for chapters 38-41 |
| `src/sim.js`, `src/sbsrc.js` | simulated zsh, and the sandbox injected into every JavaScript playground |
| `src/style.css`, `src/head.html` | styles and page head |
| `tools/chapters.py`, `tools/build.py` | build chapter JSON, then assemble the single-file page |
| `test/blocks.py` | runs every code block and exercise of the given chapters inside the real page |
| `dist/` | the built site: `index.html` plus the Python runtime in `py/` |

## Build and test

Needs Python 3 and Playwright (`python3 -m pip install playwright && python3 -m playwright install chromium`).

    python3 tools/chapters.py      # chapters/*.py -> data/new/*.json
    python3 tools/build.py         # -> dist/index.html (and pub.html for the Claude artifact host)
    (cd dist && python3 -m http.server 8765 &)
    python3 test/blocks.py servers apis crypto cloud

Add `--update` to `test/blocks.py` after changing code in a chapter to record its new real output.
