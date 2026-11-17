from lib import *

blocks = [
    P('''Cryptography is what lets you type a password on café Wi-Fi, download software you can trust, push code with a key instead of a
    password, and call an API that nobody can tamper with in transit. You do not need the mathematics to use it well, but you do need the
    vocabulary, a feel for what each tool guarantees and, above all, the rules for not misusing it. In this chapter you will break a
    classical cipher, watch hashes and authenticated encryption behave, agree on a secret in public, sign and verify files with your SSH
    key, build your own certificate authority and serve HTTPS with it, and look inside a TLS 1.3 handshake message by message.'''),
    CALLOUT('danger', 'The first rule: do not invent your own', '''Every primitive in this chapter is easy to call and easy to misuse: a reused nonce, a missing authentication tag, a
    password stored with a fast hash. Use high-level, maintained tools and libraries (TLS, SSH, age, libsodium, your platform's crypto API)
    and treat home-made schemes as a learning exercise only, never as protection for anything real.'''),

    H2('Four tools that are often confused', 'vocab'),
    TABLE(['Tool', 'Needs a key?', 'Reversible?', 'Guarantees', 'Example'], [
        ['**Encoding**', 'no', 'yes, by anyone', 'nothing: it only changes the representation', 'base64, hex, URL encoding'],
        ['**Hashing**', 'no', 'no', 'a fixed-size fingerprint; any change gives a different hash', 'SHA-256 of a download'],
        ['**MAC** (message authentication code)', 'yes, one shared secret', 'no', 'the message came from someone with the key and was not changed', 'HMAC-SHA256 on a webhook'],
        ['**Encryption**', 'yes', 'yes, with the key', 'confidentiality; with *authenticated* encryption also integrity', 'AES-GCM, ChaCha20-Poly1305'],
        ['**Signature**', 'yes, a key *pair*', 'no', 'anyone with the public key can check the private-key holder signed it', 'Ed25519 on a Git commit'],
    ], 'What each one is for'),
    RUN('''
    import base64, hashlib

    secret = "hunter2"
    encoded = base64.b64encode(secret.encode()).decode()
    print("base64:", encoded, "->", base64.b64decode(encoded).decode())   # anyone can reverse it
    print("sha256:", hashlib.sha256(secret.encode()).hexdigest())
    print("sha256 of a 1 MB file is still", len(hashlib.sha256(b"x" * 1_000_000).hexdigest()), "hex characters")
    '''),
    P('''If a tutorial "encrypts" a password with base64, close the tab: base64 is a way of writing bytes as text and protects
    nothing. Security goals are usually summarised as **CIA**: **c**onfidentiality (only the right people read it), **i**ntegrity (nobody
    changed it unnoticed) and **a**uthenticity (it came from who it claims). Pick the tool by the goal.'''),

    H2('Why classical ciphers fail', 'classical'),
    P('''A Caesar cipher shifts every letter by a fixed amount. It has only 26 keys, and worse, it keeps the *pattern* of the language:
    the most common ciphertext letter is almost certainly `e` shifted. Modern ciphers are designed so the output looks like random bytes
    whatever the input, and the key space is so large that trying every key is impossible. Break the Caesar text in the lab below, then
    switch tabs to see what modern tools do differently.'''),
    WIDGET('cipherlab'),
    EX('crypto-ex-crack-caesar', 'Crack a Caesar cipher automatically', 'py',
       '''Write `crack(ciphertext)` that returns `(shift, plaintext)` for the shift (0 to 25) whose decryption contains the most of the words
       in `COMMON`. Keep letter case and leave non-letters alone. Then crack `MSG` and print the plaintext.''',
       '''
       COMMON = {"the", "and", "to", "of", "a", "is", "in", "it", "on", "be", "never", "send"}
       MSG = "Arire fraq cnffjbeqf va gur pyrne. Hfr n cnffjbeq znantre."

       def shift_text(text, k):
           out = []
           for ch in text:
               if ch.isalpha():
                   base = ord("A") if ch.isupper() else ord("a")
                   out.append(chr((ord(ch) - base + k) % 26 + base))
               else:
                   out.append(ch)
           return "".join(out)

       def crack(ciphertext):
           def score(text):
               words = "".join(c.lower() if c.isalpha() else " " for c in text).split()
               return sum(w in COMMON for w in words)
           best = max(range(26), key=lambda k: score(shift_text(ciphertext, -k)))
           return best, shift_text(ciphertext, -best)

       print(crack(MSG)[1])
       ''',
       hints=['Write `shift_text(text, k)` first and check that shifting by `k` then `-k` gives the original back.',
              'Score each of the 26 candidates by counting words that are in `COMMON`, then take the `max`.'],
       why='''Twenty-six candidates and a crude English detector are enough. This is the core of all brute-force attacks: if a computer can
       enumerate the keys and recognise success, the cipher is broken. Modern keys are 128 or 256 bits, so enumerating them is not a question
       of faster computers but of more energy than the Sun will produce.''',
       starter='''
       COMMON = {"the", "and", "to", "of", "a", "is", "in", "it", "on", "be", "never", "send"}
       MSG = "Arire fraq cnffjbeqf va gur pyrne. Hfr n cnffjbeq znantre."

       def crack(ciphertext):
           return 0, ciphertext

       print(crack(MSG)[1])
       ''',
       check='''
       k, p = crack(MSG)
       assert k == 13, "The shift for MSG is 13 (ROT13). Got " + repr(k)
       assert p == "Never send passwords in the clear. Use a password manager.", "Keep case and punctuation. Got: " + p
       k2, p2 = crack("Wkh vhfuhw lv lq wkh qdph.")
       assert (k2, p2) == (3, "The secret is in the name."), "crack() must work for any shift, not just 13"
       assert "Never send passwords" in out, "Print the plaintext of MSG"
       '''),

    H2('Hashes: fingerprints for data', 'hashes'),
    P('''A cryptographic **hash** turns any input into a fixed-size digest (32 bytes for SHA-256) so that you cannot run it backwards,
    cannot find two inputs with the same digest, and any change to the input, even one bit, changes about half the output bits. That last
    property is the **avalanche effect**, and it is what makes a hash a reliable fingerprint:'''),
    RUN('''
    import hashlib

    def bits_differ(a: bytes, b: bytes) -> int:
        return sum(bin(x ^ y).count("1") for x, y in zip(a, b))

    a, b = b"hello", b"hellO"             # 'o' (0x6f) and 'O' (0x4f) differ in one bit
    ha, hb = hashlib.sha256(a).digest(), hashlib.sha256(b).digest()
    print(ha.hex())
    print(hb.hex())
    print("input bits that differ: ", bits_differ(a, b))
    print("output bits that differ:", bits_differ(ha, hb), "of", len(ha) * 8)
    '''),
    P('''The everyday use is checking that a download is exactly what the publisher released. macOS ships `shasum` (and `openssl dgst`).
    Compare the digest you compute with the one on the project's website or in its signed release notes:'''),
    TERM('''
    $ printf 'hello' | shasum -a 256
    2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824  -
    $ printf 'hello' > a.txt && shasum -a 256 a.txt > SHA256SUMS
    $ cat SHA256SUMS
    2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824  a.txt
    $ shasum -a 256 -c SHA256SUMS
    a.txt: OK
    $ printf 'hellO' > a.txt && shasum -a 256 -c SHA256SUMS
    a.txt: FAILED
    shasum: WARNING: 1 computed checksum did NOT match
    '''),
    TABLE(['Algorithm', 'Digest', 'Status', 'Use for'], [
        ['MD5', '128 bits', 'broken: collisions take seconds', 'nothing security-related; non-adversarial checksums only'],
        ['SHA-1', '160 bits', 'broken: practical collisions since 2017', 'legacy only (Git is migrating away from it)'],
        ['SHA-256 / SHA-512 (SHA-2)', '256 / 512 bits', 'secure', 'the default everywhere: TLS, downloads, signatures'],
        ['SHA-3, BLAKE2, BLAKE3', '256+ bits', 'secure', 'alternatives; BLAKE2 and BLAKE3 are very fast in software'],
    ], 'Which hash'),
    CALLOUT('gotcha', 'A hash proves integrity, not origin', '''If an attacker can replace the download, they can replace the checksum on the same page too. A hash only helps when you get
    it through a channel you trust more than the file: a signed release, a different site, or a package manager that checks signatures for
    you (Homebrew and pip verify hashes of what they download).'''),

    H2('Passwords need slow hashes', 'passwords'),
    P('''Storing `sha256(password)` looks safe and is not. SHA-256 is designed to be *fast*: a single graphics card computes billions of
    them per second, so an attacker who steals your database tries every common password against every hash in minutes. Two fixes, always
    together: a random **salt** per user (so identical passwords give different hashes and precomputed tables are useless) and a
    deliberately **slow, memory-hard** function, so each guess costs real time and memory.'''),
    TABLE(['Function', 'Tunable cost', 'Recommendation'], [
        ['Argon2id', 'time, memory, parallelism', 'the first choice for new systems (winner of the Password Hashing Competition, RFC 9106)'],
        ['scrypt', 'CPU and memory', 'good; built into Python\'s `hashlib` on macOS and Linux'],
        ['bcrypt', 'cost factor', 'fine and very widely supported; truncates passwords at 72 bytes'],
        ['PBKDF2-HMAC-SHA256', 'iteration count', 'acceptable when you need FIPS compliance; OWASP suggests 600,000 iterations'],
    ], 'Password hashing'),
    P('''The browser has PBKDF2 built in. Run this and change the iteration count: the time grows in proportion, which is the whole
    point. The fixed salt is only so the output is the same every time; real code generates a random one per password and stores it next
    to the hash.'''),
    JSRUN('''
    const enc = new TextEncoder();
    const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

    async function pbkdf2(password, salt, iterations) {
      const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, base, 256);
      return hex(bits);
    }

    console.log(await pbkdf2('correct horse', 'salt-for-alice', 1000));
    console.log(await pbkdf2('correct horse', 'salt-for-bob', 1000));        // same password, different salt
    console.log(await pbkdf2('correct horse', 'salt-for-alice', 1000));      // same salt again: same result
    ''', browser=True),
    P('''Change `1000` to `600000` in all three calls and run again: the pause you notice is the work every single guess now costs an
    attacker.'''),
    P('''On your Mac, Python's `hashlib.scrypt` and `hashlib.pbkdf2_hmac` are available because the system Python and Homebrew Python are
    built with OpenSSL. (The in-page Python is not, which is why the box above uses the browser.) For a real application use a library such
    as `argon2-cffi`, which picks safe parameters and stores them inside the hash string:'''),
    FILE('passwords.py', '''
    import hashlib, hmac, os

    def hash_password(password: str) -> str:
        salt = os.urandom(16)
        digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
        return f"scrypt$16384$8$1${salt.hex()}${digest.hex()}"

    def check_password(password: str, stored: str) -> bool:
        _, n, r, p, salt, digest = stored.split("$")
        candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p))
        return hmac.compare_digest(candidate.hex(), digest)

    stored = hash_password("correct horse battery staple")
    print(stored[:40] + "…")
    print(check_password("correct horse battery staple", stored), check_password("Tr0ub4dor&3", stored))
    '''),

    H2('MACs: integrity with a shared key', 'macs'),
    P('''A hash alone cannot prove *who* produced it, because anyone can compute one. Mix a secret key in and you get a **MAC**: only
    someone with the key can produce or check the tag. HMAC (RFC 2104) builds a MAC safely from any hash. You already used it to verify
    webhooks in the APIs chapter; it also signs AWS API requests, session cookies and JWTs that use `HS256`:'''),
    RUN('''
    import base64, hashlib, hmac, json

    def b64url(b: bytes) -> str:
        return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

    KEY = b"server-side secret, never sent"
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64url(json.dumps({"sub": "learner", "role": "viewer"}, separators=(",", ":")).encode())
    sig = b64url(hmac.new(KEY, f"{header}.{payload}".encode(), hashlib.sha256).digest())
    token = f"{header}.{payload}.{sig}"
    print(token)

    def verify(tok: str) -> bool:
        h, p, s = tok.split(".")
        good = b64url(hmac.new(KEY, f"{h}.{p}".encode(), hashlib.sha256).digest())
        return hmac.compare_digest(good, s)

    forged_payload = b64url(json.dumps({"sub": "learner", "role": "admin"}, separators=(",", ":")).encode())
    print("original valid:", verify(token))
    print("role=admin forgery valid:", verify(f"{header}.{forged_payload}.{sig}"))
    '''),
    P('''That is a complete, correct HS256 JWT built by hand. The attacker can read and edit the payload, but without the key cannot make
    a matching signature, so promoting `viewer` to `admin` fails. Real servers must also check `exp`, and must refuse a token whose header
    says `"alg": "none"`: a famous class of bugs came from libraries that believed the header.'''),

    H2('Symmetric encryption: AES-GCM', 'aes'),
    P('''**Symmetric** encryption uses one key to encrypt and decrypt. AES is the block cipher almost everything uses, with hardware
    support in every Apple chip. On its own a block cipher encrypts 16 bytes; a **mode** turns it into something useful, and today the
    right mode is an **AEAD** (authenticated encryption with associated data) such as **AES-GCM** or **ChaCha20-Poly1305**. An AEAD takes a
    key, a **nonce** (number used once) and a message, and returns ciphertext plus a 16-byte **tag**. Decryption checks the tag first and
    refuses to return anything if a single bit changed.'''),
    ASCII('''
      key (32 bytes, secret) ──┐
      nonce (12 bytes, unique) ┼──▶ ⟪b:AES-GCM encrypt⟫ ──▶ ciphertext (same length) + ⟪g:tag⟫ (16 bytes)
      plaintext ───────────────┘
                                      ⟪b:AES-GCM decrypt⟫ ──▶ plaintext   ⟪d:if the tag verifies⟫
                                                       └──▶ ⟪r:error⟫       ⟪d:otherwise: no partial output⟫
      store or send: nonce ‖ ciphertext ‖ tag   (the nonce is not secret; it must never repeat for the same key)
    '''),
    P('Use the AES-GCM tab of the cipher lab above to encrypt with a password, tamper with one bit and watch decryption refuse. The same steps in code, with a fixed key so the output is repeatable:'),
    JSRUN('''
    const enc = new TextEncoder(), dec = new TextDecoder();
    const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');

    const rawKey = new Uint8Array(32).map((_, i) => i);          // demo key 00 01 02 … 1f. Never do this for real.
    const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
    const nonce = new Uint8Array(12).fill(7);                    // must be unique per message: see below

    const msg = enc.encode('nas backup at 02:00');
    const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, msg));
    console.log('plaintext ', msg.length, 'bytes');
    console.log('ciphertext', hex(sealed.slice(0, -16)));
    console.log('tag       ', hex(sealed.slice(-16)));
    console.log('decrypted:', dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, sealed)));

    sealed[3] ^= 0x01;                                            // flip one bit in transit
    try {
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, sealed);
    } catch (e) {
      console.log('tampered: ', e.name);
    }
    ''', browser=True),
    P('''Why "never reuse a nonce"? GCM encrypts by XORing the message with a keystream that depends only on the key and the nonce.
    Encrypt two messages with the same pair and the keystream cancels out: XORing the two ciphertexts gives the XOR of the two
    plaintexts, and if the attacker knows or guesses one message, they read the other. Reuse also lets them forge tags. Watch it happen:'''),
    JSRUN('''
    const enc = new TextEncoder(), dec = new TextDecoder();
    const key = await crypto.subtle.importKey('raw', new Uint8Array(32).fill(42), 'AES-GCM', false, ['encrypt']);
    const nonce = new Uint8Array(12);                             // the bug: the same nonce twice

    const known = enc.encode('GET /status HTTP/1.1');             // attacker can guess this one
    const secret = enc.encode('password=hunter2-lab!');
    const c1 = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, known));
    const c2 = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, secret));

    const recovered = known.map((p, i) => p ^ c1[i] ^ c2[i]);    // known XOR keystream XOR other ciphertext
    console.log('without the key:', dec.decode(recovered));
    ''', browser=True),
    P('''The attacker recovers as many bytes as they guessed (here all but the final `!`, because the guessed request is one byte
    shorter). The fix is boring and absolute: generate a fresh random 12-byte nonce with `crypto.getRandomValues` (or `os.urandom(12)`) for every
    message, or use a library that does it for you. With random nonces, rotate the key long before 2³² messages.'''),
    CALLOUT('tip', 'Encrypting files on your Mac', '''For a file you want to keep private, use a tool whose defaults are already right. `age` (`brew install age`) encrypts with a
    password (`age -p -o notes.txt.age notes.txt`) or to someone's public key, using modern authenticated encryption. Avoid
    `openssl enc`: its CBC modes have no authentication tag, so a changed file decrypts to garbage instead of being rejected, and its options
    make weak choices easy. For whole disks, FileVault already does this with AES-XTS on every Mac.'''),

    H2('Public-key cryptography: key exchange and signatures', 'pubkey'),
    P('''Symmetric encryption has one big problem: both sides need the same secret key, and you cannot send it over the network you are
    trying to protect. Public-key (asymmetric) cryptography solves it with key **pairs**: a private key you never share and a public key you
    give to everyone. Two operations matter in practice.'''),
    H3('Key exchange', 'kex'),
    P('''Diffie-Hellman lets two parties who have never met agree on a shared secret while an eavesdropper watches every message. Each side
    keeps a secret number, sends a value derived from it, and combines the other side's value with its own secret. Both reach the same
    result; the eavesdropper would have to solve the discrete logarithm problem. Try it with small numbers, then let Eve attack:'''),
    WIDGET('dhmix'),
    RUN('''
    import secrets

    p = 2**127 - 1                       # a Mersenne prime, big enough for a demo, far too small for real use
    g = 3
    a = secrets.randbelow(p - 3) + 2     # Alice's secret
    b = secrets.randbelow(p - 3) + 2     # Bob's secret
    A, B = pow(g, a, p), pow(g, b, p)    # sent in public
    alice_key, bob_key = pow(B, a, p), pow(A, b, p)
    print("A and B fit in 127 bits:", A.bit_length() <= 127 and B.bit_length() <= 127)
    print("same secret on both sides:", alice_key == bob_key)
    '''),
    P('''Real systems use **elliptic-curve** Diffie-Hellman, usually **X25519**, where 32-byte keys give the security of much larger classic
    numbers, and both sides feed the shared secret into a key-derivation function to get the actual AES keys. Because a quantum computer
    could one day solve both discrete-log problems, the internet is moving to **hybrid** key exchange: X25519 combined with ML-KEM, a
    post-quantum algorithm standardised by NIST in 2024. Chrome, Edge and Firefox already offer `X25519MLKEM768` in TLS, and Apple's TLS
    stack, which Safari uses, has offered it since macOS 26 and iOS 26.'''),
    H3('Signatures', 'sign'),
    P('''A **signature** is made with a private key and checked with the public key. It proves that the holder of the private key approved
    exactly these bytes. It is how your Mac knows an app came from its developer, how Git hosts mark commits as verified, how package
    managers trust updates, and how a TLS server proves its identity. Ed25519 is the modern default:'''),
    JSRUN('''
    const enc = new TextEncoder();
    const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const pub = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
    console.log('public key:', pub.length, 'bytes');

    const release = enc.encode('netkit 1.4.2 sha256=9f2ce71a');
    const sig = await crypto.subtle.sign('Ed25519', privateKey, release);
    console.log('signature: ', sig.byteLength, 'bytes');

    const verify = (data) => crypto.subtle.verify('Ed25519', publicKey, sig, enc.encode(data));
    console.log('genuine:  ', await verify('netkit 1.4.2 sha256=9f2ce71a'));
    console.log('tampered: ', await verify('netkit 1.4.2 sha256=0bad0bad'));
    ''', browser=True),
    P('''Your SSH key is an Ed25519 key pair too, and OpenSSH can sign and verify files with it (`ssh-keygen -Y`), the same mechanism
    Git uses to sign commits with `git config gpg.format ssh`. This transcript is a real run; your fingerprint will differ:'''),
    TERM('''
    $ ssh-keygen -t ed25519 -C "learner@mac" -f ~/.ssh/id_lab
    Generating public/private ed25519 key pair.
    Enter passphrase (empty for no passphrase):
    Enter same passphrase again:
    Your identification has been saved in /Users/learner/.ssh/id_lab
    Your public key has been saved in /Users/learner/.ssh/id_lab.pub
    The key fingerprint is:
    SHA256:D3GZuVzJm2EQTXV4Jl0NxcA6rISiWMZInk9GkZZ5EEA learner@mac
    $ ssh-keygen -Y sign -f ~/.ssh/id_lab -n file notes.txt
    Signing file notes.txt
    Write signature to notes.txt.sig
    $ echo "learner@mac $(cat ~/.ssh/id_lab.pub)" > allowed_signers
    $ ssh-keygen -Y verify -f allowed_signers -I learner@mac -n file -s notes.txt.sig < notes.txt
    Good "file" signature for learner@mac with ED25519 key SHA256:D3GZuVzJm2EQTXV4Jl0NxcA6rISiWMZInk9GkZZ5EEA
    $ echo 'one more line' >> notes.txt
    $ ssh-keygen -Y verify -f allowed_signers -I learner@mac -n file -s notes.txt.sig < notes.txt
    Signature verification failed: incorrect signature
    Could not verify signature.
    '''),
    P('''The `-n file` **namespace** is part of what gets signed, so a signature made for one purpose (say `git`) cannot be replayed as a
    signature for another. Protect a private key with a passphrase, and on a Mac let the Keychain remember it (`ssh-add --apple-use-keychain`).'''),

    H2('Certificates and TLS', 'tls'),
    P('''A public key alone does not say *whose* key it is. A **certificate** binds a public key to a name (`app.lab.example`), with an
    expiry date, signed by a **certificate authority** (CA). Your Mac and browsers ship with a list of trusted root CAs. A server sends its
    certificate plus any **intermediate** certificates, and the client checks the chain up to a root it already trusts, then checks the
    name and the dates.'''),
    ASCII('''
      ⟪w:root CA⟫  (in your Mac's trust store, offline, valid for decades)
         │ signs
      ⟪w:intermediate CA⟫  (does the daily signing)
         │ signs
      ⟪b:app.lab.example⟫  public key + names + notBefore/notAfter   ◀── sent by the server in the TLS handshake
         └── the server proves it holds the matching private key by signing the handshake (CertificateVerify)
    '''),
    P('''Certificates are getting shorter-lived so that a stolen key or a mistake expires quickly. Under rules adopted by the CA/Browser
    Forum, publicly trusted certificates could be valid for at most 200 days from 15 March 2026; the limit drops to 100 days on 15 March 2027
    and 47 days on 15 March 2029. Let's Encrypt certificates already last 90 days. The practical consequence: renewal must be automatic
    (certbot, Caddy, your cloud's certificate manager), because nobody remembers to do it by hand eight times a year.'''),
    P('Now watch a full TLS 1.3 handshake, including what an eavesdropper still sees:'),
    WIDGET('tls13'),
    H3('Lab: your own certificate authority', 'calab'),
    P('''The best way to understand chains is to build one. You will create a private root CA, issue a certificate for `localhost` and
    `127.0.0.1`, serve HTTPS with Python, and watch curl reject it until you tell curl to trust your CA. Everything stays in `~/lab/ca`.
    macOS's own `openssl` is LibreSSL; use Homebrew's OpenSSL 3 for this lab so the commands and output match:'''),
    SH('''
    brew install openssl@3
    alias ossl="$(brew --prefix openssl@3)/bin/openssl"
    mkdir -p ~/lab/ca && cd ~/lab/ca
    ossl version
    '''),
    P('''Create the root CA: a P-256 key and a self-signed certificate valid for ten years. The two `-addext` options mark it as a CA that
    may sign certificates. Python 3.13 and later verify strictly and reject a CA certificate without a `keyUsage` extension, with the error
    "CA cert does not include key usage extension".'''),
    SH('''
    ossl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out ca.key
    ossl req -x509 -new -key ca.key -sha256 -days 3650 -subj "/CN=Lab Root CA" \\
      -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" -out ca.crt
    '''),
    P('Create the server key and a certificate signing request, then sign it with the CA. The extension file lists the names the certificate is valid for: browsers ignore the CN and check only the subjectAltName.'),
    SH('''
    ossl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out server.key
    printf 'subjectAltName=DNS:lab.localhost,DNS:localhost,IP:127.0.0.1\\nextendedKeyUsage=serverAuth\\nkeyUsage=critical,digitalSignature\\nbasicConstraints=CA:FALSE\\n' > server.ext
    ossl req -new -key server.key -subj "/CN=lab.localhost" -out server.csr
    ossl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 30 -sha256 -extfile server.ext -out server.crt
    '''),
    P('Inspect and verify what you made. This output is from OpenSSL 3.0; newer versions print names without the spaces around `=`:'),
    TERM('''
    $ ossl x509 -in server.crt -noout -subject -issuer -dates -ext subjectAltName
    subject=CN = lab.localhost
    issuer=CN = Lab Root CA
    notBefore=Nov 16 23:27:53 2026 GMT
    notAfter=Dec 16 23:27:53 2026 GMT
    X509v3 Subject Alternative Name:
        DNS:lab.localhost, DNS:localhost, IP Address:127.0.0.1
    $ ossl verify -CAfile ca.crt server.crt
    server.crt: OK
    $ ossl verify server.crt
    CN = lab.localhost
    error 20 at 0 depth lookup: unable to get local issuer certificate
    error server.crt: verification failed
    '''),
    P('Serve HTTPS with the new certificate. Save this next to the keys and run it in its own tab:'),
    FILE('tls_server.py', '''
    import http.server, ssl

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain("server.crt", "server.key")
    srv = http.server.HTTPServer(("127.0.0.1", 8443), http.server.SimpleHTTPRequestHandler)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    print("Serving https://localhost:8443/", flush=True)
    srv.serve_forever()
    '''),
    P('Then connect from a second tab. curl refuses until you give it the CA, exactly as a browser would refuse an unknown issuer:'),
    TERM('''
    $ echo 'hello over TLS' > index.html
    $ curl -sS https://localhost:8443/
    curl: (60) SSL certificate problem: unable to get local issuer certificate
    More details here: https://curl.se/docs/sslcerts.html

    curl failed to verify the legitimacy of the server and therefore could not
    establish a secure connection to it. To learn more about this situation and
    how to fix it, please visit the web page mentioned above.
    $ curl -sS --cacert ca.crt https://localhost:8443/
    hello over TLS
    $ echo | ossl s_client -connect localhost:8443 -servername localhost -CAfile ca.crt -brief
    CONNECTION ESTABLISHED
    Protocol version: TLSv1.3
    Ciphersuite: TLS_AES_256_GCM_SHA384
    Peer certificate: CN = lab.localhost
    Hash used: SHA256
    Signature type: ECDSA
    Verification: OK
    Server Temp Key: X25519, 253 bits
    DONE
    '''),
    UL('**`Server Temp Key: X25519`** is the ephemeral Diffie-Hellman key for this connection only: steal the server key next year and you still cannot decrypt today\'s recording. That property is **forward secrecy**, and TLS 1.3 always has it.',
       '**`Signature type: ECDSA`** is the server proving it holds the private key of the certificate, the CertificateVerify step in the widget.',
       '**Exit code 60** is curl\'s "certificate problem" code. Scripts should treat it as fatal, never retry with `-k`.'),
    CALLOUT('danger', 'Keep the CA key off everything that matters', '''Anyone with `ca.key` can mint a certificate for any name. If you add `ca.crt` to your Mac's System keychain as trusted (Keychain
    Access, or `sudo security add-trusted-cert`), a stolen `ca.key` could impersonate your bank to your own browser. For local development,
    `mkcert` (`brew install mkcert`) automates this lab with name constraints and sensible defaults; delete lab CAs from the keychain when you
    are done.'''),
    CMD('openssl req', 'srv-crypto', 'brew:openssl@3', 'Create keys, certificate signing requests and self-signed or CA-signed certificates.',
        'openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out KEY\nopenssl req -new|-x509 -key KEY -subj "/CN=NAME" -out FILE\nopenssl x509 -req -in CSR -CA CA.crt -CAkey CA.key -extfile EXT -out CRT',
        ['`genpkey` makes a private key. `req -new` wraps the public half and your requested names into a **certificate signing request** (CSR), signed with the private key to prove you hold it. `req -x509` skips the CA and signs the certificate with the same key: a **self-signed** certificate, which is what a root CA is.',
         '`x509 -req` is the CA side: it reads a CSR and signs a certificate with the CA key. The extensions file decides what the certificate is good for: `subjectAltName` lists the DNS names and IPs (clients check only this, not the CN), `basicConstraints=CA:FALSE` stops the certificate from signing others, `keyUsage` says which key operations are allowed, and `extendedKeyUsage=serverAuth` limits it to TLS servers. A CA certificate needs `basicConstraints=critical,CA:TRUE` and `keyUsage=critical,keyCertSign,cRLSign`; strict verifiers, including Python 3.13 and later, reject a CA without them.',
         'Public CAs such as Let\'s Encrypt run this same process automatically through the ACME protocol, after proving you control the domain.'],
        flags=[('genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256', 'a P-256 key; `-algorithm ed25519` also works for many uses'), ('req -new -subj "/CN=…"', 'make a CSR without the interactive questions'),
               ('req -x509 -days N', 'make a self-signed certificate valid for N days'), ('x509 -req -CA … -CAkey … -CAcreateserial', 'sign a CSR as a CA'),
               ('-extfile FILE', 'add extensions such as subjectAltName'), ('x509 -noout -text', 'print every field of a certificate')],
        examples=[('ex', 'A throwaway self-signed certificate for localhost', 'openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout key.pem -out cert.pem -days 7 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"'),
                  ('pipe', 'Show the names a certificate is valid for', 'openssl x509 -in server.crt -noout -ext subjectAltName')],
        gotchas=['A certificate without subjectAltName is rejected by browsers and modern curl even when the CN matches.',
                 'Private keys written by these commands are unencrypted unless you ask otherwise. Keep them out of Git and readable only by you (`chmod 600`).'],
        see=['openssl s_client', 'openssl x509', 'curl'], tags=['tls', 'certificates']),
    CMD('ssh-keygen -Y', 'srv-crypto', 'mac', 'Sign files with an SSH key and verify those signatures, with no extra tools.',
        'ssh-keygen -Y sign -f KEY -n NAMESPACE FILE\nssh-keygen -Y verify -f ALLOWED_SIGNERS -I IDENTITY -n NAMESPACE -s FILE.sig < FILE',
        ['OpenSSH (built into macOS) can make detached signatures with the same Ed25519 key you use to log in. `sign` writes `FILE.sig`; `verify` reads the data on standard input and checks the signature against an **allowed signers** file that maps identities to public keys.',
         'The **namespace** (`-n file`, `-n git`, or your own) is signed too, so a signature made for one purpose cannot be reused for another. Git uses exactly this mechanism when you set `gpg.format ssh` and sign commits.'],
        flags=[('-Y sign -f KEY -n NS FILE', 'sign FILE with private key KEY in namespace NS'), ('-Y verify -f SIGNERS -I ID -n NS -s SIG', 'verify standard input against SIG for identity ID'),
               ('-Y find-principals -s SIG -f SIGNERS', 'find which identity in SIGNERS made a signature'), ('-t ed25519 -C COMMENT', 'generate a new Ed25519 key pair')],
        examples=[('ex', 'Sign a release note', 'ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n file notes.txt'),
                  ('pipe', 'Verify it and print only the result line', 'ssh-keygen -Y verify -f allowed_signers -I {{user}}@mac -n file -s notes.txt.sig < notes.txt 2>&1 | head -1')],
        gotchas=['`verify` reads the signed data from standard input, not from a file argument: forgetting the `< FILE` makes it wait for typing.'],
        see=['shasum', 'ssh'], tags=['signatures']),

    H2('Secrets in daily work', 'secrets'),
    UL('**Passwords**: a password manager and a unique generated password per site. Apple\'s Passwords app is enough. Reuse is the attack that actually happens.',
       '**API keys and tokens**: in the Keychain (`security add-generic-password`), a secret manager, or environment variables loaded from a file that `.gitignore` excludes. Never in code, never in a URL.',
       '**SSH and signing keys**: Ed25519, with a passphrase, one key per device so you can revoke one without the others.',
       '**Random values**: `secrets.token_urlsafe(32)` in Python or `crypto.getRandomValues` in JavaScript. Never `random` or `Math.random()` for anything security-related; they are predictable.',
       '**When something leaks**: revoke and rotate first, investigate second. Deleting a commit does not un-leak a key that was pushed.'),
    EX('crypto-ex-pick-the-primitive', 'Pick the right tool', 'think',
       '''For each job, name the tool (encoding, hash, slow password hash, MAC, authenticated encryption, signature, or TLS) and one concrete
       algorithm: (a) store user passwords for a web app; (b) prove a downloaded installer is unmodified, given a checksum on a signed release
       page; (c) let a provider prove a webhook came from them, using a secret you both know; (d) publish a file that anyone can verify came
       from you, without sharing any secret; (e) keep a backup file private on a cloud drive; (f) put binary data inside a JSON string.''',
       '''(a) slow password hash: Argon2id (or scrypt, bcrypt) with a per-user salt
(b) hash: SHA-256, compared with the published checksum
(c) MAC: HMAC-SHA256 over the raw body
(d) signature: Ed25519 (for example ssh-keygen -Y sign, or minisign)
(e) authenticated encryption: AES-256-GCM or ChaCha20-Poly1305, for example with age
(f) encoding: base64 (no security at all, and that is fine for this job)''',
       hints=['Ask two questions: does anyone need to read it back, and does the verifier share a secret with the producer?'],
       why='''Each tool answers one question. Passwords need to be checked, never read back, and must resist guessing: slow hash. Integrity
       with a shared secret is a MAC; integrity without one is a signature. Privacy needs encryption, and only authenticated encryption also
       detects tampering. Base64 is for transport, not protection.'''),
    EX('crypto-ex-sha256-in-the-browser', 'SHA-256 in the browser', 'js',
       '''Write `async function sha256hex(text)` that returns the SHA-256 digest of the UTF-8 bytes of `text` as a lowercase hex string,
       using `crypto.subtle.digest`. Inside an `async` function `main`, print the digest of `hello` and call `main()`.''',
       '''
       async function sha256hex(text) {
         const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
         return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
       }

       async function main() {
         console.log(await sha256hex('hello'));
       }
       main();
       ''',
       hints=['`new TextEncoder().encode(text)` gives the UTF-8 bytes.', '`digest` returns an `ArrayBuffer`; wrap it in `Uint8Array` and format each byte with `toString(16).padStart(2, \'0\')`.'],
       why='''Web Crypto works on bytes, not strings, and returns raw bytes, so every real use has the same two conversions at the edges.
       `padStart` matters: without it, a byte such as `0x0a` becomes `a` and the hex string is too short and wrong.''',
       starter='''
       async function sha256hex(text) {
         // your code
       }

       async function main() {
         console.log(await sha256hex('hello'));
       }
       main();
       ''',
       check='''
       assert(typeof sha256hex === 'function', 'Define sha256hex.');
       const h = await sha256hex('hello');
       assert(h === '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', 'Wrong digest for "hello": ' + h);
       assert((await sha256hex('')).startsWith('e3b0c442'), 'The empty string has a digest too (e3b0c442…).');
       assert((await sha256hex('é')).length === 64, 'Hash the UTF-8 bytes and pad every byte to two hex digits.');
       assert(out.includes('2cf24dba5fb0a30e'), 'Print the digest of hello.');
       '''),

    CHECK('crypto-ch-encryption-checkpoint', 'Encryption checkpoint',
          Q('A system stores `base64(password)`. How protected are the passwords?', [('Strongly encrypted', False), ('Hashed but unsalted', False), ('Not at all: anyone can decode base64', True), ('Protected unless the attacker has a quantum computer', False)],
            'Encoding has no key. It is a representation, not a protection.'),
          Q('Why is SHA-256 a poor choice for storing passwords on its own?', [('It is broken', False), ('It is fast, so stolen hashes can be guessed at billions per second', True), ('Its output is too short', False), ('It cannot handle Unicode', False)],
            'SHA-256 is a fine hash, but password storage needs a salt and a deliberately slow function such as Argon2id, scrypt or bcrypt.'),
          Q('What does AES-GCM decryption do if one bit of the ciphertext changed?', [('Returns plaintext with one wrong character', False), ('Returns plaintext with one wrong block', False), ('Refuses: the tag check fails and no plaintext is returned', True), ('Silently ignores the change', False)],
            'GCM is authenticated encryption. The tag covers every bit, and decryption is all or nothing.'),
          Q('Two messages were encrypted with AES-GCM using the same key and the same nonce. What can an attacker do?', [('Nothing; the key is still secret', False), ('XOR the ciphertexts to get the XOR of the plaintexts, and forge tags', True), ('Only learn the message lengths', False), ('Decrypt any past message with the key', False)],
            'The keystream depends only on key and nonce, so it cancels out. Never reuse a nonce with the same key.'),
          Q('In TLS 1.3, what lets a client know the server really holds the private key for its certificate?', [('The certificate is sent', False), ('The CertificateVerify signature over the handshake transcript', True), ('The ServerHello', False), ('The SNI extension', False)],
            'Anyone can send a copy of a public certificate. Only the key holder can sign this handshake\'s transcript.'),
          Q('Your `curl` fails with exit code 60 against your own lab server. The right fix?', [('Add `-k` to the command', False), ('Give curl the CA that signed the server certificate with `--cacert`', True), ('Switch to http', False), ('Restart the server', False)],
            '`-k` turns off the check that makes HTTPS meaningful. Trust the specific CA instead.')),

    PROJECT('crypto-pr-vault-an-encrypted-notes-file', 'vault: an encrypted, signed notes file', 'intermediate', 50,
            ['scrypt', 'AES-GCM', 'Ed25519', 'file formats'],
            P('''Write `vault.py`, a small command-line tool that keeps a notes file encrypted at rest with a password, detects tampering, and can
            publish a signed copy. It uses the `cryptography` package (`python3 -m pip install cryptography` in your project\'s virtual
            environment), which wraps OpenSSL with safe, high-level APIs.'''),
            H3('1. The file format'),
            P('''Write one line of JSON: `{"v": 1, "kdf": "scrypt", "n": 32768, "r": 8, "p": 1, "salt": "…", "nonce": "…", "ct": "…"}` with base64
            values. Putting the parameters in the file means you can raise them later without breaking old vaults.'''),
            H3('2. Encrypt and decrypt'),
            P('''Derive a 32-byte key with `hashlib.scrypt` (with `n=32768` also pass `maxmem=64 * 1024 * 1024`, because the default memory limit is too small), then seal the notes with `cryptography.hazmat.primitives.ciphers.aead.AESGCM` and a fresh
            `os.urandom(12)` nonce on every save. Pass the JSON header (without `ct`) as **associated data**, so changing the parameters is detected
            too. `vault.py edit` decrypts to a temporary file, opens `$EDITOR`, and re-encrypts on exit.'''),
            H3('3. Prove tampering is caught'),
            P('Flip one character in the `ct` field with a text editor and confirm `vault.py show` reports an authentication failure (`InvalidTag`) and prints nothing else.'),
            H3('4. Publish a signed export'),
            P('''`vault.py export notes.txt` writes the plaintext and signs it with your SSH key via `ssh-keygen -Y sign -n file` (call it with
            `subprocess`). `vault.py verify notes.txt` runs `ssh-keygen -Y verify` against an `allowed_signers` file. Commit the public key so
            others can verify your exports.'''),
            H3('5. Stretch goals'),
            UL('Support changing the password without re-encrypting the notes: encrypt a random data key with the password-derived key (this is **envelope encryption**, exactly how cloud key services work).',
               'Store the password in the Keychain with `security` so `vault.py` can run unattended, and discuss what that changes about your threat model.')),
]

terms = [
    ('hash', 'a one-way function giving a fixed-size digest; any change to the input changes the digest'),
    ('salt', 'random bytes stored with a password hash so equal passwords hash differently'),
    ('MAC', 'message authentication code: a tag computed with a shared secret key that proves integrity and origin'),
    ('HMAC', 'a standard way to build a MAC from a hash function such as SHA-256'),
    ('AEAD', 'authenticated encryption with associated data, such as AES-GCM: encrypts and detects tampering'),
    ('nonce', 'a number used once; must never repeat with the same key in AES-GCM'),
    ('key exchange', 'a protocol, such as (EC)DH, by which two parties derive a shared secret over a public channel'),
    ('forward secrecy', 'stealing a long-term key later does not expose sessions recorded earlier, because each session used an ephemeral key'),
    ('signature', 'a value made with a private key that anyone can verify with the matching public key'),
    ('certificate', 'a signed statement binding a public key to names, valid for a period, issued by a certificate authority'),
    ('CA', 'certificate authority: an entity whose signature on a certificate clients trust'),
    ('SNI', 'Server Name Indication: the host name a TLS client asks for, sent in clear in the ClientHello'),
]

CHAPTER = chapter('crypto', 'Encryption: Hashes, Keys, Signatures and TLS',
                  'Break a classical cipher, use hashes, MACs, AES-GCM and signatures correctly, build your own certificate authority and read a TLS 1.3 handshake',
                  'apis', 120,
                  ['Tell encoding, hashing, MACs, encryption and signatures apart, and choose the right one for a job',
                   'Verify downloads with SHA-256 and store passwords with a salted, slow hash',
                   'Encrypt and decrypt with AES-GCM, and explain why a reused nonce is catastrophic',
                   'Explain key exchange and signatures, and sign and verify files with your SSH key',
                   'Build a private CA, serve HTTPS with it, and read every step of a TLS 1.3 handshake'],
                  blocks, terms, file='40-crypto.gm')
