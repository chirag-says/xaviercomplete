/**
 * Exercise the whole sign-in flow against the live database and real Resend.
 *
 *   npm run auth:verify
 *
 * The unit tests cover the arithmetic and the pure functions. This covers the
 * things only a real database can answer: does single-use actually hold under a
 * second submission, does the five-attempt cap really bind, does a revoked
 * grant kill a code already sitting in someone's inbox, does the rate limiter
 * bind at the number it claims.
 *
 * ## Reading the code out of the database
 *
 * Only the SHA-256 of a code is stored, and the plaintext is mailed and then
 * dropped — so this file cannot read a code any more than an attacker with a
 * copy of the database could. It writes its own rows with a known code instead,
 * which is the same thing from the application's point of view and keeps the
 * "nothing recoverable is stored" property honest.
 *
 * Mail goes to `delivered@resend.dev`, Resend's sink address, so the provider
 * call is real without anyone receiving anything.
 *
 * Everything it creates, it removes — except audit rows, which are append-only
 * by design and are a fair record of what happened.
 */

import { createHash } from 'node:crypto';

import { connect, type Sql } from '../../src/lib/db.ts';
import { blindIndexOfNormalised, emailBlindIndex, tokenHash } from '../../src/lib/core/hmac.ts';
import { ipBlindIndex } from '../../src/lib/core/hmac.ts';
import { requestSignInCode, verifySignInCode, MAX_CODE_ATTEMPTS } from '../../src/lib/auth.ts';
import { createSession, readSession, revokeAllSessions, revokeSession } from '../../src/lib/session.ts';
import { LIMITS, consume } from '../../src/lib/rate-limit.ts';

const REGISTERED = 'delivered@resend.dev';
const STRANGER = 'nobody.at.all@example.org';

const hashCode = (code: string) => createHash('sha256').update(code, 'utf8').digest();

let passed = 0;
let failed = 0;

function report(ok: boolean, name: string, detail = ''): void {
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n      ${detail}` : ''}\n`);
  if (ok) passed++;
  else failed++;
}

/** A fresh, unique rate-limit subject per check, so one does not starve the next. */
const subjectFor = (label: string) => ipBlindIndex(`auth-verify:${label}:${Date.now()}:${Math.random()}`);

const context = (label: string) => ({ ipSubject: subjectFor(label), userAgent: 'verify' });

/** Plant a code we know the plaintext of, since the application never keeps one. */
async function plantCode(
  owner: Sql,
  emailHmac: Buffer,
  code: string,
  options: { expired?: boolean; attempts?: number } = {},
): Promise<void> {
  await owner`delete from login_token where email_hmac = ${emailHmac}`;
  await owner`
    insert into login_token (otp_hash, email_hmac, expires_at, otp_attempts)
    values (
      ${hashCode(code)},
      ${emailHmac},
      now() + ${options.expired ? '-1 minute' : '10 minutes'}::interval,
      ${options.attempts ?? 0}
    )
  `;
}

async function clean(owner: Sql): Promise<void> {
  const registered = blindIndexOfNormalised(REGISTERED);
  const stranger = blindIndexOfNormalised(STRANGER);
  await owner`delete from login_token where email_hmac in (${registered}, ${stranger})`;
  await owner`delete from session where email_hmac in (${registered}, ${stranger})`;
  await owner`delete from access_grant where email_hmac in (${registered}, ${stranger})`;
  await owner`delete from rate_limit where bucket like 'login:%'`;
}

async function main(): Promise<void> {
  const owner = connect(process.env.DATABASE_URL ?? '', { max: 1, application_name: 'sxccaa-authverify' });
  const web = connect(process.env.WEB_DATABASE_URL ?? '', { max: 2, application_name: 'sxccaa-authverify-web' });

  try {
    await clean(owner);
    const registeredHmac = blindIndexOfNormalised(REGISTERED);
    const strangerHmac = blindIndexOfNormalised(STRANGER);
    await owner`insert into access_grant (email_hmac, source) values (${registeredHmac}, 'import')`;

    // --- the neutral response ------------------------------------------------
    process.stdout.write('\n  Asking for a code tells you nothing about who is registered\n');

    const known = await requestSignInCode(REGISTERED, { ipSubject: subjectFor('known'), ip: null }, web);
    const unknown = await requestSignInCode(STRANGER, { ipSubject: subjectFor('unknown'), ip: null }, web);
    const malformed = await requestSignInCode('not-an-address', { ipSubject: subjectFor('bad'), ip: null }, web);

    report(known === 'accepted', 'a registered address is accepted');
    report(unknown === 'accepted', 'an unregistered address gets the identical outcome');
    report(malformed === 'invalid_email', 'a malformed address is distinguishable only as malformed');

    const strangerRows = await owner`select id from login_token where email_hmac = ${strangerHmac}`;
    report(strangerRows.length === 0, 'no code is ever minted for an unregistered address');

    const knownRows = await owner`select id from login_token where email_hmac = ${registeredHmac}`;
    report(knownRows.length === 1, 'exactly one code for the registered address', `found ${knownRows.length}`);

    // --- what the database holds ---------------------------------------------
    process.stdout.write('\n  What is stored is not what was sent\n');
    const stored = await owner<Array<{ otp_hash: Buffer }>>`
      select otp_hash from login_token where email_hmac = ${registeredHmac}
    `;
    report(stored[0]!.otp_hash.length === 32, 'only a 32-byte hash of the code is stored');

    /*
     * This check passes by *finding* the code, and that is the point.
     *
     * A million candidates is a couple of seconds of one CPU, so hashing the
     * code protects it from a casual glance at the table and from nothing else:
     * anyone holding a database dump can recover every live code in it. That is
     * survivable only because a code is live for ten minutes, is useless without
     * the address beside it, and is one of a handful of rows rather than a
     * standing credential. If this ever becomes a long-lived secret, the hash is
     * not what makes it safe and something else has to.
     */
    const digest = stored[0]!.otp_hash;
    let found = false;
    for (let n = 0; n < 1_000_000 && !found; n++) {
      if (digest.equals(hashCode(String(n).padStart(6, '0')))) found = true;
    }
    report(found, 'a stolen dump yields the live code in seconds — which is why a code lasts ten minutes');

    const emailColumns = await owner`
      select count(*)::int as n from information_schema.columns
      where table_name = 'login_token' and column_name like '%email%' and column_name <> 'email_hmac'
    `;
    report((emailColumns[0] as { n: number }).n === 0, 'login_token has no column that could hold an address');

    // --- a code works once ----------------------------------------------------
    process.stdout.write('\n  A code works once, for one address\n');
    await plantCode(owner, registeredHmac, '123456');

    const first = await verifySignInCode(REGISTERED, '123456', context('v1'), web);
    report(first.ok, 'the right code opens a session', first.ok ? '' : first.reason);

    const second = await verifySignInCode(REGISTERED, '123456', context('v2'), web);
    report(!second.ok, 'the same code a second time is refused');

    await plantCode(owner, registeredHmac, '123456');
    const wrongAddress = await verifySignInCode(STRANGER, '123456', context('v3'), web);
    report(!wrongAddress.ok, 'a valid code against a different address is refused');

    const spaced = await verifySignInCode(REGISTERED, ' 123 456 ', context('v4'), web);
    report(spaced.ok, 'spaces a mail client introduced are tolerated', spaced.ok ? '' : spaced.reason);

    // --- one failure, whatever went wrong -------------------------------------
    process.stdout.write('\n  Every failure looks the same from outside\n');
    await plantCode(owner, registeredHmac, '123456');
    const badCode = await verifySignInCode(REGISTERED, '999999', context('n1'), web);

    await plantCode(owner, registeredHmac, '123456', { expired: true });
    const expired = await verifySignInCode(REGISTERED, '123456', context('n2'), web);

    await plantCode(owner, registeredHmac, '123456', { attempts: MAX_CODE_ATTEMPTS });
    const exhausted = await verifySignInCode(REGISTERED, '123456', context('n3'), web);

    const noSuchPerson = await verifySignInCode(STRANGER, '123456', context('n4'), web);

    const reasons = [badCode, expired, exhausted, noSuchPerson].map((o) => (o.ok ? 'ok' : o.reason));
    report(
      reasons.every((reason) => reason === 'invalid'),
      'wrong, expired, exhausted and unregistered are one indistinguishable outcome',
      `got ${reasons.join(', ')}`,
    );

    // --- the attempt cap ------------------------------------------------------
    process.stdout.write('\n  Guessing runs out\n');
    await plantCode(owner, registeredHmac, '123456');
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      await verifySignInCode(REGISTERED, '000000', context(`guess${i}`), web);
    }
    const afterCap = await verifySignInCode(REGISTERED, '123456', context('capped'), web);
    report(!afterCap.ok, 'the right code no longer works once five wrong ones have been tried');

    const capRow = await owner<Array<{ otp_attempts: number }>>`
      select otp_attempts from login_token where email_hmac = ${registeredHmac} limit 1
    `;
    report(
      capRow[0]!.otp_attempts === MAX_CODE_ATTEMPTS,
      'the counter stops at five rather than overflowing its constraint',
      `got ${capRow[0]!.otp_attempts}`,
    );

    // --- superseding ----------------------------------------------------------
    process.stdout.write('\n  A new code retires the last one\n');
    await plantCode(owner, registeredHmac, '111111');
    await owner`delete from rate_limit where subject = ${registeredHmac}`;
    await requestSignInCode(REGISTERED, { ipSubject: subjectFor('resend'), ip: null }, web);
    const supersededOutcome = await verifySignInCode(REGISTERED, '111111', context('old'), web);
    report(!supersededOutcome.ok, 'the previous code stops working the moment a new one is sent');

    const live = await owner<Array<{ n: number }>>`
      select count(*)::int as n from login_token
       where email_hmac = ${registeredHmac} and consumed_at is null
    `;
    report(live[0]!.n === 1, 'exactly one code is live at a time', `found ${live[0]!.n}`);

    // --- revocation beats a code already in an inbox --------------------------
    process.stdout.write('\n  Revoking access kills a code that is already sent\n');
    await plantCode(owner, registeredHmac, '654321');
    await owner`update access_grant set revoked_at = now() where email_hmac = ${registeredHmac}`;
    const afterRevoke = await verifySignInCode(REGISTERED, '654321', context('revoked'), web);
    report(!afterRevoke.ok, 'a code minted before revocation no longer works');
    await owner`update access_grant set revoked_at = null where email_hmac = ${registeredHmac}`;

    // --- sessions -------------------------------------------------------------
    process.stdout.write('\n  Sessions\n');
    const session = await createSession(registeredHmac, 'verify-agent', web);
    const resolved = await readSession(session.token, web);
    report(resolved !== null, 'a fresh session resolves');
    report(resolved?.emailHmac.equals(registeredHmac) === true, 'it resolves to the right identity');

    const tampered = await readSession(session.token.slice(0, -2) + 'xy', web);
    report(tampered === null, 'an edited cookie resolves to nobody');

    const sessionRows = await owner<Array<{ token_hash: Buffer }>>`
      select token_hash from session where email_hmac = ${registeredHmac} limit 1
    `;
    report(
      !sessionRows[0]!.token_hash.toString('latin1').includes(session.token.slice(0, 12)),
      'the session table holds a hash, not the cookie value',
    );

    await revokeSession(session.token, web);
    report((await readSession(session.token, web)) === null, 'a revoked session stops resolving');

    // Idle timeout: back-date last_seen_at past the 24-hour window.
    const idle = await createSession(registeredHmac, 'verify-agent', web);
    await owner`update session set last_seen_at = now() - interval '25 hours' where token_hash = ${tokenHash(idle.token)}`;
    report((await readSession(idle.token, web)) === null, 'a session idle for over a day stops resolving');

    // Absolute expiry, even if it was active a moment ago.
    const old = await createSession(registeredHmac, 'verify-agent', web);
    await owner`update session set expires_at = now() - interval '1 minute' where token_hash = ${tokenHash(old.token)}`;
    report((await readSession(old.token, web)) === null, 'a session past its 7-day life stops resolving');

    const alive = await createSession(registeredHmac, 'verify-agent', web);
    const revokedCount = await revokeAllSessions(registeredHmac, web);
    report(revokedCount >= 1 && (await readSession(alive.token, web)) === null, 'sign out everywhere revokes the lot');

    // --- rate limiting --------------------------------------------------------
    process.stdout.write('\n  Rate limiting binds where it says it does\n');
    const burstSubject = subjectFor('burst');
    const results: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      results.push((await consume(burstSubject, LIMITS.loginEmailHour, web)).allowed);
    }
    report(
      results.slice(0, 3).every(Boolean) && !results[3] && !results[4],
      'three per hour means the fourth is refused',
      `got ${results.map((r) => (r ? 'y' : 'n')).join('')}`,
    );

    const emailSubject = emailBlindIndex(REGISTERED);
    if (emailSubject.ok) {
      await owner`delete from rate_limit where subject = ${emailSubject.hmac}`;
      let accepted = 0;
      for (let i = 0; i < 4; i++) {
        const outcome = await requestSignInCode(REGISTERED, { ipSubject: subjectFor(`flood${i}`), ip: null }, web);
        if (outcome === 'accepted') accepted++;
      }
      report(accepted === 3, 'the login route itself stops at three an hour per address', `accepted ${accepted}`);
    }

    const verifySubject = subjectFor('verifyflood');
    let allowed = 0;
    for (let i = 0; i < 22; i++) {
      if ((await consume(verifySubject, LIMITS.loginVerifyIpHour, web)).allowed) allowed++;
    }
    report(allowed === 20, 'typing codes in stops at twenty an hour per connection', `allowed ${allowed}`);

    process.stdout.write(
      `\n  ${passed} passed, ${failed} failed.\n\n` +
        (failed === 0 ? '  Sign-in behaves as designed.\n\n' : '  Do not open this to alumni until it is green.\n\n'),
    );
  } finally {
    await clean(owner).catch(() => {});
    await Promise.all([owner.end({ timeout: 5 }), web.end({ timeout: 5 })]);
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`\n  ${(error as Error).stack}\n\n`);
  process.exit(1);
});
