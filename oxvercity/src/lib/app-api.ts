/**
 * Shared plumbing for `/api/app/v1/**`.
 *
 * Split from app-auth.ts on the same line session-cookie.ts is split from
 * session.ts: that module holds logic a plain-Node verifier can drive, this one
 * holds the Next framework it gets wrapped in.
 *
 * ## The error contract
 *
 * Every failure is `{ error: <code>, message: <sentence> }`. The app switches on
 * `error`; the `message` is for a human and may be rewritten at any time without
 * it counting as an API change. Codes are stable.
 *
 * Messages never say more than the code. "Wrong code" and "no such address" are
 * the same `invalid` on the website for a reason — telling them apart turns the
 * login form into a membership oracle — and the app must not undo that by being
 * more helpful in its copy.
 */

import { NextResponse } from 'next/server';

import { appSessionFrom } from './app-auth.ts';
import { db, type Sql } from './db.ts';
import type { Session } from './session.ts';

/** Bumped only for a breaking change; the path carries it too. */
export const APP_API_VERSION = 1;

/**
 * Mark a response private and uncacheable.
 *
 * The middleware already blankets `/api/*` with this, so it is belt and braces —
 * but the middleware is one `decidesOwnCaching` edit away from exempting a path,
 * and a per-user response that lands in a shared cache is the kind of bug that
 * shows one alumnus another's profile. Cheap insurance.
 */
export function noStore<T extends NextResponse>(response: T): T {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export function appJson(body: unknown, status = 200): NextResponse {
  return noStore(NextResponse.json(body, { status }));
}

export function appError(status: number, error: string, message: string): NextResponse {
  return noStore(NextResponse.json({ error, message }, { status }));
}

/** No usable session. The app clears its token and shows the sign-in sheet. */
export function unauthenticated(): NextResponse {
  return appError(401, 'unauthenticated', 'Your session has ended. Sign in again.');
}

/**
 * Nothing here — for a bad id, an unknown id, a withdrawn record, and a record
 * the caller may not see. All four are the same 404 on purpose: distinguishing
 * "does not exist" from "exists but not for you" confirms the existence of the
 * second, which is the enumeration leak `/api/alumni/[id]` already avoids.
 */
export function notFound(): NextResponse {
  return appError(404, 'not_found', 'Not found.');
}

export function methodNotAllowed(): NextResponse {
  return appError(405, 'method_not_allowed', 'Method not allowed.');
}

/** Malformed body or parameter. Never echoes the offending value back. */
export function badRequest(message = 'That request could not be read.'): NextResponse {
  return appError(400, 'bad_request', message);
}

export function rateLimited(retryAfterSeconds: number): NextResponse {
  const response = appError(429, 'rate_limited', 'Too many attempts. Please wait and try again.');
  response.headers.set('Retry-After', String(retryAfterSeconds));
  return response;
}

/**
 * Who is asking, from their bearer token alone.
 *
 * Call sites read:
 *
 *     const session = await appSession(request);
 *     if (!session) return unauthenticated();
 *
 * Two lines rather than a helper that throws, because an explicit early return
 * is visible in review and a thrown-and-caught authorisation failure is not.
 * The same reasoning as `readProfile` taking a `Session` it never uses.
 */
export async function appSession(request: Request, sql: Sql = db()): Promise<Session | null> {
  return appSessionFrom(request.headers, sql);
}

// --- pagination --------------------------------------------------------------

/*
 * Re-exported from app-paging.ts rather than defined here, so route files have
 * one import while `npm run app:verify` can still drive the logic under plain
 * Node — this module pulls in `next/server`, which will not load outside a Next
 * build.
 */
export { decodeCursor, encodeCursor, pageLimit } from './app-paging.ts';
