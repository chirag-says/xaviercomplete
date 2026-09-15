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
 * The smallest thing that draws the profile tab. A name, initials, a photo URL,
 * and the caller's own alumni id. No batch year, no employer, no contact
 * details — those belong to `/me/profile`, which is the endpoint that has
 * thought about who may see what. A second, quieter copy of the profile here
 * would be a second place to get visibility wrong.
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** "Priya Menon" → "PM". The fallback when there is no photograph. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (first + last).toUpperCase();
}

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
    Array<{ id: string; full_name: string; photo_path: string | null; photo_status: string; is_visible: boolean }>
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

  return noStore(
    NextResponse.json(
      {
        signedIn: true,
        alumniId: row?.id ?? null,
        name: row?.full_name ?? null,
        initials: row ? initialsOf(row.full_name) : '',
        // Relative: the app prefixes its own API host, and an absolute URL
        // baked here would be wrong the moment the site moves.
        photoUrl: hasPhoto ? `/api/app/v1/alumni/${row!.id}/photo` : null,
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
