#!/usr/bin/env python3
"""Compile every filter on the Wireshark cheat sheet (chapters/ch_7_wsref.py) with the real tools.

Display filters must be accepted by tshark; capture filters must compile with libpcap (as dumpcap would); and every filter the
"mistakes" table calls wrong must really be rejected, while its fix is accepted. Exit 1 on any failure.
"""
import ctypes, ctypes.util, importlib.util, os, subprocess, sys
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


class _Prog(ctypes.Structure):
    _fields_ = [('bf_len', ctypes.c_uint), ('bf_insns', ctypes.c_void_p)]


_pcap = ctypes.CDLL(ctypes.util.find_library('pcap') or 'libpcap.so.0.8')
_pcap.pcap_open_dead.restype = ctypes.c_void_p
_pcap.pcap_open_dead.argtypes = [ctypes.c_int, ctypes.c_int]
_pcap.pcap_compile.argtypes = [ctypes.c_void_p, ctypes.POINTER(_Prog), ctypes.c_char_p, ctypes.c_int, ctypes.c_uint32]
_pcap.pcap_geterr.restype = ctypes.c_char_p
_pcap.pcap_geterr.argtypes = [ctypes.c_void_p]
_pcap.pcap_freecode.argtypes = [ctypes.POINTER(_Prog)]
_dead = _pcap.pcap_open_dead(1, 65535)  # DLT_EN10MB: Ethernet, as on en0


def capture_ok(f):
    # Compile with libpcap itself, the compiler dumpcap and tcpdump use. pcap_open_dead needs no capture
    # permission, so this works for an unprivileged CI user (dumpcap -d has to open a device).
    prog = _Prog()
    if _pcap.pcap_compile(_dead, ctypes.byref(prog), f.encode(), 1, 0xffffffff) != 0:
        return False, _pcap.pcap_geterr(_dead).decode()
    _pcap.pcap_freecode(ctypes.byref(prog))
    return True, ''


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
    print('CHECKER BROKEN: libpcap accepted an invalid capture filter')
for wrong, fix, _ in m.BROKEN:
    if display_ok(wrong)[0]:
        bad += 1
        print('SAID TO BE WRONG BUT ACCEPTED', repr(wrong))
    if not display_ok(fix)[0]:
        bad += 1
        print('FIX REJECTED', repr(fix))
print(len(set(m.DISPLAY)), 'display filters,', len(set(m.CAPTURE)), 'capture filters,', len(m.BROKEN), 'corrections,', bad, 'failures')
sys.exit(1 if bad else 0)
