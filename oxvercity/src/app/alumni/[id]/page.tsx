/**
 * /alumni/<id> — one full profile. Signed-in Xaverians only.
 *
 * ## Why an anonymous visitor gets 404 and not a redirect
 *
 * A redirect to /login, or a "please sign in" page, answers a question we
 * should not answer: it confirms that `<id>` names a real alumnus. Someone
 * handed a profile link could test whether that person is in the Association's
 * directory without ever signing in. A 404 says the same thing for a real id
 * and an invented one — there is nothing here — which is the only response that
 * discloses nothing.
 *
 * The same reasoning runs the other way too: `readProfile` returns null for an
 * unknown id *and* for a withdrawn record (`is_visible = false`), and both land
 * on the same `notFound()`. Someone who has left the directory does not want
 * their absence to be distinguishable from never having been in it.
 *
 * ## generateStaticParams is gone, deliberately
 *
 * The previous version pre-rendered a page per profile at build time. A static
 * profile page is a public profile page no matter what the authorisation code
 * says, because the authorisation code never runs. `force-dynamic` means the
 * session is resolved on every request.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SiteShell } from '@/components/layout/SiteShell';
import { AlumniProfileView } from '@/components/alumni/AlumniProfileView';
import { readProfile, servingDemoRecords } from '@/lib/directory';
import { currentSession } from '@/lib/session-cookie';
import { spendProfileView } from '@/lib/view-budget';
import { ViewBudgetNotice } from '@/components/alumni/ViewBudgetNotice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The title is the same for everyone, signed in or not.
 *
 * Putting the alumnus's name in the title would leak it through the browser
 * tab, the history entry and any link preview — to a viewer who, if they are
 * not signed in, is about to be shown a 404 anyway.
 */
export const metadata: Metadata = {
  title: 'Alumni Directory — SXCCAA',
  robots: { index: false, follow: false },
};

export default async function AlumniProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) notFound();

  /*
   * The view budget is spent before the record is read, not after.
   *
   * Reading first and charging afterwards would mean the decrypted profile has
   * already been assembled by the time the refusal happens — and a refusal that
   * still does the work is a rate limit that does not limit anything.
   */
  const budget = await spendProfileView(session);
  if (!budget.allowed) {
    return (
      <SiteShell lightPage={true}>
        <div className="al-page">
          <ViewBudgetNotice />
        </div>
      </SiteShell>
    );
  }

  const person = await readProfile((await params).id, session);
  if (!person) notFound();

  return (
    <SiteShell lightPage={true}>
      <div className="al-page">
        <AlumniProfileView person={person} isDemo={servingDemoRecords()} />
      </div>
    </SiteShell>
  );
}
