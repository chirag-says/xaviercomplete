/**
 * Reading and writing the admin session cookie.
 *
 * Split from admin-session.ts because `next/headers` cannot be imported outside
 * a Next request, and keeping it separate is what lets the session rules be
 * driven directly by `npm run admin:verify` against the real database.
 *
 * ## SameSite=Strict, not Lax
 *
 * The public site's alumni cookie is Lax, because alumni arrive by clicking a
 * magic link in an email and the cookie has to survive that navigation. Nobody
 * arrives at the portal from outside: you type the address or use a bookmark.
 * With nothing to break, Strict is free, and it closes the cross-site GET that
 * Lax still permits.
 *
 * The invitation link is not an exception — it carries its own token in the URL
 * and needs no session cookie to work.
 */

import { cookies } from 'next/headers';

import { adminDb, type Sql } from './db.ts';
import { readAdminSession, ADMIN_SESSION_COOKIE, type AdminSession } from './admin-session.ts';

/**
 * Secure is unconditional, even in development.
 *
 * Browsers treat http://localhost as a secure context, so a Secure cookie works
 * there. Making the flag conditional on NODE_ENV is the usual shortcut and it
 * means the thing you test is not the thing you ship.
 */
export async function setAdminSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  (await cookies()).set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

export async function readAdminSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
}

/**
 * The one call the rest of the portal uses to ask "who is this?".
 *
 * Returns null for signed out. There is deliberately no variant that takes an
 * identity from a parameter: every caller resolves the viewer from their own
 * cookie, so no page can be tricked into acting as another admin.
 */
export async function currentAdmin(sql: Sql = adminDb()): Promise<AdminSession | null> {
  return readAdminSession(await readAdminSessionCookie(), sql);
}
