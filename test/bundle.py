"""The single file CODEX_LMS.html: as a page (file:// and http://), with Python, offline; and under node.

usage: python3 test/bundle.py path/to/CODEX_LMS.html
"""
import os, subprocess, sys, tempfile, hashlib
from playwright.sync_api import sync_playwright

F = os.path.abspath(sys.argv[1])
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
bad = []
def check(c, m):
    print('ok  ' if c else 'FAIL', m)
    if not c: bad.append(m)

with sync_playwright() as p:
    b = p.chromium.launch()
    for url in ['file://' + F + '#computers']:
        pg = b.new_page(); errs = []; seen = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('request', lambda r: seen.append(r.url))
        pg.goto(url, wait_until='load'); pg.wait_for_selector('#page', timeout=20000); pg.wait_for_timeout(800)
        check('How Computers Work' in pg.inner_text('body'), 'the page boots from the single file')
        check(pg.evaluate("document.compatMode") == 'CSS1Compat', 'standards mode (the leading comment did not trigger quirks)')
        r = pg.evaluate("window.__py.run('print(2**10)')")
        check(r['status'] == 'ok' and r['out'].strip() == '1024', 'embedded Python runs from file:// -> %r' % r)
        out = sorted({u[:60] for u in seen if not u.startswith(('file:', 'blob:', 'data:', 'about:'))})
        check(not out, 'nothing leaves the file %s' % out)
        check(not errs, 'no page errors %s' % errs)
        pg.click('text=Other ways to open this'); 
        check('node CODEX_LMS.html' in pg.inner_text('body'), 'the panel explains the terminal and Mac modes')
        pg.close()
    b.close()

def node(*a, **k): return subprocess.run(['node', F, *a], capture_output=True, timeout=60, **k)
r = node('--list'); check(r.returncode == 0 and b'How Computers Work' in r.stdout, 'node FILE --list')
r = node('--help'); check(b'one file that is three things' in r.stdout, 'node FILE --help')
d = tempfile.mkdtemp(); r = node('--extract', d)
check(hashlib.sha256(open(os.path.join(d, 'index.html'), 'rb').read()).digest() == hashlib.sha256(open(os.path.join(ROOT, 'dist/index.html'), 'rb').read()).digest(), 'extracted page is byte-identical to dist/index.html')
check(os.path.exists(os.path.join(d, 'py/pyodide.asm.wasm')), 'extract writes the python runtime')
r = node('--app'); check(r.returncode == 1 and (b'only runs on macOS' in r.stderr or b'without the Mac app' in r.stderr), '--app explains itself off macOS / without an app')
r = subprocess.run([sys.executable, os.path.join(ROOT, 'apps/tui/test/e2e_pty.py'), F], capture_output=True, text=True, timeout=300)
check(r.returncode == 0, 'the terminal app inside the file passes the full pty test: ' + ' '.join(l for l in r.stdout.splitlines() if l.startswith('FAIL')))
sys.exit(1 if bad else 0)
