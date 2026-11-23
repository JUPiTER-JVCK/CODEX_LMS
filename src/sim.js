
/* Simulated macOS-flavoured zsh over a virtual lab filesystem. Pure JS, no DOM: runs in the page and under Node (tools/simload.js). */
var SIM = (function () {
  'use strict';
  var HOME = '/Users/learner', NOW = new Date(2026, 9, 8, 9, 41, 0);
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- virtual file system ---------- */
  function FS(files) {
    this.n = { '/': { d: 1, m: NOW } };
    this.mk('/Users', 1); this.mk(HOME, 1); this.mk('/tmp', 1); this.mk('/dev', 1); this.mk('/usr', 1); this.mk('/usr/bin', 1); this.mk('/bin', 1);
    this.n['/dev/null'] = { f: '', m: NOW, dev: 1 };
    var self = this;
    Object.keys(files || {}).forEach(function (k) { self.write(HOME + '/lab/' + k, files[k], new Date(2026, 8, 14, 10, 22)); });
  }
  FS.prototype.mk = function (p, d) { this.n[p] = { d: 1, m: NOW }; };
  FS.prototype.norm = function (p, cwd) {
    if (p === '~' || p.slice(0, 2) === '~/') p = HOME + p.slice(1);
    if (p[0] !== '/') p = (cwd || '/') + '/' + p;
    var o = [];
    p.split('/').forEach(function (s) { if (!s || s === '.') return; if (s === '..') o.pop(); else o.push(s); });
    return '/' + o.join('/');
  };
  FS.prototype.get = function (p) { return this.n[p]; };
  FS.prototype.isDir = function (p) { var x = this.n[p]; return !!(x && x.d); };
  FS.prototype.isFile = function (p) { var x = this.n[p]; return !!(x && x.f !== undefined); };
  FS.prototype.read = function (p) { var x = this.n[p]; return x && x.f !== undefined ? x.f : null; };
  FS.prototype.mkdirp = function (p, m) {
    var parts = p.split('/').filter(Boolean), cur = '';
    for (var i = 0; i < parts.length; i++) { cur += '/' + parts[i]; if (!this.n[cur]) { this.mk(cur); if (m) this.n[cur].m = m; } }
  };
  FS.prototype.write = function (p, s, m) {
    var dir = p.replace(/\/[^\/]*$/, '') || '/';
    this.mkdirp(dir, m);
    if (p === '/dev/null') return;
    var x = this.n[p]; if (x && x.perm) { /* keep */ }
    this.n[p] = { f: s, m: m || NOW, perm: x && x.perm };
  };
  FS.prototype.list = function (p) {
    var pre = p === '/' ? '/' : p + '/', o = [];
    for (var k in this.n) if (k !== p && k.indexOf(pre) === 0 && k.indexOf('/', pre.length) < 0) o.push(k.slice(pre.length));
    return o.sort();
  };
  FS.prototype.rm = function (p) {
    var pre = p + '/'; for (var k in this.n) if (k === p || k.indexOf(pre) === 0) delete this.n[k];
  };
  FS.prototype.glob = function (pat, cwd) {
    var abs = pat[0] === '/'; var segs = pat.split('/').filter(function (s, i) { return s !== '' || i === 0; });
    if (pat.slice(0, 2) === '~/') { abs = true; segs = (HOME + pat.slice(1)).split('/').filter(Boolean); }
    else if (abs) segs = segs.filter(Boolean);
    var self = this, results = [abs ? '/' : ''];
    segs.forEach(function (seg, si) {
      var next = [];
      results.forEach(function (base) {
        var dir = base === '' ? cwd : base;
        if (!/[*?\[]/.test(seg.replace(/\\./g, ''))) {
          var cand = (base === '' ? '' : base === '/' ? '/' : base + '/') + seg.replace(/\\(.)/g, '$1');
          var ab = self.norm(cand, cwd); if (self.n[ab]) next.push(cand); return;
        }
        if (!self.isDir(self.norm(dir, cwd))) return;
        var re = globRe(seg), names = self.list(self.norm(dir, cwd));
        names.forEach(function (nm) {
          if (nm[0] === '.' && seg[0] !== '.') return;
          if (re.test(nm)) next.push((base === '' ? '' : base === '/' ? '/' : base + '/') + nm);
        });
      });
      results = next;
    });
    return results.sort();
  };
  function globRe(g) {
    var re = '^', i = 0;
    while (i < g.length) {
      var c = g[i];
      if (c === '\\') { re += esc(g[i + 1] || ''); i += 2; continue; }
      if (c === '*') re += '.*'; else if (c === '?') re += '.';
      else if (c === '[') { var j = g.indexOf(']', i + 2); if (j < 0) re += '\\['; else { var cls = g.slice(i + 1, j); if (cls[0] === '!') cls = '^' + cls.slice(1); re += '[' + cls.replace(/\\/g, '\\\\') + ']'; i = j; } }
      else re += esc(c);
      i++;
    }
    return new RegExp(re + '$');
  }
  function hasGlob(p) { return /[*?]|\[[^\]]+\]/.test(p.replace(/\\./g, '')); }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }

  /* ---------- tokenizer ---------- */
  function findClose(s, i, open, close) { // s[i] is the char after the opener; returns index of the matching closer
    var d = 1;
    while (i < s.length) {
      var c = s[i];
      if (c === '\\') { i += 2; continue; }
      if (c === "'" && open === '(') { var j = s.indexOf("'", i + 1); i = j < 0 ? s.length : j + 1; continue; }
      if (c === '"' && open === '(') { i++; while (i < s.length && s[i] !== '"') { if (s[i] === '\\') i++; i++; } i++; continue; }
      if (c === open) d++; else if (c === close) { d--; if (d === 0) return i; }
      i++;
    }
    return -1;
  }
  var OPS = ['&&', '||', '|&', '<<<', '>>', '2>&1', '&>>', '&>', '2>>', '2>', '1>', '<(', ';', '|', '>', '<', '(', ')', '&'];
  function tokenize(s) {
    var toks = [], i = 0, n = s.length;
    while (i < n) {
      var c = s[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '\n') { toks.push({ op: ';' }); i++; continue; }
      if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) { while (i < n && s[i] !== '\n') i++; continue; }
      var op = null;
      for (var k = 0; k < OPS.length; k++) if (s.substr(i, OPS[k].length) === OPS[k]) { op = OPS[k]; break; }
      if (op && !(op === '<(' && false)) {
        if (op === '<(' || op === '(') {
          if (op === '<(') { var e = findClose(s, i + 2, '(', ')'); if (e < 0) throw new Error('unmatched ('); toks.push({ w: [{ q: 'p', s: s.slice(i + 2, e) }] }); i = e + 1; continue; }
        }
        toks.push({ op: op }); i += op.length; continue;
      }
      var parts = [], cur = '';
      var flush = function () { if (cur !== '') { parts.push({ q: '', s: cur }); cur = ''; } };
      while (i < n) {
        c = s[i];
        if (c === ' ' || c === '\t' || c === '\n') break;
        if (/[;|&<>()]/.test(c)) { if (c === '<' && s[i + 1] === '(') { /* proc subst inside word: rare */ } break; }
        if (c === '\\') { if (s[i + 1] === '\n') { i += 2; continue; } flush(); parts.push({ q: "'", s: s[i + 1] || '', esc: 1 }); i += 2; continue; }
        if (c === "'") { flush(); var j = s.indexOf("'", i + 1); if (j < 0) throw new Error('unmatched \''); parts.push({ q: "'", s: s.slice(i + 1, j) }); i = j + 1; continue; }
        if (c === '"') {
          flush(); var j2 = i + 1, buf = '';
          while (j2 < n && s[j2] !== '"') {
            if (s[j2] === '\\' && /["\\$`]/.test(s[j2 + 1] || '')) { buf += '\u0001' + s[j2 + 1]; j2 += 2; continue; }
            if (s[j2] === '$' && s[j2 + 1] === '(') { var e2 = findClose(s, j2 + 2, '(', ')'); if (e2 < 0) throw new Error('unmatched ('); buf += s.slice(j2, e2 + 1); j2 = e2 + 1; continue; }
            buf += s[j2++];
          }
          if (j2 >= n) throw new Error('unmatched "');
          parts.push({ q: '"', s: buf }); i = j2 + 1; continue;
        }
        if (c === '$' && s[i + 1] === '(') {
          var e3 = findClose(s, i + 2, '(', ')'); if (e3 < 0) throw new Error('unmatched (');
          cur += s.slice(i, e3 + 1); i = e3 + 1; continue;
        }
        if (c === '$' && s[i + 1] === '{') { var e4 = findClose(s, i + 2, '{', '}'); cur += s.slice(i, e4 + 1); i = e4 + 1; continue; }
        if (c === '{') { var e5 = findClose(s, i + 1, '{', '}'); if (e5 > 0 && /[,]|\.\./.test(s.slice(i, e5))) { cur += s.slice(i, e5 + 1); i = e5 + 1; continue; } }
        cur += c; i++;
      }
      flush();
      if (parts.length) toks.push({ w: parts });
    }
    return toks;
  }

  /* ---------- parser ---------- */
  function parseTokens(toks) {
    var p = 0;
    function peekOp() { var t = toks[p]; return t && t.op; }
    function isWord(t, w) { return t && t.w && t.w.length === 1 && t.w[0].q === '' && t.w[0].s === w; }
    function parseList(stop) {
      var items = [];
      while (p < toks.length) {
        while (peekOp() === ';') p++;
        if (p >= toks.length) break;
        if (stop && toks[p].w && stop.some(function (w) { return isWord(toks[p], w); })) break;
        if (peekOp() === ')') break;
        items.push(parseAndOr());
        var o = peekOp(); if (o === ';' || o === '&') p++;
      }
      return { t: 'list', items: items };
    }
    function parseAndOr() {
      var first = parsePipe(), rest = [];
      while (peekOp() === '&&' || peekOp() === '||') { var o = toks[p++].op; rest.push([o, parsePipe()]); }
      return { t: 'andor', first: first, rest: rest };
    }
    function parsePipe() {
      var cmds = [parseCmd()];
      while (peekOp() === '|' || peekOp() === '|&') { var o = toks[p++].op; if (o === '|&') cmds[cmds.length - 1].mergeErr = true; cmds.push(parseCmd()); }
      return { t: 'pipe', cmds: cmds };
    }
    function parseCmd() {
      var t = toks[p];
      if (!t) throw new Error('syntax error near unexpected end');
      if (t.op === '(') { p++; var l = parseList(); if (peekOp() !== ')') throw new Error('unmatched ('); p++; return { t: 'sub', body: l, redirs: parseRedirs() }; }
      if (t.op && !/^(<|>|>>|2>|2>>|1>|&>|&>>|<<<|2>&1)$/.test(t.op)) throw new Error('syntax error near unexpected token `' + t.op + "'");
      if (isWord(t, '{')) { p++; var lb = parseList(['}']); if (!isWord(toks[p], '}')) throw new Error('missing }'); p++; return { t: 'sub', body: lb, redirs: parseRedirs(), group: 1 }; }
      if (isWord(t, 'for')) {
        p++; var v = toks[p++].w[0].s, items = null;
        if (isWord(toks[p], 'in')) { p++; items = []; while (toks[p] && !(toks[p].op === ';') && !isWord(toks[p], 'do')) items.push(toks[p++].w); }
        while (peekOp() === ';') p++;
        if (!isWord(toks[p], 'do')) throw new Error('parse error: expected do'); p++;
        var body = parseList(['done']); if (!isWord(toks[p], 'done')) throw new Error('parse error: expected done'); p++;
        return { t: 'for', v: v, items: items, body: body, redirs: parseRedirs() };
      }
      if (isWord(t, 'while') || isWord(t, 'until')) {
        var neg = isWord(t, 'until'); p++; var cond = parseList(['do']); if (!isWord(toks[p], 'do')) throw new Error('parse error: expected do'); p++;
        var wb = parseList(['done']); if (!isWord(toks[p], 'done')) throw new Error('parse error: expected done'); p++;
        return { t: 'while', cond: cond, body: wb, neg: neg, redirs: parseRedirs() };
      }
      if (isWord(t, 'if')) {
        p++; var c = parseList(['then']); if (!isWord(toks[p], 'then')) throw new Error('parse error: expected then'); p++;
        var th = parseList(['else', 'elif', 'fi']), el = null;
        if (isWord(toks[p], 'elif')) { toks[p] = { w: [{ q: '', s: 'if' }] }; el = { t: 'list', items: [parseAndOr()] }; return { t: 'if', c: c, th: th, el: el, redirs: [] }; }
        if (isWord(toks[p], 'else')) { p++; el = parseList(['fi']); }
        if (!isWord(toks[p], 'fi')) throw new Error('parse error: expected fi'); p++;
        return { t: 'if', c: c, th: th, el: el, redirs: parseRedirs() };
      }
      var words = [], redirs = [], assigns = [];
      while (p < toks.length) {
        var tk = toks[p];
        if (tk.op && /^(<|>|>>|2>|2>>|1>|&>|&>>|<<<)$/.test(tk.op)) { p++; var tg = toks[p++]; if (!tg || !tg.w) throw new Error('syntax error near unexpected token `newline\''); redirs.push({ op: tk.op, w: tg.w }); continue; }
        if (tk.op === '2>&1') { p++; redirs.push({ op: '2>&1' }); continue; }
        if (tk.op) break;
        if (!words.length && tk.w[0].q === '' && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tk.w[0].s)) { assigns.push(tk.w); p++; continue; }
        words.push(tk.w); p++;
      }
      return { t: 'simple', words: words, redirs: redirs, assigns: assigns };
    }
    function parseRedirs() {
      var r = [];
      while (toks[p] && toks[p].op && /^(<|>|>>|2>|2>>|&>|&>>|2>&1)$/.test(toks[p].op)) { var o = toks[p++].op; if (o === '2>&1') { r.push({ op: o }); continue; } r.push({ op: o, w: toks[p++].w }); }
      return r;
    }
    var l = parseList();
    if (p < toks.length) throw new Error('syntax error near unexpected token `' + (toks[p].op || toks[p].w[0].s) + "'");
    return l;
  }

  /* ---------- shell ---------- */
  function Shell(opt) {
    opt = opt || {};
    this.fs = opt.fs || new FS(opt.files);
    this.cwd = HOME + '/lab';
    this.env = { HOME: HOME, USER: 'learner', LOGNAME: 'learner', SHELL: '/bin/zsh', PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin', PWD: this.cwd, LANG: 'en_US.UTF-8', TERM: 'xterm-256color', HOSTNAME: 'macbook.local', OLDPWD: HOME, PS1: '%n@%m %1~ %# ' };
    this.vars = {};
    this.status = 0; this.history = []; this.fd = 10; this.aliases = {}; this.depth = 0; this.steps = 0;
  }
  Shell.prototype.get = function (k) {
    if (k === '?') return String(this.status);
    if (k === '$') return '4242';
    if (k === '#') return String((this.args || []).length);
    if (k === '@' || k === '*') return (this.args || []).join(' ');
    if (/^\d+$/.test(k)) return k === '0' ? 'zsh' : (this.args || [])[+k - 1] || '';
    if (k === 'RANDOM') return String(Math.floor(Math.random() * 32768));
    if (k === 'PWD') return this.cwd;
    if (k === 'HOSTNAME' || k === 'HOST') return 'macbook.local';
    if (k in this.vars) return this.vars[k];
    if (k in this.env) return this.env[k];
    return '';
  };
  Shell.prototype.abs = function (p) { return this.fs.norm(p, this.cwd); };

  /* run a whole line; returns {out, err, status} (both streams as strings), tty = output goes to terminal */
  Shell.prototype.run = function (line, opt) {
    opt = opt || {};
    var res = { out: '', err: '' };
    if (line.trim() === '') return res;
    this.history.push(line);
    try {
      var ast = parseTokens(tokenize(line));
      var r = this.exec(ast, { in: opt.stdin || '', tty: true });
      res.out = r.out; res.err = r.err;
    } catch (e) {
      if (e && e.sim) { res.err = 'zsh: ' + e.message + '\n'; this.status = e.code || 1; }
      else if (e && e.exit) { res.out = e.out || ''; res.err = e.err || ''; }
      else { res.err = 'zsh: ' + (e && e.message || e) + '\n'; this.status = 1; }
    }
    res.status = this.status;
    return res;
  };
  function fail(msg, code) { var e = new Error(msg); e.sim = 1; e.code = code || 1; return e; }

  /* every exec returns {out, err}; status stored on shell */
  Shell.prototype.exec = function (n, io) {
    if (++this.steps > 200000) throw fail('too much work for the simulator');
    var self = this;
    switch (n.t) {
      case 'list': { var o = '', e = ''; n.items.forEach(function (it) { var r = self.exec(it, io); o += r.out; e += r.err; }); return { out: o, err: e }; }
      case 'andor': {
        var r = this.exec(n.first, io), o2 = r.out, e2 = r.err;
        for (var i = 0; i < n.rest.length; i++) {
          var op = n.rest[i][0];
          if ((op === '&&' && this.status === 0) || (op === '||' && this.status !== 0)) { var r2 = this.exec(n.rest[i][1], io); o2 += r2.out; e2 += r2.err; }
        }
        return { out: o2, err: e2 };
      }
      case 'pipe': return this.execPipe(n, io);
      case 'sub': { var saveCwd = this.cwd, saveV = n.group ? null : JSON.stringify(this.vars); var r3 = this.withRedirs(n.redirs, io, function (io2) { return self.exec(n.body, io2); }); if (!n.group) { this.cwd = saveCwd; this.vars = JSON.parse(saveV); } return r3; }
      case 'for': {
        var items = []; (n.items || []).forEach(function (w) { items = items.concat(self.expandWord(w)); });
        var out = '', er = '';
        for (var k = 0; k < items.length; k++) {
          this.vars[n.v] = items[k]; var rb = this.exec(n.body, io); out += rb.out; er += rb.err; if (this.brk) { this.brk = 0; break; }
        }
        return this.redirOut({ out: out, err: er }, n.redirs);
      }
      case 'while': {
        var wo = '', we = '', guard = 0;
        while (guard++ < 10000) { var rc = this.exec(n.cond, io); wo += rc.out; we += rc.err; var okc = this.status === 0; if (n.neg) okc = !okc; if (!okc) break; var rb2 = this.exec(n.body, io); wo += rb2.out; we += rb2.err; }
        return { out: wo, err: we };
      }
      case 'if': {
        var rc2 = this.exec(n.c, io), res;
        if (this.status === 0) res = this.exec(n.th, io); else if (n.el) res = this.exec(n.el, io); else { res = { out: '', err: '' }; this.status = 0; }
        return { out: rc2.out + res.out, err: rc2.err + res.err };
      }
      case 'simple': return this.execSimple(n, io);
    }
    throw fail('bad node');
  };

  Shell.prototype.redirOut = function (r, redirs) {
    if (!redirs || !redirs.length) return r;
    var self = this, out = r.out, err = r.err;
    redirs.forEach(function (rd) {
      if (rd.op === '2>&1') { out += err; err = ''; return; }
      var file = self.expandWord(rd.w)[0] || '', ab = self.abs(file);
      if (rd.op === '>' || rd.op === '>>') { self.fsWrite(ab, out, rd.op === '>>'); out = ''; }
      else if (rd.op === '2>' || rd.op === '2>>') { self.fsWrite(ab, err, rd.op === '2>>'); err = ''; }
      else if (rd.op === '&>' || rd.op === '&>>') { self.fsWrite(ab, out + err, rd.op === '&>>'); out = ''; err = ''; }
    });
    return { out: out, err: err };
  };
  Shell.prototype.withRedirs = function (redirs, io, fn) {
    var inp = io.in, self = this;
    (redirs || []).forEach(function (rd) {
      if (rd.op === '<') { var f = self.expandWord(rd.w)[0], c = self.fs.read(self.abs(f)); if (c === null) throw fail(f + ': no such file or directory'); inp = c; }
      if (rd.op === '<<<') inp = self.expandWord(rd.w, true).join(' ') + '\n';
    });
    var r = fn({ in: inp, tty: io.tty && !(redirs || []).length });
    return this.redirOut(r, redirs);
  };
  Shell.prototype.fsWrite = function (ab, data, append) {
    if (ab === '/dev/null') return;
    var dir = ab.replace(/\/[^\/]*$/, '') || '/';
    if (!this.fs.isDir(dir)) throw fail('no such file or directory: ' + ab.replace(this.cwd + '/', ''));
    if (this.fs.isDir(ab)) throw fail('is a directory: ' + ab);
    var old = append ? (this.fs.read(ab) || '') : '';
    this.fs.write(ab, old + data);
  };

  Shell.prototype.execPipe = function (n, io) {
    var inp = io.in, errAll = '', out = '', self = this, last = n.cmds.length - 1;
    for (var i = 0; i <= last; i++) {
      var r = this.exec(n.cmds[i], { in: inp, tty: io.tty && i === last });
      if (n.cmds[i].mergeErr) { r.out += r.err; r.err = ''; }
      errAll += r.err; inp = r.out; if (i === last) out = r.out;
    }
    return { out: out, err: errAll };
  };

  /* ---------- expansion ---------- */
  function braceExpand(s) {
    var i = s.indexOf('{'); if (i < 0) return [s];
    var j = findClose(s, i + 1, '{', '}'); if (j < 0) return [s];
    var pre = s.slice(0, i), body = s.slice(i + 1, j), post = s.slice(j + 1), alts = [], d = 0, cur = '';
    for (var k = 0; k < body.length; k++) {
      var c = body[k]; if (c === '{') d++; if (c === '}') d--;
      if (c === ',' && d === 0) { alts.push(cur); cur = ''; } else cur += c;
    }
    alts.push(cur);
    var m;
    if (alts.length === 1) {
      if ((m = /^(-?\d+)\.\.(-?\d+)$/.exec(body))) { var a = +m[1], b = +m[2], st = a <= b ? 1 : -1; alts = []; var pad = /^-?0\d/.test(m[1]) ? m[1].replace('-', '').length : 0; for (var x = a; st > 0 ? x <= b : x >= b; x += st) alts.push(pad ? String(x).padStart(pad, '0') : String(x)); }
      else if ((m = /^([a-zA-Z])\.\.([a-zA-Z])$/.exec(body))) { var ca = m[1].charCodeAt(0), cb = m[2].charCodeAt(0), s2 = ca <= cb ? 1 : -1; alts = []; for (var y = ca; s2 > 0 ? y <= cb : y >= cb; y += s2) alts.push(String.fromCharCode(y)); }
      else return [pre + '{' + body + '}' + ''].map(function (t) { return t; }).concat([]).length ? braceExpand(post).map(function (t) { return pre + '{' + body + '}' + t; }) : [s];
    }
    var out = [];
    alts.forEach(function (al) { braceExpand(pre + al + post).forEach(function (r) { out.push(r); }); });
    return out;
  }

  /* expand a word (array of parts) into argv entries. noGlob/noSplit when 2nd arg true. */
  Shell.prototype.expandWord = function (parts, quotedAll) {
    var self = this;
    // brace expansion on unquoted text only when the word is a single unquoted part
    var variants = [parts];
    if (!quotedAll && parts.some(function (p) { return p.q === '' && /\{.*(,|\.\.).*\}/.test(p.s); })) {
      var flat = parts.map(function (p) { return p.q === '' ? p.s : '\u0002' + p.q + p.s.replace(/\u0002/g, '') + '\u0003'; }).join('');
      variants = braceExpand(flat).map(function (v) {
        var out = [], re = /\u0002(.)([^\u0003]*)\u0003|([^\u0002]+)/g, m;
        while ((m = re.exec(v))) { if (m[3] !== undefined) out.push({ q: '', s: m[3] }); else out.push({ q: m[1], s: m[2] }); }
        return out;
      });
    }
    var res = [];
    variants.forEach(function (vp) { res = res.concat(self.expandOne(vp, quotedAll)); });
    return res;
  };
  Shell.prototype.expandOne = function (parts, noGlob) {
    var self = this, fields = [{ s: '', pat: '', has: false }], cur = fields[0], any = false;
    function add(str, quoted, splittable) {
      if (!splittable) { cur.s += str; cur.pat += quoted ? str.replace(/[*?\[\]\\]/g, '\\$&') : str; cur.has = true; return; }
      var words = str.split(/[ \t\n]+/);
      words.forEach(function (w, i) {
        if (i > 0) { cur = { s: '', pat: '', has: false }; fields.push(cur); }
        if (w !== '') { cur.s += w; cur.pat += w; cur.has = true; }
      });
    }
    parts.forEach(function (p) {
      if (p.q === 'p') { // process substitution
        var r = self.exec(parseTokens(tokenize(p.s)), { in: '' });
        var path = '/dev/fd/' + (self.fd++); self.fs.n[path] = { f: r.out, m: NOW }; cur.s += path; cur.pat += path; cur.has = true; return;
      }
      if (p.q === "'") { cur.s += p.s; cur.pat += p.esc ? p.s.replace(/[*?\[\]\\]/g, '\\$&') : p.s.replace(/[*?\[\]\\]/g, '\\$&'); cur.has = true; return; }
      var s = p.s, q = p.q === '"';
      if (p.q === '' && p.s.indexOf('$') < 0 && p.s.indexOf('~') < 0) { // fast path
        cur.s += s; cur.pat += s; cur.has = true; return;
      }
      var i = 0, buf = '';
      var emit = function (str, split) { add(str, q, split); };
      if (!q && s[0] === '~' && cur.s === '' && fields.length === 1) { var m0 = /^~(\/|$)/.exec(s); if (m0) { s = HOME + s.slice(1); } }
      while (i < s.length) {
        var c = s[i];
        if (c === '\u0001') { buf += s[i + 1]; i += 2; continue; }
        if (c === '$') {
          var nx = s[i + 1];
          if (nx === '(' && s[i + 2] === '(') {
            var e = findClose(s, i + 3, '(', ')'); // closes inner
            var end = s.indexOf('))', i + 3); end = end < 0 ? s.length : end;
            var expr = s.slice(i + 3, end); if (buf) { emit(buf, false); buf = ''; }
            emit(String(self.arith(expr)), false); i = end + 2; continue;
          }
          if (nx === '(') {
            var e2 = findClose(s, i + 2, '(', ')'); if (buf) { emit(buf, false); buf = ''; }
            var inner = s.slice(i + 2, e2), saveStatus = self.status;
            var r = self.exec(parseTokens(tokenize(inner)), { in: '' });
            self.errBuf = (self.errBuf || '') + r.err;
            emit(q ? r.out.replace(/\n+$/, '') : r.out.replace(/\n+$/, ''), !q); i = e2 + 1; continue;
          }
          if (nx === '{') {
            var e3 = findClose(s, i + 2, '{', '}'); var body = s.slice(i + 2, e3); if (buf) { emit(buf, false); buf = ''; }
            emit(self.paramExp(body), false); i = e3 + 1; continue;
          }
          var m = /^[A-Za-z_][A-Za-z0-9_]*|^[0-9]|^[?$#@*]/.exec(s.slice(i + 1));
          if (m) { if (buf) { emit(buf, false); buf = ''; } var val = self.get(m[0]); if ((m[0] === '@' || m[0] === '*') && q) emit(val, false); else emit(val, false); i += 1 + m[0].length; continue; }
        }
        buf += c; i++;
      }
      if (buf) emit(buf, false);
      if (!parts.length) cur.has = true;
      if (s === '' && q) cur.has = true;
    });
    var out = [];
    fields.forEach(function (f) {
      if (!f.has && !parts.some(function (p) { return p.q === '"' || p.q === "'"; })) return;
      if (!noGlob && hasGlob(f.pat)) {
        var g = self.fs.glob(f.pat, self.cwd);
        if (g.length) { out = out.concat(g); return; }
        if (!(self.opts && self.opts.nonomatch)) throw fail('no matches found: ' + f.s);
      }
      out.push(f.s);
    });
    return out;
  };
  Shell.prototype.paramExp = function (b) {
    var m;
    if ((m = /^#(.+)$/.exec(b))) return String(this.get(m[1]).length);
    if ((m = /^([A-Za-z_][A-Za-z0-9_]*)(:-|:=|-|=|:\+|\+|:\?)(.*)$/.exec(b))) {
      var v = this.get(m[1]), set = v !== '', op = m[2], w = m[3];
      if (op === ':-' || op === '-') return set ? v : w;
      if (op === ':=' || op === '=') { if (!set) this.vars[m[1]] = w; return set ? v : w; }
      if (op === ':+' || op === '+') return set ? w : '';
      if (op === ':?') { if (!set) throw fail(m[1] + ': ' + (w || 'parameter not set')); return v; }
    }
    if ((m = /^([A-Za-z_][A-Za-z0-9_]*)(##|#|%%|%)(.+)$/.exec(b))) {
      var val = this.get(m[1]), pat = m[3], re = globRe(pat.replace(/\*/g, '*')); var src = re.source.slice(1, -1);
      if (m[2][0] === '#') { var best = null; for (var i = 0; i <= val.length; i++) { if (new RegExp('^' + src + '$').test(val.slice(0, i))) { best = i; if (m[2] === '#') break; } } return best === null ? val : val.slice(best); }
      var bestE = null; for (var j = val.length; j >= 0; j--) { if (new RegExp('^' + src + '$').test(val.slice(j))) { bestE = j; if (m[2] === '%') break; } } return bestE === null ? val : val.slice(0, bestE);
    }
    if ((m = /^([A-Za-z_][A-Za-z0-9_]*)(\/\/|\/)([^\/]*)\/(.*)$/.exec(b))) { var vv = this.get(m[1]); return m[2] === '//' ? vv.split(m[3]).join(m[4]) : vv.replace(m[3], m[4]); }
    if ((m = /^([A-Za-z_][A-Za-z0-9_]*):(\d+)(?::(\d+))?$/.exec(b))) { var s0 = this.get(m[1]); return m[3] !== undefined ? s0.substr(+m[2], +m[3]) : s0.slice(+m[2]); }
    return this.get(b);
  };
  Shell.prototype.arith = function (expr) {
    var self = this, k;
    while ((k = expr.indexOf('$(')) >= 0) { var e2 = findClose(expr, k + 2, '(', ')'); if (e2 < 0) break; var rr = this.exec(parseTokens(tokenize(expr.slice(k + 2, e2))), { in: '' }); expr = expr.slice(0, k) + rr.out.replace(/\n+$/, '').trim() + expr.slice(e2 + 1); }
    var e = expr.replace(/\$?([A-Za-z_][A-Za-z0-9_]*)/g, function (_, k) { var v = self.get(k); return /^-?\d+(\.\d+)?$/.test(v) ? '(' + v + ')' : '0'; });
    if (/[^0-9+\-*\/%()<>=!&|^~ .?:]/.test(e)) throw fail('bad math expression: ' + expr);
    e = e.replace(/(\d+)\s*\/\s*(\d+)/g, 'Math.trunc($1/$2)');
    try { var v = Function('"use strict";return (' + e + ')')(); return typeof v === 'boolean' ? (v ? 1 : 0) : Math.trunc(v); } catch (x) { throw fail('bad math expression: ' + expr); }
  };

  /* ---------- simple command ---------- */
  Shell.prototype.execSimple = function (n, io) {
    var self = this, argv = [];
    this.errBuf = '';
    n.words.forEach(function (w) { argv = argv.concat(self.expandWord(w)); });
    var pre = this.errBuf; this.errBuf = '';
    var saveEnv = null;
    if (n.assigns.length) {
      var kv = n.assigns.map(function (w) { var s = w[0].s, i = s.indexOf('='); var rest = [{ q: w[0].q, s: s.slice(i + 1) }].concat(w.slice(1)); return [s.slice(0, i), self.expandOne(rest, true).join(' ')]; });
      if (!argv.length) { kv.forEach(function (x) { if (x[0] in self.env) self.env[x[0]] = x[1]; else self.vars[x[0]] = x[1]; }); this.status = 0; return { out: '', err: pre }; }
      saveEnv = JSON.stringify(this.env); kv.forEach(function (x) { self.env[x[0]] = x[1]; });
    }
    var r = this.withRedirs(n.redirs, io, function (io2) {
      if (!argv.length) { self.status = 0; return { out: '', err: '' }; }
      return self.runCmd(argv, io2);
    });
    if (saveEnv) this.env = JSON.parse(saveEnv);
    r.err = pre + r.err;
    return r;
  };

  var CMDS = {}; // filled by other files: name -> function(argv(without name), ctx) returning {out, err, code}
  Shell.prototype.runCmd = function (argv, io) {
    var name = argv[0], args = argv.slice(1);
    if (this.aliases[name] && !this.inAlias) { var al = this.aliases[name].split(' '); this.inAlias = 1; try { return this.runCmd(al.concat(args), io); } finally { this.inAlias = 0; } }
    var fn = CMDS[name];
    if (!fn) { this.status = 127; return { out: '', err: 'zsh: command not found: ' + name + '\n' }; }
    if (++this.depth > 50) { this.depth = 0; throw fail('recursion too deep'); }
    var ctx = { sh: this, fs: this.fs, cwd: this.cwd, env: this.env, in: io.in, tty: io.tty, name: name };
    var r;
    try { r = fn(args, ctx) || {}; } catch (e) { if (e && e.sim && !e.top) { r = { err: name + ': ' + e.message + '\n', code: e.code || 1 }; } else throw e; } finally { this.depth--; }
    this.status = r.code || 0;
    return { out: r.out || '', err: r.err || '' };
  };

  /* helper for commands: read inputs (files or stdin) */
  function inputs(args, ctx, name) {
    var errs = '', list = [];
    if (!args.length) return { texts: [{ name: '-', text: ctx.in }], err: '' };
    args.forEach(function (a) {
      if (a === '-') { list.push({ name: '-', text: ctx.in }); return; }
      var ab = ctx.sh.abs(a);
      if (ctx.fs.isDir(ab)) { errs += name + ': ' + a + ': Is a directory\n'; return; }
      var t = ctx.fs.read(ab);
      if (t === null) errs += name + ': ' + a + ': No such file or directory\n'; else list.push({ name: a, text: t });
    });
    return { texts: list, err: errs };
  }
  function lines(t) { if (t === '') return []; var a = t.split('\n'); if (a[a.length - 1] === '') a.pop(); return a; }
  function joinL(a) { return a.length ? a.join('\n') + '\n' : ''; }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function padR(s, w) { s = String(s); while (s.length < w) s += ' '; return s; }

  /* flag parser: spec like 'nrk:t:' => letters, ':' means takes value. Supports -n5, -k 2, combined -nr, and numeric -5 when opts.num */
  function flags(args, spec, opts) {
    opts = opts || {}; var f = {}, rest = [], i = 0, long = opts.long || {};
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '--') { rest = rest.concat(args.slice(i + 1)); break; }
      if (a.slice(0, 2) === '--' && a.length > 2) { var eq = a.indexOf('='), nm = eq < 0 ? a.slice(2) : a.slice(2, eq); if (long[nm]) { var sh = long[nm]; if (spec.indexOf(sh + ':') >= 0) { f[sh] = eq < 0 ? args[++i] : a.slice(eq + 1); } else f[sh] = true; } else throw fail('illegal option -- ' + a); continue; }
      if (a[0] === '-' && a.length > 1 && !(opts.stopAtFirst && false)) {
        if (opts.num && /^-\d+$/.test(a)) { f.n = a.slice(1); continue; }
        var ok = true;
        for (var j = 1; j < a.length; j++) {
          var ch = a[j], pos = spec.indexOf(ch);
          if (pos < 0) { if (opts.loose && /[^a-zA-Z]/.test(a)) { ok = false; break; } throw fail('illegal option -- ' + ch); }
          if (spec[pos + 1] === ':') { var v = a.slice(j + 1); if (v === '') v = args[++i]; if (v === undefined) throw fail('option requires an argument -- ' + ch); if (f[ch] === undefined || !opts.multi || !opts.multi[ch]) f[ch] = v; else f[ch] = [].concat(f[ch], v); break; }
          f[ch] = true;
        }
        if (!ok) rest.push(a);
        continue;
      }
      if (opts.stopAtFirst) { rest = rest.concat(args.slice(i)); break; }
      rest.push(a);
    }
    if (opts.multi) Object.keys(opts.multi).forEach(function (k) { if (f[k] !== undefined && !Array.isArray(f[k])) f[k] = [f[k]]; });
    return { f: f, rest: rest };
  }

  return { FS: FS, Shell: Shell, CMDS: CMDS, HOME: HOME, NOW: NOW, MON: MON, util: { inputs: inputs, lines: lines, joinL: joinL, pad: pad, padR: padR, flags: flags, fail: fail, esc: esc, globRe: globRe, tokenize: tokenize, parseTokens: parseTokens, findClose: findClose } };
})();


/* Core commands for the simulator. Output formats follow macOS (BSD) tools. */
(function (SIM) {
  'use strict';
  var C = SIM.CMDS, U = SIM.util, HOME = SIM.HOME, NOW = SIM.NOW, MON = SIM.MON;
  var inputs = U.inputs, lines = U.lines, joinL = U.joinL, pad = U.pad, padR = U.padR, flags = U.flags, fail = U.fail;

  /* POSIX regex (BRE or ERE) -> JS RegExp */
  var CLS = { alpha: 'a-zA-Z', digit: '0-9', alnum: 'a-zA-Z0-9', upper: 'A-Z', lower: 'a-z', space: ' \\t\\n\\r\\f\\v', blank: ' \\t', punct: '!-\\/:-@\\[-`{-~', xdigit: '0-9A-Fa-f', word: 'a-zA-Z0-9_' };
  function rx(src, ere, icase, extra) {
    var o = '', i = 0, n = src.length;
    while (i < n) {
      var c = src[i];
      if (c === '[') {
        var j = i + 1, neg = false, body = '';
        if (src[j] === '^') { neg = true; j++; }
        if (src[j] === ']') { body += '\\]'; j++; }
        while (j < n && src[j] !== ']') {
          if (src[j] === '[' && src[j + 1] === ':') { var e = src.indexOf(':]', j); var nm = src.slice(j + 2, e); body += CLS[nm] || ''; j = e + 2; continue; }
          if (src[j] === '\\') { body += '\\\\'; j++; continue; }
          body += src[j] === '[' ? '\\[' : src[j]; j++;
        }
        o += '[' + (neg ? '^' : '') + body + ']'; i = j + 1; continue;
      }
      if (c === '\\') {
        var d = src[i + 1];
        if (!ere && '(){}|+?'.indexOf(d) >= 0) { o += d === '(' || d === ')' || d === '{' || d === '}' || d === '|' || d === '+' || d === '?' ? d : '\\' + d; i += 2; continue; }
        if (d === '<' || d === '>') { o += '\\b'; i += 2; continue; }
        if (/[dswDSWbB]/.test(d)) { o += '\\' + d; i += 2; continue; }
        if (/[1-9]/.test(d)) { o += '\\' + d; i += 2; continue; }
        if (d === 'n') { o += '\\n'; i += 2; continue; } if (d === 't') { o += '\\t'; i += 2; continue; }
        o += '\\' + d; i += 2; continue;
      }
      if (!ere && '(){}|+?'.indexOf(c) >= 0) { o += '\\' + c; i++; continue; }
      if (c === '*' && !ere && (o === '' || o === '^' || /\($/.test(o))) { o += '\\*'; i++; continue; }
      o += c; i++;
    }
    try { return new RegExp(o, (icase ? 'i' : '') + (extra || '')); } catch (e) { throw fail('invalid regular expression: ' + src); }
  }
  SIM.rx = rx;

  /* ---- navigation / files ---- */
  C.pwd = function (a, c) { return { out: c.sh.cwd + '\n' }; };
  C.cd = function (a, c) {
    var t = a[0] === undefined ? HOME : a[0] === '-' ? c.sh.env.OLDPWD : a[0], ab = c.sh.abs(t);
    if (!c.fs.isDir(ab)) return { err: 'cd: ' + (c.fs.isFile(ab) ? 'not a directory: ' : 'no such file or directory: ') + a[0] + '\n', code: 1 };
    c.sh.env.OLDPWD = c.sh.cwd; c.sh.cwd = ab; c.sh.env.PWD = ab;
    return { out: a[0] === '-' ? ab + '\n' : '' };
  };
  C.mkdir = function (a, c) {
    var p = flags(a, 'pv'), err = '', out = '';
    p.rest.forEach(function (d) {
      var ab = c.sh.abs(d);
      if (c.fs.n[ab]) { err += 'mkdir: ' + d + ': File exists\n'; return; }
      var par = ab.replace(/\/[^\/]*$/, '') || '/';
      if (!p.f.p && !c.fs.isDir(par)) { err += 'mkdir: ' + d + ': No such file or directory\n'; return; }
      p.f.p ? c.fs.mkdirp(ab) : c.fs.mk(ab); if (p.f.v) out += d + '\n';
    });
    return { out: out, err: err, code: err ? 1 : 0 };
  };
  C.touch = function (a, c) {
    var err = '';
    a.filter(function (x) { return x[0] !== '-'; }).forEach(function (f) {
      var ab = c.sh.abs(f), par = ab.replace(/\/[^\/]*$/, '') || '/';
      if (!c.fs.isDir(par)) { err += 'touch: ' + f + ': No such file or directory\n'; return; }
      if (c.fs.n[ab]) c.fs.n[ab].m = NOW; else c.fs.write(ab, '');
    });
    return { err: err, code: err ? 1 : 0 };
  };
  C.rm = function (a, c) {
    var p = flags(a, 'rfiRv', {}), err = '', out = '', rec = p.f.r || p.f.R;
    p.rest.forEach(function (f) {
      var ab = c.sh.abs(f), x = c.fs.get(ab);
      if (!x) { if (!p.f.f) err += 'rm: ' + f + ': No such file or directory\n'; return; }
      if (x.d && !rec) { err += 'rm: ' + f + ': is a directory\n'; return; }
      c.fs.rm(ab); if (p.f.v) out += f + '\n';
    });
    return { out: out, err: err, code: err ? 1 : 0 };
  };
  C.rmdir = function (a, c) {
    var err = ''; a.forEach(function (f) { var ab = c.sh.abs(f); if (!c.fs.isDir(ab)) err += 'rmdir: ' + f + ': No such file or directory\n'; else if (c.fs.list(ab).length) err += 'rmdir: ' + f + ': Directory not empty\n'; else c.fs.rm(ab); });
    return { err: err, code: err ? 1 : 0 };
  };
  function copyTree(fs, from, to) {
    var x = fs.get(from);
    if (x.d) { fs.mkdirp(to); fs.list(from).forEach(function (n) { copyTree(fs, from + '/' + n, to + '/' + n); }); }
    else fs.write(to, x.f, NOW);
  }
  function cpmv(isMv) {
    return function (a, c) {
      var name = isMv ? 'mv' : 'cp', p = flags(a, isMv ? 'fiv' : 'rRfipv'), r = p.rest, err = '', out = '';
      if (r.length < 2) return { err: 'usage: ' + name + ' [-f | -i | -n] [-v] source target\n       ' + name + ' [-f | -i | -n] [-v] source ... directory\n', code: 64 };
      var dest = r.pop(), dab = c.sh.abs(dest), dirDest = c.fs.isDir(dab);
      if (r.length > 1 && !dirDest) return { err: name + ': ' + dest + ' is not a directory\n', code: 1 };
      r.forEach(function (s) {
        var sab = c.sh.abs(s), x = c.fs.get(sab);
        if (!x) { err += name + ': ' + s + ': No such file or directory\n'; return; }
        if (x.d && !isMv && !(p.f.r || p.f.R)) { err += 'cp: ' + s + ' is a directory (not copied).\n'; return; }
        var target = dirDest ? dab + '/' + sab.split('/').pop() : dab;
        if (target === sab) { err += name + ': ' + s + ' and ' + dest + ' are identical (not copied).\n'; return; }
        var par = target.replace(/\/[^\/]*$/, '') || '/';
        if (!c.fs.isDir(par)) { err += name + ': ' + dest + ': No such file or directory\n'; return; }
        copyTree(c.fs, sab, target); if (isMv) c.fs.rm(sab);
        if (p.f.v) out += isMv ? s + ' -> ' + (dirDest ? dest.replace(/\/$/, '') + '/' + sab.split('/').pop() : dest) + '\n' : s + ' -> ' + (dirDest ? dest.replace(/\/$/, '') + '/' + sab.split('/').pop() : dest) + '\n';
      });
      return { out: out, err: err, code: err ? 1 : 0 };
    };
  }
  C.cp = cpmv(false); C.mv = cpmv(true);
  C.ln = function (a, c) { var r = a.filter(function (x) { return x[0] !== '-'; }); var t = c.fs.read(c.sh.abs(r[0])); if (t === null) return { err: 'ln: ' + r[0] + ': No such file or directory\n', code: 1 }; c.fs.write(c.sh.abs(r[1]), t); return {}; };

  function modeStr(x, isDir) { return (isDir ? 'd' : '-') + (x.perm || (isDir ? 'rwxr-xr-x' : 'rw-r--r--')); }
  function human(n) { if (n < 1024) return String(n) + 'B'; var u = 'KMGT', i = -1; do { n /= 1024; i++; } while (n >= 1024 && i < 3); return (n < 10 ? n.toFixed(1) : String(Math.round(n))) + u[i]; }
  function dateCol(m) { var old = NOW - m > 15552000000; return padR(MON[m.getMonth()], 3) + ' ' + pad(m.getDate(), 2) + ' ' + (old ? ' ' + m.getFullYear() : String(m.getHours()+100).slice(1) + ':' + String(m.getMinutes()+100).slice(1)); }
  C.ls = function (a, c) {
    var p = flags(a, '1lAaFhtSrRdGpf@e'), f = p.f, targets = p.rest.length ? p.rest : ['.'], out = '', err = '';
    function entries(ab) {
      var names = c.fs.list(ab);
      if (f.a) names = ['.', '..'].concat(names); else if (!f.A) names = names.filter(function (n) { return n[0] !== '.'; });
      var ents = names.map(function (n) { var full = n === '.' ? ab : n === '..' ? ab.replace(/\/[^\/]*$/, '') || '/' : ab + '/' + n; return { n: n, x: c.fs.get(full) || { d: 1, m: NOW }, full: full }; });
      if (f.S) ents.sort(function (x, y) { return (y.x.f ? y.x.f.length : 0) - (x.x.f ? x.x.f.length : 0) || (x.n < y.n ? -1 : 1); });
      else if (f.t) ents.sort(function (x, y) { return y.x.m - x.x.m || (x.n < y.n ? -1 : 1); });
      if (f.r) ents.reverse();
      return ents;
    }
    function label(e) { var s = e.n; if (f.F || f.p) { if (e.x.d) s += '/'; else if (e.x.perm && /x/.test(e.x.perm)) s += f.p ? '' : '*'; } return s; }
    function show(ents, withTotal) {
      if (f.l) {
        var szs = ents.map(function (e) { return e.x.d ? 64 : e.x.f.length; });
        var hs = szs.map(function (s) { return f.h ? human(s) : String(s); }), w = Math.max.apply(null, hs.map(function (s) { return s.length; }).concat([1]));
        var o = withTotal ? 'total ' + ents.reduce(function (t, e) { return t + (e.x.d ? 0 : Math.max(8, Math.ceil(e.x.f.length / 4096) * 8)); }, 0) + '\n' : '';
        var lw = Math.max.apply(null, ents.map(function (e) { return e.x.d ? String(2 + c.fs.list(e.full).filter(function (n) { return c.fs.isDir(e.full + '/' + n); }).length).length : 1; }).concat([1]));
        ents.forEach(function (e, i) { o += modeStr(e.x, e.x.d) + '  ' + pad(e.x.d ? 2 + c.fs.list(e.full).filter(function (n) { return c.fs.isDir(e.full + '/' + n); }).length : 1, lw) + ' learner  staff  ' + pad(hs[i], w) + ' ' + dateCol(e.x.m) + ' ' + label(e) + '\n'; });
        return o;
      }
      var names = ents.map(label);
      if (!names.length) return '';
      if (f['1'] || !c.tty) return names.join('\n') + '\n';
      var maxl = Math.max.apply(null, names.map(function (s) { return s.length; })) + 2, cols = Math.max(1, Math.floor(80 / maxl)), rows = Math.ceil(names.length / cols), o2 = '';
      for (var r = 0; r < rows; r++) { var ln = ''; for (var k = 0; k < cols; k++) { var nm = names[k * rows + r]; if (nm === undefined) continue; ln += (k * rows + r + rows >= names.length || k === cols - 1) ? nm : padR(nm, maxl); } o2 += ln.replace(/\s+$/, '') + '\n'; }
      return o2;
    }
    var files = [], dirs = [];
    targets.forEach(function (t) {
      var ab = c.sh.abs(t), x = c.fs.get(ab);
      if (!x) { err += 'ls: ' + t + ': No such file or directory\n'; return; }
      if (x.d && !f.d) dirs.push({ t: t, ab: ab }); else files.push({ n: t, x: x, full: ab });
    });
    if (files.length) out += show(files, false);
    function walk(d, hdr) {
      if (hdr) out += (out ? '\n' : '') + d.t + ':\n';
      var ents = entries(d.ab); out += show(ents, true);
      if (f.R) ents.forEach(function (e) { if (e.x.d && e.n !== '.' && e.n !== '..') walk({ t: d.t.replace(/\/$/, '') + '/' + e.n, ab: e.full }, true); });
    }
    dirs.forEach(function (d, i) { walk(d, dirs.length > 1 || files.length || f.R); });
    return { out: out, err: err, code: err ? 1 : 0 };
  };
  C.ll = function (a, c) { return C.ls(['-l'].concat(a), c); };
  C.tree = function (a, c) {
    var root = a[0] || '.', ab = c.sh.abs(root), out = root + '\n', d = 0, f = 0;
    (function w(p, pre) { var n = c.fs.list(p).filter(function (x) { return x[0] !== '.'; }); n.forEach(function (x, i) { var last = i === n.length - 1; out += pre + (last ? '└── ' : '├── ') + x + '\n'; if (c.fs.isDir(p + '/' + x)) { d++; w(p + '/' + x, pre + (last ? '    ' : '│   ')); } else f++; }); })(ab, '');
    return { out: out + '\n' + d + ' directories, ' + f + ' files\n' };
  };
  C.cat = function (a, c) {
    var p = flags(a, 'nbsvet'), r = inputs(p.rest, c, 'cat'), out = r.texts.map(function (t) { return t.text; }).join('');
    if (p.f.n) { var i = 0; out = lines(out).map(function (l) { return pad(++i, 6) + '\t' + l; }).join('\n') + '\n'; }
    if (p.f.e) out = lines(out).map(function (l) { return l + '$'; }).join('\n') + '\n';
    return { out: out, err: r.err, code: r.err ? 1 : 0 };
  };
  C.less = C.more = C.bat = function (a, c) { return C.cat(a.filter(function (x) { return x[0] !== '-'; }), c); };
  C.head = function (a, c) {
    var p = flags(a, 'n:c:', { num: true }); p.f.n = p.f.n !== undefined && p.f.n !== true ? p.f.n : (p.f.n === true ? '10' : '10');
    var r = inputs(p.rest, c, 'head'), o = '', multi = r.texts.length > 1;
    r.texts.forEach(function (t, i) {
      if (multi) o += (i ? '\n' : '') + '==> ' + t.name + ' <==\n';
      if (p.f.c !== undefined) o += t.text.slice(0, +p.f.c); else { var n = +p.f.n; o += joinL(n >= 0 ? lines(t.text).slice(0, n) : lines(t.text).slice(0, n)); }
    });
    return { out: o, err: r.err, code: r.err ? 1 : 0 };
  };
  C.tail = function (a, c) {
    var p = flags(a, 'n:c:rf', { num: true }), nn = p.f.n === undefined ? '10' : p.f.n, r = inputs(p.rest, c, 'tail'), o = '', multi = r.texts.length > 1;
    r.texts.forEach(function (t, i) {
      if (multi) o += (i ? '\n' : '') + '==> ' + t.name + ' <==\n';
      var ls = lines(t.text);
      if (p.f.c !== undefined) { o += t.text.slice(-(+p.f.c)); return; }
      var sel = /^\+/.test(nn) ? ls.slice(+nn.slice(1) - 1) : (+nn === 0 ? [] : ls.slice(-(+nn)));
      if (p.f.r) sel = sel.slice().reverse(); o += joinL(sel);
    });
    return { out: o, err: r.err, code: r.err ? 1 : 0 };
  };
  C.wc = function (a, c) {
    var p = flags(a, 'lwcm'), r = inputs(p.rest, c, 'wc'), any = p.f.l || p.f.w || p.f.c || p.f.m, o = '', tot = [0, 0, 0];
    function row(v, name) { var s = ''; if (!any || p.f.l) s += pad(v[0], 8); if (!any || p.f.w) s += pad(v[1], 8); if (!any || p.f.c || p.f.m) s += pad(v[2], 8); return s + (name ? ' ' + name : '') + '\n'; }
    r.texts.forEach(function (t) {
      var v = [(t.text.match(/\n/g) || []).length, (t.text.match(/\S+/g) || []).length, Buffer_len(t.text)];
      tot[0] += v[0]; tot[1] += v[1]; tot[2] += v[2]; o += row(v, t.name === '-' ? '' : t.name);
    });
    if (r.texts.length > 1) o += row(tot, 'total');
    return { out: o, err: r.err, code: r.err ? 1 : 0 };
  };
  function Buffer_len(s) { var n = 0; for (var i = 0; i < s.length; i++) { var cc = s.charCodeAt(i); n += cc < 128 ? 1 : cc < 2048 ? 2 : (cc >= 0xd800 && cc < 0xdc00) ? (i++, 4) : 3; } return n; }

  /* ---- text processing ---- */
  C.echo = function (a, c) {
    var nl = true, esc = false; while (a[0] && /^-[neE]+$/.test(a[0])) { if (/n/.test(a[0])) nl = false; if (/e/.test(a[0])) esc = true; a = a.slice(1); }
    var s = a.join(' '); s = s.replace(/\\(n|t|\\|a|033|e|c)/g, function (m, k) { if (!esc && !true) return m; return k === 'n' ? '\n' : k === 't' ? '\t' : k === '\\' ? '\\' : k === 'a' ? '\x07' : k === 'c' ? '' : '\x1b'; });
    return { out: s + (nl ? '\n' : '') };
  };
  function fmtPrintf(args) {
    var fmt = args[0] || '', rest = args.slice(1), idx = 0, out = '';
    function once() {
      var used = false;
      var s = fmt.replace(/%([-+ 0#]*)(\d+|\*)?(?:\.(\d+))?([sdifxXoceEg%b])|\\(n|t|\\|r|a|e|0\d*|")/g, function (m, fl, w, pr, cv, esc) {
        if (esc) return esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : esc === 'a' ? '\x07' : esc === 'e' ? '\x1b' : esc === '"' ? '"' : esc === '\\' ? '\\' : String.fromCharCode(parseInt(esc, 8) || 0);
        if (cv === '%') return '%';
        var v = rest[idx++]; used = true; var t;
        if (cv === 's' || cv === 'b') { t = v === undefined ? '' : String(v); if (pr !== undefined) t = t.slice(0, +pr); }
        else if (cv === 'c') t = v === undefined ? '' : String(v)[0] || '';
        else if (cv === 'd' || cv === 'i') { t = String(parseInt(v === undefined ? 0 : v, 10) || 0); if (fl.indexOf('+') >= 0 && t[0] !== '-') t = '+' + t; }
        else if (cv === 'f') { t = (parseFloat(v === undefined ? 0 : v) || 0).toFixed(pr === undefined ? 6 : +pr); }
        else if (cv === 'e' || cv === 'g') t = String(parseFloat(v) || 0);
        else if (cv === 'x') t = (parseInt(v, 10) || 0).toString(16); else if (cv === 'X') t = (parseInt(v, 10) || 0).toString(16).toUpperCase(); else t = (parseInt(v, 10) || 0).toString(8);
        var width = w === '*' ? +rest[idx - 1] : (w ? +w : 0);
        if (width && t.length < width) { if (fl.indexOf('-') >= 0) t = padR(t, width); else if (fl.indexOf('0') >= 0 && /[difxXo]/.test(cv)) { var neg = t[0] === '-'; t = (neg ? '-' : '') + (neg ? t.slice(1) : t).padStart(width - (neg ? 1 : 0), '0'); } else t = pad(t, width); }
        return t;
      });
      return [s, used];
    }
    do { var r = once(); out += r[0]; if (!r[1]) break; } while (idx < rest.length);
    return out;
  }
  SIM.fmtPrintf = fmtPrintf;
  C.printf = function (a) { if (!a.length) return { err: 'printf: not enough arguments\n', code: 1 }; return { out: fmtPrintf(a) }; };
  C.seq = function (a) {
    var p = flags(a, 's:f:w', { loose: true }), n = p.rest.map(Number), s = 1, st = 1, e;
    if (n.length === 1) e = n[0]; else if (n.length === 2) { s = n[0]; e = n[1]; } else { s = n[0]; st = n[1]; e = n[2]; }
    var o = []; if (st === 0) return { err: 'seq: zero increment\n', code: 1 };
    for (var x = s; st > 0 ? x <= e : x >= e; x += st) o.push(Number.isInteger(x) ? String(x) : String(+x.toFixed(10)));
    var w = Math.max.apply(null, o.map(function (z) { return z.length; }).concat([0]));
    if (p.f.w) o = o.map(function (z) { return z.padStart(w, '0'); });
    var sep = p.f.s !== undefined ? p.f.s : '\n';
    return { out: o.join(sep) + (o.length ? '\n' : '') };
  };
  C.rev = function (a, c) { var r = inputs(a, c, 'rev'); return { out: r.texts.map(function (t) { return lines(t.text).map(function (l) { return Array.from(l).reverse().join(''); }).join('\n') + '\n'; }).join(''), err: r.err }; };
  C.tac = function (a, c) { var r = inputs(a, c, 'tac'); return { out: joinL(lines(r.texts.map(function (t) { return t.text; }).join('')).reverse()), err: r.err }; };
  C.nl = function (a, c) { var p = flags(a, 'ba:', {}), r = inputs(p.rest, c, 'nl'), i = 0, o = ''; r.texts.forEach(function (t) { lines(t.text).forEach(function (l) { o += (l === '' ? '       ' : pad(++i, 6)) + '\t' + l + '\n'; }); }); return { out: o, err: r.err }; };
  C.tee = function (a, c) {
    var p = flags(a, 'a'), err = '';
    p.rest.forEach(function (f) { var ab = c.sh.abs(f); c.fs.write(ab, (p.f.a ? c.fs.read(ab) || '' : '') + c.in); });
    return { out: c.in, err: err };
  };
  C.sort = function (a, c) {
    var p = flags(a, 'nruk:t:fbhdMo:cs', { multi: { k: 1 } }), r = inputs(p.rest, c, 'sort'), ls = lines(r.texts.map(function (t) { return t.text; }).join(''));
    var keys = (p.f.k || []).map(function (k) { var m = /^(\d+)(?:\.(\d+))?(?:,(\d+)(?:\.(\d+))?)?([bdfghinMrR]*)$/.exec(k); if (!m) throw fail('invalid key: ' + k); return { s: +m[1], e: m[3] ? +m[3] : 0, fl: m[5] || '' }; });
    var sep = p.f.t;
    function field(l) { return sep !== undefined ? l.split(sep) : l.split(/(?=[ \t]+\S)/).map(function (x, i) { return x; }); }
    function getKey(l, k) {
      var fs_ = sep !== undefined ? l.split(sep) : (l.match(/\s*\S+/g) || []);
      var end = k.e || fs_.length, v = fs_.slice(k.s - 1, end).join(sep !== undefined ? sep : '');
      if (sep === undefined && (k.fl.indexOf('b') >= 0 || p.f.b)) v = v.replace(/^\s+/, '');
      return v;
    }
    var gf = { n: p.f.n, r: p.f.r, f: p.f.f, h: p.f.h, M: p.f.M };
    function cmp1(x, y, fl) {
      var nn = fl.indexOf('n') >= 0 || (!keys.length && gf.n) || fl.indexOf('g') >= 0, ff = fl.indexOf('f') >= 0 || (!keys.length && gf.f) || p.f.f, rv = fl.indexOf('r') >= 0, d;
      if (nn) { var a1 = parseFloat(x), b1 = parseFloat(y); a1 = isNaN(a1) ? 0 : a1; b1 = isNaN(b1) ? 0 : b1; d = a1 - b1; }
      else if (gf.h) { d = hv(x) - hv(y); }
      else { if (ff) { x = x.toLowerCase(); y = y.toLowerCase(); } d = x < y ? -1 : x > y ? 1 : 0; }
      return rv ? -d : d;
    }
    function hv(s) { var m = /^\s*([\d.]+)([KMGT]?)/i.exec(s); if (!m) return 0; return parseFloat(m[1]) * Math.pow(1024, 'KMGT'.indexOf(m[2].toUpperCase()) + 1); }
    var idx = ls.map(function (l, i) { return { l: l, i: i }; });
    idx.sort(function (A, B) {
      var d = 0;
      if (keys.length) { for (var i = 0; i < keys.length && d === 0; i++) d = cmp1(getKey(A.l, keys[i]), getKey(B.l, keys[i]), keys[i].fl + (gf.r && !keys[i].fl ? 'r' : '')); }
      else d = cmp1(A.l, B.l, p.f.r ? 'r' : '');
      if (d === 0 && !p.f.s) { d = A.l < B.l ? -1 : A.l > B.l ? 1 : 0; if (p.f.r && !keys.length) d = -d; if (keys.length && gf.r) d = -d; }
      return d || A.i - B.i;
    });
    var res = idx.map(function (x) { return x.l; });
    if (p.f.u) { var seen = {}; res = res.filter(function (l) { var k = keys.length ? keys.map(function (kk) { return getKey(l, kk); }).join('\u0000') : l; if (seen[k]) return false; seen[k] = 1; return true; }); }
    if (p.f.c) return { code: res.join('\n') === ls.join('\n') ? 0 : 1, err: res.join('\n') === ls.join('\n') ? '' : 'sort: ' + (p.rest[0] || '-') + ': disorder\n' };
    var o = joinL(res); if (p.f.o) { c.fs.write(c.sh.abs(p.f.o), o); return { err: r.err }; }
    return { out: o, err: r.err, code: r.err ? 2 : 0 };
  };
  C.uniq = function (a, c) {
    var p = flags(a, 'cduifs:', {}), r = inputs(p.rest.slice(0, 1), c, 'uniq'), ls = lines(r.texts.map(function (t) { return t.text; }).join('')), out = [], prev = null, cnt = 0;
    function key(l) { return p.f.i ? l.toLowerCase() : l; }
    function flush() { if (prev === null) return; if (p.f.d && cnt < 2) return; if (p.f.u && cnt > 1) return; out.push(p.f.c ? pad(cnt, 4) + ' ' + prev : prev); }
    ls.forEach(function (l) { if (prev !== null && key(l) === key(prev)) cnt++; else { flush(); prev = l; cnt = 1; } });
    flush();
    return { out: joinL(out), err: r.err };
  };
  C.cut = function (a, c) {
    var p = flags(a, 'd:f:c:b:sw', {}), r = inputs(p.rest, c, 'cut');
    var spec = p.f.f || p.f.c || p.f.b; if (!spec) return { err: 'usage: cut -b list [-n] [file ...]\n       cut -c list [file ...]\n       cut -f list [-s] [-d delim] [file ...]\n', code: 1 };
    var ranges = spec.split(',').map(function (s) { var m = /^(\d*)(-?)(\d*)$/.exec(s); return [m[1] ? +m[1] : 1, m[2] ? (m[3] ? +m[3] : Infinity) : (m[1] ? +m[1] : 1)]; });
    function pick(arr) { var o = []; arr.forEach(function (x, i) { if (ranges.some(function (rg) { return i + 1 >= rg[0] && i + 1 <= rg[1]; })) o.push(x); }); return o; }
    var o = '';
    r.texts.forEach(function (t) {
      lines(t.text).forEach(function (l) {
        if (p.f.f) { var d = p.f.d === undefined ? '\t' : p.f.d; if (l.indexOf(d) < 0) { if (!p.f.s) o += l + '\n'; return; } o += pick(l.split(d)).join(d) + '\n'; }
        else o += pick(Array.from(l)).join('') + '\n';
      });
    });
    return { out: o, err: r.err };
  };
  C.paste = function (a, c) {
    var p = flags(a, 'd:s'), d = p.f.d === undefined ? '\t' : p.f.d, r = inputs(p.rest, c, 'paste');
    if (p.f.s) return { out: r.texts.map(function (t) { return lines(t.text).join(d); }).join('\n') + '\n', err: r.err };
    var cols = r.texts.map(function (t) { return lines(t.text); }), n = Math.max.apply(null, cols.map(function (x) { return x.length; }).concat([0])), o = '';
    for (var i = 0; i < n; i++) o += cols.map(function (x) { return x[i] === undefined ? '' : x[i]; }).join(d) + '\n';
    return { out: o, err: r.err };
  };
  C.tr = function (a, c) {
    var p = flags(a, 'dsc'), sets = p.rest;
    function expand(s) {
      s = s.replace(/\[:(\w+):\]/g, function (m, k) { return ({ upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower: 'abcdefghijklmnopqrstuvwxyz', digit: '0123456789', alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', space: ' \t\n\r\f\v', blank: ' \t', punct: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' })[k] || ''; });
      s = s.replace(/\\(n|t|r|\\)/g, function (m, k) { return k === 'n' ? '\n' : k === 't' ? '\t' : k === 'r' ? '\r' : '\\'; });
      var o = ''; for (var i = 0; i < s.length; i++) { if (s[i + 1] === '-' && i + 2 < s.length) { for (var x = s.charCodeAt(i); x <= s.charCodeAt(i + 2); x++) o += String.fromCharCode(x); i += 2; } else o += s[i]; } return o;
    }
    if (!sets.length) return { err: 'usage: tr [-Ccsu] string1 string2\n       tr [-Ccu] -d string1\n       tr [-Ccu] -s string1\n       tr [-Ccu] -ds string1 string2\n', code: 1 };
    var s1 = expand(sets[0]), s2 = sets[1] !== undefined ? expand(sets[1]) : '', t = c.in, o = '';
    var inSet = function (ch) { return p.f.c ? s1.indexOf(ch) < 0 : s1.indexOf(ch) >= 0; };
    var last = null;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i], hit = inSet(ch), rep = ch;
      if (hit) {
        if (p.f.d) rep = null;
        else if (s2 !== '') { if (p.f.c) rep = s2[s2.length - 1]; else { var k = s1.indexOf(ch); rep = k < s2.length ? s2[k] : s2[s2.length - 1]; } }
      }
      if (rep === null) continue;
      if (p.f.s && hit && last === rep) continue;
      o += rep; last = hit ? rep : null;
    }
    return { out: o };
  };
  C.basename = function (a) { var s = a[0].replace(/\/+$/, ''); var b = s.split('/').pop() || '/'; if (a[1] && b.slice(-a[1].length) === a[1] && b !== a[1]) b = b.slice(0, -a[1].length); return { out: b + '\n' }; };
  C.dirname = function (a) { var s = a[0].replace(/\/+$/, ''); var i = s.lastIndexOf('/'); return { out: (i < 0 ? '.' : i === 0 ? '/' : s.slice(0, i)) + '\n' }; };
  C.column = function (a, c) {
    var p = flags(a, 'ts:'), r = inputs(p.rest, c, 'column'), ls = lines(r.texts.map(function (t) { return t.text; }).join(''));
    if (p.f.t) {
      var sep = p.f.s, rows = ls.map(function (l) { return sep ? l.split(new RegExp('[' + U.esc(sep) + ']')) : l.trim().split(/\s+/); }), n = Math.max.apply(null, rows.map(function (x) { return x.length; }));
      var w = []; for (var i = 0; i < n; i++) w[i] = Math.max.apply(null, rows.map(function (x) { return (x[i] || '').length; }));
      return { out: rows.map(function (x) { return x.map(function (v, i) { return i === x.length - 1 ? v : padR(v, w[i]); }).join('  ').replace(/\s+$/, ''); }).join('\n') + '\n' };
    }
    return { out: joinL(ls) };
  };
  C.comm = function (a, c) {
    var p = flags(a, '123'), A = lines(c.fs.read(c.sh.abs(p.rest[0])) || ''), B = lines(c.fs.read(c.sh.abs(p.rest[1])) || ''), o = '', i = 0, j = 0;
    while (i < A.length || j < B.length) {
      if (j >= B.length || (i < A.length && A[i] < B[j])) { if (!p.f['1']) o += A[i] + '\n'; i++; }
      else if (i >= A.length || B[j] < A[i]) { if (!p.f['2']) o += (p.f['1'] ? '' : '\t') + B[j] + '\n'; j++; }
      else { if (!p.f['3']) o += (p.f['1'] ? '' : '\t') + (p.f['2'] ? '' : '\t') + A[i] + '\n'; i++; j++; }
    }
    return { out: o };
  };
  C.diff = function (a, c) {
    var p = flags(a, 'uqs'), A = lines(c.fs.read(c.sh.abs(p.rest[0])) || ''), B = lines(c.fs.read(c.sh.abs(p.rest[1])) || '');
    var m = A.length, n = B.length, L = []; for (var i = 0; i <= m; i++) { L[i] = []; for (var j = 0; j <= n; j++) L[i][j] = 0; }
    for (i = m - 1; i >= 0; i--) for (j = n - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var ops = []; i = 0; j = 0;
    while (i < m && j < n) { if (A[i] === B[j]) { ops.push([' ', A[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) ops.push(['-', A[i++]]); else ops.push(['+', B[j++]]); }
    while (i < m) ops.push(['-', A[i++]]); while (j < n) ops.push(['+', B[j++]]);
    if (!ops.some(function (o) { return o[0] !== ' '; })) return { out: '' };
    if (p.f.q) return { out: 'Files ' + p.rest[0] + ' and ' + p.rest[1] + ' differ\n', code: 1 };
    if (p.f.u) { return { out: '--- ' + p.rest[0] + '\t2026-09-14 10:22:00.000000000 +0100\n+++ ' + p.rest[1] + '\t2026-09-14 10:22:00.000000000 +0100\n@@ -1,' + m + ' +1,' + n + ' @@\n' + ops.map(function (o) { return o[0] + o[1]; }).join('\n') + '\n', code: 1 }; }
    var o = '', k = 0, la = 1, lb = 1;
    while (k < ops.length) {
      if (ops[k][0] === ' ') { la++; lb++; k++; continue; }
      var dels = [], adds = [], sa = la, sb = lb;
      while (k < ops.length && ops[k][0] === '-') { dels.push(ops[k][1]); la++; k++; }
      while (k < ops.length && ops[k][0] === '+') { adds.push(ops[k][1]); lb++; k++; }
      var rng = function (s, cnt) { return cnt > 1 ? s + ',' + (s + cnt - 1) : String(s); };
      o += (dels.length && adds.length ? rng(sa, dels.length) + 'c' + rng(sb, adds.length) : dels.length ? rng(sa, dels.length) + 'd' + (sb - 1) : (sa - 1) + 'a' + rng(sb, adds.length)) + '\n';
      dels.forEach(function (l) { o += '< ' + l + '\n'; }); if (dels.length && adds.length) o += '---\n'; adds.forEach(function (l) { o += '> ' + l + '\n'; });
    }
    return { out: o, code: 1 };
  };

  /* ---- grep ---- */
  function grepCmd(a, c, forceE) {
    var p = flags(a, 'ivcnEFoqwlLrRhHxsA:B:C:m:e:', { multi: { e: 1 }, long: { 'color': 'G', 'extended-regexp': 'E', 'ignore-case': 'i', 'invert-match': 'v', 'count': 'c', 'line-number': 'n', 'recursive': 'r' } });
    var f = p.f; if (forceE) f.E = true;
    var pats = f.e ? f.e : [p.rest.shift()];
    if (pats[0] === undefined) return { err: 'usage: grep [-abcdDEFGHhIiJLlMmnOopqRSsUVvwXxZz] [-A num] [-B num] [-C[num]]\n\t[-e pattern] [-f file] [--binary-files=value] [--color=when]\n\t[--context[=num]] [--directories=action] [--label] [--line-buffered]\n\t[--null] [pattern] [file ...]\n', code: 2 };
    var res = pats.map(function (pt) { if (f.F) pt = pt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); var src = f.F ? pt : null; var re = f.F ? new RegExp(pt, f.i ? 'i' : '') : rx(pt, !!f.E, !!f.i); if (f.w) re = new RegExp('(?<![A-Za-z0-9_])(?:' + re.source + ')(?![A-Za-z0-9_])', re.flags); if (f.x) re = new RegExp('^(?:' + re.source + ')$', re.flags); return re; });
    function hit(l) { return res.some(function (re) { return re.test(l); }); }
    var files = p.rest, targets = [], err = '', rec = f.r || f.R;
    if (!files.length) { if (rec) files = ['.']; else targets.push({ name: '(standard input)', text: c.in }); }
    files.forEach(function (fl) {
      var ab = c.sh.abs(fl);
      if (c.fs.isDir(ab)) { if (!rec) { err += 'grep: ' + fl + ': Is a directory\n'; return; } (function w(d, show) { c.fs.list(d).forEach(function (n) { var q = d + '/' + n, sh = show + '/' + n; if (c.fs.isDir(q)) w(q, sh); else targets.push({ name: sh.replace(/^\.\//, fl === '.' ? '' : ''), text: c.fs.read(q) }); }); })(ab, fl === '.' ? '.' : fl.replace(/\/$/, '')); return; }
      var t = c.fs.read(ab); if (t === null) { if (!f.s) err += 'grep: ' + fl + ': No such file or directory\n'; } else targets.push({ name: fl, text: t });
    });
    var multi = (targets.length > 1 || rec) && !f.h || f.H, o = '', any = false, A = +(f.A || f.C || 0), B = +(f.B || f.C || 0);
    targets.forEach(function (t) {
      var ls = lines(t.text), count = 0, printed = {}, lastP = -2, outL = [];
      for (var i = 0; i < ls.length; i++) {
        var h = hit(ls[i]); if (f.v) h = !h;
        if (!h) continue;
        count++; any = true; if (f.q) return;
        if (f.m && count > +f.m) { count--; break; }
        if (f.l || f.L || f.c) continue;
        var from = Math.max(0, i - B), to = Math.min(ls.length - 1, i + A);
        if ((A || B) && from > lastP + 1 && lastP >= 0 && outL.length) outL.push('--');
        for (var k = from; k <= to; k++) {
          if (printed[k] && k <= lastP) continue; printed[k] = 1; lastP = k;
          var sep = k === i ? ':' : '-';
          if (f.o) { if (k !== i) continue; var re = res[0], g = new RegExp(re.source, re.flags.replace('g', '') + 'g'), m; while ((m = g.exec(ls[k])) && m[0] !== '') outL.push((multi ? t.name + ':' : '') + (f.n ? (k + 1) + ':' : '') + m[0]); }
          else outL.push((multi ? t.name + sep : '') + (f.n ? (k + 1) + sep : '') + ls[k]);
        }
      }
      if (f.l) { if (count) o += t.name + '\n'; } else if (f.L) { if (!count) o += t.name + '\n'; }
      else if (f.c) o += (multi ? t.name + ':' : '') + count + '\n'; else o += outL.length ? outL.join('\n') + '\n' : '';
    });
    return { out: f.q ? '' : o, err: err, code: err && !any ? 2 : (any ? 0 : 1) };
  }
  C.grep = function (a, c) { return grepCmd(a, c, false); };
  C.egrep = function (a, c) { return grepCmd(a, c, true); };
  C.fgrep = function (a, c) { return grepCmd(['-F'].concat(a), c, false); };

  /* ---- sed ---- */
  C.sed = function (a, c) {
    var p = flags(a, 'nEre:i:f:s', { multi: { e: 1 } }), f = p.f, script = f.e ? f.e.join('\n') : p.rest.shift();
    if (script === undefined) return { err: 'usage: sed script [-Ealnru] [-i extension] [file ...]\n       sed [-Ealnru] [-e script] ... [-f script_file] ... [file ...]\n', code: 1 };
    var ere = !!(f.E || f.r), cmds = parseSed(script, ere);
    var inplace = f.i !== undefined;
    var files = p.rest, texts;
    if (inplace && f.i !== '' && f.i !== true && files.length === 0 && p.rest.length === 0) { /* -i ext consumed script? handled below */ }
    if (inplace && !files.length) return { err: 'sed: no input files\n', code: 1 };
    var r = inputs(files, c, 'sed'), o = '';
    function runOne(text) {
      var ls = lines(text), out = [], N = ls.length, quit = false, hold = '';
      for (var i = 0; i < N && !quit; i++) {
        var ps = ls[i], del = false, auto = !f.n, app = [], ln = i + 1;
        for (var k = 0; k < cmds.length; k++) {
          var cm = cmds[k];
          if (!inRange(cm, ps, ln, N)) continue;
          switch (cm.c) {
            case 's': { var cnt = 0, g = cm.g; var nw = ps.replace(new RegExp(cm.re.source, cm.re.flags + (g ? 'g' : '')), function () { cnt++; if (cm.n && !g && cnt !== cm.n) return arguments[0]; if (cm.n && g && cnt < cm.n) return arguments[0]; var m = [].slice.call(arguments); return cm.rep.replace(/\\(\d)|&|\\&|\\n|\\t/g, function (x, d) { if (x === '&') return m[0]; if (x === '\\&') return '&'; if (x === '\\n') return '\n'; if (x === '\\t') return '\t'; return m[+d] === undefined ? '' : m[+d]; }); }); if (nw !== ps) { ps = nw; if (cm.p) out.push(ps); } break; }
            case 'd': del = true; k = cmds.length; break;
            case 'p': out.push(ps); break;
            case 'q': quit = true; k = cmds.length; break;
            case 'y': ps = Array.from(ps).map(function (ch) { var ix = cm.from.indexOf(ch); return ix < 0 ? ch : cm.to[ix]; }).join(''); break;
            case 'a': app.push(cm.text); break;
            case 'i': out.push(cm.text); break;
            case 'c': out.push(cm.text); del = true; k = cmds.length; break;
            case '=': out.push(String(ln)); break;
          }
        }
        if (!del && auto) out.push(ps);
        app.forEach(function (t) { out.push(t); });
      }
      return joinL(out);
    }
    if (inplace) { r.texts.forEach(function (t) { c.fs.write(c.sh.abs(t.name), runOne(t.text)); }); return { err: r.err }; }
    r.texts.forEach(function (t) { o += runOne(t.text); });
    return { out: o, err: r.err, code: r.err ? 1 : 0 };
  };
  function inRange(cm, line, n, N) {
    if (!cm.a1) return true;
    function m(a) { return a.t === 'n' ? n === a.v : a.t === '$' ? n === N : a.re.test(line); }
    var r;
    if (!cm.a2) r = m(cm.a1);
    else {
      if (cm.on) { r = true; if (m(cm.a2) || (cm.a2.t === 'n' && n >= cm.a2.v)) cm.on = false; }
      else if (m(cm.a1)) { r = true; if (!(cm.a2.t === 'n' && cm.a2.v <= n) && !(cm.a2.t === '$' && n === N)) { if (cm.a2.t !== 'n' || cm.a2.v > n) cm.on = true; } }
      else r = false;
    }
    return cm.neg ? !r : r;
  }
  function parseSed(s, ere) {
    var out = [], i = 0;
    function addr() {
      var m;
      if ((m = /^\d+/.exec(s.slice(i)))) { i += m[0].length; return { t: 'n', v: +m[0] }; }
      if (s[i] === '$') { i++; return { t: '$' }; }
      if (s[i] === '/') { var j = i + 1, b = ''; while (j < s.length && s[j] !== '/') { if (s[j] === '\\' && s[j + 1] === '/') { b += '/'; j += 2; continue; } if (s[j] === '\\') { b += s[j] + s[j + 1]; j += 2; continue; } b += s[j++]; } i = j + 1; return { t: 're', re: rx(b, ere) }; }
      return null;
    }
    while (i < s.length) {
      while (i < s.length && /[\s;]/.test(s[i])) i++;
      if (i >= s.length) break;
      var cm = {}; cm.a1 = addr(); if (cm.a1 && s[i] === ',') { i++; cm.a2 = addr(); }
      while (s[i] === ' ') i++; if (s[i] === '!') { cm.neg = true; i++; while (s[i] === ' ') i++; }
      var ch = s[i++]; cm.c = ch;
      if (ch === 's') {
        var d = s[i++], parts = [], buf = '';
        while (i < s.length && parts.length < 2) { if (s[i] === '\\' && s[i + 1] === d) { buf += d === '|' || d === '/' || d === '#' ? (parts.length === 0 && d !== '/' ? '\\' + d : d) : d; i += 2; continue; } if (s[i] === '\\') { buf += s[i] + s[i + 1]; i += 2; continue; } if (s[i] === d) { parts.push(buf); buf = ''; i++; continue; } buf += s[i++]; }
        if (parts.length < 2) throw fail('sed: 1: "' + s + '": unterminated substitute pattern');
        var fl = ''; while (i < s.length && /[gpiI0-9]/.test(s[i])) fl += s[i++];
        cm.re = rx(parts[0], ere, /[iI]/.test(fl)); cm.rep = parts[1]; cm.g = fl.indexOf('g') >= 0; cm.p = fl.indexOf('p') >= 0; var mn = /\d+/.exec(fl); cm.n = mn ? +mn[0] : 0;
      } else if (ch === 'y') { var d2 = s[i++], e1 = s.indexOf(d2, i), e2 = s.indexOf(d2, e1 + 1); cm.from = Array.from(s.slice(i, e1)); cm.to = Array.from(s.slice(e1 + 1, e2)); i = e2 + 1; }
      else if (ch === 'a' || ch === 'i' || ch === 'c') { if (s[i] === '\\') i++; while (s[i] === ' ') i++; var e = s.indexOf('\n', i); if (e < 0) e = s.length; cm.text = s.slice(i, e); i = e; }
      else if (!/[dpq=]/.test(ch)) throw fail('sed: 1: "' + s + '": unknown command: ' + ch);
      out.push(cm);
    }
    return out;
  }

  /* ---- find ---- */
  C.find = function (a, c) {
    var starts = [], i = 0; while (i < a.length && a[i][0] !== '-' && a[i] !== '!' && a[i] !== '(') starts.push(a[i++]);
    if (!starts.length) starts = ['.'];
    var exprs = a.slice(i), conds = [], maxd = Infinity, mind = 0, action = null, execs = [], del = false, printed = false;
    for (var k = 0; k < exprs.length; k++) {
      var e = exprs[k], neg = false;
      if (e === '!' || e === '-not') { neg = true; e = exprs[++k]; }
      var cond = null;
      if (e === '-name' || e === '-iname') { var re = SIM.util.globRe(exprs[++k]); cond = { f: function (n, x, rel, nm) { return re.test(nm); } }; if (e === '-iname') { var re2 = new RegExp(re.source, 'i'); cond = { f: function (n, x, rel, nm) { return re2.test(nm); } }; } }
      else if (e === '-type') { var ty = exprs[++k]; cond = { f: function (n, x) { return ty === 'd' ? !!x.d : ty === 'f' ? x.f !== undefined : false; } }; }
      else if (e === '-maxdepth') maxd = +exprs[++k]; else if (e === '-mindepth') mind = +exprs[++k];
      else if (e === '-empty') cond = { f: function (n, x) { return x.d ? SIM.__fs.list(n).length === 0 : x.f === ''; } };
      else if (e === '-size') { var sz = exprs[++k], m = /^([+-]?)(\d+)([ckMGb]?)$/.exec(sz); var mult = { c: 1, k: 1024, M: 1048576, G: 1073741824, b: 512, '': 512 }[m[3]]; cond = { f: function (n, x) { var s = x.f !== undefined ? x.f.length : 0, u = Math.ceil(s / mult); return m[1] === '+' ? u > +m[2] : m[1] === '-' ? u < +m[2] : u === +m[2]; } }; }
      else if (e === '-path') { var pr = SIM.util.globRe(exprs[++k]); cond = { f: function (n, x, rel) { return pr.test(rel); } }; }
      else if (e === '-mtime') { exprs[++k]; cond = { f: function () { return true; } }; }
      else if (e === '-print') printed = true;
      else if (e === '-delete') del = true;
      else if (e === '-exec') { var cmd = []; k++; while (exprs[k] !== ';' && exprs[k] !== '+' && k < exprs.length) cmd.push(exprs[k++]); execs.push({ cmd: cmd, plus: exprs[k] === '+' }); }
      else if (e === '-o' || e === '-a' || e === '(' || e === ')') { if (e === '-o') return { err: 'find: -o is not supported by the simulator; use two commands\n', code: 1 }; }
      else return { err: 'find: unknown primary or operator: ' + e + '\n', code: 1 };
      if (cond) { cond.neg = neg; conds.push(cond); }
    }
    SIM.__fs = c.fs;
    var out = '', err = '', hits = [];
    starts.forEach(function (st) {
      var ab = c.sh.abs(st); if (!c.fs.get(ab)) { err += 'find: ' + st + ': No such file or directory\n'; return; }
      (function walk(p, disp, d) {
        var x = c.fs.get(p), nm = disp.split('/').pop();
        if (d >= mind) { var ok = conds.every(function (cd) { var r = cd.f(p, x, disp, nm === '.' ? '.' : nm); return cd.neg ? !r : r; }); if (ok) hits.push({ disp: disp, p: p }); }
        if (x.d && d < maxd) c.fs.list(p).forEach(function (n) { walk(p + '/' + n, disp.replace(/\/$/, '') + '/' + n, d + 1); });
      })(ab, st, 0);
    });
    if (del) hits.slice().reverse().forEach(function (h) { c.fs.rm(h.p); });
    else if (execs.length) execs.forEach(function (ex) {
      if (ex.plus) { var r = c.sh.runCmd(ex.cmd.filter(function (x) { return x !== '{}'; }).concat(hits.map(function (h) { return h.disp; })), { in: '' }); out += r.out; err += r.err; }
      else hits.forEach(function (h) { var r = c.sh.runCmd(ex.cmd.map(function (x) { return x === '{}' ? h.disp : x; }), { in: '' }); out += r.out; err += r.err; });
    });
    else out = hits.map(function (h) { return h.disp + '\n'; }).join('');
    return { out: out, err: err, code: err ? 1 : 0 };
  };
  C.xargs = function (a, c) {
    var p = flags(a, 'n:I:0tPr:L:s:', { stopAtFirst: true }), cmd = p.rest.length ? p.rest : ['echo'], items;
    if (p.f['0']) items = c.in.split('\0').filter(Boolean); else items = (c.in.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(function (x) { return x.replace(/^["']|["']$/g, ''); });
    var out = '', err = '', last = 0;
    if (!items.length) { if (p.f.r) return {}; items = []; }
    function go(argv) { if (p.f.t) err += argv.join(' ') + '\n'; var r = c.sh.runCmd(argv, { in: '' }); out += r.out; err += r.err; last = c.sh.status; }
    if (p.f.I) items.forEach(function (it) { go(cmd.map(function (x) { return x.split(p.f.I).join(it); })); });
    else if (p.f.n) for (var i = 0; i < items.length; i += +p.f.n) go(cmd.concat(items.slice(i, i + +p.f.n)));
    else go(cmd.concat(items));
    c.sh.status = last; return { out: out, err: err, code: last };
  };

  /* ---- awk ---- */
  C.awk = function (a, c) {
    var p = flags(a, 'F:v:f:', { multi: { v: 1 } }), prog = p.f.f ? c.fs.read(c.sh.abs(p.f.f)) : p.rest.shift();
    if (prog === undefined) return { err: 'usage: awk [-F fs][-v var=value][prog | -f progfile][file ...]\n', code: 2 };
    var vars = {}; (p.f.v || []).forEach(function (kv) { var i = kv.indexOf('='); vars[kv.slice(0, i)] = kv.slice(i + 1); });
    var r = inputs(p.rest, c, 'awk'); if (r.err && !r.texts.length) return { err: r.err.replace(/awk: (.*): No such file or directory/, 'awk: can\'t open file $1\n source line number 1').replace(/\n$/, '') + '\n', code: 2 };
    var res = SIM.awk(prog, r.texts, p.f.F, vars, c);
    res.err = (r.err || '') + (res.err || ''); return res;
  };
  C.date = function (a, c) {
    var p = flags(a, 'uvj', { loose: true }), fmt = p.rest.filter(function (x) { return x[0] === '+'; })[0], d = NOW;
    if (!fmt) return { out: 'Thu Oct  8 09:41:00 BST 2026\n' };
    var D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], two = function (n) { return pad(n, 2).replace(' ', '0'); };
    var s = fmt.slice(1).replace(/%([a-zA-Z%])/g, function (m, k) { switch (k) { case 'Y': return d.getFullYear(); case 'm': return two(d.getMonth() + 1); case 'd': return two(d.getDate()); case 'H': return two(d.getHours()); case 'M': return two(d.getMinutes()); case 'S': return two(d.getSeconds()); case 'y': return two(d.getFullYear() % 100); case 'b': return MON[d.getMonth()]; case 'a': return D[d.getDay()]; case 'Z': return 'BST'; case 'z': return '+0100'; case 's': return String(Math.floor(d / 1000)); case 'F': return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()); case 'T': return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()); case 'j': return '281'; case 'e': return pad(d.getDate(), 2); case '%': return '%'; default: return m; } });
    return { out: s + '\n' };
  };
  C.whoami = function () { return { out: 'learner\n' }; };
  C.id = function () { return { out: 'uid=501(learner) gid=20(staff) groups=20(staff),12(everyone),61(localaccounts),80(admin),701(com.apple.sharepoint.group.1)\n' }; };
  C.hostname = function (a) { return { out: 'macbook.local\n' }; };
  C.uname = function (a) { var p = flags(a, 'amsrnv'); if (p.f.a) return { out: 'Darwin macbook.local 25.0.0 Darwin Kernel Version 25.0.0: Mon Aug 25 21:17:51 PDT 2026; root:xnu-12377.1.9~3/RELEASE_ARM64_T6000 arm64\n' }; if (p.f.r) return { out: '25.0.0\n' }; if (p.f.m) return { out: 'arm64\n' }; return { out: 'Darwin\n' }; };
  C.sw_vers = function () { return { out: 'ProductName:\t\tmacOS\nProductVersion:\t\t26.0\nBuildVersion:\t\t25A354\n' }; };
  C.env = C.printenv = function (a, c) { if (a.length && c.name === 'printenv') return { out: (c.env[a[0]] || '') + '\n', code: c.env[a[0]] === undefined ? 1 : 0 }; return { out: Object.keys(c.env).map(function (k) { return k + '=' + c.env[k]; }).join('\n') + '\n' }; };
  C.export = function (a, c) {
    a.forEach(function (x) { var i = x.indexOf('='); if (i < 0) { if (x in c.sh.vars) { c.env[x] = c.sh.vars[x]; delete c.sh.vars[x]; } else if (!(x in c.env)) c.env[x] = ''; } else { c.env[x.slice(0, i)] = x.slice(i + 1); delete c.sh.vars[x.slice(0, i)]; } });
    return {};
  };
  C.unset = function (a, c) { a.forEach(function (k) { delete c.env[k]; delete c.sh.vars[k]; }); return {}; };
  C.alias = function (a, c) { if (!a.length) return { out: Object.keys(c.sh.aliases).map(function (k) { return k + "='" + c.sh.aliases[k] + "'"; }).join('\n') + (Object.keys(c.sh.aliases).length ? '\n' : '') }; a.forEach(function (x) { var i = x.indexOf('='); if (i > 0) c.sh.aliases[x.slice(0, i)] = x.slice(i + 1); }); return {}; };
  C.set = function () { return {}; }; C.setopt = function () { return {}; }; C.source = C['.'] = function () { return {}; };
  C.history = function (a, c) { return { out: c.sh.history.map(function (h, i) { return pad(i + 1, 5) + '  ' + h; }).join('\n') + '\n' }; };
  C.true = function () { return {}; }; C.false = function () { return { code: 1 }; }; C[':'] = C.true;
  C.sleep = function () { return {}; };
  C.clear = function () { return { out: '\x1b[clear]' }; };
  C.exit = function () { return { out: '' }; };
  C.read = function (a, c) { var v = a.filter(function (x) { return x[0] !== '-'; })[0] || 'REPLY'; var l = c.in.split('\n')[0]; c.sh.vars[v] = l; return { code: c.in === '' ? 1 : 0 }; };
  var BINP = { ping: '/sbin/ping', ifconfig: '/sbin/ifconfig', route: '/sbin/route', netstat: '/usr/sbin/netstat', arp: '/usr/sbin/arp', lsof: '/usr/sbin/lsof', traceroute: '/usr/sbin/traceroute', scutil: '/usr/sbin/scutil', ipconfig: '/usr/sbin/ipconfig', networksetup: '/usr/sbin/networksetup', nmap: '/opt/homebrew/bin/nmap', wg: '/opt/homebrew/bin/wg', tree: '/opt/homebrew/bin/tree' };
  'ls cat cp mv rm mkdir rmdir echo pwd sleep date ps chmod ln sh kill test dd df'.split(' ').forEach(function (n) { BINP[n] = '/bin/' + n; });
  var BUILTIN = /^(cd|echo|pwd|export|alias|type|source|read|set|unset|history|exit|true|false|test|printf|command|which|\[|\[\[|setopt)$/;
  C.type = C.which = C.command = function (a, c) {
    var o = '', code = 0, names = a.filter(function (x) { return x[0] !== '-'; }), isType = c.name === 'type', vflag = a.indexOf('-v') >= 0;
    names.forEach(function (n) {
      var path = BINP[n] || '/usr/bin/' + n;
      if (c.sh.aliases[n]) o += isType ? n + ' is an alias for ' + c.sh.aliases[n] + '\n' : c.name === 'which' ? n + ': aliased to ' + c.sh.aliases[n] + '\n' : "alias " + n + "='" + c.sh.aliases[n] + "'\n";
      else if (BUILTIN.test(n) && !(n === 'echo' || n === 'pwd' || n === 'test' || n === 'printf' || n === 'true' || n === 'false') ) o += isType ? n + ' is a shell builtin\n' : c.name === 'which' ? n + ': shell built-in command\n' : n + '\n';
      else if (C[n] && n !== 'which') o += isType ? n + ' is ' + path + '\n' : path + '\n';
      else { code = 1; if (isType) o += 'type: ' + n + ' not found\n'; else if (c.name === 'which') o += n + ' not found\n'; }
    });
    return { out: c.name === 'command' && !vflag && a.indexOf('-V') < 0 ? '' : o, code: code };
  };
  C.test = C['['] = function (a, c) {
    var args = a.slice(); if (c.name === '[') { if (args.pop() !== ']') return { err: 'zsh: [: missing ]\n', code: 2 }; }
    return { code: evalTest(args, c) ? 0 : 1 };
  };
  C['[['] = function (a, c) { if (a[a.length - 1] === ']]') a = a.slice(0, -1); return { code: evalTest(a, c, true) ? 0 : 1 }; };
  function evalTest(a, c, dbl) {
    function one(x) {
      if (x[0] === '!') return !evalTest(x.slice(1), c, dbl);
      if (x.length === 1) return x[0] !== '';
      if (x.length === 2) { var f = x[0], v = x[1], ab = c.sh.abs(v); switch (f) { case '-n': return v !== ''; case '-z': return v === ''; case '-e': return !!c.fs.get(ab); case '-f': return c.fs.isFile(ab); case '-d': return c.fs.isDir(ab); case '-s': return c.fs.isFile(ab) && c.fs.read(ab).length > 0; case '-r': case '-w': return !!c.fs.get(ab); case '-x': var nd = c.fs.get(ab); return !!(nd && (nd.d || /x/.test(nd.perm || ''))); case '-L': return false; } }
      if (x.length === 3) { var l = x[0], op = x[1], r = x[2]; switch (op) { case '=': case '==': return dbl && /[*?]/.test(r) ? SIM.util.globRe(r).test(l) : l === r; case '!=': return l !== r; case '-eq': return +l === +r; case '-ne': return +l !== +r; case '-lt': return +l < +r; case '-le': return +l <= +r; case '-gt': return +l > +r; case '-ge': return +l >= +r; case '=~': return new RegExp(r).test(l); case '<': return l < r; case '>': return l > r; } }
      return false;
    }
    var i = a.indexOf('&&'), j = a.indexOf('||'), k = a.indexOf('-a'), m = a.indexOf('-o');
    if (j >= 0) return evalTest(a.slice(0, j), c, dbl) || evalTest(a.slice(j + 1), c, dbl);
    if (m >= 0 && !dbl) return evalTest(a.slice(0, m), c, dbl) || evalTest(a.slice(m + 1), c, dbl);
    if (i >= 0) return evalTest(a.slice(0, i), c, dbl) && evalTest(a.slice(i + 1), c, dbl);
    if (k >= 0 && !dbl && a.length > 3) return evalTest(a.slice(0, k), c, dbl) && evalTest(a.slice(k + 1), c, dbl);
    return one(a);
  }
  C.chmod = function (a, c) {
    var mode = a[0], err = '';
    a.slice(1).forEach(function (f) {
      var ab = c.sh.abs(f), x = c.fs.get(ab); if (!x) { err += 'chmod: ' + f + ': No such file or directory\n'; return; }
      var cur = (x.perm || (x.d ? 'rwxr-xr-x' : 'rw-r--r--')).split('');
      if (/^[0-7]{3,4}$/.test(mode)) { var d = mode.slice(-3).split('').map(Number); cur = d.map(function (n) { return (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-'); }).join('').split(''); }
      else mode.split(',').forEach(function (cl) { var m = /^([ugoa]*)([+\-=])([rwx]*)$/.exec(cl); if (!m) return; var who = m[1] === '' || m[1] === 'a' ? 'ugo' : m[1]; who.split('').forEach(function (w) { var base = { u: 0, g: 3, o: 6 }[w]; 'rwx'.split('').forEach(function (b, bi) { var has = m[3].indexOf(b) >= 0; if (m[2] === '+' && has) cur[base + bi] = b; else if (m[2] === '-' && has) cur[base + bi] = '-'; else if (m[2] === '=') cur[base + bi] = has ? b : '-'; }); }); });
      x.perm = cur.join('');
    });
    return { err: err, code: err ? 1 : 0 };
  };
  C.stat = function (a, c) { var o = ''; a.filter(function (x) { return x[0] !== '-'; }).forEach(function (f) { var x = c.fs.get(c.sh.abs(f)); if (!x) { o += 'stat: ' + f + ': stat: No such file or directory\n'; return; } o += '16777234 123456 ' + modeStr(x, x.d) + ' 1 learner staff 0 ' + (x.d ? 64 : x.f.length) + ' "Sep 14 10:22:00 2026" "Sep 14 10:22:00 2026" "Sep 14 10:22:00 2026" "Sep 14 10:22:00 2026" 4096 8 0 ' + f + '\n'; }); return { out: o }; };
  C.file = function (a, c) { var o = ''; a.forEach(function (f) { var x = c.fs.get(c.sh.abs(f)); o += f + ': ' + (!x ? 'cannot open `' + f + "' (No such file or directory)" : x.d ? 'directory' : x.f === '' ? 'empty' : /\.csv$/.test(f) ? 'CSV text' : /^#!/.test(x.f) ? 'a /bin/zsh script text executable, ASCII text' : 'ASCII text') + '\n'; }); return { out: o }; };
  C.du = function (a, c) { var p = flags(a, 'shkca', { loose: true }), t = p.rest[0] || '.', ab = c.sh.abs(t); function sz(q) { var x = c.fs.get(q); if (!x) return 0; return x.d ? c.fs.list(q).reduce(function (s, n) { return s + sz(q + '/' + n); }, 0) : Math.ceil(x.f.length / 4096) * 8; } var s = sz(ab); return { out: (p.f.h ? human(s * 512) : s) + '\t' + t + '\n' }; };
  C.df = function () { return { out: 'Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on\n/dev/disk3s1s1   460Gi    11Gi   312Gi     4%  426k 3.3G    0%   /\n' }; };
  C.ps = function () { return { out: '  PID TTY           TIME CMD\n 4242 ttys000    0:00.12 -zsh\n 4310 ttys000    0:00.00 ps\n' }; };
  C.man = function (a) { return { out: 'No manual entry for ' + (a[0] || '') + ' in the simulator. On your Mac: man ' + (a[0] || 'ls') + '\n' }; };
  C.open = function () { return { err: 'open: not available in the simulator\n', code: 1 }; };
  C.sudo = function (a, c) { return { err: 'sudo: the simulator does not run commands as root. On your Mac this would ask for your password.\n', code: 1 }; };
  C.python3 = C.python = function (a, c) { return { err: 'python3: the practice terminal only simulates shell tools. Use the Python playground in the Python chapters.\n', code: 1 }; };
  C.git = function (a) { return { err: 'git: not simulated here. See the git commands in your own Terminal.\n', code: 1 }; };
  C.less = C.more = C.cat;
})(SIM);

/* A compact AWK interpreter (POSIX subset + common one-true-awk behaviour as shipped on macOS). */
(function (SIM) {
  'use strict';
  var KW = { BEGIN: 1, END: 1, function: 1, 'if': 1, 'else': 1, 'while': 1, 'for': 1, 'do': 1, 'break': 1, 'continue': 1, next: 1, exit: 1, print: 1, printf: 1, 'delete': 1, 'in': 1, getline: 1, 'return': 1 };
  var BUILTIN = { length: 1, substr: 1, index: 1, split: 1, sub: 1, gsub: 1, match: 1, sprintf: 1, sin: 1, cos: 1, atan2: 1, exp: 1, log: 1, sqrt: 1, int: 1, rand: 1, srand: 1, tolower: 1, toupper: 1, system: 1 };
  function lex(src) {
    var t = [], i = 0, n = src.length, prev = null;
    function regexOk() { return !prev || (prev.k === 'op' && !/^[)\]]$/.test(prev.v) && prev.v !== '++' && prev.v !== '--') || (prev.k === 'kw'); }
    while (i < n) {
      var c = src[i];
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
      if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
      var tok;
      if (c === '\n') { tok = { k: 'nl' }; i++; }
      else if (/[0-9.]/.test(c) && (c !== '.' || /[0-9]/.test(src[i + 1] || ''))) { var m = /^(0[xX][0-9a-fA-F]+|\d*\.?\d+(?:[eE][+-]?\d+)?|\d+\.)/.exec(src.slice(i)); tok = { k: 'num', v: parseFloat(m[0]) }; i += m[0].length; }
      else if (/[A-Za-z_]/.test(c)) { var m2 = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))[0]; i += m2.length; tok = KW[m2] ? { k: 'kw', v: m2 } : BUILTIN[m2] ? { k: 'fn', v: m2 } : { k: 'id', v: m2 }; if (tok.k === 'id' && src[i] === '(') tok.call = 1; }
      else if (c === '"') { var s = '', j = i + 1; while (j < n && src[j] !== '"') { if (src[j] === '\\') { j++; var e = src[j]; s += e === 'n' ? '\n' : e === 't' ? '\t' : e === '\\' ? '\\' : e === '"' ? '"' : e === '/' ? '/' : e === 'r' ? '\r' : '\\' + e; j++; } else s += src[j++]; } tok = { k: 'str', v: s }; i = j + 1; }
      else if (c === '/' && regexOk()) { var j2 = i + 1, rs = ''; while (j2 < n && src[j2] !== '/') { if (src[j2] === '\\' && src[j2 + 1] === '/') { rs += '/'; j2 += 2; continue; } if (src[j2] === '\\') { rs += src[j2] + src[j2 + 1]; j2 += 2; continue; } if (src[j2] === '[') { while (j2 < n && src[j2] !== ']') rs += src[j2++]; } rs += src[j2++]; } tok = { k: 're', v: rs }; i = j2 + 1; }
      else {
        var ops = ['&&', '||', '==', '!=', '<=', '>=', '++', '--', '+=', '-=', '*=', '/=', '%=', '^=', '!~', '>>', '**'];
        var o = null; for (var q = 0; q < ops.length; q++) if (src.substr(i, 2) === ops[q]) { o = ops[q]; break; }
        if (!o) o = c; i += o.length; tok = { k: 'op', v: o === '**' ? '^' : o };
      }
      t.push(tok); prev = tok;
    }
    t.push({ k: 'eof' }); return t;
  }
  function parse(src) {
    var T = lex(src), p = 0, funcs = {}, items = [];
    function pk() { return T[p]; }
    function isOp(v) { return T[p].k === 'op' && T[p].v === v; }
    function isKw(v) { return T[p].k === 'kw' && T[p].v === v; }
    function eat(v) { if (!isOp(v)) throw new Error('syntax error at source line 1\n context is\n\t>>> ' + (T[p].v === undefined ? T[p].k : T[p].v) + ' <<<'); p++; }
    function skipNl() { while (T[p].k === 'nl' || isOp(';')) p++; }
    function optNl() { while (T[p].k === 'nl') p++; }
    function block() { eat('{'); var st = []; skipNl(); while (!isOp('}')) { st.push(stmt()); skipNl(); } eat('}'); return { t: 'block', st: st }; }
    function simpleOrBlock() { optNl(); if (isOp('{')) return block(); var s = stmt(); return s; }
    function endStmt() { if (isOp(';') || T[p].k === 'nl') { p++; return; } if (isOp('}') || T[p].k === 'eof') return; throw new Error('syntax error at source line 1'); }
    function stmt() {
      if (isOp('{')) return block();
      if (isKw('if')) { p++; eat('('); var c = expr(); eat(')'); var th = simpleOrBlock(), el = null; var sv = p; skipNl(); if (isKw('else')) { p++; el = simpleOrBlock(); } else p = sv; return { t: 'if', c: c, th: th, el: el }; }
      if (isKw('while')) { p++; eat('('); var c2 = expr(); eat(')'); return { t: 'while', c: c2, b: simpleOrBlock() }; }
      if (isKw('do')) { p++; var b = simpleOrBlock(); skipNl(); if (!isKw('while')) throw new Error('syntax error'); p++; eat('('); var c3 = expr(); eat(')'); endStmt(); return { t: 'do', c: c3, b: b }; }
      if (isKw('for')) {
        p++; eat('(');
        if (T[p].k === 'id' && T[p + 1].k === 'kw' && T[p + 1].v === 'in') { var v = T[p].v; p += 2; var arr = T[p++].v; eat(')'); return { t: 'forin', v: v, arr: arr, b: simpleOrBlock() }; }
        var init = isOp(';') ? null : simple(); eat(';'); optNl(); var cond = isOp(';') ? null : expr(); eat(';'); optNl(); var inc = isOp(')') ? null : simple(); eat(')');
        return { t: 'for', init: init, c: cond, inc: inc, b: simpleOrBlock() };
      }
      var s = simple(); endStmt(); return s;
    }
    function simple() {
      var k = T[p];
      if (k.k === 'kw') {
        if (k.v === 'break' || k.v === 'continue' || k.v === 'next') { p++; return { t: k.v }; }
        if (k.v === 'exit') { p++; var e = (isOp(';') || isOp('}') || T[p].k === 'nl') ? null : expr(); return { t: 'exit', e: e }; }
        if (k.v === 'return') { p++; var e2 = (isOp(';') || isOp('}') || T[p].k === 'nl') ? null : expr(); return { t: 'return', e: e2 }; }
        if (k.v === 'delete') { p++; var nm = T[p++].v; if (isOp('[')) { p++; var idx = exprList(); eat(']'); return { t: 'delete', a: nm, i: idx }; } return { t: 'delete', a: nm }; }
        if (k.v === 'print' || k.v === 'printf') {
          p++; var args = [];
          if (!(isOp(';') || isOp('}') || T[p].k === 'nl' || isOp('>') || isOp('|') || isOp('>>'))) { var par = isOp('(') ? tryParenList() : null; args = par || exprList(true); }
          var redir = null; if (isOp('>') || isOp('>>') || isOp('|')) { var ro = T[p++].v; redir = { op: ro, e: concat(true) }; }
          return { t: k.v, a: args, redir: redir };
        }
      }
      return { t: 'expr', e: expr() };
    }
    function tryParenList() { var sv = p; p++; var l = exprList(); if (isOp(')')) { p++; if (isOp(';') || isOp('}') || T[p].k === 'nl' || isOp('>') || isOp('|') || isOp('>>')) return l; } p = sv; return null; }
    function exprList(noGt) { var l = [exprX(noGt)]; while (isOp(',')) { p++; optNl(); l.push(exprX(noGt)); } return l; }
    var noGt = false;
    function exprX(ng) { var s = noGt; noGt = !!ng; var e = expr(); noGt = s; return e; }
    function expr() { return ternary(); }
    function ternary() {
      var c = orE();
      if (isOp('?')) { p++; optNl(); var a = ternary(); optNl(); eat(':'); optNl(); var b = ternary(); return { t: 'tern', c: c, a: a, b: b }; }
      if (T[p].k === 'op' && /^(=|\+=|-=|\*=|\/=|%=|\^=)$/.test(T[p].v) && (c.t === 'var' || c.t === 'idx' || c.t === 'field')) { var op = T[p++].v; optNl(); return { t: 'asg', op: op, l: c, r: ternary() }; }
      return c;
    }
    function orE() { var l = andE(); while (isOp('||')) { p++; optNl(); l = { t: 'or', l: l, r: andE() }; } return l; }
    function andE() { var l = inE(); while (isOp('&&')) { p++; optNl(); l = { t: 'and', l: l, r: inE() }; } return l; }
    function inE() { var l = matchE(); while (isKw('in')) { p++; var a = T[p++].v; l = { t: 'in', k: l, a: a }; } return l; }
    function matchE() { var l = cmpE(); while (isOp('~') || isOp('!~')) { var o = T[p++].v; l = { t: 'match', neg: o === '!~', l: l, r: cmpE() }; } return l; }
    function cmpE() {
      var l = concat();
      while (T[p].k === 'op' && /^(<|<=|==|!=|>=|>)$/.test(T[p].v) && !(noGt && T[p].v === '>')) { var o = T[p++].v; l = { t: 'cmp', op: o, l: l, r: concat() }; }
      return l;
    }
    function concat(ng) {
      var l = add();
      for (;;) {
        var k = T[p];
        var starts = k.k === 'num' || k.k === 'str' || k.k === 'id' || k.k === 'fn' || (k.k === 're') || (k.k === 'op' && (k.v === '$' || k.v === '(' || k.v === '!' || k.v === '-' || k.v === '+' || k.v === '++' || k.v === '--')) ;
        if (k.k === 'op' && (k.v === '-' || k.v === '+')) starts = false; // binary handled in add
        if (k.k === 'kw' && k.v === 'getline') starts = false;
        if (!starts || (k.k === 'kw')) break;
        if (k.k === 'op' && k.v === '!') break;
        l = { t: 'cat', l: l, r: add() };
      }
      return l;
    }
    function add() { var l = mul(); while (isOp('+') || isOp('-')) { var o = T[p++].v; l = { t: 'bin', op: o, l: l, r: mul() }; } return l; }
    function mul() { var l = unary(); while (isOp('*') || isOp('/') || isOp('%')) { var o = T[p++].v; l = { t: 'bin', op: o, l: l, r: unary() }; } return l; }
    function unary() {
      if (isOp('!')) { p++; return { t: 'not', e: unary() }; }
      if (isOp('-')) { p++; return { t: 'neg', e: unary() }; }
      if (isOp('+')) { p++; return { t: 'pos', e: unary() }; }
      return pow();
    }
    function pow() { var l = postfix(); if (isOp('^')) { p++; return { t: 'bin', op: '^', l: l, r: unary() }; } return l; }
    function postfix() {
      var e = primary();
      if ((e.t === 'var' || e.t === 'idx' || e.t === 'field') && (isOp('++') || isOp('--'))) { var o = T[p++].v; return { t: 'post', op: o, l: e }; }
      return e;
    }
    function primary() {
      var k = T[p];
      if (k.k === 'num') { p++; return { t: 'num', v: k.v }; }
      if (k.k === 'str') { p++; return { t: 'str', v: k.v }; }
      if (k.k === 're') { p++; return { t: 're', v: k.v }; }
      if (isOp('(')) { p++; var e = expr(); if (isOp(',')) { /* (a,b) in arr */ var l = [e]; while (isOp(',')) { p++; l.push(expr()); } eat(')'); if (isKw('in')) { p++; var a = T[p++].v; return { t: 'in', k: { t: 'multi', l: l }, a: a }; } } eat(')'); return { t: 'group', e: e }; }
      if (isOp('$')) { p++; var f = primaryNoPost(); return { t: 'field', e: f }; }
      if (isOp('++') || isOp('--')) { var o = T[p++].v; var l2 = primary(); return { t: 'pre', op: o, l: l2 }; }
      if (k.k === 'kw' && k.v === 'getline') { p++; var v = null; if (T[p].k === 'id') { v = { t: 'var', n: T[p++].v }; } return { t: 'getline', v: v }; }
      if (k.k === 'fn') {
        p++; var args = [];
        if (isOp('(')) { p++; optNl(); if (!isOp(')')) args = exprList(); eat(')'); } else if (k.v !== 'length') throw new Error('syntax error');
        return { t: 'fn', n: k.v, a: args };
      }
      if (k.k === 'id') {
        p++;
        if (k.call && isOp('(')) { p++; var args2 = []; if (!isOp(')')) args2 = exprList(); eat(')'); return { t: 'ucall', n: k.v, a: args2 }; }
        if (isOp('[')) { p++; var idx = exprList(); eat(']'); return { t: 'idx', a: k.v, i: idx }; }
        return { t: 'var', n: k.v };
      }
      throw new Error('syntax error at source line 1\n context is\n\t>>> ' + (k.v === undefined ? k.k : k.v) + ' <<<');
    }
    function primaryNoPost() { if (isOp('++') || isOp('--')) return primary(); if (isOp('-')) { p++; return { t: 'neg', e: primaryNoPost() }; } return primary(); }
    skipNl();
    while (T[p].k !== 'eof') {
      if (isKw('function')) { p++; var name = T[p++].v; eat('('); var ps = []; while (!isOp(')')) { ps.push(T[p++].v); if (isOp(',')) p++; } eat(')'); optNl(); funcs[name] = { ps: ps, body: block() }; }
      else if (isKw('BEGIN')) { p++; optNl(); items.push({ kind: 'begin', body: block() }); }
      else if (isKw('END')) { p++; optNl(); items.push({ kind: 'end', body: block() }); }
      else {
        var pat = null, pat2 = null;
        if (!isOp('{')) { pat = expr(); if (isOp(',')) { p++; pat2 = expr(); } }
        var body = null; if (isOp('{')) body = block();
        items.push({ kind: 'main', pat: pat, pat2: pat2, body: body, on: false });
      }
      skipNl();
    }
    return { funcs: funcs, items: items };
  }

  function awkRun(src, texts, FSarg, preset, c) {
    var prog;
    try { prog = parse(src); } catch (e) { return { err: 'awk: ' + e.message + '\n', code: 2 }; }
    var out = '', err = '', G = {}, ARR = {}, rec = [], line = '', NFv = 0, NR = 0, FNR = 0, FS = FSarg !== undefined ? FSarg : ' ', OFS = ' ', ORS = '\n', ORSset = false, RSTART = 0, RLENGTH = -1, SUBSEP = '\x1c', FILENAME = '';
    Object.keys(preset || {}).forEach(function (k) { G[k] = preset[k]; });
    if (FS === 't') FS = '\t'; if (FS === '\\t') FS = '\t';
    var exitCode = 0, exiting = false, nextFlag = false, files = {}, loop = 0, rcache = {};
    function Ctl(t, v) { this.t = t; this.v = v; }
    var frames = [];
    function num(v) { if (typeof v === 'number') return v; if (typeof v === 'boolean') return v ? 1 : 0; var m = /^\s*[+-]?(\d+\.?\d*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?|0[xX][0-9a-fA-F]+)/.exec(v); return m ? parseFloat(m[0]) : 0; }
    function str(v) { if (typeof v === 'number') { if (Number.isInteger(v)) return String(v); var s = String(+v.toPrecision(6)); return s; } if (typeof v === 'boolean') return v ? '1' : '0'; return v === undefined ? '' : v; }
    function numStr(v) { return typeof v === 'string' && /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(v); }
    function truthy(v) { if (typeof v === 'string') return v !== ''; return !!v; }
    function reOf(v) { var s = typeof v === 'object' && v && v.re ? v.re : str(v); if (!rcache[s]) rcache[s] = SIM.rx(s, true, false); return rcache[s]; }
    function splitRec() {
      var fs = FS, f;
      if (line === '') f = [];
      else if (fs === ' ') f = line.trim().split(/[ \t\n]+/);
      else if (fs.length === 1 && fs !== '\\') f = line.split(fs);
      else f = line.split(SIM.rx(fs, true, false));
      rec = [line].concat(f); NFv = f.length;
    }
    function setLine(l) { line = l; splitRec(); }
    function getField(i) { if (i === 0) return line; return rec[i] === undefined ? '' : rec[i]; }
    function setField(i, v) {
      v = str(v);
      if (i === 0) { setLine(v); return; }
      while (rec.length <= i) rec.push('');
      rec[i] = v; if (i > NFv) NFv = i;
      line = rec.slice(1, NFv + 1).join(OFS);
    }
    function lookup(n) { if (frames.length && n in frames[frames.length - 1].locals) return frames[frames.length - 1].locals; return null; }
    function getVar(n) {
      var L = lookup(n); if (L) return L[n];
      switch (n) { case 'NF': return NFv; case 'NR': return NR; case 'FNR': return FNR; case 'FS': return FS; case 'OFS': return OFS; case 'ORS': return ORS; case 'RSTART': return RSTART; case 'RLENGTH': return RLENGTH; case 'SUBSEP': return SUBSEP; case 'FILENAME': return FILENAME; case 'ENVIRON': return ''; }
      var v = G[n]; return v === undefined ? '' : v;
    }
    function setVar(n, v) {
      var L = lookup(n); if (L) { L[n] = v; return; }
      switch (n) { case 'NF': var k = num(v); while (rec.length <= k) rec.push(''); rec.length = k + 1; NFv = k; line = rec.slice(1).join(OFS); return; case 'FS': FS = str(v); return; case 'OFS': OFS = str(v); return; case 'ORS': ORS = str(v); return; case 'NR': NR = num(v); return; }
      G[n] = v;
    }
    function arr(n) { var L = lookup(n); if (L && typeof L[n] === 'object') return L[n]; if (L && L[n] === '') { L[n] = {}; return L[n]; } if (!ARR[n]) ARR[n] = {}; return ARR[n]; }
    function key(idx) { return idx.map(function (e) { return str(ev(e)); }).join(SUBSEP); }
    function cmp(a, b) {
      var an = typeof a === 'number' || (numStr(a) && a.__f), bn = typeof b === 'number' || (numStr(b) && b.__f);
      if ((typeof a === 'number' || a && a.isNum) && (typeof b === 'number' || b && b.isNum)) { return a - b; }
      return null;
    }
    function ev(e) {
      switch (e.t) {
        case 'num': return e.v; case 'str': return e.v;
        case 're': return reOf(e.v).test(line) ? 1 : 0;
        case 'group': return ev(e.e);
        case 'var': { var vv = getVar(e.n); return vv; }
        case 'field': return fieldVal(num(ev(e.e)));
        case 'idx': { var a = arr(e.a), k = key(e.i); if (!(k in a)) a[k] = ''; return a[k]; }
        case 'asg': {
          var r = ev(e.r), val;
          if (e.op !== '=') { var cur = num(ev(e.l)), rv = num(r); val = e.op === '+=' ? cur + rv : e.op === '-=' ? cur - rv : e.op === '*=' ? cur * rv : e.op === '/=' ? (rv === 0 ? die('division by zero in /=') : cur / rv) : e.op === '%=' ? cur % rv : Math.pow(cur, rv); } else val = r;
          assign(e.l, val); return val;
        }
        case 'tern': return truthy(ev(e.c)) ? ev(e.a) : ev(e.b);
        case 'or': return truthy(ev(e.l)) || truthy(ev(e.r)) ? 1 : 0;
        case 'and': return truthy(ev(e.l)) && truthy(ev(e.r)) ? 1 : 0;
        case 'not': return truthy(ev(e.e)) ? 0 : 1;
        case 'neg': return -num(ev(e.e)); case 'pos': return num(ev(e.e));
        case 'in': { var kk = e.k.t === 'multi' ? e.k.l.map(function (x) { return str(ev(x)); }).join(SUBSEP) : str(ev(e.k)); return kk in arr(e.a) ? 1 : 0; }
        case 'match': { var s = str(ev(e.l)), re = e.r.t === 're' ? reOf(e.r.v) : reOf(str(ev(e.r))); var m = re.test(s); return (e.neg ? !m : m) ? 1 : 0; }
        case 'cmp': {
          var L = ev(e.l), R = ev(e.r), res;
          var ln = typeof L === 'number' || (e.l.t === 'field' && numStr(L)) || (e.l.t === 'var' && numStr(L) && false) || (e.l.t === 'idx' && false);
          var rn = typeof R === 'number' || (e.r.t === 'field' && numStr(R));
          if ((typeof L === 'number' || e.l.t === 'field' && numStr(L)) && (typeof R === 'number' || e.r.t === 'field' && numStr(R))) { L = num(L); R = num(R); }
          else if (typeof L === 'number' || typeof R === 'number') { var Ls = typeof L === 'number' ? L : (numStr(L) && (e.l.t === 'field' || e.l.t === 'var') ? num(L) : null), Rs = typeof R === 'number' ? R : (numStr(R) && (e.r.t === 'field' || e.r.t === 'var') ? num(R) : null); if (Ls !== null && Rs !== null) { L = Ls; R = Rs; } else { L = str(L); R = str(R); } }
          else if (e.l.t !== 'str' && e.r.t !== 'str' && numStr(L) && numStr(R) && (e.l.t === 'field' || e.l.t === 'var' || e.l.t === 'idx') && (e.r.t === 'field' || e.r.t === 'var' || e.r.t === 'idx')) { L = num(L); R = num(R); }
          switch (e.op) { case '<': res = L < R; break; case '<=': res = L <= R; break; case '==': res = L === R; break; case '!=': res = L !== R; break; case '>': res = L > R; break; default: res = L >= R; }
          return res ? 1 : 0;
        }
        case 'cat': return str(ev(e.l)) + str(ev(e.r));
        case 'bin': { var x = num(ev(e.l)), y = num(ev(e.r)); switch (e.op) { case '+': return x + y; case '-': return x - y; case '*': return x * y; case '/': if (y === 0) die('division by zero'); return x / y; case '%': if (y === 0) die('division by zero in %'); return x % y; default: return Math.pow(x, y); } }
        case 'pre': { var cv = num(ev(e.l)) + (e.op === '++' ? 1 : -1); assign(e.l, cv); return cv; }
        case 'post': { var cv2 = num(ev(e.l)); assign(e.l, cv2 + (e.op === '++' ? 1 : -1)); return cv2; }
        case 'getline': { return 0; }
        case 'fn': return callBuiltin(e);
        case 'ucall': return callUser(e);
      }
      throw new Error('bad expr ' + e.t);
    }
    function fieldVal(i) { var v = getField(i); return v; }
    function die(m) { throw { awkErr: 'awk: ' + m + '\n source line number 1' }; }
    function assign(l, v) {
      if (l.t === 'var') setVar(l.n, v);
      else if (l.t === 'idx') arr(l.a)[key(l.i)] = v;
      else if (l.t === 'field') setField(num(ev(l.e)), v);
    }
    function callUser(e) {
      var f = prog.funcs[e.n]; if (!f) die('calling undefined function ' + e.n);
      var locals = {}; f.ps.forEach(function (n, i) { var a = e.a[i]; if (a && a.t === 'var' && (typeof arr0(a.n) === 'object' && ARR[a.n])) locals[n] = ARR[a.n]; else locals[n] = a ? ev(a) : ''; });
      frames.push({ locals: locals }); var rv = '';
      try { exec(f.body); } catch (x) { if (x instanceof Ctl && x.t === 'return') rv = x.v; else { frames.pop(); throw x; } }
      frames.pop(); return rv;
    }
    function arr0(n) { return ARR[n] ? {} : ''; }
    function callBuiltin(e) {
      var a = e.a, n = e.n;
      switch (n) {
        case 'length': { if (!a.length) return line.length; if (a[0].t === 'var' && (ARR[a[0].n] || (lookup(a[0].n) && typeof lookup(a[0].n)[a[0].n] === 'object'))) return Object.keys(arr(a[0].n)).length; return str(ev(a[0])).length; }
        case 'substr': { var s = str(ev(a[0])), m = Math.round(num(ev(a[1]))), l = a[2] ? Math.round(num(ev(a[2]))) : Infinity; var st = Math.max(m, 1), en = Math.min(m + l, s.length + 1); return en <= st ? '' : s.slice(st - 1, en - 1); }
        case 'index': return str(ev(a[0])).indexOf(str(ev(a[1]))) + 1;
        case 'split': { var s2 = str(ev(a[0])), fs = a[2] ? (a[2].t === 're' ? { re: a[2].v } : str(ev(a[2]))) : FS, parts; if (s2 === '') parts = []; else if (fs === ' ') parts = s2.trim().split(/[ \t\n]+/); else if (typeof fs === 'object') parts = s2.split(reOf(fs)); else if (fs.length === 1) parts = s2.split(fs); else parts = s2.split(reOf(fs)); var A = arr(a[1].n); Object.keys(A).forEach(function (k) { delete A[k]; }); parts.forEach(function (p, i) { A[String(i + 1)] = p; }); return parts.length; }
        case 'sub': case 'gsub': {
          var re = a[0].t === 're' ? reOf(a[0].v) : reOf(str(ev(a[0]))), rep = str(ev(a[1])), tgt = a[2] || { t: 'field', e: { t: 'num', v: 0 } }, src = str(ev(tgt)), cnt = 0;
          var g = new RegExp(re.source, re.flags + (n === 'gsub' ? 'g' : ''));
          var out2 = src.replace(g, function (mm) { cnt++; return rep.replace(/\\\\|\\&|&/g, function (x) { return x === '&' ? mm : x === '\\&' ? '&' : '\\'; }); });
          if (cnt) assign(tgt, out2); return cnt;
        }
        case 'match': { var s3 = str(ev(a[0])), re3 = a[1].t === 're' ? reOf(a[1].v) : reOf(str(ev(a[1]))), mm = re3.exec(s3); if (mm) { RSTART = mm.index + 1; RLENGTH = mm[0].length; } else { RSTART = 0; RLENGTH = -1; } return RSTART; }
        case 'sprintf': return SIM.fmtPrintf(a.map(function (x) { var v = ev(x); return typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(v)) : v; }));
        case 'sin': return Math.sin(num(ev(a[0]))); case 'cos': return Math.cos(num(ev(a[0]))); case 'atan2': return Math.atan2(num(ev(a[0])), num(ev(a[1])));
        case 'exp': return Math.exp(num(ev(a[0]))); case 'log': return Math.log(num(ev(a[0]))); case 'sqrt': return Math.sqrt(num(ev(a[0]))); case 'int': return Math.trunc(num(ev(a[0])));
        case 'rand': return Math.random(); case 'srand': return 0;
        case 'tolower': return str(ev(a[0])).toLowerCase(); case 'toupper': return str(ev(a[0])).toUpperCase();
        case 'system': return 0;
      }
      return '';
    }
    function emit(s, redir) {
      if (!redir) { out += s; return; }
      var dest = str(ev(redir.e));
      if (redir.op === '|') { var r = c.sh.runCmd(dest.split(/\s+/), { in: s }); out += r.out; err += r.err; return; }
      if (dest === '/dev/stderr') { err += s; return; } if (dest === '/dev/stdout') { out += s; return; }
      var ab = c.sh.abs(dest); if (!(ab in files)) { files[ab] = redir.op === '>>' ? (c.fs.read(ab) || '') : ''; } files[ab] += s; c.fs.write(ab, files[ab]);
    }
    function exec(s) {
      if (++loop > 2000000) die('runaway program');
      switch (s.t) {
        case 'block': for (var i = 0; i < s.st.length; i++) exec(s.st[i]); return;
        case 'expr': ev(s.e); return;
        case 'print': { var vals = s.a.length ? s.a.map(function (x) { var v = ev(x); return typeof v === 'number' ? str(v) : v; }) : [line]; emit(vals.map(str).join(OFS) + ORS, s.redir); return; }
        case 'printf': { var vs = s.a.map(function (x) { return ev(x); }); emit(SIM.fmtPrintf(vs.map(function (v, i) { return i === 0 ? str(v) : (typeof v === 'number' ? String(v) : v); })), s.redir); return; }
        case 'if': if (truthy(ev(s.c))) exec(s.th); else if (s.el) exec(s.el); return;
        case 'while': try { while (truthy(ev(s.c))) { try { exec(s.b); } catch (x) { if (x instanceof Ctl && x.t === 'continue') continue; throw x; } } } catch (x) { if (!(x instanceof Ctl && x.t === 'break')) throw x; } return;
        case 'do': try { do { try { exec(s.b); } catch (x) { if (x instanceof Ctl && x.t === 'continue') continue; throw x; } } while (truthy(ev(s.c))); } catch (x) { if (!(x instanceof Ctl && x.t === 'break')) throw x; } return;
        case 'for': try { if (s.init) exec(s.init); while (!s.c || truthy(ev(s.c))) { try { exec(s.b); } catch (x) { if (!(x instanceof Ctl && x.t === 'continue')) throw x; } if (s.inc) exec(s.inc); } } catch (x) { if (!(x instanceof Ctl && x.t === 'break')) throw x; } return;
        case 'forin': { var A = arr(s.arr), ks = Object.keys(A); ks.sort(function (a, b) { return (/^\d+$/.test(a) && /^\d+$/.test(b)) ? a - b : 0; }); try { ks.forEach(function (k) { if (!(k in A)) return; setVar(s.v, numStr(k) ? k : k); try { exec(s.b); } catch (x) { if (!(x instanceof Ctl && x.t === 'continue')) throw x; } }); } catch (x) { if (!(x instanceof Ctl && x.t === 'break')) throw x; } return; }
        case 'break': case 'continue': throw new Ctl(s.t);
        case 'next': throw new Ctl('next');
        case 'exit': if (s.e) exitCode = num(ev(s.e)); throw new Ctl('exit');
        case 'return': throw new Ctl('return', s.e ? ev(s.e) : '');
        case 'delete': { var AA = arr(s.a); if (s.i) delete AA[key(s.i)]; else Object.keys(AA).forEach(function (k) { delete AA[k]; }); return; }
      }
    }
    function runBlock(b) { exec(b); }
    try {
      try { prog.items.filter(function (i) { return i.kind === 'begin'; }).forEach(function (i) { runBlock(i.body); }); }
      catch (x) { if (x instanceof Ctl && x.t === 'exit') exiting = true; else throw x; }
      var mains = prog.items.filter(function (i) { return i.kind === 'main'; }), ends = prog.items.filter(function (i) { return i.kind === 'end'; });
      if (!exiting && (mains.length || ends.length)) {
        outer: for (var ti = 0; ti < texts.length; ti++) {
          FILENAME = texts[ti].name === '-' ? '' : texts[ti].name; FNR = 0;
          var ls = texts[ti].text.split('\n'); if (ls[ls.length - 1] === '') ls.pop();
          for (var li = 0; li < ls.length; li++) {
            NR++; FNR++; setLine(ls[li]);
            for (var mi = 0; mi < mains.length; mi++) {
              var it = mains[mi], hit;
              try {
                if (!it.pat) hit = true; else if (it.pat2) { if (it.on) { hit = true; if (truthy(ev(it.pat2))) it.on = false; } else if (truthy(ev(it.pat))) { hit = true; if (!truthy(ev(it.pat2))) it.on = true; } else hit = false; } else hit = truthy(ev(it.pat));
                if (hit) { if (it.body) runBlock(it.body); else emit(line + ORS); }
              } catch (x) { if (x instanceof Ctl && x.t === 'next') break; if (x instanceof Ctl && x.t === 'exit') { exiting = true; break outer; } throw x; }
            }
          }
        }
      }
      try { if (!(exiting && false)) ends.forEach(function (i) { runBlock(i.body); }); } catch (x) { if (!(x instanceof Ctl && x.t === 'exit')) throw x; }
    } catch (x) {
      if (x && x.awkErr) return { out: out, err: err + x.awkErr + '\n', code: 2 };
      if (x instanceof Ctl) return { out: out, err: err, code: exitCode };
      throw x;
    }
    return { out: out, err: err, code: exitCode };
  }
  SIM.awk = awkRun;
})(SIM);

/* Canned network commands for the lab LAN 192.168.1.0/24. Output imitates macOS tools; values are fixed, so results are repeatable. */
(function (SIM) {
  'use strict';
  var C = SIM.CMDS, U = SIM.util, flags = U.flags, pad = U.pad, padR = U.padR;
  var LAN = { '192.168.1.1': 'router.lan', '192.168.1.23': 'macbook.lan', '192.168.1.50': 'pi.lan', '192.168.1.60': 'nas.lan', '192.168.1.70': 'printer.lan', '192.168.1.90': 'homeassistant.lan' };
  var MACS = { '192.168.1.1': 'a4:2b:b0:5c:11:09', '192.168.1.50': 'dc:a6:32:7e:41:b8', '192.168.1.60': '00:11:32:aa:03:5d', '192.168.1.70': '3c:2a:f4:09:d8:62', '192.168.1.90': 'b8:27:eb:44:19:e0', '192.168.1.23': 'f0:18:98:3a:6d:21' };
  var DNS = { 'example.com': '93.184.216.34', 'python.org': '151.101.0.223', 'github.com': '140.82.121.3', 'wikipedia.org': '185.15.58.224', 'cloudflare.com': '104.16.132.229', 'mozilla.org': '34.160.144.191', 'kernel.org': '139.178.84.217', 'debian.org': '151.101.194.132', 'openbsd.org': '199.185.178.80', 'iana.org': '192.0.43.8', 'google.com': '142.250.187.206', 'localhost': '127.0.0.1', 'apple.com': '17.253.144.10', 'one.one.one.one': '1.1.1.1', 'dns.google': '8.8.8.8' };
  Object.keys(LAN).forEach(function (ip) { DNS[LAN[ip]] = ip; });
  DNS['router'] = '192.168.1.1'; DNS['pi'] = '192.168.1.50';
  var REV = { '1.1.1.1': 'one.one.one.one', '8.8.8.8': 'dns.google', '93.184.216.34': 'example.com' };
  function resolve(h) { if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return h; return DNS[h.replace(/\.$/, '').toLowerCase()] || (DNS[h.replace(/^www\./, '')] || null); }
  function isLan(ip) { return /^192\.168\.1\./.test(ip) || ip === '127.0.0.1'; }
  function rtt(ip, i) { var base = ip === '127.0.0.1' ? 0.05 : isLan(ip) ? ({ '192.168.1.1': 2.1, '192.168.1.50': 4.3, '192.168.1.60': 3.8, '192.168.1.70': 9.0, '192.168.1.90': 5.1 })[ip] || 4 : 11 + (parseInt(ip.split('.')[3], 10) % 7) * 3; var j = [0, 0.37, -0.21, 0.82, -0.45, 0.19, 0.64, -0.3, 0.9, 0.12][i % 10]; return Math.max(0.03, base + j); }
  function f3(x) { return x.toFixed(3); }

  C.ping = function (a, c) {
    var p = flags(a, 'c:i:s:t:W:w:q4vn', {}), host = p.rest[0];
    if (!host) return { err: 'usage: ping [-AaDdfnoQqRrv] [-c count] [-G sweepmaxsize] [-g sweepminsize]\n            [-h sweepincrsize] [-i wait] [-l preload] [-M mask | time] [-m ttl]\n            [-p pattern] [-S src_addr] [-s packetsize] [-t timeout][-W waittime]\n            [-z tos] host\n', code: 64 };
    var ip = resolve(host);
    if (!ip) return { err: 'ping: cannot resolve ' + host + ': Unknown host\n', code: 68 };
    var cnt = p.f.c ? +p.f.c : 5, size = p.f.s ? +p.f.s : 56, o = '', times = [], lost = 0;
    if (!p.f.c) cnt = 5;
    o += 'PING ' + host + ' (' + ip + '): ' + size + ' data bytes\n';
    var ttl = ip === '127.0.0.1' ? 64 : isLan(ip) ? 64 : 56, down = ip === '192.168.1.99';
    for (var i = 0; i < cnt; i++) {
      if (down) { o += 'Request timeout for icmp_seq ' + i + '\n'; lost++; continue; }
      var t = rtt(ip, i); times.push(t);
      o += (size + 8) + ' bytes from ' + ip + ': icmp_seq=' + i + ' ttl=' + ttl + ' time=' + f3(t) + ' ms\n';
    }
    o += '\n--- ' + host + ' ping statistics ---\n' + cnt + ' packets transmitted, ' + (cnt - lost) + ' packets received, ' + (lost ? (lost / cnt * 100).toFixed(1) : '0.0') + '% packet loss\n';
    if (times.length) { var mn = Math.min.apply(null, times), mx = Math.max.apply(null, times), av = times.reduce(function (s, x) { return s + x; }, 0) / times.length, sd = Math.sqrt(times.reduce(function (s, x) { return s + (x - av) * (x - av); }, 0) / times.length); o += 'round-trip min/avg/max/stddev = ' + f3(mn) + '/' + f3(av) + '/' + f3(mx) + '/' + f3(sd) + ' ms\n'; }
    return { out: o, code: lost === cnt ? 2 : 0 };
  };
  C.traceroute = function (a, c) {
    var p = flags(a, 'nm:q:w:', {}), host = p.rest[0]; if (!host) return { err: 'usage: traceroute [-adeFISdnrvx] host\n', code: 64 };
    var ip = resolve(host); if (!ip) return { err: 'traceroute: unknown host ' + host + '\n', code: 68 };
    var hdr = 'traceroute to ' + host + ' (' + ip + '), 64 hops max, 52 byte packets\n', o = '';
    var hops = isLan(ip) ? [[ip, LAN[ip] || ip, rtt(ip, 0)]] : [['192.168.1.1', 'router.lan', 2.1], ['10.34.0.1', '10.34.0.1', 8.4], ['81.139.72.5', 'core1.isp.example.net', 9.9], ['62.172.103.40', 'peer1.isp.example.net', 10.7], [ip, host, rtt(ip, 0)]];
    hops.forEach(function (h, i) { var nm = p.f.n ? h[0] : h[1] + ' (' + h[0] + ')'; o += pad(i + 1, 2) + '  ' + nm + '  ' + f3(h[2]) + ' ms  ' + f3(h[2] + 0.3) + ' ms  ' + f3(h[2] - 0.2) + ' ms\n'; });
    return c.tty ? { out: hdr + o } : { out: o, err: hdr };
  };
  C.ifconfig = function (a, c) {
    var if0 = 'en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500\n\toptions=6460<TSO4,TSO6,CHANNEL_IO,PARTIAL_CSUM,ZEROINVERT_CSUM>\n\tether f0:18:98:3a:6d:21\n\tinet6 fe80::1c3a:7d4e:9f21:5a6b%en0 prefixlen 64 secured scopeid 0xe\n\tinet 192.168.1.23 netmask 0xffffff00 broadcast 192.168.1.255\n\tnd6 options=201<PERFORMNUD,DAD>\n\tmedia: autoselect\n\tstatus: active\n';
    var lo0 = 'lo0: flags=8049<UP,LOOPBACK,RUNNING,MULTICAST> mtu 16384\n\toptions=1203<RXCSUM,TXCSUM,TSO4,CHANNEL_IO>\n\tinet 127.0.0.1 netmask 0xff000000\n\tinet6 ::1 prefixlen 128\n\tinet6 fe80::1%lo0 prefixlen 64 scopeid 0x1\n\tnd6 options=201<PERFORMNUD,DAD>\n';
    var en1 = 'en1: flags=8822<BROADCAST,SMART,SIMPLEX,MULTICAST> mtu 1500\n\tether 3a:11:22:33:44:55\n\tmedia: autoselect (none)\n\tstatus: inactive\n';
    if (a[0] === 'en0') return { out: if0 }; if (a[0] === 'lo0') return { out: lo0 }; if (a[0] === 'en1') return { out: en1 };
    if (a[0] && a[0][0] !== '-') return { err: 'ifconfig: interface ' + a[0] + ' does not exist\n', code: 1 };
    if (a[0] === '-l') return { out: 'lo0 en0 en1\n' };
    return { out: lo0 + en1 + if0 };
  };
  C.ipconfig = function (a) {
    if (a[0] === 'getifaddr') return a[1] === 'en0' ? { out: '192.168.1.23\n' } : { code: 1 };
    if (a[0] === 'getpacket') return { out: 'op = BOOTREPLY\nhtype = 1\nflags = 0\nhlen = 6\nhops = 0\nxid = 2231009872\nsecs = 0\nciaddr = 0.0.0.0\nyiaddr = 192.168.1.23\nsiaddr = 192.168.1.1\ngiaddr = 0.0.0.0\nchaddr = f0:18:98:3a:6d:21\noptions:\nDhcp message type = DHCPACK\nsubnet_mask (ip): 255.255.255.0\nrouter (ip_mult): {192.168.1.1}\ndomain_name_server (ip_mult): {192.168.1.1}\nlease_time (uint32): 0x15180\nserver_identifier (ip): 192.168.1.1\n' };
    return { err: 'usage: ipconfig <command> <args>\n', code: 64 };
  };
  C.route = function (a) {
    if (a[0] === '-n' && a[1] === 'get') { var d = a[2] || 'default'; return { out: '   route to: ' + (d === 'default' ? 'default' : d) + '\ndestination: default\n       mask: default\n    gateway: 192.168.1.1\n  interface: en0\n      flags: <UP,GATEWAY,DONE,STATIC,PRCLONING,GLOBAL>\n recvpipe  sendpipe  ssthresh  rtt,msec    rttvar  hopcount      mtu     expire\n       0         0         0         0         0         0      1500         0 \n' }; }
    return { err: 'route: usage: route [-dnqtv] command [[modifiers] args]\n', code: 64 };
  };
  C.netstat = function (a, c) {
    var p = flags(a, 'rnaipl', { loose: true }), all = a.join(' ');
    if (p.f.r) return { out: 'Routing tables\n\nInternet:\nDestination        Gateway            Flags               Netif Expire\ndefault            192.168.1.1        UGScg                 en0       \n127                127.0.0.1          UCS                   lo0       \n127.0.0.1          127.0.0.1          UH                    lo0       \n169.254            link#14            UCS                   en0      !\n192.168.1          link#14            UCS                   en0      !\n192.168.1.1/32     link#14            UCS                   en0      !\n192.168.1.1        a4:2b:b0:5c:11:9   UHLWIir               en0   1198\n192.168.1.23/32    link#14            UCS                   en0      !\n192.168.1.255      ff:ff:ff:ff:ff:ff  UHLWbI                en0      !\n' };
    if (p.f.i) return { out: 'Name       Mtu   Network       Address            Ipkts Ierrs     Opkts Oerrs  Coll\nlo0        16384 <Link#1>                           48221     0     48221     0     0\nlo0        16384 127           127.0.0.1            48221     -     48221     -     -\nen0        1500  <Link#14>   f0:18:98:3a:6d:21   902114     0    431872     0     0\nen0        1500  192.168.1     192.168.1.23        902114     -    431872     -     -\n' };
    if (p.f.a || p.f.n) return { out: 'Active Internet connections\nProto Recv-Q Send-Q  Local Address          Foreign Address        (state)\ntcp4       0      0  192.168.1.23.52814     140.82.121.3.443       ESTABLISHED\ntcp4       0      0  192.168.1.23.52790     17.253.144.10.443      ESTABLISHED\ntcp4       0      0  192.168.1.23.52771     142.250.187.206.443    TIME_WAIT\ntcp4       0      0  127.0.0.1.8000         *.*                    LISTEN\ntcp6       0      0  *.5000                 *.*                    LISTEN\nudp4       0      0  *.5353                 *.*                   \n' };
    return { out: 'Active Internet connections\nProto Recv-Q Send-Q  Local Address          Foreign Address        (state)\ntcp4       0      0  macbook.lan.52814      lb-140-82-121-3-.https ESTABLISHED\n' };
  };
  C.arp = function (a) {
    var p = flags(a, 'ands', { loose: true });
    var rows = [['router.lan', '192.168.1.1', 'a4:2b:b0:5c:11:9', 'en0', ' ifscope'], ['pi.lan', '192.168.1.50', 'dc:a6:32:7e:41:b8', 'en0', ' ifscope'], ['nas.lan', '192.168.1.60', '0:11:32:aa:3:5d', 'en0', ' ifscope'], ['printer.lan', '192.168.1.70', '3c:2a:f4:9:d8:62', 'en0', ' ifscope'], ['homeassistant.lan', '192.168.1.90', 'b8:27:eb:44:19:e0', 'en0', ' ifscope'], ['?', '192.168.1.255', 'ff:ff:ff:ff:ff:ff', 'en0', ' ifscope [ethernet]']];
    if (p.rest[0] && !p.f.a) { var r = rows.filter(function (x) { return x[1] === p.rest[0]; })[0]; return r ? { out: r[0] + ' (' + r[1] + ') at ' + r[2] + ' on ' + r[3] + r[4] + ' [ethernet]\n' } : { out: p.rest[0] + ' (' + p.rest[0] + ') -- no entry\n', code: 1 }; }
    return { out: rows.map(function (r) { return (p.f.n ? '?' : r[0]) + ' (' + r[1] + ') at ' + r[2] + ' on ' + r[3] + r[4] + (r[4].indexOf('[') < 0 ? ' [ethernet]' : '') + '\n'; }).join('') };
  };
  C.lsof = function (a) {
    var s = a.join(' ');
    var hdr = 'COMMAND   PID    USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME\n';
    s = s.replace(/-sTCP:\w+/g, '').replace(/-nP|-Pn|-n|-P/g, ''); if (/-i\s*(?:TCP|UDP|tcp|udp)?:(\d+)/.test(s)) { var port = /-i\s*(?:TCP|UDP|tcp|udp)?:(\d+)/.exec(s)[1]; if (port === '8000') return { out: hdr + 'Python  51234 learner    4u  IPv4 0x1a2b3c4d5e6f7081      0t0  TCP *:8000 (LISTEN)\n' }; if (port === '5000') return { out: hdr + 'ControlCe 612 learner   10u  IPv6 0x2b3c4d5e6f708192      0t0  TCP *:commplex-main (LISTEN)\n' }; return { out: '', code: 1 }; }
    if (/-i/.test(s)) return { out: hdr + 'Python    51234 learner    4u  IPv4 0x1a2b3c4d5e6f7081      0t0  TCP *:8000 (LISTEN)\nControlCe   612 learner   10u  IPv6 0x2b3c4d5e6f708192      0t0  TCP *:commplex-main (LISTEN)\nSafari    1403 learner   22u  IPv4 0x3c4d5e6f70819203      0t0  TCP macbook.lan:52814->lb-140-82-121-3-iad.github.com:https (ESTABLISHED)\n' };
    return { err: 'lsof: only -i is supported by the simulator\n', code: 1 };
  };
  C.nc = function (a) {
    var p = flags(a, 'zvuw:G:', { loose: true }), host = p.rest[0], port = p.rest[1];
    if (!host || !port) return { err: 'usage: nc [-46AacCDdEFhklMnOortUuvz] [-K tc] [-b boundif] [-i interval] [-p source_port]\n\t  [--apple-delegate-pid pid] [--apple-delegate-uuid uuid]\n\t  [-s source_ip_address] [-w timeout] [-X proxy_version]\n\t  [-x proxy_address[:port]] [hostname] [port[s]]\n', code: 1 };
    var ip = resolve(host); if (!ip) return { err: 'nc: getaddrinfo: nodename nor servname provided, or not known\n', code: 1 };
    var open = { '192.168.1.1': [53, 80, 443], '192.168.1.50': [22, 80, 8080], '192.168.1.60': [22, 139, 445, 5000], '192.168.1.70': [631, 9100], '192.168.1.90': [8123], '93.184.216.34': [80, 443], '127.0.0.1': [8000] }[ip] || (isLan(ip) ? [] : [80, 443]);
    var ok = open.indexOf(+port) >= 0;
    if (p.f.v || p.f.z) return ok ? { out: 'Connection to ' + host + ' port ' + port + ' [tcp/' + (SERV[port] || '*') + '] succeeded!\n' } : { err: 'nc: connect to ' + host + ' port ' + port + ' (tcp) failed: Connection refused\n', code: 1 };
    return ok ? {} : { err: 'nc: connect to ' + host + ' port ' + port + ' (tcp) failed: Connection refused\n', code: 1 };
  };
  var SERV = { 22: 'ssh', 53: 'domain', 80: 'http', 443: 'https', 139: 'netbios-ssn', 445: 'microsoft-ds', 631: 'ipp', 5000: 'commplex-main', 8000: 'irdmi', 8080: 'http-alt', 8123: 'polipo', 9100: 'jetdirect' };
  C.nmap = function (a, c) {
    var p = flags(a, 'sPnTvAp:F', { loose: true }), t = p.rest[0];
    if (!t) return { err: 'Nmap 7.95 ( https://nmap.org )\nUsage: nmap [Scan Type(s)] [Options] {target specification}\n', code: 1 };
    var scan = c.fs.read(c.sh.abs('scan.txt')) || '';
    var hosts = scan.split(/\n\n(?=Nmap scan)/).filter(function (b) { return /^Nmap scan report/.test(b.replace(/^\s+/, '')) || b.indexOf('Nmap scan report') === 0; });
    var head = 'Starting Nmap 7.95 ( https://nmap.org ) at 2026-10-08 09:41 BST\n';
    if (/^192\.168\.1\.0\/24$|^192\.168\.1\.\d+-\d+$/.test(t) || p.f.sn && /192\.168\.1\./.test(t)) {
      if (p.f.s && a.indexOf('-sn') >= 0 || a.indexOf('-sn') >= 0) { var o = head; Object.keys(LAN).forEach(function (ip) { if (ip === '192.168.1.23') return; o += 'Nmap scan report for ' + LAN[ip] + ' (' + ip + ')\nHost is up (' + (rtt(ip, 0) / 1000).toFixed(4) + 's latency).\nMAC Address: ' + MACS[ip].toUpperCase() + ' (Unknown)\n'; }); return { out: o + 'Nmap done: 256 IP addresses (5 hosts up) scanned in 2.87 seconds\n' }; }
      return { out: head + scan.replace(/^Starting Nmap[^\n]*\n/, '') };
    }
    var ip = resolve(t); if (!ip) return { err: 'Failed to resolve "' + t + '".\nWARNING: No targets were specified, so 0 hosts scanned.\nNmap done: 0 IP addresses (0 hosts up) scanned in 0.03 seconds\n', code: 1 };
    var blk = scan.split(/\n\n/).filter(function (b) { return b.indexOf('(' + ip + ')') >= 0; })[0];
    if (!blk) return { out: head + 'Nmap scan report for ' + t + ' (' + ip + ')\nHost is up (0.011s latency).\nNot shown: 998 filtered tcp ports (no-response)\nPORT    STATE SERVICE\n80/tcp  open  http\n443/tcp open  https\n\nNmap done: 1 IP address (1 host up) scanned in 4.82 seconds\n' };
    return { out: head + blk.replace(/^\s+/, '') + '\n\nNmap done: 1 IP address (1 host up) scanned in 0.21 seconds\n' };
  };
  C.dig = function (a, c) {
    var short = a.indexOf('+short') >= 0, args = a.filter(function (x) { return x[0] !== '+' && x[0] !== '@' && x[0] !== '-'; }), host = args[0], type = 'A', server = null;
    a.forEach(function (x) { if (x[0] === '@') server = x.slice(1); });
    if (args[1]) type = args[1].toUpperCase();
    if (!host) return { out: ';; global options: +cmd\n.\t\t3600\tIN\tNS\ta.root-servers.net.\n' };
    if (host === '-x' || a[0] === '-x') { var ipx = a[a.indexOf('-x') + 1]; var nm = REV[ipx]; return short ? { out: nm ? nm + '.\n' : '' } : { out: ';; ANSWER SECTION:\n' + ipx.split('.').reverse().join('.') + '.in-addr.arpa. 3600 IN PTR ' + nm + '.\n' }; }
    var ip = resolve(host), name = host.replace(/\.$/, '');
    var ans = [];
    if (type === 'A' && ip && !/^\d/.test(name)) ans = [[name + '.', 300, 'A', ip]];
    else if (type === 'MX' && ip) ans = [[name + '.', 3600, 'MX', '10 mail.' + name + '.']];
    else if (type === 'NS' && ip) ans = [[name + '.', 86400, 'NS', 'ns1.' + name + '.'], [name + '.', 86400, 'NS', 'ns2.' + name + '.']];
    else if (type === 'TXT' && ip) ans = [[name + '.', 300, 'TXT', '"v=spf1 -all"']];
    else if (type === 'AAAA' && ip) ans = [[name + '.', 300, 'AAAA', '2606:2800:21f:cb07:6820:80da:af6b:8b2c']];
    else if (type === 'CNAME' && /^www\./.test(name)) ans = [[name + '.', 300, 'CNAME', name.replace(/^www\./, '') + '.']];
    if (short) return { out: ans.map(function (r) { return r[3] + '\n'; }).join('') };
    var status = ip || type === 'NS' ? 'NOERROR' : 'NXDOMAIN';
    var srv = server || '192.168.1.1';
    var o = '\n; <<>> DiG 9.10.6 <<>> ' + a.join(' ') + '\n;; global options: +cmd\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: ' + status + ', id: 41872\n;; flags: qr rd ra; QUERY: 1, ANSWER: ' + ans.length + ', AUTHORITY: 0, ADDITIONAL: 1\n\n;; OPT PSEUDOSECTION:\n; EDNS: version: 0, flags:; udp: 1232\n;; QUESTION SECTION:\n;' + name + '.\t\t\tIN\t' + type + '\n\n';
    if (ans.length) o += ';; ANSWER SECTION:\n' + ans.map(function (r) { return r[0] + '\t\t' + r[1] + '\tIN\t' + r[2] + '\t' + r[3]; }).join('\n') + '\n\n';
    o += ';; Query time: 14 msec\n;; SERVER: ' + srv + '#53(' + srv + ')\n;; WHEN: Thu Oct 08 09:41:00 BST 2026\n;; MSG SIZE  rcvd: ' + (60 + ans.length * 16) + '\n\n';
    return { out: o };
  };
  C.nslookup = function (a) {
    var host = a[0]; if (!host) return { err: 'nslookup: interactive mode is not supported in the simulator\n', code: 1 };
    var ip = resolve(host);
    if (!ip) return { out: 'Server:\t\t192.168.1.1\nAddress:\t192.168.1.1#53\n\n** server can\'t find ' + host + ': NXDOMAIN\n\n', code: 1 };
    return { out: 'Server:\t\t192.168.1.1\nAddress:\t192.168.1.1#53\n\nNon-authoritative answer:\nName:\t' + host + '\nAddress: ' + ip + '\n\n' };
  };
  C.host = function (a) {
    var h = a[0]; if (!h) return { err: 'Usage: host [-aCdilrTvVw] [-c class] [-N ndots] [-t type] [-W time]\n', code: 1 };
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) { var nm = REV[h] || LAN[h]; return nm ? { out: h.split('.').reverse().join('.') + '.in-addr.arpa domain name pointer ' + nm + '.\n' } : { out: 'Host ' + h.split('.').reverse().join('.') + '.in-addr.arpa. not found: 3(NXDOMAIN)\n', code: 1 }; }
    var ip = resolve(h); if (!ip) return { out: 'Host ' + h + ' not found: 3(NXDOMAIN)\n', code: 1 };
    return { out: h + ' has address ' + ip + '\n' + (isLan(ip) ? '' : h + ' has IPv6 address 2606:2800:21f:cb07:6820:80da:af6b:8b2c\n' + h + ' mail is handled by 10 mail.' + h + '.\n') };
  };
  // VPN chapter: a canned WireGuard tunnel, so the practice terminal can run wg show and its script-friendly forms
  var WGK = { me: '8n3mF0xqQ2s9Wk1pYb6L4cTzJd7VhE5oAuRgNiXwM0I=' };
  var WGP = [
    { key: 'Vv2rT9kQe4yHb0sZxJd1LmN6cUa8PfWoG3iEtXq7RhA=', ep: '203.0.113.7:51820', ips: '10.8.0.0/24, 192.168.1.0/24', ago: 72, rx: 5641134, tx: 32998400, ka: 25 },
    { key: 'kP4wZ0tYb9xQe2sVv7LmN1cUa6HfRoG8iEtXq3JdBhA=', ep: '198.51.100.4:42011', ips: '10.8.0.3/32', ago: 7449, rx: 1229, tx: 3174 },
    { key: 'Zq8nB3yTe6xWk1sVv5LmP2cUa9HfRoG4iEtXq7JdKhA=', ips: '10.8.0.4/32', ago: 0, rx: 0, tx: 0 }
  ];
  function wgBytes(n) { if (n < 1024) return n + ' B'; var u = ['KiB', 'MiB', 'GiB'], i = -1; do { n /= 1024; i++; } while (n >= 1024 && i < 2); return n.toFixed(2) + ' ' + u[i]; }
  function wgAgo(sec) {
    var parts = [], d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    [[d, 'day'], [h, 'hour'], [m, 'minute'], [s, 'second']].forEach(function (x) { if (x[0]) parts.push(x[0] + ' ' + x[1] + (x[0] === 1 ? '' : 's')); });
    return parts.join(', ') + ' ago';
  }
  C.wg = function (a) {
    var sub = a[0] || 'show';
    if (sub === 'genkey' || sub === 'genpsk') { var k = ''; var al = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; for (var i = 0; i < 43; i++) k += al[Math.floor(Math.random() * 64)]; return { out: k + '=\n' }; }
    if (sub !== 'show') return { err: 'wg: the simulator knows only show, genkey and genpsk\n', code: 1 };
    var ifc = a[1], field = a[2];
    if (ifc === 'interfaces') return { out: 'utun4\n' };
    if (ifc && ifc !== 'all' && ifc !== 'utun4' && ifc !== 'wg0') return { err: 'Unable to access interface: No such file or directory\n', code: 1 };
    if (field === 'peers') return { out: WGP.map(function (p) { return p.key + '\n'; }).join('') };
    if (field === 'transfer') return { out: WGP.map(function (p) { return p.key + '\t' + p.rx + '\t' + p.tx + '\n'; }).join('') };
    if (field === 'latest-handshakes') { var now = Math.floor(NOW.getTime() / 1000); return { out: WGP.map(function (p) { return p.key + '\t' + (p.ago ? now - p.ago : 0) + '\n'; }).join('') }; }
    if (field === 'endpoints') return { out: WGP.map(function (p) { return p.key + '\t' + (p.ep || '(none)') + '\n'; }).join('') };
    if (field === 'allowed-ips') return { out: WGP.map(function (p) { return p.key + '\t' + p.ips.replace(/, /g, ' ') + '\n'; }).join('') };
    if (field === 'listening-port') return { out: '58214\n' };
    if (field === 'public-key') return { out: WGK.me + '\n' };
    var o = 'interface: utun4\n  public key: ' + WGK.me + '\n  private key: (hidden)\n  listening port: 58214\n';
    WGP.forEach(function (p) {
      o += '\npeer: ' + p.key + '\n' + (p.ep ? '  endpoint: ' + p.ep + '\n' : '') + '  allowed ips: ' + p.ips + '\n' + (p.ago ? '  latest handshake: ' + wgAgo(p.ago) + '\n  transfer: ' + wgBytes(p.rx) + ' received, ' + wgBytes(p.tx) + ' sent\n' : '') + (p.ka ? '  persistent keepalive: every ' + p.ka + ' seconds\n' : '');
    });
    return { out: o };
  };
  C.scutil = function (a) {
    if (a[0] === '--dns') return { out: 'DNS configuration\n\nresolver #1\n  search domain[0] : lan\n  nameserver[0] : 192.168.1.1\n  if_index : 14 (en0)\n  flags    : Request A records\n  reach    : 0x00020002 (Reachable,Directly Reachable Address)\n\nresolver #2\n  domain   : local\n  options  : mdns\n  timeout  : 5\n  flags    : Request A records\n  order    : 300000\n' };
    if (a[0] === '--get') { var m = { ComputerName: 'MacBook', HostName: 'macbook.local', LocalHostName: 'macbook' }; return m[a[1]] ? { out: m[a[1]] + '\n' } : { err: a[1] + ': not set\n', code: 1 }; }
    return { err: 'usage: scutil --dns | --get ComputerName|HostName|LocalHostName\n', code: 64 };
  };
  C.networksetup = function (a) {
    if (a[0] === '-listallhardwareports') return { out: 'Hardware Port: Wi-Fi\nDevice: en0\nEthernet Address: f0:18:98:3a:6d:21\n\nHardware Port: Thunderbolt Bridge\nDevice: bridge0\nEthernet Address: 36:55:12:ab:cd:01\n' };
    if (a[0] === '-getdnsservers') return { out: '192.168.1.1\n' };
    if (a[0] === '-getinfo') return { out: 'DHCP Configuration\nIP address: 192.168.1.23\nSubnet mask: 255.255.255.0\nRouter: 192.168.1.1\nClient ID:\nIPv6: Automatic\nIPv6 IP address: none\nIPv6 Router: none\nEthernet Address: f0:18:98:3a:6d:21\n' };
    if (a[0] === '-getairportnetwork') return { out: 'Current Wi-Fi Network: HomeNet\n' };
    return { err: 'networksetup: only -listallhardwareports, -getdnsservers, -getinfo and -getairportnetwork are simulated\n', code: 1 };
  };
  C.curl = function (a, c) {
    var p = flags(a, 'sSIiLvo:OX:H:d:kfw:m:A:u:e:', { multi: { H: 1 }, loose: true, long: { head: 'I', silent: 's', include: 'i', location: 'L', output: 'o', verbose: 'v', header: 'H', request: 'X', data: 'd', 'write-out': 'w' } });
    var url = p.rest.filter(function (x) { return x[0] !== '-'; })[0];
    if (!url) return { err: 'curl: try \'curl --help\' or \'curl --manual\' for more information\n', code: 2 };
    var m = /^(https?):\/\/([^\/:]+)(?::(\d+))?(\/.*)?$/.exec(url) || /^([^\/:]+)(?::(\d+))?(\/.*)?$/.exec(url), scheme, host, path;
    if (/^https?:/.test(url)) { scheme = m[1]; host = m[2]; path = m[4] || '/'; } else { scheme = 'http'; host = m[1]; path = m[3] || '/'; }
    var ip = resolve(host);
    if (!ip) return { err: 'curl: (6) Could not resolve host: ' + host + '\n', code: 6 };
    if (!isLan(ip) && ip !== '93.184.216.34' && !/github|python|google/.test(host)) { }
    var body, status = 200, st = 'OK', headers;
    if (host === '127.0.0.1' || host === 'localhost') { return { err: 'curl: (7) Failed to connect to ' + host + ' port 80 after 0 ms: Couldn\'t connect to server\n', code: 7 }; }
    if (ip === '192.168.1.1') { body = '<html><head><title>Router</title></head><body>Admin login</body></html>\n'; headers = { Server: 'lighttpd/1.4.59', 'Content-Type': 'text/html' }; }
    else if (ip === '192.168.1.50') { body = '<h1>Pi web server</h1>\n'; headers = { Server: 'nginx/1.22.1', 'Content-Type': 'text/html' }; }
    else if (host === 'example.com' || host === 'www.example.com') {
      if (path === '/') { body = '<!doctype html>\n<html>\n<head>\n    <title>Example Domain</title>\n</head>\n<body>\n<div>\n    <h1>Example Domain</h1>\n    <p>This domain is for use in illustrative examples in documents.</p>\n</div>\n</body>\n</html>\n'; headers = { 'Content-Type': 'text/html; charset=UTF-8', 'Content-Length': String(body.length), Server: 'ECAcc (dcd/7D2B)', Date: 'Thu, 08 Oct 2026 08:41:00 GMT', 'Cache-Control': 'max-age=604800' }; }
      else { status = 404; st = 'Not Found'; body = '<!doctype html><title>404 Not Found</title>\n'; headers = { 'Content-Type': 'text/html', Server: 'ECAcc (dcd/7D2B)' }; }
    } else { body = '<html><body>' + host + '</body></html>\n'; headers = { 'Content-Type': 'text/html', Server: 'nginx' }; }
    if (scheme === 'http' && host === 'example.com' && p.f.L) { }
    var hdr = 'HTTP/1.1 ' + status + ' ' + st + '\r\n' + Object.keys(headers).map(function (k) { return k + ': ' + headers[k]; }).join('\r\n') + '\r\n\r\n';
    hdr = hdr.replace(/\r/g, '');
    var o = '';
    if (p.f.v) o += '* Host ' + host + ' was resolved.\n*   Trying ' + ip + ':' + (scheme === 'https' ? 443 : 80) + '...\n* Connected to ' + host + ' (' + ip + ') port ' + (scheme === 'https' ? 443 : 80) + '\n> GET ' + path + ' HTTP/1.1\n> Host: ' + host + '\n> User-Agent: curl/8.7.1\n> Accept: */*\n>\n< ' + hdr.replace(/\n/g, '\n< ').replace(/< $/, '');
    if (p.f.I) return { out: hdr };
    if (p.f.i) o += hdr;
    if (!p.f.v || true) o += body;
    var wfmt = p.f.w, prog = '';
    if (p.f.o) { if (p.f.o !== '/dev/null') c.fs.write(c.sh.abs(p.f.o), body); o = ''; if (!p.f.s) prog = '  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100  ' + body.length + '  100  ' + body.length + '    0     0   ' + (body.length * 20) + '      0 --:--:-- --:--:-- --:--:--  ' + (body.length * 20) + '\n'; }
    if (wfmt) o += wfmt.replace(/%\{http_code\}/g, String(status)).replace(/%\{time_total\}/g, '0.084312').replace(/%\{size_download\}/g, String(body.length)).replace(/\\n/g, '\n');
    return { out: o, err: prog };
  };
  C.wget = function () { return { err: 'zsh: command not found: wget\n(macOS does not ship wget; use curl -O)\n', code: 127 }; };
  C.ssh = function (a) { return { err: 'ssh: the simulator cannot open real connections. In your Terminal: ssh ' + (a.filter(function (x) { return x[0] !== '-'; })[0] || 'user@host') + '\n', code: 255 }; };
  C.whois = function (a) { return { out: 'Domain Name: ' + (a[0] || 'EXAMPLE.COM').toUpperCase() + '\nRegistry Domain ID: 2336799_DOMAIN_COM-VRSN\nRegistrar: RESERVED-Internet Assigned Numbers Authority\nName Server: A.IANA-SERVERS.NET\nName Server: B.IANA-SERVERS.NET\n' }; };
})(SIM);

