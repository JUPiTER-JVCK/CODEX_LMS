/* Servers, APIs & Cloud widgets, part 3: one request through a server stack (with breakable hops) and nginx location matching. */
(function () {
  'use strict';
  var K = window.__core, $ = K.$, $$ = K.$$, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};
  function wg(title, sub, dom) { var r = h('div', { class: 'wg sv' }); r.style.setProperty('--dom', 'var(--c-' + (dom || 'srv') + ')'); r.innerHTML = '<h4>' + esc(title) + '</h4>' + (sub ? '<p class="sub">' + sub + '</p>' : ''); return r; }
  function addBody(r, html) { var d = h('div', { html: html }); r.appendChild(d); return d; }

  /* ---------------- request journey ---------------- */
  var HOPS = [
    { id: 'dns', name: 'DNS', where: 'resolver', ok: '<code>app.lab.example</code> resolves to <code>203.0.113.10</code> (an A record). Cached answers skip this hop.', log: 'dig +short app.lab.example\n203.0.113.10',
      brk: 'the name has no record (typo, expired domain, record deleted)', see: 'curl: (6) Could not resolve host: app.lab.example', br: 'ERR_NAME_NOT_RESOLVED', fix: 'Check the record with <code>dig</code>. Nothing on the server is involved yet; the request never left your Mac.' },
    { id: 'fw', name: 'Firewall', where: 'cloud security group or ufw', ok: 'A SYN to TCP port 443 is allowed in. The TCP handshake completes.', log: 'ufw status\n443/tcp                    ALLOW       Anywhere',
      brk: 'the firewall silently drops packets to 443', see: 'curl waits, then gives up with exit code 28 (timeout)', br: 'ERR_CONNECTION_TIMED_OUT', fix: 'A <b>timeout</b> means packets vanish: a firewall, a security group, a wrong route or a machine that is off. Compare with the next hop, where something answers with a refusal.' },
    { id: 'nginx', name: 'nginx (port 443)', where: 'reverse proxy', ok: 'nginx accepts the connection, completes TLS with the certificate for <code>app.lab.example</code>, reads the HTTP request and picks a <code>location</code> block.', log: '203.0.113.50 - - [16/Nov/2026:10:02:11 +0000] "GET /api/devices HTTP/2.0" 200 412 "-" "curl/8.7.1"',
      brk: 'nginx is stopped, so nothing listens on 443', see: 'curl: (7) Failed to connect to app.lab.example port 443 after 31 ms: Couldn\'t connect to server', br: 'ERR_CONNECTION_REFUSED', fix: 'A <b>refusal</b> is fast and comes from the machine itself: the packet arrived, but no process listens on that port. Check with <code>sudo ss -ltnp</code> and <code>systemctl status nginx</code>.' },
    { id: 'tls', name: 'TLS certificate', where: 'in nginx', ok: 'The certificate chain is valid, names <code>app.lab.example</code> and has not expired.', log: 'openssl s_client -connect app.lab.example:443 -servername app.lab.example\nVerify return code: 0 (ok)',
      brk: 'the certificate expired last night', see: 'curl: (60) SSL certificate problem: certificate has expired', br: 'NET::ERR_CERT_DATE_INVALID', fix: 'Renew the certificate (for Let\'s Encrypt, <code>certbot renew</code>) and reload nginx. Never "fix" this with <code>curl -k</code> in a script.' },
    { id: 'app', name: 'App server (127.0.0.1:8000)', where: 'gunicorn, Node, etc.', ok: 'nginx forwards the request to the app over plain HTTP on the loopback interface. The app runs your code.', log: '[INFO] 127.0.0.1 "GET /api/devices HTTP/1.0" 200',
      brk: 'the app crashed, so nothing listens on 8000', see: 'HTTP/2 502 (Bad Gateway, an HTML page from nginx)', br: '502 Bad Gateway', fix: 'nginx is fine; its upstream is not. nginx\'s error log says <code>connect() failed (111: Connection refused) while connecting to upstream</code>. Check <code>systemctl status app</code> and <code>journalctl -u app</code>.' },
    { id: 'slow', name: 'App response time', where: 'your code', ok: 'The app answers in 40 ms.', log: '',
      brk: 'a query hangs for two minutes', see: 'HTTP/2 504 (Gateway Timeout) after nginx\'s proxy_read_timeout, 60 s by default', br: '504 Gateway Timeout', fix: 'nginx logs <code>upstream timed out (110: Connection timed out) while reading response header from upstream</code>. The app is alive but stuck: look for slow queries, locks, or calls to another service that never return.' },
    { id: 'db', name: 'Database', where: 'PostgreSQL on 5432', ok: 'The app queries the database and builds JSON from the rows.', log: 'LOG:  duration: 3.2 ms  statement: SELECT * FROM devices',
      brk: 'the database is down', see: 'HTTP/2 500 (or 503) with an error body from the app', br: '500 Internal Server Error', fix: 'The app caught the failure and answered with a 5xx. Its own log has the real error, such as a refused connection to port 5432. The status code alone does not tell you which dependency failed.' }
  ];
  W.reqjourney = function () {
    var r = wg('Follow one request through a server', 'A browser asks for <code>https://app.lab.example/api/devices</code>. Click a hop to read what it does, break it, then send the request and see what the client gets. Every symptom points at a different layer.');
    var broken = {}, sel = 0, stepT = 0;
    var b = addBody(r, '<div class="rj"><ol class="rj-hops" id="hops">' + HOPS.map(function (x, i) { return '<li data-i="' + i + '"><button class="rj-h" data-i="' + i + '"><span class="rj-n">' + (i + 1) + '</span><span><b>' + esc(x.name) + '</b><small>' + esc(x.where) + '</small></span></button><label class="rj-bk"><input type="checkbox" data-b="' + x.id + '"> break</label></li>'; }).join('') + '</ol><div class="rj-d" id="det"></div></div>' +
      '<div class="rj-go"><button class="btn" id="send">Send the request</button><button class="btn sec" id="fix">Fix everything</button></div><pre class="rj-out" id="out" aria-live="polite"></pre>');
    function det() {
      var x = HOPS[sel];
      $('#det', b).innerHTML = '<h5>' + (sel + 1) + '. ' + esc(x.name) + '</h5><p>' + x.ok + '</p>' + (x.log ? '<pre class="rj-log">' + esc(x.log) + '</pre>' : '') + '<p><b>Break it:</b> ' + esc(x.brk) + '.</p><p class="rj-sym"><b>Client sees:</b> <code>' + esc(x.see) + '</code><br><b>Browser shows:</b> <code>' + esc(x.br) + '</code></p><p>' + x.fix + '</p>';
      $$('.rj-hops li', b).forEach(function (li) { var i = +li.getAttribute('data-i'); li.classList.toggle('sel', i === sel); li.classList.toggle('bad', !!broken[HOPS[i].id]); });
    }
    function send() {
      clearTimeout(stepT);
      var out = $('#out', b), lis = $$('.rj-hops li', b), k = 0;
      lis.forEach(function (li) { li.classList.remove('pass', 'stop'); });
      out.innerHTML = '$ curl -sS -i https://app.lab.example/api/devices\n';
      (function step() {
        if (!r.isConnected) return;
        if (k >= HOPS.length) {
          out.innerHTML += '<span class="rj-ok">HTTP/2 200</span>\ncontent-type: application/json\n\n[{"id":1,"name":"router",...}]\n\n<span class="rj-c"># Every hop worked, and the response travelled back the same way.</span>';
          return;
        }
        var x = HOPS[k], li = lis[k];
        if (broken[x.id]) {
          li.classList.add('stop'); sel = k; det();
          out.innerHTML += '<span class="rj-bad">' + esc(x.see) + '</span>\n\n<span class="rj-c"># Stopped at hop ' + (k + 1) + ' (' + esc(x.name) + '). Hops after it never saw the request.</span>';
          return;
        }
        li.classList.add('pass'); k++; stepT = setTimeout(step, 260);
      })();
    }
    b.addEventListener('click', function (e) {
      var t = e.target.closest('[data-i]'); if (t && t.tagName === 'BUTTON') { sel = +t.getAttribute('data-i'); det(); return; }
      if (e.target.id === 'send') send();
      if (e.target.id === 'fix') { broken = {}; $$('[data-b]', b).forEach(function (c) { c.checked = false; }); det(); $('#out', b).textContent = ''; $$('.rj-hops li', b).forEach(function (li) { li.classList.remove('pass', 'stop'); }); }
    });
    b.addEventListener('change', function (e) { var id = e.target.getAttribute('data-b'); if (!id) return; broken[id] = e.target.checked; sel = HOPS.findIndex(function (x) { return x.id === id; }); det(); });
    det();
    return r;
  };

  /* ---------------- nginx location matching ---------------- */
  var DEFCONF = [
    'server {',
    '    listen 443 ssl;',
    '    server_name app.lab.example;',
    '',
    '    location = / {',
    '        return 302 /app/;',
    '    }',
    '    location /api/ {',
    '        proxy_pass http://127.0.0.1:8000;',
    '    }',
    '    location ^~ /static/ {',
    '        root /srv/www;',
    '    }',
    '    location ~* \\.(png|jpg|svg|css|js)$ {',
    '        root /srv/assets;',
    '        expires 30d;',
    '    }',
    '    location /admin {',
    '        allow 192.168.1.0/24;',
    '        deny all;',
    '        proxy_pass http://127.0.0.1:9000;',
    '    }',
    '    location / {',
    '        proxy_pass http://127.0.0.1:3000;',
    '    }',
    '}'].join('\n');
  var TESTS = ['/', '/app/', '/api/devices?type=server', '/api', '/static/app.css', '/images/logo.PNG', '/static/logo.png', '/admin/users', '/administrator', '/ADMIN'];
  function parseConf(text) {
    var locs = [], re = /location\s+(=|\^~|~\*|~)?\s*([^\s{]+)\s*\{/g, m;
    while ((m = re.exec(text))) {
      var depth = 1, i = re.lastIndex, st = i;
      while (i < text.length && depth) { if (text[i] === '{') depth++; else if (text[i] === '}') depth--; i++; }
      var body = text.slice(st, i - 1).trim().split('\n').map(function (l) { return l.trim(); }).filter(Boolean).join('\n');
      var line = text.slice(0, m.index).split('\n').length, loc = { mod: m[1] || '', pat: m[2], body: body, line: line, label: 'location ' + (m[1] ? m[1] + ' ' : '') + m[2] };
      if (loc.mod === '~' || loc.mod === '~*') { try { loc.re = new RegExp(m[2], loc.mod === '~*' ? 'i' : ''); } catch (e) { loc.err = e.message; } }
      locs.push(loc);
    }
    return locs;
  }
  var PASS = /\b(proxy_pass|fastcgi_pass|uwsgi_pass|scgi_pass|memcached_pass|grpc_pass)\b/;
  function matchLoc(locs, raw) {
    var uri = raw.split('?')[0].split('#')[0] || '/', trace = [];
    try { uri = decodeURIComponent(uri); } catch (e) { }
    trace.push('Match against the path only: <code>' + esc(uri) + '</code> (the query string is ignored).');
    var exact = locs.filter(function (l) { return l.mod === '='; });
    for (var i = 0; i < exact.length; i++) if (exact[i].pat === uri) { trace.push('1. Exact match <code>' + esc(exact[i].label) + '</code> wins immediately.'); return { loc: exact[i], trace: trace }; }
    trace.push('1. No exact (<code>=</code>) location equals the path.');
    var pre = locs.filter(function (l) { return l.mod === '' || l.mod === '^~'; }), best = null;
    pre.forEach(function (l) { if (uri.indexOf(l.pat) === 0 && (!best || l.pat.length > best.pat.length)) best = l; });
    var redir = pre.filter(function (l) { return l.pat.length > 1 && l.pat.slice(-1) === '/' && l.pat.slice(0, -1) === uri && PASS.test(l.body); })[0];
    if (redir && !pre.some(function (l) { return l.pat === uri; })) {
      trace.push('2. Special case: <code>' + esc(redir.label) + '</code> ends with <code>/</code> and uses a <code>*_pass</code> directive, and the path is the same without the slash. nginx answers with a permanent redirect.');
      return { redirect: uri + '/', loc: redir, trace: trace };
    }
    if (best) trace.push('2. Longest matching prefix: <code>' + esc(best.label) + '</code> (' + best.pat.length + ' characters). On Linux, prefixes are compared case-sensitively (nginx on macOS ignores case).'); else trace.push('2. No prefix location matches.');
    if (best && best.mod === '^~') { trace.push('3. It has <code>^~</code>, so regular expressions are skipped. Done.'); return { loc: best, trace: trace }; }
    var rx = locs.filter(function (l) { return l.mod === '~' || l.mod === '~*'; });
    for (var k = 0; k < rx.length; k++) {
      var l = rx[k];
      if (l.err) { trace.push('3. <code>' + esc(l.label) + '</code> is not a valid regular expression here (' + esc(l.err) + ').'); continue; }
      if (l.re.test(uri)) { trace.push('3. Regular expressions are tried in file order. <code>' + esc(l.label) + '</code> (line ' + l.line + ') matches first' + (l.mod === '~*' ? ', ignoring case' : '') + ', and a regex match beats the remembered prefix.'); return { loc: l, trace: trace }; }
    }
    if (rx.length) trace.push('3. None of the ' + rx.length + ' regular expression' + (rx.length > 1 ? 's' : '') + ' match.');
    if (best) { trace.push('4. Fall back to the remembered prefix <code>' + esc(best.label) + '</code>.'); return { loc: best, trace: trace }; }
    trace.push('4. Nothing matched. With no <code>location /</code>, nginx serves files from the server\'s <code>root</code>, which is rarely what you meant.');
    return { loc: null, trace: trace };
  }
  function action(res) {
    if (res.redirect) return '301 Moved Permanently → <code>' + esc(res.redirect) + '</code>';
    var l = res.loc; if (!l) return 'no location: default file handling';
    var b = l.body, m;
    if ((m = /return\s+(\d{3})\s*([^;]*);/.exec(b))) return m[1] + (m[2] ? ' → <code>' + esc(m[2]) + '</code>' : '');
    if (/deny all;/.test(b) && /allow\s+([^;]+);/.test(b)) return 'allowed only from <code>' + esc(/allow\s+([^;]+);/.exec(b)[1]) + '</code>, otherwise 403 Forbidden' + ((m = /proxy_pass\s+([^;]+);/.exec(b)) ? '; then proxied to <code>' + esc(m[1]) + '</code>' : '');
    if (/deny all;/.test(b)) return '403 Forbidden';
    if ((m = /proxy_pass\s+([^;]+);/.exec(b))) return 'proxied to <code>' + esc(m[1]) + '</code>';
    if ((m = /root\s+([^;]+);/.exec(b))) return 'file from disk under <code>' + esc(m[1]) + '</code>';
    return 'handled by this block';
  }
  W.proxyroute = function () {
    var r = wg('Which location block answers?', 'nginx picks exactly one <code>location</code> for each request, and the rule is not "first match". Type a path or pick one, read the decision step by step, then edit the config and try to predict the result before you press Enter.');
    var b = addBody(r, '<div class="pr-g"><label class="cl-l">nginx config (editable)<textarea id="cf" spellcheck="false" data-fixed rows="22">' + esc(DEFCONF) + '</textarea></label><div><label class="cl-l">Request path<input type="text" id="pth" value="/api/devices?type=server" spellcheck="false" autocomplete="off" autocapitalize="off"></label><div class="xp-ex">' + TESTS.map(function (t) { return '<button class="chip" data-t="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div><div id="res" class="pr-res" aria-live="polite"></div></div></div>');
    function go() {
      var locs = parseConf($('#cf', b).value), res = matchLoc(locs, $('#pth', b).value.trim() || '/');
      $('#res', b).innerHTML = '<div class="pr-win">' + (res.loc ? '<code>' + esc(res.loc.label) + '</code>' : '<i>no location</i>') + '<span>' + action(res) + '</span></div><ol class="pr-tr">' + res.trace.map(function (t) { return '<li>' + t.replace(/^\d\.\s/, '') + '</li>'; }).join('') + '</ol>' +
        '<details><summary>' + locs.length + ' location blocks found</summary><ul class="pr-ls">' + locs.map(function (l) { return '<li' + (l === res.loc ? ' class="on"' : '') + '><code>' + esc(l.label) + '</code> <small>line ' + l.line + (l.mod === '=' ? ', exact' : l.mod === '^~' ? ', prefix that blocks regex' : l.mod ? ', regex' + (l.mod === '~*' ? ' (any case)' : '') : ', prefix') + '</small></li>'; }).join('') + '</ul></details>';
    }
    b.addEventListener('click', function (e) { var t = e.target.closest('[data-t]'); if (t) { $('#pth', b).value = t.getAttribute('data-t'); go(); } });
    b.addEventListener('input', go);
    go();
    return r;
  };
  (window.__srvTest = window.__srvTest || {}).matchLoc = function (conf, path) { var r = matchLoc(parseConf(conf), path); return { label: r.loc ? r.loc.label : null, redirect: r.redirect || null }; };
})();
