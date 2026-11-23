"""Browser tests for the Cookies, Tracking and Privacy labs (src/ws-9-cookies*.js).

Each lab is found in its chapter and driven with real clicks; what it answers is checked against facts that can be worked out independently
(which requests carry which cookie, who sees what, how a crowd shrinks). Also checks both themes, that nothing overflows a phone-width
screen, and that nothing logs an error. The rules behind the labs are compared with a real Chromium by test/cookie_rules.py.

usage: python3 test/cookieviz.py          (needs dist/ served on http://localhost:8765)
"""
import sys
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8765/index.html#'
problems = []


def expect(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond:
        problems.append(msg)


def txt(l):
    return ' '.join(l.inner_text().split())


def has(l, *needles):
    t = txt(l).lower()   # inner_text applies CSS text-transform, so compare case-insensitively
    return all(n.lower() in t for n in needles)


def lab(page, name):
    page.goto(BASE + 'cookies')
    page.wait_for_timeout(500)
    w = page.locator('.wmount[data-w="%s"]' % name).first
    w.scroll_into_view_if_needed()
    page.wait_for_timeout(150)
    return w


def chip(l, label):
    l.get_by_role('button', name=label, exact=True).first.click()


def rows(l):
    return {r.locator('th').first.inner_text().split('\n')[0].strip().lower(): txt(r.locator('td').first) for r in l.locator('tbody tr').all()}


# ---------------------------------------------------------------- engine
def engine(pg):
    pg.goto(BASE + 'cookies')
    pg.wait_for_timeout(400)
    r = pg.evaluate('''() => {
      const C = window.__ck;
      return {
        a: C.registrable('www.shop.example'), b: C.registrable('pay.shop.co.uk'), c: C.registrable('shop.co.uk'), d: C.sameSite('a.shop.example', 'b.shop.example'),
        e: C.sameSite('shop.co.uk', 'bank.co.uk'), f: C.setCookie('x=1; Secure', 'http://shop.example/').ok, g: C.setCookie('x=1; Max-Age=99999999999', 'https://shop.example/').cookie.life,
        h: C.setCookie('x=1', 'https://shop.example/a/b/c').cookie.path,
      };
    }''')
    expect(r['a'] == 'shop.example' and r['b'] == 'shop.co.uk' and r['c'] == 'shop.co.uk', 'engine: the registrable domain follows the public suffix')
    expect(r['d'] is True and r['e'] is False, 'engine: subdomains share a site, co.uk neighbours do not')
    expect(r['f'] is False and r['g'] == 34560000 and r['h'] == '/a/b', 'engine: Secure over http refused, lifetime capped at 400 days, default path /a/b')


# ---------------------------------------------------------------- the labs
def dance(pg):
    l = lab(pg, 'ckdance')
    expect(has(l, 'Step 1 of 4', 'stranger'), 'ckdance: first visit starts with a stranger')
    l.get_by_role('button', name='Next step').click()
    expect(has(l, 'Step 2 of 4', 'Set-Cookie: `visitor') or has(l, 'Step 2 of 4', 'random number'), 'ckdance: step 2 is the server handing out an ID')
    chip(l, '3. A third party')
    expect(has(l, 'Step 1 of 7'), 'ckdance: the third-party story has seven steps')
    for _ in range(6):
        l.get_by_role('button', name='Next step').click()
    expect(has(l, 'Linked', 'uid=77c1 on news.example and on shop.example'), 'ckdance: the last step says the tracker linked both sites')
    chip(l, '2. Logging in')
    expect(has(l, 'Step 1 of 4', 'only time the password travels'), 'ckdance: the login story starts with the password')


def builder(pg):
    l = lab(pg, 'ckbuilder')
    expect('Stored' in txt(l), 'ckbuilder: the login preset is stored')
    r = rows(l)
    expect(r['reload this page'].startswith('sent') and r['another page on the site (/)'].startswith('sent'), 'ckbuilder: same-site requests carry the cookie')
    expect(r['a sibling subdomain (pay.shop.example)'].startswith('not sent'), 'ckbuilder: a host-only cookie does not go to a sibling subdomain')
    expect(r['the same page over plain http'].startswith('not sent'), 'ckbuilder: a Secure cookie stays off plain http')
    expect(r['a shop image embedded in a page on news.example'].startswith('not sent') and r['a form on news.example posts to this page'].startswith('not sent'), 'ckbuilder: Lax holds back an image and a form POST from another site')
    expect(r['you click a link on news.example to this page'].startswith('sent'), 'ckbuilder: but Lax lets a link click through')
    expect(r['a script on this page reads document.cookie'].startswith('hidden'), 'ckbuilder: HttpOnly hides it from scripts')
    chip(l, 'Tracking ID')
    r = rows(l)
    expect(r['a sibling subdomain (pay.shop.example)'].startswith('sent') and r['a shop image embedded in a page on news.example'].startswith('sent'), 'ckbuilder: Domain plus SameSite=None reaches subdomains and other sites')
    expect(r['a script on this page reads document.cookie'].startswith('readable'), 'ckbuilder: without HttpOnly a script can read it')
    expect('400 days' in txt(l), 'ckbuilder: a two-year lifetime is shortened to 400 days')
    chip(l, 'Mistake: None without Secure')
    expect(has(l, 'Refused', 'SameSite=None without Secure'), 'ckbuilder: SameSite=None without Secure is refused')
    chip(l, 'Mistake: someone else’s domain')
    expect(has(l, 'Refused', 'does not contain the host'), 'ckbuilder: another site’s domain is refused')
    chip(l, 'Mistake: __Host- with Domain')
    expect(has(l, 'Refused', 'must not have a Domain'), 'ckbuilder: a __Host- cookie with Domain is refused')
    chip(l, 'No attributes')
    expect(has(l, 'under /account', 'session cookie'), 'ckbuilder: with no Path the default is /account, and with no lifetime it is a session cookie')
    l.locator('select[data-k=age]').select_option('0')
    expect(has(l, 'Deleted'), 'ckbuilder: Max-Age=0 deletes')
    l.locator('input[data-k=name]').fill('theme')
    l.locator('select[data-k=age]').select_option('3600')
    expect(has(l, 'Set-Cookie: theme=') and 'Stored' in txt(l), 'ckbuilder: typing a name rebuilds the header')


def shop(pg):
    l = lab(pg, 'ckshop')
    chip(l, 'Log in as Sam')
    expect('sid=' in txt(l) and has(l, 'Hi Sam', 'Cart: 0'), 'ckshop: server design: the cookie is only an ID')
    chip(l, 'Add to cart')
    expect(has(l, 'Cart: 1 item', 'did not change at all'), 'ckshop: the cart changed on the server, the cookie did not')
    chip(l, 'Copy it to a stranger’s browser')
    expect(has(l, 'A stranger with a copy of your cookie', 'Hi Sam'), 'ckshop: a stolen session cookie is worth a login')
    chip(l, 'Delete the cookie')
    expect(has(l, 'Signed out', 'You threw away the key'), 'ckshop: deleting the cookie logs out, the server keeps the record')
    chip(l, 'Data in the cookie, plain')
    chip(l, 'Log in as Sam')
    chip(l, 'Make it role=admin')
    expect(has(l, 'Admin panel', 'role=admin'), 'ckshop: an unsigned cookie lets you promote yourself')
    chip(l, 'Data in the cookie, signed')
    chip(l, 'Log in as Sam')
    chip(l, 'Make it role=admin')
    expect(has(l, 'Tampering detected', 'signature does not match'), 'ckshop: a signed cookie notices the edit')


def attack(pg):
    l = lab(pg, 'ckattack')
    cards = l.locator('.ck-card')
    expect(cards.count() == 3 and 'attack works' in txt(cards.nth(0)) and 'attack works' in txt(cards.nth(2)), 'ckattack: with no attributes the script theft and the Wi-Fi snooping both work')
    expect('blocked' in txt(cards.nth(1)) and 'Chrome' in txt(cards.nth(1)) and 'default' in txt(cards.nth(1)), 'ckattack: the forgery is already held back by Chrome\'s Lax default, and the lab says so')
    l.locator('input[data-k=httponly]').check()
    expect('blocked' in txt(cards.nth(0)) and 'attack works' in txt(cards.nth(2)), 'ckattack: HttpOnly stops script theft only')
    l.locator('select[data-k=ss]').select_option('Lax')
    expect('blocked' in txt(cards.nth(1)) and 'default' not in txt(cards.nth(1)).split('SameSite=Lax')[1][:12], 'ckattack: an explicit SameSite=Lax stops the forged form POST')
    l.locator('select[data-k=ss]').select_option('None')
    expect(has(l, 'Refused', 'SameSite=None without Secure'), 'ckattack: None without Secure is refused')
    l.locator('input[data-k=secure]').check()
    expect('attack works' in txt(cards.nth(1)) and 'blocked' in txt(cards.nth(2)), 'ckattack: SameSite=None lets the forgery through again; Secure stops the Wi-Fi snooping')
    l.locator('input[data-k=http]').uncheck()
    expect('no clear-text request' in txt(cards.nth(2)).lower(), 'ckattack: an https-only site has no clear-text request')


def track(pg):
    l = lab(pg, 'cktrack')
    expect(has(l, '1 person', 'joined every visit') and has(l, 'uid=77c1'), 'cktrack: third-party cookies allowed: one ID on all three sites, one person')
    chip(l, 'Blocked (Safari)')
    expect(has(l, '3 people', 'no cookie to join') or has(l, '3 people', 'cannot tell these visits are the same person'), 'cktrack: blocked: three unrelated requests')
    chip(l, 'One jar per site (Firefox)')
    expect(has(l, '3 people') and has(l, 'a3f9') and has(l, '51be'), 'cktrack: partitioned: a different ID on each site')
    l.locator('input[data-mail]').check()
    expect(has(l, 'email hash') and has(l, '2 people'), 'cktrack: shared hashed email joins the two logged-in sites even with partitioned cookies')
    chip(l, 'Blocked (Safari)')
    expect(has(l, '2 people'), 'cktrack: and with cookies blocked')
    chip(l, 'Clear visits')
    expect(has(l, 'Click a site above'), 'cktrack: clear visits')


def profile(pg):
    l = lab(pg, 'ckprofile')
    expect(has(l, 'No visits yet', 'not yet: nobody has logged in'), 'ckprofile: starts empty')
    for t in ('BMW 3 Series financing options', 'BMW 330i or Audi A4: lease compared', 'Car insurance comparison'):
        l.get_by_role('button', name=t + ' dealer.example', exact=False).first.click() if 'BMW 3 Series' in t or 'BMW 330i' in t else l.get_by_role('button', name=t, exact=False).first.click()
    bars = {b.locator('.ck-bl').inner_text().strip().lower(): int(b.locator('.ck-bp').inner_text().strip('%')) for b in l.locator('.ck-bar').all()}
    expect(bars.get('automotive', 0) > bars.get('travel', 0) and bars.get('automotive', 0) >= 50, 'ckprofile: three car pages make automotive the top guess')
    expect(has(l, 'statistical guesses, not facts'), 'ckprofile: says the guesses are not facts')
    l.get_by_role('button', name='Log in somewhere as Sam').click()
    expect(has(l, 'sam@mail.example', 'attached to a named person'), 'ckprofile: one login names the profile')
    l.get_by_role('button', name='Clear cookies (new ID)').click()
    expect(has(l, 'fresh ID', 'empty history'), 'ckprofile: clearing cookies gives a new ID')
    l.get_by_role('button', name='Flights to Lisbon in May', exact=False).first.click()
    l.get_by_role('button', name='Log in somewhere as Sam').click()
    expect(has(l, 'merged from 2 IDs', 'joined the new history to the old one'), 'ckprofile: logging in again joins the old and new IDs')
    expect(any('travel' in k for k in {b.locator('.ck-bl').inner_text().strip().lower() for b in l.locator('.ck-bar').all()}) and 'automotive' in txt(l).lower(), 'ckprofile: the merged profile holds both histories')
    l.get_by_role('button', name='Start over').click()
    expect(has(l, 'No visits yet'), 'ckprofile: start over')


def persist(pg):
    l = lab(pg, 'ckpersist')
    expect(has(l, 'First-party cookie · Clear cookies', 'The cookie is deleted'), 'ckpersist: the first cell is selected')
    l.locator('.ck-cell[data-m=ls][data-a=clear]').click()
    expect(has(l, 'Deleting only cookies leaves localStorage'), 'ckpersist: clearing only cookies leaves localStorage')
    l.locator('.ck-cell[data-m=fp][data-a=clear]').click()
    expect(has(l, 'recomputed from your device'), 'ckpersist: a fingerprint is not stored')
    expect(l.locator('.ck-cell').count() == 36, 'ckpersist: six methods by six actions')
    row = l.locator('.ck-cell[data-m=id]')
    expect(all('ck-bad' in (row.nth(i).get_attribute('class') or '') for i in range(6)), 'ckpersist: an account login survives everything')
    expect('ck-ok' in (l.locator('.ck-cell[data-m=c3][data-a=prot]').get_attribute('class') or ''), 'ckpersist: default protections stop third-party cookies')
    expect(l.locator('.ck-cell[data-m=ls][data-a=clear]').get_attribute('aria-pressed') == 'false' and l.locator('.ck-cell[data-m=fp][data-a=clear]').get_attribute('aria-pressed') == 'true', 'ckpersist: aria-pressed follows the selection')


def finger(pg):
    l = lab(pg, 'ckfinger')
    counts = lambda: [int(x.replace(',', '')) for x in [e.inner_text() for e in l.locator('.ck-fn').all()]]
    c = counts()
    expect(c[0] == 100000 and len(c) == 2 and 15000 < c[1] < 19000, 'ckfinger: 100,000 browsers, about 17 percent of them are Macs (%s)' % (c,))
    for k in ('browser', 'screen size', 'time zone', 'language', 'installed fonts', 'graphics rendering'):
        l.get_by_role('checkbox', name=k).check()
    c = counts()
    expect(len(c) == 8 and all(c[i] >= c[i + 1] for i in range(7)), 'ckfinger: every added detail can only shrink the crowd (%s)' % (c,))
    expect(c[-1] > 0, 'ckfinger: the commonest setup still hides in a crowd (%d others)' % c[-1])
    l.locator('select[data-k=ft]').select_option('15')
    l.locator('select[data-k=cv]').select_option('15')
    c2 = counts()
    expect(c2[-1] < c[-1] and c2[-1] <= 2, 'ckfinger: an unusual font set and renderer leave almost nobody alike (%s)' % c2[-1])
    expect(has(l, 'bits of identity'), 'ckfinger: reports bits of identity')
    l.locator('summary').click()
    expect(has(l, 'Time zone', 'Screen', 'Language'), 'ckfinger: shows what this browser really reveals')
    first = pg.evaluate('window.__ckfp.build().length')
    expect(first == 100000, 'ckfinger: the population is 100,000')


def sort(pg):
    l = lab(pg, 'cksort')
    expect(has(l, '1 of 14', 'sessionid'), 'cksort: starts with the first cookie')
    l.get_by_role('button', name='Strictly necessary', exact=True).click()
    expect(has(l, 'Right', 'Keeps you logged in'), 'cksort: right answer explained')
    l.get_by_role('button', name='Next cookie').click()
    l.get_by_role('button', name='Analytics', exact=True).click()
    expect(has(l, 'Not quite', 'Strictly necessary'), 'cksort: wrong answer shows the right category')
    expect(l.get_by_role('button', name='Strictly necessary', exact=True).is_disabled(), 'cksort: buttons lock after answering')
    for _ in range(12):
        l.get_by_role('button', name='Next cookie').click() if l.get_by_role('button', name='Next cookie').count() else l.get_by_role('button', name='See the result').click()
        l.get_by_role('button', name='Strictly necessary', exact=True).click()
    l.get_by_role('button', name='See the result').click()
    expect(has(l, '5 of 14', 'Who actually uses these cookies', 'An ad network'), 'cksort: answering Strictly necessary every time, apart from one deliberate miss, scores 5 of the 6 necessary cookies')
    l.get_by_role('button', name='Play again').click()
    expect(has(l, '1 of 14'), 'cksort: play again')


def page_checks(p):
    # themes, phone width and errors across the whole chapter
    for theme in ('light', 'dark'):
        pg = p.new_page(viewport={'width': 1000, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(BASE + 'cookies')
        pg.wait_for_timeout(500)
        pg.evaluate("t => { document.documentElement.setAttribute('data-theme', t) }", theme)
        pg.wait_for_timeout(200)
        n = pg.locator('.wmount .wg').count()
        bad = pg.evaluate('''() => [...document.querySelectorAll('.wmount .wg')].filter(w => { const r = w.getBoundingClientRect(); return r.width < 100 }).length''')
        expect(n == 9 and bad == 0, 'all nine labs render in the %s theme' % theme)
        expect(not errs, 'no console errors in the %s theme: %s' % (theme, errs[:2]))
        pg.close()
    pg = p.new_page(viewport={'width': 390, 'height': 800})
    pg.goto(BASE + 'cookies')
    pg.wait_for_timeout(600)
    over = pg.evaluate('''() => {
      const W = window.innerWidth, bad = [];
      document.querySelectorAll('.wmount .wg').forEach(w => {
        const r = w.getBoundingClientRect();
        if (r.right > W + 1 || r.left < -1) bad.push(w.querySelector('h4').textContent);
      });
      return {bad: bad, page: document.documentElement.scrollWidth - W};
    }''')
    expect(not over['bad'] and over['page'] <= 1, 'nothing overflows a 390px screen (labs: %s, page: %spx)' % (over['bad'], over['page']))
    pg.close()


TESTS = [engine, dance, builder, shop, attack, track, profile, persist, finger, sort]

with sync_playwright() as p:
    b = p.chromium.launch()
    for t in TESTS:
        pg = b.new_page(viewport={'width': 1000, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        try:
            t(pg)
        except Exception as e:   # one failing lab must not hide the others
            expect(False, '%s raised %s' % (t.__name__, str(e).split('\n')[0][:200]))
        expect(not errs, '%s: no page errors %s' % (t.__name__, errs[:1]))
        pg.close()
    page_checks(b)
    b.close()
print('\nproblems:', len(problems))
sys.exit(1 if problems else 0)
