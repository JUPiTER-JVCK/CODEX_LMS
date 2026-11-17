// CODEX_LMS single file. Opened in a browser this whole block is an HTML comment.
// Run with node it is the launcher:  node CODEX_LMS.html [--tui | --html | --app | --extract DIR | --info | --help]
(function () {
  var fs = require("fs"), path = require("path"), os = require("os"), zlib = require("zlib"), cp = require("child_process"), http = require("http");
  var T = fs.readFileSync(__filename, "latin1");
  var argv = process.argv.slice(require.main === module ? 2 : 1);
  function seg(id) {
    var open = '<script type="text/plain" id="p:' + id + '">';
    var a = T.indexOf(open);
    if (a < 0) return null;
    a += open.length;
    return T.slice(a, T.indexOf("</script>", a));
  }
  function bin(id) { var s = seg(id); return s === null ? null : Buffer.from(s, "base64"); }
  function gz(id) { var b = bin(id); return b ? zlib.gunzipSync(b) : null; }
  var meta = JSON.parse(seg("meta"));
  function fail(m) { process.stderr.write("CODEX_LMS: " + m + "\n"); process.exit(1); }
  var HELP = "CODEX_LMS, one file that is three things\n\n" +
    "  open it in a browser     the book as a web page (works offline, Python included)\n" +
    "  node CODEX_LMS.html      the terminal app (Node 18 or newer)\n" +
    "  node CODEX_LMS.html --app    install and open the Mac app (macOS)\n\n" +
    "options: --tui (default)  --html (serve the page and open a browser)  --app [--to DIR]\n" +
    "         --extract DIR (write the page, python runtime, terminal app and Mac app out)  --info  --help\n" +
    "terminal app options: --theme dark|light|system  --no-mouse  --no-splash  --list  --dump ID\n" +
    "If node says ERR_UNKNOWN_FILE_EXTENSION, run: node -e \"require('./CODEX_LMS.html')\" -- --tui\n";
  function open(url) {
    var c = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
    try { cp.spawn(c[0], c[1], { stdio: "ignore", detached: true }).on("error", function () {}).unref(); } catch (e) {}
  }
  function pyFiles() {
    var out = {};
    meta.py.forEach(function (n) { out[n] = gz("py/" + n); });
    return out;
  }
  var mode = "tui", rest = [], to = null, dir = null;
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === "--help" || a === "-h") mode = "help";
    else if (a === "--info") mode = "info";
    else if (a === "--html") mode = "html";
    else if (a === "--app") mode = "app";
    else if (a === "--tui") mode = "tui";
    else if (a === "--extract") { mode = "extract"; dir = argv[++i]; }
    else if (a === "--to") to = argv[++i];
    else rest.push(a);
  }
  if (mode === "help") { process.stdout.write(HELP); return; }
  if (mode === "info") {
    process.stdout.write("CODEX_LMS " + meta.version + "\n");
    Object.keys(meta.parts).forEach(function (k) { process.stdout.write("  " + k + "  " + meta.parts[k] + " bytes\n"); });
    return;
  }
  if (mode === "extract") {
    if (!dir) fail("--extract needs a folder");
    fs.mkdirSync(path.join(dir, "py"), { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), gz("page"));
    var py = pyFiles();
    Object.keys(py).forEach(function (n) { fs.writeFileSync(path.join(dir, "py", n), py[n]); });
    if (seg("tui")) fs.writeFileSync(path.join(dir, "codex-tui.mjs"), gz("tui"));
    if (seg("app")) fs.writeFileSync(path.join(dir, "CODEX_LMS-mac.zip"), bin("app"));
    process.stdout.write("wrote " + dir + "\n");
    return;
  }
  if (mode === "html") {
    var page = gz("page"), files = pyFiles();
    var types = { ".wasm": "application/wasm", ".js": "text/javascript", ".json": "application/json" };
    var server = http.createServer(function (req, res) {
      var u = req.url.split("?")[0], body = null, type = "application/octet-stream";
      if (u === "/" || u === "/index.html") { body = page; type = "text/html; charset=utf-8"; }
      else if (u.indexOf("/py/") === 0 && files[u.slice(4)]) { body = files[u.slice(4)]; type = types[path.extname(u)] || type; }
      if (!body) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": type }); res.end(body);
    });
    server.listen(0, "127.0.0.1", function () {
      var url = "http://127.0.0.1:" + server.address().port + "/";
      process.stdout.write("CODEX_LMS is open at " + url + "   (Ctrl-C to stop)\n");
      open(url);
    });
    return;
  }
  if (mode === "app") {
    if (process.platform !== "darwin") fail("the Mac app only runs on macOS. Use the terminal app (node CODEX_LMS.html) or open this file in a browser.");
    if (!seg("app")) fail("this copy was built without the Mac app. Get CODEX_LMS-mac.zip from the project's releases.");
    var dest = to || path.join(os.homedir(), "Applications");
    fs.mkdirSync(dest, { recursive: true });
    var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-lms-"));
    try {
      var z = path.join(tmp, "app.zip");
      fs.writeFileSync(z, bin("app"));
      cp.execFileSync("ditto", ["-x", "-k", z, dest]);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    process.stdout.write("installed " + path.join(dest, "CODEX_LMS.app") + "\n");
    open(path.join(dest, "CODEX_LMS.app"));
    return;
  }
  // terminal app
  globalThis.__CODEX_BOOK_HTML = gz("page").toString("utf8");
  var src = gz("tui").toString("utf8").replace(/^#![^\n]*\n/, "");
  import("data:text/javascript;base64," + Buffer.from(src).toString("base64")).then(function (m) { return m.main(rest); }).then(function (code) { process.exit(code); }, function (e) { fail(String(e && e.stack || e)); });
})();
