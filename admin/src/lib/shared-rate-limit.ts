/**
 * Rate limiting, as a token bucket in Postgres (shared module).
 *
 * COPIED from oxvercity/src/lib/rate-limit.ts so the admin app stays
 * self-contained, following the same convention as shared-db.ts and
 * shared-email.ts. The mechanism below is byte-for-byte the original and must
 * stay that way; only the `LIMITS` block at the end is this app's own, because
 * the portal and the public site throttle different things.
 *
 * `sxc_admin` already holds select/insert/update/delete on `rate_limit` from
 * 0002_roles.sql and matches the `sxc_app_access` policy from 0005, so nothing
 * here needs a migration.
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

import { adminDb, type Sql } from './db.ts';

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
export async function consume(subject: Buffer, limit: Limit, sql: Sql = adminDb()): Promise<Decision> {
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

// --- this application's own limits -------------------------------------------

/**
 * ## Why the portal needs one at all
 *
 * The account lockout in admin-auth.ts is per-account, and per-account controls
 * do nothing for an address that has no account: `signIn` runs a full Argon2id
 * verify against a decoy hash on every miss so the timing gives nothing away,
 * and until this bucket existed, nothing bounded how often anyone could make it
 * do that. Roughly 50ms of CPU per request, from anyone, unbounded, on the
 * origin that holds five hundred people's contact details.
 *
 * ## Why the numbers are what they are
 *
 * Keyed by connection, spent **before** the account is looked up. That ordering
 * is the same one the public login uses and for the same reason: a limit
 * consumed after the lookup would be spent by a real account and not by an
 * unknown one, which is a difference an attacker can measure.
 *
 * Ten an hour is generous for a portal with a handful of users — an admin
 * fumbling a TOTP code three or four times in a row is a normal afternoon, and
 * an admin who exhausts ten has a problem the lockout was going to report
 * anyway. It is stingy for anyone working through a list.
 *
 * This is not a substitute for the lockout and does not replace it. An attacker
 * with many addresses defeats an IP limit; an attacker with one IP defeats a
 * per-account one. The two cover each other's gap.
 */
export const LIMITS = {
  adminSignInIpHour: { bucket: 'admin:signin:ip:h', capacity: 10, refillPerSecond: perHour(10) },
  /**
   * Re-authentication for a dangerous action. Looser, because the caller already
   * holds a live session and has therefore already passed everything above, and
   * because being locked out of step-up mid-task is its own kind of incident.
   */
  adminStepUpIpHour: { bucket: 'admin:stepup:ip:h', capacity: 20, refillPerSecond: perHour(20) },
} as const satisfies Record<string, Limit>;
