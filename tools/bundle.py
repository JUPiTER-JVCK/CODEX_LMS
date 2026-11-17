#!/usr/bin/env python3
"""Assemble CODEX_LMS.html: one file that is the web page, the terminal app and (optionally) the Mac app.

  browser            the page; Python works even from file:// (the runtime is embedded)
  node FILE.html     the terminal app, plus --html / --app / --extract (see --help inside)

Layout: an HTML comment that is also a JavaScript comment holds the Node launcher; the page part is
also one big JavaScript block comment, so it must contain no "*/". Everything is ASCII.

usage: python3 tools/bundle.py [--tui apps/tui/dist/codex-tui.mjs] [--app CODEX_LMS-mac.zip] [--no-python] [--out dist/CODEX_LMS.html]
"""
import argparse, base64, gzip, json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
rd = lambda p, m='rb': open(p, m).read()


def gz(b):
    return gzip.compress(b, 9, mtime=0)


def b64(b):
    s = base64.b64encode(b).decode('ascii')
    return '\n'.join(s[i:i + 100] for i in range(0, len(s), 100))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tui', default=P('apps/tui/dist/codex-tui.mjs'))
    ap.add_argument('--app')
    ap.add_argument('--no-python', action='store_true')
    ap.add_argument('--out', default=P('dist/CODEX_LMS.html'))
    a = ap.parse_args()
    if not os.path.exists(a.tui):
        sys.exit('missing %s: run npm run tui:build first' % a.tui)
    version = json.load(open(P('package.json')))['version']
    pieces = {'page': ('gz', rd(P('dist/index.html'))), 'tui': ('gz', rd(a.tui))}
    py = [] if a.no_python else sorted(os.listdir(P('dist/py')))
    for n in py:
        pieces['py/' + n] = ('gz', rd(P('dist/py', n)))
    if a.app:
        pieces['app'] = ('raw', rd(a.app))
    meta = {'version': version, 'py': py, 'parts': {k: len(v[1]) for k, v in pieces.items()}}
    scripts = '<script type="text/plain" id="p:meta">%s</script>\n' % json.dumps(meta, sort_keys=True)
    for k in sorted(pieces):
        kind, data = pieces[k]
        scripts += '<script type="text/plain" id="p:%s">%s</script>\n' % (k, b64(gz(data) if kind == 'gz' else data))
    launcher = rd(P('tools/bundle/launcher.js'), 'r')
    shell = ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n'
             '<title>CODEX_LMS</title><style>html{background:#09090b;color:#a1a1aa;font:15px system-ui,sans-serif}body{margin:40px}</style></head>\n'
             '<body>Loading CODEX_LMS...\n' + scripts + '<script>\n' + rd(P('tools/bundle/inflate.min.js'), 'r') + '\n' + rd(P('tools/bundle/loader.js'), 'r') + '</script>\n</body></html>\n')
    out = '<!--\n' + launcher + '/*\n-->\n' + shell + '<!-- */ -->\n'
    # the two languages must both still parse
    assert '-->' not in launcher and '--!>' not in launcher, 'launcher contains an HTML comment end'
    assert '*/' not in shell, 'page part contains a JavaScript comment end'
    bad = [c for c in out if ord(c) > 127]
    assert not bad, 'non-ASCII character in the bundle: %r' % bad[:3]
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    open(a.out, 'w', newline='\n').write(out)
    # parse it as JavaScript exactly as node will
    if subprocess.run(['node', '-e', "new (require('vm').Script)(require('fs').readFileSync(process.argv[1],'utf8'))", a.out]).returncode:
        sys.exit('node cannot parse the bundle')
    print('wrote %s: %.1f MB (page, terminal app%s%s)' % (os.path.relpath(a.out, ROOT), len(out) / 1e6, '' if a.no_python else ', python runtime', ', Mac app' if a.app else ''))


main()
