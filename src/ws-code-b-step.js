/* Learn to Code part: the code stepper.
   codestep  step through a short program one line at a time. The highlighted line is the one about to run;
             beside it the learner sees every variable as a picture, what has been printed, and a sentence of narration.
             The Python and the JavaScript version are shown side by side (or one at a time) and run in lockstep.
   args = {title, py, js, jm, steps, err_js}
     jm      for each Python line number, the JavaScript line that does the same job (chapters/codetrace.py)
     steps   [{ln, st, out, nt, k, ret, err}] recorded by really running the Python version (chapters/codetrace.py)
   Colours come from CSS classes in src/code.add.css so every picture follows the light and dark themes. */
(function () {
  'use strict';
  if (!window.__core || !window.__code) return;
  var K = window.__core, esc = K.esc, h = K.h, C = window.__code, W = window.__widgets = window.__widgets || {};
  var uid = 0;

  function codePane(lang, src) {
    var rows = src.split('\n').map(function (ln, i) {
      return '<div class="cxs-l" data-n="' + (i + 1) + '"><span class="cxs-g" aria-hidden="true"></span><span class="cxs-n" aria-hidden="true">' + (i + 1) + '</span><span class="cxs-t">' + C.hl(lang, ln) + '</span></div>';
    }).join('');
    return '<div class="cxs-pane" data-l="' + lang + '" role="group" aria-label="' + C.langName(lang) + ' code"><div class="cxs-ph">' + C.langName(lang) + '</div><div class="cxs-code">' + rows + '</div></div>';
  }

  W.codestep = function (args) {
    var steps = args.steps, last = steps.length - 1, cur = 0, timer = null, id = 'cs' + (++uid);
    var jm = args.jm || [];
    var root = h('div', { class: 'wg cxs', tabindex: '-1' });
    root.innerHTML =
      '<div class="cxs-head"><span class="cxs-title">' + esc(args.title || 'Step through it') + '</span><span class="cxs-sw"></span></div>' +
      '<div class="cxs-main"><div class="cxs-codes">' + codePane('py', args.py) + codePane('js', args.js) + '</div>' +
      '<div class="cxs-side"><div class="cxs-mem"><h5>Memory</h5><div class="cxs-memb"></div></div>' +
      '<div class="cxs-scr"><h5>Screen</h5><pre class="cxs-out" aria-live="polite"></pre></div></div></div>' +
      '<p class="cxs-note" aria-live="polite"></p>' +
      '<div class="cxs-bar"><button type="button" class="cxs-b" data-a="prev" aria-label="Previous step">◀ Back</button>' +
      '<button type="button" class="cxs-b cxs-primary" data-a="next" aria-label="Next step">Next ▶</button>' +
      '<button type="button" class="cxs-b" data-a="play" aria-pressed="false">▶︎ Play</button>' +
      '<button type="button" class="cxs-b" data-a="reset">Reset</button>' +
      '<input class="cxs-range" type="range" min="0" max="' + last + '" value="0" aria-label="Step ' + '" />' +
      '<span class="cxs-ct"></span></div>';
    root.querySelector('.cxs-sw').appendChild(C.switcher(root));
    var memb = root.querySelector('.cxs-memb'), outEl = root.querySelector('.cxs-out'), note = root.querySelector('.cxs-note'),
      range = root.querySelector('.cxs-range'), ct = root.querySelector('.cxs-ct');

    function lines(lang) { return root.querySelectorAll('.cxs-pane[data-l="' + lang + '"] .cxs-l'); }
    function jsLine(ln) { return ln > 0 ? (jm[ln] || ln) : 0; }

    function frameKey(fi, fr, name) { return fi + ':' + fr.fn + ':' + name; }
    function snapshot(s) {
      var m = {};
      (s ? s.st : []).forEach(function (fr, fi) { Object.keys(fr.v).forEach(function (k) { m[frameKey(fi, fr, k)] = JSON.stringify(fr.v[k]); }); });
      return m;
    }
    function mem(s, prev, lang) {
      var before = snapshot(prev), html = '';
      var ids = {};
      s.st.forEach(function (fr) { Object.keys(fr.v).forEach(function (k) { C.ids(fr.v[k], []).forEach(function (i) { (ids[i] = ids[i] || []).push(k); }); }); });
      s.st.forEach(function (fr, fi) {
        var names = Object.keys(fr.v), inner = fi === s.st.length - 1 && fi > 0;
        html += '<div class="cxs-fr' + (inner ? ' cur' : '') + '"><div class="cxs-fh">' + (fr.fn === 'global' ? 'global' : esc(fr.fn) + '( )') + '</div>';
        if (fr.defs && fr.defs.length) html += '<div class="cxs-defs">' + fr.defs.map(function (d) { return '<span class="cxv f">' + esc(d) + '</span>'; }).join('') + '</div>';
        if (!names.length && !(fr.defs && fr.defs.length)) html += '<div class="cxs-empty">nothing stored yet</div>';
        names.forEach(function (k) {
          var v = fr.v[k], changed = before[frameKey(fi, fr, k)] !== JSON.stringify(v);
          var also = C.ids(v, []).slice(0, 1).map(function (i) { return (ids[i] || []).filter(function (x) { return x !== k; }); })[0] || [];
          html += '<div class="cxs-v' + (changed ? ' chg' : '') + '"><span class="cxs-vn">' + esc(k) + '</span><span class="cxs-vv">' + C.val(v, lang) + '</span>' +
            (also.length ? '<span class="cxs-also">same object as ' + also.map(esc).join(', ') + '</span>' : '') + '</div>';
        });
        if (s.k === 'ret' && inner) html += '<div class="cxs-retv"><span class="cxs-vn">hands back</span><span class="cxs-vv">' + C.val(s.ret, lang) + '</span></div>';
        html += '</div>';
      });
      return html;
    }
    function draw() {
      var s = steps[cur], prev = cur > 0 ? steps[cur - 1] : null, m = C.lang.get(), lang = m === 'js' ? 'js' : 'py';
      var seen = {};
      for (var i = 0; i <= cur; i++) if (steps[i].ln > 0) seen[steps[i].ln] = 1;
      ['py', 'js'].forEach(function (l) {
        var rows = lines(l), hit = {};
        Object.keys(seen).forEach(function (n) { hit[l === 'js' ? jsLine(+n) : +n] = 1; });
        var at = l === 'js' ? jsLine(s.ln) : s.ln;
        Array.prototype.forEach.call(rows, function (r, i) {
          var n = i + 1, on = n === at && s.ln > 0;
          r.classList.toggle('cur', on); r.classList.toggle('vis', !on && !!hit[n]); r.classList.toggle('err', on && !!s.err);
          r.querySelector('.cxs-g').textContent = on ? (s.err ? '✗' : '▶') : (hit[n] ? '·' : '');
        });
      });
      root.classList.toggle('cxs-both', m === 'both');
      Array.prototype.forEach.call(root.querySelectorAll('.cxs-pane'), function (p) { p.hidden = !(m === 'both' || p.getAttribute('data-l') === lang); });
      memb.innerHTML = mem(s, prev, lang);
      var o = s.out || '', po = prev ? prev.out || '' : '';
      outEl.innerHTML = o ? (cur > 0 && o.length > po.length && o.indexOf(po) === 0 ? esc(po) + '<mark>' + esc(o.slice(po.length)) + '</mark>' : esc(o)) : '<span class="cxs-empty">nothing printed yet</span>';
      var nt = s.nt ? '<span>' + K.inl(s.nt) + '</span>' : '';
      if (s.err) nt += '<span class="cxs-error"><b>' + (m === 'js' && args.err_js ? esc(args.err_js) : esc(s.err)) + '</b></span>';
      if (s.ln === 0 && !s.err) nt = nt || '<span>The program has finished. Every line ran.</span>';
      note.innerHTML = nt;
      ct.textContent = 'Step ' + (cur + 1) + ' of ' + (last + 1);
      range.value = cur; range.setAttribute('aria-valuetext', 'Step ' + (cur + 1) + ' of ' + (last + 1));
      root.querySelector('[data-a=prev]').disabled = cur === 0;
      root.querySelector('[data-a=next]').disabled = cur === last;
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } var pb = root.querySelector('[data-a=play]'); pb.setAttribute('aria-pressed', 'false'); pb.innerHTML = '▶︎ Play'; }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'next' && cur < last) { stop(); cur++; }
      else if (a === 'prev' && cur > 0) { stop(); cur--; }
      else if (a === 'reset') { stop(); cur = 0; }
      else if (a === 'play') {
        if (timer) { stop(); return; }
        if (cur >= last) cur = 0;
        b.setAttribute('aria-pressed', 'true'); b.innerHTML = '❚❚ Pause';
        timer = setInterval(function () { if (!root.isConnected) { stop(); return; } if (cur < last) { cur++; draw(); } else stop(); }, 1300);
      }
      draw();
    });
    range.addEventListener('input', function () { stop(); cur = +range.value; draw(); });
    root.addEventListener('keydown', function (e) {
      if (e.target === range || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' && cur < last) { stop(); cur++; draw(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' && cur > 0) { stop(); cur--; draw(); e.preventDefault(); }
    });
    C.lang.bind(root, draw);
    root.__stop = stop;
    draw();
    return root;
  };
})();
