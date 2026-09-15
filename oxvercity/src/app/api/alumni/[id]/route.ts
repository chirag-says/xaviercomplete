/**
 * GET /api/alumni/<id> — one profile as JSON, for signed-in Xaverians.
 *
 * This route exists so the gate can be tested the way an attacker probes it:
 * page markup is awkward to assert against, JSON is not. `npm run gate:verify`
 * drives it directly.
 *
 * It must behave **identically** to the page at /alumni/<id>, and the way that
 * is guaranteed is that both call `readProfile` with a session and neither
 * contains any field logic of its own. If the two ever disagree, the JSON route
 * is the one an attacker will find.
 *
 * Note what is not here: no `?fields=`, no `?ids=`, no list form. One profile
 * per request, by id, or nothing. A bulk endpoint would hand a single signed-in
 * account the whole directory in one call and make the view budget in plan
 * §10.4 meaningless.
 */

import { NextResponse } from 'next/server';

import { readProfile } from '@/lib/directory';
import { currentSession } from '@/lib/session-cookie';
import { spendProfileView } from '@/lib/view-budget';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 404 for anonymous, 404 for unknown, 404 for withdrawn — one response, so the
 * three are indistinguishable. 401 would be more conventional and would tell a
 * prober that the id is real and worth coming back to with a session.
 */
function nothingHere(): NextResponse {
  return NextResponse.json(
    { error: 'not_found' },
    {
      status: 404,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await currentSession();
  if (!session) return nothingHere();

  // Same budget as the page, spent before the record is read. A 429 rather than
  // a 404: this caller is legitimate and has simply run out, and telling them
  // the profile does not exist would be a lie they might act on.
  const budget = await spendProfileView(session);
  if (!budget.allowed) {
    return NextResponse.json(
      { error: 'view_budget_exhausted' },
      {
        status: 429,
        headers: { 'Retry-After': '3600', 'Cache-Control': 'private, no-store, max-age=0' },
      },
    );
  }

  const person = await readProfile((await params).id, session);
  if (!person) return nothingHere();

  // `person` is a PrivateAlumnus, whose hidden fields are absent rather than
  // null, so JSON.stringify drops them. There is no filtering step here on
  // purpose — a second place that decides what to send is a second place that
  // can disagree with the first.
  return NextResponse.json(person, {
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
