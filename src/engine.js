/* Page engine: renders parsed chapters (window.__BOOK) into the book UI. */
(function () {
  'use strict';
  var B = window.__BOOK, VARS = B.vars.vars, GROUPS = B.vars.groups, CH = B.chapters;
  var PARTS = [['start', 'Start here'], ['found', 'Foundations'], ['zsh', 'The shell (zsh)'], ['net', 'Networking'], ['py', 'Python'], ['web', 'Web development'], ['srv', 'Servers, APIs & Cloud'], ['sec', 'Security'], ['proj', 'Projects'], ['ref', 'Reference']];
  var KEY = 'ppp-v1';
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function h(tag, attrs, kids) { var e = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { if (k === 'class') e.className = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }); (kids || []).forEach(function (c) { e.appendChild(c); }); return e; }

  /* ---------- state + persistence (adapter so a capability store can replace localStorage) ---------- */
  var S = { vals: {}, done: {}, theme: '', last: '' };
  var Store = window.__store || {
    load: function () { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    save: function (s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } }
  };
  var saveT = 0; function save() { clearTimeout(saveT); saveT = setTimeout(function () { Store.save(S); }, 300); }
  function loaded(x) { if (x && typeof x === 'object') { S.vals = x.vals || {}; S.done = x.done || {}; S.theme = x.theme || ''; S.last = x.last || ''; } }
  window.__applyState = function (x) { loaded(x); applyTheme(); refreshChips(); updateProgress(); };
  loaded(Store.load && Store.load());
  var chapterVars = {};
  CH.forEach(function (c) { c.blocks.forEach(function (b) { if (b.t === 'var') chapterVars[b.key] = b; }); });
  function varDef(k) { return VARS[k] || (chapterVars[k] ? { label: k, default: chapterVars[k].default || '', desc: chapterVars[k].desc || '', find: chapterVars[k].find } : { label: k, default: k, desc: 'Replace this with your own value.' }); }
  function val(k) { return S.vals[k] !== undefined && S.vals[k] !== '' ? S.vals[k] : varDef(k).default; }
  function setVal(k, v) { if (v === '' || v === varDef(k).default) delete S.vals[k]; else S.vals[k] = v; save(); refreshChips(); }
  function subst(t) { return String(t).replace(/\{\{(\w+)\}\}/g, function (m, k) { return val(k); }); }
  function chip(k) { var mine = S.vals[k] !== undefined; return '<span class="ph' + (mine ? ' mine' : '') + '" tabindex="0" role="button" data-k="' + k + '" title="' + esc(varDef(k).label) + ': click to set your own value">' + esc(val(k)) + '</span>'; }
  function refreshChips() { $$('.ph').forEach(function (e) { var k = e.getAttribute('data-k'); e.textContent = val(k); e.classList.toggle('mine', S.vals[k] !== undefined); }); }
  function phHTML(raw) { return esc(raw).replace(/\{\{(\w+)\}\}/g, function (m, k) { return chip(k); }); }

  /* ---------- inline markup ---------- */
  function inl(t) {
    t = String(t == null ? '' : t); var out = '', re = /``[ ]?((?:[^`]|`(?!`))+?)[ ]?``|`([^`]+)`|\{\{(\w+)\}\}|\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g, last = 0, m;
    while ((m = re.exec(t))) {
      out += esc(t.slice(last, m.index)); last = re.lastIndex;
      if (m[1] !== undefined) out += '<code>' + esc(m[1]) + '</code>';
      else if (m[2] !== undefined) out += '<code>' + phHTML(m[2]) + '</code>';
      else if (m[3]) out += chip(m[3]);
      else if (m[4]) out += '<kbd>' + esc(m[4]) + '</kbd>';
      else if (m[5]) out += '<a href="' + esc(m[6]) + '"' + (/^https?:/.test(m[6]) ? ' target="_blank" rel="noopener"' : '') + '>' + inl(m[5]) + '</a>';
      else if (m[7]) out += '<strong>' + inl(m[7]) + '</strong>';
      else out += '<em>' + inl(m[8]) + '</em>';
    }
    return out + esc(t.slice(last));
  }

  /* ---------- syntax highlighting ---------- */
  var SHKW = /^(if|then|else|elif|fi|for|while|until|do|done|case|esac|function|in|select|time|\[\[|\]\]|!)$/;
  var CMDPASS = /^(sudo|xargs|time|env|nohup|then|do|else|command|exec|watch|nice)$/;
  function sp(c, s) { return '<span class="t-' + c + '">' + s + '</span>'; }
  function hlShLine(l) {
    var o = '', i = 0, n = l.length, cmdPos = true, m;
    while (i < n) {
      var c = l[i], rest = l.slice(i);
      if (c === '#' && (i === 0 || /\s/.test(l[i - 1]))) { o += sp('com', esc(rest)); break; }
      if (c === ' ' || c === '\t') { o += c; i++; continue; }
      if (c === "'") { var j = l.indexOf("'", i + 1); if (j < 0) j = n - 1; o += sp('str', esc(l.slice(i, j + 1))); i = j + 1; cmdPos = false; continue; }
      if (c === '"') { var j2 = i + 1; while (j2 < n && l[j2] !== '"') { if (l[j2] === '\\') j2++; j2++; } o += sp('str', esc(l.slice(i, j2 + 1)).replace(/(\$\{[^}]*\}|\$\([^)]*\)|\$[A-Za-z_][A-Za-z0-9_]*|\$[?#@*0-9])/g, '</span><span class="t-var">$1</span><span class="t-str">')); i = j2 + 1; cmdPos = false; continue; }
      if (c === '$' && l[i + 1] === '(') { o += sp('var', l[i + 2] === '(' ? '$((' : '$('); i += l[i + 2] === '(' ? 3 : 2; cmdPos = l[i - 1] !== '('; continue; }
      if (c === '<' && l[i + 1] === '(') { o += sp('op', esc('<(')); i += 2; cmdPos = true; continue; }
      if ((m = /^(\|\||&&|\|&|\||;;|;|2>&1|&>>|&>|2>>|2>|>>|>&|>|<<<|<<|<|&|\(|\)|\{|\})/.exec(rest)) && !(m[0] === '{' && /^\{[^ ]/.test(rest)) && !(m[0] === '}' && false)) {
        o += sp('op', esc(m[0])); i += m[0].length; if (/^(\|\||&&|\||;|\(|\|&|&|;;)$/.test(m[0])) cmdPos = true; continue;
      }
      var wm = /^(?:\$\{[^}]*\}|\$[A-Za-z_?#@*0-9][A-Za-z0-9_]*|\w+|[^\s|&;<>()'"$])+/.exec(rest) || /^\$/.exec(rest);
      var w = wm[0]; i += w.length;
      var plain = w.replace(/\w+/g, 'x');
      if (/^\$/.test(w) && !cmdPos) o += sp('var', esc(w));
      else if (SHKW.test(w)) { o += sp('kw', esc(w)); cmdPos = /^(then|do|else|elif|if|while|until|!)$/.test(w); }
      else if (cmdPos && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) { var eq = w.indexOf('='); o += sp('var', esc(w.slice(0, eq + 1))) + esc(w.slice(eq + 1)); }
      else if (cmdPos) { o += sp('cmd', esc(w)); cmdPos = CMDPASS.test(w); }
      else if (/^--?[A-Za-z0-9]/.test(plain)) o += sp('flag', esc(w));
      else if (/^[0-9]+$/.test(plain)) o += sp('num', esc(w));
      else o += esc(w);
    }
    return o;
  }
  function finishPh(s) { return s.replace(/(\w+)/g, function (m, k) { return chip(k); }); }
  function hlSh(src) { return finishPh(src.replace(/\{\{(\w+)\}\}/g, '$1').split('\n').map(hlShLine).join('\n')); }
  var PYKW = /^(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|match|case)$/;
  var PYFN = /^(print|len|range|int|str|float|list|dict|set|tuple|sum|min|max|sorted|enumerate|zip|map|filter|open|input|isinstance|abs|round|any|all|reversed|type|bool|repr|format|next|iter|super|self|cls|bytes|hex|bin|ord|chr|divmod|getattr|setattr|hasattr|vars|dir|id|help|exit)$/;
  function hlPy(src) {
    src = src.replace(/\{\{(\w+)\}\}/g, '$1');
    var re = /(#.*$)|("""[\s\S]*?"""|'''[\s\S]*?''')|((?:[rbfRBF]{1,2})?"(?:\\.|[^"\\\n])*"|(?:[rbfRBF]{1,2})?'(?:\\.|[^'\\\n])*')|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)|(@[A-Za-z_][\w.]*)|(\b[A-Za-z_]\w*\b)/gm, o = '', last = 0, m, prev = '';
    while ((m = re.exec(src))) {
      o += esc(src.slice(last, m.index)); last = re.lastIndex;
      if (m[1]) o += sp('com', esc(m[1])); else if (m[2] || m[3]) o += sp('str', esc(m[2] || m[3]));
      else if (m[4]) o += sp('num', m[4]); else if (m[5]) o += sp('kw', esc(m[5]));
      else { var w = m[6]; if (prev === 'def' || prev === 'class') o += sp('fn', w); else if (PYKW.test(w)) o += sp('kw', w); else if (/^(True|False|None)$/.test(w)) o += sp('num', w); else if (PYFN.test(w)) o += sp('fn', w); else o += w; prev = w; continue; }
      prev = '';
    }
    return finishPh(o + esc(src.slice(last)));
  }
  var JSKW = /^(await|async|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|of|return|static|super|switch|this|throw|try|typeof|var|void|while|with|yield|get|set)$/;
  var JSLIT = /^(true|false|null|undefined|NaN|Infinity)$/;
  var JSFN = /^(console|document|window|JSON|Math|Object|Array|String|Number|Promise|Map|Set|fetch|require|module|exports|process|setTimeout|setInterval|clearTimeout|clearInterval|parseInt|parseFloat|Date|Error|TypeError|RegExp|Symbol|BigInt|globalThis|localStorage|sessionStorage|navigator|location|history|crypto|structuredClone|queueMicrotask|URL|URLSearchParams|Response|Request|Headers|AbortController|DOMParser|XMLSerializer|Buffer|__dirname|__filename)$/;
  function hlJs(src) {
    src = String(src).replace(/\{\{(\w+)\}\}/g, '$1');
    var re = /(\/\/.*$|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|\$\{[^}]*\}|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b(?:0[xob][\da-f_]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)n?\b)|(\b[A-Za-z_$][\w$]*\b)(\s*\()?|(=>|===|!==|\?\?=?|\?\.|\.\.\.|&&=|\|\|=)/gmi, o = '', last = 0, m, prev = '';
    while ((m = re.exec(src))) {
      o += esc(src.slice(last, m.index)); last = re.lastIndex;
      if (m[1]) o += sp('com', esc(m[1]));
      else if (m[2]) o += sp('str', esc(m[2]).replace(/\$\{([^}]*)\}/g, '</span><span class="t-var">${$1}</span><span class="t-str">'));
      else if (m[3]) o += sp('num', m[3]);
      else if (m[4]) { var w = m[4], call = m[5] || ''; if (JSKW.test(w)) o += sp('kw', w); else if (JSLIT.test(w)) o += sp('num', w); else if (prev === 'function' || prev === 'class' || call) o += sp('fn', w); else if (JSFN.test(w)) o += sp('var', w); else o += w; o += esc(call); prev = w; continue; }
      else if (m[6]) o += sp('op', esc(m[6]));
      prev = '';
    }
    return finishPh(o + esc(src.slice(last)));
  }
  function hlMarkup(src) {
    src = String(src).replace(/\{\{(\w+)\}\}/g, '$1');
    var re = /(<!--[\s\S]*?-->)|(<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<!\[CDATA\[[\s\S]*?\]\]>)|(<\/?)([A-Za-z][\w:.-]*)([^>]*?)(\/?>)|(&[#\w]+;)/gi, o = '', last = 0, m;
    while ((m = re.exec(src))) {
      o += esc(src.slice(last, m.index)); last = re.lastIndex;
      if (m[1]) o += sp('com', esc(m[1]));
      else if (m[2]) o += sp('kw', esc(m[2]));
      else if (m[4]) o += sp('op', esc(m[3])) + sp('cmd', esc(m[4])) + esc(m[5]).replace(/([\w:.-]+)(=)(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;|[^\s&]+)?/g, function (x, n, eq, v) { return sp('flag', n) + eq + (v ? sp('str', v) : ''); }) + sp('op', esc(m[6]));
      else if (m[7]) o += sp('num', esc(m[7]));
    }
    return finishPh(o + esc(src.slice(last)));
  }
  function hlCss(src) {
    src = String(src).replace(/\{\{(\w+)\}\}/g, '$1');
    var o = '', re = /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|([^{};\/"']+)(\{)|([\w-]+)(\s*:\s*)([^;{}]*)(;?)|(@[\w-]+)|([{}])/g, last = 0, m;
    while ((m = re.exec(src))) {
      o += esc(src.slice(last, m.index)); last = re.lastIndex;
      if (m[1]) o += sp('com', esc(m[1]));
      else if (m[2]) o += sp('str', esc(m[2]));
      else if (m[4]) o += (/^\s*@/.test(m[3]) ? sp('kw', esc(m[3])) : sp('cmd', esc(m[3]))) + sp('op', '{');
      else if (m[5]) o += sp('flag', esc(m[5])) + esc(m[6]) + esc(m[7]).replace(/(-?\d*\.?\d+)(px|rem|em|%|vh|vw|fr|s|ms|deg|ch)?/g, function (x) { return sp('num', x); }).replace(/(#[0-9a-fA-F]{3,8}\b)/g, function (x) { return sp('str', x); }) + esc(m[8]);
      else if (m[9]) o += sp('kw', esc(m[9]));
      else if (m[10]) o += sp('op', m[10]);
    }
    return finishPh(o + esc(src.slice(last)));
  }
  function hlAscii(src) {
    return esc(src).replace(/⟪([rgybcmwd]):([^⟫]*)⟫/g, function (m, c, t) { return '<span class="a-' + c + '">' + t + '</span>'; }).replace(/([─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬▶◀▲▼→←↑↓]+)/g, function (m) { return m.indexOf('<') >= 0 ? m : '<span class="a-d">' + m + '</span>'; });
  }
  function hlGeneric(lang, code) {
    if (lang === 'sh' || lang === 'zsh' || lang === 'bash' || lang === 'shell') return hlSh(code);
    if (lang === 'python' || lang === 'py' || lang === 'run') return hlPy(code);
    if (lang === 'ascii') return hlAscii(code);
    if (/^(js|javascript|node|mjs|cjs|jsrun|json|ts)$/.test(lang)) return hlJs(code);
    if (/^(html|xml|svg|xhtml|plist|rss)$/.test(lang)) return hlMarkup(code);
    if (lang === 'css') return hlCss(code);
    if (lang === 'yaml' || lang === 'c' || lang === 'sql' || lang === 'html' || lang === 'diff' || lang === 'text' || lang === 'out' || lang === 'file') {
      if (lang === 'diff') return esc(code).split('\n').map(function (l) { return /^\+/.test(l) ? sp('flag', l) : /^-/.test(l) ? '<span class="a-r">' + l + '</span>' : l; }).join('\n');
      return phHTML(code);
    }
    return phHTML(code);
  }

  /* ---------- copy ---------- */
  function copyText(t, btn) {
    function done() { if (btn) { var o = btn.textContent; btn.textContent = 'Copied'; btn.classList.add('ok'); setTimeout(function () { btn.textContent = o; btn.classList.remove('ok'); }, 1200); } else toast('Copied'); }
    function fallback() { var ta = h('textarea', { style: 'position:fixed;opacity:0;top:0' }); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Select the text and press Cmd+C'); } ta.remove(); }
    try { navigator.clipboard.writeText(t).then(done, fallback); } catch (e) { fallback(); }
  }
  function toast(m) { var t = h('div', { class: 'toast', text: m }); document.body.appendChild(t); setTimeout(function () { t.remove(); }, 1600); }

  /* ---------- code blocks ---------- */
  var uid = 0;
  function copyBtn(raw) { return '<button class="cp" data-copy="' + esc(raw) + '" aria-label="Copy to clipboard">Copy</button>'; }
  function parseTerm(code) {
    var items = [], cur = null;
    code.split('\n').forEach(function (l) {
      if (cur && cur.cont) { cur.cmd += '\n' + l.replace(/^\s+/, ''); cur.cont = /\\$/.test(l); return; }
      if (/^\$ /.test(l) || l === '$') { cur = { cmd: l.slice(2), out: [] }; cur.cont = /\\$/.test(l); items.push(cur); }
      else if (cur) cur.out.push(l); else { cur = { cmd: null, out: [l] }; items.push(cur); }
    });
    return items;
  }
  function termBlock(b) {
    var items = parseTerm(b.code), o = '';
    items.forEach(function (it) {
      if (it.cmd !== null) {
        var raw = it.cmd.replace(/\\\n/g, '\\\n');
        o += '<div class="ln c"><span class="pr">$</span><span class="tx">' + hlSh(it.cmd) + '</span><button class="cp" data-copy="' + esc(it.cmd) + '" aria-label="Copy command">Copy</button></div>';
      }
      if (it.out.length) { var t = it.out.join('\n').replace(/\n+$/, ''); if (t !== '') o += '<div class="o">' + esc(t) + '</div>'; }
    });
    var label = b.attrs && b.attrs.sample ? '<span class="sample">sample output, yours will differ</span>' : '';
    var cmds = items.filter(function (i) { return i.cmd !== null; }).map(function (i) { return i.cmd; }).join('\n');
    return '<div class="cb term"><div class="bar"><span>Terminal</span>' + label + '<span class="sp"></span>' + copyBtn(cmds) + '</div><pre>' + o + '</pre></div>';
  }
  function codeBlock(b) {
    var lang = b.lang, a = b.attrs || {};
    if (lang === 'term') return termBlock(b);
    if (lang === 'run') return runBox(b);
    if (lang === 'jsrun') return window.__core.jsBox(b);
    if (lang === 'webplay' || lang === 'devtools') return '<div class="wmount" data-w="weblab" data-args="' + esc(JSON.stringify({ kind: lang, code: b.code, attrs: a })) + '"></div>';
    var label = lang === 'sh' ? 'zsh' : lang === 'file' ? (a.name || 'file') : lang === 'python' ? 'Python' : lang === 'out' ? 'Output' : ({ js: 'JavaScript', javascript: 'JavaScript', node: 'Node.js', mjs: 'JavaScript module', html: 'HTML', css: 'CSS', xml: 'XML', json: 'JSON', svg: 'SVG' })[lang] || lang;
    if (a.name && lang !== 'file') label = a.name;
    var tools = '';
    if (lang === 'python') tools = '<button class="cp" data-playground="' + esc(b.code) + '">Open in playground</button>';
    if (lang === 'out' || lang === 'ascii') return '<div class="cb ' + (lang === 'ascii' ? 'ascii' : '') + '"><pre>' + hlGeneric(lang, b.code) + '</pre></div>';
    var raw = b.code;
    var outBlk = b.out !== undefined && b.out !== '' && lang !== 'run' ? '<div class="o" style="padding:0 14px 10px">' + esc(b.out) + '</div>' : '';
    return '<div class="cb' + (lang === 'file' ? ' file' : '') + '"><div class="bar"><span>' + esc(label) + '</span><span class="sp"></span>' + tools + copyBtn(raw) + '</div><pre>' + hlGeneric(lang, b.code) + '</pre>' + outBlk + '</div>';
  }
  function runBox(b) {
    var id = 'run' + (++uid), stdinTxt = b.stdin || '', exp = b.out === undefined ? '' : b.out;
    return '<div class="runbox" data-run="' + id + '"><div class="bar"><span>Python (runs in your browser)</span><span class="sp"></span><button class="btn" data-act="run">Run</button><button class="btn sec" data-act="reset">Reset</button></div>' +
      '<textarea class="ed" spellcheck="false" data-orig="' + esc(b.code) + '">' + esc(b.code) + '</textarea>' +
      (stdinTxt !== '' ? '<details open><summary>Input given to the program (stdin)</summary><textarea class="ed" style="min-height:50px" spellcheck="false" data-stdin>' + esc(stdinTxt) + '</textarea></details>' : '') +
      '<div class="res"></div>' + (exp !== '' ? '<details><summary>Expected output</summary><pre style="margin:6px 0;font:13px var(--font-mono);white-space:pre-wrap">' + esc(exp) + '</pre></details>' : '') + '</div>';
  }

  /* ---------- blocks ---------- */
  function listHTML(b) {
    var tag = b.t;
    function items(its) { return its.map(function (it) { return '<li>' + inl(it.text) + (it.children && it.children.length ? '<' + tag + '>' + items(it.children) + '</' + tag + '>' : '') + '</li>'; }).join(''); }
    return '<' + tag + '>' + items(b.items) + '</' + tag + '>';
  }
  var KIND = { note: 'Note', tip: 'Tip', warn: 'Careful', danger: 'Danger', mac: 'On macOS', why: 'Why it works this way', deep: 'Going deeper', try: 'Try it now', gotcha: 'Classic mistake' };
  function calloutHTML(b) {
    var k = (b.kind || 'note').toLowerCase(), t = b.title || KIND[k] || k, body = renderBlocks(b.blocks, {});
    if (k === 'deep') return '<details class="co co-deep"><summary>' + esc(KIND.deep) + (b.title ? ': ' + inl(b.title) : '') + '</summary>' + body + '</details>';
    return '<div class="co co-' + k + '"><div class="ch">' + (b.title && KIND[k] ? esc(KIND[k]) + ': ' + inl(b.title) : inl(t)) + '</div>' + body + '</div>';
  }
  function tableHTML(b) {
    return '<div class="tw"><table><thead><tr>' + b.head.map(function (c) { return '<th>' + inl(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + b.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inl(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  var ANC = ['#4cc9e8', '#f2c14e', '#7bdc8c', '#f08fb0', '#b79af7', '#ff9f6b', '#6bb8ff', '#c4d96b'];
  function anatomyHTML(b) {
    var id = 'an' + (++uid);
    var line = b.tokens.map(function (t, i) { return '<span class="tk" data-i="' + i + '" style="--tc:' + ANC[i % ANC.length] + '">' + phHTML(t.tok) + '</span>'; }).join(' ');
    var lis = b.tokens.map(function (t, i) { return '<li data-i="' + i + '" style="--tc:' + ANC[i % ANC.length] + '"><code>' + phHTML(t.tok) + '</code><span>' + inl(t.exp) + '</span></li>'; }).join('');
    return '<div class="an" id="' + id + '"><h5>Anatomy' + (b.title ? ': ' + inl(b.title) : '') + '</h5><div class="line">' + line + '</div><ul>' + lis + '</ul></div>';
  }
  function badge(t, cls) { return '<span class="badge ' + (cls || '') + '">' + esc(t) + '</span>'; }
  var CATN = { shell: 'shell', nav: 'navigation', files: 'files', view: 'viewing', perm: 'permissions', ops: 'operators', text: 'text', proc: 'processes', sys: 'system', mac: 'macOS', edit: 'editing', git: 'git', pkg: 'packages', 'net-info': 'net info', 'net-test': 'net test', 'net-dns': 'DNS', 'net-http': 'HTTP', 'net-port': 'ports', 'net-capture': 'capture', 'net-remote': 'remote', 'py-builtin': 'builtin', 'py-str': 'str', 'py-list': 'list', 'py-dict': 'dict', 'py-set': 'set', 'py-mod': 'module', 'py-lang': 'language', 'py-tool': 'tooling', 'web-html': 'HTML', 'web-css': 'CSS', 'web-js': 'JavaScript', 'web-dom': 'DOM', 'web-api': 'Web API', 'web-node': 'Node.js', 'web-npm': 'npm', 'web-xml': 'XML', 'web-tool': 'DevTools', 'web-http': 'HTTP', 'srv-svc': 'services', 'srv-admin': 'server admin', 'srv-web': 'web server', 'srv-api': 'API', 'srv-crypto': 'crypto & TLS', 'srv-cloud': 'cloud', 'srv-ctr': 'containers', 'sec-pcap': 'packet analysis', 'sec-mac': 'macOS security', 'sec-linux': 'Linux security', 'sec-audit': 'auditing' };
  function cmdId(c) { return c.id ? 'cmd-' + c.id : 'cmd-' + slug(c.name); }
  function osLabel(os) { return os === 'mac' ? 'ships with macOS' : os === 'all' ? 'macOS + Linux' : os === 'py' ? 'Python' : os === 'browser' ? 'in the browser' : os === 'node' ? 'Node.js' : os === 'web' ? 'browser + Node.js' : os === 'linux' ? 'Linux servers' : os === 'docker' ? 'Docker or OrbStack' : os === 'wireshark' ? 'Wireshark (brew cask wireshark-app)' : /^brew:/.test(os) ? 'brew install ' + os.slice(5) : os; }
  var cmdIndex = {};
  function cardHTML(c) {
    var dom = /^net/.test(c.cat) ? 'net' : /^py/.test(c.cat) ? 'py' : /^web/.test(c.cat) ? 'web' : /^srv/.test(c.cat) ? 'srv' : /^sec/.test(c.cat) ? 'sec' : 'zsh';
    var isSh = function (t) { return /^(\$ |npm |npx |node |nvm |brew |curl |cd |mkdir |ls |cat |echo |open |xmllint |plutil |lsof |kill |export |which |git |python3 |cut |awk |printf |seq |grep |sort |head |tail |jq |xargs |sed |wc )/m.test(t) && !/^(const|let|var|function|import|export default|document|console)\b/m.test(t); };
    var isMk = function (t) { return /^\s*</.test(t); }, isCss = function (t) { return /^[^{}\n]*\{[^}]*:[^}]*\}/.test(t.trim()) && !/^(const|let|var|function|if|for)\b/.test(t.trim()); };
    var hlEx = function (t) { return dom === 'py' ? hlPy(t) : dom === 'web' ? (isSh(t) ? hlSh(t) : isMk(t) ? hlMarkup(t) : isCss(t) ? hlCss(t) : hlJs(t)) : hlSh(t); };
    var exLabel = function (t) { return dom === 'py' ? 'Python' : dom === 'web' ? (isSh(t) ? 'zsh' : isMk(t) ? 'HTML' : isCss(t) ? 'CSS' : 'JavaScript') : 'zsh'; };
    var o = '<section class="card cat-' + dom + '" id="' + cmdId(c) + '"><div class="hd"><h3 class="nm">' + esc(c.name) + '</h3>' + badge(CATN[c.cat] || c.cat, 'dom') + badge(osLabel(c.os)) + (c.tags || []).map(function (t) { return badge(t, t === 'sudo' ? 'sudo' : ''); }).join('') + '</div>';
    o += '<p class="sum">' + inl(c.sum) + '</p>';
    if (c.syntax) o += '<h6>Syntax</h6><div class="syn"><span>' + hlEx(c.syntax) + '</span>' + copyBtn(c.syntax) + '</div>';
    if (c.how && c.how.length) o += '<h6>How it works</h6>' + renderBlocks(c.how, {});
    if (c.flags && c.flags.length) o += '<h6>Options you will use</h6><div class="tw"><table><tbody>' + c.flags.map(function (f) { return '<tr><td><code>' + phHTML(f.f || '') + '</code></td><td>' + inl(f.d || '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    (c.examples || []).forEach(function (e) {
      var isPipe = e.kind === 'pipe', isRun = e.kind === 'run';
      o += '<div class="exh">' + badge(isPipe ? 'Pipe it' : isRun ? 'Run it' : 'Example', isPipe ? 'dom' : '') + '<span>' + inl(e.desc) + '</span></div>';
      if (isRun) o += dom === 'web' ? window.__core.jsBox({ code: e.code, out: e.out, attrs: {} }) : runBox({ code: e.code, out: e.out });
      else {
        o += '<div class="cb compact"><div class="bar"><span>' + exLabel(e.code) + '</span><span class="sp"></span>' + copyBtn(e.code) + '</div><pre>' + hlEx(e.code) + '</pre>' + (e.out ? '<div class="o" style="padding:0 14px 10px;white-space:pre-wrap">' + esc(e.out) + '</div>' : '') + '</div>';
        if (e.anat) o += anatomyHTML({ tokens: e.anat, title: '' });
      }
    });
    (c.gotchas || []).forEach(function (g) { o += '<div class="gt"><strong>Watch out: </strong>' + inl(g) + '</div>'; });
    (c.notes || []).forEach(function (g) { o += '<div class="nt">' + inl(g) + '</div>'; });
    if (c.see && c.see.length) o += '<div class="see">See also: ' + c.see.map(function (s) { var t = cmdIndex[s]; return t ? '<a href="#' + t.ch + '/' + t.id + '">' + esc(s) + '</a>' : esc(s); }).join(' ') + '</div>';
    return o + '</section>';
  }
  function exerciseHTML(b) {
    var id = b.id, done = S.done[id] ? ' checked' : '', type = b.type || 'terminal';
    var o = '<div class="ex ' + (type === 'py' ? 'py' : type === 'js' ? 'js' : type === 'think' ? 'think' : '') + '" id="' + esc(id) + '" data-ex="' + esc(id) + '"><div class="eh"><span class="tag">' + (type === 'py' ? 'Python exercise' : type === 'js' ? 'JavaScript exercise' : type === 'think' ? 'Think it through' : 'Terminal exercise') + '</span><h4>' + inl(b.title) + '</h4><label><input type="checkbox" data-done="' + esc(id) + '"' + done + '> done</label></div>' + renderBlocks(b.task, {});
    if (type === 'py') {
      o += '<div data-pyex="' + esc(id) + '"><textarea class="ed" spellcheck="false" data-orig="' + esc(b.starter || '') + '">' + esc(b.starter || '') + '</textarea>' +
        (b.stdin ? '<details><summary>Input given to the program (stdin)</summary><textarea class="ed" style="min-height:50px" data-stdin>' + esc(b.stdin) + '</textarea></details>' : '') +
        '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" data-act="pyrun">Run</button><button class="btn" data-act="pycheck">Check my answer</button><button class="btn sec" data-act="pyreset">Reset</button></div><div class="res"></div></div>';
    }
    if (type === 'js') {
      o += '<div data-jsex="' + esc(id) + '"' + (b.page ? ' data-page="' + esc(b.page) + '"' : '') + '><textarea class="ed js" spellcheck="false" data-orig="' + esc(b.starter || '') + '">' + esc(b.starter || '') + '</textarea>' + (b.page ? '<div class="jspage"></div>' : '') +
        '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" data-jsact="run">Run</button><button class="btn" data-jsact="check">Check my answer</button><button class="btn sec" data-jsact="reset">Reset</button></div><div class="res jsres"></div></div>';
    }
    (b.hints || []).forEach(function (hh, i) { o += '<details class="rv"><summary>Hint ' + (i + 1) + '</summary>' + renderBlocks([{ t: 'p', text: hh }], {}) + '</details>'; });
    if (b.verify) o += '<details class="rv"><summary>Check your work in the terminal</summary><div class="cb"><div class="bar"><span>zsh</span><span class="sp"></span>' + copyBtn(b.verify) + '</div><pre>' + hlSh(b.verify) + '</pre></div></details>';
    o += '<details class="rv"><summary>Show a solution</summary><div class="cb"><div class="bar"><span>' + (type === 'py' ? 'Python' : type === 'js' ? 'JavaScript' : type === 'think' ? 'Answer' : 'zsh') + '</span><span class="sp"></span>' + copyBtn(b.solution) + '</div><pre>' + (type === 'py' ? hlPy(b.solution) : type === 'js' ? hlJs(b.solution) : type === 'think' ? esc(b.solution) : hlSh(b.solution)) + '</pre></div>' + (b.why && b.why.length ? '<div style="margin-top:6px"><strong>Why it works.</strong></div>' + renderBlocks(b.why, {}) : '') + '</details>';
    return o + '</div>';
  }
  function checkpointHTML(b) {
    var id = b.id, best = S.done[id];
    var o = '<div class="cq" id="' + esc(id) + '" data-cq="' + esc(id) + '"><div class="eh"><span class="tag">Checkpoint</span><h4>' + inl(b.title) + '</h4><span class="badge" data-score>' + (best !== undefined ? 'best: ' + best + '/' + b.questions.length : 'not taken') + '</span></div>';
    b.questions.forEach(function (q, qi) {
      o += '<div class="q" data-q="' + qi + '"><div><strong>' + (qi + 1) + '.</strong> ' + inl(q.q) + '</div>';
      if (q.options && q.options.length) q.options.forEach(function (op, oi) { o += '<button class="opt" data-opt="' + oi + '" data-ok="' + (op.ok ? 1 : 0) + '">' + inl(op.text) + '</button>'; });
      else o += '<div style="margin:6px 0"><input type="text" data-ans="' + esc(JSON.stringify(q.answers)) + '" placeholder="your answer" autocomplete="off" autocapitalize="off" spellcheck="false"> <button class="btn sec" data-act="ansc">Check</button></div>';
      o += '<div class="why" hidden>' + inl(q.why) + '</div></div>';
    });
    return o + '<div class="res" data-final></div></div>';
  }
  function projectHTML(b) {
    var steps = [], intro = [], cur = null;
    b.blocks.forEach(function (x) { if (x.t === 'h' && x.level === 3) { cur = { title: x.text, blocks: [], id: x.id }; steps.push(cur); } else if (cur) cur.blocks.push(x); else intro.push(x); });
    var o = '<div class="pj" id="' + esc(b.id) + '"><div class="eh"><span class="tag">Build a tool</span><h4>' + inl(b.title) + '</h4>' + badge(b.level) + (b.time ? badge(b.time + ' min') : '') + '</div>' + (b.skills && b.skills.length ? '<p style="margin:.4em 0;color:var(--mute);font:13px var(--font-ui)">Skills: ' + b.skills.map(esc).join(', ') + '</p>' : '') + renderBlocks(intro, {});
    steps.forEach(function (s, i) {
      var sid = b.id + '#' + i, dn = S.done[sid];
      o += '<details class="step' + (dn ? ' done' : '') + '"' + (i === 0 ? ' open' : '') + '><summary><input type="checkbox" data-done="' + esc(sid) + '"' + (dn ? ' checked' : '') + '> ' + inl(s.title) + '</summary><div>' + renderBlocks(s.blocks, {}) + '</div></details>';
    });
    return o + '</div>';
  }
  function widgetHTML(b) { return '<div class="wmount" data-w="' + esc(b.name) + '" data-args="' + esc(JSON.stringify(b.args || {})) + '"></div>'; }
  function renderBlocks(blocks, ctx) {
    return (blocks || []).map(function (b) {
      switch (b.t) {
        case 'p': return '<p>' + inl(b.text) + '</p>';
        case 'h': return '<h' + b.level + ' class="s" id="' + (ctx && ctx.ch ? esc(ctx.ch) + '/' : '') + esc(b.id) + '">' + inl(b.text) + '<a class="anc" href="#' + (ctx && ctx.ch ? ctx.ch + '/' : '') + esc(b.id) + '" aria-label="link to section">#</a></h' + b.level + '>';
        case 'ul': case 'ol': return listHTML(b);
        case 'callout': return calloutHTML(b);
        case 'table': return tableHTML(b);
        case 'code': return codeBlock(b);
        case 'anatomy': return anatomyHTML(b);
        case 'cmd': return cardHTML(b);
        case 'exercise': return exerciseHTML(b);
        case 'checkpoint': return checkpointHTML(b);
        case 'project': return projectHTML(b);
        case 'widget': return widgetHTML(b);
        default: return '';
      }
    }).join('\n');
  }

  /* ---------- index + navigation ---------- */
  var BYID = {}, ORDER = [];
  CH.forEach(function (c) { BYID[c.id] = c; });
  CH.sort(function (a, b) { return (a.file || '').localeCompare(b.file || ''); });
  CH.forEach(function (c, i) { c.idx = i; });
  CH.forEach(function (c) { c.blocks.forEach(function (b) { if (b.t === 'cmd') { var rec = { ch: c.id, id: cmdId(b), b: b }; cmdIndex[b.name] = rec; if (b.id) cmdIndex[b.id] = rec; } }); });
  var EXTRA = [{ id: 'atlas', title: 'Command Atlas', part: 'ref', special: 1, sub: 'Every command in the book, searchable' }, { id: 'practice', title: 'Practice Hub', part: 'ref', special: 1, sub: 'Exercises, checkpoints, projects and the practice terminal' }, { id: 'glossary', title: 'Glossary', part: 'ref', special: 1, sub: 'Every term, one line each' }, { id: 'values', title: 'My Values', part: 'ref', special: 1, sub: 'Fill the yellow placeholders once' }];
  function chapterList() { return CH.concat(EXTRA); }
  function itemIds(c) { var ids = []; (function w(bl) { (bl || []).forEach(function (b) { if (b.t === 'exercise' || b.t === 'checkpoint') ids.push(b.id); if (b.t === 'project') { var n = b.blocks.filter(function (x) { return x.t === 'h' && x.level === 3; }).length; for (var i = 0; i < n; i++) ids.push(b.id + '#' + i); } }); })(c.blocks); return ids; }
  function updateProgress() {
    var tot = 0, dn = 0; CH.forEach(function (c) { var ids = itemIds(c), d = ids.filter(function (i) { return S.done[i] !== undefined && S.done[i] !== false; }).length; tot += ids.length; dn += d; var el = $('[data-nav="' + c.id + '"] .ck'); if (el) el.textContent = ids.length && d === ids.length ? '✓' : (d ? d + '/' + ids.length : ''); });
    var bar = $('#pbar i'); if (bar) bar.style.width = (tot ? Math.round(dn * 100 / tot) : 0) + '%'; var pl = $('#plabel'); if (pl) pl.textContent = dn + ' of ' + tot + ' practice items done';
  }
  function buildNav() {
    var o = '<a id="brand" href="#welcome"><b>CODEX_LMS</b><span>A hands-on course for your Mac terminal</span></a><div class="pbar" id="pbar"><i></i></div><div id="plabel" style="padding:0 8px 6px;font:12px var(--font-ui);color:var(--mute)"></div>';
    PARTS.forEach(function (p) {
      var list = chapterList().filter(function (c) { return c.part === p[0]; });
      if (!list.length) return;
      o += '<div class="navgrp dom-' + p[0] + '" style="--dom:var(--c-' + ({ start: 'found', found: 'found', zsh: 'zsh', net: 'net', py: 'py', web: 'web', srv: 'srv', sec: 'sec', proj: 'found', ref: 'ref' })[p[0]] + ')">' + p[1] + '</div>';
      list.forEach(function (c) { o += '<a class="navl dom-' + p[0] + '" data-nav="' + c.id + '" href="#' + c.id + '"><span class="n">' + (c.special ? '' : String(c.idx).padStart(2, '0')) + '</span><span>' + esc(c.title) + '</span><span class="ck"></span></a>'; });
    });
    $('#side').innerHTML = o; updateProgress();
  }
  function findChapterFor(id) { return BYID[id] || EXTRA.filter(function (e) { return e.id === id; })[0]; }
  var cur = null;
  function route() {
    var hs = decodeURIComponent(location.hash.replace(/^#\/?/, '')), parts = hs.split('/'), id = parts[0] || S.last || 'welcome', sec = parts.slice(1).join('/');
    var c = findChapterFor(id); if (!c) { id = CH[0] ? CH[0].id : 'atlas'; c = findChapterFor(id); }
    if (!c) return;
    if (cur !== c.id) { showPage(c); cur = c.id; if (!c.special) { S.last = c.id; save(); } }
    if (sec) { setTimeout(function () { var t = document.getElementById(c.id + '/' + sec) || document.getElementById(sec); if (t) { t.scrollIntoView(); if (t.classList.contains('card') || t.classList.contains('ex') || t.classList.contains('cq')) { t.style.outline = '2px solid var(--accent)'; setTimeout(function () { t.style.outline = ''; }, 1600); } } }, 30); } else if (cur) window.scrollTo(0, 0);
    document.body.classList.remove('nav');
    $$('.navl').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === c.id); });
  }
  function showPage(c) {
    var pg = $('#page'), dom = c.part || 'found';
    document.title = c.title + ' | CODEX_LMS';
    var html;
    if (c.special) html = specialPage(c);
    else {
      var head = '<header class="chead dom-' + dom + '"><div class="eyebrow">' + esc((PARTS.filter(function (p) { return p[0] === c.part; })[0] || ['', ''])[1]) + (c.idx !== undefined ? ' · Chapter ' + c.idx : '') + '</div><h1 class="ct">' + inl(c.title) + '</h1>' + (c.sub ? '<p class="csub">' + inl(c.sub) + '</p>' : '') + '<div class="meta">' + (c.time ? '<span>' + c.time + ' min</span>' : '') + (c.level ? '<span>' + esc(c.level) + '</span>' : '') + '</div>' + (c.goals && c.goals.length ? '<div class="goals"><h4>After this chapter you can</h4><ul>' + c.goals.map(function (g) { return '<li>' + inl(g) + '</li>'; }).join('') + '</ul></div>' : '') + '</header>';
      var prev = CH[c.idx - 1], next = CH[c.idx + 1];
      html = head + renderBlocks(c.blocks, { ch: c.id }) + '<nav class="pnav">' + (prev ? '<a href="#' + prev.id + '"><small>Previous</small>' + esc(prev.title) + '</a>' : '<span></span>') + (next ? '<a class="nx" href="#' + next.id + '"><small>Next</small>' + esc(next.title) + '</a>' : '<a class="nx" href="#atlas"><small>Keep going</small>Command Atlas</a>') + '</nav>';
    }
    pg.className = 'dom-' + dom; pg.innerHTML = html;
    hydrate(pg, c);
    // section outline in sidebar
    $$('.subnav').forEach(function (e) { e.remove(); });
    var hs = c.special ? [] : (c.blocks || []).filter(function (b) { return b.t === 'h' && b.level === 2; });
    var nav = $('[data-nav="' + c.id + '"]');
    if (nav && hs.length) { var sn = h('div', { class: 'subnav', html: hs.map(function (x) { return '<a href="#' + c.id + '/' + x.id + '">' + esc(x.text) + '</a>'; }).join('') }); nav.after(sn); }
  }

  /* ---------- special pages ---------- */
  function allCmds() { var l = []; CH.forEach(function (c) { c.blocks.forEach(function (b) { if (b.t === 'cmd') l.push({ b: b, ch: c }); }); }); return l; }
  function specialPage(c) {
    var head = '<header class="chead dom-ref"><div class="eyebrow">Reference</div><h1 class="ct">' + esc(c.title) + '</h1><p class="csub">' + esc(c.sub) + '</p></header>';
    if (c.id === 'glossary') {
      var terms = []; CH.forEach(function (x) { (x.terms || []).forEach(function (t) { terms.push({ t: t.term, d: t.def, ch: x }); }); });
      terms.sort(function (a, b) { return a.t.toLowerCase() < b.t.toLowerCase() ? -1 : 1; });
      var seen = {}; terms = terms.filter(function (t) { var k = t.t.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; });
      return head + '<p>' + terms.length + ' terms. Each links to the chapter that introduces it.</p><div class="tw"><table><tbody>' + terms.map(function (t) { return '<tr><td><strong>' + inl(t.t) + '</strong></td><td>' + inl(t.d) + '</td><td><a href="#' + t.ch.id + '">' + esc(t.ch.title) + '</a></td></tr>'; }).join('') + '</tbody></table></div>';
    }
    if (c.id === 'atlas') return head + '<div class="wmount" data-w="atlas" data-args="{}"></div>';
    if (c.id === 'values') return head + '<div class="wmount" data-w="myvalues" data-args="{}"></div>';
    if (c.id === 'practice') {
      var o = head + '<div class="wmount" data-w="sim" data-args="{}"></div><h2 class="s" id="all">All practice items</h2>';
      CH.forEach(function (x) {
        var ex = []; (function w(bl) { (bl || []).forEach(function (b) { if (b.t === 'exercise' || b.t === 'checkpoint' || b.t === 'project') ex.push(b); }); })(x.blocks);
        if (!ex.length) return;
        o += '<h3 class="s">' + esc(x.title) + '</h3><div class="tw"><table><tbody>' + ex.map(function (b) { var d = S.done[b.id]; return '<tr><td>' + esc(b.t === 'exercise' ? (b.type === 'py' ? 'Python' : b.type === 'js' ? 'JavaScript' : b.type === 'think' ? 'Think' : 'Terminal') : b.t === 'checkpoint' ? 'Checkpoint' : 'Project') + '</td><td><a href="#' + x.id + '/' + b.id + '">' + inl(b.title) + '</a></td><td>' + (d !== undefined && d !== false ? '✓' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
      });
      return o;
    }
    return head;
  }

  /* ---------- hydration (event wiring) ---------- */
  var W = window.__widgets = window.__widgets || {};
  function autoSize(t) { if (!t || t.hasAttribute('data-fixed')) return; var lines = (t.value || t.placeholder || '').split('\n').length, lh = 20.5; var min = t.hasAttribute('data-stdin') ? 2 : 3; t.style.height = Math.min(Math.max(lines, min) * lh + 24, 520) + 'px'; }
  document.addEventListener('input', function (e) { var t = e.target; if (t && t.classList && t.classList.contains('ed') && !t.hasAttribute('data-fixed')) { var lines = t.value.split('\n').length; var want = Math.min(Math.max(lines, 3) * 20.5 + 24, 520); if (want > t.offsetHeight) t.style.height = want + 'px'; } });
  function hydrate(root, ch) {
    $$('.wmount', root).forEach(function (m) {
      var f = W[m.getAttribute('data-w')], args = {}; try { args = JSON.parse(m.getAttribute('data-args')); } catch (e) { }
      if (!f) { m.innerHTML = '<div class="co co-warn"><div class="ch">Widget</div><p>The widget "' + esc(m.getAttribute('data-w')) + '" is not available.</p></div>'; return; }
      try { var el = f(args, ch || {}); if (el) { m.innerHTML = ''; m.appendChild(el); } } catch (e) { m.innerHTML = '<div class="co co-danger"><div class="ch">Widget error</div><p>' + esc(e.message) + '</p></div>'; console.error(e); }
    });
    $$('textarea.ed', root).forEach(autoSize);
    $$('.an', root).forEach(function (a) {
      a.addEventListener('mouseover', function (ev) { var t = ev.target.closest('[data-i]'); $$('.hot', a).forEach(function (x) { x.classList.remove('hot'); }); if (t) $$('[data-i="' + t.getAttribute('data-i') + '"]', a).forEach(function (x) { x.classList.add('hot'); }); });
      a.addEventListener('mouseleave', function () { $$('.hot', a).forEach(function (x) { x.classList.remove('hot'); }); });
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    var cp = t.closest && t.closest('[data-copy]'); if (cp) { copyText(subst(cp.getAttribute('data-copy')), cp); return; }
    var pgb = t.closest && t.closest('[data-playground]'); if (pgb) { sessionStorageSet('pp-code', pgb.getAttribute('data-playground')); location.hash = '#py-start/playground'; return; }
    var ph = t.closest && t.closest('.ph'); if (ph) { openPop(ph); return; }
    var pop = $('#pop'); if (pop && !t.closest('#pop')) pop.remove();
    var opt = t.closest && t.closest('.opt'); if (opt && !opt.disabled) { answer(opt); return; }
    var act = t.closest && t.closest('[data-act]'); if (act) { doAct(act); return; }
    var dn = t.closest && t.closest('[data-done]'); if (dn && dn.tagName === 'INPUT') { S.done[dn.getAttribute('data-done')] = dn.checked ? 1 : false; if (!dn.checked) delete S.done[dn.getAttribute('data-done')]; save(); updateProgress(); var st = dn.closest('.step'); if (st) st.classList.toggle('done', dn.checked); }
    var res = $('#results'); if (res && !t.closest('#results') && t.id !== 'q') res.hidden = true;
  });
  document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('ph')) { e.preventDefault(); openPop(e.target); } if (e.key === 'Escape') { var p = $('#pop'); if (p) p.remove(); var r = $('#results'); if (r) r.hidden = true; } if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('#q').focus(); } });
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { window['__' + k] = v; } }
  window.__ss = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return window['__' + k]; } }, set: sessionStorageSet };

  function openPop(chipEl) {
    var old = $('#pop'); if (old) old.remove();
    var k = chipEl.getAttribute('data-k'), d = varDef(k), r = chipEl.getBoundingClientRect();
    var pop = h('div', { id: 'pop', role: 'dialog' });
    pop.innerHTML = '<b>' + esc(d.label) + '</b><p>' + esc(d.desc) + '</p><input type="text" value="' + esc(val(k)) + '" aria-label="' + esc(d.label) + '" autocomplete="off" autocapitalize="off" spellcheck="false">' + (d.find ? '<p>To find yours, run:</p><div class="syn" style="font-size:12px;padding:6px 8px"><span>' + esc(d.find) + '</span><button class="cp" data-copy="' + esc(d.find) + '">Copy</button></div>' : '') + '<div class="row"><button class="btn" data-pop="ok">Done</button><button class="btn sec" data-pop="reset">Use example</button></div><p style="font-size:12px">This value replaces every yellow chip with this name in the whole book, including copied commands.</p>';
    document.body.appendChild(pop);
    var w = pop.offsetWidth, hh = pop.offsetHeight, x = Math.min(Math.max(8, r.left), innerWidth - w - 8), y = r.bottom + 6; if (y + hh > innerHeight - 8) y = Math.max(8, r.top - hh - 6);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
    var inp = $('input', pop); inp.focus(); inp.select();
    inp.addEventListener('input', function () { setVal(k, inp.value); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') pop.remove(); });
    pop.addEventListener('click', function (e) { var b = e.target.closest('[data-pop]'); if (!b) return; if (b.getAttribute('data-pop') === 'reset') { setVal(k, ''); inp.value = val(k); } else pop.remove(); });
  }

  function answer(opt) {
    var q = opt.closest('.q'), cq = opt.closest('.cq'); if (q.getAttribute('data-done')) return;
    var ok = opt.getAttribute('data-ok') === '1'; q.setAttribute('data-done', ok ? 'ok' : 'bad');
    $$('.opt', q).forEach(function (b) { b.disabled = true; if (b.getAttribute('data-ok') === '1') b.classList.add('right'); });
    if (!ok) opt.classList.add('wrong'); $('.why', q).hidden = false; finishCq(cq);
  }
  function finishCq(cq) {
    var qs = $$('.q', cq), done = qs.filter(function (q) { return q.getAttribute('data-done'); });
    if (done.length < qs.length) return;
    var ok = qs.filter(function (q) { return q.getAttribute('data-done') === 'ok'; }).length, id = cq.getAttribute('data-cq');
    if (S.done[id] === undefined || S.done[id] === false || ok > S.done[id]) { S.done[id] = ok; save(); updateProgress(); }
    var r = $('[data-final]', cq); r.className = 'res show ' + (ok === qs.length ? 'pass' : 'fail'); r.innerHTML = '<span class="okk">Score: ' + ok + ' / ' + qs.length + '</span> ' + (ok === qs.length ? 'Every answer correct.' : 'Read the explanations above, then reload the chapter section and try again.') + ' <button class="btn sec" data-act="cqreset">Try again</button>';
    $('[data-score]', cq).textContent = 'best: ' + S.done[id] + '/' + qs.length;
  }
  function norm(s) { return String(s).trim().toLowerCase().replace(/\s+/g, ' '); }
  function doAct(btn) {
    var a = btn.getAttribute('data-act');
    if (a === 'ansc') { var q = btn.closest('.q'), inp = $('input', q), acc = JSON.parse(inp.getAttribute('data-ans')).map(norm), ok = acc.indexOf(norm(inp.value)) >= 0; q.setAttribute('data-done', ok ? 'ok' : 'bad'); inp.disabled = true; btn.disabled = true; inp.style.borderColor = ok ? 'var(--ok)' : 'var(--bad)'; $('.why', q).hidden = false; if (!ok) $('.why', q).insertAdjacentHTML('afterbegin', '<div><strong>Accepted: </strong><code>' + esc(JSON.parse(inp.getAttribute('data-ans'))[0]) + '</code></div>'); finishCq(q.closest('.cq')); }
    else if (a === 'cqreset') { var cq = btn.closest('.cq'); $$('.q', cq).forEach(function (q) { q.removeAttribute('data-done'); $$('.opt', q).forEach(function (b) { b.disabled = false; b.className = 'opt'; }); $$('input[type=text]', q).forEach(function (i) { i.disabled = false; i.value = ''; i.style.borderColor = ''; }); $$('button[data-act=ansc]', q).forEach(function (b) { b.disabled = false; }); var w = $('.why', q); w.hidden = true; w.innerHTML = w.innerHTML.replace(/<div><strong>Accepted:.*?<\/div>/, ''); }); var r = $('[data-final]', cq); r.className = 'res'; r.innerHTML = ''; }
    else if (a === 'reset') { var rb = btn.closest('.runbox'), ta = $('.ed', rb); ta.value = ta.getAttribute('data-orig'); }
    else if (a === 'pyreset') { var pe = btn.closest('[data-pyex]'); $('.ed', pe).value = $('.ed', pe).getAttribute('data-orig'); }
    else if (a === 'run' || a === 'pyrun' || a === 'pycheck') { if (window.__pyAct) window.__pyAct(btn, a); }
  }

  /* ---------- search ---------- */
  var IDX = [];
  function plain(t) { return String(t || '').replace(/[`*\[\]{}]|\(#[^)]*\)/g, ''); }
  function buildIndex() {
    CH.forEach(function (c) {
      IDX.push({ k: 'Chapter', t: c.title, s: c.sub || '', ch: c.id, h: c.id, x: (c.goals || []).join(' ') });
      var sec = null;
      (function w(bl) { bl.forEach(function (b) {
        if (b.t === 'h') { sec = b; IDX.push({ k: 'Section', t: plain(b.text), s: c.title, ch: c.id, h: c.id + '/' + b.id, x: '' }); }
        else if (b.t === 'cmd') IDX.push({ k: 'Command', t: b.name, s: plain(b.sum), ch: c.id, h: c.id + '/' + cmdId(b), x: (b.tags || []).join(' ') + ' ' + b.syntax });
        else if (b.t === 'exercise' || b.t === 'checkpoint' || b.t === 'project') IDX.push({ k: b.t === 'exercise' ? 'Exercise' : b.t === 'checkpoint' ? 'Checkpoint' : 'Project', t: plain(b.title), s: c.title, ch: c.id, h: c.id + '/' + b.id, x: '' });
        else if (b.t === 'p' && sec) { var last = IDX[IDX.length - 1]; if (last && last.k === 'Section' && last.h.split('/')[1] === sec.id) last.x += ' ' + plain(b.text); }
      }); })(c.blocks);
      (c.terms || []).forEach(function (t) { IDX.push({ k: 'Term', t: t.term, s: plain(t.def), ch: c.id, h: c.id, x: '' }); });
    });
  }
  function doSearch(q) {
    var res = $('#results'); q = q.trim().toLowerCase(); if (!q) { res.hidden = true; return; }
    var toks = q.split(/\s+/), scored = [];
    IDX.forEach(function (r) {
      var t = r.t.toLowerCase(), s = (r.s + ' ' + r.x).toLowerCase(), sc = 0;
      for (var i = 0; i < toks.length; i++) { var k = toks[i]; if (t === k) sc += 12; else if (t.indexOf(k) === 0) sc += 8; else if (t.indexOf(k) >= 0) sc += 5; else if (s.indexOf(k) >= 0) sc += 1; else { sc = 0; break; } }
      if (sc) scored.push([sc + (r.k === 'Command' ? 2 : r.k === 'Chapter' ? 1 : 0), r]);
    });
    scored.sort(function (a, b) { return b[0] - a[0]; });
    res.innerHTML = scored.slice(0, 12).map(function (x) { var r = x[1]; return '<a href="#' + r.h + '"><b>' + esc(r.t) + '</b> <small style="display:inline">' + r.k + '</small><small>' + esc((r.s || '').slice(0, 110)) + '</small></a>'; }).join('') || '<div style="padding:10px;color:var(--mute)">No matches.</div>';
    res.hidden = false;
  }

  function applyTheme() { if (S.theme) document.documentElement.setAttribute('data-theme', S.theme); }
  function boot() {
    Array.prototype.slice.call(document.querySelectorAll('body > style, body > link[rel=stylesheet]')).forEach(function (n) { document.head.appendChild(n); });
    document.body.innerHTML = '<button class="skip" id="skip">Skip to content</button><div id="app"><nav id="side" aria-label="Contents"></nav><div id="main"><div id="top"><button class="tb" id="menu" aria-label="Open contents">☰ Contents</button><input id="q" type="search" placeholder="Search commands and topics" aria-label="Search the book (press / to focus)"><kbd class="qk" aria-hidden="true">/</kbd><span class="sp"></span><a class="tb hide-s" href="#atlas">Atlas</a><a class="tb hide-s" href="#practice">Practice</a><a class="tb hide-s" href="#values" title="Your placeholder values">My Values</a><button class="tb" id="theme" aria-label="Switch between light and dark theme"><svg class="ti" aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor"/></svg><span class="tl">Theme</span></button></div><div id="results" hidden></div><main id="page" tabindex="-1"></main></div><div id="scrim"></div></div>';
    applyTheme(); buildNav(); buildIndex();
    
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('#menu,#theme,#side a,#scrim') : null; if (!t) return;
      if (t.id === 'menu') { document.body.classList.toggle('nav'); return; }
      if (t.id === 'scrim' || t.closest('#side')) { document.body.classList.remove('nav'); return; }
      if (t.id === 'theme') {
        var root = document.documentElement, cur = S.theme || root.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        S.theme = cur === 'dark' ? 'light' : 'dark'; applyTheme(); save();
      }
    });
    var qi = $('#q'), tm; qi.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(function () { doSearch(qi.value); }, 80); }); qi.addEventListener('focus', function () { if (qi.value) doSearch(qi.value); });
    $('#results').addEventListener('click', function () { $('#results').hidden = true; });
    $('#skip').addEventListener('click', function () { var h = $('#page h1') || $('#page'); if (h !== $('#page')) h.setAttribute('tabindex', '-1'); h.focus(); });
    window.addEventListener('hashchange', route); route();
  }
  window.__core = { $: $, $$: $$, h: h, esc: esc, inl: inl, hlSh: hlSh, hlPy: hlPy, autoSize: autoSize, hlJs: hlJs, hlMarkup: hlMarkup, hlCss: hlCss, subst: subst, val: val, setVal: setVal, varDef: varDef, VARS: VARS, GROUPS: GROUPS, copyText: copyText, toast: toast, S: S, save: save, chip: chip, refreshChips: refreshChips, allCmds: allCmds, cardHTML: cardHTML, cmdId: cmdId, CH: CH, BYID: BYID, hydrate: hydrate, renderBlocks: renderBlocks, updateProgress: updateProgress, copyBtn: copyBtn, phHTML: phHTML, slug: slug, CATN: CATN, osLabel: osLabel };
  window.__boot = boot;
})();

/* In-page Python: client for py/worker.js (Pyodide), run buttons, exercise checker, playground widget. */
(function () {
  'use strict';
  var K = window.__core, $ = K.$, esc = K.esc, W = window.__widgets = window.__widgets || {};
  var worker = null, readyP = null, seq = 0, pending = {}, state = 'idle', onState = [];
  function setState(s, m) { state = s; onState.forEach(function (f) { f(s, m); }); }
  function start() {
    if (readyP) return readyP;
    setState('loading');
    readyP = new Promise(function (res, rej) {
      try { worker = new Worker('py/worker.js'); } catch (e) { setState('fail', String(e)); rej(e); return; }
      worker.onmessage = function (ev) {
        var d = ev.data;
        if (d.ready) { setState('ready'); res(); }
        else if (d.fatal) { setState('fail', d.fatal); rej(new Error(d.fatal)); }
        else if (pending[d.id]) { var p = pending[d.id]; delete pending[d.id]; clearTimeout(p.t); p.res(d); }
      };
      worker.onerror = function (e) { setState('fail', e.message || 'worker error'); rej(e); };
    });
    return readyP;
  }
  function kill() { try { worker.terminate(); } catch (e) { } worker = null; readyP = null; Object.keys(pending).forEach(function (k) { pending[k].res({ status: 'error', out: '', msg: 'Stopped: the program ran longer than 10 seconds (an endless loop?).' }); delete pending[k]; }); setState('idle'); }
  function run(code, stdin, check) {
    return start().then(function () {
      return new Promise(function (res) {
        var id = ++seq; pending[id] = { res: res, t: setTimeout(kill, 10000) };
        worker.postMessage({ id: id, code: code, stdin: stdin || '', check: check || '' });
      });
    }, function (e) { return { status: 'error', out: '', msg: 'Python could not start in this browser (' + (e && e.message || e) + '). The rest of the book still works; run the code in PyCharm instead.' }; });
  }
  window.__py = { run: run, start: start, onState: function (f) { onState.push(f); f(state); }, state: function () { return state; } };

  function show(box, r, pass) {
    var el = $('.res', box); el.className = 'res show' + (r.status === 'ok' ? (pass ? ' pass' : '') : ' fail');
    var html = r.out ? esc(r.out) : '';
    if (r.status === 'error') html += (html && !/\n$/.test(r.out) ? '\n' : '') + '<span class="er">' + esc(r.msg) + '</span>';
    if (r.status === 'fail') html += (html ? '\n' : '') + '<span class="er">✗ ' + esc(r.msg) + '</span>';
    if (pass && r.status === 'ok') html += (html ? '\n' : '') + '<span class="okk">✓ All checks passed.</span>';
    if (!html) html = '<span style="color:var(--dim)">(the program printed nothing)</span>';
    el.innerHTML = html;
  }
  window.__pyAct = function (btn, act) {
    var box = btn.closest('.runbox') || btn.closest('[data-pyex]'), ta = $('.ed', box), sIn = $('[data-stdin]', box);
    var check = '', exId = null;
    if (act === 'pycheck') { exId = box.getAttribute('data-pyex'); check = findCheck(exId); }
    var old = btn.textContent; btn.disabled = true; btn.textContent = state === 'ready' ? 'Running…' : 'Loading Python…';
    run(ta.value, sIn ? sIn.value : '', check).then(function (r) {
      btn.disabled = false; btn.textContent = old; show(box, r, act === 'pycheck');
      if (act === 'pycheck' && r.status === 'ok') { K.S.done[exId] = 1; K.save(); var cb = document.querySelector('[data-done="' + exId + '"]'); if (cb) cb.checked = true; K.updateProgress(); }
    });
  };
  function findCheck(id) { var f = ''; K.CH.forEach(function (c) { c.blocks.forEach(function (b) { if (b.t === 'exercise' && b.id === id) f = b.check || ''; }); }); return f; }

  /* playground widget */
  W.playground = function (args) {
    var starter = (window.__ss && window.__ss.get('pp-code')) || args.code || '# Write Python here, then press Run.\nname = "world"\nprint(f"hello, {name}")\n\nfor i in range(3):\n    print(i, i * i)\n';
    var root = K.h('div', { class: 'runbox', 'data-run': 'pg', id: 'playground' });
    root.innerHTML = '<div class="bar"><span>Python playground</span><span class="sp"></span><span class="badge" data-st>idle</span><button class="btn" data-act="run">Run</button></div><textarea class="ed" style="min-height:220px" spellcheck="false">' + esc(starter) + '</textarea><details><summary>Input for input() (stdin)</summary><textarea class="ed" style="min-height:50px" data-stdin placeholder="one line per input() call"></textarea></details><div class="res"></div><p style="font:13px var(--font-ui);color:var(--mute);margin:8px 0 0">Real CPython 3.13 running in your browser (WebAssembly). No network, no sockets, no real files: network and file-system code goes in PyCharm.</p>';
    window.__py.onState(function (s) { var b = $('[data-st]', root); if (b) b.textContent = s === 'loading' ? 'loading Python…' : s === 'ready' ? 'ready' : s === 'fail' ? 'unavailable' : 'idle'; });
    $('textarea', root).addEventListener('keydown', function (e) { if (e.key === 'Tab') { e.preventDefault(); var t = e.target, s = t.selectionStart; t.value = t.value.slice(0, s) + '    ' + t.value.slice(t.selectionEnd); t.selectionStart = t.selectionEnd = s + 4; } if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); $('[data-act=run]', root).click(); } });
    return root;
  };
  /* make every editable python area accept Tab as indentation */
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (e.key !== 'Tab' || !t.classList || !t.classList.contains('ed')) return;
    e.preventDefault(); var s = t.selectionStart; t.value = t.value.slice(0, s) + '    ' + t.value.slice(t.selectionEnd); t.selectionStart = t.selectionEnd = s + 4;
  });
})();

/* Widgets A: practice terminal, pipeline lab, command atlas, My Values, Lab Kit. */
(function () {
  'use strict';
  var K = window.__core, $ = K.$, $$ = K.$$, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};
  var FILES = window.__BOOK.fixtures.files;
  function newShell() { return new SIM.Shell({ files: FILES }); }
  function snapshot(sh) { var o = {}; Object.keys(sh.fs.n).forEach(function (k) { var x = sh.fs.n[k]; if (k.indexOf('/dev') === 0) return; o[k] = x.d ? 'D' : x.f; }); return o; }
  var BASE = snapshot(newShell());
  function sameFs(a, b) { var ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false; return ka.every(function (k) { return a[k] === b[k]; }); }
  function runLines(sh, text) { var out = ''; text.split('\n').forEach(function (l) { if (!l.trim()) return; var r = sh.run(l); out += r.out; }); return out; }

  /* expected result for a mission is computed by running its solution on a clean lab */
  function expectation(m) {
    var sh = newShell(); if (m.cwd) sh.run('cd ' + m.cwd);
    var out = ''; m.solution.split('\n').forEach(function (l) { if (l.trim()) { var r = sh.run(l); out = r.out; } });
    var snap = snapshot(sh), changed = !sameFs(snap, BASE);
    return { out: out.replace(/\s+$/, ''), snap: snap, changed: changed, cwd: sh.cwd };
  }

  W.sim = function (args) {
    var chapter = args.chapter || '', missions = (window.__BOOK.missions || []).filter(function (m) { return !chapter || m.ch === chapter; });
    var all = window.__BOOK.missions || [];
    var sh = newShell(); if (args.cwd) sh.run('cd ' + args.cwd);
    var hist = [], hi = 0, seen = {}, exp = {};
    var root = h('div', { class: 'wg dom-zsh', style: '--dom:var(--c-zsh)' });
    root.innerHTML = '<h4>Practice terminal</h4><p class="sub">A simulated macOS shell with the lab files (<code>~/lab</code>). Safe to break: <strong>Reset lab</strong> restores everything. It supports pipes, redirects, loops, <code>sort uniq cut grep sed awk find xargs</code> and canned network tools. For the real thing, use your Terminal.</p><div class="term-ui"><div class="scr" tabindex="0" aria-live="polite"></div><div class="in"><span class="pr"></span><input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Command"></div></div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn sec" data-r="reset">Reset lab</button><button class="btn sec" data-r="clear">Clear screen</button><button class="btn sec" data-r="help">Commands</button></div><div class="mis"></div>';
    var scr = $('.scr', root), inp = $('input', root), pr = $('.pr', root);
    function prompt() { var d = sh.cwd === SIM.HOME ? '~' : sh.cwd.split('/').pop() || '/'; return 'learner@macbook ' + d + ' %'; }
    function setPrompt() { pr.textContent = prompt(); }
    function print(s, cls) { if (s === '') return; var d = h('div', { class: cls || '', text: s.replace(/\n$/, '') }); d.style.whiteSpace = 'pre-wrap'; scr.appendChild(d); scr.scrollTop = scr.scrollHeight; }
    function banner() { scr.innerHTML = ''; print('Lab shell ready. Try: ls, cat README.txt, head -3 access.log', 'd'); }
    banner(); setPrompt();
    function checkMissions() {
      var snap = snapshot(sh);
      missions.forEach(function (m) {
        if (K.S.done['m:' + m.id]) return; var e = exp[m.id] || (exp[m.id] = expectation(m)); var ok = false;
        if (e.changed) ok = sameFs(snap, e.snap); else ok = seen[e.out] && e.out !== '';
        if (ok) { K.S.done['m:' + m.id] = 1; K.save(); K.updateProgress(); drawMissions(); K.toast('Mission complete: ' + m.title); }
      });
    }
    function exec(line) {
      print(prompt() + ' ' + line, 'd'); if (!line.trim()) return;
      hist.push(line); hi = hist.length;
      var r = sh.run(line);
      if (r.out.indexOf('\x1b[clear]') >= 0) { scr.innerHTML = ''; r.out = r.out.replace('\x1b[clear]', ''); }
      print(r.err, 'e'); print(r.out);
      var t = r.out.replace(/\s+$/, ''); if (t) seen[t] = 1; setPrompt(); checkMissions();
    }
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var v = inp.value; inp.value = ''; exec(v); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) inp.value = hist[--hi]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < hist.length - 1) inp.value = hist[++hi]; else { hi = hist.length; inp.value = ''; } }
      else if (e.key === 'Tab') {
        e.preventDefault(); var v = inp.value, m = /(\S*)$/.exec(v)[1], dir = m.indexOf('/') >= 0 ? m.replace(/[^\/]*$/, '') : '', pre = m.slice(dir.length);
        var d = sh.abs(dir || '.'); var names = sh.fs.isDir(d) ? sh.fs.list(d).filter(function (n) { return n.indexOf(pre) === 0; }) : [];
        if (v.indexOf(' ') < 0) names = Object.keys(SIM.CMDS).filter(function (n) { return n.indexOf(m) === 0 && /^[a-z]/.test(n); });
        if (names.length === 1) inp.value = v.slice(0, v.length - pre.length) + names[0] + (sh.fs.isDir(sh.abs(dir + names[0])) ? '/' : ' ');
        else if (names.length > 1) print(names.join('  '), 'd');
      }
    });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]'); if (!b) { if (e.target.closest('.term-ui')) inp.focus(); return; }
      var a = b.getAttribute('data-r');
      if (a === 'reset') { sh = newShell(); if (args.cwd) sh.run('cd ' + args.cwd); seen = {}; hist = []; banner(); setPrompt(); }
      else if (a === 'clear') { scr.innerHTML = ''; }
      else if (a === 'help') print(Object.keys(SIM.CMDS).filter(function (n) { return /^[a-z]/.test(n); }).sort().join('  '), 'd');
      else if (a === 'run') { inp.value = b.getAttribute('data-cmd'); inp.focus(); }
    });
    function drawMissions() {
      var box = $('.mis', root); if (!missions.length && !chapter) missions = all;
      if (!missions.length) { box.innerHTML = ''; return; }
      box.innerHTML = '<h4 style="margin:6px 0 0;font:700 12px var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--c-zsh)">Missions' + (chapter ? ' for this chapter' : '') + '</h4>' + missions.map(function (m) {
        var d = K.S.done['m:' + m.id];
        return '<div class="m' + (d ? ' done' : '') + '"><h5>' + (d ? '✓ ' : '') + esc(m.title) + '</h5><div style="font-size:14px">' + K.inl(m.goal) + '</div><details class="rv"><summary>Hint</summary>' + K.inl(m.hint || '') + '</details><details class="rv"><summary>Show a solution</summary><div class="syn" style="display:flex;gap:8px"><span style="white-space:pre;flex:1;overflow:auto;font:13px var(--font-mono)">' + esc(m.solution) + '</span><button class="cp" data-r="run" data-cmd="' + esc(m.solution.split('\n')[0]) + '">Type it</button></div></details></div>';
      }).join('');
    }
    drawMissions();
    return root;
  };

  /* ---- pipeline lab ---- */
  function splitPipe(s) {
    var parts = [], cur = '', q = '', i = 0, depth = 0;
    for (; i < s.length; i++) {
      var c = s[i];
      if (q) { cur += c; if (c === q && s[i - 1] !== '\\') q = ''; continue; }
      if (c === "'" || c === '"') { q = c; cur += c; continue; }
      if (c === '(') depth++; if (c === ')') depth--;
      if (c === '|' && s[i + 1] === '|') { cur += '||'; i++; continue; }
      if (c === '|' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur); return parts.map(function (p) { return p.trim(); }).filter(Boolean);
  }
  W.pipelab = function () {
    var root = h('div', { class: 'wg', style: '--dom:var(--c-zsh)' });
    var dflt = "cat access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -5";
    root.innerHTML = '<h4>Pipeline lab</h4><p class="sub">Type a pipeline that uses the lab files. See what flows between every stage.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><input type="text" style="flex:1;min-width:220px" value="' + esc(dflt) + '" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Pipeline"><button class="btn">Run stages</button></div><div class="stages"></div>';
    var inp = $('input', root), st = $('.stages', root);
    function go() {
      var stages = splitPipe(inp.value), o = '';
      stages.forEach(function (_, k) {
        var sh = newShell(), cmd = stages.slice(0, k + 1).join(' | '), r = sh.run(cmd), lines = r.out.replace(/\n$/, '').split('\n'), tot = r.out === '' ? 0 : lines.length;
        var shown = lines.slice(0, 8).join('\n') + (tot > 8 ? '\n… ' + (tot - 8) + ' more lines' : '');
        o += '<div class="st"><div class="h">' + (k + 1) + '. ' + esc(stages[k]) + '  <span style="color:var(--dim)">→ ' + tot + ' line' + (tot === 1 ? '' : 's') + '</span></div><pre>' + esc(r.err ? r.err : shown) + '</pre></div>';
      });
      st.innerHTML = o || '<p>Type a command.</p>';
    }
    $('button', root).onclick = go; inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); }); go();
    return root;
  };

  /* ---- command atlas ---- */
  W.atlas = function () {
    var cmds = K.allCmds(), root = h('div'), cat = '', q = '', os = '';
    var cats = {}; cmds.forEach(function (c) { cats[c.b.cat] = (cats[c.b.cat] || 0) + 1; });
    root.innerHTML = '<p>' + cmds.length + ' commands, operators and functions. Search, filter, click a row for the full card.</p><input id="aq" type="search" placeholder="Filter: ping, redirect, split, port…" style="width:100%;max-width:420px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--fg);font:15px var(--font-ui)"><div class="filt"></div><div class="list"></div>';
    var chips = $('.filt', root), list = $('.list', root), aq = $('#aq', root);
    function drawChips() { chips.innerHTML = '<span class="chip' + (!cat ? ' on' : '') + '" data-c="">all</span>' + Object.keys(cats).sort(function (a, b) { return String(K.CATN[a] || a).toLowerCase() < String(K.CATN[b] || b).toLowerCase() ? -1 : 1; }).map(function (c) { return '<span class="chip' + (cat === c ? ' on' : '') + '" data-c="' + c + '">' + esc(K.CATN[c] || c) + ' ' + cats[c] + '</span>'; }).join(''); }
    function draw() {
      var t = q.toLowerCase().split(/\s+/).filter(Boolean);
      var rows = cmds.filter(function (c) { if (cat && c.b.cat !== cat) return false; var hay = (c.b.name + ' ' + c.b.sum + ' ' + (c.b.tags || []).join(' ')).toLowerCase(); return t.every(function (x) { return hay.indexOf(x) >= 0; }); }).sort(function (a, b) { return a.b.name.toLowerCase() < b.b.name.toLowerCase() ? -1 : 1; });
      var domOf = function (ct) { return /^net/.test(ct) ? 'net' : /^py/.test(ct) ? 'py' : /^web/.test(ct) ? 'web' : /^srv/.test(ct) ? 'srv' : /^sec/.test(ct) ? 'sec' : 'zsh'; };
      list.innerHTML = (rows.length ? '<p class="atl-n">' + rows.length + ' shown</p>' : '') + rows.map(function (c, i) { return '<details class="atl" data-i="' + i + '" style="--dom:var(--c-' + domOf(c.b.cat) + ')"><summary><code class="atl-nm">' + esc(c.b.name) + '</code><span class="atl-sum">' + K.inl(c.b.sum) + '</span><a class="atl-ch" href="#' + c.ch.id + '">' + esc(c.ch.title) + '</a></summary><div class="body"></div></details>'; }).join('') || '<p>No matches.</p>';
      $$('.atl', list).forEach(function (d) { d.addEventListener('toggle', function () { if (d.open && !$('.body', d).innerHTML) { var c = rows[+d.getAttribute('data-i')]; $('.body', d).innerHTML = K.cardHTML(c.b); K.hydrate($('.body', d)); } }); });
    }
    chips.addEventListener('click', function (e) { var c = e.target.closest('.chip'); if (!c) return; cat = c.getAttribute('data-c'); drawChips(); draw(); });
    aq.addEventListener('input', function () { q = aq.value; draw(); });
    drawChips(); draw(); return root;
  };

  /* ---- My Values ---- */
  W.myvalues = function () {
    var root = h('div'), VARS = K.VARS, G = K.GROUPS;
    var probe = 'echo "myip=$(ipconfig getifaddr en0)"; echo "gateway=$(route -n get default | awk \'/gateway:/ {print $2}\')"; echo "iface=$(route -n get default | awk \'/interface:/ {print $2}\')"; echo "dns=$(scutil --dns | awk \'/nameserver\\[0\\]/ {print $3; exit}\')"; echo "mac=$(ifconfig en0 | awk \'/ether/ {print $2}\')"';
    root.innerHTML = '<p>Yellow chips in the book are placeholders. Set them here once and every command in the book, including the ones you copy, uses your values. Values stay in this browser.</p><div class="wg"><h4>Fill the network values from your Mac</h4><p class="sub">Copy this into Terminal, then paste the five lines it prints into the box and press Apply.</p><div class="syn" style="display:flex;gap:8px"><span style="white-space:pre-wrap;flex:1;font:12.5px var(--font-mono);word-break:break-all">' + esc(probe) + '</span><button class="cp" data-copy="' + esc(probe) + '">Copy</button></div><textarea class="ed" style="min-height:90px;margin-top:8px" placeholder="myip=192.168.1.23&#10;gateway=192.168.1.1&#10;..." id="paste"></textarea><div style="margin-top:8px"><button class="btn" id="apply">Apply</button> <span id="msg" style="font:13px var(--font-ui);color:var(--mute)"></span></div></div><div class="vl"></div>';
    var vl = $('.vl', root);
    function draw() {
      var o = ''; G.forEach(function (g) {
        o += '<h3 class="s">' + esc(g.label) + '</h3><div class="tw"><table><tbody>';
        Object.keys(VARS).filter(function (k) { return VARS[k].g === g.id; }).forEach(function (k) { var d = VARS[k]; o += '<tr><td><code>{{' + k + '}}</code><br><small style="color:var(--mute)">' + esc(d.label) + '</small></td><td><input type="text" data-k="' + k + '" value="' + esc(K.val(k)) + '" style="width:100%;min-width:140px;background:var(--code-bg);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;font:13px var(--font-mono)"></td><td style="font-size:13px">' + esc(d.desc) + (d.find ? '<br><code style="white-space:pre-wrap;word-break:break-all">' + esc(d.find) + '</code>' : '') + '</td></tr>'; });
        o += '</tbody></table></div>';
      });
      vl.innerHTML = o + '<button class="btn sec" id="resetall">Reset everything to the examples</button>';
    }
    draw();
    vl.addEventListener('input', function (e) { var k = e.target.getAttribute('data-k'); if (k) K.setVal(k, e.target.value); });
    root.addEventListener('click', function (e) {
      if (e.target.id === 'resetall') { K.S.vals = {}; K.save(); draw(); K.refreshChips(); }
      if (e.target.id === 'apply') { var n = 0; $('#paste', root).value.split('\n').forEach(function (l) { var m = /^\s*(\w+)=(.+?)\s*$/.exec(l); if (m && VARS[m[1]]) { K.setVal(m[1], m[2]); n++; } }); $('#msg', root).textContent = n ? 'Set ' + n + ' value' + (n > 1 ? 's' : '') + '.' : 'No key=value lines found.'; draw(); }
    });
    return root;
  };

  /* ---- Lab Kit ---- */
  function labScript() {
    var o = '# CODEX_LMS: creates ~/lab with the practice files\nppp_lab() {\n  if [ -e ~/lab ]; then echo "~/lab already exists. Rename or remove it first (mv ~/lab ~/lab.old), then paste again."; return 1; fi\n  mkdir -p ~/lab/data/archive || return 1\n  cd ~/lab || return 1\n';
    Object.keys(FILES).forEach(function (f, i) { var body = FILES[f]; if (body !== '' && body.slice(-1) !== '\n') body += '\n'; o += "cat > '" + f + "' <<'PPP_EOF'\n" + body + 'PPP_EOF\n'; });
    o += 'echo "Lab ready: $(ls -R ~/lab | grep -c .) entries in ~/lab. Next: cd ~/lab && ls"\n}\nppp_lab; unset -f ppp_lab\n';
    return o;
  }
  window.__labScript = labScript;
  W.labkit = function () {
    var s = labScript(), root = h('div', { class: 'wg' });
    root.innerHTML = '<h4>Lab Kit</h4><p class="sub">One paste creates <code>~/lab</code> with every practice file the book uses (web log, IP lists, CSV, saved ping and scan output). It only creates a new folder and stops if <code>~/lab</code> already exists.</p><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn" data-copy="' + esc(s) + '">Copy the Lab Kit</button><span style="font:13px var(--font-ui);color:var(--mute)">' + s.split('\n').length + ' lines, ' + Math.round(s.length / 1024) + ' KB. Open Terminal, paste, press Return.</span></div><details class="rv"><summary>Read it before you run it</summary><div class="cb"><pre style="max-height:320px">' + esc(s) + '</pre></div></details>';
    return root;
  };
})();

/* Widgets B: number bases, subnetting, chmod, protocol explorers, ports, regex, ASCII, troubleshooting flowchart. */
(function () {
  'use strict';
  var K = window.__core, $ = K.$, $$ = K.$$, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};
  function wg(title, sub, dom) { var r = h('div', { class: 'wg' }); if (dom) r.style.setProperty('--dom', 'var(--c-' + dom + ')'); r.innerHTML = '<h4>' + esc(title) + '</h4>' + (sub ? '<p class="sub">' + sub + '</p>' : ''); return r; }
  function addBody(r, html) { var d = h('div', { html: html }); r.appendChild(d); return d; }
  var INP = 'background:var(--code-bg);color:var(--fg);border:1px solid var(--line);border-radius:7px;padding:7px 9px;font:14px var(--font-mono)';

  /* ---- base converter ---- */
  W.baseconv = function () {
    var r = wg('Number base converter', 'Type in any box, or flip bits. Eight bits make one byte (0 to 255).', 'found');
    var b = addBody(r, '<div class="grid2"><label>Decimal<br><input type="text" data-b="10" style="' + INP + ';width:100%" value="192"></label><label>Binary<br><input type="text" data-b="2" style="' + INP + ';width:100%"></label><label>Hexadecimal<br><input type="text" data-b="16" style="' + INP + ';width:100%"></label><label>Octal<br><input type="text" data-b="8" style="' + INP + ';width:100%"></label></div><div class="bits"></div><div class="mono" id="asc" style="margin-top:6px"></div>');
    var n = 192;
    function bits() { var o = ''; for (var i = 7; i >= 0; i--) o += '<button class="bit' + ((n >> i) & 1 ? ' on' : '') + '" data-bit="' + i + '" aria-label="bit ' + i + '">' + ((n >> i) & 1) + '</button>' + (i === 4 ? '<span class="bitgap"></span>' : ''); return o; }
    function draw(skip) {
      $$('[data-b]', b).forEach(function (i) { var base = +i.getAttribute('data-b'); if (i !== skip) i.value = isNaN(n) ? '' : n.toString(base).toUpperCase(); });
      $('.bits', b).innerHTML = n >= 0 && n < 256 ? bits() : '<span style="color:var(--mute)">Bits shown for 0 to 255.</span>';
      $('#asc', b).textContent = n >= 32 && n < 127 ? 'As an ASCII character: "' + String.fromCharCode(n) + '"' : (n >= 0 && n < 256 ? 'Not a printable ASCII character' : '');
    }
    b.addEventListener('input', function (e) { var base = +e.target.getAttribute('data-b'); if (!base) return; var v = parseInt(e.target.value, base); n = isNaN(v) ? NaN : v; draw(e.target); });
    b.addEventListener('click', function (e) { var t = e.target.closest('[data-bit]'); if (!t) return; n = (isNaN(n) ? 0 : n) ^ (1 << +t.getAttribute('data-bit')); draw(); });
    draw(); return r;
  };

  /* ---- subnet calculator ---- */
  function ip2n(s) { var p = s.trim().split('.'); if (p.length !== 4) return null; var n = 0; for (var i = 0; i < 4; i++) { if (!/^\d+$/.test(p[i]) || +p[i] > 255) return null; n = n * 256 + +p[i]; } return n; }
  function n2ip(n) { return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); }
  function maskOf(p) { return p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0; }
  function bin32(n, pfx) { var s = (n >>> 0).toString(2).padStart(32, '0'), o = ''; for (var i = 0; i < 32; i++) { o += (i === pfx && pfx < 32 ? '<span class="t-op">|</span>' : '') + '<span style="color:' + (i < pfx ? 'var(--c-net)' : 'var(--c-py)') + '">' + s[i] + '</span>'; if (i % 8 === 7 && i < 31) o += '.'; } return o; }
  function cls(n) { var a = n >>> 24; if (a === 127) return 'loopback'; if (a === 10 || (n >>> 20) === 0xAC1 || (n >>> 16) === 0xC0A8) return 'private (RFC 1918)'; if ((n >>> 16) === 0xA9FE) return 'link-local (169.254/16)'; if (a >= 224 && a < 240) return 'multicast'; if (a >= 240) return 'reserved'; if ((n >>> 22) === 0x191) return 'shared / CGNAT (100.64/10)'; return 'public'; }
  W.subnet = function () {
    var r = wg('Subnet calculator', 'Enter an address and prefix. The blue bits are the network part, the yellow bits are the host part.', 'net');
    var b = addBody(r, '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input type="text" id="sip" value="192.168.1.23" style="' + INP + ';width:170px" aria-label="IP address"><span>/</span><input type="number" id="spl" min="0" max="32" value="24" style="' + INP + ';width:80px" aria-label="Prefix length"></div><dl class="kv" style="margin-top:12px"></dl><div class="mono" style="margin-top:8px;font-size:13px" id="sbin"></div><div style="margin-top:12px"><label>Is this address in the subnet? <input type="text" id="sin" placeholder="192.168.1.99" style="' + INP + ';width:160px"></label> <span id="sres"></span></div>');
    function calc() {
      var ip = ip2n($('#sip', b).value), p = parseInt($('#spl', b).value, 10), kv = $('.kv', b);
      if (ip === null || isNaN(p) || p < 0 || p > 32) { kv.innerHTML = '<dt>Input</dt><dd>Enter a valid IPv4 address and a prefix from 0 to 32.</dd>'; $('#sbin', b).innerHTML = ''; return; }
      var m = maskOf(p), net = (ip & m) >>> 0, bc = (net | (~m >>> 0)) >>> 0, total = Math.pow(2, 32 - p), usable = p >= 31 ? (p === 31 ? 2 : 1) : total - 2;
      kv.innerHTML = [['Network', n2ip(net) + '/' + p], ['Subnet mask', n2ip(m)], ['Wildcard', n2ip(~m >>> 0)], ['Broadcast', p >= 31 ? '(none)' : n2ip(bc)], ['First host', p >= 31 ? n2ip(net) : n2ip(net + 1)], ['Last host', p >= 31 ? n2ip(bc) : n2ip(bc - 1)], ['Usable hosts', usable.toLocaleString()], ['Total addresses', total.toLocaleString()], ['Kind', cls(ip)]].map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('');
      $('#sbin', b).innerHTML = 'address ' + bin32(ip, p) + '<br>mask&nbsp;&nbsp;&nbsp;&nbsp; ' + bin32(m, p);
      var t = ip2n($('#sin', b).value); $('#sres', b).innerHTML = $('#sin', b).value === '' ? '' : t === null ? '<span style="color:var(--bad)">not a valid address</span>' : ((t & m) >>> 0) === net ? '<span style="color:var(--ok)">yes, same network</span>' : '<span style="color:var(--bad)">no, different network (' + n2ip((t & m) >>> 0) + '/' + p + ')</span>';
    }
    b.addEventListener('input', calc); calc(); return r;
  };

  /* ---- CIDR quiz ---- */
  W.cidrquiz = function () {
    var r = wg('Subnetting drills', 'Generated questions. Work them out on paper first (mask, block size, network), then check. Aim for five in a row.', 'net');
    var b = addBody(r, '<div id="cq"></div><div style="margin-top:10px;font:13px var(--font-ui);color:var(--mute)">Streak: <span id="st">0</span> · Best: <span id="bs">0</span></div>');
    var streak = 0, best = 0, cur;
    function rnd(a, z) { return a + Math.floor(Math.random() * (z - a + 1)); }
    function gen() {
      var t = rnd(0, 4), p, ip, m, net, q, ans;
      if (t === 0) { p = rnd(16, 30); q = 'How many <strong>usable hosts</strong> does a <code>/' + p + '</code> network have?'; ans = String(p >= 31 ? 0 : Math.pow(2, 32 - p) - 2); }
      else if (t === 1) { p = rnd(8, 30); q = 'What is the <strong>subnet mask</strong> for <code>/' + p + '</code>? (dotted decimal)'; ans = n2ip(maskOf(p)); }
      else if (t === 2) { p = rnd(20, 29); ip = n2ip((rnd(10, 10) << 24 | rnd(0, 255) << 16 | rnd(0, 255) << 8 | rnd(1, 254)) >>> 0); net = (ip2n(ip) & maskOf(p)) >>> 0; q = 'What is the <strong>network address</strong> of <code>' + ip + '/' + p + '</code>?'; ans = n2ip(net); }
      else if (t === 3) { p = rnd(22, 29); ip = n2ip((192 << 24 | 168 << 16 | rnd(0, 255) << 8 | rnd(1, 254)) >>> 0); net = (ip2n(ip) & maskOf(p)) >>> 0; q = 'What is the <strong>broadcast address</strong> of <code>' + ip + '/' + p + '</code>?'; ans = n2ip((net | (~maskOf(p) >>> 0)) >>> 0); }
      else { var mk = rnd(16, 30); q = 'The mask is <code>' + n2ip(maskOf(mk)) + '</code>. What is the <strong>prefix length</strong>? (just the number)'; ans = String(mk); }
      cur = { q: q, a: ans };
      $('#cq', b).innerHTML = '<p>' + q + '</p><input type="text" id="ca" style="' + INP + ';width:200px" autocomplete="off" autocapitalize="off"> <button class="btn" id="cc">Check</button> <button class="btn sec" id="cn">Another</button><div id="cr" style="margin-top:8px"></div>';
    }
    b.addEventListener('click', function (e) {
      if (e.target.id === 'cn') gen();
      if (e.target.id === 'cc') { var v = $('#ca', b).value.trim().replace(/^\//, ''); var ok = v === cur.a; if (ok) { streak++; best = Math.max(best, streak); } else streak = 0; $('#st', b).textContent = streak; $('#bs', b).textContent = best; $('#cr', b).innerHTML = ok ? '<span style="color:var(--ok)">Correct.</span>' : '<span style="color:var(--bad)">Not quite. Answer: <code>' + esc(cur.a) + '</code></span>'; }
    });
    b.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'ca') $('#cc', b).click(); });
    gen(); return r;
  };

  /* ---- chmod ---- */
  W.chmod = function () {
    var r = wg('Permission calculator', 'Tick boxes, or type an octal mode. Read = 4, write = 2, execute = 1; add them per group.', 'zsh');
    var b = addBody(r, '<div class="tw"><table style="text-align:center"><thead><tr><th></th><th>read (4)</th><th>write (2)</th><th>execute (1)</th><th>digit</th></tr></thead><tbody>' + ['owner (u)', 'group (g)', 'others (o)'].map(function (n, i) { return '<tr><td style="text-align:left">' + n + '</td>' + [0, 1, 2].map(function (j) { return '<td><input type="checkbox" data-g="' + i + '" data-b="' + (2 - j) + '" aria-label="' + n + ' ' + ['read', 'write', 'execute'][j] + '"></td>'; }).join('') + '<td class="mono" data-d="' + i + '"></td></tr>'; }).join('') + '</tbody></table></div><div class="grid2"><label>Octal<br><input type="text" id="oc" value="644" style="' + INP + ';width:100%" maxlength="4"></label><div><div style="font-size:13px;color:var(--mute)">Shown by <code>ls -l</code></div><div class="mono" id="sym" style="font-size:18px"></div></div></div><div class="syn" style="margin-top:10px;display:flex;gap:8px"><span class="mono" id="cmd" style="flex:1;overflow:auto;white-space:pre"></span><button class="cp" id="cp">Copy</button></div><div id="exp" style="margin-top:8px;font-size:14px"></div>');
    var mode = 0o644;
    function draw(skip) {
      var d = [(mode >> 6) & 7, (mode >> 3) & 7, mode & 7];
      $$('[data-g]', b).forEach(function (c) { c.checked = !!(d[+c.getAttribute('data-g')] & (1 << +c.getAttribute('data-b'))); });
      $$('[data-d]', b).forEach(function (c) { c.textContent = d[+c.getAttribute('data-d')]; });
      var sym = d.map(function (x) { return (x & 4 ? 'r' : '-') + (x & 2 ? 'w' : '-') + (x & 1 ? 'x' : '-'); }).join('');
      if (skip !== $('#oc', b)) $('#oc', b).value = mode.toString(8).padStart(3, '0');
      $('#sym', b).textContent = '-' + sym;
      var cmdTxt = 'chmod ' + mode.toString(8).padStart(3, '0') + ' ' + K.val('file'); $('#cmd', b).innerHTML = K.phHTML('chmod ' + mode.toString(8).padStart(3, '0') + ' {{file}}');
      $('#cp', b).onclick = function () { K.copyText(cmdTxt, $('#cp', b)); };
      var who = ['The owner', 'The group', 'Everyone else'], what = function (x) { return x === 0 ? 'has no access' : [x & 4 ? 'read' : '', x & 2 ? 'write' : '', x & 1 ? 'execute' : ''].filter(Boolean).join(', '); };
      $('#exp', b).innerHTML = d.map(function (x, i) { return who[i] + ': ' + what(x) + '.'; }).join('<br>');
    }
    b.addEventListener('change', function (e) { var c = e.target; if (c.getAttribute('data-g') === null) return; var sh = (2 - +c.getAttribute('data-g')) * 3 + +c.getAttribute('data-b'); mode = c.checked ? mode | (1 << sh) : mode & ~(1 << sh); draw(); });
    b.addEventListener('input', function (e) { if (e.target.id === 'oc' && /^[0-7]{3,4}$/.test(e.target.value)) { mode = parseInt(e.target.value, 8) & 0o777; draw(e.target); } });
    draw(); return r;
  };

  /* ---- layers ---- */
  W.layers = function () {
    var r = wg('Packet encapsulation', 'Press "Wrap" to add each layer\'s header around the data, the way your Mac does before sending.', 'net');
    var LAY = [
      { n: 'Application data', c: 'var(--c-zsh)', d: 'HTTP request text: <code>GET / HTTP/1.1\\r\\nHost: example.com</code>. What your program means to say.', f: 'any bytes; here about 80', s: 80 },
      { n: 'TCP segment header', c: 'var(--c-py)', d: 'Source port (random, 49152+), destination port 443/80, sequence and acknowledgment numbers, flags (SYN ACK FIN), window size. Gives reliable, ordered delivery.', f: '20 bytes (more with options)', s: 20 },
      { n: 'IP packet header', c: 'var(--c-net)', d: 'Source IP 192.168.1.23, destination IP 93.184.216.34, TTL, protocol number (6 = TCP). Routers read this layer to move the packet toward the destination.', f: '20 bytes', s: 20 },
      { n: 'Ethernet / Wi-Fi frame header', c: 'var(--c-found)', d: 'Destination MAC (your router for off-LAN traffic), source MAC, EtherType 0x0800 (IPv4), plus a 4-byte checksum trailer. Only valid on the current link.', f: '14 bytes + 4 trailer', s: 18 }
    ];
    var step = 1;
    var b = addBody(r, '<div id="ly"></div><div style="margin-top:10px;display:flex;gap:8px"><button class="btn" id="w">Wrap</button><button class="btn sec" id="u">Unwrap</button></div><div id="lt" style="margin-top:10px;font-size:14px"></div>');
    function draw() {
      var o = '<div style="display:flex;flex-direction:column;align-items:stretch;gap:0">'; var total = 0;
      for (var i = step - 1; i >= 0; i--) { total += LAY[i].s; }
      var inner = '';
      for (var j = 0; j < step; j++) { var l = LAY[j]; inner = '<div style="border:2px solid ' + l.c + ';border-radius:8px;padding:8px;background:var(--panel2)"><div style="font:700 12px var(--font-ui);color:' + l.c + ';margin-bottom:6px">' + l.n + ' · ' + l.f + '</div>' + inner + (j === 0 ? '<div class="mono" style="font-size:12px;color:var(--mute)">GET / HTTP/1.1 …</div>' : '') + '</div>'; }
      $('#ly', b).innerHTML = inner; $('#lt', b).innerHTML = '<strong>' + LAY[step - 1].n + '.</strong> ' + LAY[step - 1].d + '<br><span style="color:var(--mute)">Total on the wire so far: about ' + total + ' bytes.</span>';
      $('#w', b).disabled = step >= LAY.length; $('#u', b).disabled = step <= 1;
    }
    b.addEventListener('click', function (e) { if (e.target.id === 'w' && step < LAY.length) step++; else if (e.target.id === 'u' && step > 1) step--; else return; draw(); });
    draw(); return r;
  };

  /* ---- TCP handshake ---- */
  W.handshake = function () {
    var r = wg('TCP handshake and teardown', 'Step through how two machines open and close a connection. Seq/ack numbers are examples.', 'net');
    var ST = [
      { a: 'CLOSED', b: 'LISTEN', m: null, t: 'The server has called listen() on port 443 and waits. Your Mac has no connection yet.' },
      { a: 'SYN-SENT', b: 'LISTEN', m: ['→', 'SYN', 'seq=1000'], t: 'Your Mac picks an initial sequence number and sends SYN: "I want to talk, my counting starts at 1000."' },
      { a: 'SYN-SENT', b: 'SYN-RECEIVED', m: ['←', 'SYN, ACK', 'seq=5000 ack=1001'], t: 'The server answers SYN+ACK: "Heard you (ack 1001), my counting starts at 5000."' },
      { a: 'ESTABLISHED', b: 'ESTABLISHED', m: ['→', 'ACK', 'seq=1001 ack=5001'], t: 'Your Mac acknowledges. Both sides now agree on both numbers. Three packets, one round trip of waiting. Data can flow.' },
      { a: 'ESTABLISHED', b: 'ESTABLISHED', m: ['→', 'PSH, ACK', 'GET / HTTP/1.1 (len 80)'], t: 'Application data rides inside segments. The server will ack bytes up to 1081.' },
      { a: 'FIN-WAIT-1', b: 'CLOSE-WAIT', m: ['→', 'FIN, ACK', 'seq=1081'], t: 'Your Mac is done sending and starts closing: FIN.' },
      { a: 'FIN-WAIT-2', b: 'CLOSE-WAIT', m: ['←', 'ACK', 'ack=1082'], t: 'The server acknowledges the FIN. It may still send data; TCP closes each direction separately.' },
      { a: 'TIME-WAIT', b: 'LAST-ACK', m: ['←', 'FIN, ACK', 'seq=9200'], t: 'The server finishes and sends its own FIN.' },
      { a: 'TIME-WAIT → CLOSED', b: 'CLOSED', m: ['→', 'ACK', 'ack=9201'], t: 'Final ACK. Your Mac lingers in TIME-WAIT (about 30 to 60 s) so stray late packets cannot corrupt a new connection. That is why <code>netstat</code> shows TIME_WAIT entries.' }
    ];
    var i = 0, timer = 0;
    var b = addBody(r, '<div class="grid2" style="grid-template-columns:1fr 1fr;text-align:center"><div><strong>Your Mac</strong><div class="badge" id="sa" style="margin-top:4px">CLOSED</div></div><div><strong>Server</strong><div class="badge" id="sb" style="margin-top:4px">LISTEN</div></div></div><div id="hs" class="hs" aria-live="polite"></div><div id="ht" style="font-size:14px;min-height:60px;margin-bottom:12px"></div><div style="display:flex;gap:8px"><button class="btn sec" id="p">Back</button><button class="btn" id="n">Next</button><button class="btn sec" id="a">Auto-play</button><button class="btn sec" id="x">Restart</button></div>');
    function draw() {
      $('#sa', b).textContent = ST[i].a; $('#sb', b).textContent = ST[i].b; $('#ht', b).innerHTML = '<strong>Step ' + (i + 1) + ' of ' + ST.length + '.</strong> ' + ST[i].t;
      var o = ''; for (var k = 1; k <= i; k++) { var m = ST[k].m; if (!m) continue; var right = m[0] === '→'; o += '<div class="hs-m ' + (right ? 'r' : 'l') + (k === i ? ' cur' : '') + '"><span class="mono"><strong>' + m[1] + '</strong> ' + esc(m[2]) + '</span></div>'; }
      $('#hs', b).innerHTML = o;
      $('#p', b).disabled = i === 0; $('#n', b).disabled = i === ST.length - 1;
    }
    b.addEventListener('click', function (e) {
      var id = e.target.id; if (!id) return;
      if (id === 'n' && i < ST.length - 1) i++; else if (id === 'p' && i > 0) i--; else if (id === 'x') { i = 0; clearInterval(timer); } else if (id === 'a') { clearInterval(timer); i = 0; draw(); timer = setInterval(function () { if (i < ST.length - 1) { i++; draw(); } else clearInterval(timer); }, 1600); return; } else return;
      clearInterval(timer); draw();
    });
    draw(); return r;
  };

  /* ---- DNS ---- */
  W.dns = function () {
    var r = wg('DNS resolution, step by step', 'Follow one lookup from your browser to the authoritative server and back.', 'net');
    var b = addBody(r, '<label>Name to resolve <input type="text" id="dn" value="www.example.com" style="' + INP + ';width:220px"></label> <label style="margin-left:10px"><input type="checkbox" id="ca"> answer already cached</label><ol id="ds" style="margin-top:12px;padding-left:20px"></ol><div style="display:flex;gap:8px"><button class="btn" id="n">Next step</button><button class="btn sec" id="x">Restart</button></div>');
    var i = 0;
    function steps() {
      var n = $('#dn', b).value.trim().replace(/\.$/, '') || 'www.example.com', parts = n.split('.'), tld = parts[parts.length - 1], dom = parts.slice(-2).join('.');
      if ($('#ca', b).checked) return [['Your Mac checks its own cache', 'The system resolver (<code>mDNSResponder</code>) already has <code>' + n + '</code> from an earlier lookup and answers instantly. No network traffic at all.', 'dscacheutil -q host -a name ' + n]];
      return [
        ['Program asks the stub resolver', 'A program calls <code>getaddrinfo("' + n + '")</code>. macOS checks <code>/etc/hosts</code> and its cache first. Nothing found.', 'cat /etc/hosts'],
        ['Stub asks your configured resolver', 'Your Mac sends a UDP packet to port 53 of the DNS server from DHCP (often the router, 192.168.1.1) asking: "A record for ' + n + '?" with the recursion-desired flag set.', 'scutil --dns | grep nameserver'],
        ['Recursive resolver asks a root server', 'The resolver has no cache entry, so it asks one of the 13 root server addresses: "Who handles <code>.' + tld + '</code>?" The root replies with a referral: the TLD servers\' names and IPs. It does not know ' + n + '.', 'dig +norecurse @a.root-servers.net ' + n],
        ['…then the .' + tld + ' TLD server', 'Resolver asks a <code>.' + tld + '</code> server: "Who handles <code>' + dom + '</code>?" Referral again: the domain\'s own name servers (NS records).', 'dig +short NS ' + dom],
        ['…then the authoritative server', 'Resolver asks <code>ns1.' + dom + '</code> for the A record of <code>' + n + '</code>. This server is the source of truth and answers with the IP and a TTL (how long to cache it).', 'dig ' + n + ' A'],
        ['Answer travels back and is cached', 'The resolver caches the answer for the TTL, returns it to your Mac, which caches it too and hands the IP to your program. Then TCP can connect to that IP.', 'dig +short ' + n]
      ];
    }
    function draw() { var s = steps(); if (i >= s.length) i = s.length - 1; $('#ds', b).innerHTML = s.slice(0, i + 1).map(function (x, k) { return '<li style="margin:8px 0;opacity:' + (k === i ? 1 : .6) + '"><strong>' + x[0] + '.</strong> ' + x[1] + '<div class="syn" style="display:flex;gap:8px;margin-top:4px;font-size:12px"><span>' + esc(x[2]) + '</span><button class="cp" data-copy="' + esc(x[2]) + '">Copy</button></div></li>'; }).join(''); $('#n', b).disabled = i >= s.length - 1; }
    b.addEventListener('click', function (e) { if (e.target.id === 'n') { i++; draw(); } else if (e.target.id === 'x') { i = 0; draw(); } });
    b.addEventListener('input', function () { i = 0; draw(); }); draw(); return r;
  };

  /* ---- HTTP ---- */
  var STAT = { 200: 'OK: the request worked and the body has the result.', 201: 'Created: a new resource now exists.', 204: 'No Content: success with nothing to return.', 301: 'Moved Permanently: use the URL in Location from now on.', 302: 'Found: temporary redirect to Location.', 304: 'Not Modified: your cached copy is still good.', 400: 'Bad Request: the server could not parse what you sent.', 401: 'Unauthorized: authentication is missing or wrong.', 403: 'Forbidden: authenticated or not, you may not do this.', 404: 'Not Found: no resource at that path.', 405: 'Method Not Allowed: this URL does not accept that method.', 429: 'Too Many Requests: slow down (rate limited).', 500: 'Internal Server Error: the server broke while handling it.', 502: 'Bad Gateway: a proxy got a bad answer from the upstream.', 503: 'Service Unavailable: overloaded or down for maintenance.', 504: 'Gateway Timeout: the upstream took too long.' };
  W.http = function () {
    var r = wg('HTTP message anatomy', 'Edit the request and see the raw text your client really sends. Click a status code for its meaning.', 'net');
    var b = addBody(r, '<div class="grid2"><label>Method<br><select id="m" style="' + INP + ';width:100%"><option>GET</option><option>POST</option><option>HEAD</option><option>PUT</option><option>DELETE</option></select></label><label>Host<br><input type="text" id="h" value="example.com" style="' + INP + ';width:100%"></label><label>Path<br><input type="text" id="p" value="/index.html?q=net" style="' + INP + ';width:100%"></label></div><div class="cb" style="margin-top:10px"><div class="bar"><span>request (what curl -v shows after ">")</span></div><pre id="rq"></pre></div><div class="cb"><div class="bar"><span>typical response</span></div><pre id="rs"></pre></div><div id="sc" style="margin:8px 0"></div><div class="mono" id="sd" style="font-size:14px;font-family:var(--font-ui)"></div>');
    function draw() {
      var m = $('#m', b).value, p = $('#p', b).value || '/', host = $('#h', b).value || 'example.com', body = m === 'POST' || m === 'PUT' ? '{"name":"pi"}' : '';
      $('#rq', b).innerHTML = '<span class="t-cmd">' + m + '</span> ' + esc(p) + ' <span class="t-dim">HTTP/1.1</span>\n<span class="t-flag">Host:</span> ' + esc(host) + '\n<span class="t-flag">User-Agent:</span> curl/8.7.1\n<span class="t-flag">Accept:</span> */*' + (body ? '\n<span class="t-flag">Content-Type:</span> application/json\n<span class="t-flag">Content-Length:</span> ' + body.length : '') + '\n\n' + esc(body);
      $('#rs', b).innerHTML = '<span class="t-dim">HTTP/1.1</span> <span class="t-num">200 OK</span>\n<span class="t-flag">Content-Type:</span> text/html; charset=UTF-8\n<span class="t-flag">Content-Length:</span> 1256\n<span class="t-flag">Cache-Control:</span> max-age=604800\n\n' + (m === 'HEAD' ? '(no body for HEAD)' : '&lt;!doctype html&gt;…');
    }
    $('#sc', b).innerHTML = Object.keys(STAT).map(function (c) { return '<button class="chip" data-s="' + c + '">' + c + '</button>'; }).join(' ');
    b.addEventListener('click', function (e) { var s = e.target.getAttribute('data-s'); if (s) $('#sd', b).innerHTML = '<strong>' + s + '</strong> ' + esc(STAT[s]); });
    b.addEventListener('input', draw); draw(); return r;
  };

  /* ---- ports ---- */
  var PORTS = [[20, 'tcp', 'FTP data', 'legacy file transfer'], [21, 'tcp', 'FTP control', 'legacy, unencrypted'], [22, 'tcp', 'SSH', 'secure shell, scp, sftp'], [23, 'tcp', 'Telnet', 'unencrypted remote shell; avoid'], [25, 'tcp', 'SMTP', 'mail server to server'], [53, 'tcp/udp', 'DNS', 'name lookups (UDP mostly, TCP for big answers)'], [67, 'udp', 'DHCP server', 'hands out IP addresses'], [68, 'udp', 'DHCP client', 'your Mac asking for a lease'], [80, 'tcp', 'HTTP', 'plain web'], [110, 'tcp', 'POP3', 'old mail download'], [123, 'udp', 'NTP', 'time sync'], [143, 'tcp', 'IMAP', 'mail access'], [161, 'udp', 'SNMP', 'device monitoring'], [389, 'tcp', 'LDAP', 'directory service'], [443, 'tcp', 'HTTPS', 'web over TLS'], [445, 'tcp', 'SMB', 'Windows/NAS file sharing'], [465, 'tcp', 'SMTPS', 'mail submission over TLS'], [514, 'udp', 'syslog', 'log shipping'], [548, 'tcp', 'AFP', 'old Mac file sharing'], [587, 'tcp', 'SMTP submission', 'mail clients to server'], [631, 'tcp', 'IPP / CUPS', 'printing'], [993, 'tcp', 'IMAPS', 'mail over TLS'], [995, 'tcp', 'POP3S', 'mail over TLS'], [1883, 'tcp', 'MQTT', 'IoT messaging'], [3306, 'tcp', 'MySQL', 'database'], [3389, 'tcp', 'RDP', 'Windows remote desktop'], [5000, 'tcp', 'AirPlay / Flask', 'on macOS AirPlay Receiver uses it'], [5353, 'udp', 'mDNS / Bonjour', '.local name discovery'], [5432, 'tcp', 'PostgreSQL', 'database'], [5900, 'tcp', 'VNC / Screen Sharing', 'remote screen'], [6379, 'tcp', 'Redis', 'cache/database'], [8000, 'tcp', 'dev web server', 'python3 -m http.server'], [8080, 'tcp', 'HTTP alternate', 'proxies, dev servers'], [8123, 'tcp', 'Home Assistant', 'home automation UI'], [8443, 'tcp', 'HTTPS alternate', 'admin panels'], [9100, 'tcp', 'JetDirect', 'raw printing'], [27017, 'tcp', 'MongoDB', 'database']];
  W.ports = function () {
    var r = wg('Well-known ports', 'Filter by number or name. The last column is a test you can run against a machine you own.', 'net');
    var b = addBody(r, '<input type="search" id="pq" placeholder="22, https, database…" style="' + INP + ';width:100%;max-width:340px"><div class="tw ports-tw"><table><thead><tr><th>Port</th><th>Proto</th><th>Service</th><th>Notes</th><th>Test</th></tr></thead><tbody></tbody></table></div>');
    function draw() { var q = $('#pq', b).value.toLowerCase(); $('tbody', b).innerHTML = PORTS.filter(function (p) { return !q || (p.join(' ').toLowerCase().indexOf(q) >= 0); }).map(function (p) { return '<tr><td><strong>' + p[0] + '</strong></td><td>' + p[1] + '</td><td>' + esc(p[2]) + '</td><td>' + esc(p[3]) + '</td><td class="pt"><code>nc -zv {{host}} ' + p[0] + '</code><button class="cp" data-copy="nc -zv {{host}} ' + p[0] + '">Copy</button></td></tr>'; }).join(''); $$('tbody code', b).forEach(function (c) { c.innerHTML = K.phHTML(c.textContent); }); }
    b.addEventListener('input', draw); draw(); return r;
  };

  /* ---- regex ---- */
  W.regex = function () {
    var r = wg('Regex tester', 'Matches are highlighted live. The engine here is JavaScript\'s, which agrees with Python\'s <code>re</code> and <code>grep -E</code> for everything this book teaches (note: <code>\\d</code> and <code>\\w</code> do not exist in macOS <code>grep -E</code>; use <code>[0-9]</code>).', 'zsh');
    var b = addBody(r, '<label>Pattern <input type="text" id="re" value="\\b(\\d{1,3}\\.){3}\\d{1,3}\\b" style="' + INP + ';width:min(100%,380px)"></label> <label style="margin-left:8px"><input type="checkbox" id="fi"> ignore case</label><textarea class="ed" id="tx" style="min-height:110px;margin-top:8px">203.0.113.7 - - [07/Oct/2026:09:14:08] "GET /index.html" 200\nconnect from 10.0.0.12 port 22\nno address here\n</textarea><div class="cb" style="margin-top:8px"><div class="bar"><span>matches</span><span class="sp"></span><span id="cn"></span></div><pre id="hl"></pre></div><div id="gl" class="mono" style="font-size:13px"></div>');
    function draw() {
      var src = $('#re', b).value, txt = $('#tx', b).value, re;
      try { re = new RegExp(src, 'g' + ($('#fi', b).checked ? 'i' : '')); } catch (e) { $('#hl', b).innerHTML = '<span class="a-r">' + esc(e.message) + '</span>'; $('#cn', b).textContent = ''; $('#gl', b).textContent = ''; return; }
      var o = '', last = 0, m, n = 0, groups = [];
      while ((m = re.exec(txt))) { if (m[0] === '') { re.lastIndex++; continue; } n++; o += esc(txt.slice(last, m.index)) + '<mark style="background:var(--ph-bg);color:var(--ph);border-radius:3px">' + esc(m[0]) + '</mark>'; last = re.lastIndex; if (m.length > 1 && groups.length < 8) groups.push('match ' + n + ': ' + m.slice(1).map(function (g, i) { return 'group ' + (i + 1) + '=' + JSON.stringify(g === undefined ? null : g); }).join(', ')); if (n > 500) break; }
      $('#hl', b).innerHTML = o + esc(txt.slice(last)); $('#cn', b).textContent = n + ' match' + (n === 1 ? '' : 'es'); $('#gl', b).innerHTML = groups.map(esc).join('<br>');
    }
    b.addEventListener('input', draw); draw(); return r;
  };

  /* ---- ASCII ---- */
  W.ascii = function () {
    var r = wg('ASCII table', 'Every character is a number. Click one for its codes, or type text to see its bytes.', 'found');
    var b = addBody(r, '<input type="text" id="at" value="Hi!" style="' + INP + ';width:220px"><div class="mono" id="ab" style="margin:8px 0;font-size:13px;word-break:break-all"></div><div id="ag" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:4px"></div><div id="ai" style="margin-top:8px;font:14px var(--font-ui)"></div>');
    var CTRL = ['NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'TAB', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI', 'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US'];
    function nm(n) { return n < 32 ? CTRL[n] : n === 32 ? 'SP' : n === 127 ? 'DEL' : String.fromCharCode(n); }
    $('#ag', b).innerHTML = Array.apply(null, { length: 128 }).map(function (_, i) { return '<button class="chip" data-n="' + i + '" style="border-radius:6px;padding:4px;text-align:center;font-family:var(--font-mono)">' + esc(nm(i)) + '<br><small style="color:var(--dim)">' + i + '</small></button>'; }).join('');
    function txt() { var t = $('#at', b).value; $('#ab', b).innerHTML = Array.from(unescape(encodeURIComponent(t))).map(function (c) { var n = c.charCodeAt(0); return esc(nm(n)) + '=' + n + '/0x' + n.toString(16).padStart(2, '0'); }).join('&nbsp; ') || '(type something)'; }
    b.addEventListener('input', txt); b.addEventListener('click', function (e) { var c = e.target.closest('[data-n]'); if (!c) return; var n = +c.getAttribute('data-n'); $('#ai', b).innerHTML = '<strong>' + esc(nm(n)) + '</strong>: decimal ' + n + ', hex 0x' + n.toString(16).padStart(2, '0') + ', binary ' + n.toString(2).padStart(8, '0') + ', octal ' + n.toString(8) + (n >= 65 && n <= 90 ? ' <br>Upper case letters differ from lower case by 32 (one bit: 0x20).' : '') + (n === 10 ? '<br>LF is the line ending on macOS and Linux; Windows uses CR+LF.' : ''); });
    txt(); return r;
  };

  /* ---- troubleshooting flowchart ---- */
  var TR = {
    start: { q: 'Something on the network is not working. What do you see?', o: [['A website will not load, but other things work', 'web'], ['Nothing works (no websites, no apps)', 'none'], ['I cannot reach one machine on my LAN (Pi, NAS, printer)', 'lan'], ['Everything works but it is slow', 'slow']] },
    none: { q: 'Is Wi-Fi connected and do you have an IP address?', c: 'ipconfig getifaddr en0', o: [['No address printed', 'noip'], ['It prints something like 192.168.x.x', 'gw']] },
    noip: { a: 'No address means DHCP failed or you are not on the network.', s: ['Toggle Wi-Fi off and on', 'Renew the lease: System Settings > Network > Wi-Fi > Details > TCP/IP > Renew DHCP Lease', 'Check you joined the right network and reboot the router if every device is affected'], c: 'networksetup -getinfo Wi-Fi' },
    gw: { q: 'Can you ping your router (the gateway)?', c: 'ping -c 3 $(route -n get default | awk \'/gateway:/ {print $2}\')', o: [['No replies', 'gwdown'], ['Replies come back', 'inet']] },
    gwdown: { a: 'You have an address but cannot reach the router: a Layer 1/2 problem.', s: ['Move closer or switch bands; check signal with the Wi-Fi menu (Option-click)', 'Cable/port problem if wired', 'Check the router is on; look for a VPN or firewall tool blocking local traffic'], c: 'netstat -rn | head' },
    inet: { q: 'Can you ping a public IP address (1.1.1.1)?', c: 'ping -c 3 1.1.1.1', o: [['No replies', 'wan'], ['Replies come back', 'dnsq']] },
    wan: { a: 'The LAN works but nothing leaves it: the router has no internet.', s: ['Check the router\'s WAN light and status page', 'Restart the modem and router (wait two minutes)', 'Call your ISP if the WAN link stays down'], c: 'traceroute -n 1.1.1.1' },
    dnsq: { q: 'Does a name resolve?', c: 'dig +short example.com', o: [['Nothing / error', 'dnsbad'], ['An IP address prints', 'web']] },
    dnsbad: { a: 'Pings to IPs work, names do not: DNS is broken.', s: ['Query a public resolver directly: dig @1.1.1.1 example.com', 'If that works, your router or ISP resolver is at fault: set 1.1.1.1 in Network settings', 'Flush the cache: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder'], c: 'scutil --dns | grep nameserver' },
    web: { q: 'Name resolves, ping works. Does curl reach the site?', c: 'curl -sI https://example.com | head -1', o: [['curl hangs or fails to connect', 'port'], ['curl prints HTTP/2 200 (or similar)', 'browser'], ['curl prints 4xx / 5xx', 'srv']] },
    port: { a: 'IP is reachable but the port is blocked or the service is down.', s: ['Test the port: nc -zv host 443', 'A firewall or VPN may filter it; try another network or disable the VPN', 'If it is your own server, check the service is listening: lsof -i :443'], c: 'nc -zv example.com 443' },
    browser: { a: 'The network is fine; the problem is in the browser.', s: ['Try a private window (extensions off)', 'Clear that site\'s cache and cookies', 'Check proxy settings in System Settings > Network > Proxies'], c: 'networksetup -getwebproxy Wi-Fi' },
    srv: { a: 'You reached the server and it answered with an error: the fault is on its side (5xx) or your request (4xx).', s: ['403/401: you lack permission or must log in', '404: the path is wrong', '5xx: wait and retry; nothing for you to fix'], c: 'curl -i https://example.com/missing | head -5' },
    lan: { q: 'Can you ping that machine by IP?', c: 'ping -c 3 {{labhost}}', o: [['Replies come back', 'lanport'], ['No replies', 'lanarp']] },
    lanport: { a: 'It is reachable; the service may be down or on another port.', s: ['Scan its common ports: nmap -p 22,80,443 host (only your own machines)', 'Check the service on the machine itself'], c: 'nc -zv {{labhost}} 22' },
    lanarp: { q: 'Is the machine in your ARP table?', c: 'arp -a | grep {{labhost}}', o: [['"(incomplete)" or missing', 'lanoff'], ['A MAC address shows', 'lanfw']] },
    lanoff: { a: 'Nobody answered ARP: it is off, unplugged, on another subnet or Wi-Fi network.', s: ['Check power and cable', 'Confirm you are both on the same subnet (same first three numbers for a /24)', 'Check the router\'s device list'], c: 'ifconfig en0 | grep inet' },
    lanfw: { a: 'It answers ARP (it is alive) but ignores ping: probably a firewall dropping ICMP.', s: ['Try connecting to a real service port instead of ping', 'Check the machine\'s firewall rules'], c: 'nc -zv {{labhost}} 22' },
    slow: { q: 'Slow to everything, or only some sites?', o: [['Everything is slow', 'slowall'], ['One site', 'slowone']] },
    slowall: { a: 'Measure before guessing.', s: ['Ping the router for latency spikes and loss', 'Ping 1.1.1.1; compare latency', 'Run networkQuality for a throughput test', 'Wi-Fi interference or a busy channel is the most common cause'], c: 'networkQuality' },
    slowone: { a: 'Find where the delay is.', s: ['traceroute shows which hop adds latency', 'curl -w timing shows DNS vs connect vs transfer time'], c: 'curl -so /dev/null -w "dns=%{time_namelookup} connect=%{time_connect} total=%{time_total}\\n" https://example.com' }
  };
  W.trouble = function () {
    var r = wg('Troubleshooting flowchart', 'Answer the question, run the suggested command, pick what you saw. Work from the bottom of the network stack upward.', 'net');
    var b = addBody(r, '<div class="flow"></div>'), path = ['start'];
    function draw() {
      var o = ''; path.forEach(function (id, i) {
        var n = TR[id], last = i === path.length - 1;
        o += '<div class="nd" style="opacity:' + (last ? 1 : .6) + '">' + (n.q ? '<strong>' + K.inl(n.q) + '</strong>' : '<strong style="color:var(--c-py)">' + K.inl(n.a) + '</strong>') + (n.c ? '<div class="syn" style="display:flex;gap:8px;margin-top:8px;font-size:12.5px"><span>' + K.phHTML(n.c) + '</span><button class="cp" data-copy="' + esc(n.c) + '">Copy</button></div>' : '');
        if (n.s && last) o += '<ul style="margin:8px 0 0">' + n.s.map(function (x) { return '<li>' + K.inl(x) + '</li>'; }).join('') + '</ul>';
        if (n.o && last) o += '<div class="ch">' + n.o.map(function (x) { return '<button class="btn sec" data-go="' + x[1] + '">' + esc(x[0]) + '</button>'; }).join('') + '</div>';
        o += '</div>';
      });
      $('.flow', b).innerHTML = o + (path.length > 1 ? '<button class="btn sec" id="rs">Start over</button>' : '');
    }
    b.addEventListener('click', function (e) { var g = e.target.getAttribute('data-go'); if (g) { path.push(g); draw(); } else if (e.target.id === 'rs') { path = ['start']; draw(); } });
    draw(); return r;
  };
})();

/* Web part: in-page JavaScript runner, HTML/CSS/JS playground with a DevTools drawer, and web widgets. */
(function () {
  'use strict';
  var K = window.__core, $ = K.$, $$ = K.$$, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};
  var SB = window.__SBSRC || '';
  var tokN = 0, handlers = {};
  window.addEventListener('message', function (ev) { var m = ev.data; if (!m || !m.__pp || !handlers[m.__pp]) return; var hd = handlers[m.__pp]; if (hd.frame && ev.source !== hd.frame.contentWindow) return; hd.fn(m); });

  /* Insert a watchdog call at the top of every braced loop body so an endless loop throws instead of freezing the tab. */
  function loopGuard(code) {
    var o = '', i = 0, n = code.length, prevSig = '';
    function skipStr(q) { var j = i + 1; while (j < n && code[j] !== q) { if (code[j] === '\\') j++; else if (q === '`' && code[j] === '$' && code[j + 1] === '{') { var d = 1; j += 2; while (j < n && d) { if (code[j] === '{') d++; else if (code[j] === '}') d--; if (d) j++; } } j++; } return j + 1; }
    while (i < n) {
      var c = code[i];
      if (c === '/' && code[i + 1] === '/') { var e = code.indexOf('\n', i); if (e < 0) e = n; o += code.slice(i, e); i = e; continue; }
      if (c === '/' && code[i + 1] === '*') { var e2 = code.indexOf('*/', i + 2); e2 = e2 < 0 ? n : e2 + 2; o += code.slice(i, e2); i = e2; continue; }
      if (c === '"' || c === "'" || c === '`') { var j = skipStr(c); o += code.slice(i, j); i = j; prevSig = 'x'; continue; }
      if (c === '/' && /^[(,=:[!&|?{};+\-*%<>~^]?$/.test(prevSig)) { var k = i + 1, cls = false; while (k < n && code[k] !== '\n') { if (code[k] === '\\') k++; else if (code[k] === '[') cls = true; else if (code[k] === ']') cls = false; else if (code[k] === '/' && !cls) break; k++; } if (code[k] === '/') { k++; while (/[a-z]/i.test(code[k] || '')) k++; o += code.slice(i, k); i = k; prevSig = 'x'; continue; } }
      var m = /^(for|while|do)\b/.exec(code.slice(i, i + 6));
      if (m && !/[\w$.]/.test(code[i - 1] || '')) {
        var kw = m[1]; o += kw; i += kw.length;
        if (kw === 'do') { var ws = /^\s*/.exec(code.slice(i))[0]; if (code[i + ws.length] === '{') { o += ws + '{__ppG();'; i += ws.length + 1; } prevSig = '{'; continue; }
        var ws1 = /^\s*(await\s*)?/.exec(code.slice(i))[0];
        if (code[i + ws1.length] !== '(') { continue; }
        o += ws1; i += ws1.length; var depth = 0, st = i;
        while (i < n) { var ch = code[i]; if (ch === '"' || ch === "'" || ch === '`') { i = skipStr(ch); continue; } if (ch === '(') depth++; else if (ch === ')') { depth--; if (!depth) { i++; break; } } i++; }
        o += code.slice(st, i);
        var ws2 = /^\s*/.exec(code.slice(i))[0];
        if (code[i + ws2.length] === '{') { o += ws2 + '{__ppG();'; i += ws2.length + 1; prevSig = '{'; }
        continue;
      }
      o += c; if (!/\s/.test(c)) prevSig = /[\w$)\]]/.test(c) ? 'x' : c; i++;
    }
    return o;
  }
  K.loopGuard = loopGuard;

  /* ---------- sandbox frames ---------- */
  var BASECSS = 'html{color-scheme:light}body{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;margin:12px;color:#1d2a31;background:#fff}';
  function scriptSafe(s) { return String(s || '').replace(/<\/script/gi, '<\\/script'); }
  function frameDoc(o, tok) {
    var js = o.js ? loopGuard(o.js) : '';
    var user = js ? (o.module ? '<script type="module">' + scriptSafe(js) + '\n;window.__ppMainDone();<\/script>' : '<script>' + scriptSafe(js) + '\n<\/script><script data-pp>window.__ppMainDone();<\/script>') : '<script data-pp>window.__ppMainDone();<\/script>';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<script data-pp>window.__ppTok=' + JSON.stringify(tok) + ';<\/script><script data-pp>' + scriptSafe(SB) + '<\/script>' +
      '<style data-pp>' + BASECSS + '</style>' + (o.css ? '<style>' + o.css + '</style>' : '') + (o.title ? '<title>' + esc(o.title) + '</title>' : '') +
      '</head><body>' + (o.html || '') + user + '</body></html>';
  }
  function makeFrame(o, onMsg) {
    Object.keys(handlers).forEach(function (k) { var x = handlers[k].frame; if (x && x.__added && !x.isConnected) delete handlers[k]; });
    var tok = 'pp' + (++tokN) + '-' + Math.random().toString(36).slice(2, 8);
    var f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts allow-forms');
    f.setAttribute('title', o.title || 'Playground preview');
    f.className = 'wl-frame';
    handlers[tok] = { frame: f, fn: onMsg };
    f.srcdoc = frameDoc(o, tok);
    f.__tok = tok; setTimeout(function () { f.__added = true; }, 0);
    f.__send = function (m) { m.__pp = tok; try { f.contentWindow.postMessage(m, '*'); } catch (e) { } };
    f.__dispose = function () { delete handlers[tok]; f.remove(); };
    return f;
  }
  /* Run a program headless. Resolves {out, logs, uncaught, status: ok|error|timeout} */
  function runJS(code, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var logs = [], uncaught = null, done = false, holder = opts.holder || document.body, f, tmo;
      function finish(status, msg) {
        if (done) return; done = true; clearTimeout(tmo);
        var out = logs.filter(function (l) { return !l.sys && !l.uncaught && !l.check; }).map(function (l) { return l.text + '\n'; }).join('');
        if (!opts.keep) setTimeout(function () { f.__dispose(); }, 0);
        resolve({ out: out, logs: logs, uncaught: uncaught, status: uncaught && status !== 'timeout' ? 'error' : status, msg: msg || '' });
      }
      f = makeFrame({ js: code, html: opts.page || '', css: opts.css || '', module: opts.module !== false }, function (m) {
        if (m.t === 'log') { logs.push(m); if (m.uncaught) uncaught = m.text; if (opts.onLog) opts.onLog(m); }
        else if (m.t === 'clear') { logs = []; }
        else if (m.t === 'done') {
          if (opts.check && !uncaught) f.__send({ t: 'eval', id: 'check', awaitResult: true, code: '(async () => { const out = window.__ppOut(); const assert = (c, m) => { if (!c) throw new Error(m || "The check did not pass."); };\n' + opts.check + '\n})()' });
          else finish('ok');
        }
        else if (m.t === 'evalres' && m.id === 'check') finish(m.err ? 'fail' : 'pass', m.err ? m.text.replace(/^Uncaught (Error: )?/, '') : '');
        else if (m.t === 'size' && opts.visible) f.style.height = Math.min(Math.max(m.h + 4, 60), 460) + 'px';
        else if (m.t === 'net' && opts.onNet) opts.onNet(m.rec);
      });
      if (opts.visible) { f.classList.add('wl-show'); holder.appendChild(f); } else { f.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:0;border:0'; holder.appendChild(f); }
      tmo = setTimeout(function () { logs.push({ level: 'error', text: 'Stopped: the program was still running after ' + ((opts.timeout || 8000) / 1000) + ' seconds (an endless loop, an open interval, or a promise that never settles?).', sys: 1 }); finish('timeout'); }, opts.timeout || 8000);
    });
  }
  window.__js = { run: runJS, makeFrame: makeFrame };

  /* ---------- console rendering ---------- */
  function logLine(m) {
    var cls = m.level === 'error' ? 'e' : m.level === 'warn' ? 'w' : (m.level === 'info' || m.level === 'debug') ? 'i' : '';
    if (m.kind === 'in') return '<div class="cl in"><span class="ch">›</span>' + K.hlJs(m.text) + '</div>';
    if (m.kind === 'res') return '<div class="cl cres' + (m.err ? ' e' : '') + '"><span class="ch">‹</span>' + esc(m.text) + '</div>';
    return '<div class="cl ' + cls + (m.sys ? ' sys' : '') + '">' + esc(m.text) + '</div>';
  }

  /* ---------- jsrun box (and JS exercises) ---------- */
  K.jsBox = function (b, ex) {
    var exp = b.out === undefined ? '' : b.out;
    var label = b.page ? 'JavaScript + page (runs in your browser)' : 'JavaScript (runs in your browser)';
    return '<div class="runbox jsbox" data-jsrun data-module="' + (b.attrs && b.attrs.classic ? 0 : 1) + '"' + (b.page ? ' data-page="' + esc(b.page) + '"' : '') + '><div class="bar"><span>' + label + '</span><span class="sp"></span><button class="btn" data-jsact="run">Run</button><button class="btn sec" data-jsact="reset">Reset</button></div>' +
      '<textarea class="ed js" spellcheck="false" data-orig="' + esc(b.code) + '">' + esc(b.code) + '</textarea>' +
      (b.page ? '<div class="jspage"></div>' : '') + '<div class="res jsres"></div>' +
      (exp !== '' ? '<details><summary>Expected output</summary><pre style="margin:6px 0;font:13px var(--font-mono);white-space:pre-wrap">' + esc(exp) + '</pre></details>' : '') + '</div>';
  };
  function showRes(box, r, mode) {
    var el = $('.jsres', box) || $('.res', box);
    el.className = 'res jsres show' + (r.status === 'ok' || r.status === 'pass' ? (mode === 'check' ? ' pass' : '') : ' fail');
    var html = r.logs.filter(function (l) { return !l.check; }).map(logLine).join('');
    if (r.status === 'fail') html += '<div class="cl e">✗ ' + esc(r.msg || 'The check did not pass.') + '</div>';
    if (r.status === 'pass') html += '<div class="cl okk">✓ All checks passed.</div>';
    if (!html) html = '<div class="cl sys">(the program printed nothing)</div>';
    el.innerHTML = html;
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-jsact]'); if (!btn) return;
    var box = btn.closest('[data-jsrun]') || btn.closest('[data-jsex]'), ta = $('textarea.ed', box), act = btn.getAttribute('data-jsact');
    if (act === 'reset') { ta.value = ta.getAttribute('data-orig'); var r0 = $('.res', box); if (r0) { r0.className = 'res jsres'; r0.innerHTML = ''; } var pg0 = $('.jspage', box); if (pg0) pg0.innerHTML = ''; return; }
    var exId = box.getAttribute('data-jsex'), check = '', page = box.getAttribute('data-page') || '';
    if (act === 'check') { var exb = findEx(exId); check = exb ? exb.check : ''; page = exb && exb.page ? exb.page : page; }
    var holder = $('.jspage', box); if (holder) holder.innerHTML = '';
    var old = btn.textContent; btn.disabled = true; btn.textContent = 'Running…';
    runJS(ta.value, { module: exId ? false : box.getAttribute('data-module') !== '0', page: page, check: check || null, visible: !!(holder && page), holder: holder || undefined, keep: !!(holder && page) }).then(function (r) {
      btn.disabled = false; btn.textContent = old; showRes(box, r, act);
      if (act === 'check' && r.status === 'pass') { K.S.done[exId] = 1; K.save(); var cb = document.querySelector('[data-done="' + exId + '"]'); if (cb) cb.checked = true; K.updateProgress(); }
    });
  });
  function findEx(id) { var f = null; K.CH.forEach(function (c) { (function w(bl) { (bl || []).forEach(function (b) { if (b.t === 'exercise' && b.id === id) f = b; if (b.blocks) w(b.blocks); }); })(c.blocks); }); return f; }

  /* ---------- WebLab: editors + preview + DevTools drawer ---------- */
  function splitSections(code) {
    var o = { html: '', css: '', js: '' }, cur = 'html', buf = [];
    String(code || '').split('\n').forEach(function (l) { var m = /^---\s*(html|css|js)\s*$/.exec(l); if (m) { o[cur] = buf.join('\n').replace(/^\n+|\n+$/g, ''); buf = o[m[1]] ? [o[m[1]]] : []; cur = m[1]; } else buf.push(l); });
    o[cur] = buf.join('\n').replace(/^\n+|\n+$/g, '');
    return o;
  }
  W.weblab = function (args) {
    var a = args.attrs || {}, kind = args.kind || 'webplay', src = splitSections(args.code);
    var orig = { html: src.html, css: src.css, js: src.js };
    var showEd = kind === 'webplay' && a.editors !== 'none';
    var edTabs = (a.tabs || 'html,css,js').split(',').filter(function (t) { return t === 'html' || t === 'css' || t === 'js'; });
    var tools = (a.devtools || 'console,elements,network,storage').split(',');
    var root = h('div', { class: 'wl' });
    var title = a.title || (kind === 'devtools' ? 'Practice page with DevTools' : 'Live HTML, CSS and JavaScript');
    root.innerHTML = '<div class="wl-hd"><span class="wl-t">' + esc(title) + '</span><span class="sp"></span>' + (showEd ? '<label class="wl-auto"><input type="checkbox" data-auto' + (a.auto === 'off' ? '' : ' checked') + '> live</label>' : '') + '<button class="btn" data-wl="run">' + (showEd ? 'Run' : 'Reload page') + '</button>' + (showEd ? '<button class="btn sec" data-wl="reset">Reset</button>' : '') + '</div>' +
      (showEd ? '<div class="wl-tabs" role="tablist">' + edTabs.map(function (t, i) { return '<button role="tab" class="wl-tab' + (i === 0 ? ' on' : '') + '" data-ed="' + t + '">' + t.toUpperCase() + '</button>'; }).join('') + '</div>' + edTabs.map(function (t, i) { return '<textarea class="ed wl-ed" spellcheck="false" data-edt="' + t + '"' + (i === 0 ? '' : ' hidden') + ' aria-label="' + t + ' editor">' + esc(src[t]) + '</textarea>'; }).join('') : '') +
      '<div class="wl-pv"><div class="wl-url"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="u">http://lab.local/' + esc(a.path || 'index.html') + '</span></div><div class="wl-fh"></div></div>' +
      '<div class="wl-dt"><div class="wl-dtabs">' + tools.map(function (t, i) { return '<button class="wl-dtab' + ((a.open || tools[0]) === t ? ' on' : '') + '" data-dt="' + t + '">' + ({ console: 'Console', elements: 'Elements', network: 'Network', storage: 'Storage' })[t] + (t === 'console' ? ' <span class="cnt" data-cnt></span>' : t === 'network' ? ' <span class="cnt" data-ncnt></span>' : '') + '</button>'; }).join('') + '<span class="sp"></span><button class="wl-x" data-wl="clear" title="Clear console">Clear</button></div>' +
      '<div class="wl-pane" data-pane="console"' + ((a.open || tools[0]) === 'console' ? '' : ' hidden') + '><div class="wl-log" aria-live="polite"></div><div class="wl-in"><span class="ch">›</span><textarea rows="1" spellcheck="false" placeholder="Type JavaScript and press Enter. $0, $(), $$() and copy() work here." aria-label="Console input"></textarea></div></div>' +
      '<div class="wl-pane" data-pane="elements"' + ((a.open || tools[0]) === 'elements' ? '' : ' hidden') + '><div class="wl-el"><div class="wl-tree"></div><div class="wl-side"><div class="wl-side-h">Select an element in the tree, then type <code>$0</code> in the Console.</div></div></div></div>' +
      '<div class="wl-pane" data-pane="network"' + ((a.open || tools[0]) === 'network' ? '' : ' hidden') + '><div class="tw"><table class="wl-net"><thead><tr><th>Method</th><th>URL</th><th>Status</th><th>Type</th><th>Size</th><th>Time</th></tr></thead><tbody></tbody></table></div><div class="wl-netd"></div><p class="wl-hint">Requests to <code>/api/...</code> go to a practice server built into this page (see the API list in the Web chapters). Nothing leaves your browser.</p></div>' +
      '<div class="wl-pane" data-pane="storage"' + ((a.open || tools[0]) === 'storage' ? '' : ' hidden') + '><div class="wl-st"></div></div>' +
      '</div>';
    (function () { var eds = $$('.wl-ed', root); if (!eds.length) return; var ml = Math.max.apply(null, eds.map(function (t) { return t.value.split('\n').length; })); eds.forEach(function (t) { t.setAttribute('data-fixed', ''); t.style.height = Math.min(Math.max(ml + 1, 6) * 20.5 + 24, 440) + 'px'; }); })();
    var frame = null, nErr = 0, nLog = 0, nNet = 0, netRecs = [], hist = [], hi = 0, evalN = 0, selId = 0, autoT = null;
    var logEl = $('.wl-log', root), fh = $('.wl-fh', root);
    function addLog(m) { if (m.t === 'clear') { logEl.innerHTML = ''; nErr = nLog = 0; cnt(); return; } logEl.insertAdjacentHTML('beforeend', logLine(m)); nLog++; if (m.level === 'error') nErr++; cnt(); logEl.scrollTop = logEl.scrollHeight; }
    function cnt() { var c = $('[data-cnt]', root); if (c) c.textContent = nErr ? nErr + ' error' + (nErr > 1 ? 's' : '') : nLog ? String(nLog) : ''; var n = $('[data-ncnt]', root); if (n) n.textContent = nNet ? String(nNet) : ''; }
    function code() { var o = {}; ['html', 'css', 'js'].forEach(function (t) { var ta = $('[data-edt="' + t + '"]', root); o[t] = ta ? ta.value : src[t]; }); return o; }
    function load() {
      if (frame) frame.__dispose();
      logEl.innerHTML = ''; nErr = nLog = 0; nNet = 0; netRecs = []; $('.wl-net tbody', root).innerHTML = ''; $('.wl-netd', root).innerHTML = ''; selId = 0; cnt();
      var c = code();
      frame = makeFrame({ html: c.html, css: c.css, js: c.js, module: a.module === 'on', title: title }, onMsg);
      frame.classList.add('wl-show'); frame.style.height = (a.height || 220) + 'px';
      fh.appendChild(frame);
    }
    function onMsg(m) {
      if (m.t === 'log' || m.t === 'clear') addLog(m);
      else if (m.t === 'evalres') addLog({ kind: 'res', text: m.text, err: m.err });
      else if (m.t === 'size') { if (!a.height) frame.style.height = Math.min(Math.max(m.h + 6, 80), 420) + 'px'; }
      else if (m.t === 'net') addNet(m.rec);
      else if (m.t === 'snap') drawTree(m.tree, m.sel);
      else if (m.t === 'mut' || m.t === 'ready') { if (!$('[data-pane="elements"]', root).hidden) frame.__send({ t: 'snap' }); if (!$('[data-pane="storage"]', root).hidden) frame.__send({ t: 'storage?' }); }
      else if (m.t === 'box') drawBox(m.box);
      else if (m.t === 'select') { selId = m.i; showPane('elements'); }
      else if (m.t === 'copy') { K.copyText(m.text); }
      else if (m.t === 'storage') { if (m.ls) drawStorage(m); else if (!$('[data-pane="storage"]', root).hidden) frame.__send({ t: 'storage?' }); }
    }
    function addNet(r) {
      netRecs.push(r); nNet++; cnt();
      var tr = document.createElement('tr'); tr.setAttribute('data-n', netRecs.length - 1); var st = r.status || 0;
      tr.className = st === 0 || st >= 400 ? 'bad' : '';
      var path = r.url.replace(/^https?:\/\/lab\.local/, '');
      tr.innerHTML = '<td>' + esc(r.method) + '</td><td class="u">' + esc(path) + '</td><td>' + (st ? st + ' ' + esc(r.statusText || '') : esc(r.statusText || '(failed)')) + '</td><td>' + esc((r.type || '').split(';')[0].replace('application/', '')) + '</td><td>' + (r.size !== undefined ? r.size + ' B' : '') + '</td><td>' + r.ms + ' ms</td>';
      $('.wl-net tbody', root).appendChild(tr);
    }
    function netDetail(i) {
      var r = netRecs[i]; if (!r) return;
      var hh = function (o) { return Object.keys(o || {}).map(function (k) { return esc(k) + ': ' + esc(o[k]); }).join('\n'); };
      var body = r.resBody || ''; try { body = JSON.stringify(JSON.parse(body), null, 2); } catch (e) { }
      $('.wl-netd', root).innerHTML = '<div class="wl-nd"><div><strong>General</strong><pre>Request URL: ' + esc(r.url) + '\nRequest Method: ' + esc(r.method) + '\nStatus Code: ' + (r.status || '(failed)') + ' ' + esc(r.statusText || '') + (r.error ? '\nError: ' + esc(r.error) : '') + '</pre></div><div><strong>Request headers</strong><pre>' + (hh(r.reqHeaders) || '(none set by your code)') + '</pre>' + (r.reqBody ? '<strong>Request body</strong><pre>' + esc(r.reqBody) + '</pre>' : '') + '</div><div><strong>Response headers</strong><pre>' + hh(r.resHeaders) + '</pre><strong>Response</strong><pre>' + esc(body || '(empty)') + '</pre></div></div>';
    }
    function drawTree(tree, sel) {
      if (sel) selId = sel;
      function node(n, d) {
        if (!n) return '';
        if (n.k === 't') return '<div class="tn t" style="--d:' + d + '">"' + esc(n.x) + '"</div>';
        if (n.k === 'c') return '<div class="tn cm" style="--d:' + d + '">&lt;!--' + esc(n.x) + '--&gt;</div>';
        var at = n.a.map(function (x) { return ' <span class="xa">' + esc(x[0]) + '</span>' + (x[1] !== '' ? '=<span class="xv">"' + esc(x[1].length > 60 ? x[1].slice(0, 60) + '…' : x[1]) + '"</span>' : ''); }).join('');
        var simple = n.c.length === 1 && n.c[0].k === 't' && n.c[0].x.length < 50;
        var open = '<span class="tg">&lt;' + n.tag + '</span>' + at + '<span class="tg">&gt;</span>';
        var isVoid = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/.test(n.tag);
        if (!n.c.length || simple) return '<div class="tn e' + (n.i === selId ? ' sel' : '') + '" data-ni="' + n.i + '" style="--d:' + d + '">' + open + (simple ? esc(n.c[0].x) : '') + (isVoid ? '' : '<span class="tg">&lt;/' + n.tag + '&gt;</span>') + '</div>';
        return '<details open class="tnd"><summary class="tn e' + (n.i === selId ? ' sel' : '') + '" data-ni="' + n.i + '" style="--d:' + d + '">' + open + '</summary>' + n.c.map(function (c) { return node(c, d + 1); }).join('') + '<div class="tn" style="--d:' + d + '"><span class="tg">&lt;/' + n.tag + '&gt;</span></div></details>';
      }
      $('.wl-tree', root).innerHTML = node(tree, 0);
    }
    function drawBox(b) {
      var f = function (x) { return String(Math.round(x * 100) / 100); };
      $('.wl-side', root).innerHTML = '<div class="bx m"><span class="lb">margin</span><span class="t">' + f(b.m[0]) + '</span><span class="r">' + f(b.m[1]) + '</span><span class="bt">' + f(b.m[2]) + '</span><span class="l">' + f(b.m[3]) + '</span><div class="bx b"><span class="lb">border</span><span class="t">' + f(b.b[0]) + '</span><span class="r">' + f(b.b[1]) + '</span><span class="bt">' + f(b.b[2]) + '</span><span class="l">' + f(b.b[3]) + '</span><div class="bx p"><span class="lb">padding</span><span class="t">' + f(b.p[0]) + '</span><span class="r">' + f(b.p[1]) + '</span><span class="bt">' + f(b.p[2]) + '</span><span class="l">' + f(b.p[3]) + '</span><div class="bx c">' + f(b.w - b.b[1] - b.b[3] - b.p[1] - b.p[3]) + ' × ' + f(b.h - b.b[0] - b.b[2] - b.p[0] - b.p[2]) + '</div></div></div></div>' +
        '<div class="wl-cs"><strong>Computed</strong>' + b.cs.map(function (x) { return '<div><span class="xa">' + esc(x[0]) + '</span>: ' + esc(x[1]) + '</div>'; }).join('') + '</div><p class="wl-hint">Now type <code>$0</code> in the Console to use this element.</p>';
    }
    function drawStorage(m) {
      var t = function (name, o) { var k = Object.keys(o || {}); return '<h6>' + name + '</h6>' + (k.length ? '<div class="tw"><table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>' + k.map(function (x) { return '<tr><td><code>' + esc(x) + '</code></td><td><code>' + esc(o[x]) + '</code></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="wl-hint">(empty)</p>'); };
      $('.wl-st', root).innerHTML = t('localStorage', m.ls) + t('sessionStorage', m.ss) + t('Cookies', m.ck) + '<p class="wl-hint">This practice page keeps storage in memory: it is cleared when you press Run or reload.</p>';
    }
    function showPane(p) {
      $$('.wl-dtab', root).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-dt') === p); });
      $$('.wl-pane', root).forEach(function (x) { x.hidden = x.getAttribute('data-pane') !== p; });
      if (frame) { if (p === 'elements') frame.__send({ t: 'snap' }); if (p === 'storage') frame.__send({ t: 'storage?' }); }
    }
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-wl],[data-ed],[data-dt],[data-n],[data-ni]'); if (!t) return;
      if (t.hasAttribute('data-wl')) { var w = t.getAttribute('data-wl'); if (w === 'run') load(); else if (w === 'reset') { ['html', 'css', 'js'].forEach(function (k) { var ta = $('[data-edt="' + k + '"]', root); if (ta) ta.value = orig[k]; }); load(); } else if (w === 'clear') { logEl.innerHTML = ''; nErr = nLog = 0; cnt(); } }
      else if (t.hasAttribute('data-ed')) { var ed = t.getAttribute('data-ed'); $$('.wl-tab', root).forEach(function (b) { b.classList.toggle('on', b === t); }); $$('.wl-ed', root).forEach(function (x) { x.hidden = x.getAttribute('data-edt') !== ed; }); }
      else if (t.hasAttribute('data-dt')) showPane(t.getAttribute('data-dt'));
      else if (t.hasAttribute('data-n')) { $$('.wl-net tr', root).forEach(function (r) { r.classList.toggle('on', r === t); }); netDetail(+t.getAttribute('data-n')); }
      else if (t.hasAttribute('data-ni')) { if (e.target.closest('summary') && e.offsetX < 14 + 12 * (+getComputedStyle(t).getPropertyValue('--d') || 0)) return; e.preventDefault(); selId = +t.getAttribute('data-ni'); $$('.tn.sel', root).forEach(function (x) { x.classList.remove('sel'); }); t.classList.add('sel'); frame.__send({ t: 'sel', i: selId }); }
    });
    root.addEventListener('mouseover', function (e) { var t = e.target.closest('[data-ni]'); if (t && frame) frame.__send({ t: 'hover', i: +t.getAttribute('data-ni') }); });
    root.addEventListener('mouseleave', function () { if (frame) frame.__send({ t: 'unhover' }); });
    var cin = $('.wl-in textarea', root);
    cin.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); var v = cin.value; if (!v.trim()) return;
        hist.push(v); hi = hist.length; cin.value = ''; cin.rows = 1;
        addLog({ kind: 'in', text: v }); frame.__send({ t: 'eval', id: ++evalN, code: loopGuard(v) });
      } else if (e.key === 'ArrowUp' && !cin.value.includes('\n') && hist.length) { e.preventDefault(); hi = Math.max(0, hi - 1); cin.value = hist[hi] || ''; }
      else if (e.key === 'ArrowDown' && !cin.value.includes('\n') && hist.length) { e.preventDefault(); hi = Math.min(hist.length, hi + 1); cin.value = hist[hi] || ''; }
      else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); logEl.innerHTML = ''; }
    });
    cin.addEventListener('input', function () { cin.rows = Math.min(8, cin.value.split('\n').length); });
    root.addEventListener('input', function (e) { if (!e.target.classList.contains('wl-ed')) return; var au = $('[data-auto]', root); if (au && au.checked) { clearTimeout(autoT); autoT = setTimeout(load, 700); } });
    setTimeout(load, 0);
    return root;
  };

  /* ---------- event propagation explorer ---------- */
  W.propagation = function () {
    var r = h('div', { class: 'wg', style: '--dom:var(--c-web)' });
    r.innerHTML = '<h4>Event propagation</h4><p class="sub">Click the button. A real click event travels down (capture), reaches the target, then bubbles up. Each box has one capture listener and one bubble listener.</p>' +
      '<div class="pp-opts"><label><input type="checkbox" data-o="stop"> <code>stopPropagation()</code> in the <code>section</code> bubble listener</label><label><input type="checkbox" data-o="deleg"> delegate: one listener on <code>ul</code> handles every <code>li</code></label><label>speed <select data-o="speed"><option value="450">normal</option><option value="900">slow</option><option value="120">fast</option></select></label></div>' +
      '<div class="pp-box" data-n="document">document<div class="pp-box" data-n="body">body<div class="pp-box" data-n="section">section#panel<div class="pp-box" data-n="div">div.card<button class="btn pp-btn" data-n="button">button#save</button><ul class="pp-ul" data-n="ul"><li data-n="li">li: router</li><li data-n="li">li: pi</li><li data-n="li">li: nas</li></ul></div></div></div></div>' +
      '<ol class="pp-log mono"></ol>';
    var logEl = $('.pp-log', r), queue = [], playing = false;
    function play() {
      if (playing) return; playing = true;
      (function step() {
        var x = queue.shift(); if (!x) { playing = false; return; }
        $$('.pp-box,.pp-btn,li,.pp-ul', r).forEach(function (b) { b.classList.remove('hot', 'cap', 'bub', 'tgt'); });
        if (x.el) x.el.classList.add('hot', x.cls);
        if (x.text) { var li = document.createElement('li'); li.innerHTML = x.text; logEl.appendChild(li); }
        setTimeout(step, +$('[data-o=speed]', r).value);
      })();
    }
    function add(el, phase) {
      el.addEventListener('click', function (e) {
        var name = el.getAttribute('data-n'), deleg = $('[data-o=deleg]', r).checked;
        if (deleg && name === 'ul' && phase === 'bubble') {
          var li = e.target.closest('li');
          if (li) queue.push({ el: el, cls: 'bub', text: '<span class="t-kw">delegated</span> ul listener: <code>e.target.closest("li")</code> is “' + esc(li.textContent) + '”' });
          return;
        }
        var ph = e.eventPhase === 1 ? 'capture' : e.eventPhase === 2 ? 'target' : 'bubble';
        if ((name === 'li' || name === 'ul') && deleg) return;
        queue.push({ el: el, cls: ph === 'capture' ? 'cap' : ph === 'target' ? 'tgt' : 'bub', text: '<span class="ph-' + ph + '">' + ph + '</span> <code>' + name + '</code> ' + (phase === 'capture' ? '(capture listener)' : '(bubble listener)') + ' · <code>e.target</code> = ' + esc(e.target.getAttribute('data-n')) + ' · <code>e.currentTarget</code> = ' + name });
        if (name === 'section' && phase === 'bubble' && $('[data-o=stop]', r).checked) { e.stopPropagation(); queue.push({ el: el, cls: 'bub', text: '<span class="t-op">stopPropagation()</span> called: <code>body</code> and <code>document</code> never hear about it' }); }
        play();
      }, phase === 'capture');
    }
    $$('[data-n]', r).forEach(function (el) { add(el, 'capture'); add(el, 'bubble'); });
    r.addEventListener('click', function (e) { if (e.target.closest('[data-n]') && !playing && !queue.length) logEl.innerHTML = ''; }, true);
    return r;
  };

  /* ---------- event loop stepper ---------- */
  var LOOPS = {
    timeout: { title: 'setTimeout(fn, 0) waits for the stack to empty', code: "console.log('A');\nsetTimeout(() => console.log('B'), 0);\nconsole.log('C');",
      steps: [['run script', 'main', '', '', '', ''], ["console.log('A')", 'main|log', '', '', '', 'A'], ['setTimeout registers a timer with the browser', 'main|setTimeout', 'timer 0 ms → B', '', '', 'A'], ['the timer fires; its callback joins the task queue', 'main', '', '', 'cb B', 'A'], ["console.log('C')", 'main|log', '', '', 'cb B', 'A C'], ['script ends: the call stack is empty', '', '', '', 'cb B', 'A C'], ['event loop: stack empty, take the next task', 'cb B', '', '', '', 'A C'], ["console.log('B')", 'cb B|log', '', '', '', 'A C B'], ['done', '', '', '', '', 'A C B']] },
    promise: { title: 'Promise callbacks (microtasks) run before timers (tasks)', code: "console.log('1');\nsetTimeout(() => console.log('timeout'), 0);\nPromise.resolve().then(() => console.log('promise'));\nconsole.log('2');",
      steps: [['run script', 'main', '', '', '', ''], ["console.log('1')", 'main|log', '', '', '', '1'], ['setTimeout: timer handed to the browser', 'main|setTimeout', 'timer 0 ms', '', '', '1'], ['timer expires: callback waits in the task queue', 'main', '', '', 'timeout cb', '1'], ['.then on a resolved promise: callback goes to the microtask queue', 'main|then', '', 'promise cb', 'timeout cb', '1'], ["console.log('2')", 'main|log', '', 'promise cb', 'timeout cb', '1 2'], ['script ends', '', '', 'promise cb', 'timeout cb', '1 2'], ['empty stack: drain ALL microtasks first', 'promise cb', '', '', 'timeout cb', '1 2'], ["console.log('promise')", 'promise cb|log', '', '', 'timeout cb', '1 2 promise'], ['microtasks empty: now one task', 'timeout cb', '', '', '', '1 2 promise'], ["console.log('timeout')", 'timeout cb|log', '', '', '', '1 2 promise timeout'], ['done', '', '', '', '', '1 2 promise timeout']] },
    async: { title: 'await pauses the function, not the program', code: "async function load() {\n  console.log('start');\n  const r = await fetch('/api/status');\n  console.log('got', r.status);\n}\nload();\nconsole.log('after load()');",
      steps: [['run script', 'main', '', '', '', ''], ['call load()', 'main|load', '', '', '', ''], ["console.log('start')", 'main|load|log', '', '', '', 'start'], ['fetch starts a network request in the browser', 'main|load|fetch', 'HTTP GET /api/status', '', '', 'start'], ['await: load() is suspended and returns a pending promise', 'main', 'HTTP GET /api/status', '', '', 'start'], ["console.log('after load()')", 'main|log', 'HTTP GET /api/status', '', '', 'start\nafter load()'], ['script ends; the page stays responsive', '', 'HTTP GET /api/status', '', '', 'start\nafter load()'], ['response arrives: the promise resolves; resuming load() is a microtask', '', '', 'resume load', '', 'start\nafter load()'], ['load() resumes after the await', 'resume load', '', '', '', 'start\nafter load()'], ["console.log('got', r.status)", 'resume load|log', '', '', '', 'start\nafter load()\ngot 200'], ['done', '', '', '', '', 'start\nafter load()\ngot 200']] },
    block: { title: 'A long loop freezes everything, clicks included', code: "button.onclick = () => console.log('clicked');\nconst end = Date.now() + 3000;\nwhile (Date.now() < end) {}   // busy for 3 s\nconsole.log('loop done');",
      steps: [['run script', 'main', '', '', '', ''], ['onclick handler registered', 'main', 'click listener', '', '', ''], ['while loop starts: the stack is busy', 'main|while', 'click listener', '', '', ''], ['you click the button: the click becomes a task, but nothing can run it', 'main|while', 'click listener', '', 'click cb', ''], ['still looping: no repaint, no scrolling, no clicks', 'main|while', 'click listener', '', 'click cb', ''], ["loop ends; console.log('loop done')", 'main|log', 'click listener', '', 'click cb', 'loop done'], ['script ends', '', 'click listener', '', 'click cb', 'loop done'], ['only now does the click handler run', 'click cb|log', 'click listener', '', '', 'loop done\nclicked'], ['done: move slow work to a Web Worker, or split it with setTimeout/await', '', 'click listener', '', '', 'loop done\nclicked']] }
  };
  W.eventloop = function (args) {
    var r = h('div', { class: 'wg', style: '--dom:var(--c-web)' }), key = args.preset || 'promise', i = 0;
    r.innerHTML = '<h4>Event loop, step by step</h4><p class="sub">Pick a program and step through it. JavaScript runs one thing at a time on the call stack; everything else waits in a queue.</p><div class="el-pick">' + Object.keys(LOOPS).map(function (k) { return '<button class="chip' + (k === key ? ' on' : '') + '" data-k="' + k + '">' + esc(LOOPS[k].title) + '</button>'; }).join('') + '</div><div class="cb"><pre class="el-code"></pre></div><div class="el-grid"><div class="el-col"><h6>Call stack</h6><div data-c="stack"></div></div><div class="el-col"><h6>Browser (Web APIs)</h6><div data-c="api"></div></div><div class="el-col"><h6>Microtask queue</h6><div data-c="micro"></div></div><div class="el-col"><h6>Task queue</h6><div data-c="task"></div></div></div><div class="el-now"></div><div class="el-out"><h6>Console</h6><pre class="mono" data-c="out"></pre></div><div style="display:flex;gap:8px;margin-top:8px"><button class="btn sec" data-s="-1">◀ Back</button><button class="btn" data-s="1">Step ▶</button><button class="btn sec" data-s="0">Restart</button><span class="el-ct"></span></div>';
    function draw() {
      var L = LOOPS[key], s = L.steps[i];
      $('.el-code', r).innerHTML = K.hlJs(L.code);
      var put = function (c, txt, sep) { $('[data-c="' + c + '"]', r).innerHTML = txt ? txt.split(sep || '|').map(function (x) { return '<div class="el-item">' + esc(x) + '</div>'; }).join('') : '<div class="el-empty">empty</div>'; };
      var st = s[1] ? s[1].split('|').reverse().join('|') : ''; put('stack', st); put('api', s[2]); put('micro', s[3]); put('task', s[4]);
      $('[data-c="out"]', r).textContent = s[5].indexOf('\n') >= 0 ? s[5] : s[5].split(' ').filter(Boolean).join('\n');
      $('.el-now', r).textContent = (i + 1) + '. ' + s[0];
      $('.el-ct', r).textContent = 'step ' + (i + 1) + ' of ' + L.steps.length;
    }
    r.addEventListener('click', function (e) { var t = e.target.closest('[data-k],[data-s]'); if (!t) return; if (t.hasAttribute('data-k')) { key = t.getAttribute('data-k'); i = 0; $$('.el-pick .chip', r).forEach(function (b) { b.classList.toggle('on', b === t); }); } else { var d = +t.getAttribute('data-s'); i = d === 0 ? 0 : Math.max(0, Math.min(LOOPS[key].steps.length - 1, i + d)); } draw(); });
    draw(); return r;
  };

  /* ---------- XPath / selector tester ---------- */
  W.xpath = function (args) {
    var r = h('div', { class: 'wg', style: '--dom:var(--c-web)' });
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<network name="home">\n  <device id="1" type="router" online="true">\n    <name>router</name>\n    <ip>192.168.1.1</ip>\n    <port proto="tcp">443</port>\n  </device>\n  <device id="3" type="server" online="true">\n    <name>pi</name>\n    <ip>192.168.1.50</ip>\n    <port proto="tcp">22</port>\n    <port proto="tcp">8080</port>\n  </device>\n  <device id="4" type="storage" online="false">\n    <name>nas</name>\n    <ip>192.168.1.60</ip>\n    <port proto="tcp">445</port>\n  </device>\n</network>';
    r.innerHTML = '<h4>XML, XPath and selectors</h4><p class="sub">Edit the XML, then try an XPath expression or a CSS selector. The browser\'s own <code>DOMParser</code> and <code>document.evaluate</code> do the work.</p><div class="grid2 xp-grid"><div><textarea class="ed" data-x style="min-height:300px" spellcheck="false">' + esc(xml) + '</textarea><div data-wf class="mono" style="font-size:13px;margin-top:6px"></div></div><div><div style="display:flex;gap:6px;flex-wrap:wrap"><select data-mode><option value="xpath">XPath</option><option value="css">CSS selector</option></select><input type="text" data-q value="//device[@online=\'true\']/name" style="flex:1;min-width:180px;background:var(--code-bg);color:var(--fg);border:1px solid var(--line);border-radius:7px;padding:7px 9px;font:14px var(--font-mono)" aria-label="Query"></div><div class="xp-ex">Try: ' + ['//device/name', "//device[@type='server']/ip", '//port[.>1000]', 'count(//port)', "//device[name='pi']/@id", 'sum(//port)', '//device[not(@online="true")]/name'].map(function (q) { return '<button class="chip" data-try="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div><ol class="xp-res mono"></ol></div></div>';
    function run() {
      var src = $('[data-x]', r).value, q = $('[data-q]', r).value, mode = $('[data-mode]', r).value, out = $('.xp-res', r), wf = $('[data-wf]', r);
      var doc = new DOMParser().parseFromString(src, 'application/xml'), err = doc.getElementsByTagName('parsererror')[0];
      if (err) { wf.innerHTML = '<span style="color:var(--bad)">Not well-formed: ' + esc((err.textContent || '').replace(/\s+/g, ' ').slice(0, 220)) + '</span>'; out.innerHTML = ''; return; }
      wf.innerHTML = '<span style="color:var(--ok)">Well-formed XML. Root element: &lt;' + esc(doc.documentElement.nodeName) + '&gt;</span>';
      var items = [];
      try {
        if (mode === 'css') { doc.querySelectorAll(q).forEach(function (n) { items.push(n); }); }
        else {
          var res = doc.evaluate(q, doc, null, XPathResult.ANY_TYPE, null);
          if (res.resultType === XPathResult.NUMBER_TYPE) { out.innerHTML = '<li>number: ' + res.numberValue + '</li>'; return; }
          if (res.resultType === XPathResult.STRING_TYPE) { out.innerHTML = '<li>string: "' + esc(res.stringValue) + '"</li>'; return; }
          if (res.resultType === XPathResult.BOOLEAN_TYPE) { out.innerHTML = '<li>boolean: ' + res.booleanValue + '</li>'; return; }
          var n; while ((n = res.iterateNext())) items.push(n);
        }
      } catch (e) { out.innerHTML = '<li style="color:var(--bad)">' + esc(e.message) + '</li>'; return; }
      var ser = new XMLSerializer();
      out.innerHTML = items.length ? items.map(function (n) { return '<li>' + esc(n.nodeType === 2 ? n.name + '="' + n.value + '"' : n.nodeType === 3 ? '"' + n.textContent + '"' : ser.serializeToString(n).replace(/\s+/g, ' ').slice(0, 160)) + '</li>'; }).join('') : '<li class="el-empty">no matches</li>';
    }
    r.addEventListener('input', run); r.addEventListener('change', run);
    r.addEventListener('click', function (e) { var t = e.target.closest('[data-try]'); if (t) { $('[data-mode]', r).value = 'xpath'; $('[data-q]', r).value = t.getAttribute('data-try'); run(); } });
    setTimeout(run, 0); return r;
  };

  /* ---------- CSS box model ---------- */
  W.boxmodel = function () {
    var r = h('div', { class: 'wg', style: '--dom:var(--c-web)' });
    var sl = function (k, lab, max, v) { return '<label class="bm-s">' + lab + ' <input type="range" min="0" max="' + max + '" value="' + v + '" data-k="' + k + '"><output data-o="' + k + '">' + v + 'px</output></label>'; };
    r.innerHTML = '<h4>The box model</h4><p class="sub">Every element is a box: content, padding, border, margin. Change the numbers and watch the size the page actually uses.</p><div class="grid2"><div>' + sl('w', 'width', 300, 200) + sl('p', 'padding', 60, 20) + sl('b', 'border', 30, 4) + sl('m', 'margin', 60, 16) + '<label class="bm-s"><input type="checkbox" data-k="bs"> <code>box-sizing: border-box</code></label><div class="cb"><pre class="bm-css"></pre></div></div><div><div class="bm-stage"><div class="bm-m"><div class="bm-el">content</div></div></div><div class="bm-calc mono"></div></div></div>';
    function draw() {
      var g = function (k) { return +$('[data-k="' + k + '"]', r).value; }, w = g('w'), p = g('p'), b = g('b'), m = g('m'), bs = $('[data-k="bs"]', r).checked;
      ['w', 'p', 'b', 'm'].forEach(function (k) { $('[data-o="' + k + '"]', r).textContent = g(k) + 'px'; });
      var el = $('.bm-el', r); el.style.cssText = 'width:' + w + 'px;padding:' + p + 'px;border:' + b + 'px solid var(--c-web);box-sizing:' + (bs ? 'border-box' : 'content-box');
      $('.bm-m', r).style.padding = m + 'px';
      var content = bs ? Math.max(0, w - 2 * p - 2 * b) : w, outer = bs ? w : w + 2 * p + 2 * b;
      $('.bm-css', r).innerHTML = K.hlCss('.box {\n  box-sizing: ' + (bs ? 'border-box' : 'content-box') + ';\n  width: ' + w + 'px;\n  padding: ' + p + 'px;\n  border: ' + b + 'px solid;\n  margin: ' + m + 'px;\n}');
      $('.bm-calc', r).innerHTML = 'content width  = ' + content + 'px<br>border box     = ' + (bs ? w + 'px (= width)' : w + ' + 2×' + p + ' + 2×' + b + ' = ' + outer + 'px') + '<br>space taken    = ' + outer + ' + 2×' + m + ' = ' + (outer + 2 * m) + 'px';
    }
    r.addEventListener('input', draw); draw(); return r;
  };

  /* ---------- flexbox playground ---------- */
  W.flexbox = function () {
    var r = h('div', { class: 'wg', style: '--dom:var(--c-web)' });
    var opt = function (k, vals) { return '<label class="fx-o"><code>' + k + '</code><select data-k="' + k + '">' + vals.map(function (v) { return '<option>' + v + '</option>'; }).join('') + '</select></label>'; };
    r.innerHTML = '<h4>Flexbox</h4><p class="sub">One container, five items. Change the container properties; the items rearrange live.</p><div class="fx-opts">' + opt('flex-direction', ['row', 'column', 'row-reverse', 'column-reverse']) + opt('justify-content', ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']) + opt('align-items', ['stretch', 'flex-start', 'center', 'flex-end', 'baseline']) + opt('flex-wrap', ['nowrap', 'wrap']) + opt('gap', ['0', '8px', '16px', '32px']) + '<label class="fx-o"><code>item 2 flex</code><select data-k="grow"><option value="">(none)</option><option>1</option><option>2</option></select></label></div><div class="fx-box">' + [1, 2, 3, 4, 5].map(function (i) { return '<div class="fx-i" style="' + (i === 3 ? 'padding:22px 10px' : '') + '">' + i + '</div>'; }).join('') + '</div><div class="cb"><pre class="fx-css"></pre></div>';
    function draw() {
      var g = function (k) { return $('[data-k="' + k + '"]', r).value; }, box = $('.fx-box', r);
      ['flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'gap'].forEach(function (k) { box.style.setProperty(k, g(k)); });
      box.children[1].style.flex = g('grow') || '';
      var css = '.box {\n  display: flex;\n' + ['flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'gap'].map(function (k) { return '  ' + k + ': ' + g(k) + ';'; }).join('\n') + '\n}' + (g('grow') ? '\n.item:nth-child(2) { flex: ' + g('grow') + '; }' : '');
      $('.fx-css', r).innerHTML = K.hlCss(css);
    }
    r.addEventListener('change', draw); draw(); return r;
  };

  /* ---------- specificity calculator ---------- */
  function specificity(sel) {
    var s = sel.replace(/::?(not|is|has)\(([^)]*)\)/g, ' $2 ').replace(/:where\([^)]*\)/g, '');
    var a = (s.match(/#[\w-]+/g) || []).length;
    var b = (s.match(/\.[\w-]+/g) || []).length + (s.match(/\[[^\]]+\]/g) || []).length + (s.match(/:(?!:)[\w-]+(\([^)]*\))?/g) || []).filter(function (x) { return !/^:(before|after|first-line|first-letter)$/.test(x); }).length;
    var c = (s.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+(\([^)]*\))?/g, ' ').match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length + (s.match(/::[\w-]+|:(before|after|first-line|first-letter)\b/g) || []).length;
    return [a, b, c];
  }
  K.specificity = specificity;
  W.specificity = function () {
    var r = h('div', { class: 'wg', style: '--dom:var(--c-web)' });
    var rows = ['p', '.note', 'p.note', '#intro', 'nav ul li a', 'ul li:first-child', 'a[href^="https"]', '#intro p.note:hover', 'button:not(.primary)'];
    r.innerHTML = '<h4>Specificity</h4><p class="sub">When two rules set the same property, the more specific selector wins; on a tie, the later rule wins. Specificity is three counts compared left to right: (IDs, classes/attributes/pseudo-classes, elements/pseudo-elements).</p><div style="display:flex;gap:8px;flex-wrap:wrap"><input type="text" data-a value="#nav .item" aria-label="Selector A" style="flex:1;min-width:150px;background:var(--code-bg);color:var(--fg);border:1px solid var(--line);border-radius:7px;padding:7px 9px;font:14px var(--font-mono)"><span style="align-self:center">vs</span><input type="text" data-b value="ul li.item.active" aria-label="Selector B" style="flex:1;min-width:150px;background:var(--code-bg);color:var(--fg);border:1px solid var(--line);border-radius:7px;padding:7px 9px;font:14px var(--font-mono)"></div><div class="sp-res" style="margin:10px 0"></div><div class="tw"><table><thead><tr><th>Selector</th><th>(a, b, c)</th></tr></thead><tbody>' + rows.map(function (s) { return '<tr><td><code>' + esc(s) + '</code></td><td class="mono">(' + specificity(s).join(', ') + ')</td></tr>'; }).join('') + '</tbody></table></div><p class="wl-hint">Inline <code>style=""</code> beats every selector, and <code>!important</code> beats inline styles. Reach for neither until you understand why a rule is losing.</p>';
    function draw() {
      var A = $('[data-a]', r).value, B = $('[data-b]', r).value, sa = specificity(A), sb = specificity(B), cmp = 0;
      for (var i = 0; i < 3 && !cmp; i++) cmp = sa[i] - sb[i];
      $('.sp-res', r).innerHTML = '<code>' + esc(A) + '</code> = (' + sa.join(', ') + ') &nbsp; <code>' + esc(B) + '</code> = (' + sb.join(', ') + ')<br><strong>' + (cmp > 0 ? 'A wins' : cmp < 0 ? 'B wins' : 'Tie: the rule that comes later in the CSS wins') + '</strong>';
    }
    r.addEventListener('input', draw); draw(); return r;
  };

  /* ---------- page load pipeline ---------- */
  var PL = [
    ['URL', 'You type <code>https://lab.local/devices</code>. The browser splits it into scheme, host, path.', 'client'],
    ['DNS', 'Ask a resolver for the address of <code>lab.local</code> (cache first). Answer: <code>192.168.1.50</code>.', 'net'],
    ['TCP', 'Three-way handshake with port 443: SYN, SYN-ACK, ACK. One round trip.', 'net'],
    ['TLS', 'Agree on keys and check the certificate for <code>lab.local</code>. One more round trip with TLS 1.3.', 'net'],
    ['HTTP request', '<code>GET /devices HTTP/2</code> with headers: Host, Accept, Cookie, User-Agent.', 'net'],
    ['Server', 'The server (Node.js here) matches the route, reads data, renders or returns HTML, and sends <code>200 OK</code>.', 'server'],
    ['Parse HTML → DOM', 'Bytes become characters, tokens, nodes: the Document Object Model tree your JavaScript will edit.', 'client'],
    ['Fetch sub-resources', '<code>&lt;link rel=stylesheet&gt;</code>, <code>&lt;script&gt;</code>, images: more requests, often in parallel over the same connection.', 'net'],
    ['CSS → CSSOM', 'Stylesheets are parsed into the CSS Object Model. Rendering waits for CSS so nothing flashes unstyled.', 'client'],
    ['JavaScript', 'A plain <code>&lt;script&gt;</code> pauses HTML parsing until it runs. <code>defer</code> and <code>type="module"</code> run after parsing.', 'client'],
    ['Render tree', 'DOM + CSSOM: only visible nodes, each with computed styles.', 'client'],
    ['Layout', 'Compute the size and position of every box (the box model, flexbox, grid).', 'client'],
    ['Paint + composite', 'Draw pixels in layers and combine them on the GPU. First paint!', 'client'],
    ['Interactive', 'Event listeners are attached; clicks run your handlers through the event loop. <code>fetch()</code> calls go back to the server for JSON.', 'client']
  ];
  W.pageload = function () {
    var r = h('div', { class: 'wg', style: '--dom:var(--c-web)' }), i = 0;
    r.innerHTML = '<h4>What happens when you load a page</h4><p class="sub">Step through one page load. Colors show where the work happens: <span class="pl-k client">browser</span> <span class="pl-k net">network</span> <span class="pl-k server">server</span>.</p><div class="pl-row">' + PL.map(function (s, k) { return '<button class="pl-st ' + s[2] + '" data-i="' + k + '">' + (k + 1) + '. ' + esc(s[0]) + '</button>'; }).join('') + '</div><div class="pl-d"></div><div style="display:flex;gap:8px;margin-top:8px"><button class="btn sec" data-d="-1">◀ Back</button><button class="btn" data-d="1">Next ▶</button></div>';
    function draw() { $$('.pl-st', r).forEach(function (b, k) { b.classList.toggle('on', k === i); b.classList.toggle('past', k < i); }); $('.pl-d', r).innerHTML = '<strong>' + (i + 1) + '. ' + esc(PL[i][0]) + '</strong><p>' + PL[i][1] + '</p>'; }
    r.addEventListener('click', function (e) { var t = e.target.closest('[data-i],[data-d]'); if (!t) return; i = t.hasAttribute('data-i') ? +t.getAttribute('data-i') : Math.max(0, Math.min(PL.length - 1, i + +t.getAttribute('data-d'))); draw(); });
    draw(); return r;
  };
})();

