from lib import *


def IOS(code):
    return CODE('ios', code)


blocks = [
    P('''A lookup page for the Cisco IOS command line (IOS and IOS XE on Catalyst switches and ISR routers; Packet Tracer
    accepts nearly all of it). It is organised by job: get around the CLI, save and restore, secure the box, set up interfaces,
    VLANs, routing, ACLs, NAT, DHCP and DNS, then watch and troubleshoot. Every command card has the syntax, the options you will
    actually use and a worked example with the output you should expect.'''),
    CALLOUT('note', 'How to read the syntax',
            '`UPPERCASE` is a value you supply (`ip address ADDRESS MASK`). `[square brackets]` are optional. `{a | b}` means pick one. '
            'Anything typed as `Router(config-if)#` shows the prompt you must be at; type only what follows it. Commands can be '
            'shortened to any unique prefix: `sh ip int br` is `show ip interface brief`, `conf t` is `configure terminal`, '
            '`int g0/1` is `interface GigabitEthernet0/1`.',
            'Put `no` in front of almost any configuration command to remove it (`no shutdown`, `no ip route ...`), and `default` '
            'in front to return it to the factory value (`default interface g0/1` wipes a whole port).'),

    H2('At a glance: a worked lab', 'glance'),
    P('''One small network, the commands that build it, and how to check them: a DHCP server and two PCs on VLAN 10 behind a Catalyst
    switch, a router as the gateway, and a DNS server. Every command on this poster has its own card further down.'''),
    WIDGET('iosinfo'),

    H2('CLI modes and prompts', 'modes'),
    P('''IOS is modal. The prompt tells you which mode you are in, and each mode accepts a different set of commands. If a command
    is rejected with `% Invalid input detected at '^' marker`, the first thing to check is the prompt.'''),
    WIDGET('iosmodes'),
    TABLE(['Prompt', 'Mode', 'Enter with', 'Leave with'], [
        ['`Router>`', 'User EXEC', 'log in', '`logout`, `exit`'],
        ['`Router#`', 'Privileged EXEC', '`enable`', '`disable`, `exit`'],
        ['`Router(config)#`', 'Global configuration', '`configure terminal`', '`exit`, `end`, [[Ctrl]]+[[Z]]'],
        ['`Router(config-if)#`', 'Interface', '`interface g0/1`', '`exit` (up one), `end` (to `#`)'],
        ['`Router(config-if-range)#`', 'Several interfaces', '`interface range g0/1 - 24`', '`exit`, `end`'],
        ['`Router(config-subif)#`', 'Sub-interface', '`interface g0/0.10`', '`exit`, `end`'],
        ['`Router(config-line)#`', 'Console, vty or aux line', '`line console 0`, `line vty 0 15`', '`exit`, `end`'],
        ['`Router(config-router)#`', 'Routing process', '`router ospf 1`, `router eigrp 10`, `router rip`, `router bgp 65001`', '`exit`, `end`'],
        ['`Router(config-router-af)#`', 'BGP / named EIGRP address family', '`address-family ipv4`', '`exit-address-family`'],
        ['`Switch(config-vlan)#`', 'VLAN', '`vlan 10`', '`exit` (saves the VLAN), `end`'],
        ['`Router(dhcp-config)#`', 'DHCP pool', '`ip dhcp pool NAME`', '`exit`, `end`'],
        ['`Router(config-std-nacl)#` / `(config-ext-nacl)#`', 'Named ACL', '`ip access-list standard|extended NAME`', '`exit`, `end`'],
        ['`Router(config-keychain)#`', 'Key chain', '`key chain NAME`', '`exit`'],
        ['`Router(config-isakmp)#`, `(config-crypto-map)#`', 'VPN', '`crypto isakmp policy 10`, `crypto map M 10 ipsec-isakmp`', '`exit`'],
        ['`rommon 1 >`', 'ROM monitor (boot loader)', 'Break during boot', '`reset` or `boot`'],
        ['`Switch:`', 'Switch boot loader', 'hold Mode button at power-on', '`boot`'],
    ], 'Every mode you will meet'),

    H2('Help, shortcuts and editing keys', 'help'),
    TABLE(['Type', 'What you get'], [
        ['`?`', 'every command available in this mode'],
        ['`sh?`', 'every command that starts with `sh` (no space)'],
        ['`show ?`', 'the next words `show` accepts (with a space)'],
        ['`show ip ?`', 'keep drilling: each `?` lists the next level. `<cr>` in the list means you can press Return now'],
        ['[[Tab]]', 'complete the current word (only if it is unique)'],
        ['`show history`', 'the last commands in this session (default 10)'],
        ['`terminal history size 100`', 'remember more lines this session (`history size` under a line makes it permanent)'],
        ['`terminal length 0`', 'no `--More--` paging (for copying long output)'],
        ['`terminal monitor`', 'show log and debug messages on an SSH/Telnet session (the console sees them anyway)'],
        ['`do COMMAND`', 'run an EXEC command from any config mode: `do show ip int brief`'],
        ['`show running-config | ?`', 'the output filters (next section)'],
    ], 'Context-sensitive help'),
    TABLE(['Key', 'Action'], [
        ['[[Ctrl]]+[[A]]', 'start of line'], ['[[Ctrl]]+[[E]]', 'end of line'],
        ['[[Ctrl]]+[[B]] / [[←]]', 'back one character'], ['[[Ctrl]]+[[F]] / [[→]]', 'forward one character'],
        ['[[Esc]] [[B]] / [[Esc]] [[F]]', 'back / forward one word'],
        ['[[Ctrl]]+[[D]]', 'delete the character under the cursor'], ['[[Backspace]]', 'delete the character before the cursor'],
        ['[[Ctrl]]+[[K]]', 'delete to end of line'], ['[[Ctrl]]+[[U]] / [[Ctrl]]+[[X]]', 'delete to start of line'],
        ['[[Ctrl]]+[[W]]', 'delete the word before the cursor'],
        ['[[Ctrl]]+[[R]] / [[Ctrl]]+[[L]]', 'redraw the line (after a log message cut into it)'],
        ['[[Ctrl]]+[[P]] / [[↑]]', 'previous command in history'], ['[[Ctrl]]+[[N]] / [[↓]]', 'next command in history'],
        ['[[Ctrl]]+[[Z]]', 'leave configuration mode (same as `end`)'],
        ['[[Ctrl]]+[[C]]', 'abort the current command and, in config mode, return to `#`'],
        ['[[Ctrl]]+[[Shift]]+[[6]]', 'break: stop a running ping, traceroute or a DNS lookup of a mistyped word'],
        ['[[Ctrl]]+[[Shift]]+[[6]], then [[X]]', 'suspend an outgoing Telnet/SSH session (`resume` to return, `disconnect` to close)'],
        ['[[Space]] / [[Return]] at `--More--`', 'next page / next line; any other key stops the output'],
    ], 'Line editing'),
    CALLOUT('tip', 'Stop the "Translating..." pause',
            'Typing a word IOS does not know makes it treat the word as a host name and try a DNS lookup, which hangs for '
            'several seconds. In a lab, `no ip domain-lookup` in global config turns that off; on a real network, add '
            '`transport preferred none` under `line con 0` and `line vty 0 15` instead so name lookup still works for `ping`.'),

    H2('Filtering show output', 'filters'),
    P('''Any `show` command can be piped through one filter. The pattern after `include`, `exclude`, `begin` and `section` is a
    regular expression and is case-sensitive.'''),
    TABLE(['Filter', 'Keeps', 'Example'], [
        ['`| include PATTERN` (`| i`)', 'lines that match', '`show run | i hostname|ip route`'],
        ['`| exclude PATTERN` (`| e`)', 'lines that do not match', '`show ip int brief | e unassigned`'],
        ['`| begin PATTERN` (`| b`)', 'everything from the first match', '`show run | b line vty`'],
        ['`| section PATTERN` (`| s`)', 'matching lines plus their indented children', '`show run | s router ospf`'],
        ['`| count PATTERN`', 'the number of matching lines', '`show int status | count connected`'],
        ['`| redirect URL`', 'sends output to a file instead of the screen', '`show tech | redirect flash:tech.txt`'],
        ['`| append URL`', 'adds output to a file', '`show log | append flash:log.txt`'],
        ['`| tee URL`', 'screen and file', '`show run | tee tftp://10.0.0.5/r1.cfg`'],
        ['`| format FILE`', 'XML via an ODM spec file', 'rare; used by automation'],
    ], 'Output modifiers'),
    TABLE(['Regex', 'Means', 'Example'], [
        ['`^`', 'start of line', '`| i ^interface` lists every interface header'],
        ['`$`', 'end of line', '`| i 0/1$` only `.../0/1`, not `0/10`'],
        ['`.`', 'any one character', '`| i 10.0.0.` (also matches `10x0x0`)'],
        ['`|`', 'or', '`| i up|down`'],
        ['`_`', 'any delimiter: space, comma, start or end (Cisco only)', '`show ip bgp | i _65001_`'],
        ['`[ ]`, `*`, `+`, `?`', 'class and repeats, as usual', '`| i Gi1/0/[1-4]_`'],
    ], 'Regular expressions IOS understands'),
    IOS('''
        Switch# show running-config | section interface GigabitEthernet0/1
        Switch# show running-config interface GigabitEthernet0/1
        Switch# show running-config | include ^ip route|^router
        Switch# show interfaces | include line protocol|input errors|CRC
        Switch# show logging | begin Nov 18
    '''),

    H2('EXEC, files and saving', 'exec'),
    P('''Configuration lives in two places: the **running-config** in RAM (what the device is doing now; every config command changes
    it immediately) and the **startup-config** in NVRAM (what loads at boot). Nothing survives a reload until you copy one to the
    other. The IOS image itself sits in **flash:**.'''),
    CMD('enable', 'ios-exec', 'ios', 'Move from user EXEC (`>`) to privileged EXEC (`#`); `disable` goes back.',
        'enable [LEVEL]',
        ['Prompts for the enable secret if one is set. Over vty, if no enable password exists at all, IOS refuses with '
         '`% No password set`; the console allows it.',
         'Privilege levels run 0 to 15. `>` is level 1, `#` is level 15; levels in between exist for custom roles.'],
        flags=[('LEVEL', 'go to a privilege level, 0 to 15 (default 15)'), ('disable [LEVEL]', 'drop back to user EXEC or a lower level'),
               ('show privilege', 'print your current level')],
        examples=[('ex', 'Enter and check the level', '''
            Router> enable
            Password:
            Router# show privilege''', 'Current privilege level is 15')],
        see=['enable secret', 'configure terminal'], tags=['mode'])
    ,
    CMD('configure terminal', 'ios-exec', 'ios', 'Enter global configuration mode; changes apply immediately to the running config.',
        'configure terminal | configure replace URL | configure confirm',
        ['`conf t` is the everyday form. `end` or [[Ctrl]]+[[Z]] returns to `#` from any depth; `exit` goes up one level.',
         '`configure replace` swaps the whole running config for a file, applying only the differences, which is the clean way to '
         'roll back. Combined with `archive` it gives you timed rollback.'],
        flags=[('terminal', 'type commands at the CLI (the usual case)'),
               ('memory', 'merge the startup-config into the running config'),
               ('replace URL [list] [time MIN]', 'replace the running config with a file; with `time`, roll back unless you `configure confirm`'),
               ('confirm', 'keep a `configure replace ... time` change')],
        examples=[('ex', 'A change with an automatic safety net', '''
            Router# copy running-config flash:before.cfg
            Router# configure replace flash:before.cfg time 5
            ! ... make risky changes from a remote session ...
            Router# configure confirm''')],
        gotchas=['There is no "apply" step: a mistyped `ip address` on the interface you are connected through cuts you off at once. Use `reload in 10` before risky remote changes.'],
        see=['copy', 'reload'], tags=['mode'])
    ,
    CMD('show running-config', 'ios-show', 'ios', 'Print the configuration the device is using now.',
        'show running-config [all | interface IF | brief | | FILTER]',
        ['Only non-default commands are shown unless you add `all`. `show startup-config` prints the saved copy in NVRAM.',
         '`more system:running-config` is the same thing and works in some places `show` does not.'],
        flags=[('interface IF', 'one interface only'), ('all', 'include defaults (long)'), ('brief', 'hide certificate data'),
               ('| section NAME', 'one block with its sub-commands'), ('view full', 'everything, for a user with a restricted view'),
               ('show startup-config', 'the saved configuration'), ('show archive config differences', 'diff running vs startup')],
        examples=[('ex', 'One interface', 'Switch# show running-config interface g0/1', '''
            Building configuration...

            Current configuration : 112 bytes
            !
            interface GigabitEthernet0/1
             description Uplink to R1
             switchport mode trunk
             ip dhcp snooping trust
            end'''),
                  ('ex', 'What changed since the last save?', 'Router# show archive config differences nvram:startup-config system:running-config')],
        see=['copy', 'show ip interface brief'])
    ,
    CMD('copy', 'ios-file', 'ios', 'Copy configurations and files between RAM, NVRAM, flash and network servers.',
        'copy SOURCE DESTINATION',
        ['The source and destination are URLs: `running-config` (`system:running-config`), `startup-config` (`nvram:startup-config`), '
         '`flash:FILE`, `usbflash0:`, `tftp://HOST/FILE`, `ftp://USER:PASS@HOST/FILE`, `scp://USER@HOST/FILE`, `http(s)://...`.',
         'Copying **into running-config merges**: lines are added or changed, nothing missing is removed. Copying into startup-config '
         'replaces it.'],
        flags=[('copy run start', 'save the configuration (same as `write memory`)'),
               ('copy start run', 'merge the saved config back into RAM'),
               ('copy run tftp:', 'back up to a TFTP server (prompts for address and file name)'),
               ('copy tftp: flash:', 'download an IOS image'),
               ('copy flash:a flash:b', 'duplicate a file'),
               ('/verify', 'check the image signature/MD5 after copying'),
               ('write memory', '`wr`: the old, still-working save'), ('write erase / erase startup-config', 'blank the saved config'),
               ('write terminal', 'old form of `show running-config`')],
        examples=[('ex', 'Save, then back up off-box', '''
            Router# copy running-config startup-config
            Destination filename [startup-config]?
            Building configuration...
            [OK]
            Router# copy running-config scp://admin@10.0.0.5/backups/R1.cfg'''),
                  ('ex', 'Factory-reset a lab switch', '''
            Switch# write erase
            Switch# delete flash:vlan.dat
            Switch# reload''')],
        gotchas=['A switch keeps VLANs in `flash:vlan.dat`, not in the config. `write erase` alone leaves your old VLANs behind.'],
        see=['reload', 'dir'], tags=['save'])
    ,
    CMD('dir', 'ios-file', 'ios', 'List files in flash or another file system; with friends to manage files.',
        'dir [FILESYSTEM:][PATH]',
        ['`show flash:` gives the same listing plus free space. `show file systems` lists every file system and its free space.'],
        flags=[('dir flash:', 'list flash'), ('dir /recursive', 'include sub-directories'), ('show file systems', 'all file systems'),
               ('delete flash:FILE', 'delete a file (`/force` skips the prompt)'), ('rename SRC DST', 'rename'),
               ('mkdir / rmdir', 'make / remove a directory'), ('more flash:FILE', 'print a text file'),
               ('verify /md5 flash:FILE', 'compute an image MD5'), ('squeeze flash:', 'reclaim deleted space on old Class B flash'),
               ('format flash:', 'wipe the file system')],
        examples=[('ex', 'What is on flash and how much space is left', 'Router# dir flash:', '''
            Directory of flash:/

                1  -rw-   33591768   Nov 2 2026 10:03:12 +00:00  c2900-universalk9-mz.SPA.157-3.M8.bin
                2  -rw-       2903   Nov 18 2026 09:12:40 +00:00  before.cfg

            255744000 bytes total (222148320 bytes free)''')],
        see=['copy', 'boot system'])
    ,
    CMD('reload', 'ios-exec', 'ios', 'Restart the device, now or on a timer.',
        'reload [in MIN | at HH:MM [DAY MONTH]] [REASON] | reload cancel',
        ['If the running config is unsaved IOS asks `System configuration has been modified. Save? [yes/no]`.',
         '`reload in 10` before a risky remote change is the classic safety net: if you lock yourself out the box comes back on the '
         'saved config in ten minutes. If all went well, `reload cancel`.'],
        flags=[('in MIN', 'reload after a delay'), ('at HH:MM', 'reload at a time'), ('cancel', 'cancel a scheduled reload'),
               ('show reload', 'is one scheduled?')],
        examples=[('ex', 'Safety net for a remote change', '''
            Router# reload in 10 Rollback if I lose access
            Router# configure terminal
            Router(config)# ... change ...
            Router(config)# end
            Router# reload cancel''')],
        see=['copy', 'configure terminal'])
    ,
    CMD('show version', 'ios-show', 'ios', 'IOS version, model, serial, uptime, memory, interfaces, licence and the configuration register.',
        'show version',
        ['The first command to run on an unfamiliar box. The last line, the **configuration register**, is `0x2102` on a normal boot; '
         '`0x2142` means the startup config is being ignored (password recovery was done and not undone).'],
        examples=[('ex', 'Pick out the key facts', 'Router# show version | include IOS|uptime|image|register|bytes of memory', '''
            Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.7(3)M8, RELEASE SOFTWARE (fc2)
            R1 uptime is 3 weeks, 2 days, 4 hours, 11 minutes
            System image file is "flash:c2900-universalk9-mz.SPA.157-3.M8.bin"
            Cisco CISCO2911/K9 (revision 1.0) with 491520K/32768K bytes of memory.
            Configuration register is 0x2102''')],
        see=['show inventory', 'boot system'])
    ,
    CMD('ping (IOS)', 'ios-exec', 'ios', 'Send ICMP echo requests; IOS prints one symbol per packet.',
        'ping [vrf NAME] [ip | ipv6] HOST [repeat N] [size BYTES] [source IF|IP] [df-bit] [timeout S]',
        ['Type `ping` alone in privileged mode for **extended ping**, which asks for every option interactively: count, size, '
         'source address, DF bit, sweep of sizes.',
         'The first packet often fails (`.!!!!`) because the router is still resolving ARP for the next hop. That is normal.'],
        flags=[('!', 'reply received'), ('.', 'timed out'), ('U', 'destination unreachable came back'),
               ('Q', 'source quench'), ('M', 'could not fragment (DF set, MTU too small)'), ('?', 'unknown packet type'),
               ('&', 'packet lifetime exceeded'),
               ('repeat N', 'number of packets (default 5)'), ('size N', 'datagram size, 36 to 18024'),
               ('source IF', 'send from this interface\'s address: tests the return route'),
               ('df-bit', 'set Don\'t Fragment, to find the path MTU')],
        examples=[('ex', 'Test the return path from a LAN address', 'Router# ping 8.8.8.8 source GigabitEthernet0/1 repeat 20', '''
            Type escape sequence to abort.
            Sending 20, 100-byte ICMP Echos to 8.8.8.8, timeout is 2 seconds:
            Packet sent with a source address of 10.0.0.1
            !!!!!!!!!!!!!!!!!!!!
            Success rate is 100 percent (20/20), round-trip min/avg/max = 8/9/12 ms'''),
                  ('ex', 'Find the largest packet that fits', 'Router# ping 10.9.9.9 size 1500 df-bit')],
        gotchas=['Stop a long ping with [[Ctrl]]+[[Shift]]+[[6]], not [[Ctrl]]+[[C]].'],
        see=['traceroute (IOS)', 'show ip route'], tags=['troubleshoot'])
    ,
    CMD('traceroute (IOS)', 'ios-exec', 'ios', 'List the routers on the path to a host, using UDP probes with rising TTL.',
        'traceroute [vrf NAME] [ip | ipv6] HOST [source IF] [numeric] [probe N] [ttl MIN MAX] [port N] [timeout S]',
        ['Each hop is tried three times. `*` is a probe with no answer; a whole line of `* * *` is usually a hop that does not send '
         'ICMP time-exceeded, not necessarily a failure. `!H`, `!N`, `!P` and `!A` mean host, network, protocol or administratively '
         'unreachable (an ACL).',
         'Plain `traceroute` in privileged mode is the extended, interactive form.'],
        flags=[('numeric', 'no DNS lookups (much faster)'), ('source IF', 'send from an interface'), ('probe N', 'probes per hop'),
               ('ttl MIN MAX', 'start and stop hops'), ('timeout S', 'wait per probe')],
        examples=[('ex', 'Fast, numeric trace', 'Router# traceroute 8.8.8.8 numeric', '''
            Type escape sequence to abort.
            Tracing the route to 8.8.8.8
              1 203.0.113.1 4 msec 4 msec 4 msec
              2 198.51.100.17 8 msec 8 msec 9 msec
              3 8.8.8.8 12 msec *  11 msec''')],
        see=['ping (IOS)'], tags=['troubleshoot'])
    ,
    CMD('ssh (client)', 'ios-exec', 'ios', 'Open an SSH (or Telnet) session from the router to another device.',
        'ssh [-v 2] -l USER [-p PORT] HOST | telnet HOST [PORT]',
        ['Handy for hopping between lab devices. [[Ctrl]]+[[Shift]]+[[6]] then [[X]] suspends the session; `show sessions` lists '
         'them, `resume N` returns and `disconnect N` closes one.',
         '`telnet HOST 80` is also a quick TCP port test: `Open` means something is listening.'],
        flags=[('-l USER', 'login name'), ('-p PORT', 'port'), ('-v 2', 'force SSH version 2'), ('-c CIPHER', 'cipher'),
               ('show sessions', 'your outgoing sessions'), ('show users', 'who is logged in to this box'),
               ('clear line vty N', 'kick a stuck vty session')],
        examples=[('ex', 'Jump to a switch, then come back', '''
            R1# ssh -l admin 10.0.0.2
            Password:
            SW1> ! Ctrl+Shift+6, then x
            R1# show sessions
            R1# resume 1''')],
        see=['line', 'crypto key generate rsa'])
    ,
    CMD('debug', 'ios-exec', 'ios', 'Print live diagnostic messages for one feature; stop with undebug all.',
        'debug FEATURE [DETAIL] | undebug all | no debug all',
        ['Debugs run at high priority and can overload a busy router: always narrow them (an ACL for `debug ip packet`, a single '
         'neighbour for routing protocols), and type `undebug all` (`u all`) **before** you start, so it is in history.',
         'Output goes to the console. On SSH run `terminal monitor` first to see it.'],
        flags=[('debug ip packet [ACL] [detail]', 'every process-switched packet (filter with an ACL)'),
               ('debug ip icmp', 'ICMP sent/received'), ('debug ip routing', 'routing table changes'),
               ('debug ip ospf adj', 'OSPF neighbour forming'), ('debug eigrp packets', 'EIGRP packets'),
               ('debug ip dhcp server events', 'DHCP server activity'), ('debug ip nat', 'NAT translations'),
               ('debug spanning-tree events', 'STP topology changes'), ('debug ip ssh', 'SSH negotiation'),
               ('show debugging', 'which debugs are on'), ('undebug all', 'turn every debug off')],
        examples=[('ex', 'Watch DHCP leases being handed out', '''
            Router# terminal monitor
            Router# debug ip dhcp server events
            *Nov 18 09:31:02: DHCPD: assigned IP address 10.0.0.21 to client 0100.5056.a1b2.c3.
            Router# undebug all''')],
        gotchas=['Never `debug all` on production equipment.'],
        see=['logging'], tags=['troubleshoot'])
    ,
    CMD('clock', 'ios-sys', 'ios', 'Show and set the time and time zone (logs and certificates depend on it).',
        'clock set HH:MM:SS DAY MONTH YEAR | clock timezone NAME HOURS [MIN] | clock summer-time NAME recurring',
        ['`clock set` is an EXEC command; `clock timezone` and `clock summer-time` are global config. Use NTP on anything real.'],
        flags=[('show clock [detail]', 'current time and its source; `*` in front means not authoritative'),
               ('clock timezone EST -5', 'offset from UTC'), ('clock summer-time EDT recurring', 'US daylight saving rules'),
               ('clock calendar-valid', 'trust the hardware clock'), ('clock update-calendar', 'copy software clock to hardware')],
        examples=[('ex', 'Set the time in a lab', '''
            Router# clock set 09:30:00 18 Nov 2026
            Router# configure terminal
            Router(config)# clock timezone UTC 0
            Router(config)# end
            Router# show clock''', '09:30:04.221 UTC Wed Nov 18 2026')],
        see=['ntp server', 'service timestamps'])
    ,

    H2('Initial setup and system', 'system'),
    CMD('hostname', 'ios-sys', 'ios', 'Name the device; the name becomes the prompt.',
        'hostname NAME',
        ['A name is required (anything but the default `Router`/`Switch`) before you can generate RSA keys for SSH.'],
        examples=[('ex', 'Name a switch', '''
            Switch(config)# hostname SW1-ACCESS
            SW1-ACCESS(config)#''')],
        see=['ip domain-name', 'banner'])
    ,
    CMD('banner', 'ios-sys', 'ios', 'Text shown at connection or login. The first character is the delimiter that ends it.',
        'banner {motd | login | exec | incoming} DELIM TEXT DELIM',
        ['Order: `motd` (message of the day) appears first on every connection, then `login` before the username prompt, then `exec` '
         'after a successful login.',
         'Do not write "Welcome": legal advice is that a banner should warn that access is restricted and monitored.'],
        flags=[('motd', 'everyone sees it, before login'), ('login', 'before the login prompt'), ('exec', 'after login'),
               ('$(hostname) $(domain) $(line)', 'tokens substituted at display time')],
        examples=[('ex', 'Multi-line warning', '''
            Router(config)# banner motd #
            Enter TEXT message.  End with the character '#'.
            Authorised access only. Activity on $(hostname) is logged.
            #''')],
        gotchas=['If the delimiter character appears in the text, the banner ends there. Pick one you will not use, such as `#` or `^C`.'])
    ,
    CMD('ip domain-name', 'ios-sys', 'ios', 'Set the device\'s domain and DNS servers for its own name lookups.',
        'ip domain-name NAME | ip name-server IP [IP ...] | [no] ip domain-lookup | ip host NAME IP',
        ['These are for the device itself: `ping www.example.com`, `ssh router2`. Clients learn DNS from DHCP (`dns-server` in the pool).',
         'A domain name plus hostname is needed to generate RSA keys. Newer IOS spells them `ip domain name` and `ip domain lookup`; both forms are accepted.'],
        flags=[('ip domain-name lab.local', 'domain suffix'), ('ip name-server 10.0.0.20 1.1.1.1', 'up to six DNS servers'),
               ('no ip domain-lookup', 'never try DNS for unknown words (lab convenience)'),
               ('ip host R2 10.0.12.2', 'static name, like /etc/hosts'), ('ip dns server', 'make the router a caching DNS server'),
               ('show hosts', 'cache and static entries')],
        examples=[('ex', 'Resolve names from the CLI', '''
            Router(config)# ip domain-name lab.local
            Router(config)# ip name-server 10.0.0.20
            Router(config)# ip domain-lookup
            Router(config)# do ping www.example.com''')],
        see=['ip dhcp pool', 'crypto key generate rsa'], tags=['dns'])
    ,
    CMD('ntp server', 'ios-sys', 'ios', 'Synchronise the clock with NTP; optionally serve time to others.',
        'ntp server IP [prefer] [key N] [source IF] | ntp master [STRATUM]',
        ['Accurate time makes log lines from different devices line up, and certificates validate. Synchronisation can take several minutes.'],
        flags=[('prefer', 'favour this server'), ('source IF', 'source address for NTP packets'),
               ('ntp authenticate / ntp authentication-key 1 md5 KEY / ntp trusted-key 1', 'authenticated NTP'),
               ('ntp master 3', 'act as a stratum-3 source (lab use)'), ('ntp update-calendar', 'keep the hardware clock in step'),
               ('show ntp status', 'synchronised? stratum? offset?'), ('show ntp associations', 'servers and reachability (`*` = in use)')],
        examples=[('ex', 'Two servers and a check', '''
            Router(config)# ntp server 10.0.0.30 prefer
            Router(config)# ntp server 162.159.200.1
            Router(config)# end
            Router# show ntp status | include Clock is''', 'Clock is synchronized, stratum 3, reference is 10.0.0.30')],
        see=['clock', 'service timestamps'])
    ,
    CMD('service timestamps', 'ios-sys', 'ios', 'Put an accurate date and time on log and debug messages.',
        'service timestamps {log | debug} datetime [msec] [localtime] [show-timezone] [year]',
        ['The default is uptime (`3w2d:`), which is useless when you are matching events across devices.'],
        flags=[('datetime', 'wall-clock time'), ('msec', 'milliseconds'), ('localtime', 'use the configured time zone'),
               ('show-timezone', 'print the zone'), ('year', 'include the year'), ('uptime', 'time since boot (default)')],
        examples=[('ex', 'Readable timestamps', '''
            Router(config)# service timestamps log datetime msec localtime show-timezone year
            Router(config)# service timestamps debug datetime msec localtime show-timezone year''')],
        see=['logging', 'ntp server'])
    ,
    CMD('logging', 'ios-svc', 'ios', 'Where log messages go and how much to keep.',
        'logging {buffered [SIZE] [LEVEL] | host IP | trap LEVEL | console LEVEL | monitor LEVEL | source-interface IF}',
        ['Severity levels go from 0 (emergencies) to 7 (debugging); setting a level includes everything more severe.',
         '`show logging` prints the buffer, newest at the bottom.'],
        flags=[('0 emergencies', 'system unusable'), ('1 alerts', 'immediate action'), ('2 critical', 'critical condition'),
               ('3 errors', 'error condition'), ('4 warnings', 'warning'), ('5 notifications', 'normal but significant (interface up/down)'),
               ('6 informational', 'informational (ACL log hits)'), ('7 debugging', 'debug output'),
               ('logging buffered 64000 informational', 'keep 64 KB in RAM'), ('logging host 10.0.0.50', 'send to a syslog server (UDP 514)'),
               ('logging trap warnings', 'what goes to the syslog server'), ('no logging console', 'quiet console'),
               ('logging synchronous', '(line mode) reprint your half-typed command after a message'),
               ('clear logging', 'empty the buffer')],
        examples=[('ex', 'Buffer and central syslog', '''
            Router(config)# logging buffered 64000 informational
            Router(config)# logging host 10.0.0.50
            Router(config)# logging trap notifications
            Router(config)# logging source-interface Loopback0
            Router(config)# end
            Router# show logging | include %LINK|%LINEPROTO''')],
        notes=['A message reads `%FACILITY-SEVERITY-MNEMONIC: text`, for example `%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up`.'],
        see=['service timestamps', 'debug'])
    ,
    CMD('cdp / lldp', 'ios-svc', 'ios', 'Discover directly connected neighbours: Cisco Discovery Protocol and the standard LLDP.',
        'show cdp neighbors [detail] | [no] cdp run | lldp run | show lldp neighbors [detail]',
        ['CDP is on by default on Cisco gear; LLDP (IEEE 802.1AB) talks to other vendors and phones. Both reveal model, IOS version and '
         'addresses to anyone on the port, so turn them off on ports facing users or the internet.'],
        flags=[('show cdp neighbors', 'device, local port, holdtime, capability, platform, remote port'),
               ('show cdp neighbors detail', 'adds IP addresses and IOS version'), ('show cdp entry NAME', 'one neighbour'),
               ('no cdp run', 'off globally'), ('no cdp enable', '(interface) off on one port'),
               ('lldp run', 'LLDP on globally'), ('no lldp transmit / no lldp receive', '(interface) per direction')],
        examples=[('ex', 'Map what is plugged in where', 'Switch# show cdp neighbors', '''
            Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge
                              S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone
            Device ID   Local Intrfce   Holdtme   Capability   Platform    Port ID
            R1          Gig 0/24        151       R B S I      CISCO2911   Gig 0/1
            SW2         Gig 0/23        170       S I          WS-C2960X   Gig 0/23''')],
        see=['show interfaces', 'show mac address-table'], tags=['discovery'])
    ,
    CMD('boot system', 'ios-sys', 'ios', 'Choose which IOS image loads at boot; with config-register, control how the device starts.',
        'boot system flash:IMAGE | config-register 0xVALUE',
        ['Without `boot system` the device boots the first image it finds in flash. List several `boot system` lines for fallbacks.'],
        flags=[('boot system flash:FILE', 'boot this image'), ('boot system tftp FILE IP', 'network boot'),
               ('config-register 0x2102', 'normal: read the startup config, Break disabled after boot'),
               ('config-register 0x2142', 'ignore the startup config (password recovery)'),
               ('config-register 0x2100', 'boot into ROMMON'), ('show boot', '(switch) boot variables')],
        examples=[('ex', 'Upgrade: point at the new image and reload', '''
            Router(config)# no boot system
            Router(config)# boot system flash:c2900-universalk9-mz.SPA.157-3.M9.bin
            Router(config)# boot system flash:c2900-universalk9-mz.SPA.157-3.M8.bin
            Router(config)# end
            Router# copy running-config startup-config
            Router# reload''')],
        see=['dir', 'show version'])
    ,

    H2('Passwords, users and SSH', 'security'),
    CMD('enable secret', 'ios-sec', 'ios', 'Set the password for privileged EXEC, stored as a hash.',
        'enable [algorithm-type {scrypt | sha256 | md5}] secret [0 | 5 | 8 | 9] PASSWORD',
        ['`enable secret` beats the old `enable password` (which is plaintext or weak type 7). If both exist, the secret wins.',
         'The number in the config shows the hash: **9** = scrypt (best), **8** = PBKDF2-SHA256, **5** = MD5, **7** = reversible '
         'Vigenère (not a hash at all), **0** = plaintext.'],
        flags=[('algorithm-type scrypt', 'store as type 9'), ('secret 9 HASH', 'paste an existing hash'),
               ('enable password X', 'legacy, avoid'), ('security passwords min-length 10', 'enforce a minimum length')],
        examples=[('ex', 'Strong enable secret', '''
            Router(config)# enable algorithm-type scrypt secret Corr3ct-Horse!
            Router(config)# do show run | include enable''', 'enable secret 9 $9$hP0x2vV3b3QqOE$Zb7aXkCq6q7...')],
        see=['service password-encryption', 'username'], tags=['password'])
    ,
    CMD('service password-encryption', 'ios-sec', 'ios', 'Obscure plaintext passwords in the config with type 7.',
        '[no] service password-encryption',
        ['Hides line and `username ... password` passwords from shoulder-surfing in `show run`. Type 7 is trivially reversible, so it '
         'is not real protection: use `secret` everywhere you can.'],
        examples=[('ex', 'Before and after', '''
            Router(config)# line vty 0 4
            Router(config-line)# password cisco
            Router(config-line)# exit
            Router(config)# service password-encryption
            Router(config)# do show run | section line vty''', '''
            line vty 0 4
             password 7 0822455D0A16''')],
        see=['enable secret', 'username'], tags=['password'])
    ,
    CMD('username', 'ios-sec', 'ios', 'Create a local user account (for login local, SSH and AAA).',
        'username NAME [privilege 0-15] [algorithm-type scrypt] secret PASSWORD',
        ['`privilege 15` lands the user straight at `#` after login. Without it they arrive at `>` and need `enable`.'],
        flags=[('privilege N', 'level after login'), ('secret', 'hashed password (use this)'), ('password', 'plaintext or type 7 (avoid)'),
               ('algorithm-type scrypt', 'type 9 hash'), ('autocommand CMD', 'run one command then log out'),
               ('no username NAME', 'delete the user'), ('show users', 'who is logged in now')],
        examples=[('ex', 'An admin and a read-mostly user', '''
            Router(config)# username admin privilege 15 algorithm-type scrypt secret L0ng-Admin-Pass
            Router(config)# username noc privilege 1 algorithm-type scrypt secret N0c-View-Only''')],
        see=['line', 'aaa new-model'], tags=['password'])
    ,
    CMD('line', 'ios-sec', 'ios', 'Configure how people log in on the console, vty (remote) and aux lines.',
        'line {console 0 | vty FIRST LAST | aux 0}',
        ['Most switches have vty 0 to 15 (16 simultaneous sessions); configure them all the same way or an attacker finds the weak one.',
         'Line commands: `password` + `login` (shared password), or `login local` (usernames), or AAA.'],
        flags=[('password PASS', 'line password'), ('login', 'ask for the line password'), ('login local', 'ask for a local username and password'),
               ('no login', 'no password at all (never on vty)'), ('transport input ssh', 'SSH only (`telnet`, `all`, `none`)'),
               ('transport output ssh', 'outgoing protocols from this line'), ('exec-timeout MIN [SEC]', 'idle logout (0 0 = never)'),
               ('logging synchronous', 'redraw your line after log messages'), ('access-class ACL in', 'restrict who may connect'),
               ('privilege level 15', 'land at # directly'), ('history size N', 'command history per session'),
               ('show line', 'line status'), ('clear line N', 'disconnect a line')],
        examples=[('ex', 'Console and remote access', '''
            Router(config)# line console 0
            Router(config-line)# login local
            Router(config-line)# exec-timeout 10 0
            Router(config-line)# logging synchronous
            Router(config-line)# line vty 0 15
            Router(config-line)# login local
            Router(config-line)# transport input ssh
            Router(config-line)# access-class MGMT in
            Router(config-line)# exec-timeout 10 0''')],
        see=['crypto key generate rsa', 'username', 'access-list'])
    ,
    CMD('crypto key generate rsa', 'ios-sec', 'ios', 'Generate the host keys that turn on the SSH server.',
        'crypto key generate rsa [general-keys] modulus BITS [label NAME]',
        ['Requires a hostname (not the default) and `ip domain-name`. The key is named `HOSTNAME.DOMAIN`. Generating keys enables SSH; '
         '`ip ssh version 2` refuses the old, broken v1.',
         'Then make the vty lines use it: `login local` and `transport input ssh`.'],
        flags=[('modulus 2048', 'key size (768 minimum for SSHv2; 2048 or more)'), ('ip ssh version 2', 'SSHv2 only'),
               ('ip ssh time-out 60', 'negotiation timeout'), ('ip ssh authentication-retries 3', 'tries per connection'),
               ('ip ssh source-interface Lo0', 'source address'), ('crypto key zeroize rsa', 'delete the keys (turns SSH off)'),
               ('show ip ssh', 'version and settings'), ('show ssh', 'active SSH sessions')],
        examples=[('ex', 'SSH from scratch', '''
            Router(config)# hostname R1
            R1(config)# ip domain-name lab.local
            R1(config)# username admin privilege 15 algorithm-type scrypt secret L0ng-Admin-Pass
            R1(config)# crypto key generate rsa modulus 2048
            R1(config)# ip ssh version 2
            R1(config)# line vty 0 15
            R1(config-line)# login local
            R1(config-line)# transport input ssh
            R1(config-line)# end
            R1# show ip ssh''', 'SSH Enabled - version 2.0')],
        see=['line', 'username'], tags=['ssh'])
    ,
    CMD('login block-for', 'ios-sec', 'ios', 'Slow down password guessing: block logins after repeated failures.',
        'login block-for SEC attempts N within SEC',
        ['After N failures within the window, all logins are refused for the block time (quiet mode). `login quiet-mode access-class ACL` '
         'lets your management hosts in during a block.'],
        flags=[('login delay SEC', 'pause between attempts'), ('login on-failure log', 'log failures'), ('login on-success log', 'log successes'),
               ('show login', 'settings and state'), ('show login failures', 'recent failures')],
        examples=[('ex', 'Block for 2 minutes after 5 failures in 60 seconds', '''
            Router(config)# login block-for 120 attempts 5 within 60
            Router(config)# login on-failure log
            Router(config)# login quiet-mode access-class MGMT''')],
        see=['line'])
    ,
    CMD('aaa new-model', 'ios-sec', 'ios', 'Switch to AAA: central authentication, authorisation and accounting with RADIUS or TACACS+.',
        'aaa new-model | aaa authentication login {default | LIST} METHOD...',
        ['After `aaa new-model`, line passwords stop working: logins use the `default` method list. Always include `local` as a '
         'fallback so you are not locked out when the server is down, and keep a console session open while you set it up.'],
        flags=[('aaa authentication login default group tacacs+ local', 'TACACS+ then local users'),
               ('aaa authorization exec default group tacacs+ local', 'who gets a shell and at what level'),
               ('aaa accounting commands 15 default start-stop group tacacs+', 'log every level-15 command'),
               ('tacacs server NAME / address ipv4 IP / key KEY', 'define a TACACS+ server'),
               ('radius server NAME / address ipv4 IP auth-port 1812 / key KEY', 'define a RADIUS server'),
               ('test aaa group tacacs+ USER PASS new-code', 'try a login against the server')],
        examples=[('ex', 'TACACS+ with local fallback', '''
            Router(config)# aaa new-model
            Router(config)# tacacs server ISE1
            Router(config-server-tacacs)# address ipv4 10.0.0.40
            Router(config-server-tacacs)# key T4cacs-Key
            Router(config-server-tacacs)# exit
            Router(config)# aaa authentication login default group tacacs+ local
            Router(config)# aaa authorization exec default group tacacs+ local''')],
        see=['username', 'line'], tags=['aaa'])
    ,

    H2('Interfaces', 'interfaces'),
    TABLE(['Name', 'Short', 'Example', 'Notes'], [
        ['FastEthernet', '`fa`, `f`', '`int fa0/1`', '100 Mb/s'],
        ['GigabitEthernet', '`gi`, `g`', '`int g0/1`, `int g1/0/24`', '1 Gb/s; stacked switches use SWITCH/MODULE/PORT'],
        ['TenGigabitEthernet', '`te`', '`int te1/1/1`', 'uplinks'],
        ['Serial', '`se`, `s`', '`int s0/0/0`', 'WAN; `clock rate` on the DCE end'],
        ['Loopback', '`lo`', '`int lo0`', 'virtual, always up; router IDs and management'],
        ['Vlan', '`vlan`', '`int vlan 10`', 'SVI: an IP address for a VLAN on a switch'],
        ['Port-channel', '`po`', '`int po1`', 'EtherChannel bundle'],
        ['Tunnel', '`tu`', '`int tu0`', 'GRE / IPsec VTI'],
        ['Sub-interface', '', '`int g0/0.10`', 'one per VLAN on a router trunk'],
        ['Null0', '', '`ip route 10.0.0.0 255.0.0.0 null0`', 'black hole'],
    ], 'Interface names'),
    CMD('interface', 'ios-if', 'ios', 'Enter configuration for one interface (or create a logical one).',
        'interface TYPE NUMBER | interface range TYPE A - B [, TYPE C - D] | interface range macro NAME',
        ['Logical interfaces (`loopback`, `vlan`, `tunnel`, `port-channel`, sub-interfaces) are created the first time you enter them; '
         '`no interface NAME` deletes them.',
         '`interface range` applies everything you type to every port in the range; ranges need spaces around the dash.'],
        flags=[('interface range g0/1 - 12 , g0/24', 'ranges and lists'), ('define interface-range USERS g0/1 - 20', 'name a range'),
               ('default interface g0/5', 'reset one port to factory'), ('no interface lo1', 'remove a logical interface')],
        examples=[('ex', 'Shut every unused port and park it in a dead VLAN', '''
            Switch(config)# interface range g0/13 - 22
            Switch(config-if-range)# switchport mode access
            Switch(config-if-range)# switchport access vlan 999
            Switch(config-if-range)# shutdown''')],
        see=['ip address', 'shutdown'])
    ,
    CMD('ip address', 'ios-if', 'ios', 'Assign an IPv4 address and mask to a routed interface or SVI.',
        'ip address ADDRESS MASK [secondary] | ip address dhcp | ip unnumbered IF',
        ['Masks are written in dotted decimal (`255.255.255.0`), not prefix length. IOS rejects an address that overlaps another '
         'interface\'s subnet.',
         'On a layer-2 switch only SVIs (`interface vlan N`) take addresses, plus `ip default-gateway` for reaching other subnets.'],
        flags=[('secondary', 'add another address (several subnets on one wire)'), ('dhcp', 'learn the address from DHCP (WAN links)'),
               ('negotiated', 'PPP-assigned'), ('unnumbered Lo0', 'borrow another interface\'s address (point-to-point)'),
               ('no ip address', 'remove it'), ('no switchport', '(L3 switch) make a port routed so it can take an address')],
        examples=[('ex', 'Router LAN interface', '''
            Router(config)# interface g0/1
            Router(config-if)# description LAN VLAN 10
            Router(config-if)# ip address 10.0.0.1 255.255.255.0
            Router(config-if)# no shutdown'''),
                  ('ex', 'Switch management address', '''
            Switch(config)# interface vlan 10
            Switch(config-if)# ip address 10.0.0.2 255.255.255.0
            Switch(config-if)# no shutdown
            Switch(config-if)# exit
            Switch(config)# ip default-gateway 10.0.0.1''')],
        see=['ipv6 address', 'show ip interface brief'])
    ,
    CMD('shutdown', 'ios-if', 'ios', 'Administratively disable an interface; no shutdown enables it.',
        '[no] shutdown',
        ['Router interfaces start shut down; switch ports start enabled. A shut interface shows `administratively down` in `show ip interface brief`.',
         'Bounce a port (to make a phone or PC re-DHCP) with `shutdown` then `no shutdown`.'],
        examples=[('ex', 'Bring a router port up', '''
            Router(config)# interface g0/0
            Router(config-if)# no shutdown''', '''
            %LINK-3-UPDOWN: Interface GigabitEthernet0/0, changed state to up
            %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/0, changed state to up''')],
        see=['show ip interface brief', 'errdisable recovery'])
    ,
    CMD('interface settings', 'ios-if', 'ios', 'Description, speed, duplex, MTU, bandwidth and other per-port settings.',
        'description TEXT | speed {10 | 100 | 1000 | auto} | duplex {full | half | auto} | mtu BYTES | bandwidth KBPS',
        ['Leave speed and duplex on `auto` at both ends, or hard-code both ends the same. One fixed end and one auto end gives a duplex '
         'mismatch: the link works, slowly, with late collisions and CRC errors.',
         '`bandwidth` changes nothing on the wire; it is the number OSPF and EIGRP use to compute cost.'],
        flags=[('description TEXT', 'label (shows in `show interfaces description`)'), ('speed / duplex', 'port speed and duplex'),
               ('mtu 9000', 'jumbo frames (on many switches: `system mtu jumbo 9000` globally)'), ('bandwidth 100000', 'for routing metrics, in kb/s'),
               ('delay N', 'EIGRP delay, tens of microseconds'), ('load-interval 30', 'shorter averaging for rates in `show interfaces`'),
               ('clock rate 64000', 'serial DCE end only'), ('mdix auto', 'auto crossover'),
               ('ip mtu / ip tcp adjust-mss 1360', 'L3 MTU and TCP MSS clamping (tunnels, PPPoE)'),
               ('cdp enable / lldp transmit', 'per-port discovery')],
        examples=[('ex', 'A well-labelled uplink', '''
            Router(config)# interface g0/0
            Router(config-if)# description WAN to ISP circuit 12345
            Router(config-if)# speed 1000
            Router(config-if)# duplex full
            Router(config-if)# load-interval 30''')],
        see=['show interfaces'])
    ,
    CMD('show ip interface brief', 'ios-show', 'ios', 'Every interface on one line: address, admin status and line protocol.',
        'show ip interface brief [IF] [| FILTER]',
        ['**Status** is layer 1 (cable, other end, `shutdown`), **Protocol** is layer 2 (keepalives, encapsulation). Read them together; '
         'see the troubleshooting table below.'],
        flags=[('| exclude unassigned', 'only interfaces with addresses'), ('show ipv6 interface brief', 'IPv6 version'),
               ('show interfaces description', 'status plus your descriptions'), ('show ip interface IF', 'full L3 detail: ACLs, helper, NAT')],
        examples=[('ex', 'Router at a glance', 'Router# show ip interface brief', '''
            Interface              IP-Address      OK? Method Status                Protocol
            GigabitEthernet0/0     203.0.113.2     YES manual up                    up
            GigabitEthernet0/1     10.0.0.1        YES manual up                    up
            GigabitEthernet0/2     unassigned      YES unset  administratively down down
            Loopback0              1.1.1.1         YES manual up                    up''')],
        see=['show interfaces', 'shutdown'], tags=['verify'])
    ,
    CMD('show interfaces', 'ios-show', 'ios', 'Full counters and status for interfaces: errors, rates, duplex, drops.',
        'show interfaces [IF] [status | trunk | switchport | counters [errors] | description | summary]',
        ['Watch **input errors / CRC** (bad cable, duplex mismatch), **output drops** (congestion), **late collisions** (duplex '
         'mismatch), **resets** and the 5-minute rates. `clear counters IF` zeroes them so you can see if errors are still growing.'],
        flags=[('status', '(switch) one line per port: connected / notconnect / err-disabled, VLAN, duplex, speed'),
               ('switchport', 'access/trunk mode, VLANs, voice VLAN'), ('trunk', 'trunking ports and allowed VLANs'),
               ('counters errors', 'error counters per port'), ('description', 'status with descriptions'),
               ('summary', 'queues and rates for all'), ('clear counters [IF]', 'zero counters')],
        examples=[('ex', 'Errors on one port', 'Switch# show interfaces g0/5 | include line protocol|duplex|input errors|output errors|collisions', '''
            GigabitEthernet0/5 is up, line protocol is up (connected)
              Full-duplex, 1000Mb/s, media type is 10/100/1000BaseTX
                 0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored
                 0 output errors, 0 collisions, 1 interface resets'''),
                  ('ex', 'Switch ports at a glance', 'Switch# show interfaces status', '''
            Port      Name               Status       Vlan       Duplex  Speed Type
            Gi0/1     DHCP server        connected    10         a-full a-1000 10/100/1000BaseTX
            Gi0/2     PC-1               connected    10         a-full a-1000 10/100/1000BaseTX
            Gi0/4                        err-disabled 10           auto   auto 10/100/1000BaseTX
            Gi0/24    Uplink R1          connected    trunk      a-full a-1000 10/100/1000BaseTX''')],
        see=['show ip interface brief', 'errdisable recovery'], tags=['verify'])
    ,

    H2('VLANs and switching', 'switching'),
    CMD('vlan', 'ios-sw', 'ios-sw', 'Create a VLAN and give it a name.',
        'vlan ID[,ID-ID] | name NAME',
        ['VLAN 1 exists and cannot be deleted; normal VLANs are 2 to 1001, extended 1006 to 4094 (VTP transparent or v3). The VLAN is '
         'created when you leave `config-vlan` mode.',
         'Assigning a port to a VLAN that does not exist creates it on most IOS versions, but a named VLAN is easier to audit.'],
        flags=[('vlan 10,20,30-35', 'several at once'), ('name USERS', 'name it'), ('no vlan 10', 'delete it (ports in it go inactive)'),
               ('show vlan brief', 'VLANs and their access ports'), ('show vlan id 10', 'one VLAN')],
        examples=[('ex', 'Create and list', '''
            Switch(config)# vlan 10
            Switch(config-vlan)# name USERS
            Switch(config-vlan)# vlan 20
            Switch(config-vlan)# name VOICE
            Switch(config-vlan)# end
            Switch# show vlan brief''', '''
            VLAN Name                             Status    Ports
            ---- -------------------------------- --------- -------------------------------
            1    default                          active    Gi0/13, Gi0/14
            10   USERS                            active    Gi0/1, Gi0/2, Gi0/3
            20   VOICE                            active
            999  PARKING                          active    Gi0/15, Gi0/16''')],
        see=['switchport mode access', 'switchport trunk', 'vtp'], tags=['vlan'])
    ,
    CMD('switchport mode access', 'ios-sw', 'ios-sw', 'Make a port an access port in one data VLAN (plus an optional voice VLAN).',
        'switchport mode access | switchport access vlan ID | switchport voice vlan ID',
        ['Set the mode explicitly. The default on many switches is `dynamic auto`, which can be talked into trunking by a device that '
         'sends DTP: a VLAN-hopping risk. `switchport nonegotiate` turns DTP off.'],
        flags=[('switchport mode access', 'access port'), ('switchport access vlan 10', 'its data VLAN'),
               ('switchport voice vlan 20', 'tagged VLAN for an IP phone'), ('switchport nonegotiate', 'no DTP'),
               ('switchport mode dynamic {auto | desirable}', 'DTP modes (avoid)'), ('show interfaces g0/2 switchport', 'confirm')],
        examples=[('ex', 'A desk port with a phone', '''
            Switch(config)# interface g0/2
            Switch(config-if)# description Desk 2.14
            Switch(config-if)# switchport mode access
            Switch(config-if)# switchport access vlan 10
            Switch(config-if)# switchport voice vlan 20
            Switch(config-if)# spanning-tree portfast
            Switch(config-if)# spanning-tree bpduguard enable''')],
        see=['vlan', 'switchport trunk', 'spanning-tree'], tags=['vlan'])
    ,
    CMD('switchport trunk', 'ios-sw', 'ios-sw', 'Make a port an 802.1Q trunk carrying several VLANs.',
        'switchport mode trunk | switchport trunk allowed vlan {LIST | add LIST | remove LIST | all | none} | switchport trunk native vlan ID',
        ['Older switches that also support ISL need `switchport trunk encapsulation dot1q` **before** `switchport mode trunk`.',
         'Untagged frames on a trunk belong to the **native VLAN** (1 by default). Both ends must agree, or CDP warns of a native VLAN '
         'mismatch and traffic leaks between VLANs. Set it to an unused VLAN.'],
        flags=[('switchport trunk encapsulation dot1q', 'older multilayer switches only'), ('switchport mode trunk', 'always trunk'),
               ('allowed vlan 10,20,30', 'replace the list'), ('allowed vlan add 40', 'add without wiping the list'),
               ('allowed vlan remove 30', 'remove one'), ('native vlan 999', 'untagged VLAN'),
               ('switchport nonegotiate', 'no DTP frames'), ('vlan dot1q tag native', '(global) tag the native VLAN too'),
               ('show interfaces trunk', 'trunks, native VLAN, allowed and active VLANs')],
        examples=[('ex', 'Uplink to the router', '''
            Switch(config)# interface g0/24
            Switch(config-if)# switchport mode trunk
            Switch(config-if)# switchport trunk native vlan 999
            Switch(config-if)# switchport trunk allowed vlan 10,20,999
            Switch(config-if)# switchport nonegotiate
            Switch(config-if)# end
            Switch# show interfaces trunk''', '''
            Port        Mode             Encapsulation  Status        Native vlan
            Gi0/24      on               802.1q         trunking      999

            Port        Vlans allowed on trunk
            Gi0/24      10,20,999''')],
        gotchas=['`switchport trunk allowed vlan 40` without `add` replaces the whole list and cuts every other VLAN off that trunk.'],
        see=['switchport mode access', 'router-on-a-stick'], tags=['vlan'])
    ,
    CMD('vtp', 'ios-sw', 'ios-sw', 'VLAN Trunking Protocol: share the VLAN list between switches (or, usually, turn it off).',
        'vtp mode {server | client | transparent | off} | vtp domain NAME | vtp version {1 | 2 | 3} | vtp password PASS',
        ['A switch with a higher **revision number** joining the domain can overwrite every switch\'s VLAN list. Most networks run '
         '`vtp mode transparent` (or `off`) and create VLANs on each switch.'],
        flags=[('mode transparent', 'keep own VLANs, forward VTP'), ('mode off', '(v3) ignore VTP entirely'),
               ('domain NAME', 'VTP domain'), ('password PASS', 'authenticate updates'), ('show vtp status', 'mode, domain, revision')],
        examples=[('ex', 'The safe setting', '''
            Switch(config)# vtp mode transparent
            Switch(config)# do show vtp status | include Operating Mode|Revision''')],
        see=['vlan'])
    ,
    CMD('spanning-tree', 'ios-sw', 'ios-sw', 'Loop prevention: STP mode, root bridge placement and edge-port protection.',
        'spanning-tree mode {pvst | rapid-pvst | mst} | spanning-tree vlan ID {priority N | root primary} | (interface) spanning-tree {portfast | bpduguard enable | guard root}',
        ['Choose the root on purpose (your core switch) with a low priority; otherwise the oldest switch with the lowest MAC wins.',
         '**PortFast** skips the 30-second listening/learning wait on ports to end devices. **BPDU Guard** err-disables such a port if a '
         'switch appears on it.'],
        flags=[('mode rapid-pvst', 'RSTP per VLAN (recommended)'), ('vlan 10 priority 4096', 'priority in steps of 4096 (lower wins)'),
               ('vlan 10 root primary', 'macro: set priority to win'), ('portfast', '(interface) edge port'),
               ('portfast default', '(global) every access port is an edge port'),
               ('bpduguard enable / portfast bpduguard default', 'err-disable if a BPDU arrives'),
               ('guard root', 'refuse superior BPDUs (keeps root where you put it)'), ('cost N / port-priority N', 'influence the path'),
               ('show spanning-tree [vlan N] [summary]', 'root, roles and states'), ('show spanning-tree root', 'root per VLAN')],
        examples=[('ex', 'Core switch as root, edge ports protected', '''
            CORE(config)# spanning-tree mode rapid-pvst
            CORE(config)# spanning-tree vlan 1-4094 root primary
            ACCESS(config)# spanning-tree mode rapid-pvst
            ACCESS(config)# spanning-tree portfast default
            ACCESS(config)# spanning-tree portfast bpduguard default'''),
                  ('ex', 'Who is root?', 'Switch# show spanning-tree vlan 10 | include Root ID|Priority|This bridge')],
        see=['errdisable recovery', 'switchport mode access'], tags=['stp'])
    ,
    CMD('switchport port-security', 'ios-sw', 'ios-sw', 'Limit which and how many MAC addresses may use an access port.',
        'switchport port-security [maximum N] [mac-address {MAC | sticky}] [violation {shutdown | restrict | protect}]',
        ['Only works on access (or trunk) ports, not dynamic ones. The bare `switchport port-security` line turns it on; the others set the rules.',
         '`sticky` learns the first MACs seen and writes them into the running config (save it to keep them).'],
        flags=[('maximum N', 'allowed MACs (default 1; 2 for a phone plus PC)'), ('mac-address sticky', 'learn and remember'),
               ('mac-address 0050.56a1.b2c3', 'a fixed MAC'), ('violation shutdown', 'err-disable the port (default)'),
               ('violation restrict', 'drop and log, count violations'), ('violation protect', 'drop silently'),
               ('aging time 10', 'forget learned MACs after 10 min'), ('show port-security [interface IF | address]', 'status and counts')],
        examples=[('ex', 'One PC and one phone per port', '''
            Switch(config)# interface range g0/2 - 12
            Switch(config-if-range)# switchport mode access
            Switch(config-if-range)# switchport port-security
            Switch(config-if-range)# switchport port-security maximum 2
            Switch(config-if-range)# switchport port-security mac-address sticky
            Switch(config-if-range)# switchport port-security violation restrict''')],
        see=['errdisable recovery', 'show mac address-table'], tags=['security'])
    ,
    CMD('errdisable recovery', 'ios-sw', 'ios-sw', 'Bring err-disabled ports back automatically, or see why a port was disabled.',
        'errdisable recovery cause {all | psecure-violation | bpduguard | ...} | errdisable recovery interval SEC',
        ['A port in `err-disabled` is shut down by the switch itself (port security, BPDU Guard, UDLD, link flap...). Manual fix: remove '
         'the cause, then `shutdown` and `no shutdown` on the port.'],
        flags=[('show interfaces status err-disabled', 'which ports and why'), ('show errdisable recovery', 'what auto-recovers'),
               ('errdisable recovery cause bpduguard', 'auto-recover this cause'), ('errdisable recovery interval 300', 'wait 5 minutes')],
        examples=[('ex', 'Find and clear', '''
            Switch# show interfaces status err-disabled
            Port      Name        Status       Reason               Err-disabled Vlans
            Gi0/4                 err-disabled psecure-violation
            Switch# configure terminal
            Switch(config)# interface g0/4
            Switch(config-if)# shutdown
            Switch(config-if)# no shutdown''')],
        see=['switchport port-security', 'spanning-tree'], tags=['troubleshoot'])
    ,
    CMD('etherchannel', 'ios-sw', 'ios-sw', 'Bundle several links into one logical Port-channel (LACP, PAgP or static).',
        'channel-group N mode {active | passive | desirable | auto | on} | port-channel load-balance METHOD',
        ['Every member must match: speed, duplex, mode (access/trunk), VLANs. Configure the members, then adjust `interface port-channel N`; '
         'settings there are pushed to the members.'],
        flags=[('mode active', 'LACP, initiates (use on at least one side)'), ('mode passive', 'LACP, responds'),
               ('mode desirable / auto', 'PAgP (Cisco only)'), ('mode on', 'static, no negotiation (risky)'),
               ('port-channel load-balance src-dst-ip', 'hashing method'), ('show etherchannel summary', 'bundles and member flags'),
               ('show lacp neighbor', 'LACP partner')],
        examples=[('ex', 'Two-link LACP trunk', '''
            Switch(config)# interface range g0/23 - 24
            Switch(config-if-range)# channel-group 1 mode active
            Switch(config-if-range)# exit
            Switch(config)# interface port-channel 1
            Switch(config-if)# switchport mode trunk
            Switch(config-if)# end
            Switch# show etherchannel summary | begin Group''', '''
            Group  Port-channel  Protocol    Ports
            ------+-------------+-----------+-----------------------------------------------
            1      Po1(SU)         LACP      Gi0/23(P)   Gi0/24(P)''')],
        notes=['Flags: `S` layer 2, `R` layer 3, `U` in use, `P` bundled, `I` stand-alone, `s` suspended, `D` down.'],
        see=['switchport trunk'])
    ,
    CMD('show mac address-table', 'ios-show', 'ios-sw', 'Which MAC address the switch has learned on which port and VLAN.',
        'show mac address-table [dynamic | static] [address MAC] [interface IF] [vlan ID] [count]',
        ['Find a device: get its MAC from `show ip arp` on the router, then look it up here to find the port. On older IOS the command '
         'is `show mac-address-table`.'],
        flags=[('address 0050.56a1.b2c3', 'one MAC'), ('interface g0/2', 'MACs on a port'), ('vlan 10', 'one VLAN'), ('count', 'totals'),
               ('clear mac address-table dynamic', 'flush learned entries'), ('mac address-table aging-time 300', 'aging (seconds)'),
               ('mac address-table static MAC vlan N interface IF', 'pin a MAC')],
        examples=[('ex', 'Which port is this PC on?', 'Switch# show mac address-table address 0050.56a1.b2c3', '''
                      Mac Address Table
            -------------------------------------------
            Vlan    Mac Address       Type        Ports
            ----    -----------       --------    -----
              10    0050.56a1.b2c3    DYNAMIC     Gi0/2''')],
        see=['show ip arp', 'switchport port-security'], tags=['verify'])
    ,
    CMD('monitor session', 'ios-sw', 'ios-sw', 'SPAN: copy a port\'s or VLAN\'s traffic to another port for Wireshark.',
        'monitor session N source {interface IF | vlan ID} [rx | tx | both] | monitor session N destination interface IF',
        ['Plug the laptop running Wireshark into the destination port. The destination port stops being a normal port while the session exists.'],
        flags=[('source interface g0/1 both', 'both directions'), ('source vlan 10 rx', 'a whole VLAN, ingress'),
               ('destination interface g0/20', 'where the copy goes'), ('filter vlan 10', 'only some VLANs of a trunk source'),
               ('show monitor [session N]', 'what is configured'), ('no monitor session N', 'remove')],
        examples=[('ex', 'Mirror the DHCP server port', '''
            Switch(config)# monitor session 1 source interface g0/1 both
            Switch(config)# monitor session 1 destination interface g0/20''')],
        see=['show mac address-table'])
    ,
    CMD('ip routing (layer 3 switch)', 'ios-sw', 'ios-sw', 'Turn a multilayer switch into a router between its VLANs (SVIs).',
        'ip routing | interface vlan ID | no switchport',
        ['Off by default on many Catalyst models. With it on, each `interface vlan N` with an address is the gateway for that VLAN, and '
         '`ip default-gateway` is ignored: use `ip route 0.0.0.0 0.0.0.0 NEXT-HOP` instead.',
         'An SVI is only up/up if the VLAN exists and at least one port in it (access or trunk) is up.'],
        examples=[('ex', 'Inter-VLAN routing on a 3650', '''
            Switch(config)# ip routing
            Switch(config)# interface vlan 10
            Switch(config-if)# ip address 10.0.10.1 255.255.255.0
            Switch(config-if)# interface vlan 20
            Switch(config-if)# ip address 10.0.20.1 255.255.255.0
            Switch(config-if)# exit
            Switch(config)# ip route 0.0.0.0 0.0.0.0 10.0.0.1''')],
        see=['router-on-a-stick', 'ip route'], tags=['routing'])
    ,

    H2('Routing', 'routing'),
    TABLE(['Code', 'Source', 'Default administrative distance'], [
        ['`C` / `L`', 'connected network / local address (/32)', '0'],
        ['`S`', 'static route', '1'], ['`S*`', 'static default route', '1'],
        ['`D`', 'EIGRP internal', '90'], ['`D EX`', 'EIGRP external', '170'],
        ['`O`, `O IA`', 'OSPF intra-/inter-area', '110'], ['`O E1`, `O E2`', 'OSPF external', '110'],
        ['`R`', 'RIP', '120'], ['`B`', 'BGP (eBGP / iBGP)', '20 / 200'], ['`i`', 'IS-IS', '115'],
    ], 'Route codes, lowest distance wins'),
    CMD('ip route', 'ios-rt', 'ios-rt', 'Add a static route, including the default route.',
        'ip route PREFIX MASK {NEXT-HOP | EXIT-IF [NEXT-HOP]} [DISTANCE] [name TEXT] [permanent] [track N]',
        ['`0.0.0.0 0.0.0.0` is the default route. A route through an exit interface only works on point-to-point links; on Ethernet '
         'give a next-hop address.',
         'A **floating static** has a distance higher than the dynamic route it backs up, so it appears only when that route disappears.'],
        flags=[('NEXT-HOP', 'address of the next router'), ('EXIT-IF', 'outgoing interface'), ('DISTANCE', '1-255; e.g. 250 for a backup'),
               ('name TEXT', 'a comment'), ('permanent', 'keep the route even if the interface goes down'),
               ('track N', 'withdraw it when an IP SLA fails'), ('ipv6 route ::/0 2001:db8::1', 'IPv6 equivalent')],
        examples=[('ex', 'Default route plus a backup', '''
            Router(config)# ip route 0.0.0.0 0.0.0.0 203.0.113.1 name ISP-A
            Router(config)# ip route 0.0.0.0 0.0.0.0 198.51.100.1 250 name ISP-B-backup
            Router(config)# ip route 192.168.50.0 255.255.255.0 10.0.12.2'''),
                  ('ex', 'Check it', 'Router# show ip route static', '''
            Gateway of last resort is 203.0.113.1 to network 0.0.0.0

            S*    0.0.0.0/0 [1/0] via 203.0.113.1
                  192.168.50.0/24 is subnetted, 1 subnets
            S        192.168.50.0 [1/0] via 10.0.12.2''')],
        see=['show ip route', 'router ospf'], tags=['routing'])
    ,
    CMD('show ip route', 'ios-show', 'ios-rt', 'The routing table: what the router will do with each destination.',
        'show ip route [ADDRESS | PREFIX MASK [longer-prefixes] | static | connected | ospf | eigrp | rip | bgp | summary]',
        ['`[110/2]` is [administrative distance/metric]. The most specific (longest) matching prefix wins; distance only breaks ties '
         'between sources offering the same prefix.',
         '`show ip route ADDRESS` answers "where would a packet to this address go?" directly.'],
        flags=[('ADDRESS', 'which route matches this host'), ('ospf / eigrp / static / connected', 'one source only'),
               ('summary', 'counts per source'), ('PREFIX MASK longer-prefixes', 'all subnets inside a block'),
               ('show ip cef ADDRESS', 'the forwarding entry actually used'), ('show ipv6 route', 'IPv6 table'),
               ('clear ip route *', 'flush and rebuild')],
        examples=[('ex', 'Where does 8.8.8.8 go?', 'Router# show ip route 8.8.8.8', '''
            Routing entry for 0.0.0.0 0.0.0.0, supernet
              Known via "static", distance 1, metric 0, candidate default path
              Routing Descriptor Blocks:
              * 203.0.113.1
                  Route metric is 0, traffic share count is 1''')],
        see=['ip route', 'show ip protocols'], tags=['verify', 'routing'])
    ,
    CMD('router-on-a-stick', 'ios-rt', 'ios-rt', 'Route between VLANs with one router port and dot1Q sub-interfaces.',
        'interface IF.SUB | encapsulation dot1Q VLAN [native] | ip address ADDRESS MASK',
        ['The switch port facing the router is a trunk. The physical router interface carries no address, but it must be `no shutdown`.'],
        examples=[('ex', 'VLANs 10 and 20 on one link', '''
            Router(config)# interface g0/1
            Router(config-if)# no shutdown
            Router(config-if)# interface g0/1.10
            Router(config-subif)# encapsulation dot1Q 10
            Router(config-subif)# ip address 10.0.10.1 255.255.255.0
            Router(config-subif)# interface g0/1.20
            Router(config-subif)# encapsulation dot1Q 20
            Router(config-subif)# ip address 10.0.20.1 255.255.255.0
            Router(config-subif)# interface g0/1.999
            Router(config-subif)# encapsulation dot1Q 999 native''')],
        see=['switchport trunk', 'ip routing (layer 3 switch)'], tags=['routing', 'vlan'])
    ,
    CMD('router ospf', 'ios-rt', 'ios-rt', 'OSPF: the link-state IGP. Neighbours, areas and costs.',
        'router ospf PROCESS-ID | network ADDRESS WILDCARD area AREA | (interface) ip ospf PROCESS-ID area AREA',
        ['The process ID is local and need not match between routers; the **area**, subnet, hello/dead timers, authentication and MTU '
         'must match for neighbours to form.',
         '`network` uses a **wildcard mask** (inverse mask): `0.0.0.255` for a /24, `0.0.0.0` for one exact interface address.'],
        flags=[('router-id 1.1.1.1', 'fixed ID (else highest loopback, then highest interface IP)'),
               ('network 10.0.0.0 0.0.0.255 area 0', 'enable OSPF on matching interfaces'),
               ('ip ospf 1 area 0', '(interface) the same, per interface'),
               ('passive-interface default / no passive-interface IF', 'no hellos except where you allow'),
               ('default-information originate [always]', 'advertise the default route'),
               ('auto-cost reference-bandwidth 100000', 'cost for fast links (set the same everywhere)'),
               ('ip ospf cost N', '(interface) cost'), ('ip ospf priority 0', '(interface) never DR'),
               ('ip ospf network point-to-point', '(interface) no DR election on a /30 or /31'),
               ('area 1 stub / area 1 nssa', 'area types'), ('area 1 range PREFIX MASK', 'summarise at the ABR'),
               ('clear ip ospf process', 'restart OSPF (needed for a new router-id)')],
        examples=[('ex', 'Single-area OSPF', '''
            Router(config)# router ospf 1
            Router(config-router)# router-id 1.1.1.1
            Router(config-router)# auto-cost reference-bandwidth 100000
            Router(config-router)# passive-interface default
            Router(config-router)# no passive-interface g0/0
            Router(config-router)# network 10.0.0.0 0.0.0.255 area 0
            Router(config-router)# network 10.0.12.0 0.0.0.3 area 0
            Router(config-router)# default-information originate'''),
                  ('ex', 'Neighbours', 'Router# show ip ospf neighbor', '''
            Neighbor ID     Pri   State           Dead Time   Address         Interface
            2.2.2.2           1   FULL/DR         00:00:35    10.0.12.2       GigabitEthernet0/0''')],
        notes=['Other checks: `show ip ospf interface brief` (areas, cost, state), `show ip ospf database`, `show ip route ospf`, `show ip protocols`.'],
        see=['show ip route', 'router eigrp'], tags=['routing'])
    ,
    CMD('router eigrp', 'ios-rt', 'ios-rt', 'EIGRP: Cisco\'s advanced distance-vector IGP.',
        'router eigrp AS | network ADDRESS [WILDCARD] | router eigrp NAME (named mode)',
        ['The **AS number must match** on neighbours (unlike the OSPF process ID). Metric uses bandwidth and delay by default.',
         'Auto-summary is off by default in IOS 15+, but type `no auto-summary` anyway on older images.'],
        flags=[('network 10.0.0.0 0.0.0.255', 'enable on matching interfaces'), ('eigrp router-id 1.1.1.1', 'fixed ID'),
               ('no auto-summary', 'no classful summarisation'), ('passive-interface IF', 'no hellos'),
               ('variance N', 'unequal-cost load balancing'), ('ip summary-address eigrp AS PREFIX MASK', '(interface) summarise'),
               ('show ip eigrp neighbors', 'neighbours'), ('show ip eigrp topology', 'successors and feasible successors')],
        examples=[('ex', 'Classic mode', '''
            Router(config)# router eigrp 100
            Router(config-router)# eigrp router-id 1.1.1.1
            Router(config-router)# network 10.0.0.0 0.0.0.255
            Router(config-router)# network 10.0.12.0 0.0.0.3
            Router(config-router)# passive-interface g0/1
            Router(config-router)# no auto-summary''')],
        see=['router ospf', 'show ip route'], tags=['routing'])
    ,
    CMD('router rip', 'ios-rt', 'ios-rt', 'RIP version 2: the simple, hop-count IGP (15 hops max). Labs and tiny networks.',
        'router rip | version 2 | network CLASSFUL-NETWORK | no auto-summary',
        ['`network` takes a classful network only (`10.0.0.0`, `172.16.0.0`), no mask. Updates every 30 s.'],
        flags=[('version 2', 'RIPv2: masks and multicast updates'), ('no auto-summary', 'send subnets, not classful summaries'),
               ('passive-interface IF', 'do not send updates there'), ('default-information originate', 'advertise a default route'),
               ('show ip rip database', 'RIP routes'), ('debug ip rip', 'watch updates')],
        examples=[('ex', 'RIPv2', '''
            Router(config)# router rip
            Router(config-router)# version 2
            Router(config-router)# no auto-summary
            Router(config-router)# network 10.0.0.0
            Router(config-router)# passive-interface g0/1''')],
        see=['router ospf'], tags=['routing'])
    ,
    CMD('router bgp', 'ios-rt', 'ios-rt', 'BGP: routing between autonomous systems (ISPs, multi-homing, data centres).',
        'router bgp ASN | neighbor IP remote-as ASN | network PREFIX mask MASK',
        ['`network` in BGP does not enable interfaces: it advertises a prefix that must already exist **exactly** in the routing table.',
         'eBGP neighbours are normally directly connected; iBGP neighbours usually peer between loopbacks (`update-source Loopback0`).'],
        flags=[('bgp router-id 1.1.1.1', 'fixed ID'), ('neighbor IP remote-as ASN', 'define a peer'),
               ('neighbor IP description TEXT', 'label'), ('neighbor IP password KEY', 'TCP MD5 authentication'),
               ('neighbor IP update-source Lo0', 'source for iBGP'), ('neighbor IP next-hop-self', 'iBGP next hop'),
               ('neighbor IP route-map NAME {in | out}', 'policy'), ('neighbor IP prefix-list NAME {in | out}', 'filter prefixes'),
               ('show ip bgp summary', 'peers and state (a number in State/PfxRcd = established)'),
               ('show ip bgp', 'BGP table'), ('clear ip bgp IP soft', 're-apply policy without dropping the session')],
        examples=[('ex', 'Advertise your /24 to an ISP', '''
            Router(config)# ip route 198.51.100.0 255.255.255.0 null0
            Router(config)# router bgp 65001
            Router(config-router)# bgp router-id 1.1.1.1
            Router(config-router)# neighbor 203.0.113.1 remote-as 64500
            Router(config-router)# neighbor 203.0.113.1 password Bgp-K3y
            Router(config-router)# network 198.51.100.0 mask 255.255.255.0''')],
        see=['show ip route'], tags=['routing'])
    ,
    CMD('show ip protocols', 'ios-show', 'ios-rt', 'Which routing protocols run, on which networks, with which timers, neighbours and filters.',
        'show ip protocols [summary]',
        ['The fastest check that you typed the right `network` statements, the router ID and passive interfaces.'],
        examples=[('ex', 'OSPF summary', 'Router# show ip protocols | include Routing Protocol|Router ID|Routing for|area|Passive', '''
            Routing Protocol is "ospf 1"
              Router ID 1.1.1.1
              Routing for Networks:
                10.0.0.0 0.0.0.255 area 0
                10.0.12.0 0.0.0.3 area 0
              Passive Interface(s):
                GigabitEthernet0/1''')],
        see=['router ospf', 'router eigrp'], tags=['verify', 'routing'])
    ,
    CMD('redistribute', 'ios-rt', 'ios-rt', 'Import routes from one source (static, connected, another protocol) into a routing protocol.',
        'redistribute {static | connected | ospf ID | eigrp AS | rip | bgp ASN} [metric ...] [subnets] [route-map NAME]',
        ['Each protocol needs a seed metric for foreign routes: OSPF defaults to 20 (E2), EIGRP and RIP need one or the routes are not '
         'advertised. Two-way redistribution between protocols needs route-maps or tags to avoid loops.'],
        flags=[('subnets', '(OSPF, older IOS) include subnetted routes'), ('metric 1000000 10 255 1 1500', 'EIGRP seed: bandwidth delay reliability load MTU'),
               ('metric 3', 'RIP hop count'), ('metric-type 1', 'OSPF E1 instead of E2'), ('route-map NAME', 'filter or tag')],
        examples=[('ex', 'Static routes into OSPF', '''
            Router(config)# router ospf 1
            Router(config-router)# redistribute static subnets metric-type 1''')],
        see=['router ospf', 'router eigrp', 'route-map'])
    ,
    CMD('route-map', 'ios-rt', 'ios-rt', 'An if-then policy: match conditions, set actions. Used by redistribution, BGP, PBR and NAT.',
        'route-map NAME {permit | deny} SEQ | match ... | set ...',
        ['Entries are checked in sequence order; the first that matches applies. A route-map ends with an implicit deny.',
         'Policy-based routing: `ip policy route-map NAME` on the incoming interface.'],
        flags=[('match ip address ACL|prefix-list PL', 'match by ACL or prefix list'), ('match interface IF', 'by interface'),
               ('set ip next-hop IP', 'PBR next hop'), ('set metric N', 'metric'), ('set local-preference N', 'BGP'),
               ('set as-path prepend ASN ASN', 'BGP'), ('ip prefix-list PL seq 5 permit 10.0.0.0/8 le 24', 'prefix list'),
               ('show route-map', 'entries and hit counts')],
        examples=[('ex', 'Send guest traffic to the second ISP', '''
            Router(config)# access-list 110 permit ip 10.0.30.0 0.0.0.255 any
            Router(config)# route-map GUEST-OUT permit 10
            Router(config-route-map)# match ip address 110
            Router(config-route-map)# set ip next-hop 198.51.100.1
            Router(config-route-map)# exit
            Router(config)# interface g0/1.30
            Router(config-subif)# ip policy route-map GUEST-OUT''')],
        see=['redistribute', 'access-list'])
    ,
    CMD('standby (HSRP)', 'ios-rt', 'ios-rt', 'HSRP: two routers share one virtual gateway address; one is active, one waits.',
        'standby GROUP ip VIRTUAL-IP | standby GROUP priority N | standby GROUP preempt',
        ['Hosts use the virtual IP as their gateway. Highest priority (default 100) becomes active; without `preempt` a recovered router '
         'does not take over again. VRRP (`vrrp 1 ip ...`) and GLBP are the alternatives.'],
        flags=[('standby 1 ip 10.0.0.1', 'virtual IP'), ('standby 1 priority 110', 'priority'), ('standby 1 preempt', 'take back active role'),
               ('standby version 2', 'HSRPv2 (more groups, IPv6)'), ('standby 1 track OBJ decrement 20', 'drop priority when an uplink fails'),
               ('standby 1 authentication md5 key-string KEY', 'authenticate'), ('show standby brief', 'state per group')],
        examples=[('ex', 'Active router', '''
            R1(config)# interface g0/1
            R1(config-if)# ip address 10.0.0.2 255.255.255.0
            R1(config-if)# standby version 2
            R1(config-if)# standby 1 ip 10.0.0.1
            R1(config-if)# standby 1 priority 110
            R1(config-if)# standby 1 preempt
            R1(config-if)# end
            R1# show standby brief''', '''
            Interface   Grp  Pri P State   Active          Standby         Virtual IP
            Gi0/1       1    110 P Active  local           10.0.0.3        10.0.0.1''')],
        see=['ip address'])
    ,
    CMD('ipv6 address', 'ios-rt', 'ios', 'Enable IPv6 routing and give interfaces IPv6 addresses.',
        'ipv6 unicast-routing | (interface) ipv6 address PREFIX/LEN [eui-64 | link-local] | ipv6 address autoconfig | ipv6 enable',
        ['Without `ipv6 unicast-routing` a router does not forward IPv6 or send Router Advertisements. Each interface gets a link-local '
         '`fe80::` address automatically once IPv6 is enabled on it.'],
        flags=[('ipv6 unicast-routing', '(global) route IPv6'), ('ipv6 address 2001:db8:10::1/64', 'static address'),
               ('ipv6 address 2001:db8:10::/64 eui-64', 'host part from the MAC'), ('ipv6 address fe80::1 link-local', 'tidy link-local'),
               ('ipv6 address autoconfig', 'SLAAC client'), ('ipv6 address dhcp', 'DHCPv6 client'), ('ipv6 enable', 'link-local only'),
               ('ipv6 route ::/0 2001:db8::1', 'default route'), ('ipv6 router ospf 1 / ipv6 ospf 1 area 0', 'OSPFv3'),
               ('show ipv6 interface brief', 'addresses'), ('show ipv6 route', 'table'), ('show ipv6 neighbors', 'like ARP')],
        examples=[('ex', 'Dual-stack LAN interface', '''
            Router(config)# ipv6 unicast-routing
            Router(config)# interface g0/1
            Router(config-if)# ipv6 address 2001:db8:10::1/64
            Router(config-if)# ipv6 address fe80::1 link-local
            Router(config-if)# end
            Router# show ipv6 interface brief g0/1''', '''
            GigabitEthernet0/1     [up/up]
                FE80::1
                2001:DB8:10::1''')],
        see=['ip address', 'ip route'], tags=['ipv6'])
    ,

    H2('Access control lists', 'acl'),
    P('''An ACL is an ordered list of `permit` and `deny` lines. A packet is checked against each line in turn and the **first match
    wins**; if nothing matches, an invisible `deny any` at the end drops it. Place **standard** ACLs (source only) close to the
    destination and **extended** ACLs (source, destination, protocol, port) close to the source.'''),
    TABLE(['ACL', 'Numbers', 'Matches'], [
        ['Standard', '1-99, 1300-1999', 'source address only'],
        ['Extended', '100-199, 2000-2699', 'protocol, source, destination, ports, flags'],
        ['Named standard / extended', 'any name', 'the same, editable by sequence number'],
        ['IPv6', 'named only', '`ipv6 access-list NAME`; ends with implicit permits for neighbour discovery'],
    ], 'ACL types'),
    TABLE(['Write', 'Matches', 'Wildcard'], [
        ['`host 10.0.0.5`', 'one address', '`10.0.0.5 0.0.0.0`'],
        ['`10.0.0.0 0.0.0.255`', '10.0.0.0/24', '255.255.255.255 minus the mask'],
        ['`10.0.0.0 0.0.0.3`', '10.0.0.0/30', ''],
        ['`10.0.0.0 0.0.255.255`', '10.0.0.0/16', ''],
        ['`10.0.1.0 0.0.254.255`', 'odd third octets only (10.0.1.x, 10.0.3.x ...)', 'non-contiguous, legal in ACLs'],
        ['`any`', 'every address', '`0.0.0.0 255.255.255.255`'],
    ], 'Wildcard masks'),
    TABLE(['Operator', 'Meaning', 'Port keywords IOS accepts'], [
        ['`eq N`', 'equal', '`www` 80, `443`, `22`, `telnet` 23, `smtp` 25, `domain` 53, `ftp` 21, `ftp-data` 20, `pop3` 110, `bootps` 67, `bootpc` 68, `snmp` 161, `ntp` 123, `syslog` 514, `tftp` 69'],
        ['`neq N`', 'not equal', ''], ['`lt N` / `gt N`', 'less / greater than', ''], ['`range A B`', 'inclusive range', '`range 49152 65535`'],
        ['`established`', 'TCP with ACK or RST set (return traffic)', ''],
        ['`log` / `log-input`', 'log matches (rate-limited)', ''],
        ['`echo`, `echo-reply`, `unreachable`, `time-exceeded`', 'ICMP types', ''],
    ], 'Extended ACL keywords'),
    CMD('access-list', 'ios-sec', 'ios', 'Numbered ACLs: standard (source only) and extended (full 5-tuple).',
        'access-list 1-99 {permit | deny} SOURCE [WILDCARD] | access-list 100-199 {permit | deny} PROTO SRC [PORT] DST [PORT] [established] [log]',
        ['Numbered ACL lines are appended to the end, and `no access-list 101` deletes **the whole list**, not one line. To edit, use '
         '`ip access-list extended 101` and sequence numbers.',
         'An ACL does nothing until it is applied: `ip access-group` on an interface, `access-class` on vty lines, or referenced by NAT, '
         'route-maps or QoS.'],
        flags=[('permit / deny', 'action'), ('PROTO', '`ip`, `tcp`, `udp`, `icmp`, `esp`, `gre`, `ospf`, `eigrp` or a number'),
               ('remark TEXT', 'a comment line'), ('log', 'log matches'), ('established', 'TCP replies'),
               ('show access-lists [N]', 'lines with hit counts'), ('clear access-list counters', 'zero the counts')],
        examples=[('ex', 'Standard: only the management subnet may SSH in', '''
            Router(config)# access-list 10 remark management hosts
            Router(config)# access-list 10 permit 10.0.99.0 0.0.0.255
            Router(config)# line vty 0 15
            Router(config-line)# access-class 10 in'''),
                  ('ex', 'Extended: web and DNS out, nothing else', '''
            Router(config)# access-list 110 permit tcp 10.0.0.0 0.0.0.255 any eq 443
            Router(config)# access-list 110 permit tcp 10.0.0.0 0.0.0.255 any eq www
            Router(config)# access-list 110 permit udp 10.0.0.0 0.0.0.255 host 10.0.0.20 eq domain
            Router(config)# access-list 110 deny ip any any log
            Router(config)# interface g0/1
            Router(config-if)# ip access-group 110 in''')],
        gotchas=['Every ACL ends with an implicit `deny any`. An ACL with only `deny` lines blocks everything.'],
        see=['ip access-list', 'ip access-group'], tags=['acl'])
    ,
    CMD('ip access-list', 'ios-sec', 'ios', 'Named ACLs, edited line by line with sequence numbers.',
        'ip access-list {standard | extended} NAME | [SEQ] {permit | deny} ... | no SEQ | ip access-list resequence NAME START STEP',
        ['Lines get sequence numbers 10, 20, 30... Insert a line between two with a number in between (`15 deny ...`), delete one with '
         '`no 20`. Numbered ACLs can be edited the same way with `ip access-list extended 110`.'],
        flags=[('standard NAME', 'source-only list'), ('extended NAME', 'full list'), ('SEQ permit ...', 'add at a position'),
               ('no SEQ', 'delete a line'), ('resequence NAME 10 10', 'renumber'), ('ipv6 access-list NAME', 'IPv6 ACL; apply with `ipv6 traffic-filter NAME in`'),
               ('show ip access-lists NAME', 'lines and matches')],
        examples=[('ex', 'Insert a block above an existing permit', '''
            Router(config)# ip access-list extended WEB-IN
            Router(config-ext-nacl)# 10 permit tcp any host 10.0.0.80 eq 443
            Router(config-ext-nacl)# 20 deny ip any any log
            Router(config-ext-nacl)# 5 deny ip host 198.51.100.9 any
            Router(config-ext-nacl)# end
            Router# show access-lists WEB-IN''', '''
            Extended IP access list WEB-IN
                5 deny ip host 198.51.100.9 any
                10 permit tcp any host 10.0.0.80 eq 443 (1532 matches)
                20 deny ip any any log (17 matches)''')],
        see=['access-list', 'ip access-group'], tags=['acl'])
    ,
    CMD('ip access-group', 'ios-sec', 'ios', 'Apply an ACL to an interface, inbound or outbound (one per direction per protocol).',
        'ip access-group {NUMBER | NAME} {in | out}',
        ['`in` filters packets arriving on the interface, before routing; `out` filters packets leaving it. Packets the router itself '
         'generates are not filtered by outbound ACLs. For vty lines, use `access-class` instead.'],
        flags=[('in', 'arriving packets'), ('out', 'leaving packets'), ('ipv6 traffic-filter NAME in', 'IPv6 version'),
               ('show ip interface IF | include access list', 'what is applied where')],
        examples=[('ex', 'Apply and confirm', '''
            Router(config)# interface g0/0
            Router(config-if)# ip access-group WEB-IN in
            Router(config-if)# do show ip interface g0/0 | include access list''', '''
              Outgoing Common access list is not set
              Outgoing access list is not set
              Inbound Common access list is not set
              Inbound  access list is WEB-IN''')],
        see=['access-list', 'ip access-list'], tags=['acl'])
    ,

    H2('NAT', 'nat'),
    CMD('ip nat', 'ios-svc', 'ios-rt', 'Network address translation: PAT (overload), static NAT and port forwarding.',
        '(interface) ip nat {inside | outside} | ip nat inside source {list ACL {interface IF | pool NAME} [overload] | static [tcp|udp] LOCAL [PORT] GLOBAL [PORT]}',
        ['Mark interfaces first: LAN side `ip nat inside`, internet side `ip nat outside`. An ACL picks which inside addresses to translate.',
         '**PAT** (`overload`) shares one public address among everyone by varying the source port; **static NAT** maps one inside host '
         'permanently, so outside users can reach it (port forwarding with `tcp`/`udp`).'],
        flags=[('ip nat inside / outside', '(interface) roles'), ('list 1 interface g0/0 overload', 'PAT to the outside interface address'),
               ('ip nat pool NAME FIRST LAST netmask MASK', 'a pool of public addresses'), ('list 1 pool NAME [overload]', 'dynamic NAT from a pool'),
               ('static 10.0.0.80 203.0.113.80', 'one-to-one'), ('static tcp 10.0.0.80 443 interface g0/0 443', 'port forward'),
               ('show ip nat translations [verbose]', 'current table'), ('show ip nat statistics', 'hits, misses, interfaces'),
               ('clear ip nat translation *', 'flush dynamic entries'), ('ip nat translation timeout 3600', 'timeout')],
        examples=[('ex', 'Typical home/branch PAT plus one forwarded port', '''
            Router(config)# access-list 1 permit 10.0.0.0 0.0.0.255
            Router(config)# interface g0/1
            Router(config-if)# ip nat inside
            Router(config-if)# interface g0/0
            Router(config-if)# ip nat outside
            Router(config-if)# exit
            Router(config)# ip nat inside source list 1 interface g0/0 overload
            Router(config)# ip nat inside source static tcp 10.0.0.80 443 interface g0/0 443
            Router(config)# end
            Router# show ip nat translations''', '''
            Pro Inside global        Inside local         Outside local      Outside global
            tcp 203.0.113.2:443      10.0.0.80:443        ---                ---
            tcp 203.0.113.2:51022    10.0.0.21:51022      142.250.1.100:443  142.250.1.100:443''')],
        notes=['Inside local = the private address; inside global = what the internet sees; outside = the remote host.'],
        see=['access-list', 'ip route'], tags=['nat'])
    ,

    H2('DHCP and DNS services', 'dhcp'),
    CMD('ip dhcp pool', 'ios-svc', 'ios', 'Run a DHCP server on the router or switch.',
        'ip dhcp excluded-address FIRST [LAST] | ip dhcp pool NAME | network PREFIX MASK | default-router IP | dns-server IP | domain-name NAME | lease DAYS [HOURS] [MIN]',
        ['Exclude the static addresses (gateway, servers, printers) **before** clients ask, or the router may hand them out. The pool\'s '
         '`network` must match an interface subnet (or a relay must forward to it).'],
        flags=[('ip dhcp excluded-address 10.0.0.1 10.0.0.20', '(global) never lease these'), ('network 10.0.0.0 255.255.255.0', 'scope'),
               ('default-router 10.0.0.1', 'option 3 gateway'), ('dns-server 10.0.0.20 1.1.1.1', 'option 6'),
               ('domain-name lab.local', 'option 15'), ('lease 7 / lease infinite', 'lease length'),
               ('option 150 ip 10.0.0.30', 'TFTP server for Cisco phones'), ('option 43 hex ...', 'wireless controller discovery'),
               ('host 10.0.0.50 255.255.255.0 + client-identifier 0100.5056.a1b2.c3', 'a reservation (its own pool)'),
               ('show ip dhcp binding', 'leases'), ('show ip dhcp pool', 'utilisation'), ('show ip dhcp conflict', 'addresses found in use'),
               ('clear ip dhcp binding *', 'release all'), ('no service dhcp', 'turn the DHCP service off')],
        examples=[('ex', 'The pool from the infographic', '''
            Router(config)# ip dhcp excluded-address 10.0.0.1 10.0.0.20
            Router(config)# ip dhcp pool VLAN10
            Router(dhcp-config)# network 10.0.0.0 255.255.255.0
            Router(dhcp-config)# default-router 10.0.0.1
            Router(dhcp-config)# dns-server 10.0.0.20
            Router(dhcp-config)# domain-name networkdna.local
            Router(dhcp-config)# lease 7
            Router(dhcp-config)# end
            Router# show ip dhcp binding''', '''
            Bindings from all pools not associated with VRF:
            IP address      Client-ID/              Lease expiration        Type       State      Interface
                            Hardware address/
                            User name
            10.0.0.21       0100.5056.a1b2.c3       Nov 25 2026 09:31 AM    Automatic  Active     GigabitEthernet0/1''')],
        see=['ip helper-address', 'ip dhcp snooping', 'ip domain-name'], tags=['dhcp'])
    ,
    CMD('ip helper-address', 'ios-svc', 'ios', 'DHCP relay: forward client broadcasts to a DHCP server on another subnet.',
        '(interface) ip helper-address SERVER-IP',
        ['Configure it on the interface (or SVI) that **faces the clients**, the gateway of their VLAN. The relay fills in its own address '
         'as `giaddr`, which tells the server which pool to use.',
         'It also forwards seven other UDP broadcasts by default (TFTP, DNS, TACACS, NetBIOS, time); trim them with `no ip forward-protocol udp PORT`.'],
        flags=[('ip helper-address 10.0.0.10', 'one server; repeat the line for a second'), ('ip forward-protocol udp PORT', 'relay another broadcast'),
               ('no ip forward-protocol udp 69', 'stop relaying TFTP')],
        examples=[('ex', 'Relay VLAN 30 to the central server', '''
            Switch(config)# interface vlan 30
            Switch(config-if)# ip address 10.0.30.1 255.255.255.0
            Switch(config-if)# ip helper-address 10.0.0.10''')],
        see=['ip dhcp pool', 'ip dhcp snooping'], tags=['dhcp'])
    ,
    CMD('ip dhcp snooping', 'ios-sec', 'ios-sw', 'Block rogue DHCP servers and build a binding table of which IP is on which port.',
        'ip dhcp snooping | ip dhcp snooping vlan LIST | (interface) ip dhcp snooping trust | (interface) ip dhcp snooping limit rate PPS',
        ['After enabling, every port is **untrusted**: DHCP offers and acks arriving there are dropped. Trust the uplinks toward the real '
         'server only.',
         'Catalyst switches insert option 82 by default, which many non-Cisco DHCP servers reject (clients never get an address). '
         '`no ip dhcp snooping information option` fixes that when the switch is not a relay.',
         'The binding table it builds feeds Dynamic ARP Inspection and IP Source Guard.'],
        flags=[('ip dhcp snooping', '(global) turn on'), ('ip dhcp snooping vlan 10,20', 'which VLANs'),
               ('ip dhcp snooping trust', '(interface) server-facing or uplink port'), ('ip dhcp snooping limit rate 15', '(interface) DHCP packets per second'),
               ('no ip dhcp snooping information option', 'do not insert option 82'),
               ('ip dhcp snooping database flash:snoop.db', 'keep bindings across reloads'),
               ('show ip dhcp snooping', 'VLANs and trusted ports'), ('show ip dhcp snooping binding', 'MAC, IP, lease, VLAN, port'),
               ('show ip dhcp snooping statistics', 'dropped packets')],
        examples=[('ex', 'Panel 1 of the infographic', '''
            Switch(config)# ip dhcp snooping
            Switch(config)# ip dhcp snooping vlan 10
            Switch(config)# no ip dhcp snooping information option
            Switch(config)# interface g0/1
            Switch(config-if)# ip dhcp snooping trust
            Switch(config-if)# interface range g0/2 - 23
            Switch(config-if-range)# ip dhcp snooping limit rate 15
            Switch(config-if-range)# end
            Switch# show ip dhcp snooping binding''', '''
            MacAddress          IpAddress        Lease(sec)  Type           VLAN  Interface
            ------------------  ---------------  ----------  -------------  ----  --------------------
            00:50:56:A1:B2:C3   10.0.0.21        604712      dhcp-snooping   10    GigabitEthernet0/2
            Total number of bindings: 1''')],
        gotchas=['A port that exceeds the rate limit is err-disabled. Set a generous limit on trunks or leave them unlimited.'],
        see=['ip arp inspection', 'ip helper-address', 'errdisable recovery'], tags=['dhcp', 'security'])
    ,
    CMD('ip arp inspection', 'ios-sec', 'ios-sw', 'Dynamic ARP Inspection: drop ARP replies that do not match the DHCP snooping table.',
        'ip arp inspection vlan LIST | (interface) ip arp inspection trust | ip arp inspection validate src-mac dst-mac ip',
        ['Stops ARP spoofing (man-in-the-middle). Needs DHCP snooping bindings, or an ARP ACL for statically addressed hosts. Trust the same uplinks.'],
        flags=[('ip arp inspection vlan 10', 'turn on for a VLAN'), ('ip arp inspection trust', '(interface) skip checks'),
               ('ip arp inspection limit rate 100', '(interface) ARP per second'), ('validate src-mac dst-mac ip', 'extra checks'),
               ('ip verify source', '(interface) IP Source Guard: drop spoofed source IPs'),
               ('show ip arp inspection [statistics]', 'drops per VLAN')],
        examples=[('ex', 'Protect VLAN 10', '''
            Switch(config)# ip arp inspection vlan 10
            Switch(config)# interface g0/24
            Switch(config-if)# ip arp inspection trust''')],
        see=['ip dhcp snooping', 'show ip arp'], tags=['security'])
    ,
    CMD('show ip arp', 'ios-show', 'ios', 'The ARP table: IP address to MAC address, per interface.',
        'show ip arp [IP | MAC | IF] | show arp',
        ['Age `-` means the router\'s own address. `Incomplete` means an ARP request got no answer: the host is down or in the wrong VLAN.'],
        flags=[('clear arp-cache [interface IF]', 'flush'), ('arp IP MAC arpa', '(global) static entry'), ('show ipv6 neighbors', 'IPv6 equivalent')],
        examples=[('ex', 'Hosts the router has talked to', 'Router# show ip arp', '''
            Protocol  Address          Age (min)  Hardware Addr   Type   Interface
            Internet  10.0.0.1                -   5c50.15ab.0101  ARPA   GigabitEthernet0/1
            Internet  10.0.0.10              12   0050.56a1.0010  ARPA   GigabitEthernet0/1
            Internet  10.0.0.21               3   0050.56a1.b2c3  ARPA   GigabitEthernet0/1''')],
        see=['show mac address-table'], tags=['verify'])
    ,

    H2('Monitoring and management', 'monitor'),
    CMD('snmp-server', 'ios-svc', 'ios', 'Let a monitoring system poll counters and receive traps.',
        'snmp-server community STRING {ro | rw} [ACL] | snmp-server group/user ... v3 priv | snmp-server host IP ...',
        ['Use SNMPv3 with authentication and encryption where you can. If you must use v2c, use a long community string, read-only, '
         'restricted by an ACL. Never leave `public`/`private`.'],
        flags=[('community S ro 10', 'v2c read-only, ACL 10 only'), ('group MON v3 priv', 'v3 group with encryption'),
               ('user nms MON v3 auth sha AUTHPW priv aes 128 PRIVPW', 'v3 user'),
               ('host 10.0.0.50 version 3 priv nms', 'send traps'), ('enable traps', 'which traps'),
               ('location / contact', 'sysLocation, sysContact'), ('show snmp [user | group]', 'status')],
        examples=[('ex', 'SNMPv3 for one NMS', '''
            Router(config)# snmp-server group MON v3 priv
            Router(config)# snmp-server user nms MON v3 auth sha Auth-Pass-123 priv aes 128 Priv-Pass-456
            Router(config)# snmp-server host 10.0.0.50 version 3 priv nms
            Router(config)# snmp-server enable traps snmp linkdown linkup''')],
        see=['logging'])
    ,
    CMD('show processes cpu', 'ios-show', 'ios', 'CPU and memory use, overall and by process.',
        'show processes cpu [sorted | history] | show processes memory [sorted] | show memory statistics',
        ['The first line, `CPU utilization for five seconds: 12%/3%`, splits total from interrupt-level (packet switching) load. High '
         'interrupt load means traffic being process-switched or punted.'],
        flags=[('sorted', 'busiest first'), ('history', 'ASCII graphs for the last hour/day/3 days'),
               ('show processes memory sorted', 'memory per process'), ('show platform resources', '(IOS XE) summary')],
        examples=[('ex', 'Top CPU users', 'Router# show processes cpu sorted | exclude 0.00%  0.00%  0.00%', '''
            CPU utilization for five seconds: 12%/3%; one minute: 9%; five minutes: 8%
             PID Runtime(ms)     Invoked      uSecs   5Sec   1Min   5Min TTY Process
             131     5112432     2210444       2312  4.31%  3.10%  2.98%   0 IP Input
             219      812331      410522       1978  1.15%  0.88%  0.80%   0 SSH Process''')],
        see=['show version', 'logging'], tags=['troubleshoot'])
    ,
    CMD('show inventory', 'ios-show', 'ios', 'Hardware: chassis, modules, transceivers with product IDs and serial numbers.',
        'show inventory | show environment [all] | show license [summary] | show platform',
        ['What you paste into a support case. `show environment` covers fans, temperature and power supplies; `show license` the '
         'feature set (IOS XE Smart Licensing: `show license summary`).'],
        flags=[('show inventory', 'PID/SN'), ('show environment all', 'fans, power, temperature'),
               ('show license summary', 'licences in use'), ('show interfaces transceiver', 'SFP optical levels'),
               ('show switch', 'stack members'), ('show power inline', 'PoE per port'), ('show tech-support', 'everything (very long)')],
        examples=[('ex', 'Serial numbers', 'Switch# show inventory', '''
            NAME: "1", DESCR: "WS-C2960X-24PS-L"
            PID: WS-C2960X-24PS-L  , VID: V05  , SN: FOC1234X5YZ''')],
        see=['show version'])
    ,
    CMD('ip sla', 'ios-svc', 'ios-rt', 'Run a test (ping, HTTP, jitter) on a schedule and track the result, e.g. to fail over a route.',
        'ip sla N | icmp-echo IP [source-interface IF] | frequency SEC | ip sla schedule N life forever start-time now | track N ip sla N reachability',
        ['Combined with `ip route ... track N`, a default route is withdrawn when the ISP stops answering, and the backup takes over.'],
        flags=[('icmp-echo IP', 'ping test'), ('frequency 10', 'every 10 s'), ('threshold / timeout MS', 'limits'),
               ('track 1 ip sla 1 reachability', 'a tracked object'), ('show ip sla statistics', 'results'), ('show track', 'object state')],
        examples=[('ex', 'Fail over when ISP A stops answering', '''
            Router(config)# ip sla 1
            Router(config-ip-sla)# icmp-echo 203.0.113.1 source-interface g0/0
            Router(config-ip-sla-echo)# frequency 10
            Router(config-ip-sla-echo)# exit
            Router(config)# ip sla schedule 1 life forever start-time now
            Router(config)# track 1 ip sla 1 reachability
            Router(config)# ip route 0.0.0.0 0.0.0.0 203.0.113.1 track 1
            Router(config)# ip route 0.0.0.0 0.0.0.0 198.51.100.1 250''')],
        see=['ip route', 'standby (HSRP)'])
    ,

    H2('Show commands by task', 'show'),
    TABLE(['Question', 'Command'], [
        ['What model, IOS, uptime, config register?', '`show version`'],
        ['Is every interface up, with what address?', '`show ip interface brief`'],
        ['Which switch ports are connected, in which VLAN?', '`show interfaces status`'],
        ['Errors, drops, duplex on a port?', '`show interfaces g0/1`, `show interfaces counters errors`'],
        ['Access or trunk? Which VLANs?', '`show interfaces g0/1 switchport`, `show interfaces trunk`'],
        ['Which VLANs exist, which ports are in them?', '`show vlan brief`'],
        ['Where is a MAC address?', '`show mac address-table address MAC`'],
        ['Which MAC has this IP?', '`show ip arp IP`'],
        ['What is connected to each port?', '`show cdp neighbors`, `show lldp neighbors`'],
        ['How would a packet to X be routed?', '`show ip route X`, `show ip cef X`'],
        ['Which routing protocols, networks, neighbours?', '`show ip protocols`, `show ip ospf neighbor`, `show ip eigrp neighbors`, `show ip bgp summary`'],
        ['Who is the STP root, what is blocking?', '`show spanning-tree vlan N`, `show spanning-tree summary`'],
        ['Why is a port err-disabled?', '`show interfaces status err-disabled`'],
        ['Port security violations?', '`show port-security`'],
        ['Is an EtherChannel bundled?', '`show etherchannel summary`'],
        ['Which ACLs exist, how many hits?', '`show access-lists`'],
        ['Which ACL is on an interface?', '`show ip interface g0/1 | include access list`'],
        ['Current NAT entries?', '`show ip nat translations`, `show ip nat statistics`'],
        ['DHCP leases handed out?', '`show ip dhcp binding`, `show ip dhcp pool`'],
        ['DHCP snooping bindings and drops?', '`show ip dhcp snooping binding`, `show ip dhcp snooping statistics`'],
        ['Gateway redundancy?', '`show standby brief`, `show vrrp brief`'],
        ['Is the clock right, NTP synchronised?', '`show clock detail`, `show ntp status`'],
        ['Recent log messages?', '`show logging`'],
        ['CPU or memory trouble?', '`show processes cpu sorted`, `show processes memory sorted`'],
        ['Who is logged in? Which SSH sessions?', '`show users`, `show ssh`'],
        ['Unsaved changes?', '`show archive config differences`'],
        ['Hardware and serials?', '`show inventory`, `show environment all`'],
        ['IPv6 equivalents', '`show ipv6 interface brief`, `show ipv6 route`, `show ipv6 neighbors`'],
    ], 'Find the right show command'),

    H2('Troubleshooting by symptom', 'troubleshoot'),
    TABLE(['`show ip int brief` says', 'Meaning', 'Check'], [
        ['up / up', 'working at layers 1 and 2', 'move up the stack: addressing, routing, ACLs'],
        ['administratively down / down', 'someone typed `shutdown`', '`no shutdown`'],
        ['down / down', 'no signal: cable, far end off or shut, wrong SFP', 'cable, far end, `show interfaces` for the media type'],
        ['up / down', 'layer 1 fine, layer 2 failing', 'serial: encapsulation or clock rate; Ethernet: keepalive, err-disable, wrong mode'],
        ['down / down (err-disabled)', 'the switch shut the port', '`show interfaces status err-disabled`, fix the cause, bounce the port'],
        ['up / up (but no traffic)', 'wrong VLAN, native VLAN mismatch, STP blocking', '`show interfaces switchport`, `show spanning-tree`'],
    ], 'Interface status'),
    TABLE(['Symptom', 'Likely cause', 'Fix'], [
        ['`% Invalid input detected at \'^\' marker`', 'wrong mode, or a typo at the caret', 'check the prompt; use `?` at the caret position'],
        ['`% Incomplete command`', 'a required argument is missing', 'add `?` at the end to see what comes next'],
        ['`% Ambiguous command`', 'the abbreviation matches several commands', 'type more letters'],
        ['`Translating "xyz"...domain server (255.255.255.255)`', 'mistyped word treated as a host name', '[[Ctrl]]+[[Shift]]+[[6]]; `no ip domain-lookup` in labs'],
        ['`% No password set` on telnet/SSH', 'no vty password or no enable secret', 'set `login local` and `enable secret`'],
        ['SSH refused', 'no RSA key, `transport input` lacks ssh, ACL on vty', '`show ip ssh`, `show run | section line vty`'],
        ['PCs get 169.254.x.x', 'no DHCP reply: snooping not trusting the server port, option 82, missing helper, pool missing', '`show ip dhcp snooping statistics`, `debug ip dhcp server packet`'],
        ['Can ping by IP, not by name', 'no `dns-server` in the pool or the DNS server unreachable', '`ipconfig /all` on the PC, `show ip dhcp pool`'],
        ['Can ping the gateway, not the internet', 'missing default route or NAT', '`show ip route 0.0.0.0`, `show ip nat statistics`'],
        ['OSPF neighbours stuck in INIT / EXSTART', 'one-way hellos (ACL) / MTU mismatch', '`show ip ospf interface`, match MTU'],
        ['OSPF not forming at all', 'area, subnet, timers, authentication or passive interface', '`show ip ospf interface g0/0`, `debug ip ospf adj`'],
        ['Native VLAN mismatch messages', 'trunk ends disagree on native VLAN', 'same `switchport trunk native vlan` on both ends'],
        ['Slow link, CRC and late collisions', 'duplex mismatch', 'auto on both ends, or fixed on both ends'],
        ['Config gone after a reload', 'never saved, or config register 0x2142', '`copy run start`, `config-register 0x2102`'],
    ], 'Common problems'),
    CALLOUT('warn', 'Password recovery (you need the console cable)',
            UL('Router: power-cycle and press [[Break]] within 60 seconds to reach `rommon 1 >`.',
               'At ROMMON: `confreg 0x2142`, then `reset`. The router boots ignoring the startup config.',
               'Say `no` to the setup dialog, then `enable`, `copy startup-config running-config` (merges your real config, interfaces stay shut).',
               '`configure terminal`, set a new `enable secret`, `no shutdown` the interfaces you need, `config-register 0x2102`.',
               '`copy running-config startup-config`, `reload`.',
               'Catalyst switch: hold the **Mode** button while powering on, then `flash_init`, `rename flash:config.text flash:config.old`, `boot`, and copy it back once in.')),

    H2('Starter templates', 'templates'),
    P('''Paste-ready baselines. Replace the names, addresses and passwords, then compare with `show running-config` and save.'''),
    H3('Access switch'),
    IOS('''
        hostname SW1
        no ip domain-lookup
        ip domain-name lab.local
        service password-encryption
        service timestamps log datetime msec localtime show-timezone
        enable algorithm-type scrypt secret CHANGE-ME-Enable
        username admin privilege 15 algorithm-type scrypt secret CHANGE-ME-Admin
        banner motd #Authorised access only. Activity is logged.#
        !
        vtp mode transparent
        spanning-tree mode rapid-pvst
        spanning-tree portfast default
        spanning-tree portfast bpduguard default
        !
        vlan 10
         name USERS
        vlan 99
         name MGMT
        vlan 999
         name PARKING
        !
        ip dhcp snooping
        ip dhcp snooping vlan 10
        no ip dhcp snooping information option
        ip arp inspection vlan 10
        !
        interface range GigabitEthernet0/2 - 22
         switchport mode access
         switchport access vlan 10
         switchport port-security
         switchport port-security maximum 2
         switchport port-security violation restrict
         ip dhcp snooping limit rate 15
        !
        interface GigabitEthernet0/24
         description Uplink to R1
         switchport mode trunk
         switchport trunk native vlan 999
         switchport trunk allowed vlan 10,99,999
         switchport nonegotiate
         ip dhcp snooping trust
         ip arp inspection trust
        !
        interface Vlan99
         ip address 10.0.99.2 255.255.255.0
         no shutdown
        ip default-gateway 10.0.99.1
        !
        crypto key generate rsa modulus 2048
        ip ssh version 2
        ip access-list standard MGMT
         permit 10.0.99.0 0.0.0.255
        line console 0
         login local
         exec-timeout 10 0
         logging synchronous
        line vty 0 15
         login local
         transport input ssh
         access-class MGMT in
         exec-timeout 10 0
        !
        ntp server 10.0.99.1
        logging host 10.0.99.50
        end
    '''),
    H3('Branch router with PAT, DHCP and router-on-a-stick'),
    IOS('''
        hostname R1
        ip domain-name lab.local
        ip name-server 10.0.0.20
        enable algorithm-type scrypt secret CHANGE-ME-Enable
        username admin privilege 15 algorithm-type scrypt secret CHANGE-ME-Admin
        service password-encryption
        !
        ip dhcp excluded-address 10.0.10.1 10.0.10.20
        ip dhcp pool USERS
         network 10.0.10.0 255.255.255.0
         default-router 10.0.10.1
         dns-server 10.0.0.20
         domain-name lab.local
        !
        interface GigabitEthernet0/0
         description WAN
         ip address dhcp
         ip nat outside
         no shutdown
        interface GigabitEthernet0/1
         no ip address
         no shutdown
        interface GigabitEthernet0/1.10
         encapsulation dot1Q 10
         ip address 10.0.10.1 255.255.255.0
         ip nat inside
        interface GigabitEthernet0/1.99
         encapsulation dot1Q 99
         ip address 10.0.99.1 255.255.255.0
         ip nat inside
        interface GigabitEthernet0/1.999
         encapsulation dot1Q 999 native
        !
        access-list 1 permit 10.0.0.0 0.0.255.255
        ip nat inside source list 1 interface GigabitEthernet0/0 overload
        !
        crypto key generate rsa modulus 2048
        ip ssh version 2
        line vty 0 4
         login local
         transport input ssh
        end
    '''),

    H2('Practice', 'practice'),
    CHECK('cisco-check', 'Cisco IOS quick check',
          Q('You type `ip address 10.0.0.1 255.255.255.0` and get `% Invalid input detected`. The prompt is `R1(config)#`. Why?',
            [('IP addresses go on an interface: enter `interface g0/1` first', True), ('The mask must be written /24', False),
             ('You must save the configuration first', False), ('You are not in enable mode', False)],
            '`ip address` is an interface command. The global-config prompt `(config)#` does not accept it; `(config-if)#` does.'),
          Q('Which command makes the current configuration survive a reload?',
            [('`copy running-config startup-config`', True), ('`copy startup-config running-config`', False),
             ('`reload in 10`', False), ('`configure replace`', False)],
            'Changes live in the running config in RAM until copied to NVRAM. `write memory` does the same.'),
          Q('A trunk carries VLANs 10 and 20. You add VLAN 30 with `switchport trunk allowed vlan 30`. What happens?',
            [('Only VLAN 30 is allowed now; 10 and 20 are cut off', True), ('VLAN 30 is added to 10 and 20', False),
             ('The command is rejected', False), ('The trunk becomes an access port', False)],
            'Without `add`, the list is replaced. Use `switchport trunk allowed vlan add 30`.'),
          Q('Which wildcard mask matches exactly the subnet 172.16.8.0/22?',
            [('`0.0.3.255`', True), ('`255.255.252.0`', False), ('`0.0.4.255`', False), ('`0.0.0.255`', False)],
            'Wildcard = 255.255.255.255 minus the mask 255.255.252.0 = 0.0.3.255.'),
          Q('After `ip dhcp snooping` and `ip dhcp snooping vlan 10`, no PC gets an address. The server is on Gi0/1. What is missing?',
            [('`ip dhcp snooping trust` on Gi0/1', True), ('`ip helper-address` on Gi0/1', False),
             ('`spanning-tree portfast` on Gi0/1', False), ('`switchport mode trunk` on Gi0/1', False)],
            'Every port is untrusted once snooping is on, so the server\'s offers are dropped until its port is trusted. Option 82 is the next thing to check.'),
          Q('`show ip interface brief` shows an interface as `up` / `down`. Which layer is failing?',
            [('Layer 2: the physical link is fine but the line protocol is not', True), ('Layer 1: no cable', False),
             ('Layer 3: wrong IP address', False), ('It was shut down by an administrator', False)],
            'Status is layer 1, Protocol is layer 2. Up/down points at encapsulation, keepalives or clocking.'),
          Q('Which line sends every LAN user to the internet through one public address?',
            [('`ip nat inside source list 1 interface g0/0 overload`', True), ('`ip nat inside source static 10.0.0.0 203.0.113.2`', False),
             ('`ip nat outside`', False), ('`ip route 0.0.0.0 0.0.0.0 g0/0`', False)],
            '`overload` is PAT: many inside hosts share the outside interface address, told apart by source port.'),
          Q('An ACL has only `access-list 50 deny host 10.0.0.66`. Applied inbound on the LAN interface, what does it do?',
            [('Blocks everything, because of the implicit deny at the end', True), ('Blocks only 10.0.0.66', False),
             ('Nothing, standard ACLs cannot be applied inbound', False), ('Logs 10.0.0.66 and permits the rest', False)],
            'Add `access-list 50 permit any` after the deny to let everyone else through.')),
]

terms = [
    ('IOS', 'Internetwork Operating System: the software and command line on Cisco routers and switches (IOS XE is its Linux-based successor)'),
    ('running-config', 'the active configuration in RAM; every config command changes it immediately'),
    ('startup-config', 'the configuration saved in NVRAM and loaded at boot'),
    ('privileged EXEC', 'the `#` mode, reached with `enable`, where every show, debug, copy and reload command is available'),
    ('SVI', 'switched virtual interface: `interface vlan N`, an IP interface for a VLAN on a switch'),
    ('trunk', 'a switch link carrying several VLANs, each frame tagged with 802.1Q (except the native VLAN)'),
    ('native VLAN', 'the VLAN whose frames cross an 802.1Q trunk untagged; must match at both ends'),
    ('wildcard mask', 'an inverted mask used by ACLs and OSPF: 0 bits must match, 1 bits are ignored'),
    ('administrative distance', 'how much a router trusts a route source; the lowest wins when sources offer the same prefix'),
    ('PAT', 'port address translation (NAT overload): many inside hosts share one public address'),
    ('DHCP snooping', 'a switch feature that drops DHCP server messages on untrusted ports and records IP-to-port bindings'),
    ('ip helper-address', 'interface command that relays DHCP broadcasts to a server on another subnet'),
    ('err-disabled', 'a port state in which the switch has shut the port itself because of a violation'),
    ('configuration register', 'a 16-bit boot setting; 0x2102 is normal, 0x2142 skips the startup config'),
]

CHAPTER = chapter('cisco', 'Cisco IOS Cheat Sheet',
                  'Modes, help keys, output filters and every everyday IOS command, from first login to VLANs, routing, ACLs, NAT, DHCP and DNS, with examples',
                  'cheats', 30,
                  ['Tell from the prompt which IOS mode you are in and move between modes',
                   'Find, filter and save configuration with show, copy and output modifiers',
                   'Configure secure access, interfaces, VLANs, trunks and spanning tree on a switch',
                   'Configure static and dynamic routing, ACLs, NAT, DHCP and DNS on a router',
                   'Pick the right show command for a question and troubleshoot by interface status'],
                  blocks, terms, level='basics', part='ref', file='90-cisco.gm')
