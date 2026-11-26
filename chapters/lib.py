"""Helpers that build chapter JSON in the exact block shapes the page engine renders.

Each chapter module defines CHAPTER = chapter(...). Run tools/chapters.py to write data/new/*.json.
Inline markup inside text: `code`, **bold**, *em*, [[key]] (kbd), {{var}} (placeholder), [text](url).
"""
import re
import textwrap

_line = [0]


def _ln():
    _line[0] += 2
    return _line[0]


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def d(s):
    """Dedent a triple-quoted string and strip the outer newlines."""
    return textwrap.dedent(s).strip('\n')


def P(text):
    return {'t': 'p', 'text': ' '.join(d(text).split('\n')) if '\n' in text else text, 'line': _ln()}


def H(level, text, id=None):
    return {'t': 'h', 'level': level, 'text': text, 'id': id or slug(text), 'line': _ln()}


def H2(text, id=None):
    return H(2, text, id)


def H3(text, id=None):
    return H(3, text, id)


def _items(items):
    out = []
    for it in items:
        if isinstance(it, tuple):
            out.append({'text': it[0], 'children': _items(it[1])})
        else:
            out.append({'text': it, 'children': []})
    return out


def UL(*items):
    return {'t': 'ul', 'items': _items(items), 'line': _ln()}


def OL(*items):
    return {'t': 'ol', 'items': _items(items), 'line': _ln()}


AUTO = object()
_cache = None


def _outcache():
    global _cache
    if _cache is None:
        import json, os
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'outcache.json')
        _cache = json.load(open(p)) if os.path.exists(p) else {}
    return _cache


def okey(lang, code, page=''):
    import hashlib
    return hashlib.sha1((lang + '\0' + code + '\0' + page).encode()).hexdigest()[:16]


def CODE(lang, code, out=None, **attrs):
    b = {'t': 'code', 'lang': lang, 'attrs': attrs, 'code': d(code), 'line': _ln()}
    if out is AUTO:
        b['out'] = _outcache().get(okey(lang, b['code']), '\u2026')
        b['auto'] = True
    elif out is not None:
        b['out'] = d(out) if out else ''
    return b


def SH(code):
    return CODE('sh', code)


def TERM(code, sample=True):
    return CODE('term', code, sample=True) if sample else CODE('term', code)


def FILE(name, code):
    return CODE('file', code, name=name)


def ASCII(code):
    b = CODE('ascii', code)
    b['code'] = textwrap.dedent(code).strip('\n')
    return b


def TEXT(code):
    return CODE('text', code)


def RUN(code, out=AUTO, **attrs):
    return CODE('run', code, out, **attrs)


def JSRUN(code, out=AUTO, **attrs):
    return CODE('jsrun', code, out, **attrs)


def JSON_(code):
    return CODE('json', code)


def CALLOUT(kind, title, *body):
    blocks = [P(x) if isinstance(x, str) else x for x in body]
    for b in blocks:
        b['line'] = 1
    return {'t': 'callout', 'kind': kind, 'title': title, 'blocks': blocks, 'line': _ln()}


def TABLE(head, rows, title=''):
    return {'t': 'table', 'head': head, 'rows': rows, 'title': title, 'line': _ln()}


def ANAT(title, tokens):
    return {'t': 'anatomy', 'title': title, 'tokens': [{'tok': a, 'exp': b} for a, b in tokens], 'line': _ln()}


def WIDGET(name, **args):
    return {'t': 'widget', 'name': name, 'args': args, 'line': _ln()}


def CMD(name, cat, os, sum, syntax, how, flags=(), examples=(), gotchas=(), see=(), tags=(), notes=()):
    hb = [P(x) if isinstance(x, str) else x for x in how]
    for i, b in enumerate(hb):
        b['line'] = 1 + 2 * i
    ex = []
    for e in examples:
        kind, desc, code = e[0], e[1], d(e[2])
        out = d(e[3]) if len(e) > 3 and e[3] else ''
        ex.append({'kind': kind, 'desc': desc, 'code': code, 'out': out, 'anat': None, 'line': _ln()})
    return {'t': 'cmd', 'name': name, 'cat': cat, 'os': os, 'sum': sum, 'syntax': syntax, 'how': hb,
            'tags': list(tags), 'see': list(see), 'flags': [{'f': a, 'd': b} for a, b in flags],
            'examples': ex, 'gotchas': list(gotchas), 'notes': list(notes), 'line': _ln()}


def EX(id, title, type, task, solution, hints=(), why='', starter='', check='', verify='', stdin='', page='', lang=None):
    tb = [P(x) if isinstance(x, str) else x for x in ([task] if isinstance(task, str) else task)]
    for b in tb:
        b['line'] = 1
    wb = [P(x) if isinstance(x, str) else x for x in ([why] if isinstance(why, str) else why)] if why else []
    for b in wb:
        b['line'] = 1
    lang = lang or {'py': 'python', 'js': 'javascript', 'terminal': 'sh', 'think': 'sh'}[type]
    return {'t': 'exercise', 'id': id, 'title': title, 'type': type, 'lang': lang, 'task': tb, 'hints': list(hints),
            'solution': d(solution), 'why': wb, 'starter': d(starter) if starter else '', 'check': d(check) if check else '',
            'verify': verify, 'stdin': stdin, 'page': page, 'line': _ln()}


def Q(q, options, why, answers=()):
    return {'q': q, 'options': [{'text': t, 'ok': ok} for t, ok in options], 'answers': list(answers), 'why': why, 'line': _ln()}


def CHECK(id, title, *questions):
    return {'t': 'checkpoint', 'id': id, 'title': title, 'questions': list(questions), 'line': _ln()}


def PROJECT(id, title, level, time, skills, *blocks):
    bl = list(blocks)
    return {'t': 'project', 'id': id, 'title': title, 'level': level, 'time': time, 'skills': list(skills), 'blocks': bl, 'line': _ln()}


def STEP(title, py, js, notes=None, error_js='', allow_error=False):
    """The code stepper: a short program in Python and JavaScript, stepped one line at a time (see chapters/codetrace.py).

    py and js are the same program written line for line. notes maps a Python line number to the sentence shown while
    that line is about to run; {name} in a note is replaced by the value of that variable at that moment, {n} by how many
    times the line has run so far. The key 'end' is the note for the last step, ('ret', line) the note for a function
    handing back its answer.
    """
    import re as _re
    from codetrace import trace_python, js_line_map
    py, js = d(py), d(js)
    tr = trace_python(py, allow_error=allow_error)
    visits = {}
    notes = notes or {}

    def plain(v):
        if isinstance(v, dict) and 's' in v:
            return v['s']
        if isinstance(v, dict) and 'f' in v:
            return repr(v['f'])
        if isinstance(v, bool):
            return 'true' if v else 'false'
        return str(v)
    steps = tr['steps']
    for i, s in enumerate(steps):
        ln = s['ln']
        visits[ln] = visits.get(ln, 0) + 1
        key = ('ret', ln) if s.get('k') == 'ret' else ('end' if ln == 0 else ln)
        text = notes.get(key)
        if text is None and s.get('k') != 'ret' and ln:
            text = notes.get(ln)
        if not text:
            continue
        # {name} means the value the line is about to give it, so look in the next step first, then in this one
        here = s['st'][-1] if s['st'] else {'fn': 'global', 'v': {}}
        after = steps[i + 1]['st'] if i + 1 < len(steps) else []
        scopes = [f['v'] for f in reversed(after) if f['fn'] == here['fn']] + [here['v']] + [f['v'] for f in reversed(s['st'])]

        def sub(m, n=visits[ln], scopes=scopes):
            k = m.group(1)
            if k == 'n':
                return str(n)
            for sc in scopes:
                if k in sc:
                    return plain(sc[k])
            return m.group(0)
        s['nt'] = _re.sub(r'\{([A-Za-z_]\w*)\}', sub, text)
    args = {'title': title, 'py': py, 'js': js, 'jm': js_line_map(py, js), 'steps': tr['steps']}
    if error_js:
        args['err_js'] = error_js
    return {'t': 'widget', 'name': 'codestep', 'args': args, 'line': _ln()}


def TRY(title, py, js):
    """Two editable, runnable versions of one small program. Both must print the same thing (test/code_pairs.py)."""
    from codetrace import trace_python
    py, js = d(py), d(js)
    out = trace_python(py)['out'].rstrip('\n')
    return {'t': 'widget', 'name': 'codetry', 'args': {'title': title, 'py': py, 'js': js, 'out': out}, 'line': _ln()}


def BITGRID(id, title, goal, grid, win, py, js, sol_py, sol_js, hint='', tools=None, energy=None, more=()):
    """Bit's grid world: write Python or JavaScript, press Run, watch Bit act it out (src/ws-code-d-grid.js).

    grid rows: # wall  . floor  G goal pad  D dock  B battery  P parcel  and exactly one of ^ > v < for Bit and the way it faces.
    win: {'at': 'G'|'D', 'collect': 'all'|n, 'deliver': 'all'|n, 'says': [text], 'minEnergy': n, 'maxLines': n}
    tools: which commands the reference lists (name prefixes: move turn front onb onp ond ong take put battery say)
    more: further maps (same format) the same program must also solve; the learner can switch between them and press "Check all maps"
    """
    def rows_of(text):
        rows = [r.rstrip() for r in d(text).split('\n')]
        assert len({len(r) for r in rows}) == 1, 'grid rows must all be the same length: ' + id
        assert sum(r.count(c) for r in rows for c in '^>v<') == 1, 'grid needs exactly one of ^ > v < : ' + id
        assert all(c in '#.GDBP^>v<' for r in rows for c in r), 'unknown grid character: ' + id
        return rows
    rows = rows_of(grid)
    a = {'id': id, 'title': title, 'goal': goal, 'grid': rows, 'win': win, 'py': d(py), 'js': d(js), 'sol_py': d(sol_py), 'sol_js': d(sol_js),
         'tools': tools or ['move', 'turn']}
    if hint:
        a['hint'] = hint
    if energy is not None:
        a['energy'] = energy
    if more:
        a['more'] = [rows_of(m) for m in more]
    return {'t': 'widget', 'name': 'bitgrid', 'args': a, 'line': _ln()}


def chapter(id, title, sub, after, time, goals, blocks, terms, level='intermediate', part='srv', file=None):
    return {'id': id, 'title': title, 'sub': sub, 'part': part, 'num': '', 'time': time, 'level': level, 'goals': goals,
            'file': file or (id + '.gm'), 'blocks': blocks, 'terms': [{'term': a, 'def': b, 'line': _ln()} for a, b in terms], 'after': after}
