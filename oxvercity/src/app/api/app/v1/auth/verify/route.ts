/**
 * POST /api/app/v1/auth/verify — the code, typed into the app.
 *
 * Calls the same `verifySignInCode()` the website calls: same single-use SQL
 * guard, same five-attempt cap, same re-check that the access grant is still
 * live, same one-failure-for-everything rule, same 700ms floor.
 *
 * ## The one real difference: where the token goes
 *
 * The website hands the token to `setSessionCookie()`. This returns it in the
 * body instead, and the app puts it in the platform keychain. The session row,
 * its hash, and both its clocks are untouched — `createSession()` did all of
 * that inside the library call above. Only the transport changes.
 *
 * Why not a cookie: the `__Host-` prefix forbids a Domain attribute and demands
 * Secure and Path=/, and native cookie jars handle prefixed cookies
 * inconsistently across OS versions; persistence across app restarts is not
 * guaranteed; and because the cookie is httpOnly the app could never read it to
 * know whether it is signed in, when it expires, or to clear it on sign-out.
 * The full argument is in src/lib/app-auth.ts.
 *
 * ## Why `expiresAt` is returned
 *
 * So the app can warn before it happens. Sessions are 7-day absolute and 24-hour
 * idle with no refresh, and the idle clock is the one that will actually bite —
 * anyone who does not open the app for a day is signed out. A client that knows
 * the deadline can say "you'll need to sign in again on Friday" instead of
 * dumping someone at a login screen mid-task.
 *
 * Note what is *not* returned: no `next` path. The website sends one because a
 * form needs somewhere to navigate; the app decides its own destination, and a
 * server-supplied redirect target reachable from an unauthenticated endpoint is
 * a shape worth not having.
 */

import { NextResponse } from 'next/server';

import { appError, noStore } from '@/lib/app-api';
import { verifySignInCode } from '@/lib/auth';
import { db } from '@/lib/db';
import { ipSubject, padTo, userAgent } from '@/lib/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Matches the website's floor. Comfortably above the slowest failing path. */
const RESPONSE_FLOOR_MS = 700;

/**
 * The one thing this endpoint says about a failed attempt.
 *
 * Wrong code, expired code, five wrong codes already, an address nobody has
 * heard of, a grant revoked this morning — all of it lands here. Telling them
 * apart would let the form be used to work out who is a Xaverian: a row only
 * exists for an allowlisted address, so "too many attempts" is itself the
 * answer. src/lib/auth.ts carries the full reasoning.
 */
const WRONG = 'That code was not right, or it has expired. Codes last ten minutes — ask for a new one and try again.';

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();

  // No origin check — see the note in ../request/route.ts.

  let email: unknown;
  let code: unknown;

  try {
    const body = (await request.json()) as { email?: unknown; code?: unknown };
    email = body.email;
    code = body.code;
  } catch {
    await padTo(startedAt, RESPONSE_FLOOR_MS);
    return appError(400, 'invalid', WRONG);
  }

  const outcome = await verifySignInCode(
    email,
    code,
    { ipSubject: ipSubject(request.headers), userAgent: userAgent(request.headers) },
    db(),
  );

  await padTo(startedAt, RESPONSE_FLOOR_MS);

  if (!outcome.ok) {
    if (outcome.reason === 'rate_limited') {
      const limited = appError(
        429,
        'rate_limited',
        'Too many attempts from this connection. Please wait an hour and try again.',
      );
      limited.headers.set('Retry-After', '3600');
      return limited;
    }
    return appError(400, 'invalid', WRONG);
  }

  /*
   * The token in a response body is the one moment it exists outside the
   * database in a form anyone could copy. `noStore` is what keeps it out of a
   * shared cache; the app moves it into the keychain immediately and never
   * writes it anywhere else.
   */
  return noStore(
    NextResponse.json(
      { token: outcome.token, expiresAt: outcome.expiresAt.toISOString() },
      { status: 200 },
    ),
  );
}

export async function GET(): Promise<NextResponse> {
  return appError(405, 'method_not_allowed', 'Method not allowed.');
}
