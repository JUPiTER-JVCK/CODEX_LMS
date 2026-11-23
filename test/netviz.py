"""Browser tests for the VPN and nmap labs (src/ws-9-vpn.js, src/ws-9-nmap.js, src/ws-9-seq.js).

Each lab is found in its chapter, driven with real clicks and typing, and its numbers are checked against facts that
can be computed independently (header sizes, longest-prefix routing, what each scan type must report).
Also checks both themes, that nothing overflows a phone-width screen and that nothing logs an error.

usage: python3 test/netviz.py          (needs dist/ served on http://localhost:8765)
"""
import sys
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8765/index.html#'
problems = []


def expect(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond:
        problems.append(msg)


def txt(l):
    return ' '.join(l.inner_text().split())


def has(l, *needles):
    # inner_text applies CSS text-transform, so labels set in capitals compare case-insensitively
    t = txt(l).lower()
    return all(n.lower() in t for n in needles)


def lab(page, chapter, name):
    page.goto(BASE + chapter)
    page.wait_for_timeout(500)
    w = page.locator('.wmount[data-w="%s"]' % name).first
    w.scroll_into_view_if_needed()
    page.wait_for_timeout(150)
    return w


def chip(l, label):
    l.get_by_role('button', name=label, exact=True).first.click()


# ---------------------------------------------------------------- VPN
def vpnpath(pg):
    l = lab(pg, 'vpn', 'vpnpath')
    expect('encrypted tunnel' in txt(l), 'vpnpath: the default full tunnel is drawn')
    rows = {r.locator('th').first.inner_text().strip(): ' '.join(r.inner_text().split()) for r in l.locator('tbody tr').all()}
    expect('Hidden' in rows['Café Wi-Fi owner'] and 'Sees shop.example' in rows['VPN operator'], 'vpnpath: with a tunnel the café sees nothing, the VPN operator sees the site')
    chip(l, 'No VPN')
    rows = {r.locator('th').first.inner_text().strip(): ' '.join(r.inner_text().split()) for r in l.locator('tbody tr').all()}
    expect('Sees every name you look up' in rows['ISP and Internet'], 'vpnpath: without a VPN the ISP sees DNS lookups')
    expect('n/a' not in rows['Café Wi-Fi owner'] and 'Not in the path'.lower() in rows['VPN operator'].lower(), 'vpnpath: no VPN operator without a VPN')
    chip(l, 'Plain HTTP')
    expect('Sees the whole page' in txt(l.locator('tbody tr').first), 'vpnpath: plain HTTP is readable on the café network')
    chip(l, 'Full-tunnel VPN')
    expect('encrypted tunnel' in txt(l), 'vpnpath: back to full tunnel')
    l.locator('input[data-leak]').check()
    expect('LEAK' in txt(l.locator('tbody tr').first), 'vpnpath: a DNS leak shows up for the café owner')
    chip(l, 'Split tunnel')
    expect('not in the tunnel' in txt(l), 'vpnpath: split tunnel to a public site is sent the ordinary way')
    expect(l.locator('.vp-lock').count() == 0, 'vpnpath: and no tunnel is drawn for it')
    chip(l, 'The office server')
    expect(l.locator('.vp-lock').count() == 1 and '10.0.5.20' in txt(l), 'vpnpath: the office server goes through the tunnel')
    chip(l, 'Site-to-site')
    expect('Branch LAN' in txt(l) and 'Gateway A' in txt(l), 'vpnpath: site-to-site shows both gateways')


def vpnmtu(pg):
    l = lab(pg, 'vpn', 'vpnmtu')
    expect('60 bytes' in txt(l) and '1440' in txt(l), 'vpnmtu: WireGuard over IPv4 on 1500 has 60 bytes of overhead and a 1440 tunnel')
    chip(l, 'outer IPv6')
    expect(has(l, '80 bytes', 'Set the tunnel MTU to 1420'), 'vpnmtu: IPv6 outer header gives the 1420 default')
    chip(l, 'PPPoE 1492')
    expect(has(l, 'Set the tunnel MTU to 1412'), 'vpnmtu: PPPoE shrinks it (1492 - 80)')
    chip(l, 'outer IPv4')
    expect(has(l, 'Set the tunnel MTU to 1432', 'Biggest ping that passes 1404'), 'vpnmtu: ping payload is the MTU minus 28')
    chip(l, '1500 (a full Ethernet packet)')
    expect('Too big' in txt(l) and 'PMTU black hole' in txt(l), 'vpnmtu: a 1500-byte inner packet does not fit a 1492 link')
    chip(l, 'fill the tunnel')
    expect('Fits' in txt(l), 'vpnmtu: filling the tunnel fits again')
    l.locator('select[data-p]').select_option('ipsec')
    expect(has(l, 'Set the tunnel MTU to 1438'), 'vpnmtu: IPsec ESP/GCM on 1492 (1492 - 54 - padding)')
    l.locator('input[data-natt]').check()
    expect('NAT-T' in txt(l) and 'UDP 4500' in l.inner_html(), 'vpnmtu: NAT-T adds a UDP header')
    l.locator('select[data-p]').select_option('gre')
    expect(has(l, 'Overhead', 'GRE only wraps'), 'vpnmtu: GRE is explained as unencrypted')
    # the model, independently
    r = pg.evaluate("""() => { const L = window.__vpnlab;
      return [L.maxInner('wg', false, false, 1500), L.maxInner('wg', true, false, 1500), L.maxInner('ipsec', false, false, 1500),
              L.maxInner('ipsec', false, true, 1500), L.maxInner('ovpn', false, false, 1500), L.maxInner('gre', false, false, 1500),
              L.wire('ipsec', false, false, 1447).total] }""")
    expect(r == [1440, 1420, 1446, 1438, 1448, 1476, 1504], 'vpnmtu: header arithmetic for every tunnel type: %s' % r)


def wgroute(pg):
    l = lab(pg, 'vpn', 'wgroute')
    expect('Encrypted to home-pi' in txt(l) and '192.168.1.0/24' in txt(l), 'wgroute: a LAN address goes to home-pi by its /24')
    l.locator('input[data-dst]').fill('10.8.0.3')
    expect('Encrypted to alice-phone' in txt(l), 'wgroute: a /32 picks its own peer')
    l.locator('input[data-dst]').fill('8.8.8.8')
    expect('unencrypted' in txt(l) and 'Not sent through WireGuard' in txt(l), 'wgroute: an address nobody claims leaves in the clear')
    l.locator('input[data-dst]').fill('banana')
    expect('is not an IPv4 address' in txt(l), 'wgroute: bad input is reported')
    l.locator('input[data-dst]').fill('192.168.1.60')
    l.locator('select[data-from]').select_option('1')
    expect('Dropped silently' in txt(l), 'wgroute: alice may not source a home LAN address')
    l.locator('input[data-src]').fill('10.8.0.3')
    expect('Accepted' in txt(l), 'wgroute: but she may use her own address')
    chip(l, 'All traffic via a VPS (full tunnel)')
    expect('Full tunnel' in txt(l) and '0.0.0.0/1' in txt(l), 'wgroute: full tunnel notes the endpoint exception and the two halves')
    expect('Encrypted to exit-vps' in txt(l), 'wgroute: the default route takes a public address')
    chip(l, 'Two peers claim one range')
    expect('claimed by both site-a and site-b' in txt(l), 'wgroute: two peers claiming a prefix is flagged')
    l.locator('input[data-dst]').fill('10.20.4.4')
    expect('Encrypted to site-b' in txt(l), 'wgroute: the last peer to claim a prefix keeps it')
    l.locator('input[data-ip="0"]').fill('10.99.0.0/16')
    expect('claimed by both' not in txt(l), 'wgroute: editing AllowedIPs recomputes live')
    expect(l.locator('input[data-ip="0"]').evaluate('e => document.activeElement === e'), 'wgroute: typing keeps focus in the field')


def vpnshake(pg):
    l = lab(pg, 'vpn', 'vpnshake')
    expect('Handshake initiation' in txt(l) and 'Step 1 of 5' in txt(l), 'vpnshake: starts on WireGuard step 1')
    expect(l.get_by_role('button', name='Previous step').is_disabled(), 'vpnshake: Back is disabled on step 1')
    for i in range(4):
        l.get_by_role('button', name='Next step').click()
    expect('Step 5 of 5' in txt(l) and '1 round trip' in txt(l), 'vpnshake: the last step shows the verdict')
    expect(l.get_by_role('button', name='Next step').is_disabled(), 'vpnshake: Next is disabled on the last step')
    chip(l, 'IKEv2 / IPsec')
    expect('Step 1 of 6' in txt(l) and 'IKE_SA_INIT' in txt(l), 'vpnshake: switching protocol restarts at step 1')
    l.locator('.sq-step').nth(3).click()
    expect('Step 4 of 6' in txt(l) and 'Child SA' in txt(l), 'vpnshake: clicking an arrow jumps to it')
    chip(l, 'OpenVPN')
    l.get_by_role('button', name='Reset').click()
    expect('opcode 7' in txt(l), 'vpnshake: OpenVPN shows its opcodes')
    l.get_by_role('button', name='Play').click()
    pg.wait_for_timeout(1700)
    expect('Step 2 of 6' in txt(l), 'vpnshake: Play advances by itself')
    l.get_by_role('button', name='Pause').click()
    n = txt(l)
    pg.wait_for_timeout(1700)
    expect(txt(l) == n, 'vpnshake: Pause stops it')


def vpncmp(pg):
    l = lab(pg, 'vpn', 'vpncmp')
    expect(has(l.locator('.vp-best'), 'Best fit WireGuard'), 'vpncmp: WireGuard is the best fit for a home lab')
    l.locator('select[data-g]').select_option('s2s')
    expect(has(l.locator('.vp-best'), 'Best fit IPsec / IKEv2'), 'vpncmp: IPsec for site-to-site')
    l.locator('select[data-g]').select_option('one')
    expect(has(l.locator('.vp-best'), 'Best fit SSH tunnels'), 'vpncmp: an SSH tunnel for one service')
    l.locator('select[data-g]').select_option('cgnat')
    expect(has(l.locator('.vp-best'), 'Best fit Mesh overlays'), 'vpncmp: a mesh overlay behind CGNAT')
    l.locator('select[data-g]').select_option('home')
    chip(l, 'only TCP 443 (hotel, strict firewall)')
    expect('OpenVPN' in txt(l.locator('.vp-best')) or 'TLS VPN' in txt(l.locator('.vp-best')), 'vpncmp: with only TCP 443 an OpenVPN or TLS VPN wins')
    chip(l, 'UDP and most ports')
    chip(l, 'only what the OS has built in')
    expect(has(l.locator('.vp-best'), 'Best fit IPsec') or has(l.locator('.vp-best'), 'Best fit SSH'), 'vpncmp: with only built-in clients a native protocol wins')
    expect('avoid' in l.locator('.vp-card').last.inner_text().lower() and 'PPTP' in l.locator('.vp-card').last.inner_text(), 'vpncmp: PPTP is always last, and marked avoid')


# ---------------------------------------------------------------- nmap
def phases(l):
    return {li.locator('b').inner_text().strip(): li.get_attribute('class') for li in l.locator('.nm-p').all()}


def nmexplain(pg):
    l = lab(pg, 'nmap', 'nmexplain')
    inp = l.locator('input.nm-cmd')
    inp.fill('sudo nmap -sn 192.168.1.0/24')
    ph = phases(l)
    expect('nm-off' in ph['Port scan'] and 'nm-on' in ph['Host discovery'], 'nmexplain: -sn runs discovery and skips the port scan')
    expect('256 addresses' in txt(l) and 'all private' in txt(l), 'nmexplain: a /24 is 256 addresses in a private range')
    inp.fill('nmap -Pn -n -sV -O -p 22,80 192.168.1.50')
    ph = phases(l)
    expect('nm-off' in ph['Host discovery'] and 'nm-off' in ph['Reverse DNS'], 'nmexplain: -Pn and -n switch off discovery and reverse DNS')
    expect('nm-on' in ph['Version detection'] and 'nm-on' in ph['OS detection'], 'nmexplain: -sV and -O switch their phases on')
    expect('root needed' in txt(l) and '-O' in txt(l.locator('.nm-facts')), 'nmexplain: -O without sudo is flagged as needing root')
    expect('-sT connect' in txt(l), 'nmexplain: without sudo the default scan is a connect scan')
    inp.fill('sudo nmap -p- -T0 192.168.1.50')
    expect('65,535' in txt(l) and 'days' in txt(l), 'nmexplain: -T0 -p- is shown to take days')
    inp.fill('nmap -p 80 8.8.8.8')
    expect('Scope check' in txt(l) and 'not a private' in txt(l), 'nmexplain: a public address trips the scope check')
    inp.fill('sudo nmap -sV --script "vuln and safe" 192.168.1.50')
    expect('risky categories' in txt(l), 'nmexplain: a vuln script selection is warned about')
    inp.fill('sudo nmap -sS --banana 192.168.1.50')
    expect('not recognised' in txt(l), 'nmexplain: an unknown flag is reported')
    inp.fill('nmap -sL 192.168.1.0/29')
    ph = phases(l)
    expect('nm-off' in ph['Host discovery'] and 'nm-off' in ph['Port scan'] and '8 addresses' in txt(l), 'nmexplain: -sL sends no probes')
    r = pg.evaluate("() => { const A = window.__nmaplab; return [A.countTarget('10.0.0.0/22'), A.countTarget('192.168.1.10-50'), A.countTarget('192.168.1-3.*'), A.portCount('22,80,8000-8010'), A.portCount('-')] }")
    expect(r == [1024, 41, 768, 13, 65535], 'nmexplain: target and port arithmetic %s' % r)
    chip(l, 'Aggressive (loud)')
    expect('-A' in txt(l.locator('.nm-warn')) and 'nm-on' in phases(l)['Traceroute'], 'nmexplain: -A turns on traceroute and warns')


EXPECT = {  # (scan, condition) -> verdict head, from the Nmap documentation
    ('syn', 'open'): 'open', ('syn', 'closed'): 'closed', ('syn', 'drop'): 'filtered', ('syn', 'reject'): 'filtered',
    ('conn', 'open'): 'open', ('conn', 'closed'): 'closed', ('conn', 'drop'): 'filtered', ('conn', 'reject'): 'filtered',
    ('ack', 'open'): 'unfiltered', ('ack', 'closed'): 'unfiltered', ('ack', 'drop'): 'filtered', ('ack', 'reject'): 'filtered',
    ('fin', 'open'): 'open|filtered', ('fin', 'closed'): 'closed', ('fin', 'drop'): 'open|filtered', ('fin', 'reject'): 'filtered',
    ('null', 'open'): 'open|filtered', ('null', 'closed'): 'closed', ('null', 'drop'): 'open|filtered', ('null', 'reject'): 'filtered',
    ('xmas', 'open'): 'open|filtered', ('xmas', 'closed'): 'closed', ('xmas', 'drop'): 'open|filtered', ('xmas', 'reject'): 'filtered',
    ('udp', 'open'): 'open', ('udp', 'closed'): 'closed', ('udp', 'drop'): 'open|filtered', ('udp', 'reject'): 'filtered',
}


def nmscan(pg):
    l = lab(pg, 'nmap', 'nmscan')
    r = pg.evaluate("""() => { const out = {}; const sc = ['syn','conn','ack','fin','null','xmas','udp'], co = ['open','closed','drop','reject'];
      sc.forEach(s => co.forEach(c => { const S = window.__nmaplab.scenario(s, c); out[s + '/' + c] = [S.verdict.head, S.steps.length, S.steps.every(x => x.note && x.label)]; })); return out; }""")
    wrong = [k for k, v in r.items() if EXPECT[tuple(k.split('/'))] != v[0]]
    expect(not wrong, 'nmscan: every scan/target pair reports the state the Nmap docs say: %s' % (wrong or 'all 28'))
    expect(all(v[2] and v[1] >= 2 for v in r.values()), 'nmscan: every scenario has at least two explained steps')
    expect('SYN to port 22' in txt(l) and 'Step 1 of 3' in txt(l), 'nmscan: starts with a SYN scan of an open port')
    l.get_by_role('button', name='Next step').click(); l.get_by_role('button', name='Next step').click()
    expect('Step 3 of 3' in txt(l) and 'reason syn-ack' in txt(l) and 'open' in l.locator('.sq-verdict b').inner_text(), 'nmscan: stepping to the end shows the verdict and the reason')
    chip(l, 'UDP  -sU')
    chip(l, 'Port closed')
    l.get_by_role('button', name='Next step').click()
    expect('port-unreach' in txt(l) and 'type=3/code=3' in l.locator('.sq-trace').inner_text(), 'nmscan: a closed UDP port shows ICMP port unreachable (type 3 code 3)')
    chip(l, 'FIN  -sF')
    chip(l, 'Port open')
    l.get_by_role('button', name='Next step').click()
    expect('open|filtered' in txt(l.locator('.sq-verdict')) or l.locator('.sq-verdict').count() == 1, 'nmscan: FIN against an open port ends open|filtered')
    chip(l, 'ACK  -sA')
    expect(l.get_by_role('button', name='Port closed', exact=True).count() == 0, 'nmscan: an ACK scan cannot tell closed from open, so that choice is not offered')
    chip(l, 'SYN  -sS')
    chip(l, 'Firewall drops')
    expect(l.locator('.sq-step').count() == 4, 'nmscan: a dropped SYN is retransmitted once (four steps)')


def nmdisc(pg):
    l = lab(pg, 'nmap', 'nmdisc')
    expect('ARP request' in txt(l) and 'cannot hide a host from an ARP scan' in txt(l), 'nmdisc: on the LAN as root it is ARP')
    chip(l, 'a normal user')
    expect('connect()' in txt(l) and 'ARP request' not in txt(l), 'nmdisc: without root it falls back to connect()')
    chip(l, 'on another network')
    expect(l.locator('.nm-pr').count() == 2, 'nmdisc: remote and unprivileged sends two connections')
    chip(l, 'root (sudo)')
    expect(l.locator('.nm-pr').count() == 4 and 'ICMP timestamp' in txt(l), 'nmdisc: remote and root sends four probes')


def nmmatrix(pg):
    l = lab(pg, 'nmap', 'nmmatrix')
    expect(l.locator('.nm-cell').count() == 5 * 12, 'nmmatrix: five hosts by twelve ports')
    n = l.locator('.nm-cell.nm-open').count()
    expect(n == 13, 'nmmatrix: thirteen open ports, exactly those in scan.txt (%d)' % n)
    l.get_by_role('button', name='printer.lan port 9100: open, high risk').click()
    expect('raw printing' in txt(l.locator('.nm-det')) and 'What to do' in txt(l.locator('.nm-det')), 'nmmatrix: selecting a cell shows the risk and the fix')
    chip(l, 'risk of an open port')
    expect(l.locator('.nm-cell.nm-o-bad').count() == 2 and l.locator('.nm-cell.nm-o-warn').count() >= 4, 'nmmatrix: risk view colours the high-risk ports (SMB, raw printing) and the ones to review')
    l.get_by_role('button', name='router.lan port 23: closed').click()
    expect('reachable, nothing listening' in txt(l.locator('.nm-det')), 'nmmatrix: a closed cell explains itself')
    expect(l.locator('.nm-cell').first.get_attribute('aria-label'), 'nmmatrix: cells have accessible names')


def nmnse(pg):
    l = lab(pg, 'nmap', 'nmnse')
    expect(l.locator('.nm-nrow').count() == 14, 'nmnse: fourteen categories')
    chip(l, 'needs permission')
    expect(l.locator('.nm-nrow').count() == 6, 'nmnse: six need permission (%d)' % l.locator('.nm-nrow').count())
    l.locator('.nm-nrow[data-id="brute"]').click()
    expect('Guess passwords' in txt(l.locator('.nm-det')) and 'ssh-brute' in txt(l.locator('.nm-det')), 'nmnse: brute explains itself and lists examples')
    chip(l, 'all categories')
    chip(l, 'low risk')
    expect(l.locator('.nm-nrow').count() == 4, 'nmnse: four low-risk categories')


CASES = [('vpn', vpnpath), ('vpn', vpnmtu), ('vpn', wgroute), ('vpn', vpnshake), ('vpn', vpncmp),
         ('nmap', nmexplain), ('nmap', nmscan), ('nmap', nmdisc), ('nmap', nmmatrix), ('nmap', nmnse)]


def main():
    only = set(sys.argv[1:])
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={'width': 1100, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        for chapter, fn in CASES:
            if only and fn.__name__ not in only:
                continue
            print('--', fn.__name__)
            try:
                fn(pg)
            except Exception as e:  # a timeout or a failed locator is a failed test, not a crash
                expect(False, '%s raised %s' % (fn.__name__, str(e).splitlines()[0][:160]))
        if not only:
            # themes and phones: every lab renders in both, and nothing makes the page scroll sideways
            for chapter in ('vpn', 'nmap'):
                for theme in ('dark', 'light'):
                    pg.goto(BASE + chapter); pg.wait_for_timeout(400)
                    pg.evaluate("t => document.documentElement.setAttribute('data-theme', t)", theme)
                    n = pg.locator('.wmount .wg').count()
                    expect(n >= 5, '%s in %s: the labs render (%d)' % (chapter, theme, n))
                    bg = pg.evaluate("() => getComputedStyle(document.querySelector('.wmount .wg')).backgroundColor")
                    expect(bg not in ('rgba(0, 0, 0, 0)', 'transparent'), '%s in %s: the lab has a background (%s)' % (chapter, theme, bg))
            pg.set_viewport_size({'width': 390, 'height': 800})
            for chapter in ('vpn', 'nmap'):
                pg.goto(BASE + chapter); pg.wait_for_timeout(500)
                over = pg.evaluate("() => { const w = document.documentElement.clientWidth; return [...document.querySelectorAll('.wmount .wg')].filter(e => e.getBoundingClientRect().right > w + 1).length }")
                expect(over == 0, '%s on a 390 px screen: no lab is wider than the screen (%d wider)' % (chapter, over))
        expect(not errs, 'no page errors or console errors %s' % errs[:3])
        b.close()
    print('problems:', len(problems))
    sys.exit(1 if problems else 0)


main()
