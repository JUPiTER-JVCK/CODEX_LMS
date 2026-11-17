(function () {
  var g = __fflate.gunzipSync;
  function u8(s) { var b = atob(s.replace(/\s+/g, "")), n = b.length, o = new Uint8Array(n); for (var i = 0; i < n; i++) o[i] = b.charCodeAt(i); return o; }
  function el(id) { var e = document.getElementById("p:" + id); return e ? e.textContent : null; }
  var meta = JSON.parse(el("meta")), RAW = { page: el("page"), app: el("app") }, PY = {};
  meta.py.forEach(function (n) { PY[n] = el("py/" + n); });
  function download(name, bytes, type) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: type || "application/octet-stream" }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  // Python from file:// or anywhere: serve the worker and the Pyodide files from embedded data.
  // Blob URLs cannot be imported across a file:// origin, so scripts are embedded in the worker source
  // and the binaries arrive in a first message.
  if (meta.py.length) {
    var Real = window.Worker, FAKE = "https://codex-lms.invalid/py/";
    var BIN = { "pyodide.asm.wasm": "application/wasm", "stdlib.dat.wasm": "application/octet-stream", "pyodide-lock.json": "application/json" };
    var PRE = "var __FAKE=" + JSON.stringify(FAKE) + ";var __JS=__JSJSON__;var __T=__TJSON__;var __files=null;var __wait;var __ok=new Promise(function(r){__wait=r;});" +
      "function __k(u){u=String(u&&u.url||u);return u.indexOf(__FAKE)===0?u.slice(__FAKE.length).split('?')[0]:null;}" +
      "self.addEventListener('message',function(e){if(e.data&&e.data.__files){e.stopImmediatePropagation();__files=e.data.__files;__wait();}});" +
      "var __f=self.fetch.bind(self);self.fetch=function(u,o){var k=__k(u);if(!k)return __f(u,o);return __ok.then(function(){return new Response(__files[k],{headers:{'content-type':__T[k]||'application/octet-stream'}});});};" +
      "self.importScripts=function(){for(var i=0;i<arguments.length;i++){var k=__k(arguments[i]);if(k===null||__JS[k]===undefined)throw new Error('cannot load '+arguments[i]);(0,eval)(__JS[k]);}};\n";
    var Fake = function (url, opts) {
      if (String(url) !== "py/worker.js") return new Real(url, opts);
      var td = new TextDecoder(), js = {};
      ["pyodide.js", "pyodide.asm.js"].forEach(function (n) { js[n] = td.decode(g(u8(PY[n]))); });
      var w = td.decode(g(u8(PY["worker.js"]))).replace("new URL('./', self.location.href).href", "__FAKE");
      var src = PRE.replace("__JSJSON__", function () { return JSON.stringify(js); }).replace("__TJSON__", JSON.stringify(BIN)) + w;
      var worker = new Real(URL.createObjectURL(new Blob([src], { type: "text/javascript" })), opts);
      var files = {}, tr = [];
      Object.keys(BIN).forEach(function (n) { files[n] = g(u8(PY[n])).buffer; tr.push(files[n]); });
      worker.postMessage({ __files: files }, tr);
      return worker;
    };
    Fake.prototype = Real.prototype;
    window.Worker = Fake;
  }
  function panel() {
    var b = document.createElement("button");
    b.textContent = "Other ways to open this";
    b.setAttribute("style", "position:fixed;left:10px;bottom:10px;z-index:9999;font:12px system-ui,sans-serif;padding:5px 10px;border-radius:6px;border:1px solid var(--line,#888);background:var(--panel,#fff);color:var(--mute,#555);opacity:.75;cursor:pointer");
    var box = document.createElement("div");
    box.hidden = true;
    box.setAttribute("style", "position:fixed;left:10px;bottom:46px;z-index:9999;max-width:360px;font:13px/1.5 system-ui,sans-serif;padding:12px 14px;border-radius:8px;border:1px solid var(--line,#888);background:var(--panel,#fff);color:var(--fg,#111);box-shadow:0 8px 24px #0004");
    box.innerHTML = "<b>This one file is three things.</b><br>In a browser: the book (this page).<br>In a terminal: <code>node CODEX_LMS.html</code><br>On a Mac: <code>node CODEX_LMS.html --app</code>" + (RAW.app ? "<br><button id='bundle-app' style='margin-top:8px'>Save the Mac app (.zip)</button>" : "");
    b.onclick = function () { box.hidden = !box.hidden; };
    document.body.appendChild(box); document.body.appendChild(b);
    var d = document.getElementById("bundle-app");
    if (d) d.onclick = function () { download("CODEX_LMS-mac.zip", u8(RAW.app), "application/zip"); };
  }
  var html = new TextDecoder().decode(g(u8(RAW.page)));
  document.open(); document.write(html); document.close();
  setTimeout(panel, 0);
})();
