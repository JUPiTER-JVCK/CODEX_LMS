/* Node-compatible value formatting (a port of the parts of util.inspect / util.format / console.table
   that matter for teaching). Runs inside playground iframes and in Node (for tests). */
var PPI = (function () {
  'use strict';
  var BREAK = 80, DEPTH = 2, COMPACT = 3, MAXARR = 100, MAXSTR = 10000;
  var IDENT = /^[a-zA-Z_][a-zA-Z_0-9]*$/;
  var hasNode = typeof Node !== 'undefined' && typeof document !== 'undefined';

  function strEscape(s) {
    var q = "'";
    if (s.indexOf("'") >= 0) { if (s.indexOf('"') < 0) q = '"'; else if (s.indexOf('`') < 0 && s.indexOf('${') < 0) q = '`'; }
    var o = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i], code = s.charCodeAt(i);
      if (c === q || c === '\\') o += '\\' + c;
      else if (c === '\n') o += '\\n'; else if (c === '\t') o += '\\t'; else if (c === '\r') o += '\\r';
      else if (c === '\b') o += '\\b'; else if (c === '\f') o += '\\f'; else if (c === '\v') o += '\\v';
      else if (code < 0x20 || code === 0x7f) o += '\\x' + (code < 16 ? '0' : '') + code.toString(16).toUpperCase();
      else o += c;
    }
    return q + o + q;
  }
  function fmtNumber(n) { return Object.is(n, -0) ? '-0' : String(n); }
  function fmtPrimitive(v) {
    switch (typeof v) {
      case 'string': return strEscape(v.length > MAXSTR ? v.slice(0, MAXSTR) : v);
      case 'number': return fmtNumber(v);
      case 'bigint': return String(v) + 'n';
      case 'boolean': return String(v);
      case 'undefined': return 'undefined';
      case 'symbol': return v.toString();
    }
    return String(v);
  }
  function getCtorName(o) {
    var p = o;
    while (p) {
      var d = Object.getOwnPropertyDescriptor(p, 'constructor');
      if (d && typeof d.value === 'function' && d.value.name !== '') return d.value.name;
      p = Object.getPrototypeOf(p);
    }
    return null;
  }
  function fnBase(f) {
    var src = ''; try { src = Function.prototype.toString.call(f); } catch (e) { }
    if (/^class\b/.test(src)) {
      var m = /^class\s+[\w$]*\s*extends\s+([\w$.]+)/.exec(src);
      var nm = f.name ? 'class ' + f.name : 'class (anonymous)';
      if (m) { var sup = Object.getPrototypeOf(f); nm += ' extends ' + (sup && sup.name ? sup.name : m[1]); }
      return '[' + nm + ']';
    }
    var type = 'Function';
    var tag = Object.prototype.toString.call(f);
    if (tag === '[object AsyncFunction]') type = 'AsyncFunction';
    else if (tag === '[object GeneratorFunction]') type = 'GeneratorFunction';
    else if (tag === '[object AsyncGeneratorFunction]') type = 'AsyncGeneratorFunction';
    return '[' + type + (f.name ? ': ' + f.name : ' (anonymous)') + ']';
  }
  function fmtKey(k) {
    if (typeof k === 'symbol') return '[' + k.toString() + ']';
    return IDENT.test(k) ? k : strEscape(k);
  }
  function isBelow(ctx, output, start, base) {
    var total = output.length + start;
    if (total + output.length > BREAK) return false;
    for (var i = 0; i < output.length; i++) { total += output[i].length; if (total > BREAK) return false; }
    return base === '' || base.indexOf('\n') < 0;
  }
  function groupArray(ctx, output, value) {
    var total = 0, maxLen = 0, i, outLen = output.length;
    if (ctx.hasMore) outLen--;
    var sep = 2, dataLen = new Array(outLen);
    for (i = 0; i < outLen; i++) { var len = output[i].length; dataLen[i] = len; total += len + sep; if (maxLen < len) maxLen = len; }
    var actualMax = maxLen + sep;
    if (actualMax * 3 + ctx.indent < BREAK && (total / actualMax > 5 || maxLen <= 6)) {
      var averageBias = Math.sqrt(actualMax - total / output.length), biasedMax = Math.max(actualMax - 3 - averageBias, 1);
      var columns = Math.min(Math.round(Math.sqrt(2.5 * biasedMax * outLen) / biasedMax), Math.floor((BREAK - ctx.indent) / actualMax), COMPACT * 4, 15);
      if (columns <= 1) return output;
      var tmp = [], maxLine = [];
      for (i = 0; i < columns; i++) { var ll = 0; for (var j = i; j < output.length; j += columns) if (dataLen[j] > ll) ll = dataLen[j]; maxLine.push(ll + sep); }
      var padStart = true;
      if (value !== undefined) for (i = 0; i < output.length; i++) if (typeof value[i] !== 'number' && typeof value[i] !== 'bigint') { padStart = false; break; }
      for (i = 0; i < outLen; i += columns) {
        var max = Math.min(i + columns, outLen), str = '', k = i;
        for (; k < max - 1; k++) { var s = output[k] + ', '; str += padStart ? s.padStart(maxLine[k - i], ' ') : s.padEnd(maxLine[k - i], ' '); }
        if (padStart) str += output[k].padStart(maxLine[k - i] - sep, ' '); else str += output[k];
        tmp.push(str);
      }
      if (ctx.hasMore) tmp.push(output[outLen]);
      output = tmp;
    }
    return output;
  }
  function reduce(ctx, output, base, braces, isArr, depth, value) {
    var entries = output.length;
    if (isArr && entries > 6) output = groupArray(ctx, output, value);
    if (ctx.currentDepth - depth < COMPACT && entries === output.length) {
      var start = output.length + ctx.indent + braces[0].length + base.length + 10;
      if (isBelow(ctx, output, start, base)) {
        var joined = output.join(', ');
        if (joined.indexOf('\n') < 0) return (base ? base + ' ' : '') + braces[0] + ' ' + joined + ' ' + braces[1];
      }
    }
    var ind = '\n' + ' '.repeat(ctx.indent);
    return (base ? base + ' ' : '') + braces[0] + ind + '  ' + output.join(',' + ind + '  ') + ind + braces[1];
  }
  function domNode(n) {
    if (n.nodeType === 3) return strEscape(n.textContent);
    if (n.nodeType === 9) return '#document';
    if (n.nodeType !== 1) return '[' + (n.nodeName || 'Node') + ']';
    var t = n.tagName.toLowerCase(), a = '';
    for (var i = 0; i < n.attributes.length; i++) a += ' ' + n.attributes[i].name + (n.attributes[i].value !== '' ? '="' + n.attributes[i].value + '"' : '');
    return '<' + t + a + '>' + (n.children.length || n.textContent.length > 30 ? '…' : n.textContent) + '</' + t + '>';
  }
  function formatValue(ctx, v, depth, nested) {
    if (v === null) return 'null';
    var t = typeof v;
    if (t !== 'object' && t !== 'function') return fmtPrimitive(v);
    if (hasNode && v instanceof Node) return domNode(v);
    if (ctx.seen.indexOf(v) >= 0) {
      var idx = ctx.circular.indexOf(v); if (idx < 0) { ctx.circular.push(v); idx = ctx.circular.length - 1; }
      return '[Circular *' + (idx + 1) + ']';
    }
    return formatRaw(ctx, v, depth);
  }
  function getKeys(v) {
    var keys = Object.keys(v), syms = Object.getOwnPropertySymbols(v).filter(function (s) { return Object.getOwnPropertyDescriptor(v, s).enumerable; });
    return keys.concat(syms);
  }
  function formatProp(ctx, v, depth, key, isArr) {
    var d = Object.getOwnPropertyDescriptor(v, key) || { value: v[key], enumerable: true }, str;
    if (d.value !== undefined || !('get' in d || 'set' in d)) {
      ctx.indent += 2; str = formatValue(ctx, d.value, depth, true); ctx.indent -= 2;
    } else if (d.get) str = d.set ? '[Getter/Setter]' : '[Getter]';
    else str = d.set ? '[Setter]' : 'undefined';
    if (isArr) return str;
    return fmtKey(key) + ': ' + str;
  }
  function formatRaw(ctx, v, depth) {
    var keys = [], base = '', braces, isArr = false, output = [], ctor = null, i;
    var tag = Object.prototype.toString.call(v);
    try { ctor = getCtorName(v); } catch (e) { }
    var protoNull = Object.getPrototypeOf(v) === null;
    var prefix = function (fallback, size) { var c = ctor === null ? '[' + fallback + ': null prototype]' : ctor; if (size !== undefined) c += '(' + size + ')'; return c; };
    var formatter = null;
    if (Array.isArray(v)) {
      isArr = true;
      keys = Object.keys(v).filter(function (k) { return !/^(0|[1-9]\d*)$/.test(k); });
      var pre = (ctor !== 'Array' || protoNull) ? prefix('Array', v.length) + ' ' : '';
      braces = [pre + '[', ']'];
      if (v.length === 0 && keys.length === 0) return braces[0] + ']';
      formatter = function () {
        var out = [], n = Math.min(MAXARR, v.length), holes = 0;
        for (var k = 0; k < n; k++) {
          if (!Object.prototype.hasOwnProperty.call(v, k)) { holes++; continue; }
          if (holes) { out.push('<' + holes + ' empty item' + (holes > 1 ? 's' : '') + '>'); holes = 0; }
          out.push(formatProp(ctx, v, depth, k, true));
        }
        if (holes) out.push('<' + holes + ' empty item' + (holes > 1 ? 's' : '') + '>');
        if (v.length > MAXARR) { out.push('... ' + (v.length - MAXARR) + ' more item' + (v.length - MAXARR > 1 ? 's' : '')); ctx.hasMore = true; }
        return out;
      };
    } else if (tag === '[object Set]') {
      keys = getKeys(v);
      braces = [prefix('Set', v.size) + ' {', '}'];
      if (v.size === 0 && !keys.length) return braces[0] + '}';
      formatter = function () { var out = []; ctx.indent += 2; v.forEach(function (x) { out.push(formatValue(ctx, x, depth)); }); ctx.indent -= 2; return out; };
    } else if (tag === '[object Map]') {
      keys = getKeys(v);
      braces = [prefix('Map', v.size) + ' {', '}'];
      if (v.size === 0 && !keys.length) return braces[0] + '}';
      formatter = function () { var out = []; ctx.indent += 2; v.forEach(function (x, k) { out.push(formatValue(ctx, k, depth) + ' => ' + formatValue(ctx, x, depth)); }); ctx.indent -= 2; return out; };
    } else if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
      isArr = true; keys = [];
      braces = [ctor + '(' + v.length + ') [', ']'];
      if (v.length === 0) return braces[0] + ']';
      formatter = function () { var out = []; for (var k = 0; k < Math.min(MAXARR, v.length); k++) out.push(fmtPrimitive(v[k])); return out; };
    } else if (hasNode && typeof NodeList !== 'undefined' && (v instanceof NodeList || v instanceof HTMLCollection)) {
      isArr = true;
      braces = [ctor + '(' + v.length + ') [', ']'];
      if (!v.length) return braces[0] + ']';
      formatter = function () { var out = []; for (var k = 0; k < v.length; k++) out.push(domNode(v[k])); return out; };
    } else {
      keys = getKeys(v);
      if (typeof v === 'function') {
        base = fnBase(v);
        keys = keys.filter(function (k) { return k !== 'prototype'; });
        if (!keys.length) return base;
        braces = ['{', '}'];
      } else if (tag === '[object RegExp]') {
        base = RegExp.prototype.toString.call(v); if (!keys.length) return base; braces = ['{', '}'];
      } else if (tag === '[object Date]') {
        base = isNaN(v.getTime()) ? 'Invalid Date' : v.toISOString(); if (!keys.length) return base; braces = ['{', '}'];
      } else if (v instanceof Error || tag === '[object Error]') {
        var st = v.stack || '';
        base = (st && /^\w*Error\b|^\w+:/.test(st) && st.indexOf(v.message) >= 0) ? st.split('\n').filter(function (l) { return !/^\s+at\s|@/.test(l) || false; }).join('\n') : String(v);
        if (!/^\w/.test(base) || base.indexOf('\n') >= 0 && false) base = String(v);
        base = '[' + String(v.name ? v.name + (v.message ? ': ' + v.message : '') : v) + ']';
        if (ctx.topLevel === v) base = base.slice(1, -1);
        keys = keys.filter(function (k) { return k !== 'stack' && k !== 'message'; });
        if (!keys.length) return base;
        braces = ['{', '}'];
      } else if (tag === '[object Promise]') {
        braces = [(ctor || 'Promise') + ' {', '}']; formatter = function () { return ['<pending>']; };
      } else if (tag === '[object WeakMap]' || tag === '[object WeakSet]') {
        return (ctor || tag.slice(8, -1)) + ' { <items unknown> }';
      } else if (tag === '[object Symbol]' || tag === '[object Number]' || tag === '[object String]' || tag === '[object Boolean]' || tag === '[object BigInt]') {
        var prim = v.valueOf(), nm = tag.slice(8, -1);
        base = '[' + nm + ': ' + fmtPrimitive(prim) + ']';
        if (nm === 'String') keys = keys.filter(function (k) { return !/^\d+$/.test(k); });
        if (!keys.length) return base; braces = ['{', '}'];
      } else if (tag === '[object Arguments]') {
        isArr = true; braces = ['[Arguments] [', ']']; keys = [];
        formatter = function () { var out = []; for (var k = 0; k < v.length; k++) out.push(formatProp(ctx, v, depth, k, true)); return out; };
      } else {
        var tg = v[Symbol.toStringTag];
        if (protoNull) braces = ['[Object: null prototype] {', '}'];
        else if (ctor === 'Object') braces = [typeof tg === 'string' && tg ? 'Object [' + tg + '] {' : '{', '}'];
        else braces = [(ctor || 'Object') + (typeof tg === 'string' && tg && tg !== ctor ? ' [' + tg + ']' : '') + ' {', '}'];
        if (!keys.length) return braces[0] === '{' ? '{}' : braces[0] + '}';
      }
    }
    if (depth > DEPTH) {
      var nmx = ctor || (protoNull ? 'Object: null prototype' : 'Object');
      return '[' + nmx + ']';
    }
    depth += 1;
    ctx.seen.push(v);
    ctx.currentDepth = depth;
    var saveMore = ctx.hasMore; ctx.hasMore = false;
    if (formatter) output = formatter();
    for (i = 0; i < keys.length; i++) output.push(formatProp(ctx, v, depth, keys[i], false));
    ctx.seen.pop();
    var res = reduce(ctx, output, base, braces, isArr, depth, v);
    ctx.hasMore = saveMore;
    var ci = ctx.circular.indexOf(v);
    if (ci >= 0) res = '<ref *' + (ci + 1) + '> ' + res;
    return res;
  }
  function inspect(v, opts) {
    var save = DEPTH, saveA = MAXARR; if (opts && opts.depth !== undefined) DEPTH = opts.depth === null ? Infinity : opts.depth; if (opts && opts.maxArrayLength !== undefined) MAXARR = opts.maxArrayLength;
    var ctx = { seen: [], circular: [], indent: 0, currentDepth: 0, hasMore: false, topLevel: v };
    try { return formatValue(ctx, v, 0); } finally { DEPTH = save; MAXARR = saveA; }
  }
  function fmtNum(x) { return typeof x === 'bigint' ? x + 'n' : typeof x === 'symbol' ? 'NaN' : fmtNumber(Number(x)); }
  function format(args) {
    args = Array.prototype.slice.call(args);
    var first = args[0], a = 0, str = '';
    if (typeof first === 'string' && args.length > 1 && first.indexOf('%') >= 0) {
      a = 1; var last = 0;
      for (var i = 0; i < first.length - 1; i++) {
        if (first[i] !== '%') continue;
        var c = first[i + 1], rep;
        if (c === '%') { str += first.slice(last, i) + '%'; last = i + 2; i++; continue; }
        if (a >= args.length || 'sdifjoOc'.indexOf(c) < 0) continue;
        var x = args[a];
        switch (c) {
          case 's': rep = typeof x === 'string' ? x : typeof x === 'bigint' ? x + 'n' : typeof x === 'number' ? fmtNumber(x) : (x !== null && typeof x === 'object') ? inspect(x, { depth: 0 }) : String(x); break;
          case 'd': rep = fmtNum(x); break;
          case 'i': rep = typeof x === 'bigint' ? x + 'n' : typeof x === 'symbol' ? 'NaN' : fmtNumber(parseInt(x)); break;
          case 'f': rep = typeof x === 'symbol' ? 'NaN' : fmtNumber(parseFloat(x)); break;
          case 'j': try { rep = JSON.stringify(x); } catch (e) { rep = '[Circular]'; } break;
          case 'o': rep = inspect(x, { depth: 4 }); if (Array.isArray(x)) rep = rep.replace(/ ?\]$/, (x.length ? ', ' : '') + '[length]: ' + x.length + ' ]').replace('[[length]', '[ [length]'); break;
          case 'O': rep = inspect(x); break;
          case 'c': rep = ''; break;
        }
        str += first.slice(last, i) + rep; last = i + 2; i++; a++;
      }
      str += first.slice(last);
    }
    for (; a < args.length; a++) {
      var v = args[a];
      str += (str || a > 0 ? ' ' : '') + (typeof v === 'string' ? v : inspect(v));
    }
    if (a === 0 && !args.length) return '';
    return str;
  }
  function cell(v) {
    if (v === undefined) return '';
    var depth = v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 2 ? -1 : 0;
    return inspect(v, { depth: depth, maxArrayLength: 3 });
  }
  function table(data, props) {
    if (data === null || typeof data !== 'object') return null;
    var rows = [], cols = [], hasValues = false, isArr = Array.isArray(data);
    var keys = Object.keys(data);
    keys.forEach(function (k) {
      var r = data[k], row = { __i: k, v: {} };
      if (r !== null && typeof r === 'object') {
        Object.keys(r).forEach(function (c) { if (props && props.indexOf(c) < 0) return; if (cols.indexOf(c) < 0) cols.push(c); row.v[c] = cell(r[c]); });
      } else { hasValues = true; row.val = cell(r); }
      rows.push(row);
    });
    if (props) cols = props.filter(function (p) { return true; });
    var head = ['(index)'].concat(cols); if (hasValues && !props) head.push('Values');
    var body = rows.map(function (r) { var line = [r.__i]; cols.forEach(function (c) { line.push(r.v[c] !== undefined ? r.v[c] : ''); }); if (hasValues && !props) line.push(r.val !== undefined ? r.val : ''); return line; });
    var w = head.map(function (h, i) { var m = h.length; body.forEach(function (l) { if (String(l[i]).length > m) m = String(l[i]).length; }); return m + 2; });
    var line = function (l, m, r) { return l + w.map(function (n) { return '─'.repeat(n); }).join(m) + r; };
    var row = function (cells) { return '│' + cells.map(function (c, i) { return ' ' + String(c).padEnd(w[i] - 1); }).join('│') + '│'; };
    return [line('┌', '┬', '┐'), row(head), line('├', '┼', '┤')].concat(body.map(row)).concat([line('└', '┴', '┘')]).join('\n');
  }
  return { inspect: inspect, strEscape: strEscape, format: format, table: table };
})();


/* Mock "lab" web server used by fetch() inside playgrounds (and by the lint tool in Node).
   Same data as the book's LAN: 192.168.1.0/24. Deterministic: no randomness. */
var PPMock = (function () {
  'use strict';
  function seed() {
    return [
      { id: 1, name: 'router', ip: '192.168.1.1', mac: 'a4:2b:b0:11:22:01', type: 'router', online: true },
      { id: 2, name: 'macbook', ip: '192.168.1.23', mac: 'f0:18:98:3a:6d:21', type: 'laptop', online: true },
      { id: 3, name: 'pi', ip: '192.168.1.50', mac: 'dc:a6:32:4f:10:50', type: 'server', online: true },
      { id: 4, name: 'nas', ip: '192.168.1.60', mac: '00:11:32:aa:bb:60', type: 'storage', online: false },
      { id: 5, name: 'printer', ip: '192.168.1.70', mac: '3c:2a:f4:12:34:70', type: 'printer', online: true },
      { id: 6, name: 'homeassistant', ip: '192.168.1.90', mac: 'b8:27:eb:90:90:90', type: 'server', online: true }
    ];
  }
  var XML = '<?xml version="1.0" encoding="UTF-8"?>\n<network name="home" subnet="192.168.1.0/24">\n  <device id="1" type="router" online="true">\n    <name>router</name>\n    <ip>192.168.1.1</ip>\n    <port proto="tcp">80</port>\n    <port proto="tcp">443</port>\n  </device>\n  <device id="3" type="server" online="true">\n    <name>pi</name>\n    <ip>192.168.1.50</ip>\n    <port proto="tcp">22</port>\n    <port proto="tcp">8080</port>\n  </device>\n  <device id="4" type="storage" online="false">\n    <name>nas</name>\n    <ip>192.168.1.60</ip>\n    <port proto="tcp">445</port>\n  </device>\n</network>\n';
  var RSS = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>Lab Status</title>\n    <link>http://lab.local/</link>\n    <description>Events from the home lab</description>\n    <item>\n      <title>nas went offline</title>\n      <pubDate>Mon, 05 Oct 2026 09:12:00 GMT</pubDate>\n      <category>alert</category>\n    </item>\n    <item>\n      <title>pi updated to 6.12</title>\n      <pubDate>Sun, 04 Oct 2026 21:40:00 GMT</pubDate>\n      <category>info</category>\n    </item>\n  </channel>\n</rss>\n';
  var CSV = 'name,ip,type\nrouter,192.168.1.1,router\nmacbook,192.168.1.23,laptop\npi,192.168.1.50,server\nnas,192.168.1.60,storage\n';
  var HTMLDOC = '<!doctype html>\n<html><head><title>Lab</title></head><body><h1>Lab server</h1><p>It works.</p></body></html>\n';

  function create(G, onLog) {
    var devices = seed(), nextId = 7, flaky = 0, reqNo = 0;
    var RealResponse = G.Response, RealHeaders = G.Headers;
    function parseUrl(u) {
      var s = String(u && u.url ? u.url : u);
      var m = /^(https?):\/\/([^\/?#]+)([^?#]*)(\?[^#]*)?/.exec(s);
      if (m) return { abs: true, scheme: m[1], host: m[2].toLowerCase(), path: m[3] || '/', query: m[4] || '', href: s };
      var q = s.indexOf('?'), p = q >= 0 ? s.slice(0, q) : s;
      if (p.charAt(0) !== '/') p = '/' + p.replace(/^\.\//, '');
      return { abs: false, scheme: 'http', host: 'lab.local', path: p, query: q >= 0 ? s.slice(q) : '', href: 'http://lab.local' + p + (q >= 0 ? s.slice(q) : '') };
    }
    function qs(q) { var o = {}; q.replace(/^\?/, '').split('&').filter(Boolean).forEach(function (kv) { var i = kv.indexOf('='); o[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); }); return o; }
    function json(status, obj, extra) { return { status: status, type: 'application/json; charset=utf-8', body: obj === null ? null : JSON.stringify(obj), headers: extra || {} }; }
    function route(method, u, headers, body) {
      var p = u.path.replace(/\/+$/, '') || '/', q = qs(u.query), m;
      if (p === '/api/devices' && method === 'GET') {
        var list = devices.slice();
        if (q.type) list = list.filter(function (d) { return d.type === q.type; });
        if (q.online) list = list.filter(function (d) { return String(d.online) === q.online; });
        if (q.q) list = list.filter(function (d) { return d.name.indexOf(q.q) >= 0 || d.ip.indexOf(q.q) >= 0; });
        return json(200, list, { 'X-Total-Count': String(list.length) });
      }
      if (p === '/api/devices' && method === 'POST') {
        var b; try { b = JSON.parse(body || ''); } catch (e) { return json(400, { error: 'body must be JSON' }); }
        if (!b || !b.name || !b.ip) return json(400, { error: 'name and ip are required' });
        if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(b.ip)) return json(422, { error: 'ip is not an IPv4 address' });
        var d = { id: nextId++, name: String(b.name), ip: b.ip, mac: b.mac || null, type: b.type || 'unknown', online: b.online !== false };
        devices.push(d); return json(201, d, { Location: '/api/devices/' + d.id });
      }
      if ((m = /^\/api\/devices\/([^\/]+)$/.exec(p))) {
        var id = Number(m[1]), i = devices.findIndex(function (x) { return x.id === id; });
        if (i < 0) return json(404, { error: 'device ' + m[1] + ' not found' });
        if (method === 'GET') return json(200, devices[i]);
        if (method === 'DELETE') { devices.splice(i, 1); return { status: 204, type: '', body: null, headers: {} }; }
        if (method === 'PUT' || method === 'PATCH') {
          var c; try { c = JSON.parse(body || ''); } catch (e) { return json(400, { error: 'body must be JSON' }); }
          var nd = method === 'PUT' ? Object.assign({ id: id, mac: null, type: 'unknown', online: true }, c, { id: id }) : Object.assign({}, devices[i], c, { id: id });
          devices[i] = nd; return json(200, nd);
        }
        return json(405, { error: 'method not allowed' }, { Allow: 'GET, PUT, PATCH, DELETE' });
      }
      if (p === '/api/status') return json(200, { host: 'lab.local', uptime: 86400 * 3 + 3723, load: [0.42, 0.37, 0.31], devices: devices.length, online: devices.filter(function (d) { return d.online; }).length });
      if (p === '/api/slow') return Object.assign(json(200, { waited: Number(q.ms || 1500) }), { delay: Math.min(Number(q.ms || 1500), 8000) });
      if (p === '/api/flaky') { flaky++; return flaky % 2 ? json(503, { error: 'try again' }, { 'Retry-After': '1' }) : json(200, { ok: true, attempt: flaky }); }
      if (p === '/api/echo') { var h = {}; Object.keys(headers).forEach(function (k) { h[k] = headers[k]; }); var parsed = body; try { parsed = JSON.parse(body); } catch (e) { } return json(200, { method: method, path: p, query: q, headers: h, body: body === undefined || body === null ? null : parsed }); }
      if (p === '/api/me') { var a = headers.authorization || ''; if (a !== 'Bearer lab-token') return json(401, { error: 'missing or wrong token' }, { 'WWW-Authenticate': 'Bearer' }); return json(200, { user: 'learner', role: 'admin' }); }
      if (p === '/api/search') { var term = (q.q || '').toLowerCase(); return json(200, devices.filter(function (d) { return d.name.indexOf(term) >= 0; }).map(function (d) { return d.name; })); }
      if (p === '/data/devices.xml') return { status: 200, type: 'application/xml', body: XML, headers: {} };
      if (p === '/data/feed.rss') return { status: 200, type: 'application/rss+xml', body: RSS, headers: {} };
      if (p === '/data/hosts.csv') return { status: 200, type: 'text/csv', body: CSV, headers: {} };
      if (p === '/' || p === '/index.html') return { status: 200, type: 'text/html', body: HTMLDOC, headers: {} };
      if (p === '/api/error') return json(500, { error: 'internal server error' });
      return json(404, { error: 'no route for ' + method + ' ' + p });
    }
    var STATUS = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 404: 'Not Found', 405: 'Method Not Allowed', 422: 'Unprocessable Content', 500: 'Internal Server Error', 503: 'Service Unavailable' };
    function mockFetch(input, init) {
      init = init || {};
      var u = parseUrl(input), method = String(init.method || (input && input.method) || 'GET').toUpperCase(), hdr = {};
      var srcH = init.headers || (input && input.headers);
      if (srcH) { if (typeof srcH.forEach === 'function' && !Array.isArray(srcH)) srcH.forEach(function (v, k) { hdr[k.toLowerCase()] = v; }); else if (Array.isArray(srcH)) srcH.forEach(function (p) { hdr[String(p[0]).toLowerCase()] = p[1]; }); else Object.keys(srcH).forEach(function (k) { hdr[k.toLowerCase()] = srcH[k]; }); }
      var body = init.body;
      if (body !== undefined && body !== null && typeof body !== 'string') { try { body = typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams ? body.toString() : (typeof FormData !== 'undefined' && body instanceof FormData ? new URLSearchParams(body).toString() : String(body)); } catch (e) { body = String(body); } }
      var id = ++reqNo, t0 = Date.now();
      var known = !u.abs || u.host === 'lab.local' || u.host === 'cors.example' || u.host === 'nocors.example' || u.host === 'localhost' || /^localhost:\d+$/.test(u.host) || u.host === 'api.example.com';
      return new Promise(function (resolve, reject) {
        var log = function (r, extra) { if (onLog) onLog(Object.assign({ id: id, method: method, url: u.href, reqHeaders: hdr, reqBody: body === undefined ? null : body, ms: Date.now() - t0 }, r, extra || {})); };
        if (!known) {
          setTimeout(function () { log({ status: 0, statusText: '(failed)', error: 'net::ERR_NAME_NOT_RESOLVED' }); reject(new TypeError('Failed to fetch')); }, 30);
          return;
        }
        var r = route(method, u, hdr, body);
        if (u.host === 'cors.example' || u.host === 'api.example.com') r.headers['Access-Control-Allow-Origin'] = '*';
        var delay = r.delay || 40;
        var abort = init.signal;
        if (abort && abort.aborted) { reject(abort.reason !== undefined ? abort.reason : new Error('This operation was aborted')); return; }
        var timer = setTimeout(function () {
          if (abort && abort.aborted) return;
          var resH = Object.assign({ 'Content-Type': r.type, 'Date': 'Mon, 05 Oct 2026 10:00:00 GMT', 'Server': 'lab-mock/1.0' }, r.headers);
          if (!r.type) delete resH['Content-Type'];
          if (r.body !== null) resH['Content-Length'] = String(r.body.length);
          if (u.host === 'nocors.example') { log({ status: r.status, statusText: 'CORS error', resHeaders: resH, error: 'CORS' }); if (G.console && G.console.__ppNative) G.console.__ppNative('error', "Access to fetch at '" + u.href + "' from origin 'http://lab.local' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource."); reject(new TypeError('Failed to fetch')); return; }
          log({ status: r.status, statusText: STATUS[r.status] || '', resHeaders: resH, resBody: r.body, size: r.body ? r.body.length : 0, type: r.type });
          var res = new RealResponse(r.status === 204 ? null : r.body, { status: r.status, statusText: STATUS[r.status] || '', headers: resH });
          try { Object.defineProperty(res, 'url', { value: u.href }); } catch (e) { }
          resolve(res);
        }, delay);
        if (abort) abort.addEventListener('abort', function () { clearTimeout(timer); log({ status: 0, statusText: '(canceled)', error: 'aborted' }); var e; try { e = new DOMException('This operation was aborted', 'AbortError'); } catch (x) { e = new Error('This operation was aborted'); e.name = 'AbortError'; } reject(abort.reason !== undefined ? abort.reason : e); });
      });
    }
    return { fetch: mockFetch, reset: function () { devices = seed(); nextId = 7; flaky = 0; } };
  }
  return { create: create };
})();


/* Runs inside every playground iframe (sandbox="allow-scripts", opaque origin).
   Needs PPI (web-inspect.js) and PPMock (web-mock.js) loaded first. Talks to the book through postMessage. */
(function () {
  'use strict';
  var W = window, TOK = W.__ppTok, post = function (m) { m.__pp = TOK; try { parent.postMessage(m, '*'); } catch (e) { } };
  var origST = W.setTimeout.bind(W), origCT = W.clearTimeout.bind(W), origSI = W.setInterval.bind(W), origCI = W.clearInterval.bind(W);
  var pending = new Set(), intervals = new Set(), fetches = 0, mainDone = false, doneSent = false, groupLvl = 0, counts = {}, timers = {};
  var outBuf = [], lastTick = Date.now();
  (function tick() { lastTick = Date.now(); origST(tick, 100); })();
  W.__ppG = function () { if (Date.now() - lastTick > 4000) { lastTick = Date.now(); throw new Error('Loop stopped: the page was busy for 4 seconds without a break (an endless loop?)'); } };

  /* ---- console ---- */
  function emit(level, text) {
    if (groupLvl) text = text.split('\n').map(function (l) { return '  '.repeat(groupLvl) + l; }).join('\n');
    outBuf.push(text);
    post({ t: 'log', level: level, text: text });
  }
  var C = W.console, native = {};
  ['log', 'info', 'debug', 'warn', 'error'].forEach(function (k) { native[k] = C[k] ? C[k].bind(C) : function () { }; C[k] = function () { emit(k, PPI.format(arguments)); }; });
  C.__ppNative = function (level, text) { post({ t: 'log', level: level, text: text, sys: 1 }); };
  C.dir = function (v, o) { emit('log', PPI.inspect(v, o || {})); };
  C.table = function (d, p) { var s = PPI.table(d, p); emit('log', s === null ? PPI.format([d]) : s); };
  C.group = C.groupCollapsed = function () { if (arguments.length) emit('log', PPI.format(arguments)); groupLvl++; };
  C.groupEnd = function () { if (groupLvl) groupLvl--; };
  C.count = function (l) { l = l === undefined ? 'default' : String(l); counts[l] = (counts[l] || 0) + 1; emit('info', l + ': ' + counts[l]); };
  C.countReset = function (l) { counts[l === undefined ? 'default' : String(l)] = 0; };
  C.assert = function (cond) { if (!cond) { var rest = Array.prototype.slice.call(arguments, 1); emit('error', 'Assertion failed' + (rest.length ? ': ' + PPI.format(rest) : '')); } };
  C.time = function (l) { timers[l === undefined ? 'default' : String(l)] = performance.now(); };
  function tl(l, end, extra) { l = l === undefined ? 'default' : String(l); if (!(l in timers)) { emit('warn', "Warning: No such label '" + l + "' for console.time" + (end ? 'End()' : 'Log()')); return; } var ms = performance.now() - timers[l]; if (end) delete timers[l]; emit('info', l + ': ' + (ms < 1000 ? ms.toFixed(3) + 'ms' : (ms / 1000).toFixed(3) + 's') + (extra && extra.length ? ' ' + PPI.format(extra) : '')); }
  C.timeEnd = function (l) { tl(l, true); };
  C.timeLog = function (l) { tl(l, false, Array.prototype.slice.call(arguments, 1)); };
  C.trace = function () { emit('log', 'Trace' + (arguments.length ? ': ' + PPI.format(arguments) : '')); };
  C.clear = function () { outBuf = []; post({ t: 'clear' }); };
  W.__ppOut = function () { return outBuf.join('\n') + (outBuf.length ? '\n' : ''); };

  /* ---- uncaught errors ---- */
  function errText(e) {
    if (e && typeof e === 'object' && 'message' in e) return (e.name || 'Error') + ': ' + e.message;
    return PPI.inspect(e);
  }
  W.addEventListener('error', function (ev) {
    var e = ev.error, msg = e ? errText(e) : String(ev.message || 'Script error').replace(/^Uncaught /, '');
    post({ t: 'log', level: 'error', text: 'Uncaught ' + msg, uncaught: 1, line: ev.lineno });
    mainDone = true; check(); ev.preventDefault();
  });
  W.addEventListener('unhandledrejection', function (ev) { ev.preventDefault(); post({ t: 'log', level: 'error', text: 'Uncaught (in promise) ' + errText(ev.reason), uncaught: 1 }); check(); });

  /* ---- timers: know when a program has finished ---- */
  W.setTimeout = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2), id;
    id = origST(function () { pending.delete(id); try { if (typeof fn === 'function') fn.apply(W, args); } finally { check(); } }, ms);
    pending.add(id); return id;
  };
  W.clearTimeout = function (id) { pending.delete(id); origCT(id); check(); };
  W.setInterval = function (fn, ms) { var args = Array.prototype.slice.call(arguments, 2); var id = origSI(function () { fn.apply(W, args); }, ms); intervals.add(id); return id; };
  W.clearInterval = function (id) { intervals.delete(id); origCI(id); check(); };
  function check() {
    if (!mainDone || doneSent) return;
    origST(function () { origST(function () { if (!doneSent && mainDone && pending.size === 0 && intervals.size === 0 && fetches === 0) { doneSent = true; post({ t: 'done', out: W.__ppOut() }); } }, 0); }, 0);
  }
  W.__ppMainDone = function () { mainDone = true; check(); };

  /* ---- mock network ---- */
  var mock = PPMock.create(W, function (rec) { post({ t: 'net', rec: rec }); });
  W.fetch = function (a, b) { fetches++; var p = mock.fetch(a, b); var fin = function () { fetches--; check(); }; p.then(fin, fin); return p; };
  W.XMLHttpRequest = function () { throw new Error('XMLHttpRequest is not available in this playground; use fetch()'); };

  /* ---- storage, cookies, dialogs (the opaque origin has none) ---- */
  function MemStorage() { var d = {}; var s = { getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; }, setItem: function (k, v) { d[String(k)] = String(v); post({ t: 'storage' }); }, removeItem: function (k) { delete d[String(k)]; post({ t: 'storage' }); }, clear: function () { d = {}; post({ t: 'storage' }); }, key: function (i) { return Object.keys(d)[i] === undefined ? null : Object.keys(d)[i]; } }; Object.defineProperty(s, 'length', { get: function () { return Object.keys(d).length; } }); s.__dump = function () { return d; }; return new Proxy(s, { get: function (t, k) { if (k in t) return t[k]; return typeof k === 'string' && Object.prototype.hasOwnProperty.call(d, k) ? d[k] : undefined; }, set: function (t, k, v) { t.setItem(k, v); return true; }, ownKeys: function () { return Object.keys(d); }, getOwnPropertyDescriptor: function (t, k) { return Object.prototype.hasOwnProperty.call(d, k) ? { value: d[k], enumerable: true, configurable: true, writable: true } : undefined; } }); }
  ['localStorage', 'sessionStorage'].forEach(function (n) { var ok = true; try { W[n].length; } catch (e) { ok = false; } if (!ok) { try { Object.defineProperty(W, n, { value: MemStorage(), configurable: true }); } catch (e) { } } });
  try { document.cookie; } catch (e) {
    var jar = {};
    try { Object.defineProperty(document, 'cookie', { configurable: true, get: function () { return Object.keys(jar).map(function (k) { return k + '=' + jar[k]; }).join('; '); }, set: function (v) { var kv = String(v).split(';')[0], i = kv.indexOf('='); if (i > 0) { var k = kv.slice(0, i).trim(), val = kv.slice(i + 1).trim(); if (/max-age=0|expires=Thu, 01 Jan 1970/i.test(v)) delete jar[k]; else jar[k] = val; post({ t: 'storage' }); } } }); } catch (x) { }
    W.__ppJar = function () { return jar; };
  }
  W.alert = function (m) { post({ t: 'log', level: 'warn', text: '[alert] ' + (m === undefined ? '' : String(m)), sys: 1 }); };
  W.confirm = function (m) { post({ t: 'log', level: 'warn', text: '[confirm] ' + String(m) + ' → answered OK (true)', sys: 1 }); return true; };
  W.prompt = function (m, d) { post({ t: 'log', level: 'warn', text: '[prompt] ' + String(m) + ' → answered ' + PPI.inspect(d === undefined ? '' : String(d)), sys: 1 }); return d === undefined ? '' : String(d); };
  W.open = function () { post({ t: 'log', level: 'warn', text: 'window.open() is blocked in this playground', sys: 1 }); return null; };

  /* ---- Elements panel support ---- */
  var ids = new WeakMap(), byId = {}, nid = 0, overlay = null, selected = null;
  function idOf(n) { var i = ids.get(n); if (!i) { i = ++nid; ids.set(n, i); byId[i] = n; } return i; }
  function snap(n, depth) {
    if (n.nodeType === 3) { var t = n.textContent; if (!t.trim()) return null; return { k: 't', x: t.length > 80 ? t.slice(0, 80) + '…' : t }; }
    if (n.nodeType === 8) return { k: 'c', x: n.textContent.slice(0, 60) };
    if (n.nodeType !== 1 || n === overlay || n.id === '__pp_ov') return null;
    var o = { k: 'e', i: idOf(n), tag: n.tagName.toLowerCase(), a: [], c: [] };
    for (var j = 0; j < n.attributes.length; j++) o.a.push([n.attributes[j].name, n.attributes[j].value]);
    if (/^(script|style)$/.test(o.tag) && n.hasAttribute('data-pp')) return null;
    if (depth < 40) for (var c = n.firstChild; c; c = c.nextSibling) { var s = snap(c, depth + 1); if (s) o.c.push(s); }
    return o;
  }
  function boxOf(el) {
    var cs = getComputedStyle(el), r = el.getBoundingClientRect(), g = function (p) { return parseFloat(cs.getPropertyValue(p)) || 0; };
    return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100, m: [g('margin-top'), g('margin-right'), g('margin-bottom'), g('margin-left')], b: [g('border-top-width'), g('border-right-width'), g('border-bottom-width'), g('border-left-width')], p: [g('padding-top'), g('padding-right'), g('padding-bottom'), g('padding-left')],
      cs: ['display', 'position', 'box-sizing', 'width', 'height', 'color', 'background-color', 'font-size', 'font-family', 'margin', 'padding', 'border', 'flex-direction', 'justify-content', 'align-items', 'grid-template-columns', 'gap'].map(function (p) { return [p, cs.getPropertyValue(p)]; }).filter(function (x) { return x[1] && x[1] !== 'normal' && x[1] !== 'none' || /display|position|box-sizing|width|height|color/.test(x[0]); }) };
  }
  function mark(el, sticky) {
    if (!overlay) { overlay = document.createElement('div'); overlay.id = '__pp_ov'; overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;background:rgba(76,201,232,.25);outline:1px solid #4cc9e8;transition:all .08s'; }
    if (!el || !el.getBoundingClientRect) { overlay.remove(); return; }
    var r = el.getBoundingClientRect(); overlay.style.left = r.left + 'px'; overlay.style.top = r.top + 'px'; overlay.style.width = r.width + 'px'; overlay.style.height = r.height + 'px';
    if (!overlay.isConnected) document.documentElement.appendChild(overlay);
    if (!sticky) origST(function () { if (overlay && hoverEl === el) { overlay.remove(); hoverEl = null; } }, 1500);
  }
  var hoverEl = null, mutT = null;
  new MutationObserver(function (list) {
    if (list.every(function (m) { return m.target === overlay || (m.addedNodes.length === 1 && m.addedNodes[0] === overlay) || (m.removedNodes.length === 1 && m.removedNodes[0] === overlay); })) return;
    if (mutT) return; mutT = origST(function () { mutT = null; post({ t: 'mut' }); }, 120);
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });

  /* ---- console helpers like a browser's DevTools ---- */
  W.$ = W.$ || function (s, root) { return (root || document).querySelector(s); };
  W.$$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  W.$x = function (xp, ctx) { var r = document.evaluate(xp, ctx || document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null), a = []; for (var i = 0; i < r.snapshotLength; i++) a.push(r.snapshotItem(i)); return a; };
  W.copy = function (v) { post({ t: 'copy', text: typeof v === 'string' ? v : (function () { try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); } })() }); };
  W.clear = function () { C.clear(); };
  W.keys = Object.keys; W.values = Object.values;
  W.dir = function (v) { C.dir(v); };
  W.inspect = function (el) { if (el && el.nodeType === 1) { selected = el; W.$0 = el; mark(el, true); post({ t: 'select', i: idOf(el) }); } return el; };
  W.monitorEvents = function (el, types) { types = types ? [].concat(types) : ['click', 'input', 'keydown', 'focus', 'blur', 'submit', 'change']; types.forEach(function (t) { el.addEventListener(t, function (e) { emit('log', t + ' ' + PPI.inspect({ type: e.type, target: e.target.tagName ? e.target.tagName.toLowerCase() + (e.target.id ? '#' + e.target.id : '') : String(e.target) })); }); }); };
  W.getEventListeners = undefined;

  /* ---- messages from the book ---- */
  function wrapForEval(code) {
    var c = code.trim();
    c = c.replace(/^(\s*)(let|const)\s+/gm, '$1var ').replace(/^(\s*)class\s+([A-Za-z_$][\w$]*)/gm, '$1var $2 = class $2');
    if (/\bawait\b/.test(c)) {
      var single = !/[;\n]/.test(c.replace(/;\s*$/, ''));
      return single ? '(async () => (' + c.replace(/;\s*$/, '') + '))()' : '(async () => {' + c + '\n})()';
    }
    return c;
  }
  W.addEventListener('message', function (ev) {
    var m = ev.data; if (!m || m.__pp !== TOK) return;
    if (m.t === 'eval') {
      var res, isErr = false, isAsync = m.awaitResult || /\bawait\b/.test(m.code);
      try {
        // (0, eval) runs in global scope, like a DevTools console
        res = (0, eval)(m.guarded || (m.awaitResult ? m.code : wrapForEval(m.code)));
      } catch (e) { isErr = true; res = e; }
      var send = function (v, err) { post({ t: 'evalres', id: m.id, text: err ? 'Uncaught ' + errText(v) : PPI.inspect(v), err: err }); };
      if (!isErr && isAsync && res && typeof res.then === 'function') res.then(function (v) { send(v, false); }, function (e) { send(e, true); });
      else send(res, isErr);
    } else if (m.t === 'snap') post({ t: 'snap', tree: snap(document.documentElement, 0), sel: selected ? idOf(selected) : 0 });
    else if (m.t === 'hover') { hoverEl = byId[m.i] || null; mark(hoverEl, false); }
    else if (m.t === 'unhover') { hoverEl = null; if (overlay && !selected) overlay.remove(); else if (selected) mark(selected, true); }
    else if (m.t === 'sel') { var el = byId[m.i]; if (el) { selected = el; W.$0 = el; mark(el, true); post({ t: 'box', i: m.i, box: boxOf(el) }); } }
    else if (m.t === 'storage?') { var dump = function (s) { try { return s.__dump ? s.__dump() : Object.assign({}, s); } catch (e) { return {}; } }; post({ t: 'storage', ls: dump(W.localStorage), ss: dump(W.sessionStorage), ck: W.__ppJar ? W.__ppJar() : (function () { try { return Object.fromEntries(document.cookie.split('; ').filter(Boolean).map(function (x) { return x.split('='); })); } catch (e) { return {}; } })() }); }
  });
  /* height for the preview frame */
  var lastH = 0;
  function size() { var h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0); if (Math.abs(h - lastH) > 2) { lastH = h; post({ t: 'size', h: h }); } }
  W.addEventListener('load', function () { size(); post({ t: 'ready' }); });
  if (typeof ResizeObserver !== 'undefined') origST(function () { try { new ResizeObserver(size).observe(document.documentElement); } catch (e) { } }, 0);
})();
