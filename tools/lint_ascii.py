#!/usr/bin/env python3
"""Find ASCII diagrams whose box lines drift out of alignment.

A diagram is drawn with box characters. A vertical stroke (| corner, tee, cross) must meet a matching stroke in the
row above or below at the same display column; when it does not, but another stroke sits one to three columns away,
the art is out of line. Colour markers (⟪r:text⟫) are removed first, wide (CJK/emoji) characters count as two columns.

usage: python3 tools/lint_ascii.py [--quiet]      exits 1 when anything is flagged
"""
import glob, json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UP = set('│┃║┘└┤├┴┼╯╰╝╚╣╠╩╬┛┗┫┣┻╋')
DOWN = set('│┃║┐┌┤├┬┼╮╭╗╔╣╠╦╬┓┏┫┣┳╋')
MARK = re.compile(r'⟪[rgybcmwd]:([^⟫]*)⟫')


def width(ch):
    if unicodedata.combining(ch):
        return 0
    return 2 if unicodedata.east_asian_width(ch) in 'WF' else 1


def cells(line):
    """Map display column -> character for one line."""
    out, col = {}, 0
    for ch in line:
        out[col] = ch
        col += width(ch)
    return out


def check(code):
    lines = [cells(MARK.sub(r'\1', l)) for l in code.split('\n')]
    bad = []
    for r, row in enumerate(lines):
        for x, ch in row.items():
            for dr, conn, other in ((-1, UP, DOWN), (1, DOWN, UP)):
                if ch not in conn or not 0 <= r + dr < len(lines):
                    continue
                nb = lines[r + dr]
                if nb.get(x) in other:
                    continue
                near = [d for d in (-3, -2, -1, 1, 2, 3) if nb.get(x + d) in other]
                if near:
                    bad.append((r + 1, x + 1, ch, 'above' if dr < 0 else 'below', near[0]))
    return bad


def load():
    book = json.load(open(os.path.join(ROOT, 'data/book.json'), encoding='utf-8'))
    chs = list(book['chapters'])
    for p in sorted(glob.glob(os.path.join(ROOT, 'data/new/*.json'))):
        chs.append(json.load(open(p, encoding='utf-8')))
    return chs


def walk(blocks):
    for b in blocks or []:
        yield b
        for k in ('blocks', 'how', 'task', 'why'):
            if isinstance(b.get(k), list):
                yield from walk(b[k])


def main():
    quiet = '--quiet' in sys.argv
    flagged = 0
    total = 0
    for c in load():
        for i, b in enumerate(walk(c['blocks'])):
            if b.get('t') != 'code' or b.get('lang') not in ('ascii', 'out', 'text'):
                continue
            if not re.search(r'[┌┐└┘├┤┬┴┼╭╮╰╯╔╗╚╝]', b['code']):
                continue
            total += 1
            bad = check(b['code'])
            if bad:
                flagged += 1
                print(f"{c['id']}: block at source line {b.get('line')}: {len(bad)} drifting strokes, first at row {bad[0][0]} col {bad[0][1]} ({bad[0][2]!r} vs a stroke {bad[0][4]:+d} cols away {bad[0][3]})")
                if not quiet:
                    for l in b['code'].split('\n')[max(0, bad[0][0] - 3):bad[0][0] + 2]:
                        print('    ' + l)
    print(f'{flagged} of {total} box diagrams flagged')
    return 1 if flagged else 0


if __name__ == '__main__':
    sys.exit(main())
