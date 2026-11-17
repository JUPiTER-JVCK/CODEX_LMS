/* Servers, APIs & Cloud widgets, part 1: API console (against the in-page practice server) and a token-bucket rate limiter. */
(function () {
  'use strict';
  var K = window.__core, $ = K.$, $$ = K.$$, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};
  function wg(title, sub, dom) { var r = h('div', { class: 'wg sv' }); r.style.setProperty('--dom', 'var(--c-' + (dom || 'srv') + ')'); r.innerHTML = '<h4>' + esc(title) + '</h4>' + (sub ? '<p class="sub">' + sub + '</p>' : ''); return r; }
  function addBody(r, html) { var d = h('div', { html: html }); r.appendChild(d); return d; }

  /* The practice server (lab.local) lives in the playground source; evaluate only its mock part here. */
  var MOCK = null;
  function mockLib() {
    if (MOCK) return MOCK;
    var SB = window.__SBSRC || '', a = SB.indexOf('var PPMock = (function'), z = SB.indexOf('/* Runs inside every playground iframe');
    if (a < 0 || z < 0) return null;
    MOCK = new Function(SB.slice(a, z) + '\nreturn PPMock;')();
    return MOCK;
  }
  function statusClass(s) { return s >= 500 ? 's5' : s >= 400 ? 's4' : s >= 300 ? 's3' : s >= 200 ? 's2' : 's0'; }
  function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
  function pyStr(s) { return JSON.stringify(String(s)).replace(/^"|"$/g, '').replace(/'/g, "\\'"); }
  function jsStr(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }

  /* ---------------- API console ---------------- */
  var PRESETS = [
    ['List devices', 'GET', '/api/devices', '', ''],
    ['Filter with a query', 'GET', '/api/devices?type=server&online=true', '', ''],
    ['One device', 'GET', '/api/devices/3', '', ''],
    ['Not found', 'GET', '/api/devices/99', '', ''],
    ['Create', 'POST', '/api/devices', 'Content-Type: application/json', '{\n  "name": "camera",\n  "ip": "192.168.1.80",\n  "type": "camera"\n}'],
    ['Invalid data', 'POST', '/api/devices', 'Content-Type: application/json', '{\n  "name": "camera",\n  "ip": "not-an-ip"\n}'],
    ['Broken JSON', 'POST', '/api/devices', 'Content-Type: application/json', '{ "name": "camera", }'],
    ['Partial update', 'PATCH', '/api/devices/4', 'Content-Type: application/json', '{ "online": true }'],
    ['Delete', 'DELETE', '/api/devices/5', '', ''],
    ['Wrong method', 'POST', '/api/devices/3', 'Content-Type: application/json', '{}'],
    ['No token', 'GET', '/api/me', '', ''],
    ['With a token', 'GET', '/api/me', 'Authorization: Bearer lab-token', ''],
    ['Flaky endpoint', 'GET', '/api/flaky', '', ''],
    ['Echo my request', 'POST', '/api/echo?debug=1', 'Content-Type: application/json\nX-Request-Id: 7f3a9c', '{ "hello": "server" }']
  ];
  W.apiconsole = function (args) {
    var r = wg('API console: talk to the practice server', 'Every request goes to <code>lab.local</code>, a small REST API that runs inside this page, so nothing leaves your browser. Pick a preset or write your own request, send it, then read the status, headers and body. The <em>As code</em> tab shows the same request for curl, JavaScript and Python.');
    var lib = mockLib();
    if (!lib) { addBody(r, '<p>The practice server could not start in this browser.</p>'); return r; }
    var logs = {}, srv = lib.create(window, function (rec) { logs[rec.id] = rec; }), hist = [], last = null, tab = (args && args.tab) || 'body';
    var b = addBody(r,
      '<div class="ac-pre" role="group" aria-label="Preset requests">' + PRESETS.map(function (p, i) { return '<button class="chip" data-p="' + i + '">' + esc(p[0]) + '</button>'; }).join('') + '</div>' +
      '<div class="ac-line"><select id="m" aria-label="HTTP method">' + ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select>' +
      '<span class="ac-host mono">http://lab.local</span><input type="text" id="u" aria-label="Path and query" spellcheck="false" autocomplete="off" autocapitalize="off"><button class="btn" id="go">Send</button></div>' +
      '<div class="ac-io"><label><span>Headers <small>(one <code>Name: value</code> per line)</small></span><textarea id="hd" rows="3" spellcheck="false" data-fixed></textarea></label>' +
      '<label><span>Body <small id="bn"></small></span><textarea id="bd" rows="3" spellcheck="false" data-fixed></textarea></label></div>' +
      '<div class="ac-res" aria-live="polite"><div class="ac-st" id="st"><span class="ac-wait">Send a request to see the response.</span></div>' +
      '<div class="ac-tabs" role="tablist">' + [['body', 'Body'], ['headers', 'Headers'], ['raw', 'Raw HTTP'], ['code', 'As code']].map(function (t) { return '<button role="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<pre class="ac-out" id="out"></pre></div>' +
      '<div class="ac-foot"><div class="ac-hist" id="hi"></div><button class="btn sec" id="rs">Reset the server data</button></div>');
    var M = $('#m', b), U = $('#u', b), HD = $('#hd', b), BD = $('#bd', b);
    function load(p) { M.value = p[1]; U.value = p[2]; HD.value = p[3]; BD.value = p[4]; syncBody(); }
    function syncBody() { var no = M.value === 'GET' || M.value === 'HEAD'; BD.disabled = no; $('#bn', b).textContent = no ? '(not allowed with ' + M.value + ')' : '(JSON for this API)'; }
    function parseHeaders() {
      var out = [], bad = null;
      HD.value.split('\n').forEach(function (l, i) { if (!l.trim()) return; var k = l.indexOf(':'); if (k < 1) { bad = 'Header line ' + (i + 1) + ' needs the form Name: value'; return; } out.push([l.slice(0, k).trim(), l.slice(k + 1).trim()]); });
      return { list: out, bad: bad };
    }
    function pretty(text, type) {
      if (text === null || text === '') return '';
      if (/json/.test(type || '')) { try { return JSON.stringify(JSON.parse(text), null, 2); } catch (e) { } }
      return text;
    }
    function codeFor(q) {
      var url = 'http://lab.local' + q.path, hasBody = q.body !== '' && q.method !== 'GET' && q.method !== 'HEAD';
      var bodyObj = null; if (hasBody) { try { bodyObj = JSON.parse(q.body); } catch (e) { bodyObj = null; } }
      var curl = 'curl -i' + (q.method === 'HEAD' ? ' -I' : q.method !== 'GET' ? ' -X ' + q.method : '') + ' ' + shq(url);
      q.headers.forEach(function (x) { curl += ' \\\n  -H ' + shq(x[0] + ': ' + x[1]); });
      if (hasBody) curl += ' \\\n  -d ' + shq(bodyObj ? JSON.stringify(bodyObj) : q.body);
      var js = 'const res = await fetch(' + jsStr(url);
      var opt = [];
      if (q.method !== 'GET') opt.push('  method: ' + jsStr(q.method) + ',');
      if (q.headers.length) opt.push('  headers: { ' + q.headers.map(function (x) { return jsStr(x[0]) + ': ' + jsStr(x[1]); }).join(', ') + ' },');
      if (hasBody) opt.push('  body: ' + (bodyObj ? 'JSON.stringify(' + JSON.stringify(bodyObj) + ')' : jsStr(q.body)) + ',');
      js += opt.length ? ', {\n' + opt.join('\n') + '\n});\n' : ');\n';
      js += q.method === 'HEAD' ? 'console.log(res.status, [...res.headers]);' : "console.log(res.status, res.headers.get('content-type'));\nconsole.log(await res.text());";
      var py = 'import json\nimport urllib.request\nfrom urllib.error import HTTPError\n\nreq = urllib.request.Request(\n    \'' + pyStr(url) + '\',\n    method=\'' + q.method + '\',';
      if (q.headers.length) py += '\n    headers={' + q.headers.map(function (x) { return "'" + pyStr(x[0]) + "': '" + pyStr(x[1]) + "'"; }).join(', ') + '},';
      if (hasBody) py += '\n    data=' + (bodyObj ? 'json.dumps(' + JSON.stringify(bodyObj).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None') + ').encode()' : "'" + pyStr(q.body) + "'.encode()") + ',';
      py += '\n)\ntry:\n    with urllib.request.urlopen(req, timeout=10) as res:\n        print(res.status, res.headers[\'Content-Type\'])\n        print(res.read().decode())\nexcept HTTPError as err:\n    print(err.code, err.read().decode())';
      return '<span class="ac-cl"># curl (zsh)</span>\n' + esc(curl) + '\n\n<span class="ac-cl">// JavaScript (browser console or Node 18+)</span>\n' + esc(js) + '\n\n<span class="ac-cl"># Python (standard library only)</span>\n' + esc(py) + '\n\n<span class="ac-cl">lab.local exists only inside this book. On a real API, swap in its address.</span>';
    }
    function render() {
      $$('.ac-tabs button', b).forEach(function (x) { var on = x.getAttribute('data-t') === tab; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
      var o = $('#out', b);
      if (!last) { o.innerHTML = '<span class="ac-cl">' + (tab === 'code' ? 'Send a request first; the code for it appears here.' : 'Nothing yet.') + '</span>'; return; }
      var q = last.q, s = last.s;
      if (tab === 'body') o.innerHTML = s.body === null || s.body === '' ? '<span class="ac-cl">(no body: ' + (s.status === 204 ? '204 means success with nothing to send back' : 'this response has none') + ')</span>' : K.hlJs(pretty(s.body, s.type));
      else if (tab === 'headers') o.innerHTML = s.headers.map(function (x) { return '<span class="ac-hk">' + esc(x[0]) + '</span>: ' + esc(x[1]); }).join('\n');
      else if (tab === 'raw') {
        var req = '<span class="ac-dir">request ▸</span>\n' + esc(q.method + ' ' + q.path + ' HTTP/1.1') + '\n<span class="ac-hk">Host</span>: lab.local\n' + q.headers.map(function (x) { return '<span class="ac-hk">' + esc(x[0]) + '</span>: ' + esc(x[1]); }).join('\n') + (q.headers.length ? '\n' : '');
        if (q.sentBody) req += '<span class="ac-hk">Content-Length</span>: ' + new TextEncoder().encode(q.sentBody).length + '\n\n' + esc(q.sentBody) + '\n'; else req += '\n';
        var res = '\n<span class="ac-dir">◂ response</span>\n' + esc('HTTP/1.1 ' + s.status + ' ' + s.statusText) + '\n' + s.headers.map(function (x) { return '<span class="ac-hk">' + esc(x[0]) + '</span>: ' + esc(x[1]); }).join('\n') + '\n\n' + (s.body ? esc(s.body) : '');
        o.innerHTML = req + res;
      } else o.innerHTML = codeFor(q);
    }
    function send() {
      var method = M.value, path = U.value.trim() || '/';
      if (/^https?:\/\//i.test(path)) { try { var x = new URL(path); path = x.pathname + x.search; } catch (e) { } }
      if (path.charAt(0) !== '/') path = '/' + path;
      U.value = path;
      var hp = parseHeaders(); if (hp.bad) { $('#st', b).innerHTML = '<span class="ac-pill s4">client error</span> ' + esc(hp.bad); return; }
      var body = BD.disabled ? '' : BD.value, sentBody = body.trim() ? body : '';
      var init = { method: method, headers: hp.list };
      if (sentBody) init.body = sentBody;
      var go = $('#go', b); go.disabled = true; go.textContent = 'Sending…';
      var ids = Object.keys(logs).length;
      srv.fetch('http://lab.local' + path, init).then(function (res) {
        var rec = logs[Math.max.apply(null, Object.keys(logs).map(Number))] || {};
        return res.text().then(function (text) {
          var hs = []; var src = rec.resHeaders || {}; Object.keys(src).forEach(function (k) { hs.push([k, src[k]]); });
          last = { q: { method: method, path: path, headers: hp.list, body: body, sentBody: sentBody }, s: { status: res.status, statusText: res.statusText, headers: hs, body: method === 'HEAD' ? '' : text, type: res.headers.get('content-type') || '', ms: rec.ms } };
        });
      }).catch(function (e) {
        last = null; $('#st', b).innerHTML = '<span class="ac-pill s0">failed</span> ' + esc(e && e.message || e);
      }).then(function () {
        go.disabled = false; go.textContent = 'Send';
        if (!last) return;
        var s = last.s, len = s.body ? new TextEncoder().encode(s.body).length : 0;
        $('#st', b).innerHTML = '<span class="ac-pill ' + statusClass(s.status) + '">' + s.status + ' ' + esc(s.statusText) + '</span><span class="ac-meta">' + (s.ms != null ? s.ms + ' ms · ' : '') + (s.type ? esc(s.type.split(';')[0]) + ' · ' : '') + len + ' bytes</span>' + explain(s.status, method);
        hist.unshift({ m: method, p: path, s: s.status, q: [method, path, HD.value, BD.value] }); hist = hist.slice(0, 8);
        $('#hi', b).innerHTML = hist.length ? '<span class="ac-hl">History</span>' + hist.map(function (x, i) { return '<button class="chip mono" data-h="' + i + '"><span class="ac-dot ' + statusClass(x.s) + '"></span>' + esc(x.m + ' ' + x.p) + ' · ' + x.s + '</button>'; }).join('') : '';
        render();
      });
      void ids;
    }
    function explain(st, method) {
      var t = {
        200: 'OK: the request worked and the body holds the result.', 201: 'Created: the server made a new resource. The <code>Location</code> header says where it lives.', 204: 'No Content: it worked and there is nothing to send back. Typical for DELETE.',
        400: 'Bad Request: the server could not parse what you sent. Fix the request before retrying.', 401: 'Unauthorized: no valid credentials. The <code>WWW-Authenticate</code> header says which scheme to use.',
        404: 'Not Found: nothing lives at this path. Check the id and the URL.', 405: 'Method Not Allowed: the path exists, but not for ' + esc(method) + '. The <code>Allow</code> header lists what works.',
        422: 'Unprocessable Content: the JSON parsed, but a field failed validation.', 500: 'Internal Server Error: the server failed. Not your fault, but worth reporting.', 503: 'Service Unavailable: try again later. <code>Retry-After</code> says how long to wait.'
      }[st];
      return t ? '<p class="ac-ex">' + t + '</p>' : '';
    }
    b.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-p')) { load(PRESETS[+t.getAttribute('data-p')]); send(); }
      else if (t.hasAttribute('data-h')) { var q = hist[+t.getAttribute('data-h')].q; load([0, q[0], q[1], q[2], q[3]]); }
      else if (t.hasAttribute('data-t')) { tab = t.getAttribute('data-t'); render(); }
      else if (t.id === 'go') send();
      else if (t.id === 'rs') { srv.reset(); K.toast('Practice data reset to the six starting devices'); }
    });
    M.addEventListener('change', syncBody);
    U.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    load(PRESETS[0]); render();
    return r;
  };

  /* ---------------- rate limiter (token bucket) ---------------- */
  W.ratelimit = function () {
    var r = wg('Rate limiting with a token bucket', 'Each request spends one token. Tokens refill at a steady rate up to the bucket size. An empty bucket means <code>429 Too Many Requests</code>. Fire requests by hand or let a client loop run, then switch on the polite client and compare.');
    var b = addBody(r,
      '<div class="rl-ctl"><label>Bucket size <input type="range" id="cap" min="1" max="20" value="10"><b id="capv">10</b></label>' +
      '<label>Refill <input type="range" id="rate" min="1" max="20" value="4"><b id="ratev">2 / s</b></label>' +
      '<label>Client loop <input type="range" id="auto" min="0" max="20" value="0"><b id="autov">off</b></label>' +
      '<label class="rl-pol"><input type="checkbox" id="pol"> Polite client: honour <code>Retry-After</code></label></div>' +
      '<div class="rl-bucket" id="bk" aria-label="Tokens in the bucket"></div>' +
      '<div class="rl-btns"><button class="btn" id="one">Send 1 request</button><button class="btn sec" id="burst">Send a burst of 15</button><button class="btn sec" id="clr">Reset</button></div>' +
      '<div class="rl-tl" id="tl" aria-label="Recent responses, newest last"></div>' +
      '<div class="rl-stats" id="stt"></div><pre class="rl-res" id="res" aria-live="polite"></pre>');
    var tokens = 10, cap = 10, rate = 2, auto = 0, acc = 0, pausedUntil = 0, last = performance.now(), tl = [], n = { ok: 0, lim: 0, held: 0 };
    function rateOf(v) { return v / 2; }
    function hit(fromLoop) {
      var now = performance.now();
      if (fromLoop && $('#pol', b).checked && now < pausedUntil) { n.held++; return; }
      if (tokens >= 1) { tokens -= 1; n.ok++; tl.push(1); show(200); }
      else {
        var wait = Math.ceil((1 - tokens) / rate); n.lim++; tl.push(0); show(429, wait);
        if (fromLoop && $('#pol', b).checked) pausedUntil = now + wait * 1000;
      }
      if (tl.length > 60) tl = tl.slice(-60);
      draw();
    }
    function show(st, wait) {
      var rem = Math.floor(tokens);
      $('#res', b).innerHTML = (st === 200 ? '<span class="ac-pill s2">HTTP/1.1 200 OK</span>' : '<span class="ac-pill s4">HTTP/1.1 429 Too Many Requests</span>') + '\n<span class="ac-hk">X-RateLimit-Limit</span>: ' + cap + '\n<span class="ac-hk">X-RateLimit-Remaining</span>: ' + rem + (st === 429 ? '\n<span class="ac-hk">Retry-After</span>: ' + wait : '');
    }
    function draw() {
      var full = Math.floor(tokens + 1e-9), part = tokens - full, o = '';
      for (var i = 0; i < cap; i++) o += '<span class="rl-tok' + (i < full ? ' on' : '') + '"' + (i === full && part > 0.02 ? ' style="--p:' + Math.round(part * 100) + '%"' : '') + '></span>';
      $('#bk', b).innerHTML = o + '<span class="rl-n mono">' + tokens.toFixed(1) + ' / ' + cap + '</span>';
      $('#tl', b).innerHTML = tl.map(function (x) { return '<span class="' + (x ? 'ok' : 'no') + '" title="' + (x ? '200' : '429') + '"></span>'; }).join('');
      var tot = n.ok + n.lim;
      $('#stt', b).innerHTML = '<span><b>' + n.ok + '</b> answered</span><span><b>' + n.lim + '</b> rejected (429)</span>' + (n.held ? '<span><b>' + n.held + '</b> held back by the polite client</span>' : '') + (tot ? '<span><b>' + Math.round(100 * n.ok / tot) + '%</b> success</span>' : '');
    }
    var timer = setInterval(function () {
      if (!r.isConnected) { clearInterval(timer); return; }
      var now = performance.now(), dt = (now - last) / 1000; last = now;
      tokens = Math.min(cap, tokens + rate * dt);
      if (auto) { acc += auto * dt; while (acc >= 1) { acc -= 1; hit(true); } }
      draw();
    }, 100);
    b.addEventListener('input', function (e) {
      var id = e.target.id;
      if (id === 'cap') { cap = +e.target.value; tokens = Math.min(tokens, cap); $('#capv', b).textContent = cap; }
      if (id === 'rate') { rate = rateOf(+e.target.value); $('#ratev', b).textContent = rate + ' / s'; }
      if (id === 'auto') { auto = +e.target.value; $('#autov', b).textContent = auto ? auto + ' req / s' : 'off'; }
      draw();
    });
    b.addEventListener('click', function (e) {
      var id = e.target.id;
      if (id === 'one') hit(false);
      else if (id === 'burst') { for (var i = 0; i < 15; i++) hit(false); }
      else if (id === 'clr') { tokens = cap; tl = []; n = { ok: 0, lim: 0, held: 0 }; pausedUntil = 0; $('#res', b).textContent = ''; draw(); }
    });
    draw();
    return r;
  };
})();
