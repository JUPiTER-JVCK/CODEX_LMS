#!/usr/bin/env python3
"""Re-align drifting box strokes in ASCII diagrams by moving whitespace only.

For a stroke that does not meet its neighbour, move it by the drift distance: spaces are removed on one side
and added on the other, so no word moves and no character is added or lost. Diagrams that cannot be fixed this way
(text overflowing a box) are reported for a manual edit. Every change is verified: the sequence of non-space
characters must be identical before and after.

usage: python3 tools/fix_ascii.py          dry run on data/book.json
       python3 tools/fix_ascii.py --write  rewrite data/book.json in place
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lint_ascii as L

ROOT = L.ROOT
MARK = re.compile(r'⟪([rgybcmwd]):([^⟫]*)⟫')


def parse(line):
    """-> list of [char, colour|None] cells."""
    cells, pos = [], 0
    for m in MARK.finditer(line):
        cells += [[c, None] for c in line[pos:m.start()]]
        cells += [[c, m.group(1)] for c in m.group(2)]
        pos = m.end()
    cells += [[c, None] for c in line[pos:]]
    return cells


def serialise(cells):
    out, i = '', 0
    while i < len(cells):
        col = cells[i][1]
        j = i
        while j < len(cells) and cells[j][1] == col:
            j += 1
        run = ''.join(c for c, _ in cells[i:j])
        out += f'⟪{col}:{run}⟫' if col else run
        i = j
    return out


def starts(cells):
    x, res = 0, []
    for c, _ in cells:
        res.append(x)
        x += L.width(c)
    return res


def fix_block(code):
    lines = [parse(l) for l in code.split('\n')]
    for _ in range(200):
        plain = ['\n'.join(''.join(c for c, _ in l) for l in lines)][0]
        bad = L.check('\n'.join(serialise(l) for l in lines))
        if not bad:
            break
        progressed = False
        for (row, col, ch, where, d) in bad:
            cells = lines[row - 1]
            pos = starts(cells)
            if col - 1 not in pos:
                continue
            idx = pos.index(col - 1)
            k = abs(d)
            if try_shift(cells, idx, d, k):
                progressed = True
                break
        if not progressed:
            break
    return '\n'.join(serialise(l) for l in lines)


def runs_before(cells, idx):
    """Runs of spaces to the left of idx (stopping at the previous stroke), nearest first: [(start, length)]."""
    out, i = [], idx - 1
    while i >= 0 and cells[i][0] not in L.UP | L.DOWN:
        if cells[i][0] == ' ':
            j = i
            while j >= 0 and cells[j][0] == ' ':
                j -= 1
            out.append((j + 1, i - j))
            i = j
        else:
            i -= 1
    return out


def try_shift(cells, idx, d, k):
    """Move the stroke at idx by d columns, keeping every word and everything after the stroke where it was."""
    ch = cells[idx]
    if d > 0:   # need to move right: widen a gap before it, take the same from right after it
        after = cells[idx + 1: idx + 1 + k]
        runs = runs_before(cells, idx)
        if len(after) == k and all(c == ' ' for c, _ in after) and runs:
            start = max(runs, key=lambda r: r[1])[0]
            cells[:] = cells[:start] + [[' ', None] for _ in range(k)] + cells[start: idx + 1] + cells[idx + 1 + k:]
            return True
    else:       # need to move left: remove spaces from a gap before it (keep one), give them back after it
        for start, n in sorted(runs_before(cells, idx), key=lambda r: -r[1]):
            if n - 1 >= k:
                cells[:] = cells[:start] + cells[start + k: idx + 1] + [[' ', None] for _ in range(k)] + cells[idx + 1:]
                return True
        before = cells[max(0, idx - k): idx]   # fallback: spaces directly before it
        if len(before) == k and all(c == ' ' for c, _ in before):
            cells[:] = cells[:idx - k] + [ch] + [[' ', None] for _ in range(k)] + cells[idx + 1:]
            return True
    return False



def squeeze(s):
    return re.sub(r'\s+', '', MARK.sub(r'\1', s) if False else MARK.sub(lambda m: m.group(2), s))


def main():
    write = '--write' in sys.argv
    path = os.path.join(ROOT, 'data/book.json')
    book = json.load(open(path, encoding='utf-8'))
    fixed = left = 0
    for c in book['chapters']:
        for b in L.walk(c['blocks']):
            if b.get('t') != 'code' or b.get('lang') not in ('ascii', 'out', 'text'):
                continue
            if not re.search(r'[┌┐└┘├┤┬┴┼╭╮╰╯╔╗╚╝]', b['code']) or not L.check(b['code']):
                continue
            new = fix_block(b['code'])
            assert squeeze(new) == squeeze(b['code']), f"{c['id']}: characters changed"
            if L.check(new):
                left += 1
                print(f"manual: {c['id']} line {b.get('line')}: {len(L.check(new))} strokes still drift")
            else:
                fixed += 1
                print(f"fixed:  {c['id']} line {b.get('line')}")
            if new != b['code'] and write and not L.check(new):
                b['code'] = new
    print(f'{fixed} fixed, {left} need a manual edit')
    if write:
        json.dump(book, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
