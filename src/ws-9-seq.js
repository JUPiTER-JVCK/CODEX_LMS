/* Shared by the VPN and nmap labs: a step-through message-sequence diagram.
   window.__netviz.seq(cfg) returns an element. cfg = {
     label: aria-label for the figure,
     actors: [{label, sub}],                       two or three columns
     steps: [{f, t, label, kind, note, trace}],    f and t are actor indexes; kind is
            req (blue), ok (green), bad (red), warn (amber), data (accent) or none (nothing came back)
     verdict: {cls: ok|bad|warn|mute, head, text}  shown when the last step is reached
   }
   Colours come from CSS classes in src/seq.add.css so every picture follows the light and dark themes. */
(function () {
  'use strict';
  if (!window.__core) return;
  var K = window.__core, esc = K.esc, h = K.h;
  var NV = window.__netviz = window.__netviz || {};
  var uid = 0;

  NV.seq = function (cfg) {
    var id = 'sq' + (++uid), n = cfg.actors.length, W = 720, X0 = 96, X1 = W - 96, ROW = 52, TOP = 96;
    var xs = cfg.actors.map(function (a, i) { return n === 1 ? W / 2 : Math.round(X0 + i * (X1 - X0) / (n - 1)); });
    var H = TOP + cfg.steps.length * ROW + 14;
    var cur = 0, timer = null;
    var root = h('div', { class: 'sq' });
    var svg = '<div class="sq-scroll"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.label || 'Message sequence') + '" style="min-width:560px">' +
      '<defs>' + ['req', 'ok', 'bad', 'warn', 'data'].map(function (k) {
        return '<marker id="' + id + '-' + k + '" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M0 0L10 5L0 10z" class="sq-ah sq-' + k + '"/></marker>';
      }).join('') + '</defs>';
    cfg.actors.forEach(function (a, i) {
      svg += '<g class="sq-actor"><rect x="' + (xs[i] - 78) + '" y="6" width="156" height="50" rx="9"/><text x="' + xs[i] + '" y="28" text-anchor="middle" class="sq-an">' + esc(a.label) + '</text>' +
        '<text x="' + xs[i] + '" y="45" text-anchor="middle" class="sq-as">' + esc(a.sub || '') + '</text></g>' +
        '<line x1="' + xs[i] + '" y1="58" x2="' + xs[i] + '" y2="' + (H - 6) + '" class="sq-life"/>';
    });
    cfg.steps.forEach(function (s, i) {
      var y = TOP + i * ROW, k = s.kind || 'req', x1 = xs[s.f], x2 = xs[s.t], mid = (x1 + x2) / 2;
      svg += '<g class="sq-step" data-i="' + i + '">';
      if (k === 'none') {
        var lo = Math.min(xs[0], xs[n - 1]) + 14, hi = Math.max(xs[0], xs[n - 1]) - 14;
        svg += '<line x1="' + lo + '" y1="' + y + '" x2="' + hi + '" y2="' + y + '" class="sq-silent"/>' +
          '<rect x="' + (W / 2 - 128) + '" y="' + (y - 14) + '" width="256" height="28" rx="14" class="sq-pill"/>' +
          '<text x="' + W / 2 + '" y="' + (y + 5) + '" text-anchor="middle" class="sq-pt">' + esc(s.label) + '</text>';
      } else {
        var dir = x2 > x1 ? 1 : -1;
        svg += '<line x1="' + x1 + '" y1="' + y + '" x2="' + (x2 - dir * 2) + '" y2="' + y + '" class="sq-arrow sq-' + k + '" marker-end="url(#' + id + '-' + k + ')"/>' +
          '<text x="' + mid + '" y="' + (y - 9) + '" text-anchor="middle" class="sq-lab sq-t-' + k + '">' + esc(s.label) + '</text>';
      }
      svg += '</g>';
    });
    svg += '</svg></div>';

    var bar = h('div', { class: 'sq-bar' });
    bar.innerHTML = '<button type="button" class="sq-b" data-a="prev" aria-label="Previous step">◀ Back</button>' +
      '<span class="sq-ct" aria-live="polite"></span>' +
      '<button type="button" class="sq-b sq-primary" data-a="next" aria-label="Next step">Next ▶</button>' +
      '<button type="button" class="sq-b" data-a="play" aria-pressed="false">▶︎ Play</button>' +
      '<button type="button" class="sq-b" data-a="reset">Reset</button>';
    var note = h('div', { class: 'sq-note', 'aria-live': 'polite' });
    root.innerHTML = svg;
    root.appendChild(bar); root.appendChild(note);

    function stop() { if (timer) { clearInterval(timer); timer = null; } var pb = bar.querySelector('[data-a=play]'); pb.setAttribute('aria-pressed', 'false'); pb.innerHTML = '▶︎ Play'; }
    function draw() {
      var last = cfg.steps.length - 1;
      Array.prototype.forEach.call(root.querySelectorAll('.sq-step'), function (g) {
        var i = +g.getAttribute('data-i');
        g.setAttribute('class', 'sq-step' + (i <= cur ? ' on' : ' off') + (i === cur ? ' cur' : ''));
      });
      bar.querySelector('.sq-ct').textContent = 'Step ' + (cur + 1) + ' of ' + (last + 1);
      bar.querySelector('[data-a=prev]').disabled = cur === 0;
      bar.querySelector('[data-a=next]').disabled = cur === last;
      var s = cfg.steps[cur], html = '<p class="sq-text">' + K.inl(s.note || '') + '</p>';
      if (s.trace) html += '<pre class="sq-trace" aria-label="nmap --packet-trace line">' + esc(s.trace) + '</pre>';
      if (cur === last && cfg.verdict) {
        var v = cfg.verdict;
        html += '<div class="sq-verdict sq-v-' + (v.cls || 'mute') + '"><b>' + esc(v.head) + '</b><span>' + K.inl(v.text || '') + '</span></div>';
      }
      note.innerHTML = html;
    }
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'next' && cur < cfg.steps.length - 1) { stop(); cur++; }
      else if (a === 'prev' && cur > 0) { stop(); cur--; }
      else if (a === 'reset') { stop(); cur = 0; }
      else if (a === 'play') {
        if (timer) { stop(); return; }
        if (cur >= cfg.steps.length - 1) cur = 0;
        b.setAttribute('aria-pressed', 'true'); b.innerHTML = '❚❚ Pause';
        timer = setInterval(function () { if (cur < cfg.steps.length - 1) { cur++; draw(); } else stop(); }, 1500);
      }
      draw();
    });
    root.addEventListener('click', function (e) {
      var g = e.target.closest('.sq-step'); if (!g) return;
      stop(); cur = +g.getAttribute('data-i'); draw();
    });
    // a figure that is removed from the page must not keep ticking
    root.__stop = stop;
    draw();
    return root;
  };
})();
