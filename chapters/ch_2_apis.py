from lib import *

blocks = [
    P('''An **API** (application programming interface) is a promise: send a request shaped like *this* and you get a response shaped
    like *that*. The weather on your phone, the status page of your router and the price feed of a trading app are all programs talking
    to other programs through web APIs. In this chapter you will call APIs from curl, JavaScript and Python, read every part of a
    response, design endpoints that other people can use without asking you questions, authenticate safely, survive rate limits and
    flaky networks, and verify webhooks. All the JavaScript runs against `lab.local`, a practice REST API built into this page, so you
    can create, break and reset data freely.'''),

    H2('Kinds of web API', 'kinds'),
    TABLE(['Style', 'Shape of a call', 'Strengths', 'You meet it in'], [
        ['**REST** over HTTP + JSON', '`GET /devices/3`, `POST /devices`', 'uses plain HTTP, cacheable, readable with curl', 'most public APIs: GitHub, Stripe, cloud providers'],
        ['**GraphQL**', '`POST /graphql` with a query naming the fields you want', 'one request fetches exactly the shape you need', 'GitHub (v4), Shopify, large front ends'],
        ['**gRPC**', 'binary messages over HTTP/2, typed by `.proto` files', 'fast, strongly typed, streaming', 'between internal microservices'],
        ['**Webhooks**', 'the provider `POST`s to *your* URL when something happens', 'no polling; events arrive as they occur', 'payments, Git pushes, chat bots'],
        ['**WebSockets / SSE**', 'a long-lived connection that pushes messages', 'real-time updates', 'dashboards, chat, live prices'],
    ]),
    P('''The difference between the styles is mostly *who speaks when* and *how long the connection lives*. Drawn as messages
    between two programs (── one message, ══ a connection that stays open):'''),
    ASCII('''
      ⟪g:REST⟫        client   ── GET /devices/3 ─────────────────────────▶ server
                  client   ◀───────────────────── 200 {"id": 3, ...} ── server
                           one request, one response; each request stands alone

      ⟪g:GraphQL⟫     client   ── POST /graphql {device(id:3){name}} ─────▶ server
                  client   ◀────────────── {"device": {"name": ...}} ── server
                           one URL for everything; the query names the fields it wants back

      ⟪y:gRPC⟫        client   ══ HTTP/2, binary protobuf messages ═══════▶ server
                  client   ◀═════════════════ responses, or a stream ══ server
                           typed by a .proto file; many calls and streams share one connection

      ⟪c:WebSocket⟫   client   ── GET, Upgrade: websocket ────────────────▶ server
                  client   ◀══════════ messages either way ═══════════▶ server
                           after "101 Switching Protocols" either side may send at any time

      ⟪c:SSE⟫         client   ── GET, Accept: text/event-stream ─────────▶ server
                  client   ◀══════════════ event ◀══ event ◀══ event ══ server
                           the response never ends: the server pushes, the client only listens

      ⟪m:Webhook⟫     provider ── POST /hooks/payments {event} ───────────▶ your app
                  provider ◀──────────────────────────────────── 200 ── your app
                           they call you when something happens; check the signature first
    '''),
    P('''This chapter concentrates on REST, because it is the most common and because the other styles reuse the same ideas: URLs,
    methods, status codes, headers, authentication and JSON.'''),

    H2('Resources, methods and status codes', 'rest'),
    P('''REST models a service as **resources** (nouns) that live at URLs, and uses the HTTP **method** as the verb. A collection and
    the items in it get two URL shapes, and five methods cover almost everything:'''),
    ASCII('''
      ⟪w:collection⟫  /api/devices          GET    list (filter with ?type=server&online=true)
                                         POST   create one ──▶ ⟪g:201 Created⟫ + Location: /api/devices/7
      ⟪w:item⟫        /api/devices/7        GET    read it   ──▶ ⟪g:200⟫, or ⟪y:404⟫ if there is no 7
                                         PUT    replace the whole thing
                                         PATCH  change some fields
                                         DELETE remove it  ──▶ ⟪g:204 No Content⟫
      ⟪d:not a resource:⟫ /api/deleteDevice?id=7, /api/getDevices  (verbs in URLs fight HTTP)
    '''),
    P('''The **status code** is the first thing a client should read, because it says what kind of answer the body is. The first digit
    is the class. Clients that treat every 2xx as success, retry some 5xx and 429 responses, and show 4xx errors to the user are correct
    for almost every API.'''),
    TABLE(['Code', 'Name', 'Means', 'Client should'], [
        ['200', 'OK', 'success, the body is the result', 'use the body'],
        ['201', 'Created', 'a new resource exists; `Location` says where', 'read `Location` or the body'],
        ['204', 'No Content', 'success, nothing to send back', 'not try to parse a body'],
        ['304', 'Not Modified', 'your cached copy is still current', 'use the cache'],
        ['400', 'Bad Request', 'the request is malformed (bad JSON, missing field)', 'fix the request; do not retry'],
        ['401', 'Unauthorized', 'no valid credentials', 'log in or refresh the token'],
        ['403', 'Forbidden', 'credentials are fine but not allowed to do this', 'stop; ask for permission'],
        ['404', 'Not Found', 'no resource at this URL', 'check the id and path'],
        ['409', 'Conflict', 'clashes with the current state (duplicate, edit conflict)', 'reload, merge, try again'],
        ['422', 'Unprocessable Content', 'well-formed but fails validation', 'show the field errors'],
        ['429', 'Too Many Requests', 'rate limited', 'wait `Retry-After`, then retry'],
        ['500', 'Internal Server Error', 'the server failed', 'retry later, maybe; report it'],
        ['502 / 503 / 504', 'Bad Gateway / Unavailable / Gateway Timeout', 'something between you and the app is down or slow', 'retry with backoff'],
    ], 'The codes you will actually handle'),
    P('''The console below talks to the practice server. Work through the presets from left to right and read the status, the headers
    and the body of each answer. Then try the *Raw HTTP* tab, which shows the exact text that would cross the network, and *As code*,
    which turns any request into curl, JavaScript and Python.'''),
    WIDGET('apiconsole'),
    CALLOUT('try', 'Five things to find in the console', '''(1) Which header tells you where a newly created device lives? (2) What does a `405` add that a `404` does not? (3) What is
    the difference between the `400` for broken JSON and the `422` for a bad IP? (4) Call the flaky endpoint four times and describe the
    pattern. (5) Send `GET /api/me` without and then with the token: which response header tells a client how to authenticate?'''),

    H2('Calling an API from code', 'fetch'),
    P('''In JavaScript, `fetch` returns a `Response` as soon as the headers arrive. Two details trip everyone up: `fetch` only rejects
    when the network fails, so a `404` or `500` still *resolves*, and the body is a stream you read once with `.json()` or `.text()`.
    These boxes run against `lab.local`; relative URLs like `/api/devices` go to it.'''),
    JSRUN('''
    const res = await fetch('/api/devices?type=server');
    console.log(res.status, res.ok, res.headers.get('content-type'));
    console.log('total:', res.headers.get('x-total-count'));
    const servers = await res.json();
    for (const d of servers) console.log(`${d.id}  ${d.name.padEnd(14)} ${d.ip}`);

    const missing = await fetch('/api/devices/99');
    console.log(missing.status, missing.ok, await missing.json());
    ''', browser=True),
    P('Creating a resource means sending a body and saying what format it is in. The server answers `201` and a `Location` header:'),
    JSRUN('''
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'camera', ip: '192.168.1.80', type: 'camera' }),
    });
    console.log(res.status, res.statusText, res.headers.get('location'));
    console.log(await res.json());

    const bad = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'camera', ip: 'not-an-ip' }),
    });
    console.log(bad.status, await bad.json());
    ''', browser=True),
    P('''Because every caller needs the same checks, wrap them once. `api()` below turns any non-2xx answer into an exception that
    carries the status and the server's error message, handles `204` with no body, and leaves the happy path a single line:'''),
    JSRUN('''
    class ApiError extends Error {
      constructor(status, message) { super(`${status}: ${message}`); this.status = status; }
    }

    async function api(path, { method = 'GET', body, token } = {}) {
      const headers = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = res.status === 204 ? null : await res.json();
      if (!res.ok) throw new ApiError(res.status, data?.error ?? res.statusText);
      return data;
    }

    console.log(await api('/api/devices/3'));
    console.log(await api('/api/devices/4', { method: 'PATCH', body: { online: true } }));
    console.log(await api('/api/devices/5', { method: 'DELETE' }));
    for (const call of [() => api('/api/me'), () => api('/api/devices/5')]) {
      try { await call(); } catch (e) { console.log(e.name, e.status, e.message); }
    }
    console.log(await api('/api/me', { token: 'lab-token' }));
    ''', browser=True),
    P('''On your Mac the same calls are one line of curl, and Python's standard library covers them without installing anything.
    `urllib` raises `HTTPError` for 4xx and 5xx responses (the opposite of `fetch`), and the error object is itself a readable response:'''),
    FILE('api_client.py', '''
    #!/usr/bin/env python3
    """Call a JSON API with the standard library only."""
    import json
    import urllib.request
    from urllib.error import HTTPError, URLError

    BASE = "http://127.0.0.1:8080"          # api_server.py from the Server Basics chapter


    def api(path, method="GET", body=None, token=None, timeout=5):
        headers = {"Accept": "application/json"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                raw = res.read()
                return res.status, json.loads(raw) if raw else None
        except HTTPError as err:                # 4xx and 5xx land here
            return err.code, json.loads(err.read() or b"null")
        except URLError as err:                 # DNS failure, refused, timeout
            raise SystemExit(f"cannot reach {BASE}: {err.reason}")


    if __name__ == "__main__":
        print(api("/health"))
        print(api("/devices", "POST", {"name": "printer", "ip": "192.168.1.70"}))
        print(api("/nope"))
    '''),
    TERM('''
    $ python3 api_client.py
    (200, {'status': 'ok', 'uptime': 42})
    (201, {'id': 3, 'name': 'printer', 'ip': '192.168.1.70'})
    (404, {'error': 'no route for GET /nope'})
    '''),
    CALLOUT('tip', 'Real APIs to practise on', '''GitHub's REST API answers many read requests without a token, at a low hourly limit:
    `curl -s https://api.github.com/repos/python/cpython | jq '{stars: .stargazers_count, language, license: .license.spdx_id}'`.
    Run `curl -si https://api.github.com/rate_limit | grep -i '^x-ratelimit'` to see the rate-limit headers you will meet below. Read a
    provider's terms before you script against it, and never put a token on the command line in a shared screen recording.'''),
    EX('apis-ex-get-json-or-throw', 'getJSON that refuses to pretend', 'js',
       '''Write `async function getJSON(path)` that fetches `path`, returns the parsed JSON for any 2xx response, and **throws** an `Error`
       whose message starts with the status code for anything else, for example `404 device 99 not found` (use the `error` field of the
       JSON body when there is one). Then, inside `main()`, print the name of device 3, and in a `try`/`catch` print the message for device 99. Exercise boxes run as classic scripts, so `await` has to live inside an `async` function.''',
       '''
       async function getJSON(path) {
         const res = await fetch(path);
         const data = await res.json().catch(() => null);
         if (!res.ok) throw new Error(`${res.status} ${data?.error ?? res.statusText}`);
         return data;
       }

       async function main() {
         console.log((await getJSON('/api/devices/3')).name);
         try {
           await getJSON('/api/devices/99');
         } catch (e) {
           console.log(e.message);
         }
       }
       main();
       ''',
       hints=['`res.ok` is true for 200 to 299.', 'Read the body before you throw, so the message can include `data.error`.'],
       why='''The single most common API bug is code that never checks the status and then crashes three lines later on `undefined`.
       Throwing early, with the status and the server's own message, turns a confusing failure into a precise one. `.catch(() => null)`
       keeps a non-JSON error page (such as an HTML 502 from a proxy) from hiding the real status.''',
       starter='''
       async function getJSON(path) {
         // your code
       }

       async function main() {
         console.log((await getJSON('/api/devices/3')).name);
       }
       main();
       ''',
       check='''
       assert(typeof getJSON === 'function', 'Define getJSON.');
       const d = await getJSON('/api/devices/1');
       assert(d && d.name === 'router', 'getJSON should return the parsed body for a 2xx answer.');
       let err = null; try { await getJSON('/api/devices/12345'); } catch (e) { err = e; }
       assert(err, 'getJSON must throw for a 404.');
       assert(/^404\\b/.test(err.message), 'The error message should start with the status code, got: ' + (err && err.message));
       assert(/not found/.test(err.message), 'Include the server error text in the message.');
       assert(/^pi$/m.test(out) && /404/.test(out), 'Print the name of device 3 (pi) and the 404 message.');
       '''),

    H2('Authentication and authorization', 'auth'),
    P('''**Authentication** answers "who are you?"; **authorization** answers "are you allowed to do this?". A `401` is a failed
    authentication and a `403` a failed authorization. APIs use three main schemes:'''),
    TABLE(['Scheme', 'What travels with each request', 'Good for', 'Watch out'], [
        ['API key', '`X-API-Key: sk_live_…` or `Authorization: Bearer …`', 'server-to-server scripts and your own tools', 'long-lived: a leaked key works until someone revokes it'],
        ['Bearer token (often a JWT)', '`Authorization: Bearer eyJhbGci…`', 'logged-in users and short-lived access', 'anyone who holds the token is you until it expires'],
        ['OAuth 2.0', 'a token obtained after the user approves access on the provider\'s site', '"Sign in with…", letting an app act for a user', 'use the authorization-code flow with PKCE, never the old implicit flow'],
        ['mTLS', 'a client certificate during the TLS handshake', 'machine-to-machine inside companies', 'certificate management'],
    ]),
    P('''A **JWT** (JSON Web Token, RFC 7519) is three base64url pieces joined by dots: a header, a JSON payload of **claims** and a
    signature. The payload is only *encoded*, not encrypted: anyone can read it. The signature is what stops anyone from *changing* it,
    and only a server that verifies it may trust the claims.'''),
    ANAT('A JSON Web Token', [
        ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'header, base64url: {"alg":"HS256","typ":"JWT"}, which algorithm signed it'),
        ('.', 'separator'),
        ('eyJzdWIiOiJsZWFybmVyIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzk1MDAwMDAwfQ', 'payload: the claims, readable by anyone'),
        ('.', 'separator'),
        ('3sV…', 'signature over header.payload with the server\'s key: the only part that proves anything'),
    ]),
    JSRUN('''
    const b64urlDecode = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsZWFybmVyIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzk1MDAwMDAwfQ.c2lnbmF0dXJlLW5vdC1jaGVja2Vk';
    const [header, payload, signature] = token.split('.');
    console.log(JSON.parse(b64urlDecode(header)));
    const claims = JSON.parse(b64urlDecode(payload));
    console.log(claims);
    console.log('expires', new Date(claims.exp * 1000).toISOString());
    console.log('signature bytes:', b64urlDecode(signature).length, '(meaningless until a server verifies them)');
    '''),
    P('''Anyone could have written that token: decoding it proves nothing. The encryption chapter shows how the signature is made with
    an HMAC or a key pair, and the exercise there has you verify one.'''),
    WIDGET('jwt'),
    ASCII('''
      ⟪w:OAuth 2.0 authorization code flow with PKCE⟫ ("Sign in with GitHub")

      your app                       browser                         GitHub
         │ 1. make secret verifier,   │                                 │
         │    send its SHA-256 hash ─▶ │ ─── login + "allow access?" ──▶ │
         │                            │ ◀── redirect ?code=abc ──────── │ 2. user approves
         │ ◀──────── code ─────────── │                                 │
         │ 3. POST code + verifier ─────────────────────────────────────▶ │ checks hash(verifier)
         │ ◀──────────────────────────────── access_token (+ refresh) ── │
         │ 4. GET /user  Authorization: Bearer access_token ───────────▶ │
    '''),
    P('''The app never sees the user's password, the user can revoke the app later, and **PKCE** (the verifier and its hash) stops a
    stolen `code` from being useful to anyone else. Use a maintained library for OAuth; the protocol is easy to get subtly wrong.'''),
    CALLOUT('danger', 'Where secrets must never go', '''Never put an API key in front-end JavaScript, a mobile app, a URL query string, a Git repository or a
    screenshot: all of those are public in practice. Keep keys on the server, in environment variables or a secret store. On your Mac,
    the Keychain is a good store for scripts: `security add-generic-password -a "$USER" -s lab-api -w` asks for the secret, and
    `TOKEN=$(security find-generic-password -a "$USER" -s lab-api -w)` reads it back without it ever appearing in your shell history.'''),

    H2('Pagination, filtering and idempotency', 'paging'),
    P('''A list endpoint cannot return a million rows, so APIs **paginate**. *Offset* pagination (`?limit=50&offset=100`) is simple but
    skips or repeats items when data changes between pages. *Cursor* pagination returns an opaque `next` token that says "continue after
    this item", which stays correct while data changes. Either way the client loops until there is no next page:'''),
    RUN('''
    import base64, json

    DEVICES = [{"id": i, "name": f"host{i:02d}"} for i in range(1, 12)]

    def list_devices(limit=4, cursor=None):
        """A cursor-paginated endpoint: the cursor encodes the last id the client saw."""
        after = json.loads(base64.urlsafe_b64decode(cursor))["after"] if cursor else 0
        page = [d for d in DEVICES if d["id"] > after][:limit]
        more = page and page[-1]["id"] < DEVICES[-1]["id"]
        nxt = base64.urlsafe_b64encode(json.dumps({"after": page[-1]["id"]}).encode()).decode() if more else None
        return {"data": page, "next": nxt}

    def all_devices():
        cursor, calls = None, 0
        while True:
            resp = list_devices(cursor=cursor)
            calls += 1
            yield from resp["data"]
            cursor = resp["next"]
            if cursor is None:
                break
        print(f"({calls} requests)")

    names = [d["name"] for d in all_devices()]
    print(names)
    print("first cursor:", list_devices()["next"])
    '''),
    P('''**Idempotent** means doing it twice has the same effect as doing it once. `GET`, `PUT` and `DELETE` are idempotent by design,
    so a client may safely retry them after a timeout. `POST` is not: if a payment request times out, you cannot know whether it was
    charged. APIs solve this with an **idempotency key**: the client sends a unique `Idempotency-Key: 7c1e…` header, and the server
    stores the first response under that key and returns the same response for any repeat. Stripe and many payment APIs work this way.'''),

    H2('Rate limits, retries and backoff', 'limits'),
    P('''Every public API limits how fast you may call it, usually with a **token bucket**: each request spends a token, tokens refill
    at a steady rate, and an empty bucket answers `429 Too Many Requests` with a `Retry-After` header. Headers such as
    `X-RateLimit-Remaining` (the GitHub style) report what is left; an IETF draft is standardising `RateLimit` and `RateLimit-Policy`
    headers for the same job. Play with the bucket, then turn on the polite client and watch the rejections disappear:'''),
    WIDGET('ratelimit'),
    P('''Good clients retry only what is worth retrying (network errors, `429`, `502`, `503`, `504`), wait longer after each failure
    (**exponential backoff**), add randomness so a thousand clients do not retry in lockstep (**jitter**), honour `Retry-After`, and give
    up after a few attempts. The practice server's `/api/flaky` fails every other call, which makes the pattern visible:'''),
    JSRUN('''
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const RETRY = new Set([429, 502, 503, 504]);

    async function fetchWithRetry(url, { tries = 4, base = 100 } = {}) {
      for (let attempt = 1; ; attempt++) {
        let res;
        try {
          res = await fetch(url);
          if (!RETRY.has(res.status)) return res;
        } catch (err) {
          if (attempt >= tries) throw err;                 // network failure: retry too
        }
        if (attempt >= tries) return res;
        const retryAfter = Number(res?.headers.get('retry-after'));
        const wait = retryAfter ? retryAfter * 1000 : base * 2 ** (attempt - 1) * (0.5 + Math.random() / 2);
        console.log(`attempt ${attempt}: ${res?.status ?? 'network error'}, waiting ${retryAfter ? retryAfter + ' s (Retry-After)' : 'with backoff'}`);
        await sleep(Math.min(wait, 1500));
      }
    }

    const res = await fetchWithRetry('/api/flaky');
    console.log('final:', res.status, await res.json());
    ''', browser=True),
    EX('apis-ex-backoff-schedule', 'A backoff schedule', 'py',
       '''Write `backoff(attempt, base=0.5, cap=30.0)` that returns how many seconds to wait before retry number `attempt` (1, 2, 3 …):
       `base * 2 ** (attempt - 1)`, but never more than `cap`. Then write `should_retry(status)` that returns `True` only for 429, 502, 503
       and 504. Print the waits for attempts 1 to 8 on one line.''',
       '''
       def backoff(attempt, base=0.5, cap=30.0):
           return min(cap, base * 2 ** (attempt - 1))

       def should_retry(status):
           return status in (429, 502, 503, 504)

       print([backoff(n) for n in range(1, 9)])
       ''',
       hints=['`min(cap, value)` applies the ceiling.', 'A `500` usually means a bug on the server: retrying the same request will hit the same bug.'],
       why='''The cap stops the delay from growing into hours, and the short list of retryable codes keeps a client from hammering a
       server that is telling it "your request is wrong" (4xx) or "my code is broken" (500). In production, multiply by a random factor
       between 0.5 and 1 for jitter; the check here uses the plain formula so the numbers are predictable.''',
       starter='''
       def backoff(attempt, base=0.5, cap=30.0):
           return 0

       def should_retry(status):
           return False
       ''',
       check='''
       assert backoff(1) == 0.5 and backoff(2) == 1.0 and backoff(4) == 4.0, "backoff should double from base: 0.5, 1, 2, 4 …"
       assert backoff(20) == 30.0, "backoff must never exceed cap"
       assert backoff(3, base=1, cap=3) == 3, "use the base and cap arguments"
       assert all(should_retry(s) for s in (429, 502, 503, 504)), "retry 429, 502, 503 and 504"
       assert not any(should_retry(s) for s in (200, 400, 401, 404, 422, 500)), "do not retry 2xx, 4xx other than 429, or 500"
       assert "[0.5, 1.0, 2.0, 4.0, 8.0, 16.0, 30.0, 30.0]" in out, "print the waits for attempts 1 to 8"
       '''),

    H2('Designing an API other people can use', 'design'),
    P('''A good API is predictable: once you have used one endpoint you can guess the others. A few conventions do most of the work:'''),
    UL('**Nouns in paths, plural collections**: `/devices`, `/devices/7`, `/devices/7/ports`. The method is the verb.',
       '**One error format everywhere.** RFC 9457 defines `application/problem+json`: `{"type": "…", "title": "Invalid device", "status": 422, "detail": "ip is not an IPv4 address", "errors": [{"field": "ip", …}]}`. Clients write one error handler instead of one per endpoint.',
       '**Version from day one**: `/v1/devices` in the path, or a header. Adding fields is safe; renaming or removing them breaks clients and needs `/v2`.',
       '**Return what you created**, with `201` and a `Location` header, so the client does not need a second request.',
       '**Validate at the edge** and say exactly what is wrong (`422` with the field name), not just "bad request".',
       '**Document it as a machine-readable contract** with OpenAPI, so others can generate clients, validate requests and try calls in a browser.'),
    FILE('openapi.yaml', '''
    openapi: 3.1.0
    info:
      title: Lab devices API
      version: 1.0.0
    paths:
      /devices:
        get:
          summary: List devices
          parameters:
            - name: type
              in: query
              schema: { type: string, enum: [router, laptop, server, storage, printer] }
          responses:
            "200":
              description: The matching devices
              content:
                application/json:
                  schema:
                    type: array
                    items: { $ref: "#/components/schemas/Device" }
        post:
          summary: Create a device
          requestBody:
            required: true
            content:
              application/json:
                schema: { $ref: "#/components/schemas/NewDevice" }
          responses:
            "201": { description: Created }
            "422": { description: Validation failed }
    components:
      schemas:
        NewDevice:
          type: object
          required: [name, ip]
          properties:
            name: { type: string, minLength: 1 }
            ip: { type: string, format: ipv4 }
        Device:
          allOf:
            - $ref: "#/components/schemas/NewDevice"
            - type: object
              required: [id]
              properties:
                id: { type: integer }
    '''),
    P('''FastAPI (Python) generates a document like this from your type hints and serves an interactive page for it at `/docs`;
    Express and Fastify have equivalent plugins. Paste the file into an online OpenAPI viewer to see what readers of your API would get.'''),

    H2('Webhooks: APIs that call you', 'webhooks'),
    P('''Polling ("anything new? anything new?") wastes requests and arrives late. With a **webhook**, you give a provider a URL and it
    `POST`s an event there the moment something happens. The problem is trust: anyone on the internet can POST to your URL. So providers
    sign each delivery with a secret you share, usually an **HMAC** of the raw body in a header such as `X-Hub-Signature-256` (GitHub) or
    `Stripe-Signature`. Your handler recomputes the HMAC and compares, in constant time, before believing a single field:'''),
    RUN('''
    import hashlib, hmac, json

    SECRET = b"whsec_lab_only"                  # shared with the provider when you set up the webhook

    def sign(body: bytes) -> str:
        return "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()

    def verify(body: bytes, header: str) -> bool:
        return hmac.compare_digest(sign(body), header)   # constant-time comparison

    body = json.dumps({"event": "device.offline", "device": "nas"}, separators=(",", ":")).encode()
    header = sign(body)                         # what the provider sends
    print(header)
    print("genuine:", verify(body, header))
    print("edited: ", verify(body.replace(b"nas", b"pi"), header))
    print("forged: ", verify(body, "sha256=" + "0" * 64))
    '''),
    CALLOUT('gotcha', 'Sign the bytes, not the parsed JSON', '''Compute the HMAC over the raw request body exactly as it arrived. If your framework parses the JSON first and
    you re-serialise it, key order and spacing can change and the signature will never match. Also reject deliveries whose timestamp
    (when the provider includes one) is more than a few minutes old, so a recorded request cannot be replayed later.'''),
    EX('apis-ex-verify-a-webhook', 'Verify a webhook signature', 'py',
       '''Write `verify_webhook(secret, body, header)` that returns `True` only if `header` equals `"sha256="` followed by the hex HMAC-SHA256
       of `body` (bytes) under `secret` (bytes). Use a constant-time comparison. Return `False`, without raising, if the header is missing
       (`None`) or does not start with `sha256=`.''',
       '''
       import hashlib, hmac

       def verify_webhook(secret, body, header):
           if not header or not header.startswith("sha256="):
               return False
           expected = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()
           return hmac.compare_digest(expected, header)
       ''',
       hints=['`hmac.new(key, msg, hashlib.sha256).hexdigest()`', 'Check the prefix first so a `None` header cannot crash the comparison.'],
       why='''`hmac.compare_digest` takes the same time whether the first or the last character differs, so an attacker cannot recover the
       signature byte by byte from response times. Treating a missing header as "not verified" rather than as an exception keeps a broken or
       hostile request from turning into a 500.''',
       starter='''
       import hashlib, hmac

       def verify_webhook(secret, body, header):
           return True
       ''',
       check='''
       import hashlib, hmac
       s, b = b"k3y", b'{"a":1}'
       good = "sha256=" + hmac.new(s, b, hashlib.sha256).hexdigest()
       assert verify_webhook(s, b, good) is True, "A correct signature must verify"
       assert verify_webhook(s, b + b" ", good) is False, "A changed body must fail"
       assert verify_webhook(b"other", b, good) is False, "The wrong secret must fail"
       assert verify_webhook(s, b, None) is False, "A missing header must return False"
       assert verify_webhook(s, b, good[7:]) is False, "A header without sha256= must fail"
       '''),

    CHECK('apis-ch-apis-checkpoint', 'APIs checkpoint',
          Q('`fetch(\'/api/devices/99\')` gets a 404. What does the promise do?', [('Rejects with a TypeError', False), ('Resolves with a Response whose ok is false', True), ('Resolves with null', False), ('Never settles', False)],
            '`fetch` rejects only for network failures. HTTP errors are successful round trips; check `res.ok` or `res.status` yourself.'),
          Q('Which status tells a client "your JSON parsed, but a field is invalid"?', [('400', False), ('401', False), ('422', True), ('500', False)],
            '400 is for a request the server cannot parse at all; 422 is for well-formed data that fails validation.'),
          Q('A token arrives as `Authorization: Bearer eyJ…`. What can anyone who intercepts it do?', [('Nothing, because it is encrypted', False), ('Read its claims, and call the API as you until it expires', True), ('Only read it, never use it', False), ('Change the claims and keep the signature valid', False)],
            'A JWT payload is only base64url-encoded, and a bearer token works for whoever bears it. That is why tokens are short-lived and only ever sent over HTTPS.'),
          Q('Which request is safe to retry automatically after a timeout?', [('POST /payments', False), ('PUT /devices/7 with the full new device', True), ('POST /devices', False), ('Any request', False)],
            'PUT is idempotent: sending the same full replacement twice leaves the same state. POST may create duplicates unless the API supports an idempotency key.'),
          Q('An API answers 429 with `Retry-After: 30`. The best client behaviour?', [('Retry immediately in a loop', False), ('Give up permanently', False), ('Wait at least 30 seconds, then retry', True), ('Switch to a different HTTP method', False)],
            'The server told you exactly how long to wait. Ignoring it usually makes the limit last longer, and can get a key banned.'),
          Q('Why must a webhook handler compare signatures with `hmac.compare_digest`?', [('It is faster', False), ('It takes the same time whatever differs, so timing does not leak the correct signature', True), ('It decrypts the body', False), ('It ignores whitespace', False)],
            'A normal string comparison stops at the first different character, and that time difference can be measured over many requests.')),

    PROJECT('apis-pr-devices-a-command-line-client', 'devices: a command-line client for your API', 'intermediate', 50,
            ['argparse', 'urllib', 'error handling', 'retries', 'Keychain'],
            P('''Build `devices`, a command-line tool for the `api_server.py` you wrote in Server Basics, the way real CLI tools for cloud
            APIs are built: subcommands, readable tables, JSON output for scripts, sensible exit codes, retries and a token that never touches
            your shell history.'''),
            H3('1. Subcommands'),
            P('Use `argparse` subparsers so these work: `devices list`, `devices list --json`, `devices add NAME IP`, `devices health`. Reuse the `api()` function from `api_client.py`.'),
            H3('2. Output for people and for programs'),
            P('''`list` prints an aligned table; `list --json` prints raw JSON so the tool can be piped into `jq`. Errors go to stderr and the exit
            code is 0 for success, 1 for API errors (4xx and 5xx) and 2 for usage errors (argparse does this for you).'''),
            H3('3. Retries'),
            P('Retry connection errors and 502, 503 and 504 up to three times with the `backoff()` function from this chapter. Print each retry to stderr.'),
            H3('4. A token from the Keychain'),
            P('''Add an `Authorization: Bearer` header when a token exists. Read it with `subprocess.run(["security", "find-generic-password", "-a",
            os.environ["USER"], "-s", "lab-api", "-w"], capture_output=True, text=True)` and fall back to no token if the command fails. Add a
            check in the server that `POST` requires that token, and confirm `devices add` fails with a clear message without it.'''),
            TERM('''
            $ devices list
            ID  NAME     IP
             1  router   192.168.1.1
             2  pi       192.168.1.50
            $ devices add nas 192.168.1.60
            created device 3 at /devices/3
            $ devices list --json | jq -r '.[].name'
            router
            pi
            nas
            '''),
            H3('5. Stretch goals'),
            UL('Add `devices watch` that polls every 10 seconds and prints only changes.', 'Make the base URL configurable with `--base` and an environment variable `DEVICES_API`.', 'Write tests that call your `api()` against the WSGI app pattern from Server Basics, with no network at all.')),
]

terms = [
    ('API', 'application programming interface: the contract for how one program asks another for something'),
    ('REST', 'an API style that models resources at URLs and uses HTTP methods as verbs'),
    ('endpoint', 'one URL plus method that an API exposes, such as GET /devices'),
    ('idempotent', 'safe to repeat: doing it twice leaves the same state as doing it once'),
    ('bearer token', 'a credential that grants access to whoever presents it in the Authorization header'),
    ('JWT', 'JSON Web Token: base64url header, claims and signature joined by dots'),
    ('OAuth 2.0', 'a protocol for letting an app act on a user\'s behalf without seeing their password'),
    ('PKCE', 'Proof Key for Code Exchange: a per-login secret that stops stolen OAuth codes from being redeemed'),
    ('rate limit', 'a cap on requests per period, enforced with 429 Too Many Requests'),
    ('exponential backoff', 'waiting twice as long after each failed attempt, usually with random jitter'),
    ('webhook', 'an HTTP request a provider sends to your URL when an event happens'),
    ('OpenAPI', 'a machine-readable format (YAML or JSON) that describes an HTTP API\'s endpoints and schemas'),
]

CHAPTER = chapter('apis', 'APIs: Calling, Designing and Securing Web APIs',
                  'Call REST APIs from curl, JavaScript and Python, read every status and header, authenticate safely, page, retry and rate-limit, and verify webhooks',
                  'servers', 120,
                  ['Read any API response by its status class, headers and body, and choose the right status for your own endpoints',
                   'Call APIs from JavaScript and Python with error handling that refuses to ignore failures',
                   'Explain API keys, bearer tokens, JWTs and OAuth with PKCE, and keep secrets out of code and history',
                   'Page through large collections, retry only what is safe, and respect rate limits with backoff',
                   'Design a predictable REST API with one error format and an OpenAPI description, and verify signed webhooks'],
                  blocks, terms, file='39-apis.gm')
