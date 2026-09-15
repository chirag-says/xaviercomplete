# Implementation Plan — Alumni Access Control, Admin Portal & Data Security

**Project:** sxccaa.org (public) + admin.sxccaa.org (admin)
**Codebase:** `oxvercity/` — Next.js 15 (App Router), React 19, TypeScript
**Status:** Draft for approval. Nothing below is built yet.
**Revision 2 — 11 September 2026** (Revision 1: 10 September 2026)

### What changed in revision 2

The client added three requirements: alumni get their own profile page, they upload their own photograph from it, and they control the visibility of their contact number and Gmail from it. Admins get a real onboarding flow rather than a hand-seeded row.

| Change | Where |
|---|---|
| Alumni self-service profile — a verified alumnus edits their own record at `/me` | **§7** (new) |
| Photograph upload, processing and moderation pipeline | **§7.4–7.5** (new) |
| Three per-person visibility toggles: photo, contact number, Gmail | **§1.3** (new), §1.1, §2.1 |
| `hide_contact` becomes `show_contact`, plus `show_gmail` and `photo_audience` | §2.1 |
| Admin onboarding: local bootstrap CLI, then invitation-only | **§9.2** (new) |
| Honest amendment to the "no plaintext to the server" guarantee | §0.2, §7.3 |
| Sections 7–13 of revision 1 renumbered to 8–14 | throughout |

---

## 0. Two corrections to the brief, up front

### 0.1 Hashing destroys the data you need to display

Hashing is one-way by design. If the contact number and Gmail ID are hashed, no one can ever read them back — including the verified alumni who are supposed to see them. That kills the entire feature.

The correct split is **two different cryptographic tools for two different jobs**:

| Job | Tool | Why |
|---|---|---|
| Store contact number, Gmail, previous role, notes — **must be readable later** | **AES-256-GCM encryption**, key held outside the database | Reversible only with the key. DB dump alone is useless. |
| Match a login email against the allowlist — **never displayed, only compared** | **HMAC-SHA-256 with a secret pepper** (a "blind index") | One-way. Even with the DB, an attacker cannot recover the email list, and cannot test guesses without the pepper. |

So: your "hash it" instinct is exactly right for the login allowlist, and exactly wrong for the profile fields. The plan uses both.

### 0.2 What "nothing goes to the server" can and cannot mean

Once the site is hosted and a logged-in alumnus in another city loads a profile, the contact detail must travel from storage → server → their browser. That is unavoidable; it is the feature.

Here is the strongest guarantee that is actually achievable, and I will hold the build to it:

| Guarantee | Achievable? |
|---|---|
| The plaintext Excel never leaves your machine | **Yes** — enforced by the ingest tool design (§4) |
| No plaintext PII is ever *stored* by the DB provider | **Yes** — the database holds ciphertext only |
| The bulk dataset is never transmitted in plaintext | **Yes** — encryption happens on your laptop, before upload |
| A stolen DB dump / provider breach / stolen backup reveals zero contact details | **Yes** — ciphertext only, keys never in the DB |
| A Supabase employee can read a phone number | **No, they cannot** |
| Anonymous website visitors can obtain any private field | **No** — private fields are never sent to their browser at all (§5.3) |
| An alumnus editing *their own* number never transmits it to our server | **No — and this is new in revision 2.** Self-service editing means one person's own field crosses TLS to our server, is encrypted in RAM and written as ciphertext. It is never logged and never written to disk in plaintext. See §7.3. |
| A full compromise of the *running application server* (remote code execution + environment access) could decrypt data | **This remains possible.** See §10.6 for mitigations. Anyone who tells you otherwise is selling something. |

The residual risk in the last row is the honest floor for any system that displays data to remote users. Everything in §10 is aimed at making it as small as it can be.

---

## 1. Who sees what — the access model

Three tiers. This is the spine of the whole system.

### Tier 0 — Anonymous visitor (anyone on the internet)

- Can browse the alumni directory grid.
- Sees **five fields per card only**: Full name · Batch year · Stream of study · Current organisation · Designation/Role — plus the alumnus's **photograph, if they uploaded one and set it to public** (§1.3). Everyone else keeps the existing fallback avatar, so the grid never looks broken.
- **No hover overlay.** The card is not a link. There is no click target.
- `/alumni/<id>` returns **404** for them. Not a redirect, not a login wall — a 404, so the existence of individual profiles is not even confirmed.
- Sees a "Sign in to view full profiles" prompt and a link to request access.

### Tier 1 — Verified alumnus (email on the allowlist, logged in via magic link)

- Everything in Tier 0, plus:
- **Hover overlay appears** on cards, with a "View full profile" call to action.
- `/alumni/<id>` renders the complete record — subject to that person's own toggles: stream of study, previous organisation/role, contact number (if `show_contact`), Gmail ID (if `show_gmail`), additional info.
- **`/me` — their own profile.** Upload or remove a photograph, flip the three visibility toggles, correct their own employment details (§7).
- Subject to a **view budget** (§10.4) — one person cannot quietly harvest all 500 records.

### Tier 2 — Admin (admin.sxccaa.org, separate origin, password + TOTP)

- Everything above, plus:
- Review and approve/reject access requests → granting access adds an email to the allowlist.
- Revoke access for any email; force-logout any session.
- View, edit, archive alumni records. **Toggles never hide anything from the admin** — they are the data controller and need the full record to do their job.
- Moderate uploaded photographs (§7.5).
- Read the audit log.
- Export (logged, requires step-up re-authentication).
- Onboard further admins by invitation (§9.2).
- Cannot see raw passwords or session tokens — those are not stored in a recoverable form anywhere.

### 1.1 Field-by-field visibility matrix

Mapped directly to your Excel headings, plus the photograph (which is not an Excel column — it only ever arrives from the alumnus).

| # | Field | Anonymous | Verified alumnus | Admin | Storage at rest |
|---|---|:---:|:---:|:---:|---|
| 1 | Timestamp | ✗ | ✗ | ✓ | Plaintext (not personal) |
| 2 | Email Address *(form respondent)* | ✗ | ✗ | ✓ | **Encrypted** + HMAC index |
| 3 | Full name | **✓** | ✓ | ✓ | Plaintext (public by design) |
| 4 | Batch / Year of passing | **✓** | ✓ | ✓ | Plaintext |
| 5 | Stream of study | **✓** | ✓ | ✓ | Plaintext |
| 6 | Current organisation | **✓** | ✓ | ✓ | Plaintext |
| 7 | Designation and Role | **✓** | ✓ | ✓ | Plaintext |
| 8 | Previous organisation / role | ✗ | **✓** | ✓ | Plaintext |
| 9 | Contact number | ✗ | **✓ if `show_contact`** | ✓ | **Encrypted** |
| 10 | Gmail ID *(database access)* | ✗ | **✓ if `show_gmail`** | ✓ | **Encrypted** + HMAC index |
| 11 | Any other info | ✗ | **✓** | ✓ | **Encrypted** (free text — may contain anything) |
| — | **Photograph** | **✓ if uploaded, approved and `photo_audience='public'`** | **✓ if uploaded and approved** | ✓ | Object storage, random key, metadata stripped (§7.4) |

**Notes on this matrix:**

- **Column 5 (Stream) is public** — decided 10 Sep 2026. It carries no privacy risk and gives the grid useful context, so the card shows five fields rather than four.
- **Column 11 is encrypted** even though it looks innocuous. It is a free-text field where people write whatever they like — health details, family information, personal interests. Free-text fields are where PII hides. Encrypt by default.
- **Column 9 respects "NA".** Rows where the alumnus wrote NA store nothing; the profile shows "Not shared" and `show_contact` starts OFF.
- **Column 10 is the login key.** Your form says "only Gmail ID for accessing the database" — so the allowlist is built from column 10, falling back to column 2 where 10 is blank. Note the split: turning `show_gmail` off hides the address from other alumni; it does **not** affect login, because login matches the HMAC in `access_grant`, not the displayed field.
- **The photograph is the only field the alumnus creates.** Everything else came from the Google Form. That makes it the only untrusted input the system accepts from the internet, which is why §7.4 is as long as it is.

### 1.2 The risk in showing Gmail IDs to all verified alumni

Worth naming: once 500 people can log in, 500 people can read 500 email addresses. One compromised alumni mailbox exposes the lot. This is inherent to what you asked for, and it is a reasonable trade — that is the point of the directory. The controls that make it acceptable:

- View budget and rate limiting per session (§10.4).
- Every private-field view is written to the audit log with the viewer's identity — so a harvester is identifiable after the fact.
- **Per-person opt-out on both the number and the email** (§1.3) — anyone uncomfortable with this can switch themselves out in ten seconds without leaving the directory.
- Admin can revoke any email's access instantly.

### 1.3 The three visibility toggles

One alumnus may be happy to appear in the directory and still not want their mobile number on it. They should not have to disappear to achieve that. Three switches on `/me`, worded as the alumnus reads them:

| Toggle on `/me` | Field | Default | Effect when ON |
|---|---|---|---|
| **Show my photograph** — *Everyone / Verified alumni only* | photograph | Public, once a photo is uploaded and approved | Photo replaces the fallback avatar on the card and profile |
| **Show my contact number to verified alumni** | column 9 | **ON if a number was supplied on the form, OFF if blank or "NA"** | Number appears on the full profile. Never public, at any setting. |
| **Show my Gmail to verified alumni** | column 10 | **ON** | Address appears on the full profile. Never public, at any setting. |

The rules behind them:

- **Defaults come from what the person actually supplied on the consent form, never from an assumption.** They gave a number under a form that disclosed alumni-visible use, so ON is the honest default; they left it blank, so OFF is the honest default. The same logic makes Gmail default ON — column 10 exists precisely so other alumni can reach them.
- **OFF means the field is not serialised into the response at all.** Not hidden with CSS, not greyed out, not fetched-then-filtered. Same rule as §5.1, enforced the same way. The profile renders "Not shared".
- **A toggle never affects admin visibility** and never removes anyone from the directory.
- **Every flip is audit-logged** — field name and new value, no PII.
- **The invitation email links straight to `/me` and names all three toggles**, so nobody discovers their number was visible by accident. This matters legally as much as practically (§11).
- Public is never an option for the number or the email. The only field with a public setting is the photograph, because that is what the client asked for and what the card design expects.

---

## 2. Database recommendation

### Use PostgreSQL, hosted on Supabase.

**Why Postgres over MongoDB, for this specific system:**

1. Your data is a **fixed, flat, relational schema** — 11 known columns, ~500 rows, changing once a year. This is a spreadsheet. Mongo's flexible-document advantage is worth nothing here.
2. The parts that actually get busy — access grants, sessions, access requests, audit log — are **inherently relational** (a grant belongs to a request; an audit entry belongs to an actor and a target). Foreign keys and transactions matter.
3. **Real constraints.** `NOT NULL`, `UNIQUE` on the email HMAC, `CHECK` on enums. Postgres refuses to store a malformed record. Mongo will happily accept one.
4. **Row Level Security** as a second line of defence — deny-all by default, so even a leaked key opens nothing.
5. Mature **point-in-time recovery** and automated backups. Since the DB holds only ciphertext, the backups are safe by construction.

**Why Supabase specifically:** managed Postgres, daily backups + PITR, sane connection pooling, generous free tier, object storage for the photographs in the same project, and it is Postgres — so if you ever want to leave, it is a `pg_dump` away. No lock-in.

### Critical Supabase rules for this build

- **Do not use Supabase Auth for alumni login.** It stores email addresses in plaintext in `auth.users`. That breaks your requirement directly. We implement our own passwordless login against the HMAC allowlist (§6).
- **Never ship the Supabase anon key to the browser.** No client-side database access anywhere in the app, and no client-side uploads to Supabase Storage. Every read and every upload goes through our own Next.js server routes, which apply the tier check first.
- **Service-role key lives only in server environment variables**, never in any file that reaches the client bundle.
- **RLS enabled on every table, with one permissive policy naming only our three roles** — so `anon`, `authenticated`, `public` and anything added later match nothing and get nothing. A leaked Supabase anon key stays inert.
  - *Corrected 11 Sep 2026, found by `npm run db:verify` against the live database.* The original wording here was "deny-all with no policies", which assumed access arrives over PostgREST. It does not — we connect directly as `sxc_web`/`sxc_admin`/`sxc_ingest`, none of which owns the tables, so deny-all denied **our own application**. Inserts failed loudly; updates and selects failed *silently, matching zero rows*, which is the dangerous half: the site would have rendered an empty directory and reported every profile save as saved. Fixed in migration `0005_rls_policies.sql`. The table and column grants in `0002` remain the real access control.
- **Storage buckets are private by default.** Exactly one bucket is public-read (approved public photographs) and it contains nothing else.

### 2.1 Schema

```
alumni
  id                  text PK          -- opaque random 12-char, NOT derived from name
  full_name           text             -- public
  batch_year          int              -- public
  stream              text             -- verified
  current_org         text             -- public
  designation         text             -- public
  previous_role       text             -- verified
  contact_enc         bytea NULL       -- AES-256-GCM
  gmail_enc           bytea NULL       -- AES-256-GCM
  gmail_hmac          bytea UNIQUE     -- blind index, links record to login identity
  form_email_enc      bytea NULL       -- AES-256-GCM (admin only)
  other_info_enc      bytea NULL       -- AES-256-GCM

  -- visibility, owned by the alumnus (§1.3)
  show_contact        bool  DEFAULT false  -- set at import from the form response
  show_gmail          bool  DEFAULT true
  photo_audience      text  DEFAULT 'public'   -- 'public' | 'alumni'

  -- photograph (§7.4)
  photo_path          text NULL        -- random object key; contains no name and no id
  photo_status        text DEFAULT 'none'      -- 'none'|'pending'|'approved'|'rejected'
  photo_updated_at    timestamptz NULL
  photo_reviewed_by   uuid NULL -> admin_user

  is_visible          bool  DEFAULT true   -- soft-delete / full opt-out
  consent_recorded_at timestamptz
  submitted_at        timestamptz      -- the form Timestamp column
  owner_updated_at    timestamptz NULL -- last self-service edit; concurrency check
  key_version         smallint         -- supports key rotation
  created_at, updated_at

access_grant                          -- the login allowlist
  id            uuid PK
  email_hmac    bytea UNIQUE          -- the ONLY representation of the email
  source        text                  -- 'import' | 'admin_grant'
  granted_by    uuid NULL -> admin_user
  granted_at    timestamptz
  revoked_at    timestamptz NULL
  note          text NULL             -- admin's reason, no PII

login_token                           -- magic links
  id            uuid PK
  token_hash    bytea UNIQUE          -- SHA-256 of the token; raw token never stored
  email_hmac    bytea
  expires_at    timestamptz           -- +10 minutes
  consumed_at   timestamptz NULL      -- single use
  request_ip_hash bytea

session
  id            uuid PK
  token_hash    bytea UNIQUE
  email_hmac    bytea
  created_at, last_seen_at, expires_at
  revoked_at    timestamptz NULL
  ua_hash       bytea

access_request                        -- from the public contact page
  id            uuid PK
  email_enc     bytea                 -- so admin can see who asked
  email_hmac    bytea
  name          text
  batch_year    int NULL
  reason        text
  email_verified_at timestamptz NULL  -- OTP confirmed
  status        text                  -- 'pending'|'approved'|'rejected'
  decided_by    uuid NULL, decided_at timestamptz NULL
  created_at, request_ip_hash

admin_user
  id uuid PK, email_enc bytea, email_hmac bytea UNIQUE
  password_hash text                  -- Argon2id
  totp_secret_enc bytea               -- encrypted, mandatory
  totp_confirmed_at timestamptz NULL  -- account unusable until this is set
  status text                         -- 'invited'|'active'|'disabled'
  role text                           -- 'super_admin'|'moderator'
  failed_attempts int, locked_until timestamptz NULL
  created_at, last_login_at

admin_invite                          -- §9.2; the only way to create admin #2 onwards
  id uuid PK
  email_enc bytea, email_hmac bytea
  token_hash bytea UNIQUE             -- SHA-256; raw token exists only in the email
  invited_by uuid -> admin_user
  role text
  expires_at timestamptz              -- +24 hours
  consumed_at timestamptz NULL
  created_at

admin_recovery_code
  id uuid PK, admin_id uuid -> admin_user
  code_hash text                      -- Argon2id; shown once at onboarding, never again
  used_at timestamptz NULL

audit_log
  id bigserial PK
  at timestamptz, actor_type text, actor_id text
  action text, target_type text, target_id text
  ip_hash bytea, meta jsonb           -- NEVER contains PII
```

**Note on `audit_log.meta`:** no plaintext PII, ever. Log `alumni_id`, not the person's name or number. An audit log that leaks the data it is protecting is worse than no audit log. A toggle flip logs `{field: "show_contact", to: false}` — the field name and the boolean, nothing else.

**Note on `show_contact` replacing `hide_contact`:** same feature, positive naming. Every place it is read — the UI label, the API, the database column — now says the same thing in the same direction, so no one has to reason about a double negative while writing security-relevant code. `if (show_contact)` is harder to get backwards than `if (!hide_contact)`.

---

## 3. Encryption design

### 3.1 Algorithm and format

**AES-256-GCM**, one random 96-bit nonce per field per record, authenticated.

Stored blob layout:

```
[ 1 byte key_version ][ 12 bytes nonce ][ ciphertext ][ 16 bytes auth tag ]
```

### 3.2 Additional Authenticated Data — the important detail

Every encryption call binds **`alumni_id + ":" + field_name`** as AAD. This means ciphertext is cryptographically welded to its row and column. If an attacker with write access to the database copies Alice's `contact_enc` into Bob's row, decryption **fails loudly** rather than silently showing Alice's number on Bob's profile. Most implementations skip this. We will not.

This applies identically to self-service edits (§7.2): when an alumnus saves a new number, the re-encryption rebuilds the AAD from their own record id, so a tampered request cannot write ciphertext into someone else's row.

### 3.3 Keys

| Secret | Purpose | Lives where |
|---|---|---|
| `DATA_ENCRYPTION_KEY` | AES-256-GCM, 32 bytes | Server env var / hosting secret store. **Never in the DB, never in git.** |
| `EMAIL_HMAC_PEPPER` | HMAC-SHA-256 blind index, 32 bytes | Same. **Different key from the above.** |
| `SESSION_SECRET` | Session token signing | Same. |

- Generated on your machine with `crypto.randomBytes(32)`, stored in a password manager, and set as secrets in the host.
- **The `key_version` byte enables rotation without downtime:** deploy the new key alongside the old, decrypt with whichever version the row declares, re-encrypt rows in the background, retire the old key. Document a rotation drill; run it once before launch so you know it works.
- `.env*` is added to `.gitignore` and verified with a pre-commit secret scan (§10.7).

### 3.4 Email normalisation before HMAC — subtle and essential

Gmail treats `firstname.lastname@gmail.com`, `firstnamelastname@gmail.com` and `firstname.lastname+alumni@gmail.com` as the **same mailbox**. If we HMAC the raw string, an alumnus who types their address with dots when the sheet has it without dots will be locked out, and complain that the system is broken.

Normalisation, applied identically at import and at login:

1. Trim, lowercase.
2. If the domain is `gmail.com` or `googlemail.com`: strip everything after `+` in the local part, remove all `.` from the local part, force domain to `gmail.com`.
3. HMAC-SHA-256 the result with the pepper.

This must be a single shared function used by both the ingest tool and the login route. Unit-tested with the ambiguous cases.

---

## 4. The Excel drop — local ingest tool

**Design rule: this tool is not part of the deployed website.** It lives in `tools/ingest/`, outside the Next.js `src/app` tree, and is not part of the production build. It is impossible to reach it over the internet because it is not there.

### 4.1 How you will use it

```bash
npm run ingest
```

Starts a local server bound to **127.0.0.1 only** (not `0.0.0.0` — it is unreachable from your network, let alone the internet) and opens a page in your browser.

### 4.2 The flow

1. **Drop the `.xlsx`** onto the drop zone. The file is read from disk by the local Node process. It is never copied, never uploaded, never cached.
2. **Parse & validate** — every row checked against a strict schema. Batch year must be a plausible 4-digit year; phone normalised or marked NA; Gmail must be a valid address.
3. **Dry-run preview** showing:
   - Rows valid / rows rejected, with per-row error reasons.
   - Duplicates detected (by normalised Gmail).
   - New vs. updated vs. unchanged records.
   - **All PII masked in the preview** — `+91 ••••• ••234`, `r•••••@gmail.com`. Even on your own screen. Shoulder-surfing and screenshots are real.
4. **Confirm.** Only then does it encrypt (on your laptop) and push **ciphertext** to Postgres over TLS 1.3.
5. **Set the toggle defaults** from the form response, per §1.3: `show_contact = true` where a usable number was supplied, `false` where the cell was blank or "NA"; `show_gmail = true`. Recorded once at import and owned by the alumnus from then on — a later re-import **never overwrites a toggle the alumnus has touched** (`owner_updated_at IS NOT NULL` protects it).
6. **Allowlist build.** Every imported Gmail is normalised → HMAC → inserted into `access_grant` with `source='import'`. The plaintext email exists in RAM for milliseconds and is never written anywhere.
7. **Invitation emails.** Optional final step, run from your machine: sends the "you have been granted alumni access" email to all 500. The email links to `/me` and names the three toggles (§1.3). **Batched at ~50/hour over a warmed domain** — blasting 500 emails from a new domain lands you in spam and can get the domain flagged. Budget two days for this.
8. **Report** written to `tools/ingest/reports/` (counts and errors only, no PII) — gitignored.

### 4.3 Handling the source file

- `private-data/` at the repo root, added to `.gitignore` **and** `.git/info/exclude`.
- The ingest tool refuses to run if it detects the file inside a git-tracked path.
- **My recommendations for you personally:** keep the Excel in an encrypted volume (VeraCrypt, or your OS's full-disk encryption at minimum); do not keep it in Downloads; do not keep it in a synced cloud folder — Dropbox/Drive sync means a copy on someone else's server, which undoes the entire design.
- Library: **`exceljs`**, not SheetJS. SheetJS's free distribution has a history of prototype-pollution CVEs and awkward npm distribution.

### 4.4 Why not upload the Excel through the admin portal?

Because that puts a plaintext spreadsheet of 500 people's phone numbers through an internet-facing HTTP endpoint, into server memory, probably onto server disk in a temp file, and into logs. It is the single largest hole you could cut in this design. The admin portal will let the admin **edit individual records** (which happens through the encrypted path), but bulk import stays local. This is exactly the right call and it was yours.

---

## 5. Enforcing the tiers in the application

### 5.1 The one rule that matters

> **Private fields must never be present in the HTML or JSON sent to an unauthorised browser.**

Not hidden with CSS. Not `display:none`. Not rendered and covered. Not fetched-then-filtered on the client. **Not serialised into the response at all.** Anyone can press Ctrl+U or open the Network tab. This is the mistake that breaks systems like this one, and every review below checks for it.

The visibility toggles (§1.3) are bound by the same rule. `show_contact = false` must mean the number is absent from the JSON, not present and unrendered.

### 5.2 Type-level enforcement

Three distinct TypeScript types, so a mistake is a compile error rather than a data breach:

```ts
type PublicAlumnus  = { id, fullName, batchYear, stream, currentOrg, designation, photoUrl? }
type PrivateAlumnus = PublicAlumnus & { previousRole, contact?, gmail?, otherInfo? }
type OwnAlumnus     = PrivateAlumnus & { showContact, showGmail, photoAudience, photoStatus }
```

Note the `?` on `contact` and `gmail` in `PrivateAlumnus`: the toggles make them genuinely optional, so every consumer is forced by the compiler to handle "not shared" rather than assuming a string is there.

A single data-access module is the *only* place that can produce `PrivateAlumnus` or `OwnAlumnus`, and its function signatures demand a verified session object — `OwnAlumnus` additionally demands that the session's `email_hmac` matches the record's. There is no code path from an anonymous request to a private field, and no code path from one alumnus's session to another alumnus's `OwnAlumnus`. An ESLint rule bans importing the private module from any client component.

### 5.3 Route behaviour

| Route | Anonymous | Verified | Notes |
|---|---|---|---|
| `/alumni` | Grid, 5 public fields + public photos, cards not clickable, no overlay markup in the DOM | Grid, cards linked, overlay present, all approved photos | |
| `/alumni/<id>` | **404** | Full profile, toggles respected | |
| `/api/alumni/<id>` | **404** | JSON, permitted private fields only | |
| `/me` | Redirect to `/login` | Own profile editor | Redirect, not 404 — it reveals nothing about anyone |
| `/api/me`, `/api/me/photo` | **401** | Read/write own record only | Record resolved from the session, never from the request body |
| `/api/photo/<id>` | **404** unless the photo is public | Streams alumni-only photos after a session check | `Cache-Control: private, no-store` |
| `/login` | Email form | Redirect to `/alumni` | |

- Profile routes and `/me` are **`dynamic = 'force-dynamic'`**, no `generateStaticParams`, and send `Cache-Control: private, no-store`. A statically generated or CDN-cached profile page is a public profile page, whatever the auth code says.
- `X-Robots-Tag: noindex, nofollow` on all profile routes and `/me`; `robots.txt` disallows `/alumni/*` and `/me`; sitemap excludes them.
- Alumni IDs are **opaque random strings**, not `firstname-lastname`. Prevents enumeration and stops URLs leaking identity when shared.
- **Photo object keys are separately random** and unrelated to the alumnus id (§7.4), so a public photo URL cannot be turned into a profile URL.

### 5.4 Files that change

| File | Change |
|---|---|
| `src/data/alumni.ts` | Replaced by DB-backed loader; demo data retained behind a flag for local dev |
| `src/components/alumni/AlumniCard.tsx` | Takes `PublicAlumnus` + `isVerified`; renders `<a>` + overlay only when verified, `<div>` otherwise. **The photo needs no markup change** — the card already renders `person.photo` with `/svg/alumni-avatar.svg` as the fallback, so an uploaded photograph drops straight into the existing design |
| `src/components/alumni/AlumniProfileView.tsx` | Takes `PrivateAlumnus`; new sections for contact, previous role, other info; renders "Not shared" where a toggle is off |
| `src/app/alumni/[slug]/page.tsx` | Session check → `notFound()` for anonymous; dynamic rendering |
| `src/app/alumni/page.tsx` | Passes session state down; adds sign-in prompt |
| `src/app/contact/page.tsx` | Adds the access-request form |
| `src/app/me/page.tsx` | **New** — the alumnus's own profile (§7) |
| `src/components/alumni/ProfileEditor.tsx`, `PhotoUploader.tsx`, `VisibilityToggles.tsx` | **New** — styled with the existing `alumni.css` vocabulary |
| `src/app/api/me/`, `src/app/api/photo/[id]/` | **New** |
| `src/lib/photo.ts` | **New** — magic-byte sniff, dimension probe, re-encode, metadata strip |
| `src/middleware.ts` | **New** — security headers, session cookie read, rate limiting |
| `next.config.ts` | Security headers, `poweredByHeader: false`, `images.remotePatterns` limited to the storage host |
| `tools/ingest/`, `tools/admin/`, `tools/keys/` | **New** — local ingest tool, local admin bootstrap CLI (§9.2), secret generator |
| `src/lib/core/` | **New** — `crypto.ts`, `keys.ts`, `hmac.ts`, `email.ts`, `phone.ts`, `ids.ts`. Grouped under `core/` rather than loose in `lib/` because this is the code that moves to `packages/core/` at §9.1, and because it must stay free of Next imports: the ingest tool and the admin CLI load it under plain Node |
| `src/lib/session.ts`, `db.ts`, `rate-limit.ts` | **New** — these depend on the runtime, so they stay outside `core/` |
| `db/migrations/` | **New** — `0001_schema.sql`, `0002_roles.sql`. Plain SQL, applied by hand; two schema changes a year does not justify a migration framework |
| `tests/` | **New** — `node --test`, no test-runner dependency |
| `src/app/(auth)/login/`, `src/app/api/auth/` | **New** |

**The visual design is untouched.** Cards keep the same markup and CSS classes; the anonymous variant renders a `<div>` where a verified user gets an `<a>`. The hover overlay CSS in `src/styles/alumni.css` is reused as-is for verified users. `/me` is built from the same type scale, spacing and button styles as the rest of the site — a new page, not a new look.

---

## 6. Alumni login — passwordless magic link

No passwords for alumni. 500 people who log in twice a year will forget a password, reuse one from elsewhere, and generate support requests. Magic links remove the entire password attack surface: nothing to breach, stuff, phish for, or reset.

### 6.1 Flow

1. User visits `/login`, enters their email, passes a Cloudflare Turnstile challenge.
2. Server normalises (§3.4) → HMAC → looks up `access_grant` where `revoked_at IS NULL`.
3. **The response is identical either way**: *"If that address is registered with the Association, a sign-in link is on its way."* Same text, same HTTP status, and a constant-time delay so response timing does not leak membership. Without this, anyone can test whether a given person is a Xaverian alumnus — an information leak in itself.
4. On a match: 32 random bytes → the link; **only the SHA-256 of it** is stored. 10-minute expiry, single use.
5. Clicking creates a session: cookie named `__Host-sxc_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, **no `Domain` attribute** — the `__Host-` prefix forbids it, which is what keeps this cookie away from `admin.sxccaa.org`.
6. Session: 7-day absolute expiry, 24-hour idle timeout, rolling refresh. Only the hash of the session token is stored, so a DB leak yields no usable sessions.
7. Logout revokes server-side. "Sign out everywhere" available.

### 6.2 Someone tries to log in with a random email

Step 3 returns the neutral message. No email is sent. The attempt is rate-limited and logged (IP hash only). They can do nothing further. This is the exact scenario you described, and it is closed by construction — an unregistered address has no row in `access_grant`, so no token is ever minted.

### 6.3 Rate limits

| Action | Limit |
|---|---|
| Magic link per email | 3 / hour, 5 / day |
| **Access request per email** | **3 / day** |
| **OTP verification per IP** | **20 / hour** (plus 5 attempts per request, on the row) |
| Magic link per IP | 10 / hour |
| Failed token redemption per IP | 10 / hour, then 1-hour block |
| Access request per IP | 3 / day |
| Profile views per session | 60 / hour, 200 / day (§10.4) |
| **Profile save per session** | **20 / hour** |
| **Photo upload per alumnus** | **5 / day** |
| **Private photo fetch per session** | **200 / hour** |

Implemented as a Postgres token bucket (one less service to run and secure). Upstash Redis is the upgrade path if traffic ever justifies it.

---

## 7. The alumnus's own profile — `/me`

New in revision 2. A verified alumnus signs in and lands on a page about themselves: their photograph, their details, and the three switches that decide what other people see. This is also the mechanism that makes the consent promises in §11 real — a right to withdraw that requires emailing the Association is a right on paper; a toggle is a right in practice.

### 7.1 What the alumnus controls

| Field | Owner can edit | Why |
|---|---|---|
| Photograph (upload / replace / remove) | **Yes** | It is theirs; nobody else has it |
| Photo audience — everyone / verified alumni | **Yes** | §1.3 |
| Show contact number | **Yes** | §1.3 |
| Show Gmail | **Yes** | §1.3 |
| Contact number | **Yes** | Self-asserted already; it came from their own form response |
| Current organisation, Designation/Role | **Yes** | The fields most likely to go stale, and the least sensitive to get wrong |
| Previous organisation / role | **Yes** | Same |
| Any other info | **Yes** | Their own free text |
| Remove me from the directory | **Yes** | Sets `is_visible = false` and revokes the grant. DPDP §11. Confirmed twice, reversible by the admin |
| **Full name, batch year, stream** | **No** — request a correction, admin edits | These are the identity fields. They are what makes the directory trustworthy, and they are what an admin matches an access request against. A free-text name field on a public page under the Association's name is also an obvious vandalism target |
| **Gmail ID (the login identity)** | **No** — admin only | Changing it rewrites the allowlist entry. An attacker with a hijacked session could point the account at their own mailbox and own it permanently. Locking this removes an entire class of account-takeover, at the cost of one admin email a year |
| Anything belonging to another alumnus | **No** | The record is resolved from the session, never from the request |

Fields the owner edits are marked `owner_updated_at`, which protects them from being overwritten by a later Excel re-import (§4.2 step 5).

### 7.2 How a save is handled

1. Session check → resolve the alumni record **from the session's `email_hmac`**. The request body never carries an id. There is no id to tamper with, so there is no IDOR.
2. CSRF: double-submit token plus an `Origin` check, on every POST (§10.2).
3. Zod schema on every field — phone normalised to E.164 or rejected, free text length-capped, toggles strictly boolean, enums checked.
4. Optimistic concurrency: the form carries the `updated_at` it was rendered with. If an admin edited the record meanwhile, the save is rejected with "this record changed while you were editing" rather than silently clobbering the admin's correction.
5. Confidential fields are re-encrypted with AAD rebuilt from the record's own id (§3.2) and written as ciphertext in the same transaction as the toggles.
6. Audit: `profile_updated` with the list of field *names* changed. Never the values.
7. The page re-renders with a plain confirmation of what is now visible to whom — "Your number is visible to verified alumni" / "Your number is hidden" — because a toggle whose effect you cannot see is a toggle people get wrong.

### 7.3 The honest amendment to §0.2

Self-service editing means an alumnus's browser sends their own phone number, in plaintext, over TLS, to our server. There is no way around that: they are typing it into a form on the internet.

What survives intact, and what I will hold the build to:

- **The bulk dataset still never leaves your laptop in plaintext.** The Excel path is unchanged (§4).
- **Nothing is stored in plaintext.** The value lives in server memory for a few milliseconds and is written as ciphertext.
- **It never reaches a log, an error report, an analytics event or a URL** (§10.3), and request bodies are excluded from Sentry.
- **The exposure is one person's own field, sent by that person.** It is not a set of 500 records, and it is not someone else's data.

That is a materially smaller exposure than a bulk upload, and it is the unavoidable cost of letting people manage their own data. It is worth paying. I am flagging it rather than letting the earlier wording quietly become untrue.

### 7.4 Photograph upload — the pipeline

This is the only place the system accepts a file from the internet, so it gets the most paranoid treatment in the plan. Steps run **server-side, in this order**; anything the browser does is convenience, never a control.

**In the browser (convenience only):**
- Accept `image/jpeg`, `image/png`, `image/webp`; 5 MB cap; downscale to ≤2000px before upload. Live preview with a square/portrait crop matching the card's 3:4.
- The server assumes every one of these was bypassed.

**On the server, before anything is trusted:**

1. **Session and ownership check** — target record comes from the session.
2. **Rate limit** — 5 uploads per alumnus per day.
3. **Hard size stop at 5 MB**, enforced on the stream, before the body is buffered. A 2 GB upload must die at 5 MB, not after.
4. **Magic-byte sniff** (`file-type`) — the real format is read from the file's first bytes. The `Content-Type` header and the filename extension are both attacker-controlled and are ignored entirely. `shell.php.jpg` never gets the chance to be interesting.
5. **Dimension probe before decode** — reject anything over 8000px on either axis. A 64000×64000 PNG is 200 KB on disk and several gigabytes decoded; this is how image uploads take servers down.
6. **Re-encode with `sharp`** to an 800×1067 WebP plus a 400×533 JPEG fallback. **This is the actual defence.** Re-encoding throws away every byte that is not pixel data, which destroys polyglot files, appended archives, embedded scripts and malformed-chunk exploits in one step. The original bytes are never stored and never written to a temp path.
7. **Strip all metadata.** `sharp` drops EXIF unless explicitly asked to keep it, and we never ask. This is the least obvious and most serious leak in the whole feature: a photo taken on a phone carries the GPS coordinates of where it was taken, which for a profile picture is very often the person's home. Publishing 500 of those would be worse than publishing the phone numbers.
8. **Store** the processed bytes, keyed by 22 random characters that contain no name and no alumni id, so a leaked reference identifies nothing and cannot be walked back to a profile.
   - *Changed in build, 11 Sep 2026: the bytes live in Postgres (`alumni_photo`), not Supabase Storage.* Three reasons. The storage API needs the **service-role key**, which bypasses RLS and every least-privilege grant in `0002` — this project connects as `sxc_web`/`sxc_admin` precisely so a bug in the public app cannot rewrite the allowlist, and reintroducing that credential to upload an avatar gives the power back. A public-read bucket is a **silent, total** misconfiguration waiting to happen. And 500 photographs of WebP is roughly 30 MB, comfortably inside a database that is already backed up, already access-controlled and already restore-tested. **Every photograph, public or not, is served by `/api/photo/<alumni-id>`**, which applies the same `photoUrlFor` rules the card and the profile use — one access-control story instead of two. Public ones get `Cache-Control: public, max-age=3600`; alumni-only ones get `private, no-store`. If the directory ever outgrows this, the table becomes a pointer and nothing else changes.
9. **Replace deletes.** A new upload writes a new random key and deletes the old object, so old URLs die immediately — the thing people assume happens when they change a profile picture, and usually does not.
10. **Remove** is one button: deletes the object, clears the columns, card reverts to the fallback avatar. Erasure under DPDP covers photographs (§11).

Serving: `next.config.ts` `images.remotePatterns` is restricted to the storage host, and CSP `img-src` lists `'self'` plus that host and nothing else (§10.1) — so even a successful injection cannot point an `<img>` at an attacker's server to beacon out.

### 7.5 Moderation — photographs are public content on the Association's site

An unreviewed image on a page carrying St Xavier's name is a reputational risk that no amount of encryption addresses. Three things can go wrong: someone uploads something obscene, someone uploads a photograph of a person who is not them, or someone uploads a screenshot of text as a way of publishing a message.

**Recommended:** an uploaded photo lands `pending`. The owner sees it immediately on `/me`, marked "awaiting review — your card still shows the default avatar". The admin dashboard shows a count and a queue; approving is one click and typically same-day. Rejection uses a fixed reason list (not a photograph of a person · not you · unsuitable for a public directory · too low quality to display) and sends a neutral email inviting a replacement. The alumnus is never blocked from re-uploading.

This is a deliberate, small departure from "directly reflected" and it is **decision 8 in §13** — if the Association would rather photos went live instantly, flip one config value and keep the same queue for after-the-fact review. My recommendation is to review first: the cost is a day's delay, and the cost of the alternative is a bad image sitting on the public site for however long it takes someone to notice.

Either way the admin can remove an approved photo at any time, and every review action is audit-logged with the reviewing admin's id.

### 7.6 What self-service does *not* open up

- **No self-registration.** `/me` is reachable only with a session, and a session exists only for an email already on the allowlist. Someone with no grant cannot create a record, cannot upload a photo, and cannot reach any of it (§14).
- **No editing anyone else.** The record is derived from the session. There is no endpoint that takes an alumni id from the client and writes to it.
- **No new read access.** `/me` shows one person their own record — data they already had.

---

## 8. Access request → admin grant

For someone not in the original 500, or an alumnus whose email changed.

1. **Request** — on `/contact`: name, email, batch year, stream, reason. Turnstile protected.
2. **OTP verification** — a 6-digit code to the email, 10-minute expiry, 5 attempts. The request is not queued until verified. Stops people submitting requests using other people's addresses.
3. **Queued** — email encrypted, HMAC stored, status `pending`.
4. **Admin notified** at the Association mailbox: *"1 new access request"* — **no PII in the notification email**; the admin logs in to see it.
5. **Admin reviews** at admin.sxccaa.org: sees name, email, batch, reason, and any matching alumni record. Approve / Reject with reason.
6. **Approve** → inserts the email HMAC into `access_grant` (`source='admin_grant'`, with the admin's ID and timestamp) → welcome email with a sign-in link and a pointer to `/me`.
7. **Reject** → neutral email: *"Your request for alumni directory access could not be approved at this time."* No reason given, no admin named — it doesn't invite an argument and doesn't put the admin's reasoning in writing. The rejected email is **not** added to the allowlist and can re-apply after 30 days.
8. Every decision is written to `audit_log`.

Entirely at the admin's discretion, as you specified. No automatic approval path exists in the code.

---

## 9. Admin portal — admin.sxccaa.org

### 9.1 Why the separate domain genuinely helps

This is not cosmetic. A cross-origin boundary means the browser itself enforces separation: a cross-site scripting flaw anywhere on the public site **cannot read admin cookies or make authenticated admin requests**. It is one of the few security controls the browser enforces for free. Keep it.

**Decided (10 Sep 2026): a separate Next.js app.** Own project, own environment variables, own deployment. `lib/crypto`, `lib/hmac` and `lib/db` are shared via a small internal package so the encryption logic exists in exactly one place. The admin code is not deployed to the public server at all, so no bug in the public app can reach it. Costs one extra deployment and removes an entire class of failure.

**Built 11 September 2026.** Three corrections to what this section assumed, all found by building it:

1. **`packages/core` is deferred, and the arrow points the other way for now.** An npm workspace symlinks the shared package into `node_modules`, and Node's type stripping does not apply inside `node_modules` — which would break every plain-Node tool in this project: the ingest tool, the migration runner, the admin CLI. Making it work needs a build step for the code that holds the encryption keys, which is not a change to make in passing. So `admin/src/lib/shared.ts` re-exports from `oxvercity/src/lib/core` and every ugly relative path is confined to that one file. The direction is the safe one: everything in `core` already ships to the public server, so importing it into admin adds no exposure, and **nothing under `oxvercity/` imports anything from `admin/`** — which is what keeps admin code off the public server.
2. **Both apps' `next` invocations run through `node --env-file`.** Next only reads `.env` from its own directory, so the admin app would otherwise need its own copy of `DATA_ENCRYPTION_KEYS` locally — two files to keep byte-identical, which is the failure this section warns about. Loading `../oxvercity/.env` first and `admin/.env` second keeps one source of truth in development. Production is unchanged: each host holds its own secrets.
3. **`npm run admin:verify` now proves the keys agree** by decrypting a row the ingest tool wrote, not just by round-tripping within one process. A round-trip passes with any key at all.

Practical consequences to build for:

- Repo layout: `oxvercity/` (public app), `admin/` (portal), with `oxvercity/src/lib/core` as the shared library until `packages/core` lands.
- **Two sets of environment secrets.** Both apps need `DATA_ENCRYPTION_KEY` and `EMAIL_HMAC_PEPPER` — they must be byte-identical or the admin portal cannot read what the public app wrote. Set them once, record them in the password manager, and verify on first deploy.
- Separate DB roles: the public app's role has no write access to `access_grant`, `admin_user`, `admin_invite` or `audit_log` (append-only). Only the admin app can grant access. This means a total compromise of the public site still cannot mint itself an allowlist entry.
- Storage: the public app's role may write to `photos/` but only the admin app may flip `photo_status` to `approved`.
- Cookies never use a `Domain` attribute, so nothing is shared across the two hostnames (§6.1).

### 9.2 Admin onboarding — how an admin account comes into existence

New in revision 2, and the part of the client's brief with the sharpest security consequence. The requirement is that an admin "creates their admin email and enters a password, and the onboarding goes through". The thing that must never exist is a public *create an admin account* page — that is a public door to 500 people's contact details, and no amount of password strength makes it safe.

So: **the first admin is created locally, and every admin after that is created by invitation.**

**The first super admin — once, ever:**

```bash
npm run admin:create
```

A local CLI in `tools/admin/`, same trust model as the ingest tool (§4): it is not part of the deployed app, so it cannot be reached over the internet. It runs on your machine, against the database, and:

1. Prompts for the admin's email and password with **masked input** — never as command-line arguments, which land in shell history and in `ps` output for every user on the machine.
2. Enforces the password policy (below) and checks Have I Been Pwned before accepting.
3. Prints a TOTP enrolment QR in the terminal and **refuses to write the row until a valid 6-digit code is typed back**. An admin account with unconfirmed 2FA is an admin account with no 2FA.
4. Prints 10 recovery codes once. Only their Argon2id hashes are stored; they cannot be shown again.
5. Writes the row as `status='active'`, `role='super_admin'`, and logs it.

**Every admin after that — invitation, never self-signup:**

1. A super admin enters the new admin's email in the portal. **Step-up re-authentication (password + TOTP) is required** to do this — creating an admin is as dangerous as granting access.
2. The system mints a single-use invite token: 24-hour expiry, SHA-256 stored in `admin_invite`, the raw token existing only inside the emailed link.
3. The invitee opens the link and completes onboarding in one session: set password (min 12 chars, HIBP-checked) → scan the TOTP QR → confirm a live 6-digit code → receive 10 recovery codes, shown once.
4. Only on confirming the TOTP code does `status` become `active` and `totp_confirmed_at` get set. Until then the account cannot sign in to anything.
5. The invite is consumed and dead. They log in fresh, through the normal login page.
6. Every step — invited, opened, completed, expired — is written to `audit_log`. An expired or already-used link shows the same neutral "this invitation is no longer valid" page, so it cannot be used to probe for valid admin emails.

**The rules around it:**

- **No email-based password reset for admins.** If an admin forgets their password, another super admin issues a reset invite, or you run the local CLI. Email-based reset means a compromised admin mailbox is a full breach of the portal, which defeats the point of mandatory 2FA.
- **TOTP cannot be turned off**, only re-enrolled — which requires step-up auth and a fresh confirmed code.
- **Lost phone?** A recovery code gets them in once and forces immediate re-enrolment. Recovery codes are printed and kept offline, not in the same password manager as the password.
- **Disabling an admin** sets `status='disabled'`, revokes every session immediately, and **keeps their audit history**. Audit rows are never deleted — an audit log with a delete path is not an audit log.
- **At least two super admins from day one.** One admin with one phone is one lost phone away from a locked portal, and the recovery path then runs through your laptop.

### 9.3 Admin authentication

- Email + **Argon2id** password (memory-hard; a stolen hash is impractical to crack). Minimum 12 characters, checked against the Have I Been Pwned k-anonymity range API (only a 5-char hash prefix leaves the server — the password never does).
- **TOTP two-factor is mandatory**, not optional. An admin account is the keys to 500 people's contact details.
- Lockout after 5 failures, exponential backoff.
- 30-minute idle timeout, 8-hour absolute.
- **Step-up re-authentication** (password + TOTP again) for: granting access, revoking access, bulk export, inviting an admin, and re-enrolling TOTP.
- Optional IP allowlist if the Association works from fixed locations.

### 9.4 Admin screens

Dashboard (counts only, including **photos awaiting review**) · Access requests queue · Access grants list (shows *masked* emails; full reveal is a logged action) · Alumni records (search, edit, archive — full record regardless of the owner's toggles) · **Photo moderation queue** (approve / reject with a fixed reason, remove an approved photo) · Audit log (read-only, filterable) · Admin users and invitations (super admin only) · Sessions (view and force-revoke).

---

## 10. Security controls

### 10.1 HTTP headers (middleware + `next.config.ts`)

- **Content-Security-Policy**: nonce-based, `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, no `unsafe-inline` for scripts, and **`img-src 'self' <storage-host> data:`** — an explicit list, so injected markup cannot beacon an image request out to an attacker's server. This is the single most valuable header here — it is what stops an XSS from exfiltrating a profile.
  - *Two traps, both hit while building the portal on 11 Sep 2026, both of which produce a working-looking page where nothing responds.* **A flat `script-src 'self'` breaks Next entirely** — the App Router ships its flight data in ~27 inline `<script>` tags, all of which are refused, so React never hydrates and every button silently does nothing. There is no console error and no failed request. The nonce must be generated per request in middleware and passed back through a `Content-Security-Policy` *request* header, which Next reads to stamp the same nonce onto its own script tags; `'strict-dynamic'` goes with it. **And `next dev` needs `'unsafe-eval'`** — the dev build wraps every webpack module body in `eval()` for source maps, so without it the chunks fetch with a 200, the outer wrapper runs, and every module body is refused. `next build` emits no `eval`, so production keeps the strict policy.
- **`Referrer-Policy: same-origin`, not `no-referrer`.** Under `no-referrer` Chrome serialises the `Origin` header of a form POST as the literal string `null`, and Next's server-action handler parses that header as a URL — so every form returns a 500. `same-origin` gives the same protection that matters (nothing leaves the origin) at no cost. Same trap, same afternoon.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff` · `Referrer-Policy: no-referrer` · `X-Frame-Options: DENY`
- `Permissions-Policy` — camera, mic, geolocation, payment all denied. Worth noting: the photo uploader uses a file picker, not `getUserMedia`, so denying camera costs nothing.
- Photo responses are served with `Content-Type` set from our own re-encode and `X-Content-Type-Options: nosniff`, so a stored object can never be interpreted as script.
- `poweredByHeader: false`.

### 10.2 Input and output

- **Zod validation at every boundary** — every API route, every form, the ingest parser, every self-service save. Nothing untyped reaches the database.
- **Uploads validated by content, not by claim** — magic bytes, dimension probe, re-encode (§7.4).
- Parameterised queries only. No string-concatenated SQL anywhere.
- React escapes by default; **`dangerouslySetInnerHTML` is banned by ESLint rule** across the repo.
- CSRF: `SameSite=Lax` + a double-submit token on every state-changing POST + `Origin` header check. This now covers `/api/me/*` and the photo upload, which are the first endpoints on the public site that write anything.

### 10.3 Never in logs, never in URLs

- No email, phone, or name in application logs, error messages, analytics, or URLs. IPs are stored hashed.
- **Self-service request bodies are excluded from error reporting entirely** — that is where plaintext now briefly lives (§7.3).
- Error responses are generic; stack traces never reach the client in production.
- Sentry (or equivalent) configured with PII scrubbing on, `sendDefaultPii: false`, request bodies off, and attachments off so an upload can never be captured in a crash report.

### 10.4 Anti-harvesting

- 60 profile views/hour, 200/day per session. Exceeding it shows a soft block and alerts the admin.
- Every private-field view logged with viewer identity — a harvester is identifiable afterwards.
- No "export" or "download directory" feature for alumni. Ever.
- No public API returning multiple full records; profiles are fetched one at a time.
- **On public photographs, honestly:** a public grid of 500 named faces with employers attached is scrapable, and the rate limits above do not change that, because it is public by design and by the client's instruction. The two real mitigations are both in the plan already — the per-person "verified alumni only" audience setting (§1.3), and the fact that no private field ever accompanies a public card. If the Association would rather not publish faces at all, changing the default audience to `alumni` is a one-line change; that is decision 9 in §13.

### 10.5 Email

- **SPF, DKIM and DMARC** configured on sxccaa.org. Without DMARC anyone can spoof "SXCCAA" and phish your alumni with fake sign-in links — the highest-probability real-world attack on this system.
- Provider: **Resend** (simplest) or Amazon SES (cheapest at volume).
- Magic-link, invitation and moderation emails contain no PII beyond the recipient's own address.
- Domain warm-up before the 500-email invitation run (§4.2).

### 10.6 Mitigating the residual risk from §0.2

If the running server is fully compromised, the attacker can decrypt. To make that as hard and as survivable as possible:

- Minimal dependency tree; every new package justified. Most Node compromises arrive through a transitive dependency. Revision 2 adds exactly two: `sharp` (image re-encode — this is a buy-not-build; hand-rolling image parsing is how you get a CVE) and `file-type` (magic-byte sniffing, ~20 lines of table lookup but a table that must be right).
- No `eval`, no dynamic `require`, no user-controlled file paths, no shell-outs. Storage keys are generated by us, never derived from an uploaded filename — path traversal through a filename is a classic and it is closed by never using the filename at all.
- Secrets in the host's secret manager, not a `.env` file on disk.
- Least-privilege DB role — the app cannot `DROP`, cannot alter schema.
- Alerting on anomalous decrypt volume (e.g. >100 private field reads in 10 minutes) and on upload volume spikes.
- Documented breach response: rotate keys, revoke all sessions, notify the Data Protection Board and affected alumni within the DPDP Act window.

### 10.7 Build and supply chain

- `npm audit` in CI, build fails on high/critical.
- Dependabot on.
- `gitleaks` pre-commit hook — a committed key is the most common way projects like this leak.
- Lockfile committed; CI uses `npm ci`.
- CI check that asserts `private-data/` and `.env*` are untracked.

### 10.8 Verification before launch

- Unit tests on crypto (round-trip, AAD rejection, key rotation), email normalisation, tier resolution, **toggle resolution** (every combination of `show_contact` × `show_gmail` × `photo_audience` × session tier).
- **Integration tests that assert the negative**, run in CI on every commit — this is what stops a future change from silently reopening a hole. Implemented as `npm run gate:verify` (`tools/db/gate-verify.ts`), which plants one record with known confidential values, signs in one identity, probes over HTTP and removes everything it made. It covers:
  - anonymous request to `/alumni/<id>` returns 404;
  - anonymous `/alumni` HTML response **does not contain the string** of any private field;
  - with `show_contact = false`, the verified `/api/alumni/<id>` JSON **does not contain the number in any form**;
  - a session for alumnus A cannot write to alumnus B (post to `/api/me` with B's id in the body — it must be ignored, not honoured);
  - an `alumni-only` photo URL fetched without a session returns 404.
- **Upload abuse suite:** a PHP file renamed `.jpg`, a GIF/JS polyglot, a 64000×64000 decompression bomb, a 2 GB stream, a JPEG with GPS EXIF (assert the stored object has no EXIF), and a valid image with an appended ZIP.
- Manual pass with cookies cleared, source viewed, network tab inspected.
- OWASP Top 10 review, ZAP baseline scan against staging.
- Restore a backup into a scratch database and confirm the contact fields are unreadable ciphertext. **Do this — it is the proof that the whole design works.**

---

## 11. Legal — DPDP Act 2023

Non-optional in India, and directly relevant:

- **Consent evidence — confirmed present (10 Sep 2026).** The Google Form told respondents their details would be shown to other alumni, and the form's column 10 says so explicitly ("only Gmail ID for accessing the database"). The Timestamp column is the per-record consent timestamp and is imported into `alumni.consent_recorded_at`. **Action for you:** export the original form — its exact question wording and the response sheet — to a PDF and archive it offline. If consent is ever challenged, that archive is the evidence, and a live Google Form can be edited after the fact.
- **Consent for the photograph is separate and explicit.** A photograph was never collected by the form, so no prior consent covers it. The upload screen states plainly, above the button, who will see the image at the chosen setting — "visible to anyone who visits sxccaa.org" or "visible only to verified alumni" — and the act of uploading is the consent, recorded with a timestamp. Consent obtained by a person choosing to upload, having been told the consequence, is the cleanest form there is.
- **Right to withdraw — now self-service.** `/me` carries the three toggles and a "remove me from the directory" action (`is_visible=false` + grant revoked), plus a one-click opt-out link in the invitation email. Under DPDP a withdrawal must be as easy as the consent was; a toggle satisfies that, an email to the Association does not.
- **Right to correction — now partly self-service.** Employment fields and contact details are editable by the alumnus directly (§7.1); name, batch, stream and login email go through the admin.
- **Right to erasure covers photographs.** Removing a photo deletes the stored object, not just the database row.
- **Purpose limitation.** The data is used for the directory. Not for fundraising blasts, not shared with third parties. Photographs are not used in marketing material without asking separately.
- **Breach notification.** Documented runbook (§10.6).
- A **Privacy Policy** stating what is collected, who sees it, how it is secured and how to withdraw — including a plain-English description of the three toggles and their defaults. `src/app/privacy-policy/page.tsx` already exists and needs this content.

---

## 12. Build phases

| Phase | Work | Output |
|---|---|---|
| **0. Decisions** | Confirm §13 questions. Provision Supabase (DB + storage buckets), email provider, DNS. Generate keys. | Environments ready |
| **1. Crypto & data layer** | `lib/crypto.ts` (AES-GCM + AAD + key versioning), `lib/hmac.ts`, email normalisation, schema + migrations, RLS deny-all, bucket policies. **Full unit tests.** | Tested foundation |
| **2. Ingest tool** | `tools/ingest/` — localhost-only server, drop zone, parse, validate, masked dry-run, encrypt, push, allowlist build, toggle defaults, report. | **You can load your real data** |
| **3. Alumni auth** | `/login`, magic links, sessions, rate limiting, Turnstile, neutral responses. | Login works |
| **4. Public gating** ✅ | Split types, gate card and profile, 404 for anonymous, `noindex`, `no-store`. Negative integration tests. | **The core requirement is live** — done 11 Sep 2026; `npm run gate:verify` 36/36 |
| **5. Admin portal & onboarding** ✅ | Separate app, `npm run admin:create` bootstrap CLI, invitation flow, Argon2id + TOTP + recovery codes, requests queue, grants, record editing, audit log, step-up auth. | admin.sxccaa.org — done 11 Sep 2026; `npm run admin:verify` 54/54, 45 unit tests |
| **6. Self-service profiles** ✅ | `/me`, three toggles, editable fields, photo upload pipeline (`lib/photo.ts`), private photo proxy, moderation queue in the admin portal. Upload abuse suite. | **Alumni own their own data** — done 11 Sep 2026; 172 public tests incl. 20-case abuse suite |
| **7. Access requests** ✅ | Contact form, OTP verification, queue → admin → grant, notification emails. | Request flow closed — done 11 Sep 2026; `npm run request:verify` 28/28 |
| **8. Hardening** ✅ | CSP, all headers, harvesting limits, ZAP scan, dependency audit, backup-restore proof, DMARC. | Reviewed — done 11 Sep 2026; `restore:proof` 22/22, `harden:verify` 26/26. DMARC and a real `pg_dump` drill remain manual, see §17 |
| **9. Launch** ◐ | DNS cutover, TLS, backups + PITR verified, invitation email run, admin training, runbook. | Tooling and documents done 11 Sep 2026. DNS, TLS and the backup drill need registrar and Supabase access — see §18 |

Phases 1 and 2 are the foundation — nothing else can start until the crypto is tested and correct. Phase 4 is the requirement you care about most; it depends on 1 and 3. **Phase 5 now comes before phase 6** because photo moderation needs somewhere for an admin to moderate.

**Carried out of scope by Phase 4 — the connection-request flow.** The SOW's §3.3 journey (request form → OTP → moderation queue → alumnus accepts → contact released by email) was designed for a directory that never shows a contact detail. Revision 2 shows contact details directly to verified alumni, which answers the same need in one step instead of five. `/alumni/<id>/connect` and `ConnectFlow.tsx` were also built on `openToConnect` and `helpsWith`, neither of which is a Google Form column or a database column, so they could not have run against real data. Both were removed in Phase 4. The route that now serves a stranger who wants to reach a Xaverian is `/contact` → access request → admin grant (§8). **If the Association still wants a moderated request path for people it will not grant directory access to, that is a change request, not a defect** — say so and it goes back in as its own phase.

---

## 13. Decisions

### Settled — 10 September 2026

| # | Decision | Outcome |
|---|---|---|
| 1 | Stream of study on the public card | **Public.** Card shows 5 fields. §1.1, §5.3 |
| 2 | Admin portal architecture | **Separate Next.js app** on admin.sxccaa.org. §9.1 |
| 3 | Consent wording on the Google Form | **Present.** Form disclosed alumni-visible use; launch is not blocked. Archive the form to PDF. §11 |
| 4 | Rejected access requests | **Neutral email, no reason given.** Re-apply after 30 days. §8 |

### Settled — 11 September 2026 (client instruction)

| # | Decision | Outcome |
|---|---|---|
| 5 | Per-person contact opt-out | **Kept and made explicit in the UI** as "Show my contact number to verified alumni". §1.3 |
| 6 | Gmail visibility | **Toggle, default ON.** Off means hidden from other alumni; login is unaffected. §1.3 |
| 7 | Alumni photographs | **Uploaded by the alumnus from their own profile**, shown under their name. No photo = existing fallback avatar. §7.4 |

### Still open

8. **Photo moderation — approve before public, or live immediately?** *(Recommendation: approve first. One click, usually same-day; the alternative is an unvetted image on the Association's public site until someone notices.)* Needed before Phase 6. §7.5
9. **Default photo audience — everyone, or verified alumni only?** *(Recommendation: everyone, since the client asked for photos on the public card, with the per-person "alumni only" option available. If the Association is uneasy about publishing 500 faces, flip the default.)* Needed before Phase 6. §1.3, §10.4
10. **Email provider — Resend or Amazon SES?** *(Recommendation: Resend. Simpler API and DKIM setup; SES only wins on cost at volumes you won't reach.)* Needed before Phase 3 — magic links don't work without it.
11. **Who are the admins, and how many?** At least two super admins. Each needs an authenticator app on their phone from day one — TOTP is mandatory, not optional, and the first account is created on your machine (§9.2). Needed before Phase 5.
12. **What happens to the existing "Nostalgia '23" content** on the live sxccaa.org — replaced entirely, or retained under a section of the new site? Open since SOW §7.4. Needed before Phase 9 (DNS cutover), not before build starts.

None of these block Phases 0–2, so the crypto layer and the ingest tool can start immediately.

---

## 14. What I am explicitly not doing

- Not asking to see the Excel. The ingest tool is built and tested against **synthetic data** matching your 11 columns exactly. You run it against the real file yourself. I never see a real record.
- Not storing plaintext PII anywhere at any point in the hosted system.
- Not using client-side database access, and not letting the browser upload straight to storage.
- **Not adding alumni self-registration.** Access still comes only from the import or an admin grant. Revision 2 adds self-*service* — an already-verified alumnus managing their own record — which is a different thing: no session, no `/me`, no upload, nothing.
- Not letting an alumnus change their own name, batch, stream or login email, for the reasons in §7.1.
- Not building a public "create an admin account" page, at any point, for any reason (§9.2).
- Not storing an uploaded file as it arrived. Every image is re-encoded and stripped before it touches storage.
- Not changing the OX Versity visual design. Access control changes what is rendered, never how it looks; `/me` is a new page built from the existing style vocabulary.

---

## 15. Build log — what verifies what

Running record of the checks that exist and what each one is for. All were green on 11 September 2026.

| Command | Where | Covers |
|---|---|---|
| `npm test` | oxvercity | 172 unit tests — crypto round-trip and AAD rejection, key rotation, email normalisation, phone parsing, ingest validation and planning, rate-limit arithmetic, **the full visibility matrix** (128 tier × toggle combinations), **the 20-case upload abuse suite** |
| `npm test` | admin | 45 unit tests — RFC 6238 TOTP vectors, base32, replay refusal, Argon2id parameters, HIBP k-anonymity, lockout curve, step-up window |
| `npm run db:verify` | oxvercity | 39 checks against the live database — least-privilege grants, constraints that refuse a record contradicting the access model, `anon`/`authenticated` hold nothing |
| `npm run auth:verify` | oxvercity | Magic-link sign-in against the live database and real Resend — neutral responses, single-use tokens, revoked grants killing links already sent |
| `npm test` (enquiry cases) | oxvercity | The general enquiry form: HTML escaping of free text from strangers, the capitalised-vs-honeypot field names read from the components themselves, and an assertion that `SiteForm` has exactly one `setState('sent')` and that it sits downstream of a response check |
| `npm run request:verify` | oxvercity | 28 checks — the request is not queued until the code is checked, the address is stored encrypted and bound to its row, resubmitting replaces the code instead of duplicating the row, wrong code and unknown address are indistinguishable, the attempt counter stops at five rather than breaching its constraint, limits bind at three a day, and `sxc_web` cannot decide a request |
| `npm run gate:verify` | oxvercity | **36 negative assertions over HTTP** — anonymous gets 404, no private field in anonymous HTML, a toggled-off field absent from the JSON, withdrawn indistinguishable from never-existed, `no-store` and `noindex` where they belong. Needs a running server with `USE_DEMO_ALUMNI=false` |
| `npm run admin:verify` | admin | 54 checks — the two apps hold the same encryption keys, no password oracle, comparable timing on unknown accounts, TOTP replay refused, lockout binds, disabling ends sessions, `sxc_web` cannot read or mint an admin session, `sxc_admin` cannot rewrite the audit log |
| `npm run restore:proof` | oxvercity | **22 checks that the bytes are worthless without the key** — plants known values, reads the raw columns back, and searches them in raw, hex and base64 form; confirms a wrong key, a wrong row and a wrong column all fail to decrypt; confirms the *public* name IS readable, so the claim stays honest |
| `npm run harden:verify` | oxvercity | 26 checks on what a running server actually sends — the CSP nonce matching the script tags, no `unsafe-inline`, `frame-ancestors 'none'`, `no-store` where it belongs, robots.txt. Needs a running server |
| `npm run scan:secrets` | oxvercity | Refuses a committed key ring, Resend key, connection string, service-role JWT or private key |
| `npm run launch:check` | oxvercity | Configuration rather than behaviour — demo flag off, https, the portal on its own hostname, Turnstile present, **SPF/DKIM/DMARC resolved over DNS**, migrations applied, at least two super admins, every listed alumnus carrying a consent timestamp, `anon` holding nothing |
| `npm run invite` | oxvercity | Dry run by default. Paced, resumable, and excludes anyone withdrawn, revoked or without a sign-in identity |
| `npm run build` | both | Every alumni and admin route compiles as **ƒ dynamic**, never static. A pre-rendered profile page is a public profile page whatever the authorisation code says |

**Three traps worth knowing about before Phase 8 touches headers again**, all found by building:

1. `script-src 'self'` with no nonce silently kills Next — 27 inline bootstrap scripts refused, React never hydrates, every button does nothing, no console error.
2. `next dev` additionally needs `'unsafe-eval'`; the dev build wraps module bodies in `eval()`. Production does not.
3. `Referrer-Policy: no-referrer` makes Chrome send `Origin: null` on form POSTs, which breaks every Next server action with a 500. `same-origin` gives the same protection that matters.

---

## 16. The enquiry form — fixed 11 September 2026

Not a phase; a defect found while building Phase 7 and fixed the same day.

**What was wrong.** `SiteForm` treated a missing `action` as success: it set the sent state, cleared the fields and discarded the message. Framer posted these to its own form service, which this rebuild does not have, so every enquiry form on the site had been doing that — on `/contact`, `/alumni`, `/alumni/<id>` and `/events`. A visitor filled it in, read "Message sent", and nobody ever saw it. That is worse than having no form, because it costs the sender the chance to email instead.

**Options considered.**

| | Verdict |
|---|---|
| Third-party form service (Formspree, Web3Forms) | **No.** Pipes names, addresses and free text through a company nobody has assessed, on a project whose premise is that data does not leave systems we control — and creates a DPDP processor relationship the Association would have to document. |
| Store enquiries in the database with a portal queue | **No.** A growing store of unstructured personal data from the public, needing securing, backups and deletion-on-request, to duplicate what a mailbox already does. |
| Delete the form, publish the address | **No.** Drops a real contact path and hands `contact@sxccal.edu` to every scraper on four pages. |
| **Own endpoint, forwarded by email** | **Chosen.** Assembles parts that already exist — Turnstile, rate limiting, the honeypots already in the Framer markup, Resend, `isSameOrigin`. |

**How it works now.** `POST /api/enquiry` → same-origin check → honeypots → Turnstile → validation → five per IP per day → forwarded to `ENQUIRY_TO_EMAIL`. **The send is synchronous and the result is reported honestly**: the form says "sent" only when Resend accepted the message, and when it did not it says so and points at the Association's address. `action` is now a *required* prop, so the branch that lied is unrepresentable and the compiler objects at both call sites if anyone tries to reinstate it.

**Three things worth knowing.**

- **It cannot become a spam relay.** The recipient is fixed, read from configuration. No input influences who receives anything, so the worst an abuser achieves is filling the Association's own inbox.
- **This template carries its contents**, unlike every other one in `email.ts`. The no-PII rule exists because those messages are about alumni in the directory; an enquiry is the sender's own question to the people who can answer it. `reply_to` is set to the sender and the body states plainly that the address is **unverified** — anyone can type anyone's address into a public form, and escaping does not fix impersonation.
- **The field names are a trap.** The Framer markup ships capitalised real fields (`Name`, `Email`, `Message`) alongside lowercase honeypots — one of which is `message`. Reading the wrong case drops every genuine enquiry and accepts every bot. A test reads both the components and the route and asserts they agree.

**Also fixed:** the consent checkbox was `name="Newsletter"` with the label "I agree to the terms and conditions" and no newsletter behind it. It is now `Consent`, labelled against the privacy policy and terms of use, required in the browser *and* checked on the server — a tickbox that changes nothing is the same class of thing as a form that posts nowhere.

---

## 17. Phase 8 — what was hardened, and what is left

Done 11 September 2026.

**Content-Security-Policy is now on the public site**, nonce-based, and it did not break the Framer export — the assumption that deferred it was wrong. Inline `style` attributes are permitted (`style-src 'unsafe-inline'`); a style cannot execute, and `script-src` is where the control actually lives. Turnstile is the only third party in the policy: its script is injected by our own bundled code, so `'strict-dynamic'` covers it, and the challenge iframe needs `frame-src`. Everything else is same-origin.

**The view budget from §10.4 is live.** Sixty full profiles an hour, two hundred a day, spent *before* the record is decrypted — a refusal that still does the work is not a limit. It is keyed on the blind index of the signed-in address rather than the session, because a session resets with one click on a magic link and an identity does not. The grid is not metered; it carries only what anyone can already read. Exhaustion is audited once, at the refusal — auditing every view would build a record of who looked at whom, which is the relationship data the directory tries hardest not to accumulate.

**Supply chain:** `npm audit --omit=dev` is clean in both apps. A hand-written `scan:secrets` refuses a committed key ring, Resend key, connection string, Supabase service-role JWT or private key — hand-written rather than `gitleaks` for the same reason the rest of this project avoids dependencies near the keys.

**CI** runs typecheck, lint, tests, build, secret scan and audit for both apps, plus a check that `private-data/` and `.env` are untracked. It deliberately runs **no** verifier that needs a credential: wiring the decryption key into a third party's build environment to automate six commands is a bad trade, and the commands are in `TESTING-GUIDE.md`.

### Still manual, and each needed once before launch

1. **A real `pg_dump` restored into a scratch database.** `restore:proof` checks the bytes in place, which answers the same question — but do it against the actual backup once, because the claim being made is about the backup.
2. **A key-rotation drill.** Add a second key, confirm old rows still decrypt, re-encrypt, retire the first. Practise it before it is needed, not during an incident.
3. **SPF, DKIM and DMARC on sxccaa.org.** The highest-probability real-world attack on this system is not against the code — it is someone spoofing the Association and phishing five hundred alumni with a fake sign-in link. DMARC is what stops that, and it is a DNS record nobody in this repository can write.
4. **A ZAP baseline scan against staging.** The headers it checks are covered by `harden:verify`; what it adds is the crawl.

### A mistake worth recording

CSP was briefly suspected of breaking hydration on the public site. It was not. The cause was `npm run build` run twice **while `next dev` was running**, which corrupts `.next` and leaves the dev server serving pages whose scripts never execute — the symptom is a form that submits natively as a GET, visible in the server log. The fix is `rm -rf .next` and a restart. Do not run a production build against a live dev server; the failure looks exactly like a security-header problem and is not one.

---

## 18. Phase 9 — launch

Tooling and documents done 11 September 2026. The rest needs access nobody in this repository has.

### Built

**`npm run invite`** — the invitation run, which §4.2 step 7 described and nothing implemented. Dry run by default, because a command that emails five hundred people should not do so as the default behaviour of typing its name. Paced at fifty an hour: a new sending domain that emits five hundred messages in a minute lands in spam, and once Gmail has decided that, the sign-in links stop arriving too and the platform looks broken.

**It is resumable, per message.** `alumni.invited_at` (migration 0008) is stamped after each successful send rather than per batch — ten hours is long enough to be interrupted, and sending twice is the failure that matters. The queue excludes anyone withdrawn, anyone whose grant was revoked, and anyone with no sign-in identity; emailing the last group a link that cannot work would be worse than saying nothing. Failures are left un-invited so a rerun retries exactly those.

**`npm run launch:check`** — configuration rather than behaviour, which is the category that passes every test, builds cleanly, and then does something irreversible on the day. It resolves SPF, DKIM and DMARC over DNS, and flags a demo flag left on, a portal sharing a hostname with the public site, missing Turnstile, fewer than two super admins, and listed alumni with no consent timestamp.

**The invitation email** is the one message five hundred people will actually read about how their data is handled. It answers, in order: why am I getting this, what can everyone see, what can only signed-in Xaverians see, how do I change it. The opt-out is in the body rather than a footer — under the DPDP Act withdrawal must be as easy as the consent was.

**[RUNBOOK.md](RUNBOOK.md)** and **[ADMIN-GUIDE.md](ADMIN-GUIDE.md)** — SOW deliverables 8 and 9. The runbook is written to be readable at 2am by someone who did not build this; the admin guide assumes no technical knowledge.

### Found by the check, on the real sending domain

SPF and DKIM resolve for `opscores.in`. **DMARC does not.** Until that record exists, anyone can send mail claiming to be from the Association — and the highest-probability real attack on this platform is not against the code. It is a lookalike "sign in to the alumni directory" message sent to five hundred people who have just been told to expect exactly that.

### Still needed, and who has to do it

| | Needs |
|---|---|
| **DMARC record** — start `p=none` with `rua=`, move to `quarantine` once reports look clean | DNS access |
| DNS cutover for `sxccaa.org` and `admin.sxccaa.org` | Registrar access |
| TLS certificates and HSTS preload submission | Hosting access |
| Confirm daily backups **and** point-in-time recovery are enabled — neither is always on by default | Supabase project settings |
| The real `pg_dump` restore drill (runbook §8) | Production credentials |
| A key-rotation drill (runbook §7), practised before it is needed | Production credentials |
| Secrets moved out of `.env` into the host's secret store | Hosting access |
| A second super admin | Five minutes in the portal |
| Warm the sending domain before the invitation run | Two days of patience |
