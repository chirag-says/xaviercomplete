/**
 * POST /api/access-request/verify — check the six-digit code.
 *
 * Takes the address as well as the code. Keying this on a request id instead
 * would mean handing out an identifier that lets whoever holds it verify a
 * request they did not make; requiring both halves means they have to arrive
 * together.
 *
 * A wrong code, an unknown address and a malformed one share one message. The
 * attempt counter on the row is what actually stops guessing — five tries per
 * request — and the IP limit stops someone working through many requests from
 * one connection.
 */

import { NextResponse, after } from 'next/server';

import { verifyAccessRequest } from '@/lib/access-request';
import { db } from '@/lib/db';
import { ipSubject, isSameOrigin, padTo } from '@/lib/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESPONSE_FLOOR_MS = 600;

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

  const outcome = await verifyAccessRequest(
    form.get('email'),
    form.get('code'),
    { ipSubject: ipSubject(request.headers) },
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
    {
      message: outcome.alreadyQueued
        ? 'That request is already with the Association. You will hear from them by email.'
        : 'Verified. Your request is with the Association and you will hear from them by email.',
    },
    { status: 200 },
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ message: 'Method not allowed.' }, { status: 405 });
}
