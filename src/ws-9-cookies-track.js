/* Web part, "Cookies, Tracking and Privacy" chapter, second group: who uses cookies, and what tracking can and cannot see.
   cktrack    one tracker embedded in three sites: what it sees under each browser policy
   ckprofile  browse a made-up web, watch an anonymous ID turn into interests, then into a named profile
   ckpersist  which tracking methods survive which things you can do
   ckfinger   how fast a browser's technical details narrow a crowd to one (on a made-up population)
   cksort     the cookie sorting game: strictly necessary, preferences, analytics or advertising?
   Every number here is made up for teaching and says so on screen. Nothing is sent anywhere. */
(function () {
  'use strict';
  if (!window.__core) return;
  var K = window.__core, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};
  var U = function () { return window.__ckui; };
  function wrap(t, s, c) { return U().wrap(t, s, c); }
  function chips(a, b, c) { return U().chips(a, b, c); }
  function pill(k, t) { return U().pill(k, t); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* ================= cktrack ================= */
  var TSITES = [
    { id: 'shop', host: 'shop.example', page: '/cart', login: true },
    { id: 'news', host: 'news.example', page: '/article/7', login: true },
    { id: 'travel', host: 'travel.example', page: '/flights', login: false }
  ];
  var TPOL = [['allow', 'Third-party cookies allowed'], ['block', 'Blocked (Safari)'], ['part', 'One jar per site (Firefox)']];
  var TPOL_TXT = {
    allow: 'Chrome’s default as this book is written. The tracker’s cookie lives in one jar that every site can reach, so the same ID comes back from every site.',
    block: 'Safari’s default. A cookie from a site you are not visiting is not stored or sent. The tracker gets the request, but no ID.',
    part: 'Firefox’s Total Cookie Protection, and Chrome’s opt-in Partitioned (CHIPS) cookies. The embedded tracker may keep a cookie, but a separate one for each site you are on.'
  };
  var PART_ID = { shop: 'a3f9', news: '51be', travel: 'c07d' };
  function track() {
    var r = wrap('The tracker’s-eye view', 'ads.example runs an ad on three unrelated sites. Pick your browser’s policy, visit the sites, and read the tracker’s notebook.');
    var st = { pol: 'allow', visits: ['shop', 'news', 'travel'], mail: false };
    var ctl = h('div', { class: 'ck-ctl' }), out = h('div', { class: 'ck-out', 'aria-live': 'polite' });
    r.appendChild(ctl); r.appendChild(out);
    function keysOf(site) {
      var k = [];
      if (st.pol === 'allow') k.push('uid=77c1');
      else if (st.pol === 'part') k.push('uid=' + PART_ID[site.id] + ' (jar of ' + site.host + ')');
      if (st.mail && site.login) k.push('email hash 9b2e41');
      return k;
    }
    function draw() {
      ctl.innerHTML = '<div class="ck-row"><span class="ck-lab">Browser policy</span>' + chips(TPOL, st.pol, 'data-p') + '</div>' +
        '<div class="ck-row"><span class="ck-lab">You visit</span>' + TSITES.map(function (s) { return '<button type="button" class="chip" data-v="' + s.id + '">' + esc(s.host + s.page) + '</button>'; }).join('') + '<button type="button" class="chip" data-reset>Clear visits</button></div>' +
        '<label class="ck-chk"><input type="checkbox" data-mail' + (st.mail ? ' checked' : '') + '> You are logged in on shop.example and news.example, and both pass a hashed email address to ads.example (an “identity” feature many ad networks sell)</label>';
      // union the visits that share a key
      var ents = [];
      st.visits.forEach(function (id, n) {
        var s = TSITES.filter(function (x) { return x.id === id; })[0], ks = keysOf(s), hit = [];
        ents.forEach(function (e, i) { if (ks.some(function (k) { return e.keys.indexOf(k) >= 0; })) hit.push(i); });
        var e = { keys: ks.slice(), visits: [{ n: n + 1, s: s }] };
        hit.slice().reverse().forEach(function (i) { var o = ents.splice(i, 1)[0]; o.keys.forEach(function (k) { if (e.keys.indexOf(k) < 0) e.keys.push(k); }); e.visits = o.visits.concat(e.visits); });
        e.visits.sort(function (a, b) { return a.n - b.n; });
        ents.push(e);
      });
      ents.sort(function (a, b) { return a.visits[0].n - b.visits[0].n; });
      var jar = '';
      if (st.pol === 'allow' && st.visits.length) jar = '<tr><td><code>ads.example</code></td><td><code>uid=77c1</code></td><td>shared by every site</td></tr>';
      else if (st.pol === 'part') jar = TSITES.filter(function (s) { return st.visits.indexOf(s.id) >= 0; }).map(function (s) { return '<tr><td><code>ads.example</code></td><td><code>uid=' + PART_ID[s.id] + '</code></td><td>only while on ' + esc(s.host) + '</td></tr>'; }).join('');
      var jarT = jar ? '<table class="ck-t ck-mini"><thead><tr><th>cookie from</th><th>value</th><th>reachable from</th></tr></thead><tbody>' + jar + '</tbody></table>' : '<p class="ck-dim ck-fine">' + (st.pol === 'block' ? 'The jar holds nothing from ads.example: the browser refused to store it.' : 'No visits yet.') + '</p>';
      var cards = ents.map(function (e) {
        var anon = !e.keys.length;
        return '<article class="ck-card ' + (e.visits.length > 1 ? 'ck-cbad' : 'ck-cmute') + '"><h5>' + (anon ? 'A request with no ID' : esc(e.keys.join(' + '))) + '</h5><ul>' + e.visits.map(function (v) { return '<li>visit ' + v.n + ': ' + esc(v.s.host + v.s.page) + '</li>'; }).join('') + '</ul>' +
          (e.visits.length > 1 ? '<p class="ck-fine">' + pill('bad', 'linked') + ' one profile spanning ' + e.visits.length + ' visits on ' + new Set(e.visits.map(function (v) { return v.s.host; })).size + ' sites</p>' : anon ? '<p class="ck-fine">It still sees your IP address, browser details and the page address, but has no cookie to join this to anything else.</p>' : '<p class="ck-fine">' + pill('ok', 'isolated') + ' nothing to join it to the other visits</p>') + '</article>';
      }).join('');
      var people = ents.length;
      out.innerHTML = '<div class="ck-say">' + esc(TPOL_TXT[st.pol]) + '</div>' +
        '<h6 class="ck-h6">Your browser’s jar</h6>' + jarT +
        '<h6 class="ck-h6">The tracker’s notebook <small>(there is really one person: you)</small></h6>' +
        (st.visits.length ? '<div class="ck-cards">' + cards + '</div><p class="ck-verdict ' + (people === 1 && st.visits.length > 1 ? 'ck-bad' : 'ck-ok') + '"><b>' + people + (people === 1 ? ' person' : ' people') + '</b><span>' + (people === 1 && st.visits.length > 1 ? 'The tracker joined every visit into one browsing history.' : people === st.visits.length ? 'The tracker cannot tell these visits are the same person.' : 'Some visits were joined; the rest stand alone.') + '</span></p>' : '<p class="ck-dim">Click a site above.</p>');
    }
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-p')) st.pol = b.getAttribute('data-p');
      else if (b.hasAttribute('data-v')) st.visits.push(b.getAttribute('data-v'));
      else if (b.hasAttribute('data-reset')) st.visits = [];
      else return;
      draw();
    });
    ctl.addEventListener('change', function (e) { if (e.target.hasAttribute('data-mail')) { st.mail = e.target.checked; draw(); } });
    draw();
    return r;
  }

  /* ================= ckprofile ================= */
  var PAGES = [
    { id: 'p1', t: 'BMW 3 Series financing options', host: 'dealer.example', w: { auto: 2, buy: 2, money: 1 } },
    { id: 'p2', t: 'BMW 330i or Audi A4: lease compared', host: 'dealer.example', w: { auto: 2, buy: 3, money: 1 } },
    { id: 'p3', t: 'Why does my car shake at 60 mph?', host: 'carfix.example', w: { auto: 2, diy: 1 } },
    { id: 'p4', t: 'Car insurance comparison', host: 'quotes.example', w: { auto: 1, buy: 2, money: 2 } },
    { id: 'p5', t: 'BMW diagnostic scanner review', host: 'carfix.example', w: { auto: 2, tech: 2, diy: 2 } },
    { id: 'p6', t: 'Flights to Lisbon in May', host: 'travel.example', w: { travel: 3 } },
    { id: 'p7', t: 'Boutique hotels in Alfama', host: 'travel.example', w: { travel: 3, spend: 1 } },
    { id: 'p8', t: 'Trail running shoes, size 10', host: 'sport.example', w: { fit: 3, buy: 1 } },
    { id: 'p9', t: 'Knee pain after running: causes', host: 'clinic.example', w: { health: 3, fit: 1 } },
    { id: 'p10', t: 'Mortgage rates this week', host: 'bank.example', w: { money: 3, buy: 1 } },
    { id: 'p11', t: 'Vegan weeknight dinners', host: 'recipes.example', w: { food: 3 } },
    { id: 'p12', t: 'Switching careers into data science', host: 'jobs.example', w: { career: 3, tech: 1 } }
  ];
  var INTEREST = { auto: ['Automotive', ''], buy: ['In the market to buy something big', ''], money: ['Finance and credit', ''], diy: ['DIY and repair', ''], tech: ['Technology', ''], travel: ['Travel', ''], spend: ['Higher spending', ''], fit: ['Fitness', ''], health: ['Health condition', 'sensitive'], food: ['Food', ''], career: ['Career change', 'sensitive'] };
  function conf(s) { return 1 - Math.exp(-s / 4); }
  function hex(n) { var a = '0123456789ABCDEF', s = ''; for (var i = 0; i < 8; i++) { n = (Math.imul(n, 1103515245) + 12345) >>> 0; s += a[(n >>> 16) & 15]; } return s; }
  function profile() {
    var r = wrap('From a random ID to a profile', 'Browse a made-up web. A tracker that sees every site files each visit under one ID and guesses. Then log in once and watch the guess get a name.');
    var st = { seed: 1, ids: [], cur: null, hist: {}, email: null, linked: [] };
    function newId() { var id = hex(st.seed++ * 7919 + 31); st.ids.push(id); st.hist[id] = []; st.cur = id; }
    newId();
    var left = h('div', { class: 'ck-pcol' }), right = h('div', { class: 'ck-pcol' });
    var grid = h('div', { class: 'ck-cols' }, [left, right]);
    r.appendChild(grid);
    function scores(ids) {
      var s = {};
      ids.forEach(function (id) { st.hist[id].forEach(function (pid) { var p = PAGES.filter(function (x) { return x.id === pid; })[0]; Object.keys(p.w).forEach(function (k) { s[k] = (s[k] || 0) + p.w[k]; }); }); });
      return Object.keys(s).map(function (k) { return { k: k, s: s[k], c: conf(s[k]) }; }).sort(function (a, b) { return b.s - a.s; });
    }
    function bars(ids) {
      var sc = scores(ids);
      if (!sc.length) return '<p class="ck-dim ck-fine">No visits yet. Click a page.</p>';
      return sc.map(function (x) {
        return '<div class="ck-bar"><span class="ck-bl">' + esc(INTEREST[x.k][0]) + (INTEREST[x.k][1] ? ' ' + pill('warn', 'sensitive') : '') + '</span><span class="ck-bt" aria-hidden="true"><i style="width:' + Math.round(x.c * 100) + '%"></i></span><span class="ck-bp">' + Math.round(x.c * 100) + '%</span></div>';
      }).join('');
    }
    function events() {
      var hst = st.hist[st.cur].slice(-3);
      if (!hst.length) return '';
      return '<pre class="ck-code" aria-label="the last events the tracker stored">' + hst.map(function (pid, i) {
        var p = PAGES.filter(function (x) { return x.id === pid; })[0], cat = Object.keys(p.w).sort(function (a, b) { return p.w[b] - p.w[a]; })[0];
        return '{"event":"page_view","id":"' + st.cur + '","host":"' + p.host + '","topic":"' + INTEREST[cat][0].toLowerCase() + '","seconds":' + (24 + (pid.length * 13 + i * 17) % 80) + '}';
      }).join('\n') + '</pre>';
    }
    function draw() {
      var linkedNow = st.linked.length > 0, stage = linkedNow ? 3 : st.hist[st.cur].length || st.ids.length > 1 ? 2 : 1;
      left.innerHTML = '<h5>The web you browse</h5><div class="ck-pages">' + PAGES.map(function (p) { return '<button type="button" class="ck-pg" data-pg="' + p.id + '"><b>' + esc(p.t) + '</b><small>' + esc(p.host) + '</small></button>'; }).join('') + '</div>' +
        '<div class="ck-btns"><button type="button" class="chip" data-a="login">Log in somewhere as Sam</button><button type="button" class="chip" data-a="clear">Clear cookies (new ID)</button><button type="button" class="chip" data-a="reset">Start over</button></div>';
      var merged = linkedNow ? st.linked : [st.cur];
      var all = st.ids;
      right.innerHTML = '<h5>What the tracker holds</h5><ol class="ck-stages" aria-label="Stages">' +
        [['1', 'Anonymous identifier', 'ID ' + st.cur], ['2', 'Behavioural history', st.ids.reduce(function (n, id) { return n + st.hist[id].length; }, 0) + ' page views filed under IDs'], ['3', 'Identity association', linkedNow ? 'IDs ' + st.linked.join(', ') + ' are now sam@mail.example' : 'not yet: nobody has logged in']].map(function (s, i) {
          return '<li class="' + (stage >= i + 1 ? 'on' : '') + '"><b>' + s[0] + '</b><span>' + esc(s[1]) + '<small>' + esc(s[2]) + '</small></span></li>';
        }).join('') + '</ol>' +
        '<h6 class="ck-h6">' + (linkedNow ? 'Profile: sam@mail.example (merged from ' + st.linked.length + ' ID' + (st.linked.length > 1 ? 's' : '') + ')' : 'Guesses for ID ' + esc(st.cur)) + '</h6>' + bars(linkedNow ? st.linked : [st.cur]) +
        (!linkedNow && st.ids.length > 1 ? '<p class="ck-fine ck-dim">Older IDs still held: ' + esc(st.ids.slice(0, -1).join(', ')) + ' (' + (st.ids.length - 1) + ' abandoned profile' + (st.ids.length > 2 ? 's' : '') + ').</p>' : '') +
        events() +
        '<p class="ck-fine ck-dim">These are statistical guesses, not facts: watching three car pages does not mean Sam is buying a car. The percentages are made up for this lab.</p>' +
        (st.msg ? '<p class="ck-verdict ck-warn"><b>Note</b><span>' + esc(st.msg) + '</span></p>' : '');
    }
    left.addEventListener('click', function (e) {
      var pg = e.target.closest('[data-pg]'), b = e.target.closest('[data-a]');
      if (pg) { st.hist[st.cur].push(pg.getAttribute('data-pg')); st.msg = ''; }
      else if (b) {
        var a = b.getAttribute('data-a');
        if (a === 'login') {
          if (st.linked.indexOf(st.cur) < 0) st.linked.push(st.cur);
          st.msg = st.linked.length > 1 ? 'The login gave the tracker the same email under a brand-new ID, so it joined the new history to the old one. Clearing cookies did not make it forget.' : 'One login told the tracker an email address. Every page view filed under this ID is now attached to a named person.';
        } else if (a === 'clear') {
          newId(); st.msg = st.linked.length ? 'You have a fresh ID and an empty history. Until you log in again, the tracker cannot connect it to the old one.' : 'A fresh ID and an empty history. The old profile still exists on the tracker’s servers, abandoned.';
        } else if (a === 'reset') { st.ids = []; st.hist = {}; st.linked = []; st.seed = 1; st.msg = ''; newId(); }
      } else return;
      draw();
    });
    draw();
    return r;
  }

  /* ================= ckpersist ================= */
  var PM = [
    ['c1', 'First-party cookie', 'a cookie from the site you are on'],
    ['c3', 'Third-party cookie', 'a cookie from an embedded tracker'],
    ['ls', 'localStorage, IndexedDB', 'identifiers kept in browser storage'],
    ['fp', 'Browser fingerprint', 'device and browser details combined'],
    ['id', 'Account or email', 'who you tell the site you are'],
    ['ip', 'IP address, network', 'where your traffic comes from']
  ];
  var PA = [
    ['clear', 'Clear cookies'],
    ['site', 'Clear all site data'],
    ['priv', 'Private window'],
    ['prot', 'Safari or Firefox default protections'],
    ['other', 'Switch to another browser'],
    ['vpn', 'VPN or another network']
  ];
  // value: s survives, p partly, g gone
  var PV = {
    c1: { clear: ['g', 'The cookie is deleted. The next visit gets a new ID.'], site: ['g', 'Deleted along with everything else the site stored.'], priv: ['g', 'A private window starts with an empty jar and throws it away when it closes.'], prot: ['p', 'Kept, but Safari shortens the life of cookies written by scripts, and ignores them from sites it classifies as trackers.'], other: ['g', 'Each browser has its own jar. This cookie stays behind.'], vpn: ['s', 'The cookie is in your browser. A different network does not touch it.'] },
    c3: { clear: ['g', 'Deleted with the other cookies.'], site: ['g', 'Deleted.'], priv: ['g', 'An empty jar again.'], prot: ['g', 'Blocked in Safari, partitioned in Firefox: the tracker cannot read the same cookie on two sites.'], other: ['g', 'Another browser, another jar.'], vpn: ['s', 'The cookie is in your browser.'] },
    ls: { clear: ['s', 'Deleting only cookies leaves localStorage and IndexedDB in place. Trackers know this and copy their ID there ("respawning").'], site: ['g', 'This is the setting that clears storage too.'], priv: ['g', 'Discarded when the window closes.'], prot: ['p', 'Safari deletes script-writable storage of sites you have not interacted with after about a week; Firefox partitions it.'], other: ['g', 'Per browser.'], vpn: ['s', 'It is stored in your browser.'] },
    fp: { clear: ['s', 'A fingerprint is not stored on your computer. It is recomputed from your device on every visit.'], site: ['s', 'Nothing was stored, so nothing was deleted.'], priv: ['p', 'Mostly the same hardware and settings. Some browsers add noise in private mode.'], prot: ['p', 'In their stricter modes Safari and Firefox reduce the details a page can read and can add noise to the hardest ones (canvas, audio), but do not remove them.'], other: ['p', 'A different browser looks different, but a tracker can still match hardware, screen and time zone.'], vpn: ['s', 'The device and browser are unchanged.'] },
    id: { clear: ['s', 'The site knows your account from your login, not your cookie. Log in again and the history is joined back.'], site: ['s', 'Same: logging in re-links the new session to the account.'], priv: ['s', 'Logging in inside a private window still tells the site who you are.'], prot: ['s', 'Anti-tracking cannot stop a site learning what you type into it.'], other: ['s', 'The account follows you to any browser or device.'], vpn: ['s', 'Your account does not care where you connect from.'] },
    ip: { clear: ['s', 'Not stored in the browser.'], site: ['s', 'Not stored in the browser.'], priv: ['s', 'A private window uses the same network.'], prot: ['p', 'Not hidden by default. Services such as iCloud Private Relay or a VPN hide it.'], other: ['s', 'Same network, same address.'], vpn: ['g', 'The site sees the VPN’s address. (A residential address can still be shared by a whole household, so on its own it is a weak identifier.)'] }
  };
  var PCLS = { s: ['bad', 'still tracks'], p: ['warn', 'partly'], g: ['ok', 'stops it'] };
  function persist() {
    var r = wrap('Does deleting cookies end tracking?', 'Each row is a way to recognise you. Each column is something you can do. Click a cell for the reason.');
    var st = { sel: ['c1', 'clear'] };
    var out = h('div', {});
    r.appendChild(out);
    function draw() {
      var head = '<tr><th scope="col">Recognised by…</th>' + PA.map(function (a) { return '<th scope="col">' + esc(a[1]) + '</th>'; }).join('') + '</tr>';
      var body = PM.map(function (m) {
        return '<tr><th scope="row">' + esc(m[1]) + '<small>' + esc(m[2]) + '</small></th>' + PA.map(function (a) {
          var v = PV[m[0]][a[0]], c = PCLS[v[0]], on = st.sel[0] === m[0] && st.sel[1] === a[0];
          return '<td><button type="button" class="ck-cell ck-' + c[0] + (on ? ' on' : '') + '" data-m="' + m[0] + '" data-a="' + a[0] + '" aria-pressed="' + on + '" aria-label="' + esc(m[1] + ', ' + a[1] + ': ' + c[1]) + '"><i aria-hidden="true">' + (v[0] === 's' ? '●' : v[0] === 'p' ? '◐' : '○') + '</i><span>' + esc(c[1]) + '</span></button></td>';
        }).join('') + '</tr>';
      }).join('');
      var m = PM.filter(function (x) { return x[0] === st.sel[0]; })[0], a = PA.filter(function (x) { return x[0] === st.sel[1]; })[0], v = PV[st.sel[0]][st.sel[1]];
      out.innerHTML = '<div class="ck-scroll"><table class="ck-t ck-mx"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
        '<div class="ck-verdict ck-' + PCLS[v[0]][0] + '" aria-live="polite"><b>' + esc(m[1]) + ' · ' + esc(a[1]) + '</b><span>' + esc(v[1]) + '</span></div>' +
        '<p class="ck-fine ck-dim">Read across the first column: cookies are the easiest thing to remove and the least of the problem. Read down the account row: it never goes away, because you are the one who tells them.</p>';
    }
    out.addEventListener('click', function (e) { var b = e.target.closest('.ck-cell'); if (!b) return; st.sel = [b.getAttribute('data-m'), b.getAttribute('data-a')]; draw(); var nb = out.querySelector('.ck-cell.on'); if (nb) nb.focus(); });
    draw();
    return r;
  }

  /* ================= ckfinger ================= */
  var FP = (function () {
    var R = null, N = 100000, P = null;
    var DEV = [['Windows PC', 44], ['Mac', 17], ['iPhone', 17], ['Android phone', 18], ['Linux PC', 4]];
    var BR = { 'Windows PC': [['Chrome', 70], ['Edge', 14], ['Firefox', 9], ['Other', 7]], 'Mac': [['Safari', 50], ['Chrome', 38], ['Firefox', 6], ['Other', 6]], 'iPhone': [['Safari', 88], ['Chrome', 8], ['Other', 4]], 'Android phone': [['Chrome', 82], ['Samsung Internet', 12], ['Firefox', 3], ['Other', 3]], 'Linux PC': [['Firefox', 40], ['Chrome', 50], ['Other', 10]] };
    var SC = { 'Windows PC': [['1920×1080', 38], ['1536×864', 22], ['1366×768', 12], ['2560×1440', 12], ['1280×720', 6], ['3840×2160', 10]], 'Mac': [['1440×900', 30], ['1512×982', 25], ['1728×1117', 20], ['2560×1440', 10], ['1920×1080', 8], ['1470×956', 7]], 'iPhone': [['390×844', 35], ['393×852', 30], ['430×932', 20], ['375×812', 10], ['428×926', 5]], 'Android phone': [['412×915', 30], ['360×800', 28], ['393×873', 20], ['384×854', 12], ['414×896', 10]], 'Linux PC': [['1920×1080', 50], ['2560×1440', 20], ['1366×768', 15], ['3840×2160', 15]] };
    var TZ = [['America/New_York', 14], ['America/Chicago', 8], ['America/Los_Angeles', 10], ['Europe/London', 9], ['Europe/Berlin', 9], ['Europe/Paris', 6], ['Asia/Kolkata', 12], ['Asia/Tokyo', 6], ['America/Sao_Paulo', 8], ['Australia/Sydney', 3], ['Asia/Shanghai', 10], ['Africa/Lagos', 5]];
    var LG = [['en-US', 40], ['en-GB', 8], ['de-DE', 6], ['fr-FR', 5], ['es-ES', 6], ['pt-BR', 7], ['ja-JP', 4], ['hi-IN', 6], ['zh-CN', 8], ['other', 10]];
    var VAR = { 'Windows PC': [50, 40], 'Mac': [20, 12], 'iPhone': [3, 4], 'Android phone': [15, 30], 'Linux PC': [60, 40] };   // font sets, canvas renderings
    function pick(list) { var t = 0, i; list.forEach(function (x) { t += x[1]; }); var x = R() * t; for (i = 0; i < list.length; i++) { x -= list[i][1]; if (x < 0) return i; } return list.length - 1; }
    function zipf(n) { var t = 0, i, x; for (i = 1; i <= n; i++) t += 1 / Math.pow(i, 1.1); x = R() * t; for (i = 1; i <= n; i++) { x -= 1 / Math.pow(i, 1.1); if (x < 0) return i; } return n; }
    function build() {
      if (P) return P;
      R = U().rng(20261123); P = [];
      for (var i = 0; i < N; i++) {
        var d = pick(DEV), dn = DEV[d][0];
        P.push({ dev: dn, br: BR[dn][pick(BR[dn])][0], sc: SC[dn][pick(SC[dn])][0], tz: TZ[pick(TZ)][0], lg: LG[pick(LG)][0], ft: zipf(VAR[dn][0]), cv: zipf(VAR[dn][1]) });
      }
      return P;
    }
    return { N: N, DEV: DEV, BR: BR, SC: SC, TZ: TZ, LG: LG, VAR: VAR, build: build };
  })();
  function real() {
    var o = [];
    try { o.push(['Browser and OS', navigator.userAgent]); } catch (e) { }
    try { o.push(['Screen', screen.width + '×' + screen.height + ' at ' + (window.devicePixelRatio || 1) + 'x']); } catch (e) { }
    try { o.push(['Time zone', Intl.DateTimeFormat().resolvedOptions().timeZone]); } catch (e) { }
    try { o.push(['Language', (navigator.languages || [navigator.language]).join(', ')]); } catch (e) { }
    try { o.push(['CPU threads', String(navigator.hardwareConcurrency || 'hidden')]); } catch (e) { }
    return o;
  }
  var FP_ORDER = [['dev', 'device'], ['br', 'browser'], ['sc', 'screen size'], ['tz', 'time zone'], ['lg', 'language'], ['ft', 'installed fonts'], ['cv', 'graphics rendering']];
  function finger() {
    var r = wrap('One browser in a crowd', 'A made-up population of 100,000 browsers. Choose what yours looks like, then add the details a web page can read, one at a time, and watch the crowd shrink.');
    var st = { dev: 'Mac', br: 'Safari', sc: '1440×900', tz: 'America/New_York', lg: 'en-US', ft: 1, cv: 1, use: { dev: true } };
    var ctl = h('div', { class: 'ck-form' }), out = h('div', { class: 'ck-out', 'aria-live': 'polite' }), rl = h('details', { class: 'rv' });
    r.appendChild(ctl); r.appendChild(out); r.appendChild(rl);
    function opts(list, cur) { return list.map(function (x) { return '<option' + (String(x[0] === undefined ? x : x[0]) === String(cur) ? ' selected' : '') + '>' + esc(x[0] === undefined ? x : x[0]) + '</option>'; }).join(''); }
    function rankOpts(cur) { return [1, 5, 15].map(function (k) { return '<option value="' + k + '"' + (k === +cur ? ' selected' : '') + '>' + (k === 1 ? 'most common' : k === 5 ? 'fairly common' : 'unusual') + ' (#' + k + ')</option>'; }).join(''); }
    function draw() {
      if (FP.BR[st.dev].map(function (x) { return x[0]; }).indexOf(st.br) < 0) st.br = FP.BR[st.dev][0][0];
      if (FP.SC[st.dev].map(function (x) { return x[0]; }).indexOf(st.sc) < 0) st.sc = FP.SC[st.dev][0][0];
      ctl.innerHTML = '<label>Device<select data-k="dev">' + opts(FP.DEV, st.dev) + '</select></label><label>Browser<select data-k="br">' + opts(FP.BR[st.dev], st.br) + '</select></label><label>Screen<select data-k="sc">' + opts(FP.SC[st.dev], st.sc) + '</select></label>' +
        '<label>Time zone<select data-k="tz">' + opts(FP.TZ, st.tz) + '</select></label><label>Language<select data-k="lg">' + opts(FP.LG, st.lg) + '</select></label>' +
        '<label>Font set<select data-k="ft">' + rankOpts(st.ft) + '</select></label><label>Graphics rendering<select data-k="cv">' + rankOpts(st.cv) + '</select></label>';
      var P = FP.build(), cand = P, rows = [['Everyone', FP.N, null]];
      FP_ORDER.forEach(function (o) {
        if (!st.use[o[0]]) return;
        var v = o[0] === 'ft' ? Math.min(+st.ft, FP.VAR[st.dev][0]) : o[0] === 'cv' ? Math.min(+st.cv, FP.VAR[st.dev][1]) : st[o[0]];
        cand = cand.filter(function (p) { return p[o[0]] === v; });
        rows.push([o[1], cand.length, o[0]]);
      });
      var left = cand.length, bits = Math.log(FP.N / (left + 1)) / Math.LN2;
      out.innerHTML = '<div class="ck-row"><span class="ck-lab">Include</span>' + FP_ORDER.map(function (o) { return '<label class="ck-chk"><input type="checkbox" data-u="' + o[0] + '"' + (st.use[o[0]] ? ' checked' : '') + '> ' + esc(o[1]) + '</label>'; }).join('') + '</div>' +
        '<div class="ck-funnel">' + rows.map(function (x) {
          var w = x[1] <= 0 ? 0 : Math.max(2, Math.round(100 * Math.log(x[1] + 1) / Math.log(FP.N + 1)));
          return '<div class="ck-fr"><span class="ck-fl">' + (x[2] ? '+ ' : '') + esc(x[0]) + '</span><span class="ck-ft" aria-hidden="true"><i style="width:' + w + '%"></i></span><span class="ck-fn">' + fmt(x[1]) + '</span></div>';
        }).join('') + '</div>' +
        '<p class="ck-verdict ' + (left === 0 ? 'ck-bad' : left < 50 ? 'ck-warn' : 'ck-ok') + '"><b>' + (left === 0 ? 'unique' : fmt(left) + (left === 1 ? ' other' : ' others') + ' like you') + '</b><span>' + (left === 0 ? 'Nobody else in this population matches. A tracker could recognise this browser without a single cookie.' : left < 50 ? 'Only ' + left + ' other' + (left === 1 ? '' : 's') + ' match. Add one more detail and you are probably alone.' : 'You are still hiding in a crowd of ' + fmt(left + 1) + '. Add more details to see how fast that changes.') + ' About ' + bits.toFixed(1) + ' bits of identity revealed (a crowd of 100,000 needs about 16.6 to pick one browser out).</span></p>' +
        '<p class="ck-fine ck-dim">The population is invented and its attributes are independent, which real ones are not. Real fingerprinting studies, such as the EFF’s Cover Your Tracks, find that most real browsers are distinguishable. Use the lab for the shape of the curve, not the exact numbers.</p>';
      var rv = real();
      rl.innerHTML = '<summary>What this browser tells every page it opens, right now</summary><dl class="ck-dl">' + rv.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl><p class="ck-fine ck-dim">Read locally by this page. Nothing is sent anywhere.</p>';
    }
    ctl.addEventListener('change', function (e) { var k = e.target.getAttribute('data-k'); if (!k) return; st[k] = e.target.value; draw(); });
    out.addEventListener('change', function (e) {
      var u = e.target.getAttribute('data-u'); if (!u) return;
      var on = e.target.checked; st.use[u] = on; draw();
    });
    draw();
    return r;
  }

  /* ================= cksort ================= */
  var CATS = [['nec', 'Strictly necessary'], ['pref', 'Preferences'], ['ana', 'Analytics'], ['ads', 'Advertising']];
  var WHO = { site: 'The site itself', ana: 'An analytics company', ads: 'An ad network', vendor: 'A security, payment or consent vendor' };
  var JAR = [
    { n: 'sessionid', from: 'shop.example', life: 'session', cat: 'nec', who: 'site', why: 'Keeps you logged in. Without it every page would ask for your password again.' },
    { n: 'cart_token', from: 'shop.example', life: '14 days', cat: 'nec', who: 'site', why: 'Remembers what is in your basket. You asked for that by adding the items.' },
    { n: 'theme=dark', from: 'shop.example', life: '1 year', cat: 'pref', who: 'site', why: 'Remembers a choice you made. Convenient, not required for the page to work.' },
    { n: '_ga', from: 'shop.example (written by the Google Analytics script)', life: 'up to 400 days', cat: 'ana', who: 'ana', why: 'A random visitor ID so Google Analytics can count visitors and return visits. It is a first-party cookie, set by a third party’s code.' },
    { n: '_fbp', from: 'shop.example (written by the Meta Pixel)', life: '90 days', cat: 'ads', who: 'ads', why: 'Lets Meta match a visit to your shop with an ad you saw or clicked on its platforms.' },
    { n: 'IDE', from: 'doubleclick.net (third party)', life: 'about 13 months', cat: 'ads', who: 'ads', why: 'Google’s ad network ID. It follows you across every site that shows its ads, which is the textbook third-party tracking cookie.' },
    { n: '__cf_bm', from: 'shop.example (set by Cloudflare)', life: '30 minutes', cat: 'nec', who: 'vendor', why: 'Helps Cloudflare tell bots from people so that the site stays up. Short-lived and for security.' },
    { n: 'csrftoken', from: 'bank.example', life: 'about a year', cat: 'nec', who: 'site', why: 'Protects forms against forged cross-site requests. A security feature, not a tracker.' },
    { n: 'OptanonConsent', from: 'news.example (set by a consent banner)', life: '1 year', cat: 'nec', who: 'vendor', why: 'Remembers your answer to the cookie banner. Without it, the banner would ask on every page.' },
    { n: '_hjSessionUser_1234567', from: 'shop.example (set by Hotjar)', life: '1 year', cat: 'ana', who: 'ana', why: 'Identifies you to a tool that records sessions and heatmaps of what visitors click. Analytics, and a more intrusive kind.' },
    { n: 'lang=de', from: 'news.example', life: '1 year', cat: 'pref', who: 'site', why: 'Your language choice. A preference.' },
    { n: '__stripe_mid', from: 'shop.example (set by Stripe)', life: '1 year', cat: 'nec', who: 'vendor', why: 'Used by the payment provider for fraud prevention. Usually classed as necessary because paying safely depends on it.' },
    { n: '_gcl_au', from: 'shop.example (set by Google Ads)', life: '90 days', cat: 'ads', who: 'ads', why: 'Links a purchase on the shop back to the Google ad that led to it (conversion tracking).' },
    { n: 'ajs_anonymous_id', from: 'shop.example (set by Segment)', life: '1 year', cat: 'ana', who: 'ana', why: 'An ID used by a customer-data platform to group a visitor’s events and forward them to other tools.' }
  ];
  function sorter() {
    var r = wrap('Who baked this cookie?', 'Real cookie names from real sites. Decide what each is for. Names and lifetimes are typical and vendors change them, so treat the answers as the common classification.');
    var st = { i: 0, score: 0, ans: [], shown: false };
    var out = h('div', { 'aria-live': 'polite' });
    r.appendChild(out);
    function draw() {
      if (st.i >= JAR.length) {
        var by = {}; JAR.forEach(function (c) { by[c.who] = (by[c.who] || 0) + 1; });
        out.innerHTML = '<div class="ck-verdict ' + (st.score >= 11 ? 'ck-ok' : 'ck-warn') + '"><b>' + st.score + ' of ' + JAR.length + '</b><span>' + (st.score >= 11 ? 'You can tell a login cookie from a tracker.' : 'Cookie names are cryptic. The giveaways: who sets it (the site or someone else), how long it lives, and whether the page breaks without it.') + '</span></div>' +
          '<h6 class="ck-h6">Who actually uses these cookies</h6><div class="ck-funnel">' + Object.keys(WHO).map(function (k) {
            return '<div class="ck-fr"><span class="ck-fl">' + esc(WHO[k]) + '</span><span class="ck-ft" aria-hidden="true"><i style="width:' + Math.round(100 * (by[k] || 0) / 6) + '%"></i></span><span class="ck-fn">' + (by[k] || 0) + '</span></div>';
          }).join('') + '</div><p class="ck-fine">In the EU and UK, cookies that are not strictly necessary need your consent before they are set. That is why banners offer to reject analytics and advertising while the first group simply works. Elsewhere the rules differ (California, for example, lets you opt out of the sale or sharing of your data).</p>' +
          '<div class="ck-btns"><button type="button" class="chip" data-a="again">Play again</button></div>';
        return;
      }
      var c = JAR[st.i], a = st.ans[st.i];
      out.innerHTML = '<div class="ck-sorter"><div class="ck-sc"><span class="ck-dim">' + (st.i + 1) + ' of ' + JAR.length + ' · score ' + st.score + '</span></div>' +
        '<div class="ck-ticket"><code class="ck-tn">' + esc(c.n) + '</code><dl><dt>Set by</dt><dd>' + esc(c.from) + '</dd><dt>Lives</dt><dd>' + esc(c.life) + '</dd></dl></div>' +
        '<div class="ck-btns" role="group" aria-label="What is this cookie for?">' + CATS.map(function (k) {
          var cls = a ? (k[0] === c.cat ? ' ck-right' : a === k[0] ? ' ck-wrong' : '') : '';
          return '<button type="button" class="chip' + cls + '" data-c="' + k[0] + '"' + (a ? ' disabled' : '') + '>' + esc(k[1]) + '</button>';
        }).join('') + '</div>' +
        (a ? '<div class="ck-verdict ' + (a === c.cat ? 'ck-ok' : 'ck-bad') + '"><b>' + (a === c.cat ? 'Right' : 'Not quite') + ': ' + esc(CATS.filter(function (k) { return k[0] === c.cat; })[0][1]) + '</b><span>' + esc(c.why) + ' <i>Used by: ' + esc(WHO[c.who]) + '.</i></span></div><div class="ck-btns"><button type="button" class="chip" data-a="next">' + (st.i + 1 === JAR.length ? 'See the result' : 'Next cookie') + '</button></div>' : '') + '</div>';
      var nb = out.querySelector('[data-a=next]'); if (nb) nb.focus();
    }
    out.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-c')) { var v = b.getAttribute('data-c'); st.ans[st.i] = v; if (v === JAR[st.i].cat) st.score++; }
      else if (b.getAttribute('data-a') === 'next') st.i++;
      else if (b.getAttribute('data-a') === 'again') { st.i = 0; st.score = 0; st.ans = []; }
      else return;
      draw();
    });
    draw();
    return r;
  }

  W.cktrack = track; W.ckprofile = profile; W.ckpersist = persist; W.ckfinger = finger; W.cksort = sorter;
  window.__ckfp = FP;   // exposed for tests
})();
