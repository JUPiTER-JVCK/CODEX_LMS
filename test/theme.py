"""The theme button cycles System, Light, Dark; the choice survives a reload; System follows the OS live.

usage: python3 test/theme.py        (needs dist/ served on http://localhost:8765)
"""
import sys
from playwright.sync_api import sync_playwright

def bg(pg):
    return pg.evaluate("getComputedStyle(document.body).backgroundColor")

def main():
    bad = []
    def check(cond, msg):
        print('ok  ' if cond else 'FAIL', msg)
        if not cond: bad.append(msg)
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(color_scheme='dark')
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://localhost:8765/index.html#welcome'); pg.wait_for_timeout(700)
        label = lambda: pg.locator('#theme .tl').inner_text()
        attr = lambda: pg.evaluate("document.documentElement.getAttribute('data-theme')")
        dark_bg = bg(pg)
        check(label() == 'System' and attr() is None, 'starts on System with no forced theme')
        pg.emulate_media(color_scheme='light'); pg.wait_for_timeout(150)
        check(bg(pg) != dark_bg, 'System follows an OS change to light, live')
        pg.emulate_media(color_scheme='dark'); pg.wait_for_timeout(150)
        check(bg(pg) == dark_bg, 'and back to dark')
        pg.click('#theme'); check(label() == 'Light' and attr() == 'light', 'click 1: Light')
        light_bg = bg(pg)
        check(light_bg != dark_bg, 'Light is really light even though the OS is dark')
        pg.click('#theme'); check(label() == 'Dark' and attr() == 'dark', 'click 2: Dark')
        pg.emulate_media(color_scheme='light'); pg.wait_for_timeout(150)
        check(bg(pg) == dark_bg, 'forced Dark ignores an OS change to light')
        pg.wait_for_timeout(500)   # progress state is saved after a short debounce
        pg.reload(); pg.wait_for_timeout(700)
        check(label() == 'Dark' and attr() == 'dark', 'Dark survives a reload')
        pg.click('#theme'); check(label() == 'System' and attr() is None, 'click 3: back to System')
        check('Theme: system' in (pg.get_attribute('#theme', 'aria-label') or ''), 'accessible name describes the mode')
        check(not errs, 'no page errors ' + str(errs))
        b.close()
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
