# Testing guide — SXCCAA alumni platform

How to check, by hand, that everything built so far actually works. Written to be followed top to bottom by someone who has not read the code.

**Nothing in this guide needs the real alumni spreadsheet.** Everything runs against synthetic data.

---

## 0. One-time setup

You need this once. Skip to §1 if you have done it before.

### 0.1 Check you have what you need

```bash
node --version
```

Must be **24 or higher**. The tools use Node's built-in TypeScript support and `--env-file`.

### 0.2 Install

```bash
cd ~/xaverians/oxvercity && npm install
```

```bash
cd ~/xaverians/admin && npm install
```

### 0.3 Secrets

If `oxvercity/.env` does not exist:

```bash
cd ~/xaverians/oxvercity && cp .env.example .env && npm run keys:generate -- --write
```

That writes the three secrets in place and prints nothing — deliberately, so they do not end up in your terminal scrollback.

Then fill in by hand, in `oxvercity/.env`:

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → **Session pooler**. URL-encode `@` as `%40` in the password. |
| `RESEND_API_KEY` | resend.com → API Keys |
| `MAIL_FROM` | Any address on a domain verified in Resend |
| `ADMIN_NOTIFY_EMAIL` | Where "an access request is waiting" goes |
| `ENQUIRY_TO_EMAIL` | Where the general contact form goes |

Leave `WEB_DATABASE_URL`, `INGEST_DATABASE_URL` and the three `SXC_*_PASSWORD` values blank for now — the next step fills them.

### 0.4 Create the database

```bash
cd ~/xaverians/oxvercity && npm run db:migrate
```

Applies all seven migrations and generates the role passwords. **Copy the printed `SXC_*_PASSWORD` values into `.env`**, then build the two role URLs from `DATABASE_URL` by swapping the username and password:

```
WEB_DATABASE_URL=postgresql://sxc_web.PROJECTREF:WEBPASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
INGEST_DATABASE_URL=postgresql://sxc_ingest.PROJECTREF:INGESTPASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

### 0.5 Admin portal config

```bash
cd ~/xaverians/admin && cp .env.example .env
```

Set `ADMIN_DATABASE_URL` the same way, using `sxc_admin` and `SXC_ADMIN_PASSWORD`. **Do not copy the encryption keys** — the admin scripts load `../oxvercity/.env` first, so there is one source of truth and the two cannot drift.

---

## 1. The five-minute check

If you only do one thing, do this. Four commands, no browser.

```bash
cd ~/xaverians/oxvercity && npm test && npm run db:verify && npm run restore:proof
```

```bash
cd ~/xaverians/admin && npm test && npm run admin:verify
```

Expected: **187 tests**, **45 tests**, and three verifiers ending in `0 failed`.

`restore:proof` is the one that matters most. It ends with:

> A stolen copy of this database is a file of noise.

That sentence is the entire security claim made to the Association, checked rather than asserted.

---

## 2. Testing each phase

### Phase 1–2 — Encryption and the spreadsheet import

**What it should do:** turn an Excel file into encrypted rows without the plaintext ever leaving your machine.

```bash
cd ~/xaverians/oxvercity
npm run ingest:sample
```

Writes `private-data/sample-alumni.xlsx` — 60 invented people plus 7 deliberately awkward rows. This directory is gitignored.

```bash
npm run ingest -- private-data/sample-alumni.xlsx --dry-run
```

**What to look for:**
- A table of what *would* happen — rows valid, rejected, duplicates.
- **Every phone number and email masked** (`+91 ••••• ••234`). Even on your own screen. If you can read a full number here, that is a bug.
- The seven awkward rows called out with reasons.

Then run it for real (drop `--dry-run`) and confirm in a browser on `127.0.0.1`. Nothing is written until you click.

**Then prove the encryption held:**

```bash
npm run restore:proof
```

22 checks. It plants known values, reads the raw bytes back, and searches them for the plaintext — in raw, hex and base64 form. It also confirms the **public** name *is* readable, so the claim stays honest: the confidential columns are unreadable, not everything.

---

### Phase 3 — Alumni sign-in

**What it should do:** let an allowlisted address in by emailed link, and tell an attacker nothing.

```bash
npm run auth:verify
```

Runs against the live database and **real Resend**, sending to `delivered@resend.dev` (their sink address — nobody receives anything).

**The checks that matter:**
- A registered and an unregistered address get the **identical** response.
- No token is ever minted for an unregistered address.
- A link works **once**.
- A link already in someone's inbox stops working if an admin revokes access.

**By hand:** start the site (§3), go to `/login`, enter an address that is not in the database. You should get *"If that address is registered with the Association, a sign-in link is on its way."* — the same sentence a real alumnus gets. That is the design working.

---

### Phase 4 — Who can see what

**What it should do:** show five fields to the public and everything to signed-in Xaverians, with no way to cross between.

This one needs a running server **with demo mode off**:

```bash
cd ~/xaverians/oxvercity
sed -i 's/^USE_DEMO_ALUMNI=true/USE_DEMO_ALUMNI=false/' .env
npm run dev
```

In another terminal:

```bash
cd ~/xaverians/oxvercity && npm run gate:verify
```

**36 checks, all of them negatives** — the suite that fails when someone reopens a hole:

- an anonymous request to a profile returns **404**, not a login redirect
- no private field appears anywhere in the anonymous HTML
- a field whose owner switched it off is **absent from the JSON**, not null
- a withdrawn record is indistinguishable from one that never existed
- `no-store` and `noindex` where they belong

**By hand, and worth doing once:** open `/alumni` in a private window. Press **Ctrl+U** to view source and search for a phone number. There is nothing to find — the fields were never sent. Then click a card: nothing happens, because for a signed-out visitor it is a `<div>`, not a link.

Turn demo mode back on when you are done:

```bash
sed -i 's/^USE_DEMO_ALUMNI=false/USE_DEMO_ALUMNI=true/' ~/xaverians/oxvercity/.env
```

---

### Phase 5 — The admin portal

**What it should do:** let two or three trusted people manage the directory, with two-factor, and be unreachable to everyone else.

```bash
cd ~/xaverians/admin && npm run admin:verify
```

53 checks: no password oracle, comparable timing on unknown accounts, TOTP replay refused, lockout binds at five attempts, disabling an admin kills their live sessions, and `sxc_web` cannot read or mint an admin session.

**Create a real admin.** Two ways, same result — there is no registration page and there never will be.

*If you can reach the database from your machine:*

```bash
cd ~/xaverians/admin && npm run admin:create
```

*If Supabase's SQL editor is all you have:*

```bash
cd ~/xaverians/admin && npm run admin:sql
```

That one **writes nothing**. It prints a query to paste into the editor, with the Argon2id hash and the AES-GCM ciphertext already computed. Check it first with:

```bash
cd ~/xaverians/admin && npm run seed:verify
```

18 checks: builds a query the same way, runs it verbatim, and signs in with the credentials it was built from.

You will need an authenticator app (1Password, Aegis, Google Authenticator). The command:

1. asks for an email and password with **masked input**
2. checks the password against Have I Been Pwned — only a five-character hash prefix leaves your machine, never the password
3. prints a TOTP secret and **refuses to write anything until you type back a working code**
4. prints ten recovery codes, once

**Save the recovery codes somewhere other than the password manager holding the password.** One place being breached should not yield both factors.

**Then sign in:**

```bash
cd ~/xaverians/admin && npm run dev
```

Open `http://localhost:3400`. Things to try:

| Try this | Expected |
|---|---|
| Wrong password, right code | *"That email address, password or code was not right."* |
| Right password, wrong code | **The same sentence** — no oracle |
| Five wrong attempts | Account locked for fifteen minutes |
| Open `/grants` directly while signed out | Redirect to sign-in |
| Click Revoke on a grant | Asked to confirm your password and a code first |
| Sign in, then immediately try a dangerous action | *"That code has already been used"* — each code works once |

---

### Phase 6 — Alumni managing their own profile

**What it should do:** let someone change what others see about them, and upload a photograph safely.

```bash
cd ~/xaverians/oxvercity && npm test
```

The 20-case upload abuse suite is in there. It feeds the pipeline a PHP file renamed `.jpg`, a decompression bomb, a JPEG with a ZIP appended, a GIF, and a photo carrying GPS EXIF — and asserts the location data is **gone from both stored renditions**. A profile photo taken at home carries the person's address; that is the most serious leak in the feature and the test is the proof it is closed.

**By hand:** sign in as an alumnus, open `/me`, and:

- Turn off **"Show my contact number"**, save, then open your own profile from another account. The number is not on the page — and not in the page source either.
- Upload a photo. It lands **awaiting review** and your card still shows the default outline until an admin approves it in the portal under **Photographs**.
- Try uploading a `.txt` file renamed to `.jpg`. Refused.

---

### Phase 7 — Requesting access

**What it should do:** let someone not in the spreadsheet ask, prove they own the address, and wait for a human.

```bash
cd ~/xaverians/oxvercity && npm run request:verify
```

28 checks: the request is not queued until the code is checked, asking again replaces the code rather than piling up rows, the attempt counter stops at five, and `sxc_web` cannot decide a request.

**By hand:** go to `/contact#request-access`, fill it in, and watch the form move to the code step. The code arrives by email. Enter it, and the request appears in the admin portal under **Access requests** with the address masked.

---

### The enquiry form

```bash
cd ~/xaverians/oxvercity && npm run dev
```

Fill in the "Have a question?" form on `/contact`. It should say *"Thank you — your message is with the Association"* — and the message should actually arrive at `ENQUIRY_TO_EMAIL`.

**The important test is the failure case.** Put a deliberately wrong `RESEND_API_KEY` in `.env`, restart, and submit again. It must say *"We could not send that just now. Please email the Association directly."* — never a false success. That was the bug: the form used to claim "Message sent" and throw everything away.

---

### Phase 8 — Hardening

```bash
cd ~/xaverians/oxvercity && npm run dev
```

```bash
cd ~/xaverians/oxvercity && npm run harden:verify
```

26 checks on what the server actually sends: a nonce in the CSP that **matches the nonce on the script tags**, no `unsafe-inline` for scripts, `frame-ancestors 'none'`, and `no-store` on everything that varies by viewer.

To include the portal, start it and pass its URL:

```bash
ADMIN_PROBE_URL=http://localhost:3400 npm run harden:verify
```

**Two notes are expected in dev** and are not failures:
- `script-src allows 'unsafe-eval'` — `next dev` wraps modules in `eval()`. Production does not.
- `the home page is no-store` — dev never caches.

To check those properly, run against a production build:

```bash
cd ~/xaverians/oxvercity && npm run build && npm run start
```

```bash
PROBE_URL=http://localhost:3300 npm run harden:verify
```

**Also run:**

```bash
cd ~/xaverians/oxvercity && npm run scan:secrets && npm audit --omit=dev
```

---

## 3. Running the site

```bash
cd ~/xaverians/oxvercity && npm run dev
```
→ http://localhost:3300

```bash
cd ~/xaverians/admin && npm run dev
```
→ http://localhost:3400

**`APP_URL` in `.env` must match the port you are actually using.** If it says `:3300` and you are on `:3000`, every form returns `Bad request.` — that is the same-origin check working, not a bug, and it is the single most confusing thing in this project to debug.

---

## 4. Things that look broken and are not

| What you see | What it is |
|---|---|
| Sign-in says the same thing for a real and a fake address | Deliberate. Otherwise the form tells you who is a Xaverian. |
| A profile URL returns 404 while signed out | Deliberate. A login redirect would confirm that person exists. |
| A grant shows only `a3f9c1d2…` and no address | The allowlist stores a one-way hash. Nobody can recover it, including us. |
| "That code has already been used" right after signing in | Each TOTP code works once. Wait for the next one. |
| Photo uploaded but the card still shows the outline | It is awaiting review in the portal. |
| `npm run gate:verify` says "is USE_DEMO_ALUMNI still true?" | It is. Set it to `false` and restart. |

---

### Phase 9 — Launch tooling

```bash
cd ~/xaverians/oxvercity && npm run launch:check
```

Checks configuration rather than behaviour — the failures that pass every test and then bite on the day. Run it locally and it will tell you it is a development configuration; run it with production environment variables before cutover.

```bash
cd ~/xaverians/oxvercity && npm run invite
```

Dry run. Shows who *would* be emailed, with addresses masked, and excludes anyone withdrawn, revoked, or without a sign-in identity. `--send` is required to send anything.

**When you do go live, send one to yourself first** — `npm run invite -- --send --limit 1` — and read it on a phone. For most recipients it is the only thing they will ever read about how their data is handled.

The run is resumable. Stop it, come back tomorrow; it will not email anyone twice.

Two more documents worth reading once: [RUNBOOK.md](RUNBOOK.md) for operations, [ADMIN-GUIDE.md](ADMIN-GUIDE.md) for the Association's volunteers.

---

## 5. Before going live

Not automated, and each needs doing once.

- [ ] **Take a real `pg_dump`, restore it into a scratch database, and read the `alumni` table.** `restore:proof` checks the bytes in place; this checks the actual backup. Confirm `contact_enc` is unreadable.
- [ ] **Practise a key rotation.** Add a second key to `DATA_ENCRYPTION_KEYS`, confirm old rows still decrypt, re-encrypt, retire the old one. Do it before you need it, not during an incident.
- [ ] **Set SPF, DKIM and DMARC on sxccaa.org.** Without DMARC anyone can spoof the Association and phish your alumni with fake sign-in links. This is the highest-probability real-world attack on this system.
- [ ] **Move the secrets out of `.env` into the host's secret store.**
- [ ] **Create a second super admin.** One admin with one phone is one lost phone away from a locked portal.
- [ ] **Archive the Google Form** — its exact wording and the response sheet — to a PDF, offline. A live form can be edited; that archive is your consent evidence.
- [ ] **Warm the sending domain** before the 500-address invitation run. Batch at ~50/hour over two days, or you will land in spam and may get the domain flagged.
- [ ] **Run every verifier once against staging**, with production-shaped config.

---

## 6. Quick reference

| Command | Where | Needs |
|---|---|---|
| `npm test` | both | nothing |
| `npm run db:verify` | oxvercity | database |
| `npm run restore:proof` | oxvercity | database |
| `npm run auth:verify` | oxvercity | database + Resend |
| `npm run request:verify` | oxvercity | database + Resend |
| `npm run gate:verify` | oxvercity | database + server, `USE_DEMO_ALUMNI=false` |
| `npm run harden:verify` | oxvercity | running server |
| `npm run scan:secrets` | oxvercity | nothing |
| `npm run launch:check` | oxvercity | database + DNS |
| `npm run invite` | oxvercity | database + Resend |
| `npm run admin:verify` | admin | database |
| `npm run admin:create` | admin | database + a terminal + an authenticator app |
| `npm run admin:sql` | admin | a terminal + an authenticator app (no database) |
| `npm run seed:verify` | admin | database |
| `npm run ingest` | oxvercity | database + the spreadsheet |
