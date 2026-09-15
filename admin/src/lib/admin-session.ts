/**
 * Admin sessions.
 *
 * Same shape as the alumni session (32 random bytes in the cookie, only the
 * SHA-256 stored) with three differences that matter:
 *
 *   - **Much shorter clocks.** 8 hours absolute, 30 minutes idle, against the
 *     alumni session's 7 days and 24 hours. An admin session left open on a
 *     shared machine is a different kind of problem from an alumnus's.
 *   - **Tied to an account, not an address.** The session points at an
 *     `admin_user` row, and every resolution re-checks that the account is
 *     still `active`. Disabling an admin ends their access on their next
 *     request whether or not anyone remembered to revoke the session.
 *   - **A step-up clock.** Dangerous actions require the holder to have proved
 *     password *and* authenticator recently, not merely at some point today.
 *
 * The cookie is `__Host-` prefixed, which forbids a `Domain` attribute — so it
 * is sent to admin.sxccaa.org and nowhere else, and nothing on the public site
 * can widen it to the parent domain. That, plus the separate origin, is what
 * stops an XSS on sxccaa.org from touching the portal (plan §9.1).
 *
 * Free of Next imports so it loads under plain Node for `npm run admin:verify`.
 * The cookie plumbing is next door in session-cookie.ts.
 */

import { tokenHash, uaBlindIndex, newToken } from './shared.ts';
import { adminDb, type Sql } from './db.ts';

export const ADMIN_SESSION_COOKIE = '__Host-sxc_admin';

export const ABSOLUTE_LIFETIME_MS = 8 * 60 * 60 * 1000;
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * How recently the holder must have re-authenticated for a dangerous action.
 *
 * Five minutes. Long enough to approve a handful of access requests without
 * being asked again; short enough that a walk-away with the screen unlocked
 * does not hand someone the ability to grant themselves access.
 */
export const STEP_UP_WINDOW_MS = 5 * 60 * 1000;

export type AdminRole = 'super_admin' | 'moderator';

export interface AdminSession {
  sessionId: string;
  adminId: string;
  role: AdminRole;
  mustChangePassword: boolean;
  /** When the holder last proved password + TOTP. Null means not this session. */
  steppedUpAt: Date | null;
}

/** True if this session may perform an action that requires step-up (plan §9.3). */
export function isStepUpFresh(session: AdminSession, now: Date = new Date()): boolean {
  if (!session.steppedUpAt) return false;
  return now.getTime() - session.steppedUpAt.getTime() < STEP_UP_WINDOW_MS;
}

export async function createAdminSession(
  adminId: string,
  context: { ipHash?: Buffer | null; userAgent?: string | null },
  sql: Sql = adminDb(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + ABSOLUTE_LIFETIME_MS);

  await sql`
    insert into admin_session (token_hash, admin_id, expires_at, ip_hash, ua_hash, stepped_up_at)
    values (
      ${tokenHash(token)}, ${adminId}, ${expiresAt},
      ${context.ipHash ?? null},
      ${context.userAgent ? uaBlindIndex(context.userAgent) : null},
      -- Signing in *is* a step-up: it required the password and a live code.
      now()
    )
  `;

  return { token, expiresAt };
}

/**
 * Resolve a cookie to a live session, sliding the idle clock.
 *
 * Both expiry rules and the account's status are in the WHERE clause rather
 * than checked in JavaScript afterwards, so an expired session or a disabled
 * admin is never momentarily "found". The absolute deadline never moves; only
 * `last_seen_at` does.
 */
export async function readAdminSession(
  token: string | undefined,
  sql: Sql = adminDb(),
): Promise<AdminSession | null> {
  if (!token) return null;

  const rows = await sql<
    Array<{
      id: string;
      admin_id: string;
      role: AdminRole;
      must_change_password: boolean;
      stepped_up_at: Date | null;
    }>
  >`
    update admin_session s
       set last_seen_at = now()
      from admin_user a
     where s.token_hash = ${tokenHash(token)}
       and s.admin_id = a.id
       and s.revoked_at is null
       and s.expires_at > now()
       and s.last_seen_at > now() - ${`${IDLE_TIMEOUT_MS} milliseconds`}::interval
       and a.status = 'active'
       and a.totp_confirmed_at is not null
       and (a.locked_until is null or a.locked_until < now())
    returning s.id, s.admin_id, a.role, a.must_change_password, s.stepped_up_at
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    sessionId: row.id,
    adminId: row.admin_id,
    role: row.role,
    mustChangePassword: row.must_change_password,
    steppedUpAt: row.stepped_up_at,
  };
}

/** Record a successful re-authentication, restarting the step-up clock. */
export async function markSteppedUp(sessionId: string, sql: Sql = adminDb()): Promise<void> {
  await sql`update admin_session set stepped_up_at = now() where id = ${sessionId} and revoked_at is null`;
}

export async function revokeAdminSession(token: string | undefined, sql: Sql = adminDb()): Promise<void> {
  if (!token) return;
  await sql`update admin_session set revoked_at = now() where token_hash = ${tokenHash(token)} and revoked_at is null`;
}

/**
 * End every session for an account.
 *
 * Called on disable, on password change, and on TOTP re-enrolment. Any of those
 * means "whoever might be holding a session for this account should stop being
 * able to use it", and leaving the current session alive after a password
 * change is how a compromised session survives the response to it.
 */
export async function revokeAllAdminSessions(adminId: string, sql: Sql = adminDb()): Promise<number> {
  const rows = await sql`
    update admin_session set revoked_at = now()
     where admin_id = ${adminId} and revoked_at is null
    returning id
  `;
  return rows.length;
}

/** Housekeeping: sessions no clock can revive. */
export async function sweepAdminSessions(sql: Sql = adminDb()): Promise<number> {
  const rows = await sql`
    delete from admin_session where expires_at < now() - interval '7 days' returning id
  `;
  return rows.length;
}
