-- =============================================================================
-- 0008_invited_at.sql — remember who has been told they have access
--
-- Phase 9. One column.
--
-- ## Why this is not just an audit row
--
-- `audit_log` already records everything that happens, and the invitation run
-- could read its own history back. It should not:
--
--   * The run has to be **resumable**. Five hundred messages paced at fifty an
--     hour is a ten-hour job, and it will be interrupted — a laptop sleeping, a
--     rate limit, a provider having an afternoon. Resuming means asking "who
--     have I already told?", and that question deserves an indexed column
--     rather than a scan of an append-only log that grows forever.
--   * **Sending twice is the failure that matters.** Five hundred people
--     receiving the same "you now have access" email a second time makes the
--     Association look careless with exactly the thing it is asking them to
--     trust it with.
--   * The admin portal wants to show it. "Invited / not yet invited" is a
--     column on a list, not a log query.
--
-- The audit row is still written. This is the working state; that is the record.
--
-- Apply with:  npm run db:migrate
-- =============================================================================

begin;

alter table alumni add column invited_at timestamptz;

comment on column alumni.invited_at is
  'When this alumnus was emailed their "you have directory access" invitation. Null means not yet told. Set by tools/invite, which is resumable and uses this to know where it stopped.';

-- The partial index is the query the invitation run makes on every batch:
-- "who has a sign-in identity, is listed, and has not been told yet?"
create index alumni_awaiting_invitation on alumni (created_at)
  where invited_at is null and gmail_hmac is not null and is_visible;

-- sxc_ingest already holds UPDATE on every column of `alumni` (0002), which is
-- what the local invitation tool connects as. sxc_web is deliberately not given
-- this column: the public site has no business recording that somebody was
-- emailed, and 0002's column list is an allowlist rather than a denylist, so it
-- needs no change here.
--
-- sxc_admin has full UPDATE already, so the portal can clear the flag if a run
-- has to be redone.

commit;
