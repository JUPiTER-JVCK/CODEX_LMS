from lib import *

# Every filter in this chapter is collected here as well as shown in a table, so that test/wsref_filters.py can
# compile each one with real tshark (display filters) and dumpcap (capture filters). A filter that only looks right
# never reaches the page.
DISPLAY = []
CAPTURE = []


def df(f):
    DISPLAY.append(f)
    return '`' + f.replace('|', '\\|') + '`'


def cf(f):
    CAPTURE.append(f)
    return '`' + f.replace('|', '\\|') + '`'


def ftable(title, rows, head=('Question', 'Display filter')):
    return TABLE(list(head), [[q, ' or '.join(df(x) for x in (f if isinstance(f, (list, tuple)) else [f]))] + list(rest)
                              for q, f, *rest in rows], title)


# Filters that circulate on popular cheat sheets but do not work, with the fix. The test checks that every "wrong"
# one really is rejected by tshark and every fix is accepted.
BROKEN = [
    ('ip.dest == 192.168.1.1', 'ip.dst == 192.168.1.1', 'The field is `ip.dst`. Wireshark has no `ip.dest`, so the bar turns red.'),
    ('frame.len >> 10', 'frame.len >= 10', 'There is no `>>` operator. Greater-or-equal is `>=` or `ge`.'),
    ('interface == eth0', 'frame.interface_name == "eth0"', 'Interfaces are not a field called `interface`. Either pick the interface when you start the capture, or filter on `frame.interface_name` (pcapng files record it). On a Mac the Wi-Fi interface is usually `en0`.'),
    ('http.response.status_code == 200', 'http.response.code == 200', 'The status code field is `http.response.code`.'),
    ('ip.addr == 10.0.0.5 AA ip.addr == 10.0.0.9', 'ip.addr == 10.0.0.5 ^^ ip.addr == 10.0.0.9', 'Exclusive or is written `^^` or `xor`. "AA" is a misprint of `^^`.'),
]

blocks = [
    P('''This chapter is a one-stop reference for Wireshark: what each part of the window is for, how capture filters and display
    filters differ, the syntax of both, and the filters you will reach for most, grouped by protocol. The pictures are there to be looked at
    first: the window, the journey of a packet through the two kinds of filter, the layers that give fields their names, and the TCP
    conversation most filters are about. Everything was checked against real `tshark`, and the last section corrects the mistakes that
    circulate on popular cheat sheets. The full explanations, the packet lab and the case files are in [Packet Capture](#capture) and
    [Wireshark for Security](#wireshark).'''),
    WIDGET('wsart', kind='hero'),
    CALLOUT('danger', 'Your traffic, your network, your permission', '''Capture only on devices and networks you own or administer, or where you have written permission. A capture holds everything the
    packets held, including cookies, tokens and, on plain HTTP, passwords: store it like a secret and delete it when you are done.'''),

    H2('The Wireshark window', 'window'),
    P('''Wireshark always shows the same three panes, top to bottom: the **packet list** (one line per packet), the **packet details**
    (the selected packet as a tree, one branch per protocol layer) and the **packet bytes** (the raw hex). Clicking in one pane highlights
    the matching part of the other two. Hover the numbers in the picture to see what each part does.'''),
    WIDGET('wsart', kind='window'),
    TABLE(['Column', 'What it shows'], [
        ['**No.**', 'Frame number, counted from the start of the capture. It never changes when you filter, so it is how you refer to a packet ("look at frame 412").'],
        ['**Time**', 'By default, seconds since the first packet in the capture. Change it under **View, Time Display Format**: time of day, or seconds since the previous displayed packet (good for spotting delays).'],
        ['**Source**', 'Sender address: IPv4 or IPv6 if the packet has an IP layer, otherwise the Ethernet (MAC) address, as for ARP.'],
        ['**Destination**', 'Receiver address, chosen the same way.'],
        ['**Protocol**', 'The highest-layer protocol Wireshark recognised: `TCP` for a bare segment, `HTTP` or `TLSv1.3` when it understood the payload.'],
        ['**Length**', 'Size of the whole frame in bytes as captured on the wire (`frame.len`).'],
        ['**Info**', 'A one-line summary written by the top dissector: flags and ports for TCP, the question for DNS, the method and path for HTTP.'],
    ], 'Default columns'),
    CALLOUT('tip', 'Turn any field into a column or a filter', '''Right-click a field in the details pane and choose **Apply as Column** to add it to the packet list, or **Apply as Filter, Selected**
    to filter on it. The status bar shows the field name of whatever you click, which is the quickest way to learn field names.'''),
    TABLE(['Colour (default rules)', 'Rule', 'Means'], [
        ['Light purple', '`tcp`', 'ordinary TCP'],
        ['Light blue', '`udp`', 'ordinary UDP (DNS, QUIC, mDNS…)'],
        ['Light green', '`http || tcp.port == 80`', 'HTTP'],
        ['Grey', '`tcp.flags & 0x02 || tcp.flags.fin == 1`', 'connection opening (SYN) or closing (FIN)'],
        ['Dark red, yellow text', '`tcp.flags.reset eq 1`', 'TCP reset: refused or aborted'],
        ['Black, red text', '`tcp.analysis.flags && !tcp.analysis.window_update …`', '"Bad TCP": retransmissions, duplicate ACKs, zero window'],
        ['Pale yellow', '`arp`', 'ARP'],
        ['Pink', '`icmp || icmpv6`', 'ICMP (ping, unreachable, TTL exceeded)'],
    ], 'Colouring rules (View, Coloring Rules)'),

    H2('Capture filters and display filters', 'two-filters'),
    P('''Wireshark has two filter languages, and mixing them up is the most common beginner mistake. A **capture filter** decides
    which packets are saved at all; it runs in the kernel, before Wireshark understands anything, and uses the BPF syntax of `tcpdump`. A
    **display filter** decides which saved packets you see; it runs after the dissectors have named every field, so it can ask about
    anything Wireshark understands. A packet dropped by a capture filter is gone for good. A packet hidden by a display filter is still in
    the file.'''),
    WIDGET('wsart', kind='pipeline'),
    TABLE(['', 'Capture filter', 'Display filter'], [
        ['Decides', 'what is **saved**', 'what is **shown**'],
        ['Runs', 'in the kernel, while capturing', 'in Wireshark, any time, on a saved file too'],
        ['Syntax', 'BPF, as in `tcpdump`: ' + cf('tcp port 443'), 'Wireshark fields: ' + df('tcp.port == 443')],
        ['Knows about', 'addresses, ports, protocols, bytes at offsets', 'every field of every protocol Wireshark dissects'],
        ['Where you type it', 'Capture Options (⌘K), or the bar on the welcome screen', 'the filter bar above the packet list'],
        ['Mistake costs', 'lost packets you can never get back', 'nothing: clear the filter'],
        ['Use it for', 'long or busy captures where disk space matters', 'everything else'],
    ], 'Side by side'),
    CALLOUT('info', 'Capture everything, then filter', '''On your own Mac and home network, capture without a capture filter and narrow things down with display filters afterwards. Reach for a
    capture filter only when the capture would otherwise be too big, such as a week-long ring buffer on a busy server.'''),

    H2('Capture filter syntax', 'capture-syntax'),
    P('''A capture filter is a list of **primitives** joined by `and`, `or` and `not`. Each primitive is an optional protocol, an
    optional direction and a type, followed by a value: `tcp dst port 443` reads as "TCP, to, port, 443". Leave a qualifier out and it
    means "any": `port 53` matches TCP and UDP, to and from.'''),
    ANAT('A capture filter', [
        ('tcp', 'protocol qualifier: ether, ip, ip6, arp, tcp, udp, icmp'),
        ('dst', 'direction qualifier: src, dst, src or dst (the default)'),
        ('port', 'type qualifier: host, net, port, portrange'),
        ('443', 'the value: an address, a subnet, a port or a range'),
        ('and', 'logical operator: and (&&), or (||), not (!)'),
        ('not host 192.168.1.1', 'a second primitive, negated'),
    ]),
    TABLE(['To capture', 'Capture filter'], [
        ['One host, both directions', cf('host 192.168.1.23')],
        ['Only what one host sends', cf('src host 192.168.1.23')],
        ['A whole subnet', cf('net 192.168.1.0/24')],
        ['One port, TCP or UDP', cf('port 53')],
        ['Web traffic', cf('tcp port 80 or tcp port 443')],
        ['A range of ports', cf('tcp portrange 8000-8080')],
        ['One device by MAC address', cf('ether host 3c:37:86:c1:5a:02')],
        ['Everything except your SSH session', cf('not port 22')],
        ['Everything except ARP and DNS noise', cf('not arp and not port 53')],
        ['Only connection attempts (SYN without ACK)', cf('tcp[tcpflags] & (tcp-syn|tcp-ack) == tcp-syn')],
        ['Ping and other ICMP', cf('icmp')],
        ['IPv6 only', cf('ip6')],
        ['Small packets only (under 128 bytes)', cf('less 128')],
        ['One host on two ports (use brackets)', cf('host 203.0.113.10 and (port 80 or port 443)')],
    ], 'Capture filters you will use'),
    CALLOUT('warn', 'Quote it in the shell', '''In Terminal, wrap capture filters in quotes so zsh does not treat `(`, `|` or `&` as its own: `dumpcap -i en0 -f "tcp port 443" -w web.pcapng`.'''),
    TABLE(['Mode', 'What it does', 'On a Mac'], [
        ['**Promiscuous**', 'The network card passes up every frame it sees, not only frames addressed to it. On a switched network you still see only your own traffic plus broadcasts, unless the switch mirrors a port to you.', 'On by default in Capture Options. Wi-Fi in promiscuous mode shows your own traffic as Ethernet.'],
        ['**Monitor**', 'A Wi-Fi card listens to every 802.11 frame on one channel without joining a network: beacons, probes, other devices\' frames. Data on WPA2/WPA3 networks stays encrypted unless you have the passphrase and capture the device\'s 4-way handshake.', 'Tick **Monitor Mode** for `en0` in Capture Options. Your Mac drops off Wi-Fi while it is on.'],
    ], 'Capture modes'),

    H2('Display filter syntax', 'display-syntax'),
    P('''A display filter is a true-or-false question asked of every packet. The pieces are **protocols** (`dns`, `tls`), **fields**
    (`ip.src`, `http.request.method`), **values** and **operators**. A bare protocol or field name means "this packet has it": `dns` shows DNS
    packets and `http.authorization` shows packets that carry that header. The filter bar turns green when the syntax is valid and red when
    it is not.'''),
    ANAT('A display filter', [
        ('http', 'protocol: the layer the field belongs to'),
        ('.request.method', 'field path inside that protocol'),
        ('==', 'comparison operator (also eq)'),
        ('"POST"', 'value: strings in double quotes'),
        ('&&', 'logical operator (also and)'),
        ('ip.dst == 192.168.1.0/24', 'a second test; IP fields accept CIDR subnets'),
    ]),
    TABLE(['Operator', 'Also written', 'Means', 'Example'], [
        ['`==`', '`eq`, `any_eq`', 'equal (any occurrence)', df('ip.dst == 192.168.1.1')],
        ['`!=`', '`ne`, `all_ne`', 'not equal (no occurrence)', df('ip.dst != 192.168.1.1')],
        ['`===`', '`all_eq`', 'every occurrence equal', df('ip.addr === 192.168.1.23')],
        ['`>`', '`gt`', 'greater than', df('frame.len > 10')],
        ['`<`', '`lt`', 'less than', df('frame.len < 10')],
        ['`>=`', '`ge`', 'greater or equal', df('frame.len >= 10')],
        ['`<=`', '`le`', 'less or equal', df('frame.len <= 10')],
        ['`contains`', '', 'text or bytes appear inside', df('http.host contains "example"')],
        ['`matches`', '`~`', 'regular expression, case-insensitive', df('dns.qry.name matches "^mail[0-9]+\\\\."')],
        ['`in {…}`', '', 'one of a set or range', df('tcp.port in {80, 443, 8000..8080}')],
        ['`&`', '', 'bitwise and is not zero', df('tcp.flags & 0x02')],
    ], 'Comparison operators'),
    TABLE(['Operator', 'Also written', 'Means', 'Example'], [
        ['`&&`', '`and`', 'both must match', df('ip.src == 192.168.1.23 && tcp.port == 443')],
        ['`\\|\\|`', '`or`', 'either may match', df('dns || mdns')],
        ['`^^`', '`xor`', 'exactly one matches, not both', df('tcp.port == 80 ^^ tcp.port == 8080')],
        ['`!`', '`not`', 'negation', df('!arp')],
        ['`( )`', '', 'group; use it whenever you mix and with or', df('ip.addr == 192.168.1.23 && (dns || http)')],
    ], 'Logical operators'),
    TABLE(['Feature', 'Syntax', 'Example'], [
        ['Slice: bytes or characters by position', '`field[start:length]`', df('eth.src[0:3] == 3c:37:86') + ' (the vendor part of a MAC)'],
        ['Membership', '`field in {a, b, x..y}`', df('ip.addr in {192.168.1.1, 192.168.1.60}')],
        ['Length of a field', '`len(field)`', df('len(http.host) > 30')],
        ['Case-insensitive compare', '`lower(field)`', df('lower(http.host) == "intranet.lab.example"')],
        ['How many times a field occurs', '`count(field)`', df('count(ip.src) > 1') + ' (IP inside IP: a tunnel)'],
        ['Field exists', 'just the name', df('tcp.analysis.retransmission')],
    ], 'Slices, sets and functions'),
    CALLOUT('warn', 'The two rules behind most surprises', '''**One:** fields like `ip.addr` and `tcp.port` hold two values (source and destination), and `==` is true if either matches. So
    `ip.addr >= 10.0.0.5 && ip.addr <= 10.0.0.9` can be true because the source is above 10.0.0.5 and the destination is below 10.0.0.9.
    Write a range as a set instead: `ip.addr in {10.0.0.5..10.0.0.9}`. **Two:** a test on a field the packet does not have is false.
    `ip.addr != 192.168.1.23` hides ARP too, because ARP has no IP layer; write `!(ip.addr == 192.168.1.23)` to keep it.'''),

    H2('Where field names come from', 'layers'),
    P('''Every display-filter field starts with the name of the protocol layer it lives in, and the layers are nested exactly as in the
    details pane: Ethernet carries IP, IP carries TCP, TCP carries HTTP. Learn the layer prefixes and you can guess most field names.'''),
    WIDGET('wsart', kind='layers'),
    TABLE(['Layer', 'Prefix', 'Fields you will use'], [
        ['Frame (capture metadata)', '`frame.`', '`frame.number`, `frame.len`, `frame.time_relative`, `frame.interface_name`, `frame.protocols`'],
        ['Ethernet (link)', '`eth.`', '`eth.src`, `eth.dst`, `eth.addr`, `eth.type`'],
        ['ARP', '`arp.`', '`arp.opcode`, `arp.src.proto_ipv4`, `arp.src.hw_mac`, `arp.dst.proto_ipv4`'],
        ['IPv4 / IPv6 (network)', '`ip.` / `ipv6.`', '`ip.src`, `ip.dst`, `ip.addr`, `ip.ttl`, `ipv6.addr`'],
        ['TCP / UDP (transport)', '`tcp.` / `udp.`', '`tcp.port`, `tcp.srcport`, `tcp.dstport`, `tcp.flags.syn`, `tcp.stream`, `tcp.len`, `udp.port`'],
        ['Application', '`http.` `dns.` `tls.` …', '`http.host`, `dns.qry.name`, `tls.handshake.extensions_server_name`'],
    ], 'Layer prefixes'),

    H2('Filters by task', 'by-task'),
    P('''Copy these straight into the filter bar. They are grouped the way questions come up during an investigation.'''),
    ftable('Addresses and ports', [
        ['To or from one host', 'ip.addr == 192.168.1.23'],
        ['Sent by one host', 'ip.src == 192.168.1.23'],
        ['Sent to one host', 'ip.dst == 192.168.1.23'],
        ['A whole subnet', 'ip.addr == 192.168.1.0/24'],
        ['A range of addresses', 'ip.addr in {192.168.1.20..192.168.1.29}'],
        ['Between two hosts', 'ip.addr == 192.168.1.23 && ip.addr == 203.0.113.10'],
        ['Everything except one host', '!(ip.addr == 192.168.1.23)'],
        ['One MAC address', 'eth.addr == 3c:37:86:c1:5a:02'],
        ['MAC source or destination', ['eth.src == 3c:37:86:c1:5a:02', 'eth.dst == ff:ff:ff:ff:ff:ff']],
        ['One port, TCP or UDP', ['tcp.port == 80', 'udp.port == 53']],
        ['Several ports', 'tcp.port in {22, 80, 443}'],
        ['IPv6 only', 'ipv6'],
        ['Captured on one interface', 'frame.interface_name == "en0"'],
    ]),
    ftable('Size and time', [
        ['Big frames', 'frame.len > 1000'],
        ['TCP segments that carry data', 'tcp.len > 0'],
        ['Frames 100 to 200', 'frame.number >= 100 && frame.number <= 200'],
        ['The first ten seconds', 'frame.time_relative <= 10'],
        ['A gap of more than a second before this packet', 'frame.time_delta_displayed > 1'],
        ['After a clock time', 'frame.time >= "2026-11-18 10:00:00"'],
    ]),
    ftable('TCP', [
        ['New connections being opened', 'tcp.flags.syn == 1 && tcp.flags.ack == 0'],
        ['Ports that answered "open" (SYN-ACK)', 'tcp.flags == 0x012'],
        ['Any SYN, both directions', 'tcp.flags.syn == 1'],
        ['Acknowledgements', 'tcp.flags.ack == 1'],
        ['Resets: refused or aborted', 'tcp.flags.reset == 1'],
        ['Connections closing', 'tcp.flags.fin == 1'],
        ['One conversation (number from the Info or details pane)', 'tcp.stream == 3'],
        ['Anything Wireshark thinks is wrong', 'tcp.analysis.flags'],
        ['Retransmissions', 'tcp.analysis.retransmission'],
        ['Duplicate ACKs', 'tcp.analysis.duplicate_ack'],
        ['Receiver is full (zero window)', 'tcp.analysis.zero_window'],
        ['Slow round trips (over 200 ms)', 'tcp.analysis.ack_rtt > 0.2'],
    ]),
    ftable('HTTP', [
        ['All requests', 'http.request'],
        ['All responses', 'http.response'],
        ['One method', 'http.request.method == "GET"'],
        ['Form posts and logins', 'http.request.method == "POST"'],
        ['One status code', 'http.response.code == 404'],
        ['Every error (4xx and 5xx)', 'http.response.code >= 400'],
        ['One site', 'http.host == "intranet.lab.example"'],
        ['A path', 'http.request.uri contains "/admin"'],
        ['A cookie', 'http.cookie contains "sessionid"'],
        ['Credentials in headers', 'http.authorization'],
        ['A user agent', 'http.user_agent contains "curl"'],
        ['A word anywhere in the packet', 'frame contains "password"'],
    ]),
    ftable('DNS, TLS and QUIC', [
        ['All DNS', 'dns'],
        ['Questions only', 'dns.flags.response == 0'],
        ['Answers only', 'dns.flags.response == 1'],
        ['One name', 'dns.qry.name == "example.com"'],
        ['Names containing a word', 'dns.qry.name contains "example"'],
        ['AAAA (IPv6) lookups', 'dns.qry.type == 28'],
        ['Names that do not exist (NXDOMAIN)', 'dns.flags.rcode == 3'],
        ['Slow answers (over half a second)', 'dns.time > 0.5'],
        ['Long names (tunnelling, exfiltration)', 'dns.qry.name.len > 30'],
        ['TLS Client Hello: which site is being opened', 'tls.handshake.type == 1'],
        ['TLS Server Hello', 'tls.handshake.type == 2'],
        ['A site by its SNI name', 'tls.handshake.extensions_server_name contains "example"'],
        ['TLS alerts (failed handshakes)', 'tls.alert_message'],
        ['QUIC (HTTP/3)', 'quic'],
    ]),
    ftable('ARP, ICMP and DHCP', [
        ['ARP requests ("who has?")', 'arp.opcode == 1'],
        ['ARP replies ("is at")', 'arp.opcode == 2'],
        ['Two MACs claiming one IP', 'arp.duplicate-address-detected'],
        ['Ping requests', 'icmp.type == 8'],
        ['Ping replies', 'icmp.type == 0'],
        ['Destination unreachable', 'icmp.type == 3'],
        ['TTL exceeded (what traceroute reads)', 'icmp.type == 11'],
        ['DHCP', 'dhcp'],
        ['DHCP Discover (a device joining)', 'dhcp.option.dhcp == 1'],
        ['A device by the name it asks DHCP for', 'dhcp.option.hostname contains "iPhone"'],
    ]),
    TABLE(['Protocol', 'Filter', 'Protocol', 'Filter'], [
        ['SSH', df('ssh'), 'SMB 1 / SMB 2 and 3', df('smb') + ' / ' + df('smb2')],
        ['FTP commands', df('ftp'), 'FTP data', df('ftp-data')],
        ['Telnet', df('telnet'), 'SMTP', df('smtp')],
        ['mDNS (Bonjour)', df('mdns'), 'SSDP (UPnP)', df('ssdp')],
        ['NTP', df('ntp'), 'Kerberos', df('kerberos')],
        ['LDAP', df('ldap'), 'RDP', df('rdp')],
        ['HTTP/2', df('http2'), 'SIP (VoIP)', df('sip')],
    ], 'Whole protocols: type the name'),

    H2('The TCP conversation', 'tcp'),
    P('''Most of what you will filter is TCP, and every TCP conversation follows the same script: a three-way handshake to open, data with
    acknowledgements, and FINs to close. Each step has its own filter. Read the arrows top to bottom; time runs downwards.'''),
    WIDGET('wsart', kind='handshake'),
    P('''The flag bits sit in one byte of the TCP header, so `tcp.flags` can also be compared as a number. Click the bits to build a
    combination and read off its filter.'''),
    WIDGET('wsart', kind='flags'),

    H2('Hunting filters', 'hunting'),
    P('''Starting points for a security review. None of them proves an attack on its own; each one shows you where to look next. The case files in
    [Wireshark for Security](#wireshark) work through these with real captures.'''),
    ftable('Suspicious patterns', [
        ['Clear-text logins on the web', 'http.request.method == "POST" && !tls'],
        ['Basic-auth credentials (base64 is not encryption)', 'http.authbasic'],
        ['Clear-text protocols that carry passwords', 'ftp || telnet || pop || imap'],
        ['FTP user names and passwords', 'ftp.request.command in {"USER", "PASS"}'],
        ['Port scan: many SYNs, few answers', 'tcp.flags.syn == 1 && tcp.flags.ack == 0'],
        ['Closed ports answering a scan', 'tcp.flags.reset == 1 && tcp.flags.ack == 1'],
        ['ARP replies to compare MACs (spoofing)', 'arp.opcode == 2'],
        ['Long or odd DNS names (exfiltration)', 'dns.qry.name.len > 30 && dns.flags.response == 0'],
        ['TXT lookups, a favourite tunnel', 'dns.qry.type == 16'],
        ['Traffic on unusual ports', '!(tcp.port in {22, 53, 80, 443}) && tcp.flags.syn == 1 && tcp.flags.ack == 0'],
        ['Old TLS versions (1.0 and 1.1)', 'tls.record.version <= 0x0302'],
        ['Low TTL: possibly forged or from far away', 'ip.ttl < 10'],
        ['Everything but the usual background noise', '!(arp || dns || icmp || mdns || ssdp || llmnr || nbns)'],
    ], ('Look for', 'Display filter')),

    H2('Keyboard shortcuts', 'keys'),
    P('''Wireshark uses the same keys on every system. On a Mac read **Ctrl** as **⌘** and **Alt** as **⌥** for the menu commands; the
    arrow and function keys are the same everywhere.'''),
    TABLE(['Keys', 'Does'], [
        ['[[Ctrl+E]]', 'start or stop capturing'],
        ['[[Ctrl+K]]', 'capture options (interface, capture filter, monitor mode)'],
        ['[[Ctrl+R]]', 'restart the capture'],
        ['[[Ctrl+/]]', 'jump to the display filter bar'],
        ['[[Ctrl+F]]', 'find a packet by filter, text or hex'],
        ['[[Ctrl+G]]', 'go to packet number'],
        ['[[Ctrl+M]]', 'mark or unmark the packet (marked packets can be exported alone)'],
        ['[[Ctrl+Alt+Shift+T]]', 'Follow TCP Stream: the whole conversation as text'],
    ], 'Capture and file'),
    TABLE(['Keys', 'Does'], [
        ['[[Tab]] / [[Shift+Tab]]', 'move between the toolbar, packet list, details and bytes'],
        ['[[↓]] / [[↑]]', 'next or previous packet (in the list) or item (in the details)'],
        ['[[Ctrl+↓]] or [[F8]]', 'next packet, even when the list does not have focus'],
        ['[[Ctrl+↑]] or [[F7]]', 'previous packet, even when the list does not have focus'],
        ['[[Ctrl+.]]', 'next packet in the same conversation (TCP, UDP or IP)'],
        ['[[Ctrl+,]]', 'previous packet in the same conversation'],
        ['[[Alt+→]] / [[Alt+←]]', 'forward or back through the packets you have selected'],
        ['[[→]]', 'in the details, open the selected tree item'],
        ['[[Shift+→]]', 'in the details, open the item and everything under it'],
        ['[[Ctrl+→]] / [[Ctrl+←]]', 'in the details, open or close every item'],
        ['[[Backspace]]', 'in the details, jump to the parent item'],
        ['[[Return]]', 'in the details, toggle the selected item'],
    ], 'Moving around'),

    H2('tshark one-liners', 'tshark'),
    P('''`tshark` is Wireshark without the window: same dissectors, same display filters, output you can pipe into `sort`, `awk` or Python.
    It comes with the Wireshark cask (`brew install --cask wireshark-app`).'''),
    TABLE(['Task', 'Command'], [
        ['List interfaces', '`tshark -D`'],
        ['Capture 100 packets on Wi-Fi to a file', '`tshark -i en0 -c 100 -w out.pcapng`'],
        ['Capture with a capture filter', '`tshark -i en0 -f "port 53" -w dns.pcapng`'],
        ['Read a file with a display filter', "`tshark -r out.pcapng -Y 'http.request'`"],
        ['Chosen fields as columns', "`tshark -r out.pcapng -Y dns -T fields -e ip.src -e dns.qry.name`"],
        ['Same, as CSV with a header', "`tshark -r out.pcapng -T fields -E header=y -E separator=, -e ip.src -e ip.dst`"],
        ['Every field of one packet', "`tshark -r out.pcapng -Y 'frame.number == 5' -V`"],
        ['Protocol hierarchy', '`tshark -r out.pcapng -q -z io,phs`'],
        ['Conversations', '`tshark -r out.pcapng -q -z conv,tcp`'],
        ['Follow one TCP stream as text', '`tshark -r out.pcapng -q -z follow,tcp,ascii,3`'],
        ['Look up a field name', "`tshark -G fields \\| grep -w 'dns.qry.name'`"],
    ], 'tshark'),
    TERM('''
    $ tshark -r lab-login.pcap -Y 'http.request' -T fields -e frame.number -e http.request.method -e http.request.uri
    6	GET	/login
    10	POST	/login
    14	GET	/admin
    21	GET	/api/backups
    '''),

    H2('Fixing popular cheat-sheet mistakes', 'myths'),
    P('''Cheat sheets get shared widely, and some of the best-looking ones contain filters that do not work or descriptions that are wrong.
    These are the errors that come up most. The "wrong" filters below really are rejected by `tshark`, and the fixes are accepted; the
    book's tests check both.'''),
    TABLE(['Seen on a cheat sheet', 'Problem', 'Use instead'], [
        ['`' + w.replace('|', '\\|') + '`', why, df(fix)] for w, fix, why in BROKEN
    ] + [
        ['`eq` described as "Logical AND"', '`eq` and `==` test equality. The logical operators are `and`, `or`, `xor`, `not`.', df('ip.dst eq 192.168.1.1')],
        ['`[n] […]` called the "substring operator"', 'Brackets take a **slice** of bytes by position. To search for text use `contains` or `matches`.', df('frame contains "login"')],
        ['`tcp.flags.syn == 1` for "new connections"', 'It also matches the SYN-ACK answers. Add the ACK test.', df('tcp.flags.syn == 1 && tcp.flags.ack == 0')],
        ['`ip.addr >= x and ip.addr <= y` for a range', 'Each test can be satisfied by a different address (source or destination), so it matches too much.', df('ip.addr in {10.0.0.5..10.0.0.9}')],
        ['`protocol_name` such as `smb`', '`smb` is only SMB version 1. Modern Windows and macOS file sharing is SMB 2 and 3.', df('smb2')],
        ['Monitor mode is "Unix/Linux only"', 'It works on macOS too (Capture Options, **Monitor Mode** on `en0`), and on Windows with supported adapters.', '—'],
        ['Shortcuts "Ctrl+" and "Shift+-"', 'The arrow keys were lost in the printing: it is [[Ctrl+↓]], [[Ctrl+↑]], [[Shift+→]] and so on.', 'see [Keyboard shortcuts](#wireshark-ref/keys)'],
    ], 'Corrections'),

    H2('Practise', 'practise'),
    EX('wsref-ex-translate', 'Translate questions into filters', 'think',
       '''Write a display filter for each question, then check your answers in the packet lab in [Wireshark for Security](#wireshark/lab):
       (1) every DNS question asked by 192.168.1.23; (2) every TCP connection attempt to a port other than 443; (3) HTTP responses that were
       errors; (4) all traffic between 192.168.1.23 and 192.168.1.60 except ARP; (5) the TLS Client Hello for any site whose name contains "lab".''',
       '''
       1. ip.src == 192.168.1.23 && dns.flags.response == 0
       2. tcp.flags.syn == 1 && tcp.flags.ack == 0 && tcp.dstport != 443
       3. http.response.code >= 400
       4. ip.addr == 192.168.1.23 && ip.addr == 192.168.1.60
          (ARP has no ip layer, so it is already excluded)
       5. tls.handshake.type == 1 && tls.handshake.extensions_server_name contains "lab"
       ''',
       hints=['Questions are `dns.flags.response == 0`.', 'A connection attempt is SYN without ACK; the port it goes to is `tcp.dstport`.', 'Errors are status codes 400 and above.'],
       why='''Each answer is a combination of one or two lines from the tables above. Building filters from small, known pieces is
       faster and safer than remembering long ones.'''),
    EX('wsref-ex-capture-or-display', 'Capture filter or display filter?', 'think',
       '''For each job, say whether you would use a capture filter or a display filter, and write it: (1) a week-long recording of DNS on a
       Raspberry Pi with a small SD card; (2) finding which of yesterday's packets contained the word "token"; (3) recording only traffic to and
       from your printer at 192.168.1.40 for an hour; (4) showing only HTTP requests for `/admin`.''',
       '''
       1. capture filter:  port 53            (disk space matters, and you only need DNS)
       2. display filter:  frame contains "token"   (the packets are already saved)
       3. capture filter:  host 192.168.1.40
       4. display filter:  http.request.uri contains "/admin"   (capture filters cannot see HTTP fields)
       ''',
       hints=['If the packets already exist, it is a display filter.', 'Capture filters know addresses and ports, not application fields.'],
       why='''Capture filters save space but lose data for ever and cannot see protocol fields; display filters are free to change and see
       everything Wireshark decodes.'''),
    CHECK('wsref-check', 'Check yourself',
          Q('You captured with the capture filter `port 443` and now want to see the DNS lookups that came before. What happens?',
            [('Type `dns` in the display filter bar', False), ('Nothing: the DNS packets were never saved', True), ('Clear the capture filter and reload the file', False), ('Use `udp.port == 53` instead', False)],
            'A capture filter decides what is written to the file. Packets it dropped were never saved, so no display filter can bring them back.'),
          Q('Which filter shows only packets that open new TCP connections?',
            [('`tcp.flags.syn == 1`', False), ('`tcp.flags.syn == 1 && tcp.flags.ack == 0`', True), ('`tcp.flags == 0x012`', False), ('`tcp.flags.ack == 0`', False)],
            'The first SYN has no ACK. `tcp.flags.syn == 1` alone also matches the SYN-ACK replies, which is `tcp.flags == 0x012`.'),
          Q('Why does `ip.addr != 192.168.1.23` also hide ARP packets?',
            [('ARP is always hidden by default', False), ('ARP packets have no ip.addr field, and a test on a missing field is false', True), ('`!=` is invalid for addresses', False), ('ARP uses IPv6', False)],
            'A comparison on a field the packet does not have is false. Use `!(ip.addr == 192.168.1.23)` to keep packets without an IP layer.'),
          Q('Which is a valid display filter?',
            [('`ip.dest == 10.0.0.1`', False), ('`frame.len >> 100`', False), ('`http.response.code == 404`', True), ('`interface == en0`', False)],
            'The others use fields or operators that do not exist: it is `ip.dst`, `>=`, and `frame.interface_name`.'),
          Q('In the details pane, which layer does `tcp.dstport` belong to, counting Ethernet as the first?',
            [('First', False), ('Second', False), ('Third', True), ('Fourth', False)],
            'Ethernet, then IP, then TCP. The application (HTTP, TLS, DNS) is the fourth.')),
]

terms = [
    ('capture filter', 'a BPF expression, as used by tcpdump, that decides which packets are saved while capturing'),
    ('display filter', 'a Wireshark expression over dissected fields that decides which saved packets are shown'),
    ('BPF', 'Berkeley Packet Filter: the kernel mechanism and filter language capture filters compile to'),
    ('dissector', 'the Wireshark code that decodes one protocol and names its fields'),
    ('promiscuous mode', 'a network card setting that passes up every frame it sees, not only frames addressed to it'),
    ('monitor mode', 'a Wi-Fi card setting that receives all 802.11 frames on a channel without joining a network'),
    ('SNI', 'Server Name Indication: the site name a TLS client sends in clear text in its Client Hello'),
    ('tcp.stream', 'the index Wireshark gives each TCP conversation, used to filter or follow one connection'),
]

CHAPTER = chapter('wireshark-ref', 'Wireshark Cheat Sheet',
                  'The window, both filter languages, the filters you will use most by protocol, shortcuts and tshark, with diagrams and corrections to common mistakes',
                  'cheats', 25,
                  ['Name the three panes and the default columns of the Wireshark window',
                   'Choose between a capture filter and a display filter, and write both',
                   'Build display filters from fields, operators, sets and functions',
                   'Find connection openings, resets and problems in a TCP conversation',
                   'Spot and fix filters that do not work'],
                  blocks, terms, level='basics', part='ref', file='90a-wireshark-ref.gm')
