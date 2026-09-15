/**
 * POST /api/app/v1/auth/logout — sign out, on this device or everywhere.
 *
 * `{ scope: 'everywhere' }` revokes every session for the identity; anything
 * else revokes just this one. Both call the website's own `revokeSession()` /
 * `revokeAllSessions()`, so a session revoked from the app is equally dead on
 * the website and vice versa — there is one session table and one set of rules.
 *
 * ## Why it answers 204 even when nothing was revoked
 *
 * Sign-out must not fail. If the token has already expired, was revoked from
 * another device, or is simply nonsense, the user's intent — "end my session" —
 * is already satisfied. Returning 401 would leave an app holding a dead token
 * and showing an error for having asked to get rid of it, and the obvious
 * client-side workaround (delete the token anyway) makes the status meaningless.
 * So this is idempotent by design.
 *
 * That is also why it does not use `requireSession`.
 */

import { NextResponse } from 'next/server';

import { appError, noStore } from '@/lib/app-api';
import { bearerToken } from '@/lib/app-auth';
import { db } from '@/lib/db';
import { readSession, revokeAllSessions, revokeSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const token = bearerToken(request.headers);

  let scope: unknown;
  try {
    const body = (await request.json()) as { scope?: unknown };
    scope = body.scope;
  } catch {
    // No body, or an unreadable one, means "this device". Sign-out is not the
    // place to be strict about parsing.
    scope = undefined;
  }

  const sql = db();

  if (scope === 'everywhere') {
    /*
     * Resolved *before* revoking, because `readSession` is the only way to get
     * from a token to an identity — and revoking this session first would make
     * the lookup fail and quietly turn "everywhere" into "here".
     */
    const session = await readSession(token, sql);
    if (session) {
      await revokeAllSessions(session.emailHmac, sql);
    }
  } else {
    await revokeSession(token, sql);
  }

  /*
   * Phase 6 note: this is where the device's push token gets revoked too, so a
   * signed-out or resold phone stops receiving another alumnus's notifications.
   * It lands with the device_token table rather than being stubbed now.
   */

  return noStore(new NextResponse(null, { status: 204 })) as NextResponse;
}

export async function GET(): Promise<NextResponse> {
  return appError(405, 'method_not_allowed', 'Method not allowed.');
}
