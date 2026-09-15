/**
 * Prove the database is locked the way the plan says it is.
 *
 *   npm run db:verify
 *
 * Most of these assert a *failure*. A permission error here is the system
 * working: the design rests on the public application being physically unable
 * to rename an alumnus, grant itself access, read an admin row, delete a
 * record or rewrite history. The positive controls matter just as much —
 * without them, a migration that granted nothing at all would pass.
 *
 * ## Why it opens real connections rather than using SET ROLE
 *
 * The first version used `set local role sxc_web`. On Supabase the `postgres`
 * role is not a superuser and is not a member of the roles it creates, so every
 * SET ROLE failed — and because that failure looked exactly like a permission
 * error, all eleven "denied" checks passed for entirely the wrong reason. A
 * verification script that reports green when it has tested nothing is worse
 * than no verification script.
 *
 * Connecting as each role removes the ambiguity and tests more: it proves the
 * credentials in .env actually work, which SET ROLE never could.
 *
 * Run it after the first apply, and after any change to the role grants.
 */

import { connect, type Sql } from '../../src/lib/db.ts';

const TABLES = [
  'admin_user', 'admin_invite', 'admin_recovery_code', 'alumni', 'access_grant',
  'login_token', 'session', 'access_request', 'rate_limit', 'audit_log',
];

/** Valid under the alumni id constraint: twelve characters, no 0/1/l/o. */
const SEED_ID = 'verifyrecabc';

let passed = 0;
let failed = 0;

function report(ok: boolean, name: string, detail = ''): void {
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n      ${detail}` : ''}\n`);
  if (ok) passed++;
  else failed++;
}

/**
 * Swap the credentials in the owner URL for a role's.
 *
 * Supabase's pooler expects `role.projectref` as the username, so the project
 * reference is lifted from the existing one rather than configured separately.
 */
function urlForRole(ownerUrl: string, role: string, password: string): string {
  const url = new URL(ownerUrl);
  const projectRef = decodeURIComponent(url.username).split('.').slice(1).join('.');
  url.username = encodeURIComponent(projectRef ? `${role}.${projectRef}` : role);
  url.password = encodeURIComponent(password);
  return url.toString();
}

/**
 * Assert whether `body` is permitted for this connection.
 *
 * A connection failure is reported distinctly: it means the credentials are
 * wrong, which is a different problem from the statement being refused, and
 * conflating the two is how the previous version lied.
 */
async function check(
  sql: Sql | null,
  name: string,
  expect: 'denied' | 'allowed',
  body: (tx: Sql) => Promise<unknown>,
): Promise<void> {
  if (!sql) {
    report(false, name, 'no connection for this role — could not test');
    return;
  }

  let outcome: 'allowed' | 'denied' = 'allowed';
  let message = '';
  try {
    await body(sql);
  } catch (error) {
    outcome = 'denied';
    message = (error as Error).message.split('\n')[0] ?? '';
  }
  report(outcome === expect, name, outcome === expect ? '' : `expected ${expect}, got ${outcome}. ${message}`);
}

/**
 * A positive control that also insists something actually happened.
 *
 * The RLS bug fixed in 0005 passed every "allowed" check while affecting zero
 * rows — success with no effect looked identical to success. Asserting on the
 * row count is what makes these checks mean anything.
 */
async function checkAffects(
  sql: Sql | null,
  name: string,
  minimumRows: number,
  body: (tx: Sql) => Promise<unknown>,
): Promise<void> {
  if (!sql) {
    report(false, name, 'no connection for this role — could not test');
    return;
  }
  try {
    const result = (await body(sql)) as { count?: number; length?: number };
    const rows = result?.count ?? result?.length ?? 0;
    report(
      rows >= minimumRows,
      name,
      rows >= minimumRows ? '' : `statement succeeded but touched ${rows} rows — something is silently swallowing it`,
    );
  } catch (error) {
    report(false, name, `denied: ${(error as Error).message.split('\n')[0]}`);
  }
}

async function tryConnect(url: string, label: string): Promise<Sql | null> {
  const sql = connect(url, { max: 1, application_name: `sxccaa-verify-${label}` });
  try {
    await sql`select 1`;
    return sql;
  } catch (error) {
    process.stdout.write(`  ! could not connect as ${label}: ${(error as Error).message.split('\n')[0]}\n`);
    await sql.end({ timeout: 2 }).catch(() => {});
    return null;
  }
}

async function main(): Promise<void> {
  const ownerUrl = process.env.DATABASE_URL ?? '';
  if (!ownerUrl) {
    process.stderr.write('\n  DATABASE_URL is not set.\n\n');
    process.exit(1);
  }

  const owner = connect(ownerUrl, { max: 1, application_name: 'sxccaa-verify' });
  const passwords = {
    sxc_web: process.env.SXC_WEB_PASSWORD ?? '',
    sxc_ingest: process.env.SXC_INGEST_PASSWORD ?? '',
  };

  let web: Sql | null = null;
  let ingest: Sql | null = null;

  try {
    // --- schema ---------------------------------------------------------------
    process.stdout.write('\n  Row Level Security\n');
    const rls = await owner<Array<{ tablename: string; rowsecurity: boolean }>>`
      select tablename, rowsecurity from pg_tables
      where schemaname = 'public' and tablename = any(${TABLES})
    `;
    report(rls.length === TABLES.length, `all ${TABLES.length} tables exist`, `found ${rls.length}`);
    const open = rls.filter((row) => !row.rowsecurity).map((row) => row.tablename);
    report(open.length === 0, 'RLS enabled on every table', open.join(', '));

    // --- a row to act on ------------------------------------------------------
    await owner`delete from alumni where id = ${SEED_ID}`;
    await owner`
      insert into alumni (id, full_name, batch_year, current_org)
      values (${SEED_ID}, 'Verification Row', 2011, 'Placeholder')
    `;

    process.stdout.write('\n  Connecting as the least-privilege roles\n');
    web = passwords.sxc_web ? await tryConnect(urlForRole(ownerUrl, 'sxc_web', passwords.sxc_web), 'sxc_web') : null;
    ingest = passwords.sxc_ingest ? await tryConnect(urlForRole(ownerUrl, 'sxc_ingest', passwords.sxc_ingest), 'sxc_ingest') : null;
    report(web !== null, 'sxc_web can sign in');
    report(ingest !== null, 'sxc_ingest can sign in');

    // --- the denials ----------------------------------------------------------
    process.stdout.write('\n  The public role (sxc_web) must not be able to:\n');
    await check(web, 'rename an alumnus', 'denied',
      (tx) => tx`update alumni set full_name = 'Changed' where id = ${SEED_ID}`);
    await check(web, 'change a batch year', 'denied',
      (tx) => tx`update alumni set batch_year = 1999 where id = ${SEED_ID}`);
    await check(web, 'change the login identity', 'denied',
      (tx) => tx`update alumni set gmail_hmac = decode(repeat('22',32),'hex') where id = ${SEED_ID}`);
    await check(web, 'grant itself access', 'denied',
      (tx) => tx`insert into access_grant (email_hmac, source) values (decode(repeat('00',32),'hex'), 'import')`);
    await check(web, 'revoke an access grant', 'denied',
      (tx) => tx`update access_grant set revoked_at = now()`);
    await check(web, 'read an admin account', 'denied',
      (tx) => tx`select id from admin_user limit 1`);
    await check(web, 'read an admin invitation', 'denied',
      (tx) => tx`select id from admin_invite limit 1`);
    await check(web, 'read an admin recovery code', 'denied',
      (tx) => tx`select id from admin_recovery_code limit 1`);
    await check(web, 'rewrite the audit log', 'denied',
      (tx) => tx`update audit_log set action = 'tampered'`);
    await check(web, 'delete from the audit log', 'denied',
      (tx) => tx`delete from audit_log`);
    await check(web, 'read the audit log back', 'denied',
      (tx) => tx`select id from audit_log limit 1`);
    await check(web, 'delete an alumnus', 'denied',
      (tx) => tx`delete from alumni where id = ${SEED_ID}`);
    await check(web, 'create a table', 'denied',
      (tx) => tx`create table should_not_exist (id int)`);
    await check(web, 'drop a table', 'denied',
      (tx) => tx`drop table alumni`);

    // --- the positive controls ------------------------------------------------
    process.stdout.write('\n  …but it must still be able to:\n');
    await checkAffects(web, 'read the directory', 1,
      (tx) => tx`select id, full_name from alumni limit 1`);
    await check(web, 'check the login allowlist', 'allowed',
      (tx) => tx`select id from access_grant limit 1`);
    await checkAffects(web, 'let an alumnus update their employer', 1,
      (tx) => tx`update alumni set current_org = 'New Employer', owner_updated_at = now() where id = ${SEED_ID}`);
    await checkAffects(web, 'let an alumnus flip a visibility toggle', 1,
      (tx) => tx`update alumni set show_gmail = false where id = ${SEED_ID}`);
    // Photographs publish immediately (0009). The approval trigger that used to
    // stop sxc_web doing this is gone, because it is now sxc_web's job.
    await checkAffects(web, 'let an alumnus publish a photograph', 1,
      (tx) => tx`update alumni set photo_path = 'aaaaaaaaaaaaaaaaaaaaaa', photo_status = 'live' where id = ${SEED_ID}`);
    await checkAffects(web, 'let an alumnus leave the directory', 1,
      (tx) => tx`update alumni set is_visible = false where id = ${SEED_ID}`);
    await checkAffects(web, 'open a session', 0,
      (tx) => tx`insert into session (token_hash, email_hmac, expires_at)
                 values (decode(repeat('33',32),'hex'), decode(repeat('44',32),'hex'), now() + interval '1 day')`);
    await checkAffects(web, 'append to the audit log', 0,
      (tx) => tx`insert into audit_log (actor_type, action) values ('system', 'db_verify')`);

    // --- the ingest role ------------------------------------------------------
    process.stdout.write('\n  The ingest role must not be able to:\n');
    await check(ingest, 'delete an alumnus', 'denied',
      (tx) => tx`delete from alumni where id = ${SEED_ID}`);
    await check(ingest, 'read an admin account', 'denied',
      (tx) => tx`select id from admin_user limit 1`);
    await check(ingest, 'open a session', 'denied',
      (tx) => tx`insert into session (token_hash, email_hmac, expires_at)
                 values (decode(repeat('55',32),'hex'), decode(repeat('66',32),'hex'), now() + interval '1 day')`);
    process.stdout.write('\n  …but it must be able to load the directory:\n');
    await checkAffects(ingest, 'update an alumni record', 1,
      (tx) => tx`update alumni set stream = 'B.Sc. Physics' where id = ${SEED_ID}`);
    await check(ingest, 'build the allowlist', 'allowed',
      (tx) => tx`insert into access_grant (email_hmac, source)
                 values (decode(repeat('77',32),'hex'), 'import')
                 on conflict (email_hmac) do nothing`);

    // --- constraints ----------------------------------------------------------
    process.stdout.write('\n  Constraints refuse a record that contradicts the access model:\n');
    await check(owner, 'no "show my number" without a number', 'denied',
      (tx) => tx`update alumni set show_contact = true where id = ${SEED_ID}`);
    await check(owner, 'no "show my Gmail" without a Gmail', 'denied',
      (tx) => tx`update alumni set show_gmail = true where id = ${SEED_ID}`);
    await check(owner, 'no photo status claiming a file that is not there', 'denied',
      (tx) => tx`update alumni set photo_path = null, photo_status = 'live' where id = ${SEED_ID}`);
    await check(owner, 'no active admin without confirmed 2FA', 'denied',
      (tx) => tx`
        insert into admin_user (email_enc, email_hmac, password_hash, totp_secret_enc, status, role)
        values ('\\x00'::bytea, decode(repeat('11',32),'hex'), 'argon2', '\\x00'::bytea, 'active', 'super_admin')
      `);
    await check(owner, 'no readable alumni id that leaks a name', 'denied',
      (tx) => tx`insert into alumni (id, full_name, batch_year) values ('priya-menon', 'X', 2011)`);
    await check(owner, 'a bare insert works — no unsatisfiable default', 'allowed',
      (tx) => tx`insert into alumni (id, full_name, batch_year) values ('bareinsertaa', 'Bare', 2011)`);

    process.stdout.write('\n  Supabase\'s internet-facing roles hold nothing:\n');
    const exposed = await owner<Array<{ grantee: string; table_name: string }>>`
      select grantee, table_name from information_schema.role_table_grants
      where grantee in ('anon', 'authenticated') and table_schema = 'public'
    `;
    report(exposed.length === 0, 'anon and authenticated have no privileges', `found ${exposed.length} grants`);

    // --- tidy up --------------------------------------------------------------
    // audit_log rows stay: the append-only trigger blocks DELETE for everyone,
    // including the owner, which is the point. Two rows saying 'db_verify' are a
    // fair record of what happened.
    await owner`delete from alumni where id in (${SEED_ID}, 'bareinsertaa')`;
    await owner`delete from access_grant where email_hmac = decode(repeat('77',32),'hex')`;
    await owner`delete from session where email_hmac = decode(repeat('44',32),'hex')`;

    process.stdout.write(
      `\n  ${passed} passed, ${failed} failed.\n\n` +
        (failed === 0
          ? '  Every denial above is the design working.\n\n'
          : '  Something is not locked. Do not load real data until this is green.\n\n'),
    );
  } finally {
    await Promise.all([
      owner.end({ timeout: 5 }),
      web?.end({ timeout: 5 }),
      ingest?.end({ timeout: 5 }),
    ]);
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`\n  ${(error as Error).message}\n\n`);
  process.exit(1);
});
