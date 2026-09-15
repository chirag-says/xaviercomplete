/**
 * POST /api/access-request — "please give me directory access".
 *
 * Submits the request directly to the admin queue. Turnstile provides bot
 * protection; the admin decides whether the applicant is a Xaverian.
 *
 * No OTP step — the request is queued immediately after validation.
 */

import { NextResponse, after } from 'next/server';

import { submitAccessRequest } from '@/lib/access-request';
import { db } from '@/lib/db';
import { clientIp, ipSubject, isSameOrigin, padTo } from '@/lib/request';
import { verifyTurnstile } from '@/lib/turnstile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESPONSE_FLOOR_MS = 900;

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

  const honeypot = form.get('website');
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    await padTo(startedAt, RESPONSE_FLOOR_MS);
    return NextResponse.json(
      { message: 'Your request is with the Association. You will hear from them by email.' },
      { status: 200 },
    );
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

  return NextResponse.json(
    { message: 'Your request is with the Association. You will hear from them by email.' },
    { status: 200 },
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ message: 'Method not allowed.' }, { status: 405 });
}
