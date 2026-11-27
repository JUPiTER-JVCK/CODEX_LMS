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
    # Learn to Code part: the older chapters that go deeper point back at the gentle version
    ('welcome', 'You do not need prior experience with the shell or with Python.', 'tip', 'New to programming?',
     'If you have never written code, the **Learn to Code** part comes right after Foundations. [Meet Bit](#code-hello) starts with what a program is and takes you, in ten short chapters, to a small project, '
     'with Python and JavaScript side by side and a robot you can watch. Do it before the shell chapters, or skip it if you already code.'),
    ('scripting', 'A script is a text file of commands that the shell runs in order', 'tip', 'The ideas, from scratch',
     'Variables, decisions, loops and functions are taught from the beginning, with pictures of the program running, in the [Learn to Code](#code-hello) part. If a shell construct here is new, it can help to meet the idea there first.'),
    ('py-start', 'You already know how a shell turns text into processes. Python is the next layer up', 'tip', 'Already met Python?',
     'If you did the [Learn to Code](#code-hello) part you have already written Python: variables, decisions, loops, functions, lists, dictionaries and a class. This part starts with the interpreter and your tools and goes much deeper into each of those. '
     'If you skipped that part and the next chapters move quickly, its first few chapters are an easy way in.'),
    ('py-basics', 'Every program is values and operations on values.', 'tip', 'The gentle version',
     'The ideas in this chapter (boxes with labels, the kinds of value, joining text) are introduced slowly, with pictures, in [Boxes with Labels](#code-vars). Read that first if the types and operators feel like too much at once.'),
    ('py-flow', 'A program that runs every line once, top to bottom, is just a calculator.', 'tip', 'The gentle version',
     'Decisions, loops and functions are each taught from scratch, with a stepper that shows the program running, in [Decisions](#code-decide), [Loops](#code-loops) and [Functions](#code-funcs). They cover the same ground at a slower pace.'),
    ('py-data', 'Programs are mostly data moving between containers', 'tip', 'The gentle version',
     '[Lists](#code-lists) and [Dictionaries](#code-dicts) show the same containers as pictures, including why two names can point at one list, which is the root of many aliasing bugs. Start there if the choices below feel abstract.'),
    ('py-errors', 'Every program you have written so far assumed that the input is well formed', 'tip', 'The gentle version',
     '[When Things Go Wrong](#code-debug) is the beginner’s version of this chapter: the three kinds of problem, how to read an error message, the off-by-one error and a method for finding bugs. Read it first if tracebacks still look like noise.'),
    ('py-oop', 'So far your programs have been functions acting on lists and dicts.', 'tip', 'The gentle version',
     '[Blueprints: Objects and Classes](#code-objects) explains classes, `self`, methods and many objects from one blueprint, with pictures, in Python and JavaScript. Start there if this chapter moves too fast.'),
    ('js-basics', 'JavaScript is the one language every browser runs', 'tip', 'If JavaScript is your first language',
     '[Learn to Code](#code-hello) teaches the same ideas (variables, decisions, loops, functions, arrays, objects and classes) in JavaScript and Python side by side, with a stepper and a robot, before you meet the details here.'),
]


def main():
    check = '--check' in sys.argv
    book = json.load(open(PATH, encoding='utf-8'))
    ch = {c['id']: c for c in book['chapters']}
    added = 0
    for cid, snippet, kind, title, text in XREFS:
        blocks = ch[cid]['blocks']
        if any(b['t'] == 'callout' and b.get('title') == title and b['blocks'][0].get('text') == text for b in blocks):
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
