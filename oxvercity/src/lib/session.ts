/**
 * Alumni sessions.
 *
 * The cookie carries 32 random bytes. The database stores only their SHA-256,
 * so a leaked dump yields no usable session — the same reasoning as the magic
 * link tokens, and the reason neither is recoverable by us either.
 *
 * Two clocks, both enforced server-side:
 *   - **absolute**, 7 days: a session dies a week after it was created, however
 *     active it has been. Nothing renews past this.
 *   - **idle**, 24 hours: a session left alone for a day dies early.
 *
 * A client that edits its own cookie gets nothing: the cookie is looked up by
 * hash, and a hash that is not in the table is not a session.
 *
 * This module is deliberately free of Next imports so it loads under plain Node
 * — `npm run auth:verify` drives it directly. The cookie plumbing lives next
 * door in session-cookie.ts.
 */

import { tokenHash, uaBlindIndex } from './core/hmac.ts';
import { newToken } from './core/ids.ts';
import { db, type Sql } from './db.ts';

/**
 * `__Host-` is not cosmetic. The prefix makes the browser refuse the cookie
 * unless it is Secure, Path=/ and — the part that matters here — carries **no
 * Domain attribute**. That is what keeps this cookie off admin.sxccaa.org: a
 * cookie without a Domain is sent to exactly the host that set it, and cannot
 * be widened to a parent domain by anything on the public site.
 */
export const SESSION_COOKIE = '__Host-sxc_session';

export const ABSOLUTE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export interface Session {
  id: string;
  /** The blind index of the signed-in address. The plaintext is never in a session. */
  emailHmac: Buffer;
}

/** Create a session row and return the raw token for the cookie. Stored only as a hash. */
export async function createSession(
  emailHmac: Buffer,
  userAgent: string | null,
  sql: Sql = db(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + ABSOLUTE_LIFETIME_MS);

  await sql`
    insert into session (token_hash, email_hmac, expires_at, ua_hash)
    values (${tokenHash(token)}, ${emailHmac}, ${expiresAt}, ${userAgent ? uaBlindIndex(userAgent) : null})
  `;

  return { token, expiresAt };
}

/**
 * Resolve a raw token to a live session, sliding its idle clock.
 *
 * Both expiry rules are in the WHERE clause rather than checked in JavaScript
 * afterwards, so an expired session is never momentarily "found". The absolute
 * deadline is never extended — only `last_seen_at` moves.
 */
export async function readSession(token: string | undefined, sql: Sql = db()): Promise<Session | null> {
  if (!token) return null;

  const rows = await sql<Array<{ id: string; email_hmac: Buffer }>>`
    update session
       set last_seen_at = now()
     where token_hash = ${tokenHash(token)}
       and revoked_at is null
       and expires_at > now()
       and last_seen_at > now() - ${`${IDLE_TIMEOUT_MS} milliseconds`}::interval
    returning id, email_hmac
  `;

  const row = rows[0];
  return row ? { id: row.id, emailHmac: Buffer.from(row.email_hmac) } : null;
}

/** Revoke one session. Idempotent. */
export async function revokeSession(token: string | undefined, sql: Sql = db()): Promise<void> {
  if (!token) return;
  await sql`update session set revoked_at = now() where token_hash = ${tokenHash(token)} and revoked_at is null`;
}

/** "Sign out everywhere" — every session for this identity, including this one. */
export async function revokeAllSessions(emailHmac: Buffer, sql: Sql = db()): Promise<number> {
  const rows = await sql`
    update session set revoked_at = now()
     where email_hmac = ${emailHmac} and revoked_at is null
    returning id
  `;
  return rows.length;
}

/** Housekeeping: sessions no clock can revive. */
export async function sweepSessions(sql: Sql = db()): Promise<number> {
  const rows = await sql`delete from session where expires_at < now() - interval '7 days' returning id`;
  return rows.length;
}
