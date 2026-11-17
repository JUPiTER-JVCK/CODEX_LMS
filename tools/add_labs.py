#!/usr/bin/env python3
"""Place the interactive labs inside the chapters they belong to (data/book.json).

Each lab is a {"t": "widget", "name": ...} block, the same kind the book already uses, inserted right after a
block located by chapter + text snippet. Running it twice changes nothing. It fails loudly when an anchor is
missing and verifies that deleting the new blocks gives back exactly the original chapter.

usage: python3 tools/add_labs.py            (writes data/book.json)
       python3 tools/add_labs.py --check    (exit 1 if anything would change)
The crypto, apis, servers and cloud chapters live in chapters/*.py and use WIDGET('name') there instead.
"""
import copy, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'data/book.json')

# (chapter, widget, args, anchor)  anchor = ('after', snippet, offset) | ('end-of', heading id)
LABS = [
    ('computers', 'bitswitches', {}, ('after', 'Edit the code to convert your own numbers', 0)),
    ('computers', 'utf8', {}, ('after', 'is 4 characters but 5 bytes', 0)),
    ('computers', 'bitmask', {}, ('after', 'addr = 0xC0A80117', 0)),
    ('computers', 'gates', {}, ('end-of', 'hardware')),
    ('computers', 'latencyladder', {}, ('after', 'The figures are typical orders of magnitude', 0)),
    ('computers', 'pathlookup', {}, ("after", "Homebrew's folders come first", 0)),
    ('py-basics', 'bitmask', {'mode': 'ip'}, ('after', 'parts = "192.168.1.10".split(".")', 0)),
    ('thinking', 'algoracer', {}, ('after', 'A million items cost the linear search', 0)),
    ('scripting', 'cron', {}, ('after', '*/5 * * * *   /Users/', 0)),
    ('system', 'procsim', {}, ('after', 'Be sure of the PID', 0)),
    ('ssh', 'sshconfig', {}, ('after', 'Now `ssh pi` means', 0)),
    ('py-modules', 'pathlookup', {'mode': 'python'}, ('after', 'is an ordinary list of folder names', 0)),
    ('html', 'domtree', {}, ('after', 'const parse = (html) => new DOMParser()', 0)),
    ('js-basics', 'jswat', {}, ('end-of', 'operators')),
    ('devtools', 'netwaterfall', {}, ('after', 'Click a request for its details', 1)),
    ('node', 'semver', {}, ('after', 'Here is the caret and tilde logic', 1)),
    ('net-reach', 'ttltrace', {}, ('after', 'TTL=1  ──▶ [router 1]', 0)),
    ('capture', 'dissect', {}, ('after', '-c 30 "host $ip or port 53"\n2026', 0)),
]


def text_of(b):
    return ' '.join(str(b.get(k, '')) for k in ('text', 'title', 'code', 'name'))


def locate(blocks, anchor):
    kind = anchor[0]
    if kind == 'after':
        hits = [i for i, b in enumerate(blocks) if b['t'] != 'widget' and anchor[1] in text_of(b)]
        if len(hits) != 1:
            raise SystemExit(f'anchor {anchor[1]!r}: {len(hits)} matches (need exactly 1)')
        return hits[0] + anchor[2] + 1
    h = [i for i, b in enumerate(blocks) if b['t'] == 'h' and b.get('id') == anchor[1]]
    if len(h) != 1:
        raise SystemExit(f'heading {anchor[1]!r} not found')
    nxt = [i for i, b in enumerate(blocks) if i > h[0] and b['t'] == 'h' and b['level'] == 2]
    return nxt[0] if nxt else len(blocks)


def main():
    check = '--check' in sys.argv
    book = json.load(open(PATH, encoding='utf-8'))
    ch = {c['id']: c for c in book['chapters']}
    added = 0
    for cid, name, args, anchor in LABS:
        blocks = ch[cid]['blocks']
        if any(b['t'] == 'widget' and b['name'] == name and b.get('args') == args for b in blocks):
            continue
        before = copy.deepcopy(blocks)
        at = locate(blocks, anchor)
        prev = blocks[at - 1]
        blocks.insert(at, {'t': 'widget', 'name': name, 'args': args, 'line': prev.get('line', 0)})
        assert [b for b in blocks if not (b['t'] == 'widget' and b['name'] == name and b.get('args') == args)] == before, 'content changed'
        added += 1
        print(f'+ {cid:11} {name:14} after block {at - 1} ({prev["t"]})')
    print(f'{added} lab(s) added' if added else 'nothing to do')
    if check:
        sys.exit(1 if added else 0)
    if added:
        json.dump(book, open(PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
