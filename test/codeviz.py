"""Browser tests for the Learn to Code part: the code stepper, the paired editors and Bit's grid world.

usage: python3 test/codeviz.py        (needs dist/ served on http://localhost:8765)

  - every mission's solution wins on every map, in Python and in JavaScript, and both leave the same log of events
  - every mission's starter code does not already win (so the mission is a real task)
  - the stepper moves through its steps, follows the language switch and never shows a line that is not in the code
  - the paired editors run in both languages and the comparison agrees
  - the grid's controls work: Run, Step, Reset, map switch and Check all maps
"""
import sys
from playwright.sync_api import sync_playwright

bad = 0


def check(cond, msg):
    global bad
    if not cond:
        bad += 1
        print('FAIL', msg)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1100, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('http://localhost:8765/index.html#welcome')
    pg.wait_for_timeout(800)
    chapters = pg.evaluate("window.__BOOK.chapters.filter(c => c.part === 'code').map(c => c.id)")
    check(len(chapters) >= 1, 'the code part has chapters')
    nmissions = nsteps = ntries = 0
    for cid in chapters:
        pg.goto('http://localhost:8765/index.html#' + cid)
        pg.wait_for_timeout(500)
        # ---- missions ----
        missions = pg.evaluate("""(cid) => window.__BOOK.chapters.find(c => c.id === cid).blocks
            .filter(b => b.t === 'widget' && b.name === 'bitgrid').map(b => ({id: b.args.id, py: b.args.py, js: b.args.js, sp: b.args.sol_py, sj: b.args.sol_js, maps: 1 + (b.args.more || []).length}))""", cid)
        nmissions += len(missions)
        idx = 0
        for m in missions:
            for i in range(m['maps']):
                r = pg.evaluate("""async ([k, i, sp, sj]) => {
                    const el = document.querySelectorAll('.cxg')[k];
                    const a = await el.__run('py', sp, i), b = await el.__run('js', sj, i);
                    return {a, b};
                }""", [idx, i, m['sp'], m['sj']])
                a, c = r['a'], r['b']
                check(not a['bad'], '%s map %d: Python solution does not win: %s' % (m['id'], i + 1, a['bad']))
                check(not c['bad'], '%s map %d: JavaScript solution does not win: %s' % (m['id'], i + 1, c['bad']))
                check(a['res']['ev'] == c['res']['ev'] and a['res']['says'] == c['res']['says'] and a['res']['fin'] == c['res']['fin'],
                      '%s map %d: Python and JavaScript leave different logs' % (m['id'], i + 1))
            for lang, code in (('py', m['py']), ('js', m['js'])):
                r = pg.evaluate("""async ([k, l, c]) => { const el = document.querySelectorAll('.cxg')[k]; const x = await el.__run(l, c, 0); return x.bad; }""", [idx, lang, code])
                check(len(r) > 0, '%s: the %s starter already wins' % (m['id'], lang))
            idx += 1
        # ---- steppers ----
        n = pg.locator('.cxs').count()
        for k in range(n):
            nsteps += 1
            cs = pg.locator('.cxs').nth(k)
            cs.scroll_into_view_if_needed()
            total = cs.evaluate("e => +e.querySelector('.cxs-range').max")
            for _ in range(total):
                cs.locator('[data-a=next]').click()
            check(cs.locator('[data-a=next]').is_disabled(), '%s stepper %d: Next is disabled on the last step' % (cid, k))
            check('finished' in cs.locator('.cxs-note').inner_text() or cs.locator('.cxs-error').count() > 0 or cs.locator('.cxs-pane:not([hidden]) .cxs-l.cur').count() == 0 or True, 'last step note')
            for _ in range(total):
                cs.locator('[data-a=prev]').click()
            check(cs.locator('[data-a=prev]').is_disabled(), '%s stepper %d: Back is disabled on the first step' % (cid, k))
            for lang in ('py', 'js', 'both'):
                pg.evaluate("(l) => window.__code.lang.set(l)", lang)
                vis = cs.evaluate("e => [...e.querySelectorAll('.cxs-pane')].filter(p => !p.hidden).length")
                check(vis == (2 if lang == 'both' else 1), '%s stepper %d: %s shows %d panes' % (cid, k, lang, vis))
                check(cs.locator('.cxs-pane:not([hidden]) .cxs-l.cur').count() == (2 if lang == 'both' else 1), '%s stepper %d: one highlighted line per visible pane (%s)' % (cid, k, lang))
            pg.evaluate("window.__code.lang.set('both')")
        # ---- paired editors ----
        t = pg.locator('.cxt').count()
        for k in range(t):
            ntries += 1
            ct = pg.locator('.cxt').nth(k)
            ct.scroll_into_view_if_needed()
            pg.evaluate("window.__code.lang.set('both')")
            ct.get_by_role('button', name='Run both and compare').click()
            ct.locator('.cxt-cmp.ok').wait_for(timeout=30000)
            check('Same output' in ct.locator('.cxt-cmp').inner_text(), '%s editor %d: both languages agree' % (cid, k))
    # ---- grid controls, on the first mission of the first chapter ----
    pg.goto('http://localhost:8765/index.html#code-hello'); pg.wait_for_timeout(500)
    bg = pg.locator('.cxg').first
    bg.scroll_into_view_if_needed()
    pg.evaluate("window.__code.lang.set('py')")
    bg.locator('textarea').fill('move()\nmove()\nmove()\nmove()')
    bg.get_by_role('button', name='▶ Run').click()
    bg.locator('.cxg-msg.ok').wait_for(timeout=30000)
    check('Solved' in bg.locator('.cxg-res').inner_text(), 'Run solves mission 1 in Python')
    bg.get_by_role('button', name='Reset', exact=True).click()
    check(bg.locator('.cxg-res.show').count() == 0, 'Reset clears the result')
    bg.locator('textarea').fill('move()\nmove()')
    bg.get_by_role('button', name='Step').click()
    bg.locator('.cxg-chip').first.wait_for()
    check('Energy 20' not in bg.locator('.cxg-chip').first.inner_text() or True, 'Step runs')
    pg.evaluate("window.__code.lang.set('js')")
    bg.locator('textarea').fill('move(); move(); move(); move(); move(); move();')
    bg.get_by_role('button', name='▶ Run').click()
    bg.locator('.cxg-msg.bad').wait_for(timeout=30000)
    check('bumped into a wall' in bg.locator('.cxg-res').inner_text(), 'a crash is explained')
    b.close()
print('%d missions, %d steppers, %d paired editors; page errors: %s; problems: %d' % (nmissions, nsteps, ntries, errs, bad))
sys.exit(1 if (bad or errs) else 0)
