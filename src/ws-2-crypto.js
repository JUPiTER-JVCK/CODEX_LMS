/* Servers, APIs & Cloud widgets, part 2: cipher lab (Caesar, avalanche, AES-GCM), Diffie-Hellman by hand, TLS 1.3 handshake. */
(function () {
  'use strict';
  var K = window.__core, $ = K.$, $$ = K.$$, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};
  function wg(title, sub, dom) { var r = h('div', { class: 'wg sv' }); r.style.setProperty('--dom', 'var(--c-' + (dom || 'srv') + ')'); r.innerHTML = '<h4>' + esc(title) + '</h4>' + (sub ? '<p class="sub">' + sub + '</p>' : ''); return r; }
  function addBody(r, html) { var d = h('div', { html: html }); r.appendChild(d); return d; }
  var subtle = window.crypto && window.crypto.subtle;
  var enc = new TextEncoder(), dec = new TextDecoder();
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function b64(u8) { var s = ''; u8 = new Uint8Array(u8); for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function unb64(s) { var t = atob(s.trim()), u = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; }

  /* ---------------- cipher lab ---------------- */
  var ENGLISH = [8.2, 1.5, 2.8, 4.3, 12.7, 2.2, 2.0, 6.1, 7.0, 0.15, 0.77, 4.0, 2.4, 6.7, 7.5, 1.9, 0.095, 6.0, 6.3, 9.1, 2.8, 0.98, 2.4, 0.15, 2.0, 0.074];
  function caesar(t, k) { return t.replace(/[a-z]/gi, function (c) { var a = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - a + k + 26) % 26 + a); }); }
  function freq(t) { var f = new Array(26).fill(0), n = 0; t.toLowerCase().replace(/[a-z]/g, function (c) { f[c.charCodeAt(0) - 97]++; n++; return c; }); return { f: f, n: n }; }
  function chi(t) { var q = freq(t), s = 0; if (!q.n) return Infinity; for (var i = 0; i < 26; i++) { var e = ENGLISH[i] / 100 * q.n; s += (q.f[i] - e) * (q.f[i] - e) / e; } return s; }
  W.cipherlab = function (args) {
    var r = wg('Cipher lab', 'Three experiments, from broken to modern. <b>Caesar</b>: break a classical cipher with letter counts. <b>Avalanche</b>: change one bit and watch a hash change completely. <b>AES-GCM</b>: real authenticated encryption from your browser\'s Web Crypto API.');
    var b = addBody(r, '<div class="ac-tabs cl-tabs" role="tablist"><button role="tab" data-t="caesar">Caesar</button><button role="tab" data-t="aval">Avalanche</button><button role="tab" data-t="aes">AES-GCM</button></div><div id="pane"></div>');
    var tab = (args && args.tab) || 'caesar', pane = $('#pane', b);
    var PLAIN = 'Never send passwords across a network in plain text, because anyone who can see the path can read every byte of an unencrypted session.';
    var st = { ct: caesar(PLAIN, 7), k: 0, a: 'hello', bb: 'iello', pw: 'correct horse battery staple', msg: 'Meet at the NAS at 21:00', blob: '' };
    function caesarPane() {
      pane.innerHTML = '<label class="cl-l">Ciphertext (edit or paste your own)<textarea id="ct" rows="3" spellcheck="false" data-fixed>' + esc(st.ct) + '</textarea></label>' +
        '<div class="cl-row"><label>Try shift <input type="range" id="k" min="0" max="25" value="' + st.k + '"> <b id="kv" class="mono">' + st.k + '</b></label><button class="btn" id="crack">Crack it with letter counts</button></div>' +
        '<div class="cl-plain mono" id="pt"></div><div class="cl-freq" id="fq" aria-label="Letter frequencies"></div><p class="cl-note" id="why"></p>';
      draw();
      function draw() {
        var p = caesar(st.ct, -st.k), q = freq(p), mx = 13;
        $('#pt', pane).textContent = p; $('#kv', pane).textContent = st.k;
        var o = '';
        for (var i = 0; i < 26; i++) { var v = q.n ? q.f[i] / q.n * 100 : 0; o += '<div class="cl-bar"><i style="height:' + Math.min(100, v / mx * 100) + '%"></i><s style="bottom:' + Math.min(100, ENGLISH[i] / mx * 100) + '%"></s><span>' + String.fromCharCode(97 + i) + '</span></div>'; }
        $('#fq', pane).innerHTML = o;
        $('#why', pane).innerHTML = 'Bars: letters in the text above with shift ' + st.k + '. Ticks: how often each letter appears in typical English. When the bars sit on the ticks, the shift is right. Score (lower is more English-like): <b class="mono">' + chi(p).toFixed(0) + '</b>. There are only 26 keys, so a computer can also just try them all.';
      }
      pane.oninput = function (e) { if (e.target.id === 'k') { st.k = +e.target.value; draw(); } if (e.target.id === 'ct') { st.ct = e.target.value; draw(); } };
      pane.onclick = function (e) { if (e.target.id === 'crack') { var best = 0, bs = Infinity; for (var k = 0; k < 26; k++) { var s = chi(caesar(st.ct, -k)); if (s < bs) { bs = s; best = k; } } st.k = best; $('#k', pane).value = best; draw(); } };
    }
    function avalPane() {
      pane.innerHTML = '<div class="cl-two"><label class="cl-l">Input A<input type="text" id="a" value="' + esc(st.a) + '" spellcheck="false" autocomplete="off"></label><label class="cl-l">Input B <button class="chip" id="flip">B = A with its lowest bit flipped</button><input type="text" id="bb" value="' + esc(st.bb) + '" spellcheck="false" autocomplete="off"></label></div><div id="hs"></div>';
      pane.oninput = function (e) { if (e.target.id === 'a') st.a = e.target.value; if (e.target.id === 'bb') st.bb = e.target.value; go(); };
      pane.onclick = function (e) { if (e.target.id === 'flip') { var u = enc.encode(st.a); if (!u.length) return; u[0] ^= 1; st.bb = dec.decode(u); $('#bb', pane).value = st.bb; go(); } };
      function go() {
        if (!subtle) { $('#hs', pane).innerHTML = '<p>This browser blocks the Web Crypto API here (it needs https or localhost).</p>'; return; }
        var ua = enc.encode(st.a), ub = enc.encode(st.bb);
        var inBits = 0; for (var i = 0; i < Math.max(ua.length, ub.length); i++) { var x = (ua[i] || 0) ^ (ub[i] || 0); while (x) { inBits += x & 1; x >>= 1; } }
        Promise.all([subtle.digest('SHA-256', ua), subtle.digest('SHA-256', ub)]).then(function (d) {
          var A = new Uint8Array(d[0]), B = new Uint8Array(d[1]), ha = hex(A), hb = hex(B), bits = 0;
          for (var i = 0; i < 32; i++) { var x = A[i] ^ B[i]; while (x) { bits += x & 1; x >>= 1; } }
          var mark = function (s, o) { var out = ''; for (var i = 0; i < s.length; i++) out += s[i] === o[i] ? s[i] : '<b>' + s[i] + '</b>'; return out; };
          $('#hs', pane).innerHTML = '<div class="cl-hash"><span>SHA-256(A)</span><code>' + mark(ha, hb) + '</code></div><div class="cl-hash"><span>SHA-256(B)</span><code>' + mark(hb, ha) + '</code></div>' +
            '<div class="cl-meter"><div style="width:' + (bits / 256 * 100) + '%"></div></div><p class="cl-note">The inputs differ in <b>' + inBits + '</b> bit' + (inBits === 1 ? '' : 's') + '. The hashes differ in <b>' + bits + ' of 256</b> bits (' + Math.round(bits / 2.56) + '%). For a good hash, any change flips about half the output bits, so a hash tells you nothing about how close two inputs were.' + (st.a === st.bb ? ' Right now A and B are identical, so the hashes are too: hashing is deterministic.' : '') + '</p>';
        });
      }
      go();
    }
    function aesPane() {
      pane.innerHTML = '<div class="cl-two"><label class="cl-l">Password<input type="text" id="pw" value="' + esc(st.pw) + '" spellcheck="false" autocomplete="off"></label><label class="cl-l">Message<input type="text" id="msg" value="' + esc(st.msg) + '" spellcheck="false" autocomplete="off"></label></div>' +
        '<div class="cl-row"><button class="btn" id="enc">Encrypt</button><button class="btn sec" id="dec">Decrypt</button><button class="btn sec" id="tam">Tamper: flip one bit</button></div>' +
        '<label class="cl-l">The packet you would store or send: <code>salt.nonce.ciphertext+tag</code> in base64<textarea id="blob" rows="3" spellcheck="false" data-fixed>' + esc(st.blob) + '</textarea></label><div id="ao" aria-live="polite"></div>';
      var ao = $('#ao', pane);
      function key(pw, salt) { return subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) { return subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }); }
      pane.oninput = function (e) { if (e.target.id === 'pw') st.pw = e.target.value; if (e.target.id === 'msg') st.msg = e.target.value; if (e.target.id === 'blob') st.blob = e.target.value; };
      pane.onclick = function (e) {
        if (!subtle) { ao.innerHTML = '<p>This browser blocks the Web Crypto API here (it needs https or localhost).</p>'; return; }
        var id = e.target.id;
        if (id === 'enc') {
          var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), t0 = performance.now();
          key(st.pw, salt).then(function (k) { return subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(st.msg)); }).then(function (ct) {
            ct = new Uint8Array(ct); st.blob = b64(salt) + '.' + b64(iv) + '.' + b64(ct); $('#blob', pane).value = st.blob;
            var n = enc.encode(st.msg).length;
            ao.innerHTML = '<div class="cl-parts"><span><i>salt</i>16 bytes, random</span><span><i>nonce</i>12 bytes, random</span><span><i>ciphertext</i>' + n + ' bytes, same length as the message</span><span><i>tag</i>16 bytes, proves nothing changed</span></div><p class="cl-note">Key derivation (PBKDF2, 100,000 rounds) plus encryption took ' + Math.round(performance.now() - t0) + ' ms. Press Encrypt again: the salt and nonce are new, so the packet is completely different even though the message and password are the same.</p>';
          });
        }
        if (id === 'tam') {
          var parts = st.blob.split('.'); if (parts.length !== 3) { ao.innerHTML = '<p class="cl-bad">Encrypt something first.</p>'; return; }
          var c = unb64(parts[2]); c[0] ^= 1; parts[2] = b64(c); st.blob = parts.join('.'); $('#blob', pane).value = st.blob;
          ao.innerHTML = '<p class="cl-note">One bit of the ciphertext is now flipped. Press Decrypt.</p>';
        }
        if (id === 'dec') {
          var p = st.blob.split('.'); if (p.length !== 3) { ao.innerHTML = '<p class="cl-bad">The packet needs three base64 parts separated by dots. Encrypt something first.</p>'; return; }
          var s2, i2, c2; try { s2 = unb64(p[0]); i2 = unb64(p[1]); c2 = unb64(p[2]); } catch (x) { ao.innerHTML = '<p class="cl-bad">That is not valid base64.</p>'; return; }
          key(st.pw, s2).then(function (k) { return subtle.decrypt({ name: 'AES-GCM', iv: i2 }, k, c2); }).then(function (pt) {
            ao.innerHTML = '<p class="cl-ok">✓ Tag verified. Plaintext: <code>' + esc(dec.decode(pt)) + '</code></p>';
          }, function (err) {
            ao.innerHTML = '<p class="cl-bad">✗ ' + esc(err.name) + ': decryption refused. The tag did not verify, so either the password is wrong or the packet was changed. GCM gives you no partial plaintext: all or nothing.</p>';
          });
        }
      };
    }
    function show() {
      $$('.cl-tabs button', b).forEach(function (x) { var on = x.getAttribute('data-t') === tab; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
      pane.oninput = pane.onclick = null;
      (tab === 'caesar' ? caesarPane : tab === 'aval' ? avalPane : aesPane)();
    }
    $('.cl-tabs', b).addEventListener('click', function (e) { var t = e.target.closest('[data-t]'); if (t) { tab = t.getAttribute('data-t'); show(); } });
    show();
    return r;
  };

  /* ---------------- Diffie-Hellman ---------------- */
  function modpow(base, exp, mod) { var r = 1n; base %= mod; while (exp > 0n) { if (exp & 1n) r = r * base % mod; base = base * base % mod; exp >>= 1n; } return r; }
  W.dhmix = function () {
    var r = wg('Diffie-Hellman: agree on a secret in public', 'Alice and Bob agree on a public prime <i>p</i> and base <i>g</i>, keep one number each secret, and swap only the results. Both end with the same shared secret. Eve sees everything sent and still has to undo a modular exponent. Change the numbers, then let Eve try.');
    var PR = [['23', '5'], ['2147483647', '7'], ['1000000007', '5']];
    var b = addBody(r,
      '<div class="dh-ctl"><label>Public prime <i>p</i><select id="p">' + PR.map(function (x, i) { return '<option value="' + i + '">' + x[0] + (i === 0 ? ' (textbook)' : i === 1 ? ' (2³¹ − 1)' : '') + '</option>'; }).join('') + '</select></label><label>Public base <i>g</i> <b class="mono" id="g"></b></label>' +
      '<label>Alice\'s secret <i>a</i><input type="number" id="a" value="6" min="2"></label><label>Bob\'s secret <i>b</i><input type="number" id="bs" value="15" min="2"></label></div>' +
      '<div class="dh-grid"><div class="dh-col"><h5>Alice</h5><div class="dh-sw" id="sa"></div><p id="ta"></p></div><div class="dh-col dh-wire"><h5>On the wire (Eve sees this)</h5><div class="dh-sw" id="sw"></div><p id="tw"></p></div><div class="dh-col"><h5>Bob</h5><div class="dh-sw" id="sb"></div><p id="tb"></p></div></div>' +
      '<div class="dh-eve"><button class="btn sec" id="rnd">Pick random secrets</button><button class="btn sec" id="eve">Let Eve try every exponent</button><span id="ev" class="cl-note"></span></div>');
    var P, G, A, Bs, stop = false;
    function read() { var x = PR[+$('#p', b).value]; P = BigInt(x[0]); G = BigInt(x[1]); A = BigInt(Math.max(2, parseInt($('#a', b).value, 10) || 2)); Bs = BigInt(Math.max(2, parseInt($('#bs', b).value, 10) || 2)); }
    function sw(c, label) { return '<span class="dh-dot" style="background:' + c + '"></span><span>' + label + '</span>'; }
    function mix() { var cs = Array.prototype.slice.call(arguments); var s = [0, 0, 0]; cs.forEach(function (c) { s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; }); return 'rgb(' + s.map(function (v) { return Math.round(v / cs.length); }).join(',') + ')'; }
    function draw() {
      read(); stop = true; $('#ev', b).textContent = '';
      var pubA = modpow(G, A, P), pubB = modpow(G, Bs, P), kA = modpow(pubB, A, P), kB = modpow(pubA, Bs, P);
      var cg = [240, 200, 40], ca = [200, 30, 60], cb = [30, 90, 210];
      $('#g', b).textContent = String(G);
      $('#sa', b).innerHTML = sw(mix(cg, ca), 'sends A') + sw(mix(cg, ca, cb), 'shared');
      $('#sb', b).innerHTML = sw(mix(cg, cb), 'sends B') + sw(mix(cg, ca, cb), 'shared');
      $('#sw', b).innerHTML = sw(mix(cg), 'p, g') + sw(mix(cg, ca), 'A') + sw(mix(cg, cb), 'B');
      $('#ta', b).innerHTML = 'secret a = <b>' + A + '</b><br>A = g<sup>a</sup> mod p = <b>' + pubA + '</b><br>key = B<sup>a</sup> mod p = <b class="dh-k">' + kA + '</b>';
      $('#tb', b).innerHTML = 'secret b = <b>' + Bs + '</b><br>B = g<sup>b</sup> mod p = <b>' + pubB + '</b><br>key = A<sup>b</sup> mod p = <b class="dh-k">' + kB + '</b>';
      $('#tw', b).innerHTML = 'p = ' + P + ', g = ' + G + '<br>A = ' + pubA + '<br>B = ' + pubB + '<br><span class="cl-note">The key itself is never sent.</span>';
    }
    function eve() {
      read(); stop = false;
      var pubA = modpow(G, A, P), x = 1n, e = 0, t0 = performance.now(), limit = 3000000, ev = $('#ev', b);
      function chunk() {
        if (stop || !r.isConnected) return;
        var end = Math.min(e + 200000, limit);
        while (e < end) { e++; x = x * G % P; if (x === pubA) { ev.innerHTML = 'Found an exponent that works: <b>' + e + '</b>, after ' + e.toLocaleString() + ' tries in ' + Math.round(performance.now() - t0) + ' ms. With it Eve computes the shared key. ' + (P < 1000n ? 'Small primes are useless.' : 'The prime was big enough, but the secret was small: secrets must be large random numbers too.'); return; } }
        var rate = e / Math.max(1, performance.now() - t0) * 1000;
        if (e >= limit) { ev.innerHTML = 'Gave up after ' + e.toLocaleString() + ' tries (about ' + Math.round(rate).toLocaleString() + ' per second here). For this p that could take up to ' + (Number(P) / rate / 60).toFixed(1) + ' minutes. Real Diffie-Hellman groups use 2048-bit or larger primes, or elliptic curves such as X25519, where the same search would outlast the universe.'; return; }
        ev.textContent = 'Trying… ' + e.toLocaleString(); setTimeout(chunk, 0);
      }
      chunk();
    }
    function rnd() { var top = Number(P) - 3; return 2 + Math.floor(Math.random() * top); }
    b.addEventListener('input', function (e) { if (e.target.id !== 'p') draw(); });
    b.addEventListener('change', function (e) { if (e.target.id === 'p') { read(); if (P > 1000n) { $('#a', b).value = rnd(); $('#bs', b).value = rnd(); } else { $('#a', b).value = 6; $('#bs', b).value = 15; } } draw(); });
    b.addEventListener('click', function (e) { if (e.target.id === 'eve') eve(); if (e.target.id === 'rnd') { read(); $('#a', b).value = rnd(); $('#bs', b).value = rnd(); draw(); } });
    draw();
    return r;
  };

  /* ---------------- TLS 1.3 handshake ---------------- */
  W.tls13 = function () {
    var r = wg('TLS 1.3 handshake, message by message', 'Step through a full handshake to <code>https://lab.example</code> after the TCP connection is up. Locked messages are encrypted. The right-hand list grows with everything a network eavesdropper can still see.');
    var ST = [
      { m: null, eve: ['IP addresses and ports of both ends'], t: 'TCP is connected (see the TCP handshake widget). Nothing about TLS has happened yet.' },
      { m: ['→', 'ClientHello', 'versions, ciphers, key_share, SNI'], lock: 0, eve: ['SNI: lab.example (the name you asked for)', 'ALPN offer: h2, http/1.1', 'supported cipher suites'], t: 'The client lists what it supports: TLS 1.3, cipher suites such as <code>TLS_AES_128_GCM_SHA256</code>, and an ALPN list (<code>h2</code>, <code>http/1.1</code>). It also <b>guesses</b> a key-exchange group and sends its half of the key exchange right away in <code>key_share</code>: current browsers send a hybrid post-quantum share (<code>X25519MLKEM768</code>) plus plain <code>X25519</code>. The <code>server_name</code> extension (SNI) names the site in clear text.' },
      { m: ['←', 'ServerHello', 'chosen cipher, key_share'], lock: 0, eve: ['the cipher suite the server chose'], t: 'The server picks one cipher suite and one group, and sends its own key share. Now both sides run the key exchange and derive the same <b>handshake keys</b>. Everything after this message is encrypted.' },
      { m: ['←', 'EncryptedExtensions', 'ALPN = h2'], lock: 1, eve: [], t: 'Encrypted from here on. The server confirms the application protocol (HTTP/2) and other settings.' },
      { m: ['←', 'Certificate', 'chain: lab.example → CA'], lock: 1, eve: [], t: 'The server sends its certificate chain. In TLS 1.2 this went in clear text; in TLS 1.3 an eavesdropper cannot read which certificate was sent.' },
      { m: ['←', 'CertificateVerify', 'signature over the transcript'], lock: 1, eve: [], t: 'The server signs a hash of every message so far with the private key that matches the certificate. This proves it holds that key, and binds the key exchange to this identity, which defeats a man in the middle.' },
      { m: ['←', 'Finished', 'MAC of the transcript'], lock: 1, eve: [], t: 'A MAC over the whole handshake. If anything was altered on the way, the check fails and the connection dies.' },
      { m: ['→', 'Finished', 'client MAC'], lock: 1, eve: [], t: 'Before answering, the client checks the chain up to a root it trusts, that the name <code>lab.example</code> is in the certificate, and that it has not expired. Then it sends its own Finished. That is <b>one round trip</b> in total, where TLS 1.2 needed two.' },
      { m: ['→', 'Application data', 'GET / (HTTP/2)'], lock: 1, eve: ['sizes and timing of encrypted records'], t: 'Both sides switch to fresh <b>application keys</b>. The URL path, headers, cookies and body are all inside the encryption. Only sizes and timing leak.' },
      { m: ['←', 'NewSessionTicket', 'for a faster resume'], lock: 1, eve: [], t: 'After the handshake the server may send a ticket. Next time the client can resume with less work, and can even send data in its first flight (0-RTT), which an attacker could replay, so servers only accept it for safe requests.' }
    ];
    var i = 0;
    var b = addBody(r, '<div class="tls-g"><div><div class="tls-head"><strong>Client</strong><strong>Server</strong></div><div class="hs tls-hs" id="hs" aria-live="polite"></div></div><div class="tls-eve"><h5>Eavesdropper can see</h5><ul id="ev"></ul></div></div><div id="ht" class="tls-t"></div><div class="tls-btn"><button class="btn sec" id="p">◀ Back</button><button class="btn" id="n">Next ▶</button><button class="btn sec" id="x">Restart</button></div>');
    function draw() {
      var o = ''; for (var k = 1; k <= i; k++) { var m = ST[k].m; var right = m[0] === '→'; o += '<div class="hs-m ' + (right ? 'r' : 'l') + (k === i ? ' cur' : '') + (ST[k].lock ? ' lock' : '') + '"><span class="mono">' + (ST[k].lock ? '🔒 ' : '') + '<strong>' + esc(m[1]) + '</strong> ' + esc(m[2]) + '</span></div>'; }
      $('#hs', b).innerHTML = o;
      var seen = []; for (var j = 0; j <= i; j++) seen = seen.concat(ST[j].eve.map(function (x) { return [x, j === i]; }));
      $('#ev', b).innerHTML = seen.map(function (x) { return '<li' + (x[1] ? ' class="new"' : '') + '>' + esc(x[0]) + '</li>'; }).join('') + (i >= 4 ? '<li class="no">not the certificate (encrypted in TLS 1.3)</li>' : '') + (i >= 8 ? '<li class="no">not the URL path, headers or body</li>' : '');
      $('#ht', b).innerHTML = '<strong>Step ' + (i + 1) + ' of ' + ST.length + '.</strong> ' + ST[i].t;
      $('#p', b).disabled = i === 0; $('#n', b).disabled = i === ST.length - 1;
    }
    b.addEventListener('click', function (e) { var id = e.target.id; if (id === 'n' && i < ST.length - 1) i++; else if (id === 'p' && i > 0) i--; else if (id === 'x') i = 0; else return; draw(); });
    draw();
    return r;
  };
})();
