-- =============================================================================
-- 0012_contact_message.sql — store contact-form enquiries
--
-- The contact form has always emailed its messages to the Association mailbox.
-- This migration adds a table so the admin portal can list, read and archive
-- them without leaving the portal.
--
-- The message text and the sender's name and address are stored **in the
-- clear**, not encrypted. These are not alumni records — they are free-text
-- enquiries from the public, sent voluntarily, with no expectation that the
-- Association would keep them only in ciphertext. Encrypting them would mean
-- the admin portal could not search or sort by sender without a blind index on
-- every field, which is the wrong trade-off for a mailbox analogue.
--
-- Apply with:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/0012_contact_message.sql
-- =============================================================================

begin;

create table contact_message (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null check (length(btrim(name)) between 1 and 120),
  email      text        not null check (length(email) between 3 and 320),
  message    text        not null check (length(btrim(message)) between 1 and 4000),
  source     text        check (length(source) <= 120),
  status     text        not null default 'unread'
                         check (status in ('unread', 'read', 'archived')),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index contact_message_unread on contact_message (created_at desc) where status = 'unread';
create index contact_message_recent on contact_message (created_at desc);

comment on table contact_message is
  'Contact-form enquiries. Stored alongside email delivery so admins can review them in the portal.';

-- RLS: deny-all by default, then open narrow lanes for the two roles.
-- Unlike the tables in 0001 where deny-all is the whole policy (nothing uses
-- PostgREST), this table is written by sxc_web and read by sxc_admin through
-- direct connections, so explicit policies are required.
alter table contact_message enable row level security;

create policy contact_message_web_insert on contact_message
  for insert to sxc_web
  with check (true);

create policy contact_message_admin_select on contact_message
  for select to sxc_admin
  using (true);

create policy contact_message_admin_update on contact_message
  for update to sxc_admin
  using (true)
  with check (true);

-- The public site can insert messages but never read them back.
grant insert on contact_message to sxc_web;

-- The admin portal can read and update status (mark read, archive) but not
-- delete — messages are retained, as they are in a mailbox.
grant select, update on contact_message to sxc_admin;

commit;
