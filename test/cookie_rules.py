"""Check the cookie rules engine (src/ws-9-cookies-engine.js) against a real Chromium.

A small server sends the Set-Cookie headers and reports the Cookie header it receives; Chromium reaches it as *.localhost (a.localhost and b.localhost are different sites) and, for the HTTP-versus-HTTPS rules, by the
machine's own non-loopback address, because Chrome treats localhost as a secure context and would hide the Secure rules.
For every case the engine's answer (stored or refused, which attributes, sent or not, visible to JavaScript or not) must match what
the browser really did. This is what keeps the lessons honest: the labs in the Cookies chapter use the same engine.

usage: python3 test/cookie_rules.py          (needs openssl and a Chromium; set CHROMIUM=/path if Playwright cannot find one)
Does not need dist/ to be served.
"""
import os, ssl, subprocess, sys, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, quote
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ENGINE = open(os.path.join(ROOT, 'src/ws-9-cookies-engine.js'), encoding='utf-8').read()
HTTP_PORT, HTTPS_PORT = 18081, 18082
problems = []
known = []


def expect(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond:
        problems.append(msg)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_any(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        origin = self.headers.get('Origin')
        self.send_response(200)
        for c in q.get('c', []):
            self.send_header('Set-Cookie', c)
        if origin:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Credentials', 'true')
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        if u.path.endswith('/echo'):
            body = '<pre id=c>%s</pre>' % (self.headers.get('Cookie') or '')
        else:
            body = '<!doctype html><title>t</title><body>ok'
        n = int(self.headers.get('Content-Length') or 0)
        if n:
            self.rfile.read(n)
        data = body.encode()
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    do_GET = do_POST = do_any


def serve(tmp):
    cert, key = os.path.join(tmp, 'c.pem'), os.path.join(tmp, 'k.pem')
    subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2', '-subj', '/CN=cookie-test',
                    '-addext', 'subjectAltName=DNS:*.localhost,DNS:localhost,IP:127.0.0.1'], check=True, capture_output=True)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert, key)

    class Secure(H):
        # handshake inside the connection's own thread: Chromium opens idle speculative connections that would stall a shared accept loop
        def setup(self):
            self.request = ctx.wrap_socket(self.request, server_side=True)
            super().setup()

    plain = ThreadingHTTPServer(('0.0.0.0', HTTP_PORT), H)
    tls = ThreadingHTTPServer(('0.0.0.0', HTTPS_PORT), Secure)
    for s in (plain, tls):
        s.daemon_threads = True
        threading.Thread(target=s.serve_forever, daemon=True).start()
    return plain, tls


def url(host, path='/', https=True, **q):
    port = HTTPS_PORT if https else HTTP_PORT
    return '%s://%s:%d%s' % ('https' if https else 'http', host, port, path)


def my_ip():
    import socket
    k = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        k.connect(('10.255.255.255', 1))
        return k.getsockname()[0]
    except OSError:
        return None
    finally:
        k.close()


def eng_url(host, path='/', https=True):
    return '%s://%s%s' % ('https' if https else 'http', host, path)   # the engine ignores ports


def main():
    tmp = tempfile.mkdtemp()
    plain, tls = serve(tmp)
    with sync_playwright() as p:
        exe = os.environ.get('CHROMIUM')
        args = ['--no-proxy-server', '--ignore-certificate-errors']
        b = p.chromium.launch(args=args, **({'executable_path': exe} if exe else {}))

        def fresh():
            c = b.new_context(ignore_https_errors=True)
            return c, c.new_page()

        eng = fresh()[1]
        eng.goto('about:blank')
        eng.add_script_tag(content=ENGINE)

        def engine_set(header, u):
            return eng.evaluate('([h,u]) => window.__ck.setCookie(h,u)', [header, u])

        # ---------------------------------------------------------------- 1. what gets stored
        cases = [
            # header, set from (host, path, https), expected stored?
            ('s1=1', ('a.localhost', '/', True)),
            ('s2=1; Domain=a.localhost', ('a.localhost', '/', True)),
            ('s2b=1; Domain=.a.localhost', ('www.a.localhost', '/', True)),
            ('s3=1; Domain=b.localhost', ('a.localhost', '/', True)),
            ('s3b=1; Domain=www.a.localhost', ('a.localhost', '/', True)),
            ('s4=1; Domain=co.uk', ('shop.co.uk', '/', True)),
            ('s4b=1; Domain=shop.co.uk', ('www.shop.co.uk', '/', True)),
            ('s5=1; Secure', ('IP', '/', False)),
            ('s5b=1; Secure', ('a.localhost', '/', True)),
            ('s6=1; SameSite=None', ('a.localhost', '/', True)),
            ('s6b=1; SameSite=None; Secure', ('a.localhost', '/', True)),
            ('__Host-h1=1; Secure; Path=/', ('a.localhost', '/', True)),
            ('__Host-h2=1; Secure; Path=/x', ('a.localhost', '/', True)),
            ('__Host-h3=1; Secure; Path=/; Domain=a.localhost', ('a.localhost', '/', True)),
            ('__Host-h4=1; Path=/', ('a.localhost', '/', True)),
            ('__Host-h5=1; Secure; Path=/', ('IP', '/', False)),
            ('__Secure-s1=1', ('a.localhost', '/', True)),
            ('__Secure-s2=1; Secure', ('a.localhost', '/', True)),
            ('__secure-s3=1', ('a.localhost', '/', True)),
            ('__host-h6=1; Secure; Path=/x', ('a.localhost', '/', True)),
            ('p1=1; Path=/shop', ('a.localhost', '/', True)),
            ('p2=1', ('a.localhost', '/a/b/c', True)),
            ('p3=1', ('a.localhost', '/a', True)),
            ('p4=1; Path=shop', ('a.localhost', '/a/b', True)),
            ('m1=1; Max-Age=3600', ('a.localhost', '/', True)),
            ('m2=1; Max-Age=999999999', ('a.localhost', '/', True)),
            ('m3=1; Max-Age=3600; Expires=Wed, 01 Jan 2031 00:00:00 GMT', ('a.localhost', '/', True)),
            ('h1=1; HttpOnly', ('a.localhost', '/', True)),
            ('x1=1; SameSite=Banana', ('a.localhost', '/', True)),
        ]
        IP = my_ip()
        for hdr, (host, path, https) in cases:
            if host == 'IP':
                if not IP or IP.startswith('127.'):
                    print('skip %s (no non-loopback address on this machine)' % hdr)
                    continue
                host = IP
            if host.endswith('.co.uk'):
                # a browser cannot reach a public-suffix host from here, so only the engine's answer is checked
                mine = engine_set(hdr, eng_url(host, path, https))
                expect(mine['ok'] == (hdr.startswith('s4b')), 'engine on a public suffix: ' + hdr + ' -> ' + ('stored' if mine['ok'] else 'refused'))
                continue
            ctx, pg = fresh()
            qpath = '%s?c=%s' % (path, quote(hdr))
            pg.goto(url(host, qpath, https))
            real = [c for c in ctx.cookies() if c['name'] == hdr.split('=')[0]]
            mine = engine_set(hdr, eng_url(host, path, https))
            label = '%-52s from %s%s%s' % (hdr, 'https' if https else 'http', '://' + host, path)
            if not mine['ok']:
                expect(not real, 'refused like Chromium: ' + label + '   (' + mine['reason'][:60] + ')')
                continue
            if not real:
                expect(False, 'engine stores it but Chromium refused: ' + label)
                continue
            r, c = real[0], mine['cookie']
            exp_domain = ('.' + c['domain']) if not c['hostOnly'] else c['domain']
            ok = r['domain'] == exp_domain and r['path'] == c['path'] and r['secure'] == c['secure'] and r['httpOnly'] == c['httpOnly']
            if c['life'] is None:
                ok = ok and r['expires'] == -1
                lifeok = True
            else:
                real_life = r['expires'] - time.time()
                lifeok = abs(real_life - c['life']) < 5
            expect(ok and lifeok, 'stored like Chromium: ' + label + '  -> domain %s path %s life %s' % (r['domain'], r['path'], r['expires'] if r['expires'] == -1 else round(r['expires'] - time.time())))
            if c['sameSite'] in ('Strict', 'Lax', 'None'):
                expect(r['sameSite'] == c['sameSite'], '   SameSite=%s recorded' % c['sameSite'])
            ctx.close()

        # deletes
        ctx, pg = fresh()
        pg.goto(url('a.localhost', '/?c=d1%3D1', True))
        pg.goto(url('a.localhost', '/?c=d1%3D1%3B%20Max-Age%3D0', True))
        expect(not [c for c in ctx.cookies() if c['name'] == 'd1'] and engine_set('d1=1; Max-Age=0', eng_url('a.localhost'))['deletes'], 'Max-Age=0 deletes the cookie')
        pg.goto(url('a.localhost', '/?c=d2%3D1', True))
        pg.goto(url('a.localhost', '/?c=d2%3D1%3B%20Expires%3DThu%2C%2001%20Jan%201970%2000%3A00%3A00%20GMT', True))
        expect(not [c for c in ctx.cookies() if c['name'] == 'd2'] and engine_set('d2=1; Expires=Thu, 01 Jan 1970 00:00:00 GMT', eng_url('a.localhost'))['deletes'], 'an Expires in the past deletes the cookie')
        ctx.close()

        # ---------------------------------------------------------------- 2. what gets sent, and who can read it
        JAR = [
            'ses=1',
            'strict=1; SameSite=Strict',
            'lax=1; SameSite=Lax',
            'none=1; SameSite=None; Secure',
            'sec=1; Secure; SameSite=Lax',
            'shop=1; Path=/shop; SameSite=Lax',
            'dom=1; Domain=a.localhost; SameSite=Lax',
            'unset=1',
            'ho=1; HttpOnly; SameSite=Lax',
        ]
        names = [h.split('=')[0] for h in JAR]
        qs = '&'.join('c=' + quote(h) for h in JAR)
        mine_jar = []
        for h in JAR:
            r = engine_set(h, eng_url('a.localhost', '/', True))
            assert r['ok'], h
            mine_jar.append(r['cookie'])
        # the engine's jar is passed in as plain data
        def mine_sent(req):
            got = eng.evaluate('([jar, req]) => window.__ck.jar(jar, req).map(c => c.name)', [mine_jar, req])
            return sorted(got)

        def real_cookie_names(txt):
            return sorted(x.split('=')[0].strip() for x in txt.split(';') if x.strip())

        # (label, page to stand on, how to make the request, engine request, expected cross-site?)
        ctx, pg = fresh()
        pg.goto(url('a.localhost', '/set?' + qs, True))
        stored = sorted(c['name'] for c in ctx.cookies())
        expect(stored == sorted(names), 'all nine cookies stored in the browser (%s)' % ', '.join(stored))

        def via_fetch(page_url, target, method='GET'):
            pg.goto(page_url)
            return pg.evaluate('([t, m]) => fetch(t, {credentials:"include", method:m, mode:"cors"}).then(r => r.text()).then(t => t.replace(/<[^>]+>/g, ""))', [target, method])

        def via_nav(page_url, target):
            pg.goto(page_url)
            pg.evaluate('t => { location.href = t }', target)
            pg.wait_for_load_state('load')
            pg.wait_for_selector('#c', state='attached')
            return pg.inner_text('#c') if pg.locator('#c').count() else ''

        def via_post(page_url, target):
            pg.goto(page_url)
            pg.evaluate('t => { const f = document.createElement("form"); f.method = "post"; f.action = t; document.body.appendChild(f); f.submit() }', target)
            pg.wait_for_selector('#c', state='attached')
            return pg.inner_text('#c')

        def via_iframe(page_url, target):
            pg.goto(page_url)
            pg.evaluate('t => { const i = document.createElement("iframe"); i.src = t; document.body.appendChild(i) }', target)
            pg.wait_for_timeout(500)
            for f in pg.frames:
                if f.url.startswith(target.split('?')[0]) and f != pg.main_frame:
                    return f.inner_text('#c')
            return ''

        T = url('a.localhost', '/echo', True)
        scenarios = [
            ('same site, address bar (nothing came before)', lambda: (pg.goto(T), pg.inner_text('#c'))[1], {'url': eng_url('a.localhost', '/echo'), 'context': eng_url('a.localhost', '/echo'), 'nav': True, 'method': 'GET'}),
            ('same site, fetch from www.a.localhost', lambda: via_fetch(url('www.a.localhost', '/blank', True), T), {'url': eng_url('a.localhost', '/echo'), 'context': eng_url('www.a.localhost', '/blank'), 'nav': False, 'method': 'GET'}),
            ('cross site, fetch from b.localhost', lambda: via_fetch(url('b.localhost', '/blank', True), T), {'url': eng_url('a.localhost', '/echo'), 'context': eng_url('b.localhost', '/blank'), 'nav': False, 'method': 'GET'}),
            ('cross site, iframe on b.localhost', lambda: via_iframe(url('b.localhost', '/blank', True), T), {'url': eng_url('a.localhost', '/echo'), 'context': eng_url('b.localhost', '/blank'), 'nav': False, 'method': 'GET'}),
            ('cross site, link click from b.localhost (top-level GET)', lambda: via_nav(url('b.localhost', '/blank', True), T), {'url': eng_url('a.localhost', '/echo'), 'context': eng_url('b.localhost', '/blank'), 'nav': True, 'method': 'GET'}),
            ('different path (/shop/echo), same site', lambda: (pg.goto(url('a.localhost', '/shop/echo', True)), pg.inner_text('#c'))[1], {'url': eng_url('a.localhost', '/shop/echo'), 'context': eng_url('a.localhost', '/'), 'nav': True, 'method': 'GET'}),
            ('look-alike path (/shopping/echo)', lambda: (pg.goto(url('a.localhost', '/shopping/echo', True)), pg.inner_text('#c'))[1], {'url': eng_url('a.localhost', '/shopping/echo'), 'context': eng_url('a.localhost', '/'), 'nav': True, 'method': 'GET'}),
            ('subdomain www.a.localhost (host-only cookies stay behind)', lambda: (pg.goto(url('www.a.localhost', '/echo', True)), pg.inner_text('#c'))[1], {'url': eng_url('www.a.localhost', '/echo'), 'context': eng_url('www.a.localhost', '/'), 'nav': True, 'method': 'GET'}),
        ]
        for label, run, req in scenarios:
            real = real_cookie_names(run())
            mine = mine_sent(req)
            expect(real == mine, 'sent like Chromium: %-52s %s' % (label, ','.join(real) or '(none)'))
            if real != mine:
                print('       real  :', real, '\n       engine:', mine)

        # a cross-site POST navigation: unset cookies get Chrome's two-minute Lax+POST grace period, which the engine does not model
        real = [n for n in real_cookie_names(via_post(url('b.localhost', '/blank', True), T)) if n not in ('unset', 'ses')]
        mine = [n for n in mine_sent({'url': eng_url('a.localhost', '/echo'), 'context': eng_url('b.localhost', '/blank'), 'nav': True, 'method': 'POST'}) if n not in ('unset', 'ses')]
        expect(real == mine, 'sent like Chromium: cross site, form POST from b.localhost  %s' % (','.join(real) or '(none)'))
        known.append('a cross-site POST of a cookie with no SameSite attribute is sent for the first two minutes in Chrome ("Lax+POST"); the engine and the book say Lax')

        # HTTP versus HTTPS, on an address that is not loopback (Chrome treats localhost as secure)
        if IP and not IP.startswith('127.'):
            ctx3, pg3 = fresh()
            try:
                pg3.goto(url(IP, '/set?c=%s&c=%s' % (quote('ses=1'), quote('sec=1; Secure; SameSite=Lax')), True), timeout=8000)
            except Exception as e:
                print('skip: HTTPS to %s is not reachable from this machine (%s)' % (IP, str(e).split('\n')[0][:60]))
            else:
                jar_ip = [engine_set(h, eng_url(IP, '/', True))['cookie'] for h in ('ses=1', 'sec=1; Secure; SameSite=Lax')]
                for https in (True, False):
                    pg3.goto(url(IP, '/echo', https))
                    real = real_cookie_names(pg3.inner_text('#c'))
                    mine = sorted(eng.evaluate('([j, r]) => window.__ck.jar(j, r).map(c => c.name)', [jar_ip, {'url': eng_url(IP, '/echo', https), 'context': eng_url(IP, '/', https), 'nav': True, 'method': 'GET'}]))
                    expect(real == mine, 'sent like Chromium: %s request to a non-loopback address -> %s' % ('https' if https else 'plain http', ','.join(real) or '(none)'))
            ctx3.close()
        known.append('on localhost and loopback addresses Chrome treats plain HTTP as secure, so it stores and sends Secure cookies there; the engine follows the rule for real hosts')

        # what JavaScript sees
        pg.goto(url('a.localhost', '/blank', True))
        doc = pg.evaluate('document.cookie')
        real = sorted(x.split('=')[0].strip() for x in doc.split(';') if x.strip())
        mine = sorted(c['name'] for c in mine_jar if eng.evaluate('([c, u]) => window.__ck.jsVisible(c, u).yes', [c, eng_url('a.localhost', '/blank')]))
        expect(real == mine and 'ho' not in real, 'document.cookie shows %s and never the HttpOnly cookie' % ','.join(real))
        pg.goto(url('a.localhost', '/shop/page', True))
        real = sorted(x.split('=')[0].strip() for x in pg.evaluate('document.cookie').split(';') if x.strip())
        mine = sorted(c['name'] for c in mine_jar if eng.evaluate('([c, u]) => window.__ck.jsVisible(c, u).yes', [c, eng_url('a.localhost', '/shop/page')]))
        expect(real == mine and 'shop' in real, 'document.cookie on /shop/page also shows the Path=/shop cookie')
        # the order of the Cookie header: longest path first
        ctx2, pg2 = fresh()
        pg2.goto(url('a.localhost', '/set?c=o1%3D1&c=o2%3D2%3B%20Path%3D%2Fshop&c=o3%3D3%3B%20Path%3D%2Fshop%2Fa', True))
        order = pg2.goto(url('a.localhost', '/shop/a/echo', True)) and pg2.inner_text('#c')
        jarx = [engine_set(h, eng_url('a.localhost', '/'))['cookie'] for h in ['o1=1', 'o2=2; Path=/shop', 'o3=3; Path=/shop/a']]
        mine = eng.evaluate('([j, r]) => window.__ck.jar(j, r).map(c => c.name + "=" + c.value).join("; ")', [jarx, {'url': eng_url('a.localhost', '/shop/a/echo'), 'context': eng_url('a.localhost', '/'), 'nav': True}])
        expect(order == mine == 'o3=3; o2=2; o1=1', 'the Cookie header lists the longest Path first: ' + order)

        b.close()
    print('\nknown differences kept out of the comparison:')
    for k in known:
        print('  -', k)
    print('problems:', len(problems))
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
