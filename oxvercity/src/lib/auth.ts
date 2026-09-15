/**
 * Sign-in by emailed six-digit code.
 *
 * No passwords for alumni. Five hundred people who sign in twice a year will
 * forget a password, reuse one from elsewhere, and generate support requests.
 * Mailing a code removes the whole surface: there is nothing stored to breach,
 * stuff, phish for or reset.
 *
 * A code rather than a link because the mailbox is the only thing being proved
 * either way, and a code survives the journey better: it can be read off a
 * phone and typed into a laptop, it cannot be mangled by a mail client that
 * rewrites URLs, and it cannot be spent by a scanner that follows every link in
 * a message before the recipient sees it.
 *
 * ## The neutral response, which is the subtle part
 *
 * `requestSignInCode` returns the same thing whether the address is on the
 * allowlist or not, and takes the same time either way. Without that, anyone
 * can type an address into the login form and learn whether that person is a
 * Xaverian — a disclosure in its own right, and one the Association never
 * agreed to make.
 *
 * That is why this module returns no error the caller could accidentally
 * surface. Every failure below the rate limit — unknown address, revoked
 * grant, mail provider down — produces the identical outcome.
 *
 * ## Why the email is sent after the response
 *
 * Measured on 11 September 2026: awaiting the Resend call made the registered
 * path take 1.39–1.67s against 1.23–1.27s for an unregistered one. The bands
 * did not overlap, so a handful of samples told an attacker whether any given
 * address was on the allowlist — the exact disclosure the neutral wording
 * prevents, defeated by a stopwatch.
 *
 * Raising the response floor above the provider's latency was the obvious fix
 * and the wrong one: it makes every sign-in as slow as the worst case and
 * reopens the gap the first time Resend has a bad day. Handing the send to a
 * scheduler instead takes the variable cost off the critical path entirely, so
 * both paths differ by one INSERT against a floor an order of magnitude larger.
 *
 * ## What makes a six-digit secret safe
 *
 * Not its length. A million possibilities is nothing to a machine. Three things
 * together:
 *
 *   - the code is useless without the address it was minted for, so there is no
 *     "any valid code" to stumble onto;
 *   - five wrong answers spend the row, enforced by `otp_attempts` in the
 *     database rather than by a count held in this process;
 *   - requesting codes is rate limited per address and per connection, so an
 *     attacker cannot keep minting fresh rows to get fresh attempts.
 *
 * Take any one away and the other two stop being enough.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

import { emailBlindIndex } from './core/hmac.ts';
import { newOtp } from './core/ids.ts';
import { audit } from './audit.ts';
import { db, type Sql } from './db.ts';
import { mailConfig, send, signInOtpEmail } from './email.ts';
import { LIMITS, consume, consumeAll } from './rate-limit.ts';
import { createSession } from './session.ts';

export const CODE_LIFETIME_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;

/** The stored form. The code itself is never written down. */
const hashCode = (code: string) => createHash('sha256').update(code, 'utf8').digest();

/**
 * How deferred work gets run.
 *
 * The route passes Next's `after()`, which runs the task once the response has
 * been flushed. The default awaits inline so that tests and
 * `npm run auth:verify` stay deterministic — a fire-and-forget default would
 * leave the send racing the assertions.
 *
 * Injected rather than imported so this module stays free of Next and keeps
 * loading under plain Node.
 */
export type Scheduler = (task: () => Promise<void>) => void | Promise<void>;

const runInline: Scheduler = (task) => task();

/**
 * What the caller may learn. `rate_limited` is the one distinction we allow
 * ourselves, because a throttled user needs to be told to wait — and being
 * throttled says nothing about whether the address is registered, since the
 * limit is applied before the lookup.
 */
export type SignInRequestOutcome = 'accepted' | 'rate_limited' | 'invalid_email';

export async function requestSignInCode(
  rawEmail: unknown,
  context: { ipSubject: Buffer; ip: string | null },
  sql: Sql = db(),
  schedule: Scheduler = runInline,
): Promise<SignInRequestOutcome> {
  // Shape first: a string that is not an address cannot be on the allowlist, and
  // saying so leaks nothing about anybody.
  const identity = emailBlindIndex(rawEmail);
  if (!identity.ok) return 'invalid_email';

  // Limits are consumed before the lookup, deliberately. Doing it the other way
  // would mean a registered address burns a token and an unregistered one does
  // not — a difference an attacker can measure.
  const perIp = await consume(context.ipSubject, LIMITS.loginIpHour, sql);
  if (!perIp.allowed) return 'rate_limited';

  const perEmail = await consumeAll(
    [
      { subject: identity.hmac, limit: LIMITS.loginEmailHour },
      { subject: identity.hmac, limit: LIMITS.loginEmailDay },
    ],
    sql,
  );
  if (!perEmail.allowed) return 'rate_limited';

  const grants = await sql<Array<{ id: string }>>`
    select id from access_grant where email_hmac = ${identity.hmac} and revoked_at is null limit 1
  `;

  if (grants.length === 0) {
    // The closed case from plan §6.2: an unregistered address has no row here,
    // so no code is ever minted and no mail is ever sent. Logged with the IP
    // hash only — recording the address would build the very list the blind
    // index exists to avoid.
    await audit(
      { actorType: 'anonymous', action: 'login_code_refused', ipHash: context.ipSubject, meta: { reason: 'no_grant' } },
      sql,
    );
    return 'accepted';
  }

  const code = newOtp();
  const expiresAt = new Date(Date.now() + CODE_LIFETIME_MINUTES * 60 * 1000);

  // Asking again supersedes: the previous code stops working the moment a new
  // one is sent. Leaving both live would mean the email that says "this is your
  // code" is only sometimes true, and would hand an attacker several live
  // guesses for the price of one request.
  await sql`
    update login_token set consumed_at = now()
     where email_hmac = ${identity.hmac} and consumed_at is null
  `;

  await sql`
    insert into login_token (otp_hash, email_hmac, expires_at, request_ip_hash)
    values (${hashCode(code)}, ${identity.hmac}, ${expiresAt}, ${context.ipSubject})
  `;

  // Deferred: see the note at the top of this file. The row is already
  // committed, so the code in the email works whenever the send lands.
  await schedule(async () => {
    try {
      const config = mailConfig();
      await send({ to: identity.normalised, ...signInOtpEmail(code, CODE_LIFETIME_MINUTES) }, config);
      await audit({ actorType: 'anonymous', action: 'login_code_sent', ipHash: context.ipSubject }, sql);
    } catch (error) {
      // Swallowed on purpose. Surfacing "we could not send your email" would
      // confirm the address is registered — the exact thing the neutral response
      // is for. The operator sees it in the server log.
      console.error('[auth] could not send sign-in code:', (error as Error).message);
      await audit(
        { actorType: 'system', action: 'login_code_send_failed', ipHash: context.ipSubject, meta: { reason: 'provider_error' } },
        sql,
      );
    }
  });

  return 'accepted';
}

export type VerifyOutcome =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: 'invalid' | 'rate_limited' };

/**
 * Exchange an address and a code for a session.
 *
 * ## Why there is only one failure to report
 *
 * A wrong code, an expired code, a row that has run out of attempts, an address
 * nobody has ever heard of and a grant that was revoked this morning all return
 * `invalid`. That is not laziness; separating them would rebuild the
 * enumeration oracle the neutral request response exists to close.
 *
 * Consider "too many attempts". A row only exists for an address on the
 * allowlist, so an attacker who submits six wrong codes for `someone@gmail.com`
 * and is told the attempts are exhausted has learned that someone is a
 * Xaverian — without ever seeing a code, and having been given the answer by
 * the failure message itself. Same for "expired". So they are collapsed.
 *
 * The access-request flow next door *does* distinguish these, and is right to:
 * a row there exists for anyone who filled in the form, member or not, so
 * telling them apart reveals nothing. The difference is the allowlist, not the
 * degree of care.
 *
 * The cost is real and small: someone who genuinely exhausts five attempts is
 * told the code is wrong rather than that they are out of tries. They ask for a
 * new code, which is what they would have had to do either way.
 *
 * ## Single use is enforced in SQL
 *
 * The update that stamps `consumed_at` requires it to still be null, so two
 * simultaneous submissions cannot both open a session.
 */
export async function verifySignInCode(
  rawEmail: unknown,
  rawCode: unknown,
  context: { ipSubject: Buffer; userAgent: string | null },
  sql: Sql = db(),
): Promise<VerifyOutcome> {
  // Before the lookup, and keyed by connection rather than by address, so being
  // throttled is not itself a statement about who is registered.
  const limit = await consume(context.ipSubject, LIMITS.loginVerifyIpHour, sql);
  if (!limit.allowed) return { ok: false, reason: 'rate_limited' };

  const wrong: VerifyOutcome = { ok: false, reason: 'invalid' };

  const identity = emailBlindIndex(rawEmail);
  // Spaces because people paste "123 456" out of a mail client that decided the
  // code was two words.
  const code = typeof rawCode === 'string' ? rawCode.replace(/\s/g, '') : '';
  if (!identity.ok || !/^\d{6}$/.test(code)) return wrong;

  const rows = await sql<Array<{ id: string; otp_hash: Buffer; otp_attempts: number }>>`
    select id, otp_hash, otp_attempts
      from login_token
     where email_hmac = ${identity.hmac}
       and consumed_at is null
       and expires_at > now()
       and otp_attempts < ${MAX_CODE_ATTEMPTS}
     order by created_at desc
     limit 1
  `;
  const row = rows[0];
  if (!row) {
    await audit(
      { actorType: 'anonymous', action: 'login_code_rejected', ipHash: context.ipSubject, meta: { reason: 'no_live_code' } },
      sql,
    );
    return wrong;
  }

  const expected = Buffer.from(row.otp_hash);
  const actual = hashCode(code);
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    // `least(..., 5)` because the column is constrained to 0–5; a sixth
    // increment would raise rather than record the attempt.
    await sql`
      update login_token set otp_attempts = least(otp_attempts + 1, ${MAX_CODE_ATTEMPTS}) where id = ${row.id}
    `;
    await audit(
      { actorType: 'anonymous', action: 'login_code_rejected', ipHash: context.ipSubject, meta: { reason: 'wrong_code' } },
      sql,
    );
    return wrong;
  }

  // Spend it. The `consumed_at is null` guard is what makes two simultaneous
  // submissions produce one session rather than two.
  const spent = await sql<Array<{ id: string }>>`
    update login_token set consumed_at = now()
     where id = ${row.id} and consumed_at is null
    returning id
  `;
  if (spent.length === 0) return wrong;

  // The grant is re-checked here, not just at send. A code minted ten minutes
  // ago must not still work if an admin revoked access in between.
  const grants = await sql<Array<{ id: string }>>`
    select id from access_grant where email_hmac = ${identity.hmac} and revoked_at is null limit 1
  `;
  if (grants.length === 0) {
    await audit(
      { actorType: 'anonymous', action: 'login_code_rejected', ipHash: context.ipSubject, meta: { reason: 'grant_revoked' } },
      sql,
    );
    return wrong;
  }

  const session = await createSession(identity.hmac, context.userAgent, sql);
  await audit({ actorType: 'alumnus', action: 'session_created', ipHash: context.ipSubject }, sql);
  return { ok: true, ...session };
}

/** Housekeeping: consumed and expired codes are of no further use to anyone. */
export async function sweepLoginTokens(sql: Sql = db()): Promise<number> {
  const rows = await sql`delete from login_token where expires_at < now() - interval '1 day' returning id`;
  return rows.length;
}
