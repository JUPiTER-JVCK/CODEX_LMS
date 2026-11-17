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

## Apple app (macOS, iPadOS, iOS)

`apple/` holds a native SwiftUI app with the same book. It has a native sidebar with progress per chapter,
native search over chapters, sections and all command cards, back/forward, a section menu and an appearance
setting. The pages show in a web view, so in-page Python, JavaScript playgrounds, labs and the practice terminal
all work offline. Progress is saved by the app (Application Support), not by the browser.

**Ready-built Mac app:** every CI run uploads `CODEX_LMS-mac` (a zip with a universal `CODEX_LMS.app`). Open the
run under the repository's Actions tab, download it from Artifacts, unzip, and move the app to Applications. It is
not notarized, so the first time you open it macOS blocks it: open System Settings → Privacy & Security and click
**Open Anyway** (or run `xattr -dr com.apple.quarantine /Applications/CODEX_LMS.app`).

**Build it yourself** (also the way to run it on an iPhone or iPad). Needs Xcode 16 or later and [XcodeGen](https://github.com/yonaskolb/XcodeGen):

    python3 tools/chapters.py && python3 tools/build.py   # the app bundles dist/
    brew install xcodegen
    cd apple && xcodegen && open CODEX_LMS.xcodeproj

Pick the CODEX_LMS scheme and run on My Mac, an iPad or an iPhone. `swift test --package-path apple` runs the
tests for `CodexCore` (table of contents, saved progress, search) on macOS or Linux.

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
| `dist/` | the built site: `index.html`, `toc.json` (contents for the Apple app) and the Python runtime in `py/` |
| `src/app.add.css` | hides the page's own sidebar and toolbar when it runs inside the Apple app |
| `apple/project.yml` | XcodeGen spec for the multiplatform app |
| `apple/Sources/CodexCore/` | Swift models for `toc.json` and saved progress, and search; tests in `apple/Tests/` |
| `apple/App/` | SwiftUI app: sidebar, search, web view, `codex://` scheme handler and the page bridge |

## Build and test

Needs Python 3 and Playwright, pinned to the version CI uses (`python3 -m pip install playwright==1.63.0 && python3 -m playwright install chromium`).

    python3 tools/chapters.py      # chapters/*.py -> data/new/*.json
    python3 tools/build.py         # -> dist/index.html, dist/toc.json (and pub.html for the Claude artifact host)
    (cd dist && python3 -m http.server 8765 &)
    python3 test/blocks.py servers apis crypto cloud wireshark defend
    python3 test/pcapfilters.py    # needs node and tshark (apt install tshark, or brew install wireshark)

Add `--update` to `test/blocks.py` after changing code in a chapter to record its new real output. After changing a
capture scenario in `src/ws-5-pcap.js`, run `python3 tools/pcapcols.py` (needs `tshark`) to refresh the column text,
then `test/pcapfilters.py`.

## License

MIT, see `LICENSE`. The bundled Pyodide runtime in `dist/py/` keeps its own license (MPL-2.0).
