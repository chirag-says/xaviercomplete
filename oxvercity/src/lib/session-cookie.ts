/**
 * Reading and writing the session cookie.
 *
 * Split from session.ts because that module holds the logic and this one holds
 * the framework: `next/headers` cannot be imported outside a Next request, and
 * keeping it here is what lets the session rules be driven directly by
 * `npm run auth:verify` against the real database.
 */

import { cookies } from 'next/headers';

import { db, type Sql } from './db.ts';
import { readSession, SESSION_COOKIE, type Session } from './session.ts';

/**
 * Secure is unconditional, even in development.
 *
 * Browsers treat http://localhost as a secure context, so a Secure cookie works
 * there. Making the flag conditional on NODE_ENV is the usual shortcut and it
 * means the thing you test is not the thing you ship.
 */
export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function readSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/**
 * The one call the rest of the application should use to ask "who is this?".
 *
 * Returns null for anonymous. There is deliberately no variant that takes an
 * identity from a parameter: every caller resolves the viewer from their own
 * cookie, so no route can be tricked into acting as someone else.
 */
export async function currentSession(sql: Sql = db()): Promise<Session | null> {
  return readSession(await readSessionCookie(), sql);
}
