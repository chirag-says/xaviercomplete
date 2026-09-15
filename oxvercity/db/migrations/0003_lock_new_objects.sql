-- =============================================================================
-- 0003_lock_new_objects.sql — close Supabase's default grants for good
--
-- Found by `npm run db:verify` on 11 September 2026, immediately after the first
-- apply: `schema_migration` was readable *and writable* by `anon` over
-- PostgREST — that is, by anyone on the internet holding the project's publicly
-- shipped anon key.
--
-- The table itself only holds migration filenames and checksums, so the direct
-- disclosure is minor. The cause is not minor: Supabase ships
--
--     alter default privileges in schema public grant all on tables to anon, authenticated;
--
-- so **every table created in `public` from now on starts world-accessible**.
-- 0001 revoked the grants on the ten tables that existed when it ran, which
-- fixed that moment and nothing after it. `schema_migration` was created
-- seconds later and came up open. The next table added in Phase 3 would have too.
--
-- This migration does three things:
--   1. revokes from anon/authenticated across every table in the schema, by
--      enumeration rather than a hardcoded list, so nothing is missed;
--   2. changes the default privileges, so anything created later starts closed;
--   3. puts RLS on schema_migration like everything else.
--
-- Nothing in this project reaches Postgres through PostgREST. These two roles
-- are used by nothing here and should hold nothing.
-- =============================================================================

begin;

-- --- 1. Everything that already exists ----------------------------------------

do $$
declare
  obj record;
  exposed text[] := array(
    select rolname from pg_roles where rolname in ('anon', 'authenticated')
  );
  role_list text;
begin
  if array_length(exposed, 1) is null then
    raise notice 'anon/authenticated do not exist; nothing to revoke.';
    return;
  end if;

  select string_agg(quote_ident(r), ', ') into role_list from unnest(exposed) as r;

  for obj in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on table %I from %s', obj.tablename, role_list);
  end loop;

  for obj in
    select sequencename from pg_sequences where schemaname = 'public'
  loop
    execute format('revoke all on sequence %I from %s', obj.sequencename, role_list);
  end loop;
end;
$$;


-- --- 2. Everything created from now on ----------------------------------------
--
-- Default privileges are recorded per granting role, so this must run as the
-- role that creates the tables — `postgres`, which is who applies migrations.

do $$
declare
  role_list text;
begin
  select string_agg(quote_ident(rolname), ', ') into role_list
  from pg_roles where rolname in ('anon', 'authenticated');

  if role_list is null then return; end if;

  execute format('alter default privileges in schema public revoke all on tables from %s', role_list);
  execute format('alter default privileges in schema public revoke all on sequences from %s', role_list);
  execute format('alter default privileges in schema public revoke all on functions from %s', role_list);
end;
$$;


-- --- 3. The migration ledger gets the same treatment as everything else --------
--
-- Created by tools/db/migrate.ts rather than by a migration, so 0001's loop
-- never saw it.

alter table if exists schema_migration enable row level security;

commit;
