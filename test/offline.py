"""Opening the book must not contact anything: no font servers, no CDNs, no analytics.

Records every request the page makes while it loads and while a chapter, a lab and the theme button are used,
and fails on anything that is not served from the page's own origin (or data:/blob:). Also checks that the
bundled fonts really are the ones in use, so removing the web-font link did not just fall back silently.

usage: python3 test/offline.py        (needs dist/ served on http://localhost:8765)
"""
import sys
from playwright.sync_api import sync_playwright

ORIGIN = 'http://localhost:8765/'

def main():
    bad = []
    def check(cond, msg):
        print('ok  ' if cond else 'FAIL', msg)
        if not cond: bad.append(msg)
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context()
        pg = ctx.new_page()
        seen = []
        pg.on('request', lambda r: seen.append(r.url))
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(ORIGIN + 'index.html#computers', wait_until='networkidle'); pg.wait_for_timeout(700)
        fonts = pg.evaluate("""Promise.all([document.fonts.load('15px Inter'), document.fonts.load('13px "JetBrains Mono"')])
            .then(a => a.map(x => x.length))""")
        check(all(n > 0 for n in fonts), 'Inter and JetBrains Mono are bundled and load (%s)' % fonts)
        faces = pg.evaluate("[...document.fonts].map(f => f.family.replace(/\"/g,'') + ':' + f.status)")
        check(all(s.endswith(':loaded') for s in faces) and len(faces) >= 2, 'every bundled font face is loaded: %s' % faces)
        pg.click('#theme'); pg.wait_for_timeout(200)          # theme button
        pg.goto(ORIGIN + 'index.html#py-basics', wait_until='networkidle'); pg.wait_for_timeout(500)   # another chapter
        outside = sorted({u for u in seen if not (u.startswith(ORIGIN) or u.startswith('data:') or u.startswith('blob:') or u.startswith('about:'))})
        check(not outside, 'no request leaves the page origin %s' % outside)
        check(any(u.startswith(ORIGIN + 'index.html') for u in seen), 'the recorder saw the page itself (%d request(s) in total)' % len(seen))
        check(not errs, 'no page errors ' + str(errs))
        b.close()
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
