-- =============================================================================
-- 0007_alumni_photo.sql — where uploaded photographs live
--
-- Phase 6.
--
-- ## Why the bytes are in Postgres and not in object storage
--
-- Plan §7.4 said Supabase Storage, with one public-read bucket for approved
-- public photographs. Built out, that turned out to be the worse of the two
-- options here, for three reasons:
--
--   1. **It needs the service-role key.** Supabase's storage API is reached
--      with a credential that bypasses RLS and every least-privilege grant in
--      0002. This project deliberately connects as `sxc_web`/`sxc_admin`
--      precisely so that a bug in the public application cannot rewrite the
--      allowlist. Introducing the service-role key to upload an avatar hands
--      the internet-facing app that power back for the sake of one feature.
--   2. **A public bucket is a misconfiguration waiting to happen.** "One bucket
--      is public-read and contains nothing else" is a sentence that stays true
--      only as long as everyone who touches the project knows it. The failure
--      mode is silent and total.
--   3. **The scale does not justify it.** Five hundred photographs at roughly
--      60 KB of WebP is about 30 MB — comfortably inside a Postgres database
--      that is already backed up, already access-controlled, and already the
--      thing we restore-test.
--
-- Every photograph is therefore served by /api/photo/<alumni-id>, which applies
-- the same tier check as everything else. That is a little more bandwidth
-- through the application and it buys a single access-control story instead of
-- two. If the directory ever grows past a few thousand photographs, moving the
-- bytes out is a contained change: this table becomes a pointer.
--
-- ## Two renditions, not one
--
-- WebP is what almost every browser gets. The JPEG is there for the handful
-- that do not, and because an image an alumnus cannot see on their own phone is
-- a support request. Both are produced by re-encoding, which is the actual
-- defence (plan §7.4 step 6) — it throws away every byte that is not pixel
-- data, destroying polyglots, appended archives and malformed-chunk exploits in
-- one step.
--
-- Apply with:  npm run db:migrate
-- =============================================================================

begin;

create table alumni_photo (
  -- The random storage key already on alumni.photo_path. Deliberately unrelated
  -- to the alumni id, so a leaked photo URL identifies nobody and cannot be
  -- walked back to a profile.
  path         text primary key check (path ~ '^[2-9a-km-np-z]{22}$'),

  alumni_id    text not null references alumni(id) on delete cascade,

  -- Both renditions of the same image. Written together, never separately.
  webp         bytea not null,
  jpeg         bytea not null,

  width        int not null check (width between 1 and 4000),
  height       int not null check (height between 1 and 4000),

  -- What the file claimed to be before we re-encoded it. Recorded for the audit
  -- trail, never trusted and never echoed back to a browser.
  source_type  text not null check (length(source_type) <= 40),
  source_bytes int  not null check (source_bytes between 1 and 5242880),

  created_at   timestamptz not null default now()
);

comment on table alumni_photo is
  'Processed profile photographs. Bytes are re-encoded by src/lib/photo.ts; the original upload is never stored. See the header of 0007 for why these are not in object storage.';
comment on column alumni_photo.source_type is
  'The format detected from the file''s magic bytes, not from its Content-Type header or extension. For the audit trail only.';

-- One live photograph per alumnus. A replace writes a new row and deletes the
-- old one in the same transaction, so an old URL dies immediately — the thing
-- people assume happens when they change a profile picture, and usually does not.
create unique index alumni_photo_one_per_alumnus on alumni_photo (alumni_id);


-- -----------------------------------------------------------------------------
-- Grants
--
-- The public app writes photographs (an alumnus uploading their own) and reads
-- them (serving the proxy). It may also delete — removing your own photograph
-- is a right under the DPDP Act, and it must not need an admin.
--
-- It may NOT flip alumni.photo_status to 'approved'; that is reserved to
-- sxc_admin by the guard_photo_approval trigger in 0001.
-- -----------------------------------------------------------------------------

grant select, insert, delete on alumni_photo to sxc_web;
grant select, insert, update, delete on alumni_photo to sxc_admin;

revoke all on alumni_photo from public, anon, authenticated, sxc_ingest;

alter table alumni_photo enable row level security;

create policy sxc_app_access on alumni_photo
  for all to sxc_web, sxc_admin
  using (true) with check (true);


-- -----------------------------------------------------------------------------
-- The public app needs to be able to record a photograph against a record.
--
-- 0002 grants sxc_web UPDATE on a named list of alumni columns — the fields an
-- alumnus owns on /me. The photo columns were not on that list because there
-- was nothing to write to them yet.
--
-- photo_status is included, and the trigger is what keeps that safe: sxc_web
-- can move a row to 'pending' or back to 'none', and the trigger raises if
-- anything other than sxc_admin sets 'approved'. A column grant cannot express
-- "any value except this one", which is why both exist.
-- -----------------------------------------------------------------------------

grant update (photo_path, photo_status, photo_updated_at, photo_audience) on alumni to sxc_web;

commit;
