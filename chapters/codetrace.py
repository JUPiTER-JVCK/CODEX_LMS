"""Build-time execution traces for the code stepper (the `codestep` widget).

A trace is made by really running the Python example under sys.settrace, so what the learner sees (which line runs,
what every variable holds, what has been printed) can never drift from what the code does. The JavaScript twin of the
example is not traced: its lines are lined up with the Python lines (`js_line_map`) and test/code_pairs.py runs both
versions to check that they print the same thing.

Values are stored in a neutral typed form so the page can show them the way each language writes them:
  null/true/false  None/True/False        {'s': text}   a string          {'f': 2.5}  a float (6.0 vs 6)
  number           an int                 {'l': [...]}  a list or tuple   {'d': [[k, v], ...]}  a dict
  {'set': [...]}   a set                  {'fn': name}  a function        {'cls': name}  a class
  {'o': Class, 'a': [[attr, value], ...]} an instance
Lists, dicts, sets and instances also carry 'i', an id that is the same for the same object, so aliasing can be drawn.
"""
import builtins
import contextlib
import io
import re
import sys
import types

FILENAME = '<example>'
MAX_STEPS = 260


class TraceError(Exception):
    pass


def _encode(v, ids):
    if v is None or isinstance(v, bool) or isinstance(v, int):
        return v
    if isinstance(v, float):
        return {'f': v}
    if isinstance(v, str):
        return {'s': v}
    if isinstance(v, types.FunctionType):
        return {'fn': v.__name__}
    if isinstance(v, type):
        return {'cls': v.__name__}

    def ident():
        return ids.setdefault(id(v), len(ids) + 1)
    if isinstance(v, (list, tuple)):
        o = {'l': [_encode(x, ids) for x in v], 'i': ident()}
        if isinstance(v, tuple):
            o['tu'] = 1
        return o
    if isinstance(v, dict):
        return {'d': [[_encode(k, ids), _encode(x, ids)] for k, x in v.items()], 'i': ident()}
    if isinstance(v, (set, frozenset)):
        return {'set': [_encode(x, ids) for x in sorted(v, key=repr)], 'i': ident()}
    if hasattr(v, '__dict__') and not isinstance(v, types.ModuleType):
        return {'o': type(v).__name__, 'a': [[k, _encode(x, ids)] for k, x in vars(v).items()], 'i': ident()}
    return {'s': repr(v)}


def _visible(name, value):
    if name.startswith('__') or name.startswith('_trace'):
        return False
    return not isinstance(value, (types.ModuleType, types.BuiltinFunctionType))


def _frames(frame, ids):
    """The call stack (outermost first): the global frame, then one frame per running function."""
    chain = []
    f = frame
    while f is not None:
        if f.f_code.co_filename == FILENAME:
            chain.append(f)
        f = f.f_back
    out = []
    for f in reversed(chain):
        name = f.f_code.co_name
        is_func = bool(f.f_code.co_flags & 1)       # CO_OPTIMIZED: functions only (not the module or a class body)
        if name == '<module>':
            vals = {k: v for k, v in f.f_globals.items() if _visible(k, v)}
            defs = [k for k, v in vals.items() if isinstance(v, (types.FunctionType, type))]
            fr = {'fn': 'global', 'v': {k: _encode(v, ids) for k, v in vals.items() if k not in defs}}
            if defs:
                fr['defs'] = defs
            out.append(fr)
        elif is_func and not name.startswith('<'):
            out.append({'fn': name, 'v': {k: _encode(v, ids) for k, v in f.f_locals.items() if _visible(k, v)}})
    return out


def trace_python(src, allow_error=False, limit=MAX_STEPS):
    """Run `src` and return {'steps': [...], 'out': str, 'err': str|None}.

    A step is {'ln': line about to run, 'st': call stack, 'out': text printed so far} and, for the step that shows a
    function handing back its answer, {'k': 'ret', 'ret': value}. The final step has ln 0 ("the program has finished")
    or, when the example is meant to crash, 'err' with the error message.
    """
    ids = {}
    steps = []
    buf = io.StringIO()
    ns = {'__name__': '__main__', '__builtins__': builtins}
    code = compile(src, FILENAME, 'exec')

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != FILENAME:
            return None
        if event == 'line':
            steps.append({'ln': frame.f_lineno, 'st': _frames(frame, ids), 'out': buf.getvalue()})
        elif event == 'return' and frame.f_code.co_name != '<module>' and frame.f_code.co_flags & 1 and not frame.f_code.co_name.startswith('<'):
            steps.append({'ln': frame.f_lineno, 'k': 'ret', 'ret': _encode(arg, ids), 'st': _frames(frame, ids), 'out': buf.getvalue()})
        if len(steps) > limit:
            raise TraceError('example runs more than %d steps; make it smaller' % limit)
        return tracer

    err = None
    old = sys.gettrace()
    with contextlib.redirect_stdout(buf):
        sys.settrace(tracer)
        try:
            exec(code, ns)
        except TraceError:
            raise
        except BaseException as e:      # noqa: BLE001 - an example may crash on purpose
            if not allow_error:
                raise
            err = '%s: %s' % (type(e).__name__, e)
            tb = e.__traceback__
            line = 0
            while tb is not None:
                if tb.tb_frame.f_code.co_filename == FILENAME:
                    line = tb.tb_lineno
                tb = tb.tb_next
            steps.append({'ln': line, 'st': steps[-1]['st'] if steps else [], 'out': buf.getvalue(), 'err': err})
        finally:
            sys.settrace(old)
    if err is None:
        steps.append({'ln': 0, 'st': _frames_final(ns, ids), 'out': buf.getvalue()})
    return {'steps': steps, 'out': buf.getvalue(), 'err': err}


def _frames_final(ns, ids):
    vals = {k: v for k, v in ns.items() if _visible(k, v)}
    defs = [k for k, v in vals.items() if isinstance(v, (types.FunctionType, type))]
    fr = {'fn': 'global', 'v': {k: _encode(v, ids) for k, v in vals.items() if k not in defs}}
    if defs:
        fr['defs'] = defs
    return [fr]


_CLOSING = re.compile(r'^[}\])]+[;,]?$')


def _significant(lines, comment):
    """1-based numbers of the lines that can run: not blank, not a comment, not just a closing bracket."""
    out = []
    for i, ln in enumerate(lines, 1):
        s = ln.strip()
        if not s or s.startswith(comment) or _CLOSING.match(s):
            continue
        out.append(i)
    return out


def js_line_map(py, js):
    """For each Python line number (1-based; index 0 unused) the JavaScript line that corresponds to it.

    The two versions must be written in parallel: the lines that can run (not blank, not a comment, not a lone closing
    bracket) must pair up one to one, in order. Lines that cannot run map to the line before them.
    """
    pl, jl = py.split('\n'), js.split('\n')
    ps, js_ = _significant(pl, '#'), _significant(jl, '//')
    if len(ps) != len(js_):
        raise TraceError('Python has %d runnable lines and JavaScript %d; write the two versions line for line\n--- python\n%s\n--- javascript\n%s'
                         % (len(ps), len(js_), py, js))
    pair = dict(zip(ps, js_))
    out, last = [0], 1
    for i in range(1, len(pl) + 1):
        if i in pair:
            last = pair[i]
        out.append(last)
    return out
