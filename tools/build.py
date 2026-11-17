#!/usr/bin/env python3
"""Assemble the single-file book.

Inputs (all under the project root):
  src/head.html     title, meta and font links (everything before <style>)
  src/style.css     base stylesheet; src/*.add.css files are appended in name order
  src/sim.js        simulated zsh
  src/sbsrc.js      source injected into every sandboxed playground frame
  src/engine.js     page engine + widgets (recovered from the published page)
  src/ws-*.js       widgets for the Servers, APIs & Cloud part (one <script> each)
  data/book.json    existing chapters, vars, fixtures, missions
  data/new/*.json   new chapters (built by chapters/*.py); each has an "after" key naming
                    the chapter it follows

Outputs:
  dist/index.html   full document for local testing (python3 -m http.server in dist/)
  pub.html          the same page without doctype/html/head/body, for the artifact host

Usage: python3 tools/build.py [--check-identical]
"""
import json, os, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rd(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


def js_json(obj):
    # Same encoding the original build used: compact, UTF-8, every '<' escaped so no
    # string can close the <script> element.
    return json.dumps(obj, separators=(',', ':'), ensure_ascii=False).replace('<', '\\u003c')


def build(check_identical=False):
    book = json.loads(rd('data/book.json'))
    new = []
    for p in sorted(glob.glob(os.path.join(ROOT, 'data/new/*.json'))):
        with open(p, encoding='utf-8') as f:
            new.append(json.load(f))
    ids = [c['id'] for c in book['chapters']]
    for c in new:
        after = c.pop('after')
        if c['id'] in ids:
            raise SystemExit('duplicate chapter id ' + c['id'])
        i = [x['id'] for x in book['chapters']].index(after)
        book['chapters'].insert(i + 1, c)
    css = rd('src/style.css')
    for p in sorted(glob.glob(os.path.join(ROOT, 'src/*.add.css'))):
        with open(p, encoding='utf-8') as f:
            css += f.read()
    sb = 'window.__SBSRC=' + json.dumps(rd('src/sbsrc.js'), ensure_ascii=False).replace('<', '\\u003c') + ';'
    extra = ''
    for p in sorted(glob.glob(os.path.join(ROOT, 'src/ws-*.js'))):
        with open(p, encoding='utf-8') as f:
            ws = f.read()
        if '</script' in ws:
            raise SystemExit(p + ' contains </script')
        extra += '<script>\n' + ws + '</script>\n'
    pub = (rd('src/head.html') + '<style>' + css + '</style>\n<noscript>This book needs JavaScript.</noscript>\n'
           + '<script>window.__BOOK=' + js_json(book) + ';</script>\n'
           + '<script>' + rd('src/sim.js') + '</script>\n'
           + '<script>\n' + sb + '\n' + rd('src/engine.js') + '</script>\n'
           + extra
           + '<script>window.__boot();</script>\n\n')
    if check_identical:
        live = open(os.path.join(ROOT, '..', 'live', 'index.html'), encoding='utf-8').read()[349:-len('\n</body></html>')]
        print('identical to live:', pub == live)
    with open(os.path.join(ROOT, 'pub.html'), 'w', encoding='utf-8') as f:
        f.write(pub)
    full = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>\n'
            + pub + '\n</body></html>')
    with open(os.path.join(ROOT, 'dist/index.html'), 'w', encoding='utf-8') as f:
        f.write(full)
    n = len(book['chapters'])
    print('built: %d KB, %d chapters (%d new), %d command cards' % (
        len(pub.encode('utf-8')) // 1024, n, len(new),
        sum(1 for c in book['chapters'] for b in c['blocks'] if b['t'] == 'cmd')))
    return book


if __name__ == '__main__':
    build('--check-identical' in sys.argv)
