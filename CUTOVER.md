# Cutover checklist

What to do, in order, to take this live. Written to be worked through with a pen.

Companions: [RUNBOOK.md](RUNBOOK.md) for operations afterwards, [TESTING-GUIDE.md](TESTING-GUIDE.md) for checking things work, [ADMIN-GUIDE.md](ADMIN-GUIDE.md) for the Association's volunteers.

**The point of no return is step 6** — the invitation run. Everything before it is reversible. Everything after it has been seen by five hundred people.

---

## 0. Before anything else: get the code into version control

**This is the highest-risk item on the page and it has nothing to do with launching.**

Right now the entire platform exists on one laptop. The public app has 65 uncommitted files; the admin app is not in a git repository at all. A disk failure, a stray `rm -rf`, or a stolen bag loses all of it. It is also SOW deliverable 7 — the source repository is handed to the Association on completion, and there is nothing to hand over.

- [ ] `git init` in `admin/`
- [ ] Commit both applications
- [ ] Push to a **private** remote
- [ ] Confirm `.gitignore` held: `git ls-files | grep -E '\.env$|private-data'` must return nothing
- [ ] `npm run scan:secrets` in `oxvercity/`

Do this today. The rest of this document can wait; this cannot.

---

## 1. Two or three weeks out

### DNS — the long-lead item

- [ ] **DMARC**, on the sending domain. Start permissive so nothing is silently dropped while you watch:
      `_dmarc.<domain>  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@<domain>"`
- [ ] Confirm SPF and DKIM still resolve — `npm run launch:check` reports all three
- [ ] Let reports arrive for **at least a week**. When they show only your own mail passing, move to `p=quarantine`

Do not shorten this. The highest-probability real attack on this platform is not against the code — it is a lookalike "sign in to the alumni directory" email sent to five hundred people who have just been told to expect exactly that. DMARC is what stops it, and it needs to be in place *before* they are told.

### The Association's side

- [ ] A **second super admin**, created by invitation from inside the portal. One admin with one phone is one lost phone away from a locked portal.
- [ ] Both admins have their recovery codes **on paper**, somewhere other than the password manager holding the password.
- [ ] The Association has read [ADMIN-GUIDE.md](ADMIN-GUIDE.md).
- [ ] The original Google Form — its exact question wording and the response sheet — **exported to PDF and archived offline**. A live form can be edited afterwards; that archive is the consent evidence if it is ever challenged.

### Hosting

- [ ] Both apps deploy from the repository
- [ ] Secrets are in the host's secret store, **not** a `.env` file on disk
- [ ] `DATA_ENCRYPTION_KEYS` and `EMAIL_HMAC_PEPPER` are **byte-identical** in both apps — different values means the portal cannot read a single thing the site wrote
- [ ] Those two secrets are also in a password manager that **at least two people** can reach. Lose them and every contact detail is gone permanently; no backup restores them, because the backup is ciphertext too.
- [ ] Supabase: daily backups **and** point-in-time recovery both enabled. Neither is always on by default.

---

## 2. The week before

### Prove the backup is worth having

- [ ] `pg_dump` production into a scratch database
- [ ] Read the `alumni` table. `contact_enc` must be unreadable bytes
- [ ] Restore completes without error

`npm run restore:proof` checks the same property in seconds and should also pass — but do the real dump once, because the claim being made to the Association is about the backup.

### Practise the key rotation

- [ ] Follow [RUNBOOK.md §7](RUNBOOK.md) once, end to end, on staging

Practise it before you need it, not during an incident. Removing an old key before every row is re-encrypted makes those rows unreadable for ever.

### Warm the sending domain

- [ ] Send a small volume of real mail for several days before the bulk run — test sign-ins, a handful of invitations to Association members

A domain that has sent nothing and then emits five hundred messages lands in spam. Once Gmail has decided that, the *sign-in links* stop arriving too and the whole platform looks broken.

---

## 3. Staging rehearsal

Production-shaped configuration, not localhost.

- [ ] `npm run launch:check` — every failure understood or fixed
- [ ] `npm run db:verify`, `npm run auth:verify`, `npm run request:verify`, `npm run restore:proof`
- [ ] `npm run gate:verify` against the staging server with `USE_DEMO_ALUMNI=false`
- [ ] `npm run harden:verify` against a **production build** (`npm run build && npm run start`), not a dev server
- [ ] `npm run admin:verify` and `npm test` in both apps

By hand, once:

- [ ] Open the directory in a private window. **Ctrl+U** and search for a phone number — nothing to find
- [ ] Click an alumni card while signed out — nothing happens
- [ ] Sign in, open a profile, see the contact details
- [ ] At `/me`, switch your number off, save, and confirm it disappears from your own profile viewed by another account
- [ ] Upload a photo, approve it in the portal, see it on the card
- [ ] Submit the contact form and confirm the message actually arrives

---

## 4. Load the real data

Still reversible. Nobody has been told anything.

- [ ] The spreadsheet is on an encrypted volume, in `private-data/`, **not** in a synced cloud folder
- [ ] `npm run ingest -- private-data/alumni.xlsx --dry-run`
- [ ] Read the preview properly. Rejected rows, duplicates, and the toggle defaults
- [ ] Run it for real and confirm in the browser page it opens on `127.0.0.1`
- [ ] `npm run launch:check` again — it will now report how many are listed, how many can sign in, and whether every record carries a consent timestamp
- [ ] Spot-check five records in the portal against the spreadsheet

**`USE_DEMO_ALUMNI` must be `false`.** The app refuses to start in production with it on, but check anyway.

---

## 5. Cut the domain over

- [ ] TLS certificates issued for both hostnames
- [ ] `sxccaa.org` → the public app
- [ ] `admin.sxccaa.org` → the portal
- [ ] Redirects preserving any URL the old site had indexed
- [ ] HSTS is being sent; submit to the preload list only once you are certain, because it is hard to undo
- [ ] `APP_URL` and `ADMIN_URL` match the live origins **exactly** — a mismatch makes every form on the site return `Bad request.`
- [ ] `npm run harden:verify` against production
- [ ] Sign in to the portal on the live domain
- [ ] Sign in to the directory as an alumnus on the live domain

The site is now live, correct, and nobody knows. That is a fine place to sit for a day.

---

## 6. Tell the alumni — the point of no return

- [ ] `npm run launch:check` one final time. **DMARC must be live.**
- [ ] `npm run invite` — dry run. Read the numbers: listed, already invited, cannot sign in, waiting
- [ ] `npm run invite -- --send --limit 1` to **your own address**
- [ ] **Read that email on a phone.** For most recipients it is the only thing they will ever read about how their data is handled. Check the links work on the live domain
- [ ] Send a handful to Association members and wait a day. Did they land in the inbox or in spam?
- [ ] `npm run invite -- --send` — the rest, paced at 50/hour

Budget two days. The run is resumable: stop it, close the laptop, run it again tomorrow and it picks up exactly where it stopped without emailing anyone twice.

---

## 7. The first week

- [ ] Watch the **Access requests** queue daily. People whose address has changed will appear here
- [ ] Watch **Photographs**. Approve same-day where you can
- [ ] Check Resend for bounces. A high bounce rate means the spreadsheet has stale addresses, not that anything is broken
- [ ] Read the audit log once, end to end. It is the easiest week to notice something odd
- [ ] Expect "I don't want to be listed" emails. The answer is that they can do it themselves in one click at `/me`, and they do not need permission

---

## If something goes wrong

**Roll back the DNS.** Everything up to step 5 is reversible that way, and nobody outside the Association has seen anything.

**After step 6 you cannot un-send.** If a serious problem surfaces, the honest move is a short follow-up email saying what happened and what you did about it. Five hundred people who were just asked to trust the Association with their phone numbers will judge the response more than the fault.

[RUNBOOK.md §6](RUNBOOK.md) covers the specific failures and what they mean. [RUNBOOK.md §9](RUNBOOK.md) covers a breach.

---

## The five things that matter most

1. **Get the code into git today.** Nothing else on this page matters if the laptop dies.
2. **DMARC before the invitations**, with a week of reports behind it.
3. **Two super admins**, both with recovery codes on paper.
4. **The encryption keys in a password manager two people can reach.** Lose them and the contact details are gone for good.
5. **Pace the invitation run.** Two days, not two minutes.
