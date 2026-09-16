/**
 * GET /api/app/v1/me — "am I signed in, and what goes in the header?"
 *
 * The app's equivalent of `/api/me/summary`, and the call it makes on every cold
 * start to decide whether the keychain token is still good. It is deliberately
 * the cheapest authenticated endpoint: one indexed SELECT, no decryption, no
 * view budget spent.
 *
 * ## What it will not return
 *
 * The smallest thing that draws the profile tab. A name, initials, and the
 * caller's own alumni id. No batch year, no employer, no contact details —
 * those belong to `/me/profile`, which is the endpoint that has thought about
 * who may see what. A second, quieter copy of the profile here would be a
 * second place to get visibility wrong.
 *
 * `photoUrl` is present in the shape and always null; see the note on it below.
 *
 * The alumni id *is* included, unlike the website's version. The website's
 * header only needs to draw a circle; the app needs to know which profile is its
 * own so it can offer "edit" on one screen and not another. It is the caller's
 * own id, resolved server-side from their session — never taken from the client.
 *
 * `unreadCount` is present and zero until phase 6 creates the notification
 * table. Shipping the field now means the tab badge does not need a client
 * release when the server starts populating it.
 */

import { NextResponse } from 'next/server';

import { appError, appSession, noStore } from '@/lib/app-api';
import { db } from '@/lib/db';
import { initialsOf } from '@/lib/visibility';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * `initialsOf` is imported rather than defined here. It was a local copy in this
 * file and another in /api/me/summary/route.ts, both typed `string` — which
 * would have thrown on a record with no name once migration 0014 allowed one.
 * The shared version in lib/visibility.ts takes a nullable name and returns null
 * when there is nothing to work from.
 */

export async function GET(request: Request): Promise<NextResponse> {
  const sql = db();
  const session = await appSession(request, sql);

  /*
   * 200 with `signedIn: false`, not 401.
   *
   * A 401 fires the app's session-expiry sheet, and this is the one endpoint
   * that must be able to say "nobody is signed in" as a normal answer — it is
   * what the app calls at launch, before it knows. Answering 401 here would
   * raise "your session has ended" at every cold start of a signed-out app.
   */
  if (!session) {
    return noStore(NextResponse.json({ signedIn: false }, { status: 200 }));
  }

  const rows = await sql<
    Array<{ id: string; full_name: string | null; photo_path: string | null; photo_status: string; is_visible: boolean }>
  >`
    select id, full_name, photo_path, photo_status, is_visible
      from alumni where gmail_hmac = ${session.emailHmac} limit 1
  `;
  const row = rows[0];

  /*
   * `is_visible` is checked even though this is the owner's own photograph — not
   * for confidentiality, but because the photo route refuses to serve a
   * withdrawn record to anybody, owner included. Pointing the app at a URL that
   * 404s would put a broken image in the profile tab for the one person who has
   * just asked to be less visible. Initials render instead. Same reasoning as
   * /api/me/summary.
   */
  const hasPhoto = Boolean(row && row.is_visible && row.photo_status === 'live' && row.photo_path);

  /*
   * Null until the app's photo route exists.
   *
   * This used to return `/api/app/v1/alumni/<id>/photo`, which has never been
   * built — there is nothing under src/app/api/app/v1/alumni at all. The app
   * happens not to render the field yet, so the only cost so far was a URL that
   * 404s, but shipping a link to a route that does not exist is how a broken
   * avatar arrives in a release nobody connected to this line.
   *
   * The website's `/api/photo/<id>` cannot stand in. It resolves the viewer with
   * `currentSession()`, which reads the `__Host-` cookie, and the app carries a
   * bearer token instead (src/lib/app-auth.ts) — so it would serve a public
   * photograph and 404 an alumni-only one, including the caller's own.
   *
   * Whoever builds the app's directory endpoints should add the photo route
   * beside them, resolving the viewer with `appSession()` and reusing
   * `readPhotoBytes` so the audience decision stays in one place, then point
   * this back at it. `hasPhoto` is computed above and left in place so that is a
   * one-line change.
   */
  void hasPhoto;

  return noStore(
    NextResponse.json(
      {
        signedIn: true,
        alumniId: row?.id ?? null,
        name: row?.full_name ?? null,
        initials: initialsOf(row?.full_name ?? null) ?? '',
        photoUrl: null,
        // A live session whose address has no directory row is a real state —
        // access can be granted before the next data load — and the app shows a
        // plain avatar rather than treating it as signed out.
        hasRecord: Boolean(row),
        isVisible: row?.is_visible ?? null,
        unreadCount: 0,
      },
      { status: 200 },
    ),
  );
}

export async function POST(): Promise<NextResponse> {
  return appError(405, 'method_not_allowed', 'Method not allowed.');
}
