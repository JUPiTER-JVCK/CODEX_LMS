#!/usr/bin/env python3
"""Compile every filter on the Wireshark cheat sheet (chapters/ch_7_wsref.py) with the real tools.

Display filters must be accepted by tshark; capture filters must compile with dumpcap; and every filter the
"mistakes" table calls wrong must really be rejected, while its fix is accepted. Exit 1 on any failure.
"""
import importlib.util, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'chapters'))
spec = importlib.util.spec_from_file_location('wsref', os.path.join(ROOT, 'chapters/ch_7_wsref.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
PCAP = os.path.join(ROOT, 'test/pcaps/login.pcap')
if not os.path.exists(PCAP):
    subprocess.run(['node', os.path.join(ROOT, 'tools/pcapgen.js'), os.path.join(ROOT, 'test/pcaps')], check=True, capture_output=True)


def display_ok(f):
    r = subprocess.run(['tshark', '-r', PCAP, '-Y', f, '-c', '1'], capture_output=True, text=True)
    return r.returncode == 0, r.stderr.strip().splitlines()[-1:] if r.returncode else ''


def capture_ok(f):
    # -d compiles the filter to BPF for the interface's link type and prints it; nothing is captured.
    # dumpcap can exit 0 on a bad filter when its output is not a terminal, so require the compiled program.
    r = subprocess.run(['dumpcap', '-i', 'lo', '-f', f, '-d'], capture_output=True, text=True)
    ok = r.returncode == 0 and '(000)' in r.stdout and 'Invalid capture filter' not in r.stderr
    return ok, '' if ok else r.stderr.strip()


bad = 0
for f in sorted(set(m.DISPLAY)):
    ok, err = display_ok(f)
    if not ok:
        bad += 1
        print('DISPLAY FILTER REJECTED', repr(f), err)
for f in sorted(set(m.CAPTURE)):
    ok, err = capture_ok(f)
    if not ok:
        bad += 1
        print('CAPTURE FILTER REJECTED', repr(f), err)
if capture_ok('tcp prot 80')[0]:
    bad += 1
    print('CHECKER BROKEN: dumpcap accepted an invalid capture filter')
for wrong, fix, _ in m.BROKEN:
    if display_ok(wrong)[0]:
        bad += 1
        print('SAID TO BE WRONG BUT ACCEPTED', repr(wrong))
    if not display_ok(fix)[0]:
        bad += 1
        print('FIX REJECTED', repr(fix))
print(len(set(m.DISPLAY)), 'display filters,', len(set(m.CAPTURE)), 'capture filters,', len(m.BROKEN), 'corrections,', bad, 'failures')
sys.exit(1 if bad else 0)
