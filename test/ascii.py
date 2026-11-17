"""Check that ASCII diagrams render on a true monospace grid.

For every <pre> that contains box-drawing characters, every distinct character is measured in the browser and compared with
the width of one grid cell (times its display columns). A glyph with a different advance has fallen back to another
font, which is what makes box borders wobble. It also checks that every element meant to show aligned text (code,
command output, anatomy lines, results) really renders in a monospace face.

usage: python3 test/ascii.py [CHAPTER_ID ...]       (needs dist/ served on http://localhost:8765)
"""
import sys
from playwright.sync_api import sync_playwright

JS = r"""
() => {
  const BOX = /[─-╿▀-▟■-◿]/;
  const wide = (cp) => (cp >= 0x1100 && cp <= 0x115F) || (cp >= 0x2E80 && cp <= 0xA4CF) || (cp >= 0xAC00 && cp <= 0xD7A3) ||
    (cp >= 0xF900 && cp <= 0xFAFF) || (cp >= 0xFE30 && cp <= 0xFE6F) || (cp >= 0xFF00 && cp <= 0xFF60) || (cp >= 0xFFE0 && cp <= 0xFFE6) ||
    (cp >= 0x1F300 && cp <= 0x1FAFF);
  const cols = (s) => { let n = 0; for (const ch of s) { const cp = ch.codePointAt(0); n += (cp >= 0x300 && cp <= 0x36F) ? 0 : wide(cp) ? 2 : 1; } return n; };
  const out = [];
  for (const pre of document.querySelectorAll('#page .cb:not(.term) pre, #page .hero pre')) {
    const text = pre.textContent;
    if (!BOX.test(text)) continue;
    const cs = getComputedStyle(pre);
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    for (const k of ['fontFamily','fontSize','fontWeight','fontStyle','fontVariantLigatures','fontFeatureSettings','letterSpacing','textRendering']) probe.style[k] = cs[k];
    document.body.appendChild(probe);
    probe.textContent = 'M'.repeat(100);
    const cw = probe.getBoundingClientRect().width / 100;
    // measure every distinct character on its own (20 in a row): a glyph from a fallback font has a different advance
    const bad = [];
    for (const ch of new Set([...text].filter((c) => c !== '\n'))) {
      probe.textContent = ch.repeat(20);
      const adv = probe.getBoundingClientRect().width / 20, want = cols(ch) * cw;
      if (Math.abs(adv - want) > 0.15) bad.push({ ch, adv: +adv.toFixed(2), want: +want.toFixed(2) });
    }
    probe.remove();
    if (bad.length) out.push({ font: cs.fontFamily.split(',')[0], cw, bad });
  }
  // anything showing aligned text must resolve to a monospace face: 'iiiiiiiiii' and 'MMMMMMMMMM' must be equally wide
  const MONO = '#page .cb pre, #page .cb .o, #page .an .line, #page .res, #page textarea.ed, #page .lb-pre, #page .lb-mono, #page .term-ui, #page .hero pre';
  const seen = new Set();
  for (const e of document.querySelectorAll(MONO)) {
    const cs = getComputedStyle(e), key = cs.fontFamily + cs.fontSize;
    if (seen.has(key)) continue;
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    for (const k of ['fontFamily','fontSize','fontWeight','fontStyle']) probe.style[k] = cs[k];
    document.body.appendChild(probe);
    probe.textContent = 'i'.repeat(20); const wi = probe.getBoundingClientRect().width;
    probe.textContent = 'M'.repeat(20); const wm = probe.getBoundingClientRect().width;
    probe.remove();
    seen.add(key);
    if (Math.abs(wi - wm) > 0.5) out.push({ font: cs.fontFamily.split(',')[0], cw: wm / 20, bad: [{ ch: `<${e.tagName.toLowerCase()} class="${e.className}"> is not monospace`, adv: +(wi / 20).toFixed(2), want: +(wm / 20).toFixed(2) }] });
  }
  return out;
}
"""


def main():
    ids = sys.argv[1:]
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
                chars = ' '.join(f"{x['ch']}({x['adv']}px, want {x['want']})" for x in blk['bad'][:8])
                print(f"{cid}: font {blk['font']} (cell {blk['cw']:.2f}px): glyphs off the grid: {chars}")
        print('page errors:', errs)
        b.close()
    print('problems:', problems)
    sys.exit(1 if problems or errs else 0)


if __name__ == '__main__':
    main()
