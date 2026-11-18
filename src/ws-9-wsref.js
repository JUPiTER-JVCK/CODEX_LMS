/* Reference part: Wireshark cheat sheet pictures. One widget, "wsart", draws the diagram named by args.kind as inline SVG.
   Colours come from CSS classes in src/wsref.add.css, so every picture follows the light and dark themes. */
(function () {
  'use strict';
  if (!window.__core) return;
  var K = window.__core, $ = K.$, $$ = K.$$, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};

  function svg(vb, label, body, minw) {
    return '<div class="wr-scroll"><svg viewBox="' + vb + '" role="img" aria-label="' + esc(label) + '" style="min-width:' + (minw || 560) + 'px">' +
      '<defs><marker id="wr-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0 0L10 5L0 10z" class="wr-ahp"/></marker>' +
      '<marker id="wr-ahA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0 0L10 5L0 10z" class="wr-ahpA"/></marker></defs>' + body + '</svg></div>';
  }
  function T(x, y, s, cls, extra) { return '<text x="' + x + '" y="' + y + '" class="' + (cls || 'wr-t') + '"' + (extra || '') + '>' + esc(s) + '</text>'; }
  function R(x, y, w, hh, cls, rx) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hh + '" rx="' + (rx == null ? 6 : rx) + '" class="' + cls + '"/>'; }
  function badge(x, y, n) { return '<g class="wr-badge" data-n="' + n + '" tabindex="0"><circle cx="' + x + '" cy="' + y + '" r="11"/>' + T(x, y + 4.5, String(n), 'wr-bt', ' text-anchor="middle"') + '</g>'; }
  function wrap(title, sub) {
    var r = h('div', { class: 'wg wr' });
    r.innerHTML = '<h4>' + esc(title) + '</h4>' + (sub ? '<p class="sub">' + sub + '</p>' : '');
    return r;
  }

  /* ---------- hero art: a fin cutting through a stream of packets, with a filter lens ---------- */
  function hero() {
    var r = h('div', { class: 'wr wr-hero' });
    var pk = [['TCP', 'p-tcp', 40, 176], ['DNS', 'p-udp', 112, 190], ['HTTP', 'p-http', 184, 172], ['ARP', 'p-arp', 256, 186],
      ['TLS', 'p-tcp', 330, 178], ['ICMP', 'p-icmp', 630, 184], ['RST', 'p-rst', 696, 172]];
    var b = '<rect x="0" y="0" width="760" height="270" class="wr-sky"/>';
    for (var i = 0; i < 14; i++) b += '<circle cx="' + (20 + i * 53) % 760 + '" cy="' + (22 + (i * 37) % 90) + '" r="' + (1 + i % 3 * 0.6) + '" class="wr-star"/>';
    b += T(34, 66, 'WIRESHARK', 'wr-h1') + T(36, 96, 'cheat sheet & field guide', 'wr-h2');
    b += T(36, 124, 'capture  ·  filter  ·  follow  ·  prove', 'wr-h3');
    // waves behind the packets
    b += '<path d="M0 180 C 60 168 120 192 190 180 S 320 168 390 180 S 520 192 590 180 S 700 168 760 180 L760 270 L0 270Z" class="wr-w1"/>';
    // the fin
    b += '<path d="M455 182 C 490 150 520 92 548 38 C 552 30 560 30 560 40 C 556 92 572 150 612 182 Z" class="wr-fin"/>';
    b += '<path d="M548 38 C 552 30 560 30 560 40 C 557 80 565 128 586 160 C 560 130 548 90 548 38Z" class="wr-fin2"/>';
    // packet stream
    pk.forEach(function (p) { b += R(p[2], p[3], 56, 26, 'wr-pk ' + p[1], 6) + T(p[2] + 28, p[3] + 17.5, p[0], 'wr-pkt', ' text-anchor="middle"'); });
    b += '<path d="M0 210 C 120 224 240 198 380 212 S 620 224 760 204 L760 270 L0 270Z" class="wr-w2"/>';
    b += '<path d="M0 246 C 140 238 260 258 400 246 S 640 238 760 250 L760 270 L0 270Z" class="wr-w3"/>';
    // the lens, filtering one packet out of the stream
    b += '<g class="wr-lens"><circle cx="420" cy="118" r="46" class="wr-glass"/><circle cx="420" cy="118" r="46" class="wr-rim"/>' +
      '<line x1="452" y1="152" x2="482" y2="184" class="wr-handle"/>' + R(388, 104, 64, 28, 'wr-pk p-http', 6) + T(420, 123, 'POST', 'wr-pkt', ' text-anchor="middle"') + '</g>';
    b += R(36, 142, 268, 28, 'wr-fbar', 7) + T(48, 161, 'http.request.method == "POST"', 'wr-mono');
    r.innerHTML = svg('0 0 760 270', 'Illustration: a shark fin cutting through a stream of coloured packets while a magnifying lens lifts out one HTTP POST that matches the display filter http.request.method == "POST"', b, 520);
    return r;
  }

  /* ---------- the window, with numbered parts ---------- */
  var PARTS = [
    ['Main toolbar', 'Start (the blue fin, ⌘E), stop (red square), restart, open, save. The fin is grey until you pick an interface.'],
    ['Display filter bar', 'Type a display filter and press Return. Green means valid, red means a syntax error, yellow means valid but probably not what you meant.'],
    ['Packet list', 'One row per packet with the default columns. Row colours come from the colouring rules. Click a row to inspect it.'],
    ['Packet details', 'The selected packet as a tree: one branch per layer, Frame, Ethernet, IP, TCP, then the application. Every line is a field you can filter on.'],
    ['Packet bytes', 'The raw bytes in hex and ASCII. Selecting a field in the details highlights its bytes here, and the other way round.'],
    ['Status bar', 'Total and displayed packet counts, the field name of whatever you selected, and the configuration profile in use.']
  ];
  function windowArt() {
    var r = wrap('The Wireshark window', 'Hover or tap a number. The same six parts are in every version of Wireshark, on every system.');
    var b = R(10, 6, 740, 470, 'wr-win', 10) + '<path d="M10 34 H750" class="wr-sep"/>';
    b += '<circle cx="30" cy="20" r="5.5" class="wr-dr"/><circle cx="48" cy="20" r="5.5" class="wr-dy"/><circle cx="66" cy="20" r="5.5" class="wr-dg"/>' + T(380, 24, 'Wi-Fi: en0', 'wr-m', ' text-anchor="middle"');
    // toolbar
    b += '<path d="M28 64 C 34 56 38 48 41 40 C 42 39 44 39 44 41 C 43 48 46 57 52 64Z" class="wr-fin"/>' + R(62, 44, 18, 18, 'wr-stop', 3) +
      '<circle cx="100" cy="53" r="8" class="wr-rest"/>' + R(122, 45, 18, 16, 'wr-tool', 3) + R(148, 45, 18, 16, 'wr-tool', 3) + R(174, 45, 18, 16, 'wr-tool', 3);
    b += '<path d="M10 72 H750" class="wr-sep"/>';
    // filter bar
    b += R(22, 80, 640, 26, 'wr-fbar', 6) + T(34, 98, 'tcp.port == 443 && ip.addr == 192.168.1.23', 'wr-mono') + R(670, 80, 66, 26, 'wr-tool', 6) + T(703, 98, 'Apply', 'wr-m', ' text-anchor="middle"');
    // packet list
    var cols = [['No.', 26], ['Time', 70], ['Source', 140], ['Destination', 262], ['Protocol', 384], ['Length', 456], ['Info', 518]];
    b += R(22, 114, 714, 20, 'wr-head', 0);
    cols.forEach(function (c) { b += T(c[1], 128, c[0], 'wr-ch'); });
    var rows = [
      ['p-syn', '1', '0.000000', '192.168.1.23', '203.0.113.10', 'TCP', '78', '52100 → 443 [SYN] Seq=0'],
      ['p-syn', '2', '0.021310', '203.0.113.10', '192.168.1.23', 'TCP', '74', '443 → 52100 [SYN, ACK] Seq=0 Ack=1'],
      ['p-tcp', '3', '0.021405', '192.168.1.23', '203.0.113.10', 'TCP', '66', '52100 → 443 [ACK] Seq=1 Ack=1'],
      ['p-tcp sel', '4', '0.021822', '192.168.1.23', '203.0.113.10', 'TLSv1.3', '583', 'Client Hello (SNI=intranet.lab.example)'],
      ['p-tcp', '5', '0.043901', '203.0.113.10', '192.168.1.23', 'TLSv1.3', '1514', 'Server Hello, Change Cipher Spec'],
      ['p-rst', '6', '0.402117', '203.0.113.10', '192.168.1.23', 'TCP', '60', '443 → 52101 [RST, ACK] Seq=1 Ack=1']
    ];
    rows.forEach(function (rw, i) {
      var y = 134 + i * 19;
      b += R(22, y, 714, 19, 'wr-row ' + rw[0], 0);
      for (var j = 1; j < rw.length; j++) b += T(cols[j - 1][1], y + 14, rw[j], 'wr-cell' + (rw[0].indexOf('sel') >= 0 ? ' wr-cs' : rw[0].indexOf('p-rst') >= 0 ? ' wr-cr' : ''));
    });
    b += '<path d="M10 252 H750" class="wr-sep"/>';
    // details
    var det = [['▸', 'Frame 4: 583 bytes on wire (4664 bits), 583 bytes captured', 0],
      ['▸', 'Ethernet II, Src: 3c:37:86:c1:5a:02, Dst: 66:66:66:13:37:01', 0],
      ['▸', 'Internet Protocol Version 4, Src: 192.168.1.23, Dst: 203.0.113.10', 0],
      ['▸', 'Transmission Control Protocol, Src Port: 52100, Dst Port: 443', 0],
      ['▾', 'Transport Layer Security', 0],
      ['', 'Server Name: intranet.lab.example', 1]];
    det.forEach(function (d, i) {
      var y = 274 + i * 18, x = 30 + d[2] * 30;
      if (d[2]) b += R(x - 6, y - 13, 330, 18, 'wr-hl', 3);
      b += T(x, y, d[0], 'wr-m') + T(x + 14, y, d[1], 'wr-cell');
    });
    b += '<path d="M10 384 H750" class="wr-sep"/>';
    // bytes
    var hex = [['0000', '66 66 66 13 37 01 3c 37  86 c1 5a 02 08 00 45 00', 'fff.7.<7..Z...E.'],
      ['00f0', '00 18 00 00 15 69 6e 74  72 61 6e 65 74 2e 6c 61', '.....intranet.la'],
      ['0100', '62 2e 65 78 61 6d 70 6c  65 00 0a 00 0a 00 08 00', 'b.example.......']];
    hex.forEach(function (x, i) {
      var y = 404 + i * 18, cw = 6.6;
      // highlight the bytes of the selected field: "intranet.la" on the second line, "b.example" on the third
      if (i === 1) b += R(78 + 5 * 3 * cw - 3, y - 13, 11 * 3 * cw + 6, 17, 'wr-hl', 3) + R(470 + 5 * cw - 2, y - 13, 11 * cw + 4, 17, 'wr-hl', 3);
      if (i === 2) b += R(78 - 3, y - 13, 9 * 3 * cw + 6, 17, 'wr-hl', 3) + R(470 - 2, y - 13, 9 * cw + 4, 17, 'wr-hl', 3);
      b += T(30, y, x[0], 'wr-m wr-mono') + T(78, y, x[1], 'wr-cell wr-mono', ' xml:space="preserve"') + T(470, y, x[2], 'wr-cell wr-mono');
    });
    b += '<path d="M10 448 H750" class="wr-sep"/>' + R(10, 448, 740, 28, 'wr-statusbg', 0);
    b += T(24, 466, 'Packets: 1284 · Displayed: 6 (0.5%)', 'wr-m') + T(330, 466, 'tls.handshake.extensions_server_name', 'wr-m wr-mono') + T(736, 466, 'Profile: Default', 'wr-m', ' text-anchor="end"');
    // badges
    b += badge(214, 53, 1) + badge(724, 93 - 26, 2) + badge(746, 124, 3) + badge(740, 268, 4) + badge(740, 400, 5) + badge(300, 462, 6);
    var box = h('div', {});
    box.innerHTML = svg('0 0 760 482', 'Diagram of the Wireshark window with six numbered parts: toolbar, display filter bar, packet list, packet details, packet bytes and status bar', b, 620);
    r.appendChild(box);
    var ol = h('ol', { class: 'wr-legend' });
    ol.innerHTML = PARTS.map(function (p, i) { return '<li data-n="' + (i + 1) + '"><b>' + esc(p[0]) + '.</b> ' + esc(p[1]) + '</li>'; }).join('');
    r.appendChild(ol);
    function hot(n) {
      $$('.wr-badge', r).forEach(function (g) { g.classList.toggle('on', g.getAttribute('data-n') === n); });
      $$('li', ol).forEach(function (li) { li.classList.toggle('on', li.getAttribute('data-n') === n); });
    }
    r.addEventListener('mouseover', function (e) { var t = e.target.closest('[data-n]'); if (t) hot(t.getAttribute('data-n')); });
    r.addEventListener('focusin', function (e) { var t = e.target.closest('[data-n]'); if (t) hot(t.getAttribute('data-n')); });
    r.addEventListener('click', function (e) { var t = e.target.closest('[data-n]'); if (t) hot(t.getAttribute('data-n')); });
    return r;
  }

  /* ---------- capture filter vs display filter pipeline ---------- */
  function pipeline() {
    var r = wrap('Two filters, two places', 'A capture filter throws packets away before they are saved. A display filter only hides saved packets from view.');
    var bx = [[16, 'Network card', 'en0 (Wi-Fi)', 'wr-box'], [168, 'Capture filter', 'tcp port 80', 'wr-box wr-cap'], [320, 'Saved file', 'capture.pcapng', 'wr-box'],
      [472, 'Display filter', 'http.request', 'wr-box wr-disp'], [624, 'Packet list', 'what you see', 'wr-box']];
    var b = '';
    b += R(150, 18, 156, 24, 'wr-zone wr-zcap', 12) + T(228, 34, 'BPF / tcpdump syntax', 'wr-zt', ' text-anchor="middle"');
    b += R(454, 18, 156, 24, 'wr-zone wr-zdisp', 12) + T(532, 34, 'Wireshark field syntax', 'wr-zt', ' text-anchor="middle"');
    bx.forEach(function (x) {
      b += R(x[0], 58, 120, 66, x[3], 10) + T(x[0] + 60, 84, x[1], 'wr-bt2', ' text-anchor="middle"') + T(x[0] + 60, 106, x[2], 'wr-mono wr-small', ' text-anchor="middle"');
    });
    for (var i = 0; i < 4; i++) b += '<line x1="' + (138 + i * 152) + '" y1="91" x2="' + (166 + i * 152) + '" y2="91" class="wr-arrow" marker-end="url(#wr-ah)"/>';
    b += T(396, 146, 'dissectors name every field', 'wr-m wr-small', ' text-anchor="middle"');
    // drops
    b += '<line x1="228" y1="124" x2="228" y2="170" class="wr-arrow wr-bad" marker-end="url(#wr-ahA)"/>' + R(152, 172, 152, 46, 'wr-box wr-lost', 10) +
      T(228, 192, 'dropped', 'wr-bt2', ' text-anchor="middle"') + T(228, 209, 'never saved, gone', 'wr-small wr-m', ' text-anchor="middle"');
    b += '<line x1="532" y1="124" x2="532" y2="170" class="wr-arrow" marker-end="url(#wr-ah)"/>' + R(456, 172, 152, 46, 'wr-box wr-hidden', 10) +
      T(532, 192, 'hidden', 'wr-bt2', ' text-anchor="middle"') + T(532, 209, 'still in the file', 'wr-small wr-m', ' text-anchor="middle"');
    // packets flowing
    var dots = ['p-http', 'p-udp', 'p-tcp', 'p-arp', 'p-http'];
    dots.forEach(function (c, k) { b += R(24 + k * 20, 134, 14, 14, 'wr-pk ' + c, 3); });
    r.appendChild(h('div', {}));
    r.lastChild.innerHTML = svg('0 0 760 230', 'Flow diagram: packets go from the network card through the capture filter, which drops packets permanently, into the saved file, then through the display filter, which only hides packets, to the packet list', b, 600);
    return r;
  }

  /* ---------- layers and field prefixes ---------- */
  function layers() {
    var r = wrap('One frame, four layers', 'Each layer wraps the next. Its name becomes the first part of every field inside it. Byte offsets are for IPv4 and TCP without options.');
    var seg = [[20, 150, 'Ethernet', '14 B', 'eth.', 'p-eth', ['eth.src', 'eth.dst', 'eth.type']],
      [150, 310, 'IPv4', '20 B', 'ip.', 'p-ip', ['ip.src', 'ip.dst', 'ip.ttl', 'ip.proto']],
      [310, 470, 'TCP', '20 B', 'tcp.', 'p-tcp', ['tcp.srcport', 'tcp.dstport', 'tcp.flags', 'tcp.stream']],
      [470, 700, 'HTTP payload', 'the rest', 'http.', 'p-http', ['http.host', 'http.request.method', 'http.request.uri', 'http.cookie']],
      [700, 740, 'FCS', '4 B', '', 'p-fcs', []]];
    var b = '';
    // nesting brackets
    var nest = [[20, 740, 'Ethernet frame', 18], [150, 700, 'IP packet', 40], [310, 700, 'TCP segment', 62], [470, 700, 'HTTP message', 84]];
    nest.forEach(function (n) {
      b += '<path d="M' + n[0] + ' ' + (n[3] + 14) + ' V' + (n[3] + 6) + ' H' + n[1] + ' V' + (n[3] + 14) + '" class="wr-brk"/>' + T(n[0] + 6, n[3] + 2, n[2], 'wr-m wr-small');
    });
    seg.forEach(function (s) {
      b += R(s[0], 108, s[1] - s[0], 48, 'wr-seg ' + s[5], 0) + T((s[0] + s[1]) / 2, 129, s[2], 'wr-bt2', ' text-anchor="middle"') +
        (s[1] - s[0] > 60 ? T((s[0] + s[1]) / 2, 147, s[3], 'wr-small wr-m', ' text-anchor="middle"') : '');
      if (s[4]) {
        b += R(s[0] + 8, 172, 54, 22, 'wr-chip ' + s[5], 11) + T(s[0] + 35, 187, s[4], 'wr-mono wr-small', ' text-anchor="middle"');
        s[6].forEach(function (f, i) { b += T(s[0] + 10, 214 + i * 17, f, 'wr-mono wr-small'); });
      }
    });
    [[20, '0'], [150, '14'], [310, '34'], [470, '54']].forEach(function (o) { b += '<path d="M' + o[0] + ' 156 V164" class="wr-sep"/>' + T(o[0] + 3, 167, o[1], 'wr-tiny wr-m'); });
    r.appendChild(h('div', {}));
    r.lastChild.innerHTML = svg('0 0 760 290', 'Diagram of one Ethernet frame split into Ethernet, IPv4, TCP and HTTP layers, each with its display filter prefix (eth., ip., tcp., http.) and example fields', b, 620);
    return r;
  }

  /* ---------- TCP conversation sequence diagram ---------- */
  function handshake() {
    var r = wrap('A TCP conversation', 'Client on the left, server on the right, time running down. The filter on each arrow finds that kind of packet.');
    var L = 120, Rx = 440, b = '';
    b += R(L - 70, 14, 140, 34, 'wr-box', 8) + T(L, 36, 'Client  :52100', 'wr-bt2', ' text-anchor="middle"');
    b += R(Rx - 70, 14, 140, 34, 'wr-box', 8) + T(Rx, 36, 'Server  :443', 'wr-bt2', ' text-anchor="middle"');
    b += '<line x1="' + L + '" y1="48" x2="' + L + '" y2="452" class="wr-life"/><line x1="' + Rx + '" y1="48" x2="' + Rx + '" y2="452" class="wr-life"/>';
    var steps = [
      [1, '[SYN] Seq=0', 'tcp.flags.syn==1 && tcp.flags.ack==0', 'open'],
      [-1, '[SYN, ACK] Seq=0 Ack=1', 'tcp.flags == 0x012', 'open'],
      [1, '[ACK] Seq=1 Ack=1', 'handshake complete', 'open'],
      [1, '[PSH, ACK] Len=517 (data)', 'tcp.len > 0', 'data'],
      [-1, '[ACK] Ack=518', 'tcp.analysis.ack_rtt', 'data'],
      [1, '[FIN, ACK]', 'tcp.flags.fin == 1', 'close'],
      [-1, '[FIN, ACK]', '', 'close'],
      [1, '[ACK]', '', 'close']
    ];
    steps.forEach(function (s, i) {
      var y0 = 66 + i * 46, y1 = y0 + 26, x0 = s[0] > 0 ? L : Rx, x1 = s[0] > 0 ? Rx - 4 : L + 4;
      b += '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + y1 + '" class="wr-arrow wr-' + s[3] + '" marker-end="url(#wr-ah)"/>';
      b += T((L + Rx) / 2, (y0 + y1) / 2 - 6, s[1], 'wr-bt2 wr-small', ' text-anchor="middle"');
      if (s[2]) b += T(Rx + 20, (y0 + y1) / 2 + 4, s[2], 'wr-mono wr-small wr-f-' + s[3]);
    });
    b += '<path d="M28 62 V196" class="wr-ph wr-open"/>' + T(22, 130, 'open', 'wr-small wr-m', ' text-anchor="middle" transform="rotate(-90 22 130)"');
    b += '<path d="M28 200 V288" class="wr-ph wr-data"/>' + T(22, 244, 'data', 'wr-small wr-m', ' text-anchor="middle" transform="rotate(-90 22 244)"');
    b += '<path d="M28 292 V430" class="wr-ph wr-close"/>' + T(22, 362, 'close', 'wr-small wr-m', ' text-anchor="middle" transform="rotate(-90 22 362)"');
    // the refused case
    b += R(L - 70, 470, 640, 50, 'wr-box wr-lost', 10) + T(L - 56, 491, 'Port closed?  SYN  →  [RST, ACK] comes straight back, no handshake.', 'wr-small wr-t');
    b += T(L - 56, 510, 'Find refusals with', 'wr-small wr-m') + T(L + 70, 510, 'tcp.flags.reset == 1 && tcp.flags.ack == 1', 'wr-mono wr-small wr-f-close');
    r.appendChild(h('div', {}));
    r.lastChild.innerHTML = svg('0 0 760 530', 'Sequence diagram of a TCP connection: SYN, SYN-ACK and ACK to open, data and its acknowledgement, FIN-ACK in both directions to close, with the display filter that finds each step, and a note that a closed port answers a SYN with RST-ACK', b, 640);
    return r;
  }

  /* ---------- interactive TCP flags byte ---------- */
  var FLAGS = [['CWR', 0x80, 'cwr'], ['ECE', 0x40, 'ece'], ['URG', 0x20, 'urg'], ['ACK', 0x10, 'ack'], ['PSH', 0x08, 'push'], ['RST', 0x04, 'reset'], ['SYN', 0x02, 'syn'], ['FIN', 0x01, 'fin']];
  var NAMED = { 0x02: 'a connection attempt (first packet of the handshake)', 0x12: 'SYN-ACK: the port is open and answering', 0x10: 'a plain acknowledgement',
    0x18: 'data being delivered (PSH, ACK)', 0x11: 'FIN-ACK: one side is closing', 0x14: 'RST-ACK: refused, usually a closed port', 0x04: 'a bare reset: connection aborted',
    0x00: 'a NULL scan: no flags at all is never normal', 0x29: 'an Xmas scan: FIN, PSH and URG lit up together', 0x01: 'a FIN scan: FIN with no connection is a probe', 0x03: 'SYN and FIN together: impossible in real traffic, a probe or a bug' };
  function flags() {
    var r = wrap('The TCP flags byte', 'Click the bits. Wireshark shows the byte as tcp.flags; each bit is also its own field.');
    var on = 0x12;
    var row = h('div', { class: 'wr-bits', role: 'group', 'aria-label': 'TCP flag bits' });
    row.innerHTML = FLAGS.map(function (f) { return '<button type="button" class="wr-bit" data-v="' + f[1] + '" aria-pressed="false"><b>' + f[0] + '</b><small>0x' + f[1].toString(16).padStart(2, '0') + '</small></button>'; }).join('');
    var out = h('div', { class: 'wr-fout', 'aria-live': 'polite' });
    var presets = h('div', { class: 'wr-pre' });
    presets.innerHTML = '<span>Try:</span>' + [[0x02, 'SYN'], [0x12, 'SYN, ACK'], [0x18, 'PSH, ACK'], [0x11, 'FIN, ACK'], [0x14, 'RST, ACK'], [0x29, 'Xmas scan'], [0x00, 'NULL scan']]
      .map(function (p) { return '<button type="button" class="chip" data-p="' + p[0] + '">' + esc(p[1]) + '</button>'; }).join('');
    r.appendChild(row); r.appendChild(presets); r.appendChild(out);
    function hex(v) { return '0x' + v.toString(16).padStart(3, '0'); }
    function draw() {
      $$('.wr-bit', row).forEach(function (bt) { var s = (on & +bt.getAttribute('data-v')) !== 0; bt.classList.toggle('on', s); bt.setAttribute('aria-pressed', s ? 'true' : 'false'); });
      var names = FLAGS.filter(function (f) { return on & f[1]; }).map(function (f) { return f[0]; }).reverse();
      var each = FLAGS.filter(function (f) { return on & f[1]; }).map(function (f) { return 'tcp.flags.' + f[2] + ' == 1'; }).reverse();
      out.innerHTML = '<div class="wr-fl"><span>Value</span><code>' + hex(on) + '</code> <span class="wr-bin">' + on.toString(2).padStart(8, '0') + '</span></div>' +
        '<div class="wr-fl"><span>Wireshark shows</span><code>[' + (names.length ? esc(names.join(', ')) : '&lt;None&gt;') + ']</code></div>' +
        '<div class="wr-fl"><span>Exact filter</span><code>tcp.flags == ' + hex(on) + '</code></div>' +
        (each.length ? '<div class="wr-fl"><span>Bit by bit</span><code>' + esc(each.join(' && ')) + '</code></div>' : '') +
        '<p class="wr-means">' + esc(NAMED[on] ? 'This is ' + NAMED[on] + '.' : 'An unusual combination. Unusual flag sets are how scanners fingerprint operating systems.') + '</p>';
    }
    r.addEventListener('click', function (e) {
      var b = e.target.closest('.wr-bit'); if (b) { on ^= +b.getAttribute('data-v'); draw(); return; }
      var p = e.target.closest('[data-p]'); if (p) { on = +p.getAttribute('data-p'); draw(); }
    });
    draw();
    return r;
  }

  var KINDS = { hero: hero, window: windowArt, pipeline: pipeline, layers: layers, handshake: handshake, flags: flags };
  W.wsart = function (args) {
    var f = KINDS[(args && args.kind) || 'hero'];
    if (!f) throw new Error('unknown picture ' + args.kind);
    return f();
  };
})();
