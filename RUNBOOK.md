# Operations runbook — SXCCAA alumni platform

For whoever keeps this running. Written to be readable at 2am by someone who did not build it.

Companion documents: [TESTING-GUIDE.md](TESTING-GUIDE.md) for checking things work, [ADMIN-GUIDE.md](ADMIN-GUIDE.md) for the Association's volunteers.

---

## 1. What this system is, in one page

Two applications, one database.

| | |
|---|---|
| **sxccaa.org** | Public site and alumni directory. Connects as `sxc_web`. |
| **admin.sxccaa.org** | Admin portal. Separate deployment, separate origin. Connects as `sxc_admin`. |
| **Database** | PostgreSQL on Supabase. Confidential fields are AES-256-GCM ciphertext. |

**The one thing to understand before touching anything:** contact numbers and email addresses are encrypted with a key that lives in the host's environment, **not** in the database. Lose that key and every contact detail is gone permanently — no backup restores it, because the backup is ciphertext too. Keep `DATA_ENCRYPTION_KEYS` and `EMAIL_HMAC_PEPPER` in a password manager, and make sure at least two people can reach them.

Three tiers of access, enforced server-side:

- **Anyone** sees five fields per alumnus: name, batch year, stream, organisation, role.
- **Signed-in Xaverians** see the full profile, minus whatever its owner switched off.
- **Admins** see everything, from the portal only.

---

## 2. Deploying

Both apps are Next.js. Build and start:

```bash
cd oxvercity && npm ci && npm run build && npm run start
```

```bash
cd admin && npm ci && npm run build && npm run start
```

**Before the first deploy of a release:**

```bash
cd oxvercity && npm run launch:check
```

Run it with production environment variables loaded. It reads only.

### Environment

The full list is in each app's `.env.example`. The ones that will bite you:

| Variable | Gets it wrong how |
|---|---|
| `APP_URL` | Must exactly match the origin the browser uses, including scheme and port. A mismatch makes **every form on the site** return `Bad request.` — that is the same-origin check working, and it is the single most confusing failure in this project. |
| `USE_DEMO_ALUMNI` | Left `true`, the live site serves twelve invented people. The app refuses to start in production with it on. |
| `DATA_ENCRYPTION_KEYS` | Must be byte-identical in both apps. Different values means the portal cannot read a single thing the site wrote. |
| `WEB_DATABASE_URL` | Must be the `sxc_web` role. The app refuses to fall back to the owner in production. |

### After deploying

```bash
cd oxvercity && npm run harden:verify
```

Checks what the running server actually sends — CSP nonce matching the script tags, cache headers, robots. Two notes are expected against a dev server and not against a production build.

---

## 3. Loading or updating alumni data

The spreadsheet never leaves the operator's machine. The tool runs locally, encrypts locally, and pushes ciphertext.

```bash
cd oxvercity
npm run ingest -- private-data/alumni.xlsx --dry-run
```

Read the preview. Every phone number and address is masked, deliberately, even on your own screen. Then drop `--dry-run` and confirm in the browser page it opens on `127.0.0.1`.

**A re-import never overwrites a field an alumnus has edited themselves.** `owner_updated_at` protects those. A spreadsheet does not outrank a person's own correction.

**A re-import never restores revoked access.** If an admin took someone's access away, re-running the import leaves that decision alone.

---

## 4. Inviting the alumni

The last step of a launch, and the one that cannot be taken back.

```bash
cd oxvercity
npm run launch:check          # DMARC especially
npm run invite                # dry run — shows who would be emailed
npm run invite -- --send --limit 1   # one, to yourself, read it on a phone
npm run invite -- --send      # the rest, paced at 50/hour
```

**Do not skip the pacing.** A new sending domain that emits 500 messages in a minute lands in spam, and once Gmail has decided that, the sign-in links stop arriving too and the whole platform looks broken. Budget two days.

The run is **resumable**. `alumni.invited_at` is stamped after each successful send, one at a time. Stop it, close the laptop, run it again tomorrow — it picks up exactly where it stopped and will not email anyone twice.

Failures are left un-invited, so rerunning retries exactly those.

---

## 5. Routine tasks

### Add an administrator

From inside the portal: **Administrators → Invite an administrator**. Requires step-up (password + code). The invitee sets their own password and enrols their own authenticator; nothing exists until they finish.

There is no public sign-up page and there will never be one.

### The very first administrator

```bash
cd admin && npm run admin:create
```

Or, if the Supabase SQL editor is your only database access:

```bash
cd admin && npm run admin:sql
```

That prints a query to paste. It writes nothing itself.

### Remove an administrator

**Disable**, never delete. Audit rows and photo reviews reference the account, and an audit trail that loses the identity of who acted is worth much less. Disabling ends every session immediately.

### Someone wants off the directory

They can do it themselves at `/me` → *remove me from the directory*. One click, no approval. That is a legal requirement under the DPDP Act, not a courtesy.

If they email the Association instead: portal → **Alumni records** → find them → **Archive this record**.

### Someone's details are wrong

- **Name, batch year, stream, sign-in address** — admin only, in the portal.
- **Everything else** — they can change it themselves at `/me`.

---

## 6. When something is wrong

### "Nobody can sign in"

1. Is `RESEND_API_KEY` still valid? Check Resend's dashboard for bounces or a suspended domain.
2. Is the sending domain still verified? A DNS change can silently unverify it.
3. `npm run auth:verify` — exercises the whole flow against the live database.

The sign-in form deliberately says the same thing whether an address is registered or not, so "it says the link is on its way but nothing arrives" is what a *non-registered* address looks like too. Check the allowlist in the portal under **Access grants** before assuming a fault.

### "Every form says Bad request"

`APP_URL` does not match the origin the browser is using. Fix it and restart.

### "The site loads but nothing is clickable"

React has not hydrated. Almost always one of:

- A `Content-Security-Policy` change that broke the nonce. Run `npm run harden:verify` — it compares the header nonce to the one on the script tags.
- Someone ran `npm run build` while `npm run dev` was running. That corrupts `.next`. Fix: `rm -rf .next` and restart.

There is no console error for either. That is what makes them hard.

### "A profile page 404s"

Expected, if you are not signed in. A redirect to sign-in would confirm that alumnus exists, so it is a 404 instead. Also 404s for a withdrawn record, and the two are deliberately indistinguishable.

### A contact number will not decrypt

One row's ciphertext failing means that row was tampered with or written under a key you no longer hold. The field renders as "Not shared" and the error names the cell, never the value. *All* rows failing means `DATA_ENCRYPTION_KEYS` is wrong for this deployment — stop and fix the environment before anything else.

---

## 7. Rotating the encryption key

Do this once as a drill, before you ever need it.

The key ring format is `version:base64key`, highest version current. Mid-rotation it holds both:

```
DATA_ENCRYPTION_KEYS=2:<new>,1:<old>
```

1. Generate a new key: `npm run keys:generate`
2. Add it as version 2, **keeping version 1**. Deploy.
3. Everything still reads: each blob carries the version that wrote it in its first byte.
4. Re-encrypt: re-running the ingest import rewrites the fields it touches with the current key.
5. Once nothing references version 1, remove it and deploy.

**Removing the old key before every row is rewritten makes those rows unreadable for ever.** There is no recovery.

---

## 8. Backups

Supabase takes daily backups with point-in-time recovery. Confirm both are enabled in the project settings — they are not always on by default.

**The restore drill, to run once before launch:**

1. `pg_dump` the production database.
2. Restore into a scratch database.
3. Read the `alumni` table. `contact_enc` must be unreadable bytes.

That is the whole security claim, checked rather than asserted. `npm run restore:proof` checks the same property against the live database in seconds and is worth running whenever the crypto changes — but do the real dump once, because the claim being made is about the backup.

**A backup is not a key escrow.** Restoring a database without `DATA_ENCRYPTION_KEYS` gives you names and job titles and nothing else.

---

## 9. If there is a breach

### The database was copied

The contact details are ciphertext and the key is not in it. **Do not panic-announce a contact data breach** — check first what was actually exposed. Names, batch years, streams, organisations and roles are public by design and were already on the website.

1. Rotate `DATA_ENCRYPTION_KEYS` (§7) and `EMAIL_HMAC_PEPPER`.
2. Revoke every session: `update session set revoked_at = now(); update admin_session set revoked_at = now();`
3. Rotate the database role passwords with `npm run db:migrate`.
4. Assess: was the *key* also exposed? If the host's environment was reachable, assume yes and treat it as a full disclosure.

### An admin account was compromised

1. Portal → **Administrators** → **Disable**. Ends every session at once.
2. Read the **Audit log**, filtered by their actor id. Every grant, revocation and address reveal they made is there.
3. Reverse anything they changed. Grants they created are in **Access grants**, marked `admin_grant`.

### The encryption key leaked

Worst case. Assume every contact number and address is disclosed.

1. Rotate the key and re-encrypt (§7) — this protects future backups, not past ones.
2. Under the DPDP Act, notify the Data Protection Board and the affected alumni. That is a legal obligation with a clock on it, not a judgement call.
3. The alumni need to know specifically: their phone numbers and email addresses, not "some data".

---

## 10. Things that are deliberate and look like bugs

| | |
|---|---|
| Sign-in says the same thing for a real and a fake address | Otherwise the form tells anyone who is a Xaverian. |
| Profile pages 404 to signed-out visitors | A redirect would confirm the person exists. |
| A grant shows a hash and no address | The allowlist stores a one-way hash. Nobody can recover it, including us. |
| "That code has already been used" right after signing in | Each TOTP code works once. Wait for the next. |
| An uploaded photo does not appear | It is awaiting review in the portal. |
| Admins cannot be deleted | Disabled instead, so the audit trail keeps its identities. |
| An admin cannot change an alumnus's visibility switches | Those are the alumnus's decision. Overriding them would make the promise on `/me` untrue. |
| No password reset email for admins | A compromised admin mailbox would then be a full breach of the portal. Another super admin re-invites them. |

---

## 11. Commands

| Command | App | What it needs |
|---|---|---|
| `npm run launch:check` | oxvercity | database, DNS |
| `npm run db:migrate` | oxvercity | owner database URL |
| `npm run db:verify` | oxvercity | database |
| `npm run restore:proof` | oxvercity | database |
| `npm run auth:verify` | oxvercity | database, Resend |
| `npm run request:verify` | oxvercity | database, Resend |
| `npm run gate:verify` | oxvercity | database, running server, `USE_DEMO_ALUMNI=false` |
| `npm run harden:verify` | oxvercity | running server |
| `npm run scan:secrets` | oxvercity | nothing |
| `npm run ingest` | oxvercity | database, the spreadsheet |
| `npm run invite` | oxvercity | database, Resend |
| `npm run admin:create` | admin | database, a terminal, an authenticator |
| `npm run admin:sql` | admin | a terminal, an authenticator |
| `npm run admin:verify` | admin | database |
| `npm run seed:verify` | admin | database |
