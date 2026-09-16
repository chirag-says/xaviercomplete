-- =============================================================================
-- 0014_optional_name_and_year.sql — let an incomplete row into the directory
--
-- ## What changed and why
--
-- 0001 made `full_name` and `batch_year` NOT NULL because a directory entry
-- without a name or a year is not much of a directory entry. That reasoning was
-- about the *finished* record. It turned out to be the wrong rule for the
-- *arriving* one.
--
-- The Association's spreadsheet is a Google Form export filled in by five
-- hundred people over several years. Rows are ragged: someone left the name
-- cell blank, someone wrote their graduating year as free text the parser could
-- not read, someone's job title ran past 200 characters. Under the old rules
-- every one of those rows was **rejected in full** — the whole person dropped,
-- including an email address that would have let them sign in and fix it
-- themselves. Losing a record because one cell is untidy is a worse outcome
-- than holding a record with a gap in it.
--
-- So the gate moves: the import now takes what it is given, and the places that
-- display a record are responsible for rendering a gap honestly. There is no
-- placeholder written into the data — a row with no name stores NULL, not the
-- string "Name not provided", because inventing a value is how a placeholder
-- ends up being emailed to somebody as if it were their name.
--
-- ## Lengths
--
-- Raised, and for the same reason. A 240-character designation is not a
-- mistake; it is somebody with a long job title at an organisation with a long
-- name. The limits exist to bound what a form can push into the database, not
-- to have an opinion about anyone's career:
--
--     full_name      120 -> 200
--     stream         120 -> 200
--     current_org    200 -> 500
--     designation    200 -> 500
--     previous_role  400 -> 1000
--
-- ## The ordering trap this migration also fixes
--
-- `alumni_directory` is (batch_year desc, full_name). In Postgres, DESC implies
-- NULLS FIRST — so the moment batch_year can be null, every record missing a
-- year would sort to the **top of the public directory**, which is precisely
-- the opposite of where an incomplete record belongs. Both the index and the
-- query that uses it are rebuilt as NULLS LAST so they still match and the scan
-- stays an index scan.
--
-- Safe to run: verified against the live database with `alumni` at 0 rows, so
-- there is nothing to backfill. It is written to be re-runnable regardless.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/0014_optional_name_and_year.sql
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Nullability
-- -----------------------------------------------------------------------------

alter table alumni alter column full_name  drop not null;
alter table alumni alter column batch_year drop not null;

comment on column alumni.full_name is
  'May be null: a spreadsheet row with no name still imports, so an address that can sign in is not thrown away over a blank cell. Renderers show "Name not provided"; nothing writes that string into this column.';
comment on column alumni.batch_year is
  'May be null. Plenty of Form answers give a year the parser cannot read, and a guessed year is worse than no year — it would be wrong on a public page.';


-- -----------------------------------------------------------------------------
-- Length ceilings
--
-- Dropped and recreated rather than altered: a CHECK constraint has no ALTER
-- form, and `drop ... if exists` keeps this re-runnable.
-- -----------------------------------------------------------------------------

alter table alumni drop constraint if exists alumni_full_name_check;
alter table alumni
  add constraint alumni_full_name_check
  check (full_name is null or length(btrim(full_name)) between 1 and 200);

alter table alumni drop constraint if exists alumni_batch_year_check;
alter table alumni
  add constraint alumni_batch_year_check
  check (batch_year is null or batch_year between 1900 and 2100);

alter table alumni drop constraint if exists alumni_stream_check;
alter table alumni
  add constraint alumni_stream_check check (length(stream) <= 200);

alter table alumni drop constraint if exists alumni_current_org_check;
alter table alumni
  add constraint alumni_current_org_check check (length(current_org) <= 500);

alter table alumni drop constraint if exists alumni_designation_check;
alter table alumni
  add constraint alumni_designation_check check (length(designation) <= 500);

alter table alumni drop constraint if exists alumni_previous_role_check;
alter table alumni
  add constraint alumni_previous_role_check check (length(previous_role) <= 1000);


-- -----------------------------------------------------------------------------
-- Indexes: keep incomplete records at the bottom, not the top
-- -----------------------------------------------------------------------------

drop index if exists alumni_directory;
create index alumni_directory
  on alumni (batch_year desc nulls last, full_name nulls last)
  where is_visible;

-- lower(null) is null, which a btree stores and skips happily. The index is
-- recreated only so its definition sits next to the one above rather than being
-- left as the single piece of this set that 0001 still owns.
drop index if exists alumni_name_search;
create index alumni_name_search on alumni (lower(full_name)) where is_visible;

commit;
