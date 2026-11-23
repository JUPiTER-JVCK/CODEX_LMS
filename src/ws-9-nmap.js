/* Security part, "Nmap" chapter. Five widgets:
   nmexplain  type or pick an nmap command: which phases run, what each flag does, who must be root, how many probes
   nmscan     step through one probe and the reply for every scan type and port condition
   nmdisc     how nmap decides a host is up: ARP, ICMP, TCP, depending on who you are and where the target is
   nmmatrix   a scan of a home network as a host-by-port exposure map, with the risk and the fix for each open port
   nmnse      the NSE script categories, with real counts, risk and examples
   Colours come from CSS classes in src/nmap.add.css so every picture follows the light and dark themes. */
(function () {
  'use strict';
  if (!window.__core) return;
  var K = window.__core, $ = K.$, $$ = K.$$, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};

  function wrap(title, sub, cls) {
    var r = h('div', { class: 'wg nm ' + (cls || '') });
    r.innerHTML = '<h4>' + esc(title) + '</h4>' + (sub ? '<p class="sub">' + sub + '</p>' : '');
    return r;
  }
  function chips(items, cur, attr) {
    return items.map(function (it) {
      return '<button type="button" class="chip' + (it[0] === cur ? ' on' : '') + '" ' + attr + '="' + esc(it[0]) + '" aria-pressed="' + (it[0] === cur ? 'true' : 'false') + '">' + esc(it[1]) + '</button>';
    }).join('');
  }

  /* ================= nmexplain ================= */
  var PHASES = [
    ['pre', 'Script pre-scan', 'Scripts that must run before the scan, such as broadcast discovery.'],
    ['enum', 'Target enumeration', 'Turns names, ranges and CIDR blocks into a list of addresses, minus anything excluded.'],
    ['disc', 'Host discovery', 'Which of those addresses answer? Hosts that do not are skipped, which saves most of the time on a big range.'],
    ['rdns', 'Reverse DNS', 'Looks up a name for each live host. Slow on some networks, so -n turns it off.'],
    ['port', 'Port scan', 'The main event: probe each chosen port and classify the reply.'],
    ['vers', 'Version detection', 'Talk to the open ports and read banners to name the software and version.'],
    ['os', 'OS detection', 'Send a set of odd packets and compare the TCP/IP stack’s behaviour with a database.'],
    ['trace', 'Traceroute', 'Find the path to the host, reusing what the scan learned to be fast.'],
    ['nse', 'Script scan', 'Run Lua scripts from the Nmap Scripting Engine against hosts and ports.'],
    ['out', 'Output', 'Write the results as text, grepable text and XML.'],
    ['post', 'Script post-scan', 'Scripts that summarise across all hosts, after everything else.']
  ];
  // flag: [meaning, phase, needs root (true), argument kind]
  var OPT = {
    '-sS': ['TCP SYN scan: send a SYN, read the reply, never finish the handshake. The default when you are root.', 'port', true],
    '-sT': ['TCP connect scan: ask the operating system to connect(). The default without root; completes the handshake, so services log it.', 'port', false],
    '-sU': ['UDP scan: send UDP datagrams and listen for answers or ICMP errors. Slow, because silence is ambiguous.', 'port', true],
    '-sA': ['TCP ACK scan: maps firewall rules (filtered or not) but cannot tell open from closed.', 'port', true],
    '-sF': ['TCP FIN scan: a stray FIN; closed ports answer RST, open ports stay silent.', 'port', true],
    '-sN': ['TCP NULL scan: no flags set at all; same logic as FIN.', 'port', true],
    '-sX': ['TCP Xmas scan: FIN, PSH and URG set (“lit up like a tree”); same logic as FIN.', 'port', true],
    '-sW': ['TCP Window scan: like ACK, but reads the window field of the RST to guess open or closed.', 'port', true],
    '-sM': ['TCP Maimon scan: a FIN/ACK probe; only some BSD-derived stacks behave as it expects.', 'port', true],
    '-sO': ['IP protocol scan: which IP protocols (ICMP, TCP, UDP, GRE, ESP…) the host supports, not ports.', 'port', true],
    '-sI': ['Idle (zombie) scan: bounce the probe off a third host so the target never sees your address.', 'port', true, 1],
    '-sn': ['Ping scan: host discovery only, no port scan. Formerly -sP.', 'disc', false],
    '-sL': ['List scan: only list the targets and their names; sends no probes to them at all.', 'enum', false],
    '-sV': ['Service and version detection on the open ports.', 'vers', false],
    '-sC': ['Run the default NSE scripts (same as --script=default).', 'nse', false],
    '-O': ['OS detection by TCP/IP fingerprinting. Works best with one open and one closed TCP port.', 'os', true],
    '-A': ['Aggressive: -sV, -O, -sC and --traceroute together. Loud; only on machines you own.', 'vers', true],
    '-Pn': ['Skip host discovery: treat every address as up. Use it when a host blocks the probes but is there.', 'disc', false],
    '-PE': ['Host discovery with ICMP echo request (an ordinary ping).', 'disc', true],
    '-PP': ['Host discovery with ICMP timestamp request.', 'disc', true],
    '-PM': ['Host discovery with ICMP address-mask request.', 'disc', true],
    '-PR': ['Host discovery with ARP (local Ethernet only). Cannot be blocked by a host firewall.', 'disc', true],
    '-n': ['Never do reverse DNS: faster and quieter.', 'rdns', false],
    '-R': ['Always do reverse DNS, even for hosts that look down.', 'rdns', false],
    '-F': ['Fast: scan the 100 most common ports instead of the default 1000.', 'port', false],
    '-r': ['Scan ports in order instead of randomising them.', 'port', false],
    '-v': ['More progress and detail (repeat for more: -vv).', 'out', false],
    '-vv': ['Even more detail.', 'out', false],
    '-d': ['Debugging output.', 'out', false],
    '--open': ['Show only hosts and ports that are open (or possibly open).', 'out', false],
    '--reason': ['Show why each port got its state: syn-ack, reset, no-response…', 'out', false],
    '--traceroute': ['Trace the path to each host after the scan.', 'trace', true],
    '--packet-trace': ['Print every packet sent and received: the best way to learn what a scan really does.', 'out', false],
    '--osscan-guess': ['Guess the OS more aggressively when there is no perfect match.', 'os', false],
    '--osscan-limit': ['Skip OS detection for hosts that lack an open and a closed port.', 'os', false],
    '--version-light': ['Version detection at intensity 2: only the most likely probes.', 'vers', false],
    '--version-all': ['Version detection at intensity 9: every probe.', 'vers', false],
    '--randomize-hosts': ['Shuffle the target order, so a run of sequential addresses is less obvious.', 'enum', false],
    '--send-eth': ['Send raw Ethernet frames instead of IP packets.', 'port', true],
    '--send-ip': ['Send raw IP packets even on a local Ethernet (skip ARP-based discovery).', 'port', true],
    '--privileged': ['Assume you have raw-socket privileges.', 'port', false],
    '--unprivileged': ['Assume you do not have raw-socket privileges.', 'port', false],
    '--system-dns': ['Use the operating system’s resolver instead of nmap’s own parallel one.', 'rdns', false],
    '--append-output': ['Append to output files instead of overwriting them.', 'out', false],
    '--badsum': ['Send packets with a wrong checksum: real stacks drop them, so only firewalls or IDS that do not check reveal themselves.', 'port', true],
    '-f': ['Fragment the probe packets into 8-byte pieces. For testing whether your firewall reassembles.', 'port', true],
    '-6': ['Scan IPv6 targets.', 'enum', false],
    '-p': ['Which ports to scan: 22,80,443 or 1-1024 or -p- for all 65535, with T: and U: prefixes for TCP and UDP.', 'port', false, 1],
    '--top-ports': ['Scan the N most frequently open ports.', 'port', false, 1],
    '--exclude': ['Hosts to leave out of the target list.', 'enum', false, 1],
    '--excludefile': ['A file of hosts to leave out.', 'enum', false, 1],
    '-iL': ['Read the targets from a file, one per line.', 'enum', false, 1],
    '-iR': ['Choose random Internet hosts. Never do this: they are not yours.', 'enum', false, 1],
    '--script': ['Which NSE scripts, categories or patterns to run.', 'nse', false, 1],
    '--script-args': ['Arguments passed to the scripts.', 'nse', false, 1],
    '-oN': ['Write normal (human) output to a file.', 'out', false, 1],
    '-oX': ['Write XML output to a file: the format programs should read.', 'out', false, 1],
    '-oG': ['Write greppable output to a file (deprecated but still handy).', 'out', false, 1],
    '-oA': ['Write all three formats at once: BASE.nmap, BASE.gnmap and BASE.xml.', 'out', false, 1],
    '-oS': ['Script-kiddie output. A joke; do not use it.', 'out', false, 1],
    '--max-rate': ['Never send more than N packets per second.', 'port', false, 1],
    '--min-rate': ['Always send at least N packets per second.', 'port', false, 1],
    '--max-retries': ['How many times to retransmit an unanswered probe.', 'port', false, 1],
    '--host-timeout': ['Give up on a host after this long.', 'port', false, 1],
    '--scan-delay': ['Wait at least this long between probes to one host.', 'port', false, 1],
    '--max-scan-delay': ['The longest nmap may wait between probes.', 'port', false, 1],
    '--version-intensity': ['How hard version detection tries, 0 to 9 (default 7).', 'vers', false, 1],
    '-e': ['Use this network interface.', 'port', false, 1],
    '-S': ['Spoof the source address of the probes (replies will not reach you).', 'port', true, 1],
    '-D': ['Decoys: mix your probes with probes from fake source addresses, for testing whether logs and an IDS can still pick you out.', 'port', true, 1],
    '-g': ['Use this source port for the probes (tests firewall rules that trust DNS or FTP-data).', 'port', true, 1],
    '--source-port': ['Same as -g.', 'port', true, 1],
    '--data-length': ['Append random data to probes.', 'port', true, 1],
    '--mtu': ['Fragment probes to this size (a multiple of 8).', 'port', true, 1],
    '--dns-servers': ['Use these DNS servers for reverse lookups.', 'rdns', false, 1],
    '--ttl': ['Set the IP time-to-live of the probes.', 'port', true, 1],
    '--spoof-mac': ['Use a fake source MAC address on local probes.', 'port', true, 1],
    '--min-parallelism': ['Minimum number of probes in flight at once.', 'port', false, 1],
    '--max-parallelism': ['Maximum number of probes in flight at once.', 'port', false, 1],
    '--min-hostgroup': ['Smallest group of hosts scanned in parallel.', 'port', false, 1],
    '--max-hostgroup': ['Largest group of hosts scanned in parallel.', 'port', false, 1],
    '--initial-rtt-timeout': ['First guess for the round-trip time.', 'port', false, 1],
    '--max-rtt-timeout': ['Longest to wait for a reply to one probe.', 'port', false, 1],
    '--min-rtt-timeout': ['Shortest wait for a reply to one probe.', 'port', false, 1],
    '--script-timeout': ['Give up on a script after this long.', 'nse', false, 1],
    '--stylesheet': ['XSL stylesheet to reference from XML output.', 'out', false, 1],
    '--datadir': ['Where nmap looks for its data files.', 'out', false, 1],
    '--resume': ['Resume an interrupted scan from its log file.', 'out', false, 1]
  };
  var TIMING = { 0: ['paranoid', 'one probe at a time, 5 minutes apart'], 1: ['sneaky', 'one probe at a time, 15 seconds apart'], 2: ['polite', 'one probe at a time, 0.4 seconds apart'], 3: ['normal', 'the default: adapts to the network'], 4: ['aggressive', 'faster, assumes a fast and reliable network'], 5: ['insane', 'fastest, gives up quickly: loses results on slow networks'] };
  var SERIAL = { 0: 300, 1: 15, 2: 0.4 };

  function tokenize(s) {
    var out = [], re = /"([^"]*)"|'([^']*)'|(\S+)/g, m;
    while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
    return out;
  }
  function countTarget(t) {
    var m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(t);
    if (m) { var n = +m[2]; return n <= 32 ? Math.pow(2, 32 - n) : 1; }
    if (/^[\d.,*\-]+$/.test(t) && t.split('.').length === 4) {
      var c = 1; t.split('.').forEach(function (o) {
        if (o === '*') c *= 256;
        else if (/^\d+-\d+$/.test(o)) { var p = o.split('-'); c *= Math.max(1, +p[1] - +p[0] + 1); }
        else if (o.indexOf(',') >= 0) c *= o.split(',').length;
      }); return c;
    }
    return 1;
  }
  function scope(t) {
    var base = t.split('/')[0], m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)/.exec(base);
    if (!m) return 'name';
    var a = +m[1], b = +m[2];
    if (a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)) return 'private';
    return 'public';
  }
  function portCount(spec) {
    if (spec === '-') return 65535;
    var n = 0;
    spec.split(',').forEach(function (p) {
      p = p.replace(/^[TUS]:/i, '');
      if (!p) return;
      var m = /^(\d+)-(\d+)$/.exec(p);
      if (m) n += Math.max(0, +m[2] - +m[1] + 1); else if (/^\d+$/.test(p)) n += 1; else n += 1;
    });
    return n;
  }
  function analyse(cmd) {
    var tk = tokenize(cmd.trim()), rows = [], A = { targets: [], root: [], warn: [], ports: 1000, portNote: 'the 1000 most common (default)', scan: null, tm: null, flags: {}, hosts: 0, unknown: 0 };
    var i = 0;
    if (tk[i] === 'sudo') { A.sudo = true; rows.push(['sudo', 'Run as root. Needed for raw packets: SYN, UDP and OS-detection scans, and ARP discovery.', 'port', false]); i++; }
    if (tk[i] === 'nmap') i++;
    for (; i < tk.length; i++) {
      var t = tk[i], k = t, val = null, e = null;
      if (/^-T[0-5]$/.test(t)) { var n = +t[2]; A.tm = n; rows.push([t, 'Timing template ' + n + ', “' + TIMING[n][0] + '”: ' + TIMING[n][1] + '.', 'port', false]); continue; }
      if (/^-T/.test(t)) { rows.push([t, 'Timing templates are -T0 to -T5 (or paranoid, sneaky, polite, normal, aggressive, insane).', 'port', false, 'unk']); A.unknown++; continue; }
      if (/^-P[SAUY]/.test(t) && t.length >= 3) {
        var pk = t.slice(0, 3), kinds = { S: 'a TCP SYN', A: 'a TCP ACK', U: 'a UDP', Y: 'an SCTP INIT' };
        rows.push([t, 'Host discovery with ' + kinds[pk[2]] + ' probe' + (t.length > 3 ? ' to port ' + t.slice(3) : ' to the default port') + '.', 'disc', pk[2] !== 'S']); A.flags.probe = true;
        if (pk[2] !== 'S') A.root.push(t);
        continue;
      }
      if (/^--[a-z\-]+=/.test(t)) { k = t.split('=')[0]; val = t.slice(k.length + 1); }
      else if (/^-p./.test(t) && t !== '-p-') { k = '-p'; val = t.slice(2); }
      else if (t === '-p-') { k = '-p'; val = '-'; }
      else if (/^-o[NXGAS]./.test(t)) { k = t.slice(0, 3); val = t.slice(3); }
      e = OPT[k];
      if (!e) {
        if (t[0] === '-') { rows.push([t, 'Not in this explainer. Check man nmap.', 'port', false, 'unk']); A.unknown++; }
        else { A.targets.push(t); }
        continue;
      }
      if (e[3] && val === null) { val = tk[i + 1]; if (val === undefined || (val[0] === '-' && k !== '-p')) { val = ''; } else i++; }
      var label = t + (val !== null && k === t && val ? ' ' + val : '');
      rows.push([label, e[0] + (val ? ' (' + val + ')' : ''), e[1], !!e[2]]);
      if (e[2]) A.root.push(k);
      A.flags[k] = val === null ? true : val;
      if (/^-s[STUAFNXWMOI]$/.test(k) && k !== '-sn' && k !== '-sL' && k !== '-sV' && k !== '-sC') A.scan = k;
    }
    if (A.flags['-p'] !== undefined) { A.ports = portCount(A.flags['-p']); A.portNote = A.flags['-p'] === '-' ? 'all 65535' : 'the ports you listed'; }
    else if (A.flags['--top-ports']) { A.ports = +A.flags['--top-ports'] || 0; A.portNote = 'the ' + A.ports + ' most common'; }
    else if (A.flags['-F']) { A.ports = 100; A.portNote = 'the 100 most common'; }
    A.hosts = A.flags['-iL'] ? 0 : A.targets.reduce(function (s, t) { return s + countTarget(t); }, 0);
    var fl = A.flags;
    var run = {}, sn = !!fl['-sn'], sL = !!fl['-sL'], ver = !!(fl['-sV'] || fl['-A']), os = !!(fl['-O'] || fl['-A']), tr = !!(fl['--traceroute'] || fl['-A']), nse = !!(fl['-sC'] || fl['--script'] || fl['-A']);
    var port = !sn && !sL;
    run.pre = nse ? 'maybe' : 'off'; run.enum = 'on'; run.disc = (fl['-Pn'] || sL) ? 'off' : 'on'; run.rdns = fl['-n'] ? 'off' : 'on';
    run.port = port ? 'on' : 'off'; run.vers = ver && port ? 'on' : 'off'; run.os = os && port ? 'on' : 'off'; run.trace = tr && !sL ? 'on' : 'off';
    run.nse = nse && !sL ? 'on' : 'off'; run.out = 'on'; run.post = nse && !sL ? 'maybe' : 'off';
    A.run = run; A.sn = sn; A.sL = sL;
    // scan type that will actually run
    if (port) A.eff = A.scan || (A.sudo ? '-sS' : '-sT');
    // warnings
    var pub = A.targets.filter(function (t) { return scope(t) !== 'private'; });
    A.pub = pub;
    if (!A.targets.length && !fl['-iL'] && !fl['-iR']) A.warn.push('No target given.');
    if (fl['-iR']) A.warn.push('<b>-iR</b> picks random hosts on the Internet. Scanning machines that are not yours can break the law and the rules of your network. Do not.');
    var sc = String(fl['--script'] || '');
    if (/\b(vuln|exploit|brute|dos|intrusive|fuzzer|malware)\b/.test(sc)) A.warn.push('The script selection includes risky categories (' + esc(sc) + '). Intrusive, brute-force and DoS scripts can lock accounts or crash services: only with written permission, and never on production.');
    if (fl['-A']) A.warn.push('<b>-A</b> runs OS detection, version detection, default scripts and traceroute together: far more traffic and more chance of upsetting fragile devices such as printers and older IoT gear.');
    if (A.tm === 5) A.warn.push('<b>-T5</b> can overrun slow links and fragile devices and miss open ports: results are less reliable, not just faster.');
    if (A.tm === 0 || A.tm === 1) A.warn.push('<b>-T' + A.tm + '</b> is serialised and very slow; it only makes sense for IDS-evasion testing and costs hours.');
    if (A.hosts > 65536) A.warn.push('That is ' + A.hosts.toLocaleString() + ' addresses. A /16 or larger is almost never what you meant on a home or lab network.');
    if (A.root.length && !A.sudo) A.warn.push('Needs root for: <code>' + esc(A.root.filter(function (x, j, a) { return a.indexOf(x) === j; }).join(' ')) + '</code>. Without <code>sudo</code> nmap warns and falls back to what it can do unprivileged (for example a connect scan), or stops.');
    return { rows: rows, A: A, tk: tk };
  }
  function fmtDur(s) {
    if (s < 90) return Math.round(s) + ' seconds';
    if (s < 5400) return (s / 60).toFixed(s < 600 ? 1 : 0) + ' minutes';
    if (s < 172800) return (s / 3600).toFixed(1) + ' hours';
    return (s / 86400).toFixed(1) + ' days';
  }
  var NM_PRESETS = [
    ['nmap 192.168.1.50', 'Default scan of one host'],
    ['sudo nmap -sn 192.168.1.0/24', 'Who is on my network?'],
    ['nmap -p- --open -T4 192.168.1.50', 'Every port'],
    ['sudo nmap -sV -O -p 22,80,443 192.168.1.50', 'Services and OS'],
    ['sudo nmap -sU --top-ports 20 192.168.1.1', 'UDP: the slow one'],
    ['nmap -p 443 --script ssl-cert,http-title 192.168.1.1', 'Safe scripts'],
    ['sudo nmap -A -T4 -oA lan-scan 192.168.1.50', 'Aggressive (loud)'],
    ['nmap -sL 192.168.1.0/29', 'List scan: no probes'],
    ['nmap -Pn -T5 -p- 8.8.8.8', 'Not yours: the scope check']
  ];
  function nmexplain() {
    var r = wrap('Read an nmap command', 'Type a command, or pick one. The pipeline shows which of nmap’s phases will run; the table explains every flag and who must be root.');
    var inp = h('input', { type: 'text', value: NM_PRESETS[3][0], 'aria-label': 'An nmap command line', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', class: 'nm-cmd' });
    var pre = h('div', { class: 'nm-pre' }), pipe = h('div', { class: 'nm-pipe' }), facts = h('div', { class: 'nm-facts', 'aria-live': 'polite' }), warn = h('div', { class: 'nm-warn' }), tbl = h('div', { class: 'nm-tbl' });
    pre.innerHTML = NM_PRESETS.map(function (p, i) { return '<button type="button" class="chip" data-pi="' + i + '">' + esc(p[1]) + '</button>'; }).join('');
    r.appendChild(inp); r.appendChild(pre); r.appendChild(pipe); r.appendChild(facts); r.appendChild(warn); r.appendChild(tbl);
    function draw() {
      var X = analyse(inp.value), A = X.A, run = A.run;
      pipe.innerHTML = '<ol class="nm-ph" aria-label="Nmap phases in order">' + PHASES.map(function (p, i) {
        var st = run[p[0]], flags = X.rows.filter(function (rw) { return rw[2] === p[0]; }).map(function (rw) { return rw[0].split(' ')[0]; }).filter(function (x, j, a) { return a.indexOf(x) === j; }).slice(0, 3);
        return '<li class="nm-p nm-' + st + '" title="' + esc(p[2]) + '"><span class="nm-pn">' + (i + 1) + '</span><b>' + esc(p[1]) + '</b><small>' + (st === 'on' ? 'runs' : st === 'maybe' ? 'only if a script asks' : 'skipped') + (flags.length && st !== 'off' ? ' · ' + esc(flags.join(' ')) : '') + '</small></li>';
      }).join('') + '</ol>';
      var f = [];
      f.push(['Scan type', A.eff ? '<b>' + esc(A.eff) + '</b> ' + ({ '-sS': 'SYN', '-sT': 'connect', '-sU': 'UDP', '-sA': 'ACK', '-sF': 'FIN', '-sN': 'NULL', '-sX': 'Xmas', '-sW': 'window', '-sM': 'Maimon', '-sO': 'IP protocol', '-sI': 'idle' }[A.eff] || '') + (A.scan ? '' : ' (default for ' + (A.sudo ? 'root' : 'a normal user') + ')') : (A.sn ? 'none: discovery only' : A.sL ? 'none: nothing is sent' : '')]);
      f.push(['Privileges', A.root.length ? (A.sudo ? 'root, as needed' : '<span class="nm-bad">root needed</span> for ' + esc(A.root.filter(function (x, j, a) { return a.indexOf(x) === j; }).join(' '))) : 'an ordinary user is enough']);
      f.push(['Targets', A.flags['-iL'] ? 'from the file ' + esc(A.flags['-iL']) : A.hosts ? A.hosts.toLocaleString() + (A.hosts === 1 ? ' address' : ' addresses') + ' (' + (A.pub.length ? '<span class="nm-bad">not all private</span>' : '<span class="nm-ok">all private</span>') + ')' : 'none']);
      if (run.port === 'on') {
        f.push(['Ports', A.ports.toLocaleString() + ' per host: ' + esc(A.portNote)]);
        if (A.hosts) {
          var probes = A.hosts * A.ports; f.push(['Probes', 'at least ' + probes.toLocaleString() + ' (hosts × ports), plus retries for silent ports']);
          if (A.tm !== null && SERIAL[A.tm] !== undefined) f.push(['Time', '<span class="nm-bad">about ' + fmtDur(probes * SERIAL[A.tm]) + '</span> at -T' + A.tm + ': probes go one at a time, ' + SERIAL[A.tm] + ' s apart']);
          else f.push(['Time', 'depends on the network: usually seconds to minutes on a LAN, much longer for UDP or when ports are filtered']);
        }
      }
      facts.innerHTML = f.map(function (x) { return '<div><span>' + x[0] + '</span><div>' + x[1] + '</div></div>'; }).join('');
      var w = A.warn.slice();
      if (A.pub.length) w.push('<b>Scope check:</b> ' + esc(A.pub.slice(0, 3).join(', ')) + (A.pub.length > 3 ? '…' : '') + ' ' + (A.pub.length > 1 ? 'are' : 'is') + ' not a private (RFC 1918) address. Scan only what you own or have written permission to test.');
      if (A.unknown) w.push(A.unknown + ' token' + (A.unknown > 1 ? 's' : '') + ' not recognised by this explainer (shown below); check <code>man nmap</code>.');
      warn.innerHTML = w.length ? '<ul>' + w.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '<p class="nm-okline">Nothing unusual: a reasonable, polite command.</p>';
      tbl.innerHTML = X.rows.length || A.targets.length ? '<div class="nm-scroll"><table><thead><tr><th>Part</th><th>What it does</th><th>Phase</th><th>Root?</th></tr></thead><tbody>' +
        X.rows.map(function (rw) { return '<tr' + (rw[4] === 'unk' ? ' class="nm-unk"' : '') + '><th scope="row"><code>' + esc(rw[0]) + '</code></th><td>' + esc(rw[1]) + '</td><td>' + esc((PHASES.filter(function (p) { return p[0] === rw[2]; })[0] || [0, '—'])[1]) + '</td><td>' + (rw[3] ? '<span class="nm-bad">yes</span>' : 'no') + '</td></tr>'; }).join('') +
        A.targets.map(function (t) { return '<tr><th scope="row"><code>' + esc(t) + '</code></th><td>Target: ' + (countTarget(t) > 1 ? countTarget(t).toLocaleString() + ' addresses' : scope(t) === 'name' ? 'a host name (resolved by DNS)' : 'one address') + ', ' + (scope(t) === 'private' ? 'in a private range' : scope(t) === 'public' ? '<b>not in a private range</b>' : 'owner unknown: check') + '.</td><td>Target enumeration</td><td>no</td></tr>'; }).join('') + '</tbody></table></div>' : '';
    }
    inp.addEventListener('input', draw);
    pre.addEventListener('click', function (e) { var b = e.target.closest('[data-pi]'); if (b) { inp.value = NM_PRESETS[+b.getAttribute('data-pi')][0]; draw(); } });
    draw();
    return r;
  }

  /* ================= nmscan ================= */
  var SC = '192.168.1.23', TG = '192.168.1.50';
  function tcpT(dir, flags, ttl, extra) {
    var sp = 56310, dp = 22;
    return dir === 'S' ? 'SENT (0.0412s) TCP ' + SC + ':' + sp + ' > ' + TG + ':' + dp + ' ' + flags + ' ttl=' + (ttl || 44) + ' id=19213 iplen=' + (extra && extra.len || 44) + '  seq=1738020405 win=1024' + (extra && extra.mss ? ' <mss 1460>' : '')
      : 'RCVD (0.0455s) TCP ' + TG + ':' + dp + ' > ' + SC + ':' + sp + ' ' + flags + ' ttl=64 id=0 iplen=' + (extra && extra.len || 44) + '  seq=3320215121 win=' + (extra && extra.win || 64240) + (extra && extra.mss ? ' <mss 1460>' : '');
  }
  var ICMP13 = 'RCVD (0.0461s) ICMP [' + TG + ' > ' + SC + ' Network ' + TG + ' unreachable (type=3/code=13) ] IP [ttl=64 id=3114 iplen=72 ]';
  var NM_SCANS = [['syn', 'SYN  -sS'], ['conn', 'Connect  -sT'], ['ack', 'ACK  -sA'], ['fin', 'FIN  -sF'], ['null', 'NULL  -sN'], ['xmas', 'Xmas  -sX'], ['udp', 'UDP  -sU']];
  var NM_CONDS = [['open', 'Port open'], ['closed', 'Port closed'], ['drop', 'Firewall drops'], ['reject', 'Firewall rejects']];
  var PROBE = { fin: ['FIN', 'F', 'a lone FIN'], null: ['NULL', '', 'a packet with no flags at all'], xmas: ['FIN/PSH/URG', 'FPU', 'FIN, PSH and URG set together'] };

  function scenario(scan, cond) {
    var S = [], V, A = [{ label: 'Scanner', sub: SC + ' (your Mac)' }, { label: 'Target', sub: TG + ' (Raspberry Pi)' }];
    var silent = function (txt, note) { return { f: 1, t: 0, label: txt || '… silence: nothing comes back …', kind: 'none', note: note }; };
    var icmp = { f: 1, t: 0, label: 'ICMP unreachable (type 3, code 13)', kind: 'warn', trace: ICMP13, note: 'Something on the path, usually a firewall, answers with an ICMP “communication administratively prohibited” message instead of staying silent. That is a polite refusal: it proves a filter is there.' };
    if (scan === 'syn') {
      var syn = { f: 0, t: 1, label: 'SYN to port 22', kind: 'req', trace: tcpT('S', 'S', 44, { mss: 1 }), note: 'Nmap crafts a raw TCP **SYN**, the first packet of a handshake, with its own source port. No connection exists yet, and nmap does not use the operating system’s sockets at all, which is why it needs root.' };
      if (cond === 'open') { S = [syn, { f: 1, t: 0, label: 'SYN/ACK', kind: 'ok', trace: tcpT('R', 'SA', 64, { mss: 1 }), note: 'A program is listening, so the target’s TCP stack accepts and answers **SYN/ACK**. That reply is the entire proof that the port is open.' }, { f: 0, t: 1, label: 'RST (from your kernel)', kind: 'bad', note: 'The handshake is never finished. Your own operating system, which has no socket for this connection, sends the **RST** when it sees the unexpected SYN/ACK. The service usually never learns a connection was attempted, which is why this is called “half-open”. A firewall or IDS still sees it.' }]; V = { cls: 'ok', head: 'open', text: 'reason `syn-ack`. Wireshark: `tcp.flags.syn == 1 && tcp.flags.ack == 1` from the target.' }; }
      else if (cond === 'closed') { S = [syn, { f: 1, t: 0, label: 'RST/ACK', kind: 'bad', trace: tcpT('R', 'RA', 64, { len: 40, win: 0 }), note: 'Nothing is listening, so the target’s stack refuses with **RST/ACK**. The host is alive and reachable; just no service on that port.' }]; V = { cls: 'mute', head: 'closed', text: 'reason `reset`. A closed port is useful information: the host is up and no firewall is in the way.' }; }
      else if (cond === 'drop') { S = [syn, silent(null, 'A firewall that **drops** packets gives no answer at all. Nmap cannot tell this from a lost packet.'), Object.assign({}, syn, { label: 'SYN again (retransmit)', note: 'Nmap retransmits the probe in case it was lost (up to `--max-retries` times; the default depends on timing).' }), silent(null, 'Still nothing, so nmap gives up on this port.')]; V = { cls: 'warn', head: 'filtered', text: 'reason `no-response`. Dropped probes make a scan slow, because nmap must wait out each timeout.' }; }
      else S = [syn, icmp], V = { cls: 'warn', head: 'filtered', text: 'reason `admin-prohibited`. ICMP type 3 with code 0, 1, 2, 3, 9, 10 or 13 marks a port filtered.' };
    } else if (scan === 'conn') {
      var c1 = { f: 0, t: 1, label: 'connect() → SYN', kind: 'req', note: 'Without root, nmap asks the **operating system** to connect, using the ordinary socket API. The kernel sends the SYN; nmap only learns whether connect() succeeded.', trace: 'CONN (0.0238s) TCP localhost > ' + TG + ':22 => Operation now in progress' };
      if (cond === 'open') { S = [c1, { f: 1, t: 0, label: 'SYN/ACK', kind: 'ok', note: 'The service accepts.' }, { f: 0, t: 1, label: 'ACK  (connection established)', kind: 'req', trace: 'CONN (0.0239s) TCP localhost > ' + TG + ':22 => Connected', note: 'The kernel completes the **full three-way handshake**. The application is now handed a real connection, so it can log it, and some will wait for you to speak.' }, { f: 0, t: 1, label: 'RST/ACK (nmap closes)', kind: 'bad', note: 'Nmap closes the socket straight away with a reset, without sending any data. Connect scans are the noisiest TCP scan in server logs.' }]; V = { cls: 'ok', head: 'open', text: 'Works without root, which is why it is the default for ordinary users. Wireshark shows a complete handshake followed by a reset.' }; }
      else if (cond === 'closed') { S = [c1, { f: 1, t: 0, label: 'RST/ACK', kind: 'bad', trace: 'CONN (0.0239s) TCP localhost > ' + TG + ':22 => Connection refused', note: 'connect() fails with “Connection refused”.' }]; V = { cls: 'mute', head: 'closed', text: 'The error the operating system returned is the result.' }; }
      else if (cond === 'drop') { S = [c1, silent(null, 'connect() keeps waiting for the SYN/ACK.'), silent('… timeout …', 'After its timeout, connect() fails and nmap marks the port filtered.')]; V = { cls: 'warn', head: 'filtered', text: 'Slow: the OS and nmap both wait out timeouts.' }; }
      else S = [c1, Object.assign({}, icmp, { note: 'An ICMP unreachable makes connect() fail with “No route to host”, which nmap reports as filtered.' })], V = { cls: 'warn', head: 'filtered', text: 'A firewall that rejects with ICMP is quicker to scan than one that drops.' };
    } else if (scan === 'ack') {
      var a1 = { f: 0, t: 1, label: 'ACK to port 22', kind: 'req', trace: tcpT('S', 'A', 46, { len: 40 }).replace('seq=1738020405', 'seq=0'), note: 'An ACK for a connection that never existed. A normal TCP stack answers any such stray ACK with a reset, whatever the port state.' };
      if (cond === 'open' || cond === 'closed') { S = [a1, { f: 1, t: 0, label: 'RST', kind: 'bad', trace: tcpT('R', 'R', 64, { len: 40, win: 0 }), note: 'The target resets **both** for open and for closed ports. So the scan cannot tell them apart. What it does tell you is that the packet got through.' }]; V = { cls: 'mute', head: 'unfiltered', text: 'reason `reset`. “Unfiltered” means reachable, not open. Use -sA to map firewall rules, then another scan to find which ports are open.' }; }
      else if (cond === 'drop') { S = [a1, silent(null, 'A stateful firewall drops an ACK that belongs to no connection it knows.')]; V = { cls: 'warn', head: 'filtered', text: 'reason `no-response`. A stateful firewall is exactly what this shows: SYNs to allowed ports pass, stray ACKs do not.' }; }
      else S = [a1, icmp], V = { cls: 'warn', head: 'filtered', text: 'reason `admin-prohibited`.' };
    } else if (scan === 'fin' || scan === 'null' || scan === 'xmas') {
      var P = PROBE[scan], p1 = { f: 0, t: 1, label: P[0] + ' to port 22', kind: 'req', trace: tcpT('S', P[1], 47, { len: 40 }).replace(/ seq=1738020405/, ' seq=58500147'), note: 'A packet that is not part of any connection: ' + P[2] + '. Per RFC 793, a closed port answers RST, while an open port silently ignores it.' };
      if (cond === 'open') { S = [p1, silent(null, 'An open port **ignores** the stray packet, per the standard.')]; V = { cls: 'warn', head: 'open|filtered', text: 'reason `no-response`. Nmap cannot tell “open” from “a firewall dropped it”, so it reports both. Windows and many network devices always answer RST, which makes this scan useless against them.' }; }
      else if (cond === 'closed') { S = [p1, { f: 1, t: 0, label: 'RST/ACK', kind: 'bad', trace: tcpT('R', 'RA', 64, { len: 40, win: 0 }).replace(/seq=3320215121/, 'seq=0'), note: 'Closed ports answer with RST, as the standard says.' }]; V = { cls: 'mute', head: 'closed', text: 'reason `reset`. The method slips past a simple filter that only blocks SYN packets, but stateful firewalls and IDS recognise it easily.' }; }
      else if (cond === 'drop') { S = [p1, silent(null, 'A firewall drop looks exactly like an open port.')]; V = { cls: 'warn', head: 'open|filtered', text: 'reason `no-response`. This ambiguity is the weakness of the whole family.' }; }
      else S = [p1, icmp], V = { cls: 'warn', head: 'filtered', text: 'reason `admin-prohibited`.' };
    } else {
      var u1 = { f: 0, t: 1, label: 'UDP datagram to port 53', kind: 'req', trace: 'SENT (0.0983s) UDP ' + SC + ':46008 > ' + TG + ':53 ttl=59 id=47235 iplen=58 ', note: 'UDP has no handshake. Nmap sends a datagram; for well-known ports such as 53 it includes a **real protocol request** (a DNS query) to provoke an answer, because an empty datagram makes most services say nothing.' };
      if (cond === 'open') { S = [u1, { f: 1, t: 0, label: 'UDP reply (DNS answer)', kind: 'ok', note: 'The service understood and answered. That is the only way to be certain a UDP port is open.' }]; V = { cls: 'ok', head: 'open', text: 'reason `udp-response`. If the service had ignored the probe, the result would have been `open|filtered`.' }; }
      else if (cond === 'closed') { S = [u1, { f: 1, t: 0, label: 'ICMP port unreachable (3/3)', kind: 'bad', trace: 'RCVD (0.0983s) ICMP [' + TG + ' > ' + SC + ' Port 53 unreachable (type=3/code=3) ] IP [ttl=64 id=49032 iplen=86 ]', note: 'With nothing listening, the target’s stack sends **ICMP port unreachable**. This is the only signal a closed UDP port gives. Linux limits these to about one per second by default, which is why a full UDP scan can take many hours.' }]; V = { cls: 'mute', head: 'closed', text: 'reason `port-unreach`.' }; }
      else if (cond === 'drop') { S = [u1, silent(null, 'No answer. The port may be open but not answering this probe, or a firewall dropped it.'), Object.assign({}, u1, { label: 'UDP again (retransmit)', note: 'Nmap sends the probe again, in case it or the reply was lost.' }), silent(null, 'Still silent.')]; V = { cls: 'warn', head: 'open|filtered', text: 'reason `no-response`. Most UDP scan results are this one. Add `-sV` to send protocol-specific probes to those ports and resolve the doubt.' }; }
      else S = [u1, icmp], V = { cls: 'warn', head: 'filtered', text: 'reason `admin-prohibited`.' };
    }
    return { actors: A, steps: S, verdict: V };
  }
  function nmscan() {
    var r = wrap('One probe, one reply: how scan types decide', 'Choose a scan and what the target is doing. Step through the packets and see which state nmap reports and why. The grey lines are the real <code>--packet-trace</code> format.');
    var st = { scan: 'syn', cond: 'open' };
    var ctl = h('div', { class: 'nm-ctl' }), host = h('div', { class: 'nm-sq' });
    r.appendChild(ctl); r.appendChild(host);
    function draw() {
      ctl.innerHTML = '<div class="nm-row"><span class="nm-lab">Scan type</span>' + chips(NM_SCANS, st.scan, 'data-s') + '</div><div class="nm-row"><span class="nm-lab">The target</span>' + chips(NM_CONDS.filter(function (c) { return !(st.scan === 'ack' && c[0] === 'closed'); }), st.cond, 'data-c') + '</div>';
      if (st.scan === 'ack' && st.cond === 'closed') st.cond = 'open';
      var old = host.firstChild; if (old && old.__stop) old.__stop();
      var S = scenario(st.scan, st.cond);
      host.innerHTML = '';
      var sq = window.__netviz.seq({ label: 'Nmap ' + st.scan + ' scan, target condition ' + st.cond, actors: S.actors, steps: S.steps, verdict: S.verdict });
      host.appendChild(sq);
    }
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-s')) st.scan = b.getAttribute('data-s'); else if (b.hasAttribute('data-c')) st.cond = b.getAttribute('data-c'); else return;
      draw();
    });
    draw();
    return r;
  }

  /* ================= nmdisc ================= */
  function nmdisc() {
    var r = wrap('How nmap decides a host is up', 'Before it scans ports, nmap asks each address “are you there?”. What it sends depends on two things: how close the target is, and whether you are root.');
    var st = { near: true, root: true };
    var ctl = h('div', { class: 'nm-ctl' }), out = h('div', { class: 'nm-disc', 'aria-live': 'polite' });
    r.appendChild(ctl); r.appendChild(out);
    function probe(cls, name, detail, flag) { return '<li class="nm-pr nm-pr-' + cls + '"><b>' + name + '</b><span>' + detail + '</span><code>' + flag + '</code></li>'; }
    function draw() {
      ctl.innerHTML = '<div class="nm-row"><span class="nm-lab">The target is</span>' + chips([['near', 'on my own LAN'], ['far', 'on another network']], st.near ? 'near' : 'far', 'data-n') + '</div><div class="nm-row"><span class="nm-lab">I run nmap as</span>' + chips([['root', 'root (sudo)'], ['user', 'a normal user']], st.root ? 'root' : 'user', 'data-r') + '</div>';
      var ps, why, tip, flags;
      if (st.near && st.root) { ps = probe('arp', 'ARP request', 'who has 192.168.1.50? tell 192.168.1.23', '-PR'); flags = 'sudo nmap -sn 192.168.1.0/24'; why = 'Only ARP is sent. Every host on an Ethernet segment must answer ARP to talk at all, and a host firewall works above that layer, so <b>a firewall cannot hide a host from an ARP scan</b>. It is also the most reliable and the fastest discovery there is.'; tip = 'You also get the MAC address and the network card’s vendor, which is how a scan names a smart TV you forgot about.'; }
      else if (st.near) { ps = probe('tcp', 'TCP connect() to port 80', 'the kernel sends the SYN; a SYN/ACK or a RST both mean “up”', '-PS80') + probe('tcp', 'TCP connect() to port 443', 'same, to the HTTPS port', '-PS443'); flags = 'nmap -sn 192.168.1.0/24'; why = 'Without root nmap cannot craft ARP or ICMP packets, so it asks the operating system to connect to two common ports. The kernel does the ARP lookup for its own reasons; nmap only sees whether connect() succeeded, was refused or timed out.'; tip = 'A host that has nothing on 80 or 443 and blocks them looks “down” here, but still answers an ARP scan. Run with sudo on your own LAN.'; }
      else if (st.root) { ps = probe('icmp', 'ICMP echo request', 'an ordinary ping', '-PE') + probe('tcp', 'TCP SYN to port 443', 'a SYN/ACK or a RST means up', '-PS443') + probe('tcp', 'TCP ACK to port 80', 'a stray ACK; an RST means up', '-PA80') + probe('icmp', 'ICMP timestamp request', 'a rarely filtered cousin of ping', '-PP'); flags = 'sudo nmap -sn 203.0.113.0/28'; why = 'Four probes at once, picked so that a firewall that blocks one is likely to let another through. Any reply at all, even a reset, proves the host is alive.'; tip = 'If a host blocks all four it is reported down, and its ports are never scanned. <code>-Pn</code> skips discovery and scans anyway.'; }
      else { ps = probe('tcp', 'TCP connect() to port 80', 'a SYN/ACK or a RST both mean up', '-PS80') + probe('tcp', 'TCP connect() to port 443', 'same, to HTTPS', '-PS443'); flags = 'nmap -sn 203.0.113.0/28'; why = 'Two connection attempts, nothing more. Remote hosts are much more likely to be filtered, so unprivileged discovery misses more.'; tip = 'Servers that only run SSH on a non-standard port look down. Pass the port: <code>-PS2222</code>, or use <code>-Pn</code>.'; }
      out.innerHTML = '<div class="nm-dgrid"><div class="nm-from"><span>your Mac</span><i></i></div><ul class="nm-pl">' + ps + '</ul><div class="nm-to"><span>target</span><i></i></div></div>' +
        '<p class="nm-dwhy">' + why + '</p><p class="nm-dtip"><b>Command:</b> <code>' + esc(flags) + '</code><br>' + tip + '</p>' +
        '<p class="nm-dnote"><b>What “up” means:</b> <i>any</i> answer: a SYN/ACK, a RST, an ICMP echo reply, an ARP reply. Silence means “down”, or “blocked”; nmap cannot tell which. That is the only reason <code>-Pn</code> exists.</p>';
    }
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-n')) st.near = b.getAttribute('data-n') === 'near'; else if (b.hasAttribute('data-r')) st.root = b.getAttribute('data-r') === 'root'; else return;
      draw();
    });
    draw();
    return r;
  }

  /* ================= nmmatrix ================= */
  var HOSTS = [
    { ip: '192.168.1.1', name: 'router.lan', os: 'router firmware', ports: { 53: ['open', 'domain', 'dnsmasq 2.89'], 80: ['open', 'http', 'router admin page'], 443: ['open', 'https', 'router admin page (self-signed)'], 23: ['closed'], 22: ['closed'] } },
    { ip: '192.168.1.50', name: 'pi.lan', os: 'Raspberry Pi OS', ports: { 22: ['open', 'ssh', 'OpenSSH 9.2p1 Debian'], 80: ['open', 'http', 'nginx 1.22.1'], 8080: ['open', 'http-proxy', 'an HTTP service nobody remembers starting'], 23: ['closed'], 443: ['closed'] } },
    { ip: '192.168.1.60', name: 'nas.lan', os: 'NAS (Linux)', ports: { 22: ['open', 'ssh', 'OpenSSH 8.4'], 139: ['open', 'netbios-ssn', 'Samba 4.17'], 445: ['open', 'microsoft-ds', 'Samba 4.17'], 5000: ['open', 'upnp', 'NAS web UI'], 443: ['closed'] } },
    { ip: '192.168.1.70', name: 'printer.lan', os: 'network printer', ports: { 631: ['open', 'ipp', 'CUPS-compatible'], 9100: ['open', 'jetdirect', 'raw printing, no authentication'], 80: ['filtered'], 23: ['closed'] } },
    { ip: '192.168.1.90', name: 'homeassistant.lan', os: 'Home Assistant OS', ports: { 8123: ['open', 'http', 'Home Assistant (plain HTTP)'], 22: ['filtered'], 443: ['closed'] } }
  ];
  var COLS = [22, 23, 53, 80, 139, 443, 445, 631, 5000, 8080, 8123, 9100];
  var RISK = {
    22: ['ok', 'SSH is the right way in, if it uses keys.', 'Disable password login: <code>PasswordAuthentication no</code>; keep it patched; restrict to your LAN or a VPN.'],
    23: ['bad', 'Telnet sends everything, passwords included, in clear text, often with no password at all.', 'Turn it off in the device’s settings. If it cannot be turned off, treat the device as untrusted and isolate it.'],
    53: ['ok', 'A DNS resolver on the router is normal on a LAN.', 'Make sure it does not answer from the Internet side (an open resolver).'],
    80: ['warn', 'Plain HTTP: anyone on the LAN can read what is sent to it, including admin passwords.', 'Prefer the HTTPS port; redirect or close port 80 where you can.'],
    139: ['warn', 'NetBIOS session service: legacy Windows file sharing.', 'Disable it if you only need SMB over 445; never expose it to the Internet.'],
    443: ['ok', 'HTTPS is expected.', 'Check the certificate and that the admin page is not reachable from the Internet.'],
    445: ['bad', 'SMB file sharing. Old versions (SMB1) have caused worm outbreaks such as WannaCry.', 'Disable SMB1, require SMB 3 with signing, and keep it off the Internet.'],
    631: ['ok', 'IPP printing is normal.', 'Disable network printing protocols you do not use.'],
    5000: ['warn', 'A NAS web interface, or UPnP, on a plain port.', 'Use HTTPS, strong passwords and two-factor sign-in; turn off UPnP port mapping on the router.'],
    8080: ['warn', 'An alternative HTTP port: development servers and admin panels often hide here.', 'Find out what it is. If you no longer need it, stop it. If you do, bind it to localhost or add authentication.'],
    8123: ['warn', 'Home Assistant over plain HTTP.', 'Put it behind HTTPS with a reverse proxy, and do not forward it from the router.'],
    9100: ['bad', 'Raw printing (JetDirect): anyone on the LAN can print or reconfigure the device.', 'Restrict to the machines that print; disable the port if you use IPP only.']
  };
  function nmmatrix() {
    var r = wrap('Exposure map of a home network', 'The five devices from the lab’s <code>scan.txt</code> drawn as a grid: rows are hosts, columns are ports. The open ports are exactly the ones in that file; the version strings are what <code>-sV</code> would add, and a few closed and filtered columns are included for contrast. Click a cell for the service, the risk and what to do.');
    var sel = null, view = 'state';
    var ctl = h('div', { class: 'nm-ctl' }), grid = h('div', { class: 'nm-grid-wrap' }), det = h('div', { class: 'nm-det', 'aria-live': 'polite' });
    r.appendChild(ctl); r.appendChild(grid); r.appendChild(det);
    function cellFor(hi, p) {
      var d = HOSTS[hi].ports[p];
      if (!d) return { cls: 'na', txt: '·', lab: 'not scanned' };
      if (d[0] === 'open') {
        var rk = RISK[p] ? RISK[p][0] : 'warn';
        return { cls: view === 'risk' ? 'o-' + rk : 'open', txt: view === 'risk' ? (rk === 'bad' ? '!!' : rk === 'warn' ? '!' : '✓') : 'open', lab: 'open, ' + (rk === 'bad' ? 'high risk' : rk === 'warn' ? 'review' : 'expected') };
      }
      if (d[0] === 'filtered') return { cls: 'filt', txt: '?', lab: 'filtered' };
      return { cls: 'closed', txt: '\u00D7', lab: 'closed' };
    }
    function draw() {
      ctl.innerHTML = '<div class="nm-row"><span class="nm-lab">Colour by</span>' + chips([['state', 'port state'], ['risk', 'risk of an open port']], view, 'data-v') + '</div>';
      var thead = '<tr><th class="nm-hc"></th>' + COLS.map(function (p) { return '<th scope="col" class="nm-pc"><span>' + p + '</span><small>' + ((HOSTS.reduce(function (a, x) { return a || (x.ports[p] && x.ports[p][1]); }, null)) || '') + '</small></th>'; }).join('') + '<th scope="col" class="nm-pc"><span>open</span></th></tr>';
      var body = HOSTS.map(function (hst, hi) {
        var n = 0, cells = COLS.map(function (p) {
          var c = cellFor(hi, p); if (c.cls !== 'na' && hst.ports[p][0] === 'open') n++;
          var on = sel && sel[0] === hi && sel[1] === p;
          return '<td><button type="button" class="nm-cell nm-' + c.cls + (on ? ' sel' : '') + '" data-h="' + hi + '" data-p="' + p + '" aria-label="' + esc(hst.name + ' port ' + p + ': ' + c.lab) + '">' + c.txt + '</button></td>';
        }).join('');
        return '<tr><th scope="row"><b>' + esc(hst.name) + '</b><small>' + esc(hst.ip) + '</small></th>' + cells + '<td class="nm-cnt"><b>' + n + '</b></td></tr>';
      }).join('');
      grid.innerHTML = '<div class="nm-scroll"><table class="nm-grid"><thead>' + thead + '</thead><tbody>' + body + '</tbody></table></div>' +
        '<div class="nm-legend">' + (view === 'state' ? '<span><i class="nm-open"></i>open</span><span><i class="nm-closed"></i>\u00D7 closed (host answered: reset)</span><span><i class="nm-filt"></i>? filtered (no answer: unknown)</span><span><i class="nm-na"></i>not scanned</span>' : '<span><i class="nm-o-ok"></i>open, expected</span><span><i class="nm-o-warn"></i>open, review</span><span><i class="nm-o-bad"></i>open, high risk</span><span><i class="nm-closed"></i>closed</span><span><i class="nm-filt"></i>filtered</span>') + '</div>';
      showDet();
    }
    function showDet() {
      if (!sel) { det.innerHTML = '<p class="nm-hint">Select a cell. A real report reads the same way: the interesting rows are the ones you cannot explain.</p>'; return; }
      var hst = HOSTS[sel[0]], p = sel[1], d = hst.ports[p];
      if (!d) { det.innerHTML = '<p><b>' + esc(hst.name) + ' port ' + p + '</b>: this port was not in the scan.</p>'; return; }
      var line = p + '/tcp ' + d[0] + (d[1] ? ' ' + d[1] : '') + (d[2] ? '  ' + d[2] : '');
      if (d[0] !== 'open') { det.innerHTML = '<p><b>' + esc(hst.name) + ' (' + esc(hst.ip) + ') port ' + p + '</b> is <b>' + d[0] + '</b>. ' + (d[0] === 'closed' ? 'The host answered with a reset: reachable, nothing listening.' : 'No answer or an ICMP refusal: a firewall is in the way.') + '</p>'; return; }
      var R = RISK[p] || ['warn', 'An uncommon service.', 'Find out what is listening: <code>sudo lsof -iTCP:' + p + ' -sTCP:LISTEN</code> on the machine itself.'];
      det.innerHTML = '<div class="nm-detc nm-r-' + R[0] + '"><div class="nm-dh"><b>' + esc(hst.name) + '</b> <span>' + esc(hst.ip) + ' · ' + esc(hst.os) + '</span></div><pre>' + esc(line) + '</pre><p><b>' + (R[0] === 'bad' ? 'High risk. ' : R[0] === 'warn' ? 'Review. ' : 'Expected. ') + '</b>' + R[1] + '</p><p><b>What to do:</b> ' + R[2] + '</p></div>';
    }
    grid.addEventListener('click', function (e) { var b = e.target.closest('.nm-cell'); if (b) { sel = [+b.getAttribute('data-h'), +b.getAttribute('data-p')]; draw(); var nb = grid.querySelector('.nm-cell.sel'); if (nb) nb.focus(); } });
    ctl.addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) { view = b.getAttribute('data-v'); draw(); } });
    draw();
    return r;
  }

  /* ================= nmnse ================= */
  // counts are from the script.db that ships with Nmap 7.94 (605 scripts); a script can be in several categories
  var NSE = [
    { id: 'default', n: 126, risk: 'low', what: 'The set -sC runs. Chosen to be quick, useful and safe: it reads what a service volunteers.', ex: ['http-title', 'ssh-hostkey', 'ssl-cert', 'ftp-anon', 'smb-os-discovery', 'upnp-info'], cmd: 'nmap -sC 192.168.1.50' },
    { id: 'safe', n: 347, risk: 'low', what: 'Not designed to crash services, use much bandwidth or exploit anything. “Safe” is the script author’s claim, not a guarantee.', ex: ['http-methods', 'http-headers', 'dns-recursion', 'ssh2-enum-algos', 'banner'], cmd: 'nmap --script safe -p 80,443 192.168.1.1' },
    { id: 'discovery', n: 309, risk: 'low', what: 'Learn more about the network: names, services, configuration, shares.', ex: ['nbstat', 'dhcp-discover', 'http-robots.txt', 'http-security-headers', 'ssl-enum-ciphers'], cmd: 'nmap --script discovery 192.168.1.60' },
    { id: 'version', n: 46, risk: 'low', what: 'Extensions to -sV that identify services more closely.', ex: ['fingerprint-strings', 'snmp-info', 'http-server-header'], cmd: 'nmap -sV --script version 192.168.1.50' },
    { id: 'auth', n: 38, risk: 'mid', what: 'Deal with authentication: check for anonymous or empty credentials, list supported methods.', ex: ['ftp-anon', 'ssh-auth-methods', 'mysql-empty-password'], cmd: 'nmap -p 21 --script ftp-anon 192.168.1.60' },
    { id: 'broadcast', n: 46, risk: 'mid', what: 'Discover hosts and services by broadcasting on the local network instead of probing addresses.', ex: ['broadcast-dhcp-discover', 'broadcast-ping'], cmd: 'sudo nmap --script broadcast-dhcp-discover' },
    { id: 'external', n: 34, risk: 'mid', what: 'Send data to a third party (a whois server, a cloud API). Your target or your findings leave your network.', ex: ['whois-ip', 'vulners'], cmd: 'nmap -sV --script vulners 192.168.1.50' },
    { id: 'vuln', n: 105, risk: 'high', what: 'Check for known vulnerabilities. Some are safe checks; some send exploit-like requests.', ex: ['ssl-heartbleed', 'smb-vuln-ms17-010', 'ssl-dh-params', 'http-enum'], cmd: 'nmap -p 445 --script smb-vuln-ms17-010 192.168.1.60' },
    { id: 'intrusive', n: 213, risk: 'high', what: 'Likely to be noticed, use a lot of resources or risk crashing the target. Includes many brute-force and fuzzing scripts.', ex: ['ssl-enum-ciphers', 'http-enum', 'ssh-auth-methods'], cmd: 'nmap -p 443 --script ssl-enum-ciphers 192.168.1.1' },
    { id: 'brute', n: 75, risk: 'high', what: 'Guess passwords against services. Can lock accounts and floods logs.', ex: ['ssh-brute', 'http-brute', 'ftp-brute'], cmd: '(own test systems only)' },
    { id: 'exploit', n: 45, risk: 'high', what: 'Actively try to exploit a vulnerability.', ex: ['ftp-vsftpd-backdoor', 'http-shellshock'], cmd: '(written permission only)' },
    { id: 'dos', n: 11, risk: 'high', what: 'Test for denial-of-service weaknesses, usually by causing one.', ex: ['http-slowloris', 'smb-vuln-ms10-054'], cmd: '(never on anything in use)' },
    { id: 'malware', n: 10, risk: 'mid', what: 'Look for signs of backdoors and malware on the target.', ex: ['ftp-vsftpd-backdoor', 'smtp-strangeport', 'irc-unrealircd-backdoor'], cmd: 'nmap --script malware 192.168.1.60' },
    { id: 'fuzzer', n: 3, risk: 'high', what: 'Send unexpected or randomised input to find bugs. Slow and disruptive.', ex: ['dns-fuzz', 'http-form-fuzzer'], cmd: '(own test systems only)' }
  ];
  function nmnse() {
    var r = wrap('NSE script categories', 'The Nmap Scripting Engine runs small Lua scripts against hosts and ports. Every script belongs to one or more categories, and the category tells you how risky it is to run. Bars are the number of scripts in each, in Nmap 7.94.');
    var sel = 'default', risk = 'all';
    var ctl = h('div', { class: 'nm-ctl' }), list = h('div', { class: 'nm-nse' }), det = h('div', { class: 'nm-det', 'aria-live': 'polite' });
    r.appendChild(ctl); r.appendChild(list); r.appendChild(det);
    var RL = { low: 'reads what services volunteer', mid: 'sends more, or leaves your network', high: 'needs explicit permission' };
    function draw() {
      ctl.innerHTML = '<div class="nm-row"><span class="nm-lab">Show</span>' + chips([['all', 'all categories'], ['low', 'low risk'], ['mid', 'medium'], ['high', 'needs permission']], risk, 'data-r') + '</div>';
      var max = 347, rows = NSE.filter(function (c) { return risk === 'all' || c.risk === risk; });
      list.innerHTML = rows.map(function (c) {
        return '<button type="button" class="nm-nrow nm-risk-' + c.risk + (c.id === sel ? ' sel' : '') + '" data-id="' + c.id + '" aria-pressed="' + (c.id === sel) + '"><span class="nm-nn">' + c.id + '</span><span class="nm-nb"><i style="width:' + Math.max(2, c.n / max * 100) + '%"></i></span><span class="nm-nc">' + c.n + '</span><span class="nm-nl">' + (c.risk === 'low' ? 'low' : c.risk === 'mid' ? 'medium' : 'high') + '</span></button>';
      }).join('');
      var c = NSE.filter(function (x) { return x.id === sel; })[0] || NSE[0];
      det.innerHTML = '<div class="nm-detc nm-r-' + (c.risk === 'low' ? 'ok' : c.risk === 'mid' ? 'warn' : 'bad') + '"><div class="nm-dh"><b>' + c.id + '</b> <span>' + c.n + ' scripts · ' + RL[c.risk] + '</span></div><p>' + esc(c.what) + '</p><p><b>Examples:</b> ' + c.ex.map(function (x) { return '<code>' + esc(x) + '</code>'; }).join(' ') + '</p><pre>' + esc(c.cmd) + '</pre></div>';
    }
    r.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]'); if (b) { risk = b.getAttribute('data-r'); if (risk !== 'all' && NSE.filter(function (c) { return c.id === sel && c.risk === risk; }).length === 0) sel = NSE.filter(function (c) { return c.risk === risk; })[0].id; draw(); return; }
      var n = e.target.closest('[data-id]'); if (n) { sel = n.getAttribute('data-id'); draw(); var nb = list.querySelector('.sel'); if (nb) nb.focus(); }
    });
    draw();
    return r;
  }

  W.nmexplain = nmexplain; W.nmscan = nmscan; W.nmdisc = nmdisc; W.nmmatrix = nmmatrix; W.nmnse = nmnse;
  window.__nmaplab = { analyse: analyse, scenario: scenario, countTarget: countTarget, portCount: portCount };   // exposed for tests
})();
