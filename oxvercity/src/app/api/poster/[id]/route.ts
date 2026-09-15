/**
 * GET /api/poster/<broadcast-id> — the event poster from a mailing.
 *
 * Public, deliberately. This URL exists so the `<img>` in a delivered email
 * resolves, and an email is opened by a mail client that holds no cookie of
 * ours and cannot be asked to sign in. A poster is a public advertisement for
 * an event; there is nothing here to gate.
 *
 * The id is the broadcast's, and it is a v4 UUID — not guessable, and it
 * identifies a mailing rather than a person. Someone holding one learns that an
 * event was advertised, which is the thing the poster is for.
 *
 * ## What this route cannot reach
 *
 * `sxc_web` is granted SELECT on `broadcast_poster` and on nothing else in
 * migration 0013 — not the subject, not the body, and not
 * `broadcast_recipient`. So the public site physically cannot answer "who was
 * sent this", whatever a future bug here asks it to do. The grant is the
 * control; this comment is only the explanation.
 */

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Anything that is not one of ours is not here. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nothingHere(): NextResponse {
  return new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': 'public, max-age=300', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!UUID.test(id)) return nothingHere();

  const rows = await db()<Array<{ bytes: Buffer; content_type: string }>>`
    select bytes, content_type from broadcast_poster where broadcast_id = ${id} limit 1
  `;
  const poster = rows[0];
  if (!poster) return nothingHere();

  return new NextResponse(new Uint8Array(poster.bytes), {
    headers: {
      'Content-Type': poster.content_type,
      'Content-Length': String(poster.bytes.byteLength),
      // Our own re-encode decided the type; nosniff stops a mail client or
      // browser deciding otherwise about bytes an administrator uploaded.
      'X-Content-Type-Options': 'nosniff',
      // A poster never changes once sent — the mailing carrying it has already
      // gone out — so it caches hard. This is also the one thing that keeps a
      // popular event from turning five hundred inbox opens into five hundred
      // database reads.
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800, immutable',
      // It is public, but it is an event flyer, not something to index.
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
