/* Security part: packet engine (encoder, fields, display filters) shared by the in-page analyser and tools/pcapgen.js.
   Everything here is pure and DOM-free so Node can load it to write real .pcap files. */
(function (root) {
  'use strict';
  /* ---------- byte helpers ---------- */
  function B() { this.a = []; }
  B.prototype.u8 = function (v) { this.a.push(v & 255); return this; };
  B.prototype.u16 = function (v) { this.a.push((v >>> 8) & 255, v & 255); return this; };
  B.prototype.u24 = function (v) { this.a.push((v >>> 16) & 255, (v >>> 8) & 255, v & 255); return this; };
  B.prototype.u32 = function (v) { this.a.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); return this; };
  B.prototype.bytes = function (x) { for (var i = 0; i < x.length; i++) this.a.push(x[i] & 255); return this; };
  B.prototype.str = function (s) { for (var i = 0; i < s.length; i++) this.a.push(s.charCodeAt(i) & 255); return this; };
  B.prototype.len = function () { return this.a.length; };
  function ip2b(ip) { return ip.split('.').map(Number); }
  function ip2n(ip) { var p = ip2b(ip); return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]; }
  function mac2b(m) { return m.split(':').map(function (x) { return parseInt(x, 16); }); }
  function csum(arr, start, end) { var s = 0; for (var i = start; i < end; i += 2) s += (arr[i] << 8) + (i + 1 < end ? arr[i + 1] : 0); while (s >> 16) s = (s & 0xffff) + (s >> 16); return (~s) & 0xffff; }
  function unb64(x) { var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', bits = 0, n = 0, o = ''; for (var i = 0; i < x.length; i++) { var c = A.indexOf(x[i]); if (c < 0) continue; bits = (bits << 6) | c; n += 6; if (n >= 8) { n -= 8; o += String.fromCharCode((bits >> n) & 255); } } return o; }
  function hex16(v) { return '0x' + ('000' + v.toString(16)).slice(-4); }
  function rnd(seed) { var x = seed >>> 0 || 1; return function () { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; }; }

  /* ---------- encoder: one packet spec -> bytes + dissection ---------- */
  // spec: {t, src:{mac,ip}, dst:{mac,ip}, arp:{op, sha, spa, tha, tpa}} or {ip:{ttl,id}, tcp:{sp,dp,seq,ack,fl,win,data}} / udp:{sp,dp,data,dns} / icmp:{type,code,id,seq}
  var TCPF = { F: 1, S: 2, R: 4, P: 8, A: 16 };
  function encode(sp) {
    var b = new B(), L = [], F = {};
    function fld(layer, name, label, off, len, val, type) { layer.fields.push({ f: name, label: label, off: off, len: len }); if (name) (F[name] = F[name] || []).push({ v: val, t: type || 'num' }); }
    function layer(proto, title, off) { var l = { p: proto, title: title, off: off, len: 0, fields: [] }; L.push(l); return l; }
    var eth = layer('eth', '', 0);
    b.bytes(mac2b(sp.dst.mac)).bytes(mac2b(sp.src.mac)).u16(sp.arp ? 0x0806 : 0x0800);
    eth.title = 'Ethernet II, Src: ' + sp.src.mac + ', Dst: ' + sp.dst.mac;
    fld(eth, 'eth.dst', 'Destination: ' + sp.dst.mac, 0, 6, sp.dst.mac, 'mac'); fld(eth, 'eth.src', 'Source: ' + sp.src.mac, 6, 6, sp.src.mac, 'mac');
    fld(eth, 'eth.type', 'Type: ' + (sp.arp ? 'ARP (0x0806)' : 'IPv4 (0x0800)'), 12, 2, sp.arp ? 0x0806 : 0x0800);
    F['eth.addr'] = [{ v: sp.dst.mac, t: 'mac' }, { v: sp.src.mac, t: 'mac' }]; eth.len = 14; eth.whole = true;
    var proto = 'eth:ethertype';
    if (sp.arp) {
      var a = sp.arp, al = layer('arp', 'Address Resolution Protocol (' + (a.op === 1 ? 'request' : 'reply') + ')', 14);
      b.u16(1).u16(0x0800).u8(6).u8(4).u16(a.op).bytes(mac2b(a.sha)).bytes(ip2b(a.spa)).bytes(mac2b(a.tha)).bytes(ip2b(a.tpa));
      fld(al, 'arp.opcode', 'Opcode: ' + (a.op === 1 ? 'request (1)' : 'reply (2)'), 20, 2, a.op);
      fld(al, 'arp.src.hw_mac', 'Sender MAC address: ' + a.sha, 22, 6, a.sha, 'mac'); fld(al, 'arp.src.proto_ipv4', 'Sender IP address: ' + a.spa, 28, 4, ip2n(a.spa), 'ip');
      fld(al, 'arp.dst.hw_mac', 'Target MAC address: ' + a.tha, 32, 6, a.tha, 'mac'); fld(al, 'arp.dst.proto_ipv4', 'Target IP address: ' + a.tpa, 38, 4, ip2n(a.tpa), 'ip');
      al.len = 28; proto += ':arp';
      return finish();
    }
    var ipo = 14, pr = sp.tcp ? 6 : sp.udp ? 17 : 1, ipl = layer('ip', 'Internet Protocol Version 4, Src: ' + sp.src.ip + ', Dst: ' + sp.dst.ip, ipo);
    var payload = new B(), l4 = null, app = null;
    if (sp.tcp) {
      var t = sp.tcp, data = t.data || '';
      payload.u16(t.sp).u16(t.dp).u32(t.seq >>> 0).u32(t.ack >>> 0).u8(0x50).u8(flagsNum(t.fl)).u16(t.win === undefined ? 64240 : t.win).u16(0).u16(0).str(data);
    } else if (sp.udp) {
      var u = sp.udp, ud = u.dns ? dnsBytes(u.dns) : (u.data || []);
      payload.u16(u.sp).u16(u.dp).u16(8 + ud.length).u16(0).bytes(ud);
    } else {
      var ic = sp.icmp, pat = []; for (var k = 0; k < 48; k++) pat.push(k + 16);
      payload.u8(ic.type).u8(ic.code || 0).u16(0).u16(ic.id).u16(ic.seq).u32(0x6539f7a0).u32(0x000d2c1e).bytes(pat);
    }
    var tot = 20 + payload.len(), ttl = (sp.ip && sp.ip.ttl) || 64, ipid = (sp.ip && sp.ip.id) || 0;
    b.u8(0x45).u8(0).u16(tot).u16(ipid).u16(0x4000).u8(ttl).u8(pr).u16(0).bytes(ip2b(sp.src.ip)).bytes(ip2b(sp.dst.ip));
    var ck = csum(b.a, ipo, ipo + 20); b.a[ipo + 10] = ck >> 8; b.a[ipo + 11] = ck & 255;
    fld(ipl, 'ip.len', 'Total Length: ' + tot, ipo + 2, 2, tot); fld(ipl, 'ip.id', 'Identification: ' + hex16(ipid) + ' (' + ipid + ')', ipo + 4, 2, ipid);
    fld(ipl, 'ip.ttl', 'Time to Live: ' + ttl, ipo + 8, 1, ttl); fld(ipl, 'ip.proto', 'Protocol: ' + ({ 6: 'TCP', 17: 'UDP', 1: 'ICMP' })[pr] + ' (' + pr + ')', ipo + 9, 1, pr);
    fld(ipl, 'ip.src', 'Source Address: ' + sp.src.ip, ipo + 12, 4, ip2n(sp.src.ip), 'ip'); fld(ipl, 'ip.dst', 'Destination Address: ' + sp.dst.ip, ipo + 16, 4, ip2n(sp.dst.ip), 'ip');
    F['ip.addr'] = [{ v: ip2n(sp.src.ip), t: 'ip' }, { v: ip2n(sp.dst.ip), t: 'ip' }]; ipl.len = 20; ipl.whole = true; proto += ':ip';
    var l4o = ipo + 20, pb = payload.a;
    // pseudo-header checksum for TCP/UDP
    if (pr !== 1) {
      var ph = ip2b(sp.src.ip).concat(ip2b(sp.dst.ip), [0, pr, (pb.length >> 8) & 255, pb.length & 255]).concat(pb);
      var c2 = csum(ph, 0, ph.length); if (pr === 17 && c2 === 0) c2 = 0xffff;
      var co = pr === 6 ? 16 : 6; pb[co] = c2 >> 8; pb[co + 1] = c2 & 255;
    } else { var c3 = csum(pb, 0, pb.length); pb[2] = c3 >> 8; pb[3] = c3 & 255; }
    b.bytes(pb);
    if (sp.tcp) {
      var T = sp.tcp, dl = (T.data || '').length, fn = flagsNum(T.fl);
      l4 = layer('tcp', 'Transmission Control Protocol, Src Port: ' + T.sp + ', Dst Port: ' + T.dp + ', Seq: ' + T.rseq + (fn & 16 ? ', Ack: ' + T.rack : '') + ', Len: ' + dl, l4o);
      fld(l4, 'tcp.srcport', 'Source Port: ' + T.sp, l4o, 2, T.sp); fld(l4, 'tcp.dstport', 'Destination Port: ' + T.dp, l4o + 2, 2, T.dp);
      fld(l4, 'tcp.stream', '[Stream index: ' + T.stream + ']', 0, 0, T.stream); fld(l4, 'tcp.len', '[TCP Segment Len: ' + dl + ']', 0, 0, dl);
      fld(l4, 'tcp.seq', 'Sequence Number: ' + T.rseq + '    (relative sequence number)', l4o + 4, 4, T.rseq); fld(l4, 'tcp.seq_raw', 'Sequence Number (raw): ' + (T.seq >>> 0), l4o + 4, 4, T.seq >>> 0);
      fld(l4, 'tcp.ack', 'Acknowledgment Number: ' + (fn & 16 ? T.rack : 0) + (fn & 16 ? '    (relative ack number)' : ''), l4o + 8, 4, fn & 16 ? T.rack : 0);
      fld(l4, 'tcp.flags', 'Flags: ' + hex16(fn).replace('0x0', '0x') + ' (' + flagNames(fn) + ')', l4o + 13, 1, fn);
      [['syn', 2], ['ack', 16], ['fin', 1], ['reset', 4], ['push', 8]].forEach(function (x) { (F['tcp.flags.' + x[0]] = []).push({ v: fn & x[1] ? 1 : 0, t: 'num' }); });
      var wv = T.win === undefined ? 64240 : T.win; fld(l4, 'tcp.window_size_value', 'Window: ' + wv, l4o + 14, 2, wv);
      F['tcp.port'] = [{ v: T.sp, t: 'num' }, { v: T.dp, t: 'num' }];
      l4.len = 20; proto += ':tcp';
      if (dl) { fld(l4, 'tcp.payload', 'TCP payload (' + dl + ' bytes)', l4o + 20, dl, T.data, 'str'); app = appLayer(T, l4o + 20); }
    } else if (sp.udp) {
      var U = sp.udp, ulen = pb.length;
      l4 = layer('udp', 'User Datagram Protocol, Src Port: ' + U.sp + ', Dst Port: ' + U.dp, l4o);
      fld(l4, 'udp.srcport', 'Source Port: ' + U.sp, l4o, 2, U.sp); fld(l4, 'udp.dstport', 'Destination Port: ' + U.dp, l4o + 2, 2, U.dp);
      fld(l4, 'udp.length', 'Length: ' + ulen, l4o + 4, 2, ulen); fld(l4, 'udp.stream', '[Stream index: ' + U.stream + ']', 0, 0, U.stream);
      F['udp.port'] = [{ v: U.sp, t: 'num' }, { v: U.dp, t: 'num' }]; l4.len = 8; proto += ':udp';
      if (U.dns) dnsLayer(U.dns, l4o + 8);
    } else {
      var I = sp.icmp; l4 = layer('icmp', 'Internet Control Message Protocol', l4o);
      fld(l4, 'icmp.type', 'Type: ' + I.type + (I.type === 8 ? ' (Echo (ping) request)' : I.type === 0 ? ' (Echo (ping) reply)' : ''), l4o, 1, I.type);
      fld(l4, 'icmp.code', 'Code: ' + (I.code || 0), l4o + 1, 1, I.code || 0);
      fld(l4, 'icmp.ident', 'Identifier (BE): ' + I.id + ' (' + hex16(I.id) + ')', l4o + 4, 2, I.id); fld(l4, 'icmp.seq', 'Sequence Number (BE): ' + I.seq + ' (' + hex16(I.seq) + ')', l4o + 6, 2, I.seq);
      l4.len = pb.length; proto += ':icmp:data';
    }
    void app;
    return finish();

    function appLayer(T, o) {
      var d = T.data;
      if (/^(GET|POST|PUT|DELETE|HEAD|PATCH) \S+ HTTP\/1\.[01]\r\n/.test(d) || /^HTTP\/1\.[01] \d{3}/.test(d)) {
        var hl = layer('http', 'Hypertext Transfer Protocol', o), head = d.split('\r\n\r\n')[0], lines = head.split('\r\n'), pos = o;
        hl.len = d.length; proto += ':http';
        var first = lines[0], m;
        if ((m = /^(\S+) (\S+) (HTTP\/1\.[01])$/.exec(first))) {
          fld(hl, 'http.request.method', 'Request Method: ' + m[1], pos, m[1].length, m[1], 'str'); fld(hl, 'http.request.uri', 'Request URI: ' + m[2], pos + m[1].length + 1, m[2].length, m[2], 'str');
          (F['http.request'] = []).push({ v: 1, t: 'num' }); hl.fields.unshift({ f: '', label: first + '\\r\\n', off: pos, len: first.length + 2 });
        } else if ((m = /^HTTP\/1\.[01] (\d{3}) (.*)$/.exec(first))) {
          fld(hl, 'http.response.code', 'Status Code: ' + m[1], pos + 9, 3, +m[1]); fld(hl, 'http.response.phrase', 'Response Phrase: ' + m[2], pos + 13, m[2].length, m[2], 'str');
          (F['http.response'] = []).push({ v: 1, t: 'num' }); hl.fields.unshift({ f: '', label: first + '\\r\\n', off: pos, len: first.length + 2 });
        }
        pos += first.length + 2;
        var map = { host: 'http.host', 'user-agent': 'http.user_agent', authorization: 'http.authorization', cookie: 'http.cookie', 'set-cookie': 'http.set_cookie', 'content-type': 'http.content_type', location: 'http.location', 'content-length': 'http.content_length' };
        lines.slice(1).forEach(function (ln) {
          var k = ln.indexOf(':'), name = ln.slice(0, k).toLowerCase(), val = ln.slice(k + 1).trim();
          var fname = map[name] || '';
          fld(hl, fname, ln + '\\r\\n', pos, ln.length + 2, name === 'content-length' ? +val : val, name === 'content-length' ? 'num' : 'str');
          if (name === 'authorization' && /^Basic /i.test(val)) { var cred = unb64(val.slice(6)); hl.fields.push({ f: 'http.authbasic', label: '    Credentials: ' + cred, off: pos, len: ln.length }); (F['http.authbasic'] = []).push({ v: cred, t: 'str' }); }
          pos += ln.length + 2;
        });
        var body = d.slice(head.length + 4);
        if (body) fld(hl, 'http.file_data', 'File Data: ' + body.length + ' bytes', o + head.length + 4, body.length, body, 'str');
        return hl;
      }
      if (d.charCodeAt(0) === 22 || d.charCodeAt(0) === 23 || d.charCodeAt(0) === 20) return tlsLayer(d, o);
      return null;
    }
    function tlsLayer(d, o) {
      var tl = layer('tls', 'Transport Layer Security', o); tl.len = d.length; proto += ':tls';
      var i = 0;
      while (i + 5 <= d.length) {
        var ct = d.charCodeAt(i), rl = (d.charCodeAt(i + 3) << 8) + d.charCodeAt(i + 4);
        var ctn = { 20: 'Change Cipher Spec (20)', 22: 'Handshake (22)', 23: 'Application Data (23)' }[ct] || ct;
        fld(tl, 'tls.record.content_type', 'TLS Record Layer: ' + ctn.replace(/ \(\d+\)/, '') + ' Protocol, Content Type: ' + ctn + ', Length: ' + rl, o + i, 5 + rl, ct);
        if (ct === 22) {
          var ht = d.charCodeAt(i + 5);
          fld(tl, 'tls.handshake.type', '    Handshake Type: ' + (ht === 1 ? 'Client Hello (1)' : ht === 2 ? 'Server Hello (2)' : ht), o + i + 5, 1, ht);
          if (ht === 1) {
            var sni = T_sni(d, i + 5), alpn = T_alpn(d, i + 5);
            if (sni) fld(tl, 'tls.handshake.extensions_server_name', '    Extension: server_name, Server Name: ' + sni.name, o + sni.off, sni.name.length, sni.name, 'str');
            alpn.forEach(function (a) { fld(tl, 'tls.handshake.extensions_alpn_str', '    ALPN Next Protocol: ' + a.s, o + a.off, a.s.length, a.s, 'str'); });
          }
        }
        i += 5 + rl;
      }
      return tl;
    }
    function dnsLayer(q, o) {
      var dl = layer('dns', 'Domain Name System (' + (q.resp ? 'response' : 'query') + ')', o); proto += ':dns';
      var bytes = dnsBytes(q); dl.len = bytes.length;
      fld(dl, 'dns.id', 'Transaction ID: ' + hex16(q.id), o, 2, q.id);
      fld(dl, 'dns.flags.response', 'Flags: ' + (q.resp ? '0x8180 Standard query response, No error' : '0x0100 Standard query'), o + 2, 2, q.resp ? 1 : 0);
      fld(dl, 'dns.count.answers', 'Answer RRs: ' + (q.ans ? q.ans.length : 0), o + 6, 2, q.ans ? q.ans.length : 0);
      var nl = q.name.split('.').reduce(function (s, x) { return s + x.length + 1; }, 1);
      fld(dl, 'dns.qry.name', 'Queries: ' + q.name + ': type ' + qtn(q.type) + ', class IN', o + 12, nl + 4, q.name, 'str');
      fld(dl, 'dns.qry.name.len', '    [Name Length: ' + q.name.length + ']', 0, 0, q.name.length);
      fld(dl, 'dns.qry.type', '    Type: ' + qtn(q.type) + ' (' + q.type + ')', o + 12 + nl, 2, q.type);
      var p = o + 12 + nl + 4;
      (q.ans || []).forEach(function (a) {
        var rd = q.type === 16 ? a.length + 1 : 4;
        if (q.type === 1) fld(dl, 'dns.a', 'Answers: ' + q.name + ': type A, class IN, addr ' + a, p, 12 + rd, ip2n(a), 'ip');
        else fld(dl, 'dns.txt', 'Answers: ' + q.name + ': type TXT, class IN, "' + a + '"', p, 12 + rd, a, 'str');
        p += 12 + rd;
      });
      if (q.resp) (F['dns.flags.rcode'] = []).push({ v: 0, t: 'num' });
    }
    function finish() {
      var u8 = new Uint8Array(b.a);
      F['frame.len'] = [{ v: u8.length, t: 'num' }];
      F['frame.protocols'] = [{ v: proto, t: 'str' }];
      var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
      F.frame = [{ v: s, t: 'str' }];
      L.forEach(function (l) { F[l.p] = [{ v: l.whole ? s.substr(l.off) : s.substr(l.off, l.len || (u8.length - l.off)), t: 'str' }]; });
      return { bytes: u8, layers: L, fields: F, protocols: proto };
    }
  }
  function T_sni(d, h) {
    // h: offset of handshake header. skip type(1) len(3) version(2) random(32) sid
    var p = h + 4 + 2 + 32, sl = d.charCodeAt(p); p += 1 + sl;
    var cl = (d.charCodeAt(p) << 8) + d.charCodeAt(p + 1); p += 2 + cl;
    var cm = d.charCodeAt(p); p += 1 + cm; var el = (d.charCodeAt(p) << 8) + d.charCodeAt(p + 1); p += 2; var end = p + el;
    while (p + 4 <= end) {
      var et = (d.charCodeAt(p) << 8) + d.charCodeAt(p + 1), ln = (d.charCodeAt(p + 2) << 8) + d.charCodeAt(p + 3);
      if (et === 0) { var nl = (d.charCodeAt(p + 7) << 8) + d.charCodeAt(p + 8); return { name: d.substr(p + 9, nl), off: p + 9 }; }
      p += 4 + ln;
    }
    return null;
  }
  function T_alpn(d, h) {
    var out = [], p = h + 4 + 2 + 32, sl = d.charCodeAt(p); p += 1 + sl;
    var cl = (d.charCodeAt(p) << 8) + d.charCodeAt(p + 1); p += 2 + cl; var cm = d.charCodeAt(p); p += 1 + cm;
    var el = (d.charCodeAt(p) << 8) + d.charCodeAt(p + 1); p += 2; var end = p + el;
    while (p + 4 <= end) {
      var et = (d.charCodeAt(p) << 8) + d.charCodeAt(p + 1), ln = (d.charCodeAt(p + 2) << 8) + d.charCodeAt(p + 3);
      if (et === 16) { var q = p + 6, e2 = p + 4 + ln; while (q < e2) { var n = d.charCodeAt(q); out.push({ s: d.substr(q + 1, n), off: q + 1 }); q += 1 + n; } }
      p += 4 + ln;
    }
    return out;
  }
  function qtn(t) { return { 1: 'A', 16: 'TXT', 28: 'AAAA' }[t] || String(t); }
  function flagsNum(fl) { var n = 0; String(fl || '').split('').forEach(function (c) { n |= TCPF[c] || 0; }); return n; }
  function flagNames(n) { var o = []; if (n & 1) o.push('FIN'); if (n & 2) o.push('SYN'); if (n & 4) o.push('RST'); if (n & 8) o.push('PSH'); if (n & 16) o.push('ACK'); return o.join(', '); }
  function dnsBytes(q) {
    var b = new B();
    b.u16(q.id).u16(q.resp ? 0x8180 : 0x0100).u16(1).u16(q.ans ? q.ans.length : 0).u16(0).u16(0);
    q.name.split('.').forEach(function (l) { b.u8(l.length).str(l); }); b.u8(0).u16(q.type).u16(1);
    (q.ans || []).forEach(function (a) {
      b.u16(0xc00c).u16(q.type).u16(1).u32(q.ttl || 300);
      if (q.type === 1) b.u16(4).bytes(ip2b(a)); else b.u16(a.length + 1).u8(a.length).str(a);
    });
    return b.a;
  }
  function tlsClientHello(sni, seed) {
    var r = rnd(seed), hs = new B(), ext = new B();
    function bytesN(n) { var o = []; for (var i = 0; i < n; i++) o.push(r() & 255); return o; }
    // server_name
    ext.u16(0).u16(sni.length + 5).u16(sni.length + 3).u8(0).u16(sni.length).str(sni);
    ext.u16(10).u16(8).u16(6).u16(0x11ec).u16(0x001d).u16(0x0017);            // supported_groups: X25519MLKEM768, x25519, secp256r1
    ext.u16(13).u16(8).u16(6).u16(0x0403).u16(0x0804).u16(0x0807);            // signature_algorithms
    ext.u16(16).u16(14).u16(12).u8(2).str('h2').u8(8).str('http/1.1');       // ALPN
    ext.u16(43).u16(3).u8(2).u16(0x0304);                                     // supported_versions: TLS 1.3
    ext.u16(51).u16(38).u16(36).u16(0x001d).u16(32).bytes(bytesN(32));       // key_share: x25519
    var body = new B(); body.u16(0x0303).bytes(bytesN(32)).u8(32).bytes(bytesN(32)).u16(6).u16(0x1301).u16(0x1302).u16(0x1303).u8(1).u8(0).u16(ext.len()).bytes(ext.a);
    hs.u8(1).u24(body.len()).bytes(body.a);
    var rec = new B(); rec.u8(22).u16(0x0301).u16(hs.len()).bytes(hs.a);
    return String.fromCharCode.apply(null, rec.a);
  }
  function tlsServerFlight(seed, extra) {
    var r = rnd(seed), sh = new B(), ext = new B();
    function bytesN(n) { var o = []; for (var i = 0; i < n; i++) o.push(r() & 255); return o; }
    ext.u16(43).u16(2).u16(0x0304).u16(51).u16(36).u16(0x001d).u16(32).bytes(bytesN(32));
    var body = new B(); body.u16(0x0303).bytes(bytesN(32)).u8(32).bytes(bytesN(32)).u16(0x1301).u8(0).u16(ext.len()).bytes(ext.a);
    sh.u8(2).u24(body.len()).bytes(body.a);
    var rec = new B(); rec.u8(22).u16(0x0303).u16(sh.len()).bytes(sh.a);
    rec.u8(20).u16(0x0303).u16(1).u8(1);
    var app = bytesN(extra || 900); rec.u8(23).u16(0x0303).u16(app.length).bytes(app);
    return String.fromCharCode.apply(null, rec.a);
  }
  function tlsApp(seed, n) { var r = rnd(seed), rec = new B(), app = []; for (var i = 0; i < n; i++) app.push(r() & 255); rec.u8(23).u16(0x0303).u16(n).bytes(app); return String.fromCharCode.apply(null, rec.a); }

  /* ---------- scenario builder ---------- */
  var H = {
    mac: { a: '8c:85:90:4a:2e:17', ip: '192.168.1.23' },          // your Mac
    router: { mac: '3c:37:86:c1:5a:02', ip: '192.168.1.1' },
    nas: { mac: '00:11:32:9e:41:aa', ip: '192.168.1.60' },
    evil: { mac: '66:66:66:13:37:01', ip: '192.168.1.66' }
  };
  H.mac.mac = H.mac.a;
  function Cap() { this.p = []; this.t = 0; this.streams = {}; this.ustreams = {}; this.ipid = 0x1c40; }
  Cap.prototype.at = function (dt) { this.t += dt; return this; };
  Cap.prototype.push = function (sp) { sp.t = this.t; this.p.push(sp); return this; };
  function hop(host, remoteIp) { return remoteIp ? { mac: H.router.mac, ip: remoteIp } : host; }
  Cap.prototype.dns = function (from, server, name, type, ans, id, sport, dt) {
    var key = from.ip + ':' + sport, s = this.ustreams[key]; if (s === undefined) s = this.ustreams[key] = Object.keys(this.ustreams).length;
    this.push({ src: from, dst: { mac: H.router.mac, ip: server }, ip: { ttl: 64, id: this.ipid++ }, udp: { sp: sport, dp: 53, stream: s, dns: { id: id, name: name, type: type } } });
    this.at(dt || 0.018);
    this.push({ src: { mac: H.router.mac, ip: server }, dst: from, ip: { ttl: 63, id: 0 }, udp: { sp: 53, dp: sport, stream: s, dns: { id: id, name: name, type: type, resp: true, ans: ans, ttl: 300 } } });
    return this;
  };
  // A TCP conversation. msgs: [['c'|'s', data, dt]...]. opts: {cport, sport, rtt, close, srvMac, isn1, isn2}
  Cap.prototype.tcp = function (cli, srv, opts, msgs) {
    var key = cli.ip + ':' + opts.cport + '>' + srv.ip + ':' + opts.sport, st = this.streams[key];
    if (st === undefined) st = this.streams[key] = Object.keys(this.streams).length;
    var cs = opts.isn1 >>> 0, ss = opts.isn2 >>> 0, cr = 0, sr = 0, rtt = opts.rtt || 0.02, self = this;
    var cMac = cli, sMac = opts.srvMac ? { mac: opts.srvMac, ip: srv.ip } : srv;
    function seg(dir, fl, data, dt) {
      if (dt) self.at(dt);
      var fromC = dir === 'c', src = fromC ? cMac : sMac, dst = fromC ? sMac : cMac;
      var seq = fromC ? cs + cr : ss + sr, ack = /A/.test(fl) ? (fromC ? ss + sr : cs + cr) : 0;
      self.push({ src: src, dst: dst, ip: { ttl: fromC ? 64 : (opts.ttl || 56), id: fromC ? self.ipid++ : 0 }, tcp: { sp: fromC ? opts.cport : opts.sport, dp: fromC ? opts.sport : opts.cport, seq: seq, ack: ack, rseq: fromC ? cr : sr, rack: fromC ? sr : cr, fl: fl, win: fromC ? 2058 : 509, data: data || '', stream: st } });
      var adv = (data || '').length + (/[SF]/.test(fl) ? 1 : 0);
      if (fromC) cr += adv; else sr += adv;
    }
    seg('c', 'S', '', 0); seg('s', 'SA', '', rtt / 2); seg('c', 'A', '', rtt / 2);
    msgs.forEach(function (m) { seg(m[0], m[3] || 'PA', m[1], m[2] === undefined ? 0.002 : m[2]); if (m[4] !== false) seg(m[0] === 'c' ? 's' : 'c', 'A', '', 0.0004); });
    if (opts.close) { seg('c', 'FA', '', 0.01); seg('s', 'FA', '', rtt / 2); seg('c', 'A', '', rtt / 2); }
    return this;
  };
  function crlf(lines, body) { lines = lines.map(function (l) { return /^Content-Length:/i.test(l) ? 'Content-Length: ' + (body || '').length : l; }); return lines.join('\r\n') + '\r\n\r\n' + (body || ''); }

  function scenarioBrowse() {
    var c = new Cap(), me = H.mac, web = { mac: H.router.mac, ip: '203.0.113.10' }, api = { mac: H.router.mac, ip: '198.51.100.20' };
    c.push({ src: me, dst: { mac: 'ff:ff:ff:ff:ff:ff', ip: '' }, arp: { op: 1, sha: me.mac, spa: me.ip, tha: '00:00:00:00:00:00', tpa: H.router.ip } });
    c.at(0.0021).push({ src: H.router, dst: me, arp: { op: 2, sha: H.router.mac, spa: H.router.ip, tha: me.mac, tpa: me.ip } });
    c.at(0.01).dns(me, H.router.ip, 'app.lab.example', 1, ['203.0.113.10'], 0x3c1a, 58212, 0.0213);
    c.at(0.0012).tcp(me, web, { cport: 51514, sport: 443, isn1: 0x9a3b10c2, isn2: 0x5e01d77a, rtt: 0.028, close: true },
      [['c', tlsClientHello('app.lab.example', 7), 0.001], ['s', tlsServerFlight(11, 1100), 0.016], ['c', tlsApp(13, 74) + tlsApp(14, 310), 0.003], ['s', tlsApp(17, 1240), 0.041], ['c', tlsApp(19, 24), 0.12]]);
    c.at(0.4).dns(me, H.router.ip, 'status.lab.example', 1, ['198.51.100.20'], 0x77b0, 61025, 0.019);
    c.at(0.001).tcp(me, api, { cport: 51520, sport: 80, isn1: 0x01020304, isn2: 0x7f001234, rtt: 0.034, close: true },
      [['c', crlf(['GET /api/health HTTP/1.1', 'Host: status.lab.example', 'User-Agent: curl/8.7.1', 'Accept: */*']), 0.001],
       ['s', crlf(['HTTP/1.1 200 OK', 'Content-Type: application/json', 'Content-Length: 31'], '{"status":"ok","uptime":86400}\n'), 0.035]]);
    c.at(0.3).push({ src: me, dst: H.router, ip: { ttl: 64, id: 0x5f2a }, icmp: { type: 8, id: 0x0041, seq: 1 } });
    c.at(0.0018).push({ src: H.router, dst: me, ip: { ttl: 64, id: 0x88aa }, icmp: { type: 0, id: 0x0041, seq: 1 } });
    return c.p;
  }
  function scenarioLogin() {
    var c = new Cap(), me = H.mac, srv = { mac: H.router.mac, ip: '198.51.100.30' }, body = 'user=learner&pass=hunter2-lab&next=%2Fadmin';
    c.dns(me, H.router.ip, 'intranet.lab.example', 1, ['198.51.100.30'], 0x51e2, 53001, 0.017);
    c.at(0.001).tcp(me, srv, { cport: 52001, sport: 80, isn1: 0x10203040, isn2: 0x0badf00d, rtt: 0.022 },
      [['c', crlf(['GET /login HTTP/1.1', 'Host: intranet.lab.example', 'User-Agent: Mozilla/5.0 (Macintosh)', 'Accept: text/html']), 0.001],
       ['s', crlf(['HTTP/1.1 200 OK', 'Content-Type: text/html', 'Content-Length: 120'], '<form method="post" action="/login"><input name="user"><input name="pass" type="password"><button>Sign in</button></form>'), 0.03],
       ['c', crlf(['POST /login HTTP/1.1', 'Host: intranet.lab.example', 'User-Agent: Mozilla/5.0 (Macintosh)', 'Content-Type: application/x-www-form-urlencoded', 'Content-Length: ' + body.length], body), 2.8],
       ['s', crlf(['HTTP/1.1 302 Found', 'Location: /admin', 'Set-Cookie: session=7f3a9c0e5d2b41a8; HttpOnly', 'Content-Length: 0']), 0.04],
       ['c', crlf(['GET /admin HTTP/1.1', 'Host: intranet.lab.example', 'Cookie: session=7f3a9c0e5d2b41a8', 'User-Agent: Mozilla/5.0 (Macintosh)']), 0.02],
       ['s', crlf(['HTTP/1.1 200 OK', 'Content-Type: text/html', 'Content-Length: 37'], '<h1>Admin</h1><p>Welcome, learner</p>'), 0.03]]);
    c.at(1.2).tcp(me, { mac: H.nas.mac, ip: H.nas.ip }, { cport: 52010, sport: 8080, isn1: 0x44440000, isn2: 0x12340000, rtt: 0.002, close: true, ttl: 64 },
      [['c', crlf(['GET /api/backups HTTP/1.1', 'Host: 192.168.1.60:8080', 'Authorization: Basic YWRtaW46TkFTLWJhY2t1cC0yMDI2', 'User-Agent: python-urllib/3.15']), 0.0005],
       ['s', crlf(['HTTP/1.1 200 OK', 'Content-Type: application/json', 'Content-Length: 27'], '[{"name":"nightly","ok":1}]'), 0.004]]);
    return c.p;
  }
  function scenarioScan() {
    var c = new Cap(), ev = H.evil, nas = H.nas, open = { 22: 1, 80: 1, 445: 1 }, ports = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 3306, 3389, 5432, 5900, 8080];
    c.push({ src: ev, dst: { mac: 'ff:ff:ff:ff:ff:ff', ip: '' }, arp: { op: 1, sha: ev.mac, spa: ev.ip, tha: '00:00:00:00:00:00', tpa: nas.ip } });
    c.at(0.0009).push({ src: nas, dst: ev, arp: { op: 2, sha: nas.mac, spa: nas.ip, tha: ev.mac, tpa: ev.ip } });
    var r = rnd(99), syn = {};
    ports.forEach(function (p, i) {
      c.at(0.0004 + (i % 3) * 0.0001);
      var seq = syn[p] = r() >>> 0;
      c.push({ src: ev, dst: nas, ip: { ttl: 41, id: r() & 0xffff }, tcp: { sp: 40123, dp: p, seq: seq, ack: 0, rseq: 0, rack: 0, fl: 'S', win: 1024, stream: i } });
    });
    ports.forEach(function (p, i) {
      c.at(0.0003);
      var seq0 = (0x2a000000 + i * 7777) >>> 0, a1 = (syn[p] + 1) >>> 0;
      if (open[p]) {
        c.push({ src: nas, dst: ev, ip: { ttl: 64, id: 0 }, tcp: { sp: p, dp: 40123, seq: seq0, ack: a1, rseq: 0, rack: 1, fl: 'SA', win: 64240, stream: i } });
        c.at(0.0001).push({ src: ev, dst: nas, ip: { ttl: 41, id: 0 }, tcp: { sp: 40123, dp: p, seq: a1, ack: 0, rseq: 1, rack: 0, fl: 'R', win: 0, stream: i } });
      } else c.push({ src: nas, dst: ev, ip: { ttl: 64, id: 0 }, tcp: { sp: p, dp: 40123, seq: 0, ack: a1, rseq: 1, rack: 1, fl: 'RA', win: 0, stream: i } });
    });
    return c.p;
  }
  function scenarioArp() {
    var c = new Cap(), me = H.mac, ev = H.evil, rt = H.router, web = '203.0.113.10';
    c.push({ src: me, dst: { mac: 'ff:ff:ff:ff:ff:ff' }, arp: { op: 1, sha: me.mac, spa: me.ip, tha: '00:00:00:00:00:00', tpa: rt.ip } });
    c.at(0.0019).push({ src: rt, dst: me, arp: { op: 2, sha: rt.mac, spa: rt.ip, tha: me.mac, tpa: me.ip } });
    c.at(0.2).tcp(me, { mac: rt.mac, ip: web }, { cport: 51600, sport: 443, isn1: 0x11111111, isn2: 0x22222222, rtt: 0.03 }, [['c', tlsApp(31, 80), 0.002], ['s', tlsApp(32, 420), 0.03]]);
    for (var i = 0; i < 5; i++) {
      c.at(i ? 2 : 1.5).push({ src: ev, dst: me, arp: { op: 2, sha: ev.mac, spa: rt.ip, tha: me.mac, tpa: me.ip } });
      c.at(0.0001).push({ src: ev, dst: rt, arp: { op: 2, sha: ev.mac, spa: me.ip, tha: rt.mac, tpa: rt.ip } });
    }
    c.at(0.4).tcp(me, { mac: ev.mac, ip: web }, { cport: 51602, sport: 443, isn1: 0x33333333, isn2: 0x44444444, rtt: 0.034, srvMac: ev.mac }, [['c', tlsApp(41, 80), 0.002], ['s', tlsApp(42, 420), 0.034]]);
    return c.p;
  }
  function b32(s) { var A = 'abcdefghijklmnopqrstuvwxyz234567', bits = '', o = ''; for (var i = 0; i < s.length; i++) bits += ('0000000' + s.charCodeAt(i).toString(2)).slice(-8); for (var j = 0; j < bits.length; j += 5) o += A[parseInt((bits.substr(j, 5) + '0000').slice(0, 5), 2)]; return o; }
  var EXFIL = 'db_password=Corr3ct-H0rse;host=10.20.8.5';
  function scenarioExfil() {
    var c = new Cap(), me = H.mac, enc = b32(EXFIL), chunks = [];
    for (var i = 0; i < enc.length; i += 20) chunks.push(enc.slice(i, i + 20));
    c.dns(me, H.router.ip, 'www.lab.example', 1, ['203.0.113.10'], 0x1001, 50001, 0.015);
    chunks.forEach(function (ch, k) { c.at(5 + k * 0.03).dns(me, '203.0.113.53', k + '-' + ch + '.t.cdn-sync.net', 16, ['ok'], 0x2a00 + k, 50100 + k, 0.041); });
    c.at(1).dns(me, H.router.ip, 'time.apple.com', 1, ['17.253.4.125'], 0x1002, 50002, 0.012);
    return c.p;
  }
  var SCEN = {
    browse: { title: 'Everyday browsing', make: scenarioBrowse, story: 'Your Mac resolves two names, opens an HTTPS connection, fetches a JSON health check over plain HTTP and pings the router.' },
    login: { title: 'Cleartext login', make: scenarioLogin, story: 'Someone signs in to an intranet page over plain HTTP, then a backup script talks to the NAS with Basic authentication.' },
    scan: { title: 'Port scan', make: scenarioScan, story: 'A device on your LAN sends SYN packets to 18 ports on the NAS in a fraction of a second.' },
    arp: { title: 'ARP spoofing', make: scenarioArp, story: 'Normal traffic, then a burst of unrequested ARP replies, then the Mac sends its traffic somewhere new.' },
    exfil: { title: 'DNS exfiltration', make: scenarioExfil, story: 'Ordinary lookups, then a run of TXT queries with long, random-looking names to one unusual domain.' }
  };
  var cache = {};
  function build(id) {
    if (cache[id]) return cache[id];
    var specs = SCEN[id].make(), pk = specs.map(function (sp, i) {
      var e = encode(sp);
      e.n = i + 1; e.t = sp.t; e.spec = sp;
      e.fields['frame.number'] = [{ v: i + 1, t: 'num' }];
      e.fields['frame.time_relative'] = [{ v: sp.t, t: 'num' }];
      return e;
    });
    var t0 = pk[0].t; pk.forEach(function (p) { p.t = +(p.t - t0).toFixed(6); p.fields['frame.time_relative'][0].v = p.t; });
    cache[id] = pk;
    return pk;
  }
  function pcap(id) {
    var pk = build(id), out = [], base = Date.UTC(2026, 10, 17, 14, 0, 0) / 1000;
    function u32le(v) { out.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }
    function u16le(v) { out.push(v & 255, (v >>> 8) & 255); }
    u32le(0xa1b2c3d4); u16le(2); u16le(4); u32le(0); u32le(0); u32le(65535); u32le(1);
    pk.forEach(function (p) { var ts = base + p.t, s = Math.floor(ts), us = Math.round((ts - s) * 1e6); if (us >= 1e6) { s++; us -= 1e6; } u32le(s); u32le(us); u32le(p.bytes.length); u32le(p.bytes.length); for (var i = 0; i < p.bytes.length; i++) out.push(p.bytes[i]); });
    return new Uint8Array(out);
  }

  /* ---------- display filter engine ---------- */
  var KNOWN = ('frame frame.number frame.len frame.time_relative frame.protocols eth eth.src eth.dst eth.addr eth.type arp arp.opcode arp.src.hw_mac arp.src.proto_ipv4 arp.dst.hw_mac arp.dst.proto_ipv4 ' +
    'ip ip.src ip.dst ip.addr ip.ttl ip.proto ip.len ip.id tcp tcp.srcport tcp.dstport tcp.port tcp.stream tcp.len tcp.seq tcp.seq_raw tcp.ack tcp.flags tcp.flags.syn tcp.flags.ack tcp.flags.fin tcp.flags.reset tcp.flags.push tcp.window_size_value tcp.payload ' +
    'udp udp.srcport udp.dstport udp.port udp.length udp.stream icmp icmp.type icmp.code icmp.ident icmp.seq dns dns.id dns.flags.response dns.flags.rcode dns.qry.name dns.qry.name.len dns.qry.type dns.a dns.txt dns.count.answers ' +
    'http http.request http.response http.authbasic http.request.method http.request.uri http.host http.user_agent http.authorization http.cookie http.set_cookie http.content_type http.location http.content_length http.response.code http.response.phrase http.file_data ' +
    'tls tls.record.content_type tls.handshake.type tls.handshake.extensions_server_name tls.handshake.extensions_alpn_str data').split(' ');
  var KSET = {}; KNOWN.forEach(function (k) { KSET[k] = 1; });
  var STRF = { 'frame.protocols': 1, 'dns.qry.name': 1, 'dns.txt': 1, 'http.request.method': 1, 'http.request.uri': 1, 'http.host': 1, 'http.user_agent': 1, 'http.authorization': 1, 'http.authbasic': 1, 'http.cookie': 1, 'http.set_cookie': 1, 'http.content_type': 1, 'http.location': 1, 'http.response.phrase': 1, 'http.file_data': 1, 'tls.handshake.extensions_server_name': 1, 'tls.handshake.extensions_alpn_str': 1, 'tcp.payload': 1 };
  var PROTO = { frame: 1, eth: 1, arp: 1, ip: 1, tcp: 1, udp: 1, icmp: 1, dns: 1, http: 1, tls: 1, data: 1 };
  function lex(s) {
    var t = [], i = 0, m;
    while (i < s.length) {
      var r = s.slice(i);
      if ((m = /^\s+/.exec(r))) { i += m[0].length; continue; }
      if ((m = /^"((?:[^"\\]|\\.)*)"/.exec(r))) { t.push({ k: 'str', v: m[1].replace(/\\(.)/g, '$1') }); i += m[0].length; continue; }
      if ((m = /^(==|!=|~=|>=|<=|&&|\|\||[()!<>{},~])/.exec(r))) { t.push({ k: 'op', v: m[1] }); i += m[0].length; continue; }
      if ((m = /^\.\./.exec(r))) { t.push({ k: 'op', v: '..' }); i += 2; continue; }
      if ((m = /^([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})/.exec(r))) { t.push({ k: 'mac', v: m[1].toLowerCase() }); i += m[0].length; continue; }
      if ((m = /^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?/.exec(r))) { t.push({ k: 'ip', v: m[1], bits: m[2] === undefined ? 32 : +m[2] }); i += m[0].length; continue; }
      if ((m = /^\d+(?:\.\d+){2,}(?:\/\d+)?/.exec(r))) throw new Error('"' + m[0] + '" is not a valid IPv4 address.');
      if ((m = /^(0x[0-9a-fA-F]+|\d+(?:\.\d+)?)/.exec(r))) { t.push({ k: 'num', v: Number(m[1]) }); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_][\w.-]*/.exec(r))) {
        var w = m[0], lw = w.toLowerCase(), wo = { and: '&&', or: '||', not: '!', eq: '==', ne: '!=', gt: '>', lt: '<', ge: '>=', le: '<=', contains: 'contains', matches: 'matches', in: 'in', any_ne: '~=', all_ne: '!=' }[lw];
        t.push(wo ? { k: 'op', v: wo } : { k: 'id', v: w }); i += w.length; continue;
      }
      throw new Error('Unexpected "' + r.charAt(0) + '" at position ' + (i + 1) + '.');
    }
    return t;
  }
  function parse(s) {
    var t = lex(s), i = 0;
    if (!t.length) return null;
    function peek(v) { return t[i] && t[i].k === 'op' && t[i].v === v; }
    function or() { var l = and(); while (peek('||')) { i++; l = { op: 'or', a: l, b: and() }; } return l; }
    function and() { var l = not(); while (peek('&&')) { i++; l = { op: 'and', a: l, b: not() }; } return l; }
    function not() { if (peek('!')) { i++; return { op: 'not', a: not() }; } return cmp(); }
    function val() {
      var x = t[i++];
      if (!x) throw new Error('The filter ends where a value was expected.');
      if (x.k === 'op') throw new Error('"' + x.v + '" was unexpected here.');
      return x;
    }
    function cmp() {
      if (peek('(')) { i++; var e = or(); if (!peek(')')) throw new Error('Missing ")".'); i++; return e; }
      var f = t[i++];
      if (!f) throw new Error('The filter is incomplete.');
      if (f.k !== 'id') throw new Error('"' + (f.v) + '" is not a field or protocol name.');
      if (!KSET[f.v]) throw new Error('"' + f.v + '" is neither a field nor a protocol name (in this lab).');
      var o = t[i];
      if (o && o.k === 'op' && /^(==|!=|~=|>|<|>=|<=|contains|matches)$/.test(o.v)) { i++; return { op: 'cmp', f: f.v, cmp: o.v, v: val() }; }
      if (o && o.k === 'op' && o.v === 'in') {
        i++; if (!peek('{')) throw new Error('"in" needs a set such as {80, 443}.'); i++;
        var set = [];
        while (!peek('}')) { if (i >= t.length) throw new Error('Missing "}".'); if (peek(',')) { i++; continue; } var a = val(); if (peek('..')) { i++; set.push({ lo: a, hi: val() }); } else set.push({ eq: a }); }
        i++; return { op: 'in', f: f.v, set: set };
      }
      return { op: 'has', f: f.v };
    }
    var ast = or();
    if (i < t.length) throw new Error('"' + (t[i].v) + '" was unexpected here.');
    return ast;
  }
  function lit(x, field) {
    if (STRF[field] || PROTO[field]) { if (x.k === 'str' || x.k === 'id') return { t: 'str', v: String(x.v) }; return { t: 'str', v: String(x.v) }; }
    if (x.k === 'ip') return { t: 'ip', v: ip2n(x.v), bits: x.bits };
    if (x.k === 'mac') return { t: 'mac', v: x.v };
    if (x.k === 'num') return { t: 'num', v: x.v };
    if (x.k === 'id' && /^(true|false)$/i.test(x.v)) return { t: 'num', v: /true/i.test(x.v) ? 1 : 0 };
    if (x.k === 'str') return { t: 'str', v: x.v };
    throw new Error('"' + x.v + '" is not a valid value for ' + field + '.');
  }
  function eq(fv, L) {
    if (L.t === 'ip' && fv.t === 'ip') { var mask = L.bits === 0 ? 0 : (~0 << (32 - L.bits)) >>> 0; return ((fv.v & mask) >>> 0) === ((L.v & mask) >>> 0); }
    if (L.t === 'str' || fv.t === 'str') return String(fv.v) === String(L.v);
    return fv.v === L.v;
  }
  function evalNode(n, F) {
    switch (n.op) {
      case 'or': return evalNode(n.a, F) || evalNode(n.b, F);
      case 'and': return evalNode(n.a, F) && evalNode(n.b, F);
      case 'not': return !evalNode(n.a, F);
      case 'has': return !!F[n.f];
      case 'in': {
        var vs = F[n.f]; if (!vs) return false;
        return vs.some(function (fv) { return n.set.some(function (s) { if (s.eq) return eq(fv, lit(s.eq, n.f)); var lo = lit(s.lo, n.f), hi = lit(s.hi, n.f); return fv.v >= lo.v && fv.v <= hi.v; }); });
      }
      case 'cmp': {
        var v = F[n.f], L = lit(n.v, n.f);
        if (!v) return false;                                   // absent field: every comparison is false, even !=
        if (n.cmp === '!=') return !v.some(function (fv) { return eq(fv, L); });
        return v.some(function (fv) {
          switch (n.cmp) {
            case '==': return eq(fv, L);
            case '~=': return !eq(fv, L);
            case '>': return fv.v > L.v; case '<': return fv.v < L.v; case '>=': return fv.v >= L.v; case '<=': return fv.v <= L.v;
            case 'contains': if (fv.t !== 'str') throw new Error('"contains" cannot be used on ' + n.f + ', which is not a text or byte field.'); return String(fv.v).indexOf(String(L.v)) >= 0;
            case 'matches': if (fv.t !== 'str') throw new Error('"matches" cannot be used on ' + n.f + '.'); return new RegExp(String(L.v), 'i').test(String(fv.v));
          }
          return false;
        });
      }
    }
    return false;
  }
  function compile(s) { var ast = parse(s.trim()); if (!ast) return function () { return true; }; return function (p) { return evalNode(ast, p.fields); }; }
  function run(id, filter) { var f = compile(filter); return build(id).filter(function (p) { return f(p); }).map(function (p) { return p.n; }); }

  root.__pcap = { SCEN: SCEN, build: build, pcap: pcap, compile: compile, run: run, b32: b32, EXFIL: EXFIL, H: H, flagNames: flagNames };
})(typeof window !== 'undefined' ? window : globalThis);
