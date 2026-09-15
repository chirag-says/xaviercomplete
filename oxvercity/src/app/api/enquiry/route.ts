/**
 * POST /api/enquiry — the general "have a question?" form.
 *
 * The form this serves appears on four pages, and until now it posted nowhere:
 * `SiteForm` treated a missing action as success, so a visitor filled it in,
 * read "Message sent", and nobody ever saw the message. Telling someone their
 * message arrived when it did not is worse than having no form at all, which is
 * why this route reports the real outcome and why `action` is now required.
 *
 * ## The field names are a trap
 *
 * The Framer markup ships **capitalised** real fields — `Name`, `Email`,
 * `Message` — alongside a set of lowercase honeypots, one of which is
 * `message`. Reading `message` instead of `Message` would drop every genuine
 * enquiry and accept every bot. The casing below is deliberate.
 */

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { submitEnquiry } from '@/lib/enquiry';
import { clientIp, ipSubject, isSameOrigin } from '@/lib/request';
import { verifyTurnstile } from '@/lib/turnstile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The lowercase decoys Framer renders invisibly. A person never sees them; a
 * bot that fills every input it finds fills them.
 *
 * `message` is in this list and `Message` is the real field — see the note above.
 */
const HONEYPOTS = [
  'website', 'company', 'message', 'subject', 'title',
  'description', 'feedback', 'notes', 'details', 'remarks', 'comments',
];

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOrigin(request.headers, process.env.APP_URL ?? '')) {
    return NextResponse.json({ message: 'Bad request.' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: 'Bad request.' }, { status: 400 });
  }

  // Answered with success rather than an error: telling a bot it was caught is
  // telling it what to change. Nothing is sent.
  for (const field of HONEYPOTS) {
    const value = form.get(field);
    if (typeof value === 'string' && value.trim() !== '') {
      return NextResponse.json({ message: 'Thank you — your message is with the Association.' }, { status: 200 });
    }
  }

  const token = form.get('cf-turnstile-response');
  if (!(await verifyTurnstile(typeof token === 'string' ? token : null, clientIp(request.headers)))) {
    return NextResponse.json(
      { message: 'We could not verify that you are a person. Please try again.' },
      { status: 400 },
    );
  }

  const outcome = await submitEnquiry(
    {
      name: form.get('Name'),
      email: form.get('Email'),
      message: form.get('Message'),
      consent: form.get('Consent'),
      source: form.get('source'),
    },
    { ipSubject: ipSubject(request.headers) },
    db(),
  );

  if (!outcome.ok) {
    return NextResponse.json(
      { message: outcome.message },
      { status: outcome.reason === 'rate_limited' ? 429 : outcome.reason === 'invalid' ? 400 : 502 },
    );
  }

  return NextResponse.json({ message: 'Thank you — your message is with the Association.' }, { status: 200 });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ message: 'Method not allowed.' }, { status: 405 });
}
