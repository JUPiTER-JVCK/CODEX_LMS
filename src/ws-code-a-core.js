/* Learn to Code part, shared pieces for the code stepper, the paired editors and Bit's grid world.
   window.__code.lang   the language the learner prefers to read: 'py', 'js' or 'both' (kept in sync across the page)
   window.__code.val    draws a value (number, text, switch, shelf, card ...) the way a given language writes it
   window.__code.hl     syntax-highlights one line of Python or JavaScript
   Colours come from CSS classes in src/code.add.css so every picture follows the light and dark themes. */
(function () {
  'use strict';
  if (!window.__core) return;
  var K = window.__core, esc = K.esc;
  var C = window.__code = window.__code || {};

  /* ---------- the language preference ---------- */
  var KEY = 'codex-lang', mode = 'both', listeners = [];
  try { var saved = localStorage.getItem(KEY); if (saved === 'py' || saved === 'js' || saved === 'both') mode = saved; } catch (e) { }
  C.lang = {
    get: function () { return mode; },
    set: function (v) {
      if (v !== 'py' && v !== 'js' && v !== 'both') return;
      mode = v;
      try { localStorage.setItem(KEY, v); } catch (e) { }
      listeners = listeners.filter(function (l) { if (l.seen && !l.root.isConnected) return false; if (l.root.isConnected) l.seen = true; l.fn(v); return true; });
    },
    /* call fn(mode) whenever the preference changes, until root has been on the page and is removed from it */
    bind: function (root, fn) { listeners.push({ root: root, fn: fn, seen: false }); }
  };
  C.langName = function (l) { return l === 'py' ? 'Python' : 'JavaScript'; };

  /* the three-way switch every widget carries: Python | JavaScript | Both */
  C.switcher = function (root, opts) {
    opts = opts || {};
    var bar = K.h('div', { class: 'cd-sw', role: 'group', 'aria-label': 'Language' });
    var items = opts.noBoth ? [['py', 'Python'], ['js', 'JavaScript']] : [['py', 'Python'], ['js', 'JavaScript'], ['both', 'Both']];
    bar.innerHTML = items.map(function (x) { return '<button type="button" class="cd-swb" data-l="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    function paint() {
      var m = C.lang.get();
      if (opts.noBoth && m === 'both') m = 'py';
      Array.prototype.forEach.call(bar.querySelectorAll('.cd-swb'), function (b) {
        var on = b.getAttribute('data-l') === m;
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    bar.addEventListener('click', function (e) { var b = e.target.closest('.cd-swb'); if (b) C.lang.set(b.getAttribute('data-l')); });
    C.lang.bind(root, paint); paint();
    return bar;
  };

  /* ---------- highlighting ---------- */
  C.hl = function (lang, line) { return line === '' ? '&nbsp;' : (lang === 'py' ? K.hlPy(line) : K.hlJs(line)); };

  /* ---------- values ---------- */
  function pyFloat(x) { return Number.isInteger(x) ? x.toFixed(1) : String(x); }
  function str(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"'; }
  /* plain-text form of a value in one language (used for labels and for the variable names in notes) */
  C.repr = function (v, lang) {
    if (v === null) return lang === 'js' ? 'null' : 'None';
    if (v === true || v === false) return lang === 'js' ? String(v) : (v ? 'True' : 'False');
    if (typeof v === 'number') return String(v);
    if (v.f !== undefined) return lang === 'js' ? String(v.f) : pyFloat(v.f);
    if (v.s !== undefined) return str(v.s);
    if (v.l) return (v.tu && lang !== 'js' ? '(' : '[') + v.l.map(function (x) { return C.repr(x, lang); }).join(', ') + (v.tu && lang !== 'js' ? (v.l.length === 1 ? ',)' : ')') : ']');
    if (v.d) return lang === 'js' ? (v.d.length ? '{ ' + v.d.map(function (p) { return (typeof p[0] === 'object' && p[0] && p[0].s !== undefined ? (/^[A-Za-z_$][\w$]*$/.test(p[0].s) ? p[0].s : str(p[0].s)) : C.repr(p[0], lang)) + ': ' + C.repr(p[1], lang); }).join(', ') + ' }' : '{}')
      : '{' + v.d.map(function (p) { return C.repr(p[0], lang) + ': ' + C.repr(p[1], lang); }).join(', ') + '}';
    if (v.set) return lang === 'js' ? 'Set(' + v.set.length + ') {' + v.set.map(function (x) { return C.repr(x, lang); }).join(', ') + '}' : (v.set.length ? '{' + v.set.map(function (x) { return C.repr(x, lang); }).join(', ') + '}' : 'set()');
    if (v.fn) return lang === 'js' ? 'function ' + v.fn : '<function ' + v.fn + '>';
    if (v.cls) return lang === 'js' ? 'class ' + v.cls : '<class ' + v.cls + '>';
    if (v.o) return lang === 'js' ? v.o + ' { ' + v.a.map(function (p) { return p[0] + ': ' + C.repr(p[1], lang); }).join(', ') + ' }' : v.o + '(' + v.a.map(function (p) { return p[0] + '=' + C.repr(p[1], lang); }).join(', ') + ')';
    return esc(JSON.stringify(v));
  };
  /* the same, as plain text without quotes, for sentences ("x is now 7") */
  C.say = function (v, lang) { return v && v.s !== undefined ? v.s : C.repr(v, lang); };

  /* a value drawn as a picture: numbers as tiles, True/False as a switch, lists as a numbered shelf, dicts as a card of rows */
  C.val = function (v, lang) {
    var label = ' title="' + esc(C.repr(v, lang)) + '"';
    if (v === null) return '<span class="cxv z"' + label + '>' + (lang === 'js' ? 'null' : 'None') + '</span>';
    if (v === true || v === false) return '<span class="cxv b ' + (v ? 'on' : 'off') + '"' + label + '><i></i>' + C.repr(v, lang) + '</span>';
    if (typeof v === 'number') return '<span class="cxv n"' + label + '>' + v + '</span>';
    if (v.f !== undefined) return '<span class="cxv n"' + label + '>' + esc(C.repr(v, lang)) + '</span>';
    if (v.s !== undefined) return '<span class="cxv s"' + label + '>' + esc(str(v.s)) + '</span>';
    if (v.l) return '<span class="cxv l' + (v.tu && lang !== 'js' ? ' tu' : '') + '"' + label + '>' + (v.l.length ? v.l.map(function (x, i) { return '<span class="cxl"><sub>' + i + '</sub>' + C.val(x, lang) + '</span>'; }).join('') : '<span class="cxl-e">empty</span>') + '</span>';
    if (v.set) return '<span class="cxv l set"' + label + '>' + (v.set.length ? v.set.map(function (x) { return '<span class="cxl">' + C.val(x, lang) + '</span>'; }).join('') : '<span class="cxl-e">empty</span>') + '</span>';
    if (v.d) return '<span class="cxv d"' + label + '>' + (v.d.length ? v.d.map(function (p) { return '<span class="cxd"><b>' + (p[0] && p[0].s !== undefined ? esc(p[0].s) : esc(C.repr(p[0], lang))) + '</b><i>' + (lang === 'js' ? ':' : '→') + '</i>' + C.val(p[1], lang) + '</span>'; }).join('') : '<span class="cxl-e">empty</span>') + '</span>';
    if (v.fn) return '<span class="cxv f"' + label + '>' + esc(v.fn) + '( )</span>';
    if (v.cls) return '<span class="cxv f"' + label + '>class ' + esc(v.cls) + '</span>';
    if (v.o) return '<span class="cxv o"' + label + '><b class="cxo-n">' + esc(v.o) + '</b>' + v.a.map(function (p) { return '<span class="cxd"><b>' + esc(p[0]) + '</b><i>' + (lang === 'js' ? ':' : '=') + '</i>' + C.val(p[1], lang) + '</span>'; }).join('') + '</span>';
    return '<span class="cxv s">' + esc(JSON.stringify(v)) + '</span>';
  };
  C.ids = function (v, into) {            // every mutable object a value is, or holds, by id
    if (v && typeof v === 'object') {
      if (v.i) into.push(v.i);
      (v.l || v.set || []).forEach(function (x) { C.ids(x, into); });
      (v.d || []).forEach(function (p) { C.ids(p[1], into); });
      (v.a || []).forEach(function (p) { C.ids(p[1], into); });
    }
    return into;
  };
})();
