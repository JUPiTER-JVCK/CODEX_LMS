from lib import *

# Networking part, after "Remote Access with SSH".
# Widgets (src/ws-9-vpn.js): vpnpath, vpnmtu, wgroute, vpnshake, vpncmp.

WG_SHOW = '''
interface: utun4
  public key: 8n3mF0xqQ2s9Wk1pYb6L4cTzJd7VhE5oAuRgNiXwM0I=
  private key: (hidden)
  listening port: 58214

peer: Vv2rT9kQe4yHb0sZxJd1LmN6cUa8PfWoG3iEtXq7RhA=
  endpoint: 203.0.113.7:51820
  allowed ips: 10.8.0.0/24, 192.168.1.0/24
  latest handshake: 1 minute, 12 seconds ago
  transfer: 5.38 MiB received, 31.47 MiB sent
  persistent keepalive: every 25 seconds
'''

blocks = [
    P('''In the SSH chapter you built one encrypted connection from your Mac to one machine. A **VPN** (virtual private network) does the same
    job for the whole network path: it creates a virtual network interface on your Mac, and everything routed into that interface is
    encrypted, wrapped in new packets and sent to another machine, which unwraps it and puts it on its own network. To the programs on your Mac,
    the far network looks as if it were plugged in next door.'''),
    CALLOUT('note', 'A VPN moves trust; it does not remove it',
            'A tunnel protects the stretch between your Mac and the VPN server, and nothing after it. Whoever runs the server can see what your '
            'Wi-Fi owner and your ISP could have seen. That is a good trade when the server is your own, or your employer\'s, and a much weaker one '
            'when it is a stranger\'s. Much of this chapter is about knowing exactly what is, and is not, protected.'),

    H2('What a VPN is for', 'what'),
    P('''People use VPNs for two different jobs, and they have different risks:'''),
    UL('**Reaching a private network from outside.** Your laptop joins the office or home network (a **road-warrior** setup), or two sites join each other '
       '(**site-to-site**). The point is access: printers, file servers, dashboards and databases that must never face the Internet.',
       '**Protecting a path you do not trust, or changing where you appear to be.** On a café network, or with a commercial provider, the tunnel hides '
       'your traffic from the local network and gives websites a different address to see.'),
    P('''Try the picture below. Change the setup and watch two things move: what is on the wire between each pair of boxes, and what each party can
    learn. Switch the site between HTTPS and plain HTTP, and turn on the DNS leak, a very common mistake that quietly undoes the protection.'''),
    WIDGET('vpnpath'),
    TABLE(['Common claim', 'What is actually true'], [
        ['"A VPN makes me anonymous."', 'It moves your visibility from the café and ISP to the VPN operator. Sites still recognise you by logins, cookies and browser fingerprints, whatever address you appear to have.'],
        ['"A VPN encrypts everything."', 'Only the leg between your Mac and the VPN server. After that, traffic is as protected as it was before: this is why HTTPS still matters inside a tunnel.'],
        ['"A VPN hides my IP address."', 'From the sites you visit, yes: they see the VPN\'s address. From the VPN operator and your own ISP, no.'],
        ['"I am safe on public Wi-Fi with a VPN."', 'Safer from the local network: it can no longer see sites, names or unencrypted traffic. A VPN does not protect you from malware, phishing or a site that is itself hostile.'],
        ['"A no-logs policy guarantees privacy."', 'It is a promise you cannot inspect. Independent audits, jurisdiction and a record of what happened when authorities asked are better evidence than any marketing page.'],
    ], 'What a VPN does and does not do'),

    H2('Tunnelling: a packet inside a packet', 'tunnel'),
    P('''Every VPN is built on **encapsulation**, which you met in the networks chapter: each layer wraps the data from the layer above. A tunnel does
    the same thing with a whole IP packet. The packet your Mac wants to send (the **inner** packet, addressed to something on the far network) is
    encrypted and becomes the payload of a new packet (the **outer** packet) addressed to the VPN server, which unwraps it and forwards the inner packet.'''),
    ASCII('''
        What your Mac hands to the tunnel (the inner packet)

          ┌──────────────────────┬───────────────────────────────────┐
          │ IP header            │ TCP header and your data          │
          │ 10.8.0.2 to 10.0.5.20│ (an HTTP request)                 │
          └──────────────────────┴───────────────────────────────────┘
                                    │ WireGuard encrypts it and wraps it
                                    ▼
        What leaves the Mac (the outer packet)

          ┌──────────┬───────┬─────────┬───────────────────────────┬────────┐
          │ outer IP │  UDP  │ WG hdr  │ encrypted inner packet    │  tag   │
          │ 20 bytes │ 8 B   │ 16 B    │ (the whole box above)     │ 16 B   │
          │ Mac to   │ port  │ type,   │                           │        │
          │ server   │ 51820 │ counter │                           │        │
          └──────────┴───────┴─────────┴───────────────────────────┴────────┘
    '''),
    P('''On your Mac, the tunnel is a virtual network interface called **`utun`** followed by a number (`utun4`, say). The routing table decides which
    packets are sent into it. Anything routed to `utun4` is handed to the VPN program (WireGuard, OpenVPN or the built-in IPsec client), which
    encrypts it and sends the outer packet out through the real interface, `en0`. You can see both on a Mac with a tunnel up:'''),
    TERM('''
        $ ifconfig utun4
        utun4: flags=8051<UP,POINTOPOINT,RUNNING,MULTICAST> mtu 1420
        	inet 10.8.0.2 --> 10.8.0.2 netmask 0xffffff00
        $ route -n get 192.168.1.60
           route to: 192.168.1.60
        destination: 192.168.1.0
               mask: 255.255.255.0
          interface: utun4
    '''),
    P('''The `mtu 1420` is a clue to the next idea. Both the inner packet and the extra headers must fit in one frame of the real link, so the
    tunnel interface has to be smaller than the link under it.'''),

    H2('Overhead and the MTU problem', 'mtu'),
    P('''A normal Ethernet or Wi-Fi link carries packets of up to **1500 bytes** (its MTU). A tunnel adds a new IP header, usually a UDP header, a
    protocol header and an authentication tag, so a 1500-byte inner packet would become something like 1560 bytes and not fit. The fix is to give the
    tunnel interface a smaller MTU. Use the calculator to see the numbers for each protocol, and slide the inner packet size past the limit to see what
    the network does with it.'''),
    WIDGET('vpnmtu'),
    P('''When the MTU is wrong, the symptom is distinctive and confusing: small things work (ping, SSH login, the first part of a page) while large things hang
    (a big download, an upload, a TLS handshake with a large certificate chain). Large packets are dropped because they do not fit, and the ICMP message
    that should tell the sender to send smaller packets (**path MTU discovery**) is blocked somewhere. This is a **PMTU black hole**, and it is the first
    thing to suspect when "the VPN is connected but some sites hang".'''),
    P('''Find the limit by pinging with the don\'t-fragment bit set (`-D`) and a payload size (`-s`). On a Mac, `-s` is the payload size, and 28 bytes of IP and
    ICMP headers are added to it. With a tunnel MTU of 1420, the largest payload that passes is 1420 − 28 = 1392:'''),
    TERM('''
        $ ping -D -c 1 -s 1392 10.8.0.1
        PING 10.8.0.1 (10.8.0.1): 1392 data bytes
        1400 bytes from 10.8.0.1: icmp_seq=0 ttl=64 time=21.904 ms
        $ ping -D -c 1 -s 1393 10.8.0.1
        PING 10.8.0.1 (10.8.0.1): 1393 data bytes
        ping: sendto: Message too long
    '''),
    P('''Two standard remedies. Lower the tunnel interface\'s MTU (`MTU = 1380` in a WireGuard config), or leave the MTU alone and **clamp the TCP MSS** so that the
    two ends never send TCP segments large enough to overflow (OpenVPN\'s `mssfix` and most firewalls\' "MSS clamping" do this). Setting the MTU
    is the better fix when UDP and other protocols also cross the tunnel.'''),
    CALLOUT('tip', 'If a VPN is slow to connect to some sites but not others',
            'Try `ping -D -s` with decreasing sizes through the tunnel. If 1392 fails and 1300 works, you have found an MTU problem. Home connections over PPPoE have a '
            'link MTU of 1492, which is why a WireGuard tunnel there should be 1432 or less, and the default of 1420 is already safe.'),

    H2('WireGuard', 'wireguard'),
    P('''**WireGuard** is the newest of the common VPN protocols and the easiest to understand, because it has almost nothing to configure. Each device has a
    **key pair**. Each device lists its **peers**, identified by their public keys, and for every peer says which addresses it may send and receive. There is no
    certificate authority, no negotiation of ciphers (there is exactly one suite), no user database and no connection state to keep for strangers: if a
    packet does not come from a known key, the UDP port simply does not answer.'''),
    TABLE(['Part', 'What WireGuard uses'], [
        ['Transport', 'UDP only, on one port you choose (51820 is the convention)'],
        ['Key exchange', 'Curve25519 elliptic-curve Diffie-Hellman in a Noise "IK" handshake with an optional pre-shared key'],
        ['Data encryption', 'ChaCha20 with Poly1305 authentication, for every packet'],
        ['Hashing and key derivation', 'BLAKE2s and HKDF'],
        ['Identity', 'a 32-byte public key (44 characters of base64) per device'],
        ['Re-keying', 'a new handshake every two minutes while traffic flows, so old keys are discarded (forward secrecy)'],
        ['Where it runs', 'the Linux kernel (5.6 and later), FreeBSD, OpenBSD, Windows, and on macOS and iOS in the official apps and via `wireguard-go`'],
    ], 'WireGuard at a glance'),
    H3('Generate keys', 'wg-keys'),
    P('''Install the tools with Homebrew, then create a private key and derive the public key from it. The **private key never leaves the device**; you send
    only the public key to the other side. Make the files readable by you alone first with `umask 077`:'''),
    SH('''
        brew install wireguard-tools
        umask 077
        wg genkey | tee privatekey | wg pubkey > publickey
        cat publickey
    '''),
    CMD('wg genkey', 'net-vpn', 'brew:wireguard-tools', 'Create a WireGuard private key. `wg pubkey` turns it into the public key and `wg genpsk` makes an optional pre-shared key.',
        'wg genkey | wg pubkey | wg genpsk',
        ['A WireGuard key is 32 random bytes written in base64: 44 characters ending in `=`. The private key is a secret on a par with an SSH private key: '
         'anyone who has it can be that device. The public key is safe to share.',
         '`wg genkey` prints the private key to standard output, so pipe it straight into the next step rather than leaving it in your terminal history or a '
         'world-readable file. `wg pubkey` reads a private key on standard input and prints its public key.',
         '`wg genpsk` creates a **pre-shared key**: an extra 32 random bytes that both ends mix into the handshake. It adds a layer of symmetric protection that does '
         'not depend on elliptic-curve maths, so it also protects recorded traffic against a future quantum computer.'],
        flags=[('genkey', 'print a new private key'), ('pubkey', 'read a private key on stdin, print the public key'), ('genpsk', 'print a new pre-shared key')],
        examples=[('ex', 'A key pair, saved with safe permissions', '''
            umask 077
            wg genkey | tee privatekey | wg pubkey > publickey
            ls -l privatekey publickey''', '''
            -rw-------  1 me  staff  45 Nov 23 10:02 privatekey
            -rw-------  1 me  staff  45 Nov 23 10:02 publickey'''),
                  ('ex', 'Pre-shared key for one pair of peers', 'wg genpsk > psk-mac-pi')],
        gotchas=['Do not paste a private key into chat, a ticket or a Git repository. If it leaks, generate a new pair and replace the public key on every peer that trusts it.',
                 'Without `umask 077` the files are created readable by other users on a shared machine.'],
        see=['wg', 'wg-quick', 'ssh-keygen'], tags=['keys']),
    H3('The two configuration files', 'wg-config'),
    P('''A WireGuard configuration is a small text file with one `[Interface]` section (this device) and one `[Peer]` section for each device it talks to.
    Below is a **road-warrior** setup: a Raspberry Pi at home is the server (it has a fixed address from your router, a forwarded UDP port and a name from
    dynamic DNS), and your Mac is a client that can reach the Pi and the home network through it. The tunnel uses its own private range, `10.8.0.0/24`, which
    must not clash with any network either side already uses.'''),
    FILE('pi: /etc/wireguard/wg0.conf', '''
        [Interface]
        Address = 10.8.0.1/24
        ListenPort = 51820
        PrivateKey = <the Pi's private key>
        # let the Pi forward packets from the tunnel to the home LAN and hide them behind its own address
        PostUp = sysctl -w net.ipv4.ip_forward=1; iptables -t nat -A POSTROUTING -s 10.8.0.0/24 -o eth0 -j MASQUERADE
        PostDown = iptables -t nat -D POSTROUTING -s 10.8.0.0/24 -o eth0 -j MASQUERADE

        [Peer]
        # the Mac
        PublicKey = <the Mac's public key>
        AllowedIPs = 10.8.0.2/32
    '''),
    FILE('mac: wg0.conf', '''
        [Interface]
        PrivateKey = <the Mac's private key>
        Address = 10.8.0.2/24
        DNS = 192.168.1.1

        [Peer]
        # the Pi
        PublicKey = <the Pi's public key>
        Endpoint = home.example.net:51820
        AllowedIPs = 10.8.0.0/24, 192.168.1.0/24
        PersistentKeepalive = 25
    '''),
    ANAT('The Mac\'s [Peer] section', [
        ('PublicKey = ...', 'who this peer is. WireGuard identifies peers by public key, never by address'),
        ('Endpoint = home.example.net:51820', 'where to send the encrypted packets: a name or address and the UDP port. Only the side that starts the conversation needs one'),
        ('AllowedIPs = 10.8.0.0/24, 192.168.1.0/24', 'the addresses reachable through this peer. Outgoing, it is the routing table; incoming, the only source addresses accepted from it'),
        ('PersistentKeepalive = 25', 'send a tiny packet every 25 seconds so a NAT in front of the Mac does not forget the mapping and block the server\'s replies'),
    ]),
    CALLOUT('danger', 'A WireGuard .conf is a script',
            '`wg-quick` runs the commands in `PreUp`, `PostUp`, `PreDown` and `PostDown` **as root**. A configuration file from someone else is a program you are about to run '
            'with full privileges. Read every line of a file before you bring it up, and treat configs that arrive in email or chat the way you treat a downloaded installer.'),
    P('''`AllowedIPs` does two jobs at once, and it is the idea that makes WireGuard small. When your Mac sends a packet, WireGuard looks at the destination and
    picks the peer whose `AllowedIPs` contains it (the longest matching prefix wins). When a packet arrives from a peer and decrypts correctly, WireGuard checks the
    packet\'s **inner source address** against that peer\'s `AllowedIPs` and drops it if it is not there. That is the routing table and the access list in one
    setting. Edit the peers below to see it work, including what happens when two peers claim the same range.'''),
    WIDGET('wgroute'),
    H3('Bring it up and check it', 'wg-up'),
    P('''Copy the Mac\'s file to a name that ends in `.conf`, keep it readable only by you, and give `wg-quick` its path. It needs root because it creates the interface,
    adds the addresses and routes and changes DNS. The interface name comes from the file name, but on macOS the real interface is a `utun` device:'''),
    TERM('''
        $ chmod 600 wg0.conf
        $ sudo wg-quick up ./wg0.conf
        [#] wireguard-go utun
        [+] Interface for wg0 is utun4
        [#] ifconfig utun4 inet 10.8.0.2/24 10.8.0.2 alias
        [#] ifconfig utun4 up
        [#] route -q -n add -inet 10.8.0.0/24 -interface utun4
        [#] route -q -n add -inet 192.168.1.0/24 -interface utun4
        [#] networksetup -setdnsservers Wi-Fi 192.168.1.1
        [+] Backgrounding route monitor
    '''),
    P('''`wg-quick` printed every command it ran: the interface, an address, one route for each prefix in `AllowedIPs` and the DNS change. Now ask WireGuard how it is
    doing. `sudo wg show` is the most useful command in this chapter, so learn to read it line by line:'''),
    TEXT(WG_SHOW),
    UL('**`latest handshake`** is the proof that the two ends can reach each other and hold matching keys. If the line is **missing**, no handshake has ever completed.',
       '**`transfer`** counts encrypted bytes. If "sent" grows and "received" stays at zero, packets leave but nothing comes back.',
       '**`endpoint`** is where the peer was last seen. On a server it changes when a laptop moves to another network: WireGuard **roams** without a new connection.',
       '**`allowed ips`** is what you configured. If it looks wrong, the config you edited is not the one that is running.'),
    CMD('wg', 'net-vpn', 'brew:wireguard-tools', 'Show and change the state of WireGuard interfaces: peers, handshakes and transfer counters.',
        'wg [show [INTERFACE | all | interfaces] [FIELD]] | wg set INTERFACE ... | wg showconf INTERFACE',
        ['`wg` talks to the running tunnel. With no arguments it behaves like `wg show all`: every interface, its own public key and listening port, and a block for each peer. '
         'The **private key is hidden** unless you use `showconf`.',
         'Give a second word to print one field for every peer in a script-friendly form: tab-separated, one peer per line. `wg show wg0 latest-handshakes` prints each '
         'peer\'s public key and the Unix time of its last handshake (0 means never), which is easy to turn into an alert.',
         '`wg set` changes the live tunnel without restarting it: add or remove a peer, change its `allowed-ips` or `endpoint`. These changes are not saved to the file '
         'unless you use `wg-quick save` or edit the file yourself.',
         'On a Mac, WireGuard runs as `wireguard-go` and `wg` needs `sudo` to read it. The interface is named `utunN`, and `wg-quick` remembers which one belongs to '
         '`wg0`, so `sudo wg show wg0` works too.'],
        flags=[('show', 'print the state (the default)'), ('showconf IFACE', 'print the full config of a running interface, private key included'),
               ('set IFACE peer KEY remove', 'remove a peer from the running tunnel'),
               ('set IFACE peer KEY allowed-ips CIDRS', 'replace what the peer may use'),
               ('show IFACE latest-handshakes', 'public key and last handshake time, one peer per line'),
               ('show IFACE transfer', 'public key, bytes received and bytes sent, tab separated'),
               ('show IFACE endpoints', 'public key and the peer\'s current address:port'),
               ('show IFACE allowed-ips', 'public key and its AllowedIPs'),
               ('show interfaces', 'just the interface names')],
        examples=[('ex', 'Is the tunnel alive? Seconds since the last handshake', '''
            sudo wg show wg0 latest-handshakes | awk -v now=$(date +%s) '{ if ($2 == 0) print "never"; else print now - $2 " s ago" }' ''', '72 s ago'),
                  ('ex', 'Throw a peer out of a running tunnel', 'sudo wg set wg0 peer Vv2rT9kQe4yHb0sZxJd1LmN6cUa8PfWoG3iEtXq7RhA= remove')],
        gotchas=['A handshake only happens when there is traffic to send (or a keepalive). An idle tunnel with no `PersistentKeepalive` shows an old handshake and is perfectly healthy.',
                 'The `awk` that ships with macOS has no `systime()`, so the example takes the current time from `date +%s` and passes it in with `-v now=...`.',
                 'Handshakes older than about three minutes while you are sending data mean the peer is not answering.'],
        see=['wg-quick', 'wg genkey', 'ifconfig'], tags=['sudo', 'status']),
    CMD('wg-quick', 'net-vpn', 'brew:wireguard-tools', 'Bring a WireGuard tunnel up or down from a config file: it creates the interface, sets addresses, routes and DNS and runs your hooks.',
        'wg-quick up | down | save | strip  CONFIG_FILE | INTERFACE',
        ['`wg-quick` is a shell script wrapped around `wg`. `up` reads the file, creates the interface, assigns `Address`, adds a route for each `AllowedIPs` prefix, applies `DNS` and `MTU` '
         'and finally runs `PostUp`. `down` undoes it in reverse order.',
         'Give it a path ending in `.conf` to use a file anywhere, or just the interface name to read `/etc/wireguard/NAME.conf` (on Homebrew\'s macOS install, `/opt/homebrew/etc/wireguard/` on Apple '
         'silicon). The file must not be readable by other users.',
         'With `AllowedIPs = 0.0.0.0/0` it makes the tunnel the default route. It first adds a **host route** to the server\'s `Endpoint` through your real gateway, so the encrypted packets '
         'can still get out, then covers the address space with two halves, `0.0.0.0/1` and `128.0.0.0/1`.',
         'Useful settings in `[Interface]`: `DNS`, `MTU`, `Table = off` (do not touch the routing table), `PreUp`, `PostUp`, `PreDown`, `PostDown` and `SaveConfig = true`.'],
        flags=[('up', 'bring the tunnel up'), ('down', 'take it down and remove its routes'),
               ('save INTERFACE', 'write the running tunnel back to its file'), ('strip FILE', 'print the config without the wg-quick-only lines, for `wg setconf`'),
               ('DNS = ADDRESS', 'use this resolver while the tunnel is up (changed for every network service on a Mac)'),
               ('MTU = N', 'set the tunnel interface MTU (default: the link MTU minus 80)'),
               ('Table = off', 'do not add routes; you will route yourself')],
        examples=[('ex', 'Start and stop with a file in the current folder', '''
            sudo wg-quick up ./wg0.conf
            sudo wg-quick down ./wg0.conf'''),
                  ('ex', 'Start a tunnel at boot on a Linux server (systemd)', '''
            sudo systemctl enable --now wg-quick@wg0''')],
        gotchas=['A syntax error leaves the tunnel half built. If `wg-quick up` fails, run `sudo wg-quick down` on the same file before trying again.',
                 'On a Mac the official WireGuard app and `wg-quick` are two separate ways to run a tunnel; do not run both with the same keys at once.',
                 'The `DNS` line replaces your DNS settings, and `down` puts them back. If the Mac loses its network name resolution after a crash, `networksetup -setdnsservers Wi-Fi Empty` resets it.'],
        see=['wg', 'wg genkey', 'route'], tags=['sudo']),

    H2('Setting up a tunnel, step by step', 'handshakes'),
    P('''A tunnel is not usable until both ends have agreed on keys. Pick each protocol below and step through the messages. WireGuard does it in one round trip with nothing
    to negotiate. IKEv2 (the protocol IPsec uses) takes two, negotiates algorithms and has to bring up a control channel and a data channel. OpenVPN runs a whole TLS
    handshake inside its own packets. The differences explain most of their strengths and their weaknesses.'''),
    WIDGET('vpnshake'),
    CALLOUT('info', 'Why WireGuard is quiet',
            'A WireGuard server answers only packets that authenticate with a key it already knows. A port scan of its UDP port finds nothing: no banner, no error, no reply. That makes '
            'it hard to discover from outside, which is one reason an exposed WireGuard server is a smaller target than an exposed SSL VPN appliance.'),

    H2('IPsec and IKEv2', 'ipsec'),
    P('''**IPsec** is the oldest and most widely supported VPN family. It is not one protocol but a suite. **IKE** (Internet Key Exchange; version 2 is current) authenticates the two ends
    and agrees on keys. **ESP** (Encapsulating Security Payload, IP protocol 50) carries the encrypted packets. An older companion, **AH** (protocol 51), only authenticates and is rarely
    used. Because ESP is not TCP or UDP, a NAT cannot track it, so when a NAT is detected, IKE and ESP move into **UDP port 4500** (**NAT traversal**, or NAT-T).'''),
    UL('**Tunnel mode** wraps the whole inner packet, with a new outer IP header. It is what VPNs and site-to-site links use.',
       '**Transport mode** keeps the original IP header and protects only the payload. It is used between two hosts, often together with another tunnel such as L2TP.',
       '**Traffic selectors** (in IKEv2) or the **crypto ACL** (on Cisco IKEv1 configurations) state which source and destination ranges the tunnel carries. If the two ends disagree, the tunnel comes up '
       'and passes nothing.'),
    TABLE(['Idea', 'What it is', 'Cisco IOS', 'strongSwan (Linux)'], [
        ['IKE SA (IKEv1 "phase 1")', 'the authenticated, encrypted control channel', '`show crypto isakmp sa` or `show crypto ikev2 sa`', '`swanctl --list-sas` (the IKE_SA)'],
        ['Child SA (IKEv1 "phase 2")', 'the ESP tunnel for one pair of traffic selectors', '`show crypto ipsec sa`', '`swanctl --list-sas` (CHILD_SA lines)'],
        ['What goes in the tunnel', 'source and destination ranges, as traffic selectors', 'an access list named by `match address`', '`local_ts` and `remote_ts`'],
        ['Who the peer is', 'its address and how it proves itself', '`set peer`, `crypto isakmp key` or a trustpoint', '`remote_addrs`, `auth`'],
        ['Which algorithms', 'the proposals both ends will accept', '`crypto isakmp policy`, the transform set', '`proposals` and `esp_proposals`'],
        ['Reset it', 'clear a stuck tunnel', '`clear crypto sa`', '`swanctl --terminate --ike NAME`'],
    ], 'IPsec vocabulary on two platforms'),
    P('''Routers and firewalls speak IPsec, so it is the common language for linking two sites. Below is a classic site-to-site configuration for a Cisco router, in the older IKEv1 crypto-map style that
    you will meet most often in existing networks. Read it as a checklist of the questions every IPsec tunnel must answer: how do we authenticate, which algorithms, which traffic, and which peer?'''),
    CODE('ios', '''
        ! 1. How the two routers agree on keys (IKE phase 1)
        crypto isakmp policy 10
         encryption aes 256
         hash sha256
         authentication pre-share
         group 14
         lifetime 86400
        crypto isakmp key USE-A-LONG-RANDOM-SECRET address 203.0.113.2
        !
        ! 2. How the data is protected (IPsec phase 2)
        crypto ipsec transform-set TS esp-aes 256 esp-sha256-hmac
         mode tunnel
        !
        ! 3. Which traffic goes in the tunnel: HQ LAN to branch LAN
        access-list 110 permit ip 10.1.0.0 0.0.255.255 10.2.0.0 0.0.255.255
        !
        ! 4. Tie it together and apply it to the outside interface
        crypto map VPNMAP 10 ipsec-isakmp
         set peer 203.0.113.2
         set transform-set TS
         match address 110
        interface GigabitEthernet0/0
         crypto map VPNMAP
    '''),
    P('''The same logic, which the [Cisco IOS Cheat Sheet](#cisco) lists in its VPN prompts, is mirrored on the other router with the two networks reversed. Use `show crypto isakmp sa` to see whether
    phase 1 is up (state `QM_IDLE`), `show crypto ipsec sa` to see packets being encrypted and decrypted, and note that **the tunnel is only built when interesting traffic first matches the ACL**.
    New designs should prefer IKEv2 with a virtual tunnel interface, which is simpler and routes normally.'''),
    P('''macOS and iOS include IKEv2 and L2TP/IPsec clients, set up in System Settings, VPN, or pushed by a management profile. From Terminal, `scutil --nc` lists and controls them:'''),
    CMD('scutil --nc', 'net-vpn', 'mac', 'List, start, stop and inspect the VPN services configured in macOS (IKEv2, L2TP/IPsec and VPN apps that use the system framework).',
        'scutil --nc list | status SERVICE | start SERVICE | stop SERVICE | show SERVICE',
        ['`scutil --nc` is the command line for the same VPN list you see in System Settings. `SERVICE` is the name you gave the VPN or its identifier; quote it if it has spaces.',
         '`status` prints the connection state on the first line (`Connected`, `Disconnected`, `Connecting`) and, for a connected service, the time it has been up and the bytes sent and received.',
         'It controls only VPNs that macOS itself manages. A WireGuard tunnel started with `wg-quick` is not listed; use `wg show` for that. Third-party apps that use the Network Extension '
         'framework do appear.'],
        flags=[('list', 'every VPN service and whether it is connected'), ('status SERVICE', 'connection state and statistics'),
               ('start SERVICE', 'connect it'), ('stop SERVICE', 'disconnect it'), ('show SERVICE', 'the full configuration')],
        examples=[('ex', 'Is my work VPN connected?', 'scutil --nc status "Work VPN" | head -1', 'Connected'),
                  ('ex', 'Connect it from a script', 'scutil --nc start "Work VPN"')],
        gotchas=['The exact layout of `list` changes between macOS versions; match on the quoted name rather than a fixed column.',
                 '`start` returns immediately. Poll with `status` until the first line says `Connected`.'],
        see=['wg', 'networksetup', 'scutil'], tags=['status']),

    H2('OpenVPN and TLS VPNs', 'openvpn'),
    P('''**OpenVPN** builds a VPN out of TLS, the same technology as HTTPS: certificates for the two ends, a TLS handshake for the keys, and a separate encrypted data channel. A server hands every client
    a small config file, usually named `client.ovpn`, and **pushes** the addresses, routes and DNS settings to it after it connects. It is flexible, runs on practically any system, and can use **TCP port 443**,
    which looks like web traffic and passes strict firewalls where UDP is blocked. The cost is a large code base, more tuning and lower speed than WireGuard.'''),
    FILE('client.ovpn', '''
        client
        dev tun
        proto udp
        remote vpn.example.net 1194
        resolv-retry infinite
        nobind
        persist-key
        persist-tun
        remote-cert-tls server
        ca ca.crt
        cert laptop.crt
        key laptop.key
        tls-crypt ta.key
        data-ciphers AES-256-GCM:CHACHA20-POLY1305
        verb 3
    '''),
    TABLE(['Line', 'What it does'], [
        ['`client`', 'this machine connects out to a server and accepts pushed settings'],
        ['`dev tun`', 'a routed tunnel (layer 3). `dev tap` is a bridged one (layer 2), needed only to carry Ethernet or broadcast traffic'],
        ['`proto udp`, `remote ... 1194`', 'use UDP to port 1194. `proto tcp` and port 443 for networks that block UDP'],
        ['`remote-cert-tls server`', 'the other end must present a server certificate. Without it, any other client\'s certificate signed by your CA could impersonate the server'],
        ['`ca`, `cert`, `key`', 'the CA that signed the server, and your own certificate and private key'],
        ['`tls-crypt ta.key`', 'encrypt and authenticate the control channel with a shared key, hiding the handshake from scanners and blocking unauthenticated probes'],
        ['`data-ciphers`', 'the data-channel ciphers you accept; the two ends negotiate one'],
    ], 'Reading a client file'),
    CMD('openvpn', 'net-vpn', 'brew:openvpn', 'Start an OpenVPN client or server from a config file.',
        'sudo openvpn --config FILE [--daemon] [--log FILE] [--verb N]',
        ['`openvpn` reads the whole setup from a config file and keeps running in the foreground, printing its log. It needs root to create the `utun` interface and change routes. When the log '
         'prints **`Initialization Sequence Completed`**, the tunnel is up.',
         'On a Mac, most people use a graphical client (Tunnelblick, OpenVPN Connect) that wraps the same engine. The command line is the clearest way to see what is happening.',
         'Scripts configured in a profile with `up`, `down` or `--script-security 2` run commands on your Mac. As with a WireGuard config, read an `.ovpn` file before you use it.'],
        flags=[('--config FILE', 'the config file to use'), ('--daemon', 'run in the background'), ('--log FILE', 'write the log to a file'),
               ('--verb N', 'verbosity from 0 to 11; 3 is normal and 4 or 5 helps when debugging'),
               ('--genkey secret FILE', 'create a static key, for example for `tls-crypt`'),
               ('--show-ciphers', 'list the ciphers this build supports')],
        examples=[('ex', 'Connect and watch it come up', 'sudo openvpn --config client.ovpn', '''
            2026-11-23 10:15:01 OpenVPN 2.6.12 aarch64-apple-darwin
            2026-11-23 10:15:01 TCP/UDP: Preserving recently used remote address: [AF_INET]203.0.113.7:1194
            2026-11-23 10:15:02 TLS: Initial packet from [AF_INET]203.0.113.7:1194
            2026-11-23 10:15:03 PUSH: Received control message: 'PUSH_REPLY,route 10.0.0.0 255.0.0.0,ifconfig 10.9.0.6 255.255.255.0'
            2026-11-23 10:15:03 Initialization Sequence Completed'''),
                  ('ex', 'Make a control-channel key', 'openvpn --genkey secret ta.key')],
        gotchas=['`TLS Error: TLS key negotiation failed to occur within 60 seconds` almost always means the packets are not reaching the server: wrong address or port, a firewall, or a `tls-crypt` key that does not match.'],
        see=['wg-quick', 'scutil --nc', 'ssh'], tags=['sudo']),

    H2('Choosing a VPN', 'choose'),
    P('''There is no best VPN, only the one that fits what you must reach, what the devices can run and what the network lets through. Answer three questions and the table ranks the common options. Then read
    the "watch out for" column for the top choice before you commit to it.'''),
    WIDGET('vpncmp'),
    CALLOUT('warn', 'Avoid PPTP and be careful with L2TP',
            'PPTP\'s authentication (MS-CHAPv2) is broken: capturing a handshake is enough to recover the key by brute force in a day or less. It has been removed from macOS and iOS. Plain L2TP carries no encryption and is paired with IPsec, '
            'which makes it slow and often set up with a weak shared key. If a vendor offers only these, ask for IKEv2 or move to something else.'),

    H2('Leaks, kill switches and how to check', 'leaks'),
    P('''A VPN fails in quiet ways. The tunnel is "up", the icon is green and some traffic is still leaving the old way. Each kind of leak has a different cause and a different test. Learn to check, because the
    status light will not tell you.'''),
    TABLE(['Leak', 'What happens', 'How to test on a Mac', 'Fix'], [
        ['**DNS**', 'name lookups go to your local or ISP resolver instead of through the tunnel, so the café owner still sees every site you look up', '`sudo tcpdump -ni en0 port 53` while you open a page; any packet that appears on `en0` left the tunnel. `scutil --dns` lists the resolvers in use', 'set `DNS =` in the config and use a resolver that is reachable through the tunnel; on a full tunnel, every query must go in'],
        ['**IPv6**', 'the tunnel carries only IPv4, but the network has IPv6, so apps use IPv6 and bypass it entirely', '`curl -6 -s https://ifconfig.me` shows your real address if IPv6 leaks. `curl -4 -s https://ifconfig.me` shows the VPN\'s', 'carry IPv6 as well (`AllowedIPs = 0.0.0.0/0, ::/0`), or turn it off: `networksetup -setv6off Wi-Fi`'],
        ['**Split tunnel**', 'traffic you thought was protected is not on the list of routed prefixes', '`route -n get ADDRESS` shows which interface a destination will use: `utun4` or `en0`', 'add the prefix to `AllowedIPs`, or use a full tunnel'],
        ['**Tunnel down, traffic continues**', 'when the VPN drops, the Mac quietly falls back to the plain route', 'take the tunnel down on purpose and see whether sensitive traffic still flows', 'a **kill switch**: firewall rules that allow only the VPN server and the tunnel interface, so traffic stops instead of leaking'],
        ['**Browser (WebRTC)**', 'a web page can ask the browser for network addresses and read the local or the real one', 'a "WebRTC leak test" page in the browser', 'disable WebRTC leak features in the browser, or use one that restricts them'],
    ], 'Five ways a VPN leaks'),
    P('''Two commands answer the most important questions. A full tunnel built by `wg-quick` does not replace the default route: it covers the address space with two more specific routes (`0.0.0.0/1` and `128.0.0.0/1`), so
    `route -n get default` still shows `en0`. Ask about a real destination instead:'''),
    TERM('''
        $ route -n get 1.1.1.1
           route to: 1.1.1.1
        destination: 0.0.0.0
               mask: 128.0.0.0
          interface: utun4
        $ curl -4 -s https://ifconfig.me ; echo
        203.0.113.7
    '''),
    P('''The first says which interface a packet to `1.1.1.1` will take, the second what address the Internet sees. Both are measurements of what is happening now, not of what the config says. Use the packet capture from the
    [capture chapter](#capture) as the final judge: with the tunnel up and no leak, the physical interface carries only UDP to the VPN server.'''),

    H2('Seeing a VPN on the wire', 'wire'),
    P('''You cannot read the contents of a tunnel, but the outer packets reveal a good deal: which protocol, which port, how often it re-keys, and whether the tunnel is idle or busy. Each protocol has a fingerprint, and
    Wireshark has a dissector for all of them.'''),
    TABLE(['Protocol', 'What you see', 'Capture filter (tcpdump, dumpcap)', 'Wireshark display filter'], [
        ['WireGuard', 'UDP, port 51820 by default. The first byte of the payload is a type: 1 initiation, 2 response, 3 cookie, 4 data', '`udp port 51820`', '`wg`, `wg.type == 1`'],
        ['IPsec IKE', 'UDP 500, and UDP 4500 when a NAT is in the path', '`udp port 500 or udp port 4500`', '`isakmp`'],
        ['IPsec ESP', 'IP protocol 50 (or inside UDP 4500). An SPI and a counter, then ciphertext', '`esp`', '`esp`, `udpencap`'],
        ['OpenVPN', 'UDP 1194 (or TCP 443). The opcode is in the first byte: 7 and 8 start a session, 4 is control, 9 is data', '`udp port 1194`', '`openvpn`, `openvpn.opcode == 9`'],
        ['GRE and PPTP', 'IP protocol 47, plus TCP 1723 for PPTP', '`ip proto 47`', '`gre`, `pptp`'],
    ], 'VPN protocols in a capture'),
    P('''WireGuard\'s fixed message sizes make it easy to follow even though the content is hidden. UDP payloads are **148 bytes** for a handshake initiation, **92** for the response and **32** for a keepalive, which is a data message with
    no content. Capture on the real interface while the tunnel is up:'''),
    TERM('''
        $ sudo tcpdump -ni en0 -c 6 udp port 51820
        10:21:07.118342 IP 192.168.50.23.58214 > 203.0.113.7.51820: UDP, length 148
        10:21:07.139907 IP 203.0.113.7.51820 > 192.168.50.23.58214: UDP, length 92
        10:21:07.140221 IP 192.168.50.23.58214 > 203.0.113.7.51820: UDP, length 128
        10:21:07.162774 IP 203.0.113.7.51820 > 192.168.50.23.58214: UDP, length 128
        10:21:32.141530 IP 192.168.50.23.58214 > 203.0.113.7.51820: UDP, length 32
        10:21:32.162318 IP 203.0.113.7.51820 > 192.168.50.23.58214: UDP, length 32
    '''),
    P('''Read it as a story: the Mac opens with a 148-byte initiation, the Pi answers with 92, data follows, and **25 seconds later** a pair of 32-byte keepalives, which is the `PersistentKeepalive = 25`
    from the config. In Wireshark, `wg.type == 4 && udp.length == 40` finds the keepalives (the UDP header adds 8 bytes), and `wg.type == 1` shows every handshake, which should be about two minutes apart in a busy tunnel.'''),

    H2('Running a VPN safely', 'safety'),
    P('''A VPN is a door into a network. Everything you learned about exposed services applies, and a few habits matter most:'''),
    UL('**Least privilege.** Give each peer the smallest `AllowedIPs` it needs, and filter traffic from the tunnel subnet with the firewall on the server. A phone that needs one web interface should not be able to reach the printer, the NAS and the router.',
       '**One key per device.** When a laptop is lost you remove one peer. Shared keys mean rotating everything.',
       '**Treat configuration files as secrets and as code.** They contain private keys, and with `PostUp` or `up` scripts they can run commands as root.',
       '**Patch the edge.** VPN gateways sit on the Internet by design, and vulnerabilities in commercial VPN appliances are a favourite way into networks. Keep them patched, put them behind multi-factor sign-in and monitor them.',
       '**Do not expose a service just to use it from outside.** A VPN is usually a better answer than forwarding a port for a NAS, a camera or Home Assistant.',
       '**Mind the trust you add.** A commercial VPN sees your traffic; a mesh service sees your device list; your employer sees everything on a work VPN. Pick the operator deliberately.'),
    CALLOUT('try', 'Try the tools together',
            'On a lab machine you control, bring a tunnel up and take it down while a capture runs. Compare `wg show` counters with the bytes `tcpdump` sees on `en0`, and watch the keepalive appear every 25 seconds. '
            'Then break something on purpose (the wrong port, a mismatched key, an `AllowedIPs` missing the server\'s address) and read what changes in `wg show` each time.'),

    H2('Practice', 'practice'),
    EX('vpn-ex-who-can-see', 'Who can see what?', 'think',
       '''You are in a café with a full-tunnel VPN to your **own** Raspberry Pi at home. Say who can learn each of these: (1) which websites you visit, from the café owner; (2) which websites you visit, from your home ISP;
       (3) the page contents of a plain-HTTP site, from the café owner; (4) the page contents of a plain-HTTP site, from your home ISP; (5) the address the websites see for you.''',
       '''
       1. The café owner sees only encrypted UDP to your home address. No sites, no DNS names.
       2. Your home ISP sees the sites: your Pi makes the requests from your home line, so its DNS and its connections are visible to the ISP.
       3. The café owner sees nothing of the page: it is inside the tunnel.
       4. Your home ISP sees all of it, because the Pi sends the plain-HTTP request from home. HTTPS would still hide the contents.
       5. Your home connection's public address, not the café's.
       ''',
       hints=['Follow one request: where is it encrypted and where is it not?', 'The Pi is a normal client of your home ISP.'],
       why='''Tunnelling has not hidden anything from the Internet; it has moved the exit point. You protect yourself from the café and reveal yourself, exactly as before, to your ISP and to the sites.'''),
    EX('vpn-ex-wg-mtu', 'Work out the tunnel MTU', 'py',
       '''Write `wg_mtu(link_mtu, outer_ipv6=False)`, the largest inner packet a WireGuard tunnel can carry: the link MTU minus the outer IP header (20 bytes for IPv4, 40 for IPv6), the 8-byte UDP header, the 16-byte WireGuard header and the 16-byte
       tag. Write `max_ping(mtu)` (the biggest `ping -D -s` payload, which is the MTU minus 28 bytes of IP and ICMP headers) and `tcp_mss(mtu)` (the MTU minus 40). Then print one line per link MTU in `LINKS` as `LINK -> MTU, ping, mss`, for example `1500 -> 1440, 1412, 1400`.''',
       '''
       LINKS = [1500, 1492, 1400]

       def wg_mtu(link_mtu, outer_ipv6=False):
           outer = 40 if outer_ipv6 else 20
           return link_mtu - outer - 8 - 16 - 16

       def max_ping(mtu):
           return mtu - 28

       def tcp_mss(mtu):
           return mtu - 40

       for link in LINKS:
           m = wg_mtu(link)
           print(f"{link} -> {m}, {max_ping(m)}, {tcp_mss(m)}")
       ''',
       hints=['The overhead is 20 + 8 + 16 + 16 = 60 bytes over IPv4.', 'For IPv6 outer headers use 40 instead of 20.'],
       why='''Over IPv4 the overhead is 60 bytes and over IPv6 it is 80, which is why WireGuard\'s default is 1420: it is the safe value for either. On a PPPoE line with a 1492 link MTU the figures drop to 1432 and 1412.''',
       starter='''
       LINKS = [1500, 1492, 1400]

       def wg_mtu(link_mtu, outer_ipv6=False):
           return 0

       def max_ping(mtu):
           return 0

       def tcp_mss(mtu):
           return 0

       for link in LINKS:
           m = wg_mtu(link)
           print(f"{link} -> {m}, {max_ping(m)}, {tcp_mss(m)}")
       ''',
       check='''
       assert wg_mtu(1500) == 1440, "IPv4 outer: 1500 - 60 = 1440"
       assert wg_mtu(1500, True) == 1420, "IPv6 outer: 1500 - 80 = 1420"
       assert wg_mtu(1492) == 1432
       assert max_ping(1420) == 1392
       assert tcp_mss(1420) == 1380
       assert out.strip().split("\\n") == ["1500 -> 1440, 1412, 1400", "1492 -> 1432, 1404, 1392", "1400 -> 1340, 1312, 1300"], "Print one line per link MTU in the form LINK -> MTU, ping, mss: " + repr(out)
       '''),
    EX('vpn-ex-allowed-ips', 'Cryptokey routing in Python', 'py',
       '''Write `pick_peer(peers, dst)`, which returns the name of the peer WireGuard would encrypt a packet to: the peer whose `AllowedIPs` contains the destination, with the **longest prefix** winning. Return `None` if no peer matches. Then write `accepts(peers, peer, src)`,
       which says whether a packet from `peer` with inner source address `src` is accepted. `peers` is a dictionary from a name to a list of CIDR strings. Use the `ipaddress` module.''',
       '''
       import ipaddress

       PEERS = {
           "home-pi": ["10.8.0.1/32", "192.168.1.0/24"],
           "alice-phone": ["10.8.0.3/32"],
           "exit-vps": ["0.0.0.0/0"],
       }

       def nets(cidrs):
           return [ipaddress.ip_network(c) for c in cidrs]

       def pick_peer(peers, dst):
           ip = ipaddress.ip_address(dst)
           best, best_len = None, -1
           for name, cidrs in peers.items():
               for net in nets(cidrs):
                   if ip in net and net.prefixlen > best_len:
                       best, best_len = name, net.prefixlen
           return best

       def accepts(peers, peer, src):
           ip = ipaddress.ip_address(src)
           return any(ip in net for net in nets(peers[peer]))

       for dst in ["192.168.1.60", "10.8.0.3", "93.184.216.34"]:
           print(dst, "->", pick_peer(PEERS, dst))
       ''',
       hints=['`ipaddress.ip_address(x) in ipaddress.ip_network(c)` tests membership.', 'Compare `network.prefixlen` and keep the largest.', '`0.0.0.0/0` has prefix length 0, so it loses to every more specific range.'],
       why='''Your function is the whole of WireGuard\'s routing logic: one table, longest prefix wins. The same table doubles as the access list, which is why `accepts` is a one-liner. Notice how the `0.0.0.0/0` peer only takes what no other peer claims.''',
       starter='''
       import ipaddress

       PEERS = {
           "home-pi": ["10.8.0.1/32", "192.168.1.0/24"],
           "alice-phone": ["10.8.0.3/32"],
           "exit-vps": ["0.0.0.0/0"],
       }

       def pick_peer(peers, dst):
           return None

       def accepts(peers, peer, src):
           return False

       for dst in ["192.168.1.60", "10.8.0.3", "93.184.216.34"]:
           print(dst, "->", pick_peer(PEERS, dst))
       ''',
       check='''
       assert pick_peer(PEERS, "192.168.1.60") == "home-pi", "192.168.1.60 is in home-pi's /24"
       assert pick_peer(PEERS, "10.8.0.3") == "alice-phone", "the /32 beats 0.0.0.0/0"
       assert pick_peer(PEERS, "93.184.216.34") == "exit-vps", "everything else goes to the default peer"
       assert pick_peer({"a": ["10.0.0.0/8"], "b": ["10.1.0.0/16"]}, "10.1.2.3") == "b", "longest prefix wins"
       assert pick_peer({"a": ["10.0.0.0/8"]}, "8.8.8.8") is None, "no match means None"
       assert accepts(PEERS, "alice-phone", "10.8.0.3") is True
       assert accepts(PEERS, "alice-phone", "192.168.1.60") is False, "alice may not claim a home address"
       assert out.strip().split("\\n") == ["192.168.1.60 -> home-pi", "10.8.0.3 -> alice-phone", "93.184.216.34 -> exit-vps"], repr(out)
       '''),
    EX('vpn-ex-parse-wg-show', 'Find stale peers in wg show', 'py',
       '''`SHOW` holds the output of `sudo wg show`. Write `handshake_age(line)`, which turns text such as `1 minute, 12 seconds ago` or `37 seconds ago` into a number of seconds (the parts can be days, hours, minutes and seconds, singular or plural). Then print the
       first 8 characters of each peer key for which the age is **more than 180 seconds** or the peer has **no** `latest handshake` line, one per line, in file order.''',
       '''
       SHOW = """
       interface: utun4
         public key: 8n3mF0xqQ2s9Wk1pYb6L4cTzJd7VhE5oAuRgNiXwM0I=
         listening port: 58214

       peer: Vv2rT9kQe4yHb0sZxJd1LmN6cUa8PfWoG3iEtXq7RhA=
         endpoint: 203.0.113.7:51820
         allowed ips: 10.8.0.0/24
         latest handshake: 1 minute, 12 seconds ago
         transfer: 5.38 MiB received, 31.47 MiB sent

       peer: kP4wZ0tYb9xQe2sVv7LmN1cUa6HfRoG8iEtXq3JdBhA=
         endpoint: 198.51.100.4:42011
         allowed ips: 10.8.0.3/32
         latest handshake: 2 hours, 4 minutes, 9 seconds ago
         transfer: 1.20 KiB received, 3.10 KiB sent

       peer: Zq8nB3yTe6xWk1sVv5LmP2cUa9HfRoG4iEtXq7JdKhA=
         allowed ips: 10.8.0.4/32
       """

       UNITS = {"day": 86400, "hour": 3600, "minute": 60, "second": 1}

       def handshake_age(line):
           total = 0
           for part in line.replace(" ago", "").split(","):
               n, unit = part.split()
               total += int(n) * UNITS[unit.rstrip("s")]
           return total

       peers = {}
       current = None
       for raw in SHOW.splitlines():
           line = raw.strip()
           if line.startswith("peer:"):
               current = line.split()[1]
               peers[current] = None
           elif line.startswith("latest handshake:") and current:
               peers[current] = handshake_age(line.split(":", 1)[1].strip())

       for key, age in peers.items():
           if age is None or age > 180:
               print(key[:8])
       ''',
       hints=['Split the text on commas, then each part into a number and a unit.', '`unit.rstrip("s")` turns `seconds` into `second`.', 'Track the current peer as you read the lines; a peer with no handshake line keeps `None`.'],
       why='''This is how a health check for a tunnel starts. In practice you would use `wg show IFACE latest-handshakes`, which gives Unix times and is much easier to parse; the point here is that every field of `wg show` is a measurement you can turn into an alert. A peer with **no** handshake line is not the same as one with an old handshake: it has never connected.''',
       starter='''
       SHOW = """
       interface: utun4
         public key: 8n3mF0xqQ2s9Wk1pYb6L4cTzJd7VhE5oAuRgNiXwM0I=
         listening port: 58214

       peer: Vv2rT9kQe4yHb0sZxJd1LmN6cUa8PfWoG3iEtXq7RhA=
         endpoint: 203.0.113.7:51820
         allowed ips: 10.8.0.0/24
         latest handshake: 1 minute, 12 seconds ago
         transfer: 5.38 MiB received, 31.47 MiB sent

       peer: kP4wZ0tYb9xQe2sVv7LmN1cUa6HfRoG8iEtXq3JdBhA=
         endpoint: 198.51.100.4:42011
         allowed ips: 10.8.0.3/32
         latest handshake: 2 hours, 4 minutes, 9 seconds ago
         transfer: 1.20 KiB received, 3.10 KiB sent

       peer: Zq8nB3yTe6xWk1sVv5LmP2cUa9HfRoG4iEtXq7JdKhA=
         allowed ips: 10.8.0.4/32
       """

       def handshake_age(line):
           return 0

       # print the first 8 characters of each stale or never-connected peer key
       ''',
       check='''
       assert handshake_age("1 minute, 12 seconds ago") == 72
       assert handshake_age("37 seconds ago") == 37
       assert handshake_age("2 hours, 4 minutes, 9 seconds ago") == 7449
       assert handshake_age("1 day, 1 hour ago") == 90000
       assert out.strip().split("\\n") == ["kP4wZ0tY", "Zq8nB3yT"], "Print only the stale peer and the one that never connected: " + repr(out)
       '''),
    EX('vpn-ex-diagnose', 'Diagnose the tunnel', 'think',
       '''Each case shows what `sudo wg show` printed on the Mac. Say what is probably wrong and what you would check first.
       (A) No `latest handshake` line at all, and `transfer: 0 B received, 1.5 KiB sent`.
       (B) `latest handshake: 40 seconds ago` and `transfer: 12 KiB received, 9 KiB sent`, but you cannot ping `192.168.1.60` behind the Pi, while `10.8.0.1` answers.
       (C) `latest handshake: 41 minutes ago`, `PersistentKeepalive` not set, and the Mac is on the café network and has not sent anything for an hour.''',
       '''
       A. The Pi never answered, so no handshake ever happened. Check the Endpoint name and port, whether UDP 51820 is forwarded and open, that the Pi's WireGuard is running, and that the public keys on each side are the right ones (the Mac holds the Pi's public key and the Pi lists the Mac's).
       B. The tunnel is fine, because 10.8.0.1 answers. The Pi is not forwarding or not translating: check that net.ipv4.ip_forward is 1, that the MASQUERADE rule exists (or that the home router has a route for 10.8.0.0/24 via the Pi), and that the Pi's firewall allows forwarding from wg0.
       C. Nothing is wrong. There was no traffic, so WireGuard did not need a handshake. The first packet starts a new one. If an idle laptop must remain reachable, set PersistentKeepalive = 25 on the side behind the NAT.
       ''',
       hints=['A handshake line is evidence that keys and reachability are fine.', 'If the Pi answers on its own tunnel address but not a LAN host, the problem is past the tunnel.'],
       why='''Read `wg show` as three questions in order: did the handshake happen (keys and reachability), is traffic coming back (the far side\'s routing, NAT and firewall), and is the config what you think (AllowedIPs, endpoint). Most "VPN problems" are the second one.'''),
    CHECK('vpn-ch-vpns-and-tunnels-checkpoint', 'Check yourself',
          Q('You connect to a full-tunnel VPN run by a stranger and browse a site over plain HTTP. Who can read the page you load?',
            [('Nobody: a VPN encrypts everything', False), ('The VPN operator, and the site itself', True), ('Only the site', False), ('Only your ISP', False)],
            'The tunnel ends at the VPN server. From there the plain-HTTP request travels unprotected, so the operator and anyone beyond it can read it. HTTPS would hide the content from everyone but the site.'),
          Q('A WireGuard tunnel is up, `ping 10.8.0.1` works and big downloads hang. The most likely cause is:',
            [('A wrong private key', False), ('An MTU problem: the inner packets are too large for the link', True), ('The server is not listening', False), ('A DNS leak', False)],
            'A wrong key or a dead server would stop everything, including ping. Small packets passing and large ones hanging is the signature of a path-MTU problem.'),
          Q('What does `AllowedIPs` do in WireGuard?',
            [('It lists the IP addresses allowed to connect to the server\'s port', False), ('It chooses the peer for outgoing packets and limits the source addresses accepted from that peer', True), ('It sets the tunnel\'s own address', False), ('It is only a routing hint', False)],
            'It is both the routing table and the access list. An incoming packet whose inner source address is not in its peer\'s AllowedIPs is dropped.'),
          Q('The Mac shows `latest handshake: 41 minutes ago` and there has been no traffic since. What is the situation?',
            [('The tunnel is broken', False), ('Normal: WireGuard only handshakes when it has something to send', True), ('The keys were rejected', False), ('The server is down', False)],
            'WireGuard is silent when idle. The next packet triggers a new handshake. Use PersistentKeepalive only if the device behind a NAT must stay reachable.'),
          Q('Which is the best evidence of a DNS leak?',
            [('The VPN icon is green', False), ('Packets to port 53 appear on the physical interface while the tunnel is up', True), ('`wg show` lists a handshake', False), ('The tunnel MTU is 1420', False)],
            'A capture on `en0` that shows DNS queries leaving the Mac is the direct measurement. A green icon and a handshake say nothing about where DNS goes.'),
          Q('You must link two offices that use routers from different vendors. Which protocol is the safest default?',
            [('WireGuard', False), ('IPsec with IKEv2', True), ('PPTP', False), ('An SSH tunnel', False)],
            'IPsec is the common language of routers and firewalls from every vendor. WireGuard is an excellent choice when both ends support it, but many vendor devices do not.')),
    PROJECT('vpn-pr-road-warrior', 'Road warrior: a WireGuard tunnel to your lab', 'intermediate', 60,
            ['wg', 'wg-quick', 'tcpdump', 'routing', 'threat modelling'],
            P('''Build a working tunnel from your Mac to a Raspberry Pi or other Linux machine on your own network, verify it with measurements and write down what it protects. Use the lab machine
            from the SSH chapter (`{{remote}}`). You need to forward one UDP port on your router to it, and a way to reach your home address from outside (a public IPv4 address and a dynamic DNS name).'''),
            H3('1. Server'),
            P('''On the Pi, install WireGuard (`sudo apt install wireguard`), generate a key pair with `umask 077`, and write `/etc/wireguard/wg0.conf` with `Address = 10.8.0.1/24`, a `ListenPort`, and
            `PostUp`/`PostDown` lines for IP forwarding and NAT. Start it with `sudo systemctl enable --now wg-quick@wg0`. Forward UDP 51820 on the router to the Pi.'''),
            H3('2. Client'),
            P('''On the Mac, install `wireguard-tools`, generate a key pair, write `wg0.conf` as in this chapter, add the Mac\'s public key to the Pi with a `[Peer]` section, and bring the tunnel up with `sudo wg-quick up ./wg0.conf`.
            Do not use your home network to test: use a phone hotspot, which is a different network.'''),
            H3('3. Prove it works'),
            UL('`sudo wg show` has a recent `latest handshake` and `transfer` is rising in both directions.',
               '`ping 10.8.0.1` and then a host on the home LAN answer.',
               '`route -n get 192.168.1.1` names the `utun` interface.',
               'A `ping -D -s` search finds the largest payload that passes, matching the MTU the calculator gave you.'),
            H3('4. Look for leaks'),
            P('''Run `sudo tcpdump -ni en0` while you open a few web pages. Which of them (DNS, web traffic) leave on `en0`, and which only appear as UDP to the Pi\'s port? Change `AllowedIPs` to `0.0.0.0/0, ::/0`, add a `DNS =`
            line, bring the tunnel up again and repeat. Write down what changed.'''),
            H3('5. Write the threat model'),
            P('''In half a page, answer: who can now see what? What happens if the laptop is stolen? What if the Pi is compromised? Which firewall rule on the Pi limits what a stolen laptop can reach, and how would you revoke it?'''),
            H3('6. Stretch goals'),
            UL('Add your phone as a second peer using a QR code (`qrencode -t ansiutf8 < phone.conf`) and give it only the one address it needs.',
               'Add a `PresharedKey` to each peer, and note the change in `wg show`.',
               'Write a script that checks `wg show wg0 latest-handshakes` every minute and sends an alert if the peer is stale.',
               'Compare with Tailscale on the same two machines: what did you stop having to configure, and what did you start trusting?')),
    H2('Try it in the practice terminal', 'sim'),
    P('''The simulator has a canned `wg` command with the peers from this chapter. Try `wg show`, then the script-friendly forms such as `wg show wg0 transfer` and `wg show wg0 latest-handshakes`, and use `awk` to total the bytes
    or count peers. These are the same commands you would run on a real tunnel.'''),
    WIDGET('sim', cwd='~/lab', chapter='vpn'),
    H2('Glossary and next steps', 'next'),
    P('''Next: [Troubleshooting a Network](#troubleshoot) gives you a method for finding which layer is broken, including MTU and DNS faults, and the [Wireshark chapter](#wireshark) lets you see tunnels from the outside. To go further into scanning
    what your tunnel exposes, see the [Nmap chapter](#nmap) in the Security part.'''),
]

terms = [
    ('VPN', 'virtual private network: a virtual interface whose traffic is encrypted and carried inside packets to another machine'),
    ('tunnel', 'a link created by wrapping one network\'s packets inside the packets of another'),
    ('encapsulation', 'putting a packet inside another packet as its payload'),
    ('full tunnel', 'a VPN that carries all of a device\'s traffic, usually by taking over the default route'),
    ('split tunnel', 'a VPN that carries only listed destinations; everything else leaves the ordinary way'),
    ('road warrior', 'a roaming client, such as a laptop, that connects into a home or office network through a VPN'),
    ('site-to-site', 'a VPN between two gateways that joins two networks without software on the hosts'),
    ('WireGuard', 'a modern VPN protocol with a fixed modern cipher suite, public-key peers and a very small code base'),
    ('peer', 'the device on the other end of a WireGuard tunnel, identified by its public key'),
    ('AllowedIPs', 'WireGuard setting that is both the routing table and the access list for one peer'),
    ('handshake', 'the message exchange that authenticates two ends and produces the session keys'),
    ('PersistentKeepalive', 'a WireGuard setting that sends a small packet at a fixed interval so a NAT keeps the mapping open'),
    ('forward secrecy', 'a property of key exchange that stops a stolen long-term key from decrypting traffic recorded earlier'),
    ('IPsec', 'a suite of protocols (IKE and ESP) that authenticates and encrypts IP traffic; the common language of routers and firewalls'),
    ('IKE', 'Internet Key Exchange: the IPsec protocol that authenticates the peers and agrees on keys'),
    ('ESP', 'Encapsulating Security Payload: IP protocol 50, which carries IPsec\'s encrypted packets'),
    ('security association', 'a one-way agreement between two IPsec peers: the keys and algorithms for a stream of packets (SA)'),
    ('NAT traversal', 'wrapping ESP in UDP port 4500 so IPsec can pass through a NAT (NAT-T)'),
    ('OpenVPN', 'a TLS-based VPN with a control channel for the handshake and a separate encrypted data channel'),
    ('utun', 'the name of the virtual tunnel interfaces on macOS, such as utun4'),
    ('MTU', 'maximum transmission unit: the largest packet a link carries without fragmenting'),
    ('MSS clamping', 'lowering the TCP maximum segment size so that segments fit through a tunnel'),
    ('PMTU black hole', 'a path where large packets vanish because the ICMP message that would tell the sender to shrink them is blocked'),
    ('DNS leak', 'name lookups that bypass the VPN and reach a resolver outside the tunnel'),
    ('kill switch', 'a firewall rule that blocks traffic outside the tunnel so a dropped VPN does not fall back to the open network'),
    ('pre-shared key', 'a secret known to both ends, mixed into a key exchange as an extra layer of protection'),
]

CHAPTER = chapter('vpn', 'VPNs and Tunnels: WireGuard, IPsec and OpenVPN',
                  'What a VPN protects and what it does not, how a tunnel wraps and sizes packets, and how to build, read and check a WireGuard tunnel from your Mac',
                  'ssh', 80,
                  ['Explain what a VPN does and does not protect, and who can see what with and without one',
                   'Describe how a tunnel encapsulates a packet, and calculate overhead, MTU and MSS',
                   'Write a WireGuard configuration, and read `wg show` to tell whether the tunnel works',
                   'Compare WireGuard, IPsec/IKEv2, OpenVPN and TLS VPNs and choose between them',
                   'Find DNS, IPv6 and routing leaks, and recognise VPN traffic in a packet capture'],
                  blocks, terms, level='intermediate', part='net', file='18a-vpn.gm')
