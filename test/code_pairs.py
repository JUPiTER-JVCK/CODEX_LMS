"""Every Python/JavaScript pair in the Learn to Code part must print the same thing.

usage: python3 test/code_pairs.py        (run after python3 tools/chapters.py; needs node on the PATH)

For each codestep and codetry widget in data/new/ch_code_*.json the JavaScript version is run with node and compared with
what the Python version printed when the book was built. A codestep example that is meant to crash is skipped, because the
two languages report errors differently. Also checks that the stepper's line map points at real lines.
"""
import glob, json, os, subprocess, sys, tempfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def walk(blocks):
    for b in blocks:
        yield b
        if b['t'] in ('callout', 'project'):
            yield from walk(b['blocks'])


def run_js(src):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
        f.write(src)
    try:
        r = subprocess.run(['node', f.name], capture_output=True, text=True, timeout=20)
    finally:
        os.unlink(f.name)
    return r.returncode, r.stdout.rstrip('\n'), r.stderr


bad = n = 0
for path in sorted(glob.glob(os.path.join(ROOT, 'data/new/ch_code_*.json'))):
    ch = json.load(open(path))
    for b in walk(ch['blocks']):
        if b['t'] != 'widget' or b['name'] not in ('codestep', 'codetry'):
            continue
        a = b['args']
        want = a['out'] if b['name'] == 'codetry' else a['steps'][-1]['out'].rstrip('\n')
        if b['name'] == 'codestep':
            if a['steps'][-1].get('err'):
                continue
            nlines = len(a['js'].split('\n'))
            if any(not (0 <= a['jm'][s['ln']] <= nlines) for s in a['steps'] if s['ln']):
                print('BAD line map', ch['id'], a['title']); bad += 1
        n += 1
        code, out, err = run_js(a['js'])
        if code != 0 or out != want:
            bad += 1
            print('MISMATCH in %s: %s' % (ch['id'], a['title']))
            print('  python printed:', repr(want)[:300])
            print('  node printed  :', repr(out)[:300], err.strip().split('\n')[0] if err else '')
print('%d paired examples checked, %d problems' % (n, bad))
sys.exit(1 if bad else 0)
