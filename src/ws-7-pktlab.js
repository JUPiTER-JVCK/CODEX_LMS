/* Security part: the in-page packet analyser (Wireshark-style list, details tree, bytes, display filters,
   Follow TCP Stream, Conversations, challenges, and .pcap export). Uses window.__pcap and window.__pcapCols. */
(function () {
  'use strict';
  if (!window.__core) return;
  var K = window.__core, $ = K.$, $$ = K.$$, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};
  var P = window.__pcap;

  var EX = {
    browse: ['dns', 'tcp.flags.syn == 1 && tcp.flags.ack == 0', 'tls.handshake.type == 1', 'http', 'tcp.stream == 1', '!(arp || icmp)'],
    login: ['http.request', 'http.request.method == "POST"', 'frame contains "pass"', 'http.authorization', 'http.cookie || http.set_cookie', 'ip.addr == 192.168.1.60'],
    scan: ['tcp.flags.syn == 1 && tcp.flags.ack == 0', 'tcp.flags.syn == 1 && tcp.flags.ack == 1', 'tcp.flags.reset == 1', 'tcp.port in {22, 80, 445}', 'ip.ttl < 50'],
    arp: ['arp', 'arp.opcode == 2', 'arp.src.proto_ipv4 == 192.168.1.1', 'eth.addr == 66:66:66:13:37:01', 'tcp.flags.syn == 1'],
    exfil: ['dns', 'dns.qry.type == 16', 'dns.qry.name contains "cdn-sync"', 'dns && frame.len > 90', 'dns.qry.name matches "^[0-9]-"']
  };
  var CH = {
    browse: [
      { k: 'f', q: 'Show only DNS traffic.', ref: 'dns' },
      { k: 'a', q: 'Which server name did the Mac send in its TLS Client Hello?', ok: ['app.lab.example'], hint: 'Filter for tls.handshake.type == 1 and read the server_name extension in the details.' },
      { k: 'f', q: 'Show only the first packet of every TCP handshake.', ref: 'tcp.flags.syn == 1 && tcp.flags.ack == 0', hint: 'The first packet has SYN set and ACK not set.' },
      { k: 'a', q: 'What uptime, in seconds, did the health check report?', ok: ['86400'], hint: 'Select any packet of the HTTP conversation and use Follow TCP Stream.' }],
    login: [
      { k: 'f', q: 'Show only requests that send data to the server.', ref: 'http.request.method == "POST"' },
      { k: 'a', q: 'What password was submitted in the login form?', ok: ['hunter2-lab'], hint: 'Open the POST and read the form body, or Follow TCP Stream.' },
      { k: 'a', q: 'The backup script sent Basic credentials to the NAS. What is the password?', ok: ['nas-backup-2026'], hint: 'Basic is base64 of user:password. The details pane decodes it for you, like Wireshark does.' },
      { k: 'a', q: 'Which session cookie value did the server hand out?', ok: ['7f3a9c0e5d2b41a8'], hint: 'Look for Set-Cookie in the 302 response.' }],
    scan: [
      { k: 'a', q: 'Which IP address ran the scan?', ok: ['192.168.1.66'] },
      { k: 'f', q: 'Show only the replies that prove a port is open.', ref: 'tcp.flags.syn == 1 && tcp.flags.ack == 1', hint: 'An open port answers SYN with SYN, ACK.' },
      { k: 'a', q: 'Which ports are open? Separate them with commas.', set: ['22', '80', '445'] },
      { k: 'a', q: 'The scanner answers each SYN, ACK with RST instead of completing the handshake. Is this a connect scan or a half-open (SYN) scan?', ok: ['half-open', 'half open', 'syn', 'syn scan', 'half-open scan', 'stealth', 'half-open (syn)'] }],
    arp: [
      { k: 'f', q: 'Show only ARP replies.', ref: 'arp.opcode == 2' },
      { k: 'a', q: 'Which MAC address claims to be the router, 192.168.1.1, without being asked?', ok: ['66:66:66:13:37:01'] },
      { k: 'f', q: 'Show every frame sent from or to that MAC address.', ref: 'eth.addr == 66:66:66:13:37:01' },
      { k: 'a', q: 'From which frame number does the Mac send its HTTPS traffic to the attacker\'s MAC instead of the router\'s?', ok: ['20'], hint: 'Add the Ethernet destination: compare eth.dst in frames 3 and 20.' }],
    exfil: [
      { k: 'f', q: 'Show only the suspicious queries, not their responses.', ref: 'dns.qry.name contains "cdn-sync" && dns.flags.response == 0' },
      { k: 'a', q: 'Which domain is receiving the data?', ok: ['t.cdn-sync.net', 'cdn-sync.net'] },
      { k: 'a', q: 'Join the chunks in order, then decode them as base32. Which password leaked?', ok: ['corr3ct-h0rse'], contains: true, hint: 'The number before the dash orders the chunks. The chapter shows the Python to decode them.' }]
  };
  var COLOR = [['tcp.flags.reset == 1', 'rst'], ['tcp.flags.syn == 1 || tcp.flags.fin == 1', 'synfin'], ['http', 'http'], ['tcp', 'tcp'], ['udp', 'udp'], ['arp', 'arp'], ['icmp', 'icmp']].map(function (x) { return [P.compile(x[0]), x[1]]; });
  function colorOf(p) { for (var i = 0; i < COLOR.length; i++) if (COLOR[i][0](p)) return COLOR[i][1]; return ''; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('pktlab:' + k) || 'null'); localStorage.setItem('pktlab:' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }

  // Offering a file from the hosted page goes through the viewer's "downloads" capability; locally a plain link works.
  var DL = (window.claude && typeof window.claude.use === 'function') ? Promise.resolve(window.claude.use('downloads')).catch(function () { return null; }) : Promise.resolve(null);
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  // A one-file zip with the file stored uncompressed (method 0), enough for Archive Utility and unzip.
  function zip(name, data) {
    var nm = new TextEncoder().encode(name), crc = crc32(data), n = data.length, lh = 30 + nm.length, ch = 46 + nm.length;
    var out = new Uint8Array(lh + n + ch + 22), v = new DataView(out.buffer), o = 0;
    function hdr(sig, central) {
      v.setUint32(o, sig, true); o += 4; if (central) { v.setUint16(o, 20, true); o += 2; }
      v.setUint16(o, 20, true); v.setUint16(o + 2, 0, true); v.setUint16(o + 4, 0, true); v.setUint16(o + 6, 0, true); v.setUint16(o + 8, 0x5D71, true);
      v.setUint32(o + 10, crc, true); v.setUint32(o + 14, n, true); v.setUint32(o + 18, n, true); v.setUint16(o + 22, nm.length, true); v.setUint16(o + 24, 0, true); o += 26;
      if (central) { v.setUint16(o, 0, true); v.setUint16(o + 2, 0, true); v.setUint16(o + 4, 0, true); v.setUint32(o + 6, 0, true); v.setUint32(o + 10, 0, true); o += 14; }
      out.set(nm, o); o += nm.length;
    }
    hdr(0x04034b50, false); out.set(data, o); o += n;
    var cd = o; hdr(0x02014b50, true);
    v.setUint32(o, 0x06054b50, true); v.setUint16(o + 8, 1, true); v.setUint16(o + 10, 1, true); v.setUint32(o + 12, ch, true); v.setUint32(o + 16, cd, true);
    return out;
  }
  W.pktlab = function (args) {
    var r = h('div', { class: 'wg sv pk' }); r.style.setProperty('--dom', 'var(--c-sec)');
    r.innerHTML = '<h4>Packet lab: Wireshark in the page</h4><p class="sub">Five real captures, built byte for byte. Filter them with Wireshark display-filter syntax, open any packet in the details tree, follow conversations, and solve the challenges. Every capture also downloads as a <code>.pcap</code> that opens in Wireshark on your Mac, where the same filters give the same answers.</p>';
    var sc = (args && args.scenario) || 'browse', pk = [], shown = [], sel = 0, hl = null, view = 'tree', done = store('done') || {};
    var b = h('div', { html:
      '<div class="pk-sc" role="tablist">' + Object.keys(P.SCEN).map(function (k) { return '<button role="tab" data-s="' + k + '">' + esc(P.SCEN[k].title) + '</button>'; }).join('') + '</div>' +
      '<p class="pk-story" id="story"></p>' +
      '<div class="pk-bar"><span class="pk-ic" aria-hidden="true">⌕</span><input type="text" id="flt" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Display filter" placeholder="Apply a display filter … e.g. tcp.port == 443"><button class="btn" id="go">Apply</button><button class="btn sec" id="clr" title="Clear the filter">✕</button></div>' +
      '<div class="pk-ex" id="ex"></div><div class="pk-msg" id="msg" aria-live="polite"></div>' +
      '<div class="pk-list" id="list" tabindex="0" aria-label="Packet list. Use the arrow keys to move."></div>' +
      '<div class="pk-tools"><button class="chip" data-v="tree">Details</button><button class="chip" data-v="stream">Follow TCP Stream</button><button class="chip" data-v="conv">Conversations</button><span class="pk-sp"></span><button class="chip" id="dl">Download .pcap</button><button class="chip" id="cp">Copy as base64</button></div>' +
      '<div class="pk-low"><div class="pk-tree" id="tree"></div><pre class="pk-hex" id="hex" aria-label="Packet bytes"></pre></div>' +
      '<div class="pk-chal"><h5>Challenges</h5><ol id="ch"></ol></div>' });
    r.appendChild(b);
    var flt = $('#flt', b);

    function load(id) {
      sc = id; pk = P.build(id); var cols = (window.__pcapCols || {})[id] || [];
      pk.forEach(function (p, i) { p.col = cols[i] || [p.spec.src.ip || p.spec.src.mac, p.spec.dst.ip || p.spec.dst.mac, '', '']; p.cls = colorOf(p); });
      $$('.pk-sc button', b).forEach(function (x) { var on = x.getAttribute('data-s') === id; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
      $('#story', b).textContent = P.SCEN[id].story;
      $('#ex', b).innerHTML = '<span>Try:</span>' + EX[id].map(function (f) { return '<button class="chip mono" data-f="' + esc(f) + '">' + esc(f) + '</button>'; }).join('');
      flt.value = ''; apply(); chal();
    }
    function apply() {
      var s = flt.value.trim(), f;
      try { f = P.compile(s); } catch (e) { flt.classList.remove('ok'); flt.classList.add('bad'); $('#msg', b).innerHTML = '<span class="pk-err">' + esc(e.message) + '</span>'; return false; }
      flt.classList.toggle('ok', !!s); flt.classList.remove('bad');
      try { shown = pk.filter(function (p) { return f(p); }); } catch (e2) { flt.classList.add('bad'); flt.classList.remove('ok'); $('#msg', b).innerHTML = '<span class="pk-err">' + esc(e2.message) + '</span>'; return false; }
      $('#msg', b).innerHTML = 'Displayed: <b>' + shown.length + '</b> of ' + pk.length + ' packets' + (s ? ' · filter <code>' + esc(s) + '</code>' : '');
      if (!shown.some(function (p) { return p.n === sel; })) sel = shown.length ? shown[0].n : 0;
      list(); detail();
      return true;
    }
    function list() {
      var o = '<table><thead><tr><th>No.</th><th>Time</th><th>Source</th><th>Destination</th><th>Protocol</th><th>Length</th><th>Info</th></tr></thead><tbody>';
      shown.forEach(function (p) { o += '<tr data-n="' + p.n + '" class="pc-' + p.cls + (p.n === sel ? ' sel' : '') + '"><td>' + p.n + '</td><td>' + p.t.toFixed(6) + '</td><td>' + esc(p.col[0]) + '</td><td>' + esc(p.col[1]) + '</td><td>' + esc(p.col[2]) + '</td><td>' + p.bytes.length + '</td><td>' + esc(p.col[3]) + '</td></tr>'; });
      if (!shown.length) o += '<tr class="pk-none"><td colspan="7">No packets match this filter.</td></tr>';
      $('#list', b).innerHTML = o + '</tbody></table>';
      var row = $('#list tr.sel', b); if (row && row.scrollIntoView) { var L = $('#list', b), top = row.offsetTop - L.clientHeight / 2; if (row.offsetTop < L.scrollTop + 28 || row.offsetTop > L.scrollTop + L.clientHeight - 28) L.scrollTop = Math.max(0, top); }
    }
    function cur() { return pk[sel - 1]; }
    function detail() {
      $$('.pk-tools [data-v]', b).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-v') === view); });
      var p = cur(), T = $('#tree', b);
      if (view === 'conv') { T.innerHTML = conv(); hexdump(null); return; }
      if (!p) { T.innerHTML = '<p class="pk-dim">No packet selected.</p>'; hexdump(null); return; }
      if (view === 'stream') { T.innerHTML = stream(p); hexdump(null); return; }
      var o = '<details open><summary>Frame ' + p.n + ': ' + p.bytes.length + ' bytes on wire (' + p.bytes.length * 8 + ' bits)</summary><div class="pk-f">Arrival time (relative): ' + p.t.toFixed(6) + ' s</div><div class="pk-f">[Protocols in frame: ' + esc(p.protocols) + ']</div></details>';
      p.layers.forEach(function (l, li) {
        o += '<details open><summary data-r="' + l.off + ',' + (l.whole ? p.bytes.length - l.off : l.len) + '">' + esc(l.title) + '</summary>';
        l.fields.forEach(function (f) { o += '<button class="pk-f" data-r="' + f.off + ',' + f.len + '"' + (f.f ? ' title="' + esc(f.f) + '"' : '') + '>' + esc(f.label) + (f.f ? ' <i>' + esc(f.f) + '</i>' : '') + '</button>'; });
        o += '</details>'; void li;
      });
      T.innerHTML = o; hexdump(p);
    }
    function hexdump(p) {
      var H = $('#hex', b);
      if (!p) { H.innerHTML = ''; H.style.display = 'none'; return; }
      H.style.display = '';
      var u = p.bytes, o = '', a = hl ? hl[0] : -1, z = hl ? hl[0] + hl[1] : -1;
      for (var i = 0; i < u.length; i += 16) {
        o += '<span class="pk-o">' + ('000' + i.toString(16)).slice(-4) + '</span>  ';
        var asc = '';
        for (var j = 0; j < 16; j++) {
          var k = i + j;
          if (k < u.length) { var on = k >= a && k < z, hx = ('0' + u[k].toString(16)).slice(-2), ch = u[k] >= 32 && u[k] < 127 ? String.fromCharCode(u[k]) : '.'; o += (on ? '<b>' + hx + '</b>' : hx) + (j === 7 ? '  ' : ' '); asc += on ? '<b>' + esc(ch) + '</b>' : esc(ch); }
          else o += '   ' + (j === 7 ? ' ' : '');
        }
        o += ' ' + asc + '\n';
      }
      H.innerHTML = o;
    }
    function stream(p) {
      var t = p.spec.tcp; if (!t) return '<p class="pk-dim">Follow TCP Stream needs a TCP packet. Select one in the list.</p>';
      var id = t.stream, c = pk.filter(function (x) { return x.spec.tcp && x.spec.tcp.stream === id; }), first = c[0].spec, cli = first.src.ip, out = '', cb = 0, sb = 0;
      c.forEach(function (x) { var d = x.spec.tcp.data; if (!d) return; var fromC = x.spec.src.ip === cli; if (fromC) cb += d.length; else sb += d.length; out += '<span class="' + (fromC ? 'pk-c' : 'pk-s') + '">' + esc(d.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '.')) + '</span>'; });
      var fl = 'tcp.stream eq ' + id;
      return '<div class="pk-sh"><b>Stream ' + id + '</b>: ' + esc(cli + ':' + first.tcp.sp + ' → ' + first.dst.ip + ':' + first.tcp.dp) + ' · <span class="pk-c">client ' + cb + ' bytes</span> · <span class="pk-s">server ' + sb + ' bytes</span> <button class="chip mono" data-f="' + fl + '">' + fl + '</button></div><pre class="pk-st">' + (out || '<span class="pk-dim">This stream carries no payload.</span>') + '</pre>' + (/tls/.test(c.map(function (x) { return x.protocols; }).join()) ? '<p class="pk-dim">TLS records are encrypted, so this is noise. Wireshark can decrypt them only with the session keys (see SSLKEYLOGFILE in the chapter).</p>' : '');
    }
    function conv() {
      var m = {};
      pk.forEach(function (p) { var s = p.spec; if (!s.src.ip || !s.dst.ip) return; var a = [s.src.ip, s.dst.ip].sort(), k = a.join(' ↔ '); var c = m[k] = m[k] || { a: a[0], b: a[1], n: 0, bytes: 0, t0: p.t, t1: p.t }; c.n++; c.bytes += p.bytes.length; c.t1 = p.t; });
      var rows = Object.keys(m).map(function (k) { return m[k]; }).sort(function (x, y) { return y.bytes - x.bytes; });
      return '<div class="tw"><table class="pk-cv"><thead><tr><th>Address A</th><th>Address B</th><th>Packets</th><th>Bytes</th><th>Duration (s)</th><th></th></tr></thead><tbody>' +
        rows.map(function (c) { var f = 'ip.addr == ' + c.a + ' && ip.addr == ' + c.b; return '<tr><td>' + c.a + '</td><td>' + c.b + '</td><td>' + c.n + '</td><td>' + c.bytes + '</td><td>' + (c.t1 - c.t0).toFixed(3) + '</td><td><button class="chip" data-f="' + esc(f) + '">filter</button></td></tr>'; }).join('') + '</tbody></table></div><p class="pk-dim">Statistics, Conversations, IPv4 in Wireshark. ARP has no IP addresses, so it is not counted.</p>';
    }
    function norm(x) { return String(x).trim().toLowerCase().replace(/\s+/g, ' '); }
    function chal() {
      var L = CH[sc];
      $('#ch', b).innerHTML = L.map(function (c, i) {
        var key = sc + i, ok = done[key];
        return '<li class="' + (ok ? 'ok' : '') + '"><p>' + esc(c.q) + (ok ? ' <span class="pk-tick">✓ solved</span>' : '') + '</p>' + (c.k === 'f'
          ? '<div class="pk-ca"><span class="pk-dim">Type it in the filter bar, then</span> <button class="chip" data-c="' + i + '">Check my filter</button></div>'
          : '<div class="pk-ca"><input type="text" data-a="' + i + '" spellcheck="false" autocomplete="off" aria-label="Answer"><button class="chip" data-c="' + i + '">Check</button></div>') +
          '<div class="pk-fb" id="fb' + i + '"></div></li>';
      }).join('');
    }
    function check(i) {
      var c = CH[sc][i], fb = $('#fb' + i, b), good = false, msg = '';
      if (c.k === 'f') {
        if (!apply()) { fb.innerHTML = '<span class="pk-err">Fix the filter first.</span>'; return; }
        var want = P.run(sc, c.ref).join(','), got = shown.map(function (p) { return p.n; }).join(',');
        good = want === got && flt.value.trim() !== '';
        msg = good ? 'Exactly the right ' + shown.length + (shown.length === 1 ? ' packet' : ' packets') + '. One answer: <code>' + esc(c.ref) + '</code>' : 'Your filter shows ' + shown.length + ' packets; the answer shows ' + want.split(',').filter(Boolean).length + '.' + (c.hint ? ' Hint: ' + esc(c.hint) : '');
      } else {
        var v = norm($('[data-a="' + i + '"]', b).value);
        if (c.set) good = v.split(/[\s,]+/).filter(Boolean).sort().join(',') === c.set.slice().sort().join(',');
        else good = c.ok.some(function (a) { return c.contains ? v.indexOf(a) >= 0 : v === a; });
        msg = good ? 'Correct.' : (v ? 'Not that.' : 'Type an answer first.') + (c.hint ? ' Hint: ' + esc(c.hint) : '');
      }
      fb.innerHTML = '<span class="' + (good ? 'pk-ok' : 'pk-err') + '">' + (good ? '✓ ' : '✗ ') + msg + '</span>';
      if (good) { done[sc + i] = 1; store('done', done); var li = fb.parentNode; li.classList.add('ok'); if (!$('.pk-tick', li)) $('p', li).insertAdjacentHTML('beforeend', ' <span class="pk-tick">✓ solved</span>'); }
    }
    b.addEventListener('click', function (e) {
      var t = e.target.closest('button,tr[data-n],summary[data-r]'); if (!t) return;
      if (t.hasAttribute('data-s')) { load(t.getAttribute('data-s')); return; }
      if (t.hasAttribute('data-f')) { flt.value = t.getAttribute('data-f'); if (view === 'conv' || view === 'stream') view = 'tree'; apply(); return; }
      if (t.tagName === 'TR') { sel = +t.getAttribute('data-n'); hl = null; $$('#list tr.sel', b).forEach(function (x) { x.classList.remove('sel'); }); t.classList.add('sel'); detail(); return; }
      if (t.hasAttribute('data-r')) { var q = t.getAttribute('data-r').split(','); hl = [+q[0], +q[1]]; $$('#tree .on', b).forEach(function (x) { x.classList.remove('on'); }); t.classList.add('on'); hexdump(cur()); if (t.tagName === 'SUMMARY') { } return; }
      if (t.hasAttribute('data-v')) { view = t.getAttribute('data-v'); detail(); return; }
      if (t.hasAttribute('data-c')) { check(+t.getAttribute('data-c')); return; }
      if (t.id === 'go') apply();
      if (t.id === 'clr') { flt.value = ''; flt.classList.remove('ok', 'bad'); apply(); }
      if (t.id === 'dl') {
        var bytes = P.pcap(sc), name = 'lab-' + sc + '.pcap';
        DL.then(function (dl) {
          if (!dl) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.tcpdump.pcap' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
            K.toast('If nothing downloaded, use Copy as base64 instead'); return;
          }
          // The hosted page may only offer certain file types, and .pcap is not one: wrap it in a zip.
          dl.save({ filename: 'lab-' + sc + '.zip', data: new Blob([zip(name, bytes)]) }).then(function () { K.toast('Saved. Double-click the zip to get ' + name + ', then open it in Wireshark'); },
            function (e) { if (e && e.code !== 'declined') K.toast('Download not available here: use Copy as base64 instead'); });
        });
      }
      if (t.id === 'cp') { K.copyText(b64(P.pcap(sc))); K.toast('Copied. In Terminal: pbpaste | base64 -d > lab-' + sc + '.pcap'); }
    });
    flt.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
    flt.addEventListener('input', function () { var s = flt.value.trim(); try { P.compile(s); flt.classList.remove('bad'); flt.classList.toggle('ok', !!s); } catch (e) { flt.classList.add('bad'); flt.classList.remove('ok'); } });
    $('#list', b).addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return; e.preventDefault();
      var i = shown.findIndex(function (p) { return p.n === sel; }), j = Math.max(0, Math.min(shown.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      if (shown[j]) { sel = shown[j].n; hl = null; list(); detail(); }
    });
    load(sc);
    return r;
  };
})();
