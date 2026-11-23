#!/usr/bin/env python3
"""Check the facts in the VPN and nmap chapters against the real tools.

1. Every capture filter and display filter the chapters show must be accepted: display filters by tshark, capture filters
   by libpcap (the compiler tcpdump and dumpcap use).
2. Every NSE script the nmap chapter names must exist in the installed nmap and belong to the categories claimed for it
   (in the chapter table and in the category lab). Category sizes are compared with the installed script database and must
   be within 10%; they are exact for the Nmap release the book was written against (7.94), and drift as nmap adds scripts.

usage: python3 test/netfilters.py        (needs tshark and nmap: apt install tshark nmap)
"""
import ctypes, ctypes.util, importlib.util, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'chapters'))


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, 'chapters', name + '.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


vpn, nmap = load('ch_8_vpn'), load('ch_8_nmap')
PCAP = os.path.join(ROOT, 'test/pcaps/login.pcap')
if not os.path.exists(PCAP):
    subprocess.run(['node', os.path.join(ROOT, 'tools/pcapgen.js'), os.path.join(ROOT, 'test/pcaps')], check=True, capture_output=True)


def ticks(cell):
    return re.findall(r'`([^`]+)`', cell)


def table(m, title):
    for b in m.CHAPTER['blocks']:
        if b['t'] == 'table' and b['title'] == title:
            return b
    raise SystemExit('table not found: ' + title)


# ---- the filters the chapters show
cap, disp = set(), set()
t = table(vpn, 'VPN protocols in a capture')
for row in t['rows']:
    cap.update(ticks(row[2])); disp.update(ticks(row[3]))
t = table(nmap, 'Scans in a capture')
for row in t['rows']:
    disp.update(ticks(row[2]))
disp.add('wg.type == 4 && udp.length == 40')       # the keepalive filter in the prose of the VPN chapter
assert len(cap) >= 5 and len(disp) >= 15, (cap, disp)


class _Prog(ctypes.Structure):
    _fields_ = [('bf_len', ctypes.c_uint), ('bf_insns', ctypes.c_void_p)]


_pcap = ctypes.CDLL(ctypes.util.find_library('pcap') or 'libpcap.so.0.8')
_pcap.pcap_open_dead.restype = ctypes.c_void_p
_pcap.pcap_open_dead.argtypes = [ctypes.c_int, ctypes.c_int]
_pcap.pcap_compile.argtypes = [ctypes.c_void_p, ctypes.POINTER(_Prog), ctypes.c_char_p, ctypes.c_int, ctypes.c_uint32]
_pcap.pcap_geterr.restype = ctypes.c_char_p
_pcap.pcap_geterr.argtypes = [ctypes.c_void_p]
_pcap.pcap_freecode.argtypes = [ctypes.POINTER(_Prog)]
_dead = _pcap.pcap_open_dead(1, 65535)


def capture_ok(f):
    prog = _Prog()
    if _pcap.pcap_compile(_dead, ctypes.byref(prog), f.encode(), 1, 0xffffffff) != 0:
        return False, _pcap.pcap_geterr(_dead).decode()
    _pcap.pcap_freecode(ctypes.byref(prog))
    return True, ''


def display_ok(f):
    r = subprocess.run(['tshark', '-r', PCAP, '-Y', f, '-c', '1'], capture_output=True, text=True)
    return r.returncode == 0, r.stderr.strip().splitlines()[-1:] if r.returncode else ''


bad = 0
for f in sorted(disp):
    ok, err = display_ok(f)
    print(('ok   display ' if ok else 'FAIL display ') + f, '' if ok else err)
    bad += not ok
for f in sorted(cap):
    ok, err = capture_ok(f)
    print(('ok   capture ' if ok else 'FAIL capture ') + f, '' if ok else err)
    bad += not ok
if capture_ok('udp prot 51820')[0] or display_ok('wg.nonsense == 1')[0]:
    bad += 1
    print('CHECKER BROKEN: an invalid filter was accepted')

# ---- NSE scripts
SCRIPTS = '/usr/share/nmap/scripts'
for cand in ('/usr/share/nmap/scripts', '/opt/homebrew/share/nmap/scripts', '/usr/local/share/nmap/scripts'):
    if os.path.isdir(cand):
        SCRIPTS = cand
        break


def cats(script):
    p = os.path.join(SCRIPTS, script + '.nse')
    if not os.path.exists(p):
        return None
    m = re.search(r'categories\s*=\s*\{([^}]*)\}', open(p, encoding='utf-8', errors='replace').read())
    return set(re.findall(r'["\'](\w+)["\']', m.group(1))) if m else set()


claims = []       # (script, categories it must have, where)
t = table(nmap, 'Scripts for your own network')
for row in t['rows']:
    want = {c.strip() for c in row[1].split(',')}
    for name in ticks(row[0]):
        claims.append((name, want, 'script table'))
src = open(os.path.join(ROOT, 'src/ws-9-nmap.js'), encoding='utf-8').read()
NSE = re.findall(r"\{ id: '(\w+)', n: (\d+), risk: '\w+', what: '(?:[^'\\]|\\.)*', ex: \[([^\]]*)\]", src)
assert len(NSE) == 14, len(NSE)
db = open(os.path.join(SCRIPTS, 'script.db'), encoding='utf-8').read().splitlines()
size = {}
for line in db:
    m = re.search(r'categories = \{(.*?)\}', line)
    if m:
        for c in re.findall(r'"(\w+)"', m.group(1)):
            size[c] = size.get(c, 0) + 1
for cid, n, ex in NSE:
    for name in re.findall(r"'([^']+)'", ex):
        claims.append((name, {cid}, 'category lab: ' + cid))
    have = size.get(cid, 0)
    ok = abs(have - int(n)) <= max(2, 0.1 * int(n))
    print(('ok   ' if ok else 'FAIL ') + 'category %s: lab says %s scripts, installed nmap has %d' % (cid, n, have))
    bad += not ok
for name, want, where in claims:
    got = cats(name)
    ok = got is not None and want <= got
    print(('ok   ' if ok else 'FAIL ') + 'script %s in %s (%s)%s' % (name, ', '.join(sorted(want)), where, '' if ok else '  -> has %s' % (sorted(got) if got is not None else 'no such script')))
    bad += not ok

print('problems:', bad)
sys.exit(1 if bad else 0)
