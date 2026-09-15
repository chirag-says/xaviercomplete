-- =============================================================================
-- 0001_schema.sql — SXCCAA alumni directory
--
-- Every confidential column in here is bytea holding an AES-256-GCM blob
-- written by src/lib/core/crypto.ts. The database never sees a phone number, an
-- email address or a line of free text in the clear, so a stolen dump, a
-- provider breach or a leaked backup yields ciphertext and nothing else.
--
-- Design notes worth reading before editing:
--
--   * Constraints are not decoration. `show_contact` cannot be true when there
--     is no number to show; `photo_status` cannot claim a photo that has no
--     stored object. A row that contradicts the access model is refused at the
--     database, not caught by a code review later.
--   * RLS is enabled with no policies on every table. That is deny-all. It is a
--     second line of defence so that a leaked Supabase key opens nothing on its
--     own; the real access control is the least-privilege roles in 0002.
--   * `audit_log` is append-only, enforced by both a trigger and a grant.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/0001_schema.sql
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- admin_user — the people who run the portal
--
-- Created first because alumni rows point at it for photo review.
-- There is no route anywhere in either application that inserts into this table
-- without an existing admin's invitation; the very first row is written by the
-- local CLI (plan §9.2).
-- -----------------------------------------------------------------------------

create table admin_user (
  id                uuid primary key default gen_random_uuid(),
  email_enc         bytea not null,
  email_hmac        bytea not null unique check (length(email_hmac) = 32),
  password_hash     text  not null,          -- Argon2id, encoded string form
  totp_secret_enc   bytea not null,          -- encrypted; 2FA is not optional
  totp_confirmed_at timestamptz,             -- until this is set the account cannot sign in
  status            text  not null default 'invited'
                          check (status in ('invited', 'active', 'disabled')),
  role              text  not null check (role in ('super_admin', 'moderator')),
  failed_attempts   int   not null default 0 check (failed_attempts >= 0),
  locked_until      timestamptz,
  created_at        timestamptz not null default now(),
  last_login_at     timestamptz,
  updated_at        timestamptz not null default now(),

  -- An account cannot be usable until someone proved they hold the authenticator.
  constraint admin_active_requires_totp
    check (status <> 'active' or totp_confirmed_at is not null)
);

comment on column admin_user.totp_confirmed_at is
  'Set only after a live 6-digit code was verified during onboarding. Null means enrolment never completed.';


-- -----------------------------------------------------------------------------
-- admin_invite — the only path to admin #2 onwards
-- -----------------------------------------------------------------------------

create table admin_invite (
  id          uuid primary key default gen_random_uuid(),
  email_enc   bytea not null,
  email_hmac  bytea not null check (length(email_hmac) = 32),
  token_hash  bytea not null unique check (length(token_hash) = 32),
  invited_by  uuid  not null references admin_user(id) on delete restrict,
  role        text  not null check (role in ('super_admin', 'moderator')),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now(),

  constraint invite_expires_in_the_future check (expires_at > created_at)
);

create index admin_invite_pending on admin_invite (expires_at) where consumed_at is null;


-- -----------------------------------------------------------------------------
-- admin_recovery_code — one lost phone should not lock the Association out
-- -----------------------------------------------------------------------------

create table admin_recovery_code (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references admin_user(id) on delete cascade,
  code_hash  text not null,                  -- Argon2id; shown once, never again
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index admin_recovery_code_unused on admin_recovery_code (admin_id) where used_at is null;


-- -----------------------------------------------------------------------------
-- alumni — the directory itself
-- -----------------------------------------------------------------------------

create table alumni (
  -- Opaque, random, not derived from the name. A readable id can be guessed and
  -- walked, and announces whose profile it is when the link is shared.
  id                  text primary key check (id ~ '^[2-9a-km-np-z]{12}$'),

  -- Public tier (plan §1.1)
  full_name           text not null check (length(btrim(full_name)) between 1 and 120),
  batch_year          int  not null check (batch_year between 1900 and 2100),
  stream              text check (length(stream) <= 120),
  current_org         text check (length(current_org) <= 200),
  designation         text check (length(designation) <= 200),

  -- Verified-alumnus tier, plaintext (not personal data on its own)
  previous_role       text check (length(previous_role) <= 400),

  -- Verified-alumnus tier, encrypted
  contact_enc         bytea,
  gmail_enc           bytea,
  gmail_hmac          bytea unique check (gmail_hmac is null or length(gmail_hmac) = 32),
  other_info_enc      bytea,

  -- Admin tier, encrypted. The address the Google Form response came from.
  form_email_enc      bytea,

  -- Visibility, owned by the alumnus (plan §1.3)
  show_contact        boolean not null default false,
  show_gmail          boolean not null default true,
  photo_audience      text    not null default 'public'
                              check (photo_audience in ('public', 'alumni')),

  -- Photograph (plan §7.4). photo_path is a random storage key that contains
  -- neither the name nor this id, so a leaked photo URL identifies nobody.
  photo_path          text check (photo_path ~ '^[2-9a-km-np-z]{22}$'),
  photo_status        text not null default 'none'
                           check (photo_status in ('none', 'pending', 'approved', 'rejected')),
  photo_updated_at    timestamptz,
  photo_reviewed_by   uuid references admin_user(id) on delete set null,

  is_visible          boolean not null default true,
  consent_recorded_at timestamptz,
  submitted_at        timestamptz,
  owner_updated_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- A toggle must not promise something the row cannot deliver. Without these,
  -- "show my number" can be true on a record that has no number, and the bug
  -- surfaces as a blank field on someone else's screen.
  constraint show_contact_needs_a_contact
    check (show_contact = false or contact_enc is not null),
  constraint show_gmail_needs_a_gmail
    check (show_gmail = false or gmail_enc is not null),

  -- A photo is either stored and awaiting/holding a decision, or there is no
  -- object at all. 'rejected' and 'none' both mean the object was deleted.
  constraint photo_state_matches_storage
    check ((photo_status in ('pending', 'approved')) = (photo_path is not null))
);

comment on table alumni is
  'One row per alumnus. Confidential columns are AES-256-GCM blobs; see src/lib/core/crypto.ts.';
comment on column alumni.gmail_hmac is
  'Blind index linking this record to its login identity. Never reversible, never displayed.';
comment on column alumni.owner_updated_at is
  'Set when the alumnus edits their own record. A later Excel re-import must not overwrite a field they have taken ownership of.';

create index alumni_directory on alumni (batch_year desc, full_name) where is_visible;
create index alumni_name_search on alumni (lower(full_name)) where is_visible;
create index alumni_photo_queue on alumni (photo_updated_at) where photo_status = 'pending';

create trigger alumni_touch before update on alumni
  for each row execute function touch_updated_at();

create trigger admin_user_touch before update on admin_user
  for each row execute function touch_updated_at();


-- Approving a photograph publishes an image on a site carrying the college's
-- name. The public application is not allowed to do that, and this is enforced
-- here as well as in the grants, because a grant cannot express "any value
-- except this one".
create or replace function guard_photo_approval() returns trigger
language plpgsql as $$
begin
  if new.photo_status = 'approved'
     and old.photo_status is distinct from 'approved'
     and current_user <> 'sxc_admin' then
    raise exception 'photo approval is reserved to the admin application (attempted by %)', current_user
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger alumni_guard_photo_approval before update on alumni
  for each row execute function guard_photo_approval();


-- -----------------------------------------------------------------------------
-- access_grant — the login allowlist
--
-- The email exists here only as an HMAC. Even holding this whole table, an
-- attacker cannot recover the membership list, and cannot test a guess against
-- it without the pepper, which lives in the host's secret store.
-- -----------------------------------------------------------------------------

create table access_grant (
  id         uuid primary key default gen_random_uuid(),
  email_hmac bytea not null unique check (length(email_hmac) = 32),
  source     text  not null check (source in ('import', 'admin_grant')),
  granted_by uuid references admin_user(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  note       text check (length(note) <= 500),   -- admin's reason. No PII.

  constraint admin_grants_name_their_author
    check (source <> 'admin_grant' or granted_by is not null)
);

create index access_grant_live on access_grant (email_hmac) where revoked_at is null;

comment on column access_grant.note is
  'Free text for the admin''s reasoning. Must not contain personal data — it is read by every admin.';


-- -----------------------------------------------------------------------------
-- login_token — magic links
-- -----------------------------------------------------------------------------

create table login_token (
  id              uuid primary key default gen_random_uuid(),
  token_hash      bytea not null unique check (length(token_hash) = 32),
  email_hmac      bytea not null check (length(email_hmac) = 32),
  expires_at      timestamptz not null,
  consumed_at     timestamptz,
  request_ip_hash bytea check (request_ip_hash is null or length(request_ip_hash) = 32),
  created_at      timestamptz not null default now()
);

create index login_token_sweep on login_token (expires_at);


-- -----------------------------------------------------------------------------
-- session — alumni sessions. Only the hash of the token is stored, so a leaked
-- database yields no usable sessions.
-- -----------------------------------------------------------------------------

create table session (
  id           uuid primary key default gen_random_uuid(),
  token_hash   bytea not null unique check (length(token_hash) = 32),
  email_hmac   bytea not null check (length(email_hmac) = 32),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  ua_hash      bytea check (ua_hash is null or length(ua_hash) = 32)
);

create index session_by_identity on session (email_hmac) where revoked_at is null;
create index session_sweep on session (expires_at);


-- -----------------------------------------------------------------------------
-- access_request — from the public contact page
-- -----------------------------------------------------------------------------

create table access_request (
  id                uuid primary key default gen_random_uuid(),
  email_enc         bytea not null,
  email_hmac        bytea not null check (length(email_hmac) = 32),
  name              text  not null check (length(btrim(name)) between 1 and 120),
  batch_year        int check (batch_year between 1900 and 2100),
  stream            text check (length(stream) <= 120),
  reason            text check (length(reason) <= 2000),
  otp_hash          bytea check (otp_hash is null or length(otp_hash) = 32),
  otp_expires_at    timestamptz,
  otp_attempts      int not null default 0 check (otp_attempts between 0 and 5),
  email_verified_at timestamptz,
  status            text not null default 'pending'
                         check (status in ('pending', 'approved', 'rejected')),
  decided_by        uuid references admin_user(id) on delete set null,
  decided_at        timestamptz,
  created_at        timestamptz not null default now(),
  request_ip_hash   bytea check (request_ip_hash is null or length(request_ip_hash) = 32),

  constraint decision_is_attributable
    check (status = 'pending' or (decided_by is not null and decided_at is not null))
);

create index access_request_queue on access_request (created_at) where status = 'pending';


-- -----------------------------------------------------------------------------
-- rate_limit — token buckets (plan §6.3)
--
-- Kept in Postgres rather than a second service: one less thing to run, secure,
-- pay for and patch, at a scale where the cost is a single indexed upsert.
-- -----------------------------------------------------------------------------

create table rate_limit (
  bucket     text  not null,    -- 'login:email', 'photo:alumnus', 'views:session', ...
  subject    bytea not null,    -- always a hash, never a raw IP or address
  tokens     real  not null,
  refilled_at timestamptz not null default now(),
  primary key (bucket, subject)
);

create index rate_limit_sweep on rate_limit (refilled_at);


-- -----------------------------------------------------------------------------
-- audit_log — append-only
--
-- An audit log that leaks the data it protects is worse than no audit log:
-- meta holds ids and field names, never a name, number or address.
-- -----------------------------------------------------------------------------

create table audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  actor_type  text not null check (actor_type in ('alumnus', 'admin', 'system', 'anonymous')),
  actor_id    text,
  action      text not null check (length(action) between 1 and 80),
  target_type text,
  target_id   text,
  ip_hash     bytea check (ip_hash is null or length(ip_hash) = 32),
  meta        jsonb not null default '{}'::jsonb
);

create index audit_log_recent on audit_log (at desc);
create index audit_log_by_actor on audit_log (actor_id, at desc);
create index audit_log_by_target on audit_log (target_type, target_id, at desc);

comment on column audit_log.meta is
  'Structured context. NEVER personal data: log alumni_id, not the name; log "show_contact", not the number.';

-- Grants in 0002 already withhold UPDATE and DELETE. This trigger is the second
-- lock: it survives someone later widening a grant by accident.
create or replace function audit_log_is_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only; % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_no_rewrite before update or delete on audit_log
  for each statement execute function audit_log_is_append_only();


-- -----------------------------------------------------------------------------
-- Row Level Security: deny-all everywhere.
--
-- Enabling RLS without defining a policy denies every role that is not the
-- table owner. Nothing in this system reaches Postgres through PostgREST, so no
-- policy is ever added; the roles in 0002 are the real access control and this
-- is the layer that makes a leaked anon/service key inert.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
  -- Supabase exposes these two roles to the internet through PostgREST. Neither
  -- is used by this project and neither may touch anything. They are absent on
  -- a plain Postgres, so the revoke is conditional rather than a failed migration.
  exposed text[] := array(
    select rolname from pg_roles where rolname in ('anon', 'authenticated')
  );
begin
  foreach t in array array[
    'admin_user', 'admin_invite', 'admin_recovery_code', 'alumni', 'access_grant',
    'login_token', 'session', 'access_request', 'rate_limit', 'audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    if array_length(exposed, 1) is not null then
      execute format(
        'revoke all on table %I from %s',
        t,
        (select string_agg(quote_ident(r), ', ') from unnest(exposed) as r)
      );
    end if;
  end loop;
end;
$$;

commit;
