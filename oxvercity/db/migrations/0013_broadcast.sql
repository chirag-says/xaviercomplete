-- =============================================================================
-- 0013_broadcast.sql — mailing the alumni, in segments, with a poster
--
-- The Association wants to invite people to events: everyone, or one batch, or
-- one stream. Three tables and one column on `alumni`.
--
-- ## Why `alumni` is the mailing list and `access_grant` is not
--
-- `access_grant` stores a blind index and nothing else — that is the point of
-- it (plan §0.1), and it means there is no address in it to send anything to.
-- Addresses live encrypted on the directory record, so a broadcast is resolved
-- from `alumni` and a person with no directory record cannot be mailed. That is
-- the correct behaviour rather than a gap: someone the Association has granted
-- access to but never imported has given us nothing to write to.
--
-- ## Why `email_opt_out` is separate from `is_visible`
--
-- They are different decisions and conflating them gets one of them wrong.
-- `is_visible` means "do not show me to other Xaverians"; someone who withdraws
-- from the directory has not said they want no word from the Association ever
-- again, and silently unsubscribing them would lose them. `email_opt_out` means
-- "do not write to me", and it must be honoured whatever the directory says.
--
-- Under the DPDP Act withdrawal has to be as easy as the consent was, so the
-- opt-out is one click from the footer of any mailing, with no sign-in.
--
-- ## Why recipients are rows rather than a loop over a query
--
-- Five hundred sends is minutes of work and several minutes is longer than any
-- request should live. Writing the recipient list down first makes the send
-- resumable: a chunk marks what it managed, a crash loses nothing, and pressing
-- the button again continues rather than starting over — which on a mailing
-- means "sends it twice to the first two hundred people".
--
-- Apply with:  npm run db:migrate
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- the opt-out
-- -----------------------------------------------------------------------------

alter table alumni add column email_opt_out boolean not null default false;
alter table alumni add column email_opt_out_at timestamptz;

comment on column alumni.email_opt_out is
  'The alumnus asked to receive no mailings. Set from the unsubscribe link in any broadcast, without signing in. Separate from is_visible on purpose: one is about being seen, the other about being written to.';


-- -----------------------------------------------------------------------------
-- broadcast — one mailing
-- -----------------------------------------------------------------------------

create table broadcast (
  id            uuid primary key default gen_random_uuid(),

  subject       text not null check (length(btrim(subject)) between 1 and 200),
  -- What the admin typed, as plain text. Rendered to HTML at send time with
  -- everything escaped: this is free text a human types into a form, and it is
  -- the only author-supplied content in any template we send.
  body          text not null check (length(btrim(body)) between 1 and 10000),
  -- Optional "more information" destination, shown as a button.
  link_url      text check (link_url is null or link_url ~ '^https?://'),
  link_label    text check (length(link_label) <= 60),

  -- 'everyone' ignores segment_value; 'batch' and 'stream' require it. The
  -- check is what stops a mailing meant for one batch going to five hundred
  -- people because a value was lost somewhere between the form and the insert.
  segment_kind  text not null check (segment_kind in ('everyone', 'batch', 'stream')),
  segment_value text check (length(segment_value) <= 120),

  status        text not null default 'draft'
                     check (status in ('draft', 'sending', 'sent', 'cancelled')),

  created_by    uuid references admin_user(id) on delete set null,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,

  constraint segment_value_matches_kind
    check ((segment_kind = 'everyone') = (segment_value is null))
);

create index broadcast_recent on broadcast (created_at desc);

comment on table broadcast is
  'One mailing to the alumni. Holds no addresses — recipients are resolved from the directory at send time and recorded by alumni id.';


-- -----------------------------------------------------------------------------
-- broadcast_poster — the event poster
--
-- Its own table so the public site can be granted the image and nothing else.
-- The bytes are wanted by a mail client rendering the message; the subject, the
-- body and above all the recipient list are not, and a column-level grant on a
-- wide table is the kind of thing that quietly widens later.
-- -----------------------------------------------------------------------------

create table broadcast_poster (
  broadcast_id uuid primary key references broadcast(id) on delete cascade,
  bytes        bytea not null,
  content_type text  not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  width        int   not null check (width  between 1 and 8000),
  height       int   not null check (height between 1 and 8000),
  -- For the attachment filename only. Never rendered as markup.
  filename     text  not null check (length(filename) between 1 and 120),
  created_at   timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- broadcast_recipient — who is due a copy, and who got one
--
-- `unique (broadcast_id, alumni_id)` is the thing that makes resending safe: a
-- second attempt to build the list cannot add a person twice, so nobody is
-- mailed twice by a retry.
-- -----------------------------------------------------------------------------

create table broadcast_recipient (
  id             uuid primary key default gen_random_uuid(),
  broadcast_id   uuid not null references broadcast(id) on delete cascade,
  alumni_id      text not null references alumni(id) on delete cascade,

  status         text not null default 'pending'
                      check (status in ('pending', 'sent', 'failed', 'skipped')),
  -- A reason code — 'no_address', 'provider_error', 'undecryptable'. Never a
  -- provider message, which can echo the address back at us.
  reason         text check (length(reason) <= 40),
  sent_at        timestamptz,

  unique (broadcast_id, alumni_id)
);

-- The send loop asks for "the next N still pending for this broadcast", which
-- is this index exactly.
create index broadcast_recipient_pending
  on broadcast_recipient (broadcast_id)
  where status = 'pending';


-- -----------------------------------------------------------------------------
-- grants
-- -----------------------------------------------------------------------------

-- The portal owns all of this.
grant select, insert, update, delete on broadcast, broadcast_poster, broadcast_recipient to sxc_admin;

-- The public site gets the poster image, so the <img> in a delivered email
-- resolves, and the opt-out column, so the unsubscribe link can act. Nothing
-- else: it cannot read a subject, a body, or — the one that matters — which
-- alumnus was sent what.
grant select on broadcast_poster to sxc_web;
grant update (email_opt_out, email_opt_out_at) on alumni to sxc_web;

-- RLS on, to match every other table, so `anon`, `authenticated` and anything
-- created later match no policy and get nothing.
alter table broadcast enable row level security;
alter table broadcast_poster enable row level security;
alter table broadcast_recipient enable row level security;

-- …and immediately a policy letting our own roles through, which is the whole
-- lesson of 0005. RLS applies to every non-owner, and these roles do not own
-- these tables: without this, INSERT fails loudly and SELECT and UPDATE fail
-- *silently*, matching zero rows and reporting success. A broadcast would
-- report "0 recipients, sent" and mail nobody, and it would look like it worked.
--
-- As in 0005, `using (true)` hands row filtering back to the grants above,
-- which remain the real control: sxc_web still cannot read a subject, a body,
-- or the recipient list.
do $$
declare
  t text;
begin
  foreach t in array array['broadcast', 'broadcast_poster', 'broadcast_recipient'] loop
    execute format(
      'create policy sxc_app_access on %I for all to sxc_web, sxc_admin, sxc_ingest using (true) with check (true)',
      t
    );
  end loop;
end;
$$;

commit;
