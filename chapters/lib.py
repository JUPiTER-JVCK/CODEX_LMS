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


def chapter(id, title, sub, after, time, goals, blocks, terms, level='intermediate', part='srv', file=None):
    return {'id': id, 'title': title, 'sub': sub, 'part': part, 'num': '', 'time': time, 'level': level, 'goals': goals,
            'file': file or (id + '.gm'), 'blocks': blocks, 'terms': [{'term': a, 'def': b, 'line': _ln()} for a, b in terms], 'after': after}
