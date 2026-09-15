-- =============================================================================
-- 0005_rls_policies.sql — let the application roles through RLS
--
-- Found by `npm run db:verify` on 11 September 2026, and it is my mistake in
-- 0001.
--
-- ## What was wrong
--
-- 0001 enabled RLS on all ten tables and deliberately defined no policies,
-- described as "deny-all, defence in depth, so a leaked key is inert". That
-- reasoning came from plan §2, which assumed database access would arrive over
-- PostgREST as `anon` or `service_role`.
--
-- It does not. This project connects directly as `sxc_web`, `sxc_admin` and
-- `sxc_ingest` (0002). None of them owns the tables, so **RLS applied to them
-- too**, and deny-all denied our own application:
--
--   * INSERT failed loudly — "new row violates row-level security policy".
--   * UPDATE and SELECT failed *silently*, matching zero rows and returning
--     success. That is the dangerous half: the site would have rendered an
--     empty directory and reported every profile save as saved.
--
-- ## The fix, and what is still being defended
--
-- One permissive policy per table for the three application roles. This grants
-- nothing on its own: the table and **column** grants in 0002 remain the real
-- access control, and `npm run db:verify` still proves sxc_web cannot rename an
-- alumnus, touch the allowlist, read an admin row or rewrite the audit log.
--
-- RLS continues to do the job it was actually added for: every other role —
-- `anon`, `authenticated`, `public`, and anything created later — still matches
-- no policy and still gets nothing. A leaked Supabase anon key remains inert,
-- which was the point.
--
-- ## The lesson worth keeping
--
-- "Enable RLS with no policies" is only deny-all for non-owners, and every
-- non-owner means every non-owner — including the code that is supposed to
-- work. A control that silently returns zero rows instead of an error is worse
-- than one that fails loudly, because it looks like success.
-- =============================================================================

begin;

do $$
declare
  t text;
begin
  foreach t in array array[
    'admin_user', 'admin_invite', 'admin_recovery_code', 'alumni', 'access_grant',
    'login_token', 'session', 'access_request', 'rate_limit', 'audit_log'
  ] loop
    -- `for all ... using (true) with check (true)` hands the row filtering back
    -- to the grants. The three roles differ enormously in what they may do, and
    -- 0002 is where that difference lives; repeating it here in policy form
    -- would be a second copy of the rules to keep in step with the first.
    execute format(
      'create policy sxc_app_access on %I for all to sxc_web, sxc_admin, sxc_ingest using (true) with check (true)',
      t
    );
  end loop;
end;
$$;

commit;
