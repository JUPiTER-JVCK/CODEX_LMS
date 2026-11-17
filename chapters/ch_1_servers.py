from lib import *

API_SERVER = '''
#!/usr/bin/env python3
"""A tiny JSON API on the standard library: GET/POST /devices, GET /health."""
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEVICES = [{"id": 1, "name": "router", "ip": "192.168.1.1"},
           {"id": 2, "name": "pi", "ip": "192.168.1.50"}]
STARTED = time.time()


class Handler(BaseHTTPRequestHandler):
    server_version = "labapi/1.0"

    def send_json(self, status, obj, headers=None):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"status": "ok", "uptime": round(time.time() - STARTED)})
        elif self.path == "/devices":
            self.send_json(200, DEVICES)
        else:
            self.send_json(404, {"error": f"no route for GET {self.path}"})

    def do_POST(self):
        if self.path != "/devices":
            return self.send_json(404, {"error": f"no route for POST {self.path}"})
        length = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(length))
            name, ip = data["name"], data["ip"]
        except (ValueError, KeyError, TypeError):
            return self.send_json(400, {"error": "send JSON with name and ip"})
        device = {"id": max(d["id"] for d in DEVICES) + 1, "name": name, "ip": ip}
        DEVICES.append(device)
        self.send_json(201, device, {"Location": f"/devices/{device['id']}"})


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8080), Handler)
    print("labapi listening on http://127.0.0.1:8080", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\\nbye")
'''

blocks = [
    P('''Every service you have used in this book so far, from `example.com` to the router admin page to the practice server
    inside these pages, is a **server**: an ordinary program that waits on a port and answers whoever connects. Nothing about the
    hardware makes something a server. In this chapter you will run servers on your Mac, look inside the request loop that every
    web framework hides, learn how Linux and macOS keep a server running after you log out, read server logs like a sysadmin, and
    route requests with nginx, the reverse proxy in front of a large share of the web. The next three chapters build on this one:
    APIs are what servers offer, encryption is how they protect it, and the cloud is where most of them now run.'''),

    H2('What a server really is', 'model'),
    P('''A server is a process that asks the kernel for a listening socket on an address and port, then loops: accept a connection,
    read a request, write a response, repeat. The client is any process that connects. One machine can run dozens of servers, each on
    its own port, and the same program can be a client and a server at once (a web app is a server to browsers and a client of its
    database).'''),
    ASCII('''
      ⟪w:CLIENT⟫ (curl, browser, app)                 ⟪w:SERVER⟫ process on 192.168.1.50
      ───────────────────────────                 ─────────────────────────────────
                                                  socket()   make an endpoint
                                                  bind()     claim 0.0.0.0:8080
                                                  listen()   start the accept queue
      connect() ── SYN ───────────────────────▶   ┐
                ◀────────────────── SYN,ACK ──    │ kernel finishes the TCP handshake
                ── ACK ───────────────────────▶   ┘
                                                  accept()   take one connection
      send("GET /health …") ──────────────────▶   recv()     read the request
                ◀──────────── "HTTP/1.1 200" ──   send()     write the response
      close()                                     close()    then back to accept()
    '''),
    P('''Three numbers identify the server's side: the **address** it binds to, the **port** and the **protocol** (TCP or UDP). The
    address decides who can reach it, and getting it wrong is the most common way a "private" test server ends up visible to a whole
    café Wi-Fi.'''),
    TABLE(['Bind address', 'Who can connect', 'Use it for'], [
        ['`127.0.0.1` (or `::1`)', 'only programs on the same machine', 'development, admin consoles, a database used by one app'],
        ['`192.168.1.23` (one interface)', 'machines that can reach that interface', 'serving one network but not another'],
        ['`0.0.0.0` (or `::`)', 'every interface: LAN, VPN, sometimes the internet', 'real services, behind a firewall'],
    ]),
    ANAT('Starting a throwaway server', [
        ('python3 -m http.server', 'run the standard library module that serves files over HTTP'),
        ('8000', 'the TCP port; ports below 1024 need root on Linux and on older macOS'),
        ('--bind 127.0.0.1', 'listen on the loopback interface only, so nothing on the network can connect'),
        ('-d ~/lab', 'the directory whose files become URLs'),
    ]),
    CALLOUT('mac', 'The firewall dialog', '''When a program binds to an address other than loopback, macOS can show "Do you want the application Python to
    accept incoming network connections?". That dialog is the application firewall (System Settings, Network, Firewall). Allow it only
    for servers you mean to share. Binding to `127.0.0.1` never triggers it.'''),

    H2('Run a real API on your Mac', 'run'),
    P('''Below is a complete JSON API written with nothing but the standard library. It is small enough to read in one sitting and
    real enough to show everything a framework does for you: routing on method and path, parsing a request body, choosing a status
    code, and writing headers before the body. Save it as `~/lab/api_server.py` (in PyCharm: right-click the `lab` folder, New, Python
    File).'''),
    FILE('api_server.py', API_SERVER),
    P('Start it in one Terminal tab and leave it running. Its log goes to that tab:'),
    SH('cd ~/lab && python3 api_server.py'),
    P('In a second tab, talk to it. This transcript is from a real run; your `Date` and Python version will differ:'),
    TERM('''
    $ curl -s http://127.0.0.1:8080/health
    {"status": "ok", "uptime": 1}
    $ curl -si -X POST http://127.0.0.1:8080/devices -H 'Content-Type: application/json' -d '{"name": "nas", "ip": "192.168.1.60"}'
    HTTP/1.0 201 Created
    Server: labapi/1.0 Python/3.13.18
    Date: Mon, 16 Nov 2026 23:29:50 GMT
    Content-Type: application/json
    Content-Length: 46
    Location: /devices/3

    {"id": 3, "name": "nas", "ip": "192.168.1.60"}
    $ curl -s -X POST http://127.0.0.1:8080/devices -d 'oops'
    {"error": "send JSON with name and ip"}
    $ curl -s -o /dev/null -w '%{http_code}\\n' -X DELETE http://127.0.0.1:8080/devices
    501
    '''),
    P('And the first tab, the server\'s own log, shows one line per request, including the `DELETE` it does not implement:'),
    TERM('''
    $ python3 api_server.py
    labapi listening on http://127.0.0.1:8080
    127.0.0.1 - - [16/Nov/2026 23:29:50] "GET /health HTTP/1.1" 200 -
    127.0.0.1 - - [16/Nov/2026 23:29:50] "POST /devices HTTP/1.1" 201 -
    127.0.0.1 - - [16/Nov/2026 23:29:50] "POST /devices HTTP/1.1" 400 -
    127.0.0.1 - - [16/Nov/2026 23:29:50] code 501, message Unsupported method ('DELETE')
    127.0.0.1 - - [16/Nov/2026 23:29:50] "DELETE /devices HTTP/1.1" 501 -
    '''),
    UL('**`501 Not Implemented`** came from the base class: `BaseHTTPRequestHandler` looks for a method named `do_DELETE`, finds none and answers for you.',
       '**`HTTP/1.0`** in the status line is the default `protocol_version` of `BaseHTTPRequestHandler`. It closes the connection after every response, which is simple and slow. Production servers speak HTTP/1.1 or HTTP/2 and keep connections open.',
       '**The `Server` header** leaks the software and Python version. Real deployments usually hide or shorten it.',
       '**Press** [[⌃C]] in the first tab to stop it. The `KeyboardInterrupt` handler prints `bye` instead of a traceback.'),
    CALLOUT('try', 'Find the process that owns the port', '''With the server running, run `lsof -nP -iTCP:8080 -sTCP:LISTEN` in the second tab. You get the command
    name, its PID and `127.0.0.1:8080 (LISTEN)`. Start a second copy of the server in a third tab and read the error: `OSError: [Errno 48]
    Address already in use`. Only one socket can listen on an address and port at a time. That message, and `lsof` to find the culprit,
    will save you hours on real servers.'''),

    H2('Inside the request loop: WSGI', 'wsgi'),
    P('''`api_server.py` mixes two jobs: speaking HTTP on a socket, and deciding what to answer. Real Python deployments split them. A
    **server** (gunicorn, uWSGI, or uvicorn for async code) handles sockets, workers and timeouts. Your **application** is a plain
    function with a fixed signature, defined in PEP 3333 and called **WSGI**: it receives a dictionary describing the request and a
    function for starting the response, and returns the body as a list of bytes. Flask and Django are WSGI applications underneath.
    Because the application is just a function, you can call it without any network at all, which is exactly what the box below does in
    your browser.'''),
    RUN('''
    import json
    from wsgiref.util import setup_testing_defaults

    def app(environ, start_response):
        method, path = environ["REQUEST_METHOD"], environ["PATH_INFO"]
        if path == "/health" and method == "GET":
            status, body = "200 OK", {"status": "ok"}
        elif path == "/health":
            status, body = "405 Method Not Allowed", {"error": "use GET"}
        else:
            status, body = "404 Not Found", {"error": f"no route for {path}"}
        data = json.dumps(body).encode()
        start_response(status, [("Content-Type", "application/json"),
                                ("Content-Length", str(len(data)))])
        return [data]

    def call(method, path):
        environ = {"REQUEST_METHOD": method, "PATH_INFO": path}
        setup_testing_defaults(environ)        # fills in SERVER_NAME, wsgi.input and the rest
        seen = {}
        def start_response(status, headers):
            seen["status"], seen["headers"] = status, headers
        body = b"".join(app(environ, start_response))
        print(method, path, "->", seen["status"], body.decode())

    call("GET", "/health")
    call("POST", "/health")
    call("GET", "/missing")
    '''),
    P('''This is how frameworks test your code without opening ports, and it is how you should test your own servers: keep the
    decision logic in a function you can call directly, and keep the socket plumbing thin. On your Mac, `wsgiref.simple_server` can serve
    the same `app` for real in two lines: `from wsgiref.simple_server import make_server` and `make_server("127.0.0.1", 8081, app).serve_forever()`.'''),
    TABLE(['Layer', 'Python', 'Node.js', 'What it does'], [
        ['Reverse proxy', 'nginx, Caddy', 'nginx, Caddy', 'TLS, static files, routing, limits, buffering slow clients'],
        ['App server', 'gunicorn (WSGI), uvicorn (ASGI)', 'node itself, or PM2 to supervise it', 'sockets, worker processes, timeouts'],
        ['Framework', 'Flask, Django, FastAPI', 'Express, Fastify', 'routing, parsing, validation, sessions'],
        ['Your code', 'view functions', 'route handlers', 'the decisions'],
    ], 'The usual stack, top to bottom'),
    EX('servers-ex-a-wsgi-router', 'A WSGI router with 404 and 405', 'py',
       '''Write a WSGI application `app(environ, start_response)` that serves two routes. `GET /devices` answers `200 OK` with the JSON list
       `[{"id": 1, "name": "router"}]`. `GET /health` answers `200 OK` with `{"status": "ok"}`. Any other method on those two paths answers
       `405 Method Not Allowed` with an `Allow: GET` header. Any other path answers `404 Not Found`. Every response must have a
       `Content-Type: application/json` header and a JSON body.''',
       '''
       import json

       ROUTES = {
           "/devices": lambda: [{"id": 1, "name": "router"}],
           "/health": lambda: {"status": "ok"},
       }

       def app(environ, start_response):
           method, path = environ["REQUEST_METHOD"], environ["PATH_INFO"]
           headers = [("Content-Type", "application/json")]
           if path not in ROUTES:
               status, body = "404 Not Found", {"error": "not found"}
           elif method != "GET":
               status, body = "405 Method Not Allowed", {"error": "use GET"}
               headers.append(("Allow", "GET"))
           else:
               status, body = "200 OK", ROUTES[path]()
           start_response(status, headers)
           return [json.dumps(body).encode()]
       ''',
       hints=['Check the path first: a wrong path is a 404 whatever the method is.',
              '`start_response(status, headers)` takes a status string such as `"405 Method Not Allowed"` and a list of `(name, value)` tuples.'],
       why='''Order matters: a path that does not exist is `404` for every method, and only an existing path can be `405`. The `Allow`
       header is required by HTTP for `405` responses, so clients can discover what does work. Returning a list containing one bytes object
       is the simplest valid WSGI body.''',
       starter='''
       import json

       def app(environ, start_response):
           # your code
           start_response("200 OK", [("Content-Type", "application/json")])
           return [b"{}"]
       ''',
       check='''
       import json
       from wsgiref.util import setup_testing_defaults
       def call(m, p):
           env = {"REQUEST_METHOD": m, "PATH_INFO": p}
           setup_testing_defaults(env)
           got = {}
           def sr(status, headers):
               got["s"], got["h"] = status, dict(headers)
           body = b"".join(app(env, sr))
           return got["s"], got["h"], json.loads(body)
       s, h, b = call("GET", "/devices")
       assert s.startswith("200"), "GET /devices should be 200, got " + s
       assert b == [{"id": 1, "name": "router"}], "GET /devices body is wrong: " + repr(b)
       assert h.get("Content-Type") == "application/json", "Set Content-Type: application/json"
       s, h, b = call("GET", "/health")
       assert s.startswith("200") and b == {"status": "ok"}, "GET /health should be 200 with {'status': 'ok'}"
       s, h, b = call("DELETE", "/devices")
       assert s.startswith("405"), "DELETE /devices should be 405, got " + s
       assert h.get("Allow") == "GET", "A 405 needs an Allow: GET header"
       s, h, b = call("POST", "/nowhere")
       assert s.startswith("404"), "An unknown path is 404 whatever the method, got " + s
       '''),

    H2('Keeping a server running: services', 'services'),
    P('''A server you start in a Terminal tab dies when you close the tab, log out or reboot, and nobody restarts it when it crashes.
    Real servers run as **services** (also called daemons): the operating system's service manager starts them at boot, restarts them
    when they fail, collects their output into a log, and runs them as a dedicated user with only the permissions they need. macOS uses
    **launchd**. Almost every Linux server uses **systemd**. They solve the same problem with different files.'''),
    H3('On your Mac: a LaunchAgent', 'launchd'),
    P('''A **LaunchAgent** runs as you, while you are logged in. A **LaunchDaemon** runs as root at boot, for every user. For a lab
    server an agent is right. The job is described by a property list in `~/Library/LaunchAgents/`. Replace `learner` with your account
    name (`whoami` prints it) and check the Python path with `which python3`:'''),
    FILE('lab.api.plist', '''
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
    <dict>
        <key>Label</key>
        <string>lab.api</string>
        <key>ProgramArguments</key>
        <array>
            <string>/opt/homebrew/bin/python3</string>
            <string>/Users/learner/lab/api_server.py</string>
        </array>
        <key>WorkingDirectory</key>
        <string>/Users/learner/lab</string>
        <key>RunAtLoad</key>
        <true/>
        <key>KeepAlive</key>
        <true/>
        <key>StandardOutPath</key>
        <string>/Users/learner/lab/api.log</string>
        <key>StandardErrorPath</key>
        <string>/Users/learner/lab/api.log</string>
    </dict>
    </plist>
    '''),
    SH('''
    cp lab.api.plist ~/Library/LaunchAgents/
    plutil -lint ~/Library/LaunchAgents/lab.api.plist
    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/lab.api.plist
    launchctl print gui/$(id -u)/lab.api | grep -E 'state|pid|last exit'
    curl -s http://127.0.0.1:8080/health
    '''),
    P('''`KeepAlive` means launchd restarts the process whenever it exits, so `kill` it and watch a new PID appear in `launchctl print`.
    To stop it for good, unload it with `launchctl bootout gui/$(id -u)/lab.api` and delete the plist. `launchd` paths must be absolute:
    there is no `~` expansion and no shell `PATH`, which is the cause of most "it works in Terminal but not as a service" problems.'''),
    CALLOUT('warn', 'Errors you will meet', '''`Bootstrap failed: 5: Input/output error` usually means the job is already loaded (bootout first) or the plist
    has an error (run `plutil -lint`). A service that starts and immediately exits loops forever under `KeepAlive`; read the log file you
    named in `StandardErrorPath`. Recent macOS versions also show the job under System Settings, General, Login Items & Extensions,
    where you can switch it off.'''),
    H3('On Linux: a systemd unit', 'systemd'),
    P('''On a Raspberry Pi, a homelab VM or a cloud server, the same service is a **unit file**. Put it in `/etc/systemd/system/labapi.service`.
    It runs the app as an unprivileged user, restarts it on failure and sends its output to the journal:'''),
    FILE('labapi.service', '''
    [Unit]
    Description=Lab JSON API
    After=network-online.target
    Wants=network-online.target

    [Service]
    User=labapi
    Group=labapi
    WorkingDirectory=/opt/labapi
    ExecStart=/usr/bin/python3 /opt/labapi/api_server.py
    Restart=on-failure
    RestartSec=2
    NoNewPrivileges=true
    ProtectSystem=strict
    ProtectHome=true
    PrivateTmp=true

    [Install]
    WantedBy=multi-user.target
    '''),
    SH('''
    sudo useradd --system --no-create-home --shell /usr/sbin/nologin labapi
    sudo systemctl daemon-reload
    sudo systemctl enable --now labapi
    systemctl status labapi
    journalctl -u labapi -f
    '''),
    P('''The `Protect…` and `NoNewPrivileges` lines are systemd's sandboxing: the service sees the filesystem read-only, cannot read
    home directories and cannot gain privileges through setuid programs. They cost one line each and limit what an attacker gets if the
    app is ever compromised. `systemd-analyze security labapi` scores a unit and lists what else you could lock down.'''),
    TABLE(['Job', 'macOS (launchd)', 'Linux (systemd)'], [
        ['Describe the service', 'plist in `~/Library/LaunchAgents` or `/Library/LaunchDaemons`', 'unit file in `/etc/systemd/system`'],
        ['Load / start now', '`launchctl bootstrap gui/$(id -u) FILE`', '`sudo systemctl enable --now NAME`'],
        ['Stop and unload', '`launchctl bootout gui/$(id -u)/LABEL`', '`sudo systemctl disable --now NAME`'],
        ['Status', '`launchctl print gui/$(id -u)/LABEL`', '`systemctl status NAME`'],
        ['Logs', 'the files you name, or `log stream --predicate …`', '`journalctl -u NAME` (add `-f` to follow, `--since "10 min ago"`)'],
        ['Restart on crash', '`KeepAlive`', '`Restart=on-failure`'],
        ['Reload after editing', 'bootout, then bootstrap', '`sudo systemctl daemon-reload`, then restart'],
    ], 'The same tasks on both systems'),
    CMD('systemctl', 'srv-svc', 'linux', 'Start, stop, enable, inspect and restart systemd services on a Linux machine.',
        'systemctl [--user] COMMAND [UNIT…]',
        ['`systemctl` talks to systemd, process 1 on almost every current Linux distribution. A **unit** is anything systemd manages: a service, a timer, a mount, a socket. `start` and `stop` act now; `enable` and `disable` decide what happens at the next boot by creating or removing links from a target such as `multi-user.target`. `enable --now` does both.',
         'Changing a unit file does nothing until `daemon-reload`, which makes systemd re-read every unit. `restart` stops and starts the service; `reload` asks it to re-read its own configuration without dropping connections, if the service supports that (nginx does).'],
        flags=[('status UNIT', 'state, PID, memory, the command line and the last ten log lines'), ('enable --now UNIT', 'start it and start it at every boot'),
               ('restart / reload UNIT', 'full restart, or re-read the configuration in place'), ('daemon-reload', 're-read unit files after you edit them'),
               ('--failed', 'list units that failed'), ('cat UNIT', 'print the unit file and any drop-in overrides'), ('edit UNIT', 'create an override file instead of editing the vendor unit')],
        examples=[('ex', 'Check a service and its recent log lines', 'systemctl status nginx'),
                  ('ex', 'Start a service now and at every boot', 'sudo systemctl enable --now labapi'),
                  ('pipe', 'List the names of every failed unit', "systemctl --failed --no-legend | awk '{print $2}'")],
        gotchas=['`systemctl status` uses a pager. Add `--no-pager` in scripts, or the script waits for you to press q.',
                 'Editing `/lib/systemd/system/*.service` directly is lost on the next package update. Use `systemctl edit NAME` to create an override.'],
        see=['journalctl', 'launchctl', 'ss'], tags=['linux', 'services']),
    CMD('journalctl', 'srv-svc', 'linux', 'Read and follow the systemd journal: the log of the kernel, every service and the boot.',
        'journalctl [-u UNIT] [-f] [--since TIME] [-p PRIORITY] [-n N] [-o FORMAT]',
        ['systemd captures everything a service writes to stdout and stderr, adds metadata (unit, PID, priority, boot ID, timestamp) and stores it in a binary journal. `journalctl` queries it. Filters combine, so `-u nginx -p err --since today` means errors from nginx today.',
         'On many distributions the journal is kept only in memory until `/var/log/journal` exists. Create that directory (or set `Storage=persistent`) if you want logs to survive a reboot.'],
        flags=[('-u UNIT', 'one service (repeatable)'), ('-f', 'follow new lines, like `tail -f`'), ('--since "1 hour ago"', 'time filter; also `--until`, `today`, `yesterday`, full timestamps'),
               ('-p err', 'priority `err` and worse (emerg, alert, crit, err, warning, notice, info, debug)'), ('-b', 'this boot only; `-b -1` for the previous boot'),
               ('-n 50', 'last 50 lines'), ('-o json', 'one JSON object per line, for scripts')],
        examples=[('ex', 'Follow one service live', 'journalctl -u labapi -f'),
                  ('ex', 'Errors from this boot', 'journalctl -b -p err'),
                  ('pipe', 'Count log lines per service in the last hour', "journalctl --since '1 hour ago' -o json | jq -r '._SYSTEMD_UNIT // \"kernel\"' | sort | uniq -c | sort -rn | head")],
        gotchas=['Without `sudo` (or membership of the `systemd-journal` or `adm` group) you may see only your own user\'s messages and a hint about missing permissions.'],
        see=['systemctl', 'log'], tags=['linux', 'logs']),
    CMD('launchctl bootstrap', 'srv-svc', 'mac', 'Load, unload, restart and inspect a launchd service with the modern domain-target subcommands.',
        'launchctl bootstrap|bootout|print|kickstart DOMAIN[/LABEL] [PLIST]',
        ['launchd is process 1 on macOS. Every job lives in a **domain**: `gui/501` for agents of the logged-in user with UID 501, `system` for daemons. The modern subcommands take a domain target: `bootstrap gui/$(id -u) FILE` loads a plist, `bootout gui/$(id -u)/LABEL` unloads it, `print` dumps its state, and `kickstart -k` restarts it.',
         'The older `load` and `unload` subcommands still work, but Apple documents them as legacy and their error messages are less useful.'],
        flags=[('bootstrap gui/$(id -u) FILE', 'load a LaunchAgent for the current user'), ('bootout gui/$(id -u)/LABEL', 'stop and unload it'),
               ('print gui/$(id -u)/LABEL', 'state, PID, last exit code, program, environment'), ('kickstart -k gui/$(id -u)/LABEL', 'kill and restart the running job'),
               ('list', 'every job in your domain with PID and last exit status')],
        examples=[('ex', 'Load your lab API as a LaunchAgent', 'launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/lab.api.plist'),
                  ('ex', 'Restart it after changing the script', 'launchctl kickstart -k gui/$(id -u)/lab.api'),
                  ('pipe', 'Show only jobs that exited with an error', "launchctl list | awk 'NR > 1 && $2 != 0 && $2 != \"-\"'")],
        gotchas=['Paths in a plist must be absolute, and the job does not inherit your shell\'s `PATH`. Call programs by full path such as `/opt/homebrew/bin/python3`.',
                 'Editing a loaded plist changes nothing until you `bootout` and `bootstrap` it again.'],
        see=['plutil', 'systemctl'], tags=['services']),
    CMD('ss', 'srv-admin', 'linux', 'List sockets on Linux: who is listening on which port, and every open connection.',
        'ss [-t] [-u] [-l] [-n] [-p]',
        ['`ss` reads socket state straight from the kernel through netlink, which makes it fast even on busy servers. It replaced `netstat` on Linux. The macOS equivalent for "who listens on this port" is `lsof -nP -iTCP -sTCP:LISTEN`.',
         'The `Local Address:Port` column tells you the bind address. `0.0.0.0:80` or `*:80` is open on every interface; `127.0.0.1:5432` is loopback only. That one column answers "can the network reach this?" before you even touch the firewall.'],
        flags=[('-t / -u', 'TCP / UDP sockets'), ('-l', 'listening sockets only'), ('-n', 'numbers, no name lookups'), ('-p', 'the owning process (needs `sudo` for other users\' processes)'), ('state established', 'filter by state')],
        examples=[('ex', 'Every listening TCP port and the program behind it', 'sudo ss -ltnp'),
                  ('pipe', 'Count established connections per remote address', "ss -tn state established | awk 'NR > 1 {split($4, a, \":\"); print a[1]}' | sort | uniq -c | sort -rn | head")],
        see=['lsof', 'systemctl'], tags=['linux', 'ports']),

    H2('Reading server logs', 'logs'),
    P('''Logs are a server's memory. When something breaks, the first question is always "what does the log say?", and the second is
    "what changed?". The most common format on the web is the **combined log format**, written by nginx and Apache for every request:'''),
    ANAT('One line of an nginx access log', [
        ('203.0.113.50', 'client address (or the proxy\'s, unless you configure real-IP headers)'),
        ('- -', 'identity and authenticated user: almost always empty'),
        ('[16/Nov/2026:10:02:11 +0000]', 'when the request finished, with the server\'s UTC offset'),
        ('"GET /api/devices HTTP/2.0"', 'the request line: method, path with query string, protocol'),
        ('200', 'the status code the server sent'),
        ('412', 'response body size in bytes, not counting headers'),
        ('"-"', 'the Referer header: the page that linked here'),
        ('"curl/8.7.1"', 'the User-Agent header: what the client says it is'),
    ]),
    P('The box below parses a small log with one regular expression and answers the three questions you ask every time: how much traffic, how many errors, and what is failing.'),
    RUN(r'''
    import re
    from collections import Counter

    LOG = """203.0.113.50 - - [16/Nov/2026:10:02:11 +0000] "GET /api/devices HTTP/2.0" 200 412 "-" "curl/8.7.1"
    198.51.100.7 - - [16/Nov/2026:10:02:12 +0000] "GET / HTTP/2.0" 200 1530 "-" "Mozilla/5.0"
    198.51.100.7 - - [16/Nov/2026:10:02:12 +0000] "GET /static/app.css HTTP/2.0" 200 8812 "https://app.lab.example/" "Mozilla/5.0"
    192.0.2.66 - - [16/Nov/2026:10:02:13 +0000] "GET /wp-login.php HTTP/1.1" 404 153 "-" "python-requests/2.32"
    192.0.2.66 - - [16/Nov/2026:10:02:13 +0000] "GET /.env HTTP/1.1" 404 153 "-" "python-requests/2.32"
    203.0.113.50 - - [16/Nov/2026:10:02:15 +0000] "POST /api/devices HTTP/2.0" 502 157 "-" "curl/8.7.1"
    203.0.113.50 - - [16/Nov/2026:10:02:19 +0000] "POST /api/devices HTTP/2.0" 502 157 "-" "curl/8.7.1"
    198.51.100.7 - - [16/Nov/2026:10:02:21 +0000] "GET /api/devices HTTP/2.0" 200 412 "-" "Mozilla/5.0"
    """

    LINE = re.compile(r'(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d{3}) (\d+)')
    rows = [LINE.match(l).groups() for l in LOG.strip().splitlines()]

    print(len(rows), "requests,", sum(int(r[5]) for r in rows), "bytes")
    print("by status:", dict(sorted(Counter(r[4][0] + "xx" for r in rows).items())))
    errors = Counter((r[2], r[3], r[4]) for r in rows if r[4] >= "500")
    for (method, path, status), n in errors.most_common():
        print("server error:", n, "x", method, path, status)
    probes = sorted({r[0] for r in rows if r[4] == "404"})
    print("404s came from:", ", ".join(probes))
    '''),
    P('''Two patterns show up in almost every real log. The `502` lines are your problem: the proxy could not reach the application.
    The `404`s for `/wp-login.php` and `/.env` are not: automated scanners request well-known files on every public IP address all day.
    They are noise, but they also prove your server is visible to the whole internet within minutes of going live.'''),
    CALLOUT('tip', 'The shell version', '''On a real server the same questions are one pipeline each:
    `awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn` counts status codes, and
    `awk '$9 >= 500 {print $7}' access.log | sort | uniq -c | sort -rn | head` lists the paths that fail. Field 9 is the status and
    field 7 the path, because `awk` splits on spaces and the date contains one.'''),
    EX('servers-ex-error-rate-per-path', 'Error rate per path', 'py',
       '''Write `error_rates(lines)` that takes access-log lines in the combined format and returns a dictionary mapping each path to the
       fraction of its requests that got a status of 500 or higher, rounded to two decimal places. Ignore the query string, so
       `/api/devices?type=pi` counts as `/api/devices`. Paths with no errors map to `0.0`.''',
       r'''
       import re
       from collections import defaultdict

       LINE = re.compile(r'"\S+ (\S+) [^"]*" (\d{3}) ')

       def error_rates(lines):
           total, bad = defaultdict(int), defaultdict(int)
           for line in lines:
               m = LINE.search(line)
               if not m:
                   continue
               path = m.group(1).split("?")[0]
               total[path] += 1
               if int(m.group(2)) >= 500:
                   bad[path] += 1
           return {p: round(bad[p] / total[p], 2) for p in total}
       ''',
       hints=['`re.search(r\'"\\S+ (\\S+) [^"]*" (\\d{3}) \', line)` captures the path and the status.', 'Count totals and errors in two dictionaries, then divide.'],
       why='''Error *rate* per path beats a raw count: ten errors out of ten requests is an outage, ten out of a million is noise. Splitting
       on `?` groups the same endpoint with different parameters, which is what you want when the question is "which endpoint is broken".''',
       starter='''
       def error_rates(lines):
           return {}
       ''',
       check='''
       L = ['1.1.1.1 - - [x] "GET /a?x=1 HTTP/1.1" 200 5 "-" "c"', '1.1.1.1 - - [x] "GET /a HTTP/1.1" 502 5 "-" "c"',
            '1.1.1.1 - - [x] "POST /b HTTP/1.1" 201 5 "-" "c"', '1.1.1.1 - - [x] "GET /a HTTP/1.1" 200 5 "-" "c"',
            '1.1.1.1 - - [x] "GET /c HTTP/1.1" 503 5 "-" "c"', 'garbage line']
       r = error_rates(L)
       assert isinstance(r, dict), "Return a dict"
       assert r.get("/a") == 0.33, "/a had 1 error in 3 requests: expected 0.33, got " + repr(r.get("/a"))
       assert r.get("/b") == 0.0, "/b had no errors: expected 0.0"
       assert r.get("/c") == 1.0, "/c failed every time: expected 1.0"
       assert "/a?x=1" not in r, "Ignore the query string"
       '''),

    H2('A Linux server in its first fifteen minutes', 'linux'),
    P('''Sooner or later your server runs on Linux: a Raspberry Pi on your shelf, a VM in your homelab or a small cloud instance.
    You will reach it with `ssh` (the SSH chapter covers keys and config). These are the first things to do on a fresh Debian or Ubuntu
    machine, in order. Each one closes a door that automated attacks try within hours.'''),
    OL('**Update everything**: `sudo apt update && sudo apt full-upgrade -y`, then reboot if the kernel changed.',
       '**Create your own user** and stop using `root` or a default account: `sudo adduser learner` then `sudo usermod -aG sudo learner`.',
       '**Install your SSH key** for that user from your Mac: `ssh-copy-id learner@{{ip}}`, then log in once with the key to prove it works.',
       '**Turn off password logins**: in `/etc/ssh/sshd_config` (or a file in `/etc/ssh/sshd_config.d/`) set `PasswordAuthentication no` and `PermitRootLogin no`, check with `sudo sshd -t`, then `sudo systemctl reload ssh`. Keep your current session open until a new login works.',
       '**Turn on a firewall** that allows only what you serve: `sudo ufw allow OpenSSH`, `sudo ufw allow 443/tcp`, `sudo ufw enable`.',
       '**Install security updates automatically**: `sudo apt install unattended-upgrades` and confirm `/etc/apt/apt.conf.d/20auto-upgrades` enables them.',
       '**Set the time zone and check the clock**: `timedatectl`. TLS certificates, logs and two-factor codes all depend on a correct clock.'),
    CALLOUT('danger', 'Do not lock yourself out', '''Changing SSH or firewall settings over SSH is the classic way to lose a server. Always allow SSH in the
    firewall *before* `ufw enable`, test a new login in a second Terminal tab *before* closing the first, and know your way back in: a
    monitor and keyboard for a Pi, or the provider's web console for a cloud machine.'''),
    CMD('ufw', 'srv-admin', 'linux', 'Uncomplicated Firewall: a friendly front end to the Linux packet filter for Debian and Ubuntu.',
        'sudo ufw allow|deny|delete|status|enable [RULE]',
        ['ufw writes nftables or iptables rules for you. Its default policy, once enabled, is to deny incoming connections and allow outgoing ones, so you only describe what should be reachable. Rules can name a port (`443/tcp`), an application profile that a package installed (`OpenSSH`, `Nginx Full`) or a source network (`from 192.168.1.0/24 to any port 22`).',
         'A firewall rule stops packets before any program sees them. The client sees a timeout, not a refusal, which is how you tell "blocked" from "nothing listening" when you troubleshoot.'],
        flags=[('allow 443/tcp', 'open a port to everyone'), ('allow from 192.168.1.0/24 to any port 22', 'open a port to one network only'),
               ('status numbered', 'list rules with numbers'), ('delete N', 'remove rule number N'), ('enable / disable', 'turn the firewall on or off (enable persists across reboots)'),
               ('app list', 'application profiles installed by packages')],
        examples=[('ex', 'Allow SSH from your LAN only, then HTTPS from anywhere', 'sudo ufw allow from {{subnet}} to any port 22 proto tcp\nsudo ufw allow 443/tcp\nsudo ufw enable'),
                  ('ex', 'See what is open', 'sudo ufw status verbose')],
        gotchas=['Docker publishes container ports by writing its own iptables rules, which bypass ufw. A port published with `-p 8080:80` can be reachable even when ufw says it is closed. Publish to `127.0.0.1:8080:80` instead, or use your cloud firewall.'],
        see=['ss', 'systemctl'], tags=['linux', 'firewall', 'sudo']),

    H2('A request\'s journey through a server', 'journey'),
    P('''Production servers are a stack, not a program. A request to a typical web app passes through DNS, a firewall, a reverse proxy
    that terminates TLS, an application server and a database, and each layer fails in its own recognisable way. Learn the symptoms and
    you can point at the broken layer from your laptop, before you even log in.'''),
    WIDGET('reqjourney'),
    TABLE(['Client sees', 'Layer', 'Meaning', 'First thing to run'], [
        ['`Could not resolve host`', 'DNS', 'the name has no answer', '`dig +short NAME`'],
        ['timeout after a long wait', 'network or firewall', 'packets are dropped somewhere', '`nc -vz -w 3 HOST 443`, then the firewall or security group'],
        ['`Connection refused`, instantly', 'the server machine', 'it is reachable, but nothing listens on the port', '`sudo ss -ltnp` on the server'],
        ['certificate error', 'TLS', 'expired, wrong name, or an untrusted chain', '`openssl s_client -connect HOST:443 -servername HOST`'],
        ['`502 Bad Gateway`', 'between proxy and app', 'nginx is up, the app is not reachable', '`systemctl status APP`, the nginx error log'],
        ['`504 Gateway Timeout`', 'the app', 'the app accepted the request but is too slow', 'app logs, slow queries, outgoing calls'],
        ['`500 Internal Server Error`', 'the app or what it depends on', 'your code (or its database) failed', 'the app\'s log and traceback'],
    ], 'Symptom to layer'),
    EX('servers-ex-symptom-to-layer', 'Name the broken layer', 'think',
       '''For each report, name the layer that is most likely broken and the first command you would run: (a) "The site loaded yesterday;
       today the browser says the connection is not private and the certificate expired." (b) "curl hangs for over a minute and then fails."
       (c) "We get a page from nginx that says 502 Bad Gateway." (d) "curl prints Connection refused immediately."''',
       '''(a) TLS: the certificate on the proxy expired. Run openssl s_client -connect HOST:443 -servername HOST and read notAfter; renew (certbot renew) and reload nginx.
(b) Network or firewall: packets are being dropped. Run nc -vz -w 3 HOST 443 and check the firewall or cloud security group, and whether the machine is running at all.
(c) The application behind nginx: nginx is fine but cannot reach its upstream. On the server: systemctl status APP, then the nginx error log (connect() failed ... while connecting to upstream).
(d) The server machine is reachable but nothing listens on that port: the proxy or service is stopped. On the server: sudo ss -ltnp and systemctl status nginx.''',
       hints=['A timeout means nobody answered. A refusal means the machine answered "no one here".', 'A 5xx status means an HTTP server answered, so DNS, the network and TLS all worked.'],
       why='''The kind of failure carries information. Errors that arrive instantly come from a machine that received your packet; errors
       after a long wait come from silence. An HTTP status code proves every layer below HTTP is healthy. Reading symptoms this way lets
       you skip whole layers when you troubleshoot.'''),

    H2('Reverse proxies and nginx', 'nginx'),
    P('''Almost no application faces the internet directly. A **reverse proxy** sits in front: it accepts every connection, handles
    TLS, serves static files fast, applies limits, and forwards the rest to one or more applications on private ports. It means your
    Python or Node process never has to cope with slow clients, certificate renewals or a flood of connections. nginx is the most common
    one; Caddy is a newer, simpler alternative that obtains HTTPS certificates automatically.'''),
    ASCII('''
                       ⟪c:internet⟫                     ⟪w:one server⟫
      browser ──https──▶ :443 ⟪b:nginx⟫ ──┬── /api/*     ──http──▶ 127.0.0.1:8000  ⟪y:Python app⟫
      curl    ──https──▶       TLS    ├── /static/*   ──────────▶ /srv/www        ⟪d:files on disk⟫
      phone   ──https──▶       limits └── /           ──http──▶ 127.0.0.1:3000  ⟪y:Node front end⟫
                                        only :443 is open; the apps listen on loopback
    '''),
    P('A small but complete site configuration looks like this. It lives in `/etc/nginx/sites-available/` on Debian and Ubuntu (linked into `sites-enabled/`), or in `/etc/nginx/conf.d/*.conf` elsewhere:'),
    FILE('app.lab.example.conf', '''
    server {
        listen 80;
        server_name app.lab.example;
        return 301 https://$host$request_uri;          # send every http request to https
    }

    server {
        listen 443 ssl;
        http2 on;                                      # nginx 1.25.1+; older: listen 443 ssl http2;
        server_name app.lab.example;

        ssl_certificate     /etc/letsencrypt/live/app.lab.example/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/app.lab.example/privkey.pem;

        access_log /var/log/nginx/app.access.log;
        error_log  /var/log/nginx/app.error.log;
        client_max_body_size 5m;

        location /api/ {
            proxy_pass http://127.0.0.1:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 30s;
        }

        location ^~ /static/ {
            root /srv/www;
            expires 7d;
        }

        location / {
            proxy_pass http://127.0.0.1:3000;
        }
    }
    '''),
    UL('**`proxy_set_header`** lines pass on what the proxy knows and the app does not: the original host name, the client\'s address and whether the request came over HTTPS. Without them every request looks as if it came from `127.0.0.1` over plain HTTP.',
       '**`proxy_read_timeout`** is how long nginx waits for the app to start answering. When it runs out, the client gets the `504` you met above. The default is 60 seconds.',
       '**`client_max_body_size`** caps uploads (default 1 MB). A bigger upload gets a `413` error page from nginx before your app sees it.'),
    P('''The question people get wrong most often is which `location` handles a request. nginx does **not** take the first match in the
    file. Exact matches (`=`) win outright, then the longest matching prefix is remembered, then regular expressions are tried in order,
    and a regex match beats the remembered prefix unless that prefix was marked `^~`. Work through the examples below until you can predict
    every answer, then edit the config and try to break your own predictions.'''),
    WIDGET('proxyroute'),
    CALLOUT('gotcha', 'Prefix means prefix', '''`location /admin` also matches `/administrator` and `/admin-old.zip`: a prefix is compared character by character, not
    path segment by path segment. Write `location /admin/` (with the slash) when you mean the directory, and remember that `/admin` itself then
    falls through to another block.'''),
    CMD('nginx -t', 'srv-web', 'linux', 'Test the nginx configuration for errors before you reload it, and print the merged config.',
        'sudo nginx -t        sudo nginx -T',
        ['`-t` parses every configuration file, checks syntax and that referenced files such as certificates exist, and reports the first problem with its file and line. It does not touch the running server.',
         '`-T` does the same and then prints the entire merged configuration, every `include` expanded, which is the fastest way to answer "what is nginx actually running with?".',
         'The safe change routine is always the same: edit, `sudo nginx -t`, and only then `sudo systemctl reload nginx`. A reload starts new worker processes with the new configuration and lets old ones finish their requests, so nobody is disconnected. If the test fails, the running server is untouched.'],
        flags=[('-t', 'test the configuration and exit'), ('-T', 'test, then dump the full configuration'), ('-s reload', 'signal the running master to reload (the same as `systemctl reload nginx`)')],
        examples=[('ex', 'The safe reload', 'sudo nginx -t && sudo systemctl reload nginx'),
                  ('pipe', 'List every server_name nginx knows about', "sudo nginx -T 2>/dev/null | grep -E '^\\s*server_name' | sort -u")],
        gotchas=['`systemctl restart nginx` with a broken config stops the old server and fails to start the new one: an outage. `reload` with a broken config keeps the old one running.'],
        see=['systemctl', 'curl'], tags=['web server']),

    CHECK('servers-ch-server-basics-checkpoint', 'Server basics checkpoint',
          Q('A test server bound to `0.0.0.0:8000` on your laptop. Who can connect?', [('Only programs on the laptop', False), ('Anything that can reach any of the laptop\'s interfaces, unless a firewall blocks it', True), ('Nobody until you open the port in the router', False), ('Only clients that use TLS', False)],
            '`0.0.0.0` means every interface: loopback, Wi-Fi, Ethernet, VPN. Your router\'s NAT usually keeps the internet out, but everyone on the same network can connect. Bind to `127.0.0.1` for private work.'),
          Q('Starting a second copy of a server fails with `Address already in use`. Why?', [('The firewall blocks the port', False), ('Another socket is already listening on that address and port', True), ('The port number is above 1024', False), ('You need sudo', False)],
            'Only one listening socket can own an address and port. Find the owner with `lsof -nP -iTCP:PORT -sTCP:LISTEN` on macOS or `sudo ss -ltnp` on Linux.'),
          Q('Which file makes macOS keep your script running and restart it when it crashes?', [('A crontab entry', False), ('A LaunchAgent plist with KeepAlive', True), ('`~/.zshrc`', False), ('A systemd unit', False)],
            'launchd runs jobs described by plists; `KeepAlive` restarts them on exit. systemd units are the Linux equivalent.'),
          Q('Users see `502 Bad Gateway` from nginx. What do you know?', [('DNS is broken', False), ('The TLS certificate expired', False), ('nginx is running but could not get a response from its upstream application', True), ('The client sent invalid JSON', False)],
            'A 502 is generated by the proxy itself, so DNS, the network, TLS and nginx all worked. The application behind it is down, crashed or listening somewhere else.'),
          Q('nginx has `location /api/ {…}` and `location ~* \\.json$ {…}`. Which handles `/api/devices.json`?', [('`location /api/`, because it comes first', False), ('`location ~* \\.json$`, because a regex match beats a plain prefix', True), ('Both, in order', False), ('Neither', False)],
            'nginx remembers the longest prefix (`/api/`), then tries regexes. The regex matches, so it wins. Adding `^~` to the prefix would stop the regex check.'),
          Q('Why put a reverse proxy in front of an application server?', [('It makes the application code run faster', False), ('It handles TLS, static files, limits and slow clients so the app only sees clean requests on a private port', True), ('Browsers require it', False), ('It replaces the database', False)],
            'The proxy is the hardened front door. The app listens on loopback and never touches certificates or raw internet traffic.')),

    PROJECT('servers-pr-status-a-supervised-service', 'status: a supervised service with a health check', 'intermediate', 45,
            ['http.server', 'launchd', 'health checks', 'log parsing'],
            P('''Turn `api_server.py` into something you would be happy to leave running: a service that starts at login, restarts when it dies,
            logs in a format you can parse, and exposes a health check that a monitor can poll. The API client you write in the next chapter
            talks to this server, so keep it.'''),
            H3('1. Add structured logging'),
            P('''Override `log_message` in the handler so every request is logged as one JSON object per line with the time, client, method,
            path, status and duration in milliseconds. JSON lines are easy to filter with `jq` and to ship to a log system later. Record the
            start time in `parse_request` (call the parent first) and compute the duration in `log_request`.'''),
            H3('2. Make the health check honest'),
            P('''`/health` should report `ok` only if the service can do its job. Add a check that the data file it writes to is writable and
            return `503` with `{"status": "degraded", "reason": "…"}` when it is not. A health check that always says ok is worse than none.'''),
            H3('3. Supervise it with launchd'),
            P('''Install the LaunchAgent from this chapter, point `StandardErrorPath` at `~/lab/api.log`, and prove `KeepAlive` works:
            find the PID, `kill` it, and run `launchctl print gui/$(id -u)/lab.api` until a new PID appears.'''),
            H3('4. Watch it'),
            P('Write `~/lab/watch_api.zsh`, a loop that polls `/health` every five seconds and prints a timestamped line only when the status changes:'),
            FILE('watch_api.zsh', '''
            #!/bin/zsh
            # watch_api.zsh - print a line whenever the health status changes
            url=${1:-http://127.0.0.1:8080/health}
            last=""
            while true; do
              code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$url")
              if [[ $code != "$last" ]]; then
                print "$(date '+%H:%M:%S') health=$code"
                last=$code
              fi
              sleep 5
            done
            '''),
            H3('5. Stretch goals'),
            UL('Count requests per status code in memory and serve them at `/metrics` as plain text, one `name value` pair per line.',
               'Run the same script on a Raspberry Pi or Linux VM as the systemd unit from this chapter, behind nginx.',
               'Make `watch_api.zsh` send a macOS notification on change with `osascript -e \'display notification "health changed" with title "lab api"\'`.')),
]

terms = [
    ('server', 'a process that listens on an address and port and answers requests from clients'),
    ('bind address', 'the local address a listening socket accepts connections on: 127.0.0.1 for this machine only, 0.0.0.0 for every interface'),
    ('daemon', 'a long-running background process, usually started and supervised by the service manager'),
    ('launchd', 'the macOS service manager and process 1; runs LaunchAgents and LaunchDaemons from plists'),
    ('systemd', 'the Linux service manager and process 1 on most distributions; runs units such as services and timers'),
    ('WSGI', 'the Python standard interface (PEP 3333) between a web server and an application function'),
    ('reverse proxy', 'a server that accepts client connections and forwards requests to applications behind it'),
    ('upstream', 'in nginx, the application server a request is forwarded to'),
    ('502 Bad Gateway', 'status sent by a proxy when it cannot get a valid response from the upstream'),
    ('504 Gateway Timeout', 'status sent by a proxy when the upstream does not answer in time'),
    ('access log', 'one line per request: client, time, request line, status, size, referrer and user agent'),
]

CHAPTER = chapter('servers', 'Server Basics: Services, Logs and Reverse Proxies',
                  'Run servers on your Mac, look inside the request loop, keep services alive with launchd and systemd, read logs, and route requests with nginx',
                  'node', 110,
                  ['Explain what makes a process a server and choose the right bind address for it',
                   'Write and test a JSON API with the standard library, and test application code without a network',
                   'Keep a server running with a LaunchAgent on macOS or a systemd unit on Linux, and read its logs',
                   'Secure a fresh Linux server in the first fifteen minutes without locking yourself out',
                   'Name the failing layer from the symptom a client sees, and predict which nginx location answers a request'],
                  blocks, terms, file='38-servers.gm')
