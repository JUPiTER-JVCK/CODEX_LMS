/* Learn to Code part: paired editors.
   codetry  the same small program in Python and in JavaScript, both editable and runnable in the page.
            "Run both" compares what the two print, which is the point: different spelling, same idea.
   args = {title, py, js, out, note}   out is what the Python version prints (recorded when the book is built) */
(function () {
  'use strict';
  if (!window.__core || !window.__code) return;
  var K = window.__core, esc = K.esc, h = K.h, C = window.__code, W = window.__widgets = window.__widgets || {};

  function runPy(code) {
    return window.__py.run(code, '', '').then(function (r) {
      return { out: r.out || '', err: r.status === 'ok' ? '' : (r.msg || 'Something went wrong.') };
    });
  }
  function runJs(code) {
    return window.__js.run(code, { module: false }).then(function (r) {
      var errs = (r.logs || []).filter(function (l) { return l.uncaught || l.sys; }).map(function (l) { return l.text; });
      return { out: r.out || '', err: r.status === 'ok' ? '' : (errs.join('\n') || r.msg || 'Something went wrong.') };
    });
  }
  var RUN = { py: runPy, js: runJs };

  W.codetry = function (args) {
    var root = h('div', { class: 'wg cxt' }), orig = { py: args.py, js: args.js }, last = {};
    root.innerHTML = '<div class="cxs-head"><span class="cxs-title">' + esc(args.title || 'Try it') + '</span><span class="cxs-sw"></span></div><div class="cxt-panes"></div>' +
      '<div class="cxt-foot"><button type="button" class="cxs-b" data-a="both">Run both and compare</button><span class="cxt-cmp" aria-live="polite"></span></div>';
    root.querySelector('.cxs-sw').appendChild(C.switcher(root));
    var panes = root.querySelector('.cxt-panes');
    ['py', 'js'].forEach(function (l) {
      var p = h('div', { class: 'cxt-pane', 'data-l': l });
      p.innerHTML = '<div class="cxs-ph">' + C.langName(l) + '<span class="sp"></span><button type="button" class="cxs-b" data-a="reset" aria-label="Reset the ' + C.langName(l) + ' code">Reset</button><button type="button" class="cxs-b cxs-primary" data-a="run">Run</button></div>' +
        '<textarea class="ed" spellcheck="false" aria-label="' + C.langName(l) + ' code you can edit"></textarea><pre class="cxt-res" aria-live="polite"></pre>';
      p.querySelector('textarea').value = orig[l];
      panes.appendChild(p);
    });
    function pane(l) { return panes.querySelector('.cxt-pane[data-l="' + l + '"]'); }
    function show(l, r) {
      var el = pane(l).querySelector('.cxt-res'); last[l] = r.out;
      el.className = 'cxt-res show' + (r.err ? ' fail' : '');
      el.innerHTML = (r.out ? esc(r.out) : (r.err ? '' : '<span class="cxs-empty">(the program printed nothing)</span>')) + (r.err ? (r.out && !/\n$/.test(r.out) ? '\n' : '') + '<span class="er">' + esc(r.err) + '</span>' : '');
    }
    function run(l) {
      var p = pane(l), b = p.querySelector('[data-a=run]'), old = b.textContent;
      b.disabled = true; b.textContent = l === 'py' && window.__py.state() !== 'ready' ? 'Loading Python…' : 'Running…';
      return RUN[l](p.querySelector('textarea').value).then(function (r) { b.disabled = false; b.textContent = old; show(l, r); return r; });
    }
    function paint() {
      var m = C.lang.get();
      root.classList.toggle('cxt-both', m === 'both');
      ['py', 'js'].forEach(function (l) {
        var p = pane(l); p.hidden = !(m === 'both' || m === l);
        if (!p.hidden) K.autoSize(p.querySelector('textarea'));
      });
      root.querySelector('.cxt-foot').hidden = m !== 'both';
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a'), p = b.closest('.cxt-pane'), l = p && p.getAttribute('data-l');
      if (a === 'run') run(l);
      else if (a === 'reset') { var ta = p.querySelector('textarea'); ta.value = orig[l]; K.autoSize(ta); var el = p.querySelector('.cxt-res'); el.className = 'cxt-res'; el.innerHTML = ''; }
      else if (a === 'both') {
        var cmp = root.querySelector('.cxt-cmp'); cmp.textContent = 'Running both…'; cmp.className = 'cxt-cmp';
        run('py').then(function () { return run('js'); }).then(function () {
          var same = (last.py || '').trim() === (last.js || '').trim();
          cmp.className = 'cxt-cmp ' + (same ? 'ok' : 'diff');
          cmp.textContent = same ? '✓ Same output from both languages.' : 'The outputs differ. If you changed only one version, that is expected.';
        });
      }
    });
    root.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && e.target.tagName === 'TEXTAREA') { e.preventDefault(); run(e.target.closest('.cxt-pane').getAttribute('data-l')); }
    });
    root.addEventListener('input', function (e) { if (e.target.tagName === 'TEXTAREA') K.autoSize(e.target); });
    C.lang.bind(root, paint); paint();
    return root;
  };
})();
