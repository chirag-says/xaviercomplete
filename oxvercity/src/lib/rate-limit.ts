/**
 * Rate limiting, as a token bucket in Postgres.
 *
 * One less service to run, secure, pay for and patch, at a scale where the cost
 * is a single indexed upsert. Upstash Redis is the upgrade path if traffic ever
 * justifies it; nothing above this layer would need to change.
 *
 * The refill is continuous rather than a fixed window: a window resets on the
 * hour and lets an attacker burn a full allowance at 10:59 and another at
 * 11:00. A bucket that refills by the second has no such edge.
 *
 * ## Everything here is keyed by a hash
 *
 * `subject` is always an HMAC — of an email, an IP, a session id. An IP address
 * is personal data under the DPDP Act and this table would otherwise be a log
 * of who tried to sign in and when.
 */

import { db, type Sql } from './db.ts';

export interface Limit {
  /** Namespace, so the same subject can be limited differently per action. */
  bucket: string;
  /** Maximum burst. */
  capacity: number;
  /** How many tokens come back per second. */
  refillPerSecond: number;
}

/** Convenience: `perHour(3)` is three an hour, refilling smoothly. */
export function perHour(count: number): number {
  return count / 3600;
}
export function perDay(count: number): number {
  return count / 86_400;
}

/**
 * The limits from plan §6.3. Two buckets per action where the plan gives both
 * an hourly and a daily figure — a single bucket cannot express "3 per hour AND
 * 5 per day", because the hourly refill would let the sixth through.
 */
export const LIMITS = {
  loginEmailHour: { bucket: 'login:email:h', capacity: 3, refillPerSecond: perHour(3) },
  loginEmailDay: { bucket: 'login:email:d', capacity: 5, refillPerSecond: perDay(5) },
  loginIpHour: { bucket: 'login:ip:h', capacity: 10, refillPerSecond: perHour(10) },
  // Typing a code in. Deliberately looser than `loginEmailHour` — one person
  // fumbling a six-digit code on a phone should not lock themselves out after
  // three goes — and it is not the main control anyway: `otp_attempts` on the
  // row caps guesses at five per code, whoever is asking and from wherever.
  loginVerifyIpHour: { bucket: 'login:verify:ip:h', capacity: 20, refillPerSecond: perHour(20) },
  accessRequestIpDay: { bucket: 'request:ip:d', capacity: 3, refillPerSecond: perDay(3) },
  // Per address as well as per IP. The IP limit alone is defeated by anyone with
  // a handful of addresses to burn; this one stops the same mailbox being used
  // to send itself a hundred codes.
  accessRequestEmailDay: { bucket: 'request:email:d', capacity: 3, refillPerSecond: perDay(3) },
  // Guessing a six-digit code needs a lot of tries. `otp_attempts` on the row
  // caps it at five per request; this stops someone working through many
  // requests from one connection.
  otpVerifyIpHour: { bucket: 'otp:ip:h', capacity: 20, refillPerSecond: perHour(20) },
  // The general enquiry form. Looser than an access request because a question
  // is a cheaper thing to ask, tight enough that the endpoint cannot be used to
  // fill the Association's mailbox.
  enquiryIpDay: { bucket: 'enquiry:ip:d', capacity: 5, refillPerSecond: perDay(5) },
  profileSaveHour: { bucket: 'save:session:h', capacity: 20, refillPerSecond: perHour(20) },
  photoUploadDay: { bucket: 'photo:alumnus:d', capacity: 5, refillPerSecond: perDay(5) },
  profileViewHour: { bucket: 'views:session:h', capacity: 60, refillPerSecond: perHour(60) },
  profileViewDay: { bucket: 'views:session:d', capacity: 200, refillPerSecond: perDay(200) },
} as const satisfies Record<string, Limit>;

/**
 * How many tokens a bucket holds now, given when it was last touched.
 *
 * Pure, so the arithmetic is unit-tested without a database. The SQL below is a
 * direct transcription of it; if you change one, change both.
 */
export function refill(tokens: number, refilledAt: Date, now: Date, limit: Limit): number {
  const elapsedSeconds = Math.max(0, (now.getTime() - refilledAt.getTime()) / 1000);
  return Math.min(limit.capacity, tokens + elapsedSeconds * limit.refillPerSecond);
}

export interface Decision {
  allowed: boolean;
  /** Whole tokens left after this attempt. For a Retry-After hint, not for display. */
  remaining: number;
}

/**
 * Take one token, atomically.
 *
 * The whole decision is one statement, so two simultaneous requests cannot both
 * read "1 token left" and both proceed. The `where` on the conflict branch is
 * what does it: when the refilled balance is below 1 the update does not
 * happen, no row comes back, and the caller is denied.
 */
export async function consume(subject: Buffer, limit: Limit, sql: Sql = db()): Promise<Decision> {
  const rows = await sql<Array<{ tokens: number }>>`
    insert into rate_limit (bucket, subject, tokens, refilled_at)
    values (${limit.bucket}, ${subject}, ${limit.capacity - 1}, now())
    on conflict (bucket, subject) do update
      set tokens = least(
            ${limit.capacity}::real,
            rate_limit.tokens + extract(epoch from (now() - rate_limit.refilled_at)) * ${limit.refillPerSecond}::real
          ) - 1,
          refilled_at = now()
      where least(
              ${limit.capacity}::real,
              rate_limit.tokens + extract(epoch from (now() - rate_limit.refilled_at)) * ${limit.refillPerSecond}::real
            ) >= 1
    returning tokens
  `;

  if (rows.length === 0) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: Math.floor(rows[0]!.tokens) };
}

/**
 * Take a token from several buckets, all of which must allow it.
 *
 * Deliberately sequential and short-circuiting: if the hourly limit says no
 * there is no reason to spend a round trip on the daily one, and no reason to
 * consume from it either — being blocked should not also cost you your day's
 * allowance.
 */
export async function consumeAll(
  attempts: Array<{ subject: Buffer; limit: Limit }>,
  sql: Sql = db(),
): Promise<Decision> {
  let remaining = Number.POSITIVE_INFINITY;
  for (const attempt of attempts) {
    const decision = await consume(attempt.subject, attempt.limit, sql);
    if (!decision.allowed) return decision;
    remaining = Math.min(remaining, decision.remaining);
  }
  return { allowed: true, remaining: remaining === Number.POSITIVE_INFINITY ? 0 : remaining };
}

/** Housekeeping: drop buckets that have refilled to full and cannot deny anything. */
export async function sweepRateLimits(sql: Sql = db()): Promise<number> {
  const rows = await sql`delete from rate_limit where refilled_at < now() - interval '2 days' returning bucket`;
  return rows.length;
}
