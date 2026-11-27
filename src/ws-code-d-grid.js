/* Learn to Code part: Bit's grid world.
   bitgrid  a small robot on a grid. The learner writes Python or JavaScript that moves it, presses Run, and watches Bit act it out.
   args = {id, title, goal, grid, more, energy, win, py, js, sol_py, sol_js, hint, tools}
     more    other maps the same program has to work on (a good program works in every situation, not just one)
     grid    rows of text: # wall  . floor  G goal pad  D dock  B battery  P parcel  and one of ^ > v < for Bit and the way it faces
     win     what must be true at the end: {at:'G', collect:'all'|n, deliver:'all'|n, says:[text], minEnergy:n, maxLines:n}
   The learner's program runs against a copy of the world that lives in the sandbox (JavaScript) or in Pyodide (Python): the two copies
   are the same rules written twice (bitSim below, and PY_SIM) and test/codeviz.py checks they leave the same log of events.
   Colours come from CSS classes in src/code.add.css so every picture follows the light and dark themes. */
(function () {
  'use strict';
  if (!window.__core || !window.__code) return;
  var K = window.__core, esc = K.esc, h = K.h, C = window.__code, W = window.__widgets = window.__widgets || {};
  var MARK = '@@BIT@@', uid = 0;

  /* ---------- the rules of the world, JavaScript copy (sent to the sandbox as text) ---------- */
  function bitSim(def) {
    var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0], rows = def.grid, H = rows.length, Wd = rows[0].length;
    var ter = [], items = {}, S = { x: 0, y: 0, d: 0, e: def.energy == null ? 20 : def.energy, c: 0, taken: 0, deliv: 0, n: 0 };
    for (var r = 0; r < H; r++) {
      ter.push([]);
      for (var c = 0; c < Wd; c++) {
        var ch = rows[r].charAt(c), ar = '^>v<'.indexOf(ch);
        if (ar >= 0) { S.x = c; S.y = r; S.d = ar; ch = '.'; }
        if (ch === 'B' || ch === 'P') { items[c + ',' + r] = ch; ch = '.'; }
        ter[r].push(ch);
      }
    }
    var ev = [], says = [], err = null;
    function rec(a, k, t) { var o = { a: a, x: S.x, y: S.y, d: S.d, e: S.e, c: S.c }; if (k) o.k = k; if (t !== undefined) o.t = t; ev.push(o); }
    function crash(msg) { rec('crash', null, msg); var e = new Error(msg); e.bit = true; throw e; }
    function tick() { S.n++; if (S.n > 2000) crash('Bit ran out of time: too many steps. Is a loop never ending?'); }
    function at(x, y) { return x >= 0 && y >= 0 && x < Wd && y < H ? ter[y][x] : '#'; }
    function here() { return items[S.x + ',' + S.y] || ''; }
    return {
      move: function () {
        tick(); var nx = S.x + DX[S.d], ny = S.y + DY[S.d];
        if (at(nx, ny) === '#') crash('Bit bumped into a wall.');
        if (S.e <= 0) crash('Bit ran out of energy.');
        S.x = nx; S.y = ny; S.e--; rec('move');
      },
      turnLeft: function () { tick(); S.d = (S.d + 3) % 4; rec('turn'); },
      turnRight: function () { tick(); S.d = (S.d + 1) % 4; rec('turn'); },
      frontIsClear: function () { return at(S.x + DX[S.d], S.y + DY[S.d]) !== '#'; },
      onBattery: function () { return here() === 'B'; },
      onParcel: function () { return here() === 'P'; },
      onDock: function () { return ter[S.y][S.x] === 'D'; },
      onGoal: function () { return ter[S.y][S.x] === 'G'; },
      take: function () {
        tick(); var k = here();
        if (!k) crash('There is nothing here to take.');
        if (k === 'P' && S.c) crash("Bit's hands are full: put the parcel down first.");
        delete items[S.x + ',' + S.y];
        if (k === 'B') { S.e += 5; S.taken++; } else S.c = 1;
        rec('take', k);
      },
      putDown: function () {
        tick();
        if (!S.c) crash('Bit is not carrying anything.');
        if (here()) crash('There is already something on this square.');
        S.c = 0;
        if (ter[S.y][S.x] === 'D') { S.deliv++; rec('put', 'D'); } else { items[S.x + ',' + S.y] = 'P'; rec('put', 'P'); }
      },
      batteryLevel: function () { return S.e; },
      say: function (x) { tick(); says.push(String(x)); rec('say', null, String(x)); },
      fail: function (e) { err = e && e.bit ? e.message : ((e && e.name ? e.name + ': ' : '') + (e && e.message !== undefined ? e.message : e)); },
      result: function () { return { ev: ev, says: says, fin: { x: S.x, y: S.y, d: S.d, e: S.e, c: S.c, taken: S.taken, deliv: S.deliv }, err: err }; }
    };
  }
  var JS_API = ['move', 'turnLeft', 'turnRight', 'frontIsClear', 'onBattery', 'onParcel', 'onDock', 'onGoal', 'take', 'putDown', 'batteryLevel', 'say'];
  function jsProgram(def, code) {
    return 'var __bit = (' + bitSim.toString() + ')(' + JSON.stringify(def) + ');\n' +
      JS_API.map(function (n) { return 'var ' + n + ' = __bit.' + n + ';'; }).join(' ') + '\n' +
      'try {\n' + code + '\n} catch (__e) { __bit.fail(__e); }\n' +
      'console.log(' + JSON.stringify(MARK) + ' + JSON.stringify(__bit.result()));';
  }

  /* ---------- the same rules, Python copy (run in Pyodide) ---------- */
  var PY_SIM = [
    'import json as _j',
    '_D = _j.loads(__DEF__)',
    '_DX = [0, 1, 0, -1]',
    '_DY = [-1, 0, 1, 0]',
    '_rows = _D["grid"]',
    '_H = len(_rows)',
    '_W = len(_rows[0])',
    '_S = {"x": 0, "y": 0, "d": 0, "e": _D.get("energy", 20), "c": 0, "taken": 0, "deliv": 0, "n": 0}',
    '_ter = []',
    '_items = {}',
    'for _r in range(_H):',
    '    _ter.append([])',
    '    for _c in range(_W):',
    '        _ch = _rows[_r][_c]',
    '        if _ch in "^>v<":',
    '            _S["x"], _S["y"], _S["d"] = _c, _r, "^>v<".index(_ch)',
    '            _ch = "."',
    '        if _ch in "BP":',
    '            _items[(_c, _r)] = _ch',
    '            _ch = "."',
    '        _ter[_r].append(_ch)',
    '_ev = []',
    '_says = []',
    '_err = [None]',
    'class _Crash(Exception):',
    '    pass',
    'def _rec(a, k=None, t=None):',
    '    o = {"a": a, "x": _S["x"], "y": _S["y"], "d": _S["d"], "e": _S["e"], "c": _S["c"]}',
    '    if k:',
    '        o["k"] = k',
    '    if t is not None:',
    '        o["t"] = t',
    '    _ev.append(o)',
    'def _crash(msg):',
    '    _rec("crash", None, msg)',
    '    raise _Crash(msg)',
    'def _tick():',
    '    _S["n"] += 1',
    '    if _S["n"] > 2000:',
    '        _crash("Bit ran out of time: too many steps. Is a loop never ending?")',
    'def _at(x, y):',
    '    return _ter[y][x] if 0 <= x < _W and 0 <= y < _H else "#"',
    'def _here():',
    '    return _items.get((_S["x"], _S["y"]), "")',
    'def move():',
    '    _tick()',
    '    nx, ny = _S["x"] + _DX[_S["d"]], _S["y"] + _DY[_S["d"]]',
    '    if _at(nx, ny) == "#":',
    '        _crash("Bit bumped into a wall.")',
    '    if _S["e"] <= 0:',
    '        _crash("Bit ran out of energy.")',
    '    _S["x"], _S["y"] = nx, ny',
    '    _S["e"] -= 1',
    '    _rec("move")',
    'def turn_left():',
    '    _tick()',
    '    _S["d"] = (_S["d"] + 3) % 4',
    '    _rec("turn")',
    'def turn_right():',
    '    _tick()',
    '    _S["d"] = (_S["d"] + 1) % 4',
    '    _rec("turn")',
    'def front_is_clear():',
    '    return _at(_S["x"] + _DX[_S["d"]], _S["y"] + _DY[_S["d"]]) != "#"',
    'def on_battery():',
    '    return _here() == "B"',
    'def on_parcel():',
    '    return _here() == "P"',
    'def on_dock():',
    '    return _ter[_S["y"]][_S["x"]] == "D"',
    'def on_goal():',
    '    return _ter[_S["y"]][_S["x"]] == "G"',
    'def take():',
    '    _tick()',
    '    k = _here()',
    '    if not k:',
    '        _crash("There is nothing here to take.")',
    '    if k == "P" and _S["c"]:',
    '        _crash("Bit\'s hands are full: put the parcel down first.")',
    '    del _items[(_S["x"], _S["y"])]',
    '    if k == "B":',
    '        _S["e"] += 5',
    '        _S["taken"] += 1',
    '    else:',
    '        _S["c"] = 1',
    '    _rec("take", k)',
    'def put_down():',
    '    _tick()',
    '    if not _S["c"]:',
    '        _crash("Bit is not carrying anything.")',
    '    if _here():',
    '        _crash("There is already something on this square.")',
    '    _S["c"] = 0',
    '    if _ter[_S["y"]][_S["x"]] == "D":',
    '        _S["deliv"] += 1',
    '        _rec("put", "D")',
    '    else:',
    '        _items[(_S["x"], _S["y"])] = "P"',
    '        _rec("put", "P")',
    'def battery_level():',
    '    return _S["e"]',
    'def say(x):',
    '    _tick()',
    '    _says.append(str(x))',
    '    _rec("say", None, str(x))',
    'def _fail(e):',
    '    if isinstance(e, _Crash):',
    '        _err[0] = str(e)',
    '    else:',
    '        ln = getattr(e, "lineno", None)',
    '        tb = e.__traceback__',
    '        while tb is not None:',
    '            if tb.tb_frame.f_code.co_filename == "your code":',
    '                ln = tb.tb_lineno',
    '            tb = tb.tb_next',
    '        _err[0] = type(e).__name__ + ": " + str(e) + (" (line " + str(ln) + ")" if ln else "")',
    'def _run(src):',
    '    ns = {"__name__": "__main__", "move": move, "turn_left": turn_left, "turn_right": turn_right, "front_is_clear": front_is_clear,',
    '          "on_battery": on_battery, "on_parcel": on_parcel, "on_dock": on_dock, "on_goal": on_goal, "take": take,',
    '          "put_down": put_down, "battery_level": battery_level, "say": say}',
    '    try:',
    '        exec(compile(src, "your code", "exec"), ns)',
    '    except BaseException as e:',
    '        _fail(e)',
    'def _result():',
    '    return {"ev": _ev, "says": _says, "fin": {"x": _S["x"], "y": _S["y"], "d": _S["d"], "e": _S["e"], "c": _S["c"], "taken": _S["taken"], "deliv": _S["deliv"]}, "err": _err[0]}'
  ].join('\n');
  function pyProgram(def, code) {
    return PY_SIM.replace('__DEF__', JSON.stringify(JSON.stringify(def))) + '\n_run(' + JSON.stringify(code) + ')\nprint(' + JSON.stringify(MARK) + ' + _j.dumps(_result()))\n';
  }

  /* run the learner's code in the chosen language; resolves {ev, says, fin, err, log} (log is what print or console.log wrote) */
  function execute(lang, def, code) {
    function split(out) {
      var i = out.lastIndexOf(MARK);
      if (i < 0) return null;
      var res; try { res = JSON.parse(out.slice(i + MARK.length)); } catch (e) { return null; }
      res.log = out.slice(0, i).replace(/\n$/, ''); return res;
    }
    var sim = { grid: def.grid, energy: def.energy };
    if (lang === 'py') {
      return window.__py.run(pyProgram(sim, code), '', '').then(function (r) {
        return split(r.out || '') || { ev: [], says: [], fin: null, err: r.msg || 'Python could not run this.', log: r.out || '' };
      });
    }
    return window.__js.run(jsProgram(sim, code), { module: false }).then(function (r) {
      var res = split(r.out || '');
      if (res) return res;
      var errs = (r.logs || []).filter(function (l) { return l.uncaught || l.sys; }).map(function (l) { return l.text; });
      return { ev: [], says: [], fin: null, err: errs.join('\n') || r.msg || 'JavaScript could not run this.', log: r.out || '' };
    });
  }

  /* ---------- reading a grid ---------- */
  function parse(def) {
    var rows = def.grid, o = { w: rows[0].length, h: rows.length, ter: [], items: {}, start: null, nB: 0, nP: 0 };
    rows.forEach(function (row, y) {
      o.ter.push([]);
      row.split('').forEach(function (ch, x) {
        var a = '^>v<'.indexOf(ch);
        if (a >= 0) { o.start = { x: x, y: y, d: a }; ch = '.'; }
        if (ch === 'B') { o.items[x + ',' + y] = 'B'; o.nB++; ch = '.'; }
        if (ch === 'P') { o.items[x + ',' + y] = 'P'; o.nP++; ch = '.'; }
        o.ter[y].push(ch);
      });
    });
    return o;
  }
  var DIRNAME = ['north', 'east', 'south', 'west'];

  /* what has to be true for the mission to be solved, checked against the end state */
  function judge(def, g, res, code) {
    var w = def.win || {}, f = res.fin, bad = [];
    if (res.err) return ['The program stopped: ' + res.err];
    if (!f) return ['The program did not finish.'];
    if (w.at && g.ter[f.y][f.x] !== w.at) bad.push(w.at === 'G' ? 'Bit is not standing on the goal pad yet.' : 'Bit is not on the dock yet.');
    if (w.collect) { var nb = w.collect === 'all' ? g.nB : w.collect; if (f.taken < nb) bad.push('Bit has collected ' + f.taken + ' of ' + nb + ' batteries.'); }
    if (w.deliver) { var np = w.deliver === 'all' ? g.nP : w.deliver; if (f.deliv < np) bad.push('Bit has delivered ' + f.deliv + ' of ' + np + ' parcels.'); }
    (w.says || []).forEach(function (t) { if (res.says.indexOf(t) < 0) bad.push('Bit never said "' + t + '".'); });
    if (w.minEnergy !== undefined && f.e < w.minEnergy) bad.push('Bit finished with ' + f.e + ' energy; the mission needs at least ' + w.minEnergy + '.');
    if (w.maxLines) {
      var n = code.split('\n').filter(function (l) { var t = l.trim(); return t && t.indexOf('#') !== 0 && t.indexOf('//') !== 0 && !/^[}\])]+[;,]?$/.test(t); }).length;
      if (n > w.maxLines) bad.push('Your program has ' + n + ' lines of code; this mission allows ' + w.maxLines + '. Is there something you could repeat or reuse?');
    }
    return bad;
  }
  function goalText(def, g) {
    var w = def.win || {}, bits = [];
    if (w.at === 'G') bits.push('end on the goal pad');
    if (w.at === 'D') bits.push('end on the dock');
    if (w.collect) bits.push('collect ' + (w.collect === 'all' ? 'every battery (' + g.nB + ')' : w.collect + ' battery'));
    if (w.deliver) bits.push('deliver ' + (w.deliver === 'all' ? 'every parcel (' + g.nP + ')' : w.deliver + ' parcel'));
    (w.says || []).forEach(function (t) { bits.push('say "' + t + '"'); });
    if (w.minEnergy !== undefined) bits.push('finish with at least ' + w.minEnergy + ' energy');
    if (w.maxLines) bits.push('use at most ' + w.maxLines + ' lines');
    return bits.join(', ');
  }

  /* ---------- drawing ---------- */
  var CELL = 44;
  function cellSvg(g) {
    var s = '', x, y;
    for (y = 0; y < g.h; y++) for (x = 0; x < g.w; x++) {
      var t = g.ter[y][x], X = x * CELL, Y = y * CELL;
      if (t === '#') s += '<rect class="cxg-wall" x="' + X + '" y="' + Y + '" width="' + CELL + '" height="' + CELL + '"/><path class="cxg-hatch" d="M' + X + ' ' + (Y + 14) + 'L' + (X + 14) + ' ' + Y + 'M' + X + ' ' + (Y + 30) + 'L' + (X + 30) + ' ' + Y + 'M' + X + ' ' + (Y + CELL) + 'L' + (X + CELL) + ' ' + Y + 'M' + (X + 14) + ' ' + (Y + CELL) + 'L' + (X + CELL) + ' ' + (Y + 14) + 'M' + (X + 30) + ' ' + (Y + CELL) + 'L' + (X + CELL) + ' ' + (Y + 30) + '"/>';
      else {
        s += '<rect class="cxg-floor" x="' + X + '" y="' + Y + '" width="' + CELL + '" height="' + CELL + '"/>';
        if (t === 'G') s += '<g class="cxg-goal"><circle cx="' + (X + 22) + '" cy="' + (Y + 22) + '" r="15"/><circle cx="' + (X + 22) + '" cy="' + (Y + 22) + '" r="8"/><circle cx="' + (X + 22) + '" cy="' + (Y + 22) + '" r="2.5" class="dot"/></g>';
        if (t === 'D') s += '<g class="cxg-dock"><rect x="' + (X + 6) + '" y="' + (Y + 6) + '" width="32" height="32" rx="4"/><path d="M' + (X + 14) + ' ' + (Y + 22) + 'H' + (X + 30) + 'M' + (X + 25) + ' ' + (Y + 16) + 'L' + (X + 31) + ' ' + (Y + 22) + 'L' + (X + 25) + ' ' + (Y + 28) + '"/></g>';
      }
    }
    return s;
  }
  function itemSvg(kind, x, y) {
    var X = x * CELL, Y = y * CELL;
    if (kind === 'B') return '<g class="cxg-it cxg-bat" data-k="' + x + ',' + y + '"><rect x="' + (X + 13) + '" y="' + (Y + 9) + '" width="18" height="26" rx="3"/><rect class="cap" x="' + (X + 19) + '" y="' + (Y + 6) + '" width="6" height="4" rx="1"/><path class="bolt" d="M' + (X + 23) + ' ' + (Y + 14) + 'L' + (X + 17) + ' ' + (Y + 24) + 'H' + (X + 22) + 'L' + (X + 20) + ' ' + (Y + 31) + 'L' + (X + 27) + ' ' + (Y + 20) + 'H' + (X + 22) + 'Z"/></g>';
    return '<g class="cxg-it cxg-par" data-k="' + x + ',' + y + '"><rect x="' + (X + 10) + '" y="' + (Y + 12) + '" width="24" height="21" rx="2"/><path d="M' + (X + 10) + ' ' + (Y + 19) + 'H' + (X + 34) + 'M' + (X + 22) + ' ' + (Y + 12) + 'V' + (Y + 19) + '"/></g>';
  }
  function bitSvg() {   // faces up (north); the group is rotated to face the other ways
    return '<g class="cxg-bit"><g class="cxg-bit-r"><rect class="body" x="-14" y="-13" width="28" height="27" rx="8"/><rect class="eye" x="-9" y="-9" width="18" height="8" rx="4"/><circle class="pupil" cx="-4" cy="-5" r="1.7"/><circle class="pupil" cx="4" cy="-5" r="1.7"/><path class="nose" d="M-5 -16L0 -22L5 -16Z"/><rect class="wheel" x="-17" y="2" width="4" height="12" rx="2"/><rect class="wheel" x="13" y="2" width="4" height="12" rx="2"/></g></g>';
  }

  W.bitgrid = function (args) {
    var def = args, worlds = [args.grid].concat(args.more || []), wi = 0, g = parse({ grid: worlds[0] }), id = 'bg' + (++uid), lang = C.lang.get() === 'js' ? 'js' : 'py';
    var root = h('div', { class: 'wg cxg' });
    var code = { py: def.py || '', js: def.js || '' };
    var vw = g.w * CELL, vh = g.h * CELL, multi = worlds.length > 1;
    root.innerHTML =
      '<div class="cxs-head"><span class="cxs-title">' + esc(def.title || 'Bit’s grid') + '</span><span class="cxs-sw"></span></div>' +
      '<p class="cxg-goal-t"><b>Mission:</b> ' + K.inl(def.goal || '') + ' <span class="cxg-need">To solve it: ' + esc(goalText(def, g)) + '.</span></p>' +
      '<div class="cxg-main"><div class="cxg-world"><svg viewBox="0 0 ' + vw + ' ' + vh + '" role="img" aria-label="Bit’s world" style="max-width:' + vw * 1.15 + 'px"><g class="cxg-t">' + cellSvg(g) + '</g><g class="cxg-its"></g>' + bitSvg() + '</svg>' +
      '' + (multi ? '<div class="cxg-maps" role="group" aria-label="Maps">Map ' + worlds.map(function (w, i) { return '<button type="button" class="cxs-b cxg-mp" data-m="' + i + '">' + (i + 1) + '</button>'; }).join('') + '</div>' : '') + '<div class="cxg-chips"><span class="cxg-chip" data-c="e"></span><span class="cxg-chip" data-c="c"></span>' + (g.nB ? '<span class="cxg-chip" data-c="b"></span>' : '') + (g.nP ? '<span class="cxg-chip" data-c="p"></span>' : '') + '</div>' +
      '<p class="cxg-say" aria-live="polite"></p></div>' +
      '<div class="cxg-code"><div class="cxs-ph"><span class="cxg-lg"></span><span class="sp"></span><button type="button" class="cxs-b" data-a="reset">Reset</button></div>' +
      '<textarea class="ed" spellcheck="false" aria-label="Your code"></textarea>' +
      '<div class="cxg-btns"><button type="button" class="cxs-b cxs-primary" data-a="run">▶ Run</button><button type="button" class="cxs-b" data-a="step">Step</button>' + (multi ? '<button type="button" class="cxs-b" data-a="all">Check all ' + worlds.length + ' maps</button>' : '') +
      '<label class="cxg-spd">Speed <select aria-label="Speed"><option value="520">Slow</option><option value="260" selected>Normal</option><option value="90">Fast</option></select></label></div></div></div>' +
      '<div class="cxg-res" aria-live="polite"></div>' +
      '<details class="cxg-ref"><summary>Bit’s commands</summary><div class="cxg-refb"></div></details>' +
      (def.hint ? '<details class="cxg-hint"><summary>Hint</summary><div>' + K.inl(def.hint) + '</div></details>' : '') +
      '<details class="cxg-sol"><summary>Show a solution</summary><div class="cxg-solb"></div></details>';
    root.querySelector('.cxs-sw').appendChild(C.switcher(root, { noBoth: true }));
    var svg = root.querySelector('svg'), itsG = root.querySelector('.cxg-its'), bit = root.querySelector('.cxg-bit'), bitR = root.querySelector('.cxg-bit-r'),
      ta = root.querySelector('textarea'), resEl = root.querySelector('.cxg-res'), sayEl = root.querySelector('.cxg-say'),
      runB = root.querySelector('[data-a=run]'), stepB = root.querySelector('[data-a=step]'), spd = root.querySelector('select');

    var st, ang, timer = null, res = null, idx = 0, busy = false, checking = false;
    function drawWorld() {
      svg.setAttribute('viewBox', '0 0 ' + g.w * CELL + ' ' + g.h * CELL); svg.style.maxWidth = Math.round(g.w * CELL * 1.15) + 'px';
      root.querySelector('.cxg-t').innerHTML = cellSvg(g);
      Array.prototype.forEach.call(root.querySelectorAll('.cxg-mp'), function (b) { var on = +b.getAttribute('data-m') === wi; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }
    /* a replay belongs to the code that made it: changing the code or the language ends it */
    function cancel() { if (busy) { reset(false); runB.textContent = '▶ Run'; } }
    function loadWorld(i) { wi = i; g = parse({ grid: worlds[i] }); drawWorld(); reset(false); }
    function setBit(x, y, d, instant) {
      var diff = ((d - st.d) % 4 + 4) % 4;
      if (instant) ang = d * 90; else if (diff === 1) ang += 90; else if (diff === 3) ang -= 90; else if (diff === 2) ang += 180;
      bit.style.transition = bitR.style.transition = instant ? 'none' : '';
      bit.style.transform = 'translate(' + (x * CELL + CELL / 2) + 'px,' + (y * CELL + CELL / 2) + 'px)';
      bitR.style.transform = 'rotate(' + ang + 'deg)';
    }
    function chips() {
      var q = function (c) { return root.querySelector('[data-c=' + c + ']'); };
      q('e').textContent = 'Energy ' + st.e; q('c').textContent = st.c ? 'Carrying a parcel' : 'Hands empty';
      if (q('b')) q('b').textContent = 'Batteries ' + st.taken + ' / ' + g.nB;
      if (q('p')) q('p').textContent = 'Delivered ' + st.deliv + ' / ' + g.nP;
    }
    function drawItems() {
      itsG.innerHTML = Object.keys(st.items).map(function (k) { var p = k.split(','); return itemSvg(st.items[k], +p[0], +p[1]); }).join('');
    }
    function reset(keepRes) {
      if (timer) { clearTimeout(timer); timer = null; }
      st = { x: g.start.x, y: g.start.y, d: g.start.d, e: def.energy == null ? 20 : def.energy, c: 0, taken: 0, deliv: 0, items: JSON.parse(JSON.stringify(g.items)) };
      ang = st.d * 90; idx = 0; busy = false;
      setBit(st.x, st.y, st.d, true); drawItems(); chips(); sayEl.textContent = '';
      svg.classList.remove('crash'); root.classList.remove('cxg-won');
      if (!keepRes) { res = null; resEl.className = 'cxg-res'; resEl.innerHTML = ''; }
      stepB.textContent = 'Step';
    }
    function apply(ev) {
      if (ev.a === 'crash') { svg.classList.add('crash'); sayEl.textContent = ''; return; }
      if (ev.a === 'take') { delete st.items[ev.x + ',' + ev.y]; if (ev.k === 'B') st.taken++; drawItems(); }
      if (ev.a === 'put') { if (ev.k === 'D') st.deliv++; else st.items[ev.x + ',' + ev.y] = 'P'; drawItems(); }
      if (ev.a === 'say') sayEl.textContent = 'Bit says: ' + ev.t;
      setBit(ev.x, ev.y, ev.d);
      st.x = ev.x; st.y = ev.y; st.d = ev.d; st.e = ev.e; st.c = ev.c; chips();
    }
    function finish() {
      busy = false; runB.textContent = '▶ Run'; stepB.textContent = 'Step';
      var bad = judge(def, g, res, code[lang]);
      var out = '';
      if (res.log) out += '<pre class="cxg-log">' + esc(res.log) + '</pre>';
      if (res.err && res.ev.length && res.ev[res.ev.length - 1].a === 'crash') out += '<p class="cxg-msg bad"><b>Bit crashed.</b> ' + esc(res.err) + '</p>';
      else if (res.err) out += '<p class="cxg-msg bad"><b>Error.</b> <code>' + esc(res.err) + '</code></p>';
      if (!bad.length && multi) {
        out += '<p class="cxg-msg ok"><b>Solved on map ' + (wi + 1) + '.</b> A good program works everywhere: press <b>Check all ' + worlds.length + ' maps</b> to test the others.</p>'; root.classList.add('cxg-won');
      } else if (!bad.length) {
        out += '<p class="cxg-msg ok"><b>Solved!</b> Bit did exactly what you asked.</p>'; root.classList.add('cxg-won');
        K.S.done['bg:' + def.id] = 1; K.save();
      } else if (!res.err) out += '<p class="cxg-msg warn"><b>Not yet.</b> ' + bad.map(esc).join(' ') + '</p>';
      resEl.className = 'cxg-res show'; resEl.innerHTML = out;
      svg.setAttribute('aria-label', 'Bit is at column ' + (st.x + 1) + ', row ' + (st.y + 1) + ', facing ' + DIRNAME[st.d]);
    }
    function tickPlay() {
      if (idx >= res.ev.length) { finish(); return; }
      apply(res.ev[idx++]);
      timer = setTimeout(tickPlay, +spd.value);
    }
    function start(auto) {
      if (busy) return;
      reset(false); busy = true; var b = auto ? runB : stepB, old = b.textContent;
      b.textContent = lang === 'py' && window.__py.state() !== 'ready' ? 'Loading Python…' : 'Running…';
      execute(lang, { grid: worlds[wi], energy: def.energy }, ta.value).then(function (r) {
        res = r; b.textContent = old;
        resEl.className = 'cxg-res'; resEl.innerHTML = '';
        if (auto) { runB.textContent = '❚❚ Pause'; tickPlay(); }
        else { stepB.textContent = 'Step ▸'; if (res.ev.length) apply(res.ev[idx++]); else finish(); }
      });
    }
    function checkAll() {
      if (busy || checking) return;
      checking = true; var b = root.querySelector('[data-a=all]'), old = b.textContent; b.textContent = lang === 'py' && window.__py.state() !== 'ready' ? 'Loading Python…' : 'Checking…';
      var rows = [], i = 0;
      (function next() {
        if (i < worlds.length) {
          var gi = parse({ grid: worlds[i] }), at = i;
          execute(lang, { grid: worlds[at], energy: def.energy }, ta.value).then(function (r) { rows.push({ r: r, bad: judge(def, gi, r, ta.value) }); i++; next(); });
          return;
        }
        checking = false; b.textContent = old;
        var first = -1; rows.forEach(function (x, k) { if (x.bad.length && first < 0) first = k; });
        if (first >= 0 && first !== wi) loadWorld(first); else reset(false);
        var html = '<ul class="cxg-all">' + rows.map(function (x, k) { return '<li class="' + (x.bad.length ? 'no' : 'yes') + '"><b>Map ' + (k + 1) + '</b> ' + (x.bad.length ? '✗ ' + esc(x.bad[0]) : '✓ solved') + '</li>'; }).join('') + '</ul>';
        if (first < 0) { html += '<p class="cxg-msg ok"><b>Solved on every map!</b> Your program does not depend on one lucky layout.</p>'; root.classList.add('cxg-won'); K.S.done['bg:' + def.id] = 1; K.save(); }
        else html += '<p class="cxg-msg warn"><b>Not on every map yet.</b> Map ' + (first + 1) + ' is showing: press <b>Run</b> or <b>Step</b> to watch what goes wrong there.</p>';
        resEl.className = 'cxg-res show'; resEl.innerHTML = html;
      })();
    }
    root.addEventListener('click', function (e) {
      var mp = e.target.closest('[data-m]');
      if (mp) { if (!busy && !checking) loadWorld(+mp.getAttribute('data-m')); return; }
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'all') { checkAll(); return; }
      if (a === 'run') {
        if (busy && timer) { clearTimeout(timer); timer = null; runB.textContent = '▶ Resume'; stepB.textContent = 'Step ▸'; return; }
        if (busy && res) { runB.textContent = '❚❚ Pause'; tickPlay(); return; }
        start(true);
      } else if (a === 'step') {
        if (busy && res) { if (timer) { clearTimeout(timer); timer = null; runB.textContent = '▶ Resume'; } if (idx >= res.ev.length) finish(); else apply(res.ev[idx++]); if (idx >= res.ev.length) finish(); }
        else start(false);
      } else if (a === 'reset') { ta.value = lang === 'js' ? def.js || '' : def.py || ''; code[lang] = ta.value; K.autoSize(ta); reset(false); }
    });
    ta.addEventListener('input', function () { code[lang] = ta.value; K.autoSize(ta); cancel(); });
    ta.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (!busy) start(true); } });

    var REF = {
      py: [['move()', 'one square forward (a wall crashes Bit; every move costs 1 energy)'], ['turn_left()', 'turn a quarter turn left'], ['turn_right()', 'turn a quarter turn right'],
        ['front_is_clear()', 'True when the square ahead is not a wall'], ['on_battery()', 'True when Bit stands on a battery'], ['on_parcel()', 'True when Bit stands on a parcel'], ['on_dock()', 'True on the dock'], ['on_goal()', 'True on the goal pad'],
        ['take()', 'pick up what is here (a battery gives +5 energy)'], ['put_down()', 'put the parcel down; on the dock that delivers it'], ['battery_level()', 'how much energy Bit has left'], ['say(x)', 'Bit says x out loud']],
      js: [['move()', 'one square forward (a wall crashes Bit; every move costs 1 energy)'], ['turnLeft()', 'turn a quarter turn left'], ['turnRight()', 'turn a quarter turn right'],
        ['frontIsClear()', 'true when the square ahead is not a wall'], ['onBattery()', 'true when Bit stands on a battery'], ['onParcel()', 'true when Bit stands on a parcel'], ['onDock()', 'true on the dock'], ['onGoal()', 'true on the goal pad'],
        ['take()', 'pick up what is here (a battery gives +5 energy)'], ['putDown()', 'put the parcel down; on the dock that delivers it'], ['batteryLevel()', 'how much energy Bit has left'], ['say(x)', 'Bit says x out loud']]
    };
    var need = def.tools || ['move', 'turn'];
    function paintRef() {
      var rows = REF[lang].filter(function (r) { return need === 'all' || need.some(function (n) { return r[0].toLowerCase().replace(/_/g, '').indexOf(n.toLowerCase().replace(/_/g, '')) === 0; }); });
      root.querySelector('.cxg-refb').innerHTML = '<table><tbody>' + rows.map(function (r) { return '<tr><td><code>' + esc(r[0]) + '</code></td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table>';
    }
    function paintSol() {
      var s = lang === 'js' ? def.sol_js : def.sol_py;
      root.querySelector('.cxg-solb').innerHTML = s ? '<pre class="cxs-out">' + esc(s) + '</pre>' : '<p class="cxs-empty">No solution is shown for this one.</p>';
    }
    function paintLang() {
      var m = C.lang.get(), nl = m === 'js' ? 'js' : 'py';
      cancel(); code[lang] = ta.value; lang = nl; ta.value = code[lang];
      root.querySelector('.cxg-lg').textContent = C.langName(lang);
      paintRef(); paintSol(); K.autoSize(ta); if (!busy) reset(true);
    }
    C.lang.bind(root, paintLang);
    ta.value = code[lang]; root.querySelector('.cxg-lg').textContent = C.langName(lang);
    reset(false); paintRef(); paintSol(); drawWorld();
    /* for tests: run `text` in language l on every map and say which maps pass */
    root.__run = function (l, text, map) {
      var i = map || 0, gi = parse({ grid: worlds[i] });
      return execute(l, { grid: worlds[i], energy: def.energy }, text).then(function (r) { return { res: r, bad: judge(def, gi, r, text) }; });
    };
    root.__worlds = worlds.length;
    return root;
  };
})();
