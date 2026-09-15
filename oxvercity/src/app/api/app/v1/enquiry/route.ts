/**
 * POST /api/app/v1/enquiry — the "have a question?" form, from the app.
 *
 * Calls the same `submitEnquiry()` the website calls, so the validation, the
 * rate limits, the consent requirement and the delivery all behave identically.
 *
 * ## Why this takes JSON and the website takes FormData
 *
 * The website's route reads a real `<form>` posted by Framer-generated markup,
 * and that markup is a trap: the genuine fields are **capitalised** (`Name`,
 * `Email`, `Message`) and sit alongside eleven invisible lowercase decoys — one
 * of which is `message`. Reading `message` instead of `Message` there would drop
 * every real enquiry and accept every bot.
 *
 * The app has no Framer markup and no invisible inputs, so it sends clean JSON
 * and this route maps it to the shape the library wants. The honeypot is not
 * re-implemented here, because there is nothing for a bot to fill in: there is
 * no rendered form to scrape, and a client that posts JSON directly is already
 * past the point a honeypot would catch. Turnstile and the rate limits are what
 * bound abuse on this route.
 *
 * That is worth stating because the absence of a honeypot check looks like an
 * oversight when you diff the two files. It is not.
 */

import { NextResponse } from 'next/server';

import { appError, noStore } from '@/lib/app-api';
import { db } from '@/lib/db';
import { submitEnquiry } from '@/lib/enquiry';
import { clientIp, ipSubject } from '@/lib/request';
import { verifyTurnstile } from '@/lib/turnstile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const THANKS = 'Thank you — your message is with the Association.';

export async function POST(request: Request): Promise<NextResponse> {
  // No origin check — see ../auth/request/route.ts.

  let body: { name?: unknown; email?: unknown; message?: unknown; consent?: unknown; turnstileToken?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return appError(400, 'bad_request', 'That request could not be read.');
  }

  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : null;
  if (!(await verifyTurnstile(token, clientIp(request.headers)))) {
    return appError(400, 'challenge_failed', 'We could not verify that you are a person. Please try again.');
  }

  const outcome = await submitEnquiry(
    {
      name: body.name,
      email: body.email,
      message: body.message,
      /*
       * Translated, not passed through.
       *
       * `submitEnquiry` accepts `'on'` or `'true'` — the two things an HTML
       * checkbox can arrive as — and a JSON client naturally sends the boolean
       * `true`. Handing the boolean straight to the library silently fails
       * every app enquiry with "please confirm you agree", which is a confusing
       * thing to tell someone who ticked the box.
       *
       * Only an explicit `true` (or those literal strings) counts. A truthy
       * coercion here would let `consent: 1` or `consent: "no"` through, and
       * the whole point of the check is that the tickbox means something.
       */
      consent: body.consent === true || body.consent === 'true' || body.consent === 'on' ? 'true' : body.consent,
      source: 'app',
    },
    { ipSubject: ipSubject(request.headers) },
    db(),
  );

  if (!outcome.ok) {
    const status = outcome.reason === 'rate_limited' ? 429 : outcome.reason === 'invalid' ? 400 : 502;
    const response = appError(status, outcome.reason, outcome.message);
    if (outcome.reason === 'rate_limited') response.headers.set('Retry-After', '3600');
    return response;
  }

  return noStore(NextResponse.json({ message: THANKS }, { status: 200 }));
}

export async function GET(): Promise<NextResponse> {
  return appError(405, 'method_not_allowed', 'Method not allowed.');
}
