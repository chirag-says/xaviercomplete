# Administrator's guide — SXCCAA alumni directory

For the people who run the portal at **admin.sxccaa.org**. No technical knowledge assumed.

---

## What you are looking after

Around five hundred Xaverians filled in a form giving the Association their phone number and email address. Those details are now in a directory, and this portal is how the Association keeps it correct and decides who gets in.

**Two things are worth knowing before anything else.**

First, the contact details are encrypted. Not even the company hosting the database can read a phone number. That is a promise the Association has made to five hundred people, and the portal is built so you cannot break it by accident.

Second, **nobody can sign up.** There is no registration page on the directory and no registration page for this portal. Every single person who can see a contact detail is there because the Association put them there — either from the original spreadsheet, or because an administrator approved them here.

That means the queue you work through is the whole of the front door.

---

## Signing in

Go to **admin.sxccaa.org**. You need three things every time:

1. Your email address
2. Your password
3. A six-digit code from your authenticator app

All three on one screen. If any is wrong you get the same message — *"That email address, password or code was not right."* That is deliberate: it stops someone with a stolen password finding out it works.

**"That code has already been used."** Each code works once. Your app shows a new one every thirty seconds — wait for the next.

**Codes always rejected?** Your phone's clock has drifted. Settings → Date & time → *Set automatically*.

**Five wrong attempts** locks the account for fifteen minutes. Wait it out; it doubles if you keep trying.

**Lost your phone?** Use one of the ten recovery codes you saved when your account was created. It works once, and you will be asked to set a new password afterwards. If you have lost those too, another super admin can re-invite you. **There is no password reset email** — if there were, someone who broke into your mailbox could take over the portal, which is the whole thing two-factor exists to prevent.

---

## "Confirm who you are"

Some actions ask for your password and a code again, even though you just signed in. Those are the ones that change who can see five hundred people's contact details:

- granting access
- revoking access
- inviting or disabling an administrator
- revealing a masked email address

Confirm once and you have five minutes. It is not the system distrusting you — it is what stops an unlocked laptop in a shared office from being enough.

A badge in the sidebar always tells you which state you are in.

---

## The screens

### Dashboard

Counts only, no names. It answers one question: **is anything waiting for me?**

Deliberately bland, because it is the screen most likely to be open when you share your screen on a call.

### Access requests

Someone who is not in the spreadsheet has asked to be let in.

For each request you see their name, a masked email, their batch and stream, and why they say they should have access. Two things are flagged for you:

- **Verified** — they typed back a code we emailed, proving they can read mail at that address. **You cannot approve an unverified request**, and that is the point: otherwise anyone could put someone else's address into the queue.
- **Match** — if their address matches a directory record, you will see whose. A request from an address already in the spreadsheet is almost always an alumnus who cannot sign in, which is a different decision from a stranger asking to be let in.

**Approving** adds their address to the sign-in list and emails them a link. **Refusing** sends a short, neutral email with no reason given — they can apply again after thirty days.

Take your time. There is no automatic approval anywhere in this system and there never will be. You are the check.

### Access grants

Every address that can sign in to the directory.

**Some rows show only a string of letters and numbers instead of an address.** That is not a fault. The list stores a one-way fingerprint of each address rather than the address itself, so that a stolen copy of the database is not a list of who went to St Xavier's. Where an address does appear, it was recovered from that person's directory record. Where it does not, nobody can recover it — including the Association.

**Revoking** stops someone signing in again. A session they already have open stays alive until it expires; if that matters, also end their sessions from their record under Alumni records.

### Alumni records

Search, and open a record to see it whole.

**What you can change:** name, batch year, stream, organisation, role, previous role, contact number, other information. The identity fields are admin-only on purpose — they are what you match an access request against, and a free-text name on a public page is an obvious target for vandalism.

**What you cannot change:** their sign-in address, because changing it would move their account to a different mailbox. And their three privacy switches — those are their decision, made on their own profile page. Overriding them here would make the promise on that page untrue.

**Contact numbers and addresses are masked** as `•••••••3210`. The record page is the most sensitive screen in the portal and it is often open while someone is sharing a screen.

**The edit form does not pre-fill the contact number.** Leave it blank and the number stays as it is; type one to replace it; tick the box to remove it. This is so editing somebody's job title cannot silently delete their phone number.

**Archive, never delete.** Archiving removes them from the directory immediately but keeps the record, so the consent evidence and the audit trail survive. There is no delete button.

### Photographs

Alumni can upload their own photograph. It lands here first, and nobody but its owner sees it until you approve it.

That is because approving publishes an image on a page carrying the College's name. Three things go wrong in practice: something obscene, a photograph of someone who is not them, or a screenshot of text used to publish a message.

**Approving** is one click and should usually be same-day. **Rejecting** uses a fixed list of reasons — the reason is recorded here, but the email they receive is neutral and simply invites them to upload a different one. Nobody is ever blocked from trying again.

You can take down an approved photograph at any time.

### Audit log

Everything that has happened, oldest at the bottom.

**Read-only, and read-only all the way down** — nothing in this portal can edit or delete a row, including you, including the developers. Every row is identifiers and reason codes, never names or numbers, so the log itself never becomes a second copy of the data it exists to protect.

If you are ever asked "who approved this?" or "when did that change?", the answer is here.

### Administrators

Super admins only.

**Inviting** sends a one-time link that expires in 24 hours. They set their own password and enrol their own authenticator. Until they finish, no account exists — an invitation nobody opens leaves nothing behind.

**Two roles.** A *moderator* handles access requests and photographs. A *super admin* can also add and remove administrators.

**Disable, never delete.** Disabling ends every session they hold, immediately. Their history stays in the audit log, which is the point.

**Keep at least two super admins.** One administrator with one phone is one lost phone away from a locked portal, and the way back in then runs through a developer's laptop.

---

## Things that look wrong and are not

| What you see | Why |
|---|---|
| A grant shows a fingerprint, not an address | The list stores one-way hashes. Nobody can recover it. |
| "That code has already been used" | Each code works once. Wait thirty seconds. |
| Wrong password and wrong code give the same message | Otherwise the form confirms which half was right. |
| An alumnus's number shows as "Not shared" | They switched it off. Their choice, not a fault. |
| You cannot approve a request | It is not verified yet. They have not typed back their code. |
| A photo is not on the site after approving | Give it a moment, then reload. |
| You cannot delete anything | By design. Archive and disable keep the record. |

---

## If something is wrong

**Somebody says they cannot sign in.** Check **Access grants** first — is their address actually on the list? The sign-in page deliberately says the same thing to everyone, so "it says a link is coming but nothing arrives" is exactly what a non-listed address looks like.

**Somebody says their details are wrong.** Anything except name, batch, stream and sign-in address, they can fix themselves at their own profile. Point them there first — it is faster for both of you.

**Somebody wants to be removed.** They can do it themselves in one click at their own profile, and they do not need your permission. If they have emailed you instead, archive their record.

**You think an account has been compromised.** Disable it immediately under Administrators — that ends every session at once — then read the audit log filtered by that person. Then tell whoever maintains the system.

---

## The short version

- Nobody signs themselves up. You are the front door.
- Approve nothing that is not verified.
- Their privacy switches are theirs, not yours.
- Archive and disable. Never delete.
- Keep two super admins.
- If something looks like it is hiding information from you, it is probably protecting somebody. Check this guide before assuming it is broken.
