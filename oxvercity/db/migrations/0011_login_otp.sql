-- =============================================================================
-- 0011_login_otp.sql — sign-in by six-digit code instead of a link
--
-- `login_token` held magic links: one long random secret per sign-in, mailed as
-- a URL, looked up by its hash. The Association asked for a code typed into the
-- page instead, so the table now holds codes.
--
-- ## Why the columns change rather than a new table appearing
--
-- A `login_otp` table beside a `login_token` one would be two tables answering
-- the same question — "may this person open a session right now" — with two
-- expiry rules, two sweeps, two grants and two places for the two to disagree.
-- There is one sign-in secret at a time; there is one table for it.
--
-- ## Why `token_hash` is dropped rather than left nullable
--
-- Nothing mints a link any more and the route that redeemed one is gone. A
-- column nobody writes is a column the next reader assumes is load-bearing, and
-- its UNIQUE constraint would go on quietly indexing nothing. It also carried
-- the only reason a row could be found without naming an identity, which is
-- precisely the property the code flow must not have — see below.
--
-- ## Why the rows are deleted
--
-- Every row in this table is an unredeemed magic link. Its route is deleted in
-- the same change, so each one is already dead; leaving them would mean rows
-- with no code in a table whose every row is supposed to have one.
--
-- ## The property `otp_attempts` protects
--
-- A link token is 32 random bytes and cannot be guessed. A six-digit code has a
-- million possibilities, which is not many, so the code alone is not the
-- control — the code plus a hard cap on wrong answers is. Five, then the row is
-- spent and a fresh code must be requested. The cap lives here, on the row,
-- rather than only in the rate limiter, because the limiter is keyed by IP and
-- an attacker with a list of addresses to try is not short of those.
--
-- Apply with:  npm run db:migrate
-- =============================================================================

begin;

-- Dead links. Their redemption route no longer exists.
delete from login_token;

alter table login_token drop column token_hash;

alter table login_token
  add column otp_hash bytea not null check (length(otp_hash) = 32);

comment on column login_token.otp_hash is
  'SHA-256 of the six-digit code. The code itself is never written down, so a database leak yields nothing anyone can type into the form.';

-- `smallint` and a range check rather than a bare integer: the application
-- increments with least(attempts + 1, 5), and a column that refuses a sixth is
-- what makes that the truth rather than a convention.
alter table login_token
  add column otp_attempts smallint not null default 0 check (otp_attempts between 0 and 5);

comment on column login_token.otp_attempts is
  'Wrong codes entered against this row. At five the row is spent regardless of expiry — the whole of what makes a six-digit secret safe.';

-- Verification now looks a row up by *identity*, because the code is too short
-- to identify anything on its own: the caller must supply the address as well,
-- so an attacker needs the right code for a named person rather than any code
-- that happens to exist. That query needs this index; the old one on
-- `token_hash` answered a question nobody asks any more.
--
-- Partial on `consumed_at is null` because a spent row is never looked up, and
-- the live set is a handful of rows against however many the sweep has yet to
-- clear.
create index login_token_by_identity
  on login_token (email_hmac, created_at desc)
  where consumed_at is null;

commit;
