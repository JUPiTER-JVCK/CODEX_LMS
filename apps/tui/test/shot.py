"""Dev tool: run the real terminal app in a pty, send some input, and save what it shows as a PNG.

usage: python3 apps/tui/test/shot.py OUT.png [--cols 130] [--rows 40] [--chapter ID] [--keys "n n /"] [--theme dark|light] [--splash]
Keys are space separated: single characters are typed; names like Enter, Esc, Tab, Down, PgDn are special;
click:X,Y clicks a cell; wait:SECONDS pauses.
"""
import argparse, os, sys, html, time
sys.path.insert(0, os.path.dirname(__file__))
import e2e_pty as E

NAMED = {'Enter': '\r', 'Esc': '\x1b', 'Tab': '\t', 'Down': '\x1b[B', 'Up': '\x1b[A', 'PgDn': '\x1b[6~', 'PgUp': '\x1b[5~', 'Space': ' ', 'Right': '\x1b[C', 'Left': '\x1b[D'}
NAMES16 = {'black': '000000', 'red': 'cd0000', 'green': '00cd00', 'brown': 'cdcd00', 'blue': '0000ee', 'magenta': 'cd00cd', 'cyan': '00cdcd', 'white': 'e5e5e5',
           'brightblack': '7f7f7f', 'brightred': 'ff0000', 'brightgreen': '00ff00', 'brightbrown': 'ffff00', 'brightblue': '5c5cff', 'brightmagenta': 'ff00ff', 'brightcyan': '00ffff', 'brightwhite': 'ffffff'}

def color(c, default):
    if c == 'default': return default
    return '#' + NAMES16.get(c, c)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out'); ap.add_argument('--cols', type=int, default=130); ap.add_argument('--rows', type=int, default=40)
    ap.add_argument('--chapter', default=''); ap.add_argument('--keys', default=''); ap.add_argument('--theme', default='dark'); ap.add_argument('--splash', action='store_true')
    a = ap.parse_args()
    extra = ['--theme', a.theme] + ([] if a.splash else [])
    t = E.Term(a.cols, a.rows, extra=extra)
    if a.splash:
        t.p.kill()
    try:
        t.pump(1.6 if not a.splash else 0.9)
        if a.chapter:
            t.send('/'); t.send(a.chapter, 0.4); t.send('\r', 0.6)
        for k in a.keys.split():
            if k.startswith('click:'):
                x, y = map(int, k[6:].split(',')); t.click(x, y)
            elif k.startswith('wait:'): t.pump(float(k[5:]))
            elif k in NAMED: t.send(NAMED[k], 0.4)
            else: t.send(k, 0.4)
        t.pump(0.5)
        dbg, dfg = ('#09090b', '#ececee') if a.theme == 'dark' else ('#fafafa', '#18181b')
        rows = []
        for y in range(a.rows):
            cells = []
            for x in range(a.cols):
                ch = t.screen.buffer[y][x]
                if ch.data == '': continue
                fg, bg = color(ch.fg, dfg), color(ch.bg, dbg)
                if ch.reverse: fg, bg = bg, fg
                st = f'color:{fg};background:{bg};' + ('font-weight:700;' if ch.bold else '') + ('font-style:italic;' if ch.italics else '') + ('text-decoration:underline;' if ch.underscore else '')
                w = 2 if len(ch.data) and ord(ch.data[0]) > 0x1100 and E.pyte.screens.wcwidth(ch.data[0]) == 2 else 1
                cells.append(f'<i style="{st}width:{w}ch">{html.escape(ch.data) if ch.data != " " else "&nbsp;"}</i>')
            rows.append('<div>' + ''.join(cells) + '</div>')
        font = os.path.join(E.ROOT, 'src/fonts/JetBrainsMono-latin-wght-normal.woff2')
        page = f'''<!doctype html><meta charset=utf-8><style>
@font-face{{font-family:JB;src:url(file://{font});font-weight:100 800}}
body{{margin:0;background:{dbg};padding:10px}}
div{{height:19px;white-space:nowrap;font:14px/19px JB,"DejaVu Sans Mono",monospace}}
i{{display:inline-block;font-style:normal;overflow:visible;height:19px}}
</style>{''.join(rows)}'''
        tmp = '/tmp/shot.html'; open(tmp, 'w').write(page)
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_page(viewport={'width': int(a.cols * 8.4 + 24), 'height': a.rows * 19 + 24}, device_scale_factor=1.5)
            pg.goto('file://' + tmp); pg.wait_for_timeout(300); pg.screenshot(path=a.out); b.close()
        print('wrote', a.out)
    finally:
        t.close()

if __name__ == '__main__':
    main()
