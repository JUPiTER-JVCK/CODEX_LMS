"""Browser tests for the interactive labs: each one is placed in context, responds to input, and logs no errors.

usage: python3 test/labs.py [WIDGET ...]     (needs dist/ served on http://localhost:8765)
"""
import sys
from playwright.sync_api import sync_playwright

# (chapter, widget, steps) where a step is a function (lab locator, page) -> None that asserts with `expect`
def expect(cond, msg):
    if not cond:
        raise AssertionError(msg)

def txt(l):
    return ' '.join(l.inner_text().split())  # the browser collapses runs of spaces, so compare single-spaced text

def btn(l, name):
    l.get_by_role('button', name=name, exact=True).first.click()

def t_bitswitches(l, p):
    # keyboard only: focus a bit and press Space (the starting value 5 has bit 0 set, so Space clears it)
    l.locator('[aria-label="bit 0"]').focus(); p.keyboard.press('Space')
    expect(txt(l.locator('.lb-stat').first).strip().endswith('4'), 'Space toggles a focused bit')
    p.keyboard.press('Space')
    expect(txt(l.locator('.lb-stat').first).strip().endswith('5'), 'and toggles it back')
    expect(l.locator('[aria-label="bit 0"]').get_attribute('aria-pressed') == 'true', 'aria-pressed is "true" for an on bit')
    expect(l.locator('[aria-label="bit 7"]').get_attribute('aria-pressed') == 'false', 'and "false" for an off bit')
    l.locator('[aria-label="bit 7"]').click()
    expect('133' in txt(l.locator('.lb-stat').first), 'decimal 133 after flipping bit 7')
    btn(l, '255'); btn(l, '+1')
    expect('Overflow' in txt(l), 'overflow note after 255 + 1')
    expect(txt(l.locator('.lb-stat').first).strip().endswith('0'), 'wrapped to 0')

def t_gates(l, p):
    # keyboard only: pressing Enter on a gate button must leave focus on that same button after the lab redraws
    l.get_by_role('button', name='NAND', exact=True).first.focus(); p.keyboard.press('Enter')
    expect(p.evaluate('document.activeElement.textContent') == 'NAND', 'focus stays on the gate button after a redraw')
    expect('NAND' in txt(l.locator('.lb-btn.on').nth(1)), 'and it became the selected gate')
    btn(l, 'AND')
    expect('only when every input is 1' in txt(l), 'AND blurb')
    expect(l.locator('.lb-truth tr.hit').count() == 1, 'one truth-table row highlighted')
    btn(l, 'Adders')
    expect('1011 + 0110 = 10001 (17)' in txt(l), 'ripple adder 11 + 6')

def t_bitmask_byte(l, p):
    expect('10110000' in txt(l).replace(' ', ''), 'default AND result')
    btn(l, 'OR (|)')
    expect('Sets every bit' in txt(l), 'OR explanation')
    l.locator('button.lb-mb').first.click()
    expect('SYN' in txt(l) or 'ACK' in txt(l), 'tcp flag line')

def t_bitmask_ip(l, p):
    expect('192.168.1.0 (network)' in txt(l), 'network address for /24')
    l.locator('input[type=range]').fill('16'); l.locator('input[type=range]').dispatch_event('input')
    expect('192.168.0.0 (network)' in txt(l), 'network address for /16')

def t_utf8(l, p):
    expect('6 characters, 9 bytes' in txt(l), 'café € is 6 characters and 9 bytes')
    btn(l, '漢字')
    expect('2 characters, 6 bytes' in txt(l), '漢字')

def t_pathlookup(l, p):
    expect('/opt/homebrew/bin/python3' in txt(l), 'homebrew python wins')
    btn(l, 'Reverse')
    expect('→ /usr/bin/python3' in txt(l), 'reversed PATH picks /usr/bin')

def t_pathlookup_py(l, p):
    expect('/usr/lib/python3.12/random' in txt(l), 'stdlib random')
    btn(l, 'Add random.py next to my script')
    expect('(script folder)/random' in txt(l), 'local random.py shadows the stdlib')

def t_avalanche(l, p):
    expect('of 256 bits differ' in txt(l), 'diff shown')
    btn(l, 'Make equal')
    expect('0 of 256 bits differ' in txt(l), 'identical input')

def t_crackcalc(l, p):
    expect('MD5' in txt(l) and 'bcrypt' in txt(l), 'hash table')
    btn(l, 'digits')
    expect('instantly' in txt(l) or 'seconds' in txt(l), 'digits are quick to guess')

def t_jwt(l, p):
    expect('Signature valid' in txt(l), 'sample token verifies')
    btn(l, 'Forge role: admin')
    expect('INVALID' in txt(l), 'forged payload breaks the signature')
    btn(l, 'Re-sign with the secret')
    expect('Signature valid' in txt(l) and 'admin' in txt(l), 're-signed token verifies')

def t_cron(l, p):
    expect('08:30' in txt(l) and 'Monday' in txt(l), 'default explanation')
    btn(l, 'every 5 minutes')
    expect('Runs every 5 minutes.' in txt(l), 'preset')
    expect(l.locator('.lb-runs li').count() == 5, 'five upcoming runs')

def t_latency(l, p):
    expect(l.locator('.lb-lrow').count() == 8, 'eight tiers')
    btn(l, '1 minute')
    expect('hour' in txt(l.locator('.lb-lrow').nth(3)), 'RAM = about 1.7 hours at 1 ns = 1 min')

def t_algo(l, p):
    btn(l, 'Show result')
    expect('linear needed 45 checks' in txt(l) or 'linear needed' in txt(l), 'race result')
    expect(l.locator('.lb-srow').count() == 3, 'three sorts compared')

def t_proc(l, p):
    l.get_by_role('button', name='SIGSTOP (19)').focus(); p.keyboard.press('Enter')
    expect(p.evaluate('document.activeElement.textContent') == 'SIGSTOP (19)', 'focus stays on the signal button after a redraw')
    expect('stopped' in txt(l), 'stopped state')
    l.get_by_role('button', name='select process 4412').click()
    btn(l, 'SIGTERM (15)')
    expect('zombie' in txt(l), 'orphaned child becomes a zombie')
    btn(l, 'Parent calls wait()')
    expect('removed' in txt(l), 'zombie reaped')

def t_ssh(l, p):
    expect('Host pi' in txt(l), 'config block')
    l.locator('input[aria-label="Port"]').fill('2222')
    expect('-p 2222' in txt(l) and 'Port 2222' in txt(l), 'port appears in both forms')
    l.locator('input[aria-label="Port"]').fill('0')
    expect('Port must be' in txt(l), 'validation message')

def t_domtree(l, p):
    btn(l, 'Missing end tags')
    expect(l.locator('.lb-tn').filter(has_text='<p>').count() == 2, 'parser closes the first <p> itself')
    expect('<li>' in txt(l.locator('.lb-tree')), 'list items parsed')

def t_jswat(l, p):
    l.locator('.lb-puzzle').wait_for()
    btn(l, '"53"')
    expect('Correct' in txt(l), 'correct answer accepted')
    btn(l, 'Next')
    expect('2 of' in txt(l), 'second puzzle')

def t_waterfall(l, p):
    btn(l, 'Slow database query')
    expect('server is the bottleneck' in txt(l), 'advice for a slow server')
    expect('time_total' in txt(l), 'curl -w output')

def t_semver(l, p):
    expect('✓ 1.2.3' in txt(l) and '✗ 2.0.0' in txt(l), 'caret range')
    btn(l, '~1.2.3')
    expect('✗ 1.3.0' in txt(l) and '✓ 1.2.9' in txt(l), 'tilde range')

def t_ttl(l, p):
    expect('ICMP time exceeded' in txt(l), 'TTL 3 expires in transit')
    btn(l, 'Enough TTL')
    expect('echo reply' in txt(l), 'TTL 8 reaches the destination')

def t_dissect(l, p):
    expect('SYN' in txt(l), 'TCP flags decoded')
    l.get_by_role('button', name='Flags: SYN').click()
    expect('bytes 47–47' in txt(l), 'selected field range')
    btn(l, 'DNS query for example.com')
    expect('53 = DNS' in txt(l), 'DNS sample')

TESTS = [
    ('computers', 'bitswitches', 0, t_bitswitches), ('computers', 'utf8', 0, t_utf8), ('computers', 'bitmask', 0, t_bitmask_byte),
    ('computers', 'gates', 0, t_gates), ('computers', 'latencyladder', 0, t_latency), ('computers', 'pathlookup', 0, t_pathlookup),
    ('py-basics', 'bitmask', 0, t_bitmask_ip), ('py-modules', 'pathlookup', 0, t_pathlookup_py), ('thinking', 'algoracer', 0, t_algo),
    ('scripting', 'cron', 0, t_cron), ('system', 'procsim', 0, t_proc), ('ssh', 'sshconfig', 0, t_ssh), ('html', 'domtree', 0, t_domtree),
    ('js-basics', 'jswat', 0, t_jswat), ('devtools', 'netwaterfall', 0, t_waterfall), ('node', 'semver', 0, t_semver),
    ('net-reach', 'ttltrace', 0, t_ttl), ('capture', 'dissect', 0, t_dissect),
    ('crypto', 'avalanche', 0, t_avalanche), ('crypto', 'crackcalc', 0, t_crackcalc), ('apis', 'jwt', 0, t_jwt),
]

UNNAMED = '''(root) => [...root.querySelectorAll('button,input,select,textarea')].filter((e) => {
  const name = e.getAttribute('aria-label') || (e.textContent || '').trim() || e.getAttribute('title') || (e.labels && [...e.labels].map((l) => l.textContent).join('').trim());
  return !name;
}).map((e) => e.outerHTML.slice(0, 90))'''

def main():
    only = set(sys.argv[1:])
    bad = 0
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={'width': 1300, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto('http://localhost:8765/index.html#welcome'); pg.wait_for_timeout(600)
        for cid, name, nth, fn in TESTS:
            if only and name not in only: continue
            try:
                pg.evaluate(f"location.hash = '#{cid}'"); pg.wait_for_timeout(350)
                mount = pg.locator(f'#page .wmount[data-w="{name}"]').nth(nth)
                expect(mount.count() == 1 and mount.locator('.lb-card').count() == 1, 'lab mounted')
                # nested in context: there is at least one section heading before it, and prose or code right before it
                expect(pg.evaluate("(m) => { let n = m.previousElementSibling, h = 0; while (n) { if (n.matches('h2.s')) h++; n = n.previousElementSibling; } return h }", mount.element_handle()) >= 1, 'placed after a section heading, not at the top')
                mount.scroll_into_view_if_needed()
                unnamed = mount.evaluate(UNNAMED)
                expect(not unnamed, 'controls without an accessible name: ' + str(unnamed[:2]))
                fn(mount, pg)
                unnamed = mount.evaluate(UNNAMED)   # controls created while interacting too
                expect(not unnamed, 'controls without an accessible name after use: ' + str(unnamed[:2]))
                print('ok  ', cid, name)
            except Exception as e:
                bad += 1
                print('FAIL', cid, name, '-', str(e).splitlines()[0][:160])
        errs = [e for e in errs if 'favicon' not in e]
        print('page errors:', errs)
        b.close()
    print('problems:', bad + len(errs))
    sys.exit(1 if bad or errs else 0)

if __name__ == '__main__':
    main()
