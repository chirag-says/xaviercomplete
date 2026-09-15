/**
 * Create the first super admin.
 *
 *   npm run admin:create
 *
 * This is the bootstrap, and it exists so that the alternative does not: a
 * public "create an admin account" page is a public door to five hundred
 * people's contact details, and no password policy makes that safe (plan §9.2).
 * Every admin after the first is created by invitation from inside the portal.
 *
 * Same trust model as the ingest tool: it is not part of the deployed
 * application, so it cannot be reached over the internet. It runs on a machine
 * that already holds `DATA_ENCRYPTION_KEYS`.
 *
 * ## The order of operations matters
 *
 * Nothing is written until the TOTP enrolment is confirmed with a live code. An
 * admin row that exists with unconfirmed 2FA is an admin row with no 2FA, and
 * if the process were to die between the insert and the confirmation that is
 * exactly what would be left behind. So: prompt, verify, *then* write, in one
 * transaction.
 */

import { stdout } from 'node:process';

import { connect, type Sql } from '../src/lib/shared-db.ts';
import { encryptField, fieldContext } from '../src/lib/core/crypto.ts';
import { emailBlindIndex } from '../src/lib/core/hmac.ts';
import { groupForReading } from '../src/lib/base32.ts';
import { newTotpSecret, otpauthUri, verifyTotp } from '../src/lib/totp.ts';
import { assessPassword } from '../src/lib/password.ts';
import { createAdminAccount } from '../src/lib/provision.ts';
import { issueRecoveryCodes } from '../src/lib/recovery.ts';
import { ask, askSecretTwice, confirm, isInteractive } from './prompt.ts';

const write = (line = '') => stdout.write(`${line}\n`);

function rule(): void {
  write('  ' + '─'.repeat(66));
}

async function main(): Promise<void> {
  if (!isInteractive()) {
    write('\n  This command needs a terminal — it will not take a password as an argument.\n');
    process.exitCode = 1;
    return;
  }

  write();
  rule();
  write('  SXCCAA admin portal — create the first super admin');
  rule();
  write();
  write('  This writes one account directly to the database. Every admin after');
  write('  this one is invited from inside the portal, never created here.');
  write();

  const url = process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    write('  ADMIN_DATABASE_URL is not set. Nothing to connect to.\n');
    process.exitCode = 1;
    return;
  }

  // Fails fast and clearly if the key ring is missing, rather than at the
  // encrypt call three prompts later.
  try {
    encryptField('probe', fieldContext('admin_user', 'probe', 'probe'));
  } catch (error) {
    write(`  ${(error as Error).message}`);
    write('  Set DATA_ENCRYPTION_KEYS (npm run keys:generate in the oxvercity app).\n');
    process.exitCode = 1;
    return;
  }

  const sql: Sql = connect(url, { max: 1, application_name: 'sxccaa-admin-create' });

  try {
    // --- identity ------------------------------------------------------------
    const rawEmail = await ask('  Admin email address:           ');
    const identity = emailBlindIndex(rawEmail);
    if (!identity.ok) {
      write(`\n  That is not a usable email address (${identity.reason}).\n`);
      return;
    }

    const existing = await sql<Array<{ id: string }>>`
      select id from admin_user where email_hmac = ${identity.hmac} limit 1
    `;
    if (existing.length > 0) {
      write('\n  An admin already exists with that address. Nothing was written.');
      write('  To reset it, use another super admin\'s account, or remove the row first.\n');
      return;
    }

    const count = await sql<Array<{ count: number }>>`select count(*)::int as count from admin_user`;
    const isFirst = (count[0]?.count ?? 0) === 0;
    if (!isFirst) {
      write();
      write(`  There ${count[0]!.count === 1 ? 'is already 1 admin' : `are already ${count[0]!.count} admins`}.`);
      write('  The supported way to add another is an invitation from inside the portal,');
      write('  which leaves an audit trail naming who invited whom. This does not.');
      write();
      if (!(await confirm('  Create one here anyway?'))) {
        write('\n  Nothing was written.\n');
        return;
      }
    }

    // --- password ------------------------------------------------------------
    write();
    write('  Choose a password. At least 12 characters — a phrase you can');
    write('  remember beats a short string you cannot. It is checked against');
    write('  Have I Been Pwned; only a 5-character hash prefix leaves this');
    write('  machine, never the password.');
    write();

    let password = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      password = await askSecretTwice('  Password:                      ');
      const verdict = await assessPassword(password);
      if (verdict.ok) break;
      write(`\n  ${verdict.message}\n`);
      password = '';
    }
    if (!password) {
      write('  Nothing was written.\n');
      return;
    }

    // --- TOTP enrolment ------------------------------------------------------
    const secret = newTotpSecret();

    write();
    rule();
    write('  Two-factor enrolment — this is not optional');
    rule();
    write();
    write('  Add this to your authenticator app (1Password, Aegis, Google');
    write('  Authenticator, anything that does TOTP). Either paste the URI or');
    write('  type the secret in by hand.');
    write();
    write(`  Secret:  ${groupForReading(secret)}`);
    write();
    write(`  URI:     ${otpauthUri(identity.normalised, secret)}`);
    write();
    write('  Nothing is written to the database until you type back a code');
    write('  that works — an account with unconfirmed 2FA is an account with');
    write('  no 2FA.');
    write();

    let confirmed = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = await ask('  Six-digit code from the app:   ');
      const result = verifyTotp(secret, code);
      if (result.ok) {
        confirmed = true;
        break;
      }
      write(
        result.reason === 'malformed'
          ? '\n  That is not a six-digit code.\n'
          : '\n  That code did not match. Check your phone\'s clock is set automatically.\n',
      );
    }

    if (!confirmed) {
      write('  Enrolment not confirmed. Nothing was written.\n');
      return;
    }

    // --- write ---------------------------------------------------------------
    // Shared with the invitation flow, so "create an admin" has exactly one
    // implementation. One transaction: either the account exists with confirmed
    // 2FA, or it does not exist at all.
    const adminId = await createAdminAccount(
      {
        normalisedEmail: identity.normalised,
        emailHmac: identity.hmac,
        password,
        totpSecret: secret,
        role: 'super_admin',
      },
      sql,
    );

    const codes = await issueRecoveryCodes(adminId, sql);

    // --- recovery codes ------------------------------------------------------
    write();
    rule();
    write('  Recovery codes — shown once, never again');
    rule();
    write();
    write('  Each works once, in place of your authenticator, if you lose your');
    write('  phone. Only their hashes are stored, so nobody — including us —');
    write('  can show them to you again.');
    write();
    for (const code of codes) write(`      ${code}`);
    write();
    write('  Print these or write them down. Keep them somewhere other than the');
    write('  password manager holding the password: one place that is breached');
    write('  should not yield both factors.');
    write();
    await ask('  Press Enter once you have saved them. ');

    // Scrub the codes from this process's memory before it exits. Not a strong
    // guarantee in a garbage-collected runtime, but it costs nothing and
    // narrows the window in which a core dump would contain them.
    codes.fill('');

    write();
    rule();
    write('  Done.');
    rule();
    write();
    write(`  Account:  ${identity.normalised}`);
    write('  Role:     super admin');
    write();
    write('  Two things worth doing now:');
    write('    1. Sign in at the portal to confirm the password and code work.');
    write('    2. Invite a second super admin. One admin with one phone is one');
    write('       lost phone away from a locked portal.');
    write();
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await main();
