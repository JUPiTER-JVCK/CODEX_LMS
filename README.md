# CODEX_LMS

A hands-on, book-style course for learning on a Mac: macOS Terminal (zsh), networking, Python, web development
(HTML, CSS, JavaScript, DevTools, DOM, XML, Node.js), servers, APIs, encryption and cloud, and security
(Wireshark packet analysis, hardening, log triage and incident response). It is one
self-contained web page with runnable Python and JavaScript, a simulated terminal, interactive labs, exercises
with automatic checks, quizzes and projects.

- 49 chapters in 10 parts, 787 command cards
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
| `data/book.json` | chapters 00-37 and 44-46 plus reference pages, as parsed JSON |
| `chapters/ch_*.py` | chapters 38-41 (Servers, APIs & Cloud) and 42-43 (Security), written with the helpers in `chapters/lib.py` |
| `data/outcache.json` | real outputs of every runnable block in chapters 38-43 |
| `src/engine.js` | page engine: rendering, navigation, search, progress, runners, earlier widgets |
| `src/ws-*.js`, `src/*.add.css` | labs for chapters 38-43; `ws-5-pcap.js` is the packet engine (encoder, dissector, display-filter engine) behind the Wireshark lab |
| `tools/pcapgen.js`, `tools/pcapcols.py` | write the lab captures as real `.pcap` files, and bake Wireshark's own column text into `src/ws-6-pcapcols.js` |
| `src/sim.js`, `src/sbsrc.js` | simulated zsh, and the sandbox injected into every JavaScript playground |
| `src/style.css`, `src/head.html` | styles and page head |
| `tools/chapters.py`, `tools/build.py` | build chapter JSON, then assemble the single-file page |
| `test/blocks.py` | runs every code block and exercise of the given chapters inside the real page |
| `test/pcapfilters.py` | checks the lab's display-filter engine against real `tshark` on the same captures |
| `dist/` | the built site: `index.html` plus the Python runtime in `py/` |

## Build and test

Needs Python 3 and Playwright, pinned to the version CI uses (`python3 -m pip install playwright==1.63.0 && python3 -m playwright install chromium`).

    python3 tools/chapters.py      # chapters/*.py -> data/new/*.json
    python3 tools/build.py         # -> dist/index.html (and pub.html for the Claude artifact host)
    (cd dist && python3 -m http.server 8765 &)
    python3 test/blocks.py servers apis crypto cloud wireshark defend
    python3 test/pcapfilters.py    # needs node and tshark (apt install tshark, or brew install wireshark)

Add `--update` to `test/blocks.py` after changing code in a chapter to record its new real output. After changing a
capture scenario in `src/ws-5-pcap.js`, run `python3 tools/pcapcols.py` (needs `tshark`) to refresh the column text,
then `test/pcapfilters.py`.

## License

MIT, see `LICENSE`. The bundled Pyodide runtime in `dist/py/` keeps its own license (MPL-2.0).
