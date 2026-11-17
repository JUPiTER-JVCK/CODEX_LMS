/* Pyodide worker: runs learner Python off the main thread. Messages in: {id, code, stdin, check}. Out: {id, status, out, msg} or {ready:true}. */
let pyodide = null, ready = null;
const BASE = new URL('./', self.location.href).href;
importScripts(BASE + 'pyodide.js');
const RUNNER = `
import sys, io, traceback
def _run(code, stdin, check):
    import logging
    for h in logging.root.handlers[:]: logging.root.removeHandler(h)
    out = io.StringIO()
    old = sys.stdout, sys.stderr, sys.stdin
    sys.stdout = sys.stderr = out
    sys.stdin = io.StringIO(stdin or '')
    ns = {'__name__': '__main__'}
    status, msg = 'ok', ''
    try:
        exec(compile(code, '<your code>', 'exec'), ns)
        if check:
            ns['out'] = out.getvalue()
            try:
                exec(compile(check, '<check>', 'exec'), ns)
            except AssertionError as e:
                status, msg = 'fail', (str(e) or 'The check did not pass.')
    except SystemExit:
        pass
    except BaseException as e:
        status = 'error'
        tb = e.__traceback__
        while tb is not None and tb.tb_frame.f_code.co_filename != '<your code>':
            tb = tb.tb_next
        msg = ''.join(traceback.format_exception(type(e), e, tb)).rstrip()
        if check and status == 'error' and isinstance(e, NameError):
            msg += '\\n(Your code ran, but the check needs a name your program does not define.)'
    finally:
        sys.stdout, sys.stderr, sys.stdin = old
    return [status, out.getvalue(), msg]
`;
ready = (async () => {
  pyodide = await loadPyodide({ indexURL: BASE, stdLibURL: BASE + 'stdlib.dat.wasm' });
  pyodide.runPython(RUNNER);
  postMessage({ ready: true });
})().catch(e => postMessage({ fatal: String(e && e.message || e) }));
onmessage = async (ev) => {
  await ready;
  if (!pyodide) return;
  const { id, code, stdin, check } = ev.data;
  try {
    const f = pyodide.globals.get('_run');
    const r = f(code, stdin || '', check || '').toJs();
    f.destroy();
    postMessage({ id, status: r[0], out: r[1], msg: r[2] });
  } catch (e) {
    postMessage({ id, status: 'error', out: '', msg: String(e && e.message || e) });
  }
};
