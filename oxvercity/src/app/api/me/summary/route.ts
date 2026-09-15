/**
 * GET /api/me/summary — "is anyone signed in, and what do I put in the header?"
 *
 * ## Why this exists at all
 *
 * The profile icon belongs in the header, and the header is on every page —
 * including the home page, the about page and the rest, which are static and
 * should stay that way. Resolving the session in `SiteShell` would make every
 * one of them dynamic: the whole site rendered per request, to decide whether
 * to draw a 36-pixel circle.
 *
 * So the header asks, once, after it has mounted. Pages stay static, the icon
 * appears a moment after the first paint, and a visitor who is not signed in
 * never sees anything appear at all.
 *
 * ## What it will not return
 *
 * The smallest thing that draws the control: a display name, initials, and a
 * photo URL if there is one. No batch year, no employer, no contact details, no
 * alumni id — the id is the key to `/api/photo/<id>` and the profile page, and
 * there is no reason for the header to hold one. Anything more would be a
 * second, quieter copy of the profile endpoint with none of its thought about
 * who may see what.
 *
 * A signed-in alumnus with no directory record still gets `signedIn: true` with
 * no name. That is a real state — an address can be granted access before the
 * next data load — and the header shows a plain avatar rather than nothing,
 * because "nothing" would read as "signed out" and send them back to /login.
 */

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { currentSession } from '@/lib/session-cookie';

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

export async function GET(): Promise<NextResponse> {
  const session = await currentSession();

  const nothing = NextResponse.json({ signedIn: false }, { status: 200 });
  // Belt and braces over the middleware rule: whoever is signed in is the one
  // thing about this response that must never be served to somebody else.
  nothing.headers.set('Cache-Control', 'private, no-store, max-age=0');

  if (!session) return nothing;

  const sql = db();
  const rows = await sql<
    Array<{ id: string; full_name: string; photo_path: string | null; photo_status: string; is_visible: boolean }>
  >`
    select id, full_name, photo_path, photo_status, is_visible
      from alumni where gmail_hmac = ${session.emailHmac} limit 1
  `;
  const row = rows[0];

  /*
   * `is_visible` is checked here even though this is the owner's own photograph.
   *
   * Not for confidentiality — it is their picture and they may see it — but
   * because `/api/photo` refuses to serve a withdrawn record to anybody at all,
   * owner included. Pointing the header at a URL that 404s would put a broken
   * image in the corner of every page for the one person who has just asked to
   * be less visible. The initials render instead.
   */
  const hasPhoto = Boolean(row && row.is_visible && row.photo_status === 'live' && row.photo_path);

  const response = NextResponse.json(
    {
      signedIn: true,
      name: row?.full_name ?? null,
      initials: row ? initialsOf(row.full_name) : '',
      // The owner always sees their own photograph, whatever audience they have
      // set it to — `readPhotoBytes` makes the same exception for the same
      // reason, so an alumni-only picture still renders here.
      photoUrl: hasPhoto ? `/api/photo/${row!.id}` : null,
    },
    { status: 200 },
  );
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}
