"""Check that ASCII diagrams and command output render on a true monospace grid.

Every line of every code block, diagram and command output is measured in the browser as it is really laid out and compared
with (display columns x the width of one grid cell). A line that is wider or narrower than that means some glyph came from a
font with a different advance, which is what makes box borders wobble. It also checks that every element meant to show aligned
text (code, command output, anatomy lines, results) renders in a monospace face.

Symbols such as box-drawing characters are often missing from a web font (the Google Fonts build of JetBrains Mono has none), so the
browser takes each from another font with a different cell width. The page pins every such glyph to one column; this test proves
it, on whatever fonts the machine has.

usage: python3 test/ascii.py [CHAPTER_ID ...]       (needs dist/ served on http://localhost:8765)
"""
import sys
from playwright.sync_api import sync_playwright

JS = r"""
() => {
  const wide = (cp) => (cp >= 0x1100 && cp <= 0x115F) || (cp >= 0x2E80 && cp <= 0xA4CF) || (cp >= 0xAC00 && cp <= 0xD7A3) ||
    (cp >= 0xF900 && cp <= 0xFAFF) || (cp >= 0xFE30 && cp <= 0xFE6F) || (cp >= 0xFF00 && cp <= 0xFF60) || (cp >= 0xFFE0 && cp <= 0xFFE6) ||
    (cp >= 0x1F300 && cp <= 0x1FAFF);
  const cols = (s) => { let n = 0; for (const ch of s) { const cp = ch.codePointAt(0); n += (cp >= 0x300 && cp <= 0x36F) ? 0 : wide(cp) ? 2 : 1; } return n; };
  const SYMBOL = /[←-⇿─-◿☀-➿⬀-⯿]/;
  document.querySelectorAll('details').forEach((d) => { d.open = true; });   // measure diagrams inside collapsed sections too
  const out = [];
  // 1) every line of every block that contains symbols must be exactly (columns x cell width) wide
  for (const el of document.querySelectorAll('#page .cb:not(.term) pre, #page .cb .o, #page .hero pre')) {
    const text = el.textContent;
    if (!SYMBOL.test(text) || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing']) probe.style[k] = cs[k];
    document.body.appendChild(probe);
    probe.textContent = 'M'.repeat(100);
    const cw = probe.getBoundingClientRect().width / 100;
    probe.remove();
    // map every UTF-16 unit to its text node so each line can be turned into a Range
    const units = [];
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) for (let i = 0; i < n.nodeValue.length; i++) units.push([n, i, n.nodeValue[i]]);
    const bad = [];
    let start = 0, row = 0;
    for (let i = 0; i <= units.length; i++) {
      if (i < units.length && units[i][2] !== '\n') continue;
      row++;
      if (i > start) {
        const line = units.slice(start, i).map((u) => u[2]).join('');
        if (line.trim()) {
          const r = document.createRange();
          r.setStart(units[start][0], units[start][1]);
          r.setEnd(units[i - 1][0], units[i - 1][1] + 1);
          const w = r.getBoundingClientRect().width, want = cols(line) * cw;
          if (Math.abs(w - want) > Math.max(1.6, want * 0.005)) bad.push({ row, got: +w.toFixed(1), want: +want.toFixed(1), line: line.slice(0, 60) });
        }
      }
      start = i + 1;
    }
    if (bad.length) out.push({ kind: 'lines', font: cs.fontFamily.split(',')[0], cw, bad });
  }
  // 2) anything showing aligned text must resolve to a monospace face: 'iiii' and 'MMMM' must be equally wide
  const MONO = '#page .cb pre, #page .cb .o, #page .an .line, #page .res, #page textarea.ed, #page .lb-pre, #page .lb-mono, #page .term-ui, #page .hero pre';
  const seen = new Set();
  for (const e of document.querySelectorAll(MONO)) {
    const cs = getComputedStyle(e), key = cs.fontFamily + cs.fontSize;
    if (seen.has(key)) continue;
    seen.add(key);
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle']) probe.style[k] = cs[k];
    document.body.appendChild(probe);
    probe.textContent = 'i'.repeat(20); const wi = probe.getBoundingClientRect().width;
    probe.textContent = 'M'.repeat(20); const wm = probe.getBoundingClientRect().width;
    probe.remove();
    if (Math.abs(wi - wm) > 0.5) out.push({ kind: 'font', font: cs.fontFamily.split(',')[0], cw: wm / 20, what: `<${e.tagName.toLowerCase()} class="${e.className}"> is not monospace` });
  }
  return out;
}
"""


def main():
    args = sys.argv[1:]
    ids = [a for a in args if not a.startswith('--')]
    problems = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1300, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://localhost:8765/index.html#welcome')
        pg.wait_for_timeout(800)
        chapters = ids or pg.evaluate("window.__BOOK.chapters.map(c=>c.id)")
        for cid in chapters:
            pg.evaluate(f"location.hash = '#{cid}'")
            pg.wait_for_timeout(250)
            for blk in pg.evaluate(JS):
                problems += 1
                if blk['kind'] == 'font':
                    print(f"{cid}: font {blk['font']}: {blk['what']}")
                else:
                    x = blk['bad'][0]
                    print(f"{cid}: font {blk['font']} (cell {blk['cw']:.2f}px): {len(blk['bad'])} line(s) off the grid, e.g. row {x['row']} is {x['got']}px, want {x['want']}px: {x['line']!r}")
        print('page errors:', errs)
        b.close()
    print('problems:', problems)
    sys.exit(1 if problems or errs else 0)


if __name__ == '__main__':
    main()
