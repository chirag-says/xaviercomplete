/**
 * GET /api/photo/<alumni-id> — serve a photograph to a reviewing admin.
 *
 * Separate from the public site's route of the same shape, and deliberately
 * different: this one serves **pending** photographs, which is the whole point
 * of a moderation queue, and it serves them only to a signed-in admin.
 *
 * It reads the bytes directly rather than proxying the public site. The portal
 * is a separate deployment on a separate origin; making it depend on the public
 * app being up in order to review an image would be a strange coupling, and
 * fetching across origins would need the public route to trust this one.
 */

import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/db';
import { requireSettledAdmin } from '@/lib/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[2-9a-km-np-z]{12}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // Redirects to /login for a signed-out caller, which for an <img> src means a
  // broken image rather than a leaked photograph.
  await requireSettledAdmin();

  const { id } = await params;
  if (!ID.test(id)) return new NextResponse(null, { status: 404 });

  const rows = await adminDb()<Array<{ webp: Buffer; jpeg: Buffer }>>`
    select p.webp, p.jpeg from alumni_photo p where p.alumni_id = ${id} limit 1
  `;
  const row = rows[0];
  if (!row) return new NextResponse(null, { status: 404 });

  const wantsWebp = request.headers.get('accept')?.includes('image/webp');
  const body = wantsWebp ? row.webp : row.jpeg;

  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': wantsWebp ? 'image/webp' : 'image/jpeg',
      'X-Content-Type-Options': 'nosniff',
      // Never cached. An image under review can be rejected and deleted a
      // moment later, and a stale copy in a shared cache outlives that decision.
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
