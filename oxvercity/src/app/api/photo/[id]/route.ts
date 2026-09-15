/**
 * GET /api/photo/<alumni-id> — serve one profile photograph.
 *
 * Every photograph in the system comes through here, public or not, so there is
 * one place that decides who may see an image rather than a route for the easy
 * case and a bucket policy for the hard one.
 *
 * The audience check lives in `readPhotoBytes`, which calls the same
 * `photoUrlFor` the card and the profile page use. A photograph that is not
 * approved, or is alumni-only and the viewer is anonymous, is a 404 — never a
 * 403, which would confirm that a photograph exists.
 */

import { NextResponse } from 'next/server';

import { isAlumniId } from '@/lib/core/ids';
import { ownAlumniId, readPhotoBytes } from '@/lib/me';
import { pickRendition } from '@/lib/photo';
import { tierOf } from '@/lib/directory';
import { currentSession } from '@/lib/session-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function nothingHere(): NextResponse {
  return new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!isAlumniId(id)) return nothingHere();

  const session = await currentSession();
  const rendition = pickRendition(request.headers.get('accept'));

  const photo = await readPhotoBytes(id, tierOf(session), rendition, await ownAlumniId(session));
  if (!photo) return nothingHere();

  return new NextResponse(new Uint8Array(photo.body), {
    headers: {
      'Content-Type': photo.contentType,
      'Content-Length': String(photo.body.byteLength),
      // Our own re-encode decided the type; nosniff stops a browser deciding
      // otherwise and treating a stored object as script.
      'X-Content-Type-Options': 'nosniff',
      // A public photograph is public, so it may sit in a CDN. An alumni-only
      // one varies by who is asking and must not be stored anywhere shared.
      'Cache-Control': photo.isPublic
        ? 'public, max-age=3600, stale-while-revalidate=86400'
        : 'private, no-store, max-age=0',
      // `Accept` picks the rendition, so a cache keyed on the URL alone would
      // serve WebP to a client that asked for JPEG.
      Vary: 'Accept, Cookie',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
