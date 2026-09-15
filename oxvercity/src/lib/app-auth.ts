/**
 * Resolving a mobile client's identity.
 *
 * The website carries its session in the `__Host-sxc_session` cookie. A native
 * app cannot: the `__Host-` prefix forbids a Domain attribute and demands
 * Secure and Path=/, native cookie jars treat prefixed cookies inconsistently
 * across OS versions, and the cookie is httpOnly — so the app's own JavaScript
 * could not read it to know whether it is signed in or clear it on sign-out.
 *
 * So the app sends `Authorization: Bearer <token>` instead. **Nothing else about
 * the session changes.** Same 32 random bytes from `newToken()`, same SHA-256 in
 * the `session` table, same 7-day absolute and 24-hour idle clocks, same
 * `readSession()` doing the resolving. The token travels in a different header;
 * that is the whole difference.
 *
 * ## Why this is what lets the origin check go
 *
 * `isSameOrigin()` exists because a browser attaches a cookie to a cross-site
 * POST *by itself* — the victim's credential rides along without their page
 * doing anything. That is CSRF, and it needs an ambient credential to work.
 *
 * A bearer token is not ambient. It is only on a request because our own code
 * put it there. There is no third-party page that can make an app send it. So
 * routes authenticated this way are not CSRF-able, which is why
 * `/api/app/v1/**` omits the origin check that every website POST performs.
 *
 * That argument only holds while this module refuses to read a cookie. It does,
 * deliberately and permanently — see `bearerToken`.
 *
 * This module imports no Next APIs so it loads under plain Node, which is what
 * lets `npm run app:verify` drive it against the real database. The framework
 * half lives in app-api.ts.
 */

import { db, type Sql } from './db.ts';
import { readSession, type Session } from './session.ts';

/**
 * Pull the token out of an Authorization header.
 *
 * Reads **only** that header. It does not look at cookies, a query parameter or
 * a custom header, and it must not be made to: the moment a session can be
 * resolved from something a browser sends automatically, the reasoning in this
 * file's header stops being true and every app route silently becomes
 * CSRF-able. If a future client cannot set an Authorization header, the answer
 * is to fix the client.
 *
 * The scheme is matched case-insensitively because RFC 7235 says it is a
 * case-insensitive token, and some HTTP stacks normalise it to `bearer`.
 *
 * The shape check is a cheap gate, not a security control — `tokenHash` would
 * turn nonsense into a harmless hash that matches no row anyway. It is here so
 * that an unauthenticated flood of junk costs us a regex rather than a database
 * round trip each.
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,200}$/;

export function bearerToken(headers: Headers): string | undefined {
  const header = headers.get('authorization');
  if (!header) return undefined;

  const match = /^bearer[ \t]+(.+)$/i.exec(header.trim());
  if (!match) return undefined;

  const token = match[1]!.trim();
  return TOKEN_SHAPE.test(token) ? token : undefined;
}

/**
 * Resolve a request's bearer token to a live session, or null.
 *
 * Delegates to the website's `readSession()`, so both clocks are enforced in the
 * same SQL WHERE clause and an expired session is never momentarily "found".
 * Passing the headers rather than a token keeps the "resolve the viewer from
 * what they sent, never from a parameter" property that `currentSession()` has:
 * no route can name a viewer other than the one asking.
 */
export async function appSessionFrom(headers: Headers, sql: Sql = db()): Promise<Session | null> {
  return readSession(bearerToken(headers), sql);
}

/**
 * The caller's own directory record.
 *
 * A session proves "this address is on the allowlist". It does **not** contain
 * an alumni id, and it must not start to: the id is the key to a profile and a
 * photograph, and a session that carried one could be pointed at someone else's
 * by a bug. So the id is looked up from the session's blind index on every
 * request that needs it.
 *
 * Matched on `gmail_hmac`, which is the same column `/api/me/summary` uses — the
 * address someone signs in with is the address on their directory record.
 *
 * `is_visible` is reported rather than filtered. An alumnus who has withdrawn
 * their record still owns it and must be able to edit it, which is the only way
 * back: filtering here would lock them out of the switch they just flipped.
 * Callers that serve a record *to other people* check the flag themselves.
 *
 * Returns null when the session is live but no record matches. That is a real
 * state, not an error — an address can be granted access before the next data
 * load — and callers should treat it as "signed in, nothing to show" rather
 * than as a failure.
 */
export interface Owner {
  alumniId: string;
  isVisible: boolean;
}

export async function resolveOwner(session: Session, sql: Sql = db()): Promise<Owner | null> {
  const rows = await sql<Array<{ id: string; is_visible: boolean }>>`
    select id, is_visible
      from alumni
     where gmail_hmac = ${session.emailHmac}
     limit 1
  `;

  const row = rows[0];
  return row ? { alumniId: row.id, isVisible: row.is_visible } : null;
}
