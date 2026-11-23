/* Networking part, "VPNs and Tunnels" chapter. Five widgets:
   vpnpath   who can see what: no VPN, full tunnel, split tunnel, site-to-site
   vpnmtu    tunnel overhead and MTU calculator with a packet-anatomy bar
   wgroute   WireGuard cryptokey routing: AllowedIPs decides where packets go and which ones are accepted
   vpnshake  step-through handshakes: WireGuard, IKEv2 (IPsec) and OpenVPN
   vpncmp    protocol comparison with a "which one fits me" chooser
   Colours come from CSS classes in src/vpn.add.css so every picture follows the light and dark themes. */
(function () {
  'use strict';
  if (!window.__core) return;
  var K = window.__core, $ = K.$, $$ = K.$$, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};

  function wrap(title, sub, cls) {
    var r = h('div', { class: 'wg vp ' + (cls || '') });
    r.innerHTML = '<h4>' + esc(title) + '</h4>' + (sub ? '<p class="sub">' + sub + '</p>' : '');
    return r;
  }
  function chips(items, cur, attr) {
    return items.map(function (it) {
      return '<button type="button" class="chip' + (it[0] === cur ? ' on' : '') + '" ' + attr + '="' + esc(it[0]) + '" aria-pressed="' + (it[0] === cur ? 'true' : 'false') + '">' + esc(it[1]) + '</button>';
    }).join('');
  }

  /* ================= vpnpath ================= */
  function glyph(type, cx, cy) {
    var g = '<g class="vp-gl" transform="translate(' + cx + ' ' + cy + ')">';
    if (type === 'laptop') g += '<rect x="-17" y="-15" width="34" height="23" rx="3"/><path d="M-23 12H23"/>';
    else if (type === 'wifi') g += '<rect x="-18" y="2" width="36" height="12" rx="3"/><path d="M-12 -6a17 17 0 0 1 24 0M-7 -12a24 24 0 0 1 14 0" /><circle cx="0" cy="-1" r="1.5"/>';
    else if (type === 'cloud') g += '<path d="M-17 11a8 8 0 0 1 2-15 12 12 0 0 1 23-2 9 9 0 0 1 4 17z"/>';
    else if (type === 'gateway') g += '<path d="M0 -17l16 6v11c0 9-7 15-16 18-9-3-16-9-16-18v-11z"/><path d="M-6 0l5 5 8-10"/>';
    else if (type === 'server') g += '<rect x="-15" y="-16" width="30" height="13" rx="2"/><rect x="-15" y="0" width="30" height="13" rx="2"/><circle cx="9" cy="-9.5" r="1.4"/><circle cx="9" cy="6.5" r="1.4"/>';
    else g += '<circle cx="0" cy="-2" r="15"/><path d="M-15 -2h30M0 -17c7 8 7 22 0 30M0 -17c-7 8-7 22 0 30"/>';
    return g + '</g>';
  }
  var MODES = [['none', 'No VPN'], ['full', 'Full-tunnel VPN'], ['split', 'Split tunnel'], ['s2s', 'Site-to-site']];
  var HEAD = {
    none: 'You are on the café’s Wi-Fi with no VPN. Everyone along the path can see where you are going; HTTPS only hides what you read.',
    full: 'All your traffic goes into the tunnel. The café and your ISP see one encrypted flow to the VPN server. The VPN operator now sees what they used to see: you have moved the trust, not removed it.',
    split: 'Only the prefixes you listed (the office network) go through the tunnel. Everything else leaves the way it did before, so for that traffic the café and ISP see exactly what they saw without a VPN.',
    s2s: 'Two gateways build one tunnel and the machines behind them run no VPN software. The ISP sees only gateway-to-gateway ciphertext, but inside each site the traffic is as plain as it ever was.'
  };

  function vpnpath() {
    var r = wrap('Who can see what', 'Pick a setup and change the details. The picture shows what is on the wire; the table shows what each party can learn.');
    var st = { mode: 'full', https: true, office: false, leak: false };
    var ctl = h('div', { class: 'vp-ctl' }), fig = h('div', { class: 'vp-fig' }), tbl = h('div', { class: 'vp-tbl' }), say = h('p', { class: 'vp-say', 'aria-live': 'polite' });
    r.appendChild(ctl); r.appendChild(fig); r.appendChild(say); r.appendChild(tbl);

    function model() {
      var m = st.mode, tun = m === 'full' || (m === 'split' && st.office);
      return { m: m, tun: tun, office: m === 'split' && st.office };
    }
    function nodes(M) {
      if (M.m === 's2s') return [['laptop', 'Branch PC', '10.2.0.15'], ['gateway', 'Gateway A', '203.0.113.2'], ['cloud', 'The Internet', 'ISP and transit'], ['gateway', 'Gateway B', '198.51.100.9'], ['server', 'HQ server', '10.1.0.20']];
      if (M.tun && M.office) return [['laptop', 'Your Mac', '192.168.50.23'], ['wifi', 'Café Wi-Fi', 'router + owner'], ['cloud', 'ISP + Internet', 'the path'], ['gateway', 'Office VPN gateway', 'vpn.office.example'], ['server', 'Office server', '10.0.5.20']];
      if (M.tun) return [['laptop', 'Your Mac', '192.168.50.23'], ['wifi', 'Café Wi-Fi', 'router + owner'], ['cloud', 'ISP + Internet', 'the path'], ['gateway', 'VPN server', 'vpn.example.net'], ['site', 'shop.example', '203.0.113.80']];
      return [['laptop', 'Your Mac', '192.168.50.23'], ['wifi', 'Café Wi-Fi', 'router + owner'], ['cloud', 'ISP + Internet', 'the path'], ['site', 'shop.example', '203.0.113.80']];
    }
    function pills(M) {
      var s = st.https ? ['TCP 443 · TLS', 'shop.example (SNI)'] : ['TCP 80 · HTTP', 'page + cookies visible'];
      if (M.m === 's2s') return [['plain IP', 'inside the branch LAN'], ['ESP / UDP 4500', 'ciphertext only'], ['ESP / UDP 4500', 'ciphertext only'], ['plain IP', 'inside the HQ LAN']];
      if (M.tun) return [['UDP 51820', 'ciphertext only'], ['UDP 51820', 'ciphertext only'], ['UDP 51820', 'ciphertext only'], M.office ? ['TCP 443 · TLS', 'inside the office LAN'] : (st.https ? ['TCP 443 · TLS', 'source = VPN’s address'] : ['TCP 80 · HTTP', 'source = VPN’s address'])];
      return [s, s, s];
    }
    function diagram(M) {
      var N = nodes(M), n = N.length, W0 = 760, x0 = 74, step = (W0 - 2 * x0) / (n - 1), cy = 124;
      var xs = N.map(function (_, i) { return x0 + i * step; });
      var P = pills(M), b = '';
      var ta = M.m === 's2s' ? 1 : 0, tb = M.m === 's2s' ? 3 : 3;
      b += '<line x1="' + xs[0] + '" y1="' + cy + '" x2="' + xs[n - 1] + '" y2="' + cy + '" class="vp-base"/>';
      if (M.tun || M.m === 's2s') {
        b += '<rect x="' + xs[ta] + '" y="' + (cy - 15) + '" width="' + (xs[tb] - xs[ta]) + '" height="30" rx="15" class="vp-tun"/>';
        b += '<line x1="' + xs[ta] + '" y1="' + cy + '" x2="' + xs[tb] + '" y2="' + cy + '" class="vp-flow"/>';
        var mx = (xs[ta] + xs[tb]) / 2;
        b += '<g class="vp-lock"><rect x="' + (mx - 76) + '" y="' + (cy - 76) + '" width="152" height="24" rx="12"/><path d="M' + (mx - 62) + ' ' + (cy - 60) + 'v-3a4 4 0 0 1 8 0v3M' + (mx - 64) + ' ' + (cy - 60) + 'h12v8h-12z" class="vp-lk"/><text x="' + (mx + 6) + '" y="' + (cy - 60) + '" text-anchor="middle">encrypted tunnel</text></g>';
      }
      N.forEach(function (nd, i) {
        var dim = (M.tun || M.m === 's2s') ? '' : '';
        b += '<g class="vp-node"><rect x="' + (xs[i] - 56) + '" y="' + (cy - 42) + '" width="112" height="84" rx="12"/>' + glyph(nd[0], xs[i], cy - 12) +
          '<text x="' + xs[i] + '" y="' + (cy + 20) + '" text-anchor="middle" class="vp-nl">' + esc(nd[1]) + '</text><text x="' + xs[i] + '" y="' + (cy + 34) + '" text-anchor="middle" class="vp-ns">' + esc(nd[2]) + '</text></g>';
      });
      P.forEach(function (p, i) {
        var cx = (xs[i] + xs[i + 1]) / 2, enc = /UDP|ESP/.test(p[0]);
        b += '<g class="vp-pill' + (enc ? ' enc' : '') + '"><rect x="' + (cx - 66) + '" y="' + (cy + 62) + '" width="132" height="40" rx="8"/><text x="' + cx + '" y="' + (cy + 79) + '" text-anchor="middle" class="vp-p1">' + esc(p[0]) + '</text><text x="' + cx + '" y="' + (cy + 94) + '" text-anchor="middle" class="vp-p2">' + esc(p[1]) + '</text></g>';
      });
      b += '<text x="' + (W0 / 2) + '" y="' + (cy + 128) + '" text-anchor="middle" class="vp-cap">what is on the wire between each pair of boxes</text>';
      return '<div class="vp-scroll"><svg viewBox="0 0 ' + W0 + ' 240" role="img" aria-label="Path from your Mac to the destination with the packet contents on each link" style="min-width:640px">' + b + '</svg></div>';
    }
    function cell(kind, txt) { return '<td class="vp-c vp-' + kind + '"><span class="vp-dot" aria-hidden="true"></span><span class="vp-k">' + (kind === 'seen' ? 'Sees' : kind === 'part' ? 'Partly' : kind === 'hide' ? 'Hidden' : 'n/a') + '</span> ' + esc(txt) + '</td>'; }
    function rows(M) {
      var https = st.https, out = [];
      if (M.m === 's2s') {
        return [
          ['Internet path (ISP)', cell('hide', 'only the two gateway addresses'), cell('hide', 'not applicable to them'), cell('hide', 'ciphertext (ESP)'), cell('seen', 'the gateways’ public IPs and the volume and timing')],
          ['Branch LAN', cell('seen', 'every destination in plain IP'), cell('seen', 'the lookups made on that LAN'), cell(https ? 'hide' : 'seen', https ? 'HTTPS still encrypts the page' : 'the whole page'), cell('seen', 'internal 10.2.0.x addresses')],
          ['HQ LAN', cell('seen', 'traffic arrives decrypted at the HQ gateway'), cell('hide', 'DNS stays inside the sites'), cell(https ? 'hide' : 'seen', https ? 'HTTPS still encrypts the page' : 'the whole page'), cell('seen', 'the branch’s internal addresses')]
        ];
      }
      var dnsTun = M.tun && !st.leak;
      var dstTxt = M.office ? '10.0.5.20 (office server)' : (https ? 'shop.example and its IP (TLS SNI)' : 'shop.example, its IP and the URL path');
      var pathRow = function (label) {
        return [label,
          M.tun ? cell('hide', 'only the VPN server’s address and port') : cell(https ? 'part' : 'seen', dstTxt),
          dnsTun ? cell('hide', 'lookups go through the tunnel') : cell('seen', st.leak && M.tun ? 'lookups LEAK outside the tunnel' : 'every name you look up (plain DNS)'),
          M.tun ? cell('hide', 'ciphertext only') : cell(https ? 'hide' : 'seen', https ? 'encrypted by TLS' : 'the whole page, cookies and forms'),
          cell('seen', 'your device on their network')];
      };
      out.push(pathRow('Café Wi-Fi owner'));
      out.push(pathRow('ISP and Internet'));
      if (M.tun) out.push([M.office ? 'Office VPN operator' : 'VPN operator',
        cell('seen', dstTxt),
        dnsTun ? cell('seen', 'every lookup, if they run your DNS') : cell('hide', 'not their DNS'),
        cell(https || M.office ? 'hide' : 'seen', https ? 'encrypted by TLS end to end' : (M.office ? 'inside their own network' : 'the whole page, cookies and forms')),
        cell('seen', 'your real address, and your account')]);
      else out.push(['VPN operator', cell('na', 'not in the path'), cell('na', 'not in the path'), cell('na', 'not in the path'), cell('na', 'not in the path')]);
      out.push(['The destination', cell('seen', 'it is the destination'), cell('hide', 'never sees your lookups'), cell('seen', 'it serves the page'),
        M.tun ? cell('hide', M.office ? 'your tunnel address (10.8.0.2)' : 'the VPN’s address, not yours') : cell('seen', 'the café’s public IP address')]);
      return out;
    }
    function draw() {
      var M = model();
      ctl.innerHTML = '<div class="vp-row"><span class="vp-lab">Setup</span>' + chips(MODES, st.mode, 'data-m') + '</div>' +
        '<div class="vp-row"><span class="vp-lab">Site uses</span>' + chips([['https', 'HTTPS'], ['http', 'Plain HTTP']], st.https ? 'https' : 'http', 'data-s') + '</div>' +
        (st.mode === 'split' ? '<div class="vp-row"><span class="vp-lab">Going to</span>' + chips([['pub', 'A public site'], ['off', 'The office server']], st.office ? 'off' : 'pub', 'data-d') + '</div>' : '') +
        (st.mode === 'full' || (st.mode === 'split' && st.office) ? '<label class="vp-chk"><input type="checkbox" data-leak' + (st.leak ? ' checked' : '') + '> Misconfigured: DNS lookups bypass the tunnel (a DNS leak)</label>' : '');
      fig.innerHTML = diagram(M);
      say.innerHTML = esc(HEAD[st.mode]) + (st.mode === 'split' && !st.office ? ' <b>This destination is not in the tunnel’s list, so it is sent the ordinary way.</b>' : '');
      var rs = rows(M);
      tbl.innerHTML = '<div class="vp-scroll"><table><thead><tr><th>Who</th><th>Where you go</th><th>Your DNS lookups</th><th>What you read or send</th><th>Your address</th></tr></thead><tbody>' +
        rs.map(function (x) { return '<tr><th scope="row">' + esc(x[0]) + '</th>' + x.slice(1).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    }
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-m')) st.mode = b.getAttribute('data-m');
      else if (b.hasAttribute('data-s')) st.https = b.getAttribute('data-s') === 'https';
      else if (b.hasAttribute('data-d')) st.office = b.getAttribute('data-d') === 'off';
      draw();
    });
    ctl.addEventListener('change', function (e) { if (e.target.hasAttribute('data-leak')) { st.leak = e.target.checked; draw(); } });
    draw();
    return r;
  }

  /* ================= vpnmtu ================= */
  var PROTO = [['wg', 'WireGuard'], ['ipsec', 'IPsec ESP (AES-GCM)'], ['ovpn', 'OpenVPN (UDP, AES-GCM)'], ['gre', 'GRE (no encryption)']];
  function wire(p, v6, natt, inner) {
    var ip = v6 ? 40 : 20, segs = [['Outer IP', ip, 'ip']];
    if (p === 'wg') segs.push(['UDP', 8, 'udp'], ['WG header', 16, 'hd'], ['Inner packet', inner, 'in'], ['Poly1305 tag', 16, 'tg']);
    else if (p === 'ovpn') segs.push(['UDP', 8, 'udp'], ['opcode + peer id + packet id', 8, 'hd'], ['Inner packet', inner, 'in'], ['GCM tag', 16, 'tg']);
    else if (p === 'gre') segs.push(['GRE', 4, 'hd'], ['Inner packet', inner, 'in']);
    else {
      if (natt) segs.push(['UDP 4500', 8, 'udp']);
      var pad = (4 - ((inner + 2) % 4)) % 4;
      segs.push(['ESP SPI + seq', 8, 'hd'], ['IV', 8, 'hd'], ['Inner packet', inner, 'in']);
      if (pad) segs.push(['pad', pad, 'pd']);
      segs.push(['trailer', 2, 'pd'], ['ICV', 16, 'tg']);
    }
    var tot = 0; segs.forEach(function (s) { tot += s[1]; });
    return { segs: segs, total: tot };
  }
  function maxInner(p, v6, natt, mtu) { for (var i = mtu; i > 0; i--) if (wire(p, v6, natt, i).total <= mtu) return i; return 0; }

  function vpnmtu() {
    var r = wrap('Tunnel overhead and MTU', 'Every tunnel wraps your packet in more headers, so the packet that fits through the tunnel is smaller than the link’s MTU. Change the numbers and watch the packet grow.');
    var st = { p: 'wg', v6: false, mtu: 1500, natt: false, inner: 1500 };
    var ctl = h('div', { class: 'vp-ctl' }), bar = h('div', { class: 'vp-bar-wrap' }), out = h('div', { class: 'vp-mout', 'aria-live': 'polite' });
    r.appendChild(ctl); r.appendChild(bar); r.appendChild(out);
    var innerTouched = false;
    function draw(keepFocus) {
      var mx = maxInner(st.p, st.v6, st.natt, st.mtu);
      if (!innerTouched) st.inner = mx;
      st.inner = Math.max(100, Math.min(st.inner, 1500));
      var W1 = wire(st.p, st.v6, st.natt, st.inner), Wm = wire(st.p, st.v6, st.natt, mx);
      var fits = W1.total <= st.mtu;
      if (!keepFocus) {
        ctl.innerHTML = '<div class="vp-row"><span class="vp-lab">Tunnel</span><select data-p aria-label="Tunnel protocol">' + PROTO.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === st.p ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select>' +
          '<span class="vp-seg" role="group" aria-label="Outer IP version"><button type="button" class="chip' + (!st.v6 ? ' on' : '') + '" data-v="4" aria-pressed="' + !st.v6 + '">outer IPv4</button><button type="button" class="chip' + (st.v6 ? ' on' : '') + '" data-v="6" aria-pressed="' + st.v6 + '">outer IPv6</button></span>' +
          (st.p === 'ipsec' ? '<label class="vp-chk"><input type="checkbox" data-natt' + (st.natt ? ' checked' : '') + '> NAT-T (ESP inside UDP 4500)</label>' : '') + '</div>' +
          '<div class="vp-row"><span class="vp-lab">Link MTU</span><input type="number" min="576" max="9000" step="1" value="' + st.mtu + '" data-mtu aria-label="Link MTU in bytes">' +
          [[1500, 'Ethernet 1500'], [1492, 'PPPoE 1492'], [1480, 'DSL/tunnel 1480'], [1400, 'hotel 1400'], [1280, 'IPv6 minimum 1280']].map(function (x) { return '<button type="button" class="chip' + (x[0] === st.mtu ? ' on' : '') + '" data-pm="' + x[0] + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>' +
          '<div class="vp-row"><span class="vp-lab">Inner packet</span><input type="range" min="100" max="1500" step="1" value="' + st.inner + '" data-in aria-label="Size of the packet sent into the tunnel"><b class="vp-num" data-innum>' + st.inner + '</b> bytes' +
          '<button type="button" class="chip" data-fit>fill the tunnel</button><button type="button" class="chip" data-full>1500 (a full Ethernet packet)</button></div>';
      } else {
        var rg = ctl.querySelector('[data-in]'); if (rg && +rg.value !== st.inner) rg.value = st.inner;
        var nm = ctl.querySelector('[data-innum]'); if (nm) nm.textContent = st.inner;
      }
      var tot = Math.max(W1.total, st.mtu);
      bar.innerHTML = '<div class="vp-pk" style="--tot:' + tot + '" role="img" aria-label="Packet layout: ' + W1.segs.map(function (s) { return s[0] + ' ' + s[1] + ' bytes'; }).join(', ') + '">' +
        W1.segs.map(function (s) { return '<div class="vp-seg-' + s[2] + '" style="flex:' + s[1] + ' 1 0;min-width:' + (s[1] < 12 ? 22 : s[1] < 30 ? 34 : 0) + 'px" title="' + esc(s[0]) + ': ' + s[1] + ' bytes"><small>' + (s[1] >= 30 || s[2] === 'in' ? esc(s[0]) + '<br>' : '') + s[1] + '</small></div>'; }).join('') +
        '<div class="vp-room" style="flex:' + Math.max(0, st.mtu - W1.total) + ' 1 0"></div></div>' +
        '<div class="vp-mtu-line" style="--p:' + (st.mtu / tot * 100) + '%"><span>link MTU ' + st.mtu + '</span></div>';
      var ov = Wm.total - mx, pingSz = mx - 28;
      var verdict = fits
        ? '<span class="vp-ok">Fits.</span> ' + st.inner + ' + ' + (W1.total - st.inner) + ' = <b>' + W1.total + '</b> bytes on the wire, within the ' + st.mtu + '-byte link.'
        : '<span class="vp-bad">Too big.</span> ' + st.inner + ' + ' + (W1.total - st.inner) + ' = <b>' + W1.total + '</b> bytes, which is <b>' + (W1.total - st.mtu) + '</b> over the link MTU. With the DF bit set (most TCP) the router drops it and sends ICMP “fragmentation needed”; if that ICMP is filtered, the connection stalls (a PMTU black hole). Without DF the packet is fragmented, which is slow.';
      out.innerHTML = '<p class="vp-verdict">' + verdict + '</p>' +
        '<div class="vp-facts"><div><span>Overhead</span><b>' + ov + ' bytes</b><i>' + (st.p === 'ipsec' ? 'varies by 0 to 3 bytes of padding' : 'fixed') + '</i></div>' +
        '<div><span>Set the tunnel MTU to</span><b>' + mx + '</b><i>largest inner packet that fits</i></div>' +
        '<div><span>TCP MSS inside (IPv4)</span><b>' + (mx - 40) + '</b><i>MTU − 20 IP − 20 TCP</i></div>' +
        '<div><span>Biggest ping that passes</span><b>' + pingSz + '</b><i>ping -D -s ' + pingSz + '; one more fails</i></div></div>' +
        '<p class="vp-fine">' + ({ wg: 'WireGuard adds a 16-byte header and a 16-byte tag inside UDP. Its default tunnel MTU is 1420, which is 1500 − 80: room for an IPv6 outer header even when the outer address is IPv4. It also pads the inner packet to a multiple of 16 bytes, never beyond the MTU.',
        ipsec: 'ESP tunnel mode with AES-GCM: an 8-byte SPI and sequence number, an 8-byte IV, padding to a 4-byte boundary, a 2-byte trailer (pad length and next header) and a 16-byte integrity tag. Behind NAT, ESP rides inside UDP 4500, which costs 8 more bytes.',
        ovpn: 'OpenVPN’s data channel in UDP mode with AES-GCM: a 1-byte opcode and key id, a 3-byte peer id, a 4-byte packet id and a 16-byte tag. Its default is a 1500-byte tun-mtu with mssfix 1450, which clamps TCP instead of shrinking the interface.',
        gre: 'GRE only wraps; it does not encrypt or authenticate. It is common inside IPsec (GRE over IPsec) to carry routing protocols and multicast. Four bytes without a key field.' })[st.p] + '</p>';
    }
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-v')) st.v6 = b.getAttribute('data-v') === '6';
      else if (b.hasAttribute('data-pm')) st.mtu = +b.getAttribute('data-pm');
      else if (b.hasAttribute('data-fit')) { innerTouched = false; }
      else if (b.hasAttribute('data-full')) { innerTouched = true; st.inner = 1500; }
      else return;
      draw();
    });
    ctl.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-p')) st.p = t.value;
      else if (t.hasAttribute('data-natt')) st.natt = t.checked;
      else if (t.hasAttribute('data-mtu')) { var v = +t.value; if (v >= 576 && v <= 9000) st.mtu = v; }
      else return;
      draw();
    });
    ctl.addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-in')) { innerTouched = true; st.inner = +t.value; draw(true); }
    });
    draw();
    return r;
  }

  /* ================= wgroute ================= */
  function ip2n(s) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim()); if (!m) return null;
    var n = 0; for (var i = 1; i <= 4; i++) { var o = +m[i]; if (o > 255) return null; n = n * 256 + o; }
    return n;
  }
  function n2ip(n) { return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); }
  function cidr(s) {
    var m = /^\s*([\d.]+)(?:\/(\d{1,2}))?\s*$/.exec(s); if (!m) return null;
    var a = ip2n(m[1]); if (a === null) return null;
    var len = m[2] === undefined ? 32 : +m[2]; if (len > 32) return null;
    var mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
    return { net: (a & mask) >>> 0, len: len, mask: mask, text: n2ip((a & mask) >>> 0) + '/' + len, given: s.trim(), host: (a & ~mask) >>> 0 };
  }
  var WG_PRESETS = {
    split: { name: 'Home LAN (split tunnel)', peers: [['home-pi', '10.8.0.1/32, 192.168.1.0/24'], ['alice-phone', '10.8.0.3/32'], ['bob-laptop', '10.8.0.4/32']] },
    full: { name: 'All traffic via a VPS (full tunnel)', peers: [['exit-vps', '0.0.0.0/0']] },
    mix: { name: 'Home LAN plus an exit server', peers: [['home-pi', '10.8.0.1/32, 192.168.1.0/24'], ['exit-vps', '0.0.0.0/0']] },
    clash: { name: 'Two peers claim one range', peers: [['site-a', '10.20.0.0/16'], ['site-b', '10.20.0.0/16, 10.30.0.0/16']] }
  };
  function wgroute() {
    var r = wrap('Cryptokey routing: AllowedIPs', 'WireGuard has no separate routing table and no access list. Each peer’s <code>AllowedIPs</code> is both: it chooses the peer to encrypt to, and it is the only set of source addresses accepted from that peer.');
    var peers = WG_PRESETS.split.peers.map(function (p) { return { name: p[0], ips: p[1] }; });
    var dst = '192.168.1.60', src = '192.168.1.60', from = 0;
    var pre = h('div', { class: 'vp-row' }), tb = h('div', { class: 'vp-peers' }), tests = h('div', { class: 'vp-tests' }), res = h('div', { class: 'vp-wgres', 'aria-live': 'polite' });
    pre.innerHTML = '<span class="vp-lab">Try</span>' + Object.keys(WG_PRESETS).map(function (k) { return '<button type="button" class="chip" data-pre="' + k + '">' + esc(WG_PRESETS[k].name) + '</button>'; }).join('');
    r.appendChild(pre); r.appendChild(tb); r.appendChild(tests); r.appendChild(res);

    function table() {
      // later peers win a prefix they share with an earlier peer, as wg set does
      var map = [], errors = [], claims = {};
      peers.forEach(function (p, pi) {
        var ok = [];
        p.ips.split(',').forEach(function (raw) {
          if (!raw.trim()) return;
          var c = cidr(raw);
          if (!c) { errors.push(p.name + ': “' + raw.trim() + '” is not an IPv4 address or prefix'); return; }
          var key = c.text;
          if (claims[key] !== undefined && claims[key] !== pi) errors.push('<b>' + esc(key) + '</b> is claimed by both ' + esc(peers[claims[key]].name) + ' and ' + esc(p.name) + '. WireGuard keeps it only on the last one set (' + esc(p.name) + ').');
          claims[key] = pi; c.peer = pi; ok.push(c);
        });
        p.cidrs = ok;
      });
      peers.forEach(function (p, pi) { p.cidrs = p.cidrs.filter(function (c) { return claims[c.text] === pi; }); });
      Object.keys(claims).forEach(function (k) { var c = cidr(k); c.peer = claims[k]; map.push(c); });
      return { map: map, errors: errors };
    }
    function lookup(map, a) {
      var best = null;
      map.forEach(function (c) { if (((a & c.mask) >>> 0) === c.net && (!best || c.len > best.len)) best = c; });
      return best;
    }
    function draw() {
      tb.innerHTML = '<div class="vp-scroll"><table class="vp-wgt"><thead><tr><th>Peer</th><th>AllowedIPs (comma separated)</th></tr></thead><tbody>' +
        peers.map(function (p, i) { return '<tr><th scope="row">' + esc(p.name) + '</th><td><input type="text" data-ip="' + i + '" value="' + esc(p.ips) + '" aria-label="AllowedIPs for ' + esc(p.name) + '" spellcheck="false" autocomplete="off"></td></tr>'; }).join('') + '</tbody></table></div>';
      tests.innerHTML = '<div class="vp-test"><b>Sending</b> a packet to <input type="text" data-dst value="' + esc(dst) + '" aria-label="Destination address" spellcheck="false" size="14"></div>' +
        '<div class="vp-test"><b>Receiving</b> from <select data-from aria-label="Peer the packet arrives from">' + peers.map(function (p, i) { return '<option value="' + i + '"' + (i === from ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select> a packet whose inner source address is <input type="text" data-src value="' + esc(src) + '" aria-label="Inner source address" spellcheck="false" size="14"></div>';
      refresh();
    }
    function refresh() {
      var T = table(), full = T.map.some(function (c) { return c.len === 0; });
      var h1 = '', d = ip2n(dst), s = ip2n(src);
      if (d === null) h1 += '<p class="vp-r"><span class="vp-bad">Not an address.</span> \u201C' + esc(dst) + '\u201D is not an IPv4 address.</p>';
      else {
        var hit = lookup(T.map, d);
        h1 += hit ? '<p class="vp-r"><span class="vp-ok">Encrypted to ' + esc(peers[hit.peer].name) + '.</span> The longest matching prefix is <code>' + esc(hit.text) + '</code>' + (hit.len === 0 ? ' (the default route: everything not claimed more specifically goes here)' : '') + '. On a Mac, <code>wg-quick</code> installed a route for that prefix, so the packet reaches <code>utun</code> and WireGuard picks the peer.</p>'
          : '<p class="vp-r"><span class="vp-warn">Not sent through WireGuard.</span> No peer claims ' + esc(dst) + ', and <code>wg-quick</code> installed no route for it, so it leaves by the ordinary route, <b>unencrypted</b>. If the packet did reach the interface anyway, WireGuard would drop it (<code>Required key not available</code>).</p>';
      }
      if (s === null) h1 += '<p class="vp-r"><span class="vp-bad">Not an address.</span> \u201C' + esc(src) + '\u201D is not an IPv4 address.</p>';
      else {
        var P = peers[from], okIn = P.cidrs.some(function (c) { return ((s & c.mask) >>> 0) === c.net; });
        h1 += okIn ? '<p class="vp-r"><span class="vp-ok">Accepted.</span> The packet decrypted correctly and its source is inside ' + esc(P.name) + '\u2019s AllowedIPs.</p>'
          : '<p class="vp-r"><span class="vp-bad">Dropped silently.</span> The packet decrypted correctly, but ' + esc(src) + ' is not in ' + esc(P.name) + '\u2019s AllowedIPs (' + (P.cidrs.length ? esc(P.cidrs.map(function (c) { return c.text; }).join(', ')) : 'none') + '). This is the access list: a peer cannot pose as an address you did not give it.</p>';
      }
      if (T.errors.length) h1 += '<ul class="vp-errs">' + T.errors.map(function (e) { return '<li>' + (e.indexOf('<b>') === 0 ? e : esc(e)) + '</li>'; }).join('') + '</ul>';
      if (full) h1 += '<p class="vp-fine"><b>Full tunnel.</b> <code>0.0.0.0/0</code> sends everything into the tunnel. <code>wg-quick</code> must keep a host route to the server\u2019s own endpoint outside the tunnel (otherwise the encrypted packets would try to enter the tunnel). On macOS it covers the default route in two halves, <code>0.0.0.0/1</code> and <code>128.0.0.0/1</code>, so the existing default route is overridden, not replaced.</p>';
      res.innerHTML = h1;
    }
    pre.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pre]'); if (!b) return;
      var k = b.getAttribute('data-pre'), pr = WG_PRESETS[k];
      peers = pr.peers.map(function (p) { return { name: p[0], ips: p[1] }; });
      dst = k === 'full' ? '93.184.216.34' : k === 'clash' ? '10.20.4.4' : '192.168.1.60'; src = dst; from = 0;
      draw();
    });
    r.addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-ip')) peers[+t.getAttribute('data-ip')].ips = t.value;
      else if (t.hasAttribute('data-dst')) dst = t.value;
      else if (t.hasAttribute('data-src')) src = t.value;
      else return;
      refresh();
    });
    r.addEventListener('change', function (e) { if (e.target.hasAttribute('data-from')) { from = +e.target.value; refresh(); } });
    draw();
    return r;
  }

  /* ================= vpnshake ================= */
  var SHAKES = {
    wg: {
      name: 'WireGuard', sub: 'Noise IKpsk2 · UDP, normally 51820 · two messages, then data',
      actors: [{ label: 'Initiator', sub: 'your Mac' }, { label: 'Responder', sub: 'server · UDP 51820' }],
      steps: [
        { f: 0, t: 1, label: 'Handshake initiation (type 1, 148 bytes)', kind: 'req', note: 'The Mac already knows the server’s **public key** from its config. It sends a fresh ephemeral public key, its own static public key and a timestamp, the last two encrypted so that only the real server can read them. Wireshark: `wg.type == 1`.' },
        { f: 1, t: 0, label: 'Handshake response (type 2, 92 bytes)', kind: 'ok', note: 'The server checks that the initiator’s public key is one of its peers. If not, **it stays silent**: a WireGuard port does not answer anyone it cannot authenticate, so a scan sees nothing. Otherwise it replies with its own ephemeral key. Both sides now derive the same session keys. Wireshark: `wg.type == 2`.' },
        { f: 0, t: 1, label: 'First data packet (type 4)', kind: 'data', note: 'The first encrypted packet from the initiator tells the server the keys work. Each packet carries a 64-bit counter used as the nonce for ChaCha20-Poly1305; the receiver keeps a sliding window to reject replays. An empty one is a 32-byte **keepalive**.' },
        { f: 1, t: 0, label: 'Data both ways (type 4)', kind: 'data', note: 'Now it is just UDP datagrams with a 16-byte header and a 16-byte tag. The whole exchange cost one round trip, with no negotiation of ciphers: there is nothing to negotiate, so nothing to downgrade.' },
        { f: 0, t: 1, label: 'Re-key after 120 s (new type 1)', kind: 'warn', note: 'Keys are replaced about every two minutes of use, and refuse to live past three. That gives **forward secrecy**: stealing today’s key does not decrypt last week’s capture. With `PersistentKeepalive = 25` an idle client also sends a keepalive every 25 s so a NAT does not forget its mapping.' }
      ],
      verdict: { cls: 'ok', head: '1 round trip', text: 'No ciphers to choose, no certificates, no state kept for strangers. The trade-off is that you manage public keys by hand (or with a tool such as Tailscale).' }
    },
    ike: {
      name: 'IKEv2 / IPsec', sub: 'UDP 500 (4500 behind NAT) · four messages, then ESP',
      actors: [{ label: 'Initiator', sub: 'client or gateway A' }, { label: 'Responder', sub: 'gateway · UDP 500/4500' }],
      steps: [
        { f: 0, t: 1, label: 'IKE_SA_INIT request', kind: 'req', note: 'The initiator offers a list of **proposals** (encryption, integrity, Diffie-Hellman group, pseudo-random function), its DH public value and a nonce. Everything is still in the clear. Wireshark: `isakmp` and the exchange type 34.' },
        { f: 1, t: 0, label: 'IKE_SA_INIT response', kind: 'ok', note: 'The responder **chooses** one proposal and sends its own DH value and nonce. From here both sides can compute the keys, and every later IKE message is encrypted. A weak proposal in the list is the downgrade risk of a negotiated protocol.' },
        { f: 0, t: 1, label: 'IKE_AUTH request (encrypted)', kind: 'req', note: 'Now the initiator proves who it is: an ID and an AUTH payload (a signature from a certificate, a pre-shared key or an EAP exchange with a user name and password). It also proposes the first **Child SA** (the ESP tunnel) and the **traffic selectors**: which source and destination ranges the tunnel carries. On a NAT’d path, IKE moves to UDP 4500.' },
        { f: 1, t: 0, label: 'IKE_AUTH response', kind: 'ok', note: 'The responder authenticates itself, accepts or narrows the traffic selectors and picks the Child SA parameters. With this fourth message there is an **IKE SA** (the control channel) and a **Child SA** (the data tunnel). On a Cisco device these are what `show crypto ikev2 sa` and `show crypto ipsec sa` list.' },
        { f: 0, t: 1, label: 'ESP data (IP protocol 50, or UDP 4500)', kind: 'data', note: 'Traffic now travels as ESP packets: an SPI that names the Child SA, a sequence number, the encrypted inner packet and an integrity value. Wireshark: `esp`, or `udpencap` for ESP in UDP. A packet you captured is opaque unless you hold the keys.' },
        { f: 1, t: 0, label: 'INFORMATIONAL / CREATE_CHILD_SA', kind: 'warn', note: 'Housekeeping over the encrypted IKE channel: liveness checks (**dead peer detection**), re-keying the Child SA before its lifetime ends, and deleting SAs. A lifetime mismatch between two vendors is a classic cause of a tunnel that drops every hour.' }
      ],
      verdict: { cls: 'warn', head: '2 round trips', text: 'Mature, standard and built into iOS, macOS, Windows and Android, and it is what routers and firewalls speak. The price is a large protocol with many options to get wrong.' }
    },
    ovpn: {
      name: 'OpenVPN', sub: 'TLS control channel + encrypted data channel · UDP or TCP, often 1194 or 443',
      actors: [{ label: 'Client', sub: 'openvpn' }, { label: 'Server', sub: 'UDP/TCP 1194 or 443' }],
      steps: [
        { f: 0, t: 1, label: 'P_CONTROL_HARD_RESET_CLIENT_V2 (opcode 7)', kind: 'req', note: 'OpenVPN builds its own small reliability layer on top of UDP, then runs a normal **TLS handshake inside it**. The reset packet starts a session. Wireshark: `openvpn.opcode == 7`.' },
        { f: 1, t: 0, label: 'P_CONTROL_HARD_RESET_SERVER_V2 (opcode 8)', kind: 'ok', note: 'The server accepts and acknowledges. If the config uses `tls-crypt` or `tls-auth`, every control packet also carries a key-derived HMAC, so a scanner or a stranger with no key gets no answer, much like WireGuard.' },
        { f: 0, t: 1, label: 'TLS handshake in P_CONTROL_V1 (opcode 4)', kind: 'req', note: 'ClientHello, ServerHello, certificates and the key exchange travel as control packets, with opcode 5 acknowledgements. Both ends usually present **certificates** signed by your own small CA, so the server can tell which client it is talking to.' },
        { f: 1, t: 0, label: 'PUSH_REPLY (still on the control channel)', kind: 'ok', note: 'Once authenticated, the client asks and the server **pushes** the settings: the client’s tunnel address, routes to add, DNS servers, whether to send the default route. This is how one server config controls every client.' },
        { f: 0, t: 1, label: 'P_DATA_V2 (opcode 9)', kind: 'data', note: 'Data packets use keys derived from the TLS session: AES-256-GCM or ChaCha20-Poly1305 with a packet id. They carry a 4-byte header (opcode, key id, peer id).' },
        { f: 1, t: 0, label: 'Renegotiate every hour (default)', kind: 'warn', note: 'The TLS session re-keys periodically (`reneg-sec`, default one hour). Over TCP, OpenVPN suffers “TCP meltdown”: a TCP tunnel carrying TCP traffic retransmits at both layers. Use UDP unless a network forces TCP 443.' }
      ],
      verdict: { cls: 'warn', head: 'TLS-based', text: 'Flexible and able to look like HTTPS on TCP 443 to pass strict firewalls, at the cost of a larger codebase and more moving parts than WireGuard.' }
    }
  };
  function vpnshake() {
    var r = wrap('Setting up a tunnel, message by message', 'Pick a protocol, then press Next (or Play) and read what each message does. Click any arrow to jump to it.');
    var tabs = h('div', { class: 'vp-row' }), host = h('div', { class: 'vp-shake' });
    var keys = ['wg', 'ike', 'ovpn'], cur = 'wg';
    tabs.innerHTML = '<span class="vp-lab">Protocol</span>' + chips(keys.map(function (k) { return [k, SHAKES[k].name]; }), cur, 'data-sh');
    r.appendChild(tabs); r.appendChild(host);
    function show() {
      var S = SHAKES[cur], old = host.firstChild;
      if (old && old.__stop) old.__stop();
      host.innerHTML = '<p class="vp-shsub">' + esc(S.sub) + '</p>';
      host.appendChild(window.__netviz.seq({ label: S.name + ' handshake as a message sequence', actors: S.actors, steps: S.steps, verdict: S.verdict }));
      $$('[data-sh]', tabs).forEach(function (b) { var on = b.getAttribute('data-sh') === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }
    tabs.addEventListener('click', function (e) { var b = e.target.closest('[data-sh]'); if (b) { cur = b.getAttribute('data-sh'); show(); } });
    show();
    return r;
  }

  /* ================= vpncmp ================= */
  var PROTOS = [
    { id: 'wg', name: 'WireGuard', over: 'UDP', ports: 'one UDP port (51820 by convention)', auth: 'public keys, set by hand', pro: 'small, fast, one fixed cipher suite, silent to strangers, roams between networks', con: 'UDP only; no built-in user accounts, address pools or dynamic push of settings', built: 'kernel on Linux, FreeBSD, Windows via app; official apps for macOS and iOS' },
    { id: 'ipsec', name: 'IPsec / IKEv2', over: 'IP protocol 50 (ESP); IKE on UDP 500/4500', ports: 'UDP 500, UDP 4500, ESP', auth: 'certificates, pre-shared keys or EAP', pro: 'a standard every router and firewall speaks; built into iOS, macOS, Windows, Android; fast re-connect (MOBIKE)', con: 'big, option-heavy, vendor quirks; ESP is blocked on some networks', built: 'macOS, iOS, Windows, Android, Linux (strongSwan)' },
    { id: 'ovpn', name: 'OpenVPN', over: 'UDP or TCP', ports: 'often UDP 1194 or TCP 443', auth: 'certificates (TLS), optional user and password', pro: 'runs almost anywhere, can use TCP 443 to pass strict firewalls, pushes config to clients', con: 'larger codebase, slower than WireGuard, TCP mode hurts throughput', built: 'client software needed on every system' },
    { id: 'ssl', name: 'TLS VPN (AnyConnect, GlobalProtect, OpenConnect)', over: 'TLS on TCP 443, with DTLS on UDP 443 for speed', ports: 'TCP/UDP 443', auth: 'SSO, certificates, MFA through the gateway', pro: 'passes nearly any firewall; the usual choice for managed enterprise fleets with SSO and posture checks', con: 'usually a commercial appliance; edge gateways are a favourite attack target', built: 'vendor clients (OpenConnect is an open client)' },
    { id: 'mesh', name: 'Mesh overlays (Tailscale, ZeroTier, Netbird)', over: 'WireGuard or similar, plus a coordination service', ports: 'outgoing only; relays over HTTPS when direct paths fail', auth: 'your identity provider', pro: 'works behind CGNAT with no port forwarding; devices reach each other directly; ACLs in one place', con: 'depends on a coordination service (self-hostable in some cases); another company in your trust chain', built: 'apps for every platform' },
    { id: 'ssh', name: 'SSH tunnels (-L, -R, -D)', over: 'TCP, usually 22', ports: 'TCP 22', auth: 'SSH keys', pro: 'already installed; ideal for one service or a quick SOCKS proxy; no root needed', con: 'one TCP port at a time (or a SOCKS proxy); no UDP; not a whole network', built: 'ssh on every Mac and Linux box' },
    { id: 'l2tp', name: 'L2TP/IPsec', over: 'UDP 1701 inside IPsec', ports: 'UDP 500, 4500, 1701', auth: 'pre-shared key plus user and password', pro: 'was built into every OS', con: 'legacy: two layers, slow, and the shared key is often weak; prefer IKEv2', built: 'macOS, Windows, iOS, Android' },
    { id: 'pptp', name: 'PPTP', over: 'TCP 1723 plus GRE', ports: 'TCP 1723, IP protocol 47', auth: 'MS-CHAPv2', pro: 'none today', con: 'broken: MS-CHAPv2 reduces to cracking a single DES key. Do not use it.', built: 'dropped by macOS and iOS' }
  ];
  function vpncmp() {
    var r = wrap('Which VPN fits?', 'Answer three questions and the table ranks the options. The ranking is a starting point, not a verdict: what you must interoperate with usually decides.');
    var st = { goal: 'home', cli: 'install', net: 'udp' };
    var ctl = h('div', { class: 'vp-ctl' }), best = h('div', { class: 'vp-best', 'aria-live': 'polite' }), tbl = h('div', { class: 'vp-tbl' });
    r.appendChild(ctl); r.appendChild(best); r.appendChild(tbl);
    var GOALS = [['home', 'Reach my home or lab network'], ['office', 'Join an office network (managed devices)'], ['s2s', 'Link two sites, router to router'], ['wifi', 'Protect traffic on public Wi-Fi'], ['cgnat', 'Reach devices behind NAT, no port forwarding'], ['one', 'Reach one service only']];
    var WHY = {
      wg: { home: 'The simplest way into a home network: one UDP port forwarded, one key per device.', wifi: 'Fast and light on phones; point it at your own server or a provider you trust.', office: 'Good for small teams who can manage keys; larger fleets need a management layer on top.', s2s: 'Works well between Linux, pfSense, OPNsense or MikroTik gateways, but not with a vendor that only speaks IPsec.', cgnat: 'Possible with a cheap VPS as a relay; a mesh tool automates this.', one: 'More than you need, but it works.' },
      ipsec: { s2s: 'The lingua franca of site-to-site: Cisco, Fortinet, Palo Alto, pfSense and cloud gateways all speak it.', office: 'Native clients and profile-based roll-out make it practical on managed Apple and Windows devices.', home: 'Built into your Mac and iPhone, so no app is needed; the server side (strongSwan) is more work.', wifi: 'Built-in clients make it a fair choice when you cannot install anything.', cgnat: 'Poor fit: needs a reachable gateway.', one: 'Overkill.' },
      ovpn: { home: 'Mature and flexible; a good choice if UDP is filtered and you need TCP 443.', office: 'Certificates and pushed settings suit mixed fleets.', wifi: 'Use TCP 443 when a hotel blocks everything else.', s2s: 'Works, though IPsec or WireGuard are leaner.', cgnat: 'Needs a reachable server.', one: 'Overkill.' },
      ssl: { office: 'Single sign-on, MFA and device checks in one gateway: the enterprise default.', home: 'Heavy for a home lab.', wifi: 'Only if your employer provides it.', s2s: 'Not designed for it.', cgnat: 'Needs a reachable gateway.', one: 'Overkill.' },
      mesh: { cgnat: 'Built for this: every device dials out, and the service helps them find each other.', home: 'Gets you into the lab from anywhere with no router changes.', office: 'Strong for small teams with identity-based access rules.', wifi: 'An “exit node” gives you a full tunnel through a machine you control.', s2s: 'Possible with subnet routers.', one: 'Convenient: expose one service to your own devices only.' },
      ssh: { one: 'The right tool: <code>ssh -L</code> forwards one port, and you are done in a minute.', home: 'A SOCKS proxy (<code>ssh -D</code>) is a quick, no-install way in for web UIs.', wifi: 'A SOCKS proxy over SSH protects browser traffic only, not the rest of the machine.', office: 'Not a managed solution.', s2s: 'Not designed for it.', cgnat: 'A reverse tunnel (<code>ssh -R</code>) through a VPS works.' },
      l2tp: { home: 'Legacy. Prefer IKEv2 on the same server.', wifi: 'Legacy.', office: 'Legacy.', s2s: 'Legacy.', cgnat: 'No.', one: 'No.' },
      pptp: { home: 'Broken. Do not use it.', wifi: 'Broken.', office: 'Broken.', s2s: 'Broken.', cgnat: 'No.', one: 'No.' }
    };
    var SC = {
      wg: { home: 3, wifi: 3, office: 1, s2s: 1, cgnat: 1, one: 0 },
      ipsec: { home: 1, wifi: 1, office: 2, s2s: 3, cgnat: -1, one: -1 },
      ovpn: { home: 2, wifi: 1, office: 2, s2s: 1, cgnat: -1, one: -1 },
      ssl: { home: -1, wifi: 0, office: 3, s2s: -1, cgnat: -1, one: -1 },
      mesh: { home: 2, wifi: 1, office: 1, s2s: 0, cgnat: 4, one: 1 },
      ssh: { home: 1, wifi: 1, office: -1, s2s: -2, cgnat: 1, one: 4 },
      l2tp: { home: -2, wifi: -2, office: -2, s2s: -2, cgnat: -3, one: -3 },
      pptp: { home: -9, wifi: -9, office: -9, s2s: -9, cgnat: -9, one: -9 }
    };
    function rank() {
      var rows = PROTOS.map(function (p) {
        var s = SC[p.id][st.goal], notes = [];
        if (st.cli === 'builtin') {
          if (p.id === 'ipsec' || p.id === 'l2tp' || p.id === 'ssh') { s += 2; notes.push('works with what is already on the device'); }
          else { s -= 2; notes.push('needs an app or software on each device'); }
        } else if (p.id !== 'pptp') s += 1;
        if (st.net === 'tcp443') {
          if (p.id === 'ovpn' || p.id === 'ssl') { s += 3; notes.push('can run over TCP 443'); }
          else if (p.id === 'mesh') { s += 1; notes.push('falls back to relays over HTTPS'); }
          else if (p.id === 'ssh') { s += 1; notes.push('sshd can listen on 443'); }
          else { s -= 3; notes.push('needs UDP or ESP, which this network blocks'); }
        }
        return { p: p, s: s, notes: notes };
      });
      rows.sort(function (a, b) { return b.s - a.s; });
      return rows;
    }
    function draw() {
      ctl.innerHTML = '<div class="vp-row"><span class="vp-lab">I want to</span><select data-g aria-label="Goal">' + GOALS.map(function (g) { return '<option value="' + g[0] + '"' + (g[0] === st.goal ? ' selected' : '') + '>' + esc(g[1]) + '</option>'; }).join('') + '</select></div>' +
        '<div class="vp-row"><span class="vp-lab">My devices</span>' + chips([['install', 'can run an app'], ['builtin', 'only what the OS has built in']], st.cli, 'data-c') + '</div>' +
        '<div class="vp-row"><span class="vp-lab">The network allows</span>' + chips([['udp', 'UDP and most ports'], ['tcp443', 'only TCP 443 (hotel, strict firewall)']], st.net, 'data-n') + '</div>';
      var R = rank(), top = R[0];
      best.innerHTML = '<div class="vp-top"><span class="vp-badge">Best fit</span> <b>' + esc(top.p.name) + '</b><p>' + WHY[top.p.id][st.goal] + (top.notes.length ? ' <i>(' + esc(top.notes.join('; ')) + '.)</i>' : '') + '</p></div>' +
        '<div class="vp-also">Then: ' + R.slice(1, 3).map(function (x) { return '<b>' + esc(x.p.name) + '</b>'; }).join(', ') + '. Avoid: ' + R.filter(function (x) { return x.s < -1; }).slice(-2).map(function (x) { return esc(x.p.name); }).join(', ') + '.</div>';
      tbl.innerHTML = '<div class="vp-cards">' + R.map(function (x, i) {
        var cls = i === 0 ? 'best' : x.s < -1 ? 'avoid' : '';
        return '<article class="vp-card ' + cls + '"><h5>' + esc(x.p.name) + (i === 0 ? ' <span class="vp-badge">best fit</span>' : x.s < -1 ? ' <span class="vp-badge bad">avoid</span>' : '') + '</h5><dl>' +
          '<dt>Runs over</dt><dd>' + esc(x.p.over) + '<small>' + esc(x.p.ports) + '</small></dd>' +
          '<dt>Authentication</dt><dd>' + esc(x.p.auth) + '</dd>' +
          '<dt>Good at</dt><dd>' + esc(x.p.pro) + '</dd>' +
          '<dt>Watch out for</dt><dd>' + esc(x.p.con) + '</dd>' +
          '<dt>Built in or app</dt><dd>' + esc(x.p.built) + '</dd></dl></article>';
      }).join('') + '</div>';
    }
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-c')) st.cli = b.getAttribute('data-c'); else if (b.hasAttribute('data-n')) st.net = b.getAttribute('data-n'); else return;
      draw();
    });
    ctl.addEventListener('change', function (e) { if (e.target.hasAttribute('data-g')) { st.goal = e.target.value; draw(); } });
    draw();
    return r;
  }

  W.vpnpath = vpnpath; W.vpnmtu = vpnmtu; W.wgroute = wgroute; W.vpnshake = vpnshake; W.vpncmp = vpncmp;
  window.__vpnlab = { wire: wire, maxInner: maxInner, cidr: cidr };   // exposed for tests
})();
