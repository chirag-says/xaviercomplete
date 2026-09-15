-- =============================================================================
-- 0004_show_gmail_default.sql — make the Gmail toggle fail closed
--
-- Found by `npm run db:verify` on 11 September 2026.
--
-- 0001 gave `show_gmail` a default of `true`, matching the policy in plan §1.3
-- ("default ON"). Combined with the `show_gmail_needs_a_gmail` constraint, that
-- made a minimal insert impossible:
--
--     insert into alumni (id, full_name, batch_year) values (...);
--     ERROR: new row violates check constraint "show_gmail_needs_a_gmail"
--
-- — because the default said "show their Gmail" about a row with no Gmail in
-- it. A default that cannot be satisfied by a bare insert is a trap for anyone
-- writing a fixture, a test or a manual correction later.
--
-- The policy has not changed. "ON by default" is applied at import, in
-- toggleDefaults() in tools/ingest/plan.ts, which is the only place that knows
-- whether the person actually supplied a Gmail — the fact the policy depends on.
-- The schema now only encodes the safe fallback.
--
-- Direction matters: for a visibility flag, the fallback must be *hidden*. A
-- default of true means any future code path that forgets to set it publishes an
-- address; a default of false means it hides one. Only the second failure is
-- one you can apologise for.
--
-- `show_contact` already defaulted to false and is unchanged.
-- =============================================================================

begin;

alter table alumni alter column show_gmail set default false;

comment on column alumni.show_gmail is
  'Fails closed. The "ON when they gave us a Gmail" policy is applied at import by toggleDefaults(); the schema default only decides what happens when nobody said.';

commit;
