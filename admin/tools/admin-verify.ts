/**
 * Exercise admin authentication against the live database.
 *
 *   npm run admin:verify
 *
 * The unit tests cover the arithmetic and the RFC vectors. This covers the
 * things only a real database can answer: does a lockout actually bind, does a
 * disabled account really lose its session on the next request, can `sxc_web`
 * read an admin row if it tries, and — the one that silently ruins everything —
 * do the two applications hold the same encryption keys.
 *
 * Everything it creates, it removes. Audit rows stay: they are append-only by
 * design and a fair record of what happened.
 */

import { connect, type Sql } from '../src/lib/shared-db.ts';
import { decryptField, encryptField, fieldContext } from '../src/lib/core/crypto.ts';
import { emailBlindIndex, ipBlindIndex } from '../src/lib/core/hmac.ts';
import { signIn, stepUp, changeOwnPassword, lockoutFor } from '../src/lib/admin-auth.ts';
import {
  createAdminSession,
  isStepUpFresh,
  markSteppedUp,
  readAdminSession,
  revokeAdminSession,
  revokeAllAdminSessions,
  STEP_UP_WINDOW_MS,
} from '../src/lib/admin-session.ts';
import { createAdminAccount } from '../src/lib/provision.ts';
import { issueRecoveryCodes, countUnused } from '../src/lib/recovery.ts';
import { newTotpSecret, totpAt } from '../src/lib/totp.ts';
import { createAlumnus, grantAlumnusAccess } from '../src/lib/alumni-create.ts';
import { deleteAlumnus } from '../src/lib/alumni-delete.ts';

const EMAIL = 'admin.verify.931@example.org';
const PASSWORD = 'correct horse battery staple 931';
const OTHER_PASSWORD = 'a different long passphrase 000';
const PROBE_EMAIL = 'verify.deletion.931@example.org';

let passed = 0;
let failed = 0;

function report(ok: boolean, name: string, detail = ''): void {
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n      ${detail}` : ''}\n`);
  if (ok) passed++;
  else failed++;
}

/** A fresh code for right now. The window is ±1 step, so this is always valid. */
const code = (secret: string) => totpAt(secret);

async function clean(owner: Sql): Promise<void> {
  /*
   * The probe first, then the admin — and that order is load-bearing.
   *
   * `access_grant.granted_by` is `on delete set null`, but the table also has
   * `admin_grants_name_their_author`, a check that a grant with source
   * 'admin_grant' has a non-null author. Deleting an admin who has granted
   * access therefore makes Postgres set a column to a value its own constraint
   * forbids, and the delete fails with 23514.
   *
   * Clearing the grant this run created removes the reference before the admin
   * goes. That keeps the verifier working; it does not fix the schema, which is
   * contradictory for any administrator who has ever granted access.
   */
  const probe = emailBlindIndex(PROBE_EMAIL);
  if (probe.ok) {
    await owner`delete from session where email_hmac = ${probe.hmac}`;
    await owner`delete from login_token where email_hmac = ${probe.hmac}`;
    await owner`delete from access_grant where email_hmac = ${probe.hmac}`;
    await owner`delete from access_request where email_hmac = ${probe.hmac}`;
    await owner`delete from alumni where gmail_hmac = ${probe.hmac}`;
  }

  const identity = emailBlindIndex(EMAIL);
  if (!identity.ok) throw new Error('test address does not normalise');
  await owner`
    delete from admin_user where email_hmac = ${identity.hmac}
  `;
}

async function main(): Promise<void> {
  const owner = connect(process.env.DATABASE_URL ?? '', { max: 1, application_name: 'sxccaa-adminverify' });
  const admin = connect(process.env.ADMIN_DATABASE_URL ?? '', { max: 3, application_name: 'sxccaa-adminverify-admin' });
  const web = connect(process.env.WEB_DATABASE_URL ?? '', { max: 1, application_name: 'sxccaa-adminverify-web' });

  try {
    await clean(owner);

    const identity = emailBlindIndex(EMAIL);
    if (!identity.ok) throw new Error('test address does not normalise');
    const secret = newTotpSecret();

    // --- key agreement -------------------------------------------------------
    // First, because if this fails nothing else means anything. Plan §9.1: the
    // two apps must hold byte-identical keys or the portal cannot read a single
    // thing the public site wrote.
    process.stdout.write('\n  The two applications agree on the encryption keys\n');

    const probeContext = fieldContext('alumni', 'keyprobe1234', 'contact');
    const written = encryptField('+44 7700 900999', probeContext);
    let readBack = '';
    try {
      readBack = decryptField(written, probeContext);
    } catch {
      readBack = '';
    }
    report(readBack === '+44 7700 900999', 'a value encrypted here decrypts here');

    /*
     * The check that actually matters.
     *
     * The round-trip above proves this process is internally consistent, which
     * it would be with any key at all. What breaks a two-app deployment is the
     * portal holding a *different* key from the one the ingest tool used — and
     * the only way to catch that is to read something the other side wrote.
     *
     * Skipped rather than failed on an empty directory: a fresh install has
     * nothing to read, and a check that fails before the data is loaded is a
     * check people learn to ignore.
     */
    const sample = await admin<Array<{ id: string; contact_enc: Buffer | null; gmail_enc: Buffer | null }>>`
      select id, contact_enc, gmail_enc from alumni
       where contact_enc is not null or gmail_enc is not null
       limit 1
    `;
    const row0 = sample[0];
    if (!row0) {
      process.stdout.write('  · no alumni rows yet — cross-app key check skipped\n');
    } else {
      let decrypted = false;
      try {
        const blob = row0.contact_enc ?? row0.gmail_enc!;
        const field = row0.contact_enc ? 'contact' : 'gmail';
        decrypted = decryptField(blob, fieldContext('alumni', row0.id, field)).length > 0;
      } catch {
        decrypted = false;
      }
      report(
        decrypted,
        'the portal can read a row the ingest tool wrote',
        decrypted ? '' : 'DATA_ENCRYPTION_KEYS differs from the public app — the portal is holding the wrong key',
      );
    }

    const role = await admin`select current_user as who`;
    report(
      (role[0] as { who: string }).who === 'sxc_admin',
      'the portal connects as sxc_admin, not the owner',
      `connected as ${(role[0] as { who: string }).who}`,
    );

    // --- account creation ----------------------------------------------------
    process.stdout.write('\n  Creating an account\n');

    const adminId = await createAdminAccount(
      {
        normalisedEmail: identity.normalised,
        emailHmac: identity.hmac,
        password: PASSWORD,
        totpSecret: secret,
        role: 'super_admin',
      },
      admin,
    );
    report(Boolean(adminId), 'the account is written');

    const stored = await owner<Array<{ email_enc: Buffer; totp_secret_enc: Buffer; totp_confirmed_at: Date | null }>>`
      select email_enc, totp_secret_enc, totp_confirmed_at from admin_user where id = ${adminId}
    `;
    const row = stored[0]!;
    report(row.totp_confirmed_at !== null, 'two-factor is confirmed at creation, never deferred');
    report(
      decryptField(row.email_enc, fieldContext('admin_user', adminId, 'email')) === identity.normalised,
      'the address is stored encrypted and bound to this row',
    );
    report(
      !row.email_enc.toString('utf8').includes('admin.verify'),
      'the address is not readable in the stored bytes',
    );

    // The AAD is welded to the row id. A ciphertext lifted into another row
    // must fail rather than decrypt into somebody else's account.
    let swapRejected = false;
    try {
      decryptField(row.totp_secret_enc, fieldContext('admin_user', 'some-other-id', 'totpSecret'));
    } catch {
      swapRejected = true;
    }
    report(swapRejected, 'the TOTP secret cannot be moved to another admin row');

    const codes = await issueRecoveryCodes(adminId, admin);
    report(codes.length === 10, 'ten recovery codes are issued');

    // --- sign-in -------------------------------------------------------------
    process.stdout.write('\n  Signing in needs the password AND the authenticator\n');

    const good = await signIn({ email: EMAIL, password: PASSWORD, totpCode: code(secret) }, {}, admin);
    report(good.ok, 'correct password and code is accepted');

    const wrongPassword = await signIn({ email: EMAIL, password: 'not it at all', totpCode: code(secret) }, {}, admin);
    report(!wrongPassword.ok, 'a wrong password is refused even with a valid code');

    const wrongCode = await signIn({ email: EMAIL, password: PASSWORD, totpCode: '000000' }, {}, admin);
    report(!wrongCode.ok, 'a correct password with a wrong code is refused');
    report(
      !wrongCode.ok && !wrongPassword.ok && wrongCode.reason === wrongPassword.reason,
      'and the two failures are indistinguishable — no password oracle',
      `both report "${!wrongCode.ok ? wrongCode.reason : ''}"`,
    );

    const unknown = await signIn({ email: 'nobody.here@example.org', password: PASSWORD, totpCode: code(secret) }, {}, admin);
    report(
      !unknown.ok && unknown.reason === 'invalid_credentials',
      'an unknown address gets the identical outcome',
    );

    // Timing: the unknown-account path must do the same Argon2 work as a real
    // one, or the response time answers what the message refuses to.
    const timeOf = async (fn: () => Promise<unknown>) => {
      const started = process.hrtime.bigint();
      await fn();
      return Number(process.hrtime.bigint() - started) / 1e6;
    };
    await owner`update admin_user set failed_attempts = 0, locked_until = null where id = ${adminId}`;
    const knownMs = await timeOf(() => signIn({ email: EMAIL, password: 'wrong', totpCode: '000000' }, {}, admin));
    const unknownMs = await timeOf(() =>
      signIn({ email: 'nobody.here@example.org', password: 'wrong', totpCode: '000000' }, {}, admin),
    );
    const ratio = Math.max(knownMs, unknownMs) / Math.max(1, Math.min(knownMs, unknownMs));
    report(
      ratio < 3,
      'both take comparable time, so a stopwatch does not enumerate admins',
      `known ${knownMs.toFixed(0)}ms vs unknown ${unknownMs.toFixed(0)}ms`,
    );

    // --- TOTP replay ---------------------------------------------------------
    process.stdout.write('\n  A one-time code is genuinely one-time\n');

    await owner`update admin_user set failed_attempts = 0, locked_until = null, totp_last_step = null where id = ${adminId}`;
    const sameCode = code(secret);
    const first = await signIn({ email: EMAIL, password: PASSWORD, totpCode: sameCode }, {}, admin);
    const replay = await signIn({ email: EMAIL, password: PASSWORD, totpCode: sameCode }, {}, admin);
    report(first.ok, 'the code works once');
    report(!replay.ok, 'the same code is refused the second time');

    // --- lockout -------------------------------------------------------------
    process.stdout.write('\n  Repeated failures lock the account\n');

    report(lockoutFor(4) === 0, 'four failures do not lock');
    report(lockoutFor(5) === 15 * 60 * 1000, 'the fifth locks for fifteen minutes');
    report(lockoutFor(6) === 30 * 60 * 1000, 'and it doubles');
    report(lockoutFor(20) === 60 * 60 * 1000, 'up to a one-hour ceiling');

    await owner`update admin_user set failed_attempts = 0, locked_until = null, totp_last_step = null where id = ${adminId}`;
    for (let i = 0; i < 5; i++) {
      await signIn({ email: EMAIL, password: 'wrong every time', totpCode: '000000' }, {}, admin);
    }
    const locked = await signIn({ email: EMAIL, password: PASSWORD, totpCode: code(secret) }, {}, admin);
    report(
      !locked.ok && locked.reason === 'locked',
      'the correct password is refused while locked',
    );

    await owner`update admin_user set failed_attempts = 0, locked_until = null, totp_last_step = null where id = ${adminId}`;
    const afterUnlock = await signIn({ email: EMAIL, password: PASSWORD, totpCode: code(secret) }, {}, admin);
    report(afterUnlock.ok, 'and works again once the lock expires');

    // --- sessions ------------------------------------------------------------
    process.stdout.write('\n  Sessions\n');

    const { token } = await createAdminSession(adminId, { ipHash: ipBlindIndex('203.0.113.1') }, admin);
    const live = await readAdminSession(token, admin);
    report(live !== null, 'a fresh session resolves');
    report(live?.role === 'super_admin', 'and carries the role from the account, not the cookie');

    report((await readAdminSession('not-a-real-token', admin)) === null, 'an invented token resolves to nothing');
    report((await readAdminSession(undefined, admin)) === null, 'so does no token at all');

    const tokenHashRows = await owner`
      select count(*)::int as c from admin_session where token_hash = decode(${Buffer.from(token).toString('hex')}, 'hex')
    `;
    report(
      (tokenHashRows[0] as { c: number }).c === 0,
      'the raw token is not what is stored — only its hash',
    );

    // Step-up
    report(live !== null && isStepUpFresh(live), 'signing in counts as a step-up');
    report(
      live !== null &&
        !isStepUpFresh(live, new Date(Date.now() + STEP_UP_WINDOW_MS + 1000)),
      'and it goes stale after the window',
    );

    // The code the sign-in above consumed is still the one on screen. Stepping
    // up with it must be refused — and must say why, because "invalid" would
    // send the admin off to check their phone's clock.
    const staleStepUp = await stepUp(adminId, { password: PASSWORD, totpCode: code(secret) }, {}, admin);
    report(
      !staleStepUp.ok && staleStepUp.reason === 'code_already_used',
      'stepping up with the code just used is refused as already used',
    );

    // The next window's code is inside the ±1 step tolerance and is a step the
    // account has not spent.
    const nextCode = totpAt(secret, { now: Date.now() + 30_000 });
    const steppedUp = await stepUp(adminId, { password: PASSWORD, totpCode: nextCode }, {}, admin);
    report(steppedUp.ok, 'a fresh code restores it');

    const badStepUp = await stepUp(adminId, { password: 'wrong', totpCode: totpAt(secret, { now: Date.now() + 60_000 }) }, {}, admin);
    report(!badStepUp.ok, 'a wrong password does not');
    report(
      !badStepUp.ok && badStepUp.reason === 'invalid',
      'and a wrong password never reveals that the code was fine',
    );
    await markSteppedUp(live!.sessionId, admin);

    // Revocation
    await revokeAdminSession(token, admin);
    report((await readAdminSession(token, admin)) === null, 'a revoked session stops resolving');

    const { token: a } = await createAdminSession(adminId, {}, admin);
    const { token: b } = await createAdminSession(adminId, {}, admin);
    await revokeAllAdminSessions(adminId, admin);
    report(
      (await readAdminSession(a, admin)) === null && (await readAdminSession(b, admin)) === null,
      '"sign out everywhere" ends every session at once',
    );

    // Disabling
    const { token: doomed } = await createAdminSession(adminId, {}, admin);
    report((await readAdminSession(doomed, admin)) !== null, 'a session for an active admin works');
    await owner`update admin_user set status = 'disabled' where id = ${adminId}`;
    report(
      (await readAdminSession(doomed, admin)) === null,
      'disabling the account kills its live sessions on the next request',
    );
    await owner`update admin_user set status = 'active' where id = ${adminId}`;

    // --- password change -----------------------------------------------------
    process.stdout.write('\n  Changing a password ends every other session\n');

    const { token: beforeChange } = await createAdminSession(adminId, {}, admin);
    await changeOwnPassword(adminId, OTHER_PASSWORD, admin);
    report((await readAdminSession(beforeChange, admin)) === null, 'sessions from before the change are gone');

    await owner`update admin_user set failed_attempts = 0, locked_until = null, totp_last_step = null where id = ${adminId}`;
    const withNew = await signIn({ email: EMAIL, password: OTHER_PASSWORD, totpCode: code(secret) }, {}, admin);
    report(withNew.ok, 'the new password works');
    await owner`update admin_user set failed_attempts = 0, locked_until = null, totp_last_step = null where id = ${adminId}`;
    const withOld = await signIn({ email: EMAIL, password: PASSWORD, totpCode: code(secret) }, {}, admin);
    report(!withOld.ok, 'the old one does not');

    // --- recovery codes ------------------------------------------------------
    process.stdout.write('\n  Recovery codes\n');

    await owner`update admin_user set failed_attempts = 0, locked_until = null, totp_last_step = null where id = ${adminId}`;
    const viaRecovery = await signIn(
      { email: EMAIL, password: OTHER_PASSWORD, recoveryCode: codes[0] },
      {},
      admin,
    );
    report(viaRecovery.ok, 'a recovery code stands in for the authenticator');
    report(
      viaRecovery.ok && viaRecovery.mustChangePassword,
      'and forces a password change, because a lost phone often means a lost laptop',
    );

    await owner`update admin_user set failed_attempts = 0, locked_until = null where id = ${adminId}`;
    const reuse = await signIn({ email: EMAIL, password: OTHER_PASSWORD, recoveryCode: codes[0] }, {}, admin);
    report(!reuse.ok, 'the same code cannot be used twice');
    report((await countUnused(adminId, admin)) === 9, 'nine remain');

    await owner`update admin_user set failed_attempts = 0, locked_until = null where id = ${adminId}`;
    const invented = await signIn({ email: EMAIL, password: OTHER_PASSWORD, recoveryCode: 'aaaaa-bbbbb' }, {}, admin);
    report(!invented.ok, 'an invented code is refused');

    const stored2 = await owner<Array<{ code_hash: string }>>`
      select code_hash from admin_recovery_code where admin_id = ${adminId} limit 1
    `;
    report(
      stored2[0]!.code_hash.startsWith('$argon2id$'),
      'codes are stored as Argon2id hashes, not plaintext',
    );

    await issueRecoveryCodes(adminId, admin);
    await owner`update admin_user set failed_attempts = 0, locked_until = null where id = ${adminId}`;
    const oldBatch = await signIn({ email: EMAIL, password: OTHER_PASSWORD, recoveryCode: codes[1] }, {}, admin);
    report(!oldBatch.ok, 'reissuing retires the whole previous sheet');

    // --- role isolation ------------------------------------------------------
    /*
     * --- deleting an alumnus -------------------------------------------------
     *
     * The risk this covers is the ghost: four of these tables key on the hash of
     * the address rather than on the alumnus id, so no foreign key reaches them
     * and `on delete cascade` cannot help. Delete only the `alumni` row and the
     * person keeps a live access grant, valid sessions and a working magic link
     * for a directory that no longer knows who they are.
     *
     * So the test is not "does the row go" — it is "does everything go".
     */
    process.stdout.write('\n  Deleting an alumnus leaves nothing behind\n');

    const victim = await createAlumnus(
      {
        fullName: 'Verify Deletion Probe',
        batchYear: 1998,
        stream: null,
        currentOrg: null,
        designation: null,
        previousRole: null,
        contact: '+44 7700 900123',
        email: PROBE_EMAIL,
        otherInfo: null,
        consentNote: 'admin-verify probe',
        consentAt: new Date(),
      },
      adminId,
      admin,
    );

    if (!victim.ok) {
      report(false, 'a probe record could be created', victim.message);
    } else {
      await grantAlumnusAccess(victim.id, adminId, admin);

      const [{ gmail_hmac: victimHmac }] = await admin<Array<{ gmail_hmac: Buffer }>>`
        select gmail_hmac from alumni where id = ${victim.id}
      `;

      // Everything that keys on the hash, plus the one thing that cascades.
      await owner`
        insert into session (token_hash, email_hmac, expires_at)
        values (decode(repeat('a1', 32), 'hex'), ${victimHmac}, now() + interval '1 day')
      `;
      await owner`
        insert into login_token (token_hash, email_hmac, expires_at)
        values (decode(repeat('b2', 32), 'hex'), ${victimHmac}, now() + interval '1 hour')
      `;
      await owner`
        insert into access_request (email_enc, email_hmac, name)
        values (decode('00', 'hex'), ${victimHmac}, 'Verify Deletion Probe')
      `;
      // `path` is 22 characters of the same no-ambiguous-letters alphabet the
      // alumni ids use, enforced by a check constraint. The alumni row is
      // pointed at it as well, because `photo_state_matches_storage` requires
      // photo_status = 'live' exactly when photo_path is set — an orphaned photo
      // row would test the cascade but not the state the product actually holds.
      const probePath = 'z'.repeat(22);
      await owner`
        insert into alumni_photo (path, alumni_id, webp, jpeg, width, height, source_type, source_bytes)
        values (${probePath}, ${victim.id}, decode('00','hex'), decode('00','hex'), 1, 1, 'image/webp', 1)
      `;
      await owner`
        update alumni set photo_path = ${probePath}, photo_status = 'live' where id = ${victim.id}
      `;

      const wrongName = await deleteAlumnus(victim.id, 'Somebody Else', adminId, admin);
      report(!wrongName.ok, 'a mistyped name deletes nothing');

      const stillThere = await admin`select 1 from alumni where id = ${victim.id}`;
      report(stillThere.length === 1, 'the record survives a mistyped name');

      const done = await deleteAlumnus(victim.id, 'verify deletion PROBE', adminId, admin);
      report(done.ok, 'the name check accepts different casing and spacing');

      const leftovers = async (label: string, fn: () => Promise<readonly unknown[]>) => {
        const rows = await fn();
        report(rows.length === 0, label, rows.length ? `${rows.length} row(s) survived the deletion` : '');
      };

      await leftovers('the record itself is gone', () => admin`select 1 from alumni where id = ${victim.id}`);
      await leftovers('the photograph is gone', () => admin`select 1 from alumni_photo where alumni_id = ${victim.id}`);
      await leftovers('their access grant is gone', () => admin`select 1 from access_grant where email_hmac = ${victimHmac}`);
      await leftovers('their sessions are gone', () => admin`select 1 from session where email_hmac = ${victimHmac}`);
      await leftovers('their unused sign-in link is gone', () => admin`select 1 from login_token where email_hmac = ${victimHmac}`);
      await leftovers('their access request is gone', () => admin`select 1 from access_request where email_hmac = ${victimHmac}`);

      const trail = await admin<Array<{ meta: Record<string, unknown> }>>`
        select meta from audit_log
         where action = 'alumni_deleted' and target_id = ${victim.id}
         order by at desc limit 1
      `;
      report(trail.length === 1, 'the deletion is audited');
      report(
        trail.length === 1 && !JSON.stringify(trail[0].meta).includes('Verify Deletion Probe'),
        'the audit entry does not retain the name',
        'an erasure that leaves the name in the audit log is not an erasure',
      );

      const gone = await deleteAlumnus(victim.id, 'Verify Deletion Probe', adminId, admin);
      report(!gone.ok, 'deleting an already-deleted record fails cleanly');
    }

    process.stdout.write('\n  The public site cannot touch any of this\n');

    const denied = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        report(false, label, 'the statement succeeded — it should have been refused');
      } catch {
        report(true, label);
      }
    };

    await denied('sxc_web cannot read an admin account', () => web`select id from admin_user limit 1`);
    await denied('sxc_web cannot read an admin session', () => web`select id from admin_session limit 1`);
    await denied('sxc_web cannot mint an admin session', () =>
      web`insert into admin_session (token_hash, admin_id, expires_at) values (decode(repeat('00',32),'hex'), ${adminId}, now() + interval '1 hour')`,
    );
    await denied('sxc_web cannot read a recovery code', () =>
      web`select code_hash from admin_recovery_code limit 1`,
    );
    await denied('sxc_admin cannot rewrite the audit log', () =>
      admin`update audit_log set action = 'tampered' where id = (select id from audit_log order by id desc limit 1)`,
    );
    await denied('sxc_admin cannot delete an audit row', () =>
      admin`delete from audit_log where id = (select id from audit_log order by id desc limit 1)`,
    );
  } finally {
    await clean(owner);
    await Promise.all([owner.end({ timeout: 5 }), admin.end({ timeout: 5 }), web.end({ timeout: 5 })]);
  }

  process.stdout.write(`\n  ${passed} passed, ${failed} failed.\n`);
  process.stdout.write(
    failed === 0
      ? '\n  Every refusal above is the design working.\n\n'
      : '\n  A failure here is a way into the portal. Do not deploy.\n\n',
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

await main();
