-- =============================================================================
-- 0010_admin_added_alumni.sql — records created from the admin portal
--
-- Until now an alumni record could only come from the spreadsheet, where the
-- Google Form's Timestamp column carries the consent evidence (plan §11). An
-- administrator adding somebody by hand has no such column, and without one the
-- Association would be publishing a named individual's employer and contact
-- details with no record of why it is allowed to.
--
-- So: two columns, and `consent_note` is required by the application for any
-- record the portal creates.
--
-- ## Why a free-text note rather than a checkbox
--
-- A tickbox saying "I confirm consent was obtained" records that somebody
-- ticked a box. What the Association needs, if a record is ever challenged, is
-- *where the consent is* — "signed form in the 2019 file", "email of 4 March,
-- forwarded to the secretary", "asked at the Kolkata chapter dinner". A person
-- can act on that a year later. A boolean cannot.
--
-- Apply with:  npm run db:migrate
-- =============================================================================

begin;

alter table alumni add column consent_note text check (length(consent_note) <= 500);

comment on column alumni.consent_note is
  'Where the consent for this record can be found. Required by the portal when an administrator creates a record by hand; null for spreadsheet imports, where alumni.consent_recorded_at carries the form Timestamp instead.';

-- Who added it. The audit log records this too, but the audit log is a stream
-- and this is a property of the row — the difference between "search the log
-- for when this appeared" and "look at the record".
alter table alumni add column added_by uuid references admin_user(id) on delete set null;

comment on column alumni.added_by is
  'The administrator who created this record from the portal. Null for spreadsheet imports.';

-- `sxc_web` is given neither. The public application has no business creating
-- alumni or recording consent, and 0002''s column list is an allowlist, so
-- leaving these out of it is the whole of the control.
--
-- `sxc_admin` already holds INSERT and UPDATE on every column of `alumni`.

commit;
