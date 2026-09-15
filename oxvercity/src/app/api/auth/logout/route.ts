/**
 * POST /api/auth/logout — sign out here, or everywhere.
 *
 * Revoking is server-side. Clearing the cookie alone would leave a live session
 * row that anyone holding a copy of the token could still use, which is the
 * usual mistake and is indistinguishable from working until it matters.
 */

import { NextResponse } from 'next/server';

import { audit } from '@/lib/audit';
import { ipSubject, isSameOrigin } from '@/lib/request';
import { revokeAllSessions, revokeSession } from '@/lib/session';
import { clearSessionCookie, currentSession, readSessionCookie } from '@/lib/session-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOrigin(request.headers, process.env.APP_URL ?? '')) {
    return NextResponse.json({ message: 'Bad request.' }, { status: 403 });
  }

  const token = await readSessionCookie();
  let everywhere = false;
  try {
    const form = await request.formData();
    everywhere = form.get('scope') === 'everywhere';
  } catch {
    /* no body: sign out of this session only */
  }

  if (everywhere) {
    // Resolve the identity before revoking, or there is nothing left to look up.
    const session = await currentSession();
    if (session) {
      const count = await revokeAllSessions(session.emailHmac);
      await audit({
        actorType: 'alumnus',
        actorId: session.id,
        action: 'sessions_revoked_all',
        ipHash: ipSubject(request.headers),
        meta: { count },
      });
    }
  } else {
    await revokeSession(token);
    await audit({ actorType: 'alumnus', action: 'session_revoked', ipHash: ipSubject(request.headers) });
  }

  await clearSessionCookie();

  const response = NextResponse.redirect(new URL('/login?e=signed_out', process.env.APP_URL ?? request.url), 303);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}
