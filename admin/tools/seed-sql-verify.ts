/**
 * Prove the generated seed query actually creates a working admin.
 *
 *   npm run seed:verify
 *
 * `npm run admin:sql` prints SQL for a human to paste into Supabase. That is
 * exactly the kind of thing that looks right, runs without error, and produces
 * an account nobody can sign in to — a wrong `bytea` literal, a hash the portal
 * rejects, a constraint satisfied by accident.
 *
 * So this builds a query the same way the CLI does, **executes it verbatim**,
 * and then signs in with the credentials it was built from. Everything it
 * creates, it removes.
 */

import { randomUUID } from 'node:crypto';

import { connect, type Sql } from '../../oxvercity/src/lib/db.ts';
import { encryptField, fieldContext } from '../../oxvercity/src/lib/core/crypto.ts';
import { emailBlindIndex } from '../../oxvercity/src/lib/core/hmac.ts';
import { newRecoveryCodes } from '../src/lib/shared.ts';
import { buildSeedSql } from '../src/lib/seed-sql.ts';
import { hashPassword } from '../src/lib/password.ts';
import { newTotpSecret, totpAt } from '../src/lib/totp.ts';
import { signIn } from '../src/lib/admin-auth.ts';

const EMAIL = 'seed.sql.verify@example.org';
const PASSWORD = "seed query passphrase o'brien 42"; // the apostrophe is deliberate

let passed = 0;
let failed = 0;

function report(ok: boolean, name: string, detail = ''): void {
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n      ${detail}` : ''}\n`);
  if (ok) passed++;
  else failed++;
}

async function clean(owner: Sql): Promise<void> {
  const identity = emailBlindIndex(EMAIL);
  if (!identity.ok) throw new Error('test address does not normalise');
  await owner`
    delete from admin_recovery_code
     where admin_id in (select id from admin_user where email_hmac = ${identity.hmac})
  `;
  await owner`delete from admin_user where email_hmac = ${identity.hmac}`;
}

async function main(): Promise<void> {
  const owner = connect(process.env.DATABASE_URL ?? '', { max: 1, application_name: 'sxccaa-seedverify' });
  const admin = connect(process.env.ADMIN_DATABASE_URL ?? '', { max: 2, application_name: 'sxccaa-seedverify-admin' });

  try {
    await clean(owner);

    const identity = emailBlindIndex(EMAIL);
    if (!identity.ok) throw new Error('test address does not normalise');

    // --- build, exactly as the CLI does --------------------------------------
    process.stdout.write('\n  Building the query\n');

    const adminId = randomUUID();
    const secret = newTotpSecret();
    const codes = newRecoveryCodes(10);

    const sql = buildSeedSql({
      adminId,
      normalisedEmail: identity.normalised,
      emailEnc: encryptField(identity.normalised, fieldContext('admin_user', adminId, 'email')),
      emailHmac: identity.hmac,
      passwordHash: await hashPassword(PASSWORD),
      totpSecretEnc: encryptField(secret, fieldContext('admin_user', adminId, 'totpSecret')),
      role: 'super_admin',
      recoveryHashes: await Promise.all(codes.map((code) => hashPassword(code))),
      generatedAt: new Date().toISOString(),
    });

    report(sql.includes('begin;') && sql.trimEnd().endsWith('commit;'), 'it is a single transaction');
    report(!sql.includes(PASSWORD), 'the plaintext password is not in it');
    report(!sql.includes(EMAIL), 'nor the readable email address');
    report(!sql.includes(secret), 'nor the TOTP secret');
    for (const code of codes) {
      if (sql.includes(code)) {
        report(false, 'a recovery code leaked into the query');
        break;
      }
    }
    report(!codes.some((code) => sql.includes(code)), 'nor any recovery code');
    // Comments are stripped first: the header explains *why* the id is not
    // gen_random_uuid(), so a naive search for that string finds the
    // explanation and calls it a defect.
    const executable = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    report(!executable.includes('gen_random_uuid()'), 'no executable line mints its own id');
    report(executable.includes(`'${adminId}'::uuid`), 'the id is a literal, because the AAD is bound to it');

    // --- run it, verbatim -----------------------------------------------------
    process.stdout.write('\n  Running it the way Supabase would\n');

    // `.unsafe` sends the text as written — no parameters, no rewriting. That is
    // the point: this must be the same string a human pastes into the editor.
    await owner.unsafe(sql);
    report(true, 'the query executes without error');

    const rows = await owner<Array<{ id: string; status: string; role: string; confirmed: Date | null }>>`
      select id, status, role, totp_confirmed_at as confirmed
        from admin_user where email_hmac = ${identity.hmac}
    `;
    report(rows.length === 1, 'exactly one admin row exists', `found ${rows.length}`);
    report(rows[0]?.id === adminId, 'with the id the ciphertext was bound to');
    report(rows[0]?.status === 'active' && rows[0]?.confirmed !== null, 'active, with two-factor confirmed');
    report(rows[0]?.role === 'super_admin', 'and the role asked for');

    const codeRows = await owner<Array<{ c: number }>>`
      select count(*)::int as c from admin_recovery_code where admin_id = ${adminId}
    `;
    report(codeRows[0]?.c === 10, 'ten recovery codes were written', `found ${codeRows[0]?.c}`);

    // --- the only test that matters ------------------------------------------
    process.stdout.write('\n  Signing in with what the query was built from\n');

    const good = await signIn({ email: EMAIL, password: PASSWORD, totpCode: totpAt(secret) }, {}, admin);
    report(good.ok, 'the seeded account signs in', good.ok ? '' : `refused: ${good.reason}`);
    report(good.ok && good.role === 'super_admin', 'as a super admin');

    await owner`update admin_user set failed_attempts = 0, locked_until = null, totp_last_step = null where id = ${adminId}`;
    const wrong = await signIn({ email: EMAIL, password: 'not the password', totpCode: totpAt(secret) }, {}, admin);
    report(!wrong.ok, 'and a wrong password is still refused');

    await owner`update admin_user set failed_attempts = 0, locked_until = null, totp_last_step = null where id = ${adminId}`;
    const viaRecovery = await signIn({ email: EMAIL, password: PASSWORD, recoveryCode: codes[0] }, {}, admin);
    report(viaRecovery.ok, 'a printed recovery code works in place of the authenticator');

    // --- the duplicate guard --------------------------------------------------
    process.stdout.write('\n  Running it twice is refused\n');

    let duplicateRejected = false;
    try {
      await owner.unsafe(sql);
    } catch {
      duplicateRejected = true;
      /*
       * The query opens with `begin;`, so a failed statement leaves this
       * connection inside an aborted transaction and every later command —
       * including the cleanup below — is refused until it ends. The Supabase
       * editor rolls back for you; a raw client does not.
       */
      await owner.unsafe('rollback;').catch(() => {});
    }
    report(duplicateRejected, 'a second run fails on the unique email index rather than making two accounts');
  } finally {
    await clean(owner);
    await Promise.all([owner.end({ timeout: 5 }), admin.end({ timeout: 5 })]);
  }

  process.stdout.write(`\n  ${passed} passed, ${failed} failed.\n`);
  process.stdout.write(
    failed === 0
      ? '\n  The generated query produces an account that works.\n\n'
      : '\n  The generated query is wrong. Do not paste it anywhere.\n\n',
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

await main();
