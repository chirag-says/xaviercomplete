/**
 * Generate a paste-able Supabase query that seeds one admin account.
 *
 *   npm run admin:sql
 *
 * Same outcome as `npm run admin:create`, which writes to the database
 * directly. This one writes nothing — it prints SQL for you to run in the
 * Supabase editor, for when that is the only access you have to the database.
 *
 * ## Why the query cannot be written by hand
 *
 * Three of the five columns cannot be produced in SQL at all:
 *
 *   - `password_hash` is **Argon2id**. `pgcrypto`'s `crypt()` offers bcrypt and
 *     not this, so a hash computed in SQL is one the portal will reject.
 *   - `email_enc` and `totp_secret_enc` are AES-256-GCM, and the key lives in
 *     the host's secret store precisely so that it is not in the database.
 *   - `email_hmac` is a keyed blind index. Same reason.
 *
 * And the ciphertext is bound to the row's id as additional authenticated data
 * (plan §3.2), so it cannot be computed before the id exists. This script picks
 * the UUID itself and emits it as a literal, which is why the generated INSERT
 * does not use `gen_random_uuid()`.
 *
 * ## What ends up in the query
 *
 * Ciphertext and an Argon2id hash. **No plaintext password and no readable
 * email address.** That matters because the Supabase SQL editor keeps a query
 * history — pasting this is no worse than the row it creates.
 *
 * The password is typed here, into a masked prompt, and never becomes a
 * command-line argument: an argument lands in shell history and is visible in
 * `ps` to every other user on the machine.
 */

import { stdout } from 'node:process';
import { randomUUID } from 'node:crypto';

import { encryptField, fieldContext } from '../../oxvercity/src/lib/core/crypto.ts';
import { emailBlindIndex } from '../../oxvercity/src/lib/core/hmac.ts';
import { groupForReading } from '../src/lib/base32.ts';
import { newTotpSecret, otpauthUri, verifyTotp } from '../src/lib/totp.ts';
import { assessPassword, hashPassword } from '../src/lib/password.ts';
import { newRecoveryCodes } from '../src/lib/shared.ts';
import { buildSeedSql } from '../src/lib/seed-sql.ts';
import { ask, askSecretTwice, confirm, isInteractive } from './prompt.ts';

const write = (line = '') => stdout.write(`${line}\n`);
const rule = () => write('  ' + '─'.repeat(68));

async function main(): Promise<void> {
  if (!isInteractive()) {
    write('\n  This command needs a terminal — it will not take a password as an argument.\n');
    process.exitCode = 1;
    return;
  }

  write();
  rule();
  write('  SXCCAA admin portal — generate a seed query');
  rule();
  write();
  write('  This prints SQL. It writes nothing and touches no database.');
  write('  Run `npm run admin:create` instead if you can reach the database');
  write('  directly — it does the same thing without the copy and paste.');
  write();

  // Fails now, clearly, rather than at the encrypt call three prompts later.
  try {
    encryptField('probe', fieldContext('admin_user', 'probe', 'probe'));
  } catch (error) {
    write(`  ${(error as Error).message}`);
    write('  The key ring must be loaded. Check ../oxvercity/.env exists.\n');
    process.exitCode = 1;
    return;
  }

  // --- identity --------------------------------------------------------------
  const rawEmail = await ask('  Admin email address:           ');
  const identity = emailBlindIndex(rawEmail);
  if (!identity.ok) {
    write(`\n  That is not a usable email address (${identity.reason}).\n`);
    return;
  }

  const roleAnswer = (await ask('  Role [super_admin / moderator] (default super_admin): ')).trim();
  const role = roleAnswer === 'moderator' ? 'moderator' : 'super_admin';

  // --- password --------------------------------------------------------------
  write();
  write('  At least 12 characters. Checked against Have I Been Pwned —');
  write('  only a 5-character hash prefix leaves this machine, never the password.');
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
    write('  No query generated.\n');
    return;
  }

  // --- two-factor ------------------------------------------------------------
  const secret = newTotpSecret();

  write();
  rule();
  write('  Two-factor — add this to Google Authenticator now');
  rule();
  write();
  write('  Open Google Authenticator → + → Enter a setup key, and type:');
  write();
  write(`      Account:  ${identity.normalised}`);
  write(`      Key:      ${groupForReading(secret)}`);
  write('      Type:     Time based');
  write();
  write('  Or paste this URI into any authenticator that accepts one:');
  write();
  write(`      ${otpauthUri(identity.normalised, secret)}`);
  write();
  write('  No query is printed until you type back a code that works. An');
  write('  account whose authenticator was mistyped is an account nobody can');
  write('  sign in to — and with no second admin, nobody can fix it either.');
  write();

  let confirmed = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = await ask('  Six-digit code from the app:   ');
    if (verifyTotp(secret, code).ok) {
      confirmed = true;
      break;
    }
    write(
      '\n  That code did not match. Check the phone\'s clock is set automatically,\n' +
        '  then try the code showing right now.\n',
    );
  }

  if (!confirmed) {
    write('  Enrolment not confirmed. No query generated.\n');
    return;
  }

  // --- build -----------------------------------------------------------------
  // The id is chosen here because the ciphertext below is bound to it.
  const adminId = randomUUID();

  const passwordHash = await hashPassword(password);
  const emailEnc = encryptField(identity.normalised, fieldContext('admin_user', adminId, 'email'));
  const totpEnc = encryptField(secret, fieldContext('admin_user', adminId, 'totpSecret'));

  const recoveryCodes = newRecoveryCodes(10);
  const recoveryHashes = await Promise.all(recoveryCodes.map((code) => hashPassword(code)));

  const sql = buildSeedSql({
    adminId,
    normalisedEmail: identity.normalised,
    emailEnc,
    emailHmac: identity.hmac,
    passwordHash,
    totpSecretEnc: totpEnc,
    role,
    recoveryHashes,
    generatedAt: new Date().toISOString(),
  });

  // --- output ----------------------------------------------------------------
  write();
  rule();
  write('  Copy everything between the lines into the Supabase SQL editor');
  rule();
  write();
  write(sql);
  write();
  rule();
  write();

  write('  Recovery codes — shown once, never again');
  write();
  for (const code of recoveryCodes) write(`      ${code}`);
  write();
  write('  Each works once, in place of Google Authenticator, if the phone is');
  write('  lost. Keep them somewhere other than the password manager holding');
  write('  the password: one place being breached should not yield both.');
  write();

  await ask('  Press Enter once you have saved the codes and the query. ');
  recoveryCodes.fill('');

  write();
  rule();
  write('  After running the query');
  rule();
  write();
  write('    1. Sign in at the portal to confirm the password and code work.');
  write('       Do this before you close the terminal — if enrolment went');
  write('       wrong, generating a fresh query is easier than recovering.');
  write('    2. Invite a second super admin from inside the portal. One admin');
  write('       with one phone is one lost phone away from a locked portal.');
  write();

  if (await confirm('  Clear this from the screen now?')) {
    stdout.write('c');
  }
}

await main();
