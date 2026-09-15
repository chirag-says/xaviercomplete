-- =============================================================================
-- 0006_admin_session.sql — sessions for the admin portal, and TOTP replay defence
--
-- Phase 5. Three changes:
--
--   1. `admin_session`, a table of its own rather than a column on `session`.
--   2. `admin_user.totp_last_step`, so a one-time code really is one-time.
--   3. `admin_user.must_change_password`, set when an account is created by
--      another admin's reset rather than by its owner.
--
-- ## Why admins do not share the alumni `session` table
--
-- `session` is keyed by `email_hmac` — the blind index of an address on the
-- allowlist — and carries no foreign key, because an alumnus's session must
-- survive whether or not a matching `alumni` row exists. An admin session is a
-- different thing: it belongs to a specific `admin_user` row, it must die the
-- instant that account is disabled, and it carries a step-up clock the alumni
-- session has no concept of.
--
-- Sharing one table would mean a nullable `admin_id`, a nullable `email_hmac`,
-- and a check constraint saying exactly one of them is set — and, far worse,
-- one bug in a WHERE clause standing between an alumnus's cookie and an admin's
-- privileges. Two tables cannot be confused for one another.
--
-- ## Why the whole row cascades on delete
--
-- `on delete cascade` from admin_user. Deleting an admin must not leave a live
-- session pointing at a row that no longer exists. In practice admins are
-- disabled rather than deleted (audit history is kept), and disabling revokes
-- sessions explicitly — but the database should not depend on the application
-- remembering to.
--
-- Apply with:  npm run db:migrate
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- admin_user: replay defence and a forced-reset flag
-- -----------------------------------------------------------------------------

-- The TOTP step the account last signed in with. A code stays valid for its
-- whole 30-second window, so without this a code captured over someone's
-- shoulder — or phished and used within seconds — works a second time.
-- Recording the step and refusing anything at or below it makes each code
-- usable exactly once.
alter table admin_user add column totp_last_step bigint;

comment on column admin_user.totp_last_step is
  'Counter of the last accepted TOTP code. verifyTotp() refuses any step <= this, making each code single-use.';

-- Set when a super admin issues a reset for someone else. The account works,
-- but the first thing it must do is choose a password its owner alone knows.
alter table admin_user add column must_change_password boolean not null default false;


-- -----------------------------------------------------------------------------
-- admin_session
-- -----------------------------------------------------------------------------

create table admin_session (
  id             uuid primary key default gen_random_uuid(),

  -- 32 random bytes live in the cookie; only their SHA-256 is stored, so a
  -- stolen dump yields no usable session. Same reasoning as `session` and
  -- `login_token`.
  token_hash     bytea not null unique check (length(token_hash) = 32),

  admin_id       uuid not null references admin_user(id) on delete cascade,

  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),

  -- 8 hours absolute, 30 minutes idle (plan §9.3). Both are enforced in the
  -- WHERE clause that resolves a session, never in application code afterwards.
  expires_at     timestamptz not null,
  revoked_at     timestamptz,

  -- When the holder last proved possession of the password *and* the
  -- authenticator. Granting access, revoking access, exporting, inviting an
  -- admin and re-enrolling TOTP all require this to be recent (plan §9.3).
  -- Null means "not since this session began".
  stepped_up_at  timestamptz,

  ip_hash        bytea check (ip_hash is null or length(ip_hash) = 32),
  ua_hash        bytea check (ua_hash is null or length(ua_hash) = 32),

  constraint admin_session_expires_after_creation check (expires_at > created_at)
);

comment on table admin_session is
  'Sessions for admin.sxccaa.org. Separate from `session` on purpose — see the header of 0006.';
comment on column admin_session.stepped_up_at is
  'Last successful re-authentication. Dangerous actions require this within STEP_UP_WINDOW_MS.';

-- Resolving a session by cookie is the hottest query in the portal.
create index admin_session_live on admin_session (admin_id) where revoked_at is null;


-- -----------------------------------------------------------------------------
-- Grants
--
-- Only the admin application touches any of this. sxc_web is given nothing:
-- a total compromise of the public site must not be able to read an admin
-- session, mint one, or learn that an account exists.
-- -----------------------------------------------------------------------------

grant select, insert, update, delete on admin_session to sxc_admin;

-- Belt and braces. 0003 changed the default privileges so new tables start
-- closed, and 0002 revoked from the application roles; this says it again for
-- the table created above, because a missed revoke here is an internet-facing
-- disclosure.
revoke all on admin_session from public, anon, authenticated, sxc_web, sxc_ingest;


-- -----------------------------------------------------------------------------
-- RLS
--
-- Enabled with one permissive policy naming only sxc_admin — not all three
-- roles as in 0005, because sxc_web and sxc_ingest have no business here and
-- should match no policy. Every other role, including anon and authenticated,
-- continues to match nothing.
-- -----------------------------------------------------------------------------

alter table admin_session enable row level security;

create policy sxc_admin_only on admin_session
  for all to sxc_admin
  using (true) with check (true);

commit;
