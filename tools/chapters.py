#!/usr/bin/env python3
"""Build data/new/*.json from chapters/ch_*.py. Each module defines CHAPTER (and may define ORDER)."""
import importlib.util, json, os, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'chapters'))
os.makedirs(os.path.join(ROOT, 'data/new'), exist_ok=True)
for old in glob.glob(os.path.join(ROOT, 'data/new/*.json')):
    os.remove(old)
only = sys.argv[1:]
for p in sorted(glob.glob(os.path.join(ROOT, 'chapters/ch_*.py'))):
    name = os.path.basename(p)[:-3]
    spec = importlib.util.spec_from_file_location(name, p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    c = m.CHAPTER
    if only and c['id'] not in only:
        continue
    out = os.path.join(ROOT, 'data/new', name + '.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(c, f, ensure_ascii=False, indent=1)
    print('wrote', out, len(c['blocks']), 'blocks')
