#!/usr/bin/env python3
"""Place the reference figures (ASCII diagrams) inside the chapters they illustrate (data/book.json).

Each figure is a short lead-in paragraph plus a {"t": "code", "lang": "ascii"} block, the same kinds the book already
uses, inserted right after a block located by chapter + text snippet (or at the end of a section). Running it twice
changes nothing, it fails loudly when an anchor is missing, and it verifies that removing the new blocks gives back
exactly the original chapter. Colour markers (⟪g:text⟫) are the ones the page already renders.

usage: python3 tools/add_figures.py            (writes data/book.json)
       python3 tools/add_figures.py --check    (exit 1 if anything would change)
The APIs chapter lives in chapters/ch_2_apis.py and has its figure there.
"""
import copy, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'data/book.json')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from add_labs import locate  # noqa: E402  same anchor rules as the labs

STACK = '''\
  application  HTTPS IMAPS SMTPS LDAPS   HTTP SSH SMTP IMAP   HTTP/3   DNS DHCP NTP SNMP   ICMP ICMPv6
                 │     │     │     │     BGP RDP LDAP VNC       │      RTP RIP mDNS SIP    OSPF GRE ESP
               ┌─┴─────┴─────┴─────┴─┐          │               │             │                │
  security     │         ⟪m:TLS⟫         │          │            ┌──┴───┐         │                │
               └──────────┬──────────┘          │            │ ⟪m:QUIC⟫ │         │                │
                          │                     │            └──┬───┘         │                │
               ┌──────────┴─────────────────────┴──┐         ┌──┴─────────────┴──┐             │
  transport    │               ⟪g:TCP⟫                 │         │        ⟪g:UDP⟫        │             │
               └─────────────────┬─────────────────┘         └─────────┬─────────┘             │
               ┌─────────────────┴─────────────────────────────────────┴───────────────────────┴──┐
  internet     │                                  ⟪y:IPv4 / IPv6⟫                                     │
               └──────────────────────────────────────────────────────────────────────────────────┘
  link                       Ethernet, Wi-Fi (802.11), PPP, a VPN tunnel ...

  QUIC carries its own TLS 1.3. DNS and SIP also use TCP, and DNS over TLS joins the column on the left.
  The column on the right has no ports: IP's protocol field names it (ICMP 1, GRE 47, ESP 50, OSPF 89).'''

FRAME = '''\
  one full-size Ethernet frame carrying a TCP segment, as it leaves the network card (bytes)

  ┌──────────┬─────┬─────────┬─────────┬──────┬───────────┬───────────┬────────────┬─────┐
  │ preamble │ SFD │ ⟪c:dst MAC⟫ │ ⟪c:src MAC⟫ │ ⟪c:type⟫ │ ⟪y:IP header⟫ │ ⟪g:TCP hdr⟫   │    data    │ ⟪c:FCS⟫ │
  │    7     │  1  │    6    │    6    │  2   │    20+    │    20+    │ up to 1460 │  4  │
  └──────────┴─────┴─────────┴─────────┴──────┴───────────┴───────────┴────────────┴─────┘
   ◀──── sync ────▶ ◀──── link header 14 ────▶ ◀────── IP packet, max 1500 ───────▶  CRC
                    ◀─────────────────── the frame: 64 to 1518 bytes ───────────────────▶

  type: 0x0800 IPv4, 0x86dd IPv6, 0x0806 ARP.   FCS: a CRC-32 the receiver recomputes;
  a mismatch drops the frame. Preamble and SFD (start frame delimiter) let the receiver
  lock on; capture tools never show them, and the 1500 bytes in the middle are the MTU.'''

WIFI = '''\
  2.4 GHz   2400 to 2483.5 MHz: numbers are 5 MHz apart, but each signal is about 20 MHz wide

          ╭───────────────────╮    ╭───────────────────╮    ╭───────────────────╮
          │     ⟪g:channel 1⟫     │    │     ⟪g:channel 6⟫     │    │     ⟪g:channel 11⟫    │
  ────────┴───────────────────┴────┴───────────────────┴────┴───────────────────┴─────────────
  ch                1    2    3    4    5    6    7    8    9   10   11   12   13          14
  MHz 2400        2412                     2437                     2462                  2484
  channel 3 spans 2412 to 2432 MHz, on top of both 1 and 6, so it interferes with both.
  12 and 13 are allowed in much of the world but not the US; 14 was Japan only, for 802.11b.

  5 GHz   5150 to 5850 MHz (not to scale)

  ┌──────────┬──────────┐       ┌────────────────────────────┬─────────────┐
  │ U-NII-1  │ U-NII-2A │       │          U-NII-2C          │   U-NII-3   │
  │ 36 to 48 │ 52 to 64 │  gap  │         100 to 144         │ 149 to 165  │
  │          │   ⟪y:DFS⟫    │       │            ⟪y:DFS⟫             │             │
  └──────────┴──────────┘       └────────────────────────────┴─────────────┘
  5150       5250       5350    5470                         5725          5850
  DFS: the access point must listen for radar first, and move away if it hears any.
  Channels are 20 MHz; 40, 80 and 160 MHz widths join neighbours (36+40+44+48 = one 80 MHz).

  6 GHz   5925 to 7125 MHz, Wi-Fi 6E and Wi-Fi 7 only (not to scale)

  ┌───────────────────────┬──────────┬───────────────────────┬────────────────┐
  │        U-NII-5        │ U-NII-6  │        U-NII-7        │    U-NII-8     │
  │       1 to 93         │ 97 - 113 │      117 to 185       │   189 to 233   │
  └───────────────────────┴──────────┴───────────────────────┴────────────────┘
  5925                    6425       6525                    6875             7125
  59 channels of 20 MHz (1, 5, 9 ... 233), room for 14 of 80 MHz, 7 of 160 MHz and
  3 of 320 MHz (Wi-Fi 7). Which parts of 6 GHz are allowed differs by country.'''

IPV6_LAYOUT = '''\
  a global unicast address on an ordinary LAN

    2001:0db8:1234 : 0005 : 1c3a:7d4e:9f21:5a6b
   ├──────────────┤ ├────┤ ├───────────────────┤
       ⟪y:48 bits⟫      ⟪g:16 bits⟫        ⟪c:64 bits⟫
    ⟪y:routing prefix⟫ ⟪g:subnet ID⟫    ⟪c:interface ID⟫
    from your ISP  you pick it   SLAAC: random, or
                                 EUI-64 from the MAC
   ├──────────────────────┤
      /64: the network. Every LAN is a /64, so a /48 gives you 65,536 of them.'''

IPV6_KINDS = '''\
  IPv6 address
  │
  ├── ⟪g:unicast⟫: one interface
  │     ├── global            2000::/3        routable on the internet
  │     ├── unique local      fc00::/7        private, in practice fd00::/8
  │     ├── link-local        fe80::/10       this link only, written with %en0
  │     ├── loopback          ::1/128         this machine
  │     ├── unspecified       ::/128          "no address yet", a source during setup
  │     └── IPv4-mapped       ::ffff:0:0/96   ::ffff:192.0.2.1, an IPv4 peer of an IPv6 socket
  │
  ├── ⟪y:multicast⟫: every member of a group (replaces broadcast)        ff00::/8
  │     ├── permanent         ff0X::          ff02::1 all nodes, ff02::2 all routers
  │     ├── temporary         ff1X::          made up by an application
  │     └── solicited-node    ff02::1:ffXX:XXXX
  │                           ends in the last 24 bits of a unicast address, so NDP can ask
  │                           for one neighbour without waking every host the way ARP does
  │
  └── ⟪c:anycast⟫: the nearest of several interfaces sharing one address
                              no prefix of its own: an ordinary unicast address given to many
                              hosts, such as a public DNS service answering from the closest site

  X is the scope: 1 interface, 2 link, 5 site, 8 organization, e global'''

LS_L = '''\
  $ ls -l backup.sh
  -rwxr-xr--  1  ana  staff  2048  Nov 18 09:14  backup.sh
  │└┬┘└┬┘└┬┘  │   │     │     │    └─────┬────┘  └──┬───┘
  │ │  │  │   │   │     │     │          │          └── name
  │ │  │  │   │   │     │     │          └── last modified
  │ │  │  │   │   │     │     └── size in bytes
  │ │  │  │   │   │     └── group that owns it
  │ │  │  │   │   └── owner
  │ │  │  │   └── hard links (for a folder: entries that point at it)
  │ │  │  └── ⟪r:others⟫: everyone else
  │ │  └── ⟪y:group⟫: members of staff
  │ └── ⟪g:owner⟫: ana
  └── type: - file, d directory, l symbolic link

          ⟪g:owner⟫    ⟪y:group⟫    ⟪r:others⟫
          r w x    r - x    r - -
          4 2 1    4 0 1    4 0 0
          ─────    ─────    ─────
            7        5        4        chmod 754 backup.sh'''

SPECIAL = '''\
  -rws r-x r-x   setuid, x also set        runs as the file's owner           chmod 4755  u+s
  -rwS r-- r--   setuid, no x: capital S   nothing can run it: a mistake
  drwx rws r-x   setgid on a folder        new files get the folder's group   chmod 2775  g+s
  drwx rwx rwt   sticky on a folder        only a file's owner may delete it  chmod 1777  +t
     ▲   ▲   ▲
     └───┴───┴── each special bit borrows the x slot of its class (ls -ld /private/tmp shows the t)'''

BPF = '''\
  a BPF capture filter
  │
  ├── primitive:  [protocol] [direction] [type] value
  │     protocol    ether  ip  ip6  arp  tcp  udp  icmp  icmp6     (left out: any)
  │     direction   src  dst  src or dst  src and dst               (left out: src or dst)
  │     type        host 192.168.1.50   net 10.0.0.0/8   port 443   portrange 6000-6010
  │     examples    tcp dst port 443    src net 192.168.1.0/24    ip6    ether host f0:18:98:3a:6d:21
  │
  ├── combine:    and &&    or ||    not !    ( ... )
  │     example     'host 192.168.1.50 and (port 80 or port 443) and not arp'
  │
  ├── size:       less 128    greater 1000                         (whole packet, bytes)
  │
  ├── kind:       broadcast   multicast   vlan 10   gateway router.lan
  │
  └── bytes:      proto[offset:size] compared with a number
        tcp[tcpflags] & (tcp-syn|tcp-ack) == tcp-syn      only the first packet of each connection
        tcp[tcpflags] & tcp-rst != 0                      resets
        icmp[icmptype] == icmp-echo                       ping requests, not replies
        flag names: tcp-fin tcp-syn tcp-rst tcp-push tcp-ack tcp-urg'''

FLOW = '''\
  ┌────────────┐    ┌────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
  │ 1 gather   │───▶│ 2 choose   │───▶│ 3 isolate    │───▶│ 4 fix, then  │───▶│ 5 write it  │
  │ what fails,│    │ a layer    │    │ run tests in │    │ run the same │    │ down: cause,│
  │ for whom,  │    │ and order  │    │ order; stop  │    │ failing test │    │ fix, how you│
  │ since when │    │ to test    │    │ at the first │    │ again        │    │ proved it   │
  └────────────┘    └────────────┘    │ failure      │    └──────┬───────┘    └─────────────┘
                          ▲           └──────────────┘           │
                          └───────── still failing: go back ─────┘

  Ask first what changed: a new router, a VPN, an update, a cable, a different room.
  The answer often takes you straight to step 3.'''

OBSERVE = '''\
                    ┌────────────────────────────────────────────────────┐
  programs          │ applications and their libraries                   │  ps  top  pgrep  sample
                    ├────────────────────────────────────────────────────┤
  the boundary      │ system calls                                       │  fs_usage  sc_usage
                    ├────────────────┬─────────────────┬─────────────────┤
  the kernel        │ files: VFS,    │ network:        │ CPU scheduler   │
                    │ file systems,  │ sockets, TCP,   │ virtual memory  │
                    │ volumes        │ UDP, IP         │                 │
                    ├────────────────┴─────────────────┴─────────────────┤
                    │ device drivers                                     │
                    └───────┬──────────────────┬───────────────────┬─────┘
                            │                  │                   │
  hardware              SSD, disk         network card          CPU, RAM

  files, disks   lsof  fs_usage  df -h  du -sh  iostat  diskutil list
  network        netstat -an  lsof -i  nettop  tcpdump  ifconfig
  CPU, memory    top -o cpu  vm_stat  memory_pressure  sudo powermetrics
  everything     Activity Monitor, log stream, sysctl

  The same map on Linux: strace instead of fs_usage; ss and ip for the network;
  vmstat, free, mpstat and iotop for the rest; perf and eBPF tools see every layer.'''

CMDMAP = '''\
  ls  cd  pwd    cat  less      grep  sed      chmod 755 f    ps aux         df -h
  cp  mv  rm     head -n 20     awk  cut       chown u:g f    top  htop*     du -sh dir
  mkdir  touch   tail -f        sort  uniq     ls -l@  xattr  pgrep  pkill   sw_vers
  ln -s  open .  wc -l  file    tr  jq  diff   id  sudo  su   kill  lsof     system_profiler
  find  mdfind   xxd  pbcopy    column         umask          launchctl      sysctl  uname -a
  ⟪c:files⟫          ⟪c:viewing⟫        ⟪c:text⟫           ⟪c:permissions⟫    ⟪c:processes⟫      ⟪c:system⟫
  ▲              ▲              ▲              ▲              ▲              ▲
  └──────────────┴──────────────┴──────┬───────┴──────────────┴──────────────┘
                              ┌────────┴────────┐
                              │  ⟪g:zsh on a Mac⟫   │
                              └────────┬────────┘
  ┌──────────────┬──────────────┬──────┴───────┬──────────────┬──────────────┐
  ▼              ▼              ▼              ▼              ▼              ▼
  ⟪c:network⟫        ⟪c:remote⟫         ⟪c:archives⟫       ⟪c:packages⟫       ⟪c:services⟫       ⟪c:help⟫
  ifconfig       ssh user@h     tar -czf a.tgz brew install   brew services  man cmd
  ipconfig       scp f h:path   tar -xzf a.tgz brew upgrade   launchctl list tldr cmd*
  ping  dig      rsync -av      zip -r a.zip   brew list      log stream     which  type
  traceroute     ssh-keygen     unzip a.zip    pip install    pmset -g       whence -va
  curl -I  nc    ssh-copy-id    shasum -a 256  npm install    softwareupdate history

  * htop and tldr come from Homebrew. On Linux the package tool is apt, dnf or zypper,
    services are systemctl, logs are journalctl, and ifconfig gives way to ip a and ss -tulpn.'''

# (chapter, lead-in paragraph, figure, anchor)  anchor as in add_labs.py
FIGURES = [
    ('networks',
     'Protocols stack on top of one another. Read the figure from the top down: each name uses the one under it. HTTPS is '
     'HTTP inside TLS inside TCP; HTTP/3 swaps TCP for QUIC, which brings its own encryption and runs over UDP. A few protocols '
     'skip the transport layer and ride directly inside IP.',
     STACK, ('after', 'TLS (encryption) does not fit neatly', 0)),
    ('networks',
     'Laid end to end, this is what actually crosses the cable: the link layer wraps everything, and the 1500-byte MTU limits '
     'what fits between its header and trailer.',
     FRAME, ('after', 'header sizes in bytes (minimum); FCS', 0)),
    ('networks',
     'Drawn to scale, the 2.4 GHz band shows why only three channels are usable side by side. The higher bands are not drawn '
     'to scale, but show how they are divided into the blocks (U-NII) that regulators license.',
     WIFI, ('after', 'The marketing names map to the standards', -1)),
    ('addressing',
     'The /64 rule means every global address splits the same way:',
     IPV6_LAYOUT, ('after', 'so you do not subnet below /64', 0)),
    ('addressing',
     'The prefixes from the table above, as a family tree. IPv6 has three kinds of address, and the first bits tell you which:',
     IPV6_KINDS, ('end-of', 'ipv6')),
    ('files',
     'Read one line of `ls -l` from left to right, then turn its permission string into the octal digits `chmod` takes:',
     LS_L, ('after', 'gives the usual short form', 0)),
    ('files',
     'Where the special bits show up in the string:',
     SPECIAL, ('after', 'an uppercase `S` or `T` means it is not', 0)),
    ('capture',
     'The whole filter language fits on one screen:',
     BPF, ('after', 'without quotes they never reach tcpdump', 0)),
    ('troubleshoot',
     'The method as a loop. The order of tests is the table above; the loop is what you do around it:',
     FLOW, ('after', 'the first failing test is the problem', 0)),
    ('system',
     'Every tool in this chapter looks at one part of the machine. Placed on a map of the system, they show where to look '
     'first: a slow program is a question for the top rows, a full disk or a saturated link for the bottom ones. Linux names are '
     'listed where they differ, because the same picture holds there.',
     OBSERVE, ('end-of', 'look')),
    ('cheats',
     'The most used commands at a glance, grouped by job. Each group has its own section below or its own chapter.',
     CMDMAP, ('after', 'This chapter is for lookup, not for reading front to back', 0)),
]


def blocks_for(cid, lead, fig, line):
    return [{'t': 'p', 'text': lead, 'line': line}, {'t': 'code', 'lang': 'ascii', 'attrs': {}, 'code': fig, 'line': line}]


def main():
    check = '--check' in sys.argv
    book = json.load(open(PATH, encoding='utf-8'))
    ch = {c['id']: c for c in book['chapters']}
    added = 0
    for cid, lead, fig, anchor in FIGURES:
        blocks = ch[cid]['blocks']
        if any(b['t'] == 'code' and b.get('code') == fig for b in blocks):
            continue
        before = copy.deepcopy(blocks)
        at = locate(blocks, anchor)
        prev = blocks[at - 1]
        new = blocks_for(cid, lead, fig, prev.get('line', 0))
        blocks[at:at] = new
        assert blocks[:at] + blocks[at + len(new):] == before, 'content changed'
        added += 1
        print(f'+ {cid:12} figure after block {at - 1} ({prev["t"]}): {fig.splitlines()[0].strip()[:50]}')
    print(f'{added} figure(s) added' if added else 'nothing to do')
    if check:
        sys.exit(1 if added else 0)
    if added:
        json.dump(book, open(PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
