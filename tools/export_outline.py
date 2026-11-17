#!/usr/bin/env python3
"""Export the book as per-chapter JSON for the GUI and TUI apps.

  content/outline.json          parts + chapter metadata (small, loaded at start)
  content/chapters/<id>.json    one chapter's full blocks (lazy-loaded)

Run after tools/chapters.py. Same merge rules as tools/build.py.
"""
import glob, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTS = [['start', 'Start here'], ['found', 'Foundations'], ['zsh', 'The shell (zsh)'], ['net', 'Networking'],
         ['py', 'Python'], ['web', 'Web development'], ['srv', 'Servers, APIs & Cloud'], ['proj', 'Projects'],
         ['ref', 'Reference']]

book = json.load(open(os.path.join(ROOT, 'data/book.json'), encoding='utf-8'))
for p in sorted(glob.glob(os.path.join(ROOT, 'data/new/*.json'))):
    c = json.load(open(p, encoding='utf-8'))
    after = c.pop('after')
    i = [x['id'] for x in book['chapters']].index(after)
    book['chapters'].insert(i + 1, c)

out = os.path.join(ROOT, 'content')
os.makedirs(os.path.join(out, 'chapters'), exist_ok=True)
for old in glob.glob(os.path.join(out, 'chapters', '*.json')):
    os.remove(old)

def dump(path, obj):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))

outline = []
for ch in book['chapters']:
    outline.append({
        'id': ch['id'], 'title': ch['title'], 'sub': ch.get('sub', ''), 'part': ch['part'],
        'time': ch.get('time'), 'level': ch.get('level'), 'goals': ch.get('goals', []),
        'blocks': len(ch['blocks']),
        'exercises': sum(1 for b in ch['blocks'] if b['t'] == 'exercise'),
        'commands': sum(1 for b in ch['blocks'] if b['t'] == 'cmd'),
    })
    dump(os.path.join(out, 'chapters', ch['id'] + '.json'),
         {k: ch[k] for k in ('id', 'title', 'sub', 'part', 'time', 'level', 'goals', 'blocks', 'terms') if k in ch})
dump(os.path.join(out, 'outline.json'), {'parts': PARTS, 'chapters': outline})
print('exported %d chapters to content/' % len(outline))
