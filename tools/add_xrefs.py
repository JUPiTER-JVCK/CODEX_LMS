#!/usr/bin/env python3
"""Place short "see also" pointers inside older chapters (data/book.json) that lead to newer ones.

Each pointer is a {"t": "callout"} block with one paragraph, inserted right after a block located by chapter + text snippet,
exactly like the labs (tools/add_labs.py). Running it twice changes nothing, it fails loudly when an anchor is missing, and
it verifies that removing the new block gives back exactly the original chapter.

usage: python3 tools/add_xrefs.py            (writes data/book.json)
       python3 tools/add_xrefs.py --check    (exit 1 if anything would change)
Chapters that live in chapters/*.py carry their pointers in the source instead.
"""
import copy, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'data/book.json')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from add_labs import locate  # noqa: E402  same anchor rules as the labs

# (chapter, anchor snippet, callout kind, title, text)
XREFS = [
    ('http', 'The attributes on a cookie are security controls', 'tip', 'Cookies in depth',
     'This section is the wire format only. [Cookies, Tracking and Privacy](#cookies) goes on from here: each attribute with a lab that applies the browser\'s real rules, '
     'which requests carry a cookie back, how session cookies are stolen and defended, and who uses cookies to follow people across sites.'),
    ('devtools', "In a real browser, Chrome's Application > Storage > **Clear site data**", 'tip', 'Cookies in depth',
     'The cookie columns you see here (Domain, Path, Expires, HttpOnly, Secure, SameSite) are explained in [Cookies, Tracking and Privacy](#cookies), '
     'which starts with a lab that follows one login cookie through your own browser.'),
]


def main():
    check = '--check' in sys.argv
    book = json.load(open(PATH, encoding='utf-8'))
    ch = {c['id']: c for c in book['chapters']}
    added = 0
    for cid, snippet, kind, title, text in XREFS:
        blocks = ch[cid]['blocks']
        if any(b['t'] == 'callout' and b.get('title') == title and any('#cookies' in x.get('text', '') for x in b['blocks']) for b in blocks):
            continue
        before = copy.deepcopy(blocks)
        at = locate(blocks, ('after', snippet, 0))
        prev = blocks[at - 1]
        new = {'t': 'callout', 'kind': kind, 'title': title, 'blocks': [{'t': 'p', 'text': text, 'line': 1}], 'line': prev.get('line', 0)}
        blocks.insert(at, new)
        assert blocks[:at] + blocks[at + 1:] == before, 'content changed'
        added += 1
        print(f'+ {cid:9} pointer after block {at - 1} ({prev["t"]})')
    print(f'{added} pointer(s) added' if added else 'nothing to do')
    if check:
        sys.exit(1 if added else 0)
    if added:
        json.dump(book, open(PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
