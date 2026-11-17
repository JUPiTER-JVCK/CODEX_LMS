"""Regenerate test/wcwidth.json: terminal cell width (per the `wcwidth` package, which terminals follow)
of every non-ASCII character the app can draw: the whole book plus the app's own source.

usage: pip install wcwidth && python3 apps/tui/test/gen_widths.py
"""
import glob, json, os, re
import wcwidth

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
book = open(os.path.join(root, 'dist/index.html'), encoding='utf-8').read()
data = re.search(r'window\.__BOOK=(.*?);</script>', book, re.S).group(1)
src = ''.join(open(p, encoding='utf-8').read() for p in glob.glob(os.path.join(root, 'apps/tui/src/*.ts')))
chars = sorted({c for c in data + src if ord(c) > 127})
out = {c: wcwidth.wcwidth(c) for c in chars}
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'wcwidth.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
print(len(out), 'characters;', sum(1 for v in out.values() if v != 1), 'are not one cell wide')
