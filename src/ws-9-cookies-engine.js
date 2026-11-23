/* Cookies chapter: the rules a browser applies, as plain functions with no DOM, so the labs and the tests share one implementation.
   window.__ck = {
     registrable(host)            the "site" (registrable domain) of a host: shop.example, news.co.uk
     sameSite(hostA, hostB)       do two hosts belong to the same site?
     setCookie(header, url)       what a browser does with one Set-Cookie header: {ok, reason, cookie, notes}
     decide(cookie, req)          would this stored cookie be sent with this request? {sent, why}
     jar(cookies, req)            the cookies sent, in the order the browser puts them in the Cookie header
     jsVisible(cookie, docUrl)    would document.cookie on that page show it?
   }
   A cookie is {name, value, domain, hostOnly, path, secure, httpOnly, sameSite, life, created}
     sameSite: 'Strict' | 'Lax' | 'None' | '' (not given; Chrome treats it as Lax)
     life: null for a session cookie, otherwise seconds from now.
   A request is {url, context, nav, method}
     context: URL of the page the request belongs to (the page you are on for images, fetch and iframes,
              the page you came from for a navigation); nav: true for a top-level navigation (a link, a typed URL).
   test/cookie_rules.py compares this file with a real Chromium. Differences it found are listed there. */
(function () {
  'use strict';
  // A small public suffix list: enough for the examples in the book. Everything else uses the last label (com, example, test).
  var SUFFIX = ['co.uk', 'org.uk', 'ac.uk', 'com.au', 'github.io', 'herokuapp.com', 'blogspot.com', 'cloudfront.net'];
  var MAX_LIFE = 400 * 86400;   // Chrome stores no cookie for longer than 400 days

  function isIP(h) { return /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.indexOf(':') >= 0; }
  function suffixOf(host) {
    var best = host.split('.').pop();
    SUFFIX.forEach(function (s) { if ((host === s || host.slice(-s.length - 1) === '.' + s) && s.split('.').length > best.split('.').length) best = s; });
    return best;
  }
  function registrable(host) {
    host = String(host).toLowerCase();
    if (isIP(host)) return host;
    var suf = suffixOf(host);
    if (host === suf) return host;
    var rest = host.slice(0, host.length - suf.length - 1).split('.');
    return rest[rest.length - 1] + '.' + suf;
  }
  function isSuffix(host) { return !isIP(host) && suffixOf(host) === host; }
  function sameSite(a, b) { return registrable(a) === registrable(b); }
  function domainMatch(host, dom) { return host === dom || (!isIP(host) && host.slice(-dom.length - 1) === '.' + dom); }
  function pathMatch(req, cp) { return req === cp || (req.indexOf(cp) === 0 && (cp.slice(-1) === '/' || req.charAt(cp.length) === '/')); }
  function defaultPath(p) { if (!p || p.charAt(0) !== '/') return '/'; var i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); }
  function parseUrl(u) { var a = new URL(u); return { scheme: a.protocol.replace(':', ''), host: a.hostname.toLowerCase(), path: a.pathname || '/' }; }

  var seq = 0;
  function setCookie(header, url) {
    var u = parseUrl(url), https = u.scheme === 'https', notes = [];
    var parts = String(header).split(';'), first = parts.shift(), eq = first.indexOf('=');
    if (eq < 0) return { ok: false, reason: 'There is no name=value pair, so there is nothing to store.' };
    var name = first.slice(0, eq).trim(), value = first.slice(eq + 1).trim();
    if (!name) return { ok: false, reason: 'The name is empty.' };
    if (name.length + value.length > 4096) return { ok: false, reason: 'Name plus value is longer than 4096 bytes: browsers refuse it.' };
    var c = { name: name, value: value, domain: u.host, hostOnly: true, path: defaultPath(u.path), secure: false, httpOnly: false, sameSite: '', life: null, created: ++seq };
    var dom = null, path = null, maxAge = null, expires = null, del = false;
    parts.forEach(function (p) {
      var i = p.indexOf('='), k = (i < 0 ? p : p.slice(0, i)).trim().toLowerCase(), v = i < 0 ? '' : p.slice(i + 1).trim();
      if (k === 'domain') dom = v.replace(/^\./, '').toLowerCase();
      else if (k === 'path') path = v;
      else if (k === 'secure') c.secure = true;
      else if (k === 'httponly') c.httpOnly = true;
      else if (k === 'samesite') { var s = v.toLowerCase(); c.sameSite = s === 'strict' ? 'Strict' : s === 'lax' ? 'Lax' : s === 'none' ? 'None' : ''; if (!c.sameSite) notes.push('SameSite=' + v + ' is not a value browsers know, so it is ignored.'); }
      else if (k === 'max-age') { if (/^-?\d+$/.test(v)) maxAge = parseInt(v, 10); }
      else if (k === 'expires') { var t = Date.parse(v); if (!isNaN(t)) expires = Math.round((t - Date.now()) / 1000); }
    });
    if (dom !== null && dom !== '') {
      if (isSuffix(dom) && dom !== u.host) return { ok: false, reason: 'Domain=' + dom + ' is a public suffix (shared by many unrelated sites). Browsers refuse it, or nobody could keep their cookies apart.' };
      if (!domainMatch(u.host, dom)) return { ok: false, reason: 'Domain=' + dom + ' does not contain the host that sent it (' + u.host + '). A site can set cookies for itself and its subdomains, never for another site.' };
      if (!isSuffix(dom)) { c.domain = dom; c.hostOnly = false; }
    }
    if (path !== null && path.charAt(0) === '/') c.path = path;
    else if (path !== null) notes.push('Path=' + path + ' does not start with / so the default path ' + c.path + ' is used.');
    if (c.secure && !https) return { ok: false, reason: 'A Secure cookie cannot be set over plain HTTP: the browser would not let an unencrypted response create a cookie that promises encryption.' };
    if (c.sameSite === 'None' && !c.secure) return { ok: false, reason: 'SameSite=None without Secure is rejected by Chrome, Firefox and Safari: a cookie that goes cross-site must at least be HTTPS-only.' };
    var low = name.toLowerCase();
    if (low.indexOf('__secure-') === 0 && !(c.secure && https)) return { ok: false, reason: 'The __Secure- prefix is a promise: the cookie must have Secure and be set over HTTPS.' };
    if (low.indexOf('__host-') === 0) {
      if (!(c.secure && https)) return { ok: false, reason: 'The __Host- prefix is a promise: Secure, set over HTTPS.' };
      if (dom) return { ok: false, reason: 'A __Host- cookie must not have a Domain attribute: it belongs to exactly one host.' };
      if (c.path !== '/') return { ok: false, reason: 'A __Host- cookie must have Path=/ : it covers the whole host.' };
    }
    if (maxAge !== null) { if (maxAge <= 0) del = true; else c.life = maxAge; if (expires !== null) notes.push('Max-Age is present, so Expires is ignored.'); }
    else if (expires !== null) { if (expires <= 0) del = true; else c.life = expires; }
    if (c.life !== null && c.life > MAX_LIFE) { c.life = MAX_LIFE; notes.push('Chrome caps a cookie’s lifetime at 400 days; a longer request is shortened, not refused.'); }
    if (!c.sameSite) notes.push('No SameSite: Chrome treats the cookie as Lax. Do not rely on it; say what you mean.');
    c.deleted = del;
    return { ok: true, cookie: c, notes: notes, deletes: del };
  }

  // Would this cookie go out with this request? why is the first rule that stops it, or the rule that lets it through.
  function decide(c, req) {
    var u = parseUrl(req.url), ctx = parseUrl(req.context || req.url);
    if (c.hostOnly ? u.host !== c.domain : !domainMatch(u.host, c.domain)) return { sent: false, why: 'domain', text: 'The cookie belongs to ' + (c.hostOnly ? c.domain + ' only (no Domain attribute)' : c.domain + ' and its subdomains') + ', not ' + u.host + '.' };
    if (!pathMatch(u.path, c.path)) return { sent: false, why: 'path', text: 'The request path ' + u.path + ' is outside Path=' + c.path + '.' };
    if (c.secure && u.scheme !== 'https') return { sent: false, why: 'secure', text: 'The cookie is Secure and this request is plain HTTP.' };
    var same = sameSite(u.host, ctx.host);
    if (same) return { sent: true, why: 'same-site', text: 'Same site (' + registrable(u.host) + '): every cookie that matches goes along.' };
    var ss = c.sameSite || 'Lax', safe = (req.method || 'GET').toUpperCase() === 'GET';
    if (ss === 'None') return { sent: true, why: 'none', text: 'Cross-site, but SameSite=None says "send it anywhere" (this is how third-party cookies work).' };
    if (ss === 'Lax' && req.nav && safe) return { sent: true, why: 'lax-nav', text: 'Cross-site, but SameSite=Lax allows a top-level GET navigation (you clicked a link).' };
    return { sent: false, why: 'samesite', text: 'Cross-site request (' + registrable(ctx.host) + ' to ' + registrable(u.host) + '): SameSite=' + ss + (c.sameSite ? '' : ' (the default)') + ' keeps the cookie at home' + (ss === 'Lax' ? ' unless it is a link click' : '') + '.' };
  }

  function jar(cookies, req) {
    return cookies.filter(function (c) { return !c.deleted && decide(c, req).sent; })
      .sort(function (a, b) { return b.path.length - a.path.length || a.created - b.created; });
  }

  function jsVisible(c, docUrl) {
    var u = parseUrl(docUrl);
    if (c.httpOnly) return { yes: false, text: 'HttpOnly: JavaScript cannot read it.' };
    if (c.hostOnly ? u.host !== c.domain : !domainMatch(u.host, c.domain)) return { yes: false, text: 'Not for this host.' };
    if (!pathMatch(u.path, c.path)) return { yes: false, text: 'Outside its Path.' };
    if (c.secure && u.scheme !== 'https') return { yes: false, text: 'Secure cookie on an HTTP page.' };
    return { yes: true, text: 'document.cookie includes it.' };
  }

  function header(c) {
    var s = c.name + '=' + c.value;
    if (!c.hostOnly) s += '; Domain=' + c.domain;
    s += '; Path=' + c.path;
    return s;
  }
  function lifeText(l) {
    if (l === null || l === undefined) return 'session (until the browser quits)';
    if (l >= 86400 * 2) return Math.round(l / 86400) + ' days';
    if (l >= 3600 * 2) return Math.round(l / 3600) + ' hours';
    if (l >= 120) return Math.round(l / 60) + ' minutes';
    return l + ' seconds';
  }

  // Small helpers shared by the lab files. They read window.__core when called, so the load order of the scripts does not matter.
  window.__ckui = {
    wrap: function (title, sub, cls) {
      var K = window.__core, r = K.h('div', { class: 'wg ck ' + (cls || '') });
      r.innerHTML = '<h4>' + K.esc(title) + '</h4>' + (sub ? '<p class="sub">' + sub + '</p>' : '');
      return r;
    },
    chips: function (items, cur, attr) {
      var esc = window.__core.esc;
      return items.map(function (it) {
        return '<button type="button" class="chip' + (it[0] === cur ? ' on' : '') + '" ' + attr + '="' + esc(it[0]) + '" aria-pressed="' + (it[0] === cur ? 'true' : 'false') + '">' + esc(it[1]) + '</button>';
      }).join('');
    },
    pill: function (kind, text) { return '<span class="ck-pill ck-' + kind + '">' + window.__core.esc(text) + '</span>'; },
    // a small deterministic random generator, so the same lab always shows the same data
    rng: function (seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  };

  window.__ck = { registrable: registrable, sameSite: sameSite, setCookie: setCookie, decide: decide, jar: jar, jsVisible: jsVisible, header: header, lifeText: lifeText,
    parseUrl: parseUrl, isSuffix: isSuffix, domainMatch: domainMatch, pathMatch: pathMatch, defaultPath: defaultPath, MAX_LIFE: MAX_LIFE };
})();
