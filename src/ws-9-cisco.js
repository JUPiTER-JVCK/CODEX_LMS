/* Reference part: Cisco IOS cheat sheet. Two widgets:
   iosinfo  an infographic of a small lab (DHCP and DNS through a Catalyst switch) with numbered config panels
   iosmodes the CLI mode ladder: pick a prompt to see how you got there, how to leave, and what you can type there */
(function () {
  'use strict';
  if (!window.__core) return;
  var K = window.__core, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};

  function cb(code) {
    return '<div class="cb compact io-cb"><div class="bar"><span>Cisco IOS</span><span class="sp"></span>' + K.copyBtn(code) + '</div><pre>' + K.hlIos(code) + '</pre></div>';
  }

  /* ---------- small inline icons (stroke uses currentColor so they follow the panel colour) ---------- */
  var ICON = {
    shield: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z"/><path d="M11 16l4 4 7-8"/></svg>',
    relay: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 16a9 9 0 0 1 15-6.7"/><path d="M25 16a9 9 0 0 1-15 6.7"/><path d="M22 4v6h-6"/><path d="M10 28v-6h6"/></svg>',
    globe: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="M4 16h24M16 4c4 4 4 20 0 24M16 4c-4 4-4 20 0 24"/></svg>',
    search: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13" cy="13" r="8"/><path d="M19 19l9 9"/></svg>',
    gear: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="4"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8"/></svg>',
    star: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4l3.6 7.6 8.4 1-6.2 5.8 1.6 8.3L16 22.6l-7.4 4.1 1.6-8.3L4 12.6l8.4-1z"/></svg>',
    check: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="M10 16l4 4 8-9"/></svg>'
  };

  /* ---------- topology (SVG; colours come from CSS classes so both themes work) ---------- */
  function server(x, y) { return '<g class="io-dev"><rect x="' + x + '" y="' + y + '" width="34" height="58" rx="4"/><path d="M' + (x + 6) + ' ' + (y + 12) + 'h22M' + (x + 6) + ' ' + (y + 20) + 'h22M' + (x + 6) + ' ' + (y + 28) + 'h22"/><circle class="io-led" cx="' + (x + 17) + '" cy="' + (y + 46) + '" r="3"/></g>'; }
  function pc(x, y) { return '<g class="io-dev"><rect x="' + x + '" y="' + y + '" width="50" height="34" rx="3"/><rect class="io-scr" x="' + (x + 4) + '" y="' + (y + 4) + '" width="42" height="26" rx="1"/><path d="M' + (x + 25) + ' ' + (y + 34) + 'v8M' + (x + 12) + ' ' + (y + 44) + 'h26"/></g>'; }
  function tab(x, y, w, text, cls) { return '<g class="io-tab ' + cls + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="26" rx="6"/><text x="' + (x + w / 2) + '" y="' + (y + 17.5) + '" text-anchor="middle">' + text + '</text></g>'; }
  function card(x, y, w, hgt) { return '<rect class="io-card" x="' + x + '" y="' + y + '" width="' + w + '" height="' + hgt + '" rx="10"/>'; }
  function lines(x, y, arr) { return arr.map(function (t, i) { return '<text class="io-t" x="' + x + '" y="' + (y + i * 21) + '">' + t + '</text>'; }).join(''); }
  function link(x1, y1, x2, y2, label, lx, ly, dashed) {
    return '<path class="io-link' + (dashed ? ' dash' : '') + '" d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '"/><circle class="io-dot" cx="' + x1 + '" cy="' + y1 + '" r="5"/><circle class="io-dot" cx="' + x2 + '" cy="' + y2 + '" r="5"/><text class="io-port" x="' + lx + '" y="' + ly + '">' + label + '</text>';
  }
  function topology() {
    var ports = ''; for (var i = 0; i < 8; i++) ports += '<rect class="io-port-hole" x="' + (390 + i * 23) + '" y="74" width="17" height="14" rx="2"/>';
    return '<svg class="io-topo" viewBox="0 0 960 330" role="img" aria-labelledby="io-topo-t"><title id="io-topo-t">Lab topology: a DHCP server on Gi0/1, two client PCs on Gi0/2 and Gi0/3, and the router (gateway 10.0.0.1) on Gi0/24 of a Cisco switch. The DNS server is 10.0.0.20.</title>' +
      card(8, 34, 252, 128) + tab(24, 20, 140, 'DHCP SERVER', 'k-g') + server(24, 66) + lines(74, 76, ['IP: 10.0.0.10', 'Subnet: 10.0.0.0/24', 'Gateway: 10.0.0.1', 'DNS: 10.0.0.20']) +
      tab(410, 8, 140, 'CISCO SWITCH', 'k-b') +
      '<g class="io-sw"><rect x="372" y="46" width="216" height="62" rx="8"/><path class="io-sw-top" d="M372 54h216"/>' + ports + '</g>' +
      card(700, 34, 252, 128) + tab(716, 20, 170, 'ROUTER (GATEWAY)', 'k-g') +
      '<g class="io-dev"><ellipse cx="748" cy="100" rx="28" ry="18"/><path d="M732 96l10 0M742 92v8M764 104h-10M754 100v8"/></g>' + lines(790, 94, ['IP: 10.0.0.1', 'Subnet: 10.0.0.0/24']) +
      link(260, 80, 372, 80, 'Gi0/1', 300, 70) + link(588, 80, 700, 80, 'Gi0/24', 622, 70) +
      link(430, 108, 430, 214, 'Gi0/2', 440, 160, true) + link(530, 108, 530, 214, 'Gi0/3', 540, 160, true) +
      card(250, 214, 200, 100) + pc(266, 238) + '<text class="io-h k-b" x="328" y="240">CLIENT PC-1</text>' + lines(328, 266, ['IP: via DHCP', 'DNS: via DHCP']) +
      card(510, 214, 200, 100) + pc(526, 238) + '<text class="io-h k-b" x="588" y="240">CLIENT PC-2</text>' + lines(588, 266, ['IP: via DHCP', 'DNS: via DHCP']) +
      card(752, 214, 200, 100) + tab(768, 200, 130, 'DNS SERVER', 'k-g') + server(770, 238) + lines(816, 274, ['IP: 10.0.0.20']) +
      '</svg>';
  }

  var PANELS = [
    { n: 1, c: 'k-b', icon: 'shield', title: 'DHCP snooping and the trusted port', code:
      'Switch# configure terminal\nSwitch(config)# ip dhcp snooping\nSwitch(config)# ip dhcp snooping vlan 10\nSwitch(config)# no ip dhcp snooping information option\nSwitch(config)# interface GigabitEthernet0/1\nSwitch(config-if)# ip dhcp snooping trust\nSwitch(config-if)# exit\nSwitch(config)# interface range GigabitEthernet0/2 - 23\nSwitch(config-if-range)# ip dhcp snooping limit rate 15\nSwitch(config-if-range)# end',
      note: ['Snooping drops DHCP offers that arrive on untrusted ports, so a rogue DHCP server on a desk port cannot hand out a fake gateway.', 'Trust only the port that leads to the real DHCP server (and uplinks toward it).'] },
    { n: 2, c: 'k-g', icon: 'relay', title: 'DHCP relay (server in another subnet)', code:
      'Switch# configure terminal\nSwitch(config)# interface vlan 10\nSwitch(config-if)# ip address 10.0.0.2 255.255.255.0\nSwitch(config-if)# ip helper-address 10.0.0.10\nSwitch(config-if)# no shutdown\nSwitch(config-if)# end',
      note: ['ip helper-address turns the client\'s broadcast DHCP Discover into a unicast to the server, so one DHCP server can serve many VLANs.'] },
    { n: 3, c: 'k-o', icon: 'globe', title: 'DNS for clients (handed out by DHCP)', code:
      'Router(config)# ip dhcp excluded-address 10.0.0.1 10.0.0.20\nRouter(config)# ip dhcp pool VLAN10\nRouter(dhcp-config)# network 10.0.0.0 255.255.255.0\nRouter(dhcp-config)# default-router 10.0.0.1\nRouter(dhcp-config)# dns-server 10.0.0.20\nRouter(dhcp-config)# domain-name networkdna.local\nRouter(dhcp-config)# lease 7\n!\nRouter(config)# ip name-server 10.0.0.20\nRouter(config)# ip domain lookup',
      note: ['Clients learn the DNS server from option 6 of the DHCP offer. ip name-server is for the device itself (so ping www.example.com works from the CLI).'] },
    { n: 4, c: 'k-p', icon: 'search', title: 'Verification commands', code:
      'Switch# show ip dhcp snooping\nSwitch# show ip dhcp snooping binding\nSwitch# show ip dhcp snooping statistics\nSwitch# show ip interface vlan 10\nRouter# show ip dhcp binding\nRouter# show ip dhcp pool\nSwitch# ping 10.0.0.10\nSwitch# ping 10.0.0.20\nSwitch# ping www.example.com',
      note: ['Ping .10 tests the DHCP server, .20 the DNS server, and a name tests resolution end to end.'] }
  ];

  W.iosinfo = function () {
    var r = h('div', { class: 'wg io' });
    var o = '<div class="io-hero"><h4 class="io-title"><span class="k-g">DHCP</span> &amp; <span class="k-b">DNS</span> <span class="k-n">on Cisco IOS</span></h4><div class="io-rule"><i></i><span>A worked lab, one page</span><i></i></div></div>';
    o += '<div class="io-topo-wrap">' + topology() + '</div><div class="io-grid">';
    PANELS.forEach(function (p) {
      o += '<section class="io-p ' + p.c + '"><h5><span class="io-n">' + p.n + '</span>' + esc(p.title) + '</h5><div class="io-body"><span class="io-ic">' + ICON[p.icon] + '</span><div class="io-main">' + cb(p.code) +
        '<ul class="io-note">' + p.note.map(function (t) { return '<li>' + K.inl(t) + '</li>'; }).join('') + '</ul></div></div></section>';
    });
    o += '</div><div class="io-foot">' +
      '<section class="io-f k-b"><h5>' + ICON.gear + 'How it works</h5><ol><li>The client broadcasts a DHCP Discover.</li><li>The switch (with snooping) checks the port it came from and records the lease.</li><li>The DHCP server offers an IP address, mask, gateway and DNS server.</li><li>The client uses that DNS server to resolve names.</li></ol></section>' +
      '<section class="io-f k-o"><h5>' + ICON.star + 'Best practices</h5><ul class="io-checks"><li>Enable DHCP snooping on every access switch.</li><li>Trust only ports that lead to the real DHCP server.</li><li>Rate-limit DHCP on access ports.</li><li>Always hand out a DNS server with the lease.</li><li>Check the binding table regularly.</li></ul></section>' +
      '<section class="io-f k-g"><h5>' + ICON.check + 'Quick summary</h5><dl><dt>DHCP server</dt><dd>10.0.0.10</dd><dt>DNS server</dt><dd>10.0.0.20</dd><dt>Default gateway</dt><dd>10.0.0.1</dd><dt>VLAN</dt><dd>10</dd><dt>Clients</dt><dd>10.0.0.x via DHCP</dd></dl></section>' +
      '</div>';
    r.innerHTML = o;
    return r;
  };

  /* ---------- the mode ladder ---------- */
  var MODES = [
    { p: 'Router>', n: 'User EXEC', d: 0, in: 'Log in on the console, or over SSH/Telnet.', out: 'logout or exit', what: 'Look, do not touch: a few show commands, ping and traceroute. No configuration and no show running-config.',
      c: [['enable', 'go to privileged EXEC'], ['show version', 'IOS version, uptime, model'], ['show ip interface brief', 'interfaces at a glance (limited)'], ['ping 10.0.0.1', 'basic reachability'], ['traceroute 8.8.8.8', 'path to a host'], ['terminal length 0', 'no --More-- paging this session']] },
    { p: 'Router#', n: 'Privileged EXEC', d: 1, in: 'enable (asks for the enable secret)', out: 'disable (back to >), logout or exit', what: 'Everything you can see and do without changing the configuration: every show and debug, copy, reload, clear.',
      c: [['configure terminal', 'enter global configuration'], ['show running-config', 'the live configuration in RAM'], ['copy running-config startup-config', 'save (same as write memory)'], ['reload', 'restart the device'], ['debug ip packet', 'live packet debugging (careful)'], ['undebug all', 'stop every debug'], ['clear counters', 'zero the interface counters'], ['clock set 14:30:00 18 Nov 2026', 'set the clock']] },
    { p: 'Router(config)#', n: 'Global configuration', d: 2, in: 'configure terminal (conf t)', out: 'exit or end, or Ctrl-Z, back to #', what: 'Settings for the whole device. Every line you type takes effect immediately in the running config.',
      c: [['hostname R1', 'name the device'], ['enable secret S3cret!', 'privileged password (hashed)'], ['ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'default route'], ['ip domain-name lab.local', 'needed before SSH keys'], ['crypto key generate rsa modulus 2048', 'make SSH keys'], ['banner motd #Authorised only#', 'login banner'], ['do show ip route', 'run an EXEC command without leaving']] },
    { p: 'Router(config-if)#', n: 'Interface', d: 3, in: 'interface GigabitEthernet0/1', out: 'exit (to config), end (to #)', what: 'One physical or logical interface: addressing, speed, VLAN membership, ACLs, NAT role.',
      c: [['ip address 10.0.0.1 255.255.255.0', 'address and mask'], ['no shutdown', 'bring it up'], ['description Uplink to ISP', 'label it'], ['ip helper-address 10.0.0.10', 'DHCP relay'], ['ip access-group 101 in', 'apply ACL 101 inbound'], ['ip nat inside', 'mark as NAT inside']] },
    { p: 'Router(config-if-range)#', n: 'Interface range', d: 3, in: 'interface range Gi0/2 - 24', out: 'exit or end', what: 'The same interface commands, applied to many ports at once.',
      c: [['switchport mode access', 'fixed access ports'], ['switchport access vlan 10', 'all in VLAN 10'], ['spanning-tree portfast', 'skip STP listening/learning'], ['shutdown', 'disable unused ports']] },
    { p: 'Router(config-subif)#', n: 'Sub-interface', d: 3, in: 'interface GigabitEthernet0/0.10', out: 'exit or end', what: 'A logical interface on a trunk, one per VLAN: router-on-a-stick.',
      c: [['encapsulation dot1Q 10', 'tag this sub-interface with VLAN 10'], ['ip address 10.0.10.1 255.255.255.0', 'gateway for VLAN 10']] },
    { p: 'Router(config-line)#', n: 'Line', d: 3, in: 'line console 0 or line vty 0 15', out: 'exit or end', what: 'How people log in: console port, remote vty lines (SSH/Telnet), aux.',
      c: [['login local', 'use local usernames'], ['transport input ssh', 'SSH only, no Telnet'], ['exec-timeout 10 0', 'log out after 10 idle minutes'], ['logging synchronous', 'stop log messages breaking your typing'], ['access-class 10 in', 'which hosts may connect']] },
    { p: 'Router(config-router)#', n: 'Routing protocol', d: 3, in: 'router ospf 1, router eigrp 100, router rip, router bgp 65001', out: 'exit or end', what: 'One routing process: which networks it advertises, neighbours, redistribution.',
      c: [['network 10.0.0.0 0.0.0.255 area 0', 'OSPF: enable on matching interfaces'], ['router-id 1.1.1.1', 'fixed router ID'], ['passive-interface default', 'no hellos unless allowed'], ['no passive-interface Gi0/0', 'allow hellos on one'], ['default-information originate', 'advertise the default route']] },
    { p: 'Switch(config-vlan)#', n: 'VLAN', d: 3, in: 'vlan 10', out: 'exit or end (the VLAN is created on exit)', what: 'Creates and names VLANs in the VLAN database.',
      c: [['name USERS', 'name the VLAN'], ['state active', 'default state']] },
    { p: 'Router(dhcp-config)#', n: 'DHCP pool', d: 3, in: 'ip dhcp pool LAN', out: 'exit or end', what: 'The IOS DHCP server: what a client receives.',
      c: [['network 10.0.0.0 255.255.255.0', 'the scope'], ['default-router 10.0.0.1', 'gateway (option 3)'], ['dns-server 10.0.0.20', 'DNS (option 6)'], ['lease 7', 'lease length in days']] },
    { p: 'Router(config-ext-nacl)#', n: 'Named ACL', d: 3, in: 'ip access-list extended WEB-IN', out: 'exit or end', what: 'Entries of a named access list, with sequence numbers you can insert between.',
      c: [['permit tcp any host 10.0.0.80 eq 443', 'allow HTTPS to one host'], ['15 deny ip host 198.51.100.9 any', 'insert at sequence 15'], ['no 20', 'delete entry 20'], ['deny ip any any log', 'explicit deny, logged']] }
  ];

  W.iosmodes = function () {
    var r = h('div', { class: 'wg io io-modes' });
    r.innerHTML = '<h4>The IOS mode ladder</h4><p class="sub">The prompt always tells you where you are. Pick one to see how you got there, how to leave, and what you can type there. <kbd>end</kbd> or <kbd>Ctrl</kbd>+<kbd>Z</kbd> jumps from any configuration mode straight back to <code>#</code>.</p>' +
      '<div class="io-lad"><div class="io-steps" role="tablist" aria-label="IOS modes"></div><div class="io-det" role="tabpanel" aria-live="polite"></div></div>';
    var steps = r.querySelector('.io-steps'), det = r.querySelector('.io-det'), cur = 0;
    steps.innerHTML = MODES.map(function (m, i) { return '<button type="button" role="tab" class="io-step d' + m.d + '" data-i="' + i + '"><code>' + esc(m.p) + '</code><span>' + esc(m.n) + '</span></button>'; }).join('');
    function draw() {
      var m = MODES[cur];
      Array.prototype.forEach.call(steps.children, function (b, i) { b.classList.toggle('on', i === cur); b.setAttribute('aria-selected', i === cur ? 'true' : 'false'); b.tabIndex = i === cur ? 0 : -1; });
      det.innerHTML = '<div class="io-pr"><code>' + esc(m.p) + '</code> ' + esc(m.n) + '</div><p>' + esc(m.what) + '</p><dl class="io-io"><dt>Get here</dt><dd><code>' + esc(m.in) + '</code></dd><dt>Leave</dt><dd><code>' + esc(m.out) + '</code></dd></dl>' +
        '<table class="io-cmds"><tbody>' + m.c.map(function (c) { return '<tr><td><code>' + K.hlIos(c[0]) + '</code></td><td>' + esc(c[1]) + '</td></tr>'; }).join('') + '</tbody></table>';
    }
    steps.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b) return; cur = +b.getAttribute('data-i'); draw(); });
    steps.addEventListener('keydown', function (e) {
      var k = e.key, n = MODES.length;
      if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'ArrowRight' && k !== 'ArrowLeft' && k !== 'Home' && k !== 'End') return;
      e.preventDefault();
      cur = k === 'Home' ? 0 : k === 'End' ? n - 1 : (cur + (k === 'ArrowDown' || k === 'ArrowRight' ? 1 : n - 1)) % n;
      draw(); steps.children[cur].focus();
    });
    draw();
    return r;
  };
})();
