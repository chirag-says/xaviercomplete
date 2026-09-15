-- =============================================================================
-- 0009_photos_go_live.sql — photographs publish immediately
--
-- Client decision, 11 September 2026. Plan §7.5 offered two options and
-- recommended review-before-publish; the Association chose the other one:
-- alumni upload whatever they like and nobody sits in judgement on it.
--
-- ## What changes
--
-- The four-state lifecycle collapses to three, and the meanings change:
--
--     before: none | pending | approved | rejected
--     after:  none | live    | removed
--
--   * `live`    — uploaded and visible. Set by the alumnus, immediately.
--   * `removed` — an administrator took it down. Distinct from `none` so the
--                 owner can be told why their photograph disappeared rather
--                 than being left to wonder.
--
-- `pending` and `rejected` are gone because nothing can be in either state any
-- more. Leaving them in the enum would leave a reader wondering which code path
-- still produces them; the answer would be none.
--
-- ## Why the takedown survives
--
-- Removing the *queue* is a product decision and a reasonable one — it was
-- costing every alumnus a wait and putting administrators in the position of
-- judging people's photographs.
--
-- Removing the *ability to take an image down* would be different. It would
-- mean that if someone ever uploads something abusive onto a page carrying the
-- College's name, the Association has no remedy at all short of a developer
-- running SQL by hand. That is not a privacy property; it is an operational
-- hole. So: no gate, no waiting, no judging — and one button for the rare case.
--
-- ## The trigger has to go
--
-- `guard_photo_approval` existed to stop `sxc_web` publishing a photograph,
-- because publishing was the admin portal's job. It now is `sxc_web`'s job, and
-- the trigger would refuse every upload.
--
-- Apply with:  npm run db:migrate
-- =============================================================================

begin;

-- The trigger first: the constraint below cannot be rewritten while a trigger
-- referencing the old values is still attached.
drop trigger if exists alumni_guard_photo_approval on alumni;
drop function if exists guard_photo_approval();

-- Existing rows. There are none in production yet, but a migration that only
-- works on an empty table is a migration that fails the first time it matters.
update alumni set photo_status = 'live'    where photo_status = 'approved';
update alumni set photo_status = 'live'    where photo_status = 'pending';
update alumni set photo_status = 'removed' where photo_status = 'rejected' and photo_path is not null;
update alumni set photo_status = 'none'    where photo_status = 'rejected';

alter table alumni drop constraint if exists alumni_photo_status_check;
alter table alumni drop constraint if exists photo_state_matches_storage;

alter table alumni
  add constraint alumni_photo_status_check
  check (photo_status in ('none', 'live', 'removed'));

-- A row either has an object and is showing it, or has no object. `removed` and
-- `none` both mean the bytes were deleted — a photograph an administrator took
-- down is not kept, because keeping an image the Association has just judged
-- unsuitable, indefinitely, with nobody looking at it, is the opposite of what
-- taking it down was for.
alter table alumni
  add constraint photo_state_matches_storage
  check ((photo_status = 'live') = (photo_path is not null));

alter table alumni alter column photo_status set default 'none';

comment on column alumni.photo_status is
  'none = no photograph; live = uploaded and visible immediately; removed = an administrator took it down. There is no approval step (0009).';

-- `photo_reviewed_by` keeps its name and its meaning narrows: it now records
-- who took a photograph down, not who approved one. Renaming it would touch
-- more code than the clarity is worth, so the comment carries the meaning.
comment on column alumni.photo_reviewed_by is
  'The administrator who removed this photograph, if one did. Null otherwise — nobody approves photographs (0009).';

-- The queue index has nothing left to index.
drop index if exists alumni_photo_queue;

commit;
