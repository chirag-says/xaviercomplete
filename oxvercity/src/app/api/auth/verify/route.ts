/**
 * POST /api/auth/verify — the code, typed in.
 *
 * Takes the address and the six digits together and, if they agree, sets the
 * session cookie. The two halves must arrive in the same request: a code is too
 * short to identify anybody on its own, so the address is what turns "is this a
 * valid code" into "is this *their* code".
 *
 * ## Why the address is posted rather than remembered
 *
 * The obvious alternative is to stash the address in a cookie at the request
 * step and read it back here. That is one more piece of state to expire, one
 * more thing to get out of step with the form on screen, and a cookie holding
 * an address is a cookie holding personal data on a device we do not control.
 * The form still has the address the visitor typed thirty seconds ago; it can
 * send it again.
 *
 * ## The response floor
 *
 * An unregistered address has no row, so the handler returns after one SELECT.
 * A registered one with a wrong code does a SELECT, an UPDATE and an audit
 * insert. Left alone that difference is measurable, and measuring it is enough
 * to tell the two apart — which would undo the neutral wording from outside.
 * Every response waits for the same floor.
 *
 * There is no Turnstile here, matching the access-request verify step. The
 * challenge was already answered to obtain a code; making someone solve another
 * one to type it in punishes the person who is struggling to read six digits
 * off a phone, and the row's five-attempt cap is what actually bounds guessing.
 */

import { NextResponse } from 'next/server';

import { verifySignInCode } from '@/lib/auth';
import { db } from '@/lib/db';
import { ipSubject, isSameOrigin, padTo, userAgent } from '@/lib/request';
import { setSessionCookie } from '@/lib/session-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Comfortably above the slowest failing path, so every outcome costs the same. */
const RESPONSE_FLOOR_MS = 700;

/**
 * The one thing this endpoint says about a failed attempt.
 *
 * Wrong code, expired code, five wrong codes already, address nobody has heard
 * of, access revoked this morning — all of it lands here. `lib/auth.ts` carries
 * the reasoning; the short version is that any of those told apart would let
 * the form be used to work out who is a Xaverian.
 */
const WRONG = 'That code was not right, or it has expired. Codes last ten minutes — ask for a new one and try again.';

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();

  if (!isSameOrigin(request.headers, process.env.APP_URL ?? '')) {
    return NextResponse.json({ message: 'Bad request.' }, { status: 403 });
  }

  let email: unknown;
  let code: unknown;

  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { email?: unknown; code?: unknown };
      email = body.email;
      code = body.code;
    } else {
      const form = await request.formData();
      email = form.get('email');
      code = form.get('code');
    }
  } catch {
    await padTo(startedAt, RESPONSE_FLOOR_MS);
    return NextResponse.json({ message: WRONG }, { status: 400 });
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
      return NextResponse.json(
        { message: 'Too many attempts from this connection. Please wait an hour and try again.' },
        { status: 429, headers: { 'Retry-After': '3600' } },
      );
    }
    return NextResponse.json({ message: WRONG }, { status: 400 });
  }

  await setSessionCookie(outcome.token, outcome.expiresAt);

  // The client navigates rather than being redirected, because this is a fetch
  // from a form that is managing its own two steps. `next` is a fixed string,
  // not anything the request supplied: a redirect target taken from the body
  // would be an open redirect hanging off the sign-in endpoint.
  const response = NextResponse.json({ ok: true, next: '/alumni' }, { status: 200 });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

/** Anything other than POST is not a thing this endpoint does. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ message: 'Method not allowed.' }, { status: 405 });
}
