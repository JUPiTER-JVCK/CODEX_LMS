"""Run every runnable block and exercise in the given chapters inside the real page.

usage: python3 test/blocks.py CHAPTER_ID [...] [--update]
  run / jsrun blocks: compare with 'out'; with --update store actual output in data/outcache.json
  exercises (py/js): solution must pass its check; starter (if any) must not pass
Needs dist/ served on http://localhost:8765.
"""
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'chapters'))
from lib import okey
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ids = [a for a in sys.argv[1:] if not a.startswith('--')]
upd = '--update' in sys.argv
cachep = os.path.join(ROOT, 'data/outcache.json')
cache = json.load(open(cachep)) if os.path.exists(cachep) else {}
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html#welcome'); pg.wait_for_timeout(800)
    CH = pg.evaluate("window.__BOOK.chapters.map(c=>({id:c.id,blocks:c.blocks}))")
    for c in CH:
        if c['id'] not in ids: continue
        def walk(bl):
            for x in bl:
                yield x
                if x['t'] in ('callout', 'project'): yield from walk(x['blocks'])
        for x in walk(c['blocks']):
            if x['t'] == 'code' and x['lang'] in ('run', 'jsrun'):
                a = x.get('attrs', {})
                if x['lang'] == 'run':
                    r = pg.evaluate("c => window.__py.run(c,'',null)", x['code'])
                    got = r['out'] + (('' if r['out'].endswith('\n') or not r['out'] else '\n') + r['msg'] if r['status'] == 'error' else '')
                    ok_status = r['status'] == 'ok' or a.get('raises')
                else:
                    r = pg.evaluate("([c,m,pg]) => window.__js.run(c,{module:m,page:pg}).then(r=>({out:r.out,status:r.status,unc:r.uncaught,logs:r.logs.filter(l=>l.uncaught||l.sys).map(l=>l.text)}))", [x['code'], not a.get('classic'), x.get('page', '')])
                    got = r['out'] + ''.join(t + '\n' for t in r['logs']) if a.get('raises') else r['out']
                    ok_status = r['status'] == 'ok' or a.get('raises')
                got = got.rstrip('\n')
                k = okey(x['lang'], x['code'])
                if upd: cache[k] = got
                exp = x.get('out', '')
                mark = 'ok ' if (got == exp and ok_status) else 'BAD'
                if mark == 'BAD' and not upd: bad += 1
                if mark == 'BAD' or upd:
                    print('==', c['id'], x['lang'], 'line', x['line'], mark, 'status', r['status'])
                    print(x['code'][:300]); print('-- got:'); print(got[:1500]); print()
            if x['t'] == 'exercise' and x['type'] in ('py', 'js'):
                def runex(code):
                    if x['type'] == 'py':
                        r = pg.evaluate("([c,s,k]) => window.__py.run(c,s,k)", [code, x.get('stdin', ''), x['check']])
                        return r['status'] == 'ok', r
                    r = pg.evaluate("([c,k,pg]) => window.__js.run(c,{module:false,check:k,page:pg}).then(r=>({status:r.status,msg:r.msg,out:r.out}))", [code, x['check'], x.get('page', '')])
                    return r['status'] == 'pass', r
                ok, r = runex(x['solution'])
                print('EX', x['id'], 'solution', 'pass' if ok else 'FAIL ' + json.dumps(r)[:600])
                if not ok: bad += 1
                if x.get('starter'):
                    ok2, r2 = runex(x['starter'])
                    print('EX', x['id'], 'starter', 'fails (good)' if not ok2 else 'PASSES (bad)')
                    if ok2: bad += 1
    print('page errors:', errs)
    b.close()
if upd:
    json.dump(cache, open(cachep, 'w'), indent=0, sort_keys=True)
print('problems:', bad)
sys.exit(1 if bad else 0)
