/* Servers, APIs & Cloud widgets, part 4: VPC reachability lab and an IAM policy tester. */
(function () {
  'use strict';
  var K = window.__core, $ = K.$, $$ = K.$$, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};
  function wg(title, sub, dom) { var r = h('div', { class: 'wg sv' }); r.style.setProperty('--dom', 'var(--c-' + (dom || 'srv') + ')'); r.innerHTML = '<h4>' + esc(title) + '</h4>' + (sub ? '<p class="sub">' + sub + '</p>' : ''); return r; }
  function addBody(r, html) { var d = h('div', { html: html }); r.appendChild(d); return d; }
  function ip2n(ip) { var p = String(ip).trim().split('.'); if (p.length !== 4 || p.some(function (x) { return !/^\d{1,3}$/.test(x) || +x > 255; })) return null; return ((+p[0] << 24) >>> 0) + (+p[1] << 16) + (+p[2] << 8) + +p[3]; }
  function inCidr(ip, cidr) { var m = /^([\d.]+)(?:\/(\d{1,2}))?$/.exec(String(cidr).trim()); if (!m) return false; var a = ip2n(ip), n = ip2n(m[1]), bits = m[2] === undefined ? 32 : +m[2]; if (a === null || n === null || bits > 32) return false; var mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0; return ((a & mask) >>> 0) === ((n & mask) >>> 0); }

  /* ---------------- VPC reachability ---------------- */
  var NODES = {
    visitor: { label: 'a visitor', ip: '198.51.100.20', net: true },
    me: { label: 'your laptop', ip: '203.0.113.7', net: true },
    attacker: { label: 'a scanner', ip: '192.0.2.66', net: true },
    web: { label: 'web', ip: '10.0.1.10', sub: 'public', sg: 'web-sg' },
    db: { label: 'db', ip: '10.0.2.20', sub: 'private', sg: 'db-sg' },
    api: { label: 'an internet API', ip: '93.184.215.14', net: true }
  };
  var RULES = {
    'web-sg': [['https', 443, '0.0.0.0/0', 'HTTPS from anywhere', true], ['http', 80, '0.0.0.0/0', 'HTTP from anywhere', false], ['sshme', 22, '203.0.113.7/32', 'SSH from your IP only', true], ['sshany', 22, '0.0.0.0/0', 'SSH from anywhere', false]],
    'db-sg': [['pgweb', 5432, 'web-sg', 'Postgres from web-sg', true], ['pgvpc', 5432, '10.0.0.0/16', 'Postgres from the whole VPC', false], ['pgany', 5432, '0.0.0.0/0', 'Postgres from anywhere', false]]
  };
  var TESTS = [['visitor', 'web', 443, 'A visitor opens the website'], ['me', 'web', 22, 'You SSH into web'], ['attacker', 'web', 22, 'A scanner tries SSH on web'], ['attacker', 'db', 5432, 'A scanner tries the database'], ['web', 'db', 5432, 'web queries the database'], ['db', 'api', 443, 'db downloads security updates'], ['web', 'api', 443, 'web calls an outside API']];
  function evalPath(st, s, d, port) {
    var S = NODES[s], D = NODES[d], tr = [];
    function sgAllows(node, from) {
      var rules = RULES[node.sg].filter(function (x) { return st.rules[x[0]] && x[1] === port; });
      for (var i = 0; i < rules.length; i++) { var src = rules[i][2]; if (src === from.sg || (src.indexOf('/') > 0 && inCidr(from.ip, src))) return rules[i]; }
      return null;
    }
    function rtToNet(sub) { return sub === 'public' ? st.igw : st.nat && st.igw; }
    if (S.net && !D.net) {
      var pub = d === 'web' ? st.webIp : st.dbIp;
      if (!pub) { tr.push(['✗', D.label + ' has no public IP, so nothing on the internet can even address it.']); return { ok: false, tr: tr }; }
      tr.push(['✓', D.label + ' has a public IP, mapped by the internet gateway to ' + D.ip + '.']);
      var hasIgw = D.sub === 'public' ? st.igw : false;
      if (!hasIgw) { tr.push(['✗', 'The ' + D.sub + ' subnet\'s route table has no <code>0.0.0.0/0 → igw</code> route, so traffic cannot enter or return through the internet gateway. A public IP alone is not enough.']); return { ok: false, tr: tr }; }
      tr.push(['✓', 'The ' + D.sub + ' subnet routes <code>0.0.0.0/0</code> to the internet gateway.']);
      var rule = sgAllows(D, S);
      if (!rule) { tr.push(['✗', D.sg + ' has no inbound rule for TCP ' + port + ' from ' + S.ip + '. Security groups deny by default, and the packet is silently dropped (the client sees a timeout).']); return { ok: false, tr: tr }; }
      tr.push(['✓', D.sg + ' allows TCP ' + port + ' from <code>' + esc(rule[2]) + '</code> (' + esc(rule[3]) + '). Replies are allowed automatically: security groups are stateful.']);
      return { ok: true, tr: tr };
    }
    if (!S.net && !D.net) {
      tr.push(['✓', 'Both are in the VPC (10.0.0.0/16). Every route table has a <code>local</code> route for the VPC range, so ' + S.ip + ' reaches ' + D.ip + ' directly.']);
      tr.push(['✓', S.sg + ' allows all outbound traffic (the default).']);
      var r2 = sgAllows(D, S);
      if (!r2) { tr.push(['✗', D.sg + ' has no inbound rule for TCP ' + port + ' from ' + S.sg + ' or ' + S.ip + '.']); return { ok: false, tr: tr }; }
      tr.push(['✓', D.sg + ' allows TCP ' + port + ' from <code>' + esc(r2[2]) + '</code>' + (r2[2] === S.sg ? ', meaning any instance that carries ' + S.sg + ', whatever its IP.' : '.')]);
      return { ok: true, tr: tr };
    }
    if (!S.net && D.net) {
      tr.push(['✓', S.sg + ' allows all outbound traffic (the default).']);
      if (S.sub === 'public') {
        if (!st.igw) { tr.push(['✗', 'The public subnet has no <code>0.0.0.0/0 → igw</code> route.']); return { ok: false, tr: tr }; }
        if (!st.webIp) { tr.push(['✗', S.label + ' has no public IP, and the internet gateway only translates for instances that have one.']); return { ok: false, tr: tr }; }
        tr.push(['✓', 'Out through the internet gateway, using ' + S.label + '\'s public IP.']);
        return { ok: true, tr: tr };
      }
      if (!st.nat) { tr.push(['✗', 'The private subnet\'s route table has no <code>0.0.0.0/0 → nat</code> route, so there is no way out. ' + (st.dbIp ? 'Its public IP does not help: the subnet does not route to the internet gateway.' : '')]); return { ok: false, tr: tr }; }
      tr.push(['✓', 'The private subnet sends <code>0.0.0.0/0</code> to the NAT gateway, which lives in the public subnet.']);
      if (!st.igw) { tr.push(['✗', 'The NAT gateway itself needs the public subnet\'s <code>0.0.0.0/0 → igw</code> route, which is off.']); return { ok: false, tr: tr }; }
      tr.push(['✓', 'The NAT gateway forwards it out through the internet gateway. Replies come back, but nobody outside can start a connection to ' + S.label + '.']);
      return { ok: true, tr: tr };
    }
    return { ok: false, tr: [['✗', 'not modelled']] };
  }
  W.vpclab = function () {
    var r = wg('VPC lab: who can reach what?', 'A small cloud network: a public subnet with a web server and a NAT gateway, a private subnet with a database. Toggle routes, public IPs and security-group rules, and the seven connection tests update. Aim for: the website and your SSH work, the database is reachable only from web, and nothing else is open.');
    var st = { igw: true, nat: true, webIp: true, dbIp: false, rules: {} };
    Object.keys(RULES).forEach(function (g) { RULES[g].forEach(function (x) { st.rules[x[0]] = x[4]; }); });
    var b = addBody(r,
      '<div class="vp-map" id="map"></div>' +
      '<div class="vp-ctl"><fieldset><legend>Route tables</legend><label><input type="checkbox" data-s="igw"> public: <code>0.0.0.0/0 → igw</code></label><label><input type="checkbox" data-s="nat"> private: <code>0.0.0.0/0 → nat</code></label></fieldset>' +
      '<fieldset><legend>Public IPs</legend><label><input type="checkbox" data-s="webIp"> web</label><label><input type="checkbox" data-s="dbIp"> db</label></fieldset>' +
      Object.keys(RULES).map(function (g) { return '<fieldset><legend>' + g + ' inbound</legend>' + RULES[g].map(function (x) { return '<label><input type="checkbox" data-r="' + x[0] + '"> TCP ' + x[1] + ' from <code>' + x[2] + '</code></label>'; }).join('') + '</fieldset>'; }).join('') + '</div>' +
      '<div class="vp-tests" id="tests"></div><div class="vp-find" id="find"></div>');
    function sync() { $$('[data-s]', b).forEach(function (c) { c.checked = !!st[c.getAttribute('data-s')]; }); $$('[data-r]', b).forEach(function (c) { c.checked = !!st.rules[c.getAttribute('data-r')]; }); }
    function draw() {
      $('#map', b).innerHTML = '<div class="vp-net">Internet</div><div class="vp-igw' + (st.igw ? '' : ' off') + '">internet gateway</div>' +
        '<div class="vp-vpc"><span class="vp-t">VPC 10.0.0.0/16</span><div class="vp-sub pub"><span class="vp-t">public subnet 10.0.1.0/24</span><div class="vp-i">web<small>10.0.1.10' + (st.webIp ? ' · public IP' : '') + '</small><small>web-sg</small></div><div class="vp-i nat">NAT gateway</div></div>' +
        '<div class="vp-sub prv"><span class="vp-t">private subnet 10.0.2.0/24</span><div class="vp-i">db<small>10.0.2.20' + (st.dbIp ? ' · public IP' : '') + '</small><small>db-sg</small></div></div></div>';
      var goal = { 0: true, 1: true, 2: false, 3: false, 4: true, 5: true, 6: true }, good = 0;
      $('#tests', b).innerHTML = TESTS.map(function (t, i) {
        var res = evalPath(st, t[0], t[1], t[2]), want = goal[i]; if (res.ok === want) good++;
        return '<details class="vp-t' + (res.ok ? ' ok' : ' no') + (res.ok === want ? '' : ' miss') + '"><summary><span class="vp-r">' + (res.ok ? '✓ connects' : '✗ blocked') + '</span>' + esc(t[3]) + ' <code>' + NODES[t[0]].ip + ' → ' + (NODES[t[1]].ip) + ':' + t[2] + '</code>' + (res.ok === want ? '' : '<span class="vp-w">' + (want ? 'should work' : 'should be blocked') + '</span>') + '</summary><ol>' + res.tr.map(function (x) { return '<li><b>' + x[0] + '</b> ' + x[1] + '</li>'; }).join('') + '</ol></details>';
      }).join('');
      var f = [];
      if (st.rules.sshany) f.push('SSH is open to the whole internet. Automated scanners find port 22 within minutes and start guessing passwords. Keep it to your own IP, or use a bastion or the provider\'s session manager.');
      if (st.rules.pgany) f.push('db-sg allows Postgres from <code>0.0.0.0/0</code>. Today the private subnet saves you, but one routing change would expose the database. Rules should say who, not "anyone".');
      if (st.dbIp) f.push('db has a public IP it does not need. Remove it: an address nobody can route to is still an address that can be attached to a mistake later.');
      if (st.rules.http) f.push('Port 80 is open. That is fine if it only redirects to HTTPS.');
      $('#find', b).innerHTML = '<div class="vp-score"><b>' + good + ' / 7</b> tests match the goal' + (good === 7 && !f.length ? ' with nothing extra open. Well locked down.' : '.') + '</div>' + (f.length ? '<ul>' + f.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '');
    }
    b.addEventListener('change', function (e) { var s = e.target.getAttribute('data-s'), k = e.target.getAttribute('data-r'); if (s) st[s] = e.target.checked; if (k) st.rules[k] = e.target.checked; draw(); });
    sync(); draw();
    return r;
  };

  /* ---------------- IAM policy tester ---------------- */
  function wild(p, v, ci) { var re = new RegExp('^' + String(p).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', ci ? 'i' : ''); return re.test(v); }
  function arr(x) { return x === undefined ? [] : Array.isArray(x) ? x : [x]; }
  function condOk(cond, ctx, notes) {
    var ok = true;
    Object.keys(cond || {}).forEach(function (op) {
      Object.keys(cond[op]).forEach(function (key) {
        var want = arr(cond[op][key]).map(String), has = Object.prototype.hasOwnProperty.call(ctx, key.toLowerCase()), v = has ? String(ctx[key.toLowerCase()]) : undefined, res;
        var neg = /Not/.test(op), base = op.replace(/IfExists$/, '');
        if (!has) res = neg || /IfExists$/.test(op);
        else if (base === 'StringEquals' || base === 'Bool') res = want.indexOf(v) >= 0;
        else if (base === 'StringNotEquals') res = want.indexOf(v) < 0;
        else if (base === 'StringEqualsIgnoreCase') res = want.some(function (w) { return w.toLowerCase() === v.toLowerCase(); });
        else if (base === 'StringLike') res = want.some(function (w) { return wild(w, v); });
        else if (base === 'StringNotLike') res = !want.some(function (w) { return wild(w, v); });
        else if (base === 'IpAddress') res = want.some(function (w) { return inCidr(v, w); });
        else if (base === 'NotIpAddress') res = !want.some(function (w) { return inCidr(v, w); });
        else { notes.push('operator ' + op + ' is not supported by this tester, treated as not matching'); res = false; }
        notes.push('<code>' + esc(op) + '</code> <code>' + esc(key) + '</code> ' + (has ? 'is <code>' + esc(v) + '</code>' : 'is absent') + ' → ' + (res ? 'true' : 'false'));
        if (!res) ok = false;
      });
    });
    return ok;
  }
  function evaluate(pols, req) {
    var ctx = { 'aws:sourceip': req.ip, 'aws:securetransport': req.tls ? 'true' : 'false', 'aws:multifactorauthpresent': req.mfa ? 'true' : 'false', 'aws:username': 'lab' }, lines = [], allow = false, deny = false;
    pols.forEach(function (p) {
      if (!p.doc) return;
      arr(p.doc.Statement).forEach(function (s, i) {
        var name = p.name + ' · ' + (s.Sid || 'statement ' + (i + 1)), why = [];
        if (p.resource) { var pr = s.Principal, pOk = pr === '*' || (pr && arr(pr.AWS).some(function (a) { return a === '*' || a === req.principal || a === 'arn:aws:iam::111122223333:root' || a === '111122223333'; })); if (!pOk) { lines.push([name, s.Effect, false, 'Principal does not include this user']); return; } }
        var aOk = s.Action !== undefined ? arr(s.Action).some(function (a) { return wild(a, req.action, true); }) : s.NotAction !== undefined ? !arr(s.NotAction).some(function (a) { return wild(a, req.action, true); }) : false;
        if (!aOk) { lines.push([name, s.Effect, false, 'action <code>' + esc(req.action) + '</code> not in ' + esc(JSON.stringify(s.Action || { NotAction: s.NotAction }))]); return; }
        var rOk = s.Resource !== undefined ? arr(s.Resource).some(function (x) { return wild(x, req.resource, false); }) : s.NotResource !== undefined ? !arr(s.NotResource).some(function (x) { return wild(x, req.resource, false); }) : !!p.resource;
        if (!rOk) { lines.push([name, s.Effect, false, 'resource not in ' + esc(JSON.stringify(s.Resource || { NotResource: s.NotResource }))]); return; }
        var cOk = condOk(s.Condition, ctx, why);
        if (!cOk) { lines.push([name, s.Effect, false, 'condition false: ' + why.join('; ')]); return; }
        lines.push([name, s.Effect, true, 'action and resource match' + (why.length ? '; ' + why.join('; ') : '')]);
        if (s.Effect === 'Deny') deny = true; else if (s.Effect === 'Allow') allow = true;
      });
    });
    return { decision: deny ? 'explicit-deny' : allow ? 'allow' : 'implicit-deny', lines: lines };
  }
  var IP = {
    readonly: ['Read one bucket', { Version: '2012-10-17', Statement: [{ Sid: 'ListTheBucket', Effect: 'Allow', Action: 's3:ListBucket', Resource: 'arn:aws:s3:::lab-reports' }, { Sid: 'ReadObjects', Effect: 'Allow', Action: ['s3:GetObject'], Resource: 'arn:aws:s3:::lab-reports/*' }] }, null],
    tls: ['Require TLS (bucket policy)', { Version: '2012-10-17', Statement: [{ Sid: 'AllS3', Effect: 'Allow', Action: 's3:*', Resource: ['arn:aws:s3:::lab-reports', 'arn:aws:s3:::lab-reports/*'] }] }, { Version: '2012-10-17', Statement: [{ Sid: 'DenyPlainHTTP', Effect: 'Deny', Principal: '*', Action: 's3:*', Resource: ['arn:aws:s3:::lab-reports', 'arn:aws:s3:::lab-reports/*'], Condition: { Bool: { 'aws:SecureTransport': 'false' } } }] }],
    office: ['Office network only', { Version: '2012-10-17', Statement: [{ Sid: 'FromOffice', Effect: 'Allow', Action: 's3:*', Resource: 'arn:aws:s3:::lab-reports/*', Condition: { IpAddress: { 'aws:SourceIp': '203.0.113.0/24' } } }] }, null],
    nodelete: ['Deny beats allow', { Version: '2012-10-17', Statement: [{ Sid: 'EverythingInS3', Effect: 'Allow', Action: 's3:*', Resource: '*' }, { Sid: 'ButNeverDelete', Effect: 'Deny', Action: ['s3:DeleteObject', 's3:DeleteBucket'], Resource: '*' }] }, null],
    star: ['Far too broad', { Version: '2012-10-17', Statement: [{ Sid: 'Admin', Effect: 'Allow', Action: '*', Resource: '*' }] }, null]
  };
  var REQ = [['s3:GetObject', 'arn:aws:s3:::lab-reports/2026/q3.csv'], ['s3:PutObject', 'arn:aws:s3:::lab-reports/2026/q4.csv'], ['s3:DeleteObject', 'arn:aws:s3:::lab-reports/2026/q3.csv'], ['s3:ListBucket', 'arn:aws:s3:::lab-reports'], ['s3:GetObject', 'arn:aws:s3:::payroll/2026.csv'], ['iam:CreateAccessKey', 'arn:aws:iam::111122223333:user/admin']];
  W.iamsim = function () {
    var r = wg('IAM policy tester', 'Write or pick a policy, describe a request, and see the decision with the reason for every statement. The rules are AWS\'s: anything not allowed is denied, and an explicit <code>Deny</code> always beats an <code>Allow</code>. This tester covers one account and a handful of condition operators.');
    var b = addBody(r,
      '<div class="xp-ex">' + Object.keys(IP).map(function (k) { return '<button class="chip" data-p="' + k + '">' + esc(IP[k][0]) + '</button>'; }).join('') + '</div>' +
      '<div class="iam-g"><label class="cl-l">Identity policy (attached to user <code>lab</code>)<textarea id="ip" rows="14" spellcheck="false" data-fixed></textarea></label><label class="cl-l">Bucket policy (optional, resource-based)<textarea id="rp" rows="14" spellcheck="false" data-fixed></textarea></label></div>' +
      '<div class="iam-req"><label class="cl-l">Action<input type="text" id="ac" spellcheck="false" autocomplete="off"></label><label class="cl-l">Resource ARN<input type="text" id="rs" spellcheck="false" autocomplete="off"></label><label class="cl-l">Source IP<input type="text" id="sip" value="203.0.113.7" spellcheck="false" autocomplete="off"></label><label class="iam-ck"><input type="checkbox" id="tls" checked> over TLS</label><label class="iam-ck"><input type="checkbox" id="mfa"> MFA</label></div>' +
      '<div class="xp-ex">' + REQ.map(function (x, i) { return '<button class="chip" data-q="' + i + '">' + esc(x[0]) + ' · ' + esc(x[1].replace('arn:aws:s3:::', '').replace('arn:aws:iam::111122223333:', '')) + '</button>'; }).join('') + '</div>' +
      '<div id="out" aria-live="polite"></div>');
    function setP(k) { $('#ip', b).value = JSON.stringify(IP[k][1], null, 2); $('#rp', b).value = IP[k][2] ? JSON.stringify(IP[k][2], null, 2) : ''; }
    function go() {
      var pols = [], err = '';
      [['ip', 'identity', false], ['rp', 'bucket', true]].forEach(function (x) { var t = $('#' + x[0], b).value.trim(); if (!t) return; try { pols.push({ name: x[1], doc: JSON.parse(t), resource: x[2] }); } catch (e) { err += '<p class="cl-bad">The ' + x[1] + ' policy is not valid JSON: ' + esc(e.message) + '</p>'; } });
      var req = { action: $('#ac', b).value.trim(), resource: $('#rs', b).value.trim(), ip: $('#sip', b).value.trim(), tls: $('#tls', b).checked, mfa: $('#mfa', b).checked, principal: 'arn:aws:iam::111122223333:user/lab' };
      var res = evaluate(pols, req), lab = { allow: ['ok', 'Allowed', 'At least one statement allows it and none denies it.'], 'explicit-deny': ['bad', 'Denied (explicit)', 'A matching Deny statement overrides every Allow.'], 'implicit-deny': ['bad', 'Denied (implicit)', 'No statement allows this request, so the default deny applies.'] }[res.decision];
      $('#out', b).innerHTML = err + '<div class="iam-d ' + lab[0] + '"><b>' + lab[1] + '</b><span>' + lab[2] + '</span></div><ul class="iam-tr">' + res.lines.map(function (l) { return '<li class="' + (l[2] ? (l[1] === 'Deny' ? 'dn' : 'al') : 'na') + '"><span class="iam-e">' + esc(l[1] || '?') + (l[2] ? ' · applies' : ' · skipped') + '</span><b>' + esc(l[0]) + '</b> ' + l[3] + '</li>'; }).join('') + '</ul>';
    }
    b.addEventListener('click', function (e) { var t = e.target.closest('[data-p],[data-q]'); if (!t) return; if (t.hasAttribute('data-p')) setP(t.getAttribute('data-p')); else { var q = REQ[+t.getAttribute('data-q')]; $('#ac', b).value = q[0]; $('#rs', b).value = q[1]; } go(); });
    b.addEventListener('input', go); b.addEventListener('change', go);
    setP('readonly'); $('#ac', b).value = REQ[0][0]; $('#rs', b).value = REQ[0][1]; go();
    return r;
  };
  (window.__srvTest = window.__srvTest || {}).iam = evaluate;
  window.__srvTest.vpc = function (st, s, d, p) { return evalPath(st, s, d, p).ok; };
})();
