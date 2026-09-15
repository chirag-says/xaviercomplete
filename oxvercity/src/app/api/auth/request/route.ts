/**
 * POST /api/auth/request — "send me a sign-in code".
 *
 * The response is identical whether or not the address is registered, and is
 * held to a fixed floor so the timing is identical too. Everything this route
 * knows, it keeps.
 */

import { NextResponse, after } from 'next/server';

import { requestSignInCode } from '@/lib/auth';
import { db } from '@/lib/db';
import { clientIp, ipSubject, isSameOrigin, padTo } from '@/lib/request';
import { verifyTurnstile } from '@/lib/turnstile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Every response below this floor waits until it is reached. Chosen to sit well
 * clear of the slowest path (a database round trip plus a Resend call), so the
 * registered and unregistered cases are indistinguishable from outside.
 */
const RESPONSE_FLOOR_MS = 1200;

/** The only message this endpoint ever returns about an address. */
const NEUTRAL = 'If that address is registered with the Association, a six-digit code is on its way.';

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();
  const appUrl = process.env.APP_URL ?? '';

  if (!isSameOrigin(request.headers, appUrl)) {
    return NextResponse.json({ message: 'Bad request.' }, { status: 403 });
  }

  let email: unknown;
  let turnstileToken: string | null = null;

  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { email?: unknown; turnstileToken?: unknown };
      email = body.email;
      turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : null;
    } else {
      const form = await request.formData();
      email = form.get('email');
      const token = form.get('cf-turnstile-response');
      turnstileToken = typeof token === 'string' ? token : null;
    }
  } catch {
    await padTo(startedAt, RESPONSE_FLOOR_MS);
    return NextResponse.json({ message: NEUTRAL }, { status: 200 });
  }

  const ip = clientIp(request.headers);

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    await padTo(startedAt, RESPONSE_FLOOR_MS);
    return NextResponse.json(
      { message: 'We could not verify that you are a person. Please try again.' },
      { status: 400 },
    );
  }

  // `after` runs the mail send once this response has been flushed, so the
  // provider's latency never lands on the response time and cannot be used to
  // tell a registered address from an unregistered one.
  const outcome = await requestSignInCode(
    email,
    { ipSubject: ipSubject(request.headers), ip },
    db(),
    (task) => after(task),
  );
  await padTo(startedAt, RESPONSE_FLOOR_MS);

  if (outcome === 'rate_limited') {
    return NextResponse.json(
      { message: 'Too many sign-in attempts. Please wait an hour and try again.' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    );
  }

  // `invalid_email` and `accepted` deliberately share a response. A malformed
  // address gets the same neutral line as a real one, so probing the form
  // teaches nothing at all.
  return NextResponse.json({ message: NEUTRAL }, { status: 200 });
}

/** Anything other than POST is not a thing this endpoint does. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ message: 'Method not allowed.' }, { status: 405 });
}
