/**
 * POST /api/app/v1/auth/request — "send me a sign-in code", from the app.
 *
 * The same `requestSignInCode()` the website calls, with the same rate limits,
 * the same Turnstile check, the same deferred send and the same 1200ms response
 * floor. Two things differ, and only two:
 *
 *  1. **JSON only.** The website route also accepts `FormData`, because it is
 *     posted to by a real `<form>` that must work before hydration. An app has
 *     no such constraint.
 *  2. **No origin check.** See the note below.
 *
 * ## Everything this endpoint knows, it keeps
 *
 * The response is byte-identical whether the address is on the allowlist, is not
 * on it, or is not an address at all. That is not politeness — without it, the
 * login screen becomes a membership oracle: type any address, read the answer,
 * learn whether that person is a Xaverian. The Association never agreed to
 * publish that.
 *
 * The floor exists because the *timing* leaks the same fact if left alone.
 * Measured on 11 September 2026, awaiting the mail provider made the registered
 * path 1.39–1.67s against 1.23–1.27s unregistered — non-overlapping bands, so a
 * stopwatch defeated the neutral wording. `lib/auth.ts` now defers the send and
 * this route holds every response to the same floor.
 *
 * An app must not undo any of that by being more helpful. It shows the same one
 * sentence the website shows.
 */

import { NextResponse, after } from 'next/server';

import { appError, noStore } from '@/lib/app-api';
import { requestSignInCode } from '@/lib/auth';
import { db } from '@/lib/db';
import { clientIp, ipSubject, padTo } from '@/lib/request';
import { verifyTurnstile } from '@/lib/turnstile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Matches the website's floor exactly. Both routes feed the same limiter. */
const RESPONSE_FLOOR_MS = 1200;

/** The only thing this endpoint ever says about an address. */
const NEUTRAL = 'If that address is registered with the Association, a six-digit code is on its way.';

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();

  /*
   * No `isSameOrigin()` here, unlike every website POST.
   *
   * That check exists because a browser attaches a session cookie to a
   * cross-site POST by itself, which is what CSRF needs. This route reads no
   * cookie and issues no cookie — the caller is an app sending a deliberate
   * request — so there is no ambient credential to abuse and nothing for the
   * check to protect. React Native's fetch sends neither Origin nor Referer, so
   * keeping it would simply refuse every app request.
   *
   * Do not "fix" this by adding the check back. See src/lib/app-auth.ts.
   */

  let email: unknown;
  let turnstileToken: string | null = null;

  try {
    const body = (await request.json()) as { email?: unknown; turnstileToken?: unknown };
    email = body.email;
    turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : null;
  } catch {
    // A malformed body gets the neutral line too. Saying "bad JSON" would be a
    // different response for a different input, which is the leak again.
    await padTo(startedAt, RESPONSE_FLOOR_MS);
    return noStore(NextResponse.json({ message: NEUTRAL }, { status: 200 }));
  }

  const ip = clientIp(request.headers);

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    await padTo(startedAt, RESPONSE_FLOOR_MS);
    return appError(400, 'challenge_failed', 'We could not verify that you are a person. Please try again.');
  }

  const outcome = await requestSignInCode(
    email,
    { ipSubject: ipSubject(request.headers), ip },
    db(),
    (task) => after(task),
  );

  await padTo(startedAt, RESPONSE_FLOOR_MS);

  if (outcome === 'rate_limited') {
    const response = appError(429, 'rate_limited', 'Too many sign-in attempts. Please wait an hour and try again.');
    response.headers.set('Retry-After', '3600');
    return response;
  }

  /*
   * `invalid_email` and `accepted` share this response deliberately. A malformed
   * address gets the same line as a real one, so probing teaches nothing.
   *
   * The app must therefore advance to the code screen on any 200 — including for
   * an address that will never receive a code. `npm run app:auth-verify` asserts
   * that, because "helpfully" staying on the email screen for an unknown address
   * would rebuild the oracle in the client.
   */
  return noStore(NextResponse.json({ message: NEUTRAL }, { status: 200 }));
}

export async function GET(): Promise<NextResponse> {
  return appError(405, 'method_not_allowed', 'Method not allowed.');
}
