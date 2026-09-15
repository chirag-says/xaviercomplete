/**
 * POST /api/access-request — "please give me directory access".
 *
 * Every successful path returns the same sentence. Whether the address is
 * already an alumnus, already has access, already has a request outstanding, or
 * has never been seen, the answer is identical — anything else turns this form
 * into a way to test who is a Xaverian, which is the disclosure the whole
 * allowlist design exists to prevent.
 *
 * A fixed response floor holds the timing steady too, for the same reason as
 * the sign-in route: a lookup that hits and one that misses differ by a few
 * milliseconds, and a few milliseconds is an answer.
 */

import { NextResponse, after } from 'next/server';

import { submitAccessRequest } from '@/lib/access-request';
import { db } from '@/lib/db';
import { clientIp, ipSubject, isSameOrigin, padTo } from '@/lib/request';
import { verifyTurnstile } from '@/lib/turnstile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESPONSE_FLOOR_MS = 900;

/** The only thing this endpoint says about an address. */
const NEUTRAL = 'If we can reach that address, a six-digit code is on its way. Enter it below.';

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();

  if (!isSameOrigin(request.headers, process.env.APP_URL ?? '')) {
    return NextResponse.json({ message: 'Bad request.' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    await padTo(startedAt, RESPONSE_FLOOR_MS);
    return NextResponse.json({ message: 'Bad request.' }, { status: 400 });
  }

  /*
   * The honeypot. The Framer form markup this page is built from ships a set of
   * invisible fields for exactly this, and a bot that fills every input it finds
   * will fill them. A human never sees them.
   *
   * Answered with the neutral message rather than an error: telling a bot it was
   * caught is telling it what to change.
   */
  const honeypot = form.get('website');
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    await padTo(startedAt, RESPONSE_FLOOR_MS);
    return NextResponse.json({ message: NEUTRAL }, { status: 200 });
  }

  const ip = clientIp(request.headers);
  const token = form.get('cf-turnstile-response');

  if (!(await verifyTurnstile(typeof token === 'string' ? token : null, ip))) {
    await padTo(startedAt, RESPONSE_FLOOR_MS);
    return NextResponse.json(
      { message: 'We could not verify that you are a person. Please try again.' },
      { status: 400 },
    );
  }

  // `after` runs the mail send once the response is flushed, so the provider's
  // latency never lands on the response time.
  const outcome = await submitAccessRequest(
    {
      name: form.get('name'),
      email: form.get('email'),
      batchYear: form.get('batchYear'),
      stream: form.get('stream'),
      reason: form.get('reason'),
    },
    { ipSubject: ipSubject(request.headers), ip },
    db(),
    (task) => after(task),
  );

  await padTo(startedAt, RESPONSE_FLOOR_MS);

  if (!outcome.ok) {
    return NextResponse.json(
      { message: outcome.message },
      { status: outcome.reason === 'rate_limited' ? 429 : 400 },
    );
  }

  return NextResponse.json({ message: NEUTRAL }, { status: 200 });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ message: 'Method not allowed.' }, { status: 405 });
}
