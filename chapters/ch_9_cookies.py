from lib import *

# Web development part, after "The DOM".
# Widgets (src/ws-9-cookies.js, src/ws-9-cookies-track.js): ckdance, ckbuilder, ckshop, ckattack, cktrack, ckprofile, ckpersist, ckfinger, cksort.
# The rules the labs apply live in src/ws-9-cookies-engine.js and are checked against a real Chromium by test/cookie_rules.py.

blocks = [
    P('''A **cookie** is a small piece of text that a website asks your browser to keep, and that your browser then sends back to the same website on later requests.
    That is the whole mechanism. It is also the reason the web has logins, shopping carts and “remember me”, and the reason an advertising company you have never heard of
    can know that the person reading a news story this morning is the same person who looked at a coat last week.'''),
    CALLOUT('note', 'A cookie does not learn anything. The system behind it does.',
            'Think of a cookie as a **name tag** your browser wears. Every time a server recognises the tag, it can file one more observation under the same name. '
            'The tag is dull. What matters is who reads it, how many different sites read the same tag, and what they do with the file they build. '
            'This chapter follows that chain: browser, cookie, event, profile, prediction. At each step you will see what is really happening, how to look at it yourself, and where the limits are.'),
    CALLOUT('why', 'Where this chapter belongs',
            'Cookies sit where three parts of the book meet, so you will find pointers to this chapter from all three. **Networking:** they are HTTP headers, `Set-Cookie` and `Cookie`, '
            'which you met in [HTTP and TLS](#http). **Web development:** they are one of the browser’s storage areas, and you inspect them with the [DevTools](#devtools). '
            '**Security:** a session cookie is a temporary password and tracking is a privacy question, so the second half of the chapter, and [Defending Your Mac and Servers](#defend), pick up from there.'),

    H2('What a cookie is', 'idea'),
    P('''HTTP is **stateless**: each request stands alone, and a server cannot tell that two requests came from the same browser. A cookie fixes that with one small agreement.
    The server puts a `Set-Cookie` header in a response; the browser stores it in its **cookie jar**; and on later requests to a matching address the browser adds a `Cookie` header
    without being asked. Step through three real exchanges: a first visit, a login, and an image from a third party.'''),
    WIDGET('ckdance'),
    P('''Here are the two headers from the first story, exactly as they appear on the wire. A cookie is created by one response and returned by every matching request after it:'''),
    TEXT('''
        HTTP/1.1 200 OK
        Content-Type: text/html
        Set-Cookie: visitor=8F31A92B; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax

        GET /products HTTP/1.1
        Host: shop.example
        Cookie: visitor=8F31A92B
    '''),
    P('''Two details are easy to miss. The server sends **attributes** (`Max-Age`, `Secure`, `HttpOnly`, `SameSite`) to tell the browser how to handle the cookie, but the browser sends back **only `name=value`**.
    The server never sees the attributes again. And nothing in the cookie says who you are: `8F31A92B` is a number the server made up. It becomes personal only if the server writes
    something personal next to it in its own database.'''),
    TABLE(['A cookie is…', 'A cookie is not…'], [
        ['a short piece of text (a few hundred bytes, 4 KB at most)', 'a program: it cannot run, read your files or reach your camera'],
        ['stored by the browser and returned by the browser on matching requests', 'something the server can read from your computer: the server only sees what the browser sends'],
        ['a **key** that points at data the server keeps (usually)', 'a record of your browsing history: the browser never sends other sites’ cookies'],
        ['a name tag: it says “this browser again”', 'an identity: it says nothing about who you are until you tell the site'],
    ], 'What a cookie is and is not'),

    H2('Anatomy of a cookie', 'anatomy'),
    P('''A cookie is a name, a value and a handful of attributes. Together they answer five questions: **who** gets the cookie back (`Domain`, `Path`), **over what** (`Secure`), **who may read it** (`HttpOnly`),
    **from which sites** (`SameSite`) and **for how long** (`Max-Age`, `Expires`).'''),
    ANAT('A Set-Cookie header, piece by piece', [
        ('session=k3J9xQ', 'the name and value. The value is usually a random key, never a password or personal data'),
        ('Domain=shop.example', 'optional. Without it the cookie belongs to the exact host that set it. **With** it, the cookie also goes to every subdomain, which is wider, not safer'),
        ('Path=/account', 'the cookie is sent only for URLs under this path. It is a convenience, not a security boundary'),
        ('Max-Age=1800', 'live for 1800 seconds. With no `Max-Age` or `Expires` it is a **session cookie** that goes when the browser session ends'),
        ('Secure', 'only send it over HTTPS. A browser also refuses to let a plain-http response set one'),
        ('HttpOnly', 'hide it from JavaScript: `document.cookie` will not list it, though it is still sent with requests'),
        ('SameSite=Lax', 'controls whether it travels in requests that start on a different site: `Strict`, `Lax` or `None`'),
    ]),
    P('''The workbench applies the browser’s real rules. Start from a preset, change one attribute at a time, and watch two things: whether the browser keeps the cookie at all, and which of seven requests
    carry it back. The three “Mistake” presets are rejected by real browsers, with the reasons you see. (The rules in this lab were compared with Chrome’s behaviour case by case; `test/cookie_rules.py` repeats that check.)'''),
    WIDGET('ckbuilder'),
    H3('First party, third party, same site', 'sites'),
    P('''A cookie is **first-party** when it belongs to the site shown in the address bar, and **third-party** when it belongs to something embedded in that page (an image, a script, an ad frame)
    from another site. “Another site” has a precise meaning for cookies: the **registrable domain**, one label to the left of the public suffix. `www.shop.example` and `pay.shop.example` are the same **site** (`shop.example`);
    `news.example` is a different one; `shop.co.uk` and `bank.co.uk` are different because `co.uk` is a public suffix. The related word **origin** is stricter: scheme, host and port must all match.
    Cookies follow sites; JavaScript’s same-origin policy follows origins.'''),
    TABLE(['SameSite', 'Sent on a request that starts on another site?', 'Use it for'], [
        ['`Strict`', 'never, not even when you click a link to the site', 'very sensitive actions; the site will look “logged out” when you arrive from a link'],
        ['`Lax`', 'only for a top-level navigation with a safe method (clicking a link): not for images, frames, `fetch` or form POSTs', 'login sessions; the sensible default'],
        ['`None` (and `Secure`)', 'always', 'cookies that must work inside another site’s page: embedded widgets, ad tech, single sign-on'],
        ['(not set)', 'Chrome treats it as Lax, with a short exception for cross-site POSTs; other browsers differ', 'nothing: always say what you mean'],
    ], 'SameSite in one table'),
    P('''Lifetimes have limits too. A session cookie lasts until the browser session ends (a browser that restores your tabs may keep it longer). A persistent cookie lasts until its `Max-Age` or `Expires`, but Chrome shortens anything
    over **400 days** to 400, so “10 years” no longer works there, and Safari has limited the lifetime of cookies written by JavaScript even more tightly (the details change between versions). Names that start with `__Secure-` or `__Host-` are a promise the browser enforces:
    `__Host-` cookies must be `Secure`, set from HTTPS, have `Path=/` and **no** `Domain`, so a sibling subdomain cannot overwrite them.'''),

    H2('Who uses cookies, and for what', 'who'),
    P('''Almost every site you visit sets cookies, and most of them are not trying to follow you. The useful split is by **purpose**, because that is also how privacy law and cookie banners divide them:'''),
    TABLE(['Purpose', 'Examples', 'Who sets them', 'Needs your consent (EU, UK)?'], [
        ['**Strictly necessary**', 'login session, shopping basket, form security (CSRF), load balancing, bot protection, the record of your banner choice', 'the site, or a vendor working for it (Cloudflare, Stripe)', 'no: the service would not work without them'],
        ['**Preferences**', 'language, theme, region, recently viewed', 'the site', 'usually yes, unless you asked for the setting in that session'],
        ['**Analytics**', 'counting visitors, pages and return visits; session recordings and heatmaps', 'the site’s analytics tool (Google Analytics, Hotjar, Segment, Matomo)', 'yes in most cases'],
        ['**Advertising**', 'frequency caps, interest profiles, conversion tracking, cross-site retargeting', 'ad networks and social platforms (Google Ads, Meta Pixel, many more)', 'yes'],
    ], 'Cookies by purpose'),
    P('''So **who uses cookies**? Four groups, with very different motives:'''),
    UL('**The site itself**, to remember a login, a basket or a choice. Nearly all of its cookies are first-party.',
       '**Analytics providers**, which hand the site a script that writes a first-party cookie (`_ga`) but sends the events to their own servers, so the site learns about its visitors and the provider learns about every site that uses it.',
       '**Advertising networks and social platforms**, which want the same ID on as many sites as possible, so they can add up what each visit says about you. These are the cookies that tracking protection targets.',
       '**Security, payment and consent vendors**, which use short-lived cookies to tell bots from people, spot payment fraud and remember your banner answer.'),
    P('''Try the sorting game. Each card is a real cookie name from a real kind of site: decide what it is for, and see who really uses it. The giveaways are who sets it (the site or someone else),
    how long it lives, and whether the page would break without it.'''),
    WIDGET('cksort'),
    CALLOUT('warn', 'Laws differ, and this book is not legal advice',
            'In the EU and the UK, rules based on the ePrivacy Directive and the GDPR generally require your consent before a site stores or reads cookies that are not strictly necessary, which is why you see banners. '
            'In California the CCPA and CPRA let you opt out of a business selling or sharing your data for cross-context advertising, and some browsers and extensions can send a **Global Privacy Control** signal to say so. '
            'Rules, and who must obey them, keep changing; a banner is also not proof a site obeys it.'),

    H2('Look at your own cookies', 'inspect'),
    P('''Everything above is visible in your browser, and you should look before you believe. Use a browser you control, on sites you are allowed to visit, and keep it to your own traffic.'''),
    TABLE(['Browser', 'Open the inspector', 'See cookies', 'See headers'], [
        ['Safari', 'Settings, Advanced, tick “Show features for web developers”; then Develop, Show Web Inspector ([[⌥]][[⌘]][[I]])', '**Storage** tab, Cookies', '**Network** tab, click a request, Headers'],
        ['Chrome', '[[⌥]][[⌘]][[I]]', '**Application** tab, Storage, Cookies', '**Network** tab, click a request, Headers, and the Cookies tab, which also shows cookies the browser **refused** to send, and why'],
        ['Firefox', '[[⌥]][[⌘]][[I]]', '**Storage** tab, Cookies', '**Network** tab, click a request, Headers and Cookies'],
    ], 'The same tools under three names'),
    CALLOUT('try', 'Lab 1: a cookie’s life, in your own browser',
            'Visit a site where you have an account. In the inspector: (1) find the cookie that keeps you logged in, and read its name, domain, path, expiry, `Secure`, `HttpOnly` and `SameSite` columns; '
            '(2) switch to Network, reload, and find that cookie in the **request** `Cookie` header; (3) go back and delete it, then reload: you are logged out, which shows the cookie was the key; '
            '(4) accept or reject a cookie banner and compare the jar before and after. Then repeat in a private window.'),
    P('''You can do the same from Terminal. The practice server from the HTTP chapter sets a cookie at `/login`, and `curl` keeps a **cookie jar** in a plain text file if you ask it to: `-c` writes the jar, `-b` reads it.'''),
    CMD('curl -c', 'net-http', 'mac', 'Keep cookies between curl calls: `-c FILE` saves the cookies a server sets, `-b FILE` sends them back, like a one-site browser.',
        'curl [-c JARFILE] [-b JARFILE | -b "name=value"] [-L] [-i | -D -] URL',
        ['curl has no cookie jar of its own: each run starts with nothing, like a private window. Give it `-c jar.txt` and it writes the cookies it receives in **Netscape format**, '
         'a tab-separated text file you can read with `cat`. Give it `-b jar.txt` and it sends the matching cookies on the request. Using both with the same file makes a session that survives from one command to the next.',
         '`-b "name=value"` (anything containing an `=`) sends that cookie directly, without a file. That is the way to test what a server does with a cookie you invented, for example an expired or tampered one.',
         '`-i` prints the response headers with the body and `-D -` prints only the headers to the terminal: look for `Set-Cookie`. Add `-L` to follow redirects, which login flows use heavily, and note that curl only re-sends '
         'cookies to the host and path the jar says they belong to.',
         'In the jar file, the first column is the domain, `TRUE` or `FALSE` says whether subdomains match, then the path, `TRUE` if Secure, the expiry as a Unix time (`0` means a session cookie), name and value. '
         'A line that starts with `#HttpOnly_` is a cookie marked HttpOnly.'],
        flags=[('-c FILE', 'write the cookies received to FILE when the transfer ends (`-c -` prints them)'), ('-b FILE | "a=b"', 'send cookies from FILE, or this literal cookie'), ('-D -', 'print the response headers to the terminal'),
               ('-i', 'include the response headers in the output'), ('-L', 'follow redirects'), ('-s', 'quiet: no progress meter')],
        examples=[('ex', 'Log in to the practice server and keep the cookie', '''
            curl -s -c jar.txt -D - http://127.0.0.1:8001/login -o /dev/null
            cat jar.txt''', '''
            HTTP/1.0 200 OK
            Server: BaseHTTP/0.6 Python/3.12.4
            Date: Mon, 23 Nov 2026 18:09:19 GMT
            Content-Type: application/json
            Content-Length: 157
            Set-Cookie: session=abc123; Path=/; HttpOnly

            # Netscape HTTP Cookie File
            # https://curl.se/docs/http-cookies.html
            # This file was generated by libcurl! Edit at your own risk.

            #HttpOnly_127.0.0.1	FALSE	/	FALSE	0	session	abc123'''),
                  ('ex', 'Send the saved cookie back, and a made-up one', '''
            curl -s -b jar.txt http://127.0.0.1:8001/ | grep -i cookie
            curl -s -b "session=not-a-real-session" http://127.0.0.1:8001/ | grep -i cookie''', '''
                    "Cookie": "session=abc123"
                    "Cookie": "session=not-a-real-session"''')],
        gotchas=['`-c` and `-b` with different files means you read one jar and write another; use the same file for both when you want a session.',
                 'A jar is a credential. Do not paste it into a ticket or commit it: anyone with a copy can use the session until it expires.',
                 'curl, like browsers, accepts and sends `Secure` cookies over plain http to `localhost` and `127.0.0.1`. A localhost test therefore cannot show that your `Secure` flag works: check against a real HTTPS URL.'],
        see=['curl', 'curl -I', 'curl -v'], tags=['cookies', 'session']),

    H2('A session cookie is a temporary password', 'guard'),
    P('''When you log in, the site gives your browser a cookie, and from then on the **cookie** is the proof that you are you. Anyone who copies it can act as you until it expires or the server forgets it, with no password and no
    second factor. That makes a login cookie one of the most valuable things in your browser, and it is why cookie attributes are security controls.'''),
    P('''There are three common designs, and the lab below lets you try each one. In a **server-side session** the cookie is only a random key and everything else sits in a table on the server. In a **plain cookie** the server
    stores the data itself (name, role, cart) and trusts it when it comes back. In a **signed cookie** the data is in the cookie, with a signature only the server can make. Log in, add to the cart, and then do
    to the cookie what a curious user or an attacker would.'''),
    WIDGET('ckshop'),
    UL('**Server-side sessions** are the usual choice for logins. The cookie reveals nothing, the server can end a session instantly (log out, password change, “sign out everywhere”), and the key is long and random, so guessing is not an option.',
       '**Plain cookies** that carry authority (`role=admin`, `price=10`) are a vulnerability. Never trust a value the browser can edit. Preferences such as a theme are fine; the damage of editing them is that you see a different colour.',
       '**Signed cookies** (and tokens such as JWTs) let a server avoid a lookup, and the signature stops edits. They are **readable** by anyone who has them, so never put secrets inside, and they are harder to cancel before they expire.'),
    P('''Stealing a cookie is not magic: it happens through a few well-known routes. Switch the attributes on and off, and watch which of three attacks still works.'''),
    WIDGET('ckattack'),
    TABLE(['Threat', 'How it works', 'What stops it', 'What it does not stop'], [
        ['**Script theft** (cross-site scripting)', 'injected JavaScript runs on your page and reads `document.cookie`', '`HttpOnly`; escaping output; a Content-Security-Policy (see the [DOM](#dom) chapter)', 'the same script making requests from the victim’s browser while the page is open'],
        ['**Forged request** (CSRF)', 'another site makes your browser send a request that carries your cookie', '`SameSite=Lax` or `Strict`; anti-CSRF tokens; checking `Origin`', 'attacks that start on the same site, such as a script injected into it'],
        ['**Snooping** on open Wi-Fi', 'a clear-text request exposes the cookie', '`Secure`; HTTPS everywhere; HSTS (see [HTTP and TLS](#http))', 'malware on your own computer, which can read the browser’s cookie file'],
        ['**Fixation and guessing**', 'the attacker sets or predicts a session ID', 'a fresh random ID at login; 128 bits from a secure generator; short lifetimes', 'a user who is tricked into giving away their password'],
    ], 'The four threats to a session cookie'),
    P('''A good default for a login cookie is the following, and you will meet it again in the web capstone. Each part answers one row of the table:'''),
    TEXT('''
        Set-Cookie: __Host-session=<128 random bits>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=1800
    '''),
    CALLOUT('danger', 'Never put these in a cookie',
            'A password, a card number, a full name or email address, a role or price the server will believe, or anything you would not want in a screenshot of someone’s DevTools. A cookie is stored in clear text on disk, '
            'shows up in the browser’s Network tab, is copied into every HAR file, and is sent on every request.'),

    H2('What a website can learn without a login', 'learn'),
    P('''Now the privacy half. Imagine you visit an online shop, with no account, no name and no email. The site, and any tracker it embeds, can still record a stream of **events** filed under one cookie ID:'''),
    TABLE(['What is recorded', 'What it can suggest'], [
        ['Pages visited', 'your interests'],
        ['Products viewed', 'what you might buy'],
        ['Time spent on a page', 'how interested you are'],
        ['Search queries', 'what you are looking for'],
        ['Repeat visits', 'how persistent the interest is'],
        ['Items added to a cart', 'purchase intent'],
        ['Links clicked', 'preferences'],
        ['Time of day, device', 'routines and habits'],
    ], 'What a visit reveals'),
    P('''Each observation is weak. Over weeks, they add up. A tracker stores each one as a small record, an **event**, and a table of events is the raw material of everything that follows:'''),
    JSON_('''
        {
          "event": "page_view",
          "id": "8F31A92B",
          "host": "dealer.example",
          "topic": "automotive",
          "seconds": 42,
          "time": "2026-11-23T12:00:00Z"
        }
    '''),
    P('''Browse the made-up web below. Everything you open is filed under one random ID, and a very simple model turns the pile of events into guesses. Then log in once, and clear your cookies, and watch what the tracker does with each.'''),
    WIDGET('ckprofile'),
    P('''Three things to take from that lab. First, **an inference is a probability, not a fact**: three car pages make “in the market for a car” likely and certainly not true. Second, the guesses reach sensitive territory
    (health, money, career) without you ever saying anything about them. Third, the **identity bridge** is a single event: one login, one purchase, one newsletter signup tells the tracker an email address, and every earlier event
    filed under that ID becomes the history of a named person. Clearing cookies gives you a new ID but does not undo that: the next login joins the two again.'''),
    CALLOUT('deep', 'A cookie ID does not need your name to be about you',
            'Researchers and regulators have shown many times that “anonymous” browsing histories can be tied to a person from only a few details (a place you visit, an account you log in to). '
            'Treat a stable ID and a rich history as personal data, whatever the ID looks like.'),

    H2('Third-party cookies and cross-site tracking', 'third'),
    P('''One company can read the same cookie on thousands of sites if each site includes one of its resources. The company itself is a **third party**: you never chose to visit it, and the sites that embed it do not need to
    share any data with each other. Here is what that looks like from the tracker’s notebook, under the three policies browsers use today:'''),
    WIDGET('cktrack'),
    TABLE(['Browser', 'Default for third-party cookies (late 2026; check your own version)', 'Extra protections'], [
        ['**Safari**', 'blocked, with no exceptions except through the Storage Access API, which asks you', 'Intelligent Tracking Prevention shortens the life of script-written cookies and storage for sites you do not interact with; recent versions can also strip known tracking parameters from links and hide your IP address from trackers'],
        ['**Firefox**', 'allowed but **partitioned**: Total Cookie Protection gives every site its own jar, so a tracker’s cookie on site A is not the one it sees on site B', 'Enhanced Tracking Protection also blocks known trackers'],
        ['**Chrome**', 'still allowed by default (Google dropped its plan to remove them in 2025); you can block them in settings, and Incognito blocks them', '**Partitioned** cookies (the `Partitioned` attribute, “CHIPS”) are supported, for legitimate embeds that need per-site state'],
    ], 'Third-party cookies, by browser'),
    P('''Blocking third-party cookies stops the simplest way to follow you, and it does not stop everything: the last checkbox in the lab shows why. If two sites you log in to both pass the tracker a
    **hashed email address**, the tracker can join your visits with no cookie at all. The same goes for **URL parameters** (`?fbclid=…`, `?gclid=…`, `utm_` tags) that carry an ID from one site into the next, and for links through a
    **redirect** the tracker controls (“bounce tracking”). Not all third-party use is tracking: single sign-on, payment frames and embedded chat widgets legitimately need to know who you are across sites, which is why browsers
    keep narrow exceptions for them.'''),

    H2('Tracking without cookies', 'beyond'),
    P('''Cookies are the easiest tracker to see and the easiest to remove, so the industry has built others. Modern tracking mixes several mechanisms and picks whichever survives:'''),
    TABLE(['Technology', 'What it does'], [
        ['First-party cookies', 'recognise you on one site (and, via a first-party analytics script, feed a third party)'],
        ['Third-party cookies', 'can associate activity across sites'],
        ['**Tracking pixels** (1×1 images, `<img>` or a script beacon)', 'report page views and clicks to an outside server, and carry a cookie with them'],
        ['**localStorage, IndexedDB**', 'keep an ID in browser storage, and can be used to **respawn** a deleted cookie'],
        ['**Fingerprinting** (canvas, WebGL, fonts, screen, time zone)', 'recognises a browser from what it is, with nothing stored at all'],
        ['**URL parameters** and redirects', 'carry an identifier from one site to the next'],
        ['**Server-side tracking**', 'a site forwards its own event log to an ad platform; the browser cannot see it, so no extension can block it'],
        ['**Logins and email addresses**', 'a durable, deterministic ID that works across browsers and devices'],
    ], 'The tracking toolbox'),
    P('''That is why **deleting cookies does not end tracking**. See which methods survive which things you can do: click any cell for the reason. Read the first column: it is the one people clear, and it is the one that matters least.'''),
    WIDGET('ckpersist'),
    H3('Fingerprinting: you are what your browser says', 'fingerprint'),
    P('''Any web page can read, without asking: your browser and its version, operating system, screen size, time zone, language, installed fonts, the way your GPU draws text on a hidden canvas, and more. Each detail is common.
    Together they can be rare. The lab below starts with a made-up crowd of 100,000 browsers, and each detail you include cuts it down. Pick an ordinary setup first, then change the font set and graphics to “unusual”.
    Open **“What this browser tells every page”** to see the real values your own browser is giving out right now.'''),
    WIDGET('ckfinger'),
    P('''Defences are real but partial. Safari and Firefox can reduce what a page can read and, in their stricter modes, add noise to the most revealing readings (canvas, audio), and the Tor Browser makes everyone look alike on purpose, but a determined
    tracker works with whatever is left. Unlike a cookie, a fingerprint **is not stored on your computer**, so there is nothing to clear.'''),

    H2('Joining the dots: identity, profiles and machine learning', 'ml'),
    P('''So far the tracker holds a pile of events under various IDs. The business is made in two more steps: **identity resolution** (deciding which IDs are one person) and **modelling** (turning events into predictions).'''),
    H3('Identity resolution', 'identity'),
    P('''Say you use three devices: an iPhone, a MacBook and an iPad. Each browser has its own cookie, so a tracker holds three unrelated IDs. A company can join them in two ways:'''),
    UL('**Deterministic matching:** the same login, the same email address or the same phone number appears on each device. This is accurate and it is how most identity graphs start.',
       '**Probabilistic matching:** the devices share a home IP address in the evenings, a Wi-Fi network, similar browsing and similar timing. This is a statistical guess and can be wrong: a flat share looks like one person.'),
    P('''A table that joins identifiers (cookie IDs, device IDs, hashed emails, phone numbers) into one person is an **identity graph**, and **data brokers** sell them. Not every company has all the links, and joins are often wrong:
    two people on a shared computer become one profile, and one person becomes four.'''),
    H3('From events to predictions', 'model'),
    P('''Once the events are filed, the steps are the same as in any data project, and they are worth knowing even if you never build one:'''),
    OL('**Collect** events with a stable schema, as in the JSON above.',
       '**Sessionise:** group one ID’s events into visits, usually with a rule like “a gap of more than 30 minutes starts a new session”. (You will write this in the exercises.)',
       '**Engineer features:** turn sessions into numbers a model can use, such as pages per session, number of product views, time since the last visit, share of pages about one topic.',
       '**Label** examples where you know the outcome (“bought within 7 days”: yes or no), if you are predicting.',
       '**Train and evaluate** a model on past data, and check it on data it has not seen.',
       '**Use** the scores: which ad to show, which discount to offer, which customers to email.'),
    P('''The most important point is what a model does **not** do: it does not understand why you do anything. It finds statistical regularities, and gives a *probability*. Here is the idea in a dozen lines, with no libraries.
    A tracker has seen seven pages from one cookie ID:'''),
    RUN('''
        from collections import Counter

        pages = ["auto", "auto", "finance", "auto", "travel", "auto", "finance"]   # the topic of each page one ID opened
        counts = Counter(pages)
        n = len(pages)
        for topic, k in counts.most_common():
            print(f"{topic:8} {k}/{n} = {k / n:.0%}")
    '''),
    P('''That is a model: counts turned into a percentage. Now ask how sure it should be. After only seven page views, “57% automotive” is a weak claim. A common fix is to start every topic with a small amount of imaginary evidence
    (a **prior**), so the estimate stays modest until the data says otherwise:'''),
    RUN('''
        from collections import Counter

        TOPICS = ["auto", "finance", "travel", "food"]

        def estimate(pages, prior=2):
            counts = Counter(pages)
            total = len(pages) + prior * len(TOPICS)
            return {t: (counts[t] + prior) / total for t in TOPICS}

        SAMPLES = {
            3: ["auto", "auto", "auto"],
            7: ["auto"] * 4 + ["finance"] * 2 + ["travel"],
            70: ["auto"] * 40 + ["finance"] * 20 + ["travel"] * 10,
        }
        for n, pages in SAMPLES.items():
            e = estimate(pages)
            print(f"{n:3} pages -> auto {e['auto']:.0%}, finance {e['finance']:.0%}, travel {e['travel']:.0%}, food {e['food']:.0%}")
    '''),
    CALLOUT('warn', 'Limits worth knowing',
            'Inferences are probabilities, not facts. Profiles are often wrong (a gift for someone else, a shared computer, a curious week). Sensitive categories (health, religion, politics, sexual orientation, finances) '
            'are regulated in many places for good reason. And a model trained on one group’s habits can treat another group unfairly, with no one intending it.'),

    H2('Reducing what is collected', 'defend'),
    P('''You cannot see most tracking, so defences work on whole classes at once. In rough order of effort and payoff on a Mac:'''),
    TABLE(['What you do', 'What it stops', 'What it does not stop'], [
        ['Use Safari or Firefox with their default tracking protection on', 'cross-site cookies, known tracker requests, much script-written storage', 'tracking by login, server-side tracking, most fingerprinting'],
        ['In Chrome, choose “Block third-party cookies” (Settings, Privacy and security)', 'cross-site cookies', 'everything in the right-hand column above'],
        ['A content blocker (uBlock Origin; Safari content-blocker extensions)', 'requests to known tracking domains, including pixels and scripts, before they run', 'first-party tracking on a domain the list does not know, and sites that break when blocked'],
        ['Settings in Safari: Privacy, “Prevent cross-site tracking”, “Hide IP address from trackers”, and the advanced tracking and fingerprinting protection option (names move between versions)', 'the items named', 'what you volunteer when logged in'],
        ['Separate browser profiles or containers for work, shopping and social', 'a single ID joining your different lives', 'the same email used everywhere'],
        ['Private windows', 'a history left behind on your own Mac', 'any tracking by the sites and your network: it hides things from people who use your computer, not from the web'],
        ['A DNS filter (a resolver that refuses tracker domains)', 'tracking requests from every device on the network', 'tracking served from the site’s own domain'],
        ['Think before you log in or hand over an email address', 'the identity bridge', 'nothing else is needed: this is the step that matters most'],
    ], 'Defences, roughly in order of effort'),
    P('''If you build websites, the other half of the work is yours: set only the cookies you need, use the safe attributes from the security section, keep personal data out of cookies, load analytics and ad tags **after** consent where the law
    requires it, and treat a third-party script as code you are letting run in your page with your visitors’ cookies. (Listing every cookie and every third-party domain on a site is the project at the end of this chapter.)'''),

    H2('Cookies on disk: a little forensics', 'forensics'),
    P('''Your cookies are stored in a file on your Mac, which makes them evidence: they show which sites a browser has talked to, and when. Look only at **your own** browser profile, preferably a copy, and never
    at another person’s without clear permission, because cookies and sessions are as sensitive as passwords.'''),
    TABLE(['Browser', 'Where the cookie store lives on macOS', 'Format'], [
        ['Firefox', '`~/Library/Application Support/Firefox/Profiles/<profile>/cookies.sqlite`', 'SQLite; table `moz_cookies` with `name`, `value`, `host`, `path`, `expiry`, `creationTime`, `lastAccessed`, `isSecure`, `isHttpOnly`, `sameSite`'],
        ['Chrome', '`~/Library/Application Support/Google/Chrome/Default/Cookies` (newer versions: `Default/Network/Cookies`)', 'SQLite; table `cookies`; values are **encrypted** with a key in the macOS Keychain, so `encrypted_value` is not readable without it'],
        ['Safari', '`~/Library/Containers/com.apple.Safari/Data/Library/Cookies/Cookies.binarycookies`', 'a binary file, not SQLite; macOS protects it, so Terminal needs **Full Disk Access** in System Settings, Privacy & Security'],
    ], 'Where each browser keeps its cookies'),
    P('''Firefox’s store is the easiest to read. Copy it first (the browser keeps the original locked while it runs), then query the copy with `sqlite3`, which ships with macOS:'''),
    CMD('sqlite3', 'text', 'mac', 'Open a SQLite database file and run SQL on it: the tool for browser cookie stores, history files and many macOS app databases.',
        'sqlite3 [-header] [-column] [-readonly] FILE ["SQL"]',
        ['A browser stores cookies, history and bookmarks in **SQLite**, a database in a single file. `sqlite3 FILE` opens an interactive prompt; `sqlite3 FILE "SELECT ..."` runs one query and exits, which is easiest in scripts. '
         '`.tables` lists the tables, `.schema TABLE` shows its columns, `.quit` exits.',
         '**Work on a copy, and open it read-only.** A browser holds a lock on its live database, and a mistake in a query on the original could corrupt your profile. `cp cookies.sqlite /tmp/c.sqlite` then `sqlite3 -readonly /tmp/c.sqlite`.',
         'Times are the hard part. Browsers use different **epochs** and units: Chrome counts microseconds since **1601-01-01**, Firefox counts microseconds since 1970 for `creationTime` and `lastAccessed`. Check the unit of `expiry` on your own '
         'version against a cookie whose lifetime you know, rather than trusting a table. SQLite’s `datetime(x, \'unixepoch\')` turns seconds since 1970 into text.',
         'The `-header -column` options give a readable table in the terminal. `-json` and `-csv` produce data for other tools. `.mode`, `.headers on` and `.width` do the same inside the prompt.'],
        flags=[('-readonly', 'open the file read-only'), ('-header', 'print column names'), ('-column', 'aligned columns'), ('-json | -csv', 'machine-readable output'), ('.tables', 'list the tables'), ('.schema T', 'show how table T is defined'), ('.quit', 'leave')],
        examples=[('ex', 'Copy Firefox’s cookie store and list the busiest hosts', '''
            cp ~/Library/Application\\ Support/Firefox/Profiles/*.default-release/cookies.sqlite /tmp/c.sqlite
            sqlite3 -readonly -header -column /tmp/c.sqlite "SELECT host, COUNT(*) AS n FROM moz_cookies GROUP BY host ORDER BY n DESC LIMIT 5"''', '''
            host              n
            ----------------  --
            .doubleclick.net  14
            .youtube.com      11
            .github.com       9
            .example.org      8
            news.example      6'''),
                  ('ex', 'Which cookies can a script read, and which are session-only?', '''
            sqlite3 -readonly -header -column /tmp/c.sqlite "SELECT name, host, isHttpOnly AS httponly, isSecure AS secure FROM moz_cookies WHERE host LIKE '%github.com' ORDER BY name"''')],
        gotchas=['Never run `sqlite3` on a live browser database in write mode, and never edit one to “fix” cookies: delete them from the browser’s own settings instead.',
                 'A cookie value in a database is a credential. Do not paste query output that includes `value` or `encrypted_value` into a chat or a bug report.',
                 'The paths include a random profile name; use a `*` wildcard in the path or `ls ~/Library/Application\\ Support/Firefox/Profiles` to find it.'],
        see=['cp', 'strings', 'plutil', 'curl -c'], tags=['forensics', 'database']),
    P('''Timestamps are the key to reading this evidence: when was the cookie created, when was it last used, and does that match what you remember doing? Convert each one to a date, put them in order, and you have a timeline of
    your own browsing. The exercises below practise exactly that, with the epoch conversions written out so you can check them.'''),

    H2('Practice', 'practice'),
    EX('ck-ex-delete', 'Does clearing cookies end it?', 'think',
       '''You open a shopping site, look at one pair of running shoes, and later see an advert for those shoes on a news site. You clear all cookies in Safari, reopen the news site, and **still** see shoe ads. List at least four ways the ads could still find you, and say which of them clearing cookies could never have fixed.''',
       '''
       1. You stayed logged in to an account (Google, Meta, the shop itself) on another device or in a different app. The login re-links the new browser to the old profile. Clearing cookies cannot fix this.
       2. The sites pass a hashed email address to the ad platform, so the platform recognises you with no cookie at all.
       3. Fingerprinting: the news site's ad partner recognised your browser by its screen, fonts and rendering. Nothing was stored, so nothing was deleted.
       4. The ads are contextual or run off your IP address and location, not off your history. A news site shows shoe ads to many people.
       5. Browser storage other than cookies (localStorage, IndexedDB) held a copy of the ID, if you cleared only cookies.
       6. The shoe seller's own ad campaign targets "people who visited" using a cookie it dropped on its own site and re-created when you came back.
       Clearing cookies could only have fixed 5 and 6, and only until the next visit.
       ''',
       hints=['Which of the tracking methods in the table need something stored in your browser, and which do not?', 'Safari blocks third-party cookies by default. What is left?'],
       why='''Cookies are the tracker's most visible tool and the least important one. The identifiers that survive clearing are the ones you hold elsewhere: an account, an email address, a device and the way it looks. That is why the practical defences are about **what you log in to and what you volunteer**, not just what the browser stores.'''),
    EX('ck-ex-audit', 'Audit Set-Cookie headers', 'py',
       '''Write `parse_set_cookie(header)`, which returns `(name, value, attrs)`: `attrs` is a dictionary with **lower-case keys**, where a flag such as `Secure` is `True` and `Path=/` becomes `"path": "/"`. The value may contain `=` signs, so split only on the first one.
       Then write `problems(attrs, name)`, returning a list of strings, in this order, for each rule that applies: `"no Secure"`, `"no HttpOnly"`, `"no SameSite"`, `"SameSite=None without Secure"`, and `"lives over 400 days"` (when `max-age` is more than 400 days).
       Finally print one line for each header in `HEADERS`: `name: problem; problem` or `name: ok`. Treat `theme` as a harmless preference: it does not need `HttpOnly`.''',
       '''
       HEADERS = [
           "session=k3J9xQ; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=1800",
           "theme=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
           "uid=77c1e0; Max-Age=315360000; SameSite=None",
           "cart=a=b==; Path=/shop",
       ]

       def parse_set_cookie(header):
           first, *rest = [p.strip() for p in header.split(";")]
           name, _, value = first.partition("=")
           attrs = {}
           for part in rest:
               key, eq, val = part.partition("=")
               attrs[key.lower()] = val if eq else True
           return name, value, attrs

       def problems(attrs, name):
           out = []
           if "secure" not in attrs:
               out.append("no Secure")
           if "httponly" not in attrs and name != "theme":
               out.append("no HttpOnly")
           if "samesite" not in attrs:
               out.append("no SameSite")
           elif attrs["samesite"].lower() == "none" and "secure" not in attrs:
               out.append("SameSite=None without Secure")
           if int(attrs.get("max-age", 0)) > 400 * 86400:
               out.append("lives over 400 days")
           return out

       for h in HEADERS:
           name, value, attrs = parse_set_cookie(h)
           p = problems(attrs, name)
           print(f"{name}: {'; '.join(p) if p else 'ok'}")
       ''',
       hints=['`str.partition("=")` splits on the first `=` only and keeps the rest together.', 'A flag has no `=`, so `partition` returns an empty separator: use that to tell `Secure` from `Path=/`.', '400 days is `400 * 86400` seconds.'],
       why='''This is the first step of every cookie audit tool: parse, then apply rules. Note that `cart=a=b==` still has the right value `a=b==`: cookie values can contain `=`, which is why splitting on every `=` is a classic bug. Real scanners add many more rules (`__Host-` prefixes, `Domain` breadth, lifetimes of login cookies) but they work in just this way.''',
       starter='''
       HEADERS = [
           "session=k3J9xQ; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=1800",
           "theme=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
           "uid=77c1e0; Max-Age=315360000; SameSite=None",
           "cart=a=b==; Path=/shop",
       ]

       def parse_set_cookie(header):
           return "", "", {}

       def problems(attrs, name):
           return []

       # print "name: problem; problem" or "name: ok" for each header
       ''',
       check='''
       n, v, a = parse_set_cookie("session=k3J9xQ; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=1800")
       assert (n, v) == ("session", "k3J9xQ"), "name and value"
       assert a == {"path": "/", "secure": True, "httponly": True, "samesite": "Lax", "max-age": "1800"}, "attributes: " + repr(a)
       assert parse_set_cookie("cart=a=b==; Path=/")[1] == "a=b==", "split only on the first ="
       assert problems({"secure": True, "httponly": True, "samesite": "Lax"}, "session") == []
       assert problems({}, "x") == ["no Secure", "no HttpOnly", "no SameSite"]
       assert problems({"secure": True, "samesite": "None", "max-age": "99999999"}, "theme") == ["lives over 400 days"]
       assert out.strip().split("\\n") == ["session: ok", "theme: ok", "uid: no Secure; no HttpOnly; SameSite=None without Secure; lives over 400 days", "cart: no Secure; no HttpOnly; no SameSite"], repr(out)
       '''),
    EX('ck-ex-send', 'Will the browser send it?', 'py',
       '''Write `will_send(cookie, url, context, nav=False, method="GET")`, the decision a browser makes before attaching a cookie to a request. `cookie` is a dictionary with `domain`, `host_only` (true if there was no `Domain` attribute), `path`, `secure` and `samesite` (`"Strict"`, `"Lax"`, `"None"` or `""`).
       `url` is the request, `context` the address of the page it belongs to. Apply, in order: the domain rule (an exact match for host-only cookies, otherwise the host or a subdomain), the path rule (the cookie path must equal the URL path or be a prefix that ends at a `/`), `Secure` (HTTPS only),
       then **same-site**: for this exercise two hosts are the same site if their last two labels are equal. A same-site request sends the cookie. For a cross-site request: `None` sends it, `Lax` sends it only when `nav` is true and the method is GET, `Strict` and an unset value (treat as Lax) follow the same rules.''',
       '''
       from urllib.parse import urlsplit

       def site(host):
           return ".".join(host.split(".")[-2:])

       def domain_ok(cookie, host):
           if cookie["host_only"]:
               return host == cookie["domain"]
           return host == cookie["domain"] or host.endswith("." + cookie["domain"])

       def path_ok(cookie, path):
           cp = cookie["path"]
           return path == cp or (path.startswith(cp) and (cp.endswith("/") or path[len(cp)] == "/"))

       def will_send(cookie, url, context, nav=False, method="GET"):
           u, c = urlsplit(url), urlsplit(context)
           if not domain_ok(cookie, u.hostname) or not path_ok(cookie, u.path or "/"):
               return False
           if cookie["secure"] and u.scheme != "https":
               return False
           if site(u.hostname) == site(c.hostname):
               return True
           mode = cookie["samesite"] or "Lax"
           if mode == "None":
               return True
           if mode == "Strict":
               return False
           return nav and method == "GET"

       SESSION = {"domain": "shop.example", "host_only": True, "path": "/", "secure": True, "samesite": "Lax"}
       print(will_send(SESSION, "https://shop.example/cart", "https://shop.example/"))
       print(will_send(SESSION, "https://shop.example/cart", "https://news.example/story", nav=True))
       print(will_send(SESSION, "https://shop.example/pixel.gif", "https://news.example/story"))
       ''',
       hints=['`urlsplit(url).hostname`, `.path` and `.scheme` give the parts you need.', 'Return `False` as soon as one rule fails, and `True` as soon as a same-site request has passed them.', 'A prefix of the path is not enough: `/shop` must not match `/shopping`, so the next character must be `/`.'],
       why='''This is the same decision the labs in this chapter make, and almost the same code as the engine behind them. Notice that the cookie has no idea where the request came from; the **browser** applies the rules and a server cannot change them. Real browsers use the public-suffix list instead of “last two labels”, which is why `shop.co.uk` and `bank.co.uk` are different sites.''',
       starter='''
       from urllib.parse import urlsplit

       def site(host):
           return ".".join(host.split(".")[-2:])

       def will_send(cookie, url, context, nav=False, method="GET"):
           return False

       SESSION = {"domain": "shop.example", "host_only": True, "path": "/", "secure": True, "samesite": "Lax"}
       print(will_send(SESSION, "https://shop.example/cart", "https://shop.example/"))
       print(will_send(SESSION, "https://shop.example/cart", "https://news.example/story", nav=True))
       print(will_send(SESSION, "https://shop.example/pixel.gif", "https://news.example/story"))
       ''',
       check='''
       S = {"domain": "shop.example", "host_only": True, "path": "/", "secure": True, "samesite": "Lax"}
       assert will_send(S, "https://shop.example/cart", "https://shop.example/") is True, "same site"
       assert will_send(S, "https://shop.example/cart", "https://news.example/story", nav=True) is True, "Lax: a link click is allowed"
       assert will_send(S, "https://shop.example/cart", "https://news.example/story") is False, "Lax: an image or fetch is not"
       assert will_send(S, "https://shop.example/cart", "https://news.example/story", nav=True, method="POST") is False, "Lax: a POST is not"
       assert will_send(S, "http://shop.example/cart", "http://shop.example/") is False, "Secure needs https"
       assert will_send(S, "https://www.shop.example/", "https://www.shop.example/") is False, "host-only: a subdomain does not get it"
       D = dict(S, host_only=False, secure=False, samesite="None")
       assert will_send(D, "https://www.shop.example/", "https://www.shop.example/") is True, "Domain cookie reaches the subdomain"
       assert will_send(D, "https://shop.example/x.gif", "https://news.example/") is True, "SameSite=None goes cross-site"
       P = dict(S, path="/shop", secure=False)
       assert will_send(P, "https://shop.example/shop/cart", "https://shop.example/") is True
       assert will_send(P, "https://shop.example/shopping", "https://shop.example/") is False, "/shop must not match /shopping"
       assert will_send(dict(S, samesite="Strict"), "https://shop.example/", "https://news.example/", nav=True) is False, "Strict: not even a link click"
       assert out.strip().split("\\n") == ["True", "True", "False"], repr(out)
       '''),
    EX('ck-ex-js-parse', 'Read document.cookie', 'js',
       '''`document.cookie` gives you one string, not a list: `"theme=dark; visitor=8F31A92B; cart=2%20items"`. Write `parseCookies(str)` that returns an object. Split on `"; "`, split each pair on the **first** `=` only, and decode the value with `decodeURIComponent`. An empty string gives `{}`.
       Then write `serializeCookie(name, value, opts)` that returns a header-style string: the name, the value encoded with `encodeURIComponent`, then `Max-Age=…` if `opts.maxAge` is a number, `Path=…` if `opts.path` is set, and `Secure` / `SameSite=…` when given, joined with `"; "`. Print the parsed object for the sample string as JSON.''',
       '''
       function parseCookies(str) {
         const jar = {};
         if (!str) return jar;
         for (const pair of str.split("; ")) {
           const i = pair.indexOf("=");
           jar[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
         }
         return jar;
       }

       function serializeCookie(name, value, opts = {}) {
         const parts = [name + "=" + encodeURIComponent(value)];
         if (typeof opts.maxAge === "number") parts.push("Max-Age=" + opts.maxAge);
         if (opts.path) parts.push("Path=" + opts.path);
         if (opts.secure) parts.push("Secure");
         if (opts.sameSite) parts.push("SameSite=" + opts.sameSite);
         return parts.join("; ");
       }

       console.log(JSON.stringify(parseCookies("theme=dark; visitor=8F31A92B; cart=2%20items")));
       ''',
       hints=['`pair.indexOf("=")` finds the first `=`; use `slice` on both sides of it.', 'A value such as `a=b` has two `=` signs; only the first one separates name from value.', '`decodeURIComponent("2%20items")` is `"2 items"`.'],
       why='''Cookie strings are a flat text format, and it is easy to write a parser that breaks on a value containing `=` or `;`, which is why the encoding step matters. Notice what you cannot do from here: `HttpOnly` cookies never appear in this string, and neither do the attributes. `document.cookie` shows only names and values, and only for cookies a script is allowed to see.''',
       starter='''
       function parseCookies(str) {
         return {};
       }

       function serializeCookie(name, value, opts = {}) {
         return "";
       }

       // print JSON.stringify(parseCookies("theme=dark; visitor=8F31A92B; cart=2%20items"))
       ''',
       check='''
       assert(typeof parseCookies === 'function' && typeof serializeCookie === 'function', 'Define parseCookies and serializeCookie.');
       assert(JSON.stringify(parseCookies('theme=dark; visitor=8F31A92B; cart=2%20items')) === '{"theme":"dark","visitor":"8F31A92B","cart":"2 items"}', 'Parse the sample string, decoding the value.');
       assert(JSON.stringify(parseCookies('')) === '{}', 'An empty string gives {}.');
       assert(parseCookies('token=a=b==').token === 'a=b==', 'Only the first = separates name from value.');
       assert(serializeCookie('theme', 'dark') === 'theme=dark', 'A cookie with no options is just name=value.');
       assert(serializeCookie('cart', '2 items', { maxAge: 60, path: '/', secure: true, sameSite: 'Lax' }) === 'cart=2%20items; Max-Age=60; Path=/; Secure; SameSite=Lax', 'Encode the value and add the options in order.');
       assert(out.trim() === '{"theme":"dark","visitor":"8F31A92B","cart":"2 items"}', 'Print the parsed sample as JSON; printed: ' + JSON.stringify(out.trim()));
       '''),
    EX('ck-ex-sessions', 'From events to sessions', 'py',
       '''`EVENTS` is a list of `(cookie_id, minute, topic)` tuples, already sorted by time, where `minute` counts minutes since midnight. Write `sessionise(events, gap=30)`: for each cookie ID, start a **new session** whenever the gap since that ID’s previous event is **more than** `gap` minutes.
       Return a dictionary from the ID to a list of sessions, each session a list of topics. Then print, for each ID in the order it first appears, `ID: N sessions, M pages`.''',
       '''
       EVENTS = [
           ("8F31A92B", 540, "auto"), ("8F31A92B", 545, "auto"), ("C04E71D9", 550, "travel"),
           ("8F31A92B", 560, "finance"), ("8F31A92B", 700, "auto"), ("C04E71D9", 580, "travel"),
           ("C04E71D9", 581, "food"), ("8F31A92B", 710, "auto"), ("8F31A92B", 711, "auto"),
       ]

       def sessionise(events, gap=30):
           out, last = {}, {}
           for cid, minute, topic in events:
               if cid not in out or minute - last[cid] > gap:
                   out.setdefault(cid, []).append([])
               out[cid][-1].append(topic)
               last[cid] = minute
           return out

       result = sessionise(EVENTS)
       for cid, sessions in result.items():
           print(f"{cid}: {len(sessions)} sessions, {sum(len(s) for s in sessions)} pages")
       ''',
       hints=['Remember the time of each ID’s last event in a second dictionary.', 'A new session starts when the ID is new, or when `minute - last[cid] > gap`.', '`dict.setdefault(key, []).append(...)` creates the list the first time.'],
       why='''Sessionising is the first step of nearly every analytics pipeline, and its rule is a choice: 30 minutes is a convention (Google Analytics used it for years). Notice what the result does not say: nothing in it says whether `8F31A92B` and `C04E71D9` are the same person on two devices. That is the next problem, identity resolution.''',
       starter='''
       EVENTS = [
           ("8F31A92B", 540, "auto"), ("8F31A92B", 545, "auto"), ("C04E71D9", 550, "travel"),
           ("8F31A92B", 560, "finance"), ("8F31A92B", 700, "auto"), ("C04E71D9", 580, "travel"),
           ("C04E71D9", 581, "food"), ("8F31A92B", 710, "auto"), ("8F31A92B", 711, "auto"),
       ]

       def sessionise(events, gap=30):
           return {}

       # print "ID: N sessions, M pages" for each ID
       ''',
       check='''
       r = sessionise(EVENTS)
       assert r["8F31A92B"] == [["auto", "auto", "finance"], ["auto", "auto", "auto"]], "a gap of 140 minutes starts a new session: " + repr(r["8F31A92B"])
       assert r["C04E71D9"] == [["travel", "travel", "food"]], "550 to 580 is a gap of exactly 30 minutes, which is not MORE than 30: " + repr(r["C04E71D9"])
       assert sessionise([("a", 0, "x"), ("a", 31, "y")])["a"] == [["x"], ["y"]], "31 minutes is more than 30"
       assert sessionise([("a", 0, "x"), ("a", 30, "y")])["a"] == [["x", "y"]], "exactly 30 minutes is the same session"
       assert out.strip().split("\\n") == ["8F31A92B: 2 sessions, 6 pages", "C04E71D9: 1 sessions, 3 pages"], repr(out)
       '''),
    EX('ck-ex-interests', 'Guess interests, and be honest about it', 'py',
       '''`VISITS` lists the topics of pages one cookie ID opened, oldest first. Write `interests(visits, half_life=10)` returning a dictionary from topic to a **score**: each visit adds 1, but older visits count for less. A visit that is `age` pages old (the newest has age 0) is worth `0.5 ** (age / half_life)`.
       Then write `segments(scores, threshold=2.0)` returning the sorted list of topics whose score is at least the threshold. Print the segments, and then, on a second line, the number of topics that **just** missed the threshold (within 25% of it), because a profile’s edge cases are where mistakes happen.''',
       '''
       VISITS = ["auto", "auto", "finance", "auto", "auto", "auto", "finance", "travel", "auto", "finance", "travel", "auto", "food", "auto", "auto"]

       def interests(visits, half_life=10):
           scores = {}
           n = len(visits)
           for i, topic in enumerate(visits):
               age = n - 1 - i
               scores[topic] = scores.get(topic, 0) + 0.5 ** (age / half_life)
           return scores

       def segments(scores, threshold=2.0):
           return sorted(t for t, s in scores.items() if s >= threshold)

       s = interests(VISITS)
       print(segments(s))
       near = [t for t, v in s.items() if 0.75 * 2.0 <= v < 2.0]
       print(len(near))
       ''',
       hints=['The newest visit has index `n - 1`, so `age = n - 1 - i`.', '`0.5 ** (age / half_life)` halves the weight every `half_life` pages.', 'Near misses are scores from 1.5 up to, but not including, 2.0.'],
       why='''A threshold turns a smooth score into a hard label (“automotive enthusiast”), and the label looks far more certain than the number behind it. Decay is a real design choice, too: without it, a single week of research follows you for years. The near-miss count is a reminder that the edge of every segment is arbitrary.''',
       starter='''
       VISITS = ["auto", "auto", "finance", "auto", "auto", "auto", "finance", "travel", "auto", "finance", "travel", "auto", "food", "auto", "auto"]

       def interests(visits, half_life=10):
           return {}

       def segments(scores, threshold=2.0):
           return []

       # print the segments, then the number of topics within 25% below the threshold
       ''',
       check='''
       s = interests(["a", "a"], half_life=1)
       assert abs(s["a"] - 1.5) < 1e-9, "the newest visit is worth 1 and one page back is worth 0.5: " + repr(s)
       assert segments({"x": 2.0, "y": 1.99, "z": 3.1}) == ["x", "z"], "at or above the threshold, sorted"
       got = interests(VISITS)
       assert segments(got) == ["auto"], "only automotive passes: " + repr(segments(got))
       assert out.strip().split("\\n") == ["['auto']", "1"], repr(out)
       '''),
    EX('ck-ex-times', 'Read the timestamps in a cookie store', 'py',
       '''Browsers store times as plain integers, with different epochs and units. Write `chrome_time(us)`, for a Chrome `creation_utc` value, which is **microseconds since 1601-01-01 UTC**, and `firefox_time(us)`, for Firefox `creationTime`, which is **microseconds since 1970-01-01 UTC**.
       Each returns an ISO string such as `2026-11-23T12:00:00` in UTC with no fraction. Then print the creation times of the three Firefox rows in `ROWS` in order, oldest first, one `name  time` pair per line.''',
       '''
       from datetime import datetime, timedelta, timezone

       ROWS = [("uid", 1795435200000000), ("session", 1795348800000000), ("theme", 1795262400000000)]

       def chrome_time(us):
           return (datetime(1601, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=us)).strftime("%Y-%m-%dT%H:%M:%S")

       def firefox_time(us):
           return (datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=us)).strftime("%Y-%m-%dT%H:%M:%S")

       for name, us in sorted(ROWS, key=lambda r: r[1]):
           print(f"{name:8} {firefox_time(us)}")
       ''',
       hints=['Add a `timedelta(microseconds=us)` to the epoch, which is a `datetime` with `tzinfo=timezone.utc`.', 'The two epochs differ by 11,644,473,600 seconds. Chrome’s is the earlier one.', 'Sort the rows by the integer, then format.'],
       why='''Forensics is mostly unit conversion done carefully. The two functions differ only in the starting point, and if you mix them up the dates are off by 369 years, which is at least easy to notice. The unit of Firefox’s `expiry` column differs from `creationTime` and has changed between versions, so check it against a cookie whose lifetime you know before building a timeline on it.''',
       starter='''
       from datetime import datetime, timedelta, timezone

       ROWS = [("uid", 1795435200000000), ("session", 1795348800000000), ("theme", 1795262400000000)]

       def chrome_time(us):
           return ""

       def firefox_time(us):
           return ""

       # print "name  time" for each row, oldest first
       ''',
       check='''
       assert firefox_time(1795435200000000) == "2026-11-23T12:00:00", "Firefox: microseconds since 1970: " + repr(firefox_time(1795435200000000))
       assert chrome_time((1795435200 + 11644473600) * 1_000_000) == "2026-11-23T12:00:00", "Chrome counts from 1601, 11644473600 seconds before 1970"
       assert out.strip().split("\\n") == ["theme    2026-11-21T12:00:00", "session  2026-11-22T12:00:00", "uid      2026-11-23T12:00:00"], repr(out)
       '''),
    EX('ck-ex-design', 'Design the cookies for a small shop', 'think',
       '''A small shop has: a login, a basket that survives closing the browser, a language choice, privacy-friendly analytics it hosts itself, and a payment form from a card processor. For each, say whether it needs a cookie, and if so give its name, its lifetime, its attributes and its category. Then name one thing that you would put on the server and not in a cookie.''',
       '''
       Login: `__Host-session=<128 random bits>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=1800` (renewed while the user is active). Strictly necessary. The user's name, role and anything else stay on the server, in a table keyed by the session ID.
       Basket: `basket=<random id>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=1209600` (14 days). Strictly necessary because the visitor asked for a basket. The items live in the server's database under that ID, so the cookie is a key, not a list.
       Language: `lang=de; Path=/; Secure; SameSite=Lax; Max-Age=31536000`. A preference. Not HttpOnly: a script on the page may need to read it. No personal data.
       Analytics: first-party and self-hosted needs no cookie at all if the shop counts page views without an ID (many privacy-friendly tools do exactly that, and then it needs no consent banner). If it does keep a visitor ID: `_a=<random>; Secure; SameSite=Lax; Max-Age=...` as an analytics cookie, behind a consent choice where the law requires one.
       Payment: set by the processor, on its own domain or in its frame (`SameSite=None; Secure` if it is inside an iframe). Used for fraud prevention; classed as necessary. The shop does not control its attributes, only whether to embed it.
       On the server, not in a cookie: the price, the discount, the role, and anything the visitor should not be able to change by editing their cookie jar.
       ''',
       hints=['Ask for each: is it a key, a preference, or data? Keys and preferences can be cookies; data usually should not.', 'Which of them should a script on the page never be able to read?'],
       why='''A cookie design is a list of promises: who may read it, who may send it, how long it lives. Small, boring and few is the goal. The best cookie is often no cookie: count what you need without an ID, keep state on the server and use the browser’s storage only for harmless preferences.'''),
    CHECK('ck-ch-cookies-checkpoint', 'Check yourself',
          Q('What does a server learn from a `Cookie: visitor=8F31A92B` header?',
            [('Who you are', False), ('That this browser has been here before, if the server has stored something under that ID', True), ('Your browsing history on other sites', False), ('Your IP address’s owner', False)],
            'A cookie is only an identifier the server issued itself. It means something only because the server keeps records under it. The browser never sends other sites’ cookies, and nothing in the header names a person.'),
          Q('A cookie is set with `Secure; HttpOnly; SameSite=Lax`. A script injected into the page (XSS) runs `document.cookie`. What does it see?',
            [('The cookie, because the script is on the same page', False), ('Nothing from this cookie, because HttpOnly hides it from JavaScript', True), ('The cookie, but only over HTTP', False), ('An encrypted version of it', False)],
            'HttpOnly keeps the cookie out of `document.cookie`. The script can still make requests that carry the cookie (they come from the victim’s own browser), which is why escaping output and a Content-Security-Policy still matter.'),
          Q('Which cookie is a **third-party** cookie?',
            [('One set by `shop.example` when you are on `shop.example`', False), ('One set by `ads.example` while you are on `news.example`', True), ('Any cookie that lives more than a day', False), ('Any cookie with the `Secure` attribute', False)],
            '“Third-party” describes where the cookie comes from compared with the page in the address bar, not what it does or how long it lives.'),
          Q('You clear all cookies and the ads for the same shoes keep following you across sites. Which of these could explain it?',
            [('A fingerprint of your browser', False), ('A login that links your new browser to the old profile', False), ('The sites passing a hashed email address to the ad platform', False), ('All of these', True)],
            'Each of them identifies you without a cookie that you can delete. Cookies are the most visible tracking tool and the easiest to remove, which is why the industry uses the others as well.'),
          Q('Safari blocks third-party cookies, Firefox partitions them and Chrome (as of this book) allows them by default. For a tracker embedded on two sites, what does Firefox’s approach change?',
            [('The tracker receives a different cookie on each site, so cookies alone cannot join the two visits', True), ('The tracker is blocked from loading at all', False), ('The tracker can still use the same cookie on both sites', False), ('Nothing: it only affects first-party cookies', False)],
            'Partitioning gives each top-level site its own jar. The tracker can keep a cookie, but it cannot be the same cookie across sites.'),
          Q('A model says a visitor is “80% likely to buy a car”. How should you read that?',
            [('As a fact the visitor has decided to buy', False), ('As a statistical estimate from patterns in past behaviour: it says nothing about why, and can be wrong', True), ('As proof that the visitor is logged in', False), ('As a guarantee about the visitor’s age', False)],
            'A model finds regularities in data and outputs a probability. It does not know intentions, and it inherits any bias or gaps in the data it saw.'),
          Q('Which login-cookie setting is **wrong**?',
            [('`__Host-session=…; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=1800`', False), ('`session=user=Sam&role=admin; Path=/`', True), ('A random 128-bit value kept in a server-side session table', False), ('Rotating the session ID when the user logs in', False)],
            'A cookie that carries the role itself and is unsigned lets anyone edit their own privileges. The browser can change any cookie in its jar, so authority must stay on the server.')),
    PROJECT('ck-pr-investigator', 'Browser tracking investigator', 'intermediate', 90,
            ['DevTools', 'cookies', 'HTTP headers', 'privacy', 'reporting'],
            P('''Produce a **tracking inventory** for three websites you choose, using only your own browser and only by visiting the sites as an ordinary visitor. Do not run scanners or automated tools against sites you do not own. Pick one news site, one shop and one site you
            think is “clean”, and keep a note of your browser, its version and its tracking settings, because they change the result.'''),
            H3('1. Cookies'),
            P('''For each site, in a **fresh private window** and before you click anything on a cookie banner: open the inspector, list every cookie, and record name, domain, expiry, `Secure`, `HttpOnly` and `SameSite`. Then accept all and list them again. Which cookies appeared only after you consented?'''),
            H3('2. Who else is there'),
            P('''In the Network tab, reload with the cache disabled and sort by **Domain**. List every domain that is not the site itself. Classify each one: content delivery, analytics, advertising, payment, consent, social or unknown. Which of them set cookies or received any?'''),
            H3('3. Other storage and tracking'),
            P('''Open the Storage or Application tab and record localStorage, sessionStorage and IndexedDB entries. Find any request with an identifier in its URL or body (look for long random strings, `uid`, `cid`, `fbclid`, `gclid`, `utm_`), and any 1×1 image or beacon request.'''),
            H3('4. Compare browsers'),
            P('''Repeat step 2 in Safari and in Firefox (or Chrome), with default settings. How many third-party cookies were stored in each? Use the Cookies tab in the Network inspector to find cookies that were **blocked** and why.'''),
            H3('5. Write it up'),
            P('''Build one table per site: every cookie and domain, its purpose, whether it is necessary, and your confidence. Then answer in a paragraph: which site collects the most, which is the least surprising, and which cookie would you most like to delete first?'''),
            H3('6. Stretch goals'),
            UL('Export a **HAR** file, redact the cookie values, and write a Python script that counts requests per domain and lists every `Set-Cookie`.',
               'Repeat with a content blocker on, and measure how many requests and cookies disappear.',
               'Open the cookie store of **your own** Firefox profile with `sqlite3` (see the forensics section) and list the 20 hosts that have set the most cookies.')),

    H2('Glossary and next steps', 'next'),
    P('''Next: the [Capstone: a LAN Dashboard](#web-capstone) uses an `HttpOnly`, `SameSite=Strict` session cookie, which you can now design and audit, and [Defending Your Mac and Servers](#defend) shows how to find sessions and logins in server logs.
    To see cookies cross a network, capture your own browser’s traffic with the [Wireshark chapter](#wireshark): on plain HTTP you will see `Cookie` headers in the clear, which is the best argument for `Secure` you will find.
    To go deeper into how browsers and the web fit together, read the [DOM](#dom) chapter for cross-site scripting and the [APIs](#apis) chapter for tokens as an alternative to cookies.'''),
]

terms = [
    ('cookie', 'a small piece of text a site asks the browser to keep and send back with later requests to that site'),
    ('cookie jar', 'the browser’s store of cookies; curl keeps one in a text file with -c and -b'),
    ('Set-Cookie', 'the response header a server uses to create or update a cookie'),
    ('Cookie header', 'the request header that carries the name=value pairs of every matching cookie; it never includes the attributes'),
    ('session cookie', 'a cookie with no Max-Age or Expires, kept until the browser session ends; also loosely, a cookie that holds a login session'),
    ('persistent cookie', 'a cookie with a Max-Age or Expires, kept until that time (Chrome caps it at 400 days)'),
    ('first-party cookie', 'a cookie from the site shown in the address bar'),
    ('third-party cookie', 'a cookie from another site embedded in the page, such as an ad or a widget'),
    ('site', 'for cookies, the registrable domain: one label plus the public suffix, such as shop.example or shop.co.uk'),
    ('origin', 'scheme, host and port together; stricter than a site'),
    ('registrable domain', 'the part of a host a person or company can register, below a public suffix such as com or co.uk'),
    ('public suffix', 'a domain under which many unrelated parties register names, such as com, co.uk or github.io; cookies cannot be set for one'),
    ('Domain attribute', 'makes a cookie available to a host and all its subdomains; without it, only the exact host'),
    ('Path attribute', 'limits the URLs a cookie is sent to; a convenience, not a security boundary'),
    ('Secure', 'a cookie attribute that restricts the cookie to HTTPS requests'),
    ('HttpOnly', 'a cookie attribute that hides the cookie from JavaScript (document.cookie)'),
    ('SameSite', 'a cookie attribute (Strict, Lax or None) that controls whether the cookie is sent on requests that start on another site'),
    ('Partitioned (CHIPS)', 'a cookie attribute that gives an embedded third-party cookie a separate jar for each top-level site'),
    ('__Host- prefix', 'a cookie name prefix the browser enforces: Secure, Path=/ and no Domain, so only that exact host can set it'),
    ('session ID', 'a random key, kept in a cookie, that points at a login session stored on the server'),
    ('XSS', 'cross-site scripting: attacker-controlled script that runs in your page'),
    ('CSRF', 'cross-site request forgery: a request from another site that rides on your logged-in cookie'),
    ('tracking pixel', 'a tiny image or script request whose job is to report that a page or email was opened'),
    ('fingerprinting', 'recognising a browser from its technical details (screen, fonts, rendering) with nothing stored'),
    ('Total Cookie Protection', 'Firefox’s separate cookie jar for each site, so third-party cookies cannot join visits across sites'),
    ('Intelligent Tracking Prevention', 'Safari’s set of protections that block third-party cookies and limit storage and fingerprinting'),
    ('identity resolution', 'deciding which cookie IDs, devices and accounts belong to one person'),
    ('identity graph', 'a table that links identifiers (cookie IDs, device IDs, emails) to a person'),
    ('deterministic matching', 'joining identifiers by an exact shared value, such as the same login or email address'),
    ('probabilistic matching', 'joining identifiers by statistical similarity; can be wrong'),
    ('sessionisation', 'grouping an ID’s events into visits, usually by a gap such as 30 minutes'),
    ('feature', 'a number computed from raw events and given to a model, such as pages per session'),
    ('Global Privacy Control', 'a browser signal that tells sites you opt out of the sale or sharing of your data'),
]

CHAPTER = chapter('cookies', 'Cookies, Tracking and Privacy',
                  'What cookies are and how browsers and servers use them, who is reading them, and how tracking, profiling and prediction are built on top',
                  'dom', 90,
                  ['Explain what a cookie is, what it is not, and how Set-Cookie and Cookie work',
                   'Read and build Set-Cookie headers, and say which requests will carry the cookie back and which will not',
                   'Choose safe attributes for a session cookie and explain which attack each one stops',
                   'Tell first-party from third-party cookies and say how Safari, Firefox and Chrome treat them',
                   'Describe how events become profiles, how identities are joined, and why tracking continues after cookies are cleared',
                   'Inspect cookies and other storage in DevTools, and read a browser cookie store with sqlite3'],
                  blocks, terms, level='intermediate', part='web', file='35a-cookies.gm')
