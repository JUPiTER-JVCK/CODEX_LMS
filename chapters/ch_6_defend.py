from lib import *

AUDIT = r'''
#!/bin/zsh
# audit_mac.zsh - a read-only security snapshot of this Mac. Safe to run any time.
print "== $(scutil --get ComputerName) · macOS $(sw_vers -productVersion) · $(date '+%Y-%m-%d %H:%M')"

print "\n== Protections"
fdesetup status
csrutil status
spctl --status
/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
/usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode

print "\n== Administrators"
dscl . -read /Groups/admin GroupMembership

print "\n== Listening TCP ports"
lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR > 1 {print $1, $3, $9}' | sort -u

print "\n== Persistence: launch agents and daemons not from Apple"
for d in ~/Library/LaunchAgents /Library/LaunchAgents /Library/LaunchDaemons; do
  for f in $d/*.plist(N); do print "$d  ${f:t}"; done
done

print "\n== Cron"
crontab -l 2>/dev/null || print "(no user crontab)"

print "\n== Pending software updates"
softwareupdate --list 2>&1 | grep -E '^\s*\*|No new software' || true
'''

blocks = [
    P('''Packet analysis tells you what happened on the wire. This chapter is about the machines at either end: making your Mac and
    your Linux servers hard to attack, knowing what "normal" looks like on them, and noticing quickly when something changes. You will
    learn to think in threats rather than tools, check every built-in macOS protection from Terminal, write an audit script you can run
    any time, harden and watch a Linux server, triage log lines like an analyst, and follow a calm incident-response routine when
    something does go wrong.'''),

    H2('Think like a defender: threats before tools', 'threats'),
    P('''Security is not a list of settings. It starts with three questions: **what am I protecting** (assets: your files, accounts,
    keys, the NAS backups), **from whom** (an opportunistic scanner, a thief who steals the laptop, someone on the same Wi-Fi, a phishing
    email) and **how would they get in** (the attack surface: open ports, installed software, reused passwords, people). The answers decide
    what is worth doing. Full-disk encryption beats the laptop thief; it does nothing against a phished password.'''),
    TABLE(['Stage (MITRE ATT&CK tactic)', 'What the attacker does', 'Where you see it', 'Control that helps'], [
        ['Reconnaissance', 'scans ports, collects names and emails', 'firewall logs, the scan in the Wireshark chapter', 'expose less; nothing listening that does not need to'],
        ['Initial access', 'phishing, a weak password, an unpatched service', 'auth logs, mail filters', 'MFA, updates, password manager'],
        ['Execution', 'runs code: a script, a macro, a downloaded app', 'process lists, Gatekeeper prompts', 'Gatekeeper, notarization, least privilege'],
        ['Persistence', 'makes sure it survives a reboot: launch agents, cron, SSH keys', 'LaunchAgents folders, crontab, authorized_keys', 'audits and baselines (this chapter)'],
        ['Privilege escalation', 'becomes admin or root', 'sudo logs', 'separate admin account, no needless sudo rules'],
        ['Credential access', 'steals passwords, keys, session cookies', 'Keychain prompts, unusual logins', 'Keychain, FileVault, short sessions'],
        ['Command and control', 'calls home for instructions', 'DNS and TLS to odd domains, regular beacons', 'DNS logging, outbound filtering'],
        ['Exfiltration', 'moves your data out', 'large uploads, DNS tunnels', 'egress monitoring, encryption at rest'],
    ], 'An attack, stage by stage'),
    P('''MITRE ATT&CK is a public catalogue of real attacker techniques, organised by these tactics. Defenders use it as a shared
    vocabulary: "we can detect T1543.001, Launch Agent persistence, but not T1071.004, DNS command and control" is a precise statement of a
    gap. Browse it at attack.mitre.org; the macOS matrix is a good map of what to watch on your own machine.'''),

    H2('What macOS already does for you', 'macos'),
    P('''A current Mac ships with layered protections. Most are on by default; your job is to keep them on, understand what each one stops,
    and check them from Terminal rather than trusting a settings screen you have not opened in a year.'''),
    TABLE(['Protection', 'Stops', 'Check from Terminal', 'Healthy answer'], [
        ['**FileVault**', 'reading the disk of a lost or stolen Mac', '`fdesetup status`', '`FileVault is On.`'],
        ['**System Integrity Protection**', 'even root modifying system files and Apple processes', '`csrutil status`', '`System Integrity Protection status: enabled.`'],
        ['**Gatekeeper** and notarization', 'running apps that are unsigned or not checked by Apple', '`spctl --status`', '`assessments enabled`'],
        ['**XProtect**', 'known malware, by signature, and cleans some infections', '`system_profiler SPInstallHistoryDataType | grep -A3 XProtect`', 'recent update dates'],
        ['**Application firewall**', 'unwanted incoming connections to apps', '`/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate`', 'enabled'],
        ['**TCC** privacy permissions', 'apps reading your camera, microphone, files and screen without consent', 'System Settings, Privacy & Security', 'only apps you recognise'],
        ['**Software updates**', 'known vulnerabilities', '`softwareupdate --list`', '`No new software available.`'],
    ], 'Built-in macOS protections'),
    TERM('''
    $ fdesetup status
    FileVault is On.
    $ csrutil status
    System Integrity Protection status: enabled.
    $ spctl --status
    assessments enabled
    '''),
    CMD('socketfilterfw', 'sec-mac', 'mac', 'Inspect and configure the macOS application firewall from Terminal.',
        '/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate | --setglobalstate on | --getstealthmode | --setstealthmode on | --listapps',
        ['The macOS firewall filters **incoming** connections per application, not per port: when an app starts listening, macOS asks whether to allow it. The command-line tool lives outside your `PATH` at `/usr/libexec/ApplicationFirewall/socketfilterfw`; reading needs no privileges, changing settings needs `sudo`.',
         '**Stealth mode** makes the Mac ignore probes such as ping and connection attempts to closed ports instead of answering with a refusal, so a scan on the same network learns less. It does not affect connections your Mac starts.',
         'It is not an outbound firewall. To see and control which apps connect *out*, use a tool such as LuLu (free, from Objective-See) or Little Snitch.'],
        flags=[('--getglobalstate', 'is the firewall on?'), ('--setglobalstate on', 'turn it on (sudo)'), ('--getstealthmode / --setstealthmode on', 'check or enable stealth mode'),
               ('--listapps', 'apps with firewall rules and whether they are allowed'), ('--getblockall', 'whether all incoming connections are blocked')],
        examples=[('ex', 'Turn the firewall and stealth mode on', 'sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on\nsudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on'),
                  ('pipe', 'Show only apps that are allowed incoming connections', "/usr/libexec/ApplicationFirewall/socketfilterfw --listapps | grep -B1 'Allow incoming'")],
        gotchas=['Signed apps can be allowed automatically; check the "automatically allow" settings under System Settings, Network, Firewall, Options if you want a prompt for everything.'],
        see=['lsof', 'nmap'], tags=['firewall']),
    CMD('fdesetup', 'sec-mac', 'mac', 'Check and manage FileVault full-disk encryption.',
        'fdesetup status | list | isactive | validaterecovery',
        ['FileVault encrypts the whole startup volume with AES-XTS using keys protected by the Secure Enclave on Apple silicon. With it on, a powered-off Mac is a brick of ciphertext to a thief. `fdesetup status` reports the state, including progress while encryption is still running.',
         'Enabling it creates a **recovery key**. Store it in a password manager, not on the Mac it unlocks. `sudo fdesetup validaterecovery` checks that the key you saved is the right one.'],
        flags=[('status', 'On, Off, or encryption progress'), ('list', 'users who can unlock the disk (sudo)'), ('validaterecovery', 'prompt for the recovery key and verify it (sudo)')],
        examples=[('ex', 'Is the disk encrypted?', 'fdesetup status'), ('ex', 'Prove your saved recovery key works', 'sudo fdesetup validaterecovery')],
        gotchas=['FileVault protects data at rest only. Once you are logged in, malware running as you can read your files like you can.'],
        see=['csrutil', 'security'], tags=['encryption']),
    CMD('spctl', 'sec-mac', 'mac', 'Query Gatekeeper: is it on, and would it let this app run?',
        'spctl --status        spctl --assess -vv PATH',
        ['Gatekeeper checks apps on first launch: that they are signed by an identified developer and **notarized**, scanned by Apple and given a ticket. `spctl --assess` runs the same check on demand and says which source vouched for the app.',
         'Apps downloaded through a browser carry a `com.apple.quarantine` extended attribute (`xattr -l APP` shows it). That attribute is what triggers the first-launch check. Removing it with `xattr -d` skips Gatekeeper, which is exactly why attackers ask victims to do it.'],
        flags=[('--status', 'assessments enabled or disabled'), ('--assess -vv PATH', 'check an app and print the verdict and source'), ('--assess --type install PKG', 'check an installer package')],
        examples=[('ex', 'Would Gatekeeper accept this app?', 'spctl --assess -vv /Applications/Safari.app'),
                  ('pipe', 'Check every app in /Applications and show only rejections', 'for a in /Applications/*.app; do spctl --assess "$a" 2>&1 | grep -v "^$" ; done | grep rejected')],
        gotchas=['Any instruction to run `xattr -cr` on a downloaded app, or to disable Gatekeeper with `spctl --master-disable`, should be treated as an attack until proven otherwise.'],
        see=['codesign', 'xattr'], tags=['gatekeeper']),
    CMD('codesign', 'sec-mac', 'mac', 'Show and verify the code signature of an app or binary.',
        'codesign -dv --verbose=4 PATH        codesign --verify --deep --strict -v PATH',
        ['Every app that runs on macOS is signed. `codesign -dv` prints who signed it (the `Authority` chain and `TeamIdentifier`), whether the hardened runtime is on, and other details. Use it to answer "who really made this?" before trusting a binary, and to spot an app whose signature does not match its claimed publisher.',
         '`--verify` checks that nothing in the bundle changed since it was signed. A failure means the app was modified after the developer shipped it.'],
        flags=[('-dv --verbose=4', 'display signature details'), ('--verify --deep --strict -v', 'verify the signature of a bundle and everything inside it'), ('-d --entitlements -', 'print the app\'s entitlements (the special permissions it requested)')],
        examples=[('ex', 'Who signed this app?', 'codesign -dv --verbose=4 /Applications/Safari.app 2>&1 | grep -E "Authority|TeamIdentifier"'),
                  ('pipe', 'List the team ID of every app in /Applications', 'for a in /Applications/*.app; do printf "%-40s %s\\n" "${a:t}" "$(codesign -dv "$a" 2>&1 | sed -n \'s/^TeamIdentifier=//p\')"; done')],
        see=['spctl'], tags=['signatures']),

    H2('Audit your Mac in one command', 'audit'),
    P('''Collect the checks into a script you can run whenever you like. It only reads; it changes nothing. Save it as `~/lab/audit_mac.zsh`,
    make it executable with `chmod +x`, and run it now to see your own baseline.'''),
    FILE('audit_mac.zsh', AUDIT),
    P('''Read the output section by section. Protections should all be on. The administrators list should contain only people who need it;
    consider a separate admin account and a standard account for daily use. Every listening port should belong to something you can name.
    Every launch agent and daemon should belong to software you installed on purpose: that list is where most Mac malware hides, because a
    `RunAtLoad` agent survives every reboot. `(N)` after the glob is zsh's "no error if empty" qualifier.'''),
    CALLOUT('tip', 'Free tools from Objective-See', '''Patrick Wardle's free tools are the standard companions for this audit: **KnockKnock** lists everything that persists on a Mac,
    **BlockBlock** alerts when something new installs itself persistently, and **LuLu** is an outbound firewall. Install them from
    objective-see.org, and compare what KnockKnock shows with your script's persistence section.'''),
    EX('defend-ex-persistence-diff', 'What changed since the baseline?', 'py',
       '''`BEFORE` and `AFTER` are two snapshots of persistence items (one per line, as your audit script prints them). Write
       `changes(before, after)` that returns a dictionary with two sorted lists: `"added"` (items in `after` but not `before`) and
       `"removed"` (the reverse). Ignore blank lines and surrounding spaces. Print the added items, one per line, prefixed with `+ `.''',
       '''
       BEFORE = """/Library/LaunchDaemons  com.docker.vmnetd.plist
       /Library/LaunchAgents  com.google.keystone.agent.plist
       ~/Library/LaunchAgents  homebrew.mxcl.postgresql@17.plist
       """
       AFTER = """/Library/LaunchDaemons  com.docker.vmnetd.plist
       ~/Library/LaunchAgents  com.apple.updater.plist
       ~/Library/LaunchAgents  homebrew.mxcl.postgresql@17.plist

       """

       def items(text):
           return {line.strip() for line in text.splitlines() if line.strip()}

       def changes(before, after):
           b, a = items(before), items(after)
           return {"added": sorted(a - b), "removed": sorted(b - a)}

       for item in changes(BEFORE, AFTER)["added"]:
           print("+ " + item)
       ''',
       hints=['Turn each snapshot into a `set` of non-empty, stripped lines.', 'Set difference `a - b` gives what is only in `a`.'],
       why='''A baseline turns "is anything wrong?", which is hard, into "what changed?", which is easy. A new agent with an Apple-looking
       name in your *user* LaunchAgents folder is exactly the pattern the triage drill below flags. File integrity monitors and EDR products
       are this idea applied to thousands of locations at once.''',
       starter='''
       BEFORE = """/Library/LaunchDaemons  com.docker.vmnetd.plist
       /Library/LaunchAgents  com.google.keystone.agent.plist
       ~/Library/LaunchAgents  homebrew.mxcl.postgresql@17.plist
       """
       AFTER = """/Library/LaunchDaemons  com.docker.vmnetd.plist
       ~/Library/LaunchAgents  com.apple.updater.plist
       ~/Library/LaunchAgents  homebrew.mxcl.postgresql@17.plist

       """

       def changes(before, after):
           return {"added": [], "removed": []}

       for item in changes(BEFORE, AFTER)["added"]:
           print("+ " + item)
       ''',
       check='''
       r = changes(BEFORE, AFTER)
       assert r["added"] == ["~/Library/LaunchAgents  com.apple.updater.plist"], "added is wrong: " + repr(r["added"])
       assert r["removed"] == ["/Library/LaunchAgents  com.google.keystone.agent.plist"], "removed is wrong: " + repr(r["removed"])
       assert changes("a\\n b \\n", "b\\n\\n a") == {"added": [], "removed": []}, "Ignore blank lines and surrounding spaces"
       assert "+ ~/Library/LaunchAgents  com.apple.updater.plist" in out, "Print the added items with a + prefix"
       '''),

    H2('Hardening and watching a Linux server', 'linux'),
    P('''The Server Basics chapter covered the first fifteen minutes: updates, a personal user, SSH keys only, a firewall. Here is what to
    add for a server that faces the internet, and how to watch it afterwards.'''),
    OL('**Ban repeat offenders** with fail2ban: it reads the SSH log and firewalls addresses that fail too often. `sudo apt install fail2ban`, then enable the `sshd` jail.',
       '**Remove what you do not use.** `sudo ss -ltnp` lists every listening service; uninstall or disable each one you cannot justify.',
       '**Look for files that run as root.** `sudo find / -xdev -perm -4000 -type f 2>/dev/null` lists setuid programs. Compare with a fresh install; an unfamiliar one in `/tmp` or a home directory is a red flag.',
       '**Audit the configuration** with Lynis (`sudo apt install lynis`, then `sudo lynis audit system`). It checks hundreds of settings and prints a hardening index with suggestions.',
       '**Keep logs, and look at them**: `journalctl` for services, `/var/log/auth.log` (or `journalctl -u ssh`) for logins, `last` for sessions.'),
    FILE('/etc/fail2ban/jail.local', '''
    [DEFAULT]
    bantime  = 1h
    findtime = 10m
    maxretry = 5
    # never ban your own network
    ignoreip = 127.0.0.1/8 ::1 192.168.1.0/24

    [sshd]
    enabled = true
    # Debian 12+ and Ubuntu log sshd to the journal, not a file
    backend = systemd
    '''),
    CMD('fail2ban-client', 'sec-linux', 'linux', 'Control fail2ban: see which jails run, who is banned, and unban addresses.',
        'sudo fail2ban-client status [JAIL]        sudo fail2ban-client set JAIL unbanip IP',
        ['fail2ban watches log files or the systemd journal for patterns such as failed SSH logins. When an address matches `maxretry` times within `findtime`, it adds a firewall rule that blocks the address for `bantime`. Each service it protects is a **jail**.',
         'It reduces noise and slows down password guessing, but it is not a substitute for key-only SSH: a single correct guess is still a compromise.'],
        flags=[('status', 'list active jails'), ('status sshd', 'failed and banned counts and the banned IP list for one jail'), ('set sshd unbanip IP', 'remove a ban'), ('reload', 're-read the configuration')],
        examples=[('ex', 'Who is banned from SSH right now?', 'sudo fail2ban-client status sshd'),
                  ('pipe', 'Count banned addresses', "sudo fail2ban-client status sshd | sed -n 's/.*Banned IP list:\\s*//p' | wc -w")],
        gotchas=['Put your own network in `ignoreip`, or a few mistyped passwords can lock you out of your own server.'],
        see=['journalctl', 'ufw'], tags=['linux', 'ssh']),
    CMD('last', 'sec-audit', 'all', 'List recent logins and reboots from the login records.',
        'last [-n N] [USER]        sudo lastb (Linux: failed logins)',
        ['`last` reads the system\'s record of sessions and prints who logged in, from where, when, and for how long, newest first. Reboots appear as the pseudo-user `reboot`. On Linux, `sudo lastb` shows failed login attempts from `/var/log/btmp`.',
         'On a server, a login from an address or at a time you do not recognise is the single most important line you can find. On recent Linux distributions that no longer keep these files, use `journalctl -u ssh` instead.'],
        flags=[('-n N', 'only the N most recent entries'), ('USER', 'only that user'), ('-i', 'show IP addresses instead of host names (Linux)')],
        examples=[('ex', 'The last ten sessions', 'last -n 10'),
                  ('pipe', 'Which addresses logged in, and how often (Linux)', "last -i | awk '$3 ~ /^[0-9]/ {print $3}' | sort | uniq -c | sort -rn")],
        see=['journalctl', 'who'], tags=['logins']),
    CMD('lynis', 'sec-audit', 'all', 'Audit the security configuration of a Linux (or macOS) system and suggest hardening steps.',
        'sudo lynis audit system [--quick]',
        ['Lynis, an open-source tool from CISOfy, runs hundreds of read-only checks: SSH settings, file permissions, kernel parameters, installed software, logging, firewall. It prints warnings and suggestions with test IDs you can look up, and a hardening index at the end.',
         'Run it after setting up a server, fix what makes sense for your threat model, and run it again: the index going up is a satisfying, measurable result.'],
        flags=[('audit system', 'run the full audit'), ('--quick', 'do not pause between sections'), ('show details TEST-ID', 'explain one finding')],
        examples=[('ex', 'Audit this machine', 'sudo lynis audit system --quick'),
                  ('pipe', 'Just the warnings and the score', "sudo lynis audit system --quick 2>/dev/null | grep -E 'Warning|Hardening index'")],
        see=['ufw', 'fail2ban-client'], tags=['linux', 'audit']),

    H2('Triage: reading logs like an analyst', 'triage'),
    P('''Most of a defender's day is triage: a line appears, and you decide in seconds whether it is normal, background noise, or the
    start of an incident. The trick is to know what normal looks like on your own systems, and to read the one detail that changes the
    meaning: *Accepted* versus *Failed*, your user versus `www-data`, a terminal versus none, a known address versus an unknown one.
    Practise on the drill below; every line is in the exact format the real tool writes.'''),
    WIDGET('triage'),
    P('''Turn the most useful question, "who is trying to log in, and from where?", into a few lines of Python you can point at any
    auth log:'''),
    RUN(r'''
    import re
    from collections import Counter

    AUTH = """Nov 17 03:12:44 pi sshd[2211]: Failed password for invalid user admin from 45.95.147.12 port 51022 ssh2
    Nov 17 03:12:47 pi sshd[2213]: Failed password for invalid user ubuntu from 45.95.147.12 port 51840 ssh2
    Nov 17 03:13:02 pi sshd[2220]: Failed password for root from 45.95.147.12 port 52990 ssh2
    Nov 17 05:40:10 pi sshd[2301]: Failed password for invalid user test from 193.32.162.80 port 40022 ssh2
    Nov 17 08:01:02 pi sshd[3120]: Accepted publickey for learner from 192.168.1.23 port 52211 ssh2: ED25519 SHA256:D3GZu
    Nov 17 09:40:19 pi sshd[3302]: Accepted password for root from 185.220.101.4 port 40112 ssh2"""

    FAILED = re.compile(r"Failed password for (?:invalid user )?(\S+) from (\S+)")
    OK = re.compile(r"Accepted (\S+) for (\S+) from (\S+)")

    fails = Counter(ip for user, ip in FAILED.findall(AUTH))
    print("failed attempts by address:", dict(fails.most_common()))
    for method, user, ip in OK.findall(AUTH):
        flag = "  <-- investigate" if method == "password" or user == "root" else ""
        print(f"login: {user} from {ip} with {method}{flag}")
    '''),
    EX('defend-ex-ssh-attackers-report', 'An SSH attackers report', 'py',
       '''Write `report(log)` that returns a list of `(ip, attempts, usernames)` tuples for every address with **3 or more** failed logins in
       the `AUTH` text, where `usernames` is a sorted list of the distinct usernames that address tried. Sort the list by attempts, highest
       first, then by IP. Print each tuple.''',
       r'''
       import re
       from collections import defaultdict

       AUTH = """Nov 17 03:12:44 pi sshd[2211]: Failed password for invalid user admin from 45.95.147.12 port 51022 ssh2
       Nov 17 03:12:47 pi sshd[2213]: Failed password for invalid user ubuntu from 45.95.147.12 port 51840 ssh2
       Nov 17 03:13:02 pi sshd[2220]: Failed password for root from 45.95.147.12 port 52990 ssh2
       Nov 17 05:40:10 pi sshd[2301]: Failed password for invalid user test from 193.32.162.80 port 40022 ssh2
       Nov 17 05:40:14 pi sshd[2305]: Failed password for invalid user test from 193.32.162.80 port 40100 ssh2
       Nov 17 05:40:19 pi sshd[2309]: Failed password for invalid user oracle from 193.32.162.80 port 40188 ssh2
       Nov 17 08:01:02 pi sshd[3120]: Accepted publickey for learner from 192.168.1.23 port 52211 ssh2
       Nov 17 08:30:00 pi sshd[3150]: Failed password for learner from 192.168.1.23 port 52300 ssh2"""

       FAILED = re.compile(r"Failed password for (?:invalid user )?(\S+) from (\S+)")

       def report(log):
           tries = defaultdict(list)
           for user, ip in FAILED.findall(log):
               tries[ip].append(user)
           rows = [(ip, len(users), sorted(set(users))) for ip, users in tries.items() if len(users) >= 3]
           return sorted(rows, key=lambda r: (-r[1], r[0]))

       for row in report(AUTH):
           print(row)
       ''',
       hints=['The optional group `(?:invalid user )?` matches both "for root" and "for invalid user admin".', 'Sort with `key=lambda r: (-r[1], r[0])`.'],
       why='''This is the core of what fail2ban does, and of the first report any analyst runs on a server. Grouping the usernames shows the
       attacker\'s method: a list like `admin`, `ubuntu`, `oracle` is a dictionary attack against default accounts, while one real username
       tried many times means someone knows who you are.''',
       starter=r'''
       import re
       from collections import defaultdict

       AUTH = """Nov 17 03:12:44 pi sshd[2211]: Failed password for invalid user admin from 45.95.147.12 port 51022 ssh2
       Nov 17 03:12:47 pi sshd[2213]: Failed password for invalid user ubuntu from 45.95.147.12 port 51840 ssh2
       Nov 17 03:13:02 pi sshd[2220]: Failed password for root from 45.95.147.12 port 52990 ssh2
       Nov 17 05:40:10 pi sshd[2301]: Failed password for invalid user test from 193.32.162.80 port 40022 ssh2
       Nov 17 05:40:14 pi sshd[2305]: Failed password for invalid user test from 193.32.162.80 port 40100 ssh2
       Nov 17 05:40:19 pi sshd[2309]: Failed password for invalid user oracle from 193.32.162.80 port 40188 ssh2
       Nov 17 08:01:02 pi sshd[3120]: Accepted publickey for learner from 192.168.1.23 port 52211 ssh2
       Nov 17 08:30:00 pi sshd[3150]: Failed password for learner from 192.168.1.23 port 52300 ssh2"""

       def report(log):
           return []

       for row in report(AUTH):
           print(row)
       ''',
       check='''
       r = report(AUTH)
       assert r == [("193.32.162.80", 3, ["oracle", "test"]), ("45.95.147.12", 3, ["admin", "root", "ubuntu"])], "Got " + repr(r)
       assert all(row[0] != "192.168.1.23" for row in r), "One failed login is below the threshold of 3"
       extra = AUTH + "\\nNov 17 09:00:00 pi sshd[1]: Failed password for root from 45.95.147.12 port 1 ssh2"
       assert report(extra)[0][0] == "45.95.147.12" and report(extra)[0][1] == 4, "Sort by attempts, highest first"
       assert "45.95.147.12" in out, "Print each row"
       '''),

    H2('When something goes wrong: incident response', 'ir'),
    P('''Sooner or later a check will turn red. Panic destroys evidence; a routine does not. The standard phases (from NIST SP 800-61)
    scale from a home lab to a company:'''),
    ASCII('''
      ⟪w:PREPARE⟫ ──▶ ⟪y:DETECT & ANALYSE⟫ ──▶ ⟪r:CONTAIN⟫ ──▶ ⟪r:ERADICATE⟫ ──▶ ⟪g:RECOVER⟫ ──▶ ⟪b:LEARN⟫
      backups,       is it real? what,       stop the       remove the     restore from    what let it
      baselines,     when, how far?          spread         cause and      known-good,     happen? fix
      logs on                                                persistence    watch closely   that first
    '''),
    OL('**Do not power it off yet** if you can avoid it: memory holds running processes and connections. Disconnect the network instead (Wi-Fi off, cable out).',
       '**Write things down** as you go: times, what you saw, what you ran. Your notes are the timeline later.',
       '**Collect before you clean**: the audit script\'s output, `ps aux`, `lsof -i`, the suspicious files (copy them, do not open them), and the relevant logs.',
       '**Contain**: change passwords and revoke keys and tokens *from a different, clean device*, and assume anything typed on the affected machine was seen.',
       '**Eradicate and recover**: for anything beyond a trivial case, rebuild from a clean install and restore data from a backup made before the incident, rather than trying to clean in place.',
       '**Learn**: write down the cause and the one or two changes that would have stopped it, and make them.'),
    EX('defend-ex-first-hour', 'Plan the first hour', 'think',
       '''Your audit script shows a new LaunchAgent `com.apple.updater.plist` in `~/Library/LaunchAgents` that runs `~/.cache/.u/agent`, and
       `lsof` shows that process connected to an unfamiliar address on port 443. List, in order, what you do in the first hour and why.''',
       '''1. Disconnect from the network (Wi-Fi off), but leave the Mac running: stops exfiltration and command and control, keeps evidence in memory.
2. Start notes with the time and what was seen.
3. Collect: the plist, a copy of ~/.cache/.u/agent (zip it, do not run it), ps -o pid,ppid,user,command -p <pid>, lsof -p <pid>, the audit output, and log show --last 24h for the process.
4. Check the binary: codesign -dv and spctl --assess (almost certainly unsigned), and shasum -a 256 to search the hash on a malware database from another device.
5. From a different, clean device: change the passwords of accounts used on this Mac, starting with email and the password manager; revoke SSH keys and API tokens stored on it.
6. Unload and remove the agent (launchctl bootout gui/$(id -u)/com.apple.updater), but plan to back up your data, erase the Mac and reinstall macOS, then restore only data, not apps or settings.
7. Find the entry point (a downloaded app? a pasted Terminal command?) and fix that, so it does not happen again.''',
       hints=['Contain before you clean, and collect before you contain destroys anything.', 'Assume credentials typed on the machine are stolen.'],
       why='''The order protects two things: your other accounts (contain quickly, from a clean device) and your ability to understand
       what happened (collect before deleting). Rebuilding instead of cleaning is standard practice, because you can never be sure you found
       every piece of a compromise.'''),

    CHECK('defend-ch-defence-checkpoint', 'Defence checkpoint',
          Q('A stolen laptop is powered off. Which protection keeps the thief from reading its files?', [('The firewall', False), ('Gatekeeper', False), ('FileVault', True), ('System Integrity Protection', False)],
            'Only full-disk encryption protects data at rest. The others act while the system is running.'),
          Q('Why do attackers often tell victims to run `xattr -cr` on a downloaded app?', [('It speeds the app up', False), ('It removes the quarantine attribute, so Gatekeeper never checks the app', True), ('It repairs a damaged download', False), ('It installs updates', False)],
            'The quarantine attribute triggers the first-launch check. Removing it skips signing and notarization verification.'),
          Q('Where does most persistent macOS malware install itself?', [('In the Dock', False), ('As a LaunchAgent or LaunchDaemon plist', True), ('In Safari bookmarks', False), ('In /System', False)],
            'Launch agents and daemons run at login or boot. SIP keeps /System read-only, so attackers use the Library folders.'),
          Q('`auth.log` shows `Accepted password for root from` an unknown internet address. The right reaction?', [('Ignore it; it was accepted, so it was allowed', False), ('Treat the machine as compromised: isolate, collect, rotate credentials, rebuild', True), ('Add the address to fail2ban and carry on', False), ('Reboot the server', False)],
            'A successful root login with a password from an unknown address is an incident, not noise. Root should not even accept passwords.'),
          Q('What is the main value of a baseline snapshot?', [('It removes malware', False), ('It turns "is anything wrong?" into "what changed?"', True), ('It speeds up the Mac', False), ('It replaces backups', False)],
            'Comparing against known-good state makes new persistence, ports or admins stand out immediately.'),
          Q('In incident response, why change passwords from a different device?', [('It is faster', False), ('Anything typed on the compromised machine may be captured', True), ('Websites require it', False), ('It is not necessary', False)],
            'A keylogger or session stealer on the affected machine would capture the new passwords as you type them.')),

    PROJECT('defend-pr-baseline', 'baseline: notice when your Mac changes', 'intermediate', 50,
            ['zsh', 'launchd', 'diffing', 'notifications'],
            P('''Turn `audit_mac.zsh` into a daily early-warning system. Each day it takes a snapshot, compares it with the last known-good one,
            and tells you only when something changed. It is a small version of what endpoint security products do.'''),
            H3('1. Snapshots'),
            P('''Make the audit script write its output to `~/lab/baseline/YYYY-MM-DD.txt`. Remove anything that changes every run (the date line,
            update lists) so that two snapshots of an unchanged Mac are identical.'''),
            H3('2. Compare'),
            P('''Write `compare.zsh` that diffs today\'s snapshot with `~/lab/baseline/known-good.txt` using `diff -u`, and prints nothing if they
            match. Use your `changes()` function from this chapter if you prefer Python.'''),
            H3('3. Notify'),
            P('''When there is a difference, show a notification with `osascript -e 'display notification "baseline changed" with title "audit"'`
            and keep the diff in `~/lab/baseline/alerts/`. Review it; if the change was yours (you installed something), copy today\'s snapshot over
            `known-good.txt` to accept it.'''),
            H3('4. Schedule'),
            P('Run it once a day with a LaunchAgent that uses `StartCalendarInterval` (hour 9, minute 0), the plist format from Server Basics.'),
            H3('5. Stretch goals'),
            UL('Add the SHA-256 of `/etc/hosts`, `~/.zshrc` and `~/.ssh/authorized_keys` to the snapshot.', 'Run the same idea on your Raspberry Pi with a systemd timer, adding `ss -ltnp` and the list of users with a login shell.', 'Send the diff to your phone with the signed webhook from the APIs chapter.')),
]

terms = [
    ('threat model', 'a description of what you protect, from whom, and how they could get in, used to choose defences'),
    ('attack surface', 'everything an attacker can try to interact with: open ports, software, accounts, people'),
    ('MITRE ATT&CK', 'a public catalogue of real attacker tactics and techniques, used as a shared defensive vocabulary'),
    ('persistence', 'how an attacker makes their access survive reboots and logouts, such as a launch agent or cron job'),
    ('Gatekeeper', 'the macOS check that apps are signed and notarized before they first run'),
    ('notarization', 'Apple scanning a developer\'s software and issuing a ticket that Gatekeeper checks'),
    ('SIP', 'System Integrity Protection: prevents even root from modifying protected parts of macOS'),
    ('FileVault', 'macOS full-disk encryption of the startup volume'),
    ('baseline', 'a known-good snapshot of a system\'s state, compared against later to spot changes'),
    ('fail2ban', 'a service that bans addresses after repeated failures found in logs'),
    ('incident response', 'the routine for handling a security event: prepare, detect, contain, eradicate, recover, learn'),
]

CHAPTER = chapter('defend', 'Defending Your Mac and Servers',
                  'Think in threats, check every macOS protection from Terminal, audit and baseline your machine, harden Linux servers, triage logs and respond to incidents',
                  'wireshark', 110,
                  ['Describe an attack in ATT&CK stages and choose controls from a simple threat model',
                   'Check FileVault, SIP, Gatekeeper, the firewall and code signatures from Terminal',
                   'Audit a Mac for persistence, listening services and administrators, and detect changes against a baseline',
                   'Harden and watch an internet-facing Linux server with fail2ban, Lynis and its logs',
                   'Triage log lines quickly, and follow an incident-response routine without destroying evidence'],
                  blocks, terms, part='sec', file='43-defend.gm')
