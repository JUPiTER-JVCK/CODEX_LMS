from lib import *

# Security part, after the Wireshark chapter.
# Widgets (src/ws-9-nmap.js): nmexplain, nmdisc, nmscan, nmmatrix, nmnse.

XML_SAMPLE = '''<nmaprun scanner="nmap" version="7.95">
<host><status state="up" reason="arp-response"/>
<address addr="192.168.1.50" addrtype="ipv4"/>
<hostnames><hostname name="pi.lan" type="PTR"/></hostnames>
<ports>
<port protocol="tcp" portid="22"><state state="open" reason="syn-ack"/><service name="ssh" product="OpenSSH" version="9.2p1"/></port>
<port protocol="tcp" portid="80"><state state="open" reason="syn-ack"/><service name="http" product="nginx" version="1.22.1"/></port>
<port protocol="tcp" portid="8080"><state state="filtered" reason="no-response"/><service name="http-proxy"/></port>
</ports></host>
<host><status state="up" reason="arp-response"/>
<address addr="192.168.1.60" addrtype="ipv4"/>
<hostnames><hostname name="nas.lan" type="PTR"/></hostnames>
<ports>
<port protocol="tcp" portid="22"><state state="open" reason="syn-ack"/><service name="ssh" product="OpenSSH" version="8.4"/></port>
<port protocol="tcp" portid="445"><state state="open" reason="syn-ack"/><service name="microsoft-ds"/></port>
</ports></host>
</nmaprun>'''

def X(code):
    # dedent first: the XML sample starts at column 0 and would otherwise defeat the dedent
    return d(code).replace('@@XML@@', XML_SAMPLE)


blocks = [
    P('''The [Ports and Scanning](#ports) chapter introduced `nmap` as a way to ask a network which doors are open. The [Wireshark chapter](#wireshark) showed what a scan looks like in a capture.
    This chapter puts the two sides together. You will learn what nmap sends and why, how to read every kind of answer, how to choose scans that are accurate and polite, how to keep and compare results,
    and how a defender sees the same scan, because you cannot read your own results well until you know what each probe looks like from the other end.'''),
    CALLOUT('danger', 'Authorization comes first',
            'Scan only networks and machines that you own or have **written permission** to test. Unauthorised scanning can break computer-misuse laws, your ISP\'s or cloud provider\'s terms and your employer\'s policy, '
            'and even a scan "just to look" can trip alarms or knock over fragile devices such as printers, cameras and old IoT gear. A professional test starts with a written **scope**: the ranges, the dates, the techniques '
            'allowed and a contact to call if something breaks. For practice, use your own home network, virtual machines you create, or a target that explicitly invites it (the Nmap project runs `scanme.nmap.org` for light, '
            'courteous scans; read its page first).'),

    H2('What nmap does, in order', 'phases'),
    P('''A single `nmap` command is a pipeline of up to eleven phases, and most of its options simply switch phases on or off or change how one of them behaves. Knowing the order explains a lot: why `-Pn` can make a scan much slower
    (nothing is skipped as "down"), why `-sn` finishes in seconds (it stops after discovery), and why `-A` takes so long (it turns on four more phases). Type any command below and watch the pipeline change. It also tells you who must be
    root, how many probes you are asking for and whether the targets look like yours.'''),
    WIDGET('nmexplain'),
    P('''Install nmap with Homebrew: `brew install nmap`. Run it as an ordinary user and it uses the operating system\'s connection calls; run it with `sudo` and it crafts raw packets, which unlocks the SYN scan, UDP scans, ARP discovery and
    OS detection. Check the version with `nmap --version`; options and script lists change between releases.'''),

    H2('Host discovery: is anything there?', 'discovery'),
    P('''Before it probes ports, nmap decides which of your targets are alive, because a /24 has 254 addresses and most of a home network is empty. What it sends depends on two things: whether the target is on your own Ethernet segment, and whether you are root.
    Flip both switches below and see which probes go out.'''),
    WIDGET('nmdisc'),
    TABLE(['Option', 'Probe', 'Needs root', 'Use it when'], [
        ['`-sn`', 'discovery only: skip the port scan', 'no (better with)', 'you only need a list of live hosts'],
        ['`-Pn`', 'skip discovery: treat every host as up', 'no', 'hosts block every probe but are really there (this makes a scan of a big range very slow)'],
        ['`-PR`', 'ARP request', 'yes', 'automatically used on a local network; cannot be blocked by a host firewall'],
        ['`-PE`, `-PP`, `-PM`', 'ICMP echo, timestamp, address-mask', 'yes', 'a firewall lets some ICMP types pass and not others'],
        ['`-PS22,443`', 'TCP SYN to the listed ports', 'no (uses connect)', 'ping is blocked but you know a port that should answer'],
        ['`-PA80`', 'TCP ACK to the listed ports', 'yes', 'a stateless filter lets ACKs through'],
        ['`-PU53`', 'UDP datagram to the listed ports', 'yes', 'only UDP services are reachable'],
        ['`-n`, `-R`', 'no reverse DNS, or always do it', 'no', 'speed, or you want names for every address'],
    ], 'Host discovery options'),
    CMD('nmap -sn', 'sec-scan', 'brew:nmap', 'Find the live hosts on a network without scanning their ports (a "ping scan").',
        'nmap -sn [options] target...',
        ['`-sn` stops after host discovery and prints the hosts that answered. On your own LAN as root it uses ARP, which finds every device that is switched on, including ones that ignore ping, and prints the MAC address and the '
         'network card\'s vendor from a built-in table. Without root it falls back to TCP connections to ports 80 and 443 and can miss quiet devices.',
         'The older spelling `-sP` still works. Add `-n` to skip name lookups when you want speed, and `--reason` to see why each host was called up (`arp-response`, `echo-reply`, `syn-ack`, `reset`).',
         'A host that is shown down may still be there: it may drop every probe. If you suspect that, scan it directly with `-Pn`.'],
        flags=[('-n', 'no reverse DNS'), ('--reason', 'show why a host is considered up'), ('-PS22,443', 'also probe TCP ports 22 and 443'),
               ('-PE', 'ICMP echo probe'), ('-oG - | grep Up', 'one line per live host, easy to script'), ('--exclude IP', 'leave a host out of the sweep')],
        examples=[('ex', 'Who is on my network?', 'sudo nmap -sn -n 192.168.1.0/24', '''
            Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-23 09:40 GMT
            Nmap scan report for 192.168.1.1
            Host is up (0.0021s latency).
            MAC Address: A4:2B:B0:5C:11:09 (TP-Link Technologies)
            Nmap scan report for 192.168.1.23
            Host is up.
            Nmap scan report for 192.168.1.50
            Host is up (0.0043s latency).
            MAC Address: DC:A6:32:14:9F:2B (Raspberry Pi Trading)
            Nmap done: 256 IP addresses (3 hosts up) scanned in 1.94 seconds'''),
                  ('ex', 'Just the addresses, ready for a loop', 'sudo nmap -sn -n 192.168.1.0/24 -oG - | awk \'/Up$/ {print $2}\'', '''
            192.168.1.1
            192.168.1.23
            192.168.1.50''')],
        gotchas=['Your own machine is listed as "Host is up." with no MAC address, because it needs no probe.',
                 'On a different network from the target (across a router) ARP is not used, so a firewall that drops ICMP and probed ports makes a live host look down.'],
        see=['nmap', 'arp -a', 'ping'], tags=['scan', 'discovery', 'sudo']),

    H2('Port states and scan types', 'scans'),
    P('''Every port ends up in one of six states. Four are decisive; two admit nmap could not tell. The **reason** nmap records tells you what it actually saw, and `--reason` prints it. Nearly every confusing result comes from forgetting that the state is an
    inference from a reply, or from no reply, not a fact about the port.'''),
    TABLE(['State', 'What nmap saw', 'What it tells you'], [
        ['**open**', 'a program accepted the probe: SYN/ACK to a SYN, a UDP reply, a completed connection', 'something is listening and reachable'],
        ['**closed**', 'the host answered but refused: a RST (TCP) or an ICMP port-unreachable (UDP)', 'the host is up, no program listens, and no firewall is hiding the answer'],
        ['**filtered**', 'no answer, or an ICMP "administratively prohibited" or similar', 'something between you and the port blocked the probe, so the port\'s real state is unknown'],
        ['**unfiltered**', 'a reset to an ACK probe (ACK and window scans only)', 'reachable, but open or closed cannot be told'],
        ['**open|filtered**', 'silence to a probe that an open port would also ignore (UDP, FIN, NULL, Xmas)', 'either open or filtered: the scan cannot say'],
        ['**closed|filtered**', 'only in idle scans', 'either closed or filtered'],
    ], 'The six port states'),
    P('''Now look at the exchange that decides each state. Choose a scan type and what the target is doing and step through the packets. The grey lines are in the format `--packet-trace` prints, so you can compare with a real scan. Try the same target under
    SYN, FIN and UDP scans: the same silent port gets three different verdicts, and a filtered port looks open under some scans and filtered under others.'''),
    WIDGET('nmscan'),
    TABLE(['Flag', 'Scan', 'Needs root', 'What it sends', 'Good for', 'Weakness'], [
        ['`-sT`', 'TCP connect', 'no', 'a full handshake through the OS', 'when you are not root', 'noisy: services see and log a full connection'],
        ['`-sS`', 'TCP SYN ("half-open")', 'yes', 'a SYN, never the final ACK', 'the standard fast, accurate scan', 'still seen by firewalls and IDS'],
        ['`-sU`', 'UDP', 'yes', 'UDP datagrams, protocol payloads for known ports', 'DNS, SNMP, DHCP, NTP, VPNs', 'very slow; many results are open|filtered'],
        ['`-sA`', 'TCP ACK', 'yes', 'an ACK with no connection', 'mapping firewall rules', 'cannot tell open from closed'],
        ['`-sF`, `-sN`, `-sX`', 'FIN, NULL, Xmas', 'yes', 'an odd flag combination', 'old stateless filters', 'Windows and many devices always answer RST'],
        ['`-sW`, `-sM`', 'Window, Maimon', 'yes', 'ACK or FIN/ACK, reading the reply\'s window', 'a few legacy stacks', 'rarely useful today'],
        ['`-sI ZOMBIE`', 'Idle (zombie)', 'yes', 'spoofed probes that use a third host\'s IP ID counter', 'a scan the target cannot trace to you', 'needs a suitable zombie; most modern systems randomise the counter'],
        ['`-sO`', 'IP protocol', 'yes', 'raw IP packets with different protocol numbers', 'finding which protocols a router supports', 'a different question from ports'],
    ], 'Scan types at a glance'),
    P('''**UDP deserves its own warning.** A TCP port gives a clear answer; a UDP port often says nothing. An open port that ignores a probe and a firewall that drops it look the same, so the best nmap can say is `open|filtered`. A closed port answers with an ICMP
    port-unreachable, but Linux sends at most about one of those per second, so a full scan of 65,536 UDP ports takes more than 18 hours. Scan the few ports that matter (`--top-ports 20`, or `-p U:53,67,123,161`), and add `-sV` so nmap sends a real protocol request and can turn
    some `open|filtered` into `open`.'''),
    CMD('nmap -sU', 'sec-scan', 'brew:nmap', 'Scan UDP ports. Slower and less certain than TCP, and needs root.',
        'sudo nmap -sU [-p PORTS | --top-ports N] [-sV] target',
        ['A UDP scan sends a datagram to each port and listens. For well-known ports (DNS on 53, SNMP on 161, NTP on 123, DHCP on 67) it sends a real request from its payload database, because most services ignore an empty datagram. '
         'A service that answers makes the port `open`; an ICMP port-unreachable makes it `closed`; silence leaves it `open|filtered`.',
         'Many services of interest to an auditor are UDP: DNS, DHCP, NTP, SNMP (with its notorious default community strings), mDNS, SSDP/UPnP, TFTP, IKE (VPNs) and WireGuard. A TCP-only scan does not see any of them.',
         'Speed it up by scanning fewer ports, cutting retries (`--max-retries 1`) and running host scans in parallel, rather than raising the rate. `--defeat-icmp-ratelimit` trades the closed/open|filtered distinction for speed.'],
        flags=[('-p U:53,161', 'scan only these UDP ports'), ('--top-ports 20', 'the 20 most common UDP ports'), ('-sV', 'send protocol-specific probes to resolve open|filtered'),
               ('--max-retries 1', 'do not retransmit more than once'), ('--defeat-icmp-ratelimit', 'treat unanswered ports as open|filtered at once, for speed'),
               ('-sU -sS', 'scan TCP and UDP in one run')],
        examples=[('ex', 'The UDP services of a router', 'sudo nmap -sU --top-ports 20 --open 192.168.1.1', '''
            Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-23 10:02 GMT
            Nmap scan report for router.lan (192.168.1.1)
            Host is up (0.0030s latency).
            Not shown: 17 closed udp ports (port-unreach)
            PORT     STATE         SERVICE
            53/udp   open          domain
            67/udp   open|filtered dhcps
            1900/udp open|filtered upnp
            Nmap done: 1 IP address (1 host up) scanned in 8.91 seconds'''),
                  ('ex', 'Resolve the doubt on one port', 'sudo nmap -sU -sV -p 123 192.168.1.1')],
        gotchas=['`open|filtered` is not a finding. Treat it as "unknown" until you probe it with `-sV` or a purpose-built tool.',
                 'Without `sudo`, `-sU` stops with "You requested a scan type which requires root privileges. QUITTING!"'],
        see=['nmap', 'nmap -sV', 'nc'], tags=['scan', 'udp', 'sudo']),
    CMD('nmap --packet-trace', 'sec-scan', 'brew:nmap', 'Print every packet nmap sends and receives, in one line each: the best way to learn what a scan really does.',
        'nmap --packet-trace [options] target',
        ['Each line starts with `SENT` or `RCVD` and a time since the start, then the protocol, source, destination, TCP flags and header values. A SYN scan of an open port shows `S`, then `SA` coming back. A closed port shows `RA`. '
         'A silent port shows a `SENT` with no `RCVD`, and a second `SENT` when nmap retransmits.',
         'Read it next to a Wireshark capture of the same scan: they describe the same packets. Use it on **one host and a few ports**; on a big scan it prints thousands of lines.',
         'In a connect scan nmap does not send packets itself, so the lines start with `CONN` instead and show the result of each `connect()` call.'],
        flags=[('--reason', 'add the reason for each port state to the result'), ('-Pn', 'skip discovery so only the port probes appear'),
               ('-n', 'no DNS lookups, so no stray DNS packets'), ('--script-trace', 'show the data scripts send and receive'),
               ('-d', 'debugging output (more detail than --packet-trace)')],
        examples=[('ex', 'See a SYN scan of one open and one closed port', 'sudo nmap -sS -Pn -n -p 2222,8443 --packet-trace --reason 127.0.0.1', '''
            SENT (0.0283s) TCP 127.0.0.1:41324 > 127.0.0.1:2222 S ttl=56 id=62477 iplen=44  seq=2121303580 win=1024 <mss 1460>
            SENT (0.0283s) TCP 127.0.0.1:41324 > 127.0.0.1:8443 S ttl=51 id=27839 iplen=44  seq=2121303580 win=1024 <mss 1460>
            RCVD (0.0283s) TCP 127.0.0.1:2222 > 127.0.0.1:41324 SA ttl=64 id=0 iplen=44  seq=706651535 win=65495 <mss 65495>
            RCVD (0.0283s) TCP 127.0.0.1:8443 > 127.0.0.1:41324 RA ttl=64 id=0 iplen=40  seq=0 win=0
            PORT     STATE  SERVICE      REASON
            2222/tcp open   EtherNetIP-1 syn-ack ttl 64
            8443/tcp closed https-alt    reset ttl 64'''),
                  ('ex', 'The ARP probe of host discovery', 'sudo nmap -sn --packet-trace 192.168.1.50', '''
            SENT (0.0105s) ARP who-has 192.168.1.50 tell 192.168.1.23
            RCVD (0.0108s) ARP reply 192.168.1.50 is-at DC:A6:32:14:9F:2B''')],
        gotchas=['The small `win=1024` and the `<mss 1460>` option on SYN probes are nmap\'s own habits. They are a well-known fingerprint that defenders sometimes match on.',
                 'On a loopback scan the replies look as if they came from the scanner, because both ends are the same machine.'],
        see=['tcpdump', 'tshark', 'nmap'], tags=['scan', 'debug']),

    H2('Choosing targets, ports and speed', 'targets'),
    P('''Two small decisions shape every scan: what to aim at and how hard to push. Targets can be written as a name, an address, a CIDR block, a range, or read from a file. Ports default to the 1000 most frequently open (from nmap\'s own
    `nmap-services` table), which finds the usual suspects fast and misses anything unusual.'''),
    TABLE(['You want', 'Write', 'Notes'], [
        ['One host', '`192.168.1.50` or `pi.lan`', 'a name is resolved by DNS first'],
        ['A subnet', '`192.168.1.0/24`', '256 addresses; `/16` is 65,536, which is almost never what you meant at home'],
        ['A range', '`192.168.1.10-50`, `192.168.1-3.*`', 'each octet can have its own range, a list or `*`'],
        ['Targets from a file', '`-iL targets.txt`', 'one per line, `#` for comments; keep your **scope file** here'],
        ['Skip some hosts', '`--exclude 192.168.1.1,192.168.1.2` or `--excludefile out-of-scope.txt`', 'always exclude what is outside your permission'],
        ['Default ports', '(nothing)', 'the 1000 most common TCP ports (UDP with `-sU`)'],
        ['Specific ports', '`-p 22,80,443` or `-p 1-1024` or `-p U:53,T:22`', '`U:` and `T:` prefixes pick UDP and TCP in one scan'],
        ['All ports', '`-p-`', '65,535 TCP ports: thorough, but 65 times the probes of the default'],
        ['The most common N', '`--top-ports 100` or `-F`', '`-F` is the top 100'],
    ], 'Target and port specifications'),
    P('''**Timing templates** (`-T0` to `-T5`) bundle a dozen delay and retry settings. They govern how fast nmap runs and how much it adapts to the network. The first three are *serial*: one probe at a time, with a fixed pause. That makes them very
    gentle and, as the numbers show, very slow.'''),
    TABLE(['Template', 'Name', 'Behaviour', '1000 ports on one host'], [
        ['`-T0`', 'paranoid', 'one probe at a time, 5 minutes apart', 'about 83 hours'],
        ['`-T1`', 'sneaky', 'one probe at a time, 15 seconds apart', 'about 4.2 hours'],
        ['`-T2`', 'polite', 'one probe at a time, 0.4 seconds apart', 'about 6.7 minutes'],
        ['`-T3`', 'normal', 'the default: parallel, adapts to the network', 'seconds on a LAN, longer through a firewall'],
        ['`-T4`', 'aggressive', 'assumes a fast, reliable network; caps delays at 10 ms and the wait for a reply at 1.25 s', 'the usual choice on a LAN'],
        ['`-T5`', 'insane', 'assumes a very fast network; gives up after 300 ms; fewer retries', 'fastest, and loses results on a slow link'],
    ], 'Timing templates'),
    P('''For fine control use `--max-rate` (never send more than N packets per second), `--min-rate` (at least N), `--max-retries` and `--host-timeout`. Use `--max-rate` and `-T2` against fragile devices; use `-T4` on a LAN you own; avoid `-T5`
    on anything you care about being accurate.'''),
    P('''A good workflow for a thorough scan is **two passes**: find the open ports fast, then spend the expensive probes only on those. The first pass covers all 65,535 ports with a minimum rate; the second runs version detection and scripts on the handful of ports found:'''),
    SH('''
        ports=$(sudo nmap -p- --min-rate 1000 -T4 -n 192.168.1.50 | awk -F/ '/^[0-9]+\\/tcp.*open/ {print $1}' | paste -sd, -)
        echo "open: $ports"
        sudo nmap -sV -sC -n -p "$ports" 192.168.1.50
    '''),

    H2('Service and OS detection', 'versions'),
    P('''A port number is only a hint: nothing stops a web server running on 2222 or SSH on 443. **Version detection** (`-sV`) connects to each open port, listens for a banner, and if necessary sends probes from a database of about 180
    until the reply matches a known service. It reports the product, version and often an `Info` field and a **CPE** identifier (`cpe:/a:openbsd:openssh:9.6`), a standard name that you can look up in vulnerability databases.
    That is the link from "port 22 is open" to "this is OpenSSH 8.4 and I know which advisories apply".'''),
    CMD('nmap -sV', 'sec-scan', 'brew:nmap', 'Identify the program and version behind each open port by talking to it.',
        'nmap -sV [--version-intensity 0-9] [-p PORTS] target',
        ['After the port scan, nmap takes every open (or open|filtered) port and tries to recognise the service. It first waits for the server to speak (SSH, FTP, SMTP and many others send a banner at once), then sends probes ordered by how likely they are '
         'for that port number, and matches the replies against `nmap-service-probes`.',
         '`--version-intensity` runs from 0 to 9 (default 7): a higher value tries rarer probes. `--version-light` is 2 and `--version-all` is 9. Use `--version-trace` to see what it sent.',
         'Version detection sends data to services. That shows up in their logs and on rare occasions upsets a fragile program. By default nmap skips ports 9100 to 9107 because a raw printer port will print whatever it is sent.'],
        flags=[('--version-intensity N', 'how many probes to try, 0 to 9 (default 7)'), ('--version-light', 'intensity 2: fast, may miss'), ('--version-all', 'intensity 9: slow, thorough'),
               ('--version-trace', 'show every probe and reply'), ('-A', 'version detection with OS detection, default scripts and traceroute')],
        examples=[('ex', 'Find out what is really listening', 'nmap -sV -p 8000 127.0.0.1', '''
            PORT     STATE SERVICE VERSION
            8000/tcp open  http    SimpleHTTPServer 0.6 (Python 3.13.18)'''),
                  ('ex', 'A quick, light version scan of a whole host', 'nmap -sV --version-light 192.168.1.50')],
        gotchas=['The banner is only what the server says. Administrators can hide or fake it (`ServerTokens Prod`), and a distribution often patches a package without changing the version number. Treat it as a lead, not a verdict.',
                 'The output `Service Info` line at the bottom is nmap\'s guess about the operating system from the services it found.'],
        see=['nmap -O', 'nmap --script', 'nc'], tags=['scan', 'version']),
    P('''**OS detection** (`-O`) works differently: it does not use services at all. Nmap sends a set of about 16 carefully built packets (TCP with unusual options and flag combinations, ICMP echoes with odd fields, one UDP packet to a closed port) and compares how
    the target\'s TCP/IP stack answers with a database of known systems: initial TTL, window size, option order, how the sequence numbers behave. Every operating system implements the same RFCs with slightly different habits, and the differences are a fingerprint.'''),
    CMD('nmap -O', 'sec-scan', 'brew:nmap', 'Guess the operating system and device type from how the TCP/IP stack answers.',
        'sudo nmap -O [--osscan-guess] [--osscan-limit] target',
        ['`-O` needs root, because it sends hand-built packets. It works best when it finds **at least one open and one closed TCP port**, because several probes depend on both. With no open port it cannot say much; with a firewall in the way it may produce no match at all.',
         'Nmap prints the best matches with a percentage, or a list of guesses, or "No exact OS matches". Use `--osscan-guess` to make it name close guesses, and `--osscan-limit` to skip hosts that lack a closed and open port.',
         'It is a statistical guess. A router showing "Linux 4.x" is probably a Linux-based device, not necessarily a Linux computer. Printers, cameras and smart TVs often give odd results.'],
        flags=[('--osscan-guess', 'name aggressive guesses when there is no exact match'), ('--osscan-limit', 'only try hosts that have an open and a closed port'),
               ('--max-os-tries N', 'how many times to retry the fingerprint'), ('-A', 'OS detection plus version detection, scripts and traceroute')],
        examples=[('ex', 'What kind of device is this?', 'sudo nmap -O -n 192.168.1.50', '''
            Nmap scan report for 192.168.1.50
            Host is up (0.0043s latency).
            Not shown: 997 closed tcp ports (reset)
            PORT     STATE SERVICE
            22/tcp   open  ssh
            80/tcp   open  http
            8080/tcp open  http-proxy
            MAC Address: DC:A6:32:14:9F:2B (Raspberry Pi Trading)
            Device type: general purpose
            Running: Linux 5.X|6.X
            OS CPE: cpe:/o:linux:linux_kernel:5 cpe:/o:linux:linux_kernel:6
            OS details: Linux 5.4 - 6.2
            Network Distance: 1 hop''')],
        gotchas=['Do not scan with `-O` across a firewall and trust the answer: the firewall may be the thing that replied.',
                 'Some operating systems and devices ship with a TCP/IP stack tuned to hide their identity. Do not assume a scan is wrong when it is only vague.'],
        see=['nmap -sV', 'tcpdump', 'nmap'], tags=['scan', 'os', 'sudo']),

    H2('The Nmap Scripting Engine', 'nse'),
    P('''Nmap carries hundreds of small Lua programs, the **Nmap Scripting Engine** (NSE). A script can ask a web server for its title, list a TLS certificate\'s names, check an SMB server\'s security mode, or, at the other end, guess passwords or try an exploit.
    Every script belongs to one or more **categories**, and the category is the single most useful thing to read before running it. Click through the categories below: the bars are the real script counts in Nmap 7.94, and the colour is how careful you must be.'''),
    WIDGET('nmnse'),
    TABLE(['Script', 'Categories', 'What it tells you'], [
        ['`http-title`', 'default, discovery, safe', 'the page title of every web server: finds admin panels and forgotten services'],
        ['`ssl-cert`', 'default, discovery, safe', 'subject, issuer and expiry of a TLS certificate'],
        ['`ssh-hostkey`', 'default, discovery, safe', 'the host key fingerprints, to compare with a known value'],
        ['`smb-security-mode`, `smb2-security-mode`', 'default, discovery, safe', 'whether SMB signing is required and which versions are on'],
        ['`ftp-anon`', 'default, auth, safe', 'whether an FTP server allows anonymous login'],
        ['`http-methods`', 'default, safe', 'which HTTP methods a server allows'],
        ['`upnp-info`, `nbstat`', 'default, discovery, safe', 'what a UPnP device or a Windows/Samba host says about itself'],
        ['`ssl-enum-ciphers`', 'discovery, intrusive', 'every TLS version and cipher offered, graded: opens many connections, so run it on your own servers only'],
        ['`vulners`', 'vuln, safe, external', 'looks up the detected software in an online vulnerability database: your service list leaves your network'],
    ], 'Scripts for your own network'),
    CMD('nmap --script', 'sec-scan', 'brew:nmap', 'Run NSE scripts by name, by category or by pattern, against the hosts and ports found.',
        'nmap --script SELECTION [--script-args ARGS] [-p PORTS] target',
        ['`-sC` runs the `default` category. `--script` takes script names (`http-title`), categories (`safe`), file patterns (`"http-*"`) and boolean expressions (`"default and safe"`, `"discovery and not intrusive"`), separated by commas.',
         'A script runs only against the hosts or ports its rules select, such as "web servers" or "port 445 open". Use `--script-help NAME` to read what a script does, its categories and its arguments **before** you run it. The scripts live in '
         '`/opt/homebrew/share/nmap/scripts` (Apple silicon) or `/usr/local/share/nmap/scripts` (Intel), and `--script-updatedb` rebuilds the index after you add one.',
         'Categories describe risk. `safe` and `default` read what a service volunteers. `intrusive`, `brute`, `dos`, `exploit`, `fuzzer` and `vuln` can lock accounts, crash services or look like an attack: only with written permission, and never on production systems.'],
        flags=[('-sC', 'the default category'), ('--script "default and safe"', 'a boolean expression of categories'), ('--script "http-*"', 'every script whose name starts with http-'),
               ('--script-help NAME', 'print what a script does and its arguments'), ('--script-args k=v', 'pass an argument to scripts'),
               ('--script-trace', 'show the data each script sends and receives'), ('--script-updatedb', 'rebuild the script index')],
        examples=[('ex', 'The title of every web server on the lab host', 'nmap -p 80,443,8000,8080 --script http-title 192.168.1.50', '''
            Not shown: 2 closed tcp ports (reset)
            PORT     STATE SERVICE
            80/tcp   open  http
            |_http-title: Welcome to nginx!
            8080/tcp open  http-proxy
            |_http-title: Directory listing for /'''),
                  ('ex', 'Read before you run', 'nmap --script-help http-title', '''
            http-title
            Categories: default discovery safe
            https://nmap.org/nsedoc/scripts/http-title.html
              Shows the title of the default page of a web server.''')],
        gotchas=['"Safe" is the author\'s claim, not a guarantee. A "safe" script still sends traffic, and a few that are marked both `safe` and `vuln` send crafted packets.',
                 'The `external` category sends data to third parties (whois servers, online APIs). Never use it on a target whose details you must keep private.',
                 'Scripts you did not read can do whatever the Lua code says. Install them only from sources you trust.'],
        see=['nmap -sV', 'nmap', 'curl'], tags=['scan', 'nse']),

    H2('Output you can keep, parse and compare', 'output'),
    P('''Reading a scan on screen is a start. The value comes from keeping results and comparing them. Nmap writes three formats, and `-oA name` writes all three at once as `name.nmap`, `name.gnmap` and `name.xml`.'''),
    TABLE(['Format', 'Option', 'Best for'], [
        ['Normal', '`-oN file`', 'people: the same text you see on screen'],
        ['Greppable', '`-oG file`', 'quick one-liners with `grep` and `awk`; deprecated but still works and stable'],
        ['XML', '`-oX file`', 'programs: complete, structured and stable; `ndiff` and most tools read it'],
        ['All three', '`-oA base`', 'the habit to form: keep everything, decide later'],
    ], 'Output formats'),
    P('''The greppable format puts a host and all its ports on one line, which is why it is handy in pipelines:'''),
    TEXT('''
        # Nmap 7.95 scan initiated Mon Nov 23 09:51:08 2026 as: nmap -oG - 192.168.1.50
        Host: 192.168.1.50 (pi.lan)	Status: Up
        Host: 192.168.1.50 (pi.lan)	Ports: 22/open/tcp//ssh///, 80/open/tcp//http///, 8080/open/tcp//http-proxy///
    '''),
    P('''XML is the format for programs, and Python can read it with the standard library. Run this: the sample is a trimmed `-oX` file for two of the lab hosts. Each `<host>` has an `<address>`, optional `<hostnames>` and a `<ports>` list, and each `<port>` has a `<state>` and
    an optional `<service>`. Change `open` to `filtered` and run it again to see the report change.'''),
    RUN(X('''
        import xml.etree.ElementTree as ET

        XML = """@@XML@@"""

        root = ET.fromstring(XML)
        for host in root.findall("host"):
            addr = host.find("address").get("addr")
            for port in host.findall("ports/port"):
                state = port.find("state").get("state")
                if state != "open":
                    continue
                svc = port.find("service")
                text = " ".join(x for x in (svc.get("product"), svc.get("version")) if x)
                print(f"{addr}:{port.get('portid')}/{port.get('protocol')}  {svc.get('name'):<13} {text}".rstrip())
    ''')),
    CMD('ndiff', 'sec-scan', 'brew:nmap', 'Compare two nmap XML files and show what changed: hosts that appeared or vanished, ports that opened or closed, services that changed.',
        'ndiff [-v] OLD.xml NEW.xml',
        ['`ndiff` ships with nmap. Give it two `-oX` or `-oA` files and it prints only the differences, with `-` for old lines and `+` for new ones. Its exit code is `0` when the scans are the same, `1` when they differ and `2` on an error, so a script can act on it.',
         'This turns a scan from a snapshot into a **monitor**. A new open port on the NAS, a device nobody recognises on the network or a service that changed version are exactly the events an audit exists to find.',
         'Compare scans made with the **same options**, or the differences will be about the scan rather than the network.'],
        flags=[('-v', 'also show the unchanged lines for context'), ('--text', 'plain text output (the default)'), ('--xml', 'write the differences as XML')],
        examples=[('ex', 'A port opened between two scans', 'ndiff old.xml new.xml', '''
            -Nmap 7.95 scan initiated Mon Nov 16 09:00:02 2026 as: nmap -oX old.xml 192.168.1.60
            +Nmap 7.95 scan initiated Mon Nov 23 09:00:03 2026 as: nmap -oX new.xml 192.168.1.60

             192.168.1.60:
             PORT     STATE  SERVICE VERSION
            -9999/tcp closed abyss
            +9999/tcp open   abyss'''),
                  ('ex', 'Use the exit code', 'ndiff old.xml new.xml > changes.txt || echo "something changed"')],
        gotchas=['A host that was down in one scan and up in the other looks like a new host: scan at the same time of day, with the machines you expect to be on.',
                 'The first two lines in the diff are always the scan\'s own headers: they differ every time and do not count as a change.'],
        see=['nmap', 'diff', 'comm'], tags=['scan', 'audit']),

    H2('Reading a result like an auditor', 'audit'),
    P('''An audit is not a list of open ports. It is a list of **questions**: What is this? Who put it there? Does it need to be reachable from here? Is it encrypted and patched? An open port with an answer is an inventory item; an open port without one is a finding.
    Below is the lab network from the practice terminal as an exposure map. Switch the colouring to risk, and click a cell.'''),
    WIDGET('nmmatrix'),
    TABLE(['Port', 'Service', 'Why it deserves a question'], [
        ['21', 'FTP', 'clear-text logins; check for `ftp-anon`'],
        ['23', 'Telnet', 'clear-text shell: replace with SSH, or isolate the device'],
        ['69/udp', 'TFTP', 'no authentication at all; often a forgotten network-device backup service'],
        ['161/udp', 'SNMP', 'the default community strings `public` and `private` are widely tried; prefer SNMPv3'],
        ['445, 139', 'SMB', 'file sharing; old versions (SMB1) have a history of worms; never expose to the Internet'],
        ['1900/udp', 'SSDP/UPnP', 'lets devices open ports on your router; usually safest turned off'],
        ['2375', 'Docker API', 'an unencrypted, unauthenticated way to run containers (and so root) on the host'],
        ['3306, 5432, 6379, 27017, 9200', 'MySQL, PostgreSQL, Redis, MongoDB, Elasticsearch', 'databases should listen on localhost or a private network and require authentication'],
        ['3389, 5900', 'RDP, VNC', 'remote desktops: a favourite of attackers; behind a VPN, never open'],
        ['8080, 8000, 8443', 'alternative web ports', 'development servers and admin panels hide here; find out what is behind them'],
        ['9100', 'JetDirect', 'raw printing with no authentication'],
    ], 'Ports that deserve a question'),
    CALLOUT('tip', 'What a clean network looks like',
            'Few open ports, each with a name you can say out loud and a reason to exist; admin interfaces on HTTPS; nothing unexpected on UDP; and a result that matches last month\'s. When a scan surprises you, you have found '
            'something more valuable than a vulnerability: a gap between what you think is on your network and what is.'),

    H2('Testing your own firewall', 'firewalls'),
    P('''A scan from outside is the quickest honest test of what your firewall really does. The pattern of states tells you the policy:'''),
    UL('**Everything `filtered`, host is up:** a default-deny firewall that drops silently. Good, and slow to scan.',
       '**Everything `closed`:** no firewall in the path; every port answers with a reset. The host is fully visible, only no service is running.',
       '**Some `open`, the rest `filtered`:** a firewall that allows specific services. Check that every allowed port is meant to be.',
       '**`unfiltered` in an ACK scan (`-sA`):** your packets reach the host, so no firewall blocks ACKs there. A stateful firewall instead shows `filtered`.'),
    P('''Nmap also has options that change how packets look: fragmenting them, setting the source port, adding decoy sources, sending bad checksums, slowing the scan. They exist so that you can **test whether your own firewall and detection do their job**, and
    knowing what each does tells you what to expect from a defender\'s view. None of them makes an unauthorised scan acceptable, and modern firewalls and intrusion detection systems recognise all of them.'''),
    TABLE(['Option', 'What it does', 'What it tests on your own network'], [
        ['`-f`, `--mtu 16`', 'splits probes into small IP fragments', 'whether the firewall reassembles fragments before applying rules (stateful devices do)'],
        ['`-g 53`, `--source-port 53`', 'sends from a chosen source port', 'whether a rule trusts traffic "from DNS" or "from FTP-data" without checking more'],
        ['`-D RND:5`', 'mixes in probes from forged decoy addresses', 'whether your logs and alerts still point to the real source (they do: your address is in the list)'],
        ['`--badsum`', 'sends a wrong TCP/UDP checksum', 'a real host drops it; a reply means a firewall or IDS in the path generated it. It reveals middleboxes.'],
        ['`--data-length N`', 'pads probes with random bytes', 'signatures that match nmap\'s default empty packets'],
        ['`--scan-delay`, `-T1`', 'spaces probes far apart', 'whether detection counts scans over a window, or only fast bursts'],
        ['`--spoof-mac`', 'uses a different MAC on a local scan', 'MAC-based controls, such as port security or a MAC allow list'],
    ], 'Options for testing your firewall'),

    H2('Seeing a scan from the other side', 'defender'),
    P('''A scan leaves traces in three places: the logs of the services it touched, the firewall\'s logs and a packet capture. Knowing the traces helps you detect scans, and it tells you what *your own* scans look like to anyone watching.'''),
    P('''**Service logs.** A connect scan or `-sV` opens real connections, so programs see them. A scan of SSH leaves lines such as `Did not receive identification string from 192.168.1.23 port 56310` in the SSH log, and a scan of a web server leaves requests for `/` or no request at all,
    only connections that opened and closed.'''),
    P('''**Packet capture.** In Wireshark or `tshark` (see [Wireshark, Case 2](#wireshark)), a scan stands out by its shape: **one source, many destination ports, in a few milliseconds, mostly SYNs and resets**. Each scan type also has its own signature:'''),
    TABLE(['Scan', 'What is in the capture', 'Display filter'], [
        ['SYN or connect', 'many SYNs from one address to many ports; RST/ACK from closed ports', '`tcp.flags.syn == 1 && tcp.flags.ack == 0`'],
        ['nmap\'s own SYN probes', 'window 1024 and an MSS option: a habit that can be changed, so use it as a hint, not proof', '`tcp.flags.syn == 1 && tcp.window_size_value == 1024`'],
        ['NULL', 'TCP packets with no flags at all', '`tcp.flags == 0x000`'],
        ['FIN', 'a lone FIN with no connection', '`tcp.flags == 0x001`'],
        ['Xmas', 'FIN, PSH and URG together', '`tcp.flags == 0x029`'],
        ['UDP scan', 'UDP probes to many ports; a flood of ICMP port-unreachable from the target', '`icmp.type == 3 && icmp.code == 3`'],
        ['Closed-port replies', 'the target answers a scan with many resets', '`tcp.flags.reset == 1`'],
        ['Host discovery', 'ARP who-has for every address in a range, or a sweep of ICMP echoes', '`arp.opcode == 1`, `icmp.type == 8`'],
    ], 'Scans in a capture'),
    P('''The first defence is the one that matters most: **have nothing to find.** Close services you do not use, bind the rest to the interfaces that need them, and keep a default-deny firewall. Beyond that, rate-limit or block sources that probe many ports, log
    drops on the firewall, and let an IDS such as Zeek or Suricata raise an alert on the pattern above. On macOS, the application firewall\'s **stealth mode** makes the Mac ignore probes to closed ports instead of answering with a reset (read-only check below).'''),
    TERM('''
        $ /usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode
        Firewall stealth mode is on
    '''),
    CALLOUT('note', 'Stealth is not a defence by itself',
            'Hiding that a port is closed does not close the open ones, and it makes legitimate diagnostics harder. It lowers the noise from casual scans. The things that matter are which services run and who can reach them.'),

    H2('Recipes and habits', 'recipes'),
    P('''**An inventory you can trust.** Run it from a machine on the same network, as root so that ARP finds everything, and keep the output:'''),
    SH('''
        mkdir -p ~/scans && cd ~/scans
        sudo nmap -sn -n -oA inventory-$(date +%F) 192.168.1.0/24
        grep -h "Status: Up" inventory-*.gnmap | awk '{print $2}' | sort -u
    '''),
    P('''**A weekly baseline with a diff.** Save this as `~/scans/baseline.sh`, make it executable with `chmod +x`, and schedule it with `cron` or a launchd agent. It scans, compares with the last run and leaves a file only when something changed:'''),
    FILE('baseline.sh', '''
        #!/bin/zsh
        cd ~/scans || exit 1
        stamp=$(date +%Y%m%d-%H%M)
        nmap -n --open -oX "$stamp.xml" 192.168.1.0/24 > /dev/null
        if [ -f latest.xml ]; then
            ndiff latest.xml "$stamp.xml" > "$stamp.diff" || echo "changes found: see $stamp.diff"
            [ -s "$stamp.diff" ] || rm -f "$stamp.diff"
        fi
        ln -sf "$stamp.xml" latest.xml
    '''),
    UL('**Web servers and their titles:** `nmap -p 80,443,8000,8080,8443 --open --script http-title 192.168.1.0/24`',
       '**Certificates about to expire:** `nmap -p 443 --script ssl-cert 192.168.1.0/24` and read `Not valid after`',
       '**TLS on a server you run:** `nmap -p 443 --script ssl-enum-ciphers server.example`: look for the grade and for anything below TLS 1.2',
       '**A fragile device:** `nmap -T2 --max-rate 50 --max-retries 1 -p 1-1024 192.168.1.70`',
       '**Debug a strange result:** `sudo nmap -Pn -n -p 22 --packet-trace --reason HOST`, then repeat it with Wireshark running',
       '**Check from outside:** scan your home IP from a machine on another network (a phone hotspot is enough for one port) to see what the Internet sees, and compare with the LAN view'),
    P('''**Mistakes that waste an afternoon:**'''),
    UL('**Scanning only the default ports** and calling the host "clean": a service on port 2222 or 8888 is invisible.',
       '**Trusting `filtered`** as if it meant closed: it means "I could not tell".',
       '**Trusting `open|filtered`** as a finding: it means "I could not tell" in the other direction.',
       '**Reading a banner as truth.** The version may be hidden, faked or backported.',
       '**Running a scan as a user and expecting SYN, ARP, UDP or OS detection:** they need `sudo`.',
       '**Comparing scans made with different options,** then wondering why the network "changed".',
       '**Never writing down scope.** The one scan that goes wrong will be the one you cannot justify.'),

    H2('Practice', 'practice'),
    EX('nmap-ex-pick-the-scan', 'Pick the scan', 'think',
       '''Say which scan (or option) you would use for each job, and why. (1) You are not an administrator on a work laptop and want to know if SSH is open on `192.168.1.50`. (2) You want every device on your LAN, including those that ignore ping. (3) You want to know which ports a firewall lets traffic through to,
       without caring whether anything listens. (4) You want to check whether a router answers DNS on UDP. (5) A host looks down but you know it is there.''',
       '''
       1. nmap -p 22 192.168.1.50. Without root nmap does a connect scan, which is enough for one port.
       2. sudo nmap -sn 192.168.1.0/24. As root on the local network nmap uses ARP, which devices cannot ignore the way they ignore ICMP.
       3. sudo nmap -sA -p 1-1024 HOST. An ACK scan reports unfiltered (reachable) or filtered (blocked) without needing a listener.
       4. sudo nmap -sU -p 53 192.168.1.1, and add -sV so that nmap sends a real DNS request instead of an empty datagram.
       5. nmap -Pn HOST. Skip discovery and scan the ports anyway.
       ''',
       hints=['Root unlocks ARP, SYN, UDP and ACK scans.', 'Which scan type answers "is it reachable" rather than "is it open"?'],
       why='''Each choice follows from what you need to learn and what the target allows. The scan type is a question; the state is the answer you can trust only as far as the question allows.'''),
    EX('nmap-ex-read-the-states', 'Read the states', 'think',
       '''You scan a host with `sudo nmap -sU -p 53,123,161,1900 --reason HOST` and get: `53/udp open domain udp-response`, `123/udp open|filtered ntp no-response`, `161/udp closed snmp port-unreach`, `1900/udp filtered upnp admin-prohibited`. Explain each line in a sentence, and say what you would do next with `123`.''',
       '''
       53: the DNS service answered nmap's real DNS query, so it is certainly open.
       123: nmap got no reply. Either NTP is running and ignored the probe, or a firewall dropped it. The state is unknown.
       161: the host sent back ICMP port unreachable, so nothing is listening for SNMP: closed.
       1900: something answered with ICMP "administratively prohibited": a firewall or ACL actively blocks it. Its true state is unknown, but it is not reachable from here.
       Next for 123: sudo nmap -sU -sV -p 123 HOST. Version detection sends a genuine NTP request, which an NTP server answers.
       ''',
       hints=['Look at the reason column for each line.', 'Which of the answers prove something, and which only show silence?'],
       why='''Only `udp-response` and `port-unreach` prove anything about a UDP port. Silence and ICMP prohibitions leave the real state unknown. Resolving the doubt means asking the port a real question.'''),
    EX('nmap-ex-parse-xml', 'List open ports from XML', 'py',
       '''`XML` holds a trimmed nmap XML report. Print one line for each **open** port, in the form `ADDRESS:PORT NAME PRODUCT VERSION` (leave out `PRODUCT` and `VERSION` when the service has none), sorted by address and then by numeric port. Use `xml.etree.ElementTree`.''',
       X('''
       import xml.etree.ElementTree as ET

       XML = """@@XML@@"""

       root = ET.fromstring(XML)
       rows = []
       for host in root.findall("host"):
           addr = host.find("address").get("addr")
           for port in host.findall("ports/port"):
               if port.find("state").get("state") != "open":
                   continue
               svc = port.find("service")
               parts = [svc.get("name"), svc.get("product"), svc.get("version")]
               rows.append((addr, int(port.get("portid")), " ".join(p for p in parts if p)))

       for addr, port, text in sorted(rows):
           print(f"{addr}:{port} {text}")
       '''),
       hints=['`host.findall("ports/port")` finds every port of a host.', '`port.find("state").get("state")` is `open`, `closed` or `filtered`.', 'Sort tuples of `(address, int(port), text)` so 80 sorts before 8080.'],
       why='''Nmap XML is a stable, documented format: every tool from `ndiff` to commercial scanners reads it. Parsing it yourself is the first step towards a report, a dashboard or an alert. Note how a closed or filtered port is in the file but not in your output.''',
       starter=X('''
       import xml.etree.ElementTree as ET

       XML = """@@XML@@"""

       root = ET.fromstring(XML)
       # print ADDRESS:PORT NAME PRODUCT VERSION for each open port, sorted
       '''),
       check='''
       assert out.strip().split("\\n") == ["192.168.1.50:22 ssh OpenSSH 9.2p1", "192.168.1.50:80 http nginx 1.22.1", "192.168.1.60:22 ssh OpenSSH 8.4", "192.168.1.60:445 microsoft-ds"], "Expected the four open ports, sorted: " + repr(out)
       '''),
    EX('nmap-ex-greppable', 'Hosts with too many open ports', 'py',
       '''`LINES` holds lines in nmap\'s greppable format (`-oG`). Write `open_ports(line)` returning the list of open port numbers (as integers) from a `Ports:` line, and print each host address that has **more than two** open ports, in file order, followed by the count: `192.168.1.60 4`.''',
       '''
       LINES = [
           "Host: 192.168.1.1 (router.lan)\\tPorts: 53/open/tcp//domain///, 80/open/tcp//http///, 443/open/tcp//https///",
           "Host: 192.168.1.50 (pi.lan)\\tPorts: 22/open/tcp//ssh///, 80/open/tcp//http///, 8080/closed/tcp//http-proxy///",
           "Host: 192.168.1.60 (nas.lan)\\tPorts: 22/open/tcp//ssh///, 139/open/tcp//netbios-ssn///, 445/open/tcp//microsoft-ds///, 5000/open/tcp//upnp///",
           "Host: 192.168.1.90 (homeassistant.lan)\\tPorts: 8123/open/tcp//http///",
       ]

       def open_ports(line):
           if "Ports:" not in line:
               return []
           field = line.split("Ports:", 1)[1]
           found = []
           for item in field.split(","):
               parts = item.strip().split("/")
               if parts[1] == "open":
                   found.append(int(parts[0]))
           return found

       for line in LINES:
           host = line.split()[1]
           n = len(open_ports(line))
           if n > 2:
               print(host, n)
       ''',
       hints=['Split the part after `Ports:` on commas, then each item on `/`.', 'In `22/open/tcp//ssh///` the first field is the port and the second the state.'],
       why='''The greppable format is a table in disguise: fields separated by tabs, ports separated by commas, and the parts of a port separated by slashes. Three `split` calls open it. It is deprecated in favour of XML, but it is still the fastest way to a one-liner.''',
       starter='''
       LINES = [
           "Host: 192.168.1.1 (router.lan)\\tPorts: 53/open/tcp//domain///, 80/open/tcp//http///, 443/open/tcp//https///",
           "Host: 192.168.1.50 (pi.lan)\\tPorts: 22/open/tcp//ssh///, 80/open/tcp//http///, 8080/closed/tcp//http-proxy///",
           "Host: 192.168.1.60 (nas.lan)\\tPorts: 22/open/tcp//ssh///, 139/open/tcp//netbios-ssn///, 445/open/tcp//microsoft-ds///, 5000/open/tcp//upnp///",
           "Host: 192.168.1.90 (homeassistant.lan)\\tPorts: 8123/open/tcp//http///",
       ]

       def open_ports(line):
           return []

       for line in LINES:
           host = line.split()[1]
           n = len(open_ports(line))
           if n > 2:
               print(host, n)
       ''',
       check='''
       assert open_ports(LINES[1]) == [22, 80], "a closed port must not count"
       assert open_ports("Host: 10.0.0.1 ()\\tStatus: Up") == [], "a line with no Ports field has no open ports"
       assert out.strip().split("\\n") == ["192.168.1.1 3", "192.168.1.60 4"], "Expected the router and the NAS: " + repr(out)
       '''),
    EX('nmap-ex-scan-size', 'How big is this scan?', 'py',
       '''Before you run a scan, estimate it. Write `count_ports(spec)`, which counts the ports in a spec such as `22,80,8000-8010` (a range counts every port in it), and `count_hosts(cidr, excluded)`, which counts the addresses in a CIDR block minus the addresses in the `excluded` list that fall inside it.
       Write `serial_time(probes, delay)`, which returns the time in seconds a serialised scan needs. Then print, for the scan described by `CIDR`, `SPEC` and `EXCLUDED`, the number of probes, and the time at `-T2` (0.4 seconds between probes) in the form `NNN probes, 6.7 minutes` (one decimal place).''',
       '''
       import ipaddress

       CIDR = "192.168.1.0/28"
       SPEC = "22,80,8000-8010"
       EXCLUDED = ["192.168.1.1", "192.168.1.2"]

       def count_ports(spec):
           total = 0
           for part in spec.split(","):
               if "-" in part:
                   a, b = part.split("-")
                   total += int(b) - int(a) + 1
               else:
                   total += 1
           return total

       def count_hosts(cidr, excluded):
           net = ipaddress.ip_network(cidr)
           skip = {ipaddress.ip_address(x) for x in excluded}
           return net.num_addresses - len([ip for ip in skip if ip in net])

       def serial_time(probes, delay):
           return probes * delay

       probes = count_hosts(CIDR, EXCLUDED) * count_ports(SPEC)
       minutes = serial_time(probes, 0.4) / 60
       print(f"{probes} probes, {minutes:.1f} minutes")
       ''',
       hints=['`ipaddress.ip_network("192.168.1.0/28").num_addresses` is 16.', 'For a range `a-b` there are `b - a + 1` ports.', 'Only subtract excluded addresses that really are inside the block.'],
       why='''Probes are hosts times ports, and a serialised scan multiplies that by the delay. Doing the sum first is how you notice that `-T1` on a /24 will not finish before the weekend, and that `-p-` on 254 hosts is more than 16 million probes.''',
       starter='''
       import ipaddress

       CIDR = "192.168.1.0/28"
       SPEC = "22,80,8000-8010"
       EXCLUDED = ["192.168.1.1", "192.168.1.2"]

       def count_ports(spec):
           return 0

       def count_hosts(cidr, excluded):
           return 0

       def serial_time(probes, delay):
           return 0

       probes = count_hosts(CIDR, EXCLUDED) * count_ports(SPEC)
       minutes = serial_time(probes, 0.4) / 60
       print(f"{probes} probes, {minutes:.1f} minutes")
       ''',
       check='''
       assert count_ports("22,80,8000-8010") == 13
       assert count_ports("1-1024") == 1024
       assert count_hosts("192.168.1.0/28", ["192.168.1.1", "192.168.1.2"]) == 14
       assert count_hosts("192.168.1.0/28", ["10.0.0.1"]) == 16, "an excluded address outside the block changes nothing"
       assert serial_time(1000, 0.4) == 400
       assert out.strip() == "182 probes, 1.2 minutes", "14 hosts x 13 ports = 182 probes, 72.8 s: " + repr(out)
       '''),
    EX('nmap-ex-diff-scans', 'What changed since last week?', 'py',
       '''`OLD` and `NEW` are sets of `(address, port)` pairs for the open ports in two scans. Print every port that opened as `+ ADDRESS:PORT` and every port that closed as `- ADDRESS:PORT`, closed ports first, each group sorted by address and then numeric port. Print `no changes` if the sets are equal.''',
       '''
       OLD = {("192.168.1.50", 22), ("192.168.1.50", 80), ("192.168.1.60", 22), ("192.168.1.60", 445)}
       NEW = {("192.168.1.50", 22), ("192.168.1.50", 80), ("192.168.1.50", 8080), ("192.168.1.60", 445)}

       closed = sorted(OLD - NEW)
       opened = sorted(NEW - OLD)

       if not closed and not opened:
           print("no changes")
       for addr, port in closed:
           print(f"- {addr}:{port}")
       for addr, port in opened:
           print(f"+ {addr}:{port}")
       ''',
       hints=['`OLD - NEW` is what disappeared; `NEW - OLD` is what appeared.', '`sorted` on tuples sorts by address and then by the integer port.'],
       why='''Set difference is the whole idea of `ndiff` for ports. The real tool also compares services, versions and whole hosts, but this is its core: two snapshots, two subtractions. A line starting with `+` on a host you did not change is the one to investigate.''',
       starter='''
       OLD = {("192.168.1.50", 22), ("192.168.1.50", 80), ("192.168.1.60", 22), ("192.168.1.60", 445)}
       NEW = {("192.168.1.50", 22), ("192.168.1.50", 80), ("192.168.1.50", 8080), ("192.168.1.60", 445)}

       # print "- host:port" for closed ports, then "+ host:port" for new ones
       ''',
       check='''
       assert out.strip().split("\\n") == ["- 192.168.1.60:22", "+ 192.168.1.50:8080"], "Closed ports first, then opened ports: " + repr(out)
       '''),
    EX('nmap-ex-who-has-445', 'Which hosts share files?', 'terminal',
       '''In the practice terminal at the end of this chapter (or on your Mac, in `~/lab`), use `scan.txt`, a saved scan of five devices, to print the host name of each device that has port 445 open. Then print how many devices have port 22 open.''',
       '''awk '/^Nmap scan report/ {host=$5} /^445\\/tcp +open/ {print host}' scan.txt
grep -c "^22/tcp" scan.txt''',
       hints=['A host name is on the `Nmap scan report` line; ports are on the lines below it, so remember the last host seen.', '`grep -c` counts matching lines.'],
       why='''A scan file is a stream of lines in which the context (the host) comes first and the details follow. `awk` is built for that: set a variable on the header line and use it on the lines that follow.''',
       verify='''awk '/^Nmap scan report/ {host=$5} /^445\\/tcp +open/ {print host}' scan.txt | grep -q "nas.lan" && echo OK'''),
    CHECK('nmap-ch-nmap-checkpoint', 'Nmap checkpoint',
          Q('You run a UDP scan and port 161 comes back `open|filtered`. What does that mean?',
            [('It is open', False), ('It is closed', False), ('Nmap got no answer: the port may be open or a firewall may have dropped the probe', True), ('The host is down', False)],
            'UDP silence is ambiguous. Only a reply proves a port open and an ICMP port-unreachable proves it closed. Use `-sV` to send a protocol-specific probe.'),
          Q('Why does a SYN scan not complete the TCP handshake?',
            [('The kernel replies to the SYN/ACK with a RST, so no connection is ever established', True), ('Nmap cannot send an ACK', False), ('Because the target forbids it', False), ('It only works on closed ports', False)],
            'On an open port the target answers SYN/ACK, and the scanner\'s operating system, which has no matching socket, sends a RST. That is why services seldom log a SYN scan, and why firewalls still see it.'),
          Q('On your own LAN, which host discovery method cannot be hidden by a host firewall?',
            [('ICMP echo', False), ('TCP SYN to port 443', False), ('ARP', True), ('UDP to port 53', False)],
            'A host must answer ARP to communicate on its Ethernet segment, and a firewall that works at the IP layer does not see it. Nmap uses ARP automatically on a local network when run as root.'),
          Q('Every one of the 1000 default ports on a host is `filtered`, and the host is up. What is the most likely explanation?',
            [('A default-deny firewall in front of it', True), ('No services are running', False), ('Every service is crashed', False), ('Nmap is broken', False)],
            'A host with nothing running answers with resets and shows `closed`. `filtered` everywhere means something is silently dropping the probes.'),
          Q('Which NSE category is the safest default for a first look at your own network?',
            [('`default`, or `safe`', True), ('`vuln`', False), ('`brute`', False), ('`exploit`', False)],
            '`default` and `safe` read what services volunteer. `vuln`, `brute`, `dos`, `exploit` and `intrusive` can lock accounts, crash services or look like an attack and need explicit permission.'),
          Q('You compare Monday\'s and Friday\'s scans with `ndiff` and it prints a new `3306/tcp open mysql` on the NAS. What is your next step?',
            [('Ignore it: the NAS is yours', False), ('Find out who or what started it and whether it should be reachable, then fix or document it', True), ('Block the whole subnet', False), ('Delete the scan files', False)],
            'A new open port is exactly what a baseline exists to reveal. A database listening on the network is a classic exposure: find out what changed, and either close it or restrict it to the hosts that need it.')),
    PROJECT('nmap-pr-exposure-report', 'Exposure report for your home network', 'intermediate', 75,
            ['nmap', 'ndiff', 'XML parsing', 'reporting', 'Wireshark'],
            P('''Produce a one-page report of what your home network exposes, with evidence, and a way to find out when it changes. Everything here targets devices you own. Write down your scope first: the ranges, the date and the techniques you will use.'''),
            H3('1. Scope and inventory'),
            P('''Write `scope.txt` with your subnet and anything to exclude. Run `sudo nmap -sn -n -oA inventory -iL scope.txt` and list every address with its vendor. Name each device. Any device you cannot name is your first finding.'''),
            H3('2. A deep scan'),
            P('''For each live host, run the two-pass method from this chapter (`-p-` fast, then `-sV -sC` on the open ports). Save everything with `-oA`. Add `-O` for hosts you want to identify, and `-sU --top-ports 20` for the router.'''),
            H3('3. Classify'),
            P('''Write a Python script that reads the XML (see the exercise) and produces a Markdown table: host, port, service and version, then a column for **Expected?** and **Action**. Fill in the last two by hand. Use the risk table in this chapter to decide which open ports deserve a question.'''),
            H3('4. Fix one thing and prove it'),
            P('''Close or restrict one exposure, for example by turning off UPnP on the router, disabling Telnet on a device or binding a development server to `127.0.0.1`. Run the same scan again and use `ndiff` to show the difference as evidence.'''),
            H3('5. Watch it from the other side'),
            P('''Run a capture with `tshark` or Wireshark while you scan one host. Find your scan with the filters in this chapter, count the SYNs and the resets, and see which flags and window size nmap used. Check the service logs on that host: which line recorded your scan?'''),
            H3('6. Make it a habit'),
            P('''Schedule `baseline.sh` weekly. Decide what you will do when it emails you a diff: who owns the response, and how do you tell a new device from an attack?'''),
            H3('7. Stretch goals'),
            UL('Add a dashboard that shows the exposure map for your own network, one row per host.', 'Scan your public address from a different network and compare the Internet\'s view with the LAN\'s.',
               'Write a small detector for your own capture files that flags a source touching more than 20 destination ports in two seconds (see the Wireshark chapter).')),
    H2('Try it in the practice terminal', 'sim'),
    P('''The simulator has a canned LAN and the saved `scan.txt`. Its `nmap` answers for the lab hosts, so you can practise the pipelines from this chapter on real-looking data: list live hosts, count open ports and reshape the output with `awk`. Start with
    `nmap -sn 192.168.1.0/24` and `nmap 192.168.1.60`.'''),
    WIDGET('sim', cwd='~/lab', chapter='nmap'),
    H2('Glossary and next steps', 'next'),
    P('''Next: [Defending Your Mac and Servers](#defend) turns what you found into hardening, and the [Cisco IOS Cheat Sheet](#cisco) shows the router and switch side of filtering and ACLs. To go deeper, read the Nmap Network Scanning book and the NSE documentation at nmap.org, and compare nmap\'s results
    with a second tool (for example `masscan` for speed, or `rustscan`) on a network you own.'''),
]

terms = [
    ('nmap', 'Network Mapper: a free scanner that finds hosts, open ports, services, operating systems and (with scripts) weaknesses'),
    ('host discovery', 'the first nmap phase, which decides which targets are alive before any port is probed'),
    ('port scan', 'sending probes to many ports on a host and classifying each reply'),
    ('SYN scan', 'a scan that sends SYN packets and never finishes the handshake (-sS); fast and the default for root'),
    ('connect scan', 'a scan that uses the operating system\'s connect() call and completes the handshake (-sT)'),
    ('open', 'a port state: a program accepted the probe'),
    ('closed', 'a port state: the host answered, but no program listens'),
    ('filtered', 'a port state: no answer or an ICMP refusal, so a filter hides the real state'),
    ('open|filtered', 'a state nmap uses when silence could mean either an open port or a dropped probe'),
    ('ARP scan', 'host discovery on a local Ethernet segment using ARP requests, which hosts cannot ignore'),
    ('banner', 'text a service sends when you connect, usually naming the program and version'),
    ('version detection', 'identifying the program and version behind a port by talking to it (-sV)'),
    ('OS fingerprinting', 'guessing a host\'s operating system from the way its TCP/IP stack answers odd packets (-O)'),
    ('CPE', 'Common Platform Enumeration: a standard name for a product and version, used to look up vulnerabilities'),
    ('NSE', 'the Nmap Scripting Engine: Lua scripts for discovery, auditing and exploitation, grouped in categories'),
    ('timing template', 'one of -T0 to -T5, a bundle of delays and retries that sets how fast nmap runs'),
    ('baseline', 'a saved scan of a known-good network, used to spot change later'),
    ('ndiff', 'a tool shipped with nmap that compares two XML scans and shows what changed'),
    ('idle scan', 'a stealthy scan that infers a target\'s open ports from a third host\'s predictable IP ID counter (-sI)'),
    ('scope', 'the written list of what you may test, when and how'),
    ('attack surface', 'everything on a system or network that an outsider can reach and try to abuse'),
]

CHAPTER = chapter('nmap', 'Nmap: Scanning Your Network Like an Auditor',
                  'How scans work and what each reply means, host discovery, service and OS detection, NSE scripts, saving and comparing results, and how a scan looks to the defender',
                  'wireshark', 100,
                  ['Set the scope and rules of engagement for a scan, and scan only what you own or are authorised to test',
                   'Explain how nmap finds live hosts and classifies each port, and choose the right scan type for a question',
                   'Build nmap commands for ports, timing, service and OS detection and safe NSE scripts, and say what each will send',
                   'Keep results in every format, parse the XML and diff two scans to find change',
                   'Recognise a scan in a capture and in logs, and say what it tells the defender'],
                  blocks, terms, level='intermediate', part='sec', file='42a-nmap.gm')
