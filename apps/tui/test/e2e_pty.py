"""End to end: run the real terminal app in a pseudo-terminal, press keys and click, and read the screen back.

Uses the pyte terminal emulator, so this checks what a person would actually see, plus the plumbing the
headless tests cannot: raw mode, mouse reporting, resizing, and putting the terminal back on exit and on signals.

usage: python3 apps/tui/test/e2e_pty.py [path/to/codex-tui.mjs]     (needs: pip install pyte)
"""
import fcntl, json, os, pty, select, signal, struct, subprocess, sys, tempfile, termios, time
import pyte

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
BUNDLE = sys.argv[1] if len(sys.argv) > 1 and __name__ == '__main__' else None

class Term:
    def __init__(self, cols=130, rows=40, extra=(), env=None):
        self.cols, self.rows = cols, rows
        self.state = tempfile.mktemp(suffix='.json')
        self.screen = pyte.Screen(cols, rows)
        self.stream = pyte.ByteStream(self.screen)
        self.raw = b''
        m, s = pty.openpty()
        self.set_size(m, cols, rows)
        cmd = ['node', BUNDLE] if BUNDLE else ['node', '--import', 'tsx', os.path.join(ROOT, 'apps/tui/src/cli.ts')]
        cmd += ['--no-splash', '--theme', 'dark', '--state', self.state, *extra]
        e = dict(os.environ, TERM='xterm-256color', COLORTERM='truecolor', LANG='en_US.UTF-8', **(env or {}))
        e.pop('NO_COLOR', None)
        self.p = subprocess.Popen(cmd, stdin=s, stdout=s, stderr=s, env=e, cwd=ROOT, preexec_fn=os.setsid, close_fds=True)
        os.close(s)
        self.fd = m

    @staticmethod
    def set_size(fd, cols, rows):
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))

    def pump(self, secs=0.3):
        end = time.time() + secs
        while time.time() < end:
            r, _, _ = select.select([self.fd], [], [], 0.05)
            if r:
                try: d = os.read(self.fd, 65536)
                except OSError: return
                if not d: return
                self.raw += d
                self.stream.feed(d)

    def text(self):
        return '\n'.join(self.screen.display)

    def wait(self, needle, secs=8):
        end = time.time() + secs
        while time.time() < end:
            self.pump(0.15)
            if needle in self.text(): return True
        return False

    def send(self, s, settle=0.35):
        os.write(self.fd, s.encode() if isinstance(s, str) else s)
        self.pump(settle)

    def click(self, x, y):
        self.send(f'\x1b[<0;{x + 1};{y + 1}M', 0.05); self.send(f'\x1b[<0;{x + 1};{y + 1}m', 0.3)

    def find(self, s):
        for y, row in enumerate(self.screen.display):
            x = row.find(s)
            if x >= 0: return x, y
        return None

    def close(self):
        if self.p.poll() is None:
            os.killpg(self.p.pid, signal.SIGKILL)
        try: os.close(self.fd)
        except OSError: pass

bad = []
def check(cond, msg):
    print('ok  ' if cond else 'FAIL', msg)
    if not cond: bad.append(msg)

def main():
    t = Term()
    try:
        check(t.wait('CONTENTS'), 'starts up and draws the sidebar')
        check('Welcome: How This Book Works' in t.text(), 'first chapter is showing')
        check(t.wait('Search'), 'top bar has the search button')
        raw = t.raw.decode('utf8', 'replace')
        check('\x1b[?1049h' in raw, 'enters the alternate screen')
        check('\x1b[?1006h' in raw, 'turns on SGR mouse reporting')
        check('\x1b[?25l' in raw, 'hides the cursor while running')

        t.send('n')
        check(t.wait('Setting Up Your Lab'), 'n opens the next chapter')
        time.sleep(0.4); t.pump(0.2)
        check(json.load(open(t.state)).get('last') == 'setup', 'the place is saved to the state file')

        pos = t.find('How Computers Work')
        check(pos is not None and pos[0] < 32, 'a later chapter is listed in the sidebar')
        if pos: t.click(pos[0] + 2, pos[1])
        check(t.wait('CHAPTER 02'), 'clicking it with the mouse opens it')

        t.send('/'); t.send('addressing', 0.5)
        check('Search' in t.text() and 'result' in t.text(), 'search opens and filters')
        t.send('\r', 0.6)
        check(t.wait('CHAPTER 04'), 'enter opens the first match (the Addressing chapter)')

        check(t.screen.buffer[10][60].bg != 'default', 'text cells carry the theme background, not the terminal default')
        before = t.screen.buffer[10][60].bg
        t.send('t', 0.5)
        t.send('t', 0.5)
        after = t.screen.buffer[10][60].bg
        check(before != after, 'the theme change repaints with different colours (%s -> %s)' % (before, after))

        t.send('\x1b[<65;80;20M', 0.2); t.send('\x1b[<65;80;20M', 0.4)
        check('%' in t.screen.display[-1], 'the status bar shows how far you have read')

        t.cols, t.rows = 90, 28
        Term.set_size(t.fd, 90, 28); os.killpg(t.p.pid, signal.SIGWINCH); t.pump(0.7)
        check(t.screen.display[0].lstrip().startswith('☰') or 'CODEX_LMS' in t.screen.display[0], 'still drawing after the terminal was resized')

        t.send('q', 0.8)
        for _ in range(30):
            if t.p.poll() is not None: break
            t.pump(0.1)
        check(t.p.poll() == 0, 'q quits with exit code 0 (got %r)' % t.p.poll())
        raw = t.raw.decode('utf8', 'replace')
        check('\x1b[?1049l' in raw and '\x1b[?25h' in raw and '\x1b[?1000l' in raw, 'the terminal is put back: main screen, cursor, mouse off')
    finally:
        t.close()

    # a signal must restore the terminal too
    t = Term()
    try:
        t.wait('CONTENTS')
        os.killpg(t.p.pid, signal.SIGTERM)
        for _ in range(30):
            if t.p.poll() is not None: break
            t.pump(0.1)
        t.pump(0.3)
        raw = t.raw.decode('utf8', 'replace')
        check(t.p.poll() is not None, 'SIGTERM ends it')
        check('\x1b[?1049l' in raw and '\x1b[?25h' in raw, 'SIGTERM still restores the terminal')
    finally:
        t.close()

    # it must say so, not hang, when there is no terminal
    r = subprocess.run(['node', '--import', 'tsx', os.path.join(ROOT, 'apps/tui/src/cli.ts')] if not BUNDLE else ['node', BUNDLE],
                       input=b'', capture_output=True, cwd=ROOT, timeout=30)
    check(r.returncode == 1 and b'interactive terminal' in r.stderr, 'without a terminal it explains itself and exits 1')
    r = subprocess.run(['node', '--import', 'tsx', os.path.join(ROOT, 'apps/tui/src/cli.ts'), '--list'] if not BUNDLE else ['node', BUNDLE, '--list'],
                       capture_output=True, cwd=ROOT, timeout=30)
    check(r.returncode == 0 and b'How Computers Work' in r.stdout, '--list works in a pipe')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
