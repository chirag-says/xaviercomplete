# SXCCAA Alumni — Mobile App Implementation Plan

**Expo SDK 57 · React Native 0.86.3 · React 19.2.3**

Revision 3, 12 September 2026. Companion to `IMPLEMENTATION-PLAN-Auth-Access-Security.md`
(the website), `CUTOVER.md` (launch), `RUNBOOK.md` (operations) and `ADMIN-GUIDE.md`
(volunteers).

**Revision 3 removes the alumni connections feature from scope.** Revision 2's notification
delivery and idempotency fixes are retained in full. §12 records the change history.

---

## 0. What this document is

The client wants a mobile app that reproduces the SXCCAA website and adds two things:

1. **Notifications** — reunion reminders, chapter events, new event announcements
2. **Event pictures** — verified Xaverians take photos in-app and post them to a specific event

Plus everything else on the website, on a phone.

### Out of scope

**Alumni connections** — the Instagram-style request / accept / reject graph — was specified
in revisions 1 and 2 and has been **removed from scope**. It is not in the schema, the API,
the app, the phases or the estimate. §11 records what a later phase would need, so the
decision is reversible without re-deriving it.

Nothing else in the plan depended on it. Connections were deliberately designed not to
unlock any profile field, so removing them changes no privacy behaviour, and
`visibility.ts` remains untouched either way.

### The constraint, stated precisely

The client's words were "do not change any databases or flow of authentication or
anything". That is the intent; this is the engineering rule it becomes:

> **Do not modify any existing table, column, constraint, index, trigger, grant, policy,
> existing row, or existing data contract. New mobile functionality may use additive
> migrations only.**

Stated that way it is testable, and it is honest: the mobile app *does* change the
database — it adds seven tables and one role. What it does not do is touch anything that
exists. Specifically:

- The 16 existing tables are untouched. No column added, dropped or re-typed; no
  constraint or index altered; no existing grant or RLS policy modified.
- The sign-in flow is unchanged: email → six-digit code → a row in `session`, 7-day
  absolute lifetime, 24-hour idle timeout, allowlisted through `access_grant`, and wrong /
  expired / exhausted / unknown all collapsed into one `invalid`.
- No existing website route, page, component or server action is modified. The app talks
  to a **new, additive** `/api/app/v1/**` namespace that calls the same `src/lib/**`
  functions the website already calls.
- The three existing roles keep their exact grants. A fourth role, `sxc_notify`, is created
  for the push job with its own narrow grants (§4.6).

### Decisions locked on 12 September 2026

| Decision | Choice |
|---|---|
| Replica fidelity | Native rebuild of every screen; same content, fonts, colours and IA; mobile-native layout |
| Event photo storage | `bytea` in Postgres, reusing the existing `src/lib/photo.ts` pipeline |
| Event photo moderation | Live immediately; admins remove; in-app report button |
| Alumni connections | **Removed from scope** |
| Profile field visibility | `visibility.ts` untouched; no new viewer tier |

These are settled. The rest of this document is implementation.

---

## 1. What already exists (and what it means for the app)

I read the codebase rather than assume. The findings that shape every decision below:

**There is no Supabase client anywhere.** `package.json` has no `@supabase/supabase-js`.
The website connects straight to Postgres with the `postgres` npm driver as a
least-privilege role (`sxc_web`), and `src/lib/db.ts:61` refuses to start without it.
The `anon` and `authenticated` Supabase roles have been revoked from every table by
enumeration in migrations 0001, 0003, 0006 and 0007, and `service_role` is never used.

> **Consequence:** the app cannot talk to the database. There is no anon key to hand it,
> and if there were, it would return zero rows. Everything goes over HTTPS to the Next.js
> server. This is the right design — it means no database credential ever ships inside an
> app bundle, where anyone can extract it.

**Sessions are opaque tokens, not JWTs.** `newToken()` is 32 random bytes; the database
stores only `sha256(token)`. There are no claims to decode and no signature to verify.
The cookie is `__Host-sxc_session`, `httpOnly`, `Secure`, `SameSite=Lax`.

**Every POST is CSRF-guarded by an origin check**, not a token. `isSameOrigin()` in
`src/lib/request.ts:59` refuses any request that has neither an `Origin` nor a `Referer`
header — which is exactly what React Native's `fetch` sends. As written, **every POST
endpoint returns 403 to a native client.**

**All `/me` mutations are Next server actions**, not HTTP endpoints. `saveProfile`,
`uploadPhoto`, `deletePhoto` and `setVisibility` live in `src/app/me/actions.ts`. There is
no REST equivalent, so an app cannot currently edit a profile at all. Fortunately they are
thin wrappers over `src/lib/me.ts`, which the new routes call directly.

**Events, gallery, news and all marketing copy are static TypeScript** under
`src/data/**` — 14 files, no database, no CMS. Only the alumni directory is DB-backed.
That is good news for the app (the content is trivially serialisable) and one problem: an
event has no database row, so nothing can reference it. §4.1 solves that.

**Profile photo bytes are in Postgres, not object storage**, and migration 0007 explains at
length why Supabase Storage was rejected. The upload pipeline in `src/lib/photo.ts` is
genuinely good — streaming size cap, magic-byte sniff that ignores `Content-Type` and the
filename entirely, dimension probe before decode, `sharp` re-encode, EXIF/GPS strip. The
app reuses it verbatim for event photos.

**Turnstile is mandatory in production** on `/api/auth/request`, `/api/access-request` and
`/api/enquiry`, and fails closed. A native app has no widget. §2.3 solves that.

---

## 2. The three things that must change, and why

These are additive. The website's behaviour is bit-for-bit unchanged in all three cases.

### 2.1 How the session token is carried

**Unchanged:** the token itself, `createSession()`, `readSession()`, the `session` table,
`sha256` storage, the 7-day absolute and 24-hour idle clocks, revocation, the sweep.

**New:** `POST /api/app/v1/auth/verify` returns the token in the JSON body instead of
setting a cookie. The app stores it in `expo-secure-store` (iOS Keychain / Android
EncryptedSharedPreferences, hardware-backed) and sends `Authorization: Bearer <token>` on
every subsequent request. The server calls the *same* `readSession(token)`.

Why this is necessary, not preference:

- The `__Host-` cookie prefix forbids a `Domain` attribute and requires `Secure` and
  `Path=/`. Native cookie jars handle prefixed cookies inconsistently across iOS and
  Android versions, and cookie persistence across app restarts is not guaranteed.
- The cookie is `httpOnly`, so the app's JavaScript cannot read it to know whether it is
  signed in, when it expires, or to clear it deliberately.
- A cookie in a native HTTP client cannot be scoped the way Keychain can — no biometric
  gate, no "this item does not sync to iCloud", no wipe on device removal.

Why it is not a security downgrade: `expo-secure-store` is the platform-blessed store for
exactly this. And because a bearer token is sent deliberately rather than attached
ambiently by the platform, **CSRF is structurally impossible on these routes** — which is
what lets us drop the origin check in §2.2 without losing anything.

### 2.2 The origin check on app routes

`isSameOrigin()` exists to stop a malicious page at `evil.example` from POSTing to
`sxccaa.org` and having the browser attach the session cookie automatically. That attack
requires a browser with an ambient credential. The app routes have neither: no cookie is
read, and the token only travels when our own code puts it in a header.

So `/api/app/v1/**` does not call `isSameOrigin()`. Every route file carries a comment
saying why, so nobody "fixes" it later. The website's six POST routes keep the check
exactly as it is.

Abuse control on the unauthenticated app routes (`auth/request`, `auth/verify`, `enquiry`,
`access-request`) is unchanged: the same `LIMITS` token buckets keyed on `ipBlindIndex`,
plus Turnstile per §2.3.

### 2.3 Turnstile from a native app

Cloudflare does not ship a React Native Turnstile SDK. The approach that keeps the
protection intact and requires no change to `src/lib/turnstile.ts`:

1. Add one tiny page to the website, `/embed/turnstile`, which renders the widget and
   nothing else.
2. The app loads that URL as the top-level document in a `react-native-webview`.
3. On success the page calls `window.ReactNativeWebView.postMessage(token)`.
4. The app sends the token in the JSON body, exactly as the website's form does.

The existing CSP already allows `https://challenges.cloudflare.com` in both `script-src`
and `frame-src`, and `frame-ancestors 'none'` does not apply because the WebView loads the
page as a top-level document, not a frame. So no header changes.

**This is the most fragile part of the plan and it is documented as such.** It is a browser
control running in a non-browser. Specific risks and mitigations:

- A future Turnstile change could break sign-in on already-shipped binaries. Mitigated by
  the `minSupportedVersion` gate in `GET /config` (§5), which lets us force an upgrade.
- The WebView is a second rendering engine in the app, with its own update cadence. It is
  used for exactly one page and renders no SXCCAA content, so its blast radius is the
  challenge itself.
- If the challenge fails to load, the app must show a plain "Couldn't load the security
  check — retry" state, never a blank WebView. The app also offers "open in browser" as a
  fallback path to `/login` on the website.
- The rate limits stand entirely on their own. If Turnstile were removed tomorrow, the
  3/hour and 5/day per-email and 10/hour per-IP buckets still bound the damage. Turnstile
  is a cost multiplier for an attacker, not the control of record.

Alternatives considered and rejected: **App Attest / Play Integrity** is stronger but needs
new server-side verification and locks out sideloaded and emulator builds during
development; **`REQUIRE_TURNSTILE=false` for app routes** removes bot protection from the
endpoint that sends email, and is not acceptable.

---

## 3. Architecture

```
┌──────────────────────────────┐
│  mobile/  (Expo SDK 57)      │   iOS + Android
│  expo-router · Reanimated    │
│  token in expo-secure-store  │
└──────────────┬───────────────┘
               │ HTTPS · Authorization: Bearer
               ▼
┌──────────────────────────────┐
│  oxvercity/  (Next.js 15)    │   port 3300
│                              │
│  /api/app/v1/**   ← NEW      │──┐
│  /api/**          unchanged  │  │  both call the same
│  /me actions      unchanged  │  │  src/lib/** functions
│  pages            unchanged  │──┘
└──────────────┬───────────────┘
               │ postgres driver, role sxc_web
               ▼
┌──────────────────────────────┐      ┌─────────────────────────┐
│  Supabase Postgres           │◄─────│ tools/notify/run.ts     │
│  16 tables       unchanged   │      │ role sxc_notify         │
│  7 new tables    0014–0016   │      │ NotificationService     │
└──────────────▲───────────────┘      │   └─ ExpoPushProvider   │
               │ role sxc_admin       └─────────────────────────┘
┌──────────────┴───────────────┐
│  admin/  (Next.js)           │   port 3400
│  + event admin      ← NEW    │
│  + photo moderation ← NEW    │
│  + push composer    ← NEW    │
└──────────────────────────────┘
```

New directory `mobile/` beside `oxvercity/` and `admin/`, its own git repo to match the
existing convention. Shared code stays shared by being **fetched at runtime** from the
content endpoint rather than by extracting a `packages/core` monorepo — which was
deliberately not built, and which would mean a full App Store release for every typo fix.

### Verified Expo SDK 57 dependency pins

Read from the published `expo-template-default@sdk-57`, not from memory:

```
expo                          ~57.0.22
react                          19.2.3
react-dom                      19.2.3
react-native                   0.86.3
expo-router                   ~57.0.21
react-native-reanimated        4.5.1
react-native-worklets          0.10.1
react-native-screens          ~4.26.0
react-native-gesture-handler  ~2.32.0
react-native-safe-area-context ~5.7.0
expo-image                    ~57.0.5
expo-font                     ~57.0.4
expo-constants               ~57.0.18
typescript                    ~6.0.3
```

Added for this project: `expo-secure-store` (~57.0.4), `expo-notifications` (~57.0.18),
`expo-image-picker` (~57.0.17), `expo-camera` (~57.0.4), `expo-file-system`, `expo-device`,
`expo-linking`, `react-native-webview`, `expo-screen-capture`, `expo-local-authentication`,
`@shopify/flash-list`. Server-side: `expo-server-sdk` (7.2.0).

Reanimated 4 requires `react-native-worklets` as a separate package and the New
Architecture, which is the default in SDK 57.

---

## 4. Database work — migrations 0014 to 0016

**Seven new tables and one new role, across three migration files.** Existing objects are
not touched.

**The 0005 lesson applies to every one of them.** Because migration 0003 set
`alter default privileges ... revoke all` for `anon` and `authenticated`, new tables start
closed — good. But a new table needs **both** an explicit `grant` **and** a permissive RLS
policy naming the roles that use it, or `update` and `select` silently match zero rows and
look like success. Every migration below includes both, and `db:verify` gains assertions
for each table and each role.

Also: `alumni.id` is `text` (12 chars, Crockford-ish alphabet with `0 1 l o` excluded),
**not uuid**. Every foreign key to it is `text`.

### 4.1 `0014_app_events.sql` — giving events an identity

Events are static TypeScript today, so nothing can point at one. This table gives each
event a row **without moving the content into the database** — the copy and images still
come from `src/data/pages/events.ts`, and the website keeps rendering them statically,
unchanged.

```
app_event
  slug                  text PK      check ~ '^[a-z0-9]+(-[a-z0-9]+)*$', length 1..80
  title                 text         not null, length 1..200
  starts_at             timestamptz  null
  ends_at               timestamptz  null
  place                 text         null, length <= 200
  kind                  text         not null default 'event'   in (event, reunion, chapter_meet)
  source                text         not null default 'website' in (website, app)
  album_enabled         boolean      not null default true
  registration_url      text         null, check ~ '^https?://'
  registration_opens_at timestamptz  null
  announced_at          timestamptz  null
  created_by            uuid         null → admin_user(id) on delete set null
  created_at            timestamptz  not null default now()
  updated_at            timestamptz  not null default now()

  trigger app_event_touch → touch_updated_at()
  index   app_event_upcoming on (starts_at) where starts_at is not null
```

`slug` deliberately matches the existing static `AlumniEvent.id` values
(`ripples-of-hope`, and the nine others), so `source = 'website'` rows are the same events
the website already shows. `source = 'app'` rows are app-only events the admin portal can
create without a code deploy.

`announced_at` records when the `event_new` notification fan-out happened. It is a
convenience for the admin UI and for reporting — **it is not the idempotency mechanism.**
That is `notification.source_key` (§4.3), which is enforced by the database.

#### Authoritative fields, and how drift is prevented

The duplication is deliberate: the push job needs a title, a date and a place without
importing the website's React data modules. So the rule must be written down.

| Field | Authoritative source | Notes |
|---|---|---|
| `slug` / `AlumniEvent.id` | **static**, for `source='website'` | `app_event` must match |
| title, description, images, strands, source link | **static** | `app_event.title` is a denormalised copy |
| `starts_at`, `ends_at` | **`app_event`** | the static file holds display strings like `24 Aug 2025`, not timestamps |
| `place` | **static**; copied to `app_event` | |
| `album_enabled`, `registration_url`, `registration_opens_at`, `kind` | **`app_event`** | no static equivalent |
| everything, for `source='app'` | **`app_event`** | app-only events have no static row |

`npm run events:verify` asserts all of it and **exits 1 on any drift** — a missing row, an
orphan row, or a mismatched title or place for a website event. It runs in CI on every push
and is a required check, and it is part of `launch:check`. Drift fails the build; it does
not produce a warning somebody scrolls past.

### 4.2 `0015_event_photos.sql` — pictures attached to an event

```
event_photo
  path          text PK      check ~ '^[2-9a-km-np-z]{22}$'
  event_slug    text         not null → app_event(slug) on delete cascade
  alumni_id     text         not null → alumni(id) on delete cascade   -- uploader
  webp          bytea        not null
  jpeg          bytea        not null
  width         int          not null, check 1..4000
  height        int          not null, check 1..4000
  source_type   text         not null, length <= 40
  source_bytes  int          not null, check 1..15728640
  caption       text         null, length <= 280
  status        text         not null default 'live'   in (live, removed)
  removed_by    uuid         null → admin_user(id) on delete set null
  removed_at    timestamptz  null
  report_count  int          not null default 0, check >= 0
  created_at    timestamptz  not null default now()

  check   event_photo_removal_is_attributable: status <> 'removed' or removed_at is not null
  index   event_photo_album    on (event_slug, created_at desc) where status = 'live'
  index   event_photo_mine     on (alumni_id, created_at desc)
  index   event_photo_reported on (report_count desc) where status = 'live' and report_count > 0

event_photo_report
  photo_path    text         not null → event_photo(path) on delete cascade
  alumni_id     text         not null → alumni(id) on delete cascade
  reason        text         null, length <= 40
  created_at    timestamptz  not null default now()
  PK (photo_path, alumni_id)
```

`path` follows `alumni_photo`'s design exactly: a random 22-character key with no
relationship to the event or the uploader, so a leaked photo URL identifies nobody and
cannot be walked back.

The composite primary key on `event_photo_report` is the whole point — one person cannot
inflate `report_count` on a photo they dislike, and re-reporting is an idempotent no-op
rather than an error the client has to interpret.

Storage arithmetic, since this is the decision that could bite later: a 1600px WebP is
roughly 250 KB and its 800px JPEG fallback roughly 90 KB, so ~340 KB per photo. Twenty
photos across each of fifty events is ~340 MB. Supabase Pro's 8 GB disk leaves headroom for
roughly 24,000 photos. The number to watch is total database size in the Supabase
dashboard; `RUNBOOK.md` gains a line about it, and the migration file records that the move
to object storage becomes worth its service-role key somewhere north of 2 GB.

#### Upload abuse controls — all inherited, none reimplemented

Every control below already exists in `src/lib/photo.ts` and is reached by *calling it*,
not by writing a second pipeline. The event photo route differs from the profile photo
route in exactly two ways: the output dimensions (1600px WebP + 800px JPEG, because these
are landscape photographs people pinch to zoom, not 3:4 portrait cards) and the table the
bytes land in.

| Control | Where it already lives |
|---|---|
| Streaming size cap before buffering | `readCapped()`, `MAX_UPLOAD_BYTES` = 15 MB |
| Magic-byte format sniff; `Content-Type` and filename ignored | `file-type`, `ACCEPTED` set |
| Dimension probe **before** decode — decompression-bomb guard | `MAX_SOURCE_DIMENSION` = 8000 |
| Pixel-count ceiling | `too_many_pixels` rejection |
| Re-encode through `sharp`, discarding the original | `processPhoto()` |
| EXIF/GPS strip, with a test asserting it | `src/lib/photo.ts` + `tests/` |
| Multipart body ceiling | `experimental.serverActions.bodySizeLimit: '15mb'` |

New rate limits added to the existing `LIMITS` object (the `rate_limit` table itself needs
no change — `bucket` is already `text`):

| Key | Bucket | Limit |
|---|---|---|
| `eventPhotoDay` | `evphoto:alumnus:d` | 10 / day |
| `photoDeleteDay` | `evphoto:del:alumnus:d` | 20 / day |
| `photoReportDay` | `evreport:alumnus:d` | 20 / day |

Every upload, removal, report and moderation decision writes an `audit_log` row — actions
`event_photo_upload`, `event_photo_delete`, `event_photo_report`, `event_photo_remove`.
The existing append-only trigger applies.

### 4.3 `0016_notifications.sql` — feed, delivery, devices, preferences

This is the section revision 1 got wrong. The runner was described as sending "rows with no
push attempt yet" against a table that recorded no attempt. Both the delivery state and the
creation idempotency are now enforced by the database.

```
notification
  id           uuid PK default gen_random_uuid()
  source_key   text         not null UNIQUE, check length 1..160
  alumni_id    text         not null → alumni(id) on delete cascade
  kind         text         not null  in (event_new, event_reminder, chapter_event,
                                          photo_removed, broadcast)
  title        text         not null, length 1..120
  body         text         not null, length 1..400
  deep_link    text         null, length <= 200
  event_slug   text         null → app_event(slug) on delete set null
  read_at      timestamptz  null
  created_at   timestamptz  not null default now()

  index notification_feed   on (alumni_id, created_at desc)
  index notification_unread on (alumni_id) where read_at is null
```

```
notification_delivery
  id               uuid PK default gen_random_uuid()
  notification_id  uuid        not null → notification(id) on delete cascade
  device_token_id  uuid        not null → device_token(id) on delete cascade
  status           text        not null default 'pending'
                               in (pending, accepted, delivered, failed, skipped)
  attempts         smallint    not null default 0, check 0..5
  next_attempt_at  timestamptz not null default now()
  attempted_at     timestamptz null
  sent_at          timestamptz null
  receipt_id       text        null, length <= 120
  error_code       text        null, length <= 40
  created_at       timestamptz not null default now()

  UNIQUE (notification_id, device_token_id)

  check delivery_attempt_is_stamped:
        status not in ('accepted','delivered','failed') or attempted_at is not null
  check delivery_failure_has_code:
        status <> 'failed' or error_code is not null
  check delivery_accepted_has_receipt:
        status <> 'accepted' or receipt_id is not null

  index notification_delivery_due
        on (next_attempt_at) where status = 'pending'
  index notification_delivery_awaiting_receipt
        on (receipt_id) where status = 'accepted'
  index notification_delivery_by_notification on (notification_id)
```

```
device_token
  id            uuid PK default gen_random_uuid()
  alumni_id     text         not null → alumni(id) on delete cascade
  token_hash    bytea        not null UNIQUE, check length = 32
  token_enc     bytea        not null
  platform      text         not null in (ios, android)
  app_version   text         null, length <= 40
  created_at    timestamptz  not null default now()
  last_seen_at  timestamptz  not null default now()
  revoked_at    timestamptz  null
  revoked_code  text         null, length <= 40

  index device_token_live on (alumni_id) where revoked_at is null

notification_pref
  alumni_id          text PK → alumni(id) on delete cascade
  events             boolean     not null default true
  chapters           boolean     not null default true
  broadcasts         boolean     not null default true
  quiet_hours_start  smallint    null, check 0..23
  quiet_hours_end    smallint    null, check 0..23
  updated_at         timestamptz not null default now()
```

#### `source_key` — creation idempotency, enforced by a constraint

`notification.source_key` is `UNIQUE`, and every producer computes it deterministically
rather than checking whether it already did the work. `insert ... on conflict (source_key)
do nothing` is the only way a notification is ever created.

| Kind | `source_key` |
|---|---|
| `event_new` | `event_new:<event_slug>:<alumni_id>` |
| `event_reminder` | `event_reminder:<event_slug>:<alumni_id>` |
| `chapter_event` | `chapter_event:<event_slug>:<alumni_id>` |
| `photo_removed` | `photo_removed:<photo_path>` |
| `broadcast` | `broadcast:<broadcast_id>:<alumni_id>` |

This replaces the timestamp-based "rows created since the last run" logic from revision 1
entirely. There is no "last processed" cursor to lose, no clock to trust, and no reason the
job cannot run twice, or from two machines, or be re-run by hand after a failure. Ten runs
produce one notification.

It also retires the `notification_one_reminder` partial unique index proposed in revision 1
— `source_key` covers that case and every other one, with one mechanism instead of a
special case per kind.

#### `notification_delivery` — exactly-once per notification per device

One alumnus can have several devices; a phone and a tablet each need their own outcome.
`UNIQUE (notification_id, device_token_id)` is the whole guarantee.

Delivery rows are created **lazily at dispatch time**, not when the notification is
created, with `insert ... on conflict do nothing`. That way a device registered five
minutes after a notification was written still receives it, and a device revoked in the
meantime never gets a row. To stop a newly registered device receiving a backlog, the
dispatcher only considers notifications created in the **last 72 hours**.

The lifecycle maps onto Expo's two-phase model, which I verified against
`expo-server-sdk@7.2.0` rather than recalling:

```
pending ──send──┬─► accepted (ticket status 'ok', receipt_id recorded)
                │        │
                │        └──receipt check──┬─► delivered  (receipt 'ok')
                │                          └─► failed     (receipt 'error')
                ├─► failed   (ticket status 'error', terminal error code)
                └─► pending  (retryable error; attempts+1, next_attempt_at pushed out)

skipped ◄── preference off, or inside quiet hours   (recorded, not silently dropped)
```

`sendPushNotificationsAsync()` returns a **ticket** per message: `{status:'ok', id}` or
`{status:'error', details:{error}}`. A ticket says Expo accepted the message, not that the
device got it. `getPushNotificationReceiptsAsync()` is polled on a later run to learn the
real outcome — which is where `DeviceNotRegistered` usually surfaces. Chunk limits are the
SDK's own constants: **100** messages per send, **300** receipt IDs per receipt request.

Error codes are normalised to our own vocabulary so `error_code` is not Expo-specific and
the provider stays swappable (§5.1):

| Expo error | Our `error_code` | Handling |
|---|---|---|
| `DeviceNotRegistered` | `device_not_registered` | terminal; revoke the `device_token` row with `revoked_code` |
| `MessageTooBig` | `message_too_big` | terminal; log — this is our bug, not the device's |
| `MessageRateExceeded` | `rate_exceeded` | retryable with backoff |
| `ProviderError`, `ExpoError` | `provider_error` | retryable with backoff |
| `InvalidCredentials` | `invalid_credentials` | terminal; **pages an operator** — APNs/FCM config is broken for everyone |
| `DeveloperError` | `developer_error` | terminal; log loudly |
| *(anything else)* | `unknown` | retryable, capped at 5 attempts |

Backoff is stored, not computed in the runner: `next_attempt_at = now() + 2^attempts
minutes`, capped at 5 attempts, after which the row is `failed` with the last code. The due
query is therefore a plain `where status='pending' and next_attempt_at <= now()`, which is
index-backed and safe to run concurrently.

`skipped` matters more than it looks. A notification suppressed by a preference or by quiet
hours leaves a row saying so. Without it, "why didn't I get that?" is unanswerable, and the
runner cannot tell "suppressed on purpose" from "never attempted".

#### The push token is encrypted, not stored plain

An Expo push token is a durable identifier for a specific person's specific device. It gets
the same treatment as every other identifier in this schema: AES-256-GCM through
`encryptField`, with AAD `device_token:<row id>:pushToken`, alongside a `token_hash` blind
index so an upsert can find the row without decrypting anything. This is not theatre — it
means a database dump cannot be turned into a list of devices to push to.

### 4.4 Notification content rules

No PII goes into a push payload. Notification bodies transit Apple's and Google's servers
and appear on a lock screen.

- **Allowed:** event titles, dates and places; the association's name
- **Never:** phone numbers, email addresses, the contents of `other_info` or
  `previous_role`, batch year combined with a name, or anything read out of an encrypted
  column
- `deep_link` carries opaque ids only (`sxccaa://events/<slug>`), never a name or an email

### 4.5 Grants — per the 0005 lesson

| Table | `sxc_web` | `sxc_admin` | `sxc_notify` |
|---|---|---|---|
| `app_event` | SELECT | all | SELECT |
| `event_photo` | SELECT, INSERT, DELETE; UPDATE on `(report_count)` | all | — |
| `event_photo_report` | SELECT, INSERT | SELECT, DELETE | — |
| `notification` | SELECT, INSERT, UPDATE | SELECT, INSERT | SELECT, INSERT |
| `notification_delivery` | — | SELECT | SELECT, INSERT, UPDATE |
| `device_token` | SELECT, INSERT, UPDATE | SELECT | SELECT, UPDATE |
| `notification_pref` | SELECT, INSERT, UPDATE | SELECT | SELECT |

Deliberate narrowings, each with a reason:

- `sxc_web` gets column-level UPDATE on `event_photo.report_count` and nothing else,
  mirroring how `alumni` already restricts the web role — the app can flag a photo, but
  cannot un-remove one an admin removed.
- `sxc_web` gets nothing at all on `notification_delivery`. Delivery state is the push
  job's business; a request handler has no reason to read or write it.
- `sxc_notify` gets UPDATE on `device_token` for exactly one purpose — setting
  `revoked_at` / `revoked_code` on `DeviceNotRegistered`. No INSERT, no DELETE.
- `sxc_ingest` gets nothing on any new table.

### 4.6 The `sxc_notify` role

The push job needs to read notifications, decrypt device tokens and write delivery state.
None of the three existing roles is right: `sxc_web` is reachable from the internet and
must not hold device tokens for every alumnus, and `sxc_admin` is the admin portal's
credential — sharing it would widen the portal's blast radius to a cron job.

So `0016` creates a fourth role, following the pattern migration 0002 established for
exactly this reason:

```
create role sxc_notify login nocreatedb nocreaterole noinherit
  password :'notify_password';
revoke create on schema public from sxc_notify;
```

Its grants are the right-hand column of §4.5, plus INSERT on `audit_log` and the sequence
usage that needs. No sessions, no admin tables, no alumni writes, no deletes anywhere.
`NOTIFY_DATABASE_URL` goes in `.env` alongside the others, and `migrate.ts` generates
`SXC_NOTIFY_PASSWORD` the same way it already generates the other three. `db:verify` gains
assertions that `sxc_notify` is denied on `session`, `admin_user`, `alumni` writes and
`event_photo`.

Creating a role is additive; no existing role's grants change.

---

## 5. Server work — the `/api/app/v1` namespace

Thirty routes. Every one is thin: parse, authorise, call an existing `src/lib` function,
serialise. No business logic is duplicated, which is what keeps the app and the website
from drifting.

Shared helper `src/lib/app-api.ts`:
- `bearerSession(request): Promise<Session | null>` — reads `Authorization: Bearer`, calls
  the existing `readSession()`. The only new way to resolve a session.
- `requireSession(request)` — or a `401 { error: 'unauthenticated' }`
- `requireOwner(session, alumniId)` — resolves the caller's own `alumni.id` server-side
- `jsonError(status, code)` — machine-readable `code`, human `message`; never leaks detail
- `cursor` helpers — opaque base64 keyset cursors, not offsets

### 5.0 Authorization is server-side, without exception

**No route trusts anything the client says about identity, ownership or state.** The client
is assumed hostile; it is code on someone else's phone, and it can be edited.

Concretely, the following never come from the request body, a query parameter or a header:

| Never from the client | Always derived server-side from |
|---|---|
| who the caller is | `readSession(bearer)` → `session.emailHmac` → the `alumni` row |
| whether the caller is verified | `tierOf(session)`, as the website does it |
| whether the caller owns a profile | the session's own `alumni.id`, re-read per request |
| whether the caller uploaded a photo | `event_photo.alumni_id` compared server-side |
| whether a field is visible | `visibility.ts`, from the owner's stored toggles |
| any admin capability | not reachable from `/api/app/v1` at all, at any privilege |
| remaining view budget | `spendProfileView()` against the database |

An `alumniId` in a request body is only ever a *target* — "show me this person" — never an
assertion about the caller. The mistake this rule exists to prevent is a client passing its
own `alumniId` and the server believing it. Authorization-bypass tests per endpoint are in
phase 8 (§8).

### Auth
| Route | Notes |
|---|---|
| `POST /auth/request` | `{ email, turnstileToken }` → always the neutral 200. Calls `requestSignInCode()` unchanged. Keeps the 1200 ms response floor. |
| `POST /auth/verify` | `{ email, code }` → `{ token, expiresAt }`. Calls `verifySignInCode()` unchanged; returns what it already returns instead of setting a cookie. Every failure is one `invalid`. |
| `POST /auth/logout` | Bearer → `revokeSession()`; `{ scope: 'everywhere' }` → `revokeAllSessions()`. Also revokes this device's push token. `204`. |
| `GET  /me` | `{ signedIn, name, initials, photoUrl, alumniId, unreadCount }` |

The login screen must advance to the code step **even for an address that is not
registered** — the same trap `npm run auth:verify` already asserts for the website. The
app's e2e test asserts it too.

### Config and content
| Route | Notes |
|---|---|
| `GET /config` | `{ minSupportedVersion, turnstileEmbedUrl, turnstileSiteKey, features }`. Lets us force an upgrade on a broken build — worth having from day one, because you cannot patch a shipped binary. |
| `GET /content` | The whole static bundle: nav, site, home, about, chapters, events, explore, contact, faq, search index. Strong `ETag` from a content hash; `Cache-Control: public, max-age=300`. |

`GET /content` is how "everything as it is on the website" stays true over time. The app
caches the bundle to disk and revalidates with `If-None-Match`, so copy edits reach users
on next launch with no App Store review. It contains **only** public website content — see
§6.5 for what may and may not be persisted.

### Directory
| Route | Notes |
|---|---|
| `GET /alumni` | `?q=&batchYear=&stream=&cursor=&limit=` keyset-paginated at 30. Tier-aware through the existing `tierOf()` and `toPublic()`. |
| `GET /alumni/:id` | Full profile. Calls `spendProfileView()`, so the existing 60/hr and 200/day budgets apply identically; `429 view_budget_exhausted`. |
| `GET /alumni/:id/photo` | Delegates to `readPhotoBytes()`. Honours `photo_audience`. |

The website ships the entire directory in one query. On mobile that is wrong — 500 rows
with photo URLs on a slow connection is a blank screen. Pagination is a client-side
improvement, not a rule change: the same rows, the same fields, the same tier.

### Own profile
| Route | Replaces server action |
|---|---|
| `GET    /me/profile` | — |
| `PATCH  /me/profile` | `saveProfile` |
| `POST   /me/photo` | `uploadPhoto` (multipart) |
| `DELETE /me/photo` | `deletePhoto` |
| `PATCH  /me/visibility` | `setVisibility` |

All five call `src/lib/me.ts` directly. `profileSaveHour` (20/hr) and `photoUploadDay`
(5/day) apply unchanged.

### Events and photos
| Route | Notes |
|---|---|
| `GET    /events` | Merges static content with `app_event` state. `?filter=upcoming\|past\|all` |
| `GET    /events/:slug` | One event plus its album's first page |
| `GET    /events/:slug/photos` | `?cursor=` keyset, 24 per page, `status='live'` only |
| `POST   /events/:slug/photos` | **Verified only.** Multipart. Runs the unmodified `src/lib/photo.ts` pipeline. Refused when `album_enabled` is false. |
| `GET    /events/photos/:path` | Raw bytes, rendition picked from `Accept` |
| `DELETE /events/photos/:path` | Uploader's own photo only, checked server-side |
| `POST   /events/photos/:path/report` | Inserts into `event_photo_report`, recounts |

### Notifications and devices
| Route | Notes |
|---|---|
| `GET    /notifications` | `?cursor=`, 30 per page |
| `POST   /notifications/read` | `{ ids }` or `{ all: true }` |
| `GET    /notifications/prefs` | Creates a default row on first read |
| `PATCH  /notifications/prefs` | |
| `POST   /devices` | `{ expoPushToken, platform, appVersion }`, upsert on `token_hash` |
| `DELETE /devices` | Revoke on sign-out |

### Forms
| Route | Notes |
|---|---|
| `POST /enquiry` | JSON, unlike the website's FormData-only handler. Calls the same `src/lib/enquiry.ts`. |
| `POST /access-request` | JSON |
| `POST /access-request/verify` | JSON |

Note the trap in `src/app/api/enquiry/route.ts`: the real fields are capitalised (`Name`,
`Email`, `Message`) and lowercase `message` is a **honeypot**. The app route takes clean
JSON and maps to the library's expected shape, so the honeypot cannot be tripped by our own
client.

### 5.1 `NotificationService` — business logic, provider-agnostic

Expo is right for V1 and wrong to hard-code. The notification logic — who gets what, which
preferences apply, quiet hours, idempotency, retry, backoff — must not be entangled with
one vendor's HTTP client.

```
src/lib/notify/
  index.ts          NotificationService: enqueue() · dispatchDue() · reconcileReceipts()
  provider.ts       interface PushProvider  ← the seam
  expo-provider.ts  ExpoPushProvider implements PushProvider
  errors.ts         normalise(vendorError) → PushErrorCode
  types.ts          PushMessage · PushTicket · PushReceipt · PushErrorCode
```

```ts
interface PushProvider {
  readonly sendChunkSize: number;
  readonly receiptChunkSize: number;
  send(messages: PushMessage[]): Promise<PushTicket[]>;
  receipts(ids: string[]): Promise<Map<string, PushReceipt>>;
}
```

`index.ts` never imports `expo-provider.ts`. The provider arrives by injection, which is
what makes the duplicate-push and retry tests in §8 possible — they run against a fake
provider that can be told to fail, time out, or return `DeviceNotRegistered` on demand,
with no network involved. `PushErrorCode` is our vocabulary (§4.3), not Expo's, so
`notification_delivery.error_code` survives a provider change. Chunk sizes come from the
provider because they are a vendor detail (100 and 300 for Expo).

Replacing Expo later means writing one file that satisfies `PushProvider`. No business
logic, no schema, and no test moves.

### 5.2 The push runner

`oxvercity/tools/notify/run.ts`, connecting as `sxc_notify`, safe to run concurrently and
safe to re-run:

1. **Produce.** Events starting in the next 24 hours → `event_reminder`. `app_event` rows
   not yet announced → `event_new` / `chapter_event`. Each is an
   `insert ... on conflict (source_key) do nothing`, so this step is idempotent regardless
   of how many times or how many places it runs.
2. **Fan out.** For notifications created in the last 72 hours, `insert into
   notification_delivery ... on conflict do nothing` for every live device whose owner's
   preferences allow that `kind`. Suppressed combinations are inserted as `skipped`.
3. **Dispatch.** `where status='pending' and next_attempt_at <= now()`, 100 per chunk.
   Tickets recorded as `accepted` with a `receipt_id`, or `failed`, or bumped for retry.
4. **Reconcile.** `where status='accepted'`, 300 receipt ids per request →
   `delivered` / `failed`. `DeviceNotRegistered` revokes the device row.

`npm run notify:dry` prints exactly what steps 1 to 3 would do and writes nothing — the
same shape as the existing `restore:proof` and `launch:check` tools.

### 5.3 Admin portal additions

Three screens in `admin/`, reusing its existing auth, step-up and audit logging:

- **Events** — create, edit and delete `app_event` rows; toggle albums; set registration
- **Photo moderation** — newest-first feed across all events, reported ones first, one-tap
  remove writing `removed_by` / `removed_at` and an `audit_log` row
- **Push composer** — compose, choose a segment (everyone / batch / stream, reusing
  `broadcast`'s segment vocabulary), preview the recipient count, send. Shows per-
  notification delivery counts read from `notification_delivery`, so "did it go out?" is
  answerable in the UI rather than by querying the database.

Photo moderation is load-bearing, not optional. "Live immediately" is only defensible
because removal is genuinely one tap for a volunteer, so this screen ships **in the same
phase as the upload feature** (phase 5), never after it.

---

## 6. The app itself

### 6.1 Navigation

The website's header is six pills plus an "Explore" dropdown, which does not translate to a
phone. The app uses a five-tab bar, and the marketing pages live behind "More" — the same
destinations, reachable in the same number of taps or fewer. This is a place where native
UX should intentionally differ from the website.

```
mobile/app/
  _layout.tsx                fonts, theme, auth, notification handler, deep links
  login.tsx                  modal — email → six-digit code
  (tabs)/
    _layout.tsx              tab bar
    index.tsx                Home
    events/index.tsx         Events
    events/[slug].tsx        Event detail + photo album
    alumni/index.tsx         Directory — search, filters, grid
    alumni/[id].tsx          Profile
    notifications.tsx        Feed          · badge = unread
    me.tsx                   Profile + settings
  more/
    about.tsx  chapters.tsx  explore.tsx  contact.tsx  search.tsx
    privacy-policy.tsx  terms-of-use.tsx
  capture.tsx                modal — camera → caption → upload
  photo/[path].tsx           modal — full-screen viewer, pinch to zoom
```

Every event photo tile carries a **Report photo** action. A profile screen offers the same
actions the website offers and no more — there is no social graph, so no connect, remove or
block affordance appears anywhere.

### 6.2 Design tokens

Lifted from the real values in `src/lib/tokens.ts` and the five per-section palettes, into
one `mobile/theme/` module. The website has no dark mode, so the app locks to
`userInterfaceStyle: 'light'` — a replica, not a reinterpretation.

```
ink        #111111      white      #ffffff     grey     #f8f8f8
ink70      rgba(17,17,17,.70)      cream    #f7f3ec
navy       #133e6d      gold       #c5a55a    maroon   #8b2332
accent     #f24         night      #0b0b0c    paper    #f7f6f3
radius     10 / 12 / 14 / 16 / 30 / 999
spacing    4 8 12 16 20 24 32 40 60
```

Fonts are the same three families the website uses: **Instrument Sans** for headings and
display, **Roboto** for body, **Inter** for navigation and UI labels. They ship inside the
binary rather than being downloaded, so a cold start never paints in the system face.

> **Correction, found in phase 1.** Revisions 1–3 said the app would ship the files already
> self-hosted in `oxvercity/public/fonts/`. It cannot: 79 of those 80 files are `.woff2`,
> a format React Native does not load. All three families are Google Fonts, so the app uses
> `@expo-google-fonts/*`, which supplies the identical typefaces as `.ttf`. No visual
> difference; the plan was simply wrong about the mechanism.
>
> **Import each weight from its own entry point, never the package root.** Every weight a
> package exports registers a `.ttf` with Metro, so a root import bundles all of them —
> `@expo-google-fonts/roboto` alone carries eighteen weights and their italics. The same
> applies to `@expo/vector-icons`, whose index re-exports twenty icon families.
> Measured on this app: root imports produced **63 font files and 14 MB** of assets;
> per-weight imports produce **7 files and 1.4 MB**. That is a 90% cut in asset weight for
> a two-line change, and it is invisible until someone measures.

The type scale is re-anchored for a phone. The website's h1 is 240px on desktop and 60px on
a phone; the app's largest display size is 40px, stepping down through 32 / 28 / 24 / 20
for headings and 17 / 15 / 13 for body — because a 60px heading on a 375pt screen fits four
words and pushes everything below the fold.

### 6.3 Mobile layout optimisation

Called out as a requirement, so it gets explicit treatment rather than being assumed.

**Safe areas.** `react-native-safe-area-context` everywhere; no hardcoded top or bottom
padding. Covers the notch, the Dynamic Island, the iPhone home indicator, and Android
gesture and three-button navigation bars, which differ in height across devices.

**Width classes.** `useWindowDimensions`, four breakpoints chosen from real device widths
rather than round numbers:

| Class | Width (dp) | Devices | Directory grid |
|---|---|---|---|
| compact | < 360 | iPhone SE, Galaxy A-series | 1 column |
| regular | 360–413 | iPhone 15/16, Pixel 8 | 2 columns |
| wide | 414–599 | Pro Max, Ultra | 2 columns, larger cards |
| tablet | ≥ 600 | iPad, Galaxy Tab, unfolded Fold | 3–4 columns |

**Font scaling.** Accessibility text sizes reach 310% on iOS. Text respects the user's
setting with `maxFontSizeMultiplier` capped per role (1.8 body, 1.3 display), so a
large-text user gets a readable app instead of a broken one. Every row that can grow is
tested at 200%.

**Orientation and foldables.** Portrait and landscape both supported; the Android manifest
sets `resizeableActivity` and `configChanges` so a fold or a split-screen resize does not
restart the activity. Layout is driven by measured width, never by an orientation boolean.

**Reduced motion.** `AccessibilityInfo.isReduceMotionEnabled()` gates every Reanimated
entrance. The website's Framer scroll effects become short, purposeful transitions — and
none of them when the user has asked for none.

**Slow and flaky networks.** Skeleton placeholders, never spinners on a blank screen.
`expo-image` with a blurhash placeholder. Mutations surface a "tap to retry" affordance
rather than failing silently.

**Image renditions.** `SiteImage.widths` already lists the available sizes, so the app picks
a rendition from `PixelRatio.getPixelSizeForLayoutSize(width)` instead of downloading a
2400px hero for a 390pt screen.

**Lists.** `@shopify/flash-list` for the directory, the album and the notification feed —
recycling matters at 500 alumni, and the difference is visible on a mid-range Android.

**VoiceOver and TalkBack.** Labels, roles and hints on every control; focus order checked
per screen; touch targets at least 44×44pt. The website's accessibility gap (the Framer
export has no landmarks — no `<main>`, no `<nav>`) does not carry over, because React
Native builds its accessibility tree from props rather than HTML elements. The app can be
more accessible than the site it replicates.

### 6.4 Notification permission UX

Three states that are routinely conflated and must be tracked separately:

| State | Source of truth | Meaning |
|---|---|---|
| OS permission | `getPermissionsAsync()` | `undetermined` / `granted` / `denied` |
| SXCCAA preference | `notification_pref` | which categories the alumnus wants |
| Device registration | `device_token` row, unrevoked | can we actually reach this device |

The flow, with no prompt-spamming:

```
first successful sign-in
        ↓
an explanatory screen — what notifications are for, three examples, no OS dialog yet
        ↓
   [ Turn on ]                      [ Not now ]
        ↓                                ↓
requestPermissionsAsync()          never prompted again from a flow
        ↓                          Settings shows a "Turn on" row
 granted ──► get Expo token ──► POST /devices
        ↓
  denied ──► app remains fully usable; nothing is gated on notifications
             Settings shows "Blocked in iOS Settings" + Linking.openSettings()
```

Rules:

- The OS dialog is requested **once**, and only after the user taps "Turn on". A denied
  permission is never re-prompted by the app — iOS ignores the second call anyway, and on
  Android it trains people to tap Deny.
- Denial degrades nothing. The in-app notification feed works without push; it is a
  `GET /notifications` list. Push is an accelerator.
- Preferences are independent of permission. A user can be `granted` at the OS level and
  have `events: false`, and the feed still shows the item — `notification_delivery` records
  it as `skipped`.
- On every foreground, re-check OS permission. If it was revoked in Settings, revoke the
  `device_token` row so the runner stops trying and does not accumulate failures.
- On sign-out, `DELETE /devices` revokes this device. A shared or resold phone must not
  keep receiving another alumnus's notifications.

### 6.5 Offline cache and what may never be persisted

The app caches so it opens usefully on a bad connection. It must not become an unencrypted
copy of the alumni directory on a device that gets lost.

**Two tiers, enforced by where things are written, not by convention.**

| Tier | Contents | Storage | Lifetime |
|---|---|---|---|
| **A — persist** | `/content` bundle, `/config`, static site imagery from `/images/**` | `FileSystem.documentDirectory`; `expo-image` with `cachePolicy="memory-disk"` | until replaced |
| **B — memory only** | directory rows, profile detail, contact number, Gmail, `previous_role`, `other_info`, profile photos, event photos, notification bodies | in-memory query cache; `expo-image` with `cachePolicy="memory"` | cleared on background, sign-out, and 401 |

**Never written to disk, under any circumstances:** any field decrypted from a `*_enc`
column, any profile photo or event photo bytes, any list of alumni names, and the session
token anywhere other than `expo-secure-store`.

Implementation rules, so this is checkable rather than aspirational:

- No persistence layer on the query client. There is no `AsyncStorage` persister and no
  MMKV store; the only two things written to disk are the content bundle and `/config`,
  both by explicit `FileSystem` calls in one module.
- `expo-image` defaults to `cachePolicy="memory"`. A shared `<SiteImage>` component is the
  *only* place `memory-disk` appears, and it accepts static asset paths only. Alumni and
  event photography goes through `<PrivateImage>`, which cannot be configured to persist.
- Tier B derives from an API response requiring a bearer token. "Did this need
  authentication?" is the test — if yes, it does not touch the disk.
- On sign-out: wipe the SecureStore token, clear the in-memory cache, and call
  `Image.clearDiskCache()` to remove anything a library cached despite the policy.
- Content lives in `documentDirectory`; anything transient goes to `cacheDirectory`, which
  iOS excludes from iCloud backup by default.
- Phase 8 asserts this. A test signs in, loads a profile with a visible contact number,
  backgrounds the app, then greps the entire app sandbox for that number and the alumnus's
  name. Finding either fails the build. That converts a policy into a regression test.

### 6.6 App-side security

- Session token in `expo-secure-store`, never `AsyncStorage`
- Optional biometric re-lock on resume via `expo-local-authentication` — off by default, a
  switch in settings. Reasonable for an app holding a directory of phone numbers.
- `expo-screen-capture` blocks screenshots on the profile screen where an owner has opted
  to show a contact number.

  > **This is defence-in-depth, not an authorization boundary.** Anyone can photograph a
  > screen with a second phone, and the API does not know whether a screenshot was taken.
  > It raises the effort of casual bulk harvesting and nothing more. The actual protection
  > is, and remains, entirely server-side: authorization on every route (§5.0),
  > `visibility.ts` deciding every field from the owner's stored toggles, the 60/hour and
  > 200/day profile view budget keyed on `session.emailHmac` so signing out does not reset
  > it, the rate limits, and `audit_log`. If `expo-screen-capture` were deleted tomorrow,
  > no data would become newly reachable. Never cite it as a reason to relax anything on
  > the server.

- Nothing secret in the bundle. The Turnstile **site** key is public by design; that is the
  only key the app carries. Everything in an app binary is readable — assume it.
- No analytics or crash-reporting SDK. SOW T-07 was deliberately not built, and adding a
  third-party SDK to an app used by 500 identifiable alumni is a data-sharing decision for
  the client, not a default.
- Deep links `sxccaa://` plus universal and app links, which need two files hosted on the
  website (see §9).
- `minSupportedVersion` from `GET /config` gives a hard upgrade gate. Without it, a bad
  build is unfixable for whoever does not update.

### 6.7 Android platform facts

Read from a real `expo prebuild --platform android`, not recalled.

| | Value | Consequence |
|---|---|---|
| `compileSdk` / `targetSdk` | **36** (Android 16) | Clears Play's current API 35 floor for new apps with a year in hand |
| `minSdk` | **24** (Android 7.0) | Effectively every phone in use; no legacy-storage code needed |
| Edge-to-edge | **mandatory** | `edgeToEdgeEnabled` is obsolete in SDK 57 and was removed from app.json; insets are read per screen |
| Cleartext HTTP | **debug only** | A release build physically cannot talk to `http://…:3300`; the dev server is unreachable from a shipped app |
| Artefact | **`.aab`** | Play takes an App Bundle, not an APK. `versionCode` must increase on every upload |

Two Android behaviours the plan has to account for explicitly:

- **`POST_NOTIFICATIONS` is a runtime permission from Android 13.** It is not granted at
  install. This is the same prompt-once flow as §6.4, but it now applies on the only
  platform we ship, so the "denied degrades to the in-app feed" path is the common case
  rather than an iOS edge case.
- **Predictive back.** Android 16 gestures animate the outgoing screen. expo-router's
  native stack handles it; what breaks it is intercepting the back button manually, so no
  screen does.

### 6.8 Permissions, and the six that were removed

The shipped manifest requests exactly five:

| Permission | Why |
|---|---|
| `INTERNET` | required |
| `CAMERA` | photograph straight into an event album (phase 5) |
| `READ_MEDIA_IMAGES` | choose an existing photograph instead (phase 5) |
| `POST_NOTIFICATIONS` | phase 6 |
| `VIBRATE` | notification feedback |

A prebuild showed six more arriving **transitively from libraries**, none of which this app
uses: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `RECORD_AUDIO`,
`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, and `SYSTEM_ALERT_WINDOW` — the last
being "draw over other apps", which arrives in the **release** manifest and not merely the
debug one. All six are now listed in `android.blockedPermissions`, which stamps
`tools:node="remove"` so the manifest merger strips them.

This is not tidiness. Every permission appears on the public Play listing, and every one
has to be justified in the Data Safety declaration. Blocking them makes the manifest match
the declaration **by construction** rather than by somebody remembering to check. The two
storage permissions are refused deliberately: they are the pre-Android-13 route to the
photo library, far broader than `READ_MEDIA_IMAGES`, and `minSdk 24` does not need them.

### 6.9 Session expiry UX

The policy does not change in V1 — 7-day absolute, 24-hour idle, no refresh, no rotation.
Changing it would be an authentication change, which is out of scope. But it must not
surprise anyone.

The idle timeout is the part that will actually bite: `last_seen_at` slides on every
authenticated request, so **anyone who does not open the app for 24 hours is signed out**,
regardless of the 7-day clock. For an alumni app that people open weekly, re-authentication
will be the common case, not the exception. The client needs to hear that now (§10).

What the app does about it:

- The verify response includes `expiresAt`, so the app knows both clocks and can warn.
- A dismissible banner at T-24h on the absolute clock: "You'll need to sign in again on
  Friday."
- **A 401 never dumps the user at a login screen having lost their place.** The app keeps
  the current route, shows a sheet — "Your session has ended. Sign in to continue." — and
  on success returns to exactly where they were, with the pending action replayed if it was
  a read and re-confirmed if it was a write.
- One in-flight 401 triggers one sheet, not one per concurrent request.
- The explanatory copy says why: "For security, SXCCAA signs you out after a day of
  inactivity." A reason converts an annoyance into a feature.
- The app does **not** keep the session warm with a background fetch. That would defeat the
  idle timeout, which is a security control, not a bug.

---

## 7. Phases

Each phase ends with a verifier command, matching the project's existing convention
(`db:verify`, `auth:verify`, `gate:verify`, `launch:check`). Nothing is called done because
it looked right.

| # | Phase | Work | Verifier |
|---|---|---|---|
| 0 | Server foundations | `/api/app/v1` scaffold, `bearerSession`, `requireOwner`, `/config`, `/content` | `npm run app:verify` |
| 1 | App skeleton | Expo SDK 57, expo-router, fonts, theme, tabs, safe areas, tier-A content cache | boots on iOS + Android |
| 2 | Auth | Login screen, Turnstile WebView, secure-store, restore, session-expiry sheet, logout | `npm run app:auth-verify` |
| 3 | Content screens | Home, About, Chapters, Events list, Explore, Contact, Search, policies | screenshot review per screen |
| 4 | Directory + own profile | List, search, filters, detail, view budget, editor, photo upload | `npm run app:verify` |
| 5 | Event photos | 0014 + 0015, `events:verify`, 7 routes, camera, album, viewer, report, **admin moderation** | `db:verify` · `events:verify` · `app:photo-verify` |
| 6 | Notifications | 0016, `sxc_notify`, `NotificationService` + `ExpoPushProvider`, 6 routes, permission UX, runner, receipts, deep links | `db:verify` · `app:notify-verify` · `notify:dry` |
| 7 | Layout + a11y pass | Four width classes, font scaling to 200%, landscape, fold, reduce-motion, TalkBack/VoiceOver | device matrix checklist |
| 8 | Hardening + release | Authorization-bypass suite, offline-cache leak test, `scan:secrets`, store metadata, internal testing | `launch:check` |

Phases 0–4 are the replica and are sequential. Phases 5 and 6 are independent of each other
and can be built in either order once 0–4 land. Phase 7 comes late — optimising layouts
that are still changing is wasted work.

### 7.1 The four-week schedule

The client's date is **12 October 2026**. Unconstrained, the phases above are eight and a
half to ten weeks. Four weeks is achievable for one specific definition of done, and not
for the others. This is the commitment:

> **At week 4: the complete app, installed and working on real devices via TestFlight and
> Play internal testing.** All features — content replica, directory, own profile, event
> photo capture, push notifications. Store submission follows as soon as the developer
> accounts and the deployed website exist.

| Week | Work | Done means |
|---|---|---|
| 1 | Phase 0 · Phase 1 · Phase 2 | App boots on a real phone, signs in with a six-digit code against the local API, session survives a restart |
| 2 | Phase 3 | Every website screen present with real content, driven by `/content` |
| 3 | Phase 4 · Phase 5 | Directory, own profile with photo upload, event albums with in-app camera, admin moderation screen |
| 4 | Phase 6 · compressed 7 · 8 | Push arriving on a real device; authorization and cache-leak suites green; internal-testing builds distributed |

**What is deliberately deferred to 1.0.1**, so the month is a real number rather than an
optimistic one:

- The full accessibility device-matrix pass (§6.3). Safe areas, width classes and font
  scaling are built in from week 1 because retrofitting them is more expensive than doing
  them right; what defers is the systematic VoiceOver/TalkBack sweep and the fold and
  landscape matrix on borrowed hardware.
- Biometric re-lock (`expo-local-authentication`). Opt-in, off by default, removable
  without touching anything else.
- iPad and Android tablet native layouts. Tablets run the phone layout scaled in 1.0.
- The `/search` screen, which exists on the website only as a rebuild-only route.

Everything in §8 Tests ships in the month. The security work is not what compresses.

### 7.2 Why the external blockers do not block the build

The single biggest risk to a four-week date looked like the deployed website and the
developer accounts. It is not, and this is worth stating because it changes what has to
happen first:

- **The build does not need the deployed site.** `next dev -p 3300` is reachable from Expo
  Go on the same network, so phases 0–6 are developed and tested against the local API.
  Deployment is needed for device testing off the LAN and for store submission — not for
  writing or verifying a single line of this.
- **The build does not need Turnstile working natively.** `REQUIRE_TURNSTILE=false` already
  exists for local development, so the auth flow is exercisable from day one. The
  `/embed/turnstile` WebView (§2.3) is built in week 2 and verified against the deployed
  site whenever that lands.
- **The build does not need an Apple organisation account.** TestFlight internal testing
  works on a personal account. The D-U-N-S wait affects *store submission*, not the app.

So account enrolment and the `CUTOVER.md` deployment run **in parallel** with the build
rather than in front of it. They must still start immediately — the month ends with a
submittable binary and nowhere to submit it if they do not — but they are no longer on the
critical path for the code.

The residual risk is real and worth naming: four weeks has no slack. A week lost to
anything — a sick day, an Expo SDK surprise, a Supabase incident — comes out of phase 7,
which is already the thinnest part of the plan. If that happens the honest response is to
ship 1.0 without the deferred items above and patch, not to compress the test suite.

---

## 8. Tests

Beyond the per-phase verifiers, these specific cases are required, because each one is a
bug that would otherwise reach production silently. All push tests run against a fake
`PushProvider` (§5.1) — no network.

**Notification delivery**
- The runner executed twice over the same state sends exactly one push per device
- Two runners overlapping produce no duplicate `notification` or `notification_delivery` rows
- An alumnus with three devices gets three delivery rows and three pushes; one failing does
  not affect the other two
- A retryable error increments `attempts`, pushes `next_attempt_at` out, and is retried
- Five failed attempts move the row to `failed` with the last `error_code`, and it is never
  retried again
- `DeviceNotRegistered` in a *ticket* revokes the device; so does one in a *receipt*
- A revoked device receives no further deliveries
- A device registered after a notification was created still receives it
- A device registered 80 hours after a notification was created does **not** (72-hour window)
- Preference off, and quiet hours, both record `skipped` and send nothing
- `InvalidCredentials` surfaces as an operator-visible failure, not a per-device retry loop

**Notification idempotency**
- Every `source_key` format is unique across a realistic fixture, and colliding inserts
  are silent no-ops
- Re-running the reminder producer ten times yields one reminder per alumnus per event

**Event photos**
- Reporting the same photo twice creates one row and does not error
- `report_count` equals the number of distinct reporters
- Upload refused when `album_enabled` is false
- EXIF/GPS stripped from the stored renditions
- A file whose `Content-Type` lies about its format is rejected on magic bytes
- An oversized or absurdly dimensioned image is rejected before decode

**Authorization** — for every photo, profile and notification endpoint:
- No token → 401
- Expired, idle-timed-out and revoked tokens → 401
- A valid token belonging to a *different* alumnus → 403/404, never success
- Deleting an event photo uploaded by someone else → refused
- A client-supplied `alumniId` in a body never overrides the session's identity
- Admin-only actions are unreachable from `/api/app/v1` at any privilege
- The view budget cannot be reset by signing out and back in

**Offline cache**
- After loading a profile with a visible contact number and backgrounding, the app sandbox
  contains neither that number nor the alumnus's name (§6.5)
- The session token appears only in the SecureStore keychain item
- Sign-out leaves no tier-B data on disk

**Existing behaviour is unchanged** — a regression suite over the website:
- `auth:verify`, `gate:verify`, `request:verify`, `harden:verify` and `db:verify` all still
  pass after 0014–0016
- The login form still advances to the code step for an unregistered address
- Wrong / expired / exhausted / unknown still collapse into one `invalid`
- Website POST routes still 403 without a matching `Origin`

---

## 9. What you need to do

Ordered by how long it takes to arrive, not by importance. Items 1 to 4 gate the release
and none of them are things I can do.

### Start now

1. **Google Play Developer account**, $25 once, as an **organisation**. This matters more
   than it looks: since 2023 new *personal* developer accounts must run a closed test with
   12 testers for 14 continuous days before they may apply for production access. An
   organisation account is exempt, and the choice cannot be changed afterwards. Use a
   Google account the Association controls, not a committee member's personal one — the
   account outlives whoever creates it. Verification usually takes a few days.

2. **Deploy the website.** The app cannot ship before the API has a stable HTTPS origin.
   This is the same blocker `CUTOVER.md` already describes — DNS, TLS, DMARC, secrets into
   a secret store. It does not block the *build*, though; see §7.2.

3. **Push credentials.** A **Firebase project** for SXCCAA, then its **FCM v1 service
   account JSON**, uploaded to the Expo account through the client's own browser. The file
   never needs to reach a developer machine and should not be emailed — anyone holding it
   can push to every alumnus.

> **Apple is out of scope.** The project targeted both platforms through revision 3; on
> 13 September 2026 the client settled on **Android only**. That removed the longest lead
> time in the plan by a wide margin: an Apple *organisation* enrolment needs a D-U-N-S
> number, which is free but takes up to 30 business days before Apple's own verification
> even starts. Also dropped: the $99/year Developer Program, the APNs `.p8` key,
> TestFlight, `apple-app-site-association`, the iOS App Privacy declaration, the iPad
> layout question, and the Mac-with-Xcode requirement for local builds.
>
> The React code stays platform-neutral — nothing under `app/`, `components/` or `lib/` is
> Android-specific — so adding iOS later is a configuration and release-process job rather
> than a rewrite. `app.json` pins `platforms: ["android"]` so an accidental iOS build is an
> error instead of a silent, untested artefact.

### Before phase 3

5. **Confirm names and identifiers** — effectively permanent. An Android package name
   cannot be changed after the first Play submission; changing it creates a *different*
   app that existing users never receive as an update. My suggestions, for approval:
   - Play listing name: `SXCCAA Alumni`
   - Android package: `org.sxccaa.alumni`
   - Deep link scheme: `sxccaa://`

6. **Fill in the privacy policy and terms.** `/privacy-policy` and `/terms-of-use` are both
   `PolicyPlaceholder` components today. **Apple and Google both require a working privacy
   policy URL and will reject the submission without one.** This needs the association's own
   words, and given the app handles phone numbers and photographs, it should be reviewed by
   whoever advised on the SOW's consent commitments.

7. **Approve the consent language for event photographs.** Alumni consented to a directory.
   Photographs taken at an event and posted by another alumnus — of identifiable people —
   are a new processing purpose. One short paragraph shown before the first upload, plus a
   line in the privacy policy, with the client's sign-off.

8. **Agree who handles moderation, and how fast.** "Live immediately" is only defensible if
   someone actually looks. I need a named volunteer or two, and a target response time for
   a reported photo — this goes in `ADMIN-GUIDE.md`. Without it, "live immediately with
   admin removal" becomes "live immediately".

9. **Host one file on the website** so an `https://sxccaa.org/events/...` link opens the
   app rather than Chrome — Android App Links. I generate it; it needs serving at
   `https://<domain>/.well-known/assetlinks.json`, and it carries the release signing
   fingerprint, so it can only be produced once the Play account exists. Until then such a
   link opens the browser, which is a correct fallback rather than a failure. The
   `sxccaa://` scheme works without any of this and is what notification taps use.

### Before phase 8

10. **Play listing assets.** The icon is done — `mobile/tools/make-icons.mjs` generates it
    from the College crest, so it regenerates consistently if the crest is ever replaced.
    I can produce the screenshots from the built app. The rest is the Association's:
    - Short description (80 characters) and full description (up to 4000)
    - Support URL and marketing URL
    - Feature graphic, 1024×500
    - Content rating questionnaire answers
    - **The Data Safety declaration.** Play makes you declare, publicly and under its
      policy, exactly what the app collects. For this app that is: name, email address,
      phone number, photographs, user content, and a device identifier for push. Getting
      it wrong is a policy violation rather than a bug, so it needs explicit sign-off
      rather than my best guess. The manifest is built to match it — see §6.8.

11. **Recruit internal testers** — around five alumni across a spread of devices, ideally
    including at least one older or low-end Android, since that is where `compact` width
    and slow decode actually show. Play's internal testing track, which installs like a
    normal app and needs no closed-test waiting period on an organisation account.

12. **Real event photographs.** `eventsPage.photoNote` currently says photographs appear
    only where SXCCAA has supplied them, and several events have none. An album feature with
    empty albums demos badly.

### Decisions I will need from you when we get there

- Whether the app icon keeps the full crest or a simplified shield. A launcher icon is
  roughly a fingernail; the crest's ring lettering will not be legible at that size, though
  its shape and colours still read. Either way the Association should approve its own mark
  being used this way.
- Whether Android tablets get a native layout or run the phone layout scaled. The width
  classes already handle a tablet column count, so this is mostly a question of how much
  polish the `>= 600dp` case deserves.
- The Expo account to build under, and whether you want EAS cloud builds (simplest, free
  tier available) or local builds, which need Android Studio and a JDK on the build
  machine.
- Where the push runner is scheduled — Supabase `pg_cron` calling an endpoint, a GitHub
  Actions schedule, or the host's own cron. All three work; it depends on where the website
  ends up deployed.

---

## 10. Risks, stated plainly

**App Store Guideline 4.2 — "minimum functionality".** Apple rejects apps that are a
repackaged website. With connections removed, the app's non-website functionality is camera
capture into event albums and push notifications. That is still comfortably past the bar —
4.2 targets apps with *no* native capability — but the margin is thinner than it was in
revision 2, and the store listing should lead with the camera and notification features
rather than describing the app as a mobile version of the website.

**The website is a Framer export.** Roughly 9,500 lines of CSS and 5,400 lines of
machine-generated motion specs keyed to CSS class names. None of it ports. The app will
match the content, the colours, the fonts, the section order and the feel — it will not
match a screenshot pixel for pixel, and the scroll choreography becomes shorter native
transitions. If the client expects an exact visual clone, that expectation needs correcting
in phase 0, not phase 7.

**The 24-hour idle timeout, more than the 7-day one.** `last_seen_at` slides on every
authenticated request, so an alumnus who does not open the app for a day must re-enter a
six-digit code. For an app people open weekly, that is the normal path, not an edge case.
§6.7 makes it graceful; it does not make it rare. If the client finds this unacceptable
once real alumni use it, the fix is an authentication change — a refresh token, or a longer
idle window for mobile — which is a separate decision with its own security review, not
something to slip in.

**Turnstile through a WebView** is the most fragile component. §2.3 has the detail: a
browser control in a non-browser, mitigated by `minSupportedVersion`, a real error state,
a browser fallback, and the fact that the rate limits are the control of record.

**Events have two sources of truth.** Content stays in `src/data/pages/events.ts`; app
state and machine-readable dates live in `app_event`. `npm run events:verify` fails CI on
any drift, and §4.1 records which side owns which field. The clean fix is to move events
into the database and have the website read them from there — but that changes the website,
which is out of scope now. Worth revisiting after launch.

**Photo storage growth.** ~340 KB per photo is fine to roughly 24,000 photos on Supabase
Pro. Past 2 GB, object storage starts being worth its service-role key. The number to watch
is in the Supabase dashboard and it goes in `RUNBOOK.md`.

**Push depends on a third party either way.** Expo's service sits in front of APNs and FCM,
so an Expo outage means delayed notifications. `NotificationService` (§5.1) makes the
provider replaceable in one file, and the in-app feed does not depend on push at all — a
user who opens the app still sees everything. Notifications are an accelerator, never the
only path to information.

**Moderation is a staffing risk, not a code risk.** Live-immediately photos assume a human
looks at the report queue. Migration 0009 deleted the profile-photo approval queue precisely
because nobody staffed it. Item 9.8 exists so we do not repeat that.

**The migration ledger drifts.** Migrations applied by hand outside `db:migrate` are not
recorded and then block it. Apply 0014 through 0016 with `npm run db:migrate` only, and
check `-- --status` first.

---

## 11. If connections come back later

Recorded so the decision is reversible without re-deriving it. The design was complete in
revision 2 and is preserved here in summary. It would be a phase of roughly one and a half
weeks.

- **One migration** (`0017_connections.sql`) adding `alumni_connection` with
  `requester_id`, `addressee_id`, `status` in (`pending`, `accepted`, `declined`,
  `withdrawn`, `removed`, `blocked`), `request_count`, `requested_at`, `responded_at`.
- **The load-bearing constraint** is a unique index on the *ordered* pair —
  `(least(requester_id, addressee_id), greatest(requester_id, addressee_id))` — permitting
  exactly one row per pair of people for all time. That kills three bugs at once: both
  parties requesting and creating two pending rows; a declined request re-sent as a hundred
  new rows; and "are we connected?" having to check both column orders.
- **`request_count` is not optional.** Because the ordered-pair index reuses the row on a
  re-request, a `source_key` of `connection_request:<connection_id>` would collide and a
  legitimate second request would silently never notify. The counter has to be part of the
  key: `connection_request:<connection_id>:<request_count>`.
- **Per-recipient cooldown**, because a 30/day global limit is 30 requests to *one person*
  if that is how an attacker spends it: 24 hours before a second request, 7 days before a
  third, hard cap of 3 by check constraint. Worst case is three requests over eight days,
  then the pair is permanently closed.
- **`blocked` is terminal**, and blocking controls the social graph only — the blocked
  party's view of the blocker's profile stays governed by `visibility.ts`.
- **Two notification kinds** (`connection_request`, `connection_accepted`) and a
  `connections` column on `notification_pref`.
- **`alumni_report`** — a profile report queue, which a social graph makes necessary; today
  the only recourse against an impersonated profile is emailing the association.
- **Connections would still unlock no profile fields.** `ViewerTier` stays
  `'anonymous' | 'verified'`; `visibility.ts` stays untouched. That was a locked decision
  and removing the feature does not change it.

---

## 12. Facts this plan is built on

So a future reader can tell what was verified from what was assumed. Everything below was
read from the source, not recalled.

| Fact | Where |
|---|---|
| Expo SDK 57 is current; `latest` is 57.0.22 | `npm view expo dist-tags` |
| SDK 57 pins RN 0.86.3, React 19.2.3, Reanimated 4.5.1, TypeScript ~6.0.3 | `npm view expo-template-default@sdk-57` |
| Expo push is two-phase: tickets, then receipts | `expo-server-sdk@7.2.0`, `ExpoClient.d.ts:25-30, 94-114` |
| Push error codes: `DeveloperError`, `DeviceNotRegistered`, `ExpoError`, `InvalidCredentials`, `MessageRateExceeded`, `MessageTooBig`, `ProviderError` | `ExpoClient.d.ts:109` |
| Chunk limits are 100 messages and 300 receipt ids | `ExpoClientValues.js:14,18` |
| No Supabase client; direct Postgres as `sxc_web` | `oxvercity/package.json`, `src/lib/db.ts:57-66` |
| `anon` / `authenticated` revoked everywhere; `service_role` unused | migrations 0001, 0003, 0006, 0007 |
| Session is a 32-byte opaque token, `sha256` at rest | `src/lib/session.ts:44-58`, `core/ids.ts:62` |
| Cookie `__Host-sxc_session`, httpOnly/Secure/Lax | `src/lib/session.ts:32`, `session-cookie.ts:22-30` |
| 7-day absolute, 24-hour idle, no refresh or rotation | `src/lib/session.ts:34-35, 67-82` |
| Every POST requires a matching `Origin` or `Referer` | `src/lib/request.ts:59-78` |
| `/me` mutations are server actions, no REST equivalent | `src/app/me/actions.ts` |
| Events, gallery, news and all copy are static TypeScript | `src/data/**` (14 files) |
| Only the directory is DB-backed | `src/lib/directory.ts:115-122` |
| Photo bytes in Postgres; Storage rejected, with reasons | `db/migrations/0007_alumni_photo.sql:6-31` |
| Upload pipeline sniffs magic bytes and strips EXIF | `src/lib/photo.ts` |
| Turnstile mandatory in production, fails closed | `src/lib/turnstile.ts:33-37` |
| `ViewerTier` is `'anonymous' \| 'verified'`; any session is verified | `src/lib/visibility.ts:32`, `directory.ts:56-58` |
| Profile view budget is keyed on `emailHmac`, not session id | `src/lib/view-budget.ts:11-17` |
| Highest existing migration is `0013_broadcast.sql` | `db/migrations/` |
| `alumni.id` is `text`, 12 chars, not uuid | `0001_schema.sql` |
| A new table needs a grant **and** an RLS policy or writes silently no-op | `0005` header |
| Three DB roles exist today: `sxc_web`, `sxc_admin`, `sxc_ingest` | `0002_roles.sql` |
| Both repos are in git with GitHub remotes as of 12 Sep 2026 | `git log`, `git remote -v` |

---

## 13. Change history

### Revision 3 — connections removed from scope

| Change | Detail |
|---|---|
| `alumni_connection` and `alumni_report` tables | Removed. New table count 9 → **7**. |
| Migration numbering | Notifications moved `0017` → **`0016`**. Files: 0014 events, 0015 photos, 0016 notifications. Three files, not four. |
| Routes | Eight connection routes and `POST /alumni/:id/report` removed. 39 → **30**. |
| `notification.kind` | `connection_request` and `connection_accepted` dropped; five kinds remain. |
| `notification_pref` | `connections` column dropped. |
| `GET /me` | `pendingConnectionCount` dropped. |
| App screens | `connections/index.tsx`, `connections/requests.tsx` removed; no connect / remove / block affordance anywhere. |
| Phases | Old phase 6 (connections) removed; 7→6, 8→7, 9→8. Nine phases, not ten. |
| Estimate | 10–12 weeks → **8.5–10 weeks**. |
| Tests | Connection and profile-report cases removed; event-photo pipeline cases expanded. |
| Grants, admin screens, consent items | Connection and report rows removed throughout; admin gains three screens, not four. |
| Guideline 4.2 risk | Re-assessed — still clear, but the margin is thinner, so the store listing must lead with camera and notifications (§10). |
| §11 added | The connections design preserved in summary, including why `request_count` is load-bearing, so it can be restored without re-deriving it. |

Revision 2's notification work is **retained in full**: `notification_delivery`,
`source_key` idempotency, the `PushProvider` seam, the permission UX, the offline cache
tiers, the screenshot-protection framing, `sxc_notify`, `events:verify` failing CI, the
session-expiry UX, §5.0 server-side authorization, and §8 tests.

### Revision 2 — notification correctness

| # | Change | Why |
|---|---|---|
| 1 | **`notification_delivery` table** with `status`, `attempts`, `next_attempt_at`, `receipt_id`, `error_code`, `UNIQUE (notification_id, device_token_id)` | Revision 1 said the runner would send "rows with no push attempt yet" against a table that recorded no attempt. It could not answer "did this already send", could not handle one alumnus with two devices, and would have re-pushed everything on every run. A real architectural hole. |
| 2 | **`notification.source_key`, `UNIQUE`** | Replaces "rows created since the last run". No cursor to lose, no clock to trust; concurrent and repeat runs are safe by construction. |
| 3 | **Two-tier offline cache policy** with a sandbox-grep leak test | Revision 1 said "caches the content bundle" without saying what must never be persisted. |
| 4 | **Screenshot protection reframed** as defence-in-depth | It read like a security control. A second phone defeats it. |
| 5 | **`NotificationService` / `PushProvider` seam** | Keeps Expo out of the business logic and lets the push tests run with no network. |
| 6 | **Notification permission UX** as three distinct states, prompt-once | OS permission, preference and device registration were conflated. |
| 7 | **Constraint wording** made precise — additive migrations only | Honest: the app adds tables, so "do not change the database" was never literally true. |
| 8 | **`events:verify` fails CI**, plus an authoritative-fields table | Revision 1 had it "report any orphan", which is a warning somebody scrolls past. |
| 9 | **Session-expiry UX**; 24-hour idle timeout promoted to a headline risk | A 401 no longer loses the user's place. The idle clock, not the 7-day one, is what generates support mail. |
| 10 | **§5.0 server-side authorization** rule, and **§8 tests** in full | Was implicit; now explicit with a bypass test per endpoint. |
| 11 | **`sxc_notify` role** | The push job needs device tokens; `sxc_web` is internet-facing and `sxc_admin` is the portal's credential. |
| 12 | **Photo abuse controls table** | Documents that they are inherited by calling `src/lib/photo.ts`, not reimplemented. |
