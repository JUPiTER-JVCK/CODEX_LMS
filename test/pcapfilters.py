#!/usr/bin/env python3
"""Check the in-page display-filter engine against real tshark on every lab capture. Exit 1 on any mismatch."""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILTERS = [
    'dns', 'tcp', 'udp', 'arp', 'icmp', 'http', 'tls', '!tcp', 'ip.addr == 192.168.1.60', 'ip.addr != 192.168.1.23', 'ip.src == 192.168.1.0/24',
    'ip.dst == 203.0.113.0/24 && tcp.port == 443', 'tcp.flags.syn == 1 && tcp.flags.ack == 0', 'tcp.flags.syn == 1 && tcp.flags.ack == 1',
    'tcp.flags.reset == 1', 'tcp.flags == 0x012', 'tcp.port in {22, 80, 445}', 'tcp.dstport in {1..1024}', 'tcp.len > 0', 'frame.len > 200',
    'http.request.method == "POST"', 'http.request', 'http.response.code == 302', 'http.authorization', 'http contains "pass"', 'frame contains "hunter2"',
    'http.host == "intranet.lab.example"', 'http.cookie contains "session"', 'tls.handshake.type == 1', 'tls.handshake.extensions_server_name contains "lab"',
    'dns.qry.name contains "cdn-sync"', 'dns.qry.type == 16', 'dns.flags.response == 0', 'dns.qry.name matches "^[0-9]-"', 'dns.a == 203.0.113.10',
    'arp.opcode == 2', 'eth.src == 66:66:66:13:37:01', 'eth.addr == 66:66:66:13:37:01 && arp', 'arp.src.proto_ipv4 == 192.168.1.1',
    'arp.src.proto_ipv4 == 192.168.1.1 && !(eth.src == 3c:37:86:c1:5a:02)', 'udp.port == 53 and not dns.flags.response == 1', 'ip.ttl < 50', 'tcp.stream == 1',
    'icmp.type == 8', 'not arp and not dns', '(tcp.flags.syn == 1 || tcp.flags.fin == 1) && ip.src == 192.168.1.23', 'frame.number >= 10 && frame.number <= 12',
    'tcp.window_size_value == 0', 'http.user_agent contains "curl"', 'http.authbasic contains "admin"', 'tcp.ack == 0', 'dns.qry.name.len > 30', 'dns.qry.name.len > 30 && dns.flags.response == 0', 'tcp.srcport == 8080 || tcp.dstport == 8080',
]
node = r'''
const fs=require('fs'),vm=require('vm');const ctx={};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),ctx);const P=ctx.__pcap,F=JSON.parse(process.argv[2]),o={};
for(const id of Object.keys(P.SCEN)){o[id]={};for(const f of F){try{o[id][f]=P.run(id,f);}catch(e){o[id][f]='ERR '+e.message;}}}
console.log(JSON.stringify(o));'''
subprocess.run(['node', os.path.join(ROOT, 'tools/pcapgen.js'), os.path.join(ROOT, 'test/pcaps')], check=True, capture_output=True)
mine = json.loads(subprocess.run(['node', '-e', node, os.path.join(ROOT, 'src/ws-5-pcap.js'), json.dumps(FILTERS)], capture_output=True, text=True, check=True).stdout)
bad = 0
for sid in mine:
    pc = os.path.join(ROOT, 'test/pcaps', sid + '.pcap')
    for f in FILTERS:
        r = subprocess.run(['tshark', '-r', pc, '-Y', f, '-T', 'fields', '-e', 'frame.number'], capture_output=True, text=True)
        real = [int(x) for x in r.stdout.split()] if r.returncode == 0 else 'ERR ' + r.stderr.strip()[:80]
        if real != mine[sid][f]:
            bad += 1
            print('MISMATCH', sid, repr(f), '\n  tshark:', real, '\n  page:  ', mine[sid][f])
print(len(FILTERS) * len(mine), 'filter checks,', bad, 'mismatches')
sys.exit(1 if bad else 0)
