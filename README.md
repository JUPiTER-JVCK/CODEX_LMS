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

## Apple app (macOS, iPadOS, iOS)

`apple/` holds a native SwiftUI app with the same book. It has a native sidebar with progress per chapter,
native search over chapters, sections and all command cards, back/forward, a section menu and an appearance
setting. The pages show in a web view, so in-page Python, JavaScript playgrounds, labs and the practice terminal
all work offline. Progress is saved by the app (Application Support), not by the browser.

Needs Xcode 16 or later and [XcodeGen](https://github.com/yonaskolb/XcodeGen):

    python3 tools/chapters.py && python3 tools/build.py   # the app bundles dist/
    brew install xcodegen
    cd apple && xcodegen && open CODEX_LMS.xcodeproj

Pick the CODEX_LMS scheme and run on My Mac, an iPad or an iPhone. `swift test --package-path apple` runs the
tests for `CodexCore` (table of contents, saved progress, search) on macOS or Linux.

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
    python3 test/blocks.py servers apis crypto cloud

Add `--update` to `test/blocks.py` after changing code in a chapter to record its new real output.

## License

MIT, see `LICENSE`. The bundled Pyodide runtime in `dist/py/` keeps its own license (MPL-2.0).
